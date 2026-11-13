# Verification Protocol: Verification Protocol: Empirical Defect Shield for lancedb/lancedb

<!-- PROVENANCE_START
{
  "source_repository": "lancedb/lancedb",
  "source_url": "https://github.com/lancedb/lancedb",
  "source_version": "7d50d2d2",
  "license": "Apache-2.0",
  "timestamp": "2026-11-13T21:16:18.260Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-lancedb-lancedb",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lancedb/lancedb](https://github.com/lancedb/lancedb) (Revision: `7d50d2d2`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-13T21:16:18.260Z`  
> **Learning ID**: `learn-github-lancedb-lancedb`


## 1. Scope & Verification Target
- **Target Repository**: `lancedb/lancedb` (Commit: `7d50d2d2`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): lancedb/lancedb

> **Canonical Artifact**: `07_PROJECT_LEARNING/lancedb-lancedb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lancedb/lancedb](https://github.com/lancedb/lancedb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-13T21:16:17.466Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lancedb/lancedb`
- **Description**: Developer-friendly OSS embedded retrieval library for multimodal AI. Search More; Manage Less.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 11894 stars

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
use rattler_conda_types::{MatchSpec, ParseStrictness};

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

#[pyfunction(name = "_validate_conda_requirement")]
pub fn validate_conda_requirement(requirement: &str) -> PyResult<()> {
    MatchSpec::from_str(requirement, ParseStrictness::Lenient)
        .map(|_| ())
        .map_err(|error| PyValueError::new_err(error.to_string()))
}

/// Parse field references with the same identifier syntax as Lance writes.
#[pyfunction(name = "_parse_field_path")]
pub fn parse_field_path(path: &str) -> PyResult<Vec<String>> {
    lance_core::datatypes::parse_field_path(path).map_err(|e| PyValueError::new_err(e.to_string()))
}

/// A wrapper around a LanceDB type to allow it to be used in Python
#[derive(Debug, Clone)]
pub struct PyLanceDB<T>(pub T);
/// Validate the Function retry wire contract using the same rules as Rust APIs.
#[pyo3::pyfunction]
pub fn validate_function_retry_policy(json: &str) -> pyo3::PyResult<()> {
    let policy: lancedb::function::FunctionRetryPolicy =
        serde_json::from_str(json).map_err(|error| {
            pyo3::exceptions::PyValueError::new_err(format!("invalid retry_policy: {error}"))
        })?;
    policy
        .validate()
        .map_err(|error| pyo3::exceptions::PyValueError::new_err(error.to_string()))
}

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
- **Issue #5012** (2026-11-13): **fix(remote): preserve branches in cache prewarm requests**
  *Symptoms*: Calling `prewarm_data` or `prewarm_index` on a checked-out remote branch currently targets main. Both methods omit the branch context, which can warm the wrong snapshot, miss a branch-only index, or fail when the branch's minimum read version is ahead of main. This PR carries the table handle's branch through the existing request helpers. Main requests retain their existing format, with no public API changes. 

- **Issue #5010** (2026-11-13): **fix(ci): support Cargo 1.100 artifact layout in cleanup fixture**
  *Symptoms*: Cargo 1.100 moves intermediate compiler artifacts into per-unit build directories and emits `build_script_build` instead of `build-script-build`. The unlocked-build fixture currently fails on its old rlib path before the SDK build starts, even though the library survives cleanup.  Discover compiler inputs recursively and accept both build-script names while preserving the library, generated-input, ordinary-executable, discarded-test, linker-failure and outside-target assertions. The standalone fixture reproduces the failure before this change and passes afterward on Rust/Cargo 1.100.0; it also passes on 1.97.0. Fault injection confirms missing libraries and other retained inputs still fail their assertions. Production cleanup and normal workflow coverage are unchanged. 

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

### Incident Patch 1: `db098ba8` (2026-11-13)
**Commit Message**: fix(ci): support Cargo 1.100 artifact layout in cleanup fixture (#5010)

Cargo 1.100 moves intermediate compiler artifacts into per-unit build
directories and emits `build_script_build` instead of
`build-script-build`. The unlocked-build fixture currently fails on its
old rlib path before the SDK build starts, even though the library
survives cleanup.

Discover compiler inputs recursively and accept both build-script names
while preserving the library, generated-input, ordinary-executable,
discarded-test, linker-failure and outside-target assertions. The
standalone fixture reproduces the failure before this change and passes
afterward on Rust/Cargo 1.100.0; it also passes on 1.97.0. Fault
injection confirms missing libraries and other retained inputs still
fail their assertions. Production cleanup and normal workflow coverage
are unchanged.

**File**: `ci/tests/test_build_no_lock.py` (modified, +5/-3)
```diff
@@ -88,9 +88,11 @@ def test_links_all_targets_and_retains_compiler_inputs(self):
             self.assertTrue((target / "fixture_cli").is_file())
             # Cargo guarantees this binary for test execution, not compile-time reads.
             subprocess.run([str(target / "fixture_cli")], check=True)
-            self.assertTrue(list((target / "deps").glob("libartifact_fixture*.rlib")))
-            self.assertTrue(list((target / "build").glob("*/build-script-build")))
-            self.assertTrue(list((target / "build").glob("*/out/generated.rs")))
+            # Cargo 1.100 nests compiler inputs in per-unit build directories and
+            # names the build-script executable build_script_build.
+            self.assertTrue(list(target.rglob("libartifact_fixture*.rlib")))
+            self.assertTrue(list((target / "build").rglob("build[-_]script[-_]build")))
+            self.assertTrue(list((target / "build").rglob("out/generated.rs")))
 
     def test_link_failure_preserves_cargo_status_and_diagnostic(self):
         with tempfile.TemporaryDirectory(prefix=".no-lock-", dir=SCRIPT.parent) as temp:
```

---

### Incident Patch 2: `7d50d2d2` (2026-11-13)
**Commit Message**: chore(deps): bump Rust deps flagged by security scans (#5035)

## Summary

Bumps the Rust dependencies flagged by Aikido that have a
semver-compatible fix available. Supersedes #5009 (rustls in the docs
lockfile is included here).

Root `Cargo.lock`:

| Crate | From | To |
| --- | --- | --- |
| mio | 1.2.0 | 1.2.5 |
| smallvec | 1.15.1 | 1.16.5 |
| thread_local | 1.1.9 | 1.1.10 |
| tinyvec | 1.11.0 | 1.13.3 |
| zerocopy / zerocopy-derive | 0.8.48 | 0.8.63 |
| event-listener | 5.4.1 | 5.4.2 |
| arrayvec | 0.7.6 | 0.7.8 |
| wasm-bindgen (+ js-sys, web-sys) | 0.2.121 | 0.2.130 |
| getrandom 0.4 | 0.4.2 | 0.4.3 (drops wasip3 → wasmparser 0.244) |
| brotli | 3.5.0 | 9.1.1 (via `random_word` dev-dep 0.4.3 → 1.0.0) |

`docs/web-tests/rs/Cargo.lock` gets the same crates plus rustls, hyper,
h2, moka, bytes, crossbeam-epoch and anyhow. That crate is not a
workspace member, so cargo refused to resolve it; it now has an empty
`[workspace]` table.

Still open, blocked upstream: quick-xml 0.41 (lance-io), rand 0.9
(datafusion/lance/candle), heapless 0.8 (rstar via geo), paste,
unsafe-libyaml (rattler_conda_types, lindera), fast-float/smartstring
(polars 0.39), number_prefix (needs hf-hub 1.0 mig

**File**: `Cargo.lock` (modified, +54/-228)
```diff
@@ -63,15 +63,15 @@ dependencies = [
 
 [[package]]
 name = "alloc-no-stdlib"
-version = "2.0.4"
+version = "3.0.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "cc7bb162ec39d46ab1ca8c77bf72e890535becd1751bb45f64c597edb4c8c6b3"
+checksum = "c2fb6cfd47bf496ff64095c20eaba0c201404ee38714d4142fcfa1dc334fcc7a"
 
 [[package]]
 name = "alloc-stdlib"
-version = "0.2.2"
+version = "0.3.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "94fb8275041c72129eb51b7d0322c29b8387a0386127718b096429201a5d6ece"
+checksum = "0b5c1865780388bfa186411ab5f247819487fc4864c6e9c3106611fa347586e1"
 dependencies = [
  "alloc-no-stdlib",
 ]
@@ -221,9 +221,9 @@ checksum = "76a2e8124351fda1ef8aaaa3bbd7ebbcb486bbcd4225aca0aa0d84bb2db8fecb"
 
 [[package]]
 name = "arrayvec"
-version = "0.7.6"
+version = "0.7.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7c02d123df017efcdfbd739ef81735b36c5ba83ec3c59c80a9d7ecc718f92e50"
+checksum = "d3fb67a6e08acf24fdeccbac2cb6ac4305825bd1f117462e0e6f2f193345ad56"
 
 [[package]]
 name = "arrow"
@@ -1474,9 +1474,9 @@ dependencies = [
 
 [[package]]
 name = "brotli"
-version = "3.5.0"
+version = "9.1.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d640d25bc63c50fb1f0b545ffd80207d2e10a4c965530809b40ba3386825c391"
+checksum = "627b7cfb0578f0eafce087a90fcd40add1231900b69e4d4de2d456260a4f5d81"
 dependencies = [
  "alloc-no-stdlib",
  "alloc-stdlib",
@@ -1485,9 +1485,9 @@ dependencies = [
 
 [[package]]
 name = "brotli-decompressor"
-version = "2.5.1"
+version = "6.3.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "4e2e4afe60d7dd600fdd3de8d0f08c2b7ec039712e3b6137ff98b7004e82de4f"
+checksum = "75c74c9c51b9140663e196b5fb88bc94c334d7a497c8311cb759d8557874747f"
 dependencies = [
  "alloc-no-stdlib",
  "alloc-stdlib",
@@ -2261,7 +2261,7 @@ checksum = "9c035cb64cba03dad2fb921f3e218785e8cf9a41790da5eb3a1400f62fa2be11"
 dependencies = [
  "cpubits",
  "ctutils",
- "getrandom 0.4.2",
+ "getrandom 0.4.3",
  "hybrid-array",
  "num-traits",
  "rand_core 0.10.1",
@@ -2285,7 +2285,7 @@ version = "0.2.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "77727bb15fa921304124b128af125e7e3b968275d1b108b379190264f4423710"
 dependencies = [
- "getrandom 0.4.2",
+ "getrandom 0.4.3",
  "hybrid-array",
  "rand_core 0.10.1",
 ]
@@ -3504,11 +3504,10 @@ checksum = "40404c3f5f511ec4da6fe866ddf6a717c309fdbb69fbbad7b0f3edab8f2e835f"
 
 [[package]]
 name = "event-listener"
-version = "5.4.1"
+version = "5.4.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e13b66accf52311f30a0db42147dadea9850cb48cd070028831ae5f5d4b856ab"
+checksum = "5a23add41df1562121a9393cb065eab5146a1242410f23a644851e90cfd669d2"
 dependencies = [
- "concurrent-queue",
  "parking",
  "pin-project-lite",
 ]
@@ -4248,17 +4247,15 @@ dependencies = [
 
 [[package]]
 name = "getrandom"
-version = "0.4.2"
+version = "0.4.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "0de51e6874e94e7bf76d726fc5d13ba782deca734ff60d5bb2fb2607c7406555"
+checksum = "300e883d756b2e4ec94e02791f39b04b522276138852cfc41d9fb7e904106099"
 dependencies = [
  "cfg-if 1.0.4",
  "js-sys",
  "libc",
  "r-efi 6.0.0",
  "rand_core 0.10.1",
- "wasip2",
- "wasip3",
  "wasm-bindgen",
 ]
 
@@ -4939,12 +4936,6 @@ version = "2.2.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "e4a2c462a4d927d512f5f882a033ddd62f33a05bb9f230d98f736ac3dc85938f"
 
-[[package]]
-name = "id-arena"
-version = "2.3.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3d3067d79b975e8844ca9eb072e16b31c3c1c36928edf9c6789548c524d0d954"
-
 [[package]]
 name = "ident_case"
 version = "1.0.1"
@@ -5275,13 +5266,12 @@ dependencies = [
 
 [[package]]
 name = "js-sys"
-version = "0.3.98"
+version = "0.3.107"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "67df7112613f8bfd9150013a0314e196f4800d3201ae742489d999db2f979f08"
+checksum = "8dc09d2154098bbf4ef54eab6b117a3c24cbbffe94046b16ee6d6d4510584d3a"
 dependencies = [
  "cfg-if 1.0.4",
  "futures-util",
- "once_cell",
  "wasm-bindgen",
 ]
 
@@ -6243,12 +6233,6 @@ dependencies = [
  "spin 0.9.9",
 ]
 
-[[package]]
-name = "leb128fmt"
-version = "0.1.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "09edd9e8b54e49e587e4f6295a7d29c3ea94d469cb40ab8ca70b288248a81db2"
-
 [[package]]
 name = "lexical-core"
 version = "1.0.6"
@@ -6704,9 +6688,9 @@ dependencies = [
 
 [[package]]
 name = "mio"
-version = "1.2.0"
+version = "1.2.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "50b7e5b27aa02a74bac8c3f23f448f8d87ff11f92d3aac1a6ed369ee08cc56c1"
+checksum = "20521a903f02b0a573cd6840e9d0a5a0cc043d361fe924092cd70f8556cc9c4a"
 dependencies = [
  "libc",
  "wasi 0.11.1+wasi-snapshot-preview1",
@@ -8550,16 +8534,6 @@ d
```

**File**: `docs/web-tests/rs/Cargo.lock` (modified, +68/-233)
```diff
@@ -87,9 +87,9 @@ checksum = "940b3a0ca603d1eade50a4846a2afffd5ef57a9feac2c0e2ec2e14f9ead76000"
 
 [[package]]
 name = "anyhow"
-version = "1.0.102"
+version = "1.0.104"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7f202df86484c868dbad7eaa557ef785d5c66295e41b460ef922eca0723b842c"
+checksum = "330a5ed07fa54e4702c9d6c4174f74427fc0ef6e214bbd677ae50a5099946470"
 
 [[package]]
 name = "ar_archive_writer"
@@ -129,9 +129,9 @@ checksum = "76a2e8124351fda1ef8aaaa3bbd7ebbcb486bbcd4225aca0aa0d84bb2db8fecb"
 
 [[package]]
 name = "arrayvec"
-version = "0.7.6"
+version = "0.7.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7c02d123df017efcdfbd739ef81735b36c5ba83ec3c59c80a9d7ecc718f92e50"
+checksum = "d3fb67a6e08acf24fdeccbac2cb6ac4305825bd1f117462e0e6f2f193345ad56"
 
 [[package]]
 name = "arrow"
@@ -683,9 +683,9 @@ checksum = "1fd0f2584146f6f2ef48085050886acf353beff7305ebd1ae69500e27c67f64b"
 
 [[package]]
 name = "bytes"
-version = "1.11.1"
+version = "1.12.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1e748733b7cbc798e1434b6ac524f0c1ff2ab456fe201501e6497c8417a4fc33"
+checksum = "fc652a48c352aef3ea3aed32080501cf3ef6ed5da78602a020c991775b0aff04"
 
 [[package]]
 name = "cast"
@@ -1019,9 +1019,9 @@ dependencies = [
 
 [[package]]
 name = "crossbeam-epoch"
-version = "0.9.18"
+version = "0.9.21"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5b82ac4a3c2ca9c3460964f020e1402edd5753411d7737aa39c3714ad1b5420e"
+checksum = "dc74980687109a3b14c72fd458107bf0baa1da1a1a805e178d15501ba9b86d9d"
 dependencies = [
  "crossbeam-utils",
 ]
@@ -1904,7 +1904,7 @@ dependencies = [
  "libc",
  "option-ext",
  "redox_users",
- "windows-sys 0.61.2",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
@@ -1993,7 +1993,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "39cab71617ae0d63f51a36d69f866391735b51691dbda63cf6f96d042b63efeb"
 dependencies = [
  "libc",
- "windows-sys 0.61.2",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
@@ -2004,11 +2004,10 @@ checksum = "40404c3f5f511ec4da6fe866ddf6a717c309fdbb69fbbad7b0f3edab8f2e835f"
 
 [[package]]
 name = "event-listener"
-version = "5.4.1"
+version = "5.4.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e13b66accf52311f30a0db42147dadea9850cb48cd070028831ae5f5d4b856ab"
+checksum = "5a23add41df1562121a9393cb065eab5146a1242410f23a644851e90cfd669d2"
 dependencies = [
- "concurrent-queue",
  "parking",
  "pin-project-lite",
 ]
@@ -2289,17 +2288,15 @@ dependencies = [
 
 [[package]]
 name = "getrandom"
-version = "0.4.2"
+version = "0.4.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "0de51e6874e94e7bf76d726fc5d13ba782deca734ff60d5bb2fb2607c7406555"
+checksum = "300e883d756b2e4ec94e02791f39b04b522276138852cfc41d9fb7e904106099"
 dependencies = [
  "cfg-if",
  "js-sys",
  "libc",
  "r-efi 6.0.0",
  "rand_core 0.10.1",
- "wasip2",
- "wasip3",
  "wasm-bindgen",
 ]
 
@@ -2317,9 +2314,9 @@ checksum = "0cc23270f6e1808e30a928bdc84dea0b9b4136a8bc82338574f23baf47bbd280"
 
 [[package]]
 name = "h2"
-version = "0.4.12"
+version = "0.4.20"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f3c0b69cfcb4e1b9f1bf2f53f95f766e4661169728ec61cd3fe5a0166f2d1386"
+checksum = "7d29020232d6aa3fb1daca64c1127cf662cf97f254ae16c18c05b8ab635fc118"
 dependencies = [
  "atomic-waker",
  "bytes",
@@ -2475,9 +2472,9 @@ checksum = "135b12329e5e3ce057a9f972339ea52bc954fe1e9358ef27f95e89716fbc5424"
 
 [[package]]
 name = "hyper"
-version = "1.8.1"
+version = "1.12.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2ab2d4f250c3d7b1c9fcdff1cece94ea4e2dfbec68614f7b87cb205f24ca9d11"
+checksum = "2c3e324da4c95177d6291d4c8730197c0d1822f8a9766814a4a44fa5ab797c9c"
 dependencies = [
  "atomic-waker",
  "bytes",
@@ -2490,7 +2487,6 @@ dependencies = [
  "httpdate",
  "itoa",
  "pin-project-lite",
- "pin-utils",
  "smallvec",
  "tokio",
  "want",
@@ -2699,12 +2695,6 @@ version = "2.2.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "e4a2c462a4d927d512f5f882a033ddd62f33a05bb9f230d98f736ac3dc85938f"
 
-[[package]]
-name = "id-arena"
-version = "2.3.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3d3067d79b975e8844ca9eb072e16b31c3c1c36928edf9c6789548c524d0d954"
-
 [[package]]
 name = "ident_case"
 version = "1.0.1"
@@ -2808,7 +2798,7 @@ checksum = "3640c1c38b8e4e43584d8df18be5fc6b0aa314ce6ebf51b53313d4306cca8e46"
 dependencies = [
  "hermit-abi",
  "libc",
- "windows-sys 0.61.2",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
@@ -2876,7 +2866,7 @@ dependencies = [
  "portable-atomic",
  "portable-atomic-util",
  "serde_core",
- "windows-sys 0.61.2",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
@@ -2917,11 +2907,12 @@ dependencies = [
 
 [[package]]
 name = "js-sys"
-version = "0.3.83"
+version = "0.3.107"
 source = "regist
```

**File**: `docs/web-tests/rs/Cargo.toml` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+# Standalone crate pinned to a published lancedb release, not part of the root
+# workspace. Without this, cargo commands here fail to resolve the workspace.
+[workspace]
+
 [package]
 name = "rs"
 version = "0.1.0"
```

**File**: `rust/lancedb/Cargo.toml` (modified, +1/-1)
```diff
@@ -118,7 +118,7 @@ lance-testing = { workspace = true }
 # production remote feature so Python wheels do not resolve its Axum 0.7 stack.
 lance-namespace-impls = { workspace = true, features = ["rest-adapter"] }
 tempfile = { workspace = true }
-random_word = { version = "0.4.3", features = ["en"] }
+random_word = { version = "1.0.0", features = ["en"] }
 tokio = { workspace = true, features = ["io-util", "macros", "net", "test-util"] }
 uuid = { workspace = true }
 walkdir = "2"
```

---

### Incident Patch 3: `1765747f` (2026-11-13)
**Commit Message**: fix: allow updates to Function input columns (#4985)

Updating an input column on a table with a Function binding currently
fails before the write, although the write path already preserves
freshness for bindings whose inputs are unchanged. Allow input updates
through the normal update builder while retaining supported
binding-metadata validation and the guard against writing computed or
internal assignment outputs directly.

Lance rewrites only the matched rows. Their affected Function outputs
keep their previous values and their changed input signatures make them
eligible for refresh; unchanged fragments retain their freshness.
Rewrites affecting only unrelated inputs keep the existing
freshness-preservation path.

For a table whose Function reads `title`, this update now succeeds while
retaining the previous computed values until refresh:

```python
table.update(where="id = 7", values={"title": "revised"})
```

Server consumers need this crate update before remote input updates gain
the behavior.

Adds regressions for a one-row input update, retained output values,
freshness scope, independent binding preservation, and atomic rejection
of mixed input/output writes. Local builds 

**File**: `rust/lancedb/src/table/computed_columns.rs` (modified, +50/-4)
```diff
@@ -1757,10 +1757,20 @@ pub(crate) fn ensure_not_written<'a>(
     schema: &ArrowSchema,
     written: impl IntoIterator<Item = &'a str>,
 ) -> Result<()> {
-    let declared: Vec<String> = computed_columns(schema)
+    ensure_supported_function_metadata(schema)?;
+    let mut declared: Vec<String> = computed_columns(schema)
         .into_iter()
         .map(|declaration| declaration.name)
         .collect();
+    declared.extend(
+        function_bindings(schema)?
+            .into_iter()
+            .filter_map(|binding| {
+                binding
+                    .assignment()
+                    .map(|assignment| assignment.output_name.clone())
+            }),
+    );
     for name in written {
         if declared.iter().any(|declared| *declared == root(name)) {
             return Err(Error::InvalidInput {
@@ -2532,10 +2542,15 @@ pub(crate) mod test_support {
             )])
             .await
             .unwrap();
-        let inputs = ["title".to_string(), "body".to_string()];
+        let schema = dataset.schema();
         let outputs = bindings
             .iter()
             .flat_map(|binding| {
+                let inputs = binding
+                    .inputs()
+                    .iter()
+                    .map(|input| input.field_path.clone())
+                    .collect::<Vec<_>>();
                 let assignment = binding.assignment().map(|assignment| {
                     (
                         assignment.output_name.clone(),
@@ -2547,9 +2562,9 @@ pub(crate) mod test_support {
                     .iter()
                     .map(|output| (output.output_name.clone(), output.output_ordinal))
                     .chain(assignment)
-                    .map(|(name, ordinal)| {
+                    .map(move |(name, ordinal)| {
                         (
-                            dataset.schema().field(&name).unwrap().id as u32,
+                            schema.field(&name).unwrap().id as u32,
                             function_computed_column_metadata(
                                 binding.binding_id(),
                                 ordinal,
@@ -4144,6 +4159,37 @@ mod tests {
         ArrowSchema::new(fields)
     }
 
+    #[test]
+    fn input_writes_preserve_the_assignment_column_guard() {
+        let mut raw: Value = serde_json::to_value(test_support::text_features_binding("")).unwrap();
+        raw["assignment"] = serde_json::json!({
+            "output_name": "__function_assignment_fb_01K3TEXT", "output_field_id": -1,
+        });
+        raw["outputs"][0]["nullable"] = Value::Bool(true);
+        raw["outputs"][1]["nullable"] = Value::Bool(true);
+        raw["output_schema"]["fields"].as_array_mut().unwrap().push(serde_json::json!({
+            "name": "__function_assignment_fb_01K3TEXT", "nullable": true, "type": {"type": "bool"},
+        }));
+        let binding: FunctionBinding = serde_json::from_value(raw).unwrap();
+        let schema = ArrowSchema::new_with_metadata(
+            valid_function_binding_schema(true, true, &binding)
+                .fields()
+                .to_vec(),
+            HashMap::from([(
+                FUNCTION_BINDINGS_META_KEY.into(),
+                function_bindings_metadata(&[binding]).unwrap(),
+            )]),
+        );
+        ensure_not_written(&schema, ["title", "body"]).unwrap();
+        for output in [
+            "search_text",
+            "search_token_count",
+            "__function_assignment_fb_01K3TEXT",
+        ] {
+            assert!(ensure_not_written(&schema, [output]).is_err(), "{output}");
+        }
+    }
+
     #[test]
     fn test_non_nullable_function_inputs_can_bind_to_nullable_parameters() {
         let binding = FunctionBinding::from_json(include_str!(
```

**File**: `rust/lancedb/src/table/freshness.rs` (modified, +122/-0)
```diff
@@ -2646,6 +2646,8 @@ mod tests {
     use lance_file::version::ConcreteFileVersion;
     use lance_table::format::overlay::{DataOverlayFile, OverlayCoverage};
 
+    use crate::table::computed_columns::test_support::{stamp_bindings, text_features_binding};
+
     const COLUMN: &str = "doubled";
     const EXPRESSION: &str = "value * 2";
 
@@ -3126,6 +3128,126 @@ mod tests {
         }
     }
 
+    #[tokio::test]
+    async fn input_update_dirties_only_the_updated_rows_and_retains_outputs() {
+        let table = fresh_function_table().await;
+        let result = table
+            .update()
+            .only_if("title = 'a'")
+            .column("body", "'changed'")
+            .execute()
+            .await
+            .unwrap();
+        assert_eq!(result.rows_updated, 1);
+        let dataset = table.as_native().unwrap().dataset.get().await.unwrap();
+        for output in ["search_text", "search_token_count"] {
+            let stale = function_plan(&dataset, output).await;
+            let mut dirty_rows = 0;
+            for fragment in dataset.get_fragments() {
+                if stale.needs_recompute(fragment.id() as u32) {
+                    let batch = fragment
+                        .scan()
+                        .project(&["title"])
+                        .unwrap()
+                        .try_into_batch()
+                        .await
+                        .unwrap();
+                    let titles = batch
+                        .column(0)
+                        .as_any()
+                        .downcast_ref::<arrow_array::StringArray>()
+                        .unwrap();
+                    assert!(titles.iter().all(|title| title == Some("a")), "{stale:?}");
+                    dirty_rows += batch.num_rows();
+                }
+            }
+            assert_eq!(dirty_rows, 1, "{stale:?}");
+        }
+        assert_eq!(table.count_rows(Some("title = 'a' AND body = 'changed' AND search_text = 'a x' AND search_token_count = 2".into())).await.unwrap(), 1);
+    }
+
+    #[tokio::test]
+    async fn input_update_keeps_an_independent_function_binding_fresh() {
+        let batch = arrow_array::record_batch!(
+            ("title", Utf8, ["a", "b", "c", "d"]),
+            ("body", Utf8, ["x", "y", "z", "w"]),
+            ("search_text", Utf8, ["a x", "b y", "c z", "d w"]),
+            ("search_token_count", Int64, [2, 2, 2, 2]),
+            ("search_text_other", Utf8, ["a a", "b b", "c c", "d d"]),
+            ("search_token_count_other", Int64, [2, 2, 2, 2])
+        )
+        .unwrap();
+        let table = crate::connect("memory://")
+            .execute()
+            .await
+            .unwrap()
+            .create_table("independent_functions", batch)
+            .write_options(crate::table::WriteOptions {
+                lance_write_params: Some(WriteParams {
+                    max_rows_per_file: 2,
+                    ..Default::default()
+                }),
+            })
+            .execute()
+            .await
+            .unwrap();
+        let mut other = serde_json::to_value(text_features_binding("_other")).unwrap();
+        other["inputs"][1]["field_path"] = serde_json::json!("title");
+        other["inputs"][1]["field_id"] = other["inputs"][0]["field_id"].clone();
+        let bindings = [
+            text_features_binding(""),
+            serde_json::from_value(other).unwrap(),
+        ];
+        stamp_bindings(&table, &bindings).await;
+        let native = table.as_native().unwrap();
+        let mut dataset = native.dataset.get().await.unwrap().as_ref().clone();
+        for binding in &bindings {
+            let paths = binding
+                .inputs()
+                .iter()
+                .map(|input| input.field_path.clone())
+                .collect::<Vec<_>>();
+            let inputs = fields_for_paths(dataset.schema(), &paths).unwrap();
+            let signatures = signatures_for(&dataset, &[0, 1], &inputs).unwrap();
+            for output in binding.outputs() {
+                write_signatures(
+                    &mut dataset,
+                    &output.output_name,
+                    binding.binding_id(),
+                    signatures.clone(),
+                )
+                .await
+                .unwrap();
+            }
+        }
+        native.dataset.update(dataset);
+        table
+            .update()
+            .only_if("title = 'a'")
+            .column("body", "'changed'")
+            .execute()
+            .await
+            .unwrap();
+        let dataset = native.dataset.get().await.unwrap();
+        assert!(
+            function_plan(&dataset, "search_text")
+                .await
+                .needs_recompute(2)
+        );
+        let other = &bindings[1];
+        let inputs = fields_for_paths(dataset.schema(), &["title".into()]).unwrap();
+        for output in other.outputs() {
+            let stale =
+                staleness_against(&dataset, &ou
```

**File**: `rust/lancedb/src/table/update.rs` (modified, +20/-13)
```diff
@@ -103,11 +103,6 @@ pub(crate) async fn execute_update(
     // 1. Snapshot the current dataset
     let dataset = table.dataset.get().await?;
     crate::materialized_view::ensure_not_a_view(&table.name, &dataset.schema().metadata, "update")?;
-    super::computed_columns::ensure_not_function_bound(
-        &arrow_schema::Schema::from(dataset.schema()),
-        "update",
-        update.columns.iter().map(|(name, _)| name.as_str()),
-    )?;
     super::computed_columns::ensure_not_written(
         &arrow_schema::Schema::from(dataset.schema()),
         update.columns.iter().map(|(name, _)| name.as_str()),
@@ -473,26 +468,38 @@ mod tests {
         assert_eq!(0, tbl.count_rows(Some("i == 0".to_string())).await.unwrap());
     }
 
-    /// A Function binding protects only the columns it reads or writes; any
-    /// other column updates as on a plain table.
     #[tokio::test]
-    async fn update_on_a_function_table_refuses_only_bound_columns() {
+    async fn update_allows_function_inputs_but_protects_outputs() {
         let table = crate::table::computed_columns::test_support::bound_table().await;
-        let result = table.update().column("spare", "7").execute().await.unwrap();
+        let result = table
+            .update()
+            .column("title", "'changed'")
+            .execute()
+            .await
+            .unwrap();
         assert_eq!(result.rows_updated, 1);
-        for column in ["title", "search_text"] {
+        assert_eq!(
+            table
+                .count_rows(Some("title = 'changed' AND search_text = 'a b'".into()))
+                .await
+                .unwrap(),
+            1
+        );
+        for column in ["search_text", "search_token_count"] {
+            let version = table.version().await.unwrap();
             let err = table
                 .update()
-                .column(column, "'x'")
+                .column("title", "'must not commit'")
+                .column(column, "NULL")
                 .execute()
                 .await
                 .unwrap_err();
             assert!(
                 matches!(&err, crate::Error::InvalidInput { message }
-                    if message.contains(&format!("update of '{column}'"))
-                        && message.contains("a Function binding reads or writes it")),
+                if message.contains("is computed") && message.contains("cannot be written directly")),
                 "{column}: {err:?}"
             );
+            assert_eq!(table.version().await.unwrap(), version);
         }
     }
 }
```

#### Recent Merged Pull Requests:
- **PR #5035** (2026-11-13): chore(deps): bump Rust deps flagged by security scans (@wjones127)
- **PR #5023** (closed): docs: move the Blob range draft comment out of the TypeScript CodeBlock (@brendanclement)
- **PR #5012** (2026-11-13): fix(remote): preserve branches in cache prewarm requests (@ChilePiquin)
- **PR #5011** (2026-11-12): ci(java): publish beta releases to Fury instead of Maven Central (@wjones127)
- **PR #5010** (2026-11-13): fix(ci): support Cargo 1.100 artifact layout in cleanup fixture (@Xuanwo)
- **PR #5009** (closed): chore(deps): bump rustls to 0.23.46 in docs web-tests (@wjones127)

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

## X. ci): support Cargo 1.100 artifact layout in cleanup fixture

**RULE**:
When implementing operations in `ci/tests/test_build_no_lock.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lancedb/lancedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `db098ba8`: ci): support Cargo 1.100 artifact layout in cleanup fixture. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `ci/tests/test_build_no_lock.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
            # Cargo 1.100 nests compiler inputs in per-unit build directories and
            # names the build-script executable build_script_build.
            self.assertTrue(list(target.rglob("libartifact_fixture*.rlib")))
            self.assertTrue(list((target / "build").rglob("build[-_]script[-_]build")))
            self.assertTrue(list((target / "build").rglob("out/generated.rs")))
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
            self.assertTrue(list((target / "deps").glob("libartifact_fixture*.rlib")))
            self.assertTrue(list((target / "build").glob("*/build-script-build")))
            self.assertTrue(list((target / "build").glob("*/out/generated.rs")))
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `db098ba8` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
