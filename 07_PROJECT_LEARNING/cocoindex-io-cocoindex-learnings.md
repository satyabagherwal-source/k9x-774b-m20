# Forensic Learning Record (Deep Inspection): cocoindex-io/cocoindex

> **Canonical Artifact**: `07_PROJECT_LEARNING/cocoindex-io-cocoindex-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/cocoindex-io/cocoindex](https://github.com/cocoindex-io/cocoindex))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:11:39.014Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cocoindex-io/cocoindex`
- **Description**: Incremental engine for long horizon agents 🌟 Star if you like it!
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md
- **Stars / Engagement**: 11644 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/state_store/main.py`
```
"""
State-store benchmark pipeline.

Mounts N child components. Each runs a memoized function that declares M
target states against a no-op fake target — the engine still writes the
per-target tracking records into the state store (and runs the full
pre_commit / commit lifecycle), but the user-facing sink does nothing,
so we isolate cocoindex-side cost.

`M = 0` reproduces the original "component-path bookkeeping + memo only"
shape (no target-state traffic).

Environment knobs:
    BENCH_N — number of mounted child components (default 100).
    BENCH_M — number of target states declared per component (default 0).
"""

from __future__ import annotations

import os
from typing import Collection

import cocoindex as coco


_N: int = int(os.environ.get("BENCH_N", "100"))
_M: int = int(os.environ.get("BENCH_M", "0"))


class _NoopTargetHandler:
    """Target handler that drives the per-state tracking record through
    pre_commit + commit but does nothing user-visible. `desired_state` is
    `None` for upsert and `NonExistence` for delete; the sink is a no-op so
    we measure cocoindex's own per-target write path without external IO."""

    def __init__(self) -> None:
        self._sink: coco.TargetActionSink[tuple[coco.StableKey, bool]] = (
            coco.TargetActionSink.from_fn(self._apply)
        )

    @staticmethod
    def _apply(
        _ctx: coco.ContextProvider,
        _actions: Collection[tuple[coco.StableKey, bool]],
        /,
    ) -> None:
        return None

    def reconcile(
        self,
        key: coco.StableKey,
        desired_state: None | coco.NonExistenceType,
        _prev_records: Collection[None],
        _prev_may_be_missing: bool,
        /,
    ) -> coco.TargetReconcileOutput[tuple[coco.StableKey, bool], None] | None:
        is_delete = coco.is_non_existence(desired_state)
        tracking_record: None | coco.NonExistenceType = (
            coco.NON_EXISTENCE if is_delete else None
        )
        return coco.TargetReconcileOutput(
            action=(key, is_delete),
            sink=self._sink,
            tracking_record=tracking_record,
        )


_noop_provider = coco.register_root_target_states_provider(
    "cocoindex/bench/noop", _NoopTargetHandler()
)


@coco.fn(memo=True)
async def noop_component(idx: int) -> None:
    """Memoized component: declares _M no-op target states. Memo lets warm
    runs short-circuit recomputation; declared target states still flow
    through pre_commit / commit so the target-state write path is
    exercised."""
    for j in range(_M):
        coco.declare_target_state(_noop_provider.target_state(f"{idx}-{j}", None))


@coco.fn
async def app_main() -> None:
    items = [(str(i), i) for i in range(_N)]
    await coco.mount_each(noop_component, items)


app = coco.App("StateStoreBench", app_main)

```

### Core Architecture Module: `benchmarks/state_store/runner.py`
```
"""
State-store benchmark runner.

For each (N, M) cell, runs three phases via the cocoindex CLI against a
fresh LMDB state store in a temp directory:

    cold   — fresh state, first `cocoindex update` (creates app + memo entries)
    warm   — second `cocoindex update` against the populated state (all memo hits)
    drop   — `cocoindex drop -f` on the populated state (cascade + clear)

Times are wall-clock from subprocess.run, matching what the user observes.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path


BENCH_DIR = Path(__file__).resolve().parent
MAIN_PY = BENCH_DIR / "main.py"

DEFAULT_NS = (100, 1_000, 10_000)


@dataclass
class CellResult:
    n: int
    m: int
    cold_s: float
    warm_s: float
    drop_s: float


def _run(cmd: list[str], env: dict[str, str], cwd: Path) -> float:
    """Run a subprocess to completion and return its wall-clock seconds."""
    t = time.perf_counter()
    proc = subprocess.run(cmd, env=env, cwd=cwd, capture_output=True, text=True)
    elapsed = time.perf_counter() - t
    if proc.returncode != 0:
        print(f"  ! {' '.join(cmd)} failed (rc={proc.returncode})", file=sys.stderr)
        if proc.stdout:
            print(proc.stdout, file=sys.stderr)
        if proc.stderr:
            print(proc.stderr, file=sys.stderr)
        raise RuntimeError(f"{cmd[0]} failed")
    return elapsed


_COCOINDEX_CMD = [sys.executable, "-m", "cocoindex.cli"]


def _cell(n: int, m: int) -> CellResult:
    update_cmd = [*_COCOINDEX_CMD, "update", str(MAIN_PY)]
    drop_cmd = [*_COCOINDEX_CMD, "drop", "-f", str(MAIN_PY)]
    with tempfile.TemporaryDirectory(prefix="coco-bench-lmdb-") as tmp:
        env = {
            **os.environ,
            "COCOINDEX_DB": str(Path(tmp) / "db"),
            "BENCH_N": str(n),
            "BENCH_M": str(m),
        }
        cold = _run(update_cmd, env, BENCH_DIR)
        warm = _run(update_cmd, env, BENCH_DIR)
        drop = _run(drop_cmd, env, BENCH_DIR)
    return CellResult(n=n, m=m, cold_s=cold, warm_s=warm, drop_s=drop)


def _print_table(results: list[CellResult]) -> None:
    hdr = f"{'N':>8}  {'M':>4}  {'cold':>8}  {'warm':>8}  {'drop':>8}"
    print(hdr)
    print("-" * len(hdr))
    for r in sorted(results, key=lambda r: (r.n, r.m)):
        print(
            f"{r.n:>8}  {r.m:>4}  {r.cold_s:>8.3f}  {r.warm_s:>8.3f}  {r.drop_s:>8.3f}"
        )
    print()
    print("All numbers in seconds. Lower is better.")


def _print_json(results: list[CellResult]) -> None:
    print(
        json.dumps(
            [
                {
                    "n": r.n,
                    "m": r.m,
                    "cold_s": r.cold_s,
                    "warm_s": r.warm_s,
                    "drop_s": r.drop_s,
                }
                for r in results
            ],
            indent=2,
        )
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--n",
        default=",".join(str(n) for n in DEFAULT_NS),
        help=f"Comma-separated list of component counts. Default: {','.join(str(n) for n in DEFAULT_NS)}",
    )
    parser.add_argument(
        "--m",
        default="0",
        help=(
            "Comma-separated list of per-component target-state counts. "
            "Default: 0 (no target states). Each non-zero M exercises the "
            "target-state write path on every component."
        ),
    )
    parser.add_argument(
        "--format",
        choices=("table", "json"),
        default="table",
    )
    args = parser.parse_args()

    ns = [int(s) for s in args.n.split(",") if s.strip()]
    ms = [int(s) for s in args.m.split(",") if s.strip()]

    results: list[CellResult] = []
    for n in ns:
        for m in ms:
            label = f"N={n}/M={m}"
            print(f"running {label} …", flush=True)
            try:
                r = _cell(n, m)
            except Exception as exc:
                print(f"  ! {label} failed: {exc}", file=sys.stderr)
                continue
            print(
                f"  cold {r.cold_s:.3f}s   warm {r.warm_s:.3f}s   drop {r.drop_s:.3f}s",
                flush=True,
            )
            results.append(r)

    print()
    if args.format == "json":
        _print_json(results)
    else:
        _print_table(results)
    return 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `python/cocoindex/_internal/target_state.py`
```
from __future__ import annotations

from typing import (
    Collection,
    Generic,
    Literal,
    Mapping,
    NamedTuple,
    Protocol,
    Any,
    Sequence,
    TypeAlias,
    overload,
)
import threading
import warnings
import weakref
from typing_extensions import TypeVar

from . import core
from .component_ctx import get_context_from_ctx
from .context_keys import ContextProvider
from .pending_marker import PendingS, MaybePendingS, ResolvesTo
from .serde import (
    make_deserialize_fn,
    get_param_annotation,
    qualified_name,
    unwrap_element_type,
)
from .typing import NonExistenceType, StableKey


ActionT = TypeVar("ActionT")
ActionT_co = TypeVar("ActionT_co", covariant=True)
ActionT_contra = TypeVar("ActionT_contra", contravariant=True)

ValueT = TypeVar("ValueT", default=Any)
ValueT_contra = TypeVar("ValueT_contra", contravariant=True, default=Any)
TrackingRecordT = TypeVar("TrackingRecordT", default=Any)
TrackingRecordT_co = TypeVar("TrackingRecordT_co", covariant=True, default=Any)
HandlerT_contra = TypeVar(
    "HandlerT_contra", contravariant=True, bound="TargetHandler[Any, Any, Any]"
)
HandlerT_co = TypeVar(
    "HandlerT_co", covariant=True, bound="TargetHandler[Any, Any, Any]"
)
OptChildHandlerT = TypeVar(
    "OptChildHandlerT",
    bound="TargetHandler[Any, Any, Any] | None",
    default=None,
    covariant=True,
)
OptChildHandlerT_co = TypeVar(
    "OptChildHandlerT_co",
    bound="TargetHandler[Any, Any, Any] | None",
    default=None,
    covariant=True,
)
# Deprecated second type parameter of `TargetActionSink`. Defaults to `Any` so
# `TargetActionSink[A]` accepts a sink annotated the pre-slot way,
# `TargetActionSink[A, ChildHandler]`, and vice versa.
_DeprecatedChildHandlerT_co = TypeVar(
    "_DeprecatedChildHandlerT_co", default=Any, covariant=True
)


class _TypedTargetHandlerWrapper:
    """Wraps a TargetHandler to auto-deserialize tracking records (StoredValue → typed objects)."""

    __slots__ = ("_handler", "_deserializer", "tracks_value_fingerprint")

    def __init__(self, handler: Any) -> None:
        self._handler = handler
        self.tracks_value_fingerprint: bool = getattr(
            handler, "tracks_value_fingerprint", False
        )
        # reconcile(self, key, desired, prev_possible_records, ...) — position 3
        reconcile_label = qualified_name(type(handler).reconcile)
        try:
            ann = get_param_annotation(type(handler).reconcile, 3)
            record_type = unwrap_element_type(ann)
        except Exception:
            record_type = Any
        self._deserializer = make_deserialize_fn(
            record_type,
            source_label=f"prev_possible_records param of {reconcile_label}()",
        )

    def reconcile(
        self,
        key: Any,
        desired: Any,
        prev_possible_records: Any,
        prev_may_be_missing: bool,
        /,
    ) -> Any:
        records = [r.get(self._deserializer) for r in prev_possible_records]
        return self._handler.reconcile(key, desired, records, prev_may_be_missing)

    def attachments(self) -> dict[str, Any]:
        if not hasattr(self._handler, "attachments"):
            return {}
        return {
            k: _TypedTargetHandlerWrapper(v)
            for k, v in self._handler.attachments().items()
        }


class ChildSlot(Generic[HandlerT_contra]):
    """Fulfillment handle for the child target states under one container action.

    A sink built with :meth:`TargetActionSink.from_fn_with_children` or
    :meth:`TargetActionSink.from_async_fn_with_children` receives one slot per
    action whose target state was declared with ``declare_target_state_with_child``
    (or ``mount_target``), keyed by the action's index in the batch. It must call
    :meth:`fulfill` exactly once per slot, before returning, with the handler for
    the child target states. A slot left unfulfilled fails the commit.
    """

    __slots__ = ("_core",)
    _core: core.ChildTargetSlot

    def __init__(self, core_slot: core.ChildTargetSlot) -> None:
        self._core = core_slot

    def fulfill(self, handler: HandlerT_contra, /) -> None:
        self._core.fulfill(_TypedTargetHandlerWrapper(handler))


class ChildTargetDef(Generic[HandlerT_co], NamedTuple):
    """Deprecated: a child handler returned from a sink under the pre-slot contract.

    Before child slots, a container sink built with
    :meth:`TargetActionSink.from_fn` / :meth:`TargetActionSink.from_async_fn`
    returned one ``ChildTargetDef`` (or ``None``) per action, index-aligned with
    ``actions``. Such sinks still work and emit a :class:`DeprecationWarning`;
    new code builds the sink with :meth:`TargetActionSink.from_fn_with_children`
    and fulfills each :class:`ChildSlot` instead. This class will be removed in
    a future release.
    """

    handler: HandlerT_co


class TargetActionSinkFn(Protocol[ActionT_contra]):
    """Sync callback of a sink built with :meth:`TargetActionSink.from_fn`."""

    def __call__(
        self, context_provider: ContextProvider, actions: Sequence[ActionT_contra], /
    ) -> None: ...


class AsyncTargetActionSinkFn(Protocol[ActionT_contra]):
    """Async callback of a sink built with :meth:`TargetActionSink.from_async_fn`."""

    async def __call__(
        self, context_provider: ContextProvider, actions: Sequence[ActionT_contra], /
    ) -> None: ...


class LegacyTargetActionSinkFn(Protocol[ActionT_contra]):
    """Deprecated: the pre-slot callback contract of :meth:`TargetActionSink.from_fn`.

    The callback returns one :class:`ChildTargetDef` (or ``None``) per action,
    index-aligned with ``actions``. Such sinks still run and emit a
    :class:`DeprecationWarning`; see :class:`ChildTargetDef`.
    """

    def __call__(
        self, context_provider: ContextProvider, actions: Sequence[ActionT_contra], /
    ) -> Sequence[ChildTargetDef[Any] | None] | None: ...


class LegacyAsyncTargetActionSinkFn(Protocol[ActionT_contra]):
    """Deprecated: async counterpart of :class:`LegacyTargetActionSinkFn`."""

    async def __call__(
        self, context_provider: ContextProvider, actions: Sequence[ActionT_contra], /
    ) -> Sequence[ChildTargetDef[Any] | None] | None: ...


class TargetActionSinkWithChildrenFn(Protocol[ActionT_contra]):
    def __call__(
        self,
        context_provider: ContextProvider,
        actions: Sequence[ActionT_contra],
        child_slots: Mapping[int, ChildSlot[Any]],
        /,
    ) -> None: ...


class AsyncTargetActionSinkWithChildrenFn(Protocol[ActionT_contra]):
    async def __call__(
        self,
        context_provider: ContextProvider,
        actions: Sequence[ActionT_contra],
        child_slots: Mapping[int, ChildSlot[Any]],
        /,
    ) -> None: ...


class TargetActionSink(Generic[ActionT_contra, _DeprecatedChildHandlerT_co]):
    """Applies batches of actions to the external system.

    Sinks share one identity — actions reconciled to them are batched and
    applied together — iff their callbacks are of the same type and compare
    equal. The same function or bound method always yields the same identity;
    a callable with value equality (e.g. a frozen dataclass implementing
    ``__call__``) may be constructed on the fly at each ``reconcile()`` call.
    The callback must support weak references, so an idle identity can be
    released; a tuple/NamedTuple callback is rejected with ``TypeError``.

    A sink built with :meth:`from_fn` / :meth:`from_async_fn` serves leaf
    target states (or, deprecated, a container whose callback returns
    ``ChildTargetDef`` entries). A sink whose actions may carry child target
    states (container targets, or a sink shared between a container and its
    leaves) is built with :meth:`from_fn_with_children` /
    :meth:`from_async_fn_with_children` and fulfills a :class:`ChildSlot` per
    child-bearing action.

    The second type parameter is deprecated and ignored. It remains so that
    ``TargetActionSink[Action, ChildHandler]`` annotations written for the
    pre-slot contract keep working; write ``TargetActionSink[Action]``.
    """

    __slots__ = ("_core",)
    _core: core.TargetActionSink

    def __init__(self, core_action_sink: core.TargetActionSink):
        self._core = core_action_sink

    def __class_getitem__(cls, params: Any) -> Any:
        if isinstance(params, tuple) and len(params) == 2:
            warnings.warn(
                "TargetActionSink takes one type argument; the second (child "
                "handler) argument is deprecated and ignored",
                DeprecationWarning,
                stacklevel=2,
            )
        return super().__class_getitem__(params)  # type: ignore[misc]

    @overload
    @staticmethod
    def from_fn(
        fn: TargetActionSinkFn[ActionT_contra],
    ) -> "TargetActionSink[ActionT_contra, _DeprecatedChildHandlerT_co]": ...
    @overload
    @staticmethod
    def from_fn(
        fn: LegacyTargetActionSinkFn[ActionT_contra],
    ) -> "TargetActionSink[ActionT_contra, _DeprecatedChildHandlerT_co]": ...
    @staticmethod
    def from_fn(
        fn: TargetActionSinkFn[Any] | LegacyTargetActionSinkFn[Any],
    ) -> "TargetActionSink[Any, Any]":
        """Create a leaf sink from a sync callback ``(context_provider, actions)``.

        A callback returning ``ChildTargetDef`` entries (the deprecated
        pre-slot contract, :class:`LegacyTargetActionSinkFn`) is still accepted.
        """
        canonical = _SYNC_FN_DEDUPER.get_canonical(fn)
        return TargetActionSink(
            core.TargetActionSink.new_sync(canonical, with_children=False)
        )

    @overload
    @staticmethod
    def from_async_fn(
        fn: AsyncTargetActionSinkFn[ActionT_contra],
    ) -> "TargetActionSink[ActionT_contra, _DeprecatedChildHandlerT_co]": ...
    @overload
    @staticmethod
    def from_async_fn(
        fn: LegacyAsyncTargetActionSinkFn[ActionT_contra],
    ) -> "TargetActionSink[ActionT_contra, _DeprecatedCh
```

### Core Architecture Module: `python/cocoindex/_internal/target_state_codec.py`
```
"""
Compact in-memory form of declared target-state values and their actions.

The engine holds each declared target state's value from its declaration until
its component commits, and each action `reconcile()` builds until the sink has
applied it. For row-shaped values the Python objects are most of that cost: a
dict of fifteen short strings and ints takes about 1 KB, its encoding here
about 150 B. This module gives the engine an exact, compact encoding for both,
so the engine holds bytes and hands an equivalent object back where one is
needed: to `reconcile()`, and to the sink.

Only plain data is encoded. Pickle restores exact builtin containers and
scalars, and a fixed set of value types (date/time types, `Decimal`, `UUID`,
`Fraction`, `ipaddress` and `pathlib` objects, numpy arrays, scalars and
dtypes, enum members, NamedTuples), exactly: a tuple stays a tuple, a
`Decimal` a `Decimal`, and two references to one object within a value still
share it. A value holding anything else (a dataclass, a pydantic model, a
msgspec Struct, a subclass of a builtin, a handle, a lambda) is left to be held
as the object itself, as are scalars, already compact, and values whose
encoding exceeds `_MAX_ENCODED_SIZE`.

A dict whose keys are exact strings, and whose values cannot refer back to it,
is encoded as a row: its values only, plus the id of its key tuple, interned
once per process (`_KeySchemas`). A row's column names then cost nothing per
row, and decoded rows share their key objects, as rows built by a connector do.

What a handler or sink observes: an equal copy of the declared value, taken at
declaration, instead of the declared object, and an equal copy of the action
it returned. Each value is encoded on its own, so an object that many declared
values share is copied into each of their encodings.
"""

from __future__ import annotations

import datetime
import decimal
import enum
import fractions
import io
import ipaddress
import operator
import pathlib
import pickle
import threading
import types
import uuid
import zoneinfo
from typing import Any

import numpy as np

_PROTOCOL = 5

# An encoding larger than this is not held: such a value is mostly payload
# (text, vectors) that is compact as an object already, and an object shared
# by many declared values would be copied into each of their encodings.
_MAX_ENCODED_SIZE = 64 * 1024

# First byte of a value's encoding.
_PICKLED = 0  # a pickle of the value follows
_ROW = 1  # a 2-byte key schema id, then a pickle of the row's values tuple
_ROW_SCHEMA_ID_SIZE = 2

# Held as the object itself even at the top of a value: already compact.
_SCALAR_TYPES: frozenset[type] = frozenset({type(None), bool, int, float, str, bytes})


def _all_subclasses(cls: type) -> list[type]:
    result: list[type] = []
    for sub in cls.__subclasses__():
        result.append(sub)
        result.extend(_all_subclasses(sub))
    return result


# Value types whose instances pickle exactly. Exact builtin containers and
# scalars never reach the pickler's hook, so they are not listed.
_VALUE_TYPES: frozenset[type] = frozenset(
    {
        complex,
        datetime.date,
        datetime.time,
        datetime.datetime,
        datetime.timedelta,
        datetime.timezone,
        zoneinfo.ZoneInfo,
        decimal.Decimal,
        uuid.UUID,
        fractions.Fraction,
        ipaddress.IPv4Address,
        ipaddress.IPv6Address,
        ipaddress.IPv4Network,
        ipaddress.IPv6Network,
        ipaddress.IPv4Interface,
        ipaddress.IPv6Interface,
        np.ndarray,
        pathlib.PurePath,
        *_all_subclasses(pathlib.PurePath),
    }
)

# Values a row's values may hold without being able to refer back to the row.
_ROW_ATOM_TYPES: frozenset[type] = (_SCALAR_TYPES | _VALUE_TYPES) - {np.ndarray}


class _Unencodable(Exception):
    """Raised while pickling a value that holds something other than plain data."""


def _is_plain_data(obj: Any) -> bool:
    """Whether `obj`, which the pickler is about to reduce, pickles exactly."""
    cls = type(obj)
    if cls in _VALUE_TYPES:
        return True
    if isinstance(obj, (enum.Enum, np.generic, np.dtype)):
        return True
    if isinstance(obj, tuple):
        # Exact tuples are pickled without the hook; a NamedTuple gets here.
        return hasattr(cls, "_fields")
    # Classes and functions pickle by reference: as the reconstructors in the
    # reductions of the types above, or as plain data within a value.
    if isinstance(obj, type) or cls is types.FunctionType:
        return True
    # `isinstance`: a C method using its defining class (`ZoneInfo._unpickle`
    # on 3.14) is a subtype of the builtin function type.
    if isinstance(obj, (types.BuiltinFunctionType, types.MethodType)):
        # A module-level builtin, or one bound to a class; one bound to an
        # instance would pickle that instance.
        return isinstance(obj.__self__, (types.ModuleType, type))
    return False


class _Pickler(pickle.Pickler):
    def reducer_override(self, obj: Any) -> Any:
        if _is_plain_data(obj):
            return NotImplemented
        raise _Unencodable


def _dump(header: bytes, obj: Any) -> bytes:
    buf = io.BytesIO()
    buf.write(header)
    _Pickler(buf, _PROTOCOL).dump(obj)
    return buf.getvalue()


def _all_exact_str(keys: tuple[Any, ...]) -> bool:
    return all(type(key) is str for key in keys)


class _KeySchemas:
    """Key tuples of the dicts encoded as rows, interned for the process.

    Bounded: once full, dicts with an unseen key tuple are pickled whole.
    """

    _MAX_SCHEMAS = 4096

    __slots__ = ("_ids", "_keys", "_lock")
    _ids: dict[tuple[str, ...], int]
    _keys: list[tuple[str, ...]]
    _lock: threading.Lock

    def __init__(self) -> None:
        self._ids = {}
        self._keys = []
        self._lock = threading.Lock()

    def id_of(self, keys: tuple[Any, ...]) -> int | None:
        schema_id = self._ids.get(keys)
        if schema_id is not None:
            # Keys equal to a schema's can still be str subclasses, which a
            # decoded row would turn into plain strings.
            if all(map(operator.is_, keys, self._keys[schema_id])) or _all_exact_str(
                keys
            ):
                return schema_id
            return None
        if not _all_exact_str(keys):
            return None
        with self._lock:
            schema_id = self._ids.get(keys)
            if schema_id is None:
                if len(self._keys) >= self._MAX_SCHEMAS:
                    return None
                schema_id = len(self._keys)
                self._keys.append(keys)
                self._ids[keys] = schema_id
            return schema_id

    def keys(self, schema_id: int) -> tuple[str, ...]:
        return self._keys[schema_id]


_KEY_SCHEMAS = _KeySchemas()


def _is_row(values: tuple[Any, ...]) -> bool:
    """Whether no value can refer back to the dict holding `values`, so the
    dict can be rebuilt from them."""
    for value in values:
        cls = type(value)
        if cls in _ROW_ATOM_TYPES:
            continue
        if cls is list or cls is tuple:
            for item in value:
                if type(item) not in _ROW_ATOM_TYPES:
                    return False
            continue
        if cls is np.ndarray and not value.dtype.hasobject:
            continue
        if isinstance(value, np.generic):
            continue
        return False
    return True


def _encode_dict(value: dict[Any, Any]) -> bytes:
    keys = tuple(value)
    values = tuple(value.values())
    schema_id = _KEY_SCHEMAS.id_of(keys) if _is_row(values) else None
    if schema_id is None:
        return _dump(bytes((_PICKLED,)), value)
    header = bytes((_ROW,)) + schema_id.to_bytes(_ROW_SCHEMA_ID_SIZE, "little")
    return _dump(header, values)


def encode_value(value: Any) -> bytes | None:
    """The encoding the engine holds for a declared value, or `None` to hold the
    object itself."""
    cls = type(value)
    if cls in _SCALAR_TYPES:
        return None
    try:
        if cls is dict:
            data = _encode_dict(value)
        else:
            data = _dump(bytes((_PICKLED,)), value)
    except Exception:
        # Not plain data (or not picklable at all): hold the object.
        return None
    if len(data) > _MAX_ENCODED_SIZE:
        return None
    return data


def decode_value(data: bytes) -> Any:
    """A new object equal to the value `data` encodes."""
    view = memoryview(data)
    if view[0] == _ROW:
        body_start = 1 + _ROW_SCHEMA_ID_SIZE
        keys = _KEY_SCHEMAS.keys(int.from_bytes(view[1:body_start], "little"))
        return dict(zip(keys, pickle.loads(view[body_start:])))
    return pickle.loads(view[1:])


class _ActionPickler(_Pickler):
    """Pickles an action, writing the declared value it holds as a reference to
    that value's encoding."""

    def __init__(self, file: io.BytesIO, desired: Any) -> None:
        super().__init__(file, _PROTOCOL)
        self._desired = desired
        self.refers_to_value = False

    def persistent_id(self, obj: Any) -> Any:
        if obj is self._desired:
            self.refers_to_value = True
            return 0
        return None


def encode_action(action: Any, desired: Any) -> tuple[bytes, bool] | None:
    """The encoding the engine holds for an action `reconcile()` built for the
    declared value `desired` (held encoded), or `None` to hold the action object
    itself.

    The flag says whether the encoding refers to the value's encoding, which
    the engine then keeps alive with it and passes to `decode_action`.
    """
    buf = io.BytesIO()
    pickler = _ActionPickler(buf, desired)
    try:
        pickler.dump(action)
    except Exception:
        return None
    data = buf.getvalue()
    if len(data) > _MAX_ENCODED_SIZE:
        return None
    return data, pickler.refers_to_value


_NOT_DECODED = object()


class _ActionUnpickler(pickle.Unpickler):
    def __init
```

### Core Architecture Module: `python/cocoindex/connectorkits/statediff.py`
```
"""Utilities for computing tracking record diffs for connector outputs.

This module provides small, opinionated helpers that decide what write action to
take ("insert", "upsert", "replace", "delete") by comparing:

These inputs are bundled in `StateTransition[T]`:

- **desired**: the tracking record we want to exist now
- **prev**: previously observed tracking record(s) for the same identity
- **prev_may_be_missing**: whether `prev` is potentially missing

The distinction between "replace" and "upsert" is:

- **replace**: observed tracking record differs from desired, so we must overwrite to make
  it match.
- **upsert**: observed tracking record matches desired (or no prev), but prev might be
  missing so we still write to ensure eventual convergence.
"""

from __future__ import annotations

__all__ = [
    "CompositeTrackingRecord",
    "DiffAction",
    "ManagedBy",
    "MutualTrackingRecord",
    "TrackingRecordTransition",
    "diff",
    "diff_composite",
    "resolve_system_transition",
]

import dataclasses as _dataclasses
from typing import (
    Collection as _Collection,
    Generic as _Generic,
    Hashable as _Hashable,
    Literal as _Literal,
    NamedTuple as _NamedTuple,
)
from typing_extensions import TypeVar as _TypeVar

import msgspec as _msgspec

import cocoindex as _coco

_TrackingRecordT = _TypeVar("_TrackingRecordT")
_MainTrackingRecordT = _TypeVar("_MainTrackingRecordT")
_SubKeyT = _TypeVar("_SubKeyT", bound=_Hashable)
_SubTrackingRecordT = _TypeVar("_SubTrackingRecordT")

DiffAction = _Literal["insert", "upsert", "replace", "delete"]


class CompositeTrackingRecord(
    _msgspec.Struct,
    _Generic[_MainTrackingRecordT, _SubKeyT, _SubTrackingRecordT],
    frozen=True,
    array_like=True,
):
    """A state with a main component and a set of keyed sub-states.

    This is useful when a single identity produces:

    - a **main** record (single state), and
    - multiple **sub** records keyed by some hashable `SubKeyT`.

    `diff_composite()` computes the main action plus grouped sub-state diffs.
    """

    main: _MainTrackingRecordT
    sub: dict[_SubKeyT, _SubTrackingRecordT]


@_dataclasses.dataclass(slots=True)
class _GroupedStates(_Generic[_SubKeyT, _SubTrackingRecordT]):
    """Internal mutable accumulator used by `diff_composite()`."""

    desired: _SubTrackingRecordT | _coco.NonExistenceType = _dataclasses.field(
        default=_coco.NON_EXISTENCE
    )
    prev: list[_SubTrackingRecordT] = _dataclasses.field(default_factory=list)


class TrackingRecordTransition(_Generic[_TrackingRecordT], _NamedTuple):
    """A bundle of desired vs previously observed state, with completeness info.

    `diff()` takes a `TrackingRecordTransition[T]` and returns the action needed to make
    state converge to `desired` (given the observed `prev` and whether it might
    be incomplete).
    """

    desired: _TrackingRecordT | _coco.NonExistenceType
    prev: _Collection[_TrackingRecordT]
    prev_may_be_missing: bool


from cocoindex.connectorkits.target import ManagedBy as ManagedBy


class MutualTrackingRecord(
    _msgspec.Struct, _Generic[_TrackingRecordT], frozen=True, array_like=True
):
    """A tracking record tagged with ownership/management information.

    This is useful when a resource can be managed by either the system
    (CocoIndex-controlled) or the user (externally controlled).
    """

    tracking_record: _TrackingRecordT
    managed_by: ManagedBy


def resolve_system_transition(
    t: TrackingRecordTransition[MutualTrackingRecord[_TrackingRecordT]], /
) -> TrackingRecordTransition[_TrackingRecordT] | None:
    """Resolve a transition to the system-managed subset, or return None.

    Rules:
        - If desired is user-managed: return None.
        - If desired is NON_EXISTENCE and (no prev, or any prev is user-managed): return None.
        - Otherwise: return a `StateTransition[TrackingRecordT]` where:
          - desired is `desired.state` (or NON_EXISTENCE)
          - prev keeps only system-managed states
          - prev_may_be_missing is preserved from input
    """

    if not _coco.is_non_existence(t.desired) and t.desired.managed_by == "user":
        return None

    if _coco.is_non_existence(t.desired):
        if len(t.prev) == 0:
            return None
        if any(p.managed_by == "user" for p in t.prev):
            return None
        return TrackingRecordTransition(
            desired=_coco.NON_EXISTENCE,
            prev=[p.tracking_record for p in t.prev if p.managed_by == "system"],
            prev_may_be_missing=t.prev_may_be_missing,
        )

    return TrackingRecordTransition(
        desired=t.desired.tracking_record,
        prev=[p.tracking_record for p in t.prev if p.managed_by == "system"],
        prev_may_be_missing=t.prev_may_be_missing,
    )


def diff(t: TrackingRecordTransition[_TrackingRecordT] | None, /) -> DiffAction | None:
    """Determine the write action needed to make state converge.

    Args:
        t: The desired/previous state bundle. Use `coco.NON_EXISTENCE` for
            `t.desired` to indicate the state should not exist.

            If `t.prev_may_be_missing` is true, `t.prev` may be incomplete; in
            that case we may return "insert"/"upsert" even when `t.desired`
            matches known values, to ensure eventual convergence.

    Returns:
        One of:
        - "delete": `t.desired` is NON_EXISTENCE and we observed any previous state
        - "replace": at least one observed previous state differs from `t.desired`
        - "insert": no prev observed, prev may be missing, and `t.desired` exists
        - "upsert": `t.desired` matches observed prev, but prev may be missing
        - None: no action needed (already converged and prev not missing)
    """

    if t is None:
        return None

    if _coco.is_non_existence(t.desired):
        if len(t.prev) == 0:
            return None
        return "delete"

    if any(p != t.desired for p in t.prev):
        return "replace"

    if not t.prev_may_be_missing:
        return None

    if len(t.prev) == 0:
        return "insert"

    return "upsert"


def diff_composite(
    t: TrackingRecordTransition[
        CompositeTrackingRecord[_TrackingRecordT, _SubKeyT, _SubTrackingRecordT]
    ]
    | None,
    /,
) -> tuple[
    DiffAction | None,
    dict[_SubKeyT, TrackingRecordTransition[_SubTrackingRecordT]],
]:
    """Compute a diff for a composite state and group sub-state transitions.

    Args:
        t: A `StateTransition` whose desired/prev values are `CompositeState`.

    Returns:
        A pair of:
        - the main diff action (via `diff()` on the `.main` field), and
        - a mapping from each observed or desired `sub_key` to a
          `StateTransition[SubStateT]` for that key.

    Notes:
        If the main action is "replace" or "delete", we treat sub-state
        observations as potentially missing because a main-level rewrite can
        imply sub-state churn.
    """

    if t is None:
        return (None, {})

    if _coco.is_non_existence(t.desired):
        if len(t.prev) == 0:
            return (None, {})
        return ("delete", {})

    main_action = diff(
        TrackingRecordTransition(
            t.desired.main, [p.main for p in t.prev], t.prev_may_be_missing
        )
    )

    sub_prev_may_be_missing = t.prev_may_be_missing or (
        main_action is not None and main_action in ("replace", "delete")
    )

    grouped_states: dict[_SubKeyT, _GroupedStates[_SubKeyT, _SubTrackingRecordT]] = {}
    for p in t.prev:
        for sub_key, sub_state in p.sub.items():
            grouped_states.setdefault(sub_key, _GroupedStates()).prev.append(sub_state)
    for sub_key, desired_state in t.desired.sub.items():
        grouped_states.setdefault(sub_key, _GroupedStates()).desired = desired_state

    groups = {
        k: TrackingRecordTransition(
            desired=grouped_state.desired,
            prev=grouped_state.prev,
            prev_may_be_missing=(
                sub_prev_may_be_missing or len(grouped_state.prev) < len(t.prev)
            ),
        )
        for k, grouped_state in grouped_states.items()
    }
    return (main_action, groups)

```

### Core Architecture Module: `python/cocoindex/engine_object.py`
```
"""
Utilities to dump/load objects (for configs, specs).
"""

from __future__ import annotations

import datetime
import base64
from enum import Enum
from typing import Any


def _is_namedtuple_type(t: type) -> bool:
    return isinstance(t, type) and issubclass(t, tuple) and hasattr(t, "_fields")


def dump_engine_object(v: Any, *, bytes_to_base64: bool = False) -> Any:
    """Recursively dump an object for engine. Engine side uses `Pythonized` to catch."""
    if v is None:
        return None
    elif isinstance(v, (str, int, float, bool)):
        return v
    elif isinstance(v, Enum):
        return v.value
    elif isinstance(v, datetime.timedelta):
        total_secs = v.total_seconds()
        secs = int(total_secs)
        nanos = int((total_secs - secs) * 1e9)
        return {"secs": secs, "nanos": nanos}
    elif _is_namedtuple_type(type(v)):
        # Handle NamedTuple objects specifically to use dict format
        field_names = list(getattr(type(v), "_fields", ()))
        result = {}
        for name in field_names:
            val = getattr(v, name)
            result[name] = dump_engine_object(
                val, bytes_to_base64=bytes_to_base64
            )  # Include all values, including None
        if hasattr(v, "kind") and "kind" not in result:
            result["kind"] = v.kind
        return result
    elif hasattr(v, "__dict__"):  # for dataclass-like objects
        s = {}
        for k, val in v.__dict__.items():
            if val is None:
                # Skip None values
                continue
            s[k] = dump_engine_object(val, bytes_to_base64=bytes_to_base64)
        if hasattr(v, "kind") and "kind" not in s:
            s["kind"] = v.kind
        return s
    elif isinstance(v, (list, tuple)):
        return [dump_engine_object(item) for item in v]
    elif isinstance(v, dict):
        return {k: dump_engine_object(v) for k, v in v.items()}
    return str(v)

```

### Core Architecture Module: `rust/code_ast/src/elements/hooks.rs`
```
//! The `LanguageHooks` trait: per-language procedural logic.

use crate::elements::types::DeclarationKind;

// ── LanguageHooks trait ────────────────────────────────────────────────────

/// Language-specific logic for namespace tracking, `has_body` determination,
/// and path-expression rendering.
pub trait LanguageHooks: Send + Sync {
    /// Separator used to join entity name components and namespace stack components.
    /// `"."` for C#, Python, Java, JS/TS/Go; `"::"` for C++, Rust.
    fn separator(&self) -> &str;

    /// Return initial namespace stack components before traversal.
    fn get_initial_namespace(
        &self,
        root: &tree_sitter::Node,
        source: &[u8],
        base_namespace: Option<&str>,
    ) -> Vec<String>;

    /// Render the name node of a block-scoped namespace declaration to a single string component.
    fn extract_namespace_name(&self, name_node: &tree_sitter::Node, source: &[u8]) -> String;

    /// Extract the simple (unqualified) name of a declaration node.
    ///
    /// The default reads the `name_field` named child as text, which is correct for grammars
    /// that expose the name directly (C#, Python, Java, JS/TS, Go, Rust, Swift, …). Languages
    /// whose name is nested behind another node (e.g. C/C++ `function_definition`, whose name
    /// lives inside a `function_declarator`) override this.
    fn extract_declaration_name(
        &self,
        node: &tree_sitter::Node,
        name_field: &str,
        source: &[u8],
    ) -> String {
        node.child_by_field_name(name_field)
            .and_then(|n| n.utf8_text(source).ok())
            .unwrap_or("")
            .to_string()
    }

    /// Extract every name bound by a leaf value declaration (`field` / `variable` / `constant`),
    /// each with its own byte span. Used by the engine to emit one declaration per name — a
    /// single `field_declaration` like `int x, y;` binds two names. The default returns the one
    /// name from [`Self::extract_declaration_name`] spanning the whole node; languages with
    /// multi-declarator fields (C/C++/C#/Go/Java/Objective-C) override it.
    fn extract_declaration_names(
        &self,
        node: &tree_sitter::Node,
        name_field: &str,
        source: &[u8],
    ) -> Vec<(String, usize, usize)> {
        vec![(
            self.extract_declaration_name(node, name_field, source),
            node.start_byte(),
            node.end_byte(),
        )]
    }

    /// Refine the normalized [`DeclarationKind`] for grammars where one AST node type covers
    /// several kinds — e.g. Go `type_spec` (struct / interface / type_alias) or Swift and
    /// Kotlin `class_declaration` (class / struct / enum / interface / extension). The default
    /// returns the config-supplied `static_kind` unchanged; engine-level member-promotion
    /// (`function` → `method`) is applied afterward and is not the hook's concern.
    fn refine_declaration_kind(
        &self,
        _node: &tree_sitter::Node,
        static_kind: DeclarationKind,
        _source: &[u8],
    ) -> DeclarationKind {
        static_kind
    }

    /// Determine `has_body` for a declaration node given the optional body field name.
    ///
    /// The default is "a body exists iff the configured `body_field` child is present", which
    /// holds for grammars that expose the body as a named field (C#, Java, JS/TS, Go, Rust,
    /// Swift, C/C++). Languages whose body is a positional child (Kotlin) or whose body may be
    /// present-but-empty (Python stubs) override this.
    fn check_has_body(
        &self,
        node: &tree_sitter::Node,
        body_field: Option<&str>,
        _source: &[u8],
    ) -> bool {
        body_field.is_some_and(|f| node.child_by_field_name(f).is_some())
    }

    /// Extract `(referenced_full_path, referenced_base_name)` from a path-expression node.
    /// Returns `None` if the node represents a built-in type that should be unconditionally
    /// excluded (e.g. C# `predefined_type`).
    fn extract_path(
        &self,
        path_node: &tree_sitter::Node,
        source: &[u8],
    ) -> Option<(String, String)>;

    /// Return type references embedded in a declaration node (e.g. Python base classes).
    ///
    /// Each element: `(full_path, base_name, ast_node_kind, start_byte, end_byte)`.
    /// Default implementation returns an empty vec (no extra refs).
    fn extract_declaration_type_refs(
        &self,
        _decl_node: &tree_sitter::Node,
        _source: &[u8],
    ) -> Vec<(String, String, String, usize, usize)> {
        vec![]
    }
}

```

### Core Architecture Module: `rust/code_ast/src/view/render.rs`
```
//! Rendering source ranges into a [`SourceView`]: context frames of the ranges'
//! envelope, each range verbatim, and cues where material is omitted — the
//! render path for code-match results. Spec: `specs/source_view/spec.md`
//! §Match rendering.

use crate::CodeSource;
use crate::positions::TextRange;

use super::frames::context_frames;
use super::{RawSeg, RawView, SegmentKind, SourceView, finalize};

/// Rendered cues (structural chunking spec §Rendered cues — one convention for
/// chunker output and rendered matches). `GAP_MARKER` is an elision line where
/// whole lines are omitted; `CONT_PREFIX` marks content resuming mid-line.
/// Cues render as zero-length Frame segments, so Content-only citation
/// envelopes are unaffected.
pub const GAP_MARKER: &str = "...\n";
pub const CONT_PREFIX: &str = "... ";
/// Cap on a gap marker's indentation (mirrors the following content's line).
pub const MARKER_INDENT_MAX_BYTES: usize = 12;

/// Whether `pos` sits mid-line: preceded on its source line by non-whitespace.
fn is_mid_line(src: &str, pos: usize) -> bool {
    let line_start = src[..pos].rfind('\n').map_or(0, |i| i + 1);
    !src[line_start..pos].trim_start().is_empty()
}

/// Leading whitespace of the line containing `pos` (up to `pos`), capped at
/// `MARKER_INDENT_MAX_BYTES` on a char boundary.
fn line_indent(src: &str, pos: usize) -> &str {
    let line_start = src[..pos].rfind('\n').map_or(0, |i| i + 1);
    let line = &src[line_start..pos];
    let ws_len = line.len() - line.trim_start().len();
    let mut end = ws_len.min(MARKER_INDENT_MAX_BYTES);
    while end > 0 && !line.is_char_boundary(end) {
        end -= 1;
    }
    &line[..end]
}

/// A zero-length Frame segment at `pos` whose `summary` renders `text`.
fn cue(pos: usize, text: String) -> RawSeg {
    RawSeg {
        range: TextRange::new(pos, pos),
        kind: SegmentKind::Frame,
        summary: Some(text),
    }
}

/// The cue between two consecutive rendered ranges (spec §Match rendering):
///
/// - whitespace-only omission (ranges on consecutive lines): not an elision —
///   the cue carries the omitted whitespace verbatim as glue, so lines don't
///   fuse and no `...` implies code that isn't there;
/// - the next range resumes at a line start: a `GAP_MARKER` elision line,
///   indented like that line (plus a newline of glue when the previous range
///   ended mid-line);
/// - the next range resumes mid-line: an inline `CONT_PREFIX` (separated from
///   a non-whitespace previous end by one space): `foo( ... )`.
fn between_cue(src: &str, prev_end: usize, next_start: usize) -> RawSeg {
    let omitted = &src[prev_end..next_start];
    let summary = if omitted.trim().is_empty() {
        omitted.to_string()
    } else if is_mid_line(src, next_start) {
        let sep = match src[..prev_end].chars().next_back() {
            Some(c) if !c.is_whitespace() => " ",
            _ => "",
        };
        format!("{sep}{CONT_PREFIX}")
    } else {
        let nl = if src[..prev_end].ends_with('\n') {
            ""
        } else {
            "\n"
        };
        let indent = line_indent(src, next_start);
        format!("{nl}{indent}{GAP_MARKER}")
    };
    cue(next_start, summary)
}

/// Render source ranges (e.g. a code match's chunks) into a [`SourceView`]:
/// context frames of the ranges' envelope, then each range verbatim, with
/// cues where material is omitted.
///
/// The ranges are rendered **exactly** — no whitespace trims and no widening
/// to line starts (a terminal renderer that wants whole-line display can widen
/// using the segment positions and the original source). Ranges are clamped to
/// the source, empty ranges dropped, and the rest rendered in source order;
/// no ranges leaves an empty view. The view's `start`/`end` (Content envelope)
/// equal the ranges' envelope — the citation span.
pub fn render_ranges(source: &CodeSource<'_>, ranges: &[TextRange]) -> SourceView {
    let src = source.text();
    let mut clean: Vec<TextRange> = ranges
        .iter()
        .map(|r| TextRange::new(r.start.min(src.len()), r.end.min(src.len())))
        .filter(|r| r.start < r.end)
        .collect();
    clean.sort_by_key(|r| r.start);
    let Some(&first) = clean.first() else {
        return SourceView {
            text: String::new(),
            segments: Vec::new(),
        };
    };
    let envelope = TextRange::new(first.start, clean.last().unwrap().end);
    let frames = context_frames(source, envelope);

    let mut segs: Vec<RawSeg> = Vec::new();
    for frame in &frames {
        let raw = &src[frame.line.start..frame.line.end];
        segs.push(RawSeg {
            range: frame.line,
            kind: SegmentKind::Frame,
            summary: (raw != frame.rendered).then(|| frame.rendered.clone()),
        });
    }
    // Cue between the innermost frame and the first range (spec §Rendered cues):
    // a `CONT_PREFIX` when the range starts mid-line, else a `GAP_MARKER` line
    // when non-whitespace source is omitted between the frame's line and the
    // range's line (blank-line-only separation counts as adjacency).
    if let Some(innermost) = frames.last() {
        if is_mid_line(src, first.start) {
            segs.push(cue(first.start, CONT_PREFIX.to_string()));
        } else {
            let line_start = src[..first.start].rfind('\n').map_or(0, |i| i + 1);
            if line_start >= innermost.line.end
                && !src[innermost.line.end..line_start].trim().is_empty()
            {
                let indent = line_indent(src, first.start);
                segs.push(cue(first.start, format!("{indent}{GAP_MARKER}")));
            }
        }
    }
    let mut prev_end: Option<usize> = None;
    for r in &clean {
        if let Some(pe) = prev_end
            && r.start > pe
        {
            segs.push(between_cue(src, pe, r.start));
        }
        segs.push(RawSeg {
            range: *r,
            kind: SegmentKind::Content,
            summary: None,
        });
        prev_end = Some(r.end.max(prev_end.unwrap_or(0)));
    }
    finalize(src, vec![RawView { segs }])
        .pop()
        .expect("one raw view in, one view out")
}

#[cfg(test)]
mod tests {
    use super::*;

    const PY: &str = "\
class Foo(Base):
    def process(self, req):
        if req.cache_ok:
            value = compute()
            return value

    def other(self):
        return 2
";

    fn range_of(src: &str, needle: &str) -> TextRange {
        let start = src.find(needle).expect("needle in src");
        TextRange::new(start, start + needle.len())
    }

    /// Render and check the segment invariant: `text` is exactly the in-order
    /// concatenation of each segment's rendering, renderings partition `text`,
    /// and source ranges are ascending.
    fn render_checked(source: &CodeSource<'_>, ranges: &[TextRange]) -> SourceView {
        let view = render_ranges(source, ranges);
        let src = source.text();
        let mut cursor = 0usize;
        let mut prev_end = 0usize;
        for seg in &view.segments {
            let rendering = match &seg.summary {
                Some(text) => text.as_str(),
                None => &src[seg.range.start..seg.range.end],
            };
            assert_eq!(seg.text_range.start, cursor, "renderings partition text");
            assert_eq!(
                &view.text[seg.text_range.start..seg.text_range.end],
                rendering
            );
            cursor = seg.text_range.end;
            assert!(seg.range.start >= prev_end, "segment ranges ascending");
            prev_end = seg.range.end.max(prev_end);
        }
        assert_eq!(cursor, view.text.len(), "renderings cover all of text");
        view
    }

    #[test]
    fn single_range_with_frames_and_gap_marker() {
        let source = CodeSource::with_language(PY, "python");
        let view = render_checked(&source, &[range_of(PY, "return value")]);
        // Frames of all enclosing layers, then an elision line for the omitted
        // `value = compute()` line, then the exact matched range.
        assert_eq!(
            view.text,
            "class Foo(Base):\n\
             \x20   def process(self, req):\n\
             \x20       if req.cache_ok:\n\
             \x20           ...\n\
             return value"
        );
        // Citation span (Content-segment envelope) == the match envelope.
        let content: Vec<_> = view
            .segments
            .iter()
            .filter(|s| s.kind == SegmentKind::Content)
            .collect();
        assert_eq!(
            content.first().unwrap().range.start,
            PY.find("return value").unwrap()
        );
        assert_eq!(
            content.last().unwrap().range.end,
            PY.find("return value").unwrap() + "return value".len()
        );
    }

    #[test]
    fn body_adjacent_to_frame_gets_no_gap_marker() {
        let source = CodeSource::with_language(PY, "python");
        let view = render_checked(&source, &[range_of(PY, "value = compute()")]);
        assert_eq!(
            view.text,
            "class Foo(Base):\n\
             \x20   def process(self, req):\n\
             \x20       if req.cache_ok:\n\
             value = compute()"
        );
    }

    #[test]
    fn multi_range_line_elision() {
        // Two ranges with a full line omitted between them.
        let src = "\
def f(x):
    a = 1
    b = 2
    c = 3
";
        let source = CodeSource::with_language(src, "python");
        let view = render_checked(&source, &[range_of(src, "a = 1"), range_of(src, "c = 3")]);
        assert_eq!(view.text, "def f(x):\na = 1\n    ...\nc = 3");
        // The cue is a zero-length Frame segment.
        let cues: Vec<_> = view
            .segments
            .iter()
            .filter(|s| s.kind == SegmentKind::Frame && s.range.start == s.range.end)
            .collect();
        assert_eq!(cues.len(), 1);
        assert_eq!(cues[0].summary.as_deref(), Some("\n    ...\n"));
```

### Core Architecture Module: `rust/core/src/engine/app.rs`
```
use crate::engine::profile::EngineProfile;
use crate::engine::stats::{ProcessingStats, VersionedProcessingStats};
use crate::prelude::*;

use crate::engine::component::Component;
use crate::engine::context::{AppContext, PreviewActionCollector};
use crate::engine::deadline::DeadlineContext;
use crate::engine::live_component::{LIVE_COMPONENT_DRAIN_TIMEOUT_SECS, LiveComponentState};

use crate::engine::environment::{AppRegistration, Environment};
use crate::engine::runtime::get_runtime;
use crate::state::stable_path::StablePath;
use tokio::sync::watch;

/// Options for updating an app.
#[derive(Debug, Clone)]
pub struct AppUpdateOptions {
    /// If true, reprocess everything and invalidate existing caches.
    pub full_reprocess: bool,
    /// If true, enable live component mode for this update.
    pub live: bool,
    /// Deadline for the root processor and for observing the update result.
    pub deadline: DeadlineContext,
}

impl Default for AppUpdateOptions {
    fn default() -> Self {
        Self {
            full_reprocess: false,
            live: false,
            deadline: DeadlineContext::NONE,
        }
    }
}

/// Handle returned by `App::update` or `App::drop_app` that provides access to
/// the running operation's stats and result.
pub struct AppOpHandle<T: Send + 'static> {
    task: tokio::task::JoinHandle<Result<T>>,
    stats: ProcessingStats,
    version_rx: watch::Receiver<u64>,
    /// Whether this is a live-mode operation (affects progress display).
    pub live: bool,
    deadline: DeadlineContext,
}

impl<T: Send + 'static> AppOpHandle<T> {
    /// Returns an atomic (version, stats) snapshot.
    pub fn stats_snapshot(&self) -> VersionedProcessingStats {
        self.stats.snapshot()
    }

    /// Returns the underlying `ProcessingStats` (Arc-based, safe to clone).
    pub fn stats(&self) -> &ProcessingStats {
        &self.stats
    }

    /// Waits for the version to change. Returns the new version.
    /// Returns `TERMINATED_VERSION` when the task completes.
    pub async fn changed(&mut self) -> Result<u64> {
        self.version_rx
            .changed()
            .await
            .map_err(|_| internal_error!("operation task dropped"))?;
        Ok(*self.version_rx.borrow())
    }

    /// Waits until the operation terminates, ignoring intermediate changes.
    /// Unlike `changed()`, this only resolves on termination, so callers that
    /// don't care about every update aren't woken on every version bump.
    pub async fn wait_terminated(&self) {
        self.stats.wait_terminated().await;
    }

    /// Awaits the task completion and returns the result.
    pub async fn result(self) -> Result<T> {
        let result = self
            .task
            .await
            .map_err(|e| internal_error!("operation task panicked: {e}"))?;
        let value = result?;
        self.deadline.check()?;
        Ok(value)
    }
}

pub struct App<Prof: EngineProfile> {
    root_component: Component<Prof>,
}

impl<Prof: EngineProfile> App<Prof> {
    pub async fn new(
        name: &str,
        env: Environment<Prof>,
        max_inflight_components: Option<usize>,
    ) -> Result<Self> {
        let app_reg = AppRegistration::new(name, &env)?;

        // TODO: This database initialization logic should happen lazily on first call to `update()`.
        let app_store = env.create_app_store(name).await?;

        let app_ctx = AppContext::new(env, app_store, app_reg, max_inflight_components);
        let root_component = Component::new(app_ctx, StablePath::root(), None);
        crate::telemetry::track("app_create");
        Ok(Self { root_component })
    }
}

impl<Prof: EngineProfile> App<Prof> {
    /// Starts an update and returns a handle for tracking progress and awaiting the result.
    ///
    /// The update runs as a spawned Tokio task. The handle provides:
    /// - `stats_snapshot()` for polling current stats
    /// - `changed()` for awaiting stats version changes
    /// - `result()` for awaiting the final result
    #[instrument(name = "app.update", skip_all, fields(app_name = %self.app_ctx().app_reg().name()))]
    pub fn update(
        &self,
        root_processor: Prof::ComponentProc,
        options: AppUpdateOptions,
        host_ctx: Arc<Prof::HostCtx>,
        preview_collector: Option<PreviewActionCollector<Prof>>,
    ) -> Result<(
        AppOpHandle<Prof::FunctionData>,
        Option<PreviewActionCollector<Prof>>,
    )> {
        crate::telemetry::track("app_update");
        // Refresh the app token if a prior operation (e.g. drop_app) cancelled
        // it, so this update starts with a non-cancelled token.
        self.app_ctx().reset_cancellation_token_if_cancelled();
        let processing_stats = ProcessingStats::new();
        let version_rx = processing_stats.subscribe();
        let deadline = options.deadline;
        let context = self.root_component.new_processor_context_for_build(
            None,
            processing_stats.clone(),
            options.full_reprocess,
            options.live,
            preview_collector.clone(),
            host_ctx,
            // Root has no installed on_error in Build mode — orphan-delete
            // failures from the root's GC sweep log + swallow. (Cascading
            // a raising on_error from root would equate "any orphan delete
            // failed" with "the whole update failed", which is too strict;
            // tombstones survive for retry on the next reconcile.)
            None,
        )?;

        let root_component = self.root_component.clone();
        let stats_for_task = processing_stats.clone();
        let cancel_token = self.app_ctx().cancellation_token();
        let live = options.live;
        let span = Span::current();
        let task = get_runtime().spawn(
            async move {
                let run_fut = async {
                    root_component
                        .clone()
                        .run(root_processor, context, deadline, DeadlineContext::NONE)
                        .await?
                        .result(None)
                        .await
                };
                let result = tokio::select! {
                    result = run_fut => result,
                    _ = cancel_token.cancelled() => Err(internal_error!("Operation cancelled")),
                };
                stats_for_task.notify_ready();
                if live && result.is_ok() {
                    // In live mode, wait for all descendants to finish before signaling termination.
                    root_component.wait_until_inactive().await;
                }
                stats_for_task.notify_terminated();
                result
            }
            .instrument(span),
        );

        Ok((
            AppOpHandle {
                task,
                stats: processing_stats,
                version_rx,
                live,
                deadline,
            },
            preview_collector,
        ))
    }

    /// Drop the app, reverting all target states and clearing the database.
    ///
    /// Returns an `AppOpHandle<()>` for tracking progress and awaiting completion.
    /// Synchronous setup (cancellation, context construction) happens before the spawn.
    ///
    /// **Live-component drain**: atomically cancels the app token AND snapshots
    /// the live-components registry, then awaits each captured controller's
    /// `cancel_and_await_quiescence` + `live_task` JoinHandle (per-component
    /// 30s timeout, all drains in parallel via `join_all`) before tearing down
    /// shared resources. This prevents leaked drain tasks from writing to
    /// half-closed connection pools after teardown — see
    /// `specs/live_component/design.md` "drop_app" section for the full
    /// contract (it is documentation-only when timeouts fire).
    #[instrument(name = "app.drop", skip_all, fields(app_name = %self.app_ctx().app_reg().name()))]
    pub fn drop_app(&self, host_ctx: Arc<Prof::HostCtx>) -> Result<AppOpHandle<()>> {
        crate::telemetry::track("app_drop");
        // Refresh the app token if a prior operation cancelled it, so the
        // cancel below applies to a token shared with any concurrent update.
        self.app_ctx().reset_cancellation_token_if_cancelled();
        // Atomically cancel the app token AND snapshot the live-components
        // registry under the registry lock. This closes the race where a
        // concurrent mount_live_async could register *after* a separate
        // snapshot but *before* observing a separately-issued cancel.
        // Acquiring the lock first ensures any in-flight register-into-list
        // either happens before our snapshot (caught) or queues behind the
        // lock and sees the cancelled token immediately on first poll once
        // we release.
        let live_snapshot = self.app_ctx().cancel_and_snapshot_live_components();

        let processing_stats = ProcessingStats::default();
        let version_rx = processing_stats.subscribe();
        let providers = self
            .app_ctx()
            .env()
            .target_states_providers()
            .lock()
            .unwrap()
            .providers
            .clone();

        // Install a single on_error handler that always propagates: app.drop
        // is an explicit operation, so root-delete failures (and any
        // descendant failures, via the GC-sweep cascade) must surface to the
        // caller (Python `app.drop()` then raises). Without it, the framework
        // default of "log + swallow" would hide failures behind stale tracking
        // records while pretending app.drop succeeded. The handler is stored
        // in the delete context so the GC sweep can read and cascade it to
        // descendant deletes (see `specs/core/error_handling.md`).
        let raise_on_error: crate::engine::component::OnError =
            Arc::new(|err| Box::pin(async move { Err(err) }));
        let context
```

### Core Architecture Module: `rust/core/src/engine/component.rs`
```
use crate::engine::runtime::get_runtime;
use crate::prelude::*;
use std::collections::{HashMap, HashSet};
use std::pin::Pin;
use std::sync::Weak;

use crate::engine::context::FnCallContext;
use crate::engine::context::{
    AppContext, ComponentDeleteContext, ComponentProcessingAction, ComponentProcessingMode,
    ComponentProcessorContext, MemoStatesPayload, PreviewActionCollector,
};
use crate::engine::deadline::DeadlineContext;
use crate::engine::execution::{
    cleanup_tombstone, eager_existence_upsert, post_submit_for_build, submit,
    update_component_memo_states, use_or_invalidate_component_memoization,
};
use crate::engine::profile::EngineProfile;
use crate::engine::stats::ProcessingStats;
use crate::engine::target_state::{TargetStateProvider, TargetStateProviderRegistry};
use crate::state::stable_path::{StablePath, StablePathRef};
use crate::state::stable_path_set::StablePathSet;
use crate::state::target_state_path::{TargetProviderDeps, TargetStatePath};
use cocoindex_utils::error::{SharedError, SharedResult, SharedResultExt};
use cocoindex_utils::fingerprint::Fingerprint;

/// Async on-error callback for background-style component execution.
///
/// Invoked by `run_in_background` / `delete` when the spawned task fails
/// (other than via cancellation, which is filtered). The callback can
/// either:
///
/// - Return `Ok(())` to swallow the failure (mount-style; the spawned
///   task returns Ok and `handle.ready()` resolves Ok). This is what
///   the Python-side exception handler chain does when at least one
///   handler returns normally.
/// - Return `Err(err)` to propagate the failure (the spawned task
///   returns Err and `handle.ready()` raises). This is what the chain
///   does when every handler re-raises, and what `app.drop()`'s
///   built-in raising handler does to surface root-delete failures.
///
/// Cancellation is never delivered to the handler — it's filtered
/// before this is invoked. The "no chain registered" case logs at
/// ERROR and swallows; only an explicitly-installed handler causes
/// propagation.
pub type OnError = Arc<
    dyn Fn(Error) -> Pin<Box<dyn Future<Output = Result<()>> + Send + 'static>>
        + Send
        + Sync
        + 'static,
>;

#[derive(Debug, Clone)]
pub struct ComponentProcessorInfo {
    pub name: String,
}

impl ComponentProcessorInfo {
    pub fn new(name: String) -> Self {
        Self { name }
    }
}

pub trait ComponentProcessor<Prof: EngineProfile>: Send + Sync + 'static {
    // TODO: Add method to expose function info and arguments, for tracing purpose & no-change detection.

    /// Run the logic to build the component.
    ///
    /// We expect the implementation of this method to spawn the logic to a separate thread or task when needed.
    fn process(
        &self,
        host_runtime_ctx: &Prof::HostRuntimeCtx,
        comp_ctx: &ComponentProcessorContext<Prof>,
    ) -> Result<impl Future<Output = Result<Prof::FunctionData>> + Send + 'static>;

    /// Fingerprint of the memoization key. When matching, re-processing can be skipped.
    /// When None, memoization is not enabled for the component.
    fn memo_key_fingerprint(&self) -> Option<Fingerprint>;

    fn processor_info(&self) -> &ComponentProcessorInfo;

    /// Whether this processor has a memo state handler for post-fingerprint validation.
    fn has_memo_state_handler(&self) -> bool {
        false
    }

    /// Validate or collect memo states after a fingerprint match.
    /// `stored_states`: `Some(payload)` on cache hit, `None` on cache miss (collect initial states).
    /// Returns `(new_states, can_reuse, states_changed)`:
    /// - `can_reuse`: when true, the cached value is valid and can be returned without re-execution.
    /// - `states_changed`: when true, the new states differ from stored states and must be persisted.
    ///   This can be true even when `can_reuse` is true (e.g. mtime changed but content hash unchanged).
    ///
    /// The payload carries both positional (argument-borne) and context-borne memo states.
    /// The core crate treats everything inside as opaque blobs — state functions themselves
    /// live Python-side in the Python profile.
    fn handle_memo_states(
        &self,
        host_runtime_ctx: &Prof::HostRuntimeCtx,
        comp_ctx: &ComponentProcessorContext<Prof>,
        stored_states: Option<MemoStatesPayload<Prof>>,
    ) -> Result<impl Future<Output = Result<(MemoStatesPayload<Prof>, bool, bool)>> + Send + 'static>
    {
        let _ = (host_runtime_ctx, comp_ctx, stored_states);
        Ok(async { Ok((MemoStatesPayload::default(), true, false)) })
    }
}

struct ComponentInner<Prof: EngineProfile> {
    app_ctx: AppContext<Prof>,
    stable_path: StablePath,

    /// Strong reference to the parent component. Keeps the parent (and its
    /// ancestors) alive as long as this child is alive. On Drop, removes
    /// this child's Weak entry from the parent's active_children.
    parent: Option<Component<Prof>>,

    /// Serializes runs of this component. A run holds the permit from before
    /// its body starts until its memo is stored (see `execute_once`), so two
    /// runs never overlap, and the memo one run stores is in place before the
    /// next decides whether to execute its body.
    build_semaphore: tokio::sync::Semaphore,
    /// The memo most recently stored under `build_semaphore`, if any. A run
    /// that finds its own key here on acquiring the permit knows a same-key
    /// run just completed and stored its result, so it re-checks the memo
    /// instead of executing again — under `full_reprocess` only when that run
    /// belonged to the same operation (see `execute_once`).
    last_stored_memo: Mutex<Option<StoredMemo>>,

    /// Identity registry of child components, keyed by their full StablePath,
    /// so a re-mount of a path whose component is still referenced shares the
    /// same `ComponentInner` (and thus its `build_semaphore`). Weak: entries
    /// are removed by the child's Drop impl. This map says nothing about
    /// activity — see `active_ops`.
    ///
    /// `parking_lot::Mutex` (non-poisoning): the Drop impl below acquires this
    /// lock, and a poisoned `std::sync::Mutex` would cascade panics through
    /// every subsequent Drop on the same parent's children map.
    active_children: parking_lot::Mutex<HashMap<StablePath, Weak<ComponentInner<Prof>>>>,

    /// Shared state for a live component running at this path.
    /// `parking_lot::Mutex` (non-poisoning): symmetric with `active_children`,
    /// since cancel/drain paths can lock this from `Drop` as well.
    live_state:
        parking_lot::Mutex<Option<Arc<crate::engine::live_component::LiveComponentState<Prof>>>>,

    /// Number of processing tasks in flight in this component's subtree
    /// (itself and every descendant), maintained by [`ActivityGuard`]. This —
    /// not the reference count of `inner` — is what "active" means: anything
    /// may hold a `Component` or a processor context for as long as it likes
    /// (a host-language exception traceback, a stored handle) without keeping
    /// the component active.
    active_ops: std::sync::atomic::AtomicUsize,
    /// Signaled when `active_ops` drops to zero (see `wait_until_inactive`).
    inactive: tokio::sync::Notify,
}

/// Marks a processing task as in flight on a component for the guard's
/// lifetime. A task's entry point creates it before spawning the task and drops
/// it when the task ends — on every exit path, including cancellation and
/// panics — so activity is accounted for deterministically, independent of who
/// else holds the component.
///
/// Counts on the component and each of its ancestors, so a component is active
/// while anything in its subtree runs (`wait_until_inactive`, [`StatsGroup`]
/// member liveness).
pub(crate) struct ActivityGuard<Prof: EngineProfile> {
    component: Component<Prof>,
}

impl<Prof: EngineProfile> ActivityGuard<Prof> {
    pub(crate) fn new(component: Component<Prof>) -> Self {
        for inner in component.self_and_ancestors() {
            inner
                .active_ops
                .fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        }
        Self { component }
    }
}

/// What a processing task holds from its entry point until it ends
/// (see [`Component::start_task`]).
struct StartedTask<Prof: EngineProfile> {
    /// Keeps the component and its ancestors active; the task drops it right
    /// before resolving child readiness.
    activity: ActivityGuard<Prof>,
    /// Registration with the parent's readiness accumulator; `None` for the root.
    child_readiness: Option<ComponentBgChildReadinessChildGuard>,
}

impl<Prof: EngineProfile> Drop for ActivityGuard<Prof> {
    fn drop(&mut self) {
        for inner in self.component.self_and_ancestors() {
            if inner
                .active_ops
                .fetch_sub(1, std::sync::atomic::Ordering::SeqCst)
                == 1
            {
                inner.inactive.notify_waiters();
            }
        }
    }
}

impl<Prof: EngineProfile> Drop for ComponentInner<Prof> {
    fn drop(&mut self) {
        if let Some(parent) = &self.parent {
            // Identity check: only remove our own entry. A previous
            // `get_child(stable_path)` may have observed our `Weak` failing to
            // upgrade (strong_count hit zero) and inserted a *new* `Weak` at
            // the same key BEFORE this Drop ran. Removing by key alone would
            // erroneously delete the new entry. Compare the stored Weak's
            // pointer against `self` to remove only if the slot still
            // identifies us.
            let mut children = parent.inner.active_children.lock();
            if let Some(weak) = children.get(&self.stable_path)
                && std::ptr::eq(weak.as_ptr(), self as *const ComponentInner<Prof>)
            {
                children.remove(&self.stable_path);
            }
        }
```

### Core Architecture Module: `rust/core/src/engine/context.rs`
```
use std::collections::{BTreeMap, HashMap, HashSet};

use cocoindex_utils::fingerprint::Fingerprint;

use crate::engine::component::{Component, ComponentBgChildReadiness, StatsGroup};
use crate::engine::deadline::DeadlineContext;
use crate::engine::id_sequencer::IdSequencerManager;
use crate::engine::profile::EngineProfile;
use crate::engine::stats::ProcessingStats;
use crate::engine::target_state::{TargetStateProvider, TargetStateProviderRegistry};
use crate::prelude::*;

use crate::state::stable_path::StableKey;

pub(crate) static TARGET_ID_KEY: LazyLock<StableKey> =
    LazyLock::new(|| StableKey::Symbol("cocoindex/_internal/target_id".into()));
use crate::state::stable_path_set::ChildStablePathSet;
use crate::state::target_state_path::{
    TargetProviderDeps, TargetStatePath, TargetStateProviderGeneration,
};
use crate::{
    engine::environment::{AppRegistration, Environment},
    state::stable_path::StablePath,
    state_store::AppStore,
};

use cocoindex_utils::deser::from_msgpack_slice;

use crate::engine::execution::{
    deserialize_context_memo_states, deserialize_memo_values, serialize_context_memo_states,
    serialize_memo_values,
};
use crate::engine::profile::Persist;

struct AppContextInner<Prof: EngineProfile> {
    env: Environment<Prof>,
    app_store: AppStore,
    app_reg: AppRegistration<Prof>,
    id_sequencer_manager: IdSequencerManager,
    inflight_semaphore: Option<Arc<tokio::sync::Semaphore>>,
    /// Source of operation generations; see
    /// [`ComponentProcessorContext::operation_generation`].
    operation_generation: std::sync::atomic::AtomicU64,
    /// Cancellation token for in-flight app operations. Wrapped in a `Mutex` so
    /// it can be replaced with a fresh child of the global token after a
    /// previous cancellation (e.g. after `App::drop_app` finishes), allowing
    /// the same `App` instance to be reused for subsequent operations.
    cancellation_token: std::sync::Mutex<tokio_util::sync::CancellationToken>,

    /// Flat registry of all live components mounted under this app.
    /// `mount_live_async` registers (compacts then pushes) before returning;
    /// `App::drop_app` walks this at shutdown to drain each.
    /// Stores `Weak` so a freed `LiveComponentState` is naturally collected
    /// on the next compaction.
    /// Compaction-on-push: callers call `register_live_component` which removes
    /// dead entries before appending — bounding registry size by live count
    /// plus pending GC.
    live_components: parking_lot::Mutex<
        Vec<std::sync::Weak<crate::engine::live_component::LiveComponentState<Prof>>>,
    >,
}

#[derive(Clone)]
pub struct AppContext<Prof: EngineProfile> {
    inner: Arc<AppContextInner<Prof>>,
}

impl<Prof: EngineProfile> AppContext<Prof> {
    pub fn new(
        env: Environment<Prof>,
        app_store: AppStore,
        app_reg: AppRegistration<Prof>,
        max_inflight_components: Option<usize>,
    ) -> Self {
        let inflight_semaphore =
            max_inflight_components.map(|n| Arc::new(tokio::sync::Semaphore::new(n)));
        Self {
            inner: Arc::new(AppContextInner {
                env,
                app_store,
                app_reg,
                id_sequencer_manager: IdSequencerManager::new(),
                inflight_semaphore,
                operation_generation: std::sync::atomic::AtomicU64::new(0),
                cancellation_token: std::sync::Mutex::new(
                    crate::engine::runtime::global_cancellation_token().child_token(),
                ),
                live_components: parking_lot::Mutex::new(Vec::new()),
            }),
        }
    }

    /// Register a live component for shutdown drain coverage.
    ///
    /// Compacts dead `Weak`s out of the registry before appending the new one,
    /// so size is bounded by live + pending-GC count. The `Weak` is upgraded
    /// during `App::drop_app`'s walk to drive `cancel_and_await_quiescence`.
    pub fn register_live_component(
        &self,
        weak: std::sync::Weak<crate::engine::live_component::LiveComponentState<Prof>>,
    ) {
        let mut registry = self.inner.live_components.lock();
        registry.retain(|w| w.upgrade().is_some());
        registry.push(weak);
    }

    /// Atomically: cancel the app token AND snapshot the live-components
    /// registry into upgraded `Arc`s. Returns the snapshot.
    ///
    /// Acquiring the lock first closes a race: a concurrent
    /// `mount_live_async` mid-execution that captured an uncancelled
    /// parent_ctx token will either (a) finish registering before this lock
    /// acquisition (caught by the snapshot) or (b) queue behind the lock and
    /// see the cancelled token immediately on first poll once we release.
    pub fn cancel_and_snapshot_live_components(
        &self,
    ) -> Vec<Arc<crate::engine::live_component::LiveComponentState<Prof>>> {
        let registry = self.inner.live_components.lock();
        // Cancel inside the lock so a post-release registration sees the
        // cancelled token.
        self.inner.cancellation_token.lock().unwrap().cancel();
        registry
            .iter()
            .filter_map(std::sync::Weak::upgrade)
            .collect()
    }

    pub fn env(&self) -> &Environment<Prof> {
        &self.inner.env
    }

    pub fn app_store(&self) -> &AppStore {
        &self.inner.app_store
    }

    pub fn app_reg(&self) -> &AppRegistration<Prof> {
        &self.inner.app_reg
    }

    pub fn inflight_semaphore(&self) -> Option<&Arc<tokio::sync::Semaphore>> {
        self.inner.inflight_semaphore.as_ref()
    }

    /// Mint the generation of a new operation; see
    /// [`ComponentProcessorContext::operation_generation`].
    fn next_operation_generation(&self) -> u64 {
        self.inner
            .operation_generation
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed)
            + 1
    }

    /// Returns a clone of the current app-level cancellation token.
    ///
    /// The clone stays valid even if the slot is later refreshed via
    /// `reset_cancellation_token_if_cancelled`.
    pub fn cancellation_token(&self) -> tokio_util::sync::CancellationToken {
        self.inner.cancellation_token.lock().unwrap().clone()
    }

    /// Replace the app-level cancellation token with a fresh child of the global
    /// token if the current one has been cancelled. Call this before starting a
    /// new app operation so a prior cancellation (e.g. via `drop_app`) does not
    /// poison subsequent runs.
    pub fn reset_cancellation_token_if_cancelled(&self) {
        let mut slot = self.inner.cancellation_token.lock().unwrap();
        if slot.is_cancelled() {
            *slot = crate::engine::runtime::global_cancellation_token().child_token();
        }
    }

    /// Get the next ID for the given key.
    ///
    /// IDs are allocated in batches for efficiency. The key can be `None` for a default sequencer.
    pub async fn next_id(&self, key: Option<&StableKey>, deadline: DeadlineContext) -> Result<u64> {
        deadline.check()?;
        let default_key = StableKey::Null;
        let key = key.unwrap_or(&default_key);
        self.inner
            .id_sequencer_manager
            .next_id(self.inner.env.storage(), &self.inner.app_store, key)
            .await
    }
}

pub(crate) struct DeclaredTargetState<Prof: EngineProfile> {
    pub provider: TargetStateProvider<Prof>,
    /// The item key, `storekey`-encoded: the form pre-commit records it in,
    /// at a fraction of the size of the decoded key's tree of `Arc`s.
    pub item_key_bytes: Box<[u8]>,
    pub value: Prof::TargetStateValue,
    pub child_provider: Option<TargetStateProvider<Prof>>,
}

pub(crate) struct ComponentTargetStatesContext<Prof: EngineProfile> {
    pub declared_target_states: BTreeMap<TargetStatePath, DeclaredTargetState<Prof>>,
    pub provider_registry: TargetStateProviderRegistry<Prof>,
}

pub struct FnCallMemo<Prof: EngineProfile> {
    pub ret: Prof::FunctionData,
    pub(crate) target_state_paths: Vec<TargetStatePath>,
    pub(crate) target_provider_deps: TargetProviderDeps,
    pub(crate) dependency_memo_entries: HashSet<Fingerprint>,
    pub(crate) logic_deps: HashSet<Fingerprint>,
    pub memo_states: Vec<Prof::FunctionData>,
    /// Context-borne memo states, keyed by tracked-context value fingerprint.
    /// See `db_schema::FunctionMemoizationEntry::context_memo_states`.
    pub context_memo_states: Vec<(Fingerprint, Vec<Prof::FunctionData>)>,
    pub(crate) already_stored: bool,
}

/// Combined payload of positional and context-borne memo states.
///
/// Used to thread both halves through the `ComponentProcessor::handle_memo_states`
/// callback and through function-level memoization APIs. The core crate treats
/// the context fingerprints and values as opaque data — both come from Python in
/// the Python profile and are round-tripped through the Python state handler.
pub struct MemoStatesPayload<Prof: EngineProfile> {
    pub positional: Vec<Prof::FunctionData>,
    pub by_context_fp: Vec<(Fingerprint, Vec<Prof::FunctionData>)>,
}

impl<Prof: EngineProfile> Default for MemoStatesPayload<Prof> {
    fn default() -> Self {
        Self {
            positional: Vec::new(),
            by_context_fp: Vec::new(),
        }
    }
}

impl<Prof: EngineProfile> MemoStatesPayload<Prof> {
    pub fn is_empty(&self) -> bool {
        self.positional.is_empty() && self.by_context_fp.is_empty()
    }
}

pub enum FnCallMemoEntry<Prof: EngineProfile> {
    /// Prefetched from the database but not yet accessed during this build.
    /// Lazily decoded on first access (transitions to `Ready` or stays
    /// `Stored` for later GC). Treated as untouched at flush time.
    Stored(Vec<u8>),
    /// Memoization result is pending, i.e. the function call is not finished yet.
    Pending,
    /// Memoization result is ready. None means memoization is disabled, e.g. it mounts child components.
    Ready(Option<F
```

### Core Architecture Module: `rust/core/src/engine/deadline.rs`
```
//! Cooperative deadline state shared by all SDKs.
//!
//! [`DeadlineContext`] is intentionally just an immutable, copyable handle:
//! an absolute monotonic [`Instant`], or [`DeadlineContext::NONE`]. Lexical
//! scoping belongs in SDK carriers (`ContextVar`, task-local context,
//! `AsyncLocalStorage`, etc.); the core only receives and checks the value
//! at engine checkpoints — it is never stored on engine contexts.
//!
//! Tests use a process-global virtual clock. Conformance tests that advance
//! this clock must run sequentially because every handle observes the same
//! clock.

use std::sync::{
    OnceLock,
    atomic::{AtomicBool, AtomicU64, Ordering},
};
use std::time::{Duration, Instant};

use crate::prelude::*;

static MONOTONIC_ANCHOR: OnceLock<Instant> = OnceLock::new();
static TEST_OFFSET_NS: AtomicU64 = AtomicU64::new(0);
static TEST_CLOCK_ENABLED: AtomicBool = AtomicBool::new(false);
#[cfg(test)]
static TEST_CLOCK_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

/// Immutable deadline handle carried through engine calls.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash)]
pub struct DeadlineContext(Option<Instant>);

impl DeadlineContext {
    /// No active deadline.
    pub const NONE: Self = Self(None);

    pub const fn has_deadline(self) -> bool {
        self.0.is_some()
    }

    /// Return a context with `timeout` applied, preserving the earlier
    /// existing deadline when nested.
    pub fn with_timeout(self, timeout: Duration) -> Self {
        let now = now_instant();
        let deadline = checked_add_saturating(now, timeout);
        Self(Some(match self.0 {
            Some(existing) => existing.min(deadline),
            None => deadline,
        }))
    }

    /// Raise a structured deadline error if this context has expired.
    pub fn check(self) -> Result<()> {
        if self.is_expired() {
            return Err(Error::deadline_exceeded());
        }
        Ok(())
    }

    pub fn remaining(self) -> Option<Duration> {
        self.0
            .map(|deadline| deadline.saturating_duration_since(now_instant()))
    }

    pub fn is_expired(self) -> bool {
        matches!(self.0, Some(deadline) if now_instant() > deadline)
    }
}

fn now_instant() -> Instant {
    let anchor = *MONOTONIC_ANCHOR.get_or_init(Instant::now);
    if TEST_CLOCK_ENABLED.load(Ordering::Relaxed) {
        // Fully virtual in test mode: the anchor plus the test offset, with
        // no real-clock component, so conformance tests are deterministic.
        return checked_add_saturating(
            anchor,
            Duration::from_nanos(TEST_OFFSET_NS.load(Ordering::Relaxed)),
        );
    }
    Instant::now()
}

fn checked_add_saturating(anchor: Instant, duration: Duration) -> Instant {
    if let Some(deadline) = anchor.checked_add(duration) {
        return deadline;
    }

    // `Instant` has platform-dependent range. If the requested duration
    // overflows it, keep halving until we find the farthest representable
    // future instant for this platform instead of panicking.
    let mut fallback = duration;
    loop {
        fallback = Duration::new(fallback.as_secs() / 2, fallback.subsec_nanos() / 2);
        if fallback.is_zero() {
            return anchor;
        }
        if let Some(deadline) = anchor.checked_add(fallback) {
            return deadline;
        }
    }
}

/// Enable the deterministic test clock and reset it to zero.
pub fn testing_reset_deadline_clock() {
    // Initialize the anchor before enabling, so virtual time never observes
    // an anchor newer than a previously computed deadline.
    MONOTONIC_ANCHOR.get_or_init(Instant::now);
    TEST_OFFSET_NS.store(0, Ordering::Relaxed);
    TEST_CLOCK_ENABLED.store(true, Ordering::Relaxed);
}

/// Disable the deterministic test clock and reset any offset.
pub fn testing_disable_deadline_clock() {
    TEST_CLOCK_ENABLED.store(false, Ordering::Relaxed);
    TEST_OFFSET_NS.store(0, Ordering::Relaxed);
}

/// Advance the deterministic test clock.
pub fn testing_advance_deadline_clock(duration: Duration) {
    let delta_ns = u64::try_from(duration.as_nanos()).unwrap_or(u64::MAX);
    let mut current = TEST_OFFSET_NS.load(Ordering::Relaxed);
    loop {
        let next = current.saturating_add(delta_ns);
        match TEST_OFFSET_NS.compare_exchange_weak(
            current,
            next,
            Ordering::Relaxed,
            Ordering::Relaxed,
        ) {
            Ok(_) => break,
            Err(observed) => current = observed,
        }
    }
}

#[cfg(test)]
pub(crate) fn testing_deadline_clock_lock() -> std::sync::MutexGuard<'static, ()> {
    TEST_CLOCK_LOCK
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestClockGuard {
        _guard: std::sync::MutexGuard<'static, ()>,
    }

    impl TestClockGuard {
        fn new() -> Self {
            let guard = testing_deadline_clock_lock();
            testing_reset_deadline_clock();
            Self { _guard: guard }
        }
    }

    impl Drop for TestClockGuard {
        fn drop(&mut self) {
            testing_disable_deadline_clock();
        }
    }

    #[test]
    fn none_never_expires() {
        let _clock = TestClockGuard::new();
        assert!(!DeadlineContext::NONE.has_deadline());
        assert!(!DeadlineContext::NONE.is_expired());
        DeadlineContext::NONE.check().unwrap();
        assert_eq!(DeadlineContext::NONE.remaining(), None);
    }

    #[test]
    fn nested_deadline_uses_min_without_mutating_parent() {
        let _clock = TestClockGuard::new();
        let outer = DeadlineContext::NONE.with_timeout(Duration::from_secs(10));
        let wider = outer.with_timeout(Duration::from_secs(20));
        assert_eq!(wider, outer);

        testing_advance_deadline_clock(Duration::from_secs(5));
        let narrower = outer.with_timeout(Duration::from_secs(1));
        assert_eq!(outer.remaining(), Some(Duration::from_secs(5)));
        assert_eq!(narrower.remaining(), Some(Duration::from_secs(1)));
    }

    #[test]
    fn deadline_expires_only_after_timestamp() {
        let _clock = TestClockGuard::new();
        let deadline = DeadlineContext::NONE.with_timeout(Duration::from_secs(10));

        testing_advance_deadline_clock(Duration::from_secs(10));
        assert!(!deadline.is_expired());
        deadline.check().unwrap();

        testing_advance_deadline_clock(Duration::from_nanos(1));
        assert!(deadline.is_expired());
        assert!(deadline.check().unwrap_err().is_deadline_exceeded());
    }

    #[test]
    fn duration_max_saturates_to_far_future() {
        let _clock = TestClockGuard::new();
        let deadline = DeadlineContext::NONE.with_timeout(Duration::MAX);
        assert!(deadline.has_deadline());
        assert!(!deadline.is_expired());
        deadline.check().unwrap();
    }

    #[test]
    fn huge_virtual_clock_offset_does_not_panic() {
        let _clock = TestClockGuard::new();
        testing_advance_deadline_clock(Duration::from_nanos(u64::MAX));

        let deadline = DeadlineContext::NONE.with_timeout(Duration::MAX);
        assert!(deadline.has_deadline());
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1685** (2026-04-25): **[BUG] `test_cli.py::TestShowTree` is flaky: Fatal Python error: PyGILState_Release**
  *Symptoms*: The test `python/tests/cli/test_cli.py::TestShowTree::test_show_tree_with_nested_structure` is flaky. It fails non-deterministically on GitHub runner. It happened twice today, both on Ubuntu-24.04-arm on Python 3.11.  - [Failure 1](https://github.com/cocoindex-io/cocoindex/actions/runs/22194484188/job/64191068207?pr=1682)  - [Failure 2](https://github.com/cocoindex-io/cocoindex/actions/runs/22201218344/job/64214333830?pr=1684)  The first failure has more information in output:  ```   FAILED python/tests/cli/test_cli.py::TestShowTree::test_show_tree_with_nested_structure - AssertionError: Command failed: ['cocoindex', 'show', './tree_test_app.py', '--tree']   returncode=-6   stdout:   Found 6 stable paths:   / [component]   ├── direct [component]   ├── files   │   ├── file1.txt [component]   │   └── file2.txt [component]   └── setup [component]    stderr:   Fatal Python error: PyGILState_Release: thread state 0xff171c001d00 must be current when releasing   Python runtime state: finalizing (tstate=0x0000ff184ea06480)    Thread 0x0000ff184ea7a020 (most recent call first):     <no Python frame>    Extension modules: numpy._core._multiarray_umath, numpy.linalg._umath_linalg (total: 2) ```  The message "Fatal Python error: PyGILState_Release: thread state 0xff171c001d00 must be current when releasing" suggests somewhere we're trying to release GIL when we don't have it? Maybe some race conditions?  After retries, both succeeded.   
  **Post-Mortem & Fix Analysis**:
  > @shannon06437 , do you want to have a look? Please let me know if you're stuck. Thanks!
  > I'll take a look!
  > Hi @shannon06437, the flakiness problem comes back: https://github.com/cocoindex-io/cocoindex/actions/runs/22366810229/job/64734899559  Would you have a look? Thanks!    

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

### Incident Patch 1: `5da1efa8` (2026-10-05)
**Commit Message**: fix(core): scoped exception handlers see LiveMap mount_each items (#2478)

A handler installed with `coco.exception_handler` around
`coco.mount_each(fn, items)` received the items' failures when `items` was a
collection, but none when it was a LiveMapView or LiveMapFeed such as a
`LiveMap`. Those items are mounted by an internal live component from its own
component context, and every component context starts from the environment's
handler alone, so the scoped handler was never consulted: the failures went to
the global handler, or to the "component build failed" fallback log. Items
wrapped in `coco.auto_refresh` inherited the same context for their cycles.

`mount_each` now hands the caller's handler chain to the internal component,
which reinstalls it around the item mounts of each full scan. Incremental live
updates already resolved the caller's chain.

The exception-handler docs now say that LiveMap items are covered and that a
component's own mounts are not. The live-component page no longer says that
the failures of `process()`'s descendants reach the parent's chain.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `docs/src/content/docs/advanced_topics/exception_handlers.mdx` (modified, +3/-1)
```diff
@@ -117,7 +117,9 @@ async def process_all(files):
             await coco.mount(coco.component_subpath(str(f.path)), process_file, f)
 ```
 
-The handler applies to all `mount()` / `mount_each()` calls within the `async with` block, including those in nested functions called from within the block.
+The handler applies to all `mount()` / `mount_each()` calls within the `async with` block, including those in nested functions called from within the block, and to every item of a `mount_each()` whether it iterates a collection or a [`LiveMapView` / `LiveMapFeed`](./live_component#livemapfeed-and-livemapview).
+
+It does not reach the mounts those components make themselves: a component's own `mount()` / `mount_each()` calls start from the global handler, plus any handler the component scopes itself. To observe the failures of components at any depth, register a global handler.
 
 ### Handler type
 
```

**File**: `docs/src/content/docs/advanced_topics/live_component.mdx` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ The `operator` passed to `process_live()` provides five methods:
 
 Triggers a full processing cycle: calls `process()`, submits target states, waits for all children to be ready, and garbage-collects children that are no longer mounted. This is the same mechanism as a traditional component's update cycle.
 
-Exceptions raised inside `process()` (or its descendants) are routed through the parent's [exception handler chain](./exception_handlers#exception-handlers) — same as background `coco.mount()` failures — and **do not propagate** to the caller. This lets long-running `process_live` loops (such as periodic refreshers) keep going across transient cycle failures while still surfacing the failure to operators.
+Exceptions raised inside `process()` (including a failed `use_mount` child's, which surfaces there) are routed through the parent's [exception handler chain](./exception_handlers#exception-handlers) — same as background `coco.mount()` failures — and **do not propagate** to the caller. Components that `process()` mounts in the background report their own failures through the chain in effect where they are mounted, as any `coco.mount()` does. This lets long-running `process_live` loops (such as periodic refreshers) keep going across transient cycle failures while still surfacing the failure to operators.
 
 ### `update()` and `delete()`
 
```

**File**: `python/cocoindex/_internal/api.py` (modified, +3/-1)
```diff
@@ -497,7 +497,9 @@ async def mount_each(*pos_args: Any, **kwargs: Any) -> ComponentMountHandle:
         # LiveComponent class) is dispatched through `mount()` / `operator.update()`
         # inside `_MountEachLiveComponent`, both of which already handle live
         # component classes — so no special-casing of `fn` is needed here.
-        instance = _MountEachLiveComponent(items, fn, extra_args, kwargs)
+        instance = _MountEachLiveComponent(
+            items, fn, extra_args, kwargs, parent_ctx._exception_handler_chain
+        )
         return await _mount_live_component(parent_ctx, child_path, instance)
 
     # Static data source: mount one component per item. When `fn` is a
```

**File**: `python/cocoindex/_internal/component_ctx.py` (modified, +13/-0)
```diff
@@ -127,6 +127,19 @@ def _with_exception_handler(self, handler: ExceptionHandler) -> ComponentContext
             ExceptionHandlerChain(handler=handler, base=self._exception_handler_chain),
         )
 
+    def _with_exception_handler_chain(
+        self, chain: ExceptionHandlerChain | None
+    ) -> ComponentContext:
+        """Same context, routing child failures through ``chain`` instead."""
+        return ComponentContext(
+            self._env,
+            self._core_path,
+            self._core_processor_ctx,
+            self._core_fn_call_ctx,
+            chain,
+            self._in_memo_fn,
+        )
+
     def resolve_exception_handler(
         self,
         *,
```

**File**: `python/cocoindex/_internal/live_component.py` (modified, +23/-5)
```diff
@@ -22,6 +22,7 @@
 from . import core
 from .component_ctx import (
     ComponentSubpath,
+    ExceptionHandlerChain,
     get_context_from_ctx,
 )
 from .deadline import without_deadline as _without_deadline
@@ -559,19 +560,29 @@ async def write_committed_state(self, key: StableKey, value: Any) -> None:
 
 
 class _MountEachLiveComponent:
-    """Internal LiveComponent created by mount_each() for LiveMapFeed/LiveMapView items."""
+    """Internal LiveComponent created by mount_each() for LiveMapFeed/LiveMapView items.
+
+    The per-item components are the ``mount_each`` caller's children in all but
+    their path, so their failures route through the caller's exception handler
+    chain, captured at ``mount_each`` time. This component's own context would
+    not do: like every component's, it starts from the environment's handler
+    alone, so a handler scoped around the ``mount_each`` call would never see
+    the items mounted by a full scan.
+    """
 
     def __init__(
         self,
         items: LiveMapFeed[Any, Any],
         fn: Any,
         args: tuple[Any, ...],
         kwargs: dict[str, Any],
+        exception_handler_chain: ExceptionHandlerChain | None,
     ) -> None:
         self._items = items
         self._fn = fn
         self._args = args
         self._kwargs = kwargs
+        self._exception_handler_chain = exception_handler_chain
 
     async def process(self) -> None:
         if not isinstance(self._items, LiveMapView):
@@ -582,10 +593,17 @@ async def process(self) -> None:
             )
         from .api import mount
 
-        async for key, value in self._items:
-            await mount(
-                ComponentSubpath(key), self._fn, value, *self._args, **self._kwargs
-            )  # type: ignore[arg-type]
+        # Live items (e.g. `auto_refresh`) inherit this context too: their
+        # `process_live` tasks start from it, and their cycles resolve the
+        # handler chain there.
+        ctx = get_context_from_ctx()._with_exception_handler_chain(
+            self._exception_handler_chain
+        )
+        with ctx.attach():
+            async for key, value in self._items:
+                await mount(
+                    ComponentSubpath(key), self._fn, value, *self._args, **self._kwargs
+                )  # type: ignore[arg-type]
 
     async def process_live(self, operator: LiveComponentOperator) -> None:
         subscriber: LiveMapSubscriber[Any, Any] = LiveMapSubscriber(
```

**File**: `python/tests/core/test_exception_handlers.py` (modified, +60/-0)
```diff
@@ -1,10 +1,14 @@
 import asyncio
+import datetime
 import traceback
 from typing import Iterator
 
+import pytest
+
 import cocoindex as coco
 
 from cocoindex._internal import environment as envmod
+from cocoindex.resources.live_map import LiveMap
 
 from tests import common
 from tests.common.target_states import GlobalDictTarget, DictDataWithPrev
@@ -368,3 +372,59 @@ def inner(exc: BaseException, ctx: coco.ExceptionContext) -> None:
     assert outer_calls == []
     assert len(caught) == 1
     assert isinstance(caught[0], asyncio.CancelledError)
+
+
+@pytest.mark.parametrize("auto_refresh", [False, True], ids=["plain", "auto_refresh"])
+def test_scoped_handler_receives_live_map_item_failures(auto_refresh: bool) -> None:
+    """A scoped handler covers a ``mount_each`` over a LiveMap as it covers one
+    over a list: each item's failure reaches it rather than the environment's
+    handler — also when each item is a live component (``coco.auto_refresh``).
+    The items are mounted from an internal live component, whose own context
+    starts from the environment's handler alone."""
+    envmod.reset_default_env_for_tests()
+    name = f"test_exception_handlers_live_map_{'auto_refresh' if auto_refresh else 'plain'}"
+
+    scoped: list[tuple[str, str]] = []
+    environment: list[str] = []
+
+    @coco.lifespan
+    def _lifespan(builder: coco.EnvironmentBuilder) -> Iterator[None]:
+        builder.settings.db_path = common.get_env_db_path(name)
+
+        def global_handler(exc: BaseException, ctx: coco.ExceptionContext) -> None:
+            environment.append(ctx.stable_path)
+
+        builder.set_exception_handler(global_handler)
+        yield
+
+    @coco.fn
+    async def _item(value: str) -> None:
+        raise ValueError(f"boom-{value}")
+
+    @coco.fn
+    async def _produce(lm: LiveMap[str, str]) -> None:
+        lm.declare_entry("a", "1")
+
+    @coco.fn
+    async def _root() -> None:
+        def handler(exc: BaseException, ctx: coco.ExceptionContext) -> None:
+            scoped.append((ctx.stable_path, str(exc)))
+
+        async with coco.exception_handler(handler):
+            lm: LiveMap[str, str] = await LiveMap.create()
+            producer = await coco.mount(_produce, lm)
+            await producer.ready()
+            items = coco.component_subpath("items")
+            if auto_refresh:
+                interval = datetime.timedelta(hours=1)
+                await coco.mount_each(
+                    items, coco.auto_refresh(_item, interval=interval), lm
+                )
+            else:
+                await coco.mount_each(items, _item, lm)
+
+    app = coco.App(name, _root)
+    app.update_blocking()
+
+    assert scoped == [('/"items"/"a"', "boom-1")]
+    assert environment == []
```

---

### Incident Patch 2: `66527641` (2026-10-04)
**Commit Message**: perf(engine): cut the memory held per declared target state (#2469)

The engine held every declared target-state value as the declared Python
object from its declaration until its component committed, and every
action reconcile() built from it until the sink applied it; the map of
declared states also stayed alive through sink apply and the final commit
although nothing read it after pre-commit. For row targets that was most
of a large component's memory.

- Python profile: cocoindex._internal.target_state_codec pickles
  plain-data values exactly (tuples stay tuples; Decimal, datetimes incl.
  ZoneInfo, UUID, ipaddress, numpy and NamedTuples round-trip; aliasing
  within a value is kept). A dict with exact-str keys and flat values is
  stored as its values plus an interned key-tuple id. reconcile() gets a
  fresh decoding; the action it returns is encoded too, referring to the
  value's encoding, and decoded for each sink call. Anything else
  (dataclasses, pydantic/msgspec models, handles, encodings over 64 KiB,
  container specs) stays the declared object.
- Fingerprint-tracking handlers (#2472) fingerprint a value held encoded
  as its decoding, an exact copy; the item key is d

**File**: `docs/src/content/docs/advanced_topics/custom_target_connector.mdx` (modified, +6/-0)
```diff
@@ -71,6 +71,12 @@ The `reconcile()` method must be **non-blocking**. It should only compare states
 Annotate the `prev_possible_records` parameter with `Collection[YourTrackingRecord]` so CocoIndex can properly reconstruct stored tracking records during deserialization. See [Serialization](../programming_guide/serialization) for details on supported types.
 :::
 
+:::info[Values and actions are equal copies]
+CocoIndex holds every declared target state until its processing component commits, and every action until its sink has applied it. To keep that cheap, a value made of plain data — builtin containers and scalars, date and time types, `Decimal`, `UUID`, `ipaddress` and `pathlib` objects, numpy arrays and scalars, enum members, and NamedTuples — is held in a compact encoded form from the moment it's declared. `reconcile()` then receives an equal copy of the value, with the same types (a tuple stays a tuple), rather than the declared object itself, and the sink receives equal copies of the actions `reconcile()` returned. A value holding anything else, such as a dataclass, a pydantic model, or a client handle, reaches `reconcile()` as the declared object.
+
+So don't rely on the identity of a declared value or an action, or pass mutable state through them; and since the copy is taken at declaration, changes made to a value after it was declared are not seen.
+:::
+
 ### Tracking record *(you define)*
 
 A **tracking record** captures the essential information needed to detect changes. Good tracking records:
```

**File**: `python/cocoindex/_internal/__init__.py` (modified, +2/-0)
```diff
@@ -7,6 +7,7 @@
 
 from . import core as _core
 from . import serde as _serde
+from . import target_state_codec as _target_state_codec
 from . import typing as _typing
 from .._version import __version__ as _package_version
 from .memo_fingerprint import register_memo_key_function as _register_memo_key_function
@@ -23,6 +24,7 @@
     serialize_fn=_serde.serialize,
     child_slot_wrapper_fn=_ChildSlot,
     non_existence=_typing.NON_EXISTENCE,
+    target_state_codec=_target_state_codec,
 )
 
 # Make core stable-path objects usable in memo key fingerprints.
```

**File**: `python/cocoindex/_internal/core.pyi` (modified, +2/-0)
```diff
@@ -13,6 +13,7 @@ from typing import (
     TypeVar,
 )
 import asyncio
+from types import ModuleType
 
 from cocoindex._internal.typing import Fingerprintable as Fingerprintable
 from cocoindex._internal.typing import StableKey as StableKey
@@ -420,6 +421,7 @@ def init_runtime(
     serialize_fn: Callable[[Any], bytes],
     child_slot_wrapper_fn: Callable[[ChildTargetSlot], Any],
     non_existence: Any,
+    target_state_codec: ModuleType,
 ) -> None: ...
 def shutdown_tokio_runtime() -> None: ...
 def cancel_all() -> None: ...
```

**File**: `python/cocoindex/_internal/target_state_codec.py` (added, +317/-0)
```diff
@@ -0,0 +1,317 @@
+"""
+Compact in-memory form of declared target-state values and their actions.
+
+The engine holds each declared target state's value from its declaration until
+its component commits, and each action `reconcile()` builds until the sink has
+applied it. For row-shaped values the Python objects are most of that cost: a
+dict of fifteen short strings and ints takes about 1 KB, its encoding here
+about 150 B. This module gives the engine an exact, compact encoding for both,
+so the engine holds bytes and hands an equivalent object back where one is
+needed: to `reconcile()`, and to the sink.
+
+Only plain data is encoded. Pickle restores exact builtin containers and
+scalars, and a fixed set of value types (date/time types, `Decimal`, `UUID`,
+`Fraction`, `ipaddress` and `pathlib` objects, numpy arrays, scalars and
+dtypes, enum members, NamedTuples), exactly: a tuple stays a tuple, a
+`Decimal` a `Decimal`, and two references to one object within a value still
+share it. A value holding anything else (a dataclass, a pydantic model, a
+msgspec Struct, a subclass of a builtin, a handle, a lambda) is left to be held
+as the object itself, as are scalars, already compact, and values whose
+encoding exceeds `_MAX_ENCODED_SIZE`.
+
+A dict whose keys are exact strings, and whose values cannot refer back to it,
+is encoded as a row: its values only, plus the id of its key tuple, interned
+once per process (`_KeySchemas`). A row's column names then cost nothing per
+row, and decoded rows share their key objects, as rows built by a connector do.
+
+What a handler or sink observes: an equal copy of the declared value, taken at
+declaration, instead of the declared object, and an equal copy of the action
+it returned. Each value is encoded on its own, so an object that many declared
+values share is copied into each of their encodings.
+"""
+
+from __future__ import annotations
+
+import datetime
+import decimal
+import enum
+import fractions
+import io
+import ipaddress
+import operator
+import pathlib
+import pickle
+import threading
+import types
+import uuid
+import zoneinfo
+from typing import Any
+
+import numpy as np
+
+_PROTOCOL = 5
+
+# An encoding larger than this is not held: such a value is mostly payload
+# (text, vectors) that is compact as an object already, and an object shared
+# by many declared values would be copied into each of their encodings.
+_MAX_ENCODED_SIZE = 64 * 1024
+
+# First byte of a value's encoding.
+_PICKLED = 0  # a pickle of the value follows
+_ROW = 1  # a 2-byte key schema id, then a pickle of the row's values tuple
+_ROW_SCHEMA_ID_SIZE = 2
+
+# Held as the object itself even at the top of a value: already compact.
+_SCALAR_TYPES: frozenset[type] = frozenset({type(None), bool, int, float, str, bytes})
+
+
+def _all_subclasses(cls: type) -> list[type]:
+    result: list[type] = []
+    for sub in cls.__subclasses__():
+        result.append(sub)
+        result.extend(_all_subclasses(sub))
+    return result
+
+
+# Value types whose instances pickle exactly. Exact builtin containers and
+# scalars never reach the pickler's hook, so they are not listed.
+_VALUE_TYPES: frozenset[type] = frozenset(
+    {
+        complex,
+        datetime.date,
+        datetime.time,
+        datetime.datetime,
+        datetime.timedelta,
+        datetime.timezone,
+        zoneinfo.ZoneInfo,
+        decimal.Decimal,
+        uuid.UUID,
+        fractions.Fraction,
+        ipaddress.IPv4Address,
+        ipaddress.IPv6Address,
+        ipaddress.IPv4Network,
+        ipaddress.IPv6Network,
+        ipaddress.IPv4Interface,
+        ipaddress.IPv6Interface,
+        np.ndarray,
+        pathlib.PurePath,
+        *_all_subclasses(pathlib.PurePath),
+    }
+)
+
+# Values a row's values may hold without being able to refer back to the row.
+_ROW_ATOM_TYPES: frozenset[type] = (_SCALAR_TYPES | _VALUE_TYPES) - {np.ndarray}
+
+
+class _Unencodable(Exception):
+    """Raised while pickling a value that holds something other than plain data."""
+
+
+def _is_plain_data(obj: Any) -> bool:
+    """Whether `obj`, which the pickler is about to reduce, pickles exactly."""
+    cls = type(obj)
+    if cls in _VALUE_TYPES:
+        return True
+    if isinstance(obj, (enum.Enum, np.generic, np.dtype)):
+        return True
+    if isinstance(obj, tuple):
+        # Exact tuples are pickled without the hook; a NamedTuple gets here.
+        return hasattr(cls, "_fields")
+    # Classes and functions pickle by reference: as the reconstructors in the
+    # reductions of the types above, or as plain data within a value.
+    if isinstance(obj, type) or cls is types.FunctionType:
+        return True
+    # `isinstance`: a C method using its defining class (`ZoneInfo._unpickle`
+    # on 3.14) is a subtype of the builtin function type.
+    if isinstance(obj, (types.BuiltinFunctionType, types.MethodType)):
+        # A module-level builtin, or one bound to a class; one bound to an
+        # insta
```

**File**: `python/tests/core/test_target_state_codec.py` (added, +214/-0)
```diff
@@ -0,0 +1,214 @@
+"""Unit tests for the compact form the engine holds declared target-state values
+and their actions in (`cocoindex._internal.target_state_codec`)."""
+
+import collections
+import dataclasses
+import datetime
+import decimal
+import enum
+import fractions
+import ipaddress
+import pathlib
+import uuid
+import zoneinfo
+from typing import Any, NamedTuple
+
+import msgspec
+import numpy as np
+import pytest
+
+from cocoindex._internal import target_state_codec as codec
+
+
+class _Point(NamedTuple):
+    x: int
+    y: int
+
+
+class _Color(enum.Enum):
+    RED = 1
+
+
+@dataclasses.dataclass
+class _Record:
+    x: int
+
+
+class _Spec(msgspec.Struct, frozen=True):
+    x: int
+
+
+class _Str(str):
+    pass
+
+
+class _RowAction(NamedTuple):
+    key: tuple[Any, ...]
+    value: Any
+
+
+def _assert_exact(actual: Any, expected: Any) -> None:
+    """`actual == expected`, with the same types all the way down."""
+    assert type(actual) is type(expected), (actual, expected)
+    if isinstance(expected, np.ndarray):
+        assert actual.dtype == expected.dtype
+        assert actual.shape == expected.shape
+        assert (actual == expected).all()
+    elif isinstance(expected, dict):
+        assert list(actual) == list(expected)
+        for key in expected:
+            _assert_exact(actual[key], expected[key])
+    elif isinstance(expected, (list, tuple)):
+        assert len(actual) == len(expected)
+        for a, e in zip(actual, expected):
+            _assert_exact(a, e)
+    else:
+        assert actual == expected
+
+
+def _round_trip(value: Any) -> Any:
+    encoded = codec.encode_value(value)
+    assert encoded is not None, value
+    return codec.decode_value(encoded)
+
+
+_EXACT_VALUES: list[Any] = [
+    {"pair": (1, 2), "items": [1, 2], "none": None, "flag": True, "ratio": 0.5},
+    (1, [2, (3, "x")]),
+    [b"\x00\x01", bytearray(b"ab"), "text"],
+    {"set": {1, 2}, "frozen": frozenset({"a"})},
+    {1: "int key", 2.5: "float key", (1, 2): "tuple key"},
+    {"nested": {"k": [1, {"z": (None, 1j)}]}},
+    {
+        "price": decimal.Decimal("9.90"),
+        "naive": datetime.datetime(2024, 1, 2, 3, 4, 5),
+        "utc": datetime.datetime(2024, 1, 2, tzinfo=datetime.timezone.utc),
+        "day": datetime.date(2024, 1, 2),
+        "clock": datetime.time(3, 4, 5),
+        "span": datetime.timedelta(seconds=90),
+        "id": uuid.UUID("12345678-1234-5678-1234-567812345678"),
+        "third": fractions.Fraction(1, 3),
+    },
+    {
+        "ip": ipaddress.ip_address("10.0.0.1"),
+        "ip6": ipaddress.ip_address("::1"),
+        "net": ipaddress.ip_network("10.0.0.0/8"),
+        "iface": ipaddress.ip_interface("10.0.0.1/24"),
+        "path": pathlib.PurePosixPath("/a/b"),
+    },
+    {
+        "vec": np.arange(6, dtype=np.float32).reshape(2, 3),
+        "scalar": np.int16(7),
+        "dtype": np.dtype("float64"),
+    },
+    {"point": _Point(1, 2), "color": _Color.RED},
+    _Point(3, 4),
+]
+
+
+@pytest.mark.parametrize("value", _EXACT_VALUES)
+def test_round_trip_is_exact(value: Any) -> None:
+    _assert_exact(_round_trip(value), value)
+
+
+def test_round_trip_keeps_zoneinfo() -> None:
+    try:
+        tz = zoneinfo.ZoneInfo("America/New_York")
+    except zoneinfo.ZoneInfoNotFoundError:
+        pytest.skip("no IANA time zone database (Windows without tzdata)")
+    value = {"aware": datetime.datetime(2024, 1, 2, tzinfo=tz)}
+    _assert_exact(_round_trip(value), value)
+
+
+def test_row_is_encoded_without_its_keys() -> None:
+    keys = [f"column_{i}" for i in range(15)]
+    row = {key: i * 1000 for i, key in enumerate(keys)}
+    encoded = codec.encode_value(row)
+    assert encoded is not None
+    assert not any(key.encode() in encoded for key in keys)
+    decoded = codec.decode_value(encoded)
+    _assert_exact(decoded, row)
+    # Decoded rows share their key objects.
+    assert all(a is b for a, b in zip(decoded, codec.decode_value(encoded)))
+
+
+def test_enum_member_keeps_its_identity() -> None:
+    assert _round_trip({"color": _Color.RED})["color"] is _Color.RED
+
+
+def test_sharing_within_a_value_is_kept() -> None:
+    shared = [1, 2]
+    decoded = _round_trip({"a": shared, "b": shared})
+    assert decoded["a"] is decoded["b"]
+    decoded = _round_trip({"outer": [shared, shared]})
+    assert decoded["outer"][0] is decoded["outer"][1]
+
+    cyclic: dict[str, Any] = {"x": 1}
+    cyclic["self"] = cyclic
+    decoded = _round_trip(cyclic)
+    assert decoded["self"] is decoded
+
+
+_HELD_AS_OBJECTS: list[Any] = [
+    None,
+    1,
+    1.5,
+    True,
+    "text",
+    b"bytes",
+    _Record(1),
+    {"record": _Record(1)},
+    _Spec(1),
+    {"fn": lambda: 1},
+    {"method": [].append},
+    collections.OrderedDict(a=1),
+    {_Str("a"): 1},
+    [object()],
+    {"text": "x" * (codec._MAX_ENCODED_SIZE + 1)},
+]
+
+
+@pytest.mark.parametrize("value", _HELD_AS_OBJECTS)
+def test_values_left_as_objects(value: Any) -> None:
+
```

**File**: `python/tests/core/test_target_state_values.py` (added, +236/-0)
```diff
@@ -0,0 +1,236 @@
+"""End-to-end tests of how the engine holds declared target-state values.
+
+Plain-data values are held encoded from declaration on: `reconcile()` and the
+sink get equal objects of the same types back. The engine releases every
+declared value once pre-commit has reconciled it, before any sink runs.
+"""
+
+import dataclasses
+import datetime
+import decimal
+import gc
+import ipaddress
+import uuid
+import weakref
+from typing import Any, Callable, Collection, NamedTuple
+
+import numpy as np
+
+import cocoindex as coco
+from cocoindex import (
+    ContextProvider,
+    NonExistenceType,
+    StableKey,
+    TargetActionSink,
+    TargetReconcileOutput,
+    is_non_existence,
+)
+
+from tests import common
+
+coco_env = common.create_test_env(__file__)
+
+
+class _Point(NamedTuple):
+    x: int
+    y: int
+
+
+@dataclasses.dataclass
+class _Opaque:
+    """Not plain data: held as the declared object itself."""
+
+    name: str
+
+
+class _Action(NamedTuple):
+    key: str
+    value: Any
+
+
+class _RecordingStore:
+    """Records what `reconcile()` and the sink observe; never skips.
+
+    With `retains_values` off, neither the record nor the action keeps the
+    value `reconcile()` got.
+    """
+
+    reconciled: dict[str, Any]
+    applied: dict[str, Any]
+    retains_values: bool
+    before_sink: list[Callable[[], None]]
+
+    def __init__(self) -> None:
+        self.reset()
+
+    def reset(self) -> None:
+        self.reconciled = {}
+        self.applied = {}
+        self.retains_values = True
+        self.before_sink = []
+
+    def _sink(
+        self, context_provider: ContextProvider, actions: Collection[_Action], /
+    ) -> None:
+        for hook in self.before_sink:
+            hook()
+        for action in actions:
+            self.applied[action.key] = action.value
+
+    def reconcile(
+        self,
+        key: StableKey,
+        desired_state: Any | NonExistenceType,
+        prev_possible_records: Collection[None],
+        prev_may_be_missing: bool,
+        /,
+    ) -> TargetReconcileOutput[_Action, None] | None:
+        assert isinstance(key, str)
+        if is_non_existence(desired_state):
+            return None
+        kept = desired_state if self.retains_values else None
+        self.reconciled[key] = kept
+        return TargetReconcileOutput(
+            action=_Action(key, kept),
+            sink=TargetActionSink.from_fn(self._sink),
+            tracking_record=None,
+        )
+
+
+_store = _RecordingStore()
+_provider = coco.register_root_target_states_provider(
+    "test_target_state_values/recording", _store
+)
+
+
+def _assert_exact(actual: Any, expected: Any) -> None:
+    """`actual == expected`, with the same types all the way down."""
+    assert type(actual) is type(expected), (actual, expected)
+    if isinstance(expected, np.ndarray):
+        assert actual.dtype == expected.dtype
+        assert (actual == expected).all()
+    elif isinstance(expected, dict):
+        assert list(actual) == list(expected)
+        for key in expected:
+            _assert_exact(actual[key], expected[key])
+    elif isinstance(expected, (list, tuple)):
+        assert len(actual) == len(expected)
+        for a, e in zip(actual, expected):
+            _assert_exact(a, e)
+    else:
+        assert actual == expected
+
+
+_OPAQUE = _Opaque("kept")
+
+_DECLARED: dict[str, Any] = {
+    "row": {
+        "id": 7,
+        "tags": ["a", "b"],
+        "point": (1.5, 2.5),
+        "price": decimal.Decimal("9.90"),
+        "at": datetime.datetime(2024, 1, 2, tzinfo=datetime.timezone.utc),
+        "uid": uuid.UUID("12345678-1234-5678-1234-567812345678"),
+        "blob": b"\x00\x01",
+        "vec": np.arange(3, dtype=np.float32),
+        "missing": None,
+    },
+    "nested": {"meta": {"k": [1, (2, 3)]}, "ip": ipaddress.ip_address("10.0.0.1")},
+    "tuple": (1, [2, 3]),
+    "named": _Point(1, 2),
+    "opaque": _OPAQUE,
+}
+
+
+@coco.fn
+def _declare_all() -> None:
+    for key, value in _DECLARED.items():
+        coco.declare_target_state(_provider.target_state(key, value))
+
+
+def test_reconcile_and_sink_get_exact_values() -> None:
+    _store.reset()
+    app = coco.App(
+        coco.AppConfig(
+            name="test_reconcile_and_sink_get_exact_values", environment=coco_env
+        ),
+        _declare_all,
+    )
+    app.update_blocking()
+
+    assert set(_store.reconciled) == set(_DECLARED)
+    assert set(_store.applied) == set(_DECLARED)
+    for key, declared in _DECLARED.items():
+        _assert_exact(_store.reconciled[key], declared)
+        _assert_exact(_store.applied[key], declared)
+    # A value that is not plain data reaches the handler as the declared object.
+    assert _store.reconciled["opaque"] is _OPAQUE
+    assert _store.applied["opaque"] is _OPAQUE
+
+
+_vector_refs: list[weakref.ref[np.ndarray]] = []
+
+
+@coco.fn
+def _declare_vector_row() -> None:
+    vector = np.arange(4.0)
+    _vector_refs.app
```

**File**: `rust/core/src/engine/context.rs` (modified, +3/-1)
```diff
@@ -185,7 +185,9 @@ impl<Prof: EngineProfile> AppContext<Prof> {
 
 pub(crate) struct DeclaredTargetState<Prof: EngineProfile> {
     pub provider: TargetStateProvider<Prof>,
-    pub item_key: StableKey,
+    /// The item key, `storekey`-encoded: the form pre-commit records it in,
+    /// at a fraction of the size of the decoded key's tree of `Arc`s.
+    pub item_key_bytes: Box<[u8]>,
     pub value: Prof::TargetStateValue,
     pub child_provider: Option<TargetStateProvider<Prof>>,
 }
```

**File**: `rust/core/src/engine/execution.rs` (modified, +32/-26)
```diff
@@ -271,7 +271,7 @@ pub fn declare_target_state<Prof: EngineProfile>(
     let provider_dep = target_provider_dep(&provider);
     let declared_target_state = DeclaredTargetState {
         provider,
-        item_key: key,
+        item_key_bytes: encode_item_key(&key)?,
         value,
         child_provider: None,
     };
@@ -281,11 +281,8 @@ pub fn declare_target_state<Prof: EngineProfile>(
             .declared_target_states
             .entry(target_state_path.clone())
         {
-            btree_map::Entry::Occupied(entry) => {
-                client_bail!(
-                    "Target state already declared with key: {:?}",
-                    entry.get().item_key
-                );
+            btree_map::Entry::Occupied(_) => {
+                client_bail!("Target state already declared with key: {key:?}");
             }
             btree_map::Entry::Vacant(entry) => {
                 entry.insert(declared_target_state);
@@ -302,6 +299,12 @@ pub fn declare_target_state<Prof: EngineProfile>(
     Ok(())
 }
 
+fn encode_item_key(key: &StableKey) -> Result<Box<[u8]>> {
+    Ok(storekey::encode_vec(key)
+        .map_err(|e| internal_error!("Failed to encode StableKey: {e}"))?
+        .into_boxed_slice())
+}
+
 /// Whether every recorded target-provider dependency still matches the live
 /// provider generation, i.e. whether a memo entry carrying `deps` may be reused.
 ///
@@ -357,14 +360,15 @@ pub fn declare_target_state_with_child<Prof: EngineProfile>(
     value: Prof::TargetStateValue,
 ) -> Result<TargetStateProvider<Prof>> {
     let provider_dep = target_provider_dep(&provider);
+    let item_key_bytes = encode_item_key(&key)?;
     let child_provider = comp_ctx.update_building_state(|building_state| {
         let child_provider = building_state
             .target_states
             .provider_registry
             .register_lazy(&provider, key.clone())?;
         let declared_target_state = DeclaredTargetState {
             provider,
-            item_key: key,
+            item_key_bytes,
             value,
             child_provider: Some(child_provider.clone()),
         };
@@ -373,11 +377,8 @@ pub fn declare_target_state_with_child<Prof: EngineProfile>(
             .declared_target_states
             .entry(child_provider.target_state_path().clone())
         {
-            btree_map::Entry::Occupied(entry) => {
-                client_bail!(
-                    "Target state already declared with key: {:?}",
-                    entry.get().item_key
-                );
+            btree_map::Entry::Occupied(_) => {
+                client_bail!("Target state already declared with key: {key:?}");
             }
             btree_map::Entry::Vacant(entry) => {
                 entry.insert(declared_target_state);
@@ -1058,14 +1059,14 @@ async fn pre_commit<'tracking, Prof: EngineProfile>(
                 let decl = guard.get(&target_state_path).ok_or_else(|| {
                     internal_error!("declared entry vanished mid-pre_commit: {target_state_path}")
                 })?;
-                let target_state_key_bytes = storekey::encode_vec(&decl.item_key)
-                    .map_err(|e| internal_error!("Failed to encode StableKey: {e}"))?;
-                let handler = decl.provider.handler().ok_or_else(|| {
-                    internal_error!(
+                let decode_item_key =
+                    || -> Result<StableKey> { Ok(storekey::decode(decl.item_key_bytes.as_ref())?) };
+                let Some(handler) = decl.provider.handler() else {
+                    internal_bail!(
                         "provider not ready for target state with key {:?}",
-                        decl.item_key
-                    )
-                })?;
+                        decode_item_key()?
+                    );
+                };
                 let prev_states = prev_item.as_ref().map_or(&[][..], |item| &item.states);
                 // A handler that tracks the fingerprint of the declared value
                 // has nothing to do for a state that is surely present with
@@ -1090,14 +1091,14 @@ async fn pre_commit<'tracking, Prof: EngineProfile>(
                         .map(|s_bytes| Prof::TargetStateTrackingRecord::from_bytes(s_bytes))
                         .collect::<Result<Vec<_>>>()?;
                     handler.reconcile(
-                        decl.item_key.clone(),
+                        decode_item_key()?,
                         Some(&decl.value),
                         &prev_records,
                         prev_may_be_missing,
                     )?
                 };
                 (
-                    target_state_key_bytes,
+                    decl.item_key_bytes.to_vec(),
                     recon_output,
                     decl.child_provider.clone(),
                 )
@@ -1621,11 +1622,10 @@ pub(crate) async fn submit<Prof: EngineProfile>(
     let contained_target_state_paths = Arc::new(contained_target_state
```

---

### Incident Patch 3: `9bbf587a` (2026-10-03)
**Commit Message**: fix(core): fail only the failing caller when a batched write-txn body fails (#2451)

`Storage::run_txn` coalesces concurrent write-txn bodies into one LMDB
write txn. The first body that returned `Err` aborted the txn, and the
batcher fanned that error out to every caller in the batch. Because
`AppStore::precommit` runs `TargetHandler::reconcile` inside its body, a
reconcile error in one component failed the precommit of every component
co-batched with it, including components of other apps sharing the
Environment, and each of them reported a copy of an unrelated error. The
preview path's `client_bail!` for child target providers reached just as
far.

`TxnRunner` now reports a per-body `Result`, as the target action sink
runner already does. When a body fails, the runner aborts the txn (LMDB
has no savepoints, so aborting is the only way to drop the body's
writes) and gives the error to that body's caller alone. It then re-runs
the bodies ahead of the failed one and commits them in a txn of their
own, and runs the bodies behind it in the next txn, so bodies still
commit in call order. Committing the bodies ahead separately keeps each
body to at most two runs however many of its bat

**File**: `AGENTS.md` (modified, +1/-1)
```diff
@@ -299,7 +299,7 @@ async def pool(pg_dsn: str) -> Any:
 
 - All LMDB writes must go through `Storage::run_txn` (uses the single-writer batcher).
 - Do not open a heed write txn directly or wrap the env in a separate mutex/semaphore — bypassing the batcher loses fsync coalescing and regresses concurrent-submit throughput by 10-100×.
-- LMDB has no savepoints. If a sub-operation needs to "abort," handle it at the body level (e.g. return a sentinel result without writing); never attempt per-body rollback inside the batcher.
+- LMDB has no savepoints. If a sub-operation needs to "abort" without failing its caller, handle it at the body level (e.g. return a sentinel result without writing). A body that returns `Err` fails only its own caller: the batcher drops its writes by aborting the txn and re-running the bodies ahead of it, so every body must be safe to re-run.
 - An LMDB write txn must begin and end (commit or abort) on the same OS thread: the writer lock is thread-owned and LMDB ignores a failed release, so a txn that migrates between runtime workers blocks every later writer for good. heed marks `RwTxn` as `Send` regardless, so the compiler won't catch it. `Storage::run_txn` runs each batch on one blocking thread for this reason; never hold a write txn across an `.await` on the multi-thread runtime.
 
 ### Sync vs Async
```

**File**: `rust/core/src/engine/component.rs` (modified, +92/-23)
```diff
@@ -1485,6 +1485,7 @@ mod tests {
     };
     use crate::state::stable_path::{StableKey, StablePath};
     use crate::state_store::StorageSettings;
+    use crate::state_store::test_support::hold_write_batch;
     use async_trait::async_trait;
     use cocoindex_utils::fingerprint::Fingerprint;
     use std::hash::{Hash, Hasher};
@@ -1581,21 +1582,27 @@ mod tests {
     }
 
     /// Plans an action for every desired target state (none for a deletion)
-    /// and counts its `reconcile` calls.
+    /// and counts its `reconcile` calls. With `reject`, it rejects every
+    /// desired target state instead, as a connector rejecting a declared
+    /// value does.
     struct CountingHandler {
         reconcile_calls: Arc<AtomicUsize>,
         sink: TargetActionSinkKeeper<TestProfile>,
+        reject: bool,
     }
 
     impl TargetHandler<TestProfile> for CountingHandler {
         fn reconcile(
             &self,
-            _key: StableKey,
+            key: StableKey,
             desired_target_state: Option<&()>,
             _prev_possible_records: &[TestData],
             _prev_may_be_missing: bool,
         ) -> crate::prelude::Result<Option<TargetReconcileOutput<TestProfile>>> {
             self.reconcile_calls.fetch_add(1, Ordering::SeqCst);
+            if self.reject && desired_target_state.is_some() {
+                cocoindex_utils::client_bail!("target state {key:?} rejected");
+            }
             Ok(desired_target_state.map(|_| TargetReconcileOutput {
                 action: (),
                 sink: self.sink.clone(),
@@ -2163,25 +2170,7 @@ mod tests {
         // write txn of its own, which would wait on that batch's writer lock.
         let overflow_store = env.create_app_store("overflow").await.unwrap();
 
-        // Hold a write batch open, so the `run_txn` calls made meanwhile queue
-        // into the next batch, which runs their bodies in call order.
-        let held = Arc::new(tokio::sync::Notify::new());
-        let release = Arc::new(tokio::sync::Notify::new());
-        let holder = tokio::spawn({
-            let (env, held, release) = (env.clone(), held.clone(), release.clone());
-            async move {
-                env.run_txn(move |_wtxn| {
-                    let (held, release) = (held.clone(), release.clone());
-                    Box::pin(async move {
-                        held.notify_one();
-                        release.notified().await;
-                        Ok(())
-                    })
-                })
-                .await
-            }
-        });
-        held.notified().await;
+        let batch = hold_write_batch(env.storage()).await;
 
         let collector = PreviewActionCollector::<TestProfile>::default();
         let ctx = Component::new(app.app_ctx().clone(), StablePath::root(), None)
@@ -2202,6 +2191,7 @@ mod tests {
             CountingHandler {
                 reconcile_calls: reconcile_calls.clone(),
                 sink: TargetActionSinkKeeper::new(NoopSink),
+                reject: false,
             },
         )
         .unwrap();
@@ -2240,8 +2230,7 @@ mod tests {
         }));
         assert!(futures::poll!(overflow.as_mut()).is_pending());
 
-        release.notify_one();
-        holder.await.unwrap().unwrap();
+        batch.release().await;
         overflow.await.unwrap();
         preview.await.unwrap();
 
@@ -2251,4 +2240,84 @@ mod tests {
         );
         assert_eq!(collector.lock().unwrap().len(), NUM_TARGET_STATES);
     }
+
+    /// Precommits that share a write batch fail independently, even across
+    /// apps sharing the environment: a target handler rejecting one
+    /// component's target state fails that component's submit alone.
+    #[tokio::test]
+    async fn rejected_target_state_fails_only_its_own_components_submit() {
+        let (accepting_app, _dir) = test_app("accepting_app").await;
+        let env = accepting_app.app_ctx().env().clone();
+        let rejecting_app = App::new("rejecting_app", env.clone(), None).await.unwrap();
+
+        let batch = hold_write_batch(env.storage()).await;
+
+        // Each app's root component declares one target state, through a
+        // handler that accepts it or rejects it.
+        let root_ctx = |app: &App<TestProfile>, reject: bool| {
+            let ctx = Component::new(app.app_ctx().clone(), StablePath::root(), None)
+                .new_processor_context_for_build(
+                    None,
+                    ProcessingStats::new(),
+                    false,
+                    false,
+                    None,
+                    Arc::new(()),
+                    None,
+                )
+                .unwrap();
+            let reconcile_calls = Arc::new(AtomicUsize::new(0));
+            let provider = register_root_target_state_provider(
+                &ctx,
+                "target".to_string(),
+                CountingHandler {
+                    reconcile_calls: reconcile_calls.clone(),
+   
```

**File**: `rust/core/src/engine/execution.rs` (modified, +21/-17)
```diff
@@ -513,9 +513,10 @@ impl<Prof: EngineProfile> Committer<Prof> {
     /// Closure that walks `declared_children` (`None`: nothing declared)
     /// against the on-disk `__cex` rows under this component — see
     /// [`reconcile_child_existence`]. `Fn` (not `FnOnce`) because LMDB's
-    /// batcher re-invokes it when it re-runs the commit txn after growing
-    /// the map on `MDB_MAP_FULL`: the cheap (`Arc`/owned) captures are
-    /// cloned per call rather than moved into the future.
+    /// batcher re-invokes it when it re-runs the commit's body, after
+    /// growing the map on `MDB_MAP_FULL` or after another body in its write
+    /// batch fails: the cheap (`Arc`/owned) captures are cloned per call
+    /// rather than moved into the future.
     fn existence_reconciler(
         &self,
         declared_children: Option<Arc<ChildStablePathSet>>,
@@ -758,10 +759,11 @@ enum PreCommitOutcome<Prof: EngineProfile> {
 /// Captures bundle shared into the precommit callback closure. Every
 /// field is `O(1)` to clone (Arc-internal or persistent data structure)
 /// so the body's per-call `Arc::clone(&captures)` is cheap. The callback
-/// must stay `Fn` and only read the bundle: LMDB's batcher re-runs the
-/// whole write batch after growing the map on `MDB_MAP_FULL`, so one
-/// `AppStore::precommit` call can run it — and with it `pre_commit` and
-/// every `TargetHandler::reconcile` — more than once.
+/// must stay `Fn` and only read the bundle: LMDB's batcher re-runs a body
+/// after growing the map on `MDB_MAP_FULL`, or after another body in its
+/// write batch fails, so one `AppStore::precommit` call can run it — and
+/// with it `pre_commit` and every `TargetHandler::reconcile` — more than
+/// once.
 struct PreCommitCaptures<Prof: EngineProfile> {
     app_store: AppStore,
     stable_path: StablePath,
@@ -928,9 +930,10 @@ async fn pre_commit<'tracking, Prof: EngineProfile>(
     // would error on a retry. Passing the detection sub-pass (the only
     // PendingRetry exit) doesn't make this attempt final: LMDB's batcher
     // re-runs the whole precommit callback, this function included, after
-    // growing the map on `MDB_MAP_FULL`. Collecting here and letting
-    // `submit()` apply them after the commit keeps the invariant "set at most
-    // once per successful lifecycle".
+    // growing the map on `MDB_MAP_FULL` or after another body in its write
+    // batch fails. Collecting here and letting `submit()` apply them after
+    // the commit keeps the invariant "set at most once per successful
+    // lifecycle".
     let mut deferred_provider_generations: Vec<(
         TargetStateProvider<Prof>,
         TargetStateProviderGeneration,
@@ -1321,7 +1324,7 @@ async fn pre_commit<'tracking, Prof: EngineProfile>(
 
     // Provider-generation updates: buffered into the output, applied
     // by `submit()` after the precommit txn commits — so a re-run of this
-    // function (the batcher's `MDB_MAP_FULL` retry) doesn't trip the
+    // function (by the batcher, see `PreCommitCaptures`) doesn't trip the
     // `OnceLock::set` "already set" guard.
     Ok(PreCommitOutcome::Done {
         output: PreCommitOutput {
@@ -1428,11 +1431,12 @@ pub(crate) async fn submit<Prof: EngineProfile>(
         // `Ok(None)` from the callback so AppStore applies/commits no
         // tracking writes; the callback hands its output out through
         // `preview_output` instead. One `precommit` call can run the
-        // callback more than once — a batch retried on `MDB_MAP_FULL`
-        // re-runs every body in it — so each run overwrites the slot
-        // (`None` on `PendingRetry`) and only the last run's output
-        // counts. Its actions reach the shared collector once, after
-        // `precommit` returns.
+        // callback more than once — the batcher re-runs a body on
+        // `MDB_MAP_FULL`, or when a body after it in the same write txn
+        // fails — so each run overwrites the slot (`None` on
+        // `PendingRetry`) and only the last run's output counts. Its
+        // actions reach the shared collector once, after `precommit`
+        // returns.
         let collector = comp_ctx
             .preview_collector()
             .cloned()
@@ -1527,7 +1531,7 @@ pub(crate) async fn submit<Prof: EngineProfile>(
                         let output = match outcome {
                             PreCommitOutcome::Done { output, write_plan: _ } => {
                                 // Checked in here rather than after `precommit`:
-                                // the error rolls back the whole batch, so no
+                                // the error drops this body's writes, so no
                                 // generation ID `pre_commit` reserved for a
                                 // child provider commits.
                                 for input in output.actions_by_sinks.values() {
```

**File**: `rust/core/src/state_store/storage.rs` (modified, +213/-45)
```diff
@@ -129,10 +129,11 @@ struct StorageInner {
 /// future that runs against the shared `WriteTxn` and resolves to a boxed
 /// output. The future is bound to the borrow of the txn (`'a`).
 ///
-/// `Fn` (not `FnOnce`) so the batcher can retry the entire batch on
-/// `MDB_MAP_FULL`: the env is resized between attempts, then every body is
-/// called again with a fresh write transaction, and only the last
-/// attempt's outputs are returned. Callers must therefore ensure their
+/// `Fn` (not `FnOnce`) because the runner may call a body again, with a
+/// fresh write transaction, after aborting the txn it ran in — on
+/// `MDB_MAP_FULL`, once the env is resized, or when another body sharing
+/// the txn fails (see [`TxnRunner::run_isolating_failures`]) — and returns
+/// only the last call's output. Callers must therefore ensure their
 /// closures are side-effect–free on the captured state (i.e. they may be
 /// invoked more than once): clone captures inside the closure rather than
 /// moving them out, and never accumulate into shared state from inside the
@@ -143,6 +144,15 @@ type TxnBody = Box<
         + Send,
 >;
 
+/// Outcome of one write-txn pass over a sub-batch of bodies.
+enum TxnPass {
+    /// Every body succeeded and the txn committed: one output per body.
+    Committed(Vec<Box<dyn Any + Send>>),
+    /// The body at `index` failed with `err`. The txn was aborted, and the
+    /// bodies after it did not run.
+    BodyFailed { index: usize, err: Error },
+}
+
 /// Returns `true` if `err` is an LMDB `MDB_MAP_FULL` error.
 fn is_map_full(err: &Error) -> bool {
     let inner = err.without_contexts();
@@ -158,7 +168,7 @@ fn is_map_full(err: &Error) -> bool {
 /// When a `MDB_MAP_FULL` error occurs (either from a put inside a body or
 /// from the final commit), the write txn and its coordinator read guard are
 /// dropped, the coordinator write guard is acquired, the map size is doubled
-/// via `env.resize`, and the whole batch is retried.
+/// via `env.resize`, and every body of that txn is run again.
 ///
 /// Safety: `resize` is only called while holding the coordinator write guard,
 /// which guarantees no read or write LMDB transaction opened through this
@@ -170,34 +180,104 @@ struct TxnRunner {
 }
 
 impl TxnRunner {
-    /// Runs `inputs` in one write txn, resizing the map and retrying the whole
-    /// batch on `MDB_MAP_FULL`. Must be polled on a single OS thread from start
-    /// to finish — see [`Runner::run`].
-    async fn run_with_resize_retry(&self, inputs: &[TxnBody]) -> Result<Vec<Box<dyn Any + Send>>> {
+    /// Runs `bodies` in order and returns each body's own outcome, so a body
+    /// that fails fails only its own caller. Must be polled on a single OS
+    /// thread from start to finish — see [`Runner::run`].
+    ///
+    /// The bodies share one write txn unless one of them fails. LMDB has no
+    /// savepoints, so the writes a failing body made before it failed can
+    /// only be dropped by aborting the txn, which drops the writes of the
+    /// bodies ahead of it too. Those bodies ran cleanly: they run again and
+    /// commit in a txn of their own, then the bodies behind the failing one
+    /// continue in the next txn, so the bodies still commit in input order.
+    /// Committing the bodies ahead on their own, rather than running them
+    /// again with the rest, keeps each body to at most two runs however many
+    /// of its batch mates fail — barring `MDB_MAP_FULL` retries, and bodies
+    /// that fail only when run again.
+    ///
+    /// A failure that is no one body's doing — opening the txn, growing the
+    /// map, committing — goes to every body of that txn.
+    async fn run_isolating_failures(&self, bodies: &[TxnBody]) -> Vec<Result<Box<dyn Any + Send>>> {
+        let mut outcomes: Vec<Option<Result<Box<dyn Any + Send>>>> =
+            std::iter::repeat_with(|| None).take(bodies.len()).collect();
+        // Sub-batches still to run, as index ranges over `bodies`. The
+        // earliest one is on top, so they run (and commit) in input order.
+        let mut pending = vec![0..bodies.len()];
+        while let Some(sub) = pending.pop() {
+            if sub.is_empty() {
+                continue;
+            }
+            match self.run_with_resize_retry(&bodies[sub.clone()]).await {
+                Ok(TxnPass::Committed(outputs)) => {
+                    for (outcome, output) in outcomes[sub].iter_mut().zip(outputs) {
+                        *outcome = Some(Ok(output));
+                    }
+                }
+                Ok(TxnPass::BodyFailed { index, err }) => {
+                    if sub.len() > 1 {
+                        debug!(
+                            "Body {} of a {}-body write txn failed; committing the others \
+                             without it: {err}",
+                            index + 1,
+                            sub.len()
+                        );
+                    }
+                    let
```

**File**: `rust/core/src/state_store/submit_session.rs` (modified, +17/-13)
```diff
@@ -366,9 +366,10 @@ pub struct CommitPlan {
 /// the borrow.
 ///
 /// `Fn` (not `FnOnce`) because the LMDB AppStore can invoke it more
-/// than once: on `MDB_MAP_FULL` the batcher grows the map and re-runs
-/// the whole write batch, this commit included. It therefore clones or
-/// `Arc`-shares its captures rather than moving them in.
+/// than once: the batcher re-runs this commit's body against a fresh txn
+/// after growing the map on `MDB_MAP_FULL`, or after another body in its
+/// write batch fails. It therefore clones or `Arc`-shares its captures
+/// rather than moving them in.
 pub type ExistenceReconciler =
     Box<dyn for<'a, 'env> Fn(&'a mut WriteTxn<'env>) -> BoxFuture<'a, Result<()>> + Send + Sync>;
 
@@ -389,14 +390,17 @@ impl AppStore {
     /// "abort" on PendingRetry, the body contributes no writes.
     ///
     /// The callback is `Fn` (not `FnOnce`) because it can run more than
-    /// once per call: on `MDB_MAP_FULL` the batcher grows the map and
-    /// re-runs every body in the write batch against a fresh txn, keeping
-    /// only the last attempt's output. So the callback must be
-    /// side-effect-free on its captures: clone what the body consumes
-    /// inside the closure (typically a few `Arc::clone`s) rather than
-    /// moving it out. A result handed out through a captured slot rather
-    /// than the return value (as the preview path does) must overwrite the
-    /// slot on each run, never accumulate into it.
+    /// once per call: the batcher re-runs a body against a fresh txn after
+    /// growing the map on `MDB_MAP_FULL`, or after another body in its
+    /// write batch fails, keeping only the last run's output. So the
+    /// callback must be side-effect-free on its captures: clone what the
+    /// body consumes inside the closure (typically a few `Arc::clone`s)
+    /// rather than moving it out. A result handed out through a captured
+    /// slot rather than the return value (as the preview path does) must
+    /// overwrite the slot on each run, never accumulate into it.
+    ///
+    /// A callback error fails only this call: none of its writes commit,
+    /// while the other bodies of the batch commit without it.
     pub async fn precommit<T, F>(
         &self,
         component_path: &StablePath,
@@ -473,8 +477,8 @@ impl AppStore {
     ) -> Result<()> {
         let app_store = self.clone();
         let component_path = component_path.clone();
-        // Wrap non-Clone values in `Arc` so the closure stays `Fn` (retryable on
-        // `MDB_MAP_FULL`). `CommitPlan` and `ExistenceReconciler` are read-only inside
+        // Wrap non-Clone values in `Arc` so the closure stays `Fn` (the batcher may
+        // re-run it). `CommitPlan` and `ExistenceReconciler` are read-only inside
         // the body, so `Arc`-sharing is safe.
         let plan = Arc::new(plan);
         let existence_reconciler = Arc::new(existence_reconciler);
```

**File**: `rust/core/src/state_store/test_support.rs` (modified, +45/-3)
```diff
@@ -1,7 +1,10 @@
-//! Shared test-only helpers for constructing in-process stores.
+//! Shared test-only helpers for constructing in-process stores and steering
+//! their write batches.
 
-use super::AppStore;
+use super::{AppStore, Storage};
+use crate::prelude::*;
 use tempfile::TempDir;
+use tokio::sync::Notify;
 
 /// Open a fresh in-process LMDB environment and return an `AppStore`
 /// backed by it. The caller must keep `TempDir` alive for the duration
@@ -21,6 +24,45 @@ pub(crate) async fn make_test_store() -> (AppStore, TempDir) {
     let mut wtxn = env.write_txn().unwrap();
     let db = env.create_database(&mut wtxn, Some("test_app")).unwrap();
     wtxn.commit().unwrap();
-    let storage = super::Storage::from_env(env.clone());
+    let storage = Storage::from_env(env.clone());
     (AppStore::new(db, env, storage), dir)
 }
+
+/// A write batch held open by [`hold_write_batch`].
+pub(crate) struct HeldWriteBatch {
+    holder: tokio::task::JoinHandle<Result<()>>,
+    release: Arc<Notify>,
+}
+
+impl HeldWriteBatch {
+    /// Lets the held batch commit, and waits until it has.
+    pub(crate) async fn release(self) {
+        self.release.notify_one();
+        self.holder.await.unwrap().unwrap();
+    }
+}
+
+/// Holds a write batch of `storage` open until [`HeldWriteBatch::release`],
+/// so the `run_txn` calls made meanwhile queue into the next batch, which
+/// runs their bodies in call order. Polling such a call once queues it.
+pub(crate) async fn hold_write_batch(storage: &Storage) -> HeldWriteBatch {
+    let held = Arc::new(Notify::new());
+    let release = Arc::new(Notify::new());
+    let holder = tokio::spawn({
+        let (storage, held, release) = (storage.clone(), held.clone(), release.clone());
+        async move {
+            storage
+                .run_txn(move |_wtxn| {
+                    let (held, release) = (held.clone(), release.clone());
+                    Box::pin(async move {
+                        held.notify_one();
+                        release.notified().await;
+                        Ok(())
+                    })
+                })
+                .await
+        }
+    });
+    held.notified().await;
+    HeldWriteBatch { holder, release }
+}
```

---

### Incident Patch 4: `e26e9757` (2026-10-02)
**Commit Message**: fix(valkey): inject CocoIndex library name into server's CLIENT LIST (#2443)

* fix(valkey): tag CocoIndex client connections

* chore: ensure valkey-glide test gate is feature-aware and fix lockfile

* fix: remove accidental dummy_project workspace

* style: fix trailing whitespace and extra blank lines

* fix: remove valkey-glide from oci group in lockfile

* fix: add missing valkey-glide to ci group array in uv.lock

* style: format long line and add docstring note for client_info_tag

* build: exclude valkey-glide on Windows to fix CI build

**File**: `pyproject.toml` (modified, +3/-3)
```diff
@@ -81,7 +81,7 @@ sqlite = ["sqlite-vec>=0.1.6"]
 surrealdb = ["surrealdb>=1.0.0"]
 zvec = ["zvec>=0.5.0"]
 turbopuffer = ["turbopuffer>=0.5.0"]
-valkey = ["valkey-glide>=2.4.0"]
+valkey = ["valkey-glide>=2.5.2"]
 google_drive = [
     "google-api-python-client>=2.0.0",
     "google-auth>=2.0.0",
@@ -117,7 +117,7 @@ all = [
     "sqlite-vec>=0.1.6",
     "surrealdb>=1.0.0",
     "turbopuffer>=0.5.0",
-    "valkey-glide>=2.4.0",
+    "valkey-glide>=2.5.2",
     "google-api-python-client>=2.0.0",
     "google-auth>=2.0.0",
     "google-auth-httplib2>=0.2.0",
@@ -152,7 +152,7 @@ build-test = [
 ]
 format = ["ruff"]
 type-stubs = ["types-psutil", "asyncpg-stubs"]
-ci-enabled-optional-deps = ["pydantic>=2.11.9", "asyncpg>=0.31.0", "neo4j>=5.18.0", "pymysql>=1.1.0", "aiohttp>=3.9.0"]
+ci-enabled-optional-deps = ["pydantic>=2.11.9", "asyncpg>=0.31.0", "neo4j>=5.18.0", "pymysql>=1.1.0", "aiohttp>=3.9.0", "valkey-glide>=2.5.2; sys_platform != 'win32'"]
 examples = ["sentence-transformers>=3.0.0", "numpy"]
 
 ci = [
```

**File**: `python/cocoindex/connectors/valkey/_target.py` (modified, +4/-1)
```diff
@@ -45,7 +45,7 @@
     from glide.async_commands import ft
 except ImportError as e:
     raise ImportError(
-        "valkey-glide>=2.4.0 is required to use the Valkey connector. "
+        "valkey-glide>=2.5.2 is required to use the Valkey connector. "
         "Please install cocoindex[valkey]."
     ) from e
 
@@ -743,6 +743,7 @@ def create_client_config(
         client_name: Client name for the connection, visible in CLIENT LIST
             and monitoring dashboards. Pass ``None`` to disable.
         **kwargs: Additional keyword arguments passed to GlideClientConfiguration.
+            ``client_info_tag`` defaults to ``"cocoindex"``.
 
     Returns:
         GlideClientConfiguration instance.
@@ -752,6 +753,8 @@ def create_client_config(
     addresses = [NodeAddress(host=host, port=port)]
     config_kwargs: dict[str, Any] = dict(kwargs)
 
+    config_kwargs.setdefault("client_info_tag", "cocoindex")
+
     # Explicit parameters take precedence over **kwargs to prevent
     # accidental override of security-sensitive settings.
     if password is not None:
```

**File**: `python/tests/connectors/test_valkey_target.py` (modified, +17/-1)
```diff
@@ -30,10 +30,17 @@
 # =============================================================================
 
 try:
+    import importlib.metadata
+
     from glide import GlideClient, GlideClientConfiguration, NodeAddress
     from glide.async_commands import ft as glide_ft
 
-    HAS_GLIDE = True
+    try:
+        _glide_ver = importlib.metadata.version("valkey-glide")
+        _ver_tuple = tuple(int(x) for x in _glide_ver.split(".")[:3] if x.isdigit())
+        HAS_GLIDE = _ver_tuple >= (2, 5, 2)
+    except Exception:
+        HAS_GLIDE = False
 except ImportError:
     HAS_GLIDE = False
 
@@ -173,11 +180,20 @@ class TestCreateClientConfig:
     def test_default_config(self) -> None:
         config = valkey.create_client_config()
         assert config is not None
+        assert config.client_name == "cocoindex_vector_store"
+        assert config.client_info_tag == "cocoindex"
 
     def test_custom_host_port(self) -> None:
         config = valkey.create_client_config("myhost", 7777)
         assert config is not None
 
+    def test_kwargs_override(self) -> None:
+        config = valkey.create_client_config(
+            client_info_tag="my_custom_tag", client_name="my_custom_name"
+        )
+        assert config.client_info_tag == "my_custom_tag"
+        assert config.client_name == "my_custom_name"
+
 
 @requires_glide
 class TestVectorDef:
```

**File**: `uv.lock` (modified, +39/-25)
```diff
@@ -859,6 +859,7 @@ build-test = [
     { name = "testcontainers", extra = ["neo4j"], marker = "sys_platform != 'win32'" },
 ]
 ci = [
+    { name = "valkey-glide", marker = "sys_platform != 'win32'" },
     { name = "aiohttp" },
     { name = "aiomoto", extra = ["s3"] },
     { name = "asyncpg" },
@@ -876,13 +877,15 @@ ci = [
     { name = "types-psutil" },
 ]
 ci-enabled-optional-deps = [
+    { name = "valkey-glide", marker = "sys_platform != 'win32'" },
     { name = "aiohttp" },
     { name = "asyncpg" },
     { name = "neo4j" },
     { name = "pydantic" },
     { name = "pymysql" },
 ]
 dev = [
+    { name = "valkey-glide", marker = "sys_platform != 'win32'" },
     { name = "aiohttp" },
     { name = "aiomoto", extra = ["s3"] },
     { name = "asyncpg" },
@@ -987,8 +990,8 @@ requires-dist = [
     { name = "turbopuffer", marker = "extra == 'all'", specifier = ">=0.5.0" },
     { name = "turbopuffer", marker = "extra == 'turbopuffer'", specifier = ">=0.5.0" },
     { name = "typing-extensions", specifier = ">=4.12" },
-    { name = "valkey-glide", marker = "extra == 'all'", specifier = ">=2.4.0" },
-    { name = "valkey-glide", marker = "extra == 'valkey'", specifier = ">=2.4.0" },
+    { name = "valkey-glide", marker = "extra == 'all'", specifier = ">=2.5.2" },
+    { name = "valkey-glide", marker = "extra == 'valkey'", specifier = ">=2.5.2" },
     { name = "watchdog", specifier = ">=6.0.0" },
     { name = "zvec", marker = "extra == 'all'", specifier = ">=0.5.0" },
     { name = "zvec", marker = "extra == 'zvec'", specifier = ">=0.5.0" },
@@ -1008,6 +1011,7 @@ build-test = [
 ]
 ci = [
     { name = "aiohttp", specifier = ">=3.9.0" },
+    { name = "valkey-glide", marker = "sys_platform != 'win32'", specifier = ">=2.5.2" },
     { name = "aiomoto", extras = ["s3"], specifier = ">=0.3.0" },
     { name = "asyncpg", specifier = ">=0.31.0" },
     { name = "asyncpg-stubs" },
@@ -1025,13 +1029,15 @@ ci = [
 ]
 ci-enabled-optional-deps = [
     { name = "aiohttp", specifier = ">=3.9.0" },
+    { name = "valkey-glide", marker = "sys_platform != 'win32'", specifier = ">=2.5.2" },
     { name = "asyncpg", specifier = ">=0.31.0" },
     { name = "neo4j", specifier = ">=5.18.0" },
     { name = "pydantic", specifier = ">=2.11.9" },
     { name = "pymysql", specifier = ">=1.1.0" },
 ]
 dev = [
     { name = "aiohttp", specifier = ">=3.9.0" },
+    { name = "valkey-glide", marker = "sys_platform != 'win32'", specifier = ">=2.5.2" },
     { name = "aiomoto", extras = ["s3"], specifier = ">=0.3.0" },
     { name = "asyncpg", specifier = ">=0.31.0" },
     { name = "asyncpg-stubs" },
@@ -5224,36 +5230,44 @@ wheels = [
 
 [[package]]
 name = "valkey-glide"
-version = "2.5.1"
+version = "2.5.2"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "anyio", extra = ["trio"] },
     { name = "cffi" },
     { name = "protobuf" },
     { name = "sniffio" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/01/1f/763005d454387fab3a7404849976f7b7d4b579b9f1e85a9743fa7001c131/valkey_glide-2.5.1.tar.gz", hash = "sha256:b2efb23c987a995ad6ce2a72616996638137dd2504ac262bdd6c045378394090", size = 1004979, upload-time = "2026-08-10T17:00:59.348Z" }
-wheels = [
-    { url = "https://files.pythonhosted.org/packages/bd/d4/b1bb9d5eef0e4ff68e097936c48762b8c409f9127c450fac99f69c3fbd6c/valkey_glide-2.5.1-cp311-cp311-macosx_10_7_x86_64.whl", hash = "sha256:d9bbf26f9ea2b72ef0b8541dfefa479a82a69bdec77fce917192a262893edfda", size = 14428759, upload-time = "2026-08-10T17:00:03.507Z" },
-    { url = "https://files.pythonhosted.org/packages/24/83/959224f674d6eea4ae169bdabe14c7ab55daea7b05671bf2a4a5c9b8effa/valkey_glide-2.5.1-cp311-cp311-macosx_11_0_arm64.whl", hash = "sha256:94256d3335f4c31f19ad1ff02447d9eecd94b8c9e8d51c7b77811277c957e807", size = 13441756, upload-time = "2026-08-10T17:00:05.718Z" },
-    { url = "https://files.pythonhosted.org/packages/ba/5e/88cb67079e3d98c9f2148322684c278bbbb7d250750ff442a96e1e3a9ceb/valkey_glide-2.5.1-cp311-cp311-manylinux_2_17_aarch64.manylinux2014_aarch64.whl", hash = "sha256:d46a9903acb1204deefad88162ac77404f052c7d51ab9d5851d2335ed2fda1e8", size = 14506765, upload-time = "2026-08-10T17:00:07.856Z" },
-    { url = "https://files.pythonhosted.org/packages/74/13/d1a2a7ed823ff33e320f8439590d7bbcd6f59d788c96ca59feb4a7b50c9a/valkey_glide-2.5.1-cp311-cp311-manylinux_2_17_x86_64.manylinux2014_x86_64.whl", hash = "sha256:0e5c17169d07564f0cc23b78c4904c8e03063c8750d8ccf413d229ce9a3092d5", size = 15253471, upload-time = "2026-08-10T17:00:10.317Z" },
-    { url = "https://files.pythonhosted.org/packages/32/73/0c5141e66e4dd03dee50615c31610ae41708223dc548a7ccc767b50f23b9/valkey_glide-2.5.1-cp312-cp312-macosx_10_7_x86_64.whl", hash = "sha256:75da4cb54fe6a0e03a78681237545aa0638dd5a6dd0ff51af6ff4cacf9f99443", size = 14454841, upload-time = "2026-08-10T17:00:12.69Z" },
-    { url = "https://files.pythonhosted.org/packages/ca/44/226d98e31bf2beddeb99e0853546ed89516f05189dc99f33b6aa735e
```

---

### Incident Patch 5: `c47b896d` (2026-10-02)
**Commit Message**: fix: stop recursive localfs walks at symlink cycles (#2456)

fix: prevent recursive localfs symlink cycles

Co-authored-by: Sujit <[REDACTED_EMAIL]>

**File**: `python/cocoindex/connectors/localfs/_source.py` (modified, +14/-4)
```diff
@@ -109,17 +109,21 @@ def _walk_sync(self) -> Iterator[File]:
         if not root_resolved.is_dir():
             raise ValueError(f"Path is not a directory: {root_resolved}")
 
-        dirs_to_process: list[Path] = [root_resolved]
+        root_stat = root_resolved.stat()
+        root_id = (root_stat.st_dev, root_stat.st_ino)
+        dirs_to_process: list[tuple[Path, frozenset[tuple[int, int]]]] = [
+            (root_resolved, frozenset({root_id}))
+        ]
 
         while dirs_to_process:
-            current_dir = dirs_to_process.pop()
+            current_dir, ancestor_ids = dirs_to_process.pop()
 
             try:
                 entries = list(current_dir.iterdir())
             except PermissionError:
                 continue
 
-            subdirs: list[Path] = []
+            subdirs: list[tuple[Path, frozenset[tuple[int, int]]]] = []
 
             for entry in entries:
                 try:
@@ -132,7 +136,13 @@ def _walk_sync(self) -> Iterator[File]:
                     if self._recursive and self._path_matcher.is_dir_included(
                         relative_path
                     ):
-                        subdirs.append(entry)
+                        try:
+                            stat = entry.stat()
+                        except OSError:
+                            continue
+                        entry_id = (stat.st_dev, stat.st_ino)
+                        if entry_id not in ancestor_ids:
+                            subdirs.append((entry, ancestor_ids | {entry_id}))
                 elif entry.is_file():
                     if not self._path_matcher.is_file_included(relative_path):
                         continue
```

**File**: `python/tests/connectors/test_localfs_source.py` (modified, +32/-0)
```diff
@@ -10,6 +10,7 @@
 from __future__ import annotations
 
 import datetime
+import itertools
 import os
 import pathlib
 from pathlib import Path, PurePath
@@ -228,6 +229,37 @@ def test_recursive_enters_subdirs(self, tmp_path: Path) -> None:
         assert "top.txt" in names
         assert "nested.txt" in names
 
+    def test_recursive_symlink_to_ancestor_does_not_loop(self, tmp_path: Path) -> None:
+        (tmp_path / "file.txt").write_bytes(b"content")
+        try:
+            (tmp_path / "loop").symlink_to(tmp_path, target_is_directory=True)
+        except (OSError, NotImplementedError) as exc:
+            pytest.skip(f"Directory symlinks unavailable: {exc}")
+
+        walker = DirWalker(tmp_path, recursive=True)
+        files = list(itertools.islice(walker._walk_sync(), 3))
+        assert [
+            file.file_path.path.relative_to(tmp_path).as_posix() for file in files
+        ] == ["file.txt"]
+
+    def test_recursive_follows_noncyclic_directory_symlink(
+        self, tmp_path: Path
+    ) -> None:
+        target = tmp_path / "target"
+        target.mkdir()
+        (target / "file.txt").write_bytes(b"content")
+        try:
+            (tmp_path / "alias").symlink_to(target, target_is_directory=True)
+        except (OSError, NotImplementedError) as exc:
+            pytest.skip(f"Directory symlinks unavailable: {exc}")
+
+        walker = DirWalker(tmp_path, recursive=True)
+        paths = {
+            file.file_path.path.relative_to(tmp_path).as_posix()
+            for file in walker._walk_sync()
+        }
+        assert paths == {"target/file.txt", "alias/file.txt"}
+
     def test_empty_directory_yields_nothing(self, tmp_path: Path) -> None:
         walker = DirWalker(tmp_path)
         files = list(walker._walk_sync())
```

---

### Incident Patch 6: `72d47983` (2026-10-01)
**Commit Message**: fix(core): collect preview actions once when a write batch re-runs (#2447)

**File**: `rust/core/src/engine/component.rs` (modified, +135/-8)
```diff
@@ -1467,16 +1467,21 @@ mod tests {
     use crate::engine::app::{App, AppUpdateOptions};
     use crate::engine::context::{
         ComponentProcessingAction, ComponentProcessorContext, FnCallContext, MemoStatesPayload,
+        PreviewActionCollector,
     };
     use crate::engine::deadline::{
         DeadlineContext, testing_advance_deadline_clock, testing_deadline_clock_lock,
         testing_disable_deadline_clock, testing_reset_deadline_clock,
     };
     use crate::engine::environment::Environment;
+    use crate::engine::execution::{
+        declare_target_state, register_root_target_state_provider, submit,
+    };
     use crate::engine::profile::{EngineProfile, Persist};
+    use crate::engine::stats::ProcessingStats;
     use crate::engine::target_state::{
-        TargetActionSink, TargetActionWithChildSlot, TargetHandler, TargetReconcileOutput,
-        TargetStateProviderRegistry,
+        TargetActionSink, TargetActionSinkKeeper, TargetActionWithChildSlot, TargetHandler,
+        TargetReconcileOutput, TargetStateProviderRegistry,
     };
     use crate::state::stable_path::{StableKey, StablePath};
     use crate::state_store::StorageSettings;
@@ -1575,17 +1580,28 @@ mod tests {
         }
     }
 
-    struct NoopHandler;
+    /// Plans an action for every desired target state (none for a deletion)
+    /// and counts its `reconcile` calls.
+    struct CountingHandler {
+        reconcile_calls: Arc<AtomicUsize>,
+        sink: TargetActionSinkKeeper<TestProfile>,
+    }
 
-    impl TargetHandler<TestProfile> for NoopHandler {
+    impl TargetHandler<TestProfile> for CountingHandler {
         fn reconcile(
             &self,
             _key: StableKey,
-            _desired_target_state: Option<&()>,
+            desired_target_state: Option<&()>,
             _prev_possible_records: &[TestData],
             _prev_may_be_missing: bool,
         ) -> crate::prelude::Result<Option<TargetReconcileOutput<TestProfile>>> {
-            Ok(None)
+            self.reconcile_calls.fetch_add(1, Ordering::SeqCst);
+            Ok(desired_target_state.map(|_| TargetReconcileOutput {
+                action: (),
+                sink: self.sink.clone(),
+                tracking_record: Some(TestData(Vec::new())),
+                child_invalidation: None,
+            }))
         }
     }
 
@@ -1608,7 +1624,7 @@ mod tests {
         type HostCtx = ();
         type ComponentProc = TestProcessor;
         type FunctionData = TestData;
-        type TargetHdl = NoopHandler;
+        type TargetHdl = CountingHandler;
         type TargetStateTrackingRecord = TestData;
         type TargetAction = ();
         type TargetActionSink = NoopSink;
@@ -1744,11 +1760,18 @@ mod tests {
     }
 
     async fn test_app(name: &str) -> (App<TestProfile>, tempfile::TempDir) {
+        test_app_with_map_size(name, 1 << 24).await
+    }
+
+    async fn test_app_with_map_size(
+        name: &str,
+        lmdb_map_size: usize,
+    ) -> (App<TestProfile>, tempfile::TempDir) {
         let dir = tempfile::tempdir().unwrap();
         let settings = StorageSettings {
             db_path: dir.path().join("lmdb"),
             lmdb_max_dbs: 64,
-            lmdb_map_size: 1 << 24,
+            lmdb_map_size,
         };
         let providers = Arc::new(Mutex::new(TargetStateProviderRegistry::new(
             Default::default(),
@@ -2124,4 +2147,108 @@ mod tests {
             "the full_reprocess update must not reuse the previous update's memo"
         );
     }
+
+    /// A write batch that hits `MDB_MAP_FULL` is re-run in full once the map
+    /// has grown, so a preview's precommit body can run more than once per
+    /// call. Queue it into one batch just ahead of a write that overflows the
+    /// map: every run re-plans the preview's actions, and each action must
+    /// still be collected once.
+    #[tokio::test]
+    async fn preview_collects_actions_once_when_its_write_batch_reruns() {
+        const NUM_TARGET_STATES: usize = 3;
+        let (app, _dir) =
+            test_app_with_map_size("preview_batch_rerun", page_size::get() * 16).await;
+        let env = app.app_ctx().env().clone();
+        // Created before the batch below is held: `create_app_store` opens a
+        // write txn of its own, which would wait on that batch's writer lock.
+        let overflow_store = env.create_app_store("overflow").await.unwrap();
+
+        // Hold a write batch open, so the `run_txn` calls made meanwhile queue
+        // into the next batch, which runs their bodies in call order.
+        let held = Arc::new(tokio::sync::Notify::new());
+        let release = Arc::new(tokio::sync::Notify::new());
+        let holder = tokio::spawn({
+            let (env, held, release) = (env.clone(), held.clone(), release.clone());
+            async move {
+                env.run_txn(move |_wtxn| {
+                    let (held, release) = (held.clone(), release.clone());
+                    Box::pin(async move 
```

**File**: `rust/core/src/engine/execution.rs` (modified, +46/-39)
```diff
@@ -1411,22 +1411,27 @@ pub(crate) async fn submit<Prof: EngineProfile>(
     if comp_ctx.preview() {
         // Mirror normal precommit Phase 2 planning, but always return
         // `Ok(None)` from the callback so AppStore applies/commits no
-        // tracking writes. Actions are collected in-memory only.
+        // tracking writes; the callback hands its output out through
+        // `preview_output` instead. One `precommit` call can run the
+        // callback more than once — a batch retried on `MDB_MAP_FULL`
+        // re-runs every body in it — so each run overwrites the slot
+        // (`None` on `PendingRetry`) and only the last run's output
+        // counts. Its actions reach the shared collector once, after
+        // `precommit` returns.
         let collector = comp_ctx
             .preview_collector()
             .cloned()
             .ok_or_else(|| internal_error!("preview mode requires a preview collector"))?;
-        let preview_result: Arc<Mutex<Option<(bool, Option<String>)>>> = Arc::new(Mutex::new(None));
+        let preview_output: Arc<Mutex<Option<PreCommitOutput<Prof>>>> = Arc::new(Mutex::new(None));
 
         let contained_target_state_paths = Arc::new(contained_target_state_paths);
         let declared_target_states = Arc::new(tokio::sync::Mutex::new(declared_target_states));
 
         let mut pending_backoff = std::time::Duration::from_millis(5);
         const MAX_PENDING_RETRIES: u32 = 8;
         let mut pending_attempt: u32 = 0;
-        loop {
-            let preview_result_capture = preview_result.clone();
-            let collector = collector.clone();
+        let pre_commit_out = loop {
+            let preview_output_capture = preview_output.clone();
             let captures: Arc<PreCommitCaptures<Prof>> = Arc::new(PreCommitCaptures {
                 app_store: app_store.clone(),
                 stable_path: stable_path.clone(),
@@ -1439,8 +1444,7 @@ pub(crate) async fn submit<Prof: EngineProfile>(
             app_store
                 .precommit(&stable_path, move |wtxn, session| {
                     let c = Arc::clone(&captures);
-                    let preview_result_capture = preview_result_capture.clone();
-                    let collector = collector.clone();
+                    let preview_output_capture = preview_output_capture.clone();
                     Box::pin(async move {
                         let declared_paths_all: Vec<TargetStatePath> = {
                             let guard = c.declared_target_states.lock().await;
@@ -1505,8 +1509,12 @@ pub(crate) async fn submit<Prof: EngineProfile>(
                         )
                         .await?;
 
-                        Ok(match outcome {
+                        let output = match outcome {
                             PreCommitOutcome::Done { output, write_plan: _ } => {
+                                // Checked in here rather than after `precommit`:
+                                // the error rolls back the whole batch, so no
+                                // generation ID `pre_commit` reserved for a
+                                // child provider commits.
                                 for input in output.actions_by_sinks.values() {
                                     if !input.pending_children.is_empty() {
                                         client_bail!(
@@ -1515,49 +1523,48 @@ pub(crate) async fn submit<Prof: EngineProfile>(
                                         );
                                     }
                                 }
-                                let previously_exists = output.previously_exists;
-                                let processor_name_for_del = output.processor_name_for_del;
-                                let mut guard = collector.lock().unwrap();
-                                for (_sink, input) in output.actions_by_sinks {
-                                    guard.extend(input.actions.into_iter().map(|(action, _)| action));
-                                }
-                                *preview_result_capture.lock().unwrap() =
-                                    Some((previously_exists, processor_name_for_del));
-                                None::<(PrecommitWritePlan, PreCommitOutput<Prof>)>
+                                Some(output)
                             }
                             PreCommitOutcome::PendingRetry => None,
-                        })
+                        };
+                        *preview_output_capture.lock().unwrap() = output;
+                        Ok(None::<(PrecommitWritePlan, ())>)
                     })
                 })
                 .await?;
 
-            if preview_result.lock().unwrap().is_some() {
-                break;
-            }
-            pending_attempt += 1;
-            if pending_attempt >= MAX_PENDING_RETRIES {
-                client_bail!(
-                    "preview pre_commit gave up after {} retries waiting for 
```

**File**: `rust/core/src/state_store/storage.rs` (modified, +7/-5)
```diff
@@ -131,11 +131,13 @@ struct StorageInner {
 ///
 /// `Fn` (not `FnOnce`) so the batcher can retry the entire batch on
 /// `MDB_MAP_FULL`: the env is resized between attempts, then every body is
-/// called again with a fresh write transaction. Callers must therefore
-/// ensure their closures are side-effect–free on the captured state (i.e.
-/// they may be invoked more than once). In practice all callers clone `Arc`
-/// handles inside the closure and do not move-out of captures, so this is
-/// already satisfied.
+/// called again with a fresh write transaction, and only the last
+/// attempt's outputs are returned. Callers must therefore ensure their
+/// closures are side-effect–free on the captured state (i.e. they may be
+/// invoked more than once): clone captures inside the closure rather than
+/// moving them out, and never accumulate into shared state from inside the
+/// body — a body that reports through a shared slot overwrites it on each
+/// run, and the caller acts on it after `run_txn` returns.
 type TxnBody = Box<
     dyn for<'a, 'env> Fn(&'a mut WriteTxn<'env>) -> BoxFuture<'a, Result<Box<dyn Any + Send>>>
         + Send,
```

**File**: `rust/core/src/state_store/submit_session.rs` (modified, +3/-1)
```diff
@@ -394,7 +394,9 @@ impl AppStore {
     /// only the last attempt's output. So the callback must be
     /// side-effect-free on its captures: clone what the body consumes
     /// inside the closure (typically a few `Arc::clone`s) rather than
-    /// moving it out.
+    /// moving it out. A result handed out through a captured slot rather
+    /// than the return value (as the preview path does) must overwrite the
+    /// slot on each run, never accumulate into it.
     pub async fn precommit<T, F>(
         &self,
         component_path: &StablePath,
```

---

### Incident Patch 7: `bdd3ee92` (2026-09-30)
**Commit Message**: fix(agents): keep the docs build check from rewriting package-lock.json (#2444)

dev/agent-checks/docs-build-run.sh, which the Claude Code Stop hook runs
after any docs/ edit, installed with `npm i`. `npm i` re-serializes
docs/package-lock.json in the local npm's format, so the check rewrote the
lockfile whenever the local npm differed from the one that generated it:
with npm 10.9.8, one run strips all 16 `libc` fields from the sharp/libvips
platform packages. Every docs-editing agent session ended with an unrelated
lockfile diff that `git commit -a` or `git add -A` would sweep in.

Install with `npm ci` instead. It never writes the lockfile, installs exactly
what it pins, and fails if it disagrees with package.json -- the same install
the docs CI workflow runs. `npm ci` wipes node_modules first, so the check
runs it only when npm's hidden lockfile (node_modules/.package-lock.json,
written by every successful install) is missing or older than package.json
or package-lock.json, and otherwise goes straight to the build. Audit is off
because its report tells the reader to run `npm audit fix`, which rewrites
the lockfile too.

Also fix the Stop hook's stale "run yarn build" comment.

C

**File**: `.claude/hooks/docs-build-run.sh` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 #!/bin/bash
-# Stop hook: if docs/ files were changed during this turn, run yarn build.
+# Stop hook: if docs/ files were changed during this turn, run the docs build check.
 
 FLAG="$CLAUDE_PROJECT_DIR/.claude/hooks/.docs-changed"
 
```

**File**: `dev/agent-checks/docs-build-run.sh` (modified, +12/-1)
```diff
@@ -7,5 +7,16 @@ SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
 REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
 
 cd "${REPO_ROOT}/docs"
-npm i 2>&1
+# `npm ci`, not `npm i`: `npm i` re-serializes package-lock.json, which rewrites
+# it whenever the local npm differs from the one that generated it. `npm ci`
+# never writes the lockfile and fails if it disagrees with package.json. It also
+# wipes node_modules, so skip it while npm's hidden lockfile (written by every
+# install) is newer than both package.json and package-lock.json.
+HIDDEN_LOCKFILE=node_modules/.package-lock.json
+if [ ! -f "${HIDDEN_LOCKFILE}" ] ||
+  [ package.json -nt "${HIDDEN_LOCKFILE}" ] ||
+  [ package-lock.json -nt "${HIDDEN_LOCKFILE}" ]; then
+  # No audit: its report says to run `npm audit fix`, which rewrites the lockfile.
+  npm ci --no-audit --no-fund 2>&1
+fi
 npm run build 2>&1
```

---

### Incident Patch 8: `1bbd4773` (2026-09-30)
**Commit Message**: fix(amazon_s3): handle zero-length range reads (#2437)

Co-authored-by: Sujit <[REDACTED_EMAIL]>

**File**: `python/cocoindex/connectors/amazon_s3/_source.py` (modified, +3/-0)
```diff
@@ -130,6 +130,9 @@ async def _fetch_metadata(self) -> file.FileMetadata:
 
     async def _read_impl(self, size: int = -1) -> bytes:
         """Asynchronously read file content from S3."""
+        if size == 0 or (size > 0 and await self.size() == 0):
+            return b""
+
         bucket_name: str = self._file_path.bucket_name
         object_key: str = self._file_path.resolve()
         if size >= 0:
```

**File**: `python/tests/connectors/test_amazon_s3.py` (modified, +18/-0)
```diff
@@ -183,6 +183,24 @@ async def test_read(self, s3_client: tuple[Any, str]) -> None:
         f = await amazon_s3.get_object(client, bucket_name, "data/nested.json")
         assert await f.read() == b'{"key": "value"}'
 
+    async def test_partial_read_zero_bytes(self, s3_client: tuple[Any, str]) -> None:
+        client, bucket_name = s3_client
+        f = await amazon_s3.get_object(client, bucket_name, "file1.txt")
+
+        assert await f.read(0) == b""
+        assert await f.read(2) == b"he"
+        assert await f.read() == b"hello"
+
+    async def test_partial_read_empty_object(self, s3_client: tuple[Any, str]) -> None:
+        client, bucket_name = s3_client
+        boto3.client("s3", region_name="us-east-1").put_object(
+            Bucket=bucket_name, Key="empty.bin", Body=b""
+        )
+        f = await amazon_s3.get_object(client, bucket_name, "empty.bin")
+
+        assert await f.read(2) == b""
+        assert await f.read() == b""
+
     async def test_read_text(self, s3_client: tuple[Any, str]) -> None:
         """await read_text() returns file content as text."""
         client, bucket_name = s3_client
```

---

### Incident Patch 9: `ebd91291` (2026-09-29)
**Commit Message**: fix(surrealdb): surface statement errors, typed CBOR values, array IDs, MERGE ownership, fields mode (#2439)

- Raise on any statement error in a batch (was silently swallowed by query())
- Send values as typed CBOR parameters (datetime, date, Decimal, UUID, bytes,
  timedelta, lists, dicts, numpy); run column encoders exactly once
- String, integer and array record IDs; relation endpoints likewise
- Record writes use UPSERT ... MERGE (never CONTENT); fields no longer declared
  are unset; add TableTarget.declare_fields for multi-owner records
- Bounded transactions (500 actions), retry on transaction conflict
- Reuse one connection per ConnectionFactory and event loop
- Vector index: HNSW only (MTREE was removed in SurrealDB 3), attachments()
- Idempotent DDL (DEFINE ... OVERWRITE)

**File**: `docs/src/content/docs/connectors/surrealdb.mdx` (modified, +26/-6)
```diff
@@ -3,8 +3,8 @@ title: "*SurrealDB* connector"
 toc_max_heading_level: 4
 description: >
   Write to SurrealDB with support for normal and relation (graph edge) tables,
-  atomic cross-table transactions, and vector indexes with cosine / euclidean /
-  manhattan distances over mtree or hnsw methods.
+  typed values, array record IDs, bounded transactions, and HNSW vector indexes
+  with cosine / euclidean / manhattan distances.
 ---
 The `surrealdb` connector provides utilities for writing records to SurrealDB databases, with support for normal tables, relation (graph edge) tables, optional schema enforcement, and vector indexes.
 
@@ -23,7 +23,7 @@ pip install cocoindex[surrealdb]
 
 ## Connection setup
 
-Create a `ConnectionFactory` and provide it via a `ContextKey`. It holds connection parameters and creates authenticated connections on demand.
+Create a `ConnectionFactory` and provide it via a `ContextKey`. It holds connection parameters and opens one authenticated connection per event loop, shared by all tables and batches. Call `await factory.close()` at shutdown to close it.
 
 :::note
 The key name is load-bearing across runs — it's the stable identity CocoIndex uses to track managed rows. See [ContextKey as stable identity](../programming_guide/context#contextkey-as-stable-identity) before renaming.
@@ -53,7 +53,15 @@ def coco_lifespan(builder: coco.EnvironmentBuilder) -> Iterator[None]:
 
 The `surrealdb` connector provides target state APIs for writing records to normal tables and relation tables. CocoIndex tracks what records should exist and automatically handles upserts and deletions.
 
-All tables within the same database share a single transaction sink, so changes across related tables and relations are applied atomically.
+Writes are sent as typed parameters (`datetime`, `date`, `Decimal`, `UUID`, `bytes`, `timedelta`, lists and dicts arrive as native SurrealDB types, not strings).
+
+**Transactions and errors.** The changes of each table are applied in chunks of at most 500 actions, each chunk one transaction (`Transaction conflict` errors are retried with backoff). Atomicity is per chunk, not across tables. Any statement error rolls the chunk back and raises, so the update fails and the affected components are retried on the next run.
+
+**Record IDs** may be a string, an integer, or a tuple/list, which becomes an array ID (`person:['sap', '0001']`). Relation endpoints (`from_id`, `to_id`) take the same forms.
+
+**Ownership.** `declare_record` writes with `UPSERT ... MERGE`, never `CONTENT`: fields written by other owners survive, and fields you stop declaring are unset. Use `declare_fields` when a pipeline contributes only some fields of a record that another pipeline owns. Relation records are single-owner and are replaced whole.
+
+**DDL.** Table and field definitions use `OVERWRITE`, so they are idempotent. With `managed_by="user"` CocoIndex never runs DDL on tables (indexes declared with `declare_vector_index` are still created).
 
 ### Declaring target states
 
@@ -98,6 +106,18 @@ def TableTarget.declare_record(
 
 `declare_row` is an alias for `declare_record`, for compatibility with Postgres and other RDBMS targets.
 
+```python
+def TableTarget.declare_fields(
+    self,
+    *,
+    id: Any,
+    group: str,
+    fields: dict[str, Any],
+) -> None
+```
+
+Declares the fields one owner (`group`) contributes to a record. It runs `UPDATE $id MERGE {fields}` and touches nothing else. When the declaration goes away, or a field is dropped from it, those fields are unset. If the record does not exist, the write raises and is retried on the next run, so declare the base record in the same or another pipeline.
+
 #### Relation tables (parent state)
 
 Declares a relation (graph edge) table. Returns a `RelationTarget` for declaring relation records.
@@ -159,7 +179,7 @@ def TableTarget.declare_vector_index(
     name: str | None = None,
     field: str,
     metric: Literal["cosine", "euclidean", "manhattan"] = "cosine",
-    method: Literal["mtree", "hnsw"] = "mtree",
+    method: Literal["hnsw"] = "hnsw",
     dimension: int | None = None,
     vector_type: Literal["f32", "f64", "i16", "i32", "i64"] = "f32",
 ) -> None
@@ -170,7 +190,7 @@ def TableTarget.declare_vector_index(
 - `name` — Index name (defaults to `idx_{table}__{field}`).
 - `field` — Field to index (must be a vector/array field).
 - `metric` — Distance metric: `"cosine"`, `"euclidean"`, or `"manhattan"`.
-- `method` — Index method: `"mtree"` or `"hnsw"`.
+- `method` — Index method: `"hnsw"` (SurrealDB 3 removed `MTREE`).
 - `dimension` — Vector dimension (required).
 - `vector_type` — Vector element type: `"f32"`, `"f64"`, `"i16"`, `"i32"`, or `"i64"`.
 
```

**File**: `python/cocoindex/connectors/surrealdb/_target.py` (modified, +336/-150)
```diff
@@ -5,15 +5,19 @@
 1. Table level: Creates/drops tables in the database (DEFINE TABLE / REMOVE TABLE)
 2. Record level: Upserts/deletes records within tables (UPSERT / DELETE / RELATE)
 
+Record-level writes send every value as a typed CBOR parameter, raise on any
+statement error, and run in bounded transactions (see ``_SharedRecordApplier``).
+
 Supports both normal tables and relation (graph edge) tables, with optional
 schema enforcement (SCHEMAFULL/SCHEMALESS) and vector index support.
 """
 
 from __future__ import annotations
 
+import asyncio
 import datetime
 import decimal
-import json
+import random
 import re
 import uuid
 from dataclasses import dataclass
@@ -42,21 +46,22 @@
 if TYPE_CHECKING:
     # surrealdb is untyped; use Any so mypy doesn't complain about attribute access.
     AsyncSurreal = Any
+    RecordID = Any
 else:
     AsyncSurreal = _surrealdb.AsyncSurreal
+    RecordID = _surrealdb.RecordID
 
 import numpy as np
+from surrealdb.cbor import CBORTag as _CBORTag  # type: ignore[import-untyped]
 
 import cocoindex as coco
 from cocoindex.connectorkits import statediff, target
 from cocoindex.connectorkits.fingerprint import fingerprint_object
 from cocoindex._internal.datatype import (
-    AnyType,
     MappingType,
     SequenceType,
     RecordType,
     TypeChecker,
-    UnionType,
     analyze_type_info,
     is_record_type,
 )
@@ -84,18 +89,11 @@ def _validate_identifier(name: str, kind: str) -> None:
         )
 
 
-def _format_record_id(value: Any) -> str:
-    """Format a record ID for inline use in SurrealQL, preserving type.
-
-    * ``int`` / ``float`` → bare numeric literal (``123``, ``3.14``)
-    * ``str`` (and everything else) → backtick-quoted with ``\\`` and
-      backtick escaping (`` `alice` ``, `` `has\\`tick` ``)
-    """
-    if isinstance(value, (int, float)):
-        return str(value)
-    s = str(value)
-    s = s.replace("\\", "\\\\").replace("`", "\\`")
-    return f"`{s}`"
+def _to_record_id(table: str, value: Any) -> Any:
+    """Build a typed record ID. A tuple / list ID becomes an array ID (``t:['a', 1]``)."""
+    if isinstance(value, (tuple, list)):
+        value = [_sanitize(v) for v in value]
+    return RecordID(table, value)
 
 
 # ---------------------------------------------------------------------------
@@ -132,31 +130,64 @@ def __init__(
         self._namespace = namespace
         self._database = database
         self._credentials = credentials
+        self._conn: AsyncSurreal | None = None
+        self._conn_loop: asyncio.AbstractEventLoop | None = None
 
     async def acquire(self) -> AsyncSurreal:
-        """Create a new authenticated connection on the current event loop."""
+        """Return the authenticated connection for the current event loop.
+
+        The connection is opened once and reused by every table and batch (a
+        SurrealDB WebSocket multiplexes concurrent requests). A new one is opened
+        if the event loop changed, e.g. between ``update_blocking()`` calls.
+        """
+        # ponytail: one shared connection per factory; add a pool if a single
+        # WebSocket becomes the throughput limit.
+        loop = asyncio.get_running_loop()
+        if self._conn is not None and self._conn_loop is loop:
+            return self._conn
         conn = AsyncSurreal(self._url)
         await conn.connect()  # type: ignore[call-arg]
         if self._credentials:
             await conn.signin(self._credentials)  # type: ignore[arg-type]
         await conn.use(self._namespace, self._database)
+        self._conn, self._conn_loop = conn, loop
         return conn
 
+    async def close(self) -> None:
+        """Close the cached connection, if any."""
+        conn, self._conn, self._conn_loop = self._conn, None, None
+        if conn is not None:
+            await conn.close()
+
 
 # ---------------------------------------------------------------------------
 # Type aliases
 # ---------------------------------------------------------------------------
 
-_RowKey = tuple[Any, ...]  # Primary key values as tuple (always (id,))
+_RowKey = tuple[Any, ...]  # (id,) for record mode; (id, group) for fields mode
 _ROW_KEY_CHECKER = TypeChecker(tuple[Any, ...])
 _RowFingerprint = bytes
 
 
+class _FieldsTracking(msgspec.Struct, frozen=True, array_like=True):
+    """Tracking record of a ``fields``-mode target: fingerprint plus owned field names.
+
+    The names let a delete (or a shrunk field group) ``UNSET`` exactly the fields this
+    group owned.
+    """
+
+    fp: bytes
+    names: tuple[str, ...]
+
+
+_RowTracking = bytes | _FieldsTracking
+
+
 class _RelationRowValue(NamedTuple):
     """Value type for relation records, carrying endpoint metadata separately from field data."""
 
-    from_record: str  # e.g. "person:`alice`"
-    to_record: str  # e.g. "post:`p1`"
+    from_record: tuple[str, Any]  # (table, id), e.g. ("person", "alice")
+    to_record: tuple[str, Any]  # (table, id), e.g. ("post", ["p"
```

**File**: `python/tests/connectors/test_surrealdb_target.py` (modified, +306/-23)
```diff
@@ -14,6 +14,7 @@
 from numpy.typing import NDArray
 
 import cocoindex as coco
+from cocoindex.connectorkits.target import ManagedBy
 from cocoindex.resources.schema import VectorSchema
 
 from tests import common
@@ -26,7 +27,7 @@
 # =============================================================================
 
 try:
-    from surrealdb import AsyncSurreal  # type: ignore[import-untyped]
+    from surrealdb import AsyncSurreal, RecordID  # type: ignore[import-untyped]
 
     HAS_SURREALDB = True
 except ImportError:
@@ -41,7 +42,7 @@
 if HAS_SURREALDB:
     from cocoindex.connectors import surrealdb  # type: ignore[attr-defined]
     from cocoindex.connectors.surrealdb._target import (  # type: ignore[import-untyped]
-        _format_record_id,
+        _to_record_id,
         _validate_identifier,
     )
 
@@ -80,30 +81,20 @@ def test_invalid_identifiers(self, name: str) -> None:
 
 
 @requires_surrealdb
-class TestFormatRecordId:
-    """Tests for _format_record_id()."""
+class TestToRecordId:
+    """Tests for _to_record_id(): IDs stay typed, nothing is string-formatted."""
 
-    def test_string_simple(self) -> None:
-        assert _format_record_id("alice") == "`alice`"
+    def test_string(self) -> None:
+        assert _to_record_id("t", "alice") == RecordID("t", "alice")
 
-    def test_string_with_backtick(self) -> None:
-        assert _format_record_id("has`tick") == r"`has\`tick`"
+    def test_int_and_numeric_string_stay_distinct(self) -> None:
+        assert _to_record_id("t", 123) != _to_record_id("t", "123")
 
-    def test_string_with_backslash(self) -> None:
-        assert _format_record_id(r"back\slash") == r"`back\\slash`"
+    def test_tuple_becomes_array_id(self) -> None:
+        assert _to_record_id("t", ("sap", 1)) == RecordID("t", ["sap", 1])
 
-    def test_int(self) -> None:
-        assert _format_record_id(42) == "42"
-
-    def test_float(self) -> None:
-        assert _format_record_id(3.14) == "3.14"
-
-    def test_string_numeric_stays_quoted(self) -> None:
-        # string "123" must remain distinct from int 123
-        assert _format_record_id("123") == "`123`"
-
-    def test_string_empty(self) -> None:
-        assert _format_record_id("") == "``"
+    def test_awkward_string(self) -> None:
+        assert _to_record_id("t", "a`b\\c").id == "a`b\\c"
 
 
 @requires_surrealdb
@@ -366,7 +357,6 @@ async def declare_schemaless_rows() -> None:
 
 async def declare_nothing() -> None:
     """Declare nothing — used to test table cleanup."""
-    pass
 
 
 # =============================================================================
@@ -1960,3 +1950,296 @@ async def declare_types_table() -> None:
     assert row["count"] == 42
     assert abs(row["score"] - 3.14) < 0.01
     assert row["label"] == "hello"
+
+
+# =============================================================================
+# Hardened target: errors surface, typed values, array IDs, fields mode, txns
+# =============================================================================
+
+
+def _hardened_app(
+    ns: str,
+    db: str,
+    table_name: str,
+    declare: Any,
+    *,
+    schema: Any = None,
+) -> Any:
+    """App over a user-managed table (the platform owns DDL); ``declare(table)`` fills it."""
+    coco_env.context_provider.provide(
+        SURREAL_DB_KEY,
+        surrealdb.ConnectionFactory(
+            url=_SURREALDB_URL,
+            namespace=ns,
+            database=db,
+            credentials={"username": _SURREALDB_USER, "password": _SURREALDB_PASS}
+            if _SURREALDB_USER
+            else None,
+        ),
+    )
+
+    async def main() -> None:
+        table = await coco.use_mount(  # type: ignore[call-overload]
+            coco.component_subpath("setup", "table"),
+            surrealdb.mount_table_target,
+            SURREAL_DB_KEY,
+            table_name,
+            schema,
+            managed_by=ManagedBy.USER,
+        )
+        declare(table)
+
+    return coco.App(
+        coco.AppConfig(name=f"hard_{table_name}", environment=coco_env), main
+    )
+
+
+@requires_surrealdb
+@pytest.mark.asyncio
+async def test_statement_error_raises_and_retries(
+    surreal_conn: tuple[Any, str, str],
+) -> None:
+    """T1: a rejected write fails the update; the next run retries it."""
+    conn, ns, db = surreal_conn
+    await _query(conn, "DEFINE TABLE fi SCHEMAFULL")
+    await _query(conn, "DEFINE FIELD name ON fi TYPE int")
+    rows = [{"id": "1", "name": "not-an-int"}]
+    app = _hardened_app(ns, db, "fi", lambda t: [t.declare_record(row=r) for r in rows])
+
+    with pytest.raises(Exception, match="name"):
+        await app.update()
+    assert await _query_table(conn, "fi") == []
+
+    # Same data, schema fixed: must be retried, not skipped as "already applied".
+    await _query(conn, "DEFINE FIELD OVERWRITE name ON fi TYPE string")
+    await app.update()
+    assert [r["name"] for r in await _query_table(conn, "fi")] == ["not-an-int"]
+
+
+@requires_
```

---

### Incident Patch 10: `f1c1ba4a` (2026-09-24)
**Commit Message**: fix(valkey): purge document hashes when an index is deleted (#2419)

The index sink dropped the index on "delete" but only purged the
`{index_name}:` document hashes on "replace". Documents are child target
states of the index, and the engine does not reconcile children once
their container is reconciled to non-existence, so un-declaring an index
or running `App.drop()` left every document hash behind.

Purge the prefix keys on "delete" as well, and cover both un-declaring
the index and `App.drop()` in the connector tests.

Co-authored-by: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `python/cocoindex/connectors/valkey/_target.py` (modified, +6/-4)
```diff
@@ -405,16 +405,18 @@ async def _apply_actions(
                 action = actions[i]
 
                 if action.main_action in ("replace", "delete"):
-                    # Drop the index first; on "replace" we also purge all
-                    # prefixed document keys before re-creating the index.
+                    # Drop the index, then purge the document hashes under its
+                    # prefix. Once the index is reconciled away the engine no
+                    # longer reconciles its documents, so this action owns
+                    # their removal; on "replace" the index is re-created
+                    # below and the documents are re-declared from scratch.
                     try:
                         await ft.dropindex(client, key.index_name)
                     except RequestError:
                         # Index was already removed externally — nothing to do.
                         logger.debug("dropindex %s: index not found", key.index_name)
 
-                    if action.main_action == "replace":
-                        await self._delete_prefix_keys(client, key.index_name)
+                    await self._delete_prefix_keys(client, key.index_name)
 
                 if coco.is_non_existence(action.spec):
                     continue
```

**File**: `python/tests/connectors/test_valkey_target.py` (modified, +59/-9)
```diff
@@ -75,6 +75,12 @@ def _decode_vector(blob: bytes, dim: int) -> list[float]:
     return list(struct.unpack(f"<{dim}f", blob))
 
 
+async def _index_names(client: Any) -> set[str]:
+    """Return the names of all search indexes on the server."""
+    names = await glide_ft.list(client)
+    return {n.decode() if isinstance(n, bytes) else n for n in names}
+
+
 async def _wait_for_index_count(
     client: Any,
     index_name: str,
@@ -662,7 +668,7 @@ async def declare_fn() -> None:
 @requires_server
 @pytest.mark.asyncio
 async def test_drop_index_when_not_declared(valkey_env: _ValkeyEnv) -> None:
-    """Test that index is dropped when no longer declared."""
+    """Un-declaring the index drops it together with its document hashes."""
     index_name = _unique_name("test_drop")
     source_docs: list[valkey.Document] = []
     declare_index = True
@@ -687,21 +693,65 @@ async def declare_fn() -> None:
         declare_fn,
     )
 
-    source_docs.append(valkey.Document(id="d1", vector=_make_vector(_DIM, 1.0)))
+    source_docs.extend(
+        [
+            valkey.Document(id="d1", vector=_make_vector(_DIM, 1.0)),
+            valkey.Document(id="d2", vector=_make_vector(_DIM, 2.0)),
+        ]
+    )
     await app.update()
 
-    info = await glide_ft.info(valkey_env.client, index_name)
-    assert info is not None
+    client = valkey_env.client
+    hash_keys = [f"{index_name}:d1", f"{index_name}:d2"]
+    assert index_name in await _index_names(client)
+    assert await client.exists(hash_keys) == 2
 
     declare_index = False
     source_docs.clear()
     await app.update()
 
-    try:
-        await glide_ft.info(valkey_env.client, index_name)
-        pytest.fail("Index should have been dropped")
-    except Exception:
-        pass
+    assert index_name not in await _index_names(client)
+    assert await client.exists(hash_keys) == 0
+
+
+@requires_glide
+@requires_server
+@pytest.mark.asyncio
+async def test_app_drop_removes_index_and_documents(valkey_env: _ValkeyEnv) -> None:
+    """``App.drop()`` removes the index together with its document hashes."""
+    index_name = _unique_name("test_app_drop")
+
+    async def declare_fn() -> None:
+        index = await coco.use_mount(
+            coco.component_subpath("setup", "index"),
+            valkey.declare_index_target,
+            _VALKEY_DB_KEY,
+            index_name,
+            await valkey.IndexSchema.create(
+                vectors=valkey.VectorDef(schema=_VECTOR_SCHEMA, distance="cosine"),
+            ),
+        )
+        for doc in (
+            valkey.Document(id="d1", vector=_make_vector(_DIM, 1.0)),
+            valkey.Document(id="d2", vector=_make_vector(_DIM, 2.0)),
+        ):
+            index.declare_document(doc)
+
+    app = coco.App(
+        coco.AppConfig(name="test_app_drop", environment=valkey_env.coco_env),
+        declare_fn,
+    )
+    await app.update()
+
+    client = valkey_env.client
+    hash_keys = [f"{index_name}:d1", f"{index_name}:d2"]
+    assert index_name in await _index_names(client)
+    assert await client.exists(hash_keys) == 2
+
+    await app.drop()
+
+    assert index_name not in await _index_names(client)
+    assert await client.exists(hash_keys) == 0
 
 
 @requires_glide
```

---

### Incident Patch 11: `b7e1f596` (2026-09-20)
**Commit Message**: fix(state_store): keep each LMDB write txn on one OS thread (#2426)

LMDB ties a write transaction to the OS thread that began it: on Linux the
writer lock is a thread-owned robust pthread mutex, and LMDB ignores a
failed unlock. `TxnRunner` opened the write txn and then awaited the batched
bodies inside a task on the multi-thread runtime, so a body that really
suspended could let work-stealing resume the task on another worker. The
commit then released the lock from the wrong thread, the release failed
silently, and every later write txn blocked forever (#2424). heed marks
`RwTxn` as `Send`, so the compiler doesn't catch it (meilisearch/heed#339).

Run the whole batch - opening the txn, every body, the MDB_MAP_FULL retry
loop, and the commit or abort - inside one `spawn_blocking` closure, with
`Handle::block_on` polling the bodies on that thread. This also moves the
blocking writer-lock wait and the commit fsync off the runtime workers.

`TxnBody` no longer needs `Sync`: that was only required because the old
future held `&[TxnBody]` across awaits and had to be `Send`.

Fixes #2424

Co-authored-by: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `AGENTS.md` (modified, +1/-0)
```diff
@@ -300,6 +300,7 @@ async def pool(pg_dsn: str) -> Any:
 - All LMDB writes must go through `Storage::run_txn` (uses the single-writer batcher).
 - Do not open a heed write txn directly or wrap the env in a separate mutex/semaphore — bypassing the batcher loses fsync coalescing and regresses concurrent-submit throughput by 10-100×.
 - LMDB has no savepoints. If a sub-operation needs to "abort," handle it at the body level (e.g. return a sentinel result without writing); never attempt per-body rollback inside the batcher.
+- An LMDB write txn must begin and end (commit or abort) on the same OS thread: the writer lock is thread-owned and LMDB ignores a failed release, so a txn that migrates between runtime workers blocks every later writer for good. heed marks `RwTxn` as `Send` regardless, so the compiler won't catch it. `Storage::run_txn` runs each batch on one blocking thread for this reason; never hold a write txn across an `.await` on the multi-thread runtime.
 
 ### Sync vs Async
 
```

**File**: `rust/core/src/state_store/storage.rs` (modified, +99/-15)
```diff
@@ -129,20 +129,16 @@ struct StorageInner {
 /// future that runs against the shared `WriteTxn` and resolves to a boxed
 /// output. The future is bound to the borrow of the txn (`'a`).
 ///
-/// `Fn + Sync` (not `FnOnce`) so the batcher can retry the entire batch on
+/// `Fn` (not `FnOnce`) so the batcher can retry the entire batch on
 /// `MDB_MAP_FULL`: the env is resized between attempts, then every body is
 /// called again with a fresh write transaction. Callers must therefore
 /// ensure their closures are side-effect–free on the captured state (i.e.
 /// they may be invoked more than once). In practice all callers clone `Arc`
 /// handles inside the closure and do not move-out of captures, so this is
 /// already satisfied.
-///
-/// `Sync` is required because `try_run_once` holds `&[TxnBody]` across
-/// `await` points; for `&T` to be `Send`, `T` must be `Sync`.
 type TxnBody = Box<
     dyn for<'a, 'env> Fn(&'a mut WriteTxn<'env>) -> BoxFuture<'a, Result<Box<dyn Any + Send>>>
-        + Send
-        + Sync,
+        + Send,
 >;
 
 /// Returns `true` if `err` is an LMDB `MDB_MAP_FULL` error.
@@ -165,12 +161,28 @@ fn is_map_full(err: &Error) -> bool {
 /// Safety: `resize` is only called while holding the coordinator write guard,
 /// which guarantees no read or write LMDB transaction opened through this
 /// coordinator is active in the current process.
+#[derive(Clone)]
 struct TxnRunner {
     db_env: heed::Env<heed::WithoutTls>,
     coord: Arc<tokio::sync::RwLock<()>>,
 }
 
 impl TxnRunner {
+    /// Runs `inputs` in one write txn, resizing the map and retrying the whole
+    /// batch on `MDB_MAP_FULL`. Must be polled on a single OS thread from start
+    /// to finish — see [`Runner::run`].
+    async fn run_with_resize_retry(&self, inputs: &[TxnBody]) -> Result<Vec<Box<dyn Any + Send>>> {
+        loop {
+            match self.try_run_once(inputs).await {
+                Ok(outputs) => return Ok(outputs),
+                Err(e) if is_map_full(&e) => {
+                    self.resize_on_map_full().await?;
+                }
+                Err(e) => return Err(e),
+            }
+        }
+    }
+
     /// Attempts one write-txn pass over `inputs`. If any body or the final
     /// commit returns an error the write txn and coordinator read guard are
     /// dropped before the error propagates. On `MapFull` the caller should
@@ -219,19 +231,26 @@ impl Runner for TxnRunner {
     type Input = TxnBody;
     type Output = Box<dyn Any + Send>;
 
+    /// LMDB ties a write transaction to the OS thread that began it: only that
+    /// thread can release the writer lock, and LMDB ignores a failed release.
+    /// A write txn that begins on one runtime worker and commits or aborts on
+    /// another — which work-stealing allows at any `.await` that suspends —
+    /// leaves the lock held for good and blocks every later writer.
+    ///
+    /// So the whole batch runs on one blocking-pool thread, where `block_on`
+    /// polls the bodies instead of the runtime's workers.
     async fn run(
         &self,
         inputs: Vec<TxnBody>,
     ) -> Result<impl ExactSizeIterator<Item = Box<dyn Any + Send>>> {
-        loop {
-            match self.try_run_once(&inputs).await {
-                Ok(outputs) => return Ok(outputs.into_iter()),
-                Err(e) if is_map_full(&e) => {
-                    self.resize_on_map_full().await?;
-                }
-                Err(e) => return Err(e),
-            }
-        }
+        let runner = self.clone();
+        let runtime = tokio::runtime::Handle::current();
+        let span = Span::current();
+        let outputs = tokio::task::spawn_blocking(move || {
+            runtime.block_on(runner.run_with_resize_retry(&inputs).instrument(span))
+        })
+        .await??;
+        Ok(outputs.into_iter())
     }
 }
 
@@ -346,6 +365,11 @@ impl Storage {
     /// dropped without committing) and every caller in the batch receives
     /// an error.
     ///
+    /// A batch — opening the txn, every body, the commit or rollback — runs on
+    /// one blocking-pool thread, because LMDB requires a write txn to begin
+    /// and end on the same OS thread. The writer lock is held throughout, so
+    /// a body should only await work that belongs inside the txn.
+    ///
     /// The future must be boxed (`BoxFuture<'a, _>` = `Pin<Box<dyn Future +
     /// Send + 'a>>`) because stable Rust can't yet express a `Send` bound on
     /// the future returned by an `AsyncFnOnce` borrowing from the txn.
@@ -829,4 +853,64 @@ mod tests {
             );
         }
     }
+
+    /// Regression test for #2424. LMDB's writer lock belongs to the OS thread
+    /// that began the write txn; on Linux a release from any other thread
+    /// fails silently and wedges every later writer. A body that really
+    /// suspends lets a multi-thread runtime resume its task on another
+    /// worker, so the runner has to keep the whole txn on one thread.
+    #[test
```

---

### Incident Patch 12: `23e0e072` (2026-09-17)
**Commit Message**: fix(engine): reuse a same-operation memo under full_reprocess too (#2414)

#2412 made a run queued on a component's build permit reuse the memo a
concurrent same-key run had just stored, instead of executing the body
again. It did not apply under `full_reprocess`, where every memo lookup
short-circuited to a miss, so two concurrent runs of one memoized
component still both executed there.

`full_reprocess` must ignore memos left by previous runs, not this
operation's own execution — and the store cannot tell those apart, so the
engine now can: every processor context carries the generation of the
operation it belongs to (minted for a parentless context, the root of an
`App::update` / `App::drop_app` or a live component's own cycle; children
inherit), and a component records, after a successful store under the
permit, which operation stored which key. A queued run re-checks the memo
when the recorded key is its own; under `full_reprocess` only when the
recorded generation is its own operation's. The fast-path skip under
`full_reprocess` moves from the lookup helper to `execute_once`, where
the decision lives. Recording at store time (not run start) also means a
failed or cancelled r

**File**: `rust/core/src/engine/component.rs` (modified, +212/-38)
```diff
@@ -119,10 +119,12 @@ struct ComponentInner<Prof: EngineProfile> {
     /// runs never overlap, and the memo one run stores is in place before the
     /// next decides whether to execute its body.
     build_semaphore: tokio::sync::Semaphore,
-    /// Memo key of the latest run that executed under `build_semaphore`. A run
+    /// The memo most recently stored under `build_semaphore`, if any. A run
     /// that finds its own key here on acquiring the permit knows a same-key
-    /// run just completed, and re-checks the memo instead of executing again.
-    last_memo_fp: Mutex<Option<Fingerprint>>,
+    /// run just completed and stored its result, so it re-checks the memo
+    /// instead of executing again — under `full_reprocess` only when that run
+    /// belonged to the same operation (see `execute_once`).
+    last_stored_memo: Mutex<Option<StoredMemo>>,
 
     /// Identity registry of child components, keyed by their full StablePath,
     /// so a re-mount of a path whose component is still referenced shares the
@@ -573,6 +575,14 @@ struct ComponentBuildOutput<Prof: EngineProfile> {
     built_target_states_providers: TargetStateProviderRegistry<Prof>,
 }
 
+/// A memo stored by a run of a component under its `build_semaphore`: the
+/// operation that stored it and the key it was stored under.
+#[derive(Clone, Copy)]
+struct StoredMemo {
+    operation_generation: u64,
+    memo_fp: Fingerprint,
+}
+
 /// Result of looking up a component's memo for the processor about to run.
 enum MemoLookup<Prof: EngineProfile> {
     /// A valid memo stands in for a run: report the stored run's outcome and
@@ -665,7 +675,7 @@ impl<Prof: EngineProfile> Component<Prof> {
                 stable_path,
                 parent,
                 build_semaphore: tokio::sync::Semaphore::const_new(1),
-                last_memo_fp: Mutex::new(None),
+                last_stored_memo: Mutex::new(None),
                 active_children: parking_lot::Mutex::new(HashMap::new()),
                 live_state: parking_lot::Mutex::new(None),
                 active_ops: std::sync::atomic::AtomicUsize::new(0),
@@ -1106,16 +1116,21 @@ impl<Prof: EngineProfile> Component<Prof> {
 
             // Fast-path: component memoization check does not require acquiring the build permit.
             // If it hits, we can immediately return without processing/submitting/waiting.
-            match lookup_component_memo(processor_context, processor, memo_fp_to_store).await? {
-                MemoLookup::Reuse(outcome, output) => {
-                    processing_stats.update(processor_name, |stats| {
-                        stats.num_execution_starts += 1;
-                        stats.num_unchanged += 1;
-                    });
-                    return Ok((outcome, Some(output)));
-                }
-                MemoLookup::Miss { revalidated_states } => {
-                    memo_states_for_store = revalidated_states;
+            // Under `full_reprocess` a stored memo may only be reused when this very
+            // operation stored it, which only the permit-holding re-check below can
+            // tell, so the fast-path is skipped.
+            if !processor_context.full_reprocess() {
+                match lookup_component_memo(processor_context, processor, memo_fp_to_store).await? {
+                    MemoLookup::Reuse(outcome, output) => {
+                        processing_stats.update(processor_name, |stats| {
+                            stats.num_execution_starts += 1;
+                            stats.num_unchanged += 1;
+                        });
+                        return Ok((outcome, Some(output)));
+                    }
+                    MemoLookup::Miss { revalidated_states } => {
+                        memo_states_for_store = revalidated_states;
+                    }
                 }
             }
 
@@ -1139,10 +1154,17 @@ impl<Prof: EngineProfile> Component<Prof> {
                 // this one waited for it — e.g. two `App::update` calls on one
                 // app that both missed the fast-path above before either had
                 // stored a memo. Re-check the memo now; a failed run stores
-                // none, so a miss falls through to executing.
+                // none (and records none), so a miss falls through to
+                // executing. Under `full_reprocess` only a memo stored by this
+                // same operation qualifies: that is the operation's own
+                // execution of the component, not a cache from a previous run.
+                let last_stored_memo = *self.inner.last_stored_memo.lock().unwrap();
                 if let Some(processor) = processor
-                    && memo_fp_to_store.is_some()
-                    && *self.inner.last_memo_fp.lock().unwrap() == memo_fp_to_store
+                    && let Some(memo_fp) = memo_fp_to_store
+                    && let Some(stored) = last_stored_memo
+                    && stored.mem
```

**File**: `rust/core/src/engine/context.rs` (modified, +32/-0)
```diff
@@ -38,6 +38,9 @@ struct AppContextInner<Prof: EngineProfile> {
     app_reg: AppRegistration<Prof>,
     id_sequencer_manager: IdSequencerManager,
     inflight_semaphore: Option<Arc<tokio::sync::Semaphore>>,
+    /// Source of operation generations; see
+    /// [`ComponentProcessorContext::operation_generation`].
+    operation_generation: std::sync::atomic::AtomicU64,
     /// Cancellation token for in-flight app operations. Wrapped in a `Mutex` so
     /// it can be replaced with a fresh child of the global token after a
     /// previous cancellation (e.g. after `App::drop_app` finishes), allowing
@@ -78,6 +81,7 @@ impl<Prof: EngineProfile> AppContext<Prof> {
                 app_reg,
                 id_sequencer_manager: IdSequencerManager::new(),
                 inflight_semaphore,
+                operation_generation: std::sync::atomic::AtomicU64::new(0),
                 cancellation_token: std::sync::Mutex::new(
                     crate::engine::runtime::global_cancellation_token().child_token(),
                 ),
@@ -137,6 +141,15 @@ impl<Prof: EngineProfile> AppContext<Prof> {
         self.inner.inflight_semaphore.as_ref()
     }
 
+    /// Mint the generation of a new operation; see
+    /// [`ComponentProcessorContext::operation_generation`].
+    fn next_operation_generation(&self) -> u64 {
+        self.inner
+            .operation_generation
+            .fetch_add(1, std::sync::atomic::Ordering::Relaxed)
+            + 1
+    }
+
     /// Returns a clone of the current app-level cancellation token.
     ///
     /// The clone stays valid even if the slot is later refreshed via
@@ -685,6 +698,8 @@ struct ComponentProcessorContextInner<Prof: EngineProfile> {
     component: Component<Prof>,
     parent_context: Option<ComponentProcessorContext<Prof>>,
     processing_action: ComponentProcessingAction<Prof>,
+    /// See [`ComponentProcessorContext::operation_generation`].
+    operation_generation: u64,
 
     inflight_permit: Mutex<Option<tokio::sync::OwnedSemaphorePermit>>,
 
@@ -726,11 +741,16 @@ impl<Prof: EngineProfile> ComponentProcessorContext<Prof> {
         host_ctx: Arc<Prof::HostCtx>,
         processing_action: ComponentProcessingAction<Prof>,
     ) -> Self {
+        let operation_generation = match &parent_context {
+            Some(parent) => parent.operation_generation(),
+            None => component.app_ctx().next_operation_generation(),
+        };
         Self {
             inner: Arc::new(ComponentProcessorContextInner {
                 component,
                 parent_context,
                 processing_action,
+                operation_generation,
                 inflight_permit: Mutex::new(None),
                 logic_deps: Mutex::new(HashSet::new()),
                 target_provider_deps: Mutex::new(TargetProviderDeps::new()),
@@ -1034,6 +1054,18 @@ impl<Prof: EngineProfile> ComponentProcessorContext<Prof> {
         }
     }
 
+    /// Generation of the operation this context belongs to. A context created
+    /// without a parent — the root of an `App::update` or `App::drop_app`, or
+    /// a live component's own cycle — starts a new operation; children inherit
+    /// their parent's. So two runs of one component share a generation exactly
+    /// when the same operation started both, which is how `full_reprocess`
+    /// tells a memo stored earlier in the same operation (that operation's own
+    /// execution) from one left behind by a previous run (a cache it must
+    /// ignore). See `Component::execute_once`.
+    pub(crate) fn operation_generation(&self) -> u64 {
+        self.inner.operation_generation
+    }
+
     pub fn preview(&self) -> bool {
         match &self.inner.processing_action {
             ComponentProcessingAction::Build(build_ctx) => build_ctx.preview_collector.is_some(),
```

**File**: `rust/core/src/engine/execution.rs` (modified, +4/-5)
```diff
@@ -80,6 +80,10 @@ pub(crate) fn serialize_context_memo_states<Prof: EngineProfile>(
         .collect()
 }
 
+/// Read the component's stored memo and return it when it was stored under
+/// `processor_fp` and its logic and target-provider dependencies still hold;
+/// otherwise delete it. Whether a stored memo may be consulted at all under
+/// `full_reprocess` is the caller's decision (see `Component::execute_once`).
 pub(crate) async fn use_or_invalidate_component_memoization<Prof: EngineProfile>(
     comp_ctx: &ComponentProcessorContext<Prof>,
     processor_fp: Option<Fingerprint>,
@@ -91,11 +95,6 @@ pub(crate) async fn use_or_invalidate_component_memoization<Prof: EngineProfile>
         TargetProviderDeps,
     )>,
 > {
-    // Short-circuit to miss under full_reprocess
-    if comp_ctx.full_reprocess() {
-        return Ok(None);
-    }
-
     let app_store = comp_ctx.app_ctx().app_store();
     let path = comp_ctx.stable_path();
     {
```

---

### Incident Patch 13: `63d0869d` (2026-09-13)
**Commit Message**: fix(engine): reuse a concurrent same-key run's memo instead of re-executing (#2412)

* fix(engine): reuse a concurrent same-key run's memo instead of re-executing

Two runs of one component with the same memo key that start before either
has stored a memo both executed the body: the memo fast-path runs before the
build permit is acquired, and the memo was stored after the permit was
released, so the run queued on the permit found nothing to reuse and ran the
body again. Reachable as two concurrent `App::update` calls on one app (and,
in cocoindex-plus, as two owners mounting the same shared component on a
cold build).

`execute_once` now holds the build permit through the memo store, and a run
that finds `last_memo_fp` equal to its own key on acquiring the permit
re-checks the memo — the previous same-key run's store is complete by then —
and reuses it (counted as `num_unchanged`) instead of executing. A failed run
stores no memo, so the re-check misses and the queued run executes as
before. The memo lookup + state validation shared by the fast-path and the
re-check is factored into `lookup_component_memo`; the store-time
`last_memo_fp` comparison is gone because no other run can s

**File**: `rust/core/src/engine/component.rs` (modified, +309/-157)
```diff
@@ -114,8 +114,14 @@ struct ComponentInner<Prof: EngineProfile> {
     /// this child's Weak entry from the parent's active_children.
     parent: Option<Component<Prof>>,
 
-    /// Semaphore to ensure `process()` and `commit_effects()` calls cannot happen in parallel.
+    /// Serializes runs of this component. A run holds the permit from before
+    /// its body starts until its memo is stored (see `execute_once`), so two
+    /// runs never overlap, and the memo one run stores is in place before the
+    /// next decides whether to execute its body.
     build_semaphore: tokio::sync::Semaphore,
+    /// Memo key of the latest run that executed under `build_semaphore`. A run
+    /// that finds its own key here on acquiring the permit knows a same-key
+    /// run just completed, and re-checks the memo instead of executing again.
     last_memo_fp: Mutex<Option<Fingerprint>>,
 
     /// Identity registry of child components, keyed by their full StablePath,
@@ -569,6 +575,86 @@ struct ComponentBuildOutput<Prof: EngineProfile> {
     built_target_states_providers: TargetStateProviderRegistry<Prof>,
 }
 
+/// Result of looking up a component's memo for the processor about to run.
+enum MemoLookup<Prof: EngineProfile> {
+    /// A valid memo stands in for a run: report the stored run's outcome and
+    /// output.
+    Reuse(ComponentRunOutcome, ComponentBuildOutput<Prof>),
+    /// No usable memo. `revalidated_states` is `Some` when a memo matched the
+    /// key but its memo states no longer validate: the states collected during
+    /// validation are then stored with the new memo, instead of being
+    /// collected again once the body has run.
+    Miss {
+        revalidated_states: Option<MemoStatesPayload<Prof>>,
+    },
+}
+
+/// How the permit-guarded part of `execute_once` ended.
+enum GuardedRun<Prof: EngineProfile> {
+    /// The body did not run: a run with the same memo key completed under the
+    /// permit while this one waited for it, and its memo was reused.
+    Reused(ComponentRunOutcome, ComponentBuildOutput<Prof>),
+    /// The body ran (build mode), or the component was deleted (delete mode).
+    Executed {
+        children_outcome: ComponentRunOutcome,
+        build_output: Option<ComponentBuildOutput<Prof>>,
+        touched_previous_states: bool,
+    },
+}
+
+/// Look up the memo stored for `comp_ctx`'s component and, when `processor`
+/// has a memo state handler, validate the stored memo states through it. A
+/// stored memo whose key is not `memo_fp` — or any stored memo, when the
+/// processor is not memoized (`memo_fp` is `None`) — is invalidated. A failure
+/// to read or decode the memo is logged and counts as a miss; a failure in the
+/// state handler propagates.
+async fn lookup_component_memo<Prof: EngineProfile>(
+    comp_ctx: &ComponentProcessorContext<Prof>,
+    processor: &Prof::ComponentProc,
+    memo_fp: Option<Fingerprint>,
+) -> Result<MemoLookup<Prof>> {
+    let memo = match use_or_invalidate_component_memoization(comp_ctx, memo_fp).await {
+        Ok(memo) => memo,
+        Err(err) => {
+            error!("component memoization restore failed: {err:?}");
+            None
+        }
+    };
+    let Some((ret, memo_states, stored_logic_deps, stored_provider_deps)) = memo else {
+        return Ok(MemoLookup::Miss {
+            revalidated_states: None,
+        });
+    };
+    if processor.has_memo_state_handler() && !memo_states.is_empty() {
+        let fut = processor.handle_memo_states(
+            comp_ctx.app_ctx().env().host_runtime_ctx(),
+            comp_ctx,
+            Some(memo_states),
+        )?;
+        let (new_states, can_reuse, states_changed) = fut.await?;
+        if !can_reuse {
+            return Ok(MemoLookup::Miss {
+                revalidated_states: Some(new_states),
+            });
+        }
+        // Reusable, but the states themselves moved (e.g. an mtime changed
+        // while the content hash did not): refresh them in the stored memo.
+        if states_changed {
+            update_component_memo_states(comp_ctx, &new_states).await?;
+        }
+    }
+    // Report the stored dependency sets upward even on a memo hit, so a
+    // mounting parent's memo depends on this whole subtree (see
+    // `merge_logic_deps` in `execute_once`).
+    Ok(MemoLookup::Reuse(
+        ComponentRunOutcome::reused(stored_logic_deps, stored_provider_deps),
+        ComponentBuildOutput {
+            ret,
+            built_target_states_providers: Default::default(),
+        },
+    ))
+}
+
 impl<Prof: EngineProfile> Component<Prof> {
     pub(crate) fn new(
         app_ctx: AppContext<Prof>,
@@ -1022,158 +1108,130 @@ impl<Prof: EngineProfile> Component<Prof> {
 
             // Fast-path: component memoization check does not require acquiring the build permit.
             // If it hits, we can immediately return without processing/submitting/waiting.
-
-            match use_or_invalidate_component_memoization(pr
```

---

### Incident Patch 14: `6cf29b84` (2026-09-13)
**Commit Message**: fix: preserve typed Python exceptions in component exception handlers (#2383)

* fix: preserve typed Python exceptions in component exception handlers

Closes #2380.

- build_on_error converts the engine error with cerror_to_pyerr and passes
  the resulting exception object to the handler callback instead of a
  formatted string. A raising handler's error propagates as-is, so
  handle.ready() re-raises it with its Python type intact.
- Tunneled Python exceptions pass through unchanged, the same as use_mount
  and handle.ready() already do; engine-native failures map to the usual
  Python types.
- resolve_exception_handler and report_exception take BaseException; the
  no-handler fallback logs the exception summary in the message and the
  traceback via exc_info.
- Docs describe the exception semantics; tests updated and extended.

* fix: never route CancelledError through the exception handler chain

asyncio.CancelledError is a BaseException, so cancellation raised while a
handler was awaited fell into the handler-failure branch and was handed to
the next outer handler, which could swallow it. Re-raise it immediately
instead. Handlers now only ever see real failures, matching the d

**File**: `docs/src/content/docs/advanced_topics/exception_handlers.mdx` (modified, +24/-1)
```diff
@@ -144,6 +144,29 @@ ExceptionHandler = Callable[
 ]
 ```
 
+### What `exc` is
+
+Handlers receive the same exception object that a foreground call such as `await coco.use_mount(...)` would raise for the same failure:
+
+- **Python-originated failures** (your component, or a target connector, raised) arrive as the original exception. `type(exc)` is what was raised, `exc.__traceback__` is intact, and `exc.__cause__` / `exc.__context__` are preserved. Route by type with `isinstance`; render the traceback with `traceback.format_exception(exc)` or `logger.error(..., exc_info=exc)`.
+- **Engine-native failures** map to Python types: client-side misuse becomes `ValueError`, cooperative deadline expiry becomes `coco.DeadlineExceededError`, and internal engine errors become `RuntimeError`. The engine never delivers cancellation of the component itself to handlers.
+
+An exception raised by a handler keeps its type as well: `await handle.ready()` raises exactly what the last handler in the chain raised, so `except MyDeadLetterError:` or `except coco.DeadlineExceededError:` work as expected on the awaiting side.
+
+Earlier releases handed every component failure to handlers as a `RuntimeError` whose message embedded the formatted traceback, and re-wrapped handler-raised exceptions the same way. A handler that checked `isinstance(exc, RuntimeError)` or parsed `str(exc)` for the traceback should switch to the checks above.
+
+```python
+import traceback
+
+def on_error(exc: BaseException, ctx: coco.ExceptionContext) -> None:
+    if isinstance(exc, ConnectionError):
+        schedule_retry(ctx.stable_path)  # transient: swallow, retry later
+    elif isinstance(exc, ValueError):
+        dead_letter(ctx.stable_path, "".join(traceback.format_exception(exc)))
+    else:
+        raise exc  # propagate through handle.ready()
+```
+
 ### `ExceptionContext` fields
 
 Your handler receives an `ExceptionContext` dataclass with information about the failure:
@@ -165,7 +188,7 @@ Handlers are stacked: the most specific (innermost) handler runs first.
 
 If the innermost handler raises an exception, the next outer handler is called with that new exception. In this case `ctx.source` is `"handler"` and `ctx.original_exception` holds the original component error.
 
-This continues up the stack. If all handlers raise (or no handler is registered), CocoIndex falls back to the built-in behavior: logging the error at `ERROR` level, with no crash.
+This continues up the stack. If every handler raises, the last handler's exception propagates through `handle.ready()` (see [How to opt into propagation](#how-to-opt-into-propagation)). If no handler is registered, CocoIndex falls back to the built-in behavior: logging the error at `ERROR` level, with no crash.
 
 ```python
 @coco.lifespan
```

**File**: `python/cocoindex/_internal/api.py` (modified, +3/-3)
```diff
@@ -805,9 +805,9 @@ def use_state(
 
     The value is serialized lazily, once, when the component commits — not at
     assignment. Two consequences: (1) if the value is not serializable, the
-    error surfaces at commit (identifying the state key) rather than at the
-    `handle.value = ...` line; (2) the persisted value reflects the object as it
-    is at commit, so mutating it in place after assignment is captured.
+    error surfaces at commit rather than at the `handle.value = ...` line;
+    (2) the persisted value reflects the object as it is at commit, so
+    mutating it in place after assignment is captured.
 
     Args:
         key: Unique StableKey within this component (None, bool, int, str,
```

**File**: `python/cocoindex/_internal/component_ctx.py` (modified, +16/-6)
```diff
@@ -1,5 +1,6 @@
 from __future__ import annotations
 
+import asyncio
 import contextlib
 import inspect
 import logging
@@ -132,10 +133,15 @@ def resolve_exception_handler(
         stable_path: str,
         processor_name: str | None,
         mount_kind: MountKind,
-    ) -> Callable[[str], Awaitable[None]]:
+    ) -> Callable[[BaseException], Awaitable[None]]:
         """Build the exception-handler resolver for a child mounted under this context.
 
-        Returns a callable that takes a stringified error and:
+        Returns a callable that takes the failure as a Python exception
+        (a Python-originated failure arrives as its original exception
+        object with traceback intact; engine-native failures arrive as
+        ``RuntimeError`` / ``ValueError`` / ``DeadlineExceededError``, the
+        same mapping ``use_mount`` uses; the engine filters cancellation
+        before calling this) and:
         - walks this context's handler chain (innermost first);
         - if a handler raises, calls the next outer handler with the
           new exception;
@@ -158,18 +164,18 @@ def resolve_exception_handler(
         # captured implicitly. `self._core_path.to_string()` in particular
         # is a PyO3 → Rust → string allocation we don't want to pay on
         # every mount.
-        async def _run(err_str: str) -> None:
+        async def _run(exc: BaseException) -> None:
             node = self._exception_handler_chain
             if node is None:
                 # No handlers registered — log directly without building
                 # the ExceptionContext metadata at all. Don't propagate.
-                _logger.error("component build failed:\n%s", err_str)
+                _logger.error("component build failed: %s", exc, exc_info=exc)
                 return
 
             env_name = self._env.name
             parent_stable_path = self._core_path.to_string()
-            original_exc: BaseException = RuntimeError(err_str)
-            current_exc: BaseException = original_exc
+            original_exc = exc
+            current_exc = exc
             source: Literal["component", "handler"] = "component"
             while node is not None:
                 ctx = ExceptionContext(
@@ -187,6 +193,10 @@ async def _run(err_str: str) -> None:
                     if inspect.isawaitable(ret):
                         await ret
                     return  # Handler swallowed → don't propagate.
+                except asyncio.CancelledError:
+                    # Cancellation is not a handler failure: never feed it
+                    # to outer handlers (which could swallow it).
+                    raise
                 except BaseException as handler_exc:
                     current_exc = handler_exc
                     source = "handler"
```

**File**: `python/cocoindex/_internal/core.pyi` (modified, +4/-4)
```diff
@@ -349,18 +349,18 @@ class LiveComponentController:
     def update_full_async(
         self,
         processor: ComponentProcessor[Any],
-        handler_callback: Callable[[str], Awaitable[None]] | None = None,
+        handler_callback: Callable[[BaseException], Awaitable[None]] | None = None,
     ) -> Coroutine[Any, Any, None]: ...
     def update_async(
         self,
         stable_path: StablePath,
         processor: ComponentProcessor[Any],
-        handler_callback: Callable[[str], Awaitable[None]] | None = None,
+        handler_callback: Callable[[BaseException], Awaitable[None]] | None = None,
     ) -> Coroutine[Any, Any, ComponentMountHandle]: ...
     def delete_async(
         self,
         stable_path: StablePath,
-        handler_callback: Callable[[str], Awaitable[None]] | None = None,
+        handler_callback: Callable[[BaseException], Awaitable[None]] | None = None,
     ) -> Coroutine[Any, Any, ComponentMountHandle]: ...
     def mark_ready_async(self) -> Coroutine[Any, Any, None]: ...
     def read_committed_state_async(
@@ -430,7 +430,7 @@ async def mount_async(
     stable_path: StablePath,
     comp_ctx: ComponentProcessorContext,
     fn_ctx: FnCallContext,
-    handler_callback: Any | None = None,
+    handler_callback: Callable[[BaseException], Awaitable[None]] | None = None,
 ) -> ComponentMountHandle: ...
 async def use_mount_async(
     processor: ComponentProcessor[T_co],
```

**File**: `python/cocoindex/_internal/live_component.py` (modified, +16/-16)
```diff
@@ -3,7 +3,6 @@
 import asyncio
 import datetime
 import inspect
-import traceback
 from collections.abc import AsyncIterator
 from contextvars import ContextVar
 from typing import (
@@ -271,15 +270,17 @@ def _require_controller(self) -> core.LiveComponentController:
             )
         return ctrl
 
-    def _resolve_exception_handler(self) -> Callable[[str], Awaitable[None]]:
+    def _resolve_exception_handler(
+        self,
+    ) -> Callable[[BaseException], Awaitable[None]]:
         """Build a resolver for the parent's exception handler chain.
 
         Delegates to :meth:`ComponentContext.resolve_exception_handler`
         — the same path used by ``coco.mount`` / ``coco.mount_each`` —
         so component-failure logs go through one canonical Python
         fallback. Always non-None. Used both by :meth:`update_full`
         (passes to Rust as ``on_error``) and :meth:`report_exception`
-        (invokes directly with a stringified exception).
+        (invokes directly with the reported exception).
         """
         return get_context_from_ctx().resolve_exception_handler(
             stable_path=self._path.to_string(),
@@ -450,20 +451,19 @@ async def report_exception(self, exc: BaseException) -> None:
         cycle failures from initial build failures (``"mount"`` /
         ``"mount_each"``).
 
-        The exception is formatted via :func:`traceback.format_exception`
-        so handlers and the fallback log both see the full Python
-        traceback (when ``exc.__traceback__`` is set — i.e. when the
-        caller is reporting a caught exception). This matches the
-        text-with-trace shape that the Rust-side ``on_error`` path
-        produces for background ``mount`` / ``mount_each`` failures.
-
-        Falls back to ERROR-level logging if no handler is registered or
-        every handler re-raises. Intended for surfacing recoverable errors
-        (e.g. an external watcher emits a malformed event) without
-        tearing down the live component.
+        Handlers receive ``exc`` itself, so they can route by type and
+        recover the traceback via :func:`traceback.format_exception` (when
+        ``exc.__traceback__`` is set, i.e. when the caller is reporting a
+        caught exception). This matches what the Rust-side ``on_error``
+        path delivers for background ``mount`` / ``mount_each`` failures.
+
+        Falls back to ERROR-level logging if no handler is registered. If
+        every handler re-raises, the final handler's exception propagates
+        to the caller. Intended for surfacing recoverable errors (e.g. an
+        external watcher emits a malformed event) without tearing down the
+        live component.
         """
-        err_text = "".join(traceback.format_exception(exc))
-        await self._resolve_exception_handler()(err_text)
+        await self._resolve_exception_handler()(exc)
 
 
 @runtime_checkable
```

**File**: `python/tests/core/test_exception_handlers.py` (modified, +188/-14)
```diff
@@ -1,3 +1,5 @@
+import asyncio
+import traceback
 from typing import Iterator
 
 import cocoindex as coco
@@ -36,7 +38,7 @@ async def _root() -> None:
     app = coco.App("test_exception_handlers_global", _root)
     app.update_blocking()
 
-    assert seen == [("RuntimeError", "mount")]
+    assert seen == [("ValueError", "mount")]
 
 
 def test_scoped_handler_overrides_global_and_fallback_on_handler_error() -> None:
@@ -74,7 +76,7 @@ def inner_handler(exc: BaseException, ctx: coco.ExceptionContext) -> None:
 
     # Inner sees component exception, then raises; global receives handler exception.
     assert calls == [
-        "inner:component:RuntimeError",
+        "inner:component:ValueError",
         "global:handler:RuntimeError",
     ]
 
@@ -154,16 +156,18 @@ async def _root() -> None:
     # `coco.mount(..., parent_fn)` at the parent's mount time.
     assert len(seen) == 1, f"expected one handler call; got {seen}"
     exc_name, mount_kind = seen[0]
-    assert exc_name == "RuntimeError"
+    # The sink raises a Python ValueError; it reaches the handler as-is.
+    assert exc_name == "ValueError"
     assert mount_kind == "mount"
 
 
-def test_background_mount_failure_surfaces_python_traceback() -> None:
-    """The handler should see the full Python traceback for a background mount failure,
-    not just the exception message — the trace is what makes the error actionable."""
+def test_background_mount_failure_preserves_exception_and_traceback() -> None:
+    """The handler receives the component's original Python exception, so it
+    can route by type (``isinstance``) and still recover the full traceback via
+    ``traceback.format_exception`` / ``logging(..., exc_info=exc)``."""
     envmod.reset_default_env_for_tests()
 
-    seen_messages: list[str] = []
+    seen: list[BaseException] = []
 
     @coco.lifespan
     def _lifespan(builder: coco.EnvironmentBuilder) -> Iterator[None]:
@@ -172,7 +176,7 @@ def _lifespan(builder: coco.EnvironmentBuilder) -> Iterator[None]:
         )
 
         def handler(exc: BaseException, ctx: coco.ExceptionContext) -> None:
-            seen_messages.append(str(exc))
+            seen.append(exc)
 
         builder.set_exception_handler(handler)
         yield
@@ -188,9 +192,179 @@ async def _root() -> None:
     app = coco.App("test_exception_handlers_trace", _root)
     app.update_blocking()
 
-    assert len(seen_messages) == 1
-    msg = seen_messages[0]
-    assert "ValueError" in msg
-    assert "traceful boom" in msg
-    assert "Traceback (most recent call last)" in msg
-    assert "_raise_for_trace_test" in msg
+    assert len(seen) == 1
+    exc = seen[0]
+    assert isinstance(exc, ValueError)
+    assert str(exc) == "traceful boom"
+    assert exc.__traceback__ is not None
+    formatted = "".join(traceback.format_exception(exc))
+    assert "Traceback (most recent call last)" in formatted
+    assert "_raise_for_trace_test" in formatted
+
+
+def test_engine_native_failure_keeps_cerror_mapping() -> None:
+    """An engine-side client error (here: declaring the same target state key
+    twice) reaches the handler as the ``ValueError`` that ``cerror_to_pyerr``
+    maps it to, not as a flattened ``RuntimeError``."""
+    envmod.reset_default_env_for_tests()
+
+    seen: list[BaseException] = []
+
+    @coco.lifespan
+    def _lifespan(builder: coco.EnvironmentBuilder) -> Iterator[None]:
+        builder.settings.db_path = common.get_env_db_path(
+            "test_exception_handlers_engine_native"
+        )
+
+        def handler(exc: BaseException, ctx: coco.ExceptionContext) -> None:
+            seen.append(exc)
+
+        builder.set_exception_handler(handler)
+        yield
+
+    @coco.fn
+    async def _child() -> None:
+        coco.declare_target_state(GlobalDictTarget.target_state("dup", 1))
+        coco.declare_target_state(GlobalDictTarget.target_state("dup", 2))
+
+    @coco.fn
+    async def _root() -> None:
+        await coco.mount(coco.component_subpath("child"), _child)
+
+    app = coco.App("test_exception_handlers_engine_native", _root)
+    app.update_blocking()
+
+    assert len(seen) == 1
+    assert isinstance(seen[0], ValueError)
+    assert "Target state already declared" in str(seen[0])
+
+
+class _DeadLetterError(Exception):
+    pass
+
+
+def test_handler_raise_preserves_type_through_ready() -> None:
+    """An exception raised by a handler propagates through ``handle.ready()``
+    with its Python type (and ``__cause__``) intact, so callers can catch it
+    by type rather than string-matching a flattened RuntimeError."""
+    envmod.reset_default_env_for_tests()
+
+    caught: list[BaseException] = []
+
+    @coco.lifespan
+    def _lifespan(builder: coco.EnvironmentBuilder) -> Iterator[None]:
+        builder.settings.db_path = common.get_env_db_path(
+            "test_exception_handlers_typed_raise"
+        )
+
+        def handler(exc: BaseException, ctx: coco.ExceptionContext) -> None:
+            if isinsta
```

**File**: `python/tests/core/test_live_component.py` (modified, +23/-14)
```diff
@@ -1,6 +1,7 @@
 from __future__ import annotations
 
 import asyncio
+import traceback
 from collections.abc import AsyncIterator, Awaitable, Callable
 from typing import Any
 
@@ -744,8 +745,8 @@ async def _root() -> None:
 
     assert len(seen) == 1
     exc_name, mount_kind, stable_path, parent_path, processor_name = seen[0]
-    # resolve_handler synthesizes a RuntimeError from the stringified error
-    assert exc_name == "RuntimeError"
+    # report_exception passes the original exception through unchanged
+    assert exc_name == "ValueError"
     assert mount_kind == "process_live"
     # The live component's path includes the "live" subpath component
     assert "live" in stable_path
@@ -755,13 +756,13 @@ async def _root() -> None:
 
 
 def test_report_exception_surfaces_python_traceback() -> None:
-    """The handler should see the original Python traceback, not just the message."""
+    """The handler should see the original exception with its traceback intact."""
     GlobalDictTarget.store.clear()
 
-    seen_messages: list[str] = []
+    seen: list[BaseException] = []
 
     def handler(exc: BaseException, ctx: coco.ExceptionContext) -> None:
-        seen_messages.append(str(exc))
+        seen.append(exc)
 
     env = common.create_test_env(
         __file__, suffix="report_exc_trace", exception_handler=handler
@@ -773,12 +774,14 @@ async def _root() -> None:
     app = coco.App(coco.AppConfig(name="test_report_exc_trace", environment=env), _root)
     app.update_blocking(live=True)
 
-    assert len(seen_messages) == 1
-    msg = seen_messages[0]
-    assert "ValueError" in msg
-    assert "traceful boom" in msg
-    assert "Traceback (most recent call last)" in msg
-    assert "_raise_for_trace_test" in msg
+    assert len(seen) == 1
+    exc = seen[0]
+    assert isinstance(exc, ValueError)
+    assert str(exc) == "traceful boom"
+    assert exc.__traceback__ is not None
+    formatted = "".join(traceback.format_exception(exc))
+    assert "Traceback (most recent call last)" in formatted
+    assert "_raise_for_trace_test" in formatted
 
 
 async def _failing_child(value: int) -> None:
@@ -840,7 +843,7 @@ async def _root() -> None:
 
     assert len(seen) == 1
     exc_name, mount_kind, stable_path = seen[0]
-    assert exc_name == "RuntimeError"
+    assert exc_name == "ValueError"
     assert mount_kind == "process_live"
     assert "c" in stable_path
 
@@ -958,7 +961,7 @@ async def _root() -> None:
 
     assert len(seen) == 1
     exc_name, mount_kind, stable_path = seen[0]
-    assert exc_name == "RuntimeError"
+    assert exc_name == "ValueError"
     assert mount_kind == "process_live"
     assert "bad_child" in stable_path
     # Swallowing handler → no propagation
@@ -1012,7 +1015,13 @@ async def _root() -> None:
     with caplog.at_level("ERROR"):
         app.update_blocking(live=True)
 
-    assert any("no handler boom" in record.getMessage() for record in caplog.records)
+    assert any(
+        record.levelname == "ERROR"
+        and "no handler boom" in record.getMessage()
+        and record.exc_info is not None
+        and "no handler boom" in str(record.exc_info[1])
+        for record in caplog.records
+    )
 
 
 # ============================================================================
```

**File**: `python/tests/core/test_use_state.py` (modified, +8/-6)
```diff
@@ -6,6 +6,7 @@
 import msgspec
 import pytest
 import cocoindex as coco
+from cocoindex._internal.serde import DeserializationError
 
 from tests import common
 
@@ -313,10 +314,10 @@ async def _root_lazy(items: list[str]) -> None:
     assert _info["a"] == 1  # deserialized exactly once despite three reads
 
 
-def test_use_state_unserializable_value_errors_at_commit_with_key() -> None:
+def test_use_state_unserializable_value_errors_at_commit() -> None:
     # Serialization is deferred to commit, so a non-serializable state value
     # fails there (not at assignment). The failure must reach the exception
-    # handler (i.e. not be silently dropped) and name the offending key.
+    # handler (i.e. not be silently dropped) as the serializer's exception.
     _source_items.clear()
 
     class _Unserializable:  # not registered for serialization
@@ -347,7 +348,8 @@ def handler(exc: BaseException, ctx: coco.ExceptionContext) -> None:
     app.update_blocking()
 
     assert len(captured) == 1
-    assert "bad_key" in str(captured[0])  # error identifies the failing key
+    exc = captured[0]
+    assert isinstance(exc, NotImplementedError)
 
 
 def test_use_state_raises_inside_memoized_function() -> None:
@@ -888,6 +890,6 @@ def handler(exc: BaseException, ctx: coco.ExceptionContext) -> None:
     captured.clear()
     app.update_blocking()
     assert len(captured) == 1
-    exc_text = str(captured[0])
-    assert "DeserializationError" in exc_text
-    assert "use_state key 'cur'" in exc_text
+    exc = captured[0]
+    assert isinstance(exc, DeserializationError)
+    assert "use_state key 'cur'" in str(exc)
```

---

### Incident Patch 15: `675df258` (2026-09-13)
**Commit Message**: fix(engine): confine a merged target-action batch failure to the failing component (#2406)

* fix(engine): confine a merged target-action batch failure to the failing component

Target action sinks batch through the engine: while one sink call is in
flight, the actions of every component that finishes meanwhile merge into
the next call. Merging is meant as a pure optimization, but a failure of
the merged call used to fail every component in it — the sink sees one
flat action list, `Runner::run` is all-or-nothing, and the batcher fans a
single error out to every waiter. One bad row could silently roll back
dozens of unrelated components' writes (observed with a shared
per-database Postgres sink: 1 of 60 rows advanced, `app.update()` returned
normally).

`TargetActionRunner` now reports a per-input outcome and, when a batch
spanning several components fails, bisects it along component boundaries
(never inside a component, whose actions stay one atomic unit) and
re-applies each half until every error is attributed only to the
components it belongs to. The happy path is unchanged: one sink call, one
transaction. Worst case costs `2n - 1` sink calls; cancellation and
deadline errors are

**File**: `dev/agent-skills/target-connector/SKILL.md` (modified, +9/-0)
```diff
@@ -256,6 +256,15 @@ and cannot be weakly referenced) and is rejected. The frozen dataclass above is
 the recommended shape; if you add `slots=True` to it, also pass
 `weakref_slot=True`.
 
+A batch can hold the actions of several processing components that finished
+around the same time. Merging is only an optimization: if the sink raises, the
+engine retries the same actions in smaller batches split along component
+boundaries (never inside one component's actions), so only the component(s)
+whose actions actually fail end up failing — the others' actions are
+re-applied and committed normally. The sink needs no special handling for
+this, but it may see an action from a failed batch again, which idempotent
+actions (see above) already tolerate.
+
 ### Input Safety
 
 When building queries from user-provided names (table, column, index) or values (record IDs, keys), you must guard against injection and ensure correctness. See [input_safety.md](input_safety.md) for patterns on identifier validation, parameterized queries, and value escaping.
```

**File**: `docs/src/content/docs/advanced_topics/custom_target_connector.mdx` (modified, +1/-1)
```diff
@@ -204,7 +204,7 @@ Understanding what happens at runtime:
 
 3. **Reconciliation**: When the processing unit finishes, CocoIndex calls your handler's `reconcile()` method for each target state. For declared target states, `desired_target_state` contains the spec; for previously declared but now missing states, `desired_target_state` is `NON_EXISTENCE` (triggering cleanup). Your `reconcile()` compares the desired state with previous records and returns `TargetReconcileOutput` if an action is needed, or `None` if no changes are required.
 
-4. **Action Execution**: CocoIndex batches actions by their `TargetActionSink` and executes them. The sink applies changes to the external system (database writes, file operations, API calls, etc.).
+4. **Action Execution**: CocoIndex batches actions by their `TargetActionSink` and executes them. The sink applies changes to the external system (database writes, file operations, API calls, etc.). A batch may combine the actions of several processing components that finish around the same time; if the sink fails, CocoIndex retries in smaller batches along component boundaries, so only the components whose actions actually fail are affected. The sink may therefore see an action from a failed batch again — keep actions idempotent.
 
 5. **Tracking Persistence**: After successful execution, CocoIndex persists the new tracking records. On the next run, these become the `prev_possible_records` for change detection.
 
```

**File**: `docs/src/content/docs/faq.mdx` (modified, +1/-1)
```diff
@@ -40,4 +40,4 @@ CocoIndex's internal state is always consistent — even after a crash or `kill
 
 ### Are target state writes transactional across targets?
 
-Not across targets. When a processing component finishes, CocoIndex sends all its target state changes to each target backend as a unit — all writes happen after processing completes, never partially during execution. Each target backend applies its batch atomically when supported (e.g., within a database transaction). But changes across *different* target backends (e.g., Postgres and local files) are not transactional with each other. See [How target states sync](./programming_guide/processing_component#how-target-states-sync) for details.
+Not across targets. When a processing component finishes, CocoIndex sends all its target state changes to each target backend as a unit — all writes happen after processing completes, never partially during execution. Each target backend applies its batch atomically when supported (e.g., within a database transaction). A batch may also carry the changes of several components that finish around the same time; if the backend rejects it, CocoIndex retries the changes in smaller batches per component, so one component's failure never undoes another's. But changes across *different* target backends (e.g., Postgres and local files) are not transactional with each other. See [How target states sync](./programming_guide/processing_component#how-target-states-sync) for details.
```

**File**: `docs/src/content/docs/programming_guide/processing_component.mdx` (modified, +1/-1)
```diff
@@ -242,7 +242,7 @@ After a processing component finishes, CocoIndex syncs its target states:
 2. **Applies changes** as a unit — creating, updating, or deleting target states as needed
 3. **Recursively cleans up** sub-paths where components are no longer mounted
 
-All writes happen strictly after processing completes — you never see partial effects from a processing failure or interrupt. Each target backend applies its batch atomically when supported (e.g., within a database transaction), but changes across different target backends are not transactional with each other.
+All writes happen strictly after processing completes — you never see partial effects from a processing failure or interrupt. Each target backend applies its batch atomically when supported (e.g., within a database transaction), but changes across different target backends are not transactional with each other. When several components finish around the same time, a backend may receive their changes in one batch; that is only an optimization — if the batch fails, CocoIndex retries per component so one component's failure never undoes another's.
 
 :::
 
```

**File**: `python/tests/core/test_target_sink_failure_isolation.py` (added, +181/-0)
```diff
@@ -0,0 +1,181 @@
+"""A failing component must not fail the components the engine batched with it.
+
+Target action sinks batch through the engine: while one sink call is in
+flight, the actions of every component that finishes meanwhile merge into the
+next call. Merging is an optimization, not a transaction boundary between
+components. When a merged call fails, the engine retries in smaller batches
+along component boundaries, so only the component whose actions fail actually
+fails; the others commit as usual.
+"""
+
+from __future__ import annotations
+
+import asyncio
+import threading
+import time
+from dataclasses import dataclass
+from typing import Any, Collection
+
+import cocoindex as coco
+
+from tests import common
+
+_NUM_ITEMS = 16
+_POISON_ITEM = 7
+
+_failed_paths: list[str] = []
+
+
+def _record_failure(exc: BaseException, ctx: coco.ExceptionContext) -> None:
+    _failed_paths.append(ctx.stable_path)
+
+
+coco_env = common.create_test_env(__file__, exception_handler=_record_failure)
+
+
+class _RunState:
+    """Per-run input and observations, shared across threads (``reconcile``
+    runs on an engine thread)."""
+
+    def __init__(self) -> None:
+        self.lock = threading.Lock()
+        # The item whose actions the sink rejects in this run, if any.
+        self.poison_item: int | None = None
+        self.store: dict[int, str] = {}
+        self.batches: list[list[tuple[int, str]]] = []
+        self.num_reconciled = 0
+        self.gate_taken = False
+
+    def reset_run(self, poison_item: int | None) -> None:
+        with self.lock:
+            self.poison_item = poison_item
+            self.batches.clear()
+            self.num_reconciled = 0
+            self.gate_taken = False
+
+
+_run = _RunState()
+
+
+async def _wait_until_all_reconciled() -> None:
+    """Hold the batcher until every component has reconciled its target state.
+
+    A component reconciles right before handing its actions to the sink, so
+    once every component has reconciled (plus a drain period for the last
+    precommit to land), every other component's actions are queued behind this
+    sink call and will merge into the next batch.
+    """
+    deadline = time.monotonic() + 10
+    while True:
+        with _run.lock:
+            if _run.num_reconciled >= _NUM_ITEMS:
+                break
+        if time.monotonic() > deadline:
+            raise TimeoutError("components did not all reconcile in time")
+        await asyncio.sleep(0.01)
+    await asyncio.sleep(0.3)
+
+
+@dataclass(frozen=True)
+class _TransactionalSink:
+    """A batch lands wholly or not at all, like a database transaction."""
+
+    db: str
+
+    async def __call__(
+        self,
+        context_provider: coco.ContextProvider,
+        actions: Collection[tuple[int, str]],
+        /,
+    ) -> None:
+        batch = list(actions)
+        with _run.lock:
+            _run.batches.append(batch)
+            takes_gate = not _run.gate_taken
+            _run.gate_taken = True
+        if takes_gate:
+            await _wait_until_all_reconciled()
+        if any(value == "poison" for _, value in batch):
+            raise ValueError("poisoned batch")
+        with _run.lock:
+            for key, value in batch:
+                _run.store[key] = value
+
+
+class _Handler:
+    def reconcile(
+        self,
+        key: Any,
+        desired_state: Any | coco.NonExistenceType,
+        prev_possible_records: Collection[Any],
+        prev_may_be_missing: bool,
+        /,
+    ) -> coco.TargetReconcileOutput[tuple[int, str], Any] | None:
+        with _run.lock:
+            _run.num_reconciled += 1
+        if coco.is_non_existence(desired_state):
+            return None
+        if not prev_may_be_missing and all(
+            prev == desired_state for prev in prev_possible_records
+        ):
+            return None
+        return coco.TargetReconcileOutput(
+            action=(key, desired_state),
+            sink=coco.TargetActionSink.from_async_fn(_TransactionalSink("db")),
+            tracking_record=desired_state,
+        )
+
+
+_provider = coco.register_root_target_states_provider(
+    "test_target_sink_failure_isolation/rows", _Handler()
+)
+
+
+@coco.fn
+async def _process_item(item: int) -> None:
+    poisoned = item == _run.poison_item
+    if poisoned:
+        # Finish last, so the poisoned actions never take the gated first sink
+        # call but always land in the merged batch queued behind it.
+        await asyncio.sleep(0.1)
+    value = "poison" if poisoned else f"v{item}"
+    coco.declare_target_state(_provider.target_state(item, value))
+
+
+async def _root() -> None:
+    await coco.mount_each(
+        coco.component_subpath("item"),
+        _process_item,
+        [(i, i) for i in range(_NUM_ITEMS)],
+    )
+
+
+def test_merged_batch_failure_is_confined_to_the_failing_component() -> None:
+    # One app for both runs: the second run must see the first run's tracking
+    # recor
```

**File**: `rust/core/src/engine/component.rs` (modified, +1/-1)
```diff
@@ -1484,7 +1484,7 @@ mod tests {
             &self,
             _host_runtime_ctx: &(),
             _host_ctx: Arc<()>,
-            _actions: Vec<()>,
+            _actions: &[()],
         ) -> crate::prelude::Result<Option<Vec<Option<ChildTargetDef<TestProfile>>>>> {
             Ok(None)
         }
```

**File**: `rust/core/src/engine/profile.rs` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ pub trait EngineProfile: Debug + Clone + PartialEq + Eq + Hash + Default + 'stat
 
     type TargetHdl: TargetHandler<Self>;
     type TargetStateTrackingRecord: Send + Persist + 'static;
-    type TargetAction: Send + 'static;
+    type TargetAction: Send + Sync + 'static;
     type TargetActionSink: TargetActionSink<Self>;
     type TargetStateValue: Send + 'static;
 }
```

**File**: `rust/core/src/engine/target_state.rs` (modified, +326/-32)
```diff
@@ -11,7 +11,9 @@ use crate::{
 use cocoindex_utils::batching::{BatchQueue, Batcher, BatchingOptions, Runner};
 use std::{
     collections::HashMap,
+    future::Future,
     hash::{Hash, Hasher},
+    ops::Range,
 };
 
 pub struct ChildTargetDef<Prof: EngineProfile> {
@@ -22,14 +24,22 @@ pub struct ChildTargetDef<Prof: EngineProfile> {
 pub trait TargetActionSink<Prof: EngineProfile>: Send + Sync + 'static {
     // TODO: Add method to expose function info and arguments, for tracing purpose & no-change detection.
 
-    /// Run the logic to apply the action.
+    /// Apply `actions` to the external system as one unit.
+    ///
+    /// One call may carry the actions of several processing components: the
+    /// engine merges the actions of components that finish while an earlier
+    /// call is in flight. When a call fails, the engine re-applies subsets of
+    /// the same actions to isolate the failure, so an implementation must
+    /// tolerate seeing actions of a failed call again — which idempotent
+    /// actions do by construction. The actions are borrowed for that reason:
+    /// the engine keeps them for the retry.
     ///
     /// We expect the implementation of this method to spawn the logic to a separate thread or task when needed.
     async fn apply(
         &self,
         host_runtime_ctx: &Prof::HostRuntimeCtx,
         host_ctx: Arc<Prof::HostCtx>,
-        actions: Vec<Prof::TargetAction>,
+        actions: &[Prof::TargetAction],
     ) -> Result<Option<Vec<Option<ChildTargetDef<Prof>>>>>;
 }
 
@@ -66,14 +76,16 @@ impl<Prof: EngineProfile> TargetActionSinkKeeper<Prof> {
         if actions.is_empty() {
             return Ok(None);
         }
+        // The outer `Result` is the batcher's own failure (e.g. cancellation);
+        // the inner one is this input's outcome from the sink.
         self.inner
             .batcher
             .run(TargetActionRunnerInput {
                 host_runtime_ctx: host_runtime_ctx.clone(),
                 host_ctx,
                 actions,
             })
-            .await
+            .await?
     }
 
     pub fn downgrade(&self) -> WeakTargetActionSinkKeeper<Prof> {
@@ -138,24 +150,27 @@ impl<Prof: EngineProfile> Hash for TargetActionRunnerContext<Prof> {
     }
 }
 
+/// Runs a sink's batches. Each input is one processing component's reconciled
+/// actions for the sink; the batcher merges the inputs of components that
+/// finish while an earlier batch is in flight.
 struct TargetActionRunner<Prof: EngineProfile> {
     sink: Arc<Prof::TargetActionSink>,
 }
 
 #[async_trait]
 impl<Prof: EngineProfile> Runner for TargetActionRunner<Prof> {
     type Input = TargetActionRunnerInput<Prof>;
-    type Output = Option<Vec<Option<ChildTargetDef<Prof>>>>;
+    /// Per-input outcome. Merging inputs into one sink call is an
+    /// optimization that must not couple their fates, so a failure is
+    /// reported per input rather than as a batch-level `Err`, which the
+    /// batcher would fan out to every input of the batch.
+    type Output = Result<Option<Vec<Option<ChildTargetDef<Prof>>>>>;
 
     async fn run(
         &self,
         inputs: Vec<Self::Input>,
     ) -> Result<impl ExactSizeIterator<Item = Self::Output>> {
         let num_inputs = inputs.len();
-        if num_inputs == 0 {
-            return Ok(Vec::new().into_iter());
-        }
-
         let mut groups =
             HashMap::<TargetActionRunnerContext<Prof>, Vec<(usize, Vec<Prof::TargetAction>)>>::new(
             );
@@ -170,44 +185,134 @@ impl<Prof: EngineProfile> Runner for TargetActionRunner<Prof> {
                 .push((input_idx, input.actions));
         }
 
-        let mut outputs: Vec<Option<Vec<Option<ChildTargetDef<Prof>>>>> =
+        let mut outputs: Vec<Option<Self::Output>> =
             std::iter::repeat_with(|| None).take(num_inputs).collect();
         for (context, inputs) in groups {
+            // The sink wants one flat action list per compatible host
+            // context. Remember each input's range within it so a failed
+            // call can be retried along input boundaries.
             let mut actions = Vec::new();
-            let mut action_counts = Vec::with_capacity(inputs.len());
             let mut input_indexes = Vec::with_capacity(inputs.len());
-
-            // Each input is one component's reconciled actions; the sink wants
-            // one flat action list per compatible host context.
+            let mut spans = Vec::with_capacity(inputs.len());
             for (input_idx, mut input_actions) in inputs {
-                input_indexes.push(input_idx);
-                action_counts.push(input_actions.len());
+                let start = actions.len();
                 actions.append(&mut input_actions);
+                input_indexes.push(input_idx);
+                spans.push(start..actions.len());
+            }
+
+            let results = apply_isolating_failures(&spans, |range| {
+                self.s
```

#### Recent Merged Pull Requests:
- **PR #2478** (2026-10-05): fix(core): scoped exception handlers see LiveMap mount_each items (@georgeh0)
- **PR #2477** (2026-10-05): test(core): gate sink-failure test on committed precommits (@georgeh0)
- **PR #2475** (2026-10-04): docs(target): state that reconcile() may run more than once per commit (@georgeh0)
- **PR #2474** (2026-10-04): feat(memo): let a memo state be collected again after a re-run (@georgeh0)
- **PR #2472** (2026-10-03): perf(engine): skip reconcile for unchanged values of fingerprint-tracking handlers (#2460, part 2) (@georgeh0)
- **PR #2471** (2026-10-03): perf(postgres): upsert through INSERT ... SELECT FROM unnest(arrays) (@georgeh0)
- **PR #2470** (2026-10-03): perf(fingerprint): fingerprint plain data natively (#2460, part 1) (@georgeh0)
- **PR #2469** (2026-10-04): perf(engine): cut the memory held per declared target state (@georgeh0)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
