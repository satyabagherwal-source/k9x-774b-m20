# Forensic Learning Record (Deep Inspection): MinishLab/semble

> **Canonical Artifact**: `07_PROJECT_LEARNING/minishlab-semble-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MinishLab/semble](https://github.com/MinishLab/semble))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:24:36.512Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MinishLab/semble`
- **Description**: Fast and Accurate Code Search for Agents. Uses 99% fewer tokens than grep+read
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 6183 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/semble/chunking/core.py`
```
from __future__ import annotations

from dataclasses import dataclass
from functools import cache
from logging import getLogger

from semble_grammars import LanguageNotFoundError, UnsupportedPlatformError, get_parser
from tree_sitter import Node, Parser

logger = getLogger(__name__)

_RECURSION_DEPTH = 500
_MIN_CHUNK_SIZE = 50


@dataclass
class ChunkBoundary:
    """The output of the internal chunking algorithm."""

    start: int
    end: int


@cache
def _cached_get_parser(language: str) -> Parser | None:
    """Gets a parser from tree_sitter."""
    try:
        return get_parser(language)
    except LanguageNotFoundError:
        logger.warning("Language %s not found, falling back to line chunking", language)
    except UnsupportedPlatformError:
        logger.warning("No bundled grammars for this platform, falling back to line chunking")
    except Exception:
        logger.error("Uncaught exception in _cached_get_parser", exc_info=True)
    return None


def _merge_adjacent_chunks(
    chunks: list[ChunkBoundary],
    desired_length: int,
) -> list[ChunkBoundary]:
    """Merge adjacent chunks up to the desired length."""
    merged = []

    current_start = chunks[0].start
    current_end = chunks[0].end
    current_length = current_end - current_start

    for group in chunks[1:]:
        start, end = group.start, group.end
        length = end - start

        if current_length + length > desired_length:
            merged.append(ChunkBoundary(start=current_start, end=current_end))
            current_start = start
            current_end = end
            current_length = length
            continue

        current_end = end
        current_length += length

    merged.append(ChunkBoundary(start=current_start, end=current_end))

    return merged


def _merge_node_inner(node: Node, desired_length: int, i: int) -> list[ChunkBoundary]:
    """Recursively merge and split nodes."""
    # If there are no child nodes, the only thing we can do is return the current node.
    if not node.children:
        return [ChunkBoundary(node.start_byte, node.end_byte)]

    length = node.end_byte - node.start_byte
    # Prevent recursion issues. A depth of > 500 is unlikely
    if i > _RECURSION_DEPTH:
        logger.warning("Recursion depth exceeded in chunk.")
        return [ChunkBoundary(node.start_byte, node.end_byte)]
    # Prevent recursing into short chunks.
    if length < _MIN_CHUNK_SIZE:
        return [ChunkBoundary(node.start_byte, node.end_byte)]

    groups: list[ChunkBoundary] = []
    children = node.children
    index = 0

    while index < len(children):
        child = children[index]
        start = child.start_byte
        end = child.end_byte
        length = child.end_byte - child.start_byte

        # Increment the pointer, as we accessed a child node.
        index += 1
        # If this single chunk is longer than the desired length
        # we try to split it again.
        if length > desired_length:
            groups.extend(_merge_node_inner(child, desired_length, i + 1))
            continue

        while index < len(children):
            # Extend the current group with or more children, if they fit.
            child = children[index]
            child_length = child.end_byte - child.start_byte

            if length + child_length > desired_length:
                break

            end = child.end_byte
            length += child_length
            index += 1

        groups.append(ChunkBoundary(start, end))

    return groups


def _merge_node(node: Node, desired_length: int) -> list[ChunkBoundary]:
    """Recursively turn nodes into chunks, then merge adjacent chunks."""
    raw_chunks = _merge_node_inner(node, desired_length, 0)
    return _merge_adjacent_chunks(raw_chunks, desired_length)


def chunk_lines(text: str, desired_length: int) -> list[ChunkBoundary]:
    """Chunk source code by line."""
    if not text.strip():
        return []
    lines_as_groups = []
    index = 0
    for line in text.splitlines(keepends=True):
        lines_as_groups.append(ChunkBoundary(start=index, end=index + len(line)))
        index += len(line)

    return _merge_adjacent_chunks(lines_as_groups, desired_length)


def chunk(text: str, language: str, desired_length: int) -> list[ChunkBoundary] | None:
    """Chunk source code."""
    if not text.strip():
        return []

    as_bytes = text.encode("utf-8")
    parser = _cached_get_parser(language)
    if parser is None:
        return None
    root = parser.parse(as_bytes).root_node

    chunks = []
    for chunk_boundary in _merge_node(root, desired_length):
        start_char = len(as_bytes[: chunk_boundary.start].decode("utf-8"))
        end_char = len(as_bytes[: chunk_boundary.end].decode("utf-8"))
        chunks.append(ChunkBoundary(start=start_char, end=end_char))

    return chunks

```

### Core Architecture Module: `src/semble/utils.py`
```
from __future__ import annotations

import os
import re
from typing import Any

from semble.types import Chunk, SearchResult

_GIT_URL_SCHEMES = ("https://", "http://", "ssh://", "git://", "git+ssh://", "file://")
_SCP_GIT_URL_RE = re.compile(r"^[\w.-]+@[\w.-]+:(?!/)")
DEFAULT_MODEL_NAME = "minishlab/potion-code-16M-v2"


def is_git_url(path: str) -> bool:
    """Return True if path looks like a remote git URL rather than a local path."""
    return path.startswith(_GIT_URL_SCHEMES) or _SCP_GIT_URL_RE.match(path) is not None


def resolve_chunk(chunks: list[Chunk], file_path: str, line: int) -> Chunk | None:
    """Return the chunk containing *line* in *file_path*, or None.

    Reconstructs a Chunk from its JSON-primitive MCP tool arguments (file_path + line)
    before calling into the library.
    """
    # Normalize separators: file_path is stored with the platform's native separator.
    file_path = file_path.replace("\\", "/")
    fallback = None
    for chunk in chunks:
        if chunk.file_path.replace("\\", "/") == file_path and chunk.start_line <= line <= chunk.end_line:
            if line < chunk.end_line:
                return chunk
            if fallback is None:  # line == end_line: boundary; keep as fallback for end-of-file chunks
                fallback = chunk
    return fallback


def format_results(
    query: str, results: list[SearchResult], max_snippet_lines: int | None = None, repos: dict[str, str] | None = None
) -> dict[str, Any]:
    """Render results as a flat JSONable object.

    max_snippet_lines=None → full content per result.
    max_snippet_lines=0    → file path and line range only, no content.
    max_snippet_lines=N>0  → first N lines of content.
    repos, when non-empty, maps the repo-label prefixes in file paths back to their sources.
    """
    formatted = []
    for r in results:
        entry: dict[str, Any] = {
            "file_path": r.chunk.file_path,
            "start_line": r.chunk.start_line,
            "end_line": r.chunk.end_line,
            "score": r.score,
        }
        if max_snippet_lines is None:
            entry["content"] = r.chunk.content
        elif max_snippet_lines > 0:
            lines = r.chunk.content.splitlines()
            entry["content"] = "\n".join(lines[:max_snippet_lines])
        formatted.append(entry)
    out: dict[str, Any] = {"query": query, "results": formatted}
    if repos:
        out["repos"] = repos
    return out


def resolve_model_name() -> str:
    """Resolve a model name to a configurable."""
    return os.environ.get("SEMBLE_MODEL_NAME", DEFAULT_MODEL_NAME)

```

### Core Architecture Module: `benchmarks/baselines/ablations.py`
```
import argparse
import json
import sys
import time
from dataclasses import asdict

import numpy as np

from benchmarks.data import (
    RepoSpec,
    Task,
    add_filter_args,
    grouped_tasks,
    load_filtered_tasks,
    save_results,
    summarize_modes,
)
from benchmarks.run_benchmark import RepoResult, evaluate
from semble import SembleIndex
from semble.utils import DEFAULT_MODEL_NAME

# alpha=None  → raw mode, input depends on query
# alpha=0.0   → hybrid pipeline, BM25-only input
# alpha=1.0   → hybrid pipeline, semantic-only input
_MODE_PARAMS: dict[str, tuple[float | None, bool]] = {
    "semble-bm25": (0.0, True),
    "semble-semantic": (1.0, True),
    "semble-auto": (None, True),
    "semble-balanced": (0.5, True),
    "unranked-bm25": (0.0, False),
    "unranked-semantic": (1.0, False),
    "unranked-auto": (None, False),
    "unranked-balanced": (0.5, False),
}


def _bench(
    repo_tasks: dict[str, list[Task]],
    specs: dict[str, RepoSpec],
    *,
    verbose: bool = False,
) -> list[RepoResult]:
    """Index each repo once then evaluate each requested mode."""
    results: list[RepoResult] = []

    header = (
        f"{'Repo':<12} {'Language':<12} {'Mode':<16} {'Chunks':>6} {'Tokens':>8}"
        f" {'Index':>9} {'NDCG@5':>8} {'NDCG@10':>8} {'p50':>8} {'p90':>8}"
    )
    print(header, file=sys.stderr)
    print(
        f"{'-' * 12} {'-' * 12} {'-' * 16} {'-' * 6} {'-' * 8} {'-' * 10} {'-' * 8} {'-' * 8} {'-' * 8} {'-' * 8}",
        file=sys.stderr,
    )

    for repo, tasks in sorted(repo_tasks.items()):
        spec = specs[repo]
        if verbose:
            print(f"\n--- {repo} ---", file=sys.stderr)

        started = time.perf_counter()
        index = SembleIndex.from_path(spec.benchmark_dir)
        index_ms = (time.perf_counter() - started) * 1000

        for mode, (alpha, rerank) in sorted(_MODE_PARAMS.items()):
            ndcg5, ndcg10, latencies, by_category, tokens = evaluate(
                index, tasks, alpha=alpha, verbose=verbose, rerank=rerank
            )
            p50, p90, p95, p99 = np.percentile(latencies, [50, 90, 95, 99]).tolist()
            result = RepoResult(
                repo=repo,
                language=spec.language,
                mode=mode,
                chunks=len(index.chunks),
                tokens=tokens,
                ndcg5=ndcg5,
                ndcg10=ndcg10,
                p50_ms=p50,
                p90_ms=p90,
                p95_ms=p95,
                p99_ms=p99,
                index_ms=index_ms,
                by_category=by_category,
            )
            results.append(result)
            print(
                f"{repo:<12} {spec.language:<12} {mode:<16} {len(index.chunks):>6} {tokens:>8}"
                f" {index_ms:>8.0f}ms {ndcg5:>8.3f} {ndcg10:>8.3f} {p50:>7.2f}ms {p90:>7.2f}ms",
                file=sys.stderr,
            )

    return results


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="semble ablation benchmarks.")
    add_filter_args(parser, verbose=True)
    return parser.parse_args()


def main() -> None:
    """Run the semble ablation benchmarks."""
    args = _parse_args()

    repo_specs, tasks = load_filtered_tasks(args.repo or None, args.language or None)

    print("Loading model...", file=sys.stderr)
    started = time.perf_counter()
    print(f"Loaded in {(time.perf_counter() - started) * 1000:.0f}ms", file=sys.stderr)
    print(file=sys.stderr)

    results = _bench(grouped_tasks(tasks), repo_specs, verbose=args.verbose)

    if not results:
        return

    modes = sorted(_MODE_PARAMS)
    print(file=sys.stderr)
    for mode in modes:
        mode_results = [r for r in results if r.mode == mode]
        if not mode_results:
            continue
        avg_ndcg10 = sum(r.ndcg10 for r in mode_results) / len(mode_results)
        avg_p50 = sum(r.p50_ms for r in mode_results) / len(mode_results)
        print(
            f"  {mode:<16}  avg ndcg@10={avg_ndcg10:.3f}  avg p50={avg_p50:.1f}ms  ({len(mode_results)} repos)",
            file=sys.stderr,
        )

    summary = {
        "tool": "semble-ablations",
        "model": DEFAULT_MODEL_NAME,
        "by_mode": summarize_modes(results, modes),
        "repos": [asdict(r) for r in results],
    }
    print(json.dumps(summary, indent=2))

    if not args.repo and not args.language:
        out = save_results("semble-ablations", summary)
        print(f"\nResults saved to {out}", file=sys.stderr)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `benchmarks/baselines/ck.py`
```
import argparse
import json
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

from benchmarks.data import (
    RepoSpec,
    Task,
    add_filter_args,
    grouped_tasks,
    load_filtered_tasks,
    save_results,
)
from benchmarks.metrics import file_rank, ndcg_at_k

_CK = "ck"
_TOP_K = 10
_LATENCY_RUNS = 3
_INDEX_TIMEOUT = 1800
_SEARCH_TIMEOUT = 60


@dataclass(frozen=True)
class RepoResult:
    """Per-repo benchmark result."""

    repo: str
    language: str
    ndcg10: float
    p50_ms: float
    index_ms: float


def _cleanup_index(benchmark_dir: Path) -> None:
    shutil.rmtree(benchmark_dir / ".ck", ignore_errors=True)
    (benchmark_dir / ".ckignore").unlink(missing_ok=True)


def _build_index(benchmark_dir: Path) -> tuple[bool, float]:
    """Build a ck hybrid (BM25 + embedding) index for a repo; return (success, elapsed_ms)."""
    _cleanup_index(benchmark_dir)
    started = time.perf_counter()
    try:
        proc = subprocess.run(
            [_CK, "--index", "--quiet", str(benchmark_dir)],
            capture_output=True,
            text=True,
            timeout=_INDEX_TIMEOUT,
        )
    except subprocess.TimeoutExpired:
        print(f"  WARNING: ck --index timed out after {_INDEX_TIMEOUT}s", file=sys.stderr)
        return False, (time.perf_counter() - started) * 1000
    elapsed_ms = (time.perf_counter() - started) * 1000
    if proc.returncode != 0:
        print(f"  WARNING: ck --index failed: {proc.stderr.strip()[:300]}", file=sys.stderr)
        return False, elapsed_ms
    return True, elapsed_ms


def _run_search(query: str, benchmark_dir: Path, *, top_k: int) -> list[str]:
    """Return absolute file paths from ck's hybrid (regex + semantic) JSON output."""
    cmd = [_CK, "--hybrid", "--json", "--quiet", "--topk", str(top_k), query, str(benchmark_dir)]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=_SEARCH_TIMEOUT)
    except subprocess.TimeoutExpired:
        return []
    # ck exits 1 with "No matches found" on stderr (empty stdout) rather than an empty JSON array.
    # --json with --quiet is actually JSONL (one object per line), not a wrapped JSON array.
    if not proc.stdout.strip():
        return []
    items: list[dict] = []
    for line in proc.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            items.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    seen: dict[str, None] = {}
    for item in items:
        rel = item.get("file", "")
        if rel:
            abs_path = str((benchmark_dir / rel).resolve())
            seen[abs_path] = None
    return list(seen)[:top_k]


def _evaluate_repo(
    tasks: list[Task],
    benchmark_dir: Path,
    *,
    verbose: bool = False,
) -> tuple[float, float]:
    """Return (mean ndcg@10, p50 latency ms) for a list of tasks."""
    ndcg10_sum = 0.0
    latencies: list[float] = []

    for task in tasks:
        query_latencies: list[float] = []
        file_paths: list[str] = []
        for _ in range(_LATENCY_RUNS):
            started = time.perf_counter()
            file_paths = _run_search(task.query, benchmark_dir, top_k=_TOP_K)
            query_latencies.append((time.perf_counter() - started) * 1000)
        latencies.append(sorted(query_latencies)[_LATENCY_RUNS // 2])

        relevant_ranks = [rank for t in task.all_relevant if (rank := file_rank(file_paths, t.path)) is not None]
        q_ndcg10 = ndcg_at_k(relevant_ranks, len(task.all_relevant), _TOP_K)
        ndcg10_sum += q_ndcg10

        if verbose:
            print(
                f"  ndcg@10={q_ndcg10:.3f}  ranks={relevant_ranks}  n_rel={len(task.all_relevant)}  q={task.query!r}",
                file=sys.stderr,
            )
            print(f"    targets: {', '.join(t.path for t in task.all_relevant)}", file=sys.stderr)
            print(f"    top-5:   {[Path(fp).name for fp in file_paths[:5]]}", file=sys.stderr)

    latencies.sort()
    return ndcg10_sum / len(tasks), latencies[len(latencies) // 2]


def _run_repo(spec: RepoSpec, tasks: list[Task], *, verbose: bool) -> RepoResult | None:
    """Index, evaluate, and clean up a single repo."""
    benchmark_dir = spec.benchmark_dir
    ok, index_ms = _build_index(benchmark_dir)
    if not ok:
        print(f"  SKIP: {spec.name} — ck indexing failed", file=sys.stderr)
        _cleanup_index(benchmark_dir)
        return None

    try:
        ndcg10, p50_ms = _evaluate_repo(tasks, benchmark_dir, verbose=verbose)
    finally:
        _cleanup_index(benchmark_dir)

    return RepoResult(repo=spec.name, language=spec.language, ndcg10=ndcg10, p50_ms=p50_ms, index_ms=index_ms)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Benchmark ck on the semble benchmark suite.")
    add_filter_args(parser, verbose=True)
    return parser.parse_args()


def main() -> None:
    """Run the ck baseline benchmark."""
    args = _parse_args()
    repo_specs, tasks = load_filtered_tasks(args.repo or None, args.language or None)

    print("ck (hybrid: regex + bge-small-en-v1.5 semantic, RRF fusion)", file=sys.stderr)
    print(f"{'Repo':<22} {'Language':<12} {'Index':>9} {'NDCG@10':>8} {'p50':>8}", file=sys.stderr)
    print(f"{'-' * 22} {'-' * 12} {'-' * 9} {'-' * 8} {'-' * 8}", file=sys.stderr)

    results: list[RepoResult] = []
    for repo, repo_task_list in sorted(grouped_tasks(tasks).items()):
        spec = repo_specs[repo]
        if args.verbose:
            print(f"\n--- {repo} ---", file=sys.stderr)
        result = _run_repo(spec, repo_task_list, verbose=args.verbose)
        if result is None:
            continue
        results.append(result)
        print(
            f"{repo:<22} {spec.language:<12} {result.index_ms:>8.0f}ms {result.ndcg10:>8.3f} {result.p50_ms:>7.1f}ms",
            file=sys.stderr,
        )

    if not results:
        return

    avg_ndcg10 = sum(r.ndcg10 for r in results) / len(results)
    avg_p50 = sum(r.p50_ms for r in results) / len(results)
    avg_index = sum(r.index_ms for r in results) / len(results)
    print(f"{'-' * 22} {'-' * 12} {'-' * 9} {'-' * 8} {'-' * 8}", file=sys.stderr)
    avg_label = f"Average ({len(results)})"
    print(
        f"{avg_label:<22} {'':<12} {avg_index:>8.0f}ms {avg_ndcg10:>8.3f} {avg_p50:>7.1f}ms",
        file=sys.stderr,
    )

    summary = {
        "tool": "ck",
        "note": "hybrid regex + BAAI/bge-small-en-v1.5 (33M params) semantic search, RRF fusion",
        "repos": [
            {
                "repo": r.repo,
                "language": r.language,
                "ndcg10": round(r.ndcg10, 4),
                "p50_ms": round(r.p50_ms, 1),
                "index_ms": round(r.index_ms, 0),
            }
            for r in results
        ],
        "avg_ndcg10": round(avg_ndcg10, 4),
        "avg_p50_ms": round(avg_p50, 1),
        "avg_index_ms": round(avg_index, 0),
    }
    print(json.dumps(summary, indent=2))

    if not args.repo and not args.language:
        out = save_results("ck", summary)
        print(f"\nResults saved to {out}", file=sys.stderr)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `benchmarks/baselines/codebase_memory.py`
```
import argparse
import json
import re
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

from benchmarks.data import (
    RepoSpec,
    Task,
    add_filter_args,
    grouped_tasks,
    load_filtered_tasks,
    save_results,
)
from benchmarks.metrics import file_rank, ndcg_at_k

_BIN = "codebase-memory-mcp"
_TOP_K = 10
_LATENCY_RUNS = 3
_INDEX_TIMEOUT = 600
_SEARCH_TIMEOUT = 60

# codebase-memory-mcp normalizes non-ASCII/unsafe characters into the project name;
# benchmark repo names are already ASCII-safe slugs, but strip anything it wouldn't accept.
_PROJECT_NAME_RE = re.compile(r"[^a-zA-Z0-9_-]")


@dataclass(frozen=True)
class RepoResult:
    """Per-repo benchmark result."""

    repo: str
    language: str
    ndcg10: float
    p50_ms: float
    index_ms: float


def _project_name(repo: str) -> str:
    return f"semble-bench-{_PROJECT_NAME_RE.sub('-', repo)}"


def _run_cli(args: list[str], *, timeout: int) -> dict | None:
    """Run `codebase-memory-mcp cli ...` and return the parsed structuredContent, or None on failure."""
    cmd = [_BIN, "cli", *args, "--json"]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return None
    if proc.returncode != 0:
        return None
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return None
    if data.get("isError"):
        return None
    return data.get("structuredContent")


def _cleanup_index(project: str) -> None:
    _run_cli(["delete_project", "--project", project], timeout=30)


def _build_index(benchmark_dir: Path, project: str) -> tuple[bool, float]:
    """Index a repo into a fresh graph project; return (success, elapsed_ms)."""
    _cleanup_index(project)
    started = time.perf_counter()
    result = _run_cli(
        ["index_repository", "--repo-path", str(benchmark_dir), "--name", project, "--mode", "fast"],
        timeout=_INDEX_TIMEOUT,
    )
    elapsed_ms = (time.perf_counter() - started) * 1000
    return result is not None, elapsed_ms


def _run_search(query: str, benchmark_dir: Path, project: str, *, top_k: int) -> list[str]:
    """Return absolute file paths from search_graph's BM25-ranked results."""
    result = _run_cli(
        ["search_graph", "--project", project, "--query", query, "--limit", str(top_k)],
        timeout=_SEARCH_TIMEOUT,
    )
    if result is None:
        return []
    seen: dict[str, None] = {}
    for item in result.get("results", []):
        rel = item.get("file_path", "")
        if rel:
            abs_path = str((benchmark_dir / rel).resolve())
            seen[abs_path] = None
    return list(seen)[:top_k]


def _evaluate_repo(
    tasks: list[Task],
    benchmark_dir: Path,
    project: str,
    *,
    verbose: bool = False,
) -> tuple[float, float]:
    """Return (mean ndcg@10, p50 latency ms) for a list of tasks."""
    ndcg10_sum = 0.0
    latencies: list[float] = []

    for task in tasks:
        query_latencies: list[float] = []
        file_paths: list[str] = []
        for _ in range(_LATENCY_RUNS):
            started = time.perf_counter()
            file_paths = _run_search(task.query, benchmark_dir, project, top_k=_TOP_K)
            query_latencies.append((time.perf_counter() - started) * 1000)
        latencies.append(sorted(query_latencies)[_LATENCY_RUNS // 2])

        relevant_ranks = [rank for t in task.all_relevant if (rank := file_rank(file_paths, t.path)) is not None]
        q_ndcg10 = ndcg_at_k(relevant_ranks, len(task.all_relevant), _TOP_K)
        ndcg10_sum += q_ndcg10

        if verbose:
            print(
                f"  ndcg@10={q_ndcg10:.3f}  ranks={relevant_ranks}  n_rel={len(task.all_relevant)}  q={task.query!r}",
                file=sys.stderr,
            )
            print(f"    targets: {', '.join(t.path for t in task.all_relevant)}", file=sys.stderr)
            print(f"    top-5:   {[Path(fp).name for fp in file_paths[:5]]}", file=sys.stderr)

    latencies.sort()
    return ndcg10_sum / len(tasks), latencies[len(latencies) // 2]


def _run_repo(spec: RepoSpec, tasks: list[Task], *, verbose: bool) -> RepoResult | None:
    """Index, evaluate, and clean up a single repo."""
    project = _project_name(spec.name)
    benchmark_dir = spec.benchmark_dir
    ok, index_ms = _build_index(benchmark_dir, project)
    if not ok:
        print(f"  SKIP: {spec.name} — codebase-memory-mcp indexing failed", file=sys.stderr)
        _cleanup_index(project)
        return None

    try:
        ndcg10, p50_ms = _evaluate_repo(tasks, benchmark_dir, project, verbose=verbose)
    finally:
        _cleanup_index(project)

    return RepoResult(repo=spec.name, language=spec.language, ndcg10=ndcg10, p50_ms=p50_ms, index_ms=index_ms)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Benchmark codebase-memory-mcp on the semble benchmark suite.")
    add_filter_args(parser, verbose=True)
    return parser.parse_args()


def main() -> None:
    """Run the codebase-memory-mcp baseline benchmark."""
    args = _parse_args()
    repo_specs, tasks = load_filtered_tasks(args.repo or None, args.language or None)

    print("codebase-memory-mcp (search_graph: BM25 + structural boosting)", file=sys.stderr)
    print(f"{'Repo':<22} {'Language':<12} {'Index':>9} {'NDCG@10':>8} {'p50':>8}", file=sys.stderr)
    print(f"{'-' * 22} {'-' * 12} {'-' * 9} {'-' * 8} {'-' * 8}", file=sys.stderr)

    results: list[RepoResult] = []
    for repo, repo_task_list in sorted(grouped_tasks(tasks).items()):
        spec = repo_specs[repo]
        if args.verbose:
            print(f"\n--- {repo} ---", file=sys.stderr)
        result = _run_repo(spec, repo_task_list, verbose=args.verbose)
        if result is None:
            continue
        results.append(result)
        print(
            f"{repo:<22} {spec.language:<12} {result.index_ms:>8.0f}ms {result.ndcg10:>8.3f} {result.p50_ms:>7.1f}ms",
            file=sys.stderr,
        )

    if not results:
        return

    avg_ndcg10 = sum(r.ndcg10 for r in results) / len(results)
    avg_p50 = sum(r.p50_ms for r in results) / len(results)
    avg_index = sum(r.index_ms for r in results) / len(results)
    print(f"{'-' * 22} {'-' * 12} {'-' * 9} {'-' * 8} {'-' * 8}", file=sys.stderr)
    avg_label = f"Average ({len(results)})"
    print(
        f"{avg_label:<22} {'':<12} {avg_index:>8.0f}ms {avg_ndcg10:>8.3f} {avg_p50:>7.1f}ms",
        file=sys.stderr,
    )

    summary = {
        "tool": "codebase-memory-mcp",
        "note": "search_graph: SQLite FTS5 BM25 with structural boosting (Function/Method +10, Route +8, Class +5); "
        "'fast' index mode (no embeddings)",
        "repos": [
            {
                "repo": r.repo,
                "language": r.language,
                "ndcg10": round(r.ndcg10, 4),
                "p50_ms": round(r.p50_ms, 1),
                "index_ms": round(r.index_ms, 0),
            }
            for r in results
        ],
        "avg_ndcg10": round(avg_ndcg10, 4),
        "avg_p50_ms": round(avg_p50, 1),
        "avg_index_ms": round(avg_index, 0),
    }
    print(json.dumps(summary, indent=2))

    if not args.repo and not args.language:
        out = save_results("codebase-memory-mcp", summary)
        print(f"\nResults saved to {out}", file=sys.stderr)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `benchmarks/baselines/coderankembed.py`
```
import argparse
import json
import sys
import time
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import asdict, dataclass, field
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer

from benchmarks.data import (
    RepoSpec,
    Task,
    add_filter_args,
    grouped_tasks,
    load_filtered_tasks,
    results_path,
    save_results,
)
from benchmarks.metrics import ndcg_at_k, target_rank
from semble.index.create import create_index_from_path
from semble.index.index import SembleIndex
from semble.types import ContentType, SearchResult

_MODEL_NAME = "nomic-ai/CodeRankEmbed"
_TOP_K = 10
_LATENCY_RUNS = 3  # transformer inference is slow; keep runs low
_ALPHA = 1.0  # SembleIndex.search()'s alpha: 1.0 = full semantic weight

_UNSET = object()


class _AsymmetricWrapper:
    """Wrap SentenceTransformer with asymmetric query/document prompts.

    semble only passes use_multiprocessing during index-time calls, never at query time, so its
    presence is a reliable query/document discriminator (batch size is not: single-chunk files are
    real one-element document batches).
    """

    def __init__(self, model: SentenceTransformer, max_seq_length: int = 512) -> None:
        self._model = model
        self._model.max_seq_length = max_seq_length

    def encode(self, texts: Sequence[str], use_multiprocessing: object = _UNSET) -> np.ndarray:
        """Encode with the query prompt only when use_multiprocessing wasn't passed."""
        text_list = list(texts)
        if use_multiprocessing is _UNSET:
            return self._model.encode(text_list, prompt_name="query", batch_size=1)  # type: ignore[return-value]
        return self._model.encode(text_list, batch_size=1)  # type: ignore[return-value]


def _build_index(benchmark_dir: Path, model: _AsymmetricWrapper) -> SembleIndex:
    """Build a SembleIndex using CodeRankEmbed embeddings for both BM25 enrichment and dense search."""
    bm25_index, semantic_index, chunks, _manifest = create_index_from_path(
        benchmark_dir,
        model=model,  # type: ignore[arg-type]
        content=(ContentType.CODE,),  # type: ignore[arg-type]
    )
    return SembleIndex(
        model=model,  # type: ignore[arg-type]
        bm25_index=bm25_index,
        semantic_index=semantic_index,
        chunks=chunks,
        model_path=_MODEL_NAME,
        root=benchmark_dir,
    )


@dataclass(frozen=True)
class RepoResult:
    """Per-repo benchmark result."""

    repo: str
    language: str
    chunks: int
    ndcg5: float
    ndcg10: float
    p50_ms: float
    p90_ms: float
    index_ms: float
    by_category: dict[str, float] = field(default_factory=dict)


def _evaluate(
    index: SembleIndex,
    tasks: list[Task],
    *,
    verbose: bool = False,
) -> tuple[float, float, list[float], dict[str, float]]:
    """Return (mean NDCG@5, NDCG@10, latency list ms, per-category NDCG@10)."""
    ndcg5_sum = 0.0
    ndcg10_sum = 0.0
    latencies: list[float] = []
    category_ndcg10: dict[str, list[float]] = defaultdict(list)

    for task in tasks:
        query_latencies: list[float] = []
        results: list[SearchResult] = []
        for _ in range(_LATENCY_RUNS):
            started = time.perf_counter()
            results = index.search(task.query, top_k=_TOP_K, alpha=_ALPHA)
            query_latencies.append((time.perf_counter() - started) * 1000)
        latencies.append(float(np.median(query_latencies)))

        relevant_ranks = [rank for t in task.all_relevant if (rank := target_rank(results, t)) is not None]
        n_relevant = len(task.all_relevant)
        q_ndcg5 = ndcg_at_k(relevant_ranks, n_relevant, 5)
        q_ndcg10 = ndcg_at_k(relevant_ranks, n_relevant, _TOP_K)
        ndcg5_sum += q_ndcg5
        ndcg10_sum += q_ndcg10
        category_ndcg10[task.category or "unknown"].append(q_ndcg10)

        if verbose:
            category = task.category or "?"
            targets_str = ", ".join(
                t.path if not t.start_line else f"{t.path}:{t.start_line}-{t.end_line}" for t in task.all_relevant
            )
            print(
                f"  [{category:<12}] ndcg@10={q_ndcg10:.3f}  ranks={relevant_ranks}"
                f"  n_rel={n_relevant}  q={task.query!r}",
                file=sys.stderr,
            )
            print(f"               targets: {targets_str}", file=sys.stderr)
            print(f"               top-5:   {[result.chunk.file_path for result in results[:5]]}", file=sys.stderr)

    total = len(tasks)
    by_category = {cat: sum(vals) / len(vals) for cat, vals in sorted(category_ndcg10.items())}
    return ndcg5_sum / total, ndcg10_sum / total, latencies, by_category


def _build_summary(results: list[RepoResult]) -> dict[str, object]:
    """Build the JSON summary dict from the current (possibly partial) results list."""
    n = len(results)
    return {
        "tool": "coderankembed",
        "note": f"{_MODEL_NAME} (137M params), semantic-only dense search (alpha=1.0)",
        "repos": [asdict(result) for result in results],
        "avg_ndcg10": round(sum(r.ndcg10 for r in results) / n, 4) if n else 0.0,
        "avg_p50_ms": round(sum(r.p50_ms for r in results) / n, 1) if n else 0.0,
        "avg_index_ms": round(sum(r.index_ms for r in results) / n, 1) if n else 0.0,
    }


def _load_completed(out_path: Path) -> dict[str, RepoResult]:
    """Load repos already saved in a previous run, keyed by repo name."""
    if not out_path.exists():
        return {}
    try:
        data = json.loads(out_path.read_text(encoding="utf-8"))
        return {entry["repo"]: RepoResult(**entry) for entry in data.get("repos", [])}
    except (json.JSONDecodeError, KeyError, TypeError):
        return {}


def _bench(
    repo_tasks: dict[str, list[Task]],
    specs: dict[str, RepoSpec],
    model: _AsymmetricWrapper,
    out_path: Path | None,
    *,
    verbose: bool = False,
) -> list[RepoResult]:
    """Index and evaluate each repo, saving after every repo."""
    completed = _load_completed(out_path) if out_path else {}
    if completed:
        print(f"Resuming: {len(completed)} repo(s) already done, skipping.", file=sys.stderr)

    results: list[RepoResult] = list(completed.values())

    header = (
        f"{'Repo':<12} {'Language':<12} {'Chunks':>6} {'Index':>9} {'NDCG@5':>8} {'NDCG@10':>8} {'p50':>8} {'p90':>8}"
    )
    print(header, file=sys.stderr)
    print(f"{'-' * 12} {'-' * 12} {'-' * 6} {'-' * 10} {'-' * 8} {'-' * 8} {'-' * 8} {'-' * 8}", file=sys.stderr)

    for repo in sorted(completed):
        r = completed[repo]
        print(
            f"{r.repo:<12} {r.language:<12} {r.chunks:>6}"
            f" {r.index_ms:>8.0f}ms {r.ndcg5:>8.3f} {r.ndcg10:>8.3f}"
            f" {r.p50_ms:>7.2f}ms {r.p90_ms:>7.2f}ms (cached)",
            file=sys.stderr,
        )

    for repo, tasks in sorted(repo_tasks.items()):
        if repo in completed:
            continue
        spec = specs[repo]
        if verbose:
            print(f"\n--- {repo} ---", file=sys.stderr)

        started = time.perf_counter()
        index = _build_index(spec.benchmark_dir, model)
        index_ms = (time.perf_counter() - started) * 1000

        ndcg5, ndcg10, latencies, by_category = _evaluate(index, tasks, verbose=verbose)
        p50, p90 = np.percentile(latencies, [50, 90]).tolist()
        result = RepoResult(
            repo=repo,
            language=spec.language,
            chunks=len(index.chunks),
            ndcg5=ndcg5,
            ndcg10=ndcg10,
            p50_ms=p50,
            p90_ms=p90,
            index_ms=index_ms,
            by_category=by_category,
        )
        results.append(result)
        print(
            f"{repo:<12} {spec.language:<12} {len(index.chunks):>6}"
            f" {index_ms:>8.0f}ms {ndcg5:>8.3f} {ndcg10:>8.3f} {p50:>7.2f}ms {p90:>7.2f}ms",
            file=sys.stderr,
        )

        if out_path:
            save_results("coderankembed", _build_summary(results))

    return results


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Benchmark CodeRankEmbed on the semble benchmark suite.")
    add_filter_args(parser, verbose=True)
    return parser.parse_args()


def main() -> None:
    """Run the CodeRankEmbed baseline benchmark."""
    args = _parse_args()
    is_full_run = not args.repo and not args.language

    repo_specs, tasks = load_filtered_tasks(args.repo or None, args.language or None)

    print(f"Loading {_MODEL_NAME}...", file=sys.stderr)
    started = time.perf_counter()
    raw_model = SentenceTransformer(_MODEL_NAME, trust_remote_code=True)
    model = _AsymmetricWrapper(raw_model)
    print(f"Loaded in {(time.perf_counter() - started) * 1000:.0f}ms", file=sys.stderr)
    print(file=sys.stderr)

    out_path = results_path("coderankembed") if is_full_run else None
    results = _bench(grouped_tasks(tasks), repo_specs, model, out_path, verbose=args.verbose)

    if not results:
        return

    print(file=sys.stderr)
    avg_ndcg10 = sum(r.ndcg10 for r in results) / len(results)
    avg_p50 = sum(r.p50_ms for r in results) / len(results)
    print(f"  avg ndcg@10={avg_ndcg10:.3f}  avg p50={avg_p50:.1f}ms  ({len(results)} repos)", file=sys.stderr)

    summary = _build_summary(results)
    print(json.dumps(summary, indent=2))

    if is_full_run:
        print(f"\nResults saved to {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `benchmarks/baselines/colgrep.py`
```
import argparse
import json
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

from benchmarks.data import (
    RepoSpec,
    Task,
    add_filter_args,
    grouped_tasks,
    load_filtered_tasks,
    results_path,
    save_results,
)
from benchmarks.metrics import file_rank, ndcg_at_k
from benchmarks.tools import run_colgrep_files

_COLGREP = "colgrep"
_TOP_K = 10
_LATENCY_RUNS = 1  # subprocess calls are slow (~3s each); single run is sufficient


@dataclass(frozen=True)
class RepoResult:
    """Per-repo benchmark result."""

    repo: str
    language: str
    ndcg10: float
    p50_ms: float
    index_ms: float


def _evaluate_repo(
    tasks: list[Task], benchmark_dir: Path, *, code_only: bool = True, verbose: bool = False
) -> tuple[float, float]:
    """Return (mean ndcg@10, p50 latency ms) for a list of tasks."""
    ndcg10_sum = 0.0
    latencies: list[float] = []

    for task in tasks:
        query_latencies: list[float] = []
        file_paths: list[str] = []
        for _ in range(_LATENCY_RUNS):
            started = time.perf_counter()
            file_paths = run_colgrep_files(task.query, benchmark_dir, top_k=_TOP_K, code_only=code_only)
            query_latencies.append((time.perf_counter() - started) * 1000)
        latencies.append(sorted(query_latencies)[_LATENCY_RUNS // 2])

        deduped = list(dict.fromkeys(file_paths))

        relevant_ranks = [rank for t in task.all_relevant if (rank := file_rank(deduped, t.path)) is not None]
        q_ndcg10 = ndcg_at_k(relevant_ranks, len(task.all_relevant), _TOP_K)
        ndcg10_sum += q_ndcg10

        if verbose:
            print(
                f"  ndcg@10={q_ndcg10:.3f}  ranks={relevant_ranks}  n_rel={len(task.all_relevant)}  q={task.query!r}",
                file=sys.stderr,
            )
            print(f"    targets: {', '.join(t.path for t in task.all_relevant)}", file=sys.stderr)
            print(f"    top-5:   {[Path(fp).name for fp in deduped[:5]]}", file=sys.stderr)

    latencies.sort()
    return ndcg10_sum / len(tasks), latencies[len(latencies) // 2]


def _init_index(path: Path) -> tuple[bool, float]:
    """Build the ColGREP index and return whether it indexed files plus elapsed time."""
    subprocess.run([_COLGREP, "clear", str(path)], capture_output=True, timeout=30)
    cmd = [_COLGREP, "init", "--force-cpu", "-y", str(path)]
    started = time.perf_counter()
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    index_ms = (time.perf_counter() - started) * 1000
    if proc.returncode != 0:
        print(f"  WARNING: colgrep init failed for {path}: {proc.stderr.strip()}", file=sys.stderr)
    output = proc.stdout + proc.stderr
    non_empty = proc.returncode == 0 and "(0 files)" not in output
    return non_empty, index_ms


def _resolve_path(spec: RepoSpec) -> tuple[Path, float]:
    """Return the path ColGREP should index and elapsed index build time."""
    path = spec.benchmark_dir
    ok, index_ms = _init_index(path)
    if ok:
        return path, index_ms
    # Jump straight to the project root — intermediate subdirectories can produce
    # misleading results (e.g. example-app files outranking core library files).
    root = spec.checkout_dir
    ok, index_ms = _init_index(root)
    if ok:
        print(f"  NOTE: {spec.name} — using checkout root {root} (benchmark_dir gave 0 files)", file=sys.stderr)
        return root, index_ms
    print(f"  WARN: {spec.name} — all candidate paths gave 0 files", file=sys.stderr)
    return path, index_ms


def _build_summary(results: list[RepoResult]) -> dict[str, object]:
    """Build the JSON summary dict from the current (possibly partial) results list."""
    avg_ndcg10 = sum(r.ndcg10 for r in results) / len(results)
    avg_p50 = sum(r.p50_ms for r in results) / len(results)
    avg_index = sum(r.index_ms for r in results) / len(results)
    return {
        "tool": "colgrep",
        "repos": [
            {
                "repo": r.repo,
                "language": r.language,
                "ndcg10": round(r.ndcg10, 4),
                "p50_ms": round(r.p50_ms, 1),
                "index_ms": round(r.index_ms, 0),
            }
            for r in results
        ],
        "avg_ndcg10": round(avg_ndcg10, 4),
        "avg_p50_ms": round(avg_p50, 1),
        "avg_index_ms": round(avg_index, 0),
    }


def _load_completed(out_path: Path) -> dict[str, RepoResult]:
    """Load any already-completed per-repo results from a previous (partial) run."""
    if not out_path.exists():
        return {}
    try:
        data = json.loads(out_path.read_text(encoding="utf-8"))
        return {
            entry["repo"]: RepoResult(
                repo=entry["repo"],
                language=entry["language"],
                ndcg10=entry["ndcg10"],
                p50_ms=entry["p50_ms"],
                index_ms=entry.get("index_ms", 0.0),
            )
            for entry in data.get("repos", [])
        }
    except (json.JSONDecodeError, KeyError, TypeError):
        return {}


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Benchmark ColGREP on the semble benchmark suite.")
    add_filter_args(parser, verbose=True)
    parser.add_argument(
        "--no-code-only",
        action="store_true",
        help="Disable --code-only for all repos (overrides per-language default).",
    )
    return parser.parse_args()


def _run_repos(
    repo_tasks: dict[str, list[Task]],
    repo_specs: dict[str, RepoSpec],
    completed: dict[str, RepoResult],
    out_path: Path | None,
    *,
    no_code_only: bool = False,
    verbose: bool,
) -> list[RepoResult]:
    """Evaluate each repo and save incrementally; return all results."""
    results: list[RepoResult] = list(completed.values())

    print(f"{'Repo':<22} {'Language':<12} {'Index':>9} {'NDCG@10':>8} {'p50':>8}", file=sys.stderr)
    print(f"{'-' * 22} {'-' * 12} {'-' * 9} {'-' * 8} {'-' * 8}", file=sys.stderr)
    for r in sorted(results, key=lambda r: r.repo):
        print(
            f"{r.repo:<22} {r.language:<12} {r.index_ms:>8.0f}ms {r.ndcg10:>8.3f} {r.p50_ms:>7.1f}ms (cached)",
            file=sys.stderr,
        )

    for repo, repo_task_list in sorted(repo_tasks.items()):
        if repo in completed:
            continue
        spec = repo_specs[repo]
        # bash files (.sh, .bash) are excluded by --code-only; disable it for bash repos
        code_only = not no_code_only and spec.language != "bash"
        if verbose:
            print(f"\n--- {repo} (code_only={code_only}) ---", file=sys.stderr)
        path, index_ms = _resolve_path(spec)
        ndcg10, p50_ms = _evaluate_repo(repo_task_list, path, code_only=code_only, verbose=verbose)
        result = RepoResult(repo=repo, language=spec.language, ndcg10=ndcg10, p50_ms=p50_ms, index_ms=index_ms)
        results.append(result)
        print(f"{repo:<22} {spec.language:<12} {index_ms:>8.0f}ms {ndcg10:>8.3f} {p50_ms:>7.1f}ms", file=sys.stderr)
        if out_path:
            save_results("colgrep", _build_summary(results))

    return results


def main() -> None:
    """Run the ColGREP baseline benchmark."""
    args = _parse_args()
    is_full_run = not args.repo and not args.language

    repo_specs, tasks = load_filtered_tasks(args.repo or None, args.language or None)

    repo_tasks = grouped_tasks(tasks)

    out_path = results_path("colgrep") if is_full_run else None
    completed = _load_completed(out_path) if out_path else {}
    if completed:
        print(f"Resuming: {len(completed)} repo(s) already done, skipping.", file=sys.stderr)

    results = _run_repos(
        repo_tasks, repo_specs, completed, out_path, no_code_only=args.no_code_only, verbose=args.verbose
    )

    if not results:
        return

    avg_ndcg10 = sum(r.ndcg10 for r in results) / len(results)
    avg_p50 = sum(r.p50_ms for r in results) / len(results)
    avg_index = sum(r.index_ms for r in results) / len(results)
    print(f"{'-' * 22} {'-' * 12} {'-' * 9} {'-' * 8} {'-' * 8}", file=sys.stderr)
    avg_row = (
        f"{'Average (' + str(len(results)) + ')':<22} {'':<12} {avg_index:>8.0f}ms {avg_ndcg10:>8.3f} {avg_p50:>7.1f}ms"
    )
    print(avg_row, file=sys.stderr)

    summary = _build_summary(results)
    print(json.dumps(summary, indent=2))

    if is_full_run:
        print(f"\nResults saved to {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `benchmarks/baselines/cs.py`
```
import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path

from benchmarks.data import (
    Task,
    add_filter_args,
    grouped_tasks,
    load_filtered_tasks,
    save_results,
)
from benchmarks.metrics import file_rank, ndcg_at_k
from benchmarks.tools import run_cs

_TOP_K = 10
_LATENCY_RUNS = 3


@dataclass(frozen=True)
class RepoResult:
    """Per-repo benchmark result."""

    repo: str
    language: str
    ndcg10: float
    p50_ms: float


def _evaluate_repo(
    tasks: list[Task],
    benchmark_dir: Path,
    *,
    verbose: bool = False,
) -> tuple[float, float]:
    """Return (mean ndcg@10, p50 latency ms) for a list of tasks."""
    ndcg10_sum = 0.0
    latencies: list[float] = []

    for task in tasks:
        query_latencies: list[float] = []
        file_paths: list[str] = []
        for _ in range(_LATENCY_RUNS):
            started = time.perf_counter()
            file_paths = run_cs(task.query, benchmark_dir, top_k=_TOP_K)
            query_latencies.append((time.perf_counter() - started) * 1000)
        latencies.append(sorted(query_latencies)[_LATENCY_RUNS // 2])

        relevant_ranks = [rank for t in task.all_relevant if (rank := file_rank(file_paths, t.path)) is not None]
        q_ndcg10 = ndcg_at_k(relevant_ranks, len(task.all_relevant), _TOP_K)
        ndcg10_sum += q_ndcg10

        if verbose:
            print(
                f"  ndcg@10={q_ndcg10:.3f}  ranks={relevant_ranks}  n_rel={len(task.all_relevant)}  q={task.query!r}",
                file=sys.stderr,
            )
            print(f"    targets: {', '.join(t.path for t in task.all_relevant)}", file=sys.stderr)
            print(f"    top-5:   {[Path(fp).name for fp in file_paths[:5]]}", file=sys.stderr)

    latencies.sort()
    return ndcg10_sum / len(tasks), latencies[len(latencies) // 2]


def main() -> None:
    """Run the cs (Code Spelunker) baseline benchmark."""
    import argparse

    parser = argparse.ArgumentParser(description="Benchmark cs (Code Spelunker) on the semble benchmark suite.")
    add_filter_args(parser, verbose=True)
    args = parser.parse_args()

    repo_specs, tasks = load_filtered_tasks(args.repo or None, args.language or None)

    print("cs (structural BM25 ranker, no index)", file=sys.stderr)
    print(f"{'Repo':<22} {'Language':<12} {'NDCG@10':>8} {'p50':>8}", file=sys.stderr)
    print(f"{'-' * 22} {'-' * 12} {'-' * 8} {'-' * 8}", file=sys.stderr)

    results: list[RepoResult] = []
    for repo, repo_task_list in sorted(grouped_tasks(tasks).items()):
        spec = repo_specs[repo]
        if args.verbose:
            print(f"\n--- {repo} ---", file=sys.stderr)
        ndcg10, p50_ms = _evaluate_repo(repo_task_list, spec.benchmark_dir, verbose=args.verbose)
        results.append(RepoResult(repo=repo, language=spec.language, ndcg10=ndcg10, p50_ms=p50_ms))
        print(f"{repo:<22} {spec.language:<12} {ndcg10:>8.3f} {p50_ms:>7.1f}ms", file=sys.stderr)

    if not results:
        return

    avg_ndcg10 = sum(r.ndcg10 for r in results) / len(results)
    avg_p50 = sum(r.p50_ms for r in results) / len(results)
    print(f"{'-' * 22} {'-' * 12} {'-' * 8} {'-' * 8}", file=sys.stderr)
    print(f"{'Average (' + str(len(results)) + ')':<22} {'':<12} {avg_ndcg10:>8.3f} {avg_p50:>7.1f}ms", file=sys.stderr)

    summary = {
        "tool": "cs",
        "note": "structural BM25 ranker, tree-sitter aware, no persistent index",
        "repos": [
            {"repo": r.repo, "language": r.language, "ndcg10": round(r.ndcg10, 4), "p50_ms": round(r.p50_ms, 1)}
            for r in results
        ],
        "avg_ndcg10": round(avg_ndcg10, 4),
        "avg_p50_ms": round(avg_p50, 1),
    }
    print(json.dumps(summary, indent=2))

    if not args.repo and not args.language:
        out = save_results("cs", summary)
        print(f"\nResults saved to {out}", file=sys.stderr)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `benchmarks/baselines/grepai.py`
```
import argparse
import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path

from benchmarks.data import (
    RepoSpec,
    Task,
    apply_task_filters,
    available_repo_specs,
    grouped_tasks,
    load_tasks,
    save_results,
)
from benchmarks.metrics import file_rank, ndcg_at_k

_GREPAI = "grepai"
_TOP_K = 10
_LATENCY_RUNS = 1  # Ollama embedding calls are slow; single run is sufficient
_INDEX_TIMEOUT = 300
_SEARCH_TIMEOUT = 60
_WATCH_READY_TIMEOUT = 120  # overridden by --timeout


@dataclass(frozen=True)
class RepoResult:
    """Per-repo benchmark result."""

    repo: str
    language: str
    ndcg10: float
    p50_ms: float
    index_ms: float


def _cleanup_index(benchmark_dir: Path) -> None:
    d = benchmark_dir / ".grepai"
    if d.exists():
        shutil.rmtree(d, ignore_errors=True)


def _build_index(benchmark_dir: Path, *, watch_ready_timeout: int = _WATCH_READY_TIMEOUT) -> tuple[bool, float]:
    """Init and index a repo with grepai; return (success, elapsed_ms)."""
    _cleanup_index(benchmark_dir)

    init_proc = subprocess.run(
        [_GREPAI, "init", "--provider", "ollama", "--yes"],
        capture_output=True,
        text=True,
        cwd=benchmark_dir,
        timeout=30,
    )
    if init_proc.returncode != 0:
        print(f"  WARNING: grepai init failed: {init_proc.stderr.strip()}", file=sys.stderr)
        return False, 0.0

    # grepai writes progress bars with \r (no \n), so readline() blocks forever.
    # Write stdout to a temp file and poll for the sentinel string instead.
    # "Initial scan complete" appears after file scanning but BEFORE embeddings
    # finish. Wait for 3 s of output silence after that sentinel to ensure all
    # embeddings have been flushed to disk before killing watch.
    started = time.perf_counter()
    watch_proc: subprocess.Popen[bytes] | None = None
    with tempfile.TemporaryFile() as log_f:
        watch_proc = subprocess.Popen(
            [_GREPAI, "watch"],
            stdout=log_f,
            stderr=subprocess.STDOUT,
            cwd=benchmark_dir,
            start_new_session=True,  # Own process group so killpg doesn't hit us
        )
        try:
            deadline = time.perf_counter() + watch_ready_timeout
            scan_complete = False
            last_size = 0
            idle_since: float | None = None
            _IDLE_SETTLE = 3.0  # seconds of silence after scan_complete → embeddings done

            while time.perf_counter() < deadline:
                time.sleep(0.3)
                log_f.seek(0)
                content = log_f.read()
                if not scan_complete and b"Initial scan complete" in content:
                    scan_complete = True
                    idle_since = time.perf_counter()
                if scan_complete:
                    if len(content) != last_size:
                        idle_since = time.perf_counter()
                        last_size = len(content)
                    elif idle_since is not None and (time.perf_counter() - idle_since) >= _IDLE_SETTLE:
                        return True, (time.perf_counter() - started) * 1000
                if watch_proc.poll() is not None:
                    if scan_complete:
                        return True, (time.perf_counter() - started) * 1000
                    break
            print(
                f"  WARNING: grepai watch timed out after {watch_ready_timeout}s",
                file=sys.stderr,
            )
            return False, (time.perf_counter() - started) * 1000
        finally:
            try:
                os.killpg(os.getpgid(watch_proc.pid), signal.SIGTERM)
            except (ProcessLookupError, PermissionError):
                pass
            watch_proc.wait(timeout=5)


def _run_search(query: str, benchmark_dir: Path, *, top_k: int) -> list[str]:
    """Return absolute file paths from grepai JSON search output."""
    cmd = [_GREPAI, "search", query, "--json", "-n", str(top_k)]
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=_SEARCH_TIMEOUT,
            cwd=benchmark_dir,
        )
    except subprocess.TimeoutExpired:
        return []
    if proc.returncode != 0:
        return []
    try:
        items = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return []
    # grepai returns relative paths; make them absolute.
    seen: dict[str, None] = {}
    for item in items:
        rel = item.get("file_path", "")
        if rel:
            abs_path = str((benchmark_dir / rel).resolve())
            seen[abs_path] = None
    return list(seen)[:top_k]


def _evaluate_repo(
    tasks: list[Task],
    benchmark_dir: Path,
    *,
    verbose: bool = False,
) -> tuple[float, float]:
    """Return (mean ndcg@10, p50 latency ms) for a list of tasks."""
    ndcg10_sum = 0.0
    latencies: list[float] = []

    for task in tasks:
        query_latencies: list[float] = []
        file_paths: list[str] = []
        for _ in range(_LATENCY_RUNS):
            started = time.perf_counter()
            file_paths = _run_search(task.query, benchmark_dir, top_k=_TOP_K)
            query_latencies.append((time.perf_counter() - started) * 1000)
        latencies.append(sorted(query_latencies)[_LATENCY_RUNS // 2])

        relevant_ranks = [rank for t in task.all_relevant if (rank := file_rank(file_paths, t.path)) is not None]
        q_ndcg10 = ndcg_at_k(relevant_ranks, len(task.all_relevant), _TOP_K)
        ndcg10_sum += q_ndcg10

        if verbose:
            print(
                f"  ndcg@10={q_ndcg10:.3f}  ranks={relevant_ranks}  n_rel={len(task.all_relevant)}  q={task.query!r}",
                file=sys.stderr,
            )
            print(f"    targets: {', '.join(t.path for t in task.all_relevant)}", file=sys.stderr)
            print(f"    top-5:   {[Path(fp).name for fp in file_paths[:5]]}", file=sys.stderr)

    latencies.sort()
    return ndcg10_sum / len(tasks), latencies[len(latencies) // 2]


def _run_repo(
    spec: RepoSpec,
    tasks: list[Task],
    *,
    verbose: bool,
    watch_ready_timeout: int = _WATCH_READY_TIMEOUT,
) -> RepoResult | None:
    """Index, evaluate, and clean up a single repo."""
    benchmark_dir = spec.benchmark_dir
    ok, index_ms = _build_index(benchmark_dir, watch_ready_timeout=watch_ready_timeout)
    if not ok:
        print(f"  SKIP: {spec.name} — grepai indexing failed", file=sys.stderr)
        return None

    try:
        ndcg10, p50_ms = _evaluate_repo(tasks, benchmark_dir, verbose=verbose)
    finally:
        _cleanup_index(benchmark_dir)

    return RepoResult(repo=spec.name, language=spec.language, ndcg10=ndcg10, p50_ms=p50_ms, index_ms=index_ms)


def _build_summary(results: list[RepoResult]) -> dict:
    avg_ndcg10 = sum(r.ndcg10 for r in results) / len(results)
    avg_p50 = sum(r.p50_ms for r in results) / len(results)
    avg_index = sum(r.index_ms for r in results) / len(results)
    return {
        "tool": "grepai",
        "note": "nomic-embed-text via Ollama (137 M params, ~8× larger than semble's potion-code-16M)",
        "repos": [
            {
                "repo": r.repo,
                "language": r.language,
                "ndcg10": round(r.ndcg10, 4),
                "p50_ms": round(r.p50_ms, 1),
                "index_ms": round(r.index_ms, 0),
            }
            for r in results
        ],
        "avg_ndcg10": round(avg_ndcg10, 4),
        "avg_p50_ms": round(avg_p50, 1),
        "avg_index_ms": round(avg_index, 0),
    }


def _write_results(results: list[RepoResult], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(_build_summary(results), indent=2))


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Benchmark grepai on the semble benchmark suite.")
    parser.add_argument("--repo", action="append", default=[], help="Limit to one or more repo names.")
    parser.add_argument("--language", action="append", default=[], help="Limit to one or more languages.")
    parser.add_argument("--verbose", action="store_true", help="Print per-query results.")
    parser.add_argument(
        "--output",
        metavar="FILE",
        help="JSON file to write results to; if it already exists, repos already present are skipped (resume mode).",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=_WATCH_READY_TIMEOUT,
        metavar="SECONDS",
        help=f"Seconds to wait for embeddings to finish (default: {_WATCH_READY_TIMEOUT}). "
        "Increase for large repos (e.g. --timeout 1800).",
    )
    return parser.parse_args()


def _load_existing(output_path: Path | None) -> dict[str, dict]:
    """Load already-completed repos from a prior run's output file."""
    if output_path is None or not output_path.exists():
        return {}
    try:
        existing_data = json.loads(output_path.read_text())
        existing = {r["repo"]: r for r in existing_data.get("repos", [])}
        print(f"Resuming: {len(existing)} repos already done, will skip them.", file=sys.stderr)
        return existing
    except (json.JSONDecodeError, KeyError):
        return {}


def main() -> None:
    """Run the grepai baseline benchmark."""
    args = _parse_args()
    repo_specs = available_repo_specs()
    tasks = apply_task_filters(
        load_tasks(repo_specs=repo_specs), repos=args.repo or None, languages=args.language or None
    )

    output_path = Path(args.output) if args.output else None
    existing = _load_existing(output_path)

    print("grepai (ollama/nomic-embed-text, 137M params)", file=sys.stderr)
    print(f"{'Repo':<22} {'Language':<12} {'Index':>9} {'NDCG@10':>8} {'p50':>8}", file=sys.stderr)
    print(f"{'-' * 22} {'-' * 12} {'-' * 9} {'-' * 8} {'-' * 8}", file=sys.stderr)

    results: list[Repo
```

### Core Architecture Module: `benchmarks/baselines/probe.py`
```
import argparse
import json
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

from benchmarks.data import (
    Task,
    apply_task_filters,
    available_repo_specs,
    grouped_tasks,
    load_tasks,
    save_results,
)
from benchmarks.metrics import file_rank, ndcg_at_k

_TOP_K = 10
_LATENCY_RUNS = 3


@dataclass(frozen=True)
class RepoResult:
    """Per-repo benchmark result."""

    repo: str
    language: str
    ndcg10: float
    p50_ms: float


def _run_probe(query: str, benchmark_dir: Path, *, top_k: int, timeout: int = 30) -> list[str]:
    """Return file paths from probe JSON output, deduplicated and capped at top_k."""
    cmd = [
        "probe",
        "search",
        query,
        str(benchmark_dir),
        "--format",
        "json",
        "--max-results",
        str(top_k * 3),  # probe returns chunk-level results; over-fetch and dedup
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return []
    if proc.returncode != 0:
        return []
    # probe prefixes stdout with non-JSON header lines ("Pattern: ...\nPath: ...\n")
    # before the JSON object; skip to the first '{'.
    json_start = proc.stdout.find("{")
    if json_start < 0:
        return []
    try:
        data = json.loads(proc.stdout[json_start:])
    except json.JSONDecodeError:
        return []
    seen: dict[str, None] = {}
    for item in data.get("results", []):
        fp = item.get("file", "")
        if fp:
            seen[fp] = None
    return list(seen)[:top_k]


def _evaluate_repo(
    tasks: list[Task],
    benchmark_dir: Path,
    *,
    verbose: bool = False,
) -> tuple[float, float]:
    """Return (mean ndcg@10, p50 latency ms) for a list of tasks."""
    ndcg10_sum = 0.0
    latencies: list[float] = []

    for task in tasks:
        query_latencies: list[float] = []
        file_paths: list[str] = []
        for _ in range(_LATENCY_RUNS):
            started = time.perf_counter()
            file_paths = _run_probe(task.query, benchmark_dir, top_k=_TOP_K)
            query_latencies.append((time.perf_counter() - started) * 1000)
        latencies.append(sorted(query_latencies)[_LATENCY_RUNS // 2])

        relevant_ranks = [rank for t in task.all_relevant if (rank := file_rank(file_paths, t.path)) is not None]
        q_ndcg10 = ndcg_at_k(relevant_ranks, len(task.all_relevant), _TOP_K)
        ndcg10_sum += q_ndcg10

        if verbose:
            print(
                f"  ndcg@10={q_ndcg10:.3f}  ranks={relevant_ranks}  n_rel={len(task.all_relevant)}  q={task.query!r}",
                file=sys.stderr,
            )
            print(f"    targets: {', '.join(t.path for t in task.all_relevant)}", file=sys.stderr)
            print(f"    top-5:   {[Path(fp).name for fp in file_paths[:5]]}", file=sys.stderr)

    latencies.sort()
    return ndcg10_sum / len(tasks), latencies[len(latencies) // 2]


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Benchmark probe on the semble benchmark suite.")
    parser.add_argument("--repo", action="append", default=[], help="Limit to one or more repo names.")
    parser.add_argument("--language", action="append", default=[], help="Limit to one or more languages.")
    parser.add_argument("--verbose", action="store_true", help="Print per-query results.")
    return parser.parse_args()


def main() -> None:
    """Run the probe baseline benchmark."""
    args = _parse_args()
    repo_specs = available_repo_specs()
    tasks = apply_task_filters(
        load_tasks(repo_specs=repo_specs), repos=args.repo or None, languages=args.language or None
    )

    print("probe (bm25, tree-sitter)", file=sys.stderr)
    print("NOTE: probe uses keyword ranking; natural-language queries disadvantage it.", file=sys.stderr)
    print(f"{'Repo':<22} {'Language':<12} {'NDCG@10':>8} {'p50':>8}", file=sys.stderr)
    print(f"{'-' * 22} {'-' * 12} {'-' * 8} {'-' * 8}", file=sys.stderr)

    results: list[RepoResult] = []
    for repo, repo_task_list in sorted(grouped_tasks(tasks).items()):
        spec = repo_specs[repo]
        if args.verbose:
            print(f"\n--- {repo} ---", file=sys.stderr)
        ndcg10, p50_ms = _evaluate_repo(repo_task_list, spec.benchmark_dir, verbose=args.verbose)
        results.append(RepoResult(repo=repo, language=spec.language, ndcg10=ndcg10, p50_ms=p50_ms))
        print(f"{repo:<22} {spec.language:<12} {ndcg10:>8.3f} {p50_ms:>7.1f}ms", file=sys.stderr)

    if not results:
        return

    avg_ndcg10 = sum(r.ndcg10 for r in results) / len(results)
    avg_p50 = sum(r.p50_ms for r in results) / len(results)
    print(f"{'-' * 22} {'-' * 12} {'-' * 8} {'-' * 8}", file=sys.stderr)
    avg_label = f"Average ({len(results)})"
    print(
        f"{avg_label:<22} {'':<12} {avg_ndcg10:>8.3f} {avg_p50:>7.1f}ms",
        file=sys.stderr,
    )

    summary = {
        "tool": "probe",
        "note": "BM25 + tree-sitter; no embedding model, no persistent index; natural-language queries disadvantage it",
        "repos": [
            {"repo": r.repo, "language": r.language, "ndcg10": round(r.ndcg10, 4), "p50_ms": round(r.p50_ms, 1)}
            for r in results
        ],
        "avg_ndcg10": round(avg_ndcg10, 4),
        "avg_p50_ms": round(avg_p50, 1),
    }
    save_results("probe", summary)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #58** (2026-05-07): **Doesn't work well on windows**
  *Symptoms*: <img width="1148" height="582" alt="Image" src="https://github.com/user-attachments/assets/005f97b9-d318-4374-b9e3-0a835874acde" />
  **Post-Mortem & Fix Analysis**:
  > Hey @spivak321c, can you share your environment maybe? I have not seen this error before, did you install the optional MCP dependency group for Semble as well?
  > I think the issue here is that `resource` is a UNIX exclusive package and not available for Windows, meaning we can't use Semble on a pure Windows environment, which is a shame.
  > Little bit of research suggests that `psutil` would be closest cross-platform alternative, but I haven't peeped the source to understand how `resource` is being used; so I'm not sure how viable it'd be as a replacement or platform alternative with a wrapper.

- **Issue #46** (2026-05-04): **[BUG] Can't Add MCP for Claude**
  *Symptoms*: I am unable to add semble mcp for claude code and claude desktop.  ### Environment - OS: Windows 10 - Powershell - UV installed locally - Claude Code installed and updated   ### How to reproduce this error Just run: ```bash claude mcp add semble -s user -- uvx --from "semble[mcp]" semble  ```   As written in [README: Claude Section](https://github.com/MinishLab/semble#claude-code)  ### Exact Error Log  ```text error: unknown option '--from' ```
  **Post-Mortem & Fix Analysis**:
  > You are probably running an old version of `uv`. It does exist, see [the docs](https://docs.astral.sh/uv/guides/tools/#commands-with-different-package-names). Please upgrade and try again.
  > Closing since this the option does exist. If you run into any other issues please let us know!

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

### Incident Patch 1: `f1daa42a` (2026-10-05)
**Commit Message**: fix: Exit the MCP server immediately on stdin EOF or SIGTERM (#282)

**File**: `src/semble/cache.py` (modified, +4/-1)
```diff
@@ -117,7 +117,10 @@ def _load_matching_metadata(
     persistence_path = PersistencePath.from_path(find_index_from_cache_folder(path, content))
     if persistence_path.non_existing():
         return None
-    metadata = json.loads(persistence_path.metadata.read_text(encoding="utf-8"))
+    try:
+        metadata = json.loads(persistence_path.metadata.read_text(encoding="utf-8"))
+    except ValueError:  # Truncated by a process killed mid-save; treat as a miss so the index is rebuilt.
+        return None
     if model_path is None:
         model_path = resolve_model_name()
     if not _metadata_matches(metadata, model_path, content):
```

**File**: `src/semble/cli.py` (modified, +6/-1)
```diff
@@ -3,7 +3,9 @@
 import io
 import json
 import logging
+import os
 import re
+import signal
 import sys
 import warnings
 from collections.abc import Iterator
@@ -100,6 +102,7 @@ def main() -> None:
 
 
 def _mcp_main() -> None:
+    signal.signal(signal.SIGTERM, lambda *_: os._exit(0))
     parser = argparse.ArgumentParser(
         prog="semble",
         description="Instant local code search for agents.",
@@ -112,7 +115,9 @@ def _mcp_main() -> None:
     from semble.mcp import serve
 
     content = _resolve_content(args.content, args.include_text_files)
-    asyncio.run(serve(content))
+    asyncio.new_event_loop().run_until_complete(serve(content))
+    # Skip asyncio.run's shutdown, which waits for threads still loading the model or building an index.
+    os._exit(0)
 
 
 def _resolve_content(content: list[str], include_text_files: bool) -> list[ContentType]:
```

**File**: `src/semble/version.py` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
-__version_triple__ = (0, 6, 1)
+__version_triple__ = (0, 6, 2)
 __version__ = ".".join(map(str, __version_triple__))
```

**File**: `tests/index/test_create.py` (modified, +1/-4)
```diff
@@ -135,10 +135,7 @@ def test_load_previous_for_incremental_fails_closed(corrupt: str, tmp_path: Path
             bm25["doc_order"].reverse()
             bm25_path.write_bytes(orjson.dumps(bm25))
         elif corrupt == "corrupt_json":
-            (index_path / "metadata.json").write_bytes(b"{not json")
-            with patch("semble.cache.find_index_from_cache_folder", return_value=index_path):
-                assert load_previous_for_incremental("/some/path", "my/model", [ContentType.CODE]) is None
-            return
+            (index_path / "chunks.json").write_bytes(b"{not json")
         (index_path / "metadata.json").write_bytes(orjson.dumps(metadata))
 
     with patch("semble.cache.find_index_from_cache_folder", return_value=index_path):
```

**File**: `tests/test_cache.py` (modified, +7/-1)
```diff
@@ -149,7 +149,7 @@ def _write_metadata(
 
 
 def test_get_validated_cache_invalid_index(tmp_path: Path) -> None:
-    """Returns None when the index directory is missing or incomplete."""
+    """Returns None when the index directory is missing, incomplete, or has truncated metadata."""
     with patch("semble.cache.find_index_from_cache_folder", return_value=tmp_path / "missing"):
         assert get_validated_cache("/path", None, [ContentType.CODE]) is None
 
@@ -158,6 +158,12 @@ def test_get_validated_cache_invalid_index(tmp_path: Path) -> None:
     with patch("semble.cache.find_index_from_cache_folder", return_value=index_path):
         assert get_validated_cache("/path", None, [ContentType.CODE]) is None
 
+    _write_metadata(index_path, "my/model", ["code"], 0.0)
+    metadata = index_path / "metadata.json"
+    metadata.write_text(metadata.read_text()[:20])
+    with patch("semble.cache.find_index_from_cache_folder", return_value=index_path):
+        assert get_validated_cache("/path", "my/model", [ContentType.CODE]) is None
+
 
 @pytest.mark.parametrize(
     ("stored_model", "stored_content", "req_model", "req_content"),
```

**File**: `tests/test_cli.py` (modified, +19/-6)
```diff
@@ -1,10 +1,12 @@
+import asyncio
 import hashlib
 import json
+import signal
 import sys
 import warnings
 from importlib.resources import files
 from pathlib import Path
-from unittest.mock import MagicMock, patch
+from unittest.mock import AsyncMock, MagicMock, patch
 
 import pytest
 
@@ -20,13 +22,24 @@
         ["semble"],
     ],
 )
-def test_main_calls_asyncio_run(argv: list[str], monkeypatch: pytest.MonkeyPatch) -> None:
-    """main() delegates to asyncio.run(serve(...)) when no CLI subcommand is given."""
+def test_mcp_main_serves_then_exits(argv: list[str], monkeypatch: pytest.MonkeyPatch) -> None:
+    """main() serves MCP, then hard-exits with 0 on stdin EOF or SIGTERM instead of joining worker threads."""
     monkeypatch.setattr(sys, "argv", argv)
-    with patch("asyncio.run") as mock_run:
-        mock_run.side_effect = lambda coro: coro.close()
+    loop = asyncio.new_event_loop()
+    with (
+        patch("semble.cli.asyncio.new_event_loop", return_value=loop),
+        patch("semble.mcp.serve", new=AsyncMock()) as mock_serve,
+        patch("semble.cli.signal.signal") as mock_signal,
+        patch("semble.cli.os._exit") as mock_exit,
+    ):
         main()
-    mock_run.assert_called_once()
+        mock_serve.assert_awaited_once()
+        mock_exit.assert_called_once_with(0)
+        signum, handler = mock_signal.call_args.args
+        assert signum == signal.SIGTERM
+        handler(signum, None)
+        mock_exit.assert_called_with(0)
+    loop.close()
 
 
 @pytest.mark.parametrize(
```

---

### Incident Patch 2: `8c55ebb7` (2026-10-05)
**Commit Message**: fix: Use manifest mtimes for cache validation (#281)

* Fix cache issue

* Test coverage

* Skip files deleted during validation

* Call stat() only once

**File**: `src/semble/cache.py` (modified, +10/-6)
```diff
@@ -136,19 +136,23 @@ def get_validated_cache(path: str, model_path: str | None, content: Sequence[Con
     if is_git_url(str(path)):
         return index_path
 
-    write_time = metadata["time"]
     extensions = get_extensions(content)
 
     path_as_path = Path(path).resolve()
     stored_files = metadata.get("files", {})
     current_files = []
     for file_path in walk_files(path_as_path, extensions=extensions):
-        file_status = get_file_status(file_path, write_time)
-        if file_status == FileStatus.NEWER:
+        try:
+            stat = file_path.stat()
+            if get_file_status(file_path, stat) != FileStatus.VALID:
+                continue
+        except FileNotFoundError:
+            continue  # deleted mid-walk
+        indexed_path = str(file_path.relative_to(path_as_path))
+        stored = stored_files.get(indexed_path)
+        if stored is not None and stored.get("mtime_ns") != stat.st_mtime_ns:
             return None
-        if file_status != FileStatus.VALID:
-            continue
-        current_files.append(str(file_path.relative_to(path_as_path)))
+        current_files.append(indexed_path)
 
     if set(current_files) != set(stored_files):
         return None
```

**File**: `src/semble/index/create.py` (modified, +3/-2)
```diff
@@ -115,14 +115,15 @@ def create_index_from_path(
     ):
         language = detect_language(file_path)
         with contextlib.suppress(OSError):
-            file_status = get_file_status(file_path, None)
+            stat = file_path.stat()
+            file_status = get_file_status(file_path, stat)
             if file_status is FileStatus.TOO_LARGE:
                 skipped_large.append(str(file_path))
             if file_status != FileStatus.VALID:
                 continue
 
             indexed_path = str(file_path.relative_to(display_root) if display_root else file_path)
-            mtime_ns = file_path.stat().st_mtime_ns
+            mtime_ns = stat.st_mtime_ns
             previous_entry = previous_manifest.get(indexed_path)
 
             if previous is not None and previous_entry is not None and previous_entry.mtime_ns == mtime_ns:
```

**File**: `src/semble/index/files.py` (modified, +2/-7)
```diff
@@ -472,7 +472,6 @@ def get_extensions(types: Sequence[ContentType]) -> list[str]:
 
 
 class FileStatus(str, Enum):
-    NEWER = "newer"
     TOO_LARGE = "too_large"
     EMPTY = "empty"
     VALID = "valid"
@@ -483,12 +482,8 @@ def read_file_text(file_path: Path) -> str:
     return file_path.read_text(encoding="utf-8", errors="replace")
 
 
-def get_file_status(file_path: Path, write_time: float | None) -> FileStatus:
-    """Checks if a file should be indexed based on its size and modification time."""
-    stat = file_path.stat()
-    if write_time is not None and stat.st_mtime > write_time:
-        # Index invalid, file invalid
-        return FileStatus.NEWER
+def get_file_status(file_path: Path, stat: os.stat_result) -> FileStatus:
+    """Checks if a file should be indexed based on its size."""
     size = stat.st_size
     if size > MAX_FILE_BYTES:
         # index valid, file invalid
```

**File**: `tests/index/test_index.py` (modified, +1/-1)
```diff
@@ -93,7 +93,7 @@ def test_tiny_invalid_utf8_file_status_does_not_crash(tmp_path: Path) -> None:
     """Tiny files with invalid UTF-8 bytes are treated as non-empty."""
     path = tmp_path / "latin1.py"
     path.write_bytes(b"\xff")
-    assert get_file_status(path, None) is FileStatus.VALID
+    assert get_file_status(path, path.stat()) is FileStatus.VALID
 
 
 def test_merge(mock_model: Any, tmp_project: Path, tmp_path_factory: pytest.TempPathFactory) -> None:
```

**File**: `tests/test_cache.py` (modified, +23/-16)
```diff
@@ -2,6 +2,7 @@
 
 import builtins
 import json
+import os
 import sys
 from pathlib import Path
 from unittest.mock import MagicMock, patch
@@ -276,30 +277,36 @@ def test_get_validated_cache_git_url_returns_immediately(tmp_path: Path) -> None
 
 
 @pytest.mark.parametrize(
-    ("write_time", "walk_result", "write", "expected"),
+    ("text", "mtime_offset_ns", "expected_valid"),
     [
-        (0.0, "stale", True, None),  # file newer than index → stale
-        (float("inf"), [], True, "index"),  # no newer files → valid
-        (float("inf"), "stale", False, None),  # no index, returns None
+        ("x = 1", 0, True),  # unchanged since indexing
+        ("x = 1", 1_000_000_000, False),  # modified, newer mtime
+        ("x = 1", -1_000_000_000, False),  # modified, older mtime (edit during indexing, cp -p)
+        ("", 0, False),  # emptied since indexing, so skipped and missing from current files
+        ("x = 1", None, False),  # deleted mid-walk, so skipped and missing from current files
     ],
 )
 def test_get_validated_cache_mtime(
-    write_time: float, walk_result: str | list, write: bool, expected: str | None, tmp_path: Path
+    text: str, mtime_offset_ns: int | None, expected_valid: bool, tmp_path: Path
 ) -> None:
-    """Returns None when a tracked file is newer than the index; the path otherwise."""
+    """Returns None when a tracked file's mtime differs from its manifest entry; the path otherwise."""
     index_path = tmp_path / "index"
-    stale_file = tmp_path / "src.py"
-    stale_file.write_text("x = 1" if write else "")
-    files = [stale_file] if walk_result == "stale" else walk_result
-    # Include the file in stored manifest so manifest check passes and mtime check fires.
-    stored_files = ["src.py"] if walk_result == "stale" else []
-    _write_metadata(index_path, "my/model", ["code"], write_time, file_paths=stored_files)
+    src = tmp_path / "src.py"
+    src.write_text(text)
+    recorded_ns = src.stat().st_mtime_ns
+    _write_metadata(index_path, "my/model", ["code"], recorded_ns / 1e9, file_paths=["src.py"])
+    metadata = json.loads((index_path / "metadata.json").read_text())
+    metadata["files"]["src.py"] = {"mtime_ns": recorded_ns}
+    (index_path / "metadata.json").write_text(json.dumps(metadata))
+    if mtime_offset_ns is None:
+        src.unlink()
+    else:
+        os.utime(src, ns=(recorded_ns + mtime_offset_ns, recorded_ns + mtime_offset_ns))
 
     with patch("semble.cache.find_index_from_cache_folder", return_value=index_path):
-        with patch("semble.cache.get_extensions", return_value={".py"}):
-            with patch("semble.cache.walk_files", return_value=files):
-                result = get_validated_cache(str(tmp_path), "my/model", [ContentType.CODE])
-    assert result == (index_path if expected == "index" else None)
+        with patch("semble.cache.walk_files", return_value=[src]):
+            result = get_validated_cache(str(tmp_path), "my/model", [ContentType.CODE])
+    assert result == (index_path if expected_valid else None)
 
 
 @pytest.mark.parametrize(
```

---

### Incident Patch 3: `24497845` (2026-09-25)
**Commit Message**: feat: Add Grok Build, Qwen Code, Cline, and Kilo Code installer support (#275)

**File**: `docs/installation.md` (modified, +81/-2)
```diff
@@ -21,7 +21,7 @@ To undo:
 semble uninstall
 ```
 
-Supported agents: Claude Code, Cursor, Gemini CLI, Kiro, OpenCode, GitHub Copilot, Codex, VS Code, Windsurf, Zed, Reasonix, Pi, Command Code, Antigravity, and ZCode.
+Supported agents: Claude Code, Cursor, Gemini CLI, Kiro, OpenCode, GitHub Copilot, Codex, VS Code, Windsurf, Zed, Reasonix, Pi, Command Code, Antigravity, ZCode, Grok Build, Qwen Code, Cline, and Kilo Code.
 
 > **Pi prerequisite:** Pi requires the MCP extension to be installed before semble can connect. Run `pi install npm:pi-mcp-extension` once, then `semble install`.
 
@@ -323,6 +323,82 @@ Add to `~/.zcode/cli/config.json` under the nested `mcp.servers` key (or use Set
 
 </details>
 
+<details>
+<summary>Grok Build</summary>
+
+Add to `~/.grok/config.toml`:
+
+```toml
+[mcp_servers.semble]
+command = "uvx"
+args = ["--from", "semble[mcp]", "semble"]
+```
+
+</details>
+
+<details>
+<summary>Qwen Code</summary>
+
+Add to `~/.qwen/settings.json`:
+
+```json
+{
+  "mcpServers": {
+    "semble": {
+      "command": "uvx",
+      "args": ["--from", "semble[mcp]", "semble"]
+    }
+  }
+}
+```
+
+</details>
+
+<details>
+<summary>Cline</summary>
+
+Add to `~/.cline/data/settings/cline_mcp_settings.json` (shared by the Cline IDE extensions and CLI):
+
+```json
+{
+  "mcpServers": {
+    "semble": {
+      "transport": {
+        "type": "stdio",
+        "command": "uvx",
+        "args": ["--from", "semble[mcp]", "semble"]
+      }
+    }
+  }
+}
+```
+
+Or use the CLI:
+
+```bash
+cline mcp add semble --yes -- uvx --from "semble[mcp]" semble
+```
+
+</details>
+
+<details>
+<summary>Kilo Code</summary>
+
+Add to `~/.config/kilo/kilo.jsonc`:
+
+```json
+{
+  "mcp": {
+    "semble": {
+      "type": "local",
+      "command": ["uvx", "--from", "semble[mcp]", "semble"]
+    }
+  }
+}
+```
+
+</details>
+
 The MCP server indexes each requested content selection on first use and caches it separately. Searches default to code; append `--content docs`, `--content config`, or `--content all` to the server command to change that default. The `content` argument on an individual MCP search overrides it. For example, in Claude Code:
 
 ```bash
@@ -382,7 +458,7 @@ If `semble` is not on `$PATH`, use `uvx --from "semble[mcp]" semble` in its plac
 
 ### Sub-agent
 
-For harnesses that support sub-agents (Claude Code, Cursor, Gemini CLI, Kiro, OpenCode, GitHub Copilot, Codex, Reasonix, Pi, Command Code, Antigravity, ZCode), you can install a dedicated `semble-search` sub-agent. Copy the appropriate file from [`src/semble/agents/`](../src/semble/agents/) to your agent's agents directory:
+For harnesses that support sub-agents (Claude Code, Cursor, Gemini CLI, Kiro, OpenCode, GitHub Copilot, Codex, Reasonix, Pi, Command Code, Antigravity, ZCode, Grok Build, Qwen Code, Kilo Code), you can install a dedicated `semble-search` sub-agent. Copy the appropriate file from [`src/semble/agents/`](../src/semble/agents/) to your agent's agents directory:
 
 > **Pi prerequisite:** Pi sub-agents require the Pi agents extension. Run `pi install npm:pi-agents` once before installing.
 
@@ -400,3 +476,6 @@ For harnesses that support sub-agents (Claude Code, Cursor, Gemini CLI, Kiro, Op
 | Command Code | `commandcode.md` | `~/.commandcode/agents/semble-search.md` |
 | Antigravity | `antigravity.md` | `~/.gemini/config/skills/semble-search/SKILL.md` |
 | ZCode | `zcode.md` | `~/.zcode/agents/semble-search.md` |
+| Grok Build | `grok.md` | `~/.grok/agents/semble-search.md` |
+| Qwen Code | `qwen.md` | `~/.qwen/agents/semble-search.md` |
+| Kilo Code | `kilo.md` | `~/.config/kilo/agents/semble-search.md` |
```

**File**: `src/semble/agents/grok.md` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+---
+name: semble-search
+description: Code search agent for exploring any codebase. Use for finding code by intent, locating implementations, understanding how something works, or discovering related code. Prefer over grep/read_file for any semantic or exploratory question.
+---
+
+Use `semble search` to find code by describing what it does or naming a symbol/identifier, instead of grep:
+
+```bash
+semble search "authentication flow" ./my-project --max-snippet-lines 10  # first 10 lines only, concise
+semble search "save_pretrained" ./my-project                          # full chunk content
+semble search "save model to disk" ./my-project --top-k 10           # more results
+```
+
+Results are cached automatically on first run and invalidated when files change.
+
+Use `--content docs` to search documentation and prose, `--content config` for config files (yaml, toml, etc.), or `--content all` to search code, docs, and config:
+
+```bash
+semble search "deployment guide" ./my-project --content docs
+semble search "database host port" ./my-project --content config
+semble search "authentication" ./my-project --content all
+```
+
+Use `semble find-related` to discover code similar to a known location (pass `file_path` and `line` from a prior search result):
+
+```bash
+semble find-related src/auth.py 42 ./my-project
+```
+
+`path` defaults to the current directory when omitted; git URLs are accepted. Pass several paths or URLs to search related repos together, e.g. when this project calls a service defined in a sibling repo. Result paths are then prefixed with the repo name and the output includes a `repos` map from prefix to location:
+
+```bash
+semble search "invoice endpoint" ./service-a ../service-b
+```
+
+If `semble` is not on `$PATH`, use `uvx --from "semble[mcp]" semble` in its place.
+
+### Workflow
+
+1. Start with `semble search` to find relevant chunks. The index is built and cached automatically.
+2. Use `--content docs` for documentation, `--content config` for config files, or `--content all` for everything.
+3. Navigate directly to the returned file and line. Do not re-search or grep for the same content.
+4. Optionally use `semble find-related` with a promising result's `file_path` and `line` to discover related implementations.
+5. If the answer may live in a dependent or sibling repo, pass all relevant repo paths to one `semble search` call.
+6. Use grep only when you need every occurrence of a literal string across the whole repo (e.g., all callers of a renamed function).
```

**File**: `src/semble/agents/kilo.md` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+---
+name: semble-search
+description: Code search agent for exploring any codebase. Use for finding code by intent, locating implementations, understanding how something works, or discovering related code. Prefer over Bash/Read for any semantic or exploratory question.
+mode: subagent
+permission:
+  bash: allow
+  read: allow
+---
+
+Use `semble search` to find code by describing what it does or naming a symbol/identifier, instead of grep:
+
+```bash
+semble search "authentication flow" ./my-project --max-snippet-lines 10  # first 10 lines only, concise
+semble search "save_pretrained" ./my-project                          # full chunk content
+semble search "save model to disk" ./my-project --top-k 10           # more results
+```
+
+Results are cached automatically on first run and invalidated when files change.
+
+Use `--content docs` to search documentation and prose, `--content config` for config files (yaml, toml, etc.), or `--content all` to search code, docs, and config:
+
+```bash
+semble search "deployment guide" ./my-project --content docs
+semble search "database host port" ./my-project --content config
+semble search "authentication" ./my-project --content all
+```
+
+Use `semble find-related` to discover code similar to a known location (pass `file_path` and `line` from a prior search result):
+
+```bash
+semble find-related src/auth.py 42 ./my-project
+```
+
+`path` defaults to the current directory when omitted; git URLs are accepted. Pass several paths or URLs to search related repos together, e.g. when this project calls a service defined in a sibling repo. Result paths are then prefixed with the repo name and the output includes a `repos` map from prefix to location:
+
+```bash
+semble search "invoice endpoint" ./service-a ../service-b
+```
+
+If `semble` is not on `$PATH`, use `uvx --from "semble[mcp]" semble` in its place.
+
+### Workflow
+
+1. Start with `semble search` to find relevant chunks. The index is built and cached automatically.
+2. Use `--content docs` for documentation, `--content config` for config files, or `--content all` for everything.
+3. Navigate directly to the returned file and line. Do not re-search or grep for the same content.
+4. Optionally use `semble find-related` with a promising result's `file_path` and `line` to discover related implementations.
+5. If the answer may live in a dependent or sibling repo, pass all relevant repo paths to one `semble search` call.
+6. Use grep only when you need every occurrence of a literal string across the whole repo (e.g., all callers of a renamed function).
```

**File**: `src/semble/agents/qwen.md` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+---
+name: semble-search
+description: Code search agent for exploring any codebase. Use for finding code by intent, locating implementations, understanding how something works, or discovering related code. Prefer over run_shell_command/read_file for any semantic or exploratory question.
+tools:
+  - run_shell_command
+  - read_file
+---
+
+Use `semble search` to find code by describing what it does or naming a symbol/identifier, instead of grep:
+
+```bash
+semble search "authentication flow" ./my-project --max-snippet-lines 10  # first 10 lines only, concise
+semble search "save_pretrained" ./my-project                          # full chunk content
+semble search "save model to disk" ./my-project --top-k 10           # more results
+```
+
+Results are cached automatically on first run and invalidated when files change.
+
+Use `--content docs` to search documentation and prose, `--content config` for config files (yaml, toml, etc.), or `--content all` to search code, docs, and config:
+
+```bash
+semble search "deployment guide" ./my-project --content docs
+semble search "database host port" ./my-project --content config
+semble search "authentication" ./my-project --content all
+```
+
+Use `semble find-related` to discover code similar to a known location (pass `file_path` and `line` from a prior search result):
+
+```bash
+semble find-related src/auth.py 42 ./my-project
+```
+
+`path` defaults to the current directory when omitted; git URLs are accepted. Pass several paths or URLs to search related repos together, e.g. when this project calls a service defined in a sibling repo. Result paths are then prefixed with the repo name and the output includes a `repos` map from prefix to location:
+
+```bash
+semble search "invoice endpoint" ./service-a ../service-b
+```
+
+If `semble` is not on `$PATH`, use `uvx --from "semble[mcp]" semble` in its place.
+
+### Workflow
+
+1. Start with `semble search` to find relevant chunks. The index is built and cached automatically.
+2. Use `--content docs` for documentation, `--content config` for config files, or `--content all` for everything.
+3. Navigate directly to the returned file and line. Do not re-search or grep for the same content.
+4. Optionally use `semble find-related` with a promising result's `file_path` and `line` to discover related implementations.
+5. If the answer may live in a dependent or sibling repo, pass all relevant repo paths to one `semble search` call.
+6. Use grep only when you need every occurrence of a literal string across the whole repo (e.g., all callers of a renamed function).
```

**File**: `src/semble/installer/agents.py` (modified, +57/-9)
```diff
@@ -81,6 +81,10 @@ def semble_pin() -> str:
     "args": ["--from", SEMBLE_PIN, "semble"],
 }
 
+_CLINE_SERVER_CONFIG: dict[str, object] = {  # Cline: nested "transport" (the flat shape is legacy)
+    "transport": {"type": "stdio", "command": "uvx", "args": ["--from", SEMBLE_PIN, "semble"]},
+}
+
 _ZED_SERVER_CONFIG: dict[str, object] = {  # Zed: command/args only, no "source"
     "command": "uvx",
     "args": ["--from", SEMBLE_PIN, "semble"],
@@ -153,12 +157,17 @@ class AgentTarget:
     subagent_path: Path | None = None  # global (user-level) sub-agent file; None = unsupported
 
 
-def _opencode_mcp_path() -> Path:
-    """Return the opencode config path, preferring .jsonc over .json."""
+def _xdg_config_dir(app: str) -> Path:
+    """Return an XDG app's config directory (e.g. opencode, kilo), honoring XDG_CONFIG_HOME."""
     xdg = os.environ.get("XDG_CONFIG_HOME")
-    base = Path(xdg) / "opencode" if xdg else _HOME / ".config" / "opencode"
-    jsonc = base / "opencode.jsonc"
-    json_ = base / "opencode.json"
+    return Path(xdg) / app if xdg else _HOME / ".config" / app
+
+
+def _xdg_jsonc_path(app: str) -> Path:
+    """Return an XDG app's config path (e.g. opencode, kilo), preferring .jsonc over .json."""
+    base = _xdg_config_dir(app)
+    jsonc = base / f"{app}.jsonc"
+    json_ = base / f"{app}.json"
     return jsonc if _exists_or_denied(jsonc) else (json_ if _exists_or_denied(json_) else jsonc)
 
 
@@ -214,10 +223,10 @@ def _vscode_mcp_path() -> Path:
         id="opencode",
         display_name="Opencode",
         binary="opencode",
-        config_dir=_HOME / ".config" / "opencode",
-        mcp=McpConfig(_opencode_mcp_path(), "mcp", _OPENCODE_SERVER_CONFIG),
-        instructions_path=_HOME / ".config" / "opencode" / "AGENTS.md",
-        subagent_path=_HOME / ".config" / "opencode" / "agents" / "semble-search.md",
+        config_dir=_xdg_config_dir("opencode"),
+        mcp=McpConfig(_xdg_jsonc_path("opencode"), "mcp", _OPENCODE_SERVER_CONFIG),
+        instructions_path=_xdg_config_dir("opencode") / "AGENTS.md",
+        subagent_path=_xdg_config_dir("opencode") / "agents" / "semble-search.md",
     ),
     AgentTarget(
         id="copilot",
@@ -309,6 +318,45 @@ def _vscode_mcp_path() -> Path:
         instructions_path=_HOME / ".gemini" / "GEMINI.md",
         subagent_path=_HOME / ".gemini" / "config" / "skills" / "semble-search" / "SKILL.md",
     ),
+    AgentTarget(
+        id="grok",
+        display_name="Grok Build",
+        binary="grok",
+        config_dir=_HOME / ".grok",
+        mcp=McpConfig(_HOME / ".grok" / "config.toml", "mcp_servers", _STDIO_SERVER_CONFIG, format="toml"),
+        instructions_path=_HOME / ".grok" / "AGENTS.md",
+        subagent_path=_HOME / ".grok" / "agents" / "semble-search.md",
+    ),
+    AgentTarget(
+        id="qwen",
+        display_name="Qwen Code",
+        binary="qwen",
+        config_dir=_HOME / ".qwen",
+        mcp=McpConfig(_HOME / ".qwen" / "settings.json", "mcpServers", _STDIO_SERVER_CONFIG),
+        instructions_path=_HOME / ".qwen" / "QWEN.md",
+        subagent_path=_HOME / ".qwen" / "agents" / "semble-search.md",
+    ),
+    AgentTarget(
+        id="cline",
+        display_name="Cline",
+        binary="cline",
+        config_dir=_HOME / ".cline",
+        # Shared by the Cline IDE extensions, CLI, and SDK.
+        mcp=McpConfig(
+            _HOME / ".cline" / "data" / "settings" / "cline_mcp_settings.json", "mcpServers", _CLINE_SERVER_CONFIG
+        ),
+        instructions_path=_HOME / ".cline" / "rules" / "semble.md",
+        subagent_path=None,  # Cline agents are YAML team definitions with Cline-specific tool names
+    ),
+    AgentTarget(
+        id="kilo",
+        display_name="Kilo Code",
+        binary="kilo",
+        config_dir=_xdg_config_dir("kilo"),
+        mcp=McpConfig(_xdg_jsonc_path("kilo"), "mcp", _OPENCODE_SERVER_CONFIG),
+        instructions_path=_xdg_config_dir("kilo") / "AGENTS.md",
+        subagent_path=_xdg_config_dir("kilo") / "agents" / "semble-search.md",
+    ),
 ]
 
 
```

**File**: `src/semble/installer/config.py` (modified, +10/-2)
```diff
@@ -90,6 +90,14 @@ def _delete_member(src: bytes, member: Node) -> bytes:
     return src[:start] + src[end:]
 
 
+def _json_equals(raw: bytes, value: object) -> bool:
+    """Return True if raw parses as strict JSON equal to value; JSON5-only syntax counts as different."""
+    try:
+        return json.loads(raw) == value
+    except ValueError:
+        return False
+
+
 def _reparse_ok(text: str) -> bool:
     """True if text still parses as error-free JSON5 — the guard run before every write."""
     parser = _json5_parser()
@@ -152,13 +160,13 @@ def merge_json_member(path: Path, section_key: str, member_key: str, value: dict
         value_json = json.dumps(value)
         if (existing := _member(resolved, src, member_key)) is not None:
             val_node = _value_of(existing)
+            if _json_equals(src[val_node.start_byte : val_node.end_byte], value):
+                return "unchanged"  # same entry, possibly formatted differently (e.g. a fresh indented file)
             new_src = src[: val_node.start_byte] + value_json.encode("utf-8") + src[val_node.end_byte :]
         else:
             new_src = _insert_first_member(src, resolved, f"{member_key_json}: {value_json}")
 
     new_text = new_src.decode("utf-8")
-    if new_text == text:
-        return "unchanged"
     if not _reparse_ok(new_text):
         return "error"
     path.write_text(new_text, encoding="utf-8")
```

**File**: `src/semble/installer/installer.py` (modified, +5/-1)
```diff
@@ -97,7 +97,11 @@ def _apply_subagent(agent: AgentTarget, mode: Mode) -> WriteResult | None:
     dest.parent.mkdir(parents=True, exist_ok=True)
     try:
         src = files("semble").joinpath(f"agents/{agent.id}{dest.suffix}").read_text(encoding="utf-8")
-        dest.write_text(src.replace('"semble[mcp]"', f'"{SEMBLE_PIN}"'), encoding="utf-8")
+        # Bytes on both sides: no newline translation on Windows, and an undecodable file is just stale.
+        content = src.replace('"semble[mcp]"', f'"{SEMBLE_PIN}"').encode("utf-8")
+        if existed and dest.read_bytes() == content:
+            return WriteResult(dest, "unchanged")
+        dest.write_bytes(content)
     except Exception:
         return WriteResult(dest, "error")
     return WriteResult(dest, "updated" if existed else "created")
```

**File**: `tests/test_installer.py` (modified, +50/-19)
```diff
@@ -15,8 +15,8 @@
     SEMBLE_PIN,
     SEMBLE_START,
     IntegrationType,
-    _opencode_mcp_path,
     _vscode_mcp_path,
+    _xdg_jsonc_path,
     is_detected,
     semble_pin,
 )
@@ -113,10 +113,23 @@ def test_merge_mcp_into_empty_object_produces_valid_json(claude_agent, initial):
     json.loads(claude_agent.mcp.path.read_text())  # raises if invalid
 
 
-def test_merge_mcp_idempotent(claude_agent):
-    """Running merge twice adds semble once and reports unchanged the second time."""
-    claude_agent.mcp.path.write_text('{\n  "mcpServers": {}\n}\n')
+@pytest.mark.parametrize(
+    "stale",
+    ['{"command": "old"}', '{"command": "uvx",}'],  # outdated entry; JSON5-only syntax is rewritten too
+)
+def test_merge_mcp_replaces_stale_entry(claude_agent, stale):
+    """merge_mcp rewrites an existing semble entry that differs from the current one."""
+    claude_agent.mcp.path.write_text(f'{{"mcpServers": {{"semble": {stale}}}}}')
     assert merge_mcp(claude_agent).action == "updated"
+    assert json.loads(claude_agent.mcp.path.read_text())["mcpServers"]["semble"] == claude_agent.mcp.entry
+
+
+@pytest.mark.parametrize(("initial", "first"), [('{\n  "mcpServers": {}\n}\n', "updated"), (None, "created")])
+def test_merge_mcp_idempotent(claude_agent, initial, first):
+    """Running merge twice adds semble once and reports unchanged the second time, also for a fresh file."""
+    if initial is not None:
+        claude_agent.mcp.path.write_text(initial)
+    assert merge_mcp(claude_agent).action == first
     assert merge_mcp(claude_agent).action == "unchanged"
     assert claude_agent.mcp.path.read_text().count('"semble":') == 1  # the member key, once
 
@@ -160,6 +173,9 @@ def test_merge_and_remove_json_member_nested_section_key(tmp_path):
         ("pi", "mcpServers"),
         ("commandcode", "mcpServers"),
         ("antigravity", "mcpServers"),
+        ("qwen", "mcpServers"),
+        ("cline", "mcpServers"),
+        ("kilo", "mcp"),
         ("zcode", "mcp.servers"),  # dotted key: nested two levels deep
     ],
 )
@@ -330,30 +346,32 @@ def test_vscode_mcp_path(monkeypatch, platform, env_vars):
     assert "Code" in str(p)
 
 
-def test_opencode_mcp_path(monkeypatch, tmp_path):
-    """_opencode_mcp_path respects XDG_CONFIG_HOME and prefers .jsonc over .json."""
+@pytest.mark.parametrize("app", ["opencode", "kilo"])
+def test_xdg_jsonc_path(monkeypatch, tmp_path, app):
+    """_xdg_jsonc_path respects XDG_CONFIG_HOME and prefers .jsonc over .json."""
     monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path))
-    assert _opencode_mcp_path().parent == tmp_path / "opencode"
-    assert _opencode_mcp_path().name == "opencode.jsonc"  # fallback when neither exists
+    assert _xdg_jsonc_path(app) == tmp_path / app / f"{app}.jsonc"  # fallback when neither exists
 
-    (tmp_path / "opencode").mkdir()
-    json_ = tmp_path / "opencode" / "opencode.json"
+    (tmp_path / app).mkdir()
+    json_ = tmp_path / app / f"{app}.json"
     json_.touch()
-    assert _opencode_mcp_path() == json_  # json when no jsonc
+    assert _xdg_jsonc_path(app) == json_  # json when no jsonc
 
-    jsonc = tmp_path / "opencode" / "opencode.jsonc"
+    jsonc = tmp_path / app / f"{app}.jsonc"
     jsonc.touch()
-    assert _opencode_mcp_path() == jsonc  # jsonc preferred
+    assert _xdg_jsonc_path(app) == jsonc  # jsonc preferred
 
 
-def test_apply_mcp(tmp_path):
-    """_apply_mcp returns None for mcp=None agents and uses the TOML path for codex."""
+@pytest.mark.parametrize("agent_id", ["codex", "grok"])
+def test_apply_mcp(tmp_path, agent_id):
+    """_apply_mcp returns None for mcp=None agents and writes a [mcp_servers.semble] table for TOML agents."""
     no_mcp = replace(next(a for a in AGENTS if a.id == "claude"), mcp=None)
     assert _apply_mcp(no_mcp, "install") is None
 
-    codex = next(a for a in AGENTS if a.id == "codex")
-    codex = replace(codex, mcp=replace(codex.mcp, path=tmp_path / "config.toml"))
-    assert _apply_mcp(codex, "install").action in ("created", "updated")
+    agent = next(a for a in AGENTS if a.id == agent_id)
+    agent = replace(agent, mcp=replace(agent.mcp, path=tmp_path / "config.toml"))
+    assert _apply_mcp(agent, "install").action == "created"
+    assert "[mcp_servers.semble]" in (tmp_path / "config.toml").read_text()
 
 
 def test_apply_instructions_none():
@@ -369,14 +387,27 @@ def test_apply_subagent(tmp_path):
 
     assert _apply_subagent(agent, "install").action == "created"
     assert dest.exists()
-    assert _apply_subagent(agent, "install").action == "updated"
+    assert _apply_subagent(agent, "install").action == "unchanged"
+    for stale in (b"stale", b"\xff\xfe"):  # outdated or not valid UTF-8
+        dest.write_bytes(stale)
+        assert _apply_subagent(agent, "install").action == "updated"
     assert _apply_subagent(agent, "uninstall").action == "removed"
     assert not dest.exists()
     assert _apply_subagent(agent, "uninstall").action == "not-found"

```

---

### Incident Patch 4: `bef9774f` (2026-09-25)
**Commit Message**: feat: Add idle TTL for MCP in-memory index cache (#273)

**File**: `benchmarks/README.md` (modified, +12/-11)
```diff
@@ -70,32 +70,30 @@ semble returns the top-50 ranked chunks. `ripgrep+read` splits the query into ke
 
 ## By language
 
-NDCG@10 per language, sorted by CodeRankEmbed (CRE in the table). Best score per row is bolded.
+NDCG@10 per language, sorted by semble. CRE = CodeRankEmbed, cbm = codebase-memory-mcp. Best score per row is bolded.
 
 | Language    |    semble |       CRE |   ColGREP |  zvec-grep |        ck |       cbm |    grepai |     probe |        cs |   ripgrep |
 | ----------- | --------: | --------: | --------: | ---------: | --------: | --------: | --------: | --------: | --------: | --------: |
 | javascript  |     0.917 | **0.925** |     0.823 |      0.760 |     0.772 |     0.770 |     0.675 |     0.588 |     0.171 |     0.176 |
-| scala       |     0.909 | **0.925** |     0.765 |      0.799 |     0.717 |     0.704 |     0.330 |     0.392 |     0.111 |     0.180 |
+| cpp         | **0.915** |     0.897 |     0.626 |      0.677 |     0.687 |     0.630 |     0.731 |     0.375 |     0.262 |     0.126 |
 | zig         | **0.913** |     0.911 |     0.474 |      0.664 |     0.511 |     0.766 |     0.755 |     0.369 |     0.121 |     0.000 |
+| scala       |     0.909 | **0.925** |     0.765 |      0.799 |     0.717 |     0.704 |     0.330 |     0.392 |     0.111 |     0.180 |
 | ruby        | **0.909** |     0.905 |     0.708 |      0.758 |     0.738 |     0.689 |     0.643 |     0.382 |     0.255 |     0.230 |
-| cpp         | **0.915** |     0.897 |     0.626 |      0.677 |     0.687 |     0.630 |     0.731 |     0.375 |     0.262 |     0.126 |
+| go          | **0.895** |     0.713 |     0.785 |      0.512 |     0.458 |     0.506 |     0.722 |     0.410 |     0.183 |     0.133 |
 | elixir      | **0.894** |     0.893 |     0.808 |      0.811 |     0.786 |     0.506 |     0.669 |     0.412 |     0.397 |     0.134 |
-| python      |     0.867 | **0.878** |     0.777 |      0.704 |     0.721 |     0.643 |     0.634 |     0.488 |     0.305 |     0.202 |
 | csharp      | **0.885** |     0.848 |     0.614 |      0.609 |     0.548 |     0.775 |     0.277 |     0.392 |     0.248 |     0.117 |
-| php         | **0.858** |     0.847 |     0.663 |      0.583 |     0.615 |     0.608 |     0.402 |     0.340 |     0.180 |     0.123 |
+| python      |     0.867 | **0.878** |     0.777 |      0.704 |     0.721 |     0.643 |     0.634 |     0.488 |     0.305 |     0.202 |
 | swift       | **0.860** |     0.845 |     0.710 |      0.709 |     0.672 |     0.630 |     0.429 |     0.280 |     0.151 |     0.160 |
+| php         | **0.858** |     0.847 |     0.663 |      0.583 |     0.615 |     0.608 |     0.402 |     0.340 |     0.180 |     0.123 |
+| rust        | **0.856** |     0.754 |     0.662 |      0.541 |     0.419 |     0.454 |     0.519 |     0.242 |     0.193 |     0.162 |
+| java        | **0.849** |     0.790 |     0.641 |      0.685 |     0.606 |     0.554 |     0.386 |     0.536 |     0.136 |     0.198 |
 | bash        |     0.825 | **0.834** |     0.706 |      0.725 |     0.677 |     0.768 |     0.723 |     0.226 |     0.170 |     0.000 |
 | lua         |     0.823 | **0.829** |     0.798 |      0.736 |     0.738 |     0.591 |     0.699 |     0.336 |     0.050 |     0.000 |
 | kotlin      |     0.821 | **0.823** |     0.637 |      0.628 |     0.587 |     0.611 |     0.478 |     0.335 |     0.170 |     0.166 |
 | haskell     |     0.765 | **0.811** |     0.683 |      0.689 |     0.733 |     0.624 |     0.483 |     0.313 |     0.160 |     0.000 |
-| java        | **0.849** |     0.790 |     0.641 |      0.685 |     0.606 |     0.554 |     0.386 |     0.536 |     0.136 |     0.198 |
 | c           |     0.741 | **0.771** |     0.676 |      0.598 |     0.606 |     0.655 |     0.555 |     0.384 |     0.175 |     0.000 |
-| rust        | **0.856** |     0.754 |     0.662 |      0.541 |     0.419 |     0.454 |     0.519 |     0.242 |     0.193 |     0.162 |
-| go          | **0.895** |     0.713 |     0.785 |      0.512 |     0.458 |     0.506 |     0.722 |     0.410 |     0.183 |     0.133 |
 | typescript  | **0.706** |     0.671 |     0.430 |      0.476 |     0.456 |     0.455 |     0.394 |     0.354 |     0.145 |     0.128 |
-| **overall** | **0.854** |     0.839 | **0.693** |  **0.670** | **0.634** | **0.630** | **0.561** | **0.387** | **0.200** | **0.126** |
-
-cbm = [codebase-memory-mcp](#methods).
+| **overall** | **0.854** |     0.839 |     0.693 |      0.670 |     0.642 |     0.630 |     0.561 |     0.387 |     0.200 |     0.126 |
 
 ## Ablations
 
@@ -160,6 +158,9 @@ The following tools were considered but not included in the main comparison:
 - **[claude-context](https://github.com/zilliztech/claude-context)**: retrieval-augmented code search using OpenAI embeddings and a vector database. Excluded because it requires a paid OpenAI API key and a running vector-DB service.
 - **[GitNexus](https://github.com/abhigyanpatwari/GitNexus)**: knowledge-graph code search (BM25 + local embeddings + RRF). Exclu
```

**File**: `docs/installation.md` (modified, +2/-0)
```diff
@@ -329,6 +329,8 @@ The MCP server indexes each requested content selection on first use and caches
 claude mcp add semble -s user -- uvx --from "semble[mcp]" semble --content all
 ```
 
+Indexes stay in memory for the lifetime of the server. To free memory while idle, set `SEMBLE_MCP_IDLE_TIMEOUT` to a number of seconds; indexes unused for that long are dropped from memory and reloaded from the disk cache on the next search.
+
 ### Instructions (AGENTS.md / CLAUDE.md)
 
 Add the snippet below to your `AGENTS.md` or `CLAUDE.md` so your agent knows when and how to call the semble CLI:
```

**File**: `src/semble/mcp.py` (modified, +22/-3)
```diff
@@ -3,6 +3,7 @@
 import asyncio
 import json
 import logging
+import os
 import time
 from collections import OrderedDict
 from collections.abc import Sequence
@@ -27,6 +28,9 @@
 )
 
 _CACHE_MAX_SIZE = 10  # Max number of cached indexes to keep in memory
+_CACHE_IDLE_TIMEOUT = float(
+    os.environ.get("SEMBLE_MCP_IDLE_TIMEOUT", 0)
+)  # Idle seconds before dropping an index (0 = never)
 _MIN_REVALIDATE_FACTOR = 3  # Don't recheck staleness sooner than this many times the last build's duration
 ContentSelection = Literal["code", "docs", "config", "all"]
 _CacheKey = tuple[str, tuple[ContentType, ...]]
@@ -198,6 +202,7 @@ class _IndexCache:
 
     def __init__(self) -> None:
         """Initialise an empty cache."""
+        self._idle_timers: dict[_CacheKey, asyncio.TimerHandle] = {}
         self._model_path: str | None = None
         self._model_error: BaseException | None = None
         self._model_ready = asyncio.Event()
@@ -257,6 +262,13 @@ def evict(self, cache_key: _CacheKey) -> None:
         """Evict one exact index variant from memory."""
         self._tasks.pop(cache_key, None)
         self._revalidate_after.pop(cache_key, None)
+        if (timer := self._idle_timers.pop(cache_key, None)) is not None:
+            timer.cancel()
+
+    def _evict_idle(self, cache_key: _CacheKey) -> None:
+        """Drop an entry that has not been accessed within the idle timeout; the disk cache is kept."""
+        self.evict(cache_key)
+        self._merged = None  # may hold a reference to the evicted index
 
     async def _evict_if_stale(self, cache_key: _CacheKey) -> None:
         """Evict a cached local-path entry whose on-disk cache no longer matches its files.
@@ -294,13 +306,12 @@ async def get(self, source: str, content: Sequence[ContentType] = (ContentType.C
             # Re-check after the await: another caller may have populated the entry.
             if cache_key not in self._tasks:
                 if len(self._tasks) >= _CACHE_MAX_SIZE:
-                    evicted_key, _ = self._tasks.popitem(last=False)
-                    self._revalidate_after.pop(evicted_key, None)
+                    self.evict(next(iter(self._tasks)))
                 self._tasks[cache_key] = asyncio.create_task(self._build_tracked(source, model_path, cache_key))
         self._tasks.move_to_end(cache_key)
         task = self._tasks[cache_key]
         try:
-            return await asyncio.shield(task)
+            index = await asyncio.shield(task)
         except asyncio.CancelledError:  # pragma: no cover
             if task.done():
                 self.evict(cache_key)
@@ -310,3 +321,11 @@ async def get(self, source: str, content: Sequence[ContentType] = (ContentType.C
             if self._tasks.get(cache_key) is task:
                 self.evict(cache_key)
             raise
+        # Start the idle timer only once the index is ready, so slow builds are not evicted mid-build.
+        if _CACHE_IDLE_TIMEOUT > 0 and self._tasks.get(cache_key) is task:
+            if timer := self._idle_timers.get(cache_key):
+                timer.cancel()
+            self._idle_timers[cache_key] = asyncio.get_running_loop().call_later(
+                _CACHE_IDLE_TIMEOUT, self._evict_idle, cache_key
+            )
+        return index
```

**File**: `src/semble/version.py` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
-__version_triple__ = (0, 6, 0)
+__version_triple__ = (0, 6, 1)
 __version__ = ".".join(map(str, __version_triple__))
```

**File**: `tests/test_mcp.py` (modified, +27/-0)
```diff
@@ -523,6 +523,33 @@ async def test_index_cache_lru_eviction(cache: _IndexCache, tmp_path: Path) -> N
     assert len(cache._tasks) == _CACHE_MAX_SIZE
 
 
+@pytest.mark.anyio
+async def test_index_cache_idle_timeout_eviction(cache: _IndexCache, tmp_path: Path) -> None:
+    """Entries are dropped once unused for the idle timeout, which starts after the build and resets on access."""
+
+    def slow_build(*args: Any, **kwargs: Any) -> MagicMock:
+        time.sleep(0.15)  # longer than the timeout
+        return MagicMock()
+
+    key = cache._compute_cache_key(str(tmp_path))
+    with (
+        patch("semble.mcp._CACHE_IDLE_TIMEOUT", 0.1),
+        patch("semble.mcp.SembleIndex.from_path", side_effect=slow_build),
+        patch("semble.mcp.get_validated_cache", return_value=MagicMock()),
+    ):
+        await cache.get(str(tmp_path))
+        assert key in cache._tasks
+        first_timer = cache._idle_timers[key]
+        cache._merged = ([], MagicMock())
+        await cache.get(str(tmp_path))
+        assert first_timer.cancelled()
+        assert key in cache._tasks
+        await asyncio.sleep(0.3)
+    assert key not in cache._tasks
+    assert key not in cache._idle_timers
+    assert cache._merged is None
+
+
 def test_cache_evict(cache: _IndexCache, tmp_path: Path) -> None:
     """evict() removes an existing exact cache entry."""
     key = cache._compute_cache_key(str(tmp_path))
```

---

### Incident Patch 5: `3bcefb76` (2026-09-11)
**Commit Message**: feat: Fix chunk source line counting, add semble-only benchmark option (#266)

**File**: `README.md` (modified, +2/-2)
```diff
@@ -24,7 +24,7 @@
 
 </div>
 
-Semble is a code search library built for agents. It returns the exact code snippets they need instantly, using ~99% fewer tokens than grep+read. Indexing and searching a full codebase end-to-end takes under a second for most repos, matching the retrieval quality of a code-specialized transformer while indexing ~340x faster and querying ~17x faster (see [benchmarks](#benchmarks)). Everything runs on CPU with no API keys, GPU, or external services. Use it as an MCP server, a CLI tool via AGENTS.md, or a dedicated sub-agent, and any coding agent (Claude Code, Cursor, Codex, OpenCode, etc.) gets instant access to any repo.
+Semble is a code search library built for agents. It returns the exact code snippets they need instantly, using ~99% fewer tokens than grep+read. Indexing and searching a full codebase end-to-end takes under a second for most repos, matching the retrieval quality of a code-specialized transformer while indexing ~380x faster and querying ~17x faster (see [benchmarks](#benchmarks)). Everything runs on CPU with no API keys, GPU, or external services. Use it as an MCP server, a CLI tool via AGENTS.md, or a dedicated sub-agent, and any coding agent (Claude Code, Cursor, Codex, OpenCode, etc.) gets instant access to any repo.
 
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/MinishLab/semble/main/assets/images/demo-dark.gif">
@@ -257,7 +257,7 @@ We benchmark quality and speed across ~1,250 queries over 63 repositories in 19
 </tr>
 </table>
 
-The quality benchmark (left) scores retrieval quality (NDCG@10) against total latency; semble matches the quality of the 137M-parameter [CodeRankEmbed](https://huggingface.co/nomic-ai/CodeRankEmbed) while indexing 340x faster. The token efficiency benchmark (right) measures how many tokens each method needs to reach a given recall level; semble uses 99% fewer tokens on average and hits 97% recall at only 2k tokens, while grep+read needs a full 100k context window to reach 85%. See [benchmarks](benchmarks/README.md) for per-language results, ablations, and full methodology.
+The quality benchmark (left) scores retrieval quality (NDCG@10) against total latency; semble matches the quality of the 137M-parameter [CodeRankEmbed](https://huggingface.co/nomic-ai/CodeRankEmbed) while indexing 380x faster. The token efficiency benchmark (right) measures how many tokens each method needs to reach a given recall level; semble uses 99% fewer tokens on average and hits 97% recall at only 2k tokens, while grep+read needs a full 100k context window to reach 85%. See [benchmarks](benchmarks/README.md) for per-language results, ablations, and full methodology.
 
 ## How it works
 
```

**File**: `benchmarks/README.md` (modified, +3/-2)
```diff
@@ -17,7 +17,7 @@ Quality and speed across all methods.
 
 | Method               |   NDCG@10 |      Index |   Query p50 |
 | -------------------- | --------: | ---------: | ----------: |
-| **semble**           | **0.854** | **344 ms** | **0.91 ms** |
+| **semble**           | **0.854** | **306 ms** | **0.91 ms** |
 | CodeRankEmbed        |     0.839 |      116 s |       16 ms |
 | ColGREP              |     0.693 |      5.4 s |      122 ms |
 | BM25                 |     0.673 |      47 ms |     0.17 ms |
@@ -32,7 +32,7 @@ Quality and speed across all methods.
 | :-----------------------------------------------------------------: | :-----------------------------------------------------------------: |
 |          _Time to first result (index + query) vs NDCG@10_          |             _Query latency on a warm index vs NDCG@10_              |
 
-semble matches the NDCG@10 of the 137M-param CodeRankEmbed while winning index time by ~340x and query latency by ~17x.
+semble matches the NDCG@10 of the 137M-param CodeRankEmbed while winning index time by ~380x and query latency by ~17x.
 
 NDCG@10 is averaged across all queries. Speed numbers use one repo per language, CPU only: cold-start index time and warm query p50 (median across 5 consecutive runs).
 
@@ -188,6 +188,7 @@ Full runs write to `benchmarks/results/semble-hybrid-<sha12>.json`.
 
 ```bash
 uv run python -m benchmarks.speed_benchmark
+uv run python -m benchmarks.speed_benchmark --semble-only  # skip the baselines
 ```
 
 Writes to `benchmarks/results/speed-<sha12>.json`.
```

**File**: `benchmarks/plot.py` (modified, +1/-1)
```diff
@@ -96,7 +96,7 @@ class _Method(TypedDict):
     {
         "name": "semble",
         "ndcg10": 0.8544,
-        "index_ms": 343.5,
+        "index_ms": 305.6,
         "query_p50_ms": 0.91,
         "color": "#1a5fa8",
         "params_m": 16,
```

**File**: `benchmarks/results/speed-eb6676ad14ec.json` (added, +2152/-0)
```diff
@@ -0,0 +1,2152 @@
+{
+  "repos": [
+    "nvm",
+    "libuv",
+    "nlohmann-json",
+    "messagepack-csharp",
+    "phoenix",
+    "gin",
+    "aeson",
+    "gson",
+    "axios",
+    "ktor",
+    "telescope.nvim",
+    "monolog",
+    "flask",
+    "rack",
+    "axum",
+    "http4s",
+    "alamofire",
+    "trpc",
+    "zls"
+  ],
+  "summary": {
+    "semble": {
+      "avg_index_ms": 305.6,
+      "avg_p50_ms": 0.95,
+      "avg_p90_ms": 5.38,
+      "avg_p95_ms": 6.8,
+      "avg_p99_ms": 10.07
+    }
+  },
+  "results": [
+    {
+      "repo": "nvm",
+      "language": "bash",
+      "tool": "semble",
+      "index_ms": 145.0,
+      "p50_ms": 0.61,
+      "p90_ms": 0.71,
+      "p95_ms": 0.89,
+      "p99_ms": 1.27,
+      "latencies_ms": [
+        1.266,
+        0.68,
+        0.612,
+        0.631,
+        0.602,
+        0.624,
+        0.773,
+        0.704,
+        0.615,
+        0.572,
+        0.666,
+        0.63,
+        0.621,
+        0.636,
+        0.624,
+        0.638,
+        0.625,
+        0.611,
+        0.625,
+        1.787,
+        0.905,
+        0.707,
+        0.63,
+        0.613,
+        0.599,
+        0.539,
+        0.518,
+        0.51,
+        0.55,
+        0.508,
+        0.595,
+        0.561,
+        0.558,
+        0.552,
+        0.551,
+        0.618,
+        0.599,
+        0.612,
+        0.595,
+        0.6,
+        1.005,
+        0.713,
+        0.625,
+        0.607,
+        0.604,
+        0.527,
+        0.5,
+        0.496,
+        0.504,
+        0.507,
+        0.698,
+        0.661,
+        0.648,
+        0.632,
+        0.628,
+        0.654,
+        0.678,
+        0.616,
+        0.598,
+        0.599,
+        0.703,
+        0.642,
+        0.604,
+        0.6,
+        0.605,
+        0.643,
+        0.604,
+        0.695,
+        0.693,
+        0.72,
+        0.662,
+        0.604,
+        0.572,
+        0.565,
+        0.555,
+        0.628,
+        0.613,
+        0.611,
+        0.635,
+        0.936,
+        0.884,
+        0.621,
+        0.55,
+        0.517,
+        0.497,
+        0.62,
+        0.599,
+        0.587,
+        0.712,
+        0.766,
+        0.586,
+        0.548,
+        0.6,
+        0.553,
+        0.532,
+        0.644,
+        0.639,
+        0.579,
+        0.548,
+        0.539
+      ]
+    },
+    {
+      "repo": "libuv",
+      "language": "c",
+      "tool": "semble",
+      "index_ms": 563.9,
+      "p50_ms": 0.82,
+      "p90_ms": 1.25,
+      "p95_ms": 1.49,
+      "p99_ms": 1.8,
+      "latencies_ms": [
+        1.814,
+        1.411,
+        1.318,
+        1.255,
+        1.36,
+        0.792,
+        0.725,
+        0.713,
+        0.699,
+        0.705,
+        1.002,
+        0.895,
+        0.897,
+        0.923,
+        0.924,
+        1.799,
+        1.609,
+        1.552,
+        1.499,
+        1.485,
+        0.913,
+        0.956,
+        0.974,
+        0.931,
+        0.866,
+        0.812,
+        0.739,
+        0.72,
+        0.764,
+        0.761,
+        0.766,
+        0.681,
+        0.666,
+        0.663,
+        0.659,
+        0.955,
+        0.866,
+        0.846,
+        0.853,
+        0.882,
+        0.704,
+        0.625,
+        0.62,
+        0.608,
+        0.599,
+        0.753,
+        0.681,
+        0.68,
+        0.675,
+        0.733,
+        1.02,
+        0.972,
+        0.934,
+        0.896,
+        0.887,
+        1.019,
+        0.945,
+        0.947,
+        0.931,
+        0.942,
+        1.155,
+        1.05,
+        1.041,
+        1.012,
+        1.022,
+        0.82,
+        0.747,
+        0.751,
+        0.747,
+        0.718,
+        0.883,
+        0.815,
+        0.821,
+        0.825,
+        0.795,
+        0.59,
+        0.542,
+        0.524,
+        0.517,
+        0.512,
+        1.247,
+        1.124,
+        1.095,
+        1.13,
+        1.146,
+        0.856,
+        0.754,
+        0.732,
+        0.733,
+        0.759,
+        0.823,
+        0.73,
+        0.685,
+        0.671,
+        0.667,
+        0.892,
+        0.854,
+        0.789,
+        0.757,
+        0.775
+      ]
+    },
+    {
+      "repo": "nlohmann-json",
+      "language": "cpp",
+      "tool": "semble",
+      "index_ms": 368.5,
+      "p50_ms": 1.03,
+      "p90_ms": 5.08,
+      "p95_ms": 5.34,
+      "p99_ms": 5.86,
+      "latencies_ms": [
+        1.458,
+        1.202,
+        1.139,
+        1.092,
+        1.11,
+        0.843,
+        0.901,
+        0.909,
+        0.832,
+        0.749,
+        0.806,
+        0.762,
+        0.762,
+        0.768,
+        0.768,
+        1.086,
+        1.024,
+        0.988,
+        1.104,
+        1.061,
+        1.227,
+        1.173,
+        1.2,
+        1.289,
+        1.179,
+        1.008,
+        0.95,
+        1.028,
+        1.003,
+        0.985,
+        1.109,
+        1.067,
+        1.049,
+        1.08,
+        1.118,
+        1.356,
+        1
```

**File**: `benchmarks/speed_benchmark.py` (modified, +16/-5)
```diff
@@ -1,3 +1,4 @@
+import argparse
 import subprocess
 import sys
 import time
@@ -237,6 +238,12 @@ def _build_summary(results: list[ToolResult], tools: list[str]) -> dict[str, obj
 
 def main() -> None:
     """Run cold-start index + query latency benchmark over a curated 1-per-language subset."""
+    parser = argparse.ArgumentParser(description="Benchmark cold-start index time and query latency per language.")
+    parser.add_argument(
+        "--semble-only", action="store_true", help="Only benchmark semble (skip BM25, CodeRankEmbed, ColGREP, ripgrep)."
+    )
+    args = parser.parse_args()
+
     specs = available_repo_specs()
     all_tasks = load_tasks(repo_specs=specs)
     repo_tasks: dict[str, list[Task]] = {repo: [t for t in all_tasks if t.repo == repo] for repo in _REPOS}
@@ -246,13 +253,15 @@ def main() -> None:
     load_model(DEFAULT_MODEL_NAME)  # warms semble's internal model cache so repo #1 isn't penalized
     print(f"  loaded in {(time.perf_counter() - started) * 1000:.0f}ms", file=sys.stderr)
 
-    print("Loading CodeRankEmbed...", file=sys.stderr)
-    started = time.perf_counter()
-    cre_model = _AsymmetricWrapper(SentenceTransformer(_CRE_MODEL_NAME, trust_remote_code=True, device="cpu"))
-    print(f"  loaded in {(time.perf_counter() - started) * 1000:.0f}ms", file=sys.stderr)
+    cre_model = None
+    if not args.semble_only:
+        print("Loading CodeRankEmbed...", file=sys.stderr)
+        started = time.perf_counter()
+        cre_model = _AsymmetricWrapper(SentenceTransformer(_CRE_MODEL_NAME, trust_remote_code=True, device="cpu"))
+        print(f"  loaded in {(time.perf_counter() - started) * 1000:.0f}ms", file=sys.stderr)
     print(file=sys.stderr)
 
-    tools = ["semble", "bm25", "coderankembed", "colgrep", "ripgrep"]
+    tools = ["semble"] if args.semble_only else ["semble", "bm25", "coderankembed", "colgrep", "ripgrep"]
 
     print(
         f"{'Repo':<22} {'Language':<14} {'Tool':<16} {'Index':>10} {'p50':>8} {'p90':>8} {'p95':>8} {'p99':>8}",
@@ -272,6 +281,8 @@ def main() -> None:
         )
         all_results.append(result)
         print(f"{repo:<22} {spec.language:<14} {'semble':<16} {index_ms:>8.0f}ms {_fmt_stats(result)}", file=sys.stderr)
+        if cre_model is None:
+            continue
 
         bm25_index_ms, latencies_ms = _bench_bm25(semble_index, tasks)
         result = ToolResult(
```

**File**: `src/semble/chunking/chunking.py` (modified, +6/-2)
```diff
@@ -1,4 +1,6 @@
 import logging
+import re
+from bisect import bisect_left
 
 from semble.chunking.core import chunk, chunk_lines
 from semble.types import Chunk
@@ -22,6 +24,8 @@ def chunk_source(source: str, file_path: str, language: str | None) -> list[Chun
     if chunk_boundaries is None:
         chunk_boundaries = chunk_lines(source, _DESIRED_CHUNK_LENGTH_CHARS)
 
+    # Line numbers come from a binary search over newline offsets, so large files aren't rescanned per chunk.
+    newline_offsets = [match.start() for match in re.finditer("\n", source)]
     chunks: list[Chunk] = []
     for boundary in chunk_boundaries:
         # Clamp to start_index so zero-length chunks don't produce an off-by-one.
@@ -31,8 +35,8 @@ def chunk_source(source: str, file_path: str, language: str | None) -> list[Chun
             Chunk(
                 content=text,
                 file_path=file_path,
-                start_line=source[: boundary.start].count("\n") + 1,
-                end_line=source[:end_index].count("\n") + 1,
+                start_line=bisect_left(newline_offsets, boundary.start) + 1,
+                end_line=bisect_left(newline_offsets, end_index) + 1,
                 language=language,
             )
         )
```

**File**: `src/semble/version.py` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
-__version_triple__ = (0, 5, 6)
+__version_triple__ = (0, 6, 0)
 __version__ = ".".join(map(str, __version_triple__))
```

**File**: `tests/test_chunker.py` (modified, +11/-0)
```diff
@@ -45,6 +45,17 @@ def test_chunk_source_language() -> None:
         chunk_line_spy.assert_called_once()
 
 
+@pytest.mark.parametrize("language", [None, "python"])
+def test_chunk_source_line_numbers_match_content(language: str | None) -> None:
+    """chunk_source line numbers point at the lines each chunk's content comes from."""
+    source = "".join(f"def f{i}():\n    return {i}\n\n" for i in range(200))
+    lines = source.splitlines(keepends=True)
+    chunks = chunk_source(source, "foo.py", language)
+    assert len(chunks) > 1
+    for c in chunks:
+        assert c.content in "".join(lines[c.start_line - 1 : c.end_line])
+
+
 def test_core_chunk_empty_input() -> None:
     """core.chunk returns [] for whitespace-only input."""
     assert chunk("   \n", "python", 100) == []
```

---

### Incident Patch 6: `8e52ea7f` (2026-09-08)
**Commit Message**: fix: remove max length (#264)

**File**: `benchmarks/results/semble-hybrid-a772a37d558c.json` (added, +1396/-0)
```diff
@@ -0,0 +1,1396 @@
+{
+  "tool": "semble-hybrid",
+  "model": "minishlab/potion-code-16M-v2",
+  "summary": {
+    "ndcg10": 0.8544,
+    "tokens": 1743.0,
+    "p50_ms": 2.018,
+    "p90_ms": 6.923,
+    "p95_ms": 7.779,
+    "p99_ms": 8.961,
+    "index_ms": 527.1,
+    "by_category": {
+      "architecture": 0.8075,
+      "semantic": 0.8458,
+      "symbol": 0.9537
+    }
+  },
+  "by_language": {
+    "bash": {
+      "repos": 3,
+      "tokens": 1492.0,
+      "ndcg10": 0.8396,
+      "p50_ms": 0.829,
+      "p90_ms": 0.908,
+      "p95_ms": 0.919,
+      "p99_ms": 0.958,
+      "index_ms": 138.5
+    },
+    "c": {
+      "repos": 3,
+      "tokens": 1625.0,
+      "ndcg10": 0.755,
+      "p50_ms": 2.271,
+      "p90_ms": 3.341,
+      "p95_ms": 3.66,
+      "p99_ms": 4.086,
+      "index_ms": 1574.8
+    },
+    "cpp": {
+      "repos": 3,
+      "tokens": 1528.0,
+      "ndcg10": 0.8876,
+      "p50_ms": 3.166,
+      "p90_ms": 15.845,
+      "p95_ms": 17.037,
+      "p99_ms": 17.54,
+      "index_ms": 1733.1
+    },
+    "csharp": {
+      "repos": 3,
+      "tokens": 1420.0,
+      "ndcg10": 0.8715,
+      "p50_ms": 6.755,
+      "p90_ms": 8.509,
+      "p95_ms": 9.355,
+      "p99_ms": 11.372,
+      "index_ms": 461.4
+    },
+    "elixir": {
+      "repos": 3,
+      "tokens": 3790.0,
+      "ndcg10": 0.9059,
+      "p50_ms": 0.859,
+      "p90_ms": 5.899,
+      "p95_ms": 6.707,
+      "p99_ms": 7.637,
+      "index_ms": 223.2
+    },
+    "go": {
+      "repos": 3,
+      "tokens": 1745.0,
+      "ndcg10": 0.9103,
+      "p50_ms": 0.824,
+      "p90_ms": 3.94,
+      "p95_ms": 4.663,
+      "p99_ms": 5.472,
+      "index_ms": 166.1
+    },
+    "haskell": {
+      "repos": 3,
+      "tokens": 1700.0,
+      "ndcg10": 0.7736,
+      "p50_ms": 2.528,
+      "p90_ms": 9.416,
+      "p95_ms": 12.115,
+      "p99_ms": 15.024,
+      "index_ms": 507.6
+    },
+    "java": {
+      "repos": 3,
+      "tokens": 1730.0,
+      "ndcg10": 0.8027,
+      "p50_ms": 2.83,
+      "p90_ms": 15.843,
+      "p95_ms": 19.43,
+      "p99_ms": 21.867,
+      "index_ms": 983.3
+    },
+    "javascript": {
+      "repos": 3,
+      "tokens": 1535.0,
+      "ndcg10": 0.9111,
+      "p50_ms": 0.575,
+      "p90_ms": 1.869,
+      "p95_ms": 1.989,
+      "p99_ms": 3.034,
+      "index_ms": 39.6
+    },
+    "kotlin": {
+      "repos": 3,
+      "tokens": 2709.0,
+      "ndcg10": 0.8026,
+      "p50_ms": 1.914,
+      "p90_ms": 8.144,
+      "p95_ms": 8.705,
+      "p99_ms": 9.57,
+      "index_ms": 259.9
+    },
+    "lua": {
+      "repos": 3,
+      "tokens": 1657.0,
+      "ndcg10": 0.8354,
+      "p50_ms": 1.185,
+      "p90_ms": 1.387,
+      "p95_ms": 1.485,
+      "p99_ms": 2.424,
+      "index_ms": 368.8
+    },
+    "php": {
+      "repos": 3,
+      "tokens": 1461.0,
+      "ndcg10": 0.8638,
+      "p50_ms": 1.301,
+      "p90_ms": 8.873,
+      "p95_ms": 9.071,
+      "p99_ms": 9.118,
+      "index_ms": 734.6
+    },
+    "python": {
+      "repos": 9,
+      "tokens": 1671.0,
+      "ndcg10": 0.8771,
+      "p50_ms": 0.731,
+      "p90_ms": 3.776,
+      "p95_ms": 4.285,
+      "p99_ms": 5.028,
+      "index_ms": 151.2
+    },
+    "ruby": {
+      "repos": 3,
+      "tokens": 1541.0,
+      "ndcg10": 0.9154,
+      "p50_ms": 0.723,
+      "p90_ms": 4.402,
+      "p95_ms": 5.081,
+      "p99_ms": 6.256,
+      "index_ms": 107.5
+    },
+    "rust": {
+      "repos": 3,
+      "tokens": 1683.0,
+      "ndcg10": 0.8263,
+      "p50_ms": 1.85,
+      "p90_ms": 7.206,
+      "p95_ms": 7.903,
+      "p99_ms": 8.99,
+      "index_ms": 482.6
+    },
+    "scala": {
+      "repos": 3,
+      "tokens": 1497.0,
+      "ndcg10": 0.9213,
+      "p50_ms": 3.15,
+      "p90_ms": 7.132,
+      "p95_ms": 7.576,
+      "p99_ms": 8.023,
+      "index_ms": 415.1
+    },
+    "swift": {
+      "repos": 3,
+      "tokens": 1467.0,
+      "ndcg10": 0.8478,
+      "p50_ms": 1.538,
+      "p90_ms": 4.926,
+      "p95_ms": 6.024,
+      "p99_ms": 7.077,
+      "index_ms": 183.6
+    },
+    "typescript": {
+      "repos": 3,
+      "tokens": 1474.0,
+      "ndcg10": 0.742,
+      "p50_ms": 4.035,
+      "p90_ms": 6.888,
+      "p95_ms": 7.272,
+      "p99_ms": 8.669,
+      "index_ms": 407.9
+    },
+    "zig": {
+      "repos": 3,
+      "tokens": 1546.0,
+      "ndcg10": 0.899,
+      "p50_ms": 3.847,
+      "p90_ms": 19.527,
+      "p95_ms": 21.511,
+      "p99_ms": 25.971,
+      "index_ms": 1827.0
+    }
+  },
+  "repos": [
+    {
+      "repo": "abseil-cpp",
+      "language": "cpp",
+      "mode": "auto",
+      "chunks": 16813,
+      "tokens": 1497,
+      "ndcg5": 0.8621567083124564,
+      "ndcg10": 0.8799670676678575,
+      "p50_ms": 7.606041966937482,
+      "p90_ms": 41.33020786102861,
+      "p95_ms": 41.79796848911792,
+      "p99_ms": 43.21362728718668,
+      "index_ms": 4528.136584209278,
+      "by_category": {
+        "architecture": 1.0,
+        "semantic": 0.8732894235571432,
+        "symbol": 0.83333333
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -127,7 +127,7 @@ check-return-types = false
 require-return-section-when-returning-nothing = false
 
 [tool.mypy]
-python_version = "3.10"
+python_version = "3.12"
 warn_unused_configs = true
 ignore_missing_imports = true
 
```

**File**: `src/semble/index/dense.py` (modified, +3/-1)
```diff
@@ -43,7 +43,9 @@ def embed_chunks(model: StaticModel, chunks: list[Chunk]) -> npt.NDArray[np.floa
     """Embed chunks using the configured model."""
     if not chunks:
         return np.empty((0, model.dim), dtype=np.float32)
-    return np.array(model.encode([c.content for c in chunks], use_multiprocessing=False), dtype=np.float32)
+    return np.array(
+        model.encode([c.content for c in chunks], use_multiprocessing=False, max_length=None), dtype=np.float32
+    )
 
 
 class SelectableBasicBackend(CosineBasicBackend):
```

---

### Incident Patch 7: `a772a37d` (2026-09-05)
**Commit Message**: fix: Correct eleven benchmark annotations (#259)

**File**: `benchmarks/annotations/aiohttp.json` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@
       "aiohttp/client_ws.py"
     ],
     "secondary": [
-      "aiohttp/_websocket/reader.py"
+      "aiohttp/_websocket/reader_py.py"
     ],
     "category": "semantic"
   },
```

**File**: `benchmarks/annotations/model2vec.json` (modified, +2/-4)
```diff
@@ -22,9 +22,7 @@
     "relevant": [
       "model2vec/tokenizer/tokenizer.py"
     ],
-    "secondary": [
-      "model2vec/distill/utils.py"
-    ],
+    "secondary": [],
     "category": "semantic"
   },
   {
@@ -122,7 +120,7 @@
   {
     "query": "how vocabulary is pruned during distillation",
     "relevant": [
-      "model2vec/distill/utils.py"
+      "model2vec/tokenizer/tokenizer.py"
     ],
     "secondary": [
       "model2vec/distill/distillation.py"
```

**File**: `benchmarks/annotations/pydantic.json` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@
       "pydantic/functional_validators.py"
     ],
     "secondary": [
-      "pydantic/class_validators.py"
+      "pydantic/deprecated/class_validators.py"
     ],
     "category": "semantic"
   },
```

**File**: `benchmarks/annotations/vitest.json` (modified, +2/-2)
```diff
@@ -55,8 +55,8 @@
   },
   {
     "query": "test reporter interface for listening to test events and results",
-    "relevant": ["packages/vitest/src/public/reporters.ts"],
-    "secondary": [],
+    "relevant": ["packages/vitest/src/node/types/reporter.ts"],
+    "secondary": ["packages/vitest/src/node/reporters/index.ts"],
     "category": "semantic"
   },
   {
```

**File**: `benchmarks/annotations/zod.json` (modified, +12/-12)
```diff
@@ -37,20 +37,20 @@
   },
   {
     "query": "union and discriminated union schema types",
-    "relevant": ["packages/zod/src/v4/core/api.ts"],
-    "secondary": ["packages/zod/src/v4/core/schemas.ts"],
+    "relevant": ["packages/zod/src/v4/core/schemas.ts"],
+    "secondary": ["packages/zod/src/v4/classic/schemas.ts"],
     "category": "semantic"
   },
   {
     "query": "optional and nullable type wrappers",
-    "relevant": ["packages/zod/src/v4/core/api.ts"],
-    "secondary": [],
+    "relevant": ["packages/zod/src/v4/core/schemas.ts"],
+    "secondary": ["packages/zod/src/v4/classic/schemas.ts"],
     "category": "semantic"
   },
   {
     "query": "z.transform and z.pipe for chaining Zod output transformations",
-    "relevant": ["packages/zod/src/v4/core/api.ts"],
-    "secondary": [],
+    "relevant": ["packages/zod/src/v4/core/schemas.ts"],
+    "secondary": ["packages/zod/src/v4/classic/schemas.ts"],
     "category": "semantic"
   },
   {
@@ -85,20 +85,20 @@
   },
   {
     "query": "z.record and z.map schema builders for key-value types",
-    "relevant": ["packages/zod/src/v4/core/api.ts"],
-    "secondary": [],
+    "relevant": ["packages/zod/src/v4/core/schemas.ts"],
+    "secondary": ["packages/zod/src/v4/classic/schemas.ts"],
     "category": "semantic"
   },
   {
     "query": "ZodDefault and ZodCatch schema wrappers that supply fallback values on parse failure",
-    "relevant": ["packages/zod/src/v4/core/api.ts"],
-    "secondary": [],
+    "relevant": ["packages/zod/src/v4/core/schemas.ts"],
+    "secondary": ["packages/zod/src/v4/classic/schemas.ts"],
     "category": "semantic"
   },
   {
     "query": "enum schema types for literal value sets",
-    "relevant": ["packages/zod/src/v4/core/api.ts"],
-    "secondary": [],
+    "relevant": ["packages/zod/src/v4/core/schemas.ts"],
+    "secondary": ["packages/zod/src/v4/classic/schemas.ts"],
     "category": "semantic"
   },
   {
```

---

### Incident Patch 8: `a7907800` (2026-09-05)
**Commit Message**: fix: Double embedding pass on fresh index (#260)

**File**: `README.md` (modified, +2/-2)
```diff
@@ -24,7 +24,7 @@
 
 </div>
 
-Semble is a code search library built for agents. It returns the exact code snippets they need instantly, using ~99% fewer tokens than grep+read. Indexing and searching a full codebase end-to-end takes under a second, matching the retrieval quality of a code-specialized transformer while indexing ~220x faster and querying ~17x faster (see [benchmarks](#benchmarks)). Everything runs on CPU with no API keys, GPU, or external services. Use it as an MCP server, a CLI tool via AGENTS.md, or a dedicated sub-agent, and any coding agent (Claude Code, Cursor, Codex, OpenCode, etc.) gets instant access to any repo.
+Semble is a code search library built for agents. It returns the exact code snippets they need instantly, using ~99% fewer tokens than grep+read. Indexing and searching a full codebase end-to-end takes under a second, matching the retrieval quality of a code-specialized transformer while indexing ~340x faster and querying ~17x faster (see [benchmarks](#benchmarks)). Everything runs on CPU with no API keys, GPU, or external services. Use it as an MCP server, a CLI tool via AGENTS.md, or a dedicated sub-agent, and any coding agent (Claude Code, Cursor, Codex, OpenCode, etc.) gets instant access to any repo.
 
 ## Quickstart
 
@@ -244,7 +244,7 @@ We benchmark quality and speed across ~1,250 queries over 63 repositories in 19
 </tr>
 </table>
 
-The quality benchmark (left) scores retrieval quality (NDCG@10) against total latency; semble matches the quality of the 137M-parameter [CodeRankEmbed](https://huggingface.co/nomic-ai/CodeRankEmbed) while indexing 220x faster. The token efficiency benchmark (right) measures how many tokens each method needs to reach a given recall level; semble uses 99% fewer tokens on average and hits 97% recall at only 2k tokens, while grep+read needs a full 100k context window to reach 85%. See [benchmarks](benchmarks/README.md) for per-language results, ablations, and full methodology.
+The quality benchmark (left) scores retrieval quality (NDCG@10) against total latency; semble matches the quality of the 137M-parameter [CodeRankEmbed](https://huggingface.co/nomic-ai/CodeRankEmbed) while indexing 340x faster. The token efficiency benchmark (right) measures how many tokens each method needs to reach a given recall level; semble uses 99% fewer tokens on average and hits 97% recall at only 2k tokens, while grep+read needs a full 100k context window to reach 85%. See [benchmarks](benchmarks/README.md) for per-language results, ablations, and full methodology.
 
 ## How it works
 
```

**File**: `benchmarks/README.md` (modified, +2/-2)
```diff
@@ -17,7 +17,7 @@ Quality and speed across all methods.
 
 | Method               |   NDCG@10 |      Index |   Query p50 |
 | -------------------- | --------: | ---------: | ----------: |
-| **semble**           | **0.854** | **518 ms** | **0.91 ms** |
+| **semble**           | **0.854** | **344 ms** | **0.91 ms** |
 | CodeRankEmbed        |     0.839 |      116 s |       16 ms |
 | ColGREP              |     0.693 |      5.4 s |      122 ms |
 | BM25                 |     0.673 |      47 ms |     0.17 ms |
@@ -32,7 +32,7 @@ Quality and speed across all methods.
 | :-----------------------------------------------------------------: | :-----------------------------------------------------------------: |
 |          _Time to first result (index + query) vs NDCG@10_          |             _Query latency on a warm index vs NDCG@10_              |
 
-semble matches the NDCG@10 of the 137M-param CodeRankEmbed while winning index time by ~220x and query latency by ~17x.
+semble matches the NDCG@10 of the 137M-param CodeRankEmbed while winning index time by ~340x and query latency by ~17x.
 
 NDCG@10 is averaged across all queries. Speed numbers use one repo per language, CPU only: cold-start index time and warm query p50 (median across 5 consecutive runs).
 
```

**File**: `benchmarks/plot.py` (modified, +1/-1)
```diff
@@ -96,7 +96,7 @@ class _Method(TypedDict):
     {
         "name": "semble",
         "ndcg10": 0.8544,
-        "index_ms": 518.2,
+        "index_ms": 343.5,
         "query_p50_ms": 0.91,
         "color": "#1a5fa8",
         "params_m": 16,
```

**File**: `src/semble/index/create.py` (modified, +5/-8)
```diff
@@ -135,15 +135,12 @@ def create_index_from_path(
     if not chunks:
         raise ValueError(f"No supported files found under {path}.")
 
-    if previous is None:
-        embeddings = embed_chunks(model, chunks)
+    if previous is not None and _has_same_vector_layout(manifest, previous_manifest):
+        embeddings = previous.vectors
+        for vector_part, start, count in embedding_parts:
+            embeddings[start : start + count] = vector_parts[vector_part]
     else:
-        if _has_same_vector_layout(manifest, previous_manifest):
-            embeddings = previous.vectors
-            for vector_part, start, count in embedding_parts:
-                embeddings[start : start + count] = vector_parts[vector_part]
-        else:
-            embeddings = np.vstack(vector_parts)
+        embeddings = np.vstack(vector_parts)
     bm25_index.set_doc_order(chunk_ids)
     semantic_index = SelectableBasicBackend(embeddings, BasicArgs())
 
```

**File**: `src/semble/installer/installer.py` (modified, +2/-2)
```diff
@@ -175,12 +175,12 @@ def _apply(mode: Mode, agents: list[AgentTarget], integrations: list[_Integratio
         for integ in integrations:
             result = integ.apply(agent, mode)
             if result is None:
-                print(f"    {_DIM}– {integ.id}: not supported{_RESET}")
+                print(f"    {_DIM}– {integ.id.value}: not supported{_RESET}")
                 continue
             ok = result.action in ("created", "updated", "removed", "unchanged")
             detail = _ACTION_DETAIL.get(result.action, "")
             suffix = f" — {detail}" if detail else ""
-            print(f"    {_tick(ok)} {integ.id} ({result.action}){suffix} → {result.path}")
+            print(f"    {_tick(ok)} {integ.id.value} ({result.action}){suffix} → {result.path}")
         print()
 
 
```

**File**: `src/semble/version.py` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
-__version_triple__ = (0, 5, 5)
+__version_triple__ = (0, 5, 6)
 __version__ = ".".join(map(str, __version_triple__))
```

**File**: `tests/index/test_create.py` (modified, +1/-0)
```diff
@@ -34,6 +34,7 @@ def test_incremental_reindex_reuses_updates_and_prunes(mock_model: Any, tmp_path
     bm25_before, semantic_before, chunks_before, manifest_before = create_index_from_path(
         tmp_path, mock_model, display_root=tmp_path
     )
+    assert mock_model.encode.call_count == 4  # once per file, no second full pass
     a_entry = manifest_before["a.py"]
     b_entry = manifest_before["b.py"]
     a_vectors_before = semantic_before.vectors[a_entry.start : a_entry.end].copy()
```

---

### Incident Patch 9: `6bbbd322` (2026-08-26)
**Commit Message**: fix: permission issues in sandboxes (#256)

* fix: permission issues in sandboxes

* fix tests

**File**: `src/semble/installer/agents.py` (modified, +19/-11)
```diff
@@ -16,6 +16,22 @@
 
 _HOME = Path.home()
 
+
+def _exists_or_denied(path: Path) -> bool:
+    """Distinguish between existence and permission issues."""
+    try:
+        path.stat()
+    except FileNotFoundError:
+        return False
+    # PermissionError is a subclass of OSError
+    # which is why this looks the way it does.
+    except PermissionError:
+        return True
+    except OSError:
+        return False
+    return True
+
+
 Action = Literal["created", "updated", "unchanged", "not-found", "removed", "error", "skipped"]
 Mode = Literal["install", "uninstall"]
 
@@ -33,15 +49,7 @@ class IntegrationType(str, Enum):
 
 
 def semble_pin() -> str:
-    """Return the uvx --from specifier for the semble MCP server.
-
-    Version-pinned for normal installs (rerunning `semble install` after an
-    upgrade rewrites this pin to match). For an editable or local-directory
-    install, pins to the local source path instead, so generated configs
-    launch the checkout being developed rather than the released package.
-    For a non-editable git install, pins to the exact installed commit, since
-    that source may not correspond to any released PyPI version at all.
-    """
+    """Return the uvx --from specifier for the semble MCP server."""
     try:
         raw = importlib.metadata.distribution("semble").read_text("direct_url.json")
         if raw:
@@ -159,7 +167,7 @@ def _opencode_mcp_path() -> Path:
     base = Path(xdg) / "opencode" if xdg else _HOME / ".config" / "opencode"
     jsonc = base / "opencode.jsonc"
     json_ = base / "opencode.json"
-    return jsonc if jsonc.exists() else (json_ if json_.exists() else jsonc)
+    return jsonc if _exists_or_denied(jsonc) else (json_ if _exists_or_denied(json_) else jsonc)
 
 
 def _vscode_mcp_path() -> Path:
@@ -316,4 +324,4 @@ def is_detected(agent: AgentTarget) -> bool:
     """Return True if the agent appears to be installed."""
     if agent.binary and shutil.which(agent.binary):
         return True
-    return bool(agent.config_dir and agent.config_dir.exists())
+    return bool(agent.config_dir and _exists_or_denied(agent.config_dir))
```

**File**: `tests/test_installer.py` (modified, +26/-0)
```diff
@@ -2,6 +2,7 @@
 import json
 import sys
 from dataclasses import replace
+from pathlib import Path
 
 import pytest
 
@@ -482,6 +483,31 @@ def test_is_detected(monkeypatch, tmp_path):
     agent_no_bin = replace(agent, binary=None, config_dir=tmp_path)
     assert is_detected(agent_no_bin)
 
+    agent_missing = replace(agent, binary=None, config_dir=tmp_path / "nonexistent")
+    assert not is_detected(agent_missing)
+
+
+def test_is_detected_true_when_config_dir_stat_denied(monkeypatch, tmp_path):
+    """A config dir blocked by sandboxing (EPERM/EACCES) still counts as detected, not absent."""
+    agent = replace(next(a for a in AGENTS if a.id == "claude"), binary=None, config_dir=tmp_path)
+
+    def _denied(self):
+        raise PermissionError(1, "Operation not permitted")
+
+    monkeypatch.setattr(Path, "stat", _denied)
+    assert is_detected(agent)
+
+
+def test_is_detected_false_on_other_os_error(monkeypatch, tmp_path):
+    """A non-permission OSError (e.g. ENOTDIR) is treated as absent, not detected."""
+    agent = replace(next(a for a in AGENTS if a.id == "claude"), binary=None, config_dir=tmp_path)
+
+    def _not_a_dir(self):
+        raise NotADirectoryError(20, "Not a directory")
+
+    monkeypatch.setattr(Path, "stat", _not_a_dir)
+    assert not is_detected(agent)
+
 
 def test_checkbox(monkeypatch):
     """_checkbox wraps questionary.checkbox and returns the selected values."""
```

---

### Incident Patch 10: `b491200b` (2026-08-06)
**Commit Message**: fix: Fix Windows console issues (#244)

**File**: `README.md` (modified, +6/-1)
```diff
@@ -98,9 +98,12 @@ semble search "deployment guide" ./my-project --content docs   # or: config, all
 
 # Find code similar to a known location
 semble find-related src/auth.py 42 ./my-project
+
+# Show only the first N lines of each result's snippet (0 = path/line range only)
+semble search "authentication flow" ./my-project --max-snippet-lines 10
 ```
 
-`--content` accepts `code` (default), `docs`, `config`, or `all`. `path` defaults to the current directory when omitted; git URLs are accepted. If `semble` is not on `$PATH`, use `uvx --from "semble[mcp]" semble` in its place.
+`--content` accepts `code` (default), `docs`, `config`, or `all`. `path` defaults to the current directory when omitted; git URLs are accepted. If `semble` is not on `$PATH`, use `uvx --from "semble[mcp]" semble` in its place. `semble --version` (or `-V`) prints the installed version.
 
 <details>
 <summary>Controlling which files are indexed</summary>
@@ -173,6 +176,8 @@ By default, your Semble savings statistics and any saved indexes are stored in t
 
 On first use, Semble also downloads the embedding model from Hugging Face and caches it in the standard Hugging Face cache (`~/.cache/huggingface/` by default, or `$HF_HOME` if set); this only happens once and requires network access.
 
+Use `semble clear` to remove cached data: `semble clear index` (saved indexes), `semble clear savings` (usage stats), `semble clear orphans` (indexes for repos no longer present on disk), or `semble clear all` (everything).
+
 </details>
 
 <details>
```

**File**: `pyproject.toml` (modified, +0/-1)
```diff
@@ -30,7 +30,6 @@ dependencies = [
     "vicinity>=0.4.4",
     "numpy>=1.24.0",
     "pathspec>=0.12",
-    "tree-sitter>=0.25,<0.26",
     "orjson",
     "questionary>=2.0,<3.0",
     "semble-grammars>=0.1.2",
```

**File**: `src/semble/cli.py` (modified, +5/-0)
```diff
@@ -1,5 +1,6 @@
 import argparse
 import asyncio
+import io
 import json
 import re
 import sys
@@ -66,6 +67,10 @@ def _add_content_args(p: argparse.ArgumentParser) -> None:
 
 def main() -> None:
     """Entry point for the semble command-line tool."""
+    # Non-UTF-8 Windows consoles can't encode glyphs like "✓" and would otherwise crash.
+    for stream in (sys.stdout, sys.stderr):
+        if isinstance(stream, io.TextIOWrapper):
+            stream.reconfigure(errors="replace")
     if len(sys.argv) > 1 and sys.argv[1] in _CLI_DISPATCH_ARGS:
         _cli_main()
     else:
```

**File**: `src/semble/utils.py` (modified, +3/-1)
```diff
@@ -22,9 +22,11 @@ def resolve_chunk(chunks: list[Chunk], file_path: str, line: int) -> Chunk | Non
     Reconstructs a Chunk from its JSON-primitive MCP tool arguments (file_path + line)
     before calling into the library.
     """
+    # Normalize separators: file_path is stored with the platform's native separator.
+    file_path = file_path.replace("\\", "/")
     fallback = None
     for chunk in chunks:
-        if chunk.file_path == file_path and chunk.start_line <= line <= chunk.end_line:
+        if chunk.file_path.replace("\\", "/") == file_path and chunk.start_line <= line <= chunk.end_line:
             if line < chunk.end_line:
                 return chunk
             if fallback is None:  # line == end_line: boundary; keep as fallback for end-of-file chunks
```

**File**: `src/semble/version.py` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
-__version_triple__ = (0, 5, 3)
+__version_triple__ = (0, 5, 4)
 __version__ = ".".join(map(str, __version_triple__))
```

**File**: `tests/test_mcp.py` (modified, +4/-0)
```diff
@@ -65,6 +65,10 @@ def test_resolve_chunk() -> None:
     # Line out of range returns None.
     assert resolve_chunk([interior], "src/a.py", 99) is None
 
+    # Separator mismatch (e.g. backslash-stored path, forward-slash query) still matches.
+    backslash_chunk = make_chunk("line1\nline2\nline3", "src\\a.py")
+    assert resolve_chunk([backslash_chunk], "src/a.py", 2) is backslash_chunk
+
 
 @pytest.mark.parametrize(
     ("path", "expected"),
```

**File**: `uv.lock` (modified, +13/-15)
```diff
@@ -328,7 +328,7 @@ resolution-markers = [
     "python_full_version < '3.11'",
 ]
 dependencies = [
-    { name = "numpy", version = "2.2.6", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version < '3.11'" },
+    { name = "numpy", version = "2.2.6", source = { registry = "https://pypi.org/simple" } },
 ]
 sdist = { url = "https://files.pythonhosted.org/packages/66/54/eb9bfc647b19f2009dd5c7f5ec51c4e6ca831725f1aea7a993034f483147/contourpy-1.3.2.tar.gz", hash = "sha256:b6945942715a034c671b7fc54f9588126b0b8bf23db2696e3ca8328f3ff0ab54", size = 13466130, upload-time = "2025-04-15T17:47:53.79Z" }
 wheels = [
@@ -400,7 +400,7 @@ resolution-markers = [
     "python_full_version == '3.11.*'",
 ]
 dependencies = [
-    { name = "numpy", version = "2.4.4", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version >= '3.11'" },
+    { name = "numpy", version = "2.4.4", source = { registry = "https://pypi.org/simple" } },
 ]
 sdist = { url = "https://files.pythonhosted.org/packages/58/01/1253e6698a07380cd31a736d248a3f2a50a7c88779a1813da27503cadc2a/contourpy-1.3.3.tar.gz", hash = "sha256:083e12155b210502d0bca491432bb04d56dc3432f95a979b429f2848c3dbe880", size = 13466174, upload-time = "2025-07-26T12:03:12.549Z" }
 wheels = [
@@ -730,7 +730,7 @@ name = "exceptiongroup"
 version = "1.3.1"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
-    { name = "typing-extensions", marker = "python_full_version < '3.11'" },
+    { name = "typing-extensions" },
 ]
 sdist = { url = "https://files.pythonhosted.org/packages/50/79/66800aadf48771f6b62f7eb014e352e5d06856655206165d775e675a02c9/exceptiongroup-1.3.1.tar.gz", hash = "sha256:8b412432c6055b0b7d14c310000ae93352ed6754f70fa8f7c34141f91c4e3219", size = 30371, upload-time = "2025-11-21T23:01:54.787Z" }
 wheels = [
@@ -2900,10 +2900,10 @@ resolution-markers = [
     "python_full_version < '3.11'",
 ]
 dependencies = [
-    { name = "joblib", marker = "python_full_version < '3.11'" },
-    { name = "numpy", version = "2.2.6", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version < '3.11'" },
-    { name = "scipy", version = "1.15.3", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version < '3.11'" },
-    { name = "threadpoolctl", marker = "python_full_version < '3.11'" },
+    { name = "joblib" },
+    { name = "numpy", version = "2.2.6", source = { registry = "https://pypi.org/simple" } },
+    { name = "scipy", version = "1.15.3", source = { registry = "https://pypi.org/simple" } },
+    { name = "threadpoolctl" },
 ]
 sdist = { url = "https://files.pythonhosted.org/packages/98/c2/a7855e41c9d285dfe86dc50b250978105dce513d6e459ea66a6aeb0e1e0c/scikit_learn-1.7.2.tar.gz", hash = "sha256:20e9e49ecd130598f1ca38a1d85090e1a600147b9c02fa6f15d69cb53d968fda", size = 7193136, upload-time = "2025-09-09T08:21:29.075Z" }
 wheels = [
@@ -2949,10 +2949,10 @@ resolution-markers = [
     "python_full_version == '3.11.*'",
 ]
 dependencies = [
-    { name = "joblib", marker = "python_full_version >= '3.11'" },
-    { name = "numpy", version = "2.4.4", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version >= '3.11'" },
-    { name = "scipy", version = "1.17.1", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version >= '3.11'" },
-    { name = "threadpoolctl", marker = "python_full_version >= '3.11'" },
+    { name = "joblib" },
+    { name = "numpy", version = "2.4.4", source = { registry = "https://pypi.org/simple" } },
+    { name = "scipy", version = "1.17.1", source = { registry = "https://pypi.org/simple" } },
+    { name = "threadpoolctl" },
 ]
 sdist = { url = "https://files.pythonhosted.org/packages/0e/d4/40988bf3b8e34feec1d0e6a051446b1f66225f8529b9309becaeef62b6c4/scikit_learn-1.8.0.tar.gz", hash = "sha256:9bccbb3b40e3de10351f8f5068e105d0f4083b1a65fa07b6634fbc401a6287fd", size = 7335585, upload-time = "2025-12-10T07:08:53.618Z" }
 wheels = [
@@ -3002,7 +3002,7 @@ resolution-markers = [
     "python_full_version < '3.11'",
 ]
 dependencies = [
-    { name = "numpy", version = "2.2.6", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version < '3.11'" },
+    { name = "numpy", version = "2.2.6", source = { registry = "https://pypi.org/simple" } },
 ]
 sdist = { url = "https://files.pythonhosted.org/packages/0f/37/6964b830433e654ec7485e45a00fc9a27cf868d622838f6b6d9c5ec0d532/scipy-1.15.3.tar.gz", hash = "sha256:eae3cf522bc7df64b42cad3925c876e1b0b6c35c1337c93e12c0f366f55b0eaf", size = 59419214, upload-time = "2025-05-08T16:13:05.955Z" }
 wheels = [
@@ -3063,7 +3063,7 @@ resolution-markers = [
     "python_full_version == '3.11.*'",
 ]
 dependencies = [
-    { name = "numpy", version = "2.4.4", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version >= '3.11'" },
+    { name = "numpy", version = "2.4.4", source = { registry = "https://pypi.org/simple" } },
 ]
 sdist = { url = "htt
```

---

### Incident Patch 11: `879327eb` (2026-08-01)
**Commit Message**: benchmarks: Add codebase-memory-mcp, cs, and ck to benchmarks (#237)

**File**: `README.md` (modified, +5/-5)
```diff
@@ -1,7 +1,7 @@
 <h2 align="center">
   <img width="30%" alt="semble logo" src="https://raw.githubusercontent.com/MinishLab/semble/main/assets/images/semble_logo.png"><br/>
   Fast and Accurate Code Search for Agents<br/>
-  <sub>Uses ~98% fewer tokens than grep+read</sub>
+  <sub>Uses ~99% fewer tokens than grep+read</sub>
 </h2>
 
 <div align="center">
@@ -24,7 +24,7 @@
 
 </div>
 
-Semble is a code search library built for agents. It returns the exact code snippets they need instantly, using ~98% fewer tokens than grep+read. Indexing and searching a full codebase end-to-end takes under a second, with ~200x faster indexing and ~10x faster queries than a code-specialized transformer, at 99% of its retrieval quality (see [benchmarks](#benchmarks)). Everything runs on CPU with no API keys, GPU, or external services. Use it as an MCP server, a CLI tool via AGENTS.md, or a dedicated sub-agent, and any coding agent (Claude Code, Cursor, Codex, OpenCode, etc.) gets instant access to any repo.
+Semble is a code search library built for agents. It returns the exact code snippets they need instantly, using ~99% fewer tokens than grep+read. Indexing and searching a full codebase end-to-end takes under a second, matching the retrieval quality of a code-specialized transformer while indexing ~220x faster and querying ~17x faster (see [benchmarks](#benchmarks)). Everything runs on CPU with no API keys, GPU, or external services. Use it as an MCP server, a CLI tool via AGENTS.md, or a dedicated sub-agent, and any coding agent (Claude Code, Cursor, Codex, OpenCode, etc.) gets instant access to any repo.
 
 ## Quickstart
 
@@ -72,9 +72,9 @@ semble install --agent claude --type mcp subagent --yes
 
 ## Main Features
 
-- **Fast**: indexes an average repo in ~250 ms and answers queries in ~1.5 ms, all on CPU.
+- **Fast**: indexes an average repo in ~500 ms and answers queries in ~1 ms, all on CPU.
 - **Accurate**: NDCG@10 of 0.854 on our [benchmarks](#benchmarks), on par with code-specialized transformer models, at a fraction of the size and cost.
-- **Token-efficient**: returns only the relevant chunks, using [~98% fewer tokens than grep+read](#benchmarks).
+- **Token-efficient**: returns only the relevant chunks, using [~99% fewer tokens than grep+read](#benchmarks).
 - **Zero setup**: runs on CPU with no API keys, GPU, or external services required.
 - **MCP server**: works with Claude Code, Cursor, Codex, OpenCode, VS Code, and any other MCP-compatible agent.
 - **Local and remote**: pass a local path or a git URL.
@@ -237,7 +237,7 @@ We benchmark quality and speed across ~1,250 queries over 63 repositories in 19
 </tr>
 </table>
 
-The quality benchmark (left) scores retrieval quality (NDCG@10) against total latency; semble achieves 99% of the quality of the 137M-parameter [CodeRankEmbed](https://huggingface.co/nomic-ai/CodeRankEmbed) Hybrid while indexing 218x faster. The token efficiency benchmark (right) measures how many tokens each method needs to reach a given recall level; semble uses 98% fewer tokens on average and hits 94% recall at only 2k tokens, while grep+read needs a full 100k context window to reach 85%. See [benchmarks](benchmarks/README.md) for per-language results, ablations, and full methodology.
+The quality benchmark (left) scores retrieval quality (NDCG@10) against total latency; semble matches the quality of the 137M-parameter [CodeRankEmbed](https://huggingface.co/nomic-ai/CodeRankEmbed) while indexing 220x faster. The token efficiency benchmark (right) measures how many tokens each method needs to reach a given recall level; semble uses 99% fewer tokens on average and hits 97% recall at only 2k tokens, while grep+read needs a full 100k context window to reach 85%. See [benchmarks](benchmarks/README.md) for per-language results, ablations, and full methodology.
 
 ## How it works
 
```

**File**: `benchmarks/README.md` (modified, +114/-67)
```diff
@@ -15,22 +15,24 @@ Quality and speed benchmarks for `semble`.
 
 Quality and speed across all methods.
 
-| Method | NDCG@10 | Index | Query p50 |
-|---|---:|---:|---:|
-| CodeRankEmbed Hybrid | 0.862 | 57 s | 16 ms |
-| **semble** | **0.854** | **263 ms** | **1.5 ms** |
-| CodeRankEmbed | 0.765 | 57 s | 16 ms |
-| ColGREP | 0.693 | 5.8 s | 124 ms |
-| BM25 | 0.673 | 263 ms | 0.02 ms |
-| grepai | 0.561 | 35 s | 48 ms |
-| probe | 0.387 | — | 207 ms |
-| ripgrep | 0.126 | — | 12 ms |
+| Method               |   NDCG@10 |      Index |   Query p50 |
+| -------------------- | --------: | ---------: | ----------: |
+| **semble**           | **0.854** | **518 ms** | **0.91 ms** |
+| CodeRankEmbed        |     0.839 |      116 s |       16 ms |
+| ColGREP              |     0.693 |      5.4 s |      122 ms |
+| BM25                 |     0.673 |      47 ms |     0.17 ms |
+| ck                   |     0.642 |       96 s |      187 ms |
+| codebase-memory-mcp  |     0.630 |     454 ms |       46 ms |
+| grepai               |     0.561 |       35 s |       48 ms |
+| probe                |     0.387 |          — |      207 ms |
+| cs                   |     0.200 |          — |       22 ms |
+| ripgrep              |     0.126 |          — |       14 ms |
 
 | ![Speed vs quality (cold)](../assets/images/speed_vs_ndcg_cold.png) | ![Speed vs quality (warm)](../assets/images/speed_vs_ndcg_warm.png) |
-|:--:|:--:|
-| *Time to first result (index + query) vs NDCG@10* | *Query latency on a warm index vs NDCG@10* |
+| :-----------------------------------------------------------------: | :-----------------------------------------------------------------: |
+|          _Time to first result (index + query) vs NDCG@10_          |             _Query latency on a warm index vs NDCG@10_              |
 
-The 137M-param CodeRankEmbed Hybrid wins NDCG@10 by 0.008. semble wins index time by 218x and query latency by 11x.
+semble matches the NDCG@10 of the 137M-param CodeRankEmbed while winning index time by ~220x and query latency by ~17x.
 
 NDCG@10 is averaged across all queries. Speed numbers use one repo per language, CPU only: cold-start index time and warm query p50 (median across 5 consecutive runs).
 
@@ -44,19 +46,19 @@ Coding agents (Claude Code, OpenCode, etc.) typically find code by running `grep
 
 For each query: tokens consumed at first relevant hit, or 32k if the method never finds anything. Averaged across all 1251 queries.
 
-| Method | Expected tokens | Savings |
-|---|---:|---:|
-| ripgrep + read file | 45,692 | baseline |
-| **semble** | **566** | **98% fewer** |
+| Method              | Expected tokens |       Savings |
+| ------------------- | --------------: | ------------: |
+| ripgrep + read file |          45,587 |      baseline |
+| **semble**          |         **348** | **99% fewer** |
 
 ### Recall at fixed token budgets
 
 A relevant file is "covered" once any retrieved unit comes from it.
 
-| Method | 500 | 1k | 2k | 4k | 8k | 16k | 32k |
-|---|---:|---:|---:|---:|---:|---:|---:|
-| **semble** | **0.685** | **0.849** | **0.938** | **0.976** | **0.991** | **0.996** | **0.996** |
-| ripgrep + read file | 0.001 | 0.008 | 0.037 | 0.088 | 0.212 | 0.379 | 0.583 |
+| Method              |       500 |        1k |        2k |        4k |        8k |       16k |       32k |
+| ------------------- | --------: | --------: | --------: | --------: | --------: | --------: | --------: |
+| **semble**          | **0.842** | **0.923** | **0.967** | **0.988** | **0.995** | **0.995** | **0.995** |
+| ripgrep + read file |     0.001 |     0.008 |     0.037 |     0.086 |     0.207 |     0.374 |     0.583 |
 
 <details>
 <summary>Methodology</summary>
@@ -67,63 +69,65 @@ semble returns the top-50 ranked chunks. `ripgrep+read` splits the query into ke
 
 ## By language
 
-NDCG@10 per language, sorted by CodeRankEmbed Hybrid (CRE in the table). Best score per row is bolded.
-
-| Language | semble | CRE Hybrid | CRE | ColGREP | grepai | probe | ripgrep |
-|---|---:|---:|---:|---:|---:|---:|---:|
-| scala | 0.909 | **0.922** | 0.845 | 0.765 | 0.330 | 0.392 | 0.180 |
-| cpp | **0.915** | 0.913 | 0.846 | 0.626 | 0.731 | 0.375 | 0.126 |
-| ruby | **0.909** | **0.909** | 0.769 | 0.708 | 0.643 | 0.382 | 0.230 |
-| elixir | 0.894 | **0.905** | 0.869 | 0.808 | 0.669 | 0.412 | 0.134 |
-| javascript | 0.917 | 0.903 | **0.920** | 0.823 | 0.675 | 0.588 | 0.176 |
-| zig | **0.913** | 0.901 | 0.807 | 0.474 | 0.755 | 0.369 | 0.000 |
-| csharp | 0.885 | **0.889** | 0.743 | 0.614 | 0.277 | 0.392 | 0.117 |
-| go | **0.895** | 0.884 | 0.676 | 0.785 | 0.722 | 0.410 | 0.133 |
-| python | 0.867 | **0.880** | 0.794 | 0.777 | 0.634 | 0.488 | 0.202 |
-| php | 0.858 | **0.874** | 0.758 | 0.663 | 0.402 | 0.340 | 0.123 |
-| swift | 0.860 | **0.873** | 0.721 | 0.710 | 0.429 | 0.280 | 0.160 |
-| bash | 0.825 | 0.852 | **0.892** | 0.706 | 0.723 | 0.226 | 0.000 |
-| lua | 0.823 | **0.847** | 0.803 | 0.798 | 0.699 | 0.336 | 0.000 |
-| java | **0.849** |
```

**File**: `benchmarks/baselines/ck.py` (added, +212/-0)
```diff
@@ -0,0 +1,212 @@
+import argparse
+import json
+import shutil
+import subprocess
+import sys
+import time
+from dataclasses import dataclass
+from pathlib import Path
+
+from benchmarks.data import (
+    RepoSpec,
+    Task,
+    add_filter_args,
+    grouped_tasks,
+    load_filtered_tasks,
+    save_results,
+)
+from benchmarks.metrics import file_rank, ndcg_at_k
+
+_CK = "ck"
+_TOP_K = 10
+_LATENCY_RUNS = 3
+_INDEX_TIMEOUT = 1800
+_SEARCH_TIMEOUT = 60
+
+
+@dataclass(frozen=True)
+class RepoResult:
+    """Per-repo benchmark result."""
+
+    repo: str
+    language: str
+    ndcg10: float
+    p50_ms: float
+    index_ms: float
+
+
+def _cleanup_index(benchmark_dir: Path) -> None:
+    shutil.rmtree(benchmark_dir / ".ck", ignore_errors=True)
+    (benchmark_dir / ".ckignore").unlink(missing_ok=True)
+
+
+def _build_index(benchmark_dir: Path) -> tuple[bool, float]:
+    """Build a ck hybrid (BM25 + embedding) index for a repo; return (success, elapsed_ms)."""
+    _cleanup_index(benchmark_dir)
+    started = time.perf_counter()
+    try:
+        proc = subprocess.run(
+            [_CK, "--index", "--quiet", str(benchmark_dir)],
+            capture_output=True,
+            text=True,
+            timeout=_INDEX_TIMEOUT,
+        )
+    except subprocess.TimeoutExpired:
+        print(f"  WARNING: ck --index timed out after {_INDEX_TIMEOUT}s", file=sys.stderr)
+        return False, (time.perf_counter() - started) * 1000
+    elapsed_ms = (time.perf_counter() - started) * 1000
+    if proc.returncode != 0:
+        print(f"  WARNING: ck --index failed: {proc.stderr.strip()[:300]}", file=sys.stderr)
+        return False, elapsed_ms
+    return True, elapsed_ms
+
+
+def _run_search(query: str, benchmark_dir: Path, *, top_k: int) -> list[str]:
+    """Return absolute file paths from ck's hybrid (regex + semantic) JSON output."""
+    cmd = [_CK, "--hybrid", "--json", "--quiet", "--topk", str(top_k), query, str(benchmark_dir)]
+    try:
+        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=_SEARCH_TIMEOUT)
+    except subprocess.TimeoutExpired:
+        return []
+    # ck exits 1 with "No matches found" on stderr (empty stdout) rather than an empty JSON array.
+    # --json with --quiet is actually JSONL (one object per line), not a wrapped JSON array.
+    if not proc.stdout.strip():
+        return []
+    items: list[dict] = []
+    for line in proc.stdout.splitlines():
+        line = line.strip()
+        if not line:
+            continue
+        try:
+            items.append(json.loads(line))
+        except json.JSONDecodeError:
+            continue
+    seen: dict[str, None] = {}
+    for item in items:
+        rel = item.get("file", "")
+        if rel:
+            abs_path = str((benchmark_dir / rel).resolve())
+            seen[abs_path] = None
+    return list(seen)[:top_k]
+
+
+def _evaluate_repo(
+    tasks: list[Task],
+    benchmark_dir: Path,
+    *,
+    verbose: bool = False,
+) -> tuple[float, float]:
+    """Return (mean ndcg@10, p50 latency ms) for a list of tasks."""
+    ndcg10_sum = 0.0
+    latencies: list[float] = []
+
+    for task in tasks:
+        query_latencies: list[float] = []
+        file_paths: list[str] = []
+        for _ in range(_LATENCY_RUNS):
+            started = time.perf_counter()
+            file_paths = _run_search(task.query, benchmark_dir, top_k=_TOP_K)
+            query_latencies.append((time.perf_counter() - started) * 1000)
+        latencies.append(sorted(query_latencies)[_LATENCY_RUNS // 2])
+
+        relevant_ranks = [rank for t in task.all_relevant if (rank := file_rank(file_paths, t.path)) is not None]
+        q_ndcg10 = ndcg_at_k(relevant_ranks, len(task.all_relevant), _TOP_K)
+        ndcg10_sum += q_ndcg10
+
+        if verbose:
+            print(
+                f"  ndcg@10={q_ndcg10:.3f}  ranks={relevant_ranks}  n_rel={len(task.all_relevant)}  q={task.query!r}",
+                file=sys.stderr,
+            )
+            print(f"    targets: {', '.join(t.path for t in task.all_relevant)}", file=sys.stderr)
+            print(f"    top-5:   {[Path(fp).name for fp in file_paths[:5]]}", file=sys.stderr)
+
+    latencies.sort()
+    return ndcg10_sum / len(tasks), latencies[len(latencies) // 2]
+
+
+def _run_repo(spec: RepoSpec, tasks: list[Task], *, verbose: bool) -> RepoResult | None:
+    """Index, evaluate, and clean up a single repo."""
+    benchmark_dir = spec.benchmark_dir
+    ok, index_ms = _build_index(benchmark_dir)
+    if not ok:
+        print(f"  SKIP: {spec.name} — ck indexing failed", file=sys.stderr)
+        _cleanup_index(benchmark_dir)
+        return None
+
+    try:
+        ndcg10, p50_ms = _evaluate_repo(tasks, benchmark_dir, verbose=verbose)
+    finally:
+        _cleanup_index(benchmark_dir)
+
+    return RepoResult(repo=spec.name, language=spec.language, ndcg10=ndcg10, p50_ms=p50_ms, index_ms=index_ms)
+
+
+def _parse_args() -> argparse.Namespace:
+    parser = argparse.Argumen
```

**File**: `benchmarks/baselines/codebase_memory.py` (added, +219/-0)
```diff
@@ -0,0 +1,219 @@
+import argparse
+import json
+import re
+import subprocess
+import sys
+import time
+from dataclasses import dataclass
+from pathlib import Path
+
+from benchmarks.data import (
+    RepoSpec,
+    Task,
+    add_filter_args,
+    grouped_tasks,
+    load_filtered_tasks,
+    save_results,
+)
+from benchmarks.metrics import file_rank, ndcg_at_k
+
+_BIN = "codebase-memory-mcp"
+_TOP_K = 10
+_LATENCY_RUNS = 3
+_INDEX_TIMEOUT = 600
+_SEARCH_TIMEOUT = 60
+
+# codebase-memory-mcp normalizes non-ASCII/unsafe characters into the project name;
+# benchmark repo names are already ASCII-safe slugs, but strip anything it wouldn't accept.
+_PROJECT_NAME_RE = re.compile(r"[^a-zA-Z0-9_-]")
+
+
+@dataclass(frozen=True)
+class RepoResult:
+    """Per-repo benchmark result."""
+
+    repo: str
+    language: str
+    ndcg10: float
+    p50_ms: float
+    index_ms: float
+
+
+def _project_name(repo: str) -> str:
+    return f"semble-bench-{_PROJECT_NAME_RE.sub('-', repo)}"
+
+
+def _run_cli(args: list[str], *, timeout: int) -> dict | None:
+    """Run `codebase-memory-mcp cli ...` and return the parsed structuredContent, or None on failure."""
+    cmd = [_BIN, "cli", *args, "--json"]
+    try:
+        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
+    except subprocess.TimeoutExpired:
+        return None
+    if proc.returncode != 0:
+        return None
+    try:
+        data = json.loads(proc.stdout)
+    except json.JSONDecodeError:
+        return None
+    if data.get("isError"):
+        return None
+    return data.get("structuredContent")
+
+
+def _cleanup_index(project: str) -> None:
+    _run_cli(["delete_project", "--project", project], timeout=30)
+
+
+def _build_index(benchmark_dir: Path, project: str) -> tuple[bool, float]:
+    """Index a repo into a fresh graph project; return (success, elapsed_ms)."""
+    _cleanup_index(project)
+    started = time.perf_counter()
+    result = _run_cli(
+        ["index_repository", "--repo-path", str(benchmark_dir), "--name", project, "--mode", "fast"],
+        timeout=_INDEX_TIMEOUT,
+    )
+    elapsed_ms = (time.perf_counter() - started) * 1000
+    return result is not None, elapsed_ms
+
+
+def _run_search(query: str, benchmark_dir: Path, project: str, *, top_k: int) -> list[str]:
+    """Return absolute file paths from search_graph's BM25-ranked results."""
+    result = _run_cli(
+        ["search_graph", "--project", project, "--query", query, "--limit", str(top_k)],
+        timeout=_SEARCH_TIMEOUT,
+    )
+    if result is None:
+        return []
+    seen: dict[str, None] = {}
+    for item in result.get("results", []):
+        rel = item.get("file_path", "")
+        if rel:
+            abs_path = str((benchmark_dir / rel).resolve())
+            seen[abs_path] = None
+    return list(seen)[:top_k]
+
+
+def _evaluate_repo(
+    tasks: list[Task],
+    benchmark_dir: Path,
+    project: str,
+    *,
+    verbose: bool = False,
+) -> tuple[float, float]:
+    """Return (mean ndcg@10, p50 latency ms) for a list of tasks."""
+    ndcg10_sum = 0.0
+    latencies: list[float] = []
+
+    for task in tasks:
+        query_latencies: list[float] = []
+        file_paths: list[str] = []
+        for _ in range(_LATENCY_RUNS):
+            started = time.perf_counter()
+            file_paths = _run_search(task.query, benchmark_dir, project, top_k=_TOP_K)
+            query_latencies.append((time.perf_counter() - started) * 1000)
+        latencies.append(sorted(query_latencies)[_LATENCY_RUNS // 2])
+
+        relevant_ranks = [rank for t in task.all_relevant if (rank := file_rank(file_paths, t.path)) is not None]
+        q_ndcg10 = ndcg_at_k(relevant_ranks, len(task.all_relevant), _TOP_K)
+        ndcg10_sum += q_ndcg10
+
+        if verbose:
+            print(
+                f"  ndcg@10={q_ndcg10:.3f}  ranks={relevant_ranks}  n_rel={len(task.all_relevant)}  q={task.query!r}",
+                file=sys.stderr,
+            )
+            print(f"    targets: {', '.join(t.path for t in task.all_relevant)}", file=sys.stderr)
+            print(f"    top-5:   {[Path(fp).name for fp in file_paths[:5]]}", file=sys.stderr)
+
+    latencies.sort()
+    return ndcg10_sum / len(tasks), latencies[len(latencies) // 2]
+
+
+def _run_repo(spec: RepoSpec, tasks: list[Task], *, verbose: bool) -> RepoResult | None:
+    """Index, evaluate, and clean up a single repo."""
+    project = _project_name(spec.name)
+    benchmark_dir = spec.benchmark_dir
+    ok, index_ms = _build_index(benchmark_dir, project)
+    if not ok:
+        print(f"  SKIP: {spec.name} — codebase-memory-mcp indexing failed", file=sys.stderr)
+        _cleanup_index(project)
+        return None
+
+    try:
+        ndcg10, p50_ms = _evaluate_repo(tasks, benchmark_dir, project, verbose=verbose)
+    finally:
+        _cleanup_index(project)
+
+    return RepoResult(repo=spec.name, language=spec.language, ndcg10=ndcg10, p50_ms=p50_ms, index_ms=index_ms)
+
+

```

**File**: `benchmarks/baselines/coderankembed.py` (modified, +81/-78)
```diff
@@ -18,39 +18,63 @@
     load_filtered_tasks,
     results_path,
     save_results,
-    summarize_modes,
 )
 from benchmarks.metrics import ndcg_at_k, target_rank
-from semble import SembleIndex
-from semble.types import SearchResult
+from semble.index.create import create_index_from_path
+from semble.index.index import SembleIndex
+from semble.types import ContentType, SearchResult
 
 _MODEL_NAME = "nomic-ai/CodeRankEmbed"
 _TOP_K = 10
 _LATENCY_RUNS = 3  # transformer inference is slow; keep runs low
+_ALPHA = 1.0  # SembleIndex.search()'s alpha: 1.0 = full semantic weight
+
+_UNSET = object()
 
 
 class _AsymmetricWrapper:
-    """Wrap SentenceTransformer with asymmetric query/document prompts."""
+    """Wrap SentenceTransformer with asymmetric query/document prompts.
+
+    semble only passes use_multiprocessing during index-time calls, never at query time, so its
+    presence is a reliable query/document discriminator (batch size is not: single-chunk files are
+    real one-element document batches).
+    """
 
     def __init__(self, model: SentenceTransformer, max_seq_length: int = 512) -> None:
         self._model = model
         self._model.max_seq_length = max_seq_length
 
-    def encode(self, texts: Sequence[str]) -> np.ndarray:
-        """Encode texts with query or document prompt based on batch size."""
+    def encode(self, texts: Sequence[str], use_multiprocessing: object = _UNSET) -> np.ndarray:
+        """Encode with the query prompt only when use_multiprocessing wasn't passed."""
         text_list = list(texts)
-        if len(text_list) == 1:
+        if use_multiprocessing is _UNSET:
             return self._model.encode(text_list, prompt_name="query", batch_size=1)  # type: ignore[return-value]
         return self._model.encode(text_list, batch_size=1)  # type: ignore[return-value]
 
 
+def _build_index(benchmark_dir: Path, model: _AsymmetricWrapper) -> SembleIndex:
+    """Build a SembleIndex using CodeRankEmbed embeddings for both BM25 enrichment and dense search."""
+    bm25_index, semantic_index, chunks, _manifest = create_index_from_path(
+        benchmark_dir,
+        model=model,  # type: ignore[arg-type]
+        content=(ContentType.CODE,),  # type: ignore[arg-type]
+    )
+    return SembleIndex(
+        model=model,  # type: ignore[arg-type]
+        bm25_index=bm25_index,
+        semantic_index=semantic_index,
+        chunks=chunks,
+        model_path=_MODEL_NAME,
+        root=benchmark_dir,
+    )
+
+
 @dataclass(frozen=True)
 class RepoResult:
-    """Per-repo benchmark result for one search mode."""
+    """Per-repo benchmark result."""
 
     repo: str
     language: str
-    mode: str
     chunks: int
     ndcg5: float
     ndcg10: float
@@ -77,7 +101,7 @@ def _evaluate(
         results: list[SearchResult] = []
         for _ in range(_LATENCY_RUNS):
             started = time.perf_counter()
-            results = index.search(task.query, top_k=_TOP_K)
+            results = index.search(task.query, top_k=_TOP_K, alpha=_ALPHA)
             query_latencies.append((time.perf_counter() - started) * 1000)
         latencies.append(float(np.median(query_latencies)))
 
@@ -107,27 +131,26 @@ def _evaluate(
     return ndcg5_sum / total, ndcg10_sum / total, latencies, by_category
 
 
-def _build_summary(results: list[RepoResult], modes: list[str]) -> dict[str, object]:
+def _build_summary(results: list[RepoResult]) -> dict[str, object]:
     """Build the JSON summary dict from the current (possibly partial) results list."""
+    n = len(results)
     return {
         "tool": "coderankembed",
-        "model": _MODEL_NAME,
-        "by_mode": summarize_modes(results, modes),
+        "note": f"{_MODEL_NAME} (137M params), semantic-only dense search (alpha=1.0)",
         "repos": [asdict(result) for result in results],
+        "avg_ndcg10": round(sum(r.ndcg10 for r in results) / n, 4) if n else 0.0,
+        "avg_p50_ms": round(sum(r.p50_ms for r in results) / n, 1) if n else 0.0,
+        "avg_index_ms": round(sum(r.index_ms for r in results) / n, 1) if n else 0.0,
     }
 
 
-def _load_completed(out_path: Path, modes: list[str]) -> dict[str, list[RepoResult]]:
-    """Load repos where all requested modes are already saved in a previous run."""
+def _load_completed(out_path: Path) -> dict[str, RepoResult]:
+    """Load repos already saved in a previous run, keyed by repo name."""
     if not out_path.exists():
         return {}
     try:
         data = json.loads(out_path.read_text(encoding="utf-8"))
-        by_repo: dict[str, list[RepoResult]] = {}
-        for entry in data.get("repos", []):
-            result = RepoResult(**entry)
-            by_repo.setdefault(result.repo, []).append(result)
-        return {repo: results for repo, results in by_repo.items() if {result.mode for result in results} >= set(modes)}
+        return {entry["repo"]: RepoResult(**entry) for entry in data.get("repos", [])}
     except (json.JSONDecodeError, KeyError, Type
```

**File**: `benchmarks/baselines/cs.py` (added, +115/-0)
```diff
@@ -0,0 +1,115 @@
+import json
+import sys
+import time
+from dataclasses import dataclass
+from pathlib import Path
+
+from benchmarks.data import (
+    Task,
+    add_filter_args,
+    grouped_tasks,
+    load_filtered_tasks,
+    save_results,
+)
+from benchmarks.metrics import file_rank, ndcg_at_k
+from benchmarks.tools import run_cs
+
+_TOP_K = 10
+_LATENCY_RUNS = 3
+
+
+@dataclass(frozen=True)
+class RepoResult:
+    """Per-repo benchmark result."""
+
+    repo: str
+    language: str
+    ndcg10: float
+    p50_ms: float
+
+
+def _evaluate_repo(
+    tasks: list[Task],
+    benchmark_dir: Path,
+    *,
+    verbose: bool = False,
+) -> tuple[float, float]:
+    """Return (mean ndcg@10, p50 latency ms) for a list of tasks."""
+    ndcg10_sum = 0.0
+    latencies: list[float] = []
+
+    for task in tasks:
+        query_latencies: list[float] = []
+        file_paths: list[str] = []
+        for _ in range(_LATENCY_RUNS):
+            started = time.perf_counter()
+            file_paths = run_cs(task.query, benchmark_dir, top_k=_TOP_K)
+            query_latencies.append((time.perf_counter() - started) * 1000)
+        latencies.append(sorted(query_latencies)[_LATENCY_RUNS // 2])
+
+        relevant_ranks = [rank for t in task.all_relevant if (rank := file_rank(file_paths, t.path)) is not None]
+        q_ndcg10 = ndcg_at_k(relevant_ranks, len(task.all_relevant), _TOP_K)
+        ndcg10_sum += q_ndcg10
+
+        if verbose:
+            print(
+                f"  ndcg@10={q_ndcg10:.3f}  ranks={relevant_ranks}  n_rel={len(task.all_relevant)}  q={task.query!r}",
+                file=sys.stderr,
+            )
+            print(f"    targets: {', '.join(t.path for t in task.all_relevant)}", file=sys.stderr)
+            print(f"    top-5:   {[Path(fp).name for fp in file_paths[:5]]}", file=sys.stderr)
+
+    latencies.sort()
+    return ndcg10_sum / len(tasks), latencies[len(latencies) // 2]
+
+
+def main() -> None:
+    """Run the cs (Code Spelunker) baseline benchmark."""
+    import argparse
+
+    parser = argparse.ArgumentParser(description="Benchmark cs (Code Spelunker) on the semble benchmark suite.")
+    add_filter_args(parser, verbose=True)
+    args = parser.parse_args()
+
+    repo_specs, tasks = load_filtered_tasks(args.repo or None, args.language or None)
+
+    print("cs (structural BM25 ranker, no index)", file=sys.stderr)
+    print(f"{'Repo':<22} {'Language':<12} {'NDCG@10':>8} {'p50':>8}", file=sys.stderr)
+    print(f"{'-' * 22} {'-' * 12} {'-' * 8} {'-' * 8}", file=sys.stderr)
+
+    results: list[RepoResult] = []
+    for repo, repo_task_list in sorted(grouped_tasks(tasks).items()):
+        spec = repo_specs[repo]
+        if args.verbose:
+            print(f"\n--- {repo} ---", file=sys.stderr)
+        ndcg10, p50_ms = _evaluate_repo(repo_task_list, spec.benchmark_dir, verbose=args.verbose)
+        results.append(RepoResult(repo=repo, language=spec.language, ndcg10=ndcg10, p50_ms=p50_ms))
+        print(f"{repo:<22} {spec.language:<12} {ndcg10:>8.3f} {p50_ms:>7.1f}ms", file=sys.stderr)
+
+    if not results:
+        return
+
+    avg_ndcg10 = sum(r.ndcg10 for r in results) / len(results)
+    avg_p50 = sum(r.p50_ms for r in results) / len(results)
+    print(f"{'-' * 22} {'-' * 12} {'-' * 8} {'-' * 8}", file=sys.stderr)
+    print(f"{'Average (' + str(len(results)) + ')':<22} {'':<12} {avg_ndcg10:>8.3f} {avg_p50:>7.1f}ms", file=sys.stderr)
+
+    summary = {
+        "tool": "cs",
+        "note": "structural BM25 ranker, tree-sitter aware, no persistent index",
+        "repos": [
+            {"repo": r.repo, "language": r.language, "ndcg10": round(r.ndcg10, 4), "p50_ms": round(r.p50_ms, 1)}
+            for r in results
+        ],
+        "avg_ndcg10": round(avg_ndcg10, 4),
+        "avg_p50_ms": round(avg_p50, 1),
+    }
+    print(json.dumps(summary, indent=2))
+
+    if not args.repo and not args.language:
+        out = save_results("cs", summary)
+        print(f"\nResults saved to {out}", file=sys.stderr)
+
+
+if __name__ == "__main__":
+    main()
```

**File**: `benchmarks/plot.py` (modified, +38/-22)
```diff
@@ -25,7 +25,7 @@ class _Method(TypedDict):
         "name": "ripgrep",
         "ndcg10": 0.126,
         "index_ms": 0.0,  # no persistent index; scans on the fly
-        "query_p50_ms": 12.08,
+        "query_p50_ms": 14.46,
         "color": "#606060",
         "params_m": 0,
     },
@@ -37,19 +37,43 @@ class _Method(TypedDict):
         "color": "#9b7bb0",
         "params_m": 0,
     },
+    {
+        "name": "cs",
+        "ndcg10": 0.1997,
+        "index_ms": 0.0,  # no persistent index; scans on the fly
+        "query_p50_ms": 22.1,
+        "color": "#5aa9a3",
+        "params_m": 0,
+    },
+    {
+        "name": "codebase-memory-mcp",
+        "ndcg10": 0.6298,
+        "index_ms": 454.0,
+        "query_p50_ms": 46.3,
+        "color": "#a3a34a",
+        "params_m": 0,
+    },
+    {
+        "name": "ck",
+        "ndcg10": 0.642,
+        "index_ms": 95892.7,
+        "query_p50_ms": 187.0,
+        "color": "#4a7ba3",
+        "params_m": 33,
+    },
     {
         "name": "BM25",
         "ndcg10": 0.673,
-        "index_ms": 262.6,  # same semble index infrastructure; BM25 component adds negligible overhead
-        "query_p50_ms": 0.019,
+        "index_ms": 46.6,  # standalone BM25 build time, not shared with semble's dense index
+        "query_p50_ms": 0.17,  # standalone bm25_index.get_scores() + top-k sort, not hybrid search()
         "color": "#3a9e7e",
         "params_m": 0,
     },
     {
         "name": "ColGREP",
         "ndcg10": 0.6925,
-        "index_ms": 5750.6,
-        "query_p50_ms": 123.83,
+        "index_ms": 5359.0,
+        "query_p50_ms": 122.42,
         "color": "#e8a838",
         "params_m": 16,
     },
@@ -63,25 +87,17 @@ class _Method(TypedDict):
     },
     {
         "name": "CodeRankEmbed",
-        "ndcg10": 0.7648,
-        "index_ms": 57269.4,
-        "query_p50_ms": 16.27,
+        "ndcg10": 0.8393,
+        "index_ms": 115859.8,
+        "query_p50_ms": 15.56,
         "color": "#d9634f",
         "params_m": 137,
     },
-    {
-        "name": "CodeRankEmbed\nHybrid",
-        "ndcg10": 0.8617,
-        "index_ms": 57269.4,
-        "query_p50_ms": 16.27,
-        "color": "#922b21",
-        "params_m": 137,
-    },
     {
         "name": "semble",
         "ndcg10": 0.8544,
-        "index_ms": 262.6,
-        "query_p50_ms": 1.49,
+        "index_ms": 518.2,
+        "query_p50_ms": 0.91,
         "color": "#1a5fa8",
         "params_m": 16,
     },
@@ -93,11 +109,11 @@ class _Method(TypedDict):
 _CBRT_LABEL_DELTA_WARM = 0.2
 
 # Frontier methods per mode.
-# Cold: incumbent prior-art curve (ripgrep → BM25 → ColGREP → CRE Hybrid); semble floats above it.
-# Warm: BM25 dominates ripgrep (faster and higher NDCG), so incumbent curve is BM25 → CRE Hybrid.
+# Cold: incumbent prior-art curve (ripgrep → BM25 → ColGREP → CodeRankEmbed); semble floats above it.
+# Warm: BM25 dominates ripgrep (faster and higher NDCG), so incumbent curve is BM25 → CodeRankEmbed.
 _FRONTIER_NAMES: dict[str, set[str]] = {
-    "cold": {"ripgrep", "BM25", "ColGREP", "CodeRankEmbed\nHybrid"},
-    "warm": {"BM25", "CodeRankEmbed\nHybrid"},
+    "cold": {"ripgrep", "BM25", "ColGREP", "CodeRankEmbed"},
+    "warm": {"BM25", "CodeRankEmbed"},
 }
 
 
```

**File**: `benchmarks/results/ck-2e3d2dd2cf8e.json` (added, +450/-0)
```diff
@@ -0,0 +1,450 @@
+{
+  "tool": "ck",
+  "note": "hybrid regex + BAAI/bge-small-en-v1.5 (33M params) semantic search, RRF fusion",
+  "repos": [
+    {
+      "repo": "abseil-cpp",
+      "language": "cpp",
+      "ndcg10": 0.6441,
+      "p50_ms": 431.1,
+      "index_ms": 732963.0
+    },
+    {
+      "repo": "aeson",
+      "language": "haskell",
+      "ndcg10": 0.8684,
+      "p50_ms": 150.0,
+      "index_ms": 99192.0
+    },
+    {
+      "repo": "aiohttp",
+      "language": "python",
+      "ndcg10": 0.6689,
+      "p50_ms": 145.4,
+      "index_ms": 77115.0
+    },
+    {
+      "repo": "alamofire",
+      "language": "swift",
+      "ndcg10": 0.7738,
+      "p50_ms": 144.8,
+      "index_ms": 24072.0
+    },
+    {
+      "repo": "axios",
+      "language": "javascript",
+      "ndcg10": 0.6031,
+      "p50_ms": 142.4,
+      "index_ms": 13177.0
+    },
+    {
+      "repo": "axum",
+      "language": "rust",
+      "ndcg10": 0.4694,
+      "p50_ms": 150.0,
+      "index_ms": 64744.0
+    },
+    {
+      "repo": "bash-it",
+      "language": "bash",
+      "ndcg10": 0.5934,
+      "p50_ms": 247.4,
+      "index_ms": 49291.0
+    },
+    {
+      "repo": "bats-core",
+      "language": "bash",
+      "ndcg10": 0.9215,
+      "p50_ms": 147.7,
+      "index_ms": 2356.0
+    },
+    {
+      "repo": "cats",
+      "language": "scala",
+      "ndcg10": 0.7211,
+      "p50_ms": 172.6,
+      "index_ms": 46817.0
+    },
+    {
+      "repo": "chi",
+      "language": "go",
+      "ndcg10": 0.2999,
+      "p50_ms": 159.5,
+      "index_ms": 19697.0
+    },
+    {
+      "repo": "circe",
+      "language": "scala",
+      "ndcg10": 0.72,
+      "p50_ms": 152.8,
+      "index_ms": 7351.0
+    },
+    {
+      "repo": "click",
+      "language": "python",
+      "ndcg10": 0.9156,
+      "p50_ms": 143.7,
+      "index_ms": 25511.0
+    },
+    {
+      "repo": "cobra",
+      "language": "go",
+      "ndcg10": 0.5923,
+      "p50_ms": 151.7,
+      "index_ms": 29510.0
+    },
+    {
+      "repo": "commons-lang",
+      "language": "java",
+      "ndcg10": 0.82,
+      "p50_ms": 194.6,
+      "index_ms": 114592.0
+    },
+    {
+      "repo": "curl",
+      "language": "c",
+      "ndcg10": 0.4848,
+      "p50_ms": 220.9,
+      "index_ms": 333137.0
+    },
+    {
+      "repo": "dapper",
+      "language": "csharp",
+      "ndcg10": 0.6627,
+      "p50_ms": 150.6,
+      "index_ms": 40006.0
+    },
+    {
+      "repo": "ecto",
+      "language": "elixir",
+      "ndcg10": 0.7575,
+      "p50_ms": 153.5,
+      "index_ms": 120090.0
+    },
+    {
+      "repo": "exposed",
+      "language": "kotlin",
+      "ndcg10": 0.4831,
+      "p50_ms": 156.1,
+      "index_ms": 28931.0
+    },
+    {
+      "repo": "express",
+      "language": "javascript",
+      "ndcg10": 0.9131,
+      "p50_ms": 134.7,
+      "index_ms": 9316.0
+    },
+    {
+      "repo": "fastapi",
+      "language": "python",
+      "ndcg10": 0.6479,
+      "p50_ms": 165.9,
+      "index_ms": 37138.0
+    },
+    {
+      "repo": "flask",
+      "language": "python",
+      "ndcg10": 0.6708,
+      "p50_ms": 143.8,
+      "index_ms": 23902.0
+    },
+    {
+      "repo": "fmtlib",
+      "language": "cpp",
+      "ndcg10": 0.784,
+      "p50_ms": 143.9,
+      "index_ms": 69699.0
+    },
+    {
+      "repo": "gin",
+      "language": "go",
+      "ndcg10": 0.481,
+      "p50_ms": 158.3,
+      "index_ms": 59892.0
+    },
+    {
+      "repo": "gson",
+      "language": "java",
+      "ndcg10": 0.5398,
+      "p50_ms": 188.1,
+      "index_ms": 52071.0
+    },
+    {
+      "repo": "guzzle",
+      "language": "php",
+      "ndcg10": 0.7665,
+      "p50_ms": 143.0,
+      "index_ms": 7501.0
+    },
+    {
+      "repo": "http4s",
+      "language": "scala",
+      "ndcg10": 0.7113,
+      "p50_ms": 182.0,
+      "index_ms": 37805.0
+    },
+    {
+      "repo": "httpx",
+      "language": "python",
+      "ndcg10": 0.7891,
+      "p50_ms": 140.6,
+      "index_ms": 22163.0
+    },
+    {
+      "repo": "jackson-databind",
+      "language": "java",
+      "ndcg10": 0.4578,
+      "p50_ms": 248.6,
+      "index_ms": 169660.0
+    },
+    {
+      "repo": "kotlinx-coroutines",
+      "language": "kotlin",
+      "ndcg10": 0.7108,
+      "p50_ms": 156.6,
+      "index_ms": 35395.0
+    },
+    {
+      "repo": "ktor",
+      "language": "kotlin",
+      "ndcg10": 0.5657,
+      "p50_ms": 157.2,
+      "index_ms": 15309.0
+    },
+    {
+      "repo": "laravel-framework",
+      "language": "php",
+      "ndcg10": 0.4068,
+      "p50_ms": 563.3,
+      "index_ms": 211546.0
+    },
+    {
+      "repo": "lazy.nvim",
+      "language": "lua",
+      "ndcg10": 0.6213,
+      "p50_ms": 143.8,
+      "index_ms": 11865.0
+    },
+    {
+      "repo": "libuv",
+      "language": "c",
+      "ndcg10": 0.4899,
+      "p50_ms": 167.1,
+      "index_ms": 108649.0
+    },
+    {
+      "repo": "messagepack-csharp",
+      "language": "csharp",
+      "ndcg1
```

---

### Incident Patch 12: `f4c397e2` (2026-07-13)
**Commit Message**: fix: Add try except for force download (#223)

**File**: `src/semble/index/dense.py` (modified, +4/-1)
```diff
@@ -21,7 +21,10 @@ def _load_cached(model_path: str) -> StaticModel:
     # Disable HF progress bars since the model is loaded silently in the background during indexing.
     disable_progress_bars()
     try:
-        model = StaticModel.from_pretrained(model_path, force_download=False)
+        try:
+            model = StaticModel.from_pretrained(model_path, force_download=False)
+        except ValueError:
+            model = StaticModel.from_pretrained(model_path, force_download=True)
     finally:
         disable_progress_bars()
 
```

**File**: `src/semble/version.py` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
-__version_triple__ = (0, 5, 0)
+__version_triple__ = (0, 5, 1)
 __version__ = ".".join(map(str, __version_triple__))
```

**File**: `tests/test_search.py` (modified, +14/-7)
```diff
@@ -1,5 +1,5 @@
 from typing import Any
-from unittest.mock import MagicMock, patch
+from unittest.mock import MagicMock, call, patch
 
 import bm25s
 import numpy as np
@@ -132,19 +132,26 @@ def test_sort_top_k() -> None:
 
 
 @pytest.mark.parametrize(
-    ("model_path", "expected_call_arg"),
+    ("model_path", "expected_call_arg", "incomplete_cache"),
     [
-        (None, "minishlab/potion-code-16M-v2"),  # default model
-        ("some/custom/model", "some/custom/model"),  # explicit path forwarded
+        (None, "minishlab/potion-code-16M-v2", False),  # default model
+        ("some/custom/model", "some/custom/model", False),  # explicit path forwarded
+        ("broken/model", "broken/model", True),  # incomplete cache retries through the Hub
     ],
 )
-def test_load_model(model_path: str | None, expected_call_arg: str) -> None:
+def test_load_model(model_path: str | None, expected_call_arg: str, incomplete_cache: bool) -> None:
     """load_model calls from_pretrained with default or custom model path."""
     fake_model = MagicMock(spec=StaticModel)
-    with patch("semble.index.dense.StaticModel.from_pretrained", return_value=fake_model) as mock_fp:
+    side_effect = [ValueError("Could not find expected model files"), fake_model] if incomplete_cache else None
+    with patch(
+        "semble.index.dense.StaticModel.from_pretrained", return_value=fake_model, side_effect=side_effect
+    ) as mock_fp:
         result, _ = load_model(model_path)
-    mock_fp.assert_called_once_with(expected_call_arg, force_download=False)
     assert result is fake_model
+    expected_calls = [call(expected_call_arg, force_download=False)]
+    if incomplete_cache:
+        expected_calls.append(call(expected_call_arg, force_download=True))
+    assert mock_fp.call_args_list == expected_calls
 
 
 def test_embed_chunks_empty_returns_empty_array(mock_model: Any) -> None:
```

---

### Incident Patch 13: `41c36f78` (2026-06-23)
**Commit Message**: fix: Validate cached MCP indexes on query (#211)

**File**: `src/semble/mcp.py` (modified, +51/-7)
```diff
@@ -3,6 +3,7 @@
 import asyncio
 import json
 import logging
+import time
 from collections import OrderedDict
 from collections.abc import Sequence
 from pathlib import Path
@@ -11,7 +12,7 @@
 from mcp.server.fastmcp import FastMCP
 from pydantic import Field
 
-from semble.cache import save_index_to_cache
+from semble.cache import get_validated_cache, save_index_to_cache
 from semble.index import SembleIndex
 from semble.index.dense import load_model
 from semble.types import ContentType
@@ -25,6 +26,7 @@
 )
 
 _CACHE_MAX_SIZE = 10  # Max number of cached indexes to keep in memory
+_MIN_REVALIDATE_FACTOR = 3  # Don't recheck staleness sooner than this many times the last build's duration
 
 
 async def _get_index(
@@ -169,6 +171,7 @@ def __init__(self, content: Sequence[ContentType] = (ContentType.CODE,)) -> None
         self._model_ready = asyncio.Event()
         self._content = content
         self._tasks: OrderedDict[str, asyncio.Task[SembleIndex]] = OrderedDict()  # ordered for LRU eviction
+        self._revalidate_after: dict[str, float] = {}  # cache_key -> monotonic time, staleness check is gated until
 
     async def _await_model(self) -> str:
         """Block until the model is installed; re-raise the load error if it failed."""
@@ -196,22 +199,63 @@ def _build_and_cache_index(self, source: str, ref: str | None, model_path: str,
             logger.warning("Failed to save index cache for %r", cache_key, exc_info=True)
         return index
 
+    async def _build_and_track(self, source: str, ref: str | None, model_path: str, cache_key: str) -> SembleIndex:
+        """Build an index and, for local paths, record when its staleness cooldown ends.
+
+        The cooldown write happens after the await, i.e. back on the event loop thread,
+        regardless of which thread `_build_and_cache_index` itself ran on.
+        """
+        start = time.monotonic()
+        index = await asyncio.to_thread(self._build_and_cache_index, source, ref, model_path, cache_key)
+        if not is_git_url(source):
+            finished = time.monotonic()
+            self._revalidate_after[cache_key] = finished + (finished - start) * _MIN_REVALIDATE_FACTOR
+        return index
+
     def evict(self, source: str) -> None:
-        self._tasks.pop(self._compute_cache_key(source), None)
+        cache_key = self._compute_cache_key(source)
+        self._tasks.pop(cache_key, None)
+        self._revalidate_after.pop(cache_key, None)
+
+    async def _evict_if_stale(self, source: str, cache_key: str) -> None:
+        """Evict a cached local-path entry whose on-disk cache no longer matches its files.
+
+        Skipped while inside the cooldown window so repos that are slow to build aren't
+        rebuilt faster than they can be served.
+        """
+        cached = self._tasks.get(cache_key)
+        if (
+            cached is None
+            or is_git_url(source)
+            or not cached.done()
+            or cached.cancelled()
+            or cached.exception() is not None
+        ):
+            return
+        if time.monotonic() < self._revalidate_after.get(cache_key, 0.0):
+            return
+        validated = await asyncio.to_thread(get_validated_cache, cache_key, self._model_path, self._content)
+        # Only evict if this entry hasn't already been replaced by a concurrent caller.
+        if validated is None and self._tasks.get(cache_key) is cached:
+            self.evict(source)
 
     async def get(self, source: str, ref: str | None = None) -> SembleIndex:
-        """Return an index for the requested source, building and caching it on first access."""
+        """Return an index for the requested source, building and caching it on first access.
+
+        Local paths are revalidated against the on-disk cache on every call (subject to a
+        cooldown scaled by build time), so an entry is rebuilt once its files change.
+        """
         cache_key = self._compute_cache_key(source, ref)
+        await self._evict_if_stale(source, cache_key)
 
         if cache_key not in self._tasks:
             model_path = await self._await_model()
             # Re-check after the await: another caller may have populated the entry.
             if cache_key not in self._tasks:
                 if len(self._tasks) >= _CACHE_MAX_SIZE:
-                    self._tasks.popitem(last=False)
-                self._tasks[cache_key] = asyncio.create_task(
-                    asyncio.to_thread(self._build_and_cache_index, source, ref, model_path, cache_key)
-                )
+                    evicted_key, _ = self._tasks.popitem(last=False)
+                    self._revalidate_after.pop(evicted_key, None)
+                self._tasks[cache_key] = asyncio.create_task(self._build_and_track(source, ref, model_path, cache_key))
         self._tasks.move_to_end(cache_key)
         task = self._tasks[cache_key]
         try:
```

**File**: `src/semble/version.py` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
-__version_triple__ = (0, 4, 0)
+__version_triple__ = (0, 4, 1)
 __version__ = ".".join(map(str, __version_triple__))
```

**File**: `tests/test_mcp.py` (modified, +85/-0)
```diff
@@ -1,5 +1,6 @@
 import asyncio
 import threading
+import time
 from pathlib import Path
 from typing import Any
 from unittest.mock import MagicMock, patch
@@ -135,6 +136,7 @@ async def test_index_cache_builds_and_caches(
     with (
         patch(f"semble.mcp.SembleIndex.{patch_target}", return_value=fake_index) as mock_build,
         patch("semble.mcp.save_index_to_cache") as mock_save,
+        patch("semble.mcp.get_validated_cache", return_value=Path("/fake/cache")),
     ):
         first = await cache.get(resolved_source)
         second = await cache.get(resolved_source)
@@ -144,6 +146,89 @@ async def test_index_cache_builds_and_caches(
     mock_save.assert_called_once_with(fake_index, cache._compute_cache_key(resolved_source))
 
 
+@pytest.mark.anyio
+@pytest.mark.parametrize(
+    ("source", "patch_target", "expected_build_calls", "validate_called"),
+    [
+        ("local_tmp_path", "from_path", 2, True),
+        ("https://github.com/org/repo", "from_git", 1, False),
+    ],
+    ids=["local_path_rebuilds_when_stale", "git_url_skips_revalidation"],
+)
+async def test_index_cache_staleness_check_scope(
+    cache: _IndexCache,
+    tmp_path: Path,
+    source: str,
+    patch_target: str,
+    expected_build_calls: int,
+    validate_called: bool,
+) -> None:
+    """Local paths are revalidated (and rebuilt when stale) on every get(); git URLs never are."""
+    resolved_source = str(tmp_path) if source == "local_tmp_path" else source
+    with (
+        patch(f"semble.mcp.SembleIndex.{patch_target}", return_value=MagicMock()) as mock_build,
+        patch("semble.mcp.save_index_to_cache"),
+        patch("semble.mcp.get_validated_cache", return_value=None) as mock_validate,
+        # Disable the cooldown: real build duration (here, just thread-dispatch overhead) would
+        # otherwise sometimes exceed the gap between the two get() calls below, flaking the test.
+        patch("semble.mcp._MIN_REVALIDATE_FACTOR", 0),
+    ):
+        await cache.get(resolved_source)
+        await cache.get(resolved_source)
+    assert mock_build.call_count == expected_build_calls
+    assert mock_validate.called is validate_called
+
+
+@pytest.mark.anyio
+async def test_index_cache_skips_staleness_check_during_cooldown(cache: _IndexCache, tmp_path: Path) -> None:
+    """A slow-to-build local path is not revalidated again until its cooldown elapses."""
+    cache_key = str(tmp_path.resolve())
+    cache._tasks[cache_key] = asyncio.create_task(_succeed())
+    await asyncio.sleep(0)  # let the task finish
+    cache._revalidate_after[cache_key] = time.monotonic() + 30.0  # a build that took 10s, just finished
+    with patch("semble.mcp.get_validated_cache") as mock_validate:
+        await cache._evict_if_stale(str(tmp_path), cache_key)
+    mock_validate.assert_not_called()
+
+
+async def _succeed() -> MagicMock:
+    return MagicMock()
+
+
+@pytest.mark.anyio
+async def test_index_cache_skips_staleness_check_for_failed_task(cache: _IndexCache, tmp_path: Path) -> None:
+    """A cached entry that finished with an exception is not revalidated; it is left for the normal retry path."""
+
+    async def _raise() -> MagicMock:
+        raise RuntimeError("boom")
+
+    cache._tasks[str(tmp_path.resolve())] = asyncio.create_task(_raise())
+    await asyncio.sleep(0)  # let the task finish
+    with patch("semble.mcp.get_validated_cache") as mock_validate:
+        await cache._evict_if_stale(str(tmp_path), str(tmp_path.resolve()))
+    mock_validate.assert_not_called()
+
+
+@pytest.mark.anyio
+async def test_index_cache_does_not_evict_entry_replaced_during_validation(cache: _IndexCache, tmp_path: Path) -> None:
+    """If a concurrent caller already replaced a stale entry, _evict_if_stale must not evict the new one."""
+    cache_key = str(tmp_path.resolve())
+    cache._tasks[cache_key] = asyncio.create_task(_succeed())
+    await asyncio.sleep(0)
+    cache._revalidate_after[cache_key] = 0.0  # cooldown already elapsed
+
+    replacement_task = object()
+
+    def _replace_entry_then_report_stale(*args: object, **kwargs: object) -> None:
+        # Simulate a concurrent get() winning the race and installing a fresh task first.
+        cache._tasks[cache_key] = replacement_task  # type: ignore[assignment]
+        return None
+
+    with patch("semble.mcp.get_validated_cache", side_effect=_replace_entry_then_report_stale):
+        await cache._evict_if_stale(str(tmp_path), cache_key)
+    assert cache._tasks.get(cache_key) is replacement_task
+
+
 @pytest.mark.anyio
 async def test_index_cache_evicts_on_failure(cache: _IndexCache, tmp_path: Path) -> None:
     """A failed build evicts the entry so the next call can retry."""
```

**File**: `uv.lock` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ resolution-markers = [
 
 [options]
 exclude-newer = "0001-01-01T00:00:00Z" # This has no effect and is included for backwards compatibility when using relative exclude-newer values.
-exclude-newer-span = "P3D"
+exclude-newer-span = "P1W"
 
 [[package]]
 name = "annotated-doc"
```

---

### Incident Patch 14: `30d36ad1` (2026-06-20)
**Commit Message**: fix: Ensure savings are correct when max_snippet_lines is used (#206)

**File**: `src/semble/cli.py` (modified, +2/-2)
```diff
@@ -115,7 +115,7 @@ def _load_index(path: str, content: list[ContentType]) -> SembleIndex:
 def _run_search(path: str, query: str, top_k: int, content: list[ContentType], max_snippet_lines: int | None) -> None:
     """Handle the `search` subcommand."""
     index = _load_index(path, content)
-    results = index.search(query, top_k=top_k)
+    results = index.search(query, top_k=top_k, max_snippet_lines=max_snippet_lines)
     out = format_results(query, results, max_snippet_lines) if results else {"error": "No results found."}
     print(json.dumps(out))
     _maybe_save_index(index, path)
@@ -130,7 +130,7 @@ def _run_find_related(
     if chunk is None:
         print(f"No chunk found at {file_path}:{line}.", file=sys.stderr)
         sys.exit(1)
-    results = index.find_related(chunk, top_k=top_k)
+    results = index.find_related(chunk, top_k=top_k, max_snippet_lines=max_snippet_lines)
     label = f"Chunks related to {file_path}:{line}"
     out = (
         format_results(label, results, max_snippet_lines)
```

**File**: `src/semble/index/index.py` (modified, +8/-3)
```diff
@@ -224,18 +224,21 @@ def from_git(
                 content=normalized,
             )
 
-    def find_related(self, source: Chunk | SearchResult, *, top_k: int = 5) -> list[SearchResult]:
+    def find_related(
+        self, source: Chunk | SearchResult, *, top_k: int = 5, max_snippet_lines: int | None = None
+    ) -> list[SearchResult]:
         """Return chunks semantically similar to the given chunk or search result.
 
         :param source: A SearchResult or Chunk to use as the seed.
         :param top_k: Number of similar chunks to return.
+        :param max_snippet_lines: Lines of content to count for savings stats. None = full chunk.
         :return: Ranked list of SearchResult objects, most similar first.
         """
         target = source.chunk if isinstance(source, SearchResult) else source
         selector = self._get_selector_vector(filter_languages=[target.language]) if target.language else None
         results = _search_semantic(target.content, self.model, self._semantic_index, self.chunks, top_k + 1, selector)
         results = [r for r in results if r.chunk != target][:top_k]
-        save_search_stats(results, CallType.FIND_RELATED, self._file_sizes)
+        save_search_stats(results, CallType.FIND_RELATED, self._file_sizes, max_snippet_lines)
         return results
 
     def _get_selector_vector(
@@ -258,6 +261,7 @@ def search(
         filter_languages: list[str] | None = None,
         filter_paths: list[str] | None = None,
         rerank: bool | None = None,
+        max_snippet_lines: int | None = None,
     ) -> list[SearchResult]:
         """Search the index and return the top-k most relevant chunks.
 
@@ -271,6 +275,7 @@ def search(
             chunks from these files are returned.
         :param rerank: Apply code-tuned reranking (file boost, identifier boost, path penalties).
             Defaults to True when ContentType.CODE was indexed.
+        :param max_snippet_lines: Lines of content to count for savings stats. None = full chunk.
         :return: Ranked list of SearchResult objects, best match first.
         """
         if not self.chunks or not query.strip():
@@ -290,7 +295,7 @@ def search(
             selector=selector,
             rerank=resolved_rerank,
         )
-        save_search_stats(results, CallType.SEARCH, self._file_sizes)
+        save_search_stats(results, CallType.SEARCH, self._file_sizes, max_snippet_lines)
         return results
 
     @classmethod
```

**File**: `src/semble/mcp.py` (modified, +5/-3)
```diff
@@ -78,6 +78,7 @@ async def search(
                     "If the snippet does not contain enough context to confirm you have the right location, "
                     "call again with max_snippet_lines=None."
                 ),
+                ge=0,
             ),
         ] = 10,
     ) -> str:
@@ -91,7 +92,7 @@ async def search(
             index = await _get_index(repo, default_source, cache)
         except ValueError as exc:
             return str(exc)
-        results = index.search(query, top_k=top_k)
+        results = index.search(query, top_k=top_k, max_snippet_lines=max_snippet_lines)
         if not results:
             return json.dumps({"error": "No results found."})
         return json.dumps(format_results(query, results, max_snippet_lines))
@@ -111,7 +112,8 @@ async def find_related(
                 description=(
                     "Lines of source per result. "
                     "Default 10 = signature + first body lines. 0 = location only. None = full chunk."
-                )
+                ),
+                ge=0,
             ),
         ] = 10,
     ) -> str:
@@ -131,7 +133,7 @@ async def find_related(
                 f"No chunk found at {file_path}:{line}. "
                 "Make sure the file is indexed and the line number is within a known chunk."
             )
-        results = index.find_related(chunk, top_k=top_k)
+        results = index.find_related(chunk, top_k=top_k, max_snippet_lines=max_snippet_lines)
         if not results:
             return json.dumps({"error": f"No related chunks found for {file_path}:{line}."})
         label = f"Chunks related to {file_path}:{line}"
```

**File**: `src/semble/stats.py` (modified, +9/-1)
```diff
@@ -65,10 +65,18 @@ def save_search_stats(
     results: list[SearchResult],
     call_type: CallType,
     file_sizes: dict[str, int],
+    max_snippet_lines: int | None = None,
 ) -> None:
     """Save stats about a search or find_related call to the stats file."""
     try:
-        snippet_chars = sum(len(result.chunk.content) for result in results)
+        snippet_chars = sum(
+            len("\n".join(result.chunk.content.splitlines()[:max_snippet_lines]))
+            if max_snippet_lines and max_snippet_lines > 0
+            else 0
+            if max_snippet_lines == 0
+            else len(result.chunk.content)
+            for result in results
+        )
         file_chars = sum(
             file_sizes[path] for path in {result.chunk.file_path for result in results} if path in file_sizes
         )
```

---

### Incident Patch 15: `e3f986b6` (2026-06-12)
**Commit Message**: fix: Prevent concurrent write corruption in savings.jsonl (#195)

**File**: `src/semble/stats.py` (modified, +20/-0)
```diff
@@ -3,7 +3,10 @@
 from collections import defaultdict
 from dataclasses import dataclass
 from datetime import datetime, timedelta, timezone
+from functools import cache
+from importlib import import_module
 from pathlib import Path
+from types import ModuleType
 
 from semble.cache import resolve_cache_folder
 from semble.types import CallType, SearchResult
@@ -37,6 +40,15 @@ class SavingsSummary:
     call_type_counts: dict[str, int]
 
 
+@cache
+def _import_fcntl() -> ModuleType | None:
+    """Return fcntl when available, otherwise None."""
+    try:
+        return import_module("fcntl")
+    except ImportError:  # pragma: no cover
+        return None
+
+
 def save_search_stats(
     results: list[SearchResult],
     call_type: CallType,
@@ -59,6 +71,14 @@ def save_search_stats(
         stats_file = _get_stats_file()
         stats_file.parent.mkdir(parents=True, exist_ok=True)
         with stats_file.open("a") as f:
+            fcntl = _import_fcntl()
+            try:
+                if fcntl is not None:
+                    fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
+            except BlockingIOError:  # pragma: no cover
+                return  # another process holds the lock; skip this record
+            except OSError:  # pragma: no cover
+                return  # lock contention or unsupported filesystem; skip
             f.write(json.dumps(record) + "\n")
     except OSError:
         pass
```

**File**: `uv.lock` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ resolution-markers = [
 
 [options]
 exclude-newer = "0001-01-01T00:00:00Z" # This has no effect and is included for backwards compatibility when using relative exclude-newer values.
-exclude-newer-span = "P3D"
+exclude-newer-span = "P1W"
 
 [[package]]
 name = "annotated-doc"
```

#### Recent Merged Pull Requests:
- **PR #283** (closed): perf(index): group multi-extension languages in the file-type table (@bis3946)
- **PR #282** (2026-10-05): fix: Exit the MCP server immediately on stdin EOF or SIGTERM (@Pringled)
- **PR #281** (2026-10-05): fix: Use manifest mtimes for cache validation (@Pringled)
- **PR #278** (closed): perf: Embed token vectors in float32 (@BGR360)
- **PR #276** (2026-09-30): chore: Pin release workflow actions to commit SHAs (@Pringled)
- **PR #275** (2026-09-25): feat: Add Grok Build, Qwen Code, Cline, and Kilo Code installer support (@Pringled)
- **PR #273** (2026-09-25): feat: Add idle TTL for MCP in-memory index cache (@Pringled)
- **PR #272** (2026-09-25): chore: Remove dead code and deduplicate internals (@Pringled)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
