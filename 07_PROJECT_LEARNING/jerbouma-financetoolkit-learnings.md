# Forensic Learning Record (Deep Inspection): JerBouma/FinanceToolkit

> **Canonical Artifact**: `07_PROJECT_LEARNING/jerbouma-financetoolkit-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/JerBouma/FinanceToolkit](https://github.com/JerBouma/FinanceToolkit))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:26:39.898Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `JerBouma/FinanceToolkit`
- **Description**: Transparent and Efficient Financial Analysis
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 5402 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `financetoolkit/utilities/dataframe_model.py`
```
"""Dataframe Module"""

__docformat__ = "google"

from collections.abc import Mapping

import pandas as pd

from financetoolkit.utilities import logger_model

logger = logger_model.get_logger()


def combine_dataframes(dataset_dictionary: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """
    Combine the dataframes from different companies of the same financial statement,
    e.g. the balance sheet statement, into a single dataframe.

    Args:
        dataset_dictionary (dict[str, pd.DataFrame]): A dictionary containing the
        dataframes for each company. It should have the structure key: ticker,
        value: dataframe.

    Returns:
        pd.DataFrame: A pandas DataFrame with the combined financial statements.
    """
    combined_df = pd.concat(dict(dataset_dictionary), axis=0)

    return combined_df.sort_index(level=0, sort_remaining=False)


def equal_length(
    dataset1: pd.DataFrame, dataset2: pd.DataFrame
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Equalize the length of two datasets by adding zeros to the beginning of the shorter dataset.

    Args:
        dataset1 (pd.DataFrame): The first dataset to be equalized, with periods as columns.
        dataset2 (pd.DataFrame): The second dataset to be equalized, with periods as columns.

    Returns:
        tuple[pd.DataFrame, pd.DataFrame]: The equalized datasets.
    """
    if int(dataset1.columns[0]) > int(dataset2.columns[0]):
        for value in range(
            int(dataset1.columns[0]) - 1, int(dataset2.columns[0]) - 1, -1
        ):
            dataset1.insert(0, value, 0.0)
        dataset1 = dataset1.sort_index()
    elif int(dataset1.columns[0]) < int(dataset2.columns[0]):
        for value in range(
            int(dataset2.columns[0]) - 1, int(dataset1.columns[0]) - 1, -1
        ):
            dataset2.insert(0, value, 0.0)
        dataset2 = dataset2.sort_index()

    return dataset1, dataset2


def filter_columns(
    result: pd.DataFrame | pd.Series | dict | object,
    show_columns: list[str] | None,
) -> pd.DataFrame | pd.Series | dict | object:
    """Filter a Finance Toolkit result to only include the specified columns.

    Works on pd.DataFrame, dicts of pd.DataFrame (multi-ticker financial
    statements), and passes through pd.Series, scalars, and any other type
    unchanged.  When *show_columns* is None the result is returned unmodified.

    Args:
        result: The value returned by a controller ``get_*`` method.
        show_columns: Column names to keep.  For MultiIndex columns every level
            is searched, outermost first, so a name occurring on an inner level
            (such as a factor model coefficient under a ticker) is matched too.
            Invalid names are logged as warnings; if none of the requested
            columns exist the original result is returned unchanged and that is
            reported explicitly.

    Returns:
        The filtered result, or *result* unchanged when filtering cannot be
        applied or *show_columns* is None.
    """
    if show_columns is None:
        return result

    if isinstance(result, pd.DataFrame):
        return _filter_dataframe_columns(result, show_columns)

    if isinstance(result, dict):
        return {
            key: (
                _filter_dataframe_columns(value, show_columns)
                if isinstance(value, pd.DataFrame)
                else value
            )
            for key, value in result.items()
        }

    return result


def _filter_dataframe_columns(
    df: pd.DataFrame,
    show_columns: list[str],
) -> pd.DataFrame:
    """Internal helper: filter a single DataFrame to *show_columns*.

    Resolution order:
        1. MultiIndex *columns* — filter by any column level, outermost first (e.g.
        OHLCV type in historical data where columns are ``(metric, ticker)``, or a
        coefficient name in a factor model where columns are ``(ticker, coefficient)``).
        2. Flat *columns* — filter columns whose string representation appears in
        *show_columns*.
        3. MultiIndex *index* (fallback) — filter by the last index level (e.g.
        financial-statement line items in multi-ticker data where the row index
        is ``(ticker, line_item)``).
        4. Flat *index* (fallback) — filter by the index values whose string
        representation appears in *show_columns* (e.g. single-ticker income
        statement where rows are individual line items).

    If none of the above yield any matches the original DataFrame is returned
    unchanged and a warning is logged.
    """
    if df.empty:
        return df

    # MultiIndex columns. Every level is searched, not only the first: a factor model is indexed by (ticker, coefficient), so asking for "Intercept" matched nothing at level 0 and the unfiltered frame came back as though the filter had been applied.  # noqa: E501
    if isinstance(df.columns, pd.MultiIndex):
        mask = pd.Series(False, index=range(len(df.columns)))
        matched: list[str] = []
        available: list[str] = []

        for level in range(df.columns.nlevels):
            level_values = df.columns.get_level_values(level)
            level_available = [str(value) for value in level_values.unique()]
            available.extend(
                value for value in level_available if value not in available
            )
            # Only names not already resolved at a shallower level, so that a name occurring at two levels resolves at the outermost one.  # noqa: E501
            level_valid = [
                column
                for column in show_columns
                if column in level_available and column not in matched
            ]

            if level_valid:
                mask |= pd.Series(level_values.isin(level_valid).tolist())
                matched.extend(level_valid)

        for column in show_columns:
            if column not in matched:
                logger.warning(
                    "Column '%s' not found. Valid columns: %s", column, available
                )

        if matched:
            return df.loc[:, mask.to_numpy()]

        logger.warning(
            "None of the requested columns %s exist, so the result is returned "
            "unfiltered. Valid columns: %s",
            show_columns,
            available,
        )
        return df

    # Flat columns
    available_cols = [str(c) for c in df.columns]
    col_map = {str(c): c for c in df.columns}
    valid_cols = [c for c in show_columns if c in available_cols]

    if valid_cols:
        return df[[col_map[c] for c in valid_cols]]

    # Row-index fallback (financial statements)
    if isinstance(df.index, pd.MultiIndex):
        level_values = df.index.get_level_values(-1)
        available_idx = [str(v) for v in level_values.unique()]
        idx_map = {str(v): v for v in level_values.unique()}
        valid_idx = [c for c in show_columns if c in available_idx]
        if valid_idx:
            mask = level_values.isin([idx_map[c] for c in valid_idx])
            filtered = df[mask]
            # A last level reduced to one value repeats, so drop it and index by ticker.
            if len(filtered.index.get_level_values(-1).unique()) == 1:
                filtered.index = filtered.index.droplevel(-1)
            return filtered
    else:
        available_idx = [str(v) for v in df.index.unique()]
        idx_map = {str(v): v for v in df.index.unique()}
        valid_idx = [c for c in show_columns if c in available_idx]
        if valid_idx:
            filtered = df.loc[[idx_map[c] for c in valid_idx]]
            # One metric row means the label is known, so squeeze to period to value.
            if len(filtered) == 1:
                return filtered.squeeze()
            return filtered

    all_available = available_cols + (
        available_idx
        if not isinstance(df.index, pd.MultiIndex)
        else [str(v) for v in df.index.get_level_values(-1).unique()]
    )
    logger.warning(
        "show_columns %s not matched in columns or index. Available: %s",
        show_columns,
        all_available,
    )
    return df


def to_dataframe(data: object) -> pd.DataFrame:
    """
    Narrows a pandas result to a DataFrame, for the operations the stubs describe as
    returning a Series or a DataFrame (an unstack, a row lookup, a column selection)
    at the places where the shape of the data guarantees a DataFrame.

    Args:
        data (object): The pandas result to narrow.

    Returns:
        pd.DataFrame: The same object, narrowed to a DataFrame.

    Raises:
        TypeError: If the result is not a DataFrame.
    """
    if not isinstance(data, pd.DataFrame):
        raise TypeError(
            f"Expected a DataFrame but received {type(data).__name__}; the data does "
            "not have the shape this calculation relies on."
        )

    return data


def to_series(data: object) -> pd.Series:
    """
    The Series counterpart of `to_dataframe`, for the operations the stubs describe
    as returning a Series or a DataFrame at the places where a Series is guaranteed.

    Args:
        data (object): The pandas result to narrow.

    Returns:
        pd.Series: The same object, narrowed to a Series.

    Raises:
        TypeError: If the result is not a Series.
    """
    if not isinstance(data, pd.Series):
        raise TypeError(
            f"Expected a Series but received {type(data).__name__}; the data does not "
            "have the shape this calculation relies on."
        )

    return data


def concat_frames(frames: Mapping[str, object]) -> pd.DataFrame:
    """
    Stacks a mapping of DataFrames into one DataFrame keyed by the mapping's keys.

    The model functions are annotated for scalar, Series and DataFrame inputs alike, so
    their results carry that wide union even though the controllers only ever hand them
    DataFrames. Narrowing happens here, once, instead of at every call site, and a
    result that is not a DataFrame
```

### Core Architecture Module: `financetoolkit/utilities/error_model.py`
```
"""Error Module"""

__docformat__ = "google"

import inspect
import os

import pandas as pd

from financetoolkit.utilities import logger_model

logger = logger_model.get_logger()


# pylint: disable=comparison-with-itself,too-many-locals,protected-access

# Set FINANCETOOLKIT_STRICT_ERRORS to 1 (or true/yes/on) to make every failure inside a metric raise instead of being reported and returned as an empty Series; this is what a test suite or a scheduled job should run with, since it turns a quietly missing number into an immediate, traceable failure.  # noqa: E501
STRICT_ERRORS_ENVIRONMENT_VARIABLE = "FINANCETOOLKIT_STRICT_ERRORS"

# AttributeError and TypeError cannot be produced by financial data that is merely incomplete; they mean the code asked an object for something it does not have, and there is no value that can be returned for them that is not a lie, so they always raise.  # noqa: E501
ALWAYS_RAISED_ERRORS = (AttributeError, TypeError)


def use_strict_errors() -> bool:
    """
    Reports whether strict error handling is enabled, in which case every failure inside
    a metric is raised rather than reported and replaced by an empty Series.

    Returns:
        bool: whether strict error handling is enabled.
    """
    return os.environ.get(STRICT_ERRORS_ENVIRONMENT_VARIABLE, "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def get_tickers_from_arguments(args: tuple) -> str:
    """
    Recovers the tickers a failing metric was calculating for, so that the error message
    names the companies involved rather than only the metric.

    Args:
        args (tuple): the positional arguments the decorated function was called with.
            The first is the controller instance for every method this decorator is
            applied to.

    Returns:
        str: a comma separated list of tickers, or "unknown" when they cannot be
        recovered from the arguments.
    """
    tickers = getattr(args[0], "_tickers", None) if args else None

    if isinstance(tickers, str):
        return tickers
    if isinstance(tickers, list) and tickers:
        return ", ".join(str(ticker) for ticker in tickers)

    return "unknown"


def handle_errors(func):
    """
    Decorator that reports failures inside a metric calculation instead of letting them
    propagate as a raw traceback, so that one unavailable line item does not abort an
    entire analysis.

    Silently returning an empty Series where a number was expected is the worst outcome
    a financial library can produce, so the behaviour is deliberately split by what the
    exception actually says about the data:

        - KeyError and IndexError mean a line item the calculation needs is not in the
          statements, which is a genuine and common gap between data providers rather
          than a defect. These are logged as an error naming the metric, the tickers and
          the missing item, and an empty Series is returned.
        - ValueError and ZeroDivisionError mean the data is present but could not be
          computed with. These are logged as an error, with the traceback attached so
          the failing line is identifiable, and an empty Series is returned.
        - AttributeError and TypeError cannot be caused by incomplete financial data at
          all; they mean the code is wrong. These are always raised.

    Setting the FINANCETOOLKIT_STRICT_ERRORS environment variable to 1 raises every
    exception instead, which is the appropriate setting for a test suite or a scheduled
    job where an empty result must not pass unnoticed.

    Args:
        func (function): The function to be decorated.

    Returns:
        function: The decorated function, which returns an empty Series of dtype object
        in place of a result whenever a reported failure occurs.

    Raises:
        AttributeError: If the calculation asks an object for an attribute it lacks.
        TypeError: If the calculation is performed on an unsupported type.
        Exception: Any exception at all when strict error handling is enabled.
    """

    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except ALWAYS_RAISED_ERRORS as error:
            logger.error(
                "%s failed for %s with a %s (%s), which indicates a defect rather than "
                "missing data.",
                func.__name__,
                get_tickers_from_arguments(args),
                type(error).__name__,
                error,
            )
            raise
        except KeyError as error:
            if use_strict_errors():
                raise
            logger.error(
                "%s could not be calculated for %s because the item %s is missing from "
                "the provided financial statements. Fill this row to obtain the metric.",
                func.__name__,
                get_tickers_from_arguments(args),
                error,
            )
            return pd.Series(dtype="object")
        except IndexError as error:
            if use_strict_errors():
                raise
            logger.error(
                "%s could not be calculated for %s due to missing data. %s: %s",
                func.__name__,
                get_tickers_from_arguments(args),
                type(error).__name__,
                error,
            )
            return pd.Series(dtype="object")
        except ZeroDivisionError as error:
            if use_strict_errors():
                raise
            logger.error(
                "%s could not be calculated for %s due to a division by zero. %s: %s",
                func.__name__,
                get_tickers_from_arguments(args),
                type(error).__name__,
                error,
            )
            return pd.Series(dtype="object")
        except ValueError as error:
            if use_strict_errors():
                raise
            logger.error(
                "%s could not be calculated for %s. %s: %s",
                func.__name__,
                get_tickers_from_arguments(args),
                type(error).__name__,
                error,
                exc_info=True,
            )
            return pd.Series(dtype="object")

    # These steps are there to ensure the docstring of the function remains intact
    wrapper.__doc__ = func.__doc__
    wrapper.__name__ = func.__name__
    wrapper.__signature__ = inspect.signature(func)
    wrapper.__module__ = func.__module__

    return wrapper


def check_for_error_messages(
    dataset_dictionary: dict[str, pd.DataFrame],
    user_subscription: str,
    required_subscription: str = "Premium",
    delete_tickers: bool = True,
):
    """
    This functionality checks whether any of the defined errors are found in the
    dataset and if they are, report them accordingly. This function is written
    to prevent spamming the command line with error messages.

    Args:
        dataset_dictionary (dict[str, pd.DataFrame]): a dictionary with the ticker
        as key and the dataframe as value.
        user_subscription (str): the subscription type of the user.
        required_subscription (str): the subscription the requested data needs. Defaults to "Premium".
        delete_tickers (bool): whether to delete the tickers that have an error from the
        dataset dictionary. Defaults to True.
    """

    not_available = []
    premium_query_parameter = []
    exclusive_endpoint = []
    special_endpoint = []
    bandwidth_limit_reach = []
    limit_reach = []
    yfinance_rate_limit_reached = []
    yfinance_rate_limit_reached_fallback = []
    yfinance_rate_limit_or_no_data_found = []
    yfinance_rate_limit_or_no_data_found_fallback = []
    no_data = []
    us_stocks_only = []
    invalid_api_key = []
    no_errors = []
    request_failed = []

    for ticker, dataframe in dataset_dictionary.items():
        if "PREMIUM QUERY PARAMETER" in dataframe.columns:
            premium_query_parameter.append(ticker)
        if "EXCLUSIVE ENDPOINT" in dataframe.columns:
            exclusive_endpoint.append(ticker)
        elif "SPECIAL ENDPOINT" in dataframe.columns:
            special_endpoint.append(ticker)
        elif "NOT AVAILABLE" in dataframe.columns:
            not_available.append(ticker)
        elif "BANDWIDTH LIMIT REACH" in dataframe.columns:
            bandwidth_limit_reach.append(ticker)
        elif "LIMIT REACH" in dataframe.columns:
            limit_reach.append(ticker)
        elif "YFINANCE RATE LIMIT OR NO DATA FOUND FALLBACK" in dataframe.columns:
            yfinance_rate_limit_or_no_data_found_fallback.append(ticker)
        elif "YFINANCE RATE LIMIT OR NO DATA FOUND" in dataframe.columns:
            yfinance_rate_limit_or_no_data_found.append(ticker)
        elif "YFINANCE RATE LIMIT REACHED FALLBACK" in dataframe.columns:
            yfinance_rate_limit_reached_fallback.append(ticker)
        elif "YFINANCE RATE LIMIT REACHED" in dataframe.columns:
            yfinance_rate_limit_reached.append(ticker)
        elif "NO DATA" in dataframe.columns:
            no_data.append(ticker)
        elif "US STOCKS ONLY" in dataframe.columns:
            us_stocks_only.append(ticker)
        elif "INVALID API KEY" in dataframe.columns:
            invalid_api_key.append(ticker)
        elif "REQUEST FAILED" in dataframe.columns:
            request_failed.append(ticker)
        elif "NO ERRORS" in dataframe.columns:
            no_errors.append(ticker)

    if premium_query_parameter:
        logger.error(
            "The following tickers are using a premium query parameter from Financial Modeling Prep: %s.\n"
            "This is not available in your current plan. Consider upgrading your plan to a higher plan. "
            "You can get 15%% off by using the following affiliate link which also supports the project: "
            "https://www.jeroenbouma.com/fmp",
            ", ".join(premium_query_parameter),
        )

    if exclu
```

### Core Architecture Module: `financetoolkit/utilities/logger_model.py`
```
"""Logger Module"""

__docformat__ = "google"

import logging
import sys

# pylint: disable=too-few-public-methods


def setup_logger(log_level=logging.INFO):
    """
    Set up and configure a logger with timestamp formatting.

    Args:
        log_level (int, optional): Logging level, by default logging.INFO

    Returns:
        logging.Logger: Configured logger instance
    """
    # Create logger
    logger = logging.getLogger("financetoolkit")

    # Don't override existing level if it's already been set
    if logger.level == 0:
        logger.setLevel(log_level)

    # Check if logger already has handlers to avoid duplicate handlers
    if not logger.handlers:
        # stderr always: stdout is reserved for JSON-RPC under stdio transport.
        console_handler = logging.StreamHandler(sys.stderr)
        console_handler.setLevel(log_level)

        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        console_handler.setFormatter(formatter)

        logger.addHandler(console_handler)

    # Prevents duplicate emission through third-party root handlers on stdout.
    logger.propagate = False

    return logger


def get_logger():
    """
    Get an existing logger or create a new one if it doesn't exist.

    Args:
        name (str, optional): Name of the logger, by default "financetoolkit"

    Returns:
        logging.Logger: Logger instance
    """
    return logging.getLogger("financetoolkit")

```

### Core Architecture Module: `financetoolkit/utilities/requests_model.py`
```
"""Requests Module"""

__docformat__ = "google"

import re

import requests
from requests.adapters import HTTPAdapter

from financetoolkit.utilities import logger_model

logger = logger_model.get_logger()

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/136.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}

# Sized comfortably above the default number of worker threads (see helpers.DEFAULT_MAX_WORKERS) so that every concurrent API call can keep its connection alive; a larger worker count still works, urllib3 simply discards the surplus connections after use.  # noqa: E501
CONNECTION_POOL_SIZE = 32


def build_session() -> requests.Session:
    """
    Builds the shared Session that every request in the Finance Toolkit goes through.

    A single Session reuses TCP connections and TLS handshakes across calls to the same
    host, which matters a great deal here: collecting data for a large ticker universe
    means hundreds of requests to the same handful of API hosts, and without pooling
    every single one would pay for its own handshake. The Session is created once at
    import time and is safe to share across the worker threads used for concurrent
    API calls, since it is never mutated afterwards.

    Returns:
        requests.Session: The configured Session with enlarged connection pools.
    """
    session = requests.Session()

    adapter = HTTPAdapter(
        pool_connections=CONNECTION_POOL_SIZE,
        pool_maxsize=CONNECTION_POOL_SIZE,
    )

    session.mount("https://", adapter)
    session.mount("http://", adapter)

    return session


SESSION = build_session()


def get_request(
    url: str,
    timeout: int = 60,
    extra_headers: dict | None = None,
) -> requests.Response:
    """
    Make an HTTP GET request with automatic SSL fallback for corporate proxies
    and environments with self-signed certificates.

    Args:
        url (str): The URL to request.
        timeout (int): Request timeout in seconds.
        extra_headers (dict | None): Additional headers merged on top of the default HEADERS,
            e.g. {"Authorization": "Bearer <token>"}. Defaults to None.

    Returns:
        requests.Response: The HTTP response object.

    Raises:
        requests.exceptions.RequestException: If the request fails even without SSL verification.
    """
    headers = {**HEADERS, **(extra_headers or {})}
    try:
        response = SESSION.get(url, headers=headers, timeout=timeout, verify=True)
        response.raise_for_status()
        return response
    except requests.exceptions.SSLError:
        logger.warning(
            "SSL certificate verification failed for %s. Retrying without verification. "
            "This is common in corporate networks with self-signed certificates.",
            url,
        )
        response = SESSION.get(
            url, headers=headers, timeout=timeout, verify=False  # noqa
        )
        response.raise_for_status()
        return response


def convert_isin_to_ticker(isin_code: str) -> str:
    """
    Converts an ISIN code to a ticker symbol using Yahoo Finance search.

    Args:
        isin_code (str): The ISIN code to convert.

    Returns:
        str: The corresponding ticker symbol if found, otherwise the original ISIN code.
    """
    if bool(re.match("^([A-Z]{2})([A-Z0-9]{9})([0-9])$", isin_code)):
        try:
            response = get_request(
                f"https://query2.finance.yahoo.com/v1/finance/search?q={isin_code}",
                timeout=60,
            )

            data = response.json()

            if data.get("quotes"):
                symbol = data["quotes"][0]["symbol"]
                logger.info("Converted ISIN %s to ticker %s", isin_code, symbol)

                return symbol

            logger.warning(
                "Could not find a ticker for ISIN %s. Returning ISIN.", isin_code
            )
            return isin_code

        except requests.exceptions.RequestException as e:
            logger.warning(
                "Request failed for ISIN %s: %s. Returning ISIN.", isin_code, e
            )
            return isin_code
        except (KeyError, ValueError, IndexError):
            logger.warning(
                "Could not parse response for ISIN %s. Returning ISIN.", isin_code
            )
            return isin_code
    else:
        # If it's not a valid ISIN format, return the original input
        return isin_code

```

### Core Architecture Module: `financetoolkit/utilities/statistics_model.py`
```
"""Statistics Module"""

__docformat__ = "google"

import warnings

import numpy as np
import pandas as pd

from financetoolkit.utilities import logger_model

logger = logger_model.get_logger()

# pylint: disable=comparison-with-itself,too-many-locals

# Period to pandas frequency, shared so every period calculation agrees.
PERIOD_TRANSLATION = {
    "weekly": "W",
    "monthly": "M",
    "quarterly": "Q",
    "yearly": "Y",
}

# Scales a daily Variance or Volatility by the trading days in a period.
VOLATILITY_WINDOW_TRANSLATION = {
    "weekly": 252 / 52,
    "monthly": 252 / 12,
    "quarterly": 252 / 4,
    "yearly": 252,
}

# The number of observations of each period within a single year.
PERIODS_PER_YEAR = {
    "daily": 252,
    "weekly": 52,
    "monthly": 12,
    "quarterly": 4,
    "yearly": 1,
}


def convert_annualized_rate_to_period(
    annualized_rate: pd.Series | pd.DataFrame | float, period: str
) -> pd.Series | pd.DataFrame | float:
    """
    Converts an annualized rate, such as a Treasury yield, into the equivalent rate for
    a single period of the given frequency.

    Rates like the risk-free rate are quoted on an annual basis. Subtracting them from a
    daily, weekly, monthly or quarterly return without conversion mixes two different
    time scales and makes every excess return wrong by roughly the annual rate. The
    conversion is geometric so that compounding the result over a full year reproduces
    the original annualized rate.

    The formula is as follows:

        Period Rate = (1 + Annualized Rate)^(1 / Periods per Year) - 1

    Args:
        annualized_rate (pd.Series | pd.DataFrame | float): the annualized rate to convert.
        period (str): the period to convert the rate to. Must be one of daily, weekly,
            monthly, quarterly or yearly.

    Raises:
        ValueError: If the period is not one of the supported frequencies.

    Returns:
        pd.Series | pd.DataFrame | float: the rate expressed per single period. A yearly
        period returns the rate unchanged.
    """
    if period not in PERIODS_PER_YEAR:
        raise ValueError(
            f"Period {period} is not valid. It should be one of "
            f"{', '.join(PERIODS_PER_YEAR)}."
        )

    return (1 + annualized_rate) ** (1 / PERIODS_PER_YEAR[period]) - 1


def finalize_dataset(
    dataset: pd.Series | pd.DataFrame,
    start_date: str | None,
    end_date: str | None,
    default_rounding: int | None,
    growth: bool = False,
    lag: int | list[int] = 1,
    rounding: int | None = None,
    standardize: bool = False,
    axis: str = "columns",
    row_slice: bool = False,
    apply_slice: bool = True,
    rolling: int | None = None,
    trailing: int | None = None,
    dropna: bool = False,
    countries: list[str] | str | None = None,
    indicator_name: str = "",
) -> pd.Series | pd.DataFrame:
    """
    Shared post-processing for every Finance Toolkit metric, used across the Ratios,
    Risk, Performance, Models, Technicals, Economics and Fixed Income modules: optional
    rolling-window smoothing, optional trailing-window summation, growth conversion,
    Z-Score standardization (applied on top of the growth values when growth is also
    requested), rounding, date range slicing, optional dropping of all-NaN rows and
    optional country filtering.

    Growth and standardization are always computed on the full dataset before the date
    range is applied, since growth needs history from before the display window to
    calculate the correct value for the first rows within it.

    Args:
        dataset (pd.Series | pd.DataFrame): The raw metric values.
        start_date (str | None): The start date to slice the results to.
        end_date (str | None): The end date to slice the results to.
        default_rounding (int | None): The rounding to fall back to when rounding is None.
        growth (bool, optional): Whether to return the growth of the metric instead of
            the actual values. Defaults to False.
        lag (int | list[int], optional): The number of periods to lag the growth data.
            Defaults to 1.
        rounding (int | None, optional): The number of decimals to round the results to.
            Defaults to None, which falls back to default_rounding.
        standardize (bool, optional): Whether to standardize (Z-Score) the result. When
            combined with growth, the growth values are standardized instead of the raw
            values. Defaults to False.
        axis (str, optional): The axis growth and standardization are computed over. Use
            "columns" (default) when each row is an entity observed over time (e.g. ratios
            indexed by ticker with periods as columns). Use "rows" or "index" when each
            column is the series to observe over time (e.g. risk, performance, technical
            or economic indicators indexed by date with tickers or countries as columns).
            Defaults to "columns".
        row_slice (bool, optional): Whether to slice the date range by row index
            (dataset.loc[start_date:end_date]) instead of by column (the default,
            dataset.loc[:, start_date:end_date]). Defaults to False.
        apply_slice (bool, optional): Whether to slice the date range at all. Set to
            False when the caller already applies its own (e.g. conditional) date range
            slicing before calling this function. Defaults to True.
        rolling (int | None, optional): The rolling window size to use for smoothing the
            data (simple moving average) before growth/standardization. Defaults to None.
        trailing (int | None, optional): The trailing window size to use for summing the
            data over trailing periods (e.g. a trailing-4-quarter sum) before
            growth/standardization. Defaults to None.
        dropna (bool, optional): Whether to drop rows that are entirely NaN after growth
            and standardization have been applied. Defaults to False.
        countries (list[str] | str | None, optional): A list of countries or a single
            country to include in the results. Defaults to None.
        indicator_name (str, optional): The human-readable name of the indicator, used in
            the missing-country warning message. Defaults to "".

    Returns:
        pd.Series | pd.DataFrame: The processed metric values.
    """
    # Explicitly compare to None so that rounding=0 is honoured rather than treated as "not supplied", and so that rounding=None disables rounding altogether.  # noqa: E501
    rounding = rounding if rounding is not None else default_rounding

    if rolling:
        dataset = dataset.rolling(window=rolling).mean()

    if trailing:
        dataset = dataset.rolling(window=trailing).sum()

    if growth:
        dataset = calculate_growth(
            dataset=dataset, lag=lag, rounding=rounding, axis=axis
        )

    if standardize:
        dataset = calculate_standardization(
            dataset=dataset, rounding=rounding, axis=axis
        )
    elif not growth:
        dataset = apply_rounding(dataset, rounding)

    if dropna:
        dataset = dataset.dropna(how="all", axis=0)

    if apply_slice:
        dataset = (
            dataset.loc[start_date:end_date]
            if row_slice
            else dataset.loc[:, start_date:end_date]
        )

    if countries:
        # Economic indicators are indexed by date with countries as columns.
        if isinstance(countries, str):
            countries = [countries]
        missing_countries = [
            country for country in countries if country not in dataset.columns
        ]
        if missing_countries:
            logger.warning(
                f"The following countries are not available for {indicator_name}: {missing_countries}"
            )
        dataset = dataset[
            [country for country in countries if country not in missing_countries]
        ]

    return dataset


def to_period_index(index: pd.Index) -> pd.PeriodIndex:
    """
    Returns the given index as a PeriodIndex, which is what every period based
    calculation in the package expects its historical data to be indexed by.

    Historical data is period indexed from the moment it is collected, so this is a
    check rather than a conversion: a frame that lost its PeriodIndex somewhere along
    the way (for example through a reset_index) would otherwise fail deep inside a
    calculation with an unhelpful AttributeError on `asfreq`.

    Args:
        index (pd.Index): The index of a historical dataset.

    Returns:
        pd.PeriodIndex: The same index, narrowed to a PeriodIndex.

    Raises:
        TypeError: If the index is not a PeriodIndex.
    """
    if not isinstance(index, pd.PeriodIndex):
        raise TypeError(
            f"Expected a PeriodIndex, got {type(index).__name__}. Historical data must "
            "be indexed by periods for period based calculations."
        )

    return index


def to_multi_index(index: pd.Index) -> pd.MultiIndex:
    """
    Returns the given index as a MultiIndex, for the places that reshape a frame
    (an unstack, a concat with keys) and then operate on the resulting levels.

    Args:
        index (pd.Index): The index or columns of a reshaped dataset.

    Returns:
        pd.MultiIndex: The same index, narrowed to a MultiIndex.

    Raises:
        TypeError: If the index is not a MultiIndex.
    """
    if not isinstance(index, pd.MultiIndex):
        raise TypeError(
            f"Expected a MultiIndex but received {type(index).__name__}; the "
            "reshaping step before this point did not produce the expected levels."
        )

    return index


def to_datetime_index(index: pd.Index) -> pd.DatetimeIndex:
    """
    Returns the given index as a DatetimeIndex, the counterpart of `to_period_index`
    for the within-period helpers that nest each observation under its period.

    Args:
        index (pd.Index)
```

### Core Architecture Module: `financetoolkit/utilities/validation_model.py`
```
"""Validation Module"""

__docformat__ = "google"

import re
from collections import Counter

from financetoolkit.utilities import logger_model
from financetoolkit.utilities.requests_model import convert_isin_to_ticker

logger = logger_model.get_logger()

RISK_FREE_RATE_OPTIONS = ["13w", "5y", "10y", "30y"]
ENFORCE_SOURCE_OPTIONS = [None, "FinancialModelingPrep", "YahooFinance"]
INTRADAY_PERIOD_OPTIONS = ["1min", "5min", "15min", "30min", "1hour"]

# The api_key every documentation example uses, so receiving it verbatim means the example was copied without a key.
PLACEHOLDER_API_KEY = "FINANCIAL_MODELING_PREP_KEY"


def resolve_api_key(api_key: str | None) -> str | None:
    """
    Replaces the documentation placeholder API key with an empty key, reporting that
    the placeholder was used and where to obtain an actual key. The placeholder would
    otherwise reach FinancialModelingPrep and come back as a generic "invalid API key"
    without telling the user that the example value was never replaced. With an empty
    key every class behaves as it does when no key is given at all (e.g. the Toolkit
    falls back to Yahoo Finance).

    Args:
        api_key (str | None): The FinancialModelingPrep API key as passed by the user.

    Returns:
        str | None: The API key unchanged, or an empty string when the placeholder was passed.
    """
    if isinstance(api_key, str) and api_key.strip() == PLACEHOLDER_API_KEY:
        logger.error(
            "The api_key is set to the placeholder value '%s' from the documentation examples "
            "instead of an actual API key, so it is ignored. Obtain your API key for free and get "
            "15%% off the Premium plans by using the following affiliate link.\nThis also supports "
            "the project: https://www.jeroenbouma.com/fmp",
            PLACEHOLDER_API_KEY,
        )
        return ""

    return api_key


def validate_toolkit_parameters(
    tickers: list | str | None,
    start_date: str | None,
    end_date: str | None,
    risk_free_rate: str,
    enforce_source: str | None,
    api_key: str,
    intraday_period: str | None,
    benchmark_ticker: str | None,
) -> list[str]:
    """
    Validates the user-facing Toolkit parameters and normalizes the tickers, split out
    of `Toolkit.__init__` so that the input checking is testable in isolation from the
    (data-collecting) initialisation itself. Everything here either raises a clear
    error on invalid input or is a pure normalisation; no state is touched.

    The ticker normalisation upper-cases plain tickers (leaving the special
    "Portfolio" entry as is), converts ISIN codes to tickers, removes duplicates
    while preserving the original order (deduplicating through a set would make the
    column order of every output depend on the hash seed) and removes the benchmark
    ticker from the list, warning about both removals.

    Args:
        tickers (list | str | None): The ticker(s) the Toolkit is initialised with.
        start_date (str | None): The start date, formatted as YYYY-MM-DD.
        end_date (str | None): The end date, formatted as YYYY-MM-DD.
        risk_free_rate (str): The risk free rate duration (13w, 5y, 10y or 30y).
        enforce_source (str | None): The enforced data source, if any.
        api_key (str): The FinancialModelingPrep API key, only used to check that an
        enforced FinancialModelingPrep source actually has one.
        intraday_period (str | None): The intraday period, if any.
        benchmark_ticker (str | None): The benchmark ticker, if any.

    Returns:
        list[str]: The normalized ticker list.

    Raises:
        ValueError: If any of the parameters is invalid.
        TypeError: If tickers is neither a string nor a list of strings.
    """
    if start_date and re.match(r"^\d{4}-\d{2}-\d{2}$", start_date) is None:
        raise ValueError("Please input a valid start date (%Y-%m-%d) like '2010-01-01'")
    if end_date and re.match(r"^\d{4}-\d{2}-\d{2}$", end_date) is None:
        raise ValueError("Please input a valid end date (%Y-%m-%d) like '2020-01-01'")
    if start_date and end_date and start_date > end_date:
        raise ValueError(
            f"Please ensure the start date {start_date} is before the end date {end_date}"
        )

    if risk_free_rate not in RISK_FREE_RATE_OPTIONS:
        raise ValueError("Please select a valid risk free rate (13w, 5y, 10y or 30y)")

    if enforce_source not in ENFORCE_SOURCE_OPTIONS:
        raise ValueError(
            "Please select either FinancialModelingPrep or YahooFinance as the "
            "enforced source."
        )
    if enforce_source == "FinancialModelingPrep" and not api_key:
        raise ValueError(
            "Please input an API key from FinancialModelingPrep if you wish to use "
            "historical data from FinancialModelingPrep."
        )

    if intraday_period and intraday_period not in INTRADAY_PERIOD_OPTIONS:
        raise ValueError(
            "Please select a valid intraday period (1min, 5min, 15min, 30min or 1hour)"
        )

    if isinstance(tickers, str):
        tickers = [tickers.upper()]
    elif isinstance(tickers, list):
        tickers = [
            ticker.upper() if ticker != "Portfolio" else ticker for ticker in tickers
        ]
    elif tickers is None:
        raise ValueError("Please input a ticker or a list of tickers.")
    else:
        raise TypeError("Tickers must be a string or a list of strings.")

    # Check whether the ticker is in ISIN format and if so convert it to a ticker
    ticker_list = [convert_isin_to_ticker(ticker) for ticker in tickers]

    # Take out duplicate tickers if applicable; deduplicating through a set would make the ticker order, and therefore the column order of every single output, depend on the hash seed and change between runs.  # noqa: E501
    deduplicated_tickers = list(dict.fromkeys(ticker_list))

    if len(deduplicated_tickers) != len(ticker_list):
        duplicate_tickers = [
            ticker for ticker, count in Counter(ticker_list).items() if count > 1
        ]
        logger.warning(
            "Found duplicate tickers, duplicate entries of the following tickers are removed: %s",
            ", ".join(duplicate_tickers),
        )
        ticker_list = deduplicated_tickers

    if benchmark_ticker in ticker_list:
        logger.warning(
            "Please note that the benchmark ticker (%s) is also "
            "included in the tickers. Therefore, this ticker will be removed from the "
            "tickers list. If this is not desired, please set the benchmark_ticker to None.",
            benchmark_ticker,
        )
        ticker_list.remove(benchmark_ticker)

    return ticker_list

```

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

    def cached_frame(self, entity: str) -> pd.DataFrame | None:
        """
        The cached data for `entity` narrowed to a DataFrame, for the datasets that
        only ever store frames; None when nothing is cached for it.

        Args:
            entity (str): The entity (ticker, series id, country) to look up.

        Returns:
            pd.DataFrame | None: The cached frame, or None when absent.

        Raises:
            TypeError: If the cached entry is a Series, which means the dataset is
                written by one code path and read by another that disagree on shape.
        """
        cached = self.cached.get(entity)

        if cached is not None and not isinstance(cached, pd.DataFrame):
            raise TypeError(
                f"The cached entry for {entity!r} is a {type(cached).__name__}, but a "
                "DataFrame was expected."
            )

        return cached

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
                # A cache is an optimization, so a database that cannot be opened just disables it.
                self._enabled = False

                logger.warning(
                    "Could not open the cache at %s (%s). Continuing without caching. "
                    "Remove or relocate the file to restore it.",
                    self._location,
                    error,
                )

        self._warn_on_schema_mismatch()

    def _warn_on_schema_mismatch(self) -> None:
        """
        Report a cache written by a different schema version without touching it.

        Structural changes must never silently discard a cache: a user may have
        spent a long time and a large part of an API quota filling it. The
        mismatch is therefore only reported, and clearing stays an explicit act.
        """
        if self._backend is None:
            return

        stored_version = self._backend.get_schema_version()

        if stored_version is not None and stored_version != SCHEMA_VERSION:
            logger.warning(
                "The cache at %s was written by
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
from datetime import date

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
    start: str | date | None = None,
    end: str | date | None = None,
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
        start (str | date | None): Inclusive start of the window. None leaves it open.
        end (str | date | None): Inclusive end of the window. None leaves it open.
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

### Incident Patch 1: `a232ddf8` (2026-10-04)
**Commit Message**: fix: currency validation in format_portfolio_dataset only checks max string length (#257)

* Fix currency code validation only checking max string length

format_portfolio_dataset() validated the currency column by comparing
Series.str.len().max() to CURRENCY_CODE_LENGTH (3). Because max() only
looks at the longest value in the column, a single valid 3-letter code
(e.g. "USD") masked any invalid code elsewhere in the same column (e.g.
a 2-letter "EU"), since the max would still equal 3 and the check would
pass. Invalid currency codes could therefore slip through silently and
propagate into downstream FX conversion and portfolio valuation.

Fix by checking that every value's length equals CURRENCY_CODE_LENGTH,
instead of only the maximum. Added a regression test covering a column
with mixed valid/invalid-length codes.

Co-Authored-By: Claude Sonnet 5 <[REDACTED_EMAIL]>

* Remove explanatory comment

* Format portfolio_model.py with black

---------

Co-authored-by: Claude Sonnet 5 <[REDACTED_EMAIL]>
Co-authored-by: Jeroen Bouma <[REDACTED_EMAIL]>

**File**: `financetoolkit/portfolio/portfolio_model.py` (modified, +1/-1)
```diff
@@ -380,7 +380,7 @@ def format_portfolio_dataset(
         else:
             currency_column_first = currency_columns_match[0]
 
-            if dataset[currency_column_first].str.len().max() != CURRENCY_CODE_LENGTH:
+            if (dataset[currency_column_first].str.len() != CURRENCY_CODE_LENGTH).any():
                 raise ValueError(
                     "Currency column must contain 3-letter currency codes only (e.g. EUR, USD or JPY)."
                 )
```

**File**: `tests/portfolio/test_portfolio_model.py` (modified, +44/-0)
```diff
@@ -138,6 +138,50 @@ def test_format_portfolio_dataset_with_missing_columns():
         )
 
 
+def test_format_portfolio_dataset_with_mixed_length_currency_codes():
+    """Test that an invalid-length currency code is rejected even when it shares a
+    column with valid 3-letter codes.
+
+    Regression test for a bug where only the *maximum* string length in the currency
+    column was checked against CURRENCY_CODE_LENGTH, so a single valid 3-letter code
+    (e.g. "USD") masked an invalid code elsewhere in the same column (e.g. "EU"),
+    letting it silently pass validation.
+    """
+    data = pd.DataFrame(
+        {
+            "Date": ["2023-01-01", "2023-01-02"],
+            "Name": ["Apple Inc", "Microsoft Corp"],
+            "Ticker": ["AAPL", "MSFT"],
+            "Price": [150.0, 250.0],
+            "Volume": [100, 50],
+            "Currency": ["USD", "EU"],
+            "Costs": [1.0, 2.0],
+        }
+    )
+
+    with pytest.raises(ValueError, match="3-letter currency codes"):
+        format_portfolio_dataset(
+            dataset=data,
+            date_columns=["Date"],
+            date_format_options=["%Y-%m-%d"],
+            name_columns=["Name"],
+            tickers_columns=["Ticker"],
+            price_columns=["Price"],
+            volume_columns=["Volume"],
+            currency_columns=["Currency"],
+            costs_columns=["Costs"],
+            column_mapping={
+                "date": "Date",
+                "name": "Name",
+                "identifier": "Ticker",
+                "price": "Price",
+                "volume": "Volume",
+                "currency": "Currency",
+                "costs": "Costs",
+            },
+        )
+
+
 def test_read_portfolio_dataset_edge_cases():
     """Test edge cases for read_portfolio_dataset"""
     # Empty file
```

---

### Incident Patch 2: `7fd81d9e` (2026-10-01)
**Commit Message**: Revert "Replace same-type @overload stubs with a SeriesOrFrame TypeVar"

This reverts commit 6741de338cd286e7a947a85662182438ac1e8633.

**File**: `financetoolkit/models/intrinsic_model.py` (modified, +16/-7)
```diff
@@ -3,15 +3,11 @@
 __docformat__ = "google"
 
 from math import fsum
-from typing import TypeVar
+from typing import overload
 
 import numpy as np
 import pandas as pd
 
-# The calculations return whichever type they are given: a Series for one company,
-# a DataFrame for several.
-SeriesOrFrame = TypeVar("SeriesOrFrame", pd.Series, pd.DataFrame)
-
 # pylint: disable=too-many-locals
 
 
@@ -159,9 +155,22 @@ def get_gorden_growth_model(
     return (dividends_per_share * (1 + growth_rate)) / (rate_of_return - growth_rate)
 
 
+@overload
+def get_graham_number(
+    earnings_per_share: pd.Series, book_value_per_share: pd.Series
+) -> pd.Series: ...
+
+
+@overload
+def get_graham_number(
+    earnings_per_share: pd.DataFrame, book_value_per_share: pd.DataFrame
+) -> pd.DataFrame: ...
+
+
 def get_graham_number(
-    earnings_per_share: SeriesOrFrame, book_value_per_share: SeriesOrFrame
-) -> SeriesOrFrame:
+    earnings_per_share: pd.Series | pd.DataFrame,
+    book_value_per_share: pd.Series | pd.DataFrame,
+) -> pd.Series | pd.DataFrame:
     """
     Calculate the Graham Number, a conservative estimate of a stock's fair value based
     on its earnings and book value, as devised by Benjamin Graham.
```

**File**: `financetoolkit/ratios/efficiency_model.py` (modified, +243/-40)
```diff
@@ -2,18 +2,26 @@
 
 __docformat__ = "google"
 
-from typing import TypeVar, overload
+from typing import overload
 
 import pandas as pd
 
-# The calculations return whichever type they are given: a Series for one company,
-# a DataFrame for several. Mixed or scalar inputs keep their own @overload stubs.
-SeriesOrFrame = TypeVar("SeriesOrFrame", pd.Series, pd.DataFrame)
+
+@overload
+def get_asset_turnover_ratio(
+    sales: pd.Series, average_total_assets: pd.Series
+) -> pd.Series: ...
+
+
+@overload
+def get_asset_turnover_ratio(
+    sales: pd.DataFrame, average_total_assets: pd.DataFrame
+) -> pd.DataFrame: ...
 
 
 def get_asset_turnover_ratio(
-    sales: SeriesOrFrame, average_total_assets: SeriesOrFrame
-) -> SeriesOrFrame:
+    sales: pd.Series | pd.DataFrame, average_total_assets: pd.Series | pd.DataFrame
+) -> pd.Series | pd.DataFrame:
     """
     Calculate the asset turnover ratio, an efficiency ratio that measures how
     efficiently a company uses its assets to generate sales.
@@ -29,9 +37,22 @@ def get_asset_turnover_ratio(
     return sales / average_total_assets
 
 
+@overload
 def get_inventory_turnover_ratio(
-    cost_of_goods_sold: SeriesOrFrame, average_inventory: SeriesOrFrame
-) -> SeriesOrFrame:
+    cost_of_goods_sold: pd.Series, average_inventory: pd.Series
+) -> pd.Series: ...
+
+
+@overload
+def get_inventory_turnover_ratio(
+    cost_of_goods_sold: pd.DataFrame, average_inventory: pd.DataFrame
+) -> pd.DataFrame: ...
+
+
+def get_inventory_turnover_ratio(
+    cost_of_goods_sold: pd.Series | pd.DataFrame,
+    average_inventory: pd.Series | pd.DataFrame,
+) -> pd.Series | pd.DataFrame:
     """
     Calculate the inventory turnover ratio, an efficiency ratio that measures
     how quickly a company sells its inventory.
@@ -120,9 +141,22 @@ def get_days_of_sales_outstanding(
     return average_accounts_receivable / net_credit_sales * days
 
 
+@overload
+def get_operating_cycle(
+    days_of_inventory: pd.Series, days_of_sales_outstanding: pd.Series
+) -> pd.Series: ...
+
+
+@overload
 def get_operating_cycle(
-    days_of_inventory: SeriesOrFrame, days_of_sales_outstanding: SeriesOrFrame
-) -> SeriesOrFrame:
+    days_of_inventory: pd.DataFrame, days_of_sales_outstanding: pd.DataFrame
+) -> pd.DataFrame: ...
+
+
+def get_operating_cycle(
+    days_of_inventory: pd.Series | pd.DataFrame,
+    days_of_sales_outstanding: pd.Series | pd.DataFrame,
+) -> pd.Series | pd.DataFrame:
     """
     Calculate the operating cycle, an efficiency ratio that measures the average
     number of days it takes a company to turn its inventory into cash.
@@ -137,9 +171,22 @@ def get_operating_cycle(
     return days_of_inventory + days_of_sales_outstanding
 
 
+@overload
 def get_accounts_payables_turnover_ratio(
-    cost_of_goods_sold: SeriesOrFrame, average_accounts_payable: SeriesOrFrame
-) -> SeriesOrFrame:
+    cost_of_goods_sold: pd.Series, average_accounts_payable: pd.Series
+) -> pd.Series: ...
+
+
+@overload
+def get_accounts_payables_turnover_ratio(
+    cost_of_goods_sold: pd.DataFrame, average_accounts_payable: pd.DataFrame
+) -> pd.DataFrame: ...
+
+
+def get_accounts_payables_turnover_ratio(
+    cost_of_goods_sold: pd.Series | pd.DataFrame,
+    average_accounts_payable: pd.Series | pd.DataFrame,
+) -> pd.Series | pd.DataFrame:
     """
     Calculate the accounts payable turnover ratio is an efficiency ratio that measures how
     quickly a company pays its suppliers.
@@ -191,11 +238,27 @@ def get_days_of_accounts_payable_outstanding(
     return average_accounts_payable / cost_of_goods_sold * days
 
 
+@overload
+def get_cash_conversion_cycle(
+    days_inventory: pd.Series,
+    days_sales_outstanding: pd.Series,
+    days_payables_outstanding: pd.Series,
+) -> pd.Series: ...
+
+
+@overload
+def get_cash_conversion_cycle(
+    days_inventory: pd.DataFrame,
+    days_sales_outstanding: pd.DataFrame,
+    days_payables_outstanding: pd.DataFrame,
+) -> pd.DataFrame: ...
+
+
 def get_cash_conversion_cycle(
-    days_inventory: SeriesOrFrame,
-    days_sales_outstanding: SeriesOrFrame,
-    days_payables_outstanding: SeriesOrFrame,
-) -> SeriesOrFrame:
+    days_inventory: pd.Series | pd.DataFrame,
+    days_sales_outstanding: pd.Series | pd.DataFrame,
+    days_payables_outstanding: pd.Series | pd.DataFrame,
+) -> pd.Series | pd.DataFrame:
     """
     Calculate the Cash Conversion Cycle, which measures the amount of time it takes for a company to convert
     its investments in inventory and accounts receivable into cash, while considering the time it takes to pay
@@ -212,9 +275,22 @@ def get_cash_conversion_cycle(
     return days_inventory + days_sales_outstanding - days_payables_outstanding
 
 
+@overload
+def get_receivables_turnover(
+    average_accounts_receivable: pd.Series, net_credit_sales: pd.Series
+) -> pd.Series: ...
+
+
+@overload
 def get_receivables_turnover(
-    average_accounts_receivable: SeriesOrFrame, net_credit_sales: SeriesOrFrame
-) -> SeriesOrFrame
```

**File**: `financetoolkit/ratios/liquidity_model.py` (modified, +140/-29)
```diff
@@ -2,19 +2,27 @@
 
 __docformat__ = "google"
 
-
-from typing import TypeVar
+from typing import overload
 
 import pandas as pd
 
-# The calculations return whichever type they are given: a Series for one company,
-# a DataFrame for several. Mixed or scalar inputs keep their own @overload stubs.
-SeriesOrFrame = TypeVar("SeriesOrFrame", pd.Series, pd.DataFrame)
+
+@overload
+def get_current_ratio(
+    current_assets: pd.Series, current_liabilities: pd.Series
+) -> pd.Series: ...
+
+
+@overload
+def get_current_ratio(
+    current_assets: pd.DataFrame, current_liabilities: pd.DataFrame
+) -> pd.DataFrame: ...
 
 
 def get_current_ratio(
-    current_assets: SeriesOrFrame, current_liabilities: SeriesOrFrame
-) -> SeriesOrFrame:
+    current_assets: pd.Series | pd.DataFrame,
+    current_liabilities: pd.Series | pd.DataFrame,
+) -> pd.Series | pd.DataFrame:
     """
     Calculate the current ratio, a liquidity ratio that measures a company's ability
     to pay off its short-term liabilities with its current assets.
@@ -31,12 +39,30 @@ def get_current_ratio(
     return current_assets / current_liabilities
 
 
+@overload
+def get_quick_ratio(
+    cash_and_equivalents: pd.Series,
+    marketable_securities: pd.Series,
+    accounts_receivable: pd.Series,
+    current_liabilities: pd.Series,
+) -> pd.Series: ...
+
+
+@overload
+def get_quick_ratio(
+    cash_and_equivalents: pd.DataFrame,
+    marketable_securities: pd.DataFrame,
+    accounts_receivable: pd.DataFrame,
+    current_liabilities: pd.DataFrame,
+) -> pd.DataFrame: ...
+
+
 def get_quick_ratio(
-    cash_and_equivalents: SeriesOrFrame,
-    marketable_securities: SeriesOrFrame,
-    accounts_receivable: SeriesOrFrame,
-    current_liabilities: SeriesOrFrame,
-) -> SeriesOrFrame:
+    cash_and_equivalents: pd.Series | pd.DataFrame,
+    marketable_securities: pd.Series | pd.DataFrame,
+    accounts_receivable: pd.Series | pd.DataFrame,
+    current_liabilities: pd.Series | pd.DataFrame,
+) -> pd.Series | pd.DataFrame:
     """
     Calculate the quick ratio (also known as the acid-test ratio), a more stringent
     measure of liquidity that excludes inventory from current assets.
@@ -68,11 +94,27 @@ def get_quick_ratio(
     ) / current_liabilities
 
 
+@overload
 def get_cash_ratio(
-    cash_and_equivalents: SeriesOrFrame,
-    marketable_securities: SeriesOrFrame,
-    current_liabilities: SeriesOrFrame,
-) -> SeriesOrFrame:
+    cash_and_equivalents: pd.Series,
+    marketable_securities: pd.Series,
+    current_liabilities: pd.Series,
+) -> pd.Series: ...
+
+
+@overload
+def get_cash_ratio(
+    cash_and_equivalents: pd.DataFrame,
+    marketable_securities: pd.DataFrame,
+    current_liabilities: pd.DataFrame,
+) -> pd.DataFrame: ...
+
+
+def get_cash_ratio(
+    cash_and_equivalents: pd.Series | pd.DataFrame,
+    marketable_securities: pd.Series | pd.DataFrame,
+    current_liabilities: pd.Series | pd.DataFrame,
+) -> pd.Series | pd.DataFrame:
     """
     Calculate the cash ratio, a liquidity ratio that measures a company's ability
     to pay off its short-term liabilities with its cash and cash equivalents.
@@ -88,12 +130,30 @@ def get_cash_ratio(
     return (cash_and_equivalents + marketable_securities) / current_liabilities
 
 
+@overload
+def get_defensive_interval_ratio(
+    cash_and_equivalents: pd.Series,
+    marketable_securities: pd.Series,
+    accounts_receivable: pd.Series,
+    daily_operating_expenses: pd.Series,
+) -> pd.Series: ...
+
+
+@overload
+def get_defensive_interval_ratio(
+    cash_and_equivalents: pd.DataFrame,
+    marketable_securities: pd.DataFrame,
+    accounts_receivable: pd.DataFrame,
+    daily_operating_expenses: pd.DataFrame,
+) -> pd.DataFrame: ...
+
+
 def get_defensive_interval_ratio(
-    cash_and_equivalents: SeriesOrFrame,
-    marketable_securities: SeriesOrFrame,
-    accounts_receivable: SeriesOrFrame,
-    daily_operating_expenses: SeriesOrFrame,
-) -> SeriesOrFrame:
+    cash_and_equivalents: pd.Series | pd.DataFrame,
+    marketable_securities: pd.Series | pd.DataFrame,
+    accounts_receivable: pd.Series | pd.DataFrame,
+    daily_operating_expenses: pd.Series | pd.DataFrame,
+) -> pd.Series | pd.DataFrame:
     """
     Calculate the defensive interval ratio (DIR), a liquidity ratio that measures how
     many days a company could continue to cover its operating expenses using only its
@@ -131,9 +191,22 @@ def get_defensive_interval_ratio(
     ) / daily_operating_expenses
 
 
+@overload
 def get_working_capital(
-    current_assets: SeriesOrFrame, current_liabilities: SeriesOrFrame
-) -> SeriesOrFrame:
+    current_assets: pd.Series, current_liabilities: pd.Series
+) -> pd.Series: ...
+
+
+@overload
+def get_working_capital(
+    current_assets: pd.DataFrame, current_liabilities: pd.DataFrame
+) -> pd.DataFrame: ...
+
+
+def get_working_capital(
+    current_assets: pd.Series | pd.DataFrame,
+    current_liabilities: pd.Series | pd.DataFrame,
+) -> pd.Series | pd.DataFrame:
     ""
```

**File**: `financetoolkit/ratios/profitability_model.py` (modified, +343/-58)
```diff
@@ -2,18 +2,26 @@
 
 __docformat__ = "google"
 
-from typing import TypeVar, overload
+from typing import overload
 
 import pandas as pd
 
-# The calculations return whichever type they are given: a Series for one company,
-# a DataFrame for several. Mixed or scalar inputs keep their own @overload stubs.
-SeriesOrFrame = TypeVar("SeriesOrFrame", pd.Series, pd.DataFrame)
+
+@overload
+def get_gross_margin(
+    revenue: pd.Series, cost_of_goods_sold: pd.Series
+) -> pd.Series: ...
+
+
+@overload
+def get_gross_margin(
+    revenue: pd.DataFrame, cost_of_goods_sold: pd.DataFrame
+) -> pd.DataFrame: ...
 
 
 def get_gross_margin(
-    revenue: SeriesOrFrame, cost_of_goods_sold: SeriesOrFrame
-) -> SeriesOrFrame:
+    revenue: pd.Series | pd.DataFrame, cost_of_goods_sold: pd.Series | pd.DataFrame
+) -> pd.Series | pd.DataFrame:
     """
     Calculate the gross margin, a profitability ratio that measures the percentage of
     revenue that exceeds the cost of goods sold.
@@ -28,9 +36,21 @@ def get_gross_margin(
     return (revenue - cost_of_goods_sold) / revenue
 
 
+@overload
+def get_operating_margin(
+    operating_income: pd.Series, revenue: pd.Series
+) -> pd.Series: ...
+
+
+@overload
 def get_operating_margin(
-    operating_income: SeriesOrFrame, revenue: SeriesOrFrame
-) -> SeriesOrFrame:
+    operating_income: pd.DataFrame, revenue: pd.DataFrame
+) -> pd.DataFrame: ...
+
+
+def get_operating_margin(
+    operating_income: pd.Series | pd.DataFrame, revenue: pd.Series | pd.DataFrame
+) -> pd.Series | pd.DataFrame:
     """
     Calculate the operating margin, a profitability ratio that measures the percentage of
     revenue that remains after deducting operating expenses.
@@ -45,9 +65,19 @@ def get_operating_margin(
     return operating_income / revenue
 
 
+@overload
+def get_net_profit_margin(net_income: pd.Series, revenue: pd.Series) -> pd.Series: ...
+
+
+@overload
 def get_net_profit_margin(
-    net_income: SeriesOrFrame, revenue: SeriesOrFrame
-) -> SeriesOrFrame:
+    net_income: pd.DataFrame, revenue: pd.DataFrame
+) -> pd.DataFrame: ...
+
+
+def get_net_profit_margin(
+    net_income: pd.Series | pd.DataFrame, revenue: pd.Series | pd.DataFrame
+) -> pd.Series | pd.DataFrame:
     """
     Calculate the net profit margin, a profitability ratio that measures the percentage
     of profit a company earns per dollar of revenue.
@@ -62,11 +92,27 @@ def get_net_profit_margin(
     return net_income / revenue
 
 
+@overload
+def get_ebitda_margin(
+    operating_income: pd.Series,
+    depreciation_and_amortization: pd.Series,
+    revenue: pd.Series,
+) -> pd.Series: ...
+
+
+@overload
+def get_ebitda_margin(
+    operating_income: pd.DataFrame,
+    depreciation_and_amortization: pd.DataFrame,
+    revenue: pd.DataFrame,
+) -> pd.DataFrame: ...
+
+
 def get_ebitda_margin(
-    operating_income: SeriesOrFrame,
-    depreciation_and_amortization: SeriesOrFrame,
-    revenue: SeriesOrFrame,
-) -> SeriesOrFrame:
+    operating_income: pd.Series | pd.DataFrame,
+    depreciation_and_amortization: pd.Series | pd.DataFrame,
+    revenue: pd.Series | pd.DataFrame,
+) -> pd.Series | pd.DataFrame:
     """
     Calculate the EBITDA margin, a profitability ratio that measures the percentage of
     revenue that remains as earnings before interest, taxes, depreciation and
@@ -96,9 +142,22 @@ def get_ebitda_margin(
     return (operating_income + depreciation_and_amortization) / revenue
 
 
+@overload
+def get_interest_coverage_ratio(
+    operating_income: pd.Series, interest_expense: pd.Series
+) -> pd.Series: ...
+
+
+@overload
 def get_interest_coverage_ratio(
-    operating_income: SeriesOrFrame, interest_expense: SeriesOrFrame
-) -> SeriesOrFrame:
+    operating_income: pd.DataFrame, interest_expense: pd.DataFrame
+) -> pd.DataFrame: ...
+
+
+def get_interest_coverage_ratio(
+    operating_income: pd.Series | pd.DataFrame,
+    interest_expense: pd.Series | pd.DataFrame,
+) -> pd.Series | pd.DataFrame:
     """
     Compute the Interest Coverage Ratio, a metric that reveals a company's ability to
     cover its interest expenses out of its operating profit. It measures how many times
@@ -121,9 +180,22 @@ def get_interest_coverage_ratio(
     return operating_income / interest_expense
 
 
+@overload
+def get_interest_burden_ratio(
+    income_before_tax: pd.Series, operating_income: pd.Series
+) -> pd.Series: ...
+
+
+@overload
+def get_interest_burden_ratio(
+    income_before_tax: pd.DataFrame, operating_income: pd.DataFrame
+) -> pd.DataFrame: ...
+
+
 def get_interest_burden_ratio(
-    income_before_tax: SeriesOrFrame, operating_income: SeriesOrFrame
-) -> SeriesOrFrame:
+    income_before_tax: pd.Series | pd.DataFrame,
+    operating_income: pd.Series | pd.DataFrame,
+) -> pd.Series | pd.DataFrame:
     """
     Compute the Interest Burden Ratio, the component of the extended (five-step) DuPont
     decomposition that isolates the drag interest expense places on operating profit.
@@ -154,9 +226,2
```

**File**: `financetoolkit/ratios/solvency_model.py` (modified, +250/-47)
```diff
@@ -2,19 +2,26 @@
 
 __docformat__ = "google"
 
-
-from typing import TypeVar
+from typing import overload
 
 import pandas as pd
 
-# The calculations return whichever type they are given: a Series for one company,
-# a DataFrame for several. Mixed or scalar inputs keep their own @overload stubs.
-SeriesOrFrame = TypeVar("SeriesOrFrame", pd.Series, pd.DataFrame)
+
+@overload
+def get_debt_to_assets_ratio(
+    total_debt: pd.Series, total_assets: pd.Series
+) -> pd.Series: ...
+
+
+@overload
+def get_debt_to_assets_ratio(
+    total_debt: pd.DataFrame, total_assets: pd.DataFrame
+) -> pd.DataFrame: ...
 
 
 def get_debt_to_assets_ratio(
-    total_debt: SeriesOrFrame, total_assets: SeriesOrFrame
-) -> SeriesOrFrame:
+    total_debt: pd.Series | pd.DataFrame, total_assets: pd.Series | pd.DataFrame
+) -> pd.Series | pd.DataFrame:
     """
     Calculate the debt to assets ratio, a solvency ratio that measures the proportion of a
     company's assets that are financed by debt.
@@ -31,9 +38,21 @@ def get_debt_to_assets_ratio(
     return total_debt / total_assets
 
 
+@overload
+def get_debt_to_equity_ratio(
+    total_debt: pd.Series, total_equity: pd.Series
+) -> pd.Series: ...
+
+
+@overload
+def get_debt_to_equity_ratio(
+    total_debt: pd.DataFrame, total_equity: pd.DataFrame
+) -> pd.DataFrame: ...
+
+
 def get_debt_to_equity_ratio(
-    total_debt: SeriesOrFrame, total_equity: SeriesOrFrame
-) -> SeriesOrFrame:
+    total_debt: pd.Series | pd.DataFrame, total_equity: pd.Series | pd.DataFrame
+) -> pd.Series | pd.DataFrame:
     """
     Calculate the debt to equity ratio, a solvency ratio that measures the
     proportion of a company's equity that is financed by debt.
@@ -48,11 +67,27 @@ def get_debt_to_equity_ratio(
     return total_debt / total_equity
 
 
+@overload
 def get_interest_coverage_ratio(
-    operating_income: SeriesOrFrame,
-    depreciation_and_amortization: SeriesOrFrame,
-    interest_expense: SeriesOrFrame,
-) -> SeriesOrFrame:
+    operating_income: pd.Series,
+    depreciation_and_amortization: pd.Series,
+    interest_expense: pd.Series,
+) -> pd.Series: ...
+
+
+@overload
+def get_interest_coverage_ratio(
+    operating_income: pd.DataFrame,
+    depreciation_and_amortization: pd.DataFrame,
+    interest_expense: pd.DataFrame,
+) -> pd.DataFrame: ...
+
+
+def get_interest_coverage_ratio(
+    operating_income: pd.Series | pd.DataFrame,
+    depreciation_and_amortization: pd.Series | pd.DataFrame,
+    interest_expense: pd.Series | pd.DataFrame,
+) -> pd.Series | pd.DataFrame:
     """
     Calculate the interest coverage ratio, a solvency ratio that measures a company's
     ability to pay its interest expenses on outstanding debt.
@@ -68,9 +103,22 @@ def get_interest_coverage_ratio(
     return (operating_income + depreciation_and_amortization) / interest_expense
 
 
+@overload
 def get_debt_service_coverage_ratio(
-    operating_income: SeriesOrFrame, current_liabilities: SeriesOrFrame
-) -> SeriesOrFrame:
+    operating_income: pd.Series, current_liabilities: pd.Series
+) -> pd.Series: ...
+
+
+@overload
+def get_debt_service_coverage_ratio(
+    operating_income: pd.DataFrame, current_liabilities: pd.DataFrame
+) -> pd.DataFrame: ...
+
+
+def get_debt_service_coverage_ratio(
+    operating_income: pd.Series | pd.DataFrame,
+    current_liabilities: pd.Series | pd.DataFrame,
+) -> pd.Series | pd.DataFrame:
     """
     Calculate the debt service coverage ratio, a solvency ratio that measures a company's
     ability to service its debt with its net operating income.
@@ -99,9 +147,22 @@ def get_debt_service_coverage_ratio(
     return operating_income / current_liabilities
 
 
+@overload
+def get_equity_multiplier(
+    average_total_assets: pd.Series, average_total_equity: pd.Series
+) -> pd.Series: ...
+
+
+@overload
 def get_equity_multiplier(
-    average_total_assets: SeriesOrFrame, average_total_equity: SeriesOrFrame
-) -> SeriesOrFrame:
+    average_total_assets: pd.DataFrame, average_total_equity: pd.DataFrame
+) -> pd.DataFrame: ...
+
+
+def get_equity_multiplier(
+    average_total_assets: pd.Series | pd.DataFrame,
+    average_total_equity: pd.Series | pd.DataFrame,
+) -> pd.Series | pd.DataFrame:
     """
     Calculate the equity multiplier, a solvency ratio that measures the degree to which a company
     uses borrowed money (debt) to finance its operations and growth.
@@ -120,9 +181,22 @@ def get_equity_multiplier(
     return average_total_assets / average_total_equity
 
 
+@overload
+def get_free_cash_flow_yield(
+    free_cash_flow: pd.Series, market_capitalization: pd.Series
+) -> pd.Series: ...
+
+
+@overload
+def get_free_cash_flow_yield(
+    free_cash_flow: pd.DataFrame, market_capitalization: pd.DataFrame
+) -> pd.DataFrame: ...
+
+
 def get_free_cash_flow_yield(
-    free_cash_flow: SeriesOrFrame, market_capitalization: SeriesOrFrame
-) -> SeriesOrFrame:
+    free_cash_flow: pd.Series | pd.DataFrame,
+    market_capitalization: pd.Series | pd.DataFr
```

**File**: `financetoolkit/ratios/valuation_model.py` (modified, +409/-72)
```diff
@@ -2,14 +2,10 @@
 
 __docformat__ = "google"
 
-from typing import TypeVar, overload
+from typing import overload
 
 import pandas as pd
 
-# The calculations return whichever type they are given: a Series for one company,
-# a DataFrame for several. Mixed or scalar inputs keep their own @overload stubs.
-SeriesOrFrame = TypeVar("SeriesOrFrame", pd.Series, pd.DataFrame)
-
 
 @overload
 def get_earnings_per_share(
@@ -47,9 +43,22 @@ def get_earnings_per_share(
     return (net_income - preferred_dividends) / average_outstanding_shares
 
 
+@overload
+def get_revenue_per_share(
+    total_revenue: pd.Series, shares_outstanding: pd.Series
+) -> pd.Series: ...
+
+
+@overload
+def get_revenue_per_share(
+    total_revenue: pd.DataFrame, shares_outstanding: pd.DataFrame
+) -> pd.DataFrame: ...
+
+
 def get_revenue_per_share(
-    total_revenue: SeriesOrFrame, shares_outstanding: SeriesOrFrame
-) -> SeriesOrFrame:
+    total_revenue: pd.Series | pd.DataFrame,
+    shares_outstanding: pd.Series | pd.DataFrame,
+) -> pd.Series | pd.DataFrame:
     """
     Calculate the revenue per share, a valuation ratio that measures the amount of
     revenue generated per outstanding share of a company's stock.
@@ -64,9 +73,21 @@ def get_revenue_per_share(
     return total_revenue / shares_outstanding
 
 
+@overload
+def get_price_to_earnings_ratio(
+    stock_price: pd.Series, earnings_per_share: pd.Series
+) -> pd.Series: ...
+
+
+@overload
+def get_price_to_earnings_ratio(
+    stock_price: pd.DataFrame, earnings_per_share: pd.DataFrame
+) -> pd.DataFrame: ...
+
+
 def get_price_to_earnings_ratio(
-    stock_price: SeriesOrFrame, earnings_per_share: SeriesOrFrame
-) -> SeriesOrFrame:
+    stock_price: pd.Series | pd.DataFrame, earnings_per_share: pd.Series | pd.DataFrame
+) -> pd.Series | pd.DataFrame:
     """
     Calculate the price earnings ratio (P/E), a valuation ratio that compares a company's
     stock price to its earnings per share.
@@ -145,11 +166,27 @@ def get_estimated_eps_growth_rate(
     return (estimated_eps - trailing_eps) / abs(trailing_eps)
 
 
+@overload
+def get_book_value_per_share(
+    total_shareholder_equity: pd.Series,
+    preferred_equity: pd.Series,
+    common_shares_outstanding: pd.Series,
+) -> pd.Series: ...
+
+
+@overload
 def get_book_value_per_share(
-    total_shareholder_equity: SeriesOrFrame,
-    preferred_equity: SeriesOrFrame,
-    common_shares_outstanding: SeriesOrFrame,
-) -> SeriesOrFrame:
+    total_shareholder_equity: pd.DataFrame,
+    preferred_equity: pd.DataFrame,
+    common_shares_outstanding: pd.DataFrame,
+) -> pd.DataFrame: ...
+
+
+def get_book_value_per_share(
+    total_shareholder_equity: pd.Series | pd.DataFrame,
+    preferred_equity: pd.Series | pd.DataFrame,
+    common_shares_outstanding: pd.Series | pd.DataFrame,
+) -> pd.Series | pd.DataFrame:
     """
     Calculate the book value per share, a valuation ratio that measures the amount of
     common equity value per share outstanding.
@@ -165,9 +202,22 @@ def get_book_value_per_share(
     return (total_shareholder_equity - preferred_equity) / common_shares_outstanding
 
 
+@overload
 def get_price_to_book_ratio(
-    price_per_share: SeriesOrFrame, book_value_per_share: SeriesOrFrame
-) -> SeriesOrFrame:
+    price_per_share: pd.Series, book_value_per_share: pd.Series
+) -> pd.Series: ...
+
+
+@overload
+def get_price_to_book_ratio(
+    price_per_share: pd.DataFrame, book_value_per_share: pd.DataFrame
+) -> pd.DataFrame: ...
+
+
+def get_price_to_book_ratio(
+    price_per_share: pd.Series | pd.DataFrame,
+    book_value_per_share: pd.Series | pd.DataFrame,
+) -> pd.Series | pd.DataFrame:
     """
     Calculate the price to book ratio, a valuation ratio that compares a company's market
     price to its book value per share.
@@ -182,11 +232,25 @@ def get_price_to_book_ratio(
     return price_per_share / book_value_per_share
 
 
+@overload
 def get_interest_debt_per_share(
-    interest_expense: SeriesOrFrame,
-    total_debt: SeriesOrFrame,
-    shares_outstanding: SeriesOrFrame,
-) -> SeriesOrFrame:
+    interest_expense: pd.Series, total_debt: pd.Series, shares_outstanding: pd.Series
+) -> pd.Series: ...
+
+
+@overload
+def get_interest_debt_per_share(
+    interest_expense: pd.DataFrame,
+    total_debt: pd.DataFrame,
+    shares_outstanding: pd.DataFrame,
+) -> pd.DataFrame: ...
+
+
+def get_interest_debt_per_share(
+    interest_expense: pd.Series | pd.DataFrame,
+    total_debt: pd.Series | pd.DataFrame,
+    shares_outstanding: pd.Series | pd.DataFrame,
+) -> pd.Series | pd.DataFrame:
     """
     Calculate the interest debt per share, a valuation ratio that measures the
     combined interest expense and debt burden of a company per outstanding share
@@ -210,9 +274,22 @@ def get_interest_debt_per_share(
     return (interest_expense + total_debt) / shares_outstanding
 
 
+@overload
 def get_capex_per_share(
-    capital_expenditures: SeriesOrFrame, shares_outstanding: SeriesOrFrame
-) -> Se
```

---

### Incident Patch 3: `3b40e745` (2026-10-01)
**Commit Message**: Fix empty treasury rates and a swapped benchmark in the MCP server

get_treasury_rates is served by FMP, but the server built FixedIncome
without the FMP key, so the rates tool always answered "No data
available". The key is now passed on and is part of the standalone
instance cache key, so instances are never shared between keys.

When a requested ticker was also the benchmark, the server silently
replaced the benchmark with the first unused fallback, so with
tickers=AAPL,SPY and benchmark_ticker=SPY the "Benchmark" series was
QQQ (739.77 instead of 762.63 on 2026-09-30) and every beta, alpha and
excess return was measured against the wrong index. The requested
benchmark is now kept, matching the library, and a fallback is only
used when the benchmark is the sole ticker. Either way the response
carries a note explaining where the benchmark's data is.

**File**: `financetoolkit/mcp_server/provider_model.py` (modified, +70/-31)
```diff
@@ -41,6 +41,54 @@
 except metadata.PackageNotFoundError:  # pragma: no cover - running from a checkout
     TOOLKIT_VERSION = "unknown"
 
+# Tried in order when the benchmark is the only requested ticker, so there is still something to analyse.
+FALLBACK_BENCHMARKS = ["SPY", "QQQ", "^GSPC", "IWM", "DIA", "VTI"]
+
+
+def resolve_benchmark_ticker(
+    tickers: list[str], benchmark_ticker: str | None
+) -> tuple[str | None, str | None]:
+    """
+    Decide which benchmark the Toolkit is built with when it overlaps the tickers.
+
+    The Toolkit drops a ticker that is also the benchmark and reports it under
+    "Benchmark" instead. That is kept whenever another ticker remains, so the
+    benchmark is always the one that was asked for: silently swapping it made
+    "Benchmark" a different security (e.g. QQQ instead of SPY) and skewed every
+    benchmark-based metric. Only when the benchmark is the sole ticker, which would
+    leave nothing to analyse, is a fallback benchmark used.
+
+    Args:
+        tickers (list[str]): The requested ticker symbols.
+        benchmark_ticker (str | None): The requested benchmark ticker.
+
+    Returns:
+        tuple[str | None, str | None]: The benchmark to build the Toolkit with, and a
+            note for the response describing what happened (None when nothing did).
+    """
+    upper_tickers = [ticker.upper() for ticker in tickers]
+
+    if not benchmark_ticker or benchmark_ticker.upper() not in upper_tickers:
+        return benchmark_ticker, None
+
+    if any(ticker != benchmark_ticker.upper() for ticker in upper_tickers):
+        return benchmark_ticker, (
+            f"{benchmark_ticker} is the benchmark, so its data is reported under "
+            f"'Benchmark' rather than as a separate {benchmark_ticker} column."
+        )
+
+    for candidate in FALLBACK_BENCHMARKS:
+        if candidate.upper() not in upper_tickers:
+            return candidate, (
+                f"{benchmark_ticker} was requested as both the ticker and the benchmark, "
+                f"so {candidate} is used as the benchmark: 'Benchmark' refers to {candidate}."
+            )
+
+    return None, (
+        f"{benchmark_ticker} was requested as both the ticker and the benchmark, so the "
+        "results are calculated without a benchmark."
+    )
+
 
 class ToolkitProvider:
     """
@@ -292,13 +340,20 @@ def get_transformation_notes(
         fred_api_key: str = "",
     ) -> list[str]:
         """Return human-readable notes describing data transformations applied to
-        the most recent result for the given Toolkit instance (fiscal-year
-        relabelling and currency conversion).
+        the most recent result for the given Toolkit instance (benchmark handling,
+        fiscal-year relabelling and currency conversion).
 
         Returns an empty list when no transformations were applied or when the
-        Toolkit instance has not yet fetched any financial statements.
+        Toolkit instance has not yet fetched any financial statements, apart from
+        the benchmark note, which depends on the request alone.
         """
         notes: list[str] = []
+
+        # Derived from the request alone, so it is reported even when the data fetch below fails.
+        _, benchmark_note = resolve_benchmark_ticker(tickers, benchmark_ticker)
+        if benchmark_note:
+            notes.append(benchmark_note)
+
         try:
             effective_key = resolve_api_key() or api_key or self._api_key
             effective_fred_key = (
@@ -410,29 +465,12 @@ def get_toolkit_instance(
         """
         upper_tickers = [t.upper() for t in tickers]
 
-        # The Toolkit drops a ticker that is also the benchmark, so pick another one.
-        if benchmark_ticker and benchmark_ticker.upper() in upper_tickers:
-            fallback_benchmarks = ["SPY", "QQQ", "^GSPC", "IWM", "DIA", "VTI"]
-            resolved_benchmark: str | None = None
-            for candidate in fallback_benchmarks:
-                if candidate.upper() not in upper_tickers:
-                    resolved_benchmark = candidate
-                    break
-            if resolved_benchmark:
-                logger.info(
-                    "benchmark_ticker '%s' conflicts with a requested ticker. "
-                    "Automatically switching benchmark to '%s'.",
-                    benchmark_ticker,
-                    resolved_benchmark,
-                )
-                benchmark_ticker = resolved_benchmark
-            else:
-                logger.warning(
-                    "benchmark_ticker '%s' conflicts with a requested ticker and no "
-                    "non-conflicting fallback could be found. Setting benchmark_ticker to None.",
-                    benchmark_ticker,
-                )
-                benchmark_ticker = None
+        # The note half is surfaced to the model by get_transformation_notes.
+        benchmark_ticker, benchmark_note = resolve_benchmark_ticker(
+      
```

**File**: `tests/mcp_server/test_provider_model.py` (added, +130/-0)
```diff
@@ -0,0 +1,130 @@
+"""MCP Provider Model Tests"""
+
+# Both bugs covered here only showed up through the MCP server, never in the library:
+# the server built FixedIncome without the FMP key (so get_treasury_rates came back
+# empty) and silently swapped a benchmark that was also a requested ticker (so
+# "Benchmark" was QQQ while SPY was asked for). The Toolkit and FixedIncome classes
+# are replaced by recorders, so these run offline and check what the server builds.
+
+import pandas as pd
+import pytest
+
+from financetoolkit.mcp_server import provider_model
+from financetoolkit.mcp_server.provider_model import (
+    ToolkitProvider,
+    resolve_benchmark_ticker,
+)
+
+
+class RecordingToolkit:
+    def __init__(self, **kwargs):
+        self.kwargs = kwargs
+
+
+class RecordingFixedIncome:
+    instances: list["RecordingFixedIncome"] = []
+
+    def __init__(self, **kwargs):
+        self.kwargs = kwargs
+        RecordingFixedIncome.instances.append(self)
+
+    def get_treasury_rates(self):
+        return pd.DataFrame({"10 Year": [0.04]})
+
+
+@pytest.fixture
+def provider(monkeypatch, tmp_path):
+    monkeypatch.setattr(provider_model, "Toolkit", RecordingToolkit)
+    monkeypatch.setattr(provider_model, "FixedIncome", RecordingFixedIncome)
+    monkeypatch.setattr(provider_model, "resolve_api_key", lambda: "")
+    monkeypatch.setattr(provider_model, "resolve_fred_api_key", lambda: "")
+    RecordingFixedIncome.instances = []
+
+    return ToolkitProvider(
+        cache_ttl=0,
+        database_location=str(tmp_path),
+        api_key="",
+        fred_api_key="",
+        cache_enabled=False,
+    )
+
+
+@pytest.mark.parametrize(
+    ("tickers", "benchmark", "expected"),
+    [
+        (["AAPL"], "SPY", "SPY"),
+        (["AAPL", "SPY"], "SPY", "SPY"),
+        (["aapl", "spy"], "SPY", "SPY"),
+        (["SPY"], "SPY", "QQQ"),
+        (["QQQ"], "QQQ", "SPY"),
+        (["AAPL"], None, None),
+    ],
+)
+def test_resolve_benchmark_ticker(tickers, benchmark, expected):
+    resolved, note = resolve_benchmark_ticker(tickers, benchmark)
+
+    assert resolved == expected
+    # A note is owed whenever the benchmark overlaps the tickers, and only then.
+    overlaps = benchmark is not None and benchmark.upper() in [
+        t.upper() for t in tickers
+    ]
+    assert (note is not None) == overlaps
+
+
+def test_benchmark_that_is_also_a_ticker_is_kept(provider):
+    toolkit = provider.get_toolkit_instance(
+        tickers=["AAPL", "SPY"],
+        start_date="2026-01-01",
+        end_date="2026-09-30",
+        quarterly=False,
+        benchmark_ticker="SPY",
+        api_key="test-key",
+    )
+
+    assert toolkit.kwargs["benchmark_ticker"] == "SPY"
+
+
+def test_benchmark_note_is_returned_with_the_result(provider):
+    notes = provider.get_transformation_notes(
+        tickers=["AAPL", "SPY"],
+        start_date="2026-01-01",
+        end_date="2026-09-30",
+        quarterly=False,
+        benchmark_ticker="SPY",
+        api_key="test-key",
+    )
+
+    assert any("'Benchmark'" in note for note in notes)
+
+
+def test_fixedincome_receives_the_fmp_key(provider):
+    result = provider.call_standalone_module_functionality(
+        module_name="fixedincome",
+        method_name="get_treasury_rates",
+        start_date="2026-09-01",
+        end_date="2026-09-30",
+        quarterly=False,
+        api_key="test-key",
+    )
+
+    assert not result.empty
+    assert RecordingFixedIncome.instances[0].kwargs["api_key"] == "test-key"
+
+
+def test_fixedincome_instances_are_not_shared_between_fmp_keys(provider):
+    for key in ["first-key", "second-key"]:
+        provider.call_standalone_module_functionality(
+            module_name="fixedincome",
+            method_name="get_treasury_rates",
+            start_date="2026-09-01",
+            end_date="2026-09-30",
+            quarterly=False,
+            api_key=key,
+        )
+
+    assert [
+        instance.kwargs["api_key"] for instance in RecordingFixedIncome.instances
+    ] == [
+        "first-key",
+        "second-key",
+    ]
```

---

### Incident Patch 4: `89c498bc` (2026-09-29)
**Commit Message**: Revert "Remove the deprecated smooth_widow alias from get_stochastic_oscillator"

This reverts commit fd34d4c1b99d1c5e178b690e73e92196687a24f4.

**File**: `financetoolkit/mcp_server/config.yaml` (modified, +4/-0)
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
```

**File**: `financetoolkit/technicals/technicals_controller.py` (modified, +22/-2)
```diff
@@ -2,6 +2,7 @@
 
 __docformat__ = "google"
 
+import warnings
 
 import pandas as pd
 
@@ -23,7 +24,7 @@
 # pylint: disable=too-many-lines,too-many-instance-attributes,too-many-public-methods,too-many-locals,eval-used
 # pylint: disable=too-many-boolean-expressions
 
-# The default number of periods the Stochastic Oscillator's %K line is smoothed over to obtain the %D signal line.  # noqa: E501
+# The default number of periods the Stochastic Oscillator's %K line is smoothed over to obtain the %D signal line, named so the deprecated `smooth_widow` alias can tell an explicitly passed `smooth_window` apart from the untouched default.  # noqa: E501
 DEFAULT_STOCHASTIC_SMOOTH_WINDOW = 3
 
 
@@ -3113,6 +3114,7 @@ def get_stochastic_oscillator(
         growth: bool = False,
         lag: int | list[int] = 1,
         standardize: bool = False,
+        smooth_widow: int | None = None,
     ) -> pd.Series | pd.DataFrame:
         """
         Calculate the Stochastic Oscillator indicator for a given price series.
@@ -3146,12 +3148,16 @@ def get_stochastic_oscillator(
             standardize (bool, optional): Whether to standardize (Z-Score) the result. When
                 combined with growth=True, standardizes the growth values instead of the raw
                 values. Defaults to False.
+            smooth_widow (int | None, optional): Deprecated misspelling of `smooth_window`,
+                accepted so that existing callers keep working. Passing it emits a
+                DeprecationWarning and forwards the value to `smooth_window`. Defaults to None.
 
         Returns:
             pd.Series or pd.DataFrame: Stochastic Oscillator (%K and %D) values.
 
         Raises:
-            ValueError: If the specified `period` is not one of the valid options.
+            ValueError: If the specified `period` is not one of the valid options, or if both
+                `smooth_window` and the deprecated `smooth_widow` are given conflicting values.
 
         Notes:
         - The method retrieves historical data based on the specified `period` and calculates
@@ -3184,6 +3190,20 @@ def get_stochastic_oscillator(
         | 2026-07-01 |         51.4243 |         71.9567 |
         | 2026-07-02 |         74.7297 |         97.7853 |
         """
+        if smooth_widow is not None:
+            warnings.warn(
+                "The 'smooth_widow' parameter is a misspelling and is deprecated, use "
+                "'smooth_window' instead. It will be removed in a future version.",
+                DeprecationWarning,
+                stacklevel=2,
+            )
+            if smooth_window not in (DEFAULT_STOCHASTIC_SMOOTH_WINDOW, smooth_widow):
+                raise ValueError(
+                    "Received conflicting values for 'smooth_window' and the deprecated "
+                    "'smooth_widow'. Pass only 'smooth_window'."
+                )
+            smooth_window = smooth_widow
+
         if period not in [
             "intraday",
             "daily",
```

---

### Incident Patch 5: `87d326a9` (2026-09-29)
**Commit Message**: Add overloads and type fixes so the remaining ty rules can be re-enabled

Adds @overload signatures across the model and utility functions so
scalar, Series and DataFrame inputs each get a precise return type, and
fixes the real mismatches the checker surfaced (for example the MCP
transport lookup, the owning controller of dispatched router methods
and the historical data annotations on the controllers).

With that in place invalid-argument-type and invalid-return-type move
from ignore to warn, and invalid-assignment, unresolved-attribute and
no-matching-overload are no longer ignored.

**File**: `financetoolkit/cache/cache_controller.py` (modified, +27/-1)
```diff
@@ -169,6 +169,31 @@ def entities_to_fetch(self) -> list[str]:
         """
         return [entity for entity, gaps in self.missing.items() if gaps]
 
+    def cached_frame(self, entity: str) -> pd.DataFrame | None:
+        """
+        The cached data for `entity` narrowed to a DataFrame, for the datasets that
+        only ever store frames; None when nothing is cached for it.
+
+        Args:
+            entity (str): The entity (ticker, series id, country) to look up.
+
+        Returns:
+            pd.DataFrame | None: The cached frame, or None when absent.
+
+        Raises:
+            TypeError: If the cached entry is a Series, which means the dataset is
+                written by one code path and read by another that disagree on shape.
+        """
+        cached = self.cached.get(entity)
+
+        if cached is not None and not isinstance(cached, pd.DataFrame):
+            raise TypeError(
+                f"The cached entry for {entity!r} is a {type(cached).__name__}, but a "
+                "DataFrame was expected."
+            )
+
+        return cached
+
     @property
     def fully_cached(self) -> bool:
         """
@@ -736,7 +761,8 @@ def get_statistics(self) -> dict[str, Any]:
         if not self._enabled or self._backend is None:
             return {"enabled": False, "location": str(self._location)}
 
-        statistics = self._backend.get_statistics()
+        # The backend only reports row counts; the flags added here widen the value type.
+        statistics: dict[str, Any] = dict(self._backend.get_statistics())
         statistics["enabled"] = True
         statistics["location"] = str(self._location)
 
```

**File**: `financetoolkit/cache/frame_model.py` (modified, +55/-4)
```diff
@@ -3,6 +3,8 @@
 __docformat__ = "google"
 
 import contextlib
+from datetime import date
+from typing import overload
 
 import pandas as pd
 
@@ -71,10 +73,39 @@ def get_date_bounds(
     return (min(dates), max(dates))
 
 
+# The cache holds Series and DataFrames alike, and both helpers hand back the kind
+# they were given; the overloads let a caller that stores frames keep a frame.
+@overload
+def slice_frame(
+    data: pd.DataFrame,
+    start: str | date | None = None,
+    end: str | date | None = None,
+    date_axis: int = 0,
+) -> pd.DataFrame: ...
+
+
+@overload
+def slice_frame(
+    data: pd.Series,
+    start: str | date | None = None,
+    end: str | date | None = None,
+    date_axis: int = 0,
+) -> pd.Series: ...
+
+
+@overload
+def slice_frame(
+    data: pd.DataFrame | pd.Series,
+    start: str | date | None = None,
+    end: str | date | None = None,
+    date_axis: int = 0,
+) -> pd.DataFrame | pd.Series: ...
+
+
 def slice_frame(
     data: pd.DataFrame | pd.Series,
-    start: str | None = None,
-    end: str | None = None,
+    start: str | date | None = None,
+    end: str | date | None = None,
     date_axis: int = 0,
 ) -> pd.DataFrame | pd.Series:
     """
@@ -87,8 +118,8 @@ def slice_frame(
 
     Args:
         data (pd.DataFrame | pd.Series): The frame to slice.
-        start (str | None): Inclusive start of the window. None leaves it open.
-        end (str | None): Inclusive end of the window. None leaves it open.
+        start (str | date | None): Inclusive start of the window. None leaves it open.
+        end (str | date | None): Inclusive end of the window. None leaves it open.
         date_axis (int): 0 when the index holds the dates, 1 when the columns do.
 
     Returns:
@@ -118,6 +149,26 @@ def slice_frame(
     return data.loc[mask] if date_axis == 0 else data.loc[:, mask]
 
 
+@overload
+def merge_frames(
+    existing: pd.DataFrame | None, incoming: pd.DataFrame, date_axis: int = 0
+) -> pd.DataFrame: ...
+
+
+@overload
+def merge_frames(
+    existing: pd.Series | None, incoming: pd.Series, date_axis: int = 0
+) -> pd.Series: ...
+
+
+@overload
+def merge_frames(
+    existing: pd.DataFrame | pd.Series | None,
+    incoming: pd.DataFrame | pd.Series,
+    date_axis: int = 0,
+) -> pd.DataFrame | pd.Series: ...
+
+
 def merge_frames(
     existing: pd.DataFrame | pd.Series | None,
     incoming: pd.DataFrame | pd.Series,
```

**File**: `financetoolkit/discovery/discovery_controller.py` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@
 logger = logger_model.get_logger()
 
 # Used as the Toolkit's default API key when set as an environment variable.
-API_KEY: str = os.environ.get("FINANCIAL_MODELING_PREP_API_KEY", None)
+API_KEY: str | None = os.environ.get("FINANCIAL_MODELING_PREP_API_KEY")
 
 
 class Discovery:
```

**File**: `financetoolkit/econometrics/diagnostics_model.py` (modified, +48/-6)
```diff
@@ -2,6 +2,8 @@
 
 __docformat__ = "google"
 
+from typing import overload
+
 import numpy as np
 import pandas as pd
 import statsmodels.api as sm
@@ -25,6 +27,14 @@
 SIGNIFICANCE_LEVEL = 0.05
 
 
+@overload
+def get_arch_lm_test(returns: pd.Series, lags: int = 5) -> pd.Series: ...
+
+
+@overload
+def get_arch_lm_test(returns: pd.DataFrame, lags: int = 5) -> pd.DataFrame: ...
+
+
 def get_arch_lm_test(
     returns: pd.Series | pd.DataFrame, lags: int = 5
 ) -> pd.Series | pd.DataFrame:
@@ -89,9 +99,15 @@ def get_arch_lm_test(
     raise TypeError("Expects pd.DataFrame or pd.Series, no other value.")
 
 
-def get_jarque_bera_test(
-    returns: pd.Series | pd.DataFrame,
-) -> pd.Series | pd.DataFrame:
+@overload
+def get_jarque_bera_test(returns: pd.Series) -> pd.Series: ...
+
+
+@overload
+def get_jarque_bera_test(returns: pd.DataFrame) -> pd.DataFrame: ...
+
+
+def get_jarque_bera_test(returns: pd.Series | pd.DataFrame) -> pd.Series | pd.DataFrame:
     """
     Calculate the Jarque-Bera test for normality, via
     `statsmodels.stats.stattools.jarque_bera`.
@@ -156,6 +172,18 @@ def get_jarque_bera_test(
     raise TypeError("Expects pd.DataFrame or pd.Series, no other value.")
 
 
+@overload
+def get_ljung_box_test(
+    returns: pd.Series, lags: int = 10, model_df: int = 0
+) -> pd.Series: ...
+
+
+@overload
+def get_ljung_box_test(
+    returns: pd.DataFrame, lags: int = 10, model_df: int = 0
+) -> pd.DataFrame: ...
+
+
 def get_ljung_box_test(
     returns: pd.Series | pd.DataFrame, lags: int = 10, model_df: int = 0
 ) -> pd.Series | pd.DataFrame:
@@ -259,6 +287,14 @@ def get_ljung_box_test(
     raise TypeError("Expects pd.DataFrame or pd.Series, no other value.")
 
 
+@overload
+def get_variance_ratio_test(returns: pd.Series, q: int = 2) -> pd.Series: ...
+
+
+@overload
+def get_variance_ratio_test(returns: pd.DataFrame, q: int = 2) -> pd.DataFrame: ...
+
+
 def get_variance_ratio_test(
     returns: pd.Series | pd.DataFrame, q: int = 2
 ) -> pd.Series | pd.DataFrame:
@@ -359,9 +395,15 @@ def get_variance_ratio_test(
     raise TypeError("Expects pd.DataFrame or pd.Series, no other value.")
 
 
-def get_cusum_test(
-    returns: pd.Series | pd.DataFrame,
-) -> pd.Series | pd.DataFrame:
+@overload
+def get_cusum_test(returns: pd.Series) -> pd.Series: ...
+
+
+@overload
+def get_cusum_test(returns: pd.DataFrame) -> pd.DataFrame: ...
+
+
+def get_cusum_test(returns: pd.Series | pd.DataFrame) -> pd.Series | pd.DataFrame:
     """
     Calculate the CUSUM test for the stability of the mean of returns over time, via
     `statsmodels.stats.diagnostic.breaks_cusumolsresid`.
```

**File**: `financetoolkit/econometrics/econometrics_controller.py` (modified, +143/-65)
```diff
@@ -27,6 +27,7 @@
 from financetoolkit.risk.helpers import determine_within_historical_data
 from financetoolkit.utilities.error_model import handle_errors
 from financetoolkit.utilities.logger_model import get_logger
+from financetoolkit.utilities.statistics_model import apply_rounding
 
 logger = get_logger()
 
@@ -54,7 +55,7 @@ class Econometrics:
     def __init__(
         self,
         tickers: str | list[str],
-        historical_data: pd.DataFrame = pd.DataFrame(),
+        historical_data: dict[str, pd.DataFrame] | None = None,
         intraday_period: str | None = None,
         quarterly: bool = False,
         rounding: int | None = 4,
@@ -66,7 +67,7 @@ def __init__(
 
         Args:
             tickers (str | list[str]): The tickers to use for the Toolkit instance.
-            historical_data (pd.DataFrame, optional): The historical data containing all periods.
+            historical_data (dict[str, pd.DataFrame] | None, optional): The historical data per period.
                 Defaults to pd.DataFrame().
             intraday_period (str | None, optional): The intraday period used for within-period calculations.
                 Defaults to None.
@@ -85,7 +86,9 @@ def __init__(
         toolkit.econometrics.get_augmented_dickey_fuller(period='yearly')
         ```
         """
-        self._historical_data = historical_data
+        # Mirrors the Risk controller: the Toolkit always passes the period dict, and an
+        # explicit empty dict keeps the daily lookups below raising a plain KeyError.
+        self._historical_data = historical_data if historical_data is not None else {}
         self._tickers = tickers
         self._quarterly = quarterly
         self._rounding: int | None = rounding
@@ -205,7 +208,9 @@ def get_arch_lm_test(
 
         result = diagnostics_model.get_arch_lm_test(returns, lags=lags)
 
-        return result.round(rounding if rounding is not None else self._rounding)
+        return apply_rounding(
+            result, rounding if rounding is not None else self._rounding
+        )
 
     @handle_portfolio
     @handle_errors
@@ -291,7 +296,9 @@ def get_jarque_bera_test(
 
         result = diagnostics_model.get_jarque_bera_test(returns)
 
-        return result.round(rounding if rounding is not None else self._rounding)
+        return apply_rounding(
+            result, rounding if rounding is not None else self._rounding
+        )
 
     @handle_portfolio
     @handle_errors
@@ -380,7 +387,9 @@ def get_ljung_box_test(
 
         result = diagnostics_model.get_ljung_box_test(returns, lags=lags)
 
-        return result.round(rounding if rounding is not None else self._rounding)
+        return apply_rounding(
+            result, rounding if rounding is not None else self._rounding
+        )
 
     @handle_portfolio
     @handle_errors
@@ -471,7 +480,9 @@ def get_variance_ratio_test(
 
         result = diagnostics_model.get_variance_ratio_test(returns, q=q)
 
-        return result.round(rounding if rounding is not None else self._rounding)
+        return apply_rounding(
+            result, rounding if rounding is not None else self._rounding
+        )
 
     @handle_portfolio
     @handle_errors
@@ -570,7 +581,9 @@ def get_cusum_test(
 
         result = diagnostics_model.get_cusum_test(returns)
 
-        return result.round(rounding if rounding is not None else self._rounding)
+        return apply_rounding(
+            result, rounding if rounding is not None else self._rounding
+        )
 
     def _get_price_column(self, period: str, column: str) -> pd.DataFrame:
         if period not in ["daily", "weekly", "monthly", "quarterly", "yearly"]:
@@ -796,7 +809,9 @@ def get_augmented_dickey_fuller(
             }
         )
 
-        return result.round(rounding if rounding is not None else self._rounding)
+        return apply_rounding(
+            result, rounding if rounding is not None else self._rounding
+        )
 
     @handle_portfolio
     @handle_errors
@@ -893,7 +908,9 @@ def get_kpss_test(
             }
         )
 
-        return result.round(rounding if rounding is not None else self._rounding)
+        return apply_rounding(
+            result, rounding if rounding is not None else self._rounding
+        )
 
     @handle_portfolio
     @handle_errors
@@ -980,7 +997,9 @@ def get_phillips_perron_test(
             }
         )
 
-        return result.round(rounding if rounding is not None else self._rounding)
+        return apply_rounding(
+            result, rounding if rounding is not None else self._rounding
+        )
 
     @handle_portfolio
     @handle_errors
@@ -1087,7 +1106,9 @@ def get_zivot_andrews_test(
             }
         )
 
-        return result.round(rounding if rounding is not None else self._rounding)
+        return apply_rounding(
+            result, rounding if rounding is not None else self._rounding
+        )
 
     @handle_errors
     def get_engle_granger_cointegration(
@@ -1171,7 +1192,9 
```

**File**: `financetoolkit/econometrics/forecast_evaluation_model.py` (modified, +39/-4)
```diff
@@ -3,6 +3,7 @@
 __docformat__ = "google"
 
 from collections.abc import Callable
+from typing import overload
 
 import numpy as np
 import pandas as pd
@@ -38,6 +39,28 @@ def _newey_west_long_run_variance(residuals: np.ndarray, lags: int) -> float:
     return variance
 
 
+@overload
+def get_diebold_mariano_test(
+    actual: pd.Series,
+    forecast_a: pd.Series,
+    forecast_b: pd.Series,
+    loss: str = "squared",
+    horizon: int = 1,
+    small_sample_correction: bool = True,
+) -> pd.Series: ...
+
+
+@overload
+def get_diebold_mariano_test(
+    actual: pd.DataFrame,
+    forecast_a: pd.DataFrame,
+    forecast_b: pd.DataFrame,
+    loss: str = "squared",
+    horizon: int = 1,
+    small_sample_correction: bool = True,
+) -> pd.DataFrame: ...
+
+
 def get_diebold_mariano_test(
     actual: pd.Series | pd.DataFrame,
     forecast_a: pd.Series | pd.DataFrame,
@@ -195,25 +218,37 @@ def get_diebold_mariano_test(
     raise TypeError("Expects pd.DataFrame or pd.Series, no other value.")
 
 
+@overload
+def get_volatility_forecast(
+    returns: pd.Series, method: str, window_size: int, lambda_: float
+) -> pd.Series: ...
+
+
+@overload
 def get_volatility_forecast(
-    returns: pd.Series,
+    returns: pd.DataFrame, method: str, window_size: int, lambda_: float
+) -> pd.DataFrame: ...
+
+
+def get_volatility_forecast(
+    returns: pd.Series | pd.DataFrame,
     method: str,
     window_size: int,
     lambda_: float,
-) -> pd.Series:
+) -> pd.Series | pd.DataFrame:
     """
     One-period-ahead Variance forecast, lagged by one period so it can be compared
     to the realized squared return out-of-sample -- the forecast half of the
     Diebold-Mariano test in `get_diebold_mariano_test`.
 
     Args:
-        returns (pd.Series): The asset's return series.
+        returns (pd.Series | pd.DataFrame): The asset's return series, or one column per asset.
         method (str): The forecasting method, one of "ewma" or "rolling".
         window_size (int): The rolling window size used by the "rolling" method.
         lambda_ (float): The decay factor used by the "ewma" method.
 
     Returns:
-        pd.Series: The lagged Variance forecast.
+        pd.Series | pd.DataFrame: The lagged Variance forecast, shaped like `returns`.
     """
     if method == "ewma":
         volatility = risk_model.get_ewma_volatility(returns, lambda_)
```

**File**: `financetoolkit/econometrics/panel_data_model.py` (modified, +8/-2)
```diff
@@ -7,6 +7,8 @@
 from linearmodels.panel import PanelOLS, RandomEffects
 from scipy import stats
 
+from financetoolkit.utilities.statistics_model import to_multi_index
+
 # pylint: disable=too-many-locals
 
 # (entity, time) levels are simultaneously meaningful, unlike the nested case.
@@ -59,7 +61,9 @@ def _to_panel_series(data: pd.Series | pd.DataFrame, label: str) -> pd.Series:
             f"{type(data).__name__}."
         )
 
-    series.index = _normalize_time_level(series.index.set_names(["entity", "time"]))
+    series.index = _normalize_time_level(
+        to_multi_index(series.index).set_names(["entity", "time"])
+    )
     return series.astype(float)
 
 
@@ -77,7 +81,9 @@ def _to_panel_frame(data: pd.Series | pd.DataFrame, label: str) -> pd.DataFrame:
         and data.index.nlevels == ENTITY_TIME_INDEX_LEVELS
     ):
         frame = data.copy()
-        frame.index = _normalize_time_level(frame.index.set_names(["entity", "time"]))
+        frame.index = _normalize_time_level(
+            to_multi_index(frame.index).set_names(["entity", "time"])
+        )
         return frame.astype(float)
 
     series = _to_panel_series(data, label)
```

**File**: `financetoolkit/econometrics/regression_model.py` (modified, +9/-4)
```diff
@@ -3,6 +3,7 @@
 __docformat__ = "google"
 
 import warnings
+from typing import Literal, cast
 
 import numpy as np
 import pandas as pd
@@ -13,6 +14,9 @@
 
 TWO_DIMENSIONAL = 2
 COV_TYPES = ("nonrobust", "HC0", "HC1", "HC2", "HC3", "cluster", "HAC")
+# The subset of statsmodels' cov_type literals this module exposes; typed so the
+# validated string can be handed to `.fit(cov_type=...)` as the literal it expects.
+StatsmodelsCovType = Literal["nonrobust", "HC0", "HC1", "HC2", "HC3", "cluster", "HAC"]
 
 # Cluster-robust standard errors require at least 2 distinct clusters.
 MINIMUM_CLUSTERS = 2
@@ -36,10 +40,10 @@ def _to_design_matrix(
     handing it to `statsmodels`.
     """
     if isinstance(x, pd.DataFrame):
-        feature_names = list(x.columns)
+        feature_names = [str(column) for column in x.columns]
         values = x.to_numpy(dtype=float)
     elif isinstance(x, pd.Series):
-        feature_names = [x.name if x.name is not None else "X1"]
+        feature_names = [str(x.name) if x.name is not None else "X1"]
         values = x.to_numpy(dtype=float).reshape(-1, 1)
     elif isinstance(x, np.ndarray):
         values = x if x.ndim == TWO_DIMENSIONAL else x.reshape(-1, 1)
@@ -87,7 +91,7 @@ def _validate_design(x: np.ndarray, y: np.ndarray) -> None:
 
 def _cov_type_and_kwds(
     cov_type: str, clusters: np.ndarray | None, maxlags: int | None = None
-) -> tuple[str, dict]:
+) -> tuple[StatsmodelsCovType, dict]:
     if cov_type not in COV_TYPES:
         raise ValueError(f"cov_type must be one of {COV_TYPES}, received {cov_type!r}.")
 
@@ -99,7 +103,8 @@ def _cov_type_and_kwds(
         return "HAC", {"maxlags": maxlags}
 
     if cov_type != "cluster":
-        return cov_type, {}
+        # Validated against COV_TYPES above, which is exactly the literal set.
+        return cast(StatsmodelsCovType, cov_type), {}
 
     if clusters is None:
         raise ValueError("clusters must be provided when cov_type='cluster'.")
```

---

### Incident Patch 6: `c3915e1e` (2026-09-29)
**Commit Message**: Run the test suite on Python 3.15 as an allowed-to-fail CI job

The classifiers claim support up to 3.15, which is still a pre-release,
so the job uses allow-prereleases and continue-on-error until 3.15 and
the compiled dependencies ship final wheels.

**File**: `.github/workflows/unit_tests.yml` (modified, +9/-0)
```diff
@@ -11,16 +11,25 @@ on:
 jobs:
   build:
     runs-on: ubuntu-latest
+    # The 3.15 job runs against the pre-release interpreter (the classifiers claim
+    # support up to 3.15) and is allowed to fail until 3.15 and the compiled
+    # dependencies ship final wheels, so it cannot block a PR.
+    continue-on-error: ${{ matrix.experimental }}
     strategy:
       matrix:
         python-version: ["3.11", "3.12", "3.13", "3.14"]
+        experimental: [false]
+        include:
+          - python-version: "3.15"
+            experimental: true
 
     steps:
       - uses: actions/checkout@v4
       - name: Set up Python ${{ matrix.python-version }}
         uses: actions/setup-python@v5
         with:
           python-version: ${{ matrix.python-version }}
+          allow-prereleases: ${{ matrix.experimental }}
 
       - name: Install uv
         uses: astral-sh/setup-uv@v5
```

---

### Incident Patch 7: `90e68f3e` (2026-09-28)
**Commit Message**: Fix government bond yield and dual gamma docstrings

get_government_bond_yield led with the 10-year description even though
short_term=True returns the 3-month rate; describe both maturities and
fix the Returns line. get_dual_gamma reused the gamma description; it
now describes the second derivative with respect to the strike price.

**File**: `financetoolkit/fixedincome/fixedincome_controller.py` (modified, +15/-10)
```diff
@@ -1942,8 +1942,12 @@ def get_government_bond_yield(
         standardize: bool = False,
     ):
         """
-        Long-term interest rates refer to government bonds maturing in ten years.
-        Rates are mainly determined by the price charged by the lender, the risk
+        Get the government bond yield for a variety of countries over time from the OECD. By
+        default this is the long-term (10-year) government bond yield; set short_term=True to
+        get the short-term (3-month) rate instead. The two maturities are described below.
+
+        Long-term (short_term=False): long-term interest rates refer to government bonds maturing
+        in ten years. Rates are mainly determined by the price charged by the lender, the risk
         from the borrower and the fall in the capital value. Long-term interest rates
         are generally averages of daily rates, measured as a percentage. These interest
         rates are implied by the prices at which the government bonds are traded on
@@ -1956,13 +1960,13 @@ def get_government_bond_yield(
 
         See definition: https://data.oecd.org/interest/long-term-interest-rates.htm
 
-        Short-term interest rates are the rates at which short-term borrowings are
-        effected between financial institutions or the rate at which short-term government
-        paper is issued or traded in the market. Short-term interest rates are generally
-        averages of daily rates, measured as a percentage.
-
-        Short-term interest rates are based on three-month money market rates where available.
-        Typical standardised names are "money market rate" and "treasury bill rate".
+        Short-term (short_term=True): short-term interest rates are the rates at which short-term
+        borrowings are effected between financial institutions or the rate at which short-term
+        government paper is issued or traded in the market. Short-term interest rates are
+        generally averages of daily rates, measured as a percentage. They are based on
+        three-month money market rates where available; the OECD source specifically returns
+        the 3-month interbank offered rate rather than a government bill yield, so for most
+        countries it tracks the central bank's policy rate closely.
 
         See definition: https://data.oecd.org/interest/short-term-interest-rates.htm
 
@@ -1980,7 +1984,8 @@ def get_government_bond_yield(
                 values. Defaults to False.
 
         Returns:
-            pd.DataFrame: A DataFrame containing the Long Term Interest Rate.
+            pd.DataFrame: A DataFrame containing the long-term (10-year) government bond yield, or the
+                short-term (3-month) interest rate when short_term=True.
 
         As an example:
 
```

**File**: `financetoolkit/options/options_controller.py` (modified, +9/-7)
```diff
@@ -4552,13 +4552,15 @@ def get_dual_gamma(
         standardize: bool = False,
     ):
         """
-        Calculate the gamma of an option based on the Black Scholes Model. The Black Scholes Model
-        is a mathematical model used to estimate the price of European—style options. The gamma is
-        the rate of change of the delta with respect to the price of the underlying asset.
-
-        The gamma calculation is the theoretical value of the gamma. The actual gamma can differ from this
-        value due to several factors such as the volatility of the underlying asset, the time to expiration,
-        the risk free rate and more.
+        Calculate the dual gamma of an option based on the Black Scholes Model. The Black Scholes Model
+        is a mathematical model used to estimate the price of European—style options. The dual gamma is
+        the second derivative of the option price with respect to the strike price, i.e. the rate of change
+        of the dual delta as the strike price changes. It is the strike-space counterpart of gamma and
+        describes the (discounted) risk-neutral probability density of the underlying finishing at the strike.
+
+        The dual gamma calculation is the theoretical value of the dual gamma. The actual dual gamma can differ
+        from this value due to several factors such as the volatility of the underlying asset, the time to
+        expiration, the risk free rate and more.
 
         The formula is as follows:
 
```

---

### Incident Patch 8: `4ed2fffb` (2026-09-10)
**Commit Message**: Speed up and harden the test suite and CI

Adds pytest-xdist and runs CI with -n auto plus the uv cache. The recorder
gains --rewrite-failing, which rewrites only records that fail comparison so
regeneration cannot churn unrelated files through float drift. Economics tests
now skip cleanly offline and without a FRED key instead of erroring.

**File**: `.github/workflows/linting.yml` (modified, +2/-0)
```diff
@@ -23,6 +23,8 @@ jobs:
 
       - name: Install uv
         uses: astral-sh/setup-uv@v5
+        with:
+          enable-cache: true
 
       - name: Install dependencies
         run: uv sync
```

**File**: `.github/workflows/unit_tests.yml` (modified, +3/-1)
```diff
@@ -24,9 +24,11 @@ jobs:
 
       - name: Install uv
         uses: astral-sh/setup-uv@v5
+        with:
+          enable-cache: true
 
       - name: Install dependencies
         run: uv sync --extra mcp
 
       - name: Test with pytest
-        run: uv run pytest --timeout=60
\ No newline at end of file
+        run: uv run pytest -n auto --timeout=60
\ No newline at end of file
```

**File**: `pyproject.toml` (modified, +1/-0)
```diff
@@ -98,6 +98,7 @@ dev = [
     "nbconvert>=7.17.1",
     "matplotlib>=3.11.1",
     "seaborn>=0.13.2",
+    "pytest-xdist>=3.8.0",
 ]
 
 [tool.uv]
```

**File**: `tests/conftest.py` (modified, +36/-3)
```diff
@@ -315,11 +315,13 @@ def __init__(
         record_mode: str,
         display_limit: int = DISPLAY_LIMIT,
         rewrite_expected: bool = False,
+        rewrite_failing: bool = False,
     ) -> None:
         self.__path_template = path_template
         self.__record_mode = record_mode
         self.__display_limit = display_limit
         self.__rewrite_expected = rewrite_expected
+        self.__rewrite_failing = rewrite_failing
 
         self.__record_list: list[Record] = list()
 
@@ -378,7 +380,11 @@ def persist(self):
             else:
                 raise Exception(f"Unknown `record-mode` : {record_mode}")
 
-            if save or rewrite_expected:
+            if (
+                save
+                or rewrite_expected
+                or (self.__rewrite_failing and record.record_changed)
+            ):
                 record.persist()
 
 
@@ -451,6 +457,17 @@ def pytest_addoption(parser: Parser):
         action="store_true",
         help="To force `record_stdout` and `recorder` to rewrite all files.",
     )
+    parser.addoption(
+        "--rewrite-failing",
+        action="store_true",
+        help=(
+            "To make `recorder` rewrite only the records that fail comparison, "
+            "leaving records that still match (within float tolerance) untouched. "
+            "This is the safe way to regenerate recordings after a behavioural "
+            "change: `--rewrite-expected` also rewrites unrelated files whose "
+            "last digits drift between platforms."
+        ),
+    )
     parser.addoption(
         "--autodoc",
         action="store_true",
@@ -471,6 +488,12 @@ def rewrite_expected(request: SubRequest) -> bool:
     return request.config.getoption("--rewrite-expected")
 
 
+@pytest.fixture(scope="session")  # type: ignore
+def rewrite_failing(request: SubRequest) -> bool:
+    """Make `recorder` rewrite only the records that fail comparison."""
+    return request.config.getoption("--rewrite-failing")
+
+
 @pytest.fixture(scope="session")
 def live_mode(request: SubRequest) -> bool:
     """Run tests with live API data instead of pickle files."""
@@ -574,6 +597,7 @@ def record_stdout(
 def recorder(
     disable_recording: bool,
     rewrite_expected: bool,
+    rewrite_failing: bool,
     record_mode: str,
     request: SubRequest,
     live_mode: bool,
@@ -596,7 +620,10 @@ def recorder(
         )
     else:
         recorder = Recorder(
-            path_template, record_mode, rewrite_expected=rewrite_expected
+            path_template,
+            record_mode,
+            rewrite_expected=rewrite_expected,
+            rewrite_failing=rewrite_failing,
         )
         yield recorder
         recorder.persist()
@@ -690,7 +717,13 @@ def fixedincome_module():
 
 
 @pytest.fixture(scope="session")
-def economics_module():
+def economics_module(live_mode):
+    # Session-scoped fixtures are set up before the autouse skip fixture in
+    # tests/economics/conftest.py, so without this guard an offline run errors
+    # during fixture setup instead of skipping.
+    if not live_mode:
+        pytest.skip("Economics tests require --live flag")
+
     from financetoolkit.economics import economics_controller
 
     return economics_controller.Economics(
```

**File**: `tests/economics/conftest.py` (modified, +31/-2)
```diff
@@ -1,10 +1,39 @@
 """Economics test configuration — all tests require --live flag."""
 
+import os
+
 import pytest
 
+# The Economics methods backed by FRED rather than OECD; these additionally need a
+# FRED_API_KEY in live mode. Kept as test-name substrings so a keyless contributor
+# running --live sees these skip rather than error.
+FRED_BACKED_TESTS = [
+    "nonfarm_payrolls",
+    "initial_jobless_claims",
+    "retail_sales",
+    "industrial_production_index",
+    "housing_starts",
+    "real_personal_income",
+    "mortgage_rate_30_year",
+    "recession_indicator",
+    "commercial_real_estate_prices",
+    "real_yield_curve",
+    "breakeven_inflation_expectations",
+]
+
 
 @pytest.fixture(autouse=True)
-def skip_if_not_live(live_mode):
-    """Skip economics tests in pickle mode — all methods fetch live API data."""
+def skip_if_not_live(request, live_mode):
+    """Skip economics tests in pickle mode — all methods fetch live API data.
+
+    This runs before the test itself, but session-scoped fixtures the test requests
+    (like economics_module) are set up before autouse function-scoped fixtures, so
+    the same guard also lives inside economics_module in the root conftest.
+    """
     if not live_mode:
         pytest.skip("Economics tests require --live flag")
+
+    if not os.environ.get("FRED_API_KEY") and any(
+        name in request.node.name for name in FRED_BACKED_TESTS
+    ):
+        pytest.skip("This economics test requires a FRED_API_KEY")
```

**File**: `uv.lock` (modified, +38/-14)
```diff
@@ -6,13 +6,13 @@ resolution-markers = [
     "python_full_version >= '3.14' and sys_platform == 'emscripten'",
     "python_full_version >= '3.14' and sys_platform != 'emscripten' and sys_platform != 'win32'",
     "python_full_version == '3.13.*' and sys_platform == 'win32'",
-    "python_full_version == '3.12.*' and sys_platform == 'win32'",
-    "python_full_version < '3.12' and sys_platform == 'win32'",
     "python_full_version == '3.13.*' and sys_platform == 'emscripten'",
-    "python_full_version == '3.12.*' and sys_platform == 'emscripten'",
-    "python_full_version < '3.12' and sys_platform == 'emscripten'",
     "python_full_version == '3.13.*' and sys_platform != 'emscripten' and sys_platform != 'win32'",
+    "python_full_version == '3.12.*' and sys_platform == 'win32'",
+    "python_full_version == '3.12.*' and sys_platform == 'emscripten'",
     "python_full_version == '3.12.*' and sys_platform != 'emscripten' and sys_platform != 'win32'",
+    "python_full_version < '3.12' and sys_platform == 'win32'",
+    "python_full_version < '3.12' and sys_platform == 'emscripten'",
     "python_full_version < '3.12' and sys_platform != 'emscripten' and sys_platform != 'win32'",
 ]
 
@@ -939,6 +939,15 @@ wheels = [
     { url = "https://files.pythonhosted.org/packages/8a/0e/97c33bf5009bdbac74fd2beace167cab3f978feb69cc36f1ef79360d6c4e/exceptiongroup-1.3.1-py3-none-any.whl", hash = "sha256:a7a39a3bd276781e98394987d3a5701d0c4edffb633bb7a5144577f82c773598", size = 16740, upload-time = "2025-11-21T23:01:53.443Z" },
 ]
 
+[[package]]
+name = "execnet"
+version = "2.1.2"
+source = { registry = "https://pypi.org/simple" }
+sdist = { url = "https://files.pythonhosted.org/packages/bf/89/780e11f9588d9e7128a3f87788354c7946a9cbb1401ad38a48c4db9a4f07/execnet-2.1.2.tar.gz", hash = "sha256:63d83bfdd9a23e35b9c6a3261412324f964c2ec8dcd8d3c6916ee9373e0befcd", size = 166622, upload-time = "2025-11-12T09:56:37.75Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/ab/84/02fc1827e8cdded4aa65baef11296a9bbe595c474f0d6d758af082d849fd/execnet-2.1.2-py3-none-any.whl", hash = "sha256:67fba928dd5a544b783f6056f449e5e3931a5c378b128bc18501f7ea79e296ec", size = 40708, upload-time = "2025-11-12T09:56:36.333Z" },
+]
+
 [[package]]
 name = "executing"
 version = "2.2.1"
@@ -1064,6 +1073,7 @@ dev = [
     { name = "pytest-mock" },
     { name = "pytest-recording" },
     { name = "pytest-timeout" },
+    { name = "pytest-xdist" },
     { name = "ruff" },
     { name = "seaborn" },
     { name = "types-pyyaml" },
@@ -1106,6 +1116,7 @@ dev = [
     { name = "pytest-mock", specifier = ">=3.14" },
     { name = "pytest-recording", specifier = ">=0.13" },
     { name = "pytest-timeout", specifier = ">=2.3" },
+    { name = "pytest-xdist", specifier = ">=3.8.0" },
     { name = "ruff", specifier = ">=0.13.2" },
     { name = "seaborn", specifier = ">=0.13.2" },
     { name = "types-pyyaml", specifier = ">=6.0" },
@@ -1288,7 +1299,7 @@ name = "importlib-metadata"
 version = "9.0.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
-    { name = "zipp", marker = "python_full_version < '3.12'" },
+    { name = "zipp" },
 ]
 sdist = { url = "https://files.pythonhosted.org/packages/a9/01/15bb152d77b21318514a96f43af312635eb2500c96b55398d020c93d86ea/importlib_metadata-9.0.0.tar.gz", hash = "sha256:a4f57ab599e6a2e3016d7595cfd72eb4661a5106e787a95bcc90c7105b831efc", size = 56405, upload-time = "2026-03-20T06:42:56.999Z" }
 wheels = [
@@ -2396,10 +2407,10 @@ resolution-markers = [
     "python_full_version >= '3.14' and sys_platform == 'emscripten'",
     "python_full_version >= '3.14' and sys_platform != 'emscripten' and sys_platform != 'win32'",
     "python_full_version == '3.13.*' and sys_platform == 'win32'",
-    "python_full_version == '3.12.*' and sys_platform == 'win32'",
     "python_full_version == '3.13.*' and sys_platform == 'emscripten'",
-    "python_full_version == '3.12.*' and sys_platform == 'emscripten'",
     "python_full_version == '3.13.*' and sys_platform != 'emscripten' and sys_platform != 'win32'",
+    "python_full_version == '3.12.*' and sys_platform == 'win32'",
+    "python_full_version == '3.12.*' and sys_platform == 'emscripten'",
     "python_full_version == '3.12.*' and sys_platform != 'emscripten' and sys_platform != 'win32'",
 ]
 sdist = { url = "https://files.pythonhosted.org/packages/22/fd/89965aa4ac08c74998539fcbf24fa3540f3e15237fbeb6bcf9c908f4aade/numpy-2.5.1.tar.gz", hash = "sha256:a48a113e6afea91f5608793bafa7ef2ad481fefbda87ec5069f483de61cb9fa3", size = 20755553, upload-time = "2026-07-04T17:08:00.933Z" }
@@ -2621,7 +2632,7 @@ name = "pexpect"
 version = "4.9.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
-    { name = "ptyprocess", marker = "sys_platform != 'emscripten' and sys_platform != 'win32'" },
+    { name = "ptyprocess" },
 ]
 sdist = { url = "https://files.pythonhosted.org/packages/42/92/cc564bf6381ff43ce1f4d06852fc19a2f11d180f23dc32d9588bee2f1
```

---

### Incident Patch 9: `b21989f4` (2026-08-16)
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

### Incident Patch 10: `18d38f35` (2026-08-16)
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

### Incident Patch 11: `2f4a7675` (2026-08-11)
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
-        attempts fail.
+        bounds (list[tuple[float, float]]): The parameter bounds every starting point is
+        drawn from and every local search is confined to.
+        initial_guess (list[float]): A domain-informed starting point, tried in addition
+        to the Sobol-sampled ones.
+        model_name (str): The model name to include in the warning message if every
+        attempt fails.
 
     Returns:
-        np.ndarray: The fitted weights, or an array of NaN (same length as
-        `initial_guess`) if the optimizer did not move off `x0` on either attempt.
+        np.ndarray: The fitted weights from the best-scoring successful attempt, or an
+        array of NaN (same length as `initial_guess`) if every attempt failed.
     """
-    x0 = np.asarray(initial_guess, dtype=float)
+    dim = len(bounds)
+    lower = np.array([b[0] for b in bounds], dtype=float)
+    upper = np.array([b[1] for b in bounds], dtype=float)
 
-    def _stuck_at_start(result) -> bool:
-        
```

---

### Incident Patch 12: `ae06fff0` (2026-08-11)
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

### Incident Patch 13: `3a8eee3e` (2026-08-11)
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

### Incident Patch 14: `730d3ee6` (2026-08-11)
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
@@ -189,8 +223,7 @@ def convert_currencies(
 
                     financial_statement_data.loc[(ticker, items_to_adjust), :] = (
                         financial_statement_data.loc[(ticker, items_to_adjust), :].mul(
-                            exchange_rate_data.loc[periods, currency]
-                            * minor_unit_factor,
+                            rates * minor_unit_factor,
                             axis=1,
                         )
                     ).to_numpy()
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

### Incident Patch 15: `93aef655` (2026-08-11)
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
@@ -937,7 +940,7 @@ def get_ultima(
     Args:
         stock_price (float): Current stock price.
         strike_price (float): Option strike price.
-        time_to_expiry (float): Time to option expiry (in years).
+        time_to_expiration (float): Time to option expiry (in years).
         risk_free_rate (float): Risk-free interest rate (annualized).
         volatility (float): Volatility of the underlying stock.
         dividend_yield (float): Dividend yield (annualized). Defaults to 0.
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

**File**: `tests/technical/csv/test_technical_controller/test_get_parabolic_sar_1.csv` (modified, +6/-6)
```diff
@@ -245,8 +245,8 @@ Date,AAPL,MSFT,Benchmark
 2020-12-16,0.009,0.0008,0.0033
 2020-12-17,0.0097,0.0022,0.0033
 2020-12-18,0.011,0.0034,0.0186
-2020-12-21,0.0573,0.0032,-0.0146
-2020-12-22,-0.0473,0.0052,-0.0136
+2020-12-21,0.0573,0.0032,-0.028
+2020-12-22,-0.0473,0.0052,0.0
 2020-12-23,0.0,0.0067,0.0
 2020-12-24,0.0018,0.006,0.0009
 2020-12-28,0.0017,0.0054,0.0009
@@ -328,13 +328,13 @@ Date,AAPL,MSFT,Benchmark
 2021-04-19,0.0086,0.0094,0.0066
 2021-04-20,0.009,0.0079,0.0052
 2021-04-21,0.0085,0.0062,0.0029
-2021-04-22,0.0059,0.0248,0.0
-2021-04-23,0.0,0.0011,0.0013
+2021-04-22,0.0059,0.026,0.0
+2021-04-23,0.0,0.0,0.0013
 2021-04-26,0.0008,-0.0235,0.0
 2021-04-27,0.0056,0.0005,0.0035
 2021-04-28,0.0046,0.029,0.0028
-2021-04-29,0.0209,0.0,0.0026
-2021-04-30,0.0114,-0.0022,0.0029
+2021-04-29,0.0325,0.0,0.0026
+2021-04-30,0.0,-0.0022,0.0029
 2021-05-03,0.0,-0.0021,0.0009
 2021-05-04,-0.0018,-0.002,0.0105
 2021-05-05,-0.0044,-0.0036,-0.0004
```

**File**: `tests/technical/csv/test_technical_controller/test_get_parabolic_sar_2.csv` (modified, +12/-12)
```diff
@@ -247,10 +247,10 @@ Date,,,,,,,,,
 2020-12-16,0.009,0.0156,0.023,0.0008,0.0015,-0.0367,0.0033,0.0033,0.0052
 2020-12-17,0.0097,0.0188,0.0254,0.0022,0.003,0.0038,0.0033,0.0066,0.0066
 2020-12-18,0.011,0.0208,0.03,0.0034,0.0057,0.0064,0.0186,0.0219,0.0253
-2020-12-21,0.0573,0.0689,0.0793,0.0032,0.0067,0.0089,-0.0146,0.0037,0.007
-2020-12-22,-0.0473,0.0073,0.0184,0.0052,0.0084,0.0119,-0.0136,-0.028,-0.01
-2020-12-23,0.0,-0.0473,0.0073,0.0067,0.0119,0.0152,0.0,-0.0136,-0.028
-2020-12-24,0.0018,0.0018,-0.0456,0.006,0.0128,0.018,0.0009,0.0009,-0.0127
+2020-12-21,0.0573,0.0689,0.0793,0.0032,0.0067,0.0089,-0.028,-0.01,-0.0067
+2020-12-22,-0.0473,0.0073,0.0184,0.0052,0.0084,0.0119,0.0,-0.028,-0.01
+2020-12-23,0.0,-0.0473,0.0073,0.0067,0.0119,0.0152,0.0,0.0,-0.028
+2020-12-24,0.0018,0.0018,-0.0456,0.006,0.0128,0.018,0.0009,0.0009,0.0009
 2020-12-28,0.0017,0.0035,0.0035,0.0054,0.0114,0.0182,0.0009,0.0018,0.0018
 2020-12-29,0.0043,0.0061,0.0079,0.006,0.0114,0.0175,0.0009,0.0018,0.0027
 2020-12-30,0.0069,0.0113,0.0131,0.0069,0.0129,0.0183,0.0009,0.0017,0.0026
@@ -330,15 +330,15 @@ Date,,,,,,,,,
 2021-04-19,0.0086,0.0188,0.0309,0.0094,0.0191,0.0288,0.0066,0.0138,0.0206
 2021-04-20,0.009,0.0177,0.0279,0.0079,0.0174,0.0271,0.0052,0.0118,0.0191
 2021-04-21,0.0085,0.0175,0.0263,0.0062,0.0142,0.0237,0.0029,0.0081,0.0147
-2021-04-22,0.0059,0.0145,0.0236,0.0248,0.0312,0.0393,0.0,0.0029,0.0081
-2021-04-23,0.0,0.0059,0.0145,0.0011,0.026,0.0324,0.0013,0.0013,0.0042
-2021-04-26,0.0008,0.0008,0.0068,-0.0235,-0.0223,0.0019,0.0,0.0013,0.0013
-2021-04-27,0.0056,0.0065,0.0065,0.0005,-0.0229,-0.0218,0.0035,0.0035,0.0048
+2021-04-22,0.0059,0.0145,0.0236,0.026,0.0324,0.0405,0.0,0.0029,0.0081
+2021-04-23,0.0,0.0059,0.0145,0.0,0.026,0.0324,0.0013,0.0013,0.0042
+2021-04-26,0.0008,0.0008,0.0068,-0.0235,-0.0235,0.0019,0.0,0.0013,0.0013
+2021-04-27,0.0056,0.0065,0.0065,0.0005,-0.0229,-0.0229,0.0035,0.0035,0.0048
 2021-04-28,0.0046,0.0103,0.0111,0.029,0.0295,0.0054,0.0028,0.0062,0.0062
-2021-04-29,0.0209,0.0256,0.0314,0.0,0.029,0.0295,0.0026,0.0053,0.0088
-2021-04-30,0.0114,0.0325,0.0372,-0.0022,-0.0022,0.0268,0.0029,0.0055,0.0082
-2021-05-03,0.0,0.0114,0.0325,-0.0021,-0.0042,-0.0042,0.0009,0.0038,0.0064
-2021-05-04,-0.0018,-0.0018,0.0096,-0.002,-0.0041,-0.0062,0.0105,0.0115,0.0144
+2021-04-29,0.0325,0.0372,0.0431,0.0,0.029,0.0295,0.0026,0.0053,0.0088
+2021-04-30,0.0,0.0325,0.0372,-0.0022,-0.0022,0.0268,0.0029,0.0055,0.0082
+2021-05-03,0.0,0.0,0.0325,-0.0021,-0.0042,-0.0042,0.0009,0.0038,0.0064
+2021-05-04,-0.0018,-0.0018,-0.0018,-0.002,-0.0041,-0.0062,0.0105,0.0115,0.0144
 2021-05-05,-0.0044,-0.0062,-0.0062,-0.0036,-0.0056,-0.0077,-0.0004,0.0101,0.011
 2021-05-06,-0.0042,-0.0086,-0.0104,-0.0034,-0.007,-0.009,-0.0004,-0.0009,0.0097
 2021-05-07,-0.004,-0.0081,-0.0125,-0.0046,-0.008,-0.0116,-0.0207,-0.0211,-0.0215
```

**File**: `tests/technical/csv/test_technical_controller/test_get_triangular_moving_average.csv` (modified, +750/-750)
```diff
@@ -6,753 +6,753 @@ Date,AAPL,MSFT,Benchmark
 2020-01-07,71.8326,151.4993,298.483
 2020-01-08,71.9172,151.5361,298.5464
 2020-01-09,72.031,151.6238,298.6543
-2020-01-10,72.1542,151.7186,298.7628
-2020-01-13,72.4833,152.0321,299.1023
-2020-01-14,72.757,152.1943,299.3053
-2020-01-15,73.079,152.4462,299.6284
-2020-01-16,73.4395,152.803,300.0396
-2020-01-17,73.8735,153.3355,300.5948
-2020-01-21,74.3316,153.9361,301.223
-2020-01-22,74.7736,154.5367,301.8642
-2020-01-23,75.2116,155.1886,302.5645
-2020-01-24,75.5662,155.7836,303.1886
-2020-01-27,75.8603,156.3584,303.7184
-2020-01-28,76.1256,156.8991,304.1461
-2020-01-29,76.3669,157.3613,304.4066
-2020-01-30,76.5505,157.7661,304.4723
-2020-01-31,76.6567,158.1309,304.3011
-2020-02-03,76.6981,158.5716,303.9578
-2020-02-04,76.7044,159.1317,303.4894
-2020-02-05,76.7175,159.8873,303.0683
-2020-02-06,76.8061,160.9591,302.8556
-2020-02-07,76.8825,162.2719,302.7383
-2020-02-10,76.9169,163.8648,302.7994
-2020-02-11,76.9186,165.547,303.0314
-2020-02-12,77.0169,167.3895,303.6281
-2020-02-13,77.2136,169.2416,304.5159
-2020-02-14,77.4377,170.9717,305.5656
-2020-02-18,77.6434,172.5894,306.6122
-2020-02-19,77.7848,173.9506,307.5703
-2020-02-20,77.9156,175.0522,308.5206
-2020-02-21,78.0219,175.702,309.3372
-2020-02-24,78.0602,175.9828,309.8589
-2020-02-25,77.8803,175.8062,309.7962
-2020-02-26,77.5141,175.2956,309.1775
-2020-02-27,76.9269,174.3083,307.8562
-2020-02-28,76.1731,172.8422,305.8945
-2020-03-02,75.3281,171.0973,303.4473
-2020-03-03,74.3645,169.0395,300.4011
-2020-03-04,73.3941,167.0052,297.0744
-2020-03-05,72.485,165.0969,293.6448
-2020-03-06,71.7278,163.3328,290.3538
-2020-03-09,70.9923,161.4714,286.8936
-2020-03-10,70.4967,160.0497,283.8812
-2020-03-11,70.1819,158.8722,281.1372
-2020-03-12,69.7695,157.407,277.935
-2020-03-13,69.4317,156.1545,274.8166
-2020-03-16,68.9034,154.4967,270.9414
-2020-03-17,68.243,152.6133,266.6373
-2020-03-18,67.4183,150.5105,261.7228
-2020-03-19,66.613,148.5817,256.8595
-2020-03-20,65.55,146.2595,251.2858
-2020-03-23,64.2856,143.7988,245.3047
-2020-03-24,63.2078,141.9811,240.1531
-2020-03-25,62.0498,140.0703,235.1438
-2020-03-26,61.183,138.9945,231.5195
-2020-03-27,60.4488,138.2603,228.643
-2020-03-30,59.9061,138.1392,226.9311
-2020-03-31,59.4806,138.3608,225.9772
-2020-04-01,59.3122,139.1556,226.117
-2020-04-02,59.4153,140.5027,227.4
-2020-04-03,59.503,141.793,228.8073
-2020-04-06,59.7781,143.5358,230.7816
-2020-04-07,59.9955,145.0794,232.4822
-2020-04-08,60.3017,146.8069,234.4519
-2020-04-09,60.627,148.3112,236.3272
-2020-04-13,60.9881,149.7078,238.1917
-2020-04-14,61.48,151.2064,240.3511
-2020-04-15,62.0438,152.6653,242.4677
-2020-04-16,62.7997,154.3894,244.96
-2020-04-17,63.5683,156.0384,247.5062
-2020-04-20,64.3995,157.7502,250.2345
-2020-04-21,65.17,159.2712,252.6488
-2020-04-22,65.9211,160.8442,254.8356
-2020-04-23,66.607,162.3891,256.812
-2020-04-24,67.1025,163.6239,258.2297
-2020-04-27,67.4433,164.6427,259.4056
-2020-04-28,67.5819,165.2061,260.2288
-2020-04-29,67.6622,165.5527,260.8309
-2020-04-30,67.74,165.7884,261.3233
-2020-05-01,67.8875,166.085,261.9719
-2020-05-04,68.0691,166.3358,262.6723
-2020-05-05,68.3294,166.6378,263.4264
-2020-05-06,68.6722,167.0464,264.2109
-2020-05-07,69.0978,167.5653,264.8697
-2020-05-08,69.6769,168.4147,265.5297
-2020-05-11,70.3438,169.4208,266.0839
-2020-05-12,71.0167,170.4139,266.4536
-2020-05-13,71.6848,171.3836,266.6642
-2020-05-14,72.3536,172.2991,266.8302
-2020-05-15,72.9786,173.1108,266.8941
-2020-05-18,73.5941,173.8386,267.0955
-2020-05-19,74.1705,174.4241,267.35
-2020-05-20,74.6586,174.8095,267.5723
-2020-05-21,75.0472,175.0139,267.8395
-2020-05-22,75.3942,175.1917,268.2894
-2020-05-26,75.7022,175.3269,269.0106
-2020-05-27,75.9775,175.4634,269.9811
-2020-05-28,76.2511,175.5453,271.1928
-2020-05-29,76.4786,175.5745,272.3839
-2020-06-01,76.7003,175.5989,273.7098
-2020-06-02,76.9031,175.5897,275.1323
-2020-06-03,77.1303,175.6514,276.7717
-2020-06-04,77.342,175.6816,278.515
-2020-06-05,77.5755,175.7612,280.2984
-2020-06-08,77.8345,175.9125,282.0981
-2020-06-09,78.1516,176.2084,283.9142
-2020-06-10,78.5898,176.7255,285.8081
-2020-06-11,79.0484,177.2984,287.4331
-2020-06-12,79.5502,177.9252,288.8402
-2020-06-15,80.0884,178.5764,289.9212
-2020-06-16,80.7269,179.3964,290.7944
-2020-06-17,81.3853,180.2377,291.2617
-2020-06-18,82.055,181.1,291.2773
-2020-06-19,82.6484,181.9166,290.8773
-2020-06-22,83.1322,182.5852,290.1622
-2020-06-23,83.6789,183.4367,289.7048
-2020-06-24,84.2478,184.3973,289.3212
-2020-06-25,84.8319,185.4755,289.0361
-2020-06-26,85.3087,186.4352,288.5594
-2020-06-29,85.7481,187.3522,288.1091
-2020-06-30,86.1677,188.2577,287.7948
-2020-07-01,86.6202,189.2262,287.6647
-2020-07-02,87.0695,190.2242,287.6598
-2020-07-06,87.4303,191.1195,287.5419
-2020-07-07,87.7581,192.0194,287.5477
-2020-07-08,88.0656,192.9353,287.6584
-2020-07-09,88.4778,194.0795,288.1466
-2020-07-10,88.9345,195.3892,288.9116
-2020-07-13,89.4066,196.6445,289.8009
-2020-07-14,89.9156,197.8112,290.7856
-2020-07-15,90.5067,
```

#### Recent Merged Pull Requests:
- **PR #257** (2026-10-04): fix: currency validation in format_portfolio_dataset only checks max string length (@heykav)
- **PR #256** (2026-10-02): Use the FINANCIAL_MODELING_PREP_KEY placeholder everywhere (@JerBouma)
- **PR #255** (2026-10-02): Make the README Discovery example a stock screen (@JerBouma)
- **PR #254** (2026-10-02): Add Econometrics and Discovery charts to the README (@JerBouma)
- **PR #253** (2026-10-02): Replace the README example graphs with the website charts (@JerBouma)
- **PR #252** (2026-10-02): Stop ending sentences directly after bare URLs (@JerBouma)
- **PR #251** (2026-10-01): Document the daily period default on 31 Econometrics methods (@JerBouma)
- **PR #250** (closed): Bump jupyterlab from 4.6.3 to 4.6.4 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
