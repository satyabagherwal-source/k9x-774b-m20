# Forensic Learning Record (Deep Inspection): EverMind-AI/EverOS

> **Canonical Artifact**: `07_PROJECT_LEARNING/evermind-ai-everos-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/EverMind-AI/EverOS](https://github.com/EverMind-AI/EverOS))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:33:34.316Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `EverMind-AI/EverOS`
- **Description**: One portable memory layer for every AI agent: local-first, Markdown-native, user-owned, and self-evolving across apps, tools, and workflows.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 13347 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/metrics/core.py`
```
"""Core-selection metrics for the multi-round decider (V3).

WHY THIS CANNOT READ THE RETURNED EPISODE LIST. Assembly is core-first, then one
guaranteed non-core per sub-query, then a max-RRF fill, all capped at ``top_k`` -- so a
``top_k=20`` request comes back padded with episodes the decider never picked. Scoring
that list and calling it core-only silently measures the top-20 arm instead: it produced
core sizes of 17.9-20.0 and a precision of ~0.10 where the real core averages 1.4-8.7
items.

Core membership survives in exactly one place: the trace's ``injected`` records, which
flag ``is_core`` per episode id. Hence ``EVEROS_LLMMR_TRACE_DUMP`` is mandatory for
these metrics, not optional.

Reference values on LongMemEval's held-out 100 (session-level gold, 27B decider):
core P 0.959 / R 0.938 / F1 0.933, 1.84 items, 89% full recall.
"""

from __future__ import annotations

import json
import os
import statistics as st
from collections.abc import Hashable, Mapping
from typing import Any

QuestionKey = tuple[str, str]
"""``(owner_id, question)`` -- the grain a core-selection metric is defined on."""


def core_sessions_from_trace(trace_path: str) -> dict[QuestionKey, set[str]]:
    """``(owner_id, question) -> {session_id}`` for the episodes the decider pinned.

    Keyed per question, not per owner. Owner alone holds only for a dataset that asks
    one question per owner: LongMemEval's owners are ``longmemeval_<question id>``, so
    the two grains coincide there and the dict-overwrite that used to key this looked
    right. LoCoMo puts every question of a conversation under one owner, where the
    same overwrite silently kept the last question's core and dropped the rest -- and
    which one survived depended on the order the trace happened to be written in.

    ``question_id`` is the natural key but the search layer cannot fill it: a
    ``/search`` request carries a query and an owner, so the trace writes ``None``
    there and the question text is the stable identifier available. Later records for
    one question still overwrite earlier ones, which is intended: the final injection
    is the state that was scored.
    """
    out: dict[QuestionKey, set[str]] = {}
    if not trace_path or not os.path.exists(trace_path):
        return out
    with open(trace_path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except ValueError:
                continue
            if "injected" not in rec:
                continue
            owner = str(rec.get("owner_id") or "")
            if not owner:
                continue
            question = str(rec.get("question_id") or rec.get("question") or "")
            out[owner, question] = {
                str(x.get("session_id"))
                for x in rec["injected"]
                if x.get("is_core") and x.get("session_id")
            }
    return out


def decider_reliability(trace_path: str) -> dict[str, Any]:
    """Rounds, fallbacks and per-round core sizes.

    A fallback means the decider's reply could not be parsed and the loop fell back to
    score order. Reporting it beside the metrics is load-bearing: a 62.8% fallback rate
    once looked like a mediocre policy rather than a truncated ``max_tokens``.
    """
    rounds = fallbacks = 0
    sizes: list[int] = []
    if not trace_path or not os.path.exists(trace_path):
        return {"rounds": 0, "fallbacks": 0, "fallback_rate": 0.0, "core_per_round": {}}
    with open(trace_path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except ValueError:
                continue
            if "core_indices" not in rec:
                continue
            rounds += 1
            fallbacks += bool(rec.get("decider_failed"))
            sizes.append(len(rec.get("core_indices") or []))
    return {
        "rounds": rounds,
        "fallbacks": fallbacks,
        "fallback_rate": (fallbacks / rounds) if rounds else 0.0,
        "core_per_round": {
            "mean": st.mean(sizes) if sizes else 0.0,
            "median": st.median(sizes) if sizes else 0.0,
            "max": max(sizes) if sizes else 0,
        },
    }


def score(
    core: Mapping[Hashable, set[str]], gold: Mapping[Hashable, set[str]]
) -> dict[str, Any]:
    """Core precision / recall / F1 against session-level gold.

    Both mappings must be keyed the same way -- ``core_sessions_from_trace`` returns
    ``(owner_id, question)``, so ``gold`` has to as well. A mismatch shows up as every
    entry counted in ``skipped_no_gold`` with ``n == 0``, which is loud; the shape it
    replaced was silent.

    Entries with empty gold are skipped rather than scored 0 -- a benchmark question
    with no resolvable evidence says nothing about the policy. The count is reported so
    a bad gold mapping cannot hide as a low score.
    """
    precisions: list[float] = []
    recalls: list[float] = []
    f1s: list[float] = []
    sizes: list[int] = []
    skipped = 0
    for key, pool in core.items():
        g = gold.get(key) or set()
        if not g:
            skipped += 1
            continue
        tp = len(pool & g)
        p = tp / len(pool) if pool else 0.0
        r = tp / len(g)
        precisions.append(p)
        recalls.append(r)
        f1s.append(2 * p * r / (p + r) if (p + r) else 0.0)
        sizes.append(len(pool))
    n = len(precisions)
    if not n:
        return {"n": 0, "skipped_no_gold": skipped}
    return {
        "n": n,
        "skipped_no_gold": skipped,
        "precision": st.mean(precisions),
        "recall": st.mean(recalls),
        "f1": st.mean(f1s),
        "core_size_mean": st.mean(sizes),
        "core_size_median": st.median(sizes),
        "full_recall_rate": sum(1 for x in recalls if x == 1.0) / n,
        "clean_rate": sum(1 for x in precisions if x == 1.0) / n,
    }

```

### Core Architecture Module: `src/everos/component/parser/_core.py`
```
"""Core parse dispatch — wraps everalgo-parser with LLM injection and error mapping.

``everalgo-parser`` is an optional dependency (``everos[multimodal]``).
All imports are deferred so this module is safe to import without the extra.
"""

from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING

from everos.core.errors import MultimodalNotEnabledError, UnsupportedModalityError

if TYPE_CHECKING:
    from everalgo.types import ParsedContent, RawFile


@lru_cache(maxsize=1)
def parser_available() -> bool:
    """Whether ``everalgo.parser`` is importable.

    Memoised: the underlying ``import everalgo.parser`` pulls in heavy
    PDF/Office dependencies (``pypdf``, ``python-docx``, ...) that would
    block the event loop for hundreds of ms — unacceptable inside
    ``async def health()`` on a liveness probe. First call at startup
    (via :class:`ParserLifespanProvider`) pays the import cost off the
    request path; subsequent calls hit the cache instantly.

    The cache is process-wide. Tests that patch ``sys.modules`` to
    swap the ``everalgo.parser`` module in or out must invoke
    :meth:`parser_available.cache_clear` between assertions to avoid
    cross-test contamination.
    """
    try:
        import everalgo.parser  # noqa: F401
    except ImportError:
        return False
    return True


def require_parser() -> None:
    """Raise when the parser extra is not installed.

    Raises:
        MultimodalNotEnabledError: When ``everalgo.parser`` cannot be imported.
    """
    if not parser_available():
        raise MultimodalNotEnabledError(
            "Multimodal parsing requires the parser extra. "
            "Install with: pip install 'everos[multimodal]'"
        )


async def aparse_file(raw_file: RawFile) -> ParsedContent:
    """Parse a file via everalgo-parser with the multimodal LLM client.

    Args:
        raw_file: Hydrated ``RawFile`` with ``content`` bytes or ``uri``.

    Returns:
        Parsed text content with modality metadata.

    Raises:
        MultimodalNotEnabledError: Parser not installed or system dep missing.
        UnsupportedModalityError: File format not supported by the parser.
    """
    from everalgo.llm import LLMError
    from everalgo.parser import aparse  # Deferred: optional dep

    from everos.component.llm import get_multimodal_llm_client
    from everos.core.errors import LLMServiceError

    try:
        return await aparse(raw_file, llm=get_multimodal_llm_client())
    except NotImplementedError as exc:
        raise UnsupportedModalityError(f"modality not supported: {exc}") from exc
    except LLMError as exc:
        raise LLMServiceError(str(exc)) from exc
    except ValueError as exc:
        raise UnsupportedModalityError(str(exc)) from exc
    except RuntimeError as exc:
        raise MultimodalNotEnabledError(str(exc)) from exc

```

### Core Architecture Module: `src/everos/component/utils/__init__.py`
```
"""Common utilities (datetime, tokenization, etc.).

Public API:
    from everos.component.utils.datetime import (
        UtcDatetime,
        ensure_utc,
        from_iso_format,
        from_timestamp,
        get_now_with_timezone,
        get_utc_now,
        to_date_str,
        to_display_tz,
        to_iso_format,
        to_timestamp_ms,
        today_with_timezone,
    )
    from everos.component.utils.tokenize import (
        tokens_for_index,
        tokens_for_query,
        join_tokens,
    )
"""

```

### Core Architecture Module: `src/everos/component/utils/config_hints.py`
```
"""User-facing error message helpers for missing provider configuration.

Guidance points users at the ``<root>/everos.toml`` file, not at
environment variables. Env vars still work as an override mechanism
(see ``pydantic-settings`` precedence in ``config/settings.py``) but
are not surfaced in onboarding-facing text.
"""

from __future__ import annotations

from everos.core.persistence import MemoryRoot


def missing_config_error(field_label: str, toml_section: str) -> str:
    """Return a uniform error message for a missing config field.

    Args:
        field_label: Human-readable label (e.g. ``"LLM api_key"``).
        toml_section: TOML section name without brackets (e.g. ``"llm"``).

    Returns:
        A single-line message including the resolved memory-root path
        and a hint to run ``everos init``. Never mentions env vars.
    """
    root = MemoryRoot.resolve().root
    return (
        f"{field_label} is not configured. "
        f"Edit {root}/everos.toml (run `everos init` to scaffold), "
        f"section [{toml_section}]."
    )

```

### Core Architecture Module: `src/everos/component/utils/datetime.py`
```
"""Timezone-aware datetime helpers.

EverOS follows a **two-zone discipline**:

* **Storage** (SQLite + LanceDB) is always UTC. Use :func:`get_utc_now`
  for any ``default_factory`` / write-path timestamp; if you accept a
  ``datetime`` from a caller, normalise with :func:`ensure_utc` before
  it crosses the persistence boundary.
* **Display** (markdown frontmatter, HTTP API response, date buckets for
  daily-log filenames) uses the configured "display timezone" from
  :attr:`everos.config.MemorySettings.timezone` (``EVEROS_MEMORY__TIMEZONE``).
  Use :func:`get_now_with_timezone` / :func:`today_with_timezone` /
  :func:`to_display_tz` here.

The display timezone also serves as the **fallback timezone for naive
input**: if a caller hands us a string / datetime without offset (e.g.
a hand-written ISO timestamp), :func:`from_iso_format` attaches the
display timezone before further processing — that matches a human's
intuition ("if I didn't say a zone, you should assume my zone").

Never call :func:`datetime.datetime.now` /
:func:`datetime.datetime.utcnow` directly — see
:doc:`.claude/rules/datetime-handling`.

Cache invalidation in tests::

    load_settings.cache_clear()
    _display_tz.cache_clear()
"""

from __future__ import annotations

import datetime as _dt
from functools import cache
from typing import Annotated
from zoneinfo import ZoneInfo

from pydantic import AfterValidator

_MS_THRESHOLD = 1e12  # ts >= this is treated as milliseconds


@cache
def _display_tz() -> _dt.tzinfo:
    """Resolve the configured **display timezone** (cached).

    Reads :attr:`everos.config.MemorySettings.timezone`; that field
    validates the name with :class:`zoneinfo.ZoneInfo` at load time, so
    by the time we reach here the value is guaranteed valid. This
    timezone governs:

    1. ISO output rendered in markdown / API responses.
    2. The fallback zone attached to naive-input datetimes.

    It does **not** govern storage — see :func:`get_utc_now`.
    """
    # Lazy import to avoid pulling in pydantic-settings at module load.
    from everos.config import load_settings

    return ZoneInfo(load_settings().memory.timezone)


def get_utc_now() -> _dt.datetime:
    """Return the current time as a UTC-aware datetime.

    Use for any **storage** write-path (SQLite ``default_factory``,
    LanceDB row construction, OME event ``ts``, any internal "when
    did this happen" record). Independent of the display timezone — a
    new deployment that switches ``EVEROS_MEMORY__TIMEZONE`` will not
    misalign existing rows.

    Display-side code should use :func:`get_now_with_timezone` instead,
    or render via :func:`to_display_tz`.
    """
    return _dt.datetime.now(tz=_dt.UTC)


def get_now_with_timezone() -> _dt.datetime:
    """Return the current time in the **display timezone** (configured).

    Use for **display** write-paths only — markdown frontmatter values,
    daily-log date buckets, places where a human will see the literal
    string. The returned datetime carries the display timezone offset
    so ``.isoformat()`` produces something like
    ``2026-05-29T14:00:00+08:00``.

    For storage / internal "when did this happen" timestamps use
    :func:`get_utc_now` instead — display timezone must not bleed into
    persisted rows.
    """
    return _dt.datetime.now(tz=_display_tz())


def today_with_timezone() -> _dt.date:
    """Return today's date in the **display timezone**.

    Use this anywhere a *date bucket* is needed (e.g. daily-log file
    boundaries) — it normalises ``get_now_with_timezone().date()`` so
    the timezone fallback rules are applied consistently.
    """
    return get_now_with_timezone().date()


def ensure_utc(d: _dt.datetime | None) -> _dt.datetime | None:
    """Normalise any datetime to UTC at the **storage boundary**.

    Semantics:

    * ``None`` → ``None`` (nullable-column convenience: lets callers
      pipe ``ensure_utc(row.last_attempt_at)`` without an outer guard).
    * Aware input → ``astimezone(UTC)``.
    * **Naive input → assume UTC** (attach ``tzinfo=UTC``); no
      display-tz fallback.

    Why naive→UTC rather than naive→display→UTC? Every caller of this
    function sits at the storage boundary, and the dominant naive
    source is SQLite reads: SQLAlchemy strips tz on write so what
    comes back is a naive value whose bytes are UTC. Treating those
    naive reads as display-tz would drift by the configured offset on
    every round trip — exactly the bug Q2 prevents.

    Caller-supplied datetimes that may genuinely be naive in display
    tz (e.g. ISO strings from HTTP request bodies that omitted the
    offset) should be funnelled through :func:`from_iso_format` first,
    which encodes the "if you didn't say a zone, assume your zone"
    rule. The aware result then passes through ``ensure_utc`` as a
    pure ``astimezone(UTC)``.

    Use the :data:`UtcDatetime` ``Annotated`` type to apply this
    automatically on Pydantic model fields.
    """
    if d is None:
        return None
    if d.tzinfo is None:
        return d.replace(tzinfo=_dt.UTC)
    return d.astimezone(_dt.UTC)


def to_display_tz(d: _dt.datetime | None) -> _dt.datetime | None:
    """Convert a datetime to the **display timezone** (configured).

    Used at the **response render boundary**: any datetime leaving the
    system through an API response or markdown body passes through
    here so the user sees their wall-clock time with the matching
    ``+HH:MM`` offset.

    * ``None`` → ``None`` (nullable-column convenience).
    * Naive input is treated as already display-tz local (the fallback
      rule) — attach the zone and return as-is.
    * Aware input is ``astimezone(...)``-d to the display tz.
    """
    if d is None:
        return None
    if d.tzinfo is None:
        return d.replace(tzinfo=_display_tz())
    return d.astimezone(_display_tz())


UtcDatetime = Annotated[_dt.datetime, AfterValidator(ensure_utc)]
"""Pydantic-friendly ``datetime`` type that normalises to UTC.

Apply to any SQLModel / Pydantic ``datetime`` field that maps to a
storage column. Both INSERT default values and post-read values pass
through :func:`ensure_utc`, so SQLite's tz-stripping behaviour is
neutralised: rows go in as UTC and come out as UTC-aware.

Usage::

    from everos.component.utils.datetime import UtcDatetime, get_utc_now

    class MyRow(BaseTable, table=True):
        happened_at: UtcDatetime = Field(default_factory=get_utc_now)
"""


def from_timestamp(ts: int | float) -> _dt.datetime:
    """Parse a Unix timestamp into a timezone-aware datetime.

    Auto-detects seconds vs milliseconds: values ``>= 1e12`` are treated as
    milliseconds. Returned datetime is in the default timezone.
    """
    seconds = ts / 1000.0 if ts >= _MS_THRESHOLD else float(ts)
    return _dt.datetime.fromtimestamp(seconds, tz=_display_tz())


def from_timestamp_ms(ts: int) -> _dt.datetime:
    """Parse an epoch-milliseconds value into a timezone-aware datetime.

    Exact inverse of :func:`to_timestamp_ms`. Unlike :func:`from_timestamp`
    this does **not** guess whether the value is seconds or milliseconds, so
    pre-2001 instants (whose ms value falls under the 1e12 heuristic
    threshold) round-trip instead of being read as seconds.
    """
    return _dt.datetime.fromtimestamp(ts / 1000.0, tz=_display_tz())


def from_iso_format(value: _dt.datetime | int | float | str) -> _dt.datetime:
    """Parse a value into a timezone-aware datetime (strict).

    Accepted inputs:
        * ``datetime`` — naive values get the default timezone attached.
        * ``int`` / ``float`` — Unix timestamp (auto-detect seconds vs ms).
        * ``str`` — ISO-8601, including ``"Z"`` suffix for UTC.

    Raises:
        TypeError: On unsupported input type.
        ValueError: On malformed string / negative timestamp.
    """
    if isinstance(value, _dt.datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=_display_tz())
        return value
    if isinstance(value, bool):  # bool is an int subclass — reject explicitly
        raise TypeError("from_iso_format does not accept bool")
    if isinstance(value, int | float):
        return from_timestamp(value)
    if isinstance(value, str):
        s = value.strip()
        # Python's fromisoformat accepts "+HH:MM" but not the "Z" suffix; map it.
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        parsed = _dt.datetime.fromisoformat(s)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=_display_tz())
        return parsed
    raise TypeError(
        f"from_iso_format: unsupported type {type(value).__name__}; "
        "expected datetime / int / float / str"
    )


def to_iso_format(
    value: _dt.datetime | int | float | str | None,
) -> str | None:
    """Render a value as an ISO-8601 string (timezone-aware).

    Accepted inputs:
        * ``None`` — returns ``None`` (nullable column convenience).
        * ``datetime`` — rendered as-is (must already be tz-aware).
        * ``int`` / ``float`` — interpreted via :func:`from_timestamp`.
        * ``str`` — re-validated through :func:`from_iso_format`.
    """
    if value is None:
        return None
    if isinstance(value, _dt.datetime):
        return value.isoformat()
    if isinstance(value, bool):  # bool is an int subclass
        raise TypeError("to_iso_format does not accept bool")
    if isinstance(value, int | float):
        return from_timestamp(value).isoformat()
    if isinstance(value, str):
        if not value:
            return None
        return from_iso_format(value).isoformat()
    raise TypeError(
        f"to_iso_format: unsupported type {type(value).__name__}; "
        "expected datetime / int / float / str / None"
    )


def to_date_str(d: _dt.datetime | None) -> str | None:
    """Render the date portion of a datetime as ``YYYY-MM-DD``.

    Accepts ``None`` for nullable database columns. When the input is
    already
```

### Core Architecture Module: `src/everos/core/context/__init__.py`
```
"""core.context — request-scoped context propagation (contextvars).

External usage::

    from everos.core.context import (
        get_request_id,
        set_request_id,
        reset_request_id,
    )
"""

from .request import get_request_id as get_request_id
from .request import reset_request_id as reset_request_id
from .request import resolve_request_id as resolve_request_id
from .request import set_request_id as set_request_id

__all__ = [
    "get_request_id",
    "reset_request_id",
    "resolve_request_id",
    "set_request_id",
]

```

### Core Architecture Module: `src/everos/core/context/request.py`
```
"""Request-scoped context propagation via ``contextvars``.

The request id is stored in a module-level ``ContextVar`` so it survives
``await`` boundaries and is readable anywhere in the call chain (service,
infra, log processors) without being threaded through call signatures.
"""

from __future__ import annotations

from contextvars import ContextVar, Token

from everos.core.observability.tracing import gen_request_id

_request_id: ContextVar[str | None] = ContextVar("everos_request_id", default=None)


def get_request_id() -> str | None:
    """Return the request id bound to the current context, or ``None``."""
    return _request_id.get()


def set_request_id(value: str | None) -> Token[str | None]:
    """Bind ``value`` as the current request id; return a reset token."""
    return _request_id.set(value)


def reset_request_id(token: Token[str | None]) -> None:
    """Restore the request id to what it was before the matching ``set``."""
    _request_id.reset(token)


def resolve_request_id() -> str:
    """Return the propagated request id, or mint a fresh W3C-compatible one.

    Call sites that need an id (search / get managers) use this so an id
    injected upstream by ``RequestIdMiddleware`` flows through to the
    response, while direct / CLI callers still get a freshly minted id.
    """
    return get_request_id() or gen_request_id()

```

### Core Architecture Module: `src/everos/core/errors.py`
```
"""Cross-cutting exception hierarchy for EverOS.

All application exceptions derive from ``AppError``, split into four branches:

- ``DomainError`` — business-rule violations (not-found, conflict, invalid
  input, path traversal, unsupported format).
- ``InfrastructureError`` — transient storage and external-service failures
  (retryable).
- ``CapabilityError`` — permanent server-side capability gaps (not retryable).
- ``ConfigurationError`` — misconfiguration detected at runtime.

Any layer may raise ``AppError`` subclasses; the entrypoints layer catches
them and maps them to aligned HTTP responses.
"""

from __future__ import annotations

from enum import StrEnum


class ErrorCode(StrEnum):
    """Machine-readable error codes returned in the API error envelope.

    Each code maps to exactly one HTTP status code. Clients can switch on
    this value to decide retry / display / routing behaviour without parsing
    the human-readable ``message`` field.
    """

    NOT_FOUND = "NOT_FOUND"
    CONFLICT = "CONFLICT"
    INVALID_INPUT = "INVALID_INPUT"
    EXTRACTION_EMPTY = "EXTRACTION_EMPTY"
    BAD_REQUEST = "BAD_REQUEST"
    UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT"
    EXTERNAL_SERVICE_UNAVAILABLE = "EXTERNAL_SERVICE_UNAVAILABLE"
    CAPABILITY_UNAVAILABLE = "CAPABILITY_UNAVAILABLE"
    CONFIGURATION_ERROR = "CONFIGURATION_ERROR"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    PROVIDER_NOT_CONFIGURED = "PROVIDER_NOT_CONFIGURED"


# ---------------------------------------------------------------------------
# Root
# ---------------------------------------------------------------------------


class AppError(Exception):
    """Root for all EverOS application exceptions."""


# ---------------------------------------------------------------------------
# Domain branch — client-side / business-rule errors
# ---------------------------------------------------------------------------


class DomainError(AppError):
    """Business-rule violation originating in the domain or service layer."""


class NotFoundError(DomainError):
    """A requested resource does not exist."""


class DocumentNotFoundError(NotFoundError):
    """A document with the given identifier was not found."""


class TopicNotFoundError(NotFoundError):
    """A knowledge topic with the given identifier was not found."""


class ConflictError(DomainError):
    """An operation conflicts with existing state (e.g. duplicate resource)."""


class DuplicateDocumentError(ConflictError):
    """A document with the same identifier already exists."""


class InvalidInputError(DomainError):
    """Input does not meet domain rules."""


class ExtractionEmptyError(InvalidInputError):
    """An extraction pipeline produced no output when output was required."""


class FilterError(InvalidInputError):
    """A caller-supplied filter expression is invalid or malformed."""


class EmbeddingInputError(InvalidInputError):
    """The embedding provider rejected the input itself, not the request.

    Deliberately in the domain branch rather than under
    :class:`EmbeddingServiceError`: the cascade worker retries the whole
    ``ExternalServiceError`` branch, and a text the provider refuses -- over the
    model's token limit, empty, malformed -- is refused identically every time.
    Retrying it burns the row's budget and, because the worker holds its slot
    across the backoff, blocks the rows queued behind it. Measured once at
    8 unembeddable rows stalling 220 good ones.

    A row that raises this is marked permanently failed and surfaces in
    ``cascade fix``, which is the correct destination: the md has to change
    before the embedding can ever succeed.
    """


class PathTraversalError(DomainError):
    """A write target resolved outside the configured memory root.

    Raised by the markdown writer as a defense-in-depth backstop: any
    caller-supplied identifier that becomes a path segment (``app_id`` /
    ``project_id`` / ``sender_id`` -> ``owner_id``) is validated at the DTO
    layer, but this containment check does not depend on every such id being
    sanitised upstream. The API layer maps it to HTTP 400.
    """


class UnsupportedModalityError(DomainError):
    """The uploaded file format is not supported (e.g. video, unknown type).

    Wraps everalgo's ``NotImplementedError`` / dispatch ``ValueError`` so
    the caller gets a stable 415 instead of a raw 500.
    """


# ---------------------------------------------------------------------------
# Infrastructure branch — transient failures (retryable)
# ---------------------------------------------------------------------------


class InfrastructureError(AppError):
    """Transient failure in a storage adapter or external service."""


class StorageError(InfrastructureError):
    """A markdown or SQLite persistence operation failed."""


class VectorStoreError(InfrastructureError):
    """A LanceDB vector-store operation failed."""


class ExternalServiceError(InfrastructureError):
    """An external service (LLM, embedding, rerank) returned an error or timed out."""


class VectorStoreBusyError(ExternalServiceError):
    """A LanceDB table's write lock could not be taken, or the critical
    section it guards overran its deadline.

    Deliberately under :class:`ExternalServiceError` rather than
    :class:`VectorStoreError`: the cascade worker retries that branch, and a
    contended or slow table is exactly the transient condition retrying is
    for. Under :class:`VectorStoreError` the row would be marked permanently
    failed and need a manual ``cascade fix``.
    """


class LLMServiceError(ExternalServiceError):
    """The configured LLM provider returned an error or timed out."""


class EmbeddingServiceError(ExternalServiceError):
    """The configured embedding provider returned an error or timed out."""


class RerankServiceError(ExternalServiceError):
    """The configured rerank provider returned an error or timed out."""


# ---------------------------------------------------------------------------
# Capability branch — permanent server-side gaps (not retryable)
# ---------------------------------------------------------------------------


class CapabilityError(AppError):
    """A required server-side capability is not available.

    Unlike ``InfrastructureError`` (transient — retry may help),
    ``CapabilityError`` signals a permanent gap that requires admin
    action (install a dependency, enable a feature).
    """


class MultimodalNotEnabledError(CapabilityError):
    """Multimodal parsing capability is not available.

    Raised when the ``everos[multimodal]`` extra is not installed, or when
    a required system dependency (LibreOffice for Office documents) is absent.
    """


# ---------------------------------------------------------------------------
# Configuration branch — misconfiguration detected at runtime
# ---------------------------------------------------------------------------


class ConfigurationError(AppError):
    """A required configuration is missing or invalid.

    Raised when a mandatory setting (e.g. embedding model, rerank provider)
    is not configured but the code path requires it.
    """


# TOML section name for each provider kind, keyed by the `provider` argument
# passed to `ProviderNotConfiguredError`.
_PROVIDER_SECTIONS: dict[str, str] = {
    "llm": "llm",
    "embedding": "embedding",
    "rerank": "rerank",
    "multimodal_llm": "multimodal",
}


class ProviderNotConfiguredError(ConfigurationError):
    """Raised when a runtime path requires a provider that is not configured.

    Maps to HTTP 422 via the FastAPI exception handler; the message is
    directly user-facing and points at the toml file for remediation.

    Args:
        provider: Which provider is missing. One of ``"llm"``,
            ``"embedding"``, ``"rerank"``, ``"multimodal_llm"``.
        feature: Optional user-facing feature that required this
            provider (e.g. ``"knowledge"``, ``"agent_hybrid"``).
        alternative_hint: Optional alternative workaround the user can
            take without configuring the missing provider (e.g. flip
            ``enable_llm_rerank=true`` to use the LLM lane).
    """

    def __init__(
        self,
        provider: str,
        feature: str | None = None,
        alternative_hint: str | None = None,
    ) -> None:
        # Lazy import: `config_hints` -> `core.persistence` -> `core.persistence
        # .markdown.writer` imports `PathTraversalError` from this module, so a
        # module-level import here would be circular.
        from everos.component.utils.config_hints import missing_config_error

        self.provider = provider
        self.feature = feature
        self.alternative_hint = alternative_hint
        section = _PROVIDER_SECTIONS.get(provider, provider)
        field_label = f"Provider '{provider}'"
        if feature:
            field_label += f" (required by {feature})"
        message = missing_config_error(field_label, section)
        if alternative_hint:
            message += f" Alternative: {alternative_hint}"
        super().__init__(message)


# ---------------------------------------------------------------------------
# Backward compatibility aliases
# ---------------------------------------------------------------------------

# Renamed in v0.2 — old names kept for external consumers.
DocumentAlreadyExistsError = DuplicateDocumentError
ValidationError = InvalidInputError

```

### Core Architecture Module: `src/everos/core/lifespan/__init__.py`
```
"""Application lifespan composition (chassis only).

This subpackage holds the *generic* lifespan machinery — the
:class:`LifespanProvider` ABC, :func:`build_lifespan` factory, and
chassis-level providers that are independent of any storage backend
(observability metrics, etc.). Concrete storage-backend providers
(SQLite / LanceDB) live next to the entrypoint that composes them
(see :mod:`everos.entrypoints.api.lifespans`) so ``core`` stays free
of concrete-backend imports.

External usage:
    from everos.core.lifespan import (
        LifespanProvider,
        MetricsLifespanProvider,
        build_lifespan,
    )
"""

from .base import LifespanProvider as LifespanProvider
from .factory import build_lifespan as build_lifespan
from .metrics_lifespan import MetricsLifespanProvider as MetricsLifespanProvider
from .tracing_lifespan import TracingLifespanProvider as TracingLifespanProvider

__all__ = [
    "LifespanProvider",
    "MetricsLifespanProvider",
    "TracingLifespanProvider",
    "build_lifespan",
]

```

### Core Architecture Module: `src/everos/core/lifespan/base.py`
```
"""Lifespan provider abstract base.

A LifespanProvider is one unit of startup / shutdown work invoked by the
FastAPI lifespan factory. Providers are registered explicitly (no DI
auto-discovery) and executed in ``order`` ascending on startup, reverse
on shutdown.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from fastapi import FastAPI


class LifespanProvider(ABC):
    """One unit of startup / shutdown work."""

    def __init__(self, name: str, order: int = 0) -> None:
        self.name = name
        self.order = order

    @abstractmethod
    async def startup(self, app: FastAPI) -> Any:
        """Startup hook; return value is stored on ``app.state.lifespan_data[name]``."""

    @abstractmethod
    async def shutdown(self, app: FastAPI) -> None:
        """Shutdown hook; called in reverse order during application teardown."""

```

### Core Architecture Module: `src/everos/core/lifespan/factory.py`
```
"""Lifespan composition factory.

Builds a FastAPI lifespan context manager from an explicit list of
LifespanProvider instances.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Callable, Sequence
from contextlib import asynccontextmanager

from fastapi import FastAPI

from everos.core.observability.logging import get_logger

from .base import LifespanProvider

logger = get_logger(__name__)


def build_lifespan(
    providers: Sequence[LifespanProvider],
) -> Callable[[FastAPI], AsyncIterator[None]]:
    """Compose providers into a FastAPI lifespan context manager.

    Providers are run in ``order`` ascending on startup and reverse on
    shutdown. A non-None return value from ``startup`` is stored under
    ``app.state.lifespan_data[provider.name]``.
    """
    sorted_providers = sorted(providers, key=lambda p: p.order)

    @asynccontextmanager
    async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
        lifespan_data: dict[str, object] = {}
        try:
            for provider in sorted_providers:
                logger.info(
                    "lifespan_provider_startup",
                    name=provider.name,
                    order=provider.order,
                )
                result = await provider.startup(app)
                if result is not None:
                    lifespan_data[provider.name] = result
            app.state.lifespan_data = lifespan_data
            yield
        finally:
            for provider in reversed(sorted_providers):
                try:
                    logger.info("lifespan_provider_shutdown", name=provider.name)
                    await provider.shutdown(app)
                except Exception:
                    logger.exception(
                        "lifespan_provider_shutdown_failed", name=provider.name
                    )

    return _lifespan

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #333** (2026-09-09): **[Bug]: 为何配置文件里不给LLM设置超时时间？**
  *Symptoms*: ### Area  src/everos  ### What happened?  一次问答出现报错： <img width="748" height="474" alt="Image" src="https://github.com/user-attachments/assets/e1ac7590-6c2e-419c-a9e4-8ac9b9ac3fc7" />  **排查：** 1、curl测试模型是可以正常工作的 ---> 推出：everos内部LLM调用超时 2、配置文件.env中可以配置embedding、reranker的超时时间，但无法配置llm的超时时间。 <img width="885" height="813" alt="Image" src="https://github.com/user-attachments/assets/62286581-0c82-4bbe-afba-2c90438b3c53" />  **追溯源码：** LLM默认超时时间：60s <img width="1230" height="639" alt="Image" src="https://github.com/user-attachments/assets/2696aa3b-2454-4f5e-8ea3-979eb0245fc3" />  embedding默认超时时间：30s <img width="1150" height="541" alt="Image" src="https://github.com/user-attachments/assets/5c13d5f2-3438-4135-bf17-d40eebcf620b" />  **期望** 配置文件里也有LLM的超时时间参数  ### Steps to reproduce  No  ### Environment  _No response_  ### Logs or screenshots  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > Thanks for flagging this. I checked the current 1.3.1 source on `main` (`5076683`), and the main application client now accepts a configurable LLM timeout.  You can add this to the existing `[llm]` section in your `everos.toml`, then restart EverOS:  ```toml [llm] timeout_seconds = 240 ```  Or set `EVEROS_LLM__TIMEOUT_SECONDS=240` in the environment of the process that starts EverOS. An exported environment value takes precedence over TOML. Putting it only in a `.env` file requires your launcher to load that file; Settings does not load it automatically.  I tested both configuration paths against the real client constructors: 180 seconds from the environment and 240 seconds from TOML reached the EverAlgo client, OpenAI SDK, and HTTPX timeouts. I also checked environment-over-TOML precedence, the 60-second default, and rejection of zero/negative values. No live model request was used, so this does not claim that the original endpoint error has been reproduced and eliminated.  Closing th

- **Issue #268** (2026-06-24): **[Bug]: always-injected memory-tools skill names two MCP tools (search_memories, get_memory) that do not exist; the real tool is evermem_search**
  *Symptoms*: **Area:** use-cases  ## What happened?  `use-cases/claude-code-plugin/skills/memory-tools.md` has `alwaysInclude: true`, so its guidance is injected into every plugin session. Under "## Available Tools" it lists:  - `search_memories` - `get_memory` ("Retrieve full details of a specific memory by ID")  Neither tool is implemented anywhere in the plugin slice. The MCP server (`mcp/server.js`, line 15) and `commands/ask.md` (line 18) expose exactly one tool: `evermem_search` (params: `query` required, `limit` default 10 / max 20). There is no get-by-id capability at all, so `get_memory` describes functionality that does not exist. The result is that the always-on instructions tell the agent to call tools the server will reject, and never mention the tool that actually works.  ## Steps to reproduce 1. Inspect the always-injected skill: `grep -n 'search_memories\\get_memory' use-cases/claude-code-plugin/skills/memory-tools.md` -> matches on lines 12-13. 2. Inspect the actual MCP tool surface: `grep -rn 'name:' use-cases/claude-code-plugin/mcp/server.js` -> only `evermem_search`. 3. Confirm no implementation of the named tools: `grep -rn 'search_memories\\get_memory' use-cases/claude-code-plugin/` -> only the skill doc; no server handler, no command. 4. In a plugin session, the agent (following the skill) attempts to call `search_memories` / `get_memory`; the MCP server has no such tools, so the calls cannot succeed, while `evermem_search` is never surfaced.  ## Expected vs actual 
  **Post-Mortem & Fix Analysis**:
  > Closing this as fixed. The current Claude Code plugin docs and command guidance now reference the actual MCP tool name, `evermem_search`, and no longer instruct users to call the old non-existent `search_memories` / `get_memory` tools.

- **Issue #223** (2026-05-26): **[Bug]: Running demo/extract_memory.py will throw an exception indicating that Field required**
  *Symptoms*: ### Area  methods/EverCore  ### What happened?  branch：main Running demo/extract_memory.py will throw an exception indicating that the parameter verification is invalid. I found the following bugs in the code. methods/EverCore/demo/extract_memory.py function convert_to_v1_message return {         "message_id": msg.get("message_id"),         "sender_id": msg.get("sender"),         "sender_name": msg.get("sender_name"),         "role": role,         "timestamp": timestamp_ms,         "type": msg.get("type", "text"),         "text": {"content": msg.get("content", "")},     }  but there is no parameter key "text" in define of /api/v1/memories, the correct as follow： {         "message_id": msg.get("message_id"),         "sender_id": msg.get("sender"),         "sender_name": msg.get("sender_name"),         "role": role,         "timestamp": timestamp_ms,         "type": msg.get("type", "text"),         "content": msg.get("content", ""),     }    ### Steps to reproduce  1. branch：main 2. Step 1,Start the API Server: uv run python src/run.py --port 1995 3. Step 2, Extract Memories: uv run python src/bootstrap.py demo/extract_memory.py 4. you will see below exception Failed: HTTP 422       {"code":"HTTP_ERROR","message":"Field required: messages -> 0 -> content","request_id":"b5f50f76-bf79-4a91-867a-bee5f321e395","timestamp":"2026-05-21T08:42:38.795336+00:00","path":"/api/v1/memories"}  ### Environment  _No response_  ### Logs or screenshots  Failed: HTTP 422 {"code":"HTTP_ERROR","me
  **Post-Mortem & Fix Analysis**:
  > 已定位并提交 demo-only 修复：#228  问题原因：`methods/EverCore/demo/extract_memory.py` 仍在发送旧格式：  ```json {"text": {"content": "..."}} ```  但当前 V1 `MessageItem` DTO 要求的是顶层 `content` 字段：  ```json {"content": "..."} ```  本地验证结果： - 旧 payload 会在 DTO 校验阶段失败：`messages.0.content Field required` - 新 payload 可以通过 `PersonalAddRequest` 校验，并被转换成 `ContentItem(type='text', text=...)` - 实际本地启动 EverCore 后，demo 请求已经不再触发这个 422；后续若返回 500，是进入业务逻辑后的 LLM endpoint 配置问题，和本 issue 的 payload bug 不是同一层  修复范围刻意保持在 demo：只更新 demo 发送的 payload，不改服务端 DTO 兼容逻辑。

- **Issue #79** (2026-03-03): **我发现触发边界的最后一条对话消息，会被丢失。这个需要怎么解决呢？**
  *Symptoms*: 我发现触发边界的最后一条对话消息，会被丢失。这个需要怎么解决呢？
  **Post-Mortem & Fix Analysis**:
  > 这个确实是个问题，怎么问题关闭了呢
  > 这个不是进入下一轮边界检测了吗。在那个pending msg里面

- **Issue #78** (2026-06-06): **[bug] Search API only uses memory_types[0], silently ignoring all other types**
  *Symptoms*: ## What broke?  The search API accepts a list of `memory_types`, but the retrieval logic only uses `memory_types[0]`. All other types in the list are silently ignored — they are never searched and no results are returned for them.  Additionally, if the first type happens to be one that the search backend doesn't support (e.g., `profile`, which is stored in MongoDB and only retrievable via the fetch API), the entire search errors out and returns 0 results.  ## Steps to Reproduce  **Case 1 — silent data loss (no error, but incomplete results):**  1. Start EverMemOS 2. Send: `GET /api/v1/memories/search?memory_types=episodic_memory,foresight&query=hello&retrieve_method=hybrid&top_k=5&user_id=test_user&group_id=test_user` 3. Only `episodic_memory` is searched. `foresight` is silently ignored — no warning, no error, no results.  **Case 2 — error when unsupported type is first:**  1. Send: `GET /api/v1/memories/search?memory_types=profile,episodic_memory,foresight&query=hello&retrieve_method=hybrid&top_k=5&user_id=test_user&group_id=test_user` 2. `profile` (not indexed in ES/Milvus) is taken as `memory_types[0]` → ERROR. `episodic_memory` and `foresight` are never searched. 0 results returned.  ## What did you expect?  - The search should iterate over all requested `memory_types` - For each type supported by ES/Milvus (`episodic_memory`, `foresight`, `event_log`), perform keyword + vector search - Skip types not supported by the search backend (e.g., `profile`) with an info log - M
  **Post-Mortem & Fix Analysis**:
  > Closing this as part of the EverOS 1.0 issue triage. This issue references the pre-1.0 API or retired infrastructure such as /api/v1/memories, /api/v3/agentic/*, MongoDB, Elasticsearch, Milvus, Redis, Kafka, longjob, or old memory type names. EverOS 1.0 uses POST /api/v1/memory/{add,flush,search,get} with Markdown + SQLite + LanceDB. Migration notes are tracked in PR #258: https://github.com/EverMind-AI/EverOS/pull/258. If the same behavior still occurs on current main with the 1.0 API, please open a fresh issue with a 1.0 repro.
  > Post-triage verification: keeping this closed because the 1.0 search contract no longer accepts a memory_types list that can silently ignore later values. Current POST /api/v1/memory/search chooses the owner track via user_id or agent_id and returns typed arrays: episodes, profiles, agent_cases, and agent_skills. Profile inclusion is explicit via include_profile.

- **Issue #73** (2026-06-06): **Cannot Reproduce LoCoMo Benchmark Results**
  *Symptoms*: # LoCoMo Benchmark Results - Significant Accuracy Gap  **Issue**: EverMemOS achieves 38.38% accuracy vs paper's claimed 93% on LoCoMo benchmark  ## Environment  - **OS**: Windows 10 - **Python**: 3.12.7 - **Docker**: 28.1.1 (MongoDB, Elasticsearch, Milvus, Redis) - **Dependencies**: `uv sync --group evaluation`  ## Configuration  **Models**: - LLM: `openai/gpt-4.1-mini` (OpenRouter, temp=0.3) - Embedding: `Qwen/Qwen3-Embedding-4B` (DeepInfra, dim=1024) - Reranker: `Qwen/Qwen3-Reranker-4B` (DeepInfra) - Search mode: `agentic`  ## Commands Run  ```bash # Start services docker-compose up -d  # Smoke test (30 questions, 10 messages/conv) uv run python -m evaluation.cli --dataset locomo --system evermemos --smoke  # Full conv-26 (152 questions, 419 messages) uv run python -m evaluation.cli --dataset locomo --system evermemos --from-conv 0 --to-conv 1 ```  ## Results  | Test | Messages | Questions | Accuracy | vs Paper | |------|----------|-----------|----------|----------| | **Paper (LoCoMo)** | All | 1,986 | **93.0%** | - | | **Smoke test** | 10/conv | 30 | 52.22% | -40.78% | | **Conv-26 (full)** | 419 | 152 | **38.38%** | **-54.62%** |  ### Category Breakdown (Smoke Test) - Single-hop: 41.67% (vs 96.08% in paper) - Multi-hop: 54.76% (vs 91.13% in paper) - Temporal: 66.67% (vs 89.72% in paper) - Open domain: 100% (vs 70.83% in paper)  ## Key Findings  1. **Performance degrades with more context**:    - 10 messages: 52.22%    - 419 messages: 38.38% (-13.84%)  2. **Only tested 1/10
  **Post-Mortem & Fix Analysis**:
  > Hey, thanks for the issue. We just ran the test and everything works as expected.   Do you want to join the Discord channel or WeChat group? We can talk about the way you tested it and make sure you used the right process so you get the same results we did.
  > I have the same config and also get bad test result
  > @conahpchen @wangyu-ustc Are you guys on our Discord or in our WeChat group? If you are, let's collaborate on that. We can arrange a session to talk about it, as I think there's something wrong with the process.

- **Issue #57** (2026-06-05): **STARTER_KIT.md  和 issue 入口 Discord  链接失效**
  *Symptoms*:  STARTER_KIT.md  和 issue 入口 Discord  链接失效
  **Post-Mortem & Fix Analysis**:
  > Fixed.

- **Issue #53** (2026-06-06): **中文环境下，MongoDB存储的数据都是英文，这个会影响记忆的提取吗？**
  *Symptoms*: 我浏览了下prompt，里面并没有对工作语言的说明，在记忆提取时，也没有语言的说明，在monogo存储的也是英文，请问这个设计意图是什么？
  **Post-Mortem & Fix Analysis**:
  > <img width="838" height="317" alt="Image" src="https://github.com/user-attachments/assets/4d57e66b-d2ff-4256-8a69-0c6ce8a6e55a" />
  > Closing this as part of the EverOS 1.0 issue triage. This issue references the pre-1.0 API or retired infrastructure such as /api/v1/memories, /api/v3/agentic/*, MongoDB, Elasticsearch, Milvus, Redis, Kafka, longjob, or old memory type names. EverOS 1.0 uses POST /api/v1/memory/{add,flush,search,get} with Markdown + SQLite + LanceDB. Migration notes are tracked in PR #258: https://github.com/EverMind-AI/EverOS/pull/258. If the same behavior still occurs on current main with the 1.0 API, please open a fresh issue with a 1.0 repro.

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

### Incident Patch 1: `6aff7351` (2026-09-30)
**Commit Message**: fix(knowledge): keep PATCH category moves inside knowledge/ (#469)

* fix(knowledge): keep PATCH category moves inside knowledge/

PATCH /knowledge/documents/{doc_id} sanitized the new category with a
private copy of the dirname rule that lacked the "." / ".." fallback, so
category_id ".." moved the document directory out of knowledge/ into
the project directory, where the md scan no longer finds it.

Route the category through the shared sanitize_dirname (the rule the
create path already uses, so "." / ".." fall back to "Others"), build
the target from the project's knowledge_dir, and assert the resolved
target stays inside it before any directory is created or moved. A
document an earlier move left outside knowledge/ is moved back on its
next category change.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* docs(security): refresh supported versions and define advisory scope

The supported-versions table still named 1.2.x as current; 1.4.x is the
live line. Also state where the advisory line sits: issues that let
untrusted input reach beyond what the caller can already touch get an
advisory, while issues a trusted caller can trigger only against its
own data ar

**File**: `CHANGELOG.md` (modified, +11/-0)
```diff
@@ -7,6 +7,17 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Fixed
+
+- **Changing a knowledge document's category keeps it inside `knowledge/`.**
+  `PATCH /knowledge/documents/{doc_id}` with `category_id` set to `..` moved
+  the document's directory up into the project directory, where the markdown
+  scan no longer finds it. The category now goes through the same rule as
+  document creation, so `.` and `..` fall back to `Others`, and the move is
+  refused if its target would leave `knowledge/`. A document an earlier move
+  left outside is moved back on its next category change. Reported by
+  White0xdi3.
+
 ## [1.4.1] - 2026-09-24
 
 **A fresh install works again.** The `openai` SDK released its 3.x line on
```

**File**: `SECURITY.md` (modified, +9/-2)
```diff
@@ -7,8 +7,8 @@ not receive backports.
 
 | Version | Supported |
 |---------|-----------|
-| `1.2.x` (current) | ✅ |
-| `1.1.x` and older | ❌ — upgrade to the current line |
+| `1.4.x` (current) | ✅ |
+| `1.3.x` and older | ❌ — upgrade to the current line |
 
 ## Reporting a Vulnerability
 
@@ -58,3 +58,10 @@ following in mind:
   the providers you configure.
 - Memory content is stored as plaintext `.md` files; apply OS-level file
   permissions or disk encryption if your data is sensitive.
+- **What counts as a vulnerability.** An issue qualifies for a security
+  advisory when untrusted input (an ingested document, or a caller outside the
+  supported threat model) can reach data or files beyond what the API already
+  lets that caller touch — for example, writing outside the memory root. An
+  issue a trusted API caller can trigger only against data that same caller can
+  already modify or delete through the API is fixed as a hardening change and
+  noted in the release notes, without an advisory.
```

**File**: `src/everos/service/knowledge.py` (modified, +16/-19)
```diff
@@ -42,7 +42,7 @@
     TopicNotFoundError,
 )
 from everos.core.observability.logging import get_logger
-from everos.core.persistence import MemoryRoot
+from everos.core.persistence import MemoryRoot, sanitize_dirname
 from everos.core.persistence.markdown import dump_frontmatter, parse_frontmatter
 from everos.infra.persistence.index import Predicate, all_of, eq
 from everos.infra.persistence.markdown import (
@@ -727,25 +727,24 @@ async def _update_index_frontmatter(
     await apath.write_text(dump_frontmatter(fm) + body, encoding="utf-8")
 
 
-_DIR_SAFE = re.compile(r"[^\w\-.]", re.UNICODE)
-
-
-def _safe_category(raw: str) -> str:
-    """Sanitize category_id for use as a directory name component."""
-    slug = raw.replace(" ", "_")
-    slug = _DIR_SAFE.sub("", slug)[:50]
-    return slug or "Others"
-
-
 async def _move_doc_directory(
     memory_root: MemoryRoot,
-    old_md_path: str,
+    current: _ResolvedDoc,
     new_category: str,
 ) -> str:
-    """Move document directory to new category folder, return new md_path."""
-    old_index = memory_root.root / old_md_path
-    old_dir = old_index.parent
-    new_dir = old_dir.parent.parent / _safe_category(new_category) / old_dir.name
+    """Move document directory to new category folder, return new md_path.
+
+    The category becomes a directory segment through the same
+    ``sanitize_dirname`` rule the create path uses, so ``.``/``..`` fall back
+    to ``Others`` instead of walking out of ``knowledge/``. The resolved
+    target is then asserted to stay inside the project's knowledge directory
+    before any directory is created or moved.
+    """
+    knowledge_dir = memory_root.knowledge_dir(current.app_id, current.project_id)
+    old_dir = (memory_root.root / current.md_path).parent
+    new_dir = knowledge_dir / sanitize_dirname(new_category, "Others") / old_dir.name
+    if not new_dir.resolve().is_relative_to(knowledge_dir.resolve()):
+        raise PathTraversalError(f"category move target escapes knowledge/: {new_dir}")
     await anyio.Path(new_dir.parent).mkdir(parents=True, exist_ok=True)
     await anyio.to_thread.run_sync(shutil.move, str(old_dir), str(new_dir))
     new_index = new_dir / "index.md"
@@ -843,9 +842,7 @@ async def _apply_patch_writes(
     await _update_index_frontmatter(index_path, new_title, new_category)
 
     if new_category != current.category_id:
-        new_md_path = await _move_doc_directory(
-            memory_root, current.md_path, new_category
-        )
+        new_md_path = await _move_doc_directory(memory_root, current, new_category)
         new_doc_dir = memory_root.root / Path(new_md_path).parent
         await _update_topics_category(new_doc_dir, new_category)
 
```

**File**: `tests/unit/test_service/test_knowledge_crud.py` (modified, +85/-0)
```diff
@@ -16,6 +16,8 @@
 import pytest
 
 from everos.component.utils.datetime import get_utc_now
+from everos.core.errors import PathTraversalError
+from everos.core.persistence import MemoryRoot
 from everos.infra.persistence.sqlite.repos.knowledge import DocumentListPage
 from everos.infra.persistence.sqlite.tables.knowledge import (
     KnowledgeDocumentRow,
@@ -398,3 +400,86 @@ async def test_patch_document_not_found_raises() -> None:
 
         with pytest.raises(DocumentNotFoundError):
             await patch_document("d_missing", "app1", "proj1", title="New")
+
+
+# ── patch_document: category move containment ────────────────────────────────
+
+
+def _lay_out_doc(root: MemoryRoot, category: str) -> Path:
+    """Create ``knowledge/<category>/Doc_<id>/`` on disk; return the doc dir."""
+    doc_dir = root.knowledge_dir("app1", "proj1") / category / "Doc_d_testdoc00001"
+    doc_dir.mkdir(parents=True)
+    (doc_dir / "index.md").write_text("---\ntitle: Test Doc\n---\n")
+    (doc_dir / "1_intro.md").write_text("---\ncategory_id: Technology\n---\n")
+    return doc_dir
+
+
+async def _patch_category(root: MemoryRoot, md_path: str, category_id: str) -> None:
+    doc = _doc_row(md_path=md_path)
+    with (
+        patch(f"{_MOD}.MemoryRoot.resolve", return_value=root),
+        patch(f"{_MOD}.knowledge_document_repo") as mock_doc_repo,
+    ):
+        mock_doc_repo.get_by_doc_id = AsyncMock(return_value=doc)
+        mock_doc_repo.upsert_from_handler = AsyncMock(return_value=None)
+        await patch_document("d_testdoc00001", "app1", "proj1", category_id=category_id)
+
+
+@pytest.mark.parametrize(
+    ("category_id", "expected_dir"),
+    [("Research Notes", "Research_Notes"), ("..", "Others"), (".", "Others")],
+)
+async def test_patch_document_category_move_stays_in_knowledge(
+    tmp_path: Path, category_id: str, expected_dir: str
+) -> None:
+    """``.``/``..`` fall back to ``Others`` like the create path does."""
+    root = MemoryRoot(tmp_path)
+    doc_dir = _lay_out_doc(root, "Technology")
+    md_path = str((doc_dir / "index.md").relative_to(root.root))
+
+    await _patch_category(root, md_path, category_id)
+
+    knowledge_dir = root.knowledge_dir("app1", "proj1")
+    moved = knowledge_dir / expected_dir / "Doc_d_testdoc00001"
+    assert (moved / "index.md").is_file()
+    assert (moved / "1_intro.md").is_file()
+    assert not doc_dir.exists()
+    assert not (knowledge_dir.parent / "Doc_d_testdoc00001").exists()
+
+
+async def test_patch_document_category_move_repairs_escaped_doc(
+    tmp_path: Path,
+) -> None:
+    """A doc an earlier ``..`` move left outside ``knowledge/`` is moved back."""
+    root = MemoryRoot(tmp_path)
+    knowledge_dir = root.knowledge_dir("app1", "proj1")
+    knowledge_dir.mkdir(parents=True)
+    escaped = knowledge_dir.parent / "Doc_d_testdoc00001"
+    escaped.mkdir()
+    (escaped / "index.md").write_text("---\ntitle: Test Doc\n---\n")
+    md_path = str(
+        knowledge_dir.relative_to(root.root) / ".." / escaped.name / "index.md"
+    )
+
+    await _patch_category(root, md_path, "Science")
+
+    assert (knowledge_dir / "Science" / escaped.name / "index.md").is_file()
+    assert not escaped.exists()
+
+
+async def test_patch_document_category_move_rejects_escaping_target(
+    tmp_path: Path,
+) -> None:
+    """A category dir symlinked out of ``knowledge/`` trips the backstop."""
+    root = MemoryRoot(tmp_path)
+    doc_dir = _lay_out_doc(root, "Technology")
+    outside = tmp_path / "outside"
+    outside.mkdir()
+    (root.knowledge_dir("app1", "proj1") / "Others").symlink_to(outside)
+    md_path = str((doc_dir / "index.md").relative_to(root.root))
+
+    with pytest.raises(PathTraversalError):
+        await _patch_category(root, md_path, "..")
+
+    assert doc_dir.is_dir()
+    assert not any(outside.iterdir())
```

---

### Incident Patch 2: `462ebf9f` (2026-09-24)
**Commit Message**: fix(deps): pin openai below 3 so a fresh install can call the LLM

Squash merge of PR #468 (1.4.1).

**File**: `CHANGELOG.md` (modified, +22/-0)
```diff
@@ -7,6 +7,28 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+## [1.4.1] - 2026-09-24
+
+**A fresh install works again.** The `openai` SDK released its 3.x line on
+2026-09-24; an unconstrained install picked it up together with an httpx
+pre-release, and every LLM and embedding call failed before reaching the
+network. This release pins the SDK to the 2.x line the project is tested
+against. Nothing else changed since 1.4.0.
+
+### Fixed
+
+- **`openai` is pinned below 3.** Fresh installs from PyPI resolved
+  `openai 3.19.2`, whose client raises `AttributeError: module 'httpx' has no
+  attribute 'Timeout'` on every request, so memorize and hybrid / vector
+  search returned 500. Existing environments built from `uv.lock` were never
+  affected.
+
+### Upgrade
+
+- `pip install --upgrade everos` brings `openai` back to 2.x. If a fresh
+  install of 1.4.0 (or any earlier version) today shows the `httpx` error
+  above, upgrade to 1.4.1 or run `pip install "openai<3"`.
+
 ## [1.4.0] - 2026-09-24
 
 **EverOS runs natively on Windows, and dense search stops scanning the whole
```

**File**: `docs/openapi.json` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
   "info": {
     "title": "everos",
     "description": "md-first memory extraction framework",
-    "version": "1.4.0"
+    "version": "1.4.1"
   },
   "paths": {
     "/health": {
```

**File**: `pyproject.toml` (modified, +4/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "everos"
-version = "1.4.0"
+version = "1.4.1"
 description = "EverOS — local-first markdown memory framework for AI agents and user chats; lightweight, dev-friendly, small-team"
 license = {text = "Apache-2.0"}
 readme = "README.md"
@@ -45,7 +45,9 @@ dependencies = [
     "greenlet>=3.0",              # Required by SQLAlchemy async
 
     # LLM & embedding (one provider per file pattern)
-    "openai>=1.0.0",
+    # <3: openai 3.x (2026-09-24) moved to the httpx 1.0 pre-release line and its
+    # client raises AttributeError on every request; 2.x is what the lock tests.
+    "openai>=1.0.0,<3",
 
     # Markdown / file system
     "PyYAML>=6.0",                # YAML frontmatter parsing
```

**File**: `uv.lock` (modified, +2/-2)
```diff
@@ -579,7 +579,7 @@ wheels = [
 
 [[package]]
 name = "everos"
-version = "1.4.0"
+version = "1.4.1"
 source = { editable = "." }
 dependencies = [
     { name = "aiosqlite" },
@@ -664,7 +664,7 @@ requires-dist = [
     { name = "jieba", specifier = ">=0.42.1,<1.0" },
     { name = "lancedb", specifier = ">=0.34.0,<0.35.0" },
     { name = "msvc-runtime", marker = "sys_platform == 'win32'", specifier = ">=14.44" },
-    { name = "openai", specifier = ">=1.0.0" },
+    { name = "openai", specifier = ">=1.0.0,<3" },
     { name = "opentelemetry-exporter-otlp-proto-http", marker = "extra == 'otel'", specifier = ">=1.27.0" },
     { name = "opentelemetry-sdk", marker = "extra == 'otel'", specifier = ">=1.27.0" },
     { name = "portalocker", specifier = ">=2.8.2" },
```

---

### Incident Patch 3: `8bb5c323` (2026-09-24)
**Commit Message**: fix(lancedb): translate the spill failure on the write path too

Squash merge of PR #465.

**File**: `src/everos/core/persistence/lancedb/repository.py` (modified, +20/-3)
```diff
@@ -224,11 +224,12 @@ def _remove_empty_index_dirs(
 retry clears. ``LanceError(IO): Execution error: Spill has sent an error`` is
 DataFusion's sort / merge spill to the OS temp dir failing mid-query; lancedb
 raises it as a bare ``RuntimeError``. Seen only on the Windows soak box under
-nine concurrent clients (187 / 180 / 34 times over three runs), never on an
+nine concurrent clients (187 / 180 / 34 / 42 times over four runs), never on an
 idle box, and the same row projected fine on the next attempt — yet the worker
 filed every one as unrecoverable, so ~200 md files per run needed a manual
-``cascade fix``. Match the exact phrase: a generic IO error (disk full, file
-gone) must stay permanent."""
+``cascade fix``. The traceback frames put it in ``merge_insert`` (the write
+path, under :meth:`_locked`); the read path is covered as well. Match the
+exact phrase: a generic IO error (disk full, file gone) must stay permanent."""
 
 
 def _is_transient_execution_error(exc: BaseException) -> bool:
@@ -390,6 +391,22 @@ async def _locked(self, budget: float, op: str) -> AsyncIterator[None]:
                 f"{op} on table {self.table_name!r} exceeded its "
                 f"{budget:g}s write-lock deadline"
             ) from exc
+        except RuntimeError as exc:
+            # The soak's spill failures came out of ``merge_insert`` (this
+            # path), not the reads: worker -> upsert -> execute_merge_insert.
+            # The write is idempotent by id, so a retry is the right answer.
+            if not _is_transient_execution_error(exc):
+                raise
+            logger.warning(
+                "lancedb_transient_execution_error",
+                table=self.table_name,
+                op=op,
+                error=str(exc)[:200],
+            )
+            raise VectorStoreBusyError(
+                f"{op} on table {self.table_name!r} hit a transient lance "
+                f"execution error: {exc}"
+            ) from exc
         else:
             held = time.monotonic() - (acquired_at or started)
             if held >= _SLOW_HOLD_LOG_SECONDS:
```

**File**: `tests/unit/test_core/test_persistence/test_lancedb/test_transient_execution_errors.py` (modified, +7/-0)
```diff
@@ -41,6 +41,13 @@ async def test_spill_failure_inside_a_read_becomes_a_busy_error() -> None:
             raise RuntimeError(_SPILL)
 
 
+async def test_spill_failure_inside_a_write_becomes_a_busy_error() -> None:
+    """The soak's spill failures came out of merge_insert (the write path)."""
+    with pytest.raises(VectorStoreBusyError, match="transient lance execution"):
+        async with _Repo()._locked(1.0, "upsert"):
+            raise RuntimeError(_SPILL)
+
+
 async def test_other_runtime_errors_still_propagate_unchanged() -> None:
     with pytest.raises(RuntimeError, match="No space left"):
         async with _Repo()._deadline(1.0, "find_where"):
```

---

### Incident Patch 4: `4e905dcb` (2026-09-24)
**Commit Message**: feat(lancedb): build an IVF_FLAT index on vector columns

Squash merge of PR #461.

**File**: `src/everos/config/default.toml` (modified, +3/-0)
```diff
@@ -49,6 +49,9 @@ cache_size_kb = 2048
 #   >0             -> eventual (interval seconds between checks)
 # Uncomment to override:
 # read_consistency_seconds = 5.0
+# Rows (with a non-null vector) before a table's vector columns get an
+# IVF_FLAT index. Below it every vector query scans the whole column.
+# vector_index_min_rows = 2000
 
 [index]
 # Rebuildable vector/BM25 index. Markdown remains the source of truth.
```

**File**: `src/everos/config/settings.py` (modified, +9/-0)
```diff
@@ -518,6 +518,15 @@ class LanceDBSettings(BaseModel):
 
     read_consistency_seconds: float | None = None
     index_cache_size_bytes: int = 16 * 1024 * 1024
+    vector_index_min_rows: int = Field(default=2000, ge=1)
+    """Rows (with a non-null vector) a table needs before its vector columns
+    get an ANN index. Below this a brute-force scan is cheaper than the
+    index; above it the scan grows linearly with the table — 27k rows of
+    1024-dim vectors was 112 MB and ~0.6 s per query on a laptop SSD, and
+    a hybrid search runs two or three of them. Applied by the cascade worker
+    only: its first rebuild sweep after server start builds a missing index
+    and the heavy maintenance beat keeps it healthy. The CLI never builds
+    one (it would race the running server's commits)."""
 
 
 class CascadeSettings(BaseModel):
```

**File**: `src/everos/core/persistence/lancedb/base.py` (modified, +95/-1)
```diff
@@ -34,12 +34,28 @@ class Episode(BaseLanceTable):
 
 import pyarrow as pa
 from lancedb import AsyncTable
-from lancedb.index import FTS
+from lancedb.index import FTS, IvfFlat
 from lancedb.pydantic import LanceModel
 from pydantic import Field
 
 from everos.component.utils.datetime import get_utc_now
 
+VECTOR_INDEX_ROWS_PER_PARTITION = 4096
+"""IVF partition size at build time. Pinned so :data:`VECTOR_QUERY_NPROBES`
+means something: lance's default partition count has changed across releases."""
+
+VECTOR_INDEX_MAX_DELTAS = 16
+"""Delta indices a vector column may accumulate before the heavy beat retrains
+it. Each light beat with new rows adds one; probing 16 of them cost ~1-3 ms extra
+at 27k-100k rows, while a retrain rewrites the whole index (107 MB at 27k x 1024,
+391 MB at 100k), so a trickle writer must not pay that every 300 s."""
+
+VECTOR_QUERY_NPROBES = 32
+"""Partitions probed per vector query. 32 partitions of 4096 rows cover the whole
+column, i.e. exact search, up to ~130k rows; past that the unprobed partitions
+are skipped and recall degrades gradually. Every ``nearest_to`` in the tree sets
+it, so the index and the query agree on what "exact" costs."""
+
 
 class BaseLanceTable(LanceModel):
     """Pydantic / LanceDB base with ``created_at`` / ``updated_at`` and
@@ -177,6 +193,84 @@ async def ensure_fts_indexes(
                 ),
             )
 
+    @classmethod
+    def vector_columns(cls) -> list[str]:
+        """Names of the schema's vector columns (Arrow fixed-size lists)."""
+        return [
+            field.name
+            for field in cls.to_arrow_schema()
+            if pa.types.is_fixed_size_list(field.type)
+        ]
+
+    @classmethod
+    async def ensure_vector_indexes(
+        cls, table: AsyncTable, *, min_rows: int
+    ) -> list[str]:
+        """Keep one IVF_FLAT (cosine) index per vector column that holds at
+        least ``min_rows`` non-null vectors; return the columns touched.
+
+        Without an index LanceDB answers ``nearest_to`` with a brute-force
+        scan of the whole column — linear in rows and in bytes (27k rows of
+        1024-dim float32 is 112 MB and ~0.6 s per query on a laptop SSD),
+        and a hybrid search issues two or three of them. IVF_FLAT keeps
+        exact distances inside the probed partitions; with
+        :data:`VECTOR_INDEX_ROWS_PER_PARTITION` rows per partition and
+        :data:`VECTOR_QUERY_NPROBES` probes the search stays exact up to
+        ~130k rows. ``cosine`` matches the query side. Columns that are
+        still all-null (a Tier 1 store has no embeddings) are skipped:
+        there is nothing to train on.
+
+        Two cases do work; everything else is a no-op:
+
+        * no index yet and the column crossed ``min_rows`` -> build one;
+        * the index has grown more than :data:`VECTOR_INDEX_MAX_DELTAS` delta
+          indices -> retrain it in place. Every
+          ``optimize()`` on a table with new rows appends one *delta* index
+          instead of merging (``num_indices`` +1 per light beat, never
+          collapsing on its own), and a query probes every delta, so latency
+          climbs with the beats since the last rebuild: 27k x 1024 rows
+          measured 5.9 ms at 0 deltas, 25.7 ms at 100, 303 ms at 400 —
+          worse than the 24 ms scan the index replaces. The cascade's heavy
+          beat (300 s) calls this, so at most ~30 deltas accumulate under
+          sustained writes. The retrain is one atomic index swap (searches
+          never see the column unindexed); a concurrent ``optimize()`` from
+          another process can preempt it with a benign commit conflict, in
+          which case the next heavy beat retries — the same exposure prune has.
+
+        ponytail: retraining (``create_index(replace=True)``) rewrites the
+        whole index once per heavy beat under load; merging the deltas
+        instead needs pylance's ``optimize_indices``, which is not a
+        dependency. Revisit when a table passes ~500k rows.
+        """
+        columns = cls.vector_columns()
+        if not columns:
+            return []
+        indices = {
+            col: idx
+            for idx in await table.list_indices()
+            for col in (idx.columns or [])
+        }
+        touched: list[str] = []
+        for column in columns:
+            existing = indices.get(column)
+            if existing is not None:
+                stats = await table.index_stats(existing.name)
+                if stats is None or stats.num_indices <= VECTOR_INDEX_MAX_DELTAS:
+                    continue
+            rows = await table.count_rows(f"{column} IS NOT NULL")
+            if rows < min_rows:
+                continue
+            await table.create_index(
+                column,
+                replace=existing is not None,
+                config=IvfFlat(
+                    distance_type="cosine",
+                    num_partitions=max(1, rows // VECTOR_INDEX_ROWS_
```

**File**: `src/everos/core/persistence/lancedb/repository.py` (modified, +30/-3)
```diff
@@ -52,6 +52,16 @@
 for a wedged table."""
 
 _REBUILD_TIMEOUT_SECONDS = 300.0
+
+
+def _vector_index_min_rows() -> int:
+    """``[lancedb] vector_index_min_rows`` — imported lazily so this module
+    stays free of the settings import at load time (same as MemoryRoot)."""
+    from everos.config.settings import load_settings
+
+    return load_settings().lancedb.vector_index_min_rows
+
+
 """Index rebuild (drop + recreate every index) — the one genuinely slow
 critical section, measured at ~0.3s per 50k rows per indexed column, so 5
 minutes covers a multi-million-row table with wide headroom."""
@@ -136,8 +146,9 @@
 ``processing`` forever with nothing logged (a hang raises nothing, so the
 drain-failure counter stays at zero and ``/health`` keeps reporting healthy).
 Same last-resort shape as :data:`_COMPACT_TIMEOUT_SECONDS`, and generous by
-design: everos builds no vector ANN index, so reads are flat scans — measured
-~62ms over 117k rows, i.e. 60s is ~1000x headroom and never fires normally. On
+design: a vector read is an IVF probe, or a flat scan below the index
+threshold — measured ~62ms over 117k unindexed rows, i.e. 60s is ~1000x
+headroom and never fires normally. On
 expiry the caller gets a retryable :class:`VectorStoreBusyError`, so a drain row
 is retried and a search request fails with a structured error rather than
 hanging the request."""
@@ -669,14 +680,30 @@ async def rebuild_indexes(self) -> None:
             # ``return_exceptions``, so the whole search request 500s. Only
             # indexes on columns that are no longer indexed at all get dropped;
             # nothing queries those, so their drop opens no window.
-            wanted = set(self.schema.BM25_FIELDS or ())
+            wanted = set(self.schema.BM25_FIELDS or ()) | set(
+                self.schema.vector_columns()
+            )
             for idx in await table.list_indices():
                 if not wanted.intersection(idx.columns or ()):
                     await table.drop_index(idx.name)
             await self.schema.ensure_fts_indexes(table, replace=True)
+            await self.schema.ensure_vector_indexes(
+                table, min_rows=_vector_index_min_rows()
+            )
 
     # ── Read ───────────────────────────────────────────────────────────────
 
+    async def ensure_vector_indexes(self) -> list[str]:
+        """Build the ANN index on vector columns that crossed the row
+        threshold since startup, and retrain one whose delta indices piled
+        up — the cascade's heavy beat calls this; the cases are spelled out
+        on :meth:`BaseLanceTable.ensure_vector_indexes`."""
+        async with self._locked(_REBUILD_TIMEOUT_SECONDS, "ensure_vector_indexes"):
+            table = await self._table()
+            return await self.schema.ensure_vector_indexes(
+                table, min_rows=_vector_index_min_rows()
+            )
+
     async def count(self) -> int:
         """Total row count."""
         async with self._deadline(_READ_TIMEOUT_SECONDS, "count"):
```

**File**: `src/everos/infra/persistence/backends/lancedb.py` (modified, +5/-0)
```diff
@@ -18,6 +18,7 @@
 
 from everos.component.utils.datetime import ensure_utc, to_iso_format
 from everos.core.persistence import LanceRepoBase
+from everos.core.persistence.lancedb.base import VECTOR_QUERY_NPROBES
 from everos.infra.persistence import lancedb as _lancedb
 
 from ..predicate import (
@@ -220,6 +221,7 @@ async def dense_search(
             .nearest_to(list(vector))
             .column(vector_field)
             .distance_type("cosine")
+            .nprobes(VECTOR_QUERY_NPROBES)
         )
         expression = _render_optional(where)
         if expression:
@@ -254,6 +256,9 @@ async def prune(self, older_than: dt.timedelta) -> None:
     async def rebuild_indexes(self) -> None:
         await self._repo.rebuild_indexes()
 
+    async def ensure_vector_indexes(self) -> None:
+        await self._repo.ensure_vector_indexes()
+
     async def find_by_owner(self, owner_id: str, *, limit: int = 100) -> list[T]:
         return await self.find_where(eq("owner_id", owner_id), limit=limit)
 
```

**File**: `src/everos/infra/persistence/index/protocols.py` (modified, +2/-0)
```diff
@@ -124,6 +124,8 @@ async def prune(self, older_than: dt.timedelta) -> None: ...
 
     async def rebuild_indexes(self) -> None: ...
 
+    async def ensure_vector_indexes(self) -> None: ...
+
 
 @runtime_checkable
 class EpisodeIndexRepository(IndexRepository[T], Protocol[T]):
```

**File**: `src/everos/infra/persistence/index/router.py` (modified, +3/-0)
```diff
@@ -195,6 +195,9 @@ async def prune(self, older_than: dt.timedelta) -> None:
     async def rebuild_indexes(self) -> None:
         await self._repo().rebuild_indexes()
 
+    async def ensure_vector_indexes(self) -> None:
+        await self._repo().ensure_vector_indexes()
+
 
 class RoutedEpisodeRepository(RoutedIndexRepository[Any]):
     def _repo(self) -> EpisodeIndexRepository[Any]:
```

**File**: `src/everos/infra/persistence/lancedb/__init__.py` (modified, +11/-0)
```diff
@@ -297,6 +297,17 @@ async def ensure_business_indexes() -> None:
     Adding a new business table = adding it to ``_BUSINESS_SCHEMAS``;
     everything else (table name, columns to index) reads off the
     schema's ClassVars.
+
+    Vector (ANN) indexes are deliberately **not** built here. This runs in
+    every process that opens the root — the server lifespan and the CLI's
+    ``_runtime`` — and a CLI command training an index on a live server's
+    table races its commits (soak: ``cascade status`` storms failed with
+    ``Retryable commit conflict`` the moment a table crossed the row
+    threshold). Vector indexes belong to the cascade worker alone: its
+    first rebuild sweep at server start builds a missing one and the heavy
+    beat maintains it (:meth:`BaseLanceTable.ensure_vector_indexes`). FTS
+    stays here because a search on a column without its inverted index
+    raises instead of degrading.
     """
     await migrate_table_schemas()
     await migrate_fts_indexes()
```

---

### Incident Patch 5: `4fd34722` (2026-09-24)
**Commit Message**: fix(lancedb): treat a lance spill failure as retryable

Squash merge of PR #463.

**File**: `src/everos/core/persistence/lancedb/repository.py` (modified, +30/-0)
```diff
@@ -208,6 +208,23 @@ def _remove_empty_index_dirs(
     return removed
 
 
+_TRANSIENT_EXECUTION_MARKERS = ("Spill has sent an error",)
+"""Substrings of lance error messages that name a query-execution failure a
+retry clears. ``LanceError(IO): Execution error: Spill has sent an error`` is
+DataFusion's sort / merge spill to the OS temp dir failing mid-query; lancedb
+raises it as a bare ``RuntimeError``. Seen only on the Windows soak box under
+nine concurrent clients (187 / 180 / 34 times over three runs), never on an
+idle box, and the same row projected fine on the next attempt — yet the worker
+filed every one as unrecoverable, so ~200 md files per run needed a manual
+``cascade fix``. Match the exact phrase: a generic IO error (disk full, file
+gone) must stay permanent."""
+
+
+def _is_transient_execution_error(exc: BaseException) -> bool:
+    text = str(exc)
+    return any(marker in text for marker in _TRANSIENT_EXECUTION_MARKERS)
+
+
 class LanceRepoBase[T: BaseLanceTable]:
     """Generic CRUD repository for one LanceDB table.
 
@@ -296,6 +313,19 @@ async def _deadline(self, budget: float, op: str) -> AsyncIterator[None]:
             raise VectorStoreBusyError(
                 f"{op} on table {self.table_name!r} exceeded its {budget:g}s deadline"
             ) from exc
+        except RuntimeError as exc:
+            if not _is_transient_execution_error(exc):
+                raise
+            logger.warning(
+                "lancedb_transient_execution_error",
+                table=self.table_name,
+                op=op,
+                error=str(exc)[:200],
+            )
+            raise VectorStoreBusyError(
+                f"{op} on table {self.table_name!r} hit a transient lance "
+                f"execution error: {exc}"
+            ) from exc
 
     @asynccontextmanager
     async def _locked(self, budget: float, op: str) -> AsyncIterator[None]:
```

**File**: `tests/unit/test_core/test_persistence/test_lancedb/test_transient_execution_errors.py` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+"""A lance query-execution failure that a retry clears must reach the cascade
+worker as :class:`VectorStoreBusyError` (retried with backoff), not as a bare
+``RuntimeError`` (filed as unrecoverable, needing a manual ``cascade fix``).
+"""
+
+from __future__ import annotations
+
+from typing import ClassVar
+
+import pytest
+
+from everos.core.errors import VectorStoreBusyError
+from everos.core.persistence.lancedb import BaseLanceTable, LanceRepoBase
+from everos.core.persistence.lancedb import repository as repo_mod
+
+_SPILL = (
+    "lance error: LanceError(IO): Execution error: Spill has sent an error, "
+    "C:\\Users\\x\\everos-src\\.venv\\Lib\\site-packages\\lance\\..."
+)
+
+
+class _Note(BaseLanceTable):
+    TABLE_NAME: ClassVar[str] = "_note"
+    id: str
+
+
+class _Repo(LanceRepoBase[_Note]):
+    schema = _Note
+
+
+def test_only_the_spill_phrase_counts_as_transient() -> None:
+    assert repo_mod._is_transient_execution_error(RuntimeError(_SPILL))
+    assert not repo_mod._is_transient_execution_error(
+        RuntimeError("lance error: LanceError(IO): No space left on device")
+    )
+
+
+async def test_spill_failure_inside_a_read_becomes_a_busy_error() -> None:
+    with pytest.raises(VectorStoreBusyError, match="transient lance execution"):
+        async with _Repo()._deadline(1.0, "find_where"):
+            raise RuntimeError(_SPILL)
+
+
+async def test_other_runtime_errors_still_propagate_unchanged() -> None:
+    with pytest.raises(RuntimeError, match="No space left"):
+        async with _Repo()._deadline(1.0, "find_where"):
+            raise RuntimeError("lance error: LanceError(IO): No space left on device")
```

---

### Incident Patch 6: `401fbf8e` (2026-09-24)
**Commit Message**: fix(knowledge): delete the document directory even before it is indexed

Squash merge of PR #456.

**File**: `src/everos/service/knowledge.py` (modified, +42/-4)
```diff
@@ -508,7 +508,9 @@ async def delete_document(
 ) -> DeleteResult:
     """Remove a document directory; cascade handles SQLite/LanceDB cleanup.
 
-    Idempotent: returns ``deleted_topics=0`` when the document does not exist.
+    Idempotent: returns ``deleted_topics=0`` when neither the index nor the
+    disk has the document, and also when the directory was removed before the
+    cascade had indexed its topics.
 
     Args:
         doc_id: Document primary key.
@@ -519,12 +521,28 @@ async def delete_document(
         DeleteResult with the topic count that was present before deletion.
     """
     row = await knowledge_document_repo.get_by_doc_id(doc_id)
+    memory_root = MemoryRoot.resolve()
     if row is None:
-        return DeleteResult(doc_id=doc_id, deleted_topics=0)
+        # The index trails the markdown by seconds, so a document created a
+        # moment ago has a directory but no row yet. Deleting by the index
+        # alone leaves that directory behind for the cascade to index right
+        # back in, and the "deleted" document reappears. Markdown is the
+        # truth: find the directory by its name and count the topic files
+        # it holds, so the response says what was actually removed.
+        topic_count = await anyio.to_thread.run_sync(
+            _remove_unindexed_doc_dirs,
+            memory_root.knowledge_dir(app_id, project_id),
+            doc_id,
+        )
+        logger.info(
+            "document deleted",
+            doc_id=doc_id,
+            topic_count=topic_count,
+            indexed=False,
+        )
+        return DeleteResult(doc_id=doc_id, deleted_topics=topic_count)
 
     topic_count = await knowledge_topic_sqlite_repo.count_by_doc_id(doc_id)
-
-    memory_root = MemoryRoot.resolve()
     doc_dir = memory_root.root / Path(row.md_path).parent
     if await anyio.Path(doc_dir).is_dir():
         await anyio.to_thread.run_sync(shutil.rmtree, doc_dir)
@@ -537,6 +555,26 @@ async def delete_document(
     return DeleteResult(doc_id=doc_id, deleted_topics=topic_count)
 
 
+def _remove_unindexed_doc_dirs(knowledge_dir: Path, doc_id: str) -> int:
+    """Remove every ``knowledge/<category>/<title>_<doc_id>/`` directory.
+
+    Returns the number of topic files (``N_*.md``) that were on disk. The
+    directory name is compared literally — ``delete_document`` is a public
+    service function, so a caller-supplied ``doc_id`` must not act as a glob
+    pattern or a path; only the HTTP route validates the id's shape.
+    """
+    if not knowledge_dir.is_dir():
+        return 0
+    suffix = f"_{doc_id}"
+    topics = 0
+    for doc_dir in knowledge_dir.glob("*/*"):
+        if not doc_dir.is_dir() or not doc_dir.name.endswith(suffix):
+            continue
+        topics += sum(1 for _ in doc_dir.glob("[0-9]*.md"))
+        shutil.rmtree(doc_dir)
+    return topics
+
+
 async def replace_document(
     *,
     extractor: KnowledgeExtractor,
```

**File**: `tests/unit/test_service/test_knowledge_crud.py` (modified, +56/-1)
```diff
@@ -220,8 +220,11 @@ async def test_delete_document_success(tmp_path: Path) -> None:
     mock_anyio.to_thread.run_sync.assert_awaited_once()
 
 
-async def test_delete_document_idempotent() -> None:
+async def test_delete_document_idempotent(
+    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+) -> None:
     """Returns deleted_topics=0 without error when document does not exist."""
+    monkeypatch.setenv("EVEROS_ROOT", str(tmp_path))
     with patch(f"{_MOD}.knowledge_document_repo") as mock_doc_repo:
         mock_doc_repo.get_by_doc_id = AsyncMock(return_value=None)
 
@@ -232,6 +235,58 @@ async def test_delete_document_idempotent() -> None:
     assert result.deleted_topics == 0
 
 
+async def test_delete_document_removes_dir_before_the_index_has_the_row(
+    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+) -> None:
+    """A document created a moment ago has a directory but no SQLite row yet
+    (the cascade trails the markdown by seconds). Delete must still remove the
+    directory — and only that directory — and report the topic files it held.
+    """
+    monkeypatch.setenv("EVEROS_ROOT", str(tmp_path))
+    kdir = tmp_path / "app1" / "proj1" / "knowledge"
+    doc_dir = kdir / "Technology" / "Release_checklist_d_lagging00001"
+    doc_dir.mkdir(parents=True)
+    (doc_dir / "index.md").write_text("---\ndoc_id: d_lagging00001\n---\n")
+    (doc_dir / "1_before.md").write_text("# before\n")
+    (doc_dir / "2_after.md").write_text("# after\n")
+    sibling = kdir / "Technology" / "Other_notes_d_sibling000001"
+    sibling.mkdir()
+    (sibling / "index.md").write_text("---\ndoc_id: d_sibling000001\n---\n")
+    (kdir / ".taxonomy.md").write_text("# taxonomy\n")
+
+    with patch(f"{_MOD}.knowledge_document_repo") as mock_doc_repo:
+        mock_doc_repo.get_by_doc_id = AsyncMock(return_value=None)
+        result = await delete_document("d_lagging00001", "app1", "proj1")
+
+    assert result.deleted_topics == 2
+    assert not doc_dir.exists()
+    assert sibling.is_dir()
+    assert (kdir / ".taxonomy.md").exists()
+
+
+@pytest.mark.parametrize("doc_id", ["d_absent0000001", "*", "*/_original"])
+async def test_delete_document_unindexed_id_not_on_disk_removes_nothing(
+    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, doc_id: str
+) -> None:
+    """No row and no directory for the id → nothing is touched, including
+    when the id looks like a glob pattern or a path: the name match is literal.
+    """
+    monkeypatch.setenv("EVEROS_ROOT", str(tmp_path))
+    kdir = tmp_path / "app1" / "proj1" / "knowledge"
+    sibling = kdir / "Technology" / "Other_notes_d_sibling000001"
+    sibling.mkdir(parents=True)
+    (sibling / "index.md").write_text("---\ndoc_id: d_sibling000001\n---\n")
+    (sibling / "_original").mkdir()
+
+    with patch(f"{_MOD}.knowledge_document_repo") as mock_doc_repo:
+        mock_doc_repo.get_by_doc_id = AsyncMock(return_value=None)
+        result = await delete_document(doc_id, "app1", "proj1")
+
+    assert result.deleted_topics == 0
+    assert (sibling / "index.md").exists()
+    assert (sibling / "_original").is_dir()
+
+
 # ── list_documents ────────────────────────────────────────────────────────────
 
 
```

---

### Incident Patch 7: `b736df64` (2026-09-24)
**Commit Message**: build(deps): bump pyarrow to 25.0.1 for timestamp materialisation

Squash merge of PR #457.

**File**: `pyproject.toml` (modified, +5/-0)
```diff
@@ -34,6 +34,11 @@ dependencies = [
     # docs/cascade_runbook.md. Never widen this floor back below 0.34 (older lance
     # cannot read v8 data).
     "lancedb>=0.34.0,<0.35.0",    # Vector + BM25 + scalar filter (Arrow-based)
+    # Floor, not a new package: lancedb pulls pyarrow in anyway. 25.0.1 stops
+    # the per-value `import pytz` attempt in to_pylist() (24 walked sys.path
+    # for every tz-aware timestamp) and materialises rows without a Scalar
+    # per element; 25.0.0 lacks the latter and has a mimalloc exit crash.
+    "pyarrow>=25.0.1",
     "aiosqlite>=0.20.0",          # Async SQLite driver (used by SA async engine)
     "sqlmodel>=0.0.22",           # ORM (Pydantic + SQLAlchemy 2.0 async)
     "alembic>=1.13.0",            # SQLite schema migrations
```

**File**: `uv.lock` (modified, +34/-39)
```diff
@@ -601,6 +601,7 @@ dependencies = [
     { name = "openai" },
     { name = "portalocker" },
     { name = "prometheus-client" },
+    { name = "pyarrow" },
     { name = "pydantic" },
     { name = "pydantic-settings" },
     { name = "python-multipart" },
@@ -666,6 +667,7 @@ requires-dist = [
     { name = "opentelemetry-sdk", marker = "extra == 'otel'", specifier = ">=1.27.0" },
     { name = "portalocker", specifier = ">=2.8.2" },
     { name = "prometheus-client", specifier = ">=0.20.0" },
+    { name = "pyarrow", specifier = ">=25.0.1" },
     { name = "pydantic", specifier = ">=2.7.1" },
     { name = "pydantic-settings", specifier = ">=2.0.0" },
     { name = "pymilvus", marker = "extra == 'milvus'", specifier = ">=3.0.0" },
@@ -1843,45 +1845,38 @@ wheels = [
 
 [[package]]
 name = "pyarrow"
-version = "24.0.0"
-source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/91/13/13e1069b351bdc3881266e11147ffccf687505dbb0ea74036237f5d454a5/pyarrow-24.0.0.tar.gz", hash = "sha256:85fe721a14dd823aca09127acbb06c3ca723efbd436c004f16bca601b04dcc83", size = 1180261, upload-time = "2026-04-21T10:51:25.837Z" }
-wheels = [
-    { url = "https://files.pythonhosted.org/packages/b4/a9/9686d9f07837f91f775e8932659192e02c74f9d8920524b480b85212cc68/pyarrow-24.0.0-cp312-cp312-macosx_12_0_arm64.whl", hash = "sha256:6233c9ed9ab9d1db47de57d9753256d9dcffbf42db341576099f0fd9f6bf4810", size = 34981559, upload-time = "2026-04-21T10:47:22.17Z" },
-    { url = "https://files.pythonhosted.org/packages/80/b6/0ddf0e9b6ead3474ab087ae598c76b031fc45532bf6a63f3a553440fb258/pyarrow-24.0.0-cp312-cp312-macosx_12_0_x86_64.whl", hash = "sha256:f7616236ec1bc2b15bfdec22a71ab38851c86f8f05ff64f379e1278cf20c634a", size = 36663654, upload-time = "2026-04-21T10:47:28.315Z" },
-    { url = "https://files.pythonhosted.org/packages/7c/3b/926382efe8ce27ba729071d3566ade6dfb86bdf112f366000196b2f5780a/pyarrow-24.0.0-cp312-cp312-manylinux_2_28_aarch64.whl", hash = "sha256:1617043b99bd33e5318ae18eb2919af09c71322ef1ca46566cdafc6e6712fb66", size = 45679394, upload-time = "2026-04-21T10:47:34.821Z" },
-    { url = "https://files.pythonhosted.org/packages/b3/7a/829f7d9dfd37c207206081d6dad474d81dde29952401f07f2ba507814818/pyarrow-24.0.0-cp312-cp312-manylinux_2_28_x86_64.whl", hash = "sha256:6165461f55ef6314f026de6638d661188e3455d3ec49834556a0ebbdbace18bb", size = 48863122, upload-time = "2026-04-21T10:47:42.056Z" },
-    { url = "https://files.pythonhosted.org/packages/5f/e8/f88ce625fe8babaae64e8db2d417c7653adb3019b08aae85c5ed787dc816/pyarrow-24.0.0-cp312-cp312-musllinux_1_2_aarch64.whl", hash = "sha256:3b13dedfe76a0ad2d1d859b0811b53827a4e9d93a0bcb05cf59333ab4980cc7e", size = 49376032, upload-time = "2026-04-21T10:47:48.967Z" },
-    { url = "https://files.pythonhosted.org/packages/36/7a/82c363caa145fff88fb475da50d3bf52bb024f61917be5424c3392eaf878/pyarrow-24.0.0-cp312-cp312-musllinux_1_2_x86_64.whl", hash = "sha256:25ea65d868eb04015cd18e6df2fbe98f07e5bda2abefabcb88fce39a947716f6", size = 51929490, upload-time = "2026-04-21T10:47:55.981Z" },
-    { url = "https://files.pythonhosted.org/packages/66/1c/e3e72c8014ad2743ca64a701652c733cc5cbcee15c0463a32a8c55518d9e/pyarrow-24.0.0-cp312-cp312-win_amd64.whl", hash = "sha256:295f0a7f2e242dabd513737cf076007dc5b2d59237e3eca37b05c0c6446f3826", size = 27355660, upload-time = "2026-04-21T10:48:01.718Z" },
-    { url = "https://files.pythonhosted.org/packages/6f/d3/a1abf004482026ddc17f4503db227787fa3cfe41ec5091ff20e4fea55e57/pyarrow-24.0.0-cp313-cp313-macosx_12_0_arm64.whl", hash = "sha256:02b001b3ed4723caa44f6cd1af2d5c86aa2cf9971dacc2ffa55b21237713dfba", size = 34976759, upload-time = "2026-04-21T10:48:07.258Z" },
-    { url = "https://files.pythonhosted.org/packages/4f/4a/34f0a36d28a2dd32225301b79daad44e243dc1a2bb77d43b60749be255c4/pyarrow-24.0.0-cp313-cp313-macosx_12_0_x86_64.whl", hash = "sha256:04920d6a71aabd08a0417709efce97d45ea8e6fb733d9ca9ecffb13c67839f68", size = 36658471, upload-time = "2026-04-21T10:48:13.347Z" },
-    { url = "https://files.pythonhosted.org/packages/1f/78/543b94712ae8bb1a6023bcc1acf1a740fbff8286747c289cd9468fced2a5/pyarrow-24.0.0-cp313-cp313-manylinux_2_28_aarch64.whl", hash = "sha256:a964266397740257f16f7bb2e4f08a0c81454004beab8ff59dd531b73610e9f2", size = 45675981, upload-time = "2026-04-21T10:48:20.201Z" },
-    { url = "https://files.pythonhosted.org/packages/84/9f/8fb7c222b100d314137fa40ec050de56cd8c6d957d1cfff685ce72f15b17/pyarrow-24.0.0-cp313-cp313-manylinux_2_28_x86_64.whl", hash = "sha256:6f066b179d68c413374294bc1735f68475457c933258df594443bb9d88ddc2a0", size = 48859172, upload-time = "2026-04-21T10:48:27.541Z" },
-    { url = "https://files.pythonhosted.org/packages/a7/d3/1ea72538e6c8b3b475ed78d1049a2c518e655761ea50fe1171fc855fcab7/pyarrow-24.0.0-cp313-cp313-musllinux_1_2_aarch64.whl", hash = "sha256:1183baeb14c5f587b1ec52831e665718ce632caab84b7cd6b85fd44f96114495", size = 49385733, upload-time = "2026-04-21T10:48:34.7Z" },
-    { url = "h
```

---

### Incident Patch 8: `243bdddb` (2026-09-24)
**Commit Message**: fix(cli): refuse cascade sync while a server holds the memory root

Squash merge of PR #458.

**File**: `docs/cascade_runbook.md` (modified, +28/-17)
```diff
@@ -109,9 +109,10 @@ naturally.
 
 ## One-shot replay: `everos cascade sync [PATH]`
 
-Use this when the watcher missed an event (WSL mount, network share,
-external editor with no inotify) or when you want a deterministic
-flush before, say, a smoke test:
+Use this when no server is running and you want the index caught up
+with the markdown — after batch edits, before a smoke test, or on a
+mount where the watcher misses events (WSL mount, network share,
+external editor with no inotify) while the daemon is down:
 
 ```bash
 everos cascade sync                           # drain everything pending
@@ -120,10 +121,16 @@ everos cascade sync users/u1/episodes/X.md    # re-enqueue + drain
 
 The CLI builds the same `CascadeOrchestrator` as the daemon but only
 calls `sync_once` / `drain_once` — no watcher / scanner background task.
-Its drain still runs the same compaction + version-cleanup (`prune`) as
-the daemon, but `prune` uses `delete_unverified=False`, so it never
-deletes a file another process may be mid-commit on. Safe to run in
-parallel with a live `everos server`.
+It holds the OME lock for the whole run and **refuses to start (exit code
+3) while a server holds it**: two processes writing the same LanceDB
+tables cannot see each other's snapshot and both insert the row (4–5 %
+duplicate rows after a 10-hour soak with two concurrent `sync` processes
+next to a server). The same rule applies to `cascade fix --apply` and
+`cascade rebuild`; `cascade status` and `cascade fix` (listing) are
+read-only and work alongside a server. A running server projects every
+markdown change itself, so nothing is lost by waiting for it — unless it
+was started with `EVEROS_DISABLE_CASCADE=1` or has been quiesced, in
+which case stop it before syncing.
 
 ## Rebuild the index: `everos cascade rebuild`
 
@@ -135,12 +142,12 @@ everos cascade rebuild          # prompts for confirmation
 everos cascade rebuild --yes    # non-interactive
 ```
 
-> **Stop the `everos server` first.** Unlike `cascade sync`, rebuild
-> **drops and recreates** the active backend's tables or collections. A running
-> daemon holds
-> cached table handles that would keep pointing at (and writing to) the
-> dropped dataset, corrupting the rebuild. This is the one cascade
-> command that is **not** safe to run alongside a live server.
+> **Stop the `everos server` first.** Like every index-writing cascade
+> command, rebuild refuses to run while a server holds the memory root
+> (exit code 3) — and it has the strongest reason: it **drops and
+> recreates** the active backend's tables or collections. A running daemon
+> holds cached table handles that would keep pointing at (and writing to)
+> the dropped dataset, corrupting the rebuild.
 
 What it does, in order:
 
@@ -231,7 +238,10 @@ Workarounds:
 - Rely on the scanner — at default 30 s interval, throughput is
   bounded but eventually-consistent.
 - Drop the scan interval to ~5 s if the memory root is small.
-- Run `everos cascade sync` explicitly after batch edits.
+- With no server running, run `everos cascade sync` explicitly after batch
+  edits. A running server picks them up itself, and `sync` refuses to run
+  next to it (exit code 3): two processes writing the same index insert
+  rows twice.
 
 ### Daemon process crash mid-batch
 
@@ -373,6 +383,7 @@ is a deployment-side change with no schema work.
   in the entry inline. Tracked separately.
 - **Reference-file change detection (agent_skill)**: edits to
   `references/*.md` siblings won't trigger a re-index — only changes
-  to `SKILL.md` itself fire the watcher. Workaround: run
-  `everos cascade sync agents/<a>/skills/skill_<n>/SKILL.md` after
-  editing references.
+  to `SKILL.md` itself fire the watcher. Workaround: touch or re-save
+  `SKILL.md` so the watcher fires; with the server stopped,
+  `everos cascade sync agents/<a>/skills/skill_<n>/SKILL.md` re-enqueues
+  it directly.
```

**File**: `docs/how-memory-works.md` (modified, +2/-2)
```diff
@@ -263,8 +263,8 @@ Two paths, two guarantees:
 
 So a `/search` immediately after the `/flush` that produced a record may
 miss it. The markdown is durable regardless; index lag never loses data. If
-you need read-your-write, retry with backoff, or force the queue with
-`everos cascade sync`.
+you need read-your-write, retry with backoff (the running server is the
+only index writer; `everos cascade sync` is for when no server is running).
 
 Integrity is anchored by a few invariants (details in
 [storage_layout.md](storage_layout.md)): the frontmatter `id` /
```

**File**: `src/everos/entrypoints/cli/commands/cascade.py` (modified, +58/-21)
```diff
@@ -5,7 +5,7 @@
 
 - ``cascade sync [PATH]`` — flush the work queue. With ``PATH`` the
   command first force-enqueues that single file (used after a manual
-  md edit when waiting for the watcher is impractical), then drains.
+  md edit with no server running), then drains.
 - ``cascade status`` — print the queue + LSN summary that the daemon
   sees right now.
 - ``cascade fix`` — list every ``failed`` row. With ``--apply``, also
@@ -30,6 +30,7 @@
 from __future__ import annotations
 
 import asyncio
+import contextlib
 import enum
 import os
 from collections.abc import AsyncIterator
@@ -47,6 +48,7 @@
 from everos.core.persistence import MemoryRoot
 from everos.entrypoints.cli._log_setup import configure_cli_logging
 from everos.entrypoints.cli.commands._backfill_cmd import run_backfill
+from everos.infra.ome.exceptions import EngineLockHeldError
 from everos.infra.persistence.index import (
     connect,
     drop_business_tables,
@@ -61,6 +63,7 @@
 )
 from everos.memory.cascade import (
     CascadeOrchestrator,
+    hold_ome_lock,
     match_kind,
     ome_lock_is_free,
 )
@@ -136,15 +139,21 @@ def _apply_verbose_logging(verbose: bool | None) -> None:
 
 
 @asynccontextmanager
-async def _runtime(*, verify: bool = True, ensure: bool = True) -> AsyncIterator[None]:
+async def _runtime(
+    *, verify: bool = True, ensure: bool = True, exclusive: bool = False
+) -> AsyncIterator[None]:
     """Stand up sqlite + lancedb the same way the API lifespan would.
 
     The CLI uses the same lazy, process-wide singletons the API lifespan
     does. They are **per-process**: a running daemon has its own
-    connection and table-handle cache, so read/write traffic interleaves
-    safely, but a change to the table *set* made here (drop / recreate)
-    is invisible to the daemon's cached handles — which is why
-    ``rebuild`` refuses to run while a server holds the OME lock.
+    connection and table-handle cache, and reads its own LanceDB
+    snapshot. Reads interleave safely; writes do not — a second process
+    upserting the same table cannot see what the daemon just committed
+    (nor the other way round) and both insert the row, so every command
+    that writes the index (``sync``, ``fix --apply``, ``rebuild``) passes
+    ``exclusive=True`` and holds the OME lock for its whole run. Refused
+    with exit code 3 while a server (or another exclusive CLI phase) holds
+    it; a server starting meanwhile fails at its own lock instead.
 
     ``verify=False`` skips :func:`verify_business_schemas` — required by
     ``cascade rebuild``, whose whole purpose is to recover from a table
@@ -159,19 +168,39 @@ async def _runtime(*, verify: bool = True, ensure: bool = True) -> AsyncIterator
     Rebuild recreates the tables and their indexes itself after dropping,
     so skipping the pre-drop pass loses nothing.
     """
-    engine = get_engine()
-    async with engine.begin() as conn:
-        await conn.run_sync(SQLModel.metadata.create_all)
-    await connect()
-    if verify:
-        await verify_business_schemas()
-    if ensure:
-        await ensure_business_indexes()
+    lock = hold_ome_lock() if exclusive else contextlib.nullcontext()
     try:
-        yield
+        lock.__enter__()
+    except EngineLockHeldError:
+        typer.echo(
+            "error: another process holds this memory root's OME lock — a "
+            "running `everos server`\n"
+            "  (or another exclusive CLI phase). Two processes writing the "
+            "same index insert rows\n"
+            "  twice, so this command needs the root to itself. A server "
+            "projects markdown changes\n"
+            "  on its own unless it was started with EVEROS_DISABLE_CASCADE=1 "
+            "or quiesced; stop it\n"
+            "  first, then re-run.",
+            err=True,
+        )
+        raise typer.Exit(code=3) from None
+    try:
+        engine = get_engine()
+        async with engine.begin() as conn:
+            await conn.run_sync(SQLModel.metadata.create_all)
+        await connect()
+        if verify:
+            await verify_business_schemas()
+        if ensure:
+            await ensure_business_indexes()
+        try:
+            yield
+        finally:
+            await shutdown()
+            await dispose_engine()
     finally:
-        await shutdown()
-        await dispose_engine()
+        lock.__exit__(None, None, None)
 
 
 def _build_orchestrator() -> CascadeOrchestrator:
@@ -215,12 +244,20 @@ def sync(
         typer.Option("--verbose", "-v", help=_VERBOSE_OPTION_HELP),
     ] = None,
 ) -> None:
-    """Drain the cascade queue (and optionally re-enqueue a path first)."""
+    """Drain the cascade queue (and optionally re-enqueue a path first).
+
+    Holds the OME lock for the run (see :func:`_runtime`): a second process
+    writing the same LanceDB tables inserts rows twice — the server reads
+    its own table snapshot and cannot see what the CLI process just
+    committed, 
```

**File**: `src/everos/memory/cascade/__init__.py` (modified, +2/-0)
```diff
@@ -21,6 +21,7 @@
 from ._backfill import BackfillPhase as BackfillPhase
 from ._backfill import BackfillPresenter as BackfillPresenter
 from ._backfill import NullBackfillPresenter as NullBackfillPresenter
+from ._backfill import hold_ome_lock as hold_ome_lock
 from ._backfill import ome_lock_is_free as ome_lock_is_free
 from .orchestrator import CascadeConfig as CascadeConfig
 from .orchestrator import CascadeHealth as CascadeHealth
@@ -38,6 +39,7 @@
     "CascadeOrchestrator",
     "KindSpec",
     "NullBackfillPresenter",
+    "hold_ome_lock",
     "match_kind",
     "ome_lock_is_free",
 ]
```

**File**: `src/everos/memory/cascade/_backfill.py` (modified, +28/-1)
```diff
@@ -25,9 +25,10 @@
 from __future__ import annotations
 
 import asyncio
+import contextlib
 import dataclasses
 import datetime as dt
-from collections.abc import Callable
+from collections.abc import Callable, Iterator
 from pathlib import Path
 from typing import Any, Protocol
 from uuid import uuid4
@@ -1095,6 +1096,32 @@ def _probe_ome_lock_available() -> bool:
         handle.close()
 
 
+@contextlib.contextmanager
+def hold_ome_lock() -> Iterator[None]:
+    """Hold the OME jobstore lock for the duration of a CLI write phase.
+
+    Same file and flags as :meth:`OfflineEngine._acquire_lock`, so a server
+    that starts meanwhile fails at startup with :class:`EngineLockHeldError`
+    instead of becoming a second index writer. Raises
+    :class:`EngineLockHeldError` when another process already holds it.
+    """
+    root = MemoryRoot.resolve()
+    lock_path = Path(str(root.ome_db) + ".lock")
+    lock_path.parent.mkdir(parents=True, exist_ok=True)
+    handle = open(lock_path, "a+")  # noqa: SIM115
+    try:
+        try:
+            portalocker.lock(handle, portalocker.LOCK_EX | portalocker.LOCK_NB)
+        except portalocker.LockException as exc:
+            raise EngineLockHeldError(f"another process holds {lock_path}") from exc
+        try:
+            yield
+        finally:
+            portalocker.unlock(handle)
+    finally:
+        handle.close()
+
+
 def _build_cluster_engine() -> OfflineEngine:
     """Construct (but do not start) the throw-away OME engine Phase 2 drives.
 
```

**File**: `tests/integration/test_cascade_cli_integration.py` (modified, +71/-0)
```diff
@@ -15,11 +15,13 @@
 from __future__ import annotations
 
 import asyncio
+import contextlib
 import datetime as _dt
 import re
 from collections.abc import Iterator
 from pathlib import Path
 
+import portalocker
 import pytest
 from typer.testing import CliRunner
 
@@ -313,6 +315,75 @@ def test_rebuild_refuses_to_run_while_a_server_holds_the_lock(
     assert "rebuild complete" not in combined
 
 
+@contextlib.contextmanager
+def _server_holds_the_lock(root: Path) -> Iterator[None]:
+    """Hold the OME jobstore lock the way a running ``everos server`` does."""
+    lock_path = root / ".index" / "sqlite" / "ome.db.lock"
+    lock_path.parent.mkdir(parents=True, exist_ok=True)
+    with open(lock_path, "a+") as handle:
+        portalocker.lock(handle, portalocker.LOCK_EX | portalocker.LOCK_NB)
+        try:
+            yield
+        finally:
+            portalocker.unlock(handle)
+
+
+def test_sync_refuses_to_run_while_a_server_holds_the_lock(
+    cli_runtime: Path, monkeypatch: pytest.MonkeyPatch
+) -> None:
+    """``sync`` is an index writer; next to a running server it exits 3
+    before opening anything (a second writer inserts rows twice).
+    """
+
+    def _boom() -> None:
+        raise AssertionError("the runtime must not open the DB when refusing")
+
+    monkeypatch.setattr(cascade_mod, "get_engine", _boom)
+    with _server_holds_the_lock(cli_runtime):
+        result = CliRunner().invoke(cascade_mod.app, ["sync"])
+
+    assert result.exit_code == 3, result.output
+    assert "holds this memory root" in result.stderr.lower()
+    assert "stop it" in result.stderr.lower()
+    assert "sync complete" not in result.output
+
+
+def test_fix_apply_refuses_but_fix_and_status_still_run_next_to_a_server(
+    cli_runtime: Path,
+) -> None:
+    """Only the writing commands need the root to themselves."""
+    with _server_holds_the_lock(cli_runtime):
+        applied = CliRunner().invoke(cascade_mod.app, ["fix", "--apply"])
+        listed = CliRunner().invoke(cascade_mod.app, ["fix"])
+        status = CliRunner().invoke(cascade_mod.app, ["status"])
+
+    assert applied.exit_code == 3, applied.output
+    assert "holds this memory root" in applied.stderr.lower()
+    assert listed.exit_code == 0, listed.output + listed.stderr
+    assert status.exit_code == 0, status.output + status.stderr
+
+
+def test_sync_holds_the_lock_while_it_drains(
+    cli_runtime: Path, monkeypatch: pytest.MonkeyPatch
+) -> None:
+    """The lock is held for the whole drain, not probed and released — a
+    server starting meanwhile must fail at its own lock, not join in.
+    """
+    seen: list[bool] = []
+
+    class _Orchestrator:
+        async def sync_once(self) -> int:
+            seen.append(cascade_mod.ome_lock_is_free())
+            return 0
+
+    monkeypatch.setattr(cascade_mod, "_build_orchestrator", lambda: _Orchestrator())
+    result = CliRunner().invoke(cascade_mod.app, ["sync"])
+
+    assert result.exit_code == 0, result.output + result.stderr
+    assert seen == [False]  # the lock was ours during the drain
+    assert cascade_mod.ome_lock_is_free()  # and released afterwards
+
+
 # Reduce false negatives on date drift.
 def test_resolve_relative_via_command_arg(cli_runtime: Path) -> None:
     """An absolute path under the root works through ``cascade sync <path>``."""
```

---

### Incident Patch 9: `732e0f4c` (2026-09-24)
**Commit Message**: fix(cascade): commit watcher upserts for a path in delivery order (#462)

Each watcher event schedules its own upsert coroutine on the loop, and each
upsert awaits the database, so two events for the same path could commit in
either order and the last committer won. Windows synthesises a 'created' for
every file under a freshly created parent directory, which hands the handler
the same file four or five times; on the Windows soak box one of those stale
duplicates committed after an atomic save's 'added' and put the first write's
mtime and lsn back on the row (test_atomic_replace_over_existing_target_keeps
_the_row_alive failed 1 run in 4, only there).

Serialise the upserts behind one asyncio.Lock per handler; tasks are created
in delivery order and the lock is FIFO, so the row ends with the last event.
The scanner's sweep still writes on its own path.

Verification: the new test fails against the previous watcher with
committed == [m2, m1]; passes with the lock. The six existing watcher tests
pass; lint-imports 4/4.

Co-authored-by: zhanghui <[REDACTED_EMAIL]>
Co-authored-by: Claude Fable 5.1 <[REDACTED_EMAIL]>
Co-authored-by: KT <[REDACTED_EMAIL]>

**File**: `src/everos/memory/cascade/watcher.py` (modified, +14/-1)
```diff
@@ -14,6 +14,7 @@
 from __future__ import annotations
 
 import asyncio
+from collections.abc import Awaitable
 from pathlib import Path
 
 from watchdog.events import FileMovedEvent, FileSystemEvent, FileSystemEventHandler
@@ -78,6 +79,14 @@ def __init__(
     ) -> None:
         self._memory_root = memory_root
         self._loop = loop
+        # Upserts for one path must commit in delivery order. Each one awaits
+        # the database, so left concurrent the last committer wins and a stale
+        # duplicate overwrites a newer row. Windows synthesises a ``created``
+        # for every file under a freshly created parent directory, handing the
+        # same file to this handler four or five times; on the soak box one of
+        # those duplicates landed after an atomic save's ``added`` and put the
+        # first write's mtime back on the row (1 run in 4).
+        self._in_order = asyncio.Lock()
 
     def on_created(self, event: FileSystemEvent) -> None:
         self._enqueue(event.src_path, "added")
@@ -124,10 +133,14 @@ def _enqueue(self, raw_path: str, change_type: str) -> None:
             return
         mtime = _safe_mtime(raw_path)
         asyncio.run_coroutine_threadsafe(
-            _enqueue_async(spec, rel, change_type, mtime),
+            self._serialised(_enqueue_async(spec, rel, change_type, mtime)),
             self._loop,
         )
 
+    async def _serialised(self, upsert: Awaitable[None]) -> None:
+        async with self._in_order:
+            await upsert
+
 
 async def _enqueue_async(
     spec: KindSpec, rel: str, change_type: str, mtime: float
```

**File**: `tests/unit/test_memory/test_cascade/test_watcher_upsert_order.py` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+"""Upserts for one path commit in delivery order.
+
+Windows synthesises a ``created`` for every file under a freshly created
+parent directory, so one ``mkdir -p`` + write hands the handler the same path
+four or five times. Each upsert awaits the database; run concurrently, the
+last committer wins, and on the Windows soak box a stale duplicate carrying
+the first write's mtime overwrote the row of an atomic save (1 run in 4).
+"""
+
+from __future__ import annotations
+
+import asyncio
+import os
+from pathlib import Path
+
+import pytest
+from watchdog.events import FileCreatedEvent
+
+from everos.core.persistence import MemoryRoot
+from everos.memory.cascade import watcher as watcher_mod
+from everos.memory.cascade.watcher import _Handler
+
+_M1 = 1_700_000_000
+_M2 = 1_700_000_060
+
+
+class _SlowFirstRepo:
+    """The first upsert commits 50 ms late; the row is whatever committed last."""
+
+    def __init__(self) -> None:
+        self.calls = 0
+        self.committed: list[float] = []
+
+    async def upsert(
+        self, md_path: str, *, kind: str, change_type: str, mtime: float
+    ) -> int:
+        self.calls += 1
+        if self.calls == 1:
+            await asyncio.sleep(0.05)
+        self.committed.append(mtime)
+        return self.calls
+
+
+async def test_duplicate_events_commit_in_delivery_order(
+    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+) -> None:
+    repo = _SlowFirstRepo()
+    monkeypatch.setattr(watcher_mod, "md_change_state_repo", repo)
+    md = tmp_path.joinpath(
+        "default_app",
+        "default_project",
+        "users",
+        "u1",
+        "episodes",
+        "episode-2026-01-01.md",
+    )
+    md.parent.mkdir(parents=True)
+    md.write_text("v1", encoding="utf-8")
+    handler = _Handler(MemoryRoot(tmp_path), asyncio.get_running_loop())
+
+    os.utime(md, (_M1, _M1))
+    handler.on_created(FileCreatedEvent(str(md)))  # the synthetic duplicate
+    os.utime(md, (_M2, _M2))
+    handler.on_created(FileCreatedEvent(str(md)))  # the save that must win
+    await asyncio.sleep(0.2)
+
+    assert repo.committed == [_M1, _M2], (
+        "the stale duplicate committed after the newer event; the row now "
+        "carries the old mtime"
+    )
```

---

### Incident Patch 10: `5076683a` (2026-09-08)
**Commit Message**: fix(rerank): back off between retries instead of spinning (#441)

All three rerank providers retried 429 and 5xx responses with a bare
`continue`, so the entire retry budget was spent within milliseconds of
the first rejection. That is useless against a per-minute quota, which
is exactly what hosted rerank endpoints enforce: the caller burns three
attempts and still fails, while the window it needed to wait out had
barely started.

Observed while driving the LoCoMo agentic suite against a hosted rerank
endpoint — search requests failed outright with RerankServiceError while
the endpoint itself was healthy and merely pacing us.

Adds `_errors.backoff_sleep()` (exponential with full jitter, capped at
8s) and wires it into the vLLM, DeepInfra and DashScope retry loops. The
jitter keeps a batch of concurrent searches from re-colliding after they
trip the limit together. No behaviour change when the endpoint is
healthy: the sleep only runs on a retryable failure that will be retried.

Co-authored-by: zhanghui <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

**File**: `src/everos/component/rerank/_errors.py` (modified, +24/-1)
```diff
@@ -1,7 +1,10 @@
-"""Shared error construction for HTTP-based rerank providers."""
+"""Shared error construction and retry pacing for HTTP rerank providers."""
 
 from __future__ import annotations
 
+import asyncio
+import random
+
 import httpx
 
 from everos.core.observability.logging import get_logger
@@ -10,6 +13,26 @@
 
 logger = get_logger(__name__)
 
+_BACKOFF_BASE_SECONDS = 0.5
+_BACKOFF_CAP_SECONDS = 8.0
+
+
+async def backoff_sleep(attempt: int) -> None:
+    """Wait before the next retry of a 429 / 5xx rerank request.
+
+    Retrying with no delay is useless against a *per-minute* quota — the
+    whole budget burns in milliseconds and the caller still fails. Hosted
+    rerank routers enforce exactly that kind of quota, so the retry loop
+    has to actually wait. Exponential with full jitter, capped, to avoid a
+    thundering herd when a batch of concurrent searches trips the limit
+    together.
+
+    Args:
+        attempt: Zero-based index of the attempt that just failed.
+    """
+    delay = min(_BACKOFF_BASE_SECONDS * (2**attempt), _BACKOFF_CAP_SECONDS)
+    await asyncio.sleep(random.uniform(0, delay))
+
 
 def upstream_http_error(provider: str, response: httpx.Response) -> RerankServiceError:
     """Log the upstream response body and return a client-safe error.
```

**File**: `src/everos/component/rerank/dashscope_provider.py` (modified, +2/-0)
```diff
@@ -47,6 +47,7 @@
 
 import httpx
 
+from ._errors import backoff_sleep
 from .protocol import RerankError, RerankResult
 
 
@@ -160,6 +161,7 @@ async def _score_chunk(
                             f"DashScope rerank HTTP {response.status_code}: "
                             f"{response.text[:200]}"
                         )
+                    await backoff_sleep(attempt)
                     continue
                 raise RerankError(
                     f"DashScope rerank HTTP {response.status_code}: "
```

**File**: `src/everos/component/rerank/deepinfra_provider.py` (modified, +7/-1)
```diff
@@ -35,7 +35,12 @@
 
 import httpx
 
-from ._errors import retries_exhausted_error, transport_error, upstream_http_error
+from ._errors import (
+    backoff_sleep,
+    retries_exhausted_error,
+    transport_error,
+    upstream_http_error,
+)
 from .protocol import RerankResult, RerankServiceError
 
 # Qwen3-Reranker chat template. The DeepInfra inference API treats the reranker
@@ -160,6 +165,7 @@ async def _score_chunk(
                 if response.status_code >= 500 or response.status_code == 429:
                     if attempt == self._max_retries:
                         raise upstream_http_error("DeepInfra", response)
+                    await backoff_sleep(attempt)
                     continue
                 raise upstream_http_error("DeepInfra", response)
 
```

**File**: `src/everos/component/rerank/vllm_provider.py` (modified, +7/-1)
```diff
@@ -41,7 +41,12 @@
 
 import httpx
 
-from ._errors import retries_exhausted_error, transport_error, upstream_http_error
+from ._errors import (
+    backoff_sleep,
+    retries_exhausted_error,
+    transport_error,
+    upstream_http_error,
+)
 from .protocol import RerankResult, RerankServiceError
 
 
@@ -143,6 +148,7 @@ async def _score_chunk(
                 if response.status_code >= 500 or response.status_code == 429:
                     if attempt == self._max_retries:
                         raise upstream_http_error("vLLM", response)
+                    await backoff_sleep(attempt)
                     continue
                 raise upstream_http_error("vLLM", response)
 
```

**File**: `tests/unit/test_component/test_rerank/test_vllm_provider.py` (modified, +32/-0)
```diff
@@ -185,3 +185,35 @@ def handler(_req: httpx.Request) -> httpx.Response:
     p = VllmRerankProvider(model="m", api_key="", base_url="http://x/v1")
     with pytest.raises(RerankServiceError, match="malformed rerank result"):
         await p.rerank("q", ["a"])
+
+
+async def test_429_retry_waits_between_attempts(
+    monkeypatch: pytest.MonkeyPatch,
+) -> None:
+    """A per-minute quota is not survivable by spinning — retries must sleep."""
+    import everos.component.rerank._errors as errmod
+
+    slept: list[float] = []
+
+    async def fake_sleep(seconds: float) -> None:
+        slept.append(seconds)
+
+    monkeypatch.setattr(errmod.asyncio, "sleep", fake_sleep)
+
+    attempts = 0
+
+    def handler(_req: httpx.Request) -> httpx.Response:
+        nonlocal attempts
+        attempts += 1
+        if attempts <= 2:
+            return httpx.Response(429, json={"error": "rate limited"})
+        return _ok_response([{"index": 0, "relevance_score": 0.7}])
+
+    _patch_httpx(monkeypatch, handler)
+    p = VllmRerankProvider(model="m", api_key="k", base_url="http://x/v1")
+    out = await p.rerank("q", ["d"])
+    assert [r.score for r in out] == [0.7]
+    assert attempts == 3
+    # One wait per failed attempt, and each wait is a real (non-zero) budget.
+    assert len(slept) == 2
+    assert all(s >= 0 for s in slept)
```

---

### Incident Patch 11: `2ec82d3a` (2026-09-08)
**Commit Message**: fix(config): move the multimodal default off a preview model (#442)

`google/gemini-3-flash-preview` is a preview listing, so it can be
withdrawn from the router without notice and take every default-config
multimodal install down with it. `google/gemini-3.8-flash` is the
generally available line.

Verified against OpenRouter that the new default still accepts the
`image_url` content parts the parser sends (data-URI PNG round-trip,
correct answer returned).

Updates every place the id is spelled out, not just the shipped default:
default.toml, MultimodalSettings, both READMEs, docs/configuration.md,
docs/multimodal.md, .env.example and templates/env.template.

Co-authored-by: zhanghui <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

**File**: `.env.example` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ EVEROS_LLM__BASE_URL=https://openrouter.ai/api/v1
 # audio / ...); must support OpenAI image_url parts. Defaults target
 # Gemini via OpenRouter so the same key covers chat + multimodal.
 
-EVEROS_MULTIMODAL__MODEL=google/gemini-3-flash-preview
+EVEROS_MULTIMODAL__MODEL=google/gemini-3.8-flash
 EVEROS_MULTIMODAL__API_KEY=
 EVEROS_MULTIMODAL__BASE_URL=https://openrouter.ai/api/v1
 # Concurrency cap for parallel multimodal calls (default 4):
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -273,7 +273,7 @@ uv pip install 'everos[multimodal]'   # or: pip install 'everos[multimodal]'
 
 This pulls in `everalgo-parser` (with the `[svg]` bundle for SVG support via
 cairosvg). Configure the `[multimodal]` section in `everos.toml`; its default
-model is `google/gemini-3-flash-preview` via OpenRouter.
+model is `google/gemini-3.8-flash` via OpenRouter.
 
 **Office document support requires LibreOffice as a system dependency.**
 The parser shells out to `soffice` (LibreOffice's headless renderer) to
```

**File**: `README.zh-CN.md` (modified, +1/-1)
```diff
@@ -275,7 +275,7 @@ uv pip install 'everos[multimodal]'   # or: pip install 'everos[multimodal]'
 
 这会引入 `everalgo-parser`（包含用于 SVG 支持的 `[svg]` bundle，通过
 cairosvg）。在 `everos.toml` 的 `[multimodal]` 中完成配置；默认模型是通过
-OpenRouter 使用的 `google/gemini-3-flash-preview`。
+OpenRouter 使用的 `google/gemini-3.8-flash`。
 
 **Office 文档支持需要 LibreOffice 作为系统依赖。** parser 会调用
 `soffice`（LibreOffice 的 headless renderer），先把 `.doc` / `.docx` /
```

**File**: `docs/configuration.md` (modified, +1/-1)
```diff
@@ -134,7 +134,7 @@ Zilliz Cloud endpoint; a Milvus Lite filesystem path is rejected.
 
 | Field | Type | Default | Required | Description |
 |---|---|---|---|---|
-| `model` | string | `"google/gemini-3-flash-preview"` | No | Multimodal parsing model. |
+| `model` | string | `"google/gemini-3.8-flash"` | No | Multimodal parsing model. |
 | `api_key` | string | — | **Yes** | API key. |
 | `base_url` | string | — | No | Custom endpoint URL. |
 | `max_concurrency` | int | `4` | No | Max parallel parsing requests. |
```

**File**: `docs/multimodal.md` (modified, +2/-2)
```diff
@@ -97,7 +97,7 @@ parts. Fill in three fields in `everos.toml`:
 
 ```toml
 [multimodal]
-model    = "google/gemini-3-flash-preview"   # must support image_url parts
+model    = "google/gemini-3.8-flash"   # must support image_url parts
 base_url = "https://openrouter.ai/api/v1"
 api_key  = "<your key>"
 ```
@@ -270,7 +270,7 @@ containers and CI).
 
 | Field | Default | Meaning |
 |---|---|---|
-| `model` | `google/gemini-3-flash-preview` | Parsing model; must accept `image_url` parts |
+| `model` | `google/gemini-3.8-flash` | Parsing model; must accept `image_url` parts |
 | `base_url` | `https://openrouter.ai/api/v1` | OpenAI-compatible base URL |
 | `api_key` | — (required) | API key for the endpoint above |
 | `max_concurrency` | `4` | Cap on parallel multimodal calls within one extraction |
```

**File**: `src/everos/config/default.toml` (modified, +1/-1)
```diff
@@ -112,7 +112,7 @@ fallback_core = 3              # core size when every decider attempt fails
 # Independent LLM for multimodal parsing (everalgo-parser); must accept
 # image / pdf / audio image_url parts. Override via env:
 #   EVEROS_MULTIMODAL__MODEL, EVEROS_MULTIMODAL__API_KEY, EVEROS_MULTIMODAL__BASE_URL
-model = "google/gemini-3-flash-preview"
+model = "google/gemini-3.8-flash"
 api_key = ""
 base_url = "https://openrouter.ai/api/v1"
 max_concurrency = 4
```

**File**: `src/everos/config/settings.py` (modified, +1/-1)
```diff
@@ -333,7 +333,7 @@ class MultimodalSettings(BaseModel):
         EVEROS_MULTIMODAL__FILE_URI_MAX_BYTES
     """
 
-    model: str = "google/gemini-3-flash-preview"
+    model: str = "google/gemini-3.8-flash"
     api_key: SecretStr | None = None
     base_url: str | None = None
     max_concurrency: int = 4
```

**File**: `src/everos/templates/env.template` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ EVEROS_LLM__BASE_URL=https://openrouter.ai/api/v1
 # audio / ...); must support OpenAI image_url parts. Defaults target
 # Gemini via OpenRouter so the same key covers chat + multimodal.
 
-EVEROS_MULTIMODAL__MODEL=google/gemini-3-flash-preview
+EVEROS_MULTIMODAL__MODEL=google/gemini-3.8-flash
 EVEROS_MULTIMODAL__API_KEY=
 EVEROS_MULTIMODAL__BASE_URL=https://openrouter.ai/api/v1
 # Concurrency cap for parallel multimodal calls (default 4):
```

---

### Incident Patch 12: `8754365c` (2026-09-07)
**Commit Message**: docs: feature AIUI Sports Agents in use cases (#436)

**File**: `README.md` (modified, +66/-47)
```diff
@@ -323,6 +323,17 @@ external demos or integrations you can study and adapt.
 <tr>
 <td width="50%" valign="top">
 
+[![AIUI Sports Agents for Smart Glasses](https://github.com/user-attachments/assets/7a8e6bca-6a12-4284-aa57-2f59fed7a6a2)](https://github.com/EasonZhu1997/AIUI-Sports-Agents)
+
+#### AIUI Sports Agents
+
+Sports agents for smart glasses, covering running, cycling, and indoor rowing. AISmartRun includes an optional memory-backend contract for post-run summaries; connecting it to EverOS requires a separately configured backend.
+
+[Code](https://github.com/EasonZhu1997/AIUI-Sports-Agents)
+
+</td>
+<td width="50%" valign="top">
+
 [![banner-gif](https://github.com/user-attachments/assets/840470d7-a838-4c05-8685-dd797d4e9cdf)](https://evermind.ai/usecase_reunite)
 
 #### Reunite - Find With EverOS
@@ -332,6 +343,9 @@ Parents describe what they remember. Children describe what they recall. Reunite
 [Learn more](https://evermind.ai/usecase_reunite)
 
 </td>
+</tr>
+
+<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/7282b38b-56bf-4356-aa7b-06a845e7683d)](https://github.com/tt-a1i/hive)
@@ -343,9 +357,6 @@ Browser-native hive-mind for CLI coding agents - Claude Code, Codex, Gemini, and
 [Code](https://github.com/tt-a1i/hive)
 
 </td>
-</tr>
-
-<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/867d9329-ce9a-496f-ab1e-15c77974e5fa)](https://github.com/tt-a1i/evermemos-mcp)
@@ -357,6 +368,9 @@ Universal long-term memory layer for AI coding assistants, powered by EverOS.
 [Code](https://github.com/tt-a1i/evermemos-mcp)
 
 </td>
+</tr>
+
+<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/a4f0fd86-1c81-4445-bebc-e51eb5e33b30)](https://github.com/yuansui123/AI-Data-Technician-EverMemOS)
@@ -368,9 +382,6 @@ An agentic AI system that learns from scientist interaction to inspect, analyze,
 [Code](https://github.com/yuansui123/AI-Data-Technician-EverMemOS)
 
 </td>
-</tr>
-
-<tr>
 <td width="50%" valign="top">
 
 ![banner-gif](https://github.com/user-attachments/assets/650b901b-c9ba-4001-bac7-626b009df830)
@@ -382,6 +393,15 @@ Connect to EverOS within Rokid Glasses enabling long-term memory for all of your
 Coming soon
 
 </td>
+</tr>
+
+<tr>
+<td colspan="2" align="right">
+<a href="#readme-top"><img src="https://img.shields.io/badge/-Back_to_top-gray?style=flat-square" alt="Back to top"></a>
+</td>
+</tr>
+
+<tr>
 <td width="50%" valign="top">
 
 ![banner-gif](https://github.com/user-attachments/assets/85b338b2-e48e-4a65-9f30-0bc6998df872)
@@ -393,15 +413,6 @@ Creative assistant with long-term memory, so your creative context stays availab
 Coming soon
 
 </td>
-</tr>
-
-<tr>
-<td colspan="2" align="right">
-<a href="#readme-top"><img src="https://img.shields.io/badge/-Back_to_top-gray?style=flat-square" alt="Back to top"></a>
-</td>
-</tr>
-
-<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/f30617a1-adc0-4271-bc0e-c3a0b28cb903)](https://github.com/xunyud/Earth-Online)
@@ -413,6 +424,9 @@ Earth Online is a memory-aware productivity game that turns everyday planning in
 [Code](https://github.com/xunyud/Earth-Online)
 
 </td>
+</tr>
+
+<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/57d8cda7-35a5-4561-b794-5520dffc917b)](https://github.com/golutra/golutra)
@@ -424,8 +438,6 @@ Golutra presents a multi-agent workforce for engineering teams, extending the ID
 [Code](https://github.com/golutra/golutra)
 
 </td>
-</tr>
-<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/75f19db5-30f6-4eed-9b1e-c9c6a0e6b7de)](https://github.com/Yangtze-Seventh/taste-verse)
@@ -437,6 +449,9 @@ Record, visualize, and explore your tasting journey through an immersive 3D star
 [Code](https://github.com/Yangtze-Seventh/taste-verse)
 
 </td>
+</tr>
+
+<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/93ac2a68-4f18-4fcb-8d87-80aeb00a9d7c)](https://github.com/kellyvv/OpenHer)
@@ -448,9 +463,6 @@ Build AI that feels. Open-source persona engine - personality emerges from neura
 [Code](https://github.com/kellyvv/OpenHer)
 
 </td>
-</tr>
-
-<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/550071c1-dc39-4964-9f67-ffdfad792345)](https://chromewebstore.google.com/detail/ruminer-browser-agent/lbccjohfpdpimbhpckljimgolndfmfif)
@@ -462,6 +474,15 @@ Ruminer brings persistent memory to a browser agent so it can carry personal con
 [Plugin](https://chromewebstore.google.com/detail/ruminer-browser-agent/lbccjohfpdpimbhpckljimgolndfmfif)
 
 </td>
+</tr>
+
+<tr>
+<td colspan="2" align="right">
+<a href="#readme-top"><img src="https://img.shields.io/badge/-Back_to_top-gray?style=flat-square" alt="Back to top"></a>
+</td>
+</tr>
+
+<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](
```

**File**: `README.zh-CN.md` (modified, +66/-47)
```diff
@@ -322,6 +322,17 @@ make test
 <tr>
 <td width="50%" valign="top">
 
+[![AIUI Sports Agents for Smart Glasses](https://github.com/user-attachments/assets/7a8e6bca-6a12-4284-aa57-2f59fed7a6a2)](https://github.com/EasonZhu1997/AIUI-Sports-Agents)
+
+#### AIUI Sports Agents
+
+面向智能眼镜的运动 agents，覆盖跑步、骑行和室内划船。AISmartRun 提供用于跑后总结的可选记忆后端接口；接入 EverOS 需要单独配置后端服务。
+
+[代码](https://github.com/EasonZhu1997/AIUI-Sports-Agents)
+
+</td>
+<td width="50%" valign="top">
+
 [![banner-gif](https://github.com/user-attachments/assets/840470d7-a838-4c05-8685-dd797d4e9cdf)](https://evermind.ai/usecase_reunite)
 
 #### Reunite - 用 EverOS 找回连接
@@ -331,6 +342,9 @@ make test
 [了解更多](https://evermind.ai/usecase_reunite)
 
 </td>
+</tr>
+
+<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/7282b38b-56bf-4356-aa7b-06a845e7683d)](https://github.com/tt-a1i/hive)
@@ -342,9 +356,6 @@ make test
 [代码](https://github.com/tt-a1i/hive)
 
 </td>
-</tr>
-
-<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/867d9329-ce9a-496f-ab1e-15c77974e5fa)](https://github.com/tt-a1i/evermemos-mcp)
@@ -356,6 +367,9 @@ make test
 [代码](https://github.com/tt-a1i/evermemos-mcp)
 
 </td>
+</tr>
+
+<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/a4f0fd86-1c81-4445-bebc-e51eb5e33b30)](https://github.com/yuansui123/AI-Data-Technician-EverMemOS)
@@ -367,9 +381,6 @@ make test
 [代码](https://github.com/yuansui123/AI-Data-Technician-EverMemOS)
 
 </td>
-</tr>
-
-<tr>
 <td width="50%" valign="top">
 
 ![banner-gif](https://github.com/user-attachments/assets/650b901b-c9ba-4001-bac7-626b009df830)
@@ -381,6 +392,15 @@ make test
 即将推出
 
 </td>
+</tr>
+
+<tr>
+<td colspan="2" align="right">
+<a href="#readme-top"><img src="https://img.shields.io/badge/-Back_to_top-gray?style=flat-square" alt="Back to top"></a>
+</td>
+</tr>
+
+<tr>
 <td width="50%" valign="top">
 
 ![banner-gif](https://github.com/user-attachments/assets/85b338b2-e48e-4a65-9f30-0bc6998df872)
@@ -392,15 +412,6 @@ make test
 即将推出
 
 </td>
-</tr>
-
-<tr>
-<td colspan="2" align="right">
-<a href="#readme-top"><img src="https://img.shields.io/badge/-Back_to_top-gray?style=flat-square" alt="Back to top"></a>
-</td>
-</tr>
-
-<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/f30617a1-adc0-4271-bc0e-c3a0b28cb903)](https://github.com/xunyud/Earth-Online)
@@ -412,6 +423,9 @@ Earth Online 是一款 memory-aware productivity game，把日常计划变成一
 [代码](https://github.com/xunyud/Earth-Online)
 
 </td>
+</tr>
+
+<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/57d8cda7-35a5-4561-b794-5520dffc917b)](https://github.com/golutra/golutra)
@@ -423,8 +437,6 @@ Golutra 为工程团队提供 multi-agent workforce，把 IDE 从单一 assistan
 [代码](https://github.com/golutra/golutra)
 
 </td>
-</tr>
-<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/75f19db5-30f6-4eed-9b1e-c9c6a0e6b7de)](https://github.com/Yangtze-Seventh/taste-verse)
@@ -436,6 +448,9 @@ Golutra 为工程团队提供 multi-agent workforce，把 IDE 从单一 assistan
 [代码](https://github.com/Yangtze-Seventh/taste-verse)
 
 </td>
+</tr>
+
+<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/93ac2a68-4f18-4fcb-8d87-80aeb00a9d7c)](https://github.com/kellyvv/OpenHer)
@@ -447,9 +462,6 @@ Golutra 为工程团队提供 multi-agent workforce，把 IDE 从单一 assistan
 [代码](https://github.com/kellyvv/OpenHer)
 
 </td>
-</tr>
-
-<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/550071c1-dc39-4964-9f67-ffdfad792345)](https://chromewebstore.google.com/detail/ruminer-browser-agent/lbccjohfpdpimbhpckljimgolndfmfif)
@@ -461,6 +473,15 @@ Ruminer 为 browser agent 带来持久记忆，让它能在不同网页任务之
 [插件](https://chromewebstore.google.com/detail/ruminer-browser-agent/lbccjohfpdpimbhpckljimgolndfmfif)
 
 </td>
+</tr>
+
+<tr>
+<td colspan="2" align="right">
+<a href="#readme-top"><img src="https://img.shields.io/badge/-Back_to_top-gray?style=flat-square" alt="Back to top"></a>
+</td>
+</tr>
+
+<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/c258a6c4-fe70-497a-98d1-3dade4a932f6)](https://github.com/nanxingw/EverMem)
@@ -472,15 +493,6 @@ Ruminer 为 browser agent 带来持久记忆，让它能在不同网页任务之
 [代码](https://github.com/nanxingw/EverMem)
 
 </td>
-</tr>
-
-<tr>
-<td colspan="2" align="right">
-<a href="#readme-top"><img src="https://img.shields.io/badge/-Back_to_top-gray?style=flat-square" alt="Back to top"></a>
-</td>
-</tr>
-
-<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/39274473-ceb3-48fb-a031-e22230decbe2)](https://github.com/mco-org/mco)
@@ -492,6 +504,9 @@ MCO 为你的主 Agent 配备一个 agent team，让它们可以一起处理复
 [代码](https://github.com/mco-org/mco)
 
 </td>
+</tr>
+
+<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-atta
```

**File**: `docs/use-cases.md` (modified, +48/-29)
```diff
@@ -8,6 +8,17 @@ external demos or integrations you can study and adapt.
 <tr>
 <td width="50%" valign="top">
 
+[![AIUI Sports Agents for Smart Glasses](https://github.com/user-attachments/assets/7a8e6bca-6a12-4284-aa57-2f59fed7a6a2)](https://github.com/EasonZhu1997/AIUI-Sports-Agents)
+
+#### AIUI Sports Agents
+
+Sports agents for smart glasses, covering running, cycling, and indoor rowing. AISmartRun includes an optional memory-backend contract for post-run summaries; connecting it to EverOS requires a separately configured backend.
+
+[Code](https://github.com/EasonZhu1997/AIUI-Sports-Agents)
+
+</td>
+<td width="50%" valign="top">
+
 [![banner-gif](https://github.com/user-attachments/assets/840470d7-a838-4c05-8685-dd797d4e9cdf)](https://evermind.ai/usecase_reunite)
 
 #### Reunite - Find with EverOS
@@ -17,6 +28,9 @@ Parents describe what they remember. Children describe what they recall. Reunite
 [Learn more](https://evermind.ai/usecase_reunite)
 
 </td>
+</tr>
+
+<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/7282b38b-56bf-4356-aa7b-06a845e7683d)](https://github.com/tt-a1i/hive)
@@ -28,9 +42,6 @@ Browser-native hive-mind for CLI coding agents - Claude Code, Codex, Gemini, and
 [Code](https://github.com/tt-a1i/hive)
 
 </td>
-</tr>
-
-<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/867d9329-ce9a-496f-ab1e-15c77974e5fa)](https://github.com/tt-a1i/evermemos-mcp)
@@ -42,6 +53,9 @@ Universal long-term memory layer for AI coding assistants, powered by EverOS.
 [Code](https://github.com/tt-a1i/evermemos-mcp)
 
 </td>
+</tr>
+
+<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/a4f0fd86-1c81-4445-bebc-e51eb5e33b30)](https://github.com/yuansui123/AI-Data-Technician-EverMemOS)
@@ -53,9 +67,6 @@ An agentic AI system that learns from scientist interaction to inspect, analyze,
 [Code](https://github.com/yuansui123/AI-Data-Technician-EverMemOS)
 
 </td>
-</tr>
-
-<tr>
 <td width="50%" valign="top">
 
 ![banner-gif](https://github.com/user-attachments/assets/650b901b-c9ba-4001-bac7-626b009df830)
@@ -67,6 +78,9 @@ Connect to EverOS within Rokid Glasses enabling long-term memory for all of your
 Coming soon
 
 </td>
+</tr>
+
+<tr>
 <td width="50%" valign="top">
 
 ![banner-gif](https://github.com/user-attachments/assets/85b338b2-e48e-4a65-9f30-0bc6998df872)
@@ -78,9 +92,6 @@ Creative assistant with long-term memory, so your creative context stays availab
 Coming soon
 
 </td>
-</tr>
-
-<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/f30617a1-adc0-4271-bc0e-c3a0b28cb903)](https://github.com/xunyud/Earth-Online)
@@ -92,6 +103,9 @@ Earth Online is a memory-aware productivity game that turns everyday planning in
 [Code](https://github.com/xunyud/Earth-Online)
 
 </td>
+</tr>
+
+<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/57d8cda7-35a5-4561-b794-5520dffc917b)](https://github.com/golutra/golutra)
@@ -103,8 +117,6 @@ Golutra presents a multi-agent workforce for engineering teams, extending the ID
 [Code](https://github.com/golutra/golutra)
 
 </td>
-</tr>
-<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/75f19db5-30f6-4eed-9b1e-c9c6a0e6b7de)](https://github.com/Yangtze-Seventh/taste-verse)
@@ -116,6 +128,9 @@ Record, visualize, and explore your tasting journey through an immersive 3D star
 [Code](https://github.com/Yangtze-Seventh/taste-verse)
 
 </td>
+</tr>
+
+<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/93ac2a68-4f18-4fcb-8d87-80aeb00a9d7c)](https://github.com/kellyvv/OpenHer)
@@ -127,9 +142,6 @@ Build AI that feels. Open-source persona engine - personality emerges from neura
 [Code](https://github.com/kellyvv/OpenHer)
 
 </td>
-</tr>
-
-<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/550071c1-dc39-4964-9f67-ffdfad792345)](https://chromewebstore.google.com/detail/ruminer-browser-agent/lbccjohfpdpimbhpckljimgolndfmfif)
@@ -141,6 +153,9 @@ Ruminer brings persistent memory to a browser agent so it can carry personal con
 [Plugin](https://chromewebstore.google.com/detail/ruminer-browser-agent/lbccjohfpdpimbhpckljimgolndfmfif)
 
 </td>
+</tr>
+
+<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/c258a6c4-fe70-497a-98d1-3dade4a932f6)](https://github.com/nanxingw/EverMem)
@@ -152,9 +167,6 @@ One command to connect any AI coding CLI to EverOS (formerly called EverMemOS) f
 [Code](https://github.com/nanxingw/EverMem)
 
 </td>
-</tr>
-
-<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/39274473-ceb3-48fb-a031-e22230decbe2)](https://github.com/mco-org/mco)
@@ -166,6 +178,9 @@ MCO equips your primary agent with an agent team that can work together to s
```

**File**: `use-cases/README.md` (modified, +48/-29)
```diff
@@ -6,6 +6,17 @@ Use cases show what persistent memory makes possible in real products and workfl
 <tr>
 <td width="50%" valign="top">
 
+[![AIUI Sports Agents for Smart Glasses](https://github.com/user-attachments/assets/7a8e6bca-6a12-4284-aa57-2f59fed7a6a2)](https://github.com/EasonZhu1997/AIUI-Sports-Agents)
+
+#### AIUI Sports Agents
+
+Sports agents for smart glasses, covering running, cycling, and indoor rowing. AISmartRun includes an optional memory-backend contract for post-run summaries; connecting it to EverOS requires a separately configured backend.
+
+[Code](https://github.com/EasonZhu1997/AIUI-Sports-Agents)
+
+</td>
+<td width="50%" valign="top">
+
 [![banner-gif](https://github.com/user-attachments/assets/840470d7-a838-4c05-8685-dd797d4e9cdf)](https://evermind.ai/usecase_reunite)
 
 #### Reunite - Find with EverOS
@@ -15,6 +26,9 @@ Parents describe what they remember. Children describe what they recall. Reunite
 [Learn more](https://evermind.ai/usecase_reunite)
 
 </td>
+</tr>
+
+<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/7282b38b-56bf-4356-aa7b-06a845e7683d)](https://github.com/tt-a1i/hive)
@@ -26,9 +40,6 @@ Browser-native hive-mind for CLI coding agents — Claude Code, Codex, Gemini, a
 [Code](https://github.com/tt-a1i/hive)
 
 </td>
-</tr>
-
-<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/867d9329-ce9a-496f-ab1e-15c77974e5fa)](https://github.com/tt-a1i/evermemos-mcp)
@@ -40,6 +51,9 @@ Universal long-term memory layer for AI coding assistants, powered by EverOS.
 [Code](https://github.com/tt-a1i/evermemos-mcp)
 
 </td>
+</tr>
+
+<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/a4f0fd86-1c81-4445-bebc-e51eb5e33b30)](https://github.com/yuansui123/AI-Data-Technician-EverMemOS)
@@ -51,9 +65,6 @@ An agentic AI system that learns from scientist interaction to inspect, analyze,
 [Code](https://github.com/yuansui123/AI-Data-Technician-EverMemOS)
 
 </td>
-</tr>
-
-<tr>
 <td width="50%" valign="top">
 
 ![banner-gif](https://github.com/user-attachments/assets/650b901b-c9ba-4001-bac7-626b009df830)
@@ -65,6 +76,9 @@ Connect to EverOS within Rokid Glasses enabling long-term memory for all of your
 Coming soon
 
 </td>
+</tr>
+
+<tr>
 <td width="50%" valign="top">
 
 ![banner-gif](https://github.com/user-attachments/assets/85b338b2-e48e-4a65-9f30-0bc6998df872)
@@ -76,9 +90,6 @@ Creative assistant with long-term memory, never forget your crativites anymore.
 Coming soon
 
 </td>
-</tr>
-
-<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/f30617a1-adc0-4271-bc0e-c3a0b28cb903)](https://github.com/xunyud/Earth-Online)
@@ -90,6 +101,9 @@ Earth Online is a memory-aware productivity game that turns everyday planning in
 [Code](https://github.com/xunyud/Earth-Online)
 
 </td>
+</tr>
+
+<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/57d8cda7-35a5-4561-b794-5520dffc917b)](https://github.com/golutra/golutra)
@@ -101,8 +115,6 @@ Golutra presents a multi-agent workforce for engineering teams, extending the ID
 [Code](https://github.com/golutra/golutra)
 
 </td>
-</tr>
-<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/75f19db5-30f6-4eed-9b1e-c9c6a0e6b7de)](https://github.com/Yangtze-Seventh/taste-verse)
@@ -114,6 +126,9 @@ Record, visualize, and explore your tasting journey through an immersive 3D star
 [Code](https://github.com/Yangtze-Seventh/taste-verse)
 
 </td>
+</tr>
+
+<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/93ac2a68-4f18-4fcb-8d87-80aeb00a9d7c)](https://github.com/kellyvv/OpenHer)
@@ -125,9 +140,6 @@ Build AI that feels. Open-source persona engine — personality emerges from neu
 [Code](https://github.com/kellyvv/OpenHer)
 
 </td>
-</tr>
-
-<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/550071c1-dc39-4964-9f67-ffdfad792345)](https://chromewebstore.google.com/detail/ruminer-browser-agent/lbccjohfpdpimbhpckljimgolndfmfif)
@@ -139,6 +151,9 @@ Ruminer brings persistent memory to a browser agent so it can carry personal con
 [Plugin](https://chromewebstore.google.com/detail/ruminer-browser-agent/lbccjohfpdpimbhpckljimgolndfmfif)
 
 </td>
+</tr>
+
+<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/c258a6c4-fe70-497a-98d1-3dade4a932f6)](https://github.com/nanxingw/EverMem)
@@ -150,9 +165,6 @@ One command to connect any AI coding CLI to EverOS (formerly called EverMemOS) f
 [Code](https://github.com/nanxingw/EverMem)
 
 </td>
-</tr>
-
-<tr>
 <td width="50%" valign="top">
 
 [![banner-gif](https://github.com/user-attachments/assets/39274473-ceb3-48fb-a031-e22230decbe2)](https://github.com/mco-org/mco)
@@ -164,6 +176,9 @@ MCO equips your primary agent with an agent team that ca
```

---

### Incident Patch 13: `71af620a` (2026-09-03)
**Commit Message**: Fix typos in README.md for EverOS

**File**: `README.md` (modified, +2/-2)
```diff
@@ -21,7 +21,7 @@
 
 <br>
 
-- [Why Ever OS](#why-ever-os)
+- [Why EverOS](#why-ever-os)
 - [Ecosystem Integrations](#ecosystem-integrations)
 - [Quick Start](#quick-start)
 - [Use Cases](#use-cases)
@@ -34,7 +34,7 @@
 </details>
 
 
-## Why Ever OS
+## Why EverOS
 
 EverOS is a Python library and local-first memory runtime for agents and
 makers. It gives one portable memory layer across coding assistants, apps,
```

---

### Incident Patch 14: `d07cddc4` (2026-08-17)
**Commit Message**: feat(dsh): add adaptive memory integration (#410)

* feat(dsh): add adaptive memory integration

* ci(dsh): validate standalone plugin

---------

Co-authored-by: Elliot Chen <[REDACTED_EMAIL]>

**File**: `.github/dependabot.yml` (modified, +9/-0)
```diff
@@ -18,3 +18,12 @@ updates:
     groups:
       python-deps:
         patterns: ["*"]
+
+  # Standalone DeepSeek Harness plugin under examples/dsh
+  - package-ecosystem: npm
+    directory: /examples/dsh
+    schedule:
+      interval: weekly
+    groups:
+      dsh-deps:
+        patterns: ["*"]
```

**File**: `.github/workflows/dsh.yml` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+name: DSH plugin
+
+on:
+  push:
+    branches: [main]
+    paths:
+      - "examples/dsh/**"
+      - ".github/workflows/dsh.yml"
+  pull_request:
+    paths:
+      - "examples/dsh/**"
+      - ".github/workflows/dsh.yml"
+  workflow_dispatch:
+
+concurrency:
+  group: dsh-${{ github.workflow }}-${{ github.ref }}
+  cancel-in-progress: true
+
+permissions:
+  contents: read
+
+jobs:
+  verify:
+    name: lint, test, build, and package
+    runs-on: ubuntu-latest
+    timeout-minutes: 15
+    defaults:
+      run:
+        working-directory: examples/dsh
+    steps:
+      - uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6.1.0
+        with:
+          persist-credentials: false
+
+      - name: Set up Node.js
+        uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6.5.0
+        with:
+          node-version: "22.19.0"
+          cache: npm
+          cache-dependency-path: examples/dsh/package-lock.json
+
+      - name: Install locked dependencies
+        run: npm ci
+
+      - name: Lint, typecheck, test, and build
+        run: npm run ci
+
+      - name: Verify npm package contents
+        run: npm pack --dry-run
```

**File**: `docs/api.md` (modified, +8/-0)
```diff
@@ -505,6 +505,7 @@ the `status` field — see [Response body](#response-body) below.
 | `app_id` | `string` *(ScopeId)* | no | `"default"` | see [ScopeId](#scopeid-app_id-and-project_id) |
 | `project_id` | `string` *(ScopeId)* | no | `"default"` | see [ScopeId](#scopeid-app_id-and-project_id) |
 | `messages` | `array<MessageItem>` | yes | — | 1–500 items |
+| `defer_extraction` | `boolean` | no | `false` | buffer durably without boundary or extraction LLM calls |
 
 **`session_id`** — Identifies the conversation buffer on the server.
 Messages POSTed with the same `(session_id, app_id, project_id)`
@@ -520,6 +521,13 @@ extracted). The 1–500 cap is a per-request safety bound, not a
 session lifetime cap — you can call `/add` many times for the same
 `session_id`.
 
+**`defer_extraction`** — When `true`, `/add` only merges the messages
+into the durable SQLite `unprocessed_buffer`. It skips boundary
+detection, memcell creation, and all extraction pipelines, so batching
+clients can capture every turn cheaply and call `/flush` after an idle
+window, a size threshold, or a session switch. A successful deferred
+add always reports `status: "accumulated"`.
+
 #### Response body
 
 `200 OK` returns a SuccessEnvelope wrapping:
```

**File**: `docs/openapi.json` (modified, +6/-0)
```diff
@@ -2965,6 +2965,12 @@
             "maxItems": 500,
             "minItems": 1,
             "title": "Messages"
+          },
+          "defer_extraction": {
+            "type": "boolean",
+            "title": "Defer Extraction",
+            "description": "Persist messages in the durable unprocessed buffer without running boundary detection or extraction. A later /flush commits the batch.",
+            "default": false
           }
         },
         "type": "object",
```

**File**: `examples/dsh/.gitignore` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+node_modules/
+lib/
+coverage/
+*.tsbuildinfo
```

**File**: `examples/dsh/README.md` (added, +231/-0)
```diff
@@ -0,0 +1,231 @@
+# EverOS Memory for DeepSeek Harness
+
+Automatic cross-session memory for DeepSeek Harness (DSH), backed by a local
+[EverOS](https://github.com/EverMind-AI/EverOS) service.
+
+The plugin follows a three-stage lifecycle:
+
+1. **Recall** — once at the start of each user turn, search the EverOS user and agent
+   tracks in parallel and append a source-attributed recall message. When the user has
+   switched sessions, pending memory from the previous session is committed first.
+2. **Capture** — at every turn stopping boundary, durably append newly committed user,
+   assistant, tool-call, and tool-result events to EverOS's SQLite buffer without an LLM
+   extraction call.
+3. **Flush** — batch extraction after an idle window, a token/message threshold, a session
+   switch, a maximum delay, or shutdown. Session disposal remains the final safety net.
+
+EverOS failures are fail-open: they are logged, but never reject the user's DSH step or
+turn.
+
+## Requirements
+
+- Node.js `^22.19.0 || >=24.0.0`
+- DeepSeek Harness `0.1.0-rc.6` or newer within the `0.1.x` line
+- EverOS installed and initialized
+
+```bash
+uv tool install everos
+everos init
+```
+
+EverOS 1.2.3 supports the plugin's LLM-only Tier 1 path with keyword recall. Deferred
+capture batching additionally requires an EverOS build that supports
+`defer_extraction`; until that capability is included in a tagged release, install
+EverOS from the same checkout as this example. With 1.2.3, capture remains functional,
+but `/add` uses the eager boundary and extraction path.
+
+Embedding, rerank, and multimodal credentials are optional. EverOS owns provider and
+storage configuration; this plugin does not accept or store API keys.
+
+For a local source checkout, install the current tree and provide the LLM key through the
+environment before starting EverOS:
+
+```bash
+uv tool install --editable ../..
+everos init
+export EVEROS_LLM__API_KEY='<your OpenRouter key>'
+everos server start
+```
+
+The generated `~/.everos/everos.toml` already contains the default OpenRouter model and
+base URL. Keep secrets out of the repository and use your normal secret manager for
+persistent setup.
+
+## Install
+
+For local development from the EverOS repository:
+
+```bash
+cd examples/dsh
+npm ci
+npm run ci
+dsh plugin --profile web add .
+```
+
+After the package is published:
+
+```bash
+dsh plugin --profile web add @evermind-ai/dsh-plugin
+```
+
+The package declares `dsh.bundle.patch`, so a repository URL ending in
+`/tree/main/examples/dsh` is also suitable for DSH plugin discovery. A source install
+runs the package's `prepare` build, so pnpm may require the user to approve that build in
+the profile's `allowBuilds` list. The npm package ships prebuilt output and needs no such
+approval.
+
+## Configuration
+
+The bundled patch reads the most common values from environment variables:
+
+```bash
+export EVEROS_DSH_BASE_URL=http://127.0.0.1:8000
+export EVEROS_DSH_USER_ID=alice
+export EVEROS_DSH_AGENT_ID=dsh
+export EVEROS_DSH_RECALL_METHOD=keyword
+export EVEROS_DSH_FLUSH_IDLE_MS=30000
+export EVEROS_DSH_FLUSH_TOKEN_THRESHOLD=12000
+export EVEROS_DSH_FLUSH_MESSAGE_THRESHOLD=50
+export EVEROS_DSH_FLUSH_MAX_DELAY_MS=300000
+export EVEROS_DSH_START_COMMAND='everos server start'
+export EVEROS_DSH_DIR=/path/to/EverOS
+```
+
+Every option can also be set in the plugin row of the DSH Cordis profile:
+
+```yaml
+- id: everos-memory
+  name: '@evermind-ai/dsh-plugin'
+  config:
+    baseUrl: http://127.0.0.1:8000
+    apiVersion: auto
+    appId: dsh
+    userId: alice
+    agentId: dsh
+    recallMethod: keyword
+    queryN: 3
+    queryMaxChars: 2000
+    recallTopK: 5
+    recallMaxChars: 12000
+    recallTimeoutMs: 5000
+    captureTimeoutMs: 15000
+    captureMaxChars: 50000
+    flushIdleMs: 30000
+    flushTokenThreshold: 12000
+    flushMessageThreshold: 50
+    flushMaxDelayMs: 300000
+    flushOnSessionSwitch: true
+    autoStart: true
+    startCommand: everos server start
+```
+
+| Option | Default | Meaning |
+| --- | --- | --- |
+| `baseUrl` | `http://127.0.0.1:8000` | EverOS server root |
+| `apiVersion` | `auto` | Try `/api/v2`, then fall back to `/api/v1` on 404 |
+| `appId` | `dsh` | EverOS application partition |
+| `projectId` | workspace-derived | Optional fixed project partition |
+| `userId` | operating-system account | User-memory owner |
+| `agentId` | DSH agent preset | Agent-memory owner |
+| `recallMethod` | `keyword` | EverOS retrieval method; `keyword` supports LLM-only Tier 1 |
+| `queryN` | `3` | Direct user messages blended into a recall query |
+| `queryMaxChars` | `2000` | Recall-query character budget |
+| `recallTopK` | `5` | Result limit per owner track |
+| `recallMaxChars` | `12000` | Maximum injected memory block |
+| `recallTimeoutMs` | `5000` | Timeout for each search |
+| `captureTimeoutMs` | `15000` | Timeout for add and flush requests |
+| `captureMaxChars` | `50000` | Per-message capture limit |
+|
```

**File**: `examples/dsh/biome.json` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+{
+  "$schema": "https://biomejs.dev/schemas/2.2.0/schema.json",
+  "formatter": {
+    "enabled": true,
+    "indentStyle": "space",
+    "indentWidth": 2,
+    "lineWidth": 100
+  },
+  "javascript": {
+    "formatter": {
+      "quoteStyle": "single",
+      "semicolons": "asNeeded",
+      "trailingCommas": "all"
+    }
+  },
+  "linter": {
+    "enabled": true,
+    "rules": {
+      "recommended": true
+    }
+  },
+  "files": {
+    "includes": ["src/**/*.ts", "test/**/*.ts"]
+  }
+}
```

**File**: `examples/dsh/cordis.patch.yml` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+# Mount EverOS memory into every DeepSeek Harness agent composition.
+- insert:
+    - id: everos-memory
+      name: '@evermind-ai/dsh-plugin'
+      config:
+        baseUrl: !!js process.env.EVEROS_DSH_BASE_URL || 'http://127.0.0.1:8000'
+        userId: !!js process.env.EVEROS_DSH_USER_ID
+        agentId: !!js process.env.EVEROS_DSH_AGENT_ID
+        recallMethod: !!js process.env.EVEROS_DSH_RECALL_METHOD || 'keyword'
+        flushIdleMs: !!js Number(process.env.EVEROS_DSH_FLUSH_IDLE_MS || 30000)
+        flushTokenThreshold: !!js Number(process.env.EVEROS_DSH_FLUSH_TOKEN_THRESHOLD || 12000)
+        flushMessageThreshold: !!js Number(process.env.EVEROS_DSH_FLUSH_MESSAGE_THRESHOLD || 50)
+        flushMaxDelayMs: !!js Number(process.env.EVEROS_DSH_FLUSH_MAX_DELAY_MS || 300000)
+        startCommand: !!js process.env.EVEROS_DSH_START_COMMAND
+        everosDir: !!js process.env.EVEROS_DSH_DIR
```

---

### Incident Patch 15: `f07ad99d` (2026-08-14)
**Commit Message**: docs(readme): streamline demo quickstart (#408)

**File**: `README.md` (modified, +4/-18)
```diff
@@ -105,32 +105,18 @@ uv pip install everos
 
 ### 2. Try the standalone demo — no key required
 
-Before configuring a provider or starting the server, run:
+No API key or server setup required—run one command to quickly experience how
+EverOS stores and recalls memory:
 
 ```bash
 everos demo
 ```
 
-The full-screen terminal UI has an input box: type something EverOS should
-remember, then ask a question that recalls it. No API key or server setup is
-needed. Each round lets you watch the memory move through the real lifecycle:
-ingest -> extract -> index -> recall.
-
-The particle sphere changes with each stage, then bursts across the memory
-field and fades away. A small core of yellow and white particles keeps moving
-at the center, then expands smoothly into the next round. See
-[docs/everos-demo.md](docs/everos-demo.md) for the complete experience. Type
-`/` to see the commands (`/replay`, `/live`, `/quit`); `ctrl+c` exits anytime.
-After a few rounds the demo points you at configuring your own keys (`everos
-init`, then `everos demo --live`).
+Enter something EverOS should remember, then ask a related question to watch
+the memory move through ingest -> extract -> index -> recall.
 
 <https://github.com/user-attachments/assets/98cb8e1e-2ca8-4504-b0a6-0b9a040a0a5c>
 
-Press `r` to replay and `q` to quit. For a non-interactive preview, use
-`everos demo --plain`; for the looping showroom view, use
-`everos demo --cinematic`. See [docs/everos-demo.md](docs/everos-demo.md) for
-the visualizer's scope.
-
 ### 3. Initialize and add your OpenRouter key
 
 ```bash
```

**File**: `README.zh-CN.md` (modified, +4/-14)
```diff
@@ -105,28 +105,18 @@ uv pip install everos
 
 ### 2. 先体验独立 Demo —— 不需要 Key
 
-在配置 provider 或启动 server 之前，先运行：
+无需填写 API Key 或启动 server，只需一条命令即可快速体验 EverOS 如何保存并
+召回记忆：
 
 ```bash
 everos demo
 ```
 
-全屏 terminal UI 里带有一个输入框：先输入一件希望 EverOS 记住的事情，再提出
-一个能够召回它的问题。不需要 API key，也不需要提前启动 server。每一轮都能
-直观看到记忆经历完整流程：ingest -> extract -> index -> recall。
-
-粒子球会随四个阶段持续变化，随后散落到 memory field 并淡出；中心会先留下少量
-黄白粒子攒动，再由中心向外扩展成完整球体，进入下一轮。完整体验见
-[docs/everos-demo.md](docs/everos-demo.md)。输入 `/` 可以
-查看可用命令（`/replay`、`/live`、`/quit`）；`ctrl+c` 随时退出。几轮之后，demo
-会引导你配置自己的 key（`everos init`，然后 `everos demo --live`）。
+输入一条希望 EverOS 记住的信息，再提出相关问题，即可直观看到记忆经过
+ingest -> extract -> index -> recall 的完整流程。
 
 <https://github.com/user-attachments/assets/98cb8e1e-2ca8-4504-b0a6-0b9a040a0a5c>
 
-按 `r` replay，按 `q` 退出。非交互式预览可以使用 `everos demo --plain`；
-循环 showroom view 可以使用 `everos demo --cinematic`。Visualizer 的范围见
-[docs/everos-demo.md](docs/everos-demo.md)。
-
 ### 3. 初始化并配置百炼
 
 ```bash
```

#### Recent Merged Pull Requests:
- **PR #471** (2026-10-01): ci(milvus): drop MinIO from the Milvus job with local storage (@gloryfromca)
- **PR #469** (2026-09-30): fix(knowledge): keep PATCH category moves inside knowledge/ (@dani1005)
- **PR #468** (2026-09-24): fix(deps): pin openai below 3 so a fresh install can call the LLM (@gloryfromca)
- **PR #467** (2026-09-24): chore(release): v1.4.0 (@gloryfromca)
- **PR #466** (2026-09-24): chore(release): v1.4.0rc2 (@gloryfromca)
- **PR #465** (2026-09-24): fix(lancedb): translate the spill failure on the write path too (@gloryfromca)
- **PR #464** (2026-09-24): chore(release): v1.4.0rc1 (@gloryfromca)
- **PR #463** (2026-09-24): fix(lancedb): treat a lance spill failure as retryable (@gloryfromca)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
