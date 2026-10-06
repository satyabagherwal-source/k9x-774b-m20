# Forensic Learning Record (Deep Inspection): pixeltable/pixeltable

> **Canonical Artifact**: `07_PROJECT_LEARNING/pixeltable-pixeltable-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pixeltable/pixeltable](https://github.com/pixeltable/pixeltable))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:59:52.935Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pixeltable/pixeltable`
- **Description**: The backend agents build with - Multimodal database, orchestration, and serving in one file
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 1636 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `dashboard/src/hooks/useDebounce.ts`
```
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

```

### Core Architecture Module: `dashboard/src/lib/utils.ts`
```
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Encode catalog paths into a single URL segment so hosted `pxt://…` URIs survive react-router.
export function tableHref(path: string): string {
  return `/table/${encodeURIComponent(path)}`
}

export function dirHref(path: string): string {
  return `/dir/${encodeURIComponent(path)}`
}

export const LOCAL_CATALOG = 'local'

const CATALOGS_KEY = 'pxt-catalogs'
const ACTIVE_KEY = 'pxt-active-catalog'

export function loadExtraCatalogs(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CATALOGS_KEY) ?? '[]')
    if (Array.isArray(parsed)) return parsed.filter((u): u is string => typeof u === 'string')
  } catch {
    // ignore malformed value
  }
  return []
}

export function saveExtraCatalogs(uris: string[]): void {
  localStorage.setItem(CATALOGS_KEY, JSON.stringify(uris))
}

export function loadActiveCatalog(): string {
  const saved = localStorage.getItem(ACTIVE_KEY)
  if (saved === null || saved === '' || saved === LOCAL_CATALOG) return LOCAL_CATALOG
  if (loadExtraCatalogs().includes(saved)) return saved
  return LOCAL_CATALOG
}

export function saveActiveCatalog(uri: string): void {
  localStorage.setItem(ACTIVE_KEY, uri)
}

export function catalogLabel(uri: string): string {
  if (uri === LOCAL_CATALOG) return 'Local'
  if (uri.startsWith('pxt://')) return uri.slice('pxt://'.length)
  return uri
}

/** Catalog root only: `pxt://org:db` or bare `org:db`. Rejects paths with `/…`. */
export function normalizeCloudCatalogUri(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed === LOCAL_CATALOG) return null

  let uri = trimmed
  if (!uri.startsWith('pxt://')) {
    if (!/^[^:\s]+:[^:\s]+$/.test(uri)) return null
    uri = `pxt://${uri}`
  }

  const rest = uri.slice('pxt://'.length)
  // Root only — no nested path after org:db.
  if (!/^[^:\s/]+:[^:\s/]+$/.test(rest)) return null
  return uri
}

/** Hosted catalog root for a path (`pxt://org:db/t` → `pxt://org:db`), or null. */
export function catalogRootFromPath(path: string): string | null {
  if (!path.startsWith('pxt://')) return null
  const rest = path.slice('pxt://'.length)
  const slash = rest.indexOf('/')
  const root = slash === -1 ? rest : rest.slice(0, slash)
  return normalizeCloudCatalogUri(`pxt://${root}`)
}

```

### Core Architecture Module: `pixeltable/catalog/model/_code_frame_utils.py`
```
"""
Recovery of class-body annotations from bytecode, for the Python 3.14+ deferred-annotation path.

PEP 649 compiles class-body annotations into an `__annotate__` function instead of emitting namespace
operations as the body runs. That function's code object is a constant of the class body code object,
which is in turn a constant of the code object of the frame executing the `class ...:` statement, so the
annotations are reachable before the body runs, without reading source. It retains the annotation names
and their line numbers, and evaluating it yields real type objects.

This relies on CPython bytecode layout rather than a language guarantee, so these functions return
`None`/empty when the expected shape isn't found, leaving the caller to raise a usable error.
"""

from __future__ import annotations

import dis
import types
from typing import Any


def _line_map(code: types.CodeType) -> dict[int, int]:
    """Map bytecode offset -> source line for `code`."""
    result: dict[int, int] = {}
    for start, end, line in code.co_lines():
        if line is not None:
            for offset in range(start, end, 2):
                result[offset] = line
    return result


def find_class_body_code(caller: types.FrameType, cls_name: str) -> types.CodeType | None:
    """
    Locate the code object of the class body being executed for `cls_name`, among `caller`'s constants.

    When the name occurs more than once in the scope (a loop, or a redefinition), the last matching
    `LOAD_CONST` at or before the frame's current instruction is the one feeding the in-progress
    `__build_class__` call.
    """
    code = caller.f_code
    candidates = [const for const in code.co_consts if isinstance(const, types.CodeType) and const.co_name == cls_name]
    if len(candidates) == 1:
        return candidates[0]
    if len(candidates) == 0:
        return None
    result: types.CodeType | None = None
    for instr in dis.get_instructions(code):
        if instr.offset > caller.f_lasti:
            break
        if (
            instr.opname.startswith('LOAD_CONST')
            and isinstance(instr.argval, types.CodeType)
            and instr.argval.co_name == cls_name
        ):
            result = instr.argval
    return result


def _annotate_code(body_code: types.CodeType) -> types.CodeType | None:
    return next((c for c in body_code.co_consts if isinstance(c, types.CodeType) and c.co_name == '__annotate__'), None)


def annotation_lines(body_code: types.CodeType) -> list[tuple[str, int]]:
    """(name, line) for each annotation in `body_code`, in declaration order."""
    annotate = _annotate_code(body_code)
    if annotate is None:
        return []
    lines = _line_map(annotate)
    # The annotate function stores each evaluated annotation under its column name, the only string
    # constant it loads per annotation.
    return [
        (instr.argval, lines[instr.offset])
        for instr in dis.get_instructions(annotate)
        if instr.opname.startswith('LOAD_CONST') and isinstance(instr.argval, str) and instr.offset in lines
    ]


def assignment_lines(body_code: types.CodeType) -> list[tuple[str, int]]:
    """(name, line) for each top-level name assignment in `body_code`, in declaration order."""
    lines = _line_map(body_code)
    return [
        (instr.argval, lines[instr.offset])
        for instr in dis.get_instructions(body_code)
        if instr.opname == 'STORE_NAME' and not instr.argval.startswith('__') and instr.offset in lines
    ]


def evaluate_annotations(
    body_code: types.CodeType, namespace: dict[str, Any], eval_globals: dict[str, Any]
) -> dict[str, Any]:
    """
    Evaluate the annotations of `body_code` to real type objects.

    `__annotate__` consults a `__classdict__` closure cell before globals when resolving names, so passing
    the model namespace there resolves them as they would have resolved inside the class body.
    """
    annotate = _annotate_code(body_code)
    if annotate is None:
        return {}
    closure = tuple(types.CellType(namespace) for _ in annotate.co_freevars)
    fn = types.FunctionType(annotate, eval_globals, '__annotate__', None, closure)
    return fn(1)  # annotationlib.Format.VALUE

```

### Core Architecture Module: `pixeltable/catalog/utils.py`
```
from __future__ import annotations

import itertools
import time
from typing import TYPE_CHECKING, Any, Iterable
from uuid import UUID

import pixeltable.exceptions as excs
import pixeltable.exprs as exprs
import pixeltable.index as index
from pixeltable.env import Env
from pixeltable.metadata import schema

from .column import Column
from .globals import IndexSpec, MediaValidation
from .types import TableVersionKey, TableVersionMd

if TYPE_CHECKING:
    from .table_version import TableVersion


def validate_idxs(
    tbl_id: UUID,
    idxs: Iterable[IndexSpec],
    has_default_idxs: bool,
    existing_idxs: Iterable[TableVersion.IndexInfo] = (),
) -> None:
    """Validate the indexes in idxs, which are about to be created on the table with id tbl_id.

    idxs: resolved specs, ie. every indexed_column identifies a column rather than naming one.
    existing_idxs: the table's live indexes; a new index must not collide with one of those.
    """
    existing_by_name = {info.name: info for info in existing_idxs}
    # names of the columns that already have a B-tree index; a view's base columns are excluded, because the
    # validation below rejects them as targets anyway
    btree_col_names = {
        info.col.name
        for info in existing_idxs
        if isinstance(info.idx, index.BtreeIndex) and info.col.tbl_handle.id == tbl_id
    }
    new_names: set[str] = set()
    new_btree_col_names: set[str] = set()

    for idx_col, idx_name, idx in idxs:
        assert not isinstance(idx_col, str), repr(idx_col)
        if isinstance(idx, index.BtreeIndex):
            assert idx_col.name is not None, repr(idx_col)
            if has_default_idxs:
                raise excs.RequestError(
                    excs.ErrorCode.UNSUPPORTED_OPERATION,
                    'Cannot create an explicit B-tree index on a table with has_default_idxs=True; '
                    'its eligible columns are indexed automatically.',
                )
            # a spec that carries metadata instead of a Column identifies a column that already exists, which
            # for the table being created is one of a base
            owner_tbl_id = idx_col.tbl_handle.id if isinstance(idx_col, Column) else idx_col.qcolid.tbl_id
            if owner_tbl_id != tbl_id:
                # PXT-1260 Allow views to create a b-tree index on a base column
                raise excs.RequestError(
                    excs.ErrorCode.UNSUPPORTED_OPERATION,
                    f'Cannot create a B-tree index on column {idx_col.name!r}: it belongs to a base table. '
                    'Add the index to the base table instead.',
                )
            assert isinstance(idx_col, Column), repr(idx_col)
            index.BtreeIndex.validate_column(idx_col.column_version_md())
            if idx_col.name in new_btree_col_names or idx_col.name in btree_col_names:
                raise excs.AlreadyExistsError(
                    excs.ErrorCode.INDEX_ALREADY_EXISTS, f'A B-tree index already exists on column {idx_col.name!r}.'
                )
            new_btree_col_names.add(idx_col.name)
        if idx_name is not None:
            assert idx_name not in new_names, idx_name
            existing_info = existing_by_name.get(idx_name)
            if existing_info is not None:
                raise excs.AlreadyExistsError(
                    excs.ErrorCode.INDEX_ALREADY_EXISTS,
                    f'Index {idx_name!r} already exists on column {existing_info.col.name!r}.',
                )
            new_names.add(idx_name)


def generate_idx_name(existing_names: set[str]) -> str:
    """Generates an index name that is not in existing_names."""
    i = 0
    while True:
        name = f'idx{i}'
        if name not in existing_names:
            return name
        i += 1


def create_table_version_md(
    tbl_id: UUID,
    name: str,
    cols: list[Column],
    comment: str | None,
    custom_metadata: Any,
    media_validation: MediaValidation,
    has_default_idxs: bool,
    view_md: schema.ViewMd | None,
    is_data_versioned: bool,
    additional_idxs: list[IndexSpec],
) -> TableVersionMd:
    # imported here rather than at module scope: table_version_handle imports TableVersion, whose module imports
    # this one
    from .table_version_handle import TableVersionHandle

    for col in cols:
        if col.is_pk and col.col_type.nullable:
            raise excs.RequestError(
                excs.ErrorCode.UNSUPPORTED_OPERATION,
                f'Primary key column {col.name!r} cannot be nullable. '
                f'Declare it as non-nullable instead: `pxt.{col.col_type._to_base_str()}`',
            )

    user = Env.get().user
    timestamp = time.time()

    tbl_id_str = str(tbl_id)
    tbl_handle = TableVersionHandle(TableVersionKey(tbl_id, None))
    column_ids = itertools.count()
    index_ids = itertools.count()

    # assign ids
    for col in cols:
        col.tbl_handle = tbl_handle
        col.id = next(column_ids)
        col.schema_version_add = 0

    # resolve ColumnRefByName's to ColumnRefs in computed columns
    subst = exprs.ExprDict[exprs.Expr](
        (
            exprs.ColumnRefByName(col.name),
            exprs.ColumnRef(
                col.column_version_md(),
                perform_validation=(col._media_validation or media_validation) == MediaValidation.ON_READ,
            ),
        )
        for col in cols
        if col.name is not None
    )

    # create metadata
    column_md: dict[int, schema.ColumnMd] = {}
    schema_col_md: dict[int, schema.SchemaColumn] = {}
    for pos, col in enumerate(cols):
        value_expr = col.value_expr
        if value_expr is not None:
            col.set_value_expr(value_expr.substitute(subst))
        if col.is_computed:
            col.check_value_expr()
        col_md, col_schema_md = col.to_md(pos)
        column_md[col.id] = col_md
        schema_col_md[col.id] = col_schema_md

    validate_idxs(tbl_id, additional_idxs, has_default_idxs)

    # Merge default indexes and additional indexes into a manifest of indexes to create.
    index_md: dict[int, schema.IndexMd] = {}
    idxs_to_create: list[IndexSpec] = []
    if has_default_idxs and (view_md is None or not view_md.is_snapshot):
        # TODO: on an operational table, the default B-tree on the leading primary key column adds a cost in exchange
        # for no benefit at all. We should be able to skip the default index on that one column (but none of
        # the others).
        idxs_to_create.extend(
            IndexSpec(col, None, index.BtreeIndex(uses_value_col=is_data_versioned))
            for col in cols
            if index.BtreeIndex.can_index(col)
        )

    # an index on a column of this table must reference the instance in cols, which is the one that got an id
    # above; an index on a column that already exists carries its metadata instead
    own_cols = {id(col) for col in cols}
    assert all(not isinstance(spec.indexed_column, str) for spec in additional_idxs)
    assert all(
        id(spec.indexed_column) in own_cols
        for spec in additional_idxs
        if isinstance(spec.indexed_column, Column) and spec.indexed_column.tbl_handle.id == tbl_id
    )
    idxs_to_create.extend(additional_idxs)

    taken_idx_names = {spec.idx_name for spec in idxs_to_create if spec.idx_name is not None}

    index_cols: list[Column] = []
    for idx_col, idx_name, idx in idxs_to_create:
        assert not isinstance(idx_col, str)
        # a column of this table was given its id above, so its metadata is only derivable now
        idx_col_md = idx_col.column_version_md() if isinstance(idx_col, Column) else idx_col
        val_col, undo_col = Column.create_index_columns(
            tbl_handle,
            idx_col_md,
            idx,
            schema_version=0,
            is_data_versioned=is_data_versioned,
            next_col_id=lambda: next(column_ids),
        )
        index_cols.extend(c for c in (val_col, undo_col) if c is not None)

        idx_id = next(index_ids)
        resolved_idx_name: str
        if idx_name is not None:
            resolved_idx_name = idx_name
        else:
            resolved_idx_name = generate_idx_name(taken_idx_names)
            taken_idx_names.add(resolved_idx_name)
        idx_cls = type(idx)
        md = schema.IndexMd(
            id=idx_id,
            name=resolved_idx_name,
            indexed_col_id=idx_col_md.id,
            indexed_col_tbl_id=str(idx_col_md.qcolid.tbl_id),
            index_val_col_id=None if val_col is None else val_col.id,
            index_val_undo_col_id=None if undo_col is None else undo_col.id,
            schema_version_add=0,
            schema_version_drop=None,
            class_fqn=idx_cls.__module__ + '.' + idx_cls.__name__,
            init_args=idx.as_dict(),
        )
        index_md[idx_id] = md

    for col in index_cols:
        col_md, col_schema_md = col.to_md(pos=None)
        column_md[col.id] = col_md
        schema_col_md[col.id] = col_schema_md

    assert all(column_md[col_id].id == col_id for col_id in column_md)
    assert all(index_md[idx_id].id == idx_id for idx_id in index_md)

    tbl_md = schema.TableMd(
        tbl_id=tbl_id_str,
        name=name,
        user=user,
        current_version=0,
        current_schema_version=0,
        next_col_id=next(column_ids),
        next_idx_id=next(index_ids),
        next_row_id=0,
        view_sn=0,
        column_md=column_md,
        index_md=index_md,
        view_md=view_md,
        additional_md={},
        is_data_versioned=is_data_versioned,
        has_default_idxs=has_default_idxs,
    )

    table_version_md = schema.VersionMd(
        tbl_id=tbl_id_str,
        created_at=timestamp,
        version=0,
        schema_version=0,
        user=user,
        update_status=None,
        additional_md={},
    )

    schema_version_md = schema.SchemaVersionMd(
        tbl_id=tbl_id_str,
        schema_version=0,
        preceding_schema_version=None,
  
```

### Core Architecture Module: `pixeltable/functions/util.py`
```
from typing import TypedDict

import av
import av.container
import av.stream
import PIL.Image

from pixeltable.config import Config
from pixeltable.env import Env


def resolve_torch_device(device: str, allow_mps: bool = True) -> str:
    Env.get().require_package('torch')
    import torch

    mps_enabled = Config.get().get_bool_value('enable_mps')
    if mps_enabled is None:
        mps_enabled = True  # Default to True if not set in config

    if device == 'auto':
        if torch.cuda.is_available():
            return 'cuda'
        if mps_enabled and allow_mps and torch.backends.mps.is_available():
            return 'mps'
        return 'cpu'
    return device


def normalize_image_mode(image: PIL.Image.Image) -> PIL.Image.Image:
    """
    Converts grayscale images to 3-channel for compatibility with models that only work with
    multichannel input.
    """
    if image.mode in ('1', 'L'):
        return image.convert('RGB')
    if image.mode == 'LA':
        return image.convert('RGBA')
    return image


class ImageMetadata(TypedDict, total=False):
    width: int
    height: int
    mode: str
    bits: int | None
    format: str | None


class CodecContextMetadata(TypedDict, total=False):
    """Metadata about a stream's codec."""

    name: str
    """Codec name (e.g. `'h264'`, `'aac'`)."""
    codec_tag: str
    """Four-character codec tag, unicode-escaped."""
    profile: str | None
    """Codec profile (e.g. `'High'`, `'LC'`), or `None` if unavailable."""
    channels: int | None
    """Number of audio channels. Present only for audio streams."""
    pix_fmt: str | None
    """Pixel format (e.g. `'yuv420p'`). Present only for video streams."""


class StreamMetadata(TypedDict, total=False):
    """Metadata for a stream within a media container."""

    type: str
    """Stream type: typically `'audio'` or `'video'`. Other stream types (e.g. subtitles) will have a
    `StreamMetadata` entry, but with no metadata other than `type`."""
    duration: int | None
    """Stream duration in `time_base` units, or `None` if unknown."""
    time_base: float | None
    """Time base of the stream as a float (seconds per tick), or `None` if unknown."""
    duration_seconds: float | None
    """Stream duration in seconds, computed from `duration` and `time_base`."""
    frames: int
    """Number of frames in the stream (may be 0 if unknown)."""
    metadata: dict[str, str]
    """Additional stream-specific metadata tags (e.g. language, title)."""
    codec_context: CodecContextMetadata
    """Codec information for this stream."""
    width: int
    """Frame width in pixels. Present only for video streams."""
    height: int
    """Frame height in pixels. Present only for video streams."""
    average_rate: float | None
    """Average frame rate in FPS (frames per second). Present only for video streams."""
    base_rate: float | None
    """Base (constant) frame rate in FPS. Present only for video streams."""
    guessed_rate: float | None
    """Guessed frame rate in FPS. Present only for video streams."""


class ContainerMetadata(TypedDict):
    """Metadata for a media container, as returned by
    [`audio.get_metadata()`][pixeltable.functions.audio.get_metadata]
    or [`video.get_metadata()`][pixeltable.functions.video.get_metadata]."""

    bit_exact: bool
    """Whether the container was opened in bit-exact mode."""
    bit_rate: int | None
    """Overall bit rate of the container in bits per second, or `None` if unknown."""
    size: int | None
    """Size of the container in bytes, or `None` if unknown."""
    metadata: dict[str, str]
    """Additional container-level metadata tags (e.g. title, encoder)."""
    streams: list[StreamMetadata]
    """Per-stream metadata for each stream in the container."""


def get_metadata(path: str) -> ContainerMetadata:
    with av.open(path) as container:
        assert isinstance(container, av.container.InputContainer)
        streams_info = [__get_stream_metadata(stream) for stream in container.streams]
        result: ContainerMetadata = {
            'bit_exact': getattr(container, 'bit_exact', False),
            'bit_rate': container.bit_rate,
            'size': container.size,
            'metadata': container.metadata,
            'streams': streams_info,
        }
    return result


def __get_stream_metadata(stream: av.stream.Stream) -> StreamMetadata:
    if stream.type not in ('audio', 'video'):
        result_unsupported: StreamMetadata = {'type': stream.type}
        return result_unsupported

    codec_context = stream.codec_context
    codec_tag = codec_context.codec_tag.encode('unicode-escape').decode('utf-8')

    # Compute duration_seconds from stream-level duration.
    # We intentionally don't fall back to container.duration here because it's ambiguous —
    # it may reflect a different stream's duration (e.g. audio vs video).
    duration_seconds: float | None = None
    if stream.duration is not None and stream.time_base is not None:
        duration_seconds = float(stream.duration * stream.time_base)

    codec_context_md: CodecContextMetadata = {
        'name': codec_context.name,
        'codec_tag': codec_tag,
        'profile': codec_context.profile,
    }

    result: StreamMetadata = {
        'type': stream.type,
        'duration': stream.duration,
        'time_base': float(stream.time_base) if stream.time_base is not None else None,
        'duration_seconds': duration_seconds,
        'frames': stream.frames,
        'metadata': stream.metadata,
        'codec_context': codec_context_md,
    }

    if stream.type == 'audio':
        assert isinstance(stream.codec_context, av.AudioCodecContext)
        channels = stream.codec_context.channels
        codec_context_md['channels'] = int(channels) if channels is not None else None
    else:
        assert stream.type == 'video'
        assert isinstance(stream, av.VideoStream)
        codec_context_md['pix_fmt'] = getattr(stream.codec_context, 'pix_fmt', None)
        result['width'] = stream.width
        result['height'] = stream.height
        result['average_rate'] = float(stream.average_rate) if stream.average_rate is not None else None
        result['base_rate'] = float(stream.base_rate) if stream.base_rate is not None else None
        result['guessed_rate'] = float(stream.guessed_rate) if stream.guessed_rate is not None else None

    return result

```

### Core Architecture Module: `pixeltable/io/utils.py`
```
from __future__ import annotations

import copy
import os
import tempfile
from contextlib import contextmanager
from keyword import iskeyword as is_python_keyword
from pathlib import Path
from typing import IO, Any, Iterator

import pixeltable as pxt
import pixeltable.exceptions as excs
from pixeltable.catalog.globals import fold_identifier, is_system_column_name
from pixeltable.exprs.column_property_ref import ColumnPropertyRef
from pixeltable.exprs.column_ref import ColumnRef
from pixeltable.exprs.expr import Expr


def normalize_pxt_col_name(name: str) -> str:
    """
    Normalizes an arbitrary column name into a valid Pixeltable identifier by:
    - replacing any non-ascii or non-alphanumeric characters with an underscore _
    - prefixing the result with the letter 'c' if it starts with an underscore or a number
    - folding it to lower case
    """
    id = ''.join(ch if ch.isascii() and ch.isalnum() else '_' for ch in name)
    if id[0].isnumeric():
        id = f'c_{id}'
    elif id[0] == '_':
        id = f'c{id}'
    assert pxt.catalog.is_valid_identifier(id), id
    return fold_identifier(id)


def normalize_primary_key_parameter(primary_key: str | list[str] | None = None) -> list[str]:
    if primary_key is None:
        primary_key = []
    elif isinstance(primary_key, str):
        primary_key = [primary_key]
    elif not isinstance(primary_key, list) or not all(isinstance(pk, str) for pk in primary_key):
        raise excs.RequestError(
            excs.ErrorCode.INVALID_ARGUMENT, 'primary_key must be a single column name or a list of column names'
        )
    return primary_key


def _is_usable_as_column_name(name: str, destination_schema: dict[str, Any]) -> bool:
    return not (is_system_column_name(name) or is_python_keyword(name) or name in destination_schema)


def normalize_schema_names(
    in_schema: dict[str, Any],
    primary_key: list[str],
    schema_overrides: dict[str, Any],
    require_valid_pxt_column_names: bool = False,
) -> tuple[dict[str, Any], list[str], dict[str, str] | None]:
    """
    Convert all names in the input schema from source names to valid Pixeltable identifiers
    - Ensure that all names are unique.
    - Report an error if any types are missing
    - If "require_valid_pxt_column_names", report an error if any column names are not valid Pixeltable column names
    - Report an error if any primary key columns are missing
    Returns
    - A new schema with normalized column names
    - The primary key columns, mapped to the normalized names
    - A mapping from the original names to the normalized names.
    """

    # Report any untyped columns as an error
    untyped_cols = [in_name for in_name, column_type in in_schema.items() if column_type is None]
    if len(untyped_cols) > 0:
        raise excs.RequestError(
            excs.ErrorCode.INVALID_TYPE, f'Could not infer pixeltable type for column(s): {", ".join(untyped_cols)}'
        )

    # Report any columns in `schema_overrides` that are not in the source
    extraneous_overrides = schema_overrides.keys() - in_schema.keys()
    if len(extraneous_overrides) > 0:
        raise excs.RequestError(
            excs.ErrorCode.UNSUPPORTED_OPERATION,
            f'Some column(s) specified in `schema_overrides` are not present '
            f'in the source: {", ".join(extraneous_overrides)}',
        )

    schema: dict[str, Any] = {}
    col_mapping: dict[str, str] = {}  # Maps column names to Pixeltable column names if needed
    invalid_names: list[str] = []
    for in_name, pxt_type in in_schema.items():
        pxt_name = normalize_pxt_col_name(in_name)
        # Ensure that column names are unique by appending a distinguishing suffix
        # to any collisions
        pxt_fname = pxt_name
        n = 1
        while not _is_usable_as_column_name(pxt_fname, schema):
            pxt_fname = f'{pxt_name}_{n}'
            n += 1
        schema[pxt_fname] = pxt_type
        col_mapping[in_name] = pxt_fname
        if fold_identifier(in_name) != pxt_fname:
            invalid_names.append(in_name)

    if len(invalid_names) > 0 and require_valid_pxt_column_names:
        raise excs.RequestError(
            excs.ErrorCode.INVALID_ARGUMENT,
            f'Column names must be valid pixeltable identifiers. Invalid names: {", ".join(invalid_names)}',
        )
    # Determine if the col_mapping is the identity mapping
    if all(k == v for k, v in col_mapping.items()):
        col_mapping = None

    # Report any primary key columns that are not in the source as an error
    missing_pk = [pk for pk in primary_key if pk not in in_schema]
    if len(missing_pk) > 0:
        raise excs.NotFoundError(
            excs.ErrorCode.COLUMN_NOT_FOUND,
            f'Primary key column(s) are not found in the source: {", ".join(missing_pk)}',
        )

    pxt_pk = [col_mapping[pk] for pk in primary_key] if col_mapping is not None else primary_key

    return schema, pxt_pk, col_mapping


def replace_media_with_fileurl(select_list_exprs: list[Expr]) -> list[Expr]:
    """Return a new select list where media ColumnRefs are replaced with their .fileurl property.

    This avoids Pixeltable's file caching pipeline and instead returns the authoritative
    URL stored in the database for each media column. Media-typed expressions that are not
    bare ColumnRefs (e.g. `.resize(...)` or other transformations) have no stable URL and
    are rejected.
    """
    result: list[Expr] = []
    for expr in copy.deepcopy(select_list_exprs):
        if isinstance(expr, ColumnRef) and expr.col_type.is_media_type():
            result.append(ColumnPropertyRef(expr, ColumnPropertyRef.Property.FILEURL))
        elif expr.col_type.is_media_type():
            raise excs.RequestError(
                excs.ErrorCode.UNSUPPORTED_OPERATION,
                f'Cannot export media expression {expr!r}: only stored media columns can be serialized. '
                f'Materialize it as a computed column, or select its underlying '
                f'column via `.fileurl` instead.',
            )
        else:
            result.append(expr)
    return result


@contextmanager
def atomic_write(file_path: Path, **open_kwargs: Any) -> Iterator[IO[str]]:
    """Open a tempfile alongside `file_path`; rename it onto `file_path` on clean exit, delete on error.

    `open_kwargs` are forwarded to `os.fdopen` (e.g. `mode`, `encoding`, `newline`).
    """
    file_path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(dir=str(file_path.parent), prefix=f'.{file_path.name}.', suffix='.tmp')
    tmp_path = Path(tmp_name)
    try:
        with os.fdopen(fd, **open_kwargs) as f:
            yield f
        os.replace(tmp_path, file_path)
    except BaseException:
        tmp_path.unlink(missing_ok=True)
        raise

```

### Core Architecture Module: `pixeltable/metadata/converters/util.py`
```
import copy
import logging
from typing import Any, Callable, TypeVar
from uuid import UUID

import sqlalchemy as sql
from sqlalchemy import Column, LargeBinary, MetaData
from sqlalchemy.dialects.postgresql import JSONB, UUID as SA_UUID

from pixeltable.metadata.schema import Table, TableSchemaVersion

__logger = logging.getLogger(__name__)

# The legacy 'functions' table stored pickled UDF bodies. It was removed from the live schema and
# dropped by the version 54->55 converter; converters that upgrade older databases still read and rewrite it, so
# it is defined here on a private MetaData instance (base_metadata.create_all() therefore never recreates it for a fresh
# database).
_legacy_metadata = MetaData()
legacy_functions = sql.Table(
    'functions',
    _legacy_metadata,
    Column('id', SA_UUID(as_uuid=True), primary_key=True),
    Column('md', JSONB),
    Column('binary_obj', LargeBinary),
)


def convert_table_md(
    conn: sql.Connection,
    table_md_updater: Callable[[dict, UUID], None] | None = None,
    column_md_updater: Callable[[dict], None] | None = None,
    external_store_md_updater: Callable[[dict], None] | None = None,
    substitution_fn: Callable[[str | None, Any], tuple[str | None, Any] | None] | None = None,
    table_modifier: Callable[[sql.Connection, UUID, dict, dict], None] | None = None,
) -> None:
    """
    Converts schema.TableMd dicts based on the specified conversion functions.

    Args:
        conn: The SQLAlchemy connection to run the conversion on.
        table_md_updater: A function that updates schema.TableMd dicts in place.
            It takes two arguments: the metadata dict (new values) and the table id.
        column_md_updater: A function that updates schema.ColumnMd dicts in place.
        external_store_md_updater: A function that updates the external store metadata in place.
        substitution_fn: A function that substitutes metadata values. If specified, all metadata will be traversed
            recursively, and `substitution_fn` will be called once for each metadata entry. If the entry appears in
            a dict as a `(k, v)` pair, then `substitution_fn(k, v)` will be called. If the entry appears in a list,
            then `substitution_fn(None, v)` will be called. If `substitution_fn` returns a tuple `(k', v')`, then
            the original entry will be replaced, and the traversal will continue with `v'`.
    """
    # avoid a SELECT * here, which breaks when we add new columns to Table
    for row in conn.execute(sql.select(Table.id, Table.md)):
        tbl_id = row[0]
        table_md = row[1]
        assert isinstance(table_md, dict)
        updated_table_md = copy.deepcopy(table_md)
        if table_md_updater is not None:
            table_md_updater(updated_table_md, tbl_id)
        if column_md_updater is not None:
            __update_column_md(updated_table_md, column_md_updater)
        if external_store_md_updater is not None:
            __update_external_store_md(updated_table_md, external_store_md_updater)
        if substitution_fn is not None:
            updated_table_md = __substitute_md_rec(updated_table_md, substitution_fn)
        if updated_table_md != table_md:
            __logger.info(f'Updating schema for table: {tbl_id}')
            conn.execute(sql.update(Table).where(Table.id == tbl_id).values(md=updated_table_md))
        if table_modifier is not None:
            table_modifier(conn, tbl_id, table_md, updated_table_md)

    # the legacy 'functions' table is dropped once a database reaches version 55, so it may be absent here
    if sql.inspect(conn).has_table('functions'):
        # select explicit columns (not SELECT *) so a future column addition/reorder can't shift md's position
        for row in conn.execute(sql.select(legacy_functions.c.id, legacy_functions.c.md)):
            fn_id = row[0]
            function_md = row[1]
            assert isinstance(function_md, dict)
            updated_function_md = copy.deepcopy(function_md)
            if substitution_fn is not None:
                updated_function_md = __substitute_md_rec(updated_function_md, substitution_fn)
            if updated_function_md != function_md:
                __logger.info(f'Updating function: {fn_id}')
                conn.execute(
                    sql.update(legacy_functions).where(legacy_functions.c.id == fn_id).values(md=updated_function_md)
                )


def __update_column_md(table_md: dict, column_md_updater: Callable[[dict], None]) -> None:
    columns_md = table_md['column_md']
    assert isinstance(columns_md, dict)
    for column_md in columns_md.values():
        column_md_updater(column_md)


def __update_external_store_md(table_md: dict, external_store_md_updater: Callable[[dict], None]) -> None:
    stores_md = table_md['external_stores']
    assert isinstance(stores_md, list)
    for store_md in stores_md:
        external_store_md_updater(store_md)


def __substitute_md_rec(md: Any, substitution_fn: Callable[[str | None, Any], tuple[str | None, Any] | None]) -> Any:
    if isinstance(md, dict):
        updated_dict: dict[str, Any] = {}
        for k, v in md.items():
            assert isinstance(k, str)
            substitute = substitution_fn(k, v)
            if substitute is not None:
                updated_k, updated_v = substitute
                updated_dict[updated_k] = __substitute_md_rec(updated_v, substitution_fn)
            else:
                updated_dict[k] = __substitute_md_rec(v, substitution_fn)
        return updated_dict
    elif isinstance(md, list):
        updated_list: list[Any] = []
        for v in md:
            substitute = substitution_fn(None, v)
            if substitute is not None:
                _, updated_v = substitute
                updated_list.append(__substitute_md_rec(updated_v, substitution_fn))
            else:
                updated_list.append(__substitute_md_rec(v, substitution_fn))
        return updated_list
    else:
        return md


def convert_table_schema_version_md(
    conn: sql.Connection,
    table_schema_version_md_updater: Callable[[dict], None] | None = None,
    schema_column_updater: Callable[[dict], None] | None = None,
) -> None:
    """
    Converts schema.TableSchemaVersionMd dicts based on the specified conversion functions.

    Args:
        conn: The SQLAlchemy connection to run the conversion on.
        table_schema_version_md_updater: A function that updates schema.TableSchemaVersionMd dicts in place.
        schema_column_updater: A function that updates schema.SchemaColumn dicts in place.
    """
    stmt = sql.select(TableSchemaVersion.tbl_id, TableSchemaVersion.schema_version, TableSchemaVersion.md)
    for row in conn.execute(stmt):
        tbl_id, schema_version, md = row[0], row[1], row[2]
        assert isinstance(md, dict)
        updated_md = copy.deepcopy(md)
        if table_schema_version_md_updater is not None:
            table_schema_version_md_updater(updated_md)
        if schema_column_updater is not None:
            __update_schema_column(updated_md, schema_column_updater)
        if updated_md != md:
            __logger.info(f'Updating TableSchemaVersion(tbl_id={tbl_id}, schema_version={schema_version})')
            update_stmt = (
                sql.update(TableSchemaVersion)
                .where(TableSchemaVersion.tbl_id == tbl_id)
                .where(TableSchemaVersion.schema_version == schema_version)
                .values(md=updated_md)
            )
            conn.execute(update_stmt)


def __update_schema_column(table_schema_version_md: dict, schema_column_updater: Callable[[dict], None]) -> None:
    cols = table_schema_version_md['columns']
    assert isinstance(cols, dict)
    for schema_col in cols.values():
        schema_column_updater(schema_col)


T = TypeVar('T')


def convert_sql_table_record(schema: type[T], conn: sql.Connection, record_updater: Callable[[T], None]) -> None:
    # Run the ORM updates within the caller's transaction: a savepoint-bound session flushes onto conn and
    # commit() releases the savepoint, leaving the enclosing transaction to commit the changes.
    with sql.orm.Session(bind=conn, join_transaction_mode='create_savepoint') as session:
        for record in session.query(schema).all():
            record_updater(record)
        session.commit()

```

### Core Architecture Module: `pixeltable/metadata/utils.py`
```
from __future__ import annotations

from dataclasses import fields

import pixeltable.type_system as ts
from pixeltable.metadata import schema


class MetadataUtils:
    @classmethod
    def _diff_md(
        cls, old_md: dict[int, schema.SchemaColumn] | None, new_md: dict[int, schema.SchemaColumn] | None
    ) -> str:
        """Return a string reporting the differences in a specific entry in two dictionaries

        Results are formatted as follows:
        - If `old_md` is `None`, returns 'Initial Version'.
        - If `old_md` and `new_md` are the same, returns an empty string.
        - If there are additions, changes, or deletions, returns a string summarizing the changes.
        """
        assert new_md is not None
        if old_md is None:
            return 'Initial Version'
        if old_md == new_md:
            return ''
        # added, altered, and dropped track diffs of user-visible columns only. That's what we want to report to users
        # in the end.
        added: list[str] = []
        dropped: list[str] = []
        altered: dict[str, str] = {}

        for col_id, new_col in new_md.items():
            if col_id not in old_md:
                if new_col.name is not None:
                    added.append(new_col.name)
                continue
            old_col = old_md[col_id]
            diff = cls._diff_col(old_col, new_col)
            if diff is not None:
                if old_col.name is not None:
                    assert new_col.name is not None, "A user-visible column can't become a system column"
                    altered[old_col.name] = diff
                else:
                    assert new_col.name is None, "A system column can't become user-visible"

        for col_id, old_col in old_md.items():
            if col_id not in new_md and old_col.name is not None:
                dropped.append(old_col.name)

        user_visible_changes = len(added) > 0 or len(altered) > 0 or len(dropped) > 0
        if not user_visible_changes:
            # TODO: adding/dropping an embedding index will not be displayed
            return ''

        # Format the result
        t = []
        if len(added) > 0:
            t.append('Added: ' + ', '.join(added))
        if len(altered) > 0:
            t.append('Altered: ' + ', '.join((f'{name} ({desc})' for name, desc in altered.items())))
        if len(dropped) > 0:
            t.append('Dropped: ' + ', '.join(dropped))
        return ', '.join(t)

    @classmethod
    def _diff_col(cls, old: schema.SchemaColumn, new: schema.SchemaColumn) -> str | None:
        """Compares two SchemaColumn objects and returns a string describing the differences, or None if they are
        the same.
        """
        assert len(fields(old)) == 8, 'This method needs to be updated whenever SchemaColumn changes'
        diff: list[str] = []
        # Note: we ignore pos because columns changing places are not very interesting to users, and because they are
        # usually a side effect of other changes such as drop column.
        if old.name != new.name:
            diff.append(f'renamed to {new.name}')
        assert old.is_pk == new.is_pk, 'Not implemented: describe a primary key change'
        if old.col_type != new.col_type:
            type_ = ts.ColumnType.from_dict(new.col_type)
            diff.append(f'type changed to {type_!r}')
        if old.value_expr != new.value_expr:
            diff.append('value expression changed')
        assert old.media_validation == new.media_validation, 'Not implemented: describe a media validation change'
        assert old.comment == new.comment, 'Not implemented: describe a comment change'
        assert old.custom_metadata == new.custom_metadata, 'Not implemented: describe a custom metadata change'

        if len(diff) > 0:
            return ', '.join(diff)
        return None

    @classmethod
    def create_md_change_dict(cls, md_list: list[tuple[int, dict[int, schema.SchemaColumn]]] | None) -> dict[int, str]:
        """Return a dictionary of schema changes by version
        Args:
            md_list: a list of tuples, each containing a version number and a metadata dictionary.
        """
        r: dict[int, str] = {}
        if md_list is None or len(md_list) == 0:
            return r

        # Sort the list in place by version number
        md_list.sort()

        first_retrieved_version = md_list[0][0]
        if first_retrieved_version == 0:
            prev_md = None
            prev_ver = -1
            start = 0
        else:
            prev_md = md_list[0][1]
            prev_ver = first_retrieved_version
            start = 1

        for ver, curr_md in md_list[start:]:
            if ver == prev_ver:
                continue
            assert ver > prev_ver
            tf = cls._diff_md(prev_md, curr_md)
            if tf != '':
                r[ver] = tf
            prev_md = curr_md
        return r

```

### Core Architecture Module: `pixeltable/utils/__init__.py`
```
import hashlib
import urllib.parse
import urllib.request
from pathlib import Path


def print_perf_counter_delta(delta: float) -> str:
    """Prints a performance counter delta in a human-readable format.

    Args:
        delta: delta in seconds

    Returns:
        Human-readable string
    """
    if delta < 1e-6:
        return f'{delta * 1e9:.2f} ns'
    elif delta < 1e-3:
        return f'{delta * 1e6:.2f} us'
    elif delta < 1:
        return f'{delta * 1e3:.2f} ms'
    else:
        return f'{delta:.2f} s'


def sha256sum(path: Path | str) -> str:
    """
    Compute the SHA256 hash of a file.
    """
    if isinstance(path, str):
        path = Path(path)

    h = hashlib.sha256()
    with open(path, 'rb') as file:
        while chunk := file.read(h.block_size):
            h.update(chunk)

    return h.hexdigest()


def parse_local_file_path(file_or_url: str) -> Path | None:
    """
    Parses a string that may be either a URL or a local file path.

    If the string is a local file path or a file-scheme URL (file://), then a Path object will be returned.
    Otherwise, None will be returned.
    """
    parsed = urllib.parse.urlparse(file_or_url)
    if len(parsed.scheme) <= 1:
        # We're using `urlparse` to help distinguish file paths from URLs. If there is no scheme, then it's a file path.
        # If there's a single-character scheme, we also interpret this as a file path; this insures that drive letters
        # on Windows pathnames are correctly handled.
        return Path(file_or_url).absolute()
    elif parsed.scheme == 'file':
        return Path(urllib.parse.unquote(urllib.request.url2pathname(parsed.path)))
    else:
        return None

```

### Core Architecture Module: `pixeltable/utils/app_module.py`
```
"""Utilities for app modules (those containing table models and FastAPIRouter instances)."""

from __future__ import annotations

import importlib
import keyword
import linecache
import re
import sys
import threading
import traceback
from collections.abc import Iterable
from pathlib import Path
from types import ModuleType
from typing import TYPE_CHECKING, Any

from pixeltable import exceptions as excs
from pixeltable.catalog import ProhibitedWriteError, is_valid_identifier, model
from pixeltable.catalog.model import diff
from pixeltable.config import Config
from pixeltable.env import Env
from pixeltable.func import FunctionRegistry
from pixeltable.runtime import get_runtime
from pixeltable.utils.project import in_environment
from pixeltable_cli.types import CheckReport, RouteSpec, ServiceSpec

_lock = threading.RLock()

# the packages this process is running, which stay loaded even when the project holds a checkout of them:
# re-importing them would leave two of every class
_RUNNING_PACKAGES = ('pixeltable', 'pixeltable_cli')

# TODO: Catalog needs to discard cached TableVersion that references reloaded modules

if TYPE_CHECKING:
    import fastapi

    from pixeltable.serving import FastAPIRouter


def module_name(file: str, *, subject: str) -> str:
    """The dotted import path of 'file', relative to the project root."""
    path = Path(file).resolve()
    if not path.is_file():
        raise excs.RequestError(excs.ErrorCode.INVALID_ARGUMENT, f'{subject} not found: {file}')

    # Env.get() establishes the project root
    Env.get()
    root = Config.get().project_root
    if root is None or not path.is_relative_to(root):
        raise excs.RequestError(excs.ErrorCode.INVALID_ARGUMENT, _no_root_msg(path, subject, root))
    relative = path.relative_to(root).with_suffix('')
    for part in relative.parts:
        if not part.isidentifier() or keyword.iskeyword(part):
            raise excs.RequestError(
                excs.ErrorCode.INVALID_ARGUMENT,
                f'{path}: {part!r} is not a module name, so this {subject} cannot be imported; rename it, or '
                f'the directory holding it, to a Python identifier',
            )
    return '.'.join(relative.parts)


def load_app_module(file: str, *, subject: str) -> ModuleType:
    """Import file under the module path relative to the project root."""
    path = Path(file).resolve()
    name = module_name(file, subject=subject)

    # resolve the catalog first: initializing it writes, which freeze() would refuse
    catalog = get_runtime().catalog
    try:
        registry = FunctionRegistry.get()
        with _lock, catalog.freeze():
            _evict_project_modules()
            # a file written after this process started is invisible to a finder that cached its directory
            importlib.invalidate_caches()
            registered = set(registry.module_fns)
            try:
                return importlib.import_module(name)
            except BaseException:
                # a module that raises partway through leaves the udfs it already defined registered, and
                # Python drops it from sys.modules, so _evict_project_modules() cannot reach them again
                registry.deregister_functions(set(registry.module_fns) - registered)
                raise
    except ProhibitedWriteError as e:
        raise excs.RequestError(
            excs.ErrorCode.UNSUPPORTED_OPERATION, _prohibited_write_msg(str(path), subject, e)
        ) from e
    except excs.Error as e:
        raise excs.RequestError(excs.ErrorCode.INVALID_ARGUMENT, f'error loading {file}: {e}') from e
    except Exception as e:
        reason = f'{type(e).__name__}: {e}' if str(e) else type(e).__name__
        raise excs.RequestError(excs.ErrorCode.INVALID_ARGUMENT, f'error loading {file}: {reason}') from e


def _no_root_msg(path: Path, subject: str, root: Path | None) -> str:
    """Report the project root, and what to do about a file outside it."""
    rule = (
        f'A UDF is recorded as a module path relative to the project root, which is the directory holding '
        f'the project configuration, so this {subject} has to sit under that root.'
    )
    if root is None:
        return (
            f'{path}: there is no project root. Searched {Path.cwd()} and every directory above it for '
            f'a project configuration: a pixeltable.toml, or a pyproject.toml with a [tool.pixeltable] '
            f'section.\n'
            f'{rule}\n'
            f"Run 'pxt init' in the directory that holds your project, then run this command again."
        )
    return (
        f'{path}: the project root is {root}, which the file does not sit under.\n'
        f'{rule}\n'
        "Run this command from the file's own project."
    )


def _evict_project_modules() -> None:
    """Remove the project's own modules from sys.modules, and their udfs from the registry.

    Removing project modules allows us to have them re-imported, in response to changes to the source files.

    The standard library and installed packages stay loaded, including when the environment sits inside the
    project root (eg, a .venv).
    """
    root = Config.get().project_root
    assert root is not None  # module_name() refuses a file outside a project root
    registry = FunctionRegistry.get()
    for name, module in list(sys.modules.items()):
        module_file = getattr(module, '__file__', None)
        if module_file is None or name == '__main__':
            continue
        if name.split('.', maxsplit=1)[0] in _RUNNING_PACKAGES:
            continue
        # the file path lets us distinguish between a project module and a standard library module
        resolved = Path(module_file).resolve()
        if in_environment(resolved):
            continue
        if resolved.is_relative_to(root):
            registry.deregister_module(name)
            sys.modules.pop(name, None)


def _prohibited_write_msg(file: str, subject: str, exc: ProhibitedWriteError) -> str:
    """Report which statement in file modified the catalog, and what to write instead."""
    location = ''
    for frame, lineno in traceback.walk_tb(exc.__traceback__):
        if frame.f_code.co_filename == file:
            statement = (linecache.getline(file, lineno) or '').strip()
            location = f'line {lineno}: {statement}\n' if statement != '' else f'line {lineno}\n'
    return (
        f'{file}: this {subject} modifies the catalog while it is imported.\n'
        f'{location}'
        'Define a table with a model class, and insert rows from a route or a script; '
        "'pxt schema update' then creates and populates them."
    )


def get_model_bases(module: ModuleType) -> list[model.TableModelMeta]:
    """Returns the model bases found in module."""
    # a model base carries __registered_models__ as its own class attribute, whereas the models defined
    # on it merely inherit it
    bases = [
        v
        for v in vars(module).values()
        if isinstance(v, model.TableModelMeta) and '__registered_models__' in v.__dict__
    ]
    return bases


def visible_models(module: ModuleType) -> dict[str, model.TableModelMeta]:
    """Every model the module reaches by name, keyed by the table name each defines."""
    models: dict[str, model.TableModelMeta] = {}
    for value in vars(module).values():
        if not isinstance(value, model.TableModelMeta):
            continue
        # a model base carries __registered_models__ as its own class attribute
        if '__registered_models__' in value.__dict__:
            models.update({m.__table_spec__['name']: m for m in value.defined_models()})
        else:
            models[value.__table_spec__['name']] = value
    return models


def validate_models(models: dict[str, model.TableModelMeta], base_path: str) -> str | None:
    """Validates models against their corresponding tables in base_path, returns None if they match, otherwise an
    error string."""
    diffs = diff.validate_models(models, base_path)
    mismatched = {name: d for name, d in diffs.items() if d.resolution != 'up_to_date'}
    if len(mismatched) == 0:
        return None

    detail = '\n'.join(line for name, d in mismatched.items() for line in diff.format_diff(name, d))
    target = '' if base_path == '' else f' {base_path}'
    unsupported = sorted(name for name, d in mismatched.items() if d.resolution == 'unsupported')
    if len(unsupported) == 0:
        hint = f'Run `pxt schema update <app file>{target}` first.'
    else:
        hint = (
            f'No schema update can reconcile {", ".join(repr(name) for name in unsupported)}: adjust the '
            'existing table(s) manually, or adjust the models to be consistent with the catalog.'
        )
        if len(unsupported) < len(mismatched):
            hint += f'\nRun `pxt schema update <app file>{target}` for the rest.'
    names = ', '.join(repr(name) for name in sorted(mismatched))
    return f'Cannot serve {names}:\n{detail}\n{hint}'


def check_report(file: str, bases: list[model.TableModelMeta]) -> CheckReport:
    """What checking a file on its own reports: whether it is valid, and what to fix or to know about."""
    errors = check_udf_references(bases)
    return CheckReport(file=file, valid=len(errors) == 0, errors=errors, warnings=shadowed_project_modules())


def check_udf_references(bases: list[model.TableModelMeta]) -> list[str]:
    """Returns error strings for udf references in 'bases' that cannot be resolved."""
    project_root = Config.get().project_root
    assert project_root is not None
    errors: list[str] = []
    fn_paths = {fn.self_path for base in bases for cls in base.defined_models() for fn in cls.referenced_functions()}
    for fn_path in sorted(p for p in fn_paths if p is not None):
        resolved = _resolved_module(fn_path)
        if resolved is None:
            errors.append(f'{fn_path}: cannot be resolved to a known module')
            continue
        file = getattr(resolved, 
```

### Core Architecture Module: `pixeltable/utils/arrow.py`
```
import datetime
import io
import uuid
from typing import TYPE_CHECKING, Any, Callable, Iterable, Iterator, Mapping, cast

import numpy as np
import PIL.Image
import pyarrow as pa

import pixeltable.exceptions as excs
import pixeltable.type_system as ts

if TYPE_CHECKING:
    import pixeltable as pxt

PA_TO_PXT_TYPES: dict[pa.DataType, ts.ColumnType] = {
    pa.string(): ts.StringType(nullable=True),
    pa.large_string(): ts.StringType(nullable=True),
    pa.timestamp('us', tz='UTC'): ts.TimestampType(nullable=True),
    pa.bool_(): ts.BoolType(nullable=True),
    pa.int8(): ts.IntType(nullable=True),
    pa.int16(): ts.IntType(nullable=True),
    pa.int32(): ts.IntType(nullable=True),
    pa.int64(): ts.IntType(nullable=True),
    pa.uint8(): ts.IntType(nullable=True),
    pa.uint16(): ts.IntType(nullable=True),
    pa.uint32(): ts.IntType(nullable=True),
    pa.uint64(): ts.IntType(nullable=True),
    pa.float32(): ts.FloatType(nullable=True),
    pa.float64(): ts.FloatType(nullable=True),
    pa.date32(): ts.DateType(nullable=True),
    pa.date64(): ts.DateType(nullable=True),
    pa.uuid(): ts.UUIDType(nullable=True),
    pa.binary(): ts.BinaryType(nullable=True),
}

PXT_TO_PA_TYPES: dict[type[ts.ColumnType], pa.DataType] = {
    ts.StringType: pa.string(),
    ts.TimestampType: pa.timestamp('us', tz='UTC'),  # postgres timestamp is microseconds
    ts.DateType: pa.date32(),  # This could be date64
    ts.UUIDType: pa.uuid(),
    ts.BoolType: pa.bool_(),
    ts.IntType: pa.int64(),
    ts.FloatType: pa.float32(),
    ts.BinaryType: pa.binary(),
    ts.ImageType: pa.binary(),  # inline image
    ts.AudioType: pa.string(),  # path
    ts.VideoType: pa.string(),  # path
    ts.DocumentType: pa.string(),  # path
    # ts.JsonType is ommitted, because mapping to pa.StructType requires schema
}


def to_pxt_type(arrow_type: pa.DataType, nullable: bool) -> ts.ColumnType | None:
    """Convert a pyarrow DataType to a pixeltable ColumnType if one is defined.
    Returns None if no conversion is currently implemented.
    """
    if isinstance(arrow_type, pa.TimestampType):
        return ts.TimestampType(nullable=nullable)
    elif isinstance(arrow_type, pa.StructType):
        return ts.JsonType(nullable=nullable)
    elif arrow_type in PA_TO_PXT_TYPES:
        pt = PA_TO_PXT_TYPES[arrow_type]
        return pt.copy(nullable=nullable) if pt is not None else None
    elif isinstance(arrow_type, pa.FixedShapeTensorType):
        dtype = to_pxt_type(arrow_type.value_type, nullable)
        if dtype is None:
            return None
        return ts.ArrayType(shape=tuple(arrow_type.shape), dtype=dtype, nullable=nullable)
    else:
        return None


def to_arrow_type(pxt_type: ts.ColumnType) -> pa.DataType | None:
    """Convert a pixeltable DataType to a pyarrow datatype if one is defined.
    Returns None if no conversion is currently implemented.
    """
    if pxt_type.__class__ in PXT_TO_PA_TYPES:
        return PXT_TO_PA_TYPES[pxt_type.__class__]
    elif isinstance(pxt_type, ts.ArrayType):
        shape = pxt_type.shape
        if shape is None:
            raise excs.RequestError(
                excs.ErrorCode.UNSUPPORTED_OPERATION, 'Cannot convert array column of unknown shape to arrow.'
            )
        if any(d is None for d in shape):
            # we need to map this to a nested list of the dtype
            arrow_type = pa.from_numpy_dtype(pxt_type.dtype)
            for _ in shape:
                arrow_type = pa.list_(arrow_type)
            return arrow_type

        return pa.fixed_shape_tensor(pa.from_numpy_dtype(pxt_type.dtype), pxt_type.shape)
    else:
        return None


def to_arrow_schema(
    pxt_schema: dict[str, ts.ColumnType], schema_overrides: Mapping[str, pa.DataType] | None = None
) -> pa.Schema:
    """Build a deterministic `pa.Schema` from a pixeltable schema, without requiring any data.

    Each column type is mapped to its arrow equivalent via `to_arrow_type()`. A JSON column has no
    fixed arrow type without sampling its values, so it is mapped to an empty `pa.struct([])`.

    `schema_overrides` maps a column name to the arrow type that should be used instead of the
    default mapping; useful for pinning JSON columns or downcasting scalar types.
    """
    pa_column_types: dict[str, pa.DataType] = {}
    for col_name, col_type in pxt_schema.items():
        if schema_overrides is not None and col_name in schema_overrides:
            pa_column_types[col_name] = schema_overrides[col_name]
            continue
        if col_type.is_json_type():
            pa_column_types[col_name] = pa.struct([])
            continue
        arrow_type = to_arrow_type(col_type)
        if arrow_type is None:
            raise excs.RequestError(
                excs.ErrorCode.UNSUPPORTED_OPERATION, f'Cannot convert column {col_name!r} of type {col_type} to arrow.'
            )
        pa_column_types[col_name] = arrow_type
    return pa.schema(pa_column_types.items())


def to_pxt_schema(
    arrow_schema: pa.Schema, schema_overrides: dict[str, Any], primary_key: list[str]
) -> dict[str, ts.ColumnType]:
    """Convert a pyarrow Schema to a schema using pyarrow names and pixeltable types."""
    pxt_schema = {
        field.name: to_pxt_type(field.type, field.name not in primary_key)
        if field.name not in schema_overrides
        else schema_overrides[field.name]
        for field in arrow_schema
    }
    return pxt_schema


def _to_record_batch(
    column_vals: dict[str, list[Any]],
    schema: pa.Schema,
    pxt_schema: dict[str, ts.ColumnType],
    schema_overrides: Mapping[str, pa.DataType] | None = None,
) -> pa.RecordBatch:
    import pyarrow as pa

    pa_arrays: list[pa.Array] = []
    for field in schema:
        assert field.name in pxt_schema
        pxt_type = pxt_schema[field.name]
        if schema_overrides is not None and field.name in schema_overrides:
            try:
                pa_arrays.append(pa.array(column_vals[field.name], type=field.type))
            except (pa.ArrowInvalid, pa.ArrowTypeError, pa.ArrowNotImplementedError) as e:
                raise excs.RequestError(
                    excs.ErrorCode.TYPE_MISMATCH,
                    f'schema_overrides type {field.type} does not fit the data for column {field.name!r}: {e}',
                ) from e
        elif isinstance(field.type, pa.FixedShapeTensorType):
            stacked_arr = np.stack(column_vals[field.name])
            pa_arrays.append(pa.FixedShapeTensorArray.from_numpy_ndarray(stacked_arr))
        elif pxt_type.is_array_type() and isinstance(field.type, pa.ListType):
            # convert ragged arrays to nested lists
            list_col_vals = [val.tolist() if val is not None else None for val in column_vals[field.name]]
            pa_arrays.append(pa.array(list_col_vals))
        elif pxt_type.is_json_type():
            # JSON columns are typed by `pa.infer_type()` against the first batch's values; later batches
            # can still contain values that don't fit (e.g. an inferred `struct<x: int64>` from the first
            # batch and a `{'x': 'foo'}` value in a later batch). Catch that here and surface a clear error.
            try:
                pa_arrays.append(pa.array(column_vals[field.name], type=field.type))
            except (pa.ArrowInvalid, pa.ArrowTypeError) as e:
                raise excs.RequestError(
                    excs.ErrorCode.UNSUPPORTED_OPERATION,
                    f'JSON column {field.name!r} contains values that cannot be coerced to a single '
                    f'arrow type {field.type} (e.g. a list with mixed element types).',
                ) from e
        else:
            pa_array = cast(pa.Array, pa.array(column_vals[field.name]))
            pa_arrays.append(pa_array)
    return pa.RecordBatch.from_arrays(pa_arrays, schema=schema)


def to_record_batches(
    query: 'pxt.Query', batch_size_bytes: int, schema_overrides: Mapping[str, pa.DataType] | None = None
) -> Iterator[pa.RecordBatch]:
    # KNOWN RACE: schema is snapshotted here, outside any xact; query.cursor() below opens
    # its own xact internally and re-resolves the schema. For SELECT * queries, a concurrent
    # schema mutation between these two reads can produce a layout mismatch.
    yield from record_batches_from_rows(
        query.schema, query.cursor(), batch_size_bytes, schema_overrides, on_expr_eval_err=query._raise_expr_eval_err
    )


def record_batches_from_rows(
    schema: dict[str, ts.ColumnType],
    rows: Iterable[Mapping[str, Any]],
    batch_size_bytes: int,
    schema_overrides: Mapping[str, pa.DataType] | None = None,
    *,
    on_expr_eval_err: Callable[[excs.ExprEvalError], Any] | None = None,
) -> Iterator[pa.RecordBatch]:
    """Encode rows into arrow RecordBatches, matching the parquet encoding produced for query exports."""
    arrow_schema: pa.Schema | None = None  # initialized after first batch, when we have data to infer struct schemas
    batch_columns: dict[str, list[Any]] = {k: [] for k in schema}
    current_byte_estimate = 0
    num_batch_rows = 0
    json_val_size: dict[str, int] = {}  # key: col_name, value: average size of corresponding pa.struct
    json_batch_size: dict[str, int] = {}  # per-column cumulative size of json/struct values for first batch

    def create_arrow_schema() -> None:
        nonlocal arrow_schema
        if arrow_schema is not None:
            return
        pa_column_types: dict[str, pa.DataType] = {}
        for col_name, col_type in schema.items():
            if schema_overrides is not None and col_name in schema_overrides:
                pa_column_types[col_name] = schema_overrides[col_name]
            elif col_type.is_json_type():
                try:
                    pa_type = pa.infer_type(batch_columns[col_name], mask=None)
                except (pa.lib.ArrowInvalid, pa.lib.ArrowTypeError) as e:
                    raise excs.RequestError(
                        excs.ErrorCode.UN
```

### Core Architecture Module: `pixeltable/utils/av.py`
```
import logging
import re
import subprocess
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path
from types import TracebackType
from typing import Any, Iterator, NoReturn, Self

import av
import PIL.Image

import pixeltable as pxt
from pixeltable.env import Env

_logger = logging.getLogger(__name__)

# format -> (codec, extension)
AUDIO_FORMATS: dict[str, tuple[str, str]] = {
    'wav': ('pcm_s16le', 'wav'),
    'mp3': ('libmp3lame', 'mp3'),
    'flac': ('flac', 'flac'),
    'mp4': ('aac', 'm4a'),
}


def get_video_duration(path: str) -> float | None:
    """Return video duration in seconds."""
    with av.open(path) as container:
        if len(container.streams.video) == 0:
            return None
        video_stream = container.streams.video[0]

        # Prefer stream-level duration from the header
        if video_stream.duration is not None:
            return float(video_stream.duration * video_stream.time_base)

        # use container duration if we don't have audio streams (which might be longer than the video stream)
        if len(container.streams.audio) == 0 and container.duration is not None:
            return container.duration / 1_000_000

        # Fall back to scanning packets to find the latest presentation timestamp.
        # We track the maximum PTS rather than the last packet's PTS because B-frame reordering
        # (common in h264/h265) means packets are demuxed in decode order, not presentation order.
        # The last demuxed packet may be a B-frame that presents before the final I/P frame.
        max_pts: int | None = None  # max observed packet.pts
        max_pts_duration: int | None = None  # duration of that packet
        for packet in container.demux(video_stream):
            if packet.pts is not None and (max_pts is None or packet.pts > max_pts):
                max_pts = packet.pts
                max_pts_duration = packet.duration
        if max_pts is not None:
            end_pts = max_pts + (max_pts_duration or 0)
            result = float(end_pts * video_stream.time_base)
            # the video stream can't be longer than the container, but some demuxers
            # (e.g. MPEG) emit trailing packets past the real end
            if container.duration is not None:
                result = min(result, container.duration / 1_000_000)
            return result

        return None


def get_audio_duration(path: str) -> float | None:
    """
    Return audio duration in seconds, or None if there is no audio stream or the duration cannot be determined.
    """
    with av.open(path) as container:
        if len(container.streams.audio) == 0:
            return None
        audio_stream = container.streams.audio[0]

        # prefer stream-level duration from the header
        if audio_stream.duration is not None:
            return float(audio_stream.duration * audio_stream.time_base)

        # use container duration if we have no video streams that might be longer than the audio
        if len(container.streams.video) == 0 and container.duration is not None:
            return container.duration / 1_000_000

        # Fall back to decoding all audio frames and counting samples. This handles formats like
        # FLAC that don't always expose duration in the stream header.
        sample_rate = audio_stream.codec_context.sample_rate
        if sample_rate is None or sample_rate == 0:
            return None
        n_samples = 0
        for frame in container.decode(audio=0):
            n_samples += frame.samples
        return n_samples / sample_rate if n_samples > 0 else None


_MAX_VOLUME_PATTERN = re.compile(r'max_volume:\s*(-?\d+(?:\.\d+)?)\s*dB')


def get_max_volume_db(path: str) -> float | None:
    """
    Measure the peak amplitude of an audio clip in dBFS.

    Returns the max volume as a non-positive number (0 dBFS = full scale), or None if the clip
    is silent or has no audio stream.
    """
    Env.get().require_binary('ffmpeg')
    # -vn/-sn/-dn: ignore non-audio streams; -f null -: discard the output, we only want stderr.
    # Explicit -loglevel info so volumedetect's report reaches us regardless of the build default.
    cmd = ['ffmpeg', '-i', path, '-vn', '-sn', '-dn', '-af', 'volumedetect', '-f', 'null', '-loglevel', 'info', '-']
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as e:
        handle_ffmpeg_error(e)
    # Stderr lines look like: "[Parsed_volumedetect_0 @ 0x...] max_volume: -6.0 dB"
    m = re.search(_MAX_VOLUME_PATTERN, result.stderr)
    return float(m.group(1)) if m is not None else None


def has_audio_stream(path: str) -> bool:
    """Check if video has audio stream using PyAV."""
    with av.open(path) as container:
        assert isinstance(container, av.container.InputContainer)
        return any(stream.type == 'audio' for stream in container.streams)


# bytes of memory per pixel of decoded frames, by pixel format
BYTES_PER_PIXEL = {
    # 8-bit 4:2:0: chroma planes are quarter size
    'yuv420p': 1.5,
    'yuvj420p': 1.5,
    # 8-bit 4:2:2: chroma planes are half size
    'yuv422p': 2.0,
    'yuvj422p': 2.0,
    # 8-bit 4:4:4: all planes full size
    'yuv444p': 3.0,
    'yuvj444p': 3.0,
    # packed 4:2:0 variants (Android/camera common)
    'nv12': 1.5,
    'nv21': 1.5,
    # 10-bit variants (HDR content)
    'yuv420p10le': 3.0,
    'yuv420p10be': 3.0,
    'yuv422p10le': 4.0,
    'yuv422p10be': 4.0,
    'yuv444p10le': 6.0,
    'yuv444p10be': 6.0,
    'p010le': 3.0,
    'p010be': 3.0,
    # 12-bit variants
    'yuv420p12le': 3.0,
    'yuv420p12be': 3.0,
    'yuv422p12le': 4.0,
    'yuv422p12be': 4.0,
    'yuv444p12le': 6.0,
    'yuv444p12be': 6.0,
    # RGB/RGBA
    'rgb24': 3.0,
    'bgr24': 3.0,
    'rgba': 4.0,
    'bgra': 4.0,
    'rgb48le': 6.0,
    'rgb48be': 6.0,
    'rgba64le': 8.0,
    'rgba64be': 8.0,
}

DEFAULT_BYTES_PER_PIXEL = 3.0  # a conservative fallback for unknown formats


def estimate_segment_duration(path: str, approx_decoded_bytes: int) -> float | None:
    """
    Return the length of a segment for which the combined in-memory size of all its decoded frames is roughly
    approx_decoded_bytes.

    Returns None f the frame rate or dimensions cannot be determined.
    """

    with av.open(path) as container:
        if len(container.streams.video) == 0:
            return None
        video_stream = container.streams.video[0]
        width = video_stream.width
        height = video_stream.height
        pix_fmt = video_stream.codec_context.pix_fmt

        if width <= 0 or height <= 0:
            return None

        if video_stream.average_rate is None or video_stream.average_rate == 0:
            return None
        fps = float(video_stream.average_rate)

    bpp = BYTES_PER_PIXEL.get(pix_fmt, DEFAULT_BYTES_PER_PIXEL)
    bytes_per_frame = width * height * bpp
    frames_per_segment = approx_decoded_bytes / bytes_per_frame
    return frames_per_segment / fps


def handle_ffmpeg_error(e: subprocess.CalledProcessError) -> NoReturn:
    error_msg = f'ffmpeg failed with return code {e.returncode}'
    if e.stderr is not None:
        error_msg += f':\n{e.stderr.strip()}'
    raise pxt.RequestError(pxt.ErrorCode.INVALID_DATA_FORMAT, error_msg) from e


def run_ffmpeg_cmdline(
    ffmpeg_args: list[str],
    output_path: str,
    encode_video: bool = False,
    video_encoder: str | None = None,
    video_encoder_args: dict[str, Any] | None = None,
) -> str:
    """
    Create and run an ffmpeg commandline, verify the output file, and return its path.

    If encode_video==True, command is expected to encode video and requires video encoder args
    """
    cmd = ['ffmpeg', *ffmpeg_args]
    if encode_video:
        append_video_encoder(cmd, video_encoder, video_encoder_args)
    # loglevel=error: avoid excessive logging
    cmd += ['-loglevel', 'error', output_path]

    try:
        _logger.debug(f'running ffmpeg commandline: {" ".join(cmd)}')
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        output_file = Path(output_path)
        if not output_file.exists() or output_file.stat().st_size == 0:
            stderr_output = result.stderr.strip() if result.stderr is not None else ''
            raise pxt.RequestError(
                pxt.ErrorCode.INVALID_DATA_FORMAT,
                f'ffmpeg failed to create output file for commandline: {" ".join(cmd)}\n{stderr_output}',
            )
        return output_path
    except subprocess.CalledProcessError as e:
        handle_ffmpeg_error(e)


def append_video_encoder(
    cmd: list[str], video_encoder: str | None = None, video_encoder_args: dict[str, Any] | None = None
) -> None:
    """Append video encoder-related args to ffmpeg cmdline."""
    if video_encoder is None:
        video_encoder = Env.get().default_video_encoder
    if video_encoder is not None:
        cmd.extend(['-c:v', video_encoder])
    if video_encoder_args is not None:
        for k, v in video_encoder_args.items():
            cmd.extend([f'-{k}', str(v)])


def ffmpeg_clip_args(
    input_path: str,
    start_time: float,
    duration: float | None = None,
    fast: bool = True,
    video_encoder: str | None = None,
    video_encoder_args: dict[str, Any] | None = None,
) -> list[str]:
    """Construct args for an ffmpeg commandline that creates a clip."""
    cmd: list[str] = []
    if fast:
        # fast: -ss before -i
        cmd.extend(
            [
                '-ss',
                str(start_time),
                '-i',
                input_path,
                '-map',
                '0',  # Copy all streams from input
                '-c',
                'copy',  # Stream copy (no re-encoding)
            ]
        )
    else:
        if video_encoder is None:
            video_encoder = Env.get().default_video_encoder

        # accurate: -ss after -i
        cmd.extend(
            [
               
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1353** (2026-07-08): **Need to manually type cast JSON/Dict values to do downstream computations**
  *Symptoms*: From PyCon US 2026 @mkornacker asked me to post this issue.  When parsing existing JSON data, the resulting computing column remains a JSON column, even when the JSON value is an integer (in this example). This means that downstream arithmetic calculations will fail with a postgres error.  Reprex below:  ## Setup  ```python import pixeltable as pxt  pxt.create_dir('quickstart', if_exists='replace_force') t = pxt.create_table('quickstart/images', {'image': pxt.Image}, if_exists='replace_force')  t.insert([   {'image': 'https://raw.githubusercontent.com/pixeltable/pixeltable/release/docs/resources/images/000000000001.jpg'},   {'image': 'https://raw.githubusercontent.com/pixeltable/pixeltable/release/docs/resources/images/000000000025.jpg'} ])  t.add_computed_column(metadata=t.image.get_metadata())  ```  ## SQL Error  ```python # errors t.add_computed_column(width=t.metadata.width, if_exists='replace') t.add_computed_column(height=t.metadata.height, if_exists='replace') t.add_computed_column(area=(t.height * t.width), if_exists='replace') ```  error message  ``` Error: Unexpected SQL error during execution of computed column 'area': (psycopg.errors.UndefinedFunction) operator does not exist: jsonb * jsonb LINE 1: SELECT tbl_2833fb8a909b41eba4dadc04d33558ad.col_5 * tbl_2833...                                                           ^ HINT:  No operator matches the given name and argument types. You might need to add explicit type casts. [SQL: SELECT tbl_2833fb8a909b41eba4dadc04
  **Post-Mortem & Fix Analysis**:
  > @chendaniely We fixed this a little while ago (and forgot to update this issue...).  https://github.com/pixeltable/pixeltable/pull/1393

- **Issue #874** (2025-11-11): **Can't drop a FrameIterator View after having tried to create one with FPS > Video FPS.**
  *Symptoms*: Reproduction: ```python  import pixeltable as pxt  pxt.drop_dir('fps_bug', force=True) pxt.create_dir('fps_bug')  t = pxt.create_table(     'fps_bug.videos',     {         'video': pxt.Required[pxt.Video]     })  t.insert([     {         'video':'video.mp4'     }])  from pixeltable.iterators import FrameIterator  v = pxt.create_view(     'fps_bug.frames',     t,     iterator=FrameIterator.create(video=t.video, fps=30) # use fps > video fps ) ``` --> Encounter first error when creating the view, then use drop_director or try to replace the view: same error.  ```python `--------------------------------------------------------------------------- Error                                     Traceback (most recent call last) Cell In[32], [line 3](vscode-notebook-cell:?execution_count=32&line=3)       [1](vscode-notebook-cell:?execution_count=32&line=1) from pixeltable.iterators import FrameIterator ----> [3](vscode-notebook-cell:?execution_count=32&line=3) v = pxt.create_view(       [4](vscode-notebook-cell:?execution_count=32&line=4)     'fps_bug.frames',       [5](vscode-notebook-cell:?execution_count=32&line=5)     t,       [6](vscode-notebook-cell:?execution_count=32&line=6)     iterator=FrameIterator.create(video=t.video, fps=30)       [7](vscode-notebook-cell:?execution_count=32&line=7) )  File /opt/miniconda3/envs/pxt/lib/python3.10/site-packages/pixeltable/globals.py:303, in create_view(path, base, additional_columns, is_snapshot, iterator, num_retained_versions, comment, med

- **Issue #763** (2026-09-22): **udf not robust to dependency change**
  *Symptoms*: If there is a udf used in a computed column, and if that udf uses an external library (dspy 3.0.0b2 vs dspy 3.0.0b4) changing the library cause the whole table to not load/connect anymore.  for instance: ```python t = pxt.get_table("tuto.invoices") ```  result in that: ``` ----> [4](vscode-notebook-cell:?execution_count=5&line=4) t = pxt.get_table("tuto.invoices")  File ~/Projects/maximerivest-blog/.venv/lib/python3.12/site-packages/pixeltable/globals.py:454, in get_table(path)     425 """Get a handle to an existing table, view, or snapshot.     426      427 Args:    (...)    451     >>> tbl = pxt.get_table('my_table:722')     452 """     453 path_obj = catalog.Path.parse(path, allow_versioned_path=True) --> [454](https://file+.vscode-resource.vscode-cdn.net/home/maxime/Projects/maximerivest-blog/~/Projects/maximerivest-blog/.venv/lib/python3.12/site-packages/pixeltable/globals.py:454) tbl = Catalog.get().get_table(path_obj)     455 return tbl  File ~/Projects/maximerivest-blog/.venv/lib/python3.12/site-packages/pixeltable/catalog/catalog.py:102, in retry_loop.<locals>.decorator.<locals>.loop(*args, **kwargs)      94     assert not Env.get().in_xact      95     with Catalog.get().begin_xact(      96         tbl=tbl,      97         for_write=for_write,    (...)    100         finalize_pending_ops=True,     101     ): --> [102](https://file+.vscode-resource.vscode-cdn.net/home/maxime/Projects/maximerivest-blog/~/Projects/maximerivest-blog/.venv/lib/python3.12/site-packages/pix
  **Post-Mortem & Fix Analysis**:
  > It looks like you defined the udf in a notebook. Is that correct?  If so, could you please put this udf into a module and try this again? Having udfs defined in notebooks is mostly just a feature useful for tutorials and demos, and discouraged for longer-lived use cases.
  > This is fixed: a stored UDF that fails to unpickle now degrades to an InvalidFunction with a clear message instead of breaking `get_table()`. Still a good idea to keep long-lived UDFs in modules rather than notebooks. Closing.

- **Issue #704** (2025-08-19): **Rate limit error when using openai gpt4o-mini**
  *Symptoms*: RateLimitError: Error code: 429 - {'error': {'message': 'Rate limit reached for gpt-4o-mini in organization org-XXXXXXXXXXXXX on tokens per min (TPM): Limit 200000, Used 200000, Requested 775. Please try again in 232ms. Visit https://platform.openai.com/account/rate-limits to learn more.', 'type': 'tokens', 'param': None, 'code': 'rate_limit_exceeded'}}  The above exception was the direct cause of the following exception:  Error Traceback (most recent call last)  /usr/local/lib/python3.11/dist-packages/pixeltable/[store.py](http://store.py/) in load_column(self, col, exec_plan, abort_on_exc)  263 if abort_on_exc and row.has_exc():  264 exc = row.get_first_exc()  --> 265 raise excs.Error(f'Error while evaluating computed column {[col.name](http://col.name/)!r}:\n{exc}') from exc  266 table_row, num_row_exc = row_builder.create_table_row(row, None, [row.pk](http://row.pk/))  267 if col.col_type.is_media_type():  ```python  frames_view.add_computed_column(  im_caption=vision(  prompt="Describe this image in detail",  image=frames_view.resized_frame,  model="gpt-4o-mini",  )  ) ``` FYI : its only 61 frames to be captioned
  **Post-Mortem & Fix Analysis**:
  > Hi Mohamed, could you give us some more info: - what are your account rate limits for 4o-mini? (TPM, RPM, TPD) - what's the width/height of your video frames?
  > Hello , sure   1. using the TPM (200,000 tokens per minute) and TPD (2,000,000 tokens per day) limit  1.  width=1280 2.  height=720
  > @mohamedsheded Thanks for the info - we are looking into it more today and tomorrow. Our rate limit for our account is 10x/100x what you have so it's harder for us to reproduce.  Let us know if anything else comes up.

- **Issue #647** (2025-06-06): **fiftyone integration does not allow to visualize images in fifty one when the pixeltable is filled from PIL image directly**
  *Symptoms*: I am loading data to pixeltable from preexisting torch datasets, thus I might not have to urls or local path for the images I want to add in my tables. Thus I am adding them directly as PIL.Image object.  In such case, the importing in the table is working as expected. However, the images (pixel values) are not visible in FiftyOne while the metadata are well imported.  ``` import fiftyone as fo import pixeltable as pxt import requests from io import BytesIO from PIL import Image  pxt.drop_dir('fo_demo', force=True) pxt.create_dir('fo_demo')  url_prefix = 'https://raw.githubusercontent.com/pixeltable/pixeltable/main/docs/resources/images'  urls = [     'https://raw.githubusercontent.com/pixeltable/pixeltable/main/docs/resources/images/000000000019.jpg',     'https://raw.githubusercontent.com/pixeltable/pixeltable/main/docs/resources/images/000000000025.jpg',     'https://raw.githubusercontent.com/pixeltable/pixeltable/main/docs/resources/images/000000000030.jpg',     'https://raw.githubusercontent.com/pixeltable/pixeltable/main/docs/resources/images/000000000034.jpg', ]  imgs = [Image.open(BytesIO(requests.get(url).content)) for url in urls]  t = pxt.create_table('fo_demo.images', {'image': pxt.Image})  t.insert({'image': img} for img in imgs) t.head()  fo_dataset = pxt.io.export_images_as_fo_dataset(t, t.image) session = fo.launch_app(fo_dataset) session.wait() ```  Here what I am obtaining in FiftyOne:  ![Image](https://github.com/user-attachments/assets/b50baf09-ac99-4444-8
  **Post-Mortem & Fix Analysis**:
  > When debugging, I spotted that images inserted directly as PIL image are not saved with the jpeg extension 
  > I was right about the jpeg issue, if I add an extension `.jpeg` [here](https://github.com/pixeltable/pixeltable/blob/6d0b2b050ed1ba66f5f21275260187906fe0feb1/pixeltable/exprs/row_builder.py#L451), it solves the issue
  > I am wondering if this is something we wanna add for the full pixeltable implementation or if we should fix the fiftyone integration

- **Issue #495** (2025-03-19): **can't import image file with # in the filename**
  *Symptoms*: I have no idea why this is the file name, but one of my students generated a file like  '#_3857_55775.0_84172.0.png'   <img width="926" alt="Image" src="https://github.com/user-attachments/assets/29487a48-47e6-4553-a8a9-122e4d9aa65e" />   Error: Error in column image: file not found: /scr/arosado/output/regions/0 Row: {'image': '/scr/arosado/output/regions/0/#_3857_55775.0_84172.0.png'}  It seems that the parser is not properly dealing with arguably very poorly named files.  When I renamed the same image "image1.png" not surprisingly it uploaded fine. 
  **Post-Mortem & Fix Analysis**:
  > This issue has been fixed.

- **Issue #473** (2025-12-17): **Inserting new records throws error on optional audio field**
  *Symptoms*: File ~/devel/pt_messageAnalytics/.pyenv/lib/python3.10/site-packages/pixeltable/type_system.py:426, in ColumnType.create_literal(self, val)     [424](https://vscode-remote+ssh-002dremote-002b7b22686f73744e616d65223a226f7070656e6865696d65722e6e6575726f6c6f67792e656d6f72792e656475222c2275736572223a2264616775746d616e227d.vscode-resource.vscode-cdn.net/home/dagutman/devel/pt_messageAnalytics/~/devel/pt_messageAnalytics/.pyenv/lib/python3.10/site-packages/pixeltable/type_system.py:424)     val = self._create_literal(val) --> [426](https://vscode-remote+ssh-002dremote-002b7b22686f73744e616d65223a226f7070656e6865696d65722e6e6575726f6c6f67792e656d6f72792e656475222c2275736572223a2264616775746d616e227d.vscode-resource.vscode-cdn.net/home/dagutman/devel/pt_messageAnalytics/~/devel/pt_messageAnalytics/.pyenv/lib/python3.10/site-packages/pixeltable/type_system.py:426) self.validate_literal(val)     [427](https://vscode-remote+ssh-002dremote-002b7b22686f73744e616d65223a226f7070656e6865696d65722e6e6575726f6c6f67792e656d6f72792e656475222c2275736572223a2264616775746d616e227d.vscode-resource.vscode-cdn.net/home/dagutman/devel/pt_messageAnalytics/~/devel/pt_messageAnalytics/.pyenv/lib/python3.10/site-packages/pixeltable/type_system.py:427) return val  File ~/devel/pt_messageAnalytics/.pyenv/lib/python3.10/site-packages/pixeltable/type_system.py:387, in ColumnType.validate_literal(self, val)     [386](https://vscode-remote+ssh-002dremote-002b7b22686f73744e616d65223a226f7070656e6865696d65722e6e65
  **Post-Mortem & Fix Analysis**:
  > Hi @dgutman , can you post a repro of this issue (the code that triggered it)? Thanks!  Aaron

- **Issue #469** (2025-02-12): **Video Indexing fails ...**
  *Symptoms*: Using the example code from **text-and-image-similarity-search-nextjs-fastapi** I run into this error:  **>>> REBUILD NEW PXT Data Structures ...  Connected to Pixeltable database at: postgresql+psycopg://postgres:@/pixeltable?host=/Users/kamir/.pixeltable/pgdata Created directory `video_search`. Created table `videos`.**  Process SpawnProcess-1: Traceback (most recent call last):   File "/opt/anaconda3/envs/pixeltable/lib/python3.11/multiprocessing/process.py", line 314, in _bootstrap     self.run()   File "/opt/anaconda3/envs/pixeltable/lib/python3.11/multiprocessing/process.py", line 108, in run     self._target(*self._args, **self._kwargs)   File "/opt/anaconda3/envs/pixeltable/lib/python3.11/site-packages/uvicorn/_subprocess.py", line 80, in subprocess_started     target(sockets=sockets)   File "/opt/anaconda3/envs/pixeltable/lib/python3.11/site-packages/uvicorn/server.py", line 66, in run     return asyncio.run(self.serve(sockets=sockets))            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/opt/anaconda3/envs/pixeltable/lib/python3.11/asyncio/runners.py", line 190, in run     return runner.run(main)            ^^^^^^^^^^^^^^^^   File "/opt/anaconda3/envs/pixeltable/lib/python3.11/asyncio/runners.py", line 118, in run     return self._loop.run_until_complete(task)            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "uvloop/loop.pyx", line 1518, in uvloop.loop.Loop.run_until_complete   File "/opt/anaconda3/envs/pixeltable/lib/python3.11/site-packages/uvicorn/se
  **Post-Mortem & Fix Analysis**:
  > When using version 0.3.0 I get a different error at the same place:  All I want to do is uploading an example video. Last week, I tested this code ca. 100 times to see how fast it is. But now, I am lost.  Created table `videos`. Created view `frames` with 0 rows, 0 exceptions. Inserting rows into `videos`: 1 rows [00:00, 1281.88 rows/s]              | 0/2 [00:00<?, ? cells/s] Computing cells: 100%|████████████████████████████████████████████| 2/2 [00:00<00:00, 29.95 cells/s] Process SpawnProcess-1: Traceback (most recent call last):   File "/opt/anaconda3/envs/pixeltable/lib/python3.11/multiprocessing/process.py", line 314, in _bootstrap     self.run()   File "/opt/anaconda3/envs/pixeltable/lib/python3.11/multiprocessing/process.py", line 108, in run     self._target(*self._args, **self._kwargs)   File "/opt/anaconda3/envs/pixeltable/lib/python3.11/site-packages/uvicorn/_subprocess.py", line 80, in subprocess_started     target(sockets=sockets)   File "/opt/anaconda3/envs/pixeltable/li
  > Regarding the "can't patch ..." error: are you running this inside a notebook? If so, could you please try to run it inside a script?  Also, you seem to be running uvloop instead of the standard asyncio event loop. The call to nest_asyncio.apply() (which should only happen when you're running in a notebook, btw) won't work for that package. Did you install uvloop intentionally or are you pulling that in as part of something else?
  > Thanks Marcel.  This code is in a FastAPI app, based on the example code. Regarding **uvloop**, I did not add it by intention.  I will try to avoid using it:  ** Force asyncio to use the default event loop policy _asyncio.set_event_loop_policy(asyncio.DefaultEventLoopPolicy())  uvicorn.run("app:app", ...... , loop="asyncio")_

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

### Incident Patch 1: `5f9daaa2` (2026-10-02)
**Commit Message**: Fix pxtfs:// store building a boto3 session for nearly every media read (#1698)

A hosted database built a new boto3 session for nearly every media file
it read from its `pxtfs://` home bucket, and cached each one forever. In
a hosted e2e run, each proxy daemon worker grew from about 1 GB to its 6
GB memory limit within an hour and was OOM-killed, with 600-750
`Initialized session for pxtfs://...` log lines per worker.

`PxtStore` keyed its cache entry, and scoped its temporary credentials,
by the object address's prefix. On a read, that prefix is the file's
directory, and `ObjectPath.create_prefix_raw()` puts each file in a
random shard directory (`<tbl>/<xx>/<xxxx>/`). So nearly every read
missed the cache: a control-plane credential call, about 64 ms to build
the boto3 session, client and resource, and about 11 MB that was never
released. Per-request `uploads/<uuid>/` stores (`PxtStorePartSink`,
`PxtArchivePartSink`) and `pxtfs://` presigned URLs added entries the
same way.

## Changes

- **Reads and column writes** share one cached session per
`org:db:bucket`, with credentials for the whole bucket. Each database
has its own home bucket and storage access is authorized per datab

**File**: `pixeltable/service/proxy_protocol.py` (modified, +4/-2)
```diff
@@ -156,8 +156,10 @@ def __init__(self, org: str, db: str) -> None:
 
     def _get_store(self) -> ObjectStoreBase:
         if self._store is None:
-            # the prefix in the URI scopes the store's temp credentials to this request's uploads
-            self._store = ObjectOps.get_store(f'pxtfs://{self._org}:{self._db}/home/{self._key_prefix}', False)
+            # a client holds these credentials, so limit them to this request's uploads
+            self._store = ObjectOps.get_store(
+                f'pxtfs://{self._org}:{self._db}/home/{self._key_prefix}', False, scope_credentials=True
+            )
         return self._store
 
     def add_media_bytes(self, data: bytes, extension: str) -> str | ArchiveMember:
```

**File**: `pixeltable/utils/object_stores.py` (modified, +7/-2)
```diff
@@ -433,7 +433,12 @@ def create_presigned_url(self, soa: StorageObjectAddress, expiration_seconds: in
 class ObjectOps:
     @classmethod
     def get_store(
-        cls, dest: str | StorageObjectAddress | None, allow_obj_name: bool, col_name: str | None = None
+        cls,
+        dest: str | StorageObjectAddress | None,
+        allow_obj_name: bool,
+        col_name: str | None = None,
+        *,
+        scope_credentials: bool = False,
     ) -> ObjectStoreBase:
         from pixeltable.env import Env
         from pixeltable.utils.local_store import LocalStore
@@ -450,7 +455,7 @@ def get_store(
             env.Env.get().require_package('boto3')
             from pixeltable.utils.pxt_store import PxtStore
 
-            return PxtStore(soa)
+            return PxtStore(soa, scope_credentials=scope_credentials)
         if soa.storage_target in (
             StorageTarget.S3_STORE,
             StorageTarget.R2_STORE,
```

**File**: `pixeltable/utils/pxt_store.py` (modified, +45/-17)
```diff
@@ -5,9 +5,10 @@
 import logging
 import re
 import threading
+import time
 import uuid
 import warnings
-from dataclasses import dataclass
+from dataclasses import dataclass, field
 from datetime import datetime, timedelta, timezone
 from pathlib import Path
 
@@ -35,18 +36,23 @@
 
 _PXTFS_URI_PATTERN = re.compile(r'^pxtfs://[^/]+/([^/?#]+)(.*)$')
 
+# how often a write rejected for lack of space checks the quota again
+_QUOTA_RECHECK_INTERVAL_S = 60.0
+
 
 @dataclass
 class _PxtStoreCacheEntry:
-    """Cached boto3 client/resource and quota state for a bucket."""
+    """Boto3 client/resource and quota state for a bucket, or for a prefix within it."""
 
     client: BaseClient | None  # populated after boto3 session is built
     resource: ServiceResource | None  # populated after boto3 session is built
     physical_bucket_name: str
     endpoint_url: str
     storage_provider: str
+    prefix: str | None = None  # the credentials' scope; None for the whole bucket
     no_space_left: bool = False
     no_space_warned: bool = False  # tracks whether warning has been issued for no space left in pixeltable store
+    quota_checked_at: float = field(default_factory=time.monotonic)  # when no_space_left was last fetched
 
 
 # guards the check-then-insert on the cached pxt_store entries: building one fetches credentials from the cloud,
@@ -82,12 +88,13 @@ def _handle_no_space_warning(no_space_left: bool, entry: _PxtStoreCacheEntry, or
         entry.no_space_warned = False
 
 
-def _refresh_credentials(org: str, db: str, bucket: str, prefix: str, entry: _PxtStoreCacheEntry) -> dict[str, str]:
+def _refresh_credentials(org: str, db: str, bucket: str, entry: _PxtStoreCacheEntry) -> dict[str, str]:
     """Fetch fresh credentials and update the cache entry"""
-    creds = get_bucket_credentials(org, db, bucket, prefix)
+    creds = get_bucket_credentials(org, db, bucket, entry.prefix)
     expiry_time = datetime.now(tz=timezone.utc) + timedelta(seconds=creds.ttl_seconds)
 
     entry.no_space_left = creds.no_space_left
+    entry.quota_checked_at = time.monotonic()
     if creds.resolved_bucket_name:
         entry.physical_bucket_name = creds.resolved_bucket_name
 
@@ -108,8 +115,8 @@ def _refresh_credentials(org: str, db: str, bucket: str, prefix: str, entry: _Px
     }
 
 
-def _build_pxt_store_entry(org: str, db: str, bucket: str, prefix: str) -> _PxtStoreCacheEntry:
-    """Fetch credentials and build a boto3 session for the bucket."""
+def _build_pxt_store_entry(org: str, db: str, bucket: str, prefix: str | None = None) -> _PxtStoreCacheEntry:
+    """Fetch credentials and build a boto3 session for the bucket, or for `prefix` within it."""
     creds = get_bucket_credentials(org, db, bucket, prefix)
 
     entry = _PxtStoreCacheEntry(
@@ -119,6 +126,7 @@ def _build_pxt_store_entry(org: str, db: str, bucket: str, prefix: str) -> _PxtS
         endpoint_url=creds.endpoint_url,
         no_space_left=creds.no_space_left,
         storage_provider=creds.storage_provider,
+        prefix=prefix,
     )
 
     _handle_no_space_warning(creds.no_space_left, entry, org, db, bucket)
@@ -136,7 +144,7 @@ def _build_pxt_store_entry(org: str, db: str, bucket: str, prefix: str) -> _PxtS
     # keeps credentials fresh without triggering botocore's immediate-refresh behavior.
     refreshable_creds = RefreshableCredentials.create_from_metadata(
         metadata=initial_metadata,
-        refresh_using=lambda: _refresh_credentials(org, db, bucket, prefix, entry),
+        refresh_using=lambda: _refresh_credentials(org, db, bucket, entry),
         method='pxt-store',
         advisory_timeout=60,  # start refreshing 60s before expiry (non-blocking, best-effort)
         mandatory_timeout=30,  # block and force refresh if credentials expire within 30s
@@ -165,18 +173,20 @@ def _build_pxt_store_entry(org: str, db: str, bucket: str, prefix: str) -> _PxtS
     )
     entry.resource = boto3_session.resource('s3', endpoint_url=creds.endpoint_url, region_name='auto')
 
-    _logger.info(f'Initialized session for pxtfs://{org}:{db}/{bucket}')
+    _logger.info(f'Initialized session for pxtfs://{org}:{db}/{bucket}/{prefix or ""}')
     return entry
 
 
-def _get_or_create_pxt_store_entry(org: str, db: str, bucket: str, prefix: str) -> _PxtStoreCacheEntry:
-    """Return the cached entry for org:db:bucket:prefix"""
-    cache_key = f'{org}:{db}:{bucket}:{prefix}'
+def _get_or_create_pxt_store_entry(org: str, db: str, bucket: str) -> _PxtStoreCacheEntry:
+    """Return the cached entry for org:db:bucket"""
+    # one session per bucket, with credentials for the whole bucket: media files sit in random shard directories,
+    # so a session per prefix would mean one per read
+    cache_key = f'{org}:{db}:{bucket}'
     pxt_store_client_dict = Env.get().object_store_clients(StorageTarget.PIXELTABLE_STORE)
     with _pxt_store_entries_lock:
         entry = pxt_store_client_dict.clients.get(cache_key)
         if entry is None:
-        
```

**File**: `tests/test_proxy_daemon.py` (modified, +30/-24)
```diff
@@ -313,16 +313,18 @@ def test_pxt_store_sink_defers_uploads(
 
         _ResponseMedia uses this per-object sink, since it presigns a url for each key."""
         uploaded: dict[str, tuple[pathlib.Path, bytes]] = {}
-        store_uris: list[str] = []
+        stores: list[tuple[str, bool]] = []
 
         class FakeStore:
             def copy_local_file(self, src_path: pathlib.Path, dest: FileDestination) -> str:
                 assert dest.remote_key is not None
                 uploaded[dest.remote_key] = (src_path, src_path.read_bytes())
                 return dest.url
 
-        def fake_get_store(dest: Any, allow_obj_name: bool, col_name: Any = None) -> Any:
-            store_uris.append(dest)
+        def fake_get_store(
+            dest: Any, allow_obj_name: bool, col_name: Any = None, scope_credentials: bool = False
+        ) -> Any:
+            stores.append((dest, scope_credentials))
             return FakeStore()
 
         monkeypatch.setattr(ObjectOps, 'get_store', staticmethod(fake_get_store))
@@ -338,14 +340,14 @@ def fake_get_store(dest: Any, allow_obj_name: bool, col_name: Any = None) -> Any
 
         # nothing has been uploaded yet, and no credentials have been fetched
         assert uploaded == {}
-        assert store_uris == []
+        assert stores == []
         # repeated references to one path get distinct keys (the daemon consumes each localized file)
         assert len(set(keys)) == 3
         assert all(k.startswith(sink._key_prefix) for k in keys)
 
         sink.flush()
-        # one store (one credential fetch) for the whole request, scoped to its own prefix
-        assert store_uris == [f'pxtfs://org1:db1/home/{sink._key_prefix}']
+        # one store for the whole request, with credentials for its own prefix
+        assert stores == [(f'pxtfs://org1:db1/home/{sink._key_prefix}', True)]
         assert set(uploaded) == set(keys)
         assert uploaded[keys[0]][1] == uploaded[keys[1]][1] == src.read_bytes()
         assert uploaded[keys[2]][1] == b'raw'
@@ -358,15 +360,15 @@ def fake_get_store(dest: Any, allow_obj_name: bool, col_name: Any = None) -> Any
         assert src.exists()
 
         # flush() drained the queue, so a second call uploads nothing
-        store_uris.clear()
+        stores.clear()
         sink.flush()
-        assert store_uris == []
+        assert stores == []
 
     @staticmethod
     def _install_fake_upload_store(
         monkeypatch: pytest.MonkeyPatch,
         objects: dict[str, bytes],
-        store_uris: list[str],
+        stores: list[tuple[str, bool]],
         downloads: list[str] | None = None,
     ) -> None:
         """Route ObjectOps.get_store to a fake store serving objects (keyed store-relative, i.e. without the
@@ -387,8 +389,10 @@ def copy_object_to_local_file(self, src_path: str, dest_path: pathlib.Path) -> N
                     raise excs.NotFoundError(excs.ErrorCode.STORAGE_NOT_FOUND, "Bucket 'b' not found")
                 dest_path.write_bytes(objects[src_path])
 
-        def fake_get_store(dest: Any, allow_obj_name: bool, col_name: Any = None) -> Any:
-            store_uris.append(dest)
+        def fake_get_store(
+            dest: Any, allow_obj_name: bool, col_name: Any = None, scope_credentials: bool = False
+        ) -> Any:
+            stores.append((dest, scope_credentials))
             return FakeStore()
 
         monkeypatch.setattr(ObjectOps, 'get_store', staticmethod(fake_get_store))
@@ -408,13 +412,13 @@ def _remote_file_request(*parts: str | tuple[str, str]) -> proxy_protocol.ProxyR
 
     def test_prefetch_remote_parts(self, hosted_identity: None, monkeypatch: pytest.MonkeyPatch) -> None:
         objects = {'req/0.png': b'png-bytes', 'req/1.jpg': b'jpg-bytes'}
-        store_uris: list[str] = []
-        self._install_fake_upload_store(monkeypatch, objects, store_uris)
+        stores: list[tuple[str, bool]] = []
+        self._install_fake_upload_store(monkeypatch, objects, stores)
 
         # happy path: keys download into TempStore, preserving each key's extension
         request = self._remote_file_request('uploads/req/0.png', 'uploads/req/1.jpg')
         proxy_dispatch._prefetch_remote_parts(request)
-        assert store_uris == ['pxtfs://org1:db1/home/uploads/']
+        assert stores == [('pxtfs://org1:db1/home/uploads/', False)]
         assert set(request._remote_parts) == {('uploads/req/0.png', None), ('uploads/req/1.jpg', None)}
         for (key, _), path_str in request._remote_parts.items():
             path = pathlib.Path(path_str)
@@ -424,11 +428,11 @@ def test_prefetch_remote_parts(self, hosted_identity: None, monkeypatch: pytest.
             path.unlink()
 
         # a request without remote keys makes no store (and thus no control-plane) call
-        store_uris.clear()
+        stores.clear()
         proxy_dispatch._prefetch_remote_parts(
             proxy_protocol.ProxyRequest(class_name='CatalogBase', method='echo_test', args={'rows': []})
        
```

**File**: `tests/test_pxt_store.py` (modified, +108/-17)
```diff
@@ -1,13 +1,17 @@
 from __future__ import annotations
 
+import uuid
 from datetime import datetime, timedelta, timezone
-from unittest.mock import patch
+from pathlib import Path
+from unittest.mock import call, patch
 
 import pytest
 
 import pixeltable as pxt
 import pixeltable.exceptions as excs
-from pixeltable.utils.object_stores import ObjectOps, ObjectPath
+from pixeltable.env import Env
+from pixeltable.service.pxtfs_protocol import GetBucketCredentialsResponse
+from pixeltable.utils.object_stores import ObjectOps, ObjectPath, StorageTarget
 
 from .utils import (
     CLOUD_DB_ROOT_URIS,
@@ -29,6 +33,19 @@ def _pxt_dest_uri() -> str:
     return f'{home_bucket_uri(CLOUD_DB_ROOT_URIS["cloud"])}/pytest'
 
 
+def _bucket_credentials(no_space_left: bool = False) -> GetBucketCredentialsResponse:
+    """Stand-in credentials for patching get_bucket_credentials."""
+    return GetBucketCredentialsResponse(
+        access_key_id='key',
+        secret_access_key='secret',
+        session_token='token',
+        endpoint_url='https://r2.example.com',
+        resolved_bucket_name='physical-home',
+        ttl_seconds=3600,
+        no_space_left=no_space_left,
+    )
+
+
 class TestPxtStore:
     """Tests for Pixeltable-managed storage (pxtfs:// home buckets)."""
 
@@ -105,9 +122,7 @@ def test_no_space_left(self, uses_db: None) -> None:
         validate_update_status(t.insert([{'img': img}]), expected_rows=1)
 
         soa = ObjectPath.parse_object_storage_addr(dest_uri, allow_obj_name=False)
-        real_entry = pxt_store._get_or_create_pxt_store_entry(
-            soa.account, soa.account_extension, soa.container, soa.prefix
-        )
+        real_entry = pxt_store._get_or_create_pxt_store_entry(soa.account, soa.account_extension, soa.container)
         quota_entry = pxt_store._PxtStoreCacheEntry(
             client=real_entry.client,
             resource=real_entry.resource,
@@ -127,22 +142,98 @@ def test_no_space_left(self, uses_db: None) -> None:
         validate_update_status(t.insert([{'img': img}]), expected_rows=1)
         assert ObjectOps.count(t._id, dest=dest_uri) == 2
 
-    def test_separate_prefixes_get_separate_credentials(self, uses_db: None) -> None:
-        """Verify that two columns with different prefixes under the same org:db get separate credentials."""
+    def test_reads_share_credentials(self, init_env: None, tmp_path: Path) -> None:
+        """Reading objects from many directories of a home bucket fetches credentials and builds a boto3 session
+        once, rather than once per directory: media files are stored in random shard directories."""
         skip_test_if_not_installed('boto3')
-        skip_test_if_no_pxt_credentials()
-        from pixeltable.utils.pxt_store import PxtStore
+        from pixeltable.utils import pxt_store
+        from pixeltable.utils.s3_store import S3Store
+
+        # a database no other test has used, so its entry is not cached yet
+        db = f'db_{uuid.uuid4().hex}'
+        home = f'pxtfs://org1:{db}/home'
+        with (
+            patch.object(pxt_store, 'get_bucket_credentials', return_value=_bucket_credentials()) as get_credentials,
+            patch.object(S3Store, 'copy_object_to_local_file') as download,
+        ):
+            store = ObjectOps.get_store(home, False)
+            tbl_id = uuid.uuid4()
+            urls = [store.resolve_destination(tbl_id, 0, 1, ext='.jpg').url for _ in range(100)]
+            urls.append(f'{home}/uploads/{uuid.uuid4().hex}/0.jpg')
+            for url in urls:
+                ObjectOps.copy_object_to_local_file(url, tmp_path / 'obj')
+
+        assert len({url.rsplit('/', 1)[0] for url in urls}) > 90
+        assert download.call_count == len(urls)
+        get_credentials.assert_called_once_with('org1', db, 'home', None)
+
+    def test_quota_recheck(self, init_env: None, tmp_path: Path) -> None:
+        """A write rejected for lack of space checks the quota again at most once per interval, and keeps the cached
+        state if the check fails; once space is freed, the next check lets writes through."""
+        skip_test_if_not_installed('boto3')
+        from pixeltable.utils import pxt_store
         from pixeltable.utils.s3_store import S3Store
 
-        soa1 = ObjectPath.parse_object_storage_addr(f'{_pxt_dest_uri()}/dir1', allow_obj_name=False)
-        soa2 = ObjectPath.parse_object_storage_addr(f'{_pxt_dest_uri()}/dir2', allow_obj_name=False)
+        home = f'pxtfs://org1:db_{uuid.uuid4().hex}/home'
+        src = tmp_path / 'obj.jpg'
+        src.write_bytes(b'data')
+        full = _bucket_credentials(no_space_left=True)
+        with (
+            patch.object(pxt_store, 'get_bucket_credentials', return_value=full) as get_credentials,
+            patch.object(S3Store, 'copy_local_file', side_effect=lambda src_path, dest: dest.url) as upload,
+        ):
+            with pytest.warns(excs.PixeltableWarning, match='has no space left'):
+                store = Obj
```

---

### Incident Patch 2: `d7137ddf` (2026-10-02)
**Commit Message**: Fix parameterized comparison not using B-tree index (#1686)

**File**: `pixeltable/exprs/comparison.py` (modified, +53/-23)
```diff
@@ -13,6 +13,7 @@
 from .literal import Literal
 from .row_builder import RowBuilder
 from .sql_element_cache import SqlElementCache
+from .variable import Variable
 
 
 class Comparison(Expr):
@@ -23,12 +24,12 @@ def __init__(self, operator: ComparisonOperator, op1: Expr, op2: Expr):
         super().__init__(ts.BoolType())
         self.operator = operator
 
-        # if this is a comparison of a column to a literal (ie, could be used as a search argument in an index lookup),
-        # normalize it to <column> <operator> <literal>.
-        if isinstance(op1, ColumnRef) and isinstance(op2, Literal):
+        # if this is a comparison of a column to a constant (ie, could be used as a search argument in an index lookup),
+        # normalize it to <column> <operator> <constant>.
+        if isinstance(op1, ColumnRef) and isinstance(op2, (Literal, Variable)):
             self.is_search_arg_comparison = True
             self.components = [op1, op2]
-        elif isinstance(op1, Literal) and isinstance(op2, ColumnRef):
+        elif isinstance(op1, (Literal, Variable)) and isinstance(op2, ColumnRef):
             self.is_search_arg_comparison = True
             self.components = [op2, op1]
             self.operator = self.operator.reverse()
@@ -69,38 +70,67 @@ def _sql_compatible(t1: ts.ColumnType, t2: ts.ColumnType) -> bool:
             return True
         return (t1.is_date_type() or t1.is_timestamp_type()) and (t2.is_date_type() or t2.is_timestamp_type())
 
-    def _can_use_index_value_col(self) -> bool:
-        """True if a value-column B-tree index can answer this comparison."""
+    def _index_value_col(self) -> sql.Column | None:
+        """The value column of a B-tree index that can answer this comparison, or None if no such index is present"""
         import pixeltable.index as index
 
-        assert self.is_search_arg_comparison
-        assert isinstance(self._op2, Literal)
-        if self._op2.col_type.is_string_type():
+        if not self.is_search_arg_comparison:
+            return None
+        assert isinstance(self._op1, ColumnRef)
+        col = self._op1.col
+        tbl = col.get_tbl()
+        if not tbl.supports_idxs:
+            return None
+        idx_info = tbl.find_btree_index(col)
+        if idx_info is None or idx_info.val_col is None:
+            return None
+        if (
+            isinstance(self._op2, Literal)
+            and self._op2.col_type.is_string_type()
+            and len(self._op2.val) >= index.BtreeIndex.MAX_STRING_LEN
+        ):
             # Strings are truncated in the value column, so a value column can be used only for comparisons with
             # literals shorter than the limit.
-            return len(self._op2.val) < index.BtreeIndex.MAX_STRING_LEN
-        return True
+            return None
+        return idx_info.val_col.sa_col
 
     def sql_expr(self, sql_elements: SqlElementCache) -> sql.ColumnElement | None:
+        import pixeltable.index as index
+
         if not self._sql_compatible(self._op1.col_type, self._op2.col_type):
             # e.g. string vs. json, or image vs. anything
             return None
 
-        left = sql_elements.get(self._op1)
-        if self.is_search_arg_comparison:
-            assert isinstance(self._op1, ColumnRef)
-            col = self._op1.col
-            # indices don't apply to snapshots
-            tbl = col.get_tbl()
-            idx_info = None if tbl.is_snapshot else tbl.find_btree_index(col)
-            # Use the index's value column when possible
-            if idx_info is not None and idx_info.val_col is not None and self._can_use_index_value_col():
-                left = idx_info.val_col.sa_col
-
         right = sql_elements.get(self._op2)
-        if left is None or right is None:
+        if right is None:
+            return None
+        val_col = self._index_value_col()
+        if val_col is not None and isinstance(self._op2, Variable) and self._op1.col_type.is_string_type():
+            # It's a string comparison with a Variable (whose length is unknown in compile time), and there is a B-tree
+            # index on truncated values. Due to truncation, we cannot rely on the index value column alone for
+            # comparison, but we can optimize with it.
+            if self.operator == ComparisonOperator.NE:
+                # A B-tree index can't help with !=
+                val_col = None
+            else:
+                stored_col = sql_elements.get(self._op1)
+                if stored_col is None:
+                    return None
+                truncated = sql.func.left(right, index.BtreeIndex.MAX_STRING_LEN)
+                if self.operator == ComparisonOperator.EQ:
+                    idx_filter = val_col == truncated
+                elif self.operator in (ComparisonOperator.LT, ComparisonOperator.LE):
+                    idx_filter = val_col <= truncated
+                else:
+                    idx_filter = val_col >= truncated
+       
```

---

### Incident Patch 3: `638e7a1d` (2026-10-01)
**Commit Message**: [PXT-1402] Stop requiring unused inputs in compute routes (#1665)

This changes compute routes so that they no longer require every
required column of the table as input. A compute route now requires only
the columns it needs to compute its outputs.

This adds an outputs argument to Table.compute(). compute() computes
only those columns and the columns they depend on, and returns them in
the requested order. Compute routes pass their outputs to compute(). For
views, compute() still requires the columns that the filter and the
iterator use.

This also changes add_insert_route() and add_compute_route() to check
the inputs when the route is created. A route that leaves out a required
column now fails when it is created, instead of returning a 422 on every
request.

This bumps the proxy protocol version to 5.

Tests: adds cases to test_table for compute() with outputs, and to
test_fastapi for the input check and for a compute route that takes only
the input its output needs.

**File**: `pixeltable/catalog/local_table.py` (modified, +11/-2)
```diff
@@ -254,6 +254,7 @@ def compute(
         source: Sequence[dict[str, Any]] | Sequence[pydantic.BaseModel],
         /,
         *,
+        outputs: Sequence[str | ColumnRef] | None = None,
         on_error: Literal['abort', 'ignore'] = 'abort',
     ) -> RowBatch:
         from pixeltable.io.table_data_conduit import PydanticTableDataConduit, RowDataTableDataConduit, TableDataConduit
@@ -280,13 +281,21 @@ def compute(
         self._validate_compute()
         try:
             with get_runtime().catalog.begin_xact(read_tbl_ids=path.tbl_ids):
+                output_md = self._resolve_compute_outputs(outputs)
                 # input rows supply values for the base table's columns
                 base_tbl = self._get_base_tables()[-1] if path.is_view() else self
                 data_source.add_table_info(base_tbl)
+                # the compute plan checks for the required columns that the outputs read
+                data_source.reqd_col_names.clear()
                 data_source.prepare_for_insert_into_table()
                 input_rows = [row for batch in data_source.valid_row_batch() for row in batch]
 
-                plan = Planner.create_compute_plan(path, input_rows, ignore_errors=not fail_on_exc)
+                output_cols = path.columns()
+                if output_md is not None:
+                    output_qids = {md.qcolid for md in output_md}
+                    output_cols = [c for c in output_cols if c.qid in output_qids]
+
+                plan = Planner.create_compute_plan(path, input_rows, ignore_errors=not fail_on_exc, outputs=output_md)
                 data_rows: list[exprs.DataRow] = []
                 with plan:
                     # TODO: fix progress reporter
@@ -297,7 +306,7 @@ def compute(
                                 if row.has_exc():
                                     raise row.get_first_exc()
                         data_rows.extend(row_batch.rows)
-                result = plan.row_builder.create_row_batch(data_rows, output_cols=path.columns())
+                result = plan.row_builder.create_row_batch(data_rows, output_cols=output_cols)
         except excs.ExprEvalError as e:
             excs.raise_from_expr_eval_err(e)
 
```

**File**: `pixeltable/catalog/table.py` (modified, +33/-4)
```diff
@@ -28,6 +28,7 @@
     from ..globals import TableDataSource
     from .table_metadata import TableMetadata, VersionMetadata
     from .table_path import TablePath
+    from .types import ColumnVersionMd
     from .update_status import UpdateStatus
 
 
@@ -891,12 +892,16 @@ def compute(
         source: Sequence[dict[str, Any]] | Sequence[pydantic.BaseModel],
         /,
         *,
+        outputs: Sequence[str | ColumnRef] | None = None,
         on_error: Literal['abort', 'ignore'] = 'abort',
     ) -> RowBatch:
         """
         Materialize the computed columns of this table for the given input rows and return the resulting rows
         without persisting them.
 
+        If `outputs` is specified, will compute only those columns and the dependent columns that they use. An input
+        row then needs to supply only the stored required columns used by `outputs`.
+
         If this table is a view, the input rows are applied to the view's insertable base table (i.e., the root of the
         view hierarchy) and the output rows are the resulting rows of the view, as if the input had been inserted into
         the base:
@@ -906,8 +911,11 @@ def compute(
         Args:
             source: Rows to compute, as a sequence of dictionaries or Pydantic model instances. Rows contain
                 values for the base table's columns (for a view) or this table's columns; each row must supply
-                values for every required (non-nullable, non-computed) column; the same rules as
-                [`insert()`][pixeltable.Table.insert] apply.
+                values for every required (non-nullable, non-computed) column used by `outputs`; otherwise the same
+                rules as [`insert()`][pixeltable.Table.insert] apply.
+
+            outputs: The columns to compute and return, as names or column references. Defaults to all columns
+                of the table.
 
             on_error: Determines the behavior if an error occurs while evaluating a computed column or detecting an
                 invalid media file (such as a corrupt image).
@@ -920,15 +928,16 @@ def compute(
 
         Returns:
             A [`RowBatch`][pixeltable.RowBatch] of output rows, in input row order (with an iterator's output
-            rows in iteration order). Each [`Row`][pixeltable.Row] contains a value for every column of the
-            table. [`Row.errors`][pixeltable.Row] holds `{'errortype': ..., 'errormsg': ...}` for each cell that raised,
+            rows in iteration order). Each [`Row`][pixeltable.Row] contains a value for every column in `outputs`.
+            [`Row.errors`][pixeltable.Row] holds `{'errortype': ..., 'errormsg': ...}` for each cell that raised,
             keyed by column or index name (only with `on_error='ignore'`).
 
         Raises:
             Error: If one of the following conditions occurs:
 
                 - The table is a snapshot, a view of a snapshot, or a view defined with a sample clause.
                 - The table has been dropped.
+                - `outputs` is empty or contains a column that is not in the table.
                 - One of the input rows does not conform to the base table schema.
                 - An error occurs during processing of computed columns, and `on_error='abort'`.
 
@@ -939,6 +948,11 @@ def compute(
             ... rows = tbl.compute([{'a': 1, 'b': 1}, {'a': 2, 'b': 2}])
             ... # rows == [{'a': 1, 'b': 1, 'c': 2}, {'a': 2, 'b': 2, 'c': 4}]
 
+            Compute and return only `c`:
+
+            >>> rows = tbl.compute([{'a': 1, 'b': 1}], outputs=['c'])
+            ... # rows == [{'c': 2}]
+
             Same with Pydantic model inputs:
 
             >>> class MyModel(pydantic.BaseModel):
@@ -1004,6 +1018,21 @@ def _validate_insert_source(self, source: TableDataSource | None) -> None:
         if source is not None and isinstance(source, Sequence) and len(source) == 0:
             raise excs.RequestError(excs.ErrorCode.UNSUPPORTED_OPERATION, 'Cannot insert an empty sequence.')
 
+    def _resolve_compute_outputs(self, outputs: Sequence[str | ColumnRef] | None) -> list[ColumnVersionMd] | None:
+        """Return the metadata of the compute() output columns named by `outputs`, in the given order."""
+        if outputs is None:
+            return None
+        if len(outputs) == 0:
+            raise excs.RequestError(excs.ErrorCode.MISSING_REQUIRED, 'At least one output column must be specified')
+        result: list[ColumnVersionMd] = []
+        for output in outputs:
+            name = output if isinstance(output, str) else output.col_md.name
+            col_md = self._tbl_path.get_column_md_by_name(name)
+            if col_md is None:
+                raise excs.NotFoundError(excs.ErrorCode.COLUMN_NOT_FOUND, f'Unknown column: {name}')
+            result.append(col_md)
+        return result
+
     def _validate_compute(self) -> None:
         """Raises if compute() is not supported for this table's path."""
```

**File**: `pixeltable/catalog/table_path.py` (modified, +10/-0)
```diff
@@ -121,6 +121,10 @@ def has_iterator(self) -> bool:
     def has_sample_clause(self) -> bool:
         """True if this table or one of its ancestors is defined with a sample clause."""
 
+    @abc.abstractmethod
+    def view_md(self) -> schema.ViewMd | None:
+        """The view definition of this path's leaf table; None for a base table."""
+
     @abc.abstractmethod
     def is_data_versioned(self) -> bool: ...
 
@@ -374,6 +378,9 @@ def has_sample_clause(self) -> bool:
             return True
         return self.base is not None and self.base.has_sample_clause()
 
+    def view_md(self) -> schema.ViewMd | None:
+        return self._cached_tv().view_md
+
     def comment(self) -> str:
         return self._cached_tv().comment
 
@@ -610,6 +617,9 @@ def is_view(self) -> bool:
     def is_component_view(self) -> bool:
         return self.md.tbl_md.view_md is not None and self.md.tbl_md.view_md.iterator_call is not None
 
+    def view_md(self) -> schema.ViewMd | None:
+        return self.md.tbl_md.view_md
+
     def is_mutable(self) -> bool:
         return self.md.tbl_md.is_mutable
 
```

**File**: `pixeltable/catalog/table_proxy.py` (modified, +9/-4)
```diff
@@ -325,6 +325,7 @@ def compute(
         source: Sequence[dict[str, Any]] | Sequence[pydantic.BaseModel],
         /,
         *,
+        outputs: Sequence[str | ColumnRef] | None = None,
         on_error: Literal['abort', 'ignore'] = 'abort',
     ) -> RowBatch:
         # str/bytes are technically Sequences; reject them explicitly (with a clear message) rather than letting
@@ -339,8 +340,10 @@ def compute(
                 excs.ErrorCode.UNSUPPORTED_OPERATION, 'compute() requires a sequence of dicts or pydantic models'
             )
         self._validate_compute()
+        output_md = self._resolve_compute_outputs(outputs)
         rows = self._convert_local_paths(self._prepare_rows(list(source)))
-        return self._dispatch('compute', {'rows': rows, 'on_error': on_error})
+        output_names = None if output_md is None else [md.name for md in output_md]
+        return self._dispatch('compute', {'rows': rows, 'outputs': output_names, 'on_error': on_error})
 
     def _media_column_names(self) -> set[str]:
         return {
@@ -376,11 +379,11 @@ def _prepare_rows(self, source: list[Any]) -> list[dict[str, Any]]:
         """
         Validate and normalize a non-empty list of dict/pydantic source rows for the hosted catalog:
         - pydantic models are validated and converted to dicts on the client (the model classes aren't
-          importable on the server)
+          importable on the server); the server's compute plan checks for required columns
         - plain dicts are sent as-is
         """
         if isinstance(source[0], pydantic.BaseModel):
-            source = self._pydantic_to_rows(source)
+            source = self._pydantic_to_rows(source, check_required=False)
         rows: list[dict[str, Any]] = []
         for source_row in source:
             if not isinstance(source_row, dict):
@@ -390,12 +393,14 @@ def _prepare_rows(self, source: list[Any]) -> list[dict[str, Any]]:
             rows.append(source_row)
         return rows
 
-    def _pydantic_to_rows(self, models: list[Any]) -> list[dict[str, Any]]:
+    def _pydantic_to_rows(self, models: list[Any], *, check_required: bool = True) -> list[dict[str, Any]]:
         """Validate pydantic models against this table's schema and convert them to insertable dicts."""
         from pixeltable.io.table_data_conduit import PydanticTableDataConduit
 
         converter = PydanticTableDataConduit(models)
         converter.add_table_info(self)
+        if not check_required:
+            converter.reqd_col_names.clear()
         converter.prepare_for_insert_into_table()
         return converter.pxt_rows
 
```

**File**: `pixeltable/plan.py` (modified, +80/-2)
```diff
@@ -314,12 +314,77 @@ def _create_input_plan(
         plan = cls._add_prefetch_node(tbl.id, row_builder.input_exprs, input_node=plan)
         return plan, batch_size
 
+    @classmethod
+    def columns_to_compute(
+        cls, path: catalog.TablePath, outputs: Iterable[catalog.ColumnVersionMd] | None
+    ) -> list[catalog.ColumnVersionMd]:
+        """Return the columns a compute of `outputs` has to materialize.
+
+        These are the outputs themselves, every column their value expressions read, transitively, and the columns
+        read by the filter and iterator arguments of every view in `path`. `outputs` defaults to all columns
+        visible in `path`.
+        """
+        expr_dicts: list[dict[str, Any]] = []
+        # Walk the path from the view down to the base table and collect each view's filter and iterator arguments.
+        cur_path: catalog.TablePath | None = path
+        while cur_path is not None:
+            view_md = cur_path.view_md()
+            if view_md is not None:
+                if view_md.predicate is not None:
+                    expr_dicts.append(view_md.predicate)
+                if view_md.iterator_call is not None:
+                    expr_dicts.extend(view_md.iterator_call['args'])
+                    expr_dicts.extend(view_md.iterator_call['kwargs'].values())
+            cur_path = cur_path.base
+        refd_qcolids = sorted(
+            {qcolid for d in expr_dicts for qcolid in exprs.Expr.get_refd_column_ids(d)},
+            key=lambda qcolid: (qcolid.tbl_id, qcolid.col_id),
+        )
+
+        pending = list(path.column_md() if outputs is None else outputs)
+        pending.extend(path.get_column_md(qcolid) for qcolid in refd_qcolids)
+        result: dict[catalog.QColumnId, catalog.ColumnVersionMd] = {}
+        while len(pending) > 0:
+            col_md = pending.pop(0)
+            if col_md.qcolid in result:
+                continue
+            result[col_md.qcolid] = col_md
+            if col_md.schema_col.value_expr is not None:
+                value_qcolids = sorted(
+                    exprs.Expr.get_refd_column_ids(col_md.schema_col.value_expr),
+                    key=lambda qcolid: (qcolid.tbl_id, qcolid.col_id),
+                )
+                pending.extend(path.get_column_md(qcolid) for qcolid in value_qcolids)
+        return list(result.values())
+
+    @classmethod
+    def required_input_columns(
+        cls, path: catalog.TablePath, outputs: Iterable[catalog.ColumnVersionMd] | None
+    ) -> list[catalog.ColumnVersionMd]:
+        """Return the root table's stored, non-nullable columns that computing `outputs` reads.
+
+        These are the columns an input row must supply; `outputs` defaults to all columns visible in `path`.
+        """
+        root_id = path.root.tbl_id
+        return [
+            col_md
+            for col_md in cls.columns_to_compute(path, outputs)
+            if col_md.qcolid.tbl_id == root_id and not col_md.is_computed and not col_md.col_type.nullable
+        ]
+
     @classmethod
     def create_compute_plan(
-        cls, path: catalog.TableVersionPath, rows: list[dict[str, Any]], ignore_errors: bool
+        cls,
+        path: catalog.TableVersionPath,
+        rows: list[dict[str, Any]],
+        ignore_errors: bool,
+        outputs: list[catalog.ColumnVersionMd] | None,
     ) -> exec.ExecNode:
         """Creates a plan for LocalTable.compute(): propagation of input rows along the entire view chain.
 
+        The plan materializes 'outputs' (all columns if None) and the columns they read. Values in 'rows' for any
+        other column are ignored.
+
         Plan shape:
         - the input rows are handled identically to insert:
             - InMemoryDataNode
@@ -333,11 +398,21 @@ def create_compute_plan(
         base_tv = tvs[0].get()
         assert base_tv.is_insertable
 
+        required_col_names = [md.name for md in cls.required_input_columns(path, outputs)]
+        for row in rows:
+            missing_col_names = [name for name in required_col_names if name not in row]
+            if len(missing_col_names) > 0:
+                raise excs.RequestError(
+                    excs.ErrorCode.MISSING_REQUIRED,
+                    f'Missing required column(s) ({", ".join(missing_col_names)}) in row {row}',
+                )
+
         # columns to materialize, base to target; each level's columns are computed at that level's stage
+        compute_qids = {md.qcolid for md in cls.columns_to_compute(path, outputs)}
         per_tbl_output_cols: list[list[Column]] = []
         for tvh in tvs:
             tv = tvh.get()
-            cols = cls._compute_output_cols(tv, for_insert=False)
+            cols = [c for c in cls._compute_output_cols(tv, for_insert=False) if c.qid in compute_qids]
             cls.__check_valid_columns(tv, cols, 'computed for')
             cls.__check_valid_iterator(tv, tv.iterator_call, 'computed for')
             per_tbl_output_cols.appe
```

**File**: `pixeltable/service/proxy_dispatch.py` (modified, +1/-1)
```diff
@@ -455,7 +455,7 @@ def build() -> Query:
 
 def _compute(request: ProxyRequest, tbl: LocalTable) -> Any:
     kwargs = _deserialize_args(request)
-    return tbl.compute(kwargs['rows'], on_error=kwargs['on_error'])
+    return tbl.compute(kwargs['rows'], outputs=kwargs['outputs'], on_error=kwargs['on_error'])
 
 
 def _update(request: ProxyRequest, tbl: LocalTable) -> Any:
```

**File**: `pixeltable/service/proxy_protocol.py` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@
 if TYPE_CHECKING:
     from pixeltable._query import Query
 
-PROTOCOL_VERSION = 5
+PROTOCOL_VERSION = 6
 
 # Reserved key marking a type-tagged value: {_TAG: <type-name>, 'v': <payload>}.
 _TAG = '$pxt'
```

**File**: `pixeltable/serving/_fastapi.py` (modified, +28/-6)
```diff
@@ -44,6 +44,7 @@
 from pixeltable.config import Config
 from pixeltable.env import Env
 from pixeltable.exec.globals import INLINED_OBJECT_MD_KEY
+from pixeltable.plan import Planner
 from pixeltable.runtime import close_threadpool_runtimes
 from pixeltable.service.proxy_protocol import PxtStorePartSink
 from pixeltable.serving import SqlExport
@@ -788,12 +789,14 @@ def add_compute_route(
             t: The table or view over which to compute rows, or the model that defines it.
             path: The URL path for the endpoint.
             inputs: Columns to accept as request fields. Defaults to all non-computed columns
-                (of the base table, if `t` is a view).
+                (of the base table, if `t` is a view). Together with `uploadfile_inputs`, they must include
+                every required (non-nullable, non-computed) column that the `outputs` depend on.
             uploadfile_inputs: Columns to accept as
                 [`UploadFile`](https://fastapi.tiangolo.com/tutorial/request-files/) fields
                 (must be media-typed). These are sent as multipart form data; all other inputs
                 become [`Form`](https://fastapi.tiangolo.com/tutorial/request-forms/) fields.
             outputs: Columns to include in the response. Defaults to all columns (including inputs).
+                Only these columns and the columns they depend on are computed.
             return_fileresponse: If True, return the single media-typed output column as a
                 [`FileResponse`](https://fastapi.tiangolo.com/advanced/custom-response/#fileresponse).
                 Requires exactly one media-typed output column, and the computation must produce
@@ -915,7 +918,8 @@ def add_insert_route(
         Args:
             t: The table to insert into, or the model that defines it.
             path: The URL path for the endpoint.
-            inputs: Columns to accept as request fields. Defaults to all non-computed columns.
+            inputs: Columns to accept as request fields. Defaults to all non-computed columns. Together with
+                `uploadfile_inputs`, they must include every required (non-nullable, non-computed) column.
             uploadfile_inputs: Columns to accept as
                 [`UploadFile`](https://fastapi.tiangolo.com/tutorial/request-files/) fields
                 (must be media-typed). These are sent as multipart form data; all other inputs
@@ -1153,13 +1157,15 @@ def compute_route(
             t: The table or view over which to compute rows, or the model that defines it.
             path: The URL path for the endpoint.
             inputs: Columns to accept as request fields. Defaults to all non-computed columns
-                (of the base table, if `t` is a view).
+                (of the base table, if `t` is a view). Together with `uploadfile_inputs`, they must include
+                every required (non-nullable, non-computed) column that the `outputs` depend on.
             uploadfile_inputs: Columns to accept as
                 [`UploadFile`](https://fastapi.tiangolo.com/tutorial/request-files/) fields
                 (must be media-typed). These are sent as multipart form data; all other inputs
                 become [`Form`](https://fastapi.tiangolo.com/tutorial/request-forms/) fields.
             outputs: Columns from the computed rows to pass to the decorated function.
-                Defaults to all columns (including inputs).
+                Defaults to all columns (including inputs). Only these columns and the columns they
+                depend on are computed.
             export_sql: If set, export the decorated function's return value into an external
                 RDBMS table after the computation succeeds. See
                 [`SqlExport`][pixeltable.serving.SqlExport] for the target specification and
@@ -1260,7 +1266,8 @@ def insert_route(
         Args:
             t: The table to insert into, or the model that defines it.
             path: The URL path for the endpoint.
-            inputs: Columns to accept as request fields. Defaults to all non-computed columns.
+            inputs: Columns to accept as request fields. Defaults to all non-computed columns. Together with
+                `uploadfile_inputs`, they must include every required (non-nullable, non-computed) column.
             uploadfile_inputs: Columns to accept as
                 [`UploadFile`](https://fastapi.tiangolo.com/tutorial/request-files/) fields
                 (must be media-typed). These are sent as multipart form data; all other inputs
@@ -2182,7 +2189,7 @@ def run_dml(row_kwargs: dict[str, Any], url_for_media: Callable[[str], str]) ->
                     raise HTTPException(status_code=404, detail='row not found')
                 rows = status.rows or []
             elif route_type == 'compute':
-                rows = tbl.compute([row_kwargs])
+                rows = tbl.compute([row_kwargs], outputs=output_col_names)
     
```

---

### Incident Patch 4: `c4cfb1a3` (2026-09-30)
**Commit Message**: [PXT-1446] Fix Variable handling in aggregate queries (#1689)

Fix aggregate queries that use bound `@pxt.query` parameters (they show
up as `Variable` type expressions). The planner now treats parameters as
valid inputs to aggregate expressions and avoids computing aggregate
outputs in the inner table scan. This prevents crashes in queries such
as `sum(column + parameter)` and
`mean(column.similarity(string=parameter))`.

**File**: `pixeltable/plan.py` (modified, +15/-8)
```diff
@@ -199,19 +199,17 @@ def _determine_agg_status(self, e: exprs.Expr, grouping_expr_ids: set[int]) -> t
                 if not is_input:
                     raise excs.RequestError(excs.ErrorCode.INVALID_EXPRESSION, f'Invalid nested aggregates: {e}')
             return True, False
-        elif isinstance(e, exprs.Literal):
+        elif isinstance(e, (exprs.Literal, exprs.Variable)):
             return True, True
         elif isinstance(e, (exprs.ColumnRef, exprs.RowidRef)):
             # we already know that this isn't a grouping expr
             return False, True
         else:
             # an expression such as <grouping expr 1> + <grouping expr 2> can both be the output and input of agg
             assert len(e.components) > 0
-            component_is_output, component_is_input = zip(
-                *[self._determine_agg_status(c, grouping_expr_ids) for c in e.components]
-            )
-            is_output = component_is_output.count(True) == len(e.components)
-            is_input = component_is_input.count(True) == len(e.components)
+            statuses: list[tuple[bool, bool]] = [self._determine_agg_status(c, grouping_expr_ids) for c in e.components]
+            is_output = all(out for out, _ in statuses)
+            is_input = all(inp for _, inp in statuses)
             if not is_output and not is_input:
                 raise excs.RequestError(
                     excs.ErrorCode.INVALID_EXPRESSION, f'Invalid expression, mixes aggregate with non-aggregate: {e}'
@@ -1111,14 +1109,23 @@ def _create_query_plan(
         cls._verify_join_clauses(analyzer)
 
         # materialized with SQL table scans (ie, single-table SELECT statements):
-        # - select list subexprs that aren't aggregates
+        # - Select list subexprs that aren't aggregates. In a grouping aggregation, only the args of aggregate and
+        # window function calls; the rest of the analyzer's select list is aggregate output, which is not allowed to be
+        # materialized in the inner scan.
         # - join clause subexprs
         # - subexprs of Where clause conjuncts that can't be run in SQL
         # - all grouping exprs
         # - all stratify exprs
+        select_list_inputs: list[exprs.Expr]
+        if analyzer.group_by_clause is None:
+            select_list_inputs = analyzer.select_list
+        else:
+            select_list_inputs = []
+            for fn_call in analyzer.agg_fn_calls + analyzer.window_fn_calls:
+                select_list_inputs.extend(fn_call.components)
         candidates = list(
             exprs.Expr.list_subexprs(
-                analyzer.select_list,
+                select_list_inputs,
                 filter=lambda e: (
                     sql_elements.contains(e)
                     and not e.contains_(cls=exprs.FunctionCall, filter=lambda e: bool(e.is_agg_fn_call))
```

**File**: `tests/test_exprs.py` (modified, +12/-0)
```diff
@@ -1803,6 +1803,18 @@ def series_to_list(series: pd.Series) -> list[int | None]:
         r4 = t.group_by(t.c_bool, t.c_string).select(two='2').collect()
         assert len(r1) == len(r4)
 
+        # an output derived from a grouping expr is computed from the grouped value
+        grouped = t.where(t.c_int != None).group_by(t.c_int)
+        for i, res in enumerate(
+            (
+                grouped.select(t.c_int, succ=t.c_int + 1, out=int_sum).order_by(t.c_int).collect(),
+                grouped.select(t.c_int, succ=t.c_int + 1, out=pxtf.sum(_add_one(t.c_int))).order_by(t.c_int).collect(),
+                grouped.select(t.c_int, succ=t.c_int + 1).order_by(t.c_int).collect(),
+            )
+        ):
+            assert len(res) > 0, i
+            assert res['succ'] == [x + 1 for x in res['c_int']], i
+
         # we correctly apply a limit to the agg output
         r5 = t.group_by(t.c_bool).select(s=pxtf.sum(t.c_int)).collect()['s']
         r6 = (
```

**File**: `tests/test_function.py` (modified, +38/-0)
```diff
@@ -592,6 +592,44 @@ def skipped(off: int) -> pxt.Query:
         with pxt_raises(pxt.ErrorCode.UNSUPPORTED_OPERATION, match="'offset'"):
             neg.add_computed_column(c=skipped(neg.n), on_error='abort')
 
+    def test_query_param_in_aggregate(self, db_root: DatabaseRoot) -> None:
+        p = db_root.make_catalog_path
+        t = pxt.create_table(p('test'), {'x': pxt.Int})
+        t.insert({'x': i} for i in range(4))
+        params = pxt.create_table(p('params'), {'k': pxt.Int})
+        params.insert([{'k': 1}, {'k': 2}])
+
+        @pxt.query(return_scalar=True)
+        def shifted_sum(k: int) -> pxt.Query:
+            return t.select(s=pxtf.sum(t.x + k))
+
+        res = params.order_by(params.k).select(r=shifted_sum(params.k)).collect()
+        assert res['r'] == [[10], [14]]
+
+        @pxt.query
+        def sum_with_param(k: int) -> pxt.Query:
+            return t.select(s=pxtf.sum(t.x), k=k)
+
+        res = params.order_by(params.k).select(r=sum_with_param(params.k)).collect()
+        assert res['r'] == [[{'s': 6, 'k': 1}], [{'s': 6, 'k': 2}]]
+
+        @pxt.query
+        def sum_with_param_expr(k: int) -> pxt.Query:
+            return t.select(s=pxtf.sum(t.x), adjusted=k + 1)
+
+        res = params.order_by(params.k).select(r=sum_with_param_expr(params.k)).collect()
+        assert res['r'] == [[{'s': 6, 'adjusted': 2}], [{'s': 6, 'adjusted': 3}]]
+
+        @pxt.query
+        def grouped_sum_with_param_expr(k: int) -> pxt.Query:
+            return t.group_by(t.x % 2).select(g=t.x % 2, s=pxtf.sum(t.x), scaled=k * 10).order_by(t.x % 2)
+
+        res = params.order_by(params.k).select(r=grouped_sum_with_param_expr(params.k)).collect()
+        assert res['r'] == [
+            [{'g': 0, 's': 2, 'scaled': 10}, {'g': 1, 's': 4, 'scaled': 10}],
+            [{'g': 0, 's': 2, 'scaled': 20}, {'g': 1, 's': 4, 'scaled': 20}],
+        ]
+
     def test_query2(self, db_root: DatabaseRoot) -> None:
         p = db_root.make_catalog_path
         schema: dict[str, Any] = {'query_text': pxt.String | None, 'i': pxt.Int | None}
```

**File**: `tests/test_index.py` (modified, +26/-0)
```diff
@@ -272,6 +272,32 @@ def top_k_chunks_deprecated(query_text: str) -> pxt.Query:
         # insert more rows in order to run the query function
         validate_update_status(queries.insert(query_rows))
 
+    def test_query_similarity_in_aggregate(self, db_root: DatabaseRoot, local_embed: pxt.Function) -> None:
+        p = db_root.make_catalog_path
+        chunks = pxt.create_table(p('chunks'), {'text': pxt.String})
+        chunks.insert(
+            [
+                {'text': 'the stock of artificial intelligence companies is up 1000%'},
+                {'text': 'machine learning is a subset of artificial intelligence'},
+                {'text': 'gas car companies are in danger of being left behind by electric car companies'},
+            ]
+        )
+        chunks.add_embedding_index(column='text', string_embed=local_embed)
+        query_texts = ['artificial intelligence', 'electric cars']
+        queries = pxt.create_table(p('queries'), {'query_text': pxt.String})
+        queries.insert({'query_text': q} for q in query_texts)
+
+        @pxt.query
+        def sim_stats(q: str) -> pxt.Query:
+            sim = chunks.text.similarity(string=q)
+            return chunks.select(mean=pxtf.mean(sim), mean_sq=pxtf.mean(sim * sim), n=pxtf.count(sim))
+
+        res = queries.order_by(queries.query_text).select(r=sim_stats(queries.query_text)).collect()
+        for q, r in zip(query_texts, res['r'], strict=True):
+            sim = chunks.text.similarity(string=q)
+            expected = chunks.select(mean=pxtf.mean(sim), mean_sq=pxtf.mean(sim * sim), n=pxtf.count(sim)).collect()
+            assert r == [expected[0]]
+
     def test_search_fn(self, small_img_tbl: pxt.Table, local_embed: pxt.Function) -> None:
         t = small_img_tbl
         sample_img = t.select(t.img).head(1)[0, 'img']
```

---

### Incident Patch 5: `f1f51533` (2026-09-30)
**Commit Message**: [PXT-1413] Fix for serving routes with @pxt.query (#1694)

Fixes [PXT-1413](https://pixeltable.atlassian.net/browse/PXT-1413).

`TableModelMeta.table_path()` failed for a model whose computed column
calls a `@pxt.query` over another model: building the column serializes
its value, and `ModelQuery.as_dict()` refuses. Every use of the model's
defined shape before binding raised `INTERNAL_ERROR`, not only DML
routes: `Model.where()` / `select()`, a `@pxt.query` or query route over
the model, a view model based on it, and a column invoking a
query-backed tool.

`table_path()` now rebinds each query udf to its model's defined shape
(`ModelQuery.to_defined_query()`) before `prepare_model()`. The value
serialized into this metadata is never deserialized:
`ColumnVersionMd.is_computed` only checks it against `None`.
`bind_query_templates()` takes `catalog_dir=None` for this case;
`_create()` and `update_all()` are unchanged.

Tests:
- `test_query_udf_column_target`: insert, compute, delete, and query
routes on such a model, served end to end.
- `test_view_over_query_udf_model`: a view model over such a model, with
a query udf column and a query-backed tool column.

🤖 Generated with [Claude

**File**: `pixeltable/catalog/model/base.py` (modified, +7/-4)
```diff
@@ -32,10 +32,13 @@ def _queried_models(col_spec: ColumnSpec) -> set[TableModelMeta]:
     if not isinstance(value, exprs.Expr):
         return set()
     result: set[TableModelMeta] = set()
-    for fn_call in value.subexprs(exprs.FunctionCall):
-        fn = fn_call.fn
-        if isinstance(fn, func.QueryTemplateFunction) and isinstance(fn.template_query, ModelQuery):
-            result.add(fn.template_query.model_cls)
+    pending = [value]
+    while len(pending) > 0:
+        for fn_call in pending.pop().subexprs(exprs.FunctionCall):
+            fn = fn_call.fn
+            if isinstance(fn, func.QueryTemplateFunction) and isinstance(fn.template_query, ModelQuery):
+                result.add(fn.template_query.model_cls)
+                pending.extend(fn.template_query._component_exprs())
     return result
 
 
```

**File**: `pixeltable/catalog/model/definition.py` (modified, +7/-4)
```diff
@@ -449,8 +449,11 @@ def apply_decl_order(self) -> None:
         self.known_cols = ordered
 
 
-def bind_query_templates(e: exprs.Expr, catalog_dir: str) -> exprs.Expr:
-    """Rebind QueryTemplateFunction calls of ModelQuery instances to the equivalent Query of the bound model."""
+def bind_query_templates(e: exprs.Expr, catalog_dir: str | None) -> exprs.Expr:
+    """Rebind QueryTemplateFunction calls of ModelQuery instances to the equivalent Query of the bound model.
+
+    With `catalog_dir=None`, each Query is over its model's defined shape rather than over a table.
+    """
     from .query import ModelQuery
 
     subst: exprs.ExprDict[exprs.Expr] = exprs.ExprDict()
@@ -460,7 +463,7 @@ def bind_query_templates(e: exprs.Expr, catalog_dir: str) -> exprs.Expr:
             continue
         assert fn_call.group_by_start_idx == fn_call.group_by_stop_idx  # a query udf takes no window clause
         rebound = func.QueryTemplateFunction(
-            fn.template_query.bind(catalog_dir),
+            fn.template_query.to_defined_query() if catalog_dir is None else fn.template_query.bind(catalog_dir),
             list(fn.signature.parameters.values()),
             return_scalar=fn.return_scalar,
             path=fn.self_path,
@@ -885,7 +888,7 @@ def table_path(cls) -> catalog.TableMdPath:
         for col_name, col_spec in cls.__columns__.items():
             copied = col_spec.copy()
             if 'value' in copied:
-                copied['value'] = copied['value'].copy()
+                copied['value'] = bind_query_templates(copied['value'].copy(), None)
             columns[col_name] = copied
         iterator, cols, idxs = prepare_model(
             handle, columns, spec['display_name'], spec['iterator'], base, cls.__indexes__, spec['is_data_versioned']
```

**File**: `pixeltable/catalog/model/query.py` (modified, +7/-5)
```diff
@@ -11,7 +11,7 @@
 from pixeltable.exprs import ColumnRefByName
 from pixeltable.query_clauses import FromClause
 
-from .definition import MODEL_BY_DEFINED_TBL_ID, TableModelMeta
+from .definition import MODEL_BY_DEFINED_TBL_ID, TableModelMeta, bind_query_templates
 
 
 class ModelQuery(QueryBase):
@@ -99,7 +99,7 @@ def to_defined_query(self) -> pxt.Query:
         for col_md in defined_path.column_md():
             if col_md.name is not None:
                 subst[ColumnRefByName(col_md.name)] = exprs.ColumnRef(col_md)
-        return self._substituted(defined_path, subst)
+        return self._substituted(defined_path, subst, None)
 
     def bind(self, catalog_dir: str) -> pxt.Query:
         """The equivalent query over the table this query's model resolves to under catalog_dir."""
@@ -110,9 +110,11 @@ def bind(self, catalog_dir: str) -> pxt.Query:
         subst: exprs.ExprDict[exprs.Expr] = exprs.ExprDict()
         for col_name in tbl.columns():
             subst[ColumnRefByName(col_name)] = getattr(tbl, col_name)
-        return self._substituted(tbl._tbl_path, subst)
+        return self._substituted(tbl._tbl_path, subst, catalog_dir)
 
-    def _substituted(self, path: catalog.TablePath, subst: exprs.ExprDict[exprs.Expr]) -> pxt.Query:
+    def _substituted(
+        self, path: catalog.TablePath, subst: exprs.ExprDict[exprs.Expr], catalog_dir: str | None
+    ) -> pxt.Query:
         """A plain Query over path, with this query's clauses rewritten by subst."""
         # a similarity expression names its indexed column and the table version holding the index, neither of
         # which a substitution by column name reaches
@@ -137,7 +139,7 @@ def _substituted(self, path: catalog.TablePath, subst: exprs.ExprDict[exprs.Expr
             )
 
         def rebound(e: exprs.Expr) -> exprs.Expr:
-            return e.copy().substitute(subst)
+            return bind_query_templates(e.copy().substitute(subst), catalog_dir)
 
         return pxt.Query(
             from_clause=FromClause(tbls=[path]),
```

**File**: `tests/serving/test_fastapi_models.py` (modified, +53/-0)
```diff
@@ -263,6 +263,59 @@ class Halved(TableModel, name='halved', base=Notes.where(Notes.val > 10).select(
         assert client.post('/half', json={'note_id': 3, 'val': 20}).json() == {'half': 10.0, 'plus': 11.0}
         assert client.post('/half', json={'note_id': 4, 'val': 5}).json() is None
 
+    def test_query_udf_column_target(self, db_root: DatabaseRoot) -> None:
+        """Routes can be declared against a model whose computed column calls a @pxt.query over another model."""
+        p = db_root.make_catalog_path
+        skip_test_if_not_installed('fastapi')
+        from pixeltable.serving import FastAPIRouter
+
+        TableModel = pxt.model_base()  # noqa: N806
+
+        class Docs(TableModel, name='docs'):
+            body: pxt.String
+
+        @pxt.query
+        def find(q: str) -> pxt.Query:
+            return Docs.where(Docs.body == q).select(Docs.body)  # type: ignore[arg-type]
+
+        class Asks(TableModel, name='asks'):
+            question = pxt.Column(type=pxt.String, primary_key=True)
+            hits = find(question)
+
+        @pxt.query
+        def asked(question: str) -> pxt.Query:
+            return Asks.where(Asks.question == question).select(Asks.hits)  # type: ignore[arg-type]
+
+        router = FastAPIRouter()
+        router.add_insert_route(
+            Asks,
+            path='/ins',
+            inputs=[Asks.question],  # type: ignore[arg-type]
+            outputs=[Asks.hits],  # type: ignore[arg-type]
+        )
+        router.add_compute_route(
+            Asks,
+            path='/comp',
+            inputs=[Asks.question],  # type: ignore[arg-type]
+            outputs=[Asks.hits],  # type: ignore[arg-type]
+        )
+        router.add_delete_route(
+            Asks,
+            path='/del',
+            match_columns=[Asks.question],  # type: ignore[arg-type]
+        )
+        router.add_query_route(path='/asked', query=asked)
+        client = make_test_client(router)
+
+        TableModel.create_all(p(''))
+        router.bind(p(''))
+        Docs.table.insert([{'body': 'alpha'}, {'body': 'beta'}])
+
+        assert client.post('/ins', json={'question': 'alpha'}).json() == {'hits': [{'body': 'alpha'}]}
+        assert client.post('/comp', json={'question': 'beta'}).json() == {'hits': [{'body': 'beta'}]}
+        assert client.post('/asked', json={'question': 'alpha'}).json() == {'rows': [{'hits': [{'body': 'alpha'}]}]}
+        assert client.post('/del', json={'question': 'alpha'}).json() == {'num_rows': 1}
+
     def test_bind(self, db_root: DatabaseRoot) -> None:
         """bind() resolves model targets, refuses what the tables cannot serve, and rejects a second target."""
         p = db_root.make_catalog_path
```

**File**: `tests/test_table_model.py` (modified, +120/-0)
```diff
@@ -2661,6 +2661,126 @@ class ProbeV2(TableModelV2, name='probe'):
         rows = probe.order_by(probe.cutoff).select(probe.matches).collect()
         assert [r['matches'] for r in rows] == [[{'title': 'beta'}], [{'title': 'beta'}]]
 
+    def test_view_over_query_udf_model(self, db_root: DatabaseRoot) -> None:
+        """A view model can be based on a model whose computed columns call a query udf over another model."""
+        from pixeltable.functions import anthropic
+
+        TableModel = pxt.model_base()
+
+        class Docs(TableModel, name='docs'):
+            doc_id: pxt.Int
+            title: pxt.String
+
+        @pxt.query
+        def titles_after(cutoff: int) -> pxt.Query:
+            return Docs.where(Docs.doc_id > cutoff).order_by(Docs.doc_id).select(Docs.title)  # type: ignore[arg-type]
+
+        class Probe(TableModel, name='probe'):
+            cutoff: pxt.Int
+            response: pxt.Json
+            matches = titles_after(cutoff)
+            tool_matches = anthropic.invoke_tools(pxt.tools(titles_after), response)
+
+        class ProbeView(TableModel, name='probe_view', base=Probe.where(Probe.cutoff > 0)):
+            match_count = pxtf.json.len(Probe.matches)
+
+        target = db_root.make_catalog_path('qudf_view')
+        pxt.create_dir(target, parents=True)
+        TableModel.create_all(target)
+        pxt.get_table(f'{target}/docs').insert([{'doc_id': 1, 'title': 'alpha'}, {'doc_id': 5, 'title': 'beta'}])
+        tool_use = {'type': 'tool_use', 'name': 'titles_after', 'input': {'cutoff': 1}}
+        pxt.get_table(f'{target}/probe').insert(
+            [{'cutoff': 0, 'response': {'content': [tool_use]}}, {'cutoff': 1, 'response': {'content': [tool_use]}}]
+        )
+
+        view = pxt.get_table(f'{target}/probe_view')
+        rows = view.select(view.matches, view.tool_matches, view.match_count).collect()
+        assert list(rows) == [
+            {'matches': [{'title': 'beta'}], 'tool_matches': {'titles_after': [[{'title': 'beta'}]]}, 'match_count': 1}
+        ]
+
+    def test_nested_query_udf_over_model(self, db_root: DatabaseRoot) -> None:
+        """A query udf over a model can select a query udf over another model."""
+        TableModel = pxt.model_base()
+
+        class Docs(TableModel, name='docs'):
+            topic: pxt.String
+            title: pxt.String
+
+        @pxt.query
+        def titles_for(topic: str) -> pxt.Query:
+            return Docs.where(Docs.topic == topic).order_by(Docs.title).select(Docs.title)  # type: ignore[arg-type]
+
+        class Topics(TableModel, name='topics'):
+            topic: pxt.String
+
+        @pxt.query
+        def topics_like(prefix: str) -> pxt.Query:
+            matching = Topics.where(Topics.topic.startswith(prefix))  # type: ignore[arg-type]
+            return matching.order_by(Topics.topic).select(Topics.topic, titles=titles_for(Topics.topic))  # type: ignore[arg-type]
+
+        class Probe(TableModel, name='probe'):
+            prefix: pxt.String
+            matches = topics_like(prefix)
+
+        class ProbeView(TableModel, name='probe_view', base=Probe.where(Probe.prefix != '')):
+            pass
+
+        target = db_root.make_catalog_path('qudf_nested')
+        pxt.create_dir(target, parents=True)
+        TableModel.create_all(target)
+        pxt.get_table(f'{target}/docs').insert(
+            [{'topic': 'cats', 'title': 'b'}, {'topic': 'cats', 'title': 'a'}, {'topic': 'dogs', 'title': 'c'}]
+        )
+        pxt.get_table(f'{target}/topics').insert([{'topic': 'cats'}, {'topic': 'cows'}, {'topic': 'dogs'}])
+        pxt.get_table(f'{target}/probe').insert([{'prefix': 'c'}, {'prefix': ''}])
+
+        view = pxt.get_table(f'{target}/probe_view')
+        assert view.select(view.matches).collect()['matches'] == [
+            [{'topic': 'cats', 'titles': [{'title': 'a'}, {'title': 'b'}]}, {'topic': 'cows', 'titles': []}]
+        ]
+
+    def test_update_all_nested_query_udf_over_model(self, db_root: DatabaseRoot) -> None:
+        """`update_all()` creates every model a new column queries, including through a nested query udf."""
+        TableModel = pxt.model_base()
+
+        class Probe(TableModel, name='probe'):
+            topic: pxt.String
+
+        target = db_root.make_catalog_path('qudf_nested_update')
+        pxt.create_dir(target, parents=True)
+        TableModel.create_all(target)
+        pxt.get_table(f'{target}/probe').insert([{'topic': 'cats'}])
+
+        reload_catalog()
+        TableModelV2 = pxt.model_base()
+
+        class Docs(TableModelV2, name='docs'):
+            topic: pxt.String
+            title: pxt.String
+
+        @pxt.query
+        def titles_for(topic: str) -> pxt.Query:
+            return Docs.where(Docs.topic == topic).select(Docs.title)  # type: ignore[arg-type]
+
+        class Topics(TableModelV2, name='topics'):
+            topic: pxt.String
+
+        @pxt.query
+        def topic_titles(topic: str) -> pxt.Query:
+       
```

---

### Incident Patch 6: `78edb4a1` (2026-09-29)
**Commit Message**: [PXT-1475] Require OpenAI SDK version >= 3 (#1692)

**File**: `pixeltable/functions/openai.py` (modified, +2/-0)
```diff
@@ -40,6 +40,8 @@
 
 @env.register_client('openai', credential_param='api_key')
 def _(api_key: str, base_url: str | None = None, api_version: str | None = None) -> 'openai.AsyncOpenAI':
+    env.Env.get().require_package('openai', [3])
+
     import httpx2
     import openai
 
```

---

### Incident Patch 7: `a9f42fd4` (2026-09-28)
**Commit Message**: run hosted_environment fixture before others (#1671)

This should fix `No such file or directory: 'uv'` in nightly.

`TestDb` pulls in `project`, which pulls in `pixeltable_wheel`, which
fails because there's no `uv` and no pixeltable source to build from.
But `TestDb` is not even supposed to run because there's no pixeltable
API key.

Fix: make `hosted_environment` (that skips tests when there's no api
key) a session-scoped fixture, which moves it to before `project`.

**File**: `tests/pixeltable_cli/conftest.py` (modified, +7/-1)
```diff
@@ -24,7 +24,7 @@
 from pixeltable.config import Config
 from pixeltable_cli.client.utils import is_running
 
-from ..utils import CLOUD_DB_ROOT_URIS, DatabaseRoot, cloud_env_configured, home_bucket_uri
+from ..utils import CLOUD_DB_ROOT_URIS, DatabaseRoot, cloud_env_configured, home_bucket_uri, skip_test_if_no_config
 
 _REPO_ROOT = pathlib.Path(__file__).parents[2]
 _CORPUS_DIR = pathlib.Path(__file__).parent
@@ -246,6 +246,12 @@ def copy_app_corpus(session_project: pathlib.Path) -> pathlib.Path:
     return directory
 
 
+@pytest.fixture(scope='session')  # session scope makes it run before the session-scoped pixeltable_wheel
+def hosted_environment() -> None:
+    """Skip unless a control plane is configured."""
+    skip_test_if_no_config('api_key')
+
+
 @pytest.fixture(scope='session')
 def pixeltable_wheel(tmp_path_factory: pytest.TempPathFactory) -> pathlib.Path:
     """A wheel built from this working tree, for a project to install in place of the released pixeltable."""
```

**File**: `tests/pixeltable_cli/test_db.py` (modified, +1/-7)
```diff
@@ -15,7 +15,7 @@
 import pytest
 
 from pixeltable.service import proxy_daemon
-from tests.utils import DatabaseRoot, new_db_uri, skip_test_if_no_config
+from tests.utils import DatabaseRoot, new_db_uri
 
 from .conftest import (
     APPLY_TIMEOUT,
@@ -52,12 +52,6 @@ def get_target_ops(plan: dict[str, Any], target: str) -> list[dict[str, Any]]:
     return [op for op in plan['ops'] if op['target'] == target]
 
 
-@pytest.fixture
-def hosted_environment() -> None:
-    """Skip the test unless a control plane is configured to create the database against."""
-    skip_test_if_no_config('api_key')
-
-
 @pytest.fixture(scope='module')
 def test_db_uri(session_cli: PxtRunner, session_project: pathlib.Path) -> Iterator[str]:
     """A database URI of this module's own, naming nothing until a test creates it, deleted when it ends.
```

**File**: `tests/pixeltable_cli/test_key.py` (modified, +0/-8)
```diff
@@ -11,19 +11,11 @@
 
 import pytest
 
-from tests.utils import skip_test_if_no_config
-
 from .conftest import PxtRunner
 
 _ORG_URI = 'pxt://{org}:main'
 
 
-@pytest.fixture
-def hosted_environment() -> None:
-    """Skip unless a control plane is configured to create keys against."""
-    skip_test_if_no_config('api_key')
-
-
 @pytest.fixture
 def key_name(cli: PxtRunner) -> Iterator[str]:
     """A name no other run uses, deleted afterwards whether or not the test got that far."""
```

**File**: `tests/pixeltable_cli/test_service.py` (modified, +1/-0)
```diff
@@ -1146,6 +1146,7 @@ def test_example(self, cli: PxtRunner, db_root: DatabaseRoot, project_dir: pathl
 @pytest.mark.remote_api
 @pytest.mark.expensive
 @pytest.mark.db_roots('local', reason='pxt service acts on a hosted database, not on the catalog a test runs against')
+@pytest.mark.usefixtures('hosted_environment')
 class TestHostedService:
     """`pxt service` against a hosted database."""
 
```

---

### Incident Patch 8: `559ec38b` (2026-09-26)
**Commit Message**: Restore the Cloud guide at /cloud (#1680)

## Summary
- Move the Cloud guide to `/cloud` and redirect
`/howto/deployment/cloud` there. First runs sign in with `pxt login` and
use `pxt://org:main`, the database `pxt org create` already provisions.
- Keep the image, change, and operate sections from the current deploy
page, and restart both the database and the service after a secret
change. `pxt service run` stays local.
- Align the README, Quickstart, How it works, serving, and CLI pages on
that path. The CLI calls the destination the last argument. Login and
keys need Pixeltable 0.7.10 or later.

## Test plan
- [ ] Confirm `integrations.telemetry.enabled` is still `true` in
`docs/release/docs.json`
- [ ] Open `/cloud` and `/howto/deployment/cloud` after the docs deploy
and check the redirect
- [ ] Read the first-run commands on the README, Quickstart, and Cloud
page: `pxt login`, then `pxt db update`, `pxt schema update`, `pxt
service update` against `pxt://org:main`


Made with [Cursor](https://cursor.com)
<!-- devin-review-badge-begin -->

---

<a href="https://app.devin.ai/review/pixeltable/pixeltable/pull/1680"
target="_blank"><picture><source media="(prefers-color-scheme: dar

**File**: `README.md` (modified, +13/-8)
```diff
@@ -11,7 +11,7 @@
 [**Quickstart**](https://docs.pixeltable.com/overview/quick-start) |
 [**Documentation**](https://docs.pixeltable.com/) |
 [**CLI**](https://docs.pixeltable.com/platform/cli) |
-[**Cloud**](https://docs.pixeltable.com/howto/deployment/cloud) |
+[**Cloud**](https://docs.pixeltable.com/cloud) |
 [**Discord**](https://discord.gg/QPyqFYx2UN)
 
 [![License](https://img.shields.io/badge/License-Apache%202.0-0530AD.svg)](https://opensource.org/licenses/Apache-2.0)
@@ -95,12 +95,17 @@ curl -X POST "$URL/docs" \
 # {"id":"...","title_upper":"HELLO","summary":"Hello"}
 ```
 
-The same file runs on Pixeltable Cloud. Create an API key in the [Cloud dashboard](https://docs.pixeltable.com/howto/deployment/cloud#get-an-api-key), set `PIXELTABLE_API_KEY`, name the database in `pixeltable.toml`, then target it by URI. `pxt db update` creates or updates the hosted database; it does not insert rows. `pxt service run` is local only and cannot target Cloud.
+The same file runs on [Pixeltable Cloud](https://docs.pixeltable.com/cloud). Sign in with `pxt login`. `pxt org create` provisions `main`. Add this entry to the project file before `pxt db update`. Without it, the command errors. An [API key](https://docs.pixeltable.com/cloud#get-an-api-key) is optional for CLI automation and required for direct hosted HTTP calls. `PIXELTABLE_API_KEY`, or `api_key` in the config file, takes precedence over a `pxt login` session. `pxt db update` uploads the project onto that database and builds the image. It does not insert rows. `pxt service run` is local only and cannot target Cloud.
+
+```toml
+[[pixeltable.database]]
+name = 'pxt://org:main'
+```
 
 ```bash
-pxt db update pxt://org:mydb
-pxt schema update app.py pxt://org:mydb
-pxt service update app.py pxt://org:mydb
+pxt db update pxt://org:main
+pxt schema update app.py pxt://org:main
+pxt service update app.py pxt://org:main
 ```
 
 A `@pxt.udf` in that same `app.py` is in the image `pxt db update` builds.
@@ -140,6 +145,6 @@ Apache 2.0. [Contributing](https://github.com/pixeltable/pixeltable/blob/main/CO
 [cursor-badge]: https://img.shields.io/badge/Open_in-Cursor-000000
 [claude-badge]: https://img.shields.io/badge/Open_in-Claude-D97757
 [chatgpt-badge]: https://img.shields.io/badge/Open_in-ChatGPT-10A37F
-[cursor-prompt]: https://cursor.com/link/prompt?text=Build+a+multimodal+AI+data+app+with+Pixeltable.+First+follow+https%3A%2F%2Fpixeltable.com%2Fget-started.md+%28install+pxt%2C+the+Pixeltable+Skill%2C+and+MCP%29.+Then+%60pip+install+%27pixeltable%5Bserve%5D%27%60%2C+%60pxt+init%60%2C+and+%60pxt+service+example+--out+app.py%60.+Declare+tables%2C+computed+columns%2C+embeddings%2C+and+FastAPIRouter+routes+in+that+one+Python+file.+Apply+with+%60pxt+schema+update+app.py+my_app%60%2C+serve+locally+with+%60pxt+service+update+app.py+my_app%60.+Same+file+on+Cloud%3A+set+PIXELTABLE_API_KEY%2C+add+%60%5B%5Bpixeltable.database%5D%5D%60+with+%60name+%3D+%27pxt%3A%2F%2Forg%3Adb%27%60%2C+then+%60pxt+db+update+pxt%3A%2F%2Forg%3Adb%60%2C+%60pxt+schema+update+app.py+pxt%3A%2F%2Forg%3Adb%60%2C+%60pxt+service+update+app.py+pxt%3A%2F%2Forg%3Adb%60.+%60pxt+service+run%60+is+local+only.+Read+https%3A%2F%2Fpixeltable.com%2Fllms.txt+and+https%3A%2F%2Fdocs.pixeltable.com.
-[claude-prompt]: https://claude.ai/new?q=Build+a+multimodal+AI+data+app+with+Pixeltable.+First+follow+https%3A%2F%2Fpixeltable.com%2Fget-started.md+%28install+pxt%2C+the+Pixeltable+Skill%2C+and+MCP%29.+Then+%60pip+install+%27pixeltable%5Bserve%5D%27%60%2C+%60pxt+init%60%2C+and+%60pxt+service+example+--out+app.py%60.+Declare+tables%2C+computed+columns%2C+embeddings%2C+and+FastAPIRouter+routes+in+that+one+Python+file.+Apply+with+%60pxt+schema+update+app.py+my_app%60%2C+serve+locally+with+%60pxt+service+update+app.py+my_app%60.+Same+file+on+Cloud%3A+set+PIXELTABLE_API_KEY%2C+add+%60%5B%5Bpixeltable.database%5D%5D%60+with+%60name+%3D+%27pxt%3A%2F%2Forg%3Adb%27%60%2C+then+%60pxt+db+update+pxt%3A%2F%2Forg%3Adb%60%2C+%60pxt+schema+update+app.py+pxt%3A%2F%2Forg%3Adb%60%2C+%60pxt+service+update+app.py+pxt%3A%2F%2Forg%3Adb%60.+%60pxt+service+run%60+is+local+only.+Read+https%3A%2F%2Fpixeltable.com%2Fllms.txt+and+https%3A%2F%2Fdocs.pixeltable.com.
-[chatgpt-prompt]: https://chatgpt.com/?prompt=Build+a+multimodal+AI+data+app+with+Pixeltable.+First+follow+https%3A%2F%2Fpixeltable.com%2Fget-started.md+%28install+pxt%2C+the+Pixeltable+Skill%2C+and+MCP%29.+Then+%60pip+install+%27pixeltable%5Bserve%5D%27%60%2C+%60pxt+init%60%2C+and+%60pxt+service+example+--out+app.py%60.+Declare+tables%2C+computed+columns%2C+embeddings%2C+and+FastAPIRouter+routes+in+that+one+Python+file.+Apply+with+%60pxt+schema+update+app.py+my_app%60%2C+serve+locally+with+%60pxt+service+update+app.py+my_app%60.+Same+file+on+Cloud%3A+set+PIXELTABLE_API_KEY%2C+add+%60%5B%5Bpixeltable.database%5D%5D%60+with+%60name+%3D+%27pxt%3A%2F%2Forg%3Adb%27%60%2C+then+%60pxt+db+update+pxt%3A%2F%2Forg%3Adb%60%2C+%60pxt+schema+update+app.py+pxt%3A%2F%2Forg%3Adb%60%2C+%60pxt+service+
```

**File**: `docs/release/cloud.mdx` (added, +198/-0)
```diff
@@ -0,0 +1,198 @@
+---
+title: 'Pixeltable Cloud'
+sidebarTitle: 'Pixeltable Cloud'
+description: 'Run the same application file against a hosted database'
+---
+
+<Note>
+  Pixeltable Cloud is in Limited Beta. Email [contact@pixeltable.com](mailto:contact@pixeltable.com) if you are interested.
+</Note>
+
+The [Quickstart](/overview/quick-start) runs `app.py` locally. Here, the same application file creates tables and starts HTTP on a hosted database. A `pxt login` session is enough for the first deployment. You do not need an API key.
+
+## First deployment
+
+<Steps>
+  <Step title="Install Pixeltable and sign in">
+    `pxt login`, `pxt whoami`, and `pxt key` require Pixeltable 0.7.10 or later.
+
+    ```bash
+    pip install -U 'pixeltable[serve]'
+    pxt login
+    pxt whoami
+    pxt org list
+    ```
+
+    `pxt login` shows a code to confirm in your browser. Use the organization name from `pxt org list` in the `pxt://` commands below. If you have no organization, run `pxt org create org` first. It provisions your first database, `main`.
+  </Step>
+  <Step title="Prepare the application and Cloud target">
+    In a new directory, run:
+
+    ```bash
+    mkdir cloud-app && cd cloud-app
+    pxt init
+    pxt service example --out app.py
+    ```
+
+    `pxt service example` writes a working `app.py` with a `Docs` table and an `ingest` HTTP service. If you already completed the Quickstart, use that `app.py` instead.
+
+    Add a hosted database entry for that `main` database to the `pixeltable.toml` that `pxt init` created. Replace `org` with your organization name:
+
+    ```toml
+    [[pixeltable.database]]
+    name = 'pxt://org:main'
+    ```
+
+    Keep the local database entry that `pxt init` wrote. If your project has a `pyproject.toml`, `pxt init` adds its entry there instead. Use `[[tool.pixeltable.database]]` for the hosted entry.
+  </Step>
+  <Step title="Upload the project, create tables, and start the service">
+    Run these commands from the project directory, in order:
+
+    ```bash
+    pxt db update pxt://org:main
+    pxt schema update app.py pxt://org:main
+    pxt service update app.py pxt://org:main
+    pxt service list pxt://org:main
+    ```
+
+    `pxt org create` already provisioned `main`. `pxt db update` uploads the project onto that database and updates its image and size. It does not insert rows and does not start app endpoints. `pxt schema update` creates the tables. It does not start the endpoints. `pxt service update` starts hosted endpoints. Do not use `pxt service run` for Cloud. That command only starts endpoints in your local terminal.
+
+    `pxt service list` prints the service URL and its routes. The host looks like `https://{org}-{db}.svc.pxt.run/<service>`. The control plane host is separate. Do not hardcode either hostname.
+  </Step>
+  <Step title="Insert a row and check the result">
+    The generated `app.py` defines a `docs` table with a computed `title_upper` column. Insert a row from Python, or from the [Cloud dashboard](https://www.pixeltable.com/dashboard):
+
+    ```python
+    import pixeltable as pxt
+
+    docs = pxt.get_table('pxt://org:main/docs')
+    docs.insert(title='Hello', body='world')
+    print(docs.select(docs.title, docs.title_upper).collect())
+    ```
+
+    The result includes `Hello` and `HELLO`. The insert computes `title_upper` on Cloud. A local file path on a Cloud table uploads the file.
+  </Step>
+</Steps>
+
+A Cloud table path uses the URI plus `/table`, such as `pxt.get_table('pxt://org:main/docs')`. A local table uses dotted `namespace.table`, such as `pxt.get_table('my_app.docs')`. Run `pxt schema diff app.py pxt://org:main` to see pending schema changes. The same file can define `pxt.Image`, `pxt.Video`, `pxt.Audio`, or `pxt.Document` columns: [media pipelines](/use-cases/media-processing), [RAG](/use-cases/multimodal-backend).
+
+## Get an API key
+
+API keys are optional for the CLI and Python workflow above. Create one for CI, background jobs, or a backend that calls a hosted HTTP service. If a browser frontend needs that service, have it call your backend. Keep the key out of browser code.
+
+The CLI reads the key from `PIXELTABLE_API_KEY`, or from `api_key` in the `[pixeltable]` section of the Pixeltable config file. The environment variable wins. Either one takes precedence over a `pxt login` session. [Configuration](/platform/configuration).
+
+After `pxt login`, create a key from the CLI:
+
+```bash
+pxt key create my-app
+```
+
+The CLI prints the secret once. `pxt key list` shows key names, and cannot show their secrets again. A key created without `--grant` acts as you. [Scoped service keys](/platform/cli#pxt-key) are in preview. You can also create a key under **API Keys** in the [Cloud dashboard](https://www.pixeltable.com/dashboard).
+
+### Call the hosted service
+
+Get the service URL from `pxt service list pxt://org:main`. Put the key in your backend's environment and send it in the `X-api-key` he
```

**File**: `docs/release/docs.json` (modified, +7/-7)
```diff
@@ -54,7 +54,7 @@
                   "howto/deployment/security"
                 ]
               },
-              "howto/deployment/cloud"
+              "cloud"
             ]
           },
           {
@@ -708,23 +708,23 @@
     },
     {
       "source": "/cloud/services",
-      "destination": "/howto/deployment/cloud"
+      "destination": "/cloud"
     },
     {
-      "source": "/cloud",
-      "destination": "/howto/deployment/cloud"
+      "source": "/howto/deployment/cloud",
+      "destination": "/cloud"
     },
     {
       "source": "/docs/cloud",
-      "destination": "/howto/deployment/cloud"
+      "destination": "/cloud"
     },
     {
       "source": "/use-cases/services",
-      "destination": "/howto/deployment/cloud"
+      "destination": "/cloud"
     },
     {
       "source": "/use-cases/cloud",
-      "destination": "/howto/deployment/cloud"
+      "destination": "/cloud"
     },
     {
       "source": "/notebooks/integrations/working-with-bedrock",
```

**File**: `docs/release/howto/coming-from.mdx` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ description: 'Pick the stack you already run. Inserting a row replaces the extra
 icon: 'right-left'
 ---
 
-Hosted catalog: [Cloud](/howto/deployment/cloud). This page maps the stack you already run onto Pixeltable.
+Hosted catalog: [Cloud](/cloud). This page maps the stack you already run onto Pixeltable.
 
 Defining the class does not create the table. Run `pxt schema update app.py my_app` first ([Quickstart](/overview/quick-start)); the snippets assume that already ran.
 
```

**File**: `docs/release/howto/deployment/cloud.mdx` (removed, +0/-170)
```diff
@@ -1,170 +0,0 @@
----
-title: 'Deploy to Pixeltable Cloud'
-sidebarTitle: 'Deploy to Pixeltable Cloud'
-description: 'Same application file against a hosted database'
----
-
-<Note>
-  Pixeltable Cloud is in Limited Beta. Email [contact@pixeltable.com](mailto:contact@pixeltable.com) if you are interested.
-</Note>
-
-Use the same `app.py` as the [Quickstart](/overview/quick-start). Sign in with `pxt login`, or create an API key in the Cloud dashboard and export it, then create the hosted database, the tables, and hosted HTTP.
-
-## Get an API key
-
-Sign in from the browser, create a key, then export it. The CLI reads the key from `PIXELTABLE_API_KEY`, or from `api_key` in the `[pixeltable]` section of the Pixeltable config file; the environment variable wins, and either one takes precedence over a `pxt login` session. To use the CLI without a key, run `pxt login` instead ([CLI](/platform/cli#signing-in)).
-
-<Steps>
-  <Step title="Sign in">
-    Cloud is in Limited Beta. Email [contact@pixeltable.com](mailto:contact@pixeltable.com) to get an account. Once you have one, sign in at [pixeltable.com/login](https://www.pixeltable.com/login) and the [dashboard](https://www.pixeltable.com/dashboard) opens your organization.
-  </Step>
-  <Step title="Create a key">
-    Open **API Keys** in the organization sidebar, or go to `https://www.pixeltable.com/dashboard/your-org/api-keys`. Click **New**, or **Create API Key** if the list is empty. Name the key. Click **Create Key**. Copy the value now. The dashboard shows the full key once.
-  </Step>
-  <Step title="Export it">
-    ```bash
-    export PIXELTABLE_API_KEY='your-key'
-    ```
-
-    Pixeltable reads the process environment and never loads a `.env` file on its own, so source one yourself first (`set -a; source .env; set +a`). [Configuration](/platform/configuration). This key authenticates Cloud CLI and hosted HTTP. Provider keys such as `OPENAI_API_KEY` go under **Secrets** in the dashboard, or `pxt secret set pxt://org OPENAI_API_KEY=...`. They do not go in this API key. [CLI](/platform/cli#pxt-secret).
-  </Step>
-</Steps>
-
-`pxt init` writes `pixeltable.toml`. Put the hosted URL in that file, then run the three commands:
-
-```toml
-[[pixeltable.database]]
-name = 'pxt://org:mydb'
-```
-
-```bash
-pxt db update pxt://org:mydb
-pxt schema update app.py pxt://org:mydb
-pxt service update app.py pxt://org:mydb
-```
-
-A Cloud table path uses the URI plus `/table`. Open it with `t = pxt.get_table('pxt://org:mydb/docs')`. A local table uses dotted `namespace.table`, such as `pxt.get_table('my_app.docs')`.
-
-```python
-import pixeltable as pxt
-import pixeltable.functions as pxtf
-from pixeltable.serving import FastAPIRouter
-
-TableModel = pxt.model_base()
-
-
-@pxt.udf
-def excerpt(text: str, n: int = 12) -> str:
-    return text if len(text) <= n else f'{text[:n]}...'
-
-
-class Docs(TableModel, name='docs'):
-    id = pxt.Column(value=pxtf.uuid.uuid7(), primary_key=True)
-    title: pxt.String
-    body: pxt.String | None
-    title_upper = pxtf.string.upper(title)
-    summary = excerpt(title)
-
-
-ingest = FastAPIRouter(name='ingest')
-ingest.add_insert_route(
-    Docs, path='/docs', inputs=[Docs.title, Docs.body], outputs=[Docs.id, Docs.title_upper, Docs.summary]
-)
-ingest.add_update_route(
-    Docs, path='/docs/update', inputs=[Docs.title], outputs=[Docs.id, Docs.title_upper]
-)
-ingest.add_compute_route(Docs, path='/titles', inputs=[Docs.title], outputs=[Docs.title_upper])
-```
-
-The same file can hold `pxt.Image`, `pxt.Video`, `pxt.Audio`, or `pxt.Document`: [media pipelines](/use-cases/media-processing), [RAG](/use-cases/multimodal-backend).
-
-`pxt db update` creates the hosted database, uploads the project files, and updates its image and size. It does not insert your data and does not start app endpoints. `pxt schema update` creates the tables. It does not start the endpoints. `pxt service update` starts hosted endpoints. Do not use `pxt service run` for Cloud; that command only starts endpoints in your local terminal.
-
-After the database is up, insert from the Cloud dashboard or from Python. A local file path on a Cloud table uploads the file. Run `pxt schema diff app.py pxt://org:mydb` to see pending schema changes.
-
-## What the database runs
-
-A hosted database runs two things that come from your project, and they move independently.
-
-- **The image** holds the Python environment: your dependencies, the Python version, and any system
-  packages. `pxt db update` rebuilds it only when that environment changed, which is the slow step.
-- **The project files** are your `app.py` and whatever else the entry selects. They are uploaded on
-  their own, without a rebuild.
-
-So editing a UDF costs an upload, while adding a line to `pyproject.toml` costs a build. Both are
-`pxt db update`; it works out which happened.
-
-`[[pixeltable.database]]` in `pixeltable.toml` declares which files are selected, what the image
-holds, and the CPU,
```

**File**: `docs/release/howto/deployment/infrastructure.mdx` (modified, +1/-1)
```diff
@@ -94,7 +94,7 @@ Default home is `~/.pixeltable`: `pgdata` (PostgreSQL), `media` (generated files
 
 - Inserted local files: the path is stored; the original stays put.
 - Inserted URLs: the URL is stored; first access downloads into the file cache.
-- Generated media: local disk on a laptop; on Cloud hosted tables, the per-database home bucket (`pxtfs://org:db/home`) unless you set `destination=`, `PIXELTABLE_OUTPUT_MEDIA_DEST`, or the database entry's `db_output_media_dest` for a bring-your-own bucket.
+- Generated media: local disk, or the Cloud database's home bucket (`pxtfs://org:db/home`). To use another bucket, set `destination=`, `PIXELTABLE_OUTPUT_MEDIA_DEST`, or `db_output_media_dest` in the database entry.
 
 File cache size is `file_cache_size_g` in `config.toml` only. [Configuration](/platform/configuration).
 
```

**File**: `docs/release/howto/deployment/operations.mdx` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ One Python process writes to `~/.pixeltable/pgdata`. Several API workers need a
 | Compute | Several workers, one volume |
 | Failover | Detach and reattach the volume |
 
-If you need more than one process writing the database, use [Pixeltable Cloud](/howto/deployment/cloud).
+If you need more than one process writing the database, use [Pixeltable Cloud](/cloud).
 
 ## GPU
 
```

**File**: `docs/release/howto/deployment/overview.mdx` (modified, +3/-3)
```diff
@@ -4,7 +4,7 @@ sidebarTitle: 'Overview'
 description: 'Choose what runs locally: Python only, your own FastAPI app, or pxt service.'
 ---
 
-Hosted catalog: [Cloud](/howto/deployment/cloud). This page is which local process to start after `pxt schema update`.
+Hosted catalog: [Cloud](/cloud). This page is which local process to start after `pxt schema update`.
 
 | If you want | What you run | What starts |
 |-------|----------------|-------------|
@@ -51,7 +51,7 @@ For Docker and disks, see [Infrastructure](/howto/deployment/infrastructure) and
   <Card title="HTTP serving" icon="globe" href="/howto/deployment/serving">
     Insert, compute, update, delete, query, uploads, background jobs.
   </Card>
-  <Card title="Cloud" icon="cloud" href="/howto/deployment/cloud">
-    Use the same `app.py` with a hosted URL such as `pxt://org:mydb`.
+  <Card title="Cloud" icon="cloud" href="/cloud">
+    Use the same `app.py` against `pxt://org:main`.
   </Card>
 </CardGroup>
```

---

### Incident Patch 9: `085dab34` (2026-09-24)
**Commit Message**: [PXT-1451] Fix missing * and / in UDF signatures (#1659)

**File**: `pixeltable/func/signature.py` (modified, +15/-0)
```diff
@@ -235,13 +235,28 @@ def __hash__(self) -> int:
     def params_str(self) -> str:
         """Generates a user friendly string describing this signature's input parameters"""
         param_strs: list[str] = []
+        pending_pos_only_marker = False
+        needs_kw_only_marker = True
         for p in self.parameters.values():
+            if p.kind == inspect.Parameter.POSITIONAL_ONLY:
+                pending_pos_only_marker = True
+            elif pending_pos_only_marker:
+                param_strs.append('/')
+                pending_pos_only_marker = False
+            if p.kind == inspect.Parameter.VAR_POSITIONAL:
+                needs_kw_only_marker = False
+            elif p.kind == inspect.Parameter.KEYWORD_ONLY and needs_kw_only_marker:
+                param_strs.append('*')
+                needs_kw_only_marker = False
+
             if p.kind == inspect.Parameter.VAR_POSITIONAL:
                 param_strs.append(f'*{p.name}')
             elif p.kind == inspect.Parameter.VAR_KEYWORD:
                 param_strs.append(f'**{p.name}')
             else:
                 param_strs.append(f'{p.name}: pxt.{p.col_type}')
+        if pending_pos_only_marker:
+            param_strs.append('/')
         return ', '.join(param_strs)
 
     def return_str(self, pretty_print_json: bool = False) -> str:
```

**File**: `tests/test_function.py` (modified, +18/-16)
```diff
@@ -322,29 +322,31 @@ def test_invalid_call(self, test_tbl: pxt.Table) -> None:
         multi_a = r"multiple values for argument 'a'"
         too_many_pos = r'too many positional arguments'
         exp_ab = r'expected \(a: pxt\.Int, b: pxt\.Int\)'
+        exp_ab_pos_only = r'expected \(a: pxt\.Int, b: pxt\.Int, /\)'
+        exp_ab_kw_only = r'expected \(\*, a: pxt\.Int, b: pxt\.Int\)'
 
         # udf with positional params only
-        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_a}; {exp_ab}, got \(\)'):
+        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_a}; {exp_ab_pos_only}, got \(\)'):
             _ = t.select(self.udf_pos_only_params()).collect()
-        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_a}; {exp_ab}, got \(x=Int\)'):
+        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_a}; {exp_ab_pos_only}, got \(x=Int\)'):
             _ = t.select(self.udf_pos_only_params(x=0)).collect()
-        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_b}; {exp_ab}, got \(Int\)'):
+        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_b}; {exp_ab_pos_only}, got \(Int\)'):
             _ = t.select(self.udf_pos_only_params(0)).collect()
-        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{pos_only_a}; {exp_ab}, got \(a=Int\)'):
+        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{pos_only_a}; {exp_ab_pos_only}, got \(a=Int\)'):
             _ = t.select(self.udf_pos_only_params(a=1)).collect()
-        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_b}; {exp_ab}, got \(Int, a=Int\)'):
+        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_b}; {exp_ab_pos_only}, got \(Int, a=Int\)'):
             _ = t.select(self.udf_pos_only_params(1, a=1)).collect()
-        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{pos_only_b}; {exp_ab}, got \(Int, b=Int\)'):
+        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{pos_only_b}; {exp_ab_pos_only}, got \(Int, b=Int\)'):
             _ = t.select(self.udf_pos_only_params(1, b=1)).collect()
 
         # udf with keyword params only
-        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_a}; {exp_ab}, got \(\)'):
+        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_a}; {exp_ab_kw_only}, got \(\)'):
             _ = t.select(self.udf_kw_only_params()).collect()
-        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{too_many_pos}; {exp_ab}, got \(Int\)'):
+        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{too_many_pos}; {exp_ab_kw_only}, got \(Int\)'):
             _ = t.select(self.udf_kw_only_params(0)).collect()
-        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_a}; {exp_ab}, got \(x=Int\)'):
+        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_a}; {exp_ab_kw_only}, got \(x=Int\)'):
             _ = t.select(self.udf_kw_only_params(x=0)).collect()
-        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_b}; {exp_ab}, got \(a=Int\)'):
+        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_b}; {exp_ab_kw_only}, got \(a=Int\)'):
             _ = t.select(self.udf_kw_only_params(a=0)).collect()
 
         # udf with positional or kw params
@@ -392,21 +394,21 @@ def test_invalid_call(self, test_tbl: pxt.Table) -> None:
             _ = t.select(self.udf_variadic_kw(1, x=0)).collect()
 
         # column ref as an argument for udf
-        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_b}; {exp_ab}, got \(Int\)'):
+        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_b}; {exp_ab_pos_only}, got \(Int\)'):
             _ = t.select(self.udf_pos_only_params(t.c2)).collect()
 
         # arbitrary expr as an argument
-        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_b}; {exp_ab}, got \(Float\)'):
+        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_b}; {exp_ab_pos_only}, got \(Float\)'):
             _ = t.select(self.udf_pos_only_params(t.c2 + t.c3)).collect()
-        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_b}; {exp_ab}, got \(a=Float\)'):
+        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_b}; {exp_ab_kw_only}, got \(a=Float\)'):
             _ = t.select(self.udf_kw_only_params(a=t.c2 + t.c3)).collect()
 
         # function call as an argument
-        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_b}; {exp_ab}, got \(a=Int\)'):
+        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_b}; {exp_ab_kw_only}, got \(a=Int\)'):
             _ = t.select(self.udf_kw_only_params(a=t.c2.increment())).collect()
-        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_b}; {exp_ab}, got \(a=Int\)'):
+        with pxt_raises(pxt.ErrorCode
```

---

### Incident Patch 10: `7d9af87e` (2026-09-22)
**Commit Message**: [PXT-1414] Fix for @query references in update_all() (#1651)

**File**: `pixeltable/catalog/model/base.py` (modified, +52/-13)
```diff
@@ -9,7 +9,7 @@
 from pixeltable.runtime import get_runtime
 from pixeltable.types import ColumnSpec
 
-from .definition import BtreeIndex, EmbeddingIndex, IndexDefinition, TableModelMeta
+from .definition import BtreeIndex, EmbeddingIndex, IndexDefinition, TableModelMeta, bind_query_templates
 from .diff import (
     _PY_MISMATCH_HINT,
     PY_DESTRUCTIVE_HINT,
@@ -22,28 +22,37 @@
 from .resolution import TableSchemaChangeSet
 
 
+def _queried_models(col_spec: ColumnSpec) -> set[TableModelMeta]:
+    """The models a column's value queries through a @pxt.query UDF."""
+    from pixeltable import exprs, func
+
+    from .query import ModelQuery
+
+    value = col_spec.get('value')
+    if not isinstance(value, exprs.Expr):
+        return set()
+    result: set[TableModelMeta] = set()
+    for fn_call in value.subexprs(exprs.FunctionCall):
+        fn = fn_call.fn
+        if isinstance(fn, func.QueryTemplateFunction) and isinstance(fn.template_query, ModelQuery):
+            result.add(fn.template_query.model_cls)
+    return result
+
+
 def _referenced_models(model: TableModelMeta) -> set[TableModelMeta]:
     """The models that have to be tables before `model` can be created.
 
     Its base, and every model a computed column queries through a @pxt.query UDF: both are recorded against
     the table the model resolves to, so that table has to exist first.
     """
-    from pixeltable import exprs, func
-
     from .query import ModelQuery
 
     result: set[TableModelMeta] = set()
     base = model.__table_spec__['base']
     if isinstance(base, ModelQuery):
         result.add(base.model_cls)
     for col_spec in model.__columns__.values():
-        value = col_spec.get('value')
-        if not isinstance(value, exprs.Expr):
-            continue
-        for fn_call in value.subexprs(exprs.FunctionCall):
-            fn = fn_call.fn
-            if isinstance(fn, func.QueryTemplateFunction) and isinstance(fn.template_query, ModelQuery):
-                result.add(fn.template_query.model_cls)
+        result |= _queried_models(col_spec)
     return result
 
 
@@ -171,12 +180,40 @@ def _update_all(catalog_dir: str = '', *, allow_destructive: bool = False) -> di
             (name, d) for name, d in diffs.items() if d.resolution in ('update_additive', 'update_destructive')
         ]
 
+        pending_creates = {name for name, d in diffs.items() if d.resolution == 'create'}
+
         if len(update_diffs) > 0:
             catalog_dir = catalog.Path.dir_prefix(catalog_dir)
+
+            added_cols = {
+                name: {c.name for c in d.ops if c.target == 'column' and c.op == 'add'} for name, d in update_diffs
+            }
+
+            # A new column may query a model this same call creates. Binding the column's query needs that
+            # table, so create it, and whatever it references in turn, ahead of the migrations below.
+            queried: set[TableModelMeta] = set()
+            for name, added in added_cols.items():
+                for col_name, col_spec in user_columns(registered_models[name]).items():
+                    if col_name in added:
+                        queried |= _queried_models(col_spec)
+            prerequisites: set[TableModelMeta] = set()
+            while len(queried) > 0:
+                queried_model = queried.pop()
+                if queried_model in prerequisites:
+                    continue
+                prerequisites.add(queried_model)
+                queried |= _referenced_models(queried_model)
+            # only the ones that don't exist yet: _create() also binds the model, and binding it before the
+            # migrations below would fix its columns to the pre-migration schema
+            for create_name, create_model in _creation_order(registered_models):
+                if create_model in prerequisites and create_name in pending_creates:
+                    _, was_created = create_model._create(catalog_dir)
+                    if was_created:
+                        pending_creates.discard(create_name)  # not a concurrent creation: this call made it
+
             change_sets: list[TableSchemaChangeSet] = []
             for name, d in update_diffs:
                 model = registered_models[name]
-                new_col_names = {c.name for c in d.ops if c.target == 'column' and c.op == 'add'}
                 dropped_col_names = [c.name for c in d.ops if c.target == 'column' and c.op == 'drop']
                 new_idx_refs = [c.details.index_ref for c in d.ops if c.target == 'index' and c.op == 'add']
                 dropped_idx_names = [c.name for c in d.ops if c.target == 'index' and c.op == 'drop']
@@ -187,13 +224,15 @@ def _update_all(catalog_dir: str = '', *, allow_destructive: bool = False) -> di
                 base_query_cols = base_query_columns(model)
                 new_columns: dict[str, tuple[ColumnSpec, Literal['base_query', 'model_body']]] = {}
                 for col_name, col_spec in user_cols.items()
```

**File**: `pixeltable/catalog/model/definition.py` (modified, +2/-2)
```diff
@@ -449,7 +449,7 @@ def apply_decl_order(self) -> None:
         self.known_cols = ordered
 
 
-def _bind_query_templates(e: exprs.Expr, catalog_dir: str) -> exprs.Expr:
+def bind_query_templates(e: exprs.Expr, catalog_dir: str) -> exprs.Expr:
     """Rebind QueryTemplateFunction calls of ModelQuery instances to the equivalent Query of the bound model."""
     from .query import ModelQuery
 
@@ -823,7 +823,7 @@ def _create(cls, catalog_dir: str = '') -> tuple[Table, bool]:
                     spec['type'], allow_builtin_types=False
                 )
             if 'value' in spec:
-                spec['value'] = _bind_query_templates(spec['value'].copy(), catalog_dir)
+                spec['value'] = bind_query_templates(spec['value'].copy(), catalog_dir)
             columns[name] = spec
 
         bound_path = f'{catalog_dir}{table_spec["name"]}'
```

**File**: `pixeltable/catalog/model/query.py` (modified, +4/-1)
```diff
@@ -103,7 +103,10 @@ def to_defined_query(self) -> pxt.Query:
 
     def bind(self, catalog_dir: str) -> pxt.Query:
         """The equivalent query over the table this query's model resolves to under catalog_dir."""
-        tbl = self.model_cls._bind(catalog_dir)
+        # _resolve_tbl() rather than _bind(): binding the model here would fix its columns to the schema the
+        # table has now, and update_all() may still be about to migrate it.
+        tbl = self.model_cls._resolve_tbl(catalog.Path.dir_prefix(catalog_dir), if_not_exists='error')
+        assert tbl is not None
         subst: exprs.ExprDict[exprs.Expr] = exprs.ExprDict()
         for col_name in tbl.columns():
             subst[ColumnRefByName(col_name)] = getattr(tbl, col_name)
```

**File**: `pixeltable/functions/string.py` (modified, +1/-1)
```diff
@@ -764,7 +764,7 @@ def splitlines(self: str, keepends: bool = False) -> list[str]:
 
 
 @pxt.udf(is_method=True)
-def startswith(self: str, substr: str) -> int:
+def startswith(self: str, substr: str) -> bool:
     """
     Return `True` if string starts with `substr`, otherwise return `False`.
 
```

**File**: `tests/test_table_model.py` (modified, +68/-0)
```diff
@@ -1118,6 +1118,74 @@ class ExampleViewModelFromQuery(
             view_from_query2.order_by(view_from_query2.id, view_from_query2.pos).collect(),
         )
 
+    def test_update_all_creates_queried_table(self, db_root: DatabaseRoot) -> None:
+        """The table a @pxt.query reads is created by the same update_all() that adds the column calling it."""
+        p = db_root.make_catalog_path
+        TableModel = pxt.model_base()
+
+        class Asks(TableModel, name='asks'):
+            question: pxt.String
+
+        TableModel.update_all(p(''))
+
+        TableModel2 = pxt.model_base()
+
+        class Docs(TableModel2, name='docs'):
+            body: pxt.String
+
+        @pxt.query
+        def find(q: str) -> pxt.Query:
+            return Docs.where(Docs.body.startswith(q)).select(body=Docs.body).limit(3)  # type: ignore[arg-type]
+
+        class Asks2(TableModel2, name='asks'):
+            question: pxt.String
+            hits = find(question)
+
+        TableModel2.update_all(p(''))
+
+        Docs.insert(body='A sample doc body that has a bunch of text')
+        Asks2.insert(question='A sample doc body')
+        res = Asks2.table.order_by(Asks2.question).collect()  # type: ignore[arg-type]
+        assert res[0] == {
+            'question': 'A sample doc body',
+            'hits': [{'body': 'A sample doc body that has a bunch of text'}],
+        }
+
+    def test_update_all_migrates_queried_model(self, db_root: DatabaseRoot) -> None:
+        """A @pxt.query reads a model that the same update_all() also migrates."""
+        p = db_root.make_catalog_path
+        TableModel = pxt.model_base()
+
+        class Docs(TableModel, name='docs'):
+            body: pxt.String
+
+        class Asks(TableModel, name='asks'):
+            question: pxt.String
+
+        TableModel.update_all(p(''))
+
+        TableModel2 = pxt.model_base()
+
+        class Docs2(TableModel2, name='docs'):
+            body: pxt.String
+            title: pxt.String | None  # added to the table that find() reads
+
+        @pxt.query
+        def find(q: str) -> pxt.Query:
+            return Docs2.where(Docs2.body == q).select(body=Docs2.body).limit(3)  # type: ignore[arg-type]
+
+        class Asks2(TableModel2, name='asks'):
+            question: pxt.String
+            hits = find(question)
+
+        TableModel2.update_all(p(''))
+
+        # binding find() must not leave Docs2 bound to the schema it had before its own column was added
+        Docs2.insert(body='alpha', title='A')
+        assert Docs2.table.select(Docs2.title).collect()['title'] == ['A']
+        Asks2.insert(question='alpha')
+        assert Asks2.table.select(Asks2.hits).collect()['hits'] == [[{'body': 'alpha'}]]
+
     def test_diff_all(self, db_root: DatabaseRoot) -> None:
         """diff_all() reports added/dropped columns and an iterator mismatch against already-created tables."""
         skip_test_if_not_installed('imagehash')
```

---

### Incident Patch 11: `f88e65f2` (2026-09-22)
**Commit Message**: [PXT-1386] Fix for cross-device move (#1652)

**File**: `pixeltable/utils/local_store.py` (modified, +7/-1)
```diff
@@ -1,5 +1,6 @@
 from __future__ import annotations
 
+import errno
 import glob
 import logging
 import os
@@ -152,7 +153,12 @@ def resolve_destination(
 
     def move_local_file(self, src_path: Path, dest: FileDestination) -> str | None:
         assert dest.local_path is not None
-        src_path.rename(dest.local_path)
+        try:
+            src_path.rename(dest.local_path)
+        except OSError as e:
+            if e.errno != errno.EXDEV:
+                raise
+            return None
         _logger.debug(f'Media Storage: moved {src_path} to {dest.url}')
         return dest.url
 
```

**File**: `tests/test_destination.py` (modified, +22/-0)
```diff
@@ -1,10 +1,12 @@
 from __future__ import annotations
 
+import errno
 import io
 import os
 import re
 import urllib.error
 import urllib.request
+import uuid
 from pathlib import Path
 from typing import ClassVar
 
@@ -382,6 +384,26 @@ def test_dest_local_copy(self, uses_db: None) -> None:
         # Ensure that local file is copied to a specified destination
         assert ObjectOps.count(t._id, dest=dest1_uri) == len(r)
 
+    @pytest.mark.db_roots('local', reason='media destination/object-store internals')
+    def test_dest_cross_device_move(self, monkeypatch: pytest.MonkeyPatch, uses_db: None) -> None:
+        """A destination on another filesystem than the TempStore falls back from rename to copy."""
+        dest_uri = self.resolve_destination_uri(StorageTarget.LOCAL_STORE)
+        store = ObjectOps.get_store(f'{dest_uri}/bucket1', False)
+
+        src_path = TempStore.create_path(extension='.bin')
+        src_path.write_bytes(b'cross-device payload')
+        dest = store.resolve_destination(uuid.uuid4(), 0, 0, ext=src_path.suffix)
+
+        def rename_exdev(self: Path, target: object) -> None:
+            raise OSError(errno.EXDEV, 'Invalid cross-device link')
+
+        monkeypatch.setattr(Path, 'rename', rename_exdev)
+        url = ObjectOps.put_file_resolved(store, src_path, dest, relocate_or_delete=True)
+
+        assert url == dest.url
+        assert dest.local_path.read_bytes() == b'cross-device payload'
+        assert not src_path.exists()
+
     @pytest.mark.very_expensive
     def test_dest_all(self, db_root: DatabaseRoot) -> None:
         """Test destination with all available storage targets"""
```

---

### Incident Patch 12: `851b0d0b` (2026-09-22)
**Commit Message**: Fix nightly MCP and optional notebook dependencies (#1598)

## Summary

Nightly installs MCP 2.x even though the example server uses its v1 API,
and sparse dependency configurations run tests without required optional
packages. Cap MCP at `>=1.27.2,<2`, report child-server startup failures
immediately with stderr, guard the mistune/spaCy-dependent tests, and
install spaCy in the primary transformers configuration.

Fix isolated notebook dependencies with torchvision for SAM3 and
`setuptools<82` for TensorFlow Hub's `pkg_resources` import. Skip
observability only in pip-install notebook mode; retain source-based
coverage using the workspace instrumentation package.

Clarify the public-API testing rule in AGENTS.md and GitHub agent
instructions. Claude inherits AGENTS.md. Internal access is limited to
focused internal unit tests or fixture setup unsupported by public APIs;
the instructions do not require explanatory comments. This guidance-only
follow-up passed diff checks; CI must rerun on the new head.

---------

Co-authored-by: Cursor <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `.github/instructions/tests.instructions.md` (modified, +1/-0)
```diff
@@ -7,6 +7,7 @@ applyTo: "tests/**"
 - A test using `uses_db` needs `@pytest.mark.db_roots('local', reason='...')`; `tests/conftest.py` raises a `UsageError` at collection without it. The reason names a PXT ticket, not a bare TODO. Delete the exclusion when the ticket lands.
 - Any test for `pxt.Error` or a subclass uses `pxt_raises()`, not `pytest.raises()`. Both always take `match=` to verify error text.
 - Assert on user-visible behavior through the public API, not `col.stored`, `ColumnRef`, or `TableVersion` internals. Use `Table.get_metadata()`, `t.describe()`, or queries.
+- Avoid using the internal API as much as possible. Only use it to test behaviors that are very difficult or impossible to reproduce using only the public API.
 - AI provider tests go in `tests/functions/test_<provider>.py`, marked `remote_api`. Anything hitting a third-party model or service also needs `very_expensive`.
 - Never dodge one backend with a bare `@pytest.mark.skip`. Scope it with `db_roots`. Register any new marker in `pyproject.toml`.
 - No `http://` or `https://` literals. Use the `sample_file_server` fixture, which serves the repo tree over localhost and still exercises the download path.
```

**File**: `.github/workflows/nightly.yml` (modified, +3/-2)
```diff
@@ -47,7 +47,8 @@ jobs:
         python-version: ["3.11", "3.13"]
         package-configs:
           - ""
-          - "lancedb pylance mcp opencv-python scenedetect"
+          # TODO(PXT-1452): drop the mcp<2 cap once pixeltable/func/mcp.py targets the MCP 2.x client API
+          - "lancedb pylance 'mcp>=1.27.2,<2' opencv-python scenedetect"
           - "anthropic fireworks-ai 'google-genai<1.72.0' groq jina mistralai openai replicate together"
           - "fal-client runwayml twelvelabs voyageai"
           - "huggingface-hub llama-cpp-python openai-whisper"
@@ -57,7 +58,7 @@ jobs:
         include:
           # transformers-based tests need to run on a larger runner.
           - python-version: "3.11"
-            package-configs: "pyarrow sentence-transformers sentencepiece soundfile 'torch<2.11' 'torchaudio<2.11' torchvision 'torchcodec<0.11' transformers timm"
+            package-configs: "pyarrow sentence-transformers sentencepiece soundfile 'torch<2.11' 'torchaudio<2.11' torchvision 'torchcodec<0.11' transformers timm spacy"
             os: ubuntu-large
           - python-version: "3.11"
             package-configs: "whisperx transformers timm"
```

**File**: `AGENTS.md` (modified, +5/-0)
```diff
@@ -111,6 +111,11 @@ make formatcheck  # ruff format --check
 
 ### Testing
 
+Exercise behavior through public SDK, CLI, or HTTP APIs and assert on public results, metadata, or errors:
+use `Table.get_metadata()`, `t.describe()`, or queries rather than `col.stored`, `ColumnRef`, or
+`TableVersion` internals. Avoid using the internal API as much as possible. Only use it to test behaviors that
+are very difficult or impossible to reproduce using only the public API.
+
 ```bash
 # Run pytest (excludes expensive/remote_api tests)
 make pytest
```

**File**: `docs/release/howto/cookbooks/images/img-promptable-segmentation.ipynb` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@
    "metadata": {},
    "outputs": [],
    "source": [
-    "%pip install -qU pixeltable torch transformers"
+    "%pip install -qU pixeltable torch torchvision transformers"
    ]
   },
   {
```

**File**: `docs/release/platform/embedding-indexes.ipynb` (modified, +1/-1)
```diff
@@ -811,7 +811,7 @@
    "metadata": {},
    "outputs": [],
    "source": [
-    "%pip install -qU tensorflow tensorflow-hub tensorflow-text"
+    "%pip install -qU tensorflow tensorflow-hub tensorflow-text 'setuptools<82'"
    ]
   },
   {
```

**File**: `pixeltable/functions/huggingface.py` (modified, +4/-2)
```diff
@@ -438,7 +438,7 @@ def sam3_for_segmentation(
 
     __Requirements:__
 
-    - `pip install torch transformers`
+    - `pip install torch torchvision transformers`
     - `facebook/sam3` is a gated repository. Request access on its
         [model page](https://huggingface.co/facebook/sam3), then authenticate with
         `huggingface-cli login` (or set the `HF_TOKEN` environment variable) before calling this UDF.
@@ -491,6 +491,7 @@ def sam3_for_segmentation(
         ... )
     """
     env.Env.get().require_package('torch')
+    env.Env.get().require_package('torchvision')
     env.Env.get().require_package('transformers')
     device = resolve_torch_device('auto')
     import torch
@@ -686,7 +687,7 @@ class sam3_for_video_segmentation(pxt.PxtIterator[Sam3VideoSegmentationFrame]):
 
     __Requirements:__
 
-    - `pip install torch transformers`
+    - `pip install torch torchvision transformers`
     - `facebook/sam3` is a gated repository. Request access on its
         [model page](https://huggingface.co/facebook/sam3), then authenticate with
         `huggingface-cli login` (or set the `HF_TOKEN` environment variable) before using this iterator.
@@ -768,6 +769,7 @@ def __init__(
         revision: str | None = None,
     ) -> None:
         env.Env.get().require_package('torch')
+        env.Env.get().require_package('torchvision')
         env.Env.get().require_package('transformers')
         from pixeltable.functions.video import frame_iterator
 
```

**File**: `pyproject.toml` (modified, +2/-1)
```diff
@@ -192,7 +192,8 @@ dev = [
     # "whisperx>=3.8.5 ; python_version < '3.14'",
     "ollama>=0.6",
     "llama-cpp-python>=0.3.18 ; sys_platform == 'linux'",
-    "mcp>=1.27.2",
+    # TODO(PXT-1452): drop the <2 cap once pixeltable/func/mcp.py targets the MCP 2.x client API
+    "mcp>=1.27.2,<2",
     "pixeltable-yolox==0.4.2 ; python_version < '3.13' or sys_platform != 'win32'",
     # fiftyone is commented out, because even the most recent versions hardcode a dependency on an insecure version
     # of at least one library. We can re-enable it once they update their dependencies.
```

**File**: `scripts/prepare-nb-tests.sh` (modified, +6/-0)
```diff
@@ -106,6 +106,12 @@ fi
 TARGET_DIR="$1"
 shift
 
+if [[ $DO_PIP_INSTALL == true ]]; then
+    # TODO(PXT-1427): the instrumentation package is available in the source checkout, but is not yet published
+    # on PyPI.
+    SKIP_NOTEBOOKS+=(observability)
+fi
+
 echo "Target path: $TARGET_DIR"
 echo "Notebook paths: $@"
 if [[ $DO_PIP_INSTALL == false ]]; then
```

---

### Incident Patch 13: `90bba6ef` (2026-09-21)
**Commit Message**: Docs: fix what executing every page's code found (#1647)

Docs only. Third documentation pass; the first to **execute the code in
the pages** rather than check that symbols exist.

---------

Co-authored-by: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `.github/copilot-instructions.md` (modified, +1/-1)
```diff
@@ -81,7 +81,7 @@ Roughly 18 of the last 100 PRs drew a maintainer comment about this. It outranks
 | `pixeltable/metadata/` | Migration tests + `tests/data/` + `tool/create_test_db_dump.py` |
 | `tests/data/dbdumps/*-info.toml` | Regenerate the matching `.dump.gz` in the same commit |
 | `pyproject.toml` (deps) | `uv.lock` |
-| The `app.py` example | Its copies in `README.md`, `AGENTS.md`, `docs/release/skill.md`, `quick-start.mdx`, `cloud.mdx` |
+| The `app.py` example | Its copies in `README.md`, `AGENTS.md`, `quick-start.mdx`, `cloud.mdx` |
 
 ## Current API (Citing a Stale One Wastes Review Time)
 
```

**File**: `.github/instructions/docs.instructions.md` (modified, +2/-2)
```diff
@@ -13,11 +13,11 @@ No CI job checks prose, so review is the only place these are caught.
 
 ## Notebooks
 
-- Exactly one title source: either a raw cell with YAML frontmatter, or a leading H1 that Quarto converts. Flag a notebook carrying both, which renders a double title. Do not flag a leading H1 on its own; 93 of 100 notebooks use one.
+- Exactly one title source: either a raw cell with YAML frontmatter, or a leading H1 that Quarto converts. Flag a notebook carrying both, which renders a double title. Do not flag a leading H1 on its own.
 - Code cells format at line length **74**, not the 120 that applies to `.py` files (`scripts/check-notebooks.sh`).
 - At least 50% of code cells must have outputs (`tool/check_notebooks.py`). Never advise clearing all outputs.
 - Markdown cells must be `nbqa mdformat` clean. Use `raw.githubusercontent.com`, never `raw.github.com`.
-- No badge images in markdown cells. Kaggle/Colab/download links belong in the frontmatter `description`.
+- No hand-written badges or open-in links in notebook cells or frontmatter. The docs build generates Kaggle, Colab, and download links from the notebook path.
 - Schema ops in examples must use `if_exists='ignore'` / `if_not_exists=True`.
 
 ## Accuracy traps
```

**File**: `AGENTS.md` (modified, +3/-3)
```diff
@@ -15,7 +15,7 @@ guide; `CLAUDE.md` imports it.
 | `docs/_guidelines/GUIDELINES_FOR_NOTEBOOKS.md` | Notebook structure and conversion | Touching `docs/release/**/*.ipynb` |
 | `docs/_guidelines/GUIDELINES_FOR_COOKBOOKS.md` | Cookbook recipe structure | Adding a recipe |
 | `dashboard/DESIGN.md`, `dashboard/ARCHITECTURE.md` | The local dashboard UI | Touching `dashboard/` or its server APIs |
-| `docs/release/skill.md` | The user-facing agent skill | Changing what app builders are told |
+| `docs/release/skill.md` | Pointer to the canonical skill in `pixeltable/pixeltable-skill` | Changing what app builders are told: edit the skill repo, not this file |
 | `CONTRIBUTING.md` | Branching, review, merge process | Opening or merging a PR |
 
 ## Protected Configuration
@@ -375,8 +375,8 @@ order on every sentence added or edited:
 
 Documentation notebooks are in `docs/release/`. Follow `docs/_guidelines/GUIDELINES_FOR_NOTEBOOKS.md`:
 
-- Start with YAML frontmatter in a **Raw cell** (not Markdown)
-- No H1 headers in markdown (title comes from frontmatter)
+- Use one title source: a leading markdown H1, or a first **Raw cell** with YAML `title`
+- Do not include an H1 when using a raw frontmatter title
 - Use `##` for main sections, `###` for subsections
 - Clear outputs before committing unless output is instructive
 - Use `raw.githubusercontent.com` for GitHub raw links
```

**File**: `docs/_guidelines/GUIDELINES_FOR_NOTEBOOKS.md` (modified, +50/-116)
```diff
@@ -6,96 +6,39 @@
 
 ## Overview
 
-These guidelines ensure that Jupyter notebooks convert properly to Mintlify MDX format using Quarto. The conversion process preserves YAML frontmatter and converts markdown/code cells to MDX.
+The docs build converts each notebook to a Mintlify page with Quarto. The page title comes from a
+leading H1 or a raw YAML frontmatter cell. The build adds Kaggle, Colab, and notebook download links;
+do not hand-write them in cells.
 
-## Required: YAML Frontmatter
+## Required: Title in the first cell
 
-Every notebook MUST start with a **raw cell** (not markdown) containing YAML frontmatter.
+Use one title source. By default, start with a **markdown** cell whose first line is the notebook's
+only H1. Quarto converts that H1 to the page title:
 
-### How to Add YAML Frontmatter in Jupyter
-
-1. Insert a new cell at the **very top** of the notebook
-2. Change cell type to **Raw** (not Markdown, not Code)
-   - In Jupyter: Cell → Cell Type → Raw
-   - In JupyterLab: Click cell type dropdown and select "Raw"
-3. Add the YAML frontmatter block
-
-### Exact Frontmatter Template
-
-**This is the exact format to use for every notebook.** Simply replace:
-- `Your Notebook Title` with your notebook's title
-- `path/to/your-notebook.ipynb` with the actual path (e.g., `use-cases/rag-operations.ipynb`)
-
-```yaml
----
-title: "Your Notebook Title"
-icon: "notebook"
-description: "[Open in Kaggle](https://kaggle.com/kernels/welcome?src=https://github.com/pixeltable/pixeltable/blob/release/docs/release/path/to/your-notebook.ipynb) | [Open in Colab](https://colab.research.google.com/github/pixeltable/pixeltable/blob/release/docs/release/path/to/your-notebook.ipynb) | [View on GitHub](https://github.com/pixeltable/pixeltable/blob/release/docs/release/path/to/your-notebook.ipynb)"
----
-```
-
-**Example for a notebook at `docs/release/howto/cookbooks/agents/pattern-rag-pipeline.ipynb`:**
-
-```yaml
----
-title: "RAG Operations"
-icon: "notebook"
-description: "[Open in Kaggle](https://kaggle.com/kernels/welcome?src=https://github.com/pixeltable/pixeltable/blob/release/docs/release/howto/cookbooks/agents/pattern-rag-pipeline.ipynb) | [Open in Colab](https://colab.research.google.com/github/pixeltable/pixeltable/blob/release/docs/release/howto/cookbooks/agents/pattern-rag-pipeline.ipynb) | [View on GitHub](https://github.com/pixeltable/pixeltable/blob/release/docs/release/howto/cookbooks/agents/pattern-rag-pipeline.ipynb)"
----
-```
-
-### Frontmatter Fields
-
-- **title**: The display title for the notebook page (required)
-  - Use title case (e.g., "Working with OpenAI")
-  - This becomes the H1 heading in the rendered documentation
-- **icon**: Always use `"notebook"` for consistency across all notebooks
-- **description**: Contains three links separated by ` | ` (space-pipe-space)
-  - **Kaggle link**: Opens notebook in Kaggle kernel
-  - **Colab link**: Opens notebook in Google Colab
-  - **GitHub link**: Views notebook source on GitHub
-  - All three links use the `release` branch for stability
-  - Path must be relative to `docs/release/` directory
-
-## Required: Remove H1 Headers from Markdown
-
-**Do NOT use H1 headers (`#`) in markdown cells.** The title comes from the YAML frontmatter.
-
-### ❌ Wrong
-```markdown
-# Pixeltable Basics
-
-Welcome to this tutorial...
-```
-
-### ✅ Correct
 ```markdown
-Welcome to this tutorial...
+# Build a RAG pipeline
 
-## Section Title
-
-Content here...
+Create a retrieval-augmented generation system that answers questions using your documents as context.
 ```
 
-### Header Hierarchy
+Use `##` for sections and `###` for subsections below it. Do not add a second `#` anywhere in the
+notebook.
 
-- **Frontmatter `title`**: Acts as the H1 (page title)
-- **`##` (H2)**: Main sections
-- **`###` (H3)**: Subsections
-- **`####` (H4)**: Sub-subsections
+Alternatively, start with a **raw** cell containing YAML frontmatter with a `title` field, enclosed
+by `---` lines. In that form, do not include an H1 in any markdown cell.
 
 ## Required: No Download or Badge Links
 
 **Do NOT include "Download Notebook" badges or similar HTML badge images in markdown cells.**
 
-These cause MDX parsing errors because HTML `<img>` tags with self-closing syntax are not compatible with MDX.
+The docs build generates these links. Hand-written badges duplicate them.
 
 ### ❌ Wrong
 ```html
 <a href="..."><img src="https://img.shields.io/badge/..." alt="Download Notebook"></a>
 ```
 
-The Kaggle/Colab/GitHub links should only appear in the frontmatter `description` field.
+Do not add these links to frontmatter `description` either. The build generates them from the notebook path.
 
 ## Required: Use Full GitHub URLs
 
@@ -181,69 +124,60 @@ from pixeltable.functions import openai
 Before committing, verify your notebook:
 
 1. **Run all cells** from a fresh kernel to ensure reproducibility
-2. **Check frontmatter** is in a Raw cell at the very top
-3. **Verify no H1 headers** (`#
```

**File**: `docs/release/howto/cookbooks/text/doc-ingest-website.mdx` (modified, +3/-1)
```diff
@@ -49,7 +49,9 @@ paragraphs produces chunks too small to carry context. `char_limit` gives you pr
 predictable embedding cost, and cuts mid-sentence.
 
 Valid separators are `heading`, `paragraph`, `sentence`, `token_limit`, `char_limit`, and `page`.
-Combine them with a comma, most structural first:
+`sentence` needs `spacy` and its default English model: run `pip install spacy`, then
+`python -m spacy download en_core_web_sm`. `token_limit` needs `pip install tiktoken`.
+Combine separators with a comma, most structural first:
 
 ```python
 iterator=document_splitter(sites.url, separators='heading,token_limit', limit=300)
```

**File**: `docs/release/overview/building-pixeltable-with-llms.mdx` (modified, +2/-2)
```diff
@@ -28,14 +28,14 @@ Works with tools that support [Agent Skills](https://agentskills.io/specificatio
     ```
   </Tab>
   <Tab title="Any LLM">
-    If your tool has no skill support, append `.md` to any docs URL and paste that markdown into the chat. Site index: [llms.txt](https://docs.pixeltable.com/llms.txt) ([standard](https://llmstxt.org/)). Capability summary: [skill.md](https://docs.pixeltable.com/skill.md).
+    If your tool has no skill support, append `.md` to any docs URL and paste that markdown into the chat. Site index: [llms.txt](https://docs.pixeltable.com/llms.txt) ([standard](https://llmstxt.org/)). The skill: [SKILL.md](https://raw.githubusercontent.com/pixeltable/pixeltable-skill/main/skills/pixeltable-skill/SKILL.md).
 
     | Resource | URL |
     |----------|-----|
     | This page as markdown | [building-pixeltable-with-llms.md](https://docs.pixeltable.com/overview/building-pixeltable-with-llms.md) |
     | Site index | [llms.txt](https://docs.pixeltable.com/llms.txt) |
     | Full map | [llms-full.txt](https://docs.pixeltable.com/llms-full.txt) |
-    | Capability summary | [skill.md](https://docs.pixeltable.com/skill.md) |
+    | The skill | [SKILL.md](https://raw.githubusercontent.com/pixeltable/pixeltable-skill/main/skills/pixeltable-skill/SKILL.md) |
   </Tab>
 </Tabs>
 
```

**File**: `docs/release/platform/cli.mdx` (modified, +3/-0)
```diff
@@ -650,6 +650,9 @@ is:
 
 ```python
 # notes_app.py
+import fastapi
+import pixeltable as pxt
+
 TableModel = pxt.model_base()
 
 class Notes(TableModel, name='notes'):
```

**File**: `docs/release/platform/iterators.mdx` (modified, +33/-5)
```diff
@@ -24,6 +24,16 @@ Iterators are particularly useful when:
 In an app file, set `iterator=` on the view's `TableModel`. In a notebook, pass `iterator=` to `pxt.create_view()`.
 </Note>
 
+<Note>
+The examples below use `sentence` and `token_limit`. Install `spacy` and `tiktoken`, then download
+spaCy's default English model:
+
+```bash
+pip install spacy tiktoken
+python -m spacy download en_core_web_sm
+```
+</Note>
+
 ```python
 import pixeltable as pxt
 import pixeltable.functions as pxtf
@@ -445,20 +455,38 @@ words_view = pxt.create_view(
 )
 ```
 
-Use `unstored_cols` to mark columns that should not be persisted:
+Use `unstored_cols` to mark columns that should not be persisted. An unstored column is recomputed
+when a row is read, so the iterator must be able to jump straight to that row: `unstored_cols`
+requires a `seek()` method, and only a class can supply one. A function-style `@pxt.iterator`
+cannot use `unstored_cols`.
+
+This skeleton shows the required methods, not a runnable frame extractor. Implement `__next__()`
+to return a `FrameRow`, advance the position, and raise `StopIteration` at the end. After `seek(pos)`,
+the next call to `__next__()` must return the row at `pos`. The cookbook below has a runnable example.
 
 ```python
-from typing import Iterator, TypedDict
+from typing import TypedDict
 import pixeltable as pxt
 
 class FrameRow(TypedDict):
     frame: pxt.Image
     timestamp: float
 
 @pxt.iterator(unstored_cols=['frame'])
-def my_frame_extractor(video: pxt.Video) -> Iterator[FrameRow]:
-    # Custom frame extraction logic
-    ...
+class my_frame_extractor(pxt.PxtIterator[FrameRow]):
+    def __init__(self, video: pxt.Video, *, fps: float = 1.0):
+        self.video = video
+        self.fps = fps
+        self.pos = 0
+
+    def __next__(self) -> FrameRow:
+        # Custom frame extraction logic; raise StopIteration when done
+        ...
+
+    # seek() receives the position of the row being read, plus the stored
+    # output columns of that row as keyword arguments.
+    def seek(self, pos: int, **kwargs) -> None:
+        self.pos = pos
 ```
 
 <Card title="Custom Iterators Cookbook" icon="code" href="/howto/cookbooks/core/custom-iterators">
```

---

### Incident Patch 14: `37d25178` (2026-09-20)
**Commit Message**: Cloud test suite improvements (#1644)

Refactors the way cloud/core, cloud/CLI, and cloud/serving databases are
configured:
- Removes `PXTTEST_*_DB_URI` env variables, replacing them with
hardcoded db paths `pxt://pixeltable:pxttest` and
`pxt://pixeltable:pxttest-cli`; only one value would work for those env
vars regardless
- Removes ad hoc logic for swapping in db URIs for different cloud test
suites, unifying db resolution logic under `DatabaseRoot`; the 'cloud'
root has been split into 'cloud', 'cloud-cli', and 'cloud-serving' (the
latter generating a disposable URI for temporary usage)
- 'cloud' requires the user to update the DB (though we could reconsider
this); 'cloud-cli' updates its DB automatically, but is persistent;
'cloud-serving' is disposable

Also introduces a new 'cloud-dev' dependency group in `pyproject.toml`,
which specifies a lightweight set of dev dependencies needed to run the
cloud tests. The goal is to have a way for the cloud tests to be 100%
green without having to deploy the heavyweight (torch, etc) dev
dependency group.

Various other minor improvements.

**File**: `Makefile` (modified, +1/-1)
```diff
@@ -159,7 +159,7 @@ pytest: install
 .PHONY: fullpytest
 fullpytest: install
 	@echo 'Running `pytest`, including expensive tests ...'
-	@$(ULIMIT_CMD) pytest $(PYTEST_COMMON_ARGS) -m 'not cloud_e2e' tests
+	@$(ULIMIT_CMD) pytest $(PYTEST_COMMON_ARGS) -m '' tests
 
 .PHONY: slimpytest
 slimpytest: install
```

**File**: `pyproject.toml` (modified, +11/-4)
```diff
@@ -191,7 +191,7 @@ dev = [
     # whisperx is disabled because it hard-pins torch 2.8 (four full versions behind at the time of this writing).
     # "whisperx>=3.8.5 ; python_version < '3.14'",
     "ollama>=0.6",
-    # "llama-cpp-python>=0.3.18 ; sys_platform == 'linux'",
+    "llama-cpp-python>=0.3.18 ; sys_platform == 'linux'",
     "mcp>=1.27.2",
     "pixeltable-yolox==0.4.2 ; python_version < '3.13' or sys_platform != 'win32'",
     # fiftyone is commented out, because even the most recent versions hardcode a dependency on an insecure version
@@ -236,6 +236,14 @@ cuda-dev = [
     # Dependencies that require CUDA.
     "vllm>=0.24"
 ]
+cloud-dev = [
+    # Minimal set of dev dependencies needed to run the [cloud*] tests. This is a subset of `dev`.
+    "mistune",
+    "markitdown[pptx,docx,xlsx] ; python_version < '3.14'",
+    "spacy ; python_version < '3.14'",
+    "en_core_web_sm @ https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl",
+    "datasets",
+]
 storage-sdks = [
     # Used for CI configurations that need only the storage SDKs (in addition to basic dependencies).
     "boto3==1.36.23",
@@ -315,7 +323,7 @@ memory_mb = 6144
 workers = 3
 cpu = 2.0
 disk_gb = 40
-uv_options = "--no-dev"
+uv_options = "--no-dev --group cloud-dev"
 
 [tool.pyright]
 typeCheckingMode = "off"
@@ -327,14 +335,13 @@ extraPaths = ["packages/opentelemetry-instrumentation-pixeltable/src"]
 # instrumentation), whose dependencies are absent in the --no-dev minimal config. Those packages run via their
 # own CI config (see tool/ci_tool.py). Explicit path args on the command line override testpaths as usual.
 testpaths = ["tests"]
-addopts = '-v -m "not remote_api and not expensive and not very_expensive and not benchmark and not otel and not cloud_e2e" --strict-markers'
+addopts = '-v -m "not remote_api and not expensive and not very_expensive and not benchmark and not otel" --strict-markers'
 markers = [
     "expensive: marks tests as expensive to run",
     "very_expensive: marks tests as very expensive to run, or as depending on an unreliable external service",
     "remote_api: marks tests as calling a remote API (such as OpenAI)",
     "benchmark: marks tests as benchmark tests (excluded from regular test runs)",
     "db_roots: test runs only against specified database roots, e.g. @pytest.mark.db_roots('local', reason='...')",
-    "cloud_e2e: marks tests as cloud end-to-end tests requiring PIXELTABLE_API_KEY",
     "otel: marks tests as requiring the otel extra (run on the otel CI leg)",
 ]
 filterwarnings = [
```

**File**: `tests/conftest.py` (modified, +37/-44)
```diff
@@ -10,7 +10,7 @@
 import threading
 import urllib.parse
 import uuid
-from typing import Callable, Iterator
+from typing import Callable, Iterator, get_args
 
 import pytest
 import requests
@@ -35,14 +35,18 @@
 from pixeltable.utils.sql import add_option_to_db_url
 
 from .utils import (
+    CLOUD_DB_ROOT_URIS,
     IN_CI,
     TESTS_DIR,
     DatabaseRoot,
+    DbRootId,
     ReloadTester,
+    cloud_env_configured,
     create_all_datatypes_tbl,
     create_img_tbl,
     create_test_tbl,
     local_embedding,
+    new_db_uri,
     reload_catalog,
     validate_async_teardown,
 )
@@ -319,24 +323,15 @@ def proxy_daemon_db(init_env: None, worker_id: str) -> Iterator[str]:
         proxy_daemon.stop(db)
 
 
-# tests here and tests in the CLI package run against separate hosted databases, so each package has its
-# own axis and its own variable
 _CLI_TESTS_DIR = pathlib.Path(__file__).parent / 'pixeltable_cli'
-_CORE_CLOUD_AXIS = ('cloud', 'PXTTEST_CLOUD_DB_URI')
-_CLI_CLOUD_AXIS = ('cloud-cli', 'PXTTEST_CLI_DB_URI')
-
-
-def _cloud_axis(test_file: pathlib.Path) -> tuple[str, str]:
-    """The cloud axis id for a test in test_file, and the variable that enables it."""
-    return _CLI_CLOUD_AXIS if test_file.is_relative_to(_CLI_TESTS_DIR) else _CORE_CLOUD_AXIS
 
 
 def pytest_generate_tests(metafunc: pytest.Metafunc) -> None:
     """Drive the catalog-backend and data-versioning axes.
 
-    db_root: any test that (transitively) reaches db_root runs against 'local', 'proxy', and the cloud axis
-    of the package it is in. A db_roots marker names that axis 'cloud' wherever the test lives, so it always
-    selects the database serving that test's project.
+    db_root: any test that (transitively) reaches db_root runs against 'local', 'proxy', and its package's
+    hosted database; a db_roots marker overrides that list. The hosted roots are dropped unless the three
+    PIXELTABLE_ variables are set.
 
     is_data_versioned: any test that (transitively) reaches is_data_versioned runs against both a
     data-versioned and an operational table.
@@ -352,10 +347,9 @@ def pytest_generate_tests(metafunc: pytest.Metafunc) -> None:
         db_roots_marker = metafunc.definition.get_closest_marker('db_roots')
         if db_roots_marker is not None:
             params = db_roots_marker.args
-            if not set(params) <= {'local', 'proxy', 'cloud'}:
+            if not set(params) <= set(get_args(DbRootId)):
                 raise pytest.UsageError(
-                    'Invalid db_roots marker args. Must be a nonempty subset of'
-                    f"('local', 'proxy', 'cloud'); got: {params!r}"
+                    f'Invalid db_roots marker args. Must be a nonempty subset of {get_args(DbRootId)}; got: {params!r}'
                 )
             if (
                 not isinstance(db_roots_marker.kwargs.get('reason'), str)
@@ -364,15 +358,14 @@ def pytest_generate_tests(metafunc: pytest.Metafunc) -> None:
                 raise pytest.UsageError("db_roots marker must include a nonempty 'reason' kwarg")
 
         else:
-            params = ('local', 'proxy', 'cloud')  # Default is all three targets
+            # each package's udfs live in a different project, so an unmarked test gets its own
+            # package's database
+            in_cli_package = metafunc.definition.path.is_relative_to(_CLI_TESTS_DIR)
+            params = ('local', 'proxy', 'cloud-cli' if in_cli_package else 'cloud')
 
-        cloud_axis, cloud_db_var = _cloud_axis(metafunc.definition.path)
-        if os.environ.get(cloud_db_var) is None:
-            # If the db URI is not set, skip generating any cloud tests. We short-circuit them here rather
-            # than later via pytest.skip(), for performance reasons.
-            params = tuple(p for p in params if p != 'cloud')
-        else:
-            params = tuple(cloud_axis if p == 'cloud' else p for p in params)
+        if not cloud_env_configured():
+            # We short-circuit here rather than later via pytest.skip(), for performance reasons.
+            params = tuple(p for p in params if not p.startswith('cloud'))
 
         if params != ('local',):
             # If the only target is 'local', then don't parameterize at all; just leave the nodeid alone.
@@ -388,15 +381,9 @@ def served_project() -> pathlib.Path | None:
 
 
 @pytest.fixture(scope='session')
-def cloud_db_uri() -> str:
-    """The hosted database for the cloud axis, serving this repository as its project.
-
-    A module whose tests must not alter it -- one that builds a database's image, say, which replaces what
-    that database runs -- overrides this with a database of its own.
-    """
-    uri = os.environ.get('PXTTEST_CLOUD_DB_URI')
-    assert uri, 'set PXTTEST_CLOUD_DB_URI to the database for these tests'
-    return uri
+def cloud_serving_db_uri() -> str:
+    """A disposable URI for the 'cloud-serving' tests in pixeltable_cli."""
+    return new_db_uri()
 
 
 @pytest.fixture(scope='fun
```

**File**: `tests/io/test_lancedb.py` (modified, +2/-0)
```diff
@@ -6,6 +6,7 @@
 import numpy as np
 import pandas as pd
 import PIL.Image
+import pytest
 
 import pixeltable as pxt
 
@@ -19,6 +20,7 @@ def udf_with_exc(i: int, val: int) -> int:
     return i
 
 
+@pytest.mark.db_roots('local', 'proxy', reason='lancedb dependencies are not installed on cloud tests')
 class TestLanceDb:
     def test_export(self, db_root: DatabaseRoot, tmp_path: Path) -> None:
         skip_test_if_not_installed('lance', 'lancedb')
```

**File**: `tests/pixeltable_cli/conftest.py` (modified, +30/-21)
```diff
@@ -16,7 +16,6 @@
 import subprocess
 import sys
 import time
-import uuid
 from dataclasses import dataclass
 from typing import Any, Callable, Iterator
 
@@ -25,7 +24,7 @@
 from pixeltable.config import Config
 from pixeltable_cli.client.utils import is_running
 
-from ..utils import DatabaseRoot
+from ..utils import CLOUD_DB_ROOT_URIS, DatabaseRoot, cloud_env_configured
 
 _REPO_ROOT = pathlib.Path(__file__).parents[2]
 _CORPUS_DIR = pathlib.Path(__file__).parent
@@ -279,8 +278,8 @@ def read_logs_until(
 
 
 @contextlib.contextmanager
-def disposable_db_uri(cli: PxtRunner, cwd: pathlib.Path) -> Iterator[str]:
-    uri = f'pxt://pixeltable:pxttest-{uuid.uuid4().hex[:12]}'
+def disposable_db(cli: PxtRunner, uri: str, cwd: pathlib.Path) -> Iterator[str]:
+    """Delete the database at uri when the caller finishes, even if none was ever created."""
     try:
         yield uri
     finally:
@@ -302,18 +301,25 @@ def write_requirements(project: pathlib.Path, wheel: pathlib.Path, *extra: str)
 
 
 @pytest.fixture(scope='session')
-def cloud_db_uri() -> str:
-    """The hosted database for this package's cloud axis, serving the app corpus as its project.
-
-    The core suite's database serves this repository instead, so its pods import `tests.*` where these
-    import `apps.*`; one database cannot hold both projects, so each suite has its own.
+def cloud_service_db(
+    cloud_serving_db_uri: str, session_cli: PxtRunner, session_project: pathlib.Path, pixeltable_wheel: pathlib.Path
+) -> Iterator[str]:
+    """Create the 'cloud-serving' database, serving this session's project.
+
+    test_service.py deploys that project's application files as services and edits them as it goes, and a
+    pod sees an edit only through the database's archive, which `pxt db update` replaces. So this root gets
+    its own database instead of the corpus database. Creating one runs CodeBuild, hence the session scope.
     """
-    uri = os.environ.get('PXTTEST_CLI_DB_URI')
-    assert uri, 'set PXTTEST_CLI_DB_URI to the database for the CLI tests'
-    assert uri != os.environ.get('PXTTEST_CLOUD_DB_URI'), (
-        f'PXTTEST_CLI_DB_URI and PXTTEST_CLOUD_DB_URI cannot share the same value (currently {uri})'
-    )
-    return uri
+    copy_app_corpus(session_project)
+    write_requirements(session_project, pixeltable_wheel, *PROJECT_EXTRAS)
+    with disposable_db(session_cli, cloud_serving_db_uri, session_project) as uri:
+        (session_project / 'pixeltable.toml').write_text(
+            f'[[pixeltable.database]]\nname = {json.dumps(uri)}\n', encoding='utf-8'
+        )
+        # the daemon read the project config when it started
+        session_cli('daemon', 'restart', cwd=session_project)
+        session_cli('db', 'update', uri, '-f', cwd=session_project, timeout=BUILD_TIMEOUT)
+        yield uri
 
 
 def _git(*args: str) -> str:
@@ -326,7 +332,10 @@ def _pixeltable_repo(sha: str) -> str:
     # '->' skips the symbolic origin/HEAD, which is a second name for a branch already listed
     branches = [line.strip() for line in _git('branch', '-r', '--contains', sha).splitlines() if '->' not in line]
     remotes = list(dict.fromkeys(branch.split('/', maxsplit=1)[0] for branch in branches))
-    assert len(remotes) > 0, f'{sha[:8]} is on no remote branch, and the image build fetches it; push first'
+    assert len(remotes) > 0, (
+        f'commit {sha[:8]} is on no remote branch, and the image build fetches it from GitHub; '
+        'run `git push origin HEAD` and try again'
+    )
     url = _git('remote', 'get-url', 'origin' if 'origin' in remotes else remotes[0])
     return re.sub(r'^git@([^:]+):', r'https://\1/', url).removesuffix('.git')
 
@@ -339,9 +348,9 @@ def corpus_pixeltable_pin() -> str | None:
     test rather than the last release. The image build runs in CodeBuild, which reaches GitHub but not this
     machine, so the pin is a commit on a remote rather than a path here.
 
-    Returns None when no hosted database is configured, since only an image build reads this file.
+    Returns None when the cloud environment is unconfigured, since only an image build reads this file.
     """
-    if os.environ.get('PXTTEST_CLI_DB_URI') is None:
+    if not cloud_env_configured():
         return None
     # an untracked file sits outside the corpus project and is absent from the archive, so it is not drift
     modified = _git('status', '--porcelain', '--untracked-files=no', '--', *_PINNED_PATHS)
@@ -360,9 +369,9 @@ def _serve_corpus_db(session_cli: PxtRunner, corpus_pixeltable_pin: str | None)
     pod runs the pixeltable that corpus_pixeltable_pin wrote into requirements.txt. Publishing both is part
     of the run.
     """
-    uri = os.environ.get('PXTTEST_CLI_DB_URI')
-    if uri is None:
+    if not cloud_env_configured():
         return
+    uri = CLOUD_DB_ROOT_URIS['cloud-cli']
     pending = _corpus_db_ops(session_cli, uri)
     if len(pending) == 0:
         return
@@ -505,7 +514,7 @@ def _run(
 
 @py
```

**File**: `tests/pixeltable_cli/hosted.py` (modified, +2/-0)
```diff
@@ -12,6 +12,7 @@
 
 import pytest
 
+from ..utils import skip_test_if_no_config
 from .conftest import (
     EXIT_CHANGES_PENDING,
     EXIT_IN_AGREEMENT,
@@ -42,6 +43,7 @@ def project(tmp_path: pathlib.Path, pixeltable_wheel: pathlib.Path) -> pathlib.P
 @pytest.fixture
 def current_db(cli: PxtRunner, project: pathlib.Path, hosted_db: str) -> str:
     """A hosted database holding this project: where most scenarios start."""
+    skip_test_if_no_config('api_key')
     create_project_config(cli, project, hosted_db)
     db_update(cli, project, hosted_db)
     assert_in_agreement(cli, project, hosted_db)
```

**File**: `tests/pixeltable_cli/pixeltable.toml` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 # and resolve the CLI tests' udfs. The core suite's database serves the repository, and its entry
 # is in pyproject.toml.
 [[pixeltable.database]]
-name = "pxt://pixeltable:pxtclitest"
+name = "pxt://pixeltable:pxttest-cli"
 # a pod imports apps.* and nothing else here; without this, editing a test would drift the archive
 # and force a redeploy before the suite could run
 exclude = ["/*.py"]  # anchored: in git wildmatch syntax a bare *.py would take apps/ too
```

**File**: `tests/pixeltable_cli/test_db.py` (modified, +3/-3)
```diff
@@ -15,7 +15,7 @@
 import pytest
 
 from pixeltable.service import proxy_daemon
-from tests.utils import DatabaseRoot, skip_test_if_no_config
+from tests.utils import DatabaseRoot, new_db_uri, skip_test_if_no_config
 
 from .conftest import (
     APPLY_TIMEOUT,
@@ -26,7 +26,7 @@
     assert_in_agreement,
     db_diff,
     db_update,
-    disposable_db_uri,
+    disposable_db,
     read_logs_until,
 )
 from .hosted import APP_FILE, create_project_config, edit_app, project
@@ -60,7 +60,7 @@ def test_db_uri(session_cli: PxtRunner, session_project: pathlib.Path) -> Iterat
     Module-scoped, unlike the per-test fixture on main: creating a database runs CodeBuild, and the tests
     here only need one to publish to in turn, which costs an archive upload each.
     """
-    with disposable_db_uri(session_cli, session_project) as uri:
+    with disposable_db(session_cli, new_db_uri(), session_project) as uri:
         yield uri
 
 
```

---

### Incident Patch 15: `3d6abe4c` (2026-09-17)
**Commit Message**: Add missing require_package() guard for sentence-transformers (#1643)

**File**: `pixeltable/functions/huggingface.py` (modified, +1/-0)
```diff
@@ -74,6 +74,7 @@ def sentence_transformer(
 
 @sentence_transformer.conditional_return_type
 def _(model_id: str) -> ts.ArrayType:
+    env.Env.get().require_package('sentence_transformers', min_version=[5, 4])
     from sentence_transformers import SentenceTransformer
 
     model = _lookup_model(model_id, SentenceTransformer)
```

#### Recent Merged Pull Requests:
- **PR #1707** (2026-10-06): pxt db update: print the pending plan once on non-tty refusal (@pierrebrunelle)
- **PR #1706** (2026-10-04): Describe the hosted Cloud MCP's operations (@pierrebrunelle)
- **PR #1705** (2026-10-06): [PXT-1438] new pxt secret list: final protocol cleanup (@sergey-mkhitaryan)
- **PR #1704** (2026-10-05): pxt whoami: flush stdout before printing a credential rejection (@pierrebrunelle)
- **PR #1700** (closed): Run the hosted test database on one worker (@pierrebrunelle)
- **PR #1698** (2026-10-02): Fix pxtfs:// store building a boto3 session for nearly every media read (@aaron-siegel)
- **PR #1697** (2026-10-02): Tell users how to recover from a proxy protocol mismatch (@pierrebrunelle)
- **PR #1695** (2026-09-30): pxt login scopes the session to the user's only organization (@pierrebrunelle)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
