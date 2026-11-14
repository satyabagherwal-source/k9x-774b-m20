# Agent Contract: Agent Contract: pixeltable/pixeltable Autonomous Specialist Persona

<!-- PROVENANCE_START
{
  "source_repository": "pixeltable/pixeltable",
  "source_url": "https://github.com/pixeltable/pixeltable",
  "source_version": "941d38df",
  "license": "Apache-2.0",
  "timestamp": "2026-11-14T05:46:41.071Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-pixeltable-pixeltable",
  "canonical_classification": "agent_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pixeltable/pixeltable](https://github.com/pixeltable/pixeltable) (Revision: `941d38df`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-14T05:46:41.071Z`  
> **Learning ID**: `learn-github-pixeltable-pixeltable`


## 1. Agent Role & Persona Contract
- **Role Identifier**: `pixeltable-pixeltable-specialist`
- **Governing Capability**: Autonomous execution and domain-specialized problem resolution.
- **Trust Boundary**: Reads and modifies only authorized workspace resources.

## 2. Operational Capabilities
# Forensic Learning Record (Deep Inspection): pixeltable/pixeltable

> **Canonical Artifact**: `07_PROJECT_LEARNING/pixeltable-pixeltable-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pixeltable/pixeltable](https://github.com/pixeltable/pixeltable))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-14T05:46:39.862Z  
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
- **Issue #1957** (2026-11-13): **Rename TableDataConduit to SourceAdapter**
  *Symptoms*: **Stacked on #1956.** Until #1956 merges, this PR also shows its commits; the rename is only the last commit, https://github.com/pixeltable/pixeltable/pull/1957/commits/fff442aedc4e8cf21c23aa06c3f0e434168a173d.  `TableDataConduit` adapts a user-supplied `TableDataSource` for Pixeltable: it infers a schema for `create_table()`, validates the source against a target table, and yields its rows (`valid_rows()`, after #1956). "Conduit" only says that data flows through it; this renames it after its role.  | Before | After | |---|---| | `pixeltable/io/table_data_conduit.py` | `pixeltable/io/source_adapter.py` | | `TableDataConduit` | `SourceAdapter` | | `TableDataConduitFormat` | `SourceFormat` | | `QueryTableDataConduit`, `RowDataTableDataConduit`, `PandasTableDataConduit`, `CSVTableDataConduit`, `ExcelTableDataConduit`, `JsonTableDataConduit`, `HFTableDataConduit`, `ParquetTableDataConduit`, `PydanticTableDataConduit` | `QueryAdapter`, `RowDataAdapter`, `PandasAdapter`, `CSVAdapter`, `ExcelAdapter`, `JsonAdapter`, `HFAdapter`, `ParquetAdapter`, `PydanticAdapter` |  Names with "DataSource" were avoided because `TableDataSource` and `SqlDataSource` already name the raw input. The classes are internal (not exported from `pixeltable` or `pixeltable.io`), so there is no public API change.  No behavior change. Local runs with `-k "not cloud"`: `test_table`, `test_view`, `tests/io/`, `test_types`, `test_query`, `test_proxy_daemon`, `serving/test_fastapi` (888 passed).  🤖 Generated with

- **Issue #1955** (2026-11-13): **Write the default config atomically and require init_env for tests that reach Env**
  *Symptoms*: ## Problem  [Run 43480825714](https://github.com/pixeltable/pixeltable/actions/runs/43480825714/job/132076789915) (`standard, macos-15, 3.11`, the merge group for #1945) failed in `TestAnthropicTypedDictAdherence::test_mirrors` with `pixeltable/file_cache_size_g is missing from configuration`. Two things combined:  1. **The default config isn't written atomically.** When `config.toml` doesn't exist, `Config` creates it with `open(path, 'w')` followed by `toml.dump()`. A process that reads it between the two sees an empty file and caches a config with no `file_cache_size_g`. On a fresh runner, the xdist workers all start at once and race on `~/.pixeltable/config.toml`. 2. **#1855 added 9 tests that reach `Env.get()` without `init_env`**, through `skip_test_if_not_installed()`. `test_mirrors` was gw2's first test, so it read the shared config outside `init_env`'s file lock while gw0 and gw1 were creating it. #1855's own merge-queue run passed because a different test ran first.  Locally, with 3 processes starting at once against an empty home, 25 of 180 processes read an empty config.  ## Changes  - `Config` writes the default config with `atomic_write()` (a unique temp file renamed into place), so no process reads a partial file. Users who start several Pixeltable processes on a fresh install could hit the same race. Because `atomic_write()` uses `mkstemp`, a new default config is created with mode 0600 rather than 0644. - `tests/conftest.py` fails any test that reaches `Env.g

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

### Incident Patch 1: `b907dcb3` (2026-11-13)
**Commit Message**: Write the default config atomically and require init_env for tests that reach Env (#1955)

## Problem

[Run
43480825714](https://github.com/pixeltable/pixeltable/actions/runs/43480825714/job/132076789915)
(`standard, macos-15, 3.11`, the merge group for #1945) failed in
`TestAnthropicTypedDictAdherence::test_mirrors` with
`pixeltable/file_cache_size_g is missing from configuration`. Two things
combined:

1. **The default config isn't written atomically.** When `config.toml`
doesn't exist, `Config` creates it with `open(path, 'w')` followed by
`toml.dump()`. A process that reads it between the two sees an empty
file and caches a config with no `file_cache_size_g`. On a fresh runner,
the xdist workers all start at once and race on
`~/.pixeltable/config.toml`.
2. **#1855 added 9 tests that reach `Env.get()` without `init_env`**,
through `skip_test_if_not_installed()`. `test_mirrors` was gw2's first
test, so it read the shared config outside `init_env`'s file lock while
gw0 and gw1 were creating it. #1855's own merge-queue run passed because
a different test ran first.

Locally, with 3 processes starting at once against an empty home, 25 of
180 processes read an empty config.

## Chang

**File**: `.github/instructions/tests.instructions.md` (modified, +4/-0)
```diff
@@ -10,6 +10,10 @@ applyTo: "tests/**"
 - Prefer `db_root: DatabaseRoot` and `db_root.make_catalog_path()` for portable catalog tests.
   `uses_db` and plain paths are valid for in-process tests; they require
   `@pytest.mark.db_roots('local', reason='...')`. The reason explains the restriction or is `TODO: convert`.
+- A test that reaches `Env.get()`, directly or through a helper such as `skip_test_if_not_installed()`,
+  requests `init_env`; `uses_db` and `db_root` include it. Without it, the test would use whatever an earlier
+  test on its xdist worker set up, or the developer's real Pixeltable home and database when it runs first, so
+  `tests/conftest.py` fails such a test.
 - Use `pxt_raises(..., match=...)` for Pixeltable errors, and `pytest.raises(..., match=...)` for other
   exceptions. Verify meaningful error text.
 - New tests making live third-party model/service calls need `remote_api` and `very_expensive`; mocked
```

**File**: `pixeltable/config.py` (modified, +3/-1)
```diff
@@ -20,6 +20,7 @@
 
 from pixeltable import exceptions as excs
 from pixeltable.service.resources import DatabaseCapacity, ServiceResources, UdfResources
+from pixeltable.utils.file_io import atomic_write
 
 if TYPE_CHECKING:
     from pixeltable import catalog
@@ -597,7 +598,8 @@ def __load_home_config(self) -> dict[str, dict[str, tuple[Any, Path]]]:
 
         else:
             config_dict = self.__create_default_config(self.__config_file)
-            with open(self.__config_file, 'w', encoding='utf-8') as stream:
+            # a process starting at the same time must never read a partial file
+            with atomic_write(self.__config_file, mode='w', encoding='utf-8') as stream:
                 try:
                     toml.dump(config_dict, stream)
                 except Exception as exc:
```

**File**: `tests/conftest.py` (modified, +34/-1)
```diff
@@ -1,3 +1,4 @@
+import contextlib
 import ctypes
 import faulthandler
 import functools
@@ -102,10 +103,42 @@ def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
         )
 
 
-def pytest_runtest_setup(item: pytest.Item) -> None:
+@contextlib.contextmanager
+def _requires_init_env(item: pytest.Item) -> Iterator[None]:
+    """Fails a test that reaches Env.get() on its own thread without requesting init_env.
+
+    Such a test uses whatever environment an earlier test on its worker set up, or the developer's real home and
+    database when it runs first, so CI catches it only when it happens to run first.
+    """
+    if not isinstance(item, pytest.Function) or 'init_env' in item.fixturenames:
+        yield
+        return
+    get = Env.__dict__['get'].__func__
+    test_thread = threading.current_thread()
+
+    def guarded_get(cls: type[Env]) -> Env:
+        if threading.current_thread() is test_thread:
+            pytest.fail(f'{item.nodeid} reaches Env.get() without requesting the init_env fixture')
+        return get(cls)
+
+    with pytest.MonkeyPatch.context() as mp:
+        mp.setattr(Env, 'get', classmethod(guarded_get))
+        yield
+
+
+@pytest.hookimpl(wrapper=True)
+def pytest_runtest_setup(item: pytest.Item) -> Generator[None, None, None]:
     current_test = os.environ.get('PYTEST_CURRENT_TEST')
     _logger.info(f'Running Pixeltable test: {current_test}')
     _clear_model_caches()
+    with _requires_init_env(item):
+        yield
+
+
+@pytest.hookimpl(wrapper=True)
+def pytest_runtest_call(item: pytest.Item) -> Generator[None, None, None]:
+    with _requires_init_env(item):
+        yield
 
 
 def _clear_model_caches() -> None:
```

**File**: `tests/functions/test_anthropic.py` (modified, +1/-1)
```diff
@@ -89,7 +89,7 @@ def make_table(tools: pxt.Tools, tool_choice: pxt.ToolChoice) -> pxt.Table:
 class TestAnthropicTypedDictAdherence:
     """Detect drift between the TypedDict mirrors and the SDK Pydantic models. Doesn't need credentials."""
 
-    def test_mirrors(self) -> None:
+    def test_mirrors(self, init_env: None) -> None:
         skip_test_if_not_installed('anthropic')
         from anthropic.types import ContentBlock, Message, Usage
 
```

**File**: `tests/functions/test_openai.py` (modified, +8/-8)
```diff
@@ -972,7 +972,7 @@ def test_typed_paths(self, uses_db: None) -> None:
         for col in (t.chat_text, t.tool_name, t.resp_text, t.item_text):
             assert_type_eq(col.col_type, pxt.String | None)
 
-    def test_chat_completion(self) -> None:
+    def test_chat_completion(self, init_env: None) -> None:
         skip_test_if_not_installed('openai')
         from openai.types import completion_usage
         from openai.types.chat import (
@@ -1017,7 +1017,7 @@ def test_chat_completion(self) -> None:
             ]
         )
 
-    def test_response(self) -> None:
+    def test_response(self, init_env: None) -> None:
         skip_test_if_not_installed('openai')
         import typing
 
@@ -1054,7 +1054,7 @@ def test_response(self) -> None:
             synth=frozenset({'output_text'}),
         )
 
-    def test_exact_mirror_types(self) -> None:
+    def test_exact_mirror_types(self, init_env: None) -> None:
         """JsonType equality for TypedDicts that are exact mirrors of an SDK Pydantic model."""
         skip_test_if_not_installed('openai')
         from openai.types import (
@@ -1096,7 +1096,7 @@ def test_exact_mirror_types(self) -> None:
                 f'{ours.__name__} drifted from {sdk.__module__}.{sdk.__name__}:\n  ours: {ours_jt}\n  sdk:  {sdk_jt}'
             )
 
-    def test_transcription_response(self) -> None:
+    def test_transcription_response(self, init_env: None) -> None:
         """TranscriptionResponse unions Transcription + TranscriptionVerbose; we add synth srt/vtt and
         re-type usage as plain dict to avoid committing to one variant of the SDK Usage union."""
         skip_test_if_not_installed('openai')
@@ -1134,7 +1134,7 @@ def test_transcription_response(self) -> None:
         # every field is path-dependent
         assert ours_optional == frozenset(ours_fields.keys())
 
-    def test_translation_response(self) -> None:
+    def test_translation_response(self, init_env: None) -> None:
         """TranslationResponse unions Translation + TranslationVerbose; we add synth srt/vtt."""
         skip_test_if_not_installed('openai')
         from openai.types.audio.translation import Translation
@@ -1160,7 +1160,7 @@ def test_translation_response(self) -> None:
 
         assert ours_optional == frozenset(ours_fields.keys())
 
-    def test_decision_response(self) -> None:
+    def test_decision_response(self, init_env: None) -> None:
         """DecisionResponse mirrors Decision except for its flattened answer variants."""
         skip_test_if_not_installed('openai')
         from openai.types.decision import Decision
@@ -1177,7 +1177,7 @@ def test_decision_response(self) -> None:
                 f'DecisionResponse field {name!r} drifted: ours={ours_fields[name]} sdk={sdk_fields[name]}'
             )
 
-    def test_decision_answer(self) -> None:
+    def test_decision_answer(self, init_env: None) -> None:
         """DecisionAnswer flattens the SDK's four answer variants into one TypedDict."""
         skip_test_if_not_installed('openai')
         from openai.types import decision as sdk_decision
@@ -1212,7 +1212,7 @@ def test_decision_answer(self) -> None:
         assert set(ours_fields) == set().union(*(v.model_fields for v in probability_variants))
         assert ours_optional == {'label'}
 
-    def test_images_response(self) -> None:
+    def test_images_response(self, init_env: None) -> None:
         """ImagesResponse mirrors SDK ImagesResponse field-for-field, except data is non-null
         (we guarantee a populated list in _decode_image_response), and fields that newer SDKs added are optional."""
         skip_test_if_not_installed('openai')
```

**File**: `tests/pixeltable_cli/test_service.py` (modified, +1/-0)
```diff
@@ -2150,6 +2150,7 @@ class TestServiceOtel:
     )
     def test_run_otel(
         self,
+        init_env: None,
         tmp_path: pathlib.Path,
         monkeypatch: pytest.MonkeyPatch,
         excluded_urls_env: dict[str, str],
```

**File**: `tests/serving/test_hosted_openapi.py` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 
 class TestHostedOpenapi:
-    def test_gateway_security_only_on_hosted_schema(self) -> None:
+    def test_gateway_security_only_on_hosted_schema(self, init_env: None) -> None:
         skip_test_if_not_installed('fastapi')
         import fastapi
         from fastapi.security import HTTPBasic
```

**File**: `tests/serving/test_prepare_project.py` (modified, +1/-1)
```diff
@@ -184,7 +184,7 @@ def test_pinned_release(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -
 
 
 class TestUnpack:
-    def test_round_trip(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
+    def test_round_trip(self, init_env: None, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
         """Unpacking an archive yields the project it was packaged from, whatever shapes its files take.
 
         unpack_project_archive() checks the unpacked project against the served digest, so serving this
```

---

### Incident Patch 2: `42be2c00` (2026-11-13)
**Commit Message**: Fix diffusers pipeline placement on CUDA in text_to_image and image_to_image (#1953)

## Summary

`text_to_image()` and `image_to_image()` failed on every GPU with
`NotImplementedError: auto not supported. Supported strategies are:
balanced, cuda, cpu`. This PR removes `device_map` from their
`from_pretrained` calls and passes `torch_dtype` instead of `dtype`.
These UDFs now load their pipelines the same way `image_to_video()`
already does.

Without `device_map`, `enable_model_cpu_offload()` is the only thing
that puts these pipelines on CUDA. In all three diffusers UDFs it ran
inside `try: ... except Exception: pass`, so a failure would leave the
pipeline on CPU. It now runs outside any `try`. The `try` also guarded
`enable_memory_efficient_attention()`, which no diffusers class defines,
so that call is gone.

This bug isn't new for GPU users. It showed up because #1900 runs the
Hugging Face tests on the weekly `ubuntu-small-t4` job, where
`test_text_to_image` and `test_image_to_image` failed in run
43367048923. CPU runners never pass a `device_map`, so they passed.

## Why

In diffusers 0.39.0 (the `uv.lock` version):

- **`'auto'` is never accepted.** `DiffusionPipeline.from_pre

**File**: `pixeltable/functions/huggingface.py` (modified, +8/-25)
```diff
@@ -1706,19 +1706,13 @@ def text_to_image(
         model_id,
         AutoPipelineForText2Image.from_pretrained,
         device=device,
-        dtype=torch.float16 if device == 'cuda' else torch.float32,
-        device_map='auto' if device == 'cuda' else None,
+        torch_dtype=torch.float16 if device == 'cuda' else torch.float32,
         safety_checker=None,
         requires_safety_checker=False,
     )
 
-    try:
-        if device == 'cuda' and hasattr(pipeline, 'enable_model_cpu_offload'):
-            pipeline.enable_model_cpu_offload()
-        if hasattr(pipeline, 'enable_memory_efficient_attention'):
-            pipeline.enable_memory_efficient_attention()
-    except Exception:
-        pass  # Ignore optimization failures
+    if device == 'cuda':
+        pipeline.enable_model_cpu_offload()
 
     generator = None if seed is None else torch.Generator(device=device).manual_seed(seed)
 
@@ -1906,19 +1900,13 @@ def image_to_image(
         model_id,
         AutoPipelineForImage2Image.from_pretrained,
         device=device,
-        dtype=torch.float16 if device == 'cuda' else torch.float32,
-        device_map='auto' if device == 'cuda' else None,
+        torch_dtype=torch.float16 if device == 'cuda' else torch.float32,
         safety_checker=None,
         requires_safety_checker=False,
     )
 
-    try:
-        if device == 'cuda' and hasattr(pipeline, 'enable_model_cpu_offload'):
-            pipeline.enable_model_cpu_offload()
-        if hasattr(pipeline, 'enable_memory_efficient_attention'):
-            pipeline.enable_memory_efficient_attention()
-    except Exception:
-        pass  # Ignore optimization failures
+    if device == 'cuda':
+        pipeline.enable_model_cpu_offload()
 
     generator = None if seed is None else torch.Generator(device=device).manual_seed(seed)
 
@@ -2162,13 +2150,8 @@ def image_to_video(
         variant='fp16' if device == 'cuda' else None,
     )
 
-    try:
-        if device == 'cuda' and hasattr(pipe, 'enable_model_cpu_offload'):
-            pipe.enable_model_cpu_offload()
-        if hasattr(pipe, 'enable_memory_efficient_attention'):
-            pipe.enable_memory_efficient_attention()
-    except Exception:
-        pass  # Ignore optimization failures
+    if device == 'cuda':
+        pipe.enable_model_cpu_offload()
 
     generator = None if seed is None else torch.Generator(device=device).manual_seed(seed)
 
```

**File**: `tests/functions/test_huggingface.py` (modified, +7/-8)
```diff
@@ -655,10 +655,9 @@ def test_text_to_image(self, uses_db: None) -> None:
         )
 
         validate_update_status(t.insert(prompt=test_prompt), expected_rows=1)
-        result = t.select(t.image).collect()[0]
-
-        # Verify we got an image
-        assert result['image'] is not None
+        img = t.select(t.image).collect()[0]['image']
+        assert img.size == (256, 256)
+        assert np.asarray(img).std() > 0
 
     @pytest.mark.xdist_group('large_model')
     def test_image_to_image(self, uses_db: None, sample_file_server: SampleFileServer) -> None:
@@ -683,10 +682,10 @@ def test_image_to_image(self, uses_db: None, sample_file_server: SampleFileServe
         validate_update_status(
             t.insert(img=sample_file_server.url(SAMPLE_IMAGE_FILE_PATH), prompt=test_prompt), expected_rows=1
         )
-        result = t.select(t.modified_image).collect()[0]
-
-        # Verify we got a modified image
-        assert result['modified_image'] is not None
+        res = t.select(t.modified_image, width=t.img.width, height=t.img.height).collect()[0]
+        img = res['modified_image']
+        assert img.size == (res['width'], res['height'])
+        assert np.asarray(img).std() > 0
 
     @pytest.mark.xdist_group('large_model')
     def test_image_to_video(self, uses_db: None, sample_file_server: SampleFileServer) -> None:
```

---

### Incident Patch 3: `dbe8f8b1` (2026-11-13)
**Commit Message**: [PXT-1767] Fix the notebooks++ and T4 failures in the weekly test run (#1934)

Fixes [PXT-1767](https://pixeltable.atlassian.net/browse/PXT-1767).
Supersedes #1929.

Fixes two failures in the weekly `tests` run on 2026-11-10 ([run
42735604741](https://github.com/pixeltable/pixeltable/actions/runs/42735604741)).

## notebooks++: invalid notebook JSON

The job failed on `video-generate-ai.ipynb` with "Notebook does not
appear to be JSON". Its setup cell ran `%pip install -qU pixeltable
"google-genai>=2.22"`. `scripts/prepare-nb-tests.sh --no-pip` strips pip
lines with `sed -E 's/%pip install [^"]*//'`, which stops at the escaped
quote and leaves invalid JSON.

The bound isn't needed. `-U` already installs the latest google-genai
(3.2.0 today), and `gemini.generate_video()` enforces the minimum itself
with `require_package('google.genai', min_version=[2, 22])`. The
notebook now installs `pixeltable google-genai` and lists `pip install
google-genai` under Requirements.

## standard, ubuntu-small-t4: `test_db_migration`

`test_db_migration` took 16 minutes on the T4 runner in the 2026-11-03
run. On 2026-11-10 it was still running at the 10-minute faulthandler
dump, its xdist worker went

**File**: `docs/release/howto/cookbooks/video/video-generate-ai.ipynb` (modified, +2/-2)
```diff
@@ -53,7 +53,7 @@
    "metadata": {},
    "outputs": [],
    "source": [
-    "%pip install -qU pixeltable \"google-genai>=2.22\""
+    "%pip install -qU pixeltable google-genai"
    ]
   },
   {
@@ -327,7 +327,7 @@
     "**Requirements:**\n",
     "\n",
     "- Google AI Studio API key (set `GEMINI_API_KEY`); Gemini Omni requires the Gemini Developer API\n",
-    "- `pip install \"google-genai>=2.22\"`"
+    "- `pip install google-genai`"
    ]
   },
   {
```

**File**: `tests/test_migration.py` (modified, +1/-0)
```diff
@@ -95,6 +95,7 @@ def test_convert_53_normalize(self) -> None:
 
     @rerun(reruns=3, reruns_delay=8)  # Deal with occasional concurrency issues
     @pytest.mark.skipif(platform.system() == 'Windows', reason='Does not run on Windows')
+    @pytest.mark.skipif('t4' in os.environ.get('PXTTEST_CI_OS', ''), reason='Too slow on t4 CI instances')
     def test_db_migration(self, init_env: None) -> None:
         skip_test_if_not_installed('transformers')
         # the dumps contain a sentence-mode string_splitter view, which needs spacy to compute inserted rows
```

#### Recent Merged Pull Requests:
- **PR #1957** (closed): Rename TableDataConduit to SourceAdapter (@sergey-mkhitaryan)
- **PR #1955** (2026-11-13): Write the default config atomically and require init_env for tests that reach Env (@aaron-siegel)
- **PR #1954** (2026-11-13): Dump the Postgres server's state before the CI test step times out (@aaron-siegel)
- **PR #1953** (2026-11-13): Fix diffusers pipeline placement on CUDA in text_to_image and image_to_image (@aaron-siegel)
- **PR #1952** (2026-11-13): Raise faulthandler_timeout to 30 minutes to stop macOS worker hangs (@aaron-siegel)
- **PR #1950** (2026-11-14): Make int % in SQL follow Python's sign convention (@sohailshk)

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

## X. Write the default config atomically and require init_env for tests that reach En

**RULE**:
When implementing operations in `.github/instructions/tests.instructions.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pixeltable/pixeltable. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b907dcb3`: Write the default config atomically and require init_env for tests that reach Env. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/instructions/tests.instructions.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
- A test that reaches `Env.get()`, directly or through a helper such as `skip_test_if_not_installed()`,
  requests `init_env`; `uses_db` and `db_root` include it. Without it, the test would use whatever an earlier
  test on its xdist worker set up, or the developer's real Pixeltable home and database when it runs first, so
  `tests/conftest.py` fails such a test.
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b907dcb3` are properly handled with clean fallback behavior.


## 3. Decision Protocol & Boundary Restrictions
- Must NOT delete canonical verification records without authorization.
- Must execute independent read-back verification after every mutation.
