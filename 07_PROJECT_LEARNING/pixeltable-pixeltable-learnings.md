> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/pixeltable-pixeltable-learnings.md`  
> **Source**: github ([https://github.com/pixeltable/pixeltable](https://github.com/pixeltable/pixeltable))  
> **Source Version**: `10f23bdb`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-18T23:45:35.524Z  
> **Learning ID**: `learn-github-pixeltable-pixeltable`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): pixeltable/pixeltable

> **Canonical Artifact**: `07_PROJECT_LEARNING/pixeltable-pixeltable-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pixeltable/pixeltable](https://github.com/pixeltable/pixeltable))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-18T23:45:35.085Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pixeltable/pixeltable`
- **Description**: The backend agents build with - Multimodal database, orchestration, and serving in one file
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 1640 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1787** (2026-10-18): **Comment out the claude-review erosion job for now**
  *Symptoms*: ## Summary  - Comments out the `erosion` job in `.github/workflows/claude-review.yml` so it no longer runs on `workflow_run`; the job text is preserved as comments for easy restore. - The `plan` and `review` jobs and all `on:` triggers are unchanged. - Companion to https://github.com/pixeltable/pixeltable-cloud/pull/460  #### Test plan  - [x] `yaml.safe_load` parses the file; `jobs` = `plan`, `review` only  Generated with [Devin](https://devin.ai)

- **Issue #1775** (2026-10-16): **PXT-1574: honor alter_column nullability on cloud tables without catalog reload**
  *Symptoms*: <!-- CURSOR_AGENT_PR_BODY_BEGIN --> ## Summary  `alter_column` persists the widened type and bumps the table version, but `insert` checks row nullability against the calling runtime's cached schema before it opens the write transaction. A cache hit outside a transaction does not reload that schema. On the cloud daemon, requests hop threads (and workers), so the inserting runtime can still hold the pre-alter non-nullable column after the client has already refreshed from the metadata `alter_column` returned. `insert(c1=None)` then fails with `expected non-None value` until some later write happens to drop that cache. Reloading the client catalog does not clear the server cache.  Drop the cached schema immediately before the insert row checks, so the next read reloads when the stored version has changed. This covers both data-versioned and operational tables.  ## Tests  - New `test_alter_column_visible_to_other_runtime` (local, both versioning modes). A failed null insert leaves the non-nullable schema cached; another runtime then widens the column; the next null insert must succeed. Before the fix this failed with the cloud error `Error in column c1: expected non-None value`. - `tests/test_alter_column.py`: 26 passed, 24 skipped (proxy and cloud parametrizations; this environment has no serve extra and no cloud credentials). - `ruff format` / `ruff check` (including isort) on the two changed files. `mypy` on `pixeltable/catalog/insertable_table.py` is clean. Full `make check` 

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

### Incident Patch 1: `a643fbb7` (2026-10-16)
**Commit Message**: Fix two random-ops stress test failures: shared tmp dir and drop_column race (#1764)

Fixes two of the causes behind the intermittent failures of the nightly
`stress-tests` workflow, plus a logging bug in the random-ops test
script. In the 30 days up to 2026-10-13, 11 of 29 runs failed.

## Startup deleted other processes' tmp files (`random-ops
(--read-only)`, 4 failures)

`Env` setup called `clear_tmp_dir()`, which deleted everything in
`<home>/tmp`. Every process using that home shares that directory. When
the 12 random-ops workers start together, a worker that starts late
deletes an image Worker 0 has just written for an insert, and the insert
fails with `FileNotFoundError` in `ObjectStoreSaveNode`. All four
failures happened within a second of startup. Outside the tests, the
same thing can happen to any two processes that share a home, such as a
notebook and a server, or a daemon started next to a script.

- `TempStore` writes new files to `<home>/tmp/<pid>`.
- At startup, `Env.clear_tmp_dir()` removes only the entries that don't
belong to a live pid. That includes files left at the top level by the
old layout. The cleanup lists the directory before it reads the live
pids, so 

**File**: `pixeltable/env.py` (modified, +21/-9)
```diff
@@ -2,7 +2,6 @@
 
 import contextlib
 import datetime
-import glob
 import http.server
 import importlib
 import importlib.metadata
@@ -25,6 +24,7 @@
 from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
 
 import pixeltable_pgserver
+import psutil
 import sqlalchemy as sql
 import tzlocal
 from pillow_heif import register_heif_opener  # type: ignore[import-untyped]
@@ -123,7 +123,7 @@ class Env:
     _file_cache_dir: Path | None  # cached object files with external URL
     _dataset_cache_dir: Path | None  # cached datasets (eg, pytorch or COCO)
     _log_dir: Path | None  # log files
-    _tmp_dir: Path | None  # any tmp files
+    _tmp_dir: Path | None  # any tmp files, in one TempStore directory per process
     _services_dir: Path | None  # registry of local services
     _sa_engine: sql.engine.base.Engine | None
     _pgdata_dir: Path | None
@@ -997,13 +997,25 @@ def require_package(
                 )
 
     def clear_tmp_dir(self) -> None:
-        for path in glob.glob(f'{self._tmp_dir}/*'):
-            # another process sharing this home can remove an entry between the glob and the delete
-            if os.path.isdir(path):
-                shutil.rmtree(path, ignore_errors=True)
-            else:
-                with contextlib.suppress(FileNotFoundError):
-                    os.remove(path)
+        """Remove the tmp files of processes that have exited.
+
+        Processes that share this home each write to their own TempStore directory, named after the pid; the
+        directory of a live process stays. A reused pid keeps a stale directory until that process exits too.
+        """
+        # list the entries before the pids: a directory created after the listing is not considered, and one created
+        # before it belongs to a process that is in the pid list
+        paths = list(self._tmp_dir.iterdir())
+        live_pids = {str(pid) for pid in psutil.pids()}
+        for path in paths:
+            if path.name in live_pids:
+                continue
+            # best effort, per entry: another process sharing this home can remove an entry between the listing and the
+            # delete, or (on Windows) hold a file open; what remains is removed by a later startup
+            with contextlib.suppress(OSError):
+                if path.is_dir():
+                    shutil.rmtree(path, ignore_errors=True)
+                else:
+                    path.unlink()
 
     # def get_resource_pool_info(self, pool_id: str, pool_info_cls: Type[T] | None) -> T:
     def get_resource_pool_info(self, pool_id: str, make_pool_info: Callable[[], T] | None = None) -> T:
```

**File**: `pixeltable/utils/local_store.py` (modified, +11/-6)
```diff
@@ -272,22 +272,25 @@ class TempStore:
     A temporary store for files of data that are not yet persisted to their destination(s).
     A destination is typically either a LocalStore (local persisted files) or a cloud object store.
 
-    It provides functionality to manage temporary files in the env.Env.get().tmp_dir directory.
+    It provides functionality to manage temporary files in this process's subdirectory of env.Env.get().tmp_dir.
     It reuses some of the LocalStore functionality to create unique file names and save objects.
     """
 
     @classmethod
     def _tmp_dir(cls) -> Path:
-        """Returns the path to the temporary directory where files are stored."""
-        return env.Env.get().tmp_dir
+        """Returns the path to the temporary directory where files are stored.
+
+        Each process that shares a Pixeltable home has its own directory.
+        """
+        return env.Env.get().tmp_dir / str(os.getpid())
 
     @classmethod
     def count(cls, tbl_id: UUID | None = None, tbl_version: int | None = None) -> int:
         return LocalStore(cls._tmp_dir()).count(tbl_id, tbl_version)
 
     @classmethod
-    def contains_path(cls, file_path: Path) -> bool:
-        return LocalStore(cls._tmp_dir()).contains_path(file_path)
+    def contains_path(cls, file_path: Path | str) -> bool:
+        return Path(file_path).is_relative_to(env.Env.get().tmp_dir)
 
     @classmethod
     def resolve_url(cls, file_url: str | None) -> Path | None:
@@ -317,7 +320,9 @@ def create_path(cls, tbl_id: UUID | None = None, extension: str | None = None) -
             extension = ''
         if tbl_id is not None:
             return LocalStore(cls._tmp_dir())._prepare_path_raw(tbl_id, 0, 0, extension)
-        return cls._tmp_dir() / f'{uuid.uuid4()}{extension}'
+        tmp_dir = cls._tmp_dir()
+        tmp_dir.mkdir(exist_ok=True)
+        return tmp_dir / f'{uuid.uuid4()}{extension}'
 
     @classmethod
     def clear(cls) -> None:
```

**File**: `tests/test_env.py` (modified, +36/-0)
```diff
@@ -1,9 +1,13 @@
 import asyncio
 import os
+import subprocess
+import sys
+import uuid
 from pathlib import Path
 from typing import Iterator
 
 import numpy as np
+import PIL.Image
 import pytest
 
 import pixeltable as pxt
@@ -12,6 +16,7 @@
 from pixeltable.env import Env
 from pixeltable.runtime import get_runtime, reset_runtime
 from pixeltable.utils.filecache import FileCache
+from pixeltable.utils.local_store import LocalStore, TempStore
 
 from .utils import pxt_raises, skip_test_if_not_local
 
@@ -170,6 +175,37 @@ def test_metadata_persistence(self, uses_db: None) -> None:
         assert result[0]['amount_doubled'] == 300.0
 
 
+class TestTmpDir:
+    def test_shared_home(self, uses_db: None) -> None:
+        """A process that starts on a shared home removes only the tmp files of processes that have exited."""
+        tmp_dir = Env.get().tmp_dir
+        in_use = TempStore.create_path(extension='.txt')
+        in_use.write_text('in use')
+        # no process can have this pid: it is above the Linux and macOS limits, and Windows pids are multiples of 4.
+        # (An exited child's pid won't do: on Windows, its process stays listed while a Popen holds its handle.)
+        stale = tmp_dir / str(2**31 - 1) / 'stale.txt'
+        stale.parent.mkdir()
+        stale.write_text('stale')
+        legacy = tmp_dir / f'{uuid.uuid4()}.txt'  # the layout before per-process directories
+        legacy.write_text('legacy')
+
+        subprocess.run((sys.executable, '-c', 'import pixeltable as pxt\npxt.init()'), check=True)
+
+        assert in_use.read_text() == 'in use'
+        assert not stale.parent.exists()
+        assert not legacy.exists()
+
+    def test_insert_other_process_tmp_file(self, uses_db: None) -> None:
+        """A tmp file that another process wrote is persisted to the media dir, not stored by reference."""
+        src = Env.get().tmp_dir / str(2**31 - 1) / 'img.png'
+        src.parent.mkdir()
+        PIL.Image.new('RGB', (8, 8)).save(src)
+        t = pxt.create_table('tmp_files', {'img': pxt.Image})
+        t.insert([{'img': str(src)}])
+        path = LocalStore.file_url_to_path(t.select(url=t.img.fileurl).collect()[0]['url'])
+        assert path is not None and path.is_relative_to(Env.get().media_dir), path
+
+
 class TestHostedMediaDefault:
     def test_home_bucket_default(self, uses_db: None, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
         """On a hosted db's pod, media that has no configured destination goes to the db's home bucket."""
```

**File**: `tests/utils.py` (modified, +10/-2)
```diff
@@ -1283,6 +1283,14 @@ def fetch_presigned(url: str, expires_s: int, host_suffix: str) -> bytes:
     return resp.content
 
 
+def _proxy_temp_store_count(db: str) -> int:
+    """Count the objects in the proxy daemon's temp store, which is a per-process directory under its tmp dir."""
+    tmp_dir = proxy_daemon.proxy_home(db) / 'tmp'
+    if not tmp_dir.is_dir():
+        return 0
+    return sum(LocalStore(path).count(None) for path in tmp_dir.iterdir() if path.is_dir())
+
+
 def get_temp_store_count(tbl: pxt.Table, db_root: DatabaseRoot) -> int:
     """Count the objects in the temp store of the catalog tbl lives in."""
     if db_root.is_cloud:
@@ -1292,7 +1300,7 @@ def get_temp_store_count(tbl: pxt.Table, db_root: DatabaseRoot) -> int:
     if catalog_uri.db is None:
         return TempStore.count()
     else:
-        return LocalStore(proxy_daemon.proxy_home(catalog_uri.db) / 'tmp').count(None)
+        return _proxy_temp_store_count(catalog_uri.db)
 
 
 def check_temp_store_count(tbl: pxt.Table, expected_count: int, db_root: DatabaseRoot) -> None:
@@ -1306,7 +1314,7 @@ def check_temp_store_count(tbl: pxt.Table, expected_count: int, db_root: Databas
     if catalog_uri.db is None:
         actual = TempStore.count()
     else:
-        actual = LocalStore(proxy_daemon.proxy_home(catalog_uri.db) / 'tmp').count(None)
+        actual = _proxy_temp_store_count(catalog_uri.db)
 
     assert actual == expected_count, f'expected {expected_count} temp objects, found {actual}'
 
```

**File**: `tool/random_ops.py` (modified, +5/-2)
```diff
@@ -45,6 +45,7 @@ def success(msg: str) -> OpResult:
     re.compile(r'Column was dropped'),
     re.compile(r"Cannot use if_exists=.+ with the same name as one of the view's own ancestors"),
     re.compile(r'Cannot alter column .+ because the following columns depend on it.+'),
+    re.compile(r'Cannot drop base table column .+'),
 )
 
 
@@ -413,13 +414,15 @@ def drop_view(self) -> OpResult:
         t = self.get_random_tbl(allow_base_tbl=False)
         if t is None:
             return success('No views to drop.')
+        descr = self.tbl_descr(t)  # a dropped handle can't describe itself
         pxt.drop_table(t, force=True, if_not_exists='ignore')
-        return success(f'Dropped view {self.tbl_descr(t)}.')
+        return success(f'Dropped view {descr}.')
 
     def drop_table(self) -> OpResult:
         t = self.get_random_tbl(allow_view=False)
+        descr = self.tbl_descr(t)  # a dropped handle can't describe itself
         pxt.drop_table(t, force=True, if_not_exists='ignore')
-        return success(f'Dropped table {self.tbl_descr(t)}.')
+        return success(f'Dropped table {descr}.')
 
     def alter_column_nullable(self) -> OpResult:
         t = self.get_random_tbl(allow_view=False)
```

---

### Incident Patch 2: `a64e89fb` (2026-10-15)
**Commit Message**: Fix nightly failures: empty scenes from scenedetect 0.7.2, unclosed Replicate HTTP clients (#1766)

## Summary

Fixes two of the failures in the [2026-10-14 nightly
run](https://github.com/pixeltable/pixeltable/actions/runs/38501778777).

### `test_video.py::TestVideo::test_scene_detect`: zero-duration scenes
with scenedetect 0.7.2

scenedetect 0.7.2 (released 2026-10-12; the nightly installs it
unpinned, while `uv.lock` still pins 0.6.7.1) fixed
`ThresholdDetector`'s initial state for `method=CEILING`. A video whose
first frame is brighter than the threshold now starts out "faded out".
With `add_final_scene=True`, `post_process()` then reports a cut at that
first frame. `_scene_detect()` closed the current scene at every cut, so
this cut produced a scene with `duration` 0.0. The test's
`scene_detect_threshold(threshold=12.0, add_final_scene=True,
method='ceiling')` case returned one for every test video.

`process_cuts()` now skips a cut that lands on the current scene's first
frame, and `frame_info[0]` is always that frame. For the case above, the
result is the whole video as one scene, which matches the docstring:
"Returns the full duration of the video if no scenes are detected

**File**: `pixeltable/functions/replicate.py` (modified, +13/-1)
```diff
@@ -20,7 +20,19 @@
 def _(api_token: str) -> 'replicate.Client':
     import replicate
 
-    return replicate.Client(api_token=api_token)
+    class _ClosableClient(replicate.Client):
+        """A `replicate.Client` with the `close()` that the runtime calls on its clients and replicate lacks."""
+
+        async def close(self) -> None:
+            # replicate.Client opens its HTTP clients lazily and keeps them in name-mangled attributes
+            sync_client = getattr(self, '_Client__client', None)
+            if sync_client is not None:
+                sync_client.close()
+            async_client = getattr(self, '_Client__async_client', None)
+            if async_client is not None:
+                await async_client.aclose()
+
+    return _ClosableClient(api_token=api_token)
 
 
 def _replicate_client() -> 'replicate.Client':
```

**File**: `pixeltable/functions/video/scene_detect.py` (modified, +7/-2)
```diff
@@ -502,7 +502,8 @@ def _scene_detect(video: str, fps: float, detector: 'SceneDetector') -> list[Sce
         start_pts: int | None = None  # of current scene
 
         # in order to determine the cut frame times, we need to record frame times (chronologically) and look them
-        # up by index; trying to derive frame times from frame indices isn't possible due to variable frame rates
+        # up by index; trying to derive frame times from frame indices isn't possible due to variable frame rates;
+        # frame_info[0] is the first frame of the current scene
         frame_info: list[_SceneDetectFrameInfo] = []
 
         def process_cuts(cuts: list[FrameTimecode]) -> None:
@@ -513,13 +514,17 @@ def process_cuts(cuts: list[FrameTimecode]) -> None:
                 assert cut_frame_idx >= frame_info[0].frame_idx
                 info_offset = next((i for i, info in enumerate(frame_info) if info.frame_idx == cut_frame_idx), None)
                 assert info_offset is not None  # the cut is at a previously reported frame idx
+                if info_offset == 0:
+                    # a cut at the scene's first frame would end an empty scene (scenedetect >= 0.7.2 reports one for a
+                    # video that starts faded out)
+                    continue
                 info = frame_info[info_offset]
                 scenes.append(
                     {'start_time': start_time, 'start_pts': start_pts, 'duration': info.frame_time - start_time}
                 )
                 start_time = info.frame_time
                 start_pts = info.frame_pts
-                frame_info = frame_info[info_offset + 1 :]
+                frame_info = frame_info[info_offset:]
 
         for item in frame_iter:
             if start_time is None:
```

**File**: `tests/functions/test_replicate.py` (modified, +11/-0)
```diff
@@ -2,12 +2,23 @@
 import pytest
 
 import pixeltable as pxt
+from pixeltable.runtime import get_runtime, reset_runtime
 
 from ..utils import rerun_on_network_error, skip_test_if_no_client, skip_test_if_not_installed, validate_update_status
 
 pytestmark = pytest.mark.db_roots('local', reason='UDF/integration test')
 
 
+class TestReplicateLocal:
+    def test_client_closed_on_reset(self, init_env: None, monkeypatch: pytest.MonkeyPatch) -> None:
+        skip_test_if_not_installed('replicate')
+        monkeypatch.setenv('REPLICATE_API_TOKEN', 'test-token')
+        client = get_runtime().get_client('replicate')
+        http_clients = [client._client, client._async_client]
+        reset_runtime()
+        assert all(c.is_closed for c in http_clients)
+
+
 @pytest.mark.remote_api
 @pytest.mark.very_expensive
 @rerun_on_network_error()
```

**File**: `tests/test_video.py` (modified, +37/-0)
```diff
@@ -1874,6 +1874,43 @@ def test_scene_detect(self, uses_db: None) -> None:
         )
         _ = v.collect()
 
+    def test_scene_detect_cut_at_scene_start(self, init_env: None) -> None:
+        skip_test_if_not_installed('scenedetect')
+        from pixeltable.functions.video.scene_detect import _scene_detect
+
+        class StubDetector:
+            """Reports cuts at given positions in the sequence of sampled frames."""
+
+            frame_cuts: set[int]  # positions at which process_frame() reports a cut at the current frame
+            final_cuts: list[int]  # positions of the cuts that post_process() reports
+            timecodes: list[Any]
+
+            def __init__(self, frame_cuts: set[int], final_cuts: list[int]) -> None:
+                self.frame_cuts = frame_cuts
+                self.final_cuts = final_cuts
+                self.timecodes = []
+
+            def process_frame(self, timecode: Any, frame_img: Any) -> list[Any]:
+                self.timecodes.append(timecode)
+                return [timecode] if len(self.timecodes) - 1 in self.frame_cuts else []
+
+            def post_process(self, timecode: Any) -> list[Any]:
+                return [self.timecodes[i] for i in self.final_cuts]
+
+        video = get_video_files()[0]
+
+        # scenedetect >= 0.7.2 reports a cut at the first frame of a video that starts faded out: the cut doesn't
+        # produce an empty scene, and without other cuts the whole video is one scene
+        scenes = _scene_detect(video, 2.0, StubDetector(frame_cuts=set(), final_cuts=[0]))
+        assert len(scenes) == 1
+        assert scenes[0]['duration'] > 0.0
+
+        # the cut at the first frame is skipped; the cuts at the next two frames end the scenes that start at the first
+        # and second frame
+        scenes = _scene_detect(video, 2.0, StubDetector(frame_cuts={0, 1, 2}, final_cuts=[]))
+        assert len(scenes) >= 2
+        assert all(s['duration'] > 0.0 for s in scenes)
+
     @pytest.mark.db_roots('local', reason='reads Env default video encoder config')
     def test_default_video_codec(self, uses_db: None) -> None:
         result = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True, check=False)
```

---

### Incident Patch 3: `12dbbcc3` (2026-10-13)
**Commit Message**: docs: YOLOX object detection and WhisperX transcription guides (#1743)

<!-- CURSOR_AGENT_PR_BODY_BEGIN -->
## Summary

Adds YOLOX object-detection and WhisperX transcription cookbooks with
runnable image, video, diarization, and transcript-search examples.

- Both recipes use task-focused titles, a recipe summary,
Problem/Solution sections, separate setup and data-loading steps, and
Query-then-Commit previews.
- Demo setup creates a fresh UUID namespace and reuses it for every
table and view. Re-running setup preserves existing catalog data.
- Filtered YOLOX queries select columns from the source table. The
ordered WhisperX word query uses `limit(12).collect()`.
- Setup documents Python 3.11+, FFmpeg, and the Hugging Face access
required for WhisperX diarization. The YOLOX guide explains the
notebook/REPL context and importable UDF requirement for scripts or use
across sessions.
- Navigation, redirects, nearby recipe links, YOLOX output-field
descriptions, and the WhisperX default diarization-model docstring point
readers to the new guides.

## Validation

- Executed all 28 Python snippets in the two new recipes against an
isolated catalog with live models: YOLOX image/video infer

**File**: `docs/release/docs.json` (modified, +4/-2)
```diff
@@ -224,6 +224,7 @@
                 "group": "Images",
                 "expanded": false,
                 "pages": [
+                  "howto/cookbooks/images/yolox-object-detection",
                   "howto/cookbooks/images/img-detect-objects",
                   "howto/cookbooks/images/img-detection-vs-segmentation",
                   "howto/cookbooks/images/img-visualize-detections",
@@ -244,6 +245,7 @@
                 "group": "Audio",
                 "expanded": false,
                 "pages": [
+                  "howto/cookbooks/audio/whisperx-transcription",
                   "howto/cookbooks/audio/audio-transcribe",
                   "howto/use-cases/audio-transcriptions",
                   "howto/cookbooks/audio/audio-summarize-podcast",
@@ -592,7 +594,7 @@
     },
     {
       "source": "/examples/vision/yolox",
-      "destination": "/howto/cookbooks/images/img-detect-objects"
+      "destination": "/howto/cookbooks/images/yolox-object-detection"
     },
     {
       "source": "/examples/vision/object-detection",
@@ -864,7 +866,7 @@
     },
     {
       "source": "/libraries/yolox",
-      "destination": "/integrations/frameworks"
+      "destination": "/howto/cookbooks/images/yolox-object-detection"
     }
   ]
 }
```

**File**: `docs/release/howto/cookbooks/audio/audio-podcast-chapters.ipynb` (modified, +1/-1)
```diff
@@ -1186,7 +1186,7 @@
     "- [`json.list_iterator`](https://docs.pixeltable.com/sdk/latest/json#iterator-list_iterator) \u2014 Iterator for flattening JSON lists into view rows\n",
     "- [Transcribe audio](https://docs.pixeltable.com/howto/cookbooks/audio/audio-transcribe) \u2014 Fixed-interval splitting with local Whisper\n",
     "- [Summarize podcasts](https://docs.pixeltable.com/howto/cookbooks/audio/audio-summarize-podcast) \u2014 Transcription + LLM summarization\n",
-    "- [Video scene detection](https://docs.pixeltable.com/howto/cookbooks/video/video-scene-detection) \u2014 Content-aware detection for video"
+    "- [WhisperX transcription and speaker diarization](https://docs.pixeltable.com/howto/cookbooks/audio/whisperx-transcription) - Word timestamps, speakers, and search"
    ]
   }
  ],
```

**File**: `docs/release/howto/cookbooks/audio/audio-transcribe.ipynb` (modified, +2/-1)
```diff
@@ -406,7 +406,8 @@
     "## See also\n",
     "\n",
     "- [Iterators documentation](https://docs.pixeltable.com/platform/iterators)\n",
-    "- [Whisper library](https://github.com/openai/whisper)"
+    "- [Whisper library](https://github.com/openai/whisper)\n",
+    "- [WhisperX transcription and speaker diarization](https://docs.pixeltable.com/howto/cookbooks/audio/whisperx-transcription) - Word timestamps, speakers, and search"
    ]
   }
  ],
```

**File**: `docs/release/howto/cookbooks/audio/whisperx-transcription.mdx` (added, +222/-0)
```diff
@@ -0,0 +1,222 @@
+---
+title: 'Transcribe speech and identify speakers with WhisperX'
+sidebarTitle: 'WhisperX transcription'
+description: 'Transcribe speech with WhisperX in Python, identify speakers, and search the transcript with word-level timestamps.'
+keywords: ['whisperx', 'speaker diarization', 'word-level timestamps', 'speech to text']
+---
+
+You transcribe recorded conversations, identify who spoke each word, and search what was said.
+
+**What's in this recipe:**
+
+- Preview WhisperX transcription and save it for each clip
+- Extract word timestamps and speaker labels
+- Search speech segments with an embedding index
+
+## Problem
+
+You have recorded conversations and need a transcript with word timestamps and speaker labels. You
+want to find relevant speech and return to the point in the recording where it was said.
+
+## Solution
+
+You use WhisperX to transcribe speech locally and align each word to a time and a speaker.
+[`pixeltable.functions.whisperx.transcribe()`](/sdk/latest/whisperx) does that as a computed column on
+audio, or on audio taken from a video with `extract_audio()`. `diarize=True` is the switch that adds
+word-level timestamps and speaker labels: Pixeltable then runs WhisperX alignment and diarization, and
+stores `segments` plus `word_segments`. A view splits those segments into rows, and an embedding index
+searches what was said.
+
+`diarize=False` returns `language` and `segments` with `start`, `end`, `text`, and `avg_logprob`. It does
+not need a Hugging Face token. `alignment_model_name`, `interpolate_method`, `return_char_alignments`,
+`diarization_model_name`, `num_speakers`, `min_speakers`, and `max_speakers` are valid only when
+`diarize=True`.
+
+You use the Query-then-Commit pattern: preview a transcript with a query on one clip, then save the
+same expression with `add_computed_column()` to transcribe every clip.
+
+### Setup
+
+You need Python 3.11 or newer and WhisperX 3.8 or newer. The search step needs `sentence-transformers`.
+WhisperX also needs [FFmpeg](https://ffmpeg.org/download.html) available on your system to load audio.
+
+```bash
+pip install -U pixeltable 'whisperx>=3.8' sentence-transformers
+```
+
+Diarization loads WhisperX's default pyannote pipeline. On WhisperX 3.8 and later that model is
+`pyannote/speaker-diarization-community-1`. Accept that model's terms on Hugging Face, then export a
+token. Pixeltable reads `HF_TOKEN` (or the `[hf]` `token` setting in
+[Configuration](/platform/configuration)). Pass `diarization_model_name` when you want a different
+pyannote pipeline, such as `pyannote/speaker-diarization-3.1`.
+
+```bash
+export HF_TOKEN='your-huggingface-token'
+```
+
+```python
+from uuid import uuid4
+
+import pixeltable as pxt
+from pixeltable.functions.huggingface import sentence_transformer
+from pixeltable.functions.json import list_iterator
+from pixeltable.functions.whisperx import transcribe
+```
+
+### Load a video clip
+
+Each run creates a fresh catalog directory. The later views use the same `demo` namespace.
+
+```python
+demo = f'whisperx_demo_{uuid4().hex}'
+pxt.create_dir(demo)
+
+clips = pxt.create_table(
+    f'{demo}.clips', {'title': pxt.String, 'video': pxt.Video}
+)
+```
+
+```python
+clips.insert([
+    {
+        'title': 'Lex Fridman podcast excerpt',
+        'video': (
+            'https://raw.githubusercontent.com/pixeltable/pixeltable/release/'
+            'docs/resources/audio-transcription-demo/'
+            'Lex-Fridman-Podcast-430-Excerpt-0.mp4'
+        ),
+    }
+])
+```
+
+### Transcribe audio from video
+
+`extract_audio()` copies the soundtrack of a `pxt.Video` column into a `pxt.Audio` value. A file that
+is already audio goes in a `pxt.Audio` column, and you pass that column to `transcribe()` without
+`extract_audio()`.
+
+`model` is a Whisper model name. `tiny.en` is the small English model. On CUDA, `compute_type`
+defaults to `float16`. Otherwise it defaults to `int8`.
+
+```python
+clips.add_computed_column(audio=clips.video.extract_audio(format='wav'))
+```
+
+You preview one transcript, then save the same expression as a computed column.
+
+```python
+transcript = transcribe(
+    clips.audio,
+    model='tiny.en',
+    language='en',
+    diarize=True,
+)
+clips.select(transcript=transcript).head(1)
+```
+
+```python
+clips.add_computed_column(transcript=transcript)
+```
+
+```python
+clips.select(
+    clips.transcript.segments[0].text,
+    clips.transcript.segments[0].speaker,
+    clips.transcript.segments[0].words,
+).collect()
+```
+
+With `diarize=True`, each segment has `start`, `end`, `text`, `avg_logprob`, and `words`, plus
+`speaker` when the diarizer overlapped that span. `word_segments` is the flat list of words. Each word has `word`,
+`start`, `end`, `score`, and `speaker` when alignment and diarization assigned them. A missing
+timestamp or speaker is null.
+
+### Word-level timestamps and speakers
+
+`list_iterator()` turns `word_segments` into one row per word
```

**File**: `docs/release/howto/cookbooks/images/img-detect-objects.ipynb` (modified, +4/-4)
```diff
@@ -548,9 +548,9 @@
     "\n",
     "The `detections` dictionary contains:\n",
     "\n",
-    "- `labels`: List of class names (e.g., \"person\", \"car\", \"dog\")\n",
-    "- `boxes`: Bounding box coordinates [x1, y1, x2, y2]\n",
-    "- `scores`: Confidence scores (0-1)\n",
+    "- `bboxes`: pixel coordinates `[xmin, ymin, xmax, ymax]`\n",
+    "- `labels`: COCO class ids (integers). `0` is person\n",
+    "- `scores`: confidence from 0 to 1\n",
     "\n",
     "**Adjusting threshold:**\n",
     "\n",
@@ -566,7 +566,7 @@
     "\n",
     "- [Extract frames from videos](https://docs.pixeltable.com/howto/cookbooks/video/video-extract-frames) - Detect objects in video frames\n",
     "- [Analyze images in batch](https://docs.pixeltable.com/howto/cookbooks/images/vision-batch-analysis) - AI vision analysis\n",
-    "- [Find similar images](https://docs.pixeltable.com/howto/cookbooks/search/search-similar-images) - Visual similarity search"
+    "- [YOLOX object detection in Python](https://docs.pixeltable.com/howto/cookbooks/images/yolox-object-detection) - Images, video frames, and drawn boxes"
    ]
   }
  ],
```

**File**: `docs/release/howto/cookbooks/images/img-visualize-detections.ipynb` (modified, +3/-2)
```diff
@@ -406,7 +406,7 @@
     "The `yolox` function returns a dict with:\n",
     "\n",
     "- `bboxes` - List of [x1, y1, x2, y2] coordinates\n",
-    "- `labels` - List of class names (e.g., \"cat\", \"dog\")\n",
+    "- `labels` - COCO class ids (integers). `0` is person\n",
     "- `scores` - List of confidence scores (0-1)\n",
     "\n",
     "**YOLOX model options:**\n",
@@ -427,7 +427,8 @@
     "## See also\n",
     "\n",
     "- [Detect objects in images](https://docs.pixeltable.com/howto/cookbooks/images/img-detect-objects) - Object detection basics\n",
-    "- [Extract video frames](https://docs.pixeltable.com/howto/cookbooks/video/video-extract-frames) - Detect objects in video"
+    "- [Extract video frames](https://docs.pixeltable.com/howto/cookbooks/video/video-extract-frames) - Detect objects in video\n",
+    "- [YOLOX object detection in Python](https://docs.pixeltable.com/howto/cookbooks/images/yolox-object-detection) - Images, video frames, and drawn boxes"
    ]
   }
  ],
```

**File**: `docs/release/howto/cookbooks/images/yolox-object-detection.mdx` (added, +215/-0)
```diff
@@ -0,0 +1,215 @@
+---
+title: 'Detect objects in images and videos with YOLOX'
+sidebarTitle: 'YOLOX object detection'
+description: 'Run YOLOX object detection in Python on images and video frames, then query and draw the detected objects.'
+keywords: ['yolox', 'object detection', 'YOLOX Python', 'video object detection']
+---
+
+You detect objects in images and video frames, filter by object class, and draw the bounding boxes.
+
+**What's in this recipe:**
+
+- Preview YOLOX detections and save them for each image
+- Query images and video frames by COCO class id
+- Draw detections and assemble annotated frames into a video
+
+## Problem
+
+You have images or videos and need to find objects such as people and cars. You want to query which
+images or frames contain those objects and inspect their bounding boxes.
+
+## Solution
+
+You use YOLOX, an anchor-free object detector, to return a box around each detected object.
+[`pixeltable.functions.yolox.yolox()`](/sdk/latest/yolox) runs one of `yolox_nano`, `yolox_tiny`, `yolox_s`,
+`yolox_m`, `yolox_l`, or `yolox_x` on an image. On a video, [`frame_iterator()`](/platform/iterators) makes one
+row per frame, and the same function runs on `frame`. The call belongs in a computed column, so an insert
+stores the boxes with the row. Weights come from
+[pixeltable-yolox](https://github.com/pixeltable/pixeltable-yolox). This UDF runs on CPU.
+
+You use the Query-then-Commit pattern: preview detections with a query on a few rows, then save the
+same expression with `add_computed_column()` to process every row.
+
+### Setup
+
+You need Python 3.11 or newer. You run these snippets in a notebook or Python REPL.
+
+```bash
+pip install -U pixeltable pixeltable-yolox
+```
+
+```python
+from uuid import uuid4
+
+import pixeltable as pxt
+from pixeltable.functions.video import frame_iterator, make_video
+from pixeltable.functions.vision import bboxes_draw
+from pixeltable.functions.yolox import yolox
+from yolox.data.datasets import COCO_CLASSES
+```
+
+### Load images
+
+Each run creates a fresh catalog directory. The video example uses the same `demo` namespace.
+
+```python
+demo = f'yolox_demo_{uuid4().hex}'
+pxt.create_dir(demo)
+
+images = pxt.create_table(f'{demo}.images', {'image': pxt.Image})
+```
+
+```python
+images.insert([
+    {
+        'image': 'https://raw.githubusercontent.com/pixeltable/pixeltable/main/docs/resources/images/000000000036.jpg'
+    },
+    {
+        'image': 'https://raw.githubusercontent.com/pixeltable/pixeltable/main/docs/resources/images/000000000090.jpg'
+    },
+])
+```
+
+### Detect objects in an image table
+
+`yolox()` returns three lists of equal length:
+
+- `bboxes`: `[xmin, ymin, xmax, ymax]` in pixels
+- `scores`: confidence from 0 to 1, already filtered by `threshold` (default `0.5`)
+- `labels`: COCO class ids. `0` is `person` and `2` is `car`. Names are `yolox.data.datasets.COCO_CLASSES`.
+
+`bboxes_draw()` paints those boxes onto the image. You pass the class names so the label text reads `person`.
+
+```python
+@pxt.udf
+def class_names(detections: dict) -> list[str]:
+    return [COCO_CLASSES[int(label)] for label in detections['labels']]
+```
+
+### Test image detection with a query
+
+You preview detections on two images before saving a computed column.
+
+```python
+image_detections = yolox(images.image, model_id='yolox_m', threshold=0.5)
+images.select(images.image, detections=image_detections).head(2)
+```
+
+### Commit changes with a computed column
+
+You save the same expression, then add class names and annotated images.
+
+```python
+images.add_computed_column(detections=image_detections)
+images.add_computed_column(classes=class_names(images.detections))
+images.add_computed_column(
+    annotated=bboxes_draw(
+        images.image,
+        images.detections.bboxes,
+        labels=images.classes,
+    )
+)
+```
+
+```python
+images.select(
+    images.image, images.annotated, images.classes, images.detections.scores
+).collect()
+```
+
+### Query the detections
+
+`threshold` drops low-confidence boxes inside `yolox()`. `labels.contains()` keeps rows that include a
+class id. This keeps images with a person (`0`):
+
+```python
+people = images.where(images.detections.labels.contains(0))
+people.select(images.classes, images.detections.scores).collect()
+```
+
+`0.8` returns fewer boxes. `0.25` returns more. Model-size tradeoffs are in
+[Detect objects in images](/howto/cookbooks/images/img-detect-objects). Box color and fill are in
+[Visualize object detections](/howto/cookbooks/images/img-visualize-detections).
+
+### Detect objects in video frames
+
+`frame_iterator()` adds `frame`, `frame_attrs`, and `pos`. `fps=1.0` extracts one frame per second.
+If you set `fps` above the video's own rate, the iterator returns every frame. Adding the detection
+column runs `yolox()` on each extracted frame. `yolox_tiny` is the smaller model. `yolox_m` and
+`yolox_x` are the larger ones.
+
+```python
+videos = pxt.crea
```

**File**: `docs/release/howto/use-cases/object-detection-in-videos.ipynb` (modified, +2/-0)
```diff
@@ -16,6 +16,8 @@
     "\n",
     "This tutorial assumes you're at least somewhat familiar with Pixeltable; a good place to learn more is the [Pixeltable Documentation](https://docs.pixeltable.com/overview/pixeltable).\n",
     "\n",
+    "For images and one frame per second, see [YOLOX object detection in Python](https://docs.pixeltable.com/howto/cookbooks/images/yolox-object-detection).\n",
+    "\n",
     "<div class=\"alert alert-block alert-info\"><!-- mdx:none -->\n",
     "<b>If you are running this tutorial in Colab:</b>\n",
     "In order to make the tutorial run a bit snappier, let's switch to a GPU-equipped instance for this Colab session. To do that, click on the <code>Runtime -> Change runtime type</code> menu item at the top, then select the <code>GPU</code> radio button and click on <code>Save</code>.\n",
```

#### Recent Merged Pull Requests:
- **PR #1787** (2026-10-18): Comment out the claude-review erosion job for now (@pierrebrunelle)
- **PR #1775** (closed): PXT-1574: honor alter_column nullability on cloud tables without catalog reload (@pierrebrunelle)
- **PR #1772** (closed): PXT-1573: replace retired anthropic/claude-sonnet-4 in OpenRouter docs and tests (@pierrebrunelle)
- **PR #1771** (2026-10-16): PXT-1569: remove Env.is_using_cockroachdb() (@pierrebrunelle)
- **PR #1770** (2026-10-16): Add an always-on Claude erosion check to the PR reviewer (@pierrebrunelle)
- **PR #1768** (2026-10-15): REVIEW.md: inline scope gate, MIT notice, pinned upstream (@pierrebrunelle)

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

## X. two random-ops stress test failures: shared tmp dir and drop_column race (#1764)

**RULE**:
When implementing operations in `pixeltable/env.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pixeltable/pixeltable. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a643fbb7`: two random-ops stress test failures: shared tmp dir and drop_column race (#1764). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `pixeltable/env.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
import psutil
    _tmp_dir: Path | None  # any tmp files, in one TempStore directory per process
        """Remove the tmp files of processes that have exited.

        Processes that share this home each write to their own TempStore directory, named after the pid; the
        directory of a live process stays. A reused pid keeps a stale directory until that process exits too.
        """
        # list the entries before the pids: a directory created after the listing is not considered, and one created
        # before it belongs to a process that is in the pid list
        paths = list(self._tmp_dir.iterdir())
        live_pids = {str(pid) for pid in psutil.pids()}
        for path in paths:
            if path.name in live_pids:
                continue
            # best effort, per entry: another process sharing this home can remove an entry between the listing and the
            # delete, or (on Windows) hold a file open; what remains is removed by a later startup
            with contextlib.suppress(OSError):
                if path.is_dir():
                    shutil.rmtree(path, ignore_errors=True)
                else:
                    path.unlink()
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
import glob
    _tmp_dir: Path | None  # any tmp files
        for path in glob.glob(f'{self._tmp_dir}/*'):
            # another process sharing this home can remove an entry between the glob and the delete
            if os.path.isdir(path):
                shutil.rmtree(path, ignore_errors=True)
            else:
                with contextlib.suppress(FileNotFoundError):
                    os.remove(path)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a643fbb7` are properly handled with clean fallback behavior.
