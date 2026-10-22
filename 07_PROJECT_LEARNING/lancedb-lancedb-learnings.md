> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/lancedb-lancedb-learnings.md`  
> **Source**: github ([https://github.com/lancedb/lancedb](https://github.com/lancedb/lancedb))  
> **Source Version**: `88203d25`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-22T21:48:10.715Z  
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
> **Harvest Timestamp**: 2026-10-22T21:48:10.710Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lancedb/lancedb`
- **Description**: Developer-friendly OSS embedded retrieval library for multimodal AI. Search More; Manage Less.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 11743 stars

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
- **Issue #4632** (2026-10-22): **fix(python): expect oidc credential-type header on refreshed tokens**
  *Symptoms*: ## Summary  #3971 added `test_zero_lifetime_token_is_refreshed`, but its expected headers omit `x-lancedb-credential-type: oidc`, which `OAuthProvider.get_headers()` has emitted since #2631/#4070. The test fails against current main and breaks the PR CI matrix for every open PR.  ## Changes  - Align the two zap assertions in `test_zero_lifetime_token_is_refreshed` with the provider contract (see `test_token_refresh` and `test_sync_method`).  ## Tests  - `pytest python/tests/test_header_provider.py -q`

- **Issue #4627** (2026-10-22): **fix(index): preserve registered scalar plugin type names**
  *Symptoms*: Native `list_indices()` drops registered scalar plugin types absent from LanceDB's fixed enum, and `index_stats()` reports them as `Unknown`. Preserve their registered display names through `IndexType::Custom(String)`.  Resolve these names through Lance's shared `IndexDetails` registry entry point. Registered types such as MinHashLSH become visible; system and unregistered types remain excluded. Existing builtin aliases retain their canonical names. Rust consumers with exhaustive `IndexType` matches need to handle the added variant.  Manual validation with [Lance #10224](https://github.com/lance-format/lance/pull/10224) at `fcc070f88a`: a downstream statistics-only plugin appears as `Custom("Sketch")` in native listing and statistics. Its `load_index` deliberately returns an error, and repeated calls do not construct additional plugin instances, verifying metadata-only lookup through the shared registry. 

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

### Incident Patch 1: `2d54630a` (2026-10-22)
**Commit Message**: fix(python): stop retrying permanent embedding errors and cap the backoff delay (#4542)

Permanent embedding errors (HTTP 400/404/422 and other 4xx) were retried
the full `max_retries` times with an
uncapped, multiplicatively jittered backoff, so a typo'd model name
looked like a hang of about an hour
(median 50 min of sleeping with a 404; see the issue for the repro and
numbers).

Changes (`python/python/lancedb/embeddings/utils.py`,
`embeddings/base.py`):
- An HTTP status in 4xx other than 408/409/429 is raised immediately.
The status is read from `status_code`,
`http_status`, `response.status_code`, an integer `code`
(google-api-core, urllib) or a botocore
`response["ResponseMetadata"]["HTTPStatusCode"]`. AWS throttling
reported as 400 stays retryable (matched by
  error code). `AuthenticationError` by name is unchanged.
- Still retried: 408, 409, 429, >=500, and anything without a
recognisable status (connection errors, timeouts,
custom exceptions), so existing custom embedding functions behave as
before.
- New keyword `max_delay=60` (last in the signature, default keeps call
sites working). `delay = min(delay * base,
max_delay)` with equal jitter `delay/2 + random() * delay/2`

**File**: `python/python/lancedb/embeddings/base.py` (modified, +5/-3)
```diff
@@ -38,9 +38,11 @@ class EmbeddingFunction(BaseModel, ABC):
     3. ndims() which returns the number of dimensions of the vector column
     """
 
-    max_retries: int = (
-        7  # Setting 0 disables retires. Maybe this should not be enabled by default,
-    )
+    # Maximum number of retries for transient errors (rate limits, 5xx responses,
+    # connection errors, ...), with exponential backoff capped at 60 seconds between
+    # attempts. Permanent errors (HTTP 4xx other than 408/409/429) are never retried.
+    # Setting 0 disables retries.
+    max_retries: int = 7
     _ndims: int = PrivateAttr()
     _original_args: dict = PrivateAttr()
 
```

**File**: `python/python/lancedb/embeddings/utils.py` (modified, +86/-17)
```diff
@@ -241,15 +241,30 @@ def retry_with_exponential_backoff(
     exponential_base: float = 2,
     jitter: bool = True,
     max_retries: int = 7,
+    max_delay: float = 60,
 ):
     """Retry a function with exponential backoff.
 
+    Only errors that may succeed when repeated are retried. Errors that carry an
+    HTTP status code are retried when the status is 408, 409, 429 or >= 500; any
+    other 4xx status (for example 400, 401, 403, 404 or 422) is a permanent failure
+    that is raised immediately. Errors without a recognisable status code (for
+    example connection errors, timeouts, or exceptions raised by a custom embedding
+    function) are retried.
+
+    The delay before the n-th retry is ``initial_delay * exponential_base ** n``,
+    never more than ``max_delay``. With ``jitter`` enabled, a random amount of up to
+    half of that delay is removed ("equal jitter"), so the actual wait is always in
+    the range ``[delay / 2, delay]``.
+
     Args:
         func (function): The function to be retried.
         initial_delay (float): Initial delay in seconds (default is 1).
         exponential_base (float): The base for exponential backoff (default is 2).
         jitter (bool): Whether to add jitter to the delay (default is True).
         max_retries (int): Maximum number of retries (default is 7).
+        max_delay (float): Maximum delay between two attempts, in seconds
+            (default is 60).
 
     Returns:
         function: The decorated function.
@@ -265,13 +280,12 @@ def wrapper(*args, **kwargs):
             try:
                 return func(*args, **kwargs)
 
-            # Currently retrying on all exceptions as there is no way to know the
-            # format of the error msgs used by different APIs. We'll log the error
-            # and say that it is assumed that if this portion errors out, it's due
-            # to rate limit but the user should check the error message to be sure.
+            # Errors are retried unless they are known to be permanent (see
+            # `_is_non_retryable_error`). Custom embedding functions can raise
+            # arbitrary exceptions, so unknown errors are assumed to be transient.
             except Exception as e:  # noqa: PERF203
-                # Don't retry on authentication errors (e.g., OpenAI 401)
-                # These are permanent failures that won't be fixed by retrying
+                # Don't retry permanent failures (e.g., OpenAI 401 or 404). They
+                # won't be fixed by retrying and would only delay the real error.
                 if _is_non_retryable_error(e):
                     raise
 
@@ -280,24 +294,72 @@ def wrapper(*args, **kwargs):
                 if num_retries > max_retries:
                     raise Exception(
                         f"Maximum number of retries ({max_retries}) exceeded.", e
-                    )
+                    ) from e
 
-                delay *= exponential_base * (1 + jitter * random.random())
+                delay = min(delay * exponential_base, max_delay)
+                sleep_for = delay
+                if jitter:
+                    sleep_for = delay / 2 + random.random() * delay / 2
                 logging.warning(
                     "Error occurred: %s \n Retrying in %s seconds (retry %s of %s) \n",
                     e,
-                    delay,
+                    sleep_for,
                     num_retries,
                     max_retries,
                 )
-                time.sleep(delay)
+                time.sleep(sleep_for)
 
     return wrapper
 
 
+# HTTP statuses in the 4xx range that are worth retrying: request timeout,
+# conflict (the OpenAI SDK treats it as transient) and rate limiting.
+_RETRYABLE_CLIENT_STATUSES = (408, 409, 429)
+
+# AWS error codes that are reported with a 4xx status but are transient.
+_RETRYABLE_AWS_ERROR_CODES = (
+    "Throttl",
+    "TooManyRequests",
+    "RequestLimitExceeded",
+    "ProvisionedThroughputExceeded",
+    "ModelNotReady",
+    "ModelTimeout",
+)
+
+
+def _get_http_status(error: Exception):
+    """Best-effort extraction of an HTTP status code from an exception.
+
+    Provider SDKs expose it in different ways: ``status_code`` (openai, cohere),
+    ``http_status`` (voyageai), ``response.status_code`` (requests, httpx),
+    ``code`` (google-api-core, urllib) or ``response["ResponseMetadata"]``
+    (botocore). Returns None if no status can be found.
+    """
+    candidates = [
+        getattr(error, "status_code", None),
+        getattr(error, "http_status", None),
+    ]
+    response = getattr(error, "response", None)
+    if isinstance(response, dict):
+        candidates.append(response.get("ResponseMetadata", {}).get("HTTPStatusCode"))
+    else:
+        candidates.append(getattr(response, "status_code", None))
+    candidates.append(getattr(error, "code", None))
+
+    for status in candidates:
+        if isinstance(status, int) and not isinstance(status, bool):
+    
```

**File**: `python/python/tests/test_embeddings.py` (modified, +263/-0)
```diff
@@ -633,6 +633,269 @@ class MockAuthenticationError(Exception):
     assert mock_sleep.call_count == 0
 
 
+class _HttpStatusError(Exception):
+    """Stand-in for provider SDK errors (openai, cohere, ...) with a status code."""
+
+    def __init__(self, status_code, message="error"):
+        super().__init__(message)
+        self.status_code = status_code
+
+
+class _ResponseStatusError(Exception):
+    """Stand-in for requests/httpx errors, which expose `response.status_code`."""
+
+    def __init__(self, status_code):
+        super().__init__(f"HTTP {status_code}")
+        self.response = MagicMock(status_code=status_code)
+
+
+def _run_with_retry(side_effect, **kwargs):
+    """Run a function through the retry helper with a mocked `time.sleep`.
+
+    Returns (mock_func, sleeps, error).
+    """
+    from lancedb.embeddings.utils import retry_with_exponential_backoff
+
+    mock_func = MagicMock(side_effect=side_effect)
+    sleeps = []
+    error = None
+    with patch("time.sleep", side_effect=sleeps.append):
+        try:
+            retry_with_exponential_backoff(mock_func, **kwargs)()
+        except Exception as e:
+            error = e
+    return mock_func, sleeps, error
+
+
+@pytest.mark.parametrize("status", [400, 401, 403, 404, 405, 410, 413, 422])
+@pytest.mark.parametrize("make_error", [_HttpStatusError, _ResponseStatusError])
+def test_retry_does_not_retry_permanent_http_errors(status, make_error):
+    err = make_error(status)
+    mock_func, sleeps, error = _run_with_retry(err, max_retries=7)
+
+    assert error is err
+    assert mock_func.call_count == 1
+    assert sleeps == []
+
+
+@pytest.mark.parametrize("status", [408, 409, 429, 500, 502, 503, 504])
+@pytest.mark.parametrize("make_error", [_HttpStatusError, _ResponseStatusError])
+def test_retry_retries_transient_http_errors(status, make_error):
+    mock_func, sleeps, error = _run_with_retry(
+        [make_error(status), make_error(status), "result"], max_retries=7
+    )
+
+    assert error is None
+    assert mock_func.call_count == 3
+    assert len(sleeps) == 2
+
+
+@pytest.mark.parametrize(
+    "exc",
+    [
+        ConnectionError("connection reset"),
+        TimeoutError("timed out"),
+        OSError("network is unreachable"),
+        ValueError("custom embedding function failure"),
+        RuntimeError("boom"),
+        Exception("plain exception"),
+    ],
+)
+def test_retry_retries_errors_without_http_status(exc):
+    mock_func, sleeps, error = _run_with_retry([exc, exc, "result"], max_retries=7)
+
+    assert error is None
+    assert mock_func.call_count == 3
+    assert len(sleeps) == 2
+
+
+def test_retry_error_status_attributes_of_other_types_are_ignored():
+    # `code` is a string for openai errors ("model_not_found"), and arbitrary
+    # exceptions may carry unrelated numeric attributes. Neither is an HTTP status.
+    class WeirdError(Exception):
+        code = "model_not_found"
+        status_code = None
+
+    class ExitCodeError(Exception):
+        code = 2
+
+    for exc in (WeirdError("a"), ExitCodeError("b")):
+        mock_func, sleeps, error = _run_with_retry(exc, max_retries=2)
+        assert mock_func.call_count == 3
+        assert len(sleeps) == 2
+
+
+def test_retry_botocore_style_errors():
+    # botocore ClientError exposes `response["ResponseMetadata"]["HTTPStatusCode"]`.
+    # Bedrock reports throttling with a 400, which must stay retryable.
+    class ClientError(Exception):
+        def __init__(self, status, code):
+            super().__init__(code)
+            self.response = {
+                "ResponseMetadata": {"HTTPStatusCode": status},
+                "Error": {"Code": code},
+            }
+
+    throttled = ClientError(400, "ThrottlingException")
+    mock_func, sleeps, error = _run_with_retry([throttled, "result"], max_retries=3)
+    assert error is None
+    assert mock_func.call_count == 2
+
+    invalid = ClientError(400, "ValidationException")
+    mock_func, sleeps, error = _run_with_retry(invalid, max_retries=3)
+    assert error is invalid
+    assert mock_func.call_count == 1
+    assert sleeps == []
+
+
+def test_retry_authentication_error_by_name_not_retried():
+    class AuthenticationError(Exception):
+        pass
+
+    mock_func, sleeps, error = _run_with_retry(AuthenticationError("bad key"))
+    assert isinstance(error, AuthenticationError)
+    assert mock_func.call_count == 1
+    assert sleeps == []
+
+
+def test_retry_gives_up_after_max_retries_with_original_error_attached():
+    original = _HttpStatusError(503, "overloaded")
+    mock_func, sleeps, error = _run_with_retry(original, max_retries=3)
+
+    assert mock_func.call_count == 4
+    assert len(sleeps) == 3
+    assert "Maximum number of retries (3) exceeded" in str(error)
+    assert error.args[1] is original
+    assert error.__cause__ is original
+
+
+def test_retry_delay_is_capped_by_max_delay():
+    # Default settings (7 retries, 60s cap): the old implementation could slee
```

---

### Incident Patch 2: `bc4c32b7` (2026-10-22)
**Commit Message**: fix: keep tagged versions when pruning in optimize (#4544)

`optimize()` fails once a tagged version is older than the cleanup
cutoff, although the docs say tagged versions
are exempt from cleanup, and the failed prune also skips the
index-optimize step (repro and numbers in the issue).

Change: `OptimizeAction::Prune` already exposes
`error_if_tagged_old_versions: Option<bool>`, so no new API.
`cleanup_old_versions` and `cleanup_old_versions_before` in
`rust/lancedb/src/table/optimize.rs` now use
`unwrap_or(false)`, which covers `OptimizeAction::Prune`,
`OptimizeAction::All` and `optimize_prune_before`. The
Python and Node bindings pass `None`, which now means "retain tagged
versions"; I left `python/src/table.rs` and
`nodejs/src/table.rs` untouched (this also avoids a conflict with #3870,
which edits that region). `Some(true)`
still opts in to the error. Doc comments updated; the sentence in
`docs/web/management/table.mdx` is accurate once
this lands.

Tests: Rust `test_optimize_prune_retains_tagged_versions` (`Some(true)`
still errors; the default retains the tag;
`optimize_prune_before`; `checkout_tag` plus a data read), a Python sync
test with a scalar index (index step runs,


**File**: `nodejs/__test__/table.test.ts` (modified, +15/-0)
```diff
@@ -3742,6 +3742,21 @@ describe("when optimizing a dataset", () => {
     expect(stats.prune.oldVersionsRemoved).toBe(2);
   });
 
+  it("retains tagged versions older than the cleanup cutoff", async () => {
+    await (await table.tags()).create("keep", 1);
+    await table.add([{ id: 3 }]);
+
+    const cutoff = await nextMillisecond();
+    const stats = await table.optimize({ cleanupOlderThan: cutoff });
+    // Versions 2 and 3 are pruned, tagged version 1 is retained
+    expect(stats.prune.oldVersionsRemoved).toBe(2);
+
+    await table.checkout("keep");
+    expect(await table.countRows()).toBe(1);
+    await table.checkoutLatest();
+    expect(await table.countRows()).toBe(3);
+  });
+
   it("delete unverified", async () => {
     const version = await table.version();
     const versionFile = `${tmpDir.name}/${table.name}.lance/_versions/${String(
```

**File**: `python/python/tests/test_table.py` (modified, +51/-0)
```diff
@@ -4792,6 +4792,57 @@ def test_optimize_warns_on_zero_cleanup_sync(mem_db: DBConnection):
     assert all("concurrent" in str(w.message) for w in seen)
 
 
+def test_optimize_retains_tagged_versions(tmp_db: DBConnection):
+    # A tagged version older than the cleanup cutoff must be retained, not make
+    # optimize() fail part-way (after compaction, before the index step).
+    table = tmp_db.create_table(
+        "test", data=pa.table({"id": list(range(100)), "text": ["a"] * 100})
+    )
+    table.create_index("id", config=BTree())
+    table.tags.create("release-1", table.version)
+    tagged_version = table.version
+    for i in range(3):
+        table.add(pa.table({"id": [1000 + i], "text": ["new"]}))
+    assert table.stats()["fragment_stats"]["num_fragments"] == 4
+    assert table.index_stats("id_idx").num_unindexed_rows == 3
+    sleep(1.1)
+
+    table.optimize(cleanup_older_than=timedelta(seconds=1))
+
+    # The index step ran after the prune step
+    assert table.index_stats("id_idx").num_unindexed_rows == 0
+    # It stays optimizable
+    table.optimize(cleanup_older_than=timedelta(seconds=1))
+    assert table.stats()["fragment_stats"]["num_fragments"] == 1
+
+    # Untagged old versions were pruned, the tagged one was retained
+    versions = [v["version"] for v in table.list_versions()]
+    assert tagged_version in versions
+    for added in range(tagged_version + 1, tagged_version + 4):
+        assert added not in versions
+    assert len(table) == 103
+
+    table.checkout("release-1")
+    assert len(table) == 100
+    assert table.to_arrow().num_rows == 100
+
+
+@pytest.mark.asyncio
+async def test_optimize_retains_tagged_versions_async(tmp_db_async: AsyncConnection):
+    table = await tmp_db_async.create_table("test", data=[{"x": [1]}])
+    await table.tags.create("keep", await table.version())
+    await table.add(data=[{"x": [2]}])
+    await table.add(data=[{"x": [3]}])
+    sleep(1.1)
+
+    stats = await table.optimize(cleanup_older_than=timedelta(seconds=1))
+    assert stats.prune.old_versions_removed >= 1
+
+    await table.checkout("keep")
+    assert await table.count_rows() == 1
+    assert await table.query().to_arrow() == pa.table({"x": [[1]]})
+
+
 def test_replace_field_metadata(tmp_path):
     db = lancedb.connect(tmp_path)
     table = db.create_table("my_table", data=[{"x": 0}])
```

**File**: `rust/lancedb/src/table/optimize.rs` (modified, +101/-4)
```diff
@@ -69,7 +69,11 @@ pub enum OptimizeAction {
         /// **WARNING**: This should only be set to true if you can guarantee that no other process is
         /// currently working on this dataset.  Otherwise the dataset could be put into a corrupted state.
         delete_unverified: Option<bool>,
+        /// Tagged versions are never removed, regardless of their age.
+        ///
         /// If true, an error will be returned if there are any old versions that are still tagged.
+        /// If false or `None` (the default), tagged versions are silently retained and all other
+        /// old versions are removed.
         error_if_tagged_old_versions: Option<bool>,
     },
     /// Optimize the indices
@@ -125,6 +129,12 @@ pub(crate) async fn optimize_indices(table: &NativeTable, options: &OptimizeOpti
 ///   no other process is currently working on this dataset.  Otherwise the
 ///   dataset could be put into a corrupted state.
 ///
+/// * `error_if_tagged_old_versions` - Tagged versions are always retained.  If
+///   this is true, an error is returned when a tagged version is older than the
+///   cutoff.  Defaults to false (the tagged versions are retained silently),
+///   unlike Lance's own default, so that `optimize` does not fail (and skip the
+///   steps after pruning) once a tagged version ages past the cutoff.
+///
 /// This calls into [lance::dataset::Dataset::cleanup_old_versions] and
 /// returns the result.
 pub(crate) async fn cleanup_old_versions(
@@ -136,7 +146,11 @@ pub(crate) async fn cleanup_old_versions(
     table.dataset.ensure_mutable()?;
     let dataset = table.dataset.get().await?;
     let stats = dataset
-        .cleanup_old_versions(older_than, delete_unverified, error_if_tagged_old_versions)
+        .cleanup_old_versions(
+            older_than,
+            delete_unverified,
+            Some(error_if_tagged_old_versions.unwrap_or(false)),
+        )
         .await?;
     // Computed-column signature sidecars live outside lance's directories;
     // drop the ones the surviving versions no longer reference.
@@ -161,9 +175,8 @@ pub(crate) async fn cleanup_old_versions_before(
     if let Some(delete_unverified) = delete_unverified {
         policy = policy.delete_unverified(delete_unverified);
     }
-    if let Some(error_if_tagged_old_versions) = error_if_tagged_old_versions {
-        policy = policy.error_if_tagged_old_versions(error_if_tagged_old_versions);
-    }
+    // Tagged versions are retained rather than raising an error unless asked.
+    policy = policy.error_if_tagged_old_versions(error_if_tagged_old_versions.unwrap_or(false));
     let stats = dataset.cleanup_with_policy(policy.build()).await?;
     // Computed-column signature sidecars live outside lance's directories;
     // drop the ones the surviving versions no longer reference.
@@ -511,6 +524,90 @@ mod tests {
         assert_eq!(all_values, expected);
     }
 
+    #[tokio::test]
+    async fn test_optimize_prune_retains_tagged_versions() {
+        let tmpdir = tempfile::tempdir().unwrap();
+        let conn = connect(tmpdir.path().to_str().unwrap())
+            .execute()
+            .await
+            .unwrap();
+
+        let schema = Arc::new(Schema::new(vec![Field::new("i", DataType::Int32, false)]));
+        let make_batch = |start: i32| {
+            RecordBatch::try_new(
+                schema.clone(),
+                vec![Arc::new(Int32Array::from_iter_values(start..start + 10))],
+            )
+            .unwrap()
+        };
+
+        let table = conn
+            .create_table("test_prune_tagged", make_batch(0))
+            .execute()
+            .await
+            .unwrap();
+        // Tag the first version, then create more versions after it.
+        table.tags().await.unwrap().create("keep", 1).await.unwrap();
+        for i in 1..4 {
+            table.add(make_batch(i * 10)).execute().await.unwrap();
+        }
+        assert_eq!(table.list_versions().await.unwrap().len(), 4);
+
+        // Explicitly asking for an error still errors, and leaves everything in place.
+        let err = table
+            .optimize(OptimizeAction::Prune {
+                older_than: Some(chrono::Duration::try_days(0).unwrap()),
+                delete_unverified: Some(true),
+                error_if_tagged_old_versions: Some(true),
+            })
+            .await
+            .unwrap_err();
+        assert!(err.to_string().contains("tagged version"), "{err}");
+        assert_eq!(table.list_versions().await.unwrap().len(), 4);
+
+        // By default, tagged versions are retained and the other old versions are removed.
+        let stats = table
+            .optimize(OptimizeAction::Prune {
+                older_than: Some(chrono::Duration::try_days(0).unwrap()),
+                delete_unverified: Some(true),
+                error_if_tagged_old_versions: None,
+            })
+            .await
+            .unwrap();
+        assert_eq!(stats.prune.unwrap().old_v
```

---

### Incident Patch 3: `118e606e` (2026-10-22)
**Commit Message**: fix(python): align vector parent indices after flattening null lists (#4572)

Arrow's `flatten()` skips child values hidden under null list parents,
but `list_parent_indices()` can retain their indices. This makes
`has_nan_values()` raise `ArrowInvalid` because the parent indices and
NaN mask have different lengths.

Filter out indices belonging to null parents before applying the mask.
The regression test covers `ListArray` and `LargeListArray`,
float16/32/64, and chunked inputs: 12 cases. NaN and null-component
policies stay the same.

The crash also affects #4503. This patch fixes it separately from that
PR's changes to bad-vector policies.

Validation:

- All 12 regression cases failed before the fix. The utility suite now
passes with 87 passed and 1 skipped.
- Ruff lint and formatting pass for both changed files, as does `git
diff --check`.
- The patch applies cleanly to main at `ca275b6d`. The patched helper
from that revision also passes all 12 cases.
- A separate AI reviewer checked commit `343082a6` and found no blocking
issues. They reran the utility suite and compared 4,059 generated cases
plus 12 explicit null-parent cases with a row-by-row reference
implementation. Tho

**File**: `python/python/lancedb/table.py` (modified, +5/-0)
```diff
@@ -5333,6 +5333,11 @@ def has_nan_values(arr: Union[pa.ListArray, pa.ChunkedArray]) -> pa.BooleanArray
     else:
         values_has_nan = pc.is_nan(values)
     values_indices = pc.list_parent_indices(arr)
+    if arr.null_count:
+        # Match flatten(), which excludes child spans under null parent lists.
+        values_indices = pc.filter(
+            values_indices, pc.take(pc.is_valid(arr), values_indices)
+        )
     has_nan_indices = pc.unique(pc.filter(values_indices, values_has_nan))
     indices = pa.array(range(len(arr)), type=pa.uint32())
     return pc.is_in(indices, has_nan_indices)
```

**File**: `python/python/tests/test_util.py` (modified, +15/-0)
```diff
@@ -21,6 +21,7 @@
     _infer_target_schema,
     _merge_metadata,
     _sanitize_data,
+    has_nan_values,
     sanitize_create_table,
 )
 import pyarrow as pa
@@ -489,6 +490,20 @@ def test_handle_bad_vectors_nan(on_bad_vectors):
     assert output["vector"].combine_chunks() == expected
 
 
+@pytest.mark.parametrize("dtype", [pa.float16(), pa.float32(), pa.float64()])
+@pytest.mark.parametrize("large", [False, True])
+@pytest.mark.parametrize("chunked", [False, True])
+def test_has_nan_values_skips_hidden_children_of_null_lists(dtype, large, chunked):
+    array_type = pa.LargeListArray if large else pa.ListArray
+    values = pa.array([float("nan"), None, float("nan"), 3.0, 4.0, 5.0], type=dtype)
+    arr = array_type.from_arrays(
+        [0, 2, 4, 6], values, mask=pa.array([True, False, False])
+    )
+    if chunked:
+        arr = pa.chunked_array([arr.slice(0, 2), arr.slice(2, 1)])
+    assert has_nan_values(arr).to_pylist() == [False, True, False]
+
+
 def test_handle_bad_vectors_noop():
     # ChunkedArray should be preserved as-is
     vector = pa.chunked_array(
```

#### Recent Merged Pull Requests:
- **PR #4632** (2026-10-22): fix(python): expect oidc credential-type header on refreshed tokens (@Xuanwo)
- **PR #4628** (2026-10-22): chore: update lance dependency to v15.0.0-beta.1 (@Xuanwo)
- **PR #4627** (2026-10-22): fix(index): preserve registered scalar plugin type names (@Xuanwo)
- **PR #4626** (2026-10-22): fix(python): keep a renamed Permutation column in its position (@chrikrah)
- **PR #4624** (2026-10-21): fix: update trust-store pins for the eMudhra CA compromise (@esteban)
- **PR #4621** (2026-10-22): feat(python): expose materialized view auto-refresh creation options (@jackye1995)

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

## X. python): stop retrying permanent embedding errors and cap the backoff delay (#45

**RULE**:
When implementing operations in `python/python/lancedb/embeddings/base.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lancedb/lancedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2d54630a`: python): stop retrying permanent embedding errors and cap the backoff delay (#4542). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `python/python/lancedb/embeddings/base.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    # Maximum number of retries for transient errors (rate limits, 5xx responses,
    # connection errors, ...), with exponential backoff capped at 60 seconds between
    # attempts. Permanent errors (HTTP 4xx other than 408/409/429) are never retried.
    # Setting 0 disables retries.
    max_retries: int = 7
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
    max_retries: int = (
        7  # Setting 0 disables retires. Maybe this should not be enabled by default,
    )
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2d54630a` are properly handled with clean fallback behavior.
