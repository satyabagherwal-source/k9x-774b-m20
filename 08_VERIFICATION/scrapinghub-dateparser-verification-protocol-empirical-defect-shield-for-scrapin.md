# Verification Protocol: Verification Protocol: Empirical Defect Shield for scrapinghub/dateparser

<!-- PROVENANCE_START
{
  "source_repository": "scrapinghub/dateparser",
  "source_url": "https://github.com/scrapinghub/dateparser",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [scrapinghub/dateparser](https://github.com/scrapinghub/dateparser) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Scope & Verification Target
- **Target Repository**: `scrapinghub/dateparser` (Commit: `historical`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/scrapinghub-dateparser-learnings.md`  
> **Source**: github ([https://github.com/scrapinghub/dateparser](https://github.com/scrapinghub/dateparser))  
> **Source Version**: `90544c0b`  
> **License**: BSD-3-Clause  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-07T19:37:16.767Z  
> **Learning ID**: `learn-github-scrapinghub-dateparser`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): scrapinghub/dateparser

> **Canonical Artifact**: `07_PROJECT_LEARNING/scrapinghub-dateparser-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/scrapinghub/dateparser](https://github.com/scrapinghub/dateparser))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-07T19:37:15.910Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `scrapinghub/dateparser`
- **Description**: python parser for human readable dates
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml
- **Stars / Engagement**: 2864 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `dateparser/utils/__init__.py`
```
import calendar
import logging
import logging.config
import os
import threading
import types
import unicodedata
import warnings
from collections import OrderedDict
from collections.abc import Callable, Mapping
from datetime import datetime, tzinfo
from datetime import timezone as dt_timezone
from typing import TYPE_CHECKING, Any, Literal, TypeVar

import regex as re
from pytz import UTC, UnknownTimeZoneError, timezone
from tzlocal import get_localzone

from dateparser.timezone_parser import StaticTzInfo, _find_tz

if TYPE_CHECKING:
    from dateparser.conf import Settings

_T = TypeVar("_T")


def _get_localzone() -> tzinfo:
    try:
        return get_localzone()
    except ValueError as error:
        warnings.warn(
            f"Could not determine the local timezone "
            f"(TZ={os.environ.get('TZ')!r}): {error}. In a future version of "
            f"dateparser, this will raise RuntimeError instead of failing to "
            f"parse the date.",
            FutureWarning,
            stacklevel=2,
        )
        raise


def strip_braces(date_string: str) -> str:
    return re.sub(r"[{}()<>\[\]]+", "", date_string)


def normalize_unicode(
    string: str, form: Literal["NFC", "NFD", "NFKC", "NFKD"] = "NFKD"
) -> str:
    return "".join(
        c
        for c in unicodedata.normalize(form, string)
        if unicodedata.category(c) != "Mn"
    )


def combine_dicts(
    primary_dict: Mapping[str, Any], supplementary_dict: Mapping[str, Any]
) -> "OrderedDict[str, Any]":
    combined_dict: OrderedDict[str, Any] = OrderedDict()
    for key, value in primary_dict.items():
        if key in supplementary_dict:
            if isinstance(value, list):
                combined_dict[key] = value + supplementary_dict[key]
            elif isinstance(value, dict):
                combined_dict[key] = combine_dicts(value, supplementary_dict[key])
            else:
                combined_dict[key] = supplementary_dict[key]
        else:
            combined_dict[key] = value
    remaining_keys = [key for key in supplementary_dict if key not in primary_dict]
    for key in remaining_keys:
        combined_dict[key] = supplementary_dict[key]
    return combined_dict


def find_date_separator(format: str) -> str | None:  # noqa: A002
    m = re.search(r"(?:(?:%[dbBmaA])(\W))+", format)
    if m:
        return m.group(1)
    return None


_PART_DIRECTIVES = {
    "year": ["%y", "%-y", "%Y"],
    # %j (day of year) encodes month implicitly: a successful strptime with %j always
    # populates the month field, so %j should count as providing month information.
    "month": ["%b", "%B", "%m", "%-m", "%j", "%-j"],
    "day": ["%d", "%-d", "%j", "%-j"],
    "time": ["%H", "%-H", "%I", "%-I", "%M", "%-M", "%S", "%-S"],
}


def _get_parts(fmt: str) -> tuple[str, ...]:
    """Return a tuple with the parts (year, month, day, time) that a date format
    provides, based on its directives."""
    complete_week_date = False
    if "%U" in fmt or "%W" in fmt or "%V" in fmt:
        # A year, week number and weekday determine the complete date. Consume
        # %% pairs so literal directive names do not count as date components.
        directives = set(re.findall(r"%[%UWVwuAaYyG]", fmt))
        complete_week_date = bool(
            directives & {"%U", "%W", "%V"}
            and directives & {"%w", "%u", "%a", "%A"}
            and directives & {"%Y", "%y", "%G"}
        )
    return tuple(
        part
        for part, directives in _PART_DIRECTIVES.items()
        if (complete_week_date and part != "time")
        or any(directive in fmt for directive in directives)
    )


def _get_missing_parts(fmt: str) -> list[str]:
    """
    Return a list containing missing parts (day, month, year)
    from a date format checking its directives
    """
    parts = _get_parts(fmt)
    return [field for field in ("day", "month", "year") if field not in parts]


def get_timezone_from_tz_string(tz_string: str) -> tzinfo:
    try:
        return timezone(tz_string)
    except UnknownTimeZoneError:
        found = _find_tz(f" {tz_string}")
        if found:
            _, name, offset = found
            return StaticTzInfo(name, offset)
        raise


def localize_timezone(date_time: datetime, tz_string: str) -> datetime:
    if date_time.tzinfo:
        return date_time

    tz = get_timezone_from_tz_string(tz_string)

    if hasattr(tz, "localize"):
        date_time = tz.localize(date_time)
    else:
        date_time = date_time.replace(tzinfo=tz)

    return date_time


def apply_tzdatabase_timezone(date_time: datetime, pytz_string: str) -> datetime:
    usr_timezone = timezone(pytz_string)

    if date_time.tzinfo != usr_timezone:
        date_time = date_time.astimezone(usr_timezone)

    return date_time


def apply_dateparser_timezone(
    utc_datetime: datetime, offset_or_timezone_abb: str
) -> datetime | None:
    found = _find_tz(f" {offset_or_timezone_abb}")
    if found:
        _, name, offset = found
        return utc_datetime.astimezone(StaticTzInfo(name, offset))
    return None


def apply_timezone(date_time: datetime, tz_string: str) -> datetime:
    if not date_time.tzinfo:
        if hasattr(UTC, "localize"):
            date_time = UTC.localize(date_time)
        else:
            date_time = date_time.replace(tzinfo=UTC)

    new_datetime = apply_dateparser_timezone(date_time, tz_string)

    if not new_datetime:
        new_datetime = apply_tzdatabase_timezone(date_time, tz_string)

    return new_datetime


def _now(settings: "Settings", tz: tzinfo | None = None) -> datetime:
    """Return the current time as a naive datetime in *tz*, or in the
    ``TIMEZONE`` setting if *tz* is ``None``."""
    if tz is not None:
        return datetime.now(tz).replace(tzinfo=None)
    if "local" in settings.TIMEZONE.lower():
        return datetime.now()
    utc_now = datetime.now(dt_timezone.utc)
    return apply_timezone(utc_now, settings.TIMEZONE).replace(tzinfo=None)


def apply_timezone_from_settings(
    date_obj: datetime, settings: "Settings | None"
) -> datetime:
    tz = _get_localzone()
    if settings is None:
        return date_obj

    parsed_tz = date_obj.tzinfo is not None
    if parsed_tz:
        if "local" not in settings.TIMEZONE.lower():
            date_obj = apply_timezone(date_obj, settings.TIMEZONE)
    elif "local" in settings.TIMEZONE.lower():
        if hasattr(tz, "localize"):
            date_obj = tz.localize(date_obj)
        else:
            date_obj = date_obj.replace(tzinfo=tz)
    else:
        date_obj = localize_timezone(date_obj, settings.TIMEZONE)

    if settings.TO_TIMEZONE:
        date_obj = apply_timezone(date_obj, settings.TO_TIMEZONE)

    if not settings.RETURN_AS_TIMEZONE_AWARE or (
        settings.RETURN_AS_TIMEZONE_AWARE == "default" and not parsed_tz
    ):
        date_obj = date_obj.replace(tzinfo=None)

    return date_obj


def get_last_day_of_month(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def get_previous_leap_year(year: int) -> int:
    return _get_leap_year(year, future=False)


def get_next_leap_year(year: int) -> int:
    return _get_leap_year(year, future=True)


def _get_leap_year(year: int, future: bool) -> int:
    """
    Iterate through previous or next years until it gets a valid leap year
    This is performed to avoid missing or including centurial leap years
    """
    step = 1 if future else -1
    leap_year = year + step
    while not calendar.isleap(leap_year):
        leap_year += step
    return leap_year


def set_correct_day_from_settings(
    date_obj: datetime, settings: "Settings", current_day: int | None = None
) -> datetime:
    """Set correct day attending the `PREFER_DAY_OF_MONTH` setting."""
    options = {
        "first": 1,
        "last": get_last_day_of_month(date_obj.year, date_obj.month),
        "current": current_day or datetime.now().day,
    }

    try:
        return date_obj.replace(day=options[settings.PREFER_DAY_OF_MONTH])
    except ValueError:
        return date_obj.replace(day=options["last"])


def set_correct_month_from_settings(
    date_obj: datetime, settings: "Settings", current_month: int | None = None
) -> datetime:
    """Set correct month attending the `PREFER_MONTH_OF_YEAR` setting."""
    options = {"first": 1, "last": 12, "current": current_month or datetime.now().month}

    try:
        return date_obj.replace(month=options[settings.PREFER_MONTH_OF_YEAR])
    except ValueError:
        return date_obj.replace(month=options["last"])


_registry_lock = threading.Lock()


def registry(cls: type[_T]) -> type[_T]:
    warnings.warn(
        "dateparser.utils.registry() is deprecated and will be removed in a "
        "future version.",
        FutureWarning,
        stacklevel=2,
    )

    def choose(creator: Callable[..., Any]) -> "staticmethod[..., Any]":
        def constructor(cls: Any, *args: Any, **kwargs: Any) -> Any:
            key = cls.get_key(*args, **kwargs)

            with _registry_lock:
                if not hasattr(cls, "__registry_dict"):
                    setattr(cls, "__registry_dict", {})
                registry_dict = getattr(cls, "__registry_dict")

                if key not in registry_dict:
                    instance = creator(cls, *args)
                    # Set the key before publishing the instance so other
                    # threads never observe an entry without ``registry_key``.
                    instance.registry_key = key
                    registry_dict[key] = instance
                return registry_dict[key]

        return staticmethod(constructor)

    get_key = getattr(cls, "get_key", None)
    if not (isinstance(get_key, types.MethodType) and get_key.__self__ is cls):
        raise NotImplementedError(
            "Registry classes require to implement class method get_key"
        )

    cls.__new__ = choose(cls.__new__)  # type: ignore[method-assign]
    return cls


def get_logger() -> logging.Logger
```

### Core Architecture Module: `dateparser/utils/strptime.py`
```
import calendar
import importlib.util
import sys
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from time import struct_time
from types import ModuleType
from typing import Any

import regex as re

TIME_MATCHER = re.compile(
    r".*?"
    r"(?P<hour>2[0-3]|[0-1]\d|\d):"
    r"(?P<minute>[0-5]\d|\d):"
    r"(?P<second>6[0-1]|[0-5]\d|\d)"
    r"\.(?P<microsecond>[0-9]{1,6})"
)

MS_SEARCHER = re.compile(r"\.(?P<microsecond>[0-9]{1,6})")


def patch_strptime() -> Callable[[str, str], struct_time]:
    """Monkey patching _strptime to avoid problems related with non-english
    locale changes on the system.

    For example, if system's locale is set to fr_FR. Parser won't recognize
    any date since all languages are translated to english dates.
    """
    _strptime_spec = importlib.util.find_spec("_strptime")
    assert _strptime_spec is not None
    assert _strptime_spec.loader is not None
    _strptime: Any = importlib.util.module_from_spec(_strptime_spec)
    _strptime_spec.loader.exec_module(_strptime)
    sys.modules["strptime_patched"] = _strptime

    # Copy the namespace without re-executing calendar, whose enum decorators
    # would modify the original module. English names are rebound only here.
    _calendar = ModuleType("calendar_patched")
    _calendar.__dict__.update(vars(calendar), __name__="calendar_patched")
    sys.modules["calendar_patched"] = _calendar

    _strptime._getlang = lambda: ("en_US", "UTF-8")
    _strptime.calendar = _calendar
    _strptime.calendar.day_abbr = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    _strptime.calendar.day_name = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    ]
    _strptime.calendar.month_abbr = [
        "",
        "jan",
        "feb",
        "mar",
        "apr",
        "may",
        "jun",
        "jul",
        "aug",
        "sep",
        "oct",
        "nov",
        "dec",
    ]
    _strptime.calendar.month_name = [
        "",
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
    ]

    strptime_time: Callable[[str, str], struct_time] = _strptime._strptime_time
    return strptime_time


__strptime = patch_strptime()


@lru_cache(maxsize=256)
def _inspect_format(og_format: str) -> tuple[bool, bool]:
    """Return whether *og_format* has a day of month but no year, and whether
    it has a day of year.
    """
    # Adapted from std lib: https://github.com/python/cpython/blob/e34a5e33049ce845de646cf24a498766a2da3586/Lib/_strptime.py#L448
    regex_format = re.sub(r"([\\.^$*+?\(\){}\[\]|])", r"\\\1", og_format)
    regex_format = re.sub(r"\s+", r"\\s+", regex_format)
    regex_format = re.sub(r"'", "['\u02bc]", regex_format)
    year_in_format = False
    day_of_month_in_format = False
    day_of_year_in_format = False

    def repl(m: re.Match[str]) -> str:
        format_char = m[1]
        if format_char in ("Y", "y", "G"):
            nonlocal year_in_format
            year_in_format = True
        elif format_char == "d":
            nonlocal day_of_month_in_format
            day_of_month_in_format = True
        elif format_char == "j":
            nonlocal day_of_year_in_format
            day_of_year_in_format = True

        return ""

    _ = re.sub(r"%[-_0^#]*[0-9]*([OE]?\\?.?)", repl, regex_format)
    return day_of_month_in_format and not year_in_format, day_of_year_in_format


def _prepare_format(date_string: str, og_format: str) -> tuple[str, str, bool]:
    missing_year, day_of_year_in_format = _inspect_format(og_format)
    if missing_year:
        current_year = datetime.today().year
        return (
            f"{current_year} {date_string}",
            f"%Y {og_format}",
            day_of_year_in_format,
        )
    return date_string, og_format, day_of_year_in_format


def strptime(date_string: str, format: str) -> datetime:  # noqa: A002
    date_string, prepared_format, day_of_year_in_format = _prepare_format(
        date_string, format
    )
    time_tuple = __strptime(date_string, prepared_format)
    obj = datetime(*time_tuple[:-3])
    if time_tuple.tm_gmtoff is not None:
        obj = obj.replace(tzinfo=timezone(timedelta(seconds=time_tuple.tm_gmtoff)))

    if day_of_year_in_format and time_tuple.tm_yday != obj.timetuple().tm_yday:
        # A day of year past the end of the parsed year is rolled over into the
        # next year by the std lib (e.g. day 366 of 1999 becomes 2000-01-01),
        # which keeps the original value in tm_yday. Such a day does not belong
        # to the parsed year, so reject it instead of returning another year.
        raise ValueError(
            f"day of year {time_tuple.tm_yday} is out of range for year {obj.year - 1}"
        )

    if "%f" in prepared_format:
        try:
            match_groups = TIME_MATCHER.match(date_string).groupdict()  # type: ignore[union-attr]
            ms = match_groups["microsecond"]
            ms = ms + ((6 - len(ms)) * "0")
            obj = obj.replace(microsecond=int(ms))
        except AttributeError:
            match_groups = MS_SEARCHER.search(date_string).groupdict()  # type: ignore[union-attr]
            ms = match_groups["microsecond"]
            ms = ms + ((6 - len(ms)) * "0")
            obj = obj.replace(microsecond=int(ms))

    return obj

```

### Core Architecture Module: `dateparser/utils/time_spans.py`
```
import re
import warnings
from collections.abc import Mapping
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Any

from dateutil.relativedelta import relativedelta

if TYPE_CHECKING:
    from dateparser.conf import Settings


def _get_week_start(date: datetime, start_of_week: str) -> datetime:
    days_back = date.weekday()
    if start_of_week != "monday":
        days_back = (days_back + 1) % 7
    return date - timedelta(days=days_back)


def get_week_start(date: datetime, start_of_week: str = "monday") -> datetime:
    warnings.warn(
        "dateparser.utils.time_spans.get_week_start() is deprecated and will "
        "be removed in a future version.",
        FutureWarning,
        stacklevel=2,
    )
    return _get_week_start(date, start_of_week)


def get_week_end(date: datetime, start_of_week: str = "monday") -> datetime:
    warnings.warn(
        "dateparser.utils.time_spans.get_week_end() is deprecated and will "
        "be removed in a future version.",
        FutureWarning,
        stacklevel=2,
    )
    return _get_week_start(date, start_of_week) + timedelta(days=6)


def detect_time_span(text: str) -> dict[str, Any] | None:
    """Detect time span expressions in text and return span information."""
    span_patterns = [
        {
            "pattern": r"\b(?:for\s+the\s+|during\s+the\s+|in\s+the\s+)?(?:past|last|previous)\s+month\b",
            "type": "month",
            "direction": "past",
        },
        {
            "pattern": r"\b(?:for\s+the\s+|during\s+the\s+|in\s+the\s+)?(?:past|last|previous)\s+week\b",
            "type": "week",
            "direction": "past",
        },
        {
            "pattern": r"\b(?:for\s+the\s+|during\s+the\s+|in\s+the\s+)?(?:past|last|previous)\s+(\d+)\s+days?\b",
            "type": "days",
            "direction": "past",
        },
        {
            "pattern": r"\b(?:for\s+the\s+|during\s+the\s+|in\s+the\s+)?(?:past|last|previous)\s+(\d+)\s+weeks?\b",
            "type": "weeks",
            "direction": "past",
        },
        {
            "pattern": r"\b(?:for\s+the\s+|during\s+the\s+|in\s+the\s+)?(?:past|last|previous)\s+(\d+)\s+months?\b",
            "type": "months",
            "direction": "past",
        },
        {
            "pattern": r"\b(?:for\s+the\s+|during\s+the\s+|in\s+the\s+)?(?:next|coming|following)\s+month\b",
            "type": "month",
            "direction": "future",
        },
        {
            "pattern": r"\b(?:for\s+the\s+|during\s+the\s+|in\s+the\s+)?(?:next|coming|following)\s+week\b",
            "type": "week",
            "direction": "future",
        },
        {
            "pattern": r"\b(?:for\s+the\s+|during\s+the\s+|in\s+the\s+)?(?:next|coming|following)\s+(\d+)\s+days?\b",
            "type": "days",
            "direction": "future",
        },
        {
            "pattern": r"\b(?:for\s+the\s+|during\s+the\s+|in\s+the\s+)?(?:next|coming|following)\s+(\d+)\s+weeks?\b",
            "type": "weeks",
            "direction": "future",
        },
        {
            "pattern": r"\b(?:for\s+the\s+|during\s+the\s+|in\s+the\s+)?(?:next|coming|following)\s+(\d+)\s+months?\b",
            "type": "months",
            "direction": "future",
        },
    ]

    for pattern_info in span_patterns:
        match = re.search(pattern_info["pattern"], text, re.IGNORECASE)
        if match:
            result: dict[str, Any] = {
                "type": pattern_info["type"],
                "direction": pattern_info["direction"],
                "matched_text": match.group(0),
                "start_pos": match.start(),
                "end_pos": match.end(),
            }

            if match.groups():
                try:
                    result["number"] = int(match.group(1))
                except ValueError:
                    # More digits than int() accepts, so not a usable quantity.
                    continue

            return result

    return None


def generate_time_span(
    span_info: Mapping[str, Any],
    base_date: datetime | None = None,
    settings: "Settings | None" = None,
) -> tuple[datetime, datetime]:
    """Return the start and end dates of the span described by *span_info*."""
    if base_date is None:
        warnings.warn(
            "Calling dateparser.utils.time_spans.generate_time_span() without "
            "base_date is deprecated, and base_date will be required in a "
            "future version.",
            FutureWarning,
            stacklevel=2,
        )
        base_date = datetime.now()
    if settings is None:
        warnings.warn(
            "Calling dateparser.utils.time_spans.generate_time_span() without "
            "settings is deprecated, and settings will be required in a "
            "future version.",
            FutureWarning,
            stacklevel=2,
        )
        start_of_week, days_in_month = "monday", 30
    else:
        start_of_week = getattr(settings, "DEFAULT_START_OF_WEEK", "monday")
        days_in_month = getattr(settings, "DEFAULT_DAYS_IN_MONTH", 30)
    span_type = span_info["type"]
    number = span_info.get("number", 1)
    past = span_info["direction"] == "past"

    if span_type == "week":
        week_start = _get_week_start(base_date, start_of_week)
        if past:
            return week_start - timedelta(days=7), week_start - timedelta(days=1)
        start_date = week_start + timedelta(days=7)
        return start_date, start_date + timedelta(days=6)

    span: timedelta | relativedelta
    if span_type == "month":
        span = timedelta(days=days_in_month)
    elif span_type == "days":
        span = timedelta(days=number)
    elif span_type == "weeks":
        span = timedelta(weeks=number)
    else:
        span = relativedelta(months=number)

    if past:
        return base_date - span, base_date
    return base_date, base_date + span

```

### Core Architecture Module: `dateparser_cli/utils.py`
```
import sys
from pathlib import Path

DEFAULT_DIR_NAME = "dateparser_models"
DEFAULT_UNIX_CACHE_DIR = "~/.cache"

DEFAULT_WINDOWS_CACHE_DIR = Path.home() / "AppData" / "Roaming"


if sys.platform.startswith("win"):
    # For Windows:
    _cache_dir = DEFAULT_WINDOWS_CACHE_DIR
else:
    # UNIX & OS X:
    _cache_dir = DEFAULT_UNIX_CACHE_DIR

dateparser_model_home = (Path(_cache_dir) / DEFAULT_DIR_NAME).expanduser()


def clear_cache(*args: object) -> None:
    for path in dateparser_model_home.rglob("*.*"):
        path.unlink()

```

### Core Architecture Module: `dateparser_scripts/utils.py`
```
import shutil
from pathlib import Path
from typing import Any

from git import Repo

CLDR_JSON_DIR = (Path(__file__).parent / "../cldr-json").resolve()


def get_raw_data() -> None:
    cldr_version = "44.1.0"
    url = "https://github.com/unicode-org/cldr-json.git"
    if CLDR_JSON_DIR.is_dir():
        shutil.rmtree(CLDR_JSON_DIR)

    print(f"Clonning {url} @ {cldr_version} on {CLDR_JSON_DIR}...")
    Repo.clone_from(url, CLDR_JSON_DIR, branch=cldr_version, depth=1)


def get_dict_difference(
    parent_dict: dict[str, Any], child_dict: dict[str, Any]
) -> dict[str, Any]:
    difference_dict = {}
    for key, child_value in child_dict.items():
        parent_value = parent_dict.get(key)
        child_specific_value = None
        if not parent_value:
            child_specific_value = child_value
        elif isinstance(child_value, list):
            child_specific_value = sorted(set(child_value) - set(parent_value))
        elif isinstance(child_value, dict):
            child_specific_value = get_dict_difference(parent_value, child_value)
        elif child_value != parent_value:
            child_specific_value = child_value
        if child_specific_value:
            difference_dict[key] = child_specific_value
    return difference_dict


def combine_dicts(
    primary_dict: dict[str, Any], supplementary_dict: dict[str, Any]
) -> dict[str, Any]:
    combined_dict = {}
    for key, value in primary_dict.items():
        if key in supplementary_dict:
            if isinstance(value, list):
                combined_dict[key] = value + supplementary_dict[key]
            elif isinstance(value, dict):
                combined_dict[key] = combine_dicts(value, supplementary_dict[key])
            else:
                combined_dict[key] = supplementary_dict[key]
        else:
            combined_dict[key] = value
    remaining_keys = [key for key in supplementary_dict if key not in primary_dict]
    for key in remaining_keys:
        combined_dict[key] = supplementary_dict[key]
    return combined_dict

```

### Core Architecture Module: `dateparser/__init__.py`
```
__version__ = "1.5.0"

from collections.abc import Callable, Iterable
from datetime import datetime
from typing import Any

from ._parts_of_day import PartOfDay as PartOfDay
from ._parts_of_day import PartsOfDay as PartsOfDay
from .conf import Settings, apply_settings
from .date import DateDataParser as DateDataParser

_default_parser = DateDataParser()


@apply_settings
def parse(
    date_string: str,
    date_formats: Iterable[str] | None = None,
    languages: Iterable[str] | None = None,
    locales: Iterable[str] | None = None,
    region: str | None = None,
    settings: Settings | dict[str, Any] | None = None,
    detect_languages_function: Callable[..., list[str]] | None = None,
) -> datetime | None:
    """Parse date and time from given date string.

    :param date_string:
        A string representing date and/or time in a recognizably valid format.
    :type date_string: str

    :param date_formats:
        A list of format strings using directives as given
        `here <https://docs.python.org/2/library/datetime.html#strftime-and-strptime-behavior>`_.
        The parser applies formats one by one, taking into account the detected
        languages/locales. A UTC offset matched by ``%z`` is kept, while a time
        zone name matched by ``%Z`` is ignored. If no format matches, the other
        parsers of the :ref:`PARSERS <settings>` setting are tried; set it to
        ``['custom-formats']`` to use only these formats.
    :type date_formats: list

    :param languages:
        A list of language codes, e.g. ['en', 'es', 'zh-Hant'].
        If locales are not given, languages and region are used to construct locales for translation.
    :type languages: list

    :param locales:
        A list of locale codes, e.g. ['fr-PF', 'qu-EC', 'af-NA'].
        The parser uses only these locales to translate date string.
    :type locales: list

    :param region:
        A region code, e.g. 'IN', '001', 'NE'.
        If locales are not given, languages and region are used to construct locales for translation.
    :type region: str

    :param settings:
        Configure customized behavior using settings defined in :mod:`dateparser.conf.Settings`.
    :type settings: dict

    :param detect_languages_function:
        A function for language detection that takes as input a string (the `date_string`) and
        a `confidence_threshold`, and returns a list of detected language codes.
        Note: this function is only used if ``languages`` and ``locales`` are not provided.
    :type detect_languages_function: function

    :return: Returns :class:`datetime <datetime.datetime>` representing parsed date if successful, else returns None
    :rtype: :class:`datetime <datetime.datetime>`.
    :raises:
        ``ValueError``: Unknown Language, ``TypeError``: Languages argument must be a list,
        ``SettingValidationError``: A provided setting is not valid.
    """
    assert isinstance(settings, Settings)
    parser = _default_parser

    if (
        languages
        or locales
        or region
        or detect_languages_function
        or not settings._default
    ):
        parser = DateDataParser(
            languages=languages,
            locales=locales,
            region=region,
            settings=settings,
            detect_languages_function=detect_languages_function,
        )

    data = parser.get_date_data(date_string, date_formats)
    date_obj: datetime | None = data["date_obj"]
    return date_obj

```

### Core Architecture Module: `dateparser/_parts_of_day.py`
```
from dataclasses import dataclass, fields
from datetime import time
from enum import Enum

import regex as re


class PartOfDay(str, Enum):
    """Part of the day that a date string refers to, e.g. ``"tonight"``.

    See :attr:`DateData.part_of_day <dateparser.date.DateData.part_of_day>`.

    .. versionadded:: 1.5.0
    """

    EARLY_MORNING = "early_morning"
    """Between midnight and dawn, e.g. ``"in the small hours"`` or Spanish
    ``"de madrugada"``."""

    MORNING = "morning"
    AFTERNOON = "afternoon"
    EVENING = "evening"
    NIGHT = "night"


@dataclass(frozen=True)
class PartsOfDay:
    """Time of the day to use for each :class:`PartOfDay`, for the
    ``PARTS_OF_DAY`` :ref:`setting <settings>`.

    .. versionadded:: 1.5.0
    """

    early_morning: time = time(3)
    morning: time = time(9)
    afternoon: time = time(15)
    evening: time = time(18)
    night: time = time(20)

    def __post_init__(self) -> None:
        for field in fields(self):
            value = getattr(self, field.name)
            if not isinstance(value, time):
                raise TypeError(
                    f"{type(self).__name__}.{field.name} must be a datetime.time, "
                    f"not {type(value).__name__}"
                )


_PART_OF_DAY_PATTERN = re.compile(
    r"(?<!\S)(" + "|".join(part.value for part in PartOfDay) + r")(?!\S)"
)
_TIME_PATTERN = re.compile(r"\d\s*(?::|(?:am|pm)(?!\S))")
_MONTHS = (
    "january|february|march|april|may|june|july|august|september|october|"
    "november|december"
)
_TRAILING_NUMBER_PATTERN = re.compile(
    rf"(?<![\d:/.-])(?P<month>(?<!\d\s*)(?:{_MONTHS})\s+)?"
    r"(?P<hour>\d{1,2})(?P<minutes>:\d{2})?\s*$"
)


def _meridiem(part: PartOfDay, hour: int) -> str:
    if part in (PartOfDay.EARLY_MORNING, PartOfDay.MORNING):
        return "am"
    if part is PartOfDay.NIGHT and not 6 <= hour <= 11:
        return "am"
    return "pm"


def _replace_part_of_day(
    translated: str, parts_of_day: PartsOfDay
) -> tuple[str, PartOfDay | None, bool]:
    """Return *translated* with its part-of-day token replaced by a time, the
    matching :class:`PartOfDay` (or ``None``), and whether that time came from
    *parts_of_day*.

    A number right before the part of the day is an hour, e.g. ``"8 in the
    evening"``, unless a month without a day precedes it, e.g. ``"January 8 in
    the evening"``. A part of the day on its own is left in place, so that
    parsing fails."""
    match = _PART_OF_DAY_PATTERN.search(translated)
    if not match:
        return translated, None, False
    part = PartOfDay(match[1])
    before, after = translated[: match.start()], translated[match.end() :]
    number = _TRAILING_NUMBER_PATTERN.search(before)
    if number and not number["month"]:
        hour = int(number["hour"])
        if hour > 12:
            return translated, None, False
        time_string = f"{hour}{number['minutes'] or ':00'} {_meridiem(part, hour)}"
        return f"{before[: number.start()]}{time_string} {after}", part, False
    rest = f"{before} {after}"
    if not rest.strip():
        return translated, None, False
    if _TIME_PATTERN.search(rest):
        return rest, part, False
    part_time: time = getattr(parts_of_day, part.value)
    return f"{rest} {part_time:%H:%M:%S}", part, True

```

### Core Architecture Module: `dateparser/calendars/__init__.py`
```
from collections.abc import Callable
from datetime import datetime, tzinfo
from typing import Any, ClassVar, Protocol

from dateparser.conf import Settings, settings
from dateparser.date import DateData
from dateparser.parser import _parser


class _CalendarParser(Protocol):
    def _parse_with_parts(
        self, datestring: str, settings: Settings
    ) -> tuple[datetime, str | None, tuple[str, ...]]: ...


class _PartlessCalendarParser(Protocol):
    def parse(
        self, datestring: str, settings: Settings
    ) -> tuple[datetime, str | None]: ...


class CalendarBase:
    """Base setup class for non-Gregorian calendar system.

    :param source:
        Date string passed to calendar parser.
    :type source: str
    """

    parser: _CalendarParser | _PartlessCalendarParser = NotImplemented

    def __init__(self, source: str) -> None:
        self.source = source

    def get_date(self) -> DateData | None:
        try:
            if hasattr(self.parser, "_parse_with_parts"):
                date_obj, period, parts = self.parser._parse_with_parts(
                    self.source, settings
                )
            else:
                date_obj, period = self.parser.parse(self.source, settings)
                parts = ()
            return DateData(date_obj=date_obj, period=period, parts=parts)
        except ValueError:
            return None


class non_gregorian_parser(_parser):
    calendar_converter: Any = NotImplemented
    default_year: int = NotImplemented
    default_month: int = NotImplemented
    default_day: int = NotImplemented
    non_gregorian_date_cls: Callable[[int, int, int], Any] = NotImplemented

    _digits: ClassVar[dict[str, int] | None] = None
    _months: ClassVar[dict[str, tuple[Any, ...]] | None] = None
    _weekdays: ClassVar[dict[str, list[str]] | None] = None
    _number_letters: ClassVar[dict[int, list[str]] | None] = None

    @classmethod
    def _replace_time_conventions(cls, source: str) -> str:
        return source

    @classmethod
    def _replace_digits(cls, source: str) -> str:
        return source

    @classmethod
    def _replace_months(cls, source: str) -> str:
        return source

    @classmethod
    def _replace_weekdays(cls, source: str) -> str:
        return source

    @classmethod
    def _replace_time(cls, source: str) -> str:
        return source

    @classmethod
    def _replace_days(cls, source: str) -> str:
        return source

    @classmethod
    def to_latin(cls, source: str) -> str:
        result = source
        result = cls._replace_months(result)
        result = cls._replace_weekdays(result)
        result = cls._replace_digits(result)
        result = cls._replace_days(result)
        result = cls._replace_time(result)
        result = cls._replace_time_conventions(result)

        return result.strip()

    def handle_two_digit_year(self, year: int) -> int:
        raise ValueError

    def _get_datetime_obj(self, **params: Any) -> datetime:
        day = params["day"]
        year = params["year"]
        month = params["month"]
        if not (0 < day <= self.calendar_converter.month_length(year, month)) and not (
            self._token_day or hasattr(self, "_token_weekday")
        ):
            day = self.calendar_converter.month_length(year, month)
        year, month, day = self.calendar_converter.to_gregorian(
            year=year, month=month, day=day
        )
        c_params = params.copy()
        c_params.update({"year": year, "month": month, "day": day})
        return datetime(**c_params)

    def _get_datetime_obj_params(self) -> dict[str, int]:
        if not self.now:
            self._set_relative_base()
        now_year, now_month, now_day = self.calendar_converter.from_gregorian(
            self.now.year, self.now.month, self.now.day
        )
        return {
            "day": self.day or now_day,
            "month": self.month or now_month,
            "year": self.year or now_year,
            "hour": 0,
            "minute": 0,
            "second": 0,
            "microsecond": 0,
        }

    def _get_date_obj(self, token: str, directive: str) -> Any:
        year, month, day = self.default_year, self.default_month, self.default_day
        token_len = len(token)
        is_digit = token.isdigit()
        if directive == "%A" and self._weekdays and token.title() in self._weekdays:
            pass
        elif (
            directive == "%m" and token_len <= 2 and is_digit and 1 <= int(token) <= 12
        ):
            month = int(token)
        elif directive == "%B" and self._months and token in self._months:
            month = self._months[token][0]
        elif (
            directive == "%d"
            and token_len <= 2
            and is_digit
            and 0 < int(token) <= self.calendar_converter.month_length(year, month)
        ):
            day = int(token)
        elif directive == "%Y" and token_len == 4 and is_digit:
            year = int(token)
        elif directive == "%Y" and token_len == 2 and is_digit:
            year = self.handle_two_digit_year(int(token))
        else:
            raise ValueError
        return self.non_gregorian_date_cls(year, month, day)

    @classmethod
    def parse(
        cls,
        datestring: str,
        settings: Settings,
        tz: tzinfo | None = None,
        date_order: str | None = None,
    ) -> tuple[datetime, str | None]:
        date_obj, period, _ = cls._parse_with_parts(
            datestring, settings, tz, date_order
        )
        return date_obj, period

    @classmethod
    def _parse_with_parts(
        cls,
        datestring: str,
        settings: Settings,
        tz: tzinfo | None = None,
        date_order: str | None = None,
    ) -> tuple[datetime, str | None, tuple[str, ...]]:
        datestring = cls.to_latin(datestring)
        return super()._parse_with_parts(datestring, settings, tz, date_order)

```

### Core Architecture Module: `dateparser/calendars/french_republican.py`
```
import re
import unicodedata
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from convertdate import french_republican

from dateparser.calendars import CalendarBase

if TYPE_CHECKING:
    from dateparser.conf import Settings

_MONTHS = {
    name: index
    for index, names in enumerate(
        (
            ("vendemiaire",),
            ("brumaire",),
            ("frimaire",),
            ("nivose",),
            ("pluviose",),
            ("ventose",),
            ("germinal",),
            ("floreal",),
            ("prairial",),
            ("messidor",),
            ("thermidor",),
            ("fructidor",),
            ("sansculottides", "sans-culottides", "jours complementaires"),
        ),
        start=1,
    )
    for name in names
}
_RE_DATE = re.compile(
    rf"(?:(?:(?P<day>\d{{1,2}})(?:er)?\s+)?(?P<month>{'|'.join(_MONTHS)})\s+)?"
    r"an\.?\s+(?:(?P<year>\d{1,3})|(?P<roman>"
    r"C{0,3}(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})))\.?(?:er|e|eme|me)?\.?",
    flags=re.IGNORECASE,
)
_ROMAN_NUMERAL_VALUES = {"C": 100, "L": 50, "X": 10, "V": 5, "I": 1}


def _roman_to_int(numeral: str) -> int:
    values = [_ROMAN_NUMERAL_VALUES[char] for char in numeral.upper()]
    return sum(
        -value if value < next_value else value
        for value, next_value in zip(values, [*values[1:], 0], strict=True)
    )


def _month_length(year: int, month: int) -> int:
    if month < 13:
        return 30
    return 6 if french_republican.leap(year) else 5


class _french_republican_parser:
    @classmethod
    def _parse_with_parts(
        cls, datestring: str, settings: "Settings"
    ) -> tuple[datetime, str | None, tuple[str, ...]]:
        normalized = "".join(
            char
            for char in unicodedata.normalize("NFKD", datestring.strip())
            if not unicodedata.combining(char)
        )
        match = _RE_DATE.fullmatch(normalized)
        if not match or not (match["year"] or match["roman"]):
            raise ValueError(datestring)
        year = int(match["year"]) if match["year"] else _roman_to_int(match["roman"])
        if not year:
            raise ValueError(datestring)
        now = settings.RELATIVE_BASE or datetime.now(tz=timezone.utc).replace(
            tzinfo=None
        )
        _, now_month, now_day = french_republican.from_gregorian(
            now.year, now.month, now.day
        )
        if match["month"]:
            month = _MONTHS[match["month"].lower()]
        else:
            month = {"first": 1, "last": 13}.get(
                settings.PREFER_MONTH_OF_YEAR, now_month
            )
        if match["day"]:
            day = int(match["day"])
        else:
            day = min(
                {"first": 1, "last": 30}.get(settings.PREFER_DAY_OF_MONTH, now_day),
                _month_length(year, month),
            )
        date = datetime(*french_republican.to_gregorian(year, month, day))
        period = "day" if match["day"] else "month" if match["month"] else "year"
        parts = ("year", "month", "day")[: ("year", "month", "day").index(period) + 1]
        return date, period, parts


class FrenchRepublicanCalendar(CalendarBase):
    """Calendar class for the `French Republican calendar
    <https://en.wikipedia.org/wiki/French_Republican_calendar>`_."""

    parser = _french_republican_parser

```

### Core Architecture Module: `dateparser/calendars/hijri.py`
```
from dateparser.calendars import CalendarBase
from dateparser.calendars.hijri_parser import hijri_parser


class HijriCalendar(CalendarBase):
    parser = hijri_parser

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1568** (2026-11-07): **Skip out-of-range month spans during date searches**
  *Symptoms*: With `RETURN_TIME_SPAN=True`, an out-of-range month span raises `ValueError` and prevents `search_dates()` from returning other valid dates in the text:  ```python from datetime import datetime from dateparser.search import search_dates  search_dates(     "the past 120000 months. 2024-01-15",     languages=["en"],     settings={"RETURN_TIME_SPAN": True, "RELATIVE_BASE": datetime(2026, 11, 3)}, ) # Before: ValueError: year -7974 is out of range # After: [('2024-01-15', datetime(2024, 1, 15))] ```  The existing guard handles `OverflowError` from `timedelta` arithmetic, but month spans use `relativedelta`, which raises `ValueError` when the resulting year is outside the supported range. Catch both exceptions around span generation so an unrepresentable span is omitted while previously parsed dates are retained.  Six regression cases cover past and future month spans, including preservation of another date with both the `split` and `ngram` search strategies. All six fail on the unmodified base and pass with the fix.  Validation on macOS arm64, Python 3.12.13, with `TZ=UTC`:  - `pytest tests/test_long_digit_runs.py tests/test_search.py -q`: 462 passed, 31 subtests passed. - `pytest -q`: 25,313 passed, 9 skipped, 4 xfailed, 508 subtests passed. - `tox -e pre-commit`: passed (Ruff lint/format and zizmor).  Other supported Python versions and optional calendar/language-detection dependencies were not tested locally.  Assisted by Codex. 

- **Issue #1566** (2026-11-04): **Stop a Chinese date rule slowing down on long runs of spaces**
  *Symptoms*: Regression from #1477, which is not in any release yet.  ## What was wrong  The rule that reads a date followed by a time ("2020年3月4日 5点6分") in the `zh`, `zh-Hans` and `zh-Hant` data was added by "Parse Chinese and Japanese dates with spaces around 年, 月 and 日" (#1477). It has two adjacent `\s*` around the optional `日`: `(\d{1,2})\s*(?:日)?\s*(\d{1,2})…`. When a date is followed by a long run of spaces and no time, the pattern tries every way of splitting the run between the two `\s*`, so the time grows with the square of the run. The rule only sees text whose spaces were not collapsed, for example `search_dates("1年1月1" + " " * n, languages=["zh"])`; `parse()` collapses spaces before it simplifies the text.  CPU seconds of one `search_dates("1年1月1" + " " * n, languages=["zh"])` call (`time.process_time()`, Python 3.12, one run each):  | n | master | this PR | |---|---|---| | 4,000 / 8,000 / 16,000 / 32,000 | 0.075 / 0.199 / 0.863 / 3.23 | 0.018 / 0.046 / 0.121 / 0.272 |  On master each doubling of the size multiplies the time by 2.7 to 4.3; with this PR it is 2.2 to 2.6.  ## How it is fixed  The optional `日` is written together with the spaces after it: `\s*(?:日\s*)?`. It matches the same strings and leaves one way to match a run of spaces. The rule is in `zh.yaml`, `zh-Hans.yaml` and `zh-Hant.yaml`; the three generated Python files were regenerated with `python -m dateparser_scripts.write_complete_data`, and nothing else in the generated data changed.  ## Tests and checks  * 1

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

### Incident Patch 1: `679bae65` (2026-11-05)
**Commit Message**: Fix parsing time-only strings with a timezone-aware RELATIVE_BASE (#1362)

* Fix parsing time-only strings with a tz-aware RELATIVE_BASE

When RELATIVE_BASE is offset-aware, _correct_for_time_frame localizes
dateobj to UTC so it can be compared with self.now. The subsequent
tz.utcoffset(dateobj) call then receives an aware datetime, which pytz
rejects with "Not naive datetime (tzinfo is already set)". The exception
is not one of the two caught pytz errors, so parsing aborts and
dateparser.parse() returns None for inputs like "3pm".

Pass a naive copy to utcoffset() so the offset lookup works regardless of
whether dateobj was localized. Behaviour with a naive RELATIVE_BASE is
unchanged.

Adds a regression test in tests/test_date_parser.py covering both
PREFER_DATES_FROM directions with an offset-aware RELATIVE_BASE.

Closes #1213

* Annotate the new test for the strict mypy check

Master type-checks the tests with mypy in strict mode, so the new test needs
parameter and return annotations.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Serhii A <[REDACTED_EMAIL]>
Co-authored-by: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

**File**: `dateparser/parser.py` (modified, +3/-1)
```diff
@@ -811,7 +811,9 @@ def _correct_for_time_frame(  # noqa: PLR0912, PLR0915
                 # Convert dateobj to utc time to compare with RELATIVE_BASE
                 try:
                     tz = tz or get_timezone_from_tz_string(self.settings.TIMEZONE)
-                    tz_offset = tz.utcoffset(dateobj) or tz_offset
+                    # `dateobj` may have been localized above when `self.now` is
+                    # offset-aware; `utcoffset()` requires a naive datetime.
+                    tz_offset = tz.utcoffset(dateobj.replace(tzinfo=None)) or tz_offset
                 except (pytz.UnknownTimeZoneError, pytz.NonExistentTimeError):
                     pass
 
```

**File**: `tests/test_date_parser.py` (modified, +22/-0)
```diff
@@ -6,6 +6,7 @@
 from unittest.mock import Mock, patch
 
 import pytest
+import pytz
 from parameterized import param, parameterized
 
 import dateparser.timezone_parser
@@ -788,6 +789,27 @@ def test_preferably_future_dates_leap_year(
         self.then_date_was_parsed_by_date_parser()
         self.then_date_obj_exactly_is(expected)
 
+    @parameterized.expand(
+        [
+            param("3pm", "past", datetime(2020, 6, 15, 18, 0)),
+            param("3pm", "future", datetime(2020, 6, 15, 12, 0)),
+        ]
+    )
+    def test_time_only_with_timezone_aware_relative_base(
+        self, date_string: str, prefer_dates_from: str, relative_base: datetime
+    ) -> None:
+        tz = pytz.timezone("America/Los_Angeles")
+        self.given_parser(
+            settings={
+                "TIMEZONE": "America/Los_Angeles",
+                "PREFER_DATES_FROM": prefer_dates_from,
+                "RELATIVE_BASE": tz.localize(relative_base),
+            }
+        )
+        self.when_date_is_parsed(date_string)
+        self.then_date_was_parsed_by_date_parser()
+        self.then_period_is("day")
+
     @parameterized.expand(
         [
             param("29 Feb", datetime(2020, 1, 1), datetime(2020, 2, 29)),
```

---

### Incident Patch 2: `31b6986d` (2026-11-04)
**Commit Message**: Sort the 1.5.0 security fixes by advisory merge order

**File**: `HISTORY.rst` (modified, +8/-9)
```diff
@@ -42,6 +42,14 @@ Deprecations:
 
 Security fixes:
 
+- Make sentence splitting in ``search_dates()`` linear on long punctuation
+  runs, to prevent quadratic backtracking (ReDoS) for Arabic, Bengali,
+  Cantonese, Chinese, Hindi, Japanese and Persian (`GHSA-rx9v-94ff-9cc2
+  <https://github.com/scrapinghub/dateparser/security/advisories/GHSA-rx9v-94ff-9cc2>`_)
+- Prevent quadratic regex matching (ReDoS) on long digit runs in Chinese and
+  Japanese, and a ``ValueError`` on runs of more than 4,300 digits on Python
+  3.11 and later (`GHSA-g8fh-jxm9-6qfx
+  <https://github.com/scrapinghub/dateparser/security/advisories/GHSA-g8fh-jxm9-6qfx>`_)
 - Bound the lookahead of the Chinese month simplification, to prevent quadratic
   parsing time on long runs of numbers followed by 月 (`GHSA-q7fp-xwcm-6x9f
   <https://github.com/scrapinghub/dateparser/security/advisories/GHSA-q7fp-xwcm-6x9f>`_)
@@ -51,19 +59,10 @@ Security fixes:
 - Strip trailing colons in linear time, to prevent quadratic backtracking
   (ReDoS) on long colon runs (`GHSA-fmxc-97cw-ph6p
   <https://github.com/scrapinghub/dateparser/security/advisories/GHSA-fmxc-97cw-ph6p>`_)
-- Make sentence splitting in ``search_dates()`` linear on long punctuation
-  runs, to prevent quadratic backtracking (ReDoS) for Arabic, Bengali,
-  Cantonese, Chinese, Hindi, Japanese and Persian (`GHSA-rx9v-94ff-9cc2
-  <https://github.com/scrapinghub/dateparser/security/advisories/GHSA-rx9v-94ff-9cc2>`_)
-- Prevent quadratic regex matching (ReDoS) on long digit runs in Chinese and
-  Japanese, and a ``ValueError`` on runs of more than 4,300 digits on Python
-  3.11 and later (`GHSA-g8fh-jxm9-6qfx
-  <https://github.com/scrapinghub/dateparser/security/advisories/GHSA-g8fh-jxm9-6qfx>`_)
 - Split strings into known words in linear time, to prevent quadratic parsing
   time on long runs of words like month names (`GHSA-jxmm-w6rw-32ch
   <https://github.com/scrapinghub/dateparser/security/advisories/GHSA-jxmm-w6rw-32ch>`_)
 
-
 New features:
 
 - Add a ``STRICT_DATE_ORDER`` setting that turns an explicit ``DATE_ORDER``
```

---

### Incident Patch 3: `61022151` (2026-11-04)
**Commit Message**: Reference the fixes of unreleased regressions in the 1.5.0 notes

**File**: `HISTORY.rst` (modified, +6/-5)
```diff
@@ -57,7 +57,7 @@ New features:
 - Parse parts of the day, such as "tomorrow morning", "this evening" or
   "8 in the evening", at the times set by the new ``PARTS_OF_DAY`` setting;
   the new ``DateData.part_of_day`` attribute tells which one was found
-  (#1473)
+  (#1473, #1562)
 - Add ``DateData.parts``, which lists the date parts (day, month, year,
   time…) read from the input rather than filled in from defaults (#1408)
 - Add an ``add_period`` argument to ``search_dates()`` to also return the
@@ -103,7 +103,7 @@ New features:
   - next to a relative date without a comma (#1385)
   - joined by words that search skips, like "and" (#1488)
   - inside parentheses, square brackets or straight quotes, e.g.
-    ``'He said "May 5, 2020"'`` or "(Friday)" (#1401)
+    ``'He said "May 5, 2020"'`` or "(Friday)" (#1401, #1565)
 
 Fixes:
 
@@ -133,7 +133,7 @@ Fixes:
   20 March 2021 instead of the 23rd of the current month (#1554)
 - Return ``None`` for strings with only skipped words, such as "year" or
   "hour minute", instead of today, which also stops ``search_dates()`` from
-  returning them (#1440)
+  returning them (#1440, #1564)
 - Stop ignoring numbers without a unit in relative dates, so "03/06/2020
   hour", "03/06/2020 day" or "01.02.2011 godz. 08:39" no longer parse as a
   number of hours or days ago (#1410)
@@ -194,7 +194,8 @@ Improvements:
 - Chinese: add the supplementary data of ``zh`` to ``zh-Hans`` and
   ``zh-Hant`` (#1407), and parse 后天, 大后天 and 大前天 as relative days
   (#1430)
-- Chinese and Japanese: parse dates with spaces around 年, 月 and 日 (#1477)
+- Chinese and Japanese: parse dates with spaces around 年, 月 and 日 (#1477,
+  #1566)
 - French: parse "midi" as noon, e.g. "demain à midi" ("après-midi" and
   "avant midi" are still not read as noon); this also applies when no
   ``languages`` are given, so ``search_dates()`` can return "MIDI" in an
@@ -205,7 +206,7 @@ Improvements:
 - Slovak: parse "pozajtra" (#1430)
 - Swedish: parse ordinal day suffixes like "24:e" and "1:a" (#1484)
 - Thai: parse relative dates with spaced ago/in words (#1411)
-- Vietnamese: parse dates with zero-padded months (#1338)
+- Vietnamese: parse dates with zero-padded months (#1338, #1563)
 - Add type hints (#1457)
 - Document ``search_dates()`` in the API reference (#1468), add a
   performance section (#1494), explain how ``DEFAULT_LANGUAGES`` relates to
```

#### Recent Merged Pull Requests:
- **PR #1568** (closed): Skip out-of-range month spans during date searches (@Yongthyuan)
- **PR #1566** (2026-11-04): Stop a Chinese date rule slowing down on long runs of spaces (@serhii73)
- **PR #1565** (2026-11-04): Stop search_dates() slowing down on long runs of brackets (@serhii73)
- **PR #1564** (2026-11-04): Stop search_dates slowing down on long runs of words that do not parse (@serhii73)
- **PR #1563** (2026-11-04): Stop zero-padded Vietnamese months making English text look Vietnamese (@serhii73)
- **PR #1562** (2026-11-04): Fix importing dateparser_data.settings before dateparser (@serhii73)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. parsing time-only strings with a timezone-aware RELATIVE_BASE (#1362)

**RULE**:
When implementing operations in `dateparser/parser.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in scrapinghub/dateparser. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `679bae65`: parsing time-only strings with a timezone-aware RELATIVE_BASE (#1362). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `dateparser/parser.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
                    # `dateobj` may have been localized above when `self.now` is
                    # offset-aware; `utcoffset()` requires a naive datetime.
                    tz_offset = tz.utcoffset(dateobj.replace(tzinfo=None)) or tz_offset
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
                    tz_offset = tz.utcoffset(dateobj) or tz_offset
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `679bae65` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
