# Forensic Learning Record (Deep Inspection): HKUDS/Vibe-Trading

> **Canonical Artifact**: `07_PROJECT_LEARNING/hkuds-vibe-trading-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/HKUDS/Vibe-Trading](https://github.com/HKUDS/Vibe-Trading))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:50:40.034Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `HKUDS/Vibe-Trading`
- **Description**: "Vibe-Trading: Your Personal Trading Agent"
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 34812 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agent/cli/utils/__init__.py`
```
"""Small, pure helpers shared across CLI components.

Everything here is stateless and side-effect free — safe to import from any
module in ``agent/cli``. Larger or stateful helpers belong in their own module
(see ``cli/stream.py`` for the streaming renderer).
"""

from cli.utils.format import abbreviate_num, format_duration, format_tokens
from cli.utils.thinking_verbs import pick_thinking_verb

__all__ = [
    "abbreviate_num",
    "format_duration",
    "format_tokens",
    "pick_thinking_verb",
]

```

### Core Architecture Module: `agent/cli/utils/format.py`
```
"""Pure formatting helpers for the CLI surface.

These mirror the formatting conventions used in the web app (see
``frontend/src/lib/format.ts``) so a duration printed in the CLI reads the
same as one printed in the chat bubble:

* ``format_duration(ms_or_s)`` → ``"230ms" | "1.4s" | "4m 12s"``
* ``format_tokens(n)`` → ``"1.2k tokens" | "452 tokens"``
* ``abbreviate_num(n)`` → ``"$0.003" | "12.4M" | "452"``

All functions are pure and tolerate ``None`` / negative inputs so callers can
hand them raw counter values without pre-validation.
"""

from __future__ import annotations

from typing import Union

Number = Union[int, float]


# ---------------------------------------------------------------------------
# Duration
# ---------------------------------------------------------------------------


def format_duration(value: Number | None, *, unit: str = "ms") -> str:
    """Render a duration as a short, human-readable string.

    Args:
        value: Numeric duration. Treated as milliseconds by default — this
            matches the rest of the codebase (tool callbacks, ``elapsed_ms``
            in ``cli/_legacy.py``, the spinner clock). Pass ``unit="s"`` if
            you already have seconds.
        unit: Either ``"ms"`` (default) or ``"s"``.

    Returns:
        Compact label, e.g. ``"230ms"``, ``"1.4s"``, ``"2m 05s"``. ``None``
        and negative values render as ``"—"``.
    """

    if value is None:
        return "—"
    try:
        v = float(value)
    except (TypeError, ValueError):
        return "—"
    if v < 0:
        return "—"

    if unit == "s":
        seconds = v
    elif unit == "ms":
        seconds = v / 1000.0
    else:
        raise ValueError(f"unit must be 'ms' or 's', got {unit!r}")

    if seconds < 1.0:
        return f"{int(round(seconds * 1000))}ms"
    if seconds < 60:
        # 1.4s, 12.0s — keep one decimal to communicate sub-second jitter
        return f"{seconds:.1f}s"
    minutes, rem = divmod(int(round(seconds)), 60)
    if minutes < 60:
        return f"{minutes}m {rem:02d}s"
    hours, minutes = divmod(minutes, 60)
    return f"{hours}h {minutes:02d}m"


# ---------------------------------------------------------------------------
# Tokens
# ---------------------------------------------------------------------------


def format_tokens(count: Number | None) -> str:
    """Render a token count with a thousands-suffix.

    Args:
        count: Integer-ish token count. ``None`` / negatives → ``"0 tokens"``.

    Returns:
        E.g. ``"452 tokens"``, ``"1.2k tokens"``, ``"3.4M tokens"``.
    """

    if count is None:
        return "0 tokens"
    try:
        n = int(count)
    except (TypeError, ValueError):
        return "0 tokens"
    if n <= 0:
        return "0 tokens"

    if n < 1_000:
        return f"{n} tokens"
    if n < 1_000_000:
        return f"{n / 1_000:.1f}k tokens"
    if n < 1_000_000_000:
        return f"{n / 1_000_000:.1f}M tokens"
    return f"{n / 1_000_000_000:.1f}B tokens"


# ---------------------------------------------------------------------------
# Generic abbreviation (dollars / counts / sizes)
# ---------------------------------------------------------------------------


def abbreviate_num(value: Number | None, *, currency: str | None = None) -> str:
    """Abbreviate a number with magnitude suffix.

    Use this for status-bar numbers where horizontal space is scarce. Currency
    amounts under ``$1`` keep 3-decimal precision so per-call cost reads
    sensibly (e.g. ``$0.003``).

    Args:
        value: Raw number to abbreviate. ``None`` → ``"—"``.
        currency: Optional currency symbol prefix (e.g. ``"$"``). When set,
            small fractional values keep 3 decimals.

    Returns:
        Abbreviated string. Examples::

            abbreviate_num(452)          → "452"
            abbreviate_num(12_400)       → "12.4k"
            abbreviate_num(3_200_000)    → "3.2M"
            abbreviate_num(0.003, currency="$") → "$0.003"
            abbreviate_num(1.42,  currency="$") → "$1.42"
    """

    if value is None:
        return "—"
    try:
        n = float(value)
    except (TypeError, ValueError):
        return "—"

    prefix = currency or ""
    sign = "-" if n < 0 else ""
    n_abs = abs(n)

    if currency is not None and n_abs < 1.0:
        # 3 decimals communicates per-token / per-call cost precision
        return f"{sign}{prefix}{n_abs:.3f}"

    if n_abs < 1_000:
        if currency is not None or not float(n_abs).is_integer():
            return f"{sign}{prefix}{n_abs:.2f}".rstrip("0").rstrip(".")
        return f"{sign}{prefix}{int(n_abs)}"

    for unit, divisor in (("k", 1_000), ("M", 1_000_000), ("B", 1_000_000_000), ("T", 1_000_000_000_000)):
        if n_abs < divisor * 1_000:
            return f"{sign}{prefix}{n_abs / divisor:.1f}{unit}"

    return f"{sign}{prefix}{n_abs:.1e}"


__all__ = ["format_duration", "format_tokens", "abbreviate_num"]

```

### Core Architecture Module: `agent/cli/utils/thinking_verbs.py`
```
"""Random "thinking" verb for the streaming spinner.

The status bar shows a verb while the agent is generating to communicate that
work is happening even before the first token arrives. Borrowed from the
dexter CLI: the verb is rerolled per agent turn so the user perceives variety
across runs rather than a single hard-coded label.
"""

from __future__ import annotations

import random
from typing import Final, Tuple

THINKING_VERBS: Final[Tuple[str, ...]] = (
    "Pondering",
    "Analyzing",
    "Reasoning",
    "Investigating",
    "Synthesizing",
    "Cross-checking",
)


def pick_thinking_verb(*, seed: int | None = None) -> str:
    """Pick a random verb suffixed with an ellipsis.

    Args:
        seed: Optional deterministic seed (used by tests). When ``None`` the
            module-level :func:`random.choice` is used.

    Returns:
        ``"Pondering…"``, ``"Analyzing…"``, etc.
    """

    if seed is not None:
        rng = random.Random(seed)
        return f"{rng.choice(THINKING_VERBS)}…"
    return f"{random.choice(THINKING_VERBS)}…"


__all__ = ["pick_thinking_verb", "THINKING_VERBS"]

```

### Core Architecture Module: `agent/src/agent/loop.py`
```
"""AgentLoop: ReAct core loop.

Five-layer context management:
  Layer 1 (microcompact)     — prunes old tool results once under memory pressure
  Layer 2 (context_collapse) — folds long text blocks without LLM call (zero cost)
  Layer 3 (auto_compact)     — LLM structured summary with token-budget tail protection
  Layer 4 (compact tool)     — model explicitly calls the compact tool to trigger L3
  Layer 5 (iterative update) — Nth compression updates previous summary instead of starting fresh

Tool execution:
  - Read/write batching: consecutive readonly tools run in parallel via threads
"""

from __future__ import annotations

import concurrent.futures
import contextvars
import copy
import json
import logging
import queue
import sys
import threading
import time as _time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Mapping, Optional

from src.agent.context import ContextBuilder
from src.agent.grounding import GroundingLedger
from src.agent.grounding.release import MAX_GROUNDING_REVISIONS
from src.agent.memory import WorkspaceMemory
from src.agent.progress import HeartbeatTimer, ProgressEvent, _set_emitter
from src.agent.context_budget import (
    MIN_CONVERSATION_TOKENS,
    CompactionBudget,
    ContextMeter,
    is_context_overflow,
    parse_context_limit,
    resolve_window,
)
from src.agent.tool_progress import ToolProgress
from src.agent.tools import ToolRegistry
from src.agent.trace import TraceWriter
from src.core.state import RunStateStore
from src.goal.context import (
    format_goal_continuation_prompt,
    get_current_goal_context,
    goal_needs_continuation,
    goal_progress_tuple,
)
from src.providers.chat import ChatLLM, LLMRuntimeSnapshot, ProviderStreamError
from src.providers.session_context import bind_llm_session_id, reset_llm_session_id
from src.providers.content_filter import (
    CONTENT_FILTER_SKIP_MESSAGE,
    MAX_CONSECUTIVE_CONTENT_FILTER_SKIPS,
    compute_content_filter_warnings,
)
from src.config.accessor import get_env_config
from src.config.paths import get_runs_dir, get_sessions_dir
from src.tools.background_tools import get_background_manager
from src.config.limits import truncate_tool_result
from src.tools.redaction import redact_payload, redact_tool_result

RUNS_DIR = get_runs_dir()
SESSIONS_DIR = get_sessions_dir()
KEEP_RECENT = 3
LLM_USAGE_ARTIFACT = "llm_usage.json"

COLLAPSE_PRESERVE_RECENT = 6
COLLAPSE_TEXT_MIN = 2400
COLLAPSE_HEAD = 900
COLLAPSE_TAIL = 500

# The stub ``_fix_tool_pairs`` inserts for a call whose result a layer-3 fold
# consumed. The other "data is gone" placeholder is layer 1's cleared marker,
# which is not a constant — it embeds the original payload length, so it is
# built by ``_cleared_text`` and matched by ``_is_cleared``.
_STUB_RESULT_CONTENT = "[Result from earlier context — see summary above]"

TAIL_TOKEN_BUDGET = 20_000
SUMMARY_CHUNK_CHARS = 80_000

# An LLM may return a transient empty completion (no text, no tool calls);
# retry once with a nudge before failing the run on a second consecutive one.
MAX_CONSECUTIVE_EMPTY_RESPONSE_SKIPS = 1

# Compaction recovery is a bounded reliability aid, not an alternate research
# loop: a run restores at most this many lost readonly payloads from its replay
# cache. Past the cap a lost call runs again as it does without replay, so the
# model is never told to use a result it can no longer see, and a loop of
# identical re-runs still ends at the no-progress limit.
MAX_READONLY_REPLAY_RECOVERIES = 6


#: Test hook only: set it (monkeypatch) to run the three compaction layers on
#: the pre-2026-09-29 estimated-token thresholds. A real attribute on purpose:
#: while it was resolved lazily by the module ``__getattr__``, monkeypatch read
#: the lazy 40000 before patching and wrote it back as a real attribute on
#: undo, silently switching every later test in the process to the old path.
TOKEN_THRESHOLD: Optional[int] = None


def _override(name: str):
    """Return a monkeypatched module-level override if present."""
    mod = sys.modules.get(__name__)
    if mod is not None and name in mod.__dict__:
        return mod.__dict__[name]
    return None


def _token_threshold() -> int:
    ov = _override("TOKEN_THRESHOLD")
    if ov is not None:
        return ov
    from src.config.accessor import get_env_config
    return get_env_config().agent_tuning.token_threshold


def _heartbeat_interval_s() -> float:
    ov = _override("HEARTBEAT_INTERVAL_S")
    if ov is not None:
        return ov
    from src.config.accessor import get_env_config
    return get_env_config().agent_tuning.vt_heartbeat_interval_s


def _reasoning_delta_min_interval_s() -> float:
    ov = _override("REASONING_DELTA_MIN_INTERVAL_S")
    if ov is not None:
        return ov
    from src.config.accessor import get_env_config
    return get_env_config().agent_tuning.vt_reasoning_delta_min_interval_s


def _stream_retry_delay_s() -> float:
    ov = _override("STREAM_RETRY_DELAY_S")
    if ov is not None:
        return ov
    from src.config.accessor import get_env_config
    return get_env_config().agent_tuning.vt_stream_retry_delay_s


def _stream_retry_max_delay_s() -> float:
    ov = _override("STREAM_RETRY_MAX_DELAY_S")
    if ov is not None:
        return ov
    from src.config.accessor import get_env_config
    return get_env_config().agent_tuning.vt_stream_retry_max_delay_s


def _stream_retry_backoff_s(streak: int) -> float:
    """Return the capped exponential delay for the one-based failure streak.

    Doubles per consecutive retryable stream failure (1.0s, 2.0s, 4.0s, ...)
    so a sustained provider outage backs off instead of burning the retry
    budget at a constant cadence. The exponent is clamped at 62 (mirroring
    ``src/swarm/runtime.py``'s worker-level backoff) and the result is capped
    at ``_stream_retry_max_delay_s()``.

    Args:
        streak: Number of consecutive retryable stream failures including the
            current one; values below 1 are treated as 1.

    Returns:
        Seconds to sleep before the stream retry, never negative.
    """
    ceiling = min(
        _stream_retry_delay_s() * (2 ** min(max(streak, 1) - 1, 62)),
        _stream_retry_max_delay_s(),
    )
    return max(ceiling, 0.0)


def _tool_timeout_seconds() -> float:
    ov = _override("TOOL_TIMEOUT_SECONDS")
    if ov is not None:
        return ov
    from src.config.accessor import get_env_config
    return get_env_config().agent_tuning.vibe_trading_tool_timeout_seconds


def _llm_timeout_seconds() -> float:
    """Return the per-call LLM timeout in seconds (0/negative disables).

    A silent provider stall otherwise hangs the ReAct loop or the
    auto-compact summary call indefinitely - no chunk arrives, so the
    per-chunk cancel check never runs. Bounding the call lets the run fail
    (or degrade compaction) instead of freezing mid-task.
    """
    ov = _override("LLM_TIMEOUT_SECONDS")
    if ov is not None:
        return ov
    from src.config.accessor import get_env_config
    return get_env_config().agent_tuning.vibe_trading_llm_timeout_seconds


def _goal_max_continuations() -> int:
    ov = _override("GOAL_MAX_CONTINUATIONS")
    if ov is not None:
        return ov
    from src.config.accessor import get_env_config
    return get_env_config().agent_tuning.vibe_trading_goal_max_continuations


def _stall_timeout_seconds() -> float:
    """Return the run-stall watchdog timeout in seconds (0/negative disables).

    A run that makes no forward progress (no LLM completion, no tool result)
    for this long is treated as a zombie and failed explicitly with a clear
    reason instead of staying "running" forever with no state.json
    (recurring 2026-08 zombie runs). Heartbeats do NOT count as progress: a
    hung tool keeps emitting heartbeats, which is exactly the case the
    watchdog must catch.
    """
    ov = _override("STALL_TIMEOUT_SECONDS")
    if ov is not None:
        return ov
    from src.config.accessor import get_env_config
    return get_env_config().agent_tuning.vibe_trading_run_stall_timeout_seconds

logger = logging.getLogger(__name__)


def _coerce_usage_int(value: Any) -> int:
    """Coerce provider token counts to non-negative ints."""
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0


def _normalize_llm_usage(usage: Any) -> dict[str, int] | None:
    """Normalize provider-reported usage metadata without estimating tokens."""
    if usage is None:
        return None
    if not isinstance(usage, dict):
        try:
            usage = dict(usage)
        except (TypeError, ValueError):
            return None

    input_tokens = _coerce_usage_int(usage.get("input_tokens"))
    output_tokens = _coerce_usage_int(usage.get("output_tokens"))
    total_tokens = _coerce_usage_int(usage.get("total_tokens"))
    if total_tokens == 0 and (input_tokens or output_tokens):
        total_tokens = input_tokens + output_tokens
    if not (input_tokens or output_tokens or total_tokens):
        return None
    normalized: dict[str, int] = {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
    }
    details = usage.get("input_token_details")
    if isinstance(details, dict):
        if details.get("cache_read") is not None:
            normalized["cache_read_tokens"] = _coerce_usage_int(details["cache_read"])
        creation_keys = ("cache_creation", "ephemeral_5m_input_tokens", "ephemeral_1h_input_tokens")
        if any(details.get(key) is not None for key in creation_keys):
            normalized["cache_creation_tokens"] = sum(
                _coerce_usage_int(details.get(key)) for key in creation_keys
            )
    return normalized


def _new_llm_usage_summary(llm: Any) -> dict[str, Any]:
    """Create the run-scoped provider usage accumulator."""
    from src.config.accessor import get_env_config
    cfg = get_env_conf
```

### Core Architecture Module: `agent/src/api/attribution_core.py`
```
"""Pure computation core for the run attribution endpoint.

Builds the ``GET /runs/{run_id}/attribution`` payload exclusively from a run's
persisted artifacts (``equity.csv``, ``positions.csv``, ``ohlcv_<SYMBOL>.csv``,
``config.json``, ``metrics.csv``) — no market data is re-fetched. Every section
degrades independently: a missing artifact nulls its section and appends an
explanatory note instead of failing the request.

Mounted by ``attribution_routes.py``; kept in its own module so the route file
stays a thin registration slice.
"""

from __future__ import annotations

import csv
import json
import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Module constants (no magic numbers in the computation paths below)
# ---------------------------------------------------------------------------

#: Decimals every response float is rounded to, recursively.
_ATTRIBUTION_FLOAT_DECIMALS = 6
#: Maximum points per returned series; longer series are even-stride
#: downsampled with the last point always pinned.
_ATTRIBUTION_MAX_SERIES_POINTS = 500
#: Trailing window length (in bars) for rolling beta/alpha.
_ATTRIBUTION_ROLLING_WINDOW = 60
#: Minimum valid observations inside a rolling window for it to emit a point.
_ATTRIBUTION_MIN_ROLLING_OBS = 40
#: Minimum aligned observations for the full-sample factor regression.
_ATTRIBUTION_MIN_FACTOR_OBS = 10
#: Benchmark return variance below which the series is treated as constant.
_ATTRIBUTION_BENCHMARK_VARIANCE_FLOOR = 1e-16
#: Smallest positive cash weight reported as a Brinson cash row.
_ATTRIBUTION_CASH_WEIGHT_TOLERANCE = 1e-6
#: Smallest invested weight still reported in the invested/cash fallback.
_ATTRIBUTION_MIN_INVESTED_WEIGHT = 1e-9
#: Net asset-class weight below which asset-class Brinson degrades to the
#: invested/cash fallback instead of dividing by the class weight (a
#: market-neutral pair inside one class nets to zero and would crash).
_ATTRIBUTION_CLASS_WEIGHT_FLOOR = 1e-9
#: Annualization factor used when the run's interval is unknown.
_ATTRIBUTION_DEFAULT_BARS_PER_YEAR = 252

#: Bars per year by normalized (lower-cased) interval label.
_ATTRIBUTION_BARS_PER_YEAR_BY_INTERVAL = {
    "1d": 252,
    "d": 252,
    "daily": 252,
    "1w": 52,
    "1wk": 52,
    "w": 52,
    "weekly": 52,
    "1mo": 12,
    "mo": 12,
    "monthly": 12,
    "1h": 1638,
    "30m": 3276,
    "15m": 6552,
    "5m": 19656,
    "1m": 98280,
}


# ---------------------------------------------------------------------------
# Small shared helpers
# ---------------------------------------------------------------------------


def _attribution_finite_float(value: Any) -> Optional[float]:
    """Parse a finite float, returning ``None`` for invalid values."""
    try:
        parsed = float(value)
    except (TypeError, ValueError, OverflowError):
        return None
    return parsed if math.isfinite(parsed) else None


def _attribution_iso_dates(values: List[Any]) -> List[str]:
    """Normalize timestamp cells to ``YYYY-MM-DD`` date-part strings."""
    dates: List[str] = []
    for value in values:
        text = str(value or "").strip()
        for separator in ("T", " "):
            if separator in text:
                text = text.split(separator, 1)[0]
        dates.append(text)
    return dates


def _attribution_bars_per_year(interval: Any) -> int:
    """Infer the annualization factor from the run's bar interval label."""
    if not interval:
        return _ATTRIBUTION_DEFAULT_BARS_PER_YEAR
    label = str(interval).strip()
    # The runner's monthly token; lower-cased it would read as one minute.
    if label == "1M":
        return 12
    return _ATTRIBUTION_BARS_PER_YEAR_BY_INTERVAL.get(label.lower(), _ATTRIBUTION_DEFAULT_BARS_PER_YEAR)


def _attribution_downsample(
    rows: List[Dict[str, Any]], max_points: int = _ATTRIBUTION_MAX_SERIES_POINTS
) -> List[Dict[str, Any]]:
    """Even-stride downsample a series, always pinning the last point.

    Args:
        rows: Series points in chronological order.
        max_points: Maximum number of points to keep.

    Returns:
        The original list when within budget, otherwise every ``step``-th row
        with the final row replacing the last sampled index when needed.
    """
    count = len(rows)
    if count <= max_points or max_points <= 0:
        return rows
    step = -(-count // max_points)  # ceil division
    indices = list(range(0, count, step))
    if indices[-1] != count - 1:
        indices[-1] = count - 1
    return [rows[index] for index in indices]


def _attribution_round_values(value: Any, decimals: int = _ATTRIBUTION_FLOAT_DECIMALS) -> Any:
    """Recursively round every float in a JSON-ready structure."""
    if isinstance(value, float):
        return round(value, decimals)
    if isinstance(value, dict):
        return {key: _attribution_round_values(item, decimals) for key, item in value.items()}
    if isinstance(value, list):
        return [_attribution_round_values(item, decimals) for item in value]
    return value


def _attribution_read_csv(path: Path) -> Tuple[Optional[List[str]], List[Dict[str, str]]]:
    """Read a CSV into ``(fieldnames, rows)``, refusing symlinks.

    Returns ``(None, [])`` when the file is missing, a symlink, or unreadable.
    """
    try:
        if path.is_symlink() or not path.is_file():
            return None, []
        with path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            fieldnames = list(reader.fieldnames or [])
            rows = [dict(row) for row in reader]
        return fieldnames, rows
    except (OSError, UnicodeError, csv.Error):
        return None, []


def _attribution_load_json(path: Path) -> Optional[Dict[str, Any]]:
    """Load a JSON object from disk if present, not a symlink, and dict-shaped."""
    try:
        if path.is_symlink() or not path.is_file():
            return None
        payload = json.loads(path.read_text(encoding="utf-8"))
        return payload if isinstance(payload, dict) else None
    except (OSError, UnicodeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Artifact loading
# ---------------------------------------------------------------------------


def _attribution_load_equity(
    run_dir: Path,
) -> Tuple[Optional[List[str]], Optional[List[float]], Optional[List[float]], str]:
    """Load dates, portfolio returns, and benchmark equity from ``equity.csv``.

    Args:
        run_dir: Root directory of the run.

    Returns:
        ``(dates, portfolio_returns, benchmark_equity, benchmark_state)`` where
        ``benchmark_state`` is ``"ok"``, ``"missing"``, or ``"non_finite"``.
        Dates and returns are ``None`` when equity.csv itself is unreadable.
    """
    fieldnames, rows = _attribution_read_csv(run_dir / "artifacts" / "equity.csv")
    if fieldnames is None or not rows or "ret" not in fieldnames or "timestamp" not in fieldnames:
        return None, None, None, "missing"

    dates: List[str] = []
    portfolio_returns: List[float] = []
    benchmark_equity: List[float] = []
    has_benchmark_column = "benchmark_equity" in fieldnames
    benchmark_all_blank = True
    for row in rows:
        ret = _attribution_finite_float(row.get("ret"))
        if ret is None:
            continue
        dates.append(str(row.get("timestamp") or ""))
        portfolio_returns.append(ret)
        if has_benchmark_column:
            benchmark_value = _attribution_finite_float(row.get("benchmark_equity"))
            if benchmark_value is not None:
                benchmark_all_blank = False
                benchmark_equity.append(benchmark_value)
            else:
                benchmark_equity.append(float("nan"))

    if not portfolio_returns:
        return None, None, None, "missing"

    if not has_benchmark_column or benchmark_all_blank:
        return _attribution_iso_dates(dates), portfolio_returns, None, "missing"
    if any(math.isnan(value) for value in benchmark_equity):
        return _attribution_iso_dates(dates), portfolio_returns, None, "non_finite"
    return _attribution_iso_dates(dates), portfolio_returns, benchmark_equity, "ok"


def _attribution_benchmark_returns_from_equity(benchmark_equity: List[float]) -> Optional[List[float]]:
    """Convert a benchmark equity curve into daily returns.

    The first bar's return is defined as 0.0 (the curve's first value is the
    first observation, matching the ``pct_change().fillna(0)`` convention).
    """
    if len(benchmark_equity) < 2:
        return None
    returns = [0.0]
    for previous, current in zip(benchmark_equity[:-1], benchmark_equity[1:]):
        if previous <= 0.0:
            return None
        returns.append(current / previous - 1.0)
    return returns


def _attribution_symbol_is_path_safe(symbol: str) -> bool:
    """Reject symbols that could escape the artifacts directory when used in paths.

    Symbols come from ``positions.csv`` headers and ``config.json`` codes and
    are interpolated into ``ohlcv_<symbol>.csv`` file names, so path
    separators, ``..`` sequences, and NUL bytes must never reach the path join.
    """
    return (
        bool(symbol)
        and "\x00" not in symbol
        and "/" not in symbol
        and "\\" not in symbol
        and ".." not in symbol
    )


def _attribution_symbol_cumulative_return(run_dir: Path, symbol: str) -> Optional[float]:
    """Buy-and-hold close-to-close return for one symbol from its OHLCV artifact.

    Returns ``last_close / first_close - 1`` over the date-sorted rows, or
    ``None`` when the artifact is missing, too short, or starts non-positive.
    """
    if not _attribution_symbol_is_path_safe(symbol):
        return None
    fieldnames, rows = _attribution_read_csv(run_dir / "artifacts" / f"ohlcv_{symbol}.csv")
    if fieldnames
```

### Core Architecture Module: `agent/src/api/state.py`
```
"""Lazy-init service singletons shared by session, channel, and live routes."""

from __future__ import annotations

import os

from fastapi import HTTPException

from src.api._compat import host_attr as _host_attr, set_host_attr as _set_host_attr
from src.api.helpers import RUNS_DIR, SESSIONS_DIR
from src.config.accessor import get_env_config


# ============================================================================
# Global singletons
# ============================================================================

_session_service = None
_channel_runtime = None
_channel_bus = None
_channel_manager = None


# ============================================================================
# Lazy initializers
# ============================================================================


def _get_session_service():
    """Lazy-init session service when ENABLE_SESSION_RUNTIME=true."""
    global _session_service

    import sys as _sys
    _host = _sys.modules.get("api_server")
    if _host is not None and hasattr(_host, "_session_service"):
        host_val = getattr(_host, "_session_service")
        if host_val is not None:
            return host_val
    elif _session_service is not None:
        return _session_service

    if not get_env_config().api.enable_session_runtime:
        return None

    import asyncio

    from src.session.events import EventBus
    from src.session.service import SessionService
    from src.session.store import SessionStore

    # Honor monkeypatched SESSIONS_DIR / RUNS_DIR on api_server.
    sessions_dir = _host_attr("SESSIONS_DIR", SESSIONS_DIR)
    runs_dir = _host_attr("RUNS_DIR", RUNS_DIR)

    store = SessionStore(base_dir=sessions_dir)
    event_bus = EventBus()

    try:
        loop = asyncio.get_event_loop()
        event_bus.set_loop(loop)
    except RuntimeError:
        pass

    _session_service = SessionService(
        store=store,
        event_bus=event_bus,
        runs_dir=runs_dir,
    )
    _set_host_attr("_session_service", _session_service)
    _attach_delivery_listener(event_bus)
    return _session_service


#: Terminal attempt events a finished scheduled briefing can follow.
_DELIVERY_TRIGGER_EVENTS = frozenset(
    {"attempt.completed", "attempt.failed", "attempt.cancelled"}
)


def _attach_delivery_listener(event_bus) -> None:
    """Let a finished run push its briefing without waiting for the next tick.

    The listener only *asks* for a sweep. Delivery correctness lives in the
    periodic sweep and the persisted outbox row; this is latency, and it is
    written so that failing to fire costs nothing but the wait.

    Args:
        event_bus: The session event bus to listen on.
    """

    def _on_event(event) -> None:
        if event.event_type not in _DELIVERY_TRIGGER_EVENTS:
            return
        from src.api.scheduled_routes import _get_scheduled_research_executor

        _get_scheduled_research_executor().request_sweep()

    event_bus.add_listener(_on_event)


def _get_channel_runtime():
    """Lazy-init IM channel runtime without starting platform adapters."""
    global _channel_runtime, _channel_bus, _channel_manager

    import sys as _sys
    _host = _sys.modules.get("api_server")
    if _host is not None and hasattr(_host, "_channel_runtime"):
        host_rt = getattr(_host, "_channel_runtime")
        if host_rt is not None:
            return host_rt
    elif _channel_runtime is not None:
        return _channel_runtime

    from src.channels.bus.queue import MessageBus
    from src.channels.config import load_channels_config
    from src.channels.manager import ChannelManager
    from src.channels.runtime import ChannelRuntime

    svc = _get_session_service()
    if not svc:
        raise HTTPException(status_code=501, detail="Session runtime not enabled")

    _channel_bus = MessageBus()
    config = load_channels_config()
    _channel_manager = ChannelManager(config, _channel_bus, session_service=svc)
    global_operators, channel_operators = ChannelRuntime.operators_from_config(config)
    _channel_runtime = ChannelRuntime(
        bus=_channel_bus,
        session_service=svc,
        manager=_channel_manager,
        reply_timeout_s=config["reply_timeout_s"],
        operators=global_operators,
        channel_operators=channel_operators,
    )
    _set_host_attr("_channel_runtime", _channel_runtime)
    _set_host_attr("_channel_bus", _channel_bus)
    _set_host_attr("_channel_manager", _channel_manager)
    return _channel_runtime


def reset_channel_runtime() -> None:
    """Drop the cached IM channel runtime so the next access rebuilds from disk.

    ``_get_channel_runtime`` caches its singletons in this module's globals
    *and* on the ``api_server`` host attrs; clearing both — with ``None``,
    which is what makes the next call rebuild — is what lets an edited channel
    config apply without a process restart.
    """
    global _channel_runtime, _channel_bus, _channel_manager

    _channel_runtime = None
    _channel_bus = None
    _channel_manager = None
    _set_host_attr("_channel_runtime", None)
    _set_host_attr("_channel_bus", None)
    _set_host_attr("_channel_manager", None)

```

### Core Architecture Module: `agent/src/channels/bus/queue.py`
```
"""Async message queue for decoupled channel-agent communication."""

import asyncio

from src.channels.bus.events import InboundMessage, OutboundMessage


class MessageBus:
    """Async message bus that decouples chat channels from the agent core.

    Channels push messages to the inbound queue, and the agent processes
    them and pushes responses to the outbound queue.
    """

    def __init__(self) -> None:
        self.inbound: asyncio.Queue[InboundMessage] = asyncio.Queue()
        self.outbound: asyncio.Queue[OutboundMessage] = asyncio.Queue()

    async def publish_inbound(self, msg: InboundMessage) -> None:
        """Publish a message from a channel to the agent."""
        await self.inbound.put(msg)

    async def consume_inbound(self) -> InboundMessage:
        """Consume the next inbound message (blocks until available)."""
        return await self.inbound.get()

    async def publish_outbound(self, msg: OutboundMessage) -> None:
        """Publish a response from the agent to channels."""
        await self.outbound.put(msg)

    async def consume_outbound(self) -> OutboundMessage:
        """Consume the next outbound message (blocks until available)."""
        return await self.outbound.get()

    @property
    def inbound_size(self) -> int:
        """Number of pending inbound messages."""
        return self.inbound.qsize()

    @property
    def outbound_size(self) -> int:
        """Number of pending outbound messages."""
        return self.outbound.qsize()

```

### Core Architecture Module: `agent/src/channels/utils.py`
```
"""Utility helpers for channel adapters."""

from __future__ import annotations

import ipaddress
import logging
import re
import socket
import ssl
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from src.config.paths import get_data_dir

logger = logging.getLogger(__name__)

_UNSAFE_CHARS = re.compile(r"[/\\:*?\"<>|]")

# Static client identification for the RFC 2971 IMAP ``ID`` command. NetEase
# mailboxes (163/126/yeah.net) accept ``LOGIN`` but reject the first ``SELECT``
# with ``Unsafe Login`` unless the client has identified itself; other servers
# accept or ignore ``ID``. No user data or secrets are sent.
_IMAP_CLIENT_ID = '("name" "vibe-trading" "version" "1.0" "vendor" "HKUDS")'


def get_media_dir(channel_name: str) -> Path:
    """Return a media directory for *channel_name* under the VT uploads root.

    Inbound media must land inside ``~/.vibe-trading/uploads`` — one of the
    default allowed file roots — so the agent's file-reading tools can open
    what users send over IM channels without extra configuration (#465).
    """
    p = get_data_dir() / "uploads" / channel_name
    p.mkdir(parents=True, exist_ok=True)
    return p


def get_runtime_subdir(name: str) -> Path:
    """Return a runtime subdirectory for *name* under the VT data dir."""
    p = get_data_dir() / "runtime" / name
    p.mkdir(parents=True, exist_ok=True)
    return p


def validate_resolved_url(url: str, *, allow_loopback: bool = False) -> tuple[bool, str]:
    """Validate a URL then resolve and check its IP addresses.

    Thin wrapper around :func:`validate_url_target` for callers that want
    the same behavior under a legacy name.
    """
    return validate_url_target(url, allow_loopback=allow_loopback)


def is_path_within(path: str | Path, root: str | Path) -> bool:
    """Check whether *path* resides within *root* directory."""
    try:
        Path(path).resolve().relative_to(Path(root).resolve())
        return True
    except ValueError:
        return False


def split_message(content: str, max_len: int = 2000) -> list[str]:
    """Split content into chunks within max_len, preferring line breaks.

    Args:
        content: The text content to split.
        max_len: Maximum length per chunk (default 2000 for Discord compatibility).

    Returns:
        List of message chunks, each within max_len.
    """
    if not content:
        return []
    # Non-positive max_len cannot advance the cut pointer; return unsplit.
    if max_len <= 0:
        return [content]
    if len(content) <= max_len:
        return [content]
    chunks: list[str] = []
    while content:
        if len(content) <= max_len:
            chunks.append(content)
            break
        cut = content[:max_len]
        # Try to break at newline first, then space, then hard break
        pos = cut.rfind("\n")
        if pos <= 0:
            pos = cut.rfind(" ")
        if pos <= 0:
            pos = max_len
        chunks.append(content[:pos])
        # Drop only the separator we broke on. A blanket lstrip() also ate
        # indentation on the next line (code blocks / nested markdown).
        rest = content[pos:]
        if rest.startswith("\n") or rest.startswith(" "):
            rest = rest[1:]
        content = rest
    return chunks


def safe_filename(name: str) -> str:
    """Replace unsafe path characters with underscores."""
    return _UNSAFE_CHARS.sub("_", name).strip()


def send_imap_id(client: Any) -> None:
    """Send a best-effort RFC 2971 IMAP ``ID`` command; never raises.

    NetEase mailboxes (163/126/yeah.net) accept ``LOGIN`` but reject the
    first ``SELECT`` with ``Unsafe Login`` unless the client has sent an
    ``ID`` command identifying itself. Sending ``ID`` is harmless for
    servers that support it and ignored by those that do not, so this is
    best-effort: any failure (unsupported command, closed socket) is
    swallowed and the caller proceeds to ``SELECT`` regardless.

    Args:
        client: A connected, logged-in ``imaplib.IMAP4`` or ``IMAP4_SSL``.
    """
    try:
        client.xatom("ID", _IMAP_CLIENT_ID)
    except Exception:  # noqa: BLE001 - best-effort; never block the connection
        logger.debug("IMAP ID command failed (non-fatal)", exc_info=True)


def email_tls_context(verify: bool) -> ssl.SSLContext:
    """Return the TLS context for every email connection, implicit SSL or STARTTLS.

    ``verify=True`` (the default) verifies the server certificate and hostname
    against the system CA bundle, so a credential is never sent to an
    unverified server. ``verify=False`` disables verification — an explicit,
    documented opt-out for self-signed or internal-CA mail servers that trades
    MITM protection for connectivity. IMAP and SMTP, implicit SSL and STARTTLS,
    all take their context here, so ``verify_tls`` is one switch for all four.
    """
    if verify:
        return ssl.create_default_context()
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    # check_hostname must be cleared before CERT_NONE or Python raises ValueError.
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def validate_url_target(url: str, *, allow_loopback: bool = False) -> tuple[bool, str]:
    """Validate a URL is safe to fetch: scheme, hostname, and resolved IPs.

    ``allow_loopback`` is intentionally narrow: it only permits literal
    loopback hosts (localhost, 127.0.0.0/8, ::1) when every resolved address is
    loopback. It does not allow RFC1918, link-local, metadata, or public DNS
    names that happen to resolve to loopback.

    Returns (ok, error_message).  When ok is True, error_message is empty.
    """
    try:
        p = urlparse(url)
    except Exception as e:
        return False, str(e)

    if p.scheme not in ("http", "https"):
        return False, f"Only http/https allowed, got '{p.scheme or 'none'}'"
    if not p.netloc:
        return False, "Missing domain"

    hostname = p.hostname
    if not hostname:
        return False, "Missing hostname"

    try:
        infos = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
    except socket.gaierror:
        return False, f"Cannot resolve hostname: {hostname}"

    addrs: list[ipaddress.IPv4Address | ipaddress.IPv6Address] = []
    for info in infos:
        try:
            addr = ipaddress.ip_address(info[4][0])
        except ValueError:
            continue
        addrs.append(addr)

    if allow_loopback and _is_allowed_loopback_target(hostname, addrs):
        return True, ""

    for addr in addrs:
        if _is_private(addr):
            return False, f"Blocked: {hostname} resolves to private/internal address {addr}"

    return True, ""


def _is_allowed_loopback_target(
    hostname: str,
    addrs: list[ipaddress.IPv4Address | ipaddress.IPv6Address],
) -> bool:
    """Check that *hostname* is a literal loopback host and every addr is loopback."""
    if hostname.lower() not in ("localhost", "localhost."):
        # Check for literal "127.x.y.z" or "[::1]"
        is_loopback_literal = False
        for addr in addrs:
            if addr.is_loopback:
                is_loopback_literal = True
            else:
                return False
        return is_loopback_literal
    return all(addr.is_loopback for addr in addrs) if addrs else False


def _is_private(addr: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """Check whether *addr* is non-globally-routable (private/internal/mesh).

    ``addr.is_global`` is False for loopback, link-local, RFC 1918 private,
    unspecified, reserved, and RFC 6598 shared address space
    (``100.64.0.0/10`` — the default Tailscale/mesh range). The previous
    explicit ``is_loopback | is_link_local | is_private`` checks missed the
    100.64/10 block (``is_private`` is False for it), letting CGNAT/mesh hosts
    slip past ``validate_url_target`` and be fetched as channel media. Using
    ``not addr.is_global`` blocks every non-globally-routable range uniformly.
    Multicast is added explicitly because ``is_global`` is True for multicast
    addresses (both ``224.0.0.0/4`` and ``ff00::/8``); the old code only caught
    IPv6 multicast, so this also closes an IPv4-multicast gap and matches
    ``web_reader_tool._url_allowed``.

    Loopback is still permitted when ``validate_url_target(allow_loopback=True)``
    is called — that allowance is evaluated before this function runs.
    """
    return not addr.is_global or addr.is_multicast

```

### Core Architecture Module: `agent/src/channelsui/http_utils.py`
```
"""HTTP helpers for the WebSocket channel."""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlsplit

from src.channels.utils import validate_url_target


_LONG_LIVED_TIMEOUT = 300  # seconds for long-lived HTTP connections


def normalize_config_path(path: str | Path) -> str:
    """Normalize an HTTP/WebSocket route path.

    Args:
        path: Path-like route value.

    Returns:
        A leading-slash route without a trailing slash, except for ``"/"``.
    """
    value = str(path).strip() or "/"
    if not value.startswith("/"):
        value = f"/{value}"
    while "//" in value:
        value = value.replace("//", "/")
    if len(value) > 1:
        value = value.rstrip("/")
    return value or "/"


def parse_request_path(path: str) -> tuple[str, dict[str, list[str]]]:
    """Parse an HTTP request path into ``(route_path, query)``."""
    parts = urlsplit(path or "/")
    return normalize_config_path(parts.path or "/"), parse_qs(parts.query, keep_blank_values=True)


def query_first(qs: dict[str, list[str]], key: str) -> str | None:
    """Return the first value for *key* in a query string dict."""
    values = qs.get(key, [])
    return values[0] if values else None


def parse_and_validate_url(url: str, *, allow_loopback: bool = False) -> tuple[bool, str]:
    """Validate a URL target before a channel-side fetch."""
    return validate_url_target(url, allow_loopback=allow_loopback)


async def read_uploaded_file(*args: Any, **kwargs: Any) -> bytes:
    """Read bytes from a file-like upload object.

    The helper accepts common async/sync file objects used by lightweight HTTP
    adapters. It is intentionally conservative and only returns raw bytes.
    """
    del kwargs
    if not args:
        return b""
    obj = args[0]
    if isinstance(obj, bytes):
        return obj
    if isinstance(obj, bytearray):
        return bytes(obj)
    read = getattr(obj, "read", None)
    if read is None:
        raise TypeError("upload object does not provide read()")
    result = read()
    if asyncio.iscoroutine(result):
        result = await result
    if isinstance(result, str):
        return result.encode("utf-8")
    if isinstance(result, bytes):
        return result
    if isinstance(result, bytearray):
        return bytes(result)
    raise TypeError("upload read() did not return bytes")

```

### Core Architecture Module: `agent/src/core/__init__.py`
```
"""Core module: Runner + RunStateStore."""

```

### Core Architecture Module: `agent/src/core/runner.py`
```
"""Runner module for executing generated backtest code and collecting artifacts."""

from __future__ import annotations

import json
import logging
import math
import os
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

from rich.console import Console

try:  # POSIX-only; absent on Windows
    import resource
except ImportError:  # pragma: no cover - Windows
    resource = None  # type: ignore[assignment]

try:  # POSIX-only; absent on Windows
    import pwd
except ImportError:  # pragma: no cover - Windows
    pwd = None  # type: ignore[assignment]


console = Console(stderr=True)
logger = logging.getLogger(__name__)

# --- Sandbox subprocess hardening (VT-001 defense-in-depth) ---------------
# These layers only bite inside the hardened Docker deployment; everywhere else
# (bare pip install, local dev, CI, non-Linux) they detect the missing
# precondition and degrade to the previous behaviour with a WARNING. The
# always-on control for VT-001 is the AST scrubber in backtest/runner.py, not
# any of this.
_SANDBOX_USER = "vibe-sandbox"
# The only paths under ~/.vibe-trading re-exposed into the ephemeral sandbox
# HOME. Data loaders that run in the same subprocess resolve these via
# Path.home(); everything else in the real home (.env, sessions.db, memory/,
# live/ mandate+audit ledger, shadow_*, dotfiles) stays unreadable to generated
# strategy code — that broad read access was the VT-001 exposure.
_SANDBOX_HOME_REEXPOSE = ("cache", "data-bridge", "qveris.json")
# RLIMIT_AS caps *virtual* address space (mmap included). numpy/BLAS reserve
# multi-GB virtual regions that are never resident, so a 2 GB cap spuriously
# OOMs legitimate backtests; 4 GB keeps a DoS ceiling without false failures.
# Operator-tunable for large minute-level runs.
_DEFAULT_RLIMIT_AS_MB = 4096
_SANDBOX_RLIMIT_AS_MB_ENV = "VIBE_TRADING_SANDBOX_RLIMIT_AS_MB"
_SANDBOX_RLIMIT_NOFILE = 512


def _resolve_sandbox_credentials() -> tuple[str, str] | None:
    """Return ``(user, group)`` for the privilege-dropped subprocess, else None.

    None (run without a UID drop) is returned whenever the ``vibe-sandbox``
    account is absent or the platform has no ``pwd`` module — i.e. every
    environment except the hardened Docker image that pre-creates the account and
    is granted CAP_SETUID/CAP_SETGID. A user that exists but cannot actually be
    dropped to (no capability) is handled at the ``subprocess.run`` call site.
    """
    if pwd is None:
        return None
    try:
        pwd.getpwnam(_SANDBOX_USER)
    except (KeyError, OSError):
        return None
    return (_SANDBOX_USER, _SANDBOX_USER)


def _rlimit_as_bytes() -> int:
    """Return the configured RLIMIT_AS ceiling in bytes."""
    raw = os.environ.get(_SANDBOX_RLIMIT_AS_MB_ENV, "")  # noqa: env-gate — sandbox rlimit tuning, not app config
    try:
        mb = int(raw) if raw.strip() else _DEFAULT_RLIMIT_AS_MB
    except ValueError:
        mb = _DEFAULT_RLIMIT_AS_MB
    if mb <= 0:
        mb = _DEFAULT_RLIMIT_AS_MB
    return mb * 1024 * 1024


# Applied by the freshly-exec'd child, NOT by a ``preexec_fn``. ``preexec_fn``
# runs Python bytecode between fork() and exec(); when the parent is
# multi-threaded — which ``vibe-trading serve`` always is (uvicorn workers plus
# the background agent loops) — that is undefined behaviour per POSIX and
# CPython documents it as unsafe. On aarch64/glibc 2.34 it reliably SIGSEGVs the
# child, so every backtest launched from the Web UI died before exec (#1355).
# Running the same setrlimit calls after exec, in a single-threaded interpreter,
# is safe on every platform and keeps the identical ceiling.
#
# argv contract: ``python -c BOOTSTRAP <as_bytes> <nofile> <entry> [args...]``.
_SANDBOX_RLIMIT_BOOTSTRAP = """\
import os, runpy, sys
_as_bytes, _nofile = int(sys.argv[1]), int(sys.argv[2])
sys.argv = sys.argv[3:]
try:
    import resource
except ImportError:
    resource = None
if resource is not None:
    for _res, _target in (
        (resource.RLIMIT_AS, _as_bytes),
        (resource.RLIMIT_NOFILE, _nofile),
    ):
        try:
            _soft, _hard = resource.getrlimit(_res)
            _new_hard = _target if _hard == resource.RLIM_INFINITY else min(_target, _hard)
            resource.setrlimit(_res, (min(_target, _new_hard), _new_hard))
        except (ValueError, OSError):
            pass
sys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[0])))
runpy.run_path(sys.argv[0], run_name="__main__")
"""


def _rlimit_bootstrap_argv() -> list[str] | None:
    """Return the ``-c`` bootstrap argv prefix that caps address space + fds.

    Returns None on Windows (no ``resource`` module), where the caller runs the
    entry script directly and no ceiling is applied — unchanged from before.

    The two limits are resolved in the parent and passed as literal argv values
    so the env parsing keeps a single source of truth (``_rlimit_as_bytes``).
    The bootstrap lowers limits best-effort: a hardened parent limit already
    below the target is never raised, and it runs after any UID drop, where
    lowering is always permitted for an unprivileged process. It then puts the
    entry script's own directory on sys.path, which ``python script.py`` does
    for free and ``python -c`` does not; the cwd entry ``-c`` leaves behind is
    harmless because execute() already exports an explicit cwd on PYTHONPATH.

    Returns:
        ``["-c", <bootstrap>, <as_bytes>, <nofile>]`` on POSIX, else None.
    """
    if resource is None:
        return None
    return [
        "-c",
        _SANDBOX_RLIMIT_BOOTSTRAP,
        str(_rlimit_as_bytes()),
        str(_SANDBOX_RLIMIT_NOFILE),
    ]


def _reexpose_mt5_config(src_root: Path, dst_root: Path) -> None:
    """Write a credential-free subset of the host's ``mt5.json`` into the sandbox.

    The full connector config carries broker ``login``/``password``/``server``,
    which strategy code must never see (VT-001), so the file can never join the
    generic re-expose list. A backtest still has to attach to the
    already-running, already-logged-in terminal, so it gets only
    ``terminal_path`` and ``timeout`` (#1589).
    """
    src = src_root / "mt5.json"
    if not src.exists():
        return
    try:
        config = json.loads(src.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return
    if not isinstance(config, dict):
        return
    subset: dict[str, Any] = {}
    terminal_path = config.get("terminal_path")
    if isinstance(terminal_path, str) and terminal_path.strip() and "\x00" not in terminal_path:
        subset["terminal_path"] = terminal_path
    timeout = config.get("timeout")
    if type(timeout) in (int, float) and math.isfinite(timeout) and timeout > 0:
        subset["timeout"] = timeout
    if not subset:
        return
    try:
        (dst_root / "mt5.json").write_text(json.dumps(subset), encoding="utf-8")
    except OSError:
        pass


def _prepare_sandbox_home(real_home: Path | None) -> Path:
    """Create an ephemeral HOME and symlink in only the loader-owned paths.

    The generated strategy runs in the same subprocess as the data loaders, so
    the ephemeral home re-exposes the narrow set of ``~/.vibe-trading`` paths the
    loaders need (opt-in cache, local data-bridge config, qveris config) and
    nothing else. Symlinks are used so the opt-in loader cache still persists
    across runs; ``shutil.rmtree`` later removes the links, never their targets.
    """
    sandbox = Path(tempfile.mkdtemp(prefix="vibe-sandbox-home-"))
    if real_home is not None:
        src_root = real_home / ".vibe-trading"
        if src_root.is_dir():
            dst_root = sandbox / ".vibe-trading"
            dst_root.mkdir(parents=True, exist_ok=True)
            for rel in _SANDBOX_HOME_REEXPOSE:
                src = src_root / rel
                if not src.exists():
                    continue
                dst = dst_root / rel
                try:
                    dst.symlink_to(src, target_is_directory=src.is_dir())
                except OSError:
                    # Symlinks need privileges on Windows, so they can fail even
                    # when nothing is fundamentally wrong. Fall back to a copy:
                    # the loader cache/config paths stay visible to the subprocess
                    # (the whole point of the re-exposure) without privileges.
                    # Copies are per-run snapshots that the existing sandbox
                    # cleanup removes, so the opt-in cache stops persisting across
                    # runs only on hosts that cannot create symlinks.
                    try:
                        if src.is_dir():
                            shutil.copytree(src, dst, dirs_exist_ok=True)
                        else:
                            shutil.copy2(src, dst)
                    except OSError:
                        # Best-effort: a loader that can't find its config just
                        # falls back to a live fetch / disabled cache — never a
                        # hard break.
                        pass
            _reexpose_mt5_config(src_root, dst_root)
            try:
                os.chmod(dst_root, 0o755)
            except OSError:
                pass
    # mkdtemp is 0700; widen so a dropped UID can still traverse the home.
    try:
        os.chmod(sandbox, 0o755)
    except OSError:
        pass
    # Pre-seed mootdx's config.json so its setup() doesn't crash on an empty
    # HOME. mootdx's config.py runs `finally: load_config()`, which re-reads the
    # file even after bestip(sync=False) fails to write it — the FileNotFoundError
    # from the finally block is uncaught and surfaces as asyncio "Exception in
    # callback" noise. Copy the real HOME's config when available: it carries
    # bestip-selected servers, so mootdx connects without re-r
```

### Core Architecture Module: `agent/src/core/state.py`
```
"""Run state persistence: creates run directories and records status."""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict


class RunStateStore:
    """Run state store: manages run directories and their lifecycle status."""

    def create_run_dir(self, workspace: Path) -> Path:
        """Create a unique run directory.

        Args:
            workspace: Parent directory (typically runs/).

        Returns:
            Newly created run directory path.
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:18]
        suffix = uuid.uuid4().hex[:6]
        run_dir = workspace / f"{timestamp}_{suffix}"
        run_dir.mkdir(parents=True, exist_ok=True)
        (run_dir / "code").mkdir(exist_ok=True)
        (run_dir / "logs").mkdir(exist_ok=True)
        (run_dir / "artifacts").mkdir(exist_ok=True)
        return run_dir

    def save_request(self, run_dir: Path, prompt: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Save the user request.

        Args:
            run_dir: Run directory.
            prompt: User prompt.
            context: Context metadata.

        Returns:
            Saved payload.
        """
        payload = {"prompt": prompt, "context": context}
        self._write_json(run_dir / "req.json", payload)
        return payload

    def mark_success(self, run_dir: Path) -> None:
        """Mark the run as successful.

        Args:
            run_dir: Run directory.
        """
        self._write_json(run_dir / "state.json", {"status": "success"})

    def mark_failure(self, run_dir: Path, reason: str) -> None:
        """Mark the run as failed.

        Args:
            run_dir: Run directory.
            reason: Failure reason.
        """
        self._write_json(run_dir / "state.json", {"status": "failed", "reason": reason})

    def mark_cancelled(self, run_dir: Path, reason: str = "cancelled by user") -> None:
        """Mark the run as cancelled by the user.

        Distinct from a failure so the run artifact agrees with the session
        transcript: a user stop is not an outage, and reporting it as one made
        the Reports view contradict the chat history.

        Args:
            run_dir: Run directory.
            reason: Cancellation reason.
        """
        self._write_json(run_dir / "state.json", {"status": "cancelled", "reason": reason})

    @staticmethod
    def _write_json(path: Path, data: Any) -> None:
        # Write + fsync so a crash can't leave a truncated/empty state.json.
        payload = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
        with open(path, "wb") as f:
            f.write(payload)
            f.flush()
            os.fsync(f.fileno())

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1461** (2026-09-16): **[Bug] portfolio_risk_xray fails on longer daily windows because market data is truncated**
  *Symptoms*: ### Description  portfolio_risk_xray works correctly on shorter daily windows, but fails when the requested history becomes slightly longer than the shared market-data row cap. The tool then returns: no close prices returned for any requested symbol. Expected behavior / What did you expect? The same risk analysis should work for longer windows. portfolio_risk_xray needs consecutive daily returns for volatility, VaR, Expected Shortfall and drawdown, so it should fetch the full untruncated history.  Additional context / Technical details  portfolio_risk_xray calls fetch_market_data(...) without max_rows=0.  Once the shared row cap is crossed, fetch_market_data may return a truncated/sampled payload instead of the direct OHLCV record list expected by _closes_frame().  technical_indicators already avoids this problem by requesting max_rows=0 for calculations that require consecutive bars.  A small fix may be:  raw = self._fetch(     codes=symbols,     start_date=start_date,     end_date=end_date,     source=source,     interval=interval,     max_rows=0, )  A regression test with more than 250 daily bars should cover it.  Small secondary observation: if one requested symbol has no price data, e.g. SPY.US + BOGUS.US, the x-ray aborts with: "weights reference symbols with no price data: ['BOGUS.US']"  This may be intentional fail-closed behavior, so the main issue is the long-window truncation.  ### Steps to Reproduce  Use portfolio_risk_xray with:  symbols: SPY.US QQQ.US AAPL.US MS
  **Post-Mortem & Fix Analysis**:
  > Fixed in #1462 exactly along the lines you scoped: the single fetch site now asks for `max_rows=0`, the same pattern `technical_indicators` uses for consecutive-bar calculations. The regression test drives 300 daily bars through a fetcher that reproduces the cap behavior and asserts all of them reach the report (`aligned_days == 300`), red-checked to fail at 150 without the change.  Your secondary observation is confirmed intentional: an unknown symbol aborting with `weights reference symbols with no price data` is the fail-closed contract for weight bookkeeping, so it stays as is. 

- **Issue #1426** (2026-09-14): **[Bug] Generic numeric tool fields can be misclassified as analysis evidence by metric-name tokens**
  *Symptoms*: ### Description  The analysis grounding layer can currently promote arbitrary numeric fields from successful tool results into analysis evidence based on metric-like tokens in their field names.  This means a numeric field can become authoritative evidence for a financial metric even when the field semantically represents metadata, a count, a diagnostic, or a different measurement.  This is broader than the `return_observations` case reported in #1420.  For example, a successful read-only tool can return a numeric field whose name happens to contain a recognized metric token. `_metric_kind_for_path()` may classify that field into an analysis metric family, and the resulting value can then satisfy `_analysis_value_observed()` for a final-answer claim.  The problem is not that external/custom tools should be prevented from contributing analysis evidence. They are an important extension point. The problem is that successful numeric output and authoritative metric evidence are currently too easy to conflate.  A tool should be able to contribute analysis evidence, but the semantic meaning of that evidence should be explicit or sufficiently constrained rather than inferred from an arbitrary numeric JSON path alone.  ### Why this matters  Financial/research tools naturally return a mixture of:  - actual calculated metrics; - sample sizes and observation counts; - date/window metadata; - diagnostics; - intermediate values; - descriptive statistics; - identifiers and flags.  A success
  **Post-Mortem & Fix Analysis**:
  > Measured this against current `main` and against #1422's head, because #1422 fixes exactly one spelling of the class this issue describes.  Each row ingests one successful tool result and checks a fabricated claim equal to the metadata value. Every row also runs a control claim (77%, a figure that appears nowhere), and a row only counts if the control is rejected — so these are not cases where the gate simply isn't checking.  | tool result leaf | claim | `main` | #1422 | |---|---|---|---| | `factor_analysis` · `return_observations: 81` | 年化收益 81% | accepted | rejected | | `factor_analysis` · `return_obs: 81` | 年化收益 81% | accepted | **accepted** | | `factor_analysis` · `n_returns: 81` | 年化收益 81% | accepted | **accepted** | | `factor_analysis` · `return_window: 20` | 年化收益 20% | accepted | **accepted** | | `quantlib_call` · `result.vol_lookback: 60` | 年化波动率 60% | accepted | **accepted** | | `quantlib_call` · `result.max_drawdown_duration: 45` | 最大回撤 45% | accepted | **accepted** |  The la
  > Mapping the current state after #1420's fix (#1422), since this is the same ingestion path I just rewrote.  What already holds: metadata/count head nouns (`observations`, `counts`) resolve to `None` before the token scan and the text fallback is skipped there, so `return_observations`-family fields can no longer reach evidence through either door. Exact aliases (`return`, `total_return`, `annualized_return`) and compounds whose tokens are all metric-words still classify.  What's genuinely still open, and it is the design point you raise: `_metric_kind_for_path` still infers kind from name alone for everything else, so a field named `sharpe_window_days` or `diagnostic_vol_score` classifies as sharpe/vol even though it is a window size or a diagnostic, and it then grounds claims as authoritative evidence. Closing that family means choosing one of three shapes, and it's a product call rather than a drive-by:  1. Tighten classification to the exact alias set and drop the fuzzy token scan e
  > Thanks — this matches the integration case that led us to file this.  Our current portfolio-risk tool returns one structured payload containing both metadata and real analysis metrics, for example:  - `inputs.return_observations` - `inputs.aligned_days` - `volatility.daily_vol` - `volatility.annualized_vol` - `volatility.downside_deviation_annualized` - `drawdown.max_drawdown` - `tail_risk.var_95` - `tail_risk.expected_shortfall_95` - `diversification.diversification_ratio` - `correlation.avg_pairwise_abs` - `correlation.beta_to_equal_weight`  So the result naturally mixes counts/window metadata with actual financial measurements.  That is why option (2) also looks like the strongest fit from the integration side: let the tool explicitly declare which fields are authoritative metrics, while keeping every other numeric leaf generic/auditable but not eligible to ground analysis claims.  For example, conceptually:  ```json {   "metrics": [     {       "field": "volatility.annualized_vol",

- **Issue #1421** (2026-09-14): **[Bug] Grounding rejects valid multi-metric claims because one metric kind is applied to the whole clause**
  *Symptoms*: ### Description   The grounding validator can reject a final-answer clause containing multiple valid analysis metrics, even when each metric is individually backed by matching evidence.  This reproduces on an unmodified Vibe-Trading v0.1.15 checkout.  The issue appears to be that `_validate_analysis_claims()` resolves a single metric kind for the whole clause through `_metric_kind_for_text(segment)`, then validates every measurement in that clause against that one kind.  For example, given valid evidence for:  - annualized volatility = 0.23 - max drawdown = -0.05  these two claims validate successfully when written separately:  ```text Annualized volatility was 23%. Max drawdown was -5%. ```  But the semantically equivalent combined sentence:  ```text Annualized volatility was 23% and max drawdown was -5%. ```  is rejected.  Observed result:  ```text TEXT = Annualized volatility was 23% and max drawdown was -5%. VALID = False ISSUES = [   {     "code": "analysis_claim_unavailable",     "claim": "Annualized volatility was 23% and max drawdown was -5%.",     "value": "23%",     "kind": "drawdown",     "message": "No supporting analysis evidence (a completed backtest result or observed risk metric) exists for this figure. Mark the analysis as incomplete and omit these figures."   } ] ```  The 23% value is valid volatility evidence, but because the clause is classified as `drawdown`, the validator tries to validate 23% as a drawdown measurement.  This is important in normal agent
  **Post-Mortem & Fix Analysis**:
  > Thanks for filing this — this matches what we observed while integrating the current risk-xray output.  One design concern before introducing a flat `tail_risk` kind:  `VaR 95`, `VaR 99`, `Expected Shortfall 95`, and `Expected Shortfall 99` should probably not all share one interchangeable evidence bucket.  For example, if the evidence contains:  ```text var_95 = 0.021 var_99 = 0.041 expected_shortfall_95 = 0.030 expected_shortfall_99 = 0.058  then a claim such as:  99% VaR was 2.1%  must not be grounded by the real var_95 = 2.1% observation.  Likewise, Expected Shortfall 95 = 3.0% must not ground VaR 95 = 3.0% merely because both belong to the same tail-risk family.  A structured identity such as:  family = tail_risk metric = var | expected_shortfall level = 0.95 | 0.99 horizon = 1d unit = return_fraction  would preserve those distinctions while still grouping the metrics under the same family.  This is relevant to the current risk_xray output, which already emits separate fields:  ta
  > Apologies — this comment was intended for #1425 / PR #1427 and is unrelated to the multi-metric clause issue tracked here.
  > Closed by the grounding rewrite on main: figures are checked one by one instead of under a single metric kind per clause, so "Annualized volatility was 23% and max drawdown was -5%." grounds against 0.23 and -0.05. One known gap remains in the other direction: an undeclared answer that swaps the two values is not caught, because tying a figure to its metric would need the words around it. 

- **Issue #1420** (2026-09-14): **[Bug] return_observations is ingested as return evidence and can validate a false return claim**
  *Symptoms*: ### Description  Analysis grounding can treat a metadata/count field named `return_observations` as actual return evidence.  `_metric_kind_for_path()` tokenizes compound leaf names and searches for known metric aliases. Because `return_observations` contains the token `return`, it is classified as metric kind `return`.  For example:  ```text return_observations = 81  is ingested as:  metric = return value = 81.0 field = return_observations  This can then validate a financial return claim that was never present in the tool output:  Annual return: 81%  passes final-answer grounding, while:  Annual return: 80%  is correctly rejected.  Cumulative return: 81% also passes.  This is a false-positive grounding result: a count of return observations can become evidence for an 81% investment return.  I reproduced this against a clean Vibe-Trading v0.1.15 checkout, without custom tools or application-specific integrations.  The relevant upstream logic is:  def _metric_kind_for_path(path: str) -> str | None:     leaf = re.sub(r"\[\d+\]$", "", str(path or "").rsplit(".", 1)[-1])     leaf = leaf.strip().casefold()      kind = _ANALYSIS_KIND_ALIASES.get(leaf)     if kind is not None:         return kind      tokens = [token for token in re.split(r"[_.]", leaf) if token]      for size in (2, 1):         for start in range(len(tokens) - size, -1, -1):             kind = _ANALYSIS_KIND_ALIASES.get(                 "_".join(tokens[start : start + size])             )             if kind is not 
  **Post-Mortem & Fix Analysis**:
  > Closed by the grounding rewrite on main: `return_observations` and the other count, window and lookback leaves are no longer metric evidence, so "Annual return: 81%" against `return_observations = 81` is refused. 

- **Issue #1418** (2026-09-14): **[Bug] Spanish decimal comma and Unicode minus break analysis grounding**
  *Symptoms*: ### Description  **What happened:**  Analysis grounding mis-parses numbers written in normal Spanish numeric format.  The Spanish locale naturally produces decimal commas, e.g.:  ```text 1,57% −5,13% 0,188 2,237  but the grounding layer currently assumes an English numeric format.  This causes correct analysis metrics to be rejected or reinterpreted.  Examples observed in real runs:  Model output                  Grounding interpretation ------------------------------------------------------ −5,13%                        13% 1,57%                         57% −5,132%                       5132%  For tail-risk wording, the confidence level can also be interpreted as a measured value:  VaR 95%: 1,57%  may validate both 95% and the malformed 57% as candidate VaR values, although 95% is the confidence level and 1,57% is the actual metric.  The underlying tool output is correct. The corruption happens when the final natural-language answer is parsed by GroundingLedger.  This reproduces in both the Web UI and the full CLI agent path, so it is not a frontend-only issue.  The relevant current code shape is:  _MEASURE_NUMBER_RE = re.compile(     r"[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)\s*[%％]?"     r"|[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)\s*[%％]" )  and clause splitting currently uses:  _CLAUSE_SEPARATOR_RE = re.compile(r"[,，;；。、\n]") _THOUSANDS_SEPARATOR_RE = re.compile(r"(?<=\d),(?=\d{3}(?!\d))")  This means:  decimal comma is not a supported decimal separator; an ASCII comma may split a
  **Post-Mortem & Fix Analysis**:
  > Fixed on main. "−5,13%", "1,57%" and "0,188" are read as decimals, U+2212 is a minus sign, and an answer that writes a marked decimal comma also reads "2,237" and "−5,132%" as 2.237 and −5.132%. A confidence level is no longer matched as a metric value: the answer declares it (`95% | count | confidence level` in its figures block), and the VaR report from this issue grounds once it does. A lone "2,237" with no other decimal comma in the answer is still read as 2237.

- **Issue #1403** (2026-09-11): **[Bug] Lazy loader registry is not thread-safe: concurrent cold-start calls see an empty registry**
  *Symptoms*: ### Description  ## Description  **What happened:**  The lazy loader registry can report itself as initialized before loader registration has actually completed.  `backtest.loaders.registry._ensure_registered()` sets `_registered = True` before importing the loader modules. When several threads call it concurrently on a cold process, one thread starts the imports while the other threads see `_registered == True` and immediately return with `LOADER_REGISTRY` still empty.  This is observable without an LLM and without artificial delays.  In a natural cold-start test with 8 threads:  ```text worker=1 elapsed=    0.022 ms _registered=True loaders=0 worker=6 elapsed=    0.027 ms _registered=True loaders=0 worker=4 elapsed=    0.030 ms _registered=True loaders=0 worker=5 elapsed=    0.030 ms _registered=True loaders=0 worker=3 elapsed=    0.033 ms _registered=True loaders=0 worker=0 elapsed=    0.035 ms _registered=True loaders=0 worker=2 elapsed=    0.038 ms _registered=True loaders=0 worker=7 elapsed=  447.644 ms _registered=True loaders=27  min loaders seen: 0 max loaders seen: 27 NATURAL_RACE=YES  The functional consequence is that real concurrent market-data requests can fail spuriously during cold start.  Using three concurrent calls for YPF.US, SPY.US, and CL=F:  Cold parallel process:  YPF.US  -> {"_unresolved": ["YPF.US"]}   in 0.009s SPY.US  -> {"_unresolved": ["SPY.US"]}   in 0.010s CL=F    -> success                       in 0.920s  Immediately afterwards, in the same p
  **Post-Mortem & Fix Analysis**:
  > Update: the formatting question below is resolved. I applied Black to the two changed files as `CONTRIBUTING.md` prescribes; full-file Black and Ruff checks now pass. No formatting exception or guidance is needed. The fix and verification results are in #1405.  I reproduced this on Python 3.11.15 with `requirements-lock.txt`. The original code returns an empty registry to seven of eight cold callers; the patched code gives all eight callers 27 loaders. The full backend selection passed on Python 3.11.15 and 3.14.6 (12,892 passed, 17 skipped each). After the formatting-only follow-up, the 48 registry/source-order tests pass again on both versions.  Original question, now resolved: both changed files had existing Black differences on main (`f9cb061b`), so I initially asked whether to preserve that formatting. Applying the required formatter only to those two files resolves the check without changing any other files. 

- **Issue #1355** (2026-09-05): **[Bug] Backtest subprocess segfaults on aarch64/glibc 2.34 — resource.setrlimit via preexec_fn runs Python in a forked child of a multi-threaded server**
  *Symptoms*: ### Description  **What happened:** `Runner._run_backtest` (agent/src/core/runner.py) launches the generated backtest as a subprocess and applies sandbox resource limits (`RLIMIT_AS`, `RLIMIT_NOFILE`) via `preexec_fn=_make_rlimit_preexec()`. `preexec_fn` runs arbitrary Python code (the `resource.setrlimit` calls) inside the forked child, between `fork()` and `exec()` — and the parent process here is `vibe-trading serve`, a multi-threaded server (uvicorn + background agent loops). Forking a multi-threaded process and running non-async-signal-safe code (the Python interpreter itself, executing bytecode) in the child before exec is undefined behavior per POSIX, and on this host it reliably segfaults: every backtest subprocess launch crashed with SIGSEGV (confirmed via systemd-coredump entries for the child Python process), so no backtest could complete while the server was running normally (as opposed to e.g. a single-threaded CLI invocation, which does not exhibit this).  **What I expected:** Sandbox rlimits should be applied without executing Python bytecode in the forked-but-not-yet-exec'd child of a multi-threaded process.  **Suggested fix:** Apply the rlimits after exec instead of between fork and exec: wrap the subprocess command as `python -c "<bootstrap that sets resource.setrlimit, then runpy.run_path(entry_script)>" <entry_script> <args...>` instead of passing `preexec_fn=`. The bootstrap runs in the freshly-exec'd, single-threaded interpreter, so `setrlimit` executes 
  **Post-Mortem & Fix Analysis**:
  > Confirmed on current main, independently of the report: `runner.py:604` passes `preexec_fn=_make_rlimit_preexec()`, and the closure at `runner.py:99-106` executes Python bytecode (`resource.getrlimit`/`setrlimit`) in the forked child. The parent is `vibe-trading serve` — uvicorn plus background agent loops — so this is exactly the multi-threaded-fork case CPython documents as unsafe, and your coredump evidence matches the mechanism rather than merely correlating with it.  Fixed by removing `preexec_fn` entirely. The same two ceilings are now applied by the freshly-exec'd, single-threaded interpreter through a `python -c` bootstrap that then `runpy`s the entry script, so the fork-time hazard is gone on every platform instead of only where it happens not to crash. The bootstrap is transparent to the entry script: `argv[0]` is the script, `argv[1:]` are the caller's args, `__name__` is `"__main__"`, the script's own directory is on `sys.path` exactly as with `python script.py`, and a non-

- **Issue #1354** (2026-09-07): **[Bug] Grounding gate misreads a price-context word used as a formula variable (e.g. "close/SMA50 > 1") as an asserted observed value, causing false-positive numeric_claim_unavailable rejections**
  *Symptoms*: ### Description   **What happened:** `GroundingLedger._validate_price_claims` (agent/src/agent/grounding.py) decides whether a sentence contains a price claim by checking `_PRICE_CONTEXT_RE.search(segment)` (matches words like "close", "price", "preço") and then, if it matches, pulling the first number in the segment via `_numbers_without_dates_or_percent` as the asserted value. This does not distinguish a price word used as an observed value ("close was 2500") from the same word used as a formula/rule variable ("close/SMA50 > 1", "regra: close acima da EMA30"). In the latter case the number after the price word is not a price at all — it can be a threshold, a signal constant (+1/0/-1), a Monte Carlo simulation count, a lookback window, or a bare year — but the gate still grabs it as "the" asserted value and rejects it with `numeric_claim_unavailable` ("Price claim {value} has no matching observed tool evidence") whenever that number doesn't match any observed quote.  This caused real, correct backtest reports to be rejected as ungrounded. Two other AI agents (Codex, DeepSeek) spent hours trying to fix it by adding one regex per newly-discovered bad phrasing (a position/signal constant of ±1 or 0, a Monte Carlo simulation count with or without a currency unit next to it, a bare four-digit year in prose, a normalized ratio) — each fix accepted one more legitimate phrasing but reliably opened a new bypass or still rejected a different valid report, because natural language phra
  **Post-Mortem & Fix Analysis**:
  > Confirmed against current main (`agent/src/agent/grounding.py:2214-2232`): any segment matching `_PRICE_CONTEXT_RE` gets every number in it pulled by `_numbers_without_dates_or_percent` and compared as a price claim, with no syntactic check of what sits between the price word and the number. "close/SMA50 > 1" hits exactly that path: `close` matches the context regex, and 50 (or 1) is then validated as an asserted observed value and rejected.  I also agree with the diagnosis about the denylist trap. Per-phrasing regexes are how this gate got its current false-positive shape; one more pattern per bad phrasing cannot converge. A closed, structural distinction is the right shape: if a formula marker (comparison/division operator, or an indicator identifier followed by digits) sits between the price word and the number, the number is an operand, not a claimed value. The sentence-boundary cutoff belongs in the same patch.  Please open the PR with your patch and the regression suite. The bar 
  > Taking this one — it's in the gate family we've been hardening (we landed the sibling fixes: #1326 full-width clause splitting, #1338 the analysis gate). The structural approach you and @he-yufeng outlined is clear: a closed `_FORMULA_MARKER_RE` (comparison/division operators, indicator-identifier + digits) sitting between the price-context word and the number, plus the sentence-boundary cutoff — with the strict-narrowing regression suite ("close was 2500" with no evidence still rejects).  @nandofmike — if your patch is ready, say the word and it's yours; otherwise I'll open the PR. 

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

### Incident Patch 1: `7f6908b7` (2026-10-05)
**Commit Message**: fix(live): stop active attempts and isolate durable schedules

Wait for actual session terminal events, cancel in-flight analysis on runner stop, and finish scheduler teardown across startup, concurrent stops and API shutdown. Correct heartbeat status units and remove stopped sentinels.

Isolate broker job stores with legacy migration and complete atomic writes under concurrency. Skip malformed emergency-close symbols and overflowing quantities, and make capped grounding feedback explicit about omitted findings.

Validation: 16,817 backend tests passed (190 skipped), 38 frontend status tests passed, and changed Python syntax/lint passed. Update seven README News entries.

**File**: `README.md` (modified, +4/-2)
```diff
@@ -52,16 +52,18 @@
 
 > ⚠️ **Security warning:** The X account `VibeTrading_HKU`, Virtuals project `101845`, and token contract `0x640BDBF77b6447E8b7DB7894cED84BD1c40571f4` are not official Vibe-Trading assets. We have never launched or endorsed any token or memecoin. Do not buy, connect a wallet, or sign anything. [Details](SECURITY.md#official-channels--impersonation).
 
+- **2026-10-06** 🛠️ **Live controls and report corrections**: Stopping a live runner cancels its current analysis and waits for scheduler cleanup, including startup cancellation and API shutdown; status timestamps use the correct units ([#1704](https://github.com/HKUDS/Vibe-Trading/pull/1704)). Emergency cancel/flatten scans skip malformed records without abandoning the remaining book ([#1703](https://github.com/HKUDS/Vibe-Trading/pull/1703)); broker schedules are stored separately and writes handle concurrency and partial writes. US equity half-days respect the early closing bell ([#1706](https://github.com/HKUDS/Vibe-Trading/pull/1706)). Report corrections preserve figures that passed validation, and bounded feedback no longer implies that unlisted figures passed ([#1702](https://github.com/HKUDS/Vibe-Trading/pull/1702)).
+
 - **2026-10-05** 🛠️ **Research prompts and calculation fixes**: Chat accepts longer research prompts and gives a localized recovery message when input is too large ([#1701](https://github.com/HKUDS/Vibe-Trading/pull/1701)). Backtests use full-sample Sortino downside deviation; grouped validation purges overlapping labels, covariance weights remain finite, shadow RSI uses Wilder seeds, and memory removal accepts filename stems. Invalid call aliases now receive exact source references for correction ([#1638](https://github.com/HKUDS/Vibe-Trading/pull/1638)); numeric validation stays unchanged.
 
 - **2026-10-04** 🛠️ **Scheduled reports and research workflows**: Edit scheduled runs and choose a configured destination; Email reports support HTML or PDF attachments ([#1649](https://github.com/HKUDS/Vibe-Trading/pull/1649), [#1680](https://github.com/HKUDS/Vibe-Trading/pull/1680)).
   Backtests expose structured summaries and paged artifact reads ([#1646](https://github.com/HKUDS/Vibe-Trading/pull/1646), [#1647](https://github.com/HKUDS/Vibe-Trading/pull/1647)). Fixes cover memory-search snippets, export-path guidance, macro truncation, monthly risk, turnover on reversals and cash reentry, IV accuracy, VaR gaps, VCS updates and Robinhood option-order blocking.
 
-- **2026-10-03** 🛠️ **Research, reports and data reliability**: CJK session search, channel setup, broker exposure pricing and file writes now handle cases that blocked everyday use. PDF delivery embeds CJK fonts, Swarm validates preset inputs and separates task artifacts, and replayed tool results survive context compaction ([#1683](https://github.com/HKUDS/Vibe-Trading/pull/1683), [#1455](https://github.com/HKUDS/Vibe-Trading/pull/1455), [#1635](https://github.com/HKUDS/Vibe-Trading/pull/1635)). Backtests keep one adjustment basis, local caches distinguish sources, single-asset caps and weekly/monthly risk use the declared settings, audits retain loss signs, grounding checks the current engine output and exact list references, and Stooq retries after a denial cooldown ([#1684](https://github.com/HKUDS/Vibe-Trading/pull/1684), [#1650](https://github.com/HKUDS/Vibe-Trading/pull/1650), [#1685](https://github.com/HKUDS/Vibe-Trading/pull/1685), [#1640](https://github.com/HKUDS/Vibe-Trading/pull/1640)).
-
 <details>
 <summary>Earlier news</summary>
 
+- **2026-10-03** 🛠️ **Research, reports and data reliability**: CJK session search, channel setup, broker exposure pricing and file writes now handle cases that blocked everyday use. PDF delivery embeds CJK fonts, Swarm validates preset inputs and separates task artifacts, and replayed tool results survive context compaction ([#1683](https://github.com/HKUDS/Vibe-Trading/pull/1683), [#1455](https://github.com/HKUDS/Vibe-Trading/pull/1455), [#1635](https://github.com/HKUDS/Vibe-Trading/pull/1635)). Backtests keep one adjustment basis, local caches distinguish sources, single-asset caps and weekly/monthly risk use the declared settings, audits retain loss signs, grounding checks the current engine output and exact list references, and Stooq retries after a denial cooldown ([#1684](https://github.com/HKUDS/Vibe-Trading/pull/1684), [#1650](https://github.com/HKUDS/Vibe-Trading/pull/1650), [#1685](https://github.com/HKUDS/Vibe-Trading/pull/1685), [#1640](https://github.com/HKUDS/Vibe-Trading/pull/1640)).
+
 - **2026-10-02** 🛠️ **Backtests and report checks**: strategy-file writes retain model provenance without crashing ([#1673](https://github.com/HKUDS/Vibe-Trading/pull/1673)), and Monte Carlo drawdown and Sharpe include starting capital ([#1664](https://github.com/HKUDS/Vibe-Trading/pull/1664)). Report audits preserve accounting negatives and units ([#1663](https://github.com/HKUDS/Vibe-Trading/pull/1663)); groundi
```

**File**: `README_ar.md` (modified, +4/-2)
```diff
@@ -52,16 +52,18 @@
 
 > ⚠️ **تحذير أمني:** حساب X باسم `VibeTrading_HKU`، ومشروع Virtuals رقم `101845`، وعقد التوكن `0x640BDBF77b6447E8b7DB7894cED84BD1c40571f4` كلّها غير رسمية ولا تتبع Vibe-Trading. لم نُطلق أو نؤيد مطلقًا أي توكن أو عملة ميم. لا تشترِ هذا التوكن، ولا تربط محفظتك، ولا توقّع أي شيء. [التفاصيل](SECURITY.md#official-channels--impersonation).
 
+- **2026-10-06** 🛠️ **إصلاح التحكم بالتداول وتصحيح التقارير**: يلغي إيقاف مشغّل التداول الفعلي التحليل الجاري وينتظر انتهاء المجدول، بما يشمل الإلغاء أثناء بدء التشغيل وإغلاق API، مع تصحيح وحدات الوقت في الحالة ([#1704](https://github.com/HKUDS/Vibe-Trading/pull/1704)). يتجاوز إلغاء الأوامر وإغلاق المراكز في الطوارئ السجلات غير الصالحة ويواصل معالجة الباقي ([#1703](https://github.com/HKUDS/Vibe-Trading/pull/1703)). تُحفظ جداول الوسطاء بصورة منفصلة مع معالجة الكتابات المتزامنة والجزئية. تُراعى ساعات الإغلاق المبكر للأسهم الأمريكية ([#1706](https://github.com/HKUDS/Vibe-Trading/pull/1706)). تحافظ تصحيحات التقارير على الأرقام التي اجتازت التحقق، ولا توحي الملاحظات المحدودة بأن الأرقام غير المذكورة قد اجتازته ([#1702](https://github.com/HKUDS/Vibe-Trading/pull/1702)).
+
 - **2026-10-05** 🛠️ **إدخال البحث وتصحيح الحسابات**: تدعم المحادثة نصوص بحث أطول وتوضح باللغة الحالية كيفية تقصير النص عند تجاوز الحد ([#1701](https://github.com/HKUDS/Vibe-Trading/pull/1701)). يستخدم Sortino انحراف الجانب السلبي عبر جميع الفترات، ويستبعد التحقق الجماعي التسميات المتداخلة. تحسنت أوزان التباين وRSI بمتوسط Wilder الأولي وحذف الذاكرة باسم الملف. عند استخدام اسم مستعار غير صحيح للاستدعاء، يقترح التصحيح مراجع الحقول الفعلية مع بقاء التحقق من الأرقام كما هو ([#1638](https://github.com/HKUDS/Vibe-Trading/pull/1638)).
 
 - **2026-10-04** 🛠️ **تحسين التقارير المجدولة وسير البحث**: يمكن تعديل المهام المجدولة واختيار وجهة مُعدّة مسبقًا، مع إرسال تقارير البريد بصيغة HTML أو كمرفقات PDF ([#1649](https://github.com/HKUDS/Vibe-Trading/pull/1649), [#1680](https://github.com/HKUDS/Vibe-Trading/pull/1680)).
   تتضمن الاختبارات التاريخية ملخصات منظّمة وقراءة ملفات النتائج على صفحات ([#1646](https://github.com/HKUDS/Vibe-Trading/pull/1646), [#1647](https://github.com/HKUDS/Vibe-Trading/pull/1647)). تشمل الإصلاحات مقتطفات بحث الذاكرة، وإرشادات مسار التصدير، وبيان اقتطاع البيانات الكلية، ومخاطر الشموع الشهرية، ودوران المحفظة عند عكس الاتجاه أو إعادة الاستثمار بعد التحول إلى النقد، ودقة التقلب الضمني، وفجوات VaR، وتحديث التثبيت من VCS، وحظر أوامر خيارات Robinhood غير المدعومة.
 
-- **2026-10-03** 🛠️ **تحسين موثوقية البحث والتقارير والبيانات**: أُصلحت مشكلات البحث في الجلسات بالصينية واليابانية والكورية، وإعداد القنوات، وتقييم حيازات الوسطاء، وكتابة الملفات التي كانت تعيق الاستخدام اليومي. تتضمن ملفات PDF خطوط CJK، ويتحقق Swarm من مدخلات الإعدادات المسبقة ويفصل مخرجات المهام، وتبقى نتائج الأدوات المعاد استخدامها متاحة بعد ضغط السياق ([#1683](https://github.com/HKUDS/Vibe-Trading/pull/1683), [#1455](https://github.com/HKUDS/Vibe-Trading/pull/1455), [#1635](https://github.com/HKUDS/Vibe-Trading/pull/1635)). تستخدم الاختبارات التاريخية أساسًا موحدًا لتعديل الأسعار، وتميّز الذاكرة المؤقتة المحلية بين مصادر البيانات، وتتبع حدود الأصل الواحد وحسابات المخاطر الأسبوعية والشهرية الإعدادات المعلنة. يحافظ التدقيق على إشارة الخسائر، ويعتمد التحقق الرقمي على مخرجات المحرك الحالية ومراجع القوائم الدقيقة، ويعيد Stooq المحاولة بعد انتهاء فترة الانتظار عقب الرفض ([#1684](https://github.com/HKUDS/Vibe-Trading/pull/1684), [#1650](https://github.com/HKUDS/Vibe-Trading/pull/1650), [#1685](https://github.com/HKUDS/Vibe-Trading/pull/1685), [#1640](https://github.com/HKUDS/Vibe-Trading/pull/1640)).
-
 <details>
 <summary>أخبار سابقة</summary>
 
+- **2026-10-03** 🛠️ **تحسين موثوقية البحث والتقارير والبيانات**: أُصلحت مشكلات البحث في الجلسات بالصينية واليابانية والكورية، وإعداد القنوات، وتقييم حيازات الوسطاء، وكتابة الملفات التي كانت تعيق الاستخدام اليومي. تتضمن ملفات PDF خطوط CJK، ويتحقق Swarm من مدخلات الإعدادات المسبقة ويفصل مخرجات المهام، وتبقى نتائج الأدوات المعاد استخدامها متاحة بعد ضغط السياق ([#1683](https://github.com/HKUDS/Vibe-Trading/pull/1683), [#1455](https://github.com/HKUDS/Vibe-Trading/pull/1455), [#1635](https://github.com/HKUDS/Vibe-Trading/pull/1635)). تستخدم الاختبارات التاريخية أساسًا موحدًا لتعديل الأسعار، وتميّز الذاكرة المؤقتة المحلية بين مصادر البيانات، وتتبع حدود الأصل الواحد وحسابات المخاطر الأسبوعية والشهرية الإعدادات المعلنة. يحافظ التدقيق على إشارة الخسائر، ويعتمد التحقق الرقمي على مخرجات المحرك الحالية ومراجع القوائم الدقيقة، ويعيد Stooq المحاولة بعد انتهاء فترة الانتظار عقب الرفض ([#1684](https://github.com/HKUDS/Vibe-Trading/pull/1684), [#1650](https://github.com/HKUDS/Vibe-Trading/pull/1650), [#1685](https://github.com/HKUDS/Vibe-Trading/pull/1685), [#1640](https://github.com/HKUDS/Vibe-Trading/pull/1640)).
+
 - **2026-10-02** 🛠️ **إصلاحات الاختبارات الخلفية وتدقيق التقارير**: تحتفظ كتابة ملفات الاستراتيجيات بمصدر النموذج دون تعطل ([#1673](https://github.com/HKUDS/Vibe-Trading/pull/1673))، وتشمل حسابات التراجع وSharpe في محاكاة مونت كارلو رأس المال الابتدائي ([#1664](https://githu
```

**File**: `README_es.md` (modified, +4/-2)
```diff
@@ -52,16 +52,18 @@
 
 > ⚠️ **Advertencia de seguridad:** la cuenta de X `VibeTrading_HKU`, el proyecto de Virtuals `101845` y el contrato de token `0x640BDBF77b6447E8b7DB7894cED84BD1c40571f4` no son activos oficiales de Vibe-Trading. Nunca hemos lanzado ni respaldado ningún token o memecoin. No compres, conectes una wallet ni firmes nada. [Detalles](SECURITY.md#official-channels--impersonation).
 
+- **2026-10-06** 🛠️ **Control de operaciones reales y corrección de informes**: Detener el agente de operaciones reales cancela el análisis en curso y espera a que termine el planificador, incluso al cancelar durante el inicio o cerrar la API; se corrigen también las unidades de tiempo del estado ([#1704](https://github.com/HKUDS/Vibe-Trading/pull/1704)). La cancelación y el cierre de posiciones de emergencia omiten registros inválidos y continúan con los restantes ([#1703](https://github.com/HKUDS/Vibe-Trading/pull/1703)); cada bróker conserva su propia programación y las escrituras manejan concurrencia y escrituras parciales. Las sesiones reducidas de acciones estadounidenses respetan el cierre anticipado ([#1706](https://github.com/HKUDS/Vibe-Trading/pull/1706)). Las correcciones conservan las cifras verificadas y no presentan las cifras omitidas de los comentarios limitados como aprobadas ([#1702](https://github.com/HKUDS/Vibe-Trading/pull/1702)).
+
 - **2026-10-05** 🛠️ **Consultas de investigación y cálculos corregidos**: El chat admite consultas más largas e indica en el idioma actual cómo acortarlas cuando superan el límite ([#1701](https://github.com/HKUDS/Vibe-Trading/pull/1701)). Sortino usa la desviación a la baja de todos los períodos; la validación por grupos excluye etiquetas solapadas. También mejoran los pesos de covarianza, el RSI con media inicial de Wilder y la eliminación de memorias por nombre de archivo. Los alias de llamada incorrectos reciben referencias exactas para corregirlos, conservando la validación numérica ([#1638](https://github.com/HKUDS/Vibe-Trading/pull/1638)).
 
 - **2026-10-04** 🛠️ **Informes programados y flujos de investigación**: Edita tareas programadas y elige un destino configurado; los informes por email admiten HTML o archivos PDF adjuntos ([#1649](https://github.com/HKUDS/Vibe-Trading/pull/1649), [#1680](https://github.com/HKUDS/Vibe-Trading/pull/1680)).
   Los backtests ofrecen resúmenes estructurados y lectura paginada de resultados ([#1646](https://github.com/HKUDS/Vibe-Trading/pull/1646), [#1647](https://github.com/HKUDS/Vibe-Trading/pull/1647)). Se corrigen fragmentos de búsqueda, indicaciones de exportación, avisos de datos macro truncados, riesgo mensual, rotación al invertir posiciones o reinvertir tras pasar a efectivo, precisión de IV, huecos de VaR, actualizaciones desde VCS y el bloqueo de órdenes de opciones no admitidas en Robinhood.
 
-- **2026-10-03** 🛠️ **Más fiabilidad en investigación, informes y datos**: se corrigen problemas de búsqueda de sesiones en chino, japonés y coreano, configuración de canales, valoración de posiciones del bróker y escritura de archivos que bloqueaban el uso diario. Los PDF incluyen fuentes CJK, Swarm valida las entradas de sus plantillas y separa los archivos por tarea, y los resultados reutilizados de herramientas sobreviven a la compactación del contexto ([#1683](https://github.com/HKUDS/Vibe-Trading/pull/1683), [#1455](https://github.com/HKUDS/Vibe-Trading/pull/1455), [#1635](https://github.com/HKUDS/Vibe-Trading/pull/1635)). Los backtests mantienen una base de ajuste uniforme, la caché local distingue las fuentes y los límites de un solo activo y el riesgo semanal/mensual respetan la configuración declarada. Las auditorías conservan el signo de las pérdidas, la verificación numérica usa la salida actual del motor y referencias exactas a listas, y Stooq vuelve a intentar tras la espera por rechazo ([#1684](https://github.com/HKUDS/Vibe-Trading/pull/1684), [#1650](https://github.com/HKUDS/Vibe-Trading/pull/1650), [#1685](https://github.com/HKUDS/Vibe-Trading/pull/1685), [#1640](https://github.com/HKUDS/Vibe-Trading/pull/1640)).
-
 <details>
 <summary>Noticias anteriores</summary>
 
+- **2026-10-03** 🛠️ **Más fiabilidad en investigación, informes y datos**: se corrigen problemas de búsqueda de sesiones en chino, japonés y coreano, configuración de canales, valoración de posiciones del bróker y escritura de archivos que bloqueaban el uso diario. Los PDF incluyen fuentes CJK, Swarm valida las entradas de sus plantillas y separa los archivos por tarea, y los resultados reutilizados de herramientas sobreviven a la compactación del contexto ([#1683](https://github.com/HKUDS/Vibe-Trading/pull/1683), [#1455](https://github.com/HKUDS/Vibe-Trading/pull/1455), [#1635](https://github.com/HKUDS/Vibe-Trading/pull/1635)). Los backtests mantienen una base de ajuste uniforme, la caché local distingue las fuentes y los límites de un solo activo y el riesgo semanal/mensual respetan la configuración declarada. Las auditorías conserv
```

**File**: `README_id.md` (modified, +4/-2)
```diff
@@ -53,16 +53,18 @@
 
 > ⚠️ **Peringatan keamanan:** Akun X `VibeTrading_HKU`, proyek Virtuals `101845`, dan kontrak token `0x640BDBF77b6447E8b7DB7894cED84BD1c40571f4` bukan aset resmi Vibe-Trading. Kami tidak pernah meluncurkan atau mendukung token maupun memecoin apa pun. Jangan membeli, menghubungkan wallet, atau menandatangani apa pun. [Detail](SECURITY.md#official-channels--impersonation).
 
+- **2026-10-06** 🛠️ **Kontrol trading langsung dan koreksi laporan**: Menghentikan runner trading langsung membatalkan analisis aktif dan menunggu penjadwal selesai, termasuk pembatalan saat mulai dan penutupan API; satuan waktu pada status juga diperbaiki ([#1704](https://github.com/HKUDS/Vibe-Trading/pull/1704)). Pembatalan order dan penutupan posisi darurat melewati catatan tidak valid lalu melanjutkan catatan lainnya ([#1703](https://github.com/HKUDS/Vibe-Trading/pull/1703)); jadwal setiap broker disimpan terpisah dengan penanganan penulisan bersamaan dan parsial. Sesi saham AS yang dipersingkat mengikuti waktu tutup lebih awal ([#1706](https://github.com/HKUDS/Vibe-Trading/pull/1706)). Koreksi laporan mempertahankan angka yang lolos verifikasi, dan umpan balik terbatas tidak menyiratkan bahwa angka yang tidak tercantum sudah lolos ([#1702](https://github.com/HKUDS/Vibe-Trading/pull/1702)).
+
 - **2026-10-05** 🛠️ **Input riset dan perbaikan perhitungan**: Chat menerima input riset lebih panjang dan memberi petunjuk dalam bahasa aktif untuk mempersingkat teks yang melampaui batas ([#1701](https://github.com/HKUDS/Vibe-Trading/pull/1701)). Sortino memakai deviasi penurunan dari seluruh periode; validasi grup membuang label yang tumpang tindih. Bobot kovarians, RSI dengan rata-rata awal Wilder, dan penghapusan memori lewat nama file juga diperbaiki. Alias panggilan yang keliru kini mendapat referensi sumber yang tepat untuk koreksi, dengan validasi angka tetap berlaku ([#1638](https://github.com/HKUDS/Vibe-Trading/pull/1638)).
 
 - **2026-10-04** 🛠️ **Laporan terjadwal dan alur riset**: Edit tugas terjadwal dan pilih tujuan yang sudah dikonfigurasi; laporan email mendukung HTML atau lampiran PDF ([#1649](https://github.com/HKUDS/Vibe-Trading/pull/1649), [#1680](https://github.com/HKUDS/Vibe-Trading/pull/1680)).
   Backtest menyediakan ringkasan terstruktur dan pembacaan artefak per halaman ([#1646](https://github.com/HKUDS/Vibe-Trading/pull/1646), [#1647](https://github.com/HKUDS/Vibe-Trading/pull/1647)). Perbaikan mencakup cuplikan pencarian memori, panduan lokasi ekspor, pemberitahuan pemangkasan data makro, risiko bulanan, turnover saat membalik posisi atau masuk kembali setelah menjadi kas, akurasi IV, celah VaR, pembaruan instalasi VCS, serta pemblokiran order opsi Robinhood yang belum didukung.
 
-- **2026-10-03** 🛠️ **Keandalan riset, laporan, dan data**: masalah pencarian sesi berbahasa Mandarin, Jepang, dan Korea, pengaturan kanal, penilaian posisi broker, serta penulisan berkas yang menghambat penggunaan sehari-hari telah diperbaiki. PDF menyertakan font CJK, Swarm memvalidasi masukan preset dan memisahkan keluaran tiap tugas, serta hasil alat yang digunakan kembali tetap tersedia setelah pemadatan konteks ([#1683](https://github.com/HKUDS/Vibe-Trading/pull/1683), [#1455](https://github.com/HKUDS/Vibe-Trading/pull/1455), [#1635](https://github.com/HKUDS/Vibe-Trading/pull/1635)). Backtest memakai dasar penyesuaian harga yang konsisten, cache lokal membedakan sumber, dan batas aset tunggal serta risiko mingguan/bulanan mengikuti pengaturan yang dinyatakan. Audit mempertahankan tanda kerugian, verifikasi angka memakai keluaran mesin saat ini dan referensi daftar yang tepat, serta Stooq mencoba lagi setelah masa tunggu akibat penolakan ([#1684](https://github.com/HKUDS/Vibe-Trading/pull/1684), [#1650](https://github.com/HKUDS/Vibe-Trading/pull/1650), [#1685](https://github.com/HKUDS/Vibe-Trading/pull/1685), [#1640](https://github.com/HKUDS/Vibe-Trading/pull/1640)).
-
 <details>
 <summary>Berita sebelumnya</summary>
 
+- **2026-10-03** 🛠️ **Keandalan riset, laporan, dan data**: masalah pencarian sesi berbahasa Mandarin, Jepang, dan Korea, pengaturan kanal, penilaian posisi broker, serta penulisan berkas yang menghambat penggunaan sehari-hari telah diperbaiki. PDF menyertakan font CJK, Swarm memvalidasi masukan preset dan memisahkan keluaran tiap tugas, serta hasil alat yang digunakan kembali tetap tersedia setelah pemadatan konteks ([#1683](https://github.com/HKUDS/Vibe-Trading/pull/1683), [#1455](https://github.com/HKUDS/Vibe-Trading/pull/1455), [#1635](https://github.com/HKUDS/Vibe-Trading/pull/1635)). Backtest memakai dasar penyesuaian harga yang konsisten, cache lokal membedakan sumber, dan batas aset tunggal serta risiko mingguan/bulanan mengikuti pengaturan yang dinyatakan. Audit mempertahankan tanda kerugian, verifikasi angka memakai keluaran mesin saat ini dan referensi daftar yang tepat, serta Stooq mencoba lagi setelah masa tunggu akibat penolakan ([#1684](https://github.com/HKUDS/Vibe-Trading
```

**File**: `README_ja.md` (modified, +4/-2)
```diff
@@ -52,16 +52,18 @@
 
 > ⚠️ **セキュリティ警告：** Xアカウント `VibeTrading_HKU`、Virtualsプロジェクト `101845`、およびトークンコントラクト `0x640BDBF77b6447E8b7DB7894cED84BD1c40571f4` は、いずれもVibe-Trading公式のものではありません。Vibe-Tradingはこれまで、いかなるトークンやミームコインも発行・公認していません。購入、ウォレットの接続、署名は行わないでください。[詳細](SECURITY.md#official-channels--impersonation)
 
+- **2026-10-06** 🛠️ **ライブ運用制御とレポート修正**：ライブランナーの停止は実行中の分析をキャンセルしてスケジューラーの終了を待ち、起動中のキャンセルと API 終了にも対応します。状態の時刻単位も修正しました（[#1704](https://github.com/HKUDS/Vibe-Trading/pull/1704)）。緊急キャンセル・決済処理は不正なレコードを除外して残りの注文・保有を処理します（[#1703](https://github.com/HKUDS/Vibe-Trading/pull/1703)）。ブローカーごとにスケジュールを保存し、並行書き込みと部分書き込みに対応。米国株の短縮取引日は早い閉場時刻を守ります（[#1706](https://github.com/HKUDS/Vibe-Trading/pull/1706)）。レポート修正は検証済みの数値を保持し、省略された指摘を検証済みと誤認させません（[#1702](https://github.com/HKUDS/Vibe-Trading/pull/1702)）。
+
 - **2026-10-05** 🛠️ **調査入力と計算の修正**：チャットで長い調査入力に対応し、上限を超えた場合は現在の言語で短縮を案内します（[#1701](https://github.com/HKUDS/Vibe-Trading/pull/1701)）。Sortino は全期間の下方偏差を使用し、グループ検証は重複ラベルを除外します。共分散ウェイト、Wilder 初期平均による RSI、ファイル名によるメモリ削除も改善しました。 呼び出しの別名を誤って引用した場合、修正用に実際のフィールド参照を提示します（[#1638](https://github.com/HKUDS/Vibe-Trading/pull/1638)）。数値の検証規則は維持されます。
 
 - **2026-10-04** 🛠️ **定期レポートと調査フローの改善**：定期タスクを編集し、設定済みの送信先を選択できます。メールレポートは HTML または PDF 添付に対応しました（[#1649](https://github.com/HKUDS/Vibe-Trading/pull/1649), [#1680](https://github.com/HKUDS/Vibe-Trading/pull/1680)）。
   バックテストに構造化サマリーと成果物のページ読み取りを追加（[#1646](https://github.com/HKUDS/Vibe-Trading/pull/1646), [#1647](https://github.com/HKUDS/Vibe-Trading/pull/1647)）。メモリ検索の抜粋、エクスポート先の案内、マクロデータの切り詰め表示、月足リスク、売買方向の反転・現金化後の再投資の回転率、IV 精度、VaR の欠損区間、VCS インストールの更新、Robinhood の未対応オプション注文の遮断も修正しました。
 
-- **2026-10-03** 🛠️ **調査・レポート・データの信頼性を改善**：中国語・日本語・韓国語のセッション検索、チャネル設定、証券会社の保有資産評価、ファイル書き込みで日常利用を妨げていた問題を修正。PDF 配信には CJK フォントを埋め込み、Swarm はプリセット入力を検証してタスクごとの成果物を分離し、再利用したツール結果はコンテキスト圧縮後も保持されます（[#1683](https://github.com/HKUDS/Vibe-Trading/pull/1683), [#1455](https://github.com/HKUDS/Vibe-Trading/pull/1455), [#1635](https://github.com/HKUDS/Vibe-Trading/pull/1635)）。バックテストは価格調整方式を統一し、ローカルキャッシュはデータソースを区別、単一資産の上限と週次・月次リスクは指定設定に従います。監査は損失の符号を保持し、数値検証は今回のエンジン出力と正確なリスト参照を使い、Stooq は拒否後の待機期間が過ぎると再試行できます（[#1684](https://github.com/HKUDS/Vibe-Trading/pull/1684), [#1650](https://github.com/HKUDS/Vibe-Trading/pull/1650), [#1685](https://github.com/HKUDS/Vibe-Trading/pull/1685), [#1640](https://github.com/HKUDS/Vibe-Trading/pull/1640)）。
-
 <details>
 <summary>過去のニュース</summary>
 
+- **2026-10-03** 🛠️ **調査・レポート・データの信頼性を改善**：中国語・日本語・韓国語のセッション検索、チャネル設定、証券会社の保有資産評価、ファイル書き込みで日常利用を妨げていた問題を修正。PDF 配信には CJK フォントを埋め込み、Swarm はプリセット入力を検証してタスクごとの成果物を分離し、再利用したツール結果はコンテキスト圧縮後も保持されます（[#1683](https://github.com/HKUDS/Vibe-Trading/pull/1683), [#1455](https://github.com/HKUDS/Vibe-Trading/pull/1455), [#1635](https://github.com/HKUDS/Vibe-Trading/pull/1635)）。バックテストは価格調整方式を統一し、ローカルキャッシュはデータソースを区別、単一資産の上限と週次・月次リスクは指定設定に従います。監査は損失の符号を保持し、数値検証は今回のエンジン出力と正確なリスト参照を使い、Stooq は拒否後の待機期間が過ぎると再試行できます（[#1684](https://github.com/HKUDS/Vibe-Trading/pull/1684), [#1650](https://github.com/HKUDS/Vibe-Trading/pull/1650), [#1685](https://github.com/HKUDS/Vibe-Trading/pull/1685), [#1640](https://github.com/HKUDS/Vibe-Trading/pull/1640)）。
+
 - **2026-10-02** 🛠️ **バックテストとレポート検証の修正**：戦略ファイルへの書き込みがクラッシュせずモデルの出所を保持します ([#1673](https://github.com/HKUDS/Vibe-Trading/pull/1673))。モンテカルロのドローダウンと Sharpe 計算に初期資金を含めます ([#1664](https://github.com/HKUDS/Vibe-Trading/pull/1664))。レポート監査は会計上の括弧付き負数と単位を保持し ([#1663](https://github.com/HKUDS/Vibe-Trading/pull/1663))、数値検証の成果物には実際に発火した宣言型チェックを記録します ([#1661](https://github.com/HKUDS/Vibe-Trading/pull/1661))。公開データソースのヘルスレポートに機密情報を除いた失敗理由を添え ([#1643](https://github.com/HKUDS/Vibe-Trading/pull/1643))、インドネシア語のツール文書をレジストリに合わせました ([#1671](https://github.com/HKUDS/Vibe-Trading/pull/1671))。
 
 - **2026-10-01** ✅ **データの正確性と再現可能なバックテスト**：A 株の調整価格変換は曖昧な 1 本のバーの境界ケースを拒否します ([#1551](https://github.com/HKUDS/Vibe-Trading/pull/1551))。南向き資金の東方財富データは百万香港ドルから換算し、失敗応答を空データと扱いません ([#1486](https://github.com/HKUDS/Vibe-Trading/pull/1486))。北向き資金の代替ソースは 2024-08-19 以降の売買代金と純流入を区別します ([#1484](https://github.com/HKUDS/Vibe-Trading/pull/1484))。Binance の未評価ポジションだけを不完全とし、他のブローカーには影響させません ([#1505](https://github.com/HKUDS/Vibe-Trading/pull/1505))。実行カードにモデルの出所を記録し、学習期限が不明またはテスト期間外の場合に警告します ([#1618](https://github.com/HKUDS/Vibe-Trading/pull/1618))。
```

**File**: `README_ko.md` (modified, +4/-2)
```diff
@@ -52,16 +52,18 @@
 
 > ⚠️ **보안 경고:** X 계정 `VibeTrading_HKU`, Virtuals 프로젝트 `101845`, 토큰 컨트랙트 `0x640BDBF77b6447E8b7DB7894cED84BD1c40571f4`는 모두 Vibe-Trading 공식과 무관합니다. Vibe-Trading은 어떠한 토큰이나 밈코인도 발행하거나 공식적으로 지지한 적이 없습니다. 해당 토큰을 구매하거나 지갑을 연결하거나 어떠한 서명도 하지 마세요. [자세히 보기](SECURITY.md#official-channels--impersonation).
 
+- **2026-10-06** 🛠️ **실거래 제어와 보고서 수정**: 실거래 러너 중지는 현재 분석을 취소하고 스케줄러 종료를 기다리며 시작 중 취소와 API 종료도 처리합니다. 상태 시간의 단위도 수정했습니다([#1704](https://github.com/HKUDS/Vibe-Trading/pull/1704)). 긴급 취소·청산은 잘못된 레코드를 건너뛰고 나머지 주문과 포지션을 계속 처리합니다([#1703](https://github.com/HKUDS/Vibe-Trading/pull/1703)). 증권사별 일정을 따로 저장하고 동시 쓰기와 부분 쓰기를 처리합니다. 미국 주식 단축 거래일의 조기 폐장 시간을 반영합니다([#1706](https://github.com/HKUDS/Vibe-Trading/pull/1706)). 보고서 수정은 검증된 수치를 유지하며 생략된 오류가 검증을 통과한 것처럼 안내하지 않습니다([#1702](https://github.com/HKUDS/Vibe-Trading/pull/1702)).
+
 - **2026-10-05** 🛠️ **리서치 입력과 계산 수정**: 더 긴 리서치 입력을 지원하며 한도를 넘으면 현재 언어로 줄이도록 안내합니다([#1701](https://github.com/HKUDS/Vibe-Trading/pull/1701)). Sortino는 전체 기간의 하방 편차를 사용하고 그룹 검증은 겹치는 레이블을 제외합니다. 공분산 가중치, Wilder 초기 평균을 사용하는 RSI, 파일명으로 메모리 삭제도 개선했습니다. 잘못된 호출 별칭을 인용하면 수정할 수 있도록 실제 필드 참조를 안내하며 수치 검증 규칙은 유지합니다([#1638](https://github.com/HKUDS/Vibe-Trading/pull/1638)).
 
 - **2026-10-04** 🛠️ **예약 보고서와 리서치 흐름 개선**: 예약 작업을 편집하고 설정된 수신 대상을 선택할 수 있습니다. 이메일 보고서는 HTML 또는 PDF 첨부를 지원합니다([#1649](https://github.com/HKUDS/Vibe-Trading/pull/1649), [#1680](https://github.com/HKUDS/Vibe-Trading/pull/1680)).
   백테스트에 구조화된 요약과 결과 파일 페이지 읽기를 추가했습니다([#1646](https://github.com/HKUDS/Vibe-Trading/pull/1646), [#1647](https://github.com/HKUDS/Vibe-Trading/pull/1647)). 메모리 검색 미리보기, 내보내기 경로 안내, 매크로 데이터 잘림 표시, 월봉 리스크, 포지션 반전과 현금화 후 재진입의 회전율, IV 정확도, VaR 결측 구간, VCS 설치 업데이트, Robinhood의 미지원 옵션 주문 차단도 수정했습니다.
 
-- **2026-10-03** 🛠️ **리서치·보고서·데이터 신뢰성 개선**: 중국어·일본어·한국어 세션 검색, 채널 설정, 증권사 보유 자산 평가와 파일 쓰기에서 일상적인 사용을 막던 문제를 수정했습니다. PDF 전달 시 CJK 글꼴을 포함하고, Swarm은 프리셋 입력을 검증하며 작업별 산출물을 분리하고, 재사용한 도구 결과는 컨텍스트 압축 후에도 유지됩니다([#1683](https://github.com/HKUDS/Vibe-Trading/pull/1683), [#1455](https://github.com/HKUDS/Vibe-Trading/pull/1455), [#1635](https://github.com/HKUDS/Vibe-Trading/pull/1635)). 백테스트의 가격 조정 기준을 통일하고 로컬 캐시는 데이터 소스를 구분하며, 단일 자산 한도와 주간·월간 위험 계산은 지정된 설정을 따릅니다. 감사는 손실 부호를 유지하고 수치 검증은 이번 엔진 출력과 정확한 목록 참조를 사용하며, Stooq은 거부 후 대기 시간이 지나면 재시도합니다([#1684](https://github.com/HKUDS/Vibe-Trading/pull/1684), [#1650](https://github.com/HKUDS/Vibe-Trading/pull/1650), [#1685](https://github.com/HKUDS/Vibe-Trading/pull/1685), [#1640](https://github.com/HKUDS/Vibe-Trading/pull/1640)).
-
 <details>
 <summary>이전 뉴스</summary>
 
+- **2026-10-03** 🛠️ **리서치·보고서·데이터 신뢰성 개선**: 중국어·일본어·한국어 세션 검색, 채널 설정, 증권사 보유 자산 평가와 파일 쓰기에서 일상적인 사용을 막던 문제를 수정했습니다. PDF 전달 시 CJK 글꼴을 포함하고, Swarm은 프리셋 입력을 검증하며 작업별 산출물을 분리하고, 재사용한 도구 결과는 컨텍스트 압축 후에도 유지됩니다([#1683](https://github.com/HKUDS/Vibe-Trading/pull/1683), [#1455](https://github.com/HKUDS/Vibe-Trading/pull/1455), [#1635](https://github.com/HKUDS/Vibe-Trading/pull/1635)). 백테스트의 가격 조정 기준을 통일하고 로컬 캐시는 데이터 소스를 구분하며, 단일 자산 한도와 주간·월간 위험 계산은 지정된 설정을 따릅니다. 감사는 손실 부호를 유지하고 수치 검증은 이번 엔진 출력과 정확한 목록 참조를 사용하며, Stooq은 거부 후 대기 시간이 지나면 재시도합니다([#1684](https://github.com/HKUDS/Vibe-Trading/pull/1684), [#1650](https://github.com/HKUDS/Vibe-Trading/pull/1650), [#1685](https://github.com/HKUDS/Vibe-Trading/pull/1685), [#1640](https://github.com/HKUDS/Vibe-Trading/pull/1640)).
+
 - **2026-10-02** 🛠️ **백테스트와 보고서 검증 수정**: 전략 파일 쓰기가 충돌 없이 모델 출처를 유지하고 ([#1673](https://github.com/HKUDS/Vibe-Trading/pull/1673)), 몬테카를로 낙폭과 Sharpe 계산에 초기 자본을 포함합니다 ([#1664](https://github.com/HKUDS/Vibe-Trading/pull/1664)). 보고서 감사는 회계식 괄호 음수와 단위를 보존하며 ([#1663](https://github.com/HKUDS/Vibe-Trading/pull/1663)), 수치 검증 산출물은 발동된 선언형 검사를 기록합니다 ([#1661](https://github.com/HKUDS/Vibe-Trading/pull/1661)). 공개 데이터 소스 상태 보고서에는 민감 정보를 제거한 실패 이유를 담고 ([#1643](https://github.com/HKUDS/Vibe-Trading/pull/1643)), 인도네시아어 도구 문서를 레지스트리에 맞췄습니다 ([#1671](https://github.com/HKUDS/Vibe-Trading/pull/1671)).
 
 - **2026-10-01** ✅ **데이터 정확성과 재현 가능한 백테스트**: A주 수정주가 변환은 모호한 단일 봉 경계 사례를 거부합니다 ([#1551](https://github.com/HKUDS/Vibe-Trading/pull/1551)). 남향 자금의 Eastmoney 금액은 백만 HKD 단위에서 환산하고 실패 응답을 빈 데이터로 처리하지 않습니다 ([#1486](https://github.com/HKUDS/Vibe-Trading/pull/1486)). 북향 자금 대체 소스는 2024-08-19 이후 거래대금과 순유입을 구분합니다 ([#1484](https://github.com/HKUDS/Vibe-Trading/pull/1484)). Binance의 미평가 포지션만 불완전으로 표시하며 다른 브로커에는 영향을 주지 않습니다 ([#1505](https://github.com/HKUDS/Vibe-Trading/pull/1505)). 실행 카드는 모델 출처를 기록하고 학습 기준일이 불명확하거나 테스트 기간 밖이면 경고합니다 ([#1618](https://github.com/HKUDS/Vibe-Trading/pull/1618)).
```

**File**: `README_zh.md` (modified, +4/-2)
```diff
@@ -52,16 +52,18 @@
 
 > ⚠️ **安全警告：** X 账号 `VibeTrading_HKU`、Virtuals 项目 `101845` 及代币合约 `0x640BDBF77b6447E8b7DB7894cED84BD1c40571f4` 均非 Vibe-Trading 官方。我们从未发行或背书任何代币或 meme 币。请勿购买、连接钱包或签名。[详细说明](SECURITY.md#official-channels--impersonation)。
 
+- **2026-10-06** 🛠️ **实盘控制与报告纠错修复**：停止实盘运行会取消当前分析并等待调度器完成清理，覆盖启动期间取消及 API 关闭，运行状态时间单位也已修正（[#1704](https://github.com/HKUDS/Vibe-Trading/pull/1704)）。紧急撤单／平仓扫描跳过异常记录，继续处理其余订单和持仓（[#1703](https://github.com/HKUDS/Vibe-Trading/pull/1703)）；不同券商的调度独立保存，持久化正确处理并发写入与短写入。美股半日交易遵循提前收市时间（[#1706](https://github.com/HKUDS/Vibe-Trading/pull/1706)）。报告纠错保留已核验通过的数字，反馈截断也不会暗示未列出的数字已通过（[#1702](https://github.com/HKUDS/Vibe-Trading/pull/1702)）。
+
 - **2026-10-05** 🛠️ **研究输入与计算修复**：聊天支持更长的研究输入，超限时以当前语言提示缩短（[#1701](https://github.com/HKUDS/Vibe-Trading/pull/1701)）。回测 Sortino 使用全样本下行偏差；分组验证剔除重叠标签，协方差权重保持有限，影子账户 RSI 使用 Wilder 初始均值，记忆支持按文件名删除。 报告误用调用别名时，纠正提示提供真实字段引用（[#1638](https://github.com/HKUDS/Vibe-Trading/pull/1638)），数值校验保持不变。
 
 - **2026-10-04** 🛠️ **定时报告与研究流程完善**：定时任务支持编辑并选择已配置的交付目标，邮件报告可选 HTML 或 PDF 附件（[#1649](https://github.com/HKUDS/Vibe-Trading/pull/1649), [#1680](https://github.com/HKUDS/Vibe-Trading/pull/1680)）。
   回测提供结构化摘要与产物分页读取（[#1646](https://github.com/HKUDS/Vibe-Trading/pull/1646), [#1647](https://github.com/HKUDS/Vibe-Trading/pull/1647)）；同时修复记忆搜索片段、导出路径提示、宏观数据截断说明、月线风险、反向持仓及清仓后重新入场的换手率、隐含波动率精度、VaR 缺口、源码安装更新，以及 Robinhood 不受支持的期权下单拦截。
 
-- **2026-10-03** 🛠️ **研究、报告与数据可靠性修复**：修复中文、日文和韩文会话搜索、渠道设置、券商持仓估值与文件写入中阻碍日常使用的问题。PDF 交付嵌入中日韩字体，Swarm 校验预设输入并隔离各任务产物，回放的工具结果在上下文压缩后仍可用（[#1683](https://github.com/HKUDS/Vibe-Trading/pull/1683), [#1455](https://github.com/HKUDS/Vibe-Trading/pull/1455), [#1635](https://github.com/HKUDS/Vibe-Trading/pull/1635)）。回测保持一致复权口径，本地缓存区分数据来源，单资产上限与周/月风险计算遵循声明设置，审计保留亏损符号，数值核验绑定本次引擎输出及准确列表引用，Stooq 拒绝冷却后允许重试（[#1684](https://github.com/HKUDS/Vibe-Trading/pull/1684), [#1650](https://github.com/HKUDS/Vibe-Trading/pull/1650), [#1685](https://github.com/HKUDS/Vibe-Trading/pull/1685), [#1640](https://github.com/HKUDS/Vibe-Trading/pull/1640)）。
-
 <details>
 <summary>更早的新闻</summary>
 
+- **2026-10-03** 🛠️ **研究、报告与数据可靠性修复**：修复中文、日文和韩文会话搜索、渠道设置、券商持仓估值与文件写入中阻碍日常使用的问题。PDF 交付嵌入中日韩字体，Swarm 校验预设输入并隔离各任务产物，回放的工具结果在上下文压缩后仍可用（[#1683](https://github.com/HKUDS/Vibe-Trading/pull/1683), [#1455](https://github.com/HKUDS/Vibe-Trading/pull/1455), [#1635](https://github.com/HKUDS/Vibe-Trading/pull/1635)）。回测保持一致复权口径，本地缓存区分数据来源，单资产上限与周/月风险计算遵循声明设置，审计保留亏损符号，数值核验绑定本次引擎输出及准确列表引用，Stooq 拒绝冷却后允许重试（[#1684](https://github.com/HKUDS/Vibe-Trading/pull/1684), [#1650](https://github.com/HKUDS/Vibe-Trading/pull/1650), [#1685](https://github.com/HKUDS/Vibe-Trading/pull/1685), [#1640](https://github.com/HKUDS/Vibe-Trading/pull/1640)）。
+
 - **2026-10-02** 🛠️ **回测与报告核验修复**：策略文件写入保留模型来源，不再崩溃 ([#1673](https://github.com/HKUDS/Vibe-Trading/pull/1673))；蒙特卡洛回撤与 Sharpe 计算纳入初始资金 ([#1664](https://github.com/HKUDS/Vibe-Trading/pull/1664))。报告审计保留会计括号负数及单位 ([#1663](https://github.com/HKUDS/Vibe-Trading/pull/1663))，数值核验制品记录已触发的声明式检查 ([#1661](https://github.com/HKUDS/Vibe-Trading/pull/1661))，公开数据源健康报告附带脱敏后的失败原因 ([#1643](https://github.com/HKUDS/Vibe-Trading/pull/1643))。印尼语工具文档与注册表同步 ([#1671](https://github.com/HKUDS/Vibe-Trading/pull/1671))。
 
 - **2026-10-01** ✅ **数据正确性与可复现回测**：A 股复权转换拒绝有歧义的单根 K 线边界 ([#1551](https://github.com/HKUDS/Vibe-Trading/pull/1551))；南向东财金额按百万港元缩放，失败响应不再被当作空数据 ([#1486](https://github.com/HKUDS/Vibe-Trading/pull/1486))；北向备用源区分 2024-08-19 后的成交额与净流入 ([#1484](https://github.com/HKUDS/Vibe-Trading/pull/1484))。币安未定价持仓标记为不完整，不影响其他券商 ([#1505](https://github.com/HKUDS/Vibe-Trading/pull/1505))；回测运行卡记录模型来源，并提示训练截止日期未知或不在回测区间内 ([#1618](https://github.com/HKUDS/Vibe-Trading/pull/1618))。
```

**File**: `agent/api_server.py` (modified, +4/-10)
```diff
@@ -114,13 +114,14 @@
 console = Console()
 logger = logging.getLogger(__name__)
 
-from src.api.channels_routes import (  # noqa: E402
+from src.api.channels_routes import (  # noqa: F401, E402
     _start_channel_runtime,
     _stop_channel_runtime,
 )
-from src.api.scheduled_routes import (  # noqa: E402
+from src.api.scheduled_routes import (  # noqa: F401, E402
     _start_scheduled_research_executor,
     _stop_scheduled_research_executor,
+    _stop_scheduled_research_on_shutdown,
 )
 
 
@@ -142,14 +143,6 @@ async def _run_startup_preflight() -> None:
         await _start_channel_runtime()
 
 
-async def _stop_scheduled_research_on_shutdown() -> None:
-    """Stop the scheduled research executor on server shutdown."""
-    try:
-        await _stop_channel_runtime()
-    finally:
-        await _stop_scheduled_research_executor()
-
-
 @asynccontextmanager
 async def _lifespan(_: FastAPI) -> AsyncIterator[None]:
     """Run API startup and guaranteed reverse-order shutdown."""
@@ -288,6 +281,7 @@ async def _lifespan(_: FastAPI) -> AsyncIterator[None]:
     _live_broker_adapter,
     _build_live_runner,
     _drive_runner,
+    _stop_live_runners,
     _connector_verify_cache,
     _check_connector_status,
 )
```

---

### Incident Patch 2: `785c757c` (2026-10-05)
**Commit Message**: Merge PR #1706: respect US equity early closes

**File**: `agent/src/live/runtime/triggers.py` (modified, +25/-7)
```diff
@@ -47,8 +47,11 @@ class _MarketSpec:
             Empty == every day (24/7 markets such as crypto).
         always_open: Short-circuit for 24/7 markets; when ``True`` the time /
             weekday / holiday checks are skipped entirely.
-        holidays: Full-day market closures (no half-days modelled). This is a
-            deliberately small, static set — see module docstring limitation.
+        holidays: Full-day market closures. This is a deliberately small,
+            static set — see module docstring limitation.
+        early_closes: Half-day sessions, mapped to their early close bell
+            (exclusive, same convention as ``close_time``). Dates here must
+            not also appear in ``holidays``.
     """
 
     tz: str
@@ -57,12 +60,13 @@ class _MarketSpec:
     weekdays: frozenset[int] = frozenset()
     always_open: bool = False
     holidays: frozenset[date] = field(default_factory=frozenset)
+    early_closes: Mapping[date, time] = field(default_factory=dict)
 
 
 # US market holidays. LIMITATION: this is a hand-maintained static set (no
-# half-day early closes, no rolling computation). It covers the current and
-# next calendar year; extend as needed. A production deploy that needs decades
-# of coverage should swap in `pandas_market_calendars` behind this same spec.
+# rolling computation). It covers the current and next calendar year; extend as
+# needed. A production deploy that needs decades of coverage should swap in
+# `pandas_market_calendars` behind this same spec.
 _US_EQUITY_HOLIDAYS: frozenset[date] = frozenset(
     {
         # 2026
@@ -90,6 +94,17 @@ class _MarketSpec:
     }
 )
 
+# NYSE 13:00 ET early closes within the holiday window above. The recurring
+# cases are the day after Thanksgiving and Christmas Eve when it is a weekday
+# and not itself the observed holiday; Independence Day adds no entry here
+# because in both covered years its early-close candidate (Jul 3) is either the
+# observed full-day closure (2026) or a Saturday (2027).
+_US_EQUITY_EARLY_CLOSES: Mapping[date, time] = {
+    date(2026, 11, 27): time(13, 0),  # day after Thanksgiving
+    date(2026, 12, 24): time(13, 0),  # Christmas Eve (Thursday)
+    date(2027, 11, 26): time(13, 0),  # day after Thanksgiving
+}
+
 _WEEKDAYS_MON_FRI = frozenset({0, 1, 2, 3, 4})
 
 # Market registry. Keys match the AssetClass-style identifiers the runner uses
@@ -101,6 +116,7 @@ class _MarketSpec:
         close_time=time(16, 0),
         weekdays=_WEEKDAYS_MON_FRI,
         holidays=_US_EQUITY_HOLIDAYS,
+        early_closes=_US_EQUITY_EARLY_CLOSES,
     ),
     "crypto": _MarketSpec(
         tz="UTC",
@@ -263,7 +279,8 @@ def market_is_open_at(market: str, now_ms: int) -> bool:
 
     Deterministic — reads no clock. 24/7 markets (``always_open``) are always
     open. Session markets are open only on permitted weekdays, outside the
-    holiday set, and within ``[open_time, close_time)`` local time.
+    holiday set, and within ``[open_time, close)`` local time, where the close
+    bell moves earlier on a listed early-close day.
 
     Args:
         market: A key into :data:`MARKET_SPECS`.
@@ -287,7 +304,8 @@ def market_is_open_at(market: str, now_ms: int) -> bool:
         return False
     if local_dt.date() in spec.holidays:
         return False
-    return spec.open_time <= local_dt.time() < spec.close_time
+    close = spec.early_closes.get(local_dt.date(), spec.close_time)
+    return spec.open_time <= local_dt.time() < close
 
 
 def due_now(trigger: Trigger, now_ms: int, *, event_state: Mapping[str, object] | None = None) -> bool:
```

**File**: `agent/tests/test_runtime_triggers.py` (modified, +42/-0)
```diff
@@ -69,6 +69,47 @@ def test_us_equity_open_windows(now_ms: int, expected: bool) -> None:
     assert market_is_open_at("us_equity", now_ms) is expected
 
 
+# 2026-11-27 is the Friday after Thanksgiving: NYSE closes at 13:00 ET.
+_BF_2026 = (2026, 11, 27)
+# 2026-12-24 is a Thursday Christmas Eve: NYSE closes at 13:00 ET.
+_XMAS_EVE_2026 = (2026, 12, 24)
+# 2027-11-26 is the Friday after Thanksgiving 2027.
+_BF_2027 = (2027, 11, 26)
+
+
+@pytest.mark.parametrize(
+    ("now_ms", "expected"),
+    [
+        (_ms(*_BF_2026, 9, 30, "America/New_York"), True),
+        (_ms(*_BF_2026, 12, 59, "America/New_York"), True),
+        # The early bell is exclusive, same convention as the 16:00 close.
+        (_ms(*_BF_2026, 13, 0, "America/New_York"), False),
+        (_ms(*_BF_2026, 13, 30, "America/New_York"), False),
+        (_ms(*_BF_2026, 15, 30, "America/New_York"), False),
+        (_ms(*_XMAS_EVE_2026, 12, 59, "America/New_York"), True),
+        (_ms(*_XMAS_EVE_2026, 13, 0, "America/New_York"), False),
+        (_ms(*_BF_2027, 12, 59, "America/New_York"), True),
+        (_ms(*_BF_2027, 13, 0, "America/New_York"), False),
+    ],
+)
+def test_us_equity_early_close_windows(now_ms: int, expected: bool) -> None:
+    assert market_is_open_at("us_equity", now_ms) is expected
+
+
+def test_us_equity_observed_christmas_stays_a_full_closure() -> None:
+    # 2027-12-24 is the observed Christmas holiday, not an early close: the
+    # morning session must not trade either.
+    assert market_is_open_at("us_equity", _ms(2027, 12, 24, 10, 0, "America/New_York")) is False
+
+
+def test_early_close_table_is_internally_consistent() -> None:
+    spec = triggers.MARKET_SPECS["us_equity"]
+    for day, bell in spec.early_closes.items():
+        assert day.weekday() in spec.weekdays
+        assert day not in spec.holidays
+        assert spec.open_time < bell < spec.close_time
+
+
 def test_us_equity_uses_ny_local_not_utc() -> None:
     # 14:00 UTC on the Friday is 10:00 ET — inside RTH despite 14:00 looking
     # like afternoon if (wrongly) read as local.
@@ -183,6 +224,7 @@ def test_market_field_default_and_factory_are_both_intact() -> None:
 @pytest.mark.parametrize("decorate", [False, True])
 def test_market_factory_binds_to_subclass(decorate: bool) -> None:
     """The deferred factory must retain normal classmethod inheritance."""
+
     class DerivedTrigger(Trigger):
         pass
 
```

---

### Incident Patch 3: `d4c15980` (2026-10-05)
**Commit Message**: fix(live): close the us_equity session at the early bell on half-days

MARKET_SPECS only modelled full-day holidays, so on NYSE early-close
days (day after Thanksgiving, weekday Christmas Eve) the market-hours
gate stayed open until 16:00 ET and the runner ticked a closed market
all afternoon: reconcile, agent invoke, audit.

_MarketSpec now carries an early_closes date -> bell mapping and
market_is_open_at resolves the close per date. The static table covers
the same 2026/2027 window as the holiday set.

Signed-off-by: Yufeng He <[REDACTED_EMAIL]>

**File**: `agent/src/live/runtime/triggers.py` (modified, +25/-7)
```diff
@@ -47,8 +47,11 @@ class _MarketSpec:
             Empty == every day (24/7 markets such as crypto).
         always_open: Short-circuit for 24/7 markets; when ``True`` the time /
             weekday / holiday checks are skipped entirely.
-        holidays: Full-day market closures (no half-days modelled). This is a
-            deliberately small, static set — see module docstring limitation.
+        holidays: Full-day market closures. This is a deliberately small,
+            static set — see module docstring limitation.
+        early_closes: Half-day sessions, mapped to their early close bell
+            (exclusive, same convention as ``close_time``). Dates here must
+            not also appear in ``holidays``.
     """
 
     tz: str
@@ -57,12 +60,13 @@ class _MarketSpec:
     weekdays: frozenset[int] = frozenset()
     always_open: bool = False
     holidays: frozenset[date] = field(default_factory=frozenset)
+    early_closes: Mapping[date, time] = field(default_factory=dict)
 
 
 # US market holidays. LIMITATION: this is a hand-maintained static set (no
-# half-day early closes, no rolling computation). It covers the current and
-# next calendar year; extend as needed. A production deploy that needs decades
-# of coverage should swap in `pandas_market_calendars` behind this same spec.
+# rolling computation). It covers the current and next calendar year; extend as
+# needed. A production deploy that needs decades of coverage should swap in
+# `pandas_market_calendars` behind this same spec.
 _US_EQUITY_HOLIDAYS: frozenset[date] = frozenset(
     {
         # 2026
@@ -90,6 +94,17 @@ class _MarketSpec:
     }
 )
 
+# NYSE 13:00 ET early closes within the holiday window above. The recurring
+# cases are the day after Thanksgiving and Christmas Eve when it is a weekday
+# and not itself the observed holiday; Independence Day adds no entry here
+# because in both covered years its early-close candidate (Jul 3) is either the
+# observed full-day closure (2026) or a Saturday (2027).
+_US_EQUITY_EARLY_CLOSES: Mapping[date, time] = {
+    date(2026, 11, 27): time(13, 0),  # day after Thanksgiving
+    date(2026, 12, 24): time(13, 0),  # Christmas Eve (Thursday)
+    date(2027, 11, 26): time(13, 0),  # day after Thanksgiving
+}
+
 _WEEKDAYS_MON_FRI = frozenset({0, 1, 2, 3, 4})
 
 # Market registry. Keys match the AssetClass-style identifiers the runner uses
@@ -101,6 +116,7 @@ class _MarketSpec:
         close_time=time(16, 0),
         weekdays=_WEEKDAYS_MON_FRI,
         holidays=_US_EQUITY_HOLIDAYS,
+        early_closes=_US_EQUITY_EARLY_CLOSES,
     ),
     "crypto": _MarketSpec(
         tz="UTC",
@@ -263,7 +279,8 @@ def market_is_open_at(market: str, now_ms: int) -> bool:
 
     Deterministic — reads no clock. 24/7 markets (``always_open``) are always
     open. Session markets are open only on permitted weekdays, outside the
-    holiday set, and within ``[open_time, close_time)`` local time.
+    holiday set, and within ``[open_time, close)`` local time, where the close
+    bell moves earlier on a listed early-close day.
 
     Args:
         market: A key into :data:`MARKET_SPECS`.
@@ -287,7 +304,8 @@ def market_is_open_at(market: str, now_ms: int) -> bool:
         return False
     if local_dt.date() in spec.holidays:
         return False
-    return spec.open_time <= local_dt.time() < spec.close_time
+    close = spec.early_closes.get(local_dt.date(), spec.close_time)
+    return spec.open_time <= local_dt.time() < close
 
 
 def due_now(trigger: Trigger, now_ms: int, *, event_state: Mapping[str, object] | None = None) -> bool:
```

**File**: `agent/tests/test_runtime_triggers.py` (modified, +42/-0)
```diff
@@ -69,6 +69,47 @@ def test_us_equity_open_windows(now_ms: int, expected: bool) -> None:
     assert market_is_open_at("us_equity", now_ms) is expected
 
 
+# 2026-11-27 is the Friday after Thanksgiving: NYSE closes at 13:00 ET.
+_BF_2026 = (2026, 11, 27)
+# 2026-12-24 is a Thursday Christmas Eve: NYSE closes at 13:00 ET.
+_XMAS_EVE_2026 = (2026, 12, 24)
+# 2027-11-26 is the Friday after Thanksgiving 2027.
+_BF_2027 = (2027, 11, 26)
+
+
+@pytest.mark.parametrize(
+    ("now_ms", "expected"),
+    [
+        (_ms(*_BF_2026, 9, 30, "America/New_York"), True),
+        (_ms(*_BF_2026, 12, 59, "America/New_York"), True),
+        # The early bell is exclusive, same convention as the 16:00 close.
+        (_ms(*_BF_2026, 13, 0, "America/New_York"), False),
+        (_ms(*_BF_2026, 13, 30, "America/New_York"), False),
+        (_ms(*_BF_2026, 15, 30, "America/New_York"), False),
+        (_ms(*_XMAS_EVE_2026, 12, 59, "America/New_York"), True),
+        (_ms(*_XMAS_EVE_2026, 13, 0, "America/New_York"), False),
+        (_ms(*_BF_2027, 12, 59, "America/New_York"), True),
+        (_ms(*_BF_2027, 13, 0, "America/New_York"), False),
+    ],
+)
+def test_us_equity_early_close_windows(now_ms: int, expected: bool) -> None:
+    assert market_is_open_at("us_equity", now_ms) is expected
+
+
+def test_us_equity_observed_christmas_stays_a_full_closure() -> None:
+    # 2027-12-24 is the observed Christmas holiday, not an early close: the
+    # morning session must not trade either.
+    assert market_is_open_at("us_equity", _ms(2027, 12, 24, 10, 0, "America/New_York")) is False
+
+
+def test_early_close_table_is_internally_consistent() -> None:
+    spec = triggers.MARKET_SPECS["us_equity"]
+    for day, bell in spec.early_closes.items():
+        assert day.weekday() in spec.weekdays
+        assert day not in spec.holidays
+        assert spec.open_time < bell < spec.close_time
+
+
 def test_us_equity_uses_ny_local_not_utc() -> None:
     # 14:00 UTC on the Friday is 10:00 ET — inside RTH despite 14:00 looking
     # like afternoon if (wrongly) read as local.
@@ -183,6 +224,7 @@ def test_market_field_default_and_factory_are_both_intact() -> None:
 @pytest.mark.parametrize("decorate", [False, True])
 def test_market_factory_binds_to_subclass(decorate: bool) -> None:
     """The deferred factory must retain normal classmethod inheritance."""
+
     class DerivedTrigger(Trigger):
         pass
 
```

---

### Incident Patch 4: `a6651131` (2026-10-05)
**Commit Message**: fix(live): keep the runner driver alive for the scheduler's lifetime

`_drive_runner` awaited `LiveRunner.run_loop()` to completion and then
returned. `run_loop` is fire-and-forget: it resolves the jobs, calls
`Scheduler.start()` — which only spawns the loop task — and returns. The
task wrapping the driver is the only handle `POST /live/runner/stop`
holds, and its `add_done_callback` unregisters the task the moment the
driver returns. The result is that a runner whose driver returned keeps
firing `run_once()` on its cadence while `stop` answers
`was_running: false`, so the loop is never torn down and cannot be
stopped through the API.

Park the driver on the scheduler's loop task instead, so the driver's
lifetime is the scheduler's lifetime. Cancelling the driver then
actually stops trading. Teardown goes through `Scheduler.stop()` in a
`finally`, tolerant of both sync and async `stop` implementations.

Both helper reads are `getattr`-defensive: neither `LiveRunner` nor
`Scheduler` publishes an accessor for the loop task, so private access
is the only option without widening the change. A runner whose `run_loop`
declined to start — no scheduler, or a missing or expired mandate —
le

**File**: `agent/src/api/live_routes.py` (modified, +66/-1)
```diff
@@ -722,14 +722,79 @@ async def _on_fire(_job: Any) -> None:
     return runner
 
 
+def _runner_scheduler_task(runner: Any) -> Optional["asyncio.Task[Any]"]:
+    """Return the live task driving the runner's scheduler, or ``None``.
+
+    Neither ``LiveRunner`` nor ``Scheduler`` exposes a public accessor for the
+    scheduler loop task (``LiveRunner`` only publishes ``runner_id``;
+    ``Scheduler``'s public surface is ``start``/``stop``/``add_job``/
+    ``remove_job``/``jobs``), so both hops are read defensively with
+    ``getattr``. A runner whose ``run_loop`` declined to start — no mandate, or
+    an expired one (``runner.py`` returns before calling ``Scheduler.start``) —
+    leaves ``_task`` unset and has nothing to await.
+    """
+    task = getattr(getattr(runner, "_scheduler", None), "_task", None)
+    if task is None or task.done():
+        return None
+    return task
+
+
+async def _stop_scheduler(runner: Any) -> None:
+    """Tear the runner's scheduler down, tolerating a sync or async ``stop``.
+
+    ``Scheduler.stop`` is a coroutine function, but the ``_Scheduler`` protocol
+    in ``runner.py`` types ``stop`` as returning ``Any``, so injected doubles may
+    be plain callables. Teardown is best-effort: a scheduler that refuses to
+    stop must not turn into an unhandled error inside the driver task.
+    """
+    stop = getattr(getattr(runner, "_scheduler", None), "stop", None)
+    if stop is None:
+        return
+    try:
+        result = stop()
+        if asyncio.iscoroutine(result):
+            await result
+    except Exception:  # noqa: BLE001 - teardown is best-effort by contract
+        logger.warning(
+            "live scheduler teardown failed for %s",
+            getattr(runner, "broker", "?"),
+            exc_info=True,
+        )
+
+
 async def _drive_runner(runner: Any) -> None:
-    """Run a runner's ``run_loop`` to completion, sync or async."""
+    """Run a runner's ``run_loop`` and stay alive for as long as its scheduler.
+
+    ``run_loop`` is fire-and-forget: it resolves the jobs, calls
+    ``Scheduler.start()`` (which only spawns the loop task) and returns. The
+    task wrapping this coroutine is the *only* handle
+    ``POST /live/runner/stop`` holds, and its ``add_done_callback`` unregisters
+    it the moment this coroutine returns — so a driver that returned alongside
+    ``run_loop`` would leave the scheduler firing ``run_once()`` on its cadence
+    while ``stop`` answered ``was_running: false``.
+
+    Keeping this coroutine parked on the scheduler task makes the driver's
+    lifetime the scheduler's lifetime, so cancelling it actually stops trading.
+    """
     result = runner.run_loop()
     if asyncio.iscoroutine(result):
         await result
     else:
         await asyncio.get_running_loop().run_in_executor(None, lambda: result)
 
+    scheduler_task = _runner_scheduler_task(runner)
+    if scheduler_task is None:
+        # ``run_loop`` declined to start (missing or expired mandate): there is
+        # no scheduler to own, so the driver returns immediately as before.
+        return
+
+    try:
+        # Shielded: cancelling this task is precisely what ``stop`` does, and the
+        # teardown below is what has to reach the scheduler loop task.
+        await asyncio.shield(scheduler_task)
+    finally:
+        await _stop_scheduler(runner)
+
 
 # ============================================================================
 # Route registration
```

**File**: `agent/tests/test_api_live_runtime.py` (modified, +266/-0)
```diff
@@ -13,10 +13,12 @@
 
 from __future__ import annotations
 
+import asyncio
 import json
 from pathlib import Path
 from types import SimpleNamespace
 
+import httpx
 from fastapi.testclient import TestClient
 
 import pytest
@@ -242,6 +244,270 @@ def cancel(self) -> None:
     assert cancelled["value"] is True
 
 
+# --------------------------------------------------------------------------- #
+# Runner stop must actually stop the scheduler (R-INT lifecycle)
+# --------------------------------------------------------------------------- #
+
+
+def _live_env(tmp_path: Path, monkeypatch) -> None:
+    """Sandbox the runtime root and the module-level runner registries."""
+    monkeypatch.setattr(Path, "home", classmethod(lambda cls: tmp_path), raising=False)
+    monkeypatch.setattr(api_server, "_runner_tasks", {}, raising=False)
+    monkeypatch.setattr(api_server, "_runner_factory", None, raising=False)
+
+
+def _live_client() -> httpx.AsyncClient:
+    """An ASGI client bound to the *running* loop (no lifespan, no portal thread).
+
+    ``TestClient`` opens a throwaway event loop per request unless it is used as a
+    context manager, and the context-manager form additionally pays the app
+    lifespan (~10s here). The driver task started by ``/live/runner/start``
+    outlives the request that created it, so these tests drive the app on a
+    single long-lived loop — which is what uvicorn does in production.
+
+    The base URL is loopback so the DNS-rebinding Host check and the loopback
+    auth trust behave exactly as they do for ``_client`` above.
+    """
+    return httpx.AsyncClient(
+        transport=httpx.ASGITransport(app=api_server.app, client=("127.0.0.1", 50000)),
+        base_url="http://127.0.0.1:50000",
+    )
+
+
+class _StubScheduler:
+    """Scheduler stub mirroring ``Scheduler``'s ``_task`` / async ``stop`` contract."""
+
+    def __init__(self) -> None:
+        self._task: asyncio.Task | None = None
+        self.stop_calls = 0
+        self.ticks = 0
+
+    def start(self) -> None:
+        async def _loop() -> None:
+            while True:  # a real scheduler never returns on its own
+                self.ticks += 1
+                await asyncio.sleep(0)
+
+        self._task = asyncio.get_running_loop().create_task(_loop(), name="live-scheduler")
+
+    async def stop(self) -> None:
+        self.stop_calls += 1
+        task, self._task = self._task, None
+        if task is None:
+            return
+        task.cancel()
+        try:
+            await task
+        except asyncio.CancelledError:
+            pass
+
+    @property
+    def running(self) -> bool:
+        return self._task is not None and not self._task.done()
+
+
+def _install_runner(monkeypatch, broker: str = "robinhood", *, start: bool = True):
+    """Stub the runner factory; return the ``_StubScheduler`` the runner starts."""
+    monkeypatch.setattr(
+        api_server, "_active_mandate_state", lambda b: _valid_mandate_state(b)
+    )
+    scheduler = _StubScheduler()
+
+    class _StubRunner:
+        def __init__(self) -> None:
+            self.broker = broker
+            self._scheduler = scheduler
+
+        def run_loop(self, jobs=None) -> None:  # sync, non-blocking, returns None
+            if start:
+                self._scheduler.start()
+
+    monkeypatch.setattr(api_server, "_runner_factory", lambda b: _StubRunner())
+    return scheduler
+
+
+async def _await_ticks(scheduler: _StubScheduler, ticks: int = 5) -> None:
+    """Let the scheduler loop actually run, so "it is still alive" is meaningful."""
+    for _ in range(200):
+        if scheduler.ticks >= ticks:
+            return
+        await asyncio.sleep(0.001)
+    raise AssertionError("scheduler loop never ticked")
+
+
+async def _await_stopped(scheduler: _StubScheduler) -> None:
+    """Let the cancelled driver run its teardown."""
+    for _ in range(200):
+        if not scheduler.running:
+            return
+        await asyncio.sleep(0.001)
+    raise AssertionError("scheduler loop never stopped")
+
+
+def test_runner_start_keeps_task_registered_while_scheduler_runs(
+    tmp_path: Path, monkeypatch
+) -> None:
+    """The driver task must stay registered for as long as the scheduler ticks.
+
+    Regression: ``_drive_runner`` returned as soon as ``run_loop`` did, so the
+    ``add_done_callback`` popped ``_runner_tasks[broker]`` while the scheduler
+    was still firing — leaving the runner unstoppable from the API.
+    """
+    _live_env(tmp_path, monkeypatch)
+    scheduler = _install_runner(monkeypatch)
+
+    async def scenario() -> None:
+        async with _live_client() as client:
+            response = await client.post("/live/runner/start", json={"broker": "robinhood"})
+            assert response.status_code == 200, response.text
+            assert response.json() == {
+                "broker": "robinhood",
+                "started": True,
+                "already_running": False,
+            }
+
+
```

---

### Incident Patch 5: `c312d5cb` (2026-10-05)
**Commit Message**: fix(live): harden the preemptive halt sweep against ledger failures and malformed broker records

Signed-off-by: Romzhou <[REDACTED_EMAIL]>

**File**: `agent/src/live/runtime/flatten.py` (modified, +82/-14)
```diff
@@ -37,6 +37,7 @@
 from __future__ import annotations
 
 import logging
+import math
 from typing import Any, Callable
 
 from src.live.audit import LiveActionEvent, write_live_action
@@ -259,6 +260,19 @@ def _cancel_resting_orders(
             )
             continue
         order_id = order.get("order_id")
+        if not isinstance(order_id, str) or not order_id.strip():
+            # A cancel request is keyed entirely by order_id. Without a usable
+            # one the broker call is meaningless, yet a non-error envelope would
+            # be recorded as a cancellation of a real order that is still
+            # resting. Record it and move on — no side effect is attempted, so
+            # side_effects_attempted must stay as-is.
+            report["errors"].append(
+                {
+                    "phase": "cancel",
+                    "error": f"missing or invalid order_id: {order_id!r}",
+                }
+            )
+            continue
         request = {"action": "cancel", "order_id": order_id}
         report["side_effects_attempted"] = True
         try:
@@ -336,8 +350,17 @@ def _flatten_open_positions(
             )
             continue
         symbol = position.get("symbol")
-        qty = float(position.get("qty", 0) or 0)
-        if qty == 0:
+        qty = _coerce_position_qty(position.get("qty"))
+        if qty is None:
+            report["errors"].append(
+                {
+                    "phase": "flatten",
+                    "symbol": symbol,
+                    "error": f"invalid or missing position qty: {position.get('qty')!r}",
+                }
+            )
+            continue
+        if qty == 0.0:
             continue
         side = "sell" if qty > 0 else "buy"
         close_qty = abs(qty)
@@ -395,6 +418,31 @@ def _flatten_open_positions(
         )
 
 
+def _coerce_position_qty(raw: Any) -> float | None:
+    """Parse a broker position ``qty`` into a finite float, or ``None``.
+
+    The signed quantity decides the close side and size, so it must be a real
+    finite number. A bare ``float()`` cannot be trusted here: a non-numeric or
+    non-finite value (``"n/a"``, a dict, ``nan``, ``inf``) either raises out of
+    the sweep loop — aborting every remaining position on this trip — or, worse,
+    slips past ``qty == 0`` / ``qty > 0`` with ``nan`` and submits a real market
+    order of NaN shares. Booleans are rejected too: ``float(True)`` is ``1.0``,
+    which would close one share off a malformed record.
+
+    Returns:
+        The signed quantity as a float, ``0.0`` for a genuine zero position, or
+        ``None`` when the value is absent, malformed, or non-finite (the caller
+        records it in ``report["errors"]`` and moves on to the next position).
+    """
+    if raw is None or isinstance(raw, bool):
+        return None
+    try:
+        qty = float(raw)
+    except (TypeError, ValueError):
+        return None
+    return qty if math.isfinite(qty) else None
+
+
 def _error_envelope_message(response: Any) -> str | None:
     """Return the error string when a broker call failed via envelope.
 
@@ -448,6 +496,16 @@ def _audit(
 ) -> None:
     """Append one redacted live-action record for a sweep broker call.
 
+    Fail-safe: an audit write must never abort the sweep. The ledger write does
+    real I/O (``mkdir`` / ``json.dumps`` / ``open`` / ``write``), any of which can
+    raise on a bad record or a failing disk — and an exception escaping here
+    propagates out of ``flatten_and_cancel`` into the runner, which then latches
+    the sweep permanently (``mark_sweep_fired``) so no further cancel or flatten
+    ever runs, for this process or any restart. A dropped audit line is a
+    detectable gap; a permanently disabled kill-switch is not. This mirrors the
+    chain-ledger branch of :func:`src.live.audit.write_live_action`, which states
+    the same policy for the same reason.
+
     Args:
         broker: Broker key (stamped as ``server``).
         remote_tool: Broker remote tool invoked (``cancel_order`` | ``place_order``).
@@ -457,16 +515,26 @@ def _audit(
         outcome: ``"accepted"`` on success, ``"error"`` on failure.
         error: Error string when ``outcome == "error"``, else ``None``.
     """
-    write_live_action(
-        LiveActionEvent(
-            kind="order_placed" if outcome == "accepted" else "order_rejected",
-            session_id=_RUNTIME_SESSION_ID,
-            outcome=outcome,  # type: ignore[arg-type]
-            server=broker,
-            remote_tool=remote_tool,
-            intent_normalized=intent,
-            broker_request=request,
-            broker_response=response,
-            error=error,
+    try:
+        write_live_action(
+            LiveActionEvent(
+                kind="order_placed" if outcome == "accepted" else "order_rejected",
+                session_id=_RUNTIME_SESSION_ID,
+                outcome=outcome,  # type: ignore[arg-type]
+            
```

**File**: `agent/tests/test_runtime_flatten.py` (modified, +133/-0)
```diff
@@ -492,3 +492,136 @@ def submit(request: dict[str, Any]) -> dict[str, Any]:
         "error": "insufficient buying power",
     } in report["errors"]
     assert report["side_effects_attempted"] is True
+
+
+# --- fail-open hardening on the kill-switch path ---------------------------
+# A failure that only concerns the audit file must not abort the sweep: the
+# runner latches a failed sweep permanently (runner.py:697-726), so an escaping
+# exception here disables the kill-switch for this process and every restart.
+
+
+def test_audit_write_failure_does_not_abort_sweep(
+    live_runtime: Path, monkeypatch: pytest.MonkeyPatch
+) -> None:
+    # write_live_action does real I/O (mkdir/json.dumps/open/write); a disk
+    # fault must cost us an audit line, not the sweep.
+    def boom(*args: Any, **kwargs: Any) -> None:
+        raise OSError("no space left on device")
+
+    monkeypatch.setattr(flatten, "write_live_action", boom)
+    broker = _Broker(
+        open_orders=[{"order_id": "o1"}, {"order_id": "o2"}],
+        positions=[{"symbol": "NVDA", "qty": 3}, {"symbol": "AAPL", "qty": -2}],
+    )
+    report = flatten.flatten_and_cancel(
+        "robinhood",
+        broker.submit,
+        broker.read_positions,
+        broker.read_open_orders,
+        allow_flatten=True,
+    )
+    # Every order and every position was still acted on despite the audit fault.
+    assert [action for action, _ in broker.calls] == [
+        "cancel",
+        "cancel",
+        "close",
+        "close",
+    ]
+    assert report["cancelled_order_ids"] == ["o1", "o2"]
+    assert [s["symbol"] for s in report["flatten_orders_submitted"]] == [
+        "NVDA",
+        "AAPL",
+    ]
+    assert report["errors"] == []
+    assert report["side_effects_attempted"] is True
+
+
+@pytest.mark.parametrize("bad_order", [{"order_id": None}, {"order_id": ""}, {"order_id": "   "}, {}])
+def test_missing_or_blank_order_id_is_not_submitted(
+    live_runtime: Path, bad_order: dict[str, Any]
+) -> None:
+    # A cancel keyed on a missing/blank id would be recorded as a successful
+    # cancellation of an order that is still resting.
+    broker = _Broker(open_orders=[bad_order, {"order_id": "o2"}], positions=[])
+    report = flatten.flatten_and_cancel(
+        "robinhood", broker.submit, broker.read_positions, broker.read_open_orders
+    )
+    assert broker.calls == [("cancel", {"action": "cancel", "order_id": "o2"})]
+    assert report["cancelled_order_ids"] == ["o2"]
+    assert any(
+        e["phase"] == "cancel" and "missing or invalid order_id" in e["error"]
+        for e in report["errors"]
+    )
+
+
+@pytest.mark.parametrize(
+    "dirty_qty",
+    ["n/a", "", None, float("nan"), float("inf"), {"a": 1}, True],
+    ids=["str", "blank", "none", "nan", "inf", "dict", "bool"],
+)
+def test_dirty_position_qty_is_recorded_and_sweep_continues(
+    live_runtime: Path, dirty_qty: Any
+) -> None:
+    # ValueError/TypeError from a bare float() escaped the loop and left every
+    # later position unflattened; NaN slipped past the zero/sign checks and
+    # reached the broker as a real market order size.
+    broker = _Broker(
+        open_orders=[],
+        positions=[{"symbol": "DIRTY", "qty": dirty_qty}, {"symbol": "NVDA", "qty": 3}],
+    )
+    report = flatten.flatten_and_cancel(
+        "robinhood",
+        broker.submit,
+        broker.read_positions,
+        broker.read_open_orders,
+        allow_flatten=True,
+    )
+    assert [
+        r[1]["symbol"] for r in broker.calls if r[0] == "close"
+    ] == ["NVDA"]
+    for request in (r[1] for r in broker.calls):
+        qty = request.get("qty")
+        assert qty is not None and qty > 0
+    assert report["flatten_orders_submitted"] == [
+        {"symbol": "NVDA", "qty": 3.0, "side": "sell", "response": {"state": "accepted", "echo": "NVDA"}}
+    ]
+    assert any(
+        e["phase"] == "flatten"
+        and e["symbol"] == "DIRTY"
+        and "invalid or missing position qty" in e["error"]
+        for e in report["errors"]
+    )
+
+
+def test_missing_qty_field_is_an_error_not_a_silent_zero(
+    live_runtime: Path,
+) -> None:
+    # `float(position.get("qty", 0) or 0)` folded an absent field into a genuine
+    # zero position, so the report looked clean while exposure stayed open.
+    broker = _Broker(open_orders=[], positions=[{"symbol": "NVDA"}])
+    report = flatten.flatten_and_cancel(
+        "robinhood",
+        broker.submit,
+        broker.read_positions,
+        broker.read_open_orders,
+        allow_flatten=True,
+    )
+    assert report["flatten_orders_submitted"] == []
+    assert any(
+        e["phase"] == "flatten" and "invalid or missing position qty" in e["error"]
+        for e in report["errors"]
+    )
+
+
+def test_zero_qty_still_skipped_without_error(live_runtime: Path) -> None:
+    # The genuine zero position stays a clean skip — distinct from bad data.
+    broker = _Broker(open_orders=[], positions=[{"symbol": "GME
```

---

### Incident Patch 6: `f8a5a63d` (2026-10-05)
**Commit Message**: fix(grounding): hand the correction prompt the figures it should keep

A mixed rejection used to name only the failing figures. With 65 issues
on the table and nothing saying which values the gate had already
passed, the safest-looking play for the model was to rewrite whole
numeric sections as qualitative prose. zeus229's production run on #1622
lost a valid Risk X-Ray block and a portfolio-vs-benchmarks table that
way: the corrected draft passed, minus most of its numbers.

The gate now carries the measured figures that checked clean on the
ValidationResult, and the correction prompt tells the model to keep
them exactly as written: "only the figures listed above need work". A
spelling that fails anywhere in the draft is endorsed nowhere, and bare
integers stay off the list since an unchecked pass would vouch for
nothing.

Tests: three new pins in test_grounding_release.py, red before the fix
and green after (the keep list names the clean figures in document
order and none of the rejected ones; no section renders when nothing
passed; the list caps at 24 values and counts the rest). The 667
grounding tests and the full agent suite pass.

Ref #1622

Signed-off-by: Yufeng He <[REDACT

**File**: `agent/src/agent/grounding/ledger.py` (modified, +34/-1)
```diff
@@ -19,7 +19,7 @@
     _utc_now,
 )
 from src.agent.grounding.evidence import EvidenceRecord, _EvidenceMixin, _json_object
-from src.agent.grounding.figures import parse_figures_block, scan_figures, strip_figures_block
+from src.agent.grounding.figures import Figure, parse_figures_block, scan_figures, strip_figures_block
 from src.agent.grounding.policies import ValidationResult, _PolicyMixin
 from src.agent.grounding.registry import GROUNDING_CHECKS
 from src.agent.grounding.release import (
@@ -42,6 +42,38 @@
 )
 
 
+def _passed_figures(
+    figures: Sequence[Figure], issues: Sequence[Mapping[str, Any]]
+) -> tuple[str, ...]:
+    """The measured figures no issue flags, as written, in document order.
+
+    The correction prompt needs them for its keep list. A spelling that fails
+    anywhere in the draft is endorsed nowhere, so the list only carries values
+    the gate can vouch for outright. Bare integers stay off: only the
+    price-posing ones are checked, so a plain "bare" pass proves nothing.
+    """
+    flagged_spans = {
+        (int(span[0]), int(span[1]))
+        for issue in issues
+        if isinstance((span := issue.get("span")), (list, tuple)) and len(span) == 2
+    }
+    flagged_values = {
+        str(issue.get("value")) for issue in issues if issue.get("value") is not None
+    }
+    passed: list[str] = []
+    seen: set[str] = set()
+    for figure in figures:
+        if figure.shape != "measured":
+            continue
+        if (figure.start, figure.end) in flagged_spans:
+            continue
+        if figure.text in flagged_values or figure.text in seen:
+            continue
+        seen.add(figure.text)
+        passed.append(figure.text)
+    return tuple(passed)
+
+
 _ACTIONABLE_MARKET_RE = re.compile(
     r"(?:\bbuy\b|\bsell\b|\bentry\b|\btarget price\b|\bcurrent price\b|"
     r"\blatest price\b|\bprice of\b|\btrade\b|"
@@ -342,6 +374,7 @@ def _validate(self, content: str, *, record: bool) -> ValidationResult:
             valid=not issues,
             issues=issues,
             released_text=strip_figures_block(content, block),
+            passed_figures=_passed_figures(figures, issues),
         )
         if not record:
             return result
```

**File**: `agent/src/agent/grounding/policies.py` (modified, +5/-0)
```diff
@@ -114,11 +114,16 @@ class ValidationResult:
 
     ``released_text`` is the draft without its declaration block, which is a
     contract with the gate and never reaches the user.
+
+    ``passed_figures`` names the measured figures the gate checked and let
+    through, as written, so the correction prompt can tell the model what to
+    keep, not only what to fix.
     """
 
     valid: bool
     issues: list[dict[str, Any]] = field(default_factory=list)
     released_text: str = ""
+    passed_figures: tuple[str, ...] = ()
 
 
 def _close(value: float, target: float) -> bool:
```

**File**: `agent/src/agent/grounding/release.py` (modified, +14/-0)
```diff
@@ -214,6 +214,20 @@ def correction_prompt(self, validation: ValidationResult) -> str:
                     + ", ".join(repeated)
                     + ". Take option (2) or (3) for them."
                 )
+        passed = list(validation.passed_figures)
+        if passed:
+            shown = passed[:24]
+            keep = ", ".join(shown)
+            if len(passed) > len(shown):
+                keep += f", and {len(passed) - len(shown)} more"
+            lines.extend(
+                [
+                    "Every other measured figure in the draft checked clean. Keep these "
+                    "values exactly as written, where they stand: " + keep + ".",
+                    "Cutting them or swapping whole sections for qualitative prose is not "
+                    "a fix; only the figures listed above need work.",
+                ]
+            )
         lines.extend(
             [
                 "End the answer with a ```figures``` block declaring every number that "
```

**File**: `agent/tests/test_grounding_release.py` (modified, +67/-0)
```diff
@@ -2355,3 +2355,70 @@ def test_the_sweep_does_not_key_on_a_single_digit(tmp_path: Path) -> None:
     assert "5%" not in released
     assert "跌破 5 日均线，关注 5 只同类基金" in released
     assert "※ 略去 1 处" in released
+
+
+# ---------------------------------------------------------------------------
+# The correction prompt's keep list (#1622 post-failure action semantics)
+# ---------------------------------------------------------------------------
+
+
+def test_the_correction_prompt_names_the_figures_to_keep(tmp_path: Path) -> None:
+    """A mixed rejection must not talk the model into deleting clean figures.
+
+    zeus229's production run on #1622: 65 issues over a draft whose evidence
+    was complete, and the correction rewrote whole numeric sections as
+    qualitative prose, deleting figures the gate had passed. The prompt only
+    named the failures. The keep list pins the other half of the contract.
+    """
+    ledger = _ledger(tmp_path)
+    draft = (
+        HDR
+        + "昨日收盘 1.137 元，20 日均线 1.150 元，50 日均线 1.090 元。"
+        + "参考买入价 1.136 元（1.171 × 0.97）。目标价 2.50 元，传闻报价 9.99 元。"
+        + _block(
+            HDR_ROW,
+            "1.137 | observed | close 2026-06-23 | prices",
+            "1.150 | observed | sma_20 | indicators",
+            "1.090 | observed | sma_50 | indicators",
+            "1.136 | derived | 1.171 × 0.97 | prices",
+            "2.50 | proposed | target",
+        )
+    )
+    validation = ledger.validate_final_answer(draft)
+
+    assert validation.valid is False
+    prompt = ledger.correction_prompt(validation)
+    keep = next(row for row in prompt.splitlines() if "checked clean" in row)
+
+    # Document order, exactly as written.
+    assert "1.171, 1.137, 1.150, 1.090, 1.136" in keep
+    for rejected in ("2.50", "9.99", "0.97"):
+        assert rejected not in keep
+    assert "only the figures listed above need work" in prompt
+
+
+def test_the_keep_list_is_absent_when_nothing_passed(tmp_path: Path) -> None:
+    """No clean figure, no keep list: the section must not render empty."""
+    ledger = _ledger(tmp_path)
+    validation = ledger.validate_final_answer("562500.SS（Yahoo，CNY）最新收盘价 9.99 元。")
+
+    assert validation.valid is False
+    assert "checked clean" not in ledger.correction_prompt(validation)
+
+
+def test_the_keep_list_caps_and_counts_the_rest(tmp_path: Path) -> None:
+    """A long keep list stays one line: 24 values spelled, the rest counted."""
+    extra = {f"m{i:02d}": 11.0 + i / 100 for i in range(1, 27)}
+    ledger = _ledger(tmp_path, **extra)
+    draft = HDR + "指标读数：" + "、".join(f"{v:.2f}" for v in extra.values()) + "。传闻报价 9.99 元。"
+    rows = [HDR_ROW] + [f"{v:.2f} | observed | {k} | indicators" for k, v in extra.items()]
+    validation = ledger.validate_final_answer(draft + _block(*rows))
+
+    assert validation.valid is False
+    prompt = ledger.correction_prompt(validation)
+    keep = next(row for row in prompt.splitlines() if "checked clean" in row)
+
+    # 27 clean figures (1.171 plus the 26 indicators), 24 shown, 3 counted.
+    assert "and 3 more" in keep
+    assert "11.23" in keep
+    assert "11.24" not in keep
```

---

### Incident Patch 7: `c214c035` (2026-10-05)
**Commit Message**: fix(grounding): keep recovery refs within figure kinds

**File**: `README.md` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@
 
 > ⚠️ **Security warning:** The X account `VibeTrading_HKU`, Virtuals project `101845`, and token contract `0x640BDBF77b6447E8b7DB7894cED84BD1c40571f4` are not official Vibe-Trading assets. We have never launched or endorsed any token or memecoin. Do not buy, connect a wallet, or sign anything. [Details](SECURITY.md#official-channels--impersonation).
 
-- **2026-10-05** 🛠️ **Research prompts and calculation fixes**: Chat accepts longer research prompts and gives a localized recovery message when input is too large ([#1701](https://github.com/HKUDS/Vibe-Trading/pull/1701)). Backtests use full-sample Sortino downside deviation; grouped validation purges overlapping labels, covariance weights remain finite, shadow RSI uses Wilder seeds, and memory removal accepts filename stems.
+- **2026-10-05** 🛠️ **Research prompts and calculation fixes**: Chat accepts longer research prompts and gives a localized recovery message when input is too large ([#1701](https://github.com/HKUDS/Vibe-Trading/pull/1701)). Backtests use full-sample Sortino downside deviation; grouped validation purges overlapping labels, covariance weights remain finite, shadow RSI uses Wilder seeds, and memory removal accepts filename stems. Invalid call aliases now receive exact source references for correction ([#1638](https://github.com/HKUDS/Vibe-Trading/pull/1638)); numeric validation stays unchanged.
 
 - **2026-10-04** 🛠️ **Scheduled reports and research workflows**: Edit scheduled runs and choose a configured destination; Email reports support HTML or PDF attachments ([#1649](https://github.com/HKUDS/Vibe-Trading/pull/1649), [#1680](https://github.com/HKUDS/Vibe-Trading/pull/1680)).
   Backtests expose structured summaries and paged artifact reads ([#1646](https://github.com/HKUDS/Vibe-Trading/pull/1646), [#1647](https://github.com/HKUDS/Vibe-Trading/pull/1647)). Fixes cover memory-search snippets, export-path guidance, macro truncation, monthly risk, turnover on reversals and cash reentry, IV accuracy, VaR gaps, VCS updates and Robinhood option-order blocking.
```

**File**: `README_ar.md` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@
 
 > ⚠️ **تحذير أمني:** حساب X باسم `VibeTrading_HKU`، ومشروع Virtuals رقم `101845`، وعقد التوكن `0x640BDBF77b6447E8b7DB7894cED84BD1c40571f4` كلّها غير رسمية ولا تتبع Vibe-Trading. لم نُطلق أو نؤيد مطلقًا أي توكن أو عملة ميم. لا تشترِ هذا التوكن، ولا تربط محفظتك، ولا توقّع أي شيء. [التفاصيل](SECURITY.md#official-channels--impersonation).
 
-- **2026-10-05** 🛠️ **إدخال البحث وتصحيح الحسابات**: تدعم المحادثة نصوص بحث أطول وتوضح باللغة الحالية كيفية تقصير النص عند تجاوز الحد ([#1701](https://github.com/HKUDS/Vibe-Trading/pull/1701)). يستخدم Sortino انحراف الجانب السلبي عبر جميع الفترات، ويستبعد التحقق الجماعي التسميات المتداخلة. تحسنت أوزان التباين وRSI بمتوسط Wilder الأولي وحذف الذاكرة باسم الملف.
+- **2026-10-05** 🛠️ **إدخال البحث وتصحيح الحسابات**: تدعم المحادثة نصوص بحث أطول وتوضح باللغة الحالية كيفية تقصير النص عند تجاوز الحد ([#1701](https://github.com/HKUDS/Vibe-Trading/pull/1701)). يستخدم Sortino انحراف الجانب السلبي عبر جميع الفترات، ويستبعد التحقق الجماعي التسميات المتداخلة. تحسنت أوزان التباين وRSI بمتوسط Wilder الأولي وحذف الذاكرة باسم الملف. عند استخدام اسم مستعار غير صحيح للاستدعاء، يقترح التصحيح مراجع الحقول الفعلية مع بقاء التحقق من الأرقام كما هو ([#1638](https://github.com/HKUDS/Vibe-Trading/pull/1638)).
 
 - **2026-10-04** 🛠️ **تحسين التقارير المجدولة وسير البحث**: يمكن تعديل المهام المجدولة واختيار وجهة مُعدّة مسبقًا، مع إرسال تقارير البريد بصيغة HTML أو كمرفقات PDF ([#1649](https://github.com/HKUDS/Vibe-Trading/pull/1649), [#1680](https://github.com/HKUDS/Vibe-Trading/pull/1680)).
   تتضمن الاختبارات التاريخية ملخصات منظّمة وقراءة ملفات النتائج على صفحات ([#1646](https://github.com/HKUDS/Vibe-Trading/pull/1646), [#1647](https://github.com/HKUDS/Vibe-Trading/pull/1647)). تشمل الإصلاحات مقتطفات بحث الذاكرة، وإرشادات مسار التصدير، وبيان اقتطاع البيانات الكلية، ومخاطر الشموع الشهرية، ودوران المحفظة عند عكس الاتجاه أو إعادة الاستثمار بعد التحول إلى النقد، ودقة التقلب الضمني، وفجوات VaR، وتحديث التثبيت من VCS، وحظر أوامر خيارات Robinhood غير المدعومة.
```

**File**: `README_es.md` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@
 
 > ⚠️ **Advertencia de seguridad:** la cuenta de X `VibeTrading_HKU`, el proyecto de Virtuals `101845` y el contrato de token `0x640BDBF77b6447E8b7DB7894cED84BD1c40571f4` no son activos oficiales de Vibe-Trading. Nunca hemos lanzado ni respaldado ningún token o memecoin. No compres, conectes una wallet ni firmes nada. [Detalles](SECURITY.md#official-channels--impersonation).
 
-- **2026-10-05** 🛠️ **Consultas de investigación y cálculos corregidos**: El chat admite consultas más largas e indica en el idioma actual cómo acortarlas cuando superan el límite ([#1701](https://github.com/HKUDS/Vibe-Trading/pull/1701)). Sortino usa la desviación a la baja de todos los períodos; la validación por grupos excluye etiquetas solapadas. También mejoran los pesos de covarianza, el RSI con media inicial de Wilder y la eliminación de memorias por nombre de archivo.
+- **2026-10-05** 🛠️ **Consultas de investigación y cálculos corregidos**: El chat admite consultas más largas e indica en el idioma actual cómo acortarlas cuando superan el límite ([#1701](https://github.com/HKUDS/Vibe-Trading/pull/1701)). Sortino usa la desviación a la baja de todos los períodos; la validación por grupos excluye etiquetas solapadas. También mejoran los pesos de covarianza, el RSI con media inicial de Wilder y la eliminación de memorias por nombre de archivo. Los alias de llamada incorrectos reciben referencias exactas para corregirlos, conservando la validación numérica ([#1638](https://github.com/HKUDS/Vibe-Trading/pull/1638)).
 
 - **2026-10-04** 🛠️ **Informes programados y flujos de investigación**: Edita tareas programadas y elige un destino configurado; los informes por email admiten HTML o archivos PDF adjuntos ([#1649](https://github.com/HKUDS/Vibe-Trading/pull/1649), [#1680](https://github.com/HKUDS/Vibe-Trading/pull/1680)).
   Los backtests ofrecen resúmenes estructurados y lectura paginada de resultados ([#1646](https://github.com/HKUDS/Vibe-Trading/pull/1646), [#1647](https://github.com/HKUDS/Vibe-Trading/pull/1647)). Se corrigen fragmentos de búsqueda, indicaciones de exportación, avisos de datos macro truncados, riesgo mensual, rotación al invertir posiciones o reinvertir tras pasar a efectivo, precisión de IV, huecos de VaR, actualizaciones desde VCS y el bloqueo de órdenes de opciones no admitidas en Robinhood.
```

**File**: `README_id.md` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@
 
 > ⚠️ **Peringatan keamanan:** Akun X `VibeTrading_HKU`, proyek Virtuals `101845`, dan kontrak token `0x640BDBF77b6447E8b7DB7894cED84BD1c40571f4` bukan aset resmi Vibe-Trading. Kami tidak pernah meluncurkan atau mendukung token maupun memecoin apa pun. Jangan membeli, menghubungkan wallet, atau menandatangani apa pun. [Detail](SECURITY.md#official-channels--impersonation).
 
-- **2026-10-05** 🛠️ **Input riset dan perbaikan perhitungan**: Chat menerima input riset lebih panjang dan memberi petunjuk dalam bahasa aktif untuk mempersingkat teks yang melampaui batas ([#1701](https://github.com/HKUDS/Vibe-Trading/pull/1701)). Sortino memakai deviasi penurunan dari seluruh periode; validasi grup membuang label yang tumpang tindih. Bobot kovarians, RSI dengan rata-rata awal Wilder, dan penghapusan memori lewat nama file juga diperbaiki.
+- **2026-10-05** 🛠️ **Input riset dan perbaikan perhitungan**: Chat menerima input riset lebih panjang dan memberi petunjuk dalam bahasa aktif untuk mempersingkat teks yang melampaui batas ([#1701](https://github.com/HKUDS/Vibe-Trading/pull/1701)). Sortino memakai deviasi penurunan dari seluruh periode; validasi grup membuang label yang tumpang tindih. Bobot kovarians, RSI dengan rata-rata awal Wilder, dan penghapusan memori lewat nama file juga diperbaiki. Alias panggilan yang keliru kini mendapat referensi sumber yang tepat untuk koreksi, dengan validasi angka tetap berlaku ([#1638](https://github.com/HKUDS/Vibe-Trading/pull/1638)).
 
 - **2026-10-04** 🛠️ **Laporan terjadwal dan alur riset**: Edit tugas terjadwal dan pilih tujuan yang sudah dikonfigurasi; laporan email mendukung HTML atau lampiran PDF ([#1649](https://github.com/HKUDS/Vibe-Trading/pull/1649), [#1680](https://github.com/HKUDS/Vibe-Trading/pull/1680)).
   Backtest menyediakan ringkasan terstruktur dan pembacaan artefak per halaman ([#1646](https://github.com/HKUDS/Vibe-Trading/pull/1646), [#1647](https://github.com/HKUDS/Vibe-Trading/pull/1647)). Perbaikan mencakup cuplikan pencarian memori, panduan lokasi ekspor, pemberitahuan pemangkasan data makro, risiko bulanan, turnover saat membalik posisi atau masuk kembali setelah menjadi kas, akurasi IV, celah VaR, pembaruan instalasi VCS, serta pemblokiran order opsi Robinhood yang belum didukung.
```

**File**: `README_ja.md` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@
 
 > ⚠️ **セキュリティ警告：** Xアカウント `VibeTrading_HKU`、Virtualsプロジェクト `101845`、およびトークンコントラクト `0x640BDBF77b6447E8b7DB7894cED84BD1c40571f4` は、いずれもVibe-Trading公式のものではありません。Vibe-Tradingはこれまで、いかなるトークンやミームコインも発行・公認していません。購入、ウォレットの接続、署名は行わないでください。[詳細](SECURITY.md#official-channels--impersonation)
 
-- **2026-10-05** 🛠️ **調査入力と計算の修正**：チャットで長い調査入力に対応し、上限を超えた場合は現在の言語で短縮を案内します（[#1701](https://github.com/HKUDS/Vibe-Trading/pull/1701)）。Sortino は全期間の下方偏差を使用し、グループ検証は重複ラベルを除外します。共分散ウェイト、Wilder 初期平均による RSI、ファイル名によるメモリ削除も改善しました。
+- **2026-10-05** 🛠️ **調査入力と計算の修正**：チャットで長い調査入力に対応し、上限を超えた場合は現在の言語で短縮を案内します（[#1701](https://github.com/HKUDS/Vibe-Trading/pull/1701)）。Sortino は全期間の下方偏差を使用し、グループ検証は重複ラベルを除外します。共分散ウェイト、Wilder 初期平均による RSI、ファイル名によるメモリ削除も改善しました。 呼び出しの別名を誤って引用した場合、修正用に実際のフィールド参照を提示します（[#1638](https://github.com/HKUDS/Vibe-Trading/pull/1638)）。数値の検証規則は維持されます。
 
 - **2026-10-04** 🛠️ **定期レポートと調査フローの改善**：定期タスクを編集し、設定済みの送信先を選択できます。メールレポートは HTML または PDF 添付に対応しました（[#1649](https://github.com/HKUDS/Vibe-Trading/pull/1649), [#1680](https://github.com/HKUDS/Vibe-Trading/pull/1680)）。
   バックテストに構造化サマリーと成果物のページ読み取りを追加（[#1646](https://github.com/HKUDS/Vibe-Trading/pull/1646), [#1647](https://github.com/HKUDS/Vibe-Trading/pull/1647)）。メモリ検索の抜粋、エクスポート先の案内、マクロデータの切り詰め表示、月足リスク、売買方向の反転・現金化後の再投資の回転率、IV 精度、VaR の欠損区間、VCS インストールの更新、Robinhood の未対応オプション注文の遮断も修正しました。
```

**File**: `README_ko.md` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@
 
 > ⚠️ **보안 경고:** X 계정 `VibeTrading_HKU`, Virtuals 프로젝트 `101845`, 토큰 컨트랙트 `0x640BDBF77b6447E8b7DB7894cED84BD1c40571f4`는 모두 Vibe-Trading 공식과 무관합니다. Vibe-Trading은 어떠한 토큰이나 밈코인도 발행하거나 공식적으로 지지한 적이 없습니다. 해당 토큰을 구매하거나 지갑을 연결하거나 어떠한 서명도 하지 마세요. [자세히 보기](SECURITY.md#official-channels--impersonation).
 
-- **2026-10-05** 🛠️ **리서치 입력과 계산 수정**: 더 긴 리서치 입력을 지원하며 한도를 넘으면 현재 언어로 줄이도록 안내합니다([#1701](https://github.com/HKUDS/Vibe-Trading/pull/1701)). Sortino는 전체 기간의 하방 편차를 사용하고 그룹 검증은 겹치는 레이블을 제외합니다. 공분산 가중치, Wilder 초기 평균을 사용하는 RSI, 파일명으로 메모리 삭제도 개선했습니다.
+- **2026-10-05** 🛠️ **리서치 입력과 계산 수정**: 더 긴 리서치 입력을 지원하며 한도를 넘으면 현재 언어로 줄이도록 안내합니다([#1701](https://github.com/HKUDS/Vibe-Trading/pull/1701)). Sortino는 전체 기간의 하방 편차를 사용하고 그룹 검증은 겹치는 레이블을 제외합니다. 공분산 가중치, Wilder 초기 평균을 사용하는 RSI, 파일명으로 메모리 삭제도 개선했습니다. 잘못된 호출 별칭을 인용하면 수정할 수 있도록 실제 필드 참조를 안내하며 수치 검증 규칙은 유지합니다([#1638](https://github.com/HKUDS/Vibe-Trading/pull/1638)).
 
 - **2026-10-04** 🛠️ **예약 보고서와 리서치 흐름 개선**: 예약 작업을 편집하고 설정된 수신 대상을 선택할 수 있습니다. 이메일 보고서는 HTML 또는 PDF 첨부를 지원합니다([#1649](https://github.com/HKUDS/Vibe-Trading/pull/1649), [#1680](https://github.com/HKUDS/Vibe-Trading/pull/1680)).
   백테스트에 구조화된 요약과 결과 파일 페이지 읽기를 추가했습니다([#1646](https://github.com/HKUDS/Vibe-Trading/pull/1646), [#1647](https://github.com/HKUDS/Vibe-Trading/pull/1647)). 메모리 검색 미리보기, 내보내기 경로 안내, 매크로 데이터 잘림 표시, 월봉 리스크, 포지션 반전과 현금화 후 재진입의 회전율, IV 정확도, VaR 결측 구간, VCS 설치 업데이트, Robinhood의 미지원 옵션 주문 차단도 수정했습니다.
```

**File**: `README_zh.md` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@
 
 > ⚠️ **安全警告：** X 账号 `VibeTrading_HKU`、Virtuals 项目 `101845` 及代币合约 `0x640BDBF77b6447E8b7DB7894cED84BD1c40571f4` 均非 Vibe-Trading 官方。我们从未发行或背书任何代币或 meme 币。请勿购买、连接钱包或签名。[详细说明](SECURITY.md#official-channels--impersonation)。
 
-- **2026-10-05** 🛠️ **研究输入与计算修复**：聊天支持更长的研究输入，超限时以当前语言提示缩短（[#1701](https://github.com/HKUDS/Vibe-Trading/pull/1701)）。回测 Sortino 使用全样本下行偏差；分组验证剔除重叠标签，协方差权重保持有限，影子账户 RSI 使用 Wilder 初始均值，记忆支持按文件名删除。
+- **2026-10-05** 🛠️ **研究输入与计算修复**：聊天支持更长的研究输入，超限时以当前语言提示缩短（[#1701](https://github.com/HKUDS/Vibe-Trading/pull/1701)）。回测 Sortino 使用全样本下行偏差；分组验证剔除重叠标签，协方差权重保持有限，影子账户 RSI 使用 Wilder 初始均值，记忆支持按文件名删除。 报告误用调用别名时，纠正提示提供真实字段引用（[#1638](https://github.com/HKUDS/Vibe-Trading/pull/1638)），数值校验保持不变。
 
 - **2026-10-04** 🛠️ **定时报告与研究流程完善**：定时任务支持编辑并选择已配置的交付目标，邮件报告可选 HTML 或 PDF 附件（[#1649](https://github.com/HKUDS/Vibe-Trading/pull/1649), [#1680](https://github.com/HKUDS/Vibe-Trading/pull/1680)）。
   回测提供结构化摘要与产物分页读取（[#1646](https://github.com/HKUDS/Vibe-Trading/pull/1646), [#1647](https://github.com/HKUDS/Vibe-Trading/pull/1647)）；同时修复记忆搜索片段、导出路径提示、宏观数据截断说明、月线风险、反向持仓及清仓后重新入场的换手率、隐含波动率精度、VaR 缺口、源码安装更新，以及 Robinhood 不受支持的期权下单拦截。
```

**File**: `agent/src/agent/grounding/policies.py` (modified, +7/-9)
```diff
@@ -99,9 +99,6 @@ def _index_normalized(path: str) -> str:
 #: Relative band a value must fall in to count as matching evidence.
 _TOLERANCE = 0.005
 
-#: Most exact refs a correction lists for a ref whose call id names nothing.
-_MAX_FIELD_REF_CANDIDATES = 5
-
 #: A plain integer is read as a price only for an instrument quoted in the
 #: thousands (600519.SH, an index, BTC). Below that, a prose integer is a window,
 #: a horizon or a count ("20 日均线", "200-day") and stays unchecked.
@@ -1242,8 +1239,9 @@ def _unknown_call_field_ref_candidates(
         no evidence. This only lists where the field really lives, so the next
         draft can copy an exact ref; it grants nothing, and the figure stays
         rejected until it is re-declared with one of them. Refs whose value the
-        figure matches come first; at most :data:`_MAX_FIELD_REF_CANDIDATES` are
-        returned.
+        figure matches come first; at most :data:`_MAX_CALL_REF_CANDIDATES` are
+        returned. Candidates keep the same symbol and kind restrictions as a
+        real field ref, so the correction cannot recommend an unusable ref.
         """
         key = (ref or "").strip()
         if "::" not in key:
@@ -1253,22 +1251,22 @@ def _unknown_call_field_ref_candidates(
             return []
         records, entries = self._field_sources(field, symbol)
         found: dict[str, list[float]] = {}
+        money = bool(figure.currency and not figure.percent)
         for record in records:
-            if record.call_id and record.field:
+            if record.call_id and record.field and self._kind_fits(record, figure):
                 label = self._ref_source(record.call_id, record.field, record.scope)[1]
                 found.setdefault(label, []).append(float(record.value))
-        for entry in entries:
+        for entry in entries if not (money or figure.column) else ():
             if entry.get("call_id") and entry.get("field"):
                 label = self._ref_source(str(entry["call_id"]), str(entry["field"]), None)[1]
                 found.setdefault(label, []).append(float(entry["value"]))
-        money = bool(figure.currency and not figure.percent)
         compatible = {
             label
             for label, values in found.items()
             if self._matches_evidence(figure, values, [] if money else values)
         }
         ranked = sorted(found, key=lambda label: (label not in compatible, label))
-        return ranked[:_MAX_FIELD_REF_CANDIDATES]
+        return ranked[:_MAX_CALL_REF_CANDIDATES]
 
     def _names_session_source(self, name: str) -> bool:
         """Whether ``name`` is a call id, tool name or backtest run of this session."""
```

---

### Incident Patch 8: `f6e72428` (2026-10-05)
**Commit Message**: fix: finish research prompts and grouped validation boundaries

**File**: `CONTRIBUTING.md` (modified, +4/-3)
```diff
@@ -149,9 +149,10 @@ configuration with no per-channel frontend code.
    from the base class and manager.
 2. Field metadata lives in `agent/src/channels/config_meta.py`. Hand-written
    `FIELD_HINTS[name]` entries supply labels and authoritative secret flags;
-   anything you omit is derived from `default_config()` with type inference, and
-   credential-shaped keys are masked by the unconditional `SECRET_KEY_RE`
-   fail-safe either way. If the platform has a credential endpoint, build the
+   channels without hand-written hints derive them from `default_config()` with
+   type inference. Stored keys without a hand-written declaration use the
+   `SECRET_KEY_RE` fail-safe. Declared secret flags are authoritative, including
+   audited exceptions for benign path or timeout keys. If the platform has a credential endpoint, build the
    connection probe on `token_probe.py` rather than writing a new client (see
    `dingtalk_probe.py` for the pattern) and override `test_connection()`.
 3. Run the authoring contract locally:
```

**File**: `README.md` (modified, +4/-2)
```diff
@@ -52,16 +52,18 @@
 
 > ⚠️ **Security warning:** The X account `VibeTrading_HKU`, Virtuals project `101845`, and token contract `0x640BDBF77b6447E8b7DB7894cED84BD1c40571f4` are not official Vibe-Trading assets. We have never launched or endorsed any token or memecoin. Do not buy, connect a wallet, or sign anything. [Details](SECURITY.md#official-channels--impersonation).
 
+- **2026-10-05** 🛠️ **Research prompts and calculation fixes**: Chat accepts longer research prompts and gives a localized recovery message when input is too large ([#1701](https://github.com/HKUDS/Vibe-Trading/pull/1701)). Backtests use full-sample Sortino downside deviation; grouped validation purges overlapping labels, covariance weights remain finite, shadow RSI uses Wilder seeds, and memory removal accepts filename stems.
+
 - **2026-10-04** 🛠️ **Scheduled reports and research workflows**: Edit scheduled runs and choose a configured destination; Email reports support HTML or PDF attachments ([#1649](https://github.com/HKUDS/Vibe-Trading/pull/1649), [#1680](https://github.com/HKUDS/Vibe-Trading/pull/1680)).
   Backtests expose structured summaries and paged artifact reads ([#1646](https://github.com/HKUDS/Vibe-Trading/pull/1646), [#1647](https://github.com/HKUDS/Vibe-Trading/pull/1647)). Fixes cover memory-search snippets, export-path guidance, macro truncation, monthly risk, turnover on reversals and cash reentry, IV accuracy, VaR gaps, VCS updates and Robinhood option-order blocking.
 
 - **2026-10-03** 🛠️ **Research, reports and data reliability**: CJK session search, channel setup, broker exposure pricing and file writes now handle cases that blocked everyday use. PDF delivery embeds CJK fonts, Swarm validates preset inputs and separates task artifacts, and replayed tool results survive context compaction ([#1683](https://github.com/HKUDS/Vibe-Trading/pull/1683), [#1455](https://github.com/HKUDS/Vibe-Trading/pull/1455), [#1635](https://github.com/HKUDS/Vibe-Trading/pull/1635)). Backtests keep one adjustment basis, local caches distinguish sources, single-asset caps and weekly/monthly risk use the declared settings, audits retain loss signs, grounding checks the current engine output and exact list references, and Stooq retries after a denial cooldown ([#1684](https://github.com/HKUDS/Vibe-Trading/pull/1684), [#1650](https://github.com/HKUDS/Vibe-Trading/pull/1650), [#1685](https://github.com/HKUDS/Vibe-Trading/pull/1685), [#1640](https://github.com/HKUDS/Vibe-Trading/pull/1640)).
 
-- **2026-10-02** 🛠️ **Backtests and report checks**: strategy-file writes retain model provenance without crashing ([#1673](https://github.com/HKUDS/Vibe-Trading/pull/1673)), and Monte Carlo drawdown and Sharpe include starting capital ([#1664](https://github.com/HKUDS/Vibe-Trading/pull/1664)). Report audits preserve accounting negatives and units ([#1663](https://github.com/HKUDS/Vibe-Trading/pull/1663)); grounding artifacts record fired declared checks ([#1661](https://github.com/HKUDS/Vibe-Trading/pull/1661)); public loader-health reports include sanitized failure reasons ([#1643](https://github.com/HKUDS/Vibe-Trading/pull/1643)). Indonesian tool documentation matches the registry ([#1671](https://github.com/HKUDS/Vibe-Trading/pull/1671)).
-
 <details>
 <summary>Earlier news</summary>
 
+- **2026-10-02** 🛠️ **Backtests and report checks**: strategy-file writes retain model provenance without crashing ([#1673](https://github.com/HKUDS/Vibe-Trading/pull/1673)), and Monte Carlo drawdown and Sharpe include starting capital ([#1664](https://github.com/HKUDS/Vibe-Trading/pull/1664)). Report audits preserve accounting negatives and units ([#1663](https://github.com/HKUDS/Vibe-Trading/pull/1663)); grounding artifacts record fired declared checks ([#1661](https://github.com/HKUDS/Vibe-Trading/pull/1661)); public loader-health reports include sanitized failure reasons ([#1643](https://github.com/HKUDS/Vibe-Trading/pull/1643)). Indonesian tool documentation matches the registry ([#1671](https://github.com/HKUDS/Vibe-Trading/pull/1671)).
+
 - **2026-10-01** ✅ **Data correctness and reproducible backtests**: A-share adjustment conversion now refuses ambiguous one-bar edge cases ([#1551](https://github.com/HKUDS/Vibe-Trading/pull/1551)); Southbound Eastmoney amounts are scaled from million HKD and rejected responses no longer look empty ([#1486](https://github.com/HKUDS/Vibe-Trading/pull/1486)); Northbound fallback data distinguishes post-2024-08-19 turnover from net flow ([#1484](https://github.com/HKUDS/Vibe-Trading/pull/1484)); Binance-only unpriced positions are marked incomplete without penalising other brokers ([#1505](https://github.com/HKUDS/Vibe-Trading/pull/1505)); and backtest run cards record model provenance and warn when the training cutoff is unknown or outside the test window ([#1618](https://github.com/HKUDS/Vibe-Trading/pull/1618), closes [#1613](https://github.com/HKUDS/Vibe-Trading/issues/1613)).
 
 - **2026-09-30** 🛠️ **Feishu in the 
```

**File**: `README_ar.md` (modified, +4/-2)
```diff
@@ -52,16 +52,18 @@
 
 > ⚠️ **تحذير أمني:** حساب X باسم `VibeTrading_HKU`، ومشروع Virtuals رقم `101845`، وعقد التوكن `0x640BDBF77b6447E8b7DB7894cED84BD1c40571f4` كلّها غير رسمية ولا تتبع Vibe-Trading. لم نُطلق أو نؤيد مطلقًا أي توكن أو عملة ميم. لا تشترِ هذا التوكن، ولا تربط محفظتك، ولا توقّع أي شيء. [التفاصيل](SECURITY.md#official-channels--impersonation).
 
+- **2026-10-05** 🛠️ **إدخال البحث وتصحيح الحسابات**: تدعم المحادثة نصوص بحث أطول وتوضح باللغة الحالية كيفية تقصير النص عند تجاوز الحد ([#1701](https://github.com/HKUDS/Vibe-Trading/pull/1701)). يستخدم Sortino انحراف الجانب السلبي عبر جميع الفترات، ويستبعد التحقق الجماعي التسميات المتداخلة. تحسنت أوزان التباين وRSI بمتوسط Wilder الأولي وحذف الذاكرة باسم الملف.
+
 - **2026-10-04** 🛠️ **تحسين التقارير المجدولة وسير البحث**: يمكن تعديل المهام المجدولة واختيار وجهة مُعدّة مسبقًا، مع إرسال تقارير البريد بصيغة HTML أو كمرفقات PDF ([#1649](https://github.com/HKUDS/Vibe-Trading/pull/1649), [#1680](https://github.com/HKUDS/Vibe-Trading/pull/1680)).
   تتضمن الاختبارات التاريخية ملخصات منظّمة وقراءة ملفات النتائج على صفحات ([#1646](https://github.com/HKUDS/Vibe-Trading/pull/1646), [#1647](https://github.com/HKUDS/Vibe-Trading/pull/1647)). تشمل الإصلاحات مقتطفات بحث الذاكرة، وإرشادات مسار التصدير، وبيان اقتطاع البيانات الكلية، ومخاطر الشموع الشهرية، ودوران المحفظة عند عكس الاتجاه أو إعادة الاستثمار بعد التحول إلى النقد، ودقة التقلب الضمني، وفجوات VaR، وتحديث التثبيت من VCS، وحظر أوامر خيارات Robinhood غير المدعومة.
 
 - **2026-10-03** 🛠️ **تحسين موثوقية البحث والتقارير والبيانات**: أُصلحت مشكلات البحث في الجلسات بالصينية واليابانية والكورية، وإعداد القنوات، وتقييم حيازات الوسطاء، وكتابة الملفات التي كانت تعيق الاستخدام اليومي. تتضمن ملفات PDF خطوط CJK، ويتحقق Swarm من مدخلات الإعدادات المسبقة ويفصل مخرجات المهام، وتبقى نتائج الأدوات المعاد استخدامها متاحة بعد ضغط السياق ([#1683](https://github.com/HKUDS/Vibe-Trading/pull/1683), [#1455](https://github.com/HKUDS/Vibe-Trading/pull/1455), [#1635](https://github.com/HKUDS/Vibe-Trading/pull/1635)). تستخدم الاختبارات التاريخية أساسًا موحدًا لتعديل الأسعار، وتميّز الذاكرة المؤقتة المحلية بين مصادر البيانات، وتتبع حدود الأصل الواحد وحسابات المخاطر الأسبوعية والشهرية الإعدادات المعلنة. يحافظ التدقيق على إشارة الخسائر، ويعتمد التحقق الرقمي على مخرجات المحرك الحالية ومراجع القوائم الدقيقة، ويعيد Stooq المحاولة بعد انتهاء فترة الانتظار عقب الرفض ([#1684](https://github.com/HKUDS/Vibe-Trading/pull/1684), [#1650](https://github.com/HKUDS/Vibe-Trading/pull/1650), [#1685](https://github.com/HKUDS/Vibe-Trading/pull/1685), [#1640](https://github.com/HKUDS/Vibe-Trading/pull/1640)).
 
-- **2026-10-02** 🛠️ **إصلاحات الاختبارات الخلفية وتدقيق التقارير**: تحتفظ كتابة ملفات الاستراتيجيات بمصدر النموذج دون تعطل ([#1673](https://github.com/HKUDS/Vibe-Trading/pull/1673))، وتشمل حسابات التراجع وSharpe في محاكاة مونت كارلو رأس المال الابتدائي ([#1664](https://github.com/HKUDS/Vibe-Trading/pull/1664)). يحافظ تدقيق التقارير على القيم السالبة المحاسبية بين الأقواس ووحداتها ([#1663](https://github.com/HKUDS/Vibe-Trading/pull/1663))، وتسجل مخرجات التحقق العددي الفحوص المعلنة التي تفعّلت ([#1661](https://github.com/HKUDS/Vibe-Trading/pull/1661)). تتضمن تقارير صحة مصادر البيانات العامة أسباب الفشل بعد إزالة المعلومات الحساسة ([#1643](https://github.com/HKUDS/Vibe-Trading/pull/1643))، وتطابق وثائق الأدوات الإندونيسية سجل الأدوات ([#1671](https://github.com/HKUDS/Vibe-Trading/pull/1671)).
-
 <details>
 <summary>أخبار سابقة</summary>
 
+- **2026-10-02** 🛠️ **إصلاحات الاختبارات الخلفية وتدقيق التقارير**: تحتفظ كتابة ملفات الاستراتيجيات بمصدر النموذج دون تعطل ([#1673](https://github.com/HKUDS/Vibe-Trading/pull/1673))، وتشمل حسابات التراجع وSharpe في محاكاة مونت كارلو رأس المال الابتدائي ([#1664](https://github.com/HKUDS/Vibe-Trading/pull/1664)). يحافظ تدقيق التقارير على القيم السالبة المحاسبية بين الأقواس ووحداتها ([#1663](https://github.com/HKUDS/Vibe-Trading/pull/1663))، وتسجل مخرجات التحقق العددي الفحوص المعلنة التي تفعّلت ([#1661](https://github.com/HKUDS/Vibe-Trading/pull/1661)). تتضمن تقارير صحة مصادر البيانات العامة أسباب الفشل بعد إزالة المعلومات الحساسة ([#1643](https://github.com/HKUDS/Vibe-Trading/pull/1643))، وتطابق وثائق الأدوات الإندونيسية سجل الأدوات ([#1671](https://github.com/HKUDS/Vibe-Trading/pull/1671)).
+
 - **2026-10-01** ✅ **دقة البيانات واختبارات خلفية قابلة للتكرار**: يرفض تحويل الأسعار المعدلة لأسهم A الحالات الملتبسة ذات الشمعة الواحدة ([#1551](https://github.com/HKUDS/Vibe-Trading/pull/1551)). تُحوَّل مبالغ التدفقات جنوباً من Eastmoney من وحدة مليون دولار هونغ كونغ، ولا تُعامل الردود الفاشلة كبيانات فارغة ([#1486](https://github.com/HKUDS/Vibe-Trading/pull/1486)). يميز المصدر البديل للتدفقات شمالاً بين قيمة التداول وصافي التدفق بعد 2024-08-19 ([#1484](https://github.com/HKUDS/Vibe-Trading/pull/1484)). تُصنَّف مراكز Binance غير المسعّرة وحدها على أنها غير مكتملة دون التأثير على الوسطاء الآخرين ([#1505](https://github.com/HKUDS/Vibe-Trading/pull/1505)). تسجل بطاقات التشغيل مصدر النموذج وتحذر عندما يكون تاريخ انتهاء التدريب 
```

**File**: `README_es.md` (modified, +4/-2)
```diff
@@ -52,16 +52,18 @@
 
 > ⚠️ **Advertencia de seguridad:** la cuenta de X `VibeTrading_HKU`, el proyecto de Virtuals `101845` y el contrato de token `0x640BDBF77b6447E8b7DB7894cED84BD1c40571f4` no son activos oficiales de Vibe-Trading. Nunca hemos lanzado ni respaldado ningún token o memecoin. No compres, conectes una wallet ni firmes nada. [Detalles](SECURITY.md#official-channels--impersonation).
 
+- **2026-10-05** 🛠️ **Consultas de investigación y cálculos corregidos**: El chat admite consultas más largas e indica en el idioma actual cómo acortarlas cuando superan el límite ([#1701](https://github.com/HKUDS/Vibe-Trading/pull/1701)). Sortino usa la desviación a la baja de todos los períodos; la validación por grupos excluye etiquetas solapadas. También mejoran los pesos de covarianza, el RSI con media inicial de Wilder y la eliminación de memorias por nombre de archivo.
+
 - **2026-10-04** 🛠️ **Informes programados y flujos de investigación**: Edita tareas programadas y elige un destino configurado; los informes por email admiten HTML o archivos PDF adjuntos ([#1649](https://github.com/HKUDS/Vibe-Trading/pull/1649), [#1680](https://github.com/HKUDS/Vibe-Trading/pull/1680)).
   Los backtests ofrecen resúmenes estructurados y lectura paginada de resultados ([#1646](https://github.com/HKUDS/Vibe-Trading/pull/1646), [#1647](https://github.com/HKUDS/Vibe-Trading/pull/1647)). Se corrigen fragmentos de búsqueda, indicaciones de exportación, avisos de datos macro truncados, riesgo mensual, rotación al invertir posiciones o reinvertir tras pasar a efectivo, precisión de IV, huecos de VaR, actualizaciones desde VCS y el bloqueo de órdenes de opciones no admitidas en Robinhood.
 
 - **2026-10-03** 🛠️ **Más fiabilidad en investigación, informes y datos**: se corrigen problemas de búsqueda de sesiones en chino, japonés y coreano, configuración de canales, valoración de posiciones del bróker y escritura de archivos que bloqueaban el uso diario. Los PDF incluyen fuentes CJK, Swarm valida las entradas de sus plantillas y separa los archivos por tarea, y los resultados reutilizados de herramientas sobreviven a la compactación del contexto ([#1683](https://github.com/HKUDS/Vibe-Trading/pull/1683), [#1455](https://github.com/HKUDS/Vibe-Trading/pull/1455), [#1635](https://github.com/HKUDS/Vibe-Trading/pull/1635)). Los backtests mantienen una base de ajuste uniforme, la caché local distingue las fuentes y los límites de un solo activo y el riesgo semanal/mensual respetan la configuración declarada. Las auditorías conservan el signo de las pérdidas, la verificación numérica usa la salida actual del motor y referencias exactas a listas, y Stooq vuelve a intentar tras la espera por rechazo ([#1684](https://github.com/HKUDS/Vibe-Trading/pull/1684), [#1650](https://github.com/HKUDS/Vibe-Trading/pull/1650), [#1685](https://github.com/HKUDS/Vibe-Trading/pull/1685), [#1640](https://github.com/HKUDS/Vibe-Trading/pull/1640)).
 
-- **2026-10-02** 🛠️ **Correcciones en backtests y auditorías**: la escritura de estrategias conserva la procedencia del modelo sin fallar ([#1673](https://github.com/HKUDS/Vibe-Trading/pull/1673)), y el drawdown y Sharpe de Monte Carlo incluyen el capital inicial ([#1664](https://github.com/HKUDS/Vibe-Trading/pull/1664)). La auditoría conserva los negativos contables entre paréntesis y sus unidades ([#1663](https://github.com/HKUDS/Vibe-Trading/pull/1663)); los artefactos de verificación numérica registran las comprobaciones declaradas activadas ([#1661](https://github.com/HKUDS/Vibe-Trading/pull/1661)); los informes públicos de salud de fuentes incluyen motivos de fallo sin información sensible ([#1643](https://github.com/HKUDS/Vibe-Trading/pull/1643)). La documentación de herramientas en indonesio coincide con el registro ([#1671](https://github.com/HKUDS/Vibe-Trading/pull/1671)).
-
 <details>
 <summary>Noticias anteriores</summary>
 
+- **2026-10-02** 🛠️ **Correcciones en backtests y auditorías**: la escritura de estrategias conserva la procedencia del modelo sin fallar ([#1673](https://github.com/HKUDS/Vibe-Trading/pull/1673)), y el drawdown y Sharpe de Monte Carlo incluyen el capital inicial ([#1664](https://github.com/HKUDS/Vibe-Trading/pull/1664)). La auditoría conserva los negativos contables entre paréntesis y sus unidades ([#1663](https://github.com/HKUDS/Vibe-Trading/pull/1663)); los artefactos de verificación numérica registran las comprobaciones declaradas activadas ([#1661](https://github.com/HKUDS/Vibe-Trading/pull/1661)); los informes públicos de salud de fuentes incluyen motivos de fallo sin información sensible ([#1643](https://github.com/HKUDS/Vibe-Trading/pull/1643)). La documentación de herramientas en indonesio coincide con el registro ([#1671](https://github.com/HKUDS/Vibe-Trading/pull/1671)).
+
 - **2026-10-01** ✅ **Datos correctos y backtests reproducibles**: la conversión de precios ajustados de acciones A rechaza casos ambiguos de una sola vela ([#1551](https://github.com/HKUDS/Vi
```

**File**: `README_id.md` (modified, +4/-2)
```diff
@@ -53,16 +53,18 @@
 
 > ⚠️ **Peringatan keamanan:** Akun X `VibeTrading_HKU`, proyek Virtuals `101845`, dan kontrak token `0x640BDBF77b6447E8b7DB7894cED84BD1c40571f4` bukan aset resmi Vibe-Trading. Kami tidak pernah meluncurkan atau mendukung token maupun memecoin apa pun. Jangan membeli, menghubungkan wallet, atau menandatangani apa pun. [Detail](SECURITY.md#official-channels--impersonation).
 
+- **2026-10-05** 🛠️ **Input riset dan perbaikan perhitungan**: Chat menerima input riset lebih panjang dan memberi petunjuk dalam bahasa aktif untuk mempersingkat teks yang melampaui batas ([#1701](https://github.com/HKUDS/Vibe-Trading/pull/1701)). Sortino memakai deviasi penurunan dari seluruh periode; validasi grup membuang label yang tumpang tindih. Bobot kovarians, RSI dengan rata-rata awal Wilder, dan penghapusan memori lewat nama file juga diperbaiki.
+
 - **2026-10-04** 🛠️ **Laporan terjadwal dan alur riset**: Edit tugas terjadwal dan pilih tujuan yang sudah dikonfigurasi; laporan email mendukung HTML atau lampiran PDF ([#1649](https://github.com/HKUDS/Vibe-Trading/pull/1649), [#1680](https://github.com/HKUDS/Vibe-Trading/pull/1680)).
   Backtest menyediakan ringkasan terstruktur dan pembacaan artefak per halaman ([#1646](https://github.com/HKUDS/Vibe-Trading/pull/1646), [#1647](https://github.com/HKUDS/Vibe-Trading/pull/1647)). Perbaikan mencakup cuplikan pencarian memori, panduan lokasi ekspor, pemberitahuan pemangkasan data makro, risiko bulanan, turnover saat membalik posisi atau masuk kembali setelah menjadi kas, akurasi IV, celah VaR, pembaruan instalasi VCS, serta pemblokiran order opsi Robinhood yang belum didukung.
 
 - **2026-10-03** 🛠️ **Keandalan riset, laporan, dan data**: masalah pencarian sesi berbahasa Mandarin, Jepang, dan Korea, pengaturan kanal, penilaian posisi broker, serta penulisan berkas yang menghambat penggunaan sehari-hari telah diperbaiki. PDF menyertakan font CJK, Swarm memvalidasi masukan preset dan memisahkan keluaran tiap tugas, serta hasil alat yang digunakan kembali tetap tersedia setelah pemadatan konteks ([#1683](https://github.com/HKUDS/Vibe-Trading/pull/1683), [#1455](https://github.com/HKUDS/Vibe-Trading/pull/1455), [#1635](https://github.com/HKUDS/Vibe-Trading/pull/1635)). Backtest memakai dasar penyesuaian harga yang konsisten, cache lokal membedakan sumber, dan batas aset tunggal serta risiko mingguan/bulanan mengikuti pengaturan yang dinyatakan. Audit mempertahankan tanda kerugian, verifikasi angka memakai keluaran mesin saat ini dan referensi daftar yang tepat, serta Stooq mencoba lagi setelah masa tunggu akibat penolakan ([#1684](https://github.com/HKUDS/Vibe-Trading/pull/1684), [#1650](https://github.com/HKUDS/Vibe-Trading/pull/1650), [#1685](https://github.com/HKUDS/Vibe-Trading/pull/1685), [#1640](https://github.com/HKUDS/Vibe-Trading/pull/1640)).
 
-- **2026-10-02** 🛠️ **Perbaikan backtest dan audit laporan**: penulisan berkas strategi mempertahankan asal model tanpa gagal ([#1673](https://github.com/HKUDS/Vibe-Trading/pull/1673)), dan drawdown serta Sharpe Monte Carlo mencakup modal awal ([#1664](https://github.com/HKUDS/Vibe-Trading/pull/1664)). Audit mempertahankan angka negatif akuntansi dalam tanda kurung beserta satuannya ([#1663](https://github.com/HKUDS/Vibe-Trading/pull/1663)); artefak verifikasi angka mencatat pemeriksaan deklaratif yang terpicu ([#1661](https://github.com/HKUDS/Vibe-Trading/pull/1661)); laporan kesehatan sumber data publik memuat alasan kegagalan tanpa informasi sensitif ([#1643](https://github.com/HKUDS/Vibe-Trading/pull/1643)). Dokumentasi alat berbahasa Indonesia diselaraskan dengan registri ([#1671](https://github.com/HKUDS/Vibe-Trading/pull/1671)).
-
 <details>
 <summary>Berita sebelumnya</summary>
 
+- **2026-10-02** 🛠️ **Perbaikan backtest dan audit laporan**: penulisan berkas strategi mempertahankan asal model tanpa gagal ([#1673](https://github.com/HKUDS/Vibe-Trading/pull/1673)), dan drawdown serta Sharpe Monte Carlo mencakup modal awal ([#1664](https://github.com/HKUDS/Vibe-Trading/pull/1664)). Audit mempertahankan angka negatif akuntansi dalam tanda kurung beserta satuannya ([#1663](https://github.com/HKUDS/Vibe-Trading/pull/1663)); artefak verifikasi angka mencatat pemeriksaan deklaratif yang terpicu ([#1661](https://github.com/HKUDS/Vibe-Trading/pull/1661)); laporan kesehatan sumber data publik memuat alasan kegagalan tanpa informasi sensitif ([#1643](https://github.com/HKUDS/Vibe-Trading/pull/1643)). Dokumentasi alat berbahasa Indonesia diselaraskan dengan registri ([#1671](https://github.com/HKUDS/Vibe-Trading/pull/1671)).
+
 - **2026-10-01** ✅ **Ketepatan data dan backtest yang dapat direproduksi**: konversi harga tersesuaikan saham A menolak kasus ambigu dengan satu bar ([#1551](https://github.com/HKUDS/Vibe-Trading/pull/1551)). Nilai arus Southbound Eastmoney dikonversi dari juta HKD dan respons gagal tidak lagi dianggap data kosong ([#1486](https://github.com/HKUDS/Vibe-Trading/pull/1486)). Sumber alternatif
```

**File**: `README_ja.md` (modified, +4/-2)
```diff
@@ -52,16 +52,18 @@
 
 > ⚠️ **セキュリティ警告：** Xアカウント `VibeTrading_HKU`、Virtualsプロジェクト `101845`、およびトークンコントラクト `0x640BDBF77b6447E8b7DB7894cED84BD1c40571f4` は、いずれもVibe-Trading公式のものではありません。Vibe-Tradingはこれまで、いかなるトークンやミームコインも発行・公認していません。購入、ウォレットの接続、署名は行わないでください。[詳細](SECURITY.md#official-channels--impersonation)
 
+- **2026-10-05** 🛠️ **調査入力と計算の修正**：チャットで長い調査入力に対応し、上限を超えた場合は現在の言語で短縮を案内します（[#1701](https://github.com/HKUDS/Vibe-Trading/pull/1701)）。Sortino は全期間の下方偏差を使用し、グループ検証は重複ラベルを除外します。共分散ウェイト、Wilder 初期平均による RSI、ファイル名によるメモリ削除も改善しました。
+
 - **2026-10-04** 🛠️ **定期レポートと調査フローの改善**：定期タスクを編集し、設定済みの送信先を選択できます。メールレポートは HTML または PDF 添付に対応しました（[#1649](https://github.com/HKUDS/Vibe-Trading/pull/1649), [#1680](https://github.com/HKUDS/Vibe-Trading/pull/1680)）。
   バックテストに構造化サマリーと成果物のページ読み取りを追加（[#1646](https://github.com/HKUDS/Vibe-Trading/pull/1646), [#1647](https://github.com/HKUDS/Vibe-Trading/pull/1647)）。メモリ検索の抜粋、エクスポート先の案内、マクロデータの切り詰め表示、月足リスク、売買方向の反転・現金化後の再投資の回転率、IV 精度、VaR の欠損区間、VCS インストールの更新、Robinhood の未対応オプション注文の遮断も修正しました。
 
 - **2026-10-03** 🛠️ **調査・レポート・データの信頼性を改善**：中国語・日本語・韓国語のセッション検索、チャネル設定、証券会社の保有資産評価、ファイル書き込みで日常利用を妨げていた問題を修正。PDF 配信には CJK フォントを埋め込み、Swarm はプリセット入力を検証してタスクごとの成果物を分離し、再利用したツール結果はコンテキスト圧縮後も保持されます（[#1683](https://github.com/HKUDS/Vibe-Trading/pull/1683), [#1455](https://github.com/HKUDS/Vibe-Trading/pull/1455), [#1635](https://github.com/HKUDS/Vibe-Trading/pull/1635)）。バックテストは価格調整方式を統一し、ローカルキャッシュはデータソースを区別、単一資産の上限と週次・月次リスクは指定設定に従います。監査は損失の符号を保持し、数値検証は今回のエンジン出力と正確なリスト参照を使い、Stooq は拒否後の待機期間が過ぎると再試行できます（[#1684](https://github.com/HKUDS/Vibe-Trading/pull/1684), [#1650](https://github.com/HKUDS/Vibe-Trading/pull/1650), [#1685](https://github.com/HKUDS/Vibe-Trading/pull/1685), [#1640](https://github.com/HKUDS/Vibe-Trading/pull/1640)）。
 
-- **2026-10-02** 🛠️ **バックテストとレポート検証の修正**：戦略ファイルへの書き込みがクラッシュせずモデルの出所を保持します ([#1673](https://github.com/HKUDS/Vibe-Trading/pull/1673))。モンテカルロのドローダウンと Sharpe 計算に初期資金を含めます ([#1664](https://github.com/HKUDS/Vibe-Trading/pull/1664))。レポート監査は会計上の括弧付き負数と単位を保持し ([#1663](https://github.com/HKUDS/Vibe-Trading/pull/1663))、数値検証の成果物には実際に発火した宣言型チェックを記録します ([#1661](https://github.com/HKUDS/Vibe-Trading/pull/1661))。公開データソースのヘルスレポートに機密情報を除いた失敗理由を添え ([#1643](https://github.com/HKUDS/Vibe-Trading/pull/1643))、インドネシア語のツール文書をレジストリに合わせました ([#1671](https://github.com/HKUDS/Vibe-Trading/pull/1671))。
-
 <details>
 <summary>過去のニュース</summary>
 
+- **2026-10-02** 🛠️ **バックテストとレポート検証の修正**：戦略ファイルへの書き込みがクラッシュせずモデルの出所を保持します ([#1673](https://github.com/HKUDS/Vibe-Trading/pull/1673))。モンテカルロのドローダウンと Sharpe 計算に初期資金を含めます ([#1664](https://github.com/HKUDS/Vibe-Trading/pull/1664))。レポート監査は会計上の括弧付き負数と単位を保持し ([#1663](https://github.com/HKUDS/Vibe-Trading/pull/1663))、数値検証の成果物には実際に発火した宣言型チェックを記録します ([#1661](https://github.com/HKUDS/Vibe-Trading/pull/1661))。公開データソースのヘルスレポートに機密情報を除いた失敗理由を添え ([#1643](https://github.com/HKUDS/Vibe-Trading/pull/1643))、インドネシア語のツール文書をレジストリに合わせました ([#1671](https://github.com/HKUDS/Vibe-Trading/pull/1671))。
+
 - **2026-10-01** ✅ **データの正確性と再現可能なバックテスト**：A 株の調整価格変換は曖昧な 1 本のバーの境界ケースを拒否します ([#1551](https://github.com/HKUDS/Vibe-Trading/pull/1551))。南向き資金の東方財富データは百万香港ドルから換算し、失敗応答を空データと扱いません ([#1486](https://github.com/HKUDS/Vibe-Trading/pull/1486))。北向き資金の代替ソースは 2024-08-19 以降の売買代金と純流入を区別します ([#1484](https://github.com/HKUDS/Vibe-Trading/pull/1484))。Binance の未評価ポジションだけを不完全とし、他のブローカーには影響させません ([#1505](https://github.com/HKUDS/Vibe-Trading/pull/1505))。実行カードにモデルの出所を記録し、学習期限が不明またはテスト期間外の場合に警告します ([#1618](https://github.com/HKUDS/Vibe-Trading/pull/1618))。
 
 - **2026-09-30** 🛠️ **Web UI での Feishu 設定、当日の価格を読んでいたモメンタム因子、負けトレードのないバックテストのプロフィットファクター**：Feishu がガイド付きチャンネル設定に加わり、単独の接続テストと、ホットリロード時に古い WebSocket を閉じる処理を備えました（[#1572](https://github.com/HKUDS/Vibe-Trading/pull/1572)）。`academic_carhart_mom` は 12 か月リターンから 1 か月リターンを引いていたため、当日の終値で動いていました。現在は 12 か月前から 1 か月前までのリターンです（[#1578](https://github.com/HKUDS/Vibe-Trading/pull/1578)）。負けトレードのない実行では、プロフィットファクターを最下位に並べてしまう 0.0 ではなく「未定義」と報告します（[#1602](https://github.com/HKUDS/Vibe-Trading/pull/1602)）。Stooq のボット対策ページを検出すると、ログだけでなくそのプロセス内の以降のリクエストもすべて止めます（[#1637](https://github.com/HKUDS/Vibe-Trading/pull/1637)）。MCP ツールの結果は最大 4 重ではなく 1 回だけエージェントに渡り（[#1634](https://github.com/HKUDS/Vibe-Trading/pull/1634)）、`loop.py` から最初のモジュールが分離されました（[#1636](https://github.com/HKUDS/Vibe-Trading/pull/1636)）。
```

**File**: `README_ko.md` (modified, +4/-2)
```diff
@@ -52,16 +52,18 @@
 
 > ⚠️ **보안 경고:** X 계정 `VibeTrading_HKU`, Virtuals 프로젝트 `101845`, 토큰 컨트랙트 `0x640BDBF77b6447E8b7DB7894cED84BD1c40571f4`는 모두 Vibe-Trading 공식과 무관합니다. Vibe-Trading은 어떠한 토큰이나 밈코인도 발행하거나 공식적으로 지지한 적이 없습니다. 해당 토큰을 구매하거나 지갑을 연결하거나 어떠한 서명도 하지 마세요. [자세히 보기](SECURITY.md#official-channels--impersonation).
 
+- **2026-10-05** 🛠️ **리서치 입력과 계산 수정**: 더 긴 리서치 입력을 지원하며 한도를 넘으면 현재 언어로 줄이도록 안내합니다([#1701](https://github.com/HKUDS/Vibe-Trading/pull/1701)). Sortino는 전체 기간의 하방 편차를 사용하고 그룹 검증은 겹치는 레이블을 제외합니다. 공분산 가중치, Wilder 초기 평균을 사용하는 RSI, 파일명으로 메모리 삭제도 개선했습니다.
+
 - **2026-10-04** 🛠️ **예약 보고서와 리서치 흐름 개선**: 예약 작업을 편집하고 설정된 수신 대상을 선택할 수 있습니다. 이메일 보고서는 HTML 또는 PDF 첨부를 지원합니다([#1649](https://github.com/HKUDS/Vibe-Trading/pull/1649), [#1680](https://github.com/HKUDS/Vibe-Trading/pull/1680)).
   백테스트에 구조화된 요약과 결과 파일 페이지 읽기를 추가했습니다([#1646](https://github.com/HKUDS/Vibe-Trading/pull/1646), [#1647](https://github.com/HKUDS/Vibe-Trading/pull/1647)). 메모리 검색 미리보기, 내보내기 경로 안내, 매크로 데이터 잘림 표시, 월봉 리스크, 포지션 반전과 현금화 후 재진입의 회전율, IV 정확도, VaR 결측 구간, VCS 설치 업데이트, Robinhood의 미지원 옵션 주문 차단도 수정했습니다.
 
 - **2026-10-03** 🛠️ **리서치·보고서·데이터 신뢰성 개선**: 중국어·일본어·한국어 세션 검색, 채널 설정, 증권사 보유 자산 평가와 파일 쓰기에서 일상적인 사용을 막던 문제를 수정했습니다. PDF 전달 시 CJK 글꼴을 포함하고, Swarm은 프리셋 입력을 검증하며 작업별 산출물을 분리하고, 재사용한 도구 결과는 컨텍스트 압축 후에도 유지됩니다([#1683](https://github.com/HKUDS/Vibe-Trading/pull/1683), [#1455](https://github.com/HKUDS/Vibe-Trading/pull/1455), [#1635](https://github.com/HKUDS/Vibe-Trading/pull/1635)). 백테스트의 가격 조정 기준을 통일하고 로컬 캐시는 데이터 소스를 구분하며, 단일 자산 한도와 주간·월간 위험 계산은 지정된 설정을 따릅니다. 감사는 손실 부호를 유지하고 수치 검증은 이번 엔진 출력과 정확한 목록 참조를 사용하며, Stooq은 거부 후 대기 시간이 지나면 재시도합니다([#1684](https://github.com/HKUDS/Vibe-Trading/pull/1684), [#1650](https://github.com/HKUDS/Vibe-Trading/pull/1650), [#1685](https://github.com/HKUDS/Vibe-Trading/pull/1685), [#1640](https://github.com/HKUDS/Vibe-Trading/pull/1640)).
 
-- **2026-10-02** 🛠️ **백테스트와 보고서 검증 수정**: 전략 파일 쓰기가 충돌 없이 모델 출처를 유지하고 ([#1673](https://github.com/HKUDS/Vibe-Trading/pull/1673)), 몬테카를로 낙폭과 Sharpe 계산에 초기 자본을 포함합니다 ([#1664](https://github.com/HKUDS/Vibe-Trading/pull/1664)). 보고서 감사는 회계식 괄호 음수와 단위를 보존하며 ([#1663](https://github.com/HKUDS/Vibe-Trading/pull/1663)), 수치 검증 산출물은 발동된 선언형 검사를 기록합니다 ([#1661](https://github.com/HKUDS/Vibe-Trading/pull/1661)). 공개 데이터 소스 상태 보고서에는 민감 정보를 제거한 실패 이유를 담고 ([#1643](https://github.com/HKUDS/Vibe-Trading/pull/1643)), 인도네시아어 도구 문서를 레지스트리에 맞췄습니다 ([#1671](https://github.com/HKUDS/Vibe-Trading/pull/1671)).
-
 <details>
 <summary>이전 뉴스</summary>
 
+- **2026-10-02** 🛠️ **백테스트와 보고서 검증 수정**: 전략 파일 쓰기가 충돌 없이 모델 출처를 유지하고 ([#1673](https://github.com/HKUDS/Vibe-Trading/pull/1673)), 몬테카를로 낙폭과 Sharpe 계산에 초기 자본을 포함합니다 ([#1664](https://github.com/HKUDS/Vibe-Trading/pull/1664)). 보고서 감사는 회계식 괄호 음수와 단위를 보존하며 ([#1663](https://github.com/HKUDS/Vibe-Trading/pull/1663)), 수치 검증 산출물은 발동된 선언형 검사를 기록합니다 ([#1661](https://github.com/HKUDS/Vibe-Trading/pull/1661)). 공개 데이터 소스 상태 보고서에는 민감 정보를 제거한 실패 이유를 담고 ([#1643](https://github.com/HKUDS/Vibe-Trading/pull/1643)), 인도네시아어 도구 문서를 레지스트리에 맞췄습니다 ([#1671](https://github.com/HKUDS/Vibe-Trading/pull/1671)).
+
 - **2026-10-01** ✅ **데이터 정확성과 재현 가능한 백테스트**: A주 수정주가 변환은 모호한 단일 봉 경계 사례를 거부합니다 ([#1551](https://github.com/HKUDS/Vibe-Trading/pull/1551)). 남향 자금의 Eastmoney 금액은 백만 HKD 단위에서 환산하고 실패 응답을 빈 데이터로 처리하지 않습니다 ([#1486](https://github.com/HKUDS/Vibe-Trading/pull/1486)). 북향 자금 대체 소스는 2024-08-19 이후 거래대금과 순유입을 구분합니다 ([#1484](https://github.com/HKUDS/Vibe-Trading/pull/1484)). Binance의 미평가 포지션만 불완전으로 표시하며 다른 브로커에는 영향을 주지 않습니다 ([#1505](https://github.com/HKUDS/Vibe-Trading/pull/1505)). 실행 카드는 모델 출처를 기록하고 학습 기준일이 불명확하거나 테스트 기간 밖이면 경고합니다 ([#1618](https://github.com/HKUDS/Vibe-Trading/pull/1618)).
 
 - **2026-09-30** 🛠️ **Web UI의 Feishu 설정, 당일 가격을 읽던 모멘텀 팩터, 손실 거래가 없는 백테스트의 수익 팩터**: Feishu가 가이드형 채널 설정에 추가되어 독립 연결 테스트를 제공하고, 핫 리로드 시 이전 WebSocket을 닫습니다([#1572](https://github.com/HKUDS/Vibe-Trading/pull/1572)). `academic_carhart_mom`은 12개월 수익률에서 1개월 수익률을 빼서 당일 종가에 따라 움직였으나, 이제 12개월 전부터 1개월 전까지의 수익률입니다([#1578](https://github.com/HKUDS/Vibe-Trading/pull/1578)). 손실 거래가 없는 실행은 수익 팩터를 최하위로 정렬되게 만드는 0.0 대신 정의되지 않음으로 보고합니다([#1602](https://github.com/HKUDS/Vibe-Trading/pull/1602)). Stooq의 봇 차단 페이지를 감지하면 로그만 남기는 것이 아니라 해당 프로세스의 이후 요청을 모두 중단하고([#1637](https://github.com/HKUDS/Vibe-Trading/pull/1637)), MCP 도구 결과는 최대 네 번이 아니라 한 번만 에이전트에 전달되며([#1634](https://github.com/HKUDS/Vibe-Trading/pull/1634)), `loop.py`에서 첫 번째 모듈이 분리되었습니다([#1636](https://github.com/HKUDS/Vibe-Trading/pull/1636)).
```

**File**: `README_zh.md` (modified, +4/-2)
```diff
@@ -52,16 +52,18 @@
 
 > ⚠️ **安全警告：** X 账号 `VibeTrading_HKU`、Virtuals 项目 `101845` 及代币合约 `0x640BDBF77b6447E8b7DB7894cED84BD1c40571f4` 均非 Vibe-Trading 官方。我们从未发行或背书任何代币或 meme 币。请勿购买、连接钱包或签名。[详细说明](SECURITY.md#official-channels--impersonation)。
 
+- **2026-10-05** 🛠️ **研究输入与计算修复**：聊天支持更长的研究输入，超限时以当前语言提示缩短（[#1701](https://github.com/HKUDS/Vibe-Trading/pull/1701)）。回测 Sortino 使用全样本下行偏差；分组验证剔除重叠标签，协方差权重保持有限，影子账户 RSI 使用 Wilder 初始均值，记忆支持按文件名删除。
+
 - **2026-10-04** 🛠️ **定时报告与研究流程完善**：定时任务支持编辑并选择已配置的交付目标，邮件报告可选 HTML 或 PDF 附件（[#1649](https://github.com/HKUDS/Vibe-Trading/pull/1649), [#1680](https://github.com/HKUDS/Vibe-Trading/pull/1680)）。
   回测提供结构化摘要与产物分页读取（[#1646](https://github.com/HKUDS/Vibe-Trading/pull/1646), [#1647](https://github.com/HKUDS/Vibe-Trading/pull/1647)）；同时修复记忆搜索片段、导出路径提示、宏观数据截断说明、月线风险、反向持仓及清仓后重新入场的换手率、隐含波动率精度、VaR 缺口、源码安装更新，以及 Robinhood 不受支持的期权下单拦截。
 
 - **2026-10-03** 🛠️ **研究、报告与数据可靠性修复**：修复中文、日文和韩文会话搜索、渠道设置、券商持仓估值与文件写入中阻碍日常使用的问题。PDF 交付嵌入中日韩字体，Swarm 校验预设输入并隔离各任务产物，回放的工具结果在上下文压缩后仍可用（[#1683](https://github.com/HKUDS/Vibe-Trading/pull/1683), [#1455](https://github.com/HKUDS/Vibe-Trading/pull/1455), [#1635](https://github.com/HKUDS/Vibe-Trading/pull/1635)）。回测保持一致复权口径，本地缓存区分数据来源，单资产上限与周/月风险计算遵循声明设置，审计保留亏损符号，数值核验绑定本次引擎输出及准确列表引用，Stooq 拒绝冷却后允许重试（[#1684](https://github.com/HKUDS/Vibe-Trading/pull/1684), [#1650](https://github.com/HKUDS/Vibe-Trading/pull/1650), [#1685](https://github.com/HKUDS/Vibe-Trading/pull/1685), [#1640](https://github.com/HKUDS/Vibe-Trading/pull/1640)）。
 
-- **2026-10-02** 🛠️ **回测与报告核验修复**：策略文件写入保留模型来源，不再崩溃 ([#1673](https://github.com/HKUDS/Vibe-Trading/pull/1673))；蒙特卡洛回撤与 Sharpe 计算纳入初始资金 ([#1664](https://github.com/HKUDS/Vibe-Trading/pull/1664))。报告审计保留会计括号负数及单位 ([#1663](https://github.com/HKUDS/Vibe-Trading/pull/1663))，数值核验制品记录已触发的声明式检查 ([#1661](https://github.com/HKUDS/Vibe-Trading/pull/1661))，公开数据源健康报告附带脱敏后的失败原因 ([#1643](https://github.com/HKUDS/Vibe-Trading/pull/1643))。印尼语工具文档与注册表同步 ([#1671](https://github.com/HKUDS/Vibe-Trading/pull/1671))。
-
 <details>
 <summary>更早的新闻</summary>
 
+- **2026-10-02** 🛠️ **回测与报告核验修复**：策略文件写入保留模型来源，不再崩溃 ([#1673](https://github.com/HKUDS/Vibe-Trading/pull/1673))；蒙特卡洛回撤与 Sharpe 计算纳入初始资金 ([#1664](https://github.com/HKUDS/Vibe-Trading/pull/1664))。报告审计保留会计括号负数及单位 ([#1663](https://github.com/HKUDS/Vibe-Trading/pull/1663))，数值核验制品记录已触发的声明式检查 ([#1661](https://github.com/HKUDS/Vibe-Trading/pull/1661))，公开数据源健康报告附带脱敏后的失败原因 ([#1643](https://github.com/HKUDS/Vibe-Trading/pull/1643))。印尼语工具文档与注册表同步 ([#1671](https://github.com/HKUDS/Vibe-Trading/pull/1671))。
+
 - **2026-10-01** ✅ **数据正确性与可复现回测**：A 股复权转换拒绝有歧义的单根 K 线边界 ([#1551](https://github.com/HKUDS/Vibe-Trading/pull/1551))；南向东财金额按百万港元缩放，失败响应不再被当作空数据 ([#1486](https://github.com/HKUDS/Vibe-Trading/pull/1486))；北向备用源区分 2024-08-19 后的成交额与净流入 ([#1484](https://github.com/HKUDS/Vibe-Trading/pull/1484))。币安未定价持仓标记为不完整，不影响其他券商 ([#1505](https://github.com/HKUDS/Vibe-Trading/pull/1505))；回测运行卡记录模型来源，并提示训练截止日期未知或不在回测区间内 ([#1618](https://github.com/HKUDS/Vibe-Trading/pull/1618))。
 
 - **2026-09-30** 🛠️ **飞书进入 Web UI、一个读到当天价格的动量因子，以及从未亏损的回测的盈利因子**：飞书加入引导式频道配置，提供独立的连接测试，热重载时会关闭旧的 WebSocket（[#1572](https://github.com/HKUDS/Vibe-Trading/pull/1572)）。`academic_carhart_mom` 原本用 12 个月收益减去 1 个月收益，结果随当天收盘价变动；现在改为从 12 个月前到 1 个月前的收益（[#1578](https://github.com/HKUDS/Vibe-Trading/pull/1578)）。没有亏损交易的回测，盈利因子现在记为未定义，而不是会把它排到最后的 0.0（[#1602](https://github.com/HKUDS/Vibe-Trading/pull/1602)）。Stooq 的反爬页面现在会让本进程后续请求全部停下，而不只是记一条日志（[#1637](https://github.com/HKUDS/Vibe-Trading/pull/1637)）；MCP 工具结果只传给 agent 一份，不再重复最多四次（[#1634](https://github.com/HKUDS/Vibe-Trading/pull/1634)）；`loop.py` 拆出第一个独立模块（[#1636](https://github.com/HKUDS/Vibe-Trading/pull/1636)）。
```

---

### Incident Patch 9: `8f3e63bd` (2026-10-05)
**Commit Message**: Merge PR #1699: require disjoint IC decay windows

**File**: `agent/src/strategy_store/metrics.py` (modified, +7/-1)
```diff
@@ -73,11 +73,17 @@ def compute_decay_metrics(
         result["baseline_ic_mean"] = round(baseline_mean, 6)
         result["rolling_ic_mean"] = round(rolling_mean, 6)
 
+        # baseline_ics and rolling_ics are the oldest/newest 5 entries, so
+        # with fewer than 10 they share observations -- at 3-9 entries
+        # they're the same window read twice, making ic_ratio exactly 1.0
+        # regardless of how much the IC actually moved. Require the two
+        # windows to be disjoint before trusting their ratio.
+        #
         # baseline_mean > 0, not != 0: with a negative baseline, dividing
         # two negatives gives a positive ratio, so a rolling IC that got
         # much MORE negative (real decay) produces a large ic_ratio that
         # the healthy/warning/decayed thresholds read as improvement.
-        if baseline_mean > 0:
+        if baseline_mean > 0 and len(ic_values) >= len(baseline_ics) + len(rolling_ics):
             result["ic_ratio"] = round(rolling_mean / baseline_mean, 4)
 
         if len(rolling_ics) > 1:
```

**File**: `agent/tests/test_sdm_finite_metrics.py` (modified, +24/-0)
```diff
@@ -69,6 +69,30 @@ def test_ic_ratio_still_computed_for_a_positive_baseline():
     assert metrics["ic_ratio"] == pytest.approx(0.5)
 
 
+@pytest.mark.parametrize("n", [3, 4, 5, 6, 9])
+def test_ic_ratio_is_none_when_baseline_and_rolling_windows_overlap(n):
+    """With fewer than 10 entries, the oldest-5 and newest-5 windows share
+    observations -- at 3-9 entries they're the same data read twice, which
+    made ic_ratio exactly 1.0 no matter how much the IC actually moved. A
+    strategy whose IC just collapsed from 0.08 to 0.001 must not come back
+    reading as unchanged."""
+    history_newest_first = [BenchResult(ic_mean=0.001)] + [
+        BenchResult(ic_mean=0.08) for _ in range(n - 1)
+    ]
+
+    metrics = compute_decay_metrics(history_newest_first)
+
+    assert metrics["ic_ratio"] is None
+
+
+def test_ic_ratio_computed_once_windows_stop_overlapping():
+    history_newest_first = [BenchResult(ic_mean=v) for v in [0.001] + [0.08] * 9]
+
+    metrics = compute_decay_metrics(history_newest_first)
+
+    assert metrics["ic_ratio"] is not None
+
+
 @pytest.mark.parametrize("backend", ["memory", "sqlite"])
 @pytest.mark.parametrize("field", ["ic_mean", "sharpe"])
 @pytest.mark.parametrize("invalid", [math.nan, math.inf, -math.inf])
```

---

### Incident Patch 10: `08859ba6` (2026-10-05)
**Commit Message**: Merge PR #1697: resolve memory filename stems on removal

**File**: `agent/src/memory/persistent.py` (modified, +16/-3)
```diff
@@ -626,13 +626,18 @@ def add(
         return path
 
     def remove(self, name: str, memory_type: str | None = None) -> bool:
-        """Remove a memory entry by name.
+        """Remove a memory entry by title or filename stem.
 
         One title can exist under several memory types, each in its own file
         (``{memory_type}_{slug}.md``, #1525), so a bare title can be ambiguous.
 
+        Falls back to filename-stem resolution (matching ``find()``) when no
+        title matches, so a name that resolves via ``find()`` or the CLI's
+        ``memory forget`` command also resolves here instead of silently
+        reporting "not found" for the same entry.
+
         Args:
-            name: Title of the entry to remove.
+            name: Title or filename stem of the entry to remove.
             memory_type: The entry's type; needed only when the title exists
                 under more than one type.
 
@@ -645,11 +650,19 @@ def remove(self, name: str, memory_type: str | None = None) -> bool:
         """
         from src.config.accessor import get_env_config
 
+        entries = self._scan_entries()
         matches = [
             entry
-            for entry in self._scan_entries()
+            for entry in entries
             if entry.title == name and (memory_type is None or entry.memory_type == memory_type)
         ]
+        if not matches:
+            matches = [
+                entry
+                for entry in entries
+                if (entry.path.stem == name or entry.path.stem.endswith(f"_{name}"))
+                and (memory_type is None or entry.memory_type == memory_type)
+            ]
         if not matches:
             return False
         if len(matches) > 1:
```

**File**: `agent/tests/test_persistent_memory.py` (modified, +8/-0)
```diff
@@ -472,6 +472,14 @@ def test_remove_then_find(self, tmp_path: Path) -> None:
         results = pm.find_relevant("temporary")
         assert len(results) == 0
 
+    def test_remove_by_filename_stem(self, tmp_path: Path) -> None:
+        """remove() should resolve a filename stem the same way find() does,
+        not just an exact title match."""
+        pm = PersistentMemory(memory_dir=tmp_path)
+        pm.add("Q2 Planning", "roadmap notes", "project")
+        assert pm.remove("project_q2_planning") is True
+        assert pm.find("Q2 Planning") is None
+
 
 # ---------------------------------------------------------------------------
 # PersistentMemory.snapshot
```

---

### Incident Patch 11: `5029bbc2` (2026-10-04)
**Commit Message**: fix(api): raise the interactive message cap to match the scheduled-run path

POST /sessions/{id}/messages caps content at 5000 characters while
POST /scheduled-runs places no cap on prompt at all. Same agent, same model,
same eventual context: one path refuses at roughly 1,250 tokens and the other
accepts anything.

The field's own description is "Natural language strategy description", and 5000
characters is generous for describing a strategy. It has since become the
general chat input, where it is not - the limit did not move with the purpose.

The effect is worse than a refusal. Pydantic rejects the body during validation,
so nothing is attempted and no model is reached; the UI reports "Failed to send
message, please retry" and retrying cannot help. The 422 is also 12-14 KB,
because it echoes the entire rejected input back.

100,000 characters is roughly 25k tokens, comfortably inside any supported
model's context while still bounding the request body.

**File**: `agent/src/api/sessions_routes.py` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ class SessionResponse(BaseModel):
 
 class SendMessageRequest(BaseModel):
     """Send chat message: natural-language strategy description."""
-    content: str = Field(..., description="Natural language strategy description", min_length=1, max_length=5000)
+    content: str = Field(..., description="Natural language strategy description", min_length=1, max_length=100_000)
 
 
 class MessageResponse(BaseModel):
```

---

### Incident Patch 12: `9befcbae` (2026-10-04)
**Commit Message**: fix(quantlib): purge groups whose labels reach into the test block

Signed-off-by: Lanre Shittu <[REDACTED_EMAIL]>

**File**: `agent/src/quantlib/crossvalidation.py` (modified, +33/-2)
```diff
@@ -291,6 +291,7 @@ def purged_kfold_splits(
 
 def group_purged_kfold_splits(
     groups: Sequence[object] | pd.Series | np.ndarray,
+    label_end_times: pd.Series | Sequence[int] | np.ndarray | None = None,
     n_folds: int = 5,
     embargo_fraction: float = DEFAULT_EMBARGO_FRACTION,
 ) -> Iterator[Split]:
@@ -302,6 +303,10 @@ def group_purged_kfold_splits(
 
     Args:
         groups: Group identifiers (e.g. dates or bar index) for each sample row in order.
+        label_end_times: Where each row's label resolves, in the same positional form
+            :func:`purged_kfold_splits` takes. When None, each label is assumed to
+            resolve within its own group, so purging removes only the boundary and
+            the embargo does the remaining work.
         n_folds: Number of folds, at least :data:`MIN_FOLDS`.
         embargo_fraction: Fraction of unique ordered groups embargoed after each test block.
 
@@ -339,6 +344,22 @@ def group_purged_kfold_splits(
     for g in group_to_rows:
         group_to_rows[g] = np.array(group_to_rows[g], dtype=int)
 
+    # Position of each group in chronological order, and the same per row --
+    # used below to translate a row-level label span into the furthest group
+    # a group's own rows reach into.
+    group_order = {g: i for i, g in enumerate(unique_groups)}
+    row_group_order = np.array([group_order[g] for g in grp_array])
+
+    if label_end_times is None:
+        # A label resolves within its own group: it can never reach forward
+        # into a later group, so there is nothing for backward purging to do.
+        group_reach = np.arange(n_groups)
+    else:
+        label_ends = _as_label_spans(label_end_times, n_samples)
+        group_reach = np.array(
+            [row_group_order[label_ends[group_to_rows[g]]].max() for g in unique_groups]
+        )
+
     embargo_groups = int(round(n_groups * embargo_fraction))
     boundaries = np.linspace(0, n_groups, n_folds + 1).astype(int)
 
@@ -351,13 +372,22 @@ def group_purged_kfold_splits(
         embargo_end_g = min(n_groups, stop_g + embargo_groups)
         embargo_groups_set = set(unique_groups[stop_g:embargo_end_g])
 
+        # Symmetric purge: an earlier group whose own labels reach forward
+        # into the test block overlaps it just as much as a later group
+        # embargoed for starting shortly after -- see the module docstring.
+        purge_groups_set = {
+            unique_groups[g_idx]
+            for g_idx in range(start_g)
+            if group_reach[g_idx] >= start_g
+        }
+
         test_rows_list = [group_to_rows[g] for g in unique_groups[start_g:stop_g]]
         test_rows = np.concatenate(test_rows_list) if test_rows_list else np.array([], dtype=int)
         if test_rows.size == 0:
             continue
         train_rows_list = []
         for g in unique_groups:
-            if g not in test_groups and g not in embargo_groups_set:
+            if g not in test_groups and g not in embargo_groups_set and g not in purge_groups_set:
                 train_rows_list.append(group_to_rows[g])
 
         train_rows = np.concatenate(train_rows_list) if train_rows_list else np.array([], dtype=int)
@@ -367,11 +397,12 @@ def group_purged_kfold_splits(
         test_rows.sort()
 
         embargoed_count = sum(len(group_to_rows[g]) for g in embargo_groups_set)
+        purged_count = sum(len(group_to_rows[g]) for g in purge_groups_set)
 
         yield Split(
             train=train_rows,
             test=test_rows,
-            purged=0,
+            purged=purged_count,
             embargoed=embargoed_count,
             test_bounds=(int(test_rows.min()), int(test_rows.max())),
         )
```

**File**: `agent/tests/quantlib/test_crossvalidation.py` (modified, +70/-0)
```diff
@@ -387,6 +387,76 @@ def test_group_purged_kfold_splits_input_validation():
         list(group_purged_kfold_splits([], n_folds=2))
 
 
+def test_group_purged_kfold_splits_leaks_a_forward_looking_label_without_purging():
+    """Groups adjacent to the test block are embargoed, but a group further
+    back whose own label reaches forward into the test window was never
+    checked at all -- group_purged_kfold_splits hardcoded purged=0 and took
+    no label_end_times, unlike every other splitter in this module. This
+    reproduces the leak directly against the module's own leakage auditor.
+    """
+    n_dates, n_assets = 10, 2
+    dates = np.repeat(np.arange(n_dates), n_assets)
+    n = len(dates)
+    # Each row's label resolves 3 rows (~1.5 dates) later.
+    label_end_times = np.minimum(np.arange(n) + 3, n - 1)
+
+    splits = list(
+        group_purged_kfold_splits(dates, n_folds=5, embargo_fraction=0.3)
+    )
+    reports = [
+        detect_boundary_leakage(split, label_end_times, n_samples=n, embargo_size=3)
+        for split in splits
+    ]
+
+    assert any(not report.clean for report in reports)
+
+
+def test_group_purged_kfold_splits_purges_a_forward_looking_label():
+    n_dates, n_assets = 10, 2
+    dates = np.repeat(np.arange(n_dates), n_assets)
+    n = len(dates)
+    label_end_times = np.minimum(np.arange(n) + 3, n - 1)
+
+    splits = list(
+        group_purged_kfold_splits(
+            dates, label_end_times, n_folds=5, embargo_fraction=0.3
+        )
+    )
+
+    for split in splits:
+        report = detect_boundary_leakage(
+            split, label_end_times, n_samples=n, embargo_size=3
+        )
+        assert report.clean, f"leak: overlapping={report.overlapping.tolist()}"
+
+
+def test_group_purged_kfold_splits_reports_purged_count():
+    n_dates, n_assets = 10, 2
+    dates = np.repeat(np.arange(n_dates), n_assets)
+    n = len(dates)
+    label_end_times = np.minimum(np.arange(n) + 3, n - 1)
+
+    splits = list(
+        group_purged_kfold_splits(
+            dates, label_end_times, n_folds=5, embargo_fraction=0.3
+        )
+    )
+
+    assert any(split.purged > 0 for split in splits)
+
+
+def test_group_purged_kfold_splits_without_label_end_times_is_unchanged():
+    """The default (no label_end_times) path must behave exactly as before:
+    no backward purging, purged always 0."""
+    n_dates, n_assets = 100, 10
+    dates = np.repeat(np.arange(n_dates), n_assets)
+
+    splits = list(group_purged_kfold_splits(dates, n_folds=5, embargo_fraction=0.05))
+
+    for split in splits:
+        assert split.purged == 0
+
+
 def test_timestamp_label_index_must_be_ordered_and_unique():
     index = pd.to_datetime(["2024-01-01", "2024-01-03", "2024-01-02", "2024-01-04"])
     ends = pd.Series(index, index=index)
```

---

### Incident Patch 13: `ecaa431a` (2026-10-04)
**Commit Message**: fix(sdm): stop treating overlapping IC windows as an unchanged ratio

Signed-off-by: Lanre Shittu <[REDACTED_EMAIL]>

**File**: `agent/src/strategy_store/metrics.py` (modified, +7/-1)
```diff
@@ -73,11 +73,17 @@ def compute_decay_metrics(
         result["baseline_ic_mean"] = round(baseline_mean, 6)
         result["rolling_ic_mean"] = round(rolling_mean, 6)
 
+        # baseline_ics and rolling_ics are the oldest/newest 5 entries, so
+        # with fewer than 10 they share observations -- at 3-9 entries
+        # they're the same window read twice, making ic_ratio exactly 1.0
+        # regardless of how much the IC actually moved. Require the two
+        # windows to be disjoint before trusting their ratio.
+        #
         # baseline_mean > 0, not != 0: with a negative baseline, dividing
         # two negatives gives a positive ratio, so a rolling IC that got
         # much MORE negative (real decay) produces a large ic_ratio that
         # the healthy/warning/decayed thresholds read as improvement.
-        if baseline_mean > 0:
+        if baseline_mean > 0 and len(ic_values) >= len(baseline_ics) + len(rolling_ics):
             result["ic_ratio"] = round(rolling_mean / baseline_mean, 4)
 
         if len(rolling_ics) > 1:
```

**File**: `agent/tests/test_sdm_finite_metrics.py` (modified, +24/-0)
```diff
@@ -69,6 +69,30 @@ def test_ic_ratio_still_computed_for_a_positive_baseline():
     assert metrics["ic_ratio"] == pytest.approx(0.5)
 
 
+@pytest.mark.parametrize("n", [3, 4, 5, 6, 9])
+def test_ic_ratio_is_none_when_baseline_and_rolling_windows_overlap(n):
+    """With fewer than 10 entries, the oldest-5 and newest-5 windows share
+    observations -- at 3-9 entries they're the same data read twice, which
+    made ic_ratio exactly 1.0 no matter how much the IC actually moved. A
+    strategy whose IC just collapsed from 0.08 to 0.001 must not come back
+    reading as unchanged."""
+    history_newest_first = [BenchResult(ic_mean=0.001)] + [
+        BenchResult(ic_mean=0.08) for _ in range(n - 1)
+    ]
+
+    metrics = compute_decay_metrics(history_newest_first)
+
+    assert metrics["ic_ratio"] is None
+
+
+def test_ic_ratio_computed_once_windows_stop_overlapping():
+    history_newest_first = [BenchResult(ic_mean=v) for v in [0.001] + [0.08] * 9]
+
+    metrics = compute_decay_metrics(history_newest_first)
+
+    assert metrics["ic_ratio"] is not None
+
+
 @pytest.mark.parametrize("backend", ["memory", "sqlite"])
 @pytest.mark.parametrize("field", ["ic_mean", "sharpe"])
 @pytest.mark.parametrize("invalid", [math.nan, math.inf, -math.inf])
```

---

### Incident Patch 14: `d81b0ad9` (2026-10-04)
**Commit Message**: fix(loaders): redact a scheme's labelled credential and stop tests reaching the network

The health lane writes a loader's own warnings into the report that
.github/workflows/loader-health.yml uploads as an artifact, and
sanitize_evidence is the only thing between a loader's exception text and that
public artifact. Its bearer/basic arm stopped at the first non-space token, so
"Authorization: Bearer token: VALUE" redacted "Bearer token:" and left the
value behind. A scheme now owns the rest of the warning, which also covers a
second scheme ("Basic Authorization: Bearer VALUE") and quoted values; a
differential run over the 132 literal warning templates in
agent/backtest/loaders/* shows no change from main on any of them. The one
visible difference is that a warning beginning "Basic <word>" loses its
trailing words, the safe direction for a public artifact.

The tests in test_loader_health.py stub the real "tencent" source, but
registration fires on first use and assigns into LOADER_REGISTRY
unconditionally, so a stub installed before that first use is replaced by the
real loader. In a full-file run an earlier test registers first and the stubs
survive, which hid it: run alone, test_

**File**: `agent/backtest/loader_health.py` (modified, +3/-1)
```diff
@@ -67,7 +67,9 @@
 _CREDENTIAL_RE = re.compile(
     r"[\"']?\b[\w-]*(?:token|secret|password|passwd|api[-_]?key|private[-_]?key)[\w-]*[\"']?"
     r"\s*[=:]\s*(?:\"(?:\\.|[^\"])*(?:\"|$)|'(?:\\.|[^'])*(?:'|$)|\S+)"
-    r"|\b(?:bearer|basic)\s+\S+"
+    # A scheme owns the rest of the warning: its value may be labelled
+    # (``Bearer token: VALUE``), and stopping at the label left the value behind.
+    r"|\b(?:bearer|basic)\s+\S+(?:\s+\S+)*"
     r"|\b(?:gh[pousr]_|github_pat_|sk-|xox[baprs]-)[\w-]{8,}",
     re.IGNORECASE,
 )
```

**File**: `agent/tests/test_loader_health.py` (modified, +33/-0)
```diff
@@ -14,6 +14,20 @@
 TODAY = date(2026, 9, 28)
 
 
+@pytest.fixture(autouse=True)
+def _registered_loaders():
+    """Register the real loaders before a test stubs one of them.
+
+    Registration fires on first use and assigns into ``LOADER_REGISTRY``
+    unconditionally, so a stub installed for a real source before that first
+    use is silently replaced by the real loader and the test reaches the live
+    network instead of the stub.
+    """
+    from backtest.loaders.registry import _ensure_registered
+
+    _ensure_registered()
+
+
 def frame(age=0):
     return pd.DataFrame(
         {"open": [10.0], "high": [12.0], "low": [9.0], "close": [11.0], "volume": [100.0]},
@@ -292,6 +306,25 @@ def test_sanitizer_redacts_header_and_token_shaped_credentials():
     assert health.sanitize_evidence("token sk-abcdefghijklmnop rejected") == "token <redacted> rejected"
 
 
+@pytest.mark.parametrize(
+    "message,expected",
+    [
+        # The scheme arm used to stop at the label and leave its value in the
+        # report artifact CI uploads.
+        ("Authorization: Bearer token: S3CR3TVALUE", "Authorization: <redacted>"),
+        ("Bearer password: hunter2", "<redacted>"),
+    ],
+)
+def test_sanitizer_redacts_a_schemes_labelled_value(message, expected):
+    assert health.sanitize_evidence(message) == expected
+
+
+def test_sanitizer_does_not_strand_a_scheme_behind_a_keyword_label():
+    """A keyword chain must not hide the scheme's value from the scheme arm."""
+    cleaned = health.sanitize_evidence("password: token: Bearer S3CR3TVALUE")
+    assert cleaned is not None and "S3CR3TVALUE" not in cleaned
+
+
 def test_sanitizer_truncates_and_collapses_whitespace():
     assert len(health.sanitize_evidence("x" * 500)) == health.EVIDENCE_TEXT_LIMIT
     assert health.sanitize_evidence("two\n\tlines   here ") == "two lines here"
```

---

### Incident Patch 15: `41c3a406` (2026-10-04)
**Commit Message**: fix(memory): remove() resolves filename stem like find() does

PersistentMemory.remove() only matched on exact title, while find() (used
by the CLI's memory forget command) also falls back to filename stem --
documented in the forget argparse help as "Memory title or filename
stem". The remember tool's forget action calls remove() directly, so a
name that resolves fine through `memory forget` on the CLI could silently
come back "not found" through the agent tool for the same entry.

remove() now falls back to the same stem match as find() when no title
matches, before raising on an ambiguous multi-type title.

Signed-off-by: Lanre Shittu <[REDACTED_EMAIL]>

**File**: `agent/src/memory/persistent.py` (modified, +16/-3)
```diff
@@ -626,13 +626,18 @@ def add(
         return path
 
     def remove(self, name: str, memory_type: str | None = None) -> bool:
-        """Remove a memory entry by name.
+        """Remove a memory entry by title or filename stem.
 
         One title can exist under several memory types, each in its own file
         (``{memory_type}_{slug}.md``, #1525), so a bare title can be ambiguous.
 
+        Falls back to filename-stem resolution (matching ``find()``) when no
+        title matches, so a name that resolves via ``find()`` or the CLI's
+        ``memory forget`` command also resolves here instead of silently
+        reporting "not found" for the same entry.
+
         Args:
-            name: Title of the entry to remove.
+            name: Title or filename stem of the entry to remove.
             memory_type: The entry's type; needed only when the title exists
                 under more than one type.
 
@@ -645,11 +650,19 @@ def remove(self, name: str, memory_type: str | None = None) -> bool:
         """
         from src.config.accessor import get_env_config
 
+        entries = self._scan_entries()
         matches = [
             entry
-            for entry in self._scan_entries()
+            for entry in entries
             if entry.title == name and (memory_type is None or entry.memory_type == memory_type)
         ]
+        if not matches:
+            matches = [
+                entry
+                for entry in entries
+                if (entry.path.stem == name or entry.path.stem.endswith(f"_{name}"))
+                and (memory_type is None or entry.memory_type == memory_type)
+            ]
         if not matches:
             return False
         if len(matches) > 1:
```

**File**: `agent/tests/test_persistent_memory.py` (modified, +8/-0)
```diff
@@ -472,6 +472,14 @@ def test_remove_then_find(self, tmp_path: Path) -> None:
         results = pm.find_relevant("temporary")
         assert len(results) == 0
 
+    def test_remove_by_filename_stem(self, tmp_path: Path) -> None:
+        """remove() should resolve a filename stem the same way find() does,
+        not just an exact title match."""
+        pm = PersistentMemory(memory_dir=tmp_path)
+        pm.add("Q2 Planning", "roadmap notes", "project")
+        assert pm.remove("project_q2_planning") is True
+        assert pm.find("Q2 Planning") is None
+
 
 # ---------------------------------------------------------------------------
 # PersistentMemory.snapshot
```

#### Recent Merged Pull Requests:
- **PR #1706** (2026-10-05): fix(live): close the us_equity session at the early bell on half-days (@he-yufeng)
- **PR #1704** (2026-10-05): fix(live): keep the runner driver alive for the scheduler's lifetime (@Romzhou)
- **PR #1703** (2026-10-05): fix(flatten): make the kill-switch sweep fail-closed on its own bookkeeping and input (@Romzhou)
- **PR #1702** (2026-10-05): fix(grounding): hand the correction prompt the figures it should keep (@he-yufeng)
- **PR #1701** (2026-10-05): fix(api): raise the interactive message cap to match the scheduled-run path (@mminkus)
- **PR #1700** (2026-10-05): fix(quantlib): purge groups whose labels reach into the test block (@Shizoqua)
- **PR #1699** (2026-10-05): fix(sdm): stop treating overlapping IC windows as an unchanged ratio (@Shizoqua)
- **PR #1698** (2026-10-05): fix(loaders): keep a scheme's labelled credential out of the health report (@cgycorey)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
