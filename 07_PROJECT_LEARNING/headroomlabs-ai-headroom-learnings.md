# Forensic Learning Record (Deep Inspection): headroomlabs-ai/headroom

> **Canonical Artifact**: `07_PROJECT_LEARNING/headroomlabs-ai-headroom-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/headroomlabs-ai/headroom](https://github.com/headroomlabs-ai/headroom))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:37:33.081Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `headroomlabs-ai/headroom`
- **Description**: Compress tool outputs, logs, files, and RAG chunks before they reach the LLM. 20% fewer tokens for coding agents, 60-95% fewer tokens for JSON, same answers. Library, proxy, MCP server.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 74170 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/__init__.py`
```
"""Headroom SDK Benchmark Suite.

This package provides performance benchmarks for Headroom transforms and relevance
scorers. Benchmarks use pytest-benchmark for accurate timing measurements.

Usage:
    # Run all benchmarks
    pytest benchmarks/ --benchmark-only

    # Run specific suite
    pytest benchmarks/bench_transforms.py --benchmark-only

    # Generate comparison report
    python benchmarks/run_benchmarks.py --suite all --output report.md

Performance Targets:
    - SmartCrusher: < 10ms for 1000 items
    - CacheAligner: < 1ms for date extraction
    - BM25Scorer: < 1ms for 100 items
    - HybridScorer: < 50ms for 100 items (with embeddings)
"""

__version__ = "0.2.0"

from .scenarios.conversations import (
    generate_agentic_conversation,
    generate_rag_conversation,
)
from .scenarios.tool_outputs import (
    generate_api_responses,
    generate_database_rows,
    generate_log_entries,
    generate_search_results,
)

__all__ = [
    # Data generators
    "generate_search_results",
    "generate_log_entries",
    "generate_api_responses",
    "generate_database_rows",
    # Conversation generators
    "generate_agentic_conversation",
    "generate_rag_conversation",
]

```

### Core Architecture Module: `benchmarks/agent_cost_benchmark.py`
```
#!/usr/bin/env python3
"""
Agent Cost Crisis Benchmark - The Compelling Story

This benchmark demonstrates WHY Headroom matters by showing:

1. THE PROBLEM: Context explosion in real-world agent workloads
   - Tokens grow exponentially with conversation length
   - Tool outputs dominate context (often 70%+ of tokens)
   - Dynamic content breaks cache efficiency

2. THE SOLUTION: Headroom's impact on real workloads
   - Token reduction from SmartCrusher (50-80% on tool outputs)
   - Cache alignment improvement (10x+ potential savings)
   - Context windowing (stay within limits without losing info)

3. THE PROOF: Quality preservation
   - Critical information retained (errors, anomalies, relevant items)
   - Agent task completion unaffected
   - Information retrieval accuracy maintained

Usage:
    python benchmarks/agent_cost_benchmark.py
    python benchmarks/agent_cost_benchmark.py --format markdown > BENCHMARK.md
    python benchmarks/agent_cost_benchmark.py --scenario coding-agent
"""

from __future__ import annotations

import argparse
import json
import statistics
import time
from dataclasses import dataclass, field
from typing import Any

# Benchmark scenario imports
from benchmarks.scenarios.conversations import (
    generate_agentic_conversation,
    generate_rag_conversation,
)
from benchmarks.scenarios.tool_outputs import (
    generate_log_entries,
    generate_search_results,
)

# Headroom imports
from headroom.transforms.smart_crusher import SmartCrusherConfig, smart_crush_tool_output

# =============================================================================
#: Share of turns in a steady-state agent session whose prefix is already
#: cached. A 50-turn session writes its prefix once and reads it on the other
#: 49 turns, so 0.98 is the arithmetic rather than a guess; the round 0.95 below
#: leaves room for the TTL expiries a real session hits mid-run. Used ONLY by
#: this synthetic benchmark -- the proxy never assumes a hit rate, it reads the
#: provider's reported mix per request (headroom.pricing.counterfactual).
WARM_CACHE_SHARE = 0.95

# PRICING DATA (as of 2025)
# =============================================================================

PRICING = {
    # Anthropic Claude 3.5 Sonnet
    "claude-3.5-sonnet": {
        "input": 3.00 / 1_000_000,  # $3 per 1M tokens
        "output": 15.00 / 1_000_000,  # $15 per 1M tokens
        "cached_input": 0.30 / 1_000_000,  # 90% discount on cache hit
        "cache_write": 3.75 / 1_000_000,  # 25% premium to write cache
    },
    # OpenAI GPT-4o
    "gpt-4o": {
        "input": 2.50 / 1_000_000,
        "output": 10.00 / 1_000_000,
        "cached_input": 1.25 / 1_000_000,  # 50% discount
    },
    # Google Gemini 1.5 Pro
    "gemini-1.5-pro": {
        "input": 1.25 / 1_000_000,
        "output": 5.00 / 1_000_000,
        "cached_input": 0.3125 / 1_000_000,  # 75% discount
    },
}

# Approximate tokens per character (GPT-4 tokenizer average)
CHARS_PER_TOKEN = 4


def _warm_savings(tokens_saved: int, pricing: dict) -> float:
    """Value ``tokens_saved`` for a session whose prefix is mostly already cached.

    The share given by :data:`WARM_CACHE_SHARE` would have been billed as cache
    READS had those tokens been sent; the rest as ordinary input. For Anthropic
    that is a 10x difference per token, which is why the cold-only figure this
    benchmark used to print was the single most misleading number it produced.

    Falls back to the list rate for a pricing row with no cached rate, which is
    the correct answer for a provider that does not discount cache reads.
    """
    if tokens_saved <= 0:
        return 0.0
    cached_rate = pricing.get("cached_input", pricing["input"])
    warm = tokens_saved * WARM_CACHE_SHARE * cached_rate
    cold = tokens_saved * (1.0 - WARM_CACHE_SHARE) * pricing["input"]
    return warm + cold


@dataclass
class CostAnalysis:
    """Cost analysis for a workload."""

    tokens_input: int = 0
    tokens_output: int = 0
    tokens_cached: int = 0

    cost_baseline: float = 0.0
    cost_optimized: float = 0.0
    cost_with_cache: float = 0.0

    savings_from_compression: float = 0.0
    savings_from_caching: float = 0.0
    total_savings_percent: float = 0.0

    # Compression savings under a WARM cache -- the realistic steady state for
    # an agent session, where the prefix is written once and read on every
    # later turn. `savings_from_compression` above is the COLD figure: it
    # prices every removed token as a cache miss, which is true only for the
    # first request of a cache window. Reporting the cold number alone
    # overstates a long session's saving by up to 10x, so both are carried and
    # the report names which assumption each one is under.
    savings_from_compression_warm: float = 0.0
    #: Fraction of turns whose prefix was already cached. See WARM_CACHE_SHARE.
    cache_profile: str = "cold"


@dataclass
class BenchmarkResult:
    """Result from a single benchmark scenario."""

    name: str
    description: str

    # Token metrics
    tokens_original: int = 0
    tokens_optimized: int = 0
    compression_ratio: float = 0.0

    # Cache metrics
    cache_hit_rate_baseline: float = 0.0
    cache_hit_rate_optimized: float = 0.0

    # Quality metrics
    critical_items_retained: int = 0
    critical_items_total: int = 0
    retention_rate: float = 0.0

    # Cost analysis
    cost_analysis: CostAnalysis = field(default_factory=CostAnalysis)

    # Performance
    optimization_latency_ms: float = 0.0

    # Details
    details: dict[str, Any] = field(default_factory=dict)


# =============================================================================
# SCENARIO 1: Coding Agent Context Explosion
# =============================================================================


def benchmark_coding_agent_explosion() -> BenchmarkResult:
    """
    Simulate a Claude Code / Cursor style coding agent session.

    Shows how context explodes as the agent:
    - Searches codebase (100s of file snippets)
    - Reads documentation (large text blocks)
    - Makes tool calls (grep, find, read)
    - Accumulates conversation history
    """
    result = BenchmarkResult(
        name="Coding Agent Context Explosion",
        description="50-turn coding session with file search, grep, and documentation lookups",
    )

    # Generate realistic coding agent conversation
    messages = generate_agentic_conversation(
        turns=50,
        tool_calls_per_turn=2,
        items_per_tool_response=100,  # 100 search results per tool call
    )

    # Calculate original tokens
    original_content = json.dumps(messages)
    result.tokens_original = len(original_content) // CHARS_PER_TOKEN

    # Apply Headroom transforms using convenience function
    config = SmartCrusherConfig(max_items_after_crush=20)

    start = time.perf_counter()

    optimized_messages = []
    critical_retained = 0
    critical_total = 0

    for msg in messages:
        if msg.get("role") == "tool":
            # Parse tool content as JSON array
            try:
                original_content = msg.get("content", "[]")
                content = json.loads(original_content)
                if isinstance(content, list) and len(content) > 10:
                    # Count critical items (errors, high-relevance)
                    for item in content:
                        if isinstance(item, dict):
                            if item.get("error") or item.get("status") == "failed":
                                critical_total += 1
                            if item.get("is_needle"):
                                critical_total += 1

                    # Compress with SmartCrusher convenience function
                    compressed_str, was_modified, _ = smart_crush_tool_output(
                        original_content, config
                    )

                    if was_modified:
                        compressed = json.loads(compressed_str)
   
```

### Core Architecture Module: `benchmarks/bench_latency.py`
```
#!/usr/bin/env python3
"""Latency benchmark for Headroom compression pipeline.

Measures compression overhead across content types and input sizes,
profiles individual transform stages, and computes cost-benefit analysis
to answer: "Does the token savings outweigh added processing time?"

Usage:
    # Run with terminal output (default)
    python benchmarks/bench_latency.py

    # Save markdown report
    python benchmarks/bench_latency.py --output docs/LATENCY_BENCHMARKS.md

    # Save JSON results
    python benchmarks/bench_latency.py --json latency_results.json

    # Custom iterations
    python benchmarks/bench_latency.py --iterations 50

    # Run specific content type only
    python benchmarks/bench_latency.py --scenario json
    python benchmarks/bench_latency.py --scenario code
    python benchmarks/bench_latency.py --scenario text
    python benchmarks/bench_latency.py --scenario logs
    python benchmarks/bench_latency.py --scenario agentic

Scenarios:
    json     - JSON arrays via SmartCrusher (100-5K items)
    code     - Python source via CodeCompressor (50-1000 lines)
    text     - Plain text/RAG via Kompress fallback (1K-50K tokens)
    logs     - Structured logs via LogCompressor (100-5K entries)
    agentic  - Multi-turn agent conversations (10-100 turns)
    rag      - RAG conversations with large context (5K-50K tokens)
"""

from __future__ import annotations

import argparse
import json
import math
import platform
import random
import statistics
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Ensure benchmarks package is importable when running as script
# ---------------------------------------------------------------------------
_repo_root = Path(__file__).resolve().parent.parent
if str(_repo_root) not in sys.path:
    sys.path.insert(0, str(_repo_root))

from benchmarks.scenarios.conversations import (  # noqa: E402
    generate_agentic_conversation,
    generate_rag_conversation,
)
from benchmarks.scenarios.tool_outputs import (  # noqa: E402
    generate_api_responses,
    generate_database_rows,
    generate_log_entries,
    generate_search_results,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# LLM prefill rates (ms per input token) for cost-benefit analysis.
# These are conservative estimates based on published benchmarks and represent
# the incremental TTFT contribution per additional input token.
MODEL_PROFILES: dict[str, dict[str, float]] = {
    "gpt-4o-mini": {
        "ms_per_token": 0.01,
        "price_per_mtok_input": 0.15,
        "label": "GPT-4o Mini",
    },
    "gpt-4o": {
        "ms_per_token": 0.03,
        "price_per_mtok_input": 2.50,
        "label": "GPT-4o",
    },
    "claude-sonnet-4-5": {
        "ms_per_token": 0.03,
        "price_per_mtok_input": 3.00,
        "label": "Claude Sonnet 4.5",
    },
    "claude-opus-4": {
        "ms_per_token": 0.08,
        "price_per_mtok_input": 15.00,
        "label": "Claude Opus 4",
    },
}

# Reference model for the main report table
REFERENCE_MODEL = "claude-sonnet-4-5"


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class Scenario:
    """A benchmark scenario to measure."""

    name: str
    content_type: str  # json, code, text, logs, agentic, rag
    size_label: str  # Human-readable size (e.g., "100 items", "50 turns")
    messages: list[dict[str, Any]]
    model_limit: int = 200_000  # Context limit for pipeline


@dataclass
class TransformTiming:
    """Timing for a single transform within the pipeline."""

    name: str
    durations_ms: list[float] = field(default_factory=list)

    @property
    def p50_ms(self) -> float:
        if not self.durations_ms:
            return 0.0
        s = sorted(self.durations_ms)
        return s[len(s) // 2]

    @property
    def mean_ms(self) -> float:
        return statistics.mean(self.durations_ms) if self.durations_ms else 0.0


@dataclass
class LatencyResult:
    """Result of benchmarking a single scenario."""

    scenario_name: str
    content_type: str
    size_label: str
    tokens_before: int
    tokens_after: int
    tokens_saved: int
    compression_ratio: float
    num_messages: int
    timings_ms: list[float]  # Full pipeline timings per iteration
    transform_timings: dict[str, TransformTiming] = field(default_factory=dict)
    transforms_applied: list[str] = field(default_factory=list)

    @property
    def p50_ms(self) -> float:
        s = sorted(self.timings_ms)
        return s[len(s) // 2]

    @property
    def p95_ms(self) -> float:
        s = sorted(self.timings_ms)
        idx = int(math.ceil(0.95 * len(s))) - 1
        return s[max(0, idx)]

    @property
    def p99_ms(self) -> float:
        s = sorted(self.timings_ms)
        idx = int(math.ceil(0.99 * len(s))) - 1
        return s[max(0, idx)]

    @property
    def mean_ms(self) -> float:
        return statistics.mean(self.timings_ms)

    @property
    def stddev_ms(self) -> float:
        return statistics.stdev(self.timings_ms) if len(self.timings_ms) > 1 else 0.0

    @property
    def min_ms(self) -> float:
        return min(self.timings_ms)

    @property
    def max_ms(self) -> float:
        return max(self.timings_ms)

    def to_dict(self) -> dict[str, Any]:
        return {
            "scenario_name": self.scenario_name,
            "content_type": self.content_type,
            "size_label": self.size_label,
            "tokens_before": self.tokens_before,
            "tokens_after": self.tokens_after,
            "tokens_saved": self.tokens_saved,
            "compression_ratio": self.compression_ratio,
            "num_messages": self.num_messages,
            "iterations": len(self.timings_ms),
            "p50_ms": round(self.p50_ms, 3),
            "p95_ms": round(self.p95_ms, 3),
            "p99_ms": round(self.p99_ms, 3),
            "mean_ms": round(self.mean_ms, 3),
            "stddev_ms": round(self.stddev_ms, 3),
            "min_ms": round(self.min_ms, 3),
            "max_ms": round(self.max_ms, 3),
            "transforms_applied": self.transforms_applied,
            "transform_breakdown": {
                name: {
                    "p50_ms": round(tt.p50_ms, 3),
                    "mean_ms": round(tt.mean_ms, 3),
                }
                for name, tt in self.transform_timings.items()
            },
        }


# ---------------------------------------------------------------------------
# Code generation (for CodeCompressor scenarios)
# ---------------------------------------------------------------------------


def _generate_python_function(name: str, lines: int) -> str:
    """Generate a realistic Python function."""
    parts = [f"def {name}(data: list[dict], config: dict | None = None) -> dict:"]
    parts.append(f'    """Process {name.replace("_", " ")} and return results."""')
    parts.append("    if config is None:")
    parts.append("        config = {}")
    parts.append(f'    results = {{"function": "{name}", "items": []}}')
    parts.append("    errors = []")
    parts.append("")

    # Fill body to target line count
    for i in range(max(0, lines - 12)):
        kind = i % 5
        if kind == 0:
            parts.append(f"    for item in data[{i}:{i + 10}]:")
            parts.append(f'        value = item.get("field_{i}", None)')
        elif kind == 1:
            parts.append(f"    if len(results['items']) > {i * 10}:")
            parts.append('        results["overflow"] = True')
        elif kind == 2:
            parts.append("    try:")
            parts.append(f"        computed = sum(x.get('value', 0) for 
```

### Core Architecture Module: `benchmarks/bench_relevance.py`
```
"""Relevance scorer benchmarks for Headroom SDK.

This module contains performance benchmarks for relevance scorers:
- BM25Scorer: Zero-dependency keyword matching
- HybridScorer: BM25 + embedding fusion (with graceful fallback)

Performance Targets:
    BM25Scorer:
        - Single item: < 0.1ms
        - Batch 100: < 1ms
        - Batch 1000: < 10ms

    HybridScorer (BM25 fallback):
        - Single item: < 0.2ms
        - Batch 100: < 2ms

    HybridScorer (with embeddings):
        - Single item: < 5ms
        - Batch 100: < 50ms

Run with:
    pytest benchmarks/bench_relevance.py --benchmark-only -v
"""

from __future__ import annotations

import json

import pytest


def _check_embedding_available() -> bool:
    """Check if sentence-transformers is available for embedding tests."""
    try:
        import sentence_transformers  # noqa: F401

        return True
    except ImportError:
        return False


class TestBM25Benchmarks:
    """Benchmarks for BM25 keyword relevance scorer.

    BM25Scorer performs:
    - Text tokenization (regex-based)
    - IDF computation
    - BM25 score calculation
    - Long-token bonus (UUIDs, IDs)

    Expected performance:
    - O(n*m) where n=tokens in item, m=tokens in query
    - Single item: < 0.1ms
    - Batch operations are linear with items
    """

    @pytest.fixture
    def scorer(self):
        """Create BM25 scorer instance."""
        from headroom.relevance.bm25 import BM25Scorer

        return BM25Scorer()

    def test_single_item(
        self,
        benchmark,
        scorer,
        json_items_100,
        query_context_uuid,
    ):
        """Benchmark scoring a single item.

        Target: < 0.1ms
        Tests basic scoring overhead.
        """
        item = json_items_100[0]
        result = benchmark(scorer.score, item, query_context_uuid)

        assert result.score >= 0.0
        assert result.score <= 1.0

    def test_batch_100(
        self,
        benchmark,
        scorer,
        json_items_100,
        query_context_uuid,
    ):
        """Benchmark scoring 100 items in batch.

        Target: < 1ms
        Tests typical batch size for SmartCrusher.
        """
        results = benchmark(scorer.score_batch, json_items_100, query_context_uuid)

        assert len(results) == 100
        assert all(0.0 <= r.score <= 1.0 for r in results)

    def test_batch_1000(
        self,
        benchmark,
        scorer,
        json_items_1000,
        query_context_uuid,
    ):
        """Benchmark scoring 1000 items in batch.

        Target: < 10ms
        Tests larger batch for stress testing.
        """
        results = benchmark(scorer.score_batch, json_items_1000, query_context_uuid)

        assert len(results) == 1000

    def test_uuid_matching(
        self,
        benchmark,
        scorer,
        json_items_100,
        query_context_uuid,
    ):
        """Benchmark UUID pattern matching.

        Target: < 1ms
        Tests regex efficiency for UUID detection.
        """
        # Query contains UUID - tests that BM25 can handle long token patterns
        results = benchmark(scorer.score_batch, json_items_100, query_context_uuid)

        # Verify scoring completes - specific matches depend on generated data
        assert len(results) == 100
        assert all(r.score >= 0.0 for r in results)

    def test_semantic_query(
        self,
        benchmark,
        scorer,
        json_items_100,
        query_context_semantic,
    ):
        """Benchmark semantic query (BM25 limitations).

        Target: < 1ms
        Tests keyword matching on semantic queries.
        """
        # BM25 will only match literal terms
        results = benchmark(scorer.score_batch, json_items_100, query_context_semantic)

        assert len(results) == 100

    def test_empty_context(
        self,
        benchmark,
        scorer,
        json_items_100,
    ):
        """Benchmark with empty query context.

        Target: < 0.5ms
        Tests early-exit optimization.
        """
        results = benchmark(scorer.score_batch, json_items_100, "")

        # All scores should be 0 with no context
        assert all(r.score == 0.0 for r in results)

    def test_long_items(
        self,
        benchmark,
        scorer,
        log_entries_1000,
        query_context_semantic,
    ):
        """Benchmark scoring longer items (log entries).

        Target: < 15ms
        Tests performance with larger text per item.
        """
        json_items = [json.dumps(entry) for entry in log_entries_1000]
        results = benchmark(scorer.score_batch, json_items, query_context_semantic)

        assert len(results) == 1000


class TestHybridBenchmarks:
    """Benchmarks for Hybrid BM25+Embedding scorer.

    HybridScorer performs:
    - BM25 scoring (always)
    - Embedding scoring (if available)
    - Adaptive alpha computation
    - Score fusion

    Without embeddings (fallback mode):
    - Single item: < 0.2ms
    - Batch 100: < 2ms

    With embeddings (full mode):
    - Single item: < 5ms (model inference)
    - Batch 100: < 50ms (batched inference)
    """

    @pytest.fixture
    def scorer_fallback(self):
        """Create hybrid scorer without embeddings (BM25 fallback)."""
        from headroom.relevance.bm25 import BM25Scorer
        from headroom.relevance.hybrid import HybridScorer

        # Force BM25-only mode by not providing embedding scorer
        scorer = HybridScorer(
            alpha=0.5,
            adaptive=True,
            bm25_scorer=BM25Scorer(),
            embedding_scorer=None,
        )
        # Ensure we're in fallback mode
        scorer._embedding_available = False
        return scorer

    @pytest.fixture
    def scorer_full(self):
        """Create hybrid scorer with embeddings (if available)."""
        from headroom.relevance.hybrid import HybridScorer

        scorer = HybridScorer(alpha=0.5, adaptive=True)
        return scorer

    def test_single_item_fallback(
        self,
        benchmark,
        scorer_fallback,
        json_items_100,
        query_context_uuid,
    ):
        """Benchmark single item scoring (BM25 fallback).

        Target: < 0.2ms
        Tests fallback mode overhead.
        """
        item = json_items_100[0]
        result = benchmark(scorer_fallback.score, item, query_context_uuid)

        assert "BM25 only" in result.reason

    def test_batch_100_fallback(
        self,
        benchmark,
        scorer_fallback,
        json_items_100,
        query_context_uuid,
    ):
        """Benchmark batch scoring (BM25 fallback).

        Target: < 2ms
        Tests fallback batch performance.
        """
        results = benchmark(scorer_fallback.score_batch, json_items_100, query_context_uuid)

        assert len(results) == 100

    def test_adaptive_alpha_uuid(
        self,
        benchmark,
        scorer_fallback,
        json_items_100,
        query_context_uuid,
    ):
        """Benchmark adaptive alpha with UUID query.

        Target: < 2ms
        Tests alpha computation overhead.
        """
        results = benchmark(scorer_fallback.score_batch, json_items_100, query_context_uuid)

        # UUID query should favor BM25 (but we're in fallback mode)
        assert len(results) == 100

    def test_adaptive_alpha_semantic(
        self,
        benchmark,
        scorer_fallback,
        json_items_100,
        query_context_semantic,
    ):
        """Benchmark adaptive alpha with semantic query.

        Target: < 2ms
        Tests alpha computation for semantic queries.
        """
        results = benchmark(scorer_fallback.score_batch, json_items_100, query_context_semantic)

        assert len(results) == 100

    @pytest.mark.skipif(
        not _check_embedding_available(),
        reason="sentence-transformers not installed",
    )
    def test_single_item_full(
        self,
        benchmark,
        scorer_full,
        json_items_100,
        query_context_uuid,
    ):
   
```

### Core Architecture Module: `benchmarks/bench_transforms.py`
```
"""Transform benchmarks for Headroom SDK.

This module contains performance benchmarks for Headroom transforms:
- SmartCrusher: Statistical tool output compression
- CacheAligner: Cache-aligned prefix optimization

Performance Targets:
    SmartCrusher:
        - 100 items: < 2ms
        - 1000 items: < 10ms
        - 10000 items: < 100ms

    CacheAligner:
        - Date extraction: < 1ms
        - Hash computation: < 0.5ms

Run with:
    pytest benchmarks/bench_transforms.py --benchmark-only -v
"""

from __future__ import annotations

import json

import pytest


class TestSmartCrusherBenchmarks:
    """Benchmarks for SmartCrusher statistical compression.

    SmartCrusher performs:
    - Array analysis (field statistics, pattern detection)
    - Change point detection for numeric fields
    - Relevance scoring against query context
    - Strategic sampling (first K, last K, errors, anomalies)

    Expected performance:
    - O(n) for array analysis
    - O(n) for relevance scoring (BM25)
    - Total: < 10ms for 1000 items
    """

    @pytest.fixture
    def crusher(self, smart_crusher_config):
        """Create SmartCrusher instance."""
        from headroom.transforms.smart_crusher import SmartCrusher

        return SmartCrusher(config=smart_crusher_config)

    def test_compress_100_items(
        self,
        benchmark,
        crusher,
        mock_tokenizer,
        items_100,
    ):
        """Benchmark crushing 100 search results.

        Target: < 2ms
        This is the typical size for API responses.
        """
        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Search for users"},
            {
                "role": "tool",
                "tool_call_id": "call_1",
                "content": json.dumps(items_100),
            },
        ]

        result = benchmark(crusher.apply, messages, mock_tokenizer)

        # Verify compression occurred
        assert result.tokens_after < result.tokens_before
        assert len(result.transforms_applied) > 0

    def test_compress_1000_items(
        self,
        benchmark,
        crusher,
        mock_tokenizer,
        items_1000,
    ):
        """Benchmark crushing 1000 search results.

        Target: < 10ms
        This tests larger tool outputs from extensive searches.
        """
        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Search for all users"},
            {
                "role": "tool",
                "tool_call_id": "call_1",
                "content": json.dumps(items_1000),
            },
        ]

        result = benchmark(crusher.apply, messages, mock_tokenizer)

        assert result.tokens_after < result.tokens_before

    def test_compress_10000_items(
        self,
        benchmark,
        crusher,
        mock_tokenizer,
        items_10000,
    ):
        """Benchmark crushing 10000 search results.

        Target: < 100ms
        Stress test for very large tool outputs.
        """
        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Export all data"},
            {
                "role": "tool",
                "tool_call_id": "call_1",
                "content": json.dumps(items_10000),
            },
        ]

        result = benchmark(crusher.apply, messages, mock_tokenizer)

        assert result.tokens_after < result.tokens_before

    def test_analyze_log_entries(
        self,
        benchmark,
        crusher,
        mock_tokenizer,
        log_entries_1000,
    ):
        """Benchmark crushing log entries (cluster detection).

        Target: < 15ms
        Tests cluster sampling strategy for repetitive logs.
        """
        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Show recent logs"},
            {
                "role": "tool",
                "tool_call_id": "call_1",
                "content": json.dumps(log_entries_1000),
            },
        ]

        result = benchmark(crusher.apply, messages, mock_tokenizer)

        assert result.tokens_after < result.tokens_before

    def test_analyze_metrics_with_anomalies(
        self,
        benchmark,
        crusher,
        mock_tokenizer,
        database_rows_1000,
    ):
        """Benchmark crushing metrics data (anomaly detection).

        Target: < 15ms
        Tests change point detection and anomaly preservation.
        """
        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Get CPU metrics"},
            {
                "role": "tool",
                "tool_call_id": "call_1",
                "content": json.dumps(database_rows_1000),
            },
        ]

        result = benchmark(crusher.apply, messages, mock_tokenizer)

        assert result.tokens_after < result.tokens_before

    def test_multiple_tool_outputs(
        self,
        benchmark,
        crusher,
        mock_tokenizer,
        items_100,
        log_entries_100,
    ):
        """Benchmark crushing multiple tool outputs in one pass.

        Target: < 5ms
        Tests realistic scenario with multiple tool calls.
        """
        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Search users and get logs"},
            {
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": "call_1",
                        "type": "function",
                        "function": {"name": "search", "arguments": "{}"},
                    },
                    {
                        "id": "call_2",
                        "type": "function",
                        "function": {"name": "logs", "arguments": "{}"},
                    },
                ],
            },
            {"role": "tool", "tool_call_id": "call_1", "content": json.dumps(items_100)},
            {"role": "tool", "tool_call_id": "call_2", "content": json.dumps(log_entries_100)},
        ]

        result = benchmark(crusher.apply, messages, mock_tokenizer)

        assert result.tokens_after < result.tokens_before


class TestCacheAlignerBenchmarks:
    """Benchmarks for CacheAligner prefix optimization.

    CacheAligner performs:
    - Date pattern detection and extraction
    - Whitespace normalization
    - Stable prefix hash computation

    Expected performance:
    - Date extraction: < 1ms (regex matching)
    - Hash computation: < 0.5ms (MD5)
    - Total: < 2ms for typical system prompts
    """

    @pytest.fixture
    def aligner(self, cache_aligner_config):
        """Create CacheAligner instance."""
        from headroom.transforms.cache_aligner import CacheAligner

        return CacheAligner(config=cache_aligner_config)

    def test_date_extraction(
        self,
        benchmark,
        aligner,
        mock_tokenizer,
        messages_with_system_date,
    ):
        """Benchmark date extraction from system prompt.

        Target: < 1ms
        Tests regex-based date pattern matching.
        """
        result = benchmark(aligner.apply, messages_with_system_date, mock_tokenizer)

        # Verify date was extracted
        assert "cache_align" in str(result.transforms_applied)

    def test_hash_computation(
        self,
        benchmark,
        aligner,
        mock_tokenizer,
        system_prompt_long,
    ):
        """Benchmark stable prefix hash computation.

        Target: < 0.5ms
        Tests hash stability for cache hit prediction.
        """
        messages = [
            {"role": "system", "content": system_prompt_long},
            {"role": "user", "content": "Hello"},
        ]

        re
```

### Core Architecture Module: `benchmarks/cache_bust_trace_report.py`
```
#!/usr/bin/env python3
"""Trace and report concrete cache-busting turns from local Claude session replays."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


DEFAULT_OUTPUT_DIR = Path("benchmark_results") / "cache_bust_trace"


@dataclass
class BustEvent:
    branch: str
    mode: str
    session_id: str
    project: str
    request_id: str
    timestamp: str
    first_diff_index: int | None
    prev_len: int
    curr_len: int
    prev_msg: dict[str, Any] | None
    curr_msg: dict[str, Any] | None
    prev_tail: list[dict[str, Any]]
    curr_tail: list[dict[str, Any]]
    retroactive_rewrite: bool


def _run_git(args: list[str], cwd: Path) -> str:
    completed = subprocess.run(
        ["git", *args],
        cwd=cwd,
        check=True,
        capture_output=True,
        text=True,
    )
    return completed.stdout.strip()


def _ref_slug(ref: str) -> str:
    return "".join(ch if ch.isalnum() else "-" for ch in ref).strip("-").lower() or "ref"


def _first_diff_index(prev: list[dict[str, Any]], curr: list[dict[str, Any]]) -> int | None:
    for i, (a, b) in enumerate(zip(prev, curr)):
        if a != b:
            return i
    if len(prev) != len(curr):
        return min(len(prev), len(curr))
    return None


def _trace_branch(
    repo_root: Path,
    ref: str,
    label: str,
    *,
    recent_turns_per_session: int,
    max_events_per_mode: int = 10,
) -> list[BustEvent]:
    worktree_root = Path(tempfile.mkdtemp(prefix="headroom-bust-trace-"))
    worktree_dir = worktree_root / _ref_slug(label)
    _run_git(["worktree", "add", "--detach", str(worktree_dir), ref], repo_root)
    try:
        env = os.environ.copy()
        env["PYTHONPATH"] = str(worktree_dir)
        code = """
import copy, json
from datetime import timedelta
from pathlib import Path
import importlib.util
import os
import sys

module_path = Path(os.environ['BUST_TRACE_SCRIPT'])
spec = importlib.util.spec_from_file_location('branch_benchmark', module_path)
mod = importlib.util.module_from_spec(spec)
assert spec and spec.loader
sys.modules[spec.name] = mod
spec.loader.exec_module(mod)

PROXY_MODE_CACHE = mod.PROXY_MODE_CACHE
PROXY_MODE_TOKEN = mod.PROXY_MODE_TOKEN
PrefixCacheTracker = mod.PrefixCacheTracker
_apply_mode_to_messages = mod._apply_mode_to_messages
_cache_gap_within_ttl = mod._cache_gap_within_ttl
_rewrite_scope = mod._rewrite_scope
get_tokenizer = mod.get_tokenizer
load_session_replay = mod.load_session_replay
select_session_files = mod.select_session_files
trim_replay_to_recent_turns = mod.trim_replay_to_recent_turns
_make_proxy = mod._make_proxy
from headroom.cache.compression_cache import CompressionCache

ROOT = Path.home() / '.claude' / 'projects'
TTL = timedelta(minutes=5)
recent_turns_per_session = int(__import__('os').environ['BUST_TRACE_RECENT'])
max_events_per_mode = int(__import__('os').environ['BUST_TRACE_MAX'])

def first_diff_index(prev, curr):
    for i, (a, b) in enumerate(zip(prev, curr)):
        if a != b:
            return i
    if len(prev) != len(curr):
        return min(len(prev), len(curr))
    return None

def trace_mode(mode):
    proxy = _make_proxy(mode)
    session_files = select_session_files(ROOT)
    events = []
    for session_file in session_files:
        replay = load_session_replay(session_file)
        if replay is None:
            continue
        replay = trim_replay_to_recent_turns(replay, recent_turns_per_session)
        prefix_tracker = PrefixCacheTracker('anthropic')
        comp_cache = CompressionCache() if mode == PROXY_MODE_TOKEN else None
        conversation = []
        conversation_token_total = 0
        previous_forwarded = []
        previous_original_context = None
        previous_forwarded_context = None
        previous_timestamp = None
        pending = None
        for turn in replay.turns:
            tokenizer = get_tokenizer(turn.model)
            turn_input_token_total = sum(tokenizer.count_message(msg) for msg in turn.input_messages)
            prior_context_message_count = len(conversation)
            conversation.extend(turn.input_messages)
            raw_input_tokens = conversation_token_total + turn_input_token_total
            forwarded = _apply_mode_to_messages(
                proxy, mode, conversation,
                model=turn.model, prefix_tracker=prefix_tracker, comp_cache=comp_cache,
                previous_original_messages=previous_original_context,
                previous_forwarded_messages=previous_forwarded_context,
            )
            if pending is not None:
                eligible = _cache_gap_within_ttl(pending.turn.timestamp, previous_timestamp, ttl=TTL)
                if eligible and previous_forwarded:
                    prefix_preserved = (
                        len(pending.forwarded) >= len(previous_forwarded)
                        and pending.forwarded[: len(previous_forwarded)] == previous_forwarded
                    )
                    if not prefix_preserved:
                        idx = first_diff_index(previous_forwarded, pending.forwarded)
                        _, retro = _rewrite_scope(
                            pending.request_messages,
                            pending.forwarded,
                            stable_prefix_message_count=max(len(previous_forwarded) - 1, 0),
                        )
                        events.append({
                            'mode': mode,
                            'session_id': replay.session_id,
                            'project': replay.decoded_project_path,
                            'request_id': pending.turn.request_id,
                            'timestamp': pending.turn.timestamp.isoformat(),
                            'first_diff_index': idx,
                            'prev_len': len(previous_forwarded),
                            'curr_len': len(pending.forwarded),
                            'prev_msg': previous_forwarded[idx] if idx is not None and idx < len(previous_forwarded) else None,
                            'curr_msg': pending.forwarded[idx] if idx is not None and idx < len(pending.forwarded) else None,
                            'prev_tail': previous_forwarded_context[-4:] if previous_forwarded_context else [],
                            'curr_tail': pending.request_messages[-4:],
                            'retroactive_rewrite': retro,
                        })
                        if len(events) >= max_events_per_mode:
                            return events
                previous_forwarded = copy.deepcopy(pending.forwarded)
                previous_timestamp = pending.turn.timestamp
            try:
                prefix_tracker.update_from_response(
                    cache_read_tokens=0,
                    cache_write_tokens=0,
                    messages=forwarded,
                    message_token_counts=[tokenizer.count_message(msg) for msg in forwarded],
                    original_messages=conversation,
                )
            except TypeError:
                prefix_tracker.update_from_response(
                    cache_read_tokens=0,
                    cache_write_tokens=0,
                    messages=forwarded,
                    message_token_counts=[tokenizer.count_message(msg) for msg in forwarded],
                )
            class Pending: pass
            pending = Pending()
            pending.turn = turn
            pending.request_messages = copy.deepcopy(conversation)
            pending.forwarded = forwarded
            conversation.append(turn.assistant_message)
            conversation_token_total = raw_input_tokens + tokenizer.count_message(turn.assistant_message)
            previous_original_context = copy.deepcopy(conversation)
            previous_forwarded_
```

### Core Architecture Module: `benchmarks/cache_validation_bundle.py`
```
#!/usr/bin/env python3
"""Generate a reproducible local cache-validation report bundle."""

from __future__ import annotations

import argparse
import copy
import hashlib
import html
import json
import logging
import platform
import subprocess
import sys
from dataclasses import asdict
from datetime import timedelta
from pathlib import Path
from typing import Any

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import benchmarks.claude_session_mode_benchmark as real_bench
import benchmarks.synthetic_long_cache_suite_report as long_suite
import benchmarks.synthetic_token_cache_bust_report as token_bust
from benchmarks.claude_session_mode_benchmark import (
    PROXY_MODE_CACHE,
    PROXY_MODE_TOKEN,
    _apply_mode_to_messages,
    _cache_gap_within_ttl,
    _rewrite_scope,
    build_dataset_and_observed_from_files,
    determine_winners,
    format_currency,
    get_tokenizer,
    load_session_replay,
    resolve_checkpoint_dir,
    select_session_files,
    simulate_session_files,
    trim_replay_to_recent_turns,
    write_report,
)
from headroom.cache.compression_cache import CompressionCache
from headroom.cache.prefix_tracker import PrefixCacheTracker

DEFAULT_OUTPUT_DIR = Path("benchmark_results") / "cache_validation_bundle"


def _excerpt_content(content: Any, *, max_chars: int) -> str:
    if isinstance(content, str):
        text = content.replace("\n", " ")
        return text[:max_chars] + ("..." if len(text) > max_chars else "")
    if isinstance(content, list):
        parts = []
        for block in content[:4]:
            if isinstance(block, dict):
                btype = str(block.get("type", "unknown"))
                bcontent = block.get("content", "")
                if isinstance(bcontent, str):
                    bcontent = bcontent.replace("\n", " ")
                    bcontent = bcontent[:max_chars] + ("..." if len(bcontent) > max_chars else "")
                parts.append(f"[{btype}] {bcontent}")
            else:
                parts.append(str(block)[:max_chars])
        return " | ".join(parts)
    return str(content)[:max_chars]


def _message_preview(msg: dict[str, Any], *, max_chars: int) -> dict[str, str]:
    return {
        "role": str(msg.get("role")),
        "content_excerpt": _excerpt_content(msg.get("content"), max_chars=max_chars),
    }


def _stable_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:12]


def _redact_text(value: str, *, prefix: str) -> str:
    return f"{prefix}-{_stable_hash(value)}"


def _redact_path(value: str) -> str:
    path = Path(value)
    suffix = path.suffix
    return f"path-{_stable_hash(value)}{suffix}"


def _git_output(args: list[str], cwd: Path) -> str | None:
    try:
        completed = subprocess.run(
            ["git", *args],
            cwd=cwd,
            check=True,
            capture_output=True,
            text=True,
        )
        return completed.stdout.strip()
    except Exception:
        return None


def _runtime_metadata(repo_root: Path) -> dict[str, Any]:
    return {
        "git_sha": _git_output(["rev-parse", "HEAD"], repo_root),
        "git_dirty": bool(_git_output(["status", "--porcelain"], repo_root)),
        "python_version": sys.version,
        "platform": platform.platform(),
        "implementation": platform.python_implementation(),
    }


def _corpus_fingerprint(
    *,
    root: Path,
    session_files: list[Path],
    max_sessions: int | None,
    recent_turns_per_session: int | None,
    cache_ttl_minutes: int,
) -> dict[str, Any]:
    normalized_files = [str(p.resolve()) for p in session_files]
    payload = {
        "root": str(root.resolve()),
        "session_files": normalized_files,
        "max_sessions": max_sessions,
        "recent_turns_per_session": recent_turns_per_session,
        "cache_ttl_minutes": cache_ttl_minutes,
    }
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()
    return {
        "root": str(root.resolve()),
        "session_file_count": len(session_files),
        "session_files_sha256": digest,
        "max_sessions": max_sessions,
        "recent_turns_per_session": recent_turns_per_session,
        "cache_ttl_minutes": cache_ttl_minutes,
    }


def _collect_real_processed_events(
    *,
    root: Path,
    recent_turns_per_session: int | None,
    max_events_per_mode: int,
    ttl_minutes: int,
    max_chars: int,
    include_content: bool,
) -> dict[str, Any]:
    ttl = timedelta(minutes=ttl_minutes)
    events: list[dict[str, Any]] = []
    session_files = select_session_files(root)
    for mode in (PROXY_MODE_TOKEN, PROXY_MODE_CACHE):
        proxy = real_bench._make_proxy(mode)
        collected = 0
        for session_file in session_files:
            replay = load_session_replay(session_file)
            if replay is None:
                continue
            replay = trim_replay_to_recent_turns(replay, recent_turns_per_session)
            prefix_tracker = PrefixCacheTracker("anthropic")
            comp_cache = CompressionCache() if mode == PROXY_MODE_TOKEN else None
            conversation: list[dict[str, Any]] = []
            previous_original_context: list[dict[str, Any]] | None = None
            previous_forwarded_context: list[dict[str, Any]] | None = None
            previous_forwarded: list[dict[str, Any]] = []
            previous_timestamp = None
            pending = None
            for turn in replay.turns:
                tokenizer = get_tokenizer(turn.model)
                prior_context_message_count = len(conversation)
                conversation.extend(turn.input_messages)
                forwarded = _apply_mode_to_messages(
                    proxy,
                    mode,
                    conversation,
                    model=turn.model,
                    prefix_tracker=prefix_tracker,
                    comp_cache=comp_cache,
                    previous_original_messages=previous_original_context,
                    previous_forwarded_messages=previous_forwarded_context,
                )
                rewrite, retro = _rewrite_scope(
                    conversation,
                    forwarded,
                    stable_prefix_message_count=prior_context_message_count,
                )
                if rewrite:
                    prior_forwarded = (
                        pending.forwarded if pending is not None else previous_forwarded
                    )
                    prior_ts = pending.turn.timestamp if pending is not None else previous_timestamp
                    eligible = bool(
                        prior_ts is not None
                        and _cache_gap_within_ttl(turn.timestamp, prior_ts, ttl=ttl)
                        and prior_forwarded
                    )
                    prefix_preserved = None
                    first_diff_index = None
                    if eligible:
                        prefix_preserved = (
                            len(forwarded) >= len(prior_forwarded)
                            and forwarded[: len(prior_forwarded)] == prior_forwarded
                        )
                        if not prefix_preserved:
                            for idx, (a, b) in enumerate(zip(prior_forwarded, forwarded)):
                                if a != b:
                                    first_diff_index = idx
                                    break
                            if first_diff_index is None:
                                first_diff_index = min(len(prior_forwarded), len(forwarded))
                    events.append(
                        {
                            "mode": mode,
                            "session_id": replay.session_id
                            if include_content
                            else _redact_text(replay.session_id, prefix="session"),
                            "project": replay.decoded_project_path
       
```

### Core Architecture Module: `benchmarks/ccr_regression_benchmark.py`
```
#!/usr/bin/env python3
"""
CCR Regression Benchmark - Verify No Information Loss

This benchmark tests that the CCR (Compress-Cache-Retrieve) architecture
does not cause any regression in agent behavior. Specifically:

1. NEEDLE RETENTION: Critical items survive compression
   - Errors, exceptions, failures
   - Specific IDs/UUIDs mentioned in user query
   - Anomalies and outliers

2. RETRIEVAL ACCURACY: When retrieval is needed, correct items are returned
   - Retrieval is by hash and always returns the full original content

3. FEEDBACK LEARNING: System learns from retrieval patterns
   - High retrieval rate triggers less aggressive compression

Usage:
    python benchmarks/ccr_regression_benchmark.py
    python benchmarks/ccr_regression_benchmark.py --verbose
    python benchmarks/ccr_regression_benchmark.py --scenario needle-in-haystack
"""

from __future__ import annotations

import argparse
import json
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from headroom.cache.compression_feedback import (
    get_compression_feedback,
    reset_compression_feedback,
)
from headroom.cache.compression_store import (
    get_compression_store,
    reset_compression_store,
)
from headroom.transforms.smart_crusher import (
    SmartCrusherConfig,
    smart_crush_tool_output,
)


@dataclass
class RegressionResult:
    """Result from a regression test."""

    name: str
    description: str
    passed: bool = False  # Default to False, set to True when test passes

    # Metrics
    total_needles: int = 0
    needles_retained: int = 0
    retention_rate: float = 0.0

    # CCR metrics
    items_compressed: int = 0
    items_retrieved: int = 0
    retrieval_accuracy: float = 0.0

    # Performance
    latency_ms: float = 0.0

    # Details
    details: dict[str, Any] = field(default_factory=dict)
    failures: list[str] = field(default_factory=list)


def _ccr_retrieve_items(store: Any, hash_key: str) -> list[dict[str, Any]]:
    """Full CCR retrieval (hash-only) → parsed original items.

    Retrieval is by hash and always returns the complete original content,
    so any "needle" present at compression time is guaranteed to survive the
    round-trip. Returns the parsed list, or [] on a miss / non-list payload.
    """
    entry = store.retrieve(hash_key)
    if not entry:
        return []
    try:
        data = json.loads(entry.original_content)
    except (json.JSONDecodeError, TypeError):
        return []
    return data if isinstance(data, list) else []


# =============================================================================
# TEST 1: Needle in Haystack - Error Retention
# =============================================================================


def test_error_retention() -> RegressionResult:
    """
    Test that errors are NEVER lost during compression.

    This is critical: if an API returns 1000 results with 3 errors,
    those 3 errors MUST be in the compressed output.
    """
    result = RegressionResult(
        name="Error Retention",
        description="Verify all errors survive compression regardless of position",
    )

    # Generate 1000 items with errors at various positions
    items = []
    error_indices = [5, 47, 123, 456, 789, 999]  # Spread throughout

    for i in range(1000):
        if i in error_indices:
            items.append(
                {
                    "id": i,
                    "status": "error",
                    "message": f"Connection failed: timeout at {i}",
                    "error_code": 500 + (i % 10),
                }
            )
        else:
            items.append(
                {
                    "id": i,
                    "status": "success",
                    "message": "OK",
                    "data": {"value": i * 2},
                }
            )

    result.total_needles = len(error_indices)

    # Compress with SmartCrusher
    config = SmartCrusherConfig(max_items_after_crush=15)
    original_json = json.dumps(items)

    start = time.perf_counter()
    compressed_json, was_modified, _ = smart_crush_tool_output(original_json, config)
    result.latency_ms = (time.perf_counter() - start) * 1000

    # Count errors in compressed output
    compressed = json.loads(compressed_json)
    errors_found = [item for item in compressed if item.get("status") == "error"]

    result.needles_retained = len(errors_found)
    result.retention_rate = result.needles_retained / result.total_needles
    result.items_compressed = len(compressed)

    # Check if ALL errors were retained
    result.passed = result.needles_retained == result.total_needles

    if not result.passed:
        result.failures.append(
            f"Lost {result.total_needles - result.needles_retained} errors during compression"
        )

    result.details = {
        "original_items": 1000,
        "compressed_items": len(compressed),
        "error_positions": error_indices,
        "errors_retained": result.needles_retained,
    }

    return result


# =============================================================================
# TEST 2: Needle in Haystack - UUID Lookup
# =============================================================================


def test_uuid_retrieval() -> RegressionResult:
    """
    Test that specific UUIDs can be found via CCR retrieval.

    Scenario: User asks "find transaction abc123..."
    The system compresses, but user should be able to retrieve the specific item.
    """
    result = RegressionResult(
        name="UUID Retrieval via CCR",
        description="Verify specific UUIDs can be retrieved from compressed cache",
    )

    reset_compression_store()
    store = get_compression_store()

    # Generate 1000 transactions with UUIDs
    target_uuid = str(uuid.uuid4())
    items = []

    for i in range(1000):
        item_uuid = target_uuid if i == 456 else str(uuid.uuid4())
        items.append(
            {
                "transaction_id": item_uuid,
                "amount": 100 + (i % 1000),
                "status": "completed",
                "timestamp": f"2025-01-{(i % 28) + 1:02d}T10:00:00Z",
            }
        )

    result.total_needles = 1

    # Store original and compress
    original_json = json.dumps(items)
    config = SmartCrusherConfig(max_items_after_crush=15)

    start = time.perf_counter()
    compressed_json, was_modified, _ = smart_crush_tool_output(original_json, config)

    # Store in CCR cache
    hash_key = store.store(
        original=original_json,
        compressed=compressed_json,
        original_item_count=1000,
        compressed_item_count=15,
        tool_name="transaction_search",
    )

    # Search for the specific UUID
    search_results = _ccr_retrieve_items(store, hash_key)
    result.latency_ms = (time.perf_counter() - start) * 1000

    # Check if target UUID was found
    found_target = any(item.get("transaction_id") == target_uuid for item in search_results)

    result.needles_retained = 1 if found_target else 0
    result.retention_rate = result.needles_retained / result.total_needles
    result.items_retrieved = len(search_results)
    result.retrieval_accuracy = 1.0 if found_target else 0.0

    result.passed = found_target

    if not result.passed:
        result.failures.append(
            f"Could not retrieve target UUID {target_uuid[:8]}... via CCR search"
        )

    result.details = {
        "target_uuid": target_uuid,
        "search_results_count": len(search_results),
        "found_target": found_target,
        "hash_key": hash_key,
    }

    return result


# =============================================================================
# TEST 3: Anomaly Detection
# =============================================================================


def test_anomaly_retention() -> RegressionResult:
    """
    Test that statistical anomalies are preserved during compression.

    Scenario: 1000 metrics mostly at ~50, but with 5 spikes a
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3780** (2026-09-25): **[BUG] headroom_retrieve output is re-compressed into the same CCR marker when the MCP client names tools <server>_<tool>**
  *Symptoms*: ## Description  `headroom_retrieve` output is compressed again on its way to the model, and comes back as **the very marker the model was trying to resolve** — same hash. CCR retrieval is therefore a no-op for any MCP client that names tools `<server>_<tool>` instead of `mcp__<server>__<tool>`.  `DEFAULT_EXCLUDE_TOOLS` already contains `headroom_retrieve`, and `is_tool_excluded()` resolves the `mcp__server__tool` and `mcp_server_tool` aliases — but not the `server_tool` form. OpenCode registers MCP tools as `<alias>_<tool>`, so the tool arrives as `headroom_headroom_retrieve`, matches no alias, and the guard never fires:  ``` headroom_retrieve                  -> excluded: True mcp__headroom__headroom_retrieve   -> excluded: True mcp_headroom_headroom_retrieve     -> excluded: True headroom_headroom_retrieve         -> excluded: False   # what OpenCode sends ```  It reproduces in both `cache` and `token` mode on default settings, using only headroom's own two MCP tools — no other server, no unusual configuration.  ## To Reproduce  1. Run `headroom proxy` and register headroom's MCP server in a client that names MCP tools `<alias>_<tool>` (OpenCode: `"mcp": {"headroom": {"type":"local","command":["headroom","mcp","serve"]}}`). 2. Ask the model to call `headroom_compress` on a few KB of text containing a distinctive sentence; keep the hash it returns. 3. Ask it to call `headroom_retrieve` with that hash and quote the sentence. 4. The model reports it only sees `<<ccr:HASH,strin

- **Issue #3752** (2026-09-24): **[BUG] LiteLLM backend drops image blocks from /v1/messages, so Bedrock models answer without the image**
  *Symptoms*: ## Description  Thanks for the LiteLLM backend and for the thinking-block work in the same converter (#3586), which made this easy to trace. With `--backend bedrock`, image blocks in `/v1/messages` never reach the model. `LiteLLMBackend._convert_messages_for_litellm` only collects `text`, `tool_use`, `tool_result` and thinking blocks, so a text+image turn is sent as text only, and an image-only turn becomes `""` and is dropped.  Found while testing OpenAI GPT-6 Sol, Luna and Astra on Bedrock. GPT-5.6 and Claude behave the same on this path. `/v1/chat/completions` keeps images.  ## To Reproduce  1. `headroom proxy --backend bedrock --region us-east-1` (main `a6a9cef9`) 2. POST `/v1/messages` with a 64x64 solid red PNG and "What single color is this image? One word." (script below) 3. Compare the answer and the Converse body litellm sends  ## Expected Behavior  The Converse request carries an `image` block and the model answers "Red".  ## Actual Behavior  | Model (live, us-east-1) | text + image: red answers / 3 | image-only user turn: red answers / 3 | |---|---|---| | `us.openai.gpt-6-sol` | ❌ 0/3 (`Unknown`) | ❌ 0/3 (`Please upload the image.`) | | `us.openai.gpt-6-luna` | ❌ 0/3 (`White`) | ❌ 0/3 (`Unclear.`) | | `us.openai.gpt-6-astra` | ❌ 0/3 (`Unknown`) | ❌ 0/3 (`Missing.`) | | `global.openai.gpt-6-astra` | ❌ 0/3 (`Image?`) | ❌ 0/3 (`Please upload the image.`) | | `us.openai.gpt-5.6-sol` | ❌ 0/3 (`Unknown`) | ❌ 0/3 (`Upload`) | | `us.anthropic.claude-haiku-4-5-20251001-v1:

- **Issue #3736** (2026-09-24): **[BUG] 0.38.0: ISO-8601 timestamped logs routed as search results, now folded lossily (5 of 2,000 lines, timestamps rewritten)**
  *Symptoms*: ## Summary  In 0.38.0, `headroom_compress` (MCP, `headroom mcp serve`) turns an ISO-8601 timestamped log into a 5-line sample and changes the timestamps it shows. In 0.37.0 the same input went through the lossless grep fold. The fold kept all rows and rebuilt the input exactly.  This looks like a side effect of #3419. That PR takes timestamp rows out of the lossless fold, which is correct. But the payload is still classified as search results, so it now falls through to the lossy `SearchCompressor`.  ## Reproduction  The script below runs on a clean environment with `headroom-ai` and `mcp<2` installed:  ```python import asyncio, json from mcp import ClientSession, StdioServerParameters from mcp.client.stdio import stdio_client  LOG = "\n".join(     f"2026-09-23T10:{i // 60:02d}:{i % 60:02d}Z INFO worker[{i % 8}] processed batch {i} in {(i * 13) % 900}ms"     for i in range(2000) )  async def main():     params = StdioServerParameters(command="headroom", args=["mcp", "serve"])     async with stdio_client(params) as (r, w):         async with ClientSession(r, w) as s:             await s.initialize()             res = await s.call_tool("headroom_compress", {"content": LOG})             d = json.loads(res.content[0].text)             print(d["transforms"], d["original_tokens"], "->", d["compressed_tokens"])             print(d["compressed"][:600])  asyncio.run(main()) ```  **0.37.0:** `['router:search:0.67'] 55006 -> 37015`. The date and hour are lifted into a heading, and all 2
  **Post-Mortem & Fix Analysis**:
  > Reproduced on main@26a2c493: the payload routes to SEARCH_RESULTS with confidence 1.0 because the colon branch accepts the bare date-hour prefix `2026-09-23T10`. I'll send a PR that rejects timestamp-shaped lines in `_is_search_result_line`, reusing `_TIMESTAMP_ROW_RE` from the lossless fold so the two cannot drift apart again, plus the Rust detector parity and a regression test. 

- **Issue #3725** (2026-09-24): **download_cbm is broken on Windows: installer builds .tar.gz, registry pins .zip**
  *Symptoms*: Found while reviewing #3724 (A-7, binary verification fail-closed). **Pre-existing on `main`, not caused by that PR** — filing so it does not get attributed to it.  `headroom/graph/installer.py:63` builds the asset filename unconditionally as:  ```python filename = f"codebase-memory-mcp-{plat}.tar.gz" ```  and `plat` is `windows-amd64` on Windows (`:35-36`). But `headroom/tools.json` pins the Windows asset as `codebase-memory-mcp-windows-amd64.**zip**` — every other platform is `.tar.gz`, Windows is the odd one out.  Two consequences, both on Windows only:  1. The URL has no pin (the registry has no `.tar.gz` entry for that platform), so integrity verification never had a pin to check against. 2. Even if the download succeeds, extraction calls `tarfile.open(fileobj=..., mode="r:gz")` unconditionally at `:86`, which cannot read a zip.  So the Windows path already fails today. After #3724 it fails one step earlier, with `UnpinnedDownload` naming the cause instead of a confusing `TarError`.  **Fix:** pick the extension from the registry entry rather than hardcoding it, and branch extraction on the archive type (`zipfile` for `.zip`, `tarfile` for `.tar.gz`). A regression test should cover the Windows platform key on both halves.  Low priority — it is a graph/codebase-memory install path, not the proxy hot path — but it is a genuine break and the current failure mode is opaque.

- **Issue #3709** (2026-09-25): **[BUG] OpenCode v2: plugin fails to load — entrypoint exports { id, server }, v2 requires { id, setup | effect }**
  *Symptoms*: ## Summary  On OpenCode v2 (tested 1.18.31, Windows), registering `context-mode` via `opencode.json` fails to load the plugin. The failure is caused by an outdated OpenCode adapter export shape: the entrypoint exports a KiloCode-style `{ id, server }` default (plus a named `ContextModePlugin`), whereas the OpenCode v2 plugin API requires a default definition with `id` + `setup`/`effect`.  ## Environment  - OpenCode: `1.18.31` (v2, installed via npm `opencode-ai`) - context-mode: `1.0.169` (npm latest, 2026-06-29); source `2ea2b2f` (main, 2026-09-21) — same export shape - OS: Windows 11  ## Repro  1. `opencode.json`:    ```jsonc    { "plugin": ["context-mode"] }
  **Post-Mortem & Fix Analysis**:
  > @JerrettDavis duplicate of (result of non-existing) #3669 
  > Closing as a duplicate of #3669.

- **Issue #3708** (2026-09-24): **POST /v1/compress returns 404 despite being declared in the OpenAPI spec (v0.37.0 and v0.38.0)**
  *Symptoms*: ## Summary  `POST /v1/compress` is declared in the proxy's own OpenAPI spec (`operationId: compress_messages_v1_compress_post`) but unconditionally returns `404 {"detail":"Not Found"}` for every request — any method, any payload, empty or well-formed. Confirmed on both `0.37.0` and `0.38.0` (persistent-docker deployment, image `ghcr.io/headroomlabs-ai/headroom:latest`).  This endpoint appears to be registered for OpenAPI/docs generation purposes but never actually mounted as a live route in the running FastAPI app.  ## Environment  - Headroom version: `0.37.0` → reproduced again after upgrading to `0.38.0` - Deployment: `persistent-docker` preset, `headroom install apply` - Image: `ghcr.io/headroomlabs-ai/headroom:latest` - Host: macOS (Darwin 27.0.0, arm64) - Proxy reachable and otherwise healthy: `/readyz`, `/health`, `/stats`, `/v1/models`, `/v1/messages` all respond as expected (`/v1/models` and `/v1/usage` correctly 401 without auth, confirming those routes are live — `/v1/compress` returns plain 404 regardless of auth).  ## Steps to reproduce  ```bash # 1. Confirm proxy is healthy curl -s http://127.0.0.1:8787/readyz # -> {"status":"healthy","ready":true,"version":"0.38.0",...}  # 2. Confirm the route exists in the OpenAPI spec curl -s http://127.0.0.1:8787/openapi.json | python3 -c " import json,sys d = json.load(sys.stdin) print(json.dumps(d['paths']['/v1/compress'], indent=2)) " # -> { #      "post": { #        "summary": "Compress Messages", #        "operationId": 

- **Issue #3698** (2026-09-29): **learn/memory writers: LF pin has no regression guard, and the same bug is live in memory writers**
  *Symptoms*: Follow-up to #3594 (merged in abde3e6e). The fix itself is correct and in `main`: `_read_text_tolerant` normalizes on read (`headroom/learn/writer.py:45`) and all seven learn-writer `write_text` calls now pin `newline="\n"` (`:262, :270, :328, :371, :379, :409, :439`). Three gaps remain around it.  ## 1. The regression test does not fail without the fix  `test_apply_does_not_accumulate_carriage_returns_on_crlf_file` passes on `main` with `writer.py` reverted — verified in a worktree. Its assertion (`raw.count(b"\r") == raw.count(b"\r\n")`) holds for a CRLF-preserving file just as well as for a normalized one. Only `test_read_text_tolerant_normalizes_crlf_and_cr` actually fails without the fix, and that covers the read half only.  So the write half — the `newline="\n"` pins, which are the actual fix — has no guard. Anyone removing them gets a green suite.  This is not fixable by writing a cleverer assertion on POSIX. `Path.write_text(newline=None)` translates via `TextIOWrapper`, and in CPython's C implementation the translation target is chosen at compile time (`#ifdef MS_WINDOWS`), not read from `os.linesep` at runtime — so monkeypatching `os.linesep` does not simulate Windows.  **Proposed fix — two layers:**  **(a) Cheap, immediate: assert the call, not the artifact.** Spy on `Path.write_text` and assert every learn-writer call passes `newline="\n"`:  ```python def test_learn_writers_pin_lf_on_every_write(monkeypatch, tmp_path):     seen = []     orig = Path.write_text     

- **Issue #3695** (2026-09-24): **fix(spreadsheet): .xls integer rendering fabricates digits above 2^53**
  *Symptoms*: Follow-up to #3616 (merged in 261796f9). Not a regression in the classic sense — the PR fixed a real bug — but the `int()` conversion it added introduces a new, narrower one at the top of the numeric range.  ## Problem  `_xls_cell` (`headroom/transforms/spreadsheet_ingest.py:72`) ends with:  ```python if kind == xlrd.XL_CELL_NUMBER and float(value).is_integer():     return int(value) ```  xlrd hands back an IEEE-754 double. Above 2^53 a double can no longer represent consecutive integers, so `int()` renders the double's *exact* value — which is not the number the user typed:  ``` user typed:  123456789012345678 stored as:   1.2345678901234568e+17 int() shows: 123456789012345680   <- last two digits fabricated ```  Measured across the range:  | value | `int(v)` (current) | `repr(v)` (what .xlsx shows) | exact? | |---|---|---|---| | `12.0` | `12` | `12.0` | yes | | `1e15` | `1000000000000000` | `1000000000000000.0` | yes | | `1e16` | `10000000000000000` | `1e+16` | **no** | | `1e20` | `100000000000000000000` | `1e+20` | **no** | | `1.2345678901234568e+17` | `123456789012345680` | `1.2345678901234568e+17` | **no** |  Two consequences:  1. **Fabricated precision presented authoritatively.** This text goes to an agent. An ID column rendered as `123456789012345680` reads as an exact identifier; it isn't. `1.2345678901234568e+17` at least signals "float, approximate". This is the more important of the two. 2. **The PR's stated goal is not met above 2^53.** The title is "render an .x

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

### Incident Patch 1: `fed72811` (2026-09-30)
**Commit Message**: fix(proxy): reset the cc-switch upstream when Claude Official is selected (#3166)

## Description

The cc-switch reconciler (#1030) captures a third-party
`ANTHROPIC_BASE_URL` as the proxy's upstream and points Claude Code back
at Headroom. The "Claude Official" branch (cc-switch writes `{"env":
{}}`) returned early without dropping that captured upstream.

`HeadroomProxy.ANTHROPIC_API_URL` is a **process-wide class attr** read
per request, so switching back to Official left the previous provider
live. Any Anthropic client still routed through that proxy - a second
Claude Code instance, the VS Code connector, a desktop app that
re-asserts `ANTHROPIC_BASE_URL` on launch - kept reaching e.g.
`api.deepseek.com`, now with Anthropic OAuth credentials attached.

Related: #1264 (Anthropic-compatible third-party upstream support).

## Type of Change

- [x] Bug fix (non-breaking change that fixes an issue)

## Changes Made

- `cc_switch_reconciler.tick()`: before leaving Official direct, reset a
captured third-party upstream back to `default_upstream`.
- Guarded on `self.current_upstream not in (None,
self.default_upstream)`, so nothing captured means nothing reset - an
operator-configured 

**File**: `headroom/proxy/cc_switch_reconciler.py` (modified, +14/-1)
```diff
@@ -162,7 +162,20 @@ def tick(self) -> bool:
                 self._atomic_write(data)
                 logger.info("cc-switch reconciler: official -> route via Headroom")
                 return True
-            return False  # leave official direct (default, safe for OAuth)
+            # Leaving official direct (default, safe for OAuth) still has to
+            # drop a previously captured third-party upstream. The upstream is
+            # process-wide (``HeadroomProxy.ANTHROPIC_API_URL`` is a class
+            # attr), so a stale DeepSeek/Kimi endpoint would keep receiving
+            # this proxy's Anthropic traffic from every client still routed
+            # through it -- with Anthropic credentials attached.
+            if self.current_upstream not in (None, self.default_upstream):
+                logger.info(
+                    "cc-switch reconciler: official -> upstream reset to %s",
+                    self.default_upstream,
+                )
+                self.current_upstream = self.default_upstream
+                self._set_upstream(self.default_upstream)
+            return False
 
         # Already pointing at us: nothing to do (loop guard).
         if url.rstrip("/") == self.proxy_url:
```

**File**: `tests/test_proxy/test_cc_switch_reconciler.py` (modified, +27/-0)
```diff
@@ -115,6 +115,33 @@ def test_official_left_direct_by_default(tmp_path, monkeypatch):
     assert json.loads(sf.read_text())["env"] == {}
 
 
+def test_official_resets_a_captured_third_party_upstream(tmp_path, monkeypatch):
+    monkeypatch.delenv("HEADROOM_CC_SWITCH_ROUTE_OFFICIAL", raising=False)
+    r, sf, captured = _make(tmp_path)
+    _write(sf, {"env": {"ANTHROPIC_BASE_URL": "https://api.kimi.com/anthropic"}})
+    assert r.tick() is True
+    assert captured[-1] == "https://api.kimi.com/anthropic"
+
+    # Switching back to Claude Official leaves settings.json direct, but the
+    # process-wide upstream must not stay on Kimi -- otherwise Anthropic OAuth
+    # traffic from any client still routed through this proxy is sent there.
+    _write(sf, {"env": {}})
+    assert r.tick() is False
+    assert json.loads(sf.read_text())["env"] == {}
+    assert captured[-1] == DEFAULT
+    assert r.current_upstream == DEFAULT
+
+
+def test_official_does_not_reset_upstream_when_never_captured(tmp_path, monkeypatch):
+    monkeypatch.delenv("HEADROOM_CC_SWITCH_ROUTE_OFFICIAL", raising=False)
+    r, sf, captured = _make(tmp_path)
+    _write(sf, {"env": {}})
+    assert r.tick() is False
+    # Nothing was captured, so nothing to reset: an operator-configured
+    # upstream must not be clobbered by a passing official tick.
+    assert captured == []
+
+
 def test_official_routed_when_opted_in(tmp_path, monkeypatch):
     monkeypatch.setenv("HEADROOM_CC_SWITCH_ROUTE_OFFICIAL", "1")
     r, sf, captured = _make(tmp_path)
```

---

### Incident Patch 2: `c719d4af` (2026-09-30)
**Commit Message**: fix(savings): record tool-schema dollars disjointly beside the folded headline (#3170)

## Description

Since the attribution unification (#2976, refined by #3123),
`record_request` folds the tool-schema layer's dollars into
`compression_savings_usd` — on the lifetime block, the display session,
and every history checkpoint — while `total_tokens_saved` on those same
checkpoints stays message-only. The two halves of one checkpoint now
disagree about what "saved" means, and any consumer that derives a
$/token rate from a checkpoint reads a figure inflated by `1 +
tool/message`.

That inflation is not hypothetical. On one real install, message
compression was 3,299,618 tokens next to 18,435,490 tokens of
tool-schema deferral (a 5.59x ratio — far from the 0.24x in the sample
#2976 cites, this ratio varies wildly by workload). The blended savings
rate a downstream consumer derived went from $4.99/M to $32.88/M — above
the input list price of every model in the mix, a rate no genuine
input-token saving can reach.

There is also a smaller correctness gap: a request whose only saving is
deferral (`tokens_saved == 0`, common on tool-heavy turns) appended no
checkpoint at all, so its folded 

**File**: `headroom/proxy/savings_tracker.py` (modified, +74/-0)
```diff
@@ -612,6 +612,8 @@ def _normalize_history_entry(entry: Any) -> dict[str, Any] | None:
     total_input_cost_usd = 0.0
     output_tokens_saved = 0
     output_savings_usd = 0.0
+    tool_tokens_saved = 0
+    tool_schema_savings_usd = 0.0
     total_output_cost_usd = 0.0
     provider = PROVIDER_UNKNOWN
     model = MODEL_UNKNOWN
@@ -629,6 +631,8 @@ def _normalize_history_entry(entry: Any) -> dict[str, Any] | None:
         total_input_cost_usd = _coerce_float(entry.get("total_input_cost_usd"))
         output_tokens_saved = _coerce_int(entry.get("output_tokens_saved"))
         output_savings_usd = _coerce_float(entry.get("output_savings_usd"))
+        tool_tokens_saved = _coerce_int(entry.get("tool_tokens_saved"))
+        tool_schema_savings_usd = _coerce_float(entry.get("tool_schema_savings_usd"))
         total_output_cost_usd = _coerce_float(entry.get("total_output_cost_usd"))
         provider = _normalize_provider(entry.get("provider"))
         model = _normalize_model(entry.get("model"))
@@ -659,6 +663,8 @@ def _normalize_history_entry(entry: Any) -> dict[str, Any] | None:
         "total_input_cost_usd": round(total_input_cost_usd, 6),
         "output_tokens_saved": output_tokens_saved,
         "output_savings_usd": round(output_savings_usd, 6),
+        "tool_tokens_saved": tool_tokens_saved,
+        "tool_schema_savings_usd": round(tool_schema_savings_usd, 6),
         "total_output_cost_usd": round(total_output_cost_usd, 6),
     }
 
@@ -670,6 +676,8 @@ def _empty_display_session() -> dict[str, Any]:
         "compression_savings_usd": 0.0,
         "compression_savings_list_usd": 0.0,
         "savings_basis": BASIS_UNKNOWN,
+        "tool_tokens_saved": 0,
+        "tool_schema_savings_usd": 0.0,
         "cache_read_tokens": 0,
         "cache_savings_usd": 0.0,
         "total_input_tokens": 0,
@@ -806,6 +814,11 @@ def _normalize_display_session(entry: Any) -> dict[str, Any]:
         "compression_savings_usd": round(savings_usd, 6),
         "compression_savings_list_usd": round(savings_list_usd, 6),
         "savings_basis": savings_basis,
+        "tool_tokens_saved": _coerce_int(entry.get("tool_tokens_saved")),
+        "tool_schema_savings_usd": round(
+            _coerce_float(entry.get("tool_schema_savings_usd")),
+            6,
+        ),
         "cache_read_tokens": _coerce_int(entry.get("cache_read_tokens")),
         "cache_savings_usd": round(
             _coerce_float(entry.get("cache_savings_usd")),
@@ -1112,6 +1125,17 @@ def record_request(
             if priced is not None
             else _estimate_cache_savings_usd(model, delta_cache_read_tokens)
         )
+        # The same figure that was just folded into ``delta_savings_usd``, kept
+        # as its own delta so the layer is also recorded disjointly below. A
+        # consumer can then recover message-only dollars by subtraction --
+        # without this, checkpoint dollars (folded) over checkpoint tokens
+        # (message-only) imply a $/token inflated by 1 + tool/message, which on
+        # tool-heavy traffic (ratios of 5x+ observed) exceeds the model's own
+        # input price. Without the priced breakdown nothing was folded either,
+        # so 0.0 keeps the disjoint field consistent with the sum.
+        delta_tool_savings_usd = (
+            max(_coerce_float(priced.get("tool_schema")), 0.0) if priced is not None else 0.0
+        )
         delta_input_cost_usd = _estimate_input_cost_usd(
             model,
             delta_input_tokens,
@@ -1177,6 +1201,11 @@ def record_request(
                 lifetime.get("output_savings_usd", 0.0) + delta_output_savings_usd,
                 6,
             )
+            lifetime["tool_tokens_saved"] += delta_tool_tokens_saved
+            lifetime["tool_schema_savings_usd"] = round(
+                lifetime["tool_schema_savings_usd"] + delta_tool_savings_usd,
+                6,
+            )
             lifetime["total_output_cost_usd"] = round(
               
```

**File**: `tests/test_proxy_savings_history.py` (modified, +13/-0)
```diff
@@ -84,6 +84,8 @@ def test_savings_tracker_helpers_normalize_inputs_and_paths(tmp_path, monkeypatc
         "total_input_cost_usd": 0.0,
         "output_tokens_saved": 0,
         "output_savings_usd": 0.0,
+        "tool_tokens_saved": 0,
+        "tool_schema_savings_usd": 0.0,
         "total_output_cost_usd": 0.0,
     }
     assert savings_tracker_module._normalize_history_entry({"timestamp": "bad"}) is None
@@ -139,6 +141,8 @@ def test_savings_tracker_sanitizes_legacy_state_and_applies_retention(tmp_path):
         "compression_savings_usd": pytest.approx(0.03),
         "compression_savings_list_usd": pytest.approx(0.03),
         "savings_basis": "list",
+        "tool_tokens_saved": 0,
+        "tool_schema_savings_usd": 0.0,
         "cache_read_tokens": 0,
         "cache_savings_usd": 0.0,
         "total_input_tokens": 0,
@@ -161,6 +165,8 @@ def test_savings_tracker_sanitizes_legacy_state_and_applies_retention(tmp_path):
             "total_input_cost_usd": 0.0,
             "output_tokens_saved": 0,
             "output_savings_usd": 0.0,
+            "tool_tokens_saved": 0,
+            "tool_schema_savings_usd": 0.0,
             "total_output_cost_usd": 0.0,
         }
     ]
@@ -186,6 +192,8 @@ def test_non_dict_savings_state_resets_to_default(tmp_path):
         # Nothing priced yet, so there is no basis to report and nothing to
         # migrate -- a fresh default, not a migrated pre-v6 state.
         "savings_basis": "unknown",
+        "tool_tokens_saved": 0,
+        "tool_schema_savings_usd": 0.0,
         "cache_read_tokens": 0,
         "cache_savings_usd": 0.0,
         "total_input_tokens": 0,
@@ -659,6 +667,8 @@ def test_display_session_rolls_after_inactivity_and_counts_zero_savings_requests
         "compression_savings_usd": pytest.approx(0.02),
         "compression_savings_list_usd": pytest.approx(0.02),
         "savings_basis": "list",
+        "tool_tokens_saved": 0,
+        "tool_schema_savings_usd": 0.0,
         "cache_read_tokens": 0,
         "cache_savings_usd": 0.0,
         "total_input_tokens": 200,
@@ -695,6 +705,8 @@ def test_display_session_rolls_after_inactivity_and_counts_zero_savings_requests
         "compression_savings_usd": pytest.approx(0.005),
         "compression_savings_list_usd": pytest.approx(0.005),
         "savings_basis": "list",
+        "tool_tokens_saved": 0,
+        "tool_schema_savings_usd": 0.0,
         "cache_read_tokens": 0,
         "cache_savings_usd": 0.0,
         "total_input_tokens": 50,
@@ -1433,6 +1445,7 @@ def test_stats_history_csv_export_is_frontend_friendly(tmp_path, monkeypatch):
             "compression_savings_usd,total_input_tokens_delta,total_input_tokens,"
             "total_input_cost_usd_delta,total_input_cost_usd,"
             "output_tokens_saved_delta,output_savings_usd_delta,"
+            "tool_tokens_saved_delta,tool_schema_savings_usd_delta,"
             "total_output_cost_usd_delta"
         )
         assert len(lines) >= 2
```

**File**: `tests/test_tool_schema_savings_split.py` (added, +238/-0)
```diff
@@ -0,0 +1,238 @@
+"""Tool-schema dollars must be recorded disjointly, not only folded.
+
+Reported by a desktop consumer of the persisted savings state. Since the
+attribution unification, ``record_request`` folds the tool-schema layer's
+dollars into ``compression_savings_usd`` (lifetime, display_session, and every
+history checkpoint) while ``total_tokens_saved`` on the same checkpoint stays
+message-only. Any consumer deriving a $/token rate from a checkpoint therefore
+reads a figure inflated by ``1 + tool/message``:
+
+- Traffic: message compression 3,299,618 tokens next to 18,435,490 tokens of
+  tool-schema deferral (ratio 5.59x) on one real install.
+- Implied rate: a $4.99/M blended savings rate became $32.88/M after the fold,
+  which exceeds the input list price of every model in the mix.
+- Reader impact: consumers that accumulated ``compression_savings_usd`` before
+  the fold shipped had the field's meaning widened underneath them.
+
+Same resolution shape as the per-model token fix: keep the folded headline
+exactly as it is, and record the layer disjointly beside it --
+``tool_tokens_saved`` / ``tool_schema_savings_usd`` on lifetime,
+display_session, and checkpoints, with matching ``_delta`` fields on rollup
+buckets -- so message-only dollars are recoverable by subtraction.
+"""
+
+from __future__ import annotations
+
+import json
+from datetime import datetime, timedelta, timezone
+
+import pytest
+
+from headroom.proxy.savings_tracker import SavingsTracker, _normalize_history_entry
+
+MODEL = "claude-opus-5"
+
+
+def _iso(moment: datetime) -> str:
+    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")
+
+
+def _recent() -> str:
+    """A timestamp inside the display-session window, anchored to wall clock.
+
+    ``_display_session_snapshot_locked`` expires the session against
+    ``_utc_now()``, not against the recorded timestamp, so a frozen literal
+    silently stops populating ``display_session`` once it ages past
+    ``DEFAULT_DISPLAY_SESSION_INACTIVITY_MINUTES``. This suite was written with
+    a hardcoded date and went red three weeks later for exactly that reason.
+    """
+    return _iso(datetime.now(timezone.utc) - timedelta(minutes=1))
+
+
+def _hour_base() -> datetime:
+    """A whole hour safely in the past, so derived buckets are stable and never future-dated."""
+    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
+    return now - timedelta(hours=3)
+
+
+def _tracker(tmp_path) -> SavingsTracker:
+    return SavingsTracker(
+        path=str(tmp_path / "proxy_savings.json"),
+        max_history_points=100,
+        max_history_age_days=30,
+    )
+
+
+def _record(
+    tracker: SavingsTracker,
+    *,
+    tokens_saved: int = 100,
+    tool_search_saved: int = 500,
+    compression_usd: float = 1.0,
+    tool_usd: float = 5.0,
+    timestamp: str | None = None,
+) -> None:
+    tracker.record_request(
+        model=MODEL,
+        input_tokens=1_000,
+        tokens_saved=tokens_saved,
+        tool_search_saved=tool_search_saved,
+        estimated_savings_usd={
+            "compression": compression_usd,
+            "tool_schema": tool_usd,
+            "output_shaping": 0.0,
+            "provider_cache": 0.0,
+        },
+        timestamp=timestamp or _recent(),
+    )
+
+
+def test_lifetime_and_session_record_tool_schema_disjointly(tmp_path):
+    tracker = _tracker(tmp_path)
+    _record(tracker)
+
+    snapshot = tracker.snapshot()
+    for block in (snapshot["lifetime"], snapshot["display_session"]):
+        # The folded headline is unchanged: compression + tool_schema.
+        assert block["compression_savings_usd"] == 6.0
+        # The disjoint record makes message-only dollars recoverable.
+        assert block["tool_schema_savings_usd"] == 5.0
+        assert block["compression_savings_usd"] - block["tool_schema_savings_usd"] == 1.0
+        assert block["tool_tokens_saved"] == 500
+
+
+def test_checkpoints_carry_the_layer_and_survive_reload(tmp
```

---

### Incident Patch 3: `b73adaa0` (2026-09-30)
**Commit Message**: fix(proxy): drop a tool_reference naming the search tool itself (#3172)

## Description

Anthropic can answer a match-all `tool_search_tool_regex` call (empty
`input`) with a hit on **its own server tool**. Claude Code adds every
hit to the session's loaded-tool set and replays it as a
`tool_reference` in the `tools` array, so every later turn 400s with:

```
Tool reference 'tool_search_tool_regex' not found in available tools
```

A typed search tool is the search mechanism, never a reference target.

The history repair from #2805/#2971 cannot reach this: it walks
`messages` only, and the poison is in `tools`. That is why `/compact`
does not clear it — the session is dead from the first poisoned turn
until the transcript is edited by hand.

This is consistent with a principle the codebase already holds.
`strip_unsupported_tool_search_blocks` excludes typed search tools when
building its `available` set, with the comment:

> Typed search tools (type starts with `tool_search_tool_`) are the
search mechanism itself — they are never the target of a tool_reference
lookup.

That reasoning is applied to `messages`. This PR extends the same rule
to the `tools` array, which the existing fu

**File**: `headroom/proxy/handlers/anthropic.py` (modified, +21/-1)
```diff
@@ -3251,7 +3251,27 @@ def _count_tool_tokens(value: object) -> int:
             # and the prefix is untouched) AND the turn hooks (a hook may rewrite the
             # tools array, and repairing before it validated against a stale view).
             # Nothing past this point mutates `body["tools"]` on the outbound path.
-            from headroom.proxy.helpers import strip_unsupported_tool_search_blocks
+            from headroom.proxy.helpers import (
+                strip_unsupported_tool_search_blocks,
+                strip_unsupported_tool_search_references,
+            )
+
+            # The tools array is repaired first: it shrinks what a history
+            # tool_reference can resolve against, so the block repair below has to
+            # validate against the final view (same reason as the ORDERING note).
+            _ts_tools, _ts_refs_dropped = strip_unsupported_tool_search_references(
+                body.get("tools")
+            )
+            if _ts_refs_dropped:
+                body["tools"] = tools = _ts_tools
+                body_mutation_tracker.mark_mutated("tool_search_reference_repair")
+                transforms_applied.append(f"router:tool_search_ref_repair:{_ts_refs_dropped}refs")
+                logger.info(
+                    "[%s] Tool search: dropped %d unresolvable tool_reference "
+                    "entr(y/ies) naming a typed search tool",
+                    request_id,
+                    _ts_refs_dropped,
+                )
 
             _ts_repaired, _ts_stripped = strip_unsupported_tool_search_blocks(
                 body.get("messages"), body.get("tools")
```

**File**: `headroom/proxy/helpers.py` (modified, +65/-3)
```diff
@@ -4016,6 +4016,17 @@ def inject_tool_search_deferral(
 _CLIENT_TOOL_REF_PLACEHOLDER = "[tool reference no longer available]"
 
 
+def _tool_entry_name(entry: dict[str, Any]) -> str | None:
+    """Return the name a tool-search entry carries, or ``None``.
+
+    Server-side blocks use ``tool_name``; be liberal about ``name``. The one
+    precedence rule for this file, so every reader agrees on an entry that
+    carries both keys.
+    """
+    name = entry.get("tool_name") or entry.get("name")
+    return str(name) if name else None
+
+
 def _tool_search_reference_names(content: Any) -> list[str]:
     """Return the ``tool_reference`` names carried by a tool-search result block.
 
@@ -4028,13 +4039,64 @@ def _tool_search_reference_names(content: Any) -> list[str]:
     names = []
     for entry in entries:
         if isinstance(entry, dict) and entry.get("type") == "tool_reference":
-            # Server-side blocks use ``tool_name``; be liberal about ``name``.
-            name = entry.get("tool_name") or entry.get("name")
+            name = _tool_entry_name(entry)
             if name:
-                names.append(str(name))
+                names.append(name)
     return names
 
 
+def strip_unsupported_tool_search_references(tools: Any) -> tuple[Any, int]:
+    """Drop ``tool_reference`` entries in ``tools`` that name a typed search tool.
+
+    Anthropic occasionally returns ``tool_search_tool_regex`` as a hit inside its
+    own match-all result (empty ``input``). Claude Code adds every hit to the
+    session's loaded-tool set and replays it as a ``tool_reference`` in ``tools``
+    on later turns, so upstream then 400s with "Tool reference
+    'tool_search_tool_regex' not found in available tools" — a typed search tool
+    is the search mechanism, never a reference target. The block repair below
+    cannot reach this: the poison is in the tools array, not the history, which
+    is why ``/compact`` does not clear it and the session stays dead.
+
+    Scoped to the search mechanisms this request actually carries: the names are
+    derived from entries whose ``type`` starts with the typed-search prefix (the
+    same signal ``strip_unsupported_tool_search_blocks`` keys on), and a
+    ``tool_reference`` is dropped only when its name matches one of them exactly.
+    Matching on the name prefix alone would also remove a legitimate client tool
+    that merely happens to be called ``tool_search_tool_*`` — a typeless deferred
+    tool with such a name is a normal reference target, not a mechanism.
+
+    Returns ``(tools, entries_removed)``, and the ORIGINAL ``tools`` object when
+    nothing was removed — callers rely on identity to skip the write-back.
+    """
+    if not isinstance(tools, list):
+        return tools, 0
+
+    # The search mechanisms present on THIS request, identified by type. Names
+    # on both sides go through _tool_entry_name, so a mechanism shaped like a
+    # server-side block (``tool_name``) registers too.
+    mechanism_names = {
+        name
+        for t in tools
+        if isinstance(t, dict)
+        and str(t.get("type") or "").startswith(_TOOL_SEARCH_TOOL_TYPE_PREFIX)
+        and (name := _tool_entry_name(t))
+    }
+    if not mechanism_names:
+        return tools, 0
+
+    kept = [
+        t
+        for t in tools
+        if not (
+            isinstance(t, dict)
+            and t.get("type") == "tool_reference"
+            and _tool_entry_name(t) in mechanism_names
+        )
+    ]
+    removed = len(tools) - len(kept)
+    return (kept, removed) if removed else (tools, 0)
+
+
 # Stand-in for a tool-search block the outbound tools array cannot support. Text
 # so it is inert to every validator, short so it costs ~10 tokens, and constant so
 # the repaired prefix stays byte-stable across turns (the provider cache needs the
```

**File**: `tests/test_issue_746_tool_search.py` (modified, +114/-0)
```diff
@@ -398,7 +398,9 @@ def test_core_tools_match_leading_underscore_namespace() -> None:
 
 from headroom.proxy.helpers import (  # noqa: E402
     _CLIENT_TOOL_REF_PLACEHOLDER,
+    _tool_search_reference_names,
     strip_unsupported_tool_search_blocks,
+    strip_unsupported_tool_search_references,
 )
 
 _SEARCH_TOOL = {"type": _TOOL_SEARCH_DEFAULT_TYPE, "name": _TOOL_SEARCH_DEFAULT_NAME}
@@ -811,3 +813,115 @@ def test_repair_does_not_move_signed_thinking_blocks() -> None:
         for block in message["content"]
         if block["type"] in ("tool_search_tool_result", "server_tool_use")
     ]
+
+
+# ---------------------------------------------------------------------------
+# tools-array repair: a tool_reference naming the search tool itself
+# ---------------------------------------------------------------------------
+
+
+def test_reference_repair_drops_typed_search_tool_reference() -> None:
+    # Anthropic answered a match-all search (empty input) with a hit on its own
+    # server tool.  Claude Code stored it in the session's loaded-tool set and
+    # replays it as a tool_reference, so every later turn 400s with "Tool
+    # reference 'tool_search_tool_regex' not found in available tools".  The
+    # block repair cannot see this: the poison is in tools, not the history.
+    tools = [
+        _SEARCH_TOOL,
+        {"type": "tool_reference", "name": _TOOL_SEARCH_DEFAULT_NAME},
+        {"type": "tool_reference", "name": "Bash"},
+        {"name": "Read", "input_schema": {}},
+    ]
+    repaired, removed = strip_unsupported_tool_search_references(tools)
+    assert removed == 1
+    assert {"type": "tool_reference", "name": "Bash"} in repaired
+    assert _SEARCH_TOOL in repaired  # the search mechanism itself must survive
+    assert all(
+        t.get("name") != _TOOL_SEARCH_DEFAULT_NAME
+        for t in repaired
+        if t.get("type") == "tool_reference"
+    )
+
+
+def test_reference_repair_is_a_noop_on_a_clean_tools_array() -> None:
+    # Identity return, so the caller skips the write-back and the prefix cache
+    # is not disturbed on the overwhelming majority of requests.
+    tools = [_SEARCH_TOOL, {"type": "tool_reference", "name": "Bash"}]
+    repaired, removed = strip_unsupported_tool_search_references(tools)
+    assert removed == 0
+    assert repaired is tools
+
+
+def test_reference_repair_keeps_a_deferred_tool_named_like_a_search_tool() -> None:
+    # A typeless client tool may legitimately be called "tool_search_tool_*".
+    # It is a normal reference target, not a search mechanism, so a reference to
+    # it must survive: the request carries no typed mechanism under that name.
+    # Matching on the name prefix alone would wrongly strip it.
+    deferred = {"name": "tool_search_tool_custom", "input_schema": {}}
+    tools = [
+        _SEARCH_TOOL,
+        deferred,
+        {"type": "tool_reference", "name": "tool_search_tool_custom"},
+    ]
+    repaired, removed = strip_unsupported_tool_search_references(tools)
+    assert removed == 0
+    assert repaired is tools
+
+
+def test_reference_repair_keeps_prefixed_reference_with_no_matching_mechanism() -> None:
+    # Prefix-shaped reference, but this request carries no typed search tool at
+    # all — there is nothing for it to be a self-reference to, so it is not ours
+    # to remove.  Dropping it here would delete a reference the request needs.
+    tools = [
+        {"name": "Bash", "input_schema": {}},
+        {"type": "tool_reference", "name": _TOOL_SEARCH_DEFAULT_NAME},
+    ]
+    repaired, removed = strip_unsupported_tool_search_references(tools)
+    assert removed == 0
+    assert repaired is tools
+
+
+def test_reference_repair_matches_mechanism_name_exactly() -> None:
+    # Scoped to the mechanism names actually present: the exact name goes, a
+    # merely prefix-sharing sibling stays.
+    tools = [
+        _SEARCH_TOOL,
+        {"type": "tool_reference", "name": _TOOL_SEARCH_DEFAULT_NAME},
+        {"type": "tool
```

---

### Incident Patch 4: `117ff72e` (2026-09-30)
**Commit Message**: fix(output-savings): seed the holdout key on the whole first user message (#3209)

## Description

`conversation_key_from_body` seeds the output-shaping holdout
assignment. It hashed the first 512 characters of the **first** text
block of the first user message.

Agent clients open every conversation with injected context - project
instructions, IDE state, memory digests - that is byte-identical across
conversations in a project and routinely kilobytes long. The user's own
words, the only part that distinguishes one conversation from the next,
sat past the 512-character cut, so whole populations of conversations
shared a single key.

Assignment is deterministic, so one key means one arm permanently. On a
real 78k-request ledger, a holdout nominally set to 3% had produced:

| family | treatment | control |
|---|---|---|
| fable | 22,222 | 1 |
| sonnet | 15,401 | 0 |
| haiku | 523 | 0 |
| opus | 38,891 | 3,532 |

Those clients were not being sampled at 3%. They were frozen into one
arm, so their output-shaping savings could never be measured against a
control no matter how long the holdout ran - and the aggregate measured
estimate, had it ever passed its coverage gate, would have com

**File**: `headroom/proxy/output_savings_policy.py` (modified, +84/-21)
```diff
@@ -3,6 +3,7 @@
 from __future__ import annotations
 
 import hashlib
+from collections.abc import Iterable
 from typing import Any, cast
 
 # Coarse input-token buckets. Coarse on purpose: too many strata make
@@ -68,6 +69,33 @@ def stratum_key(
     )
 
 
+def _absorb(digest: Any, text: str) -> None:
+    """Fold one seed field into ``digest``.
+
+    Incremental so no length cap is needed: the seed is consumed a field at a
+    time instead of being concatenated into one string first. The NUL is the
+    field separator, and feeding it separately is byte-identical to hashing
+    ``"\x00" + text``.
+    """
+    digest.update(b"\x00")
+    digest.update(text.encode("utf-8", "ignore"))
+
+
+def _absorb_text_blocks(digest: Any, blocks: Iterable[str]) -> None:
+    """Fold every text block of one message into ``digest`` as one field.
+
+    Byte-identical to absorbing ``"\x00".join(blocks)``, including the empty
+    case: a message with no text blocks still contributes its separator.
+    """
+    absorbed = False
+    for text in blocks:
+        digest.update(b"\x00")
+        digest.update(text.encode("utf-8", "ignore"))
+        absorbed = True
+    if not absorbed:
+        digest.update(b"\x00")
+
+
 def _unwrap_response_create_body(body: dict[str, Any]) -> dict[str, Any]:
     response = body.get("response")
     if body.get("type") == "response.create" and isinstance(response, dict):
@@ -113,52 +141,87 @@ def _string_value(value: Any) -> str:
 
 
 def conversation_key_from_body(body: dict[str, Any]) -> str:
-    """Derive a conversation-stable key for holdout assignment."""
+    """Derive a conversation-stable key for holdout assignment.
+
+    Every text block of the first user message feeds the seed, in full: the
+    digest is built incrementally, field by field, so there is no length cap to
+    collapse behind.
+
+    Seeding on the first 512 characters of the *first* block collapsed whole
+    populations of conversations onto one key, because agent clients open a
+    conversation with injected context -- CLAUDE.md, IDE selection, memory
+    digests -- that is byte-identical for every conversation in a project and
+    far longer than 512 characters. The user's own words, the part that makes
+    one conversation different from the next, sat past the cut.
+
+    One key means one arm, permanently, since the assignment is deterministic:
+    on a real 78k-request ledger that left fable at 22,222 treatment requests
+    against 1 control and sonnet at 15,401 against 0, while opus accumulated
+    3,532 control samples -- a holdout nominally set to 3% that had in fact
+    frozen each client into a single arm. Reading the whole message restores
+    the intended unit of randomization without weakening stability: user turns
+    are never compressed, so the first message is immutable for the life of
+    the conversation.
+    """
     body = _unwrap_response_create_body(body)
-    model = str(body.get("model", ""))
-    seed = model
+    digest = hashlib.sha256()
+    digest.update(str(body.get("model", "")).encode("utf-8", "ignore"))
     for msg in body.get("messages", []):
         if isinstance(msg, dict) and msg.get("role") == "user":
             content = msg.get("content")
             if isinstance(content, str):
-                seed += "\x00" + content[:512]
+                _absorb(digest, content)
             elif isinstance(content, list):
-                for block in content:
-                    if isinstance(block, dict) and block.get("type") == "text":
-                        seed += "\x00" + str(block.get("text", ""))[:512]
-                        break
+                _absorb_text_blocks(
+                    digest,
+                    (
+                        str(block.get("text", ""))
+                        for block in content
+                        if isinstance(block, dict) and block.get("type") == "text"
+                    ),
+                )
             break
     if "
```

**File**: `tests/test_output_savings_policy.py` (modified, +175/-0)
```diff
@@ -5,6 +5,7 @@
 from headroom.proxy.output_savings_policy import (
     assign_arm,
     conversation_key_from_body,
+    conversation_key_from_responses_body,
     input_bucket,
     model_family,
     parse_stratum_label,
@@ -52,9 +53,183 @@ def test_conversation_key_uses_response_create_payload() -> None:
     assert conversation_key_from_body(http_body) == conversation_key_from_body(ws_body)
 
 
+def test_conversation_key_survives_a_long_identical_client_prologue() -> None:
+    """Two conversations differing only past a long injected prologue.
+
+    Agent clients open every conversation with the same context blocks
+    (project instructions, IDE state, memory), commonly kilobytes long. Keying
+    on a 512-character prefix gave all of them one key, so a whole client sat
+    in one arm permanently and never produced holdout data.
+    """
+    prologue = "<system-reminder>project instructions. </system-reminder>" * 40
+    assert len(prologue) > 512
+
+    def body(question: str) -> dict[str, object]:
+        return {
+            "model": "claude-opus-4-5",
+            "messages": [
+                {
+                    "role": "user",
+                    "content": [
+                        {"type": "text", "text": prologue},
+                        {"type": "text", "text": question},
+                    ],
+                }
+            ],
+        }
+
+    assert conversation_key_from_body(body("add a cache")) != conversation_key_from_body(
+        body("delete the cache")
+    )
+    # Same words, same conversation: still one key, so the arm stays stable.
+    assert conversation_key_from_body(body("add a cache")) == conversation_key_from_body(
+        body("add a cache")
+    )
+
+
+def test_conversation_key_separates_conversations_behind_a_64kb_prologue() -> None:
+    """No cutoff can hide the user's words, however long the prologue.
+
+    A character cap is a cutoff wherever it sits: put a prologue past it and
+    every conversation behind that prologue keys the same way again, which is
+    the collapse this key exists to avoid. The seed is hashed incrementally, so
+    there is no cap -- this prologue is deliberately larger than the 64KB guard
+    an earlier revision of this fix used.
+    """
+    prologue = "x" * 96_000
+
+    def body(question: str) -> dict[str, object]:
+        return {
+            "model": "claude-opus-4-5",
+            "messages": [
+                {
+                    "role": "user",
+                    "content": [
+                        {"type": "text", "text": prologue},
+                        {"type": "text", "text": question},
+                    ],
+                }
+            ],
+        }
+
+    assert conversation_key_from_body(body("add a cache")) != conversation_key_from_body(
+        body("delete the cache")
+    )
+    # And the same opener is still one key, so the arm holds for the conversation.
+    assert conversation_key_from_body(body("add a cache")) == conversation_key_from_body(
+        body("add a cache")
+    )
+
+
+def test_responses_conversation_key_separates_past_a_long_prologue() -> None:
+    """The Responses path carried the same cut and needs the same seeding."""
+    prologue = "x" * 96_000
+
+    def body(question: str) -> dict[str, object]:
+        return {
+            "model": "gpt-5",
+            "input": [
+                {
+                    "role": "user",
+                    "content": [
+                        {"type": "input_text", "text": prologue},
+                        {"type": "input_text", "text": question},
+                    ],
+                }
+            ],
+        }
+
+    assert conversation_key_from_responses_body(
+        body("add a cache")
+    ) != conversation_key_from_responses_body(body("delete the cache"))
+    assert conversation_key_from_responses_body(
+        body("add a cache")
+    ) == conversation_key_from_responses_body(body("add a cache"))
+
+
+def test_conversation_
```

---

### Incident Patch 5: `bd0296b5` (2026-09-30)
**Commit Message**: fix(wrap): strip -dev from running proxy version in restart check (#3200)

## Description

`headroom wrap` is supposed to restart an already-running proxy whose
Headroom version differs from the CLI's. The check,
`_proxy_needs_version_restart`, strips the `-dev` suffix only from the
CLI's own version. A source-built proxy reporting e.g. `0.34.0-dev`
fails the `^v?\d+\.\d+\.\d+$` release regex, normalizes to `None`, and
the check silently never fires — so any stale dev-built proxy is reused
forever. The docstring already claims the opposite behavior ("a dev CLI
still restarts a stale proxy on a real version difference"); this PR
makes the code match it.

Observed in production on a maintainer machine: a 21-day-old
`0.34.0-dev` proxy (zero attached clients) was silently reused by a
`0.37.0-dev` wrap, which then also inherited its incompatible routing
config (see linked companion PR for the routing half).

Closes #3197

## Type of Change

- [x] Bug fix (non-breaking change that fixes an issue)

## Changes Made

- `headroom/cli/wrap.py`: `_proxy_needs_version_restart` now strips
`-dev` from the *running* proxy version before normalization (mirroring
the CLI side), with a comment pinnin

**File**: `headroom/cli/wrap.py` (modified, +9/-2)
```diff
@@ -3835,9 +3835,16 @@ def _proxy_version(payload: dict[str, Any] | None) -> str | None:
 def _proxy_needs_version_restart(payload: dict[str, Any] | None) -> bool:
     """Return True when a running Headroom proxy uses a different package version."""
     running_version = _proxy_version(payload)
-    running_release = _normalize_release_version(running_version)
     # -dev is a display marker for source builds; compare the base release so a
-    # dev CLI still restarts a stale proxy on a real version difference.
+    # dev CLI still restarts a stale proxy on a real version difference. The
+    # suffix must be stripped from the running version too: with it intact,
+    # "0.34.0-dev" fails the release regex, normalizes to None, and the check
+    # below silently never fires for source-built proxies. The scheme is always
+    # "<base>-dev" (get_version in headroom/_version.py); any future "-rcN" or
+    # "-dev.N" style would need stripping here as well.
+    running_release = _normalize_release_version(
+        running_version.removesuffix("-dev") if running_version is not None else None
+    )
     current_release = _normalize_release_version(_HEADROOM_VERSION.removesuffix("-dev"))
     return (
         running_release is not None
```

**File**: `tests/test_cli/test_wrap_persistent.py` (modified, +22/-0)
```diff
@@ -365,6 +365,28 @@ def test_proxy_version_restart_ignores_non_release_source_labels(monkeypatch) ->
     assert wrap_cli._proxy_needs_version_restart({"version": "0.29.0"}) is True
 
 
+def test_proxy_version_restart_strips_dev_suffix_on_both_sides(monkeypatch) -> None:
+    """A dev-built proxy must be compared by its base release, like the CLI is.
+
+    Regression: "0.34.0-dev" failed the release regex, normalized to None, and
+    the check never fired, so a stale source-built proxy was silently reused
+    forever (observed: a 21-day-old 0.34.0-dev proxy reused by a 0.37.0-dev
+    wrap).
+    """
+    monkeypatch.setattr(wrap_cli, "_HEADROOM_VERSION", "0.37.0-dev")
+    assert wrap_cli._proxy_needs_version_restart({"version": "0.34.0-dev"}) is True
+    assert wrap_cli._proxy_needs_version_restart({"version": "0.37.0-dev"}) is False
+    assert wrap_cli._proxy_needs_version_restart({"version": "0.36.4"}) is True
+
+    monkeypatch.setattr(wrap_cli, "_HEADROOM_VERSION", "0.37.0")
+    assert wrap_cli._proxy_needs_version_restart({"version": "0.36.4-dev"}) is True
+
+    # Unparseable running versions still never trigger a restart.
+    assert wrap_cli._proxy_needs_version_restart({"version": "unknown"}) is False
+    assert wrap_cli._proxy_needs_version_restart(None) is False
+    assert wrap_cli._proxy_needs_version_restart({}) is False
+
+
 def test_ensure_proxy_restarts_ephemeral_proxy_for_openai_api_url_mismatch(monkeypatch) -> None:
     calls: list[object] = []
     health = {
```

---

### Incident Patch 6: `7e73438d` (2026-09-30)
**Commit Message**: perf(memory): bound traffic-learner _persisted_ids with the dedup window (#3341)

## Description

`HeadroomTrafficLearner._persisted_ids` (a `dict[content_hash,
memory_id]`) grew **one entry per distinct persisted pattern for the
whole process lifetime** and was never trimmed, while its sibling dedup
set `_saved_hashes` **is** trimmed to `dedup_window`:

```python
self._saved_hashes.add(h)
if len(self._saved_hashes) > self._dedup_window:
    self._saved_hashes.pop()          # trimmed
# ...
self._persisted_ids[pattern.content_hash] = memory_id   # never trimmed
```

`_persisted_ids` is only ever *read* behind an `if h in
self._saved_hashes:` guard (the dedup shortcut at the top of
`_accumulate`). So once a hash leaves the dedup window, its
`_persisted_ids` entry can never be read again — it's pure dead weight
on the long-lived learner (which owns background save/flush tasks). The
asymmetry is the tell: `_saved_hashes` is trimmed and `_pattern_counts`
is LRU-capped right next to this, but `_persisted_ids` was missed.

The fix keeps the two in lockstep:
- When `_saved_hashes` evicts a hash, drop its `_persisted_ids` entry in
the same step.
- The async save worker records an id only w

**File**: `headroom/memory/traffic_learner.py` (modified, +24/-5)
```diff
@@ -1275,10 +1275,16 @@ async def _accumulate(self, pattern: ExtractedPattern) -> None:
             # Ready to save
             del self._pattern_counts[h]
             self._saved_hashes.add(h)
-            # Trim saved hashes to prevent unbounded growth
+            # Trim saved hashes to prevent unbounded growth, and drop the evicted
+            # hash's persisted-id entry in lockstep. ``_persisted_ids`` is only
+            # ever read behind an ``h in _saved_hashes`` guard (the dedup check
+            # above), so an id for a hash no longer tracked is dead weight;
+            # without this it grew one entry per distinct persisted pattern for
+            # the whole process lifetime while ``_saved_hashes`` stayed bounded.
             if len(self._saved_hashes) > self._dedup_window:
                 # Remove oldest (arbitrary, set is unordered, but prevents growth)
-                self._saved_hashes.pop()
+                evicted = self._saved_hashes.pop()
+                self._persisted_ids.pop(evicted, None)
 
             # Persist the real accumulated count, not the dataclass default.
             pattern.evidence_count = count
@@ -1310,9 +1316,13 @@ async def _save_worker(self) -> None:
                     },
                 )
                 self._patterns_saved += 1
-                # Track id so future re-sightings bump this row.
+                # Track id so future re-sightings bump this row — but only while
+                # the hash is still within the dedup window. If it was evicted
+                # from ``_saved_hashes`` between enqueue and now, recording its id
+                # would re-leak an entry that can never be read again (the dedup
+                # read at the top of ``_accumulate`` is gated on ``_saved_hashes``).
                 memory_id = getattr(memory, "id", None)
-                if memory_id is not None:
+                if memory_id is not None and pattern.content_hash in self._saved_hashes:
                     self._persisted_ids[pattern.content_hash] = memory_id
                 logger.debug(f"Traffic learner saved pattern: {pattern.content[:80]}")
 
@@ -1341,7 +1351,16 @@ def _read() -> list[tuple[str, str, str]]:
             try:
                 rows = conn.execute(
                     "SELECT id, content, metadata FROM memories "
-                    "WHERE json_extract(metadata, '$.source') = 'traffic_learner'"
+                    "WHERE json_extract(metadata, '$.source') = 'traffic_learner' "
+                    # Hydrate at most dedup_window rows so a large persisted
+                    # history does not start the in-memory dedup maps oversized
+                    # (they are trimmed to dedup_window in steady state). Keep the
+                    # most-recently-seen patterns; rows without last_seen_at
+                    # (legacy) sort last under DESC and are dropped first, with id
+                    # as a deterministic tie-break.
+                    "ORDER BY json_extract(metadata, '$.last_seen_at') DESC, id DESC "
+                    "LIMIT ?",
+                    (self._dedup_window,),
                 ).fetchall()
             except sqlite3.DatabaseError:
                 return []
```

**File**: `tests/test_memory/test_traffic_learner.py` (modified, +88/-0)
```diff
@@ -412,6 +412,41 @@ async def corroborate() -> None:
         assert pattern.content_hash not in learner._pattern_counts  # removed on promotion
         assert pattern.content_hash in learner._saved_hashes
 
+    def test_persisted_ids_bounded_in_lockstep_with_saved_hashes(self):
+        """``_persisted_ids`` (content_hash -> memory row id) must not outgrow
+        ``_saved_hashes``. The dedup read only consults ``_persisted_ids`` behind
+        an ``h in _saved_hashes`` guard, so an id whose hash has been evicted from
+        the dedup window is dead weight; previously it accumulated one entry per
+        distinct persisted pattern for the whole process lifetime while
+        ``_saved_hashes`` stayed trimmed to ``dedup_window``.
+        """
+        import asyncio
+
+        learner = TrafficLearner(backend=None, min_evidence=1, dedup_window=4)
+
+        async def feed() -> None:
+            for i in range(200):
+                pattern = ExtractedPattern(
+                    category=PatternCategory.PREFERENCE,
+                    content=f"distinct preference number {i}",
+                    importance=0.5,
+                )
+                await learner._accumulate(pattern)  # first sight -> pending
+                await learner._accumulate(pattern)  # second -> promote to saved
+                # Emulate the async save worker recording the row id, using the
+                # same "still tracked" guard the worker now applies.
+                if pattern.content_hash in learner._saved_hashes:
+                    learner._persisted_ids[pattern.content_hash] = f"mem-{i}"
+
+        asyncio.run(feed())
+
+        # _saved_hashes stays bounded (existing behavior).
+        assert len(learner._saved_hashes) <= 4
+        # _persisted_ids no longer leaks: it never holds an id for a hash that is
+        # no longer in the dedup window, so it stays bounded too.
+        assert set(learner._persisted_ids).issubset(learner._saved_hashes)
+        assert len(learner._persisted_ids) <= 4  # not 200
+
     @pytest.mark.asyncio
     async def test_dedup(self, learner: TrafficLearner):
         """Test that identical patterns are deduplicated."""
@@ -1446,6 +1481,59 @@ async def test_missing_db_file(self, tmp_path):
         assert learner._saved_hashes == set()
         assert learner._persisted_ids == {}
 
+    @pytest.mark.asyncio
+    async def test_hydration_is_bounded_to_dedup_window(self, tmp_path):
+        """A persisted history larger than dedup_window must not start the
+        in-memory dedup maps oversized. Hydration keeps at most dedup_window
+        rows (the most-recently-seen), and both maps stay bounded with matching
+        keys — otherwise a long-lived install boots with an unbounded leak that
+        only trims one entry at a time."""
+        import json as _json
+        import sqlite3 as _sql
+
+        db = tmp_path / "memory.db"
+        _init_db(db)
+
+        window = 5
+        total = 20
+        conn = _sql.connect(db)
+        try:
+            for i in range(total):
+                conn.execute(
+                    "INSERT INTO memories (id, content, metadata, entity_refs, importance) "
+                    "VALUES (?,?,?,?,?)",
+                    (
+                        f"id-{i:02d}",
+                        f"Command `cmd{i}` fails; use `alt{i}` instead.",
+                        _json.dumps(
+                            {
+                                "source": "traffic_learner",
+                                "category": "error_recovery",
+                                "evidence_count": 2,
+                                # Higher i == more recently seen; hydration keeps
+                                # the newest `window` of these.
+                                "last_seen_at": f"2026-01-01T00:{i:02d}:00+00:00",
+                            }
+                        ),
+                        "[]",
+                        0.7,
+                    ),
+   
```

---

### Incident Patch 7: `0eba65ca` (2026-09-30)
**Commit Message**: fix(codex): strip stale compression framing on the Responses subpath passthrough (#3792)

## Description

`handle_chatgpt_codex_responses_subpath` (the ChatGPT-auth passthrough
for `/v1/responses/{id}` subpaths — retrieve, cancel, etc.) forwarded
the upstream response verbatim:

```python
return Response(content=resp.content, status_code=resp.status_code, headers=dict(resp.headers))
```

`resp.content` (httpx) is the **already-decoded** plaintext body, but
`dict(resp.headers)` still carries the upstream's `content-encoding:
gzip` and its (compressed) `content-length`. And
`normalize_codex_responses_headers` dropped only `host`, leaving the
client's `accept-encoding` intact so the upstream was free to gzip.

So a Codex client sending `Accept-Encoding: gzip` that hits a responses
subpath under a ChatGPT-auth account gets a **decoded** body labelled
`content-encoding: gzip` with a **compressed** `content-length` — the
client's gunzip fails, or the shorter length truncates the body. This is
the exact framing-corruption class the codebase already documents (#3019
/ `helpers.FRAMING_RESPONSE_HEADERS`).

The sibling **image** passthrough (`providers/codex/images.py`) already
handles this:

**File**: `headroom/providers/codex/responses.py` (modified, +28/-2)
```diff
@@ -8,6 +8,7 @@
 
 from fastapi import Request
 from fastapi.responses import Response
+from starlette.requests import ClientDisconnect
 
 from .endpoints import codex_backend_url, codex_backend_ws_url
 from .headers import drop_header, header_name
@@ -41,10 +42,31 @@ def normalize_codex_responses_headers(headers: Mapping[str, str]) -> tuple[dict[
     """Prepare inbound headers for ChatGPT Codex Responses passthrough."""
     upstream_headers = dict(headers)
     drop_header(upstream_headers, "host")
+    # Drop the client's Accept-Encoding so the upstream returns plaintext. httpx
+    # decodes the body before we read ``resp.content``, so if we let the upstream
+    # gzip we would forward a decoded body under a ``content-encoding: gzip`` /
+    # compressed ``content-length`` (see sanitize below) -- the #3019 framing
+    # corruption. Mirrors the image passthrough.
+    drop_header(upstream_headers, "accept-encoding")
     decision = resolve_codex_routing(upstream_headers)
     return decision.headers, decision.is_chatgpt_auth
 
 
+def sanitize_codex_responses_response_headers(headers: Mapping[str, str]) -> dict[str, str]:
+    """Drop stale compression/framing headers after materializing response bytes.
+
+    ``resp.content`` is already-decoded plaintext, so the upstream's
+    ``content-encoding`` and ``content-length`` (measured on the compressed
+    bytes) no longer describe what we forward; replaying them makes the client
+    fail to gunzip or truncate the body. Starlette recomputes ``content-length``.
+    """
+    response_headers = dict(headers)
+    drop_header(response_headers, "content-encoding")
+    drop_header(response_headers, "content-length")
+    drop_header(response_headers, "server")
+    return response_headers
+
+
 def codex_responses_subpath_url(sub_path: str, query: str = "") -> str:
     """Return the ChatGPT Codex Responses upstream URL for a route subpath."""
     return codex_backend_url(f"/responses/{sub_path}", query)
@@ -75,7 +97,11 @@ async def handle_chatgpt_codex_responses_subpath(
     if not is_chatgpt_auth:
         return None
 
-    body = await request.body()
+    try:
+        body = await request.body()
+    except ClientDisconnect:
+        logger.debug("Client disconnected during body read for /v1/responses passthrough")
+        return Response(status_code=204)
     try:
         resp = await http_client.request(
             request.method,
@@ -87,7 +113,7 @@ async def handle_chatgpt_codex_responses_subpath(
         return Response(
             content=resp.content,
             status_code=resp.status_code,
-            headers=dict(resp.headers),
+            headers=sanitize_codex_responses_response_headers(resp.headers),
         )
     except Exception:
         logger.exception("Passthrough /v1/responses/%s failed", sub_path)
```

**File**: `tests/test_provider_codex_responses.py` (modified, +113/-0)
```diff
@@ -1,9 +1,13 @@
+import pytest
+
 from headroom.providers.codex.responses import (
     codex_responses_http_url,
     codex_responses_subpath_url,
     codex_responses_websocket_url,
+    handle_chatgpt_codex_responses_subpath,
     has_chatgpt_account_header,
     normalize_codex_responses_headers,
+    sanitize_codex_responses_response_headers,
 )
 
 
@@ -57,3 +61,112 @@ def test_codex_responses_headers_return_false_for_regular_openai_auth() -> None:
     assert is_chatgpt_auth is False
     assert headers == {"authorization": "Bearer sk-proj-test"}
     assert has_chatgpt_account_header(headers) is False
+
+
+def test_codex_responses_headers_drop_accept_encoding() -> None:
+    """accept-encoding must be dropped so the upstream returns plaintext; httpx
+    decodes the body before we read it, so a gzip upstream would corrupt framing."""
+    headers, _ = normalize_codex_responses_headers(
+        {
+            "Host": "localhost:8787",
+            "authorization": "Bearer token",
+            "chatgpt-account-id": "acct",
+            "Accept-Encoding": "gzip, deflate, br",
+        }
+    )
+    assert "accept-encoding" not in {k.lower() for k in headers}
+
+
+def test_codex_responses_response_headers_drop_stale_framing_case_insensitive() -> None:
+    assert sanitize_codex_responses_response_headers(
+        {
+            "Content-Encoding": "gzip",
+            "Content-Length": "9999",
+            "Server": "cloudflare",
+            "Content-Type": "application/json",
+            "x-request-id": "kept",
+        }
+    ) == {
+        "Content-Type": "application/json",
+        "x-request-id": "kept",
+    }
+
+
+class _FakeResp:
+    def __init__(self, content: bytes, status_code: int, headers: dict[str, str]):
+        self.content = content
+        self.status_code = status_code
+        self.headers = headers
+
+
+class _FakeClient:
+    def __init__(self, resp: _FakeResp):
+        self._resp = resp
+        self.last_headers: dict[str, str] | None = None
+
+    async def request(self, method, url, *, headers, content, timeout):
+        self.last_headers = headers
+        return self._resp
+
+
+def _request(method: str, path: str, headers: dict[str, str], body: bytes):
+    from starlette.requests import Request
+
+    raw = [(k.lower().encode(), v.encode()) for k, v in headers.items()]
+    scope = {
+        "type": "http",
+        "method": method,
+        "path": path,
+        "query_string": b"",
+        "headers": raw,
+    }
+    sent = False
+
+    async def receive():
+        nonlocal sent
+        if sent:
+            return {"type": "http.request", "body": b"", "more_body": False}
+        sent = True
+        return {"type": "http.request", "body": body, "more_body": False}
+
+    return Request(scope, receive)
+
+
+@pytest.mark.asyncio
+async def test_subpath_passthrough_strips_upstream_compression_framing() -> None:
+    """The upstream body is already-decoded plaintext, so the forwarded response
+    must not replay content-encoding / a compressed content-length (#3019)."""
+    plaintext = b'{"id":"resp_1","status":"completed"}'
+    upstream = _FakeResp(
+        content=plaintext,
+        status_code=200,
+        headers={
+            "content-encoding": "gzip",  # stale: content is already decoded
+            "content-length": "17",  # stale: compressed length
+            "content-type": "application/json",
+            "x-request-id": "req-123",
+        },
+    )
+    client = _FakeClient(upstream)
+    request = _request(
+        "GET",
+        "/v1/responses/resp_1",
+        {
+            "host": "localhost:8787",
+            "authorization": "Bearer token",
+            "chatgpt-account-id": "acct",
+            "accept-encoding": "gzip",
+        },
+        body=b"",
+    )
+
+    response = await handle_chatgpt_codex_responses_subpath(client, request, "resp_1")
+
+    assert response is not None
+    assert response.status_code == 200
+    assert response.bod
```

---

### Incident Patch 8: `08dda4cb` (2026-09-30)
**Commit Message**: fix(cli): strip unmarked headroom_memory TOML table before injecting (#3490)

## Description

`_inject_memory_mcp_config` (used by `headroom wrap codex`) only guards
against a duplicate `[mcp_servers.headroom_memory]` table via the
`_MEMORY_MCP_MARKER`/`_MEMORY_MCP_END` comment pair it writes. If that
table already exists in a user's `~/.codex/config.toml` **without**
those markers — e.g. hand-copied from the usage example in
`headroom/memory/mcp_server.py`, or left over from before this table
was marker-guarded — the injector appends a second
`[mcp_servers.headroom_memory]` table instead of replacing the
existing one. Two tables sharing the same key is invalid TOML, and
silently breaks Codex's MCP config parsing on startup.

This PR adds a helper that strips any unmarked
`[mcp_servers.headroom_memory]` table before the marker-wrapped
section is appended, mirroring the pattern already used for
`[model_providers.headroom]`.

No issue number to close (found while reviewing the Codex wrap flow).

## Type of Change

- [x] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cau

**File**: `headroom/cli/wrap.py` (modified, +77/-18)
```diff
@@ -39,6 +39,11 @@
 from pathlib import Path
 from typing import Any, NamedTuple, cast
 
+try:
+    import tomllib
+except ModuleNotFoundError:  # pragma: no cover - Python < 3.11
+    import tomli as tomllib
+
 from headroom._subprocess import identity_mismatch as _shared_identity_mismatch
 from headroom._subprocess import pid_alive, proc_identity, run
 
@@ -2892,16 +2897,23 @@ def _remove_marker_span(text: str, start_marker: str, end_marker: str) -> str:
         content,
     )
 
-    # Strip any orphaned `[model_providers.headroom]` table with the fields we
-    # write.  We only remove it if the table is recognisably ours (base_url
-    # mentions localhost and a Headroom proxy port).  This protects users who
-    # happen to have a differently configured `headroom` provider.
-    orphan_headroom_table = re.compile(
-        r"(?ms)^\[model_providers\.headroom\][^\[]*?"
-        r'base_url[ \t]*=[ \t]*"http://127\.0\.0\.1:\d+/v1"[^\[]*?'
-        r"(?=^\[|\Z)"
-    )
-    content = orphan_headroom_table.sub("", content)
+    # Remove an orphaned local-proxy provider structurally. Text-level table
+    # matching cannot safely distinguish comments, multiline strings, and
+    # arrays of tables from a provider's body.
+    import tomlkit
+
+    try:
+        document = tomlkit.parse(content)
+    except tomlkit.exceptions.ParseError:
+        pass
+    else:
+        providers = document.get("model_providers")
+        if isinstance(providers, MutableMapping):
+            provider = providers.get("headroom")
+            base_url = provider.get("base_url") if isinstance(provider, Mapping) else None
+            if isinstance(base_url, str) and re.fullmatch(r"http://127\.0\.0\.1:\d+/v1", base_url):
+                del providers["headroom"]
+                content = tomlkit.dumps(document)
 
     return content.lstrip("\n").rstrip() + "\n" if content.strip() else ""
 
@@ -2915,17 +2927,51 @@ def _remove_marker_span(text: str, start_marker: str, end_marker: str) -> str:
 
 
 def _strip_existing_codex_headroom_provider_table(content: str) -> str:
-    """Remove a pre-existing ``[model_providers.headroom]`` table before wrap."""
-    if "[model_providers.headroom]" not in content:
+    """Remove a legacy Headroom provider table without touching other TOML.
+
+    ``tomlkit`` identifies tables structurally, preserving comments, string
+    values, and arrays of tables that text-level table-boundary matching can
+    mistake for provider content. The injector owns this provider name, so an
+    existing table is replaced by the current Headroom configuration.
+    """
+    import tomlkit
+
+    try:
+        document = tomlkit.parse(content)
+    except tomlkit.exceptions.ParseError:
+        return content
+
+    providers = document.get("model_providers")
+    if not isinstance(providers, MutableMapping):
+        return content
+    provider = providers.get("headroom")
+    if not isinstance(provider, Mapping):
         return content
+    del providers["headroom"]
+    return str(tomlkit.dumps(document))
 
-    import re  # local import to match surrounding helper convention
 
-    provider_table = re.compile(
-        r"(?ms)^[ \t]*\[model_providers\.headroom\][^\n]*\n.*?(?=^[ \t]*\[|\Z)"
-    )
-    content = provider_table.sub("", content)
-    return content.lstrip("\n").rstrip() + "\n" if content.strip() else ""
+def _strip_existing_codex_memory_mcp_table(content: str) -> str:
+    """Remove an unmarked memory MCP table without text-level TOML parsing.
+
+    TOMLKit resolves quoted keys and finds table boundaries structurally, so
+    comments, multiline strings, and arrays of tables remain untouched.
+    Invalid source TOML is deliberately left unchanged; the caller validates
+    its complete generated candidate before it can overwrite the file.
+    """
+    import tomlkit
+
+    try:
+        document = tomlkit.parse(content)
+    except tomlkit.exceptions.ParseError:
+        return content
+
+    mcp_servers =
```

**File**: `tests/test_cli/test_wrap_codex.py` (modified, +250/-0)
```diff
@@ -263,6 +263,176 @@ def test_inject_omits_db_and_replaces_existing_memory_block(
         assert "--db" not in content
         assert 'model = "gpt-4o"' in content
 
+    def test_inject_replaces_unmarked_memory_block(
+        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
+    ) -> None:
+        """A `[mcp_servers.headroom_memory]` table without the injection
+        markers (e.g. hand-copied from the `mcp_server.py` docstring, or left
+        over from before this table was marker-guarded) must be replaced in
+        place, not duplicated alongside a second, marked table.
+        """
+        _set_test_home(monkeypatch, tmp_path)
+        config_file = tmp_path / ".codex" / "config.toml"
+        config_file.parent.mkdir(parents=True)
+        config_file.write_text(
+            '[profiles.default]\nmodel = "gpt-4o"\n\n'
+            "[mcp_servers.headroom_memory]\n"
+            'command = "python"\n'
+            'args = ["-m", "headroom.memory.mcp_server", "--user", "old-user"]\n'
+            "startup_timeout_sec = 30\n"
+            "tool_timeout_sec = 30\n\n"
+            "[mcp_servers.other]\n"
+            'command = "other-tool"\n'
+        )
+
+        wrap_mod._inject_memory_mcp_config("codex-user")
+
+        content = config_file.read_text()
+        assert content.count("[mcp_servers.headroom_memory]") == 1
+        assert content.count(wrap_mod._MEMORY_MCP_MARKER) == 1
+        assert '"--user", "codex-user"' in content
+        assert "old-user" not in content
+        assert 'model = "gpt-4o"' in content
+        assert "[mcp_servers.other]" in content
+        assert 'command = "other-tool"' in content
+
+        # The result must also be valid, parseable TOML — the original bug
+        # produced two `[mcp_servers.headroom_memory]` tables, which is
+        # invalid TOML (duplicate key) and breaks Codex startup.
+        parsed = tomllib.loads(content)
+        assert parsed["mcp_servers"]["headroom_memory"]["args"][-1] == "codex-user"
+
+    def test_inject_preserves_table_looking_text_in_multiline_string(
+        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
+    ) -> None:
+        """A `[mcp_servers.headroom_memory]`-looking line embedded inside an
+        unrelated multiline string value must not be mistaken for a real
+        table and stripped -- doing so previously deleted the string's
+        closing delimiter and any settings after it, corrupting the file.
+        """
+        _set_test_home(monkeypatch, tmp_path)
+        config_file = tmp_path / ".codex" / "config.toml"
+        config_file.parent.mkdir(parents=True)
+        original = (
+            'instructions = """\n'
+            "[mcp_servers.headroom_memory]\n"
+            "keep this instruction\n"
+            '"""\n'
+            'model="gpt-4o"\n'
+        )
+        config_file.write_text(original)
+
+        wrap_mod._inject_memory_mcp_config("codex-user")
+
+        content = config_file.read_text()
+        # The unrelated multiline string and the setting after it must
+        # survive untouched.
+        assert "keep this instruction" in content
+        assert 'model="gpt-4o"' in content
+        # The real, marker-wrapped memory MCP block must still be injected.
+        assert content.count(wrap_mod._MEMORY_MCP_MARKER) == 1
+
+        parsed = tomllib.loads(content)
+        assert parsed["model"] == "gpt-4o"
+        assert parsed["instructions"] == "[mcp_servers.headroom_memory]\nkeep this instruction\n"
+        assert parsed["mcp_servers"]["headroom_memory"]["args"][-1] == "codex-user"
+
+    def test_inject_replaces_quoted_key_memory_table(
+        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
+    ) -> None:
+        """TOML allows `[mcp_servers."headroom_memory"]` as an equivalent
+        spelling of `[mcp_servers.headroom_memory]`; an unmarked table using
+        this spelling must still be replaced in place, not left behind
+        alongside a second, semantically-dupli
```

---

### Incident Patch 9: `f3f2e007` (2026-09-30)
**Commit Message**: fix(search): stop a context line's body from becoming its line marker (#3788)

## Description

Closes #3545

I could not reproduce the exact `Line 476: … 497: 535: 556: …` output in
the
report, and I think the reason is worth stating up front, because it
changes what
this PR does.

That shape cannot come out of the search compressor. `parse_match_line`
splits
**one input line at a time**, and `format_output` emits **one match per
line**, so
no code path can move line 497's number onto line 476's body. Feeding
the
shipped build a body that genuinely contains those numbers reproduces
the
reported string exactly:

```
input   app/settings.py:476:settings: settings({contact_precedence: 497: 535: 556:
        app/settings.py:497:...
        app/settings.py:535:...
        app/settings.py:556:...
output  app/settings.py:476:settings: settings({contact_precedence: 497: 535: 556:
        [... and 3 more matches in app/settings.py]
```

— i.e. the numbers were part of line 476's own content all along, and
497/535/556
were dropped as ordinary matches. `Line N:` rows are not parsed as
matches at all
and pass through untouched, which matches @TigerkidYang's finding on
`main`.

**But the class 

**File**: `crates/headroom-core/src/transforms/search_compressor.rs` (modified, +119/-10)
```diff
@@ -648,7 +648,10 @@ impl SearchCompressor {
 ///    practically never contains one (the Windows drive colon is
 ///    already skipped above), so the leftmost is the right one. The
 ///    no-whitespace guard keeps a `foo.rs:12:` reference *inside the
-///    body* of a `-`-separated context line from hijacking the parse.
+///    body* of a `-`-separated context line from hijacking the parse. A
+///    whitespace-free body reference (`a:7:b`) still slips past it, so
+///    [`parse_match_line`] hands priority back to the dash tier for that
+///    one shape; see the comment there.
 /// 2. **Dash tier** — `-` is grep's *context*-line separator, and unlike
 ///    `:` it appears inside real paths (`2026-05-03`, `CVE-2021-44228`,
 ///    `20240101-002-add_users.sql`), so the leftmost triplet is often
@@ -684,9 +687,50 @@ impl SearchCompressor {
 ///    Only reached when neither tier matched (e.g. a path containing a
 ///    space), so behaviour for those lines is exactly as before.
 fn parse_match_line(line: &str) -> Option<(&str, u64, &str)> {
-    scan_match_line(line, ScanTier::Colon)
-        .or_else(|| scan_match_line(line, ScanTier::Dash))
-        .or_else(|| scan_match_line(line, ScanTier::Permissive))
+    let colon = scan_marker(line, ScanTier::Colon);
+    let dash = scan_marker(line, ScanTier::Dash);
+
+    // The colon tier keeps priority: `path:line:content` is what grep emits for
+    // matches and a path practically never contains a colon. It yields in
+    // exactly one shape — a `-`-separated context line whose body carries a
+    // whitespace-free `name:N:` reference (`app.py-476-a:7:b`). The dash tier
+    // *positively confirmed* a boundary before the colon marker, so that colon
+    // triplet is body text, not a marker.
+    //
+    // Without the hand-off the body's number is read as the line number, the
+    // path swallows the real `-N-`, and the model is shown a file that does not
+    // exist holding content attributed to a line it never came from
+    // (issue #3545). The whitespace guard inside the colon tier cannot catch
+    // this, because the body ahead of the reference need not contain any.
+    //
+    // The `true` in the dash arm is load-bearing, and it is the *whole* test.
+    // A confirmed boundary means the dash tier saw the path end there — either
+    // the segment carried an extension (`app.py-476-`) or nothing after the
+    // marker looked like path structure (`CHANGELOG-12-`) — so the bytes from
+    // the closing dash onwards are body text and may look like anything. Bodies
+    // routinely carry a filename-style reference of their own
+    // (`app.py-476-foo.rs:12:ref`), and an extension dot there says nothing
+    // about where the path ended.
+    //
+    // The rows that must keep the colon tier are the ones where the dash tier
+    // could *not* confirm: `logs/2026-05-03/app.log:12:ERROR` and
+    // `migrations/20240101-002-add_users.sql:12:SELECT` both leave the digits
+    // inside the path, so the flag is false and the hand-off never applies. See
+    // [`path_continues`], which is what decides the flag.
+    let dash_overrides = match (colon, dash) {
+        (Some((colon_marker, _)), Some((dash_marker, true))) => colon_marker.0 > dash_marker.2,
+        _ => false,
+    };
+
+    let marker = if dash_overrides {
+        dash
+    } else {
+        colon
+            .or(dash)
+            .or_else(|| scan_marker(line, ScanTier::Permissive))
+    };
+
+    build_match(line, marker?.0)
 }
 
 #[derive(Debug, Clone, Copy, PartialEq, Eq)]
@@ -752,7 +796,22 @@ fn path_continues(rest: &str) -> bool {
         .is_some_and(|tok| tok.contains('/') || tok.contains('\\') || has_extension_dot(tok))
 }
 
-fn scan_match_line(line: &str, tier: ScanTier) -> Option<(&str, u64, &str)> {
+/// Byte offsets of one `<sep><digits><sep>` marker: where the path ends, where
+/// the digits start, and where the closing separator sits.
+type Marker = (usize, usize, usize);
+
+/
```

**File**: `tests/test_search_compressor.py` (modified, +103/-0)
```diff
@@ -112,6 +112,109 @@ def test_parse_mixed_valid_invalid(self):
         assert len(file_matches) == 2
 
 
+class TestContextLineBodyReference:
+    """A ``name:N:`` reference in a context line's body must not become the marker.
+
+    ripgrep emits ``path-line-content`` for *context* lines and
+    ``path:line:content`` for *match* lines, and real bodies routinely carry
+    their own ``name:N:`` references. The colon tier used to claim such a
+    reference as the line-number marker whenever no whitespace preceded it,
+    which pushed the real ``-N-`` marker into the path and reported the body's
+    number as the line number -- inventing a file that does not exist and
+    pairing content with a line it never came from (issue #3545).
+    """
+
+    def test_body_reference_does_not_become_the_line_number(self):
+        content = "app/settings.py-476-a:7:b:8:c"
+        compressor = SearchCompressor()
+        file_matches = compressor._parse_search_results(content)
+
+        assert list(file_matches) == ["app/settings.py"]
+        matches = file_matches["app/settings.py"].matches
+        assert len(matches) == 1
+        assert matches[0].line_number == 476
+        assert matches[0].content == "a:7:b:8:c"
+
+    def test_extensionless_context_path_keeps_its_own_line_number(self):
+        content = "CHANGELOG-12-a:99:b"
+        compressor = SearchCompressor()
+        file_matches = compressor._parse_search_results(content)
+
+        assert list(file_matches) == ["CHANGELOG"]
+        matches = file_matches["CHANGELOG"].matches
+        assert len(matches) == 1
+        assert matches[0].line_number == 12
+        assert matches[0].content == "a:99:b"
+
+    def test_colon_row_with_dashed_path_is_unaffected(self):
+        """The dash marker sits in the *path* here, so the colon tier still wins."""
+        content = "logs/2026-05-03/app.log:12:ERROR"
+        compressor = SearchCompressor()
+        file_matches = compressor._parse_search_results(content)
+
+        assert list(file_matches) == ["logs/2026-05-03/app.log"]
+        matches = file_matches["logs/2026-05-03/app.log"].matches
+        assert len(matches) == 1
+        assert matches[0].line_number == 12
+        assert matches[0].content == "ERROR"
+
+    def test_filename_style_body_reference_keeps_the_context_coordinates(self):
+        """A body reference that looks like a *filename* must not take the row.
+
+        ``app.py-476-foo.rs:12:ref`` is a ripgrep context row for ``app.py``
+        line 476 whose body is ``foo.rs:12:ref``. The dash tier confirms the
+        boundary (the segment carries an extension), so the extension dot
+        inside the body says nothing about where the path ended. Before the
+        fix the colon tier reclaimed the row as the nonexistent path
+        ``app.py-476-foo.rs`` at line 12.
+        """
+        content = "app.py-476-foo.rs:12:ref"
+        compressor = SearchCompressor()
+        file_matches = compressor._parse_search_results(content)
+
+        assert list(file_matches) == ["app.py"]
+        matches = file_matches["app.py"].matches
+        assert len(matches) == 1
+        assert matches[0].line_number == 476
+        assert matches[0].content == "foo.rs:12:ref"
+
+    def test_filename_style_body_reference_behind_a_directory(self):
+        """Same shape with a directory component, which also looks path-like."""
+        content = "pkg/server.ts-91-lib/index.js:7:import"
+        compressor = SearchCompressor()
+        file_matches = compressor._parse_search_results(content)
+
+        assert list(file_matches) == ["pkg/server.ts"]
+        matches = file_matches["pkg/server.ts"].matches
+        assert len(matches) == 1
+        assert matches[0].line_number == 91
+        assert matches[0].content == "lib/index.js:7:import"
+
+    def test_bare_path_body_keeps_the_context_coordinates(self):
+        """The body needs no reference at all to be path-like."""
+        content = "app.py-476-./vendo
```

---

### Incident Patch 10: `afaaaa88` (2026-09-30)
**Commit Message**: fix(thinking): don't read the model's date suffix as its minor version (#3791)

## Description

`bills_prior_thinking(model)` decides whether a model re-bills
prior-turn thinking (so compaction pays off) or strips it server-side
(where compacting would turn *free* stripped thinking into *billed*
text). It parses the version from the model id by collecting **every**
contiguous digit group, then compares `(major, minor) >= (4, 6)`:

```python
nums = []
for part in model.lower().split("-"):
    if part.isdigit():
        nums.append(int(part))
    elif nums:
        break
major = nums[0]
minor = nums[1] if len(nums) > 1 else 0
return major >= 5 or (major, minor) >= (4, 6)
```

For a **major-only** id with a release-date suffix — e.g.
`claude-sonnet-4-20250514`, `claude-opus-4-20250514` — the 8-digit date
is collected as a version component: `nums = [4, 20250514]`, so `(4,
20250514) >= (4, 6)` → **True**. The gate is inverted for these ids.

Claude 4.0 strips prior-turn thinking server-side, so the gate must
return `False`. Returning `True` makes `compact_thinking_to_text` /
`compact_reasoning_openai_chat` rewrite those requests and convert the
free (stripped) thinking into billed text

**File**: `headroom/transforms/thinking_compactor.py` (modified, +6/-1)
```diff
@@ -59,7 +59,12 @@ def bills_prior_thinking(model: str) -> bool:
     """
     nums: list[int] = []
     for part in model.lower().split("-"):
-        if part.isdigit():
+        # Version components are one or two digits (major, optional minor). Longer
+        # runs are the release-date suffix (``YYYYMMDD``) — treating it as the
+        # minor version made a major-only id like ``claude-sonnet-4-20250514``
+        # read as ``(4, 20250514) >= (4, 6)`` -> True, inverting the gate for
+        # Claude 4.0 (which strips prior thinking server-side).
+        if part.isdigit() and len(part) <= 2:
             nums.append(int(part))
         elif nums:
             break  # version digits are contiguous; stop at the family/date boundary
```

**File**: `tests/test_thinking_compactor_version_gate.py` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+"""Version-gate tests for thinking_compactor.bills_prior_thinking.
+
+The gate decides whether a model re-bills prior-turn thinking (so compaction
+pays) or strips it server-side (so compacting would turn free thinking into
+billed text). It parses the version out of the model id, and must not mistake
+the ``YYYYMMDD`` release-date suffix for the minor version.
+"""
+
+from __future__ import annotations
+
+import pytest
+
+from headroom.transforms.thinking_compactor import bills_prior_thinking
+
+
+@pytest.mark.parametrize(
+    ("model", "expected"),
+    [
+        # Major-only ids with a date suffix: the date must NOT be read as the
+        # minor version. Claude 4.0 strips prior thinking server-side -> False.
+        ("claude-sonnet-4-20250514", False),
+        ("claude-opus-4-20250514", False),
+        ("claude-opus-4", False),
+        # Explicit minor below the 4.6 threshold -> strips -> False.
+        ("claude-sonnet-4-5-20250929", False),
+        ("claude-haiku-4-5-20251001", False),
+        ("claude-opus-4-1-20250805", False),
+        ("claude-opus-4-5-20250101", False),
+        # 4.6+ and the 5 family re-bill prior thinking -> True.
+        ("claude-opus-4-6", True),
+        ("claude-sonnet-4-6", True),
+        ("claude-opus-4-8", True),
+        ("claude-sonnet-5", True),
+        ("claude-sonnet-5-20260101", True),
+        # Legacy 3.x naming (with date) stays below threshold.
+        ("claude-3-5-sonnet-20241022", False),
+        ("claude-3-opus-20240229", False),
+        # No version at all -> conservative False.
+        ("some-unversioned-model", False),
+    ],
+)
+def test_bills_prior_thinking_version_gate(model: str, expected: bool) -> None:
+    assert bills_prior_thinking(model) is expected
+
+
+def test_date_suffix_is_not_read_as_minor_version() -> None:
+    """Regression for the specific inversion: a major-only id whose 8-digit date
+    suffix was parsed as the minor version, flipping a strip-model to 'bills'."""
+    # Same major (4), only the date suffix differs from an explicit-minor id.
+    assert bills_prior_thinking("claude-sonnet-4-20250514") is False
+    # Sanity: the real 4.6 id still bills.
+    assert bills_prior_thinking("claude-sonnet-4-6-20260101") is True
```

#### Recent Merged Pull Requests:
- **PR #3887** (2026-09-30): ci(pr-health): check out the commit the workflow runs from (@gglucass)
- **PR #3885** (2026-09-30): fix(transforms): keep file-read protection in token mode under the coding profile (@gglucass)
- **PR #3883** (2026-09-30): fix(sdk): keep tool names on Vercel tool-result parts through the OpenAI round trip (@dex0shubham)
- **PR #3881** (2026-09-30): fix(transforms): judge the code_aware Kompress fallback in tokens (@gglucass)
- **PR #3878** (2026-09-30): fix(transforms): judge a Codex exec envelope read by its output (@gglucass)
- **PR #3876** (2026-09-30): ci: upload shard coverage even when a test in the shard fails (@gglucass)
- **PR #3875** (2026-09-30): fix(proxy): keep the hard watchdog out of pytest and alive when sys.stderr is swapped (@gglucass)
- **PR #3874** (2026-09-30): fix(proxy/anthropic): keep tool_result blocks first when neutralizing headroom_retrieve history (@gglucass)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
