# Forensic Learning Record (Deep Inspection): JerBouma/FinanceToolkit

> **Canonical Artifact**: `07_PROJECT_LEARNING/jerbouma-financetoolkit-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/JerBouma/FinanceToolkit](https://github.com/JerBouma/FinanceToolkit))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:46:18.186Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `JerBouma/FinanceToolkit`
- **Description**: Transparent and Efficient Financial Analysis
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 5391 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `financetoolkit/__init__.py`
```
"""Finance Toolkit Initialization"""

# flake8: noqa
from .toolkit_controller import Toolkit
from .economics.economics_controller import Economics
from .fixedincome.fixedincome_controller import FixedIncome
from .discovery.discovery_controller import Discovery
from .portfolio.portfolio_controller import Portfolio

```

### Core Architecture Module: `financetoolkit/cache/__init__.py`
```
"""Cache Module"""

from financetoolkit.cache.cache_controller import (
    Cache,
    CachePlan,
    get_cache,
    get_default_cache_location,
    parse_use_cached_data,
    reset_cache_registry,
    resolve_cache_location,
)
from financetoolkit.cache.policy_model import CachePolicy, get_policy, register_policy

__all__ = [
    "Cache",
    "CachePlan",
    "CachePolicy",
    "get_cache",
    "get_default_cache_location",
    "get_policy",
    "parse_use_cached_data",
    "register_policy",
    "reset_cache_registry",
    "resolve_cache_location",
]

```

### Core Architecture Module: `financetoolkit/cache/cache_controller.py`
```
"""Cache Module"""

__docformat__ = "google"

import os
import platform
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path
from threading import Lock
from typing import Any

import pandas as pd

from financetoolkit.cache import (
    coverage_model,
    frame_model,
    policy_model,
    serialization_model,
)
from financetoolkit.cache.sqlite_model import SCHEMA_VERSION, SQLiteBackend
from financetoolkit.utilities import logger_model

logger = logger_model.get_logger()

DATABASE_FILE_NAME = "financetoolkit_cache.db"

# Compacted into merged intervals past this many rows, to bound table growth.
COVERAGE_COMPACTION_THRESHOLD = 16

_CACHE_REGISTRY: dict[str, "Cache"] = {}
_REGISTRY_LOCK = Lock()

# Published once per process: OECD/FRED/ECB/Fed reach the cache via free functions.
_ACTIVE_CACHE: "Cache | None" = None


def set_active_cache(cache: "Cache | None") -> None:
    """
    Publish the cache that free functions across the toolkit should use.

    A disabled cache never replaces an enabled one. Controllers are constructed
    freely and often, including inside a long running server that set up caching
    once at startup, and one of them opting out must not silently switch caching
    off for everything else in the process. Use ``clear_active_cache`` to actually
    withdraw one.

    Args:
        cache (Cache | None): The cache to make active. None, or a disabled cache,
            leaves any previously published cache in place.
    """
    global _ACTIVE_CACHE  # noqa: PLW0603

    if cache is None or not cache.enabled:
        return

    _ACTIVE_CACHE = cache


def clear_active_cache() -> None:
    """
    Withdraw the published cache so free functions stop caching.

    Separate from ``set_active_cache`` so that withdrawing is always deliberate.
    """
    global _ACTIVE_CACHE  # noqa: PLW0603
    _ACTIVE_CACHE = None


def get_active_cache() -> "Cache | None":
    """
    Return the cache published by the most recently initialized controller.

    Returns:
        Cache | None: The active cache, or None when caching is disabled or when no
            controller has published one yet.
    """
    if _ACTIVE_CACHE is not None and _ACTIVE_CACHE.enabled:
        return _ACTIVE_CACHE

    return None


def get_default_cache_location() -> Path:
    """
    Return the platform-specific path of the shared cache database.

    The database lives in the same user configuration directory the MCP server
    already uses for its global ``.env`` file, so a Toolkit run and a running MCP
    server warm the same cache instead of each maintaining their own copy:

    * **Windows** — ``%APPDATA%\\financetoolkit\\financetoolkit_cache.db``
    * **macOS / Linux** — ``$XDG_CONFIG_HOME/financetoolkit/financetoolkit_cache.db``
      (falling back to ``~/.config/financetoolkit/`` when the variable is unset)

    The location can be overridden with the ``FINANCE_TOOLKIT_CACHE_DB``
    environment variable.

    Returns:
        Path: Absolute path to the cache database file.
    """
    override = os.environ.get("FINANCE_TOOLKIT_CACHE_DB")

    if override:
        return Path(override).expanduser()

    if platform.system() == "Windows":
        base = Path(
            os.environ.get("APPDATA") or str(Path.home() / "AppData" / "Roaming")
        )
    else:
        xdg_config_home = os.environ.get("XDG_CONFIG_HOME")
        base = Path(xdg_config_home) if xdg_config_home else Path.home() / ".config"

    return base / "financetoolkit" / DATABASE_FILE_NAME


def resolve_cache_location(location: str | Path | None) -> Path:
    """
    Turn a user supplied cache location into a database file path.

    Accepts None for the shared default, a directory (the database is placed
    inside it, which is what ``use_cached_data="my_folder"`` means), or a direct
    path to a ``.db`` file.

    Args:
        location (str | Path | None): The requested location.

    Returns:
        Path: Absolute path to the cache database file.
    """
    if location is None:
        return get_default_cache_location()

    path = Path(location).expanduser()

    if path.suffix in (".db", ".sqlite", ".sqlite3"):
        return path

    return path / DATABASE_FILE_NAME


@dataclass
class CachePlan:
    """
    The result of asking the cache what still has to be fetched.

    Attributes:
        key (str): The dataset key the plan was computed for.
        cached (dict[str, pd.DataFrame | pd.Series]): Per entity, the data already
            held by the cache, restricted to the requested window.
        missing (dict[str, list[coverage_model.Interval]]): Per entity, the date
            ranges that still have to be requested from the source. An entity
            absent from this mapping is fully cached.
    """

    key: str
    cached: dict[str, pd.DataFrame | pd.Series] = field(default_factory=dict)
    missing: dict[str, list[coverage_model.Interval]] = field(default_factory=dict)

    @property
    def entities_to_fetch(self) -> list[str]:
        """
        The entities that still need at least one call to the external source.

        Returns:
            list[str]: Entity identifiers with outstanding gaps.
        """
        return [entity for entity, gaps in self.missing.items() if gaps]

    @property
    def fully_cached(self) -> bool:
        """
        Whether the request can be served entirely from the cache.

        Returns:
            bool: True when no entity has an outstanding gap.
        """
        return not self.entities_to_fetch

    def get_fetch_span(self, entity: str) -> coverage_model.Interval | None:
        """
        Return a single interval covering every gap for an entity.

        Most financial APIs accept one date range per request, so fetching the
        hull of the outstanding gaps in one call is cheaper than issuing a
        separate request per gap. Any already cached data inside that hull is
        simply overwritten by the fresher response when it is merged back in.

        Args:
            entity (str): The entity to compute the span for.

        Returns:
            coverage_model.Interval | None: The covering interval, or None when
                the entity is fully cached.
        """
        gaps = self.missing.get(entity, [])

        if not gaps:
            return None

        return (min(start for start, _ in gaps), max(end for _, end in gaps))


class Cache:
    """
    Incremental, per entity cache for data retrieved from external sources.

    Every dataset is identified by its source, its name and the parameters that
    change the shape of the response. Within a dataset, data is stored per entity
    (a ticker, a country, a series identifier) together with the date ranges that
    have actually been requested. Widening a date range, adding a ticker or
    changing an unrelated parameter therefore reuses everything already stored
    instead of triggering a full refetch.

    The cache only ever holds data obtained from an external source. Anything the
    toolkit computes itself is derived from that data on demand and is never
    written here.
    """

    def __init__(self, location: str | Path | None = None, enabled: bool = True):
        """
        Initialize the cache against a database location.

        Args:
            location (str | Path | None): Directory or database file to use. None
                selects the shared, platform-specific default location.
            enabled (bool): When False every read misses and every write is a
                no-op, so callers do not need to branch on whether caching is on.
        """
        self._enabled = enabled
        self._location = resolve_cache_location(location)
        self._backend = None

        if enabled:
            try:
                self._backend = SQLiteBackend(self._location)
            except Exception as error:  # pylint: disable=broad-except
                # A cach
```

### Core Architecture Module: `financetoolkit/cache/coverage_model.py`
```
"""Coverage Module"""

__docformat__ = "google"

from datetime import date, datetime, timedelta

import pandas as pd

# Inclusive (start, end) pair recording what was already fetched from a source.
Interval = tuple[date, date]

ONE_DAY = timedelta(days=1)


def normalize_date(value: str | date | datetime | pd.Timestamp | pd.Period) -> date:
    """
    Convert any of the date representations used throughout the toolkit into a
    plain ``datetime.date``.

    The toolkit passes dates around as ISO strings ("2020-01-01"), pandas
    Timestamps and, for historical data, pandas Periods. Interval arithmetic is
    only well defined on a single representation, so everything is funnelled
    through this function first.

    Args:
        value (str | date | datetime | pd.Timestamp | pd.Period): The date to convert.

    Returns:
        date: The equivalent ``datetime.date``.

    Raises:
        TypeError: If the value is not one of the supported date representations.
    """
    if isinstance(value, pd.Period):
        return value.to_timestamp().date()
    if isinstance(value, pd.Timestamp):
        return value.date()
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return datetime.strptime(value[:10], "%Y-%m-%d").date()

    raise TypeError(
        f"Unsupported date type ({type(value)}), expected a string, date, "
        "datetime, Timestamp or Period."
    )


def merge_intervals(intervals: list[Interval]) -> list[Interval]:
    """
    Collapse a list of intervals into the smallest equivalent list.

    Overlapping and directly adjacent intervals are merged, so that
    [(2020-01-01, 2020-06-30), (2020-07-01, 2020-12-31)] becomes a single
    interval covering the whole year. Adjacency counts as overlap because a
    one day gap between two fetched ranges is not a real gap in the data.

    Args:
        intervals (list[Interval]): The intervals to merge, in any order.

    Returns:
        list[Interval]: Disjoint, non-adjacent intervals sorted by start date.
    """
    valid_intervals = [
        (start, end) for start, end in intervals if start is not None and start <= end
    ]

    if not valid_intervals:
        return []

    merged: list[Interval] = []

    for start, end in sorted(valid_intervals):
        if merged and start <= merged[-1][1] + ONE_DAY:
            previous_start, previous_end = merged[-1]
            merged[-1] = (previous_start, max(previous_end, end))
        else:
            merged.append((start, end))

    return merged


def subtract_intervals(target: Interval, covered: list[Interval]) -> list[Interval]:
    """
    Determine which parts of a requested interval are not yet covered.

    This is the core of the incremental cache: given the range the user asked
    for and the ranges already stored, it returns only the gaps that still have
    to be requested from the external API.

    Args:
        target (Interval): The inclusive interval that was requested.
        covered (list[Interval]): The intervals already present in the cache.

    Returns:
        list[Interval]: The parts of ``target`` not covered by ``covered``, sorted
            by start date. An empty list means the request is fully cached.
    """
    target_start, target_end = target

    if target_start > target_end:
        return []

    missing: list[Interval] = []
    cursor = target_start

    for start, end in merge_intervals(covered):
        if end < cursor:
            continue
        if start > target_end:
            break
        if start > cursor:
            missing.append((cursor, min(start - ONE_DAY, target_end)))
        cursor = max(cursor, end + ONE_DAY)
        if cursor > target_end:
            break

    if cursor <= target_end:
        missing.append((cursor, target_end))

    return missing


def intersect_intervals(first: Interval, second: Interval) -> Interval | None:
    """
    Compute the overlap between two intervals.

    Args:
        first (Interval): The first inclusive interval.
        second (Interval): The second inclusive interval.

    Returns:
        Interval | None: The overlapping interval, or None when they are disjoint.
    """
    start = max(first[0], second[0])
    end = min(first[1], second[1])

    return (start, end) if start <= end else None


def total_days(intervals: list[Interval]) -> int:
    """
    Count the number of days spanned by a list of intervals.

    Used for logging and for deciding whether a partial refetch is actually
    cheaper than simply requesting the full range again.

    Args:
        intervals (list[Interval]): The intervals to measure.

    Returns:
        int: The total number of inclusive days covered, after merging overlaps.
    """
    return sum((end - start).days + 1 for start, end in merge_intervals(intervals))

```

### Core Architecture Module: `financetoolkit/cache/frame_model.py`
```
"""Frame Module"""

__docformat__ = "google"

import contextlib

import pandas as pd

from financetoolkit.cache.coverage_model import Interval, normalize_date


def get_date_axis(data: pd.DataFrame | pd.Series, date_axis: int = 0) -> pd.Index:
    """
    Return the axis of a frame that carries the dates.

    Most toolkit data is indexed by date, but financial statements are laid out
    with line items as rows and reporting periods as columns. Both layouts have
    to be cached, so the date carrying axis is explicit rather than assumed.

    Args:
        data (pd.DataFrame | pd.Series): The frame to inspect.
        date_axis (int): 0 when the index holds the dates, 1 when the columns do.

    Returns:
        pd.Index: The axis holding the dates.

    Raises:
        ValueError: If ``date_axis`` is not 0 or 1.
    """
    if date_axis == 0:
        return data.index
    if date_axis == 1:
        return data.columns

    raise ValueError(f"The date_axis must be 0 or 1, received {date_axis}.")


def get_date_bounds(
    data: pd.DataFrame | pd.Series, date_axis: int = 0
) -> Interval | None:
    """
    Determine the first and last date present in a frame.

    Args:
        data (pd.DataFrame | pd.Series): The frame to inspect.
        date_axis (int): 0 when the index holds the dates, 1 when the columns do.

    Returns:
        Interval | None: The inclusive (first, last) date pair, or None when the
            frame is empty or its axis holds no parseable dates.
    """
    if data is None or len(data) == 0:
        return None

    axis = get_date_axis(data, date_axis)

    if len(axis) == 0:
        return None

    dates = []

    for label in axis:
        try:
            dates.append(normalize_date(label))
        except (TypeError, ValueError):
            continue

    if not dates:
        return None

    return (min(dates), max(dates))


def slice_frame(
    data: pd.DataFrame | pd.Series,
    start: str | None = None,
    end: str | None = None,
    date_axis: int = 0,
) -> pd.DataFrame | pd.Series:
    """
    Restrict a frame to the requested date range.

    The cache stores a superset of what any single call asked for, so the stored
    frame is narrowed back down to the requested window before being handed to
    the caller. Labels that cannot be parsed as dates are kept, which matters for
    statement frames that carry non-date columns alongside the reporting periods.

    Args:
        data (pd.DataFrame | pd.Series): The frame to slice.
        start (str | None): Inclusive start of the window. None leaves it open.
        end (str | None): Inclusive end of the window. None leaves it open.
        date_axis (int): 0 when the index holds the dates, 1 when the columns do.

    Returns:
        pd.DataFrame | pd.Series: The frame restricted to the requested window.
    """
    if data is None or len(data) == 0 or (start is None and end is None):
        return data

    axis = get_date_axis(data, date_axis)
    start_date = normalize_date(start) if start else None
    end_date = normalize_date(end) if end else None

    mask = []

    for label in axis:
        try:
            label_date = normalize_date(label)
        except (TypeError, ValueError):
            # Non-date labels are structural, so a date window never filters them out.
            mask.append(True)
            continue

        within_start = start_date is None or label_date >= start_date
        within_end = end_date is None or label_date <= end_date
        mask.append(within_start and within_end)

    return data.loc[mask] if date_axis == 0 else data.loc[:, mask]


def merge_frames(
    existing: pd.DataFrame | pd.Series | None,
    incoming: pd.DataFrame | pd.Series,
    date_axis: int = 0,
) -> pd.DataFrame | pd.Series:
    """
    Combine a newly fetched frame with what the cache already holds.

    Where the two overlap the incoming values win, because they come from a more
    recent call to the source and therefore reflect any revision or restatement.
    The result is sorted along the date axis so the merged frame is
    indistinguishable from one fetched in a single request.

    Args:
        existing (pd.DataFrame | pd.Series | None): The frame already cached, if any.
        incoming (pd.DataFrame | pd.Series): The newly fetched frame.
        date_axis (int): 0 when the index holds the dates, 1 when the columns do.

    Returns:
        pd.DataFrame | pd.Series: The merged frame.
    """
    if existing is None or len(existing) == 0:
        return incoming
    if incoming is None or len(incoming) == 0:
        return existing

    if date_axis == 1:
        merged = pd.concat([existing, incoming], axis=1)
        merged = merged.loc[:, ~merged.columns.duplicated(keep="last")]
        sort_axis = 1
    else:
        merged = pd.concat([existing, incoming], axis=0)
        merged = merged[~merged.index.duplicated(keep="last")]
        sort_axis = 0

    # Axes mixing dates and labels are not orderable; keep concatenation order.
    with contextlib.suppress(TypeError):
        merged = merged.sort_index(axis=sort_axis)

    return merged

```

### Core Architecture Module: `financetoolkit/cache/policy_model.py`
```
"""Policy Module"""

__docformat__ = "google"

from dataclasses import dataclass

DAY = 86400

# Spelled exactly as `enforce_source` spells them, so one word works in both.
FINANCIAL_MODELING_PREP = "FinancialModelingPrep"
YAHOO_FINANCE = "YahooFinance"
FRED = "FRED"
OECD = "OECD"
GLOBAL_MACRO_DATABASE = "GlobalMacroDatabase"
EUROPEAN_CENTRAL_BANK = "EuropeanCentralBank"
FEDERAL_RESERVE = "FederalReserve"
KEN_FRENCH = "KenFrench"
MCP = "MCP"


@dataclass(frozen=True)
class CachePolicy:
    """
    Freshness rules for a single dataset.

    Two independent knobs are needed because financial time series age in two
    different ways. Observations far in the past are effectively immutable, so
    re-requesting them wastes API credits; the observations near the end of the
    series are not, because the current bar is unfinished, statistical agencies
    revise their releases for months, and issuers restate their filings.

    The two settings answer different questions. The time-to-live decides *whether*
    a stored range is refreshed at all, so repeated runs inside that window make no
    external calls whatsoever. The revision window decides *how much* is re-requested
    once it is refreshed, so a daily rerun asks for the volatile tail rather than
    the entire history again.

    Attributes:
        ttl_seconds (int): How long a stored range is served without contacting the
            source at all.
        revision_days (int): How many days back from the end of the request are
            re-requested once the stored range has gone stale. Zero means the whole
            stale range is requested again, which is the right behaviour for sources
            that cannot be queried by date range anyway.
    """

    ttl_seconds: int
    revision_days: int = 0


# Point-in-time data has no date range, so only the TTL applies.
DEFAULT_POLICY = CachePolicy(ttl_seconds=DAY)

POLICIES: dict[str, CachePolicy] = {
    # Splits and dividends restate recent bars, so only the last week is re-requested.
    f"{FINANCIAL_MODELING_PREP}.historical": CachePolicy(
        ttl_seconds=DAY, revision_days=7
    ),
    f"{YAHOO_FINANCE}.historical": CachePolicy(ttl_seconds=DAY, revision_days=7),
    # Intraday bars move continuously; only FinancialModelingPrep publishes them.
    f"{FINANCIAL_MODELING_PREP}.intraday": CachePolicy(
        ttl_seconds=900, revision_days=2
    ),
    # Filings are restated and take no date range, so a refresh asks for everything.
    f"{FINANCIAL_MODELING_PREP}.statements": CachePolicy(ttl_seconds=DAY),
    f"{YAHOO_FINANCE}.statements": CachePolicy(ttl_seconds=DAY),
    # Company descriptors barely move.
    f"{FINANCIAL_MODELING_PREP}.profile": CachePolicy(ttl_seconds=30 * DAY),
    f"{FINANCIAL_MODELING_PREP}.rating": CachePolicy(ttl_seconds=DAY),
    f"{FINANCIAL_MODELING_PREP}.quote": CachePolicy(ttl_seconds=60),
    f"{FINANCIAL_MODELING_PREP}.analyst_estimates": CachePolicy(ttl_seconds=DAY),
    f"{FINANCIAL_MODELING_PREP}.earnings_calendar": CachePolicy(ttl_seconds=DAY),
    f"{FINANCIAL_MODELING_PREP}.dividend_calendar": CachePolicy(ttl_seconds=DAY),
    f"{FINANCIAL_MODELING_PREP}.esg_scores": CachePolicy(ttl_seconds=7 * DAY),
    f"{FINANCIAL_MODELING_PREP}.revenue_geographic_segmentation": CachePolicy(
        ttl_seconds=7 * DAY
    ),
    f"{FINANCIAL_MODELING_PREP}.revenue_product_segmentation": CachePolicy(
        ttl_seconds=7 * DAY
    ),
    f"{FINANCIAL_MODELING_PREP}.market_risk_premium": CachePolicy(ttl_seconds=7 * DAY),
    f"{FINANCIAL_MODELING_PREP}.commitment_of_traders": CachePolicy(ttl_seconds=DAY),
    f"{FINANCIAL_MODELING_PREP}.treasury_rates": CachePolicy(
        ttl_seconds=DAY, revision_days=7
    ),
    # Short lived because several are intraday movers rather than static lists.
    f"{FINANCIAL_MODELING_PREP}.discovery": CachePolicy(ttl_seconds=3600),
    # Probed on every construction, so a short lifetime removes almost all the calls.
    f"{FINANCIAL_MODELING_PREP}.subscription_plan": CachePolicy(ttl_seconds=3600),
    # Describes the instrument rather than its price, so it barely changes.
    f"{YAHOO_FINANCE}.historical_statistics": CachePolicy(ttl_seconds=30 * DAY),
    # Chains move continuously while open; the expiry list is stable far longer.
    f"{YAHOO_FINANCE}.option_chain": CachePolicy(ttl_seconds=900),
    f"{YAHOO_FINANCE}.option_expiries": CachePolicy(ttl_seconds=DAY),
    # A forward curve fetches one contract per delivery month, so cache per contract.
    f"{YAHOO_FINANCE}.futures": CachePolicy(ttl_seconds=DAY, revision_days=7),
    # Macro sources revise heavily and publish on a lag, so the tail stays long.
    f"{FRED}.series": CachePolicy(ttl_seconds=DAY, revision_days=365),
    f"{OECD}.query": CachePolicy(ttl_seconds=DAY, revision_days=1095),
    f"{GLOBAL_MACRO_DATABASE}.dataset": CachePolicy(ttl_seconds=7 * DAY),
    # Full history per series and no date range accepted, so only a TTL applies.
    f"{EUROPEAN_CENTRAL_BANK}.series": CachePolicy(ttl_seconds=DAY),
    f"{FEDERAL_RESERVE}.rate": CachePolicy(ttl_seconds=DAY),
    # The Ken French factor files are published monthly as a single zip archive; named "factors_decimal" because the loaders were corrected to divide the published percentages by 100, and the rename is what stops a cache warmed by an older release from serving percent-scaled factors against decimal returns, so the policy has to follow that rename or the archive falls back to the one day default and is re-downloaded every day.  # noqa: E501
    f"{KEN_FRENCH}.factors_decimal": CachePolicy(ttl_seconds=7 * DAY),
    # Computed MCP tool responses layered on top of the source caches.
    f"{MCP}.tool": CachePolicy(ttl_seconds=DAY),
}


def get_policy(source: str, dataset: str) -> CachePolicy:
    """
    Look up the freshness policy for a source and dataset combination.

    Args:
        source (str): The external data source, e.g. "fmp".
        dataset (str): The dataset within that source, e.g. "historical".

    Returns:
        CachePolicy: The registered policy, or a conservative default when the
            combination is not registered.
    """
    return POLICIES.get(f"{source}.{dataset}", DEFAULT_POLICY)


def register_policy(source: str, dataset: str, policy: CachePolicy) -> None:
    """
    Register or override the freshness policy for a source and dataset.

    Args:
        source (str): The external data source.
        dataset (str): The dataset within that source.
        policy (CachePolicy): The policy to apply.
    """
    POLICIES[f"{source}.{dataset}"] = policy

```

### Core Architecture Module: `financetoolkit/cache/request_model.py`
```
"""Request Module"""

__docformat__ = "google"

import re

# Credentials identify the caller, not the data, so they never reach a cache key.
CREDENTIAL_PARAMETERS = ("apikey", "api_key", "token")

_CREDENTIAL_PATTERN = re.compile(
    r"([?&])(" + "|".join(CREDENTIAL_PARAMETERS) + r")=[^&]*", re.IGNORECASE
)


def redact_credentials(url: str) -> str:
    """
    Remove credential query parameters from a URL so it can identify a cache entry.

    Args:
        url (str): The request URL, possibly carrying an API key.

    Returns:
        str: The URL with every credential parameter removed, leaving the separator
            structure intact so that the remaining parameters still identify the
            request uniquely.
    """
    redacted = _CREDENTIAL_PATTERN.sub(r"\1", url)
    redacted = redacted.replace("?&", "?").replace("&&", "&")

    return redacted.rstrip("?&")

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1** (2020-04-02): **Financial Statement calls broke**
  *Symptoms*: I keep getting the following error, when trying to pull financial statements: "IndexError: list index out of range"  Here"s the full error for cashflows:  Traceback (most recent call last):   File "C:/Python/StocksLoader/yFinance_Fundamentals.py", line 10, in <module>     print(fa.cashflows(symbol))   File "C:\ProgramData\Anaconda3\envs\StocksLoader\lib\site-packages\FundamentalAnalysis\cashflows.py", line 55, in cashflows     data = pd.read_html(lxml.etree.tostring(table[0], method='html'))[0].set_index(0).transpose() IndexError: list index out of range  Ratios, summary, etc... still appear to work.  Any ideas? Thanks for making this, BTW.
  **Post-Mortem & Fix Analysis**:
  > Same here. I guess that problem is that you must have the Premium account on Yahoo to unlock the "Company Outlook".
  > `IndexError: list index out of range`  This error is given because it is unable to find a table on the page (since it is no longer coded this way). For Ratios/Summary, the table still exists.  This is very unfortunate but it seems Yahoo Finance overhauled the entire page. Previously it was as easy as scraping the table that was displayed on that page. I fiddled around with it without any results. For now I lack the time to come up with a proper solution.  Feel free to fiddle around with the code yourself.
  > Fully updated the package. Please update your version to use it.

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

### Incident Patch 1: `b21989f4` (2026-08-16)
**Commit Message**: Fix stale notebook name in external datasets README

Options module took slot 5, so the notebook dropped its old numeric prefix.

**File**: `examples/external_datasets/README.md` (modified, +1/-1)
```diff
@@ -1 +1 @@
-These normalisation files and financial statement files are used as part of the "Finance Toolkit - 5. Using External Datasets" notebook.
\ No newline at end of file
+These normalisation files and financial statement files are used as part of the "Finance Toolkit - Using External Datasets" notebook.
\ No newline at end of file
```

---

### Incident Patch 2: `18d38f35` (2026-08-16)
**Commit Message**: Fix logging format-string escaping for literal % in error messages

Args-passing logger.error() calls need %% to escape the literal percent, otherwise "15% off" parses "% o" as an octal format spec. The one call with no args needs the opposite (single %).

**File**: `financetoolkit/toolkit_controller.py` (modified, +1/-1)
```diff
@@ -381,7 +381,7 @@ def __init__(
                 self._enforce_source = "YahooFinance"
                 logger.error(
                     "You have entered an invalid API key from Financial Modeling Prep. Obtain your API key for free "
-                    "and get 15%% off the Premium plans by using the following affiliate link.\nThis also supports "
+                    "and get 15% off the Premium plans by using the following affiliate link.\nThis also supports "
                     "the project: https://www.jeroenbouma.com/fmp. Using Yahoo Finance as data source instead."
                 )
         else:
```

**File**: `financetoolkit/utilities/error_model.py` (modified, +2/-2)
```diff
@@ -343,7 +343,7 @@ def check_for_error_messages(
         if user_subscription == "Free":
             logger.error(
                 "Given that you are using the Free plan, it could be due to reaching the API "
-                "limit of the day, consider upgrading your plan. You can get 15%% off by "
+                "limit of the day, consider upgrading your plan. You can get 15% off by "
                 "using the following affiliate link which also supports the project: "
                 "https://www.jeroenbouma.com/fmp"
             )
@@ -360,7 +360,7 @@ def check_for_error_messages(
     if invalid_api_key:
         logger.error(
             "You have entered an invalid API key from Financial Modeling Prep. Obtain an API key for free "
-            "or get 15%% off the Premium plans by using the following affiliate link.\nThis also supports "
+            "or get 15% off the Premium plans by using the following affiliate link.\nThis also supports "
             "the project: https://www.jeroenbouma.com/fmp"
         )
 
```

---

### Incident Patch 3: `2f4a7675` (2026-08-11)
**Commit Message**: Finish the GARCH multi-start fix

The previous commit picked up a stale garch_model.py alongside the finished
snapshots/tests, so committed code and committed snapshots didn't match. This
is the actual multi-start version those snapshots were recorded from, verified
against the CI container three times (linux/amd64, py3.11-3.14).

**File**: `financetoolkit/risk/garch_model.py` (modified, +83/-56)
```diff
@@ -3,6 +3,7 @@
 import numpy as np
 import pandas as pd
 from scipy import optimize
+from scipy.stats import qmc
 
 from financetoolkit.utilities.logger_model import get_logger
 
@@ -13,63 +14,92 @@
 # Two levels when a 'within period' index nests days inside a period (2020Q1).
 MULTI_PERIOD_INDEX_LEVELS = 2
 
-# Fallback seed used for a single retry when the primary fit gets stuck at x0.
-RETRY_SEED = 7
+# Number of deterministic Sobol starting points a GARCH-family fit tries, in addition to
+# the domain-informed initial guess.
+N_MULTI_START_POINTS = 32
 
 
-def _fit_dual_annealing(
+def _fit_multi_start(
     wrapper_func,
     bounds: list[tuple[float, float]],
     initial_guess: list[float],
     model_name: str,
 ) -> np.ndarray:
     """
-    Runs `scipy.optimize.dual_annealing` for a GARCH-family log-likelihood and verifies
-    the fit actually moved rather than trusting the returned parameters blindly.
-
-    `result.success` alone is not a reliable guard here: `dual_annealing` reports success
-    (with message "Maximum number of iteration reached") even when the local search never
-    improves on the literal `x0` starting point, so an unchecked `result.x` can silently
-    return an unfitted guess as if it were a real estimate. This is checked for explicitly
-    by comparing `result.x` against `x0`. If the first attempt fails (either
-    `result.success` is False, or the result is still exactly `x0`), it is retried once
-    with a different seed (a stuck run is usually just an unlucky annealing schedule rather
-    than a genuinely unfittable series); if the retry also fails, a warning is logged and
-    NaN weights are returned instead of the unfitted starting point.
+    Fits a GARCH-family log-likelihood by running `scipy.optimize.minimize` (L-BFGS-B)
+    from many deterministic starting points spread across `bounds`, and keeps the best.
+
+    This used to run `scipy.optimize.dual_annealing`, a global optimizer, instead. It
+    reports success (with message "Maximum number of iteration reached") even when the
+    local search never improves on `x0`, and worse, its chaotic simulated-annealing walk
+    turned out to be sensitive to platform floating-point differences: the exact same
+    integer seed produced a genuinely different local optimum on Linux than on macOS for
+    EGARCH (parameters differing enough to flip Gamma's sign), because the log-likelihood
+    it climbs isn't bit-identical across libm/BLAS backends, and tiny ULP differences
+    flip early Metropolis accept/reject decisions, fully diverging the search from there.
+    Neither more seeds (4 -> 8, no change) nor polishing each seed's result with L-BFGS-B
+    (no change either) closed that gap, which is expected: both just replay the same
+    biased trajectory more precisely, they don't change what the trajectory visits.
+
+    Gradient descent from many fixed points doesn't have that failure mode: there is no
+    stochastic accept/reject step, so tiny platform-level floating-point noise in the
+    objective doesn't redirect the search, it only perturbs the final digits of wherever
+    that descent was already headed. The starting points are drawn from a deterministic,
+    seeded Sobol sequence (a low-discrepancy sequence generated by fixed bit arithmetic,
+    not by evaluating the objective), so the set of points tried is itself the same on
+    every platform. A start that lands outside the feasible region (`wrapper_func`
+    returning a constraint-violation penalty) or whose local search doesn't converge is
+    simply discarded rather than crashing the fit.
 
     Args:
         wrapper_func (Callable): The (constrained) negative log-likelihood to minimize.
-        bounds (list[tuple[float, float]]): The parameter bounds passed to `dual_annealing`.
-        initial_guess (list[float]): The starting point (`x0`) for the first attempt.
-        model_name (str): The model name to include in the warning message if both
-   
```

---

### Incident Patch 4: `ae06fff0` (2026-08-11)
**Commit Message**: Fix get_historical_data() ignoring enforce_source after the first call

The cache guard only checked whether the daily frame was empty, not
whether enforce_source (or return_column/include_dividends/fill_nan/
rounding) changed since the call that populated it. First call won for
the Toolkit's whole lifetime; every later call with different params
silently got the same cached frame back unless overwrite=True, which
then re-fetched everything rather than reacting to what actually
changed. Now tracks the params used and auto-invalidates on a mismatch;
a pre-supplied `historical=` DataFrame is still never touched.

**File**: `financetoolkit/toolkit_controller.py` (modified, +23/-7)
```diff
@@ -434,6 +434,8 @@ def __init__(
         self._daily_historical_data: pd.DataFrame = (
             historical if not historical.empty else pd.DataFrame()
         )
+        # None means "not fetched by us yet", so pre-supplied `historical` is never auto-invalidated below.
+        self._daily_historical_data_params: tuple | None = None
 
         # Initialize other periods as empty DataFrames. They will be populated on demand.
         self._weekly_historical_data: pd.DataFrame = pd.DataFrame()
@@ -2210,32 +2212,46 @@ def get_historical_data(
                 fill_nan=fill_nan,
             )
 
-        if self._daily_historical_data.empty or overwrite:
+        resolved_enforce_source = (
+            enforce_source if enforce_source is not None else self._enforce_source
+        )
+        resolved_rounding = rounding if rounding is not None else self._rounding
+        daily_historical_params = (
+            resolved_enforce_source,
+            return_column,
+            include_dividends,
+            fill_nan,
+            resolved_rounding,
+        )
+        # Auto-invalidate only data we fetched ourselves before, on a param change; never touches pre-supplied `historical`.
+        params_changed = (
+            self._daily_historical_data_params is not None
+            and self._daily_historical_data_params != daily_historical_params
+        )
+
+        if self._daily_historical_data.empty or overwrite or params_changed:
             self._daily_historical_data, self._invalid_tickers = _get_historical_data(
                 tickers=(
                     self._tickers + [self._benchmark_ticker]
                     if self._benchmark_ticker
                     else self._tickers
                 ),
                 api_key=self._api_key,
-                enforce_source=(
-                    enforce_source
-                    if enforce_source is not None
-                    else self._enforce_source
-                ),
+                enforce_source=resolved_enforce_source,
                 start=self._start_date,
                 end=self._end_date,
                 interval="1d",
                 return_column=return_column,
                 include_dividends=include_dividends,
                 fill_nan=fill_nan,
-                rounding=rounding if rounding is not None else self._rounding,
+                rounding=resolved_rounding,
                 sleep_timer=self._sleep_timer,
                 show_ticker_seperation=show_ticker_seperation,
                 show_errors=True,
                 user_subscription=self._fmp_plan,
                 cache=self._cache,
             )
+            self._daily_historical_data_params = daily_historical_params
 
             # Change the benchmark ticker name to Benchmark
             if not self._daily_historical_data.empty:
```

---

### Incident Patch 5: `3a8eee3e` (2026-08-11)
**Commit Message**: Fix commercial real estate prices returning percentage points

The only rate/growth series in economics/ and fixedincome/ that hadn't
been converted to a decimal fraction; every sibling series divides by
100.

**File**: `financetoolkit/economics/economics_controller.py` (modified, +7/-7)
```diff
@@ -6570,7 +6570,7 @@ def get_commercial_real_estate_prices(
         Returns:
             pd.DataFrame: A single-column ("United States") DataFrame of the
             quarterly Commercial Real Estate Price Index, as a year-over-year
-            percent change.
+            percent change expressed as a decimal fraction.
 
         As an example:
 
@@ -6585,12 +6585,12 @@ def get_commercial_real_estate_prices(
         Which returns:
 
         | Date       |   United States |
-        |:-----------|-----------------:|
-        | 2024-04-01 |         -10.6651 |
-        | 2024-07-01 |         -10.5779 |
-        | 2024-10-01 |          -2.7294 |
-        | 2025-01-01 |          -3.0080 |
-        | 2025-04-01 |          -7.0128 |
+        |:-----------|----------------:|
+        | 2024-04-01 |         -0.1067 |
+        | 2024-07-01 |         -0.1058 |
+        | 2024-10-01 |         -0.0273 |
+        | 2025-01-01 |         -0.0301 |
+        | 2025-04-01 |         -0.0701 |
         """
         self._require_fred_api_key()
 
```

**File**: `financetoolkit/economics/fred_model.py` (modified, +13/-4)
```diff
@@ -187,11 +187,20 @@ def get_commercial_real_estate_prices(
 
     Returns:
         pd.DataFrame: A single-column ("United States") DataFrame of quarterly commercial
-            real estate prices expressed as a year-over-year percent change (5.0 for 5%),
-            not seasonally adjusted. FRED publishes this series only as that percent
-            change, not as an index level.
+            real estate prices expressed as a year-over-year percent change, as a decimal
+            fraction (0.05 for 5%), not seasonally adjusted. FRED publishes this series
+            only as that percent change, not as an index level.
+
+    Notes:
+        FRED publishes this series in percentage points (5.0 for 5%); it is divided by
+        100 here so that every rate the Finance Toolkit returns is a decimal fraction.
     """
-    return _get_fred_series("COMREPUSQ159N", start_date, end_date, api_key)
+    commercial_real_estate_prices = _get_fred_series(
+        "COMREPUSQ159N", start_date, end_date, api_key
+    )
+
+    # FRED quotes this series in percentage points, so divide by 100 for the decimal.
+    return commercial_real_estate_prices / 100
 
 
 REAL_YIELD_SERIES: dict[str, str] = {
```

---

### Incident Patch 6: `730d3ee6` (2026-08-11)
**Commit Message**: Fix Yahoo NaN-to-zero fill and JSE/TASE currency conversion

yfinance statement cells the provider genuinely never reported were
zero-filled instead of left NaN. Separately, ZAc (Johannesburg) and ILA
(Tel Aviv) currency conversion silently produced NaN for every ratio on
those exchanges, since the generic BASE+QUOTE+"=X" ticker construction
doesn't resolve on either provider for those pairs; ZAc now routes
through FMP's native minor-unit symbol, and ILA gets an honest warning
instead of a false "converted" log line. Also drops a dead
fillna(0).astype(int) on Number of Analysts, and guards against a
malformed non-DatetimeIndex yfinance occasionally returns for an
unresolvable ticker.

**File**: `financetoolkit/currencies_model.py` (modified, +44/-11)
```diff
@@ -12,19 +12,39 @@
 
 # pylint: disable=comparison-with-itself,too-many-locals,protected-access
 
-# A handful of exchanges quote prices in a fractional unit of their currency rather than
-# in the currency itself: the London Stock Exchange quotes in pence (GBp), Johannesburg
-# in cents (ZAc) and Tel Aviv in agorot (ILA). No foreign exchange provider publishes a
-# rate against a fractional unit, so the rate retrieved for such a pair is the rate
-# against the major unit and has to be scaled by the number of minor units it contains.
-# Without that scaling a London listed company's statements end up a factor of 100 away
-# from its own share price, and every ratio that combines the two is wrong by 100.
+# LSE (GBp), JSE (ZAc), TASE (ILA) quote in a fractional unit; most providers only publish the major-unit rate.
 MINOR_CURRENCY_UNITS: dict[str, tuple[str, int]] = {
     "GBp": ("GBP", 100),
     "ZAc": ("ZAR", 100),  # codespell:ignore zar
     "ILA": ("ILS", 100),
 }
 
+# GBp resolves via the generic "=X" construction; ZAc needs this native FMP symbol; ILA has no listing on either provider.
+NATIVE_MINOR_UNIT_TICKERS: dict[tuple[str, str], str] = {
+    ("USD", "ZAc"): "USDZAC",
+}
+
+
+def get_fx_ticker(base_currency: str, quote_currency: str) -> str:
+    """
+    Returns the ticker to request historical exchange rate data for from a data
+    provider, for a given currency pair.
+
+    This is usually the generic BASE+QUOTE+"=X" convention (e.g. "USDGBp=X"), but a
+    handful of pairs are only listed under a provider-specific symbol instead, see
+    NATIVE_MINOR_UNIT_TICKERS.
+
+    Args:
+        base_currency (str): the currency the value being converted is expressed in.
+        quote_currency (str): the currency the value is being converted to.
+
+    Returns:
+        str: the ticker symbol to request historical exchange rate data for.
+    """
+    return NATIVE_MINOR_UNIT_TICKERS.get(
+        (base_currency, quote_currency), f"{base_currency}{quote_currency}=X"
+    )
+
 
 def get_minor_unit_factor(base_currency: str, quote_currency: str) -> float:
     """
@@ -33,16 +53,22 @@ def get_minor_unit_factor(base_currency: str, quote_currency: str) -> float:
 
     An exchange rate is only ever published between major units, so converting USD
     reported statements onto a price quoted in pence needs the USD/GBP rate multiplied
-    by the 100 pence in a pound.
+    by the 100 pence in a pound. Pairs with a native minor-unit listing (see
+    NATIVE_MINOR_UNIT_TICKERS) are the exception: the retrieved rate is already
+    expressed in the fractional unit, so no further scaling is applied.
 
     Args:
         base_currency (str): the currency the value being converted is expressed in.
         quote_currency (str): the currency the value is being converted to.
 
     Returns:
         float: the factor to multiply the exchange rate by. 1.0 when neither side of
-        the pair is quoted in a fractional unit.
+        the pair is quoted in a fractional unit, or when the pair is already natively
+        quoted in it.
     """
+    if (base_currency, quote_currency) in NATIVE_MINOR_UNIT_TICKERS:
+        return 1.0
+
     base_factor = MINOR_CURRENCY_UNITS.get(base_currency, ("", 1))[1]
     quote_factor = MINOR_CURRENCY_UNITS.get(quote_currency, ("", 1))[1]
 
@@ -174,6 +200,14 @@ def convert_currencies(
                         base_currency, quote_currency
                     )
 
+                    rates = exchange_rate_data.loc[periods, currency]
+
+                    if rates.isna().all():
+                        # Column exists (placeholder from a partly-failed batch fetch) but no provider published a rate.
+                        raise ValueError(
+                            f"No exchange rate data available for {currency}"
+                        )
+
                     if items_not_to_adjust is not None:
                         items_to_adjust = [
                             item
@@ -189,8 +223,7
```

**File**: `financetoolkit/fmp_model.py` (modified, +2/-4)
```diff
@@ -1061,13 +1061,11 @@ def worker(ticker, analyst_estimates_dict):
         analyst_estimates_total = pd.concat(analyst_estimates_dict, axis=0)
 
         try:
+            # "Number of Analysts" stays float64 (not int) so an unreported count stays NaN, not 0.
             analyst_estimates_total = analyst_estimates_total.astype(np.float64)
-            analyst_estimates_total.loc[:, "Number of Analysts", :].fillna(0).astype(
-                int
-            )
         except ValueError as error:
             logger.error(
-                "Not able to convert DataFrame to float64 and int due to %s. This could result in"
+                "Not able to convert DataFrame to float64 due to %s. This could result in"
                 "issues when values are zero and is predominantly relevant for "
                 "ratio calculations.",
                 error,
```

**File**: `financetoolkit/historical_model.py` (modified, +4/-0)
```diff
@@ -73,6 +73,10 @@ def _first_observed_date(data: pd.DataFrame) -> pd.Timestamp | None:
         data.index.to_timestamp() if hasattr(data.index, "to_timestamp") else data.index
     )
 
+    if not isinstance(index, pd.DatetimeIndex):
+        # yfinance can return a non-empty, all-NaN frame with a RangeIndex for an unresolvable ticker.
+        return None
+
     return index.min()
 
 
```

**File**: `financetoolkit/toolkit_controller.py` (modified, +44/-1)
```diff
@@ -3320,8 +3320,16 @@ def get_exchange_rates(
 
         if self._daily_exchange_rate_data.empty or overwrite:
             if currencies_to_collect_data_for:
+                # A handful of pairs need a different ticker than the generic BASE+QUOTE+"=X" (see currencies_model.NATIVE_MINOR_UNIT_TICKERS).
+                fx_ticker_map = {
+                    currency: currencies_model.get_fx_ticker(
+                        currency[:3], currency[3:6]
+                    )
+                    for currency in currencies_to_collect_data_for
+                }
+
                 self._daily_exchange_rate_data, _ = _get_historical_data(
-                    tickers=currencies_to_collect_data_for,
+                    tickers=list(fx_ticker_map.values()),
                     api_key=self._api_key,
                     enforce_source=self._enforce_source,
                     start=self._lookback_start_date,
@@ -3337,6 +3345,41 @@ def get_exchange_rates(
                     user_subscription=self._fmp_plan,
                     cache=self._cache,
                 )
+
+                if self._daily_exchange_rate_data.empty:
+                    # None of the requested pairs resolved on either provider; a NaN-filled placeholder keeps a valid date index so conversion can warn per ticker instead of failing outright.
+                    self._daily_exchange_rate_data = pd.DataFrame(
+                        data=float("nan"),
+                        index=pd.PeriodIndex(
+                            pd.date_range(
+                                start=self._lookback_start_date,
+                                end=self._end_date,
+                                freq="D",
+                            )
+                        ),
+                        columns=pd.MultiIndex.from_product(
+                            [
+                                [
+                                    "Open",
+                                    "High",
+                                    "Low",
+                                    "Close",
+                                    "Adj Close",
+                                    "Volume",
+                                    "Return",
+                                    "Cumulative Return",
+                                ],
+                                currencies_to_collect_data_for,
+                            ]
+                        ),
+                    )
+                else:
+                    # Map the requested ticker symbols back onto the canonical currency identifiers used everywhere else.
+                    self._daily_exchange_rate_data = (
+                        self._daily_exchange_rate_data.rename(
+                            columns={v: k for k, v in fx_ticker_map.items()}, level=1
+                        )
+                    )
             else:
                 # A placeholder DataFrame for when no conversion is needed.
                 self._daily_exchange_rate_data = pd.DataFrame(
```

**File**: `financetoolkit/yfinance_model.py` (modified, +2/-2)
```diff
@@ -120,9 +120,9 @@ def get_financial_statement(
             :, ~financial_statement.columns.duplicated()
         ]
 
-    # Check for NaN values and fill them with 0
+    # Left as NaN, not filled with 0, matching the Toolkit-wide convention for unreported line items.
     if financial_statement.isna().to_numpy().any():
-        financial_statement = financial_statement.infer_objects(copy=False).fillna(0)
+        financial_statement = financial_statement.infer_objects(copy=False)
 
     return financial_statement
 
```

---

### Incident Patch 7: `93aef655` (2026-08-11)
**Commit Message**: Fix Parabolic SAR/TRIMA math and Greeks docstring drift

Parabolic SAR was missing TA-Lib's reversal clamp, letting the stop sit
on the wrong side of price right after a trend flip. TRIMA used the same
sub-window length for both smoothing passes regardless of window parity,
which is only correct for odd windows. Also brought several Greeks and
Black-Scholes docstrings back in line with their actual signatures
(missing dividend_yield/put_option params, stale time_to_expiry naming).

**File**: `financetoolkit/options/black_scholes_model.py` (modified, +1/-3)
```diff
@@ -77,9 +77,7 @@ def get_d2(
     Calculate d2 in the Black-Scholes model for option pricing.
 
     Args:
-        stock_price (float or pd.Series): The current stock price.
-        strike_price (float or pd.Series): The option's strike price.
-        risk_free_rate (float or pd.Series): The risk-free interest rate.
+        d1 (float or pd.Series): The d1 value, as calculated by get_d1.
         volatility (float or pd.Series): The volatility of the stock.
         time_to_expiration (float or pd.Series): The time to expiration of the option.
 
```

**File**: `financetoolkit/options/greeks_model.py` (modified, +11/-8)
```diff
@@ -23,9 +23,11 @@ def get_delta(
     Args:
         stock_price (float): Series of stock prices.
         strike_price (float): Option strike price.
-        time_to_expiry (float): Time to option expiry (in years).
+        time_to_expiration (float): Time to option expiry (in years).
         risk_free_rate (float): Risk-free interest rate (annualized).
         volatility (float): Volatility of the underlying stock.
+        dividend_yield (float): Dividend yield (annualized). Defaults to 0.
+        put_option (bool): True if it's a put option, False for a call option.
 
     Returns:
         float: Option Delta values.
@@ -63,7 +65,7 @@ def get_dual_delta(
     Args:
         stock_price (float): Current stock price.
         strike_price (float): Option strike price.
-        time_to_expiry (float): Time to option expiry (in years).
+        time_to_expiration (float): Time to option expiry (in years).
         risk_free_rate (float): Risk-free interest rate (annualized).
         volatility (float): Volatility of the underlying stock.
         dividend_yield (float): Dividend yield (annualized). Defaults to 0.
@@ -111,6 +113,7 @@ def get_vega(
         time_to_expiration (float): Time to option expiry (in years).
         risk_free_rate (float): Risk-free interest rate (annualized).
         volatility (float): Volatility of the underlying stock.
+        dividend_yield (float): Dividend yield (annualized). Defaults to 0.
 
     Returns:
         float: Option Vega value.
@@ -348,6 +351,8 @@ def get_lambda(
         time_to_expiration (float): Time to option expiry (in years).
         risk_free_rate (float): Risk-free interest rate (annualized).
         volatility (float): Volatility of the underlying stock.
+        dividend_yield (float): Dividend yield (annualized). Defaults to 0.
+        put_option (bool): True if it's a put option, False for a call option.
 
     Returns:
         float: Option Lambda value.
@@ -428,11 +433,10 @@ def get_dual_gamma(
     Args:
         stock_price (float): Current stock price.
         strike_price (float): Option strike price.
-        time_to_expiry (float): Time to option expiry (in years).
+        time_to_expiration (float): Time to option expiry (in years).
         risk_free_rate (float): Risk-free interest rate (annualized).
         volatility (float): Volatility of the underlying stock.
         dividend_yield (float): Dividend yield (annualized). Defaults to 0.
-        put_option (bool): True if it's a put option, False for a call option.
 
     Returns:
         float: Dual Gamma value.
@@ -476,7 +480,6 @@ def get_vanna(
         risk_free_rate (float): Risk-free interest rate (annualized).
         volatility (float): Volatility of the underlying stock.
         dividend_yield (float): Dividend yield (annualized). Default is 0.0.
-        put_option (bool): True if it's a put option, False for a call option.
 
     Returns:
         float: Vanna value.
@@ -823,7 +826,7 @@ def get_zomma(
     Args:
         stock_price (float): Current stock price.
         strike_price (float): Option strike price.
-        time_to_expiry (float): Time to option expiry (in years).
+        time_to_expiration (float): Time to option expiry (in years).
         risk_free_rate (float): Risk-free interest rate (annualized).
         volatility (float): Volatility of the underlying stock.
         dividend_yield (float): Dividend yield (annualized). Defaults to 0.
@@ -865,7 +868,7 @@ def get_color(
     Args:
         stock_price (float): Current stock price.
         strike_price (float): Option strike price.
-        time_to_expiry (float): Time to option expiry (in years).
+        time_to_expiration (float): Time to option expiry (in years).
         risk_free_rate (float): Risk-free interest rate (annualized).
         volatility (float): Volatility of the underlying stock.
         dividend_yield (float): Dividend yield (annualized). Defaults to 0.
@@ -937,7 +940,7 @@ def get_u
```

**File**: `financetoolkit/technicals/overlap_model.py` (modified, +17/-7)
```diff
@@ -151,8 +151,10 @@ def get_triangular_moving_average(prices: pd.Series, window: int) -> pd.Series:
 
     The formula is a follows:
 
-    - Sub-window Length = round((window + 1) / 2)
-    - TRIMA = SMA(SMA(Close, Sub-window Length), Sub-window Length)
+    - For an odd window: Sub-window Length = (window + 1) / 2, applied for both passes.
+    - For an even window: the two passes use different sub-window lengths, window / 2
+      and window / 2 + 1 (matching TA-Lib's TRIMA convention).
+    - TRIMA = SMA(SMA(Close, Sub-window Length 1), Sub-window Length 2)
 
     Also known as: TRIMA.
 
@@ -166,10 +168,14 @@ def get_triangular_moving_average(prices: pd.Series, window: int) -> pd.Series:
     Returns:
         pd.Series: TRIMA values.
     """
-    sub_window = max(round((window + 1) / 2), 1)
+    if window % 2 == 1:
+        sub_window_first = sub_window_second = max((window + 1) // 2, 1)
+    else:
+        sub_window_first = max(window // 2, 1)
+        sub_window_second = sub_window_first + 1
 
-    first_pass = prices.rolling(window=sub_window, min_periods=1).mean()
-    tri_ma = first_pass.rolling(window=sub_window, min_periods=1).mean()
+    first_pass = prices.rolling(window=sub_window_first, min_periods=1).mean()
+    tri_ma = first_pass.rolling(window=sub_window_second, min_periods=1).mean()
 
     return tri_ma
 
@@ -430,7 +436,9 @@ def get_parabolic_sar(
 
             if prices_low.iloc[i] < current_sar:
                 uptrend = False
-                current_sar = extreme_point
+                current_sar = max(
+                    extreme_point, prices_high.iloc[i], prices_high.iloc[i - 1]
+                )
                 extreme_point = prices_low.iloc[i]
                 af = af_start
             elif prices_high.iloc[i] > extreme_point:
@@ -444,7 +452,9 @@ def get_parabolic_sar(
 
             if prices_high.iloc[i] > current_sar:
                 uptrend = True
-                current_sar = extreme_point
+                current_sar = min(
+                    extreme_point, prices_low.iloc[i], prices_low.iloc[i - 1]
+                )
                 extreme_point = prices_high.iloc[i]
                 af = af_start
             elif prices_low.iloc[i] < extreme_point:
```

**File**: `financetoolkit/technicals/technicals_controller.py` (modified, +4/-2)
```diff
@@ -5163,8 +5163,10 @@ def get_triangular_moving_average(
 
         The formula is a follows:
 
-        - Sub-window Length = round((Window + 1) / 2)
-        - TMA = SMA(SMA(Close, Sub-window Length), Sub-window Length)
+        - For an odd window: Sub-window Length = (Window + 1) / 2, applied for both passes.
+        - For an even window: the two passes use different sub-window lengths, Window / 2
+          and Window / 2 + 1 (matching TA-Lib's TRIMA convention).
+        - TMA = SMA(SMA(Close, Sub-window Length 1), Sub-window Length 2)
 
         Also known as: TMA, triangular MA.
 
```

**File**: `tests/technical/csv/test_technical_controller/test_get_parabolic_sar.csv` (modified, +3/-3)
```diff
@@ -245,7 +245,7 @@ Date,AAPL,MSFT,Benchmark
 2020-12-16,120.0608,208.4788,364.47
 2020-12-17,121.2241,208.944,365.6742
 2020-12-18,122.561,209.6608,372.46
-2020-12-21,129.58,210.3345,367.02
+2020-12-21,129.58,210.3345,362.03
 2020-12-22,123.45,211.4278,362.03
 2020-12-23,123.45,212.848,362.03
 2020-12-24,123.6692,214.1262,362.3586
@@ -328,12 +328,12 @@ Date,AAPL,MSFT,Benchmark
 2021-04-19,128.2776,251.5806,407.2838
 2021-04-20,129.4284,253.5605,409.4091
 2021-04-21,130.5267,255.1444,410.59
-2021-04-22,131.3,261.48,410.59
+2021-04-22,131.3,261.78,410.59
 2021-04-23,131.3,261.78,411.13
 2021-04-26,131.41,255.64,411.13
 2021-04-27,132.1516,255.776,412.554
 2021-04-28,132.7597,263.19,413.6932
-2021-04-29,135.53,263.19,414.7566
+2021-04-29,137.07,263.19,414.7566
 2021-04-30,137.07,262.6224,415.9492
 2021-05-03,137.07,262.0775,416.34
 2021-05-04,136.83,261.5544,420.72
```

---

### Incident Patch 8: `2a15854e` (2026-08-11)
**Commit Message**: Fix STARR/Appraisal ratio timeframe mixing and GARCH convergence checks

get_starr_ratio and get_appraisal_ratio's non-rolling path divided a
period-scale numerator by a daily-scale denominator with no rescaling,
inflating both by roughly sqrt(252). GARCH/GJR/EGARCH fits never checked
whether the optimizer actually moved off its starting guess, so a stuck
fit was silently returned as if converged; now retries once and falls
back to NaN.

**File**: `financetoolkit/performance/performance_controller.py` (modified, +12/-13)
```diff
@@ -3876,14 +3876,13 @@ def get_appraisal_ratio(
 
         Which returns:
 
-        | Date   |    AAPL |     TSLA |
-        |:-------|--------:|---------:|
-        | 2021   |  0.2731 |   0.2656 |
-        | 2022   | -1.4762 |  -9.3885 |
-        | 2023   | 22.7573 |  16.6849 |
-        | 2024   |  5.353  |   2.7161 |
-        | 2025   | -8.9932 |  -7.9343 |
-        | 2026   |  1.7362 | -22.8876 |
+        | Date   |    AAPL |    TSLA |
+        |:-------|--------:|--------:|
+        | 2022   | -0.0946 | -0.5928 |
+        | 2023   |  1.4422 |  1.0563 |
+        | 2024   |  0.3371 |  0.1716 |
+        | 2025   | -0.5687 | -0.5019 |
+        | 2026   |  0.1411 | -1.8633 |
         """
         period = period if period else "quarterly" if self._quarterly else "yearly"
 
@@ -4194,11 +4193,11 @@ def get_starr_ratio(
 
         | Date   |    AAPL |    TSLA |
         |:-------|--------:|--------:|
-        | 2022   | -6.7449 | -7.54   |
-        | 2023   | 17.0093 | 13.7817 |
-        | 2024   |  8.838  |  7.4715 |
-        | 2025   |  1.0706 |  0.8767 |
-        | 2026   |  2.1448 | -4.6751 |
+        | 2022   | -0.4203 | -0.4759 |
+        | 2023   |  1.0763 |  0.8716 |
+        | 2024   |  0.5566 |  0.4707 |
+        | 2025   |  0.0677 |  0.0554 |
+        | 2026   |  0.1743 | -0.3805 |
         """
         period = period if period else "quarterly" if self._quarterly else "yearly"
 
```

**File**: `financetoolkit/performance/performance_model.py` (modified, +40/-3)
```diff
@@ -2126,7 +2126,8 @@ def get_appraisal_ratio(
         over the estimation window used for `jensens_alpha`, from which the idiosyncratic
         (residual) standard deviation is derived. When this has a "within period" Multi
         Index (period, date), the standard deviation is computed separately within each
-        period; otherwise it is computed over the entire series at once.
+        period and rescaled to the period frequency (see Notes below); otherwise it is
+        computed over the entire series at once.
 
     Returns:
         pd.Series | pd.DataFrame: Appraisal Ratio values.
@@ -2136,9 +2137,23 @@ def get_appraisal_ratio(
     `get_jensens_alpha` under the hood on already-excess returns (i.e. with
     `risk_free_rate` set to 0), so it reuses the exact same CAPM regression machinery as
     `jensens_alpha` itself rather than reimplementing it.
+    - When `capm_residuals` has a "within period" (period, date) Multi Index, the residuals
+    themselves are pointwise (e.g. daily), so their per-period standard deviation is a
+    daily-scale figure. `jensens_alpha`, however, is always period-scale (e.g. yearly).
+    Dividing a period-scale Alpha by a daily-scale standard deviation would silently
+    inflate the ratio by roughly the square root of the number of observations in the
+    period — the same timeframe-mixing mistake the Sharpe ratio guards against by
+    de-annualizing the risk-free rate first. To keep both sides on the same frequency, the
+    per-period residual standard deviation is scaled up by multiplying it with the square
+    root of the number of residual observations in that period, mirroring how
+    `financetoolkit.risk.risk_model.get_volatility` scales daily volatility to a period.
     """
     if capm_residuals.index.nlevels == MULTI_PERIOD_INDEX_LEVELS:
         residual_standard_deviation = capm_residuals.groupby(level=0).std()
+        observations_per_period = capm_residuals.groupby(level=0).size()
+        residual_standard_deviation = residual_standard_deviation.mul(
+            np.sqrt(observations_per_period), axis=0
+        )
     else:
         residual_standard_deviation = capm_residuals.std()
 
@@ -2355,6 +2370,17 @@ def get_starr_ratio(
     one value per period) rather than a raw daily series if a mean excess return per period
     is intended — this function does not average `excess_returns` itself.
 
+    When `returns` has a "within period" (period, date) Multi Index, CVaR is computed from
+    the daily observations within each period (see `get_cvar_historic`), which makes it a
+    daily-scale tail-risk measure. Dividing a period-scale `excess_returns` (e.g. a yearly
+    excess return) by that daily-scale CVaR would silently inflate the ratio by roughly the
+    square root of the number of trading days in the period — the same timeframe-mixing
+    mistake the Sharpe ratio guards against by de-annualizing the risk-free rate before
+    computing daily excess returns. To keep both sides of the ratio on the same frequency,
+    the CVaR is instead scaled up to the period frequency by multiplying it with the square
+    root of the number of return observations within that period, mirroring how
+    `financetoolkit.risk.risk_model.get_volatility` scales daily volatility to a period.
+
     Also known as: Stable Tail Adjusted Return Ratio, Conditional Sharpe Ratio.
 
     For more information about the method, see the following paper:
@@ -2364,9 +2390,12 @@ def get_starr_ratio(
 
     Args:
         excess_returns (pd.Series | pd.DataFrame): A Series or DataFrame of returns with
-        the risk-free rate subtracted.
+        the risk-free rate subtracted, already aggregated to one value per period (see
+        Notes above).
         returns (pd.Series | pd.DataFrame): The corresponding raw (non-excess) returns,
-        from which the CVaR denominator is computed.
+        from which the CVaR denominator is computed. When this has a "within period" Multi
+    
```

**File**: `financetoolkit/risk/garch_model.py` (modified, +76/-12)
```diff
@@ -4,11 +4,73 @@
 import pandas as pd
 from scipy import optimize
 
+from financetoolkit.utilities.logger_model import get_logger
+
+logger = get_logger()
+
 ALPHA_CONSTRAINT = 0.5
 
 # Two levels when a 'within period' index nests days inside a period (2020Q1).
 MULTI_PERIOD_INDEX_LEVELS = 2
 
+# Fallback seed used for a single retry when the primary fit gets stuck at x0.
+RETRY_SEED = 7
+
+
+def _fit_dual_annealing(
+    wrapper_func,
+    bounds: list[tuple[float, float]],
+    initial_guess: list[float],
+    model_name: str,
+) -> np.ndarray:
+    """
+    Runs `scipy.optimize.dual_annealing` for a GARCH-family log-likelihood and verifies
+    the fit actually moved rather than trusting the returned parameters blindly.
+
+    `result.success` alone is not a reliable guard here: `dual_annealing` reports success
+    (with message "Maximum number of iteration reached") even when the local search never
+    improves on the literal `x0` starting point, so an unchecked `result.x` can silently
+    return an unfitted guess as if it were a real estimate. This is checked for explicitly
+    by comparing `result.x` against `x0`. If the first attempt fails (either
+    `result.success` is False, or the result is still exactly `x0`), it is retried once
+    with a different seed (a stuck run is usually just an unlucky annealing schedule rather
+    than a genuinely unfittable series); if the retry also fails, a warning is logged and
+    NaN weights are returned instead of the unfitted starting point.
+
+    Args:
+        wrapper_func (Callable): The (constrained) negative log-likelihood to minimize.
+        bounds (list[tuple[float, float]]): The parameter bounds passed to `dual_annealing`.
+        initial_guess (list[float]): The starting point (`x0`) for the first attempt.
+        model_name (str): The model name to include in the warning message if both
+        attempts fail.
+
+    Returns:
+        np.ndarray: The fitted weights, or an array of NaN (same length as
+        `initial_guess`) if the optimizer did not move off `x0` on either attempt.
+    """
+    x0 = np.asarray(initial_guess, dtype=float)
+
+    def _stuck_at_start(result) -> bool:
+        return (not result.success) or np.array_equal(np.asarray(result.x), x0)
+
+    result = optimize.dual_annealing(wrapper_func, bounds, x0=initial_guess, seed=42)
+
+    if _stuck_at_start(result):
+        result = optimize.dual_annealing(
+            wrapper_func, bounds, x0=initial_guess, seed=RETRY_SEED
+        )
+
+    if _stuck_at_start(result):
+        logger.warning(
+            "The %s optimization did not converge after two attempts (%s) and "
+            "returned the unfitted starting point. Returning NaN weights instead.",
+            model_name,
+            result.message,
+        )
+        return np.full(len(initial_guess), np.nan)
+
+    return result.x
+
 
 def garch_log_maximization(
     weights: list, returns: np.ndarray, t: int, p: int = 1, q: int = 1
@@ -64,7 +126,9 @@ def get_garch_weights(
         q: (int): Number of sigma_t datapoints to use. Note that currently only q=1 is supported.
 
     Returns:
-        list: A list with the weights
+        list: A list with the weights [omega, alpha, beta]. If `dual_annealing` fails to
+        converge even after a retry with a different seed, this is `[nan, nan, nan]`
+        instead of the unfitted starting point (see `_fit_dual_annealing`).
     """
     if isinstance(returns, pd.DataFrame):
         returns = returns.iloc[:, 0].to_numpy()
@@ -93,9 +157,7 @@ def wrapper_func(parameters):
         return garch_log_maximization(parameters, returns, t, p, q)
 
     # Seeded so fitted parameters are reproducible across runs.
-    result = optimize.dual_annealing(wrapper_func, bounds, x0=initial_guess, seed=42)
-
-    return result.x
+    return _fit_dual_annealing(wrapper_func, bounds, initial_guess, "GARCH")
 
 
 def get_garch(
@@ -337,7 +399,10 @@ def get_gjr_garch_weights(
         q: (int): 
```

**File**: `financetoolkit/risk/risk_controller.py` (modified, +5/-5)
```diff
@@ -4997,11 +4997,11 @@ def get_hurst_exponent(
 
         Which returns:
 
-        |           |       0 |
-        |:----------|--------:|
-        | AMZN      | -0.0082 |
-        | TSLA      |  0.0099 |
-        | Benchmark | -0.0077 |
+        |           |      0 |
+        |:----------|-------:|
+        | AMZN      | 0.4553 |
+        | TSLA      | 0.5122 |
+        | Benchmark | 0.4515 |
         """
         # The estimator regresses the dispersion of lagged differences on the lag, which
         # only identifies self-affinity on a level series. Feeding it returns, which are
```

**File**: `tests/performance/csv/test_performance_controller/test_collect_all_metrics.csv` (modified, +3/-3)
```diff
@@ -1,6 +1,6 @@
 ,Alpha,Alpha,Beta,Beta,CAPM,CAPM,Jensen's Alpha,Jensen's Alpha,Treynor Ratio,Treynor Ratio,Sharpe Ratio,Sharpe Ratio,Sortino Ratio,Sortino Ratio,Ulcer Performance Index,Ulcer Performance Index,Calmar Ratio,Calmar Ratio,Sterling Ratio,Sterling Ratio,Burke Ratio,Burke Ratio,Omega Ratio,Omega Ratio,Kappa Ratio,Kappa Ratio,Gain to Pain Ratio,Gain to Pain Ratio,Win Rate,Win Rate,Upside Capture Ratio,Upside Capture Ratio,Downside Capture Ratio,Downside Capture Ratio,M2 Ratio,M2 Ratio,Tracking Error,Tracking Error,Information Ratio,Information Ratio,Appraisal Ratio,Appraisal Ratio,STARR Ratio,STARR Ratio,Rachev Ratio,Rachev Ratio,Returns,Returns,Returns,Excess Return,Excess Return,Excess Return
 ,AAPL,MSFT,AAPL,MSFT,AAPL,MSFT,AAPL,MSFT,AAPL,MSFT,AAPL,MSFT,AAPL,MSFT,AAPL,MSFT,AAPL,MSFT,AAPL,MSFT,AAPL,MSFT,AAPL,MSFT,AAPL,MSFT,AAPL,MSFT,AAPL,MSFT,AAPL,MSFT,AAPL,MSFT,AAPL,MSFT,AAPL,MSFT,AAPL,MSFT,AAPL,MSFT,AAPL,MSFT,AAPL,MSFT,AAPL,MSFT,Benchmark,AAPL,MSFT,Benchmark
-2020,0.6399,0.242,1.1579,1.1486,0.2108,0.2092,0.6124,0.2161,0.703,0.3623,0.0944,0.0632,0.1416,0.0926,12.1343,7.1593,2.6202,1.5172,4.2417,2.4987,0.4637,0.3053,1.3178,1.2113,0.0938,0.059,0.3178,0.2113,0.5138,0.5059,1.3011,1.2028,1.0333,1.088,0.592,0.3259,0.0168,0.0138,0.1146,0.0649,37.2652,16.1067,12.0414,6.5831,1.0649,1.0946,0.824,0.4244,0.183,0.8148,0.4152,0.1738
-2021,0.0592,0.2375,1.3248,1.1611,0.3757,0.3311,-0.0292,0.1937,0.2502,0.439,0.0789,0.1286,0.1178,0.203,8.88,19.9998,1.8617,5.9892,2.0672,4.1233,0.271,1.0718,1.2401,1.4202,0.0865,0.1464,0.2401,0.4202,0.4921,0.5119,1.3815,1.2678,1.4294,1.0961,0.1866,0.3296,0.0118,0.0093,0.0228,0.0778,-2.5381,20.9279,9.8271,18.3701,0.9964,1.0552,0.3462,0.5246,0.2871,0.3311,0.5095,0.272
-2022,-0.0822,-0.0984,1.3022,1.2789,-0.2485,-0.2433,-0.0155,-0.0369,-0.2325,-0.2494,-0.0482,-0.0531,-0.0676,-0.0732,-4.5186,-5.0062,-0.8706,-0.7871,-1.0675,-0.9526,-0.1173,-0.097,0.8943,0.8832,-0.052,-0.0554,-0.1057,-0.1168,0.4781,0.4582,1.3097,1.3061,1.3187,1.329,-0.1669,-0.1802,0.0115,0.0115,-0.025,-0.0334,-1.4801,-3.4639,-6.746,-6.899,1.079,1.02,-0.2638,-0.2807,-0.1816,-0.3026,-0.3195,-0.2204
+2020,0.6399,0.242,1.1579,1.1486,0.2108,0.2092,0.6124,0.2161,0.703,0.3623,0.0944,0.0632,0.1416,0.0926,12.1343,7.1593,2.6202,1.5172,4.2417,2.4987,0.4637,0.3053,1.3178,1.2113,0.0938,0.059,0.3178,0.2113,0.5138,0.5059,1.3011,1.2028,1.0333,1.088,0.592,0.3259,0.0168,0.0138,0.1146,0.0649,2.3428,1.0126,0.757,0.4139,1.0649,1.0946,0.824,0.4244,0.183,0.8148,0.4152,0.1738
+2021,0.0592,0.2375,1.3248,1.1611,0.3757,0.3311,-0.0292,0.1937,0.2502,0.439,0.0789,0.1286,0.1178,0.203,8.88,19.9998,1.8617,5.9892,2.0672,4.1233,0.271,1.0718,1.2401,1.4202,0.0865,0.1464,0.2401,0.4202,0.4921,0.5119,1.3815,1.2678,1.4294,1.0961,0.1866,0.3296,0.0118,0.0093,0.0228,0.0778,-0.1599,1.3183,0.619,1.1572,0.9964,1.0552,0.3462,0.5246,0.2871,0.3311,0.5095,0.272
+2022,-0.0822,-0.0984,1.3022,1.2789,-0.2485,-0.2433,-0.0155,-0.0369,-0.2325,-0.2494,-0.0482,-0.0531,-0.0676,-0.0732,-4.5186,-5.0062,-0.8706,-0.7871,-1.0675,-0.9526,-0.1173,-0.097,0.8943,0.8832,-0.052,-0.0554,-0.1057,-0.1168,0.4781,0.4582,1.3097,1.3061,1.3187,1.329,-0.1669,-0.1802,0.0115,0.0115,-0.025,-0.0334,-0.0934,-0.2186,-0.4258,-0.4355,1.079,1.02,-0.2638,-0.2807,-0.1816,-0.3026,-0.3195,-0.2204
 2019,,,,,,,,,,,,,-1.0,-1.0,,,,,,,,,,,-1.0,-1.0,,,0.0,0.0,,,,,,,,,,,,,,,,,0.0,0.0,0.0,-0.0192,-0.0192,-0.0192
```

---

### Incident Patch 9: `d726d3f2` (2026-08-11)
**Commit Message**: Fix trailing not forwarded, NCAV, asset coverage and Piotroski/Gordon growth bugs

collect_efficiency/profitability/valuation_ratios silently dropped the
trailing kwarg on three methods; get_price_to_cash_flow_ratio's numerator
wasn't rolled up to match its denominator; get_net_current_asset_value
computed Working Capital instead of Graham's NCAV; asset coverage
double-subtracted short-term debt; the Gordon Growth Model skipped the
final period's actual dividend; and Piotroski's NaN-vs-zero mask now
covers all nine criteria's inputs, including the previous period the five
change-based criteria compare against.

**File**: `financetoolkit/models/models_controller.py` (modified, +56/-26)
```diff
@@ -1939,7 +1939,6 @@ def get_gorden_growth_model(
         ]["Dividends"]
 
         gorden_growth_model: dict[str, dict[str, float]] = {}
-        previous_period = dividends_per_share.index[0]
 
         periods = pd.period_range(
             start=dividends_per_share.index[0],
@@ -1949,22 +1948,20 @@ def get_gorden_growth_model(
 
         for ticker in self._tickers:
             gorden_growth_model[ticker] = {}
+            last_known_period = dividends_per_share.index[0]
 
             for period in periods:
-                previous_period_location = periods.get_loc(previous_period)
-                period_location = periods.get_loc(period)
-                distance = period_location - previous_period_location
-
-                if (period_location + 1) < len(dividends_per_share.index):
-                    previous_period = period
-
-                dividends_per_share_value = (
-                    dividends_per_share.loc[period, ticker]
-                    if period != dividends_per_share.index[-1]
-                    and period in dividends_per_share.index
-                    else dividends_per_share.loc[previous_period, ticker]
-                    * (1 + growth_rate) ** distance
-                )
+                if period in dividends_per_share.index:
+                    dividends_per_share_value = dividends_per_share.loc[period, ticker]
+                    last_known_period = period
+                else:
+                    distance = periods.get_loc(period) - periods.get_loc(
+                        last_known_period
+                    )
+                    dividends_per_share_value = (
+                        dividends_per_share.loc[last_known_period, ticker]
+                        * (1 + growth_rate) ** distance
+                    )
 
                 gorden_growth_model[ticker][period] = (
                     intrinsic_model.get_gorden_growth_model(
@@ -2782,21 +2779,54 @@ def get_piotroski_score(
         # Every criterion is a boolean comparison, so a period for which the statements have
         # not been reported yet compares NaN against a number, evaluates to False and scores
         # a perfect zero — the worst possible F-Score — rather than being reported as missing.
-        # Mask those periods out explicitly before dropping them.
-        reported = (
-            total_assets.notna() & net_income.notna() & operating_cashflow.notna()
-        )
+        # Mask those periods out; must cover every field feeding any of the nine criteria, not just ROA/CFO/accruals.
         reported = (
-            reported.reindex(
-                index=piotroski_results.index.get_level_values(0),
-                columns=piotroski_results.columns,
+            total_assets.notna()
+            & net_income.notna()
+            & operating_cashflow.notna()
+            & long_term_debt.notna()
+            & current_assets.notna()
+            & current_liabilities.notna()
+            & revenue.notna()
+            & cost_of_goods_sold.notna()
+            & common_stock_issued.notna()
+        )
+
+        # Five criteria compare against the previous period; require it reported too, or NaN > x resolves False.
+        reported_previous_period = reported.shift(1, axis=1)
+        change_based_criteria = {
+            "Change in Return on Assets Criteria",
+            "Change in Leverage Criteria",
+            "Change in Current Ratio Criteria",
+            "Gross Margin Criteria",
+            "Asset Turnover Criteria",
+            "Piotroski Score",
+        }
+
+        def _broadcast(mask: pd.DataFrame) -> pd.DataFrame:
+            return (
+                mask.reindex(
+                    index=piotroski_results.index.get_level_values(0),
+                    columns=piotroski_results.columns,
+                )
+                .fillna(False)
+                .astype(bool)
+                .set_axis(piotroski_results.index)
             )
-            .fillna(False)
-            .
```

**File**: `financetoolkit/ratios/profitability_model.py` (modified, +5/-1)
```diff
@@ -317,7 +317,11 @@ def get_return_on_tangible_assets(
     formulation in that it also nets out total liabilities, so the denominator
     reflects the tangible equity actually backing the business rather than the
     gross tangible asset base. Compare `get_tangible_asset_value` in the valuation
-    module, which computes the same net tangible asset base without averaging.
+    module, which is a related but distinct net tangible asset base: it excludes
+    Goodwill specifically, whereas this function excludes Intangible Assets, and
+    Goodwill and Intangible Assets are two separate balance-sheet line items that
+    can differ substantially (e.g. one is a subset of, or need not equal, the
+    other), so the two functions' denominators are not interchangeable.
 
     The formula is as follows:
 
```

**File**: `financetoolkit/ratios/ratios_controller.py` (modified, +49/-57)
```diff
@@ -224,7 +224,7 @@ def collect_all_ratios(
         | EV-to-EBITDA              | 25.7524      | 17.0831      | 24.9432      | 29.3152      | 28.7093      |
         | EV-to-Operating-Cash-Flow | 29.7611      | 18.2565      | 28.3904      | 33.3825      | 37.2762      |
         | Tangible Asset Value      |  6.309e+10   |  5.0672e+10  |  6.2146e+10  |  5.695e+10   |  7.3733e+10  |
-        | Net Current Asset Value   |  9.355e+09   | -1.8577e+10  | -1.742e+09   | -2.3405e+10  | -1.7674e+10  |
+        | Net Current Asset Value   | -1.5308e+11  | -1.6668e+11  | -1.4687e+11  | -1.5504e+11  | -1.3755e+11  |
         """
         if not days:
             days = 365 / 4 if self._quarterly else 365
@@ -628,10 +628,10 @@ def collect_efficiency_ratios(
             trailing=trailing
         )
         efficiency_ratios["Inventory Turnover Ratio"] = (
-            self.get_inventory_turnover_ratio()
+            self.get_inventory_turnover_ratio(trailing=trailing)
         )
         efficiency_ratios["Accounts Payable Turnover Ratio"] = (
-            self.get_accounts_payables_turnover_ratio()
+            self.get_accounts_payables_turnover_ratio(trailing=trailing)
         )
         efficiency_ratios["SGA-to-Revenue Ratio"] = self.get_sga_to_revenue_ratio(
             trailing=trailing
@@ -3543,7 +3543,7 @@ def collect_profitability_ratios(
             trailing=trailing
         )
         profitability_ratios["Free Cash Flow to Operating Cash Flow Ratio"] = (
-            self.get_free_cash_flow_operating_cash_flow_ratio()
+            self.get_free_cash_flow_operating_cash_flow_ratio(trailing=trailing)
         )
         profitability_ratios["EBT to EBIT Ratio"] = self.get_EBT_to_EBIT(
             trailing=trailing
@@ -4566,7 +4566,7 @@ def get_return_on_invested_capital(
 
         |      |   2021 |   2022 |   2023 |   2024 |   2025 |
         |:-----|-------:|-------:|-------:|-------:|-------:|
-        | AAPL | 0.5637 | 0.599  | 0.6068 | 0.6019 | 0.7038 |
+        | AAPL | 0.4143 | 0.4439 | 0.444  | 0.4336 | 0.5335 |
         | TSLA | 0.1429 | 0.2733 | 0.2403 | 0.0889 | 0.0425 |
         """
         if trailing:
@@ -5906,18 +5906,21 @@ def get_asset_coverage_ratio(
     ):
         """
         Calculate the asset coverage ratio, a solvency ratio that measures how well a
-        company's tangible assets, after settling current liabilities, can cover its
-        total debt.
+        company's tangible assets, after settling non-debt current liabilities, can
+        cover its total debt.
 
         This ratio is commonly used by lenders and bondholders to assess the extent to
         which a company's hard (tangible) assets would be available to repay debt
         obligations in a liquidation scenario, since intangible assets (e.g. goodwill)
-        typically have little to no recovery value and current liabilities are assumed
-        to be settled first out of current assets.
+        typically have little to no recovery value and non-debt current liabilities are
+        assumed to be settled first out of current assets. Short-term debt is netted
+        out of current liabilities before subtracting, since it is already captured in
+        total debt and would otherwise be double-counted.
 
         The formula is as follows:
 
-        - Asset Coverage Ratio = (Total Assets - Intangible Assets - Total Current Liabilities) / Total Debt
+        - Asset Coverage Ratio = [(Total Assets - Intangible Assets) -
+          (Total Current Liabilities - Short Term Debt)] / Total Debt
 
         Args:
             rounding (int, optional): The number of decimals to round the results to. Defaults to 4.
@@ -5960,6 +5963,10 @@ def get_asset_coverage_ratio(
                 .T.rolling(trailing)
                 .mean()
                 .T,
+                self._balance_sheet_statement.loc[:, "Short Term Debt", :]
+                .T.rolling(trailing)
+                .mean()
+                .T,
                 self.
```

**File**: `financetoolkit/ratios/solvency_model.py` (modified, +14/-6)
```diff
@@ -186,33 +186,41 @@ def get_asset_coverage_ratio(
     total_assets: float | pd.Series,
     intangible_assets: float | pd.Series,
     current_liabilities: float | pd.Series,
+    short_term_debt: float | pd.Series,
     total_debt: float | pd.Series,
 ) -> pd.Series:
     """
     Calculate the asset coverage ratio, a solvency ratio that measures how well a
-    company's tangible assets, after settling current liabilities, can cover its total
-    debt.
+    company's tangible assets, after settling non-debt current liabilities, can cover
+    its total debt.
 
     This ratio is commonly used by lenders and bondholders to assess the extent to
     which a company's hard (tangible) assets would be available to repay debt
     obligations in a liquidation scenario, since intangible assets (e.g. goodwill)
-    typically have little to no recovery value and current liabilities are assumed to
-    be settled first out of current assets.
+    typically have little to no recovery value and non-debt current liabilities are
+    assumed to be settled first out of current assets. Short-term debt is netted out
+    of current liabilities before subtracting, because it is already captured in
+    total debt — otherwise it would be double-counted, once as part of current
+    liabilities and again as part of total debt.
 
     The formula is as follows:
 
-        Asset Coverage Ratio = (Total Assets - Intangible Assets - Current Liabilities) / Total Debt
+        Asset Coverage Ratio = [(Total Assets - Intangible Assets)
+            - (Current Liabilities - Short-Term Debt)] / Total Debt
 
     Args:
         total_assets (float or pd.Series): Total assets of the company.
         intangible_assets (float or pd.Series): Intangible assets of the company.
         current_liabilities (float or pd.Series): Total current liabilities of the company.
+        short_term_debt (float or pd.Series): Short-term (current portion of) debt of the company.
         total_debt (float or pd.Series): Total debt of the company.
 
     Returns:
         float | pd.Series: The asset coverage ratio.
     """
-    return (total_assets - intangible_assets - current_liabilities) / total_debt
+    return (
+        (total_assets - intangible_assets) - (current_liabilities - short_term_debt)
+    ) / total_debt
 
 
 def get_cash_flow_coverage_ratio(
```

**File**: `financetoolkit/ratios/valuation_model.py` (modified, +5/-5)
```diff
@@ -479,20 +479,20 @@ def get_tangible_asset_value(
 
 def get_net_current_asset_value(
     total_current_assets: pd.Series,
-    total_current_liabilities: pd.Series,
+    total_liabilities: pd.Series,
 ) -> pd.Series:
     """
-    Calculate the net current asset value, which is the total value of a company's current assets
-    minus its current liabilities.
+    Calculate the net current asset value (Benjamin Graham's NCAV), which is the total value
+    of a company's current assets minus its total liabilities (not just its current liabilities).
 
     Args:
         total_current_assets (float or pd.Series): The current assets of the company.
-        total_current_liabilities (float or pd.Series): The current liabilities of the company.
+        total_liabilities (float or pd.Series): The total liabilities of the company.
 
     Returns:
         float | pd.Series: The net current asset value.
     """
-    return total_current_assets - total_current_liabilities
+    return total_current_assets - total_liabilities
 
 
 def get_ev_to_ebit(
```

---

### Incident Patch 10: `69347b14` (2026-08-11)
**Commit Message**: Make the cache store atomic and fix the generated MCP schemas

store() read the series, wrote it and recorded coverage over three separate
connections, so two writers could both record coverage while the second write
discarded the first's rows. Across eight processes storing 480 days, 195 were
reported as covered but never stored. It now runs in one BEGIN IMMEDIATE
transaction under WAL, with idempotent coverage upserts.

The router tools baked the first inspected indicator's defaults into the schema
shared by the whole group, and FastMCP passes omitted parameters explicitly, so
get_chaikin_money_flow ran with window=252 instead of 20 and all 40 econometrics
methods regressed on Adj Close instead of Return. 98 of 2325 parameter entries
disagreed with the real signatures, now none.

The MCP response cache key dropped list-valued kwargs, so lag=[1,2] and
lag=[2,3] collided, and the Ken French policy was still registered under the
pre-rename key, re-downloading the archive daily instead of weekly.

**File**: `financetoolkit/cache/cache_controller.py` (modified, +39/-78)
```diff
@@ -378,11 +378,10 @@ def plan(
 
         for entity in entity_list:
             try:
-                ever_covered = self._backend.read_coverage(key, entity)
-                fresh_covered = self._backend.read_coverage(
+                # One snapshot, so the coverage always describes the payload beside it.
+                ever_covered, fresh_covered, payload = self._backend.read_entity_state(
                     key, entity, minimum_fetched_at
                 )
-                payload = self._backend.read_series(key, entity)
             except Exception as error:  # pylint: disable=broad-except
                 # A read that fails mid-session is a cache miss, not a failed call.
                 logger.debug(
@@ -461,32 +460,6 @@ def store(
             return
 
         key = self.create_key(source, dataset, parameters)
-
-        try:
-            existing_payload = self._backend.read_series(key, entity)
-            existing = (
-                serialization_model.decode_dataframe(existing_payload)
-                if existing_payload is not None
-                else None
-            )
-
-            merged = frame_model.merge_frames(existing, data, date_axis)
-
-            self._backend.write_series(
-                key,
-                entity,
-                serialization_model.encode_dataframe(merged),
-                source=source,
-                dataset=dataset,
-            )
-        except Exception as error:  # pylint: disable=broad-except
-            # A cache write must never break the call that produced the data.
-            logger.debug(
-                "Could not cache %s.%s for %s: %s", source, dataset, entity, error
-            )
-
-            return
-
         bounds = frame_model.get_date_bounds(data, date_axis)
 
         coverage_start = (
@@ -500,67 +473,55 @@ def store(
             else (bounds[1] if bounds else None)
         )
 
-        if coverage_start is None or coverage_end is None:
-            return
+        coverage: coverage_model.Interval | None = None
+
+        if coverage_start is not None and coverage_end is not None:
+            # Sources over-fetch (prices by a year either side); claim what is genuinely held.
+            if bounds is not None:
+                coverage_start = min(coverage_start, bounds[0])
+                coverage_end = max(coverage_end, bounds[1])
+
+            coverage = (coverage_start, coverage_end)
+
+        def merge_payload(existing_payload: bytes | None) -> bytes:
+            """
+            Merge the incoming frame into whatever the cache holds right now.
 
-        # Sources over-fetch (prices by a year either side); claim what is genuinely held.
-        if bounds is not None:
-            coverage_start = min(coverage_start, bounds[0])
-            coverage_end = max(coverage_end, bounds[1])
+            Args:
+                existing_payload (bytes | None): The payload stored under the write
+                    lock, or None when the entity has never been cached.
+
+            Returns:
+                bytes: The payload to store in its place.
+            """
+            existing = (
+                serialization_model.decode_dataframe(existing_payload)
+                if existing_payload is not None
+                else None
+            )
+
+            return serialization_model.encode_dataframe(
+                frame_model.merge_frames(existing, data, date_axis)
+            )
 
         try:
-            self._backend.write_coverage(
+            # The payload and the range it covers are only true together, so they
+            # are written in a single transaction that another writer has to wait for.
+            self._backend.store_series_and_coverage(
                 key,
                 entity,
-                coverage_start,
-                coverage_end,
+                merge_payload,
+                coverage=coverage,
                 source=source,
                 dataset=dataset,
+            
```

**File**: `financetoolkit/cache/policy_model.py` (modified, +6/-1)
```diff
@@ -102,7 +102,12 @@ class CachePolicy:
     f"{EUROPEAN_CENTRAL_BANK}.series": CachePolicy(ttl_seconds=DAY),
     f"{FEDERAL_RESERVE}.rate": CachePolicy(ttl_seconds=DAY),
     # The Ken French factor files are published monthly as a single zip archive.
-    f"{KEN_FRENCH}.factors": CachePolicy(ttl_seconds=7 * DAY),
+    # Named "factors_decimal" because the loaders were corrected to divide the
+    # published percentages by 100; the rename is what stops a cache warmed by an
+    # older release from serving percent-scaled factors against decimal returns.
+    # The policy has to follow that rename or the archive falls back to the
+    # one day default and is re-downloaded every day.
+    f"{KEN_FRENCH}.factors_decimal": CachePolicy(ttl_seconds=7 * DAY),
     # Computed MCP tool responses layered on top of the source caches.
     f"{MCP}.tool": CachePolicy(ttl_seconds=DAY),
 }
```

**File**: `financetoolkit/cache/serialization_model.py` (modified, +57/-2)
```diff
@@ -78,6 +78,55 @@ def decode_object(payload: bytes) -> Any:
     return pickle.loads(zlib.decompress(payload))  # noqa: S301
 
 
+def canonicalize(value: Any) -> Any:
+    """
+    Rewrite a parameter value into a form that hashes to exactly one key.
+
+    A cache key is only trustworthy if it is a total function of the arguments:
+    every value has to reach it, and two values that mean different things have
+    to reach it differently. Plain JSON does neither. It cannot represent a set,
+    a tuple or a date at all, so those would have to be dropped or stringified,
+    and it renders a tuple and a list identically and a non-string dictionary key
+    as its string form, so ``{1: "a"}`` and ``{"1": "a"}`` would collide.
+
+    Containers are therefore tagged with their type, mappings are sorted by their
+    canonical key so ordering cannot change the digest, sets are sorted so their
+    iteration order cannot either, and anything else is tagged with its class name
+    beside its representation so two unrelated objects that happen to print the
+    same do not merge. Booleans are handled before integers because ``True`` and
+    ``1`` are equal in Python and must not be for a key.
+
+    Args:
+        value (Any): The value to rewrite. Any object is accepted.
+
+    Returns:
+        Any: A JSON-serializable structure that is unique to the value.
+    """
+    if value is None or isinstance(value, str):
+        return value
+    if isinstance(value, bool):
+        return ["bool", value]
+    if isinstance(value, int):
+        return ["int", value]
+    if isinstance(value, float):
+        return ["float", repr(value)]
+    if isinstance(value, dict):
+        items = sorted(
+            ([canonicalize(key), canonicalize(item)] for key, item in value.items()),
+            key=lambda pair: json.dumps(pair[0]),
+        )
+
+        return ["dict", items]
+    if isinstance(value, tuple):
+        return ["tuple", [canonicalize(item) for item in value]]
+    if isinstance(value, list):
+        return ["list", [canonicalize(item) for item in value]]
+    if isinstance(value, set | frozenset):
+        return ["set", sorted((canonicalize(item) for item in value), key=json.dumps)]
+
+    return [type(value).__name__, str(value)]
+
+
 def create_cache_key(source: str, dataset: str, parameters: dict[str, Any]) -> str:
     """
     Build the deterministic key that identifies a cached dataset.
@@ -88,6 +137,9 @@ def create_cache_key(source: str, dataset: str, parameters: dict[str, Any]) -> s
     Only parameters that genuinely change the shape or meaning of the returned
     data (interval, period, source, currency, and so on) belong here.
 
+    Every parameter passes through ``canonicalize`` first, so nested structures,
+    lists and dictionaries all reach the digest and reach it in a fixed order.
+
     Args:
         source (str): The external data source, e.g. "fmp" or "oecd".
         dataset (str): The dataset within that source, e.g. "historical".
@@ -97,9 +149,12 @@ def create_cache_key(source: str, dataset: str, parameters: dict[str, Any]) -> s
         str: A SHA256 hex digest uniquely identifying this dataset variant.
     """
     canonical = json.dumps(
-        {"source": source, "dataset": dataset, "parameters": parameters},
+        {
+            "source": source,
+            "dataset": dataset,
+            "parameters": canonicalize(parameters),
+        },
         sort_keys=True,
-        default=str,
     )
 
     return hashlib.sha256(canonical.encode()).hexdigest()
```

**File**: `financetoolkit/cache/sqlite_model.py` (modified, +236/-85)
```diff
@@ -5,14 +5,21 @@
 import contextlib
 import sqlite3
 import time
-from datetime import date
+from collections.abc import Callable
 from pathlib import Path
 from threading import Lock
 
-from financetoolkit.cache.coverage_model import Interval, normalize_date
+from financetoolkit.cache.coverage_model import (
+    Interval,
+    merge_intervals,
+    normalize_date,
+)
 
 SCHEMA_VERSION = 1
 
+# How long a writer waits for another process to release the write lock.
+BUSY_TIMEOUT_SECONDS = 30
+
 # Three tables; source and dataset stay plain columns so clearing can be scoped.
 SCHEMA_STATEMENTS = (
     """
@@ -102,24 +109,56 @@ def database_location(self) -> str:
         return self._database_location
 
     @contextlib.contextmanager
-    def _connect(self):
+    def _connect(self, write: bool = False):
         """
         Yield a SQLite connection with write-ahead logging enabled.
 
         Connections are opened per operation and closed afterwards. SQLite's own
         context manager only commits, it does not close, so the connection is
         wrapped explicitly to avoid leaking file handles in long running servers.
 
+        Writers open an explicit ``BEGIN IMMEDIATE`` transaction. The database is
+        shared between the library and a long running MCP server, so a Python
+        lock cannot serialize anything: the write lock has to be taken in SQLite
+        itself, and it has to be taken *up front*. A deferred transaction that
+        only escalates to a write lock at its first ``INSERT`` cannot be retried
+        under write-ahead logging once another process has committed in the
+        meantime, so it fails with "database is locked" rather than waiting.
+
+        Args:
+            write (bool): True to take the database write lock for the duration of
+                the block, so that every statement inside it commits or rolls back
+                as one unit. False opens a plain read connection.
+
         Yields:
             sqlite3.Connection: An open connection guarded by the instance lock.
         """
         with self._lock:
-            connection = sqlite3.connect(self._database_location, timeout=30)
+            connection = sqlite3.connect(
+                self._database_location,
+                timeout=BUSY_TIMEOUT_SECONDS,
+                isolation_level=None,
+            )
             try:
+                connection.execute(
+                    f"PRAGMA busy_timeout={int(BUSY_TIMEOUT_SECONDS * 1000)}"
+                )
                 connection.execute("PRAGMA journal_mode=WAL")
                 connection.execute("PRAGMA synchronous=NORMAL")
-                yield connection
-                connection.commit()
+
+                if not write:
+                    yield connection
+                else:
+                    connection.execute("BEGIN IMMEDIATE")
+
+                    try:
+                        yield connection
+                    except BaseException:
+                        connection.execute("ROLLBACK")
+
+                        raise
+
+                    connection.execute("COMMIT")
             finally:
                 connection.close()
 
@@ -134,7 +173,7 @@ def initialize_database(self) -> None:
         """
         Path(self._database_location).parent.mkdir(parents=True, exist_ok=True)
 
-        with self._connect() as connection:
+        with self._connect(write=True) as connection:
             for statement in SCHEMA_STATEMENTS:
                 connection.execute(statement)
 
@@ -182,33 +221,6 @@ def read_series(self, key: str, entity: str) -> bytes | None:
 
         return row[0] if row else None
 
-    def write_series(
-        self,
-        key: str,
-        entity: str,
-        payload: bytes,
-        source: str = "",
-        dataset: str = "",
-    ) -> None:
-        """
-        Insert or replace the payload for a single entity of a dataset.
-
-        Args:
-            key (str): The dataset key.
-            enti
```

**File**: `financetoolkit/mcp_server/config.yaml` (modified, +5/-1)
```diff
@@ -107,6 +107,10 @@ skip_params:
   - "progress_bar"
   - "overwrite"
   - "rounding"
+  # Deprecated misspelling of smooth_window kept for backwards compatibility on
+  # get_stochastic_oscillator. Exposing it would teach the model the typo, and
+  # passing both raises, so only the correct spelling reaches the tool schema.
+  - "smooth_widow"
 
 # ──────────────────────────────────────────────────────────────────────────────
 # Parameters handled at wrapper level (not forwarded to sub-methods)
@@ -447,7 +451,7 @@ tool_groups:
   # confidence indices, house/rent prices, exchange rates, share prices.
   - tool_name:       "macroeconomics"
     display_name:    "General Economy"
-    description:     "Macroeconomic indicators by country (GDP, real GDP, CPI, PPI, inflation rate, trade balance, imports, exports, investment, consumption, business/consumer confidence, house prices, rent prices, exchange rates, real effective exchange rate, money supply, household savings rate, household debt-to-income ratio, output gap, real interest rate, misery index, banking/currency/sovereign debt crisis indicators, commercial real estate prices, commodity forward curves). Requires countries='United States' — use comma-separated values for multiple countries. Do NOT use tickers= for this tool. Supports start_date/end_date and quarterly=true. Supports rolling=N (moving-average smoothing) and trailing=N (trailing N-period sum, e.g. a trailing-4-quarter sum) on the raw series. get_consumer_price_index accepts oecd_source=true for monthly/quarterly OECD data instead of the default annual GMDB source. get_commodity_forward_curve requires a commodity= argument instead of countries= (e.g. 'Crude Oil', 'Gold') and returns dated futures contracts, not a country series. Also includes six US-only, FRED-backed indicators (get_retail_sales, get_industrial_production_index, get_housing_starts, get_real_personal_income, get_recession_indicator, get_commercial_real_estate_prices) — these require a free FRED API key (optional; get one at https://fred.stlouisfed.org/docs/api/api_key.html) and only return a 'United States' column regardless of the countries= argument."
+    description:     "Macroeconomic indicators by country (GDP, real GDP, CPI, PPI, inflation rate, trade balance, imports, exports, investment, consumption, business/consumer confidence, house prices, rent prices, exchange rates, real effective exchange rate, money supply, household savings rate, household debt-to-income ratio, output gap, real interest rate, misery index, banking/currency/sovereign debt crisis indicators, commercial real estate prices, commodity forward curves). Requires countries='United States' — use comma-separated values for multiple countries. Do NOT use tickers= for this tool. Supports start_date/end_date and quarterly=true. Supports rolling=N (moving-average smoothing) and trailing=N (trailing N-period sum, e.g. a trailing-4-quarter sum) on the raw series. get_consumer_price_index accepts oecd_source=true for monthly/quarterly OECD data instead of the default annual GMDB source. get_commodity_forward_curve requires a commodity= argument instead of countries= (e.g. 'Crude Oil', 'Gold') and returns dated futures contracts, not a country series. Also includes six US-only, FRED-backed indicators (get_retail_sales, get_industrial_production_index, get_housing_starts, get_real_personal_income, get_recession_indicator, get_commercial_real_estate_prices) — these require a free FRED API key (optional; get one at https://fred.stlouisfed.org/docs/api/api_key.html) and only return a 'United States' column regardless of the countries= argument. Every rate and ratio this tool returns is a decimal fraction, not a percentage: an inflation rate of 4.1% comes back as 0.0412 and a debt-to-GDP ratio of 131.7% as 1.3173. Multiply by 100 before presenting them as percentages."
     module_name:     "economics"
     category:        "standalone"
     index_category:  "general_economy"
```

#### Recent Merged Pull Requests:
- **PR #237** (2026-08-18): v2.2.0 (@JerBouma)
- **PR #234** (closed): Bump mcp from 1.27.0 to 1.28.1 (@dependabot[bot])
- **PR #232** (2026-07-10): Bump soupsieve from 2.8 to 2.8.4 (@dependabot[bot])
- **PR #231** (2026-07-14): Release v2.1.4 (@JerBouma)
- **PR #228** (2026-06-23): v2.1.1 (@JerBouma)
- **PR #227** (closed): Bump vcrpy from 5.1.0 to 8.2.1 (@dependabot[bot])
- **PR #226** (closed): Bump pydantic-settings from 2.13.1 to 2.14.2 (@dependabot[bot])
- **PR #225** (closed): Bump cryptography from 46.0.7 to 48.0.1 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
