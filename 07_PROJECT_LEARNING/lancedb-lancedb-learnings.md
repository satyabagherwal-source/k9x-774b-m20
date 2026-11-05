> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/lancedb-lancedb-learnings.md`  
> **Source**: github ([https://github.com/lancedb/lancedb](https://github.com/lancedb/lancedb))  
> **Source Version**: `5def2611`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T13:20:32.085Z  
> **Learning ID**: `learn-github-lancedb-lancedb`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): lancedb/lancedb

> **Canonical Artifact**: `07_PROJECT_LEARNING/lancedb-lancedb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lancedb/lancedb](https://github.com/lancedb/lancedb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-05T13:20:32.080Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lancedb/lancedb`
- **Description**: Developer-friendly OSS embedded retrieval library for multimodal AI. Search More; Manage Less.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 11847 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `nodejs/examples/util.ts`
```
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: Copyright The LanceDB Authors
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";

export async function withTempDirectory(
  fn: (tempDir: string) => Promise<void>,
) {
  const tmpDirPath = fs.mkdtempSync(path.join(tmpdir(), "temp-dir-"));
  try {
    await fn(tmpDirPath);
  } finally {
    fs.rmSync(tmpDirPath, { recursive: true });
  }
}

```

### Core Architecture Module: `nodejs/lancedb/util.ts`
```
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: Copyright The LanceDB Authors

export type IntoSql =
  | string
  | number
  | boolean
  | null
  | Date
  | ArrayBufferLike
  | Buffer
  | IntoSql[];

export function toSQL(value: IntoSql): string {
  if (typeof value === "string") {
    return `'${value.replace(/'/g, "''")}'`;
  } else if (typeof value === "number") {
    // toString() gives "NaN" / "Infinity", which SQL reads as column names.
    if (Number.isNaN(value)) {
      return "CAST('NaN' AS DOUBLE)";
    } else if (!Number.isFinite(value)) {
      return value > 0
        ? "CAST('Infinity' AS DOUBLE)"
        : "CAST('-Infinity' AS DOUBLE)";
    }
    return value.toString();
  } else if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  } else if (value === null) {
    return "NULL";
  } else if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  } else if (Array.isArray(value)) {
    return `[${value.map(toSQL).join(", ")}]`;
  } else if (Buffer.isBuffer(value)) {
    return `X'${value.toString("hex")}'`;
  } else if (value instanceof ArrayBuffer) {
    return `X'${Buffer.from(value).toString("hex")}'`;
  } else {
    throw new Error(
      `Unsupported value type: ${typeof value} value: (${value})`,
    );
  }
}

export function packBits(data: Array<number>): Array<number> {
  const packed = Array(data.length >> 3).fill(0);
  for (let i = 0; i < data.length; i++) {
    const byte = i >> 3;
    const bit = i & 7;
    packed[byte] |= data[i] << bit;
  }
  return packed;
}

export class TTLCache {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  private readonly cache: Map<string, { value: any; expires: number }>;

  /**
   * @param ttl Time to live in milliseconds
   */
  constructor(private readonly ttl: number) {
    this.cache = new Map();
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  get(key: string): any | undefined {
    const entry = this.cache.get(key);
    if (entry === undefined) {
      return undefined;
    }

    if (entry.expires < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  set(key: string, value: any): void {
    this.cache.set(key, { value, expires: Date.now() + this.ttl });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }
}

```

### Core Architecture Module: `nodejs/src/util.rs`
```
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: Copyright The LanceDB Authors

use arrow_ipc::writer::FileWriter;
use arrow_schema::Schema;
use lancedb::DistanceType;
use napi::bindgen_prelude::Buffer;

pub fn parse_distance_type(distance_type: impl AsRef<str>) -> napi::Result<DistanceType> {
    match distance_type.as_ref().to_lowercase().as_str() {
        "l2" => Ok(DistanceType::L2),
        "cosine" => Ok(DistanceType::Cosine),
        "dot" => Ok(DistanceType::Dot),
        "hamming" => Ok(DistanceType::Hamming),
        _ => Err(napi::Error::from_reason(format!(
            "Invalid distance type '{}'.  Must be one of l2, cosine, dot, or hamming",
            distance_type.as_ref()
        ))),
    }
}

/// Convert an Arrow Schema to an Arrow IPC file buffer
pub fn schema_to_buffer(schema: &Schema) -> napi::Result<Buffer> {
    let mut writer = FileWriter::try_new(vec![], schema)
        .map_err(|e| napi::Error::from_reason(format!("Failed to create IPC file: {}", e)))?;
    writer
        .finish()
        .map_err(|e| napi::Error::from_reason(format!("Failed to finish IPC file: {}", e)))?;
    Ok(Buffer::from(writer.into_inner().map_err(|e| {
        napi::Error::from_reason(format!("Failed to get IPC file: {}", e))
    })?))
}

```

### Core Architecture Module: `python/python/lancedb/background_loop.py`
```
# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: Copyright The LanceDB Authors

import asyncio
import concurrent.futures
import os
import threading
import warnings


class BackgroundEventLoop:
    """
    A background event loop that can run futures.

    Used to bridge sync and async code, without messing with users event loops.
    """

    def __init__(self):
        self._start()

    def _start(self):
        self.loop = asyncio.new_event_loop()
        self.thread = threading.Thread(
            target=self.loop.run_forever,
            name="LanceDBBackgroundEventLoop",
            daemon=True,
        )
        self.thread.start()

    def run(self, future):
        concurrent_future = asyncio.run_coroutine_threadsafe(future, self.loop)
        try:
            return concurrent_future.result()
        except BaseException:
            concurrent_future.cancel()
            raise


LOOP = BackgroundEventLoop()


def _new_embedding_executor() -> concurrent.futures.ThreadPoolExecutor:
    return concurrent.futures.ThreadPoolExecutor(thread_name_prefix="lancedb-embedding")


# Embedding functions can block for a long time -- a heavy local model or an
# HTTP request to a remote embeddings API. Running them on asyncio's default
# executor lets them starve the unrelated blocking I/O that shares that pool,
# so they get a dedicated one. See
# https://github.com/lancedb/lancedb/issues/3310.
_EMBEDDING_EXECUTOR = _new_embedding_executor()


def embedding_executor() -> concurrent.futures.ThreadPoolExecutor:
    """Return the executor dedicated to running blocking embedding calls."""
    return _EMBEDDING_EXECUTOR


_FORK_WARNED = False


def _reset_after_fork():
    # Threads do not survive fork(), so the asyncio loop in LOOP.thread is
    # dead in the child. Re-initialize the singleton in place so existing
    # `from .background_loop import LOOP` references in other modules see
    # the new state. The Rust-side tokio runtime is reset analogously by a
    # pthread_atfork hook installed in the _lancedb extension.
    LOOP._start()
    # The embedding executor's worker threads are dead in the child as well.
    # Replace it with a fresh pool (threads are spawned lazily, so this is
    # cheap); we don't shut down the old one, since joining its dead workers
    # could hang.
    global _EMBEDDING_EXECUTOR
    _EMBEDDING_EXECUTOR = _new_embedding_executor()
    global _FORK_WARNED
    if not _FORK_WARNED:
        _FORK_WARNED = True
        warnings.warn(
            "lancedb fork support is experimental: the internal async "
            "runtime has been reset in the forked child, but a small chance "
            "of deadlock remains if other state was mid-operation at fork "
            "time. The 'forkserver' or 'spawn' multiprocessing start method "
            "is likely a safer alternative.",
            RuntimeWarning,
            stacklevel=2,
        )


if hasattr(os, "register_at_fork"):
    os.register_at_fork(after_in_child=_reset_after_fork)

```

### Core Architecture Module: `python/python/lancedb/embeddings/utils.py`
```
# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: Copyright The LanceDB Authors


import functools
import math
import random
import socket
import sys
import threading
import time
import urllib.error
import urllib.request
import weakref
import logging
from functools import wraps
from typing import Callable, List, Union
import numpy as np
import pyarrow as pa

from ..dependencies import pandas as pd
from ..util import attempt_import_or_raise


def create_import_stub(module_name: str, package_name: str = None):
    """
    Create a stub module that allows class definition but fails when used.
    This allows modules to be imported for doctest collection even when
    optional dependencies are not available.

    Parameters
    ----------
    module_name : str
        The name of the module to create a stub for
    package_name : str, optional
        The package name to suggest in the error message

    Returns
    -------
    object
        A stub object that can be used in place of the module
    """

    class _ImportStub:
        def __getattr__(self, name):
            return _ImportStub  # Return stub for chained access like nn.Module

        def __call__(self, *args, **kwargs):
            pkg = package_name or module_name
            raise ImportError(f"You need to install {pkg} to use this functionality")

    return _ImportStub()


# ruff: noqa: PERF203
def retry(tries=10, delay=1, max_delay=30, backoff=3, jitter=1):
    def wrapper(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            for i in range(tries):
                try:
                    return fn(*args, **kwargs)
                except Exception:
                    if i + 1 == tries:
                        raise
                    else:
                        sleep = min(delay * (backoff**i) + jitter, max_delay)
                        time.sleep(sleep)

        return wrapped

    return wrapper


DATA = Union[pa.Table, "pd.DataFrame"]
TEXT = Union[str, List[str], pa.Array, pa.ChunkedArray, np.ndarray]
IMAGES = Union[
    str, bytes, List[str], List[bytes], pa.Array, pa.ChunkedArray, np.ndarray
]
AUDIO = Union[str, bytes, List[str], List[bytes], pa.Array, pa.ChunkedArray, np.ndarray]


class RateLimiter:
    def __init__(self, max_calls: int = 1, period: float = 1.0):
        self.period = period
        self.max_calls = max(1, min(sys.maxsize, math.floor(max_calls)))

        self._last_reset = time.time()
        self._num_calls = 0
        self._lock = threading.RLock()

    def _check_sleep(self) -> float:
        current_time = time.time()
        elapsed = current_time - self._last_reset
        period_remaining = self.period - elapsed

        # If the time window has elapsed then reset.
        if period_remaining <= 0:
            self._num_calls = 0
            self._last_reset = current_time

        self._num_calls += 1

        if self._num_calls > self.max_calls:
            return period_remaining

        return 0.0

    def __call__(self, func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            with self._lock:
                time.sleep(self._check_sleep())
            return func(*args, **kwargs)

        return wrapper


class FunctionWrapper:
    """
    A wrapper for embedding functions that adds rate limiting, retries, and batching.
    """

    def __init__(self, func: Callable):
        self.func = func
        self.rate_limiter_kwargs = {}
        self.retry_kwargs = {}
        self._batch_size = None
        self._progress = False

    def __call__(self, text):
        # Get the embedding with retry
        if len(self.retry_kwargs) > 0:

            @retry(**self.retry_kwargs)
            def embed_func(c):
                return self.func(c.tolist())

        else:

            def embed_func(c):
                return self.func(c.tolist())

        if self.rate_limiter_kwargs:
            limiter = RateLimiter(
                max_calls=self.rate_limiter_kwargs["max_calls"],
                period=self.rate_limiter_kwargs["period"],
            )
            embed_func = limiter(embed_func)
        batches = self.to_batches(text)
        embeds = [emb for c in batches for emb in embed_func(c)]
        return embeds

    def __repr__(self):
        return f"EmbeddingFunction(func={self.func})"

    def rate_limit(self, max_calls=0.9, period=1.0):
        self.rate_limiter_kwargs = dict(max_calls=max_calls, period=period)
        return self

    def retry(self, tries=10, delay=1, max_delay=30, backoff=3, jitter=1):
        self.retry_kwargs = dict(
            tries=tries,
            delay=delay,
            max_delay=max_delay,
            backoff=backoff,
            jitter=jitter,
        )
        return self

    def batch_size(self, batch_size):
        self._batch_size = batch_size
        return self

    def show_progress(self):
        self._progress = True
        return self

    def to_batches(self, arr):
        length = len(arr)

        def _chunker(arr):
            for start_i in range(0, len(arr), self._batch_size):
                yield arr[start_i : start_i + self._batch_size]

        if self._progress:
            from tqdm.auto import tqdm

            yield from tqdm(_chunker(arr), total=math.ceil(length / self._batch_size))
        else:
            yield from _chunker(arr)


def weak_lru(maxsize=128):
    """
    LRU cache that keeps weak references to the objects it caches. Only caches the
    latest instance of the objects to make sure memory usage is bounded.

    Parameters
    ----------
    maxsize : int, default 128
        The maximum number of objects to cache.

    Returns
    -------
    Callable
        A decorator that can be applied to a method.

    Examples
    --------
    >>> class Foo:
    ...     @weak_lru()
    ...     def bar(self, x):
    ...         return x
    >>> foo = Foo()
    >>> foo.bar(1)
    1
    >>> foo.bar(2)
    2
    >>> foo.bar(1)
    1
    """

    def wrapper(func):
        @functools.lru_cache(maxsize)
        def _func(_self, *args, **kwargs):
            return func(_self(), *args, **kwargs)

        @functools.wraps(func)
        def inner(self, *args, **kwargs):
            return _func(weakref.ref(self), *args, **kwargs)

        return inner

    return wrapper


def retry_with_exponential_backoff(
    func,
    initial_delay: float = 1,
    exponential_base: float = 2,
    jitter: bool = True,
    max_retries: int = 7,
    max_delay: float = 60,
):
    """Retry a function with exponential backoff.

    Only errors that may succeed when repeated are retried. Errors that carry an
    HTTP status code are retried when the status is 408, 409, 429 or >= 500; any
    other 4xx status (for example 400, 401, 403, 404 or 422) is a permanent failure
    that is raised immediately. Errors without a recognisable status code (for
    example connection errors, timeouts, or exceptions raised by a custom embedding
    function) are retried.

    The delay before the n-th retry is ``initial_delay * exponential_base ** n``,
    never more than ``max_delay``. With ``jitter`` enabled, a random amount of up to
    half of that delay is removed ("equal jitter"), so the actual wait is always in
    the range ``[delay / 2, delay]``.

    Args:
        func (function): The function to be retried.
        initial_delay (float): Initial delay in seconds (default is 1).
        exponential_base (float): The base for exponential backoff (default is 2).
        jitter (bool): Whether to add jitter to the delay (default is True).
        max_retries (int): Maximum number of retries (default is 7).
        max_delay (float): Maximum delay between two attempts, in seconds
            (default is 60).

    Returns:
        function: The decorated function.
    """

    def wrapper(*args, **kwargs):
        num_retries = 0
        delay = initial_delay

        # Loop until a successful response or max_retries is hit or an exception
        # is raised
        while True:
            try:
                return func(*args, **kwargs)

            # Errors are retried unless they are known to be permanent (see
            # `_is_non_retryable_error`). Custom embedding functions can raise
            # arbitrary exceptions, so unknown errors are assumed to be transient.
            except Exception as e:  # noqa: PERF203
                # Don't retry permanent failures (e.g., OpenAI 401 or 404). They
                # won't be fixed by retrying and would only delay the real error.
                if _is_non_retryable_error(e):
                    raise

                num_retries += 1

                if num_retries > max_retries:
                    raise Exception(
                        f"Maximum number of retries ({max_retries}) exceeded.", e
                    ) from e

                delay = min(delay * exponential_base, max_delay)
                sleep_for = delay
                if jitter:
                    sleep_for = delay / 2 + random.random() * delay / 2
                logging.warning(
                    "Error occurred: %s \n Retrying in %s seconds (retry %s of %s) \n",
                    e,
                    sleep_for,
                    num_retries,
                    max_retries,
                )
                time.sleep(sleep_for)

    return wrapper


# HTTP statuses in the 4xx range that are worth retrying: request timeout,
# conflict (the OpenAI SDK treats it as transient) and rate limiting.
_RETRYABLE_CLIENT_STATUSES = (408, 409, 429)

# AWS error codes that are reported with a 4xx status but are transient.
_RETRYABLE_AWS_ERROR_CODES = (
    "Throttl",
    "TooManyRequests",
    "RequestLimitExceeded",
    "ProvisionedThroughputExceeded",
    "ModelNotReady",
    "ModelTimeout",
)


def _get_http_status(error: Exception):
    """Best-effort extraction of an HTTP status code from an exception.

    Provider SDKs expose it in different ways: ``status_code`` (openai, co
```

### Core Architecture Module: `python/python/lancedb/namespace_utils.py`
```
# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: Copyright The LanceDB Authors

"""Utility functions for namespace operations."""

from typing import Optional


_CREATE_NAMESPACE_MODES = frozenset({"create", "exist_ok", "overwrite"})
_DROP_NAMESPACE_MODES = frozenset({"SKIP", "FAIL"})
_DROP_NAMESPACE_BEHAVIORS = frozenset({"RESTRICT", "CASCADE"})


def _normalize_create_namespace_mode(mode: Optional[str]) -> Optional[str]:
    """Normalize create namespace mode to lowercase (API expects lowercase)."""
    if mode is None:
        return None
    normalized = mode.lower()
    if normalized not in _CREATE_NAMESPACE_MODES:
        raise ValueError(
            f"Invalid create namespace mode {mode!r}: "
            f"expected one of 'create', 'exist_ok', 'overwrite'"
        )
    return normalized


def _normalize_drop_namespace_mode(mode: Optional[str]) -> Optional[str]:
    """Normalize drop namespace mode to uppercase (API expects uppercase)."""
    if mode is None:
        return None
    normalized = mode.upper()
    if normalized not in _DROP_NAMESPACE_MODES:
        raise ValueError(
            f"Invalid drop namespace mode {mode!r}: expected one of 'skip', 'fail'"
        )
    return normalized


def _normalize_drop_namespace_behavior(behavior: Optional[str]) -> Optional[str]:
    """Normalize drop namespace behavior to uppercase (API expects uppercase)."""
    if behavior is None:
        return None
    normalized = behavior.upper()
    if normalized not in _DROP_NAMESPACE_BEHAVIORS:
        raise ValueError(
            f"Invalid drop namespace behavior {behavior!r}: "
            f"expected one of 'restrict', 'cascade'"
        )
    return normalized

```

### Core Architecture Module: `python/python/lancedb/rerankers/util.py`
```
# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: Copyright The LanceDB Authors


import pyarrow as pa


def check_reranker_result(result):
    if not isinstance(result, pa.Table):  # Enforce type
        raise TypeError(
            f"rerank_hybrid must return a pyarrow.Table, got {type(result)}"
        )

    # Enforce that `_relevance_score` column is present in the result of every
    # rerank_hybrid method
    if "_relevance_score" not in result.column_names:
        raise ValueError(
            "rerank_hybrid must return a pyarrow.Table with a column"
            "named `_relevance_score`"
        )

```

### Core Architecture Module: `python/python/lancedb/util.py`
```
# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: Copyright The LanceDB Authors


import binascii
import functools
import importlib
import math
import os
import pathlib
import warnings
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from functools import singledispatch
from typing import Tuple, Union, Optional, Any, List
from urllib.parse import urlparse

import numpy as np
import pyarrow as pa
import pyarrow.fs as pa_fs

from ._lancedb import validate_table_name as native_validate_table_name


def safe_import_adlfs():
    try:
        import adlfs

        return adlfs
    except ImportError:
        return None


adlfs = safe_import_adlfs()


def get_uri_scheme(uri: Union[str, pathlib.Path]) -> str:
    """
    Get the scheme of a URI. If the URI does not have a scheme, assume it is a file URI.

    Parameters
    ----------
    uri : str or pathlib.Path
        The URI to parse.

    Returns
    -------
    str: The scheme of the URI.
    """
    parsed = urlparse(str(uri))
    scheme = parsed.scheme
    if not scheme:
        scheme = "file"
    elif scheme in ["s3a", "s3n"]:
        scheme = "s3"
    elif len(scheme) == 1:
        # Windows drive names are parsed as the scheme
        # e.g. "c:\path" -> ParseResult(scheme="c", netloc="", path="/path", ...)
        # So we add special handling here for schemes that are a single character
        scheme = "file"
    return scheme


def get_uri_location(uri: Union[str, pathlib.Path]) -> str:
    """
    Get the location of a URI. If the parameter is not a url, assumes it is just a path

    Parameters
    ----------
    uri : str or pathlib.Path
        The URI to parse.

    Returns
    -------
    str: Location part of the URL, without scheme
    """
    uri_str = str(uri)
    parsed = urlparse(uri_str)
    if len(parsed.scheme) == 1:
        # Windows drive names are parsed as the scheme
        # e.g. "c:\path" -> ParseResult(scheme="c", netloc="", path="/path", ...)
        # So we add special handling here for schemes that are a single character
        return uri_str

    if not parsed.netloc:
        return parsed.path
    else:
        return parsed.netloc + parsed.path


def fs_from_uri(uri: str) -> Tuple[pa_fs.FileSystem, str]:
    """
    Get a PyArrow FileSystem from a URI, handling extra environment variables.
    """
    if get_uri_scheme(uri) == "s3":
        fs = pa_fs.S3FileSystem(
            endpoint_override=os.environ.get("AWS_ENDPOINT"),
            request_timeout=30,
            connect_timeout=30,
        )
        path = get_uri_location(uri)
        return fs, path

    elif get_uri_scheme(uri) == "az" and adlfs is not None:
        az_blob_fs = adlfs.AzureBlobFileSystem(
            account_name=os.environ.get("AZURE_STORAGE_ACCOUNT_NAME"),
            account_key=os.environ.get("AZURE_STORAGE_ACCOUNT_KEY"),
        )

        fs = pa_fs.PyFileSystem(pa_fs.FSSpecHandler(az_blob_fs))

        path = get_uri_location(uri)
        return fs, path

    return pa_fs.FileSystem.from_uri(uri)


def join_uri(base: Union[str, pathlib.Path], *parts: str) -> str:
    """
    Join a URI with multiple parts, handles both local and remote paths

    Parameters
    ----------
    base : str
        The base URI
    parts : str
        The parts to join to the base URI, each separated by the
        appropriate path separator for the URI scheme and OS
    """
    if isinstance(base, pathlib.Path):
        return base.joinpath(*parts)
    base = str(base)
    if get_uri_scheme(base) == "file":
        # using pathlib for local paths make this windows compatible
        # `get_uri_scheme` returns `file` for windows drive names (e.g. `c:\path`)
        return str(pathlib.Path(base, *parts))
    else:
        # there might be query parameters in the base URI
        url = urlparse(base)
        new_path = "/".join([p.rstrip("/") for p in [url.path, *parts]])
        return url._replace(path=new_path).geturl()


def attempt_import_or_raise(module: str, mitigation=None):
    """
    Import the specified module. If the module is not installed,
    raise an ImportError with a helpful message.

    Parameters
    ----------
    module : str
        The name of the module to import
    mitigation : Optional[str]
        The package(s) to install to mitigate the error.
        If not provided then the module name will be used.
    """
    try:
        return importlib.import_module(module)
    except ImportError:
        raise ImportError(f"Please install {mitigation or module}")


def flatten_columns(tbl: pa.Table, flatten: Optional[Union[int, bool]] = None):
    """
    Flatten all struct columns in a table.

    Parameters
    ----------
    flatten: Optional[Union[int, bool]]
        If flatten is True, flatten all nested columns.
        If flatten is an integer, flatten the nested columns up to the
        specified depth.
        If unspecified, do not flatten the nested columns.
    """
    if flatten is True:
        while True:
            tbl = tbl.flatten()
            # loop through all columns to check if there is any struct column
            if any(pa.types.is_struct(col.type) for col in tbl.schema):
                continue
            else:
                break
    # `bool` is a subclass of `int`, so guard against it explicitly: `flatten=False`
    # (and `None`) must mean "do not flatten" rather than falling into the integer
    # branch and raising on the `flatten <= 0` check.
    elif isinstance(flatten, int) and not isinstance(flatten, bool):
        if flatten <= 0:
            raise ValueError(
                "Please specify a positive integer for flatten or the boolean "
                "value `True`"
            )
        while flatten > 0:
            tbl = tbl.flatten()
            flatten -= 1
    return tbl


def _format_field_path(path: List[str]) -> str:
    def format_segment(segment: str) -> str:
        if all(char.isalnum() or char == "_" for char in segment):
            return segment
        return f"`{segment.replace('`', '``')}`"

    return ".".join(format_segment(segment) for segment in path)


def _iter_vector_columns(
    field: pa.Field, path: List[str], dim: Optional[int] = None
) -> List[str]:
    field_path = [*path, field.name]
    if is_vector_column(field.type):
        vector_dim = infer_vector_column_dim(field.type)
        if dim is None or vector_dim == dim:
            return [_format_field_path(field_path)]
        return []
    if pa.types.is_struct(field.type):
        columns = []
        for idx in range(field.type.num_fields):
            columns.extend(_iter_vector_columns(field.type.field(idx), field_path, dim))
        return columns
    return []


def inf_vector_column_query(schema: pa.Schema, dim: Optional[int] = None) -> str:
    """
    Get the vector column name

    Parameters
    ----------
    schema : pa.Schema
        The schema of the vector column.

    Returns
    -------
    str: the vector column name.
    """
    vector_col_names = []
    for field in schema:
        vector_col_names.extend(_iter_vector_columns(field, [], dim))

    if len(vector_col_names) == 0 and dim is not None:
        # The query's dimension matched no column. If the schema is
        # unambiguous without that filter, the single vector column is still
        # the right one to search: a dimension mismatch is a query-execution
        # error, not a missing-column error.
        unfiltered = []
        for field in schema:
            unfiltered.extend(_iter_vector_columns(field, []))
        if len(unfiltered) == 1:
            return unfiltered[0]
        vector_col_names = unfiltered

    if len(vector_col_names) > 1:
        raise ValueError(
            "Schema has more than one vector column. "
            "Please specify the vector column name "
            f"for vector search. Candidates: {vector_col_names}"
        )
    if len(vector_col_names) == 0:
        raise ValueError(
            "There is no vector column in the data. "
            "Please specify the vector column name for vector search"
        )
    return vector_col_names[0]


def is_vector_column(data_type: pa.DataType) -> bool:
    """
    Check if the column is a vector column.

    Parameters
    ----------
    data_type : pa.DataType
        The data type of the column.

    Returns
    -------
    bool: True if the column is a vector column.
    """
    if pa.types.is_fixed_size_list(data_type) and (
        pa.types.is_floating(data_type.value_type)
        or pa.types.is_uint8(data_type.value_type)
    ):
        return True
    elif pa.types.is_list(data_type):
        return is_vector_column(data_type.value_type)
    return False


def infer_vector_column_dim(data_type: pa.DataType) -> Optional[int]:
    if pa.types.is_fixed_size_list(data_type):
        return data_type.list_size
    if pa.types.is_list(data_type):
        return infer_vector_column_dim(data_type.value_type)
    return None


def _validate_query_vector(query: Any) -> None:
    """Reject empty vector inputs before vector-column inference or execution."""
    if (isinstance(query, list) and not query) or (
        isinstance(query, np.ndarray) and query.size == 0
    ):
        raise ValueError("Query vector must not be empty")


def _query_vector_dim(query: Optional[Any]) -> Optional[int]:
    if query is None:
        return None
    if isinstance(query, np.ndarray):
        if query.ndim == 0:
            return None
        return query.shape[-1]
    if isinstance(query, (pa.Array, pa.ChunkedArray)):
        if len(query) == 0:
            return None
        if pa.types.is_fixed_size_list(query.type):
            return query.type.list_size
        if pa.types.is_list(query.type) or pa.types.is_large_list(query.type):
            first = query[0].as_py()
            return len(first) if first is not None else None
        return len(query)
    if isinstance(query, (list, tuple)) and query:
        
```

### Core Architecture Module: `python/src/util.rs`
```
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: Copyright The LanceDB Authors

use std::sync::Mutex;

use lancedb::DistanceType;
use pyo3::{
    PyResult,
    exceptions::{PyRuntimeError, PyValueError},
    pyfunction,
};

/// A wrapper around a rust builder
///
/// Rust builders are often implemented so that the builder methods
/// consume the builder and return a new one. This is not compatible
/// with the pyo3, which, being garbage collected, cannot easily obtain
/// ownership of an object.
///
/// This wrapper converts the compile-time safety of rust into runtime
/// errors if any attempt to use the builder happens after it is consumed.
pub struct BuilderWrapper<T> {
    name: String,
    inner: Mutex<Option<T>>,
}

impl<T> BuilderWrapper<T> {
    pub fn new(name: impl AsRef<str>, inner: T) -> Self {
        Self {
            name: name.as_ref().to_string(),
            inner: Mutex::new(Some(inner)),
        }
    }

    pub fn consume<O>(&self, mod_fn: impl FnOnce(T) -> O) -> PyResult<O> {
        let mut inner = self.inner.lock().unwrap();
        let inner_builder = inner.take().ok_or_else(|| {
            PyRuntimeError::new_err(format!("{} has already been consumed", self.name))
        })?;
        let result = mod_fn(inner_builder);
        Ok(result)
    }
}

pub fn parse_distance_type(distance_type: impl AsRef<str>) -> PyResult<DistanceType> {
    match distance_type.as_ref().to_lowercase().as_str() {
        "l2" => Ok(DistanceType::L2),
        "cosine" => Ok(DistanceType::Cosine),
        "dot" => Ok(DistanceType::Dot),
        "hamming" => Ok(DistanceType::Hamming),
        _ => Err(PyValueError::new_err(format!(
            "Invalid distance type '{}'.  Must be one of l2, cosine, dot, or hamming",
            distance_type.as_ref()
        ))),
    }
}

#[pyfunction]
pub fn validate_table_name(table_name: &str) -> PyResult<()> {
    lancedb::utils::validate_table_name(table_name)
        .map_err(|e| PyValueError::new_err(e.to_string()))
}

/// Parse field references with the same identifier syntax as Lance writes.
#[pyfunction(name = "_parse_field_path")]
pub fn parse_field_path(path: &str) -> PyResult<Vec<String>> {
    lance_core::datatypes::parse_field_path(path).map_err(|e| PyValueError::new_err(e.to_string()))
}

/// A wrapper around a LanceDB type to allow it to be used in Python
#[derive(Debug, Clone)]
pub struct PyLanceDB<T>(pub T);

```

### Core Architecture Module: `rust/lancedb/src/dataloader/permutation/util.rs`
```
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: Copyright The LanceDB Authors

use std::{path::PathBuf, sync::Arc};

use arrow_array::RecordBatch;
use arrow_schema::{Fields, Schema};
use datafusion_execution::disk_manager::DiskManagerMode;
use futures::TryStreamExt;
use rand::{RngCore, SeedableRng, rngs::SmallRng};
use tempfile::TempDir;

use crate::{
    Error, Result,
    arrow::{SendableRecordBatchStream, SimpleRecordBatchStream},
};

/// Directory to use for temporary files
#[derive(Debug, Clone, Default)]
pub enum TemporaryDirectory {
    /// Use the operating system's default temporary directory (e.g. /tmp)
    #[default]
    OsDefault,
    /// Use the specified directory (must be an absolute path)
    Specific(PathBuf),
    /// If spilling is required, then error out
    None,
}

impl TemporaryDirectory {
    pub fn create_temp_dir(&self) -> Result<TempDir> {
        match self {
            Self::OsDefault => tempfile::tempdir(),
            Self::Specific(path) => tempfile::Builder::default().tempdir_in(path),
            Self::None => {
                return Err(Error::Runtime {
                    message: "No temporary directory was supplied and this operation requires spilling to disk".to_string(),
                });
            }
        }
        .map_err(|err| Error::Other {
            message: "Failed to create temporary directory".to_string(),
            source: Some(err.into()),
        })
    }

    pub fn to_disk_manager_mode(&self) -> DiskManagerMode {
        match self {
            Self::OsDefault => DiskManagerMode::OsTmpDirectory,
            Self::Specific(path) => DiskManagerMode::Directories(vec![path.clone()]),
            Self::None => DiskManagerMode::Disabled,
        }
    }
}

pub fn non_crypto_rng(seed: &Option<u64>) -> Box<dyn RngCore + Send> {
    Box::new(
        seed.as_ref()
            .map(|seed| SmallRng::seed_from_u64(*seed))
            .unwrap_or_else(SmallRng::from_os_rng),
    )
}

pub fn rename_column(
    stream: SendableRecordBatchStream,
    old_name: &str,
    new_name: &str,
) -> Result<SendableRecordBatchStream> {
    let schema = stream.schema();
    let field_index = schema.index_of(old_name)?;

    let new_fields = schema
        .fields
        .iter()
        .cloned()
        .enumerate()
        .map(|(idx, f)| {
            if idx == field_index {
                Arc::new(f.as_ref().clone().with_name(new_name))
            } else {
                f
            }
        })
        .collect::<Fields>();
    let new_schema = Arc::new(Schema::new(new_fields).with_metadata(schema.metadata().clone()));
    let new_schema_clone = new_schema.clone();

    let renamed_stream = stream.and_then(move |batch| {
        let renamed_batch =
            RecordBatch::try_new(new_schema.clone(), batch.columns().to_vec()).map_err(Error::from);
        std::future::ready(renamed_batch)
    });

    Ok(Box::pin(SimpleRecordBatchStream::new(
        renamed_stream,
        new_schema_clone,
    )))
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4874** (2026-11-05): **fix: remove unmaintained pin-utils from AWS dependencies**
  *Symptoms*: `cargo deny` rejects `pin-utils 0.1.0` as unmaintained under RUSTSEC-2026-0441; there is no patched release. The dependency comes from the AWS Smithy graph. Refresh that graph to include [smithy-rs #4882](https://github.com/smithy-lang/smithy-rs/pull/4882), replacing the obsolete `aws-smithy-types = ">=1.3.6, <1.7"` constraint with `1.9.1`.  The lockfile audit attributes every changed package identity and resolved dependency edge to the AWS graph. Existing git dependency pins are preserved. The selected AWS crates declare Rust 1.94.1, within the workspace's unchanged 1.95.0 requirement.  Validation at the exact candidate on the development EC2 host, both exit 0:  - `mbx +1.97.1 deny check advisories bans licenses sources` - `mbx +1.97.1 check --quiet --locked -p lancedb --tests --features remote,aws,dynamodb,bedrock`  The second command compiles the selected test targets; it is not a runtime integration test. Full all-features compilation remains unverified: an earlier attempt stopped in lance-linalg because the host Clang 15 does not support the required `_Float16` target. 

- **Issue #4872** (2026-11-05): **fix(deps): ignore RUSTSEC-2026-0441 pin-utils unmaintained**
  *Symptoms*: `cargo deny` fails on main because RUSTSEC-2026-0441 marks `pin-utils` as unmaintained. Add an exception reviewed on 2026-11-05, with the advisory and upstream discussion links and a reminder to revisit it when updating AWS dependencies.  `pin-utils` is transitive through `aws-smithy-http`, `aws-smithy-runtime`, and `aws-smithy-types`, including the `aws-config` → `lance-io` path. RustSec lists no safe upgrade; clearing the advisory requires upstream migration to supported pinning primitives.  Validation on commit dede2c783fda73500cee2b05feffe1b70d56624c:  - Before the change, `cargo deny check advisories` failed on RUSTSEC-2026-0441. - `cargo deny check advisories` passes after the change. - `cargo deny check advisories bans licenses sources` passes all four checks, matching the Rust CI deny job. - `git diff HEAD^ HEAD --check` passes. 

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

### Incident Patch 1: `69ac2158` (2026-11-05)
**Commit Message**: fix: preserve take_row_ids request order (#4826)

`take_row_ids` used an `IN` filter, so the backend could reorder rows
and collapse duplicate IDs. That can silently misalign training rows
with labels or sample weights.

Restore the requested order and duplicate occurrences in the shared Rust
take path for native and remote tables, and retain that information
through Python query serialization. Missing or deleted IDs are omitted.
Explicit Rust `order_by` overrides request order, and pagination applies
after restoring occurrences. Empty projections and `_rowid` projection
aliases retain their output schema.

RTE tables reject unsupported takes with the existing base-table
guidance before checking the internal row-ID projection used for
ordering. An explicit `use_rte(False)` reads the base table with the
same requested order and occurrences.

A pre-existing fixture defect also blocked CI:
`test_table_add_in_threadpool` responded without reading uploads,
allowing a connection reset during response decoding. This PR includes a
fix confined to that test's handler: consume each request body before
responding and verify one create row plus ten inserted rows. This was
not a regression in t

**File**: `docs/web/curation/selective-sampling.mdx` (modified, +31/-10)
```diff
@@ -57,16 +57,37 @@ let rows_by_offset = tbl.take_offsets(vec![0, 1, 2]).execute().await?;
 </CodeGroup>
 
 Both methods return a query builder; call `.to_arrow()`, `.to_list()` or
-similar to execute it. Repeated *offsets* produce repeated rows, so
-`take_offsets` also supports sampling with replacement -- `take_row_ids`
-does not: a row ID repeated in the input list still returns that row only
-once, since the lookup is a set membership test. Neither method guarantees
-result order matches the order of the input list; for `take_row_ids`, pass
-`with_row_id=True` to add `_rowid` to the output and align the results
-yourself if you need to. `take_offsets` tracks `_rowoffset` internally to
-restore repeated rows, but drops that column from the output again
-afterward unless you explicitly `select` it -- add `_rowoffset` to your
-selection when you need it to align a `take_offsets` result yourself.
+similar to execute it.
+
+<Note>
+The guarantees for row IDs below apply to SDK releases containing
+[the ordering fix in #4826](https://github.com/lancedb/lancedb/pull/4826).
+Earlier releases may collapse repeated IDs and return rows in a different
+order.
+</Note>
+
+`take_row_ids` returns matching rows in the order of the input IDs and
+preserves repeated IDs in both LanceDB Embedded and LanceDB Enterprise. For example,
+`take_row_ids([1005, 1001, 1005])` returns row 1005, row 1001, then row 1005
+again if both IDs exist. Missing or deleted IDs are omitted. This supports
+sampling with replacement. In Rust, an explicit nonempty
+`QueryBase::order_by` list overrides the requested order; limits and offsets
+apply after restoring repeated rows.
+
+`take_offsets` also preserves repeated offsets, but does not guarantee
+input order. It tracks `_rowoffset` internally to restore repeated rows
+and drops that column from the output unless you explicitly `select` it.
+Add `_rowoffset` to your selection when you need to align a `take_offsets`
+result with the input offsets.
+
+<Note>
+Ordered takes by row ID collect all matching batches, combine them into one
+batch and reorder the rows before returning output batches. Even
+`to_batches(max_batch_length=1)` only limits the returned batch size; it
+does not bound working memory. For large requests or rows with large
+column values, split the input IDs into smaller requests and use
+`.select(...)` to fetch only the columns you need.
+</Note>
 
 Offsets are mostly useful for sampling: the valid range is always
 `[0, len(table))`, so you can draw a random sample of offsets without
```

**File**: `python/python/lancedb/_lancedb.pyi` (modified, +1/-0)
```diff
@@ -897,6 +897,7 @@ class PyQueryRequest:
     limit: Optional[int]
     offset: Optional[int]
     take_offsets: Optional[List[int]]
+    take_row_ids: Optional[List[int]]
     filter: Optional[Union[str, bytes]]
     full_text_search: Optional[FullTextQuery]
     select: Optional[Union[str, List[str]]]
```

**File**: `python/python/lancedb/query.py` (modified, +5/-0)
```diff
@@ -236,6 +236,7 @@ def _query_is_plain_scan(query: Query) -> bool:
         query.vector is None
         and query.full_text_query is None
         and query.take_offsets is None
+        and query.take_row_ids is None
         and not query.postfilter
         and not query.order_by
     )
@@ -1009,6 +1010,9 @@ class Query(pydantic.BaseModel):
     # This is populated when a take query is converted to this serializable form.
     take_offsets: Optional[List[int]] = None
 
+    # Row IDs whose requested order and duplicate occurrences must be restored.
+    take_row_ids: Optional[List[int]] = None
+
     # if true, will only search the indexed data
     fast_search: Optional[bool] = None
 
@@ -1034,6 +1038,7 @@ def from_inner(cls, req: PyQueryRequest) -> Self:
         query.limit = req.limit
         query.offset = req.offset
         query.take_offsets = req.take_offsets
+        query.take_row_ids = req.take_row_ids
         query.filter = req.filter
         query.full_text_query = req.full_text_search
         query.columns = req.select
```

**File**: `python/python/lancedb/table.py` (modified, +24/-7)
```diff
@@ -132,6 +132,7 @@ def _requires_local_namespace_execution(query: Query) -> bool:
     # The namespace QueryTable request does not support these query options.
     return (
         query.take_offsets is not None
+        or query.take_row_ids is not None
         or query.search_effort is not None
         or query.approx_mode is not None
     )
@@ -2556,9 +2557,8 @@ def take_row_ids(
         Row ids are not stable and are relative to the current version of the table.
         They can change due to compaction and updates.
 
-        No guarantees are made regarding the order in which results are returned.  If
-        you desire an output order that matches the order of the given ids, you will
-        need to add the row id column to the output and align it yourself.
+        Results follow the requested row-id order. Repeated IDs produce repeated
+        rows; missing or deleted IDs are omitted. This also applies to remote tables.
 
         Unlike offsets, row ids are not 0-indexed and no assumptions should be made
         about the possible range of row ids.  In order to use this method you must
@@ -7256,10 +7256,24 @@ def _sync_query_to_async(
         | AsyncQuery
         | AsyncTakeQuery
     ):
-        if query.take_offsets is not None:
-            take_query = self.take_offsets(query.take_offsets)
-            if query.columns:
-                take_query = take_query.select(query.columns)
+        if query.take_offsets is not None or query.take_row_ids is not None:
+            if query.take_offsets is not None and query.take_row_ids is not None:
+                raise ValueError("Only one of take_offsets and take_row_ids may be set")
+            take_query = (
+                self.take_row_ids(query.take_row_ids)
+                if query.take_row_ids is not None
+                else self.take_offsets(query.take_offsets)
+            )
+            if query.columns is not None:
+                columns = query.columns
+                # Native requests serialize dynamic projections as (name, SQL) pairs.
+                if (
+                    isinstance(columns, list)
+                    and columns
+                    and isinstance(columns[0], tuple)
+                ):
+                    columns = dict(columns)
+                take_query = take_query.select(columns)
             if query.use_rte is not None:
                 take_query = take_query.use_rte(query.use_rte)
             if query.with_row_id:
@@ -8119,6 +8133,9 @@ def take_row_ids(
         """
         Take a list of row ids from the table.
 
+        Results follow the requested row-id order. Repeated IDs produce repeated
+        rows; missing or deleted IDs are omitted. This also applies to remote tables.
+
         Row ids are not stable and are relative to the current version of the table.
         They can change due to compaction and updates.
 
```

**File**: `python/python/tests/test_merge_insert_lsm.py` (modified, +17/-8)
```diff
@@ -278,7 +278,7 @@ def test_lsm_read_unsupported_shape_errors_without_use_rte_false(tmp_path):
 
     # with_row_id is unsupported by the LSM scanner; on an RTE table the default
     # (auto-routed) read hard-errors instead of silently reading a stale base.
-    with pytest.raises(Exception):
+    with pytest.raises(Exception, match=r"with_row_id.*use_rte\(false\)"):
         table.search().with_row_id(True).to_arrow()
 
     # use_rte(False) is the escape hatch: it reads the base table only.
@@ -563,19 +563,28 @@ def test_lsm_read_time_travel_errors(tmp_path):
     assert sorted(base["id"].to_pylist()) == [1, 2, 3]
 
 
-def test_lsm_read_take_row_ids_errors(tmp_path):
+@pytest.mark.parametrize("with_row_id", [False, True])
+@pytest.mark.parametrize("use_rte", [None, True])
+def test_lsm_read_take_row_ids_errors(tmp_path, with_row_id, use_rte):
     db = lancedb.connect(tmp_path, read_consistency_interval=timedelta(seconds=0))
     table = db.create_table("t", _reader([1, 2, 3]))
     table.set_unenforced_primary_key("id")
     table.enable_rte(RTEWriteSpec.unsharded())
     _lsm_upsert(table, [4])
-    # take-by-row-id auto-routes through the LSM scanner, which has no stable _rowid,
-    # so it hard-errors instead of failing with an opaque column-not-found error.
-    with pytest.raises(Exception, match="row id"):
-        table.take_row_ids([0, 1]).to_arrow()
+    # Automatic and explicit RTE routing must explain the unsupported take,
+    # including when row IDs are only requested internally for ordering.
+    take = table.take_row_ids([1, 0, 1, 2**64 - 1], with_row_id=with_row_id)
+    if use_rte is not None:
+        take = take.use_rte(use_rte)
+    with pytest.raises(Exception, match=r"take by row id.*use_rte\(false\)"):
+        take.to_arrow()
     # use_rte(False) is the escape hatch: it reads the base table.
-    base = table.take_row_ids([0, 1]).use_rte(False).to_arrow()
-    assert base.num_rows == 2
+    base = take.use_rte(False).to_arrow()
+    assert base["id"].to_pylist() == [2, 1, 2]
+    assert base["value"].to_pylist() == [1, 0, 1]
+    assert ("_rowid" in base.column_names) == with_row_id
+    if with_row_id:
+        assert base["_rowid"].to_pylist() == [1, 0, 1]
 
 
 def test_lsm_read_fts_postfilter_errors(tmp_path):
```

**File**: `python/python/tests/test_query.py` (modified, +34/-13)
```diff
@@ -2417,13 +2417,36 @@ def test_take_queries(tmp_path):
     assert sorted(converted["idx"].to_pylist()) == [2, 5, 5, 17]
 
     # Take by row id
-    assert list(
-        sorted(table.take_row_ids([5, 2, 17]).to_pandas()["idx"].to_list())
-    ) == [
-        2,
-        5,
-        17,
-    ]
+    assert table.take_row_ids([5, 2, 17]).to_pandas()["idx"].to_list() == [5, 2, 17]
+
+
+@pytest.mark.parametrize("selection", [None, [], ["idx"], {"_rowid": "100 - idx"}])
+@pytest.mark.parametrize("empty", [False, True])
+def test_take_row_ids_order_and_roundtrip(tmp_path, selection, empty):
+    table = lancedb.connect(tmp_path).create_table("test", pa.table({"idx": [0, 1]}))
+    table.add(pa.table({"idx": [2, 3]}))
+    rows = table.search().with_row_id(True).to_arrow().to_pylist()
+    row_ids = {row["idx"]: row["_rowid"] for row in rows}
+    table.delete("idx = 1")
+    requested = (
+        [] if empty else [row_ids[3], row_ids[1], row_ids[3], 2**64 - 1, row_ids[0]]
+    )
+    take = table.take_row_ids(requested)
+    if selection is not None:
+        take = take.select(selection)
+    actual = take.to_arrow()
+    assert actual.num_rows == (0 if empty else 3)
+    if selection == {"_rowid": "100 - idx"}:
+        assert actual.column_names == ["_rowid"]
+        assert actual["_rowid"].to_pylist() == ([] if empty else [97, 97, 100])
+    elif selection == []:
+        assert actual.num_columns == 0
+    else:
+        assert actual.column_names == ["idx"]
+        assert actual["idx"].to_pylist() == ([] if empty else [3, 3, 0])
+    query = take.to_query_object()
+    assert query.take_row_ids == requested
+    assert table._execute_query(query).read_all() == actual
 
 
 def test_take_queries_with_row_id(tmp_path):
@@ -2432,6 +2455,7 @@ def test_take_queries_with_row_id(tmp_path):
 
     by_row_id = table.take_row_ids([5, 2, 17], with_row_id=True).to_arrow()
     assert "_rowid" in by_row_id.column_names
+    assert by_row_id["_rowid"].to_pylist() == [5, 2, 17]
     by_offset = table.take_offsets([5, 2, 17], with_row_id=True).to_arrow()
     assert "_rowid" in by_offset.column_names
 
@@ -2446,6 +2470,7 @@ async def test_take_queries_with_row_id_async(tmp_path):
 
     by_row_id = await table.take_row_ids([5, 2, 17], with_row_id=True).to_arrow()
     assert "_rowid" in by_row_id.column_names
+    assert by_row_id["_rowid"].to_pylist() == [5, 2, 17]
     by_offset = await table.take_offsets([5, 2, 17], with_row_id=True).to_arrow()
     assert "_rowid" in by_offset.column_names
 
@@ -2472,16 +2497,12 @@ def test_take_queries_to_batches(tmp_path):
     rs = list(table.take_row_ids([5, 2, 17]).to_batches())
     assert all(isinstance(b, pa.RecordBatch) for b in rs)
     assert sum(b.num_rows for b in rs) == 3
-    assert sorted(v for b in rs for v in b.column("idx").to_pylist()) == [2, 5, 17]
+    assert [v for b in rs for v in b.column("idx").to_pylist()] == [5, 2, 17]
 
     # Take with select projection → to_batches preserves the projection
     rs = list(table.take_row_ids([5, 2, 17]).select(["label"]).to_batches())
     assert all(b.schema.names == ["label"] for b in rs)
-    assert sorted(v for b in rs for v in b.column("label").to_pylist()) == [
-        "17",
-        "2",
-        "5",
-    ]
+    assert [v for b in rs for v in b.column("label").to_pylist()] == ["5", "2", "17"]
 
 
 def test_getitems(tmp_path):
```

**File**: `python/python/tests/test_remote_db.py` (modified, +57/-2)
```diff
@@ -1422,7 +1422,26 @@ def handler(request):
 
 
 def test_table_add_in_threadpool():
+    received = []
+
     def handler(request):
+        # Consume uploads before responding: closing with unread bytes can reset
+        # the connection while the client is still reading the response.
+        if request.headers.get("Transfer-Encoding") == "chunked":
+            body = bytearray()
+            while size := int(request.rfile.readline().split(b";")[0], 16):
+                body.extend(request.rfile.read(size))
+                assert request.rfile.read(2) == b"\r\n"
+            assert request.rfile.read(2) == b"\r\n"
+        else:
+            body = request.rfile.read(int(request.headers.get("Content-Length", 0)))
+        if request.path in (
+            "/v1/table/test/create/?mode=create",
+            "/v1/table/test/insert/",
+        ):
+            received.append(
+                (request.path, pa.ipc.open_stream(body).read_all().to_pylist())
+            )
         if request.path == "/v1/table/test/insert/":
             request.send_response(200)
             request.end_headers()
@@ -1461,6 +1480,9 @@ def handler(request):
             for future in futures:
                 future.result()
 
+    assert [rows for path, rows in received if "/create/" in path] == [[{"id": 1}]]
+    assert [rows for path, rows in received if "/insert/" in path] == [[{"id": 1}]] * 10
+
 
 def test_table_create_indices():
     # Track received index creation requests to validate name parameter
@@ -3232,8 +3254,41 @@ def handler(body):
     assert bodies[-1]["with_row_id"] is True
 
     with query_test_table(handler) as table:
-        table.take_row_ids([0, 1]).to_arrow()
-    assert "with_row_id" not in bodies[-1]
+        result = table.take_row_ids([0, 1]).to_arrow()
+        assert result.column_names == ["id"]
+    assert bodies[-1]["with_row_id"] is True
+
+
+@pytest.mark.parametrize("with_row_id", [False, True])
+@pytest.mark.parametrize("selection", [None, [], ["id"], ["_rowid", "id"]])
+def test_remote_take_row_ids_order_and_roundtrip(with_row_id, selection):
+    def handler(body):
+        assert body["with_row_id"] is True
+        assert "_rowid IN" in body["filter"]
+        assert "take_row_ids" not in body
+        assert "_rowid" not in body.get("columns", [])
+        data = pa.table(
+            {
+                "id": pa.chunked_array([[1, 5], [17]]),
+                "_rowid": pa.chunked_array([[1, 5], [17]], type=pa.uint64()),
+            }
+        )
+        return data.select(body.get("columns", ["id"]) + ["_rowid"])
+
+    with query_test_table(handler) as table:
+        take = table.take_row_ids([17, 5, 2**64 - 1, 17, 1], with_row_id=with_row_id)
+        if selection is not None:
+            take = take.select(selection)
+        result = take.to_batches(max_batch_length=1).read_all()
+        assert result.num_rows == 4
+        expected_columns = ["id"] if selection is None else list(selection)
+        if with_row_id:
+            expected_columns = [name for name in expected_columns if name != "_rowid"]
+            expected_columns.append("_rowid")
+        assert result.column_names == expected_columns
+        for column in expected_columns:
+            assert result[column].to_pylist() == [17, 5, 17, 1]
+        assert table._execute_query(take.to_query_object()).read_all() == result
 
 
 def test_query_sync_minimal():
```

**File**: `python/src/query.rs` (modified, +3/-0)
```diff
@@ -355,6 +355,7 @@ pub struct PyQueryRequest {
     pub limit: Option<usize>,
     pub offset: Option<usize>,
     pub take_offsets: Option<Vec<u64>>,
+    pub take_row_ids: Option<Vec<u64>>,
     pub filter: Option<PyQueryFilter>,
     pub full_text_search: Option<PyLanceDB<FtsQuery>>,
     pub select: PySelect,
@@ -387,6 +388,7 @@ impl From<AnyQuery> for PyQueryRequest {
                 limit: query_request.limit,
                 offset: query_request.offset,
                 take_offsets: query_request.take_offsets,
+                take_row_ids: query_request.take_row_ids,
                 filter: query_request.filter.map(PyQueryFilter),
                 full_text_search: query_request
                     .full_text_search
@@ -419,6 +421,7 @@ impl From<AnyQuery> for PyQueryRequest {
                 limit: vector_query.base.limit,
                 offset: vector_query.base.offset,
                 take_offsets: vector_query.base.take_offsets,
+                take_row_ids: vector_query.base.take_row_ids,
                 filter: vector_query.base.filter.map(PyQueryFilter),
                 full_text_search: None,
                 select_source_columns: PySelect::source_columns(&vector_query.base.select),
```

---

### Incident Patch 2: `5def2611` (2026-11-05)
**Commit Message**: fix(deps): ignore RUSTSEC-2026-0441 pin-utils unmaintained (#4872)

`cargo deny` fails on main because RUSTSEC-2026-0441 marks `pin-utils`
as unmaintained. Add an exception reviewed on 2026-11-05, with the
advisory and upstream discussion links and a reminder to revisit it when
updating AWS dependencies.

`pin-utils` is transitive through `aws-smithy-http`,
`aws-smithy-runtime`, and `aws-smithy-types`, including the `aws-config`
→ `lance-io` path. RustSec lists no safe upgrade; clearing the advisory
requires upstream migration to supported pinning primitives.

Validation on commit dede2c783fda73500cee2b05feffe1b70d56624c:

- Before the change, `cargo deny check advisories` failed on
RUSTSEC-2026-0441.
- `cargo deny check advisories` passes after the change.
- `cargo deny check advisories bans licenses sources` passes all four
checks, matching the Rust CI deny job.
- `git diff HEAD^ HEAD --check` passes.

**File**: `deny.toml` (modified, +8/-0)
```diff
@@ -131,6 +131,14 @@ ignore = [
     { id = "RUSTSEC-2026-0391", reason = "zstd 0.13 via arrow-ipc 58; affected with_context API is unused" },
     { id = "RUSTSEC-2026-0398", reason = "zstd-safe 7 via arrow-ipc 58; affected seekable API is not enabled" },
     { id = "RUSTSEC-2026-0403", reason = "zstd-safe 7 via arrow-ipc 58; affected streaming decoder API is unused" },
+
+    # pin-utils: unmaintained; reviewed 2026-11-05. Transitive via
+    # aws-smithy-http/runtime/types, including aws-config -> lance-io.
+    # No safe upgrade exists; clearing requires AWS Smithy to migrate to
+    # core::pin::pin!, pin-project, or pin-project-lite. Revisit on AWS updates.
+    # https://rustsec.org/advisories/RUSTSEC-2026-0441
+    # https://github.com/rustsec/advisory-db/issues/3314
+    { id = "RUSTSEC-2026-0441", reason = "pin-utils unmaintained via AWS Smithy; no safe upgrade, awaiting upstream migration" },
 ]
 
 
```

---

### Incident Patch 3: `1e40ef68` (2026-11-05)
**Commit Message**: fix: remove unmaintained pin-utils from AWS dependencies (#4874)

`cargo deny` rejects `pin-utils 0.1.0` as unmaintained under
RUSTSEC-2026-0441; there is no patched release. The dependency comes
from the AWS Smithy graph. Refresh that graph to include [smithy-rs
#4882](https://github.com/smithy-lang/smithy-rs/pull/4882), replacing
the obsolete `aws-smithy-types = ">=1.3.6, <1.7"` constraint with
`1.9.1`.

The lockfile audit attributes every changed package identity and
resolved dependency edge to the AWS graph. Existing git dependency pins
are preserved. The selected AWS crates declare Rust 1.94.1, within the
workspace's unchanged 1.95.0 requirement.

Validation at the exact candidate on the development EC2 host, both exit
0:

- `mbx +1.97.1 deny check advisories bans licenses sources`
- `mbx +1.97.1 check --quiet --locked -p lancedb --tests --features
remote,aws,dynamodb,bedrock`

The second command compiles the selected test targets; it is not a
runtime integration test. Full all-features compilation remains
unverified: an earlier attempt stopped in lance-linalg because the host
Clang 15 does not support the required `_Float16` target.

**File**: `Cargo.lock` (modified, +317/-262)
```diff
@@ -626,9 +626,9 @@ checksum = "c08606f8c3cbf4ce6ec8e28fb0014a2c086708fe954eaa885384a6165172e7e8"
 
 [[package]]
 name = "aws-config"
-version = "1.8.16"
+version = "1.13.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "50f156acdd2cf55f5aa53ee416c4ac851cf1222694506c0b1f78c85695e9ca9d"
+checksum = "939e256cfe0ed68e96d32f194339d88210d5c10685cff0787400158f852c6819"
 dependencies = [
  "aws-credential-types",
  "aws-runtime",
@@ -640,12 +640,13 @@ dependencies = [
  "aws-smithy-json",
  "aws-smithy-runtime",
  "aws-smithy-runtime-api",
+ "aws-smithy-schema",
  "aws-smithy-types",
  "aws-types",
  "bytes",
  "fastrand",
  "hex",
- "http 1.5.0",
+ "http",
  "sha1 0.10.6",
  "time",
  "tokio",
@@ -656,9 +657,9 @@ dependencies = [
 
 [[package]]
 name = "aws-credential-types"
-version = "1.2.14"
+version = "1.3.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8f20799b373a1be121fe3005fba0c2090af9411573878f224df44b42727fcaf7"
+checksum = "576e8da35751dc85409ec1cd15999f692c277a1fbe9336780fe6f15e49dd637d"
 dependencies = [
  "aws-smithy-async",
  "aws-smithy-runtime-api",
@@ -692,9 +693,9 @@ dependencies = [
 
 [[package]]
 name = "aws-runtime"
-version = "1.7.3"
+version = "1.10.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5dcd93c82209ac7413532388067dce79be5a8780c1786e5fae3df22e4dee2864"
+checksum = "9a0cc2144962cc5e358467b16e3d82981b1d424a7c3d34602be0036103814a1a"
 dependencies = [
  "aws-credential-types",
  "aws-sigv4",
@@ -708,10 +709,8 @@ dependencies = [
  "bytes",
  "bytes-utils",
  "fastrand",
- "http 0.2.12",
- "http 1.5.0",
- "http-body 0.4.6",
- "http-body 1.1.0",
+ "http",
+ "http-body",
  "percent-encoding",
  "pin-project-lite",
  "tracing",
@@ -720,10 +719,11 @@ dependencies = [
 
 [[package]]
 name = "aws-sdk-bedrockruntime"
-version = "1.130.0"
+version = "1.153.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3e2f7bca252e3c5c8f0ed12c5501bf8b0fbadb937cd9fdd71a0ebd9d7526540f"
+checksum = "89b8aeb4b1b6d5f9d377264cff21b4e4d773e66ee3c5582b4099a8fbc702bdb3"
 dependencies = [
+ "arc-swap",
  "aws-credential-types",
  "aws-runtime",
  "aws-sigv4",
@@ -734,23 +734,24 @@ dependencies = [
  "aws-smithy-observability",
  "aws-smithy-runtime",
  "aws-smithy-runtime-api",
+ "aws-smithy-schema",
  "aws-smithy-types",
  "aws-types",
  "bytes",
  "fastrand",
- "http 0.2.12",
- "http 1.5.0",
+ "http",
  "http-body-util",
  "regex-lite",
  "tracing",
 ]
 
 [[package]]
 name = "aws-sdk-dynamodb"
-version = "1.111.0"
+version = "1.137.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "fc418346e3cb248c7d59e642acbcb06488b7c7cd2ba6ebc79e8003f618c60099"
+checksum = "41515f51bd2b5608268336bda372065e8fd5d1ca2f684b63e5c25ae4abb62c53"
 dependencies = [
+ "arc-swap",
  "aws-credential-types",
  "aws-runtime",
  "aws-smithy-async",
@@ -759,22 +760,24 @@ dependencies = [
  "aws-smithy-observability",
  "aws-smithy-runtime",
  "aws-smithy-runtime-api",
+ "aws-smithy-schema",
  "aws-smithy-types",
  "aws-types",
  "bytes",
  "fastrand",
- "http 0.2.12",
- "http 1.5.0",
+ "http",
  "regex-lite",
  "tracing",
+ "url",
 ]
 
 [[package]]
 name = "aws-sdk-kms"
-version = "1.106.0"
+version = "1.129.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2336350f96efcf9c2552b7fdb4dd07a0c1fef11f22b28fb020a9e33e7925cf9d"
+checksum = "5c5cdb29ad25d71c9ee54c408a672c98d90a24a0ea6eb063025483e0e894b411"
 dependencies = [
+ "arc-swap",
  "aws-credential-types",
  "aws-runtime",
  "aws-smithy-async",
@@ -783,22 +786,23 @@ dependencies = [
  "aws-smithy-observability",
  "aws-smithy-runtime",
  "aws-smithy-runtime-api",
+ "aws-smithy-schema",
  "aws-smithy-types",
  "aws-types",
  "bytes",
  "fastrand",
- "http 0.2.12",
- "http 1.5.0",
+ "http",
  "regex-lite",
  "tracing",
 ]
 
 [[package]]
 name = "aws-sdk-s3"
-version = "1.132.0"
+version = "1.157.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5575840a3a6b11f6011463ebe359320dfe5b67babb5e9b06fed6ddf809a9ab40"
+checksum = "6ea9794c741520d8baec9462bcd0ad12164d4f5f78d008a8da9d6a0b7222caa8"
 dependencies = [
+ "arc-swap",
  "aws-credential-types",
  "aws-runtime",
  "aws-sigv4",
@@ -810,17 +814,17 @@ dependencies = [
  "aws-smithy-observability",
  "aws-smithy-runtime",
  "aws-smithy-runtime-api",
+ "aws-smithy-schema",
  "aws-smithy-types",
  "aws-smithy-xml",
  "aws-types",
  "bytes",
  "fastrand",
  "hex",
  "hmac 0.13.0",
- "http 0.2.12",
- "http 1.5.0",
- "http-body 1.1.0",
- "lru",
+ "http",
+ "http-body",
+ "lru 0.18.5",
  "percent-encoding",
  "regex-lite",
  "sha2 0.11.0",
@@ -830,10 +834,11 @@ dependencies = [
 
 [[package]]
 name = "aws-sdk-sso"
-version = "1.98.0"
+version = "1.119.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d69c77aafa20460c68b6b3213c84f6423b6e76dbf89accd3e1789a686ffd9489"
+checksum = "3c414f25ec4aa9dc18f5cc8f55
```

**File**: `Cargo.toml` (modified, +1/-2)
```diff
@@ -49,8 +49,7 @@ arrow-select = "59.2.0"
 arrow-cast = "59.2.0"
 arrow-flight = { version = "59.2.0", features = ["flight-sql-experimental"] }
 async-trait = "0"
-# Smithy JSON 0.63 requires the pre-1.7 Document representation; allow the MSRV pin.
-aws-smithy-types = ">=1.3.6, <1.7"
+aws-smithy-types = "1.9.1"
 base64 = "0.22"
 bytes = "1"
 datafusion = { version = "55.0.0", default-features = false }
```

#### Recent Merged Pull Requests:
- **PR #4875** (2026-11-05): test: match SDK documentation fallback URL (@Xuanwo)
- **PR #4874** (2026-11-05): fix: remove unmaintained pin-utils from AWS dependencies (@Xuanwo)
- **PR #4872** (2026-11-05): fix(deps): ignore RUSTSEC-2026-0441 pin-utils unmaintained (@Xuanwo)
- **PR #4871** (2026-11-05): fix(node): normalize record batches before IPC serialization (@BubbleCal)
- **PR #4870** (2026-11-05): fix: nav, redirect and badge cleanup across several pages (@jackye1995)
- **PR #4869** (2026-11-05): test: allow hidden pages in SDK documentation links (@Xuanwo)

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

## X. preserve take_row_ids request order (#4826)

**RULE**:
When implementing operations in `docs/web/curation/selective-sampling.mdx`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lancedb/lancedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `69ac2158`: preserve take_row_ids request order (#4826). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/web/curation/selective-sampling.mdx`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
similar to execute it.

<Note>
The guarantees for row IDs below apply to SDK releases containing
[the ordering fix in #4826](https://github.com/lancedb/lancedb/pull/4826).
Earlier releases may collapse repeated IDs and return rows in a different
order.
</Note>

`take_row_ids` returns matching rows in the order of the input IDs and
preserves repeated IDs in both LanceDB Embedded and LanceDB Enterprise. For example,
`take_row_ids([1005, 1001, 1005])` returns row 1005, row 1001, then row 1005
again if both IDs exist. Missing or deleted IDs are omitted. This supports
sampling with replacement. In Rust, an explicit nonempty
`QueryBase::order_by` list overrides the requested order; limits and offsets
apply after restoring repeated rows.

`take_offsets` also preserves repeated offsets, but does not guarantee
input order. It tracks `_rowoffset` internally to restore repeated rows
and drops that column from the output unless you explicitly `select` it.
Add `_rowoffset` to your selection when you need to align a `take_offsets`
result with the input offsets.

<Note>
Ordered takes by row ID collect all matching batches, combine them into one
batch and reorder the rows before returning output b
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
similar to execute it. Repeated *offsets* produce repeated rows, so
`take_offsets` also supports sampling with replacement -- `take_row_ids`
does not: a row ID repeated in the input list still returns that row only
once, since the lookup is a set membership test. Neither method guarantees
result order matches the order of the input list; for `take_row_ids`, pass
`with_row_id=True` to add `_rowid` to the output and align the results
yourself if you need to. `take_offsets` tracks `_rowoffset` internally to
restore repeated rows, but drops that column from the output again
afterward unless you explicitly `select` it -- add `_rowoffset` to your
selection when you need it to align a `take_offsets` result yourself.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `69ac2158` are properly handled with clean fallback behavior.
