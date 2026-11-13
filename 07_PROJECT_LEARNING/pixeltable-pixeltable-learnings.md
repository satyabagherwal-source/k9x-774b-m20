> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/pixeltable-pixeltable-learnings.md`  
> **Source**: github ([https://github.com/pixeltable/pixeltable](https://github.com/pixeltable/pixeltable))  
> **Source Version**: `506e2f7d`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T04:13:25.394Z  
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
> **Harvest Timestamp**: 2026-11-13T04:13:25.389Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pixeltable/pixeltable`
- **Description**: The backend agents build with - Multimodal database, orchestration, and serving in one file
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 1662 stars

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
            _evict_project_modules()
            # a file written after this process started is invisible to a finder that cached its directory
            importlib.invalidate_caches()
            return registry.import_module(name)
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
        file = getattr(resolved, '__file__', None)
        if file is None or not Path(file).resolve().is_relative_to(project_root):
            continue  # an installed module
        top_level = fn_path.split('.', maxsplit=1)[0]
        if _first_on_path(top_level) is None:
            errors.append(f'{fn_path}: {top_level!r} is not on sys.path')
    return errors


def udf_source_files(bases: list[model.TableModelMeta]) -> set[str]:
    """The local project files containing the udfs referenced by bases, relative to the project root."""
    project_root = Config.get().project_root
    assert project_ro
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1942** (2026-11-13): **Run 10 minutes of random-ops on pull requests**
  *Symptoms*: ## Why  Random-ops runs only in the merge queue (30 minutes) and in the nightly stress-tests workflow, so concurrency bugs it would catch surface only after a PR is queued. A shorter run on every PR push finds them earlier.  ## What  - `tool/ci_tool.py`: the `pull_request` matrix gains `random-ops, ubuntu-24.04, 3.11`. It is the merge queue's random-ops config (minimal `--no-dev` install, 12 workers in read/write mode, then the file cache stress test) with a 600-second run instead of 1800. The duration is a new `random_ops_seconds` matrix field, default 1800, so the merge queue, scheduled and dispatch runs are unchanged. - `.github/workflows/pytest.yml`: the "Run stress tests" step reads `matrix.random-ops-seconds` instead of a hard-coded `1800`, and the header comment lists the new PR job.  Expected cost per PR push: about 11-12 minutes on one free ubuntu-24.04 runner (setup took about 1 minute and the file cache stress test 15 seconds in today's merge queue run). As in the merge queue, the job prints random-ops stats to the console but does not upload `random-ops.log` as an artifact.  ## Validation  - `ruff format --check`, `ruff check` and `mypy` on `tool/ci_tool.py` and `tests/tool/test_ci_tool.py` - `pytest tests/tool/test_ci_tool.py`: 18 passed - `python tool/ci_tool.py generate-matrix`: `pull_request` yields 8 entries, including random-ops at 600 seconds; `merge_group` yields 18, with random-ops at 1800 - This PR's own checks run the new job  🤖 Generated with [Claude 
  **Post-Mortem & Fix Analysis**:
  > subsumed by #1900 

- **Issue #1940** (2026-11-12): **PXT-1768: Poll VLM Run generations instead of holding chat open**
  *Symptoms*: <!-- CURSOR_AGENT_PR_BODY_BEGIN --> ## Summary  Stop holding one HTTP request open for an entire VLM Run `generate_*` job. Submit via `POST /v1/agent/execute` (`batch=true`) and poll `GET /v1/agent/executions/{id}` until completion. A connection drop after the request has left this process is a non-retried `ExternalServiceError`. Mock the gateway `capability_violation` test so it does not depend on which inputs the live gateway currently rejects.  Jira: [PXT-1768](https://pixeltable.atlassian.net/browse/PXT-1768) Failing run: https://github.com/pixeltable/pixeltable/actions/runs/42735604741  #1931 was closed as overengineered. This is the same two nightly failures with a smaller diff: one `execute()` poll loop, no per-call deadline state, and two mocked `generate_document` tests plus the gateway mock.  ## Root cause  1. `generate_document` `POST`ed `openai/chat/completions` and waited on that single request. The vendor front end (`via: 1.1 google`) now closes idle requests after ~5 minutes with `httpx.ReadError('')`. That was `PROVIDER_ERROR`, which the scheduler retried (another billed job). 2. `TestVlmrunGateway.test_errors` assumed the live gateway would reject a `document_url` part for `qwen/qwen3.5-0.8b`. It now accepts that input.  ## Fix  `generate_*` uses submit-then-poll, bounded by the existing `deadline()` / `VLMRUN_TIMEOUT`. Artifacts are fetched with `execution_id`. `chat_completions` is unchanged. Retryable poll GET failures stay in the poll loop so they do not 

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

### Incident Patch 1: `11fbb87a` (2026-11-12)
**Commit Message**: Fix import block spacing in CI planner tests (#1936)

**File**: `.github/scripts/test_plan_claude_ci_fix.py` (modified, +0/-1)
```diff
@@ -11,7 +11,6 @@
 
 import plan_claude_ci_fix as plan
 
-
 RUN_9 = 'https://github.com/o/r/actions/runs/9'
 
 
```

---

### Incident Patch 2: `a002e949` (2026-11-12)
**Commit Message**: [1.0] Remove deprecated Required type marker (#1918)

Remove the deprecated `pxt.Required[T]` marker. Bare `T` already
declares a non-nullable column; use `T | None` for nullable columns.
Remove the marker's type-resolution branch and special mypy handling,
and delete its obsolete test assertions. Standard-library
`typing.Required` and `typing.NotRequired` continue to support TypedDict
fields.

UDFs pickled with `pxt.Required[...]` annotations by earlier versions no
longer load.

Backward compatibility is not a goal. This PR is part of the 1.0 API
cleanup, so it may break existing user code without a deprecation path.

Validation:
- 30 existing type/array tests passed against local and proxy catalogs;
cloud variants excluded.
- Ruff lint, import sorting, formatting, and checks of all 102 notebooks
passed.
- The separate model-definition mypy check passed. Full mypy reports the
same 28 installed dependency/stub errors as the baseline; the
OpenTelemetry check reports one missing typing marker.

Context:
https://pixeltable.slack.com/archives/C06T5MVJBSB/p1793897457834769

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `pixeltable/__init__.py` (modified, +0/-1)
```diff
@@ -61,7 +61,6 @@
     Image,
     Int,
     Json,
-    Required,
     String,
     Timestamp,
     Video,
```

**File**: `pixeltable/mypy/mypy_plugin.py` (modified, +0/-22)
```diff
@@ -53,8 +53,6 @@ def get_type_analyze_hook(self, fullname: str) -> Callable[[AnalyzeTypeContext],
         if fullname in self.__FULLNAME_MAP:
             subst_name = self.__FULLNAME_MAP[fullname]
             return lambda ctx: self.adjust_pxt_type(ctx, subst_name)
-        if fullname == _REQUIRED_FULLNAME:
-            return adjust_required_type
         return None
 
     def get_base_class_hook(self, fullname: str) -> Callable[[ClassDefContext], None] | None:
@@ -115,7 +113,6 @@ def plugin(version: str) -> type:
 _PXTITERATOR_FULLNAME = f'{pxt.PxtIterator.__module__}.{pxt.PxtIterator.__name__}'
 _FN_CALL_FULLNAME = f'{exprs.Expr.__module__}.{exprs.Expr.__name__}'
 _PXT_TYPE_FULLNAME = f'{_PxtType.__module__}.{_PxtType.__name__}'
-_REQUIRED_FULLNAME = f'{pxt.Required.__module__}.{pxt.Required.__name__}'
 _TABLE_MODEL_META_FULLNAME = f'{TableModelMeta.__module__}.{TableModelMeta.__name__}'
 
 
@@ -127,10 +124,6 @@ def make_pxt_type_subscriptable(ctx: ClassDefContext) -> None:
     type-check (as `Any`) in value positions such as schema dicts, we synthesize a metaclass whose
     `__getitem__(item) -> Any` mypy resolves the subscript through (only a *metaclass* `__getitem__` is honored for
     `Class[...]`; `__class_getitem__` and instance/classmethod `__getitem__` are not).
-
-    `Required` additionally must appear non-generic: while generic, mypy parses its argument as a type, so
-    `Required[Image[(300, 300)]]` fails ("Type expected within [...]") on the tuple before any hook runs. We clear
-    its type variables here; `adjust_required_type` keeps `Required[...]` working in annotation positions.
     """
     info = ctx.cls.info
     meta = ctx.api.basic_new_typeinfo('_PxtSubscriptMeta', ctx.api.named_type('builtins.type'), ctx.cls.line)
@@ -152,21 +145,6 @@ def make_pxt_type_subscriptable(ctx: ClassDefContext) -> None:
     meta_inst = Instance(meta, [])
     info.metaclass_type = meta_inst
     info.declared_metaclass = meta_inst
-    if info.fullname == _REQUIRED_FULLNAME:
-        info.type_vars = []
-        info.defn.type_vars = []
-        info.add_type_vars()
-
-
-def adjust_required_type(ctx: AnalyzeTypeContext) -> Type:
-    """
-    In an annotation position, resolve `Required[T]` to `T` (the marker only signifies non-nullability, which has no
-    bearing on mypy's view); a bare `Required` resolves to `Any`. This complements `make_pxt_type_subscriptable`,
-    which makes `Required` non-generic (so mypy no longer interprets `Required[...]` natively).
-    """
-    if ctx.type.args:
-        return ctx.api.analyze_type(ctx.type.args[0])
-    return AnyType(TypeOfAny.special_form)
 
 
 def create_model_base_class(ctx: DynamicClassDefContext) -> None:
```

**File**: `pixeltable/type_system.py` (modified, +1/-34)
```diff
@@ -11,7 +11,6 @@
 import typing
 import urllib.request
 import uuid
-import warnings
 from pathlib import Path
 from typing import Any, ClassVar, Iterable, Literal, Mapping, Sequence, Union, is_typeddict
 
@@ -360,19 +359,6 @@ def from_python_type(
                 )
                 if underlying is not None:
                     return underlying.copy(nullable=True)
-        elif origin is Required:
-            assert len(type_args) == 1
-            warnings.warn(
-                '`Required[T]` is deprecated and will be removed in a future version; use `T` instead. '
-                'Bare types such as `pxt.Int` are now non-nullable by default; use `pxt.Int | None` for a '
-                'nullable column.',
-                excs.PixeltableDeprecationWarning,
-                stacklevel=2,
-            )
-            underlying = cls.from_python_type(type_args[0], allow_builtin_types=allow_builtin_types)
-            if underlying is None:
-                return None
-            return underlying.copy(nullable=False)
         elif origin is typing.Required or origin is typing.NotRequired:
             # Required[T]/NotRequired[T] mark a TypedDict field's key presence (recorded in __optional_keys__), so
             # the field's value type is simply T
@@ -384,7 +370,7 @@ def from_python_type(
             if isinstance(parameters, ColumnType):
                 return parameters.copy(nullable=False)
         else:
-            # It's something other than T | None, Required[T], or an explicitly annotated type.
+            # It's something other than T | None, a TypedDict field qualifier, or an explicitly annotated type.
             # for non-generic types, get_origin returns None, so we use the type itself as the origin
             origin = origin or t
             if isinstance(origin, type):
@@ -1926,9 +1912,6 @@ def validate_media(self, val: Any) -> None:
         DocumentHandle.validate(val)
 
 
-T = typing.TypeVar('T')
-
-
 class _PxtType:
     """
     Base class for the Pixeltable type-hint family. Subclasses of this class are meant to be used as type hints, both
@@ -1950,22 +1933,6 @@ def as_col_type(cls, nullable: bool) -> ColumnType:
         raise NotImplementedError()
 
 
-class Required(_PxtType, typing.Generic[T]):
-    """
-    Deprecated marker class to indicate that a column is non-nullable in a schema definition.
-
-    Bare types such as `pxt.Int` are non-nullable, so `Required[T]` is equivalent to `T`. Use `T | None` to declare a
-    nullable column.
-    """
-
-    @classmethod
-    def as_col_type(cls, nullable: bool) -> ColumnType:
-        raise excs.RequestError(
-            excs.ErrorCode.INVALID_TYPE,
-            'Bare `Required` is not a valid type; use `Required[T]` for some valid type `T`.',
-        )
-
-
 String = typing.Annotated[str, StringType(nullable=False)]
 Int = typing.Annotated[int, IntType(nullable=False)]
 Float = typing.Annotated[float, FloatType(nullable=False)]
```

**File**: `tests/serving/test_fastapi.py` (modified, +2/-2)
```diff
@@ -688,7 +688,7 @@ def test_add_insert_route_image(
             orig_w, orig_h = img.size
         pxt.create_dir(p('test_serve'))
         # Unlike video.resize (which tolerates None width/height and preserves aspect ratio),
-        # image.resize requires concrete ints - so width and height must be Required, and every
+        # image.resize requires concrete ints - so width and height must be non-nullable, and every
         # insert (even the /rotate one, which doesn't care about them) has to supply them.
         t = pxt.create_table(
             p('test_serve/images'),
@@ -834,7 +834,7 @@ def test_add_insert_route_audio(
         # Use sample-16-bit.wav specifically so the mime type in upload mode is deterministic.
         audio_path = next(f for f in get_audio_files() if f.endswith('sample-16-bit.wav'))
         pxt.create_dir(p('test_serve'))
-        # factor and end_time are Required because multiply_volume's `factor` param must be non-None
+        # factor and end_time are non-nullable because multiply_volume's `factor` param must be non-None
         # on every insert (the `scaled` computed column runs on every row).
         t = pxt.create_table(
             p('test_serve/audios'),
```

**File**: `tests/test_types.py` (modified, +0/-7)
```diff
@@ -38,7 +38,6 @@
     IntType,
     Json,
     JsonType,
-    Required,
     String,
     StringType,
     Timestamp,
@@ -339,10 +338,6 @@ def test_from_python_type(self, init_env: None) -> None:
             assert ColumnType.from_python_type(py_type | None) == nullable_pxt_type
             assert ColumnType.from_python_type(None | py_type) == nullable_pxt_type  # noqa: RUF036
 
-            # `Required[T]` is deprecated, but still resolves to a non-nullable `T`
-            with pytest.warns(excs.PixeltableDeprecationWarning, match=r'`Required\[T\]` is deprecated'):
-                assert ColumnType.from_python_type(Required[py_type]) == non_nullable_pxt_type
-
             assert str(non_nullable_pxt_type) == string
             assert str(nullable_pxt_type) == f'{string} | None'
 
@@ -657,8 +652,6 @@ def test_json_type_errors(self, init_env: None) -> None:
     def test_type_errors(self, init_env: None) -> None:
         from .module_with_future_annotations import make_unresolvable_typed_dict
 
-        with pytest.raises(excs.RequestError, match='Bare `Required` is not a valid type'):
-            ColumnType.from_python_type(Required)
         with pxt_raises(
             pxt.ErrorCode.INVALID_TYPE,
             match=r"Cannot resolve the field types of TypedDict `Unresolvable`: name 'LocalFloat' is not defined",
```

#### Recent Merged Pull Requests:
- **PR #1942** (closed): Run 10 minutes of random-ops on pull requests (@aaron-siegel)
- **PR #1940** (closed): PXT-1768: Poll VLM Run generations instead of holding chat open (@pierrebrunelle)
- **PR #1939** (closed): Create one table version per insert, regardless of batch count (@sergey-mkhitaryan)
- **PR #1936** (2026-11-12): Fix import block spacing in CI planner tests (@sergey-mkhitaryan)
- **PR #1931** (closed): PXT-1768: Poll VLM Run generations instead of holding chat open (@pierrebrunelle)
- **PR #1930** (closed): PXT-1769: deselect test_db_migration on T4 and pin pytest-rerunfailures (@pierrebrunelle)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
