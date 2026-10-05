# Forensic Learning Record (Deep Inspection): zilliztech/memsearch

> **Canonical Artifact**: `07_PROJECT_LEARNING/zilliztech-memsearch-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zilliztech/memsearch](https://github.com/zilliztech/memsearch))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:10:10.175Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zilliztech/memsearch`
- **Description**: A persistent, unified memory layer for all your AI agents (e.g. Claude Code, Codex, DSH), backed by Markdown and Milvus.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 2686 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

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
        raw = result["r
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
    result = subproc
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
    result = subproc
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
    parser.add_argument("--context", "-c", default=3, type=int, help="Number of turns before/after target.
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
    result = subproc
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
        'white-sp
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

Signed-off-by: Cheney Zhang <chen.zhang@zilliz.com>

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

---

### Incident Patch 2: `a1a6d09a` (2026-09-20)
**Commit Message**: fix: search growing rows on Milvus Server (#757)

Signed-off-by: Cheney Zhang <chen.zhang@zilliz.com>

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
+        [{"count(*)":
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

Signed-off-by: Cheney Zhang <chen.zhang@zilliz.com>

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
+            c
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
+  <ti
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
+    journal = journal_files[0].read
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
 
-    for raw_line i
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
+  const home = mkdtempSync(
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
+- P1 **memse
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
- * python 
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
   const argvFile = `${tmp}/memsearch-dsh-argv-${process.pid
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
+| `--default-collection` | | *(none)* | Integration fallback used only when global/project config and `--col
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
     C -->|
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
 
 1. **Reads config and checks API key.** Loads the resolved provider, model, API key, and Milvus URI in one `memsearch config list --resolved --json-output` snapshot. Older CLI versions automatically fall back to per-key `config get` calls. Checks whether the required API key is set for the provider (`OPENAI_API_KEY`, `GOOGLE_API_KEY`, `VOYAGE_API_KEY`, `JINA_API_KEY`, `MISTRAL_API_KEY`; `onnx`, `ollama`, and `local` need no key). If missing, shows an 
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
+    assert ("WARNING: memory index may be stale" in status) is (final_status == 
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
