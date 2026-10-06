# Forensic Learning Record (Deep Inspection): lexmount/moli

> **Canonical Artifact**: `07_PROJECT_LEARNING/lexmount-moli-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lexmount/moli](https://github.com/lexmount/moli))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T15:38:02.642Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lexmount/moli`
- **Description**: Best headless browser for AI agents. Lite, Fast, High-Compatibility. Built in Rust
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 10749 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `moli-benchmark/browser-spider-local/lib/observability/sampler-worker.mjs`
```
import { parentPort, workerData } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';

import { LinuxProcessTreeCollector } from './linux-procfs.mjs';

if (!parentPort) {
  throw new Error('resource sampler worker requires a parent port');
}

const intervalMs = Math.max(100, Number(workerData?.intervalMs) || 500);
// Node worker threads share the process performance timeline. Using the
// runner-provided origin keeps samples and main-thread phase markers aligned.
const startedAt = Number.isFinite(workerData?.startedAt)
  ? workerData.startedAt
  : performance.now();
const collector = new LinuxProcessTreeCollector({ intervalMs });
let stopped = false;
let lastCaptureAt = null;

function capture(force = false, kind = 'periodic') {
  if (stopped) {
    return;
  }
  const now = performance.now();
  if (
    lastCaptureAt !== null
    && now - lastCaptureAt < intervalMs * 0.8
    && !force
  ) {
    return;
  }
  collector.sample({
    elapsedMs: now - startedAt,
    wallTime: new Date().toISOString(),
    kind
  });
  lastCaptureAt = now;
}

const timer = setInterval(capture, intervalMs);

parentPort.on('message', (message) => {
  if (message?.type === 'add-root') {
    collector.addRoot(message.label, message.pid);
    capture(true, 'root-registered');
    parentPort.postMessage({
      type: 'root-registered',
      registrationId: message.registrationId
    });
    return;
  }
  if (message?.type !== 'stop' || stopped) {
    return;
  }

  capture(true, 'final');
  stopped = true;
  clearInterval(timer);
  parentPort.postMessage({
    type: 'result',
    collector: collector.result()
  });
  parentPort.close();
});

```

### Core Architecture Module: `moli-benchmark/moli_benchmark/render_compare.py`
```
from __future__ import annotations

import html.parser
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from .artifacts import write_csv, write_json, write_text
from .config import REPO_ROOT, clear_proxy_env
from .process import ProcessResult
from .stats import summarize
from .synthetic_compare import WEBFETCH_TARGETS, target_metadata
from .top_sites import (
    DEFAULT_TOP_SITES_MIN_BODY_BYTES,
    DEFAULT_TOP_SITES_PARALLELISM,
    DEFAULT_TOP_SITES_PROFILE,
    DEFAULT_TOP_SITES_SOURCE,
    TOP_SITES_PROFILES,
    _classify,
    _ok_categories,
    _run_top_sites_target,
    _top_sites_target_metadata,
    load_top_sites_entries,
    resolve_top_sites_source,
)


DEFAULT_RENDER_COMPARE_BASELINE = "chrome"
DEFAULT_RENDER_COMPARE_NGRAM_SIZE = 4
DEFAULT_RENDER_COMPARE_MATCH_THRESHOLD = 0.65
DEFAULT_RENDER_COMPARE_PARTIAL_THRESHOLD = 0.35
DEFAULT_RENDER_COMPARE_KEY_HIT_THRESHOLD = 0.70
DEFAULT_RENDER_COMPARE_PARTIAL_KEY_HIT_THRESHOLD = 0.40
DEFAULT_RENDER_COMPARE_MIN_BASELINE_TEXT_CHARS = 500
DEFAULT_RENDER_COMPARE_KEY_PHRASES = 12


_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
_PHRASE_SPLIT_RE = re.compile(r"[\n\r。！？!?；;：:]+")


class _VisibleTextExtractor(html.parser.HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._skip_depth = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() in {"script", "style", "noscript", "svg", "template"}:
            self._skip_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in {"script", "style", "noscript", "svg", "template"} and self._skip_depth:
            self._skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._skip_depth:
            return
        text = " ".join(data.split())
        if text:
            self.parts.append(text)


def _decode_output(stdout: bytes) -> str:
    return stdout.decode("utf-8", errors="replace")


def extract_visible_text(stdout: bytes) -> dict[str, Any]:
    html_text = _decode_output(stdout)
    title = ""
    match = _TITLE_RE.search(html_text)
    if match:
        title = re.sub(r"\s+", " ", match.group(1)).strip()
    parser = _VisibleTextExtractor()
    try:
        parser.feed(html_text)
    except html.parser.HTMLParseError:
        pass
    visible_text = " ".join(parser.parts)
    return {
        "title": title,
        "visible_text": visible_text,
        "visible_text_length": len(visible_text),
        "visible_text_sample": visible_text[:500],
    }


def _compact_text(text: str) -> str:
    lowered = text.lower()
    return "".join(ch for ch in lowered if ch.isalnum() or "\u4e00" <= ch <= "\u9fff")


def _ngrams(text: str, size: int) -> set[str]:
    compact = _compact_text(text)
    if len(compact) < size:
        return {compact} if compact else set()
    return {compact[index : index + size] for index in range(0, len(compact) - size + 1)}


def _ngram_containment(baseline_text: str, target_text: str, size: int) -> float:
    baseline_grams = _ngrams(baseline_text, size)
    if not baseline_grams:
        return 0.0
    target_grams = _ngrams(target_text, size)
    return len(baseline_grams & target_grams) / len(baseline_grams)


def _ngram_jaccard(baseline_text: str, target_text: str, size: int) -> float:
    baseline_grams = _ngrams(baseline_text, size)
    target_grams = _ngrams(target_text, size)
    union = baseline_grams | target_grams
    if not union:
        return 0.0
    return len(baseline_grams & target_grams) / len(union)


def _key_phrases(text: str, limit: int) -> list[str]:
    phrases: list[str] = []
    seen: set[str] = set()
    for part in _PHRASE_SPLIT_RE.split(text):
        normalized = " ".join(part.split())
        compact = _compact_text(normalized)
        if len(compact) < 12:
            continue
        phrase = normalized[:80]
        key = _compact_text(phrase)
        if key in seen:
            continue
        seen.add(key)
        phrases.append(phrase)
        if len(phrases) >= limit:
            break
    return phrases


def _phrase_hit_rate(phrases: list[str], text: str) -> float:
    if not phrases:
        return 0.0
    compact_text = _compact_text(text)
    hits = sum(1 for phrase in phrases if _compact_text(phrase) in compact_text)
    return hits / len(phrases)


def _capped_ratio(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return min(1.0, max(0.0, numerator / denominator))


def _quality_score(*, containment: float, key_hit_rate: float, text_ratio: float) -> float:
    score = 100.0 * (0.55 * containment + 0.35 * key_hit_rate + 0.10 * text_ratio)
    return round(max(0.0, min(100.0, score)), 2)


def compare_to_baseline(
    *,
    baseline_stdout: bytes,
    baseline_category: str,
    target_stdout: bytes,
    target_stderr: bytes,
    target_category: str,
    ngram_size: int = DEFAULT_RENDER_COMPARE_NGRAM_SIZE,
    match_threshold: float = DEFAULT_RENDER_COMPARE_MATCH_THRESHOLD,
    partial_threshold: float = DEFAULT_RENDER_COMPARE_PARTIAL_THRESHOLD,
    key_hit_threshold: float = DEFAULT_RENDER_COMPARE_KEY_HIT_THRESHOLD,
    partial_key_hit_threshold: float = DEFAULT_RENDER_COMPARE_PARTIAL_KEY_HIT_THRESHOLD,
    min_baseline_text_chars: int = DEFAULT_RENDER_COMPARE_MIN_BASELINE_TEXT_CHARS,
    key_phrase_limit: int = DEFAULT_RENDER_COMPARE_KEY_PHRASES,
) -> dict[str, Any]:
    baseline_snapshot = extract_visible_text(baseline_stdout)
    target_snapshot = extract_visible_text(target_stdout)
    baseline_text = str(baseline_snapshot["visible_text"])
    target_text = str(target_snapshot["visible_text"])
    phrases = _key_phrases(baseline_text, key_phrase_limit)
    containment = _ngram_containment(baseline_text, target_text, ngram_size)
    jaccard = _ngram_jaccard(baseline_text, target_text, ngram_size)
    key_hit_rate = _phrase_hit_rate(phrases, target_text)
    raw_text = _decode_output(target_stdout) + "\n" + target_stderr.decode("utf-8", errors="replace")
    raw_ngram_containment = _ngram_containment(baseline_text, raw_text, ngram_size)
    raw_key_hit_rate = _phrase_hit_rate(phrases, raw_text)
    baseline_visible_length = int(baseline_snapshot["visible_text_length"])
    target_visible_length = int(target_snapshot["visible_text_length"])
    visible_text_ratio = _capped_ratio(target_visible_length, baseline_visible_length)
    raw_text_ratio = _capped_ratio(len(_compact_text(raw_text)), max(len(_compact_text(baseline_text)), 1))
    render_quality_score = _quality_score(
        containment=containment,
        key_hit_rate=key_hit_rate,
        text_ratio=visible_text_ratio,
    )
    raw_content_score = _quality_score(
        containment=raw_ngram_containment,
        key_hit_rate=raw_key_hit_rate,
        text_ratio=raw_text_ratio,
    )

    if baseline_category not in _ok_categories():
        category = "baseline-unusable"
    elif baseline_visible_length < min_baseline_text_chars:
        category = "baseline-thin"
    elif (
        (raw_ngram_containment >= partial_threshold or raw_key_hit_rate >= partial_key_hit_threshold)
        and containment < partial_threshold
        and key_hit_rate < partial_key_hit_threshold
    ):
        category = "state-only-content"
    elif target_category not in _ok_categories():
        category = target_category
    elif containment >= match_threshold and key_hit_rate >= key_hit_threshold:
        category = "render-match"
    elif containment >= max(match_threshold, 0.80):
        category = "render-match"
    elif containment >= partial_threshold or key_hit_rate >= partial_key_hit_threshold:
        category = "render-partial"
    else:
        category = "render-mismatch"
    excluded = category.startswith("baseline-")

    return {
        "category": category,
        "excluded": excluded,
        "ok": category == "render-match",
        "baseline_title": baseline_snapshot["title"],
        "target_title": target_snapshot["title"],
        "baseline_visible_text_length": baseline_visible_length,
        "target_visible_text_length": target_visible_length,
        "visible_text_ratio": visible_text_ratio,
        "baseline_visible_text_sample": baseline_snapshot["visible_text_sample"],
        "target_visible_text_sample": target_snapshot["visible_text_sample"],
        "ngram_size": ngram_size,
        "ngram_containment": containment,
        "ngram_jaccard": jaccard,
        "key_phrase_count": len(phrases),
        "key_phrase_hit_rate": key_hit_rate,
        "raw_ngram_containment": raw_ngram_containment,
        "raw_key_phrase_hit_rate": raw_key_hit_rate,
        "render_quality_score": render_quality_score,
        "raw_content_score": raw_content_score,
        "key_phrases": phrases,
    }


def _domain_to_url(domain: str) -> str:
    if domain.startswith("http://") or domain.startswith("https://"):
        return domain
    return f"https://{domain}"


def _execute_fetch(
    *,
    target: str,
    info: dict[str, Any],
    rank: int,
    domain: str,
    timeout_seconds: float,
    min_body_bytes: int,
    proc_env: dict[str, str],
) -> dict[str, Any]:
    metadata = _top_sites_target_metadata(target)
    url = _domain_to_url(domain)
    if not info.get("available") or not info.get("path"):
        return {
            "target": target,
            **metadata,
            "rank": rank,
            "domain": domain,
            "url": url,
            "category": "target-unavailable",
            "ok": False,
            "returncode": None,
            "timed_out": False,
            "elapsed_ms": None,
            "stdout_bytes": 0,
            "stderr_bytes": 0,
            "stdout": b"",
            "stderr": b"",
            "peak_pss_bytes": None,
        }
    result: ProcessResult = _run_top_sites_target(
        targ
```

### Core Architecture Module: `moli-benchmark/moli_benchmark/wpt_cross/engine.py`
```
"""Engine drivers for cross-engine WPT runs.

An :class:`EngineDriver` knows how to launch a single headless browser engine
in CDP mode, expose its CDP HTTP endpoint (e.g. ``http://127.0.0.1:9222``),
and report enough metadata to be recorded in ``environment.json``.

The drivers are intentionally thin wrappers around the existing
``target_serve.start_target_serve`` machinery. They do **not** know anything
about WPT cases or the testharness — that lives in :mod:`runner`.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from ..config import REPO_ROOT, ReservedPort, clear_proxy_env, reserve_port
from ..sampling import ResourceSampler
from ..serve import _join_log_drain_threads, _start_log_drain_threads, probe_url
from ..versions import sha256_file


@dataclass
class EngineDriverHandle:
    """Live state of a launched engine driver."""

    engine: str
    process: subprocess.Popen[bytes]
    endpoint: str
    sampler: ResourceSampler
    port_lease: ReservedPort
    logs: list[str] = field(default_factory=list)
    temp_dir: Path | None = None
    ready_ms: float | None = None
    binary: Path | None = None
    binary_sha256: str | None = None
    binary_version: str | None = None
    log_threads: list[threading.Thread] = field(default_factory=list, repr=False)


def _binary_version(binary: Path, version_args: tuple[str, ...]) -> str | None:
    try:
        completed = subprocess.run(
            [str(binary), *version_args],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    output = (completed.stdout or completed.stderr).strip()
    return output.splitlines()[0] if output else None


def _terminate(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is not None:
        return
    try:
        process.terminate()
        process.wait(timeout=2)
        return
    except subprocess.TimeoutExpired:
        pass
    except OSError:
        return
    try:
        process.kill()
        process.wait(timeout=2)
    except (OSError, subprocess.TimeoutExpired):
        return


@dataclass
class EngineDriver:
    """Definition of how to launch a single engine.

    ``build_command`` returns the argv to launch the engine in CDP serve mode
    on the given port. ``needs_profile_dir`` indicates whether a temp profile
    directory should be provisioned before launch.
    """

    name: str
    binary_env_var: str
    default_binary_names: tuple[str, ...]
    build_command: Callable[[Path, int, Path | None], list[str]]
    version_args: tuple[str, ...]
    needs_profile_dir: bool = False
    extra_env: dict[str, str] = field(default_factory=dict)
    # Optional CLI-mode fetch invocation: (binary, url, timeout_seconds) -> argv.
    # When set, the runner prefers HTTP-callback CLI mode and skips CDP launch
    # entirely. Engines whose CLI does not execute JavaScript (e.g. obscura)
    # leave this as None and fall back to CDP.
    cli_fetch_command: Callable[[Path, str, float], list[str]] | None = None

    def resolve_binary(self, override: str | None = None) -> Path:
        raw = override or os.environ.get(self.binary_env_var)
        if raw:
            path = Path(raw).expanduser().resolve()
            if not path.exists():
                raise RuntimeError(f"{self.binary_env_var} does not exist: {path}")
            return path
        for name in self.default_binary_names:
            located = shutil.which(name)
            if located:
                return Path(located).resolve()
        raise RuntimeError(
            f"missing {self.name} binary; set {self.binary_env_var} or install one of {self.default_binary_names}"
        )

    def launch(self, *, binary_override: str | None = None, ready_timeout_seconds: float = 30.0) -> EngineDriverHandle:
        binary = self.resolve_binary(binary_override)
        last_error: RuntimeError | None = None
        for attempt in range(1, 4):
            temp_dir: Path | None = None
            if self.needs_profile_dir:
                temp_dir = Path(tempfile.mkdtemp(prefix=f"moli-bench-wpt-{self.name}-"))
            reserved = reserve_port()
            try:
                port = reserved.port
                command = self.build_command(binary, port, temp_dir)
                env = clear_proxy_env(os.environ)
                env.update(self.extra_env)
                reserved.release_socket()
                process = subprocess.Popen(
                    command,
                    cwd=REPO_ROOT,
                    env=env,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    start_new_session=True,
                )
                logs: list[str] = []
                log_threads = _start_log_drain_threads(process, logs)
            except BaseException:
                reserved.close()
                if temp_dir is not None:
                    shutil.rmtree(temp_dir, ignore_errors=True)
                raise
            endpoint = f"http://127.0.0.1:{port}"
            sampler = ResourceSampler(process.pid)
            sampler.start()
            handle = EngineDriverHandle(
                engine=self.name,
                process=process,
                endpoint=endpoint,
                sampler=sampler,
                port_lease=reserved,
                logs=logs,
                log_threads=log_threads,
                temp_dir=temp_dir,
                binary=binary,
                binary_sha256=sha256_file(binary),
                binary_version=_binary_version(binary, self.version_args),
            )
            started = time.perf_counter()
            deadline = started + ready_timeout_seconds
            version_url = endpoint + "/json/version"
            while time.perf_counter() < deadline:
                if process.poll() is not None:
                    _join_log_drain_threads(handle.log_threads)
                    log_tail = "; ".join(handle.logs[-20:])
                    self.shutdown(handle)
                    last_error = RuntimeError(
                        f"{self.name} CDP server exited early with code {process.returncode}"
                        f" on launch attempt {attempt}: {log_tail}"
                    )
                    if "Address already in use" in log_tail and attempt < 3:
                        time.sleep(0.05 * attempt)
                        break
                    raise last_error
                if probe_url(version_url):
                    handle.ready_ms = (time.perf_counter() - started) * 1000.0
                    return handle
                time.sleep(0.025)
            else:
                self.shutdown(handle)
                last_error = RuntimeError(
                    f"timed out waiting for {self.name} CDP server at {version_url}: "
                    + "; ".join(handle.logs[-20:])
                )
                raise last_error
            # Early exit due to a retryable port race.
            continue
        if last_error is not None:
            raise last_error
        raise RuntimeError(f"failed to launch {self.name} CDP server")

    def shutdown(self, handle: EngineDriverHandle | None) -> dict[str, Any]:
        if handle is None:
            return {}
        try:
            _terminate(handle.process)
            _join_log_drain_threads(handle.log_threads)
            resources = handle.sampler.stop()
        finally:
            handle.port_lease.close()
            if handle.temp_dir is not None:
                shutil.rmtree(handle.temp_dir, ignore_errors=True)
        return {
            "returncode": handle.process.returncode,
            "ready_ms": handle.ready_ms,
            "resources": resources,
            "log_tail": handle.logs[-40:],
        }


def _moli_command(binary: Path, port: int, _tmp: Path | None) -> list[str]:
    return [
        str(binary),
        "serve",
        "--layout",
        "--resource",
        "--host",
        "127.0.0.1",
        "--port",
        str(port),
    ]


def _moli_fetch(binary: Path, url: str, timeout_seconds: float) -> list[str]:
    timeout_ms = max(1000, int(timeout_seconds * 1000))
    return [
        str(binary), "fetch", "--layout", "--resource", url,
        "--wait-until", "done",
        "--wait-script",
        "globalThis.__bench_wpt__ && globalThis.__bench_wpt__.source !== 'incremental'",
        "--timeout", str(timeout_ms),
        "--log-level", "error",
    ]


def _lightpanda_command(binary: Path, port: int, _tmp: Path | None) -> list[str]:
    return [str(binary), "serve", "--host", "127.0.0.1", "--port", str(port)]


def _lightpanda_fetch(binary: Path, url: str, timeout_seconds: float) -> list[str]:
    # lightpanda's --wait-until done often never fires (no DOMContentLoaded
    # equivalent in the testharness completion path), so wait-ms acts as the
    # real in-page deadline. Keep it aligned with the configured case timeout.
    wait_ms = max(1000, int(timeout_seconds * 1000))
    return [
        str(binary), "fetch", url,
        "--dump", "html",
        "--wait-until", "done",
        "--wait-ms", str(wait_ms),
        "--http-timeout", str(wait_ms),
        "--terminate-ms", str(wait_ms),
    ]


def _obscura_command(binary: Path, port: int, _tmp: Path | None) -> list[str]:
    return [str(binary), "serve", "--port", str(port)]


def _chrome_command(binary: Path, port: int, tmp: Path | None) -> list[str]:
    if tmp is None:
        raise RuntimeError("chrome driver requires a profile directory")
    return [
        str(binary),
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--no-first-run",
        f"--user-data-dir={tmp}",
        f"--remote
```

### Core Architecture Module: `moli-benchmark/moli_benchmark/wpt_cross/render_html.py`
```
"""Render a Chart.js HTML report from a wpt_cross output directory.

The report intentionally keeps the runner data model intact: it reads the
``matrix.json`` + ``summary.json`` files emitted by
``python -m moli_benchmark.wpt_cross`` and derives visual summaries from
those files only.
"""

from __future__ import annotations

import argparse
import html
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


ENGINE_ORDER = ("moli", "lightpanda", "chrome", "obscura")
STATUS_ORDER = ("pass", "fail", "timeout", "crash", "harness-stalled", "error", "missing")
STATUS_LABELS = {
    "pass": "Pass",
    "fail": "Fail",
    "timeout": "Timeout",
    "crash": "Crash",
    "harness-stalled": "Harness stalled",
    "error": "Runner error",
    "missing": "Missing",
}
STATUS_COLOR = {
    "pass": "#1f8f4d",
    "fail": "#d64045",
    "timeout": "#b7791f",
    "crash": "#8b1e3f",
    "harness-stalled": "#7353ba",
    "error": "#c05621",
    "missing": "#6b7280",
}
ENGINE_COLOR = {
    "moli": "#2563eb",
    "lightpanda": "#0f766e",
    "chrome": "#d97706",
    "obscura": "#7c3aed",
}


def _group_key(case_path: str) -> str:
    parts = case_path.split("/", 2)
    return "/".join(parts[:2]) if len(parts) >= 2 else case_path


def _engines_from_summary(summary: dict[str, Any], matrix: list[dict[str, Any]]) -> list[str]:
    engines = list(summary.get("engines", {}).keys())
    if not engines and matrix:
        engines = list(matrix[0].get("results", {}).keys())
    ordered = [engine for engine in ENGINE_ORDER if engine in engines]
    ordered.extend(engine for engine in engines if engine not in ordered)
    return ordered


def _status_counts(summary: dict[str, Any], matrix: list[dict[str, Any]], engines: list[str]) -> dict[str, dict[str, int]]:
    out: dict[str, dict[str, int]] = {}
    for engine in engines:
        counts = Counter()
        summary_counts = summary.get("engines", {}).get(engine)
        if isinstance(summary_counts, dict):
            counts.update({str(k): int(v or 0) for k, v in summary_counts.items()})
        else:
            for row in matrix:
                counts[str(row.get("results", {}).get(engine, {}).get("status", "missing"))] += 1
        out[engine] = {status: counts.get(status, 0) for status in STATUS_ORDER if counts.get(status, 0)}
    return out


def _duration_ms(row: dict[str, Any], engine: str) -> float | None:
    value = row.get("results", {}).get(engine, {}).get("duration_ms")
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _median(values: list[float]) -> float | None:
    if not values:
        return None
    values = sorted(values)
    mid = len(values) // 2
    if len(values) % 2:
        return values[mid]
    return (values[mid - 1] + values[mid]) / 2.0


def _engine_cards(
    matrix: list[dict[str, Any]],
    engines: list[str],
    counts: dict[str, dict[str, int]],
) -> list[dict[str, Any]]:
    total = len(matrix)
    cards = []
    for engine in engines:
        passed = counts.get(engine, {}).get("pass", 0)
        non_pass = max(0, total - passed)
        durations = [_duration_ms(row, engine) for row in matrix]
        durations = [value for value in durations if value is not None]
        cards.append(
            {
                "engine": engine,
                "total": total,
                "pass": passed,
                "non_pass": non_pass,
                "pass_rate": (passed / total * 100.0) if total else 0.0,
                "median_ms": _median(durations),
                "counts": counts.get(engine, {}),
            }
        )
    return cards


def _group_rows(matrix: list[dict[str, Any]], engines: list[str]) -> list[dict[str, Any]]:
    groups: dict[str, dict[str, Counter[str]]] = defaultdict(lambda: {engine: Counter() for engine in engines})
    for row in matrix:
        group = _group_key(str(row.get("case_path", "")))
        for engine in engines:
            status = str(row.get("results", {}).get(engine, {}).get("status", "missing"))
            groups[group][engine][status] += 1

    rows = []
    for group in sorted(groups):
        engine_stats = {}
        aggregate_non_pass = 0
        aggregate_total = 0
        for engine in engines:
            counter = groups[group][engine]
            total = sum(counter.values())
            passed = counter.get("pass", 0)
            non_pass = max(0, total - passed)
            aggregate_non_pass += non_pass
            aggregate_total += total
            engine_stats[engine] = {
                "total": total,
                "pass": passed,
                "non_pass": non_pass,
                "pass_rate": (passed / total * 100.0) if total else 0.0,
                "counts": {status: counter.get(status, 0) for status in STATUS_ORDER if counter.get(status, 0)},
            }
        rows.append(
            {
                "group": group,
                "engines": engine_stats,
                "aggregate_non_pass": aggregate_non_pass,
                "aggregate_total": aggregate_total,
            }
        )
    rows.sort(key=lambda row: (-int(row["aggregate_non_pass"]), str(row["group"])))
    return rows


def _pairwise_rows(matrix: list[dict[str, Any]], engines: list[str]) -> list[dict[str, Any]]:
    rows = []
    for left in engines:
        for right in engines:
            if left == right:
                continue
            left_pass_right_not = 0
            right_pass_left_not = 0
            same_status = 0
            different_status = 0
            both_pass = 0
            both_non_pass = 0
            for row in matrix:
                left_status = str(row.get("results", {}).get(left, {}).get("status", "missing"))
                right_status = str(row.get("results", {}).get(right, {}).get("status", "missing"))
                if left_status == right_status:
                    same_status += 1
                else:
                    different_status += 1
                if left_status == "pass" and right_status == "pass":
                    both_pass += 1
                elif left_status != "pass" and right_status != "pass":
                    both_non_pass += 1
                elif left_status == "pass":
                    left_pass_right_not += 1
                elif right_status == "pass":
                    right_pass_left_not += 1
            rows.append(
                {
                    "left": left,
                    "right": right,
                    "left_pass_right_not": left_pass_right_not,
                    "right_pass_left_not": right_pass_left_not,
                    "net_pass_advantage": left_pass_right_not - right_pass_left_not,
                    "same_status": same_status,
                    "different_status": different_status,
                    "both_pass": both_pass,
                    "both_non_pass": both_non_pass,
                    "total": len(matrix),
                }
            )
    return rows


def _top_regression_rows(matrix: list[dict[str, Any]], engines: list[str], primary: str = "moli") -> list[dict[str, Any]]:
    if primary not in engines:
        return []
    rows = []
    for other in engines:
        if other == primary:
            continue
        grouped: Counter[str] = Counter()
        examples: dict[str, list[str]] = defaultdict(list)
        for row in matrix:
            left = str(row.get("results", {}).get(primary, {}).get("status", "missing"))
            right = str(row.get("results", {}).get(other, {}).get("status", "missing"))
            if left != "pass" and right == "pass":
                group = _group_key(str(row.get("case_path", "")))
                grouped[group] += 1
                if len(examples[group]) < 3:
                    examples[group].append(str(row.get("case_path", "")))
        for group, count in grouped.most_common(12):
            rows.append({"engine": other, "group": group, "count": count, "examples": examples[group]})
    rows.sort(key=lambda row: (-int(row["count"]), str(row["engine"]), str(row["group"])))
    return rows[:18]


def _status_label(status: str) -> str:
    return STATUS_LABELS.get(status, status)


def _format_ms(value: Any) -> str:
    try:
        raw = float(value)
    except (TypeError, ValueError):
        return "n/a"
    if raw >= 1000:
        return f"{raw / 1000:.2f}s"
    return f"{raw:.0f}ms"


def _render_cards(cards: list[dict[str, Any]]) -> str:
    pieces = []
    for card in cards:
        engine = str(card["engine"])
        counts = card.get("counts", {})
        chips = "".join(
            f'<span class="mini-chip"><i style="background:{STATUS_COLOR.get(status, "#999")}"></i>'
            f'{html.escape(_status_label(status))} {int(value)}</span>'
            for status, value in counts.items()
        )
        pieces.append(
            '<section class="kpi">'
            f'<div class="kpi-top"><span>{html.escape(engine)}</span>'
            f'<b style="color:{ENGINE_COLOR.get(engine, "#111827")}">{float(card["pass_rate"]):.1f}%</b></div>'
            f'<div class="kpi-main">{int(card["pass"])}<span> / {int(card["total"])} pass</span></div>'
            f'<div class="kpi-sub">{int(card["non_pass"])} non-pass · median {_format_ms(card["median_ms"])}</div>'
            f'<div class="chip-row">{chips}</div>'
            "</section>"
        )
    return "".join(pieces)


def _render_group_table(group_rows: list[dict[str, Any]], engines: list[str]) -> str:
    head = "".join(f'<th>{html.escape(engine)} pass</th><th>{html.escape(engine)} gaps</th>' for engine in engines)
    body = []
    for row in group_rows[:80]:
        cells = []
        for engine in engines:
            stats = row["engines"][engine]
            rate = float(stats["pass_rate"])
            tone = "good" if rate >= 90 else "warn" if rate >= 65 else "bad"
            cells.append(
                f'<td><span class="rate-text {tone}">{rate:.0f
```

### Core Architecture Module: `moli-cdp-smoke/moli_cdp_smoke/groups/core.py`
```
from __future__ import annotations

import asyncio

from playwright.async_api import TimeoutError as PlaywrightTimeoutError

from . import SmokeState
from ..assertions import SmokeError, assert_equal, wait_until
from ..helpers import capture_layout, attach_cdp_event_collector


def _assert_websocket_event_constraints(events: list[str], label: str) -> None:
    # Window load and WebSocket open come from distinct task sources, so only
    # assert the ordering guaranteed inside each lifecycle/protocol sequence.
    expected = ["dcl", "load", "open", "echo:OK"]
    if len(events) != len(expected) or set(events) != set(expected):
        raise SmokeError(
            f"{label}: expected each of {expected!r} exactly once, got {events!r}"
        )
    if events.index("dcl") > events.index("load"):
        raise SmokeError(f"{label}: DOMContentLoaded must precede load, got {events!r}")
    if events.index("open") > events.index("echo:OK"):
        raise SmokeError(f"{label}: WebSocket open must precede its echo, got {events!r}")


async def run_core_group(state: SmokeState) -> None:
    page = state.page
    context = state.context
    fixture = state.fixture

    await page.goto(f"{fixture}/plain", wait_until="load", timeout=10_000)
    assert_equal(await page.text_content("main"), "plain ok", "plain page text")
    state.record("new_page_goto_plain")

    second = await context.new_page()
    await second.goto(f"{fixture}/plain", wait_until="load", timeout=10_000)
    assert_equal(await second.text_content("main"), "plain ok", "second page text")
    state.record("second_page_same_context")
    await second.close()

    await run_add_init_script_workflows(state)
    await run_exposed_binding_workflows(state)

    await page.goto(f"{fixture}/iframe", wait_until="load", timeout=10_000)
    child = next((frame for frame in page.frames if "/child" in frame.url), None)
    if child is None:
        raise SmokeError(f"missing child frame; frames={[frame.url for frame in page.frames]}")
    assert_equal((await child.text_content("body", timeout=5_000)).strip(), "child body text", "child frame text")
    state.record("iframe_child_text_content", {"frameCount": len(page.frames)})

    await page.goto(f"{fixture}/wait-for-function", wait_until="domcontentloaded", timeout=10_000)
    await page.wait_for_function("() => globalThis.__ready === true", timeout=5_000)
    state.record("wait_for_function_timer")

    # Reduced from Playwright page-wait-for-function.spec.ts.
    await page.goto(f"{fixture}/plain", wait_until="load", timeout=10_000)
    string_watchdog = page.wait_for_function("window.__SMOKE_WAIT_FOR_FUNCTION === 1", timeout=5_000)
    await page.evaluate("() => { window.__SMOKE_WAIT_FOR_FUNCTION = 1; }")
    await string_watchdog
    result = await page.wait_for_function("() => 5", timeout=5_000)
    assert_equal(await result.json_value(), 5, "wait_for_function returns JSHandle value")
    await page.wait_for_function("value => value === 7", arg=7, timeout=5_000)
    await page.set_content("<div id='wait-handle'></div>")
    div = await page.query_selector("#wait-handle")
    if div is None:
        raise SmokeError("missing wait_for_function ElementHandle fixture")
    handle_watchdog = page.wait_for_function("element => !element.parentElement", arg=div, timeout=5_000)
    await page.evaluate("element => element.remove()", div)
    await handle_watchdog
    timeout_error = None
    try:
        await page.wait_for_function("() => false", timeout=25)
    except PlaywrightTimeoutError as error:
        timeout_error = str(error)
    if timeout_error is None or "Timeout 25ms exceeded" not in timeout_error:
        raise SmokeError(f"unexpected wait_for_function timeout error: {timeout_error}")
    state.record("wait_for_function_argument_and_timeout_workflow")

    await page.goto(f"{fixture}/wait-states", wait_until="load", timeout=10_000)
    attached = await page.wait_for_selector("#attached", state="attached", timeout=5_000)
    if attached is None:
        raise SmokeError("wait_for_selector attached returned no handle")
    assert_equal(await attached.text_content(), "attached ready", "wait_for_selector attached text")
    await page.locator("#delayed-button").wait_for(state="attached", timeout=5_000)
    await page.wait_for_function("() => !document.querySelector('#delayed-button')?.disabled", timeout=5_000)
    # OnDemand layout intentionally reuses its latest sampled geometry across
    # DOM/style mutations. Reach the fixture's final DOM-only state before the
    # first explicit refresh so this smoke does not require snapshot invalidation.
    await capture_layout(page)
    await page.locator("#visible").wait_for(state="visible", timeout=5_000)
    assert_equal(await page.text_content("#visible", timeout=5_000), "visible ready", "locator visible text")
    await page.wait_for_selector("#hide-me", state="hidden", timeout=5_000)
    detached = await page.wait_for_selector("#detach-me", state="detached", timeout=5_000)
    assert_equal(detached, None, "wait_for_selector detached returns null")
    await page.locator("#delayed-button").evaluate("button => button.click()")
    assert_equal(await page.text_content("#clicked", timeout=5_000), "clicked", "locator click after enabled wait")
    state.record("wait_for_selector_state_workflow")

    await page.goto(f"{fixture}/streamed-reveal-page", wait_until="load", timeout=10_000)
    await page.wait_for_function(
        "() => document.querySelector('[data-message-author-role=\"assistant\"]')?.textContent === 'OK'",
        timeout=5_000,
    )
    assert_equal(
        await page.text_content("[data-message-author-role='assistant']", timeout=5_000),
        "OK",
        "streamed reveal assistant text",
    )
    reveal_events = await page.evaluate("() => globalThis.__smokeRevealEvents || []")
    assert_equal(reveal_events, ["revealed"], "streamed reveal rAF event")
    state.record("streamed_reveal_request_animation_frame_dom")

    await page.goto(f"{fixture}/fetch-stream-client-nav-page", wait_until="load", timeout=10_000)
    await page.wait_for_function(
        "() => location.pathname === '/conversation/fetch-stream' && "
        "document.querySelector('[data-message-author-role=\"assistant\"]')?.textContent === 'OK'",
        timeout=5_000,
    )
    assert_equal(page.url, f"{fixture}/conversation/fetch-stream", "fetch stream client navigation URL")
    assert_equal(
        await page.text_content("[data-message-author-role='assistant']", timeout=5_000),
        "OK",
        "fetch stream client navigation assistant text",
    )
    fetch_stream_events = await page.evaluate("() => globalThis.__smokeFetchStreamEvents || []")
    if fetch_stream_events[:2] != ["dcl", "load"]:
        raise SmokeError(f"fetch stream client navigation lifecycle order mismatch: {fetch_stream_events}")
    if "send" not in fetch_stream_events or "response:200" not in fetch_stream_events:
        raise SmokeError(f"fetch stream client navigation missing fetch markers: {fetch_stream_events}")
    if "rendered:OK" not in fetch_stream_events:
        raise SmokeError(f"fetch stream client navigation did not render response: {fetch_stream_events}")
    state.record("fetch_stream_client_navigation_dom")

    await page.goto(f"{fixture}/chatgpt-live-channel-page", wait_until="load", timeout=10_000)
    await page.wait_for_function(
        "() => location.pathname === '/c/smoke-live' && "
        "document.querySelector('[data-message-author-role=\"assistant\"]')?.textContent === 'OK'",
        timeout=5_000,
    )
    assert_equal(page.url, f"{fixture}/c/smoke-live", "ChatGPT-like live channel navigation URL")
    assert_equal(
        await page.text_content("[data-message-author-role='assistant']", timeout=5_000),
        "OK",
        "ChatGPT-like live channel assistant text",
    )
    chatgpt_live_events = await page.evaluate("() => globalThis.__smokeChatGptLiveEvents || []")
    if chatgpt_live_events[:2] != ["dcl", "load"]:
        raise SmokeError(f"ChatGPT-like live channel lifecycle order mismatch: {chatgpt_live_events}")
    for marker in (
        "prepare:200",
        "ws:open",
        "conversation:200",
        "ws:delta:O",
        "ws:delta:K",
        "ws:done",
        "rendered:OK",
    ):
        if marker not in chatgpt_live_events:
            raise SmokeError(f"ChatGPT-like live channel missing {marker}: {chatgpt_live_events}")
    live_document_url = f"{fixture}/chatgpt-live-channel-page"
    live_document_request = next(
        (
            event
            for event in reversed(state.subresource_events)
            if event.get("method") == "Network.requestWillBeSent"
            and (event.get("params") or {}).get("type") == "Document"
            and (event.get("params") or {}).get("request", {}).get("url") == live_document_url
        ),
        None,
    )
    live_loader_id = live_document_request and (live_document_request.get("params") or {}).get("loaderId")
    if not live_loader_id:
        raise SmokeError(f"missing ChatGPT-like live channel document loaderId: {state.subresource_events[-20:]}")
    for suffix in (
        "/backend-api/f/conversation/prepare",
        "/backend-api/f/conversation",
        "/ws-chatgpt-live?conversation_id=smoke-live",
    ):
        request = next(
            (
                event
                for event in reversed(state.subresource_events)
                if event.get("method") == "Network.requestWillBeSent"
                and (event.get("params") or {}).get("documentURL") == live_document_url
                and str((event.get("params") or {}).get("request", {}).get("url") or "").endswith(suffix)
            ),
            None,
        )
        loader_id = request and (request.get("params") or {}).get("loaderId")
        assert_equal(
            loader_id,
            live_loader_id,
            f"ChatGPT-like live channel subresource loaderId for {suffix}",
        )
    state.record("
```

### Core Architecture Module: `moli-cdp-smoke/moli_cdp_smoke/groups/target_lifecycle.py`
```
from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from typing import Any

from ..assertions import SmokeError, assert_equal, record
from ..raw_cdp import RawCdpClient, connect_raw_cdp
from ..serve import MoliServe


def process_resources(pid: int) -> dict[str, int] | None:
    if not sys.platform.startswith("linux"):
        return None
    # Inspect only the managed server, not this client or other smoke workers.
    # A missing/inaccessible managed process is a failure, not a skipped check.
    descriptors: dict[int, str] = {}
    for path in Path(f"/proc/{pid}/fd").iterdir():
        try:
            descriptors[int(path.name)] = str(path.readlink())
        except FileNotFoundError:
            # A transient socket can close between directory listing/readlink.
            continue
    return {
        "fds": len(descriptors),
        "eventpoll": sum(value == "anon_inode:[eventpoll]" for value in descriptors.values()),
        "eventfd": sum(value == "anon_inode:[eventfd]" for value in descriptors.values()),
        "threads": len(list(Path(f"/proc/{pid}/task").iterdir())),
        "maxFd": max(descriptors, default=-1),
    }


def assert_resources_bounded(baseline: dict[str, int], current: dict[str, int]) -> None:
    # Permit a fixed amount of in-flight teardown/transport bookkeeping, never
    # a per-iteration allowance. The old +2 FD/page leak fails at the first batch.
    for key, allowance in (("fds", 8), ("eventpoll", 2), ("eventfd", 2), ("threads", 2)):
        if current[key] > baseline[key] + allowance:
            raise SmokeError(f"target teardown leaked {key}: baseline={baseline}, current={current}")


class LifecycleProbe:
    def __init__(self, client: RawCdpClient) -> None:
        self.client = client
        self.destroyed: set[str] = set()
        self.loaded: set[str] = set()

    def observe(self, message: dict[str, Any]) -> None:
        if message.get("method") == "Target.targetDestroyed":
            self.destroyed.add(message["params"]["targetId"])
        elif message.get("method") == "Page.loadEventFired":
            self.loaded.add(message["sessionId"])

    async def call(self, method: str, params: dict[str, Any] | None = None,
                   session: str | None = None) -> dict[str, Any]:
        response, seen = await self.client.recv_until_id(
            await self.client.send(method, params, session_id=session), timeout=10,
        )
        for message in seen:
            self.observe(message)
        return response["result"]

    async def wait_for(self, identities: set[str], identity: str, label: str) -> None:
        async def receive() -> None:
            while identity not in identities:
                self.observe(await self.client.recv())
            identities.remove(identity)
        try:
            await asyncio.wait_for(receive(), timeout=10)
        except TimeoutError as error:
            raise SmokeError(f"missing {label} for exact identity {identity}") from error

    async def attach(self, target: str) -> str:
        return (await self.call("Target.attachToTarget", {
            "targetId": target, "flatten": True,
        }))["sessionId"]

    async def close(self, target: str) -> None:
        result = await self.call("Target.closeTarget", {"targetId": target})
        assert_equal(result.get("success"), True, "Target.closeTarget accepted")
        await self.wait_for(self.destroyed, target, "Target.targetDestroyed")

    async def cycle(self, mode: str, index: int) -> None:
        params: dict[str, Any] = {"url": "about:blank", "background": bool(index % 2)}
        if mode == "context":
            params.update(await self.call("Target.createBrowserContext"))
        target = (await self.call("Target.createTarget", params))["targetId"]
        if mode == "context":
            await self.call("Target.disposeBrowserContext", {
                "browserContextId": params["browserContextId"],
            })
            await self.wait_for(self.destroyed, target, "disposed context target")
        elif mode == "page":
            await self.call("Page.close", session=await self.attach(target))
            await self.wait_for(self.destroyed, target, "Page.close target destruction")
        else:
            if mode == "detach":
                await self.call("Target.detachFromTarget", {"sessionId": await self.attach(target)})
            await self.close(target)

    async def navigate(self, url: str) -> None:
        target = (await self.call("Target.createTarget", {"url": "about:blank"}))["targetId"]
        session = await self.attach(target)
        await self.call("Page.enable", session=session)
        response = await self.call("Page.navigate", {"url": url}, session)
        if response.get("errorText"):
            raise SmokeError(f"navigation after target churn failed: {response}")
        await self.wait_for(self.loaded, session, "post-churn Page.loadEventFired")
        value = await self.call("Runtime.evaluate", {
            "expression": "document.querySelector('main')?.textContent", "returnByValue": True,
        }, session)
        assert_equal(value.get("result", {}).get("value"), "plain ok", "real HTTP document after churn")
        await self.close(target)


async def run_target_lifecycle_group(
    endpoint: str, fixture: str, results: list[dict[str, Any]], serve: MoliServe | None,
) -> None:
    pid = serve.process.pid if serve is not None else None
    client = await connect_raw_cdp(endpoint)
    probe = LifecycleProbe(client)
    try:
        await probe.call("Target.setDiscoverTargets", {"discover": True})
        for target in (await probe.call("Target.getTargets"))["targetInfos"]:
            if target["type"] == "page":
                await probe.close(target["targetId"])
        peer = (await probe.call("Target.createTarget", {"url": "about:blank"}))["targetId"]
        peer_session = await probe.attach(peer)
        await probe.call("Runtime.evaluate", {"expression": "globalThis.lifecycleSentinel = 42"}, peer_session)

        modes = (("target", 800), ("page", 800), ("detach", 128), ("context", 64))
        # Warm all closure routes and the shared network machinery once, then
        # hold the same default BrowserContext and a live peer for every batch.
        for mode, _ in modes:
            for index in range(4):
                await probe.cycle(mode, index)
        await probe.navigate(f"{fixture}/plain?lifecycle-warmup")
        baseline = process_resources(pid) if pid is not None else None
        record(results, "target_lifecycle_baseline", {
            "pid": pid, "resources": baseline,
            "fdSampling": ("external-endpoint-without-owned-pid" if pid is None else
                           "linux-proc" if baseline is not None else "unavailable-on-this-platform"),
        })
        for mode, count in modes:
            for index in range(count):
                await probe.cycle(mode, index)
                if (index + 1) % 100 == 0 or index + 1 == count:
                    current = process_resources(pid) if pid is not None else None
                    # Persist the observation before asserting, so a failed
                    # run retains the resource slope and exact failing batch.
                    record(results, "target_lifecycle_sample", {
                        "mode": mode, "closed": index + 1, "resources": current,
                    })
                    print(f"[moli-cdp-smoke] target-lifecycle {mode} {index + 1}/{count} {current}",
                          file=sys.stderr, flush=True)
                    if baseline is not None and current is not None:
                        assert_resources_bounded(baseline, current)

            await probe.navigate(f"{fixture}/plain?after-{mode}-{count}")
            sentinel = await probe.call("Runtime.evaluate", {
                "expression": "globalThis.lifecycleSentinel", "returnByValue": True,
            }, peer_session)
            assert_equal(sentinel.get("result", {}).get("value"), 42, "peer renderer survives teardown")
            targets = (await probe.call("Target.getTargets"))["targetInfos"]
            assert_equal([item["targetId"] for item in targets if item["type"] == "page"],
                         [peer], "no closed Page remains registered")
            record(results, f"target_lifecycle_{mode}", {"closed": count, "navigation": "ok", "peer": "alive"})
        await probe.close(peer)
    finally:
        await client.websocket.close()

```

### Core Architecture Module: `moli-cdp-smoke/moli_cdp_smoke/groups/workers.py`
```
from __future__ import annotations

import asyncio
import json
from typing import Any

from . import SmokeState
from ..assertions import SmokeError, assert_equal, wait_until
from ..helpers import attach_cdp_event_collector, run_worker_command


async def run_workers_group(state: SmokeState) -> None:
    page = state.page
    context = state.context
    fixture = state.fixture

    await page.goto(f"{fixture}/plain", wait_until="load", timeout=10_000)
    worker_result = await run_worker_command(page, "worker ping")
    assert_equal(worker_result.get("echoed"), "worker ping", "worker echoed message")
    assert_equal(worker_result.get("pathname"), "/worker.js", "worker location pathname")
    assert_equal(worker_result.get("selfEqualsGlobal"), True, "worker global self identity")
    state.record("worker_postmessage_round_trip")

    await _verify_shared_worker_postmessage_reuse(state)

    await context.route(
        "**/worker-route-fulfill",
        lambda route: route.fulfill(status=200, content_type="text/plain; charset=utf-8", body="worker fulfilled body"),
    )
    worker_fetch_fulfill = await run_worker_command(page, {"kind": "fetch", "url": "/worker-route-fulfill"})
    assert_equal(worker_fetch_fulfill.get("ok"), True, "worker fetch route fulfill ok")
    assert_equal(worker_fetch_fulfill.get("status"), 200, "worker fetch route fulfill status")
    assert_equal(worker_fetch_fulfill.get("text"), "worker fulfilled body", "worker fetch route fulfill body")
    state.record("worker_route_fulfill_fetch")

    async def continue_worker_xhr(route: Any) -> None:
        headers = dict(route.request.headers)
        headers["x-smoke-worker-route"] = "continued-from-worker"
        await route.continue_(headers=headers)

    await context.route("**/worker-route-continue", continue_worker_xhr)
    worker_xhr_continue = await run_worker_command(page, {"kind": "xhr", "url": "/worker-route-continue"})
    assert_equal(worker_xhr_continue.get("ok"), True, "worker xhr route continue ok")
    assert_equal(worker_xhr_continue.get("status"), 200, "worker xhr route continue status")
    assert_equal(
        worker_xhr_continue.get("text"),
        json.dumps({"method": "GET", "routeHeader": "continued-from-worker"}, separators=(",", ":")),
        "worker xhr route continue body",
    )
    state.record("worker_route_continue_xhr")

    await context.route("**/worker-route-abort", lambda route: route.abort("blockedbyclient"))
    worker_fetch_abort = await run_worker_command(page, {"kind": "fetch", "url": "/worker-route-abort"})
    assert_equal(worker_fetch_abort.get("ok"), False, "worker fetch route abort should reject")
    if not str(worker_fetch_abort.get("error", "")).startswith("TypeError:"):
        raise SmokeError(f"worker fetch route abort should reject with TypeError, got {worker_fetch_abort}")
    state.record("worker_route_abort_fetch")
    await context.unroute("**/worker-route-fulfill")
    await context.unroute("**/worker-route-continue")
    await context.unroute("**/worker-route-abort")

    await _verify_worker_fetch_auth_challenge(state)
    await _verify_worker_fetch_auth_cancel(state)
    await _verify_worker_fetch_auth_response_stage(state)
    await _verify_worker_xhr_auth_challenge(state)
    await _verify_worker_xhr_auth_cancel(state)
    await _verify_worker_xhr_auth_response_stage(state)


async def _verify_shared_worker_postmessage_reuse(state: SmokeState) -> None:
    result = await state.page.evaluate(
        """
        async ({ timeout }) => {
          const connect = label => new Promise((resolve, reject) => {
            const worker = new SharedWorker('/shared-worker.js?cdp-page-shared', 'cdp-page-shared-worker-smoke');
            globalThis.__cdpPageSharedWorkers = globalThis.__cdpPageSharedWorkers || [];
            globalThis.__cdpPageSharedWorkers.push(worker);
            const timer = setTimeout(() => reject(new Error(`shared worker ${label} timeout`)), timeout);
            worker.port.onmessage = event => {
              clearTimeout(timer);
              resolve({ label, data: event.data });
            };
            worker.port.start();
            worker.port.postMessage({ kind: 'probe', value: label });
          });
          const ports = await Promise.all([connect('first'), connect('second')]);
          return { ports };
        }
        """,
        {"timeout": 5_000},
    )
    ports = result.get("ports")
    if not isinstance(ports, list) or len(ports) != 2:
        raise SmokeError(f"shared worker page probe should return two ports: {result}")
    first = ports[0].get("data") if isinstance(ports[0], dict) else None
    second = ports[1].get("data") if isinstance(ports[1], dict) else None
    assert_equal(
        first.get("kind") if isinstance(first, dict) else None,
        "probe-result",
        "shared worker first probe kind",
    )
    assert_equal(
        second.get("kind") if isinstance(second, dict) else None,
        "probe-result",
        "shared worker second probe kind",
    )
    assert_equal(
        first.get("echoed") if isinstance(first, dict) else None,
        "first",
        "shared worker first probe echo",
    )
    assert_equal(
        second.get("echoed") if isinstance(second, dict) else None,
        "second",
        "shared worker second probe echo",
    )
    assert_equal(
        second.get("connectionCount") if isinstance(second, dict) else None,
        2,
        "shared worker named instance reuse",
    )
    assert_equal(
        second.get("isSharedWorker") if isinstance(second, dict) else None,
        True,
        "shared worker global scope",
    )
    state.record("shared_worker_postmessage_reuse")


async def _enable_worker_auth_interception(state: SmokeState, resource_type: str) -> None:
    await state.cdp.send(
        "Fetch.enable",
        {
            "handleAuthRequests": True,
            "patterns": [
                {
                    "urlPattern": "*/api-auth*",
                    "requestStage": "Request",
                    "resourceType": resource_type,
                }
            ],
        },
    )


def _assert_worker_task_pending(worker_task: asyncio.Task[Any], label: str) -> None:
    if worker_task.done():
        raise SmokeError(f"{label} settled too early: {worker_task.result()!r}")


async def _wait_worker_auth_request_pause(
    fetch_events: list[dict[str, Any]],
    fetch_start: int,
    auth_url: str,
    resource_type: str,
    label: str,
) -> tuple[str, str]:
    request_paused: dict[str, Any] | None = None

    def saw_request_pause() -> bool:
        nonlocal request_paused
        request_paused = next(
            (
                event
                for event in fetch_events[fetch_start:]
                if event["method"] == "Fetch.requestPaused"
                and event["params"].get("request", {}).get("url") == auth_url
                and event["params"].get("resourceType") == resource_type
                and "responseStatusCode" not in event["params"]
            ),
            None,
        )
        return request_paused is not None

    await wait_until(saw_request_pause, f"{label} request-stage pause")
    assert request_paused is not None
    request_id = request_paused["params"].get("requestId")
    network_id = request_paused["params"].get("networkId")
    if not isinstance(request_id, str) or not request_id:
        raise SmokeError(f"missing {label} Fetch requestId: {request_paused}")
    if not isinstance(network_id, str) or not network_id:
        raise SmokeError(f"missing {label} Fetch networkId: {request_paused}")
    return request_id, network_id


async def _wait_worker_auth_required(
    fetch_events: list[dict[str, Any]],
    fetch_start: int,
    request_id: str,
    label: str,
) -> dict[str, Any]:
    auth_required: dict[str, Any] | None = None

    def saw_auth_required() -> bool:
        nonlocal auth_required
        auth_required = next(
            (
                event
                for event in fetch_events[fetch_start:]
                if event["method"] == "Fetch.authRequired"
                and event["params"].get("requestId") == request_id
            ),
            None,
        )
        return auth_required is not None

    await wait_until(saw_auth_required, f"{label} authRequired")
    assert auth_required is not None
    assert_equal(
        auth_required["params"].get("resourceType"),
        "XHR",
        f"{label} Fetch.authRequired resource type",
    )
    if "networkId" in auth_required["params"]:
        raise SmokeError(f"{label} Fetch.authRequired must not expose networkId: {auth_required}")
    return auth_required


async def _wait_worker_auth_response_pause(
    fetch_events: list[dict[str, Any]],
    fetch_start: int,
    request_id: str,
    network_id: str,
    label: str,
) -> dict[str, Any]:
    response_paused: dict[str, Any] | None = None

    def saw_response_pause() -> bool:
        nonlocal response_paused
        response_paused = next(
            (
                event
                for event in fetch_events[fetch_start:]
                if event["method"] == "Fetch.requestPaused"
                and event["params"].get("requestId") == request_id
                and event["params"].get("networkId") == network_id
                and event["params"].get("responseStatusCode") == 200
            ),
            None,
        )
        return response_paused is not None

    await wait_until(saw_response_pause, f"{label} response pause")
    assert response_paused is not None
    assert_equal(
        response_paused["params"].get("resourceType"),
        "XHR",
        f"{label} response-stage Fetch resource type",
    )
    response_headers = response_paused["params"].get("responseHeaders") or []
    if not any(
        str(header.get("name", "")).lower() == "x-smoke-auth-stage" and header.get("value") == "ok"
        for header in response_headers
    ):
        raise SmokeError(f"{label
```

### Core Architecture Module: `moli-cdp-smoke/moli_cdp_smoke/state.py`
```
from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .assertions import record
from .fixture import FixtureServer


@dataclass
class SmokeState:
    endpoint: str
    browser: Any
    context: Any
    page: Any
    cdp: Any
    fixture: str
    fixture_server: FixtureServer
    temp_dir: Path
    results: list[dict[str, Any]]
    subresource_events: list[dict[str, Any]]
    websocket_events: list[dict[str, Any]]

    def record(self, name: str, data: dict[str, Any] | None = None) -> None:
        record(self.results, name, data)
        print(
            f"[moli-cdp-smoke] PASS scenario/{name}",
            file=sys.stderr,
            flush=True,
        )

```

### Core Architecture Module: `moli-cdp-smoke/moli_cdp_smoke/worker.py`
```
from __future__ import annotations

from .runner import main


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `moli-cookie-jar/src/model/core_conversion.rs`
```
use cookie_store::{
    BrowserSiteContext as CoreBrowserSiteContext, Cookie as StoreCookie,
    CookieAccessQueryResult as CoreCookieAccessQueryResult,
    CookieAccessSemantics as CoreCookieAccessSemantics,
    CookieEffectiveSameSite as CoreCookieEffectiveSameSite,
    CookieExclusionReason as CoreCookieExclusionReason,
    CookieScopeSemantics as CoreCookieScopeSemantics,
    CookieSetAccessResult as CoreCookieSetAccessResult,
    CookieSetRejectionReason as CoreCookieSetRejectionReason,
    CookieSetResult as CoreCookieSetResult, CookieSetWarningReason as CoreCookieSetWarningReason,
    CookieWarningReason as CoreCookieWarningReason,
    CookieWithAccessResult as CoreCookieWithAccessResult,
    SameSiteContextDowngradeType as CoreSameSiteContextDowngradeType,
    SameSiteContextHttpMethod as CoreSameSiteContextHttpMethod,
    SameSiteContextRedirectType as CoreSameSiteContextRedirectType,
    SameSiteRequestContext as CoreSameSiteRequestContext,
    StorageAccessStatus as CoreStorageAccessStatus,
};

use super::query_report::{
    StoredCookieAccess, StoredCookieAccessSemantics, StoredCookieBrowserContextValueSource,
    StoredCookieEffectiveSameSite, StoredCookieExclusionReason, StoredCookieFacadeStatus,
    StoredCookieQueryReport, StoredCookieRequestSameSiteContext,
    StoredCookieSameSiteContextDowngradeType, StoredCookieSameSiteHttpMethod,
    StoredCookieSameSiteRedirectType, StoredCookieScopeSemantics, StoredCookieSiteContextBasis,
    StoredCookieStorageAccessStatus, StoredCookieWarningReason,
};
use super::set_report::{
    StoredCookieSetRejectionReason, StoredCookieSetReport, StoredCookieSetStatus,
    StoredCookieSetWarningReason,
};
use super::stored_cookie::{StoredCookie, cookie_expiration, stored_source_scheme_from_core};

fn stored_request_same_site_context_from_core(
    context: CoreSameSiteRequestContext,
) -> StoredCookieRequestSameSiteContext {
    match context {
        CoreSameSiteRequestContext::SameSiteStrict => {
            StoredCookieRequestSameSiteContext::SameSiteStrict
        }
        CoreSameSiteRequestContext::SameSiteLax => StoredCookieRequestSameSiteContext::SameSiteLax,
        CoreSameSiteRequestContext::SameSiteLaxMethodUnsafe => {
            StoredCookieRequestSameSiteContext::SameSiteLaxMethodUnsafe
        }
        CoreSameSiteRequestContext::CrossSite => StoredCookieRequestSameSiteContext::CrossSite,
    }
}

pub(super) fn stored_effective_same_site_from_core(
    same_site: CoreCookieEffectiveSameSite,
) -> StoredCookieEffectiveSameSite {
    match same_site {
        CoreCookieEffectiveSameSite::NoRestriction => StoredCookieEffectiveSameSite::NoRestriction,
        CoreCookieEffectiveSameSite::Lax => StoredCookieEffectiveSameSite::Lax,
        CoreCookieEffectiveSameSite::Strict => StoredCookieEffectiveSameSite::Strict,
    }
}

pub(super) fn stored_access_semantics_from_core(
    semantics: CoreCookieAccessSemantics,
) -> StoredCookieAccessSemantics {
    match semantics {
        CoreCookieAccessSemantics::Unknown => StoredCookieAccessSemantics::Unknown,
        CoreCookieAccessSemantics::NonLegacy => StoredCookieAccessSemantics::NonLegacy,
        CoreCookieAccessSemantics::Legacy => StoredCookieAccessSemantics::Legacy,
    }
}

pub(super) fn stored_scope_semantics_from_core(
    semantics: CoreCookieScopeSemantics,
) -> StoredCookieScopeSemantics {
    match semantics {
        CoreCookieScopeSemantics::Unknown => StoredCookieScopeSemantics::Unknown,
        CoreCookieScopeSemantics::NonLegacy => StoredCookieScopeSemantics::NonLegacy,
        CoreCookieScopeSemantics::Legacy => StoredCookieScopeSemantics::Legacy,
    }
}

pub(super) fn stored_storage_access_status_from_core(
    status: CoreStorageAccessStatus,
) -> StoredCookieStorageAccessStatus {
    match status {
        CoreStorageAccessStatus::None => StoredCookieStorageAccessStatus::None,
        CoreStorageAccessStatus::Granted => StoredCookieStorageAccessStatus::Granted,
    }
}

fn stored_site_context_basis_from_core(
    context: &CoreBrowserSiteContext,
) -> StoredCookieSiteContextBasis {
    if context.site_for_cookies_url.is_some() {
        StoredCookieSiteContextBasis::SiteForCookies
    } else if context.top_frame_origin_url.is_some() {
        StoredCookieSiteContextBasis::TopFrameOrigin
    } else {
        StoredCookieSiteContextBasis::None
    }
}

fn stored_browser_context_value_source_from_core_presence(
    present: bool,
) -> StoredCookieBrowserContextValueSource {
    if present {
        StoredCookieBrowserContextValueSource::RequestContext
    } else {
        StoredCookieBrowserContextValueSource::Unset
    }
}

pub(super) fn stored_warning_reason_from_core(
    reason: CoreCookieWarningReason,
) -> StoredCookieWarningReason {
    match reason {
        CoreCookieWarningReason::SchemefulSameSiteContextMismatch => {
            StoredCookieWarningReason::SchemefulSameSiteContextMismatch
        }
        CoreCookieWarningReason::StrictLaxDowngradeStrictSameSite => {
            StoredCookieWarningReason::StrictLaxDowngradeStrictSameSite
        }
        CoreCookieWarningReason::StrictCrossDowngradeStrictSameSite => {
            StoredCookieWarningReason::StrictCrossDowngradeStrictSameSite
        }
        CoreCookieWarningReason::StrictCrossDowngradeLaxSameSite => {
            StoredCookieWarningReason::StrictCrossDowngradeLaxSameSite
        }
        CoreCookieWarningReason::LaxCrossDowngradeStrictSameSite => {
            StoredCookieWarningReason::LaxCrossDowngradeStrictSameSite
        }
        CoreCookieWarningReason::LaxCrossDowngradeLaxSameSite => {
            StoredCookieWarningReason::LaxCrossDowngradeLaxSameSite
        }
        CoreCookieWarningReason::SameSiteContextDowngradedByRedirect => {
            StoredCookieWarningReason::SameSiteContextDowngradedByRedirect
        }
        CoreCookieWarningReason::SecureAccessGrantedNonCryptographic => {
            StoredCookieWarningReason::SecureAccessGrantedNonCryptographic
        }
    }
}

pub(super) fn stored_same_site_context_downgrade_type_from_core(
    downgrade_type: CoreSameSiteContextDowngradeType,
) -> StoredCookieSameSiteContextDowngradeType {
    match downgrade_type {
        CoreSameSiteContextDowngradeType::StrictToLax => {
            StoredCookieSameSiteContextDowngradeType::StrictToLax
        }
        CoreSameSiteContextDowngradeType::StrictToCross => {
            StoredCookieSameSiteContextDowngradeType::StrictToCross
        }
        CoreSameSiteContextDowngradeType::LaxToCross => {
            StoredCookieSameSiteContextDowngradeType::LaxToCross
        }
    }
}

pub(super) fn stored_same_site_http_method_from_core(
    http_method: CoreSameSiteContextHttpMethod,
) -> StoredCookieSameSiteHttpMethod {
    match http_method {
        CoreSameSiteContextHttpMethod::Unset => StoredCookieSameSiteHttpMethod::Unset,
        CoreSameSiteContextHttpMethod::Unknown => StoredCookieSameSiteHttpMethod::Unknown,
        CoreSameSiteContextHttpMethod::Get => StoredCookieSameSiteHttpMethod::Get,
        CoreSameSiteContextHttpMethod::Head => StoredCookieSameSiteHttpMethod::Head,
        CoreSameSiteContextHttpMethod::Post => StoredCookieSameSiteHttpMethod::Post,
        CoreSameSiteContextHttpMethod::Put => StoredCookieSameSiteHttpMethod::Put,
        CoreSameSiteContextHttpMethod::Delete => StoredCookieSameSiteHttpMethod::Delete,
        CoreSameSiteContextHttpMethod::Connect => StoredCookieSameSiteHttpMethod::Connect,
        CoreSameSiteContextHttpMethod::Options => StoredCookieSameSiteHttpMethod::Options,
        CoreSameSiteContextHttpMethod::Trace => StoredCookieSameSiteHttpMethod::Trace,
        CoreSameSiteContextHttpMethod::Patch => StoredCookieSameSiteHttpMethod::Patch,
    }
}

pub(super) fn stored_same_site_redirect_type_from_core(
    redirect_type: CoreSameSiteContextRedirectType,
) -> StoredCookieSameSiteRedirectType {
    match redirect_type {
        CoreSameSiteContextRedirectType::Unset => StoredCookieSameSiteRedirectType::Unset,
        CoreSameSiteContextRedirectType::NoRedirect => StoredCookieSameSiteRedirectType::NoRedirect,
        CoreSameSiteContextRedirectType::CrossSiteRedirect => {
            StoredCookieSameSiteRedirectType::CrossSiteRedirect
        }
        CoreSameSiteContextRedirectType::PartialSameSiteRedirect => {
            StoredCookieSameSiteRedirectType::PartialSameSiteRedirect
        }
        CoreSameSiteContextRedirectType::AllSameSiteRedirect => {
            StoredCookieSameSiteRedirectType::AllSameSiteRedirect
        }
    }
}

pub(super) fn stored_exclusion_reason_from_core(
    reason: CoreCookieExclusionReason,
) -> StoredCookieExclusionReason {
    match reason {
        CoreCookieExclusionReason::Expired => StoredCookieExclusionReason::Expired,
        CoreCookieExclusionReason::DomainMismatch => StoredCookieExclusionReason::DomainMismatch,
        CoreCookieExclusionReason::PathMismatch => StoredCookieExclusionReason::PathMismatch,
        CoreCookieExclusionReason::SecureOnly => StoredCookieExclusionReason::SecureOnly,
        CoreCookieExclusionReason::HttpOnly => StoredCookieExclusionReason::HttpOnly,
        CoreCookieExclusionReason::PortMismatch => StoredCookieExclusionReason::PortMismatch,
        CoreCookieExclusionReason::SchemeMismatch => StoredCookieExclusionReason::SchemeMismatch,
        CoreCookieExclusionReason::SameSiteStrict => StoredCookieExclusionReason::SameSiteStrict,
        CoreCookieExclusionReason::SameSiteLax => StoredCookieExclusionReason::SameSiteLax,
        CoreCookieExclusionReason::PartitionKeyMismatch => {
            StoredCookieExclusionReason::PartitionKeyMismatch
        }
    }
}

pub(super) fn stored_set_warning_reason_from_core(
    reason: CoreCookieSetWarningReason,
) -> StoredCookieSetWarningReason {
    match reason {
        CoreCookieSetWarningReason::DomainAttributeIgnored => {
            StoredCookieSetWarningReason::DomainAttributeIgnored
        }
        CoreCookieSetWarningReason::Path
```

### Core Architecture Module: `moli-cookie-store/src/utils.rs`
```
use std::net::{Ipv4Addr, Ipv6Addr};
use url::Host;
use url::Url;

pub fn is_http_scheme(url: &Url) -> bool {
    matches!(url.scheme(), "http" | "https" | "ws" | "wss")
}

pub fn is_host_name(host: &str) -> bool {
    host.parse::<Ipv4Addr>().is_err() && host.parse::<Ipv6Addr>().is_err()
}

pub fn is_secure(url: &Url) -> bool {
    if matches!(url.scheme(), "https" | "wss") {
        return true;
    }
    if let Some(u) = url.host() {
        match u {
            Host::Domain(d) => d == "localhost",
            Host::Ipv4(ip) => ip.is_loopback(),
            Host::Ipv6(ip) => ip.is_loopback(),
        }
    } else {
        false
    }
}

/// Returns true when the URL is allowed to use secure-cookie semantics even
/// though it is not cryptographic.
///
/// Chromium distinguishes these "trustworthy but non-cryptographic" origins
/// from true HTTPS so access/set paths can emit advisory warnings instead of
/// silently treating them as ordinary secure contexts.
pub fn is_trustworthy_non_cryptographic(url: &Url) -> bool {
    !matches!(url.scheme(), "https" | "wss") && is_secure(url)
}

#[cfg(test)]
pub mod test {
    use crate::cookie::Cookie;
    use time::{Duration, OffsetDateTime};
    use url::Url;
    #[inline]
    pub fn url(url: &str) -> Url {
        Url::parse(url).unwrap()
    }
    #[inline]
    pub fn make_cookie<'a>(
        cookie: &str,
        url_str: &str,
        expires: Option<OffsetDateTime>,
        max_age: Option<u64>,
    ) -> Cookie<'a> {
        Cookie::parse(
            format!(
                "{}{}{}",
                cookie,
                expires.map_or(String::from(""), |e| format!(
                    "; Expires={}",
                    e.format(time::macros::format_description!("[weekday repr:short], [day] [month repr:short] [year] [hour]:[minute]:[second] GMT")).unwrap()
                )),
                max_age.map_or(String::from(""), |m| format!("; Max-Age={m}"))
            ),
            &url(url_str),
        )
        .unwrap()
    }
    #[inline]
    pub fn in_days(days: i64) -> OffsetDateTime {
        OffsetDateTime::now_utc() + Duration::days(days)
    }
    #[inline]
    pub fn in_minutes(mins: i64) -> OffsetDateTime {
        OffsetDateTime::now_utc() + Duration::minutes(mins)
    }
}

```

### Core Architecture Module: `moli-core/src/config/mod.rs`
```
use std::path::{Path, PathBuf};

use moli_fetch::FetchConfig;
use moli_page_types::{
    LayoutConfiguration, LayoutPolicy, OptionalResourceFetchMask, SubresourceResourceType,
};

#[derive(Debug, Clone)]
pub struct BrowserConfig {
    document_start_scripts: Vec<String>,
    fetch: FetchConfig,
    profile_dir: Option<PathBuf>,
    layout_configuration: LayoutConfiguration,
    optional_resource_fetch_mask: OptionalResourceFetchMask,
    subframe_loading_enabled: bool,
    script_execution_disabled: bool,
    author_styles_disabled: bool,
    wpt_extensions_enabled: bool,
}

impl Default for BrowserConfig {
    fn default() -> Self {
        Self {
            document_start_scripts: Vec::new(),
            fetch: FetchConfig::default(),
            profile_dir: None,
            layout_configuration: LayoutConfiguration::default(),
            optional_resource_fetch_mask: OptionalResourceFetchMask::NONE,
            subframe_loading_enabled: true,
            script_execution_disabled: false,
            author_styles_disabled: false,
            wpt_extensions_enabled: false,
        }
    }
}

impl BrowserConfig {
    pub fn document_start_scripts(&self) -> &[String] {
        &self.document_start_scripts
    }

    pub fn add_document_start_script(&mut self, source: impl Into<String>) {
        self.document_start_scripts.push(source.into());
    }

    pub fn with_document_start_script(mut self, source: impl Into<String>) -> Self {
        self.add_document_start_script(source);
        self
    }

    pub fn fetch(&self) -> &FetchConfig {
        &self.fetch
    }

    pub fn fetch_mut(&mut self) -> &mut FetchConfig {
        &mut self.fetch
    }

    pub fn profile_dir(&self) -> Option<&Path> {
        self.profile_dir.as_deref()
    }

    pub fn set_profile_dir(&mut self, profile_dir: Option<PathBuf>) {
        self.profile_dir = profile_dir;
    }

    pub fn layout_policy(&self) -> LayoutPolicy {
        self.layout_configuration.policy
    }

    pub fn set_layout_policy(&mut self, policy: LayoutPolicy) {
        self.layout_configuration.policy = policy;
    }

    pub fn with_layout_policy(mut self, policy: LayoutPolicy) -> Self {
        self.set_layout_policy(policy);
        self
    }

    pub fn scrollbars_hidden(&self) -> bool {
        self.layout_configuration.scrollbars_hidden
    }

    pub fn set_scrollbars_hidden(&mut self, hidden: bool) {
        self.layout_configuration.scrollbars_hidden = hidden;
    }

    pub fn with_scrollbars_hidden(mut self, hidden: bool) -> Self {
        self.set_scrollbars_hidden(hidden);
        self
    }

    pub fn layout_configuration(&self) -> LayoutConfiguration {
        self.layout_configuration
    }

    pub fn image_fetch_enabled(&self) -> bool {
        self.optional_resource_fetch_enabled(SubresourceResourceType::Image)
    }

    pub fn set_image_fetch_enabled(&mut self, enabled: bool) {
        self.set_optional_resource_fetch_enabled(SubresourceResourceType::Image, enabled);
    }

    pub fn with_image_fetch_enabled(mut self, enabled: bool) -> Self {
        self.set_image_fetch_enabled(enabled);
        self
    }

    pub fn optional_resource_fetch_mask(&self) -> OptionalResourceFetchMask {
        self.optional_resource_fetch_mask
    }

    pub fn set_optional_resource_fetch_mask(&mut self, mask: OptionalResourceFetchMask) {
        self.optional_resource_fetch_mask = mask;
    }

    pub fn with_optional_resource_fetch_mask(mut self, mask: OptionalResourceFetchMask) -> Self {
        self.set_optional_resource_fetch_mask(mask);
        self
    }

    pub fn optional_resource_fetch_enabled(&self, resource_type: SubresourceResourceType) -> bool {
        self.optional_resource_fetch_mask.allows(resource_type)
    }

    pub fn set_optional_resource_fetch_enabled(
        &mut self,
        resource_type: SubresourceResourceType,
        enabled: bool,
    ) {
        let Some(resource) = OptionalResourceFetchMask::for_resource_type(resource_type) else {
            return;
        };
        self.optional_resource_fetch_mask.set(resource, enabled);
    }

    pub fn subframe_loading_enabled(&self) -> bool {
        self.subframe_loading_enabled
    }

    pub fn set_subframe_loading_enabled(&mut self, enabled: bool) {
        self.subframe_loading_enabled = enabled;
    }

    pub fn with_subframe_loading_enabled(mut self, enabled: bool) -> Self {
        self.set_subframe_loading_enabled(enabled);
        self
    }

    pub fn script_execution_disabled(&self) -> bool {
        self.script_execution_disabled
    }

    pub fn set_script_execution_disabled(&mut self, disabled: bool) {
        self.script_execution_disabled = disabled;
    }

    pub fn author_styles_disabled(&self) -> bool {
        self.author_styles_disabled
    }

    pub fn set_author_styles_disabled(&mut self, disabled: bool) {
        self.author_styles_disabled = disabled;
    }

    pub fn wpt_extensions_enabled(&self) -> bool {
        self.wpt_extensions_enabled
    }

    pub fn set_wpt_extensions_enabled(&mut self, enabled: bool) {
        self.wpt_extensions_enabled = enabled;
    }

    pub fn with_wpt_extensions_enabled(mut self, enabled: bool) -> Self {
        self.set_wpt_extensions_enabled(enabled);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const OPTIONAL_RESOURCES: [(SubresourceResourceType, OptionalResourceFetchMask); 6] = [
        (
            SubresourceResourceType::Image,
            OptionalResourceFetchMask::IMAGE,
        ),
        (
            SubresourceResourceType::Font,
            OptionalResourceFetchMask::FONT,
        ),
        (
            SubresourceResourceType::Audio,
            OptionalResourceFetchMask::AUDIO,
        ),
        (
            SubresourceResourceType::Video,
            OptionalResourceFetchMask::VIDEO,
        ),
        (
            SubresourceResourceType::Media,
            OptionalResourceFetchMask::MEDIA,
        ),
        (
            SubresourceResourceType::TextTrack,
            OptionalResourceFetchMask::TEXT_TRACK,
        ),
    ];

    #[test]
    fn browser_config_defaults_layout_to_mock_and_can_select_on_demand() {
        let mut config = BrowserConfig::default();
        assert_eq!(config.layout_policy(), LayoutPolicy::Mock);

        config.set_layout_policy(LayoutPolicy::OnDemand);
        assert_eq!(config.layout_policy(), LayoutPolicy::OnDemand);

        let config = config.with_layout_policy(LayoutPolicy::Mock);
        assert_eq!(config.layout_policy(), LayoutPolicy::Mock);
    }

    #[test]
    fn browser_config_disables_every_optional_resource_family_by_default() {
        let config = BrowserConfig::default();

        assert_eq!(
            config.optional_resource_fetch_mask(),
            OptionalResourceFetchMask::NONE
        );
        for (resource_type, _) in OPTIONAL_RESOURCES {
            assert!(
                !config.optional_resource_fetch_enabled(resource_type),
                "{resource_type:?} must require an explicit opt-in"
            );
        }
        for resource_type in [
            SubresourceResourceType::Script,
            SubresourceResourceType::Stylesheet,
            SubresourceResourceType::Fetch,
            SubresourceResourceType::Xhr,
        ] {
            assert!(
                config.optional_resource_fetch_enabled(resource_type),
                "{resource_type:?} is outside the optional-resource policy"
            );
        }
    }

    #[test]
    fn browser_config_defaults_to_script_execution_and_can_disable_it() {
        let mut config = BrowserConfig::default();
        assert!(!config.script_execution_disabled());

        config.set_script_execution_disabled(true);
        assert!(config.script_execution_disabled());
    }

    #[test]
    fn browser_config_defaults_to_author_styles_and_can_disable_them() {
        let mut config = BrowserConfig::default();
        assert!(!config.author_styles_disabled());

        config.set_author_styles_disabled(true);
        assert!(config.author_styles_disabled());
    }

    #[test]
    fn browser_config_toggles_each_optional_resource_bit_independently() {
        for (enabled_type, enabled_bit) in OPTIONAL_RESOURCES {
            let mut config = BrowserConfig::default();
            config.set_optional_resource_fetch_enabled(enabled_type, true);

            assert_eq!(config.optional_resource_fetch_mask(), enabled_bit);
            for (observed_type, _) in OPTIONAL_RESOURCES {
                assert_eq!(
                    config.optional_resource_fetch_enabled(observed_type),
                    observed_type == enabled_type,
                    "enabling {enabled_type:?} changed {observed_type:?}"
                );
            }

            config.set_optional_resource_fetch_enabled(enabled_type, false);
            assert_eq!(
                config.optional_resource_fetch_mask(),
                OptionalResourceFetchMask::NONE
            );
        }
    }

    #[test]
    fn legacy_image_switch_changes_only_the_image_bit() {
        let preserved = OptionalResourceFetchMask::FONT | OptionalResourceFetchMask::TEXT_TRACK;
        let mut config = BrowserConfig::default().with_optional_resource_fetch_mask(preserved);

        config.set_image_fetch_enabled(true);
        assert_eq!(
            config.optional_resource_fetch_mask(),
            preserved | OptionalResourceFetchMask::IMAGE
        );
        assert!(config.image_fetch_enabled());

        config.set_image_fetch_enabled(false);
        assert_eq!(config.optional_resource_fetch_mask(), preserved);
        assert!(!config.image_fetch_enabled());
    }

    #[test]
    fn browser_config_ignores_non_optional_resource_mutations() {
        let mut config = BrowserConfig::default()
            .with_optional_resource_fetch_mask(OptionalResourceFetchMask::ALL);

        config.set_optional_resource_fetch_enabled(SubresourceResourceType::Script, false);

        assert_eq!(
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1217** (2026-10-06): **perf(mem): fix unreleased v8::Context holders**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > <!-- moli-sequential-navigation-soak --> ## Sequential Navigation Soak A/B  ✅ HEAD completed the 200-navigation resilience and memory observation.  One browser process, one target, and one CDP session navigate CSDN → SegmentFault → Huaban → example.com repeatedly. This run issued 200 `Page.navigate` commands per binary.  Common ancestor `557d40e12d` → HEAD `b43cc34d1a`; benchmark order: `head-first`; workflow: `success`.  ### Session resilience  | Metric | Base | HEAD | | --- | ---: | ---: | | Attempted / planned | 200 / 200 | 200 / 200 | | Direct observable pass | 199 / 200 | 195 / 200 | | Failures / recovered | 1 / 1 | 5 / 5 | | Recovery failures | 0 | 0 | | Lifecycle order violations | 0 | 0 | | Network order violations | 0 | 0 | | Wall time | 293.1 s | 337.5 s |  A public-page failure is reported separately from an unrecoverable session. The soak requires all navigation attempts, zero failed recovery, zero lifecycle/network ordering violations, and complete resource evidence.  ### 
  > <!-- moli-spider-bench --> ## Spider Bench A/B  ✅ All benchmark browser service runs completed; results are informational.  **Public HEAD:** 184 / 240 rows; 38 / 48 sites produced rows; 10 unexpected empty sites.  ✅ Deterministic fixture contract is clean.  Common ancestor `557d40e12d51` → HEAD `b43cc34d1a7d`; benchmark order: `head-first`; workflow: `success`.  ### Public 48-site run · informational  | Metric | Base | HEAD | Δ | | --- | ---: | ---: | ---: | | Run status | success | success | — | | Extracted rows / contract | 184 / 240 | 184 / 240 | 0 (0.00%) | | Contract fill | 76.67% | 76.67% | 0.00 pp (0.00%) | | Sites with rows | 38 / 48 | 38 / 48 | 0 (0.00%) | | Sites meeting row contract | 36 / 48 | 36 / 48 | 0 (0.00%) | | Unexpected empty sites | 10 | 10 | 0 (0.00%) | | Partial-row sites | 2 | 2 | 0 (0.00%) | | Site outcomes | extracted: 37; HTTP error + rows: 1; empty: 7; HTTP error + empty: 1; snapshot error + empty: 2 | extracted: 36; HTTP error + rows: 2; empty: 7; HTTP erro
  > <!-- moli-ci-regression-report --> ## CI Regression Report  [Source CI run](https://github.com/lexmount/moli/actions/runs/37459019312) · source state at render: `in_progress` · artifacts: `6/6`  | Check | Status | Signal | | --- | :---: | --- | | Release regression | ✅ | HEAD/base failures 0/0; raw binary +0.002627% | | Frontend differential | ✅ | 1,020/1,020 cases matched; 0 issues | | Agent episodes | ✅ | 8/8 Moli episodes passed; 0 failures | | Runtime/CDP contracts | ✅ | 26 contract cases; 0 failures | | CDP smoke | ✅ | 52/52 groups passed; 616 scenarios | | WebMainBench | ✅ | 545/545 completed; 0 unexpected failures |  <details open><summary><strong>Release regression</strong> — ✅ HEAD/base failures 0/0; raw binary +0.002627%</summary>  #### Package and image size  | Metric | Base | HEAD | Delta | Delta % | | --- | ---: | ---: | ---: | ---: | | Raw binary | 148.13 MiB | 148.14 MiB | +3.98 KiB | +0.002627% | | Stripped binary | 101.88 MiB | 101.89 MiB | +4.00 KiB | +0.003834% | | g

- **Issue #1215** (2026-10-06): **feat(webidl): derive native interface brand checks**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > <!-- moli-spider-bench --> ## Spider Bench A/B  ✅ All benchmark browser service runs completed; results are informational.  **Public HEAD:** 184 / 240 rows; 38 / 48 sites produced rows; 10 unexpected empty sites.  ✅ Deterministic fixture contract is clean.  Common ancestor `706f22f3ec5b` → HEAD `227f2d78ce5f`; benchmark order: `head-first`; workflow: `success`.  ### Public 48-site run · informational  | Metric | Base | HEAD | Δ | | --- | ---: | ---: | ---: | | Run status | success | success | — | | Extracted rows / contract | 184 / 240 | 184 / 240 | 0 (0.00%) | | Contract fill | 76.67% | 76.67% | 0.00 pp (0.00%) | | Sites with rows | 38 / 48 | 38 / 48 | 0 (0.00%) | | Sites meeting row contract | 36 / 48 | 36 / 48 | 0 (0.00%) | | Unexpected empty sites | 10 | 10 | 0 (0.00%) | | Partial-row sites | 2 | 2 | 0 (0.00%) | | Site outcomes | extracted: 37; HTTP error + rows: 1; empty: 7; HTTP error + empty: 1; snapshot error + empty: 2 | extracted: 36; HTTP error + rows: 2; empty: 7; HTTP erro
  > <!-- moli-sequential-navigation-soak --> ## Sequential Navigation Soak A/B  ✅ HEAD completed the 200-navigation resilience and memory observation.  One browser process, one target, and one CDP session navigate CSDN → SegmentFault → Huaban → example.com repeatedly. This run issued 200 `Page.navigate` commands per binary.  Common ancestor `706f22f3ec` → HEAD `227f2d78ce`; benchmark order: `head-first`; workflow: `success`.  ### Session resilience  | Metric | Base | HEAD | | --- | ---: | ---: | | Attempted / planned | 200 / 200 | 200 / 200 | | Direct observable pass | 199 / 200 | 199 / 200 | | Failures / recovered | 1 / 1 | 1 / 1 | | Recovery failures | 0 | 0 | | Lifecycle order violations | 0 | 0 | | Network order violations | 0 | 0 | | Wall time | 267.8 s | 286.4 s |  A public-page failure is reported separately from an unrecoverable session. The soak requires all navigation attempts, zero failed recovery, zero lifecycle/network ordering violations, and complete resource evidence.  ### 
  > <!-- moli-ci-regression-report --> ## CI Regression Report  [Source CI run](https://github.com/lexmount/moli/actions/runs/37374269294) · source state at render: `in_progress` · artifacts: `6/6`  | Check | Status | Signal | | --- | :---: | --- | | Release regression | ✅ | HEAD/base failures 0/0; raw binary +0.000561% | | Frontend differential | ✅ | 1,020/1,020 cases matched; 0 issues | | Agent episodes | ✅ | 8/8 Moli episodes passed; 0 failures | | Runtime/CDP contracts | ✅ | 26 contract cases; 0 failures | | CDP smoke | ✅ | 52/52 groups passed; 616 scenarios | | WebMainBench | ✅ | 545/545 completed; 0 unexpected failures |  <details open><summary><strong>Release regression</strong> — ✅ HEAD/base failures 0/0; raw binary +0.000561%</summary>  #### Package and image size  | Metric | Base | HEAD | Delta | Delta % | | --- | ---: | ---: | ---: | ---: | | Raw binary | 148.13 MiB | 148.13 MiB | +872 B | +0.000561% | | Stripped binary | 101.88 MiB | 101.88 MiB | 0 B | 0.00% | | gzip binary | 5

- **Issue #1214** (2026-10-06): **fix(svg): validate root factory receivers with native brands**
  *Symptoms*: Existing SVG root matrix and transform factories accepted forged objects and author Proxy receivers because their declaration did not enable receiver validation. Enable generated SVGSVGElement native-brand checks for the existing root method declaration, including createSVGRect and deselectAll, before entering the callback.  The standalone regression covers main and child realms, live and windowless documents, forged/proxy/revoked/wrong-interface receivers, trap-free branding, genuine cross-realm roots and independent transform matrix state. New number/length factories remain a separate branch; this change uses only interfaces already in main.  Validation on this standalone branch, based on main `041846069a`:  - `cargo fmt --all` - `cargo clippy --workspace --all-targets --all-features -- -D warnings` - `cargo nextest run --no-fail-fast --test-threads 32 --retries 0` with a local scheduling override: 19,618 passed, 16 skipped.  The local nextest tool configuration reserves 32 scheduling slots for the existing sync-XHR watchdog test. All other tests retain 32-way parallelism; test assertions and the repository configuration are unchanged.
  **Post-Mortem & Fix Analysis**:
  > <!-- moli-spider-bench --> ## Spider Bench A/B  ✅ All benchmark browser service runs completed; results are informational.  **Public HEAD:** 184 / 240 rows; 38 / 48 sites produced rows; 10 unexpected empty sites.  ✅ Deterministic fixture contract is clean.  Common ancestor `041846069aaa` → HEAD `4302a44078d3`; benchmark order: `head-first`; workflow: `success`.  ### Public 48-site run · informational  | Metric | Base | HEAD | Δ | | --- | ---: | ---: | ---: | | Run status | success | success | — | | Extracted rows / contract | 184 / 240 | 184 / 240 | 0 (0.00%) | | Contract fill | 76.67% | 76.67% | 0.00 pp (0.00%) | | Sites with rows | 38 / 48 | 38 / 48 | 0 (0.00%) | | Sites meeting row contract | 36 / 48 | 36 / 48 | 0 (0.00%) | | Unexpected empty sites | 10 | 10 | 0 (0.00%) | | Partial-row sites | 2 | 2 | 0 (0.00%) | | Site outcomes | extracted: 37; HTTP error + rows: 1; empty: 7; HTTP error + empty: 1; snapshot error + empty: 2 | extracted: 36; HTTP error + rows: 2; empty: 7; HTTP erro
  > <!-- moli-ci-regression-report --> ## CI Regression Report  [Source CI run](https://github.com/lexmount/moli/actions/runs/37362224974) · source state at render: `failure` · artifacts: `5/6`  | Check | Status | Signal | | --- | :---: | --- | | Release regression | ✅ | HEAD/base failures 0/0; raw binary 0.00% | | Frontend differential | ✅ | 1,020/1,020 cases matched; 0 issues | | Agent episodes | ✅ | 8/8 Moli episodes passed; 0 failures | | Runtime/CDP contracts | ✅ | 26 contract cases; 0 failures | | CDP smoke | ✅ | 52/52 groups passed; 616 scenarios | | WebMainBench | ⚪ | artifact unavailable or invalid |  <details open><summary><strong>Release regression</strong> — ✅ HEAD/base failures 0/0; raw binary 0.00%</summary>  #### Package and image size  | Metric | Base | HEAD | Delta | Delta % | | --- | ---: | ---: | ---: | ---: | | Raw binary | 148.13 MiB | 148.13 MiB | 0 B | 0.00% | | Stripped binary | 101.88 MiB | 101.88 MiB | 0 B | 0.00% | | gzip binary | 50.79 MiB | 50.79 MiB | +523 B |

- **Issue #1194** (2026-10-05): **perf(dom): better inline script performance**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > <!-- moli-spider-bench --> ## Spider Bench A/B  ✅ All benchmark browser service runs completed; results are informational.  **Public HEAD:** 184 / 240 rows; 38 / 48 sites produced rows; 10 unexpected empty sites.  ✅ Deterministic fixture contract is clean.  Common ancestor `7909cff7b65b` → HEAD `b75de5c66f6c`; benchmark order: `base-first`; workflow: `success`.  ### Public 48-site run · informational  | Metric | Base | HEAD | Δ | | --- | ---: | ---: | ---: | | Run status | success | success | — | | Extracted rows / contract | 184 / 240 | 184 / 240 | 0 (0.00%) | | Contract fill | 76.67% | 76.67% | 0.00 pp (0.00%) | | Sites with rows | 38 / 48 | 38 / 48 | 0 (0.00%) | | Sites meeting row contract | 36 / 48 | 36 / 48 | 0 (0.00%) | | Unexpected empty sites | 10 | 10 | 0 (0.00%) | | Partial-row sites | 2 | 2 | 0 (0.00%) | | Site outcomes | extracted: 36; HTTP error + rows: 2; empty: 7; HTTP error + empty: 1; snapshot error + empty: 2 | extracted: 37; HTTP error + rows: 1; empty: 8; HTTP erro
  > <!-- moli-ci-regression-report --> ## CI Regression Report  [Source CI run](https://github.com/lexmount/moli/actions/runs/37308562527) · source state at render: `in_progress` · artifacts: `6/6`  | Check | Status | Signal | | --- | :---: | --- | | Release regression | ✅ | HEAD/base failures 0/0; raw binary +0.002862% | | Frontend differential | ✅ | 1,020/1,020 cases matched; 0 issues | | Agent episodes | ✅ | 8/8 Moli episodes passed; 0 failures | | Runtime/CDP contracts | ✅ | 26 contract cases; 0 failures | | CDP smoke | ✅ | 52/52 groups passed; 616 scenarios | | WebMainBench | ✅ | 545/545 completed; 0 unexpected failures |  <details open><summary><strong>Release regression</strong> — ✅ HEAD/base failures 0/0; raw binary +0.002862%</summary>  #### Package and image size  | Metric | Base | HEAD | Delta | Delta % | | --- | ---: | ---: | ---: | ---: | | Raw binary | 147.43 MiB | 147.43 MiB | +4.32 KiB | +0.002862% | | Stripped binary | 101.30 MiB | 101.30 MiB | +4.00 KiB | +0.003856% | | g
  > <!-- moli-sequential-navigation-soak --> ## Sequential Navigation Soak A/B  ✅ HEAD completed the 200-navigation resilience and memory observation.  One browser process, one target, and one CDP session navigate CSDN → SegmentFault → Huaban → example.com repeatedly. This run issued 200 `Page.navigate` commands per binary.  Common ancestor `7909cff7b6` → HEAD `b75de5c66f`; benchmark order: `base-first`; workflow: `success`.  ### Session resilience  | Metric | Base | HEAD | | --- | ---: | ---: | | Attempted / planned | 200 / 200 | 200 / 200 | | Direct observable pass | 199 / 200 | 199 / 200 | | Failures / recovered | 1 / 1 | 1 / 1 | | Recovery failures | 0 | 0 | | Lifecycle order violations | 0 | 0 | | Network order violations | 0 | 0 | | Wall time | 269.9 s | 271.4 s |  A public-page failure is reported separately from an unrecoverable session. The soak requires all navigation attempts, zero failed recovery, zero lifecycle/network ordering violations, and complete resource evidence.  ### 

- **Issue #1192** (2026-10-05): **feat(playground): add native WebMCP demos**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > <!-- moli-spider-bench --> ## Spider Bench A/B  ✅ All benchmark browser service runs completed; results are informational.  **Public HEAD:** 184 / 240 rows; 38 / 48 sites produced rows; 10 unexpected empty sites.  ✅ Deterministic fixture contract is clean.  Common ancestor `0923d2cefad2` → HEAD `b90e27010930`; benchmark order: `base-first`; workflow: `success`.  ### Public 48-site run · informational  | Metric | Base | HEAD | Δ | | --- | ---: | ---: | ---: | | Run status | success | success | — | | Extracted rows / contract | 184 / 240 | 184 / 240 | 0 (0.00%) | | Contract fill | 76.67% | 76.67% | 0.00 pp (0.00%) | | Sites with rows | 38 / 48 | 38 / 48 | 0 (0.00%) | | Sites meeting row contract | 36 / 48 | 36 / 48 | 0 (0.00%) | | Unexpected empty sites | 10 | 10 | 0 (0.00%) | | Partial-row sites | 2 | 2 | 0 (0.00%) | | Site outcomes | extracted: 36; HTTP error + rows: 2; empty: 7; HTTP error + empty: 1; snapshot error + empty: 2 | extracted: 37; HTTP error + rows: 1; empty: 7; HTTP erro
  > <!-- moli-sequential-navigation-soak --> ## Sequential Navigation Soak A/B  ✅ HEAD completed the 200-navigation resilience and memory observation.  One browser process, one target, and one CDP session navigate CSDN → SegmentFault → Huaban → example.com repeatedly. This run issued 200 `Page.navigate` commands per binary.  Common ancestor `0923d2cefa` → HEAD `41aa4a7c43`; benchmark order: `head-first`; workflow: `success`.  ### Session resilience  | Metric | Base | HEAD | | --- | ---: | ---: | | Attempted / planned | 200 / 200 | 200 / 200 | | Direct observable pass | 199 / 200 | 199 / 200 | | Failures / recovered | 1 / 1 | 1 / 1 | | Recovery failures | 0 | 0 | | Lifecycle order violations | 0 | 0 | | Network order violations | 0 | 0 | | Wall time | 261.5 s | 268.8 s |  A public-page failure is reported separately from an unrecoverable session. The soak requires all navigation attempts, zero failed recovery, zero lifecycle/network ordering violations, and complete resource evidence.  ### 
  > <!-- moli-ci-regression-report --> ## CI Regression Report  [Source CI run](https://github.com/lexmount/moli/actions/runs/37281110473) · source state at render: `in_progress` · artifacts: `6/6`  | Check | Status | Signal | | --- | :---: | --- | | Release regression | ✅ | HEAD/base failures 0/0; raw binary 0.00% | | Frontend differential | ✅ | 1,020/1,020 cases matched; 0 issues | | Agent episodes | ✅ | 8/8 Moli episodes passed; 0 failures | | Runtime/CDP contracts | ✅ | 26 contract cases; 0 failures | | CDP smoke | ✅ | 52/52 groups passed; 616 scenarios | | WebMainBench | ✅ | 545/545 completed; 0 unexpected failures |  <details open><summary><strong>Release regression</strong> — ✅ HEAD/base failures 0/0; raw binary 0.00%</summary>  #### Package and image size  | Metric | Base | HEAD | Delta | Delta % | | --- | ---: | ---: | ---: | ---: | | Raw binary | 147.43 MiB | 147.43 MiB | 0 B | 0.00% | | Stripped binary | 101.30 MiB | 101.30 MiB | 0 B | 0.00% | | gzip binary | 50.52 MiB | 50.52 M

- **Issue #1191** (2026-10-05): **chore(release): update verstion to 1.1.14**
  *Symptoms*: 

- **Issue #1190** (2026-10-05): **fix(forms): validate FormData native argument brands**
  *Symptoms*: Validate FormData form and submitter arguments through native HTML interface brands before resolving handles. Support windowless documents and borrowed constructors, preserve submitter type-before-ownership exception ordering, and read native name/datalist state without author getter interference.  Use the form owner realm for entry extraction and retained formdata dispatch, including windowless forms. Cover native argument brands, borrowed constructors, optional submitter conversion and exception ordering. Adopted-form regressions preserve reflector/event realms alongside callee-realm result objects.  Validation on the final committed tree: - `cargo fmt --all` - `cargo clippy --workspace --all-targets --all-features -- -D warnings` - `cargo nextest run --no-fail-fast` with 32 test threads: 19,486 passed, 16 skipped.  Rebased onto main `7909cff7b65b` and validated again at head `22907219a7b8`.
  **Post-Mortem & Fix Analysis**:
  > <!-- moli-spider-bench --> ## Spider Bench A/B  ✅ All benchmark browser service runs completed; results are informational.  **Public HEAD:** 184 / 240 rows; 38 / 48 sites produced rows; 10 unexpected empty sites.  ✅ Deterministic fixture contract is clean.  Common ancestor `7909cff7b65b` → HEAD `22907219a7b8`; benchmark order: `base-first`; workflow: `success`.  ### Public 48-site run · informational  | Metric | Base | HEAD | Δ | | --- | ---: | ---: | ---: | | Run status | success | success | — | | Extracted rows / contract | 184 / 240 | 184 / 240 | 0 (0.00%) | | Contract fill | 76.67% | 76.67% | 0.00 pp (0.00%) | | Sites with rows | 38 / 48 | 38 / 48 | 0 (0.00%) | | Sites meeting row contract | 36 / 48 | 36 / 48 | 0 (0.00%) | | Unexpected empty sites | 10 | 10 | 0 (0.00%) | | Partial-row sites | 2 | 2 | 0 (0.00%) | | Site outcomes | extracted: 36; HTTP error + rows: 2; empty: 7; HTTP error + empty: 1; snapshot error + empty: 2 | extracted: 37; HTTP error + rows: 1; empty: 8; HTTP erro
  > <!-- moli-sequential-navigation-soak --> ## Sequential Navigation Soak A/B  ✅ HEAD completed the 200-navigation resilience and memory observation.  One browser process, one target, and one CDP session navigate CSDN → SegmentFault → Huaban → example.com repeatedly. This run issued 200 `Page.navigate` commands per binary.  Common ancestor `7909cff7b6` → HEAD `22907219a7`; benchmark order: `base-first`; workflow: `success`.  ### Session resilience  | Metric | Base | HEAD | | --- | ---: | ---: | | Attempted / planned | 200 / 200 | 200 / 200 | | Direct observable pass | 199 / 200 | 199 / 200 | | Failures / recovered | 1 / 1 | 1 / 1 | | Recovery failures | 0 | 0 | | Lifecycle order violations | 0 | 0 | | Network order violations | 0 | 0 | | Wall time | 263.5 s | 260.5 s |  A public-page failure is reported separately from an unrecoverable session. The soak requires all navigation attempts, zero failed recovery, zero lifecycle/network ordering violations, and complete resource evidence.  ### 
  > <!-- moli-ci-regression-report --> ## CI Regression Report  [Source CI run](https://github.com/lexmount/moli/actions/runs/37288957175) · source state at render: `in_progress` · artifacts: `6/6`  | Check | Status | Signal | | --- | :---: | --- | | Release regression | ✅ | HEAD/base failures 0/0; raw binary +0.000088% | | Frontend differential | ✅ | 1,020/1,020 cases matched; 0 issues | | Agent episodes | ✅ | 8/8 Moli episodes passed; 0 failures | | Runtime/CDP contracts | ✅ | 26 contract cases; 0 failures | | CDP smoke | ✅ | 52/52 groups passed; 616 scenarios | | WebMainBench | ✅ | 545/545 completed; 0 unexpected failures |  <details open><summary><strong>Release regression</strong> — ✅ HEAD/base failures 0/0; raw binary +0.000088%</summary>  #### Package and image size  | Metric | Base | HEAD | Delta | Delta % | | --- | ---: | ---: | ---: | ---: | | Raw binary | 147.43 MiB | 147.43 MiB | +136 B | +0.000088% | | Stripped binary | 101.30 MiB | 101.30 MiB | 0 B | 0.00% | | gzip binary | 5

- **Issue #1183** (2026-10-05): **fix(events): validate legacy MouseEvent initializer arguments**
  *Symptoms*: Convert initMouseEvent nullable Window and EventTarget arguments through native brands before any mutation, default missing views to null, and wrap button as the WebIDL short type. Preserve the dispatch-time reinitialization guard and registered native Proxy targets.  Apply the initializer conversion change to main's existing event backing declarations. Include only the Window/EventTarget converters needed for this API, without the separate typed MouseEvent/UIEvent dictionary or readonly-prototype migrations. Cover borrowed receivers, conversion order, atomic failures, short wrapping, and in-dispatch behavior with the original matrix.  Validation on the final committed tree: - `cargo fmt --all` - `cargo clippy --workspace --all-targets --all-features -- -D warnings` - `cargo nextest run --no-fail-fast` with 32 test threads: 19,326 passed, 16 skipped.  One commit based on `d87acfc6d8ef`.
  **Post-Mortem & Fix Analysis**:
  > <!-- moli-sequential-navigation-soak --> ## Sequential Navigation Soak A/B  ✅ HEAD completed the 200-navigation resilience and memory observation.  One browser process, one target, and one CDP session navigate CSDN → SegmentFault → Huaban → example.com repeatedly. This run issued 200 `Page.navigate` commands per binary.  Common ancestor `d87acfc6d8` → HEAD `ca7cc23c1b`; benchmark order: `head-first`; workflow: `success`.  ### Session resilience  | Metric | Base | HEAD | | --- | ---: | ---: | | Attempted / planned | 200 / 200 | 200 / 200 | | Direct observable pass | 199 / 200 | 199 / 200 | | Failures / recovered | 1 / 1 | 1 / 1 | | Recovery failures | 0 | 0 | | Lifecycle order violations | 0 | 0 | | Network order violations | 0 | 0 | | Wall time | 277.5 s | 291.1 s |  A public-page failure is reported separately from an unrecoverable session. The soak requires all navigation attempts, zero failed recovery, zero lifecycle/network ordering violations, and complete resource evidence.  ### 
  > <!-- moli-spider-bench --> ## Spider Bench A/B  ✅ All benchmark browser service runs completed; results are informational.  **Public HEAD:** 184 / 240 rows; 38 / 48 sites produced rows; 10 unexpected empty sites.  ✅ Deterministic fixture contract is clean.  Common ancestor `d87acfc6d8ef` → HEAD `ca7cc23c1b5d`; benchmark order: `head-first`; workflow: `success`.  ### Public 48-site run · informational  | Metric | Base | HEAD | Δ | | --- | ---: | ---: | ---: | | Run status | success | success | — | | Extracted rows / contract | 184 / 240 | 184 / 240 | 0 (0.00%) | | Contract fill | 76.67% | 76.67% | 0.00 pp (0.00%) | | Sites with rows | 38 / 48 | 38 / 48 | 0 (0.00%) | | Sites meeting row contract | 36 / 48 | 36 / 48 | 0 (0.00%) | | Unexpected empty sites | 10 | 10 | 0 (0.00%) | | Partial-row sites | 2 | 2 | 0 (0.00%) | | Site outcomes | extracted: 37; HTTP error + rows: 1; empty: 7; HTTP error + empty: 1; snapshot error + empty: 2 | extracted: 36; HTTP error + rows: 2; empty: 7; HTTP erro
  > <!-- moli-ci-regression-report --> ## CI Regression Report  [Source CI run](https://github.com/lexmount/moli/actions/runs/37245865956) · source state at render: `success` · artifacts: `5/6`  | Check | Status | Signal | | --- | :---: | --- | | Release regression | ✅ | HEAD/base failures 0/0; raw binary +0.003150% | | Frontend differential | ✅ | 1,020/1,020 cases matched; 0 issues | | Agent episodes | ⚪ | artifact unavailable or invalid | | Runtime/CDP contracts | ✅ | 26 contract cases; 0 failures | | CDP smoke | ✅ | 52/52 groups passed; 616 scenarios | | WebMainBench | ✅ | 545/545 completed; 0 unexpected failures |  <details open><summary><strong>Release regression</strong> — ✅ HEAD/base failures 0/0; raw binary +0.003150%</summary>  #### Package and image size  | Metric | Base | HEAD | Delta | Delta % | | --- | ---: | ---: | ---: | ---: | | Raw binary | 147.04 MiB | 147.04 MiB | +4.74 KiB | +0.003150% | | Stripped binary | 100.95 MiB | 100.96 MiB | +4.00 KiB | +0.003869% | | gzip binar

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

### Incident Patch 1: `cd2cbc85` (2026-10-06)
**Commit Message**: fix(renderer): trace response body handles on realm teardown

Pending Response body materializations and stored JavaScript rejection
reasons held strong V8 handles in the native context host. Navigation could
cancel the body fetch while leaving a resolver rooted, retaining the old
Context and its native Document through the shared isolate.

Move these handles into the owning realm's traced graph at teardown. Keep
buffered bytes and error identity available to externally retained Responses,
including pending body methods completed after the realm retires.

Add native host lifetime regressions for pending bodies and stored errors,
and verify retained body readers remain usable until their last V8 reference.

Validation: cargo fmt --all; strict workspace/all-target/all-feature Clippy;
cargo nextest run --no-fail-fast (19,650 passed, 16 skipped); release build.
CI-equivalent fixture contract is clean. At 144 real-site navigations,
post-blank GC leaves 1.76 MiB JS heap and two actual NativeContexts;
benchmark RSS ends at 177 MiB versus 706 MiB before the fixes.

**File**: `moli-renderer-v8/src/native_bridge/identity.rs` (modified, +4/-0)
```diff
@@ -590,6 +590,10 @@ pub(crate) fn clear_context_wrapper_cache_for_teardown(
     }
     crate::context_bootstrap::exposed_interfaces::retain_intrinsic_interfaces_in_realm(scope);
     crate::context_bootstrap::retain_indexed_db_state_in_retired_realm(scope);
+    crate::network_host::retain_pending_network_body_state_in_retired_realm(
+        scope,
+        include_shared_default_world,
+    );
 }
 
 #[derive(Debug, Default)]
```

**File**: `moli-renderer-v8/src/network_host.rs` (modified, +1/-1)
```diff
@@ -63,7 +63,7 @@ pub(crate) use self::body_source::{
     PendingNetworkBodySourceState, close_pending_network_body_stream,
     enqueue_pending_network_body_chunk, error_pending_network_body_stream,
     error_pending_network_body_stream_with_reason, new_network_body_source_id,
-    pending_network_body_stream,
+    pending_network_body_stream, retain_pending_network_body_state_in_retired_realm,
 };
 pub(in crate::network_host) use self::browser_response::http_status_text;
 pub(crate) use self::browser_response::{
```

**File**: `moli-renderer-v8/src/network_host/body_source.rs` (modified, +64/-16)
```diff
@@ -4,7 +4,7 @@ use crate::context_bootstrap::{
 };
 use crate::protocol_types::SubresourceResponseBody;
 use crate::types::NetworkBodySourceId;
-use crate::util::{get_private_value, set_private_value};
+use crate::util::{RealmObjectHandle, RealmValueHandle, get_private_value, set_private_value};
 use crate::web_api_interfaces;
 use crate::worker::get_worker_state;
 use std::collections::{HashMap, HashSet};
@@ -244,7 +244,7 @@ enum PendingBodyMaterializationKind {
 }
 
 pub(crate) struct PendingBodyMaterialization {
-    resolver: v8::Global<v8::PromiseResolver>,
+    resolver: RealmObjectHandle,
     kind: PendingBodyMaterializationKind,
 }
 
@@ -261,10 +261,52 @@ pub(crate) struct PendingNetworkBodySourceState {
     pull_requested: bool,
     closed: bool,
     error: Option<String>,
-    error_reason: Option<v8::Global<v8::Value>>,
+    error_reason: Option<RealmValueHandle>,
     materializations: Vec<PendingBodyMaterialization>,
 }
 
+pub(crate) fn retain_pending_network_body_state_in_retired_realm(
+    scope: &mut v8::PinScope<'_, '_>,
+    include_shared_default_world: bool,
+) {
+    let context = scope.get_current_context();
+    let Some(host) = context_host_mut(scope) else {
+        return;
+    };
+    // Retained Responses keep their buffered bytes and error identity. Their
+    // native body state must not in turn root the retired realm through a
+    // pending body-method resolver or stored JavaScript rejection reason.
+    for state in host.pending_network_body_sources.values_mut() {
+        for materialization in &mut state.materializations {
+            if include_shared_default_world
+                || materialization
+                    .resolver
+                    .to_local(scope)
+                    .and_then(|resolver| resolver.get_creation_context(scope))
+                    == Some(context)
+            {
+                materialization.resolver.retain_in_realm(scope);
+            }
+        }
+        let stream_context = state
+            .stream
+            .to_local(scope)
+            .and_then(|stream| stream.get_creation_context(scope));
+        if (include_shared_default_world || stream_context == Some(context))
+            && let Some(reason) = &mut state.error_reason
+        {
+            // A shared native host can own body state from several realms.
+            // Anchor the reason in the stream's realm, even during main teardown.
+            if let Some(stream_context) = stream_context {
+                let scope = &mut v8::ContextScope::new(scope, stream_context);
+                reason.retain_in_realm(scope);
+            } else {
+                reason.retain_in_realm(scope);
+            }
+        }
+    }
+}
+
 enum PendingBodyRejection {
     Reason(v8::Global<v8::Value>),
     Message(String),
@@ -907,7 +949,7 @@ fn error_pending_network_body_stream_with_clone_ids<'s>(
         }
         state.closed = true;
         state.error = Some(error_text.to_owned());
-        state.error_reason = Some(v8::Global::new(scope, reason));
+        state.error_reason = Some(RealmValueHandle::new(scope, reason));
         if let Some(stream) = state.stream.to_local(scope) {
             error_stream(scope, stream, reason);
         }
@@ -926,7 +968,7 @@ fn error_pending_network_body_stream_with_clone_ids<'s>(
             }
             clone.closed = true;
             clone.error = Some(error_text.to_owned());
-            clone.error_reason = Some(v8::Global::new(scope, reason));
+            clone.error_reason = Some(RealmValueHandle::new(scope, reason));
             if let Some(stream) = clone.stream.to_local(scope) {
                 error_stream(scope, stream, reason);
             }
@@ -1199,10 +1241,10 @@ fn clone_pending_network_body_source_in_maps(
         let snapshot = original.bytes.clone();
         outcome.close_now = original.closed;
         outcome.error_now = original.error.clone();
-        outcome.error_reason_now = original
-            .error_reason
-            .as_ref()
-            .map(|reason| v8::Global::new(scope, v8::Local::new(scope, reason)));
+        outcome.error_reason_now = original.error_reason.as_ref().map(|reason| {
+            let reason = reason.to_local(scope);
+            v8::Global::new(scope, reason)
+        });
         if let Some(clone) = sources.get_mut(&clone_id) {
             append_pending_body_state_bytes(scope, clone, &snapshot);
         }
@@ -1513,10 +1555,8 @@ fn inspect_pending_body_source_for_materialization<'s>(
                     .error_reason
                     .as_ref()
                     .map(|reason| {
-                        PendingBodyRejection::Reason(v8::Global::new(
-                            scope,
-                            v8::Local::new(scope, reason),
-                        ))
+                        let reason = reason.to_local(scope);
+                        PendingBodyRejection::Reason(v8::Global::new(scope, reason))
                     })
         
```

**File**: `moli-renderer-v8/src/script_vm/tests/extracted/realms_and_teardown.rs` (modified, +218/-0)
```diff
@@ -1,5 +1,223 @@
 use super::*;
 
+fn new_vm_with_pending_response_for_teardown_test()
+-> (StandaloneScriptVmHarness, crate::types::NetworkBodySourceId) {
+    let mut vm = new_storage_test_vm("https://body-teardown.test/");
+    let body_source_id = crate::network_host::new_network_body_source_id();
+    let document_url = vm.document_runtime.document_url().clone();
+    vm.with_default_context_scope_and_checkpoint_for_test(|scope, _| {
+        let response =
+            crate::network_host::build_fetch_response_object_from_stream_for_request_mode(
+                scope,
+                &document_url,
+                moli_fetch::RequestMode::Cors,
+                moli_fetch::ResponseHead {
+                    final_url: document_url.join("data.json").unwrap(),
+                    status: 200,
+                    headers: vec![("content-type".to_owned(), b"application/json".to_vec())],
+                    request_cookie_report: None,
+                    cookie_set_reports: Vec::new(),
+                    redirected: false,
+                    redirect_chain: Vec::new(),
+                    from_cache: false,
+                    negotiated_http_version: None,
+                },
+                body_source_id,
+            );
+        let global = scope.get_current_context().global(scope);
+        let _ = global.set(
+            scope,
+            crate::util::v8str(scope, "response").into(),
+            response.into(),
+        );
+        Ok(())
+    })
+    .expect("pending Response should be installed");
+    (vm, body_source_id)
+}
+
+fn error_response_for_teardown_test(
+    vm: &mut StandaloneScriptVmHarness,
+    body_source_id: crate::types::NetworkBodySourceId,
+) {
+    vm.eval("globalThis.bodyFailure = new Error('body failed')")
+        .unwrap();
+    vm.with_default_context_scope_and_checkpoint_for_test(|scope, _| {
+        let global = scope.get_current_context().global(scope);
+        let reason = global
+            .get(scope, crate::util::v8str(scope, "bodyFailure").into())
+            .unwrap();
+        crate::network_host::error_pending_network_body_stream_with_reason(
+            scope,
+            body_source_id,
+            "body failed".to_owned(),
+            reason,
+        );
+        Ok(())
+    })
+    .expect("pending Response should retain its rejection reason");
+}
+
+#[test]
+fn pending_response_body_releases_native_host_on_context_teardown() {
+    let (mut vm, _) = new_vm_with_pending_response_for_teardown_test();
+    vm.eval("globalThis.bodyPromise = response.json(); 1")
+        .expect("body materialization should wait for network completion");
+    let weak_host = vm.context_host_weak_for_test();
+    let isolate = vm.renderer_document_isolate.clone();
+    drop(vm);
+    for _ in 0..2 {
+        isolate.with_renderer_document_isolate_mut(|isolate| isolate.low_memory_notification());
+    }
+    assert!(
+        weak_host.upgrade().is_none(),
+        "a pending body resolver must not root its retired native Document"
+    );
+}
+
+#[test]
+fn errored_response_body_releases_native_host_on_context_teardown() {
+    let (mut vm, body_source_id) = new_vm_with_pending_response_for_teardown_test();
+    error_response_for_teardown_test(&mut vm, body_source_id);
+    let weak_host = vm.context_host_weak_for_test();
+    let isolate = vm.renderer_document_isolate.clone();
+    drop(vm);
+    for _ in 0..2 {
+        isolate.with_renderer_document_isolate_mut(|isolate| isolate.low_memory_notification());
+    }
+    assert!(
+        weak_host.upgrade().is_none(),
+        "a stored body error must not root its retired native Document"
+    );
+}
+
+#[test]
+fn retained_response_body_keeps_bytes_until_the_last_v8_reference() {
+    for pending in [false, true] {
+        let (mut vm, body_source_id) = new_vm_with_pending_response_for_teardown_test();
+        vm.with_default_context_scope_and_checkpoint_for_test(|scope, _| {
+            crate::network_host::enqueue_pending_network_body_chunk(
+                scope,
+                body_source_id,
+                br#"{"ok":true}"#.to_vec(),
+            );
+            if !pending {
+                crate::network_host::close_pending_network_body_stream(scope, body_source_id);
+            }
+            Ok(())
+        })
+        .unwrap();
+        vm.eval(if pending {
+            "globalThis.bodyPromise = response.text(); globalThis.readBody = () => bodyPromise"
+        } else {
+            "globalThis.readBody = () => response.text()"
+        })
+        .unwrap();
+        let isolate = vm.renderer_document_isolate.clone();
+        let callback = isolate.with_renderer_document_isolate_mut(|isolate| {
+            let scope = std::pin::pin!(v8::HandleScope::new(isolate));
+            let scope = &mut scope.init();
+            let context = v8::Local::new(scope, &vm.page_default_context);
+            let scope = &mut v8::ContextScope::new(scope, context);
+            let value
```

---

### Incident Patch 2: `d954a1a5` (2026-10-06)
**Commit Message**: test(renderer): gate the initial replacement reservation poll

The owner thread can finish reservation and prepare during the first poll,
making the cancellation test's initial Pending assertion timing dependent.
Gate reservation dispatch before polling, then release it before the existing
barrier and prepare gate. This reliably exercises cancellation of an in-flight
prepare while retaining the scope-release and isolate-reservation assertions.

Validation: cargo fmt --all; strict workspace/all-target/all-feature Clippy;
cargo nextest run --no-fail-fast (19,650 passed, 16 skipped); release build.
The exact cancellation test also passed 25 concurrent stress executions.

**File**: `moli-renderer-v8/src/runtime/document_replacement/tests.rs` (modified, +8/-0)
```diff
@@ -279,8 +279,16 @@ async fn dropping_inflight_prepare_retires_queued_document_and_scope() {
     let runtime = crate::JsRuntime::initialize();
     let mut page = live_page_for_replacement_target_test(&runtime).await;
     let pause = RendererInspectorPauseBridge::default();
+    // The owner can finish both commands during the first poll. Hold reservation
+    // dispatch so this test reaches the in-flight state before allowing progress.
+    let (reservation_entered, reservation_release) =
+        runtime.install_owner_command_dispatch_gate_for_testing();
     let mut pending = Box::pin(prepare(&runtime, replacement_target(&page, &pause)));
     assert!(futures_util::poll!(&mut pending).is_pending());
+    reservation_entered
+        .recv_timeout(std::time::Duration::from_secs(30))
+        .unwrap();
+    reservation_release.send(()).unwrap();
     // Finish reservation first, then hold the actual prepare command. The
     // reservation-cancellation test below covers cancellation before this point.
     owner_barrier(&runtime).await;
```

---

### Incident Patch 3: `d3b6633c` (2026-10-06)
**Commit Message**: fix(renderer): release module owners on context teardown

Document teardown used the document.open reset, which preserves compiled
module records and pending dynamic imports. Their strong V8 handles rooted
retired Contexts and native Documents across shared-isolate navigations.

Release module records, pending imports, graph fetches and owner events on
context teardown. Preserve import-map metadata so externally retained module
functions can still access native DOM values and import.meta.resolve aliases.
Leave document.open module-map semantics unchanged.

Add regressions for compiled modules, pending dynamic imports, and exported
functions retained across teardown. All three collection regressions fail
before the fix; retained functions remain usable until their last V8 reference
is released.

Validation: cargo fmt --all; cargo clippy --workspace --all-targets
--all-features -- -D warnings; cargo nextest run --no-fail-fast
(19,646 passed, 16 skipped). The initial run hit a 250ms CLI timeout
stage assertion; a full run with unchanged sources passed.

Release build with default Cargo parallelism. The CI real-site spider's
48-site peak RSS drops from 485.5 to 281.1 MiB, and last aliv

**File**: `moli-renderer-v8/src/document_runtime/lifecycle.rs` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ impl DocumentRuntime {
     pub(crate) fn retire_v8_execution_state_for_context_teardown(&mut self) {
         self.timeouts = HostTimeoutScheduler::default();
         self.events = HostEventTargetRegistry::default();
-        self.script_lifecycle.clear_for_document_replacement();
+        self.script_lifecycle.clear_for_context_teardown();
         self.root_document_parser = None;
         self.document_write_script_preload_scanner = None;
         self.document_write_script_preloads.clear();
```

**File**: `moli-renderer-v8/src/document_runtime/script_lifecycle.rs` (modified, +8/-0)
```diff
@@ -114,6 +114,14 @@ impl DocumentScriptLifecycle {
         self.pending_main_parser_deferred_starts.clear();
     }
 
+    pub(crate) fn clear_for_context_teardown(&mut self) {
+        self.clear_for_document_replacement();
+        // document.open() preserves the current ScriptState's module map and
+        // dynamic imports. Context teardown must release those strong V8
+        // handles before its native Document is retained by the retired realm.
+        self.scripts.clear_module_owner_for_context_teardown();
+    }
+
     pub(crate) fn scripts(&self) -> &HostScriptScheduler {
         &self.scripts
     }
```

**File**: `moli-renderer-v8/src/host/scripts.rs` (modified, +4/-0)
```diff
@@ -316,6 +316,10 @@ impl HostScriptScheduler {
         &self.module_owner
     }
 
+    pub(crate) fn clear_module_owner_for_context_teardown(&mut self) {
+        self.module_owner.clear_for_context_teardown();
+    }
+
     fn default_page_task_execution_kind_for_source(
         source: ScriptHandleSource,
     ) -> ScriptPageTaskExecutionKind {
```

**File**: `moli-renderer-v8/src/module_runtime.rs` (modified, +8/-0)
```diff
@@ -357,6 +357,14 @@ pub(crate) struct ModuleOwnerState {
 }
 
 impl ModuleOwnerState {
+    pub(crate) fn clear_for_context_teardown(&mut self) {
+        // Retained import.meta.resolve functions still use the import map, but
+        // compiled records and pending imports must not root the retired realm.
+        self.document_modulator = NativeDocumentModulator::default();
+        self.graph_fetches.clear();
+        self.owner_event_tasks = DocumentPostedTaskSource::default();
+    }
+
     pub(crate) fn clear_for_document_replacement(&mut self) {
         // Import maps, module-map entries, compiled records, ID allocation and
         // dynamic-import resolver state belong to the live ScriptState. Only
```

**File**: `moli-renderer-v8/src/script_vm/tests/extracted/realms_and_teardown.rs` (modified, +121/-0)
```diff
@@ -1,5 +1,126 @@
 use super::*;
 
+fn new_vm_with_evaluated_module_for_teardown_test() -> StandaloneScriptVmHarness {
+    let mut vm = new_storage_test_vm("https://module-teardown.test/");
+    let url = vm.document_runtime.document_url().clone();
+    vm.document_runtime
+        .register_import_map_source(
+            r#"{"imports":{"retained":"https://module-teardown.test/retained.mjs"}}"#,
+        )
+        .expect("module import map should register");
+    let source = crate::module_runtime::ModuleSource::text(
+        "export const node = document.createElement('p');\n\
+         node.textContent = 'module';\n\
+         export function readNative() { return node.textContent + ':' + import.meta.resolve('retained'); }\n\
+         globalThis.readNative = readNative;"
+            .to_owned(),
+    );
+    let mut job = crate::module_runtime::runtime_owned_loaded_module_script_graph_job(
+        &mut vm,
+        source,
+        &url,
+        &url,
+        &crate::planning::ScriptFetchMetadata::default(),
+        false,
+    )
+    .expect("module graph should be accepted");
+    let crate::module_runtime::NativeModuleGraphJobAdvance::Complete(graph) = job
+        .advance_module_script_owner_lane(&mut vm)
+        .expect("import-free module graph should complete")
+    else {
+        panic!("an import-free module must not fetch");
+    };
+    vm.instantiate_native_module_graph(&graph)
+        .expect("module graph should instantiate");
+    vm.evaluate_native_module_graph(graph.root_entry)
+        .expect("module graph should evaluate");
+    assert_eq!(
+        vm.eval("readNative()").unwrap(),
+        "module:https://module-teardown.test/retained.mjs"
+    );
+    vm
+}
+
+#[test]
+fn compiled_module_releases_native_host_on_context_teardown() {
+    let vm = new_vm_with_evaluated_module_for_teardown_test();
+    let weak_host = vm.context_host_weak_for_test();
+    let isolate = vm.renderer_document_isolate.clone();
+    drop(vm);
+    for _ in 0..2 {
+        isolate.with_renderer_document_isolate_mut(|isolate| isolate.low_memory_notification());
+    }
+    assert!(
+        weak_host.upgrade().is_none(),
+        "compiled module records must not root their retired native Document"
+    );
+}
+
+#[test]
+fn pending_dynamic_import_releases_native_host_on_context_teardown() {
+    let mut vm = new_storage_test_vm("https://pending-module-teardown.test/");
+    vm.eval("void import('./never-ready.mjs')")
+        .expect("dynamic import should queue");
+    assert!(vm.document_runtime.has_ready_native_dynamic_module_import());
+    let weak_host = vm.context_host_weak_for_test();
+    let isolate = vm.renderer_document_isolate.clone();
+    drop(vm);
+    for _ in 0..2 {
+        isolate.with_renderer_document_isolate_mut(|isolate| isolate.low_memory_notification());
+    }
+    assert!(
+        weak_host.upgrade().is_none(),
+        "a pending dynamic import must not root its retired native Document"
+    );
+}
+
+#[test]
+fn retained_module_function_keeps_native_values_until_the_last_v8_reference() {
+    let vm = new_vm_with_evaluated_module_for_teardown_test();
+    let isolate = vm.renderer_document_isolate.clone();
+    let callback = isolate.with_renderer_document_isolate_mut(|isolate| {
+        let scope = std::pin::pin!(v8::HandleScope::new(isolate));
+        let scope = &mut scope.init();
+        let context = v8::Local::new(scope, &vm.page_default_context);
+        let scope = &mut v8::ContextScope::new(scope, context);
+        let value = context
+            .global(scope)
+            .get(scope, crate::util::v8str(scope, "readNative").into())
+            .unwrap();
+        let function = v8::Local::<v8::Function>::try_from(value).unwrap();
+        v8::Global::new(scope, function)
+    });
+    let weak_host = vm.context_host_weak_for_test();
+    drop(vm);
+    for _ in 0..2 {
+        isolate.with_renderer_document_isolate_mut(|isolate| isolate.low_memory_notification());
+    }
+    assert!(weak_host.upgrade().is_some());
+    let value = isolate.with_renderer_document_isolate_mut(|isolate| {
+        let scope = std::pin::pin!(v8::HandleScope::new(isolate));
+        let scope = &mut scope.init();
+        let caller_context = v8::Context::new(scope, Default::default());
+        let scope = &mut v8::ContextScope::new(scope, caller_context);
+        let function = v8::Local::new(scope, &callback);
+        let context = function.get_creation_context(scope).unwrap();
+        let scope = &mut v8::ContextScope::new(scope, context);
+        let receiver = v8::undefined(scope).into();
+        crate::script_execution::call_function(scope, function, receiver, &[])
+            .expect("retained module function should read its native DOM value")
+            .to_rust_string_lossy(scope)
+    });
+    assert_eq!(value, "module:https://module-teardown.test/retained.mjs");
+    isolate.with_renderer_document_isolate_mut(|isolate| {
+        drop(callback);
+   
```

---

### Incident Patch 4: `31d40b20` (2026-10-06)
**Commit Message**: fix(renderer): retire unpromoted child realm handles

Include prebootstrapped child contexts in document teardown and clear
superseded prebootstrap contexts before retiring their execution bindings.
These contexts can be exposed through contentWindow before promotion and
otherwise keep their native Document alive through intrinsic Global handles.

Cover collection after teardown and native DOM access while JavaScript still
retains the child realm. The collection regression fails without the fix.

Validation: cargo fmt --all; cargo clippy --workspace --all-targets
--all-features -- -D warnings; cargo nextest run --no-fail-fast
(19,643 passed, 16 skipped); release spider benchmark and heap snapshots.

**File**: `moli-renderer-v8/src/native_bridge/context_host/child_frame_runtime/isolated_world.rs` (modified, +5/-1)
```diff
@@ -139,12 +139,16 @@ impl JsContextHost {
         }
         let stale = pending_contexts.borrow_mut().remove(&handle);
         if let Some(stale) = stale {
+            let stale_context = v8::Local::new(scope, &stale.context);
+            {
+                let stale_scope = &mut v8::ContextScope::new(scope, stale_context);
+                crate::native_bridge::clear_context_wrapper_cache_for_teardown(stale_scope, false);
+            }
             self.pending_history_traversal_admissions
                 .retire_owner(WindowExecutionContextOwner::Frame(stale.local_window_id));
             self.retire_window_execution_contexts_for_context_token(
                 stale.runtime_observable_context_token,
             );
-            let stale_context = v8::Local::new(scope, &stale.context);
             if self.child_window_proxy_frame_is_current(handle, &stale.frame_id) {
                 stale_context.detach_global();
             }
```

**File**: `moli-renderer-v8/src/script_vm.rs` (modified, +14/-1)
```diff
@@ -2678,8 +2678,16 @@ impl ScriptVm {
     }
 
     fn clear_context_wrapper_caches_for_context_teardown(&mut self) {
+        // A contentWindow can be exposed before its owner turn promotes the
+        // realm into child_frame_realm_store. Retire these contexts too: their
+        // intrinsic Global handles otherwise keep the Context and native host
+        // alive after the Document is replaced.
+        let prebootstrapped_contexts =
+            std::mem::take(&mut *self.prebootstrapped_child_default_contexts.borrow_mut());
         let mut context_ptrs: Vec<*const v8::Global<v8::Context>> = Vec::with_capacity(
-            1 + self.page_isolated_world_contexts.len() + self.child_frame_realm_store.len(),
+            1 + self.page_isolated_world_contexts.len()
+                + self.child_frame_realm_store.len()
+                + prebootstrapped_contexts.len(),
         );
         context_ptrs.push(&self.page_default_context as *const _);
         context_ptrs.extend(
@@ -2692,6 +2700,11 @@ impl ScriptVm {
                 .values()
                 .map(|world| &world.context as *const _),
         );
+        context_ptrs.extend(
+            prebootstrapped_contexts
+                .values()
+                .map(|world| &world.context as *const _),
+        );
 
         for (index, context_ptr) in context_ptrs.into_iter().enumerate() {
             self.clear_context_wrapper_cache_for_context_ptr(context_ptr, index == 0);
```

**File**: `moli-renderer-v8/src/script_vm/tests/extracted/realms_and_teardown.rs` (modified, +84/-0)
```diff
@@ -1,5 +1,89 @@
 use super::*;
 
+#[test]
+fn unpromoted_child_realm_releases_native_host_on_document_teardown() {
+    let vm = new_vm_with_unpromoted_child_realm_for_teardown_test();
+    let weak_host = vm.context_host_weak_for_test();
+    let isolate = vm.renderer_document_isolate.clone();
+    drop(vm);
+    for _ in 0..2 {
+        isolate.with_renderer_document_isolate_mut(|isolate| isolate.low_memory_notification());
+    }
+    assert!(
+        weak_host.upgrade().is_none(),
+        "an iframe awaiting realm promotion must not root its retired native Document"
+    );
+}
+
+fn new_vm_with_unpromoted_child_realm_for_teardown_test() -> StandaloneScriptVmHarness {
+    let mut vm = new_storage_test_vm("https://unpromoted-child-teardown.test/");
+    vm.eval(
+        r#"
+        const root = document.documentElement || document.appendChild(document.createElement('html'));
+        const body = document.body || root.appendChild(document.createElement('body'));
+        const frame = document.createElement('iframe');
+        body.appendChild(frame);
+        typeof frame.contentWindow.Function
+        "#,
+    )
+    .expect("exposing an iframe should prebootstrap its realm");
+    assert_eq!(vm.prebootstrapped_child_default_contexts.borrow().len(), 1);
+    assert_eq!(vm.child_frame_realm_store.len(), 0);
+    vm
+}
+
+#[test]
+fn retained_unpromoted_child_realm_keeps_native_values_until_the_last_v8_reference() {
+    let mut vm = new_vm_with_unpromoted_child_realm_for_teardown_test();
+    vm.eval(
+        r#"
+        frame.contentWindow.Function(`
+            globalThis.savedNode = document.createElement('p');
+            savedNode.textContent = 'child';
+            (document.body || document.documentElement || document).appendChild(savedNode);
+        `)()
+        "#,
+    )
+    .expect("an unpromoted child realm should expose native DOM values");
+    let weak_host = vm.context_host_weak_for_test();
+    let isolate = vm.renderer_document_isolate.clone();
+    let context = vm
+        .prebootstrapped_child_default_contexts
+        .borrow()
+        .values()
+        .next()
+        .unwrap()
+        .context
+        .clone();
+    drop(vm);
+    for _ in 0..2 {
+        isolate.with_renderer_document_isolate_mut(|isolate| isolate.low_memory_notification());
+    }
+    assert!(weak_host.upgrade().is_some());
+    let value = isolate.with_renderer_document_isolate_mut(|isolate| {
+        let scope = std::pin::pin!(v8::HandleScope::new(isolate));
+        let scope = &mut scope.init();
+        let context = v8::Local::new(scope, &context);
+        let scope = &mut v8::ContextScope::new(scope, context);
+        let source = crate::util::v8str(scope, "savedNode.textContent = 'retained-child'");
+        let script =
+            v8::Script::compile(scope, source, None).expect("retained child realm compiles");
+        crate::script_execution::execute_compiled_script(scope, script)
+            .expect("retained child native values remain usable")
+            .to_rust_string_lossy(scope)
+    });
+    assert_eq!(value, "retained-child");
+    isolate.with_renderer_document_isolate_mut(|isolate| {
+        drop(context);
+        isolate.low_memory_notification();
+    });
+    isolate.with_renderer_document_isolate_mut(|isolate| isolate.low_memory_notification());
+    assert!(
+        weak_host.upgrade().is_none(),
+        "the last child realm reference must release its retired native Document"
+    );
+}
+
 fn capture_initial_environment_for_gc_test(
     vm: &StandaloneScriptVmHarness,
 ) -> crate::script_vm::ScriptVmCapturedDocumentEnvironment {
```

---

### Incident Patch 5: `e6b86566` (2026-10-04)
**Commit Message**: fix(layout): resolve float inline bidi placeholders as neutral

**File**: `moli-layout/src/inline.rs` (modified, +5/-5)
```diff
@@ -116,14 +116,14 @@ impl InlineObjectRole {
     fn parley_bidi(self) -> InlineBoxBidi {
         match self {
             Self::Atomic => InlineBoxBidi::Neutral,
-            // Static-position placeholders resolve their own neutral U+FFFC
-            // in bidi analysis only. An enclosing inline edge's level may
-            // otherwise carry them across the following directional run.
-            Self::OutOfFlow => InlineBoxBidi::Neutral,
+            // Floating and static-position placeholders resolve a neutral
+            // U+FFFC in bidi analysis only. An enclosing inline edge's level
+            // may otherwise carry them across the following directional run.
+            Self::Float | Self::OutOfFlow => InlineBoxBidi::Neutral,
             // CSS tag boundaries do not add bidi characters. Leading edges
             // follow the next participant, closing edges the preceding one.
             Self::StartEdge => InlineBoxBidi::InheritNext,
-            Self::EndEdge | Self::Float => InlineBoxBidi::InheritPrevious,
+            Self::EndEdge => InlineBoxBidi::InheritPrevious,
         }
     }
 }
```

**File**: `moli-renderer-v8/src/script_vm/tests/dom_elements/dom_surface/extracted/inline_layout.rs` (modified, +92/-0)
```diff
@@ -144,6 +144,98 @@ fn out_of_flow_inline_placeholders_resolve_neutral_bidi_positions() {
     }
 }
 
+// Float slots and wrapper edges verified in Chromium 145.0.7632.116.
+#[test]
+fn float_inline_placeholders_resolve_neutral_bidi_positions() {
+    for doctype in [
+        "",
+        r#"<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">"#,
+        "<!doctype html>",
+    ] {
+        for (direction, prefix, suffix) in [("ltr", "a", "אבb"), ("rtl", "א", "abב")] {
+            for (decoration, left, right) in [
+                ("", 0.0, 0.0),
+                ("padding-left:20px", 20.0, 0.0),
+                ("padding-right:13px", 0.0, 13.0),
+                ("padding-left:20px;padding-right:13px", 20.0, 13.0),
+                ("border-left:7px solid;border-right:3px solid", 7.0, 3.0),
+            ] {
+                for nested in [false, true] {
+                    for float in ["left", "right"] {
+                        let placeholder = if nested {
+                            "<em><i id=inner></i></em>"
+                        } else {
+                            "<i id=inner></i>"
+                        };
+                        let markup = format!(
+                            r#"{doctype}<meta charset=utf-8><style>html{{direction:{direction}}}body{{margin:0}}#line{{direction:{direction};font:20px/30px monospace;width:300px}}#inner{{float:{float};width:5px;height:5px}}</style><div id=line>{prefix}<span id=w style="{decoration}">{placeholder}</span>{suffix}</div>"#
+                        );
+                        let mut vm = new_parsed_test_vm("https://float-inline-bidi.test/", &markup);
+                        let query = r#"JSON.stringify((()=>{
+                            const line=document.getElementById('line'),range=document.createRange();
+                            const block=line.getBoundingClientRect();
+                            range.selectNodeContents(line.firstChild);
+                            const prefix=range.getBoundingClientRect();
+                            range.selectNodeContents(line.lastChild);
+                            const suffix=range.getBoundingClientRect();
+                            const box=document.getElementById('w').getBoundingClientRect();
+                            const inner=document.getElementById('inner').getBoundingClientRect();
+                            return [block.left,block.right,prefix.left,prefix.right,
+                                suffix.left,suffix.right,box.left,box.right,inner.left,inner.right,
+                                inner.width,inner.height,block.height,line.textContent.length];
+                        })())"#;
+                        let first = vm.eval(query).unwrap();
+                        let geometry = serde_json::from_str::<[f64; 14]>(&first).unwrap();
+                        let (box_left, box_right, suffix_edge) = if direction == "ltr" {
+                            (geometry[3], geometry[3] + left + right, geometry[4])
+                        } else {
+                            (geometry[2] - left - right, geometry[2], geometry[5])
+                        };
+                        let float_edge = if float == "left" {
+                            (geometry[8], geometry[0])
+                        } else {
+                            (geometry[9], geometry[1])
+                        };
+                        let case = format!(
+                            "{doctype}/{direction}/{decoration}/nested={nested}/float={float}"
+                        );
+                        for (actual, expected) in [
+                            (geometry[6], box_left),
+                            (geometry[7], box_right),
+                            (
+                                suffix_edge,
+                                if direction == "ltr" {
+                                    box_right
+                                } else {
+                                    box_left
+                                },
+                            ),
+                            float_edge,
+                            (geometry[10], 5.0),
+                            (geometry[11], 5.0),
+                            (geometry[12], 30.0),
+                            (geometry[13], 4.0),
+                        ] {
+                            assert!(
+                                (actual - expected).abs() < 0.02,
+                                "{case}: {first}, expected {expected}, got {actual}"
+                            );
+                        }
+                        assert_eq!(
+                            vm.eval("document.getElementById('line').textContent")
+                                .unwrap(),
+                            format!("{prefix}{suffix}"),
+                            "text: {case}"
+                        );
+                        publish_layout_for_test(&mut vm);
+             
```

---

### Incident Patch 6: `f8de7714` (2026-10-04)
**Commit Message**: fix(layout): resolve out-of-flow inline bidi placeholders as neutral

**File**: `moli-layout/src/inline.rs` (modified, +5/-1)
```diff
@@ -116,10 +116,14 @@ impl InlineObjectRole {
     fn parley_bidi(self) -> InlineBoxBidi {
         match self {
             Self::Atomic => InlineBoxBidi::Neutral,
+            // Static-position placeholders resolve their own neutral U+FFFC
+            // in bidi analysis only. An enclosing inline edge's level may
+            // otherwise carry them across the following directional run.
+            Self::OutOfFlow => InlineBoxBidi::Neutral,
             // CSS tag boundaries do not add bidi characters. Leading edges
             // follow the next participant, closing edges the preceding one.
             Self::StartEdge => InlineBoxBidi::InheritNext,
-            Self::EndEdge | Self::Float | Self::OutOfFlow => InlineBoxBidi::InheritPrevious,
+            Self::EndEdge | Self::Float => InlineBoxBidi::InheritPrevious,
         }
     }
 }
```

**File**: `moli-renderer-v8/src/script_vm/tests/dom_elements/dom_surface/extracted/inline_layout.rs` (modified, +95/-0)
```diff
@@ -49,6 +49,101 @@ fn inline_decorations_follow_visual_edges_of_natural_bidi_text() {
     }
 }
 
+// Static positions and empty wrapper bounds verified in Chromium 145.0.7632.116.
+#[test]
+fn out_of_flow_inline_placeholders_resolve_neutral_bidi_positions() {
+    for doctype in [
+        "",
+        r#"<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">"#,
+        "<!doctype html>",
+    ] {
+        for (direction, prefix, suffix) in [("ltr", "a", "אבb"), ("rtl", "א", "abב")] {
+            for (left, right) in [(0.0, 0.0), (20.0, 0.0), (0.0, 13.0), (20.0, 13.0)] {
+                for nested in [false, true] {
+                    for position in ["absolute", "fixed"] {
+                        let placeholder = if nested {
+                            "<em><i id=p></i></em>"
+                        } else {
+                            "<i id=p></i>"
+                        };
+                        let markup = format!(
+                            r#"{doctype}<meta charset=utf-8><style>html{{direction:{direction}}}body{{margin:0}}#line{{direction:{direction};font:20px/30px monospace;width:300px}}#p{{position:{position};width:5px;height:5px}}</style><div id=line>{prefix}<span id=w style="padding-left:{left}px;padding-right:{right}px">{placeholder}</span>{suffix}</div>"#
+                        );
+                        let mut vm =
+                            new_parsed_test_vm("https://out-of-flow-inline-bidi.test/", &markup);
+                        let query = r#"JSON.stringify((()=>{
+                            const line=document.getElementById('line'),range=document.createRange();
+                            range.selectNodeContents(line.firstChild);
+                            const prefix=range.getBoundingClientRect();
+                            range.selectNodeContents(line.lastChild);
+                            const suffix=range.getBoundingClientRect();
+                            const p=document.getElementById('p').getBoundingClientRect();
+                            const box=document.getElementById('w').getBoundingClientRect();
+                            return [p.left,p.right,p.width,p.height,prefix.left,prefix.right,
+                                suffix.left,suffix.right,box.left,box.right,
+                                line.getBoundingClientRect().height,line.textContent.length];
+                        })())"#;
+                        let first = vm.eval(query).unwrap();
+                        let geometry = serde_json::from_str::<[f64; 12]>(&first).unwrap();
+                        let (
+                            position_index,
+                            expected_position,
+                            suffix_index,
+                            expected_suffix,
+                            box_left,
+                            box_right,
+                        ) = if direction == "ltr" {
+                            (
+                                0,
+                                geometry[5] + left,
+                                6,
+                                geometry[5] + left + right,
+                                geometry[5],
+                                geometry[5] + left + right,
+                            )
+                        } else {
+                            (
+                                1,
+                                geometry[4] - right,
+                                7,
+                                geometry[4] - left - right,
+                                geometry[4] - left - right,
+                                geometry[4],
+                            )
+                        };
+                        let case = format!(
+                            "{doctype}/{direction}/left={left}/right={right}/nested={nested}/{position}"
+                        );
+                        for (actual, expected) in [
+                            (geometry[position_index], expected_position),
+                            (geometry[suffix_index], expected_suffix),
+                            (geometry[2], 5.0),
+                            (geometry[3], 5.0),
+                            (geometry[8], box_left),
+                            (geometry[9], box_right),
+                            (geometry[10], 30.0),
+                            (geometry[11], 4.0),
+                        ] {
+                            assert!(
+                                (actual - expected).abs() < 0.02,
+                                "{case}: {first}, expected {expected}, got {actual}"
+                            );
+                        }
+                        assert_eq!(
+                            vm.eval("document.getElementById('line').textContent")
+                                .unwrap(),
+                            format!("{prefix}{suffix}"),
+                            "text: {case}"
+                        );
+     
```

---

### Incident Patch 7: `7fe5c091` (2026-10-03)
**Commit Message**: fix(layout): place inline decorations at physical bidi edges

Position transparent opening and closing edges around their visual descendants
after bidi reordering and before alignment. Keep the logical edge widths used
by line breaking while honoring CSS direction for physical padding and borders.

Move the inline-object bidi patch onto current upstream Parley main and pin
the fork at 8eb00ef5e628b1bba95dcde88658deb2a5aed1b5. Adapt the new font,
metrics, whitespace and layout APIs while preserving neutral atomic analysis.
Preserve the browser's synthetic-bold policy through Fontique's host threshold.

Use structural style ancestry for inline text masks so physical edge ordering
cannot change which glyphs belong to a background-clip:text target.

Add 96 Chromium-verified decoration cases covering natural RTL and mixed text,
CSS directions, asymmetric padding and borders, and layout publication. Add a
Chromium-verified paint test for ordinary and nested LTR/RTL text masks.

**File**: `Cargo.lock` (modified, +52/-49)
```diff
@@ -1394,8 +1394,8 @@ dependencies = [
 
 [[package]]
 name = "fontique"
-version = "0.11.1"
-source = "git+https://github.com/lexmount/parley?rev=43ab1b7470f0e71ff8cd397a58974c658eb33652#43ab1b7470f0e71ff8cd397a58974c658eb33652"
+version = "0.11.0"
+source = "git+https://github.com/lexmount/parley?rev=8eb00ef5e628b1bba95dcde88658deb2a5aed1b5#8eb00ef5e628b1bba95dcde88658deb2a5aed1b5"
 dependencies = [
  "hashbrown 0.17.1",
  "linebender_resource_handle",
@@ -1850,32 +1850,18 @@ checksum = "dc00caaa3fb3201ff7a18aa458e8c3ab042b9da154cfdf948bdde3936c31c36e"
 
 [[package]]
 name = "icu_collections"
-version = "2.1.1"
+version = "2.3.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "4c6b649701667bbe825c3b7e6388cb521c23d88644678e83c0c4d0a621a34b43"
+checksum = "fa68d21081c4a05d5a901a1c62add574c77048b6a1c67be3b50ce0b60d4ca513"
 dependencies = [
  "displaydoc",
  "potential_utf",
+ "utf8_iter",
  "yoke",
  "zerofrom",
  "zerovec",
 ]
 
-[[package]]
-name = "icu_locale"
-version = "2.1.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "532b11722e350ab6bf916ba6eb0efe3ee54b932666afec989465f9243fe6dd60"
-dependencies = [
- "icu_collections",
- "icu_locale_core",
- "icu_locale_data",
- "icu_provider",
- "potential_utf",
- "tinystr",
- "zerovec",
-]
-
 [[package]]
 name = "icu_locale_core"
 version = "2.3.0"
@@ -1890,12 +1876,6 @@ dependencies = [
  "zerovec",
 ]
 
-[[package]]
-name = "icu_locale_data"
-version = "2.1.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1c5f1d16b4c3a2642d3a719f18f6b06070ab0aef246a6418130c955ae08aa831"
-
 [[package]]
 name = "icu_locale_fallback"
 version = "2.3.0"
@@ -1918,9 +1898,9 @@ checksum = "decf2a22ec8fa68f1a0c1129a3f8583f8f8bc24e8b9ccbe98ead99f62a4dc3a8"
 
 [[package]]
 name = "icu_normalizer"
-version = "2.1.1"
+version = "2.3.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5f6c8828b67bf8908d82127b2054ea1b4427ff0230ee9141c54251934ab1b599"
+checksum = "12f9cf5f235641ed274641dd81c3f28d870e276763d0797aeeab72317b1c646f"
 dependencies = [
  "icu_collections",
  "icu_normalizer_data",
@@ -1932,16 +1912,17 @@ dependencies = [
 
 [[package]]
 name = "icu_normalizer_data"
-version = "2.1.1"
+version = "2.3.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7aedcccd01fc5fe81e6b489c15b247b8b0690feb23304303a9e560f37efc560a"
+checksum = "1563da1ed3e0b3bf3d74c9b85917ac9c56464d2f57242270c09c9e752f8021a0"
 
 [[package]]
 name = "icu_properties"
-version = "2.1.2"
+version = "2.3.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "020bfc02fe870ec3a66d93e677ccca0562506e5872c650f893269e08615d74ec"
+checksum = "7e7ca276ad3145661a65914e6daf131ca5120cd3dcee8f8f3214b8875184a148"
 dependencies = [
+ "displaydoc",
  "icu_collections",
  "icu_locale_core",
  "icu_properties_data",
@@ -1952,9 +1933,9 @@ dependencies = [
 
 [[package]]
 name = "icu_properties_data"
-version = "2.1.2"
+version = "2.3.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "616c294cf8d725c6afcd8f55abc17c56464ef6211f9ed59cccffe534129c77af"
+checksum = "e590f038c1464a96894fd6d10127e90a8be4509f56ff7ecef851b15cee0b7caa"
 
 [[package]]
 name = "icu_provider"
@@ -1975,25 +1956,26 @@ dependencies = [
 
 [[package]]
 name = "icu_segmenter"
-version = "2.1.2"
+version = "2.3.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a807a7488f3f758629ae86d99d9d30dce24da2fb2945d74c80a4f4a62c71db73"
+checksum = "82d07aafccd67af15d02512a6adf5896fbc5ed00f2e99b471d2efa14016db3db"
 dependencies = [
  "core_maths",
  "icu_collections",
- "icu_locale",
+ "icu_locale_fallback",
  "icu_provider",
  "icu_segmenter_data",
  "potential_utf",
+ "smallvec",
  "utf8_iter",
  "zerovec",
 ]
 
 [[package]]
 name = "icu_segmenter_data"
-version = "2.1.1"
+version = "2.3.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6ebbb7321d9e21d25f5660366cb6c08201d0175898a3a6f7a41ee9685af21c80"
+checksum = "ae293c039020f9ec10710af98d29ce6aa2051486638b49c9a6409f3b4a9e98ad"
 
 [[package]]
 name = "ident_case"
@@ -3993,33 +3975,54 @@ dependencies = [
 [[package]]
 name = "parlance"
 version = "0.1.0"
-source = "git+https://github.com/lexmount/parley?rev=43ab1b7470f0e71ff8cd397a58974c658eb33652#43ab1b7470f0e71ff8cd397a58974c658eb33652"
+source = "git+https://github.com/lexmount/parley?rev=8eb00ef5e628b1bba95dcde88658deb2a5aed1b5#8eb00ef5e628b1bba95dcde88658deb2a5aed1b5"
 
 [[package]]
 name = "parley"
-version = "0.11.1"
-source = "git+https://github.com/lexmount/parley?rev=43ab1b7470f0e71ff8cd397a58974c658eb33652#43ab1b7470f0e71ff8cd397a58974c658eb33652"
+version = "0.11.0"
+source = "git+https://github.com/lexmount/parley?rev=8eb00ef5e628b1bba95dcde88658deb2a5aed1b5#8eb00ef5e628b1bba95dcde88658deb2a5aed1b5"
 dependencies = [
  "fontique",
- "harfrust",
  "hashbrown 0.17.1",
- "icu_normalizer",
- "icu_pr
```

**File**: `Cargo.toml` (modified, +2/-2)
```diff
@@ -98,8 +98,8 @@ exclude = ["vendor/xml5ever-0.39.0"]
 license = "MIT OR Apache-2.0"
 
 [patch.crates-io]
-parley = { git = "https://github.com/lexmount/parley", rev = "43ab1b7470f0e71ff8cd397a58974c658eb33652" }
-fontique = { git = "https://github.com/lexmount/parley", rev = "43ab1b7470f0e71ff8cd397a58974c658eb33652" }
+parley = { git = "https://github.com/lexmount/parley", rev = "8eb00ef5e628b1bba95dcde88658deb2a5aed1b5" }
+fontique = { git = "https://github.com/lexmount/parley", rev = "8eb00ef5e628b1bba95dcde88658deb2a5aed1b5" }
 xml5ever = { path = "vendor/xml5ever-0.39.0" }
 curl = { git = "https://github.com/lexmount/curl-rust", rev = "a0ea59f5ca1b1e4bc8627a28c29463ac96aeb758" }
 curl-sys = { git = "https://github.com/lexmount/curl-rust", rev = "a0ea59f5ca1b1e4bc8627a28c29463ac96aeb758" }
```

**File**: `moli-layout/Cargo.toml` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ euclid = "=0.22.14"
 kurbo = "=0.13.1"
 moli-image = { path = "../moli-image" }
 moli-system-fonts = { path = "../moli-system-fonts" }
-parley = "=0.11.1"
+parley = "=0.11.0"
 read-fonts = "0.41.0"
 stylo = "0.20"
 stylo_taffy = { git = "https://github.com/DioxusLabs/blitz", rev = "5081c65811a4396f5a99b2e0aca542a4a4a6606f", default-features = false, features = ["std", "block", "flexbox", "grid", "floats"] }
```

**File**: `moli-layout/src/inline.rs` (modified, +133/-29)
```diff
@@ -246,7 +246,7 @@ impl InlineContentWidthsMemo {
         indent: f32,
         options: parley::IndentOptions,
     ) -> parley::ContentWidths {
-        if !layout.inline_boxes().is_empty() {
+        if layout.inline_boxes().len() != 0 {
             return layout.calculate_content_widths();
         }
 
@@ -277,6 +277,90 @@ pub(crate) fn reset_inline_layout_for_probe(layout: &mut Layout<TextBrush>) {
     drop(layout.break_lines());
 }
 
+/// Place CSS decorations around visual fragments after bidi reordering.
+///
+/// Edge widths still participate in logical line breaking. Their visual slots
+/// follow CSS direction and descendant fragments, independently of the text's
+/// resolved bidi levels. Process descendants first so nested decorations are
+/// included when placing their parent's physical edges.
+pub(crate) fn position_inline_edges<N: Copy + Debug + Eq + Hash>(
+    world: &LayoutWorld<N>,
+    context: &InlineFormattingContext,
+    layout: &mut Layout<TextBrush>,
+) {
+    if !context.objects.iter().any(|object| {
+        matches!(
+            object.role,
+            InlineObjectRole::StartEdge | InlineObjectRole::EndEdge
+        )
+    }) {
+        return;
+    }
+    for line_index in 0..layout.len() {
+        let line = layout.get(line_index).expect("known line");
+        let mut ancestors = vec![Vec::new(); line.len()];
+        for run in line.runs() {
+            ancestors[run.index()] =
+                overlapping_output_ranges(&context.text_units, &run.text_range())
+                    .iter()
+                    .filter(|unit| !unit.control)
+                    .flat_map(|unit| unit.ancestors.iter().copied())
+                    .collect();
+        }
+        let mut edges = BTreeMap::<usize, Vec<(usize, bool)>>::new();
+        for (slot, inline_box) in line.inline_box_indices() {
+            let Some(object) = context.object(inline_box.id) else {
+                continue;
+            };
+            ancestors[slot] = object.ancestors.clone();
+            if matches!(
+                object.role,
+                InlineObjectRole::StartEdge | InlineObjectRole::EndEdge
+            ) {
+                let physical_left = (object.role == InlineObjectRole::StartEdge)
+                    == (world.boxes[object.box_id.index()].style.direction()
+                        == InlineDirection::Ltr);
+                edges
+                    .entry(object.box_id.index())
+                    .or_default()
+                    .push((slot, physical_left));
+            }
+        }
+        let mut edges = edges.into_iter().collect::<Vec<_>>();
+        edges.sort_by_key(|(_, slots)| std::cmp::Reverse(ancestors[slots[0].0].len()));
+        let mut order = (0..line.len()).collect::<Vec<_>>();
+        for (box_index, mut slots) in edges {
+            let original_position = order
+                .iter()
+                .position(|slot| slots.iter().any(|(edge, _)| edge == slot))
+                .expect("edge on this line");
+            order.retain(|slot| !slots.iter().any(|(edge, _)| edge == slot));
+            let box_id = LayoutBoxId::from_index(box_index);
+            let first = order
+                .iter()
+                .position(|slot| ancestors[*slot].contains(&box_id));
+            let last = order
+                .iter()
+                .rposition(|slot| ancestors[*slot].contains(&box_id));
+            slots.sort_by_key(|(_, left)| !left);
+            if let (Some(first), Some(last)) = (first, last) {
+                if let Some((slot, _)) = slots.iter().find(|(_, left)| !left) {
+                    order.insert(last + 1, *slot);
+                }
+                if let Some((slot, _)) = slots.iter().find(|(_, left)| *left) {
+                    order.insert(first, *slot);
+                }
+            } else {
+                let position = original_position.min(order.len());
+                order.splice(position..position, slots.iter().map(|(slot, _)| *slot));
+            }
+        }
+        if order.iter().enumerate().any(|(index, &slot)| index != slot) {
+            layout.reorder_line_items(line_index, &order);
+        }
+    }
+}
+
 #[derive(Clone, Copy, Debug)]
 pub(crate) struct InlineStrutMetrics {
     line_ascent: f32,
@@ -377,6 +461,17 @@ impl InlineFormattingContext {
             .unwrap_or(self.root_style)
     }
 
+    pub(crate) fn style_is_within_box(&self, index: usize, target: LayoutBoxId) -> bool {
+        let mut current = Some(self.style_parent(index));
+        while let Some(box_id) = current {
+            if box_id == target {
+                return true;
+            }
+            current = self.structural_box(box_id).map(|state| state.parent);
+        }
+        false
+    }
+
     fn box_includes_used_font_metrics(&self, box_id: LayoutBoxId) -> bool {
         if box_id == self.root_style {
             return self.root_includes_used_font_metrics;
@@ -502,14 +597,10 @@ pub(crate) fn build_inli
```

**File**: `moli-layout/src/paint/text.rs` (modified, +19/-44)
```diff
@@ -1,16 +1,19 @@
-use parley::{Affinity, Cursor, PositionedLayoutItem, Selection};
+use parley::{
+    Affinity, PositionedLayoutItem,
+    editing::{Cursor, Selection},
+};
 
 use super::{PaintProjectionMetrics, cull::rects_intersect};
 use crate::{
     LayoutBox, LayoutBoxId, LayoutRect, LayoutTransform2D, PaintBrush, PaintColor, PaintFragment,
     PaintGlyph, PaintGlyphRun, PaintShape, PaintSnapshot, PaintTextDecoration, PaintTextShadow,
-    inline::{InlineFormattingContext, InlineObjectRole, InlinePaintBounds, InlineSelection},
+    inline::{InlineFormattingContext, InlinePaintBounds, InlineSelection},
 };
 
 const SELECTION_COLOR: PaintColor = PaintColor::new(180.0 / 255.0, 213.0 / 255.0, 1.0, 1.0);
 // These expansion ratios and the 0.3 px cap follow Blitz's AnyRender text
-// painter at d788124a. Moli records them only when Fontique/Parley asks
-// for faux bold and the computed font-synthesis-weight permits it.
+// painter at d788124a. Moli combines the matched face's synthesis metadata with
+// the computed CSS weight threshold and font-synthesis-weight permission.
 const SYNTHETIC_EMBOLDEN_X_EM: f32 = 0.015_125;
 const SYNTHETIC_EMBOLDEN_Y_EM: f32 = 0.012_1;
 const MAX_SYNTHETIC_EMBOLDEN_PX: f32 = 0.3;
@@ -113,7 +116,6 @@ fn project_text_phase<N>(
         );
     }
 
-    let mut active_inline_boxes = Vec::new();
     for (line_index, line) in text_layout.lines().enumerate() {
         metrics.text_line_count = metrics.text_line_count.saturating_add(1);
         let line_is_culled =
@@ -136,34 +138,16 @@ fn project_text_phase<N>(
             });
         if line_is_culled {
             metrics.culled_text_line_count = metrics.culled_text_line_count.saturating_add(1);
-            // A background-clip:text replay tracks structural inline start/end
-            // markers across lines. Even when a line's glyph ink is culled,
-            // retain that tiny state transition so a later visible line uses
-            // the correct InlineBox mask scope.
-            if mask_scope.is_some() {
-                for item in line.items() {
-                    if let PositionedLayoutItem::InlineBox(positioned) = item {
-                        update_active_inline_boxes(
-                            context,
-                            positioned.id,
-                            &mut active_inline_boxes,
-                        );
-                    }
-                }
-            }
             continue;
         }
         let line_placement = context.line_placements.get(line_index);
         for (item_index, item) in line.items().enumerate() {
             let glyph_run = match item {
-                PositionedLayoutItem::InlineBox(positioned) => {
-                    update_active_inline_boxes(context, positioned.id, &mut active_inline_boxes);
-                    continue;
-                }
+                PositionedLayoutItem::InlineBox(_) => continue,
                 PositionedLayoutItem::GlyphRun(glyph_run) => glyph_run,
             };
             if let Some(TextClipMaskScope::InlineBox(target)) = mask_scope
-                && !active_inline_boxes.contains(&target)
+                && !context.style_is_within_box(usize::from(glyph_run.style_index()), target)
             {
                 continue;
             }
@@ -185,9 +169,11 @@ fn project_text_phase<N>(
             if glyphs.is_empty() {
                 continue;
             }
-            let font = snapshot.intern_font(run.font());
+            let font = snapshot.intern_font(&run.font().font);
             let synthesis = run.synthesis();
-            let glyph_embolden = if glyph_run.style().brush.synthetic_bold && synthesis.embolden() {
+            let glyph_embolden = if glyph_run.style().brush.synthetic_bold
+                && synthesis.embolden_with_threshold(0.0)
+            {
                 let font_size = run.font_size().max(0.0);
                 crate::PaintPoint::new(
                     (SYNTHETIC_EMBOLDEN_X_EM * font_size).min(MAX_SYNTHETIC_EMBOLDEN_PX),
@@ -199,7 +185,11 @@ fn project_text_phase<N>(
             let owned_run = PaintGlyphRun {
                 font,
                 font_size: run.font_size(),
-                normalized_coords: run.normalized_coords().to_vec(),
+                normalized_coords: run
+                    .normalized_coords()
+                    .iter()
+                    .map(|coord| coord.to_bits())
+                    .collect(),
                 color: if phase == TextPaintPhase::ClipMask {
                     PaintColor::BLACK
                 } else {
@@ -222,7 +212,7 @@ fn project_text_phase<N>(
                 }
             }
 
-            let metrics = run.metrics();
+            let metrics = run.font_metrics();
             let baseline = origin_y + glyph_run.baseline() + vertical_offset;
             let x = origin_x + glyph_run.offset();
             let width = glyph_run.advance().max(0.0);
@@ -277,21 +267,6 @@ fn project_text_phase<N>(
  
```

**File**: `moli-layout/src/stylo_to_parley.rs` (modified, +20/-4)
```diff
@@ -30,10 +30,10 @@ use style::{
 
 use crate::{PaintColor, PaintPoint, PaintTextDecorationStyle, style::absolute_paint_color};
 
-// Blink only requests synthetic bold for CSS weights at or above 600. Fontique
-// reports any requested weight above the selected face as embolden-able, which
-// also includes the CSS 500 -> regular 400 match unless we preserve this
-// browser-level threshold at the style bridge.
+// Blink only requests synthetic bold for CSS weights at or above 600. The
+// matched face's synthesis metadata separately records whether its static
+// weight is below the request, including the CSS 500 -> regular 400 match.
+// Keep this browser threshold independent of the library's default policy.
 const SYNTHETIC_BOLD_THRESHOLD: f32 = 600.0;
 
 #[derive(Clone, Copy, Debug, Default, PartialEq)]
@@ -168,6 +168,22 @@ pub(crate) fn text_style(computed: &ComputedValues) -> TextStyle<'static, 'stati
     };
 
     TextStyle {
+        line_break: parley::LineBreak::default(),
+        vertical_align: parley::VerticalAlign::default(),
+        white_space_collapse: match computed.clone_white_space_collapse() {
+            style::computed_values::white_space_collapse::T::Collapse => {
+                parley::WhiteSpaceCollapse::Collapse
+            }
+            style::computed_values::white_space_collapse::T::Preserve => {
+                parley::WhiteSpaceCollapse::Preserve
+            }
+            style::computed_values::white_space_collapse::T::PreserveBreaks => {
+                parley::WhiteSpaceCollapse::PreserveBreaks
+            }
+            style::computed_values::white_space_collapse::T::BreakSpaces => {
+                parley::WhiteSpaceCollapse::BreakSpaces
+            }
+        },
         font_family: FontFamily::List(Cow::Owned(families)),
         font_size,
         font_width: font_width(font.font_stretch),
```

**File**: `moli-layout/src/taffy_tree.rs` (modified, +6/-4)
```diff
@@ -20,8 +20,8 @@ use crate::{
     inline::{
         InlineContentWidthsMemo, InlineEdgeContribution, InlineFormattingContext, InlineFragments,
         InlineLinePlacement, InlineObjectRole, break_inline_lines, build_inline_fragments,
-        build_inline_line_placements, measure_inline_lines, relative_atomic_inset_offset,
-        reset_inline_layout_for_probe,
+        build_inline_line_placements, measure_inline_lines, position_inline_edges,
+        relative_atomic_inset_offset, reset_inline_layout_for_probe,
     },
     positioned::{
         FlexCrossAxisStaticContext, HorizontalStaticEdge, PhysicalStaticPosition,
@@ -2366,7 +2366,7 @@ where
             vec![InlineEdgeContribution::default(); context.objects.len()];
         let mut floats = Vec::new();
 
-        for (inline_box, object) in layout.inline_boxes_mut().iter_mut().zip(&context.objects) {
+        for (inline_box, object) in layout.inline_boxes_mut().zip(&context.objects) {
             match object.role {
                 InlineObjectRole::Atomic => {
                     let margins = self.boxes[object.box_id.index()]
@@ -2652,10 +2652,12 @@ where
         } else {
             break_inline_lines(context, layout, max_advance);
         }
+        position_inline_edges(self, context, layout);
         layout.align(
             alignment,
             AlignmentOptions {
                 align_when_overflowing: false,
+                last_line_alignment: None,
             },
         );
 
@@ -2854,7 +2856,7 @@ where
                     state.set_line_max_advance(slot.width.max(0.0));
                     state.set_line_x(slot.x);
                     state.set_line_y(f64::from(slot.y));
-                    state.append_inline_box_to_line(data.advance, 0.0);
+                    state.append_inline_box_to_line(data.advance, 0.0, 0.0);
                 }
             }
         }
```

**File**: `moli-layout/src/text.rs` (modified, +6/-5)
```diff
@@ -350,16 +350,16 @@ impl ParleyDocumentServices {
             let mut layout = builder.build(&candidate);
             layout.break_all_lines(None);
             let run = layout.lines().next()?.runs().next()?;
-            if primary_font
-                .is_some_and(|identity| identity != (run.font().data.id(), run.font().index))
-            {
+            if primary_font.is_some_and(|identity| {
+                identity != (run.font().font.data.id(), run.font().font.index)
+            }) {
                 return None;
             }
-            let metrics = *run.metrics();
+            let metrics = *run.font_metrics();
             Some(InlineFontMetrics {
                 ascent: metrics.ascent,
                 descent: metrics.descent,
-                line_height: metrics.line_height,
+                line_height: run.line_height(),
                 x_height: resolved_inline_x_height(metrics.ascent, metrics.x_height),
             })
         });
@@ -1199,6 +1199,7 @@ mod tests {
             .next()
             .expect("one shaped run")
             .font()
+            .font
             .data
             .as_ref()
             .to_vec()
```

---

### Incident Patch 8: `d8e7c377` (2026-10-03)
**Commit Message**: fix(layout): resolve atomic inline bidi levels through Parley

Resolve inline objects independently so an atomic sibling outside a closed
RTL context follows the surrounding text instead of the preceding RTL run.
Pin the Parley 0.11.1 fork repair and its shared Fontique source.

Declare atomic and transparent boundary roles at the Moli adapter, keeping
opening edges with the next participant and closing edges with the previous
item. Add 336 Chromium-verified geometry cases across document modes,
contexts, directions, breaks and atomic placement, including publication.

**File**: `Cargo.lock` (modified, +4/-8)
```diff
@@ -1395,8 +1395,7 @@ dependencies = [
 [[package]]
 name = "fontique"
 version = "0.11.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6688bc1294fe7117d788937b6c53480169b29c566954af490830d4c09da9516a"
+source = "git+https://github.com/lexmount/parley?rev=43ab1b7470f0e71ff8cd397a58974c658eb33652#43ab1b7470f0e71ff8cd397a58974c658eb33652"
 dependencies = [
  "hashbrown 0.17.1",
  "linebender_resource_handle",
@@ -3994,14 +3993,12 @@ dependencies = [
 [[package]]
 name = "parlance"
 version = "0.1.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "4b6937eda350acc1a5d05872c3cbf99fe78619c269096e2be3d4a350058639d5"
+source = "git+https://github.com/lexmount/parley?rev=43ab1b7470f0e71ff8cd397a58974c658eb33652#43ab1b7470f0e71ff8cd397a58974c658eb33652"
 
 [[package]]
 name = "parley"
 version = "0.11.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "22d2ff88bd3f7d68d1d9b09c7e6209f9a8e8c05088295140a2bcf2e9b17038c5"
+source = "git+https://github.com/lexmount/parley?rev=43ab1b7470f0e71ff8cd397a58974c658eb33652#43ab1b7470f0e71ff8cd397a58974c658eb33652"
 dependencies = [
  "fontique",
  "harfrust",
@@ -4018,8 +4015,7 @@ dependencies = [
 [[package]]
 name = "parley_data"
 version = "0.11.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1567535334d6ba2d3cde19221ba9a7bd0fabb3cbd99046ddfb10ae061cfcc889"
+source = "git+https://github.com/lexmount/parley?rev=43ab1b7470f0e71ff8cd397a58974c658eb33652#43ab1b7470f0e71ff8cd397a58974c658eb33652"
 dependencies = [
  "icu_properties",
 ]
```

**File**: `Cargo.toml` (modified, +2/-0)
```diff
@@ -98,6 +98,8 @@ exclude = ["vendor/xml5ever-0.39.0"]
 license = "MIT OR Apache-2.0"
 
 [patch.crates-io]
+parley = { git = "https://github.com/lexmount/parley", rev = "43ab1b7470f0e71ff8cd397a58974c658eb33652" }
+fontique = { git = "https://github.com/lexmount/parley", rev = "43ab1b7470f0e71ff8cd397a58974c658eb33652" }
 xml5ever = { path = "vendor/xml5ever-0.39.0" }
 curl = { git = "https://github.com/lexmount/curl-rust", rev = "a0ea59f5ca1b1e4bc8627a28c29463ac96aeb758" }
 curl-sys = { git = "https://github.com/lexmount/curl-rust", rev = "a0ea59f5ca1b1e4bc8627a28c29463ac96aeb758" }
```

**File**: `moli-layout/src/inline.rs` (modified, +37/-17)
```diff
@@ -14,7 +14,9 @@ use std::{
     ops::Range,
 };
 
-use parley::{BreakReason, InlineBox, InlineBoxKind, Layout, PositionedLayoutItem, TextStyle};
+use parley::{
+    BreakReason, InlineBox, InlineBoxBidi, InlineBoxKind, Layout, PositionedLayoutItem, TextStyle,
+};
 use taffy::{MaybeResolve as _, Point, Size};
 
 use crate::{
@@ -110,6 +112,18 @@ pub(crate) enum InlineObjectRole {
     EndEdge,
 }
 
+impl InlineObjectRole {
+    fn parley_bidi(self) -> InlineBoxBidi {
+        match self {
+            Self::Atomic => InlineBoxBidi::Neutral,
+            // CSS tag boundaries do not add bidi characters. Leading edges
+            // follow the next participant, closing edges the preceding one.
+            Self::StartEdge => InlineBoxBidi::InheritNext,
+            Self::EndEdge | Self::Float | Self::OutOfFlow => InlineBoxBidi::InheritPrevious,
+        }
+    }
+}
+
 #[derive(Clone, Debug)]
 pub(crate) struct InlineObject {
     pub(crate) box_id: LayoutBoxId,
@@ -2022,14 +2036,17 @@ impl InlineBuildInput {
             }
         }
         let object_anchors = self.projected_object_anchors();
-        for (object_id, (_, _, kind)) in self.objects.iter().enumerate() {
-            builder.push_inline_box(InlineBox {
-                id: u64::try_from(object_id).expect("one IFC exceeded the u64 object limit"),
-                kind: *kind,
-                index: object_anchors[object_id],
-                width: 0.0,
-                height: 0.0,
-            });
+        for (object_id, (_, object, kind)) in self.objects.iter().enumerate() {
+            builder.push_inline_box_with_bidi(
+                InlineBox {
+                    id: u64::try_from(object_id).expect("one IFC exceeded the u64 object limit"),
+                    kind: *kind,
+                    index: object_anchors[object_id],
+                    width: 0.0,
+                    height: 0.0,
+                },
+                object.role.parley_bidi(),
+            );
         }
         let layout = builder.build(&self.text);
         let font_metrics = styles
@@ -2949,14 +2966,17 @@ mod tests {
             let style = builder.push_style(TextStyle::default());
             builder.push_style_run(style, ..);
             let anchors = input.projected_object_anchors();
-            for (id, (_, _, kind)) in input.objects.iter().enumerate() {
-                builder.push_inline_box(InlineBox {
-                    id: id as u64,
-                    kind: *kind,
-                    index: anchors[id],
-                    width: 1.0,
-                    height: 20.0,
-                });
+            for (id, (_, object, kind)) in input.objects.iter().enumerate() {
+                builder.push_inline_box_with_bidi(
+                    InlineBox {
+                        id: id as u64,
+                        kind: *kind,
+                        index: anchors[id],
+                        width: 1.0,
+                        height: 20.0,
+                    },
+                    object.role.parley_bidi(),
+                );
             }
             let mut layout = builder.build(&input.text);
             layout.break_all_lines(None);
```

**File**: `moli-renderer-v8/src/script_vm/tests/dom_elements/dom_surface/extracted/inline_layout.rs` (modified, +114/-0)
```diff
@@ -1,5 +1,119 @@
 use super::*;
 
+// Relative geometry measured in Chromium 145.0.7632.116 in all three modes.
+#[test]
+fn atomic_inline_boxes_resolve_bidi_contexts_without_expanding_sibling_fragments() {
+    for doctype in [
+        "",
+        r#"<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">"#,
+        "<!doctype html>",
+    ] {
+        for context in [
+            "normal",
+            "embed",
+            "bidi-override",
+            "isolate",
+            "isolate-override",
+            "plaintext",
+            "dir",
+        ] {
+            for direction in ["ltr", "rtl"] {
+                for break_kind in ["br", "pre", "single"] {
+                    for inside in [false, true] {
+                        for tail_space in [false, true] {
+                            if tail_space && break_kind != "pre" {
+                                continue;
+                            }
+                            let white_space = if break_kind == "pre" {
+                                "white-space:pre"
+                            } else {
+                                ""
+                            };
+                            let attributes = if context == "dir" {
+                                format!(r#"dir={direction} style="{white_space}""#)
+                            } else {
+                                format!(
+                                    r#"style="unicode-bidi:{context};direction:{direction};{white_space}""#
+                                )
+                            };
+                            let prefix = match break_kind {
+                                "br" => "x<br>",
+                                "pre" => "x\n",
+                                _ => "",
+                            };
+                            let atom = "<i id=atom></i>";
+                            let markup = format!(
+                                r#"{doctype}<style>body{{margin:0}}#line{{font:20px/30px monospace;width:300px}}#atom{{display:inline-block;width:10px;height:20px}}</style><div id=line><span {attributes}>{prefix}<span id=word>x</span>{}{}</span>{}</div>"#,
+                                if tail_space { " " } else { "" },
+                                if inside { atom } else { "" },
+                                if inside { "" } else { atom },
+                            );
+                            let mut vm =
+                                new_parsed_test_vm("https://atomic-inline-bidi.test/", &markup);
+                            let query = r#"JSON.stringify((()=>{
+                                const line=document.getElementById('line').getBoundingClientRect();
+                                const word=document.getElementById('word'),range=document.createRange();
+                                range.selectNodeContents(word);
+                                const text=range.getBoundingClientRect(),box=word.getBoundingClientRect();
+                                const atom=document.getElementById('atom').getBoundingClientRect();
+                                return [line.height,text.left-line.left,text.right-line.left,
+                                    atom.left-line.left,atom.width,box.left-line.left,box.width,
+                                    word.getClientRects().length,range.getClientRects().length,word.textContent.length];
+                            })())"#;
+                            let first = vm.eval(query).unwrap();
+                            let geometry = serde_json::from_str::<[f64; 10]>(&first).unwrap();
+                            let text_width = geometry[2] - geometry[1];
+                            let rtl_context =
+                                direction == "rtl" && !matches!(context, "normal" | "plaintext");
+                            let expected_text_left = if rtl_context {
+                                (if inside { 10.0 } else { 0.0 })
+                                    + if tail_space { text_width } else { 0.0 }
+                            } else {
+                                0.0
+                            };
+                            let expected_atom_left = if inside && rtl_context {
+                                0.0
+                            } else {
+                                expected_text_left
+                                    + text_width
+                                    + if tail_space && !rtl_context {
+                                        text_width
+                                    } else {
+                                        0.0
+                                    }
+                            };
+                            let case = format!(
+                                "{doctype} / {context} / {direction} / {break_kind} / inside={inside} / tail={tail_space}"
+                            );
+                            for (actual, expected) in [
+  
```

---

### Incident Patch 9: `557d40e1` (2026-10-05)
**Commit Message**: fix(svg): validate existing root factory receivers with native brands

**File**: `moli-renderer-v8/src/context_bootstrap/svg_runtime/bindings.rs` (modified, +1/-1)
```diff
@@ -481,7 +481,7 @@ struct SvgGradientElementTemplateConstantsDeclaration {
 }
 
 #[derive(WebApiFunctionTemplate)]
-#[webapi(interface = web_api_interfaces::SVGSVGElement, enumerable)]
+#[webapi(interface = web_api_interfaces::SVGSVGElement, enumerable, receiver)]
 struct SvgSvgElementTemplateMethodsDeclaration {
     #[webapi(
         method = "createSVGRect",
```

**File**: `moli-renderer-v8/src/script_vm/tests/mod.rs` (modified, +1/-0)
```diff
@@ -2168,6 +2168,7 @@ mod rendering_update;
 mod script_terminal_completion;
 mod streams;
 mod svg_filter_interfaces;
+mod svg_root_factory_receivers;
 mod svg_switch_mpath_interfaces;
 mod url_components;
 mod webgl_interfaces;
```

**File**: `moli-renderer-v8/src/script_vm/tests/svg_root_factory_receivers.rs` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+use super::*;
+
+#[test]
+fn svg_root_factories_validate_native_receivers_in_main_and_child_realms() {
+    let mut vm = new_parsed_test_vm(
+        "https://svg-root-receivers.test/",
+        "<!doctype html><html><body><iframe></iframe></body></html>",
+    );
+    assert_eq!(vm.eval(r#"(() => {
+      const ns = 'http://www.w3.org/2000/svg';
+      const child = document.querySelector('iframe').contentWindow;
+      const check = (ok, label) => { if (!ok) throw Error(label); };
+      const error = f => { try { f(); } catch (e) { return e; } };
+      for (const realm of [window, child]) {
+        for (const doc of [realm.document, realm.document.implementation.createHTMLDocument('')]) {
+          const svg = doc.createElementNS(ns, 'svg');
+          const matrix = svg.createSVGMatrix();
+          check(matrix instanceof realm.SVGMatrix && matrix.a === 1 && matrix.d === 1, 'genuine matrix factory');
+          const transform = svg.createSVGTransform();
+          check(transform instanceof realm.SVGTransform && transform.matrix.a === 1, 'genuine transform factory');
+          matrix.a = 2;
+          matrix.e = 5;
+          const fromMatrix = svg.createSVGTransformFromMatrix(matrix);
+          check(fromMatrix instanceof realm.SVGTransform && fromMatrix.matrix.a === 2 && fromMatrix.matrix.e === 5, 'matrix conversion');
+          matrix.a = 4;
+          check(fromMatrix.matrix.a === 2, 'matrix conversion returns independent state');
+          let traps = 0;
+          const handler = {get() { traps++; throw Error('receiver trap'); }, getPrototypeOf() { traps++; throw Error('prototype trap'); }};
+          const revoked = realm.Proxy.revocable(svg, handler);
+          revoked.revoke();
+          const receivers = [{}, Object.create(svg), new realm.Proxy(svg, handler), revoked.proxy, doc, doc.createElementNS(ns, 'rect')];
+          for (const method of ['createSVGMatrix', 'createSVGTransform', 'createSVGTransformFromMatrix', 'createSVGRect', 'deselectAll']) {
+            const fn = realm.SVGSVGElement.prototype[method];
+            for (const receiver of receivers) {
+              check(error(() => fn.call(receiver, matrix)) instanceof realm.TypeError, method + ' invalid receiver');
+            }
+          }
+          check(traps === 0, 'receiver branding does not invoke author Proxy traps');
+        }
+      }
+      const otherSvg = child.document.createElementNS(ns, 'svg');
+      check(SVGSVGElement.prototype.createSVGMatrix.call(otherSvg) instanceof SVGMatrix, 'cross-realm genuine root');
+      check(SVGSVGElement.prototype.createSVGTransform.call(otherSvg) instanceof SVGTransform, 'callee-realm transform');
+      return true;
+    })()"#).unwrap(), "true");
+}
```

---

### Incident Patch 10: `b9fc881f` (2026-10-04)
**Commit Message**: fix(webstorage): preserve StorageEvent WebIDL initialization

**File**: `moli-renderer-v8/src/context_bootstrap/event_legacy.rs` (modified, +12/-12)
```diff
@@ -49,16 +49,16 @@ struct InitStorageEventArgs<'s> {
     bubbles: bool,
     #[webidl(default = false)]
     cancelable: bool,
-    #[webidl(index = 3, nullable)]
-    key: Option<String>,
-    #[webidl(name = "oldValue", index = 4, nullable)]
-    old_value: Option<String>,
-    #[webidl(name = "newValue", index = 5, nullable)]
-    new_value: Option<String>,
+    #[webidl(index = 3, nullable, converter = "raw")]
+    key: Option<webidl::DomString16>,
+    #[webidl(name = "oldValue", index = 4, nullable, converter = "raw")]
+    old_value: Option<webidl::DomString16>,
+    #[webidl(name = "newValue", index = 5, nullable, converter = "raw")]
+    new_value: Option<webidl::DomString16>,
     #[webidl(default = "", index = 6, converter = "usv_string")]
     url: String,
     #[webidl(index = 7, converter = "raw", nullable)]
-    storage_area: Option<v8::Local<'s, v8::Value>>,
+    storage_area: Option<super::web_storage::StorageReference<'s>>,
 }
 
 #[derive(webidl::WebIdlArgs)]
@@ -508,14 +508,14 @@ pub(super) fn storage_event_init_callback<'s>(
     ) {
         return;
     }
-    super::events::define_storage_event_properties(
+    super::events::define_storage_event_properties_utf16(
         scope,
         event,
-        parsed.key.as_deref(),
-        parsed.old_value.as_deref(),
-        parsed.new_value.as_deref(),
+        parsed.key.as_ref().map(|value| value.0.as_slice()),
+        parsed.old_value.as_ref().map(|value| value.0.as_slice()),
+        parsed.new_value.as_ref().map(|value| value.0.as_slice()),
         &parsed.url,
-        parsed.storage_area,
+        parsed.storage_area.map(|value| value.0.into()),
     );
 }
 
```

**File**: `moli-renderer-v8/src/context_bootstrap/events.rs` (modified, +1/-24)
```diff
@@ -1,5 +1,5 @@
 use super::*;
-use crate::util::{get_private_value, utf16_units, v8_string, v8_string_from_utf16_units, v8str};
+use crate::util::{get_private_value, v8_string, v8_string_from_utf16_units, v8str};
 use moli_webapi_declare::{ObjectLiteralDeclaration, WebApiObject};
 
 mod base;
@@ -181,29 +181,6 @@ pub(crate) fn construct_original_storage_event_utf16<'s>(
     Some(event)
 }
 
-pub(in crate::context_bootstrap) fn define_storage_event_properties<'s>(
-    scope: &mut v8::PinScope<'s, '_>,
-    event: v8::Local<'s, v8::Object>,
-    key: Option<&str>,
-    old_value: Option<&str>,
-    new_value: Option<&str>,
-    url: &str,
-    storage_area: Option<v8::Local<'s, v8::Value>>,
-) {
-    let key = key.map(utf16_units);
-    let old_value = old_value.map(utf16_units);
-    let new_value = new_value.map(utf16_units);
-    define_storage_event_properties_utf16(
-        scope,
-        event,
-        key.as_deref(),
-        old_value.as_deref(),
-        new_value.as_deref(),
-        url,
-        storage_area,
-    );
-}
-
 pub(in crate::context_bootstrap) fn define_storage_event_properties_utf16<'s>(
     scope: &mut v8::PinScope<'s, '_>,
     event: v8::Local<'s, v8::Object>,
```

**File**: `moli-renderer-v8/src/context_bootstrap/events/subclasses/constructor.rs` (modified, +17/-4)
```diff
@@ -42,7 +42,18 @@ fn event_subclass_constructor_callback<'s>(
             init_arg.to_object(scope)
         }
     };
-    let (bubbles, cancelable, composed) = read_event_init(scope, &args);
+    let storage_event_init = if kind == EventSubclassKind::StorageEvent {
+        let Some(init) = data::parse_storage_event_init(scope, &args) else {
+            return;
+        };
+        Some(init)
+    } else {
+        None
+    };
+    let (bubbles, cancelable, composed) = storage_event_init
+        .as_ref()
+        .map(data::StorageEventInitMembers::event_flags)
+        .unwrap_or_else(|| read_event_init(scope, &args));
 
     initialize_event_object_with_type(scope, event, event_type, bubbles, cancelable);
     define_event_property(
@@ -113,9 +124,11 @@ fn event_subclass_constructor_callback<'s>(
         }
         EventSubclassKind::MessageEvent => data::initialize_message_event(scope, event, init),
         EventSubclassKind::StorageEvent => {
-            if !data::initialize_storage_event(scope, event, init) {
-                return;
-            }
+            data::initialize_storage_event(
+                scope,
+                event,
+                storage_event_init.expect("StorageEvent init should be parsed"),
+            );
         }
         EventSubclassKind::ErrorEvent => data::initialize_error_event(scope, event, init),
         EventSubclassKind::PromiseRejectionEvent => {
```

**File**: `moli-renderer-v8/src/context_bootstrap/events/subclasses/data.rs` (modified, +47/-29)
```diff
@@ -10,6 +10,7 @@ use crate::context_bootstrap::navigation_handler_callbacks::{
 use crate::context_bootstrap::navigation_window::{
     child_browsing_context_handle_for_runtime_owner, runtime_window_is_global, runtime_window_owner,
 };
+use crate::context_bootstrap::web_storage::StorageReference;
 use crate::native_bridge::element::scroll_to_url_fragment_or_top;
 use crate::native_bridge::throw_dom_exception;
 use crate::util::context_host_ptr_from_global_bridge;
@@ -314,17 +315,47 @@ struct ToggleEventInitMembers<'s> {
 
 #[derive(Default, webidl::WebIdlDictionary)]
 #[webidl(prefix = "StorageEventInit")]
-struct StorageEventInitMembers<'s> {
-    #[webidl(nullable)]
-    key: Option<String>,
-    #[webidl(name = "oldValue", nullable)]
-    old_value: Option<String>,
-    #[webidl(name = "newValue", nullable)]
-    new_value: Option<String>,
+pub(super) struct StorageEventInitMembers<'s> {
+    #[webidl(default = false)]
+    bubbles: bool,
+    #[webidl(default = false)]
+    cancelable: bool,
+    #[webidl(default = false)]
+    composed: bool,
+    #[webidl(nullable, converter = "raw")]
+    key: Option<webidl::DomString16>,
+    #[webidl(name = "newValue", nullable, converter = "raw")]
+    new_value: Option<webidl::DomString16>,
+    #[webidl(name = "oldValue", nullable, converter = "raw")]
+    old_value: Option<webidl::DomString16>,
+    #[webidl(name = "storageArea", converter = "raw", nullable)]
+    storage_area: Option<StorageReference<'s>>,
     #[webidl(default = "", converter = "usv_string")]
     url: String,
-    #[webidl(name = "storageArea", converter = "raw", nullable)]
-    storage_area: Option<v8::Local<'s, v8::Value>>,
+}
+
+impl StorageEventInitMembers<'_> {
+    pub(super) fn event_flags(&self) -> (bool, bool, bool) {
+        (self.bubbles, self.cancelable, self.composed)
+    }
+}
+
+pub(super) fn parse_storage_event_init<'s>(
+    scope: &mut v8::PinScope<'s, '_>,
+    args: &v8::FunctionCallbackArguments<'s>,
+) -> Option<StorageEventInitMembers<'s>> {
+    let parsed = webidl::dictionary_arg(args, 1, webidl::Context::argument("StorageEvent", 2))
+        .and_then(|object| match object {
+            Some(object) => webidl::parse_dictionary_object(scope, object),
+            None => Ok(StorageEventInitMembers::default()),
+        });
+    match parsed {
+        Ok(init) => Some(init),
+        Err(error) => {
+            webidl::throw_error(scope, &error);
+            None
+        }
+    }
 }
 
 fn toggle_event_source_member<'s>(
@@ -482,30 +513,17 @@ pub(in crate::context_bootstrap::events::subclasses) fn initialize_message_event
 pub(in crate::context_bootstrap::events::subclasses) fn initialize_storage_event<'s>(
     scope: &mut v8::PinScope<'s, '_>,
     event: v8::Local<'s, v8::Object>,
-    init: Option<v8::Local<'s, v8::Object>>,
-) -> bool {
-    let parsed = match init {
-        Some(init) => {
-            match webidl::parse_dictionary_object::<StorageEventInitMembers>(scope, init) {
-                Ok(parsed) => parsed,
-                Err(error) => {
-                    webidl::throw_error(scope, &error);
-                    return false;
-                }
-            }
-        }
-        None => StorageEventInitMembers::default(),
-    };
-    crate::context_bootstrap::events::define_storage_event_properties(
+    parsed: StorageEventInitMembers<'s>,
+) {
+    crate::context_bootstrap::events::define_storage_event_properties_utf16(
         scope,
         event,
-        parsed.key.as_deref(),
-        parsed.old_value.as_deref(),
-        parsed.new_value.as_deref(),
+        parsed.key.as_ref().map(|value| value.0.as_slice()),
+        parsed.old_value.as_ref().map(|value| value.0.as_slice()),
+        parsed.new_value.as_ref().map(|value| value.0.as_slice()),
         &parsed.url,
-        parsed.storage_area,
+        parsed.storage_area.map(|value| value.0.into()),
     );
-    true
 }
 
 pub(in crate::context_bootstrap::events::subclasses) fn initialize_input_event<'s>(
```

**File**: `moli-renderer-v8/src/context_bootstrap/web_storage.rs` (modified, +21/-0)
```diff
@@ -1,4 +1,25 @@
 use super::*;
+use crate::webidl;
+
+pub(crate) struct StorageReference<'scope>(pub(crate) v8::Local<'scope, v8::Object>);
+
+impl<'scope> webidl::WebIdlConverter<'scope> for StorageReference<'scope> {
+    type Options = ();
+
+    fn convert(
+        scope: &mut v8::PinScope<'scope, '_>,
+        value: v8::Local<'scope, v8::Value>,
+        context: webidl::Context,
+        _options: &Self::Options,
+    ) -> Result<Self, webidl::WebIdlError> {
+        if let Ok(object) = v8::Local::<v8::Object>::try_from(value)
+            && crate::web_api_interfaces::Storage::is_instance(scope, object)
+        {
+            return Ok(Self(object));
+        }
+        Err(webidl::WebIdlError::cannot_convert(context, "Storage"))
+    }
+}
 
 mod accessors;
 mod callbacks;
```

**File**: `moli-renderer-v8/src/script_vm/tests/browser_api/mod.rs` (modified, +1/-0)
```diff
@@ -49,6 +49,7 @@ mod session_description;
 mod simple_handler_object;
 mod speech_synthesis;
 mod storage_access;
+mod storage_event_init;
 mod structured_clone;
 mod transferable_streams;
 mod traversal;
```

**File**: `moli-renderer-v8/src/script_vm/tests/browser_api/storage_event_init.js` (added, +186/-0)
```diff
@@ -0,0 +1,186 @@
+(() => {
+  const rows = [];
+  const check = (name, run) => {
+    try {
+      if (run() !== true) throw new Error('assertion failed');
+      rows.push({name, passed: true});
+    } catch (error) {
+      rows.push({name, passed: false, error: String(error), stack: error.stack});
+    }
+  };
+  const throws = (run, expected) => {
+    try { run(); } catch (error) { return error === expected; }
+    return false;
+  };
+  const typeError = (run, realm = globalThis) => {
+    try { run(); } catch (error) { return error instanceof realm.TypeError; }
+    return false;
+  };
+  const legacy = (key, oldValue, newValue, url, storageArea) => {
+    const event = new StorageEvent('before');
+    event.initStorageEvent('after', true, true, key, oldValue, newValue, url, storageArea);
+    return event;
+  };
+  const strings = ['', '\ud800', '\udc00', '\ud83d\ude00', 'a\ud800b\udc00\u0000\ud83d\ude00'];
+  for (const field of ['key', 'oldValue', 'newValue']) {
+    for (let i = 0; i < strings.length; i++) {
+      const text = strings[i];
+      check(`constructor ${field} UTF-16 ${i}`, () => new StorageEvent('x', {[field]: text})[field] === text);
+      check(`legacy ${field} UTF-16 ${i}`, () => legacy(text, text, text, '')[field] === text);
+    }
+    for (const value of [undefined, null]) {
+      check(`constructor ${field} nullable ${String(value)}`, () => new StorageEvent('x', {[field]: value})[field] === null);
+      check(`legacy ${field} nullable ${String(value)}`, () => legacy(value, value, value, '')[field] === null);
+    }
+    check(`constructor ${field} string conversion`, () => {
+      let conversions = 0;
+      const value = {[Symbol.toPrimitive](hint) { if (hint !== 'string') throw new Error(hint); conversions++; return strings[4]; }};
+      const event = new StorageEvent('x', {[field]: value});
+      return conversions === 1 && event[field] === strings[4];
+    });
+    check(`legacy ${field} string conversion`, () => {
+      let conversions = 0;
+      const value = {toString() { conversions++; return strings[4]; }};
+      const values = {key: null, oldValue: null, newValue: null, [field]: value};
+      const event = legacy(values.key, values.oldValue, values.newValue, '');
+      return conversions === 1 && event[field] === strings[4];
+    });
+    check(`constructor ${field} Symbol rejects`, () => typeError(() => new StorageEvent('x', {[field]: Symbol()})));
+    check(`legacy ${field} Symbol rejects`, () => {
+      const values = {key: null, oldValue: null, newValue: null, [field]: Symbol()};
+      return typeError(() => legacy(values.key, values.oldValue, values.newValue, ''));
+    });
+  }
+  check('constructor defaults', () => {
+    const event = new StorageEvent('x');
+    return event.key === null && event.oldValue === null && event.newValue === null && event.url === '' && event.storageArea === null && !event.bubbles && !event.cancelable && !event.composed;
+  });
+  check('legacy defaults', () => {
+    const event = new StorageEvent('before', {key: 'k', oldValue: 'o', newValue: 'n', composed: true});
+    const result = event.initStorageEvent('after');
+    return result === undefined && event.type === 'after' && event.key === null && event.oldValue === null && event.newValue === null && event.url === '' && event.storageArea === null && event.composed;
+  });
+  for (const [value, expected] of [[undefined, ''], [null, 'null'], [strings[4], 'a\ufffdb\ufffd\u0000\ud83d\ude00']]) {
+    check(`constructor url USVString ${String(value)}`, () => new StorageEvent('x', {url: value}).url === expected);
+    check(`legacy url USVString ${String(value)}`, () => legacy(null, null, null, value).url === expected);
+  }
+  for (const value of [undefined, null]) {
+    check(`nullable dictionary ${String(value)}`, () => new StorageEvent('x', value).key === null);
+  }
+  for (const value of [false, true, 0, 1, '', 'init', Symbol('init'), 1n]) {
+    check(`primitive dictionary ${String(value)}`, () => typeError(() => new StorageEvent('x', value)));
+  }
+  check('function dictionary', () => {
+    const init = () => {};
+    init.key = strings[4];
+    return new StorageEvent('x', init).key === strings[4];
+  });
+  const order = ['bubbles', 'cancelable', 'composed', 'key', 'newValue', 'oldValue', 'storageArea', 'url'];
+  check('inherited then own dictionary order', () => {
+    const seen = [];
+    new StorageEvent('x', new Proxy({}, {get(_target, name) { seen.push(name); }}));
+    return seen.join() === order.join();
+  });
+  check('dictionary reads and conversions are interleaved once', () => {
+    const seen = [];
+    const init = new Proxy({}, {get(_target, name) {
+      seen.push(`get:${name}`);
+      if (['key', 'newValue', 'oldValue', 'url'].includes(name)) {
+        return {[Symbol.toPrimitive](hint) { seen.push(`convert:${name}:${hint}`); return strings[4]; }};
+      }
+    }});
+    const event = new StorageEvent('x', init);
+    const expected
```

**File**: `moli-renderer-v8/src/script_vm/tests/browser_api/storage_event_init.rs` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+use super::*;
+
+#[test]
+fn storage_event_initializers_preserve_dom_strings_and_validate_storage_interfaces() {
+    let mut vm = new_storage_html_test_vm("https://storage-event-init-webidl.test/");
+    vm.eval("document.body.innerHTML = '<iframe id=child></iframe>';")
+        .unwrap();
+    assert_eq!(
+        vm.eval(include_str!("storage_event_init.js")).unwrap(),
+        "true"
+    );
+}
```

---

### Incident Patch 11: `706f22f3` (2026-10-05)
**Commit Message**: fix(forms): validate FormData native argument brands

**File**: `moli-renderer-v8/src/context_bootstrap/form_data_runtime/callbacks.rs` (modified, +74/-66)
```diff
@@ -10,10 +10,11 @@ use crate::{
     native_bridge::{
         JsContextHost,
         element::{form_associated_form_owner, is_valid_submit_button},
-        node_runtime_and_handle_from_object, throw_dom_exception,
+        node_relevant_context, node_runtime_and_handle_from_object_or_detached,
+        throw_dom_exception,
     },
     util::serialize_v8_iter_array,
-    webidl,
+    web_api_interfaces, webidl,
 };
 use moli_webapi_declare::WebApiObject;
 
@@ -115,77 +116,82 @@ pub(super) fn form_data_constructor_callback<'s>(
         return;
     }
 
-    let mut entries = Vec::new();
     let Some(parsed) = webidl::parse_args::<FormDataConstructorArgs<'s>>(scope, &args) else {
         return;
     };
-    if let Some(form) = parsed.form {
-        let Ok(form) = v8::Local::<v8::Object>::try_from(form) else {
-            throw_type_error(scope, "FormData constructor requires an HTMLFormElement");
-            return;
-        };
-        if object_string_property_defined(scope, form, "tagName")
-            .is_none_or(|tag| !tag.eq_ignore_ascii_case("form"))
-        {
-            throw_type_error(scope, "FormData constructor requires an HTMLFormElement");
-            return;
+    let form = match parsed.form {
+        Some(value) => {
+            let Ok(form) = v8::Local::<v8::Object>::try_from(value) else {
+                throw_type_error(scope, "FormData constructor requires an HTMLFormElement");
+                return;
+            };
+            if !web_api_interfaces::HTMLFormElement::is_instance(scope, form) {
+                throw_type_error(scope, "FormData constructor requires an HTMLFormElement");
+                return;
+            }
+            Some(form)
         }
-        let Ok((form_runtime_ptr, form_handle)) = node_runtime_and_handle_from_object(scope, form)
+        None => None,
+    };
+    // WebIDL converts the optional submitter even when the form is omitted.
+    let submitter = match parsed.submitter {
+        Some(value) if !value.is_null_or_undefined() => {
+            let Ok(submitter) = v8::Local::<v8::Object>::try_from(value) else {
+                throw_type_error(
+                    scope,
+                    "FormData constructor submitter must be an HTMLElement or null",
+                );
+                return;
+            };
+            if !web_api_interfaces::HTMLElement::is_instance(scope, submitter) {
+                throw_type_error(
+                    scope,
+                    "FormData constructor submitter must be an HTMLElement or null",
+                );
+                return;
+            }
+            Some(submitter)
+        }
+        _ => None,
+    };
+    let mut entries = Vec::new();
+    if let Some(form) = form {
+        let Ok((form_runtime_ptr, form_handle)) =
+            node_runtime_and_handle_from_object_or_detached(scope, form)
         else {
             throw_type_error(scope, "FormData constructor requires an HTMLFormElement");
             return;
         };
-        let submitter = match parsed.submitter {
-            Some(value) if value.is_null_or_undefined() => None,
-            Some(value) => match v8::Local::<v8::Object>::try_from(value) {
-                Ok(submitter) => {
-                    let Ok((submitter_runtime_ptr, submitter_handle)) =
-                        node_runtime_and_handle_from_object(scope, submitter)
-                    else {
-                        throw_type_error(
-                            scope,
-                            "FormData constructor submitter must be a submit button",
-                        );
-                        return;
-                    };
-                    if submitter_runtime_ptr != form_runtime_ptr {
-                        throw_dom_exception(
-                            scope,
-                            "NotFoundError",
-                            8,
-                            "The specified element is not owned by this form element.",
-                        );
-                        return;
-                    }
-                    let runtime = unsafe { &*form_runtime_ptr };
-                    if !is_valid_submit_button(runtime, submitter_handle) {
-                        throw_type_error(
-                            scope,
-                            "FormData constructor submitter must be a submit button",
-                        );
-                        return;
-                    }
-                    if form_associated_form_owner(runtime, submitter_handle) != Some(form_handle) {
-                        throw_dom_exception(
-                            scope,
-                            "NotFoundError",
-                            8,
-                            "The specified element is not owned by this form element.",
-                        );
-                        return;
-                    }
-                    Some(submitter)
-                }
-                Err(_) => {
-  
```

**File**: `moli-renderer-v8/src/context_bootstrap/form_data_runtime/serialize.rs` (modified, +36/-41)
```diff
@@ -7,10 +7,10 @@ use crate::dom::{
 };
 use crate::native_bridge::{
     element::{
-        element_attribute_for_object, element_internals_form_value_for_target,
+        control_has_datalist_ancestor, element_internals_form_value_for_target,
         form_control_is_effectively_disabled, form_data_control_elements, text_control_value,
     },
-    node_runtime_and_handle_from_object,
+    node_runtime_and_handle_from_object_or_detached,
 };
 use moli_encoding::is_charset_sentinel_name;
 use moli_webapi_declare::WebApiObject;
@@ -31,6 +31,9 @@ pub(super) fn serialize_form_data_controls<'s>(
     let mut entries = Vec::new();
     let controls = form_data_control_elements(unsafe { &*runtime_ptr }, form_handle);
     for handle in controls {
+        if control_has_datalist_ancestor(unsafe { &*runtime_ptr }, handle) {
+            continue;
+        }
         let Some(control) = form_data_control_object(scope, runtime_ptr, handle) else {
             continue;
         };
@@ -82,10 +85,6 @@ fn append_form_data_entries_for_control<'s>(
     if control_is_effectively_disabled(scope, control) {
         return;
     }
-    if control_has_datalist_ancestor(scope, control) {
-        return;
-    }
-
     let tag = object_string_property_defined(scope, control, "tagName")
         .map(|tag| tag.to_ascii_lowercase())
         .unwrap_or_default();
@@ -243,19 +242,28 @@ fn append_form_data_entries_for_control<'s>(
     }
 }
 
-fn form_control_name(
-    scope: &mut v8::PinScope<'_, '_>,
-    control: v8::Local<'_, v8::Object>,
+fn form_control_name<'s>(
+    scope: &mut v8::PinScope<'s, '_>,
+    control: v8::Local<'s, v8::Object>,
 ) -> String {
-    element_attribute_for_object(scope, control, "name").unwrap_or_default()
+    let Ok((runtime_ptr, handle)) = node_runtime_and_handle_from_object_or_detached(scope, control)
+    else {
+        return String::new();
+    };
+    unsafe { &*runtime_ptr }
+        .dom_host()
+        .node(handle)
+        .and_then(Node::as_element)
+        .and_then(|element| element.attribute_ns("", "name"))
+        .unwrap_or_default()
+        .to_owned()
 }
 
-fn image_submitter_coordinates(
-    scope: &mut v8::PinScope<'_, '_>,
-    control: v8::Local<'_, v8::Object>,
+fn image_submitter_coordinates<'s>(
+    scope: &mut v8::PinScope<'s, '_>,
+    control: v8::Local<'s, v8::Object>,
 ) -> (u32, u32) {
-    let Ok((runtime_ptr, handle)) =
-        crate::native_bridge::node_runtime_and_handle_from_object(scope, control)
+    let Ok((runtime_ptr, handle)) = node_runtime_and_handle_from_object_or_detached(scope, control)
     else {
         return (0, 0);
     };
@@ -381,9 +389,9 @@ fn push_string_form_data_entry(
     push_form_data_entry(entries, name, v8::Global::new(scope, value));
 }
 
-fn form_control_value(
-    scope: &mut v8::PinScope<'_, '_>,
-    control: v8::Local<'_, v8::Object>,
+fn form_control_value<'s>(
+    scope: &mut v8::PinScope<'s, '_>,
+    control: v8::Local<'s, v8::Object>,
     default: &str,
 ) -> String {
     if let Some(value) = native_form_control_value(scope, control) {
@@ -392,11 +400,12 @@ fn form_control_value(
     object_string_property_defined(scope, control, "value").unwrap_or_else(|| default.to_owned())
 }
 
-fn native_form_control_value(
-    scope: &mut v8::PinScope<'_, '_>,
-    control: v8::Local<'_, v8::Object>,
+fn native_form_control_value<'s>(
+    scope: &mut v8::PinScope<'s, '_>,
+    control: v8::Local<'s, v8::Object>,
 ) -> Option<String> {
-    let (runtime_ptr, handle) = node_runtime_and_handle_from_object(scope, control).ok()?;
+    let (runtime_ptr, handle) =
+        node_runtime_and_handle_from_object_or_detached(scope, control).ok()?;
     let runtime = unsafe { &*runtime_ptr };
     let element = runtime.dom_host().node(handle).and_then(Node::as_element)?;
     if element.is_html_input() {
@@ -427,7 +436,9 @@ fn control_is_effectively_disabled<'s>(
     scope: &mut v8::PinScope<'s, '_>,
     control: v8::Local<'s, v8::Object>,
 ) -> bool {
-    if let Ok((runtime_ptr, handle)) = node_runtime_and_handle_from_object(scope, control) {
+    if let Ok((runtime_ptr, handle)) =
+        node_runtime_and_handle_from_object_or_detached(scope, control)
+    {
         return form_control_is_effectively_disabled(unsafe { &*runtime_ptr }, handle);
     }
     if object_bool_property(scope, control, "disabled").unwrap_or(false) {
@@ -453,7 +464,8 @@ fn native_form_associated_custom_element<'s>(
     scope: &mut v8::PinScope<'s, '_>,
     control: v8::Local<'s, v8::Object>,
 ) -> bool {
-    let Ok((runtime_ptr, handle)) = node_runtime_and_handle_from_object(scope, control) else {
+    let Ok((runtime_ptr, handle)) = node_runtime_and_handle_from_object_or_detached(scope, control)
+    else {
         return false;
     };
     is_form_associated_custom_element_handle(unsafe { &*runtime_ptr }, handle)
@@ -488,23 +500,6 @@ fn control_is_in_first_legend<'s>(
     false
 }
 
-fn control_has_datalist_ancestor<'s>(
-    scope: &mut v
```

**File**: `moli-renderer-v8/src/native_bridge/element.rs` (modified, +3/-3)
```diff
@@ -105,9 +105,9 @@ use trusted_types::{
 };
 
 pub(crate) use forms::{
-    autocomplete_field_name, autofill_related_form_control_elements, form_associated_form_owner,
-    form_control_elements, form_data_control_elements, is_valid_submit_button,
-    submit_form_with_submit_event,
+    autocomplete_field_name, autofill_related_form_control_elements, control_has_datalist_ancestor,
+    form_associated_form_owner, form_control_elements, form_data_control_elements,
+    is_valid_submit_button, submit_form_with_submit_event,
 };
 pub(in crate::native_bridge) use forms::{form_named_control_matches, form_named_image_matches};
 #[cfg(test)]
```

**File**: `moli-renderer-v8/src/native_bridge/element/forms.rs` (modified, +1/-0)
```diff
@@ -245,6 +245,7 @@ pub(in crate::native_bridge) use self::text_control::{
     text_control_set_selection_range_callback, textarea_value_getter_function,
     textarea_value_setter_function,
 };
+pub(crate) use self::validation::control_has_datalist_ancestor;
 pub(crate) use self::validation::v8_pattern_is_usable;
 pub(in crate::native_bridge) use self::validation::{
     control_check_validity_callback, control_matches_validity_pseudo,
```

**File**: `moli-renderer-v8/src/native_bridge/element/forms/validation.rs` (modified, +1/-1)
```diff
@@ -488,7 +488,7 @@ fn required_value_missing_is_suppressed_for_immutable_control(
             || (element.is_html_input() && element.input_type().supports_readonly()))
 }
 
-fn control_has_datalist_ancestor(runtime: &JsContextHost, handle: DomHandle) -> bool {
+pub(crate) fn control_has_datalist_ancestor(runtime: &JsContextHost, handle: DomHandle) -> bool {
     let mut current = runtime.dom_host().parent_node(handle);
     while let Some(parent) = current {
         let Some(parent_element) = runtime.dom_host().node(parent).and_then(Node::as_element)
```

**File**: `moli-renderer-v8/src/script_vm/tests/dom_elements/form_data_brands.js` (added, +84/-0)
```diff
@@ -0,0 +1,84 @@
+(() => {
+  const globals = [window, document.getElementById('child').contentWindow];
+  const rows = [], errors = [];
+  for (let realm = 0; realm < globals.length; ++realm) {
+    const g = globals[realm], other = globals[1 - realm];
+    for (const kind of ['live', 'windowless', 'parsed']) {
+      const label = `${realm}/${kind}`;
+      try {
+        const d = kind === 'live' ? g.document : kind === 'windowless' ?
+          g.document.implementation.createHTMLDocument('') :
+          new g.DOMParser().parseFromString('<!doctype html><body>', 'text/html');
+        const form = d.createElement('form'), input = d.createElement('input');
+        input.setAttribute('name', 'input-name'); input.setAttribute('value', 'input-value');
+        form.appendChild(input);
+        const select = d.createElement('select'), option = d.createElement('option');
+        select.setAttribute('name', 'select-name'); option.setAttribute('value', 'option-value');
+        select.appendChild(option); form.appendChild(select);
+        const button = d.createElement('button');
+        button.setAttribute('type', 'submit'); button.setAttribute('name', 'send'); button.setAttribute('value', 'button');
+        form.appendChild(button);
+        let tagReads = 0;
+        Object.defineProperty(form, 'tagName', {configurable: true, get() { ++tagReads; throw new Error('author tag getter'); }});
+        let valueReads = 0;
+        Object.defineProperty(input, 'value', {configurable: true, get() { ++valueReads; throw new Error('author value getter'); }});
+        let eventCount = 0, eventRealm = true, eventTarget = true;
+        form.addEventListener('formdata', event => {
+          ++eventCount;
+          eventRealm &&= event instanceof g.FormDataEvent && event.formData instanceof g.FormData;
+          eventTarget &&= event.target === form;
+          event.formData.append('from-handler', 'listener');
+        });
+        const data = new other.FormData(form);
+        const checks = {constructorRealm: Object.getPrototypeOf(data) === other.FormData.prototype,
+          input: data.get('input-name') === 'input-value',
+          option: data.get('select-name') === 'option-value',
+          event: eventCount === 1 && eventRealm && eventTarget,
+          handlerMutation: data.get('from-handler') === 'listener',
+          nativeProperties: tagReads === 0 && valueReads === 0,
+          omitSubmitter: !data.has('send')};
+        const withSubmitter = new other.FormData(form, button);
+        checks.submitter = withSubmitter.get('send') === 'button' && eventCount === 2;
+        let traps = 0;
+        const author = new g.Proxy(form, {get() { ++traps; return undefined; }, getPrototypeOf() { ++traps; return null; }});
+        const revoked = g.Proxy.revocable(form, {}); revoked.revoke();
+        checks.invalidForms = true;
+        for (const invalid of [null, {}, g.Object.create(form), author, revoked.proxy,
+          d.createElement('div'), d.createElementNS('http://www.w3.org/2000/svg', 'form')]) {
+          let error;
+          try { new other.FormData(invalid); } catch (caught) { error = caught; }
+          checks.invalidForms &&= error instanceof other.TypeError;
+        }
+        checks.invalidSubmitters = true;
+        for (const invalid of [{}, g.Object.create(button), new g.Proxy(button, {get() { ++traps; }}),
+          d.createElement('div'), other.document.createElement('div')]) {
+          let error;
+          try { new other.FormData(form, invalid); } catch (caught) { error = caught; }
+          checks.invalidSubmitters &&= error instanceof other.TypeError;
+        }
+        const foreign = d.createElement('button'); foreign.type = 'submit';
+        const crossDocument = other.document.createElement('button'); crossDocument.type = 'submit';
+        checks.foreignSubmitter = true;
+        for (const submitter of [foreign, crossDocument]) {
+          let notFound;
+          try { new other.FormData(form, submitter); } catch (caught) { notFound = caught; }
+          checks.foreignSubmitter &&= notFound instanceof other.DOMException && notFound.name === 'NotFoundError';
+        }
+        let omittedSubmitterError;
+        try { new other.FormData(undefined, {}); }
+        catch (error) { omittedSubmitterError = error; }
+        checks.omittedFormStillConvertsSubmitter = omittedSubmitterError instanceof other.TypeError;
+        checks.noPublicReads = traps === 0 && tagReads === 0 && valueReads === 0;
+        other.document.adoptNode(form);
+        const adoptedData = new other.FormData(form);
+        checks.adoptedFormRealm = eventCount === 3 && eventRealm && eventTarget &&
+          Object.getPrototypeOf(adoptedData) === other.FormData.prototype &&
+          adoptedData.get('from-handler') === 'listener';
+        rows.push({label, checks});
+      } catch (error) { errors.push({label, message: String(error)}); }
+    }
+  }
+  globalThis.__uiEventResults = {r
```

**File**: `moli-renderer-v8/src/script_vm/tests/dom_elements/form_data_brands.rs` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+use super::*;
+
+#[tokio::test]
+async fn form_data_constructor_accepts_native_forms_across_document_realms() {
+    let loader = ResourceRequestClient::new(&moli_fetch::FetchConfig::default()).unwrap();
+    let mut vm = new_storage_page_task_executor_test_vm_with_loader(
+        "https://form-data-brands.test/",
+        &loader,
+    );
+    vm.eval(
+        r#"
+      if (!document.documentElement) document.appendChild(document.createElement('html'));
+      if (!document.body) document.documentElement.appendChild(document.createElement('body'));
+      const frame=document.body.appendChild(document.createElement('iframe'));
+      frame.id='child'; frame.srcdoc='<body></body>'; void frame.contentWindow;
+      'ready'
+    "#,
+    )
+    .unwrap();
+    assert!(
+        vm.run_one_child_frame_task_executor_turn(
+            ChildFrameSemanticTurnKind::RealmMaterialization,
+            &loader,
+        )
+        .await
+        .unwrap()
+    );
+    vm.drain_ready_page_task_executor_turns_for_setup(&loader, 128)
+        .await
+        .unwrap();
+    assert_eq!(vm.eval(include_str!("form_data_brands.js")).unwrap(), "true", "{}",
+        vm.eval("JSON.stringify({errors:__uiEventResults.errors,failures:__uiEventResults.rows.filter(row=>Object.values(row.checks).some(value=>value!==true))})").unwrap());
+}
```

**File**: `moli-renderer-v8/src/script_vm/tests/dom_elements/mod.rs` (modified, +1/-0)
```diff
@@ -5,6 +5,7 @@ mod custom_elements;
 mod detached;
 mod dom_surface;
 mod focus;
+mod form_data_brands;
 mod live_document;
 mod text_controls;
 mod wrapper_identity;
```

---

### Incident Patch 12: `ca54aa01` (2026-10-05)
**Commit Message**: fix(events): validate legacy MouseEvent initializer arguments

**File**: `moli-renderer-v8/src/context_bootstrap/event_legacy.rs` (modified, +12/-9)
```diff
@@ -1,4 +1,4 @@
-use super::events::reinitialize_event_object;
+use super::events::{EventTargetReference, WindowReference, reinitialize_event_object};
 use super::*;
 use crate::util::{context_host_ptr_from_window_object, throw_type_error};
 use crate::webidl;
@@ -93,8 +93,8 @@ struct InitMouseEventArgs<'s> {
     bubbles: bool,
     #[webidl(default = false)]
     cancelable: bool,
-    #[webidl(index = 3, converter = "raw")]
-    view: Option<v8::Local<'s, v8::Value>>,
+    #[webidl(index = 3, nullable, converter = "raw")]
+    view: Option<WindowReference<'s>>,
     #[webidl(default = 0, index = 4)]
     detail: i32,
     #[webidl(default = 0, index = 5)]
@@ -114,9 +114,9 @@ struct InitMouseEventArgs<'s> {
     #[webidl(default = false, index = 12)]
     meta_key: bool,
     #[webidl(default = 0, index = 13)]
-    button: i32,
-    #[webidl(index = 14, converter = "raw")]
-    related_target: Option<v8::Local<'s, v8::Value>>,
+    button: i16,
+    #[webidl(index = 14, nullable, converter = "raw")]
+    related_target: Option<EventTargetReference<'s>>,
 }
 
 #[derive(webidl::WebIdlArgs)]
@@ -223,7 +223,7 @@ struct LegacyMouseEventBaseInitDeclaration<'scope> {
     page_x: i32,
     #[webapi(constructor_default = client_y)]
     page_y: i32,
-    button: i32,
+    button: i16,
 }
 
 #[derive(WebApiObject)]
@@ -376,10 +376,13 @@ pub(super) fn mouse_event_init_callback<'s>(
     let Some(parsed) = webidl::parse_args::<InitMouseEventArgs>(scope, &args) else {
         return;
     };
-    let view = legacy_event_view_or_global(scope, parsed.view);
+    let view = parsed
+        .view
+        .map(WindowReference::into_value)
+        .unwrap_or_else(|| v8::null(scope).into());
     let related_target = parsed
         .related_target
-        .filter(|value| !value.is_null_or_undefined())
+        .map(EventTargetReference::into_value)
         .unwrap_or_else(|| v8::null(scope).into());
     if !reinitialize_event_object(
         scope,
```

**File**: `moli-renderer-v8/src/context_bootstrap/events.rs` (modified, +2/-0)
```diff
@@ -7,12 +7,14 @@ mod device;
 mod init;
 mod kind;
 mod methods;
+mod references;
 mod subclasses;
 mod submit;
 mod value;
 mod wrappers;
 
 pub(in crate::context_bootstrap) mod audio;
+pub(in crate::context_bootstrap) use references::{EventTargetReference, WindowReference};
 
 pub(in crate::context_bootstrap) use device::{
     device_motion_event_constructor, device_orientation_event_constructor,
```

**File**: `moli-renderer-v8/src/context_bootstrap/events/references.rs` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+use crate::context_bootstrap::is_window_receiver;
+use crate::web_api_interfaces;
+use crate::webidl;
+
+/// Window-valued event arguments and dictionary members share native identity.
+pub(in crate::context_bootstrap) struct WindowReference<'s>(v8::Local<'s, v8::Object>);
+
+impl<'s> WindowReference<'s> {
+    pub(in crate::context_bootstrap) fn into_value(self) -> v8::Local<'s, v8::Value> {
+        self.0.into()
+    }
+}
+
+impl<'s> webidl::WebIdlConverter<'s> for WindowReference<'s> {
+    type Options = ();
+
+    fn convert(
+        scope: &mut v8::PinScope<'s, '_>,
+        value: v8::Local<'s, v8::Value>,
+        context: webidl::Context,
+        _options: &Self::Options,
+    ) -> Result<Self, webidl::WebIdlError> {
+        if let Ok(window) = v8::Local::<v8::Object>::try_from(value)
+            && is_window_receiver(scope, window)
+        {
+            return Ok(Self(window));
+        }
+        Err(webidl::WebIdlError::cannot_convert(context, "Window"))
+    }
+}
+
+/// EventTarget conversion honors the brand layer's registered native proxies.
+pub(in crate::context_bootstrap) struct EventTargetReference<'s>(v8::Local<'s, v8::Object>);
+
+impl<'s> EventTargetReference<'s> {
+    pub(in crate::context_bootstrap) fn into_value(self) -> v8::Local<'s, v8::Value> {
+        self.0.into()
+    }
+}
+
+impl<'s> webidl::WebIdlConverter<'s> for EventTargetReference<'s> {
+    type Options = ();
+
+    fn convert(
+        scope: &mut v8::PinScope<'s, '_>,
+        value: v8::Local<'s, v8::Value>,
+        context: webidl::Context,
+        _options: &Self::Options,
+    ) -> Result<Self, webidl::WebIdlError> {
+        let target = webidl::convert::<v8::Local<'s, v8::Object>>(scope, value, context)?;
+        if !web_api_interfaces::EventTarget::is_instance(scope, target) {
+            return Err(webidl::WebIdlError::cannot_convert(context, "EventTarget"));
+        }
+        Ok(Self(target))
+    }
+}
```

**File**: `moli-renderer-v8/src/script_vm/tests/browser_api/legacy_event_init.rs` (modified, +40/-0)
```diff
@@ -11,3 +11,43 @@ fn legacy_event_initializers_preserve_creation_state_and_convert_before_dispatch
     );
     assert_eq!(result, "true");
 }
+
+#[test]
+fn legacy_mouse_initializer_converts_nullable_interfaces_and_short_before_mutation() {
+    let mut vm = new_parsed_test_vm(
+        "https://legacy-mouse-init.test/",
+        "<!doctype html><iframe id=child></iframe>",
+    );
+    vm.eval(
+        "globalThis.legacyMouseNativeRelatedTarget = document.implementation.createHTMLDocument('').createElement('select')",
+    )
+    .unwrap();
+    vm.with_default_context_scope_and_checkpoint_for_test(|scope, _host_ptr| {
+        let global = scope.get_current_context().global(scope);
+        let key = v8::String::new(scope, "legacyMouseNativeRelatedTarget").unwrap();
+        let value = global.get(scope, key.into()).unwrap();
+        assert!(value.is_proxy(), "fixture must exercise a native Proxy");
+        let object = v8::Local::<v8::Object>::try_from(value).unwrap();
+        assert!(crate::web_api_interfaces::EventTarget::is_instance(
+            scope, object
+        ));
+        Ok(())
+    })
+    .unwrap();
+    assert_eq!(
+        vm.eval(
+            "(() => { const event = new MouseEvent('before'); event.initMouseEvent('after', false, false, null, 0, 0, 0, 0, 0, false, false, false, false, 0, legacyMouseNativeRelatedTarget); return event.relatedTarget === legacyMouseNativeRelatedTarget; })()",
+        )
+        .unwrap(),
+        "true",
+    );
+    let result = vm
+        .eval(include_str!("legacy_mouse_event_init.js"))
+        .expect("legacy MouseEvent conversion matrix should execute");
+    if result != "true" {
+        let failures = vm
+            .eval("JSON.stringify(__uiEventResults.rows.filter(row => !row.passed))")
+            .expect("legacy MouseEvent failures should be available");
+        panic!("legacy MouseEvent conversion failures: {failures}");
+    }
+}
```

**File**: `moli-renderer-v8/src/script_vm/tests/browser_api/legacy_mouse_event_init.js` (added, +193/-0)
```diff
@@ -0,0 +1,193 @@
+(() => {
+  const rows = [];
+  const check = (name, passed) => rows.push({name, passed: !!passed});
+  const child = document.querySelector('#child').contentWindow;
+  const realms = [window, child];
+  const properties = ['type', 'bubbles', 'cancelable', 'composed', 'isTrusted',
+    'defaultPrevented', 'returnValue', 'cancelBubble', 'target', 'currentTarget',
+    'eventPhase', 'timeStamp', 'view', 'detail', 'screenX', 'screenY', 'clientX',
+    'clientY', 'button', 'buttons', 'relatedTarget', 'ctrlKey', 'altKey',
+    'shiftKey', 'metaKey', 'movementX', 'movementY'];
+  const snapshot = event => properties.map(name => event[name]);
+  const unchanged = (event, before) => snapshot(event).every((value, index) =>
+    Object.is(value, before[index]));
+  const caught = fn => { try { fn(); } catch (error) { return error; } };
+  const makers = ['MouseEvent', 'WheelEvent', 'PointerEvent', 'DragEvent', 'createEvent'];
+  const seed = realm => ({bubbles: false, cancelable: true, composed: true,
+    view: realm, detail: 7, screenX: 11, screenY: 12, clientX: 13, clientY: 14,
+    button: 2, buttons: 9, movementX: 21, movementY: 22, ctrlKey: true,
+    relatedTarget: realm.document.body});
+  for (let methodRealm = 0; methodRealm < realms.length; methodRealm++) {
+    const callee = realms[methodRealm];
+    const method = callee.MouseEvent.prototype.initMouseEvent;
+    for (let receiverRealm = 0; receiverRealm < realms.length; receiverRealm++) {
+      const realm = realms[receiverRealm];
+      const detached = realm.document.implementation.createHTMLDocument('');
+      const nativeProxy = detached.createElement('select');
+      for (const kind of makers) {
+        const prefix = `${methodRealm}/${receiverRealm}/${kind}: `;
+        const make = () => {
+          if (kind !== 'createEvent') return new realm[kind]('before', seed(realm));
+          const event = realm.document.createEvent('MouseEvents');
+          method.call(event, 'before', false, true, realm, 7, 11, 12, 13, 14,
+            true, false, false, false, 2, realm.document.body);
+          return event;
+        };
+        const args = (view = null, related = null, button = 0) =>
+          ['after', true, false, view, 3, 1, 2, 3, 4, false, true, true, false, button, related];
+        check(prefix + 'method metadata', method.length === 1 && method.name === 'initMouseEvent');
+        for (const [label, values] of [['omitted', ['after']],
+          ['undefined', ['after', undefined, undefined, undefined]],
+          ['null', ['after', false, false, null]]]) {
+          const event = make();
+          const stamp = event.timeStamp, composed = event.composed;
+          check(prefix + label + ' return', method.apply(event, values) === undefined);
+          check(prefix + label + ' nullable defaults', event.view === null &&
+            event.relatedTarget === null && event.detail === 0 && event.button === 0 &&
+            event.screenX === 0 && event.screenY === 0 && event.clientX === 0 && event.clientY === 0);
+          check(prefix + label + ' creation state', event.timeStamp === stamp && event.composed === composed);
+        }
+        for (let index = 0; index < realms.length; index++) {
+          const view = realms[index];
+          const event = make();
+          method.apply(event, args(view));
+          check(prefix + 'genuine Window ' + index, event.view === view && event.detail === 3);
+        }
+        const validTargets = [null, undefined, new realm.EventTarget(), realm,
+          realm.document, realm.document.body, realm.document.createTextNode('text'),
+          nativeProxy, child.document.body];
+        validTargets.forEach((target, index) => {
+          const event = make();
+          const values = args(); values[14] = target;
+          method.apply(event, values);
+          check(prefix + 'genuine relatedTarget ' + index,
+            event.relatedTarget === (target == null ? null : target));
+        });
+        for (const omitted of [undefined, null]) {
+          const event = make(), values = args(); values[14] = omitted;
+          method.apply(event, values);
+          check(prefix + 'nullable relatedTarget ' + String(omitted), event.relatedTarget === null);
+        }
+        let traps = 0;
+        const trap = {get() { traps++; throw new Error('author get trap'); },
+          getPrototypeOf() { traps++; throw new Error('author prototype trap'); }};
+        const revokedWindow = Proxy.revocable(realm, {}); revokedWindow.revoke();
+        const invalidViews = [{}, 1, 'window', true, Symbol('window'), 1n,
+          Object.create(realm.Window.prototype), Object.create(realm),
+          new Proxy(realm, trap), revokedWindow.proxy, realm.document];
+        invalidViews.forEach((view, index) => {
+          const event = make(); event.preventDefault(); event.stopPropagation();
+          const before = snapshot(event), order = [];
+          const values = args(view); va
```

---

### Incident Patch 13: `45d89eac` (2026-10-04)
**Commit Message**: fix(window): keep current events in private realm state

**File**: `moli-renderer-v8/src/callback_invocation.rs` (modified, +4/-6)
```diff
@@ -5,7 +5,7 @@ use crate::exception_reporting::{
 use crate::{
     host::WINDOW_EVENT_SLOT,
     native_bridge::{JsContextHost, RuntimeObservableContextToken, WindowExecutionContextIdentity},
-    util::v8str,
+    util::{get_private_value, set_private_value},
 };
 use moli_webidl_callback::{
     PreparedWebIdlCallbackFunction, PreparedWebIdlCallbackInterface, WebIdlCallbackInvocation,
@@ -244,11 +244,9 @@ impl CallbackInvoker {
                         .and(invocation.current_event)
                         .map(|event| {
                             let global = relevant_context.global(scope);
-                            let event_key = v8str(scope, WINDOW_EVENT_SLOT);
-                            let previous = global
-                                .get(scope, event_key.into())
+                            let previous = get_private_value(scope, global, WINDOW_EVENT_SLOT)
                                 .unwrap_or_else(|| v8::undefined(scope).into());
-                            let _ = global.set(scope, event_key.into(), event.into());
+                            set_private_value(scope, global, WINDOW_EVENT_SLOT, event.into());
                             previous
                         });
 
@@ -287,7 +285,7 @@ impl CallbackInvoker {
 
                 if let Some(previous) = previous_window_event {
                     let global = relevant_context.global(scope);
-                    let _ = global.set(scope, v8str(scope, WINDOW_EVENT_SLOT).into(), previous);
+                    set_private_value(scope, global, WINDOW_EVENT_SLOT, previous);
                 }
                 result
             },
```

**File**: `moli-renderer-v8/src/context_bootstrap/runtime_state.rs` (modified, +4/-4)
```diff
@@ -461,7 +461,7 @@ struct ConsoleObjectDeclaration {
 struct WindowBootstrapGlobalSlotsDeclaration<'scope> {
     #[webapi(slot = WINDOW_CONSOLE_SLOT)]
     console: v8::Local<'scope, v8::Object>,
-    #[webapi(data_property = WINDOW_EVENT_SLOT, init = "undefined")]
+    #[webapi(slot = WINDOW_EVENT_SLOT, init = "undefined")]
     event: (),
     #[webapi(data_property = WINDOW_ONERROR_SLOT, init = "null")]
     on_error: (),
@@ -581,7 +581,7 @@ fn document_fullscreen_enabled_lenient_setter<'s>(
 ) {
 }
 
-fn define_replaceable_window_property(
+pub(in crate::context_bootstrap) fn define_replaceable_window_property(
     scope: &mut v8::PinScope<'_, '_>,
     receiver: v8::Local<'_, v8::Object>,
     name: &'static str,
@@ -641,11 +641,11 @@ fn window_outer_height_replaceable_getter<'s>(
 
 fn window_event_replaceable_getter<'s>(
     scope: &mut v8::PinScope<'s, '_>,
-    _args: v8::FunctionCallbackArguments<'s>,
+    args: v8::FunctionCallbackArguments<'s>,
     mut rv: v8::ReturnValue<'s, v8::Value>,
 ) {
     rv.set(
-        global_hidden_value(scope, WINDOW_EVENT_SLOT)
+        super::window_events::window_event_value_for_receiver(scope, args.this())
             .unwrap_or_else(|| v8::undefined(scope).into()),
     );
 }
```

**File**: `moli-renderer-v8/src/context_bootstrap/window_events.rs` (modified, +4/-3)
```diff
@@ -89,9 +89,10 @@ pub(crate) use accessors::{
 };
 pub(super) use accessors::{
     window_console_getter, window_event_getter, window_event_setter,
-    window_onerror_getter_function, window_onerror_setter_function,
-    window_onrejectionhandled_getter_function, window_onrejectionhandled_setter_function,
-    window_onunhandledrejection_getter_function, window_onunhandledrejection_setter_function,
+    window_event_value_for_receiver, window_onerror_getter_function,
+    window_onerror_setter_function, window_onrejectionhandled_getter_function,
+    window_onrejectionhandled_setter_function, window_onunhandledrejection_getter_function,
+    window_onunhandledrejection_setter_function,
 };
 pub(super) use console::{
     console_assert_callback, console_debug_callback, console_error_callback,
```

**File**: `moli-renderer-v8/src/context_bootstrap/window_events/accessors.rs` (modified, +48/-4)
```diff
@@ -141,12 +141,53 @@ pub(in crate::context_bootstrap) fn window_event_getter<'s>(
     if !require_window_receiver(scope, &args) {
         return;
     }
-    match global_hidden_value(scope, WINDOW_EVENT_SLOT) {
+    match window_event_value_for_receiver(scope, args.this()) {
         Some(value) => rv.set(value),
         None => rv.set(v8::undefined(scope).into()),
     }
 }
 
+pub(in crate::context_bootstrap) fn window_event_value_for_receiver<'s>(
+    scope: &mut v8::PinScope<'s, '_>,
+    receiver: v8::Local<'s, v8::Object>,
+) -> Option<v8::Local<'s, v8::Value>> {
+    // Real globals keep the current event in their concrete callback realm.
+    // Resolving only the Document owner would read the default world's slot
+    // even when this receiver is an isolated world's Window.
+    if let Some(context) = receiver.get_creation_context(scope)
+        && receiver.strict_equals(context.global(scope).into())
+    {
+        return get_private_value(scope, receiver, WINDOW_EVENT_SLOT);
+    }
+    let target_event = context_host_ptr_from_window_object(scope, receiver)
+        .or_else(|| context_host_ptr_from_global_bridge(scope))
+        .and_then(|host_ptr| {
+            let dispatch_scope = if let Some(popup_id) =
+                crate::native_bridge::lightweight_popup_id_from_window(scope, receiver)
+            {
+                crate::native_bridge::OwnerDispatchScope::LightweightPopup(popup_id)
+            } else if let Some(handle) = window_child_context_handle(scope, receiver) {
+                crate::native_bridge::OwnerDispatchScope::Child(handle)
+            } else {
+                crate::native_bridge::OwnerDispatchScope::Top
+            };
+            let host = unsafe { &*host_ptr };
+            let owner = host.current_window_execution_context_owner(dispatch_scope)?;
+            let (_, context) = host.window_execution_context(scope, owner, dispatch_scope)?;
+            let global = context.global(scope);
+            // An empty target Window current event is still authoritative;
+            // do not fall back to the caller Window's active event.
+            Some(
+                get_private_value(scope, global, WINDOW_EVENT_SLOT)
+                    .unwrap_or_else(|| v8::undefined(scope).into()),
+            )
+        });
+    target_event.or_else(|| {
+        let global = scope.get_current_context().global(scope);
+        get_private_value(scope, global, WINDOW_EVENT_SLOT)
+    })
+}
+
 pub(in crate::context_bootstrap) fn window_event_setter<'s>(
     scope: &mut v8::PinScope<'s, '_>,
     args: v8::FunctionCallbackArguments<'s>,
@@ -155,9 +196,12 @@ pub(in crate::context_bootstrap) fn window_event_setter<'s>(
     if !require_window_receiver(scope, &args) {
         return;
     }
-    let global = scope.get_current_context().global(scope);
-    let key = v8str(scope, WINDOW_EVENT_SLOT);
-    let _ = global.set(scope, key.into(), args.get(0));
+    super::super::runtime_state::define_replaceable_window_property(
+        scope,
+        args.this(),
+        "event",
+        args.get(0),
+    );
     rv.set_undefined();
 }
 
```

**File**: `moli-renderer-v8/src/script_vm/tests/browser_api/mod.rs` (modified, +2/-0)
```diff
@@ -64,3 +64,5 @@ mod worker_listener_invocation;
 
 mod document_domain_lifetime;
 mod document_domain_setter;
+
+mod window_current_event_private;
```

**File**: `moli-renderer-v8/src/script_vm/tests/browser_api/window_current_event_private.js` (added, +117/-0)
```diff
@@ -0,0 +1,117 @@
+(() => {
+  const child = document.getElementById('child').contentWindow;
+  const frame = child.document.createElement('iframe');
+  child.document.body.appendChild(frame);
+  const realms = [['root', window], ['child', child], ['nested', frame.contentWindow]];
+  const descriptors = realms.map(([label, realm]) => ({label, realm,
+    descriptor: Object.getOwnPropertyDescriptor(realm, 'event')}));
+  const rows = [];
+  for (const {label, realm, descriptor} of descriptors) {
+    for (const mode of ['ordinary', 'overwrite', 'accessor', 'prototype']) {
+      const checks = [];
+      const check = (name, pass) => checks.push({name, pass: !!pass});
+      const oldName = '__moliWindowEvent';
+      const previousSlot = Object.getOwnPropertyDescriptor(realm, oldName);
+      const prototype = Object.getPrototypeOf(realm);
+      const previousPrototypeSlot = Object.getOwnPropertyDescriptor(prototype, oldName);
+      const previousError = realm.onerror;
+      const authorValue = {};
+      const publicValue = {};
+      let reads = 0, writes = 0, caught = 0;
+      const trace = [];
+      const read = () => descriptor.get.call(realm);
+      check('no internal own name', !Object.getOwnPropertyNames(realm).includes(oldName));
+      check('no internal reflected key', !Reflect.ownKeys(realm).includes(oldName));
+      check('public accessor', typeof descriptor.get === 'function' && typeof descriptor.set === 'function');
+      try {
+        const map = new realm.WeakMap();
+        for (const name of Object.getOwnPropertyNames(realm)) {
+          if (/[A-Z][A-Za-z0-9]+Event$/.test(name)) map.set(realm[name], name);
+        }
+        check('EventRecorder constructor scan', true);
+      } catch (error) { check('EventRecorder constructor scan', false); }
+      if (mode !== 'ordinary') {
+        delete realm[oldName];
+        if (mode === 'overwrite') Object.defineProperty(realm, oldName,
+          {value: authorValue, writable: true, configurable: true});
+        else Object.defineProperty(mode === 'prototype' ? prototype : realm, oldName,
+          {configurable: true, get() { reads++; return authorValue; }, set() { writes++; }});
+      }
+      const target = new realm.EventTarget();
+      const state = {read, check, target, trace, outer: null, replaced: false,
+        visible: () => realm.event, publicValue,
+        otherWindowsClear: () => descriptors.filter(d => d.realm !== realm)
+          .every(d => d.descriptor.get.call(d.realm) === undefined)};
+      const callbacks = realm.Function('s', `return {
+        outer(event) {
+          s.trace.push('outer'); s.outer = event;
+          s.check('outer current', s.read() === event);
+          s.check('other windows clear', s.otherWindowsClear());
+          s.check('outer public value', s.visible() === (s.replaced ? s.publicValue : event));
+          s.target.dispatchEvent(new Event('inner'));
+          s.check('outer restored', s.read() === event);
+          s.trace.push('restored');
+        },
+        inner(event) {
+          s.trace.push('inner');
+          s.check('inner current', s.read() === event && event !== s.outer);
+          s.check('inner other windows clear', s.otherWindowsClear());
+        },
+        object: { get handleEvent() {
+          s.trace.push('lookup'); s.check('current before handleEvent lookup', s.read()?.type === 'lookup');
+          return event => s.check('object callback current', s.read() === event);
+        } },
+        fail() { throw new Error('expected current-event probe failure'); },
+        report() {
+          s.trace.push('error');
+          s.check('exception report current', s.read()?.type === 'error');
+          return true;
+        }
+      }`)(state);
+      target.addEventListener('outer', callbacks.outer);
+      target.addEventListener('inner', callbacks.inner);
+      target.addEventListener('lookup', callbacks.object);
+      target.addEventListener('fail', callbacks.fail);
+      realm.onerror = callbacks.report;
+      try {
+        check('undefined before dispatch', read() === undefined);
+        target.dispatchEvent(new realm.Event('outer'));
+        check('undefined after nested dispatch', read() === undefined);
+        target.dispatchEvent(new realm.Event('lookup'));
+        check('undefined after object callback', read() === undefined);
+        target.dispatchEvent(new realm.Event('fail'));
+        check('undefined after exception reporting', read() === undefined);
+        realm.event = publicValue;
+        check('public Replaceable value', realm.event === publicValue);
+        check('replacement does not change native current event', read() === undefined);
+        const replacement = Object.getOwnPropertyDescriptor(realm, 'event');
+        check('Replaceable data descriptor', replacement.value === publicValue &&
+          replacement.writable && replacement.enumerable && replacement.configurable);
+        state.replaced = true;
+   
```

**File**: `moli-renderer-v8/src/script_vm/tests/browser_api/window_current_event_private.rs` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+use super::*;
+
+#[test]
+fn window_current_events_ignore_author_slot_names_and_public_replacements() {
+    let mut vm = new_storage_html_test_vm("https://private-window-event.test/");
+    vm.eval("document.body.innerHTML = '<iframe id=child></iframe>'; 'ready'")
+        .unwrap();
+    vm.eval(include_str!("window_current_event_private.js"))
+        .unwrap();
+    let facts: serde_json::Value =
+        serde_json::from_str(&vm.eval("JSON.stringify(__uiEventResults)").unwrap()).unwrap();
+    assert_eq!(facts["rows"].as_array().unwrap().len(), 12);
+    assert_eq!(facts["total"], 378);
+    assert_eq!(facts["complete"], true, "{facts}");
+}
+
+#[test]
+fn window_current_events_use_private_state_in_each_listener_world() {
+    let mut vm = new_storage_html_test_vm("https://private-window-event-worlds.test/");
+    vm.eval(
+        r#"
+        document.body.innerHTML = '<div id=target></div>';
+        globalThis.target = document.getElementById('target');
+        globalThis.facts = [];
+        Object.defineProperty(globalThis, '__moliWindowEvent', {
+            get() { throw new Error('author slot getter'); },
+            set() { throw new Error('author slot setter'); }
+        });
+        target.addEventListener('outer', event => {
+            facts.push(window.event === event);
+            target.dispatchEvent(new Event('inner'));
+            facts.push(window.event === event);
+        });
+        'ready'
+        "#,
+    )
+    .unwrap();
+    let isolated = vm
+        .create_isolated_world("private-current-event", false)
+        .unwrap();
+    vm.eval_in_isolated_context(
+        isolated,
+        r#"
+        globalThis.target = document.getElementById('target');
+        globalThis.facts = [];
+        Object.defineProperty(globalThis, '__moliWindowEvent', {
+            get() { throw new Error('isolated author slot getter'); },
+            set() { throw new Error('isolated author slot setter'); }
+        });
+        target.addEventListener('inner', event => {
+            facts.push(window.event === event);
+        });
+        'ready'
+        "#,
+    )
+    .unwrap();
+    assert_eq!(
+        vm.eval("target.dispatchEvent(new Event('outer')); JSON.stringify([facts, window.event === undefined])")
+            .unwrap(),
+        "[[true,true],true]"
+    );
+    assert_eq!(
+        vm.eval_in_isolated_context(
+            isolated,
+            "JSON.stringify([facts, window.event === undefined])"
+        )
+        .unwrap(),
+        "[[true],true]"
+    );
+}
```

---

### Incident Patch 14: `e790a88a` (2026-10-04)
**Commit Message**: test(target): heap-allocate background navigation fixtures

**File**: `moli-protocol/src/domains/target/tests/tests_background_staging.rs` (modified, +88/-80)
```diff
@@ -79,94 +79,102 @@ async fn loaded_page_html_for_test(ctx: &mut TestContext) -> String {
         .expect("loaded page should serialize HTML")
 }
 
-async fn load_same_context_loaded_background_runtime_owner_async(
-    ctx: &mut TestContext,
-    browser_context_id: &str,
-    active_target_id: &str,
-    active_html: &str,
-    background_url: &str,
+fn load_same_context_loaded_background_runtime_owner_async<'a>(
+    ctx: &'a mut TestContext,
+    browser_context_id: &'a str,
+    active_target_id: &'a str,
+    active_html: &'a str,
+    background_url: &'a str,
     command_id_base: u64,
-) -> LoadedBackgroundRuntimeOwner {
-    load_bc_with_titled_page_async(ctx, browser_context_id, active_target_id, active_html).await;
-    ctx.conn
-        .browser_context
-        .as_mut()
-        .unwrap()
-        .attach_active_session("SID-active");
+) -> impl std::future::Future<Output = LoadedBackgroundRuntimeOwner> + 'a {
+    // Keep the full navigation setup state on the heap instead of embedding it
+    // in every caller's future and its debug-build stack temporaries.
+    Box::pin(async move {
+        load_bc_with_titled_page_async(ctx, browser_context_id, active_target_id, active_html)
+            .await;
+        ctx.conn
+            .browser_context
+            .as_mut()
+            .unwrap()
+            .attach_active_session("SID-active");
 
-    ctx.process_async(json!({
-        "id": command_id_base,
-        "method": "Target.setAutoAttach",
-        "params": { "autoAttach": true, "waitForDebuggerOnStart": false }
-    }))
-    .await;
-    ctx.expect_result(command_id_base, json!({}), None);
+        ctx.process_async(json!({
+            "id": command_id_base,
+            "method": "Target.setAutoAttach",
+            "params": { "autoAttach": true, "waitForDebuggerOnStart": false }
+        }))
+        .await;
+        ctx.expect_result(command_id_base, json!({}), None);
 
-    ctx.process_async(json!({
-        "id": command_id_base + 1,
-        "method": "Target.createTarget",
-        "params": {
-            "background": true, "browserContextId": browser_context_id, "url": "about:blank#second"}
-    }))
-    .await;
-    let created = ctx.take_one();
-    assert_eq!(created["method"], "Target.targetCreated");
-    let second_target_id = created["params"]["targetInfo"]["targetId"]
-        .as_str()
-        .expect("second target id")
-        .to_owned();
-    let attached = ctx.take_one();
-    assert_eq!(attached["method"], "Target.attachedToTarget");
-    let second_session_id = attached["params"]["sessionId"]
-        .as_str()
-        .expect("second target session id")
-        .to_owned();
-    ctx.expect_result(
-        command_id_base + 1,
-        json!({ "targetId": second_target_id }),
-        None,
-    );
+        ctx.process_async(json!({
+            "id": command_id_base + 1,
+            "method": "Target.createTarget",
+            "params": {
+                "background": true,
+                "browserContextId": browser_context_id,
+                "url": "about:blank#second"
+            }
+        }))
+        .await;
+        let created = ctx.take_one();
+        assert_eq!(created["method"], "Target.targetCreated");
+        let second_target_id = created["params"]["targetInfo"]["targetId"]
+            .as_str()
+            .expect("second target id")
+            .to_owned();
+        let attached = ctx.take_one();
+        assert_eq!(attached["method"], "Target.attachedToTarget");
+        let second_session_id = attached["params"]["sessionId"]
+            .as_str()
+            .expect("second target session id")
+            .to_owned();
+        ctx.expect_result(
+            command_id_base + 1,
+            json!({ "targetId": second_target_id }),
+            None,
+        );
 
-    ctx.process_async(json!({
-        "id": command_id_base + 2,
-        "method": "Target.activateTarget",
-        "params": { "targetId": second_target_id }
-    }))
-    .await;
-    ctx.expect_result(command_id_base + 2, json!({}), None);
+        ctx.process_async(json!({
+            "id": command_id_base + 2,
+            "method": "Target.activateTarget",
+            "params": { "targetId": second_target_id }
+        }))
+        .await;
+        ctx.expect_result(command_id_base + 2, json!({}), None);
 
-    ctx.process_async(json!({
-        "id": command_id_base + 3,
-        "method": "Page.navigate",
-        "sessionId": second_session_id,
-        "params": { "url": background_url }
-    }))
-    .await;
-    let _ = take_response_by_id(ctx, command_id_base + 3);
-    ctx.take_all();
+        ctx.process_async(json!({
+            "id": command_id_base + 3,
+            "method": "Page.navigate",
+            "sessionId": second_session_id,
+            "params": { "url": background_url }
+        }))
+        .await;
+        let _ = take_response_by_id(ctx, command_id_base + 3);
+        ctx.take_all();
 
-    ctx.process_async(jso
```

---

### Incident Patch 15: `04184606` (2026-10-05)
**Commit Message**: fix(core): preserve newer Page state when commands settle out of order

Stamp every successful Page VM state capture with its VM creation identity
and capture sequence, including nested captures. Reject older revisions at
the shared Page cache installation point while preserving each query reply.

A real same-document regression holds two DOM snapshots and consumes them in
reverse order. Both return their captured titles, while the cached title
must remain the newer value.

**File**: `moli-core/src/page/page_state_cache.rs` (modified, +5/-1)
```diff
@@ -15,7 +15,11 @@ impl PageStateCache {
     }
 
     pub(super) fn replace(&mut self, state: Arc<RendererPageState>) {
-        self.state = state;
+        // Renderer completions retain their own frozen replies even when the
+        // caller consumes them after a newer capture of this Page.
+        if state.snapshot_revision >= self.state.snapshot_revision {
+            self.state = state;
+        }
     }
 
     pub(super) fn state(&self) -> &RendererPageState {
```

**File**: `moli-core/src/runtime/tests.rs` (modified, +1/-0)
```diff
@@ -4500,6 +4500,7 @@ async fn renderer_owner_remove_unknown_page_keeps_never_tracked_state() -> Resul
             vm_creation_id: 0,
             view_generation: 0,
             page_state: std::sync::Arc::new(crate::renderer::RendererPageState {
+                snapshot_revision: Default::default(),
                 requested_url: Url::parse("https://example.com/requested")?,
                 navigation_initiator_url: None,
                 navigation_redirected: false,
```

**File**: `moli-core/tests/dom_bridge.rs` (modified, +68/-0)
```diff
@@ -118,6 +118,74 @@ async fn builds_dom_structure_and_exposes_script_nodes() -> Result<()> {
     Ok(())
 }
 
+#[tokio::test]
+async fn finishing_older_document_snapshot_preserves_newer_cached_page_state() -> Result<()> {
+    let server = FixtureServer::spawn().await?;
+    let browser = Browser::new(AppConfig::default())?;
+    let mut page = browser.fetch(&server.url("/static")).await?;
+    let document_isolate_identity = page.document_isolate_identity_for_diagnostics();
+    let document_url = page.final_url().clone();
+    let attachment = page.renderer_agent_attachment_id();
+    assert_eq!(attachment, None);
+
+    page.evaluate_runtime_expression_async("document.title = 'older'")
+        .await?;
+    assert_eq!(page.document_title(), "older");
+    let older = page
+        .start_document_node_snapshot_for_document(None, true, -1, true)?
+        .wait()
+        .await?;
+    assert_eq!(older.renderer_agent_attachment_id(), attachment);
+
+    // Hold the frozen older completion while the renderer captures the newer
+    // title in the same document and attachment.
+    page.evaluate_runtime_expression_async("document.title = 'newer'")
+        .await?;
+    let newer = page
+        .start_document_node_snapshot_for_document(None, true, -1, true)?
+        .wait()
+        .await?;
+    assert_eq!(newer.renderer_agent_attachment_id(), attachment);
+    assert_eq!(page.renderer_agent_attachment_id(), attachment);
+    assert_eq!(
+        page.document_isolate_identity_for_diagnostics(),
+        document_isolate_identity
+    );
+    assert_eq!(page.final_url(), &document_url);
+
+    let newer = page
+        .finish_document_node_snapshot_for_document(newer)?
+        .context("newer document snapshot should exist")?;
+    let newer_title = find_snapshot_node(&newer.snapshot, &mut |node| node.local_name == "title")
+        .context("newer document snapshot should contain its title")?;
+    assert_eq!(newer_title.children.len(), 1);
+    assert_eq!(newer_title.children[0].node_value, "newer");
+    assert_eq!(page.document_title(), "newer");
+
+    let older = page
+        .finish_document_node_snapshot_for_document(older)?
+        .context("older document snapshot should exist")?;
+    let older_title = find_snapshot_node(&older.snapshot, &mut |node| node.local_name == "title")
+        .context("older document snapshot should contain its title")?;
+    assert_eq!(older_title.children.len(), 1);
+    assert_eq!(older_title.children[0].node_value, "older");
+    assert_eq!(older.snapshot.node_id, newer.snapshot.node_id);
+    assert_eq!(page.renderer_agent_attachment_id(), attachment);
+    assert_eq!(
+        page.document_isolate_identity_for_diagnostics(),
+        document_isolate_identity
+    );
+    assert_eq!(page.final_url(), &document_url);
+    assert_eq!(
+        page.document_title(),
+        "newer",
+        "finishing an older snapshot must not roll back the cached Page state"
+    );
+
+    server.shutdown().await;
+    Ok(())
+}
+
 #[tokio::test]
 async fn range_exposes_constructor_create_range_and_clone_contents_basics() -> Result<()> {
     let server = FixtureServer::spawn().await?;
```

**File**: `moli-renderer-v8/src/devtools/ingress/main.rs` (modified, +1/-0)
```diff
@@ -774,6 +774,7 @@ mod tests {
     fn page_state() -> Arc<RendererPageState> {
         let url = url::Url::parse("about:blank").expect("test URL");
         Arc::new(RendererPageState {
+            snapshot_revision: Default::default(),
             requested_url: url.clone(),
             navigation_initiator_url: None,
             navigation_redirected: false,
```

**File**: `moli-renderer-v8/src/lib.rs` (modified, +8/-7)
```diff
@@ -294,13 +294,14 @@ pub use runtime::{
     RendererPageDumpStripOptions, RendererPageHandle, RendererPageReplacementCommit,
     RendererPageReplacementError, RendererPageReplacementFailureDisposition,
     RendererPageReplacementReservationRequest, RendererPageReplacementTarget, RendererPageReply,
-    RendererPageReservationToken, RendererPageState, RendererPageTestingHandle, RendererPageView,
-    RendererPendingAuxiliaryPage, RendererPendingDownloadActivation,
-    RendererPendingDownloadResponse, RendererPendingFileChooserActivation,
-    RendererPendingJavaScriptDialog, RendererPendingPopupActivation,
-    RendererPendingSameDocumentNavigation, RendererPendingTopLevelHistoryTraversal,
-    RendererPendingWindowOpenEvent, RendererPerformanceMetricSnapshot,
-    RendererPointerEventProperties, RendererPopupActivationSource, RendererPopupDisposition,
+    RendererPageReservationToken, RendererPageState, RendererPageStateRevision,
+    RendererPageTestingHandle, RendererPageView, RendererPendingAuxiliaryPage,
+    RendererPendingDownloadActivation, RendererPendingDownloadResponse,
+    RendererPendingFileChooserActivation, RendererPendingJavaScriptDialog,
+    RendererPendingPopupActivation, RendererPendingSameDocumentNavigation,
+    RendererPendingTopLevelHistoryTraversal, RendererPendingWindowOpenEvent,
+    RendererPerformanceMetricSnapshot, RendererPointerEventProperties,
+    RendererPopupActivationSource, RendererPopupDisposition,
     RendererPreparedDocumentCommitConfiguration, RendererProtocolObservation,
     RendererReservedServiceWorkerClient, RendererResourceContentBody,
     RendererResourceSearchRequest, RendererResourceTextSearchOutcome,
```

**File**: `moli-renderer-v8/src/runtime/mod.rs` (modified, +1/-1)
```diff
@@ -328,7 +328,7 @@ pub use self::page_screenshot::{
 pub(super) use self::page_state::RendererPageEntry;
 pub use self::page_state::RendererPageRecord;
 pub(crate) use self::page_state::RendererPageSlotHandle;
-pub use self::page_state::RendererPageState;
+pub use self::page_state::{RendererPageState, RendererPageStateRevision};
 use self::page_surface::RendererPageTable;
 pub use self::page_surface::{
     CompletedWorkerRuntimeInspectorCommandDispatch, DevToolsSessionKey,
```

**File**: `moli-renderer-v8/src/runtime/page.rs` (modified, +3/-2)
```diff
@@ -20,8 +20,8 @@ use super::{
     RendererDocumentIsolateAccountingDiagnostics, RendererInspectorSessionRestoreSnapshot,
     RendererOwnerCommand, RendererOwnerHandle, RendererOwnerReply, RendererPageCreationArtifacts,
     RendererPageCreationDiagnostics, RendererPageHandle, RendererPageReservationToken,
-    RendererPageState, RendererPendingDownloadActivation, RendererPerformanceMetricSnapshot,
-    RendererReservedServiceWorkerClient,
+    RendererPageState, RendererPageStateRevision, RendererPendingDownloadActivation,
+    RendererPerformanceMetricSnapshot, RendererReservedServiceWorkerClient,
 };
 
 /// Optional document bootstrap inputs shared by HTML and streaming creation.
@@ -44,6 +44,7 @@ pub struct RendererDocumentOptions {
 }
 
 pub(crate) struct PageVmStateCapture {
+    pub(crate) snapshot_revision: RendererPageStateRevision,
     pub(crate) final_url: Url,
     pub(crate) document_title: String,
     pub(crate) document_activity: moli_page_types::DocumentActivity,
```

**File**: `moli-renderer-v8/src/runtime/page_state.rs` (modified, +23/-0)
```diff
@@ -1,5 +1,26 @@
 use super::*;
 
+/// Orders successful Page VM captures within one renderer owner.
+///
+/// The first component orders replacement VMs, while every successful capture
+/// advances the second component, including nested captures.
+/// Callers must establish common renderer ownership before comparing revisions;
+/// creation IDs from different renderer owners do not define an ordering.
+#[derive(Clone, Copy, Debug, Default, Eq, Ord, PartialEq, PartialOrd)]
+pub struct RendererPageStateRevision {
+    vm_creation_id: u64,
+    capture_sequence: u64,
+}
+
+impl RendererPageStateRevision {
+    pub(crate) fn new(vm_creation_id: u64, capture_sequence: u64) -> Self {
+        Self {
+            vm_creation_id,
+            capture_sequence,
+        }
+    }
+}
+
 #[derive(Debug, Clone)]
 pub struct RendererPageRecord {
     pub requested_url: Url,
@@ -9,6 +30,7 @@ pub struct RendererPageRecord {
 
 #[derive(Debug, Clone)]
 pub struct RendererPageState {
+    pub snapshot_revision: RendererPageStateRevision,
     pub requested_url: Url,
     pub navigation_initiator_url: Option<Url>,
     pub navigation_redirected: bool,
@@ -48,6 +70,7 @@ impl RendererPageState {
         }
 
         Arc::new(Self {
+            snapshot_revision: state_capture.snapshot_revision,
             requested_url,
             navigation_initiator_url,
             navigation_redirected,
```

#### Recent Merged Pull Requests:
- **PR #1217** (2026-10-06): perf(mem): fix unreleased v8::Context holders (@ldm0)
- **PR #1215** (2026-10-06): feat(webidl): derive native interface brand checks (@ldm0)
- **PR #1214** (2026-10-06): fix(svg): validate root factory receivers with native brands (@ldm0)
- **PR #1194** (2026-10-05): perf(dom): better inline script performance (@ldm0)
- **PR #1192** (2026-10-05): feat(playground): add native WebMCP demos (@ldm0)
- **PR #1191** (2026-10-05): chore(release): update verstion to 1.1.14 (@ldm0)
- **PR #1190** (2026-10-05): fix(forms): validate FormData native argument brands (@ldm0)
- **PR #1183** (2026-10-05): fix(events): validate legacy MouseEvent initializer arguments (@ldm0)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
