# Verification Protocol: Verification Protocol: Empirical Defect Shield for pixeltable-pixeltable-learnings

<!-- PROVENANCE_START
{
  "source_repository": "pixeltable-pixeltable-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T00:33:31.801Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-pixeltable-pixeltable-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pixeltable-pixeltable-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T00:33:31.801Z`  
> **Learning ID**: `LEARN-EVO-pixeltable-pixeltable-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `pixeltable-pixeltable-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/pixeltable-pixeltable-learnings.md`  
> **Source**: github ([https://github.com/pixeltable/pixeltable](https://github.com/pixeltable/pixeltable))  
> **Source Version**: `bf3ef159`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-20T00:33:26.432Z  
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
> **Harvest Timestamp**: 2026-11-20T00:33:26.426Z  
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
- **Issue #2017** (2026-11-20): **Take str | os.PathLike in the io export functions; accept a str path in export_lancedb()**
  *Symptoms*: Follow-up to #2004, from [Aaron's suggestion](https://github.com/pixeltable/pixeltable/pull/2004#discussion_r4633545711). The export functions took `str | Path` (or only `Path`) while the import functions (`import_csv()`, `import_excel()`) take `str | os.PathLike`. This switches the exports to `str | os.PathLike` so the io path parameters match.  ## Changes  - `export_parquet()`, `export_csv()` and `export_json()` annotate their path parameter as `str | os.PathLike`. Each already converts the argument with `Path(...)`, which accepts any `os.PathLike`, so runtime behavior is unchanged. - `export_lancedb()` took `db_uri: Path` and called `db_uri.exists()`, so a `str` failed with `AttributeError: 'str' object has no attribute 'exists'` (the same bug #2004 fixed in `export_parquet()`). It now takes `str | os.PathLike` and converts it with `Path(db_uri)`. - Not changed:   - The `destination` parameters of `add_computed_column()`, `add_column()` and model columns also use `str | Path`, but `ObjectStoreUtil.validate_destination()` checks `isinstance(dest, Path)` at runtime, so a generic `os.PathLike` would be rejected there.   - On the import side, a `Path` source fails in `import_csv()`, `import_excel()`, `import_json()`, `import_parquet()` and `create_table(source=...)`, because `TableDataConduit` only handles `str` sources. That needs a behavioral fix and is handled separately.  ## Testing  - `tests/io/test_lancedb.py`: the `if_exists='overwrite'` export now passes the db path as

- **Issue #2015** (2026-11-19): **Pin pytest<9.2 so --dist loadgroup honors xdist_group again**
  *Symptoms*: Scheduled `tests` run on `main`: https://github.com/pixeltable/pixeltable/actions/runs/44437059584  ## Failure  On Ubuntu and Windows, one of the yolox-backed tests failed on each job: `TestYolox::test_yolox_coco_integration` (ubuntu 3.12, windows 3.11), `TestVision::test_eval` (ubuntu 3.12, 3.15) or `TestVision::test_bboxes_draw` (ubuntu 3.14). The Windows 3.11 worker log in the pytest-logs artifact shows the cause. The insert into `frames.detections` stored `PermissionError` for 4 rows and `FileExistsError` for 4 more (`Inserted 16 rows with 8 errors across 1 column (frames.detections)`). `to_coco_dataset()` then rejected the resulting `annotations: None`.  `pixeltable-yolox` 0.4.2 downloads weights to a fixed `~/.cache/yolox/weights/<model>.pth.tmp` and then calls `os.rename()`. When several processes load the same model on a cold cache, they race on that file.  ## Root cause  These tests are all `xdist_group('yolox')`, so they should run on one worker. In this run they ran on gw0 through gw3 at the same time, and the `large_model` Hugging Face tests were spread across every worker too. No node id in the log carries an `@group` suffix.  #1989 lifted `pytest<9.2`, and this is the first scheduled run on pytest 9.2.0. pytest 9.2 replaced `Node._nodeid` with `Node._id` and derives `nodeid` from it (`_pytest/nodes.py`). pytest-xdist 3.8.0, the latest release, still tags grouped items in `xdist/remote.py` with `item._nodeid = f"{item.nodeid}@{group}"`. pytest no longer reads tha

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

### Incident Patch 1: `ff4cbc2b` (2026-11-19)
**Commit Message**: [PXT-1820] Fix error messages that point to the wrong fix (#1996)

Three error messages sent users (and agents) toward the wrong fix.

## Changes

**1. TableModel: `Column()` with neither `type` nor `value`**
Before: `image_id: pxt.UUID = pxt.Column(primary_key=True)` failed with
`Column specification for 'image_id' must define \`type\` or \`value\`,
but not both`, which reads as if both were given. The annotation does
not supply the type for a `Column()`, and neither was set.
After, split into the two cases:
- neither: `Column specification for 'image_id' defines neither \`type\`
nor \`value\`; pass \`type=\` to Column() for a stored column (a type
annotation does not set it) or \`value=\` for a computed one`
- both: `Column specification for 'both' cannot define both \`type\` and
\`value\``

**2. `list_iterator()` over untyped Json**
Before: `list_iterator(): Expected a type for \`elements\` matching
\`list[dict]\`; got \`Json | None\``. \`Json[list[dict]]\` doesn't work,
so this sent users the wrong way.
After: `` list_iterator(): `elements` needs a list-of-dicts type with
known keys, such as `pxt.Json[list[Item]]` for a TypedDict `Item`; cast
an untyped value with `.astype(pxt.

**File**: `pixeltable/catalog/model/definition.py` (modified, +9/-2)
```diff
@@ -341,10 +341,17 @@ def set_col_value(self, name: str, value: Any) -> None:
         spec: ColumnSpec
         if isinstance(value, Column):
             spec = value.to_column_spec()
-            if ('type' in spec) == ('value' in spec):
+            if 'type' in spec and 'value' in spec:
                 raise excs.RequestError(
                     excs.ErrorCode.INVALID_SCHEMA,
-                    f'Column specification for {name!r} must define `type` or `value`, but not both',
+                    f'Column specification for {name!r} cannot define both `type` and `value`: a computed column '
+                    'takes its type from `value`; to change it, cast the value with `.astype()`',
+                )
+            if 'type' not in spec and 'value' not in spec:
+                raise excs.RequestError(
+                    excs.ErrorCode.INVALID_SCHEMA,
+                    f'Column specification for {name!r} defines neither `type` nor `value`; pass `type=` to '
+                    'Column() for a stored column (a type annotation does not set it) or `value=` for a computed one',
                 )
         else:
             # Computed column expression.
```

**File**: `pixeltable/catalog/table_version.py` (modified, +2/-2)
```diff
@@ -1563,8 +1563,8 @@ def _validate_update_spec(
                 if not closed_type.is_supertype_of(value_expr.col_type.with_closed_dicts(), ignore_nullable=True):
                     raise excs.RequestError(
                         excs.ErrorCode.TYPE_MISMATCH,
-                        f'The literal value {val!r} is not compatible with the type '
-                        f'`{col.col_type}` of column {col_name!r}',
+                        f'Column {col_name!r}: the value {value_expr!s} has type `{value_expr.col_type}`, which is not '
+                        f'compatible with the column type `{col.col_type}`',
                     ) from exc
             update_targets[col] = value_expr
 
```

**File**: `pixeltable/functions/json.py` (modified, +37/-26)
```diff
@@ -575,6 +575,40 @@ def list_iterator(
             yield dict(zip(kwargs_.keys(), el, strict=True))
 
 
+def _list_iterator_elements_schema(elements: exprs.Expr) -> dict[str, ts.ColumnType]:
+    el_col_type = elements.col_type
+    json_schema = el_col_type.type_schema if isinstance(el_col_type, ts.JsonType) else None
+    variadic_element_type = json_schema.variadic_type if json_schema is not None else None
+    if (
+        json_schema is not None
+        and isinstance(json_schema.type_spec, list)
+        and builtins.len(json_schema.type_spec) == 0
+        and isinstance(variadic_element_type, ts.JsonType)
+        and variadic_element_type.type_schema is not None
+        and isinstance(variadic_element_type.type_schema.type_spec, dict)
+    ):
+        return variadic_element_type.type_schema.type_spec
+
+    if not isinstance(el_col_type, ts.JsonType):
+        hint = '`elements` needs a Json list of dicts'
+    elif (
+        json_schema is not None
+        and isinstance(json_schema.type_spec, list)
+        and not any(isinstance(el_type, ts.JsonType) for el_type in [*json_schema.type_spec, json_schema.variadic_type])
+    ):
+        hint = (
+            'a list of values that are not dicts needs the keyword form, which names the output column: '
+            f'`list_iterator(value={elements!s})`'
+        )
+    else:
+        hint = (
+            '`elements` needs a list-of-dicts type with known keys, such as `pxt.Json[list[Item]]` for a '
+            'TypedDict `Item`; cast an untyped value with `.astype(pxt.Json[list[Item]] | None)`, or use the '
+            'keyword form for a list of values that are not dicts'
+        )
+    raise excs.RequestError(excs.ErrorCode.UNSUPPORTED_OPERATION, f'list_iterator(): {hint}. Got `{el_col_type}`')
+
+
 @list_iterator.conditional_output_schema
 def _(bound_args: dict[str, exprs.Expr]) -> dict[str, type]:
     if bound_args.get('elements') is not None:
@@ -587,31 +621,7 @@ def _(bound_args: dict[str, exprs.Expr]) -> dict[str, type]:
                 excs.ErrorCode.UNSUPPORTED_OPERATION,
                 'list_iterator(): Cannot specify both `elements` and keyword arguments',
             )
-        elements = bound_args['elements']
-
-        el_col_type = elements.col_type
-        if (
-            not isinstance(el_col_type, ts.JsonType)
-            or el_col_type.type_schema is None
-            or not isinstance(el_col_type.type_schema.type_spec, list)
-            or builtins.len(el_col_type.type_schema.type_spec) != 0
-        ):
-            raise excs.RequestError(
-                excs.ErrorCode.UNSUPPORTED_OPERATION,
-                f'list_iterator(): Expected a type for `elements` matching `list[dict]`; got `{el_col_type}`',
-            )
-        dict_type = el_col_type.type_schema.variadic_type
-        if (
-            not isinstance(dict_type, ts.JsonType)
-            or dict_type.type_schema is None
-            or not isinstance(dict_type.type_schema.type_spec, dict)
-        ):
-            raise excs.RequestError(
-                excs.ErrorCode.UNSUPPORTED_OPERATION,
-                f'list_iterator(): Expected a type for `elements` matching `list[dict]`; got `{el_col_type}`',
-            )
-
-        return dict_type.type_schema.type_spec  # type: ignore[return-value]
+        return _list_iterator_elements_schema(bound_args['elements'])  # type: ignore[return-value]
 
     else:  # bound_args.get('element') is None
         mode = bound_args.get('mode')
@@ -629,7 +639,8 @@ def _(bound_args: dict[str, exprs.Expr]) -> dict[str, type]:
             ):
                 raise excs.RequestError(
                     excs.ErrorCode.UNSUPPORTED_OPERATION,
-                    f'list_iterator(): Expected a type for `{name}` matching `list`; got `{expr.col_type}`',
+                    f'list_iterator(): `{name}` needs a typed Json list, such as `pxt.Json[list[str]]`; cast an '
+                    f'untyped value with `.astype(pxt.Json[list[str]] | None)`. Got `{expr.col_type}`',
                 )
             type_schema = expr.col_type.type_schema
             relevant_types = type_schema.type_spec
```

**File**: `tests/functions/test_json.py` (modified, +29/-4)
```diff
@@ -607,6 +607,7 @@ def test_list_iterator_errors(self, uses_db: None) -> None:
                 'col_3': pxt.String | None,  # primitive type
                 'col_4': pxt.Json | None,  # untyped json
                 'col_5': pxt.Json[list] | None,  # typed json, but with an untyped subscript
+                'col_6': pxt.Json[list[str]] | None,
             },
         )
 
@@ -622,13 +623,36 @@ def test_list_iterator_errors(self, uses_db: None) -> None:
         ):
             pxtf.json.list_iterator(t.col_1, my_int=t.col_2)
 
-        invalid_type_cases = (t.col_2, t.col_3, t.col_4, t.col_5)
-        for expr in invalid_type_cases:
+        for expr in (t.col_2, t.col_6):
             with pxt_raises(
                 pxt.ErrorCode.UNSUPPORTED_OPERATION,
-                match=r'list_iterator\(\): Expected a type for `elements` matching `list\[dict\]`',
+                match=r'list_iterator\(\): a list of values that are not dicts needs the keyword form, which names the '
+                rf'output column: `list_iterator\(value={expr!s}\)`',
             ):
                 pxtf.json.list_iterator(expr)
+        with pxt_raises(
+            pxt.ErrorCode.UNSUPPORTED_OPERATION, match=r'list_iterator\(\): `elements` needs a Json list of dicts'
+        ):
+            pxtf.json.list_iterator(t.col_3)
+        for expr in (t.col_4, t.col_5):
+            with pxt_raises(
+                pxt.ErrorCode.UNSUPPORTED_OPERATION,
+                match=r'cast an untyped value with `.astype\(pxt.Json\[list\[Item\]\] \| None\)`',
+            ):
+                pxtf.json.list_iterator(expr)
+
+        # the form the error message suggests works on untyped json
+        class Item(TypedDict):
+            a: int
+
+        t.insert([{'col_2': [7], 'col_4': {'stops': [{'a': 1}, {'a': 2}]}, 'col_6': ['fault']}])
+        v = pxt.create_view(
+            'test_view', t, iterator=pxtf.json.list_iterator(t.col_4.stops.astype(pxt.Json[list[Item]] | None))
+        )
+        assert v.order_by(v.pos).collect()['a'] == [1, 2]
+        v2 = pxt.create_view('test_view_2', t, iterator=pxtf.json.list_iterator(value=t.col_2, code=t.col_6))
+        assert v2.collect()['value'] == [7]
+        assert v2.collect()['code'] == ['fault']
 
         with pxt_raises(pxt.ErrorCode.MISSING_REQUIRED, match=r'list_iterator\(\): No inputs provided'):
             pxtf.json.list_iterator()
@@ -640,6 +664,7 @@ def test_list_iterator_errors(self, uses_db: None) -> None:
         for expr in invalid_type_cases_2:
             with pxt_raises(
                 pxt.ErrorCode.UNSUPPORTED_OPERATION,
-                match=r'list_iterator\(\): Expected a type for `my_int` matching `list`',
+                match=r'list_iterator\(\): `my_int` needs a typed Json list, such as `pxt.Json\[list\[str\]\]`; '
+                r'cast an untyped value with `.astype\(pxt.Json\[list\[str\]\] \| None\)`',
             ):
                 pxtf.json.list_iterator(my_int=expr)
```

**File**: `tests/test_table.py` (modified, +29/-3)
```diff
@@ -2441,16 +2441,40 @@ class MySchemaOpt(TypedDict, total=False):
             t.insert(json_col_2={'z': None})
         with pxt_raises(
             pxt.ErrorCode.TYPE_MISMATCH,
-            match=r"The literal value.*is not compatible with the type.*of column 'json_col_2'",
+            match=r"Column 'json_col_2': the value .* has type .*, which is not compatible with the column type",
         ):
             t.update({'json_col_2': {'a': 'mangoes', 'z': 1}})
 
         with pxt_raises(
             pxt.ErrorCode.TYPE_MISMATCH,
-            match=r"The literal value.*is not compatible with the type.*of column 'json_col_2'",
+            match=r"Column 'json_col_2': the value .* has type .*, which is not compatible with the column type",
         ):
             t.update({'json_col_2': {'a': 15}})  # Validation error on update
 
+    def test_update_expr_type_mismatch(self, db_root: DatabaseRoot) -> None:
+        p = db_root.make_catalog_path
+        counts = pxt.create_table(p('acct_counts'), {'acct': pxt.String, 'n': pxt.Int})
+        counts.insert([{'acct': 'a', 'n': 3}])
+        accts = pxt.create_table(p('accts'), {'acct': pxt.String, 'n': pxt.Int | None})
+        accts.insert([{'acct': 'a'}])
+
+        @pxt.query
+        def acct_counts(acct: str) -> pxt.Query:
+            return counts.where(counts.acct == acct).select(counts.n)
+
+        with pxt_raises(
+            pxt.ErrorCode.TYPE_MISMATCH,
+            match=r"Column 'n': the value acct_counts\(acct\) has type `Json\[\(Int, \.\.\.\)\]`, which is not "
+            r'compatible with the column type `Int \| None`$',
+        ):
+            accts.update({'n': acct_counts(accts.acct)})
+
+        with pxt_raises(
+            pxt.ErrorCode.TYPE_MISMATCH,
+            match=r"Column 'n': the value acct has type `String`, which is not compatible with the column type",
+        ):
+            accts.update({'n': accts.acct})
+
     def test_update_json_expr(self, db_root: DatabaseRoot) -> None:
         # An update expression's values aren't validated, so its type may declare no keys that the column's doesn't
         class Schema(TypedDict, total=False):
@@ -2461,7 +2485,9 @@ class Schema(TypedDict, total=False):
         t.insert(s='x')
         t.update({'j': {'a': t.s}})  # omitting an optional key is fine
         assert t.collect()['j'] == [{'a': 'x'}]
-        with pxt_raises(pxt.ErrorCode.TYPE_MISMATCH, match=r"is not compatible with the type.*of column 'j'"):
+        with pxt_raises(
+            pxt.ErrorCode.TYPE_MISMATCH, match=r"Column 'j': the value .* is not compatible with the column type"
+        ):
             t.update({'j': {'a': t.s, 'z': t.s}})
 
     def test_insert_pydantic_json(self, db_root: DatabaseRoot) -> None:
```

**File**: `tests/test_table_model.py` (modified, +22/-1)
```diff
@@ -2636,12 +2636,33 @@ class FirstDup(TableModel, name='dup_name'):
             class SecondDup(TableModel, name='dup_name'):
                 id: pxt.Int | None
 
-        with pxt_raises(excs.ErrorCode.INVALID_SCHEMA, match=r'must define `type` or `value`, but not both'):
+        neither = r"Column specification for 'bad' defines neither `type` nor `value`; pass `type=` to Column\(\)"
+        with pxt_raises(excs.ErrorCode.INVALID_SCHEMA, match=neither):
 
             class BadColSpec(TableModel, name='bad_col_spec'):
                 id: pxt.Int | None
                 bad = Column()
 
+        with pxt_raises(excs.ErrorCode.INVALID_SCHEMA, match=neither):
+
+            class BadPkColSpec(TableModel, name='bad_pk_col_spec'):
+                bad = Column(primary_key=True)
+
+        with pxt_raises(excs.ErrorCode.INVALID_SCHEMA, match=neither):
+
+            class AnnotatedPkColSpec(TableModel, name='annotated_pk_col_spec'):
+                bad: pxt.UUID = Column(primary_key=True)  # type: ignore[assignment]
+
+        with pxt_raises(
+            excs.ErrorCode.INVALID_SCHEMA,
+            match=r"Column specification for 'both' cannot define both `type` and `value`: a computed column "
+            r'takes its type from `value`; to change it, cast the value with `.astype\(\)`$',
+        ):
+
+            class BothColSpec(TableModel, name='both_col_spec'):
+                id: pxt.Int | None
+                both = Column(type=pxt.Int, value=1)
+
         # `references columns that are not in the model's scope` is raised at `create()` time, when a computed
         # column refers to a column outside the model (here, a column belonging to a different, unbound model).
         class OtherModel(TableModel, name='other_model'):
```

---

### Incident Patch 2: `506c7c8f` (2026-11-19)
**Commit Message**: [PXT-1806] Fix spurious SCHEMA_CHANGE_IN_PROGRESS on an operational table when autovacuum holds the table (#2007)

Autovacuum with table truncate (removes empty pages of the table) takes
an exclusive lock on the table. An operational table operation, read or
write, that happens at the same time, will fail to acquire the lock and
raise a `SCHEMA_CHANGE_IN_PROGRESS` error despite no schema changes
taking place.

Autovacuum checks every 20ms if any transactions are waiting for the
lock that it has, and if they do, it will stop the truncation and
release the lock in order yield the table to the user load.

The fix is for operational table ops, instead of failing immediately
when the lock is unavailable (`LOCK TABLE ... NOWAIT`), to wait with a
100ms timeout. The tradeoff is:
* When a real schema change is in progress, new operational table ops
will fail after a 100ms wait rather than immediately, assuming the
schema change runs past that deadline. If the schema change finishes
before 100ms is over, the waiting op will simply proceed.
* When autovacuum with truncation is running, an operational table op
will wait for a short time (up to 20ms + however long it takes
autovacuum to release

**File**: `docs/design/catalog-locking.md` (modified, +12/-7)
```diff
@@ -28,8 +28,8 @@ That class and the table's versioning, data-versioned or operational, determine
 | Operation class | Operational table | Data-versioned table | Wait policy |
 | --- | --- | --- | --- |
 | `MD_READ`: catalog metadata | No lock | No lock | N/A |
-| `DATA_READ`: query rows | `ACCESS SHARE` | `ACCESS SHARE` | Wait if any locked table is data-versioned |
-| `DATA_WRITE`: insert/update/delete | `ROW EXCLUSIVE` | `EXCLUSIVE` | Wait if any locked table is data-versioned |
+| `DATA_READ`: query rows | `ACCESS SHARE` | `ACCESS SHARE` | Fail fast unless any locked table is data-versioned |
+| `DATA_WRITE`: insert/update/delete | `ROW EXCLUSIVE` | `EXCLUSIVE` | Fail fast unless any locked table is data-versioned |
 | `MD_WRITE`: metadata changes and DDL | `ACCESS EXCLUSIVE` | `ACCESS EXCLUSIVE` | Always wait |
 | `FINALIZE`: complete pending operations | `ACCESS EXCLUSIVE` | `ACCESS EXCLUSIVE` | Always wait |
 
@@ -45,17 +45,22 @@ Lock modes apply per table. For example, a schema change can lock its target wit
 its bases with `ACCESS SHARE`.
 
 The wait policy applies to the whole transaction. If a data read or write locks only operational tables,
-it uses `NOWAIT` for every table lock. A conflict reports `SCHEMA_CHANGE_IN_PROGRESS`. If any locked table
-is data-versioned, the transaction waits for every required table lock. Schema changes and finalization
-always wait, regardless of versioning.
+it fails fast: it waits at most 100 ms (`lock_timeout`) for each table lock, and a timeout reports
+`SCHEMA_CHANGE_IN_PROGRESS`. If any locked table is data-versioned, the transaction waits for every required table
+lock. Schema changes and finalization always wait, regardless of versioning.
+
+The short wait, rather than failing immediately with `NOWAIT`, puts the request in the lock queue, so VACUUM can see
+it and yield. VACUUM, including autovacuum, takes `ACCESS EXCLUSIVE` to truncate empty pages at the end of a table,
+for example after all rows were deleted. While it holds that lock, it checks for queued lock requests every 20 ms and
+releases the lock if it finds one. A `NOWAIT` request never enters the queue, so it would fail instead.
 
 ### A waiting schema change blocks later operations
 
 Postgres grants a table lock only if it conflicts with neither the locks already held nor the requests already
 waiting for that table. A schema change or finalization waiting for `ACCESS EXCLUSIVE` therefore blocks every later
 lock request on the table, although it does not hold the lock yet:
 
-- Operational data reads and writes fail with `SCHEMA_CHANGE_IN_PROGRESS`.
+- Operational data reads and writes fail with `SCHEMA_CHANGE_IN_PROGRESS` after the short wait.
 - Data-versioned data reads and writes wait until the schema change completes.
 
 Pixeltable treats a waiting schema change as in progress, so its effect on other operations starts when it is
@@ -184,7 +189,7 @@ A schema change can span several transactions. Locks are released between them,
 operations out of an unfinished change.
 
 **A table with pending operations is not usable.** A transaction that finds them aborts its attempt, finalizes
-them, and retries. Finalization waits for its locks, even when the operation itself would use `NOWAIT`.
+them, and retries. Finalization waits for its locks, even when the operation itself would fail fast.
 
 Pending operations run in one of two ways:
 
```

**File**: `pixeltable/catalog/catalog.py` (modified, +2/-2)
```diff
@@ -609,7 +609,7 @@ def _begin_xact(
 
             except LockNotAvailableError as e:
                 has_exc = True
-                # NOWAIT can fail when a schema change holds a conflicting lock or is queued ahead of us.
+                # A short lock wait times out when a schema change holds a conflicting lock or is queued ahead of us.
                 attempt_exc = e
                 raise excs.ConcurrencyError(
                     excs.ErrorCode.SCHEMA_CHANGE_IN_PROGRESS,
@@ -1136,7 +1136,7 @@ def _finalize_pending_ops(self, tbl_id: UUID) -> Exception | None:
                 raise
 
             except excs.ConcurrencyError as e:
-                # Finalization itself waits for locks, but its work may call a NOWAIT operation on another table.
+                # Finalization itself waits for locks, but its work may call a fail-fast operation on another table.
                 # Propagate the error without treating it as a failure that requires rolling back the schema change.
                 _logger.debug(f'Finalize pending ops({tbl_id}): op reported a concurrency error: {e}')
                 raise
```

**File**: `pixeltable/catalog/locking.py` (modified, +27/-17)
```diff
@@ -31,6 +31,10 @@
 
 _logger = logging.getLogger(__name__)
 
+# VACUUM checks for queued lock requests every 20 ms (VACUUM_TRUNCATE_LOCK_CHECK_INTERVAL), so 100 ms gives
+# it several chances to notice a waiter and release the lock.
+LOCK_TIMEOUT_MS = 100
+
 
 def finalized_view_base_id(tbl_md: schema.TableMd) -> UUID | None:
     """Return the mutable base whose view_sn must advance when this view's metadata is deleted, or None."""
@@ -90,19 +94,20 @@ def tbl_lock_mode(self, is_data_versioned: bool) -> TblLockMode:
         assert self in (TblOpClass.MD_WRITE, TblOpClass.FINALIZE)
         return TblLockMode.ACCESS_EXCLUSIVE
 
-    def should_wait(self, any_data_versioned: bool) -> bool:
-        """Return whether to wait for locks that are not immediately available, instead of failing.
+    def fails_fast(self, any_data_versioned: bool) -> bool:
+        """Return whether to wait at most LOCK_TIMEOUT_MS for locks held by others and then fail, instead of waiting
+        until they are released.
 
-        Data reads and writes wait only if `any_data_versioned` is True. Schema changes and pending-op finalization
-        always wait.
+        Data reads and writes fail fast only if `any_data_versioned` is False. Schema changes and pending-op
+        finalization always wait without a time limit.
         """
         if self in (TblOpClass.MD_WRITE, TblOpClass.FINALIZE):
-            return True
+            return False
         if self is TblOpClass.MD_READ:
             # MD_READ takes no locks, so the return value has no effect.
-            return False
+            return True
         assert self in (TblOpClass.DATA_READ, TblOpClass.DATA_WRITE)
-        return any_data_versioned
+        return not any_data_versioned
 
 
 class TblLockMode(enum.Enum):
@@ -143,10 +148,9 @@ class LockTarget:
     store_tbl_name: str
     mode: TblLockMode
 
-    def lock_stmt(self, *, wait: bool) -> str:
+    def lock_stmt(self) -> str:
         """Return the LOCK TABLE statement that acquires this target's lock."""
-        nowait_clause = '' if wait else ' NOWAIT'
-        return f'LOCK TABLE {self.store_tbl_name} IN {self.mode.sql_name} MODE{nowait_clause}'
+        return f'LOCK TABLE {self.store_tbl_name} IN {self.mode.sql_name} MODE'
 
 
 class LockRequest:
@@ -401,11 +405,11 @@ def add_dir(self, dir_id: UUID, path: Path) -> None:
         assert not self._is_acquired
         self._dirs.setdefault(dir_id, path)
 
-    # whether to wait for locks that are not immediately available; if False, raise LockNotAvailableError.
-    # Applies to every lock in the set: True if any table requires waiting.
+    # whether to wait at most LOCK_TIMEOUT_MS for each lock and then raise LockNotAvailableError, instead of waiting
+    # without a time limit. Applies to every lock in the set: False if any table requires waiting without a limit.
     @property
-    def wait(self) -> bool:
-        return self.request.op_class.should_wait(self._any_data_versioned)
+    def fail_fast(self) -> bool:
+        return self.request.op_class.fails_fast(self._any_data_versioned)
 
     @telemetry.spanned('pixeltable.catalog.acquire_locks', level=telemetry.DEBUG)
     def acquire(self) -> None:
@@ -415,8 +419,12 @@ def acquire(self) -> None:
         acquisition ensures no deadlocks. LOCK TABLE leaves the transaction's snapshot unset. The first directory
         UPDATE establishes it, so directory locks must come after all store table locks.
 
+        To fail fast, each lock waits at most LOCK_TIMEOUT_MS instead of failing immediately (NOWAIT): a queued
+        request makes VACUUM release the ACCESS EXCLUSIVE lock it takes to truncate a table, while a NOWAIT request
+        is invisible to it.
+
         Raises:
-            LockNotAvailableError: a NOWAIT lock could not be acquired.
+            LockNotAvailableError: fail-fast acquisition did not obtain the lock within LOCK_TIMEOUT_MS.
             StaleLockSetError: a named store table no longer exists.
         """
         assert get_runtime().in_xact
@@ -427,13 +435,15 @@ def acquire(self) -> None:
         if len(targets) > 0:
             fault_injection.process_fault(FaultLocation.CATALOG_BEFORE_TBL_LOCK, op_class=op_class)
             # Send the LOCK TABLE statements in one request, separated by semicolons. psycopg executes them in order.
-            stmt = '; '.join(t.lock_stmt(wait=self.wait) for t in targets)
+            stmt = '; '.join(t.lock_stmt() for t in targets)
+            if self.fail_fast:
+                stmt = f"SET LOCAL lock_timeout = '{LOCK_TIMEOUT_MS}ms'; {stmt}; SET LOCAL lock_timeout = DEFAULT"
             try:
                 get_runtime().conn.exec_driver_sql(stmt)
             except sql_exc.DBAPIError as e:
                 _logger.debug(f'{stmt} failed: {e}')
                 if isinstance(e.orig, psycopg.errors.LockNotAvailable):
-                    assert not self.wait
+                    assert self.fail_fast
                     raise Lo
```

---

### Incident Patch 3: `56a5e643` (2026-11-19)
**Commit Message**: [PXT-1783] Fix AssertionError for SQL-computed Json methods on a stored Json column (#1997)

`t.select(t.j.len())` (and `is_empty()`, `sum()`, `min()`, `max()`,
`mean()`, `pxtf.json.dumps()`) failed with `AssertionError: 0` from
`DataRow.__getitem__()` when the Json column itself wasn't also
selected. The same happened in `add_computed_column()` over existing
rows, in `recompute_columns()`, and when such an expression was used
only in `order_by()` or a join predicate.

Also fixes [PXT-1828](https://pixeltable.atlassian.net/browse/PXT-1828):
`order_by()` on a Json or Array column crashed with `AssertionError`
unless the column was selected. It has the same cause.

## Cause
`_add_cell_reconstruction_node()` collected every Json, Array and Binary
`ColumnRef` in the query, and `CellReconstructionNode` then read each
one's slot. But a column that is only read inside an expression computed
in SQL (such as `j.len()`), or only used in `order_by()` or a join
predicate (which run only in SQL), never gets a value in the row, so
that slot is empty.

## Fix
`_add_cell_reconstruction_node()` now reconstructs only the ColumnRefs
(and JsonPath anchors) that are in the SQL node's select list, since

**File**: `pixeltable/plan.py` (modified, +18/-7)
```diff
@@ -852,7 +852,9 @@ def _add_cell_materialization_node(cls, input: exec.ExecNode) -> exec.ExecNode:
             return input
 
     @classmethod
-    def _add_cell_reconstruction_node(cls, expr_list: list[exprs.Expr], input: exec.ExecNode) -> exec.ExecNode:
+    def _add_cell_reconstruction_node(
+        cls, expr_list: list[exprs.Expr], sql_col_refs: exprs.ExprSet[exprs.ColumnRef], input: exec.ExecNode
+    ) -> exec.ExecNode:
         """
         Add a CellReconstructionNode, if required by any of the exprs in expr_list.
 
@@ -862,6 +864,9 @@ def _add_cell_reconstruction_node(cls, expr_list: list[exprs.Expr], input: exec.
         2) all array-typed ColumnRefs that are not used as part of a ColumnPropertyRef
         The json-typed ColumnRefs that JsonPaths are anchored on also need the node, which loads their objects that are
         stored in remote chunks.
+        Only ColumnRefs whose slots the SQL scan populates (members of sql_col_refs) are reconstructed. A ColumnRef
+        that appears only inside an expr computed in SQL, or only in an order-by or join clause, has no value in the
+        row.
         """
 
         def json_filter(e: exprs.Expr) -> bool:
@@ -883,20 +888,22 @@ def binary_filter(e: exprs.Expr) -> bool:
             return isinstance(e, exprs.ColumnRef) and e.col.col_type.is_binary_type()
 
         json_candidates = list(exprs.Expr.list_subexprs(expr_list, filter=json_filter, traverse_matches=False))
-        json_refs = [e for e in json_candidates if isinstance(e, exprs.ColumnRef)]
+        json_refs = [e for e in json_candidates if isinstance(e, exprs.ColumnRef) and e in sql_col_refs]
         json_ref_ids = {e._expr_id for e in json_refs}
         json_path_anchors = [
             e.anchor
             for e in json_candidates
             if isinstance(e, exprs.JsonPath)
             and isinstance(e.anchor, exprs.ColumnRef)
+            and e.anchor in sql_col_refs
             and e.anchor._expr_id not in json_ref_ids
         ]
-        array_candidates = list(exprs.Expr.list_subexprs(expr_list, filter=array_filter, traverse_matches=False))
-        array_refs = [e for e in array_candidates if isinstance(e, exprs.ColumnRef)]
-        binary_refs = list(
-            exprs.Expr.list_subexprs(expr_list, exprs.ColumnRef, filter=binary_filter, traverse_matches=False)
+        array_candidates = exprs.Expr.list_subexprs(expr_list, filter=array_filter, traverse_matches=False)
+        array_refs = [e for e in array_candidates if isinstance(e, exprs.ColumnRef) and e in sql_col_refs]
+        binary_candidates = exprs.Expr.list_subexprs(
+            expr_list, exprs.ColumnRef, filter=binary_filter, traverse_matches=False
         )
+        binary_refs = [e for e in binary_candidates if e in sql_col_refs]
         if len(json_refs) > 0 or len(json_path_anchors) > 0 or len(array_refs) > 0 or len(binary_refs) > 0:
             return exec.CellReconstructionNode(
                 json_refs, array_refs, binary_refs, json_path_anchors, input.row_builder, input=input
@@ -1449,7 +1456,11 @@ def _create_query_plan(
             )
 
         plan = cls._add_prefetch_node(tbl.tbl_version.id, row_builder.unique_exprs, plan)
-        plan = cls._add_cell_reconstruction_node(analyzer.all_exprs, plan)
+        sql_node = plan.get_node(exec.SqlNode)
+        assert sql_node is not None
+        # the SqlNode's select list also has the iterator args and outputs that it adds for unstored iterator columns
+        sql_col_refs = exprs.ExprSet(e for e in sql_node.select_list if isinstance(e, exprs.ColumnRef))
+        plan = cls._add_cell_reconstruction_node(analyzer.all_exprs, sql_col_refs, plan)
 
         if analyzer.filter is not None:
             plan = exec.ExprEvalNode(row_builder, [analyzer.filter], sql_exprs, input=plan)
```

**File**: `tests/functions/test_json.py` (modified, +35/-3)
```diff
@@ -203,9 +203,41 @@ def test_len_and_is_empty(self, uses_db: None) -> None:
         with pytest.raises(Exception, match='scalar'):
             tnum.select(tnum.scalar, n=tnum.scalar.len()).collect()
 
-        # TODO: selecting a pushed-down json function without also selecting the source column fails, because the
-        # column's slot is never materialized (cell-reconstruction bug); re-enable once fixed.
-        # assert [r['n'] for r in t.order_by(t.id).select(n=t.j.len()).collect()] == [3, 0, 2, 0, 5, 0, None]
+        assert [r['n'] for r in t.order_by(t.id).select(n=t.j.len()).collect()] == [3, 0, 2, 0, 5, 0, None]
+
+    def test_sql_fn_without_source_col(self, uses_db: None) -> None:
+        """A json function computed in SQL works without the source column in the select list."""
+        t = pxt.create_table('json_sql_fn', {'id': pxt.Int, 'j': pxt.Json | None})
+        t.insert([{'id': 1, 'j': [1, 2]}, {'id': 2, 'j': [3.5]}, {'id': 3, 'j': None}])
+
+        def col(expr: pxt.exprs.Expr) -> list:
+            return [r['o'] for r in t.order_by(t.id).select(o=expr).collect()]
+
+        assert col(t.j.len()) == [2, 1, None]
+        assert col(t.j.is_empty()) == [False, False, True]
+        assert col(t.j.sum()) == [3.0, 3.5, None]
+        assert col(t.j.min()) == [1.0, 3.5, None]
+        assert col(t.j.max()) == [2.0, 3.5, None]
+        assert col(t.j.mean()) == [1.5, 3.5, None]
+        assert col(pxtf.json.dumps(t.j)) == ['[1, 2]', '[3.5]', None]
+        rs = t.order_by(t.id).select(t.j, n=t.j.len()).collect()
+        assert [(r['j'], r['n']) for r in rs] == [([1, 2], 2), ([3.5], 1), (None, None)]
+        assert [r['id'] for r in t.order_by(t.j.len(), t.id).select(t.id).collect()] == [2, 1, 3]
+        u = pxt.create_table('json_sql_fn_join', {'n': pxt.Int})
+        u.insert([{'n': 1}, {'n': 2}])
+        rs = t.join(u, on=t.j.len() == u.n).order_by(t.id).select(t.id).collect()
+        assert [r['id'] for r in rs] == [1, 2]
+
+        # add_computed_column() fills the existing rows
+        validate_update_status(t.add_computed_column(n=t.j.len()), expected_rows=3)
+        t.add_computed_column(s=pxtf.json.dumps(t.j))
+        assert col(t.n) == [2, 1, None]
+        assert col(t.s) == ['[1, 2]', '[3.5]', None]
+
+        t.update({'j': [4, 5, 6]}, where=t.id == 1, cascade=False)
+        validate_update_status(t.recompute_columns('s', 'n'), expected_rows=3)
+        assert col(t.n) == [3, 1, None]
+        assert col(t.s) == ['[4, 5, 6]', '[3.5]', None]
 
     def test_contains(self, uses_db: None) -> None:
         t = pxt.create_table('json_contains', {'id': pxt.Int | None, 'j': pxt.Json | None})
```

**File**: `tests/test_component_view.py` (modified, +37/-0)
```diff
@@ -150,6 +150,33 @@ def close(self) -> None:
         pass
 
 
+class ItemTypeRow(TypedDict):
+    idx: int
+    item_type: str
+
+
+@pxt.iterator(unstored_cols=['item_type'])
+class item_type_iterator(pxt.PxtIterator):
+    """Emits the Python type name of each element of a Json list, as an unstored output."""
+
+    def __init__(self, items: pxt.Json):
+        self.items = items
+        self.i = 0
+
+    def __next__(self) -> ItemTypeRow:
+        if self.i >= len(self.items):
+            raise StopIteration
+        row: ItemTypeRow = {'idx': self.i, 'item_type': type(self.items[self.i]).__name__}
+        self.i += 1
+        return row
+
+    def close(self) -> None:
+        pass
+
+    def seek(self, pos: int, **kwargs: Any) -> None:
+        self.i = pos
+
+
 @pxt.udf
 def fail_on_odd(i: int) -> int:
     if i % 2 == 1:
@@ -694,6 +721,16 @@ def test_update_iterator_param_with_dependent_view(self, db_root: DatabaseRoot)
         assert [r['scol'] for r in v3_rows] == ['s 0']
         assert [r['derived'] for r in v3_rows] == ['t 1_suffix']
 
+    def test_unstored_output_with_sql_json_fn(self, db_root: DatabaseRoot) -> None:
+        """The iterator gets its reconstructed Json arg when the query also computes a function of it in SQL."""
+        p = db_root.make_catalog_path
+        t = pxt.create_table(p('arrays'), {'j': pxt.Json})
+        t.insert([{'j': [np.zeros((2, 2), dtype=np.float32), np.ones((3, 3), dtype=np.float32)]}])
+        v = pxt.create_view(p('item_types'), t, iterator=item_type_iterator(t.j))
+        res = v.select(v.item_type, n=v.j.len()).order_by(v.idx).collect()
+        assert res['item_type'] == ['ndarray', 'ndarray']
+        assert res['n'] == [2, 2]
+
     def test_case_insensitive_iterator_outputs(self, db_root: DatabaseRoot) -> None:
         """Iterator output names become view columns and fold."""
         p = db_root.make_catalog_path
```

**File**: `tests/test_query.py` (modified, +14/-0)
```diff
@@ -356,6 +356,20 @@ def test_order_by(self, test_tbl: pxt.Table) -> None:
         with pxt_raises(pxt.ErrorCode.INVALID_EXPRESSION, match=r'c1\.upper is the method upper\(\)'):
             _ = t.order_by(t.c1.upper).collect()
 
+    def test_order_by_unselected_json_and_array(self, db_root: DatabaseRoot) -> None:
+        """order_by() on a Json or Array column gives the same order whether or not the column is selected."""
+        t = pxt.create_table(
+            db_root.make_catalog_path('order_by_unselected'),
+            {'id': pxt.Int, 'j': pxt.Json, 'a': pxt.Array[(2,), pxt.Int]},
+        )
+        t.insert([{'id': i, 'j': {'k': 10 - i}, 'a': np.array([10 - i, i])} for i in range(4)])
+
+        for col in (t.j, t.a):
+            for asc in (True, False):
+                expected = [3, 2, 1, 0] if asc else [0, 1, 2, 3]
+                assert t.order_by(col, asc=asc).select(t.id, col).collect()['id'] == expected
+                assert t.order_by(col, asc=asc).select(t.id).collect()['id'] == expected
+
     def test_expr_unique_id(self, test_tbl: pxt.Table) -> None:
         t = test_tbl
         # Multiple constants with the same string representation but different types must be unique (Expr._expr_id)
```

#### Recent Merged Pull Requests:
- **PR #2017** (2026-11-20): Take str | os.PathLike in the io export functions; accept a str path in export_lancedb() (@sergey-mkhitaryan)
- **PR #2015** (2026-11-19): Pin pytest<9.2 so --dist loadgroup honors xdist_group again (@claude[bot])
- **PR #2014** (closed): Upload project files to a hosted database on the default image from schema and service update (@christopherpestano)
- **PR #2012** (2026-11-19): [PXT-1709] Accept a bound model in join() (@sergey-mkhitaryan)
- **PR #2011** (2026-11-19): [PXT-1744] Validate required columns for rows inserted by batch_update(if_not_exists='insert') (@sergey-mkhitaryan)
- **PR #2010** (2026-11-19): [PXT-1780] Raise a RequestError for a computed column that calls a @pxt.query over a model (@sergey-mkhitaryan)

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

## X. [PXT-1820] Fix error messages that point to the wrong fix

**RULE**:
When implementing operations in `pixeltable/catalog/model/definition.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pixeltable/pixeltable. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ff4cbc2b`: [PXT-1820] Fix error messages that point to the wrong fix. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `pixeltable/catalog/model/definition.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
            if 'type' in spec and 'value' in spec:
                    f'Column specification for {name!r} cannot define both `type` and `value`: a computed column '
                    'takes its type from `value`; to change it, cast the value with `.astype()`',
                )
            if 'type' not in spec and 'value' not in spec:
                raise excs.RequestError(
                    excs.ErrorCode.INVALID_SCHEMA,
                    f'Column specification for {name!r} defines neither `type` nor `value`; pass `type=` to '
                    'Column() for a stored column (a type annotation does not set it) or `value=` for a computed one',
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
            if ('type' in spec) == ('value' in spec):
                    f'Column specification for {name!r} must define `type` or `value`, but not both',
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ff4cbc2b` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
