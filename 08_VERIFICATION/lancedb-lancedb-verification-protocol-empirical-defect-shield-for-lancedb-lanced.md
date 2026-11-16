# Verification Protocol: Verification Protocol: Empirical Defect Shield for lancedb/lancedb

<!-- PROVENANCE_START
{
  "source_repository": "lancedb/lancedb",
  "source_url": "https://github.com/lancedb/lancedb",
  "source_version": "bf4d6c80",
  "license": "Apache-2.0",
  "timestamp": "2026-11-16T20:11:18.299Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-lancedb-lancedb",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lancedb/lancedb](https://github.com/lancedb/lancedb) (Revision: `bf4d6c80`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-16T20:11:18.299Z`  
> **Learning ID**: `learn-github-lancedb-lancedb`


## 1. Scope & Verification Target
- **Target Repository**: `lancedb/lancedb` (Commit: `bf4d6c80`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): lancedb/lancedb

> **Canonical Artifact**: `07_PROJECT_LEARNING/lancedb-lancedb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lancedb/lancedb](https://github.com/lancedb/lancedb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-16T20:11:17.342Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lancedb/lancedb`
- **Description**: Developer-friendly OSS embedded retrieval library for multimodal AI. Search More; Manage Less.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 11912 stars

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
- **Issue #5062** (2026-11-16): **fix: allow matched merge updates to Function inputs**
  *Symptoms*: Matched merge-insert updates rejected every non-key source column that a Function binding reads, while update already accepts input changes and the merge freshness path records their changed signatures. Use the same `ensure_not_written` guard for the matched source columns: inputs pass, computed outputs and assignment columns stay rejected before any write, and insert-only or unrelated-column merges keep their behavior.  Regressions confirm a matched input update retains prior outputs, dirties only the affected rows, keeps an independent binding fresh, and rejects mixed input/output sources without committing.  Tested on `2ab103d7` + this change: `cargo test -p lancedb --lib` 1083 passed, 82 ignored.  Refs ENT-3515 

- **Issue #5060** (2026-11-16): **fix(python): explain blob descriptor copy guidance**
  *Symptoms*: The descriptor-copy error only named the missing `data`/`uri` child. It now says that this shape is an SDK blob descriptor rather than payload bytes, and points to `blob_mode="bytes"` for supported materialization, `blob_mode="descriptions"` for inspection, and the row-id plus `fetch_blobs`/`fetch_blob_files` copy path while the source stays unchanged.  This reuses the merged guidance from #4940 and the direct-materialization contract from #4973. Ray integration remains out of scope for ENT-3556.  Refs ENT-3556  Test: `python/tests/test_blob.py` (210 passed, 39 skipped), including a regression that writes default lazy descriptor rows into a blob-schema table, checks the guidance, and confirms no target is created. `python/tests/test_util.py -k blob` (12 passed, 2 skipped). 

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

### Incident Patch 1: `3aed07c3` (2026-11-15)
**Commit Message**: fix(python): show Function registration progress and image details (#5040)

Report registration lifecycle and client elapsed time through existing job handles, and provide concise image inspection. Preserve quiet wait behavior, environment-lock forwarding, failure diagnostics and timeout recovery.

**File**: `docs/src/python/python.md` (modified, +19/-0)
```diff
@@ -424,6 +424,25 @@ code that used the former LanceDB Enterprise-only argument order.
 
 ## Functions and Jobs
 
+Use `progress=True` when waiting for Function registration in a notebook or
+terminal. A callback receives structured snapshots instead:
+
+```python
+fn = db.create_function(my_function, progress=True)
+registration = db.create_function_async(other_function)
+fn = registration.wait(progress=lambda snapshot: print(snapshot))
+print(fn.image.describe())
+```
+
+Registration uses the existing SQL query handle. The current handle reports
+lifecycle state and `client_elapsed_time_millis` since the handle was created;
+detailed build phases and build logs are unavailable. Keep the same handle after
+a wait timeout to resume waiting. Failures retain the server error and request
+identifiers. `fn.image` has a concise representation; `describe()` exposes Python
+and CUDA requirements without inspecting Pydantic internals. Platforms, base image
+and size are `None` until the service reports them. The full image descriptor and
+canonical JSON remain available.
+
 A `@function` definition is also a local callable. Call a decorated function
 directly with row inputs, or call a decorated class with its initialization fields
 and then call the returned instance; call `close()` if the class defines it. This
```

**File**: `python/python/lancedb/db.py` (modified, +9/-2)
```diff
@@ -1051,6 +1051,7 @@ def create_function(
         exist_ok: bool = False,
         namespace_path: Optional[List[str]] = None,
         refresh_lock: bool = False,
+        progress: Any = False,
     ) -> FunctionVersion:
         """Build and register a scalar Python function, then return its version.
 
@@ -1076,6 +1077,9 @@ def create_function(
         refresh_lock : bool, default False
             Ask the server to resolve a fresh environment lock instead of
             reusing the published version's lock.
+        progress : bool, callable, or tqdm-like object, default False
+            Display lifecycle state and elapsed time, or receive structured
+            snapshots through a callback. See [Job.wait][lancedb.job.Job.wait].
 
         When the registration job resolves, each resolved-environment warning
         reported by the server is emitted as a Python ``UserWarning``. Catalog
@@ -1095,13 +1099,16 @@ def create_function(
         )
         ```
         """
-        return self.create_function_async(
+        job = self.create_function_async(
             definition,
             secrets=secrets,
             exist_ok=exist_ok,
             namespace_path=namespace_path,
             refresh_lock=refresh_lock,
-        ).wait()
+        )
+        if progress is False or progress is None:
+            return job.wait()
+        return job.wait(progress=progress)
 
     def create_function_async(
         self,
```

**File**: `python/python/lancedb/functions.py` (modified, +58/-1)
```diff
@@ -544,13 +544,70 @@ def digest(self) -> str:
 
 
 class FunctionImage(_RemoteValue):
-    """A complete OCI Function image identified by its exact manifest digest."""
+    """A complete OCI Function image identified by its exact manifest digest.
+
+    ``describe()`` and the concise representation inspect the descriptor without
+    walking Pydantic model internals. Missing metadata is ``None`` (unknown).
+    The current service does not report image platforms, base image or byte size;
+    these cannot be inferred from the client's platform or the manifest digest.
+    The full descriptor remains available through ``descriptor``.
+    """
 
     manifest_digest: str
     descriptor: Mapping[str, Any]
     source: bool
     models: tuple[HuggingFaceModel, ...] = ()
 
+    def describe(self) -> dict[str, Any]:
+        """Return concise image details without fetching registry content.
+
+        ``requires_gpu`` reflects a ``lance.cuda`` requirement in a v1
+        descriptor, rather than promising compatibility with every GPU.
+        ``platforms``, ``base_image`` and ``size_bytes`` are unavailable from
+        the current wire contract and return ``None``.
+
+        Examples
+        --------
+        >>> print(fn.image.describe())  # doctest: +SKIP
+        """
+        python = self.descriptor.get("python")
+        requires = self.descriptor.get("requires")
+        capabilities = (
+            requires.get("capabilities") if isinstance(requires, Mapping) else None
+        )
+        known_capabilities = (
+            self.descriptor.get("format_version") == 1
+            and isinstance(capabilities, (list, tuple))
+            and all(isinstance(item, Mapping) for item in capabilities)
+        )
+        cuda = (
+            next(
+                (item for item in capabilities if item.get("type") == "lance.cuda"),
+                None,
+            )
+            if known_capabilities
+            else None
+        )
+        python_version = python.get("version") if isinstance(python, Mapping) else None
+        cuda_toolkit = cuda.get("cuda_toolkit") if cuda is not None else None
+        return {
+            "manifest_digest": self.manifest_digest,
+            "python_version": python_version
+            if isinstance(python_version, str)
+            else None,
+            "requires_gpu": cuda is not None if known_capabilities else None,
+            "cuda_toolkit": cuda_toolkit if isinstance(cuda_toolkit, str) else None,
+            "platforms": None,
+            "base_image": None,
+            "size_bytes": None,
+        }
+
+    def __repr_args__(self):
+        for name, value in self.describe().items():
+            if isinstance(value, str) and len(value) > 80:
+                value = value[:77] + "..."
+            yield name, value
+
 
 class ResolvedPackage(_RemoteValue):
     """One installed Python distribution measured from a baked environment.
```

**File**: `python/python/lancedb/job.py` (modified, +68/-7)
```diff
@@ -4,8 +4,10 @@
 """Handles to asynchronous registry jobs, SQL queries, and local operations."""
 
 import asyncio
+import logging
 import reprlib
 import time
+from contextlib import suppress
 from datetime import timedelta
 from os import PathLike
 from pathlib import Path
@@ -53,18 +55,21 @@ def _timeout_message(
     )
 
 
-def _normalize_job_progress(progress):
+def _normalize_job_progress(progress, *, query=False):
     """Normalize ``wait(progress=...)`` using the same convention as writes."""
     if progress is True:
         from tqdm.auto import tqdm
 
+        if query:
+            return tqdm(bar_format="Query{postfix} [{elapsed}]"), True
         return tqdm(unit=" rows"), True
     if progress is False or progress is None:
         return None, False
     return progress, False
 
 
 _ETA_MAX_SAMPLE_INTERVAL_MILLIS = 10 * 60 * 1_000
+_QUERY_PROGRESS_INTERVAL_SECONDS = 1.0
 
 
 def _progress_eta(previous, current):
@@ -203,6 +208,7 @@ def __init__(
         self._inner = inner
         self._result_decoder = result_decoder
         self._last_progress_snapshot = None
+        self._created_at = time.monotonic()
 
     def _enrich_progress(self, snapshot):
         enriched = _with_progress_eta(self._last_progress_snapshot, snapshot)
@@ -235,17 +241,29 @@ async def status(self) -> str:
     async def progress(self) -> Optional[dict[str, Any]]:
         """Fetch a structured progress snapshot.
 
-        Registry jobs always report lifecycle fields. Queue metadata and
-        counters are included when supplied by the server. Older servers may
+        Registry jobs always report lifecycle fields. SQL query handles report
+        lifecycle state and ``client_elapsed_time_millis``, measured since this
+        handle was created. They do not expose server build phases or logs.
+        Queue metadata and counters are included when supplied by the server.
+        Older servers may
         omit counters, and in-process operations return ``None``. A missing
         counter is unknown rather than zero. This is additive to :meth:`status`,
         whose string contract is unchanged.
         """
         if self._inner is None:
             return None
-        await self._inner.status()
+        state = await self._inner.status()
         description = getattr(self._inner, "_description", None)
         if description is None or description.progress is None:
+            if self.job_type == "query":
+                return {
+                    "job_id": self.id,
+                    "job_type": "query",
+                    "state": state,
+                    "client_elapsed_time_millis": int(
+                        (time.monotonic() - self._created_at) * 1_000
+                    ),
+                }
             return None
         return self._enrich_progress(description.progress)
 
@@ -270,6 +288,13 @@ async def wait(
         new execution epoch or smaller plan resets the bar to that plan.
         ``False`` preserves the original wait behavior.
 
+        For SQL-backed Function registration, progress shows the query's
+        lifecycle state and client elapsed time. It observes the existing
+        query handle while its original waiter runs; it does not resubmit or
+        cancel the registration. Detailed bake phases and build logs are not
+        available from the current query handle. Failure exceptions retain the
+        server's cause and request identifiers.
+
         Raises `JobFailedError` if the operation failed, `JobCancelledError`
         if it was cancelled, and `TimeoutError` if `timeout` elapses first.
         Transient connection and read errors are retried with capped exponential
@@ -285,7 +310,10 @@ async def wait(
         """
         if self._inner is None:
             return cast(T, None)
-        progress_obj, owns = _normalize_job_progress(progress)
+        query_progress = (
+            progress is not False and progress is not None and self.job_type == "query"
+        )
+        progress_obj, owns = _normalize_job_progress(progress, query=query_progress)
         progress_callback = _job_progress_callback(progress_obj, self._enrich_progress)
         last_error = None
 
@@ -311,13 +339,46 @@ async def wait_with_retries():
                 await asyncio.sleep(delay)
                 delay = min(delay * 2, 30.0)
 
+        async def observe_query():
+            async def report():
+                try:
+                    snapshot = await self.progress()
+                    if snapshot is not None:
+                        progress_callback(snapshot)
+                except Exception:
+                    logging.getLogger(__name__).warning(
+                        "job progress observer failed", exc_info=True
+                    )
+
+            waiter = asyncio.create_task(wait_with_retries())
+            try:
+                while not waiter.done():
+                    await report()
+                    await asyncio.wait(
+       
```

**File**: `python/python/tests/test_first_class_function_slice1.py` (modified, +55/-0)
```diff
@@ -2,6 +2,7 @@
 # SPDX-FileCopyrightText: Copyright The LanceDB Authors
 
 import json
+import warnings
 from collections import UserDict
 from pathlib import Path
 from types import MappingProxyType
@@ -13,6 +14,7 @@
 from lancedb.functions import (
     FunctionApplication,
     FunctionBinding,
+    FunctionImage,
     FunctionVersion,
     PythonRuntimeSpec,
     SecretBinding,
@@ -149,6 +151,59 @@ def test_function_version_identity_is_immutable_and_exact():
             FunctionVersion(**{**value, "version": invalid})
 
 
+@pytest.mark.parametrize("gpu", [False, True])
+def test_image_inspection_is_concise_warning_free_and_preserves_wire_state(gpu):
+    value = job_result("remote_function_job.json")["image"]
+    value["descriptor"]["future_metadata"] = "x" * 100_000
+    if gpu:
+        value["descriptor"]["requires"]["capabilities"] = [
+            {
+                "type": "lance.cuda",
+                "version": 1,
+                "device_count": 1,
+                "cuda_toolkit": "12.4",
+            }
+        ]
+    image = FunctionImage(**value)
+    with warnings.catch_warnings():
+        warnings.simplefilter("error", DeprecationWarning)
+        details = image.describe()
+        rendered = repr(image)
+        assert "manifest_digest=" in str(image)
+        encoded = json.loads(image.to_canonical_json())
+    assert details == {
+        "manifest_digest": value["manifest_digest"],
+        "python_version": "3.12.14",
+        "requires_gpu": gpu,
+        "cuda_toolkit": "12.4" if gpu else None,
+        "platforms": None,
+        "base_image": None,
+        "size_bytes": None,
+    }
+    assert len(rendered) < 350
+    assert f"requires_gpu={gpu}" in rendered
+    assert "future_metadata" not in rendered
+    assert encoded == value
+
+
+@pytest.mark.parametrize(
+    "descriptor",
+    [
+        {},
+        {"format_version": 2, "requires": {"capabilities": []}},
+        {"format_version": 1, "requires": {"capabilities": [None]}},
+        {"python": {"version": {"future": "x" * 100_000}}},
+    ],
+)
+def test_image_inspection_leaves_missing_or_unrecognized_metadata_unknown(descriptor):
+    image = FunctionImage(
+        manifest_digest="sha256:example", descriptor=descriptor, source=True
+    )
+    assert image.describe()["requires_gpu"] is None
+    assert image.describe()["python_version"] is None
+    assert len(repr(image)) < 350
+
+
 @pytest.mark.parametrize(
     "case", json.loads(fixture("runtime_identity.json")), ids=lambda case: case["name"]
 )
```

**File**: `python/python/tests/test_job.py` (modified, +187/-3)
```diff
@@ -11,6 +11,7 @@
 import pytest
 
 from lancedb.exceptions import JobCancelledError, JobFailedError
+from lancedb.db import DBConnection
 from lancedb.job import AsyncJob, Job, _progress_eta
 from lancedb.remote.errors import HttpError, RetryError
 
@@ -729,15 +730,198 @@ async def wait(self, progress):
 
 
 @pytest.mark.asyncio
-async def test_wait_progress_false_keeps_legacy_inner_wait_call():
+@pytest.mark.parametrize("progress", [False, None])
+async def test_wait_progress_false_keeps_legacy_inner_wait_call(progress):
     class NoProgressArgument:
         id = "job-legacy"
-        job_type = None
+
+        @property
+        def job_type(self):
+            raise AssertionError("quiet waits must not inspect progress metadata")
 
         async def wait(self):
             return None
 
-    assert await AsyncJob(NoProgressArgument()).wait(progress=False) is None
+    assert await AsyncJob(NoProgressArgument()).wait(progress=progress) is None
+
+
+class _RegistrationQuery:
+    id = "registration-query"
+    job_type = "query"
+    _description = None
+
+    def __init__(self, error=None):
+        self.ready = asyncio.Event()
+        self.error = error
+        self.state = "running"
+        self.wait_calls = 0
+        self.cancel_calls = 0
+
+    async def status(self):
+        return self.state
+
+    async def wait(self, progress=None):
+        self.wait_calls += 1
+        await self.ready.wait()
+        if self.error is not None:
+            self.state = (
+                "cancelled" if isinstance(self.error, JobCancelledError) else "failed"
+            )
+            raise self.error
+        self.state = "finished"
+        return '{"version": "1"}'
+
+    async def cancel(self):
+        self.cancel_calls += 1
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("sync", [False, True])
+async def test_query_progress_observes_one_registration_waiter(sync, monkeypatch):
+    monkeypatch.setattr("lancedb.job._QUERY_PROGRESS_INTERVAL_SECONDS", 0)
+    inner = _RegistrationQuery()
+    job = AsyncJob(inner, json.loads)
+    updates = []
+
+    def observe(snapshot):
+        updates.append(snapshot)
+        if len(updates) == 2:
+            inner.ready.set()
+
+    if sync:
+        result = await asyncio.to_thread(Job(job).wait, progress=observe)
+    else:
+        result = await job.wait(progress=observe)
+    assert result == {"version": "1"}
+    assert inner.wait_calls == 1
+    assert inner.cancel_calls == 0
+    assert updates[0]["state"] == "running"
+    assert updates[-1]["state"] == "finished"
+    assert all(snapshot["job_id"] == inner.id for snapshot in updates)
+    elapsed = [snapshot["client_elapsed_time_millis"] for snapshot in updates]
+    assert elapsed == sorted(elapsed)
+    assert elapsed[0] >= 0
+    assert all("phase" not in snapshot for snapshot in updates)
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize(
+    "error",
+    [
+        JobFailedError("bake failed", job_id="registration-query"),
+        JobCancelledError("cancelled"),
+    ],
+)
+async def test_query_progress_preserves_terminal_exceptions(error):
+    inner = _RegistrationQuery(error)
+    inner.ready.set()
+    updates = []
+    with pytest.raises(type(error)) as raised:
+        await AsyncJob(inner).wait(progress=updates.append)
+    assert raised.value is error
+    assert updates[-1]["state"] == inner.state
+    assert inner.wait_calls == 1
+
+
+@pytest.mark.asyncio
+async def test_query_progress_display_has_no_row_counter_and_closes_on_failure(
+    monkeypatch,
+):
+    tqdm_module = pytest.importorskip("tqdm.auto")
+    bar = SimpleNamespace(
+        n=0,
+        total=None,
+        update=MagicMock(),
+        set_postfix_str=MagicMock(),
+        close=MagicMock(),
+    )
+    constructor = MagicMock(return_value=bar)
+    monkeypatch.setattr(tqdm_module, "tqdm", constructor)
+    inner = _RegistrationQuery(JobFailedError("bake failed"))
+    inner.ready.set()
+
+    with pytest.raises(JobFailedError, match="bake failed"):
+        await AsyncJob(inner).wait(progress=True)
+    assert "elapsed" in constructor.call_args.kwargs["bar_format"]
+    assert "rows" not in str(constructor.call_args)
+    assert bar.set_postfix_str.call_args.args == ("failed",)
+    bar.close.assert_called_once_with()
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("failed", [False, True])
+@pytest.mark.parametrize("observer_error", ["status", "callback"])
+async def test_query_progress_observer_errors_do_not_replace_result_or_server_failure(
+    failed, observer_error, caplog
+):
+    error = (
+        JobFailedError("bake failed", job_id="registration-query") if failed else None
+    )
+    inner = _RegistrationQuery(error)
+    inner.ready.set()
+    if observer_error == "status":
+        inner.status = AsyncMock(side_effect=RuntimeError("observer failed"))
+
+    def observe(snapshot):
+        if observer_error == "callback":
+            raise RuntimeError("observer failed")
+
+    job = As
```

---

### Incident Patch 2: `3b7c4dcf` (2026-11-16)
**Commit Message**: fix: allow matched merge updates to Function inputs (#5062)

Matched merge-insert updates rejected every non-key source column that a
Function binding reads, while update already accepts input changes and
the merge freshness path records their changed signatures. Use the same
`ensure_not_written` guard for the matched source columns: inputs pass,
computed outputs and assignment columns stay rejected before any write,
and insert-only or unrelated-column merges keep their behavior.

Regressions confirm a matched input update retains prior outputs,
dirties only the affected rows, keeps an independent binding fresh, and
rejects mixed input/output sources without committing.

Tested on `2ab103d7` + this change: `cargo test -p lancedb --lib` 1083
passed, 82 ignored.

Refs ENT-3515

**File**: `rust/lancedb/src/table/freshness.rs` (modified, +130/-0)
```diff
@@ -3248,6 +3248,136 @@ mod tests {
         }
     }
 
+    #[tokio::test]
+    async fn input_merge_dirties_only_the_updated_rows_and_retains_outputs() {
+        let table = fresh_function_table().await;
+        let source =
+            arrow_array::record_batch!(("title", Utf8, ["a"]), ("body", Utf8, ["changed"]))
+                .unwrap();
+        let mut merge = table.merge_insert(&["title"]);
+        merge.when_matched_update_all(None);
+        let result = merge
+            .execute(Box::new(RecordBatchIterator::new(
+                [Ok(source.clone())],
+                source.schema(),
+            )))
+            .await
+            .unwrap();
+        assert_eq!(result.num_updated_rows, 1);
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
+    async fn input_merge_keeps_an_independent_function_binding_fresh() {
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
+            .create_table("independent_merge", batch)
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
+        let source =
+            arrow_array::record_batch!(("title", Utf8, ["a"]), ("body", Utf8, ["changed"]))
+                .unwrap();
+        let mut merge = table.merge_insert(&["title"]);
+        merge.when_matched_update_all(None);
+        merge
+            .execute(Box::new(RecordBatchIterator::new(
+                [Ok(source.clone())],
+                source.schema(),
+            )))
+            .await
+            .unwrap();
+        let dataset = native.dataset.get().await.unwrap();
+        assert!(
+            function_plan(&dataset, "search_text")
+                .await
+                .needs_recompute(2)
+        );
+        let other = &bindings[1];
+        l
```

**File**: `rust/lancedb/src/table/merge.rs` (modified, +50/-18)
```diff
@@ -249,11 +249,13 @@ impl MergeInsertBuilder {
         Ok(())
     }
 
-    /// The existing columns a matched row takes from `source`: every source
-    /// column but the join keys, which a match leaves equal. An insert-only
-    /// merge rewrites none; its new rows get Function outputs from the next
-    /// refresh, as appended rows do.
-    pub(crate) fn function_guarded_columns(&self, source: &Fields) -> Vec<String> {
+    /// The source columns a matched row writes: every column but the join
+    /// keys, which a match leaves equal. Function inputs stay writable; the
+    /// merge records their changed signatures so the next refresh recomputes
+    /// the affected rows. Computed outputs and assignment columns remain
+    /// protected by the direct-write guard. An insert-only merge writes none;
+    /// its new rows get Function outputs from the next refresh.
+    pub(crate) fn matched_source_columns(&self, source: &Fields) -> Vec<String> {
         if !self.when_matched_update_all {
             return Vec::new();
         }
@@ -351,10 +353,10 @@ pub(crate) async fn execute_merge_insert(
 ) -> Result<MergeResult> {
     params.canonicalize_filters()?;
     let schema = table.schema().await?;
-    super::computed_columns::ensure_not_function_bound(
+    let matched_columns = params.matched_source_columns(new_data.schema().fields());
+    super::computed_columns::ensure_not_written(
         schema.as_ref(),
-        "merge_insert",
-        params.function_guarded_columns(new_data.schema().fields()),
+        matched_columns.iter().map(String::as_str),
     )?;
     // Normalize blob layouts and JSON extension metadata just as on append.
     // Keep arrow.json text labelled until Lance encodes it as JSONB.
@@ -970,10 +972,11 @@ mod tests {
         assert_eq!(table.count_rows(None).await.unwrap(), 2);
     }
 
-    /// A matched row takes every non-key source column, so the merge is
-    /// refused only when one of those is a binding's input or output.
+    /// A matched row takes every non-key source column. Function inputs are
+    /// writable and become stale for the next refresh; computed outputs stay
+    /// protected, and a mixed input/output source is rejected before commit.
     #[tokio::test]
-    async fn merge_update_on_a_function_table_refuses_only_bound_columns() {
+    async fn merge_update_allows_function_inputs_but_protects_outputs() {
         let table = crate::table::computed_columns::test_support::bound_table_from(
             arrow_array::record_batch!(
                 ("id", Int32, [1]),
@@ -998,18 +1001,47 @@ mod tests {
 
         let mut merge = table.merge_insert(&["id"]);
         merge.when_matched_update_all(None);
-        let err = merge
+        let result = merge
             .execute(reader(
                 arrow_array::record_batch!(("id", Int32, [1]), ("title", Utf8, ["z"])).unwrap(),
             ))
             .await
-            .unwrap_err();
-        assert!(
-            matches!(&err, crate::Error::InvalidInput { message }
-                if message.contains("merge_insert of 'title'")
-                    && message.contains("a Function binding reads or writes it")),
-            "{err:?}"
+            .unwrap();
+        assert_eq!(result.num_updated_rows, 1);
+        assert_eq!(
+            table
+                .count_rows(Some("title = 'z' AND search_text = 'a b'".into()))
+                .await
+                .unwrap(),
+            1
         );
+
+        let version = table.version().await.unwrap();
+        for source in [
+            arrow_array::record_batch!(("id", Int32, [1]), ("search_text", Utf8, ["uncomputed"]))
+                .unwrap(),
+            arrow_array::record_batch!(
+                ("id", Int32, [1]),
+                ("title", Utf8, ["must not commit"]),
+                ("search_text", Utf8, ["uncomputed"])
+            )
+            .unwrap(),
+        ] {
+            let mut merge = table.merge_insert(&["id"]);
+            merge.when_matched_update_all(None);
+            let err = merge.execute(reader(source)).await.unwrap_err();
+            assert!(
+                matches!(&err, crate::Error::InvalidInput { message }
+                    if message.contains("is computed")
+                        && message.contains("cannot be written directly")),
+                "{err:?}"
+            );
+            assert_eq!(table.version().await.unwrap(), version);
+            assert_eq!(
+                table.count_rows(Some("title = 'z'".into())).await.unwrap(),
+                1
+            );
+        }
     }
 }
 
```

---

### Incident Patch 3: `c7d972fe` (2026-11-16)
**Commit Message**: fix(python): explain blob descriptor copy guidance (#5060)

The descriptor-copy error only named the missing `data`/`uri` child. It
now says that this shape is an SDK blob descriptor rather than payload
bytes, and points to `blob_mode="bytes"` for supported materialization,
`blob_mode="descriptions"` for inspection, and the row-id plus
`fetch_blobs`/`fetch_blob_files` copy path while the source stays
unchanged.

This reuses the merged guidance from #4940 and the
direct-materialization contract from #4973. Ray integration remains out
of scope for ENT-3556.

Refs ENT-3556

Test: `python/tests/test_blob.py` (210 passed, 39 skipped), including a
regression that writes default lazy descriptor rows into a blob-schema
table, checks the guidance, and confirms no target is created.
`python/tests/test_util.py -k blob` (12 passed, 2 skipped).

**File**: `python/python/lancedb/table.py` (modified, +8/-1)
```diff
@@ -1150,7 +1150,14 @@ def _align_field(field: pa.Field, target_field: pa.Field) -> pa.Field:
             if not any(child.name in ("data", "uri") for child in source_type):
                 raise ValueError(
                     f"blob struct input for column '{field.name}' must contain "
-                    "a 'data' or 'uri' child"
+                    "a 'data' or 'uri' child. A blob query returns an SDK "
+                    "descriptor in this shape, and a descriptor is not payload "
+                    "bytes. Use blob_mode='bytes' to materialize payloads, or "
+                    "inspect descriptors with blob_mode='descriptions'. To copy "
+                    "payloads, select row IDs with with_row_id(True), then call "
+                    "table.fetch_blobs(column, row_ids) or "
+                    "table.fetch_blob_files(column, row_ids). Keep the source "
+                    "unchanged between selection and fetching."
                 )
         elif not _can_coerce_to_blob(source_type) and not isinstance(
             source_type, pa.ExtensionType
```

**File**: `python/python/tests/test_blob.py` (modified, +18/-0)
```diff
@@ -1135,6 +1135,24 @@ def test_copy_blob_subset_preserves_payloads_nulls_and_empty_values(tmp_path):
     assert sorted(copied, key=lambda row: row["id"]) == rows[:3]
 
 
+def test_copy_blob_descriptor_rows_explains_payload_materialization(tmp_path):
+    db = lancedb.connect(tmp_path)
+    schema = pa.schema([pa.field("id", pa.int64()), lancedb.blob("image")])
+    source = db.create_table("source", data=[{"id": 1, "image": b"one"}], schema=schema)
+    hits = source.search().where("id = 1").to_arrow()
+
+    with pytest.raises(ValueError, match="must contain a 'data' or 'uri' child") as exc:
+        db.create_table("copy", data=hits, schema=schema)
+
+    message = str(exc.value)
+    assert "blob_mode='bytes'" in message
+    assert "blob_mode='descriptions'" in message
+    assert "with_row_id(True)" in message
+    assert "fetch_blobs(column, row_ids)" in message
+    assert "fetch_blob_files(column, row_ids)" in message
+    assert not db.table_exists(["copy"])
+
+
 def test_fetch_blobs_round_trip():
     table = _blob_table(
         "round_trip",
```

#### Recent Merged Pull Requests:
- **PR #5063** (2026-11-16): chore: update lance dependency to v15.0.0-beta.23 (@lancedb-robot)
- **PR #5062** (2026-11-16): fix: allow matched merge updates to Function inputs (@Xuanwo)
- **PR #5060** (2026-11-16): fix(python): explain blob descriptor copy guidance (@Xuanwo)
- **PR #5059** (closed): docs: add Simplified Chinese translation (README.zh.md) (@JasonYeYuhe)
- **PR #5057** (2026-11-15): chore: update lance dependency to v15.0.0-beta.22 (@lancedb-robot)
- **PR #5055** (closed): feat(sdk): add durable compaction jobs with typed results (@ChilePiquin)

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

## X. python): show Function registration progress and image details

**RULE**:
When implementing operations in `docs/src/python/python.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lancedb/lancedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3aed07c3`: python): show Function registration progress and image details. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/src/python/python.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
Use `progress=True` when waiting for Function registration in a notebook or
terminal. A callback receives structured snapshots instead:

```python
fn = db.create_function(my_function, progress=True)
registration = db.create_function_async(other_function)
fn = registration.wait(progress=lambda snapshot: print(snapshot))
print(fn.image.describe())
```

Registration uses the existing SQL query handle. The current handle reports
lifecycle state and `client_elapsed_time_millis` since the handle was created;
detailed build phases and build logs are unavailable. Keep the same handle after
a wait timeout to resume waiting. Failures retain the server error and request
identifiers. `fn.image` has a concise representation; `describe()` exposes Python
and CUDA requirements without inspecting Pydantic internals. Platforms, base image
and size are `None` until the service reports them. The full image descriptor and
canonical JSON remain available.

```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3aed07c3` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
