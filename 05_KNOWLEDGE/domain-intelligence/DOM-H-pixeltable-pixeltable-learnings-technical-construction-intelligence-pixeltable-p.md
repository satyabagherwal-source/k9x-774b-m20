# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: pixeltable-pixeltable-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "pixeltable-pixeltable-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T03:39:42.693Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-pixeltable-pixeltable-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pixeltable-pixeltable-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T03:39:42.693Z`  
> **Learning ID**: `LEARN-EVO-pixeltable-pixeltable-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: I (Content & Information Intelligence), G (Architecture Intelligence), D (Research & Knowledge Intelligence), K (Quality & Verification Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence), F (Design Intelligence), B (Product Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 54%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from pixeltable-pixeltable-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/pixeltable-pixeltable-learnings.md`  
> **Source**: github ([https://github.com/pixeltable/pixeltable](https://github.com/pixeltable/pixeltable))  
> **Source Version**: `b7363f1f`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-18T03:39:34.695Z  
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
> **Harvest Timestamp**: 2026-11-18T03:39:34.688Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pixeltable/pixeltable`
- **Description**: The backend agents build with - Multimodal database, orchestration, and serving in one file
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 1664 stars

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
from .path import Path
from .types import TableVersionKey, TableVersionMd

if TYPE_CHECKING:
    from .table_metadata import TableMetadata
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
        # do this before column_version_md(), which requires a valid value expression
        if col.is_computed:
            col.check_value_expr()

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
        additional_m
```

### Core Architecture Module: `pixeltable/functions/util.py`
```
from pixeltable.functions.media_metadata import (
    CodecContextMetadata,
    ContainerMetadata,
    ImageMetadata,
    StreamMetadata,
    get_metadata,
)
from pixeltable.functions.model_support import normalize_image_mode, resolve_torch_device

__all__ = [
    'CodecContextMetadata',
    'ContainerMetadata',
    'ImageMetadata',
    'StreamMetadata',
    'get_metadata',
    'normalize_image_mode',
    'resolve_torch_device',
]

```

### Core Architecture Module: `pixeltable/io/utils.py`
```
from pixeltable.io.export import replace_media_with_fileurl
from pixeltable.io.schema import normalize_primary_key_parameter, normalize_pxt_col_name, normalize_schema_names
from pixeltable.utils.file_io import atomic_write

__all__ = [
    'atomic_write',
    'normalize_primary_key_parameter',
    'normalize_pxt_col_name',
    'normalize_schema_names',
    'replace_media_with_fileurl',
]

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
from pixeltable.catalog import Catalog, ProhibitedWriteError, is_valid_identifier, model
from pixeltable.catalog.model import diff
from pixeltable.config import Config
from pixeltable.env import Env
from pixeltable.func import FunctionRegistry
from pixeltable.func.symbols import load_error_msg
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

    try:
        registry = FunctionRegistry.get()
        with _lock, Catalog.freeze():
            root = Config.get().project_root
            assert root is not None  # module_name() refuses a file outside a project root
            # evict before importing: importlib returns a module in sys.modules without reading its file again
            evict_modules(root)
            return registry.import_module(name)
    except ProhibitedWriteError as e:
        raise excs.RequestError(
            excs.ErrorCode.UNSUPPORTED_OPERATION, _prohibited_write_msg(str(path), subject, e)
        ) from e
    except Exception as e:
        raise excs.RequestError(excs.ErrorCode.INVALID_ARGUMENT, load_error_msg(file, e)) from e


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


def evict_modules(root: Path) -> None:
    """Remove the modules under root from sys.modules, and their udfs from the registry.

    Removing these modules allows us to have them re-imported, in response to changes to the source files. Also
    clear importlib's directory caches, so an import finds a newly created module file.

    The standard library and installed packages stay loaded, including when the environment sits inside root
    (eg, a .venv).
    """
    importlib.invalidate_caches()
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
    warnings = [
        f'{cls.__name__}.{name} references no column, so every row computes it from the same inputs: {value!s}. '
        'Python code in a model body, such as str(), % or `is None`, runs once, at class definition. '
        'Use == None instead of `is None`, and + or pxtf.string.format() instead of str() or %.'
        for base in bases
        for cls in base.defined_models()
        for name, value in cls.constant_columns().items()
    ]
    warnings.extend(shadowed_project_modules())
    return CheckReport(file=file, valid=len(errors) == 0, errors=errors, warnings=warnings)


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
        file = getattr(resolved, '__file__', None)
        if file is None or not Path(file).resolve().is_relative_to(project_root):
            continue  # an installed module
        top_level = fn_
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1988** (2026-11-18): **Don't fail closing the Parallel MCP client when its connection task ends cancelled (anyio 4.16)**
  *Symptoms*: ## Problem  In a `pip-install-tests` run on `main` ([run 44197090253](https://github.com/pixeltable/pixeltable/actions/runs/44197090253)), both jobs that install `mcp` failed with `AlreadyExistsError: Path 'test_tbl' is an existing table`. The failures hit Parallel's tests and, on 3.13, the `TestString` tests after them.  Each job's first error came in the teardown of a test that left a Parallel MCP session open: `test_free_tier` on 3.11, `test_free_rate_limit_is_retried[429]` on 3.13. `_configure()`'s cleanup calls `reset_runtime()`, which raised `asyncio.CancelledError: Cancelled via cancel scope`. That aborted the cleanup, left `test_tbl` behind, and every later `create_table('test_tbl')` failed.  How it happens: - `Runtime.close()` cancels every pending task on its own loop before it closes clients (`runtime.py:273-280`). That includes `_ParallelMcpClient`'s connection task, waiting in `disconnect.wait()`. - From anyio 4.16, the task then ends in cancellation. As it unwinds, anyio's task group also cancels the session-ending `DELETE`. - `close_clients()` then calls `_ParallelMcpClient.close()`, whose `await connection` re-raises that cancellation. `try_close()` catches only `Exception`, so it escapes `reset_runtime()`.  It depends on anyio's version, not on load:  | Code | anyio | `test_free_rate_limit_is_retried` | |---|---|---| | `main` | 4.14.2 (`uv.lock`) | passes | | `main` | 4.16.0 (what the run installed) | `CancelledError` in teardown | | this PR | 4.16.0 | passes
  **Post-Mortem & Fix Analysis**:
  > agent review

- **Issue #1983** (2026-11-18): **[PXT-1795] Fix FastAPIRouter docstring to reflect both use cases**
  *Symptoms*: ## Summary  - The `FastAPIRouter` class docstring incorrectly said the router is only for apps that already have a FastAPI server, and to use `pxt service` otherwise - In reality, `pxt service` itself serves `FastAPIRouter` objects, so users always need a router regardless of which path they take - Updated the docstring to clarify: `FastAPIRouter` declares routes over tables or models; `pxt service` runs it standalone, or an existing FastAPI app mounts it via `include_router()` after `bind()`  Fixes [PXT-1795](https://pixeltable.atlassian.net/jira/browse/PXT-1795).  🤖 Generated with [Claude Code](https://claude.com/claude-code)  [PXT-1795]: https://pixeltable.atlassian.net/browse/PXT-1795?atlOrigin=eyJpIjoiNWRkNTljNzYxNjVmNDY3MDlhMDU5Y2ZhYzA5YTRkZjUiLCJwIjoiZ2l0aHViLWNvbS1KU1cifQ

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

### Incident Patch 1: `34cb37cd` (2026-11-17)
**Commit Message**: Run every ffmpeg invocation with -nostdin and stdin=DEVNULL (#1972)

The merge queue's `standard, windows-2025, 3.11` job timed out ([run
43958988160](https://github.com/pixeltable/pixeltable/actions/runs/43958988160/job/133621168998)).
`test_ffmpeg_filter` started at 22:08:44 and never finished. The
30-minute faulthandler dump shows the worker's main thread waiting in
`subprocess.run()` for the `ffmpeg` that `ffmpeg_filter()` started. Both
of `subprocess`'s reader threads were still blocked on `ffmpeg`'s stdout
and stderr, so those pipes were still open after 30 minutes.

## Change

Every `ffmpeg` invocation now goes through `av_utils.run_ffmpeg()`,
which passes `-nostdin` and `stdin=subprocess.DEVNULL`. There were 9
call sites: `get_max_volume_db()`, `run_ffmpeg_cmdline()`, 4 in
`video/editing.py`, 2 in `video/iterators.py` and the `-encoders` probe
in `env.py`. Before this change none of them redirected stdin.

By default, `ffmpeg` polls stdin for keyboard commands (`q`, `c`, `d`,
...) and prompts on stdin before it overwrites an existing output. With
an inherited terminal or open pipe, it can consume input meant for its
parent or block. With `-nostdin`, an existing output file 

**File**: `pixeltable/env.py` (modified, +3/-2)
```diff
@@ -11,7 +11,6 @@
 import math
 import os
 import shutil
-import subprocess
 import threading
 import types
 import typing
@@ -872,6 +871,8 @@ def _determine_default_video_encoder(self) -> str | None:
         - the user might prefer a hardware-accelerated encoder (eg, h264_nvenc or h264_videotoolbox)
         - allow user override via a config option 'video_encoder'
         """
+        from pixeltable.utils.av import run_ffmpeg
+
         # look for available encoders, in this order
         candidates = [
             'libx264',  # GPL, best quality
@@ -880,7 +881,7 @@ def _determine_default_video_encoder(self) -> str | None:
 
         try:
             # Get list of available encoders
-            result = subprocess.run(['ffmpeg', '-encoders'], capture_output=True, text=True, timeout=10, check=True)
+            result = run_ffmpeg(['-encoders'], timeout=10)
 
             if result.returncode == 0:
                 available_encoders = result.stdout
```

**File**: `pixeltable/functions/video/editing.py` (modified, +8/-12)
```diff
@@ -1,5 +1,4 @@
 import glob
-import logging
 import subprocess
 from pathlib import Path
 from typing import Any, Literal
@@ -17,8 +16,6 @@
 
 from .iterators import VideoSegment
 
-_logger = logging.getLogger(__name__)
-
 
 @pxt.uda(requires_order_by=True)
 class make_video(pxt.Aggregator):
@@ -431,7 +428,7 @@ def segment_video(
     if mode == 'accurate':
         # Use ffmpeg -f segment for accurate segmentation with re-encoding
         output_pattern = f'{base_path}_segment_%04d.mp4'
-        cmd = av_utils.ffmpeg_segment_cmd(
+        cmd = av_utils.ffmpeg_segment_args(
             str(video),
             output_pattern,
             segment_duration=duration,
@@ -441,7 +438,7 @@ def segment_video(
         )
 
         try:
-            _ = subprocess.run(cmd, capture_output=True, text=True, check=True)
+            _ = av_utils.run_ffmpeg(cmd)
             output_paths = sorted(glob.glob(f'{base_path}_segment_*.mp4'))
             # TODO: is this actually an error?
             # if len(output_paths) == 0:
@@ -469,9 +466,9 @@ def segment_video(
                 else:
                     target_duration = None  # the rest
                 segment_path = f'{base_path}_segment_{len(output_paths)}.mp4'
-                cmd = av_utils.ffmpeg_clip_cmd(str(video), segment_path, start_time, target_duration)
+                cmd = av_utils.ffmpeg_clip_output_args(str(video), segment_path, start_time, target_duration)
 
-                _ = subprocess.run(cmd, capture_output=True, text=True, check=True)
+                _ = av_utils.run_ffmpeg(cmd)
                 segment_duration = av_utils.get_video_duration(segment_path)
                 if segment_duration is None:
                     # a generated segment whose duration we cannot read
@@ -574,10 +571,9 @@ def _concat_videos(
 
     try:
         # First attempt: fast copy without re-encoding (works for compatible formats)
-        cmd = ['ffmpeg', '-f', 'concat', '-safe', '0', '-i', str(filelist_path), '-c', 'copy', '-y', str(output_path)]
-        _logger.debug(f'_concat_videos(): {" ".join(cmd)}')
+        cmd = ['-f', 'concat', '-safe', '0', '-i', str(filelist_path), '-c', 'copy', '-y', str(output_path)]
         try:
-            _ = subprocess.run(cmd, capture_output=True, text=True, check=True)
+            _ = av_utils.run_ffmpeg(cmd)
             return str(output_path)
         except subprocess.CalledProcessError:
             # Expected for mixed formats - continue to fallback
@@ -600,7 +596,7 @@ def _concat_videos(
         # - [0:a:0][1:a:0] - audio stream 0 from inputs 0 and 1
         # - concat=n=2:v=0:a=1[outa] - concat 2 inputs, 0 video, 1 audio stream, output to [outa]
 
-        cmd = ['ffmpeg']
+        cmd = []
         for video in videos:
             cmd.extend(['-i', video])
 
@@ -621,7 +617,7 @@ def _concat_videos(
             cmd.extend(['-c:a', 'aac'])
         cmd.extend(['-pix_fmt', 'yuv420p', str(output_path)])
 
-        _ = subprocess.run(cmd, capture_output=True, text=True, check=True)
+        _ = av_utils.run_ffmpeg(cmd)
         return str(output_path)
 
     except subprocess.CalledProcessError as e:
```

**File**: `pixeltable/functions/video/iterators.py` (modified, +4/-4)
```diff
@@ -516,8 +516,8 @@ def video_splitter(
                     target_duration = None  # the rest of the video
 
                 segment_path = str(TempStore.create_path(extension='.mp4'))
-                cmd = av_utils.ffmpeg_clip_cmd(video, segment_path, start_time, target_duration)
-                _ = subprocess.run(cmd, capture_output=True, text=True, check=True)
+                cmd = av_utils.ffmpeg_clip_output_args(video, segment_path, start_time, target_duration)
+                _ = av_utils.run_ffmpeg(cmd)
 
                 # use the actual duration
                 actual_duration = av_utils.get_video_duration(segment_path)
@@ -563,7 +563,7 @@ def video_splitter(
         base_path = TempStore.create_path(extension='')
         # Use ffmpeg -f segment for accurate segmentation with re-encoding
         output_pattern = f'{base_path}_segment_%04d.mp4'
-        cmd = av_utils.ffmpeg_segment_cmd(
+        cmd = av_utils.ffmpeg_segment_args(
             video,
             output_pattern,
             segment_duration=duration,
@@ -572,7 +572,7 @@ def video_splitter(
             video_encoder_args=video_encoder_args,
         )
         try:
-            _ = subprocess.run(cmd, capture_output=True, text=True, check=True)
+            _ = av_utils.run_ffmpeg(cmd)
             output_paths = sorted(glob.glob(f'{base_path}_segment_*.mp4'))
             # TODO: is this actually an error?
             # if len(output_paths) == 0:
```

**File**: `pixeltable/utils/av.py` (modified, +24/-13)
```diff
@@ -121,9 +121,9 @@ def get_max_volume_db(path: str) -> float | None:
     Env.get().require_binary('ffmpeg')
     # -vn/-sn/-dn: ignore non-audio streams; -f null -: discard the output, we only want stderr.
     # Explicit -loglevel info so volumedetect's report reaches us regardless of the build default.
-    cmd = ['ffmpeg', '-i', path, '-vn', '-sn', '-dn', '-af', 'volumedetect', '-f', 'null', '-loglevel', 'info', '-']
+    args = ['-i', path, '-vn', '-sn', '-dn', '-af', 'volumedetect', '-f', 'null', '-loglevel', 'info', '-']
     try:
-        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
+        result = run_ffmpeg(args)
     except subprocess.CalledProcessError as e:
         handle_ffmpeg_error(e)
     # Stderr lines look like: "[Parsed_volumedetect_0 @ 0x...] max_volume: -6.0 dB"
@@ -211,6 +211,20 @@ def estimate_segment_duration(path: str, approx_decoded_bytes: int) -> float | N
     return frames_per_segment / fps
 
 
+def run_ffmpeg(args: list[str], timeout: float | None = None) -> subprocess.CompletedProcess[str]:
+    """
+    Run ffmpeg with args and capture its output; raises subprocess.CalledProcessError on a nonzero exit status.
+
+    By default ffmpeg polls stdin for keyboard commands and prompts there before overwriting an output file; with an
+    inherited stdin that is a terminal or an open pipe, it can consume another reader's input or block forever.
+    -nostdin turns both off (ffmpeg then refuses to overwrite and writes nothing), and DEVNULL keeps the caller's stdin
+    out of the child.
+    """
+    cmd = ['ffmpeg', '-nostdin', *args]
+    _logger.debug(f'running ffmpeg commandline: {" ".join(cmd)}')
+    return subprocess.run(cmd, stdin=subprocess.DEVNULL, capture_output=True, text=True, check=True, timeout=timeout)
+
+
 def handle_ffmpeg_error(e: subprocess.CalledProcessError) -> NoReturn:
     error_msg = f'ffmpeg failed with return code {e.returncode}'
     if e.stderr is not None:
@@ -230,21 +244,20 @@ def run_ffmpeg_cmdline(
 
     If encode_video==True, command is expected to encode video and requires video encoder args
     """
-    cmd = ['ffmpeg', *ffmpeg_args]
+    args = list(ffmpeg_args)
     if encode_video:
-        append_video_encoder(cmd, video_encoder, video_encoder_args)
+        append_video_encoder(args, video_encoder, video_encoder_args)
     # loglevel=error: avoid excessive logging
-    cmd += ['-loglevel', 'error', output_path]
+    args += ['-loglevel', 'error', output_path]
 
     try:
-        _logger.debug(f'running ffmpeg commandline: {" ".join(cmd)}')
-        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
+        result = run_ffmpeg(args)
         output_file = Path(output_path)
         if not output_file.exists() or output_file.stat().st_size == 0:
             stderr_output = result.stderr.strip() if result.stderr is not None else ''
             raise pxt.RequestError(
                 pxt.ErrorCode.INVALID_DATA_FORMAT,
-                f'ffmpeg failed to create output file for commandline: {" ".join(cmd)}\n{stderr_output}',
+                f'ffmpeg failed to create output file for commandline: {" ".join(result.args)}\n{stderr_output}',
             )
         return output_path
     except subprocess.CalledProcessError as e:
@@ -319,7 +332,7 @@ def ffmpeg_clip_args(
     return cmd
 
 
-def ffmpeg_clip_cmd(
+def ffmpeg_clip_output_args(
     input_path: str,
     output_path: str,
     start_time: float,
@@ -329,29 +342,27 @@ def ffmpeg_clip_cmd(
     video_encoder_args: dict[str, Any] | None = None,
 ) -> list[str]:
     return [
-        'ffmpeg',
         *ffmpeg_clip_args(input_path, start_time, duration, fast, video_encoder, video_encoder_args),
         '-loglevel',
         'error',
         output_path,
     ]
 
 
-def ffmpeg_segment_cmd(
+def ffmpeg_segment_args(
     input_path: str,
     output_pattern: str,
     segment_duration: float | None = None,
     segment_times: list[float] | None = None,
     video_encoder: str | None = None,
     video_encoder_args: dict[str, Any] | None = None,
 ) -> list[str]:
-    """Commandline for frame-accurate segmentation"""
+    """ffmpeg arguments for frame-accurate segmentation"""
     assert (segment_duration is None) != (segment_times is None)
     if video_encoder is None:
         video_encoder = Env.get().default_video_encoder
 
     cmd = [
-        'ffmpeg',
         '-i',
         input_path,
         '-map',
```

**File**: `tests/test_video.py` (modified, +27/-15)
```diff
@@ -2220,7 +2220,7 @@ def test_scene_detect_spans_video(self, uses_db: None, tmp_path: Path) -> None:
 
     @pytest.mark.db_roots('local', reason='reads Env default video encoder config')
     def test_default_video_codec(self, uses_db: None) -> None:
-        result = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True, check=False)
+        result = av_utils.run_ffmpeg(['-version'])
         print(f'ffmpeg -version:\n{result.stdout}')
 
         default_encoder = Env.get().default_video_encoder
@@ -2317,20 +2317,8 @@ def test_mix_audio_errors(self, uses_db: None, tmp_path: Path) -> None:
     def test_mix_audio_duration_modes(self, uses_db: None, tmp_path: Path) -> None:
         def make_audio(duration: float, name: str) -> str:
             out = tmp_path / f'{name}.m4a'
-            subprocess.run(
-                [
-                    'ffmpeg',
-                    '-f',
-                    'lavfi',
-                    '-i',
-                    f'sine=frequency=220:duration={duration}',
-                    '-c:a',
-                    'aac',
-                    '-y',
-                    str(out),
-                ],
-                capture_output=True,
-                check=True,
+            av_utils.run_ffmpeg(
+                ['-f', 'lavfi', '-i', f'sine=frequency=220:duration={duration}', '-c:a', 'aac', '-y', str(out)]
             )
             return str(out)
 
@@ -2638,6 +2626,30 @@ def test_transition_errors(self, uses_db: None, tmp_path: Path) -> None:
         with pxt_raises(pxt.ErrorCode.UNSUPPORTED_OPERATION, match=r'transition duration.*exceeds duration'):
             u2.select(transition(u2.v1, u2.v2, duration=1.0)).collect()
 
+    def test_run_ffmpeg_ignores_stdin(self, tmp_path: Path) -> None:
+        """ffmpeg's overwrite prompt must neither read nor wait on the caller's stdin."""
+        output_path = tmp_path / 'existing.mp4'
+        output_path.touch()
+        read_fd, write_fd = os.pipe()
+        os.write(write_fd, b'y\n')
+        os.close(write_fd)
+        saved_stdin = os.dup(0)
+        os.dup2(read_fd, 0)
+        try:
+            # a refused overwrite exits with status 1 before ffmpeg 6.1 and 0 from 6.1 on
+            stderr = av_utils.run_ffmpeg(
+                ['-i', get_video_files()[0], '-c', 'copy', str(output_path)], timeout=60
+            ).stderr
+        except subprocess.CalledProcessError as e:
+            stderr = e.stderr
+        finally:
+            os.dup2(saved_stdin, 0)
+            os.close(saved_stdin)
+        assert 'already exists' in stderr
+        assert output_path.stat().st_size == 0
+        assert os.read(read_fd, 2) == b'y\n'
+        os.close(read_fd)
+
     @pytest.mark.db_roots('local', reason='pure UDF test')
     def test_ffmpeg_filter(self, uses_db: None) -> None:
         video_filepaths = get_video_files()
```

**File**: `tests/utils.py` (modified, +7/-7)
```diff
@@ -53,7 +53,7 @@
 from pixeltable.service import management_client, proxy_daemon
 from pixeltable.telemetry import SubscriberRegistry
 from pixeltable.types import ColumnSpec
-from pixeltable.utils import sha256sum
+from pixeltable.utils import av as av_utils, sha256sum
 from pixeltable.utils.console_output import ConsoleMessageFilter, ConsoleOutputHandler
 from pixeltable.utils.filecache import FileCache
 from pixeltable.utils.local_store import LocalStore, TempStore
@@ -593,7 +593,7 @@ def generate_test_video(
     pix_fmt: str = 'yuv420p',
 ) -> str:
     """Create test video with specific properties using ffmpeg and return its path"""
-    cmd = ['ffmpeg', '-f', 'lavfi', '-i', f'testsrc=duration={duration}:size={size}:rate={fps}']
+    cmd = ['-f', 'lavfi', '-i', f'testsrc=duration={duration}:size={size}:rate={fps}']
     if has_audio:
         cmd.extend(['-f', 'lavfi', '-i', f'sine=frequency=440:duration={duration}'])
     if Env.get().default_video_encoder is not None:
@@ -603,7 +603,7 @@ def generate_test_video(
         cmd.extend(['-c:a', 'aac'])
     output_path = tmp_path / f'{uuid4()}.mp4'
     cmd.extend(['-y', str(output_path)])
-    subprocess.run(cmd, capture_output=True, check=True)
+    av_utils.run_ffmpeg(cmd)
     return str(output_path)
 
 
@@ -616,25 +616,25 @@ def generate_color_video(
     Each segment is a (color, fps) pair; segments with different fps produce a variable frame rate video. The first
     frame is at start_time.
     """
-    cmd = ['ffmpeg']
+    cmd: list[str] = []
     for color, fps in segments:
         cmd.extend(['-f', 'lavfi', '-i', f'color=c={color}:s=64x64:r={fps}:d=1'])
     inputs = ''.join(f'[{i}]' for i in range(len(segments)))
     cmd.extend(['-filter_complex', f'{inputs}concat=n={len(segments)}:v=1', '-fps_mode', 'passthrough'])
     cmd.extend(['-output_ts_offset', str(start_time), '-c:v', 'libx264', '-pix_fmt', 'yuv420p'])
     output_path = tmp_path / f'{uuid4()}.{extension}'
     cmd.extend(['-y', str(output_path)])
-    subprocess.run(cmd, capture_output=True, check=True)
+    av_utils.run_ffmpeg(cmd)
     return str(output_path)
 
 
 def generate_tone_audio(tmp_path: Path, extension: str, start_time: float = 0.0) -> str:
     """Create a 2-second 440 Hz tone whose first sample is at start_time and return its path."""
     codec = 'libopus' if extension == 'webm' else 'flac'
     output_path = tmp_path / f'{uuid4()}.{extension}'
-    cmd = ['ffmpeg', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2']
+    cmd = ['-f', 'lavfi', '-i', 'sine=frequency=440:duration=2']
     cmd.extend(['-output_ts_offset', str(start_time), '-c:a', codec, '-y', str(output_path)])
-    subprocess.run(cmd, capture_output=True, check=True)
+    av_utils.run_ffmpeg(cmd)
     return str(output_path)
 
 
```

---

### Incident Patch 2: `67876f91` (2026-11-17)
**Commit Message**: Dump a hung test's child processes at faulthandler_timeout (#1975)

Follow-up to #1972. When a test reaches `faulthandler_timeout` (1800 s),
a new `pytest_runtest_protocol` wrapper in `tests/conftest.py` lists the
xdist worker's child processes, right after pytest's own stack dump. For
each child it shows pid, status, thread count, command line, and CPU
time sampled twice, 10 s apart. The list goes to the same stderr dup as
pytest's stack dump, so it appears in the job log on every OS.

Why: in the Windows `ffmpeg` hang ([run
43958988160](https://github.com/pixeltable/pixeltable/actions/runs/43958988160/job/133621168998)),
the stack dump showed the worker blocked in `subprocess.run()`, waiting
for EOF on `ffmpeg`'s pipes. That stack looks the same whether `ffmpeg`
was spinning, blocked, or gone while another process held a copy of its
pipe handles. The SIGUSR1 watchdog from #1941 also skips Windows. With
this dump, the next such timeout tells the cases apart:
- CPU time rising: the child is busy (a spin or livelock).
- CPU time flat: the child is blocked (for example, a deadlock).
- No such child: the child exited, and a leaked handle is holding the
pipe open.

Example, from a test

**File**: `tests/conftest.py` (modified, +49/-0)
```diff
@@ -14,15 +14,18 @@
 import signal
 import sys
 import threading
+import time
 import urllib.parse
 import uuid
 from typing import Any, Callable, Generator, Iterator, get_args
 
+import psutil
 import pytest
 import requests
 import sqlalchemy as sql
 import tenacity
 from _pytest.config import Config as PytestConfig, argparsing
+from _pytest.faulthandler import fault_handler_stderr_fd_key
 from filelock import FileLock
 from sqlalchemy import text
 
@@ -170,6 +173,52 @@ def _clear_model_caches() -> None:
         ctypes.CDLL('libc.so.6').malloc_trim(0)
 
 
+@pytest.hookimpl(wrapper=True)
+def pytest_runtest_protocol(item: pytest.Item) -> Generator[None, object, object]:
+    """At faulthandler_timeout, after pytest's stack dump, a dump of this process's child processes.
+
+    A main thread blocked on a subprocess looks the same in the stack dump whether the child is spinning, blocked, or
+    gone while another process holds its pipes. The SIGUSR1 dump in CI also skips Windows.
+    """
+    timer: threading.Timer | None = None
+    timeout = float(item.config.getini('faulthandler_timeout') or 0)
+    if timeout > 0:
+        fd = item.config.stash[fault_handler_stderr_fd_key]
+        timer = threading.Timer(timeout, _dump_child_processes, args=(item, fd))
+        timer.daemon = True
+        timer.start()
+    try:
+        return (yield)  # noqa: B901
+    finally:
+        if timer is not None:
+            timer.cancel()
+
+
+def _dump_child_processes(item: pytest.Item, fd: int) -> None:
+    children = psutil.Process().children(recursive=True)
+    cpu_before: dict[int, float] = {}
+    for child in children:
+        with contextlib.suppress(psutil.Error):
+            cpu_before[child.pid] = sum(child.cpu_times()[:2])
+    # CPU time rising over the interval means a busy child; flat means a blocked one
+    time.sleep(10)
+    lines = [f'Child processes of pid {os.getpid()} in {item.nodeid}:']
+    for child in children:
+        try:
+            with child.oneshot():
+                cpu = f'{cpu_before.get(child.pid, float("nan")):.1f}s -> {sum(child.cpu_times()[:2]):.1f}s'
+                lines.append(
+                    f'  pid {child.pid} {child.status()}, cpu {cpu}, {child.num_threads()} threads: '
+                    + ' '.join(child.cmdline())
+                )
+        except psutil.Error as e:
+            lines.append(f'  pid {child.pid}: {e!r}')
+    if len(children) == 0:
+        lines.append('  none')
+    with contextlib.suppress(OSError):
+        os.write(fd, ('\n'.join(lines) + '\n').encode())
+
+
 def pytest_runtest_teardown(item: pytest.Item) -> None:
     if IN_CI:
         _free_disk_space()
```

---

### Incident Patch 3: `cb05f733` (2026-11-17)
**Commit Message**: Stream conduit rows into a single insert plan (#1956)

An insert from a source with several record batches (Parquet row groups
or files, Hugging Face datasets) created one version per batch on the
table and on every view below it. `revert()` undid only the last batch,
the intermediate versions were states no operation produced, and every
view was loaded once per batch.

**Cause.** `InsertableTable._insert_table_data_source()` called
`TableVersion.insert()` once per `TableDataConduit.valid_row_batch()`
batch.

**Fix.** The batches are gone at the source:
- `TableDataConduit.rows()` yields one row dict at a time. Parquet
streams `iter_tuples2()` without `list()`; Hugging Face still converts
each Arrow chunk column-wise, then yields rows from the converted
columns; pandas, row-dict and Pydantic sources yield rows prepared
before the plan runs (see below).
- The new `RowDataNode` turns that stream into `DataRowBatch`es of
`ctx.batch_size` rows (1024 for inserts, the value `SqlDataNode` uses; 0
still means a single batch, which `compute()` relies on). It replaces
`InMemoryDataNode`, since a list of rows is just another stream.
- The whole insert is one plan, so `TableVersion.insert()` c

**File**: `pixeltable/catalog/insertable_table.py` (modified, +9/-20)
```diff
@@ -161,11 +161,10 @@ def _insert_table_data_source(
         return_rows: bool = False,
         skip_existing_keys: bool = False,
     ) -> pxt.UpdateStatus:
-        """Insert row batches into this table from a `TableDataConduit`."""
+        """Insert the rows of a `TableDataConduit` into this table."""
         from pixeltable.io.table_data_conduit import QueryTableDataConduit
 
         start_ts = time.perf_counter()
-        status = pxt.UpdateStatus()
         query = data_source.pxt_query if isinstance(data_source, QueryTableDataConduit) else None
         read_tbl_keys = query.referenced_tbl_keys() if query is not None else None
         # ON CONFLICT DO NOTHING skips a concurrent writer's key only under READ COMMITTED, not REPEATABLE READ
@@ -180,24 +179,14 @@ def _insert_table_data_source(
             # in on_error='abort' mode the exec raises the internal ExprEvalError on the first failing cell;
             # convert it to a user-facing Error (on_error='ignore' records per-cell errors and never raises)
             try:
-                if query is not None:
-                    status += self._tbl_version.get().insert(
-                        source=None,
-                        query=query,
-                        print_stats=print_stats,
-                        fail_on_exception=fail_on_exception,
-                        skip_existing_keys=skip_existing_keys,
-                    )
-                else:
-                    for row_batch in data_source.valid_row_batch():
-                        status += self._tbl_version.get().insert(
-                            source=row_batch,
-                            query=None,
-                            print_stats=print_stats,
-                            fail_on_exception=fail_on_exception,
-                            return_rows=return_rows,
-                            skip_existing_keys=skip_existing_keys,
-                        )
+                status = self._tbl_version.get().insert(
+                    source=data_source.rows() if query is None else None,
+                    query=query,
+                    print_stats=print_stats,
+                    fail_on_exception=fail_on_exception,
+                    return_rows=return_rows,
+                    skip_existing_keys=skip_existing_keys,
+                )
             except excs.ExprEvalError as e:
                 excs.raise_from_expr_eval_err(e)
 
```

**File**: `pixeltable/catalog/insertable_table_proxy.py` (modified, +7/-4)
```diff
@@ -90,7 +90,9 @@ def insert(
                 data_source.src_pk = []
                 data_source.infer_schema()
                 data_source.prepare_for_insert_into_table()
-                rows = self._convert_local_paths(row for batch in data_source.valid_row_batch() for row in batch)
+                # TODO: this materializes all rows of the source to send them in one request; streaming them to the
+                # daemon would bound the client's memory
+                rows = self._convert_local_paths(data_source.rows())
                 return self._dispatch(
                     'insert',
                     {
@@ -148,9 +150,10 @@ def insert(
         elif isinstance(data_source, PandasTableDataConduit):
             data_source.src_pk = []
             data_source.infer_schema()
-            data_source.prepare_for_insert_into_table()  # populates valid_rows (df -> pxt-native dicts)
-            assert data_source.valid_rows is not None
-            rows = data_source.valid_rows
+            data_source.prepare_for_insert_into_table()
+            # TODO: this materializes all rows of the source to send them in one request; streaming them to the
+            # daemon would bound the client's memory
+            rows = list(data_source.rows())
         else:
             raise excs.RequestError(
                 excs.ErrorCode.UNSUPPORTED_OPERATION,
```

**File**: `pixeltable/catalog/local_table.py` (modified, +3/-1)
```diff
@@ -288,7 +288,9 @@ def compute(
                 # the compute plan checks for the required columns that the outputs read
                 data_source.reqd_col_names.clear()
                 data_source.prepare_for_insert_into_table()
-                input_rows = [row for batch in data_source.valid_row_batch() for row in batch]
+                # TODO: this materializes all input rows; streaming them into the compute plan (RowDataNode accepts a
+                # stream) would bound memory, but create_compute_plan() currently validates and filters a list
+                input_rows = list(data_source.rows())
 
                 output_cols = path.columns()
                 if output_md is not None:
```

**File**: `pixeltable/catalog/table_proxy.py` (modified, +3/-1)
```diff
@@ -402,7 +402,9 @@ def _pydantic_to_rows(
         if not check_required:
             converter.reqd_col_names.clear()
         converter.prepare_for_insert_into_table()
-        return converter.pxt_rows
+        # TODO: this materializes all rows to send them in one request; streaming them to the daemon would bound the
+        # client's memory
+        return list(converter.rows())
 
     def update(
         self,
```

**File**: `pixeltable/catalog/table_version.py` (modified, +2/-2)
```diff
@@ -1295,15 +1295,15 @@ def _create_schema_version(self) -> None:
 
     def insert(
         self,
-        source: list[dict[str, Any]] | SqlDataSource | None,
+        source: Iterable[dict[str, Any]] | SqlDataSource | None,
         query: Query | None,
         print_stats: bool = False,
         fail_on_exception: bool = True,
         return_rows: bool = False,
         skip_existing_keys: bool = False,
     ) -> UpdateStatus:
         """
-        Insert rows into this table from an explicit list of dicts, a Query, or a SqlDataSource.
+        Insert rows into this table from a stream of row dicts, a Query, or a SqlDataSource.
 
         With skip_existing_keys, a row whose primary key is already in the table is not inserted.
         """
```

**File**: `pixeltable/exec/__init__.py` (modified, +1/-1)
```diff
@@ -12,8 +12,8 @@
 from .exec_plan import ExecPlan
 from .expr_eval import ExprEvalNode
 from .filter_node import FilterNode
-from .in_memory_data_node import InMemoryDataNode
 from .object_store_save_node import ObjectStoreSaveNode
+from .row_data_node import RowDataNode
 from .row_update_node import RowUpdateNode
 from .sql_data_node import SqlDataNode
 from .sql_node import SqlAggregationNode, SqlJoinNode, SqlLookupNode, SqlNode, SqlSampleNode, SqlScanNode
```

**File**: `pixeltable/exec/cache_prefetch_node.py` (modified, +23/-7)
```diff
@@ -25,19 +25,20 @@ class CachePrefetchNode(ExecNode):
     """Brings files with external URLs into the cache
 
     TODO:
-    - Process a row at a time and limit the number of in-flight rows to control memory usage
     - Create asyncio.Tasks to consume our input in order to increase concurrency.
     """
 
     QUEUE_DEPTH_HIGH_WATER = 50  # target number of in-flight requests
     QUEUE_DEPTH_LOW_WATER = 20  # target number of in-flight requests
     BATCH_SIZE = 16
+    MAX_BUFFERED_ROWS = 2048
     MAX_WORKERS = 15
 
     retain_input_order: bool  # if True, return rows in the exact order they were received
     file_col_info: list[exprs.ColumnSlotIdx]
 
     # execution state
+    num_input_rows: int
     num_returned_rows: int
     progress_reporter: ProgressReporter | None
 
@@ -71,7 +72,13 @@ def __init__(
     def queued_work(self) -> int:
         return len(self.in_flight_requests)
 
+    @property
+    def num_buffered_rows(self) -> int:
+        # we can't rely on ready_rows because it includes placeholders for in-flight rows
+        return self.num_input_rows - self.num_returned_rows
+
     def _init_exec_state(self) -> None:
+        self.num_input_rows = 0
         self.num_returned_rows = 0
         self.ready_rows = deque()
         self.in_flight_rows = {}
@@ -91,6 +98,8 @@ async def get_input_batch(self, input_iter: AsyncIterator[DataRowBatch]) -> Data
             input_batch = await anext(input_iter)
             if input_batch is None:
                 self.input_finished = True
+            else:
+                self.num_input_rows += len(input_batch)
             return input_batch
         except StopAsyncIteration:
             self.input_finished = True
@@ -100,22 +109,29 @@ async def __aiter__(self) -> AsyncGenerator[DataRowBatch, None]:
         async with contextlib.aclosing(aiter(self.input)) as input_iter:
             with futures.ThreadPoolExecutor(max_workers=self.MAX_WORKERS) as executor:
                 while True:
-                    # Create work to fill the queue to the high water mark,
-                    # without overrunning the in-flight row limit.
-                    while not self.input_finished and self.queued_work < self.QUEUE_DEPTH_HIGH_WATER:
+                    # Fetch whole batches; buffered rows can overshoot the limit by less than one input batch.
+                    while (
+                        not self.input_finished
+                        and self.queued_work < self.QUEUE_DEPTH_HIGH_WATER
+                        and self.num_buffered_rows < self.MAX_BUFFERED_ROWS
+                    ):
                         input_batch = await self.get_input_batch(input_iter)
                         if input_batch is not None:
                             self.__process_input_batch(input_batch, executor)
 
-                    # Wait for enough completions to enable more queueing or if we're done
+                    # Wait for queue capacity, end-of-input work, or a blocked output at the row limit.
                     while self.queued_work > self.QUEUE_DEPTH_LOW_WATER or (
-                        self.input_finished and self.queued_work > 0
+                        self.queued_work > 0
+                        and (
+                            self.input_finished
+                            or (self.num_buffered_rows >= self.MAX_BUFFERED_ROWS and not self.__has_ready_batch())
+                        )
                     ):
                         done, _ = futures.wait(self.in_flight_requests, return_when=futures.FIRST_COMPLETED)
                         self.__process_completions(done, ignore_errors=self.ctx.ignore_errors)
 
                     # Emit results to meet batch size requirements or empty the in-flight row queue
-                    if self.__has_ready_batch() or (
+                    while self.__has_ready_batch() or (
                         len(self.ready_rows) > 0 and self.input_finished and self.queued_work == 0
                     ):
                         # create DataRowBatch from the first BATCH_SIZE ready rows
```

**File**: `pixeltable/exec/object_store_save_node.py` (modified, +23/-9)
```diff
@@ -32,14 +32,12 @@ class ObjectStoreSaveNode(ExecNode):
             src_path -> [dest1, dest2, ...]
                 dest1: [row_location1, row_location2, ...]
     Paths with multiple destinations are removed from the TempStore only after all destination copies are complete.
-
-    TODO:
-    - Process a row at a time and limit the number of in-flight rows to control memory usage
     """
 
     QUEUE_DEPTH_HIGH_WATER = 50  # target number of in-flight requests
     QUEUE_DEPTH_LOW_WATER = 20  # target number of in-flight requests
     BATCH_SIZE = 16
+    MAX_BUFFERED_ROWS = 2048
     MAX_WORKERS = 15
 
     class WorkDesignator(NamedTuple):
@@ -64,6 +62,7 @@ class WorkItem(NamedTuple):
     file_col_info: list[exprs.ColumnSlotIdx]
 
     # execution state
+    num_input_rows: int
     num_returned_rows: int
 
     # ready_rows: rows that are ready to be returned, ordered by row idx;
@@ -103,7 +102,13 @@ def __init__(self, file_col_info: list[exprs.ColumnSlotIdx], input: ExecNode, re
     def queued_work(self) -> int:
         return len(self.in_flight_requests)
 
+    @property
+    def num_buffered_rows(self) -> int:
+        # we can't rely on ready_rows because it includes placeholders for in-flight rows
+        return self.num_input_rows - self.num_returned_rows
+
     def _init_exec_state(self) -> None:
+        self.num_input_rows = 0
         self.num_returned_rows = 0
         self.ready_rows = deque()
         self.in_flight_rows = {}
@@ -123,6 +128,8 @@ async def get_input_batch(self, input_iter: AsyncIterator[DataRowBatch]) -> Data
             input_batch = await anext(input_iter)
             if input_batch is None:
                 self.input_finished = True
+            else:
+                self.num_input_rows += len(input_batch)
             return input_batch
         except StopAsyncIteration:
             self.input_finished = True
@@ -132,22 +139,29 @@ async def __aiter__(self) -> AsyncGenerator[DataRowBatch, None]:
         async with contextlib.aclosing(aiter(self.input)) as input_iter:
             with futures.ThreadPoolExecutor(max_workers=self.MAX_WORKERS) as executor:
                 while True:
-                    # Create work to fill the queue to the high water mark,
-                    # without overrunning the in-flight row limit.
-                    while not self.input_finished and self.queued_work < self.QUEUE_DEPTH_HIGH_WATER:
+                    # Fetch whole batches; buffered rows can overshoot the limit by less than one input batch.
+                    while (
+                        not self.input_finished
+                        and self.queued_work < self.QUEUE_DEPTH_HIGH_WATER
+                        and self.num_buffered_rows < self.MAX_BUFFERED_ROWS
+                    ):
                         input_batch = await self.get_input_batch(input_iter)
                         if input_batch is not None:
                             self.__process_input_batch(input_batch, executor)
 
-                    # Wait for enough completions to enable more queueing or if we're done
+                    # Wait for queue capacity, end-of-input work, or a blocked output at the row limit.
                     while self.queued_work > self.QUEUE_DEPTH_LOW_WATER or (
-                        self.input_finished and self.queued_work > 0
+                        self.queued_work > 0
+                        and (
+                            self.input_finished
+                            or (self.num_buffered_rows >= self.MAX_BUFFERED_ROWS and not self.__has_ready_batch())
+                        )
                     ):
                         done, _ = futures.wait(self.in_flight_requests, return_when=futures.FIRST_COMPLETED)
                         self.__process_completions(done)
 
                     # Emit results to meet batch size requirements or empty the in-flight row queue
-                    if self.__has_ready_batch() or (
+                    while self.__has_ready_batch() or (
                         len(self.ready_rows) > 0 and self.input_finished and self.queued_work == 0
                     ):
                         # create DataRowBatch from the first BATCH_SIZE ready rows
```

#### Recent Merged Pull Requests:
- **PR #1988** (2026-11-18): Don't fail closing the Parallel MCP client when its connection task ends cancelled (anyio 4.16) (@aaron-siegel)
- **PR #1983** (2026-11-18): [PXT-1795] Fix FastAPIRouter docstring to reflect both use cases (@sergey-mkhitaryan)
- **PR #1976** (2026-11-17): Select notebook tests with the pytest test-tier markers (@aaron-siegel)
- **PR #1975** (2026-11-17): Dump a hung test's child processes at faulthandler_timeout (@aaron-siegel)
- **PR #1974** (2026-11-17): Raise the proxy daemon's keep-alive to 60 s so a stall can't reset the next request (@aaron-siegel)
- **PR #1972** (2026-11-17): Run every ffmpeg invocation with -nostdin and stdin=DEVNULL (@aaron-siegel)

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

## X. Run every ffmpeg invocation with -nostdin and stdin=DEVNULL

**RULE**:
When implementing operations in `pixeltable/env.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pixeltable/pixeltable. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `34cb37cd`: Run every ffmpeg invocation with -nostdin and stdin=DEVNULL. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `pixeltable/env.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
        from pixeltable.utils.av import run_ffmpeg

            result = run_ffmpeg(['-encoders'], timeout=10)
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
import subprocess
            result = subprocess.run(['ffmpeg', '-encoders'], capture_output=True, text=True, timeout=10, check=True)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `34cb37cd` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
