# Forensic Learning Record (Deep Inspection): lancedb/lancedb

> **Canonical Artifact**: `07_PROJECT_LEARNING/lancedb-lancedb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lancedb/lancedb](https://github.com/lancedb/lancedb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:56:37.971Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lancedb/lancedb`
- **Description**: Developer-friendly OSS embedded retrieval library for multimodal AI. Search More; Manage Less.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 11602 stars

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
):
    """Retry a function with exponential backoff.

    Args:
        func (function): The function to be retried.
        initial_delay (float): Initial delay in seconds (default is 1).
        exponential_base (float): The base for exponential backoff (default is 2).
        jitter (bool): Whether to add jitter to the delay (default is True).
        max_retries (int): Maximum number of retries (default is 7).

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

            # Currently retrying on all exceptions as there is no way to know the
            # format of the error msgs used by different APIs. We'll log the error
            # and say that it is assumed that if this portion errors out, it's due
            # to rate limit but the user should check the error message to be sure.
            except Exception as e:  # noqa: PERF203
                # Don't retry on authentication errors (e.g., OpenAI 401)
                # These are permanent failures that won't be fixed by retrying
                if _is_non_retryable_error(e):
                    raise

                num_retries += 1

                if num_retries > max_retries:
                    raise Exception(
                        f"Maximum number of retries ({max_retries}) exceeded.", e
                    )

                delay *= exponential_base * (1 + jitter * random.random())
                logging.warning(
                    "Error occurred: %s \n Retrying in %s seconds (retry %s of %s) \n",
                    e,
                    delay,
                    num_retries,
                    max_retries,
                )
                time.sleep(delay)

    return wrapper


def _is_non_retryable_error(error: Exception) -> bool:
    """Check if an error should not be retried.

    Args:
        error: The exception to check

    Returns:
        True if the error should not be retried, False otherwise
    """
    # Check for OpenAI authentication errors
    error_type = type(error).__name__
    if error_type == "AuthenticationError":
        return True

    # Check for other common non-retryable HTTP status codes
    # 401 Unauthorized, 403 Forbidden
    if hasattr(error, "status_code"):
        if error.status_code in (401, 403):
            return True

    return False


def url_retrieve(url: str):
    """
    Parameters
    ----------
    url: str
        URL to download from
    """
    try:
        with urllib.request.urlopen(url) as conn:
            return conn.read()
    except (socket.gaierror, urllib.error.URLError) as err:
        raise ConnectionError("could not download {} due to {}".format(url, err))


def api_key_not_found_help(provider):
    logging.error("Could not find API key for %s", provider)
    raise ValueError(f"Please set the {provider.upper()}_API_KEY environment variable.")


def is_flash_attn_2_available():
    try:
        attempt_import_or_raise("flash_attn", "flash_attn")

        return True
    except ImportError:
        return False

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


def get_uri_scheme(uri: str) -> str:
    """
    Get the scheme of a URI. If the URI does not have a scheme, assume it is a file URI.

    Parameters
    ----------
    uri : str
        The URI to parse.

    Returns
    -------
    str: The scheme of the URI.
    """
    parsed = urlparse(uri)
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


def get_uri_location(uri: str) -> str:
    """
    Get the location of a URI. If the parameter is not a url, assumes it is just a path

    Parameters
    ----------
    uri : str
        The URI to parse.

    Returns
    -------
    str: Location part of the URL, without scheme
    """
    parsed = urlparse(uri)
    if len(parsed.scheme) == 1:
        # Windows drive names are parsed as the scheme
        # e.g. "c:\path" -> ParseResult(scheme="c", netloc="", path="/path", ...)
        # So we add special handling here for schemes that are a single character
        return uri

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
    if isinstance(query, list) and query:
        first = query[0]
        if isinstance(first, (list, tuple, np.ndarray)):
            return len(first)
        return len(query)
    return None


def infer_vector_column_name(
    schema: pa.Schema,
    query_type: str,
    query: Optional[Any],  # inferred later in query builder
    vector_column_name: Optional[str],
):
    if query_type != "fts":
        _validate_query_vector(query)

    if vector_column_name is not None:
        return vector_column_name

    if query_type == "fts":
        # FTS queries do not require a vector column
        return None

    if query is None and query_type != "hybrid":
        # No vector search was requested (e.g. a plain scan), so there's
        # nothing to infer.
        return None

    vector_column_name = inf_vector_column_query(schema, dim=_query_vector_dim(query))

    if vector_column_name is None:
        raise ValueError(
            "No vector column found in the schema. Please specify the "
            "vector column name explicitly via the `vector_column_name` "
            "parameter."
        )

    return vector_column_name


@singled
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

### Core Architecture Module: `rust/lancedb/src/remote/util.rs`
```
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: Copyright The LanceDB Authors

use arrow_ipc::CompressionType;
use futures::{Stream, StreamExt};
use reqwest::Response;

use crate::{Result, arrow::SendableRecordBatchStream};

use super::db::ServerVersion;

pub fn stream_as_ipc(
    data: SendableRecordBatchStream,
) -> Result<impl Stream<Item = Result<bytes::Bytes>>> {
    let options = arrow_ipc::writer::IpcWriteOptions::default()
        .try_with_compression(Some(CompressionType::LZ4_FRAME))?;
    const WRITE_BUF_SIZE: usize = 4096;
    let buf = Vec::with_capacity(WRITE_BUF_SIZE);
    let writer =
        arrow_ipc::writer::StreamWriter::try_new_with_options(buf, &data.schema(), options)?;
    let stream = futures::stream::try_unfold(
        (data, writer, false),
        move |(mut data, mut writer, finished)| async move {
            if finished {
                return Ok(None);
            }
            match data.next().await {
                Some(Ok(batch)) => {
                    writer.write(&batch)?;
                    let buffer = std::mem::take(writer.get_mut());
                    Ok(Some((bytes::Bytes::from(buffer), (data, writer, false))))
                }
                Some(Err(e)) => Err(e),
                None => {
                    writer.finish()?;
                    let buffer = std::mem::take(writer.get_mut());
                    Ok(Some((bytes::Bytes::from(buffer), (data, writer, true))))
                }
            }
        },
    );
    Ok(stream)
}

pub fn stream_as_body(data: SendableRecordBatchStream) -> Result<reqwest::Body> {
    let stream = stream_as_ipc(data)?;
    Ok(reqwest::Body::wrap_stream(stream))
}

pub fn parse_server_version(req_id: &str, rsp: &Response) -> Result<ServerVersion> {
    let version = rsp
        .headers()
        .get("phalanx-version")
        .map(|v| {
            let v = v.to_str().map_err(|e| crate::Error::Http {
                source: e.into(),
                request_id: req_id.to_string(),
                status_code: Some(rsp.status()),
            })?;
            ServerVersion::parse(v).map_err(|e| crate::Error::Http {
                source: e.into(),
                request_id: req_id.to_string(),
                status_code: Some(rsp.status()),
            })
        })
        .transpose()?
        .unwrap_or_default();
    Ok(version)
}

```

### Core Architecture Module: `rust/lancedb/src/utils/background_cache.rs`
```
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: Copyright The LanceDB Authors

//! A cache that refreshes values in the background before they expire.
//!
//! See [`BackgroundCache`] for details.

use std::future::Future;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use futures::FutureExt;
use futures::future::{BoxFuture, Shared};

type SharedFut<V, E> = Shared<BoxFuture<'static, Result<V, Arc<E>>>>;

enum State<V, E> {
    Empty,
    Current(V, clock::Instant),
    Refreshing {
        previous: Option<(V, clock::Instant)>,
        future: SharedFut<V, E>,
    },
}

impl<V: Clone, E> State<V, E> {
    fn fresh_value(&self, ttl: Duration, refresh_window: Duration) -> Option<V> {
        let fresh_threshold = ttl - refresh_window;
        match self {
            Self::Current(value, cached_at) => {
                if clock::now().duration_since(*cached_at) < fresh_threshold {
                    Some(value.clone())
                } else {
                    None
                }
            }
            Self::Refreshing {
                previous: Some((value, cached_at)),
                ..
            } => {
                if clock::now().duration_since(*cached_at) < fresh_threshold {
                    Some(value.clone())
                } else {
                    None
                }
            }
            _ => None,
        }
    }
}

struct CacheInner<V, E> {
    state: State<V, E>,
    /// Incremented on invalidation. Background fetches check this to avoid
    /// overwriting with stale data after a concurrent invalidation.
    generation: u64,
}

enum Action<V, E> {
    Return(V),
    Wait(SharedFut<V, E>),
}

/// A cache that refreshes values in the background before they expire.
///
/// The cache has three states:
/// - **Empty**: No cached value. The next [`get()`](Self::get) blocks until a fetch completes.
/// - **Current**: A valid cached value with a timestamp. Returns immediately if fresh.
/// - **Refreshing**: A fetch is in progress. Returns the previous value if still valid,
///   otherwise blocks until the fetch completes.
///
/// When the cached value enters the refresh window (close to TTL expiry),
/// [`get()`](Self::get) starts a background fetch and returns the current value
/// immediately. Multiple concurrent callers share a single in-flight fetch.
pub struct BackgroundCache<V, E> {
    inner: Arc<Mutex<CacheInner<V, E>>>,
    ttl: Duration,
    refresh_window: Duration,
}

impl<V, E> std::fmt::Debug for BackgroundCache<V, E> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("BackgroundCache")
            .field("ttl", &self.ttl)
            .field("refresh_window", &self.refresh_window)
            .finish_non_exhaustive()
    }
}

impl<V, E> Clone for BackgroundCache<V, E> {
    fn clone(&self) -> Self {
        Self {
            inner: self.inner.clone(),
            ttl: self.ttl,
            refresh_window: self.refresh_window,
        }
    }
}

impl<V, E> BackgroundCache<V, E>
where
    V: Clone + Send + Sync + 'static,
    E: Send + Sync + 'static,
{
    pub fn new(ttl: Duration, refresh_window: Duration) -> Self {
        assert!(
            refresh_window < ttl,
            "refresh_window ({refresh_window:?}) must be less than ttl ({ttl:?})"
        );
        #[cfg(test)]
        {
            // Tests may advance the thread-local mock clock and leave it behind for
            // the next test that happens to run on the same worker thread. Each new
            // cache should start from a clean clock state instead of inheriting
            // unrelated mock time from a previous test.
            clock::clear_mock();
        }
        Self {
            inner: Arc::new(Mutex::new(CacheInner {
                state: State::Empty,
                generation: 0,
            })),
            ttl,
            refresh_window,
        }
    }

    /// Returns the cached value if it's fresh (not in the refresh window).
    ///
    /// This is a cheap synchronous check useful as a fast path before
    /// constructing a fetch closure for [`get()`](Self::get).
    pub fn try_get(&self) -> Option<V> {
        let cache = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        cache.state.fresh_value(self.ttl, self.refresh_window)
    }

    /// Get the cached value, fetching if needed.
    ///
    /// The closure is called to create the fetch future only when a new fetch
    /// is needed. If the cache already has an in-flight fetch, the closure is
    /// not called and the caller joins the existing fetch.
    pub async fn get<F, Fut>(&self, fetch: F) -> Result<V, Arc<E>>
    where
        F: FnOnce() -> Fut + Send + 'static,
        Fut: Future<Output = Result<V, E>> + Send + 'static,
    {
        // Fast path: check if cache is fresh
        {
            let cache = self.inner.lock().unwrap_or_else(|e| e.into_inner());
            if let Some(value) = cache.state.fresh_value(self.ttl, self.refresh_window) {
                return Ok(value);
            }
        }

        // Slow path
        let mut fetch = Some(fetch);
        let action = {
            let mut cache = self.inner.lock().unwrap_or_else(|e| e.into_inner());
            self.determine_action(&mut cache, &mut fetch)
        };

        match action {
            Action::Return(value) => Ok(value),
            Action::Wait(fut) => fut.await,
        }
    }

    /// Pre-populate the cache with an initial value.
    ///
    /// This avoids a blocking fetch on the first [`get()`](Self::get) call.
    pub fn seed(&self, value: V) {
        let mut cache = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        cache.state = State::Current(value, clock::now());
    }

    /// Invalidate the cache. The next [`get()`](Self::get) will start a fresh fetch.
    ///
    /// Any in-flight background fetch from before this call will not update the
    /// cache (the generation counter prevents stale writes).
    pub fn invalidate(&self) {
        let mut cache = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        cache.state = State::Empty;
        cache.generation += 1;
    }

    fn determine_action<F, Fut>(
        &self,
        cache: &mut CacheInner<V, E>,
        fetch: &mut Option<F>,
    ) -> Action<V, E>
    where
        F: FnOnce() -> Fut + Send + 'static,
        Fut: Future<Output = Result<V, E>> + Send + 'static,
    {
        match &cache.state {
            State::Empty => {
                let f = fetch
                    .take()
                    .expect("fetch closure required for empty cache");
                let shared = self.start_fetch(cache, f, None);
                Action::Wait(shared)
            }
            State::Current(value, cached_at) => {
                let elapsed = clock::now().duration_since(*cached_at);
                if elapsed < self.ttl - self.refresh_window {
                    Action::Return(value.clone())
                } else if elapsed < self.ttl {
                    // In refresh window: start background fetch, return current value
                    let value = value.clone();
                    let previous = Some((value.clone(), *cached_at));
                    if let Some(f) = fetch.take() {
                        // The spawned task inside start_fetch drives the future;
                        // we don't need to await the returned handle here.
                        drop(self.start_fetch(cache, f, previous));
                    }
                    Action::Return(value)
                } else {
                    // Expired: must wait for fetch
                    let previous = Some((value.clone(), *cached_at));
                    let f = fetch
                        .take()
                        .expect("fetch closure required for expired cache");
                    let shared = self.start_fetch(cache, f, previous);
                    Action::Wait(shared)
                }
            }
            State::Refreshing { previous, future } => {
                // If the background fetch already completed (spawned task hasn't
                // run yet to update state), transition the state and re-evaluate.
                if let Some(result) = future.peek() {
                    match result {
                        Ok(value) => {
                            cache.state = State::Current(value.clone(), clock::now());
                        }
                        Err(_) => {
                            cache.state = match previous.clone() {
                                Some((v, t)) => State::Current(v, t),
                                None => State::Empty,
                            };
                        }
                    }
                    return self.determine_action(cache, fetch);
                }

                if let Some((value, cached_at)) = previous {
                    if clock::now().duration_since(*cached_at) < self.ttl {
                        Action::Return(value.clone())
                    } else {
                        Action::Wait(future.clone())
                    }
                } else {
                    Action::Wait(future.clone())
                }
            }
        }
    }

    fn start_fetch<F, Fut>(
        &self,
        cache: &mut CacheInner<V, E>,
        fetch: F,
        previous: Option<(V, clock::Instant)>,
    ) -> SharedFut<V, E>
    where
        F: FnOnce() -> Fut + Send + 'static,
        Fut: Future<Output = Result<V, E>> + Send + 'static,
    {
        let generation = cache.generation;
        let shared = async move { (fetch)().await.map_err(Arc::new) }
            .boxed()
            .shared();

        // Spawn task to eagerly drive the future and update state on completion
        let inner = self.inner.clone();
        let fut_for_spawn = shared.clone();
        tokio::spawn(async move {
            let result = fut_for_spawn.await;
            let mut cach
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4434** (2026-10-05): **fix: preserve Function dependency errors in column operations**
  *Symptoms*: Function column declarations and refreshes can return HTTP 404 when the referenced Function has been deleted. The SDK currently translates those responses into `TableNotFound`, hiding the server diagnostic and making an existing table appear missing.  Preserve the HTTP error, status, and request ID for these two operations while retaining schema-cache invalidation. Ordinary table operations keep their existing `TableNotFound` behavior. 

- **Issue #4426** (2026-10-05): **fix(python): use exact integer math for list_versions timestamps**
  *Symptoms*: Refs #4404.  AsyncTable.list_versions split the nanosecond timestamp with float division/modulo (`ts // 1e9`, `ts % 1e9`).  At ~1.8e18 a float can't hold every integer, so the microseconds drifted (.274000 came back as .273999).  Use `divmod(ts, 1_000_000_000)` and integer // 1000 instead.  Only the precision fix is included here. Timezone-aware UTC (option 1 in #4404) is on hold for now,  and I can add it here or in a follow-up depending on what they prefer.  Added test_list_versions_timestamp_precision using the value from the  issue (1790989429274000000), expecting microsecond == 274000.
  **Post-Mortem & Fix Analysis**:
  > @chrikrah Got it, thanks for the review. I added tests for both sync paths you pointed out: `LanceTable.list_versions` and `RemoteTable.list_versions`. Aware UTC is left for #4404, as discussed. 

- **Issue #4425** (2026-10-03): **fix(remote): preserve schema for empty merge insert sources**
  *Symptoms*: Remote `merge_insert` buffered its reader into a `Vec<RecordBatch>`, losing the schema when the reader yielded no batches. Scanning that vector failed before the request could reach the server.  Preserve the reader's schema in an empty record batch when buffering produces no batches. The source remains replayable for retries, and empty-source merges still reach the server so `when_not_matched_by_source_delete` can apply deletes.  The regression tests decode the outgoing Arrow IPC and verify the source schema, zero rows, merge options, and result statistics on an initial request and a retry after HTTP 409. They cover readers with no batches and readers with an empty batch, in insert and delete modes, including an ID-only delete source.  Validation: - Before the fix, both no-batch cases reproduced `Cannot scan an empty Vec<RecordBatch>`; the empty-batch cases passed. - `cargo test --quiet --profile ci --features remote -p lancedb --lib remote::table::tests::test_merge_insert` — 9 passed. - `cargo fmt --all` and `cargo fmt --all -- --check`. - `cargo clippy --quiet --profile ci --features remote -p lancedb --tests --examples`.  Fixes #4380  <!-- lance-gatekeeper-fix:v1 agent=a48c9fc83772479990d76124f3a2b3be generation=1 --> 

- **Issue #4424** (2026-10-03): **fix(python): close synchronous database connections**
  *Symptoms*: Calling `close()` on a synchronous remote connection returned an unawaited coroutine and left the connection usable. Local synchronous connections had no close or context-manager API.  Add synchronous `close()` and `is_open()` to the connection interface, delegate them to the existing connection handle for local, remote, and namespace connections, and provide shared context-manager cleanup. Closing is idempotent, and subsequent database operations use the existing `Connection is closed` error. Document the lifecycle with examples.  Validation:  - Reproduced the reported coroutine warning and missing local lifecycle API on the original code; all 15 new regression cases failed before the fix. - All 168 tests in `test_db.py`, `test_remote_db.py`, and `test_namespace.py` passed through the uv-managed environment, including local, in-memory, namespace, native-derived, and mocked remote lifecycle coverage. - All 6 synchronous connection doctests passed. - Repository-wide Ruff 0.9.9 lint and formatting passed; `git diff --check` passed.  Fixes #4382  <!-- lance-gatekeeper-fix:v1 agent=a743139af98198f1d4c8934c9cc1d0c9 generation=1 --> 

- **Issue #4423** (2026-10-03): **fix(node): preserve schemas for empty query results**
  *Symptoms*: Empty local TypeScript queries returned a zero-row Arrow table with no columns because `toArrow()` built the table solely from record batches. Local streams can yield no batches, while remote streams often supply an empty batch carrying the schema.  Expose the executed stream's schema through the native iterator and decode it into an empty Arrow table when no batches arrive. This preserves projected and search columns, types, nullability, and metadata without executing another query. Document the empty-result behavior.  Validation:  - Eleven regression cases failed with the original `toArrow()` implementation; all twelve now pass, including remote schema-only and empty-batch responses. - All 1,075 tests in the query, remote, Arrow, and table suites pass. - Native build, TypeScript compilation, Rust formatting and Clippy (`-D warnings`), TypeScript lint/formatting, and documentation generation pass.  Fixes #4386  <!-- lance-gatekeeper-fix:v1 agent=7d589da1f7db5c7383f9600490e111a9 generation=1 --> 

- **Issue #4422** (2026-10-03): **fix(python): repair sync manifest path migration**
  *Symptoms*: Fixes #4383  `LanceTable.migrate_v2_manifest_paths()` raised `AttributeError` because it called a nonexistent `AsyncTable.migrate_v2_manifest_paths()` method. Delegate to the existing async method, `migrate_manifest_paths_v2()`, while preserving the public sync API.  Add a local regression test for tables starting with either v1 or v2 manifest paths. It checks repeated migration, v2 manifest filenames on disk, and preservation of data and version history after reopening the table.  Validation: - Both new regression cases failed with the reported `AttributeError` before the fix. - `cd python && uv run --extra tests pytest python/tests/test_table.py::test_migrate_v2_manifest_paths python/tests/test_db.py::test_create_table_v2_manifest_paths_async -q` — 3 passed. - Repository-wide `ruff check .` and `ruff format .` passed using Ruff 0.15.20 from `python/uv.lock`. - `git diff --check` passed.  <!-- lance-gatekeeper-fix:v1 agent=bb500f0d1ddefeba3c7d7d8390a2fb74 generation=1 --> 

- **Issue #4421** (2026-10-03): **fix(python): support exist_ok in local create_table**
  *Symptoms*: Synchronous local Python `create_table` callers using `mode="exist_ok"` received `ValueError` instead of creating or opening a table.  Related to [#2900](https://github.com/lancedb/lancedb/issues/2900). The local wrapper rejected this mode before the shared Rust parser could validate it. Removing that guard delegates mode validation to the parser, and the sync and async docs now describe `exist_ok`. Remote option gaps and the TypeScript table type gap remain outside this change.  The added tests retain both calls from [@wjones127's comment](https://github.com/lancedb/lancedb/issues/2900#issuecomment-5964167206). This builds on the code @wjones127 posted there. Three regression tests fail before the change, pass after it, fail with the original `db.py` restored, then pass again on HEAD.  Tested on Linux x86_64 with Python 3.14.7. From the Python directory, `uv run --no-sync --extra tests --extra dev python -m pytest python/tests/test_db.py -q` reports 53 passed. `uv run --no-sync --extra tests --extra dev python -m pytest python/tests -q -rs -m "not slow and not s3_test"` reports 1428 passed, 34 skipped, 68 deselected, and one failure: the existing `test_get_lsm_write_spec`, also failing on clean base (1425 passed, one failed). Ruff 0.9.9 `ruff format --check .` and `ruff check .` pass. Tests used worktree Python code with the released `lancedb==0.40.0b12` native wheel. No native source build was run.  Co-authored-by: Will Jones <5488879+wjones127@users.noreply.github.com> 

- **Issue #4420** (2026-10-03): **fix(python): serialize deprecated v2 manifest option**
  *Symptoms*: Local synchronous `create_table(..., enable_v2_manifest_paths=True/False)` failed with `TypeError` because the deprecated argument was forwarded as a boolean in `storage_options`, while the Rust binding expects string values.  Convert the argument to lowercase `"true"` or `"false"` before forwarding it, preserving the deprecation warning. Add regression coverage for both values with populated and schema-only tables, checking stored data and the manifest mode after reopening.  Validation: - All four regression cases reproduced the original `TypeError` before the fix and pass afterward. - `uv run --no-sync --extra tests --extra dev pytest python/tests/test_db.py -q --tb=short -m 'not slow and not s3_test'`: 54 passed. - Repository-wide `ruff format .` and `ruff check .` completed successfully.  Fixes #4384  <!-- lance-gatekeeper-fix:v1 agent=9c14955b90d0c12d6a46605ec5ef32c0 generation=1 --> 

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

### Incident Patch 1: `5f0bb98e` (2026-10-05)
**Commit Message**: fix(python): use exact integer math for list_versions timestamps (#4426)

Refs #4404.

AsyncTable.list_versions split the nanosecond timestamp with float
division/modulo (`ts // 1e9`, `ts % 1e9`).
At ~1.8e18 a float can't hold every integer, so the microseconds drifted
(.274000 came back as .273999).

Use `divmod(ts, 1_000_000_000)` and integer // 1000 instead.

Only the precision fix is included here. Timezone-aware UTC (option 1 in
#4404) is on hold for now,
and I can add it here or in a follow-up depending on what they prefer.

Added test_list_versions_timestamp_precision using the value from the 
issue (1790989429274000000), expecting microsecond == 274000.

**File**: `python/python/lancedb/table.py` (modified, +5/-3)
```diff
@@ -6925,9 +6925,11 @@ async def list_versions(self):
         """
         versions = await self._inner.list_versions()
         for v in versions:
-            ts_nanos = v["timestamp"]
-            v["timestamp"] = datetime.fromtimestamp(ts_nanos // 1e9) + timedelta(
-                microseconds=(ts_nanos % 1e9) // 1e3
+            # Use integer math: float division on ~1e18 nanosecond
+            # values loses sub-millisecond precision.
+            seconds, nanos = divmod(v["timestamp"], 1_000_000_000)
+            v["timestamp"] = datetime.fromtimestamp(seconds) + timedelta(
+                microseconds=nanos // 1000
             )
 
         return versions
```

**File**: `python/python/tests/test_table.py` (modified, +57/-0)
```diff
@@ -993,6 +993,63 @@ def test_polars(mem_db: DBConnection):
     assert len(filtered_result) == 2
 
 
+@pytest.mark.asyncio
+async def test_list_versions_timestamp_precision():
+    # 2026-10-03T01:03:49.274Z in nanoseconds. Float math turns .274000 into
+    # .273999, so make sure the conversion is exact.
+    ts_nanos = 1790989429274000000
+
+    class FakeInner:
+        async def list_versions(self):
+            return [{"version": 1, "timestamp": ts_nanos, "metadata": {}}]
+
+    table = table_module.AsyncTable(FakeInner())
+    versions = await table.list_versions()
+
+    expected = datetime.fromtimestamp(ts_nanos // 1_000_000_000)
+    assert versions[0]["timestamp"] == expected + timedelta(microseconds=274000)
+    assert versions[0]["timestamp"].microsecond == 274000
+
+
+def test_list_versions_timestamp_precision_sync(mem_db: DBConnection):
+    # The sync LanceTable.list_versions delegates to AsyncTable.list_versions,
+    # which is the path the parity report hit.
+    ts_nanos = 1790989429274000000
+
+    class FakeInner:
+        async def list_versions(self):
+            return [{"version": 1, "timestamp": ts_nanos, "metadata": {}}]
+
+    table = mem_db.create_table("ts_precision", data=[{"id": 1}])
+    table._table = table_module.AsyncTable(FakeInner())
+    versions = table.list_versions()
+
+    expected = datetime.fromtimestamp(ts_nanos // 1_000_000_000)
+    assert versions[0]["timestamp"] == expected + timedelta(microseconds=274000)
+    assert versions[0]["timestamp"].microsecond == 274000
+
+
+def test_list_versions_timestamp_precision_remote():
+    # RemoteTable.list_versions also delegates to AsyncTable.list_versions.
+    from lancedb.remote.table import RemoteTable
+
+    ts_nanos = 1790989429274000000
+
+    class FakeInner:
+        def name(self):
+            return "ts_precision"
+
+        async def list_versions(self):
+            return [{"version": 1, "timestamp": ts_nanos, "metadata": {}}]
+
+    table = RemoteTable(table_module.AsyncTable(FakeInner()), "dev")
+    versions = table.list_versions()
+
+    expected = datetime.fromtimestamp(ts_nanos // 1_000_000_000)
+    assert versions[0]["timestamp"] == expected + timedelta(microseconds=274000)
+    assert versions[0]["timestamp"].microsecond == 274000
+
+
 def test_versioning(mem_db: DBConnection):
     table = mem_db.create_table(
         "test",
```

---

### Incident Patch 2: `61a285f5` (2026-10-05)
**Commit Message**: fix: preserve Function dependency errors in column operations (#4434)

Function column declarations and refreshes can return HTTP 404 when the
referenced Function has been deleted. The SDK currently translates those
responses into `TableNotFound`, hiding the server diagnostic and making
an existing table appear missing.

Preserve the HTTP error, status, and request ID for these two operations
while retaining schema-cache invalidation. Ordinary table operations
keep their existing `TableNotFound` behavior.

**File**: `rust/lancedb/src/remote/table.rs` (modified, +80/-3)
```diff
@@ -3523,7 +3523,12 @@ impl<S: HttpSend> BaseTable for RemoteTable<S> {
         let (request_id, response) = self
             .send_with_freshness(request, true, freshness_request)
             .await?;
-        let response = self.check_table_response(&request_id, response).await?;
+        // A Function declaration can return 404 for the Function rather than the table.
+        let response = self
+            .client
+            .check_response(&request_id, response)
+            .await
+            .inspect_err(|error| self.handle_error_invalidation(error))?;
         let body = response.text().await.err_to_http(request_id.clone())?;
 
         if body.trim().is_empty() {
@@ -3563,7 +3568,12 @@ impl<S: HttpSend> BaseTable for RemoteTable<S> {
             .post(&format!("/v1/table/{}/backfill_column", self.identifier))
             .json(&body);
         let (request_id, response) = self.send(request, true).await?;
-        let response = self.check_table_response(&request_id, response).await?;
+        // Preserve dependency errors: a deleted bound Function also returns 404.
+        let response = self
+            .client
+            .check_response(&request_id, response)
+            .await
+            .inspect_err(|error| self.handle_error_invalidation(error))?;
         let body = response.text().await.err_to_http(request_id.clone())?;
 
         #[derive(serde::Deserialize)]
@@ -4057,7 +4067,7 @@ mod tests {
             ))
         };
 
-        // All endpoints should translate 404 to TableNotFound.
+        // These table operations should translate 404 to TableNotFound.
         let results: Vec<BoxFuture<'_, Result<()>>> = vec![
             Box::pin(table.version().map_ok(|_| ())),
             Box::pin(table.schema().map_ok(|_| ())),
@@ -8793,6 +8803,73 @@ mod tests {
         );
     }
 
+    #[rstest]
+    #[case(false, "Function is unavailable")]
+    #[case(true, "Function name was not found")]
+    #[tokio::test]
+    async fn test_function_column_operations_preserve_dependency_not_found(
+        #[case] declare_column: bool,
+        #[case] message: &'static str,
+    ) {
+        let schema_requests = Arc::new(AtomicUsize::new(0));
+        let requests = schema_requests.clone();
+        let table = Table::new_with_handler("my_table", move |request| {
+            match request.url().path() {
+                "/v1/table/my_table/describe/" => {
+                    requests.fetch_add(1, Ordering::SeqCst);
+                    http::Response::builder()
+                        .status(200)
+                        .body(
+                            r#"{"version":1,"schema":{"fields":[{"name":"description","nullable":true,"type":{"type":"string"}}]}}"#.to_string(),
+                        )
+                        .unwrap()
+                }
+                "/v1/table/my_table/backfill_column" | "/v1/table/my_table/add_columns/" => {
+                    http::Response::builder()
+                        .status(404)
+                        .body(json!({"code": 4, "error": message}).to_string())
+                        .unwrap()
+                }
+                path => panic!("unexpected request: {path}"),
+            }
+        });
+        table.schema().await.unwrap();
+        assert_eq!(schema_requests.load(Ordering::SeqCst), 1);
+
+        let error = if declare_column {
+            let fixture: serde_json::Value = serde_json::from_str(include_str!(
+                "../../tests/fixtures/first_class_functions/v1/remote_fixed_size_declaration_request.json"
+            ))
+            .unwrap();
+            let application = crate::function::FunctionApplication::from_json(
+                &fixture["function"]["application"].to_string(),
+            )
+            .unwrap();
+            table
+                .add_columns()
+                .function_as("embedding", application)
+                .execute()
+                .await
+                .unwrap_err()
+        } else {
+            table.refresh_column_async("embedding").await.unwrap_err()
+        };
+        let Error::Http {
+            source,
+            status_code,
+            request_id,
+        } = error
+        else {
+            panic!("dependency 404 was misclassified: {error:?}");
+        };
+        assert_eq!(status_code, Some(StatusCode::NOT_FOUND));
+        assert!(source.to_string().contains(message));
+        assert!(!request_id.is_empty());
+
+        table.schema().await.unwrap();
+        assert_eq!(schema_requests.load(Ordering::SeqCst), 2);
+    }
+
     /// The error listing is table-addressed with optional job and column
     /// filters, mirroring the server's SQL surface, and the two non-record
     /// signals come back as their own fields rather than as rows.
```

---

### Incident Patch 3: `7f593359` (2026-10-04)
**Commit Message**: fix(python): reject empty query vectors before column inference (#4415)

Empty list and NumPy vector queries were validated too late: local
search inferred a vector column first, producing misleading schema
errors, while remote search indexed `vector[0]` and raised `IndexError`.

Add a shared empty-vector check before column inference and query
creation, and validate direct vector-builder inputs. Local and remote
sync search now raise `ValueError: Query vector must not be empty` for
these inputs.

Validation:

- All 26 new regression cases failed on the original code and pass with
the fix, covering list/NumPy inputs, automatic/explicit vector search,
inferred/explicit column names, one/two local vector columns, and remote
search before query submission.
- After merging current `main`, all 32 focused cases passed, covering
these regressions and upstream async searches without a query.
- The query, table, remote, utility, hybrid-query, and database suites
passed in the rebuilt uv environment: 541 passed, 1 skipped, 1 slow test
deselected.
- `ruff check .`, `ruff format .`, and `cargo fmt --all` passed from the
repository root.

Fixes #4389

<!-- lance-gatekeeper-fix:v1 agent=f1f48750

**File**: `python/python/lancedb/query.py` (modified, +5/-1)
```diff
@@ -40,7 +40,7 @@
 from .rerankers.rrf import RRFReranker
 from .rerankers.util import check_reranker_result
 from .schema import is_blob_like_field, schema_has_blob_field
-from .util import flatten_columns
+from .util import _validate_query_vector, flatten_columns
 from . import _wal_hybrid  # WAL-PK-FUSION: delete.
 from ._blob import (
     BLOB_MODE_TO_HANDLING,
@@ -907,6 +907,9 @@ def create(
         fast_search: bool
             Skip flat search of unindexed data.
         """
+        if query_type != "fts":
+            _validate_query_vector(query)
+
         if ordering_field_name is not None:
             import warnings
 
@@ -1619,6 +1622,7 @@ def __init__(
         str_query: Optional[str] = None,
         fast_search: bool = None,
     ):
+        _validate_query_vector(query)
         super().__init__(table)
         self._query = query
         self._distance_type = None
```

**File**: `python/python/lancedb/util.py` (modified, +11/-0)
```diff
@@ -280,6 +280,14 @@ def infer_vector_column_dim(data_type: pa.DataType) -> Optional[int]:
     return None
 
 
+def _validate_query_vector(query: Any) -> None:
+    """Reject empty vector inputs before vector-column inference or execution."""
+    if (isinstance(query, list) and not query) or (
+        isinstance(query, np.ndarray) and query.size == 0
+    ):
+        raise ValueError("Query vector must not be empty")
+
+
 def _query_vector_dim(query: Optional[Any]) -> Optional[int]:
     if query is None:
         return None
@@ -301,6 +309,9 @@ def infer_vector_column_name(
     query: Optional[Any],  # inferred later in query builder
     vector_column_name: Optional[str],
 ):
+    if query_type != "fts":
+        _validate_query_vector(query)
+
     if vector_column_name is not None:
         return vector_column_name
 
```

**File**: `python/python/tests/test_query.py` (modified, +6/-0)
```diff
@@ -2138,6 +2138,12 @@ def test_ensure_vector_query_nested_empty_list():
         ensure_vector_query([[]])
 
 
+@pytest.mark.parametrize("query", [[], np.array([], dtype=np.float32)])
+def test_vector_query_builder_empty_vector(table, query):
+    with pytest.raises(ValueError, match="^Query vector must not be empty$"):
+        LanceVectorQueryBuilder(table, query, "vector")
+
+
 def test_fast_search(tmp_path):
     db = lancedb.connect(tmp_path)
 
```

**File**: `python/python/tests/test_remote_db.py` (modified, +15/-0)
```diff
@@ -16,6 +16,7 @@
 from packaging.version import Version
 
 import lancedb
+import numpy as np
 from lancedb.conftest import MockTextEmbeddingFunction
 from lancedb.query import AsyncQuery, ColumnOrdering
 from lancedb.remote import ClientConfig
@@ -1592,6 +1593,20 @@ def handler(body):
         assert data == expected
 
 
+@pytest.mark.parametrize("query", [[], np.array([], dtype=np.float32)])
+@pytest.mark.parametrize("vector_column_name", [None, "vector"])
+@pytest.mark.parametrize("query_type", ["auto", "vector"])
+def test_query_sync_empty_vector(query, vector_column_name, query_type):
+    def handler(body):
+        pytest.fail("An empty query vector must be rejected before sending a query")
+
+    with query_test_table(handler) as table:
+        with pytest.raises(ValueError, match="^Query vector must not be empty$"):
+            table.search(
+                query, vector_column_name=vector_column_name, query_type=query_type
+            ).limit(3).to_arrow()
+
+
 @pytest.mark.asyncio
 @pytest.mark.parametrize("search_kwargs", [{}, {"query": None}])
 async def test_async_search_without_query(search_kwargs):
```

**File**: `python/python/tests/test_table.py` (modified, +18/-0)
```diff
@@ -3777,6 +3777,24 @@ def test_empty_query(mem_db: DBConnection):
     assert df.num_rows == 42
 
 
+@pytest.mark.parametrize("query", [[], np.array([], dtype=np.float32)])
+@pytest.mark.parametrize("vector_column_name", [None, "vector"])
+@pytest.mark.parametrize("query_type", ["auto", "vector"])
+@pytest.mark.parametrize("multiple_vector_columns", [False, True])
+def test_search_empty_vector(
+    mem_db, query, vector_column_name, query_type, multiple_vector_columns
+):
+    fields = [pa.field("vector", pa.list_(pa.float32(), 8))]
+    if multiple_vector_columns:
+        fields.append(pa.field("vec2", pa.list_(pa.float32(), 4)))
+    table = mem_db.create_table("empty_vector_query", schema=pa.schema(fields))
+
+    with pytest.raises(ValueError, match="^Query vector must not be empty$"):
+        table.search(
+            query, vector_column_name=vector_column_name, query_type=query_type
+        ).limit(3).to_arrow()
+
+
 def test_search_with_schema_inf_single_vector(mem_db: DBConnection):
     class MyTable(LanceModel):
         text: str
```

---

### Incident Patch 4: `3e0a1a87` (2026-10-04)
**Commit Message**: fix: reject zero vector search probes across SDKs (#4418)

`nprobes(0)` bypassed the validation used by the minimum and maximum
probe setters, allowing zero into query requests and producing
inconsistent local and remote results. Sync Python could additionally
interpret the zero maximum as an unbounded search.

Reject zero in the Rust vector-query builder and propagate its input
error through the Python vector/hybrid and Node bindings. Validate
nonpositive counts in the sync Python vector and hybrid builders so
every SDK and backend reports `nprobes must be greater than 0` before
execution. Update the Rust examples and document the positive-count
requirement.

Regression tests cover local and remote vector/hybrid builders,
rejection before remote query requests, promised TypeScript query
vectors, and positive counts replacing both probe bounds.

Validation:

- Rust probe regression tests: 2 passed.
- Focused Python query, remote, hybrid, and serialization tests: 22
passed. The four sync regression cases fail with the original setters.
- Focused TypeScript indexed local and mocked remote tests: 2 passed.
- Workspace `cargo check --features remote --tests --examples` and
Clippy passe

**File**: `docs/src/js/classes/VectorQuery.md` (modified, +2/-0)
```diff
@@ -447,6 +447,8 @@ nprobes(nprobes): VectorQuery
 
 Set the number of partitions to search (probe)
 
+The number of probes must be greater than 0.
+
 This argument is only used when the vector column has an IVF PQ index.
 If there is no index then this value is ignored.
 
```

**File**: `nodejs/__test__/remote.test.ts` (modified, +32/-0)
```diff
@@ -93,6 +93,38 @@ async function withMockDatabase(
 }
 
 describe("remote connection", () => {
+  it("rejects nprobes(0) before sending a query", async () => {
+    const requests: string[] = [];
+    await withMockDatabase(
+      (req, res) => {
+        requests.push(req.url ?? "");
+        if (req.url === "/v1/table/test/describe/") {
+          res
+            .writeHead(200, { "Content-Type": "application/json" })
+            .end(JSON.stringify({ version: 1, schema: { fields: [] } }));
+        } else {
+          res.writeHead(404).end();
+        }
+      },
+      async (db) => {
+        const table = await db.openTable("test");
+        expect(() => table.vectorSearch([0, 0]).nprobes(0)).toThrow(
+          "Invalid input, nprobes must be greater than 0",
+        );
+        expect(() =>
+          table.query().nearestTo([0, 0]).fullTextSearch("dog").nprobes(0),
+        ).toThrow("Invalid input, nprobes must be greater than 0");
+        await expect(
+          table
+            .vectorSearch(Promise.resolve([0, 0]))
+            .nprobes(0)
+            .toArrow(),
+        ).rejects.toThrow("Invalid input, nprobes must be greater than 0");
+      },
+    );
+    expect(requests).toEqual(["/v1/table/test/describe/"]);
+  });
+
   it.each([false, true])(
     "preserves an empty query's schema with an empty batch: %s",
     async (withEmptyBatch) => {
```

**File**: `nodejs/__test__/table.test.ts` (modified, +6/-0)
```diff
@@ -1211,6 +1211,12 @@ describe("When creating an index", () => {
       .toArrow();
     expect(rst.numRows).toBe(2);
 
+    expect(() => tbl.vectorSearch(queryVec).nprobes(0)).toThrow(
+      "Invalid input, nprobes must be greater than 0",
+    );
+    expect(() =>
+      tbl.query().nearestTo(queryVec).fullTextSearch("dog").nprobes(0),
+    ).toThrow("Invalid input, nprobes must be greater than 0");
     expect(() => tbl.query().nearestTo(queryVec).minimumNprobes(0)).toThrow(
       "Invalid input, minimum_nprobes must be greater than 0",
     );
```

**File**: `nodejs/lancedb/query.ts` (modified, +2/-0)
```diff
@@ -519,6 +519,8 @@ export class VectorQuery extends StandardQueryBase<NativeVectorQuery> {
   /**
    * Set the number of partitions to search (probe)
    *
+   * The number of probes must be greater than 0.
+   *
    * This argument is only used when the vector column has an IVF PQ index.
    * If there is no index then this value is ignored.
    *
```

**File**: `nodejs/src/query.rs` (modified, +7/-2)
```diff
@@ -289,8 +289,13 @@ impl VectorQuery {
     }
 
     #[napi]
-    pub fn nprobes(&mut self, nprobe: u32) {
-        self.inner = self.inner.clone().nprobes(nprobe as usize);
+    pub fn nprobes(&mut self, nprobe: u32) -> napi::Result<()> {
+        self.inner = self
+            .inner
+            .clone()
+            .nprobes(nprobe as usize)
+            .default_error()?;
+        Ok(())
     }
 
     #[napi]
```

**File**: `python/python/lancedb/query.py` (modified, +8/-2)
```diff
@@ -1693,13 +1693,15 @@ def nprobes(self, nprobes: int) -> LanceVectorQueryBuilder:
         Parameters
         ----------
         nprobes: int
-            The number of probes to use.
+            The number of probes to use. Must be greater than 0.
 
         Returns
         -------
         LanceVectorQueryBuilder
             The LanceQueryBuilder object.
         """
+        if nprobes <= 0:
+            raise ValueError("Invalid input, nprobes must be greater than 0")
         self._minimum_nprobes = nprobes
         self._maximum_nprobes = nprobes
         return self
@@ -2495,13 +2497,15 @@ def nprobes(self, nprobes: int) -> LanceHybridQueryBuilder:
         Parameters
         ----------
         nprobes: int
-            The number of probes to use.
+            The number of probes to use. Must be greater than 0.
 
         Returns
         -------
         LanceHybridQueryBuilder
             The LanceHybridQueryBuilder object.
         """
+        if nprobes <= 0:
+            raise ValueError("Invalid input, nprobes must be greater than 0")
         self._minimum_nprobes = nprobes
         self._maximum_nprobes = nprobes
         return self
@@ -3654,6 +3658,8 @@ def nprobes(self, nprobes: int) -> Self:
         """
         Set the number of partitions to search (probe)
 
+        The number of probes must be greater than 0.
+
         This argument is only used when the vector column has an IVF-based index.
         If there is no index then this value is ignored.
 
```

**File**: `python/python/tests/test_query.py` (modified, +25/-0)
```diff
@@ -975,6 +975,19 @@ def test_query_builder_with_filter(table):
     assert all(np.array(rs[0]["vector"]) == [3, 4])
 
 
+@pytest.mark.parametrize("query_type", ["vector", "hybrid"])
+@pytest.mark.parametrize("nprobes", [0, -1])
+def test_nprobes_nonpositive_sync(table, query_type, nprobes):
+    if query_type == "hybrid":
+        query = table.search(query_type="hybrid").vector([0, 0]).text("a")
+    else:
+        query = table.search([0, 0])
+    with pytest.raises(
+        ValueError, match="^Invalid input, nprobes must be greater than 0$"
+    ):
+        query.nprobes(nprobes)
+
+
 def test_invalid_nprobes_sync(table):
     with pytest.raises(ValueError, match="minimum_nprobes must be greater than 0"):
         LanceVectorQueryBuilder(table, [0, 0], "vector").minimum_nprobes(0).to_list()
@@ -1006,6 +1019,18 @@ def test_multiple_nprobes_calls_works_sync(table):
     ).minimum_nprobes(20).to_list()
 
 
+@pytest.mark.asyncio
+@pytest.mark.parametrize("hybrid", [False, True])
+async def test_nprobes_zero_async(table_async: AsyncTable, hybrid):
+    query = table_async.query().nearest_to([0, 0])
+    if hybrid:
+        query = query.nearest_to_text("dog")
+    with pytest.raises(
+        ValueError, match="^Invalid input, nprobes must be greater than 0$"
+    ):
+        query.nprobes(0)
+
+
 @pytest.mark.asyncio
 async def test_invalid_nprobes_async(table_async: AsyncTable):
     with pytest.raises(ValueError, match="minimum_nprobes must be greater than 0"):
```

**File**: `python/python/tests/test_remote_db.py` (modified, +47/-0)
```diff
@@ -1692,6 +1692,53 @@ def handler(body):
         )
 
 
+@pytest.mark.parametrize("hybrid", [False, True])
+def test_query_sync_nprobes_zero(hybrid):
+    query_requests = []
+
+    def handler(body):
+        query_requests.append(body)
+        return pa.table({"id": []})
+
+    with query_test_table(handler) as table:
+        if hybrid:
+            query = table.search(query_type="hybrid").vector([1, 2, 3]).text("dog")
+        else:
+            query = table.search([1, 2, 3])
+        with pytest.raises(
+            ValueError, match="^Invalid input, nprobes must be greater than 0$"
+        ):
+            query.nprobes(0)
+
+    assert query_requests == []
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("hybrid", [False, True])
+async def test_query_async_nprobes_zero(hybrid):
+    requests = []
+
+    def handler(request):
+        requests.append(request.path)
+        if request.path == "/v1/table/test/describe/":
+            send_json(request, {"version": 1, "schema": {"fields": []}})
+        else:
+            request.send_response(404)
+            request.end_headers()
+
+    async with mock_lancedb_connection_async(handler) as db:
+        table = await db.open_table("test")
+        query = table.query().nearest_to([1, 2, 3])
+        if hybrid:
+            query = query.nearest_to_text("dog")
+        with pytest.raises(
+            ValueError, match="^Invalid input, nprobes must be greater than 0$"
+        ):
+            query.nprobes(0)
+
+    assert requests == ["/v1/table/test/describe/"]
+
+
 def test_query_sync_nprobes():
     def handler(body):
         assert body == {
```

---

### Incident Patch 5: `0be3ae96` (2026-10-03)
**Commit Message**: fix(python): support exist_ok in local create_table (#4421)

Synchronous local Python `create_table` callers using `mode="exist_ok"`
received `ValueError` instead of creating or opening a table.

Related to [#2900](https://github.com/lancedb/lancedb/issues/2900). The
local wrapper rejected this mode before the shared Rust parser could
validate it. Removing that guard delegates mode validation to the
parser, and the sync and async docs now describe `exist_ok`. Remote
option gaps and the TypeScript table type gap remain outside this
change.

The added tests retain both calls from [@wjones127's
comment](https://github.com/lancedb/lancedb/issues/2900#issuecomment-5964167206).
This builds on the code @wjones127 posted there. Three regression tests
fail before the change, pass after it, fail with the original `db.py`
restored, then pass again on HEAD.

Tested on Linux x86_64 with Python 3.14.7. From the Python directory,
`uv run --no-sync --extra tests --extra dev python -m pytest
python/tests/test_db.py -q` reports 53 passed. `uv run --no-sync --extra
tests --extra dev python -m pytest python/tests -q -rs -m "not slow and
not s3_test"` reports 1428 passed, 34 skipped, 68 deselected, and

**File**: `python/python/lancedb/db.py` (modified, +5/-5)
```diff
@@ -409,9 +409,10 @@ def create_table(
             - [LanceModel][lancedb.pydantic.LanceModel]
         mode: str; default "create"
             The mode to use when creating the table.
-            Can be either "create" or "overwrite".
+            Can be "create", "overwrite", or "exist_ok".
             By default, if the table already exists, an exception is raised.
             If you want to overwrite the table, use mode="overwrite".
+            To open an existing table without adding data, use mode="exist_ok".
         exist_ok: bool, default False
             If a table by the same name already exists, then raise an exception
             if exist_ok=False. If exist_ok=True, then open the existing table;
@@ -1546,8 +1547,6 @@ def create_table(
         """
         if namespace_path is None:
             namespace_path = []
-        if mode.lower() not in ["create", "overwrite"]:
-            raise ValueError("mode must be either 'create' or 'overwrite'")
         validate_table_name(name)
 
         tbl = LanceTable.create(
@@ -2350,11 +2349,12 @@ async def create_table(
             - pyarrow.Schema
 
             - [LanceModel][lancedb.pydantic.LanceModel]
-        mode: Literal["create", "overwrite"]; default "create"
+        mode: Literal["create", "overwrite", "exist_ok"]; default "create"
             The mode to use when creating the table.
-            Can be either "create" or "overwrite".
+            Can be "create", "overwrite", or "exist_ok".
             By default, if the table already exists, an exception is raised.
             If you want to overwrite the table, use mode="overwrite".
+            To open an existing table without adding data, use mode="exist_ok".
         exist_ok: bool, default False
             If a table by the same name already exists, then raise an exception
             if exist_ok=False. If exist_ok=True, then open the existing table;
```

**File**: `python/python/tests/test_db.py` (modified, +34/-0)
```diff
@@ -351,6 +351,40 @@ def gen_data():
     assert await table.count_rows() == 10
 
 
+def test_create_exist_ok_mode(tmp_db: lancedb.DBConnection):
+    db = tmp_db
+    data = [{"vector": [1.1, 1.2]}, {"vector": [0.2, 1.8]}]
+    table = db.create_table("t1", data, mode="exist_ok")
+    assert table.count_rows() == 2
+    original = table.to_arrow()
+
+    reopened = db.create_table("t1", [{"vector": [9.0, 8.0]}], mode="exist_ok")
+    assert reopened.to_arrow().equals(original)
+
+
+def test_create_empty_exist_ok_mode(tmp_db: lancedb.DBConnection):
+    schema = pa.schema([pa.field("id", pa.int64())])
+    table = tmp_db.create_table("empty", schema=schema, mode="exist_ok")
+    assert table.schema == schema
+    assert table.count_rows() == 0
+    table.add([{"id": 7}])
+
+    reopened = tmp_db.create_table("empty", schema=schema, mode="exist_ok")
+    assert reopened.to_arrow().to_pylist() == [{"id": 7}]
+
+    bad_schema = pa.schema([pa.field("other", pa.int64())])
+    with pytest.raises(ValueError):
+        tmp_db.create_table("empty", schema=bad_schema, mode="exist_ok")
+
+
+def test_create_table_invalid_mode(tmp_db: lancedb.DBConnection):
+    db = tmp_db
+    data = [{"vector": [1.1, 1.2]}, {"vector": [0.2, 1.8]}]
+    with pytest.raises(ValueError, match="Invalid mode bogus"):
+        db.create_table("tb", data, mode="bogus")
+    assert "tb" not in db
+
+
 def test_create_exist_ok(tmp_db: lancedb.DBConnection):
     from conftest import pandas_string_type
 
```

---

### Incident Patch 6: `9c3e1cba` (2026-10-03)
**Commit Message**: fix: reject cloning onto an existing local table (#4416)

Local `clone_table` passed existing targets to Lance's clone
transaction, which entered the manifest-update path and failed with
`Clone operation should not enter build_manifest`.

Check the target dataset using the connection's storage options and
session before cloning, and return `TableAlreadyExists` when it exists.
Propagate other read errors. Add regression coverage for cloning onto
the source itself and onto a different existing table, with both
manifest layouts, verifying that rows and version histories remain
unchanged.

Validation:

- All four regression cases reproduced the reported internal error
before the fix.
- `cargo test --locked --quiet --profile ci --features remote -p lancedb
--lib test_clone -j 12`: 24 passed.
- `cargo fmt --all -- --check` and `git diff --check` passed.
- `cargo clippy --locked --quiet --profile ci --features remote -p
lancedb --tests --examples -j 12` passed.

Fixes #4387

<!-- lance-gatekeeper-fix:v1 agent=522c80785eeaaef146e8179c848b903e
generation=1 -->

Co-authored-by: Gatefixer <313497061+lancedb-gatefixer[bot]@users.noreply.github.com>

**File**: `rust/lancedb/src/connection.rs` (modified, +58/-0)
```diff
@@ -568,6 +568,7 @@ impl Connection {
     /// Creates a new table by cloning from an existing source table.
     /// By default, this performs a shallow clone where the new table shares
     /// the underlying data files with the source table.
+    /// The target table name must be unused. An existing table is left unchanged.
     ///
     /// # Parameters
     /// - `target_table_name`: The name of the new table to create
@@ -2193,6 +2194,63 @@ mod tests {
         assert_eq!(tables.len(), 0);
     }
 
+    #[rstest::rstest]
+    #[tokio::test]
+    async fn test_clone_table_target_already_exists(
+        #[values("source", "target")] target: &str,
+        #[values(false, true)] enable_v2_manifest_paths: bool,
+    ) {
+        use crate::query::ExecutableQuery;
+        use futures::TryStreamExt;
+
+        let tmp_dir = tempdir().unwrap();
+        let options = ListingDatabaseOptions::builder()
+            .enable_v2_manifest_paths(enable_v2_manifest_paths)
+            .build();
+        let db = connect(tmp_dir.path().to_str().unwrap())
+            .database_options(&options)
+            .execute()
+            .await
+            .unwrap();
+        let source_data = arrow_array::record_batch!(("id", Int32, [0, 1, 2])).unwrap();
+        let target_data = arrow_array::record_batch!(("id", Int32, [10, 11])).unwrap();
+        db.create_table("source", source_data.clone())
+            .execute()
+            .await
+            .unwrap();
+        db.create_table("target", target_data.clone())
+            .execute()
+            .await
+            .unwrap();
+
+        let source_uri = tmp_dir.path().join("source.lance");
+        let err = db
+            .clone_table(target, source_uri.to_str().unwrap())
+            .execute()
+            .await
+            .unwrap_err();
+        assert!(
+            matches!(&err, Error::TableAlreadyExists { name } if name == target),
+            "unexpected clone error: {err:?}"
+        );
+
+        // Reopen both tables to verify that the failed clone left their data and versions intact.
+        for (name, expected_data) in [("source", source_data), ("target", target_data)] {
+            let table = db.open_table(name).execute().await.unwrap();
+            assert_eq!(table.version().await.unwrap(), 1);
+            assert_eq!(table.list_versions().await.unwrap().len(), 1);
+            let batches = table
+                .query()
+                .execute()
+                .await
+                .unwrap()
+                .try_collect::<Vec<_>>()
+                .await
+                .unwrap();
+            assert_eq!(batches, vec![expected_data]);
+        }
+    }
+
     #[tokio::test]
     async fn test_clone_table() {
         let tmp_dir = tempdir().unwrap();
```

**File**: `rust/lancedb/src/database/listing.rs` (modified, +15/-1)
```diff
@@ -1107,6 +1107,21 @@ impl Database for ListingDatabase {
             ..Default::default()
         };
 
+        let target_uri = self.table_uri(&request.target_table_name)?;
+        match DatasetBuilder::from_uri(&target_uri)
+            .with_read_params(read_params.clone())
+            .load()
+            .await
+        {
+            Ok(_) => {
+                return Err(Error::TableAlreadyExists {
+                    name: request.target_table_name,
+                });
+            }
+            Err(lance::Error::DatasetNotFound { .. }) => {}
+            Err(err) => return Err(err.into()),
+        }
+
         let mut source_dataset = DatasetBuilder::from_uri(&request.source_uri)
             .with_read_params(read_params.clone())
             .load()
@@ -1122,7 +1137,6 @@ impl Database for ListingDatabase {
             }),
         }?;
 
-        let target_uri = self.table_uri(&request.target_table_name)?;
         source_dataset
             .shallow_clone(&target_uri, version_ref, Some(storage_params))
             .await
```

---

### Incident Patch 7: `de19ecbf` (2026-10-03)
**Commit Message**: fix: reject empty column alterations and unknown Python keys (#4417)

Fixes #4390

Lance accepts column alterations with every change field unset, so a
path-only Python call could commit a new local version without changing
the schema. The Python binding also silently discarded unknown keys such
as `nulable`.

Validate every alteration in the shared Rust `Table` API before
dispatching to either backend, and reject unknown dictionary keys in the
Python binding while preserving the legacy `name` alias. Invalid batches
leave local schema and version unchanged and send no remote request.

Validation:

- Reproduced both reported calls on the original extension: versions
advanced from 1 to 2 to 3 with an unchanged schema; all 13 new
invalid-input Python cases failed before the fix.
- Rebuilt the extension with `uv run --extra tests --extra dev maturin
develop --extras tests,dev`; all 18 focused Python cases pass across
sync/async and local/mocked remote tables.
- `cargo test --quiet --features remote -p lancedb --lib alter_column`:
all eight tests pass, including both new regressions.
- `cargo clippy --quiet --features remote --tests --examples` passes
across the workspace.
- `cargo fmt 

**File**: `python/python/lancedb/table.py` (modified, +8/-0)
```diff
@@ -2617,6 +2617,10 @@ def alter_columns(self, *alterations: Iterable[Dict[str, str]]):
                 to nullable. Currently, you cannot change a nullable column to
                 non-nullable.
 
+            Each alteration must specify at least one of "rename", "data_type",
+            or "nullable". The legacy key "name" is also accepted for renaming.
+            Unknown keys raise ValueError before any alterations are applied.
+
         Returns
         -------
         AlterColumnsResult
@@ -6874,6 +6878,10 @@ async def alter_columns(
                 to nullable. Currently, you cannot change a nullable column to
                 non-nullable.
 
+            Each alteration must specify at least one of "rename", "data_type",
+            or "nullable". The legacy key "name" is also accepted for renaming.
+            Unknown keys raise ValueError before any alterations are applied.
+
         Returns
         -------
         AlterColumnsResult
```

**File**: `python/python/tests/test_remote_db.py` (modified, +71/-0)
```diff
@@ -119,6 +119,77 @@ def handler(request):
         assert table_names == []
 
 
+@pytest.mark.parametrize(
+    "alteration, match",
+    [
+        ({"path": "id"}, "One of rename, nullable or data_type"),
+        (
+            {"path": "id", "nulable": False},  # spellchecker:disable-line
+            "Unknown column alteration key 'nulable'",  # spellchecker:disable-line
+        ),
+        (
+            {
+                "path": "id",
+                "rename": "new_id",
+                "nulable": False,  # spellchecker:disable-line
+            },
+            "Unknown column alteration key 'nulable'",  # spellchecker:disable-line
+        ),
+    ],
+)
+def test_remote_alter_columns_rejects_invalid_before_request(alteration, match):
+    requests = []
+
+    def handler(request):
+        requests.append(request.path)
+        request.send_response(200)
+        request.send_header("Content-Type", "application/json")
+        request.end_headers()
+        request.wfile.write(b'{"version": 1, "schema": {"fields": []}}')
+
+    with mock_lancedb_connection(handler) as db:
+        table = db.open_table("test")
+        requests.clear()
+
+        with pytest.raises(ValueError, match=match):
+            table.alter_columns(alteration)
+
+        assert requests == []
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize(
+    "alteration, match",
+    [
+        ({"path": "id"}, "One of rename, nullable or data_type"),
+        (
+            {"path": "id", "nulable": False},  # spellchecker:disable-line
+            "Unknown column alteration key 'nulable'",  # spellchecker:disable-line
+        ),
+    ],
+)
+async def test_async_remote_alter_columns_rejects_invalid_before_request(
+    alteration, match
+):
+    requests = []
+
+    def handler(request):
+        requests.append(request.path)
+        request.send_response(200)
+        request.send_header("Content-Type", "application/json")
+        request.end_headers()
+        request.wfile.write(b'{"version": 1, "schema": {"fields": []}}')
+
+    async with mock_lancedb_connection_async(handler) as db:
+        table = await db.open_table("test")
+        requests.clear()
+
+        with pytest.raises(ValueError, match=match):
+            await table.alter_columns(alteration)
+
+        assert requests == []
+
+
 @pytest.mark.asyncio
 async def test_async_checkout():
     def handler(request):
```

**File**: `python/python/tests/test_table.py` (modified, +65/-4)
```diff
@@ -4170,14 +4170,74 @@ async def test_add_columns_with_schema(mem_db_async: AsyncConnection):
     )
 
 
-def test_alter_columns(mem_db: DBConnection):
+@pytest.mark.parametrize("rename_key", ["rename", "name"])
+def test_alter_columns(mem_db: DBConnection, rename_key):
     data = pa.table({"id": [0, 1]})
     table = mem_db.create_table("my_table", data=data)
-    alter_columns_res = table.alter_columns({"path": "id", "rename": "new_id"})
+    alter_columns_res = table.alter_columns({"path": "id", rename_key: "new_id"})
     assert alter_columns_res.version == 2
     assert table.to_arrow().column_names == ["new_id"]
 
 
+INVALID_COLUMN_ALTERATIONS = [
+    (({"path": "id"},), "One of rename, nullable or data_type"),
+    (
+        ({"path": "id", "nulable": False},),  # spellchecker:disable-line
+        "Unknown column alteration key 'nulable'",  # spellchecker:disable-line
+    ),
+    (
+        (
+            {
+                "path": "id",
+                "rename": "new_id",
+                "nulable": False,  # spellchecker:disable-line
+            },
+        ),
+        "Unknown column alteration key 'nulable'",  # spellchecker:disable-line
+    ),
+    (
+        ({"path": "id", "rename": "new_id"}, {"path": "id"}),
+        "One of rename, nullable or data_type",
+    ),
+]
+
+
+def test_alter_columns_nullable_false(mem_db: DBConnection):
+    table = mem_db.create_table("my_table", data=pa.table({"id": [0, 1]}))
+    result = table.alter_columns({"path": "id", "nullable": False})
+    assert result.version == 2
+    assert not table.schema.field("id").nullable
+
+
+@pytest.mark.parametrize("alterations, match", INVALID_COLUMN_ALTERATIONS)
+def test_alter_columns_rejects_invalid(mem_db: DBConnection, alterations, match):
+    table = mem_db.create_table("my_table", data=pa.table({"id": [0, 1]}))
+    initial_version = table.version
+    initial_schema = table.schema
+
+    with pytest.raises(ValueError, match=match):
+        table.alter_columns(*alterations)
+
+    assert table.version == initial_version
+    assert table.schema == initial_schema
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("alterations, match", INVALID_COLUMN_ALTERATIONS)
+async def test_alter_columns_rejects_invalid_async(
+    mem_db_async: AsyncConnection, alterations, match
+):
+    table = await mem_db_async.create_table("my_table", data=pa.table({"id": [0, 1]}))
+    initial_version = await table.version()
+    initial_schema = await table.schema()
+
+    with pytest.raises(ValueError, match=match):
+        await table.alter_columns(*alterations)
+
+    assert await table.version() == initial_version
+    assert await table.schema() == initial_schema
+
+
 def test_update_field_metadata(mem_db: DBConnection):
     data = pa.table({"id": [0, 1], "category": ["a", "b"]})
     table = mem_db.create_table("my_table", data=data)
@@ -4203,10 +4263,11 @@ def test_update_field_metadata(mem_db: DBConnection):
 
 
 @pytest.mark.asyncio
-async def test_alter_columns_async(mem_db_async: AsyncConnection):
+@pytest.mark.parametrize("rename_key", ["rename", "name"])
+async def test_alter_columns_async(mem_db_async: AsyncConnection, rename_key):
     data = pa.table({"id": [0, 1]})
     table = await mem_db_async.create_table("my_table", data=data)
-    alter_columns_res = await table.alter_columns({"path": "id", "rename": "new_id"})
+    alter_columns_res = await table.alter_columns({"path": "id", rename_key: "new_id"})
     assert alter_columns_res.version == 2
     assert (await table.to_arrow()).column_names == ["new_id"]
     alter_columns_res = await table.alter_columns(
```

**File**: `python/src/table.rs` (modified, +11/-0)
```diff
@@ -1897,6 +1897,17 @@ impl Table {
         let alterations = alterations
             .iter()
             .map(|alteration| {
+                for key in alteration.keys().iter() {
+                    let key = key.extract::<String>()?;
+                    if !matches!(
+                        key.as_str(),
+                        "path" | "rename" | "name" | "nullable" | "data_type"
+                    ) {
+                        return Err(PyValueError::new_err(format!(
+                            "Unknown column alteration key '{key}'"
+                        )));
+                    }
+                }
                 let path = alteration
                     .get_item("path")?
                     .ok_or_else(|| PyValueError::new_err("Missing path"))?
```

**File**: `rust/lancedb/src/remote/table.rs` (modified, +19/-0)
```diff
@@ -4694,6 +4694,25 @@ mod tests {
         assert_eq!(result.rows_updated, if old_server { 0 } else { 5 });
     }
 
+    #[tokio::test]
+    async fn test_alter_columns_rejects_missing_changes_before_request() {
+        let table = Table::new_with_handler::<String>("my_table", |request| {
+            panic!("Unexpected request: {}", request.url().path())
+        });
+
+        for alterations in [
+            vec![ColumnAlteration::new("id".into())],
+            vec![
+                ColumnAlteration::new("id".into()).rename("new_id".into()),
+                ColumnAlteration::new("id".into()),
+            ],
+        ] {
+            let err = table.alter_columns(&alterations).await.unwrap_err();
+            assert!(matches!(err, Error::InvalidInput { .. }), "got {err:?}");
+            assert!(err.to_string().contains("path 'id'"));
+        }
+    }
+
     #[rstest]
     #[case(true)]
     #[case(false)]
```

**File**: `rust/lancedb/src/table.rs` (modified, +18/-1)
```diff
@@ -1919,11 +1919,28 @@ impl Table {
         self.inner.function_errors(&request).await
     }
 
-    /// Change a column's name or nullability.
+    /// Change a column's name, data type, or nullability.
+    ///
+    /// Each alteration must specify at least one of `rename`, `data_type`, or
+    /// `nullable`. Returns [`Error::InvalidInput`] before applying any changes
+    /// if an alteration does not specify any of these fields.
     pub async fn alter_columns(
         &self,
         alterations: &[ColumnAlteration],
     ) -> Result<AlterColumnsResult> {
+        for alteration in alterations {
+            if alteration.rename.is_none()
+                && alteration.nullable.is_none()
+                && alteration.data_type.is_none()
+            {
+                return Err(Error::InvalidInput {
+                    message: format!(
+                        "One of rename, nullable or data_type must be specified for path '{}'",
+                        alteration.path
+                    ),
+                });
+            }
+        }
         self.inner.alter_columns(alterations).await
     }
 
```

**File**: `rust/lancedb/src/table/schema_evolution.rs` (modified, +23/-0)
```diff
@@ -807,6 +807,29 @@ mod tests {
 
     // Alter Columns Tests
 
+    #[tokio::test]
+    async fn test_alter_columns_rejects_missing_changes() {
+        let conn = connect("memory://").execute().await.unwrap();
+        let batch = record_batch!(("id", Int32, [1, 2, 3])).unwrap();
+        let table = conn.create_table("test", batch).execute().await.unwrap();
+        let initial_version = table.version().await.unwrap();
+        let initial_schema = table.schema().await.unwrap();
+
+        for alterations in [
+            vec![ColumnAlteration::new("id".into())],
+            vec![
+                ColumnAlteration::new("id".into()).rename("new_id".into()),
+                ColumnAlteration::new("id".into()),
+            ],
+        ] {
+            let err = table.alter_columns(&alterations).await.unwrap_err();
+            assert!(matches!(err, Error::InvalidInput { .. }), "got {err:?}");
+            assert!(err.to_string().contains("path 'id'"));
+            assert_eq!(table.version().await.unwrap(), initial_version);
+            assert_eq!(table.schema().await.unwrap(), initial_schema);
+        }
+    }
+
     #[tokio::test]
     async fn test_alter_column_rename() {
         let conn = connect("memory://").execute().await.unwrap();
```

---

### Incident Patch 8: `57a95213` (2026-10-03)
**Commit Message**: fix(python): support async search without a query (#4419)

`AsyncTable.search()` and `search(None)` reached vector search without
assigning `vector_query`, raising `UnboundLocalError` on both local and
remote tables. Return a plain `AsyncQuery` before inferring the search
type, equivalent to `table.query()`, and update the overloads and
documentation to describe that return value.

Add six regression cases for omitted and explicit `None` queries on
local tables with and without vectors and on a mocked remote endpoint.
They verify scans, limits, filters, column projection, and the remote
request body.

Validation: all six regressions reproduced the original
`UnboundLocalError`; all 11 focused query tests pass with the fix,
including existing vector, full-text, hybrid, and sync scan coverage.
The uv development bootstrap, locked Ruff formatting/lint checks, and
focused Pyright return-type assertions also pass.

Fixes #4385

<!-- lance-gatekeeper-fix:v1 agent=bb9a7509f6dadde030d8113b172abc9a
generation=1 -->

Co-authored-by: Gatefixer <313497061+lancedb-gatefixer[bot]@users.noreply.github.com>

**File**: `python/python/lancedb/table.py` (modified, +23/-11)
```diff
@@ -6107,7 +6107,17 @@ def merge_insert(self, on: Union[str, Iterable[str]]) -> LanceMergeInsertBuilder
     @overload
     async def search(
         self,
-        query: Optional[str] = None,
+        query: None = None,
+        vector_column_name: Optional[str] = None,
+        query_type: QueryType = "auto",
+        ordering_field_name: Optional[str] = None,
+        fts_columns: Optional[Union[str, List[str]]] = None,
+    ) -> AsyncQuery: ...
+
+    @overload
+    async def search(
+        self,
+        query: str,
         vector_column_name: Optional[str] = None,
         query_type: Literal["auto"] = ...,
         ordering_field_name: Optional[str] = None,
@@ -6117,7 +6127,7 @@ async def search(
     @overload
     async def search(
         self,
-        query: Optional[str] = None,
+        query: str,
         vector_column_name: Optional[str] = None,
         query_type: Literal["hybrid"] = ...,
         ordering_field_name: Optional[str] = None,
@@ -6127,7 +6137,7 @@ async def search(
     @overload
     async def search(
         self,
-        query: Optional[Union[VEC, "PIL.Image.Image", Tuple]] = None,
+        query: Union[VEC, "PIL.Image.Image", Tuple],
         vector_column_name: Optional[str] = None,
         query_type: Literal["auto"] = ...,
         ordering_field_name: Optional[str] = None,
@@ -6137,7 +6147,7 @@ async def search(
     @overload
     async def search(
         self,
-        query: Optional[str] = None,
+        query: str,
         vector_column_name: Optional[str] = None,
         query_type: Literal["fts"] = ...,
         ordering_field_name: Optional[str] = None,
@@ -6147,9 +6157,7 @@ async def search(
     @overload
     async def search(
         self,
-        query: Optional[
-            Union[VEC, str, "PIL.Image.Image", Tuple, FullTextQuery]
-        ] = None,
+        query: Union[VEC, str, "PIL.Image.Image", Tuple, FullTextQuery],
         vector_column_name: Optional[str] = None,
         query_type: Literal["vector"] = ...,
         ordering_field_name: Optional[str] = None,
@@ -6165,7 +6173,7 @@ async def search(
         query_type: QueryType = "auto",
         ordering_field_name: Optional[str] = None,
         fts_columns: Optional[Union[str, List[str]]] = None,
-    ) -> Union[AsyncHybridQuery, AsyncFTSQuery, AsyncVectorQuery]:
+    ) -> Union[AsyncQuery, AsyncHybridQuery, AsyncFTSQuery, AsyncVectorQuery]:
         """Create a search query to find the nearest neighbors
         of the given query vector. We currently support [vector search](https://lancedb.com/docs/search/vector-search/)
         and [full-text search](https://lancedb.com/docs/search/full-text-search/).
@@ -6180,8 +6188,9 @@ async def search(
             - *default None*.
             Acceptable types are: list, np.ndarray, PIL.Image.Image
 
-            - If None then the select/where/limit clauses are applied to filter
-            the table
+            - If None then a plain [AsyncQuery][lancedb.query.AsyncQuery] is
+            returned, equivalent to calling [query][lancedb.table.AsyncTable.query].
+            The select/where/limit clauses are applied to filter the table.
         vector_column_name: str, optional
             The name of the vector column to search.
 
@@ -6209,10 +6218,13 @@ async def search(
 
         Returns
         -------
-        LanceQueryBuilder
+        AsyncQuery, AsyncHybridQuery, AsyncFTSQuery, or AsyncVectorQuery
             A query builder object representing the query.
         """
 
+        if query is None:
+            return self.query()
+
         def is_embedding(query):
             return isinstance(query, (list, np.ndarray, pa.Array, pa.ChunkedArray))
 
```

**File**: `python/python/tests/test_query.py` (modified, +22/-0)
```diff
@@ -24,6 +24,7 @@
 from lancedb.query import (
     AsyncFTSQuery,
     AsyncHybridQuery,
+    AsyncQuery,
     AsyncQueryBase,
     AsyncVectorQuery,
     ColumnOrdering,
@@ -1279,6 +1280,27 @@ async def test_query_to_polars_async(table_async: AsyncTable):
     assert df.shape == (0, num_columns)
 
 
+@pytest.mark.asyncio
+@pytest.mark.parametrize("search_kwargs", [{}, {"query": None}])
+@pytest.mark.parametrize("with_vector", [False, True])
+async def test_async_search_without_query(mem_db_async, search_kwargs, with_vector):
+    data = [{"id": i} for i in range(10)]
+    if with_vector:
+        for row in data:
+            row["vector"] = [float(row["id"]), 1.0]
+    table = await mem_db_async.create_table("test", data)
+
+    query = await table.search(**search_kwargs)
+    assert isinstance(query, AsyncQuery)
+    assert await query.limit(3).to_arrow() == await table.query().limit(3).to_arrow()
+
+    query = await table.search(**search_kwargs)
+    assert await query.where("id >= 8").select(["id"]).limit(3).to_list() == [
+        {"id": 8},
+        {"id": 9},
+    ]
+
+
 @pytest.mark.asyncio
 async def test_none_query(table_async: AsyncTable):
     with pytest.raises(ValueError):
```

**File**: `python/python/tests/test_remote_db.py` (modified, +41/-1)
```diff
@@ -17,7 +17,7 @@
 
 import lancedb
 from lancedb.conftest import MockTextEmbeddingFunction
-from lancedb.query import ColumnOrdering
+from lancedb.query import AsyncQuery, ColumnOrdering
 from lancedb.remote import ClientConfig
 from lancedb.remote.errors import HttpError, RetryError
 import pytest
@@ -1521,6 +1521,46 @@ def handler(body):
         assert data == expected
 
 
+@pytest.mark.asyncio
+@pytest.mark.parametrize("search_kwargs", [{}, {"query": None}])
+async def test_async_search_without_query(search_kwargs):
+    expected = pa.table({"id": [7, 8, 9]})
+
+    def handler(request):
+        if request.path == "/v1/table/test/describe/":
+            request.send_response(200)
+            request.send_header("Content-Type", "application/json")
+            request.end_headers()
+            request.wfile.write(b'{"version": 1, "schema": {"fields": []}}')
+        elif request.path == "/v1/table/test/query/":
+            body = json.loads(
+                request.rfile.read(int(request.headers["Content-Length"]))
+            )
+            assert body == {
+                "k": 3,
+                "filter": "id >= 7",
+                "vector": [],
+                "columns": ["id"],
+                "prefilter": True,
+                "version": None,
+            }
+            request.send_response(200)
+            request.send_header("Content-Type", "application/vnd.apache.arrow.file")
+            request.end_headers()
+            with pa.ipc.new_file(request.wfile, schema=expected.schema) as writer:
+                writer.write_table(expected)
+        else:
+            request.send_response(404)
+            request.end_headers()
+
+    async with mock_lancedb_connection_async(handler) as db:
+        table = await db.open_table("test")
+        query = await table.search(**search_kwargs)
+        assert isinstance(query, AsyncQuery)
+        result = await query.where("id >= 7").select(["id"]).limit(3).to_arrow()
+        assert result == expected
+
+
 def test_query_sync_maximal():
     def handler(body):
         assert body == {
```

---

### Incident Patch 9: `6851133a` (2026-10-03)
**Commit Message**: fix(python): serialize deprecated v2 manifest option (#4420)

Local synchronous `create_table(...,
enable_v2_manifest_paths=True/False)` failed with `TypeError` because
the deprecated argument was forwarded as a boolean in `storage_options`,
while the Rust binding expects string values.

Convert the argument to lowercase `"true"` or `"false"` before
forwarding it, preserving the deprecation warning. Add regression
coverage for both values with populated and schema-only tables, checking
stored data and the manifest mode after reopening.

Validation:
- All four regression cases reproduced the original `TypeError` before
the fix and pass afterward.
- `uv run --no-sync --extra tests --extra dev pytest
python/tests/test_db.py -q --tb=short -m 'not slow and not s3_test'`: 54
passed.
- Repository-wide `ruff format .` and `ruff check .` completed
successfully.

Fixes #4384

<!-- lance-gatekeeper-fix:v1 agent=9c14955b90d0c12d6a46605ec5ef32c0
generation=1 -->

Co-authored-by: Gatefixer <313497061+lancedb-gatefixer[bot]@users.noreply.github.com>

**File**: `python/python/lancedb/table.py` (modified, +2/-2)
```diff
@@ -4332,9 +4332,9 @@ def create(
             )
             if storage_options is None:
                 storage_options = {}
-            storage_options["new_table_enable_v2_manifest_paths"] = (
+            storage_options["new_table_enable_v2_manifest_paths"] = str(
                 enable_v2_manifest_paths
-            )
+            ).lower()
 
         self._table = LOOP.run(
             self._conn._conn.create_table(
```

**File**: `python/python/tests/test_db.py` (modified, +21/-0)
```diff
@@ -539,6 +539,27 @@ async def test_create_exist_ok_async(tmp_db_async: lancedb.AsyncConnection):
     #     await db.create_table("test", schema=bad_schema, exist_ok=True)
 
 
+@pytest.mark.parametrize("enable_v2_manifest_paths", [False, True])
+@pytest.mark.parametrize("empty", [False, True])
+def test_create_table_deprecated_v2_manifest_paths(
+    tmp_path, enable_v2_manifest_paths, empty
+):
+    db = lancedb.connect(tmp_path)
+    data = None if empty else [{"id": 1}]
+
+    with pytest.warns(DeprecationWarning, match="enable_v2_manifest_paths"):
+        table = db.create_table(
+            "test",
+            data=data,
+            schema=pa.schema([("id", pa.int64())]),
+            enable_v2_manifest_paths=enable_v2_manifest_paths,
+        )
+
+    assert table.uses_v2_manifest_paths() == enable_v2_manifest_paths
+    assert table.to_arrow().to_pylist() == ([] if empty else data)
+    assert db.open_table("test").uses_v2_manifest_paths() == enable_v2_manifest_paths
+
+
 @pytest.mark.asyncio
 async def test_create_table_v2_manifest_paths_async(tmp_path):
     db_with_v2_paths = await lancedb.connect_async(
```

---

### Incident Patch 10: `8c2c39b3` (2026-10-03)
**Commit Message**: fix(python): repair sync manifest path migration (#4422)

Fixes #4383

`LanceTable.migrate_v2_manifest_paths()` raised `AttributeError` because
it called a nonexistent `AsyncTable.migrate_v2_manifest_paths()` method.
Delegate to the existing async method, `migrate_manifest_paths_v2()`,
while preserving the public sync API.

Add a local regression test for tables starting with either v1 or v2
manifest paths. It checks repeated migration, v2 manifest filenames on
disk, and preservation of data and version history after reopening the
table.

Validation:
- Both new regression cases failed with the reported `AttributeError`
before the fix.
- `cd python && uv run --extra tests pytest
python/tests/test_table.py::test_migrate_v2_manifest_paths
python/tests/test_db.py::test_create_table_v2_manifest_paths_async -q` —
3 passed.
- Repository-wide `ruff check .` and `ruff format .` passed using Ruff
0.15.20 from `python/uv.lock`.
- `git diff --check` passed.

<!-- lance-gatekeeper-fix:v1 agent=bb500f0d1ddefeba3c7d7d8390a2fb74
generation=1 -->

Co-authored-by: Gatefixer <313497061+lancedb-gatefixer[bot]@users.noreply.github.com>

**File**: `python/python/lancedb/table.py` (modified, +1/-1)
```diff
@@ -4766,7 +4766,7 @@ def migrate_v2_manifest_paths(self):
         [LanceTable.uses_v2_manifest_paths][lancedb.table.LanceTable.uses_v2_manifest_paths]
         to check if the table is already using the new path style.
         """
-        LOOP.run(self._table.migrate_v2_manifest_paths())
+        LOOP.run(self._table.migrate_manifest_paths_v2())
 
     @deprecation.deprecated(
         deprecated_in="0.33.1",
```

**File**: `python/python/tests/test_table.py` (modified, +26/-0)
```diff
@@ -113,6 +113,32 @@ def test_basic(mem_db: DBConnection):
     assert table.to_arrow() == expected_data
 
 
+@pytest.mark.parametrize("enable_v2", [False, True])
+def test_migrate_v2_manifest_paths(tmp_path, enable_v2):
+    db = lancedb.connect(
+        tmp_path,
+        storage_options={"new_table_enable_v2_manifest_paths": str(enable_v2).lower()},
+    )
+    table = db.create_table("calls", [{"id": 1, "vector": [1.0, 1.0]}])
+    table.add([{"id": 2, "vector": [2.0, 2.0]}])
+    expected_data = table.to_arrow()
+    expected_versions = table.list_versions()
+    assert table.uses_v2_manifest_paths() == enable_v2
+
+    # Migration is also safe to repeat on a table already using v2 paths.
+    for _ in range(2):
+        table.migrate_v2_manifest_paths()
+        assert table.uses_v2_manifest_paths()
+        reopened = db.open_table("calls")
+        assert reopened.uses_v2_manifest_paths()
+        assert reopened.to_arrow() == expected_data
+        assert reopened.list_versions() == expected_versions
+
+    manifests = list((tmp_path / "calls.lance" / "_versions").glob("*.manifest"))
+    assert len(manifests) == len(expected_versions)
+    assert all(len(path.stem) == 20 and path.stem.isdigit() for path in manifests)
+
+
 def test_search_preserves_nulls_from_sliced_arrow_table(mem_db: DBConnection):
     data = pa.table(
         {
```

---

### Incident Patch 11: `7e979c14` (2026-10-03)
**Commit Message**: fix(node): preserve schemas for empty query results (#4423)

Empty local TypeScript queries returned a zero-row Arrow table with no
columns because `toArrow()` built the table solely from record batches.
Local streams can yield no batches, while remote streams often supply an
empty batch carrying the schema.

Expose the executed stream's schema through the native iterator and
decode it into an empty Arrow table when no batches arrive. This
preserves projected and search columns, types, nullability, and metadata
without executing another query. Document the empty-result behavior.

Validation:

- Eleven regression cases failed with the original `toArrow()`
implementation; all twelve now pass, including remote schema-only and
empty-batch responses.
- All 1,075 tests in the query, remote, Arrow, and table suites pass.
- Native build, TypeScript compilation, Rust formatting and Clippy (`-D
warnings`), TypeScript lint/formatting, and documentation generation
pass.

Fixes #4386

<!-- lance-gatekeeper-fix:v1 agent=7d589da1f7db5c7383f9600490e111a9
generation=1 -->

Co-authored-by: Gatefixer <313497061+lancedb-gatefixer[bot]@users.noreply.github.com>

**File**: `docs/src/js/classes/AutoQuery.md` (modified, +2/-0)
```diff
@@ -417,6 +417,8 @@ Collect the results as an Arrow
 
 ArrowTable.
 
+Empty results retain the query's output schema.
+
 #### Inherited from
 
 `StandardQueryBase.toArrow`
```

**File**: `docs/src/js/classes/Query.md` (modified, +2/-0)
```diff
@@ -491,6 +491,8 @@ Collect the results as an Arrow
 
 ArrowTable.
 
+Empty results retain the query's output schema.
+
 #### Inherited from
 
 `StandardQueryBase.toArrow`
```

**File**: `docs/src/js/classes/QueryBase.md` (modified, +2/-0)
```diff
@@ -252,6 +252,8 @@ Collect the results as an Arrow
 
 ArrowTable.
 
+Empty results retain the query's output schema.
+
 ***
 
 ### withRowId()
```

**File**: `docs/src/js/classes/TakeQuery.md` (modified, +2/-0)
```diff
@@ -267,6 +267,8 @@ Collect the results as an Arrow
 
 ArrowTable.
 
+Empty results retain the query's output schema.
+
 #### Inherited from
 
 [`QueryBase`](QueryBase.md).[`toArrow`](QueryBase.md#toarrow)
```

**File**: `docs/src/js/classes/VectorQuery.md` (modified, +2/-0)
```diff
@@ -740,6 +740,8 @@ Collect the results as an Arrow
 
 ArrowTable.
 
+Empty results retain the query's output schema.
+
 #### Inherited from
 
 `StandardQueryBase.toArrow`
```

**File**: `nodejs/__test__/query.test.ts` (modified, +123/-0)
```diff
@@ -110,6 +110,129 @@ describe("Query outputSchema", () => {
   });
 });
 
+describe("Query empty results", () => {
+  let tmpDir: tmp.DirResult;
+  let table: Table;
+
+  beforeEach(async () => {
+    tmpDir = tmp.dirSync({ unsafeCleanup: true });
+    const db = await connect(tmpDir.name);
+    const schema = new Schema(
+      [
+        new Field("id", new Int64(), false),
+        new Field(
+          "text",
+          new Utf8(),
+          true,
+          new Map([["description", "searchable text"]]),
+        ),
+        new Field(
+          "vector",
+          new FixedSizeList(2, new Field("item", new Float32())),
+          true,
+        ),
+      ],
+      new Map([["source", "empty-query-regression"]]),
+    );
+    table = await db.createTable(
+      "test",
+      makeArrowTable([{ id: 1n, text: "hello", vector: [1, 2] }], { schema }),
+    );
+  });
+
+  afterEach(() => {
+    tmpDir.removeCallback();
+  });
+
+  it.each([
+    {
+      name: "filtered scan",
+      query: (table: Table) => table.query().where("id < 0"),
+      fields: ["id", "text", "vector"],
+    },
+    {
+      name: "zero limit",
+      query: (table: Table) => table.query().limit(0),
+      fields: ["id", "text", "vector"],
+    },
+    {
+      name: "column projection",
+      query: (table: Table) =>
+        table.query().where("id < 0").select(["text", "id"]),
+      fields: ["text", "id"],
+    },
+    {
+      name: "dynamic projection",
+      query: (table: Table) =>
+        table.query().where("id < 0").select({ doubled: "id * 2" }),
+      fields: ["doubled"],
+    },
+    {
+      name: "filtered vector search",
+      query: (table: Table) =>
+        table.search([0.5, 0.5]).where("id < 0").limit(3),
+      fields: ["id", "text", "vector", "_distance"],
+    },
+    {
+      name: "vector projection with row id",
+      query: (table: Table) =>
+        table
+          .vectorSearch([0.5, 0.5])
+          .where("id < 0")
+          .select(["id"])
+          .withRowId(),
+      fields: ["id", "_distance", "_rowid"],
+    },
+    {
+      name: "fast search without an index",
+      query: (table: Table) => table.search([0.5, 0.5]).fastSearch(),
+      fields: ["id", "text", "vector", "_rowid", "_distance"],
+    },
+    {
+      name: "take with no offsets",
+      query: (table: Table) => table.takeOffsets([]).select(["text"]),
+      fields: ["text"],
+    },
+  ])("preserves the output schema for $name", async ({ query, fields }) => {
+    const result = await query(table).toArrow({ maxBatchLength: 1 });
+
+    expect(result.numRows).toBe(0);
+    expect(result.schema.fields.map((field) => field.name)).toEqual(fields);
+    for (const name of fields) {
+      expect(result.getChild(name)).not.toBeNull();
+      expect(result.getChild(name)?.length).toBe(0);
+    }
+  });
+
+  it("preserves types, nullability, and metadata", async () => {
+    const result = await table.query().where("id < 0").toArrow();
+    const schema = await table.schema();
+
+    expect(result.schema).toEqual(schema);
+    expect(result.getChild("id")?.type.toString()).toBe("Int64");
+    expect(result.schema.fields[0].nullable).toBe(false);
+    expect(result.schema.fields[1].metadata.get("description")).toBe(
+      "searchable text",
+    );
+    expect(result.schema.metadata.get("source")).toBe("empty-query-regression");
+  });
+
+  it("preserves the score column for full-text search with no matches", async () => {
+    await table.createIndex("text", { config: Index.fts() });
+    const result = await table
+      .search("missing", "fts")
+      .select(["id"])
+      .toArrow();
+
+    expect(result.numRows).toBe(0);
+    expect(result.schema.fields.map((field) => field.name)).toEqual([
+      "id",
+      "_score",
+    ]);
+    expect(result.getChild("_score")?.type.toString()).toBe("Float32");
+  });
+});
+
 describe("Search pagination", () => {
   let tmpDir: tmp.DirResult;
   let table: Table;
```

**File**: `nodejs/__test__/remote.test.ts` (modified, +68/-0)
```diff
@@ -14,6 +14,14 @@ import {
   TlsConfig,
   connect,
 } from "../lancedb";
+import {
+  Table as ArrowTable,
+  Field,
+  Int64,
+  RecordBatch,
+  Schema,
+  tableToIPC,
+} from "../lancedb/arrow";
 import {
   HeaderProvider,
   OAuthHeaderProvider,
@@ -85,6 +93,66 @@ async function withMockDatabase(
 }
 
 describe("remote connection", () => {
+  it.each([false, true])(
+    "preserves an empty query's schema with an empty batch: %s",
+    async (withEmptyBatch) => {
+      const schema = new Schema(
+        [new Field("doubled", new Int64(), false)],
+        new Map([["source", "query-output"]]),
+      );
+      const result = new ArrowTable(
+        schema,
+        withEmptyBatch ? [new RecordBatch(schema, undefined)] : [],
+      );
+      const response = Buffer.from(tableToIPC(result, "stream"));
+      let queryRequests = 0;
+
+      await withMockDatabase(
+        (req, res) => {
+          if (req.url?.endsWith("/describe/")) {
+            res.writeHead(200, { "Content-Type": "application/json" }).end(
+              JSON.stringify({
+                name: "items",
+                version: 1,
+                schema: {
+                  fields: [
+                    { name: "id", type: { type: "int64" }, nullable: false },
+                  ],
+                },
+              }),
+            );
+          } else if (req.url?.endsWith("/query/")) {
+            queryRequests++;
+            req.resume();
+            req.on("end", () => {
+              res
+                .writeHead(200, {
+                  "Content-Type": "application/vnd.apache.arrow.stream",
+                })
+                .end(response);
+            });
+          } else {
+            res.writeHead(404).end();
+          }
+        },
+        async (db) => {
+          const table = await db.openTable("items");
+          const result = await table
+            .query()
+            .where("id < 0")
+            .select({ doubled: "id * 2" })
+            .toArrow();
+
+          expect(result.numRows).toBe(0);
+          expect(result.schema).toEqual(schema);
+          expect(result.getChild("doubled")?.length).toBe(0);
+        },
+      );
+
+      expect(queryRequests).toBe(1);
+    },
+  );
+
   it("rejects the external blob opt-in without blocking regular adds", async () => {
     let insertRequests = 0;
     const describeRequests: string[] = [];
```

**File**: `nodejs/lancedb/query.ts` (modified, +10/-23)
```diff
@@ -41,26 +41,6 @@ export async function* RecordBatchIterator(
   }
 }
 
-class RecordBatchIterable<
-  NativeQueryType extends NativeQuery | NativeVectorQuery | NativeTakeQuery,
-> implements AsyncIterable<RecordBatch>
-{
-  private inner: NativeQueryType;
-  private options?: QueryExecutionOptions;
-
-  constructor(inner: NativeQueryType, options?: QueryExecutionOptions) {
-    this.inner = inner;
-    this.options = options;
-  }
-
-  // biome-ignore lint/suspicious/noExplicitAny: skip
-  [Symbol.asyncIterator](): AsyncIterator<RecordBatch<any>, any, undefined> {
-    return RecordBatchIterator(
-      this.inner.execute(this.options?.maxBatchLength, this.options?.timeoutMs),
-    );
-  }
-}
-
 /**
  * Options that control the behavior of a particular query execution
  */
@@ -271,13 +251,20 @@ export class QueryBase<
     return RecordBatchIterator(this.nativeExecute());
   }
 
-  /** Collect the results as an Arrow @see {@link ArrowTable}. */
+  /**
+   * Collect the results as an Arrow @see {@link ArrowTable}.
+   *
+   * Empty results retain the query's output schema.
+   */
   async toArrow(options?: Partial<QueryExecutionOptions>): Promise<ArrowTable> {
     const batches = [];
-    const inner = await this.getInner();
-    for await (const batch of new RecordBatchIterable(inner, options)) {
+    const iterator = this.nativeExecute(options);
+    for await (const batch of RecordBatchIterator(iterator)) {
       batches.push(batch);
     }
+    if (batches.length === 0) {
+      return tableFromIPC((await iterator).schema());
+    }
     return new ArrowTable(batches);
   }
 
```

---

### Incident Patch 12: `cc6b4aa4` (2026-10-03)
**Commit Message**: fix(remote): preserve schema for empty merge insert sources (#4425)

Remote `merge_insert` buffered its reader into a `Vec<RecordBatch>`,
losing the schema when the reader yielded no batches. Scanning that
vector failed before the request could reach the server.

Preserve the reader's schema in an empty record batch when buffering
produces no batches. The source remains replayable for retries, and
empty-source merges still reach the server so
`when_not_matched_by_source_delete` can apply deletes.

The regression tests decode the outgoing Arrow IPC and verify the source
schema, zero rows, merge options, and result statistics on an initial
request and a retry after HTTP 409. They cover readers with no batches
and readers with an empty batch, in insert and delete modes, including
an ID-only delete source.

Validation:
- Before the fix, both no-batch cases reproduced `Cannot scan an empty
Vec<RecordBatch>`; the empty-batch cases passed.
- `cargo test --quiet --profile ci --features remote -p lancedb --lib
remote::table::tests::test_merge_insert` — 9 passed.
- `cargo fmt --all` and `cargo fmt --all -- --check`.
- `cargo clippy --quiet --profile ci --features remote -p lancedb
--tests --

**File**: `rust/lancedb/src/remote/table.rs` (modified, +105/-1)
```diff
@@ -3101,7 +3101,13 @@ impl<S: HttpSend> BaseTable for RemoteTable<S> {
         // loop can re-execute the plan (and re-stream the body) on each retry.
         // This mirrors the old `send_streaming(with_retry=true)` path, which
         // likewise buffered the reader to support retries.
-        let batches = new_data.collect::<std::result::Result<Vec<_>, _>>()?;
+        let schema = RecordBatchReader::schema(new_data.as_ref());
+        let mut batches = new_data.collect::<std::result::Result<Vec<_>, _>>()?;
+        // An empty reader still carries a schema. Keep it in an empty batch so
+        // the buffered source remains scannable and can be replayed on retries.
+        if batches.is_empty() {
+            batches.push(RecordBatch::new_empty(schema));
+        }
         let source: Box<dyn Scannable> = Box::new(batches);
         let rescannable = source.rescannable();
         let input: Arc<dyn ExecutionPlan> =
@@ -4801,6 +4807,104 @@ mod tests {
         }
     }
 
+    #[rstest]
+    #[case::no_batches_insert(false, false)]
+    #[case::empty_batch_insert(true, false)]
+    #[case::no_batches_delete(false, true)]
+    #[case::empty_batch_delete(true, true)]
+    #[tokio::test]
+    async fn test_merge_insert_empty_source(
+        #[case] has_batch: bool,
+        #[case] delete_unmatched: bool,
+    ) {
+        let mut fields = vec![Field::new("id", DataType::Int64, false)];
+        if !delete_unmatched {
+            fields.extend([
+                Field::new("k", DataType::Int64, false),
+                Field::new(
+                    "vector",
+                    DataType::FixedSizeList(
+                        Arc::new(Field::new("item", DataType::Float32, true)),
+                        2,
+                    ),
+                    true,
+                ),
+                Field::new("s", DataType::Utf8, true),
+            ]);
+        }
+        let schema = Arc::new(Schema::new_with_metadata(
+            fields,
+            HashMap::from([("source".to_string(), "empty".to_string())]),
+        ));
+        let batches = if has_batch {
+            vec![Ok(RecordBatch::new_empty(schema.clone()))]
+        } else {
+            vec![]
+        };
+        let data: Box<dyn RecordBatchReader + Send> =
+            Box::new(RecordBatchIterator::new(batches, schema.clone()));
+        let attempts = Arc::new(AtomicUsize::new(0));
+        let attempts_ref = attempts.clone();
+        let num_deleted_rows = if delete_unmatched { 3 } else { 0 };
+
+        let table = Table::new_with_handler("my_table", move |request| {
+            assert_eq!(request.method(), "POST");
+            assert_eq!(request.url().path(), "/v1/table/my_table/merge_insert/");
+            assert_eq!(request.headers()[CONTENT_TYPE], ARROW_STREAM_CONTENT_TYPE);
+            let params = request.url().query_pairs().collect::<HashMap<_, _>>();
+            assert_eq!(params["on"], "id");
+            assert_eq!(
+                params["when_not_matched_insert_all"],
+                (!delete_unmatched).to_string()
+            );
+            assert_eq!(
+                params["when_not_matched_by_source_delete"],
+                delete_unmatched.to_string()
+            );
+
+            let body = request.body().unwrap().as_bytes().unwrap();
+            let reader = StreamReader::try_new(Cursor::new(body), None).unwrap();
+            assert_eq!(reader.schema(), schema);
+            for batch in reader {
+                assert_eq!(batch.unwrap().num_rows(), 0);
+            }
+
+            // The empty source must retain its schema when replayed after a conflict.
+            if attempts_ref.fetch_add(1, Ordering::SeqCst) == 0 {
+                http::Response::builder()
+                    .status(409)
+                    .body(String::new())
+                    .unwrap()
+            } else {
+                http::Response::builder()
+                    .status(200)
+                    .body(
+                        json!({
+                            "version": 43,
+                            "num_deleted_rows": num_deleted_rows,
+                            "num_inserted_rows": 0,
+                            "num_updated_rows": 0,
+                        })
+                        .to_string(),
+                    )
+                    .unwrap()
+            }
+        });
+
+        let mut merge = table.merge_insert(&["id"]);
+        if delete_unmatched {
+            merge.when_not_matched_by_source_delete(None);
+        } else {
+            merge.when_not_matched_insert_all();
+        }
+        let result = merge.execute(data).await.unwrap();
+        assert_eq!(attempts.load(Ordering::SeqCst), 2);
+        assert_eq!(result.version, 43);
+        assert_eq!(result.num_deleted_rows, num_deleted_rows);
+        assert_eq!(result.num_inserted_rows, 0);
+        assert_eq!(result.num_updated_rows, 0);
+    }
+
     #[tokio::test]
     async fn test_merge_insert_composit
```

---

### Incident Patch 13: `3d8c9e2d` (2026-10-03)
**Commit Message**: fix(python): close synchronous database connections (#4424)

Calling `close()` on a synchronous remote connection returned an
unawaited coroutine and left the connection usable. Local synchronous
connections had no close or context-manager API.

Add synchronous `close()` and `is_open()` to the connection interface,
delegate them to the existing connection handle for local, remote, and
namespace connections, and provide shared context-manager cleanup.
Closing is idempotent, and subsequent database operations use the
existing `Connection is closed` error. Document the lifecycle with
examples.

Validation:

- Reproduced the reported coroutine warning and missing local lifecycle
API on the original code; all 15 new regression cases failed before the
fix.
- All 168 tests in `test_db.py`, `test_remote_db.py`, and
`test_namespace.py` passed through the uv-managed environment, including
local, in-memory, namespace, native-derived, and mocked remote lifecycle
coverage.
- All 6 synchronous connection doctests passed.
- Repository-wide Ruff 0.9.9 lint and formatting passed; `git diff
--check` passed.

Fixes #4382

<!-- lance-gatekeeper-fix:v1 agent=a743139af98198f1d4c8934c9cc1d0c9
generation=

**File**: `python/python/lancedb/db.py` (modified, +50/-1)
```diff
@@ -122,7 +122,48 @@ def _view_description(
 
 
 class DBConnection(EnforceOverrides):
-    """An active LanceDB connection interface."""
+    """An active LanceDB connection interface.
+
+    Use [close][lancedb.db.DBConnection.close] to release the connection's
+    underlying resources, or use the connection as a context manager to close it
+    automatically when leaving the block, including when an exception is raised.
+
+    Examples
+    --------
+    >>> import lancedb
+    >>> with lancedb.connect("memory://") as db:
+    ...     assert db.is_open()
+    >>> db.is_open()
+    False
+    """
+
+    def __enter__(self) -> DBConnection:
+        return self
+
+    def __exit__(self, *_) -> None:
+        self.close()
+
+    @abstractmethod
+    def is_open(self) -> bool:
+        """Return True if the connection is open."""
+        pass
+
+    @abstractmethod
+    def close(self) -> None:
+        """Close the connection, releasing any underlying resources.
+
+        It is safe to call this method multiple times. Database operations on a
+        closed connection raise ``RuntimeError: Connection is closed``.
+
+        Examples
+        --------
+        >>> import lancedb
+        >>> db = lancedb.connect("memory://")
+        >>> db.close()
+        >>> db.is_open()
+        False
+        """
+        pass
 
     def list_namespaces(
         self,
@@ -1275,6 +1316,14 @@ def from_inner(
     def __repr__(self) -> str:
         return f"{self.__class__.__name__}(uri={self._conn.uri!r})"
 
+    @override
+    def is_open(self) -> bool:
+        return self._conn.is_open()
+
+    @override
+    def close(self) -> None:
+        self._conn.close()
+
     @override
     def serialize(self) -> str:
         import json
```

**File**: `python/python/lancedb/namespace.py` (modified, +8/-0)
```diff
@@ -489,6 +489,14 @@ def __init__(
             )
         self._uri = self._inner.uri
 
+    @override
+    def is_open(self) -> bool:
+        return self._inner.is_open()
+
+    @override
+    def close(self) -> None:
+        self._inner.close()
+
     @override
     def serialize(self) -> str:
         import json
```

**File**: `python/python/lancedb/remote/db.py` (modified, +6/-2)
```diff
@@ -1054,6 +1054,10 @@ def namespace_client(self) -> LanceNamespace:
         """
         return LOOP.run(self._conn.namespace_client())
 
-    async def close(self):
-        """Close the connection to the database."""
+    @override
+    def is_open(self) -> bool:
+        return self._conn.is_open()
+
+    @override
+    def close(self) -> None:
         self._conn.close()
```

**File**: `python/python/tests/test_db.py` (modified, +44/-0)
```diff
@@ -2,6 +2,7 @@
 # SPDX-FileCopyrightText: Copyright The LanceDB Authors
 
 
+import contextlib
 import inspect
 import re
 import sys
@@ -405,6 +406,49 @@ async def test_connect(tmp_path):
     assert str(db) == f"ListingDatabase(uri={tmp_path}, read_consistency_interval=5s)"
 
 
+@pytest.fixture(params=["memory", "local", "namespace", "from_inner"])
+def sync_db(request, tmp_path):
+    if request.param == "memory":
+        return lancedb.connect("memory://")
+    if request.param == "namespace":
+        return lancedb.connect_namespace("dir", {"root": str(tmp_path)})
+    db = lancedb.connect(tmp_path)
+    if request.param == "from_inner":
+        return lancedb.db.LanceDBConnection.from_inner(db._inner, None)
+    return db
+
+
+def test_sync_close(sync_db):
+    assert sync_db.is_open()
+    assert sync_db.close() is None
+    assert not sync_db.is_open()
+    assert sync_db.close() is None
+
+    with pytest.warns(DeprecationWarning, match="table_names"):
+        with pytest.raises(RuntimeError, match="Connection is closed"):
+            sync_db.table_names()
+    with pytest.raises(RuntimeError, match="Connection is closed"):
+        sync_db.list_tables()
+    with pytest.raises(RuntimeError, match="Connection is closed"):
+        sync_db.open_table("test")
+
+
+@pytest.mark.parametrize("raise_error", [False, True])
+def test_sync_context_manager(sync_db, raise_error):
+    with contextlib.ExitStack() as stack:
+        if raise_error:
+            stack.enter_context(pytest.raises(ValueError, match="test error"))
+        with sync_db as db:
+            assert db is sync_db
+            assert db.is_open()
+            if raise_error:
+                raise ValueError("test error")
+
+    assert not sync_db.is_open()
+    with pytest.raises(RuntimeError, match="Connection is closed"):
+        sync_db.list_tables()
+
+
 @pytest.mark.asyncio
 async def test_close(mem_db_async: lancedb.AsyncConnection):
     assert mem_db_async.is_open()
```

**File**: `python/python/tests/test_remote_db.py` (modified, +34/-3)
```diff
@@ -2145,15 +2145,46 @@ def handler(request):
 
 
 def test_close():
-    """Test that close() works without AttributeError."""
-    import asyncio
+    def handler(req):
+        req.send_response(200)
+        req.end_headers()
+
+    with mock_lancedb_connection(handler) as db:
+        assert db.close() is None
+        assert not db.is_open()
+        assert db.close() is None
+
+        with pytest.warns(DeprecationWarning, match="table_names"):
+            with pytest.raises(RuntimeError, match="Connection is closed"):
+                db.table_names()
+        with pytest.raises(RuntimeError, match="Connection is closed"):
+            db.list_tables()
+        with pytest.raises(RuntimeError, match="Connection is closed"):
+            db.open_table("test")
+
 
+@pytest.mark.parametrize("raise_error", [False, True])
+def test_sync_context_manager(raise_error):
     def handler(req):
         req.send_response(200)
+        req.send_header("Content-Type", "application/json")
         req.end_headers()
+        req.wfile.write(b'{"tables": []}')
 
     with mock_lancedb_connection(handler) as db:
-        asyncio.run(db.close())
+        with contextlib.ExitStack() as stack:
+            if raise_error:
+                stack.enter_context(pytest.raises(ValueError, match="test error"))
+            with db as conn:
+                assert conn is db
+                assert conn.is_open()
+                assert conn.list_tables().tables == []
+                if raise_error:
+                    raise ValueError("test error")
+
+        assert not db.is_open()
+        with pytest.raises(RuntimeError, match="Connection is closed"):
+            db.list_tables()
 
 
 @pytest.mark.parametrize("exception", [KeyboardInterrupt, SystemExit, GeneratorExit])
```

---

### Incident Patch 14: `2734e107` (2026-10-02)
**Commit Message**: fix(node): update arrow to 21 (#4362)

Thanks @vincentkoc for starting this! I was just looking into this
myself. I started with your PR and added:
- make arrow 21 the default
- widen the peer range to <22 so if they release 21.3 that'll be
included
- have to do skipLibCheck in tsconfig.json, because of flatbuffers 25
which needs TypeScript 5.7
- fix override in Symbol.hasInstance
- support new types in Arrow 20-21 (LargeList, Utf8View, BinaryView,
IntervalMonthDayNano)
- arrow-compat job in nodejs.yml that runs tests with arrow 19 and 20
(adds 2 sec)
- put the list of arrow types in one place
- update NODEJS_THIRD_PARTY_LICENSES.md
- regenerated typescript docs (sorry about reorderings, one time cost)
- reformat arrow.test.ts (sorry, almost all whitespace, thanks to biome.
git diff -w shows 110 lines edited)
- fixed Sliced Utf8View / BinaryView serialization error, by just
converting them to Utf8 and Binary (as our rust code would anyway)

---------

Co-authored-by: Vincent Koc <[REDACTED_EMAIL]>
Co-authored-by: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `.github/workflows/nodejs.yml` (modified, +65/-0)
```diff
@@ -164,6 +164,71 @@ jobs:
         python ci/mock_openai.py &
         cd nodejs/examples
         node_modules/.bin/jest --testEnvironment jest-environment-node-single-context --verbose
+  arrow-compat:
+    # The main jobs resolve `apache-arrow` to the version pinned in
+    # devDependencies (the newest supported release). This job re-runs the
+    # suite with the library itself running on each older Arrow release the
+    # peer range still accepts, which is what a consumer on that version gets.
+    name: Linux (Arrow ${{ matrix.arrow-version }})
+    timeout-minutes: 30
+    strategy:
+      matrix:
+        arrow-version: [ "19.0.1", "20.0.0" ]
+    runs-on: "ubuntu-22.04"
+    defaults:
+      run:
+        shell: bash
+        working-directory: nodejs
+    steps:
+    - uses: actions/checkout@v6
+      with:
+        fetch-depth: 0
+        lfs: true
+    - uses: pnpm/action-setup@v6
+      with:
+        version: 11.1.1
+    - uses: actions/setup-node@v6
+      with:
+        node-version: 24
+        cache: 'pnpm'
+        cache-dependency-path: nodejs/pnpm-lock.yaml
+    - uses: Swatinem/rust-cache@v2
+      with:
+        # Same crate, profile and target as the `linux` job above, so reuse
+        # its cache: rust-cache keys on the job id by default, and this job
+        # would otherwise start cold on every run until it had saved its own.
+        shared-key: linux
+        save-if: ${{ github.ref == 'refs/heads/main' }}
+    - name: Install dependencies
+      run: |
+        sudo apt update
+        sudo apt install -y protobuf-compiler libssl-dev
+    - name: Build
+      run: |
+        pnpm install --frozen-lockfile
+        # No `--` separator: pnpm forwards it literally, which would
+        # make napi-rs treat `--profile ci` as a cargo passthrough arg.
+        pnpm build:debug --profile ci
+    - name: Resolve apache-arrow to ${{ matrix.arrow-version }}
+      run: |
+        # The older releases are already installed as the `apache-arrow-NN`
+        # test aliases. With pnpm's hoisted linker each alias is a complete,
+        # self-contained directory, so swap it in for the library's own
+        # `apache-arrow` instead of running a second install, which has been
+        # seen to hang after printing "Done" in CI. A copy, not a symlink: the
+        # cross-version tests rely on the alias being a separate module
+        # instance from the one the library loads.
+        major="$(echo '${{ matrix.arrow-version }}' | cut -d. -f1)"
+        mv node_modules/apache-arrow node_modules/apache-arrow.pinned
+        cp -R "node_modules/apache-arrow-${major}" node_modules/apache-arrow
+        # `require("apache-arrow/package.json")` is blocked by the package's exports map.
+        node -p "'apache-arrow resolved to ' + JSON.parse(require('fs').readFileSync('node_modules/apache-arrow/package.json')).version"
+        pnpm tsc
+    - name: Test
+      env:
+        # Newer @smithy/core uses dynamic ESM imports.
+        NODE_OPTIONS: "--experimental-vm-modules"
+      run: node_modules/.bin/jest --verbose
   macos:
     timeout-minutes: 30
     # macos-15 ships a newer linker; the older macos-14 linker fails to insert
```

**File**: `docs/src/js/classes/AutoQuery.md` (modified, +1/-1)
```diff
@@ -350,7 +350,7 @@ input to this method would be:
 
 #### Parameters
 
-* **columns**: `string` \| `string`[] \| `Record`&lt;`string`, `string`&gt; \| `Map`&lt;`string`, `string`&gt;
+* **columns**: `string` \| `string`[] \| `Map`&lt;`string`, `string`&gt; \| `Record`&lt;`string`, `string`&gt;
 
 #### Returns
 
```

**File**: `docs/src/js/classes/Query.md` (modified, +1/-1)
```diff
@@ -424,7 +424,7 @@ input to this method would be:
 
 #### Parameters
 
-* **columns**: `string` \| `string`[] \| `Record`&lt;`string`, `string`&gt; \| `Map`&lt;`string`, `string`&gt;
+* **columns**: `string` \| `string`[] \| `Map`&lt;`string`, `string`&gt; \| `Record`&lt;`string`, `string`&gt;
 
 #### Returns
 
```

**File**: `docs/src/js/classes/QueryBase.md` (modified, +1/-1)
```diff
@@ -193,7 +193,7 @@ input to this method would be:
 
 #### Parameters
 
-* **columns**: `string` \| `string`[] \| `Record`&lt;`string`, `string`&gt; \| `Map`&lt;`string`, `string`&gt;
+* **columns**: `string` \| `string`[] \| `Map`&lt;`string`, `string`&gt; \| `Record`&lt;`string`, `string`&gt;
 
 #### Returns
 
```

**File**: `docs/src/js/classes/Table.md` (modified, +1/-1)
```diff
@@ -1381,7 +1381,7 @@ repeatedly calling this method.
 
 ##### Parameters
 
-* **updates**: `Record`&lt;`string`, `string`&gt; \| `Map`&lt;`string`, `string`&gt;
+* **updates**: `Map`&lt;`string`, `string`&gt; \| `Record`&lt;`string`, `string`&gt;
     the
     columns to update
 
```

**File**: `docs/src/js/classes/TakeQuery.md` (modified, +1/-1)
```diff
@@ -200,7 +200,7 @@ input to this method would be:
 
 #### Parameters
 
-* **columns**: `string` \| `string`[] \| `Record`&lt;`string`, `string`&gt; \| `Map`&lt;`string`, `string`&gt;
+* **columns**: `string` \| `string`[] \| `Map`&lt;`string`, `string`&gt; \| `Record`&lt;`string`, `string`&gt;
 
 #### Returns
 
```

**File**: `docs/src/js/classes/VectorQuery.md` (modified, +1/-1)
```diff
@@ -673,7 +673,7 @@ input to this method would be:
 
 #### Parameters
 
-* **columns**: `string` \| `string`[] \| `Record`&lt;`string`, `string`&gt; \| `Map`&lt;`string`, `string`&gt;
+* **columns**: `string` \| `string`[] \| `Map`&lt;`string`, `string`&gt; \| `Record`&lt;`string`, `string`&gt;
 
 #### Returns
 
```

**File**: `docs/src/js/globals.md` (modified, +1/-0)
```diff
@@ -162,6 +162,7 @@
 - [BlobReadOptions](type-aliases/BlobReadOptions.md)
 - [Data](type-aliases/Data.md)
 - [DataLike](type-aliases/DataLike.md)
+- [DataTypeLike](type-aliases/DataTypeLike.md)
 - [FieldLike](type-aliases/FieldLike.md)
 - [IntoSql](type-aliases/IntoSql.md)
 - [IntoVector](type-aliases/IntoVector.md)
```

---

### Incident Patch 15: `f72779eb` (2026-10-02)
**Commit Message**: build(deps): bump the rust-minor-patch group across 1 directory with 7 updates (#4355)

Bumps the rust-minor-patch group with 7 updates in the / directory:

| Package | From | To |
| --- | --- | --- |
| [aws-smithy-types](https://github.com/smithy-lang/smithy-rs) | `1.6.3`
| `1.6.4` |
| [object_store](https://github.com/apache/arrow-rs-object-store) |
`0.14.1` | `0.14.2` |
| [serde_with](https://github.com/jonasbb/serde_with) | `3.23.0` |
`3.24.0` |
| [napi](https://github.com/napi-rs/napi-rs) | `3.12.2` | `3.12.5` |
| [napi-derive](https://github.com/napi-rs/napi-rs) | `3.6.5` | `3.6.9`
|
| [napi-build](https://github.com/napi-rs/napi-rs) | `2.4.2` | `2.5.0` |
| [arc-swap](https://github.com/vorner/arc-swap) | `1.9.1` | `1.9.2` |


Updates `aws-smithy-types` from 1.6.3 to 1.6.4
<details>
<summary>Commits</summary>
<ul>
<li>See full diff in <a
href="https://github.com/smithy-lang/smithy-rs/commits">compare
view</a></li>
</ul>
</details>
<br />

Updates `object_store` from 0.14.1 to 0.14.2
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a
href="https://github.com/apache/arrow-rs-object-store/releases">object_store's
releases</a>.</em></p>
<blockquote>
<h2>object_stor

**File**: `Cargo.lock` (modified, +52/-52)
```diff
@@ -141,7 +141,7 @@ version = "1.1.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "40c48f72fd53cd289104fc64099abca73db4166ad86ea0b4341abe65af83dadc"
 dependencies = [
- "windows-sys 0.60.2",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -152,7 +152,7 @@ checksum = "291e6a250ff86cd4a820112fb8898808a366d8f9f58ce16d1f538353ad55747d"
 dependencies = [
  "anstyle",
  "once_cell_polyfill",
- "windows-sys 0.60.2",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -181,9 +181,9 @@ dependencies = [
 
 [[package]]
 name = "arc-swap"
-version = "1.9.1"
+version = "1.9.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6a3a1fd6f75306b68087b831f025c712524bcb19aad54e557b1129cfa0a2b207"
+checksum = "c049c0be4daef0b145cb3555416b3b8ef5b7888a38aea1a3a155801fe7b0810b"
 dependencies = [
  "rustversion",
 ]
@@ -1110,9 +1110,9 @@ dependencies = [
 
 [[package]]
 name = "aws-smithy-types"
-version = "1.6.3"
+version = "1.6.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8f94d16e797ec62cd999fc9d5942b48fa7050c3093ddadff48e4d7528d16fcb9"
+checksum = "0b791f3ac597193fe1d08b82366986eb1f5bc31f2ac6c194c0855276116c76cd"
 dependencies = [
  "base64-simd",
  "bytes",
@@ -1819,7 +1819,7 @@ version = "3.1.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "faf9468729b8cbcea668e36183cb69d317348c2e08e994829fb56ebfdfbaac34"
 dependencies = [
- "windows-sys 0.59.0",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -3087,7 +3087,7 @@ dependencies = [
  "libc",
  "option-ext",
  "redox_users",
- "windows-sys 0.59.0",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -3315,7 +3315,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "39cab71617ae0d63f51a36d69f866391735b51691dbda63cf6f96d042b63efeb"
 dependencies = [
  "libc",
- "windows-sys 0.59.0",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -4538,7 +4538,7 @@ dependencies = [
  "libc",
  "percent-encoding",
  "pin-project-lite",
- "socket2 0.5.10",
+ "socket2 0.6.3",
  "system-configuration",
  "tokio",
  "tower-service",
@@ -4880,7 +4880,7 @@ checksum = "3640c1c38b8e4e43584d8df18be5fc6b0aa314ce6ebf51b53313d4306cca8e46"
 dependencies = [
  "hermit-abi",
  "libc",
- "windows-sys 0.59.0",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -5193,7 +5193,7 @@ dependencies = [
  "lance-tokenizer",
  "log",
  "moka",
- "object_store 0.14.1",
+ "object_store 0.14.2",
  "permutation",
  "pin-project",
  "prost",
@@ -5294,7 +5294,7 @@ dependencies = [
  "log",
  "moka",
  "num_cpus",
- "object_store 0.14.1",
+ "object_store 0.14.2",
  "pin-project",
  "prost",
  "quick_cache",
@@ -5428,7 +5428,7 @@ dependencies = [
  "lance-io",
  "log",
  "num-traits",
- "object_store 0.14.1",
+ "object_store 0.14.2",
  "prost",
  "prost-build",
  "prost-types",
@@ -5505,7 +5505,7 @@ dependencies = [
  "log",
  "ndarray",
  "num-traits",
- "object_store 0.14.1",
+ "object_store 0.14.2",
  "prost",
  "prost-build",
  "prost-types",
@@ -5571,7 +5571,7 @@ dependencies = [
  "log",
  "metrics",
  "moka",
- "object_store 0.14.1",
+ "object_store 0.14.2",
  "object_store_opendal",
  "opendal",
  "opendal-service-goosefs",
@@ -5647,7 +5647,7 @@ dependencies = [
  "lance-namespace",
  "lance-table",
  "log",
- "object_store 0.14.1",
+ "object_store 0.14.2",
  "quick-xml 0.40.1",
  "rand 0.9.5",
  "reqwest 0.12.28",
@@ -5715,7 +5715,7 @@ dependencies = [
  "lance-io",
  "lance-select",
  "log",
- "object_store 0.14.1",
+ "object_store 0.14.2",
  "prost",
  "prost-build",
  "prost-types",
@@ -5826,7 +5826,7 @@ dependencies = [
  "moka",
  "num-traits",
  "oauth2",
- "object_store 0.14.1",
+ "object_store 0.14.2",
  "pin-project",
  "polars",
  "polars-arrow",
@@ -6475,9 +6475,9 @@ dependencies = [
 
 [[package]]
 name = "napi"
-version = "3.12.2"
+version = "3.12.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "58c5f4d5375213fdb7be2655e152386e82f026f9a5ba36a75556e11359aafe09"
+checksum = "f0c007d4a8ead952a81887661d41fd56b7e7a70d3d4d921f445fb37a8f6efa1e"
 dependencies = [
  "bitflags 2.11.1",
  "chrono",
@@ -6495,15 +6495,15 @@ dependencies = [
 
 [[package]]
 name = "napi-build"
-version = "2.4.2"
+version = "2.5.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "860e7c40864f95cfb83cde99f9ebadd88ef3d9bdccd7dd2cee0cc96a2dd4ffa7"
+checksum = "0941983559cd62bfa7f04646a16428967a847365adeef27711e4e3927046bbed"
 
 [[package]]
 name = "napi-derive"
-version = "3.6.5"
+version = "3.6.9"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "350057056a30368aa76c11a0d406b0aa61321710be2c36656ab4f6efe0b785a2"
+checksum = "6b1d232c24dc6754979b27efdf2047a5849efc7c92c1245de87e6bedbb9f5c3c"
 dependencies = [
  "convert_case",
  "ctor",
@@ -6515,9 +6515,9 @@ dependencies = [
 
 [[package]]
 name = "napi-derive-backend"
-version = "6.1.3"
+version = "6.1.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-che
```

#### Recent Merged Pull Requests:
- **PR #4434** (2026-10-05): fix: preserve Function dependency errors in column operations (@Xuanwo)
- **PR #4426** (2026-10-05): fix(python): use exact integer math for list_versions timestamps (@aviralsaxena16)
- **PR #4425** (2026-10-03): fix(remote): preserve schema for empty merge insert sources (@lancedb-gatefixer[bot])
- **PR #4424** (2026-10-03): fix(python): close synchronous database connections (@lancedb-gatefixer[bot])
- **PR #4423** (2026-10-03): fix(node): preserve schemas for empty query results (@lancedb-gatefixer[bot])
- **PR #4422** (2026-10-03): fix(python): repair sync manifest path migration (@lancedb-gatefixer[bot])
- **PR #4421** (2026-10-03): fix(python): support exist_ok in local create_table (@Arthur031221)
- **PR #4420** (2026-10-03): fix(python): serialize deprecated v2 manifest option (@lancedb-gatefixer[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
