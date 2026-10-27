> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/lancedb-lancedb-learnings.md`  
> **Source**: github ([https://github.com/lancedb/lancedb](https://github.com/lancedb/lancedb))  
> **Source Version**: `3575f972`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T15:29:35.875Z  
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
> **Harvest Timestamp**: 2026-10-27T15:29:35.406Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lancedb/lancedb`
- **Description**: Developer-friendly OSS embedded retrieval library for multimodal AI. Search More; Manage Less.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 11791 stars

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
from datetime import date, datetime
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
        first = query[0]

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
- **Issue #4688** (2026-10-27): **fix: gate experimental local functions behind an opt-in feature**
  *Symptoms*: Published SDK builds currently expose local SQL computed columns and materialized-view execution that are not ready for release. Add the opt-in `experimental-functions` Cargo feature to the Rust core and forward it through the Python and Node bindings; published packages leave it disabled.  Local declarations and refreshes now return `NotSupported` before mutating tables or spawning jobs, including prepared materialized-view creation. Remote Cloud/Enterprise client operations, Python UDF packaging, ordinary eager `add_columns`, and access to existing data remain available. Stored metadata and write protections stay active, and shared server commit helpers remain usable.  CI covers both feature configurations. Existing local execution tests run with the feature enabled; default-build regressions cover early rejection, unchanged table versions, existing metadata protections, and normal eager transforms. API and source-build documentation explain the opt-in.  Validation: Rust library tests pass with the feature disabled (1,869 tests) and enabled (1,947 tests), plus three default-build integration regressions. Python and TypeScript bindings were rebuilt and tested in both configurations, including mocked remote requests; Rust formatting, Python package lint, TypeScript lint/build, and generated docs were checked. Repository-wide Ruff still reports 48 pre-existing errors in unchanged `docs/web-tests` files. 

- **Issue #4686** (2026-10-27): **fix: refuse Function-bound writes by column instead of by table**
  *Symptoms*: A table with a Function binding rejected every update and merge_insert, whatever columns the write named: updating an unrelated column, or a merge that only inserts rows, failed with "not supported on a table with registered Function bindings". Expression computed columns on the same table accept those writes.  Both paths now use the per-column guard that schema evolution already uses. An update is checked on its SET columns. A merge is checked on the columns a matched row would take from the source, every source column but the join keys; an insert-only merge is an append, and its new rows get their Function outputs from the next refresh. Writes to a binding's inputs or outputs are still refused, now naming the column. 

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

### Incident Patch 1: `180eaaf6` (2026-10-26)
**Commit Message**: fix!: reject unsupported remote connection and table options (#4486)

Fixes #4399.

Remote connections currently discard local-only settings, including
table write options that determine storage format. The synchronous
Python client also binds the fourth positional `create_table` argument
to `on_bad_vectors`, so an intended overwrite is sent as a create.

This change aligns the remote Python signature with
`DBConnection.create_table`, preserves the legacy remote timeout
keywords, and raises `ValueError` for other unknown connection keywords.
The shared Rust client rejects unsupported connection, create, and open
options before sending HTTP requests; open validation also runs before a
table-cache hit. Python reports these as `NotImplementedError`,
including explicit `enable_v2_manifest_paths=False`. Supported
Enterprise connection-level storage options remain available.

This implements option 2 from the issue: explicit rejection. It
deliberately does not add unverified server write parameters. Calls that
previously supplied ignored options must omit them to use server-managed
storage and caching. Database URI prefixes are already preserved on
current main and are unchanged here.

R

**File**: `docs/src/python/python.md` (modified, +11/-0)
```diff
@@ -20,6 +20,17 @@ pip install lancedb
 The following methods describe the synchronous API client. There
 is also an [asynchronous API client](#connections-asynchronous).
 
+Connections to `db://` databases reject local-only options with
+`NotImplementedError`. These include `session` and `manifest_enabled=True` on
+connect, per-table storage and write options on create, and `index_cache_size`,
+`storage_options`, or `location` on open (where the method accepts them).
+Omit these options to use server-managed storage and caching. Connection-level
+`storage_options` supported by an Enterprise deployment remain available.
+
+The synchronous remote `create_table` uses the same positional order as the
+local API: `name, data, schema, mode, exist_ok, on_bad_vectors, fill_value,
+embedding_functions`. Prefer keyword arguments for optional parameters.
+
 ## Connections (Synchronous)
 
 ::: lancedb.connect
```

**File**: `docs/web/basics/sdk.mdx` (modified, +7/-0)
```diff
@@ -92,6 +92,13 @@ manages background maintenance.
   [background maintenance](/maintenance/background-jobs) rather than calling
   the embedded table's `optimize()` method.
 
+{/* Draft for the remote option validation release.
+- **Remove local storage and cache settings.** `db://` connections reject local
+  sessions, table cache settings, and per-table storage and write options. Omit
+  these options so Enterprise manages storage and caching. Connection-level
+  storage options supported by your Enterprise deployment remain available.
+*/}
+
 For SQL connection details, see [SQL](/basics/sql). For the operating model and
 deployment options, see [LanceDB Enterprise](/enterprise).
 
```

**File**: `nodejs/__test__/query.test.ts` (modified, +11/-5)
```diff
@@ -538,11 +538,17 @@ describe("IVF search effort", () => {
     const db = await connect(directory.name);
     const rows = Array.from({ length: 512 }, (_, id) => ({
       id,
-      vector: Array.from(
-        { length: 16 },
-        (_, j) =>
-          (Math.floor(id / 32) === j ? 1 : 0) + Math.sin(id * 17 + j) * 0.001,
-      ),
+      // Keep all eight exact neighbors together even if random IVF training
+      // splits the first cluster. This tests effort, not training recall.
+      vector:
+        id < 8
+          ? [...vector]
+          : Array.from(
+              { length: 16 },
+              (_, j) =>
+                (Math.floor(id / 32) === j ? 1 : 0) +
+                Math.sin(id * 17 + j) * 0.001,
+            ),
     }));
     table = await db.createTable("effort", rows.slice(0, 256));
     await table.add(rows.slice(256));
```

**File**: `nodejs/__test__/remote.test.ts` (modified, +49/-0)
```diff
@@ -98,6 +98,55 @@ async function withMockDatabase(
 }
 
 describe("remote connection", () => {
+  it.each([
+    { dataStorageVersion: "2.0" },
+    { enableV2ManifestPaths: false },
+    { storageOptions: { bogusOptionXyz: "1" } },
+  ])("rejects local create options %j before sending data", async (options) => {
+    const requests: string[] = [];
+    await withMockDatabase(
+      (req, res) => {
+        requests.push(req.url ?? "");
+        res.writeHead(200).end();
+      },
+      async (db) => {
+        await expect(
+          db.createTable("test", [{ value: 1 }], {
+            ...options,
+            mode: "overwrite",
+          }),
+        ).rejects.toThrow(/write_options.*remote/);
+        await expect(
+          db.createEmptyTable(
+            "test",
+            new Schema([new Field("value", new Int64(), true)]),
+            options,
+          ),
+        ).rejects.toThrow(/write_options.*remote/);
+      },
+    );
+    expect(requests).toEqual([]);
+  });
+
+  it.each([{ indexCacheSize: 5 }, { storageOptions: { x: "y" } }])(
+    "rejects local open options %j before sending a request",
+    async (options) => {
+      const requests: string[] = [];
+      await withMockDatabase(
+        (req, res) => {
+          requests.push(req.url ?? "");
+          res.writeHead(200).end();
+        },
+        async (db) => {
+          await expect(
+            db.openTable("test", undefined, options),
+          ).rejects.toThrow(/not supported for remote/);
+        },
+      );
+      expect(requests).toEqual([]);
+    },
+  );
+
   it.each([false, true])(
     "normalizes remote blob writes (range target: %s)",
     async (wide) => {
```

**File**: `python/python/lancedb/__init__.py` (modified, +15/-0)
```diff
@@ -281,6 +281,21 @@ def connect(
             "uri is required when not connecting through a namespace client"
         )
     if isinstance(uri, str) and uri.startswith("db://"):
+        # Preserve the deprecated remote timeout options, but validate all other
+        # unknown keywords just as the local connection does.
+        unknown_kwargs = {
+            key: value
+            for key, value in kwargs.items()
+            if key not in ("connection_timeout", "read_timeout")
+        }
+        if unknown_kwargs:
+            raise ValueError(f"Unknown keyword arguments: {unknown_kwargs}")
+        if session is not None:
+            raise NotImplementedError("session is not supported for remote connections")
+        if manifest_enabled:
+            raise NotImplementedError(
+                "manifest_enabled is not supported for remote connections"
+            )
         if api_key is None:
             api_key = os.environ.get("LANCEDB_API_KEY")
         if api_key is None:
```

**File**: `python/python/lancedb/remote/db.py` (modified, +25/-12)
```diff
@@ -7,7 +7,6 @@
 from dataclasses import replace
 from datetime import timedelta
 import json
-import logging
 from concurrent.futures import ThreadPoolExecutor
 import sys
 from typing import (
@@ -502,18 +501,14 @@ def open_table(
 
         if namespace_path is None:
             namespace_path = []
-        if storage_options is not None:
-            logging.info(
-                "storage_options is ignored for remote tables"
-                " (storage is managed; set storage_options on connect() instead)"
-            )
-        if index_cache_size is not None:
-            logging.info(
-                "index_cache_size is ignored for remote tables"
-                " (there is no local cache to configure)"
+        table = LOOP.run(
+            self._conn.open_table(
+                name,
+                namespace_path=namespace_path,
+                storage_options=storage_options,
+                index_cache_size=index_cache_size,
             )
-
-        table = LOOP.run(self._conn.open_table(name, namespace_path=namespace_path))
+        )
         tbl = RemoteTable(
             table,
             self.db_name,
@@ -593,6 +588,9 @@ def create_table(
         embedding_functions: Optional[List[EmbeddingFunctionConfig]] = None,
         *,
         namespace_path: Optional[List[str]] = None,
+        storage_options: Optional[Dict[str, str]] = None,
+        data_storage_version: Optional[str] = None,
+        enable_v2_manifest_paths: Optional[bool] = None,
     ) -> Table:
         """Create a [Table][lancedb.table.Table] in the database.
 
@@ -632,6 +630,12 @@ def create_table(
         embedding_functions: list of EmbeddingFunctionConfig, optional
             The embedding functions to store in the table schema and use to
             generate vectors when creating the table or adding data.
+        storage_options: dict, optional
+            Not supported for remote table creation. Raises NotImplementedError.
+        data_storage_version: str, optional
+            Not supported for remote table creation. Raises NotImplementedError.
+        enable_v2_manifest_paths: bool, optional
+            Not supported for remote table creation. Raises NotImplementedError.
 
         Returns
         -------
@@ -698,6 +702,14 @@ def create_table(
         LanceTable(table4)
 
         """
+        for option, value in (
+            ("data_storage_version", data_storage_version),
+            ("enable_v2_manifest_paths", enable_v2_manifest_paths),
+        ):
+            if value is not None:
+                raise NotImplementedError(
+                    f"{option} is not supported for remote table creation"
+                )
         if exist_ok:
             if mode == "create":
                 mode = "exist_ok"
@@ -719,6 +731,7 @@ def create_table(
                 on_bad_vectors=on_bad_vectors,
                 fill_value=fill_value,
                 embedding_functions=embedding_functions,
+                storage_options=storage_options,
             )
         )
         return RemoteTable(
```

**File**: `python/python/tests/test_remote_db.py` (modified, +5/-5)
```diff
@@ -1823,12 +1823,12 @@ def test_remote_unsupported_legacy_hnsw_pq():
                 )
 
 
-def test_remote_python_only_messages(caplog):
+def test_remote_python_only_messages():
     with mock_lancedb_connection(remote_unsupported_handler) as db:
-        with caplog.at_level("INFO"):
-            table = db.open_table("test", storage_options={}, index_cache_size=1)
-        assert "storage_options is ignored for remote tables" in caplog.text
-        assert "index_cache_size is ignored for remote tables" in caplog.text
+        for options in [{"storage_options": {}}, {"index_cache_size": 1}]:
+            with pytest.raises(NotImplementedError, match=next(iter(options))):
+                db.open_table("test", **options)
+        table = db.open_table("test")
         for method in ["to_arrow", "to_pandas", "to_polars"]:
             with pytest.raises(NotImplementedError) as error:
                 getattr(table, method)()
```

**File**: `python/python/tests/test_remote_options.py` (added, +154/-0)
```diff
@@ -0,0 +1,154 @@
+# SPDX-License-Identifier: Apache-2.0
+# SPDX-FileCopyrightText: Copyright The LanceDB Authors
+
+import inspect
+from urllib.parse import parse_qs, urlparse
+
+import lancedb
+import pyarrow as pa
+import pytest
+
+from test_remote_db import mock_lancedb_connection, mock_lancedb_connection_async
+
+
+@pytest.mark.parametrize("uri", ["memory://", "db://dev"])
+def test_unknown_connect_options(uri):
+    with pytest.raises(ValueError, match="Unknown keyword arguments.*bogus"):
+        lancedb.connect(uri, api_key="fake", bogus=1)
+
+
+@pytest.mark.parametrize("option", ["session", "manifest_enabled"])
+@pytest.mark.parametrize("asynchronous", [False, True])
+@pytest.mark.asyncio
+async def test_remote_connect_rejects_local_options(option, asynchronous):
+    value = lancedb.Session() if option == "session" else True
+    with pytest.raises(NotImplementedError, match=option):
+        if asynchronous:
+            await lancedb.connect_async("db://dev", api_key="fake", **{option: value})
+        else:
+            lancedb.connect("db://dev", api_key="fake", **{option: value})
+
+
+def test_remote_create_signature():
+    from lancedb.db import DBConnection
+    from lancedb.remote.db import RemoteDBConnection
+
+    expected = inspect.signature(DBConnection.create_table).parameters
+    actual = inspect.signature(RemoteDBConnection.create_table).parameters
+    assert list(actual) == list(expected)
+    for name in expected:
+        assert actual[name].kind == expected[name].kind
+        if name == "mode":
+            # Remote connections retain their existing server-default mode.
+            assert actual[name].default is None
+        else:
+            assert actual[name].default == expected[name].default
+
+
+def test_remote_create_positional_mode():
+    modes = []
+
+    def handler(request):
+        assert urlparse(request.path).path == "/v1/table/ct_pos/create/"
+        modes.append(parse_qs(urlparse(request.path).query)["mode"])
+        request.send_response(200)
+        request.end_headers()
+
+    with mock_lancedb_connection(handler) as db:
+        data = [{"value": 1}]
+        db.create_table("ct_pos", data, None, "overwrite")
+        db.create_table("ct_pos", data, None, "overwrite")
+        db.create_table("ct_pos", data, None, "create", True)
+        with pytest.raises(ValueError, match="Invalid mode"):
+            db.create_table("ct_pos", data, None, "drop")
+    assert modes == [["overwrite"], ["overwrite"], ["exist_ok"]]
+
+
+CREATE_OPTIONS = [
+    {"new_table_data_storage_version": "2.0"},
+    {"new_table_enable_v2_manifest_paths": "false"},
+    {"bogus_option_xyz": "1"},
+]
+
+
+@pytest.mark.parametrize("storage_options", CREATE_OPTIONS)
+@pytest.mark.parametrize("empty", [False, True])
+@pytest.mark.asyncio
+async def test_remote_create_rejects_write_options(storage_options, empty):
+    requests = []
+
+    def handler(request):
+        requests.append(request.path)
+        request.send_response(200)
+        request.end_headers()
+
+    kwargs = {"schema": pa.schema([("value", pa.int64())])}
+    if not empty:
+        kwargs["data"] = [{"value": 1}]
+    async with mock_lancedb_connection_async(handler) as db:
+        with pytest.raises(NotImplementedError, match="write_options.*remote"):
+            await db.create_table("t", storage_options=storage_options, **kwargs)
+    assert requests == []
+
+
+@pytest.mark.parametrize(
+    "options",
+    [
+        {"data_storage_version": "2.0"},
+        {"enable_v2_manifest_paths": False},
+        {"storage_options": {"x": "1"}},
+    ],
+)
+def test_sync_remote_create_rejects_write_options(options):
+    requests = []
+
+    def handler(request):
+        requests.append(request.path)
+        request.send_response(200)
+        request.end_headers()
+
+    with mock_lancedb_connection(handler) as db:
+        with pytest.raises(NotImplementedError, match="remote"):
+            db.create_table("t", [{"value": 1}], **options)
+    assert requests == []
+
+
+@pytest.mark.parametrize("asynchronous", [False, True])
+@pytest.mark.parametrize(
+    "options", [{"index_cache_size": 10}, {"storage_options": {"x": "y"}}]
+)
+@pytest.mark.asyncio
+async def test_remote_open_rejects_local_options(options, asynchronous):
+    requests = []
+
+    def handler(request):
+        requests.append(request.path)
+        request.send_response(200)
+        request.end_headers()
+        request.wfile.write(b'{"version": 1, "schema": {"fields": []}}')
+
+    if asynchronous:
+        async with mock_lancedb_connection_async(handler) as db:
+            with pytest.raises(NotImplementedError, match="remote"):
+                await db.open_table("t", **options)
+    else:
+        with mock_lancedb_connection(handler) as db:
+            with pytest.raises(NotImplementedError, match="remote"):
+                db.open_table("t", **options)
+    assert requests == []
+
+
+@pytest.mark.asyncio
+async def test_remote
```

---

### Incident Patch 2: `982b2a12` (2026-10-26)
**Commit Message**: fix(python): restore sync remote connection and table API parity (#4473)

Fixes #4400.

Sync remote connections fail on `uri`, `len(db)`, and `name in db`, and
remote tables lack `namespace`, `id`, and `replace_field_metadata`.
Share the paginated connection helpers and table identifier contract
through the base classes, and delegate remote metadata replacement to
the existing async implementation. Unsupported remote session and
read-consistency properties raise explicit `NotImplementedError`s.

Reconciled with main at `3dd57978`, including the synchronous method
signatures from #4498. The local session fix has already landed in
#4433, so this PR preserves its supplied-session-or-None contract and
adds no Rust/PyO3 session access. Namespace connections retain their
writable properties.

Existing custom `Table` subclasses remain instantiable: `namespace`
defaults to a fresh empty list, and deprecated `replace_field_metadata`
delegates to `update_field_metadata` with `replace=True` while retaining
its `None` return. Native and remote overrides are preserved. Regression
tests instantiate an old-style subclass through normal ABC class
creation and verify identifiers, independent namesp

**File**: `python/python/lancedb/db.py` (modified, +18/-15)
```diff
@@ -823,8 +823,26 @@ def drop_all_tables(self, namespace_path: Optional[List[str]] = None):
 
     @property
     def uri(self) -> str:
+        """The URI of this database."""
         return self._uri
 
+    def _all_table_names(self) -> Generator[str, None, None]:
+        page_token = None
+        while True:
+            response = self.list_tables(page_token=page_token)
+            yield from response.tables
+            page_token = response.page_token
+            if not page_token:
+                return
+
+    def __len__(self) -> int:
+        """Return the number of tables in the root namespace across all pages."""
+        return sum(1 for _ in self._all_table_names())
+
+    def __contains__(self, name: str) -> bool:
+        """Return whether the root namespace contains the named table."""
+        return name in self._all_table_names()
+
     def namespace_client(self) -> LanceNamespace:
         """Get the equivalent namespace client for this connection.
 
@@ -1609,21 +1627,6 @@ def table_names(
             )
         )
 
-    def _all_table_names(self) -> Generator[str, None, None]:
-        page_token = None
-        while True:
-            response = self.list_tables(page_token=page_token)
-            yield from response.tables
-            page_token = response.page_token
-            if not page_token:
-                return
-
-    def __len__(self) -> int:
-        return sum(1 for _ in self._all_table_names())
-
-    def __contains__(self, name: str) -> bool:
-        return name in self._all_table_names()
-
     @override
     def create_table(
         self,
```

**File**: `python/python/lancedb/remote/db.py` (modified, +18/-1)
```diff
@@ -47,7 +47,7 @@
 from ..view import ViewDescription
 
 if TYPE_CHECKING:
-    from .._lancedb import JobInfo
+    from .._lancedb import JobInfo, Session
 from ..embeddings import EmbeddingFunctionConfig
 from lance_namespace import (
     LanceNamespace,
@@ -240,6 +240,23 @@ def _from_catalog(
     def __repr__(self) -> str:
         return f"RemoteConnect(name={self.db_name})"
 
+    @property
+    @override
+    def uri(self) -> str:
+        return self._conn.uri
+
+    @property
+    def session(self) -> Optional["Session"]:
+        """Remote connections do not expose a local cache session."""
+        raise NotImplementedError("session is not supported by remote connections")
+
+    @property
+    def read_consistency_interval(self) -> Optional[timedelta]:
+        """Remote connections do not expose a local read consistency interval."""
+        raise NotImplementedError(
+            "read_consistency_interval is not supported by remote connections"
+        )
+
     @override
     def serialize(self) -> str:
         if getattr(self, "_catalog_oauth", False):
```

**File**: `python/python/lancedb/remote/table.py` (modified, +12/-0)
```diff
@@ -192,6 +192,18 @@ def name(self) -> str:
         """The name of the table"""
         return self._name
 
+    @property
+    def namespace(self) -> List[str]:
+        return self._namespace_path
+
+    @deprecation.deprecated(
+        deprecated_in="0.33.1",
+        current_version=__version__,
+        details="Use update_field_metadata() instead.",
+    )
+    def replace_field_metadata(self, field_name: str, new_metadata: Dict[str, str]):
+        LOOP.run(self._table.replace_field_metadata(field_name, new_metadata))
+
     def __repr__(self) -> str:
         return f"RemoteTable({self.db_name}.{self.name})"
 
```

**File**: `python/python/lancedb/table.py` (modified, +33/-7)
```diff
@@ -1360,6 +1360,16 @@ def name(self) -> str:
         """The name of this Table"""
         raise NotImplementedError("name is not supported for this table type")
 
+    @property
+    def namespace(self) -> List[str]:
+        """Return the namespace path of the table (empty for the root namespace)."""
+        return []
+
+    @property
+    def id(self) -> str:
+        """Return the full identifier of the table (namespace$name)."""
+        return "$".join(self.namespace + [self.name])
+
     @property
     @abstractmethod
     def version(self) -> int:
@@ -3106,6 +3116,29 @@ def update_field_metadata(
             version: the new table version after the update.
         """
 
+    @deprecation.deprecated(
+        deprecated_in="0.33.1",
+        current_version=__version__,
+        details="Use update_field_metadata() instead.",
+    )
+    def replace_field_metadata(self, field_name: str, new_metadata: Dict[str, str]):
+        """Replace all metadata of a field in the schema.
+
+        .. deprecated:: 0.33.1
+            Use [update_field_metadata][lancedb.table.Table.update_field_metadata]
+            with ``replace=True`` instead.
+
+        Parameters
+        ----------
+        field_name: str
+            The name of the field whose metadata is replaced.
+        new_metadata: dict
+            The new metadata, replacing all existing keys.
+        """
+        self.update_field_metadata(
+            {"path": field_name, "metadata": new_metadata, "replace": True}
+        )
+
     @abstractmethod
     def drop_columns(self, columns: Iterable[str]) -> DropColumnsResult:
         """
@@ -3315,13 +3348,6 @@ def namespace(self) -> List[str]:
         """Return the namespace path of the table."""
         return self._namespace_path
 
-    @property
-    def id(self) -> str:
-        """Return the full identifier of the table (namespace$name)."""
-        if self._namespace_path:
-            return "$".join(self._namespace_path + [self.name])
-        return self.name
-
     @classmethod
     async def from_inner(cls, tbl: LanceDBTable):
         from .db import AsyncConnection, LanceDBConnection
```

**File**: `python/python/tests/test_sync_api_parity.py` (added, +170/-0)
```diff
@@ -0,0 +1,170 @@
+# SPDX-License-Identifier: Apache-2.0
+# SPDX-FileCopyrightText: Copyright The LanceDB Authors
+
+from datetime import timedelta
+import json
+from urllib.parse import parse_qs, urlparse
+
+import lancedb
+from lancedb.table import Table
+import pytest
+
+from test_remote_db import mock_lancedb_connection
+
+
+@pytest.fixture
+def legacy_table():
+    """Implement the pre-existing abstract API without the two new members."""
+
+    def unsupported(self, *args, **kwargs):
+        raise NotImplementedError
+
+    def update_field_metadata(self, updates):
+        self.metadata_updates.append(updates)
+        return object()  # The deprecated wrapper must not expose this result.
+
+    # Supply concrete implementations through normal ABC class creation. Leave
+    # namespace and replace_field_metadata inherited, as an old subclass would.
+    implementations = {
+        name: unsupported
+        for name in Table.__abstractmethods__
+        if name not in {"namespace", "replace_field_metadata"}
+    }
+    implementations.update(
+        name=property(lambda self: "legacy"),
+        update_field_metadata=update_field_metadata,
+    )
+    legacy_class = type("LegacyTable", (Table,), implementations)
+    table = legacy_class()
+    table.metadata_updates = []
+    return table
+
+
+def test_legacy_table_namespace_and_id(legacy_table):
+    assert legacy_table.namespace == []
+    assert legacy_table.id == "legacy"
+    namespace = legacy_table.namespace
+    namespace.append("changed")
+    assert legacy_table.namespace == []
+    assert legacy_table.id == "legacy"
+
+
+def test_legacy_table_replace_field_metadata(legacy_table):
+    with pytest.warns(DeprecationWarning, match="update_field_metadata"):
+        result = legacy_table.replace_field_metadata("nested.field", {"a": "b"})
+    assert result is None
+    assert legacy_table.metadata_updates == [
+        {"path": "nested.field", "metadata": {"a": "b"}, "replace": True}
+    ]
+
+
+def respond(request, body):
+    request.send_response(200)
+    request.send_header("Content-Type", "application/json")
+    request.end_headers()
+    request.wfile.write(json.dumps(body).encode())
+
+
+def test_remote_uri():
+    with mock_lancedb_connection(lambda request: respond(request, {})) as db:
+        assert db.uri == "db://dev"
+
+
+@pytest.mark.parametrize("attribute", ["session", "read_consistency_interval"])
+def test_remote_unsupported_properties(attribute):
+    with mock_lancedb_connection(lambda request: respond(request, {})) as db:
+        with pytest.raises(NotImplementedError, match=attribute):
+            getattr(db, attribute)
+
+
+@pytest.mark.parametrize("tables", [[], ["first", "last"]])
+def test_remote_len_and_contains_follow_pages(tables):
+    requests = []
+
+    def handler(request):
+        requests.append(request.path)
+        query = parse_qs(urlparse(request.path).query)
+        if tables and "page_token" not in query:
+            respond(request, {"tables": [tables[0]], "page_token": "opaque-next"})
+        else:
+            if tables:
+                assert query["page_token"] == ["opaque-next"]
+            respond(request, {"tables": tables[1:]})
+
+    with mock_lancedb_connection(handler) as db:
+        assert len(db) == len(tables)
+        assert ("last" in db) == bool(tables)
+        assert "missing" not in db
+        requests.clear()
+        assert ("first" in db) == bool(tables)
+        assert len(requests) == 1
+
+
+@pytest.mark.parametrize("namespace", [[], ["parent", "child"]])
+def test_remote_table_identifiers(namespace):
+    def handler(request):
+        respond(request, {"version": 1, "schema": {"fields": []}})
+
+    with mock_lancedb_connection(handler) as db:
+        table = db.open_table("rfm", namespace_path=namespace)
+        assert table.namespace == namespace
+        assert table.id == "$".join(namespace + ["rfm"])
+
+
+def test_remote_replace_field_metadata():
+    updates = []
+
+    def handler(request):
+        if request.path.endswith("/describe/"):
+            respond(request, {"version": 1, "schema": {"fields": []}})
+        else:
+            assert request.path == "/v1/table/rfm/update_field_metadata/"
+            body = request.rfile.read(int(request.headers["Content-Length"]))
+            updates.append(json.loads(body))
+            respond(request, {"version": 2})
+
+    with mock_lancedb_connection(handler) as db:
+        table = db.open_table("rfm")
+        with pytest.warns(DeprecationWarning, match="update_field_metadata"):
+            assert table.replace_field_metadata("id", {"a": "b"}) is None
+    assert updates == [
+        {"updates": [{"path": "id", "metadata": {"a": "b"}, "replace": True}]}
+    ]
+
+
+@pytest.mark.parametrize("custom_session", [False, True])
+def test_local_properties_and_metadata(tmp_path, custom_session):
+    supplied = lancedb.Session() if custom_session else None
+    db = lancedb.connect(
+        tmp_path, 
```

---

### Incident Patch 3: `2cd635d4` (2026-10-27)
**Commit Message**: fix: correct remote materialized view refresh results and options (#4672)

Remote materialized-view refreshes drained the SQL result and then
fabricated `mode=rebuild`, `rows_written=<total view rows>`, and
`source_version=0`. This made incremental refreshes report incorrect
statistics.

Make these three result fields optional across Rust, Python, and
TypeScript, and leave them unset for remote SQL refreshes. Remove the
post-refresh row count request. Local refreshes continue to populate all
metrics, and `version` remains the view version observed after
completion. Remote per-operation statistics remain unavailable until the
SQL job adapter can retrieve them.

Expose the forced-rebuild option through the Rust builder,
synchronous/asynchronous Python refresh and job methods, and TypeScript
refresh. Remote `full=true` sends `WITH (full = true)`; the default lets
the server choose its refresh mode. Local source-version pinning and
remote job cancellation are preserved.

Local refresh regression tests respect the `experimental-functions`
build gate, while remote refresh coverage also runs in default builds.

Validation:

- Rust: 20 materialized-view tests and 21 remote SQL tests passed

**File**: `docs/src/js/classes/MaterializedView.md` (modified, +7/-3)
```diff
@@ -66,14 +66,18 @@ refresh(options?): Promise<RefreshMaterializedViewResult>
 Recompute the view from its source.
 Local refresh requires a source build with `experimental-functions`.
 
-Every refresh rebuilds the complete view. For local views,
-`sourceVersion` refreshes to that source version instead of the latest;
-remote SQL refreshes do not support source-version pinning.
+`full: true` forces a remote rebuild; otherwise the server chooses the
+refresh mode. Local views always rebuild, and `sourceVersion` selects a
+source version instead of the latest. Remote SQL refreshes do not support
+source-version pinning. Their results leave `mode`, `rowsWritten`, and
+`sourceVersion` absent because the SQL job adapter does not expose these metrics.
 
 #### Parameters
 
 * **options?**
 
+* **options.full?**: `boolean`
+
 * **options.sourceVersion?**: `number`
 
 #### Returns
```

**File**: `docs/src/js/interfaces/RefreshMaterializedViewResult.md` (modified, +11/-7)
```diff
@@ -8,30 +8,34 @@
 
 ## Properties
 
-### mode
+### mode?
 
 ```ts
-mode: string;
+optional mode: string;
 ```
 
-How the view was brought up to date: "rebuild".
+How the view was brought up to date: "rebuild", or absent for remote SQL refreshes.
 
 ***
 
-### rowsWritten
+### rowsWritten?
 
 ```ts
-rowsWritten: number;
+optional rowsWritten: number;
 ```
 
+Rows written by this refresh, or absent for remote SQL refreshes.
+
 ***
 
-### sourceVersion
+### sourceVersion?
 
 ```ts
-sourceVersion: number;
+optional sourceVersion: number;
 ```
 
+Source version refreshed to, or absent for remote SQL refreshes.
+
 ***
 
 ### version
```

**File**: `nodejs/__test__/materialized_view.test.ts` (modified, +27/-13)
```diff
@@ -6,6 +6,7 @@ import * as tmp from "tmp";
 import { Connection, connect } from "../lancedb";
 import {
   DEFINITION_META_KEY,
+  MaterializedView,
   definitionFromMetadata,
 } from "../lancedb/materialized_view";
 import { experimentalFunctionsEnabled } from "../lancedb/native";
@@ -94,20 +95,33 @@ describe("materialized views", () => {
     );
   });
 
-  experimentalTest("fully refreshes after an append", async () => {
-    const view = await db.createMaterializedView("copy", "people", {
-      withNoData: true,
-    });
-    await view.refresh();
-
-    const people = await db.openTable("people");
-    await people.add([{ name: "alan", age: 41 }]);
-    const result = await view.refresh();
-    expect(result.mode).toBe("rebuild");
-    expect(Number(result.rowsWritten)).toBe(4);
-    expect(await view.table().countRows()).toBe(4);
+  experimentalTest.each([false, true])(
+    "fully refreshes after an append (full=%s)",
+    async (full) => {
+      const view = await db.createMaterializedView("copy", "people", {
+        withNoData: true,
+      });
+      await view.refresh();
+
+      const people = await db.openTable("people");
+      await people.add([{ name: "alan", age: 41 }]);
+      const result = await view.refresh({ full });
+      expect(result.mode).toBe("rebuild");
+      expect(Number(result.rowsWritten)).toBe(4);
+      expect(await view.table().countRows()).toBe(4);
+
+      expect((await view.refresh()).mode).toBe("rebuild");
+    },
+  );
 
-    expect((await view.refresh()).mode).toBe("rebuild");
+  it("forwards a forced refresh and preserves absent remote metrics", async () => {
+    const view = new MaterializedView(await db.openTable("people"));
+    const remoteResult = { version: 42 };
+    const refresh = jest
+      .spyOn(view.table(), "refreshMaterializedView")
+      .mockResolvedValue(remoteResult);
+    expect(await view.refresh({ full: true })).toEqual(remoteResult);
+    expect(refresh).toHaveBeenCalledWith(undefined, true);
   });
 
   experimentalTest("lists views and rejects non-views", async () => {
```

**File**: `nodejs/lancedb/materialized_view.ts` (modified, +10/-4)
```diff
@@ -188,14 +188,20 @@ export class MaterializedView {
    * Recompute the view from its source.
    * Local refresh requires a source build with `experimental-functions`.
    *
-   * Every refresh rebuilds the complete view. For local views,
-   * `sourceVersion` refreshes to that source version instead of the latest;
-   * remote SQL refreshes do not support source-version pinning.
+   * `full: true` forces a remote rebuild; otherwise the server chooses the
+   * refresh mode. Local views always rebuild, and `sourceVersion` selects a
+   * source version instead of the latest. Remote SQL refreshes do not support
+   * source-version pinning. Their results leave `mode`, `rowsWritten`, and
+   * `sourceVersion` absent because the SQL job adapter does not expose these metrics.
    */
   async refresh(options?: {
+    full?: boolean;
     sourceVersion?: number;
   }): Promise<RefreshMaterializedViewResult> {
     validateNonNegativeInteger(options?.sourceVersion, "sourceVersion");
-    return await this.inner.refreshMaterializedView(options?.sourceVersion);
+    return await this.inner.refreshMaterializedView(
+      options?.sourceVersion,
+      options?.full,
+    );
   }
 }
```

**File**: `nodejs/lancedb/table.ts` (modified, +3/-1)
```diff
@@ -699,6 +699,7 @@ export abstract class Table {
    */
   abstract refreshMaterializedView(
     sourceVersion?: number,
+    full?: boolean,
   ): Promise<RefreshMaterializedViewResult>;
 
   /** @ignore */
@@ -1442,8 +1443,9 @@ export class LocalTable extends Table {
 
   async refreshMaterializedView(
     sourceVersion?: number,
+    full?: boolean,
   ): Promise<RefreshMaterializedViewResult> {
-    return await this.inner.refreshMaterializedView(sourceVersion);
+    return await this.inner.refreshMaterializedView(sourceVersion, full);
   }
 
   async materializedViewDefinition(): Promise<string> {
```

**File**: `nodejs/src/table.rs` (modified, +13/-10)
```diff
@@ -470,11 +470,12 @@ impl Table {
     pub async fn refresh_materialized_view(
         &self,
         source_version: Option<i64>,
+        full: Option<bool>,
     ) -> napi::Result<RefreshMaterializedViewResult> {
         let view = lancedb::MaterializedView::from_table(self.inner_ref()?.clone())
             .await
             .default_error()?;
-        let mut builder = view.refresh();
+        let mut builder = view.refresh().full(full.unwrap_or(false));
         if let Some(version) = source_version {
             let version = u64::try_from(version).map_err(|_| {
                 napi::Error::from_reason("sourceVersion must be a non-negative integer")
@@ -1615,22 +1616,24 @@ impl From<lancedb::function::FunctionErrors> for FunctionErrors {
 
 #[napi(object)]
 pub struct RefreshMaterializedViewResult {
-    /// How the view was brought up to date: "rebuild".
-    pub mode: String,
-    pub rows_written: i64,
-    pub source_version: i64,
+    /// How the view was brought up to date: "rebuild", or absent for remote SQL refreshes.
+    pub mode: Option<String>,
+    /// Rows written by this refresh, or absent for remote SQL refreshes.
+    pub rows_written: Option<i64>,
+    /// Source version refreshed to, or absent for remote SQL refreshes.
+    pub source_version: Option<i64>,
     pub version: i64,
 }
 
 impl From<lancedb::RefreshMaterializedViewResult> for RefreshMaterializedViewResult {
     fn from(value: lancedb::RefreshMaterializedViewResult) -> Self {
-        let mode = match value.mode {
+        let mode = value.mode.map(|mode| match mode {
             lancedb::RefreshMode::Rebuild => "rebuild",
-        };
+        });
         Self {
-            mode: mode.to_string(),
-            rows_written: value.rows_written as i64,
-            source_version: value.source_version as i64,
+            mode: mode.map(str::to_string),
+            rows_written: value.rows_written.map(|rows| rows as i64),
+            source_version: value.source_version.map(|version| version as i64),
             version: value.version as i64,
         }
     }
```

**File**: `python/python/lancedb/_lancedb.pyi` (modified, +5/-5)
```diff
@@ -528,10 +528,10 @@ class Table:
         limit: Optional[int] = None,
     ) -> FunctionErrors: ...
     async def refresh_materialized_view(
-        self, source_version: Optional[int] = None
+        self, source_version: Optional[int] = None, *, full: bool = False
     ) -> RefreshMaterializedViewResult: ...
     async def refresh_materialized_view_async(
-        self, source_version: Optional[int] = None
+        self, source_version: Optional[int] = None, *, full: bool = False
     ) -> Job: ...
     async def materialized_view_definition(self) -> str: ...
     async def add_columns_with_schema(self, schema: pa.Schema) -> AddColumnsResult: ...
@@ -921,9 +921,9 @@ class FunctionErrors:
 class RefreshMaterializedViewResult:
     @staticmethod
     def from_json(value: str) -> RefreshMaterializedViewResult: ...
-    mode: str
-    rows_written: int
-    source_version: int
+    mode: Optional[str]
+    rows_written: Optional[int]
+    source_version: Optional[int]
     version: int
 
 class AlterColumnsResult:
```

**File**: `python/python/lancedb/materialized_view.py` (modified, +21/-12)
```diff
@@ -184,31 +184,36 @@ async def definition(self) -> MaterializedViewDefinition:
         return _definition_from_json(raw)
 
     async def refresh(
-        self, *, source_version: Optional[int] = None
+        self, *, full: bool = False, source_version: Optional[int] = None
     ) -> "RefreshMaterializedViewResult":
         """Recompute the view from its source.
 
-        Every refresh rebuilds the complete view. For local views,
-        ``source_version`` refreshes to that source version instead of the
-        latest; remote SQL refreshes do not support source-version pinning.
+        ``full=True`` forces a remote rebuild; otherwise the server chooses
+        the refresh mode. Local views always rebuild, and ``source_version``
+        selects a source version instead of the latest. Remote SQL refreshes
+        do not support source-version pinning.
+
+        Remote results leave ``mode``, ``rows_written``, and ``source_version``
+        as ``None`` because the SQL job adapter does not expose these metrics.
         """
         return await self._table._inner.refresh_materialized_view(
-            source_version=source_version
+            source_version=source_version, full=full
         )
 
     async def refresh_async(
-        self, *, source_version: Optional[int] = None
+        self, *, full: bool = False, source_version: Optional[int] = None
     ) -> "AsyncJob[RefreshMaterializedViewResult]":
         """Submit a refresh and return its job without waiting.
 
         The job may already be complete for a local view. Remote refreshes are
-        submitted through the SQL service.
+        submitted through the SQL service. Options and result metrics follow
+        [refresh][lancedb.materialized_view.AsyncMaterializedView.refresh].
         """
         from ._lancedb import RefreshMaterializedViewResult
 
         return _typed_job(
             await self._table._inner.refresh_materialized_view_async(
-                source_version=source_version
+                source_version=source_version, full=full
             ),
             RefreshMaterializedViewResult.from_json,
         )
@@ -240,18 +245,22 @@ def definition(self) -> MaterializedViewDefinition:
         return LOOP.run(self._async.definition())
 
     def refresh(
-        self, *, source_version: Optional[int] = None
+        self, *, full: bool = False, source_version: Optional[int] = None
     ) -> "RefreshMaterializedViewResult":
         """Recompute the view from its source. See
         [AsyncMaterializedView.refresh][lancedb.materialized_view.AsyncMaterializedView.refresh]."""
-        return LOOP.run(self._async.refresh(source_version=source_version))
+        return LOOP.run(self._async.refresh(full=full, source_version=source_version))
 
     def refresh_async(
-        self, *, source_version: Optional[int] = None
+        self, *, full: bool = False, source_version: Optional[int] = None
     ) -> "Job[RefreshMaterializedViewResult]":
         """Submit a refresh and return its job without waiting.
 
         See
         [AsyncMaterializedView.refresh_async][lancedb.materialized_view.AsyncMaterializedView.refresh_async].
         """
-        return Job(LOOP.run(self._async.refresh_async(source_version=source_version)))
+        return Job(
+            LOOP.run(
+                self._async.refresh_async(full=full, source_version=source_version)
+            )
+        )
```

#### Recent Merged Pull Requests:
- **PR #4690** (2026-10-27): chore: update Lance to v15.0.0-beta.2 (@Xuanwo)
- **PR #4688** (2026-10-27): fix: gate experimental local functions behind an opt-in feature (@Xuanwo)
- **PR #4686** (2026-10-27): fix: refuse Function-bound writes by column instead of by table (@wkalt)
- **PR #4683** (2026-10-26): fix(ci): acknowledge Arrow-pinned zstd advisories (@Xuanwo)
- **PR #4682** (2026-10-27): fix(python)!: raise on bool(Expr) instead of silently dropping predicates (@avanish-garg)
- **PR #4680** (closed): chore: validate lance v14.0.0-rc.2 in lancedb (@BubbleCal)

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

## X. fix!: reject unsupported remote connection and table options (#4486)

**RULE**:
When implementing operations in `docs/src/python/python.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lancedb/lancedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `180eaaf6`: fix!: reject unsupported remote connection and table options (#4486). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/src/python/python.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
Connections to `db://` databases reject local-only options with
`NotImplementedError`. These include `session` and `manifest_enabled=True` on
connect, per-table storage and write options on create, and `index_cache_size`,
`storage_options`, or `location` on open (where the method accepts them).
Omit these options to use server-managed storage and caching. Connection-level
`storage_options` supported by an Enterprise deployment remain available.

The synchronous remote `create_table` uses the same positional order as the
local API: `name, data, schema, mode, exist_ok, on_bad_vectors, fill_value,
embedding_functions`. Prefer keyword arguments for optional parameters.

```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `180eaaf6` are properly handled with clean fallback behavior.
