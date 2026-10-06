# Forensic Learning Record (Deep Inspection): zilliztech/memsearch

> **Canonical Artifact**: `07_PROJECT_LEARNING/zilliztech-memsearch-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zilliztech/memsearch](https://github.com/zilliztech/memsearch))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:17:46.733Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zilliztech/memsearch`
- **Description**: A persistent, unified memory layer for all your AI agents (e.g. Claude Code, Codex, DSH), backed by Markdown and Milvus.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 2720 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/memsearch/core.py`
```
"""MemSearch — main orchestrator class."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable, Iterator
from datetime import date
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .watcher import FileWatcher

from .chunker import Chunk, chunk_markdown, clean_content_for_embedding, compute_chunk_id
from .compact import compact_chunks
from .embeddings import EmbeddingProvider, get_provider
from .index_report import IndexFailure, IndexReport, format_error
from .io import read_utf8_text_replace
from .scanner import ScannedFile, scan_paths, should_index_path
from .store import MilvusStore

logger = logging.getLogger(__name__)


class MemSearch:
    """High-level API for semantic memory search.

    Parameters
    ----------
    paths:
        Directories / files to index.
    embedding_provider:
        Name of the embedding backend (``"openai"``, ``"google"``, etc.).
    embedding_model:
        Override the default model for the chosen provider.
    milvus_uri:
        Milvus connection URI.  A local ``*.db`` path uses Milvus Lite,
        ``http://host:port`` connects to a Milvus server, and a
        ``https://*.zillizcloud.com`` URL connects to Zilliz Cloud.
    milvus_token:
        Authentication token for Milvus server or Zilliz Cloud.
        Not needed for Milvus Lite (local).
    collection:
        Milvus collection name.  Use different names to isolate
        agents sharing the same Milvus server.
    description:
        Best-effort collection metadata written during creation. Some backends
        may not return it; indexing and search do not depend on it.
    ignore_files:
        Ignore filenames to discover within each directory index root, such
        as ``[".gitignore"]``. Empty by default for backward compatibility.
    exclude:
        Additional gitignore-style patterns applied relative to each index
        root after discovered ignore-file rules.
    """

    def __init__(
        self,
        paths: list[str | Path] | None = None,
        *,
        embedding_provider: str = "openai",
        embedding_model: str | None = None,
        embedding_batch_size: int = 0,
        embedding_base_url: str | None = None,
        embedding_api_key: str | None = None,
        milvus_uri: str = "~/.memsearch/milvus.db",
        milvus_token: str | None = None,
        collection: str = "memsearch_chunks",
        description: str = "",
        max_chunk_size: int = 1500,
        overlap_lines: int = 2,
        ignore_files: list[str] | None = None,
        exclude: list[str] | None = None,
        reranker_model: str = "",
    ) -> None:
        self._paths = [str(p) for p in (paths or [])]
        self._max_chunk_size = max_chunk_size
        self._overlap_lines = overlap_lines
        self._ignore_files = list(ignore_files or [])
        self._exclude = list(exclude or [])
        self._embedder: EmbeddingProvider = get_provider(
            embedding_provider,
            model=embedding_model,
            batch_size=embedding_batch_size,
            base_url=embedding_base_url,
            api_key=embedding_api_key,
        )
        self._store = MilvusStore(
            uri=milvus_uri,
            token=milvus_token,
            collection=collection,
            dimension=self._embedder.dimension,
            description=description,
            _create_if_missing=False,
        )
        self._reranker_model = reranker_model

    # ------------------------------------------------------------------
    # Indexing
    # ------------------------------------------------------------------

    async def index(self, *, force: bool = False) -> int:
        """Scan paths and index all markdown files.

        Returns the number of chunks indexed.  Also removes chunks for
        files that no longer exist on disk (deleted-file cleanup).
        """
        report = await self.index_with_report(force=force)
        return report.indexed_chunks

    async def index_with_report(self, *, force: bool = False) -> IndexReport:
        """Scan paths and index all markdown files with structured status."""
        self._store._ensure_collection_for_write()
        files = scan_paths(
            self._paths,
            ignore_files=self._ignore_files,
            exclude=self._exclude,
        )
        total = 0
        failed_files: list[IndexFailure] = []
        active_sources: set[str] = set()
        for f in files:
            active_sources.add(str(f.path))
            try:
                n = await self._index_file(f, force=force)
                total += n
            except Exception as exc:
                failed_files.append(IndexFailure(path=str(f.path), error=format_error(exc)))
                logger.exception("Failed to index %s, skipping", f.path)

        # Clean up deleted files only inside directory roots from this run.
        # Explicit file paths are partial updates and must not prune unrelated
        # sources from the collection.
        cleanup_roots = _cleanup_roots_for_paths(self._paths)
        if cleanup_roots:
            indexed_sources = self._store.indexed_sources()
            for source in indexed_sources:
                if source not in active_sources and _source_under_any_root(source, cleanup_roots):
                    self._store.delete_by_source(source)
                    logger.info("Removed stale chunks for deleted file: %s", source)

        if failed_files:
            logger.warning(
                "Indexed %d chunks from %d files (%d files failed)",
                total,
                len(files) - len(failed_files),
                len(failed_files),
            )
        else:
            logger.info("Indexed %d chunks from %d files", total, len(files))
        return IndexReport(
            indexed_chunks=total,
            total_files=len(files),
            indexed_files=len(files) - len(failed_files),
            failed_files=tuple(failed_files),
        )

    async def index_file(self, path: str | Path) -> int:
        """Index a single file.  Returns number of chunks."""
        self._store._ensure_collection_for_write()
        p = Path(path).expanduser().resolve()
        _st = p.stat()
        sf = ScannedFile(path=p, mtime=_st.st_mtime, size=_st.st_size)
        return await self._index_file(sf)

    async def _index_file(self, f: ScannedFile, *, force: bool = False) -> int:
        source = str(f.path)
        text = read_utf8_text_replace(f.path)
        chunks = chunk_markdown(
            text,
            source=source,
            max_chunk_size=self._max_chunk_size,
            overlap_lines=self._overlap_lines,
        )
        model = self._embedder.model_name

        # Compute composite chunk IDs (matching OpenClaw format)
        chunk_ids = {compute_chunk_id(c.source, c.start_line, c.end_line, c.content_hash, model) for c in chunks}
        old_ids = self._store.hashes_by_source(source)

        # Delete stale chunks that are no longer in the file
        stale = old_ids - chunk_ids
        if stale:
            self._store.delete_by_hashes(list(stale))

        if not chunks:
            return 0

        if not force:
            # Only embed chunks whose ID doesn't already exist
            chunks = [
                c
                for c in chunks
                if compute_chunk_id(c.source, c.start_line, c.end_line, c.content_hash, model) not in old_ids
            ]
            if not chunks:
                return 0

        return await self._embed_and_store(chunks)

    async def _embed_and_store(self, chunks: list[Chunk]) -> int:
        if not chunks:
            return 0

        model = self._embedder.model_name
        total = 0
        for batch in _chunk_batches(chunks, self._embedder.batch_size):
            # Clean content for embedding: strip HTML comments and metadata noise
            # so the embedding vector captures semantics, not UUIDs/paths.
            # The original content is preserved in the Milvus record below.
            contents = [clean_content_for_embedding(c.content) for c in batch]
            embeddings = await self._embedder.embed(contents)
            total += self._store.upsert(_records_for_chunks(batch, embeddings, model))

        return total

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------

    async def search(
        self,
        query: str,
        *,
        top_k: int = 10,
        source_prefix: str | Path | None = None,
    ) -> list[dict[str, Any]]:
        """Semantic search across indexed chunks.

        Parameters
        ----------
        query:
            Natural-language query.
        top_k:
            Maximum results to return.
        source_prefix:
            Optional path prefix to scope results. Only chunks whose
            ``source`` starts with this prefix are returned.

        Returns
        -------
        list[dict]
            Each dict contains ``content``, ``source``, ``heading``,
            ``score``, and other metadata.
        """
        self._store._require_collection()
        filter_expr = ""
        if source_prefix is not None:
            prefix = str(Path(source_prefix).expanduser().resolve())
            escaped = prefix.replace("\\", "\\\\").replace('"', '\\"')
            filter_expr = f'source like "{escaped}%"'

        embeddings = await self._embedder.embed([query])
        fetch_k = top_k * 3 if self._reranker_model else top_k
        results = self._store.search(embeddings[0], query_text=query, top_k=fetch_k, filter_expr=filter_expr)
        if self._reranker_model and results:
            from .reranker import rerank

            if self._reranker_model.startswith("jev:"):
                results = await asyncio.to_thread(rerank, query, results, model_name=self._reranker_model, top_k=top_k)
            else:
         
```

### Core Architecture Module: `src/memsearch/embeddings/utils.py`
```
"""Shared utilities for embedding providers."""

from __future__ import annotations

from collections.abc import Awaitable, Callable


async def batched_embed(
    texts: list[str],
    embed_fn: Callable[[list[str]], Awaitable[list[list[float]]]],
    batch_size: int,
) -> list[list[float]]:
    """Split *texts* into batches and call *embed_fn* on each.

    Parameters
    ----------
    texts:
        The texts to embed.
    embed_fn:
        An async callable that embeds a single batch of texts.
    batch_size:
        Maximum number of texts per batch.  Must be >= 1.
    """
    if not texts:
        return []
    if batch_size <= 0:
        raise ValueError(f"batch_size must be >= 1, got {batch_size}")
    if len(texts) <= batch_size:
        return await embed_fn(texts)
    results: list[list[float]] = []
    for i in range(0, len(texts), batch_size):
        results.extend(await embed_fn(texts[i : i + batch_size]))
    return results

```

### Core Architecture Module: `src/memsearch/index_state.py`
```
"""Index health state used by CLI and plugin diagnostics."""

from __future__ import annotations

import contextlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .index_report import IndexFailure, IndexReport, format_error

INDEX_STATE_FILENAME = ".index-state.json"
INDEX_STATE_SCHEMA_VERSION = 1


def resolve_index_state_path(
    paths: list[str | Path] | tuple[str | Path, ...],
    *,
    memsearch_dir: str | Path | None = None,
    cwd: str | Path | None = None,
) -> Path | None:
    """Resolve the state file for an index command.

    Plugin calls usually index ``<root>/.memsearch/memory``.  The hook-local
    ``MEMSEARCH_DIR`` shell variable is not always exported to the child CLI, so
    this helper can infer the state root from any path containing ``.memsearch``.
    For arbitrary user paths outside a MemSearch tree, no state file is written.
    """
    explicit_dir = memsearch_dir or os.environ.get("MEMSEARCH_DIR")
    if explicit_dir:
        return Path(explicit_dir).expanduser().resolve() / INDEX_STATE_FILENAME

    base = Path(cwd).expanduser().resolve() if cwd is not None else Path.cwd()
    for raw_path in paths:
        path = Path(raw_path).expanduser()
        if not path.is_absolute():
            path = base / path
        resolved = path.resolve(strict=False)
        parts = resolved.parts
        for idx, part in enumerate(parts):
            if part == ".memsearch":
                return Path(*parts[: idx + 1]) / INDEX_STATE_FILENAME

    return None


def load_index_state(state_path: Path | None) -> dict[str, Any]:
    """Load an index state file, returning an empty dict if unavailable."""
    if state_path is None or not state_path.is_file():
        return {}
    with contextlib.suppress(json.JSONDecodeError, OSError):
        data = json.loads(state_path.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            return data
    return {}


def record_index_started(
    state_path: Path | None,
    *,
    operation: str,
    paths: list[str | Path] | tuple[str | Path, ...],
    collection: str,
    milvus_uri: str,
) -> None:
    """Persist that an indexing operation has started."""
    if state_path is None:
        return

    previous = load_index_state(state_path)
    now = _now()
    state = _base_state(
        status="running",
        operation=operation,
        paths=paths,
        collection=collection,
        milvus_uri=milvus_uri,
        previous=previous,
        now=now,
    )
    state["last_started_at"] = now
    _try_save_index_state(state_path, state)


def record_index_report(
    state_path: Path | None,
    report: IndexReport,
    *,
    operation: str,
    paths: list[str | Path] | tuple[str | Path, ...],
    collection: str,
    milvus_uri: str,
) -> None:
    """Persist a completed indexing report."""
    if state_path is None:
        return

    previous = load_index_state(state_path)
    now = _now()
    state = _base_state(
        status=report.status,
        operation=operation,
        paths=paths,
        collection=collection,
        milvus_uri=milvus_uri,
        previous=previous,
        now=now,
    )
    state.update(
        {
            "last_started_at": previous.get("last_started_at", now),
            "last_completed_at": now,
            "indexed_chunks": report.indexed_chunks,
            "total_files": report.total_files,
            "indexed_files": report.indexed_files,
            "failed_files": [failure.to_dict() for failure in report.failed_files],
        }
    )

    if report.status == "ok":
        state["last_success_at"] = now
    else:
        state["last_failed_at"] = now
        state["last_error"] = f"{len(report.failed_files)} file(s) failed during indexing."

    _try_save_index_state(state_path, state)


def record_index_error(
    state_path: Path | None,
    error: BaseException,
    *,
    operation: str,
    paths: list[str | Path] | tuple[str | Path, ...],
    collection: str,
    milvus_uri: str,
    status: str = "error",
    failed_files: list[IndexFailure] | tuple[IndexFailure, ...] = (),
) -> None:
    """Persist a failed indexing operation."""
    if state_path is None:
        return

    previous = load_index_state(state_path)
    now = _now()
    state = _base_state(
        status=status,
        operation=operation,
        paths=paths,
        collection=collection,
        milvus_uri=milvus_uri,
        previous=previous,
        now=now,
    )
    state.update(
        {
            "last_started_at": previous.get("last_started_at", now),
            "last_completed_at": now,
            "last_failed_at": now,
            "last_error": format_error(error),
            "failed_files": [failure.to_dict() for failure in failed_files],
        }
    )
    _try_save_index_state(state_path, state)


def _base_state(
    *,
    status: str,
    operation: str,
    paths: list[str | Path] | tuple[str | Path, ...],
    collection: str,
    milvus_uri: str,
    previous: dict[str, Any],
    now: str,
) -> dict[str, Any]:
    state: dict[str, Any] = {
        "schema_version": INDEX_STATE_SCHEMA_VERSION,
        "status": status,
        "operation": operation,
        "updated_at": now,
        "paths": [str(path) for path in paths],
        "collection": collection,
        "milvus_uri": milvus_uri,
    }
    if previous.get("last_success_at"):
        state["last_success_at"] = previous["last_success_at"]
    return state


def _save_index_state(state_path: Path, state: dict[str, Any]) -> None:
    state_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = state_path.with_name(f"{state_path.name}.{os.getpid()}.tmp")
    try:
        tmp_path.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        tmp_path.replace(state_path)
    finally:
        with contextlib.suppress(OSError):
            tmp_path.unlink()


def _try_save_index_state(state_path: Path, state: dict[str, Any]) -> None:
    with contextlib.suppress(OSError):
        _save_index_state(state_path, state)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

```

### Core Architecture Module: `evaluation/plot_reranking_comparison.py`
```
# /// script
# requires-python = ">=3.10"
# dependencies = ["matplotlib>=3.9"]
# ///
"""Visualize the completed MemSearch reranking evaluation from recorded aggregates."""

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT.parent / "docs/assets/evaluation"
OUTPUT.mkdir(parents=True, exist_ok=True)
report = json.loads((ROOT / "reranking-results.json").read_text())
metrics = {(r["language"], r["query_type"], r["method"]): r for r in report["metrics"]}
usage = {(r["provider"], r["language"]): r for r in report["usage"]}
methods = ["baseline", "jev", "voyage"]
colors = {"baseline": "#8997aa", "jev": "#008775", "voyage": "#5753ac"}
labels = {
    "baseline": "Original BGE-M3 order",
    "jev": "Jev 1.13.0",
    "voyage": "Voyage rerank-3",
}
bg, ink, muted = "#fbfcfe", "#192b40", "#64768a"
plt.rcParams.update(
    {
        "font.family": "DejaVu Sans",
        "font.size": 11,
        "svg.fonttype": "none",
        "svg.hashsalt": "memsearch-reranking",
    }
)
fig = plt.figure(figsize=(14, 10.5), facecolor=bg)
grid = fig.add_gridspec(
    2, 2, left=0.205, right=0.96, top=0.73, bottom=0.16, hspace=0.92, wspace=0.28
)
axes = [fig.add_subplot(grid[r, c]) for r in range(2) for c in range(2)]


def base(ax, title, subtitle):
    ax.set_facecolor(bg)
    ax.set_title(title, loc="left", fontsize=16, fontweight="bold", color=ink, pad=32)
    ax.text(0, 1.065, subtitle, transform=ax.transAxes, fontsize=10, color=muted)
    ax.xaxis.grid(True, color="#e4e9ef", linewidth=0.8)
    ax.set_axisbelow(True)
    ax.tick_params(axis="both", length=0, labelcolor=muted, pad=8)
    for spine in ax.spines.values():
        spine.set_visible(False)


for c, (field, title, subtitle) in enumerate(
    [
        ("recall_at_5", "Evidence in the top 5", "Recall@5 · higher is better"),
        ("mrr_at_10", "First relevant result", "MRR@10 · higher is better"),
        ("ndcg_at_10", "Overall ranking quality", "NDCG@10 · higher is better"),
    ]
):
    ax = axes[c]
    base(ax, title, subtitle)
    ax.set_xlim(0, 1)
    ax.set_xticks([0, 0.25, 0.5, 0.75, 1], ["0", ".25", ".50", ".75", "1.0"])
    ax.set_ylim(2.6, -0.6)
    for i, method in enumerate(methods):
        value = metrics[("all", "all", method)][field]
        ax.barh(i, value, height=0.38, color=colors[method], alpha=0.88)
        ax.text(
            value + 0.025,
            i,
            f"{value:.4f}",
            va="center",
            color=colors[method],
            fontsize=12,
            fontweight="bold",
        )
    ax.set_yticks(
        range(3), [labels[m] for m in methods] if c in (0, 2) else ["", "", ""]
    )
    ax.tick_params(axis="y", labelcolor=ink, labelsize=11)

ax = axes[3]
base(ax, "Estimated API cost", "USD / 1,000 queries · lower is better")
ax.set_xlim(0, 0.225)
ax.set_xticks([0, 0.05, 0.10, 0.15, 0.20], ["$0", ".05", ".10", ".15", ".20"])
ax.set_ylim(1.55, -0.6)
ax.set_yticks([0, 1], ["Jev", "Voyage"])
for i, method in enumerate(["jev", "voyage"]):
    rows = [usage[(method, lang)] for lang in ["zh", "en"]]
    cost = (
        sum(r["estimated_cost_usd"] for r in rows)
        / sum(r["requests"] for r in rows)
        * 1000
    )
    ax.barh(i, cost, height=0.36, color=colors[method], alpha=0.88)
    ax.text(
        cost + 0.007,
        i,
        f"${cost:.3f}",
        color=colors[method],
        va="center",
        fontweight="bold",
        fontsize=12,
    )

fig.text(
    0.045,
    0.942,
    "MemSearch Reranking Comparison",
    fontsize=27,
    fontweight="bold",
    color=ink,
)
fig.text(
    0.045,
    0.895,
    "Jev improves the original order; Voyage leads on ranking quality in this evaluation.",
    fontsize=12,
    color=muted,
)
fig.legend(
    handles=[Line2D([0], [0], color=colors[m], lw=7, label=labels[m]) for m in methods],
    loc="upper left",
    bbox_to_anchor=(0.04, 0.86),
    ncol=3,
    frameon=False,
    fontsize=12,
    columnspacing=3,
)
fig.text(
    0.045,
    0.080,
    "2,172 questions in Chinese and English translation · same 10 candidates per question · no input truncation",
    fontsize=11,
    color=muted,
)
fig.text(
    0.045,
    0.047,
    "Costs cover reranking API calls only, using recorded tokens and evaluation-time list prices; account credits are excluded.",
    fontsize=10,
    color=muted,
)
for ext in ["png", "svg"]:
    path = OUTPUT / f"memsearch-reranking-comparison.{ext}"
    fig.savefig(
        path, dpi=220, facecolor=bg, metadata={"Date": None} if ext == "svg" else None
    )
print(OUTPUT / "memsearch-reranking-comparison.png")

svg = OUTPUT / "memsearch-reranking-comparison.svg"
svg.write_text("\n".join(line.rstrip() for line in svg.read_text().splitlines()) + "\n")

```

### Core Architecture Module: `evaluation/rerank_evaluate.py`
```
"""Evaluate frozen retrieval candidates with Jev or Voyage; never regenerate embeddings."""

# ruff: noqa: T201

from __future__ import annotations

import argparse
import csv
import hashlib
import http.client
import json
import math
import os
import statistics
import tempfile
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from memsearch.jev_reranker import JevReranker


def metrics(ids: list[str], positives: list[str]) -> dict[str, float]:
    gold = set(positives)
    if not gold or len(ids) != len(set(ids)):
        raise ValueError("Metrics require nonempty gold labels and unique candidate IDs")
    hits = [int(cid in gold) for cid in ids[:10]]
    ideal = sum(1 / math.log2(i + 2) for i in range(min(10, len(gold))))
    return {
        "hit_at_1": float(any(hits[:1])),
        "hit_at_5": float(any(hits[:5])),
        "hit_at_10": float(any(hits)),
        "recall_at_1": sum(hits[:1]) / len(gold),
        "recall_at_5": sum(hits[:5]) / len(gold),
        "recall_at_10": sum(hits) / len(gold),
        "mrr_at_10": next((1 / (i + 1) for i, hit in enumerate(hits) if hit), 0.0),
        "ndcg_at_10": sum(hit / math.log2(i + 2) for i, hit in enumerate(hits)) / ideal,
    }


def read_jsonl(path: Path, key: str) -> dict[str, Any]:
    rows = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    indexed = {row[key]: row for row in rows}
    if len(indexed) != len(rows):
        raise ValueError(f"Duplicate {key} in {path.name}")
    return indexed


def voyage_request(payload: dict[str, Any]) -> dict[str, Any]:
    key = os.environ.get("VOYAGE_API_KEY")
    if not key:
        raise ValueError("Set VOYAGE_API_KEY")
    request = urllib.request.Request(
        "https://api.voyageai.com/v1/rerank",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Voyage reranking failed (HTTP {exc.code})") from None
    except (urllib.error.URLError, http.client.HTTPException, TimeoutError):
        raise RuntimeError("Voyage reranking request failed or timed out") from None


def validate_voyage(response: dict[str, Any], count: int) -> list[int]:
    indexes = [item["index"] for item in response["data"]]
    if len(indexes) != count or set(indexes) != set(range(count)):
        raise ValueError("Voyage returned missing or duplicate candidate indices")
    return indexes


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, required=True)
    parser.add_argument("--candidates", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--reuse-cache", type=Path, action="append", default=[])
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    if not 1 <= args.workers <= 12:
        parser.error("workers must be between 1 and 12")
    # Keep the published experiment reproducible when the runtime default advances.
    jev = JevReranker(model="jev-1.13.0")
    candidates_rows = json.loads(args.candidates.read_text())
    candidates = {r["query_id"]: r["retrieved_ids"] for r in candidates_rows}
    if len(candidates) != len(candidates_rows):
        raise ValueError("Duplicate candidate query IDs")
    datasets = {}
    tasks = []
    sources = {str(args.candidates.name): hashlib.sha256(args.candidates.read_bytes()).hexdigest()}
    for lang in ("zh", "en"):
        corpus = read_jsonl(args.data_dir / f"corpus_{lang}.jsonl", "chunk_id")
        queries = read_jsonl(args.data_dir / f"queries_{lang}.jsonl", "query_id")
        if set(candidates) != set(queries):
            raise ValueError("Candidate coverage must exactly match the query set")
        for filename in (f"corpus_{lang}.jsonl", f"queries_{lang}.jsonl"):
            sources[filename] = hashlib.sha256((args.data_dir / filename).read_bytes()).hexdigest()
        datasets[lang] = (corpus, queries)
        for qid, query in sorted(queries.items()):
            ids = candidates[qid]
            if len(ids) != 10 or len(set(ids)) != 10:
                raise ValueError("This evaluation expects exactly ten unique candidates per query")
            if not query["positive_chunk_ids"] or not set(query["positive_chunk_ids"]) <= corpus.keys():
                raise ValueError("Missing positive references")
            documents = [corpus[cid]["content"] for cid in ids]
            for provider in ("jev", "voyage"):
                payload = (
                    jev.build_request(query["query"], documents)
                    if provider == "jev"
                    else {
                        "model": "rerank-3",
                        "query": query["query"],
                        "documents": documents,
                        "top_k": len(documents),
                        "truncation": False,
                    }
                )
                tasks.append((provider, lang, qid, payload))
    for qid in candidates:
        if datasets["zh"][1][qid]["positive_chunk_ids"] != datasets["en"][1][qid]["positive_chunk_ids"]:
            raise ValueError("Translated queries must preserve positive references")
    estimate = sum(
        (len(json.dumps(p, ensure_ascii=False).encode()) + 1024) * (0.042 if provider == "jev" else 0.05) / 1e6
        for provider, _, _, p in tasks
    )
    print(json.dumps({"requests": len(tasks), "conservative_byte_based_cost_estimate_usd": estimate}), flush=True)
    if args.preflight:
        return
    args.output.mkdir(parents=True, exist_ok=True)
    cache = args.output / "cache"
    cache.mkdir(exist_ok=True)
    manifest = {
        "input_sha256": sources,
        "models": [jev.model, "rerank-3"],
        "languages": ["zh", "en"],
        "query_count_per_language": len(candidates),
        "workers": args.workers,
        "candidate_policy": "Frozen Chinese BGE-M3 top-10 IDs and order, with corresponding English translations.",
        "prompt": jev.build_request("QUERY", ["CANDIDATE"]),
    }
    manifest_path = args.output / "manifest.json"
    if manifest_path.exists() and json.loads(manifest_path.read_text()) != manifest:
        raise ValueError("Output directory contains a different evaluation manifest")
    manifest_path.write_text(json.dumps(manifest, indent=2))

    def evaluate(task):
        provider, lang, qid, payload = task
        digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
        filename = f"{provider}-{digest}.json"
        for location in [cache, *args.reuse_cache]:
            file = location / filename
            if file.exists():
                result = json.loads(file.read_text())
                break
        else:
            start = time.perf_counter()
            for attempt in range(3):
                try:
                    if provider == "jev":
                        query = datasets[lang][1][qid]["query"]
                        docs = [datasets[lang][0][cid]["content"] for cid in candidates[qid]]
                        raw = jev.evaluate(query, docs)
                    else:
                        raw = voyage_request(payload)
                    break
                except RuntimeError as exc:
                    transient = any(code in str(exc) for code in ("429", "500", "502", "503", "504"))
                    if not transient or attempt == 2:
                        raise
                    time.sleep(2 ** (attempt + 1))
            result = {"response": raw, "latency_s": time.perf_counter() - start, "attempts": attempt + 1}
        raw = result["response"]
        if provider == "jev":
            if raw.get("model") != jev.model:
                raise ValueError("Unexpected Jev model version")
            jev.scores(raw, 10)
        else:
            validate_voyage(raw, 10)
        target = cache / filename
        if not target.exists():
            with tempfile.NamedTemporaryFile(mode="w", dir=cache, suffix=".tmp", delete=False) as file:
                file.write(json.dumps(result, indent=2))
                temporary = Path(file.name)
            temporary.replace(target)
        return (provider, lang, qid), result

    responses = {}
    failures = []
    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(evaluate, task): task[:3] for task in tasks}
        for n, future in enumerate(as_completed(futures), 1):
            try:
                key, result = future.result()
                responses[key] = result
            except Exception as exc:
                failures.append({"task": futures[future], "error_type": type(exc).__name__})
            if n % 200 == 0:
                print(
                    json.dumps(
                        {"completed": n, "failed": len(failures), "elapsed_s": round(time.perf_counter() - started, 1)}
                    ),
                    flush=True,
                )
    (args.output / "failures.json").write_text(json.dumps(failures, indent=2))
    if failures:
        raise SystemExit(f"{len(failures)} requests failed; rerun to resume from the cache. No aggregate published.")
    details = []
    for lang, (_, queries) in datasets.items():
        for qid, query in sorted(queries.items()):
            ids = candidates[qid]
            gold = query["positive_chunk_ids"]
            scores = jev.scores(responses[("jev", lang, qid)]["response"], 10)
            jev_ids = [ids[i] for i in sorted(range(10), key=lambda i: -scores[i])]
            voyage_ids = [ids[i] for i in validate_voya
```

### Core Architecture Module: `plugins/_shared/scripts/maintenance-runner.py`
```
#!/usr/bin/env python3
"""Plugin-local runner for MemSearch maintenance tasks.

This script belongs to the plugin layer. It handles host-native agent
invocations, while the Python package provides shared config, due-state,
prompt, and API-provider logic.
"""

from __future__ import annotations

import argparse
import contextlib
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

DEFAULT_NATIVE_MODELS = {
    "claude-code": "sonnet",
    "codex": "",
    "opencode": "",
    "openclaw": "",
    "dsh": "",  # dsh-headless uses the user's agent-default-model from settings.yaml
}


def _strip_jsonc(text: str) -> str:
    """Remove JSONC comments and trailing commas while preserving string contents."""
    out: list[str] = []
    i = 0
    in_string = False
    string_quote = ""
    escaped = False
    while i < len(text):
        char = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""
        if in_string:
            out.append(char)
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == string_quote:
                in_string = False
            i += 1
            continue
        if char in {'"', "'"}:
            in_string = True
            string_quote = char
            out.append(char)
            i += 1
            continue
        if char == "/" and nxt == "/":
            i += 2
            while i < len(text) and text[i] not in "\r\n":
                i += 1
            continue
        if char == "/" and nxt == "*":
            i += 2
            while i + 1 < len(text) and not (text[i] == "*" and text[i + 1] == "/"):
                i += 1
            i += 2
            continue
        out.append(char)
        i += 1

    without_comments = "".join(out)
    out = []
    i = 0
    in_string = False
    string_quote = ""
    escaped = False
    while i < len(without_comments):
        char = without_comments[i]
        if in_string:
            out.append(char)
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == string_quote:
                in_string = False
            i += 1
            continue
        if char in {'"', "'"}:
            in_string = True
            string_quote = char
            out.append(char)
            i += 1
            continue
        if char == ",":
            j = i + 1
            while j < len(without_comments) and without_comments[j].isspace():
                j += 1
            if j < len(without_comments) and without_comments[j] in "]}":
                i += 1
                continue
        out.append(char)
        i += 1
    return "".join(out)


def _read_jsonc_config_from_text(text: str) -> dict:
    try:
        data = json.loads(_strip_jsonc(text))
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def _read_jsonc_config(path: Path) -> dict:
    try:
        return _read_jsonc_config_from_text(path.read_text(encoding="utf-8"))
    except OSError:
        return {}


def _deep_merge_config(base: dict, override: dict) -> dict:
    result = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = _deep_merge_config(result[key], value)
        else:
            result[key] = value
    return result


def _rewrite_relative_file_refs(value, config_dir: Path):
    if isinstance(value, dict):
        return {key: _rewrite_relative_file_refs(item, config_dir) for key, item in value.items()}
    if isinstance(value, list):
        return [_rewrite_relative_file_refs(item, config_dir) for item in value]
    if not isinstance(value, str):
        return value

    def replace(match: re.Match[str]) -> str:
        file_ref = match.group(1)
        if file_ref.startswith("~/") or os.path.isabs(file_ref):
            return match.group(0)
        return "{file:" + str((config_dir / file_ref).resolve()) + "}"

    return re.sub(r"\{file:([^}]+)\}", replace, value)


def _load_opencode_config_file(path: Path) -> dict:
    cfg = _read_jsonc_config(path)
    if not cfg:
        return {}
    return _rewrite_relative_file_refs(cfg, path.parent)


def _opencode_global_config_dir() -> Path:
    xdg_config = os.environ.get("XDG_CONFIG_HOME")
    if xdg_config:
        return Path(xdg_config).expanduser() / "opencode"
    return Path.home() / ".config" / "opencode"


def _env_flag_enabled(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes"}


def _opencode_project_config_files(project_dir: Path) -> list[Path]:
    found: list[Path] = []
    current = project_dir.resolve()
    while True:
        for filename in ("opencode.jsonc", "opencode.json"):
            candidate = current / filename
            if candidate.is_file():
                found.append(candidate)
        parent = current.parent
        if parent == current:
            break
        current = parent
    return list(reversed(found))


def _opencode_directory_config_files(project_dir: Path) -> list[Path]:
    dirs: list[Path] = []
    if not _env_flag_enabled("OPENCODE_DISABLE_PROJECT_CONFIG"):
        current = project_dir.resolve()
        while True:
            local = current / ".opencode"
            if local.is_dir() and local not in dirs:
                dirs.append(local)
            parent = current.parent
            if parent == current:
                break
            current = parent

    home_local = Path.home() / ".opencode"
    if home_local.is_dir() and home_local not in dirs:
        dirs.append(home_local)

    env_dir = os.environ.get("OPENCODE_CONFIG_DIR", "").strip()
    if env_dir:
        config_dir = Path(env_dir).expanduser()
        if config_dir not in dirs:
            dirs.append(config_dir)

    files: list[Path] = []
    for directory in dirs:
        for filename in ("opencode.json", "opencode.jsonc"):
            candidate = directory / filename
            if candidate.is_file():
                files.append(candidate)
    return files


def _iter_opencode_config_files(project_dir: str | os.PathLike[str] | None = None) -> list[Path]:
    project = Path(project_dir or os.getcwd()).expanduser().resolve()
    files: list[Path] = []

    global_dir = _opencode_global_config_dir()
    for filename in ("config.json", "opencode.json", "opencode.jsonc"):
        candidate = global_dir / filename
        if candidate.is_file():
            files.append(candidate)

    env_config = os.environ.get("OPENCODE_CONFIG", "").strip()
    if env_config:
        candidate = Path(env_config).expanduser()
        if candidate.is_file():
            files.append(candidate)

    if not _env_flag_enabled("OPENCODE_DISABLE_PROJECT_CONFIG"):
        files.extend(_opencode_project_config_files(project))

    files.extend(_opencode_directory_config_files(project))
    return files


def load_opencode_config(project_dir: str | os.PathLike[str] | None = None) -> dict:
    """Load local OpenCode config sources in OpenCode-compatible precedence order."""
    merged: dict = {}
    for path in _iter_opencode_config_files(project_dir):
        merged = _deep_merge_config(merged, _load_opencode_config_file(path))

    content = os.environ.get("OPENCODE_CONFIG_CONTENT")
    if content:
        content_dir = Path(project_dir or os.getcwd()).expanduser().resolve()
        cfg = _rewrite_relative_file_refs(_read_jsonc_config_from_text(content), content_dir)
        merged = _deep_merge_config(merged, cfg)
    return merged


def _sanitize_opencode_config(cfg: dict) -> dict:
    sanitized = dict(cfg)
    for key in ("plugin", "plugins", "plugin_origins"):
        sanitized.pop(key, None)
    return sanitized


def run_command(cmd: list[str], *, env: dict[str, str], cwd: Path, timeout: int) -> str:
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        env=env,
        cwd=str(cwd),
        timeout=timeout,
        check=False,
    )
    stdout = (result.stdout or "").strip()
    stderr = (result.stderr or "").strip()
    if result.returncode != 0:
        detail = "\n".join(part for part in (stdout, stderr) if part)
        if len(detail) > 2000:
            detail = detail[:1975] + "... [truncated]"
        command = " ".join(shlex.quote(_describe_arg(part)) for part in cmd)
        if len(command) > 300:
            command = command[:275] + "... [truncated]"
        message = f"Command failed ({result.returncode}): {command}"
        if detail:
            message = f"{message}\n{detail}"
        raise RuntimeError(message)
    return stdout or stderr


def _describe_arg(arg: str, limit: int = 120) -> str:
    if len(arg) <= limit:
        return arg
    return f"<arg:{len(arg)} chars>"


_CLAUDE_SAFE_MODE_ARGS: list[str] | None = None


def claude_safe_mode_args() -> list[str]:
    """Return Claude args that suppress hooks when supported."""
    global _CLAUDE_SAFE_MODE_ARGS
    if _CLAUDE_SAFE_MODE_ARGS is not None:
        return _CLAUDE_SAFE_MODE_ARGS
    try:
        result = subprocess.run(
            ["claude", "--help"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        _CLAUDE_SAFE_MODE_ARGS = []
    else:
        help_text = f"{result.stdout}\n{result.stderr}"
        _CLAUDE_SAFE_MODE_ARGS = ["--safe-mode"] if "--safe-mode" in help_text else []
    return _CLAUDE_SAFE_MODE_ARGS


def extract_task_json_output(output: str) -> str:
    """Extract the first maintenance JSON object from noisy host output."""
    for line in output.splitlines():
        candidate = line.strip()
        if not candidate.startswith("{"):
            continue
        try:
            parsed = json.loads(candidate)
        excep
```

### Core Architecture Module: `plugins/claude-code/scripts/maintenance-runner.py`
```
#!/usr/bin/env python3
"""Plugin-local runner for MemSearch maintenance tasks.

This script belongs to the plugin layer. It handles host-native agent
invocations, while the Python package provides shared config, due-state,
prompt, and API-provider logic.
"""

from __future__ import annotations

import argparse
import contextlib
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

DEFAULT_NATIVE_MODELS = {
    "claude-code": "sonnet",
    "codex": "",
    "opencode": "",
    "openclaw": "",
    "dsh": "",  # dsh-headless uses the user's agent-default-model from settings.yaml
}


def _strip_jsonc(text: str) -> str:
    """Remove JSONC comments and trailing commas while preserving string contents."""
    out: list[str] = []
    i = 0
    in_string = False
    string_quote = ""
    escaped = False
    while i < len(text):
        char = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""
        if in_string:
            out.append(char)
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == string_quote:
                in_string = False
            i += 1
            continue
        if char in {'"', "'"}:
            in_string = True
            string_quote = char
            out.append(char)
            i += 1
            continue
        if char == "/" and nxt == "/":
            i += 2
            while i < len(text) and text[i] not in "\r\n":
                i += 1
            continue
        if char == "/" and nxt == "*":
            i += 2
            while i + 1 < len(text) and not (text[i] == "*" and text[i + 1] == "/"):
                i += 1
            i += 2
            continue
        out.append(char)
        i += 1

    without_comments = "".join(out)
    out = []
    i = 0
    in_string = False
    string_quote = ""
    escaped = False
    while i < len(without_comments):
        char = without_comments[i]
        if in_string:
            out.append(char)
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == string_quote:
                in_string = False
            i += 1
            continue
        if char in {'"', "'"}:
            in_string = True
            string_quote = char
            out.append(char)
            i += 1
            continue
        if char == ",":
            j = i + 1
            while j < len(without_comments) and without_comments[j].isspace():
                j += 1
            if j < len(without_comments) and without_comments[j] in "]}":
                i += 1
                continue
        out.append(char)
        i += 1
    return "".join(out)


def _read_jsonc_config_from_text(text: str) -> dict:
    try:
        data = json.loads(_strip_jsonc(text))
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def _read_jsonc_config(path: Path) -> dict:
    try:
        return _read_jsonc_config_from_text(path.read_text(encoding="utf-8"))
    except OSError:
        return {}


def _deep_merge_config(base: dict, override: dict) -> dict:
    result = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = _deep_merge_config(result[key], value)
        else:
            result[key] = value
    return result


def _rewrite_relative_file_refs(value, config_dir: Path):
    if isinstance(value, dict):
        return {key: _rewrite_relative_file_refs(item, config_dir) for key, item in value.items()}
    if isinstance(value, list):
        return [_rewrite_relative_file_refs(item, config_dir) for item in value]
    if not isinstance(value, str):
        return value

    def replace(match: re.Match[str]) -> str:
        file_ref = match.group(1)
        if file_ref.startswith("~/") or os.path.isabs(file_ref):
            return match.group(0)
        return "{file:" + str((config_dir / file_ref).resolve()) + "}"

    return re.sub(r"\{file:([^}]+)\}", replace, value)


def _load_opencode_config_file(path: Path) -> dict:
    cfg = _read_jsonc_config(path)
    if not cfg:
        return {}
    return _rewrite_relative_file_refs(cfg, path.parent)


def _opencode_global_config_dir() -> Path:
    xdg_config = os.environ.get("XDG_CONFIG_HOME")
    if xdg_config:
        return Path(xdg_config).expanduser() / "opencode"
    return Path.home() / ".config" / "opencode"


def _env_flag_enabled(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes"}


def _opencode_project_config_files(project_dir: Path) -> list[Path]:
    found: list[Path] = []
    current = project_dir.resolve()
    while True:
        for filename in ("opencode.jsonc", "opencode.json"):
            candidate = current / filename
            if candidate.is_file():
                found.append(candidate)
        parent = current.parent
        if parent == current:
            break
        current = parent
    return list(reversed(found))


def _opencode_directory_config_files(project_dir: Path) -> list[Path]:
    dirs: list[Path] = []
    if not _env_flag_enabled("OPENCODE_DISABLE_PROJECT_CONFIG"):
        current = project_dir.resolve()
        while True:
            local = current / ".opencode"
            if local.is_dir() and local not in dirs:
                dirs.append(local)
            parent = current.parent
            if parent == current:
                break
            current = parent

    home_local = Path.home() / ".opencode"
    if home_local.is_dir() and home_local not in dirs:
        dirs.append(home_local)

    env_dir = os.environ.get("OPENCODE_CONFIG_DIR", "").strip()
    if env_dir:
        config_dir = Path(env_dir).expanduser()
        if config_dir not in dirs:
            dirs.append(config_dir)

    files: list[Path] = []
    for directory in dirs:
        for filename in ("opencode.json", "opencode.jsonc"):
            candidate = directory / filename
            if candidate.is_file():
                files.append(candidate)
    return files


def _iter_opencode_config_files(project_dir: str | os.PathLike[str] | None = None) -> list[Path]:
    project = Path(project_dir or os.getcwd()).expanduser().resolve()
    files: list[Path] = []

    global_dir = _opencode_global_config_dir()
    for filename in ("config.json", "opencode.json", "opencode.jsonc"):
        candidate = global_dir / filename
        if candidate.is_file():
            files.append(candidate)

    env_config = os.environ.get("OPENCODE_CONFIG", "").strip()
    if env_config:
        candidate = Path(env_config).expanduser()
        if candidate.is_file():
            files.append(candidate)

    if not _env_flag_enabled("OPENCODE_DISABLE_PROJECT_CONFIG"):
        files.extend(_opencode_project_config_files(project))

    files.extend(_opencode_directory_config_files(project))
    return files


def load_opencode_config(project_dir: str | os.PathLike[str] | None = None) -> dict:
    """Load local OpenCode config sources in OpenCode-compatible precedence order."""
    merged: dict = {}
    for path in _iter_opencode_config_files(project_dir):
        merged = _deep_merge_config(merged, _load_opencode_config_file(path))

    content = os.environ.get("OPENCODE_CONFIG_CONTENT")
    if content:
        content_dir = Path(project_dir or os.getcwd()).expanduser().resolve()
        cfg = _rewrite_relative_file_refs(_read_jsonc_config_from_text(content), content_dir)
        merged = _deep_merge_config(merged, cfg)
    return merged


def _sanitize_opencode_config(cfg: dict) -> dict:
    sanitized = dict(cfg)
    for key in ("plugin", "plugins", "plugin_origins"):
        sanitized.pop(key, None)
    return sanitized


def run_command(cmd: list[str], *, env: dict[str, str], cwd: Path, timeout: int) -> str:
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        env=env,
        cwd=str(cwd),
        timeout=timeout,
        check=False,
    )
    stdout = (result.stdout or "").strip()
    stderr = (result.stderr or "").strip()
    if result.returncode != 0:
        detail = "\n".join(part for part in (stdout, stderr) if part)
        if len(detail) > 2000:
            detail = detail[:1975] + "... [truncated]"
        command = " ".join(shlex.quote(_describe_arg(part)) for part in cmd)
        if len(command) > 300:
            command = command[:275] + "... [truncated]"
        message = f"Command failed ({result.returncode}): {command}"
        if detail:
            message = f"{message}\n{detail}"
        raise RuntimeError(message)
    return stdout or stderr


def _describe_arg(arg: str, limit: int = 120) -> str:
    if len(arg) <= limit:
        return arg
    return f"<arg:{len(arg)} chars>"


_CLAUDE_SAFE_MODE_ARGS: list[str] | None = None


def claude_safe_mode_args() -> list[str]:
    """Return Claude args that suppress hooks when supported."""
    global _CLAUDE_SAFE_MODE_ARGS
    if _CLAUDE_SAFE_MODE_ARGS is not None:
        return _CLAUDE_SAFE_MODE_ARGS
    try:
        result = subprocess.run(
            ["claude", "--help"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        _CLAUDE_SAFE_MODE_ARGS = []
    else:
        help_text = f"{result.stdout}\n{result.stderr}"
        _CLAUDE_SAFE_MODE_ARGS = ["--safe-mode"] if "--safe-mode" in help_text else []
    return _CLAUDE_SAFE_MODE_ARGS


def extract_task_json_output(output: str) -> str:
    """Extract the first maintenance JSON object from noisy host output."""
    for line in output.splitlines():
        candidate = line.strip()
        if not candidate.startswith("{"):
            continue
        try:
            parsed = json.loads(candidate)
        excep
```

### Core Architecture Module: `plugins/claude-code/transcript.py`
```
"""Parse Claude Code JSONL transcripts for progressive memory disclosure."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class Turn:
    """A single conversation turn extracted from a JSONL transcript."""

    uuid: str
    timestamp: str
    role: str  # "user" or "assistant"
    content: str  # rendered text content
    tool_calls: list[str] = field(default_factory=list)  # ["Bash(command=ls)", ...]


def parse_transcript(path: str | Path) -> list[Turn]:
    """Parse a JSONL transcript into a list of conversation turns.

    Turns are user messages (non-tool-result) and their corresponding
    assistant responses, grouped logically.  Progress, system, and
    file-history-snapshot entries are skipped.
    """
    path = Path(path)
    if not path.exists():
        return []

    entries: list[dict[str, Any]] = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                entries.append(obj)
            except json.JSONDecodeError:
                continue

    turns: list[Turn] = []
    current_turn: Turn | None = None

    for entry in entries:
        entry_type = entry.get("type", "")

        if entry_type == "user":
            msg = entry.get("message", {})
            content = msg.get("content", "")

            # Skip tool results — they are part of the previous assistant turn
            if (
                isinstance(content, list)
                and content
                and isinstance(content[0], dict)
                and content[0].get("type") == "tool_result"
            ):
                continue

            # Real user message
            if isinstance(content, str) and content.strip():
                # Strip XML tags injected by hooks
                clean = _strip_hook_tags(content)
                if not clean:
                    continue
                # Save previous turn and start new one
                if current_turn is not None:
                    turns.append(current_turn)
                current_turn = Turn(
                    uuid=entry.get("uuid", ""),
                    timestamp=entry.get("timestamp", ""),
                    role="user",
                    content=clean,
                )

        elif entry_type == "assistant" and current_turn is not None:
            msg = entry.get("message", {})
            content_blocks = msg.get("content", [])
            if not isinstance(content_blocks, list):
                continue

            for block in content_blocks:
                if not isinstance(block, dict):
                    continue
                block_type = block.get("type", "")

                if block_type == "text":
                    text = block.get("text", "").strip()
                    if text:
                        if current_turn.role == "user":
                            # First assistant block — create assistant section
                            current_turn.content += f"\n\n**Assistant**: {text}"
                        else:
                            current_turn.content += f"\n{text}"

                elif block_type == "tool_use":
                    name = block.get("name", "unknown")
                    tool_input = block.get("input", {})
                    summary = _summarize_tool_input(name, tool_input)
                    current_turn.tool_calls.append(summary)

                # Skip "thinking" blocks

    # Don't forget the last turn
    if current_turn is not None:
        turns.append(current_turn)

    return turns


def find_turn_context(
    turns: list[Turn],
    target_uuid: str,
    context: int = 3,
) -> tuple[list[Turn], int]:
    """Find a turn by UUID and return surrounding context turns.

    Returns (context_turns, target_index_in_result).
    """
    target_idx = -1
    for i, turn in enumerate(turns):
        if turn.uuid.startswith(target_uuid) or target_uuid.startswith(turn.uuid[:8]):
            target_idx = i
            break

    if target_idx == -1:
        return [], -1

    start = max(0, target_idx - context)
    end = min(len(turns), target_idx + context + 1)
    return turns[start:end], target_idx - start


def format_turns(turns: list[Turn], highlight_idx: int = -1) -> str:
    """Format turns into readable text output."""
    lines: list[str] = []
    for i, turn in enumerate(turns):
        marker = ">>> " if i == highlight_idx else ""
        ts = _extract_time(turn.timestamp)
        lines.append(f"{marker}[{ts}] {turn.uuid[:8]}")
        lines.append(turn.content)
        if turn.tool_calls:
            lines.append(f"  Tools: {', '.join(turn.tool_calls)}")
        lines.append("")
    return "\n".join(lines)


def format_turn_index(turns: list[Turn]) -> str:
    """Format a compact index of all turns (for --no-turn overview)."""
    lines: list[str] = []
    for turn in turns:
        ts = _extract_time(turn.timestamp)
        preview = turn.content[:80].replace("\n", " ")
        n_tools = len(turn.tool_calls)
        tool_info = f" [{n_tools} tools]" if n_tools else ""
        lines.append(f"  {turn.uuid[:12]}  {ts}  {preview}{tool_info}")
    return "\n".join(lines)


def turns_to_dicts(turns: list[Turn]) -> list[dict[str, Any]]:
    """Convert turns to JSON-serializable dicts."""
    return [
        {
            "uuid": t.uuid,
            "timestamp": t.timestamp,
            "content": t.content,
            "tool_calls": t.tool_calls,
        }
        for t in turns
    ]


# -- Helpers --


def _strip_hook_tags(text: str) -> str:
    """Remove hook-injected XML tags from user messages."""
    import re

    # Remove <system-reminder>...</system-reminder>, <local-command-*>...</local-command-*>, etc.
    text = re.sub(r"<system-reminder>.*?</system-reminder>", "", text, flags=re.DOTALL)
    text = re.sub(r"<local-command-\w+>.*?</local-command-\w+>", "", text, flags=re.DOTALL)
    text = re.sub(r"<command-\w+>.*?</command-\w+>", "", text, flags=re.DOTALL)
    return text.strip()


def _extract_time(ts: str) -> str:
    """Extract HH:MM:SS from ISO timestamp."""
    if "T" in ts:
        time_part = ts.split("T")[1]
        return time_part[:8]  # HH:MM:SS
    return ts[:8] if len(ts) >= 8 else ts


def _summarize_tool_input(name: str, tool_input: dict) -> str:
    """Create a short summary of a tool call."""
    if name == "Bash":
        cmd = str(tool_input.get("command", ""))[:80]
        return f"Bash({cmd})"
    elif name == "Read":
        return f"Read({tool_input.get('file_path', '')})"
    elif name == "Edit":
        return f"Edit({tool_input.get('file_path', '')})"
    elif name == "Write":
        return f"Write({tool_input.get('file_path', '')})"
    elif name in ("Grep", "Glob"):
        pattern = tool_input.get("pattern", "")[:60]
        return f"{name}({pattern})"
    elif name == "Task":
        desc = tool_input.get("description", "")[:60]
        return f"Task({desc})"
    elif name == "WebSearch":
        query = tool_input.get("query", "")[:60]
        return f"WebSearch({query})"
    else:
        # Generic: show first key=value pair
        if tool_input:
            first_key = next(iter(tool_input))
            first_val = str(tool_input[first_key])[:60]
            return f"{name}({first_key}={first_val})"
        return name


# -- CLI entry point --


if __name__ == "__main__":
    import sys

    import argparse

    parser = argparse.ArgumentParser(
        description="View conversation turns from a Claude Code JSONL transcript."
    )
    parser.add_argument("jsonl_path", help="Path to the JSONL transcript file.")
    parser.add_argument("--turn", "-t", default=None, help="Target turn UUID (prefix match).")
    parser.add_argument("--context", "-c", default=3, type=int, help="Number of turns before/after target.")
    parser.add_argument("--json-output", "-j", action="store_true", help="Output as JSON.")
    args = parser.parse_args()

    turns = parse_transcript(args.jsonl_path)
    if not turns:
        print("No conversation turns found.")
        sys.exit(0)

    if args.turn:
        context_turns, highlight = find_turn_context(turns, args.turn, context=args.context)
        if not context_turns:
            print(f"Turn not found: {args.turn}", file=sys.stderr)
            sys.exit(1)
        if args.json_output:
            print(json.dumps(turns_to_dicts(context_turns), indent=2, ensure_ascii=False))
        else:
            print(f"Showing {len(context_turns)} turns around {args.turn[:12]}:\n")
            print(format_turns(context_turns, highlight_idx=highlight))
    else:
        if args.json_output:
            print(json.dumps(turns_to_dicts(turns), indent=2, ensure_ascii=False))
        else:
            print(f"All turns ({len(turns)}):\n")
            print(format_turn_index(turns))

```

### Core Architecture Module: `plugins/codex/scripts/maintenance-runner.py`
```
#!/usr/bin/env python3
"""Plugin-local runner for MemSearch maintenance tasks.

This script belongs to the plugin layer. It handles host-native agent
invocations, while the Python package provides shared config, due-state,
prompt, and API-provider logic.
"""

from __future__ import annotations

import argparse
import contextlib
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

DEFAULT_NATIVE_MODELS = {
    "claude-code": "sonnet",
    "codex": "",
    "opencode": "",
    "openclaw": "",
    "dsh": "",  # dsh-headless uses the user's agent-default-model from settings.yaml
}


def _strip_jsonc(text: str) -> str:
    """Remove JSONC comments and trailing commas while preserving string contents."""
    out: list[str] = []
    i = 0
    in_string = False
    string_quote = ""
    escaped = False
    while i < len(text):
        char = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""
        if in_string:
            out.append(char)
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == string_quote:
                in_string = False
            i += 1
            continue
        if char in {'"', "'"}:
            in_string = True
            string_quote = char
            out.append(char)
            i += 1
            continue
        if char == "/" and nxt == "/":
            i += 2
            while i < len(text) and text[i] not in "\r\n":
                i += 1
            continue
        if char == "/" and nxt == "*":
            i += 2
            while i + 1 < len(text) and not (text[i] == "*" and text[i + 1] == "/"):
                i += 1
            i += 2
            continue
        out.append(char)
        i += 1

    without_comments = "".join(out)
    out = []
    i = 0
    in_string = False
    string_quote = ""
    escaped = False
    while i < len(without_comments):
        char = without_comments[i]
        if in_string:
            out.append(char)
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == string_quote:
                in_string = False
            i += 1
            continue
        if char in {'"', "'"}:
            in_string = True
            string_quote = char
            out.append(char)
            i += 1
            continue
        if char == ",":
            j = i + 1
            while j < len(without_comments) and without_comments[j].isspace():
                j += 1
            if j < len(without_comments) and without_comments[j] in "]}":
                i += 1
                continue
        out.append(char)
        i += 1
    return "".join(out)


def _read_jsonc_config_from_text(text: str) -> dict:
    try:
        data = json.loads(_strip_jsonc(text))
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def _read_jsonc_config(path: Path) -> dict:
    try:
        return _read_jsonc_config_from_text(path.read_text(encoding="utf-8"))
    except OSError:
        return {}


def _deep_merge_config(base: dict, override: dict) -> dict:
    result = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = _deep_merge_config(result[key], value)
        else:
            result[key] = value
    return result


def _rewrite_relative_file_refs(value, config_dir: Path):
    if isinstance(value, dict):
        return {key: _rewrite_relative_file_refs(item, config_dir) for key, item in value.items()}
    if isinstance(value, list):
        return [_rewrite_relative_file_refs(item, config_dir) for item in value]
    if not isinstance(value, str):
        return value

    def replace(match: re.Match[str]) -> str:
        file_ref = match.group(1)
        if file_ref.startswith("~/") or os.path.isabs(file_ref):
            return match.group(0)
        return "{file:" + str((config_dir / file_ref).resolve()) + "}"

    return re.sub(r"\{file:([^}]+)\}", replace, value)


def _load_opencode_config_file(path: Path) -> dict:
    cfg = _read_jsonc_config(path)
    if not cfg:
        return {}
    return _rewrite_relative_file_refs(cfg, path.parent)


def _opencode_global_config_dir() -> Path:
    xdg_config = os.environ.get("XDG_CONFIG_HOME")
    if xdg_config:
        return Path(xdg_config).expanduser() / "opencode"
    return Path.home() / ".config" / "opencode"


def _env_flag_enabled(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes"}


def _opencode_project_config_files(project_dir: Path) -> list[Path]:
    found: list[Path] = []
    current = project_dir.resolve()
    while True:
        for filename in ("opencode.jsonc", "opencode.json"):
            candidate = current / filename
            if candidate.is_file():
                found.append(candidate)
        parent = current.parent
        if parent == current:
            break
        current = parent
    return list(reversed(found))


def _opencode_directory_config_files(project_dir: Path) -> list[Path]:
    dirs: list[Path] = []
    if not _env_flag_enabled("OPENCODE_DISABLE_PROJECT_CONFIG"):
        current = project_dir.resolve()
        while True:
            local = current / ".opencode"
            if local.is_dir() and local not in dirs:
                dirs.append(local)
            parent = current.parent
            if parent == current:
                break
            current = parent

    home_local = Path.home() / ".opencode"
    if home_local.is_dir() and home_local not in dirs:
        dirs.append(home_local)

    env_dir = os.environ.get("OPENCODE_CONFIG_DIR", "").strip()
    if env_dir:
        config_dir = Path(env_dir).expanduser()
        if config_dir not in dirs:
            dirs.append(config_dir)

    files: list[Path] = []
    for directory in dirs:
        for filename in ("opencode.json", "opencode.jsonc"):
            candidate = directory / filename
            if candidate.is_file():
                files.append(candidate)
    return files


def _iter_opencode_config_files(project_dir: str | os.PathLike[str] | None = None) -> list[Path]:
    project = Path(project_dir or os.getcwd()).expanduser().resolve()
    files: list[Path] = []

    global_dir = _opencode_global_config_dir()
    for filename in ("config.json", "opencode.json", "opencode.jsonc"):
        candidate = global_dir / filename
        if candidate.is_file():
            files.append(candidate)

    env_config = os.environ.get("OPENCODE_CONFIG", "").strip()
    if env_config:
        candidate = Path(env_config).expanduser()
        if candidate.is_file():
            files.append(candidate)

    if not _env_flag_enabled("OPENCODE_DISABLE_PROJECT_CONFIG"):
        files.extend(_opencode_project_config_files(project))

    files.extend(_opencode_directory_config_files(project))
    return files


def load_opencode_config(project_dir: str | os.PathLike[str] | None = None) -> dict:
    """Load local OpenCode config sources in OpenCode-compatible precedence order."""
    merged: dict = {}
    for path in _iter_opencode_config_files(project_dir):
        merged = _deep_merge_config(merged, _load_opencode_config_file(path))

    content = os.environ.get("OPENCODE_CONFIG_CONTENT")
    if content:
        content_dir = Path(project_dir or os.getcwd()).expanduser().resolve()
        cfg = _rewrite_relative_file_refs(_read_jsonc_config_from_text(content), content_dir)
        merged = _deep_merge_config(merged, cfg)
    return merged


def _sanitize_opencode_config(cfg: dict) -> dict:
    sanitized = dict(cfg)
    for key in ("plugin", "plugins", "plugin_origins"):
        sanitized.pop(key, None)
    return sanitized


def run_command(cmd: list[str], *, env: dict[str, str], cwd: Path, timeout: int) -> str:
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        env=env,
        cwd=str(cwd),
        timeout=timeout,
        check=False,
    )
    stdout = (result.stdout or "").strip()
    stderr = (result.stderr or "").strip()
    if result.returncode != 0:
        detail = "\n".join(part for part in (stdout, stderr) if part)
        if len(detail) > 2000:
            detail = detail[:1975] + "... [truncated]"
        command = " ".join(shlex.quote(_describe_arg(part)) for part in cmd)
        if len(command) > 300:
            command = command[:275] + "... [truncated]"
        message = f"Command failed ({result.returncode}): {command}"
        if detail:
            message = f"{message}\n{detail}"
        raise RuntimeError(message)
    return stdout or stderr


def _describe_arg(arg: str, limit: int = 120) -> str:
    if len(arg) <= limit:
        return arg
    return f"<arg:{len(arg)} chars>"


_CLAUDE_SAFE_MODE_ARGS: list[str] | None = None


def claude_safe_mode_args() -> list[str]:
    """Return Claude args that suppress hooks when supported."""
    global _CLAUDE_SAFE_MODE_ARGS
    if _CLAUDE_SAFE_MODE_ARGS is not None:
        return _CLAUDE_SAFE_MODE_ARGS
    try:
        result = subprocess.run(
            ["claude", "--help"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        _CLAUDE_SAFE_MODE_ARGS = []
    else:
        help_text = f"{result.stdout}\n{result.stderr}"
        _CLAUDE_SAFE_MODE_ARGS = ["--safe-mode"] if "--safe-mode" in help_text else []
    return _CLAUDE_SAFE_MODE_ARGS


def extract_task_json_output(output: str) -> str:
    """Extract the first maintenance JSON object from noisy host output."""
    for line in output.splitlines():
        candidate = line.strip()
        if not candidate.startswith("{"):
            continue
        try:
            parsed = json.loads(candidate)
        excep
```

### Core Architecture Module: `plugins/dsh/client.js`
```
/**
 * memsearch-dsh — browser half (skill review panel).
 *
 * A non-blocking dock strip above the composer that lists MemSearch skill
 * candidates distilled from memory journals and lets the human review or
 * install them:
 *
 *   - data:   GET  /memsearch-dsh/skill-candidates
 *   - review: POST /memsearch-dsh/skill-review  { sessionId, name, action: 'review' }
 *             queues a user message into the live agent's inbox; the agent
 *             reviews the candidate on the next turn (non-blocking).
 *   - install:POST /memsearch-dsh/skill-review  { sessionId, name, action: 'install' }
 *             runs `memsearch skills install` in the background to the
 *             resolved target (paths config, else ~/.agents/skills).
 *
 * The bundle is a prebuilt client-module artifact: it registers its factory
 * with `window.__ModuleLoader__.load({ id, factory })` (lazy CJS table —
 * nothing runs until the shell materializes the module), and exports the
 * Cordis client plugin shape (`inject` + `apply`). The only external module it
 * requires is `react`, which the web shell provides.
 *
 * @module @zilliz/memsearch-dsh/client
 */
window.__ModuleLoader__.load({
  id: '@zilliz/memsearch-dsh',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    var React = require('react')
    var useState = React.useState
    var useEffect = React.useEffect
    var useCallback = React.useCallback
    var useRef = React.useRef

    var NS = 'memsearch-skill-review'
    var CSS_TAG = 'memsearch-skill-review-css'

    var CSS =
      '.msr-root{' +
        '--msr-bg:var(--dsw-alias-bg-layer-1,#1c1f26);' +
        '--msr-bg-2:var(--dsw-alias-bg-layer-2,#242830);' +
        '--msr-border:var(--dsw-alias-border-l1,rgba(148,163,184,.18));' +
        '--msr-text:var(--dsw-alias-label-primary,#e2e8f0);' +
        '--msr-text-2:var(--dsw-alias-label-secondary,#94a3b8);' +
        '--msr-brand:var(--dsw-alias-brand-primary,#3b82f6);' +
        '--msr-success:var(--dsw-alias-state-success-primary,#22c55e);' +
        '--msr-warn:var(--dsw-alias-state-warn-primary,#f59e0b);' +
        '--msr-error:var(--dsw-alias-state-error-primary,#ef4444);' +
        'font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;' +
      '}' +
      '.msr-bar{display:flex;align-items:center;gap:8px;width:100%;padding:6px 10px;box-sizing:border-box;' +
        'border:1px solid var(--msr-border);border-radius:8px;background:var(--msr-bg);color:var(--msr-text);' +
        'font-size:13px;line-height:1.4;}' +
      '.msr-badge{display:inline-flex;align-items:center;gap:5px;background:color-mix(in srgb,var(--msr-brand) 16%,transparent);' +
        'color:var(--msr-brand);border-radius:999px;padding:2px 9px;font-size:12px;font-weight:600;white-space:nowrap;}' +
      '.msr-count{font-weight:700;color:var(--msr-warn);}' +
      '.msr-spacer{flex:1;}' +
      '.msr-btn{border:1px solid var(--msr-border);background:var(--msr-bg-2);color:var(--msr-text);border-radius:6px;' +
        'padding:3px 10px;font-size:12px;cursor:pointer;font-family:inherit;white-space:nowrap;}' +
      '.msr-btn:hover{border-color:var(--msr-brand);color:var(--msr-brand);}' +
      '.msr-btn.primary{background:var(--msr-brand);border-color:var(--msr-brand);color:#fff;font-weight:600;}' +
      '.msr-btn.primary:hover{filter:brightness(1.1);color:#fff;}' +
      '.msr-btn.danger{color:var(--msr-error);}' +
      '.msr-btn.danger:hover{border-color:var(--msr-error);color:var(--msr-error);}' +
      '.msr-btn.ghost{background:transparent;}' +
      '.msr-btn:disabled{opacity:.55;cursor:default;}' +
      '.msr-panel{margin-top:6px;border:1px solid var(--msr-border);border-radius:10px;background:var(--msr-bg);' +
        'color:var(--msr-text);overflow:hidden;}' +
      '.msr-panel-head{display:flex;align-items:center;gap:8px;padding:8px 12px;font-size:12px;color:var(--msr-text-2);' +
        'border-bottom:1px solid var(--msr-border);}' +
      '.msr-panel-title{font-weight:700;color:var(--msr-text);font-size:13px;}' +
      '.msr-list{padding:4px;}' +
      '.msr-item{display:flex;align-items:flex-start;gap:10px;padding:9px 10px;border-radius:8px;}' +
      '.msr-item:hover{background:var(--msr-bg-2);}' +
      '.msr-item+.msr-item{border-top:1px solid var(--msr-border);}' +
      '.msr-item-main{flex:1;min-width:0;}' +
      '.msr-item-name{font-weight:650;font-size:13px;display:flex;align-items:center;gap:8px;}' +
      '.msr-tag{font-size:10px;font-weight:700;letter-spacing:.04em;padding:1px 7px;border-radius:999px;text-transform:uppercase;}' +
      '.msr-tag.candidate{background:color-mix(in srgb,var(--msr-warn) 18%,transparent);color:var(--msr-warn);}' +
      '.msr-tag.installed{background:color-mix(in srgb,var(--msr-success) 18%,transparent);color:var(--msr-success);}' +
      '.msr-item-desc{font-size:12px;color:var(--msr-text-2);margin-top:3px;}' +
      '.msr-item-meta{font-size:11px;color:var(--msr-text-2);margin-top:3px;opacity:.85;}' +
      '.msr-item-meta code{background:var(--msr-bg-2);border:1px solid var(--msr-border);border-radius:4px;' +
        'padding:0 4px;font-size:10px;}' +
      '.msr-item-actions{display:flex;gap:6px;flex-shrink:0;align-items:center;}' +
      '.msr-note{padding:8px 12px;border-top:1px solid var(--msr-border);font-size:11px;color:var(--msr-text-2);' +
        'display:flex;align-items:center;gap:6px;}' +
      '.msr-toast{margin-top:6px;padding:7px 12px;border-radius:8px;font-size:12px;border:1px solid var(--msr-border);' +
        'background:var(--msr-bg-2);color:var(--msr-text);}' +
      '.msr-toast.ok{border-color:color-mix(in srgb,var(--msr-success) 45%,transparent);color:var(--msr-success);}' +
      '.msr-toast.warn{border-color:color-mix(in srgb,var(--msr-warn) 45%,transparent);color:var(--msr-warn);}' +
      '.msr-toast.err{border-color:color-mix(in srgb,var(--msr-error) 45%,transparent);color:var(--msr-error);}' +
      '.msr-capsule{display:inline-flex;align-items:center;gap:7px;padding:3px 11px;box-sizing:border-box;' +
        'border:1px solid var(--msr-border);border-radius:999px;background:var(--msr-bg);color:var(--msr-text);' +
        'font-size:12px;font-weight:600;cursor:pointer;line-height:1.6;white-space:nowrap;transition:border-color .12s ease;}' +
      '.msr-capsule:hover{border-color:var(--msr-brand);}' +
      '.msr-capsule-dot{display:inline-flex;align-items:center;justify-content:center;min-width:17px;height:17px;' +
        'border-radius:999px;padding:0 4px;font-size:10px;font-weight:700;color:#fff;' +
        'background:var(--msr-warn);}' +
      '.msr-capsule-dot.zero{background:var(--msr-bg-2);color:var(--msr-text-2);border:1px solid var(--msr-border);}' +
      '.msr-capsule-chev{font-size:9px;color:var(--msr-text-2);}' +
      '.msr-link-btn{border:none;background:none;color:var(--msr-brand);font-size:11px;font-weight:600;' +
        'cursor:pointer;padding:2px 6px;border-radius:5px;font-family:inherit;white-space:nowrap;}' +
      '.msr-link-btn:hover{background:color-mix(in srgb,var(--msr-brand) 14%,transparent);}' +
      '.msr-link-btn:disabled{opacity:.5;cursor:default;}' +
      '.msr-fs{margin-top:6px;border:1px solid var(--msr-border);border-radius:10px;background:var(--msr-bg);' +
        'color:var(--msr-text);overflow:hidden;}' +
      '.msr-fs-head{display:flex;align-items:center;gap:8px;padding:7px 12px;font-size:12px;color:var(--msr-text-2);' +
        'border-bottom:1px solid var(--msr-border);cursor:pointer;user-select:none;}' +
      '.msr-fs-head:hover{background:var(--msr-bg-2);}' +
      '.msr-fs-body{display:flex;max-height:320px;overflow:auto;}' +
      '.msr-fs-tree{flex:1;min-width:220px;padding:6px;font-size:12px;border-right:1px solid var(--msr-border);}' +
      '.msr-fs-row{display:flex;align-items:center;gap:6px;padding:3px 8px;border-radius:6px;cursor:pointer;' +
        'white-space:nowrap;color:var(--msr-text);}' +
      '.msr-fs-row:hover{background:var(--msr-bg-2);}' +
      '.msr-fs-row.sel{background:color-mix(in srgb,var(--msr-brand) 18%,transparent);color:var(--msr-brand);}' +
      '.msr-fs-row.muted{color:var(--msr-text-2);opacity:.55;cursor:not-allowed;}' +
      '.msr-fs-row.muted:hover{background:none;color:var(--msr-text-2);}' +
      '.msr-fs-icon{flex:none;font-size:11px;}' +
      '.msr-fs-name{overflow:hidden;text-overflow:ellipsis;}' +
      '.msr-fs-depth{flex:none;width:12px;}' +
      '.msr-preview{flex:1.4;min-width:260px;padding:10px 14px;overflow:auto;font-size:13px;line-height:1.6;}' +
      '.msr-preview.empty{color:var(--msr-text-2);font-size:12px;}' +
      '.msr-md h1{font-size:17px;font-weight:700;margin:10px 0 6px;}' +
      '.msr-md h2{font-size:15px;font-weight:700;margin:10px 0 5px;}' +
      '.msr-md h3{font-size:14px;font-weight:600;margin:8px 0 4px;}' +
      '.msr-md p{margin:6px 0;}' +
      '.msr-md ul,.msr-md ol{margin:6px 0;padding-left:20px;}' +
      '.msr-md li{margin:2px 0;}' +
      '.msr-md code{background:var(--msr-bg-2);border:1px solid var(--msr-border);border-radius:4px;' +
        'padding:0 4px;font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}' +
      '.msr-md pre{background:var(--msr-bg-2);border:1px solid var(--msr-border);border-radius:8px;' +
        'padding:10px 12px;overflow:auto;font-size:12px;line-height:1.5;' +
        'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}' +
      '.msr-md pre code{background:none;border:none;padding:0;}' +
      '.msr-md hr{border:none;border-top:1px solid var(--msr-border);margin:10px 0;}' +
      '.msr-md a{color:var(--msr-brand);text-decoration:none;}' +
      '.msr-md a:hover{text-decoration:underline;}' +
      '.msr-md blockquote{border-left:3px solid var(--msr-border);margin:6px 0;padding:2px 12px;color:var(--msr-text-2);}' +
      '.msr-md table{border-collapse:collapse;margin:8px 0;font-size:12px;}' +
    
```

### Core Architecture Module: `plugins/dsh/index.js`
```
/**
 * memsearch-dsh — MemSearch plugin for DeepSeek Harness.
 *
 * Gives DSH persistent, cross-agent memory on top of memsearch:
 *
 *   capture  — every completed turn from the `session/event` stream is
 *              summarized (memsearch-managed `[llm.providers.*]` or a one-shot
 *              DSH headless agent, see `summarizeMode`) and appended to
 *              `<project>/.memsearch/memory/YYYY-MM-DD.md` alongside the other
 *              platform plugins (Claude Code, Codex, OpenClaw, OpenCode). The
 *              anchor format is identical, so DSH writes join the same shared
 *              memory store. Processing is fire-and-forget: each turn is
 *              summarized and written asynchronously, serialized so LLM calls
 *              never overlap, with `captureExists` dedup so a turn is recorded
 *              exactly once even across restarts.
 *   inject   — before the first model step of each turn, `agent/pre-step`
 *              runs a bounded memsearch search over the user's question and,
 *              only when search results exist, injects them plus a
 *              `[memsearch] Retrieved memory context attached.` marker. When
 *              search returns no chunks, the decision is returned unchanged —
 *              zero context cost.
 *   recall   — registers a `memory-recall` skill (search → expand → transcript)
 *              that the model can invoke through the native `skill` tool.
 *
 * The plugin is a plain ESM module with no build step. It is installed into a
 * DSH profile via `dsh plugin --profile <name> add <path>` (pnpm link), where
 * the package.json `dsh.bundle` declaration points at `cordis.patch.yml`.
 *
 * @module memsearch-dsh
 */

import { execFile, execFileSync, spawn } from 'node:child_process'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PLUGIN_DIR = dirname(fileURLToPath(import.meta.url))

/** Cordis plugin name; also the `source.plugin` tag on injected messages. */
export const name = 'memsearch'

/** Services this plugin needs before `apply()` runs. */
export const inject = ['agents', 'skills', 'sessionPersistence']

const DEFAULT_AGENT_NAME = 'DeepSeek Harness'
const MEMSEARCH_MARKER = '[memsearch] Retrieved memory context attached.'
const SEARCH_TOP_K = 5
const SEARCH_TIMEOUT_MS = 15000
const SUMMARIZE_TIMEOUT_MS = 30000
const CAPTURE_MAX_CHARS = 6000
const INJECT_SNIPPET_CHARS = 180
const DAILY_FILE_RE = /^\d{4}-\d{2}-\d{2}\.md$/
const MAINTENANCE_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6h; runner's due-state gates actual runs

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shell-escape a string for safe use inside single quotes. */
function shellEscape(s) {
  return String(s).replace(/'/g, "'\\''")
}

let dshLlmModule = null

/**
 * Lazily load `@deepseek-ai/dsh-llm` for its `createUserMessage` factory.
 *
 * This plugin is installed as an out-of-tree package (pnpm `link:`), so its
 * real directory is outside the DSH workspace and Node's bare-specifier walk
 * from `import.meta.url` cannot see the DSH packages. DSH maintains a flat
 * module fallback at `$DSH_HOME/profiles/node_modules` covering the whole app
 * dependency closure — the documented "bundles come from the installation"
 * contract — reachable by Node's parent-directory walk from any profile. The
 * loader anchors `ctx.baseUrl` at the profile directory, so we resolve through
 * a `createRequire` there and `import()` the resolved absolute path. When the
 * package is genuinely unreachable we fall back to building the same message
 * shape inline so injection never hard-fails the plugin.
 * @param ctx - the Cordis context (its `baseUrl` is the profile dir).
 * @returns the dsh-llm module namespace, or `null` when unresolvable.
 */
async function loadDshLlm(ctx) {
  if (dshLlmModule) return dshLlmModule
  dshLlmModule = (async () => {
    try {
      let anchor = import.meta.url
      if (ctx?.baseUrl) {
        const base = String(ctx.baseUrl)
        anchor = pathToFileURL(join(base.startsWith('file:') ? fileURLToPath(base) : base, '_memsearch.js')).href
      }
      const resolved = createRequire(anchor).resolve('@deepseek-ai/dsh-llm')
      return await import(pathToFileURL(resolved).href)
    } catch {
      return null
    }
  })()
  return dshLlmModule
}

/**
 * Build one plugin-sourced user message carrying the memory block.
 * @param ctx - the Cordis context (profile anchor for dsh-llm resolution).
 * @param text - the rendered memory block.
 * @returns a frozen `UserMessage` with a plugin snapshot source.
 */
async function createMemoryMessage(ctx, text) {
  const dshLlm = await loadDshLlm(ctx)
  if (dshLlm?.createUserMessage) {
    return dshLlm.createUserMessage({
      content: [{ type: 'text', text }],
      source: {
        kind: 'plugin',
        plugin: name,
        form: 'snapshot',
        sections: [{ name, text }],
      },
    })
  }
  return Object.freeze({
    id: crypto.randomUUID(),
    role: 'user',
    content: [{ type: 'text', text }],
    source: {
      kind: 'plugin',
      plugin: name,
      form: 'snapshot',
      sections: [{ name, text }],
    },
  })
}

/**
 * Detect the memsearch CLI command: installed binary on PATH first, then the
 * uvx fallback, then a bare `memsearch` best effort.
 *
 * `command -v` is resolved through bash so the check sees the same PATH the
 * later `bash -c` invocations use; calling `which` as a direct executable
 * bypasses shell built-ins and can miss the installed tool.
 */
function detectMemsearchCmd() {
  const home = process.env.HOME || ''
  const onPath = (cmd) => {
    try {
      execFileSync('bash', ['-c', `command -v ${cmd} >/dev/null 2>&1`], { stdio: 'pipe' })
      return true
    } catch {
      return false
    }
  }
  if (onPath('memsearch')) return 'memsearch'
  const uvxPath = join(home, '.local', 'bin', 'uvx')
  const uvxBin = existsSync(uvxPath) ? uvxPath : (onPath('uvx') ? 'uvx' : '')
  if (uvxBin) {
    return `${uvxBin} --from 'memsearch[onnx]' memsearch`
  }
  return 'memsearch'
}

/** Derive the per-project Milvus collection name via the shared script. */
function deriveCollection(projectDir, override) {
  if (override) return override
  const script = join(PLUGIN_DIR, 'scripts', 'derive-collection.sh')
  try {
    const result = execFileSync('bash', [script, projectDir], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return result.trim() || undefined
  } catch {
    return undefined
  }
}

function requireDefaultCollectionSupport(memsearchCmd, projectDir, collection) {
  try {
    execFileSync(
      'bash',
      [
        '-c',
        `${memsearchCmd} config get milvus.collection ` +
          `--default-collection '${shellEscape(collection)}'`,
      ],
      {
        cwd: projectDir,
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
  } catch {
    throw new Error(
      'Installed memsearch CLI is incompatible with this plugin; ' +
        '--default-collection support is required. Upgrade memsearch core and the plugin together.',
    )
  }
}

/**
 * Read a dotted value from the memsearch config (e.g. `plugins.dsh.summarize.provider`).
 *
 * Tolerant of older memsearch installs that predate the `dsh` plugin section:
 * a missing key, missing binary, or any failure returns `null` (treated as
 * "not configured") instead of throwing — so the plugin never breaks on a
 * user's existing memsearch version.
 */
/**
 * Read a dotted memsearch config value. Returns `{ ok, value }` so callers can
 * tell "successfully read and the value is empty" from "the command failed or
 * timed out". A failure must not be mistaken for an authoritative "not
 * configured": a slow/absent memsearch (e.g. first uvx run) would otherwise
 * silently flip auto mode to the wrong backend.
 */
function readMemsearchConfigValue(memsearchCmd, key) {
  try {
    // memsearchCmd may be a full command line (e.g. `uvx --from 'memsearch[onnx]' memsearch`),
    // so route through bash rather than execFileSync's single executable.
    const result = execFileSync('bash', ['-c', `${memsearchCmd} config get '${key}'`], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return { ok: true, value: result.trim() || null }
  } catch {
    return { ok: false, value: null }
  }
}

/**
 * Resolve the effective summarization backend for `summarizeMode`.
 *
 * - explicit `custom-llm` / `dsh-headless` pin the backend;
 * - unset (auto) mirrors the other platform plugins: if the user configured a
 *   provider under `[plugins.dsh.summarize]` (memsearch config), use the
 *   lightweight `custom-llm` route; otherwise fall back to `dsh-headless`
 *   (zero-config DSH agent).
 *
 * A read failure of `[plugins.dsh.summarize]` is NOT treated as "not
 * configured": it is logged (via `logger`) and falls back to `dsh-headless`
 * rather than silently picking a backend the user may not have intended.
 * An unknown explicit mode is also logged and treated as auto.
 *
 * Returns `{ mode, provider, model }` where provider/model carry the
 * memsearch-config values when auto resolved them.
 */
function resolveSummarizeMode(memsearchCmd, opts, config, logger) {
  if (opts.summarizeMode === 'custom-llm' || opts.summarizeMode === 'dsh-headless') {
    return {
      mode: opts.summarizeMode,
      provider: opts.summarizeProvider,
      model: opts.summarizeModel,
    }
  }
  if (opts.summarizeMode !== undefined && opts.summarizeMode !== 'auto') {
    logger?.warn?.(`[
```

### Core Architecture Module: `plugins/dsh/scripts/maintenance-runner.py`
```
#!/usr/bin/env python3
"""Plugin-local runner for MemSearch maintenance tasks.

This script belongs to the plugin layer. It handles host-native agent
invocations, while the Python package provides shared config, due-state,
prompt, and API-provider logic.
"""

from __future__ import annotations

import argparse
import contextlib
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

DEFAULT_NATIVE_MODELS = {
    "claude-code": "sonnet",
    "codex": "",
    "opencode": "",
    "openclaw": "",
    "dsh": "",  # dsh-headless uses the user's agent-default-model from settings.yaml
}


def _strip_jsonc(text: str) -> str:
    """Remove JSONC comments and trailing commas while preserving string contents."""
    out: list[str] = []
    i = 0
    in_string = False
    string_quote = ""
    escaped = False
    while i < len(text):
        char = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""
        if in_string:
            out.append(char)
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == string_quote:
                in_string = False
            i += 1
            continue
        if char in {'"', "'"}:
            in_string = True
            string_quote = char
            out.append(char)
            i += 1
            continue
        if char == "/" and nxt == "/":
            i += 2
            while i < len(text) and text[i] not in "\r\n":
                i += 1
            continue
        if char == "/" and nxt == "*":
            i += 2
            while i + 1 < len(text) and not (text[i] == "*" and text[i + 1] == "/"):
                i += 1
            i += 2
            continue
        out.append(char)
        i += 1

    without_comments = "".join(out)
    out = []
    i = 0
    in_string = False
    string_quote = ""
    escaped = False
    while i < len(without_comments):
        char = without_comments[i]
        if in_string:
            out.append(char)
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == string_quote:
                in_string = False
            i += 1
            continue
        if char in {'"', "'"}:
            in_string = True
            string_quote = char
            out.append(char)
            i += 1
            continue
        if char == ",":
            j = i + 1
            while j < len(without_comments) and without_comments[j].isspace():
                j += 1
            if j < len(without_comments) and without_comments[j] in "]}":
                i += 1
                continue
        out.append(char)
        i += 1
    return "".join(out)


def _read_jsonc_config_from_text(text: str) -> dict:
    try:
        data = json.loads(_strip_jsonc(text))
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def _read_jsonc_config(path: Path) -> dict:
    try:
        return _read_jsonc_config_from_text(path.read_text(encoding="utf-8"))
    except OSError:
        return {}


def _deep_merge_config(base: dict, override: dict) -> dict:
    result = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = _deep_merge_config(result[key], value)
        else:
            result[key] = value
    return result


def _rewrite_relative_file_refs(value, config_dir: Path):
    if isinstance(value, dict):
        return {key: _rewrite_relative_file_refs(item, config_dir) for key, item in value.items()}
    if isinstance(value, list):
        return [_rewrite_relative_file_refs(item, config_dir) for item in value]
    if not isinstance(value, str):
        return value

    def replace(match: re.Match[str]) -> str:
        file_ref = match.group(1)
        if file_ref.startswith("~/") or os.path.isabs(file_ref):
            return match.group(0)
        return "{file:" + str((config_dir / file_ref).resolve()) + "}"

    return re.sub(r"\{file:([^}]+)\}", replace, value)


def _load_opencode_config_file(path: Path) -> dict:
    cfg = _read_jsonc_config(path)
    if not cfg:
        return {}
    return _rewrite_relative_file_refs(cfg, path.parent)


def _opencode_global_config_dir() -> Path:
    xdg_config = os.environ.get("XDG_CONFIG_HOME")
    if xdg_config:
        return Path(xdg_config).expanduser() / "opencode"
    return Path.home() / ".config" / "opencode"


def _env_flag_enabled(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes"}


def _opencode_project_config_files(project_dir: Path) -> list[Path]:
    found: list[Path] = []
    current = project_dir.resolve()
    while True:
        for filename in ("opencode.jsonc", "opencode.json"):
            candidate = current / filename
            if candidate.is_file():
                found.append(candidate)
        parent = current.parent
        if parent == current:
            break
        current = parent
    return list(reversed(found))


def _opencode_directory_config_files(project_dir: Path) -> list[Path]:
    dirs: list[Path] = []
    if not _env_flag_enabled("OPENCODE_DISABLE_PROJECT_CONFIG"):
        current = project_dir.resolve()
        while True:
            local = current / ".opencode"
            if local.is_dir() and local not in dirs:
                dirs.append(local)
            parent = current.parent
            if parent == current:
                break
            current = parent

    home_local = Path.home() / ".opencode"
    if home_local.is_dir() and home_local not in dirs:
        dirs.append(home_local)

    env_dir = os.environ.get("OPENCODE_CONFIG_DIR", "").strip()
    if env_dir:
        config_dir = Path(env_dir).expanduser()
        if config_dir not in dirs:
            dirs.append(config_dir)

    files: list[Path] = []
    for directory in dirs:
        for filename in ("opencode.json", "opencode.jsonc"):
            candidate = directory / filename
            if candidate.is_file():
                files.append(candidate)
    return files


def _iter_opencode_config_files(project_dir: str | os.PathLike[str] | None = None) -> list[Path]:
    project = Path(project_dir or os.getcwd()).expanduser().resolve()
    files: list[Path] = []

    global_dir = _opencode_global_config_dir()
    for filename in ("config.json", "opencode.json", "opencode.jsonc"):
        candidate = global_dir / filename
        if candidate.is_file():
            files.append(candidate)

    env_config = os.environ.get("OPENCODE_CONFIG", "").strip()
    if env_config:
        candidate = Path(env_config).expanduser()
        if candidate.is_file():
            files.append(candidate)

    if not _env_flag_enabled("OPENCODE_DISABLE_PROJECT_CONFIG"):
        files.extend(_opencode_project_config_files(project))

    files.extend(_opencode_directory_config_files(project))
    return files


def load_opencode_config(project_dir: str | os.PathLike[str] | None = None) -> dict:
    """Load local OpenCode config sources in OpenCode-compatible precedence order."""
    merged: dict = {}
    for path in _iter_opencode_config_files(project_dir):
        merged = _deep_merge_config(merged, _load_opencode_config_file(path))

    content = os.environ.get("OPENCODE_CONFIG_CONTENT")
    if content:
        content_dir = Path(project_dir or os.getcwd()).expanduser().resolve()
        cfg = _rewrite_relative_file_refs(_read_jsonc_config_from_text(content), content_dir)
        merged = _deep_merge_config(merged, cfg)
    return merged


def _sanitize_opencode_config(cfg: dict) -> dict:
    sanitized = dict(cfg)
    for key in ("plugin", "plugins", "plugin_origins"):
        sanitized.pop(key, None)
    return sanitized


def run_command(cmd: list[str], *, env: dict[str, str], cwd: Path, timeout: int) -> str:
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        env=env,
        cwd=str(cwd),
        timeout=timeout,
        check=False,
    )
    stdout = (result.stdout or "").strip()
    stderr = (result.stderr or "").strip()
    if result.returncode != 0:
        detail = "\n".join(part for part in (stdout, stderr) if part)
        if len(detail) > 2000:
            detail = detail[:1975] + "... [truncated]"
        command = " ".join(shlex.quote(_describe_arg(part)) for part in cmd)
        if len(command) > 300:
            command = command[:275] + "... [truncated]"
        message = f"Command failed ({result.returncode}): {command}"
        if detail:
            message = f"{message}\n{detail}"
        raise RuntimeError(message)
    return stdout or stderr


def _describe_arg(arg: str, limit: int = 120) -> str:
    if len(arg) <= limit:
        return arg
    return f"<arg:{len(arg)} chars>"


_CLAUDE_SAFE_MODE_ARGS: list[str] | None = None


def claude_safe_mode_args() -> list[str]:
    """Return Claude args that suppress hooks when supported."""
    global _CLAUDE_SAFE_MODE_ARGS
    if _CLAUDE_SAFE_MODE_ARGS is not None:
        return _CLAUDE_SAFE_MODE_ARGS
    try:
        result = subprocess.run(
            ["claude", "--help"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        _CLAUDE_SAFE_MODE_ARGS = []
    else:
        help_text = f"{result.stdout}\n{result.stderr}"
        _CLAUDE_SAFE_MODE_ARGS = ["--safe-mode"] if "--safe-mode" in help_text else []
    return _CLAUDE_SAFE_MODE_ARGS


def extract_task_json_output(output: str) -> str:
    """Extract the first maintenance JSON object from noisy host output."""
    for line in output.splitlines():
        candidate = line.strip()
        if not candidate.startswith("{"):
            continue
        try:
            parsed = json.loads(candidate)
        excep
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #734** (2026-09-13): **Claude Code plugin from marketplace (main) requires `--default-collection`, but the latest PyPI release (0.4.19) does not support it**
  *Symptoms*: ### Description  After a fresh install following the documented steps for Claude Code, the plugin reports at every session start:      [memsearch v0.4.19] ... ERROR: installed memsearch CLI is incompatible; --default-collection support is required  and the Stop hook exits early, so no memory is captured and no index is ever built.   ## What I think is happening (please correct me if wrong)  The marketplace serves the plugin from `main`, while the hooks' fallback installs the CLI from PyPI. Since #726 made the hooks depend on a CLI feature that is not in any published release, the two halves are out of sync for anyone installing after 2026-09-08, until 0.4.20 (or equivalent) is published. Both sides report "0.4.19", so the version string does not reveal the mismatch.  If that reading is right, possible fixes might be: publish a release that includes #726, and/or pin the marketplace `source` to a release tag so that `main` changes cannot outrun PyPI. If instead I am expected to install the CLI from git in this situation, it would be great to have that in the Claude Code install docs.  ## Environment  - OS: Linux (WSL2), Python 3.10, `uv` 0.12.12 - Plugin: memsearch 0.4.19 from `memsearch-plugins` marketplace, installed 2026-09-09 - CLI: memsearch 0.4.19 via `uvx` fallback (PyPI) - Embedding provider: onnx (default written by the session-start hook)  ### Steps to reproduce  ## Steps to reproduce  1. In Claude Code, run `/plugin marketplace add zilliztech/memsearch` and `/plugin 
  **Post-Mortem & Fix Analysis**:
  > One observation that may make this easier to close:   as far as I can tell, no code change is needed on the CLI side. The `--default-collection` option the hooks require is already on `main` via #726, and `.github/workflows/release.yml` publishes to PyPI automatically when a version tag is pushed. So, if I'm reading the workflow correctly, tagging `v0.4.20` from `main` should bring PyPI back in sync with the marketplace plugin and fix the install path for new users.  I may well be missing a reason the release is being held back (e.g. other in-flight changes on `main`), so please treat this as a question rather than a request.  A possible longer-term guard, in case it helps: the Claude Code marketplace format allows a plugin `source` to be pinned with `ref` (branch or tag) and `sha` (full commit), e.g.  ```json {   "name": "memsearch",   "source": {     "source": "github",     "repo": "zilliztech/memsearch",     "ref": "v0.4.19",     "sha": "<commit of that tag>"   } } ```  Today market
  > Hi, I’d like to work on this issue.  The mismatch between the marketplace plugin on `main` and the PyPI `0.4.19` release seems to be the main cause. I can investigate the release/version synchronization and add a suitable guard or documentation change if needed.  If there’s a preferred approach for keeping the marketplace plugin and PyPI release in sync, I’d be happy to work on it and submit a PR. 
  > Resolved in memsearch 0.4.20. A fresh installation from the real memsearch Marketplace and public PyPI was verified end to end: SessionStart succeeded, Stop capture was indexed and searchable, and a new session recalled the saved marker.

- **Issue #651** (2026-09-05): **Opencode memsearch plugin -- Summarization issues highlight and fix**
  *Symptoms*: ### Description  The two bugs were identified: (1) Missing `auth.json` in the isolated sandbox caused `opencode run` to silently fail with "Missing API key" because `ensure_isolated_config()` never copied `auth.json` into the isolated `XDG_DATA_HOME`, making summarization fall back to writing raw transcripts. (2) A summarizer feedback loop where `get_session_ids()` returned all sessions matching the project directory with no filtering, so the daemon captured its own summarizer sessions and polluted the memory file with summarization prompt turns.   ### Steps to reproduce  # Memsearch OpenCode Plugin — Bugfix Notes  ## Bug 1: Missing `auth.json` in Isolated Sandbox (XDG Isolation)  **Root cause:** The capture daemon's `ensure_isolated_config()` creates a sandboxed `XDG_DATA_HOME` directory to run `opencode run --prompt` for summarization. This prevents plugin recursion. However, it never copies or symlinks `~/.local/share/opencode/auth.json` into the isolated data dir. Since `opencode` reads API keys from `$XDG_DATA_HOME/opencode/auth.json`, the summarization command silently fails with `"Missing API key."` — caught by a bare `except Exception: pass` — and falls back to writing raw conversation transcripts instead of summaries.  **Impact:** Affects every user whose provider stores credentials in `auth.json` (the default for `opencode-go` and most non-env-var providers). Summarization via the native path has never worked since the plugin was released.  **Fix:** Added `_symlink_
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report. Current-version verification confirmed that the unsafe raw-turn fallback still occurred when native summarization could not use the isolated environment.  The merged fix now fails closed across summary setup and execution: prompt loading errors, unavailable or timed-out processes, unsuccessful exits, and empty or unusable native results write only a bounded diagnostic while preserving the transcript anchor and advancing the capture checkpoint. It does not copy or link the user's auth store.  We also verified OpenCode 1.17.3's current session behavior. Native summarizer sessions are written to the existing isolated XDG data directory and database, so the parent capture daemon does not enumerate or capture them. No prompt-text filtering is needed.  Users whose native provider is available only through the main OpenCode auth store will receive the bounded unavailable entry unless they provide credentials through the isolated environment or configure a MemSe

- **Issue #621** (2026-07-13): **Orphaned capture-daemon.py processes persist after OpenCode exits**
  *Symptoms*: ### Description  The memsearch plugin launches a Python daemon (capture-daemon.py) that remains running after OpenCode terminates. Over normal usage (multiple sessions), these processes accumulate – often 15+ instances – each consuming ~10–20 MB RSS and CPU time due to the 10‑second polling loop. This leads to unnecessary memory pressure and CPU contention.  ### Steps to reproduce  1. Start OpenCode and use memsearch (daemon starts). 2. Exit OpenCode gracefully. 3. Run ps aux | grep capture-daemon.py – multiple stale processes are visible.  ### Error output / logs  ```shell <username>         65401   0.0  0.1 435273712  11296 s001  S    11:35AM   0:00.38 /opt/homebrew/Cellar/python@3.14/.../Python /Users/<username>/.cache/opencode/packages/@zilliz/memsearch-opencode@latest/.../capture-daemon.py /Users/<username> ms_<random_id> --memsearch-cmd memsearch --poll-interval 10 <username>         71234   0.0  0.2 435300000  15600 s002  S    12:10PM   0:00.45 ... (another similar line) ... ```  ### memsearch version  0.4.13  ### Operating system  macOS  ### Python version  3.14.5

- **Issue #565** (2026-06-11): **Unexpected git commit traced to the stop-hook summarizer — it can run shell commands (looks like the other half of #529)**
  *Symptoms*: ### Description  First off, thanks for the plugin.  While working in Claude Code with memsearch on, I hit a git commit I never made. It was tagged `Co-Authored-By: Claude Haiku 4.5`, but all my sessions run on Opus, so I couldn't explain it. I asked Claude Code to troubleshoot. Quoting its findings:  > memsearch's Stop hook runs `claude -p --model haiku` after every turn to summarize the transcript into memory. That summarizer runs with no tool restriction, so it inherits the user's normal Claude Code permissions — including `Bash(git:*)` from the allow-list. > > On the turn where the user told the main session "ok commit the things," the summarizer read that line in the transcript it was supposed to be summarizing, and ran it — a real `git add` + `git commit`, stamped with its own model (Claude Haiku 4.5). It then wrote the third-person memory note describing the commit it had just made. The agent meant to *read* the transcript acted on what the transcript said. > > This looks like the other half of #529. That PR isolated the summarizer from MCP config with `--strict-mcp-config`, but that flag only blocks MCP tools — the built-in ones (Bash, Edit, Write) stay enabled, so command execution is still possible.  **Expected:** the summarizer should only read the transcript and write a text summary. It should not be able to run commands the transcript happens to contain.  **Suggested fix** (Claude's) — the summarizer is text-in / text-out, so it needs no tools. Adding `--tools ""`

- **Issue #552** (2026-08-10): **OpenCode plugin installation silently fails**
  *Symptoms*: ### Description  opencode version 1.15.10  when trying to install plugin it says "Package has no TUI target to load in this app."  guessing its related to latest opencode plugin model updates  ### Steps to reproduce  1. install memsearch latest 2. open opencode latest 3. install plugin 4. receive error  ### Error output / logs  ```shell "Package has no TUI target to load in this app" ```  ### memsearch version  memsearch, version 0.4.4  ### Operating system  Linux  ### Python version  Python 3.12.3
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. I checked this against OpenCode 1.15.10 with a clean temporary config directory. Installing from the CLI succeeds for me:  ```sh opencode plugin @zilliz/memsearch-opencode --global --force ```  The installer reports a detected server target and writes the plugin entry to `opencode.jsonc`:  ```json {   "plugin": ["@zilliz/memsearch-opencode"] } ```  I also found the exact message `Package has no TUI target to load in this app` in OpenCode 1.15.10. It appears to come from the TUI plugin-install flow after package installation, when OpenCode tries to hot-load a TUI target into the current app. The memsearch plugin is a runtime/server plugin, not a TUI UI extension, so having no TUI target is expected. The confusing part is that the TUI message can look like a failed install even though the runtime plugin may have been added to config successfully.  Could you confirm two details?  1. Did you install from inside the OpenCode TUI plugin command/palette, or with the CLI
  > thx for checking 1. installed from UI gives that error, while installing from configuration file is fine (ie no error) 2. yes it worked i installed with uv memsearch and configured with opencode.jsonc  seems its working but ux could be quite improved
  > This issue has been automatically marked as stale because it has not had recent activity. It will be closed in 14 days if no further activity occurs. Feel free to reopen if this is still relevant.

- **Issue #539** (2026-05-12): **duplicate primary keys are not allowed in the same batch: invalid parameter**
  *Symptoms*: ### Description  When i do `memsearch index .` I got following error  2026-05-12 15:14:21,946 [ERROR][handler]: RPC error: [upsert_rows], <MilvusException: (code=1100, message=duplicate primary keys are not allowed in the same batch: invalid parameter)>, <Time:{'RPC start': '2026-05-12 15:14:20.392436', 'RPC error': '2026-05-12 15:14:21.946427'}> (decorators.py:140)  ### Steps to reproduce  When i run `memsearch index .` in  my code repo i got the error after few minutes of indexing.   ### Error output / logs  ```shell Traceback (most recent call last):   File "/home/talha/venv/lib/python3.12/site-packages/memsearch/core.py", line 100, in index     n = await self._index_file(f, force=force)         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/home/talha/venv/lib/python3.12/site-packages/memsearch/core.py", line 159, in _index_file     return await self._embed_and_store(chunks)            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/home/talha/venv/lib/python3.12/site-packages/memsearch/core.py", line 194, in _embed_and_store     return self._store.upsert(records)            ^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/home/talha/venv/lib/python3.12/site-packages/memsearch/store.py", line 133, in upsert     result = self._client.upsert(              ^^^^^^^^^^^^^^^^^^^^   File "/home/talha/venv/lib/python3.12/site-packages/pymilvus/milvus_client/milvus_client.py", line 284, in upsert     raise ex from ex   File "/home/talha/venv/lib/python3.12/site-packages/pymilvus/milvus_client/m
  **Post-Mortem & Fix Analysis**:
  > Closing, because look like its just a warning

- **Issue #526** (2026-05-06): **_split_large_section emits oversized chunks when individual lines exceed max_chunk_size**
  *Symptoms*: ### Description    Bug: _split_large_section emits oversized chunks when individual lines exceed max_chunk_size                                                                                                                                                                                       Summary                                                                                                                                                                                                                                                                                                                                                                 Three code paths in _split_large_section call _emit() without checking whether the content exceeds max_chunk_size. When a file contains lines longer than max_chunk_size (common    in markdown tables exported from Word documents), those lines are emitted as single oversized chunks, causing downstream embedding failures.                                                                                                                                                                                       Reproduction                                                                                                                                                                          Index any markdown file that contains a single line longer than max_chunk_size. For example, a markdown table row of 10,000+ characters (common in documents conv

- **Issue #352** (2026-04-16): **In 0.3.0, the try/except block wrapping the `_on_change` file event callback in `core.py` was silently removed.**
  *Symptoms*: ### Description  In 0.3.0, the try/except block wrapping the `_on_change` file event callback in `core.py` was silently removed. In 0.2.3, embedding errors during watch events were caught, logged, and skipped so the watcher kept running. In 0.3.0, those same errors propagate uncaught and crash the watcher process.  **0.2.3 (working):** ```python def _on_change(event_type: str, file_path: Path) -> None:     try:         if event_type == "deleted":             self._store.delete_by_source(str(file_path))             summary = f"Removed chunks for {file_path}"         else:             n = loop.run_until_complete(self.index_file(file_path))             summary = f"Indexed {n} chunks from {file_path}"         logger.info(summary)         if on_event is not None:             on_event(event_type, summary, file_path)     except Exception:         logger.exception("Failed to index %s on change, skipping", file_path) ``` 0.3.0: The try/except is gone — exceptions propagate to the caller and crash the watcher. Any transient or file-specific embedding error (network blip, model 500, rate limit) now terminates the watcher entirely instead of logging the error and continuing.  ### Steps to reproduce  1. Configure memsearch with an Ollama embedding provider 2. Have any file in the watched directory that causes the embedding provider to raise an exception (e.g., an Ollama 500 error for a specific file) 3. Run memsearch watch 4. The watcher crashes on first encounter of that file instead of 

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

### Incident Patch 1: `98a07ccc` (2026-09-21)
**Commit Message**: fix: prevent read paths from creating missing collections (#760)

Signed-off-by: Cheney Zhang <[REDACTED_EMAIL]>

**File**: `plugins/dsh/index.js` (modified, +18/-7)
```diff
@@ -340,8 +340,7 @@ function milvusUriFlag(milvusUri) {
 
 /**
  * Run one bounded memsearch search over the project collection.
- * @returns the parsed result array, or null on any failure (caller treats
- *          null as "no injectable context" and stays a no-op).
+ * @returns parsed chunks plus an explicit error when the CLI call fails.
  */
 function runSearch(memsearchCmd, query, collection, projectDir, milvusUri) {
   return new Promise((resolve) => {
@@ -354,13 +353,18 @@ function runSearch(memsearchCmd, query, collection, projectDir, milvusUri) {
       'bash',
       ['-c', command],
       { cwd: projectDir, timeout: SEARCH_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 },
-      (error, stdout) => {
-        if (error) return resolve(null)
+      (error, stdout, stderr) => {
+        if (error) {
+          const detail = String(stderr || error.message || 'unknown error').trim()
+          return resolve({ chunks: null, error: detail })
+        }
         try {
           const chunks = JSON.parse(stdout)
-          resolve(Array.isArray(chunks) ? chunks : null)
+          resolve(Array.isArray(chunks)
+            ? { chunks, error: '' }
+            : { chunks: null, error: 'invalid non-array JSON output' })
         } catch {
-          resolve(null)
+          resolve({ chunks: null, error: 'invalid JSON output' })
         }
       },
     )
@@ -1306,7 +1310,14 @@ export function apply(ctx, config = {}) {
 
       const collection = resolveCollection(projectDir)
       if (!collection) return decision
-      const chunks = await runSearch(memsearchCmd, question, collection, projectDir, opts.milvusUri)
+      const { chunks, error } = await runSearch(
+        memsearchCmd,
+        question,
+        collection,
+        projectDir,
+        opts.milvusUri,
+      )
+      if (error) ctx.logger.warn(`[memsearch] search failed: ${error}`)
       if (!chunks || chunks.length === 0) return decision
 
       const text = renderMemoryBlock(chunks)
```

**File**: `plugins/dsh/tests/index.test.js` (modified, +15/-2)
```diff
@@ -6,7 +6,7 @@ import os from 'node:os'
 
 import { detectDshCmd, summarizeTurn, apply, resolveSummarizeMode, renderTurn, captureExists, writeCapture, memsearchDirFor, listSkillCandidates, resolveSkillInstallTarget, sanitizeSurrogates } from '../index.js'
 
-async function withInjectionFixture(searchResults, assertion, oldCore = false) {
+async function withInjectionFixture(searchResults, assertion, oldCore = false, searchError = '') {
   const root = fs.mkdtempSync(`${os.tmpdir()}/memsearch-inject-`)
   const projectDir = `${root}/project`
   const memoryDir = `${root}/state/memory`
@@ -28,6 +28,7 @@ async function withInjectionFixture(searchResults, assertion, oldCore = false) {
       'fi\n' +
       'if [ "$1" = "config" ]; then exit 0; fi\n' +
       'if [ "$1" = "search" ]; then\n' +
+      '  if [ -n "$MEMSEARCH_TEST_SEARCH_ERROR" ]; then echo "$MEMSEARCH_TEST_SEARCH_ERROR" >&2; exit 1; fi\n' +
       '  cat "$MEMSEARCH_TEST_RESULT"\n' +
       '  exit 0\n' +
       'fi\n' +
@@ -52,8 +53,9 @@ async function withInjectionFixture(searchResults, assertion, oldCore = false) {
       const { apply } = await import(process.env.MEMSEARCH_PLUGIN_URL)
       const listeners = {}
       const registeredSkills = []
+      const warnings = []
       const ctx = {
-        logger: { warn: () => {}, debug: () => {} },
+        logger: { warn: (message) => warnings.push(message), debug: () => {} },
         skills: { register: (skill) => registeredSkills.push(skill) },
         on: (name, listener) => { listeners[name] = listener },
       }
@@ -76,6 +78,7 @@ async function withInjectionFixture(searchResults, assertion, oldCore = false) {
         unchanged: result === decision,
         result,
         error,
+        warnings,
         registeredSkillNames: registeredSkills.map((skill) => skill.name),
       }))
     `
@@ -92,6 +95,7 @@ async function withInjectionFixture(searchResults, assertion, oldCore = false) {
         MEMSEARCH_TEST_PROJECT: projectDir,
         MEMSEARCH_TEST_RESULT: resultFile,
         MEMSEARCH_TEST_OLD_CORE: oldCore ? '1' : '0',
+        MEMSEARCH_TEST_SEARCH_ERROR: searchError,
       },
     })
     await assertion({ ...JSON.parse(stdout), callLog })
@@ -1003,6 +1007,15 @@ test('apply: empty search result keeps pre-step context unchanged while recall s
   })
 })
 
+test('apply: search failure is explicit while injection remains nonblocking', async () => {
+  await withInjectionFixture([], async ({ unchanged, warnings, registeredSkillNames }) => {
+    assert.equal(unchanged, true)
+    assert.ok(warnings.some((message) => message.includes('search failed')))
+    assert.ok(warnings.some((message) => message.includes('Collection missing')))
+    assert.ok(registeredSkillNames.includes('memory-recall'))
+  }, false, 'Collection missing')
+})
+
 test('apply: returned chunks inject one retrieved-context marker with plugin source metadata', async () => {
   await withInjectionFixture(
     [{ source: 'memory/2026-09-07.md:4', content: 'The release marker is PINE-NEBULA-8643.' }],
```

**File**: `plugins/openclaw/index.js` (modified, +24/-4)
```diff
@@ -190,6 +190,11 @@ var index_default = {
     async function runCmd(argv, opts) {
       return api.runtime.system.runCommandWithTimeout(argv, opts || {});
     }
+    function commandFailure(action, result) {
+      if (result.code === 0) return null;
+      const detail = (result.stderr || result.stdout || "unknown error").trim();
+      return `${action} failed (exit ${result.code ?? "unknown"}): ${detail}`;
+    }
     let _memsearchCmd = null;
     async function getMemsearchCmd() {
       if (_memsearchCmd) return _memsearchCmd;
@@ -353,6 +358,10 @@ var index_default = {
                 ],
                 { timeoutMs: 3e4, cwd: projectDir }
               );
+              const failure = commandFailure("Search", result);
+              if (failure) {
+                return { content: [{ type: "text", text: failure }] };
+              }
               const output = result.stdout || result.stderr || "No results";
               return { content: [{ type: "text", text: output }] };
             } catch (e) {
@@ -396,6 +405,10 @@ var index_default = {
                 ],
                 { timeoutMs: 15e3, cwd: projectDir }
               );
+              const failure = commandFailure("Expand", result);
+              if (failure) {
+                return { content: [{ type: "text", text: failure }] };
+              }
               const output = result.stdout || result.stderr || "No content";
               return { content: [{ type: "text", text: output }] };
             } catch (e) {
@@ -669,10 +682,15 @@ ${anchor}${cleanSummary}
             ],
             { timeoutMs: 3e4, cwd: projectDir }
           );
+          const failure = commandFailure("Search", result);
+          if (failure) throw new Error(failure);
           if (result.stdout) process.stdout.write(result.stdout);
           if (result.stderr) process.stderr.write(result.stderr);
         } catch (e) {
-          console.error(`Search failed: ${e.message}`);
+          const message = String(e.message).startsWith("Search failed") ? String(e.message) : `Search failed: ${e.message}`;
+          console.error(message);
+          if (message === e.message) throw e;
+          throw new Error(message);
         }
       });
       cmd.command("index [directory]").description("Index memory files").action(async (directory) => {
@@ -722,9 +740,11 @@ ${anchor}${cleanSummary}
             ["bash", "-c", `${memsearch} stats --default-collection ${collection}`],
             { timeoutMs: 1e4, cwd: projectDir }
           );
-          if (result.stdout) process.stdout.write(result.stdout);
-        } catch {
-          console.log("Stats: (unavailable \u2014 collection may not exist yet)");
+          const failure = commandFailure("Stats", result);
+          if (failure) console.log(failure);
+          else if (result.stdout) process.stdout.write(result.stdout);
+        } catch (e) {
+          console.log(`Stats failed: ${e.message}`);
         }
       });
     }, {
```

**File**: `plugins/openclaw/index.test.ts` (modified, +78/-0)
```diff
@@ -193,6 +193,84 @@ test("memory search passes the derived collection as a project-scoped default",
   }
 });
 
+test("tool, CLI search, and status expose nonzero memsearch exits", async () => {
+  const projectDir = mkdtempSync(join(tmpdir(), "memsearch-openclaw-errors-"));
+  const previousHome = process.env.HOME;
+  const previousNoWatch = process.env.MEMSEARCH_NO_WATCH;
+  const tools = new Map<string, (ctx: unknown) => any>();
+  const actions = new Map<string, (...args: any[]) => Promise<void>>();
+  const output: string[] = [];
+  const originalLog = console.log;
+  process.env.HOME = projectDir;
+  process.env.MEMSEARCH_NO_WATCH = "1";
+
+  function command(name: string): any {
+    return {
+      command,
+      description() { return this; },
+      option() { return this; },
+      action(fn: (...args: any[]) => Promise<void>) {
+        actions.set(name, fn);
+        return this;
+      },
+    };
+  }
+
+  try {
+    console.log = (...args: unknown[]) => output.push(args.join(" "));
+    plugin.register({
+      logger: {},
+      pluginConfig: {},
+      runtime: {
+        system: {
+          async runCommandWithTimeout(argv: string[]) {
+            const rendered = argv.join(" ");
+            if (argv[0] === "which") return { stdout: "/tmp/memsearch\n", stderr: "", code: 0 };
+            if (argv[0] === "bash" && argv[1]?.endsWith("derive-collection.sh")) {
+              return { stdout: "ms_error_test\n", stderr: "", code: 0 };
+            }
+            if (rendered.includes("config get")) return { stdout: "", stderr: "", code: 0 };
+            if (rendered.includes(" search ")) {
+              return { stdout: "", stderr: "Collection missing\n", code: 1 };
+            }
+            if (rendered.includes(" stats ")) {
+              return { stdout: "", stderr: "Permission denied\n", code: 1 };
+            }
+            return { stdout: "", stderr: "", code: 0 };
+          },
+        },
+      },
+      registerTool(factory: (ctx: unknown) => any, metadata: { name: string }) {
+        tools.set(metadata.name, factory);
+      },
+      registerCli(callback: (ctx: any) => void) {
+        callback({ program: { command } });
+      },
+      on() {},
+    });
+
+    const memorySearch = tools.get("memory_search")?.({ agentId: "test", workspaceDir: projectDir });
+    const toolResult = await memorySearch.execute("call-1", { query: "release" });
+    assert.match(toolResult.content[0].text, /Search failed \(exit 1\): Collection missing/);
+
+    const cliSearch = actions.get("search <query>");
+    assert.ok(cliSearch);
+    await assert.rejects(() => cliSearch("release", {}), /Search failed \(exit 1\): Collection missing/);
+
+    const status = actions.get("status");
+    assert.ok(status);
+    await status();
+    assert.ok(output.includes("Stats failed (exit 1): Permission denied"));
+  } finally {
+    console.log = originalLog;
+    if (previousHome === undefined) delete process.env.HOME;
+    else process.env.HOME = previousHome;
+    if (previousNoWatch === undefined) delete process.env.MEMSEARCH_NO_WATCH;
+    else process.env.MEMSEARCH_NO_WATCH = previousNoWatch;
+    rmSync(projectDir, { recursive: true, force: true });
+  }
+});
+
 test("status reports the resolved collection instead of the derived fallback", async () => {
   const projectDir = mkdtempSync(join(tmpdir(), "memsearch-openclaw-status-"));
   const previousHome = process.env.HOME;
```

**File**: `plugins/openclaw/index.ts` (modified, +30/-4)
```diff
@@ -294,6 +294,15 @@ export default {
       return api.runtime.system.runCommandWithTimeout(argv, opts || {});
     }
 
+    function commandFailure(
+      action: string,
+      result: { stdout: string; stderr: string; code: number | null }
+    ): string | null {
+      if (result.code === 0) return null;
+      const detail = (result.stderr || result.stdout || "unknown error").trim();
+      return `${action} failed (exit ${result.code ?? "unknown"}): ${detail}`;
+    }
+
     // --- Lazy-cached memsearch CLI detection ---
     let _memsearchCmd: string | null = null;
 
@@ -502,6 +511,10 @@ export default {
                 ],
                 { timeoutMs: 30000, cwd: projectDir }
               );
+              const failure = commandFailure("Search", result);
+              if (failure) {
+                return { content: [{ type: "text" as const, text: failure }] };
+              }
               const output = result.stdout || result.stderr || "No results";
               return { content: [{ type: "text" as const, text: output }] };
             } catch (e: any) {
@@ -555,6 +568,10 @@ export default {
                 ],
                 { timeoutMs: 15000, cwd: projectDir }
               );
+              const failure = commandFailure("Expand", result);
+              if (failure) {
+                return { content: [{ type: "text" as const, text: failure }] };
+              }
               const output = result.stdout || result.stderr || "No content";
               return { content: [{ type: "text" as const, text: output }] };
             } catch (e: any) {
@@ -898,10 +915,17 @@ export default {
               ],
               { timeoutMs: 30000, cwd: projectDir }
             );
+            const failure = commandFailure("Search", result);
+            if (failure) throw new Error(failure);
             if (result.stdout) process.stdout.write(result.stdout);
             if (result.stderr) process.stderr.write(result.stderr);
           } catch (e: any) {
-            console.error(`Search failed: ${e.message}`);
+            const message = String(e.message).startsWith("Search failed")
+              ? String(e.message)
+              : `Search failed: ${e.message}`;
+            console.error(message);
+            if (message === e.message) throw e;
+            throw new Error(message);
           }
         });
 
@@ -958,9 +982,11 @@ export default {
               ["bash", "-c", `${memsearch} stats --default-collection ${collection}`],
               { timeoutMs: 10000, cwd: projectDir }
             );
-            if (result.stdout) process.stdout.write(result.stdout);
-          } catch {
-            console.log("Stats: (unavailable — collection may not exist yet)");
+            const failure = commandFailure("Stats", result);
+            if (failure) console.log(failure);
+            else if (result.stdout) process.stdout.write(result.stdout);
+          } catch (e: any) {
+            console.log(`Stats failed: ${e.message}`);
           }
         });
     }, {
```

**File**: `plugins/opencode/index.test.ts` (modified, +43/-0)
```diff
@@ -67,6 +67,49 @@ test("plugin rejects a core without integration-default support before data acti
   }
 });
 
+test("memory search reports a nonzero memsearch exit explicitly", async () => {
+  const root = mkdtempSync(join(tmpdir(), "memsearch-opencode-search-error-"));
+  const bin = join(root, "bin");
+  const project = join(root, "project");
+  const previousPath = process.env.PATH;
+  const previousHome = process.env.HOME;
+  const previousNoWatch = process.env.MEMSEARCH_NO_WATCH;
+  try {
+    mkdirSync(bin);
+    mkdirSync(project);
+    const fakeMemsearch = join(bin, "memsearch");
+    writeFileSync(
+      fakeMemsearch,
+      "#!/usr/bin/env bash\n" +
+        "if [ \"$1\" = \"config\" ]; then exit 0; fi\n" +
+        "if [ \"$1\" = \"search\" ]; then echo 'Collection missing' >&2; exit 1; fi\n" +
+        "exit 0\n",
+      "utf-8"
+    );
+    chmodSync(fakeMemsearch, 0o755);
+    process.env.PATH = `${bin}:/usr/bin:/bin`;
+    process.env.HOME = root;
+    process.env.MEMSEARCH_NO_WATCH = "1";
+
+    const mod = await import("./index.ts");
+    const registered = await mod.default({ project: {}, directory: project, worktree: project } as any);
+    const output = await registered.tool.memory_search.execute(
+      { query: "release" },
+      { directory: project }
+    );
+
+    assert.match(output, /Search failed \(exit 1\): Collection missing/);
+  } finally {
+    if (previousPath === undefined) delete process.env.PATH;
+    else process.env.PATH = previousPath;
+    if (previousHome === undefined) delete process.env.HOME;
+    else process.env.HOME = previousHome;
+    if (previousNoWatch === undefined) delete process.env.MEMSEARCH_NO_WATCH;
+    else process.env.MEMSEARCH_NO_WATCH = previousNoWatch;
+    rmSync(root, { recursive: true, force: true });
+  }
+});
+
 test("appends memory context when no system entry exists yet", () => {
   const result = mergeSystemMemoryContext(undefined, `${MEMSEARCH_SYSTEM_MARKER} ctx-a`);
   assert.deepEqual(result, [`${MEMSEARCH_SYSTEM_MARKER} ctx-a`]);
```

**File**: `plugins/opencode/index.ts` (modified, +11/-0)
```diff
@@ -183,6 +183,13 @@ function wakeMaintenance(projectDir: string, memsearchDir: string): void {
   );
 }
 
+function commandFailure(action: string, result: ReturnType<typeof spawnSync>): string | null {
+  if (result.error) return `${action} failed: ${result.error.message}`;
+  if (result.status === 0) return null;
+  const detail = String(result.stderr || result.stdout || result.signal || "unknown error").trim();
+  return `${action} failed (exit ${result.status ?? "unknown"}): ${detail}`;
+}
+
 // ---------------------------------------------------------------------------
 // Plugin entry
 // ---------------------------------------------------------------------------
@@ -265,6 +272,8 @@ const MemsearchPlugin: Plugin = async ({ project, directory, worktree }) => {
               ],
               { cwd: dir, encoding: "utf-8", timeout: 30000 }
             );
+            const failure = commandFailure("Search", result);
+            if (failure) return failure;
             return result.stdout || result.stderr || "No results found.";
           } catch (e: any) {
             return `Search failed: ${e.message}`;
@@ -294,6 +303,8 @@ const MemsearchPlugin: Plugin = async ({ project, directory, worktree }) => {
               ],
               { cwd: dir, encoding: "utf-8", timeout: 15000 }
             );
+            const failure = commandFailure("Expand", result);
+            if (failure) return failure;
             return result.stdout || result.stderr || "No content found.";
           } catch (e: any) {
             return `Expand failed: ${e.message}`;
```

**File**: `src/memsearch/cli.py` (modified, +13/-0)
```diff
@@ -30,6 +30,7 @@
     resolve_index_state_path,
 )
 from .io import read_utf8_text_replace
+from .store import CollectionNotFoundError
 
 try:
     from pymilvus.exceptions import MilvusException
@@ -405,6 +406,9 @@ def search(
                     click.echo(f"  ... [truncated, run 'memsearch expand {chunk_hash}' for full content]")
                 else:
                     click.echo(content)
+    except CollectionNotFoundError as e:
+        click.echo(f"Error: {e}", err=True)
+        raise SystemExit(1) from None
     except MilvusException as e:
         click.echo(f"Milvus error (code {e.code}): {e.message}", err=True)
         raise SystemExit(1) from None
@@ -546,6 +550,9 @@ def expand(
                 click.echo(f"Session: {anchor['session']}  Turn: {anchor['turn']}")
                 click.echo(f"Transcript: {anchor['transcript']}")
             click.echo(f"\n{expanded}")
+    except CollectionNotFoundError as e:
+        click.echo(f"Error: {e}", err=True)
+        raise SystemExit(1) from None
     except MilvusException as e:
         click.echo(f"Milvus error (code {e.code}): {e.message}", err=True)
         raise SystemExit(1) from None
@@ -812,6 +819,9 @@ def compact(
             click.echo(f"No chunks matched source: {normalized_source}")
         else:
             click.echo("No chunks to compact.")
+    except CollectionNotFoundError as e:
+        click.echo(f"Error: {e}", err=True)
+        raise SystemExit(1) from None
     except MilvusException as e:
         click.echo(f"Milvus error (code {e.code}): {e.message}", err=True)
         raise SystemExit(1) from None
@@ -905,6 +915,9 @@ def stats(
         )
         count = store.count()
         click.echo(f"Total indexed chunks: {count}")
+    except CollectionNotFoundError as e:
+        click.echo(f"Error: {e}", err=True)
+        raise SystemExit(1) from None
     except MilvusException as e:
         click.echo(f"Milvus error (code {e.code}): {e.message}", err=True)
         raise SystemExit(1) from None
```

---

### Incident Patch 2: `a1a6d09a` (2026-09-20)
**Commit Message**: fix: search growing rows on Milvus Server (#757)

Signed-off-by: Cheney Zhang <[REDACTED_EMAIL]>

**File**: `docs/cli.md` (modified, +1/-1)
```diff
@@ -784,7 +784,7 @@ Total indexed chunks: 87
 
 ### Notes
 
-- **Stats may lag on remote Milvus Server.** The `get_collection_stats()` API on a remote Milvus Server may return stale counts immediately after an upsert. Stats are updated after segment flush and compaction. Search results are always up to date.
+- **Stats may lag on remote Milvus Server.** The `get_collection_stats()` API on a remote Milvus Server may return stale counts immediately after an upsert. Stats are updated after segment flush and compaction. A zero metadata count does not prevent search from checking growing-only collections. Once metadata reports sealed rows, search keeps Milvus's existing hybrid-search consistency, so newly growing rows in a mixed collection may still have a brief visibility delay.
 
 ---
 
```

**File**: `docs/platforms/claude-code/troubleshooting.md` (modified, +1/-1)
```diff
@@ -216,4 +216,4 @@ After the first download, the model is cached at `~/.cache/huggingface/hub/` and
 | Skill never triggers automatically | Manual `/memory-recall` test | Ensure prompt >= 10 chars; memsearch in PATH |
 | First session hangs | ONNX model downloading | Pre-download with warmup command |
 | Session summaries missing | Check `claude` CLI availability | Verify `claude` is in PATH |
-| Stale stats count | Normal for Milvus Server | Stats update after flush/compaction; search is always up-to-date |
+| Stale stats count | Normal for Milvus Server | Stats update after flush/compaction; a zero count no longer blocks growing-only search, while new rows in mixed collections still follow Milvus search consistency |
```

**File**: `src/memsearch/store.py` (modified, +51/-4)
```diff
@@ -4,6 +4,7 @@
 
 import importlib.metadata
 import logging
+import operator
 from pathlib import Path
 from typing import Any, ClassVar
 
@@ -23,6 +24,19 @@ def _milvus_lite_major() -> int | None:
         return None
 
 
+def _non_negative_integer(value: Any) -> int:
+    """Return an integer-protocol value without accepting bools or truncation."""
+    if isinstance(value, bool):
+        raise ValueError("boolean values are not row counts")
+    try:
+        result = operator.index(value)
+    except TypeError as exc:
+        raise ValueError("row counts must be integers") from exc
+    if result < 0:
+        raise ValueError("row counts must be non-negative")
+    return result
+
+
 def _local_open_error_message(exc: Exception, resolved: str, major: int | None) -> str:
     """Describe a failed local Milvus Lite open without asserting an unproven cause.
 
@@ -189,9 +203,10 @@ def search(
         """Hybrid search: dense vector + BM25 full-text with RRF reranking."""
         from pymilvus import AnnSearchRequest, RRFRanker
 
-        # BM25 crashes on empty collections (avgdl=0 → NaN). See #306.
-        stats = self._client.get_collection_stats(self._collection)
-        if int(stats.get("row_count", 0)) == 0:
+        # BM25 crashes on empty collections (avgdl=0 → NaN). See #306. Remote
+        # Milvus metadata omits growing rows, so confirm zero metadata counts
+        # with a strong query before treating the collection as empty.
+        if self._collection_is_empty():
             return []
 
         req_kwargs: dict[str, Any] = {}
@@ -231,6 +246,38 @@ def search(
         max_rrf = len(reqs) / (rrf_k + 1)
         return [{**hit["entity"], "score": hit["distance"] / max_rrf} for hit in results[0]]
 
+    def _collection_is_empty(self) -> bool:
+        """Return whether no sealed or growing rows exist in the collection."""
+        stats = self._client.get_collection_stats(self._collection)
+        try:
+            metadata_count = _non_negative_integer(stats["row_count"])
+        except (KeyError, TypeError, ValueError) as exc:
+            raise RuntimeError(
+                f"Milvus returned an invalid metadata count for collection '{self._collection}': {stats!r}"
+            ) from exc
+        if metadata_count > 0:
+            return False
+
+        results = self._client.query(
+            collection_name=self._collection,
+            filter="",
+            output_fields=["count(*)"],
+            consistency_level="Strong",
+        )
+        if not isinstance(results, list) or len(results) != 1:
+            raise RuntimeError(
+                f"Milvus returned an invalid count response for collection '{self._collection}': {results!r}; "
+                "expected exactly one aggregate row"
+            )
+
+        try:
+            row_count = _non_negative_integer(results[0]["count(*)"])
+        except (KeyError, TypeError, ValueError) as exc:
+            raise RuntimeError(
+                f"Milvus returned an invalid count response for collection '{self._collection}': {results!r}"
+            ) from exc
+        return row_count == 0
+
     _QUERY_FIELDS: ClassVar[list[str]] = [
         "content",
         "source",
@@ -287,7 +334,7 @@ def delete_by_hashes(self, hashes: list[str]) -> None:
         )
 
     def count(self) -> int:
-        """Return total number of stored chunks."""
+        """Return the metadata row count, which may lag on Milvus Server."""
         stats = self._client.get_collection_stats(self._collection)
         return stats.get("row_count", 0)
 
```

**File**: `tests/test_store.py` (modified, +152/-0)
```diff
@@ -4,6 +4,7 @@
 import sys
 import time
 from pathlib import Path
+from unittest.mock import Mock
 
 import pytest
 
@@ -49,6 +50,157 @@ def test_upsert_and_search(store: MilvusStore):
     assert results[0]["content"] == "Hello world"
 
 
+def test_search_uses_metadata_fast_path_without_aggregate(store: MilvusStore, monkeypatch: pytest.MonkeyPatch):
+    stats = Mock(return_value={"row_count": 1})
+    aggregate = Mock(side_effect=AssertionError("aggregate query must not run"))
+    hybrid_search = Mock(return_value=[[]])
+    monkeypatch.setattr(store._client, "get_collection_stats", stats)
+    monkeypatch.setattr(store._client, "query", aggregate)
+    monkeypatch.setattr(store._client, "hybrid_search", hybrid_search)
+
+    assert store.search([1.0, 0.0, 0.0, 0.0], query_text="sealed") == []
+    stats.assert_called_once_with(store._collection)
+    aggregate.assert_not_called()
+    hybrid_search.assert_called_once()
+
+
+def test_search_empty_collection_uses_strong_count(store: MilvusStore, monkeypatch: pytest.MonkeyPatch):
+    aggregate = Mock(return_value=[{"count(*)": 0}])
+    hybrid_search = Mock(side_effect=AssertionError("empty collection must not be searched"))
+    monkeypatch.setattr(store._client, "get_collection_stats", Mock(return_value={"row_count": 0}))
+    monkeypatch.setattr(store._client, "query", aggregate)
+    monkeypatch.setattr(store._client, "hybrid_search", hybrid_search)
+
+    assert store.search([1.0, 0.0, 0.0, 0.0], query_text="empty") == []
+    aggregate.assert_called_once_with(
+        collection_name=store._collection,
+        filter="",
+        output_fields=["count(*)"],
+        consistency_level="Strong",
+    )
+    hybrid_search.assert_not_called()
+
+
+def test_search_growing_rows_continue_after_strong_count(store: MilvusStore, monkeypatch: pytest.MonkeyPatch):
+    aggregate = Mock(return_value=[{"count(*)": 1}])
+    hybrid_search = Mock(return_value=[[]])
+    monkeypatch.setattr(store._client, "get_collection_stats", Mock(return_value={"row_count": 0}))
+    monkeypatch.setattr(store._client, "query", aggregate)
+    monkeypatch.setattr(store._client, "hybrid_search", hybrid_search)
+
+    assert store.search([1.0, 0.0, 0.0, 0.0], query_text="growing") == []
+    aggregate.assert_called_once_with(
+        collection_name=store._collection,
+        filter="",
+        output_fields=["count(*)"],
+        consistency_level="Strong",
+    )
+    hybrid_search.assert_called_once()
+
+
+def test_search_propagates_strong_count_failure(store: MilvusStore, monkeypatch: pytest.MonkeyPatch):
+    failure = RuntimeError("strong count failed")
+    aggregate = Mock(side_effect=failure)
+    hybrid_search = Mock()
+    monkeypatch.setattr(store._client, "get_collection_stats", Mock(return_value={"row_count": 0}))
+    monkeypatch.setattr(store._client, "query", aggregate)
+    monkeypatch.setattr(store._client, "hybrid_search", hybrid_search)
+
+    with pytest.raises(RuntimeError, match="strong count failed") as exc_info:
+        store.search([1.0, 0.0, 0.0, 0.0], query_text="failure")
+
+    assert exc_info.value is failure
+    hybrid_search.assert_not_called()
+
+
+def test_search_propagates_metadata_failure(store: MilvusStore, monkeypatch: pytest.MonkeyPatch):
+    failure = RuntimeError("metadata failed")
+    stats = Mock(side_effect=failure)
+    aggregate = Mock()
+    hybrid_search = Mock()
+    monkeypatch.setattr(store._client, "get_collection_stats", stats)
+    monkeypatch.setattr(store._client, "query", aggregate)
+    monkeypatch.setattr(store._client, "hybrid_search", hybrid_search)
+
+    with pytest.raises(RuntimeError, match="metadata failed") as exc_info:
+        store.search([1.0, 0.0, 0.0, 0.0], query_text="failure")
+
+    assert exc_info.value is failure
+    aggregate.assert_not_called()
+    hybrid_search.assert_not_called()
+
+
+@pytest.mark.parametrize(
+    "response",
+    [
+        [],
+        [
+            {},
+        ],
+        [{"count(*)": "invalid"}],
+        [{"count(*)": False}],
+        [{"count(*)": 0.5}],
+        [{"count(*)": -0.5}],
+        [{"count(*)": -1}],
+        [{"count(*)": 0}, {"count(*)": 9}],
+    ],
+)
+def test_search_rejects_invalid_strong_count_response(
+    store: MilvusStore,
+    monkeypatch: pytest.MonkeyPatch,
+    response: list[dict[str, object]],
+):
+    aggregate = Mock(return_value=response)
+    hybrid_search = Mock()
+    monkeypatch.setattr(store._client, "get_collection_stats", Mock(return_value={"row_count": 0}))
+    monkeypatch.setattr(store._client, "query", aggregate)
+    monkeypatch.setattr(store._client, "hybrid_search", hybrid_search)
+
+    with pytest.raises(RuntimeError, match="Milvus returned") as exc_info:
+        store.search([1.0, 0.0, 0.0, 0.0], query_text="invalid")
+
+    assert store._collection in str(exc_info.value)
+    aggregate.assert_called_once()
+    hybrid_search.assert_not_called()
+
+
+@pytest.mark.parametrize(
+    "stats", [{}, {"row_count": F
```

**File**: `tests/test_store_server_integration.py` (added, +98/-0)
```diff
@@ -0,0 +1,98 @@
+"""Controlled Milvus Server coverage for growing-row search visibility.
+
+Run this test explicitly against an isolated server. It is skipped unless
+``MEMSEARCH_TEST_MILVUS_URI`` is set. The test creates and removes only
+collections under ``MEMSEARCH_TEST_COLLECTION_PREFIX``.
+"""
+
+from __future__ import annotations
+
+import os
+import uuid
+from collections.abc import Callable, Iterator
+
+import pytest
+
+from memsearch.store import MilvusStore
+
+SERVER_URI = os.environ.get("MEMSEARCH_TEST_MILVUS_URI", "")
+COLLECTION_PREFIX = os.environ.get("MEMSEARCH_TEST_COLLECTION_PREFIX", f"memsearch_it_{uuid.uuid4().hex[:12]}")
+
+pytestmark = pytest.mark.skipif(not SERVER_URI, reason="MEMSEARCH_TEST_MILVUS_URI is not set")
+
+
+def _row(chunk_hash: str, content: str, vector: list[float]) -> dict[str, object]:
+    return {
+        "embedding": vector,
+        "content": content,
+        "source": f"{chunk_hash}.md",
+        "heading": "Integration",
+        "chunk_hash": chunk_hash,
+        "heading_level": 1,
+        "start_line": 1,
+        "end_line": 1,
+    }
+
+
+def _strong_count(store: MilvusStore) -> int:
+    result = store._client.query(
+        collection_name=store._collection,
+        filter="",
+        output_fields=["count(*)"],
+        consistency_level="Strong",
+    )
+    return int(result[0]["count(*)"]) if result else 0
+
+
+@pytest.fixture
+def server_stores() -> Iterator[Callable[[str], MilvusStore]]:
+    stores: list[MilvusStore] = []
+
+    def create(suffix: str) -> MilvusStore:
+        store = MilvusStore(uri=SERVER_URI, collection=f"{COLLECTION_PREFIX}_{suffix}", dimension=4)
+        stores.append(store)
+        return store
+
+    yield create
+
+    if stores:
+        client = stores[-1]._client
+        try:
+            for store in reversed(stores):
+                if client.has_collection(store._collection):
+                    client.drop_collection(store._collection)
+        finally:
+            stores[-1].close()
+
+
+def test_server_empty_growing_sealed_and_mixed_visibility(server_stores):
+    empty = server_stores("empty")
+    assert empty.count() == 0
+    assert _strong_count(empty) == 0
+    assert empty.search([1.0, 0.0, 0.0, 0.0], query_text="empty") == []
+
+    growing = server_stores("growing")
+    assert growing.upsert([_row("growing", "growing row visibility", [1.0, 0.0, 0.0, 0.0])]) == 1
+    assert growing.count() == 0, "The controlled server must keep the row in a growing segment"
+    assert _strong_count(growing) == 1
+    assert [result["chunk_hash"] for result in growing.search([1.0, 0.0, 0.0, 0.0], query_text="growing")] == [
+        "growing"
+    ]
+
+    sealed = server_stores("sealed")
+    assert sealed.upsert([_row("sealed", "sealed row visibility", [1.0, 0.0, 0.0, 0.0])]) == 1
+    sealed._client.flush(sealed._collection)
+    assert sealed.count() == 1
+    assert _strong_count(sealed) == 1
+    assert [result["chunk_hash"] for result in sealed.search([1.0, 0.0, 0.0, 0.0], query_text="sealed")] == ["sealed"]
+
+    mixed = server_stores("mixed")
+    assert mixed.upsert([_row("mixed_sealed", "mixed sealed row", [1.0, 0.0, 0.0, 0.0])]) == 1
+    mixed._client.flush(mixed._collection)
+    assert mixed.upsert([_row("mixed_growing", "mixed growing row", [0.9, 0.1, 0.0, 0.0])]) == 1
+    assert mixed.count() == 1
+    assert _strong_count(mixed) == 2
+    assert {result["chunk_hash"] for result in mixed.search([1.0, 0.0, 0.0, 0.0], query_text="mixed")} == {
+        "mixed_sealed",
+        "mixed_growing",
+    }
```

---

### Incident Patch 3: `173f434b` (2026-09-19)
**Commit Message**: fix(codex): filter composite host instruction envelopes (#754)

Signed-off-by: Cheney Zhang <[REDACTED_EMAIL]>

**File**: `plugins/codex/scripts/parse-rollout.sh` (modified, +71/-20)
```diff
@@ -37,6 +37,7 @@ fi
 
 python3 -c '
 import json, sys
+import xml.etree.ElementTree as ET
 
 
 RESPONSE_TEXT_BLOCKS = {
@@ -101,23 +102,64 @@ def response_message(payload):
     }
 
 
+def is_environment_context_envelope(text):
+    """Recognize a complete structured Codex environment wrapper."""
+    stripped = text.strip()
+    if not (stripped.startswith("<environment_context>\n") and stripped.endswith("\n</environment_context>")):
+        return False
+    try:
+        root = ET.fromstring(stripped)
+    except ET.ParseError:
+        return False
+    if root.tag != "environment_context":
+        return False
+
+    def has_nonempty_text(element):
+        return element is not None and element.text is not None and bool(element.text.strip())
+
+    has_stable_context = all(has_nonempty_text(root.find(field)) for field in ("current_date", "timezone"))
+    has_runtime = all(has_nonempty_text(root.find(field)) for field in ("cwd", "shell"))
+    filesystem = root.find("filesystem")
+    workspace_roots = filesystem.find("workspace_roots") if filesystem is not None else None
+    has_workspace = workspace_roots is not None and any(
+        has_nonempty_text(workspace_root) for workspace_root in workspace_roots.findall("root")
+    )
+    return has_stable_context and (has_runtime or has_workspace)
+
+
 def is_host_instruction_envelope(text):
-    """Recognize the exact host wrapper shapes observed in Codex rollouts."""
+    """Recognize complete host wrapper shapes observed in Codex rollouts."""
     stripped = text.strip()
-    if stripped.startswith("# AGENTS.md instructions for "):
-        header, separator, body = stripped.partition("\n\n")
-        return bool(
-            separator
-            and header.startswith("# AGENTS.md instructions for ")
-            and body.startswith("<INSTRUCTIONS>")
-            and body.endswith("</INSTRUCTIONS>")
-        )
+    if stripped == "":
+        return False
+
+    header, separator, body = stripped.partition("\n\n")
+    path_header_prefix = "# AGENTS.md instructions for "
+    path_qualifier = header[len(path_header_prefix) :] if header.startswith(path_header_prefix) else ""
+    is_path_agents_header = (
+        header.startswith(path_header_prefix)
+        and "\n" not in header
+        and "\r" not in header
+        and bool(path_qualifier.strip())
+        and path_qualifier == path_qualifier.strip()
+    )
+    is_agents_header = header == "# AGENTS.md instructions" or is_path_agents_header
+    if is_agents_header:
+        if not separator or not body.startswith("<INSTRUCTIONS>"):
+            return False
+        instructions_end = body.find("</INSTRUCTIONS>")
+        if instructions_end < 0:
+            return False
+        remainder = body[instructions_end + len("</INSTRUCTIONS>") :]
+        if not remainder:
+            return True
+        if not remainder.startswith("\n"):
+            return False
+        return is_environment_context_envelope(remainder[1:])
+
     if stripped.startswith("<user_instructions>\n") and stripped.endswith("\n</user_instructions>"):
         return True
-    if stripped.startswith("<environment_context>\n") and stripped.endswith("\n</environment_context>"):
-        required_fields = ("cwd", "shell", "current_date", "timezone")
-        return all(f"<{field}>" in stripped and f"</{field}>" in stripped for field in required_fields)
-    return False
+    return is_environment_context_envelope(stripped)
 
 
 def find_last_user_message(lines):
@@ -207,20 +249,27 @@ def normalize_record(raw_line):
 
 
 def has_later_user_message(records, index):
-    """Return whether the selected turn contains a later conversational user."""
-    return any(record and record.get("role") == "user" for record in records[index + 1 :])
+    """Find a later real user without scanning past a conversational assistant."""
+    for record in records[index + 1 :]:
+        if record is None or record.get("kind") == "developer":
+            continue
+        if record.get("role") == "assistant":
+            return False
+        if record.get("role") == "user" and not is_host_instruction_envelope(record["text"]):
+            return True
+    return False
 
 def format_turn(lines):
     """Format a turn into structured text for LLM summarization."""
     records = [normalize_record(raw_line) for raw_line in lines]
     messages = []
     previous_message = None
-    saw_conversational_user = False
+    saw_conversational_message = False
     saw_leading_developer = False
 
     for index, message in enumerate(records):
         if message and message.get("kind") == "developer":
-            if not saw_conversational_user and not messages:
+            if not saw_conversational_message and not messages:
                 saw_leading_developer = True
             previous_message = None
             continue
@@ -233,19 +282,21 @@ def format_turn(lines):
         if (
             message["source"] == "response_item"
        
```

**File**: `tests/fixtures/README.md` (modified, +4/-0)
```diff
@@ -15,6 +15,10 @@ content.
   not a fixture captured from a successful 0.153.4 runtime session.
 - `codex_rollout_mixed.jsonl` is a compatibility fixture that combines both
   schemas, two turn boundaries, legal repeated text, and assistant phases.
+- `codex_rollout_host_envelopes.jsonl` is a synthetic model of a leading
+  developer record, a bare AGENTS header with a composite instructions and
+  environment envelope, non-conversational turn records, and a later real user
+  message.
 
 A controlled Codex 0.147.0 TUI run produced the response-item-only
 conversational shape and the leading sequence of developer context, a
```

**File**: `tests/fixtures/codex_rollout_host_envelopes.jsonl` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+{"type":"event_msg","payload":{"type":"task_started"}}
+{"type":"response_item","payload":{"type":"message","role":"developer","content":[{"type":"input_text","text":"synthetic host policy"}]}}
+{"type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"# AGENTS.md instructions\n\n<INSTRUCTIONS>\nSynthetic project rules.\n</INSTRUCTIONS>\n<environment_context>\n  <cwd>/fixture</cwd>\n  <shell>bash</shell>\n  <current_date>2026-09-18</current_date>\n  <timezone>UTC</timezone>\n  <filesystem><workspace_roots><root>/fixture</root></workspace_roots><permission_profile>synthetic</permission_profile></filesystem>\n</environment_context>"}]}}
+{"type":"world_state","payload":{"cwd":"/fixture"}}
+{"type":"turn_context","payload":{"context":"synthetic metadata sentinel"}}
+{"type":"token_usage_record","payload":{"total_tokens":1}}
+{"type":"compacted","payload":{"replacement_history":[]}}
+{"type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Remember the synthetic orchard marker."}]}}
+{"type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"The synthetic orchard marker is recorded."}]}}
```

**File**: `tests/test_codex_parse_rollout.py` (modified, +315/-0)
```diff
@@ -76,6 +76,16 @@ def test_parse_rollout_new_schema_fixture() -> None:
     assert "sensitive" not in output
 
 
+def test_parse_rollout_host_envelope_fixture() -> None:
+    output = _run_parse(FIXTURES / "codex_rollout_host_envelopes.jsonl")
+
+    assert "AGENTS.md instructions" not in output
+    assert "environment_context" not in output
+    assert "synthetic metadata sentinel" not in output
+    assert "[User]: Remember the synthetic orchard marker." in output
+    assert "[Codex]: The synthetic orchard marker is recorded." in output
+
+
 def test_parse_rollout_mixed_schema_preserves_repeated_logical_messages() -> None:
     output = _run_parse(FIXTURES / "codex_rollout_mixed.jsonl")
 
@@ -460,6 +470,19 @@ def test_parse_rollout_ignores_valid_non_object_json_lines(tmp_path: Path, root:
   <timezone>UTC</timezone>
 </environment_context>"""
 
+WORKSPACE_ENVIRONMENT_ENVELOPE = """<environment_context>
+  <current_date>2026-09-18</current_date>
+  <timezone>UTC</timezone>
+  <filesystem><workspace_roots><root>/fixture</root></workspace_roots></filesystem>
+</environment_context>"""
+
+
+def _agents_envelope(header: str, *, composite: bool) -> str:
+    text = f"{header}\n\n<INSTRUCTIONS>\nSynthetic project rules.\n</INSTRUCTIONS>"
+    if composite:
+        text += f"\n{WORKSPACE_ENVIRONMENT_ENVELOPE}"
+    return text
+
 
 @pytest.mark.parametrize(
     "text",
@@ -501,6 +524,298 @@ def test_parse_rollout_filters_observed_leading_host_sequence(tmp_path: Path, te
     assert "[User]: real prompt" in output
 
 
+@pytest.mark.parametrize(
+    "header",
+    [
+        "# AGENTS.md instructions",
+        "# AGENTS.md instructions for /fixture",
+        "# AGENTS.md instructions for /fixture with spaces",
+    ],
+)
+@pytest.mark.parametrize("composite", [False, True])
+def test_parse_rollout_filters_agents_header_and_terminator_matrix(
+    tmp_path: Path, header: str, composite: bool
+) -> None:
+    rollout = tmp_path / "rollout-agents-matrix.jsonl"
+    envelope = _agents_envelope(header, composite=composite)
+    _write_jsonl(
+        rollout,
+        [
+            _task_started(),
+            {"type": "response_item", "payload": {"type": "session_meta", "synthetic": True}},
+            _developer_message(),
+            _response_message("user", envelope),
+            {"type": "world_state", "payload": {"cwd": "/fixture"}},
+            {"type": "response_item", "payload": {"type": "turn_context", "synthetic": True}},
+            {"type": "response_item", "payload": {"type": "reasoning", "text": "metadata sentinel"}},
+            {"type": "response_item", "payload": {"type": "function_call", "name": "synthetic_tool"}},
+            {"type": "response_item", "payload": {"type": "function_call_output", "output": "tool sentinel"}},
+            {"type": "token_usage_record", "payload": {"total_tokens": 1}},
+            {"type": "compacted", "payload": {"replacement_history": []}},
+            _response_message("user", "real prompt"),
+        ],
+    )
+
+    output = _run_parse(rollout)
+    assert envelope not in output
+    assert "metadata sentinel" not in output
+    assert "tool sentinel" not in output
+    assert "[User]: real prompt" in output
+
+
+def test_parse_rollout_filters_workspace_environment_without_cwd_or_shell(tmp_path: Path) -> None:
+    rollout = tmp_path / "rollout-workspace-environment.jsonl"
+    _write_jsonl(
+        rollout,
+        [
+            _task_started(),
+            _developer_message(),
+            _response_message("user", WORKSPACE_ENVIRONMENT_ENVELOPE),
+            {"type": "world_state", "payload": {"cwd": "/fixture"}},
+            _response_message("user", "real prompt"),
+        ],
+    )
+
+    output = _run_parse(rollout)
+    assert WORKSPACE_ENVIRONMENT_ENVELOPE not in output
+    assert "[User]: real prompt" in output
+
+
+@pytest.mark.parametrize(
+    "envelope",
+    [
+        """<environment_context>
+  <current_date>2026-09-19</current_date>
+  <timezone>UTC</timezone>
+  <filesystem><workspace_roots /></filesystem>
+</environment_context>""",
+        """<environment_context>
+  <current_date>2026-09-19</current_date>
+  <timezone>UTC</timezone>
+  <filesystem><workspace_roots><root>   </root></workspace_roots></filesystem>
+</environment_context>""",
+        """<environment_context>
+  <current_date></current_date>
+  <timezone>UTC</timezone>
+  <filesystem><workspace_roots><root>/fixture</root></workspace_roots></filesystem>
+</environment_context>""",
+        """<environment_context>
+  <cwd>/fixture</cwd>
+  <shell>bash</shell>
+  <current_date>2026-09-19</current_date>
+  <timezone>   </timezone>
+</environment_context>""",
+        """<environment_context>
+  <cwd></cwd>
+  <shell>bash</shell>
+  <current_date>2026-09-19</current_date>
+  <timezone>UTC</timezone>
+</environment_context>""",
+    ],
+)
+def test_parse_rollout_incomplete_environment_context_fails_open(tmp_path: Path, envelope: str) -> None:
+    rollout =
```

**File**: `tests/test_codex_stop_hook_utf8.py` (modified, +104/-0)
```diff
@@ -3,11 +3,17 @@
 import json
 import os
 import subprocess
+import time
 from pathlib import Path
 
 SCRIPT = Path("plugins/codex/hooks/stop.sh")
 
 
+def _write_executable(path: Path, content: str) -> None:
+    path.write_text(content, encoding="utf-8")
+    path.chmod(0o755)
+
+
 def test_codex_stop_worker_fallback_summary_preserves_utf8(tmp_path: Path) -> None:
     memory_dir = tmp_path / ".memsearch" / "memory"
     memory_dir.mkdir(parents=True)
@@ -54,3 +60,101 @@ def test_codex_stop_worker_fallback_summary_preserves_utf8(tmp_path: Path) -> No
     assert "- User asked: как поправить?" in content
     assert "- Codex: Привет мир" in content
     assert "..." in content
+
+
+def test_codex_stop_hook_filters_host_envelope_from_journal(tmp_path: Path) -> None:
+    project_dir = tmp_path / "project"
+    project_dir.mkdir()
+    rollout = tmp_path / "rollout.jsonl"
+    host_envelope = (
+        "# AGENTS.md instructions\n\n"
+        "<INSTRUCTIONS>\nSynthetic project rules.\n</INSTRUCTIONS>\n"
+        "<environment_context>\n"
+        "  <current_date>2026-09-18</current_date>\n"
+        "  <timezone>UTC</timezone>\n"
+        "  <filesystem><workspace_roots><root>/fixture</root></workspace_roots></filesystem>\n"
+        "</environment_context>"
+    )
+    rows = [
+        {"type": "event_msg", "payload": {"type": "task_started"}},
+        {
+            "type": "response_item",
+            "payload": {
+                "type": "message",
+                "role": "developer",
+                "content": [{"type": "input_text", "text": "synthetic host policy"}],
+            },
+        },
+        {
+            "type": "response_item",
+            "payload": {
+                "type": "message",
+                "role": "user",
+                "content": [{"type": "input_text", "text": host_envelope}],
+            },
+        },
+        {"type": "world_state", "payload": {"cwd": "/fixture"}},
+        {
+            "type": "response_item",
+            "payload": {
+                "type": "message",
+                "role": "user",
+                "content": [{"type": "input_text", "text": "Remember the synthetic orchard marker."}],
+            },
+        },
+        {
+            "type": "response_item",
+            "payload": {
+                "type": "message",
+                "role": "assistant",
+                "content": [{"type": "output_text", "text": "The synthetic orchard marker is recorded."}],
+            },
+        },
+    ]
+    rollout.write_text("\n".join(json.dumps(row) for row in rows) + "\n", encoding="utf-8")
+
+    fake_bin = tmp_path / "bin"
+    fake_bin.mkdir()
+    _write_executable(fake_bin / "codex", "#!/usr/bin/env bash\nexit 0\n")
+    _write_executable(fake_bin / "memsearch", "#!/usr/bin/env bash\nexit 0\n")
+
+    memsearch_dir = tmp_path / ".memsearch"
+    env = {
+        **os.environ,
+        "HOME": str(tmp_path / "home"),
+        "CODEX_HOME": str(tmp_path / "codex-home"),
+        "MEMSEARCH_PROJECT_DIR": str(project_dir),
+        "MEMSEARCH_DIR": str(memsearch_dir),
+        "MEMSEARCH_NO_WATCH": "1",
+        "PATH": f"{fake_bin}:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
+    }
+    result = subprocess.run(
+        ["bash", str(SCRIPT)],
+        check=True,
+        capture_output=True,
+        text=True,
+        input=json.dumps(
+            {
+                "cwd": str(project_dir),
+                "transcript_path": str(rollout),
+                "session_id": "synthetic-host-envelope",
+            }
+        ),
+        env=env,
+    )
+    assert result.stdout == "{}\n"
+
+    deadline = time.monotonic() + 10
+    journal_files: list[Path] = []
+    while time.monotonic() < deadline:
+        journal_files = list((memsearch_dir / "memory").glob("*.md"))
+        if journal_files and journal_files[0].stat().st_size:
+            break
+        time.sleep(0.05)
+
+    assert len(journal_files) == 1
+    journal = journal_files[0].read_text(encoding="utf-8")
+    assert "AGENTS.md instructions" not in journal
+    assert "environment_context" not in journal
+    assert "[User]: Remember the synthetic orchard marker." in journal
+    assert "[Codex]: The synthetic orchard marker is recorded." in journal
```

---

### Incident Patch 4: `fc0ef776` (2026-09-18)
**Commit Message**: fix(codex): parse response-item rollout messages safely (#751)

Normalize legacy and response-item rollout messages while preserving legitimate repeated text, filtering only structurally identified host envelopes, and excluding tool and non-message records from capture.

Fixes #742.

**File**: `plugins/codex/scripts/parse-rollout.sh` (modified, +185/-29)
```diff
@@ -38,11 +38,19 @@ fi
 python3 -c '
 import json, sys
 
+
+RESPONSE_TEXT_BLOCKS = {
+    "user": {"input_text"},
+    "assistant": {"output_text"},
+}
+
 def find_last_turn_start(lines):
     """Find the index of the last task_started event."""
     for i in range(len(lines) - 1, -1, -1):
         try:
             obj = json.loads(lines[i])
+            if not isinstance(obj, dict):
+                continue
             if obj.get("type") == "event_msg":
                 payload = obj.get("payload", {})
                 if payload.get("type") == "task_started":
@@ -51,53 +59,201 @@ def find_last_turn_start(lines):
             pass
     return None
 
+def response_message(payload):
+    """Return a normalized response_item message or None."""
+    if not isinstance(payload, dict) or payload.get("type") != "message":
+        return None
+
+    role = payload.get("role")
+    if role not in RESPONSE_TEXT_BLOCKS:
+        return None
+
+    content = payload.get("content")
+    if not isinstance(content, list):
+        return None
+
+    parts = []
+    for block in content:
+        if not isinstance(block, dict) or block.get("type") not in RESPONSE_TEXT_BLOCKS[role]:
+            continue
+        text = block.get("text")
+        if isinstance(text, str) and text.strip():
+            parts.append(text.strip())
+
+    text = "\n".join(parts).strip()
+    if not text:
+        return None
+
+    event_id = None
+    for key in ("id", "item_id", "message_id", "client_id"):
+        value = payload.get(key)
+        if isinstance(value, str) and value:
+            event_id = value
+            break
+
+    phase = payload.get("phase")
+    return {
+        "source": "response_item",
+        "role": role,
+        "text": text,
+        "event_id": event_id,
+        "phase": phase if isinstance(phase, str) else None,
+    }
+
+
+def is_host_instruction_envelope(text):
+    """Recognize the exact host wrapper shapes observed in Codex rollouts."""
+    stripped = text.strip()
+    if stripped.startswith("# AGENTS.md instructions for "):
+        header, separator, body = stripped.partition("\n\n")
+        return bool(
+            separator
+            and header.startswith("# AGENTS.md instructions for ")
+            and body.startswith("<INSTRUCTIONS>")
+            and body.endswith("</INSTRUCTIONS>")
+        )
+    if stripped.startswith("<user_instructions>\n") and stripped.endswith("\n</user_instructions>"):
+        return True
+    if stripped.startswith("<environment_context>\n") and stripped.endswith("\n</environment_context>"):
+        required_fields = ("cwd", "shell", "current_date", "timezone")
+        return all(f"<{field}>" in stripped and f"</{field}>" in stripped for field in required_fields)
+    return False
+
+
 def find_last_user_message(lines):
-    """Fallback: find the last user_message event."""
+    """Fallback: find the last conversational user message in either schema."""
     for i in range(len(lines) - 1, -1, -1):
         try:
             obj = json.loads(lines[i])
-            if obj.get("type") == "event_msg":
-                payload = obj.get("payload", {})
-                if payload.get("type") == "user_message":
+            if not isinstance(obj, dict):
+                continue
+            payload = obj.get("payload", {})
+            if obj.get("type") == "event_msg" and isinstance(payload, dict):
+                if payload.get("type") == "user_message" and isinstance(payload.get("message"), str):
+                    return i
+            if obj.get("type") == "response_item":
+                message = response_message(payload)
+                if message and message["role"] == "user":
                     return i
         except Exception:
             pass
     return None
 
-def format_turn(lines):
-    """Format a turn into structured text for LLM summarization."""
-    output = ["=== Transcript of a conversation between User and Codex CLI ==="]
 
-    for raw_line in lines:
-        try:
-            obj = json.loads(raw_line)
-        except Exception:
-            continue
+def legacy_message(payload):
+    """Return a normalized event_msg user/assistant message or None."""
+    if not isinstance(payload, dict):
+        return None
+    message_type = payload.get("type")
+    role = {"user_message": "user", "agent_message": "assistant"}.get(message_type)
+    text = payload.get("message")
+    if role is None or not isinstance(text, str) or not text.strip():
+        return None
+
+    event_id = None
+    for key in ("id", "item_id", "message_id", "client_id"):
+        value = payload.get(key)
+        if isinstance(value, str) and value:
+            event_id = value
+            break
 
-        line_type = obj.get("type", "")
-        payload = obj.get("payload", {})
+    phase = payload.get("phase")
+    return {
+        "source": "event_msg",
+        "role": role,
+        "text": text.strip(),
+        "event_id": event_id,
+        
```

**File**: `tests/fixtures/README.md` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+# Codex rollout fixtures
+
+These fixtures contain only synthetic, non-sensitive text and the fields needed
+to test the capture parser. They deliberately omit timestamps, paths, tokens,
+credentials, model metadata, private instructions, and unrelated transcript
+content.
+
+- `codex_rollout_old.jsonl` is a synthetic compatibility model of the legacy
+  dual-write shape. Shared synthetic IDs provide affirmative identity for the
+  two representations of each logical message.
+- `codex_rollout_0_153.jsonl` is derived from the static persistence policy in
+  the official OpenAI Codex `rust-v0.153.4` source tag. That policy permits
+  paginated history where natural-language text is carried by `response_item`
+  messages while tool, reasoning, and metadata records remain separate. It is
+  not a fixture captured from a successful 0.153.4 runtime session.
+- `codex_rollout_mixed.jsonl` is a compatibility fixture that combines both
+  schemas, two turn boundaries, legal repeated text, and assistant phases.
+
+A controlled Codex 0.147.0 TUI run produced the response-item-only
+conversational shape and the leading sequence of developer context, a
+structured environment envelope, and the real user message. The source rollout
+was inspected only through structural summaries and the synthetic marker used
+for that run; no private transcript was copied into these fixtures. The
+separate isolated 0.153.4 TUI stopped at authentication and remains
+`NO_CREDIT` for runtime-schema evidence.
```

**File**: `tests/fixtures/codex_rollout_0_153.jsonl` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+{"type":"event_msg","payload":{"type":"task_started","turn_id":"turn-new"}}
+{"type":"response_item","payload":{"type":"message","role":"developer","content":[{"type":"input_text","text":"host policy"}]}}
+{"type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"<environment_context>\n  <cwd>/fixture</cwd>\n  <shell>bash</shell>\n  <current_date>2026-09-18</current_date>\n  <timezone>UTC</timezone>\n</environment_context>"}]}}
+{"type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"First block."},{"type":"input_text","text":"Second block."}]}}
+{"type":"response_item","payload":{"type":"reasoning","summary":[{"type":"summary_text","text":"private reasoning"}]}}
+{"type":"response_item","payload":{"type":"function_call","name":"exec_command","call_id":"call-1","arguments":"{\"cmd\":\"printf sensitive\"}"}}
+{"type":"response_item","payload":{"type":"function_call_output","call_id":"call-1","output":"sensitive tool output"}}
+{"type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Answer block one."},{"type":"output_text","text":"Answer block two."}]}}
+{"type":"event_msg","payload":{"type":"task_complete","turn_id":"turn-new"}}
```

**File**: `tests/fixtures/codex_rollout_mixed.jsonl` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+{"type":"event_msg","payload":{"type":"task_started","turn_id":"turn-before"}}
+{"type":"event_msg","payload":{"type":"user_message","message":"Ignore the previous turn."}}
+{"type":"event_msg","payload":{"type":"agent_message","message":"Previous answer."}}
+{"type":"event_msg","payload":{"type":"task_complete","turn_id":"turn-before"}}
+{"type":"event_msg","payload":{"type":"task_started","turn_id":"turn-current"}}
+{"type":"event_msg","payload":{"type":"user_message","id":"user-logical-1","message":"same text"}}
+{"type":"response_item","payload":{"type":"message","id":"user-logical-1","role":"user","content":[{"type":"input_text","text":"same text"}]}}
+{"type":"response_item","payload":{"type":"message","id":"user-logical-2","role":"user","content":[{"type":"input_text","text":"same text"}]}}
+{"type":"event_msg","payload":{"type":"user_message","id":"user-logical-2","message":"same text"}}
+{"type":"response_item","payload":{"type":"message","id":"assistant-logical-1","role":"assistant","phase":"commentary","content":[{"type":"output_text","text":"working"}]}}
+{"type":"event_msg","payload":{"type":"agent_message","id":"assistant-logical-1","phase":"commentary","message":"working"}}
+{"type":"response_item","payload":{"type":"message","id":"assistant-logical-2","role":"assistant","phase":"final_answer","content":[{"type":"output_text","text":"done"}]}}
+{"type":"event_msg","payload":{"type":"agent_message","id":"assistant-logical-2","phase":"final_answer","message":"done"}}
+{"type":"event_msg","payload":{"type":"task_complete","turn_id":"turn-current"}}
```

**File**: `tests/fixtures/codex_rollout_old.jsonl` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+{"type":"event_msg","payload":{"type":"task_started","turn_id":"turn-old"}}
+{"type":"event_msg","payload":{"type":"user_message","id":"user-logical-1","message":"Repeat the marker twice."}}
+{"type":"response_item","payload":{"type":"message","id":"user-logical-1","role":"user","content":[{"type":"input_text","text":"Repeat the marker twice."}]}}
+{"type":"response_item","payload":{"type":"message","id":"assistant-logical-1","role":"assistant","content":[{"type":"output_text","text":"marker marker"}]}}
+{"type":"event_msg","payload":{"type":"agent_message","id":"assistant-logical-1","message":"marker marker"}}
+{"type":"event_msg","payload":{"type":"task_complete","turn_id":"turn-old"}}
```

**File**: `tests/test_codex_parse_rollout.py` (modified, +437/-1)
```diff
@@ -4,10 +4,13 @@
 import subprocess
 from pathlib import Path
 
+import pytest
+
 SCRIPT = Path("plugins/codex/scripts/parse-rollout.sh")
+FIXTURES = Path("tests/fixtures")
 
 
-def _write_jsonl(path: Path, rows: list[dict]) -> None:
+def _write_jsonl(path: Path, rows: list[object]) -> None:
     path.write_text("\n".join(json.dumps(row) for row in rows) + "\n", encoding="utf-8")
 
 
@@ -21,6 +24,67 @@ def _run_parse(path: Path) -> str:
     return result.stdout
 
 
+def _task_started() -> dict:
+    return {"type": "event_msg", "payload": {"type": "task_started"}}
+
+
+def _legacy_user(text: str, event_id: str | None = None) -> dict:
+    payload = {"type": "user_message", "message": text}
+    if event_id is not None:
+        payload["id"] = event_id
+    return {"type": "event_msg", "payload": payload}
+
+
+def _response_message(role: str, text: str, event_id: str | None = None, phase: str | None = None) -> dict:
+    payload = {
+        "type": "message",
+        "role": role,
+        "content": [{"type": "input_text" if role == "user" else "output_text", "text": text}],
+    }
+    if event_id is not None:
+        payload["id"] = event_id
+    if phase is not None:
+        payload["phase"] = phase
+    return {"type": "response_item", "payload": payload}
+
+
+def _developer_message(text: str = "host policy") -> dict:
+    return {
+        "type": "response_item",
+        "payload": {
+            "type": "message",
+            "role": "developer",
+            "content": [{"type": "input_text", "text": text}],
+        },
+    }
+
+
+def test_parse_rollout_old_schema_fixture() -> None:
+    output = _run_parse(FIXTURES / "codex_rollout_old.jsonl")
+
+    assert output.count("[User]: Repeat the marker twice.") == 1
+    assert output.count("[Codex]: marker marker") == 1
+
+
+def test_parse_rollout_new_schema_fixture() -> None:
+    output = _run_parse(FIXTURES / "codex_rollout_0_153.jsonl")
+
+    assert "[User]: First block.\nSecond block." in output
+    assert "[Codex]: Answer block one.\nAnswer block two." in output
+    assert "environment_context" not in output
+    assert "private reasoning" not in output
+    assert "sensitive" not in output
+
+
+def test_parse_rollout_mixed_schema_preserves_repeated_logical_messages() -> None:
+    output = _run_parse(FIXTURES / "codex_rollout_mixed.jsonl")
+
+    assert "Ignore the previous turn" not in output
+    assert output.count("[User]: same text") == 2
+    assert output.count("[Codex]: working") == 1
+    assert output.count("[Codex]: done") == 1
+
+
 def test_parse_rollout_omits_tool_output_content(tmp_path: Path) -> None:
     rollout = tmp_path / "rollout.jsonl"
     _write_jsonl(
@@ -113,3 +177,375 @@ def test_parse_rollout_omits_tool_error_content(tmp_path: Path) -> None:
     assert "exit_code=2" not in output
     assert "final error marker" not in output
     assert "prefix " not in output
+
+
+def test_parse_rollout_ignores_unknown_and_malformed_items(tmp_path: Path) -> None:
+    rollout = tmp_path / "rollout-malformed.jsonl"
+    rollout.write_text(
+        "not-json\n"
+        + "\n".join(
+            json.dumps(row)
+            for row in [
+                {"type": "event_msg", "payload": {"type": "task_started"}},
+                {"type": "response_item", "payload": None},
+                {"type": "response_item", "payload": {"type": "message", "role": "user", "content": {}}},
+                {
+                    "type": "response_item",
+                    "payload": {
+                        "type": "message",
+                        "role": "user",
+                        "content": [None, "raw", {"type": "future_text", "text": "unknown payload"}],
+                    },
+                },
+                {
+                    "type": "response_item",
+                    "payload": {
+                        "type": "message",
+                        "role": "user",
+                        "content": [{"type": "input_text", "text": "valid text"}],
+                    },
+                },
+                {"type": "future_item", "payload": {"text": "metadata payload"}},
+            ]
+        )
+        + "\n",
+        encoding="utf-8",
+    )
+
+    output = _run_parse(rollout)
+
+    assert "[User]: valid text" in output
+    assert "unknown payload" not in output
+    assert "metadata payload" not in output
+
+
+def test_parse_rollout_returns_empty_turn_when_no_natural_language(tmp_path: Path) -> None:
+    rollout = tmp_path / "rollout-empty.jsonl"
+    _write_jsonl(
+        rollout,
+        [
+            {"type": "event_msg", "payload": {"type": "task_started"}},
+            {"type": "response_item", "payload": {"type": "reasoning", "content": []}},
+            {"type": "response_item", "payload": {"type": "function_call_output", "output": "hidden"}},
+        ],
+    )
+
+    assert _run_parse(rollout) == "(empty turn)\n"
+
+
+def test_parse_rollout_preserves_instruction_lookalikes_and_lat
```

---

### Incident Patch 5: `15ad9623` (2026-09-12)
**Commit Message**: fix(openclaw): update prompt hook compatibility (#744)

Replace the retired prompt hook, add focused coverage, and refresh OpenClaw compatibility reports.

**File**: `plugins/openclaw/index.js` (modified, +1/-1)
```diff
@@ -449,7 +449,7 @@ var index_default = {
       { name: "memory_transcript" }
     );
     if (autoRecall) {
-      api.on("before_agent_start", async () => {
+      api.on("before_prompt_build", async () => {
         try {
           const context = getRecentMemories(memoryDir);
           const skillHint = await getSkillCandidateHint();
```

**File**: `plugins/openclaw/index.test.ts` (modified, +151/-1)
```diff
@@ -1,6 +1,12 @@
 import test from "node:test";
 import assert from "node:assert/strict";
-import { mkdtempSync, rmSync } from "node:fs";
+import {
+  mkdirSync,
+  mkdtempSync,
+  readFileSync,
+  rmSync,
+  writeFileSync,
+} from "node:fs";
 import { tmpdir } from "node:os";
 import { join } from "node:path";
 
@@ -25,6 +31,59 @@ function withEnv(key: string, value: string | undefined, fn: () => void): void {
   }
 }
 
+async function withEnvAsync(
+  values: Record<string, string | undefined>,
+  fn: () => Promise<void>
+): Promise<void> {
+  const previous = new Map<string, string | undefined>();
+  for (const [key, value] of Object.entries(values)) {
+    previous.set(key, process.env[key]);
+    if (value === undefined) {
+      delete process.env[key];
+    } else {
+      process.env[key] = value;
+    }
+  }
+  try {
+    await fn();
+  } finally {
+    for (const [key, value] of previous) {
+      if (value === undefined) {
+        delete process.env[key];
+      } else {
+        process.env[key] = value;
+      }
+    }
+  }
+}
+
+function registerPluginHooks(pluginConfig: Record<string, unknown> = {}): Map<string, (...args: any[]) => any> {
+  const hooks = new Map<string, (...args: any[]) => any>();
+  plugin.register({
+    logger: {},
+    pluginConfig,
+    runtime: {
+      system: {
+        async runCommandWithTimeout(argv: string[]) {
+          if (argv[0] === "which") {
+            return { stdout: "/tmp/memsearch\n", stderr: "", code: 0 };
+          }
+          if (argv[0] === "bash" && argv[1]?.endsWith("derive-collection.sh")) {
+            return { stdout: "ms_hook_test\n", stderr: "", code: 0 };
+          }
+          return { stdout: "", stderr: "", code: 0 };
+        },
+      },
+    },
+    registerTool() {},
+    registerCli() {},
+    on(name: string, handler: (...args: any[]) => any) {
+      hooks.set(name, handler);
+    },
+  });
+  return hooks;
+}
+
 test("getMemsearchDir: defaults to <projectDir>/.memsearch", () => {
   const dir = mkdtempSync(join(tmpdir(), "memsearch-openclaw-"));
   try {
@@ -250,3 +309,94 @@ test("an old core fails clearly before a memory search is attempted", async () =
     rmSync(projectDir, { recursive: true, force: true });
   }
 });
+
+test("default registration uses the supported prompt hook and injects memory context", async () => {
+  const home = mkdtempSync(join(tmpdir(), "memsearch-openclaw-hooks-"));
+  const previousEnv = {
+    HOME: process.env.HOME,
+    MEMSEARCH_DIR: process.env.MEMSEARCH_DIR,
+    MEMSEARCH_NO_WATCH: process.env.MEMSEARCH_NO_WATCH,
+  };
+  const memoryDir = join(home, ".openclaw", "workspace", ".memsearch", "memory");
+  mkdirSync(memoryDir, { recursive: true });
+  writeFileSync(
+    join(memoryDir, "2026-09-12.md"),
+    "# 2026-09-12\n\n## Session 14:00\n\n### 14:01\n- Compatibility memory fixture.\n",
+    "utf-8"
+  );
+
+  try {
+    await withEnvAsync(
+      { HOME: home, MEMSEARCH_DIR: undefined, MEMSEARCH_NO_WATCH: undefined },
+      async () => {
+        const hooks = registerPluginHooks();
+        const retiredHook = "before_" + "agent_start";
+        assert.deepEqual(
+          [...hooks.keys()].sort(),
+          ["agent_end", "before_prompt_build", "session_start"]
+        );
+        assert.equal(hooks.has(retiredHook), false);
+
+        const result = await hooks.get("before_prompt_build")?.();
+        assert.match(result.prependContext, /Recent memories/);
+        assert.match(result.prependContext, /Compatibility memory fixture/);
+        await new Promise<void>((resolve) => setImmediate(resolve));
+      }
+    );
+    assert.deepEqual(
+      {
+        HOME: process.env.HOME,
+        MEMSEARCH_DIR: process.env.MEMSEARCH_DIR,
+        MEMSEARCH_NO_WATCH: process.env.MEMSEARCH_NO_WATCH,
+      },
+      previousEnv
+    );
+  } finally {
+    rmSync(home, { recursive: true, force: true });
+  }
+});
+
+test("autoRecall false omits the prompt hook", async () => {
+  const home = mkdtempSync(join(tmpdir(), "memsearch-openclaw-no-recall-"));
+  const previousEnv = {
+    HOME: process.env.HOME,
+    MEMSEARCH_DIR: process.env.MEMSEARCH_DIR,
+    MEMSEARCH_NO_WATCH: process.env.MEMSEARCH_NO_WATCH,
+  };
+  try {
+    await withEnvAsync(
+      { HOME: home, MEMSEARCH_DIR: undefined, MEMSEARCH_NO_WATCH: undefined },
+      async () => {
+        const hooks = registerPluginHooks({ autoRecall: false });
+        const retiredHook = "before_" + "agent_start";
+        assert.equal(hooks.has("before_prompt_build"), false);
+        assert.equal(hooks.has(retiredHook), false);
+        await new Promise<void>((resolve) => setImmediate(resolve));
+      }
+    );
+    assert.deepEqual(
+      {
+        HOME: process.env.HOME,
+        MEMSEARCH_DIR: process.env.MEMSEARCH_DIR,
+        MEMSEARCH_NO_WATCH: process.env.MEMSEARCH_NO_WATCH,
+      },
+      previousEnv
+    );
+  } finally {
+    rmSync(home, { recursive: true, force: true });
+  }
+});
+
+test("source and generated e
```

**File**: `plugins/openclaw/index.ts` (modified, +3/-3)
```diff
@@ -5,7 +5,7 @@
  * - memory_search tool: semantic search over past memories
  * - memory_get tool: expand a chunk to full context
  * - memory_transcript tool: parse original conversation from JSONL transcript
- * - before_agent_start hook: inject recent memories as cold-start context
+ * - before_prompt_build hook: inject recent memories as cold-start context
  * - agent_end hook: auto-capture per-turn summary (extract → summarize → write)
  * - CLI: `memsearch` subcommand (search, index, status)
  */
@@ -619,9 +619,9 @@ export default {
       { name: "memory_transcript" }
     );
 
-    // ----- Hook: before_agent_start — inject recent memories -----
+    // ----- Hook: before_prompt_build — inject recent memories -----
     if (autoRecall) {
-      api.on("before_agent_start", async () => {
+      api.on("before_prompt_build", async () => {
         try {
           const context = getRecentMemories(memoryDir);
           const skillHint = await getSkillCandidateHint();
```

**File**: `plugins/openclaw/package.json` (modified, +2/-2)
```diff
@@ -24,8 +24,8 @@
       "pluginApi": ">=2026.3.11"
     },
     "build": {
-      "openclawVersion": "2026.3.23",
-      "pluginSdkVersion": "2026.3.23"
+      "openclawVersion": "2026.9.4",
+      "pluginSdkVersion": "2026.9.4"
     }
   },
   "peerDependencies": {
```

**File**: `plugins/openclaw/reports/plugin-inspector-issues.md` (added, +153/-0)
```diff
@@ -0,0 +1,153 @@
+# OpenClaw Plugin Issue Findings
+
+Generated: deterministic
+Status: PASS
+
+## Triage Summary
+
+| Metric                     | Value |
+| -------------------------- | ----- |
+| Issue findings             | 4     |
+| Open issue findings        | 4     |
+| Runtime-covered findings   | 0     |
+| Runtime-partial findings   | 0     |
+| P0                         | 0     |
+| P1                         | 2     |
+| Open P0                    | 0     |
+| Open P1                    | 2     |
+| Live issues                | 0     |
+| Live P0 issues             | 0     |
+| Compat gaps                | 1     |
+| Deprecation warnings       | 0     |
+| Inspector gaps             | 2     |
+| Open inspector gaps        | 2     |
+| Runtime coverage artifacts | 0     |
+| Upstream metadata          | 1     |
+| Contract probes            | 3     |
+
+## Triage Overview
+
+| Class               | Count | P0 | Meaning                                                                                                                                                  |
+| ------------------- | ----- | -- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
+| live-issue          | 0     | 0  | Potential runtime breakage in the target OpenClaw/plugin pair. P0 only when it is not a deprecated compat seam.                                          |
+| compat-gap          | 1     | -  | Compatibility behavior is needed but missing from the target OpenClaw compat registry.                                                                   |
+| deprecation-warning | 0     | -  | Plugin uses a supported but deprecated compatibility seam; keep it wired while migration exists.                                                         |
+| inspector-gap       | 2     | -  | Plugin Inspector needs stronger capture/probe evidence before making contract judgments. Runtime-covered rows are proof-backed and not open report work. |
+| upstream-metadata   | 1     | -  | Plugin package or manifest metadata should improve upstream; not a target OpenClaw live break by itself.                                                 |
+| fixture-regression  | 0     | -  | Fixture no longer exposes an expected seam; investigate fixture pin or scanner drift.                                                                    |
+
+## P0 Live Issues
+
+_none_
+
+## Other Live Issues
+
+_none_
+
+## Compat Gaps
+
+- P1 **memsearch** `compat-gap` `core-compat-adapter`
+  - **missing-compat-record**: memsearch: compat-dependent behavior lacks registry coverage
+  - state: open · compat:missing
+  - evidence:
+    - hook.llm-observer.privacy-payload
+
+## Deprecation Warnings
+
+_none_
+
+## Inspector Proof Gaps
+
+- P1 **memsearch** `inspector-gap` `inspector-follow-up`
+  - **conversation-access-hook**: memsearch: conversation-access hooks need privacy-boundary probes
+  - state: open · compat:untracked
+  - evidence:
+    - agent_end @ index.js:604
+    - agent_end @ index.ts:818
+
+- P2 **memsearch** `inspector-gap` `inspector-follow-up`
+  - **runtime-tool-capture**: memsearch: runtime tool schema needs registration capture
+  - state: open · compat:none
+  - evidence:
+    - registerTool @ index.js:322
+    - registerTool @ index.js:370
+    - registerTool @ index.js:413
+    - registerTool @ index.ts:464
+    - registerTool @ index.ts:523
+    - registerTool @ index.ts:576
+
+## Runtime-Covered Inspector Gaps
+
+_none_
+
+## Upstream Metadata Issues
+
+- P2 **memsearch** `upstream-metadata` `plugin-upstream-fix`
+  - **manifest-name-missing**: memsearch: manifest display name is missing
+  - state: open · compat:none
+  - evidence:
+    - openclaw.plugin.json
+  - author remediation:
+    - Add a display name to the plugin manifest.
+    - docs: https://docs.openclaw.ai/clawhub/plugin-validation-fixes#manifest-name-missing
+
+## Issues
+
+- P1 **memsearch** `inspector-gap` `inspector-follow-up`
+  - **conversation-access-hook**: memsearch: conversation-access hooks need privacy-boundary probes
+  - state: open · compat:untracked
+  - evidence:
+    - agent_end @ index.js:604
+    - agent_end @ index.ts:818
+
+- P1 **memsearch** `compat-gap` `core-compat-adapter`
+  - **missing-compat-record**: memsearch: compat-dependent behavior lacks registry coverage
+  - state: open · compat:missing
+  - evidence:
+    - hook.llm-observer.privacy-payload
+
+- P2 **memsearch** `upstream-metadata` `plugin-upstream-fix`
+  - **manifest-name-missing**: memsearch: manifest display name is missing
+  - state: open · compat:none
+  - evidence:
+    - openclaw.plugin.json
+  - author remediation:
+    - Add a display name to the plugin manifest.
+    - docs: https://docs.openclaw.ai/clawhub/plugin-validation-fixes#manifest-name-missing
+
+- P2 **memsearch** `inspector-gap` `inspector-follow-up`
+  - **runtime-tool-capture**: memsearch: runtime tool sch
```

**File**: `plugins/openclaw/reports/plugin-inspector-report.json` (added, +1165/-0)
```diff
@@ -0,0 +1,1165 @@
+{
+  "generatedAt": "deterministic",
+  "targetOpenClaw": {
+    "configuredPath": "npm:openclaw@2026.9.4",
+    "searchedPaths": [
+      "npm:openclaw@2026.9.4"
+    ],
+    "status": "ok",
+    "version": "2026.9.4",
+    "compatRegistryPath": null,
+    "compatRecordCount": 0,
+    "compatRecords": [],
+    "compatRecordStatuses": {},
+    "hookTypesPath": "dist/agent-harness-runtime-BvaKEkqR.d.ts",
+    "hookNameCount": 42,
+    "hookNames": [
+      "after_compaction",
+      "after_tool_call",
+      "agent_end",
+      "agent_turn_prepare",
+      "before_agent_finalize",
+      "before_agent_reply",
+      "before_agent_run",
+      "before_compaction",
+      "before_dispatch",
+      "before_install",
+      "before_message_write",
+      "before_model_resolve",
+      "before_prompt_build",
+      "before_reset",
+      "before_tool_call",
+      "channel_pairing_requested",
+      "cron_changed",
+      "cron_reconciled",
+      "gateway_start",
+      "gateway_stop",
+      "heartbeat_prompt_contribution",
+      "inbound_claim",
+      "llm_input",
+      "llm_output",
+      "message_received",
+      "message_sending",
+      "message_sent",
+      "model_call_ended",
+      "model_call_started",
+      "reply_dispatch",
+      "reply_payload_sending",
+      "resolve_exec_env",
+      "session_end",
+      "session_start",
+      "skill_changed",
+      "skill_proposal_changed",
+      "skill_proposal_evaluate",
+      "subagent_delivery_target",
+      "subagent_ended",
+      "subagent_progress",
+      "subagent_spawned",
+      "tool_result_persist"
+    ],
+    "apiBuilderPath": "dist/agent-harness-runtime-BvaKEkqR.d.ts",
+    "apiRegistrarCount": 57,
+    "apiRegistrars": [
+      "registerAgentEventSubscription",
+      "registerAgentHarness",
+      "registerAgentToolResultMiddleware",
+      "registerAutoEnableProbe",
+      "registerBoardWidgetContentKind",
+      "registerChannel",
+      "registerCli",
+      "registerCliBackend",
+      "registerCodexAppServerExtensionFactory",
+      "registerCommand",
+      "registerCompactionProvider",
+      "registerConfigMigration",
+      "registerContextEngine",
+      "registerControlUiDescriptor",
+      "registerDetachedTaskRuntime",
+      "registerEmbeddingProvider",
+      "registerGatewayDiscoveryService",
+      "registerGatewayMethod",
+      "registerHook",
+      "registerHostedMediaResolver",
+      "registerHttpRoute",
+      "registerImageGenerationProvider",
+      "registerInteractiveHandler",
+      "registerMcpServerConnectionResolver",
+      "registerMediaUnderstandingProvider",
+      "registerMemoryCapability",
+      "registerMemoryCorpusSupplement",
+      "registerMemoryPromptPreparation",
+      "registerMemoryPromptSupplement",
+      "registerMigrationProvider",
+      "registerModelCatalogProvider",
+      "registerMusicGenerationProvider",
+      "registerNodeCliFeature",
+      "registerNodeHostCommand",
+      "registerNodeInvokePolicy",
+      "registerProvider",
+      "registerRealtimeTranscriptionProvider",
+      "registerRealtimeVoiceProvider",
+      "registerReload",
+      "registerRuntimeLifecycle",
+      "registerSecurityAuditCollector",
+      "registerService",
+      "registerSessionAction",
+      "registerSessionCatalog",
+      "registerSessionExtension",
+      "registerSessionSchedulerJob",
+      "registerSpeechProvider",
+      "registerTextTransforms",
+      "registerTool",
+      "registerToolMetadata",
+      "registerTranscriptSourceProvider",
+      "registerTrustedToolPolicy",
+      "registerVideoGenerationProvider",
+      "registerWebFetchProvider",
+      "registerWebSearchProvider",
+      "registerWidgetPresenter",
+      "registerWorkerProvider"
+    ],
+    "capturedRegistrationPath": "dist/agent-harness-runtime-BvaKEkqR.d.ts",
+    "capturedRegistrarCount": 57,
+    "capturedRegistrars": [
+      "registerAgentEventSubscription",
+      "registerAgentHarness",
+      "registerAgentToolResultMiddleware",
+      "registerAutoEnableProbe",
+      "registerBoardWidgetContentKind",
+      "registerChannel",
+      "registerCli",
+      "registerCliBackend",
+      "registerCodexAppServerExtensionFactory",
+      "registerCommand",
+      "registerCompactionProvider",
+      "registerConfigMigration",
+      "registerContextEngine",
+      "registerControlUiDescriptor",
+      "registerDetachedTaskRuntime",
+      "registerEmbeddingProvider",
+      "registerGatewayDiscoveryService",
+      "registerGatewayMethod",
+      "registerHook",
+      "registerHostedMediaResolver",
+      "registerHttpRoute",
+      "registerImageGenerationProvider",
+      "registerInteractiveHandler",
+      "registerMcpServerConnectionResolver",
+      "registerMediaUnderstandingProvider",
+      "registerMemoryCapability",
+      "registerMemoryCorpusSupplement",
+      "registerMemoryPromptPreparation",
+      "registerMemoryPromptSupplement",
+      "registerMigrationPr
```

**File**: `plugins/openclaw/reports/plugin-inspector-report.md` (added, +230/-0)
```diff
@@ -0,0 +1,230 @@
+# OpenClaw Plugin Compatibility Report
+
+Generated: deterministic
+Status: PASS
+
+## Summary
+
+| Metric                     | Value |
+| -------------------------- | ----- |
+| Fixtures                   | 1     |
+| High-priority fixtures     | 1     |
+| Hard breakages             | 0     |
+| Warnings                   | 2     |
+| Compatibility suggestions  | 2     |
+| Issue findings             | 4     |
+| Open issue findings        | 4     |
+| Runtime-covered findings   | 0     |
+| Runtime-partial findings   | 0     |
+| P0 issues                  | 0     |
+| P1 issues                  | 2     |
+| Open P0 issues             | 0     |
+| Open P1 issues             | 2     |
+| Live issues                | 0     |
+| Live P0 issues             | 0     |
+| Compat gaps                | 1     |
+| Deprecation warnings       | 0     |
+| Inspector gaps             | 2     |
+| Open inspector gaps        | 2     |
+| Runtime coverage artifacts | 0     |
+| Upstream metadata          | 1     |
+| Contract probes            | 3     |
+| Decision rows              | 4     |
+
+## Triage Overview
+
+| Class               | Count | P0 | Meaning                                                                                                                                                  |
+| ------------------- | ----- | -- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
+| live-issue          | 0     | 0  | Potential runtime breakage in the target OpenClaw/plugin pair. P0 only when it is not a deprecated compat seam.                                          |
+| compat-gap          | 1     | -  | Compatibility behavior is needed but missing from the target OpenClaw compat registry.                                                                   |
+| deprecation-warning | 0     | -  | Plugin uses a supported but deprecated compatibility seam; keep it wired while migration exists.                                                         |
+| inspector-gap       | 2     | -  | Plugin Inspector needs stronger capture/probe evidence before making contract judgments. Runtime-covered rows are proof-backed and not open report work. |
+| upstream-metadata   | 1     | -  | Plugin package or manifest metadata should improve upstream; not a target OpenClaw live break by itself.                                                 |
+| fixture-regression  | 0     | -  | Fixture no longer exposes an expected seam; investigate fixture pin or scanner drift.                                                                    |
+
+## P0 Live Issues
+
+_none_
+
+## Other Live Issues
+
+_none_
+
+## Compat Gaps
+
+- P1 **memsearch** `compat-gap` `core-compat-adapter`
+  - **missing-compat-record**: memsearch: compat-dependent behavior lacks registry coverage
+  - state: open · compat:missing
+  - evidence:
+    - hook.llm-observer.privacy-payload
+
+## Deprecation Warnings
+
+_none_
+
+## Inspector Proof Gaps
+
+- P1 **memsearch** `inspector-gap` `inspector-follow-up`
+  - **conversation-access-hook**: memsearch: conversation-access hooks need privacy-boundary probes
+  - state: open · compat:untracked
+  - evidence:
+    - agent_end @ index.js:604
+    - agent_end @ index.ts:818
+
+- P2 **memsearch** `inspector-gap` `inspector-follow-up`
+  - **runtime-tool-capture**: memsearch: runtime tool schema needs registration capture
+  - state: open · compat:none
+  - evidence:
+    - registerTool @ index.js:322
+    - registerTool @ index.js:370
+    - registerTool @ index.js:413
+    - registerTool @ index.ts:464
+    - registerTool @ index.ts:523
+    - registerTool @ index.ts:576
+
+## Runtime-Covered Inspector Gaps
+
+_none_
+
+## Upstream Metadata Issues
+
+- P2 **memsearch** `upstream-metadata` `plugin-upstream-fix`
+  - **manifest-name-missing**: memsearch: manifest display name is missing
+  - state: open · compat:none
+  - evidence:
+    - openclaw.plugin.json
+  - author remediation:
+    - Add a display name to the plugin manifest.
+    - docs: https://docs.openclaw.ai/clawhub/plugin-validation-fixes#manifest-name-missing
+
+## Hard Breakages
+
+_none_
+
+## Target OpenClaw Compat Records
+
+| Metric                    | Value                                          |
+| ------------------------- | ---------------------------------------------- |
+| Configured path           | npm:openclaw@2026.9.4                          |
+| Status                    | ok                                             |
+| Requested version         | 2026.9.4                                       |
+| Resolved version          | 2026.9.4                                       |
+| Range eligibility version | 2026.9.4                                       |
+| Source                    | npm:openclaw                                   |
+| NPM dist-tag              | -                                              |
```

---

### Incident Patch 6: `3e98e4ad` (2026-09-11)
**Commit Message**: fix(dsh): harden session capture and summarizer lifecycle

- prefer complete snapshot event projections with safe legacy fallback
- preserve Unicode across Node and Python summarizer boundaries
- close headless stdin and reap summarizer process trees on timeout
- cover event ordering, compatibility, encoding, and lifecycle regressions

Closes #735

**File**: `docs/platforms/dsh/how-it-works.md` (modified, +2/-2)
```diff
@@ -25,7 +25,7 @@ flowchart LR
 The plugin listens for DSH `session/event` notifications and handles completed turns. It:
 
 1. resolves the durable project directory from the session;
-2. renders user, assistant, and tool activity into a bounded transcript;
+2. renders user, assistant, and tool activity into a bounded transcript, reading the event log through `session.snapshotEvents()` (falling back to the legacy `session.events` array on older hosts);
 3. summarizes the turn without blocking the active conversation;
 4. appends the result to `.memsearch/memory/YYYY-MM-DD.md` with a session anchor;
 5. lets the shared MemSearch index make the new entry searchable.
@@ -55,7 +55,7 @@ The same markdown journal can contain entries produced by Claude Code, Codex, DS
 `summarizeMode` selects the capture backend:
 
 - **`auto`** (default) uses a configured `[plugins.dsh.summarize]` provider when present; otherwise it uses `dsh-headless`.
-- **`dsh-headless`** starts a one-shot headless DSH agent using the model selected by the DSH deployment. The child process disables the MemSearch plugin to prevent recursive capture.
+- **`dsh-headless`** starts a one-shot headless DSH agent using the model selected by the DSH deployment. The child process is spawned with a closed stdin (immediate EOF) so nothing waits on an open pipe, and disables the MemSearch plugin to prevent recursive capture.
 - **`custom-llm`** calls a provider from the shared MemSearch configuration directly, which is useful for assigning a small dedicated summarization model.
 
 There is no silent fallback to a different backend. If the selected summarizer is unavailable, the journal records a short unavailable note with the original transcript anchor instead of writing an unsummarized conversation dump.
```

**File**: `plugins/dsh/index.js` (modified, +184/-69)
```diff
@@ -763,31 +763,76 @@ function sessionLogPath(ctx, session) {
  * turn carries no genuine user message.
  */
 function renderTurn(session, turnEndEvent) {
-  const turn = turnEndEvent.data.turn
-  const events = session.events
-  const startIndex = events.findIndex(
-    (event) => event.type === 'turn/start' && event.data.turn === turn,
-  )
-  if (startIndex < 0) return null
-  const endIndex = events.findIndex(
-    (event) => event.type === 'turn/end' && event.data.turn === turn,
-  )
-  const turnEvents = endIndex > startIndex ? events.slice(startIndex + 1, endIndex) : []
+  const turn = turnEndEvent?.data?.turn
+  if (turn === undefined) return null
+  // DSH Session replaced its public `events` array with `snapshotEvents()`.
+  // Prefer its immutable projection, but treat a throwing, malformed, empty,
+  // or incomplete projection as unusable and retry the legacy events array.
+  // Once a complete snapshot turn is found, its content is authoritative.
+  let snapshot
+  if (typeof session?.snapshotEvents === 'function') {
+    try {
+      snapshot = session.snapshotEvents()
+    } catch { /* retry the legacy projection */ }
+  }
+
+  const findTurn = (events) => {
+    if (!Array.isArray(events) || events.length === 0) return null
+
+    // Prefer the exact event that triggered capture. Identity works for the
+    // legacy array; seq works for immutable projections. Otherwise the latest
+    // matching end is the safest choice when malformed input repeats a turn.
+    let endIndex = events.findIndex(
+      (event) => event === turnEndEvent
+        && event?.type === 'turn/end'
+        && event?.data?.turn === turn,
+    )
+    if (endIndex < 0 && Number.isSafeInteger(turnEndEvent?.seq)) {
+      endIndex = events.findIndex(
+        (event) => event?.seq === turnEndEvent.seq
+          && event?.type === 'turn/end'
+          && event?.data?.turn === turn,
+      )
+    }
+    if (endIndex < 0) {
+      endIndex = events.findLastIndex(
+        (event) => event?.type === 'turn/end' && event?.data?.turn === turn,
+      )
+    }
+    if (endIndex < 0) return null
+
+    let startIndex = -1
+    for (let index = endIndex - 1; index >= 0; index -= 1) {
+      const event = events[index]
+      if (event?.type === 'turn/start' && event?.data?.turn === turn) {
+        startIndex = index
+        break
+      }
+    }
+    if (startIndex < 0) return null
+    return events.slice(startIndex + 1, endIndex)
+  }
+
+  let turnEvents = findTurn(snapshot)
+  if (turnEvents === null && session?.events !== snapshot) {
+    turnEvents = findTurn(session?.events)
+  }
+  if (turnEvents === null) return null
 
   const lines = [`=== Turn ${turn} ===`]
   let hasUser = false
   for (const event of turnEvents) {
-    if (event.type === 'user/message') {
-      if (event.data.source?.kind !== 'user') continue
-      const text = textFromContent(event.data.content)
+    if (event?.type === 'user/message') {
+      if (event.data?.source?.kind !== 'user') continue
+      const text = textFromContent(event.data?.content)
       if (!text) continue
       lines.push('', `[User]: ${text}`)
       hasUser = true
-    } else if (event.type === 'assistant/message') {
-      const text = textFromContent(event.data.message?.content)
+    } else if (event?.type === 'assistant/message') {
+      const text = textFromContent(event.data?.message?.content)
       if (!text) continue
       lines.push('', `[Assistant]: ${text}`)
-    } else if (event.type === 'tool/call') {
+    } else if (event?.type === 'tool/call' && event.data?.name) {
       lines.push('', `[Tool call]: ${event.data.name}`)
     }
   }
@@ -834,41 +879,116 @@ function writeCapture(memoryDir, body, sessionId, turn, dbPath) {
 // ---------------------------------------------------------------------------
 
 /**
- * Summarize one rendered turn via scripts/summarize.py — the memsearch-managed
- * `[llm.providers.*]` route (the `custom-llm` mode). Lightweight: a single
- * python process, no DSH boot. Model/provider come from memsearch config
- * (`[plugins.dsh.summarize]` → `[llm.providers.*]`), resolved by
- * `resolveSummarizeMode` into `opts.summarizeProvider` / `opts.summarizeModel`.
+ * Replace unpaired UTF-16 surrogate code units with U+FFFD.
+ *
+ * Transcripts can carry lone surrogates (e.g. from console-captured text).
+ * Normalize them explicitly so UTF-8 streams and platform argv conversion
+ * produce the same replacement text instead of relying on implicit behavior.
  */
-function summarizeCustomLlm(opts, render, projectDir) {
+function sanitizeSurrogates(text) {
+  return String(text).replace(
+    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
+    '\uFFFD',
+  )
+}
+
+/** Terminate a summarizer and its descendants after a timeout. */
+function killProcessTree(child) {
+  if (!child.pid) return
+  if (process.platform === 'win32') {
+    try {
+      execFileSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
```

**File**: `plugins/dsh/scripts/summarize.py` (modified, +8/-0)
```diff
@@ -35,6 +35,14 @@
 import sys
 from pathlib import Path
 
+# The child inherits the host's console code page (e.g. cp1251 on ru-RU
+# Windows); summaries legitimately contain multiplication/approximation signs and CJK.
+# Force UTF-8 with replacement so printing the summary never crashes.
+if sys.stdout and hasattr(sys.stdout, "reconfigure"):
+    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
+if sys.stderr and hasattr(sys.stderr, "reconfigure"):
+    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
+
 # ---------------------------------------------------------------------------
 # memsearch importability bootstrap (shared with plugins/_shared/scripts)
 # ---------------------------------------------------------------------------
```

**File**: `plugins/dsh/tests/index.test.js` (modified, +303/-1)
```diff
@@ -4,7 +4,7 @@ import { execFileSync } from 'node:child_process'
 import fs from 'node:fs'
 import os from 'node:os'
 
-import { detectDshCmd, summarizeTurn, apply, resolveSummarizeMode, renderTurn, captureExists, writeCapture, memsearchDirFor, listSkillCandidates, resolveSkillInstallTarget } from '../index.js'
+import { detectDshCmd, summarizeTurn, apply, resolveSummarizeMode, renderTurn, captureExists, writeCapture, memsearchDirFor, listSkillCandidates, resolveSkillInstallTarget, sanitizeSurrogates } from '../index.js'
 
 async function withInjectionFixture(searchResults, assertion, oldCore = false) {
   const root = fs.mkdtempSync(`${os.tmpdir()}/memsearch-inject-`)
@@ -360,6 +360,62 @@ test('summarizeTurn: custom-llm surfaces summarize.py stderr as a visible error'
   }
 })
 
+test('summarizeTurn: custom-llm normalizes stdin and preserves split UTF-8 stdout', async () => {
+  const root = fs.mkdtempSync(`${os.tmpdir()}/memsearch-custom-unicode-`)
+  const fakeBin = `${root}/bin`
+  const recorder = `${root}/recorder.mjs`
+  const stdinFile = `${root}/stdin.txt`
+  const prevPath = process.env.PATH
+  fs.mkdirSync(fakeBin)
+  fs.writeFileSync(
+    recorder,
+    'import { writeFileSync } from "node:fs";\n' +
+      'let input = "";\n' +
+      'process.stdin.setEncoding("utf8");\n' +
+      'process.stdin.on("data", (chunk) => { input += chunk; });\n' +
+      `process.stdin.on("end", () => { writeFileSync(${JSON.stringify(stdinFile)}, input, "utf8"); const bytes = Buffer.from("总结 × 😀", "utf8"); process.stdout.write(bytes.subarray(0, 2)); setImmediate(() => { process.stdout.write(bytes.subarray(2)); process.exit(0); }); });\n`,
+    'utf-8',
+  )
+  fs.writeFileSync(
+    `${fakeBin}/python3`,
+    `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(recorder)}\n`,
+    'utf-8',
+  )
+  fs.chmodSync(`${fakeBin}/python3`, 0o755)
+  try {
+    process.env.PATH = `${fakeBin}:/usr/bin:/bin`
+    const opts = { summarizeMode: 'custom-llm', agentName: 'X' }
+    const ctx = { logger: { warn: () => {} } }
+    const summary = await summarizeTurn(ctx, opts, `low:\udc98 pair:😀`, process.cwd())
+    assert.equal(summary, '总结 × 😀')
+    assert.equal(fs.readFileSync(stdinFile, 'utf-8'), 'low:� pair:😀')
+  } finally {
+    fs.rmSync(root, { recursive: true, force: true })
+    process.env.PATH = prevPath
+  }
+})
+
+test('summarizeTurn: custom-llm rejects an early stdin close', async () => {
+  const root = fs.mkdtempSync(`${os.tmpdir()}/memsearch-custom-epipe-`)
+  const fakeBin = `${root}/bin`
+  const prevPath = process.env.PATH
+  fs.mkdirSync(fakeBin)
+  fs.writeFileSync(`${fakeBin}/python3`, '#!/bin/sh\nexit 0\n', 'utf-8')
+  fs.chmodSync(`${fakeBin}/python3`, 0o755)
+  try {
+    process.env.PATH = `${fakeBin}:/usr/bin:/bin`
+    const opts = { summarizeMode: 'custom-llm', agentName: 'X', summarizeTimeoutMs: 1000 }
+    const ctx = { logger: { warn: () => {} } }
+    await assert.rejects(
+      summarizeTurn(ctx, opts, 'x'.repeat(8 * 1024 * 1024), process.cwd()),
+      /EPIPE|write/i,
+    )
+  } finally {
+    fs.rmSync(root, { recursive: true, force: true })
+    process.env.PATH = prevPath
+  }
+})
+
 test('detectDshCmd: falls back to pnpm global bin directory', async () => {
   const prevCli = process.env.DSH_CLI
   const prevPath = process.env.PATH
@@ -564,6 +620,7 @@ test('summarizeHeadless: does not build a --patch overlay for the model', async
   // We point DSH_CLI at a recorder script that writes its argv to a file, then
   // assert the recorded args contain no `--patch` (and no temp overlay path).
   const prevCli = process.env.DSH_CLI
+  const prevPath = process.env.PATH
   const prevDshSummarize = process.env.MEMSEARCH_DSH_SUMMARIZE
   const tmp = await import('node:os').then((os) => os.tmpdir())
   const fs = await import('node:fs')
@@ -577,6 +634,7 @@ test('summarizeHeadless: does not build a --patch overlay for the model', async
   const argvFile = `${tmp}/memsearch-dsh-argv-${process.pid}.txt`
   try {
     process.env.DSH_CLI = `sh ${recorder}`
+    process.env.PATH = '/usr/bin:/bin'
     process.env.MEMSEARCH_ARGV_FILE = argvFile
     const opts = {
       summarizeMode: 'dsh-headless',
@@ -603,11 +661,141 @@ test('summarizeHeadless: does not build a --patch overlay for the model', async
     delete process.env.MEMSEARCH_ARGV_FILE
     if (prevCli === undefined) delete process.env.DSH_CLI
     else process.env.DSH_CLI = prevCli
+    process.env.PATH = prevPath
     if (prevDshSummarize === undefined) delete process.env.MEMSEARCH_DSH_SUMMARIZE
     else process.env.MEMSEARCH_DSH_SUMMARIZE = prevDshSummarize
   }
 })
 
+test('summarizeHeadless: child receives EOF on stdin and does not hang', async () => {
+  // The spawned dsh child must not be left waiting on an open stdin pipe:
+  // a child (or wrapper script) that reads stdin to EOF would otherwise hang
+  // until the summarize timeout kills it. Point DSH_CLI at a Node recorder
+  // that exits only after stdin e
```

**File**: `plugins/dsh/tests/test_summarize.py` (modified, +24/-3)
```diff
@@ -6,6 +6,8 @@
 
 from __future__ import annotations
 
+import os
+import subprocess
 import sys
 from pathlib import Path
 from types import SimpleNamespace
@@ -18,6 +20,27 @@
 import summarize  # noqa: E402  (inserted above)
 
 
+def test_import_forces_utf8_stdout_and_stderr_under_legacy_code_page() -> None:
+    env = {**os.environ, "PYTHONIOENCODING": "cp1251:strict"}
+    expected_stdout = "摘要 \N{MULTIPLICATION SIGN} 😀"
+    code = (
+        "import sys; "
+        f"sys.path.insert(0, {str(SCRIPTS)!r}); "
+        "import summarize; "
+        f"print({expected_stdout!r}); "
+        "print('ошибка 中文', file=sys.stderr)"
+    )
+    result = subprocess.run(
+        [sys.executable, "-c", code],
+        env=env,
+        capture_output=True,
+        check=False,
+    )
+    assert result.returncode == 0, result.stderr.decode("utf-8", errors="replace")
+    assert result.stdout.decode("utf-8").strip() == expected_stdout
+    assert result.stderr.decode("utf-8").strip() == "ошибка 中文"
+
+
 def _provider(type_: str, model: str = "", base_url: str = "", api_key: str = "") -> SimpleNamespace:
     return SimpleNamespace(type=type_, model=model, base_url=base_url, api_key=api_key)
 
@@ -30,9 +53,7 @@ def make_config(**overrides) -> SimpleNamespace:
     llm = SimpleNamespace(provider="", model="", base_url="", api_key="", providers=providers)
     compact = SimpleNamespace(llm_provider="", llm_model="", base_url="", api_key="")
     prompts = SimpleNamespace(summarize="")
-    plugins = SimpleNamespace(
-        dsh=SimpleNamespace(summarize=SimpleNamespace(enabled=True, provider="", model=""))
-    )
+    plugins = SimpleNamespace(dsh=SimpleNamespace(summarize=SimpleNamespace(enabled=True, provider="", model="")))
     config = SimpleNamespace(llm=llm, compact=compact, prompts=prompts, plugins=plugins)
     return config
 
```

---

### Incident Patch 7: `4ad9ee4b` (2026-09-08)
**Commit Message**: fix(config): respect collection precedence (#726)

Treat directory-derived integration collections as fallback defaults so explicit project and global settings can override them. Keep direct call and CLI collection overrides at highest priority across all supported entrypoints.

**File**: `README.md` (modified, +1/-1)
```diff
@@ -668,7 +668,7 @@ memsearch reset --yes                              # drop all indexed data and r
 
 Embedding and Milvus backend settings → [Configuration (all platforms)](#️-configuration-all-platforms)
 
-Settings priority: Built-in defaults → `~/.memsearch/config.toml` → `.memsearch.toml` → CLI flags.
+Collection priority: integration-derived default → `~/.memsearch/config.toml` → `.memsearch.toml` → explicit `--collection` or Python argument. Without an integration-derived default, the built-in collection is used.
 
 > 📖 Full config guide: [Configuration](https://zilliztech.github.io/memsearch/home/configuration/)
 
```

**File**: `docs/architecture.md` (modified, +10/-8)
```diff
@@ -233,7 +233,7 @@ graph TD
 
 ### Physical Isolation
 
-Each platform plugin derives a collection name from the project path (e.g., `ms_claude_code_myproject`). This keeps memories from different projects separate within the same Milvus instance, avoiding the complexity of multi-tenant collection management while keeping the schema simple.
+Each platform plugin derives a collection name from the project path (e.g., `ms_claude_code_myproject`) and supplies it as a low-priority integration default. This keeps memories from different projects, including linked worktrees in different directories, separate within the same Milvus instance. An explicit collection in project/global config or the current call overrides that default, allowing intentional sharing without automatic scope merging.
 
 ---
 
@@ -277,21 +277,23 @@ The L3 transcript format varies by platform (Claude Code JSONL, Codex rollout JS
 
 ## Configuration System
 
-memsearch uses a 4-layer configuration system. Each layer overrides the one before it:
+memsearch uses a 5-layer configuration system. Each layer overrides the one before it:
 
 ```mermaid
 graph LR
-    D["1. Defaults"] --> G["2. Global Config<br>~/.memsearch/config.toml"]
-    G --> P["3. Project Config<br>.memsearch.toml"]
-    P --> C["4. CLI Flags<br>--milvus-uri, etc."]
+    D["1. Defaults"] --> I["2. Integration Defaults<br>derived collection"]
+    I --> G["3. Global Config<br>~/.memsearch/config.toml"]
+    G --> P["4. Project Config<br>.memsearch.toml"]
+    P --> C["5. Explicit Call/CLI<br>--collection, etc."]
 ```
 
 | Priority | Source | Scope | Example |
 |----------|--------|-------|---------|
 | 1 (lowest) | Built-in defaults | Hardcoded | `milvus.uri = ~/.memsearch/milvus.db` |
-| 2 | `~/.memsearch/config.toml` | User-global | Shared across all projects |
-| 3 | `.memsearch.toml` | Per-project | Committed to the repo or gitignored |
-| 4 (highest) | CLI flags | Per-command | `--milvus-uri http://...` |
+| 2 | Integration defaults | Caller context | A plugin's directory-derived collection |
+| 3 | `~/.memsearch/config.toml` | User-global | Shared across all projects |
+| 4 | `.memsearch.toml` | Per-project | Committed to the repo or gitignored |
+| 5 (highest) | Explicit call or CLI overrides | Per-command | `--milvus-uri http://...` |
 
 > **Note:** API keys for embedding and LLM providers (e.g. `OPENAI_API_KEY`, `GOOGLE_API_KEY`) are read from environment variables by their respective SDKs. They are not part of the memsearch configuration system and are never written to config files.
 
```

**File**: `docs/cli.md` (modified, +16/-2)
```diff
@@ -50,10 +50,12 @@ Commands:
 Manage memsearch configuration. Configuration is stored in TOML files and follows a layered priority chain:
 
 ```
-dataclass defaults -> ~/.memsearch/config.toml -> .memsearch.toml -> CLI flags
+dataclass defaults -> integration defaults -> ~/.memsearch/config.toml -> .memsearch.toml -> explicit CLI flags
 ```
 
-Higher-priority sources override lower-priority ones.
+Higher-priority sources override lower-priority ones. Platform integrations use
+`--default-collection` for a directory-derived fallback. Unlike the explicit
+`--collection` flag, this fallback stays below both global and project config.
 
 ### Subcommands
 
@@ -173,6 +175,10 @@ Supported plugin platforms are `claude-code`, `codex`, `opencode`, and
 
 Read a single resolved configuration value (merged from all sources).
 
+| Flag | Default | Description |
+|------|---------|-------------|
+| `--default-collection` | *(none)* | Supply a collection fallback below explicit global and project configuration |
+
 ```bash
 $ memsearch config get milvus.uri
 http://localhost:19530
@@ -194,6 +200,7 @@ Display configuration in TOML format by default, or JSON for scripting.
 | `--global` | | Show only the global config file (`~/.memsearch/config.toml`) |
 | `--project` | | Show only the project config file (`.memsearch.toml`) |
 | `--json-output`, `-j` | `false` | Output the selected configuration as JSON |
+| `--default-collection` | *(none)* | Supply a collection fallback for resolved output, below explicit configuration |
 
 ```bash
 $ memsearch config list --resolved
@@ -326,6 +333,7 @@ Scan one or more directories (or files) and index all markdown files (`.md`, `.m
 | `--base-url` | | *(none)* | OpenAI-compatible API base URL |
 | `--api-key` | | *(none)* | API key for the embedding provider |
 | `--collection` | `-c` | `memsearch_chunks` | Milvus collection name |
+| `--default-collection` | | *(none)* | Integration fallback used only when global/project config and `--collection` do not set a collection |
 | `--milvus-uri` | | `~/.memsearch/milvus.db` | Milvus connection URI |
 | `--milvus-token` | | *(none)* | Milvus auth token (for server or Zilliz Cloud) |
 | `--max-chunk-size` | | config value | Override `chunking.max_chunk_size` for this run |
@@ -409,6 +417,7 @@ Run a semantic search query against indexed chunks. Uses [hybrid search](https:/
 | `--base-url` | | *(none)* | OpenAI-compatible API base URL |
 | `--api-key` | | *(none)* | API key for the embedding provider |
 | `--collection` | `-c` | `memsearch_chunks` | Milvus collection name |
+| `--default-collection` | | *(none)* | Integration fallback used only when global/project config and `--collection` do not set a collection |
 | `--milvus-uri` | | `~/.memsearch/milvus.db` | Milvus connection URI |
 | `--milvus-token` | | *(none)* | Milvus auth token |
 | `--json-output` | `-j` | `false` | Output results as JSON |
@@ -485,6 +494,7 @@ Start a long-running file watcher that monitors directories for markdown file ch
 | `--base-url` | | *(none)* | OpenAI-compatible API base URL |
 | `--api-key` | | *(none)* | API key for the embedding provider |
 | `--collection` | `-c` | `memsearch_chunks` | Milvus collection name |
+| `--default-collection` | | *(none)* | Integration fallback used only when global/project config and `--collection` do not set a collection |
 | `--milvus-uri` | | `~/.memsearch/milvus.db` | Milvus connection URI |
 | `--milvus-token` | | *(none)* | Milvus auth token |
 | `--max-chunk-size` | | config value | Override `chunking.max_chunk_size` for this run |
@@ -542,6 +552,7 @@ Use an LLM to compress all indexed chunks (or a subset) into a condensed markdow
 | `--base-url` | | *(none)* | OpenAI-compatible API base URL |
 | `--api-key` | | *(none)* | API key for the embedding provider |
 | `--collection` | `-c` | `memsearch_chunks` | Milvus collection name |
+| `--default-collection` | | *(none)* | Integration fallback used only when global/project config and `--collection` do not set a collection |
 | `--milvus-uri` | | `~/.memsearch/milvus.db` | Milvus connection URI |
 | `--milvus-token` | | *(none)* | Milvus auth token |
 
@@ -624,6 +635,7 @@ Look up a chunk by its hash in the index and return the surrounding context from
 | `--base-url` | | *(none)* | OpenAI-compatible API base URL |
 | `--api-key` | | *(none)* | API key for the embedding provider |
 | `--collection` | `-c` | `memsearch_chunks` | Milvus collection name |
+| `--default-collection` | | *(none)* | Integration fallback used only when global/project config and `--collection` do not set a collection |
 | `--milvus-uri` | | `~/.memsearch/milvus.db` | Milvus connection URI |
 | `--milvus-token` | | *(none)* | Milvus auth token |
 
@@ -752,6 +764,7 @@ Show statistics about the current index, including the total number of stored ch
 | Flag | Short | Default | Description |
 |------|-------|---------|-------------|
 | `--collection` | `-c` | `memsearch_chunks` | Milvus collection name 
```

**File**: `docs/getting-started.md` (modified, +7/-4)
```diff
@@ -492,9 +492,10 @@ graph TD
 memsearch uses a layered configuration system. Settings are resolved in priority order (lowest to highest):
 
 1. **Built-in defaults** -- sensible out-of-the-box values
-2. **Global config** -- `~/.memsearch/config.toml`
-3. **Project config** -- `.memsearch.toml` in your working directory
-4. **CLI flags** -- `--milvus-uri`, `--provider`, etc.
+2. **Integration defaults** -- for example, a plugin's directory-derived collection
+3. **Global config** -- `~/.memsearch/config.toml`
+4. **Project config** -- `.memsearch.toml` in your working directory
+5. **Explicit CLI flags** -- `--milvus-uri`, `--provider`, `--collection`, etc.
 
 Higher-priority sources override lower ones. This means you can set defaults globally, customize per project, and override on the fly with CLI flags.
 
@@ -667,7 +668,9 @@ $ memsearch config list --project     # Show .memsearch.toml only
 
 ### CLI flag overrides
 
-CLI flags always take the highest priority:
+Explicit CLI flags always take the highest priority. The
+`--default-collection` integration flag is the exception: it is a fallback
+below global and project config, so plugins do not mask configured collections.
 
 ```bash
 $ memsearch index ./memory/ --provider google --milvus-uri http://localhost:19530
```

**File**: `docs/home/configuration.md` (modified, +24/-5)
```diff
@@ -2,11 +2,30 @@
 
 memsearch uses a layered TOML config system. Most users don't need to configure anything — the defaults work out of the box.
 
-## Config Locations (priority low → high)
-
-1. `~/.memsearch/config.toml` — global defaults
-2. `<project>/.memsearch.toml` — project-level overrides
-3. CLI flags — highest priority
+## Config Sources (priority low → high)
+
+1. Built-in defaults
+2. Integration defaults such as a plugin's directory-derived collection
+3. `~/.memsearch/config.toml` — global defaults
+4. `<project>/.memsearch.toml` — project-level overrides
+5. Explicit CLI flags or Python call arguments — highest priority
+
+Plugins pass their derived collection through `--default-collection`, so an
+explicit `[milvus].collection` in the project config overrides the derived
+name, and an explicit global collection overrides it when the project does not
+set one. An explicit `--collection` remains highest priority.
+
+The current Claude Code, Codex, OpenCode, OpenClaw, and DSH plugins require a
+memsearch core that exposes `--default-collection`. If that capability is not
+available, the plugin reports an incompatibility before running collection
+data operations; upgrade the core and plugin together. Existing CLI commands
+that do not use this integration-only flag remain unchanged.
+
+By default, ordinary repositories and linked Git worktrees use different
+directory-derived collections. To share indexed memory, set the same
+`[milvus].collection` value explicitly in each project's `.memsearch.toml` (or
+in global config when all projects should share it). Memsearch does not merge
+worktree scopes or migrate previously derived collections automatically.
 
 Since v0.4.11, project-level `.memsearch.toml` is intentionally restricted
 before it is merged. It can only set low-risk local indexing keys:
```

**File**: `docs/platforms/index.md` (modified, +2/-1)
```diff
@@ -92,7 +92,8 @@ All plugins write standard markdown and derive collection names from the project
 
 - Memories written in **Claude Code** are searchable from **Codex**, **DSH**, **OpenClaw**, or **OpenCode**
 - Same project directory = same collection name = shared memories
-- Different project directories are naturally isolated
+- Different project directories, including linked worktrees, are naturally isolated
+- Different directories share memory only when configured with the same explicit `[milvus].collection`
 
 ---
 
```

**File**: `plugins/claude-code/hooks/common.sh` (modified, +88/-29)
```diff
@@ -26,34 +26,84 @@ for p in "$HOME/.local/bin" "$HOME/.cargo/bin" "$HOME/bin" "/usr/local/bin"; do
   [[ -d "$p" ]] && [[ ":$PATH:" != *":$p:"* ]] && export PATH="$p:$PATH"
 done
 
-# Memory directory and memsearch state directory are project-scoped.
-# Prefer git root to avoid .memsearch scattered in subdirectories when
-# CLAUDE_PROJECT_DIR is unset (child claude -p) or points to a subdir.
-_GIT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "")"
+# Memory directory and memsearch state directory are project-scoped. A valid
+# host-provided project directory must win over the hook process cwd, which may
+# belong to an unrelated repository. Resolve a subdirectory to its own git root.
+if [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ -d "$CLAUDE_PROJECT_DIR" ]; then
+  _PROJECT_DIR="$CLAUDE_PROJECT_DIR"
+else
+  _PROJECT_DIR="$(pwd)"
+fi
+case "$_PROJECT_DIR" in
+  /*) ;;
+  *) _PROJECT_DIR="$(pwd)/$_PROJECT_DIR" ;;
+esac
+_GIT_ROOT="$(git -C "$_PROJECT_DIR" rev-parse --show-toplevel 2>/dev/null || echo "")"
 if [ -n "$_GIT_ROOT" ]; then
   _PROJECT_DIR="$_GIT_ROOT"
-else
-  _PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
 fi
 # When MEMSEARCH_DIR is explicitly set, use global scope (shared dir + collection).
 # Otherwise, default to per-project isolation.
 _MEMSEARCH_DIR_EXPLICIT="${MEMSEARCH_DIR:+true}"
 MEMSEARCH_DIR="${MEMSEARCH_DIR:-$_PROJECT_DIR/.memsearch}"
 MEMORY_DIR="$MEMSEARCH_DIR/memory"
 
-# Find memsearch binary: prefer PATH, fallback to uvx
+# Find memsearch binary: prefer PATH, fallback to uvx. Keep argv boundaries so
+# the uvx fallback and scoped execution do not depend on shell word splitting.
 _detect_memsearch() {
-  MEMSEARCH_CMD=""
+  MEMSEARCH_CMD=()
   if command -v memsearch &>/dev/null; then
-    MEMSEARCH_CMD="memsearch"
+    MEMSEARCH_CMD=(memsearch)
   elif command -v uvx &>/dev/null; then
-    MEMSEARCH_CMD="uvx --from memsearch[onnx] memsearch"
+    MEMSEARCH_CMD=(uvx --from "memsearch[onnx]" memsearch)
   fi
 }
 _detect_memsearch
 
 # Short command prefix for injected instructions (falls back to "memsearch" even if unavailable)
-MEMSEARCH_CMD_PREFIX="${MEMSEARCH_CMD:-memsearch}"
+MEMSEARCH_CMD_PREFIX="${MEMSEARCH_CMD[*]:-memsearch}"
+
+memsearch_available() {
+  [ "${#MEMSEARCH_CMD[@]}" -gt 0 ]
+}
+
+_run_in_project() {
+  (cd "$_PROJECT_DIR" && "$@")
+}
+
+project_path() {
+  case "$1" in
+    /*) printf '%s\n' "$1" ;;
+    *) printf '%s/%s\n' "$_PROJECT_DIR" "$1" ;;
+  esac
+}
+
+_memsearch() {
+  memsearch_available || return 127
+  _run_in_project "${MEMSEARCH_CMD[@]}" "$@"
+}
+
+_MEMSEARCH_DEFAULT_COLLECTION_SUPPORT=""
+
+memsearch_supports_default_collection() {
+  memsearch_available || return 1
+  if [ -z "$_MEMSEARCH_DEFAULT_COLLECTION_SUPPORT" ]; then
+    if _memsearch config get milvus.collection --default-collection "$COLLECTION_NAME" >/dev/null 2>&1; then
+      _MEMSEARCH_DEFAULT_COLLECTION_SUPPORT="true"
+    else
+      _MEMSEARCH_DEFAULT_COLLECTION_SUPPORT="false"
+    fi
+  fi
+  [ "$_MEMSEARCH_DEFAULT_COLLECTION_SUPPORT" = "true" ]
+}
+
+require_default_collection_support() {
+  if memsearch_supports_default_collection; then
+    return 0
+  fi
+  printf '%s\n' '[memsearch] ERROR: installed memsearch CLI is incompatible with this plugin; --default-collection support is required.' >&2
+  return 2
+}
 
 # Derive collection name: from MEMSEARCH_DIR when explicitly set (global scope),
 # otherwise from project directory (per-project isolation).
@@ -295,9 +345,9 @@ PY
 }
 
 skill_candidate_hint() {
-  [ -n "$MEMSEARCH_CMD" ] || return 0
+  memsearch_available || return 0
   [ -d "$MEMSEARCH_DIR/skill-candidates" ] || return 0
-  MEMSEARCH_DIR="$MEMSEARCH_DIR" $MEMSEARCH_CMD skills status --hint 2>/dev/null || true
+  MEMSEARCH_DIR="$MEMSEARCH_DIR" _memsearch skills status --hint 2>/dev/null || true
 }
 
 # Helper: ensure memory directory exists
@@ -310,20 +360,24 @@ COLLECTION_DESC=""
 
 # Helper: run memsearch with arguments, silently fail if not available
 run_memsearch() {
-  if [ -n "$MEMSEARCH_CMD" ] && [ -n "$COLLECTION_NAME" ]; then
-    $MEMSEARCH_CMD "$@" --collection "$COLLECTION_NAME" ${COLLECTION_DESC:+--description "$COLLECTION_DESC"} 2>/dev/null || true
-  elif [ -n "$MEMSEARCH_CMD" ]; then
-    $MEMSEARCH_CMD "$@" ${COLLECTION_DESC:+--description "$COLLECTION_DESC"} 2>/dev/null || true
+  memsearch_available || return 0
+  require_default_collection_support || return $?
+  if [ -n "$COLLECTION_NAME" ]; then
+    _memsearch "$@" --default-collection "$COLLECTION_NAME" ${COLLECTION_DESC:+--description "$COLLECTION_DESC"} 2>/dev/null || true
+  else
+    _memsearch "$@" ${COLLECTION_DESC:+--description "$COLLECTION_DESC"} 2>/dev/null || true
   fi
 }
 
 run_maintenance() {
   if command -v python3 >/dev/null 2>&1; then
-    MEMSEARCH_NO_WATCH=1 python3 "$SCRIPT_DIR/../scripts/maintenance-runner.py" \
-      --platform claude-code \
-      --project-dir "$_PROJECT_DIR" \
-      --memsearch-dir "$MEMSEARCH_DIR" \
-      >/dev/null 2>&1 || true
+    (
+  
```

**File**: `plugins/claude-code/hooks/session-start.sh` (modified, +35/-23)
```diff
@@ -11,7 +11,7 @@ exec < /dev/null
 source "$SCRIPT_DIR/common.sh"
 
 # Bootstrap: if memsearch not available, install uv and warm up uvx cache
-if [ -z "$MEMSEARCH_CMD" ]; then
+if ! memsearch_available; then
   if ! command -v uvx &>/dev/null; then
     curl -LsSf https://astral.sh/uv/install.sh | sh 2>/dev/null
     export PATH="$HOME/.local/bin:$PATH"
@@ -25,33 +25,43 @@ fi
 # First-time setup: if no config file exists, default to onnx provider.
 # This avoids requiring an OPENAI_API_KEY for new plugin users.
 # Existing users (who already have a config file) are not affected.
-if [ -n "$MEMSEARCH_CMD" ]; then
-  if [ ! -f "$HOME/.memsearch/config.toml" ] && [ ! -f "${CLAUDE_PROJECT_DIR:-.}/.memsearch.toml" ]; then
-    $MEMSEARCH_CMD config set embedding.provider onnx 2>/dev/null || true
+if memsearch_available; then
+  if [ ! -f "$HOME/.memsearch/config.toml" ] && [ ! -f "$_PROJECT_DIR/.memsearch.toml" ]; then
+    _memsearch config set embedding.provider onnx 2>/dev/null || true
   fi
 fi
 
 # Read resolved config in one CLI call. Older CLI versions do not support
 # --json-output, so keep the existing per-key reads as a compatibility fallback.
 PROVIDER="onnx"; MODEL=""; MILVUS_URI=""; CONFIG_API_KEY=""; VERSION=""
+EFFECTIVE_COLLECTION="$COLLECTION_NAME"
 CONFIG_SNAPSHOT_LOADED=false
-if [ -n "$MEMSEARCH_CMD" ]; then
-  CONFIG_JSON=$($MEMSEARCH_CMD config list --resolved --json-output 2>/dev/null || true)
+CORE_COMPATIBLE=true
+if memsearch_available; then
+  if ! memsearch_supports_default_collection; then
+    CORE_COMPATIBLE=false
+  fi
+  _config_list_args=(config list --resolved --json-output)
+  if [ "$CORE_COMPATIBLE" = true ] && [ -n "$COLLECTION_NAME" ]; then
+    _config_list_args+=(--default-collection "$COLLECTION_NAME")
+  fi
+  CONFIG_JSON=$(_memsearch "${_config_list_args[@]}" 2>/dev/null || true)
   SNAPSHOT_PROVIDER=$(_json_val "$CONFIG_JSON" "embedding.provider" "")
   if [ -n "$SNAPSHOT_PROVIDER" ]; then
     PROVIDER="$SNAPSHOT_PROVIDER"
     MODEL=$(_json_val "$CONFIG_JSON" "embedding.model" "")
     MILVUS_URI=$(_json_val "$CONFIG_JSON" "milvus.uri" "")
+    EFFECTIVE_COLLECTION=$(_json_val "$CONFIG_JSON" "milvus.collection" "$COLLECTION_NAME")
     CONFIG_API_KEY=$(_json_val "$CONFIG_JSON" "embedding.api_key" "")
     CONFIG_SNAPSHOT_LOADED=true
   else
-    PROVIDER=$($MEMSEARCH_CMD config get embedding.provider 2>/dev/null || echo "onnx")
-    MODEL=$($MEMSEARCH_CMD config get embedding.model 2>/dev/null || echo "")
-    MILVUS_URI=$($MEMSEARCH_CMD config get milvus.uri 2>/dev/null || echo "")
+    PROVIDER=$(_memsearch config get embedding.provider 2>/dev/null || echo "onnx")
+    MODEL=$(_memsearch config get embedding.model 2>/dev/null || echo "")
+    MILVUS_URI=$(_memsearch config get milvus.uri 2>/dev/null || echo "")
   fi
   # "memsearch, version 0.1.10" → "0.1.10"
   VERSION=$(_installed_version_from_dist_info)
-  [ -n "$VERSION" ] || VERSION=$($MEMSEARCH_CMD --version 2>/dev/null | sed 's/.*version //' || echo "")
+  [ -n "$VERSION" ] || VERSION=$(_memsearch --version 2>/dev/null | sed 's/.*version //' || echo "")
 fi
 
 # Determine required API key for the configured provider
@@ -70,8 +80,8 @@ REQUIRED_KEY=$(_required_env_var "$PROVIDER")
 KEY_MISSING=false
 if [ -n "$REQUIRED_KEY" ] && [ -z "${!REQUIRED_KEY:-}" ]; then
   # Env var not set — check if API key is configured in memsearch config file
-  if [ "$CONFIG_SNAPSHOT_LOADED" != true ] && [ -n "$MEMSEARCH_CMD" ]; then
-    CONFIG_API_KEY=$($MEMSEARCH_CMD config get embedding.api_key 2>/dev/null || echo "")
+  if [ "$CONFIG_SNAPSHOT_LOADED" != true ] && memsearch_available; then
+    CONFIG_API_KEY=$(_memsearch config get embedding.api_key 2>/dev/null || echo "")
   fi
   if [ -z "$CONFIG_API_KEY" ]; then
     KEY_MISSING=true
@@ -90,7 +100,7 @@ if [ -n "$VERSION" ]; then
     if [ -n "$_MS_BIN" ]; then
       _MS_REAL=$(_resolve_symlinks "$_MS_BIN")
     fi
-    if [[ "$MEMSEARCH_CMD" == *"uvx"* ]]; then
+    if [ "${MEMSEARCH_CMD[0]:-}" = "uvx" ]; then
       UPGRADE_CMD="uvx --upgrade --from 'memsearch[onnx]' memsearch --version"
     elif [[ "$_MS_REAL" == *"uv/tools"* ]]; then
       UPGRADE_CMD="uv tool upgrade memsearch"
@@ -106,11 +116,13 @@ fi
 # Build status line: version | provider/model | milvus | optional update/error
 VERSION_TAG="${VERSION:+ v${VERSION}}"
 COLLECTION_HINT=""
-if [ -n "$COLLECTION_NAME" ]; then
-  COLLECTION_HINT=" | collection: ${COLLECTION_NAME}"
+if [ -n "$EFFECTIVE_COLLECTION" ]; then
+  COLLECTION_HINT=" | collection: ${EFFECTIVE_COLLECTION}"
 fi
 status="[memsearch${VERSION_TAG}] embedding: ${PROVIDER}/${MODEL:-unknown} | milvus: ${MILVUS_URI:-unknown}${COLLECTION_HINT}${UPDATE_HINT}"
-if [ "$KEY_MISSING" = true ]; then
+if [ "$CORE_COMPATIBLE" != true ]; then
+  status+=" | ERROR: installed memsearch CLI is incompatible; --default-collection support is required"
+elif [ "$KEY_MISSING" = true ]; then
   status+=" | ERROR: ${REQUIRED_KEY} not set — memory search disabled"
 
```

---

### Incident Patch 8: `1ae26aa2` (2026-09-07)
**Commit Message**: fix(hooks): avoid reindexing Milvus Lite on every Claude Code stop (#723)

* fix(hooks): avoid Lite reindexing on every stop

* docs(claude-code): clarify backend lifecycle cleanup

**File**: `docs/platforms/claude-code/how-it-works.md` (modified, +25/-22)
```diff
@@ -43,10 +43,10 @@ The plugin defines 4 lifecycle hooks that map to Claude Code's session events:
 
 | Hook | Type | Async | Timeout | What It Does |
 |------|------|-------|---------|-------------|
-| **SessionStart** | command | no | 10s | Start `memsearch watch`, inject recent memories as cold-start context, display config status |
+| **SessionStart** | command | no | 10s | Start `memsearch watch` for Server or a one-shot index for Lite, inject recent memories as cold-start context, display config and index status |
 | **UserPromptSubmit** | command | no | 15s | Return `systemMessage` capability hint "[memsearch] Recall available if needed" (skips prompts < 10 chars) |
-| **Stop** | command | **yes** | 120s | Parse and summarize the last turn, lazily create its session heading, append to the daily `.md`, re-index |
-| **SessionEnd** | command | no | 10s | Stop the `memsearch watch` background process |
+| **Stop** | command | **yes** | 120s | Parse and summarize the last turn, lazily create its session heading, append to the daily `.md`; re-index immediately only for Server |
+| **SessionEnd** | command | **yes** | 10s | Asynchronously stop any Server watcher and clean up plugin-owned background index processes |
 
 All hooks output JSON to stdout -- `additionalContext` for context injection, `systemMessage` for visible hints, or empty `{}` for no-op. The `common.sh` shared library is sourced by every hook, providing JSON parsing, memsearch binary detection, and watch process management.
 
@@ -57,14 +57,11 @@ This diagram shows how a complete session flows through all four hooks:
 ```mermaid
 stateDiagram-v2
     [*] --> SessionStart
-    SessionStart --> WatchRunning: start memsearch watch
-    SessionStart --> InjectRecent: load recent memories (cold start)
-
-    state WatchRunning {
-        [*] --> Watching
-        Watching --> Reindex: file changed
-        Reindex --> Watching: done
-    }
+    SessionStart --> Backend
+    Backend --> ServerWatcher: Server starts memsearch watch
+    Backend --> LiteOneShot: Lite starts one-shot index
+    ServerWatcher --> InjectRecent
+    LiteOneShot --> InjectRecent
 
     InjectRecent --> Prompting
 
@@ -79,19 +76,23 @@ stateDiagram-v2
         ClaudeResponds --> UserInput: next turn
         ClaudeResponds --> Summary: Stop hook (async)
         Summary --> WriteMD: create heading if needed, then append
+        WriteMD --> ServerIndex: Server indexes immediately
+        ServerIndex --> UserInput: done
+        WriteMD --> UserInput: Lite waits for next SessionStart
     }
 
     Prompting --> SessionEnd: user exits
-    SessionEnd --> StopWatch: stop memsearch watch
-    StopWatch --> [*]
+    SessionEnd --> StopWatch: async cleanup stops Server watcher
+    StopWatch --> StopIndexes: stop plugin-owned indexes
+    StopIndexes --> [*]
 ```
 
 ### SessionStart -- Bootstrapping the Session
 
 The SessionStart hook runs once when Claude Code opens a new session. It performs four steps:
 
 1. **Config validation** -- loads resolved config in one snapshot and validates the API key for the configured embedding provider (ONNX needs no key)
-2. **Start watcher** -- launches `memsearch watch .memsearch/memory/` as a singleton background process (PID file at `.memsearch/.watch.pid` prevents duplicates)
+2. **Start backend-specific indexing** -- Server launches `memsearch watch .memsearch/memory/` as a singleton background process. Lite cannot share its local database with a watcher, so SessionStart launches one background `memsearch index` attempt instead. A persisted failed or stale index state is included in the visible status before the new attempt starts.
 3. **Cold-start injection** -- reads up to 40 lines from each of the 2 most recent daily logs and returns them as `additionalContext` so Claude has immediate awareness of recent work
 4. **Update check** -- queries PyPI (2s timeout) and shows an update banner if a newer version exists
 
@@ -118,7 +119,9 @@ graph TD
     C -->|Valid| D["parse-transcript.sh<br/>Extract last turn"]
     D --> E["claude -p --model haiku<br/>Summarize as 3rd-person notes"]
     E --> F["Create session heading if needed<br/>and append with anchors"]
-    F --> G["memsearch index<br/>Re-index immediately"]
+    F --> G{Milvus backend}
+    G -->|Server| H["memsearch index<br/>Re-index immediately"]
+    G -->|Lite| I["No Stop-time index<br/>Next SessionStart owns indexing"]
 ```
 
 Step by step:
@@ -150,11 +153,11 @@ Step by step:
     ```
     These anchors enable the L2→L3 drill-down: `memsearch expand` parses them to surface the transcript path, and the memory-recall skill can then use `memsearch transcript` to read the original conversation.
 
-6. **Re-index** -- runs `memsearch index` to ensure the new memory is immediately searchable (not just when the watcher picks up the file change).
+6. **Backend-specific indexing** -- Server runs `memsearch index` immediately after capture. Lite does not terminate or launch an index fro
```

**File**: `plugins/claude-code/README.md` (modified, +21/-20)
```diff
@@ -105,21 +105,18 @@ cat .memsearch/memory/$(date +%Y-%m-%d).md
 
 ## How It Works
 
-The plugin hooks into **4 Claude Code lifecycle events** and provides a **memory-recall skill**. A singleton `memsearch watch` process runs in the background, keeping the vector index in sync with markdown files as they change. (Milvus Lite falls back to one-time indexing at session start.)
+The plugin hooks into **4 Claude Code lifecycle events** and provides a **memory-recall skill**. With Milvus Server, a singleton `memsearch watch` process keeps the vector index in sync and Stop indexes newly captured memory immediately. Milvus Lite instead starts one one-shot index at SessionStart and does not index from Stop.
 
 ### Lifecycle Diagram
 
 ```mermaid
 stateDiagram-v2
     [*] --> SessionStart
-    SessionStart --> WatchRunning: start memsearch watch
-    SessionStart --> InjectRecent: load recent memories (cold start)
-
-    state WatchRunning {
-        [*] --> Watching
-        Watching --> Reindex: file changed
-        Reindex --> Watching: done
-    }
+    SessionStart --> Backend
+    Backend --> ServerWatcher: Server starts memsearch watch
+    Backend --> LiteOneShot: Lite starts one-shot index
+    ServerWatcher --> InjectRecent
+    LiteOneShot --> InjectRecent
 
     InjectRecent --> Prompting
 
@@ -134,21 +131,25 @@ stateDiagram-v2
         ClaudeResponds --> UserInput: next turn
         ClaudeResponds --> Summary: Stop hook (async, non-blocking)
         Summary --> WriteMD: append to YYYY-MM-DD.md
+        WriteMD --> ServerIndex: Server indexes immediately
+        ServerIndex --> UserInput: done
+        WriteMD --> UserInput: Lite waits for next SessionStart
     }
 
     Prompting --> SessionEnd: user exits
-    SessionEnd --> StopWatch: stop memsearch watch
-    StopWatch --> [*]
+    SessionEnd --> StopWatch: async cleanup stops Server watcher
+    StopWatch --> StopIndexes: stop plugin-owned indexes
+    StopIndexes --> [*]
 ```
 
 ### Hook Summary
 
 | Hook | Type | Async | Timeout | What It Does |
 |------|------|-------|---------|-------------|
-| **SessionStart** | command | no | 10s | Start `memsearch watch` singleton, inject recent daily logs as cold-start context via `additionalContext`, display config status (provider/model/milvus) in `systemMessage` |
+| **SessionStart** | command | no | 10s | Start the Server `memsearch watch` singleton or a Lite one-shot index, inject recent daily logs as cold-start context via `additionalContext`, display config and index status in `systemMessage` |
 | **UserPromptSubmit** | command | no | 15s | Capability hint: returns `systemMessage` "[memsearch] Recall available if needed" (skip if < 10 chars). No search — recall is handled by the memory-recall skill |
-| **Stop** | command | **yes** | 120s | Extract and summarize the last turn, lazily create its session heading, append the summary with session/turn anchors to the daily `.md` |
-| **SessionEnd** | command | no | 10s | Stop the `memsearch watch` background process (cleanup) |
+| **Stop** | command | **yes** | 120s | Extract and summarize the last turn, lazily create its session heading, append the summary with session/turn anchors to the daily `.md`; index immediately only for Server |
+| **SessionEnd** | command | **yes** | 10s | Asynchronously stop the Server watcher and clean up plugin-owned background indexes, including a running Lite one-shot |
 
 ### What Each Hook Does
 
@@ -157,7 +158,7 @@ stateDiagram-v2
 Fires once when a Claude Code session begins. This hook:
 
 1. **Reads config and checks API key.** Loads the resolved provider, model, API key, and Milvus URI in one `memsearch config list --resolved --json-output` snapshot. Older CLI versions automatically fall back to per-key `config get` calls. Checks whether the required API key is set for the provider (`OPENAI_API_KEY`, `GOOGLE_API_KEY`, `VOYAGE_API_KEY`, `JINA_API_KEY`, `MISTRAL_API_KEY`; `onnx`, `ollama`, and `local` need no key). If missing, shows an error in `systemMessage` and exits early.
-2. **Starts the watcher.** Launches `memsearch watch .memsearch/memory/` as a singleton background process (PID file lock prevents duplicates). The watcher monitors markdown files and auto-re-indexes on changes with a 1500ms debounce. Milvus Lite falls back to a one-time `memsearch index` at session start.
+2. **Starts backend-specific indexing.** With Milvus Server, launches `memsearch watch .memsearch/memory/` as a singleton background process (PID file lock prevents duplicates). The watcher monitors markdown files and auto-re-indexes on changes with a 1500ms debounce. Milvus Lite cannot share its local database with a watcher, so SessionStart launches one background `memsearch index` attempt instead.
 3. **Injects cold-start context.** Reads up to 40 lines from each of the 2 most recent daily logs and returns them as `additionalContext`. This gives Claude awareness of recent sessions, which helps it decide when to invoke the memory-recall s
```

**File**: `plugins/claude-code/hooks/stop.sh` (modified, +8/-5)
```diff
@@ -201,10 +201,13 @@ fi
   echo ""
 } >> "$MEMORY_FILE"
 
-# Kill any previous background index before re-indexing to avoid process accumulation
-kill_orphaned_index
-
-# Index immediately — don't rely on watch (which may be killed by SessionEnd before debounce fires)
-run_memsearch index "$MEMORY_DIR"
+# Server mode indexes immediately instead of relying on the watch debounce.
+# Lite mode keeps the SessionStart one-shot index: restarting it after every
+# turn can permanently starve a slow index before it completes.
+_uri="${MILVUS_URI:-$($MEMSEARCH_CMD config get milvus.uri 2>/dev/null || echo "")}"
+if [[ "$_uri" == http* ]] || [[ "$_uri" == tcp* ]]; then
+  kill_orphaned_index
+  run_memsearch index "$MEMORY_DIR"
+fi
 
 echo '{}'
```

**File**: `tests/test_claude_hooks.py` (modified, +187/-0)
```diff
@@ -662,6 +662,105 @@ def test_session_start_warns_when_index_state_is_unhealthy(tmp_path: Path) -> No
         assert "memory-config skill" in status
 
 
+@pytest.mark.skipif(os.name != "posix", reason="the controlled one-shot index uses a FIFO")
+@pytest.mark.parametrize("final_status", ["ok", "error"])
+def test_claude_session_start_lite_one_shot_persists_visible_state(tmp_path: Path, final_status: str) -> None:
+    script = Path("plugins/claude-code/hooks/session-start.sh")
+    home = tmp_path / "home"
+    fake_bin = tmp_path / "bin"
+    memsearch_dir = tmp_path / ".memsearch"
+    state = memsearch_dir / ".index-state.json"
+    started = tmp_path / "index-started"
+    release = tmp_path / "index-release"
+    uri_file = tmp_path / "milvus-uri"
+    home.mkdir()
+    fake_bin.mkdir()
+    memsearch_dir.mkdir()
+    (home / ".memsearch").mkdir()
+    (home / ".memsearch" / "config.toml").write_text("", encoding="utf-8")
+    (home / ".memsearch" / ".pypi-latest").write_text("0.4.14", encoding="utf-8")
+    uri_file.write_text(str(tmp_path / "lite.db"), encoding="utf-8")
+    os.mkfifo(release)
+
+    _write_executable(
+        fake_bin / "memsearch",
+        """#!/usr/bin/env bash
+uri=$(cat "$TEST_URI_FILE")
+write_state() {
+  printf '%s\n' "$1" > "$TEST_STATE_FILE.$$"
+  mv "$TEST_STATE_FILE.$$" "$TEST_STATE_FILE"
+}
+if [ "$1" = config ] && [ "$2" = list ]; then
+  printf '{"embedding":{"provider":"onnx","model":"test-model","api_key":""},"milvus":{"uri":"%s"}}\n' "$uri"
+  exit 0
+fi
+if [ "$1" = config ] && [ "$2" = get ]; then
+  case "$3" in
+    embedding.provider) echo onnx ;;
+    embedding.model) echo test-model ;;
+    milvus.uri) echo "$uri" ;;
+    *) echo "" ;;
+  esac
+  exit 0
+fi
+if [ "$1" = --version ]; then
+  echo 'memsearch, version 0.4.14'
+  exit 0
+fi
+if [ "$1" = index ]; then
+  write_state '{"schema_version":1,"status":"running"}'
+  : > "$TEST_STARTED_FILE"
+  IFS= read -r _ < "$TEST_RELEASE_FIFO"
+  if [ "$TEST_FINAL_STATUS" = ok ]; then
+    write_state '{"schema_version":1,"status":"ok","indexed_chunks":1}'
+    exit 0
+  fi
+  write_state '{"schema_version":1,"status":"error","last_error":"controlled failure"}'
+  exit 23
+fi
+exit 0
+""",
+    )
+    _write_executable(fake_bin / "pgrep", "#!/usr/bin/env bash\nexit 1\n")
+    env = {
+        **os.environ,
+        "HOME": str(home),
+        "PATH": f"{fake_bin}:{os.environ['PATH']}",
+        "CLAUDE_PROJECT_DIR": str(tmp_path),
+        "MEMSEARCH_DIR": str(memsearch_dir),
+        "TEST_URI_FILE": str(uri_file),
+        "TEST_STATE_FILE": str(state),
+        "TEST_STARTED_FILE": str(started),
+        "TEST_RELEASE_FIFO": str(release),
+        "TEST_FINAL_STATUS": final_status,
+    }
+
+    first = subprocess.run(["bash", str(script)], capture_output=True, text=True, env=env, check=True)
+    assert str(tmp_path / "lite.db") in json.loads(first.stdout)["systemMessage"]
+    assert _wait_for(started.exists)
+    release.write_text("complete\n", encoding="utf-8")
+    assert _wait_for(lambda: state.exists() and json.loads(state.read_text())["status"] == final_status)
+    persisted = json.loads(state.read_text(encoding="utf-8"))
+    assert persisted["status"] == final_status
+    if final_status == "ok":
+        assert persisted["indexed_chunks"] == 1
+    else:
+        assert persisted["last_error"] == "controlled failure"
+
+    # A fresh Lite SessionStart surfaces the previous result before launching its
+    # own one-shot index. Keep process cleanup disabled for this controlled child;
+    # the Lite indexing branch still runs and is released below.
+    started.unlink()
+    inspect_env = {**env, "MEMSEARCH_NO_WATCH": "1"}
+    second = subprocess.run(["bash", str(script)], capture_output=True, text=True, env=inspect_env, check=True)
+    status = json.loads(second.stdout)["systemMessage"]
+    assert str(tmp_path / "lite.db") in status
+    assert ("WARNING: memory index may be stale" in status) is (final_status == "error")
+    assert _wait_for(started.exists)
+    release.write_text("complete\n", encoding="utf-8")
+    assert _wait_for(lambda: state.exists() and json.loads(state.read_text())["status"] == final_status)
+
+
 def test_session_start_shows_skill_candidate_hint(tmp_path: Path) -> None:
     hint = "SKILLS: 2 candidate skill version(s) pending install - run the memory-to-skill skill to review and install."
     for name, script in (
@@ -828,6 +927,94 @@ def test_claude_stop_hook_writes_summary_without_safe_mode_flag(tmp_path: Path)
     assert captured_args[captured_args.index("--model") + 1] == "haiku"
 
 
+@pytest.mark.parametrize(
+    ("milvus_uri", "expected_index_calls", "expected_pgrep_calls"),
+    [
+        ("/tmp/memsearch-lite.db", 0, 0),
+        ("http://127.0.0.1:19530", 1, 2),
+        ("tcp://127.0.0.1:19530", 1, 2),
+    ],
+    ids=["lite", "http-server", "tcp-server"],
+)
+def test_claude_stop_indexes_only_server(
+    tmp_path: Path,
+    milvus_uri: str,
+    exp
```

---

### Incident Patch 9: `b82fc0ab` (2026-09-07)
**Commit Message**: fix: clarify memory recall status messages (#722)

**File**: `CLAUDE.md` (modified, +2/-2)
```diff
@@ -65,7 +65,7 @@ plugins/claude-code/
 ├── hooks/
 │   ├── common.sh                # Shared setup: PATH, memsearch detection, collection name, watch PID
 │   ├── session-start.sh         # SessionStart: start watch and inject recent memories
-│   ├── user-prompt-submit.sh    # UserPromptSubmit: lightweight hint reminding Claude about memory skill
+│   ├── user-prompt-submit.sh    # UserPromptSubmit: recall capability hint
 │   ├── stop.sh                  # Stop: extract last turn → summarize → lazily create heading → append (async)
 │   ├── session-end.sh           # SessionEnd: stop watch process
 │   └── parse-transcript.sh      # Last-turn extractor: finds last user question → EOF, formats with role labels for LLM (Python 3, no jq)
@@ -86,7 +86,7 @@ plugins/claude-code/
 
 **Supporting hooks:**
 - `SessionStart` injects cold-start context (recent daily logs) so Claude knows history exists
-- `UserPromptSubmit` returns a lightweight `systemMessage` hint ("[memsearch] Memory available") to increase skill trigger awareness
+- `UserPromptSubmit` returns a lightweight `systemMessage` capability hint ("[memsearch] Recall available if needed") to increase skill trigger awareness
 - `Stop` hook is async and non-blocking — extracts last turn only, calls `claude -p --model haiku` (with `CLAUDECODE=` to bypass nested session detection) to summarize as third-person notes, appends to daily `.md`
 
 When modifying hooks/skills, keep in mind:
```

**File**: `docs/platforms/claude-code/how-it-works.md` (modified, +4/-4)
```diff
@@ -44,7 +44,7 @@ The plugin defines 4 lifecycle hooks that map to Claude Code's session events:
 | Hook | Type | Async | Timeout | What It Does |
 |------|------|-------|---------|-------------|
 | **SessionStart** | command | no | 10s | Start `memsearch watch`, inject recent memories as cold-start context, display config status |
-| **UserPromptSubmit** | command | no | 15s | Return `systemMessage` hint "[memsearch] Memory available" (skips prompts < 10 chars) |
+| **UserPromptSubmit** | command | no | 15s | Return `systemMessage` capability hint "[memsearch] Recall available if needed" (skips prompts < 10 chars) |
 | **Stop** | command | **yes** | 120s | Parse and summarize the last turn, lazily create its session heading, append to the daily `.md`, re-index |
 | **SessionEnd** | command | no | 10s | Stop the `memsearch watch` background process |
 
@@ -71,7 +71,7 @@ stateDiagram-v2
     state Prompting {
         [*] --> UserInput
         UserInput --> Hint: UserPromptSubmit hook
-        Hint --> ClaudeProcesses: "[memsearch] Memory available"
+        Hint --> ClaudeProcesses: "[memsearch] Recall available if needed"
         ClaudeProcesses --> MemoryRecall: needs context?
         MemoryRecall --> Subagent: memory-recall skill [fork]
         Subagent --> ClaudeResponds: curated summary
@@ -99,9 +99,9 @@ SessionStart prepares the memory directory but does not create a daily journal.
 
 The cold-start injection is critical for early-session context. Without it, Claude would have no idea what happened yesterday until the memory-recall skill triggers -- but the skill only triggers when Claude judges it would help, which requires knowing that relevant history exists.
 
-### UserPromptSubmit -- The Memory Hint
+### UserPromptSubmit -- The Recall Capability Hint
 
-A lightweight hook that returns a `systemMessage` hint: `[memsearch] Memory available -- use /memory-recall if needed`. This keeps Claude aware that the memory system exists, increasing the likelihood that it will invoke the memory-recall skill when a question benefits from historical context.
+A lightweight hook that returns a `systemMessage` capability hint: `[memsearch] Recall available if needed`. The hook does not search or imply a match; it keeps Claude aware that the memory system exists, increasing the likelihood that it will invoke the memory-recall skill when a question benefits from historical context.
 
 The hook skips prompts shorter than 10 characters (e.g., "y", "ok") to avoid noise on trivial confirmations.
 
```

**File**: `docs/platforms/claude-code/troubleshooting.md` (modified, +1/-1)
```diff
@@ -189,7 +189,7 @@ The ONNX bge-m3 int8 model (~558 MB) downloads from HuggingFace Hub on first use
 
 - First session hangs after sending a prompt
 - `memsearch search` or `memsearch index` hang on first run
-- `[memsearch] Memory available` appears but recall returns no results
+- `[memsearch] Recall available if needed` appears but recall returns no results
 
 **Pre-download:**
 ```bash
```

**File**: `docs/platforms/codex/how-it-works.md` (modified, +6/-4)
```diff
@@ -5,7 +5,7 @@
 | Event | What memsearch does |
 |-------|-------------------|
 | **Session starts** | Clean up orphaned processes, start watch (Server) or one-time index (Lite), write session heading, inject recent memories, check for updates |
-| **Each prompt** | Memory-recall skill hint displayed via `systemMessage` |
+| **Each prompt** | Recall capability hint displayed via `systemMessage`; no search runs in this hook |
 | **Each turn ends** | Conversation summarized via `codex exec` (async) and saved to daily `.md` |
 
 ---
@@ -17,9 +17,11 @@ The Codex plugin uses 3 shell hooks (Codex does not have a `SessionEnd` hook):
 | Hook | Type | Async | Timeout | What It Does |
 |------|------|-------|---------|-------------|
 | **SessionStart** | command | no | 30s | Cleanup orphans, bootstrap memsearch, start watch/index, write session heading, inject memories, display status |
-| **UserPromptSubmit** | command | no | 10s | Return `systemMessage` hint "[memsearch] Memory available" |
+| **UserPromptSubmit** | command | no | 10s | Return `systemMessage` capability hint "[memsearch] Recall available if needed" |
 | **Stop** | command | **yes** | 30s | Summarize the last turn via `codex exec`, using a rollout transcript when available and `history.jsonl` + `last_assistant_message` otherwise |
 
+The `UserPromptSubmit` hook does not search memory or imply a match. Actual retrieval happens only when Codex invokes the `memory-recall` skill.
+
 ### Hook Lifecycle
 
 ```mermaid
@@ -34,7 +36,7 @@ stateDiagram-v2
     state Prompting {
         [*] --> UserInput
         UserInput --> Hint: UserPromptSubmit hook
-        Hint --> CodexProcesses: "[memsearch] Memory available"
+        Hint --> CodexProcesses: "[memsearch] Recall available if needed"
         CodexProcesses --> MemoryRecall: needs context?
         MemoryRecall --> SkillRun: $memory-recall skill
         SkillRun --> CodexResponds: search + expand results
@@ -270,7 +272,7 @@ plugins/codex/
 │   ├── common.sh                   # Shared setup: JSON helpers, process management, orphan cleanup
 │   ├── session-start.sh            # SessionStart: bootstrap, watch/index, cold-start injection
 │   ├── stop.sh                     # Stop: async capture via codex exec, local fallback
-│   └── user-prompt-submit.sh       # UserPromptSubmit: memory availability hint
+│   └── user-prompt-submit.sh       # UserPromptSubmit: recall capability hint
 ├── skills/
 │   └── memory-recall/
 │       └── SKILL.md                # Memory recall skill ($memory-recall)
```

**File**: `docs/platforms/dsh/how-it-works.md` (modified, +3/-3)
```diff
@@ -11,8 +11,8 @@ flowchart LR
     MD --> INDEX[Milvus hybrid index]
 
     PROMPT[Next user prompt] --> SEARCH[Search project memory]
-    SEARCH -->|relevant results| INJECT[Inject before model step 1]
-    SEARCH -->|no relevant results| CLEAN[Leave context unchanged]
+    SEARCH -->|chunks returned| INJECT[Inject before model step 1]
+    SEARCH -->|no chunks returned| CLEAN[Leave context unchanged]
 
     QUESTION[History question] --> SKILL[memory-recall skill]
     SKILL --> SEARCH
@@ -34,7 +34,7 @@ Capture jobs are serialized so summarizers do not overlap. Session and turn anch
 
 ## Selective Pre-Step Injection
 
-At the first model step of a new turn, the plugin searches memory using the user's question. When useful matches exist, it injects a small set of relevant snippets and a `[memsearch] Memory available.` hint. When the search has no relevant result, the model context is left unchanged.
+At the first model step of a new turn, the plugin searches memory using the user's question. When the search returns chunks, it injects a small set of candidate snippets and a `[memsearch] Retrieved memory context attached.` marker. When the search returns no chunks, the model context is left unchanged. The model still evaluates whether each retrieved chunk is relevant.
 
 This keeps routine turns lightweight while still surfacing past decisions when they matter.
 
```

**File**: `docs/platforms/dsh/index.md` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ Use memory-recall to find what we decided about the deployment architecture.
 | Event | MemSearch behavior |
 |-------|--------------------|
 | **A turn completes** | Summarizes the user, assistant, and tool activity into the project's daily markdown journal |
-| **A new turn begins** | Searches the project memory and injects only relevant results before the first model step |
+| **A new turn begins** | Searches project memory and, when chunks are returned, injects candidate snippets before the first model step |
 | **The agent needs exact history** | Uses `memory-recall` to search, expand a section, and inspect the original DSH transcript |
 | **A DSH session closes** | Runs enabled maintenance tasks when their configured interval is due |
 | **You open the web dock** | Lists skill candidates and previews supported `.memsearch` files without modifying them |
```

**File**: `docs/platforms/dsh/installation.md` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ The plugin works without configuration. Its DSH profile settings control lifecyc
 | Setting | Default | Purpose |
 |---------|---------|---------|
 | `captureEnabled` | `true` | Capture completed turns into the daily memory journal |
-| `injectEnabled` | `true` | Search and inject relevant memory before the first model step |
+| `injectEnabled` | `true` | Search and inject returned memory candidates before the first model step |
 | `summarizeEnabled` | `true` | Summarize turns before writing them |
 | `summarizeMode` | `auto` | Use a configured API provider when present; otherwise use a one-shot DSH headless agent |
 
```

**File**: `plugins/_shared/skills/memory-config/references/dsh.md` (modified, +1/-1)
```diff
@@ -67,7 +67,7 @@ These are NOT in the MemSearch TOML. They live in the profile patch under the
 - id: memsearch
   config:
     captureEnabled: true     # capture completed turns
-    injectEnabled: true      # inject relevant memory
+    injectEnabled: true      # inject returned memory candidates
     summarizeEnabled: true   # summarize turns before writing
     summarizeMode: auto      # auto | dsh-headless | custom-llm
 ```
```

---

### Incident Patch 10: `6f86211d` (2026-09-05)
**Commit Message**: fix(opencode): omit turn text when summaries fail (#719)

Replace OpenCode capture's raw-turn fallback with a bounded unavailable note.
Treat summary setup and execution failures as unavailable while retaining
transcript anchors and the existing isolated XDG data boundary.

**File**: `plugins/opencode/README.md` (modified, +4/-2)
```diff
@@ -164,10 +164,12 @@ memsearch config set plugins.opencode.summarize.provider openai
 ```
 
 Leave `plugins.opencode.summarize.provider` empty or set it to `native` to keep the current `small_model` / plugin default behavior. This setting does not fall back to `llm.model`.
+Native summaries run with isolated XDG config and data directories, and the plugin does not copy the user's OpenCode auth store into them. If that environment cannot authenticate, capture retains only an unavailable note and the transcript anchor.
+Native `opencode run` output must contain bullet lines. The managed-provider command keeps its existing contract and accepts any non-empty plain-text summary.
 
 ## How It Works
 
-1. **Capture**: After each conversation turn, the plugin extracts the user+assistant exchange, summarizes it via LLM, and appends to a daily markdown file.
+1. **Capture**: After each conversation turn, the plugin extracts the user+assistant exchange, sends it to the configured summarizer, and appends the result to a daily markdown file. If summarization fails, times out, exits unsuccessfully, or returns no usable output, the plugin writes a short unavailable note instead of the turn text. The transcript remains accessible through the entry's progressive-disclosure anchor.
 
 2. **Index**: The markdown files are indexed by memsearch into a Milvus collection (Milvus Lite by default, runs in-process).
 
@@ -181,6 +183,6 @@ Leave `plugins.opencode.summarize.provider` empty or set it to `native` to keep
 |---------|-------------|----------|----------|
 | Session storage | JSONL | SQLite | JSONL |
 | Hook system | Shell scripts | TypeScript hooks | JS API |
-| Summarizer | claude -p --model haiku | opencode prompt | openclaw agent |
+| Summarizer | claude -p --model haiku | opencode run | openclaw agent |
 | Context injection | SessionStart hook | system.transform | before_agent_start |
 | Skill context | context: fork | N/A (no fork) | N/A |
```

**File**: `plugins/opencode/scripts/capture-daemon.py` (modified, +24/-19)
```diff
@@ -40,6 +40,10 @@
 
 _ANCHOR_RE = re.compile(r"<!-- session:([^ ]+) turn:([^ ]+) db:")
 _TAIL_TURN_QUIET_PERIOD_MS = int(os.environ.get("MEMSEARCH_OPENCODE_TAIL_QUIET_MS", "300000"))
+_SUMMARY_UNAVAILABLE = (
+    "- Memory summary unavailable: summarizer failed or returned no usable output; "
+    "transcript content was omitted. Use the transcript anchor for progressive disclosure."
+)
 
 
 class TailTurnObservation:
@@ -402,15 +406,15 @@ def summarize_with_llm(
     project_dir: str | os.PathLike[str] | None = None,
 ) -> str | None:
     """Summarize using configured provider routing."""
-    if not get_plugin_summarize_enabled(memsearch_cmd):
-        return None
+    try:
+        if not get_plugin_summarize_enabled(memsearch_cmd):
+            return None
 
-    system_prompt = _load_summarize_prompt("OpenCode", memsearch_cmd)
-    full_prompt = f"{system_prompt}\n\nTranscript:\n{turn_text}"
+        system_prompt = _load_summarize_prompt("OpenCode", memsearch_cmd)
+        full_prompt = f"{system_prompt}\n\nTranscript:\n{turn_text}"
 
-    summarize_provider = get_plugin_summarize_provider(memsearch_cmd)
-    if summarize_provider and summarize_provider != "native" and memsearch_cmd:
-        try:
+        summarize_provider = get_plugin_summarize_provider(memsearch_cmd)
+        if summarize_provider and summarize_provider != "native" and memsearch_cmd:
             result = subprocess.run(
                 [*split_memsearch_cmd(memsearch_cmd), "summarize", "--plugin", "opencode", "--agent-name", "OpenCode"],
                 input=turn_text,
@@ -421,27 +425,26 @@ def summarize_with_llm(
                 timeout=30,
                 env={**os.environ, "MEMSEARCH_NO_WATCH": "1"},
             )
+            if result.returncode != 0:
+                return None
             output = result.stdout.strip()
             lines = output.split("\n")
             bullets = [line for line in lines if line.strip().startswith("- ")]
             if bullets:
                 return "\n".join(bullets)
             if output:
                 return output
-        except Exception:
-            pass
-        return None
 
-    # Native path: summarize using opencode run in isolated env (no plugins -> no recursion).
-    isolated_dir = ensure_isolated_config(project_dir)
+            return None
 
-    summarize_model = get_plugin_summarize_model(memsearch_cmd) or small_model
-    cmd = ["opencode", "run"]
-    if summarize_model:
-        cmd += ["-m", summarize_model]
-    cmd.append(full_prompt)
+        # Native path: summarize using opencode run in isolated env (no plugins -> no recursion).
+        isolated_dir = ensure_isolated_config(project_dir)
+        summarize_model = get_plugin_summarize_model(memsearch_cmd) or small_model
+        cmd = ["opencode", "run"]
+        if summarize_model:
+            cmd += ["-m", summarize_model]
+        cmd.append(full_prompt)
 
-    try:
         result = subprocess.run(
             cmd,
             env={
@@ -458,6 +461,8 @@ def summarize_with_llm(
             text=True,
             timeout=30,
         )
+        if result.returncode != 0:
+            return None
         output = result.stdout.strip()
         lines = output.split("\n")
         bullets = [line for line in lines if line.strip().startswith("- ")]
@@ -767,7 +772,7 @@ def capture_session_turns(
             summary = summarize_with_llm(turn_text, small_model, memsearch_cmd, project_dir)
             write_capture(
                 memory_dir,
-                summary if summary else turn_text,
+                summary if summary else _SUMMARY_UNAVAILABLE,
                 session_id,
                 turn.turn_id,
                 db_path,
```

**File**: `tests/test_opencode_turns.py` (modified, +217/-1)
```diff
@@ -765,6 +765,221 @@ def test_capture_session_turns_keeps_monotonic_turn_index_across_batches(
     conn.close()
 
 
+def _prepare_summary_capture(
+    tmp_path: Path,
+    session_id: str,
+    marker: str,
+    assistant_text: str = "Answer",
+) -> tuple[sqlite3.Connection, sqlite3.Connection, Path, Path, Path]:
+    db_path = tmp_path / "opencode.db"
+    conn = _make_opencode_db(db_path)
+    project_dir = tmp_path / "project"
+    project_dir.mkdir()
+    memory_dir = project_dir / ".memsearch" / "memory"
+
+    _insert_message(conn, "u1", session_id, 100, "user", text=marker)
+    _insert_message(
+        conn,
+        "a1",
+        session_id,
+        110,
+        "assistant",
+        parent_id="u1",
+        finish="stop",
+        text=assistant_text,
+    )
+    _insert_message(conn, "u2", session_id, 200, "user", text="Close the first turn")
+    conn.commit()
+    return conn, open_turn_db(str(project_dir)), db_path, project_dir, memory_dir
+
+
+def _run_summary_capture(
+    conn: sqlite3.Connection,
+    turn_db: sqlite3.Connection,
+    db_path: Path,
+    memory_dir: Path,
+    session_id: str,
+) -> str:
+    capture_daemon.capture_session_turns(
+        conn,
+        turn_db,
+        str(memory_dir),
+        session_id,
+        "",
+        "memsearch",
+        str(db_path),
+    )
+    return next(memory_dir.glob("*.md")).read_text(encoding="utf-8")
+
+
+@pytest.mark.parametrize("mode", ["missing", "failure", "nonzero", "empty", "unusable", "timeout"])
+def test_capture_session_turns_omits_transcript_when_native_summary_fails(
+    tmp_path: Path,
+    monkeypatch,
+    mode: str,
+) -> None:
+    session_id = "ses_summary_failure"
+    marker = "S651_SYNTHETIC_PRIVATE_TURN_MARKER"
+    conn, turn_db, db_path, _, memory_dir = _prepare_summary_capture(tmp_path, session_id, marker)
+    isolated_root = tmp_path / "isolated"
+
+    monkeypatch.setattr(capture_daemon, "get_plugin_summarize_enabled", lambda *args: True)
+    monkeypatch.setattr(capture_daemon, "get_plugin_summarize_provider", lambda *args: "")
+    monkeypatch.setattr(capture_daemon, "get_plugin_summarize_model", lambda *args: "")
+    monkeypatch.setattr(capture_daemon, "_load_summarize_prompt", lambda *args: "Summarize safely.")
+    monkeypatch.setattr(capture_daemon, "ensure_isolated_config", lambda *args: str(isolated_root))
+
+    def fail_native(cmd, **kwargs):
+        if mode == "missing":
+            raise FileNotFoundError("opencode")
+        if mode == "failure":
+            raise RuntimeError("synthetic native failure")
+        if mode == "timeout":
+            raise subprocess.TimeoutExpired(cmd, kwargs["timeout"])
+        if mode == "nonzero":
+            return subprocess.CompletedProcess(cmd, 23, stdout=f"- {marker}\n", stderr="synthetic failure")
+        if mode == "unusable":
+            return subprocess.CompletedProcess(cmd, 0, stdout=f"{marker}\n", stderr="")
+        return subprocess.CompletedProcess(cmd, 0, stdout="", stderr="")
+
+    monkeypatch.setattr(capture_daemon.subprocess, "run", fail_native)
+
+    content = _run_summary_capture(conn, turn_db, db_path, memory_dir, session_id)
+    assert marker not in content
+    assert "Memory summary unavailable" in content
+    assert "transcript content was omitted" in content
+    assert f"<!-- session:{session_id} turn:u1 db:{db_path} -->" in content
+    assert load_turn_state(turn_db, session_id).last_completed_turn_id == "u1"
+
+    turn_db.close()
+    conn.close()
+
+
+def test_capture_session_turns_omits_transcript_when_prompt_loading_raises(
+    tmp_path: Path,
+    monkeypatch,
+) -> None:
+    session_id = "ses_prompt_exception"
+    marker = "S651_SYNTHETIC_PROMPT_EXCEPTION_MARKER"
+    conn, turn_db, db_path, _, memory_dir = _prepare_summary_capture(
+        tmp_path,
+        session_id,
+        marker,
+        "Synthetic answer",
+    )
+
+    monkeypatch.setattr(capture_daemon, "get_plugin_summarize_enabled", lambda *args: True)
+
+    def raise_prompt_decode_error(*args):
+        raise UnicodeError("synthetic unreadable prompt")
+
+    monkeypatch.setattr(capture_daemon, "_load_summarize_prompt", raise_prompt_decode_error)
+
+    content = _run_summary_capture(conn, turn_db, db_path, memory_dir, session_id)
+    assert marker not in content
+    assert "Synthetic answer" not in content
+    assert capture_daemon._SUMMARY_UNAVAILABLE in content
+    assert f"<!-- session:{session_id} turn:u1 db:{db_path} -->" in content
+    assert load_turn_state(turn_db, session_id).last_completed_turn_id == "u1"
+
+    turn_db.close()
+    conn.close()
+
+
+@pytest.mark.parametrize("mode", ["exception", "nonzero", "empty", "timeout"])
+def test_capture_session_turns_omits_transcript_when_managed_summary_fails(
+    tmp_path: Path,
+    monkeypatch,
+    mode: str,
+) -> None:
+    session_id = "ses_managed_summary_failure"
+    marker = "S651_SYNTHETIC_MANAGED_PRIVATE_MARKER"
+    conn, turn_db, db_path, _, memory_dir = _pre
```

---

### Incident Patch 11: `12661df2` (2026-08-31)
**Commit Message**: fix: enable best-effort Milvus Lite on Windows

**File**: `docs/faq.md` (modified, +3/-3)
```diff
@@ -10,13 +10,13 @@ See [Architecture — Indexing Cost Model](architecture.md#indexing-cost-model)
 
 ## Does memsearch work on Windows?
 
-Yes, but **Milvus Lite** (the default local `.db` backend) does not provide Windows binaries.
+Milvus Server and Zilliz Cloud remain the recommended Windows backends. Milvus Lite 3.x now provides a Windows-capable foundation, so memsearch no longer blocks the default local backend on Windows. This local path is best-effort: it has not received one-to-one native Windows validation by the memsearch maintainers and is not part of the formal support matrix.
 
-If you are on Windows, use one of these options instead:
+If the local backend fails, use one of these alternatives:
 
 - **Milvus Server** via Docker
 - **Zilliz Cloud**
-- **WSL2** if you specifically want the Milvus Lite local-file workflow
+- **WSL2** for a Linux-based Milvus Lite local workflow
 
 See [Getting Started — Milvus Backends](getting-started.md#milvus-backends) for the backend comparison and recommended setup.
 
```

**File**: `docs/getting-started.md` (modified, +4/-2)
```diff
@@ -368,8 +368,10 @@ Data is stored in a single local `.db` file. No server to install, no ports to o
 
 **Best for:** personal use, single-agent setups, prototyping, development.
 
-!!! warning "Windows not supported"
-    Milvus Lite does not provide Windows binaries ([milvus-lite#176](https://github.com/milvus-io/milvus-lite/issues/176)). On Windows, use **Milvus Server** (Docker) or **Zilliz Cloud** instead. Alternatively, run memsearch inside [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install).
+!!! warning "Native Windows is best-effort"
+    Milvus Lite 3.x provides a Windows-capable foundation, and memsearch selects versions containing the required Windows fixes. This path has not received one-to-one native Windows validation by the memsearch maintainers and is not part of the formal support matrix. Use **Milvus Server**, **Zilliz Cloud**, or [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install) if the local backend fails.
+
+Collection descriptions are best-effort metadata. Some Milvus Lite 3.x versions accept a description during collection creation but return an empty value later. Memsearch does not use description round-trip for indexing or search correctness.
 
 === "Python"
 
```

**File**: `docs/troubleshooting.md` (modified, +19/-8)
```diff
@@ -51,13 +51,13 @@ If you do not want to manage API keys, switch to a local provider such as ONNX,
 
 ## Windows + Milvus Lite
 
-Milvus Lite (the default local `.db` backend) does not provide Windows binaries.
+Milvus Lite 3.x provides a Windows-capable foundation, and memsearch installs `milvus-lite>=3.1.1` with `pymilvus>=2.6.11` on Windows. The local path is best-effort because the memsearch maintainers have not completed one-to-one native Windows validation; it is not part of the formal support matrix.
 
-On Windows, use one of these options instead:
+If the local backend fails, use one of these alternatives:
 
 - Milvus Server via Docker
 - Zilliz Cloud
-- WSL2 if you specifically want the local Milvus Lite workflow
+- WSL2 for a Linux-based Milvus Lite workflow
 
 See [Getting Started — Milvus Backends](getting-started.md#milvus-backends).
 
@@ -71,12 +71,23 @@ Collection '...' is in state 'released'; call load() before search/get/query
 
 Upgrade memsearch first. Current memsearch versions explicitly load existing Milvus collections before query/search operations.
 
-If this started after upgrading Milvus Lite, check whether the local `.db` file was created by an older Milvus Lite release. Milvus Lite 3.x uses a new pure-Python storage engine and cannot read `.db` files from the previous storage format. Move the old `.db` file aside, then rebuild the index from source markdown:
+If this started after upgrading Milvus Lite, check whether the local `.db` file was created by an older Milvus Lite release. Milvus Lite 3.x uses a different storage layout and cannot automatically migrate a 2.x `.db` file. Preserve the old database and your source markdown, move the database aside manually, then rebuild the derived index from markdown:
 
-```bash
-mv ~/.memsearch/milvus.db ~/.memsearch/milvus.db.bak
-memsearch index . --force
-```
+=== "macOS / Linux"
+
+    ```bash
+    mv ~/.memsearch/milvus.db ~/.memsearch/milvus.db.bak
+    memsearch index . --force
+    ```
+
+=== "Windows PowerShell"
+
+    ```powershell
+    Move-Item "$HOME\.memsearch\milvus.db" "$HOME\.memsearch\milvus.db.bak"
+    memsearch index . --force
+    ```
+
+Do not delete the old database until the rebuilt index has been verified. Memsearch does not perform an in-place 2.x-to-3.x migration. Collection descriptions are also best-effort metadata in Lite 3.x: an empty value from `describe_collection()` does not indicate an indexing or search failure.
 
 Alternatively, keep using the older Milvus Lite environment that created the `.db` file, or switch to Milvus Server via Docker / Zilliz Cloud.
 
```

**File**: `pyproject.toml` (modified, +3/-1)
```diff
@@ -16,8 +16,10 @@ classifiers = [
     "Programming Language :: Python :: 3.13",
 ]
 dependencies = [
-    "pymilvus>=2.5.0,!=2.6.10",
+    "pymilvus>=2.5.0,!=2.6.10; sys_platform != 'win32'",
+    "pymilvus>=2.6.11; sys_platform == 'win32'",
     "milvus-lite>=2.5.0; sys_platform != 'win32'",
+    "milvus-lite>=3.1.1; sys_platform == 'win32'",
     "click>=8.1",
     "watchdog>=4.0",
     "pathspec>=0.12",
```

**File**: `src/memsearch/cli.py` (modified, +10/-2)
```diff
@@ -230,7 +230,11 @@ def cli() -> None:
 @click.option(
     "--max-chunk-size", default=None, type=click.IntRange(min=1), help="Max chunk size in characters (must be >= 1)."
 )
-@click.option("--description", default=None, help="Collection description (written on creation only).")
+@click.option(
+    "--description",
+    default=None,
+    help="Best-effort collection metadata written on creation; some backends may not return it.",
+)
 def index(
     paths: tuple[str, ...],
     provider: str | None,
@@ -577,7 +581,11 @@ def _extract_section(
 @click.option(
     "--max-chunk-size", default=None, type=click.IntRange(min=1), help="Max chunk size in characters (must be >= 1)."
 )
-@click.option("--description", default=None, help="Collection description (written on creation only).")
+@click.option(
+    "--description",
+    default=None,
+    help="Best-effort collection metadata written on creation; some backends may not return it.",
+)
 def watch(
     paths: tuple[str, ...],
     provider: str | None,
```

**File**: `src/memsearch/core.py` (modified, +3/-0)
```diff
@@ -44,6 +44,9 @@ class MemSearch:
     collection:
         Milvus collection name.  Use different names to isolate
         agents sharing the same Milvus server.
+    description:
+        Best-effort collection metadata written during creation. Some backends
+        may not return it; indexing and search do not depend on it.
     ignore_files:
         Ignore filenames to discover within each directory index root, such
         as ``[".gitignore"]``. Empty by default for backward compatibility.
```

**File**: `src/memsearch/store.py` (modified, +2/-10)
```diff
@@ -4,7 +4,6 @@
 
 import importlib.metadata
 import logging
-import sys
 from pathlib import Path
 from typing import Any, ClassVar
 
@@ -72,15 +71,6 @@ def __init__(
         from pymilvus import MilvusClient
 
         is_local = not uri.startswith(("http", "tcp"))
-        if is_local and sys.platform == "win32":
-            raise RuntimeError(
-                "milvus-lite does not support Windows (no wheels on PyPI).\n"
-                "Use a remote Milvus server instead:\n"
-                "  docker run -d -p 19530:19530 milvusdb/milvus:latest standalone\n"
-                "  MemSearch(milvus_uri='http://localhost:19530')\n"
-                "Or run memsearch inside WSL2: "
-                "https://learn.microsoft.com/en-us/windows/wsl/install"
-            )
         resolved = str(Path(uri).expanduser()) if is_local else uri
         if is_local:
             Path(resolved).parent.mkdir(parents=True, exist_ok=True)
@@ -111,6 +101,8 @@ def _ensure_collection(self) -> None:
 
         from pymilvus import DataType, Function, FunctionType
 
+        # Description is optional backend metadata. Indexing and search never
+        # depend on it because some Milvus Lite versions do not return it.
         schema = self._client.create_schema(
             enable_dynamic_field=True,
             description=self._description,
```

**File**: `tests/test_dependency_markers.py` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+"""Regression tests for platform-specific Milvus dependency floors."""
+
+from pathlib import Path
+
+try:
+    import tomllib
+except ModuleNotFoundError:  # pragma: no cover - Python 3.10
+    import tomli as tomllib
+
+
+def test_milvus_dependency_floors_are_split_by_platform():
+    pyproject = Path(__file__).parents[1] / "pyproject.toml"
+    dependencies = tomllib.loads(pyproject.read_text())["project"]["dependencies"]
+    milvus_dependencies = {
+        requirement for requirement in dependencies if requirement.startswith(("milvus-lite", "pymilvus"))
+    }
+
+    assert milvus_dependencies == {
+        "milvus-lite>=2.5.0; sys_platform != 'win32'",
+        "milvus-lite>=3.1.1; sys_platform == 'win32'",
+        "pymilvus>=2.5.0,!=2.6.10; sys_platform != 'win32'",
+        "pymilvus>=2.6.11; sys_platform == 'win32'",
+    }
```

---

### Incident Patch 12: `bb55e604` (2026-08-31)
**Commit Message**: fix: preserve latest Claude session memory within context budget

Bound Claude Code SessionStart recent-memory context by bytes while preserving newest complete journal lines and valid UTF-8. Added regression coverage for oversized newest entries, multi-journal priority, empty sections, and byte-budget boundaries. Fixes #684.

**File**: `plugins/claude-code/hooks/session-start.sh` (modified, +86/-6)
```diff
@@ -128,9 +128,51 @@ fi
 PROJECT_BASENAME=$(basename "${CLAUDE_PROJECT_DIR:-.}")
 COLLECTION_DESC="${PROJECT_BASENAME} | ${PROVIDER}/${MODEL:-default}"
 
+RECENT_MEMORY_MAX_LINES=40
+# Claude Code head-truncates inline hook context at roughly 2 KB.
+# Keep a safety margin below the observed threshold from #684.
+RECENT_MEMORY_MAX_BYTES=1800
+
+_byte_len() {
+  LC_ALL=C printf '%s' "$1" | wc -c | tr -d '[:space:]'
+}
+
+_tail_lines_within_bytes() {
+  local max_bytes="$1"
+  LC_ALL=C awk -v budget="$max_bytes" '
+    {
+      lines[NR] = $0
+      sizes[NR] = length($0) + 1
+    }
+
+    END {
+      total = 0
+      start = NR + 1
+
+      for (i = NR; i >= 1; i--) {
+        if (total + sizes[i] > budget) {
+          break
+        }
+        total += sizes[i]
+        start = i
+      }
+
+      for (i = start; i <= NR; i++) {
+        print lines[i]
+      }
+    }
+  '
+}
+
 _recent_memory_preview() {
-  local file="$1" max_lines="${2:-40}"
-  awk '
+  local file="$1" max_lines="${2:-40}" max_bytes="${3:-0}"
+  local candidate trimmed
+
+  if [ "$max_bytes" -le 0 ]; then
+    return 0
+  fi
+
+  candidate=$(awk '
     function flush_section() {
       if (section_len > 0 && has_body) {
         for (i = 1; i <= section_len; i++) {
@@ -162,7 +204,23 @@ _recent_memory_preview() {
     END {
       flush_section()
     }
-  ' "$file" 2>/dev/null | tail -n "$max_lines" || true
+  ' "$file" 2>/dev/null | tail -n "$max_lines" || true)
+
+  # No useful recent-memory content in this journal. The caller may try
+  # an older journal.
+  if [ -z "$candidate" ]; then
+    return 0
+  fi
+
+  trimmed=$(printf '%s\n' "$candidate" | _tail_lines_within_bytes "$max_bytes")
+
+  # Candidate content exists, but even its newest complete line does not fit.
+  # Signal the caller not to fall back to an older journal.
+  if [ -z "$trimmed" ]; then
+    return 2
+  fi
+
+  printf '%s' "$trimmed"
 }
 
 # The session heading is written lazily by stop.sh on the first
@@ -221,16 +279,38 @@ recent_files=$(find "$MEMORY_DIR" -maxdepth 1 -type f -name "$DAILY_JOURNAL_PATT
 
 if [ -n "$recent_files" ]; then
   context="# Recent Memory\n\n"
+  has_recent_memory=false
   while IFS= read -r f; do
     [ -z "$f" ] && continue
     basename_f=$(basename "$f")
+    file_header="## $basename_f\n"
+    used_bytes=$(_byte_len "$context$file_header\n\n")
+    content_budget=$((RECENT_MEMORY_MAX_BYTES - used_bytes))
+    if [ "$content_budget" -le 0 ]; then
+      break
+    fi
     # Extract recent non-empty session sections. Legacy journals may contain
     # empty headings, but they do not carry useful context.
-    content=$(_recent_memory_preview "$f" 40)
-    if [ -n "$content" ]; then
-      context+="## $basename_f\n$content\n\n"
+    content=""
+    if content=$(_recent_memory_preview "$f" "$RECENT_MEMORY_MAX_LINES" "$content_budget"); then
+      if [ -n "$content" ]; then
+        context+="$file_header$content\n\n"
+        has_recent_memory=true
+      fi
+    else
+      preview_status=$?
+      if [ "$preview_status" -eq 2 ]; then
+        break
+      fi
+    fi
+    if [ "$(_byte_len "$context")" -ge "$RECENT_MEMORY_MAX_BYTES" ]; then
+      break
     fi
   done <<< "$recent_files"
+
+  if [ "$has_recent_memory" != true ]; then
+    context=""
+  fi
 fi
 
 # Note: Detailed memory search is handled by the memory-recall skill (pull-based).
```

**File**: `tests/test_claude_hooks.py` (modified, +147/-0)
```diff
@@ -33,6 +33,51 @@ def _write_claude_transcript(path: Path, *, turn_uuid: str) -> None:
     )
 
 
+def _run_claude_session_start_with_memory(tmp_path: Path, journals: dict[str, str]) -> str:
+    script = Path("plugins/claude-code/hooks/session-start.sh")
+    home = tmp_path / "home"
+    fake_bin = tmp_path / "bin"
+    memory = tmp_path / ".memsearch" / "memory"
+    home.mkdir()
+    fake_bin.mkdir()
+    (home / ".memsearch").mkdir()
+    (home / ".memsearch" / "config.toml").write_text("", encoding="utf-8")
+    memory.mkdir(parents=True)
+
+    for name, content in journals.items():
+        (memory / name).write_text(content, encoding="utf-8")
+
+    _write_executable(
+        fake_bin / "memsearch",
+        """#!/usr/bin/env bash
+if [ "$1" = "config" ] && [ "$2" = "list" ]; then
+  echo '{"embedding":{"provider":"onnx","model":"","api_key":""},"milvus":{"uri":"http://localhost:19530"}}'
+  exit 0
+fi
+exit 0
+""",
+    )
+    env = {
+        **os.environ,
+        "HOME": str(home),
+        "PATH": f"{fake_bin}:{os.environ['PATH']}",
+        "CLAUDE_PROJECT_DIR": str(tmp_path),
+        "MEMSEARCH_DIR": str(tmp_path / ".memsearch"),
+        "MEMSEARCH_NO_WATCH": "1",
+    }
+
+    result = subprocess.run(
+        ["bash", str(script)],
+        capture_output=True,
+        text=True,
+        env=env,
+        check=True,
+    )
+
+    payload = json.loads(result.stdout)
+    return payload.get("hookSpecificOutput", {}).get("additionalContext", "")
+
+
 def test_claude_hook_memsearch_disable_exits_before_writing_memory(tmp_path: Path) -> None:
     script = Path("plugins/claude-code/hooks/session-start.sh")
     env = {
@@ -202,6 +247,108 @@ def test_claude_session_start_recent_memory_skips_empty_sessions(tmp_path: Path)
     assert "Session 09:02" not in context
 
 
+def test_claude_session_start_recent_memory_keeps_latest_entries_within_budget(tmp_path: Path) -> None:
+    filler = "x" * 180
+    journal = "\n".join(
+        [
+            "# 2026-08-19",
+            "",
+            "## Session 09:00",
+            "### 09:00",
+            "- OLDEST_ENTRY",
+            *[f"- {filler}-{index}" for index in range(30)],
+            "",
+            "## Session 17:00",
+            "### 17:00",
+            "- LATEST_ENTRY",
+            "",
+        ]
+    )
+
+    context = _run_claude_session_start_with_memory(tmp_path, {"2026-08-19.md": journal})
+
+    assert "LATEST_ENTRY" in context
+    assert "OLDEST_ENTRY" not in context
+    assert len(context.encode("utf-8")) <= 1800
+
+
+def test_claude_session_start_recent_memory_prioritizes_newest_journal(tmp_path: Path) -> None:
+    filler = "x" * 180
+    newest = "\n".join(
+        [
+            "# 2026-08-19",
+            "",
+            "## Session 17:00",
+            "### 17:00",
+            *[f"- {filler}-{index}" for index in range(20)],
+            "- TODAY_LATEST_MARKER",
+            "",
+        ]
+    )
+    older_filler = "x" * 180
+    older = f"""# 2026-08-18
+
+## Session 17:00
+### 17:00
+- OLD_DAY_MARKER {older_filler}
+"""
+
+    context = _run_claude_session_start_with_memory(
+        tmp_path,
+        {"2026-08-18.md": older, "2026-08-19.md": newest},
+    )
+
+    assert "TODAY_LATEST_MARKER" in context
+    assert "OLD_DAY_MARKER" not in context
+    assert len(context.encode("utf-8")) <= 1800
+
+
+def test_claude_session_start_does_not_fall_back_when_newest_entry_exceeds_budget(tmp_path: Path) -> None:
+    newest = "\n".join(
+        [
+            "# 2026-08-19",
+            "",
+            "## Session 17:00",
+            "### 17:00",
+            f"- NEWEST_OVERSIZED_ENTRY {'x' * 2000}",
+            "",
+        ]
+    )
+    older = """# 2026-08-18
+
+## Session 16:00
+### 16:00
+- OLD_DAY_MARKER
+"""
+
+    context = _run_claude_session_start_with_memory(
+        tmp_path,
+        {"2026-08-18.md": older, "2026-08-19.md": newest},
+    )
+
+    assert "OLD_DAY_MARKER" not in context
+    assert context == ""
+
+
+def test_claude_session_start_recent_memory_trims_utf8_on_line_boundaries(tmp_path: Path) -> None:
+    journal = "\n".join(
+        [
+            "# 2026-08-19",
+            "",
+            "## Session 17:00",
+            "### 17:00",
+            *[f"- 用户讨论了新的检索策略 需要保留完整中文内容 {index}" for index in range(50)],
+            "- 最新记录: 需要优先保存",
+            "",
+        ]
+    )
+
+    context = _run_claude_session_start_with_memory(tmp_path, {"2026-08-19.md": journal})
+
+    assert "最新记录" in context
+    assert len(context.encode("utf-8")) <= 1800
+
+
 def test_claude_session_start_uv_tool_upgrade_hint_preserves_extras(tmp_path: Path) -> None:
     script = Path("plugins/claude-code/hooks/session-start.sh")
     home = tmp_path / "home"
```

---

### Incident Patch 13: `2ed1cb60` (2026-08-28)
**Commit Message**: refactor(skills): single-source memory-config and memory-to-skill across platforms (#710)

Consolidate the five hand-maintained copies of memory-config and
memory-to-skill into one platform-independent source under
plugins/_shared/skills/, with per-platform details moved into
references/<platform>.md for progressive disclosure.

- Add scripts/sync-skills.sh to materialize each platform copy with its
  own frontmatter (context: fork + allowed-tools for Claude Code,
  allowed-tools for OpenCode, emoji for OpenClaw).
- Add tests/test_skills_sync.py to enforce copy-match parity in CI,
  mirroring the maintenance-runner.py invariant.
- Register memory-config and memory-to-skill in the DSH runtime with
  resourceBase pointing at their references directories.
- Soften memory-recall L3 drill-down to use the core 'memsearch
  transcript' CLI (auto-detects Claude Code/Codex/OpenClaw formats)
  instead of hardcoding per-platform parser script paths.

Signed-off-by: Cheney Zhang <[REDACTED_EMAIL]>

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -82,7 +82,7 @@ plugins/claude-code/
 **Three-layer progressive disclosure (all in subagent):**
 1. **L1 (search):** Subagent runs `memsearch search` to find relevant chunks
 2. **L2 (expand):** Subagent runs `memsearch expand <chunk_hash>` to get full markdown sections
-3. **L3 (transcript):** Subagent runs `python3 ${CLAUDE_PLUGIN_ROOT}/transcript.py <jsonl>` to drill into original conversations
+3. **L3 (transcript):** Subagent runs `memsearch transcript <jsonl> --turn <uuid> --context 3` to drill into original conversations (core CLI auto-detects the format; `transcript.py` remains as the plugin-local, Claude-specific parser exercised by `tests/test_transcript.py`)
 
 **Supporting hooks:**
 - `SessionStart` injects cold-start context (recent daily logs) so Claude knows history exists
```

**File**: `docs/platforms/claude-code/how-it-works.md` (modified, +3/-3)
```diff
@@ -148,7 +148,7 @@ Step by step:
     - Agent identified selectinload as the fix and applied it to get_orders()
     - Added index on order.user_id for the new query pattern
     ```
-    These anchors enable the L2→L3 drill-down: `memsearch expand` parses them to surface the transcript path, and the memory-recall skill can then use `memsearch transcript` or `transcript.py` to read the original conversation.
+    These anchors enable the L2→L3 drill-down: `memsearch expand` parses them to surface the transcript path, and the memory-recall skill can then use `memsearch transcript` to read the original conversation.
 
 6. **Re-index** -- runs `memsearch index` to ensure the new memory is immediately searchable (not just when the watcher picks up the file change).
 
@@ -246,7 +246,7 @@ plugins/claude-code/
 ├── skills/
 │   └── memory-recall/
 │       └── SKILL.md             # Memory retrieval skill (context: fork subagent)
-└── transcript.py                # Python JSONL parser for L3 drill-down
+└── transcript.py                # JSONL parser for Claude Code conversations (L3 deep drill via core `memsearch transcript`)
 ```
 
 | File | Purpose |
@@ -261,4 +261,4 @@ plugins/claude-code/
 | `session-end.sh` | Calls `stop_watch` to terminate background watcher and clean up. |
 | `derive-collection.sh` | Generates a deterministic per-project Milvus collection name from the project path (e.g., `ms_myproject_a1b2c3`). |
 | `SKILL.md` | The memory-recall skill definition. Uses `context: fork` to run in an isolated subagent. |
-| `transcript.py` | Python JSONL parser for L3 deep drill-down into original Claude Code conversations. Plugin-specific (not in core library). |
+| `transcript.py` | Python JSONL parser for Claude Code conversations. Plugin-specific (not in core library); exercised by `tests/test_transcript.py`. The `memory-recall` skill's L3 drill-down uses the core `memsearch transcript` CLI (which auto-detects the format) rather than calling this file directly. |
```

**File**: `docs/platforms/claude-code/memory-recall.md` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ graph TD
 |-------|---------|----------------|-------------|
 | **L1: Search** | `memsearch search "<query>" --top-k 5 --json-output` | Top-K relevant chunk snippets with scores | Always -- the starting point for every recall |
 | **L2: Expand** | `memsearch expand <chunk_hash>` | Full markdown section with anchor metadata | When a snippet looks relevant but needs more context |
-| **L3: Transcript** | `python3 transcript.py <jsonl> --turn <uuid> --context 3` | Original conversation turns verbatim | When you need the exact exchange -- what was tried, what failed, what was decided |
+| **L3: Transcript** | `memsearch transcript <jsonl> --turn <uuid> --context 3` | Original conversation turns verbatim | When you need the exact exchange -- what was tried, what failed, what was decided |
 
 The subagent autonomously searches, evaluates relevance, expands promising results, and drills into transcripts when needed. Only the curated summary reaches the main conversation.
 
```

**File**: `docs/platforms/codex/memory-recall.md` (modified, +3/-3)
```diff
@@ -26,7 +26,7 @@ graph TD
     SKILL["$memory-recall skill<br/>(runs in main context)"]
     SKILL --> L1["L1: Search<br/>(memsearch search)"]
     L1 --> L2["L2: Expand<br/>(memsearch expand or direct file read)"]
-    L2 --> L3["L3: Best-effort rollout drill-down<br/>(parse-rollout.sh)"]
+    L2 --> L3["L3: Best-effort rollout drill-down<br/>(memsearch transcript)"]
     L3 --> RETURN["Curated summary"]
 
     style SKILL fill:#2a3a5c,stroke:#6ba3d6,color:#a8b2c1
@@ -40,7 +40,7 @@ graph TD
 |-------|---------|----------------|-------------|
 | **L1: Search** | `memsearch search "<query>" --top-k 5 --json-output` | Top-K relevant chunk snippets with scores | Always -- the starting point |
 | **L2: Expand** | `memsearch expand <chunk_hash>` (or direct `cat` fallback) | Full markdown section with rollout anchors | When a snippet needs more context |
-| **L3: Rollout** | `bash parse-rollout.sh <rollout_path>` | Original Codex conversation turns when a rollout anchor exists | When you need the exact exchange and the memory entry includes a rollout path |
+| **L3: Rollout** | `memsearch transcript <rollout_path>` | Original Codex conversation turns when a rollout anchor exists | When you need the exact exchange and the memory entry includes a rollout path |
 
 ### L2 Fallback: Direct File Read
 
@@ -77,7 +77,7 @@ Score 0.71: "Added cache invalidation via pub/sub channel..."
 - Decided against Memcached due to lack of pub/sub support
 ```
 
-**L3 (optional):** If the summary isn't enough and the memory entry includes a rollout anchor, the skill runs `parse-rollout.sh` to get the original conversation.
+**L3 (optional):** If the summary isn't enough and the memory entry includes a rollout anchor, the skill runs `memsearch transcript` to get the original conversation.
 
 !!! note "Current Codex payloads"
     Current Codex Stop hook payloads may omit `transcript_path`. In those cases memsearch still captures the turn from `history.jsonl` plus `last_assistant_message`, but there is no rollout path to drill into later.
```

**File**: `plugins/_shared/skills/memory-config/SKILL.md` (added, +218/-0)
```diff
@@ -0,0 +1,218 @@
+---
+name: memory-config
+description: "Diagnose and configure MemSearch memory behavior. Use when the user asks about MemSearch configuration, plugin summarization, PROJECT.md/USER.md maintenance, memory directories, index health, provider routing, prompt files, or migration/compatibility questions."
+---
+
+You are a MemSearch configuration assistant. This skill manages MemSearch settings only. It is not the host agent's built-in memory/config system.
+
+In diagnostic summaries or final answers, state once that this is MemSearch
+memory configuration, not the host agent's own memory/config system. Do not
+prepend that sentence to every progress update or every paragraph.
+
+When this skill is triggered, inspect the user's request text. If there is no
+concrete request, run a diagnostic. If they ask for a specific setting or
+change, route the request using the flows below.
+
+## Which agent am I running as?
+
+This skill is shared by five agent platforms, but platform-specific details
+(version-check commands, `plugins.<platform>.*` keys, native model defaults,
+restart guidance) live in per-platform reference files. Read ONLY the one file
+matching your current environment:
+
+- Claude Code → `references/claude-code.md`
+- Codex → `references/codex.md`
+- OpenClaw → `references/openclaw.md`
+- OpenCode → `references/opencode.md`
+- DeepSeek Harness → `references/dsh.md`
+
+If you are unsure which agent you are, check these environment markers:
+`DSH_HOME`/`~/.dsh` → DeepSeek Harness; `CODEX_HOME`/`~/.codex` → Codex;
+`~/.openclaw` → OpenClaw; `~/.config/opencode` → OpenCode;
+`CLAUDE_PLUGIN_ROOT` → Claude Code.
+
+Read that platform file before performing platform-specific diagnosis or
+configuration. Do not read the other platform files.
+
+## Intent Routing
+
+- Empty request or "check": diagnose current MemSearch setup.
+- "Show/get setting": read the requested resolved/global/project value.
+- "Set/enable/disable/change": choose global vs project scope explicitly; use global config for trusted plugin automation/provider/prompt/endpoint settings and project config only for allowlisted local indexing knobs.
+- "Not capturing/search empty/no memory": troubleshoot files, config, and index health.
+- "Use OpenAI/Gemini/Anthropic/native/model": configure provider routing.
+- "PROJECT.md/USER.md/profile/review": configure advanced maintenance.
+- "skill/distill/extract a skill/memory-to-skill": procedural-memory distillation — enable or tune it here, or use the dedicated `memory-to-skill` skill to review and install candidates.
+- "Prompt": explain or configure prompt overrides.
+
+Ask the user before enabling external or paid providers, changing output paths, re-indexing, deleting state, or broadening what gets indexed.
+
+## Diagnose First
+
+```bash
+memsearch config list --resolved
+memsearch config list --global
+memsearch config list --project
+```
+
+Check the shared CLI version before calling the setup healthy:
+
+```bash
+memsearch --version
+uv tool list --show-paths | rg -n 'memsearch|Package|Installed|path'
+curl -fsSL https://pypi.org/pypi/memsearch/json \
+  | python3 -c 'import json,sys; print(json.load(sys.stdin)["info"]["version"])'
+```
+
+If `memsearch` is unavailable, try `uvx --from memsearch[onnx] memsearch --version`.
+
+The MemSearch CLI comes from the PyPI package `memsearch`. Update with
+`uv tool install -U "memsearch[onnx]"` or `uv tool upgrade memsearch`.
+
+For the host platform's plugin version, update commands, and documentation
+link, see your platform reference file.
+
+Check memory files:
+
+```bash
+MDIR="${MEMSEARCH_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.memsearch}/memory"
+ls -la "$MDIR"
+find "$MDIR" -maxdepth 1 -type f -name '*.md' | sort | tail -10
+tail -120 "$MDIR/$(date +%Y-%m-%d).md"
+```
+
+Check index health:
+
+```bash
+memsearch stats
+STATE_DIR="${MEMSEARCH_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.memsearch}"
+test -f "$STATE_DIR/.index-state.json" && cat "$STATE_DIR/.index-state.json"
+```
+
+## Background and Compatibility
+
+Some plugin config fields may be missing or empty. That is usually normal:
+
+- `summarize.enabled`, advanced maintenance, and task-specific provider/model fields are newer settings.
+- Existing users' TOML files are not rewritten automatically after package/plugin upgrades.
+- Empty strings usually mean "use the built-in or host-native default"; they do not necessarily mean "disabled" or "broken".
+- Missing fields should be interpreted through `memsearch config list --resolved`, not by reading raw TOML alone.
+- New users who run `memsearch config init` may see more fields than old users because the template includes newer options.
+- Advanced maintenance is intentionally disabled by default to avoid surprise background model calls.
+
+## Configuration Logic
+
+Config is resolved from built-in defaults, global config, project config, env refs like `env:OPENAI_API_KEY`, and runti
```

**File**: `plugins/_shared/skills/memory-config/references/claude-code.md` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+# Claude Code platform reference
+
+## Plugin version & update
+
+Claude Code plugin latest marketplace/source version is in
+`plugins/claude-code/.claude-plugin/plugin.json` and
+`.claude-plugin/marketplace.json` in the `zilliztech/memsearch` repo. Check
+the latest source manifest with:
+
+```bash
+curl -fsSL https://raw.githubusercontent.com/zilliztech/memsearch/main/plugins/claude-code/.claude-plugin/plugin.json
+```
+
+For marketplace installs, use `claude plugin marketplace update memsearch-plugins`
+then `claude plugin update memsearch`, and restart Claude Code.
+
+Docs: https://zilliztech.github.io/memsearch/platforms/claude-code/installation/
+
+## Plugin keys
+
+```toml
+[plugins.claude-code.summarize]
+enabled = true
+provider = ""      # empty/native = Claude Code native summarizer
+model = ""
+
+[plugins.claude-code.project_review]
+enabled = false
+provider = "native"
+model = ""
+min_interval_hours = 24
+input_dir = ".memsearch/memory"
+output_file = ".memsearch/PROJECT.md"
+
+[plugins.claude-code.user_profile]
+enabled = false
+provider = "native"
+model = ""
+min_interval_hours = 24
+input_dir = ".memsearch/memory"
+output_file = ".memsearch/USER.md"
+
+[plugins.claude-code.memory_to_skill]
+enabled = false
+min_occurrences = 3   # how many times a workflow must recur before it is distilled
+paths = []            # where installed skills are copied; empty = ask the user
+```
+
+## Native model defaults
+
+- Native summarize defaults to `haiku`.
+- Native maintenance defaults to `sonnet`.
+- `provider = ""` or `native` uses Claude Code's non-interactive native path.
+
+## Restart guidance
+
+A fresh Claude Code session is recommended after plugin install/update or
+hook/skill file changes, because the current session may already have loaded
+the old plugin state. TOML changes apply on the next capture/recall/index/
+maintenance invocation.
```

**File**: `plugins/_shared/skills/memory-config/references/codex.md` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+# Codex platform reference
+
+## Plugin version & update
+
+Codex plugin has no independent package/version file. Inspect
+`${CODEX_HOME:-$HOME/.codex}/hooks.json` to find the hook source path, then
+compare that repository with the latest `zilliztech/memsearch` GitHub release:
+
+```bash
+git -C <memsearch-repo> describe --tags --always --dirty
+gh release view --repo zilliztech/memsearch --json tagName,publishedAt,url
+```
+
+Update source installs with `git pull` plus
+`bash plugins/codex/scripts/install.sh`.
+
+Docs: https://zilliztech.github.io/memsearch/platforms/codex/installation/
+
+## Plugin keys
+
+```toml
+[plugins.codex.summarize]
+enabled = true
+provider = ""      # empty/native = Codex native summarizer
+model = ""
+
+[plugins.codex.project_review]
+enabled = false
+provider = "native"
+model = ""
+min_interval_hours = 24
+input_dir = ".memsearch/memory"
+output_file = ".memsearch/PROJECT.md"
+
+[plugins.codex.user_profile]
+enabled = false
+provider = "native"
+model = ""
+min_interval_hours = 24
+input_dir = ".memsearch/memory"
+output_file = ".memsearch/USER.md"
+
+[plugins.codex.memory_to_skill]
+enabled = false
+min_occurrences = 3   # how many times a workflow must recur before it is distilled
+paths = []            # where installed skills are copied; empty = ask the user
+```
+
+## Native model defaults
+
+- Native summarize defaults to `gpt-5.1-codex-mini`.
+- Native maintenance uses the Codex default unless `plugins.codex.<task>.model` is set.
+- `provider = ""` or `native` uses Codex's non-interactive native path.
+
+## Restart guidance
+
+A fresh Codex session is recommended after `hooks.json`, skill, plugin, or
+local agent-file changes, because the current session may already have loaded
+the old hook/skill state. TOML changes apply on the next capture/recall/index/
+maintenance invocation.
```

**File**: `plugins/_shared/skills/memory-config/references/dsh.md` (added, +101/-0)
```diff
@@ -0,0 +1,101 @@
+# DeepSeek Harness (DSH) platform reference
+
+## Plugin version & update
+
+The DSH plugin is the npm package `@zilliz/memsearch-dsh`. Check the published
+version:
+
+```bash
+npm view @zilliz/memsearch-dsh version dist-tags --json
+```
+
+Source version is `plugins/dsh/package.json`. Install/update via the profile
+patch mechanism:
+
+```bash
+dsh plugin --profile <name> add @zilliz/memsearch-dsh
+```
+
+Docs: https://zilliztech.github.io/memsearch/platforms/dsh/installation/
+
+## Two config surfaces
+
+DSH splits config across two surfaces, unlike the other platforms:
+
+1. **MemSearch TOML** (`~/.memsearch/config.toml`) — summarize provider/model,
+   Milvus, collection, memory dir, and the maintenance tasks. Uses the
+   `[plugins.dsh.*]` prefix.
+2. **Plugin-level switches** in the profile's `cordis.patch.yml` — the capture/
+   inject/summarize toggles and the summarizer backend, set under the `memsearch`
+   row's `config`.
+
+## MemSearch TOML keys
+
+```toml
+[plugins.dsh.summarize]
+provider = ""      # named [llm.providers.<name>] entry; only used by custom-llm mode
+model = ""
+
+[plugins.dsh.project_review]
+enabled = false
+provider = "native"   # native = a one-shot DSH headless agent
+model = ""
+min_interval_hours = 24
+input_dir = ".memsearch/memory"
+output_file = ".memsearch/PROJECT.md"
+
+[plugins.dsh.user_profile]
+enabled = false
+provider = "native"
+model = ""
+min_interval_hours = 24
+input_dir = ".memsearch/memory"
+output_file = ".memsearch/USER.md"
+
+[plugins.dsh.memory_to_skill]
+enabled = false
+min_occurrences = 3
+paths = []          # install targets; default resolves to ~/.agents/skills
+```
+
+## Plugin-level switches (cordis.patch.yml)
+
+These are NOT in the MemSearch TOML. They live in the profile patch under the
+`memsearch` row's `config`:
+
+```yaml
+- id: memsearch
+  config:
+    captureEnabled: true     # capture completed turns
+    injectEnabled: true      # inject relevant memory
+    summarizeEnabled: true   # summarize turns before writing
+    summarizeMode: auto      # auto | dsh-headless | custom-llm
+```
+
+## Summarizer backends
+
+- **`auto`** (default) — if `[plugins.dsh.summarize] provider` is set, uses
+  `custom-llm`; otherwise `dsh-headless`.
+- **`dsh-headless`** — boots a one-shot `dsh --profile headless` agent. The
+  sub-agent's model is the deployment's `agent-default-model` from
+  `~/.dsh/settings.yaml` (the same selection the Web UI model picker writes).
+  **`[plugins.dsh.summarize]` provider/model do NOT apply here** — change the
+  model in DSH settings instead.
+- **`custom-llm`** — a direct LLM call using `[llm.providers.*]`; provider/model
+  come from `[plugins.dsh.summarize]`.
+
+There is no silent fallback between modes: the resolved backend is the one used.
+A failed summarization writes a short unavailable note, never a raw transcript
+dump.
+
+## Native model defaults
+
+- `dsh-headless` and `native` maintenance use the DSH deployment's
+  `agent-default-model` (Web UI model picker / `~/.dsh/settings.yaml`).
+
+## Restart guidance
+
+Restart the DSH profile after installing or updating the plugin so the
+`memory-recall` skill re-registers and the plugin rows reload. TOML changes
+apply on the next capture/recall/index/maintenance invocation; summarizer
+backend changes (`summarizeMode`) need the plugin config to reload.
```

---

### Incident Patch 14: `7f2a1e7d` (2026-08-28)
**Commit Message**: fix(opencode): safely derive collection names via argv (#682)

Fixes #681.

**File**: `plugins/opencode/derive-collection.test.ts` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+import test from "node:test";
+import assert from "node:assert/strict";
+
+import { deriveCollectionNameFromScript } from "./derive-collection.ts";
+
+const SCRIPT_PATH = "/opt/memsearch/scripts/derive-collection.sh";
+
+for (const projectDir of [
+  "/tmp/project",
+  "/tmp/project with spaces",
+  "/tmp/project's",
+  "/tmp/project\"name",
+  String.raw`/tmp/project\segment`,
+  "-leading-dash",
+  "/tmp/项目-α",
+]) {
+  test(`passes the project path as one literal argv entry: ${JSON.stringify(projectDir)}`, () => {
+    const calls: Array<{ file: string; args: string[]; options: unknown }> = [];
+    const result = deriveCollectionNameFromScript(
+      SCRIPT_PATH,
+      projectDir,
+      (file, args, options) => {
+        calls.push({ file, args: [...args], options });
+        return "ms_recorded_12345678\n";
+      }
+    );
+
+    assert.equal(result, "ms_recorded_12345678");
+    assert.deepEqual(calls, [
+      {
+        file: "bash",
+        args: [SCRIPT_PATH, projectDir],
+        options: { encoding: "utf-8", timeout: 5000 },
+      },
+    ]);
+  });
+}
+
+test("returns the existing fallback when collection derivation fails", () => {
+  const result = deriveCollectionNameFromScript(
+    SCRIPT_PATH,
+    "/tmp/project",
+    () => {
+      throw new Error("recorded failure");
+    }
+  );
+
+  assert.equal(result, "ms_opencode_default");
+});
```

**File**: `plugins/opencode/derive-collection.ts` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+import { execFileSync } from "node:child_process";
+
+type CollectionCommandRunner = (
+  file: string,
+  args: string[],
+  options: { encoding: "utf-8"; timeout: number }
+) => string;
+
+const runCollectionCommand: CollectionCommandRunner = (file, args, options) =>
+  execFileSync(file, args, options);
+
+export function deriveCollectionNameFromScript(
+  script: string,
+  projectDir: string,
+  run: CollectionCommandRunner = runCollectionCommand
+): string {
+  try {
+    return run("bash", [script, projectDir], {
+      encoding: "utf-8",
+      timeout: 5000,
+    }).trim();
+  } catch {
+    return "ms_opencode_default";
+  }
+}
```

**File**: `plugins/opencode/index.ts` (modified, +2/-8)
```diff
@@ -32,6 +32,7 @@ import {
   mergeSystemMemoryContext,
   shellEscape,
 } from "./context.ts";
+import { deriveCollectionNameFromScript } from "./derive-collection.ts";
 
 const PLUGIN_DIR = dirname(realpathSync(fileURLToPath(import.meta.url)));
 
@@ -67,14 +68,7 @@ function detectMemsearchCmd(): string {
 /** Derive a per-project Milvus collection name via the shared script. */
 function deriveCollectionName(projectDir: string): string {
   const script = join(PLUGIN_DIR, "scripts", "derive-collection.sh");
-  try {
-    return execSync(`bash "${script}" "${projectDir}"`, {
-      encoding: "utf-8",
-      timeout: 5000,
-    }).trim();
-  } catch {
-    return "ms_opencode_default";
-  }
+  return deriveCollectionNameFromScript(script, projectDir);
 }
 
 /**
```

**File**: `plugins/opencode/package.json` (modified, +1/-0)
```diff
@@ -9,6 +9,7 @@
   },
   "files": [
     "context.ts",
+    "derive-collection.ts",
     "index.ts",
     "scripts/*.py",
     "scripts/*.sh",
```

---

### Incident Patch 15: `357ae74d` (2026-08-23)
**Commit Message**: docs: add DeepSeek Harness plugin guide (#698)

Signed-off-by: Cheney Zhang <[REDACTED_EMAIL]>

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -104,7 +104,7 @@ When modifying hooks/skills, keep in mind:
 - **ONNX bge-m3 as plugin default.** The Claude Code plugin hooks default to `onnx` provider (bge-m3, CPU, no API key). The Python API still defaults to `openai`.
 - **Hybrid search by default.** Every collection has both dense vector and BM25 sparse fields. Search uses RRF to combine them. RRF scores are normalized to `[0, 1]` (theoretical max = `num_retrievers / (k + 1)`).
 - **`[llm]` + `[prompts]` config.** New config sections for LLM provider selection and custom prompt templates. `[compact]` is deprecated but still works (fallback: `[llm]` > `[compact]` > defaults). Plugins read `prompts.summarize` for custom session summarization prompts. **Migration plan:** `[compact]` will be removed in the next major version (1.0). During the transition, `resolve_config()` emits a `DeprecationWarning` when user config files contain `[compact]`. The compact CLI command resolves LLM settings as `cfg.llm.* or cfg.compact.*`.
-- **Shared prompt template.** All four plugins share a single `summarize.txt` template (maintained in `plugins/_shared/prompts/`, synced via `scripts/sync-prompts.sh`). Template uses `{{AGENT_NAME}}` placeholder.
+- **Shared prompt template.** All five plugins share a single `summarize.txt` template (maintained in `plugins/_shared/prompts/`, synced via `scripts/sync-prompts.sh`). Template uses `{{AGENT_NAME}}` placeholder.
 - **Remote Milvus `query()` requires a filter.** Use `chunk_hash != ""` as a "match all" filter when no filter is provided (Milvus Lite doesn't enforce this, but Milvus Server does).
 
 ## Versioning & Release
```

**File**: `README.md` (modified, +41/-12)
```diff
@@ -11,9 +11,10 @@
 <p align="center">
   <a href="https://pypi.org/project/memsearch/"><img src="https://img.shields.io/pypi/v/memsearch?style=flat-square&color=blue" alt="PyPI"></a>
   <a href="https://zilliztech.github.io/memsearch/platforms/claude-code/"><img src="https://img.shields.io/badge/Claude_Code-plugin-c97539?style=flat-square&logo=claude&logoColor=white" alt="Claude Code"></a>
+  <a href="https://zilliztech.github.io/memsearch/platforms/codex/"><img src="https://img.shields.io/badge/Codex_CLI-plugin-ff6b35?style=flat-square" alt="Codex CLI"></a>
+  <a href="https://zilliztech.github.io/memsearch/platforms/dsh/"><img src="https://img.shields.io/badge/DeepSeek_Harness-plugin-4d6bfe?style=flat-square" alt="DeepSeek Harness"></a>
   <a href="https://zilliztech.github.io/memsearch/platforms/openclaw/"><img src="https://img.shields.io/badge/OpenClaw-plugin-4a9eff?style=flat-square" alt="OpenClaw"></a>
   <a href="https://zilliztech.github.io/memsearch/platforms/opencode/"><img src="https://img.shields.io/badge/OpenCode-plugin-22c55e?style=flat-square" alt="OpenCode"></a>
-  <a href="https://zilliztech.github.io/memsearch/platforms/codex/"><img src="https://img.shields.io/badge/Codex_CLI-plugin-ff6b35?style=flat-square" alt="Codex CLI"></a>
   <a href="https://pypi.org/project/memsearch/"><img src="https://img.shields.io/badge/python-%3E%3D3.10-blue?style=flat-square&logo=python&logoColor=white" alt="Python"></a>
   <a href="https://github.com/zilliztech/memsearch/blob/main/LICENSE"><img src="https://img.shields.io/github/license/zilliztech/memsearch?style=flat-square" alt="License"></a>
   <a href="https://github.com/zilliztech/memsearch/actions/workflows/test.yml"><img src="https://img.shields.io/github/actions/workflow/status/zilliztech/memsearch/test.yml?branch=main&style=flat-square" alt="Tests"></a>
@@ -29,14 +30,15 @@
 
 ## 📰 What's New
 
+- **DeepSeek Harness support** — MemSearch now brings automatic capture, pre-step memory injection, native skill-based recall, background maintenance, and a read-only memory browser to [DeepSeek Harness (DSH)](https://zilliztech.github.io/memsearch/platforms/dsh/).
 - **Skills from memory** — MemSearch now distills the workflows you repeat into reusable, installable agent skills (a third "procedural memory" layer) and keeps them up to date in the background. See [Skills from Memory](#skills-from-memory).
 - **Advanced memory maintenance** — optional background tasks keep durable `PROJECT.md` and `USER.md` notes current across sessions. See [Advanced Memory Maintenance](#advanced-memory-maintenance).
 
 ---
 
 ### Why memsearch?
 
-- 🌐 **All Platforms, One Memory** — memories flow across [Claude Code](plugins/claude-code/README.md), [OpenClaw](plugins/openclaw/README.md), [OpenCode](plugins/opencode/README.md), and [Codex CLI](plugins/codex/README.md). A conversation in one agent becomes searchable context in all others — no extra setup
+- 🌐 **All Platforms, One Memory** — memories flow across [Claude Code](plugins/claude-code/README.md), [Codex CLI](plugins/codex/README.md), [DeepSeek Harness](plugins/dsh/README.md), [OpenClaw](plugins/openclaw/README.md), and [OpenCode](plugins/opencode/README.md). A conversation in one agent becomes searchable context in all others — no extra setup
 - 👥 **For Agent Users**, install a plugin and get persistent memory with zero effort; **for Agent Developers**, use the full [CLI](https://zilliztech.github.io/memsearch/cli/) and [Python API](https://zilliztech.github.io/memsearch/python-api/) to build memory and harness engineering into your own agents
 - 📄 **Markdown is the source of truth** — inspired by [OpenClaw](https://github.com/openclaw/openclaw). Your memories are just `.md` files — human-readable, editable, version-controllable. Milvus is a "shadow index": a derived, rebuildable cache
 - 🔍 **Progressive retrieval, hybrid search, smart dedup, live sync** — 3-layer recall (search → expand → transcript); dense vector + BM25 sparse + RRF reranking; SHA-256 content hashing skips unchanged content; file watcher auto-indexes in real time
@@ -108,6 +110,36 @@ $memory-recall what did we discuss about deployment?
 
 </details>
 
+<details open>
+<summary><h3>For DeepSeek Harness Users</h3></summary>
+
+```bash
+# Install the published plugin into your DSH profile
+uv tool install "memsearch[onnx]"
+dsh plugin --profile web add @zilliz/memsearch-dsh
+# Restart that DSH profile, or start a new session
+```
+
+After installing, use DSH normally. Completed turns are captured automatically, and relevant memories are injected before the first model step only when they are useful.
+
+**Verify it's working:**
+
+```bash
+ls .memsearch/memory/
+```
+
+**Recall memories** — ask naturally or tell DSH to use the registered `memory-recall` skill:
+
+```
+Use memory-recall to find what we decided about the deployment architecture.
+```
+
+The web profile also adds a compact MemSearch dock where you can review skill candidates and bro
```

**File**: `docs/architecture.md` (modified, +5/-4)
```diff
@@ -6,23 +6,24 @@ This page explains the technical architecture and key implementation decisions b
 
 ## Cross-Platform Memory Sharing
 
-memsearch supports 4 AI coding agent platforms: [Claude Code](platforms/claude-code/index.md), [OpenClaw](platforms/openclaw/index.md), [OpenCode](platforms/opencode/index.md), and [Codex CLI](platforms/codex/index.md). All plugins write to the same markdown format and use the same Milvus index, making memories portable across platforms.
+memsearch supports 5 AI coding agent platforms: [Claude Code](platforms/claude-code/index.md), [Codex CLI](platforms/codex/index.md), [DeepSeek Harness](platforms/dsh/index.md), [OpenClaw](platforms/openclaw/index.md), and [OpenCode](platforms/opencode/index.md). All plugins write to the same markdown format and use the same Milvus index, making memories portable across platforms.
 
 ```mermaid
 graph TB
     subgraph "Capture (per-platform)"
         CC["Claude Code<br/>(Stop hook + Haiku)"]
+        CX["Codex CLI<br/>(Stop hook + Codex)"]
+        DSH["DeepSeek Harness<br/>(turn event + headless agent)"]
         OC["OpenClaw<br/>(agent_end)"]
         OO["OpenCode<br/>(SQLite daemon)"]
-        CX["Codex CLI<br/>(Stop hook + Codex)"]
     end
 
     subgraph "Shared Memory"
         MD[".memsearch/memory/*.md"]
         MIL[("Milvus<br/>(shared index)")]
     end
 
-    CC & OC & OO & CX --> MD
+    CC & CX & DSH & OC & OO --> MD
     MD --> MIL
 
     style MD fill:#2a3a5c,stroke:#e0976b,color:#a8b2c1
@@ -260,7 +261,7 @@ graph LR
 | **L2: Expand** | Full markdown section around a chunk, including anchor metadata | Medium -- one file section |
 | **L3: Transcript** | Original conversation turns verbatim (user messages, assistant responses, tool calls) | High -- raw dialogue |
 
-The L3 transcript format varies by platform (Claude Code JSONL, OpenClaw JSONL, OpenCode SQLite, Codex rollout JSONL), but the L1/L2 layers are shared across all platforms via the `memsearch` CLI.
+The L3 transcript format varies by platform (Claude Code JSONL, Codex rollout JSONL, DSH session database, OpenClaw JSONL, OpenCode SQLite), but the L1/L2 layers are shared across all platforms via the `memsearch` CLI.
 
 **Session anchors** in memory files enable the L2-to-L3 bridge:
 
```

**File**: `docs/design-philosophy.md` (modified, +4/-3)
```diff
@@ -43,24 +43,25 @@ This is memsearch's key differentiator: **memories written by one agent are sear
 graph TB
     subgraph "Capture (per-platform)"
         CC["Claude Code<br/>(Stop hook + Haiku)"]
+        CX["Codex CLI<br/>(Stop hook + Codex)"]
+        DSH["DeepSeek Harness<br/>(turn event + headless agent)"]
         OC["OpenClaw<br/>(agent_end)"]
         OO["OpenCode<br/>(SQLite daemon)"]
-        CX["Codex CLI<br/>(Stop hook + Codex)"]
     end
 
     subgraph "Shared Memory"
         MD[".memsearch/memory/*.md"]
         MIL[("Milvus<br/>(shared index)")]
     end
 
-    CC & OC & OO & CX --> MD
+    CC & CX & DSH & OC & OO --> MD
     MD --> MIL
 
     style MD fill:#2a3a5c,stroke:#e0976b,color:#a8b2c1
     style MIL fill:#2a3a5c,stroke:#6ba3d6,color:#a8b2c1
 ```
 
-All 4 platform plugins write to the same markdown format and use the same Milvus backend. This means:
+All 5 platform plugins write to the same markdown format and use the same Milvus backend. This means:
 
 - You can switch between Claude Code and Codex CLI and keep your memories
 - Team members using different agents can share a knowledge base
```

**File**: `docs/home/comparison.md` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@ memsearch is both a CLI engine and a set of native plugins for four coding CLIs,
 
 | | memsearch | Claude Code native | claude-mem | qmd | MemPalace | mem0 | Letta |
 |---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
-| **Shape** | Engine + 4 native CLI plugins | Built-in (Claude Code only) | Plugin (Claude Code / Gemini CLI / OpenClaw) | Engine + MCP + Claude Code plugin | Claude Code plugin + MCP | Library + native plugins + MCP | Agent runtime (own CLI: Letta Code) |
+| **Shape** | Engine + 5 native agent plugins | Built-in (Claude Code only) | Plugin (Claude Code / Gemini CLI / OpenClaw) | Engine + MCP + Claude Code plugin | Claude Code plugin + MCP | Library + native plugins + MCP | Agent runtime (own CLI: Letta Code) |
 | **Source of truth** | Plain `.md` | Plain `.md` (`CLAUDE.md` + auto-memory) | SQLite + ChromaDB | Plain `.md` | ChromaDB | Vector DB (+ optional graph) | Postgres / git-backed MemFS (Letta Code) |
 | **Write** | Append-only | User edits `CLAUDE.md`; auto-memory appended by Claude | LLM-compressed transcripts | — (read-only) | Raw transcripts | LLM-extracted facts, LLM add/update/delete | Agent self-edits via tools |
 | **Search** | Dense + BM25 + RRF | **None** — whole file loaded every session | Chroma vector + FTS5 | BM25 + dense + LLM rerank | Dense | Dense (+ optional rerank, + optional graph) | Dense archival |
@@ -45,7 +45,7 @@ memsearch is both a CLI engine and a set of native plugins for four coding CLIs,
 
 ## Where memsearch is different
 
-- **Covers Claude Code + OpenClaw + OpenCode + Codex CLI in one project.** No other entry covers all four.
+- **Covers Claude Code + Codex CLI + DeepSeek Harness + OpenClaw + OpenCode in one project.** No other entry covers all five.
 - **Retrieves on demand** instead of stuffing the whole file into every session like Claude Code's built-in memory.
 - **Markdown + Milvus, not an opaque DB.** qmd and Letta's MemFS share the markdown-canonical approach; claude-mem / MemPalace / mem0 keep state in a DB.
 - **Append-only writes, no LLM curation on the write path.** mem0 and Letta's traditional memory depend on LLM write-time curation (powerful but can silently mutate past writes).
```

**File**: `docs/home/for-developers.md` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@ See the full [CLI Reference →](../cli.md) and [Python API →](../python-api.m
 
 ## How Plugins Use the API
 
-All 4 platform plugins are built on top of the same CLI/API:
+All 5 platform plugins are built on top of the same CLI/API:
 
 ```
 Plugin Capture:  conversation → LLM summary → append daily.md → memsearch index
```

**File**: `docs/home/for-users.md` (modified, +5/-3)
```diff
@@ -9,16 +9,17 @@ Pick your platform, install the plugin, and you're done. memsearch captures conv
 - **Trace feature history** — understand how a feature evolved across sessions, including the files changed and tradeoffs discussed.
 - **Do code archaeology** — ask when and why a module, config, or workflow was changed before touching it again.
 - **Find the right session to resume** — ask which previous conversation covered a topic, recover the relevant context, and continue from there.
-- **Carry context across agents** — keep Claude Code, Codex CLI, OpenClaw, and OpenCode working from the same project memory.
+- **Carry context across agents** — keep Claude Code, Codex CLI, DeepSeek Harness, OpenClaw, and OpenCode working from the same project memory.
 
 ## Choose Your Platform
 
 | Platform | Install | Maturity |
 |----------|---------|----------|
 | [**Claude Code**](../platforms/claude-code/index.md) | Marketplace or `--plugin-dir` | Most mature |
+| [**Codex CLI**](../platforms/codex/index.md) | `bash install.sh` | Stable |
+| [**DeepSeek Harness**](../platforms/dsh/index.md) | `dsh plugin --profile <name> add @zilliz/memsearch-dsh` | Stable |
 | [**OpenClaw**](../platforms/openclaw/index.md) | `openclaw plugins install --force` + hook permissions | Stable |
 | [**OpenCode**](../platforms/opencode/index.md) | Add to `opencode.json` plugin array | Stable |
-| [**Codex CLI**](../platforms/codex/index.md) | `bash install.sh` | Stable |
 
 ## What Happens Automatically
 
@@ -45,8 +46,9 @@ Simple questions stop at L1. Complex questions go deeper.
 Each platform adapts the same architecture to its own plugin system:
 
 - **Claude Code**: [Full guide →](../platforms/claude-code/index.md)
+- **Codex CLI**: [Full guide →](../platforms/codex/index.md)
+- **DeepSeek Harness**: [Full guide →](../platforms/dsh/index.md)
 - **OpenClaw**: [Full guide →](../platforms/openclaw/index.md)
 - **OpenCode**: [Full guide →](../platforms/opencode/index.md)
-- **Codex CLI**: [Full guide →](../platforms/codex/index.md)
 
 See the [Platform Comparison](../platforms/index.md) for a detailed feature matrix.
```

**File**: `docs/home/why.md` (modified, +2/-2)
```diff
@@ -2,9 +2,9 @@
 
 ## One Memory, Every Agent
 
-memsearch provides persistent memory plugins for **4 major AI coding agent platforms**: [Claude Code](../platforms/claude-code/index.md), [OpenClaw](../platforms/openclaw/index.md), [OpenCode](../platforms/opencode/index.md), and [Codex CLI](../platforms/codex/index.md).
+memsearch provides persistent memory plugins for **5 major AI coding agent platforms**: [Claude Code](../platforms/claude-code/index.md), [Codex CLI](../platforms/codex/index.md), [DeepSeek Harness](../platforms/dsh/index.md), [OpenClaw](../platforms/openclaw/index.md), and [OpenCode](../platforms/opencode/index.md).
 
-Memories written in one platform are searchable from any other. A conversation in Claude Code becomes available context in OpenClaw, Codex, and OpenCode — no extra setup, no manual export.
+Memories written in one platform are searchable from any other. A conversation in Claude Code becomes available context in Codex, DSH, OpenClaw, and OpenCode — no extra setup, no manual export.
 
 ## Both for Agent Users and Agent Developers
 
```

#### Recent Merged Pull Requests:
- **PR #773** (closed): feat(opencode): read OpenCode v2 session_message turns (@dommonkhouse)
- **PR #765** (2026-09-24): release: prepare v0.4.21 (@zc277584121)
- **PR #761** (2026-09-22): Use the stable Jev alias and relocate evaluation docs (@zc277584121)
- **PR #760** (2026-09-21): fix: prevent read paths from creating missing collections (@zc277584121)
- **PR #758** (2026-09-22): Add optional Jev reranking and bilingual evaluation (@zc277584121)
- **PR #757** (2026-09-20): fix: search growing rows on Milvus Server (@zc277584121)
- **PR #754** (2026-09-19): fix(codex): filter composite host instruction envelopes (@zc277584121)
- **PR #751** (2026-09-18): fix(codex): parse response-item rollout messages safely (@zc277584121)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
