# Forensic Learning Record (Deep Inspection): cocoindex-io/cocoindex

> **Canonical Artifact**: `07_PROJECT_LEARNING/cocoindex-io-cocoindex-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/cocoindex-io/cocoindex](https://github.com/cocoindex-io/cocoindex))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:29:46.348Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cocoindex-io/cocoindex`
- **Description**: Incremental engine for long horizon agents 🌟 Star if you like it!
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md
- **Stars / Engagement**: 11638 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/entity_resolution/benchmark.py`
```
from __future__ import annotations

import argparse
import asyncio
from dataclasses import asdict, dataclass, field
import json
import math
import os
from pathlib import Path
import random
import sys
import time
from typing import Protocol

from dotenv import load_dotenv
import faiss
import numpy as np
from numpy.typing import NDArray

from cocoindex.ops.entity_resolution import (
    CanonicalSide,
    PairDecision,
    ResolutionEvent,
    resolve_entities,
)


BENCH_ROOT = Path(__file__).resolve().parent
DEFAULT_STATE_DIR = BENCH_ROOT / ".work" / "cocoindex"
ENV_PATH = BENCH_ROOT / ".env"


@dataclass(frozen=True, slots=True)
class BenchmarkProfile:
    embedder: str
    resolver: str
    groups: int
    aliases_per_group: int
    isolated: int
    cluster_sizes: tuple[int, ...] | None = None
    seed: int = 7
    max_distance: float = 0.3
    top_n: int = 5
    embedding_model: str = "text-embedding-3-small"
    synthetic_dim: int = 384
    synthetic_embed_delay_ms: float = 0.0
    rule_resolver_delay_ms: float = 0.0
    llm_model: str = "openai/gpt-5.4-nano"
    entity_type: str = "organization"


BENCHMARK_PROFILES: dict[str, BenchmarkProfile] = {
    "synthetic-fast": BenchmarkProfile(
        embedder="synthetic",
        resolver="ground-truth",
        groups=100,
        aliases_per_group=4,
        isolated=100,
    ),
    "synthetic-latency": BenchmarkProfile(
        embedder="synthetic",
        resolver="ground-truth",
        groups=100,
        aliases_per_group=4,
        isolated=100,
        rule_resolver_delay_ms=20.0,
    ),
    "synthetic-many-components": BenchmarkProfile(
        embedder="synthetic",
        resolver="ground-truth",
        groups=0,
        aliases_per_group=0,
        isolated=0,
        cluster_sizes=tuple([2] * 50 + [3] * 30 + [1] * 100),
        rule_resolver_delay_ms=20.0,
    ),
    "synthetic-one-giant": BenchmarkProfile(
        embedder="synthetic",
        resolver="ground-truth",
        groups=0,
        aliases_per_group=0,
        isolated=0,
        cluster_sizes=(100,),
        rule_resolver_delay_ms=20.0,
    ),
    "openai-small": BenchmarkProfile(
        embedder="litellm",
        resolver="llm",
        groups=5,
        aliases_per_group=3,
        isolated=5,
    ),
    "openai-many-components": BenchmarkProfile(
        embedder="litellm",
        resolver="llm",
        groups=0,
        aliases_per_group=0,
        isolated=0,
        cluster_sizes=tuple([3] * 10 + [1] * 5),
        max_distance=0.15,
    ),
}

_PROFILE_OPTIONS = {
    "embedder": "--embedder",
    "resolver": "--resolver",
    "groups": "--groups",
    "aliases_per_group": "--aliases-per-group",
    "isolated": "--isolated",
    "cluster_sizes": "--cluster-sizes",
    "seed": "--seed",
    "max_distance": "--max-distance",
    "top_n": "--top-n",
    "embedding_model": "--embedding-model",
    "synthetic_dim": "--synthetic-dim",
    "synthetic_embed_delay_ms": "--synthetic-embed-delay-ms",
    "rule_resolver_delay_ms": "--rule-resolver-delay-ms",
    "llm_model": "--llm-model",
    "entity_type": "--entity-type",
}


class Embedder(Protocol):
    async def embed(self, text: str) -> NDArray[np.float32]: ...


class PairResolver(Protocol):
    async def __call__(self, entity: str, candidates: list[str]) -> PairDecision: ...


@dataclass(frozen=True, slots=True)
class SyntheticDataset:
    entities: list[str]
    expected_canonical: dict[str, str]
    grouped_entities: dict[str, list[str]]


@dataclass(slots=True)
class TimedCallMetrics:
    calls: int = 0
    total_ms: float = 0.0
    max_ms: float = 0.0
    max_concurrency: int = 0
    latencies_ms: list[float] = field(default_factory=list)

    def record(self, latency_ms: float) -> None:
        self.calls += 1
        self.total_ms += latency_ms
        self.max_ms = max(self.max_ms, latency_ms)
        self.latencies_ms.append(latency_ms)

    def summary(self) -> dict[str, float | int]:
        return {
            "calls": self.calls,
            "total_ms": round(self.total_ms, 3),
            "avg_ms": round(self.total_ms / self.calls, 3) if self.calls else 0.0,
            "p50_ms": round(_percentile(self.latencies_ms, 50), 3),
            "p95_ms": round(_percentile(self.latencies_ms, 95), 3),
            "max_ms": round(self.max_ms, 3),
            "max_concurrency": self.max_concurrency,
        }


@dataclass(slots=True)
class ResolverMetrics:
    timing: TimedCallMetrics = field(default_factory=TimedCallMetrics)
    total_candidates: int = 0
    max_candidates: int = 0
    matched: int = 0
    no_match: int = 0
    candidate_counts: list[int] = field(default_factory=list)

    def record(self, candidates: list[str], decision: PairDecision) -> None:
        count = len(candidates)
        self.total_candidates += count
        self.max_candidates = max(self.max_candidates, count)
        self.candidate_counts.append(count)
        if decision.matched is None:
            self.no_match += 1
        else:
            self.matched += 1

    def summary(self) -> dict[str, float | int]:
        timing = self.timing.summary()
        return {
            **timing,
            "matched": self.matched,
            "no_match": self.no_match,
            "total_candidates": self.total_candidates,
            "avg_candidates": (
                round(self.total_candidates / self.timing.calls, 3)
                if self.timing.calls
                else 0.0
            ),
            "p50_candidates": round(_percentile(self.candidate_counts, 50), 3),
            "p95_candidates": round(_percentile(self.candidate_counts, 95), 3),
            "max_candidates": self.max_candidates,
        }


@dataclass(slots=True)
class EventMetrics:
    events: int = 0
    zero_candidate_events: int = 0
    resolver_events: int = 0
    seeded_events: int = 0
    repointed_events: int = 0

    def on_resolution(self, event: ResolutionEvent) -> None:
        self.events += 1
        if not event.candidates:
            self.zero_candidate_events += 1
        if event.decision is not None:
            self.resolver_events += 1
        if event.seeded:
            self.seeded_events += 1
        if event.repointed is not None:
            self.repointed_events += 1


class TimedEmbedder:
    def __init__(self, embedder: Embedder) -> None:
        self._embedder = embedder
        self.metrics = TimedCallMetrics()
        self._active = 0
        self.captured: dict[str, NDArray[np.float32]] = {}

    async def embed(self, text: str) -> NDArray[np.float32]:
        self._active += 1
        self.metrics.max_concurrency = max(self.metrics.max_concurrency, self._active)
        start = time.perf_counter()
        try:
            vec = await self._embedder.embed(text)
            self.captured[text] = vec
            return vec
        finally:
            latency_ms = (time.perf_counter() - start) * 1000.0
            self.metrics.record(latency_ms)
            self._active -= 1


class TimedResolver:
    def __init__(self, resolver: PairResolver) -> None:
        self._resolver = resolver
        self.metrics = ResolverMetrics()
        self._active = 0

    async def __call__(self, entity: str, candidates: list[str]) -> PairDecision:
        self._active += 1
        self.metrics.timing.max_concurrency = max(
            self.metrics.timing.max_concurrency, self._active
        )
        start = time.perf_counter()
        try:
            decision = await self._resolver(entity, candidates)
        finally:
            latency_ms = (time.perf_counter() - start) * 1000.0
            self.metrics.timing.record(latency_ms)
            self._active -= 1
        self.metrics.record(candidates, decision)
        return decision


class SyntheticEmbedder:
    def __init__(
        self,
        dataset: SyntheticDataset,
        *,
        dim: int,
        seed: int,
        delay_ms: float,
    ) -> None:
        self._vectors = _build_vectors(dataset, dim=dim, seed=seed)
        self.
```

### Core Architecture Module: `benchmarks/file_summarization/python/benchmark.py`
```
from __future__ import annotations

import argparse
import asyncio
from dataclasses import dataclass, field
import json
import pathlib
import time

import cocoindex as coco
from cocoindex.connectors import localfs
from cocoindex.resources.file import FileLike, PatternFilePathMatcher

from common import (
    CollectionSummary,
    SectionAnalysis,
    SectionInput,
    analyze_section,
    split_into_sections,
    summarize_collection,
    sync_output_tree,
)


@dataclass(slots=True)
class BenchMetrics:
    projects_seen: int = 0
    files_seen: int = 0
    sections_total: int = 0
    batch_calls: int = 0
    batch_items: int = 0
    projects_rebuilt: int = 0
    output_files_rebuilt: int = 0
    output_file_count: int = 0
    output_bytes: int = 0
    output_hash: str = ""


@dataclass(slots=True)
class RunState:
    scenario: str
    profile: str
    phase: str
    metrics: BenchMetrics = field(default_factory=BenchMetrics)
    summaries: dict[str, CollectionSummary] = field(default_factory=dict)


RUN_STATE: RunState | None = None


def run_state() -> RunState:
    if RUN_STATE is None:
        raise RuntimeError("Benchmark run state is not initialized")
    return RUN_STATE


def collection_kind() -> str:
    return "project" if run_state().scenario == "codebase" else "site"


def file_patterns() -> list[str]:
    if run_state().scenario == "codebase":
        return ["**/*.rs", "**/*.py", "**/*.md", "**/*.toml"]
    return ["**/*.md"]


@coco.fn(memo=True)
async def extract_sections(relative_path: str, file: FileLike) -> list[SectionInput]:
    return split_into_sections(relative_path, await file.read_text())


@coco.fn.as_async(memo=True, batching=True, max_batch_size=128)
def analyze_sections(inputs: list[SectionInput]) -> list[SectionAnalysis]:
    state = run_state()
    state.metrics.batch_calls += 1
    state.metrics.batch_items += len(inputs)
    return [analyze_section(section, profile=state.profile) for section in inputs]


@coco.fn(memo=True)
async def build_summary(
    kind: str,
    name: str,
    analyses: list[SectionAnalysis],
) -> CollectionSummary:
    return summarize_collection(kind, name, analyses)


@coco.fn
async def process_project(project_dir: pathlib.Path) -> None:
    state = run_state()
    project_name = project_dir.name
    state.metrics.projects_seen += 1

    walker = localfs.walk_dir(
        project_dir,
        recursive=True,
        path_matcher=PatternFilePathMatcher(included_patterns=file_patterns()),
    )

    items: list[tuple[str, FileLike]] = []
    async for key, file in walker.items():
        items.append((key, file))
    items.sort(key=lambda item: item[0])

    state.metrics.files_seen += len(items)

    extracted_lists = await asyncio.gather(
        *(extract_sections(relative_path, file) for relative_path, file in items)
    )
    sections = [section for section_list in extracted_lists for section in section_list]
    state.metrics.sections_total += len(sections)

    analyses = await asyncio.gather(
        *(analyze_sections(section) for section in sections)
    )
    state.summaries[project_name] = await build_summary(
        collection_kind(),
        project_name,
        analyses,
    )


@coco.fn
async def app_main(dataset_dir: pathlib.Path, output_dir: pathlib.Path) -> None:
    state = run_state()
    projects = sorted(
        (path.name, path) for path in dataset_dir.iterdir() if path.is_dir()
    )
    handle = await coco.mount_each(process_project, projects)
    await handle.ready()

    if len(state.summaries) != len(projects):
        raise RuntimeError(
            f"Expected {len(projects)} summaries but collected {len(state.summaries)}"
        )

    sync_stats = sync_output_tree(
        output_dir,
        scenario=state.scenario,
        profile=state.profile,
        summaries=state.summaries.values(),
    )
    state.metrics.projects_rebuilt = int(sync_stats["projects_rebuilt"])
    state.metrics.output_files_rebuilt = int(sync_stats["output_files_rebuilt"])
    state.metrics.output_file_count = int(sync_stats["output_file_count"])
    state.metrics.output_bytes = int(sync_stats["output_bytes"])
    state.metrics.output_hash = str(sync_stats["output_hash"])


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the Python CocoIndex benchmark.")
    parser.add_argument("--scenario", choices=["codebase", "docs"], required=True)
    parser.add_argument("--profile", choices=["io", "cpu", "mixed"], required=True)
    parser.add_argument("--dataset", type=pathlib.Path, required=True)
    parser.add_argument("--state", type=pathlib.Path, required=True)
    parser.add_argument("--output", type=pathlib.Path, required=True)
    parser.add_argument("--metrics", type=pathlib.Path, required=True)
    parser.add_argument(
        "--phase", choices=["cold", "warm", "edit", "shape"], required=True
    )
    return parser.parse_args()


async def run_once(args: argparse.Namespace) -> dict[str, object]:
    global RUN_STATE

    RUN_STATE = RunState(
        scenario=args.scenario,
        profile=args.profile,
        phase=args.phase,
    )

    env = coco.Environment(coco.Settings.from_env(db_path=args.state))
    app = coco.App(
        coco.AppConfig(name=f"benchmark_{args.scenario}", environment=env),
        app_main,
        dataset_dir=args.dataset,
        output_dir=args.output,
    )

    start = time.perf_counter()
    await app.update()
    elapsed_ms = (time.perf_counter() - start) * 1000.0

    state = run_state()
    metrics = {
        "language": "python",
        "scenario": args.scenario,
        "profile": args.profile,
        "phase": args.phase,
        "elapsed_ms": round(elapsed_ms, 3),
        "projects_seen": state.metrics.projects_seen,
        "files_seen": state.metrics.files_seen,
        "sections_total": state.metrics.sections_total,
        "sections_analyzed": state.metrics.batch_items,
        "batch_calls": state.metrics.batch_calls,
        "batch_items": state.metrics.batch_items,
        "cache_hits": state.metrics.sections_total - state.metrics.batch_items,
        "cache_misses": state.metrics.batch_items,
        "projects_rebuilt": state.metrics.projects_rebuilt,
        "output_files_rebuilt": state.metrics.output_files_rebuilt,
        "output_file_count": state.metrics.output_file_count,
        "output_bytes": state.metrics.output_bytes,
        "output_hash": state.metrics.output_hash,
    }
    args.metrics.parent.mkdir(parents=True, exist_ok=True)
    args.metrics.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    return metrics


def main() -> None:
    args = parse_args()
    asyncio.run(run_once(args))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `benchmarks/file_summarization/python/common.py`
```
from __future__ import annotations

import json
import shutil
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable


FNV_OFFSET_BASIS = 0xCBF29CE484222325
FNV_PRIME = 0x100000001B3
MASK_64 = 0xFFFFFFFFFFFFFFFF
BENCHMARK_SEED = 20260420
SKETCH_BINS = 12
PROFILE_ORDER = ("io", "cpu", "mixed")


CODEBASE_SCALES = {
    "tiny": {
        "projects": 3,
        "rust_files_per_project": 3,
        "python_files_per_project": 3,
        "markdown_files_per_project": 2,
        "toml_files_per_project": 1,
        "code_sections_per_file": 4,
        "markdown_sections_per_file": 3,
        "toml_sections_per_file": 2,
    },
    "medium": {
        "projects": 8,
        "rust_files_per_project": 8,
        "python_files_per_project": 8,
        "markdown_files_per_project": 4,
        "toml_files_per_project": 2,
        "code_sections_per_file": 5,
        "markdown_sections_per_file": 4,
        "toml_sections_per_file": 3,
    },
    "large": {
        "projects": 16,
        "rust_files_per_project": 16,
        "python_files_per_project": 16,
        "markdown_files_per_project": 8,
        "toml_files_per_project": 4,
        "code_sections_per_file": 5,
        "markdown_sections_per_file": 4,
        "toml_sections_per_file": 3,
    },
    "xlarge": {
        "projects": 64,
        "rust_files_per_project": 32,
        "python_files_per_project": 32,
        "markdown_files_per_project": 16,
        "toml_files_per_project": 8,
        "code_sections_per_file": 5,
        "markdown_sections_per_file": 4,
        "toml_sections_per_file": 3,
    },
}

DOCS_SCALES = {
    "tiny": {
        "sites": 3,
        "pages_per_site": 8,
        "sections_per_page": 4,
    },
    "medium": {
        "sites": 8,
        "pages_per_site": 24,
        "sections_per_page": 5,
    },
    "large": {
        "sites": 12,
        "pages_per_site": 48,
        "sections_per_page": 6,
    },
    "xlarge": {
        "sites": 32,
        "pages_per_site": 160,
        "sections_per_page": 6,
    },
}

TOPICS = [
    "cache",
    "parser",
    "index",
    "ledger",
    "ranking",
    "vector",
    "retrieval",
    "chunk",
    "summary",
    "batch",
    "memo",
    "graph",
    "signal",
    "policy",
    "shard",
    "tenant",
    "checkpoint",
    "scheduler",
    "pipeline",
    "lineage",
]

QUALIFIERS = [
    "steady",
    "delta",
    "fresh",
    "noisy",
    "dense",
    "sparse",
    "exact",
    "warm",
    "cold",
    "stable",
    "dynamic",
    "incremental",
]

VERBS = [
    "tracks",
    "folds",
    "refreshes",
    "compares",
    "hydrates",
    "compresses",
    "routes",
    "scores",
    "stages",
    "filters",
    "batches",
    "replays",
]


@dataclass(frozen=True, slots=True)
class WorkloadProfile:
    name: str
    codebase_file_multiplier: int
    docs_page_multiplier: int
    code_section_bonus: int
    markdown_section_bonus: int
    toml_section_bonus: int
    code_comment_lines: int
    markdown_lines: int
    markdown_code_lines: int
    toml_summary_lines: int
    analysis_rounds: int
    shingle_span: int
    emit_file_reports: bool


WORKLOAD_PROFILES = {
    "mixed": WorkloadProfile(
        name="mixed",
        codebase_file_multiplier=1,
        docs_page_multiplier=1,
        code_section_bonus=0,
        markdown_section_bonus=0,
        toml_section_bonus=0,
        code_comment_lines=4,
        markdown_lines=5,
        markdown_code_lines=1,
        toml_summary_lines=1,
        analysis_rounds=2,
        shingle_span=2,
        emit_file_reports=False,
    ),
    "io": WorkloadProfile(
        name="io",
        codebase_file_multiplier=2,
        docs_page_multiplier=2,
        code_section_bonus=1,
        markdown_section_bonus=1,
        toml_section_bonus=1,
        code_comment_lines=12,
        markdown_lines=14,
        markdown_code_lines=3,
        toml_summary_lines=3,
        analysis_rounds=1,
        shingle_span=1,
        emit_file_reports=True,
    ),
    "cpu": WorkloadProfile(
        name="cpu",
        codebase_file_multiplier=1,
        docs_page_multiplier=1,
        code_section_bonus=1,
        markdown_section_bonus=1,
        toml_section_bonus=1,
        code_comment_lines=8,
        markdown_lines=8,
        markdown_code_lines=2,
        toml_summary_lines=2,
        analysis_rounds=8,
        shingle_span=4,
        emit_file_reports=False,
    ),
}


@dataclass(frozen=True, slots=True)
class SectionInput:
    stable_id: str
    file_path: str
    language: str
    heading: str
    text: str


@dataclass(frozen=True, slots=True)
class SectionAnalysis:
    stable_id: str
    file_path: str
    language: str
    heading: str
    token_count: int
    unique_tokens: int
    top_tokens: tuple[str, ...]
    sketch: tuple[int, ...]
    signature: str


@dataclass(frozen=True, slots=True)
class FileSummary:
    path: str
    language: str
    section_count: int
    top_tokens: tuple[str, ...]
    section_signatures: tuple[str, ...]
    feature_totals: tuple[int, ...]


@dataclass(frozen=True, slots=True)
class CollectionSummary:
    kind: str
    name: str
    file_count: int
    section_count: int
    language_counts: dict[str, int]
    top_tokens: tuple[str, ...]
    feature_totals: tuple[int, ...]
    files: tuple[FileSummary, ...]


class Fnv1a64:
    def __init__(self) -> None:
        self._value = FNV_OFFSET_BASIS

    def update(self, data: bytes) -> None:
        for byte in data:
            self._value ^= byte
            self._value = (self._value * FNV_PRIME) & MASK_64

    def hexdigest(self) -> str:
        return f"{self._value:016x}"


def workload_profile(name: str) -> WorkloadProfile:
    try:
        return WORKLOAD_PROFILES[name]
    except KeyError as exc:
        raise ValueError(f"Unsupported workload profile: {name}") from exc


def scaled_count(base: int, *, multiplier: int = 1, bonus: int = 0) -> int:
    return max(1, base * multiplier + bonus)


def fnv1a64_bytes(data: bytes) -> int:
    hasher = Fnv1a64()
    hasher.update(data)
    return int(hasher.hexdigest(), 16)


def fnv1a64_text(text: str) -> int:
    return fnv1a64_bytes(text.encode("utf-8"))


def fnv1a64_hex(text: str) -> str:
    return f"{fnv1a64_text(text):016x}"


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")


def tree_digest(root: Path) -> str:
    hasher = Fnv1a64()
    if not root.exists():
        return hasher.hexdigest()
    for path in sorted(p for p in root.rglob("*") if p.is_file()):
        rel = path.relative_to(root).as_posix().encode("utf-8")
        hasher.update(rel)
        hasher.update(b"\0")
        hasher.update(path.read_bytes())
        hasher.update(b"\0")
    return hasher.hexdigest()


def reset_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def build_phrase(
    project_idx: int, file_idx: int, section_idx: int, line_idx: int
) -> str:
    base = project_idx * 17 + file_idx * 11 + section_idx * 7 + line_idx * 3
    topic = TOPICS[base % len(TOPICS)]
    qualifier = QUALIFIERS[(base + 5) % len(QUALIFIERS)]
    verb = VERBS[(base + 9) % len(VERBS)]
    companion = TOPICS[(base + 13) % len(TOPICS)]
    return (
        f"{qualifier} {topic} {verb} {companion} state "
        f"marker_{project_idx}_{file_idx}_{section_idx}_{line_idx}"
    )


def build_line_block(
    project_idx: int,
    file_idx: int,
    section_idx: int,
    *,
    lines: int,
    prefix: str = "",
) -> str:
    values: list[str] = []
    for line_idx in range(lines):
        phrase = build_phrase(project_idx, file_idx, section_idx, line_idx)
        values.append(f"{prefix} {phrase}" if prefix else phrase)
 
```

### Core Architecture Module: `benchmarks/file_summarization/python/runner.py`
```
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import statistics
import subprocess
import shutil
from typing import Any

from common import (
    BENCHMARK_SEED,
    PROFILE_ORDER,
    apply_edit_mutation,
    apply_shape_mutation,
    generate_dataset,
)


PY_DIR = Path(__file__).resolve().parent
BENCH_ROOT = PY_DIR.parent
RUST_MANIFEST = BENCH_ROOT / "rust" / "Cargo.toml"
RUST_BIN = BENCH_ROOT / "rust" / "target" / "release" / "file_summarization"
PYTHON_BIN = PY_DIR / "benchmark.py"
WORK_ROOT = BENCH_ROOT / ".work"
PHASES = ("cold", "warm", "edit", "shape")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run CocoIndex cross-language benchmarks."
    )
    parser.add_argument(
        "--scenario",
        choices=["codebase", "docs", "all"],
        default="all",
        help="Benchmark scenario to run.",
    )
    parser.add_argument(
        "--scale",
        choices=["tiny", "medium", "large", "xlarge"],
        default="tiny",
        help="Dataset size profile.",
    )
    parser.add_argument(
        "--profile",
        choices=["io", "cpu", "mixed", "all"],
        default="mixed",
        help="Workload profile to run.",
    )
    parser.add_argument(
        "--trials",
        type=int,
        default=1,
        help="Number of fresh trials to execute.",
    )
    parser.add_argument(
        "--format",
        choices=["table", "json"],
        default="table",
        help="Output format for aggregated results.",
    )
    return parser.parse_args()


def build_rust_binary() -> None:
    subprocess.run(
        ["cargo", "build", "--release", "--manifest-path", str(RUST_MANIFEST)],
        cwd=BENCH_ROOT,
        check=True,
    )


def run_language(
    language: str,
    *,
    scenario: str,
    profile: str,
    dataset_dir: Path,
    state_dir: Path,
    output_dir: Path,
    metrics_path: Path,
    phase: str,
) -> dict[str, Any]:
    env = os.environ.copy()
    if language == "python":
        cmd = [
            "uv",
            "run",
            "--project",
            str(PY_DIR),
            "python",
            str(PYTHON_BIN),
            "--scenario",
            scenario,
            "--profile",
            profile,
            "--dataset",
            str(dataset_dir),
            "--state",
            str(state_dir),
            "--output",
            str(output_dir),
            "--metrics",
            str(metrics_path),
            "--phase",
            phase,
        ]
    else:
        cmd = [
            str(RUST_BIN),
            "--scenario",
            scenario,
            "--profile",
            profile,
            "--dataset",
            str(dataset_dir),
            "--state",
            str(state_dir),
            "--output",
            str(output_dir),
            "--metrics",
            str(metrics_path),
            "--phase",
            phase,
        ]

    subprocess.run(cmd, cwd=BENCH_ROOT, env=env, check=True)
    return json.loads(metrics_path.read_text(encoding="utf-8"))


def run_trial(
    scenario: str, profile: str, scale: str, trial_index: int
) -> list[dict[str, Any]]:
    trial_root = WORK_ROOT / scenario / profile / scale / f"trial_{trial_index:02d}"
    dataset_dir = trial_root / "dataset"
    rust_state = trial_root / "rust_state"
    python_state = trial_root / "python_state"
    rust_output = trial_root / "rust_output"
    python_output = trial_root / "python_output"
    rust_metrics = trial_root / "rust_metrics.json"
    python_metrics = trial_root / "python_metrics.json"

    generate_dataset(dataset_dir, scenario, scale, profile)
    for path in (rust_state, python_state, rust_output, python_output):
        if path.exists():
            if path.is_dir():
                shutil.rmtree(path)
            else:
                path.unlink()
        path.mkdir(parents=True, exist_ok=True)

    phase_results: list[dict[str, Any]] = []
    for phase in PHASES:
        mutation: dict[str, Any] | None = None
        if phase == "edit":
            mutation = apply_edit_mutation(dataset_dir, scenario, profile)
        elif phase == "shape":
            mutation = apply_shape_mutation(dataset_dir, scenario, profile)

        rust_result = run_language(
            "rust",
            scenario=scenario,
            profile=profile,
            dataset_dir=dataset_dir,
            state_dir=rust_state,
            output_dir=rust_output,
            metrics_path=rust_metrics,
            phase=phase,
        )
        python_result = run_language(
            "python",
            scenario=scenario,
            profile=profile,
            dataset_dir=dataset_dir,
            state_dir=python_state,
            output_dir=python_output,
            metrics_path=python_metrics,
            phase=phase,
        )

        if rust_result["output_hash"] != python_result["output_hash"]:
            raise RuntimeError(
                f"Output mismatch in {scenario}:{profile}:{phase}: "
                f"rust={rust_result['output_hash']} python={python_result['output_hash']}"
            )

        rust_result["trial"] = trial_index
        python_result["trial"] = trial_index
        if mutation is not None:
            rust_result["mutation"] = mutation
            python_result["mutation"] = mutation
        phase_results.extend([rust_result, python_result])

    return phase_results


def aggregate_results(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    aggregated: list[dict[str, Any]] = []
    keys = sorted(
        {
            (row["scenario"], row["profile"], row["phase"], row["language"])
            for row in rows
        }
    )
    for scenario, profile, phase, language in keys:
        group = [
            row
            for row in rows
            if row["scenario"] == scenario
            and row["profile"] == profile
            and row["phase"] == phase
            and row["language"] == language
        ]
        aggregated.append(
            {
                "scenario": scenario,
                "profile": profile,
                "phase": phase,
                "language": language,
                "trials": len(group),
                "elapsed_ms_median": statistics.median(
                    row["elapsed_ms"] for row in group
                ),
                "cache_misses_median": statistics.median(
                    row["cache_misses"] for row in group
                ),
                "batch_calls_median": statistics.median(
                    row["batch_calls"] for row in group
                ),
                "output_files_rebuilt_median": statistics.median(
                    row["output_files_rebuilt"] for row in group
                ),
                "output_file_count_median": statistics.median(
                    row["output_file_count"] for row in group
                ),
                "output_bytes_median": statistics.median(
                    row["output_bytes"] for row in group
                ),
                "sections_total_median": statistics.median(
                    row["sections_total"] for row in group
                ),
            }
        )
    return aggregated


def print_table(rows: list[dict[str, Any]]) -> None:
    profile_rank = {name: index for index, name in enumerate(PROFILE_ORDER)}
    groups = sorted(
        {(row["scenario"], row["profile"]) for row in rows},
        key=lambda item: (item[0], profile_rank[item[1]]),
    )
    for scenario, profile in groups:
        print(f"\nScenario: {scenario} | Profile: {profile}")
        print("phase    rust_ms  py_ms  ratio  rust_miss  py_miss  rust_out  py_out")
        for phase in PHASES:
            rust_row = next(
                row
                for row in rows
                if row["scenario"] == scenario
                and row["profile"] == profile
                and row["phase"] == phase
                and row["language"]
```

### Core Architecture Module: `benchmarks/file_summarization/rust/src/main.rs`
```
use std::collections::{BTreeMap, HashMap};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use cocoindex::fs::{FileEntry, walk};
use cocoindex::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

const FNV_OFFSET_BASIS: u64 = 0xcbf29ce484222325;
const FNV_PRIME: u64 = 0x100000001b3;
const SKETCH_BINS: usize = 12;

#[derive(Clone, Debug)]
enum Scenario {
    Codebase,
    Docs,
}

impl Scenario {
    fn parse(value: &str) -> cocoindex::Result<Self> {
        match value {
            "codebase" => Ok(Self::Codebase),
            "docs" => Ok(Self::Docs),
            _ => Err(engine_err(format!("unsupported scenario `{value}`"))),
        }
    }

    fn as_str(&self) -> &'static str {
        match self {
            Self::Codebase => "codebase",
            Self::Docs => "docs",
        }
    }

    fn collection_kind(&self) -> &'static str {
        match self {
            Self::Codebase => "project",
            Self::Docs => "site",
        }
    }

    fn collection_dir(&self) -> &'static str {
        match self {
            Self::Codebase => "projects",
            Self::Docs => "sites",
        }
    }

    fn file_patterns(&self) -> &'static [&'static str] {
        match self {
            Self::Codebase => &["**/*.rs", "**/*.py", "**/*.md", "**/*.toml"],
            Self::Docs => &["**/*.md"],
        }
    }
}

#[derive(Clone, Debug)]
enum WorkloadProfile {
    Io,
    Cpu,
    Mixed,
}

#[derive(Clone, Copy, Debug)]
struct ProfileSettings {
    analysis_rounds: usize,
    shingle_span: usize,
    emit_file_reports: bool,
}

impl WorkloadProfile {
    fn parse(value: &str) -> cocoindex::Result<Self> {
        match value {
            "io" => Ok(Self::Io),
            "cpu" => Ok(Self::Cpu),
            "mixed" => Ok(Self::Mixed),
            _ => Err(engine_err(format!("unsupported profile `{value}`"))),
        }
    }

    fn as_str(&self) -> &'static str {
        match self {
            Self::Io => "io",
            Self::Cpu => "cpu",
            Self::Mixed => "mixed",
        }
    }

    fn settings(&self) -> ProfileSettings {
        match self {
            Self::Io => ProfileSettings {
                analysis_rounds: 1,
                shingle_span: 1,
                emit_file_reports: true,
            },
            Self::Cpu => ProfileSettings {
                analysis_rounds: 8,
                shingle_span: 4,
                emit_file_reports: false,
            },
            Self::Mixed => ProfileSettings {
                analysis_rounds: 2,
                shingle_span: 2,
                emit_file_reports: false,
            },
        }
    }
}

#[derive(Clone, Debug)]
struct Args {
    scenario: Scenario,
    profile: WorkloadProfile,
    dataset: PathBuf,
    state: PathBuf,
    output: PathBuf,
    metrics: PathBuf,
    phase: String,
}

#[derive(Clone, Debug)]
struct CollectionDir {
    name: String,
    path: PathBuf,
}

#[derive(Default)]
struct BenchMetrics {
    projects_seen: AtomicU64,
    files_seen: AtomicU64,
    sections_total: AtomicU64,
    batch_calls: AtomicU64,
    batch_items: AtomicU64,
}

#[derive(Clone, Debug, Default)]
struct OutputSyncStats {
    projects_rebuilt: u64,
    output_files_rebuilt: u64,
    output_file_count: u64,
    output_bytes: u64,
    output_hash: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct SectionInput {
    stable_id: String,
    file_path: String,
    language: String,
    heading: String,
    text: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct SectionAnalysis {
    stable_id: String,
    file_path: String,
    language: String,
    heading: String,
    token_count: u64,
    unique_tokens: u64,
    top_tokens: Vec<String>,
    sketch: Vec<u64>,
    signature: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct FileSummary {
    path: String,
    language: String,
    section_count: u64,
    top_tokens: Vec<String>,
    section_signatures: Vec<String>,
    feature_totals: Vec<u64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct CollectionSummary {
    kind: String,
    name: String,
    file_count: u64,
    section_count: u64,
    language_counts: BTreeMap<String, u64>,
    top_tokens: Vec<String>,
    feature_totals: Vec<u64>,
    files: Vec<FileSummary>,
}

#[cocoindex::function(memo)]
async fn extract_sections(
    _ctx: &Ctx,
    relative_path: &String,
    file: &FileEntry,
) -> cocoindex::Result<Vec<SectionInput>> {
    Ok(split_into_sections(&relative_path, &file.content_str()?))
}

// Per-section memoized analysis. Replaces the old `#[function(memo, batching)]`
// collection form (removed): each section is memoized individually, so unchanged
// sections are skipped on re-run. The analysis is CPU-bound, so per-section memo
// preserves the incremental-update measurement (cache hits/misses) without batch
// grouping. `batch_items` now counts cache misses (one body run per miss).
#[cocoindex::function(memo)]
async fn analyze_section_cached(
    ctx: &Ctx,
    section: SectionInput,
) -> cocoindex::Result<SectionAnalysis> {
    let metrics = ctx.get_or_err::<Arc<BenchMetrics>>()?.clone();
    let profile = ctx.get_or_err::<Arc<WorkloadProfile>>()?.clone();
    metrics.batch_calls.fetch_add(1, Ordering::Relaxed);
    metrics.batch_items.fetch_add(1, Ordering::Relaxed);
    Ok(analyze_section(section, profile.as_ref()))
}

#[cocoindex::function(memo)]
async fn summarize_collection_cached(
    _ctx: &Ctx,
    kind: &String,
    name: &String,
    analyses: &Vec<SectionAnalysis>,
) -> cocoindex::Result<CollectionSummary> {
    Ok(summarize_collection(&kind, &name, &analyses))
}

#[tokio::main]
async fn main() -> cocoindex::Result<()> {
    let args = parse_args()?;
    let metrics = Arc::new(BenchMetrics::default());
    let profile = Arc::new(args.profile.clone());
    let sync_stats = Arc::new(Mutex::new(None::<OutputSyncStats>));

    let app = Environment::builder()
        .db_path(&args.state)
        .provide(metrics.clone())
        .provide(profile.clone())
        .build()
        .await?
        .app(&format!(
            "benchmark_{}_{}",
            args.scenario.as_str(),
            args.profile.as_str()
        ))
        .await?;

    let dataset = args.dataset.clone();
    let output = args.output.clone();
    let scenario = args.scenario.clone();
    let sync_stats_ref = sync_stats.clone();
    let run_stats = app
        .run(move |ctx| async move {
            let collections = discover_collections(&dataset)?;
            let summaries: Vec<CollectionSummary> = ctx
                .mount_each(collections, |collection| collection.name.clone(), {
                    let scenario = scenario.clone();
                    move |project_ctx, collection| {
                        let scenario = scenario.clone();
                        async move { process_collection(&project_ctx, &scenario, collection).await }
                    }
                })
                .await?;

            let stats = sync_output_tree(&output, &scenario, profile.as_ref(), &summaries)?;
            let mut guard = sync_stats_ref
                .lock()
                .map_err(|err| engine_err(format!("failed to store sync stats: {err}")))?;
            *guard = Some(stats);
            Ok(())
        })
        .await?;

    let sync_stats = sync_stats
        .lock()
        .map_err(|err| engine_err(format!("failed to load sync stats: {err}")))?
        .take()
        .ok_or_else(|| engine_err("sync stats were not collected"))?;

    let sections_total = metrics.sections_total.load(Ordering::Relaxed);
    let batch_items = metrics.batch_items.load(Ordering::Relaxed);
    let summary = json!({
        "language": "rust",
        "scenario": args.scenario.as_str(),
        "profile": args.profile.as_str(),
        "phase": args.phase,
        "elapsed_ms": round_millis(run_stats.elapsed
```

### Core Architecture Module: `benchmarks/state_store/main.py`
```
"""
State-store benchmark pipeline.

Mounts N child components. Each runs a memoized function that declares M
target states against a no-op fake target — the engine still writes the
per-target tracking records into the state store (and runs the full
pre_commit / commit lifecycle), but the user-facing sink does nothing,
so we isolate cocoindex-side cost.

`M = 0` reproduces the original "component-path bookkeeping + memo only"
shape (no target-state traffic).

Environment knobs:
    BENCH_N — number of mounted child components (default 100).
    BENCH_M — number of target states declared per component (default 0).
"""

from __future__ import annotations

import os
from typing import Collection

import cocoindex as coco


_N: int = int(os.environ.get("BENCH_N", "100"))
_M: int = int(os.environ.get("BENCH_M", "0"))


class _NoopTargetHandler:
    """Target handler that drives the per-state tracking record through
    pre_commit + commit but does nothing user-visible. `desired_state` is
    `None` for upsert and `NonExistence` for delete; the sink is a no-op so
    we measure cocoindex's own per-target write path without external IO."""

    def __init__(self) -> None:
        self._sink: coco.TargetActionSink[tuple[coco.StableKey, bool]] = (
            coco.TargetActionSink.from_fn(self._apply)
        )

    @staticmethod
    def _apply(
        _ctx: coco.ContextProvider,
        _actions: Collection[tuple[coco.StableKey, bool]],
        /,
    ) -> None:
        return None

    def reconcile(
        self,
        key: coco.StableKey,
        desired_state: None | coco.NonExistenceType,
        _prev_records: Collection[None],
        _prev_may_be_missing: bool,
        /,
    ) -> coco.TargetReconcileOutput[tuple[coco.StableKey, bool], None] | None:
        is_delete = coco.is_non_existence(desired_state)
        tracking_record: None | coco.NonExistenceType = (
            coco.NON_EXISTENCE if is_delete else None
        )
        return coco.TargetReconcileOutput(
            action=(key, is_delete),
            sink=self._sink,
            tracking_record=tracking_record,
        )


_noop_provider = coco.register_root_target_states_provider(
    "cocoindex/bench/noop", _NoopTargetHandler()
)


@coco.fn(memo=True)
async def noop_component(idx: int) -> None:
    """Memoized component: declares _M no-op target states. Memo lets warm
    runs short-circuit recomputation; declared target states still flow
    through pre_commit / commit so the target-state write path is
    exercised."""
    for j in range(_M):
        coco.declare_target_state(_noop_provider.target_state(f"{idx}-{j}", None))


@coco.fn
async def app_main() -> None:
    items = [(str(i), i) for i in range(_N)]
    await coco.mount_each(noop_component, items)


app = coco.App("StateStoreBench", app_main)

```

### Core Architecture Module: `benchmarks/state_store/runner.py`
```
"""
State-store benchmark runner.

For each (N, M) cell, runs three phases via the cocoindex CLI against a
fresh LMDB state store in a temp directory:

    cold   — fresh state, first `cocoindex update` (creates app + memo entries)
    warm   — second `cocoindex update` against the populated state (all memo hits)
    drop   — `cocoindex drop -f` on the populated state (cascade + clear)

Times are wall-clock from subprocess.run, matching what the user observes.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path


BENCH_DIR = Path(__file__).resolve().parent
MAIN_PY = BENCH_DIR / "main.py"

DEFAULT_NS = (100, 1_000, 10_000)


@dataclass
class CellResult:
    n: int
    m: int
    cold_s: float
    warm_s: float
    drop_s: float


def _run(cmd: list[str], env: dict[str, str], cwd: Path) -> float:
    """Run a subprocess to completion and return its wall-clock seconds."""
    t = time.perf_counter()
    proc = subprocess.run(cmd, env=env, cwd=cwd, capture_output=True, text=True)
    elapsed = time.perf_counter() - t
    if proc.returncode != 0:
        print(f"  ! {' '.join(cmd)} failed (rc={proc.returncode})", file=sys.stderr)
        if proc.stdout:
            print(proc.stdout, file=sys.stderr)
        if proc.stderr:
            print(proc.stderr, file=sys.stderr)
        raise RuntimeError(f"{cmd[0]} failed")
    return elapsed


_COCOINDEX_CMD = [sys.executable, "-m", "cocoindex.cli"]


def _cell(n: int, m: int) -> CellResult:
    update_cmd = [*_COCOINDEX_CMD, "update", str(MAIN_PY)]
    drop_cmd = [*_COCOINDEX_CMD, "drop", "-f", str(MAIN_PY)]
    with tempfile.TemporaryDirectory(prefix="coco-bench-lmdb-") as tmp:
        env = {
            **os.environ,
            "COCOINDEX_DB": str(Path(tmp) / "db"),
            "BENCH_N": str(n),
            "BENCH_M": str(m),
        }
        cold = _run(update_cmd, env, BENCH_DIR)
        warm = _run(update_cmd, env, BENCH_DIR)
        drop = _run(drop_cmd, env, BENCH_DIR)
    return CellResult(n=n, m=m, cold_s=cold, warm_s=warm, drop_s=drop)


def _print_table(results: list[CellResult]) -> None:
    hdr = f"{'N':>8}  {'M':>4}  {'cold':>8}  {'warm':>8}  {'drop':>8}"
    print(hdr)
    print("-" * len(hdr))
    for r in sorted(results, key=lambda r: (r.n, r.m)):
        print(
            f"{r.n:>8}  {r.m:>4}  {r.cold_s:>8.3f}  {r.warm_s:>8.3f}  {r.drop_s:>8.3f}"
        )
    print()
    print("All numbers in seconds. Lower is better.")


def _print_json(results: list[CellResult]) -> None:
    print(
        json.dumps(
            [
                {
                    "n": r.n,
                    "m": r.m,
                    "cold_s": r.cold_s,
                    "warm_s": r.warm_s,
                    "drop_s": r.drop_s,
                }
                for r in results
            ],
            indent=2,
        )
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--n",
        default=",".join(str(n) for n in DEFAULT_NS),
        help=f"Comma-separated list of component counts. Default: {','.join(str(n) for n in DEFAULT_NS)}",
    )
    parser.add_argument(
        "--m",
        default="0",
        help=(
            "Comma-separated list of per-component target-state counts. "
            "Default: 0 (no target states). Each non-zero M exercises the "
            "target-state write path on every component."
        ),
    )
    parser.add_argument(
        "--format",
        choices=("table", "json"),
        default="table",
    )
    args = parser.parse_args()

    ns = [int(s) for s in args.n.split(",") if s.strip()]
    ms = [int(s) for s in args.m.split(",") if s.strip()]

    results: list[CellResult] = []
    for n in ns:
        for m in ms:
            label = f"N={n}/M={m}"
            print(f"running {label} …", flush=True)
            try:
                r = _cell(n, m)
            except Exception as exc:
                print(f"  ! {label} failed: {exc}", file=sys.stderr)
                continue
            print(
                f"  cold {r.cold_s:.3f}s   warm {r.warm_s:.3f}s   drop {r.drop_s:.3f}s",
                flush=True,
            )
            results.append(r)

    print()
    if args.format == "json":
        _print_json(results)
    else:
        _print_table(results)
    return 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `examples/amazon_s3_embedding/main.py`
```
"""
Amazon S3 Text Embedding (v1) - CocoIndex pipeline example.

Index (one-shot catch-up; live mode is not supported for the amazon_s3 source):
    cocoindex update main

Query the index:
    python main.py "your query"

Pipeline: list markdown files from S3 -> chunk -> embed -> store in pgvector.
"""

from __future__ import annotations

import asyncio
import os
import sys
from dataclasses import dataclass
from dotenv import load_dotenv
from typing import AsyncIterator, Annotated

import aiobotocore.session
import asyncpg
from aiobotocore.client import AioBaseClient
from numpy.typing import NDArray
from pgvector.asyncpg import register_vector

import cocoindex as coco
from cocoindex.connectors import amazon_s3, postgres
from cocoindex.ops.sentence_transformers import SentenceTransformerEmbedder
from cocoindex.ops.text import RecursiveSplitter
from cocoindex.resources.chunk import Chunk
from cocoindex.resources.file import PatternFilePathMatcher
from cocoindex.resources.id import IdGenerator


DATABASE_URL = os.getenv(
    "POSTGRES_URL", "postgres://cocoindex:cocoindex@localhost/cocoindex"
)
TABLE_NAME = "amazon_s3_doc_embeddings"
PG_SCHEMA_NAME = "coco_examples"
TOP_K = 5

# S3 configuration
S3_BUCKET = os.environ["S3_BUCKET"]
S3_PREFIX = os.getenv("S3_PREFIX", "")

EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
PG_DB = coco.ContextKey[asyncpg.Pool]("s3_embedding_db")
S3_CLIENT = coco.ContextKey[AioBaseClient]("s3_client")
EMBEDDER = coco.ContextKey[SentenceTransformerEmbedder]("embedder", detect_change=True)

_splitter = RecursiveSplitter()


@coco.lifespan
async def coco_lifespan(
    builder: coco.EnvironmentBuilder,
) -> AsyncIterator[None]:
    async with asyncpg.create_pool(DATABASE_URL) as pool:
        builder.provide(PG_DB, pool)
        builder.provide(EMBEDDER, SentenceTransformerEmbedder(EMBED_MODEL))

        # Set AWS_ENDPOINT_URL for S3-compatible services (e.g. MinIO).
        session = aiobotocore.session.get_session()
        async with session.create_client("s3") as s3_client:
            builder.provide(S3_CLIENT, s3_client)
            yield


@dataclass
class DocEmbedding:
    id: int
    filename: str
    chunk_start: int
    chunk_end: int
    text: str
    embedding: Annotated[NDArray, EMBEDDER]


@coco.fn
async def process_chunk(
    chunk: Chunk,
    filename: str,
    id_gen: IdGenerator,
    table: postgres.TableTarget[DocEmbedding],
) -> None:
    table.declare_row(
        row=DocEmbedding(
            id=await id_gen.next_id(chunk.text),
            filename=filename,
            chunk_start=chunk.start.char_offset,
            chunk_end=chunk.end.char_offset,
            text=chunk.text,
            embedding=await coco.use_context(EMBEDDER).embed(chunk.text),
        ),
    )


@coco.fn(memo=True)
async def process_file(
    file: amazon_s3.S3File,
    table: postgres.TableTarget[DocEmbedding],
) -> None:
    text = await file.read_text()
    chunks = _splitter.split(
        text, chunk_size=2000, chunk_overlap=500, language="markdown"
    )
    id_gen = IdGenerator()
    await coco.map(process_chunk, chunks, file.file_path.path.as_posix(), id_gen, table)


@coco.fn
async def app_main() -> None:
    target_table = await postgres.mount_table_target(
        PG_DB,
        table_name=TABLE_NAME,
        table_schema=await postgres.TableSchema.from_class(
            DocEmbedding,
            primary_key=["id"],
        ),
        pg_schema_name=PG_SCHEMA_NAME,
    )

    client = coco.use_context(S3_CLIENT)
    files = amazon_s3.list_objects(
        client,
        S3_BUCKET,
        prefix=S3_PREFIX,
        path_matcher=PatternFilePathMatcher(included_patterns=["**/*.md"]),
    )
    await coco.mount_each(process_file, files.items(), target_table)


app = coco.App(
    coco.AppConfig(name="AmazonS3EmbeddingV1"),
    app_main,
)


async def query_once(
    pool: asyncpg.Pool,
    embedder: SentenceTransformerEmbedder,
    query: str,
    *,
    top_k: int = TOP_K,
) -> None:
    query_vec = await embedder.embed(query)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""
            SELECT
                filename,
                text,
                embedding <=> $1 AS distance
            FROM "{PG_SCHEMA_NAME}"."{TABLE_NAME}"
            ORDER BY distance ASC
            LIMIT $2
            """,
            query_vec,
            top_k,
        )

    for r in rows:
        score = 1.0 - float(r["distance"])
        print(f"[{score:.3f}] {r['filename']}")
        print(f"    {r['text']}")
        print("---")


async def query(initial_query: str | None = None) -> None:
    embedder = SentenceTransformerEmbedder(EMBED_MODEL)
    async with asyncpg.create_pool(DATABASE_URL, init=register_vector) as pool:
        if initial_query is not None:
            await query_once(pool, embedder, initial_query)
            return

        while True:
            q = input("Enter search query (or Enter to quit): ").strip()
            if not q:
                break
            await query_once(pool, embedder, q)


if __name__ == "__main__":
    load_dotenv()
    initial = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else None
    asyncio.run(query(initial))

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1685** (2026-04-25): **[BUG] `test_cli.py::TestShowTree` is flaky: Fatal Python error: PyGILState_Release**
  *Symptoms*: The test `python/tests/cli/test_cli.py::TestShowTree::test_show_tree_with_nested_structure` is flaky. It fails non-deterministically on GitHub runner. It happened twice today, both on Ubuntu-24.04-arm on Python 3.11.  - [Failure 1](https://github.com/cocoindex-io/cocoindex/actions/runs/22194484188/job/64191068207?pr=1682)  - [Failure 2](https://github.com/cocoindex-io/cocoindex/actions/runs/22201218344/job/64214333830?pr=1684)  The first failure has more information in output:  ```   FAILED python/tests/cli/test_cli.py::TestShowTree::test_show_tree_with_nested_structure - AssertionError: Command failed: ['cocoindex', 'show', './tree_test_app.py', '--tree']   returncode=-6   stdout:   Found 6 stable paths:   / [component]   ├── direct [component]   ├── files   │   ├── file1.txt [component]   │   └── file2.txt [component]   └── setup [component]    stderr:   Fatal Python error: PyGILState_Release: thread state 0xff171c001d00 must be current when releasing   Python runtime state: finalizing (tstate=0x0000ff184ea06480)    Thread 0x0000ff184ea7a020 (most recent call first):     <no Python frame>    Extension modules: numpy._core._multiarray_umath, numpy.linalg._umath_linalg (total: 2) ```  The message "Fatal Python error: PyGILState_Release: thread state 0xff171c001d00 must be current when releasing" suggests somewhere we're trying to release GIL when we don't have it? Maybe some race conditions?  After retries, both succeeded.   
  **Post-Mortem & Fix Analysis**:
  > @shannon06437 , do you want to have a look? Please let me know if you're stuck. Thanks!
  > I'll take a look!
  > Hi @shannon06437, the flakiness problem comes back: https://github.com/cocoindex-io/cocoindex/actions/runs/22366810229/job/64734899559  Would you have a look? Thanks!    

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

### Incident Patch 1: `bdd3ee92` (2026-09-30)
**Commit Message**: fix(agents): keep the docs build check from rewriting package-lock.json (#2444)

dev/agent-checks/docs-build-run.sh, which the Claude Code Stop hook runs
after any docs/ edit, installed with `npm i`. `npm i` re-serializes
docs/package-lock.json in the local npm's format, so the check rewrote the
lockfile whenever the local npm differed from the one that generated it:
with npm 10.9.8, one run strips all 16 `libc` fields from the sharp/libvips
platform packages. Every docs-editing agent session ended with an unrelated
lockfile diff that `git commit -a` or `git add -A` would sweep in.

Install with `npm ci` instead. It never writes the lockfile, installs exactly
what it pins, and fails if it disagrees with package.json -- the same install
the docs CI workflow runs. `npm ci` wipes node_modules first, so the check
runs it only when npm's hidden lockfile (node_modules/.package-lock.json,
written by every successful install) is missing or older than package.json
or package-lock.json, and otherwise goes straight to the build. Audit is off
because its report tells the reader to run `npm audit fix`, which rewrites
the lockfile too.

Also fix the Stop hook's stale "run yarn build" comment.

C

**File**: `.claude/hooks/docs-build-run.sh` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 #!/bin/bash
-# Stop hook: if docs/ files were changed during this turn, run yarn build.
+# Stop hook: if docs/ files were changed during this turn, run the docs build check.
 
 FLAG="$CLAUDE_PROJECT_DIR/.claude/hooks/.docs-changed"
 
```

**File**: `dev/agent-checks/docs-build-run.sh` (modified, +12/-1)
```diff
@@ -7,5 +7,16 @@ SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
 REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
 
 cd "${REPO_ROOT}/docs"
-npm i 2>&1
+# `npm ci`, not `npm i`: `npm i` re-serializes package-lock.json, which rewrites
+# it whenever the local npm differs from the one that generated it. `npm ci`
+# never writes the lockfile and fails if it disagrees with package.json. It also
+# wipes node_modules, so skip it while npm's hidden lockfile (written by every
+# install) is newer than both package.json and package-lock.json.
+HIDDEN_LOCKFILE=node_modules/.package-lock.json
+if [ ! -f "${HIDDEN_LOCKFILE}" ] ||
+  [ package.json -nt "${HIDDEN_LOCKFILE}" ] ||
+  [ package-lock.json -nt "${HIDDEN_LOCKFILE}" ]; then
+  # No audit: its report says to run `npm audit fix`, which rewrites the lockfile.
+  npm ci --no-audit --no-fund 2>&1
+fi
 npm run build 2>&1
```

---

### Incident Patch 2: `1bbd4773` (2026-09-30)
**Commit Message**: fix(amazon_s3): handle zero-length range reads (#2437)

Co-authored-by: Sujit <sujit@example.com>

**File**: `python/cocoindex/connectors/amazon_s3/_source.py` (modified, +3/-0)
```diff
@@ -130,6 +130,9 @@ async def _fetch_metadata(self) -> file.FileMetadata:
 
     async def _read_impl(self, size: int = -1) -> bytes:
         """Asynchronously read file content from S3."""
+        if size == 0 or (size > 0 and await self.size() == 0):
+            return b""
+
         bucket_name: str = self._file_path.bucket_name
         object_key: str = self._file_path.resolve()
         if size >= 0:
```

**File**: `python/tests/connectors/test_amazon_s3.py` (modified, +18/-0)
```diff
@@ -183,6 +183,24 @@ async def test_read(self, s3_client: tuple[Any, str]) -> None:
         f = await amazon_s3.get_object(client, bucket_name, "data/nested.json")
         assert await f.read() == b'{"key": "value"}'
 
+    async def test_partial_read_zero_bytes(self, s3_client: tuple[Any, str]) -> None:
+        client, bucket_name = s3_client
+        f = await amazon_s3.get_object(client, bucket_name, "file1.txt")
+
+        assert await f.read(0) == b""
+        assert await f.read(2) == b"he"
+        assert await f.read() == b"hello"
+
+    async def test_partial_read_empty_object(self, s3_client: tuple[Any, str]) -> None:
+        client, bucket_name = s3_client
+        boto3.client("s3", region_name="us-east-1").put_object(
+            Bucket=bucket_name, Key="empty.bin", Body=b""
+        )
+        f = await amazon_s3.get_object(client, bucket_name, "empty.bin")
+
+        assert await f.read(2) == b""
+        assert await f.read() == b""
+
     async def test_read_text(self, s3_client: tuple[Any, str]) -> None:
         """await read_text() returns file content as text."""
         client, bucket_name = s3_client
```

---

### Incident Patch 3: `ebd91291` (2026-09-29)
**Commit Message**: fix(surrealdb): surface statement errors, typed CBOR values, array IDs, MERGE ownership, fields mode (#2439)

- Raise on any statement error in a batch (was silently swallowed by query())
- Send values as typed CBOR parameters (datetime, date, Decimal, UUID, bytes,
  timedelta, lists, dicts, numpy); run column encoders exactly once
- String, integer and array record IDs; relation endpoints likewise
- Record writes use UPSERT ... MERGE (never CONTENT); fields no longer declared
  are unset; add TableTarget.declare_fields for multi-owner records
- Bounded transactions (500 actions), retry on transaction conflict
- Reuse one connection per ConnectionFactory and event loop
- Vector index: HNSW only (MTREE was removed in SurrealDB 3), attachments()
- Idempotent DDL (DEFINE ... OVERWRITE)

**File**: `docs/src/content/docs/connectors/surrealdb.mdx` (modified, +26/-6)
```diff
@@ -3,8 +3,8 @@ title: "*SurrealDB* connector"
 toc_max_heading_level: 4
 description: >
   Write to SurrealDB with support for normal and relation (graph edge) tables,
-  atomic cross-table transactions, and vector indexes with cosine / euclidean /
-  manhattan distances over mtree or hnsw methods.
+  typed values, array record IDs, bounded transactions, and HNSW vector indexes
+  with cosine / euclidean / manhattan distances.
 ---
 The `surrealdb` connector provides utilities for writing records to SurrealDB databases, with support for normal tables, relation (graph edge) tables, optional schema enforcement, and vector indexes.
 
@@ -23,7 +23,7 @@ pip install cocoindex[surrealdb]
 
 ## Connection setup
 
-Create a `ConnectionFactory` and provide it via a `ContextKey`. It holds connection parameters and creates authenticated connections on demand.
+Create a `ConnectionFactory` and provide it via a `ContextKey`. It holds connection parameters and opens one authenticated connection per event loop, shared by all tables and batches. Call `await factory.close()` at shutdown to close it.
 
 :::note
 The key name is load-bearing across runs — it's the stable identity CocoIndex uses to track managed rows. See [ContextKey as stable identity](../programming_guide/context#contextkey-as-stable-identity) before renaming.
@@ -53,7 +53,15 @@ def coco_lifespan(builder: coco.EnvironmentBuilder) -> Iterator[None]:
 
 The `surrealdb` connector provides target state APIs for writing records to normal tables and relation tables. CocoIndex tracks what records should exist and automatically handles upserts and deletions.
 
-All tables within the same database share a single transaction sink, so changes across related tables and relations are applied atomically.
+Writes are sent as typed parameters (`datetime`, `date`, `Decimal`, `UUID`, `bytes`, `timedelta`, lists and dicts arrive as native SurrealDB types, not strings).
+
+**Transactions and errors.** The changes of each table are applied in chunks of at most 500 actions, each chunk one transaction (`Transaction conflict` errors are retried with backoff). Atomicity is per chunk, not across tables. Any statement error rolls the chunk back and raises, so the update fails and the affected components are retried on the next run.
+
+**Record IDs** may be a string, an integer, or a tuple/list, which becomes an array ID (`person:['sap', '0001']`). Relation endpoints (`from_id`, `to_id`) take the same forms.
+
+**Ownership.** `declare_record` writes with `UPSERT ... MERGE`, never `CONTENT`: fields written by other owners survive, and fields you stop declaring are unset. Use `declare_fields` when a pipeline contributes only some fields of a record that another pipeline owns. Relation records are single-owner and are replaced whole.
+
+**DDL.** Table and field definitions use `OVERWRITE`, so they are idempotent. With `managed_by="user"` CocoIndex never runs DDL on tables (indexes declared with `declare_vector_index` are still created).
 
 ### Declaring target states
 
@@ -98,6 +106,18 @@ def TableTarget.declare_record(
 
 `declare_row` is an alias for `declare_record`, for compatibility with Postgres and other RDBMS targets.
 
+```python
+def TableTarget.declare_fields(
+    self,
+    *,
+    id: Any,
+    group: str,
+    fields: dict[str, Any],
+) -> None
+```
+
+Declares the fields one owner (`group`) contributes to a record. It runs `UPDATE $id MERGE {fields}` and touches nothing else. When the declaration goes away, or a field is dropped from it, those fields are unset. If the record does not exist, the write raises and is retried on the next run, so declare the base record in the same or another pipeline.
+
 #### Relation tables (parent state)
 
 Declares a relation (graph edge) table. Returns a `RelationTarget` for declaring relation records.
@@ -159,7 +179,7 @@ def TableTarget.declare_vector_index(
     name: str | None = None,
     field: str,
     metric: Literal["cosine", "euclidean", "manhattan
```

**File**: `python/cocoindex/connectors/surrealdb/_target.py` (modified, +336/-150)
```diff
@@ -5,15 +5,19 @@
 1. Table level: Creates/drops tables in the database (DEFINE TABLE / REMOVE TABLE)
 2. Record level: Upserts/deletes records within tables (UPSERT / DELETE / RELATE)
 
+Record-level writes send every value as a typed CBOR parameter, raise on any
+statement error, and run in bounded transactions (see ``_SharedRecordApplier``).
+
 Supports both normal tables and relation (graph edge) tables, with optional
 schema enforcement (SCHEMAFULL/SCHEMALESS) and vector index support.
 """
 
 from __future__ import annotations
 
+import asyncio
 import datetime
 import decimal
-import json
+import random
 import re
 import uuid
 from dataclasses import dataclass
@@ -42,21 +46,22 @@
 if TYPE_CHECKING:
     # surrealdb is untyped; use Any so mypy doesn't complain about attribute access.
     AsyncSurreal = Any
+    RecordID = Any
 else:
     AsyncSurreal = _surrealdb.AsyncSurreal
+    RecordID = _surrealdb.RecordID
 
 import numpy as np
+from surrealdb.cbor import CBORTag as _CBORTag  # type: ignore[import-untyped]
 
 import cocoindex as coco
 from cocoindex.connectorkits import statediff, target
 from cocoindex.connectorkits.fingerprint import fingerprint_object
 from cocoindex._internal.datatype import (
-    AnyType,
     MappingType,
     SequenceType,
     RecordType,
     TypeChecker,
-    UnionType,
     analyze_type_info,
     is_record_type,
 )
@@ -84,18 +89,11 @@ def _validate_identifier(name: str, kind: str) -> None:
         )
 
 
-def _format_record_id(value: Any) -> str:
-    """Format a record ID for inline use in SurrealQL, preserving type.
-
-    * ``int`` / ``float`` → bare numeric literal (``123``, ``3.14``)
-    * ``str`` (and everything else) → backtick-quoted with ``\\`` and
-      backtick escaping (`` `alice` ``, `` `has\\`tick` ``)
-    """
-    if isinstance(value, (int, float)):
-        return str(value)
-    s = str(value)
-    s = s.replace("\\", "\\\\").replace("`", "\\`")
-    return f"`{s}`"
+def _to_record_id(table: str, value: Any) -> Any:
+    """Build a typed record ID. A tuple / list ID becomes an array ID (``t:['a', 1]``)."""
+    if isinstance(value, (tuple, list)):
+        value = [_sanitize(v) for v in value]
+    return RecordID(table, value)
 
 
 # ---------------------------------------------------------------------------
@@ -132,31 +130,64 @@ def __init__(
         self._namespace = namespace
         self._database = database
         self._credentials = credentials
+        self._conn: AsyncSurreal | None = None
+        self._conn_loop: asyncio.AbstractEventLoop | None = None
 
     async def acquire(self) -> AsyncSurreal:
-        """Create a new authenticated connection on the current event loop."""
+        """Return the authenticated connection for the current event loop.
+
+        The connection is opened once and reused by every table and batch (a
+        SurrealDB WebSocket multiplexes concurrent requests). A new one is opened
+        if the event loop changed, e.g. between ``update_blocking()`` calls.
+        """
+        # ponytail: one shared connection per factory; add a pool if a single
+        # WebSocket becomes the throughput limit.
+        loop = asyncio.get_running_loop()
+        if self._conn is not None and self._conn_loop is loop:
+            return self._conn
         conn = AsyncSurreal(self._url)
         await conn.connect()  # type: ignore[call-arg]
         if self._credentials:
             await conn.signin(self._credentials)  # type: ignore[arg-type]
         await conn.use(self._namespace, self._database)
+        self._conn, self._conn_loop = conn, loop
         return conn
 
+    async def close(self) -> None:
+        """Close the cached connection, if any."""
+        conn, self._conn, self._conn_loop = self._conn, None, None
+        if conn is not None:
+            await conn.close()
+
 
 # ---------------------------------------------------------------------------
 # Type aliases
 # ----------------------------------------------
```

**File**: `python/tests/connectors/test_surrealdb_target.py` (modified, +306/-23)
```diff
@@ -14,6 +14,7 @@
 from numpy.typing import NDArray
 
 import cocoindex as coco
+from cocoindex.connectorkits.target import ManagedBy
 from cocoindex.resources.schema import VectorSchema
 
 from tests import common
@@ -26,7 +27,7 @@
 # =============================================================================
 
 try:
-    from surrealdb import AsyncSurreal  # type: ignore[import-untyped]
+    from surrealdb import AsyncSurreal, RecordID  # type: ignore[import-untyped]
 
     HAS_SURREALDB = True
 except ImportError:
@@ -41,7 +42,7 @@
 if HAS_SURREALDB:
     from cocoindex.connectors import surrealdb  # type: ignore[attr-defined]
     from cocoindex.connectors.surrealdb._target import (  # type: ignore[import-untyped]
-        _format_record_id,
+        _to_record_id,
         _validate_identifier,
     )
 
@@ -80,30 +81,20 @@ def test_invalid_identifiers(self, name: str) -> None:
 
 
 @requires_surrealdb
-class TestFormatRecordId:
-    """Tests for _format_record_id()."""
+class TestToRecordId:
+    """Tests for _to_record_id(): IDs stay typed, nothing is string-formatted."""
 
-    def test_string_simple(self) -> None:
-        assert _format_record_id("alice") == "`alice`"
+    def test_string(self) -> None:
+        assert _to_record_id("t", "alice") == RecordID("t", "alice")
 
-    def test_string_with_backtick(self) -> None:
-        assert _format_record_id("has`tick") == r"`has\`tick`"
+    def test_int_and_numeric_string_stay_distinct(self) -> None:
+        assert _to_record_id("t", 123) != _to_record_id("t", "123")
 
-    def test_string_with_backslash(self) -> None:
-        assert _format_record_id(r"back\slash") == r"`back\\slash`"
+    def test_tuple_becomes_array_id(self) -> None:
+        assert _to_record_id("t", ("sap", 1)) == RecordID("t", ["sap", 1])
 
-    def test_int(self) -> None:
-        assert _format_record_id(42) == "42"
-
-    def test_float(self) -> None:
-        assert _format_record_id(3.14) == "3.14"
-
-    def test_string_numeric_stays_quoted(self) -> None:
-        # string "123" must remain distinct from int 123
-        assert _format_record_id("123") == "`123`"
-
-    def test_string_empty(self) -> None:
-        assert _format_record_id("") == "``"
+    def test_awkward_string(self) -> None:
+        assert _to_record_id("t", "a`b\\c").id == "a`b\\c"
 
 
 @requires_surrealdb
@@ -366,7 +357,6 @@ async def declare_schemaless_rows() -> None:
 
 async def declare_nothing() -> None:
     """Declare nothing — used to test table cleanup."""
-    pass
 
 
 # =============================================================================
@@ -1960,3 +1950,296 @@ async def declare_types_table() -> None:
     assert row["count"] == 42
     assert abs(row["score"] - 3.14) < 0.01
     assert row["label"] == "hello"
+
+
+# =============================================================================
+# Hardened target: errors surface, typed values, array IDs, fields mode, txns
+# =============================================================================
+
+
+def _hardened_app(
+    ns: str,
+    db: str,
+    table_name: str,
+    declare: Any,
+    *,
+    schema: Any = None,
+) -> Any:
+    """App over a user-managed table (the platform owns DDL); ``declare(table)`` fills it."""
+    coco_env.context_provider.provide(
+        SURREAL_DB_KEY,
+        surrealdb.ConnectionFactory(
+            url=_SURREALDB_URL,
+            namespace=ns,
+            database=db,
+            credentials={"username": _SURREALDB_USER, "password": _SURREALDB_PASS}
+            if _SURREALDB_USER
+            else None,
+        ),
+    )
+
+    async def main() -> None:
+        table = await coco.use_mount(  # type: ignore[call-overload]
+            coco.component_subpath("setup", "table"),
+            surrealdb.mount_table_target,
+            SURREAL_DB_KEY,
+            table_name,
+            schema,
+            managed_by=ManagedBy.USER,
+        )
+        declare(table)
+
+    return coco.App(
+     
```

---

### Incident Patch 4: `f1c1ba4a` (2026-09-24)
**Commit Message**: fix(valkey): purge document hashes when an index is deleted (#2419)

The index sink dropped the index on "delete" but only purged the
`{index_name}:` document hashes on "replace". Documents are child target
states of the index, and the engine does not reconcile children once
their container is reconciled to non-existence, so un-declaring an index
or running `App.drop()` left every document hash behind.

Purge the prefix keys on "delete" as well, and cover both un-declaring
the index and `App.drop()` in the connector tests.

Co-authored-by: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `python/cocoindex/connectors/valkey/_target.py` (modified, +6/-4)
```diff
@@ -405,16 +405,18 @@ async def _apply_actions(
                 action = actions[i]
 
                 if action.main_action in ("replace", "delete"):
-                    # Drop the index first; on "replace" we also purge all
-                    # prefixed document keys before re-creating the index.
+                    # Drop the index, then purge the document hashes under its
+                    # prefix. Once the index is reconciled away the engine no
+                    # longer reconciles its documents, so this action owns
+                    # their removal; on "replace" the index is re-created
+                    # below and the documents are re-declared from scratch.
                     try:
                         await ft.dropindex(client, key.index_name)
                     except RequestError:
                         # Index was already removed externally — nothing to do.
                         logger.debug("dropindex %s: index not found", key.index_name)
 
-                    if action.main_action == "replace":
-                        await self._delete_prefix_keys(client, key.index_name)
+                    await self._delete_prefix_keys(client, key.index_name)
 
                 if coco.is_non_existence(action.spec):
                     continue
```

**File**: `python/tests/connectors/test_valkey_target.py` (modified, +59/-9)
```diff
@@ -75,6 +75,12 @@ def _decode_vector(blob: bytes, dim: int) -> list[float]:
     return list(struct.unpack(f"<{dim}f", blob))
 
 
+async def _index_names(client: Any) -> set[str]:
+    """Return the names of all search indexes on the server."""
+    names = await glide_ft.list(client)
+    return {n.decode() if isinstance(n, bytes) else n for n in names}
+
+
 async def _wait_for_index_count(
     client: Any,
     index_name: str,
@@ -662,7 +668,7 @@ async def declare_fn() -> None:
 @requires_server
 @pytest.mark.asyncio
 async def test_drop_index_when_not_declared(valkey_env: _ValkeyEnv) -> None:
-    """Test that index is dropped when no longer declared."""
+    """Un-declaring the index drops it together with its document hashes."""
     index_name = _unique_name("test_drop")
     source_docs: list[valkey.Document] = []
     declare_index = True
@@ -687,21 +693,65 @@ async def declare_fn() -> None:
         declare_fn,
     )
 
-    source_docs.append(valkey.Document(id="d1", vector=_make_vector(_DIM, 1.0)))
+    source_docs.extend(
+        [
+            valkey.Document(id="d1", vector=_make_vector(_DIM, 1.0)),
+            valkey.Document(id="d2", vector=_make_vector(_DIM, 2.0)),
+        ]
+    )
     await app.update()
 
-    info = await glide_ft.info(valkey_env.client, index_name)
-    assert info is not None
+    client = valkey_env.client
+    hash_keys = [f"{index_name}:d1", f"{index_name}:d2"]
+    assert index_name in await _index_names(client)
+    assert await client.exists(hash_keys) == 2
 
     declare_index = False
     source_docs.clear()
     await app.update()
 
-    try:
-        await glide_ft.info(valkey_env.client, index_name)
-        pytest.fail("Index should have been dropped")
-    except Exception:
-        pass
+    assert index_name not in await _index_names(client)
+    assert await client.exists(hash_keys) == 0
+
+
+@requires_glide
+@requires_server
+@pytest.mark.asyncio
+async def test_app_drop_removes_index_and_documents(valkey_env: _ValkeyEnv) -> None:
+    """``App.drop()`` removes the index together with its document hashes."""
+    index_name = _unique_name("test_app_drop")
+
+    async def declare_fn() -> None:
+        index = await coco.use_mount(
+            coco.component_subpath("setup", "index"),
+            valkey.declare_index_target,
+            _VALKEY_DB_KEY,
+            index_name,
+            await valkey.IndexSchema.create(
+                vectors=valkey.VectorDef(schema=_VECTOR_SCHEMA, distance="cosine"),
+            ),
+        )
+        for doc in (
+            valkey.Document(id="d1", vector=_make_vector(_DIM, 1.0)),
+            valkey.Document(id="d2", vector=_make_vector(_DIM, 2.0)),
+        ):
+            index.declare_document(doc)
+
+    app = coco.App(
+        coco.AppConfig(name="test_app_drop", environment=valkey_env.coco_env),
+        declare_fn,
+    )
+    await app.update()
+
+    client = valkey_env.client
+    hash_keys = [f"{index_name}:d1", f"{index_name}:d2"]
+    assert index_name in await _index_names(client)
+    assert await client.exists(hash_keys) == 2
+
+    await app.drop()
+
+    assert index_name not in await _index_names(client)
+    assert await client.exists(hash_keys) == 0
 
 
 @requires_glide
```

---

### Incident Patch 5: `b7e1f596` (2026-09-20)
**Commit Message**: fix(state_store): keep each LMDB write txn on one OS thread (#2426)

LMDB ties a write transaction to the OS thread that began it: on Linux the
writer lock is a thread-owned robust pthread mutex, and LMDB ignores a
failed unlock. `TxnRunner` opened the write txn and then awaited the batched
bodies inside a task on the multi-thread runtime, so a body that really
suspended could let work-stealing resume the task on another worker. The
commit then released the lock from the wrong thread, the release failed
silently, and every later write txn blocked forever (#2424). heed marks
`RwTxn` as `Send`, so the compiler doesn't catch it (meilisearch/heed#339).

Run the whole batch - opening the txn, every body, the MDB_MAP_FULL retry
loop, and the commit or abort - inside one `spawn_blocking` closure, with
`Handle::block_on` polling the bodies on that thread. This also moves the
blocking writer-lock wait and the commit fsync off the runtime workers.

`TxnBody` no longer needs `Sync`: that was only required because the old
future held `&[TxnBody]` across awaits and had to be `Send`.

Fixes #2424

Co-authored-by: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `AGENTS.md` (modified, +1/-0)
```diff
@@ -300,6 +300,7 @@ async def pool(pg_dsn: str) -> Any:
 - All LMDB writes must go through `Storage::run_txn` (uses the single-writer batcher).
 - Do not open a heed write txn directly or wrap the env in a separate mutex/semaphore — bypassing the batcher loses fsync coalescing and regresses concurrent-submit throughput by 10-100×.
 - LMDB has no savepoints. If a sub-operation needs to "abort," handle it at the body level (e.g. return a sentinel result without writing); never attempt per-body rollback inside the batcher.
+- An LMDB write txn must begin and end (commit or abort) on the same OS thread: the writer lock is thread-owned and LMDB ignores a failed release, so a txn that migrates between runtime workers blocks every later writer for good. heed marks `RwTxn` as `Send` regardless, so the compiler won't catch it. `Storage::run_txn` runs each batch on one blocking thread for this reason; never hold a write txn across an `.await` on the multi-thread runtime.
 
 ### Sync vs Async
 
```

**File**: `rust/core/src/state_store/storage.rs` (modified, +99/-15)
```diff
@@ -129,20 +129,16 @@ struct StorageInner {
 /// future that runs against the shared `WriteTxn` and resolves to a boxed
 /// output. The future is bound to the borrow of the txn (`'a`).
 ///
-/// `Fn + Sync` (not `FnOnce`) so the batcher can retry the entire batch on
+/// `Fn` (not `FnOnce`) so the batcher can retry the entire batch on
 /// `MDB_MAP_FULL`: the env is resized between attempts, then every body is
 /// called again with a fresh write transaction. Callers must therefore
 /// ensure their closures are side-effect–free on the captured state (i.e.
 /// they may be invoked more than once). In practice all callers clone `Arc`
 /// handles inside the closure and do not move-out of captures, so this is
 /// already satisfied.
-///
-/// `Sync` is required because `try_run_once` holds `&[TxnBody]` across
-/// `await` points; for `&T` to be `Send`, `T` must be `Sync`.
 type TxnBody = Box<
     dyn for<'a, 'env> Fn(&'a mut WriteTxn<'env>) -> BoxFuture<'a, Result<Box<dyn Any + Send>>>
-        + Send
-        + Sync,
+        + Send,
 >;
 
 /// Returns `true` if `err` is an LMDB `MDB_MAP_FULL` error.
@@ -165,12 +161,28 @@ fn is_map_full(err: &Error) -> bool {
 /// Safety: `resize` is only called while holding the coordinator write guard,
 /// which guarantees no read or write LMDB transaction opened through this
 /// coordinator is active in the current process.
+#[derive(Clone)]
 struct TxnRunner {
     db_env: heed::Env<heed::WithoutTls>,
     coord: Arc<tokio::sync::RwLock<()>>,
 }
 
 impl TxnRunner {
+    /// Runs `inputs` in one write txn, resizing the map and retrying the whole
+    /// batch on `MDB_MAP_FULL`. Must be polled on a single OS thread from start
+    /// to finish — see [`Runner::run`].
+    async fn run_with_resize_retry(&self, inputs: &[TxnBody]) -> Result<Vec<Box<dyn Any + Send>>> {
+        loop {
+            match self.try_run_once(inputs).await {
+                Ok(outputs) => return Ok(outputs),
+                Err(e) if is_map_full(&e) => {
+                    self.resize_on_map_full().await?;
+                }
+                Err(e) => return Err(e),
+            }
+        }
+    }
+
     /// Attempts one write-txn pass over `inputs`. If any body or the final
     /// commit returns an error the write txn and coordinator read guard are
     /// dropped before the error propagates. On `MapFull` the caller should
@@ -219,19 +231,26 @@ impl Runner for TxnRunner {
     type Input = TxnBody;
     type Output = Box<dyn Any + Send>;
 
+    /// LMDB ties a write transaction to the OS thread that began it: only that
+    /// thread can release the writer lock, and LMDB ignores a failed release.
+    /// A write txn that begins on one runtime worker and commits or aborts on
+    /// another — which work-stealing allows at any `.await` that suspends —
+    /// leaves the lock held for good and blocks every later writer.
+    ///
+    /// So the whole batch runs on one blocking-pool thread, where `block_on`
+    /// polls the bodies instead of the runtime's workers.
     async fn run(
         &self,
         inputs: Vec<TxnBody>,
     ) -> Result<impl ExactSizeIterator<Item = Box<dyn Any + Send>>> {
-        loop {
-            match self.try_run_once(&inputs).await {
-                Ok(outputs) => return Ok(outputs.into_iter()),
-                Err(e) if is_map_full(&e) => {
-                    self.resize_on_map_full().await?;
-                }
-                Err(e) => return Err(e),
-            }
-        }
+        let runner = self.clone();
+        let runtime = tokio::runtime::Handle::current();
+        let span = Span::current();
+        let outputs = tokio::task::spawn_blocking(move || {
+            runtime.block_on(runner.run_with_resize_retry(&inputs).instrument(span))
+        })
+        .await??;
+        Ok(outputs.into_iter())
     }
 }
 
@@ -346,6 +365,11 @@ impl Storage {
     /// dropped without committing) and every caller in the batch receives
     /// an error.
     ///

```

---

### Incident Patch 6: `23e0e072` (2026-09-17)
**Commit Message**: fix(engine): reuse a same-operation memo under full_reprocess too (#2414)

#2412 made a run queued on a component's build permit reuse the memo a
concurrent same-key run had just stored, instead of executing the body
again. It did not apply under `full_reprocess`, where every memo lookup
short-circuited to a miss, so two concurrent runs of one memoized
component still both executed there.

`full_reprocess` must ignore memos left by previous runs, not this
operation's own execution — and the store cannot tell those apart, so the
engine now can: every processor context carries the generation of the
operation it belongs to (minted for a parentless context, the root of an
`App::update` / `App::drop_app` or a live component's own cycle; children
inherit), and a component records, after a successful store under the
permit, which operation stored which key. A queued run re-checks the memo
when the recorded key is its own; under `full_reprocess` only when the
recorded generation is its own operation's. The fast-path skip under
`full_reprocess` moves from the lookup helper to `execute_once`, where
the decision lives. Recording at store time (not run start) also means a
failed or cancelled r

**File**: `rust/core/src/engine/component.rs` (modified, +212/-38)
```diff
@@ -119,10 +119,12 @@ struct ComponentInner<Prof: EngineProfile> {
     /// runs never overlap, and the memo one run stores is in place before the
     /// next decides whether to execute its body.
     build_semaphore: tokio::sync::Semaphore,
-    /// Memo key of the latest run that executed under `build_semaphore`. A run
+    /// The memo most recently stored under `build_semaphore`, if any. A run
     /// that finds its own key here on acquiring the permit knows a same-key
-    /// run just completed, and re-checks the memo instead of executing again.
-    last_memo_fp: Mutex<Option<Fingerprint>>,
+    /// run just completed and stored its result, so it re-checks the memo
+    /// instead of executing again — under `full_reprocess` only when that run
+    /// belonged to the same operation (see `execute_once`).
+    last_stored_memo: Mutex<Option<StoredMemo>>,
 
     /// Identity registry of child components, keyed by their full StablePath,
     /// so a re-mount of a path whose component is still referenced shares the
@@ -573,6 +575,14 @@ struct ComponentBuildOutput<Prof: EngineProfile> {
     built_target_states_providers: TargetStateProviderRegistry<Prof>,
 }
 
+/// A memo stored by a run of a component under its `build_semaphore`: the
+/// operation that stored it and the key it was stored under.
+#[derive(Clone, Copy)]
+struct StoredMemo {
+    operation_generation: u64,
+    memo_fp: Fingerprint,
+}
+
 /// Result of looking up a component's memo for the processor about to run.
 enum MemoLookup<Prof: EngineProfile> {
     /// A valid memo stands in for a run: report the stored run's outcome and
@@ -665,7 +675,7 @@ impl<Prof: EngineProfile> Component<Prof> {
                 stable_path,
                 parent,
                 build_semaphore: tokio::sync::Semaphore::const_new(1),
-                last_memo_fp: Mutex::new(None),
+                last_stored_memo: Mutex::new(None),
                 active_children: parking_lot::Mutex::new(HashMap::new()),
                 live_state: parking_lot::Mutex::new(None),
                 active_ops: std::sync::atomic::AtomicUsize::new(0),
@@ -1106,16 +1116,21 @@ impl<Prof: EngineProfile> Component<Prof> {
 
             // Fast-path: component memoization check does not require acquiring the build permit.
             // If it hits, we can immediately return without processing/submitting/waiting.
-            match lookup_component_memo(processor_context, processor, memo_fp_to_store).await? {
-                MemoLookup::Reuse(outcome, output) => {
-                    processing_stats.update(processor_name, |stats| {
-                        stats.num_execution_starts += 1;
-                        stats.num_unchanged += 1;
-                    });
-                    return Ok((outcome, Some(output)));
-                }
-                MemoLookup::Miss { revalidated_states } => {
-                    memo_states_for_store = revalidated_states;
+            // Under `full_reprocess` a stored memo may only be reused when this very
+            // operation stored it, which only the permit-holding re-check below can
+            // tell, so the fast-path is skipped.
+            if !processor_context.full_reprocess() {
+                match lookup_component_memo(processor_context, processor, memo_fp_to_store).await? {
+                    MemoLookup::Reuse(outcome, output) => {
+                        processing_stats.update(processor_name, |stats| {
+                            stats.num_execution_starts += 1;
+                            stats.num_unchanged += 1;
+                        });
+                        return Ok((outcome, Some(output)));
+                    }
+                    MemoLookup::Miss { revalidated_states } => {
+                        memo_states_for_store = revalidated_states;
+                    }
                 }
             }
 
@@ -1139,10 +1154,17 @@ impl<Prof: EngineProfile> Component<Prof> {
                 // this one waited for
```

**File**: `rust/core/src/engine/context.rs` (modified, +32/-0)
```diff
@@ -38,6 +38,9 @@ struct AppContextInner<Prof: EngineProfile> {
     app_reg: AppRegistration<Prof>,
     id_sequencer_manager: IdSequencerManager,
     inflight_semaphore: Option<Arc<tokio::sync::Semaphore>>,
+    /// Source of operation generations; see
+    /// [`ComponentProcessorContext::operation_generation`].
+    operation_generation: std::sync::atomic::AtomicU64,
     /// Cancellation token for in-flight app operations. Wrapped in a `Mutex` so
     /// it can be replaced with a fresh child of the global token after a
     /// previous cancellation (e.g. after `App::drop_app` finishes), allowing
@@ -78,6 +81,7 @@ impl<Prof: EngineProfile> AppContext<Prof> {
                 app_reg,
                 id_sequencer_manager: IdSequencerManager::new(),
                 inflight_semaphore,
+                operation_generation: std::sync::atomic::AtomicU64::new(0),
                 cancellation_token: std::sync::Mutex::new(
                     crate::engine::runtime::global_cancellation_token().child_token(),
                 ),
@@ -137,6 +141,15 @@ impl<Prof: EngineProfile> AppContext<Prof> {
         self.inner.inflight_semaphore.as_ref()
     }
 
+    /// Mint the generation of a new operation; see
+    /// [`ComponentProcessorContext::operation_generation`].
+    fn next_operation_generation(&self) -> u64 {
+        self.inner
+            .operation_generation
+            .fetch_add(1, std::sync::atomic::Ordering::Relaxed)
+            + 1
+    }
+
     /// Returns a clone of the current app-level cancellation token.
     ///
     /// The clone stays valid even if the slot is later refreshed via
@@ -685,6 +698,8 @@ struct ComponentProcessorContextInner<Prof: EngineProfile> {
     component: Component<Prof>,
     parent_context: Option<ComponentProcessorContext<Prof>>,
     processing_action: ComponentProcessingAction<Prof>,
+    /// See [`ComponentProcessorContext::operation_generation`].
+    operation_generation: u64,
 
     inflight_permit: Mutex<Option<tokio::sync::OwnedSemaphorePermit>>,
 
@@ -726,11 +741,16 @@ impl<Prof: EngineProfile> ComponentProcessorContext<Prof> {
         host_ctx: Arc<Prof::HostCtx>,
         processing_action: ComponentProcessingAction<Prof>,
     ) -> Self {
+        let operation_generation = match &parent_context {
+            Some(parent) => parent.operation_generation(),
+            None => component.app_ctx().next_operation_generation(),
+        };
         Self {
             inner: Arc::new(ComponentProcessorContextInner {
                 component,
                 parent_context,
                 processing_action,
+                operation_generation,
                 inflight_permit: Mutex::new(None),
                 logic_deps: Mutex::new(HashSet::new()),
                 target_provider_deps: Mutex::new(TargetProviderDeps::new()),
@@ -1034,6 +1054,18 @@ impl<Prof: EngineProfile> ComponentProcessorContext<Prof> {
         }
     }
 
+    /// Generation of the operation this context belongs to. A context created
+    /// without a parent — the root of an `App::update` or `App::drop_app`, or
+    /// a live component's own cycle — starts a new operation; children inherit
+    /// their parent's. So two runs of one component share a generation exactly
+    /// when the same operation started both, which is how `full_reprocess`
+    /// tells a memo stored earlier in the same operation (that operation's own
+    /// execution) from one left behind by a previous run (a cache it must
+    /// ignore). See `Component::execute_once`.
+    pub(crate) fn operation_generation(&self) -> u64 {
+        self.inner.operation_generation
+    }
+
     pub fn preview(&self) -> bool {
         match &self.inner.processing_action {
             ComponentProcessingAction::Build(build_ctx) => build_ctx.preview_collector.is_some(),
```

**File**: `rust/core/src/engine/execution.rs` (modified, +4/-5)
```diff
@@ -80,6 +80,10 @@ pub(crate) fn serialize_context_memo_states<Prof: EngineProfile>(
         .collect()
 }
 
+/// Read the component's stored memo and return it when it was stored under
+/// `processor_fp` and its logic and target-provider dependencies still hold;
+/// otherwise delete it. Whether a stored memo may be consulted at all under
+/// `full_reprocess` is the caller's decision (see `Component::execute_once`).
 pub(crate) async fn use_or_invalidate_component_memoization<Prof: EngineProfile>(
     comp_ctx: &ComponentProcessorContext<Prof>,
     processor_fp: Option<Fingerprint>,
@@ -91,11 +95,6 @@ pub(crate) async fn use_or_invalidate_component_memoization<Prof: EngineProfile>
         TargetProviderDeps,
     )>,
 > {
-    // Short-circuit to miss under full_reprocess
-    if comp_ctx.full_reprocess() {
-        return Ok(None);
-    }
-
     let app_store = comp_ctx.app_ctx().app_store();
     let path = comp_ctx.stable_path();
     {
```

---

### Incident Patch 7: `63d0869d` (2026-09-13)
**Commit Message**: fix(engine): reuse a concurrent same-key run's memo instead of re-executing (#2412)

* fix(engine): reuse a concurrent same-key run's memo instead of re-executing

Two runs of one component with the same memo key that start before either
has stored a memo both executed the body: the memo fast-path runs before the
build permit is acquired, and the memo was stored after the permit was
released, so the run queued on the permit found nothing to reuse and ran the
body again. Reachable as two concurrent `App::update` calls on one app (and,
in cocoindex-plus, as two owners mounting the same shared component on a
cold build).

`execute_once` now holds the build permit through the memo store, and a run
that finds `last_memo_fp` equal to its own key on acquiring the permit
re-checks the memo — the previous same-key run's store is complete by then —
and reuses it (counted as `num_unchanged`) instead of executing. A failed run
stores no memo, so the re-check misses and the queued run executes as
before. The memo lookup + state validation shared by the fast-path and the
re-check is factored into `lookup_component_memo`; the store-time
`last_memo_fp` comparison is gone because no other run can s

**File**: `rust/core/src/engine/component.rs` (modified, +309/-157)
```diff
@@ -114,8 +114,14 @@ struct ComponentInner<Prof: EngineProfile> {
     /// this child's Weak entry from the parent's active_children.
     parent: Option<Component<Prof>>,
 
-    /// Semaphore to ensure `process()` and `commit_effects()` calls cannot happen in parallel.
+    /// Serializes runs of this component. A run holds the permit from before
+    /// its body starts until its memo is stored (see `execute_once`), so two
+    /// runs never overlap, and the memo one run stores is in place before the
+    /// next decides whether to execute its body.
     build_semaphore: tokio::sync::Semaphore,
+    /// Memo key of the latest run that executed under `build_semaphore`. A run
+    /// that finds its own key here on acquiring the permit knows a same-key
+    /// run just completed, and re-checks the memo instead of executing again.
     last_memo_fp: Mutex<Option<Fingerprint>>,
 
     /// Identity registry of child components, keyed by their full StablePath,
@@ -569,6 +575,86 @@ struct ComponentBuildOutput<Prof: EngineProfile> {
     built_target_states_providers: TargetStateProviderRegistry<Prof>,
 }
 
+/// Result of looking up a component's memo for the processor about to run.
+enum MemoLookup<Prof: EngineProfile> {
+    /// A valid memo stands in for a run: report the stored run's outcome and
+    /// output.
+    Reuse(ComponentRunOutcome, ComponentBuildOutput<Prof>),
+    /// No usable memo. `revalidated_states` is `Some` when a memo matched the
+    /// key but its memo states no longer validate: the states collected during
+    /// validation are then stored with the new memo, instead of being
+    /// collected again once the body has run.
+    Miss {
+        revalidated_states: Option<MemoStatesPayload<Prof>>,
+    },
+}
+
+/// How the permit-guarded part of `execute_once` ended.
+enum GuardedRun<Prof: EngineProfile> {
+    /// The body did not run: a run with the same memo key completed under the
+    /// permit while this one waited for it, and its memo was reused.
+    Reused(ComponentRunOutcome, ComponentBuildOutput<Prof>),
+    /// The body ran (build mode), or the component was deleted (delete mode).
+    Executed {
+        children_outcome: ComponentRunOutcome,
+        build_output: Option<ComponentBuildOutput<Prof>>,
+        touched_previous_states: bool,
+    },
+}
+
+/// Look up the memo stored for `comp_ctx`'s component and, when `processor`
+/// has a memo state handler, validate the stored memo states through it. A
+/// stored memo whose key is not `memo_fp` — or any stored memo, when the
+/// processor is not memoized (`memo_fp` is `None`) — is invalidated. A failure
+/// to read or decode the memo is logged and counts as a miss; a failure in the
+/// state handler propagates.
+async fn lookup_component_memo<Prof: EngineProfile>(
+    comp_ctx: &ComponentProcessorContext<Prof>,
+    processor: &Prof::ComponentProc,
+    memo_fp: Option<Fingerprint>,
+) -> Result<MemoLookup<Prof>> {
+    let memo = match use_or_invalidate_component_memoization(comp_ctx, memo_fp).await {
+        Ok(memo) => memo,
+        Err(err) => {
+            error!("component memoization restore failed: {err:?}");
+            None
+        }
+    };
+    let Some((ret, memo_states, stored_logic_deps, stored_provider_deps)) = memo else {
+        return Ok(MemoLookup::Miss {
+            revalidated_states: None,
+        });
+    };
+    if processor.has_memo_state_handler() && !memo_states.is_empty() {
+        let fut = processor.handle_memo_states(
+            comp_ctx.app_ctx().env().host_runtime_ctx(),
+            comp_ctx,
+            Some(memo_states),
+        )?;
+        let (new_states, can_reuse, states_changed) = fut.await?;
+        if !can_reuse {
+            return Ok(MemoLookup::Miss {
+                revalidated_states: Some(new_states),
+            });
+        }
+        // Reusable, but the states themselves moved (e.g. an mtime changed
+        // while the content hash did not): refresh them in th
```

---

### Incident Patch 8: `6cf29b84` (2026-09-13)
**Commit Message**: fix: preserve typed Python exceptions in component exception handlers (#2383)

* fix: preserve typed Python exceptions in component exception handlers

Closes #2380.

- build_on_error converts the engine error with cerror_to_pyerr and passes
  the resulting exception object to the handler callback instead of a
  formatted string. A raising handler's error propagates as-is, so
  handle.ready() re-raises it with its Python type intact.
- Tunneled Python exceptions pass through unchanged, the same as use_mount
  and handle.ready() already do; engine-native failures map to the usual
  Python types.
- resolve_exception_handler and report_exception take BaseException; the
  no-handler fallback logs the exception summary in the message and the
  traceback via exc_info.
- Docs describe the exception semantics; tests updated and extended.

* fix: never route CancelledError through the exception handler chain

asyncio.CancelledError is a BaseException, so cancellation raised while a
handler was awaited fell into the handler-failure branch and was handed to
the next outer handler, which could swallow it. Re-raise it immediately
instead. Handlers now only ever see real failures, matching the d

**File**: `docs/src/content/docs/advanced_topics/exception_handlers.mdx` (modified, +24/-1)
```diff
@@ -144,6 +144,29 @@ ExceptionHandler = Callable[
 ]
 ```
 
+### What `exc` is
+
+Handlers receive the same exception object that a foreground call such as `await coco.use_mount(...)` would raise for the same failure:
+
+- **Python-originated failures** (your component, or a target connector, raised) arrive as the original exception. `type(exc)` is what was raised, `exc.__traceback__` is intact, and `exc.__cause__` / `exc.__context__` are preserved. Route by type with `isinstance`; render the traceback with `traceback.format_exception(exc)` or `logger.error(..., exc_info=exc)`.
+- **Engine-native failures** map to Python types: client-side misuse becomes `ValueError`, cooperative deadline expiry becomes `coco.DeadlineExceededError`, and internal engine errors become `RuntimeError`. The engine never delivers cancellation of the component itself to handlers.
+
+An exception raised by a handler keeps its type as well: `await handle.ready()` raises exactly what the last handler in the chain raised, so `except MyDeadLetterError:` or `except coco.DeadlineExceededError:` work as expected on the awaiting side.
+
+Earlier releases handed every component failure to handlers as a `RuntimeError` whose message embedded the formatted traceback, and re-wrapped handler-raised exceptions the same way. A handler that checked `isinstance(exc, RuntimeError)` or parsed `str(exc)` for the traceback should switch to the checks above.
+
+```python
+import traceback
+
+def on_error(exc: BaseException, ctx: coco.ExceptionContext) -> None:
+    if isinstance(exc, ConnectionError):
+        schedule_retry(ctx.stable_path)  # transient: swallow, retry later
+    elif isinstance(exc, ValueError):
+        dead_letter(ctx.stable_path, "".join(traceback.format_exception(exc)))
+    else:
+        raise exc  # propagate through handle.ready()
+```
+
 ### `ExceptionContext` fields
 
 Your handler receives an `ExceptionContext` dataclass with information about the failure:
@@ -165,7 +188,7 @@ Handlers are stacked: the most specific (innermost) handler runs first.
 
 If the innermost handler raises an exception, the next outer handler is called with that new exception. In this case `ctx.source` is `"handler"` and `ctx.original_exception` holds the original component error.
 
-This continues up the stack. If all handlers raise (or no handler is registered), CocoIndex falls back to the built-in behavior: logging the error at `ERROR` level, with no crash.
+This continues up the stack. If every handler raises, the last handler's exception propagates through `handle.ready()` (see [How to opt into propagation](#how-to-opt-into-propagation)). If no handler is registered, CocoIndex falls back to the built-in behavior: logging the error at `ERROR` level, with no crash.
 
 ```python
 @coco.lifespan
```

**File**: `python/cocoindex/_internal/api.py` (modified, +3/-3)
```diff
@@ -805,9 +805,9 @@ def use_state(
 
     The value is serialized lazily, once, when the component commits — not at
     assignment. Two consequences: (1) if the value is not serializable, the
-    error surfaces at commit (identifying the state key) rather than at the
-    `handle.value = ...` line; (2) the persisted value reflects the object as it
-    is at commit, so mutating it in place after assignment is captured.
+    error surfaces at commit rather than at the `handle.value = ...` line;
+    (2) the persisted value reflects the object as it is at commit, so
+    mutating it in place after assignment is captured.
 
     Args:
         key: Unique StableKey within this component (None, bool, int, str,
```

**File**: `python/cocoindex/_internal/component_ctx.py` (modified, +16/-6)
```diff
@@ -1,5 +1,6 @@
 from __future__ import annotations
 
+import asyncio
 import contextlib
 import inspect
 import logging
@@ -132,10 +133,15 @@ def resolve_exception_handler(
         stable_path: str,
         processor_name: str | None,
         mount_kind: MountKind,
-    ) -> Callable[[str], Awaitable[None]]:
+    ) -> Callable[[BaseException], Awaitable[None]]:
         """Build the exception-handler resolver for a child mounted under this context.
 
-        Returns a callable that takes a stringified error and:
+        Returns a callable that takes the failure as a Python exception
+        (a Python-originated failure arrives as its original exception
+        object with traceback intact; engine-native failures arrive as
+        ``RuntimeError`` / ``ValueError`` / ``DeadlineExceededError``, the
+        same mapping ``use_mount`` uses; the engine filters cancellation
+        before calling this) and:
         - walks this context's handler chain (innermost first);
         - if a handler raises, calls the next outer handler with the
           new exception;
@@ -158,18 +164,18 @@ def resolve_exception_handler(
         # captured implicitly. `self._core_path.to_string()` in particular
         # is a PyO3 → Rust → string allocation we don't want to pay on
         # every mount.
-        async def _run(err_str: str) -> None:
+        async def _run(exc: BaseException) -> None:
             node = self._exception_handler_chain
             if node is None:
                 # No handlers registered — log directly without building
                 # the ExceptionContext metadata at all. Don't propagate.
-                _logger.error("component build failed:\n%s", err_str)
+                _logger.error("component build failed: %s", exc, exc_info=exc)
                 return
 
             env_name = self._env.name
             parent_stable_path = self._core_path.to_string()
-            original_exc: BaseException = RuntimeError(err_str)
-            current_exc: BaseException = original_exc
+            original_exc = exc
+            current_exc = exc
             source: Literal["component", "handler"] = "component"
             while node is not None:
                 ctx = ExceptionContext(
@@ -187,6 +193,10 @@ async def _run(err_str: str) -> None:
                     if inspect.isawaitable(ret):
                         await ret
                     return  # Handler swallowed → don't propagate.
+                except asyncio.CancelledError:
+                    # Cancellation is not a handler failure: never feed it
+                    # to outer handlers (which could swallow it).
+                    raise
                 except BaseException as handler_exc:
                     current_exc = handler_exc
                     source = "handler"
```

**File**: `python/cocoindex/_internal/core.pyi` (modified, +4/-4)
```diff
@@ -349,18 +349,18 @@ class LiveComponentController:
     def update_full_async(
         self,
         processor: ComponentProcessor[Any],
-        handler_callback: Callable[[str], Awaitable[None]] | None = None,
+        handler_callback: Callable[[BaseException], Awaitable[None]] | None = None,
     ) -> Coroutine[Any, Any, None]: ...
     def update_async(
         self,
         stable_path: StablePath,
         processor: ComponentProcessor[Any],
-        handler_callback: Callable[[str], Awaitable[None]] | None = None,
+        handler_callback: Callable[[BaseException], Awaitable[None]] | None = None,
     ) -> Coroutine[Any, Any, ComponentMountHandle]: ...
     def delete_async(
         self,
         stable_path: StablePath,
-        handler_callback: Callable[[str], Awaitable[None]] | None = None,
+        handler_callback: Callable[[BaseException], Awaitable[None]] | None = None,
     ) -> Coroutine[Any, Any, ComponentMountHandle]: ...
     def mark_ready_async(self) -> Coroutine[Any, Any, None]: ...
     def read_committed_state_async(
@@ -430,7 +430,7 @@ async def mount_async(
     stable_path: StablePath,
     comp_ctx: ComponentProcessorContext,
     fn_ctx: FnCallContext,
-    handler_callback: Any | None = None,
+    handler_callback: Callable[[BaseException], Awaitable[None]] | None = None,
 ) -> ComponentMountHandle: ...
 async def use_mount_async(
     processor: ComponentProcessor[T_co],
```

**File**: `python/cocoindex/_internal/live_component.py` (modified, +16/-16)
```diff
@@ -3,7 +3,6 @@
 import asyncio
 import datetime
 import inspect
-import traceback
 from collections.abc import AsyncIterator
 from contextvars import ContextVar
 from typing import (
@@ -271,15 +270,17 @@ def _require_controller(self) -> core.LiveComponentController:
             )
         return ctrl
 
-    def _resolve_exception_handler(self) -> Callable[[str], Awaitable[None]]:
+    def _resolve_exception_handler(
+        self,
+    ) -> Callable[[BaseException], Awaitable[None]]:
         """Build a resolver for the parent's exception handler chain.
 
         Delegates to :meth:`ComponentContext.resolve_exception_handler`
         — the same path used by ``coco.mount`` / ``coco.mount_each`` —
         so component-failure logs go through one canonical Python
         fallback. Always non-None. Used both by :meth:`update_full`
         (passes to Rust as ``on_error``) and :meth:`report_exception`
-        (invokes directly with a stringified exception).
+        (invokes directly with the reported exception).
         """
         return get_context_from_ctx().resolve_exception_handler(
             stable_path=self._path.to_string(),
@@ -450,20 +451,19 @@ async def report_exception(self, exc: BaseException) -> None:
         cycle failures from initial build failures (``"mount"`` /
         ``"mount_each"``).
 
-        The exception is formatted via :func:`traceback.format_exception`
-        so handlers and the fallback log both see the full Python
-        traceback (when ``exc.__traceback__`` is set — i.e. when the
-        caller is reporting a caught exception). This matches the
-        text-with-trace shape that the Rust-side ``on_error`` path
-        produces for background ``mount`` / ``mount_each`` failures.
-
-        Falls back to ERROR-level logging if no handler is registered or
-        every handler re-raises. Intended for surfacing recoverable errors
-        (e.g. an external watcher emits a malformed event) without
-        tearing down the live component.
+        Handlers receive ``exc`` itself, so they can route by type and
+        recover the traceback via :func:`traceback.format_exception` (when
+        ``exc.__traceback__`` is set, i.e. when the caller is reporting a
+        caught exception). This matches what the Rust-side ``on_error``
+        path delivers for background ``mount`` / ``mount_each`` failures.
+
+        Falls back to ERROR-level logging if no handler is registered. If
+        every handler re-raises, the final handler's exception propagates
+        to the caller. Intended for surfacing recoverable errors (e.g. an
+        external watcher emits a malformed event) without tearing down the
+        live component.
         """
-        err_text = "".join(traceback.format_exception(exc))
-        await self._resolve_exception_handler()(err_text)
+        await self._resolve_exception_handler()(exc)
 
 
 @runtime_checkable
```

---

### Incident Patch 9: `675df258` (2026-09-13)
**Commit Message**: fix(engine): confine a merged target-action batch failure to the failing component (#2406)

* fix(engine): confine a merged target-action batch failure to the failing component

Target action sinks batch through the engine: while one sink call is in
flight, the actions of every component that finishes meanwhile merge into
the next call. Merging is meant as a pure optimization, but a failure of
the merged call used to fail every component in it — the sink sees one
flat action list, `Runner::run` is all-or-nothing, and the batcher fans a
single error out to every waiter. One bad row could silently roll back
dozens of unrelated components' writes (observed with a shared
per-database Postgres sink: 1 of 60 rows advanced, `app.update()` returned
normally).

`TargetActionRunner` now reports a per-input outcome and, when a batch
spanning several components fails, bisects it along component boundaries
(never inside a component, whose actions stay one atomic unit) and
re-applies each half until every error is attributed only to the
components it belongs to. The happy path is unchanged: one sink call, one
transaction. Worst case costs `2n - 1` sink calls; cancellation and
deadline errors are

**File**: `dev/agent-skills/target-connector/SKILL.md` (modified, +9/-0)
```diff
@@ -256,6 +256,15 @@ and cannot be weakly referenced) and is rejected. The frozen dataclass above is
 the recommended shape; if you add `slots=True` to it, also pass
 `weakref_slot=True`.
 
+A batch can hold the actions of several processing components that finished
+around the same time. Merging is only an optimization: if the sink raises, the
+engine retries the same actions in smaller batches split along component
+boundaries (never inside one component's actions), so only the component(s)
+whose actions actually fail end up failing — the others' actions are
+re-applied and committed normally. The sink needs no special handling for
+this, but it may see an action from a failed batch again, which idempotent
+actions (see above) already tolerate.
+
 ### Input Safety
 
 When building queries from user-provided names (table, column, index) or values (record IDs, keys), you must guard against injection and ensure correctness. See [input_safety.md](input_safety.md) for patterns on identifier validation, parameterized queries, and value escaping.
```

**File**: `docs/src/content/docs/advanced_topics/custom_target_connector.mdx` (modified, +1/-1)
```diff
@@ -204,7 +204,7 @@ Understanding what happens at runtime:
 
 3. **Reconciliation**: When the processing unit finishes, CocoIndex calls your handler's `reconcile()` method for each target state. For declared target states, `desired_target_state` contains the spec; for previously declared but now missing states, `desired_target_state` is `NON_EXISTENCE` (triggering cleanup). Your `reconcile()` compares the desired state with previous records and returns `TargetReconcileOutput` if an action is needed, or `None` if no changes are required.
 
-4. **Action Execution**: CocoIndex batches actions by their `TargetActionSink` and executes them. The sink applies changes to the external system (database writes, file operations, API calls, etc.).
+4. **Action Execution**: CocoIndex batches actions by their `TargetActionSink` and executes them. The sink applies changes to the external system (database writes, file operations, API calls, etc.). A batch may combine the actions of several processing components that finish around the same time; if the sink fails, CocoIndex retries in smaller batches along component boundaries, so only the components whose actions actually fail are affected. The sink may therefore see an action from a failed batch again — keep actions idempotent.
 
 5. **Tracking Persistence**: After successful execution, CocoIndex persists the new tracking records. On the next run, these become the `prev_possible_records` for change detection.
 
```

**File**: `docs/src/content/docs/faq.mdx` (modified, +1/-1)
```diff
@@ -40,4 +40,4 @@ CocoIndex's internal state is always consistent — even after a crash or `kill
 
 ### Are target state writes transactional across targets?
 
-Not across targets. When a processing component finishes, CocoIndex sends all its target state changes to each target backend as a unit — all writes happen after processing completes, never partially during execution. Each target backend applies its batch atomically when supported (e.g., within a database transaction). But changes across *different* target backends (e.g., Postgres and local files) are not transactional with each other. See [How target states sync](./programming_guide/processing_component#how-target-states-sync) for details.
+Not across targets. When a processing component finishes, CocoIndex sends all its target state changes to each target backend as a unit — all writes happen after processing completes, never partially during execution. Each target backend applies its batch atomically when supported (e.g., within a database transaction). A batch may also carry the changes of several components that finish around the same time; if the backend rejects it, CocoIndex retries the changes in smaller batches per component, so one component's failure never undoes another's. But changes across *different* target backends (e.g., Postgres and local files) are not transactional with each other. See [How target states sync](./programming_guide/processing_component#how-target-states-sync) for details.
```

**File**: `docs/src/content/docs/programming_guide/processing_component.mdx` (modified, +1/-1)
```diff
@@ -242,7 +242,7 @@ After a processing component finishes, CocoIndex syncs its target states:
 2. **Applies changes** as a unit — creating, updating, or deleting target states as needed
 3. **Recursively cleans up** sub-paths where components are no longer mounted
 
-All writes happen strictly after processing completes — you never see partial effects from a processing failure or interrupt. Each target backend applies its batch atomically when supported (e.g., within a database transaction), but changes across different target backends are not transactional with each other.
+All writes happen strictly after processing completes — you never see partial effects from a processing failure or interrupt. Each target backend applies its batch atomically when supported (e.g., within a database transaction), but changes across different target backends are not transactional with each other. When several components finish around the same time, a backend may receive their changes in one batch; that is only an optimization — if the batch fails, CocoIndex retries per component so one component's failure never undoes another's.
 
 :::
 
```

**File**: `python/tests/core/test_target_sink_failure_isolation.py` (added, +181/-0)
```diff
@@ -0,0 +1,181 @@
+"""A failing component must not fail the components the engine batched with it.
+
+Target action sinks batch through the engine: while one sink call is in
+flight, the actions of every component that finishes meanwhile merge into the
+next call. Merging is an optimization, not a transaction boundary between
+components. When a merged call fails, the engine retries in smaller batches
+along component boundaries, so only the component whose actions fail actually
+fails; the others commit as usual.
+"""
+
+from __future__ import annotations
+
+import asyncio
+import threading
+import time
+from dataclasses import dataclass
+from typing import Any, Collection
+
+import cocoindex as coco
+
+from tests import common
+
+_NUM_ITEMS = 16
+_POISON_ITEM = 7
+
+_failed_paths: list[str] = []
+
+
+def _record_failure(exc: BaseException, ctx: coco.ExceptionContext) -> None:
+    _failed_paths.append(ctx.stable_path)
+
+
+coco_env = common.create_test_env(__file__, exception_handler=_record_failure)
+
+
+class _RunState:
+    """Per-run input and observations, shared across threads (``reconcile``
+    runs on an engine thread)."""
+
+    def __init__(self) -> None:
+        self.lock = threading.Lock()
+        # The item whose actions the sink rejects in this run, if any.
+        self.poison_item: int | None = None
+        self.store: dict[int, str] = {}
+        self.batches: list[list[tuple[int, str]]] = []
+        self.num_reconciled = 0
+        self.gate_taken = False
+
+    def reset_run(self, poison_item: int | None) -> None:
+        with self.lock:
+            self.poison_item = poison_item
+            self.batches.clear()
+            self.num_reconciled = 0
+            self.gate_taken = False
+
+
+_run = _RunState()
+
+
+async def _wait_until_all_reconciled() -> None:
+    """Hold the batcher until every component has reconciled its target state.
+
+    A component reconciles right before handing its actions to the sink, so
+    once every component has reconciled (plus a drain period for the last
+    precommit to land), every other component's actions are queued behind this
+    sink call and will merge into the next batch.
+    """
+    deadline = time.monotonic() + 10
+    while True:
+        with _run.lock:
+            if _run.num_reconciled >= _NUM_ITEMS:
+                break
+        if time.monotonic() > deadline:
+            raise TimeoutError("components did not all reconcile in time")
+        await asyncio.sleep(0.01)
+    await asyncio.sleep(0.3)
+
+
+@dataclass(frozen=True)
+class _TransactionalSink:
+    """A batch lands wholly or not at all, like a database transaction."""
+
+    db: str
+
+    async def __call__(
+        self,
+        context_provider: coco.ContextProvider,
+        actions: Collection[tuple[int, str]],
+        /,
+    ) -> None:
+        batch = list(actions)
+        with _run.lock:
+            _run.batches.append(batch)
+            takes_gate = not _run.gate_taken
+            _run.gate_taken = True
+        if takes_gate:
+            await _wait_until_all_reconciled()
+        if any(value == "poison" for _, value in batch):
+            raise ValueError("poisoned batch")
+        with _run.lock:
+            for key, value in batch:
+                _run.store[key] = value
+
+
+class _Handler:
+    def reconcile(
+        self,
+        key: Any,
+        desired_state: Any | coco.NonExistenceType,
+        prev_possible_records: Collection[Any],
+        prev_may_be_missing: bool,
+        /,
+    ) -> coco.TargetReconcileOutput[tuple[int, str], Any] | None:
+        with _run.lock:
+            _run.num_reconciled += 1
+        if coco.is_non_existence(desired_state):
+            return None
+        if not prev_may_be_missing and all(
+            prev == desired_state for prev in prev_possible_records
+        ):
+            return None
+        return coco.TargetReconcileOutput(
+            action=(key, desired_state),
+            sink=coco.TargetA
```

---

### Incident Patch 10: `4b87e950` (2026-09-13)
**Commit Message**: fix: copying a coco function returns the function itself (#2409)

**File**: `python/cocoindex/_internal/function.py` (modified, +20/-0)
```diff
@@ -24,6 +24,7 @@
     NamedTuple,
     ParamSpec,
     Protocol,
+    Self,
     TypeAlias,
     TypeVar,
     cast,
@@ -745,6 +746,15 @@ def __del__(self) -> None:
         if fp is not None:
             core.unregister_logic_fingerprint(fp)
 
+    # Copying returns this same object, as `copy` does for plain functions. A
+    # distinct copy would share `_logic_fp` without having registered it, so its
+    # `__del__` would release the registration this object holds.
+    def __copy__(self) -> Self:
+        return self
+
+    def __deepcopy__(self, memo: dict[int, Any]) -> Self:
+        return self
+
     @overload
     def __get__(self, instance: None, owner: type) -> SyncFunction[P, R_co]: ...
     @overload
@@ -1291,6 +1301,16 @@ def __del__(self) -> None:
         if fp is not None:
             core.unregister_logic_fingerprint(fp)
 
+    # Same as `SyncFunction.__copy__`. Without these, `copy` would fall back to
+    # `__reduce__`, whose module/qualname lookup fails for a function defined in
+    # a local scope and returns the undecorated function when it was decorated
+    # under another name.
+    def __copy__(self) -> Self:
+        return self
+
+    def __deepcopy__(self, memo: dict[int, Any]) -> Self:
+        return self
+
     @property
     def _any_fn(self) -> AnyCallable[P, R_co]:
         if self._orig_async_fn is not None:
```

**File**: `python/tests/core/test_logic_change_detection.py` (modified, +52/-0)
```diff
@@ -1,5 +1,6 @@
 """Tests for logic change detection: memoized results are invalidated when function code changes."""
 
+import copy
 import gc
 import pathlib
 import sys
@@ -251,6 +252,57 @@ async def app_main() -> None:
     assert metrics.collect() == {}
 
 
+# ============================================================================
+# Copying a function keeps its memo: dropping a copy must not release the logic
+# fingerprint registration held by the original.
+# ============================================================================
+
+
+def test_memo_hit_survives_dropping_copies_of_fn() -> None:
+    """Dropping a `copy.copy` or `copy.deepcopy` of a memoized function keeps
+    both its function memo and its component memo."""
+    metrics = Metrics()
+    sync_memo_fn = _define_sync_memo_fn(metrics)
+    async_memo_fn = _define_async_memo_fn(metrics)
+
+    @coco.fn
+    async def app_main() -> None:
+        sync_memo_fn("call")
+        await async_memo_fn("call")
+        await coco.use_mount(coco.component_subpath("sync"), sync_memo_fn, "mount")
+        await coco.use_mount(coco.component_subpath("async"), async_memo_fn, "mount")
+
+    app = coco.App(
+        coco.AppConfig(
+            name="test_memo_hit_survives_dropping_copies_of_fn",
+            environment=coco_env,
+        ),
+        app_main,
+    )
+
+    app.update_blocking()
+    assert metrics.collect() == {
+        "sync_memo_fn(call)": 1,
+        "async_memo_fn(call)": 1,
+        "sync_memo_fn(mount)": 1,
+        "async_memo_fn(mount)": 1,
+    }
+    app.update_blocking()
+    assert metrics.collect() == {}
+
+    copies = [
+        copy.copy(sync_memo_fn),
+        copy.deepcopy(sync_memo_fn),
+        copy.copy(async_memo_fn),
+        copy.deepcopy(async_memo_fn),
+    ]
+    del copies
+    gc.collect()
+
+    app.update_blocking()
+    assert metrics.collect() == {}
+
+
 # ============================================================================
 # Transitive — foo (memoized fn) calls bar, bar changes
 # ============================================================================
```

#### Recent Merged Pull Requests:
- **PR #2445** (2026-09-30): test(core): make the child-slot retry test's merged batch deterministic (@georgeh0)
- **PR #2444** (2026-09-30): fix(agents): keep the docs build check from rewriting package-lock.json (@georgeh0)
- **PR #2441** (2026-09-29): ci(deps): bump pyjwt from 2.13.0 to 2.14.0 (@dependabot[bot])
- **PR #2439** (2026-09-29): fix(surrealdb): surface statement errors, typed CBOR values, array IDs, MERGE ownership, fields mode (@martinschaer)
- **PR #2437** (2026-09-30): fix(amazon_s3): handle zero-length range reads (@Sujit-1509)
- **PR #2436** (2026-09-29): ci(deps): bump taiki-e/install-action from 2.87.15 to 2.87.20 (@dependabot[bot])
- **PR #2428** (2026-09-22): ci(deps): bump jlumbroso/free-disk-space from 1.3.1 to 2.0.0 (@dependabot[bot])
- **PR #2427** (2026-09-22): ci(deps): bump taiki-e/install-action from 2.87.11 to 2.87.15 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
