# Forensic Learning Record (Deep Inspection): paradedb/paradedb

> **Canonical Artifact**: `07_PROJECT_LEARNING/paradedb-paradedb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/paradedb/paradedb](https://github.com/paradedb/paradedb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:06:18.222Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `paradedb/paradedb`
- **Description**: One Postgres for your application data, full-text search, vector retrieval, and aggregations. Home of the pg_search extension.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9353 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/src/utils.rs`
```
// Copyright (c) 2023-2026 ParadeDB, Inc.
//
// This file is part of ParadeDB - Postgres for Search and Analytics
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

use anyhow::{Context, Result, bail};
use duckdb::{AccessMode, Config, Connection};

pub fn open_duckdb_conn() -> Result<Connection> {
    let config = Config::default()
        .access_mode(AccessMode::Automatic)?
        .enable_autoload_extension(true)?;
    let conn = Connection::open_in_memory_with_flags(config)
        .context("Failed to open DuckDB in-memory connection")?;

    conn.execute_batch(
        "CREATE OR REPLACE SECRET secret (TYPE s3, PROVIDER credential_chain);",
    )
    .context("Failed to configure S3 credentials. Ensure AWS credentials are available via environment variables, ~/.aws/credentials, or instance metadata.")?;

    conn.execute("INSTALL httpfs", [])
        .with_context(|| "Failed to install httpfs extension")?;
    conn.execute("LOAD httpfs", [])
        .with_context(|| "Failed to load httpfs extension")?;
    // Increase timeout (default is 30 seconds) to allow for working with larger files (200MB+)
    conn.execute("SET http_timeout = 120", [])
        .with_context(|| "Failed to configure http timeout")?;

    Ok(conn)
}

/// check that each table has at least one parquet file at the input location
pub fn validate_input<'a>(
    tables: impl Iterator<Item = &'a str>,
    conn: &Connection,
    input: &str,
) -> Result<()> {
    println!("Validating input path...");
    let mut missing_tables: Vec<String> = Vec::new();

    for table in tables {
        let input_glob = format!("{input}/{table}/*.parquet");
        let input_file_count: usize = conn
            .query_row(
                &format!("SELECT count(*) FROM (SELECT * FROM glob('{input_glob}') LIMIT 1)"),
                [],
                |row| row.get(0),
            )
            .with_context(|| format!("Failed to check parquet files for table '{table}'"))?;
        let input_exists = input_file_count > 0;

        if !input_exists {
            println!("  {table}: no parquet files found at '{input_glob}'");
            missing_tables.push(table.to_string());
        } else {
            println!("  {table}: ok");
        }
    }

    if !missing_tables.is_empty() {
        bail!(
            "No parquet files found for {} table(s): {}. Aborting before doing any work.",
            missing_tables.len(),
            missing_tables.join(", ")
        );
    }

    Ok(())
}

/// check that the output location for each table is empty
pub fn validate_output<'a>(
    tables: impl Iterator<Item = &'a str>,
    conn: &Connection,
    output: &str,
) -> Result<()> {
    println!("Validating output path...");
    let mut filled_outputs: Vec<String> = Vec::new();

    for table in tables {
        let output_glob = format!("{output}/{table}/*");
        let output_file_count: usize = conn
            .query_row(
                &format!("SELECT count(*) FROM (SELECT * FROM glob('{output_glob}') LIMIT 1)"),
                [],
                |row| row.get(0),
            )
            .with_context(|| format!("Failed to check output files for table '{table}'"))?;
        let output_empty = output_file_count == 0;

        if !output_empty {
            println!("  {table}: output directory not empty '{output_glob}'");
            filled_outputs.push(table.to_string());
        } else {
            println!("  {table}: ok");
        }
    }

    if !filled_outputs.is_empty() {
        bail!(
            "Output directories not empty for {} table(s): {}. Aborting before doing any work.",
            filled_outputs.len(),
            filled_outputs.join(", "),
        );
    }

    Ok(())
}

```

### Core Architecture Module: `pg_search/src/api/operator/const_score.rs`
```
// Copyright (c) 2023-2026 ParadeDB, Inc.
//
// This file is part of ParadeDB - Postgres for Search and Analytics
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

use crate::api::operator::f16_typmod::deserialize_i32_to_f32;
use crate::query::pdb_query::pdb;
use crate::query::pdb_query::pdb::ScoreAdjustStyle;
use crate::query::proximity::ProximityClause;
use pgrx::{extension_sql, pg_cast, pg_extern};

/// [`ConstType`] is a user-facing type used in SQL queries to indicate that should const a query
/// predicate's score.  The "const" value is a multiplier so users should watch out for zero (`0`).
///
/// While there's no indication on the Rust type, [`ConstType`] wants a Postgres type modifier (typmod)
/// when constructed so that a [`pdb::Query::Const { const: $typemod, query }`] can be constructed.
///
/// Users would use this type like so:
///
/// ```sql
/// SELECT * FROM t WHERE body @@@ 'beer'::const(3);
/// ```
///
/// It's up to individual operators to decide if/how they support [`ConstType`]
///
/// Invariant: `pdb.fuzzy` and `pdb.slop` are both IMPLICITLY castable to *both*
/// `pdb.boost` and `pdb.const`. That is only unambiguous because no operator or
/// function accepts both a [`BoostType`](crate::api::operator::boost::BoostType)
/// and a `ConstType` overload at the same call site. If one ever does, those
/// fuzzy/slop -> {boost, const} casts would resolve ambiguously and one of each
/// pair must drop to `AS ASSIGNMENT` (see the boost/fuzzy cast in `fuzzy.rs`).
#[derive(Debug)]
#[repr(transparent)]
pub struct ConstType(pdb::Query);

// Contains all the boilerplate required by pgrx to make a custom type from scratch
mod sql_datum_support {
    use crate::api::operator::const_score::ConstType;
    use crate::api::operator::const_typoid;
    use crate::query::pdb_query::pdb;
    use pgrx::callconv::{Arg, ArgAbi, BoxRet, FcInfo};
    use pgrx::nullable::Nullable;
    use pgrx::pgrx_sql_entity_graph::metadata::{
        ArgumentError, ReturnsError, ReturnsRef, SqlMappingRef, SqlTranslatable, TypeOrigin,
    };
    use pgrx::{FromDatum, IntoDatum, pg_sys};

    impl From<ConstType> for pdb::Query {
        fn from(value: ConstType) -> Self {
            match value.0 {
                const_ @ pdb::Query::ScoreAdjusted { .. } => const_,
                other => pdb::Query::ScoreAdjusted {
                    query: Box::new(other),
                    score: None,
                },
            }
        }
    }

    impl IntoDatum for ConstType {
        fn into_datum(self) -> Option<pg_sys::Datum> {
            self.0.into_datum()
        }

        fn type_oid() -> pg_sys::Oid {
            const_typoid()
        }
    }

    impl FromDatum for ConstType {
        unsafe fn from_polymorphic_datum(
            datum: pg_sys::Datum,
            is_null: bool,
            typoid: pg_sys::Oid,
        ) -> Option<Self> {
            pdb::Query::from_polymorphic_datum(datum, is_null, typoid).map(ConstType)
        }
    }

    unsafe impl SqlTranslatable for ConstType {
        const TYPE_IDENT: &'static str = pgrx::pgrx_resolved_type!(ConstType);
        const TYPE_ORIGIN: TypeOrigin = TypeOrigin::External;
        const ARGUMENT_SQL: Result<SqlMappingRef, ArgumentError> =
            Ok(SqlMappingRef::literal("pdb.const"));
        const RETURN_SQL: Result<ReturnsRef, ReturnsError> =
            Ok(ReturnsRef::One(SqlMappingRef::literal("pdb.const")));
    }

    unsafe impl BoxRet for ConstType {
        unsafe fn box_into<'fcx>(self, fcinfo: &mut FcInfo<'fcx>) -> pgrx::datum::Datum<'fcx> {
            match self.into_datum() {
                Some(datum) => unsafe { fcinfo.return_raw_datum(datum) },
                None => fcinfo.return_null(),
            }
        }
    }

    unsafe impl<'fcx> ArgAbi<'fcx> for ConstType {
        unsafe fn unbox_arg_unchecked(arg: Arg<'_, 'fcx>) -> Self {
            let index = arg.index();
            unsafe {
                arg.unbox_arg_using_from_datum()
                    .unwrap_or_else(|| panic!("argument {index} must not be null"))
            }
        }

        unsafe fn unbox_nullable_arg(arg: Arg<'_, 'fcx>) -> Nullable<Self> {
            unsafe { arg.unbox_arg_using_from_datum().into() }
        }
    }
}

// [`ConstType`]'s SQL type definition and necessary functions to support creating
mod typedef {
    use crate::api::operator::const_score::ConstType;
    use crate::api::operator::f16_typmod::{
        TYPMOD_BOUNDS, deserialize_i32_to_f32, serialize_f32_to_i32,
    };
    use crate::query::pdb_query::pdb;
    use crate::query::pdb_query::pdb::{ScoreAdjustStyle, query_out};
    use pgrx::{Array, extension_sql, pg_extern, pg_sys};
    use std::ffi::{CStr, CString};
    use std::str::FromStr;

    extension_sql!(
        r#"
            CREATE SCHEMA IF NOT EXISTS pdb;
            CREATE TYPE pdb.const;
        "#,
        name = "ConstType_shell",
        creates = [Type(ConstType)]
    );

    #[pg_extern(immutable, parallel_safe)]
    fn const_in(input: &CStr, _typoid: pg_sys::Oid, typmod: i32) -> ConstType {
        let query =
            pdb::Query::unclassified_string(input.to_str().expect("input must not be NULL"));
        ConstType(pdb::Query::ScoreAdjusted {
            query: Box::new(query),
            score: (typmod != -1)
                .then(|| deserialize_i32_to_f32(typmod))
                .map(ScoreAdjustStyle::Const),
        })
    }

    #[pg_extern(immutable, parallel_safe)]
    fn const_out(input: ConstType) -> CString {
        query_out(input.0)
    }

    /// Parse the user-specified "typmod" value string and encode it into an i32 after round-tripping
    /// it through a [`half::f16`] so that the user's value will fit in the positive side of an i32,
    /// which is all Postgres lets us use.
    ///
    /// We clamp the user-provided value to `[-2048.0..2048.0]` to avoid confusion around precision
    /// loss of larger integers, due to the nature of 16 bit floats.
    #[pg_extern(immutable, parallel_safe)]
    fn const_typmod_in(typmod_parts: Array<&CStr>) -> i32 {
        assert!(typmod_parts.len() == 1);
        let const_str = typmod_parts
            .get(0)
            .unwrap()
            .expect("typmod cstring must not be NULL");
        let const_f32 = f32::from_str(const_str.to_str().unwrap())
            .unwrap_or_else(|_| panic!("invalid const value: {}", const_str.to_str().unwrap()));

        let const_ = const_f32.clamp(TYPMOD_BOUNDS.0, TYPMOD_BOUNDS.1);
        serialize_f32_to_i32(const_)
    }

    #[pg_extern(immutable, parallel_safe)]
    fn const_typmod_out(typmod: i32) -> CString {
        let const_ = deserialize_i32_to_f32(typmod);
        CString::from_str(&const_.to_string()).unwrap()
    }

    extension_sql!(
        r#"
            CREATE TYPE pdb.const (
                INPUT = const_in,
                OUTPUT = const_out,
                INTERNALLENGTH = VARIABLE,
                LIKE = text,
                TYPMOD_IN = const_typmod_in,
                TYPMOD_OUT = const_typmod_out
            );
        "#,
        name = "ConstType_final",
        requires = [
            "ConstType_shell",
            const_in,
            const_out,
            const_typmod_in,
            const_typmod_out
        ]
    );
}

#[pg_extern(immutable, parallel_safe)]
pub fn query_to_const(input: pdb::Query, typmod: i32, _is_explicit: bool) -> ConstType {
    let const_ = deserialize_i32_to_f32(typmod);
    ConstType(pdb::Query::ScoreAdjusted {
        query: Box::new(input),
        score: Some(ScoreAdjustStyle::Const(const_)),
    })
}

#[pg_extern(immutable, parallel_safe)]
pub(crate) fn text_array_to_const(
    array: Vec<String>,
    typmod: i32,
    _is_explicit: bool,
) -> ConstType {
    let const_ = deserialize_i32_to_f32(typmod);
    let query = pdb::Query::UnclassifiedArray {
        array,
        fuzzy_data: None,
        slop_data: None,
    };
    ConstType(pdb::Query::ScoreAdjusted {
        query: Box::new(query),
        score: Some(ScoreAdjustStyle::Const(const_)),
    })
}

#[pg_extern(immutable, parallel_safe)]
fn prox_to_const(input: ProximityClause, typmod: i32, _is_explicit: bool) -> ConstType {
    let const_ = deserialize_i32_to_f32(typmod);

    let prox = if let ProximityClause::Proximity {
        left,
        right,
        distance,
    } = input
    {
        pdb::Query::Proximity {
            left: *left,
            right: *right,
            distance,
        }
    } else {
        panic!("invalid ProximityClause variant: {input:?}")
    };

    ConstType(pdb::Query::ScoreAdjusted {
        query: Box::new(prox),
        score: Some(ScoreAdjustStyle::Const(const_)),
    })
}

#[pg_cast(implicit, immutable, parallel_safe)]
fn const_to_query(input: ConstType) -> pdb::Query {
    input.0
}

/// SQL `CAST` function used by Postgres to apply the `typmod` value after the type has been constructed
///
/// One would think the type's input function, which also allows for a `typmod` argument would be
/// able to do this, but alas, Postgres always sets that to `-1` for historical reasons.
///
/// In our case, a simple expression like:
///
/// ```sql
/// SELECT 'foo'::const(3);
/// ```
///
/// Will first go through the `const_in` function with a `-1` typmod, and then Postgres will call
/// the `typmod_in`/`typmod_out` functions defined for [`ConstType`], then pass th
```

### Core Architecture Module: `pg_search/src/index/directory/utils.rs`
```
// Copyright (c) 2023-2026 ParadeDB, Inc.
//
// This file is part of ParadeDB - Postgres for Search and Analytics
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

use crate::api::{HashMap, HashSet};
use crate::index::mvcc::{MvccSatisfies, PinCushion};
use crate::postgres::rel::PgSearchRelation;
use crate::postgres::storage::block::{
    CTID_MAP_EXT, DeleteEntry, FileEntry, LinkedList, MVCCEntry, PgItem, STATS_EXT,
    SegmentFileDetails, SegmentMetaEntry, SegmentMetaEntryImmutable, VECTOR_CENTROIDS_EXT,
    VECTOR_VEC_EXT,
};
use crate::postgres::storage::metadata::MetaPage;
use anyhow::Result;
use pgrx::pg_sys;
use std::path::PathBuf;
use tantivy::index::SegmentComponent;
use tantivy::{
    IndexMeta,
    index::{IndexSettings, SegmentId, SegmentMetaInventory},
    schema::Schema,
};

pub fn save_schema(indexrel: &PgSearchRelation, tantivy_schema: &Schema) -> Result<()> {
    let schema = MetaPage::open(indexrel).schema_bytes();
    if schema.is_empty() {
        let bytes = serde_json::to_vec(tantivy_schema)?;
        unsafe {
            schema.writer().write(&bytes)?;
        }
    }
    Ok(())
}

pub fn save_settings(indexrel: &PgSearchRelation, tantivy_settings: &IndexSettings) -> Result<()> {
    let settings = MetaPage::open(indexrel).settings_bytes();
    if settings.is_empty() {
        let bytes = serde_json::to_vec(tantivy_settings)?;
        unsafe {
            settings.writer().write(&bytes)?;
        }
    }
    Ok(())
}

pub unsafe fn save_new_metas(
    indexrel: &PgSearchRelation,
    new_meta: &IndexMeta,
    prev_meta: &IndexMeta,
    directory_entries: &mut HashMap<PathBuf, FileEntry>,
) -> Result<()> {
    // in order to ensure that all of our mutations to the list of segments appear atomically on
    // physical replicas, we atomically operate on a deep copy of the list.
    let mut segment_metas_linked_list = MetaPage::open(indexrel).segment_metas();
    let mut linked_list = segment_metas_linked_list.atomically();

    let incoming_segments = new_meta
        .segments
        .iter()
        .map(|s| (s.id(), s))
        .collect::<HashMap<_, _>>();
    let new_ids = new_meta
        .segments
        .iter()
        .map(|s| s.id())
        .collect::<HashSet<_>>();
    let previous_ids = prev_meta
        .segments
        .iter()
        .map(|s| s.id())
        .collect::<HashSet<_>>();

    if pg_sys::message_level_is_interesting(pg_sys::DEBUG1 as _) {
        pgrx::debug1!(
            "entered save_new_metas with {} new ids and {} previous ids",
            new_ids.len(),
            previous_ids.len()
        );
    }

    // first, reorganize the directory_entries by segment id
    let mut new_files =
        HashMap::<SegmentId, HashMap<SegmentComponent, (FileEntry, PathBuf)>>::default();

    for (path, file_entry) in directory_entries.drain() {
        let segment_id = path.segment_id();
        let component_type = path.component_type();

        if let (Some(segment_id), Some(component_type)) = (segment_id, component_type) {
            new_files
                .entry(segment_id)
                .or_default()
                .insert(component_type, (file_entry, path));
        } else {
            panic!("malformed PathBuf: {}", path.display());
        }
    }

    let created_ids = new_ids.difference(&previous_ids).collect::<Vec<_>>();
    let mut modified_ids = previous_ids.intersection(&new_ids).collect::<Vec<_>>();
    let deleted_ids = previous_ids.difference(&new_ids).collect::<Vec<_>>();

    modified_ids.retain(|id| {
        if let Some(new_files) = new_files.get(id) {
            new_files.contains_key(&SegmentComponent::Delete)
        } else {
            false
        }
    });

    //
    // process the new segments
    //
    // these are added to the linked list as new items
    // xmin is set to the current transaction id
    // and xmax is set to InvalidTransactionId
    //
    let created_entries = created_ids
        .into_iter()
        .filter_map(|id| {
            let created_segment = incoming_segments.get(id).unwrap();
            let mut files = new_files.remove(id)?;

            let meta_entry = SegmentMetaEntry::new_immutable(
                *id,
                created_segment.max_doc(),
                pg_sys::InvalidTransactionId,
                SegmentMetaEntryImmutable {
                    postings: files.remove(&SegmentComponent::Postings).map(|e| e.0),
                    positions: files.remove(&SegmentComponent::Positions).map(|e| e.0),
                    fast_fields: files.remove(&SegmentComponent::FastFields).map(|e| e.0),
                    field_norms: files.remove(&SegmentComponent::FieldNorms).map(|e| e.0),
                    terms: files.remove(&SegmentComponent::Terms).map(|e| e.0),
                    store: files.remove(&SegmentComponent::Store).map(|e| e.0),
                    temp_store: files.remove(&SegmentComponent::TempStore).map(|e| e.0),
                    delete: files
                        .remove(&SegmentComponent::Delete)
                        .map(|(file_entry, _)| DeleteEntry {
                            file_entry,
                            num_deleted_docs: created_segment.num_deleted_docs(),
                        }),
                    vec: files
                        .remove(&SegmentComponent::Custom(VECTOR_VEC_EXT.to_string()))
                        .map(|e| e.0),
                    centroids: files
                        .remove(&SegmentComponent::Custom(VECTOR_CENTROIDS_EXT.to_string()))
                        .map(|e| e.0),
                    stats: files
                        .remove(&SegmentComponent::Custom(STATS_EXT.to_string()))
                        .map(|e| e.0),
                    ctid_map: files
                        .remove(&SegmentComponent::Custom(CTID_MAP_EXT.to_string()))
                        .map(|e| e.0),
                    posting_norms: files.remove(&SegmentComponent::PostingNorms).map(|e| e.0),
                },
            );

            Some(meta_entry)
        })
        .collect::<Vec<_>>();

    //
    // process the modified segments
    //
    // lookup existing version, update the `delete` entry
    // if it already has one, remember the old entry in `orphaned_deletes_files` so it can be
    // re-added below as an immediately-recyclable entry
    // xmin/xmax do not change
    //
    let mut orphaned_deletes_files = Vec::new();
    let modified_entries = modified_ids
        .into_iter()
        .filter_map(|id| {
            let mut files = new_files.remove(id)?;
            assert!(
                files.len() == 1 && files.contains_key(&SegmentComponent::Delete),
                "new files for segment_id `{id}` should be exactly one Delete component:  {files:#?}"
            );

            let existing_segment = incoming_segments.get(id).unwrap();
            let (mut meta_entry, blockno, _) = linked_list
                .lookup_ex(|entry| entry.segment_id() == *id, None)
                .unwrap_or_else(|e| {
                    panic!("segment id `{id}` should be in the segment meta linked list:  {e}")
                });
            let (new_delete_entry, _path) = files
                .remove(&SegmentComponent::Delete)
                .unwrap_or_else(|| panic!("missing new delete file for segment_id `{id}`"));

            let deletes = DeleteEntry {
                file_entry: new_delete_entry,
                num_deleted_docs: existing_segment.num_deleted_docs(),
            };
            if let Some(old_entry) = meta_entry.replace_deletes(deletes) {
                // remember the old delete_entry for future action
                orphaned_deletes_files.push(old_entry);
            }

            Some((meta_entry, blockno))
        })
        .collect::<Vec<_>>();

    //
    // process the deleted segments
    //
    // find the deleted segment entries and set their `xmax` to `FrozenTransactionId`, which is
    // safe because a deleted segment always belongs to a transaction known to not be in progress
    //
    let deleted_entries = deleted_ids
        .into_iter()
        .map(|id| {
            let (mut meta_entry, blockno, _) = linked_list
                .lookup_ex(|entry| entry.segment_id() == *id, None)
                .unwrap_or_else(|e| {
                    panic!("segment id `{id}` should be in the segment meta linked list: {e}")
                });

            // we need to be in a transaction in order to delete segments
            // this means (auto)VACUUM can't do this, but that's okay because it doesn't
            // it only applies .delete files, which we consider as modifications
            assert!(pg_sys::IsTransactionState());

            assert!(
                meta_entry.xmax() == pg_sys::InvalidTransactionId,
                "SegmentMetaEntry {} should not already be deleted",
                meta_entry.segment_id()
            );

            // deleted segments belong to a transaction that is known to not be in progress
            // and so when we mark them as deleted, it'll be with a transaction that is known to
            // not be in progress, the FrozenTransactionId.
            meta_entry.set_xmax(pg_sys::FrozenTransactionId);

            (meta_entry, blockno)
        })
        .collect::<Vec<_>>();

    //
    // recycle anything leftover in `new_files` to our input `d
```

### Core Architecture Module: `pg_search/src/index/reader/scorer.rs`
```
// Copyright (c) 2023-2026 ParadeDB, Inc.
//
// This file is part of ParadeDB - Postgres for Search and Analytics
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

use crate::index::reader::index::enable_scoring;
use std::sync::{Arc, OnceLock};
use tantivy::query::{BooleanQuery, Occur, PruningScorer, Query, Scorer, Weight};
use tantivy::{DocAddress, DocId, DocSet, Score, Searcher, SegmentOrdinal, SegmentReader};

#[cfg(any(test, feature = "pg_test"))]
pub(crate) mod test_support {
    use std::sync::atomic::AtomicUsize;

    /// Number of deferred per-segment scorers that crossed the actual Tantivy open boundary.
    pub(crate) static SCORERS_OPENED: AtomicUsize = AtomicUsize::new(0);
}

/// Lazily builds one [`Weight`] and shares it across a search's segments.
///
/// A scored weight aggregates corpus-level term statistics: `doc_freq` walks every
/// segment's term dictionary. Building the weight per segment therefore costs
/// segments² dictionary lookups per query, which dominates scored scans on
/// many-segment indexes.
pub struct LazyWeight {
    query: Box<dyn Query>,
    need_scores: bool,
    searcher: Searcher,
    weight: OnceLock<Box<dyn Weight>>,
}

impl LazyWeight {
    pub fn new(query: Box<dyn Query>, need_scores: bool, searcher: Searcher) -> Self {
        Self {
            query,
            need_scores,
            searcher,
            weight: Default::default(),
        }
    }

    /// Conjoin another query using the same searcher and scoring mode.
    /// Each segment still receives its own scorer.
    pub(super) fn and_query(self: &Arc<Self>, query: Box<dyn Query>) -> Self {
        Self::new(
            Box::new(BooleanQuery::new(vec![
                (Occur::Must, self.query.box_clone()),
                (Occur::Must, query),
            ])),
            self.need_scores,
            self.searcher.clone(),
        )
    }

    fn get(&self) -> &dyn Weight {
        self.weight
            .get_or_init(|| {
                self.query
                    .weight(enable_scoring(self.need_scores, &self.searcher))
                    .expect("weight should be constructable")
            })
            .as_ref()
    }
}

pub struct DeferredScorer {
    weight: Arc<LazyWeight>,
    segment_reader: SegmentReader,
    scorer: OnceLock<Box<dyn PruningScorer>>,
}

impl DeferredScorer {
    pub fn new(weight: Arc<LazyWeight>, segment_reader: SegmentReader) -> Self {
        Self {
            weight,
            segment_reader,
            scorer: Default::default(),
        }
    }

    #[track_caller]
    #[inline(always)]
    fn scorer_mut(&mut self) -> &mut dyn PruningScorer {
        self.scorer();
        self.scorer
            .get_mut()
            .expect("deferred scorer should have been initialized")
    }

    #[track_caller]
    #[inline(always)]
    fn scorer(&self) -> &dyn PruningScorer {
        self.scorer.get_or_init(|| {
            #[cfg(any(test, feature = "pg_test"))]
            test_support::SCORERS_OPENED.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            self.weight
                .get()
                .pruning_scorer(&self.segment_reader, 1.0, Score::MIN)
                .expect("pruning scorer should be constructable")
        })
    }

    fn set_threshold(&mut self, threshold: Score) {
        self.scorer_mut().set_threshold(threshold);
    }
}

impl DocSet for DeferredScorer {
    #[inline(always)]
    fn advance(&mut self) -> DocId {
        self.scorer_mut().advance()
    }

    #[inline(always)]
    fn doc(&self) -> DocId {
        self.scorer().doc()
    }

    fn size_hint(&self) -> u32 {
        self.scorer().size_hint()
    }
}

impl Scorer for DeferredScorer {
    #[inline(always)]
    fn score(&mut self) -> Score {
        self.scorer_mut().score()
    }
}

pub struct ScorerIter {
    deferred: DeferredScorer,
    segment_ord: SegmentOrdinal,
    segment_reader: SegmentReader,
}

impl ScorerIter {
    pub fn new(
        scorer: DeferredScorer,
        segment_ord: SegmentOrdinal,
        segment_reader: SegmentReader,
    ) -> Self {
        Self {
            deferred: scorer,
            segment_ord,
            segment_reader,
        }
    }

    pub fn segment_ord(&self) -> SegmentOrdinal {
        self.segment_ord
    }

    pub fn segment_id(&self) -> tantivy::index::SegmentId {
        self.segment_reader.segment_id()
    }

    /// Returns the estimated number of documents that will be yielded by this iterator.
    ///
    /// This is used for query planning statistics and uses Tantivy's `size_hint`.
    pub fn estimated_doc_count(&self) -> u32 {
        self.deferred.size_hint()
    }

    pub fn set_threshold(&mut self, threshold: Score) {
        self.deferred.set_threshold(threshold);
    }
}

impl Iterator for ScorerIter {
    type Item = (Score, DocAddress);

    fn next(&mut self) -> Option<Self::Item> {
        loop {
            let doc_id = self.deferred.doc();

            if doc_id == tantivy::TERMINATED {
                // we've read all the docs
                return None;
            } else if self
                .segment_reader
                .alive_bitset()
                .map(|alive_bitset| alive_bitset.is_alive(doc_id))
                // if there's no alive_bitset, the doc is alive
                .unwrap_or(true)
            {
                // this doc is alive
                let score = self.deferred.score();
                let this = (score, DocAddress::new(self.segment_ord, doc_id));

                // move to the next doc for the next iteration
                self.deferred.advance();

                // return the live doc
                return Some(this);
            }

            // this doc isn't alive, move to the next doc and loop around
            self.deferred.advance();
        }
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        // NOTE: We do not implement size_hint for `ScorerIter`, because the implementation of
        // `Scorer::size_hint` can take a lot longer to execute than is usually expected from
        // `Iterator::size_hint`. We also never consume a `ScorerIter` in a way that requires an
        // accurate size: when consuming for Top K, we consume a precise amount, and in all other
        // cases the iterator is consumed as streaming.
        (0, None)
    }
}

```

### Core Architecture Module: `pg_search/src/parallel_worker/mod.rs`
```
// Copyright (c) 2023-2026 ParadeDB, Inc.
//
// This file is part of ParadeDB - Postgres for Search and Analytics
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

//! Provides an abstract API over Postgres' parallel workers, allowing for the implementation of
//! different strategies for distributing work across processes.

pub mod builder;
pub mod mqueue;

use crate::parallel_worker::mqueue::{MessageQueueSendError, MessageQueueSender};
use pgrx::pg_sys;
use std::error::Error;
use std::fmt::Display;
use std::ptr::NonNull;

/// Describes the kind of parallel worker process being built
pub enum WorkerStyle {
    Query,
    Maintenance,
}

impl WorkerStyle {
    /// Returns the current Postgres-configured maximum number of workers for this [`WorkerStyle`]
    pub fn max(&self) -> usize {
        match self {
            WorkerStyle::Query => unsafe { pg_sys::max_parallel_workers_per_gather as usize },
            WorkerStyle::Maintenance => unsafe {
                pg_sys::max_parallel_maintenance_workers as usize
            },
        }
    }
}

#[repr(u64)]
enum TocKeys {
    MessageQueues = 1,
    UserStateLength = 2,
    UserState = 3,
}

impl From<TocKeys> for u64 {
    fn from(key: TocKeys) -> Self {
        key as _
    }
}

/// Marker for plain-old-data types stored in DSM entries as raw bytes.
///
/// Requires [`bytemuck::Pod`], which guarantees: `#[repr(C)]` layout, no
/// uninitialised padding bytes, and every bit pattern is a valid instance.
/// These properties let `as_bytes()` and `object()`/`slice()` operate
/// without undefined behaviour.
pub trait ParallelStateType: bytemuck::Pod {}

pub trait ParallelState {
    /// A binary representation of the header information necessary to store/retrieve [`ParallelState`]
    /// in shared memory
    fn info(&self) -> Vec<u8> {
        let mut info = Vec::new();
        let type_name = self.type_name();
        let nbytes = size_of::<usize>() + size_of::<usize>() + type_name.len();
        info.extend(nbytes.to_ne_bytes());
        info.extend(self.array_len().to_ne_bytes());
        info.extend(self.type_name().as_bytes());

        info
    }

    /// Returns the rust type name of the implementing type, or element if an array/vec
    fn type_name(&self) -> &'static str {
        std::any::type_name::<Self>()
    }

    /// Returns the size of the type, in bytes, as represented in memory
    fn size_of(&self) -> usize {
        size_of_val(self)
    }

    /// Returns the number of elements in the array/vec, or `1` if it's not an array/vec
    fn array_len(&self) -> usize {
        1
    }

    /// Return a byte slice pointing to the raw bytes of this instance in memory
    fn as_bytes(&self) -> &[u8];

    /// When true, the builder allocates this entry's space in the DSM but copies nothing
    /// into it; the contents start uninitialized. For large regions whose first writer runs
    /// after the DSM is mapped, this skips materializing (and zeroing) a same-sized buffer
    /// on the host side only to memcpy it over.
    ///
    /// Implementations must record an element type that accepts any bit pattern (`u8` in
    /// practice), so the [`ParallelStateManager`] type check keeps readers from viewing
    /// unwritten bytes as anything stricter.
    fn reserve_only(&self) -> bool {
        false
    }
}

/// A [`ParallelState`] entry that only reserves `len` bytes in the DSM (see
/// [`ParallelState::reserve_only`]). The entry is recorded as `u8`, so the
/// [`ParallelStateManager`] type check hands it back only as a byte slice, and every bit
/// pattern is a valid `u8`.
pub struct UninitializedBytesParallelState {
    len: usize,
}

impl UninitializedBytesParallelState {
    /// # Safety
    ///
    /// The reserved bytes hold no meaningful value until a consumer writes them in place.
    /// The caller asserts that the protocol run over the region tolerates that: its first
    /// writer runs before any read that depends on the contents.
    pub unsafe fn new(len: usize) -> Self {
        Self { len }
    }
}

impl ParallelState for UninitializedBytesParallelState {
    fn type_name(&self) -> &'static str {
        std::any::type_name::<u8>()
    }

    fn size_of(&self) -> usize {
        self.len
    }

    fn array_len(&self) -> usize {
        self.len
    }

    fn as_bytes(&self) -> &[u8] {
        &[]
    }

    fn reserve_only(&self) -> bool {
        true
    }
}

impl ParallelStateType for u8 {}
impl ParallelStateType for u16 {}
impl ParallelStateType for u32 {}
impl ParallelStateType for u64 {}
impl ParallelStateType for usize {}
impl ParallelStateType for i8 {}
impl ParallelStateType for i16 {}
impl ParallelStateType for i32 {}
impl ParallelStateType for i64 {}
impl ParallelStateType for isize {}
impl ParallelStateType for f32 {}
impl ParallelStateType for f64 {}

impl<T: ParallelStateType> ParallelState for T {
    fn as_bytes(&self) -> &[u8] {
        bytemuck::bytes_of(self)
    }
}

impl<T: ParallelStateType> ParallelState for Vec<T> {
    fn type_name(&self) -> &'static str {
        std::any::type_name::<T>()
    }
    fn size_of(&self) -> usize {
        self.len() * size_of::<T>()
    }
    fn array_len(&self) -> usize {
        self.len()
    }
    fn as_bytes(&self) -> &[u8] {
        bytemuck::cast_slice(self.as_slice())
    }
}

pub trait ParallelProcess {
    fn state_values(&self) -> Vec<&dyn ParallelState>;
}

pub trait ParallelWorker {
    fn new_parallel_worker(state_manager: ParallelStateManager) -> Self
    where
        Self: Sized;

    fn run(self, mq_sender: &MessageQueueSender, worker_number: i32) -> anyhow::Result<()>;
}

/// Consumes a [`ParallelWorker::run`] result and decides how the worker exits.
///
/// `MessageQueueSendError::Detached` is treated as a benign teardown signal,
/// not a failure: the leader has already dropped its end of the result queue
/// and is no longer listening, so there is nothing useful the worker can do
/// except exit cleanly. This matches upstream Postgres's handling of tuple
/// queues in `tqueueReceiveSlot` (`src/backend/executor/tqueue.c`) and the
/// proactive detach pattern in `ExecParallelFinish`
/// (`src/backend/executor/execParallel.c`).
///
/// Any other error panics. The panic is caught by `#[pgrx::pg_guard]` at the
/// macro-expanded entry point and surfaced through Postgres's normal parallel
/// worker error reporting path in `WaitForParallelWorkersToFinish`
/// (`src/backend/access/transam/parallel.c`).
#[doc(hidden)]
pub fn finish_parallel_worker(result: anyhow::Result<()>) {
    match result {
        Ok(()) => {}
        Err(err) if is_detached_send_error(&err) => {
            log_detached_send();
        }
        Err(err) => panic!("{err}"),
    }
}

fn is_detached_send_error(err: &anyhow::Error) -> bool {
    err.chain().any(|cause| {
        matches!(
            cause.downcast_ref::<MessageQueueSendError>(),
            Some(MessageQueueSendError::Detached)
        )
    })
}

fn log_detached_send() {
    pgrx::debug1!(
        "parallel worker {}: leader detached before receive",
        unsafe { pg_sys::ParallelWorkerNumber }
    );
}

#[derive(Copy, Clone)]
pub struct ParallelStateManager {
    toc: NonNull<pg_sys::shm_toc>,
    len: usize,
    seg: *mut pg_sys::dsm_segment,
}

#[derive(Debug)]
pub enum ValueError {
    WrongType(String, String),
}

impl Error for ValueError {}

impl Display for ValueError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ValueError::WrongType(wanted, got) => {
                write!(f, "Wrong type, expected `{wanted}`, got `{got}`")
            }
        }
    }
}

impl ParallelStateManager {
    pub(crate) fn new(toc: *mut pg_sys::shm_toc, seg: *mut pg_sys::dsm_segment) -> Self {
        assert!(!toc.is_null());
        unsafe {
            let ptr = pg_sys::shm_toc_lookup(toc, TocKeys::UserStateLength.into(), true);
            let len = *ptr.cast();

            Self {
                toc: NonNull::new(toc).unwrap_unchecked(),
                len,
                seg,
            }
        }
    }

    /// The DSM segment the state lives in, for shared regions whose lifetime hooks onto it (a
    /// `SharedFileSet` a worker attaches to, for one).
    pub fn dsm_segment(&self) -> *mut pg_sys::dsm_segment {
        self.seg
    }

    unsafe fn decode_info<T: Copy + 'static>(
        &self,
        i: usize,
    ) -> Result<Option<(usize, &str)>, ValueError> {
        let idx: u64 = TocKeys::UserState.into();
        let idx = idx + i as u64;
        let ptr = pg_sys::shm_toc_lookup(self.toc.as_ptr(), idx, true);
        if ptr.is_null() {
            return Ok(None);
        }

        let info_len: usize = *ptr.cast();
        let len: usize = *ptr.add(size_of::<usize>()).cast();
        let type_name_len = info_len - (size_of::<usize>() * 2);
        let type_name = std::str::from_utf8(std::slice::from_raw_parts(
            ptr.add(size_of::<usize>() * 2).cast(),
            type_name_len,
        ))
        .expect("type_name should be valid UTF-8");

        if type_name != std::any::type_name::<T>() {
            return Err(ValueError::WrongType(
                type_name.to_owned(),
                std::any::type_name::<T>().to_owned(),
            ));
        }

        Ok(Some((len, type_name)))
    }

    unsafe fn lookup_entry<T: Copy + 'stati
```

### Core Architecture Module: `pg_search/src/parallel_worker/mqueue.rs`
```
// Copyright (c) 2023-2026 ParadeDB, Inc.
//
// This file is part of ParadeDB - Postgres for Search and Analytics
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

use pgrx::pg_sys;
use std::error::Error;
use std::fmt::{Display, Formatter};
use std::ptr::NonNull;

struct MessageQueueHandle {
    handle: NonNull<pg_sys::shm_mq_handle>,
}

crate::impl_safe_drop!(MessageQueueHandle, |self| {
    unsafe {
        if pg_sys::IsInParallelMode() {
            pg_sys::shm_mq_detach(self.handle.as_ptr());
        }
    }
});

impl MessageQueueHandle {
    unsafe fn attach_sender(seg: *mut pg_sys::dsm_segment, mq: *mut pg_sys::shm_mq) -> Self {
        unsafe {
            pg_sys::shm_mq_set_sender(mq, pg_sys::MyProc);
            let handle = pg_sys::shm_mq_attach(mq, seg, std::ptr::null_mut());
            MessageQueueHandle {
                handle: NonNull::new_unchecked(handle),
            }
        }
    }

    unsafe fn attach_receiver(
        pcxt: NonNull<pg_sys::ParallelContext>,
        mq: *mut pg_sys::shm_mq,
    ) -> Self {
        unsafe {
            pg_sys::shm_mq_set_receiver(mq, pg_sys::MyProc);
            let handle = pg_sys::shm_mq_attach(mq, (*pcxt.as_ptr()).seg, std::ptr::null_mut());
            MessageQueueHandle {
                handle: NonNull::new_unchecked(handle),
            }
        }
    }

    fn as_ptr(&self) -> *mut pg_sys::shm_mq_handle {
        self.handle.as_ptr()
    }
}

#[derive(Debug, Copy, Clone)]
pub enum MessageQueueSendError {
    Detached,
    WouldBlock,
    Unknown(pg_sys::shm_mq_result::Type),
}

impl Display for MessageQueueSendError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            MessageQueueSendError::Detached => write!(f, "queue is detached"),
            MessageQueueSendError::WouldBlock => write!(f, "queue is full"),
            MessageQueueSendError::Unknown(other) => write!(f, "unknown error code: {other}"),
        }
    }
}

impl Error for MessageQueueSendError {}

impl From<pg_sys::shm_mq_result::Type> for MessageQueueSendError {
    fn from(value: pg_sys::shm_mq_result::Type) -> Self {
        match value {
            pg_sys::shm_mq_result::SHM_MQ_WOULD_BLOCK => Self::WouldBlock,
            pg_sys::shm_mq_result::SHM_MQ_DETACHED => Self::Detached,
            other => Self::Unknown(other),
        }
    }
}

pub struct MessageQueueSender {
    handle: MessageQueueHandle,
}

impl MessageQueueSender {
    #[doc(hidden)]
    pub(crate) unsafe fn new(seg: *mut pg_sys::dsm_segment, mq: *mut pg_sys::shm_mq) -> Self {
        unsafe {
            Self {
                handle: MessageQueueHandle::attach_sender(seg, mq),
            }
        }
    }

    pub fn send<B: AsRef<[u8]>>(&self, msg: B) -> Result<(), MessageQueueSendError> {
        unsafe {
            let msg = msg.as_ref();
            let result = pg_sys::shm_mq_send(
                self.handle.as_ptr(),
                msg.len(),
                msg.as_ptr() as *mut std::ffi::c_void,
                false,
                true,
            );

            match result {
                pg_sys::shm_mq_result::SHM_MQ_SUCCESS => Ok(()),
                other => Err(MessageQueueSendError::from(other)),
            }
        }
    }

    #[allow(dead_code)]
    pub fn try_send(&self, msg: &[u8]) -> Result<Option<()>, MessageQueueSendError> {
        unsafe {
            let result = pg_sys::shm_mq_send(
                self.handle.as_ptr(),
                msg.len(),
                msg.as_ptr() as *mut std::ffi::c_void,
                true,
                true,
            );

            match result {
                pg_sys::shm_mq_result::SHM_MQ_SUCCESS => Ok(Some(())),
                pg_sys::shm_mq_result::SHM_MQ_WOULD_BLOCK => Ok(None),
                other => Err(MessageQueueSendError::from(other)),
            }
        }
    }
}

#[derive(Debug, Copy, Clone)]
pub enum MessageQueueRecvError {
    Detached,
    WouldBlock,
    Unknown(pg_sys::shm_mq_result::Type),
}

impl Display for MessageQueueRecvError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            MessageQueueRecvError::Detached => write!(f, "queue is detached"),
            MessageQueueRecvError::WouldBlock => write!(f, "queue is empty"),
            MessageQueueRecvError::Unknown(other) => write!(f, "unknown error code: {other}"),
        }
    }
}

impl Error for MessageQueueRecvError {}

impl From<pg_sys::shm_mq_result::Type> for MessageQueueRecvError {
    fn from(value: pg_sys::shm_mq_result::Type) -> Self {
        match value {
            pg_sys::shm_mq_result::SHM_MQ_WOULD_BLOCK => Self::WouldBlock,
            pg_sys::shm_mq_result::SHM_MQ_DETACHED => Self::Detached,
            other => Self::Unknown(other),
        }
    }
}

pub struct MessageQueueReceiver {
    handle: MessageQueueHandle,
}

impl MessageQueueReceiver {
    pub(crate) unsafe fn new(
        pcxt: NonNull<pg_sys::ParallelContext>,
        address: *mut std::ffi::c_void,
        size: usize,
    ) -> Self {
        unsafe {
            let mq = pg_sys::shm_mq_create(address, size);
            Self {
                handle: MessageQueueHandle::attach_receiver(pcxt, mq),
            }
        }
    }

    /// Wrap an already-acquired `shm_mq_handle` pointer directly. Used by
    /// the MPP mesh where `shm_mq_attach` is called from a non-standard
    /// layout (one `shm_mq_create` up front for every mesh slot, then each
    /// participant attaches as sender or receiver separately).
    ///
    /// # Safety
    /// `handle` must be a non-null `shm_mq_handle*` returned by a successful
    /// `shm_mq_attach` call, and ownership of the handle (detach on drop) is
    /// transferred into the returned receiver.
    pub unsafe fn from_raw_handle(handle: *mut pg_sys::shm_mq_handle) -> Self {
        Self {
            handle: MessageQueueHandle {
                handle: unsafe { NonNull::new_unchecked(handle) },
            },
        }
    }

    pub fn recv(&self) -> Result<Vec<u8>, MessageQueueRecvError> {
        unsafe {
            let mut len = 0usize;
            let mut msg = std::ptr::null_mut();
            let result = pg_sys::shm_mq_receive(self.handle.as_ptr(), &mut len, &mut msg, false);

            match result {
                pg_sys::shm_mq_result::SHM_MQ_SUCCESS => {
                    Ok(std::slice::from_raw_parts(msg as *mut u8, len).to_vec())
                }
                other => Err(MessageQueueRecvError::from(other)),
            }
        }
    }

    pub fn try_recv(&self) -> Result<Option<Vec<u8>>, MessageQueueRecvError> {
        unsafe {
            let mut len = 0usize;
            let mut msg = std::ptr::null_mut();
            let result = pg_sys::shm_mq_receive(self.handle.as_ptr(), &mut len, &mut msg, true);

            match result {
                pg_sys::shm_mq_result::SHM_MQ_SUCCESS => Ok(Some(
                    std::slice::from_raw_parts(msg as *mut u8, len).to_vec(),
                )),
                pg_sys::shm_mq_result::SHM_MQ_WOULD_BLOCK => Ok(None),
                other => Err(MessageQueueRecvError::from(other)),
            }
        }
    }
}

```

### Core Architecture Module: `pg_search/src/postgres/customscan/aggregatescan/scan_state.rs`
```
// Copyright (c) 2023-2026 ParadeDB, Inc.
//
// This file is part of ParadeDB - Postgres for Search and Analytics
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

use crate::customscan::aggregatescan::AggregateCSClause;
use crate::customscan::aggregatescan::exec::AggregationResultsRow;
use crate::index::reader::index::SearchIndexManifest;
use crate::postgres::PgSearchRelation;
use crate::postgres::customscan::CustomScanState;
use crate::postgres::customscan::aggregatescan::join_targetlist::JoinAggregateTargetList;
use crate::postgres::customscan::aggregatescan::pdb_agg::PdbAggPlan;
use crate::postgres::customscan::aggregatescan::privdat::{DataFusionTopK, FilterExpr};
use crate::postgres::customscan::bitmap_intersection::BitmapExec;
use crate::postgres::customscan::joinscan::build::RelNode;
use crate::postgres::customscan::mpp::glue::MppLaunchTiming;
use crate::postgres::customscan::mpp::launch::MppLifecycle;
use crate::postgres::customscan::projections::{PlaceholderColumn, PlaceholderProjection};
use crate::postgres::customscan::solve_expr::SolvePostgresExpressions;
use crate::postgres::heap::VisibilityStats;
use crate::query::tid_bitmap_stream::BitmapCell;

use arrow_array::RecordBatch;
use datafusion::physical_plan::SendableRecordBatchStream;
use pgrx::pg_sys;

use super::AggIndexInfo;

#[derive(Default)]
pub enum ExecutionState {
    #[default]
    NotStarted,
    Emitting(std::vec::IntoIter<AggregationResultsRow>),
    Completed,
}

/// State for the DataFusion aggregate execution backend.
pub struct DataFusionAggState {
    /// The join tree.
    pub plan: RelNode,
    /// Original plan preserved for rescans.
    pub base_plan: Option<RelNode>,
    /// GROUP BY columns and aggregate functions.
    pub targetlist: JoinAggregateTargetList,
    /// Optional TopK sort+limit pushed down from Postgres.
    pub topk: Option<DataFusionTopK>,
    /// Raw PG Expr pointers from custom_exprs (after setrefs transforms
    /// Var nodes to INDEX_VAR references). Used to translate non-@@@
    /// cross-table predicates at execution time.
    pub custom_exprs: *mut pg_sys::List,
    /// The custom_scan_tlist from the CustomScan node. Used to resolve
    /// INDEX_VAR references in custom_exprs back to original (rti, attno)
    /// pairs during DataFusion expression translation.
    pub custom_scan_tlist: *mut pg_sys::List,
    /// HAVING clause filter applied after aggregation.
    pub having_filter: Option<FilterExpr>,
    /// Tokio runtime for async DataFusion execution.
    pub runtime: Option<tokio::runtime::Runtime>,
    /// The executed physical plan, kept so EXPLAIN ANALYZE can merge the worker metrics that
    /// arrive over the mesh into its display.
    pub physical_plan: Option<std::sync::Arc<dyn datafusion::physical_plan::ExecutionPlan>>,
    /// DataFusion result stream.
    pub stream: Option<SendableRecordBatchStream>,
    /// Current batch being consumed row-by-row.
    pub current_batch: Option<RecordBatch>,
    /// Row index within current_batch.
    pub batch_row_idx: usize,
    /// Mapping from `group_columns[i]` to its 0-based column index in DataFusion's
    /// output RecordBatch. Needed because DataFusion deduplicates grouping
    /// expressions (e.g. metadata.brand).
    pub group_df_indices: Vec<usize>,
    /// The number of grouping columns in DataFusion's output RecordBatch.
    pub num_group_exprs: usize,
    /// The `pdb.agg()` grouping-set layout, set when the query has any such call.
    pub pdb_plan: Option<PdbAggPlan>,
    /// `HAVING` of a scalar `pdb.agg()` query, judged on the assembled root row.
    pub pdb_root_having: Option<datafusion::logical_expr::Expr>,
    /// Assembled `pdb.agg()` documents for each row of `current_batch`, which then
    /// holds the SQL-level rows only.
    pub pdb_agg_json: Option<Vec<Vec<serde_json::Value>>>,
    /// Where MPP sits in its launch lifecycle for this scan: marked pending at begin, launched
    /// on first exec once the built plan's stages are committed (#5667: the plan comes first;
    /// workers spawn only after it exists). Stays `Inactive` on the serial path.
    /// Applies only when parallel execution is enabled and the query qualifies (binary join +
    /// supported aggregate).
    pub mpp: MppLifecycle,
    /// Captured from PostgreSQL's statement-wide `PlannerGlobal.parallelModeOK`. When false, this
    /// scan may still use DataFusion, but it must never launch MPP producer workers.
    pub parallel_mode_ok: bool,
    /// Per-phase launch timing for `EXPLAIN ANALYZE`'s `MPP Launch` line. Set only when the
    /// query launched distributed.
    pub launch_timing: Option<MppLaunchTiming>,
    /// Set (at most once) by `build_task_context`'s `on_spill` callback the first time the
    /// leader's own local execution spills an operator to disk. Serial queries have no
    /// `ParallelScanState` to record this in, so it's tracked here instead; `shutdown_custom_scan`
    /// reads it directly for the serial case, and ORs it with `ParallelScanState::did_spill()`
    /// for the MPP case, since the leader can spill locally in addition to (or instead of) any
    /// worker.
    pub spilled: std::sync::Arc<std::sync::atomic::AtomicBool>,
}

/// State for projecting wrapped aggregate expressions through Postgres' own
/// `ExecBuildProjectionInfo`.
///
/// When the targetlist contains aggregates wrapped in `FuncExpr` calls, we
/// build a copy of the targetlist with each `FuncExpr`'s aggregate replaced by
/// a placeholder, and project that copy. Before each per-row projection we
/// write the live aggregate values into the placeholder columns.
pub struct WrappedAggregateProjection {
    /// Projection of the targetlist copy, built one time for the scan.
    pub projection: PlaceholderProjection,
    /// The placeholder column and its type, indexed by target entry position
    /// (0-based). `None` for entries without a placeholder.
    pub placeholders: Vec<Option<(PlaceholderColumn, pg_sys::Oid)>>,
}

#[derive(Default)]
pub struct AggregateScanState {
    pub visibility_stats: VisibilityStats,
    pub state: ExecutionState,
    pub indexrelid: pg_sys::Oid,
    pub indexrel: Option<(pg_sys::LOCKMODE, PgSearchRelation)>,
    pub execution_rti: pg_sys::Index,
    pub aggregate_clause: AggregateCSClause,
    pub base_aggregate_clause: Option<AggregateCSClause>,

    /// Execution state for the child bitmap scan, if a bitmap intersection source was
    /// harvested at plan time.
    pub bitmap_exec: Option<BitmapExec>,
    pub bitmap_cell: Option<BitmapCell>,

    /// DataFusion backend state. When `Some`, the DataFusion path is active
    /// and the Tantivy-specific fields above are unused.
    pub datafusion_state: Option<DataFusionAggState>,

    /// Wrapped-aggregate projection state. `Some` only when the targetlist
    /// has aggregates inside `FuncExpr` wrappers that need per-row projection.
    pub wrapped_projection: Option<WrappedAggregateProjection>,

    /// Tantivy-only reusable tuple slot for aggregate result rows.
    /// Created once during begin_custom_scan and cleared/reused for each row
    /// to avoid per-row memory allocation and leaks
    pub scan_slot: Option<*mut pg_sys::TupleTableSlot>,

    /// MPP-only: captured source manifests held by the leader. Serves two
    /// purposes (mirrors JoinScan):
    /// 1. Provides segment counts for DSM sizing in `estimate_dsm_custom_scan`
    ///    and segment readers for DSM population in `initialize_dsm_custom_scan`.
    /// 2. Keeps Tantivy buffer pins alive through `exec_custom_scan` so
    ///    background merges don't recycle the canonical segments before
    ///    workers can open them via `MvccSatisfies::ParallelWorker(ids)`.
    pub source_manifests: Vec<SearchIndexManifest>,

    /// A collection of things needed for result-rewriting decisions that
    /// are expensive to look up.
    precomputed_index_info: Option<AggIndexInfo>,
}

impl AggregateScanState {
    pub fn open_relations(&mut self, lockmode: pg_sys::LOCKMODE) {
        self.indexrel = Some((
            lockmode,
            PgSearchRelation::with_lock(self.indexrelid, lockmode),
        ));
        self.precomputed_index_info = Some(AggIndexInfo::from(self.indexrel()))
    }

    #[inline(always)]
    pub fn indexrel(&self) -> &PgSearchRelation {
        self.indexrel
            .as_ref()
            .map(|(_, rel)| rel)
            .expect("BaseScanState: indexrel should be initialized")
    }

    /// Returns true if the DataFusion backend is active.
    pub fn is_datafusion_backend(&self) -> bool {
        self.datafusion_state.is_some()
    }

    pub fn precomputed_index_info(&self) -> Option<&AggIndexInfo> {
        self.precomputed_index_info.as_ref()
    }
}

impl CustomScanState for AggregateScanState {
    fn init_exec_method(&mut self, _cstate: *mut pg_sys::CustomScanState) {
        // TODO: Unused currently. See the comment on `trait CustomScanState` regarding making this
        // more useful.
    }
}

impl SolvePostgresExpressions for AggregateScanState {
    fn has_postgres_expressions(&mut self) -> bool {
        // Check both the Tantivy-path search queries and DataFusion-path
        // join-level predicates for unresolved PostgresExpression nodes
        // (prepared statement parameters like $1).
        if let Some(ref mut df) = self.datafusion_state {
            let 
```

### Core Architecture Module: `pg_search/src/postgres/customscan/basescan/projections/score.rs`
```
// Copyright (c) 2023-2026 ParadeDB, Inc.
//
// This file is part of ParadeDB - Postgres for Search and Analytics
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

use crate::nodecast;
use crate::postgres::customscan::score_funcoids;
use pgrx::{AnyElement, PgList, extension_sql, pg_extern, pg_sys};

#[pgrx::pg_schema]
mod pdb {
    use pgrx::{AnyElement, extension_sql, pg_extern};

    #[allow(unused_variables)]
    #[pg_extern(name = "score", stable, parallel_safe, cost = 1)]
    fn score_from_relation(relation_reference: AnyElement) -> f32 {
        panic!(
            "Unsupported query shape. Please report at https://github.com/paradedb/paradedb/issues/new/choose"
        );
    }

    extension_sql!(
        r#"
    ALTER FUNCTION pdb.score SUPPORT paradedb.placeholder_support;
    "#,
        name = "score_placeholder",
        requires = [score_from_relation, placeholder_support]
    );
}

// In `0.19.0`, we renamed the schema from `paradedb` to `pdb`.
// This is a backwards compatibility shim to ensure that old queries continue to work.
#[warn(deprecated)]
#[allow(unused_variables)]
#[pg_extern(name = "score", stable, parallel_safe, cost = 1)]
fn paradedb_score_from_relation(relation_reference: AnyElement) -> Option<f32> {
    panic!(
        "Unsupported query shape. Please report at https://github.com/paradedb/paradedb/issues/new/choose"
    );
}

extension_sql!(
    r#"
    ALTER FUNCTION paradedb.score SUPPORT paradedb.placeholder_support;
    "#,
    name = "paradedb_score_placeholder",
    requires = [paradedb_score_from_relation, placeholder_support]
);

pub unsafe fn is_score_func(node: *mut pg_sys::Node, rti: pg_sys::Index) -> bool {
    if let Some(funcexpr) = nodecast!(FuncExpr, T_FuncExpr, node)
        && score_funcoids().contains(&(*funcexpr).funcid)
    {
        let args = PgList::<pg_sys::Node>::from_pg((*funcexpr).args);
        assert!(args.len() == 1, "score function must have 1 argument");
        if let Some(var) = nodecast!(Var, T_Var, args.get_ptr(0).unwrap())
            && (*var).varno as i32 == rti as i32
        {
            return true;
        }
    }

    false
}

```

### Core Architecture Module: `pg_search/src/postgres/customscan/basescan/scan_state.rs`
```
// Copyright (c) 2023-2026 ParadeDB, Inc.
//
// This file is part of ParadeDB - Postgres for Search and Analytics
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

use std::cell::UnsafeCell;
use std::collections::BTreeMap;
use std::sync::Arc;

use crate::api::{FieldName, HashMap, OrderByInfo, Varno};
use crate::customscan::CustomScanState;
use crate::index::fast_fields_helper::FFHelper;
use crate::index::reader::index::SearchIndexReader;
use crate::postgres::customscan::basescan::cost::WorkerDecisionReason;
use crate::postgres::customscan::basescan::exec_methods::ExecMethod;
use crate::postgres::customscan::basescan::parallel::{ParallelRole, ParallelScanHandle};
use crate::postgres::customscan::basescan::projections::snippet::SnippetType;
use crate::postgres::customscan::basescan::projections::snippet::pdb::IntArray2D;
use crate::postgres::customscan::basescan::projections::window_agg::WindowAggregateInfo;
use crate::postgres::customscan::basescan::telemetry::ScanTelemetry;
use crate::postgres::customscan::bitmap_intersection::BitmapExec;
use crate::postgres::customscan::builders::custom_path::ExecMethodType;
use crate::postgres::customscan::projections::{PlaceholderColumn, PlaceholderProjection};
use crate::postgres::customscan::qual_inspect::Qual;
use crate::postgres::customscan::solve_expr::SolvePostgresExpressions;
use crate::postgres::heap::{HeapFetchState, VisibilityChecker};
use crate::postgres::rel::PgSearchRelation;
use crate::postgres::utils::u64_to_item_pointer;
use crate::postgres::{ParallelScanArgs, ParallelScanState};
use crate::query::SearchQueryInput;
use crate::query::tid_bitmap_stream::BitmapCell;

use pgrx::heap_tuple::PgHeapTuple;
use pgrx::{PgTupleDesc, pg_sys};
use tantivy::index::SegmentId;
use tantivy::snippet::SnippetGenerator;

#[derive(Default)]
pub struct BaseScanState {
    pub io_trace: Option<crate::index::reader::io_stats::Trace>,
    /// Process-local EXPLAIN metrics (query counts, per-segment JSON, …).
    pub telemetry: ScanTelemetry,
    /// Set when this scan is parallel-aware (DSM attached).
    pub parallel: Option<ParallelScanHandle>,

    // Note: the range table index at execution time might be different from the one at planning time,
    // so we need to use the one at execution time when creating the custom scan state.
    // But, we also keep the planning RTI for the case when we need to use it for the `var_attname_lookup`
    // because the `var_attname_lookup` is created based on the planning RTI.
    // See https://www.postgresql.org/docs/current/custom-scan-plan.html
    pub planning_rti: pg_sys::Index,
    pub execution_rti: pg_sys::Index,

    base_search_query_input: SearchQueryInput,
    search_query_input: SearchQueryInput,
    pub search_reader: Option<SearchIndexReader>,
    /// Executor startup before `SearchIndexReader::open`; consumed into the
    /// reader's flat `scan_init_ns` metric on first execution.
    pub executor_scan_init_ns: u64,
    /// End-to-end CustomScan execution interval used to assign only the
    /// residual around named nested stages to result assembly.
    /// Whether the current execution is collecting stage timings for
    /// `EXPLAIN ANALYZE`.  Timed queries leave the executor delivery path
    /// uninstrumented.
    pub explain_stage_accounting: bool,

    pub targetlist_len: usize,

    pub virtual_tuple_count: usize,

    pub heaprelid: pg_sys::Oid,
    pub heaprel: Option<PgSearchRelation>,
    pub indexrel: Option<PgSearchRelation>,
    pub indexrelid: pg_sys::Oid,
    pub lockmode: pg_sys::LOCKMODE,

    pub visibility_checker: Option<VisibilityChecker>,
    pub segment_count: usize,
    pub(super) worker_selection_reason: Option<WorkerDecisionReason>,
    pub quals: Option<Qual>,

    pub need_scores: bool,
    pub score_funcoids: [pg_sys::Oid; 2],

    /// True when a junk ORDER-BY `embedding <-> query` `OpExpr` in the scan's
    /// targetlist was replaced with a NULL placeholder `Const` (see
    /// `inject_vector_distance_placeholders`). The value is never read — the
    /// TopK scan already provides the ordering and the column is junk-stripped
    /// — so the placeholder just spares `ExecProject` from calling
    /// `l2_distance(embedding, query)` and detoasting the heap vector. We track
    /// it only so the projection path knows it must use `placeholders`.
    pub vector_distance_placeholder: bool,

    pub snippet_funcoids: [pg_sys::Oid; 2],
    pub snippets_funcoids: [pg_sys::Oid; 2],
    pub snippet_positions_funcoids: [pg_sys::Oid; 2],

    pub snippet_generators: HashMap<SnippetType, Option<SnippetGenerator>>,

    pub var_attname_lookup: HashMap<(Varno, pg_sys::AttrNumber), FieldName>,
    pub placeholders: Option<BasePlaceholders>,

    // Store join-level search predicates for enhanced scoring/snippet generation
    pub join_predicates: Option<SearchQueryInput>,

    pub exec_method_type: ExecMethodType,
    pub ambulkdelete_epoch: u32,

    /// Execution state for the child bitmap scan, if a bitmap intersection source was
    /// harvested at plan time.
    pub bitmap_exec: Option<BitmapExec>,
    pub bitmap_cell: Option<BitmapCell>,

    pub doc_from_heap_state: Option<HeapFetchState>,

    // Window aggregate support
    pub window_aggregates: Vec<WindowAggregateInfo>,
    pub window_aggregate_results: Option<HashMap<usize, pg_sys::Datum>>,

    exec_method: UnsafeCell<Box<dyn ExecMethod>>,
    exec_method_name: String,
}

/// The projection that gives a row its score, snippets and window aggregates, and the placeholder
/// columns it reads them from.
///
/// One struct holds them, because the columns are valid only for the slot of this projection.
pub struct BasePlaceholders {
    pub projection: PlaceholderProjection,
    pub score: PlaceholderColumn,
    pub snippets: HashMap<SnippetType, Vec<PlaceholderColumn>>,
    /// Indexed by target entry position.
    pub window_aggs: HashMap<usize, PlaceholderColumn>,
}

impl CustomScanState for BaseScanState {
    fn init_exec_method(&mut self, cstate: *mut pg_sys::CustomScanState) {
        unsafe {
            // SAFETY: inner_scan_state is always initialized and call to `init()` could never move `self`
            (*self.exec_method.get()).init(self, cstate)
        }
    }
}

impl BaseScanState {
    pub fn open_relations(&mut self, lockmode: pg_sys::LOCKMODE) {
        self.lockmode = lockmode;
        if self.heaprel.is_none() {
            self.heaprel = if lockmode == pg_sys::NoLock as pg_sys::LOCKMODE {
                Some(PgSearchRelation::open(self.heaprelid))
            } else {
                Some(PgSearchRelation::with_lock(self.heaprelid, lockmode))
            }
        };

        if self.indexrel.is_none() {
            self.indexrel = if lockmode == pg_sys::NoLock as pg_sys::LOCKMODE {
                Some(PgSearchRelation::open(self.indexrelid))
            } else {
                Some(PgSearchRelation::with_lock(self.indexrelid, lockmode))
            }
        };
    }

    pub fn set_base_search_query_input(&mut self, input: SearchQueryInput) {
        self.base_search_query_input = input;
    }

    pub fn search_query_input(&self) -> &SearchQueryInput {
        if matches!(self.search_query_input, SearchQueryInput::Uninitialized) {
            panic!("search_query_input should be initialized");
        }
        &self.search_query_input
    }

    /// Get the original base search query input before any modifications
    pub fn base_search_query_input(&self) -> &SearchQueryInput {
        &self.base_search_query_input
    }

    /// Drop the active search results (whose scorers hold bitmap cursors),
    /// keeping the selected exec method: `reset()` re-binds it to the rebuilt
    /// reader after a rescan. Replacing the method here would leave the
    /// default `UnknownScanStyle`, which panics on its next use.
    pub fn reset_exec_results(&mut self) {
        self.exec_method_mut().reset(self);
    }

    /// Drop the current exec method (and with it any search results whose
    /// scorers hold bitmap cursors) before the bitmap machinery is torn down.
    pub fn drop_exec_method(&mut self) {
        self.exec_method = UnsafeCell::new(Default::default());
        self.exec_method_name = String::new();
    }

    #[inline(always)]
    pub fn assign_exec_method<T: ExecMethod + 'static>(
        &mut self,
        method: T,
        updated_exec_method_type: Option<ExecMethodType>,
    ) {
        self.exec_method = UnsafeCell::new(Box::new(method));
        self.exec_method_name = std::any::type_name::<T>().to_string();
        if let Some(exec_method_type) = updated_exec_method_type {
            self.exec_method_type = exec_method_type;
        }
    }

    #[inline(always)]
    pub fn exec_method<'a>(&self) -> &'a dyn ExecMethod {
        let ptr = self.exec_method.get();
        assert!(!ptr.is_null());
        unsafe { ptr.as_ref().unwrap_unchecked().as_ref() }
    }

    #[inline(always)]
    pub fn exec_method_mut<'a>(&mut self) -> &'a mut Box<dyn ExecMethod> {
        let ptr = self.exec_method.get();
        assert!(!ptr.is_null());
        unsafe { ptr.as_mut().unwrap_unchecked() }
    }

    pub fn exec_method_name(&self) -> &str {
        &self.exec_method_name
    }

    pub fn query_to_json(&self) -> serde_json::Result<serde_json::Value> {
        serde_json::to_value(&self.base_search_query_input)
 
```

### Core Architecture Module: `pg_search/src/postgres/customscan/hook.rs`
```
// Copyright (c) 2023-2026 ParadeDB, Inc.
//
// This file is part of ParadeDB - Postgres for Search and Analytics
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

use crate::api::agg_funcoids;
use crate::api::operator::anyelement_search_opoids;
use crate::api::window_aggregate::window_agg_oid;
use crate::gucs;
use crate::nodecast;
use crate::postgres::customscan::aggregatescan::targetlist::TargetList;
use crate::postgres::customscan::basescan::projections::window_agg;
use crate::postgres::customscan::builders::custom_path::{
    CustomPathBuilder, Flags, RestrictInfoType,
};
use crate::postgres::customscan::orderby::validate_topk_compatibility;
use crate::postgres::customscan::qual_inspect::{PlannerContext, QualExtractState, extract_quals};
use crate::postgres::customscan::{CreateUpperPathsHookArgs, CustomScan, RelPathlistHookArgs};
use crate::postgres::node::NodeExt;
use crate::postgres::planner_warnings::{clear_planner_warnings, emit_planner_warnings};
use crate::postgres::rel_get_bm25_index;
use crate::postgres::utils::pg_search_extension_installed;
use once_cell::sync::Lazy;
use pgrx::{PgList, PgMemoryContexts, pg_guard, pg_sys};
use std::collections::{HashMap, hash_map::Entry};

unsafe fn add_path(rel: *mut pg_sys::RelOptInfo, mut path: pg_sys::CustomPath) {
    let forced = path.flags & Flags::Force as u32 != 0;
    let offer_parallel = path.flags & Flags::OfferParallel as u32 != 0;
    // Clear flags that are private to us before handing the path to PostgreSQL.
    path.flags &= !(Flags::Force as u32 | Flags::OfferParallel as u32);

    // Force means our custom path is not interchangeable with native PostgreSQL paths.
    // Clear both complete and partial candidates up front so neither a regular path nor a
    // Gather-built parallel path can outcompete us.
    if forced {
        (*rel).pathlist = std::ptr::null_mut();
        (*rel).partial_pathlist = std::ptr::null_mut();
    }

    let custom_path = PgMemoryContexts::CurrentMemoryContext
        .copy_ptr_into(&mut path, std::mem::size_of_val(&path));

    // Complete (serial) path: add it for consideration and we're done.
    if !(*custom_path).path.parallel_aware {
        pg_sys::add_path(rel, custom_path.cast());
        return;
    }

    // Parallel-aware: offer the partial path so PostgreSQL can build a Gather over it.
    pg_sys::add_partial_path(rel, custom_path.cast());

    // CostedBoth (offer_parallel) stops here -- the real serial sibling stays in the pathlist for a
    // fair compare. Binding parallel (ParallelOnly) instead clears the complete paths and adds a
    // junk-cost serial stub so the Gather must win.
    if !offer_parallel {
        (*rel).pathlist = std::ptr::null_mut();
        let copy = PgMemoryContexts::CurrentMemoryContext
            .copy_ptr_into(&mut path, std::mem::size_of_val(&path));
        (*copy).path.parallel_aware = false;
        (*copy).path.total_cost = 1000000000.0;
        (*copy).path.startup_cost = 1000000000.0;
        pg_sys::add_path(rel, copy.cast());
    }
}

pub fn register_rel_pathlist<CS>(_: CS)
where
    CS: CustomScan<Args = RelPathlistHookArgs> + 'static,
{
    unsafe {
        static mut PREV_HOOKS: Lazy<HashMap<std::any::TypeId, pg_sys::set_rel_pathlist_hook_type>> =
            Lazy::new(Default::default);

        #[pg_guard]
        extern "C-unwind" fn __priv_callback<CS>(
            root: *mut pg_sys::PlannerInfo,
            rel: *mut pg_sys::RelOptInfo,
            rti: pg_sys::Index,
            rte: *mut pg_sys::RangeTblEntry,
        ) where
            CS: CustomScan<Args = RelPathlistHookArgs> + 'static,
        {
            unsafe {
                #[allow(static_mut_refs)]
                if let Some(Some(prev_hook)) = PREV_HOOKS.get(&std::any::TypeId::of::<CS>()) {
                    (*prev_hook)(root, rel, rti, rte);
                }

                paradedb_rel_pathlist_callback::<CS>(root, rel, rti, rte);
            }
        }

        #[allow(static_mut_refs)]
        match PREV_HOOKS.entry(std::any::TypeId::of::<CS>()) {
            Entry::Occupied(_) => panic!("{} is already registered", std::any::type_name::<CS>()),
            Entry::Vacant(entry) => entry.insert(pg_sys::set_rel_pathlist_hook),
        };

        pg_sys::set_rel_pathlist_hook = Some(__priv_callback::<CS>);

        pg_sys::RegisterCustomScanMethods(CS::custom_scan_methods())
    }
}

/// Although this hook function can be used to examine, modify, or remove paths generated by the
/// core system, a custom scan provider will typically confine itself to generating CustomPath
/// objects and adding them to rel using add_path. The custom scan provider is responsible for
/// initializing the CustomPath object, which is declared like this:
#[pg_guard]
pub extern "C-unwind" fn paradedb_rel_pathlist_callback<CS>(
    root: *mut pg_sys::PlannerInfo,
    rel: *mut pg_sys::RelOptInfo,
    rti: pg_sys::Index,
    rte: *mut pg_sys::RangeTblEntry,
) where
    CS: CustomScan<Args = RelPathlistHookArgs> + 'static,
{
    unsafe {
        // Skip dummy relations (proven empty, e.g. via constraint exclusion).
        // Adding a custom path replaces/precedes the dummy Append path in rel->pathlist,
        // breaking is_dummy_rel and crashing Postgres indxpath assertions (Assert(outer_rel->rows > 0)).
        if pg_sys::is_dummy_rel(rel) {
            return;
        }

        if !pg_search_extension_installed() {
            return;
        }

        if !gucs::enable_custom_scan() {
            return;
        }

        let paths = CS::create_custom_path(CustomPathBuilder::new(
            root,
            rel,
            RelPathlistHookArgs {
                root,
                rel,
                rti,
                rte,
            },
        ));

        for path in paths {
            add_path(rel, path);
        }
    }
}

pub fn register_upper_path<CS>(_: CS)
where
    CS: CustomScan<Args = CreateUpperPathsHookArgs> + 'static,
{
    unsafe {
        static mut PREV_HOOKS: Lazy<
            HashMap<std::any::TypeId, pg_sys::create_upper_paths_hook_type>,
        > = Lazy::new(Default::default);

        #[pg_guard]
        extern "C-unwind" fn __priv_callback<CS>(
            root: *mut pg_sys::PlannerInfo,
            stage: pg_sys::UpperRelationKind::Type,
            input_rel: *mut pg_sys::RelOptInfo,
            output_rel: *mut pg_sys::RelOptInfo,
            extra: *mut ::std::os::raw::c_void,
        ) where
            CS: CustomScan<Args = CreateUpperPathsHookArgs> + 'static,
        {
            unsafe {
                #[allow(static_mut_refs)]
                if let Some(Some(prev_hook)) = PREV_HOOKS.get(&std::any::TypeId::of::<CS>()) {
                    (*prev_hook)(root, stage, input_rel, output_rel, extra);
                }

                paradedb_upper_paths_callback::<CS>(root, stage, input_rel, output_rel, extra);
            }
        }

        #[allow(static_mut_refs)]
        match PREV_HOOKS.entry(std::any::TypeId::of::<CS>()) {
            Entry::Occupied(_) => panic!("{} is already registered", std::any::type_name::<CS>()),
            Entry::Vacant(entry) => entry.insert(pg_sys::create_upper_paths_hook),
        };

        pg_sys::create_upper_paths_hook = Some(__priv_callback::<CS>);

        pg_sys::RegisterCustomScanMethods(CS::custom_scan_methods())
    }
}

#[pg_guard]
pub extern "C-unwind" fn paradedb_upper_paths_callback<CS>(
    root: *mut pg_sys::PlannerInfo,
    stage: pg_sys::UpperRelationKind::Type,
    input_rel: *mut pg_sys::RelOptInfo,
    output_rel: *mut pg_sys::RelOptInfo,
    extra: *mut ::std::os::raw::c_void,
) where
    CS: CustomScan<Args = CreateUpperPathsHookArgs> + 'static,
{
    if !pg_search_extension_installed() {
        return;
    }

    unsafe {
        let paths = CS::create_custom_path(CustomPathBuilder::new(
            root,
            output_rel,
            CreateUpperPathsHookArgs {
                root,
                stage,
                input_rel,
                output_rel,
                extra,
            },
        ));

        for path in paths {
            add_path(output_rel, path);
        }
    }
}

/// Static variable to store the previous planner hook (e.g., from Citus or other extensions)
/// This MUST be outside both register_planner_hook() and paradedb_planner_hook()
/// so they both reference the same variable for proper hook chaining.
static mut PREV_PLANNER_HOOK: pg_sys::planner_hook_type = None;

/// Register a global planner hook to intercept and modify queries before planning.
/// This is called once during extension initialization and affects all queries.
///
/// # Window Function Replacement Strategy
///
/// ## Current Approach: Early Replacement via `planner_hook`
///
/// We replace `WindowFunc` nodes with `paradedb.window_agg(json)` placeholder calls
/// **before** PostgreSQL's standard planning begins. This happens at the very start
/// of the planning process, before any path generation or optimization.
///
/// ### Why Replace Early?
///
/// 1. **Prevents WindowAgg Node Creation**: By replacing window functions before
///    `grouping_planner()` runs, we prevent PostgreSQL from creating `WindowAgg`
///    plan nodes that would try to execute our placeholder functions.
///
/// 2. **Enables Top K Integration**: Our custom scan can detect the placeholder
///    functions in th
```

### Core Architecture Module: `pg_search/src/postgres/customscan/joinscan/scan_state.rs`
```
// Copyright (c) 2023-2026 ParadeDB, Inc.
//
// This file is part of ParadeDB - Postgres for Search and Analytics
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

//! JoinScan execution state: DataFusion plan construction, optimizer pipeline,
//! and result streaming.
//!
//! See the [JoinScan README](README.md) for the full architecture overview.
//!
//! # Parallel Partitioning Strategy & Correctness
//!
//! `JoinScan` implements parallel execution using a **Massively Parallel Processing (MPP)**
//! architecture. Instead of hardcoding which table is partitioned and which is replicated,
//! the physical plan is evaluated by DataFusion, which dynamically hash-partitions tables by
//! join key and shuffles intermediate rows between workers. This ensures that every row is
//! scanned exactly once while achieving distributed execution.
//!

use std::collections::HashMap;
use std::sync::Arc;

use datafusion::catalog::Session;
use datafusion::common::tree_node::{Transformed, TreeNode};
use datafusion::common::{
    Column, DFSchema, DataFusionError, Result, TableReference, internal_datafusion_err,
    internal_err,
};
use datafusion::functions::expr_fn::get_field;
use datafusion::logical_expr::expr::WindowFunction;
use datafusion::logical_expr::{
    Expr, Literal, LogicalPlan, LogicalPlanBuilder, LogicalPlanBuilderOptions, SortExpr,
    WindowFunctionDefinition, col,
};
use datafusion::optimizer::{Optimizer, OptimizerRule};
use datafusion::physical_plan::coalesce_partitions::CoalescePartitionsExec;
use datafusion::physical_plan::{ExecutionPlan, ExecutionPlanProperties};
use datafusion::prelude::{DataFrame, SessionConfig, SessionContext};
use futures::future::{FutureExt, LocalBoxFuture};
use pgrx::pg_sys;

use super::planning::get_source_attno_by_name;
use super::window_func::{
    SupportedWindowAggType, WINDOW_SENTINEL_VARNO, WindowAgg, WindowAggIndex,
};
use crate::api::{NullTestKind, OrderByFeature, SortDirection};
use crate::gucs;
use crate::index::fast_fields_helper::{FFHelper, FieldCardinality, WhichFastField};
use crate::postgres::customscan::datafusion::memory::{build_runtime_env, create_memory_pool};
use crate::postgres::customscan::datafusion::topk_agg::{TOPK_AGG_ROWS_COL_NAME, topk_as_agg};
use crate::postgres::customscan::joinscan::build::{
    self as build, CtidColumn, JoinCSClause, JoinSource, RelNode, RelationAlias, ScoreColumn,
};
use crate::postgres::customscan::pg_expr_udf::InputDecode;
use datafusion::execution::TaskContext;
use datafusion::physical_optimizer::filter_pushdown::FilterPushdown;

use crate::index::reader::index::SearchIndexManifest;
use crate::postgres::customscan::CustomScanState;
use crate::postgres::customscan::datafusion::translator::{
    ColumnMapper, CombinedMapper, PredicateTranslator, apply_join_level_filter,
    apply_relnode_unnest, build_join_df_with_filter, make_col, make_source_col,
    make_source_score_col, make_source_unnested_col, translate_pg_node_string,
};
use crate::postgres::customscan::joinscan::privdat::{OutputColumnInfo, PrivateData};
use crate::postgres::customscan::solve_expr::SolvePostgresExpressions;
use crate::postgres::heap::VisibilityChecker;
use crate::postgres::rel::PgSearchRelation;
use crate::scan::{PgSearchTableProvider, VisibilityMode};
use crate::schema::SearchFieldType;
use async_trait::async_trait;
use datafusion::execution::context::QueryPlanner;
use datafusion::execution::session_state::SessionStateBuilder;
use datafusion::functions_aggregate::expr_fn::min;
use datafusion::physical_planner::{DefaultPhysicalPlanner, PhysicalPlanner};

/// Resolve a PostgreSQL Var (`rti`, `attno`) to a DataFusion column expression (`col("...")`).
///
/// Uses `output_sources()` rather than `sources()` to ensure only output-visible relations
/// are targeted. For pruned relations (e.g. the pruned RHS of an Anti Join or pruned full join
/// inputs), their columns do not exist in the DataFusion plan schema and resolving against
/// them would trigger `FieldNotFound` schema errors during optimization or execution.
///
/// Returns `None` if no source maps the var — the caller decides whether to
/// fall back to a literal or propagate the absence.
fn resolve_var_to_df_col(
    join_clause: &JoinCSClause,
    rti: pg_sys::Index,
    attno: pg_sys::AttrNumber,
) -> Option<Expr> {
    // A window-aggregate sentinel Var (from rewrite_window_funcs_to_sentinels)
    // resolves to the window step's output column — except for
    // numeric-storage aggregates, whose column values are encoded (scaled
    // i64, decimal bytes, avg blobs). Native DataFusion math over those
    // would be wrong, so refuse here: per-node translation then falls back
    // to the PgExprUdf path, whose window inputs decode via
    // `JoinClauseMapper::udf_input`.
    if rti == WINDOW_SENTINEL_VARNO {
        let index = WindowAggIndex::from_sentinel_attno(attno)?;
        let window_agg = join_clause.window_aggs.get(index)?;
        if window_agg
            .arg_field_type()
            .is_some_and(|ft| ft.is_numeric())
        {
            return None;
        }
        let canonical = join_clause.window_aggs.canonical_index(index);
        return Some(col(canonical.as_col_name()));
    }
    if let Some(unnest_info) = join_clause.plan.find_lateral_unnest(rti) {
        let source = join_clause
            .plan
            .sources()
            .into_iter()
            .find(|s| s.contains_rti(unnest_info.source_rti.0))?;
        return Some(make_source_unnested_col(source, &unnest_info.field_name));
    }
    join_clause.plan.output_sources().iter().find_map(|source| {
        let mapped = source.map_var(rti, attno)?;
        let field = source.column_name(mapped)?;
        Some(make_source_col(source, &field))
    })
}

/// If a column cannot be resolved to an output DataFusion column, but its relation
/// participates in the join (e.g. the non-preserved side of an Anti Join that was pruned
/// from output), all its values in the join result are identically NULL.
fn null_if_source_exists(join_clause: &JoinCSClause, rti: pg_sys::Index) -> Option<Expr> {
    if join_clause
        .plan
        .sources()
        .iter()
        .any(|s| s.contains_rti(rti))
    {
        Some(datafusion::logical_expr::lit(
            datafusion::common::ScalarValue::Null,
        ))
    } else {
        None
    }
}

/// Resolves a Var to an output DataFusion column, falling back to NULL if the relation
/// is part of the join but was pruned from the join output.
fn resolve_var_or_pruned_null(
    join_clause: &JoinCSClause,
    rti: pg_sys::Index,
    attno: pg_sys::AttrNumber,
) -> Option<Expr> {
    resolve_var_to_df_col(join_clause, rti, attno)
        .or_else(|| null_if_source_exists(join_clause, rti))
}

/// The registered field type of `(rti, attno)` when it is a NUMERIC fast
/// field. Numeric columns arrive storage-encoded (scaled i64 or decimal
/// bytes), so they need decode-aware handling wherever raw values would be
/// consumed.
fn numeric_fast_field_type(
    join_clause: &JoinCSClause,
    rti: pg_sys::Index,
    attno: pg_sys::AttrNumber,
) -> Option<SearchFieldType> {
    join_clause.plan.output_sources().iter().find_map(|source| {
        let mapped = source.map_var(rti, attno)?;
        let field_info = source.scan_info.fields.iter().find(|f| f.attno == mapped)?;
        match &field_info.field {
            WhichFastField::Named {
                field_type: ft,
                cardinality: FieldCardinality::Scalar,
                ..
            } if ft.is_numeric() => Some(*ft),
            _ => None,
        }
    })
}

/// Adapter that lets `PredicateTranslator` resolve Vars against a `JoinCSClause`.
///
/// NOTE: This mapper is used exclusively by [`translate_child_projection_expr`] to
/// evaluate target-list output projections (`ChildProjection::Expression`).
/// For output projections, emitting NULL for columns of pruned relations (e.g.
/// the RHS of an Anti Join) is correct. Filter predicates do not use this mapper;
/// they use `CombinedMapper` where pruned columns are rejected.
struct JoinClauseMapper<'a> {
    join_clause: &'a JoinCSClause,
}

impl<'a> ColumnMapper for JoinClauseMapper<'a> {
    fn map_var(&self, varno: pg_sys::Index, varattno: pg_sys::AttrNumber) -> Option<Expr> {
        // NUMERIC fast-field columns are storage-encoded; native DataFusion
        // math over the raw column would be wrong. Refuse so per-node
        // translation falls back to the PgExprUdf path, where `udf_input`
        // supplies the decode. (Deliberately before the pruned-relation
        // NULL fallback below — a numeric column must not degrade to NULL.)
        if numeric_fast_field_type(self.join_clause, varno, varattno).is_some() {
            return None;
        }
        resolve_var_or_pruned_null(self.join_clause, varno, varattno)
    }

    fn udf_input(
        &self,
        varno: pg_sys::Index,
        varattno: pg_sys::AttrNumber,
    ) -> Option<(Expr, InputDecode)> {
        if varno == WINDOW_SENTINEL_VARNO {
            let index = WindowAggIndex::from_sentinel_attno(varattno)?;
            let window_agg = self.join_clause.window_aggs.get(index)?;
            let canonical = self.join_clause.window_aggs.canonical_index(index);
            return Some((
                col(canonical.as_col_name()),
                InputDecode::StorageEncoded {
   
```

### Core Architecture Module: `pg_search/src/postgres/customscan/mpp/exec_worker.rs`
```
// Copyright (c) 2023-2026 ParadeDB, Inc.
//
// This file is part of ParadeDB - Postgres for Search and Analytics
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

//! Shape-agnostic MPP worker exec dispatcher.
//!
//! The natural-shape MPP path is the same flow for every customscan that opts in: read the
//! leader's dispatch blob from DSM, decode this proc's per-stage physical subplans (the leader
//! built and sliced the plan once, so workers don't re-plan), and run each fragment via
//! [`datafusion_distributed::shm::run_worker_fragment`] + `FuturesUnordered`. The only
//! customscan-specific pieces are the seed `SessionContext` and where the inputs come from in per-scan state.
//!
//! This module isolates the shape-agnostic logic. Per-scan
//! `crate::postgres::customscan::mpp::host::MppWorkerHost` impls (in
//! `aggregatescan::mpp` and `joinscan::mpp`) extract their inputs into [`MppWorkerInputs`],
//! build their seed `SessionContext`, and are driven by
//! `crate::postgres::customscan::mpp::host::exec_mpp_worker`, which calls
//! [`run_mpp_worker`].

use std::sync::Arc;

use datafusion::execution::{SessionStateBuilder, TaskContext};
use datafusion::prelude::SessionContext;
use datafusion_distributed::{
    DistributedConfig, DistributedExt, DistributedTaskContext, SessionStateBuilderExt,
};
use futures::{FutureExt, StreamExt};
use pgrx::pg_sys;

use crate::index::mvcc::SegmentView;
use crate::postgres::customscan::datafusion::memory::{build_runtime_env, create_memory_pool};
use datafusion::physical_plan::ExecutionPlan;
use datafusion_distributed::PartitionSink;
use datafusion_distributed::shm::{
    CooperativeDrainSet, InProcessWorkerResolver, MppDataStreamKey, MppFrameHeader, MppMesh,
    MppPartitionSink, ShmChannelResolver, WorkerSession, collect_task_metrics, proc_for_task,
    run_execute_task_loop, run_worker_fragment,
};
use datafusion_proto::physical_plan::DeduplicatingProtoConverter;
use tokio_util::sync::CancellationToken;

use crate::postgres::ParallelScanState;
use crate::postgres::customscan::mpp::dispatch::fragments_for_worker;
use crate::postgres::customscan::mpp::glue::producer_worker_cap;
use crate::postgres::customscan::mpp::interrupt::{HeldInterrupts, check_for_interrupts};
use crate::postgres::customscan::mpp::worker_fragments::FragmentRouting;
use crate::postgres::utils::ExprContextGuard;
use crate::scan::execution_plan::{
    pg_search_scan_desired_task_count, pg_search_scan_scale_up_leaf_node,
};
use crate::scan::physical_codec::{
    PgSearchPhysicalExtensionCodec, deserialize_physical_plan_with_runtime,
};
use datafusion_distributed::shm::SetPlanFrame;

/// Bundle of inputs the worker dispatcher needs. Per-scan
/// `crate::postgres::customscan::mpp::host::MppWorkerHost` impls populate this from their
/// typed state and hand it to [`run_mpp_worker`].
pub(crate) struct MppWorkerInputs {
    /// The leader's `ParallelScanState`, used to claim the partitioning source's segment slice.
    /// Not optional: a dispatched fragment scanning without it would search every segment and
    /// duplicate rows across the mesh, so the entrypoint refuses to start without one. Valid
    /// for this worker's whole lifetime: PostgreSQL doesn't destroy a `ParallelContext`'s DSM
    /// until `WaitForParallelWorkersToFinish` returns, i.e. after every worker has exited.
    pub parallel_state: *mut ParallelScanState,
    /// Total number of sources in the plan. Used to size the codec's per-source segment-ID Vec.
    pub plan_sources_count: usize,
    /// Active worker session handle holding mesh, plan bytes, and outbound senders.
    pub session: WorkerSession,
}

/// Build the distributed session context. The leader runs this (mesh = None) to build and slice
/// the plan for dispatch, and again at exec (mesh = Some) for its consumer side; workers run it
/// (mesh = Some) to host the decoded fragments. Both procs must agree on stage shape, task
/// estimator chain, and target_partitions so the dispatched stage numbers line up with the
/// leader's consumer plan.
///
/// `seed` is the customscan's serial session context (`create_datafusion_session_context()`).
/// The function copies its config and layers the distributed-planner knobs on top.
pub(crate) fn build_mpp_session_context(
    seed: SessionContext,
    mesh: Option<Arc<MppMesh>>,
) -> SessionContext {
    // Workers are procs 1..n_procs; leader is proc 0. Producer count = n_procs - 1.
    // n_procs >= 3 always holds: for mesh = Some, the launch clamps the spawned width to
    // `MIN_TOTAL_WORKER_COUNT - 1` (2) producers; for mesh = None, callers gate on `mpp_is_active()`
    // which requires a cap of >= 2 producers.
    //
    // `mesh = None` is the EXPLAIN-time / plan-time path: the planner only needs `n_workers`
    // for stage sizing and target_partitions, so it plans against the cap
    // (`producer_worker_cap()`, from PG's parallelism GUCs). EXPLAIN never opens a
    // `WorkerConnection`, so we skip the transport install and the fork's default sits
    // unused. Callers that render plain EXPLAIN must still apply the launch gate
    // (`mpp_plan_has_data_parallelism`) and replan serially when the finished plan has
    // fewer than 2 producer tasks (#5784), matching execution. mesh = Some reads the
    // launched width from the mesh header, which the plan-first launch sized from the
    // plan's task counts (#5667).
    let n_workers = match mesh.as_ref() {
        Some(m) => m.n_workers() as usize,
        None => producer_worker_cap() as usize,
    };
    assert!(
        n_workers >= 2,
        "MPP session contexts require at least two producer workers"
    );
    // Three knobs that have to be set for the planner to actually emit `NetworkShuffleExec`:
    //   1. target_partitions(N): without it, EnforceDistribution skips every
    //      RepartitionExec so the annotator never sees a Shuffle.
    //   2. desired_task_count(N): without it, leaves default to Maximum(1) and
    //      `_distribute_plan` elides every shuffle.
    //   3. distributed_broadcast_joins(true): otherwise CollectLeft HashJoins cap their
    //      stage at Maximum(1) and propagate the cap upward, eliding shuffles above the join.
    let cfg = seed.copied_config().with_target_partitions(n_workers);

    // Start from the seed's existing state so the customscan's query planner
    // (`PgSearchQueryPlanner`), optimizer rules, and registered extensions all carry over.
    // JoinScan needs this for `VisibilityFilterNode` -> `VisibilityFilterExec` translation;
    // AggregateScan's plan doesn't use custom logical nodes but inheriting the planner is
    // still the right default. We then override `with_config` (bumps target_partitions)
    // and layer the distributed-planner knobs on top.
    //
    // Both seeds ship without a `DistributedConfig` extension. The bootstrap below would
    // clobber one if a future change started adding `with_distributed_*` calls on the
    // seed, so guard explicitly. Debug-only; release builds silently let the bootstrap
    // win, which would surface as missing distributed knobs at execute time and trip the
    // regress suite.
    debug_assert!(
        seed.state()
            .config()
            .options()
            .extensions
            .get::<DistributedConfig>()
            .is_none(),
        "build_mpp_session_context: seed already carries a DistributedConfig; the bootstrap \
         below would overwrite it"
    );
    let mut state_builder = SessionStateBuilder::new_from_existing(seed.state())
        .with_config(cfg)
        // Explicit `DistributedConfig` bootstrap so the downstream `with_distributed_*`
        // setters have something to mutate regardless of order; the transport setter is
        // optional (EXPLAIN passes mesh = None), so nothing else is guaranteed to run first.
        .with_distributed_option_extension(DistributedConfig::default())
        // Placeholder resolver. Our "workers" are PG parallel workers in the same backend tree,
        // not URL-addressed nodes, so the shm_mq transport routes by task index and never dials a
        // URL; the planner only needs `n_workers` of them to size stages.
        .with_distributed_worker_resolver(InProcessWorkerResolver::new(n_workers));
    // Install the shm_mq transport only for actual execution (mesh = Some). mesh = None is the
    // structure-only path: EXPLAIN, and the leader serializing the plan for dispatch. Neither
    // opens a WorkerConnection, so the fork's default transport sits unused.
    if let Some(mesh) = mesh {
        state_builder =
            state_builder.with_distributed_channel_resolver(ShmChannelResolver::new(mesh));
    }
    let state_builder = state_builder
        .with_distributed_user_codec(PgSearchPhysicalExtensionCodec::default())
        .with_distributed_desired_task_count_handler(pg_search_scan_desired_task_count)
        .with_distributed_scale_up_leaf_node_handler(pg_search_scan_scale_up_leaf_node)
        .with_distributed_desired_task_count_handler(n_workers)
        .with_distributed_broadcast_joins(true)
        .expect("with_distributed_broadcast_joins")
        // Disable the use of distributed dynamic filters until we fix
        // https://github.com/paradedb/datafusion-distributed/issues/107
        .with_distributed_remote_dynamic_filters(false)
        .expect("wit
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6646** (2026-10-04): **Upgrade test from `v0.26.0` calls the test table procedure by its old name**
  *Symptoms*: # What happens?  The `Test upgrading pg_search via ALTER EXTENSION (18, v0.26.0, 0.19.2)` job fails on every PR based on `main` since `v0.26.0` was tagged. The upgrade matrix takes the newest release tag as the prior version. `v0.26.0` renamed `paradedb.create_bm25_test_table` to `paradedb.create_paradedb_test_table` and dropped the old name. `.github/actions/test-pg_search-upgrade/kitchen_sink/setup.sql` runs against the prior version and still calls the old name.  The `v0.22.0` row passes, because that version has only the old name. So the setup has to work with either name.  ## To Reproduce  Any PR on `main` at `584e4ae87`, for example https://github.com/paradedb/paradedb/actions/runs/37108672938/job/111162206894:  ``` psql:/tmp/tmp.aPtYvcMns7/kitchen_sink/setup.sql:9: ERROR:  procedure paradedb.create_bm25_test_table(schema_name => unknown, table_name => unknown) does not exist ```  `pg_search--0.25.11--0.26.0.sql` has:  ```sql DROP PROCEDURE IF EXISTS paradedb.create_bm25_test_table(table_name pg_catalog."varchar", schema_name pg_catalog."varchar", table_type paradedb.testtable); ``` 

- **Issue #6636** (2026-10-03): **Aggregate Scan declines a `HAVING` condition on a `GROUP BY` key, and an outer `WHERE` on a grouped subquery, which Postgres moves to `WHERE`**
  *Symptoms*: # What happens?  The Tantivy backend of the Aggregate Scan declines a query with `Aggregate Scan not used: HAVING clause is not supported` when the query has no `HAVING` clause left. Postgres moves a `HAVING` condition that has no aggregate to `WHERE` (`subquery_planner()`), and it does the same with a condition of an outer query on a grouped subquery, which it first pushes down as a `HAVING` condition. The plan shows the condition in the Tantivy query of the fallback Base Scan, and no `Filter` on the aggregate node.  The scan reads `root->hasHavingQual`, which Postgres sets before the move. `parse->havingQual` is empty after the move.  The second shape is common: an application wraps a grouped query in a subquery or a CTE and filters the outer query.  Reproduced on PG 18.1 with a debug build of `main` at `544f4c67a` plus #6608. #6608 does not change this code path.  ## To Reproduce  ```sql CREATE EXTENSION IF NOT EXISTS pg_search CASCADE; CREATE TABLE having_items (id SERIAL PRIMARY KEY, account_id BIGINT, kind TEXT); INSERT INTO having_items (account_id, kind) SELECT (g % 3) + 1, (ARRAY['a', 'b', 'c', 'd'])[(g % 4) + 1] FROM generate_series(1, 120) g; CREATE INDEX having_items_idx ON having_items USING paradedb (id, account_id, (kind::pdb.literal)); SET paradedb.enable_aggregate_custom_scan = on;  -- WARNING:  Aggregate Scan not used: HAVING clause is not supported ... -- The plan has no Filter: Postgres moved the condition to WHERE. EXPLAIN (COSTS OFF) SELECT account_id, k

- **Issue #6633** (2026-10-03): **Aggregate Scan (DataFusion) groups on a column that the planner takes out of an expression above the scan, and splits the groups**
  *Symptoms*: # What happens?  The DataFusion backend of the Aggregate Scan takes each column of the target that is not a `GROUP BY` key as a column that depends on the keys, and it groups on that column too (`collect_output_nodes` in `join_targetlist.rs`). That is right for a column that the primary key decides. But the planner also puts a column into the target when it takes it out of an expression that a node above the scan computes (`make_window_input_target`, `make_sort_input_target`). Such a column can have many values in a group, and the extra grouping column splits the group.  A `GROUP BY date(ts)` with a window function over the key shows it. The `DATE()` key sends the query to this backend.  Reproduced on PG 18.1 with a debug build of `main` at `1360e53fa` plus #6608. #6608 does not change this code path.  ## To Reproduce  ```sql CREATE EXTENSION IF NOT EXISTS pg_search CASCADE; CREATE TABLE day_items (id INT PRIMARY KEY, ts TIMESTAMP); INSERT INTO day_items SELECT g, TIMESTAMP '2024-01-01 00:00' + (g * INTERVAL '7 hours') FROM generate_series(1, 30) g; CREATE INDEX day_items_idx ON day_items USING paradedb (id, ts); ANALYZE day_items; SET paradedb.enable_aggregate_custom_scan = on;  -- 30 rows with n = 1. Postgres: 9 rows, one for each day, with n = 3 or 4. SELECT date(ts)::text AS d, COUNT(*) AS n, SUM(COUNT(*)) OVER () AS total FROM day_items WHERE id @@@ paradedb.all() GROUP BY date(ts) ORDER BY 1; ``` 

- **Issue #6632** (2026-10-03): **Aggregate Scan (DataFusion) fails with `Unsupported OID for Int64 Arrow type` for a `GROUP BY` key that is a cast of a column**
  *Symptoms*: # What happens?  The DataFusion backend of the Aggregate Scan fails when a `GROUP BY` key is a cast of a column. The backend takes the key as the column under the cast and reads that column from the index. The projection then gets a value of the type of the column, and it expects the type of the cast.  A single-table query gets this backend when the estimated number of groups is above `paradedb.max_term_agg_buckets`. The Tantivy backend runs the same query.  Reproduced on PG 18.1 with a debug build of `main` at `1360e53fa` plus #6608. #6608 does not change this code path.  ## To Reproduce  ```sql CREATE EXTENSION IF NOT EXISTS pg_search CASCADE; CREATE TABLE cast_keys (id INT PRIMARY KEY, rating INT); INSERT INTO cast_keys SELECT g, g % 4 FROM generate_series(1, 30) g; CREATE INDEX cast_keys_idx ON cast_keys USING paradedb (id, rating); ANALYZE cast_keys; SET paradedb.enable_aggregate_custom_scan = on; SET paradedb.max_term_agg_buckets = 2;  -- ERROR:  BUG: Aggregate projection failed: Unsupported OID for Int64 Arrow type: BuiltIn(TEXTOID) -- Postgres: 0 | 7, 1 | 8, 2 | 8 and 3 | 7. SELECT rating::text AS r, COUNT(*) FROM cast_keys WHERE id @@@ paradedb.all() GROUP BY rating::text ORDER BY r; ``` 

- **Issue #6626** (2026-10-02): **Aggregate Scan fails with `UnsupportedOid(27)` for `GROUP BY ctid`**
  *Symptoms*: # What happens?  `GROUP BY ctid` fails on the Aggregate Scan (Tantivy backend). The scan takes `ctid` as a grouping column because the index has a columnar `ctid` field, but it cannot convert the key to a `tid`.  In addition, the `ctid` in the index can be the root of a HOT chain, so I think the scan should decline a system column.  Reproduced on PG 18.1 with a debug build of `main` at `1360e53fa` plus #6608. #6608 does not change this code path.  ## To Reproduce  ```sql CREATE EXTENSION IF NOT EXISTS pg_search CASCADE; CREATE TABLE ctid_groups (id SERIAL PRIMARY KEY, kind TEXT); INSERT INTO ctid_groups (kind) VALUES ('a'), ('b'), ('c'); CREATE INDEX ctid_groups_idx ON ctid_groups USING paradedb (id, kind); SET paradedb.enable_aggregate_custom_scan = on;  -- ERROR:  should be able to convert to datum: UnsupportedOid(27) -- Postgres: (0,1) | 1, (0,2) | 1 and (0,3) | 1. SELECT ctid, COUNT(*) FROM ctid_groups WHERE id @@@ paradedb.all() GROUP BY ctid ORDER BY ctid; ``` 
  **Post-Mortem & Fix Analysis**:
  > Duplicate of #6624. The cause is the same: the Tantivy backend does not check the type of a `GROUP BY` key. #6624 has the `ctid` repro.

- **Issue #6620** (2026-10-02): **Aggregate Scan returns wrong counts for `GROUP BY` on a float column that holds `-0`**
  *Symptoms*: # What happens?  `GROUP BY` on a `float8` column that holds `-0` returns wrong counts on the Aggregate Scan. Postgres puts `0` and `-0` in one group. The scan returns a group for `0` with a count that does not include all of those rows.  This is the `GROUP BY` side of #6609, which is about `WHERE float_column = 0`.  Reproduced on `main` at `1360e53fa`, PG 18.1, debug build.  ## To Reproduce  ```sql CREATE EXTENSION IF NOT EXISTS pg_search CASCADE; CREATE TABLE float_groups (id SERIAL PRIMARY KEY, price FLOAT8); INSERT INTO float_groups (price) VALUES (0), ('-0'), (0), (1); CREATE INDEX float_groups_idx ON float_groups USING paradedb (id, price); SET paradedb.enable_aggregate_custom_scan = on;  -- 0 | 1 and 1 | 1. Postgres: 0 | 3 and 1 | 1. SELECT price, COUNT(*) FROM float_groups WHERE id @@@ paradedb.all() GROUP BY price ORDER BY price; ``` 
  **Post-Mortem & Fix Analysis**:
  > Duplicate of #6609. The `terms` aggregation has one bucket for `0.0` and one for `-0.0`, for the same reason that the term query on `0.0` does not match `-0.0`. #6609 has the two repros.

- **Issue #6607** (2026-10-02): **Aggregate Scan groups on the `ORDER BY` column of an ordered aggregate and returns one row for each of its values**
  *Symptoms*: # What happens?  An aggregate with its own `ORDER BY`, such as `COUNT(id ORDER BY kind)`, makes the Aggregate Scan group on the `ORDER BY` column. The query returns one row for each value of that column, where Postgres returns one row for each group. It happens with and without a `GROUP BY`.  On PG16 and later, the planner appends the sort keys of such an aggregate to `root->group_pathkeys` (`adjust_group_pathkeys_for_groupagg`), after the first `root->num_groupby_pathkeys` entries. The Tantivy backend of the Aggregate Scan takes every pathkey as a grouping column. `EXPLAIN` shows `Group By: kind` for a query with no `GROUP BY`.  Reproduced on `main` at `495ccbac6`, PG 18.1, debug build.  ## To Reproduce  ```sql CREATE EXTENSION IF NOT EXISTS pg_search CASCADE; CREATE TABLE ordered_agg_items (id serial PRIMARY KEY, account_id bigint, kind text, price float8); INSERT INTO ordered_agg_items (account_id, kind, price) SELECT (g % 3) + 1, (ARRAY['a', 'b', 'c', 'd'])[(g % 4) + 1], g % 5 FROM generate_series(1, 120) g; CREATE INDEX ordered_agg_items_idx ON ordered_agg_items USING paradedb (id, account_id, (kind::pdb.literal), price); SET paradedb.enable_aggregate_custom_scan = on;  -- 4 rows of 30. Postgres: 1 row, 120. SELECT COUNT(id ORDER BY kind) FROM ordered_agg_items WHERE id @@@ paradedb.all();  -- 12 rows of 10. Postgres: 3 rows of 40. SELECT account_id, COUNT(id ORDER BY kind) FROM ordered_agg_items WHERE id @@@ paradedb.all() GROUP BY account_id ORDER BY account_id;  SET p

- **Issue #6606** (2026-10-03): **Aggregate Scan is not used when the `WHERE` clause pins a `GROUP BY` key to one value**
  *Symptoms*: # What happens?  A single-table aggregate does not get `Custom Scan (ParadeDB Aggregate Scan)` when the `WHERE` clause filters a `GROUP BY` key to one value with `key = <value>`. The query falls back to `ParadeDB Base Scan` plus a Postgres aggregate. The same query with `key IN (<value>, <value>)` gets the Aggregate Scan.  The decline message depends on the keys:  - The pinned key is the only key: `Aggregate Scan not used: could not verify GROUP BY semantics`. - The pinned key is next to another key: `Aggregate Scan not used: Field 'account_id' is not a grouping column`.  A `pdb.agg()` query has no fallback, so it fails with `Cannot execute pdb.agg: could not verify GROUP BY semantics`.  ORMs send this shape often. A batch loader with `WHERE parent_id IN (...)` sends `WHERE parent_id = $1` when the batch has one element.  Postgres leaves a key that is equal to a constant out of `root->group_pathkeys`, and the Tantivy backend of the Aggregate Scan takes its grouping columns from there. Reproduced on `main` at `495ccbac6`, PG 18.1, debug build.  ## To Reproduce  ```sql CREATE EXTENSION IF NOT EXISTS pg_search CASCADE; CREATE TABLE pinned_items (id serial PRIMARY KEY, account_id bigint, kind text); INSERT INTO pinned_items (account_id, kind) SELECT (g % 3) + 1, (ARRAY['a', 'b'])[(g % 2) + 1] FROM generate_series(1, 60) g; CREATE INDEX pinned_items_idx ON pinned_items USING paradedb (id, account_id, (kind::pdb.literal)); SET paradedb.enable_aggregate_custom_scan = on;  -- Aggrega

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

### Incident Patch 1: `8e719a36` (2026-10-05)
**Commit Message**: fix: respect RLS leaky-qual ordering in filter pushdown (#6614)

# Ticket(s) Closed

- N/A: reported privately per SECURITY.md; maintainers approved opening
this PR.

## What

Filter pushdown in the Base Scan, Aggregate Scan and Join Scan ignored
PostgreSQL's
row-level security ordering. A non-leakproof predicate such as
`secret::int > 0` was
lowered into a Tantivy heap filter and could run on rows an RLS policy
rejects,
disclosing their values through its error message. Default settings;
`SELECT` only.

## Why

PostgreSQL never evaluates a non-leakproof clause on a row before that
row passes the
relation's lower-`security_level` quals
(`restriction_is_securely_promotable`). The custom
scans lowered clauses without that check:

- **Base Scan:** a subquery policy stays above the scan as `plan.qual`
while the caller's
  predicate ran below it.
- **Aggregate / Join Scan:** no filter step above the scan, so the
predicate and the policy
  ended up side by side in one Tantivy query.

## How

A shared check in `qual_inspect.rs` (`classify_security_pushdown`,
`has_leaky_heap_filter`,
`expr_is_securely_promotable`) applies
`restriction_is_securely_promotable` to every clause
that would beco

**File**: `pg_search/src/postgres/customscan/aggregatescan/aggregate_type.rs` (modified, +11/-1)
```diff
@@ -25,7 +25,9 @@ use crate::postgres::PgSearchRelation;
 use crate::postgres::customscan::basescan::exec_methods::fast_fields::find_matching_fast_field;
 use crate::postgres::customscan::joinscan::build::lookup_base_rel_info;
 use crate::postgres::customscan::opexpr::UnwrapFromExpr;
-use crate::postgres::customscan::qual_inspect::{PlannerContext, QualExtractState, extract_quals};
+use crate::postgres::customscan::qual_inspect::{
+    PlannerContext, QualExtractState, expr_is_securely_promotable, extract_quals,
+};
 use crate::postgres::node::NodeExt;
 use crate::postgres::pdb_owned_value::PdbOwnedValue;
 use crate::postgres::types::{ConstNode, TantivyValue};
@@ -147,6 +149,14 @@ impl AggregateType {
                 true,
             )
         };
+        // SECURITY: PostgreSQL evaluates FILTER after RLS; as a heap filter it would run first.
+        if qual_state.uses_heap_expr
+            && !expr_is_securely_promotable(root, heap_rti, (*aggref).aggfilter.cast())
+        {
+            bail!(
+                "aggregate FILTER has a predicate that must be evaluated after row-level security policies"
+            );
+        }
         let filter_query = filter_expr.map(|qual| SearchQueryInput::from(&qual));
 
         // Check for pdb.agg() custom aggregate (any overload)
```

**File**: `pg_search/src/postgres/customscan/aggregatescan/datafusion_build.rs` (modified, +14/-0)
```diff
@@ -46,6 +46,7 @@ use crate::postgres::customscan::pullup::{
 };
 use crate::postgres::customscan::qual_inspect::{
     PlannerContext, QualExtractState, collect_implicit_and_conjuncts, extract_quals,
+    has_leaky_heap_filter,
 };
 use crate::postgres::customscan::range_table::bms_iter;
 use crate::postgres::node::NodeExt;
@@ -581,6 +582,19 @@ unsafe fn build_scan_node(
                 return Err("query does not imply the partial index predicate".into());
             }
             classified = classify_base_restrictinfo(root, (*rel).baserestrictinfo);
+
+            // SECURITY: nothing runs above this scan, so a leaky filter would run before RLS.
+            if has_leaky_heap_filter(root, rel, rti, bm25_index, &classified.search_ri) {
+                pgrx::debug1!(
+                    "agg-on-join: declining RTI {} ({}); a WHERE predicate must be \
+                     evaluated after row-level security policies",
+                    rti,
+                    source.alias.as_deref().unwrap_or("unknown"),
+                );
+                return Err(
+                    "a WHERE predicate must be evaluated after row-level security policies".into(),
+                );
+            }
         }
     }
 
```

**File**: `pg_search/src/postgres/customscan/aggregatescan/searchquery.rs` (modified, +20/-1)
```diff
@@ -22,7 +22,9 @@ use crate::postgres::customscan::aggregatescan::{
 };
 use crate::postgres::customscan::builders::custom_path::CustomPathBuilder;
 use crate::postgres::customscan::builders::custom_path::{RestrictInfoType, restrict_info};
-use crate::postgres::customscan::qual_inspect::{PlannerContext, QualExtractState, extract_quals};
+use crate::postgres::customscan::qual_inspect::{
+    PlannerContext, QualExtractState, extract_quals, has_leaky_heap_filter,
+};
 use crate::postgres::node::NodeExt;
 use crate::postgres::utils::{filter_implied_predicates, missing_partial_index_predicate};
 use crate::query::SearchQueryInput;
@@ -109,6 +111,23 @@ impl CustomScanClause<AggregateScan> for SearchQueryClause {
         // Filter out predicates implied by the partial index predicate
         let filtered_restrict_info = filter_implied_predicates(index.rd_indpred, &restrict_info);
 
+        // SECURITY: nothing runs above this scan, so a leaky filter would run before RLS.
+        let has_leaky_filter = unsafe {
+            has_leaky_heap_filter(
+                args.root,
+                args.input_rel,
+                heap_rti,
+                index,
+                &filtered_restrict_info,
+            )
+        };
+        if has_leaky_filter {
+            return Err(
+                "WHERE clause has a predicate that must be evaluated after row-level security policies"
+                    .into(),
+            );
+        }
+
         let quals = match extract_quals(
             &PlannerContext::from_planner(args.root),
             heap_rti,
```

**File**: `pg_search/src/postgres/customscan/basescan/mod.rs` (modified, +203/-31)
```diff
@@ -25,6 +25,7 @@ mod scan_state;
 pub(crate) mod telemetry;
 
 use crate::postgres::customscan::node::CustomScanNodeExt;
+use crate::postgres::deparse::node_to_string_owned;
 use crate::postgres::node::NodeExt;
 use cost::{
     CostMemo, DriveCost, ScanParallelismInputs, WorkerDecisionReason, WorkerPathPolicy,
@@ -77,8 +78,8 @@ use crate::postgres::customscan::projections::{
     PlaceholderColumn, PlaceholderColumns, inject_placeholders, pullout_funcexprs,
 };
 use crate::postgres::customscan::qual_inspect::{
-    PlannerContext, Qual, QualExtractState, extract_join_predicates, extract_quals, is_subplan,
-    optimize_quals_with_heap_expr,
+    PlannerContext, Qual, QualExtractState, SecurityPushdown, classify_security_pushdown,
+    extract_join_predicates, extract_quals, is_subplan, optimize_quals_with_heap_expr,
 };
 use crate::postgres::customscan::score_funcoids;
 use crate::postgres::customscan::solve_expr::SolvePostgresExpressions;
@@ -268,16 +269,10 @@ impl BaseScan {
         let mut state = QualExtractState::default();
         let context = PlannerContext::from_planner(root);
 
-        // Filter out predicates that are implied by the partial index predicate.
-        // If a partial index has predicate P (e.g., "deleted_at IS NULL"), and the query
-        // also has predicate P, we don't need to create a heap filter for P since the
-        // partial index already guarantees it.
-        let filtered_restrict_info = filter_implied_predicates(indexrel.rd_indpred, &restrict_info);
-
         let mut quals = extract_quals(
             &context,
             rti,
-            filtered_restrict_info.as_ptr().cast(),
+            restrict_info.as_ptr().cast(),
             ri_type,
             indexrel,
             false, // Base relation quals should not convert external to all
@@ -298,7 +293,7 @@ impl BaseScan {
             let mut partial_quals = Vec::new();
             let mut partial_state = QualExtractState::default();
             let mut all_skipped_are_subplans = true;
-            for ri in filtered_restrict_info.iter_ptr() {
+            for ri in restrict_info.iter_ptr() {
                 if let Some(qual) = extract_quals(
                     &context,
                     rti,
@@ -335,16 +330,43 @@ impl BaseScan {
         let quals = if quals.is_none() {
             let joinri: PgList<pg_sys::RestrictInfo> =
                 PgList::from_pg(builder.args().rel().joininfo);
-            let mut quals = extract_quals(
-                &context,
-                rti,
-                joinri.as_ptr().cast(),
-                RestrictInfoType::Join,
-                indexrel,
-                true, // Join quals should convert external to all
-                &mut state,
-                attempt_pushdown,
-            );
+            let mut join_quals = Vec::new();
+            for ri in joinri.iter_ptr() {
+                let qual = extract_quals(
+                    &context,
+                    rti,
+                    ri.cast(),
+                    RestrictInfoType::Join,
+                    indexrel,
+                    true, // Join quals should convert external to all
+                    &mut state,
+                    attempt_pushdown,
+                )?;
+                // SECURITY: the join above re-evaluates every join clause after RLS, so a leaky
+                // one only needs a superset here and must not run its heap filters early.
+                let is_leaky = matches!(
+                    classify_security_pushdown(
+                        &context,
+                        builder.args().rel,
+                        rti,
+                        ri,
+                        RestrictInfoType::Join,
+                        indexrel,
+                        attempt_pushdown,
+                    ),
+                    SecurityPushdown::LeakyHeapFilter { .. }
+                );
+                join_quals.push(if is_leaky {
+                    qual.without_heap_exprs()?
+                } else {
+                    qual
+                });
+            }
+            let mut quals = match join_quals.len() {
+                0 => None,
+                1 => join_quals.pop(),
+                _ => Some(Qual::And(join_quals)),
+            };
 
             let quals =
                 Self::handle_heap_expr_optimization(&state, &mut quals, allow_without_operator);
@@ -565,7 +587,15 @@ impl BaseScanDeclineReason {
 unsafe fn has_non_pushable_predicates(
     rel: *mut pg_sys::RelOptInfo,
     quals_pushed: &Option<Qual>,
+    has_deferred_quals: bool,
 ) -> Result<(), BaseScanDeclineReason> {
+    // Deferred clauses run in `plan.qual`, after the scan has produced (and counted) its rows.
+    if has_deferred_quals {
+        return Err(BaseScanDeclineReason::new(
+            "WHERE clause contains predicates that must be evaluated after row-level security policies",
+        ));
+    }
+
     let restrict_list = PgList::<pg_sys::RestrictInfo>
```

**File**: `pg_search/src/postgres/customscan/basescan/privdat.rs` (modified, +11/-0)
```diff
@@ -61,6 +61,9 @@ pub struct PrivateData {
     // Which decision branch produced this path's serial/parallel choice, surfaced in EXPLAIN
     // VERBOSE. `None` only on plans serialized before this field existed.
     worker_selection_reason: Option<WorkerDecisionReason>,
+    // `nodeToString` of the leaky WHERE clauses evaluated in `plan.qual` instead of the scan.
+    #[serde(default)]
+    deferred_plan_quals: Vec<String>,
 }
 
 mod var_attname_lookup_serializer {
@@ -235,6 +238,14 @@ impl PrivateData {
         self.join_predicates = predicates;
     }
 
+    pub fn set_deferred_plan_quals(&mut self, quals: Vec<String>) {
+        self.deferred_plan_quals = quals;
+    }
+
+    pub fn deferred_plan_quals(&self) -> &[String] {
+        &self.deferred_plan_quals
+    }
+
     pub fn set_window_aggregates(&mut self, window_aggregates: Vec<WindowAggregateInfo>) {
         self.window_aggregates = window_aggregates;
     }
```

**File**: `pg_search/src/postgres/customscan/basescan/projections/window_agg.rs` (modified, +2/-0)
```diff
@@ -101,6 +101,8 @@ pub mod window_aggregates {
     pub const HAVING_SUPPORT: bool = false;
 
     /// Enable support for `FILTER` clause in window functions.
+    ///
+    /// SECURITY: before enabling, gate the FILTER on `expr_is_securely_promotable`.
     pub const WINDOW_AGG_FILTER_CLAUSE: bool = false;
 }
 
```

**File**: `pg_search/src/postgres/customscan/joinscan/planning.rs` (modified, +17/-8)
```diff
@@ -49,7 +49,9 @@ use crate::postgres::customscan::opexpr::lookup_operator;
 use crate::postgres::customscan::pullup::{
     field_type_for_pullup, get_attno_by_name, resolve_fast_field, resolve_fast_field_by_name,
 };
-use crate::postgres::customscan::qual_inspect::{PlannerContext, QualExtractState, extract_quals};
+use crate::postgres::customscan::qual_inspect::{
+    PlannerContext, QualExtractState, extract_quals, has_leaky_heap_filter,
+};
 use crate::postgres::customscan::range_table::{bms_iter, get_rte};
 use crate::postgres::customscan::score_funcoids;
 use crate::postgres::rel::PgSearchRelation;
@@ -174,6 +176,12 @@ pub(super) unsafe fn collect_join_sources_base_rel(
 
         classified = classify_base_restrictinfo(root, (*rel).baserestrictinfo);
 
+        // SECURITY: lifted SubPlans (e.g. an RLS policy) become joins above this scan, so a
+        // leaky filter in it would run first.
+        if has_leaky_heap_filter(root, rel, rti, &bm25_index, &classified.search_ri) {
+            return None;
+        }
+
         if !classified.search_ri.is_empty() {
             let context = PlannerContext::from_planner(root);
             let mut state = QualExtractState::default();
@@ -213,7 +221,8 @@ pub(super) unsafe fn collect_join_sources_base_rel(
         return None;
     };
     current_node = node;
-    current_node = wrap_with_mark_filter(current_node, classified.or_subplans, &mut all_keys);
+    // Same for OR-nested SubPlans, which may be RLS policies.
+    current_node = wrap_with_mark_filter(current_node, classified.or_subplans, &mut all_keys)?;
 
     Some(CollectedJoinRel::new(current_node, all_keys))
 }
@@ -411,20 +420,20 @@ pub unsafe fn wrap_with_semi_anti(
 /// SubPlan (`col IS NULL OR col IN (SELECT ...)` style). The LeftMark join
 /// produces all left rows plus a boolean "mark" column; the Filter then keeps
 /// rows where `mark = true OR col IS NULL` (or the inverted form for NOT IN).
+///
+/// Returns `None` if any SubPlan can't be lowered, rather than dropping its predicate.
 unsafe fn wrap_with_mark_filter(
     mut current_node: RelNode,
     or_subplans: Vec<OrSubPlanExtraction>,
     all_keys: &mut Vec<JoinKeyPair>,
-) -> RelNode {
+) -> Option<RelNode> {
     for or_ext in or_subplans {
         let inner_rel = find_final_rel(or_ext.inner_root);
         if inner_rel.is_null() {
-            continue;
+            return None;
         }
 
-        let Some(inner_collected) = collect_join_sources(or_ext.inner_root, inner_rel) else {
-            continue;
-        };
+        let inner_collected = collect_join_sources(or_ext.inner_root, inner_rel)?;
         let inner_node = inner_collected.plan;
         let inner_keys = inner_collected.join_keys;
 
@@ -473,7 +482,7 @@ unsafe fn wrap_with_mark_filter(
         current_node = RelNode::Filter(Box::new(filter_node));
     }
 
-    current_node
+    Some(current_node)
 }
 
 /// Recursively reconstructs the intermediate relational tree from standard PostgreSQL join paths.
```

**File**: `pg_search/src/postgres/customscan/qual_inspect.rs` (modified, +129/-12)
```diff
@@ -257,6 +257,43 @@ impl Qual {
         }
     }
 
+    /// True if, as a top-level AND branch, [`optimize_quals_with_heap_expr`] merges this qual
+    /// into the `indexed_query` of each sibling heap filter.
+    pub fn is_indexed_conjunct(&self) -> bool {
+        matches!(
+            self,
+            Qual::OpExpr { .. }
+                | Qual::PushdownExpr { .. }
+                | Qual::PushdownVarEqTrue { .. }
+                | Qual::PushdownVarEqFalse { .. }
+                | Qual::PushdownVarIsTrue { .. }
+                | Qual::PushdownVarIsFalse { .. }
+                | Qual::PushdownIsNotNull { .. }
+                | Qual::Or(_)
+        )
+    }
+
+    /// Replace each heap filter with `All`, so the qual matches a superset of its rows without
+    /// evaluating any heap expression. Returns `None` if a heap filter is under a `Not`, where
+    /// `All` would narrow the match instead.
+    pub fn without_heap_exprs(self) -> Option<Qual> {
+        match self {
+            Qual::HeapExpr { .. } => Some(Qual::All),
+            Qual::And(quals) => quals
+                .into_iter()
+                .map(Qual::without_heap_exprs)
+                .collect::<Option<_>>()
+                .map(Qual::And),
+            Qual::Or(quals) => quals
+                .into_iter()
+                .map(Qual::without_heap_exprs)
+                .collect::<Option<_>>()
+                .map(Qual::Or),
+            Qual::Not(inner) if inner.contains_heap_expr() => None,
+            other => Some(other),
+        }
+    }
+
     /// Check if a Qual contains any HeapExpr (non-indexed predicates)
     pub fn contains_heap_expr(&self) -> bool {
         match self {
@@ -759,6 +796,97 @@ pub fn is_subplan(node: *mut pg_sys::Node, root: *mut pg_sys::PlannerInfo) -> bo
     unsafe { walker(node, std::ptr::null_mut()) }
 }
 
+/// Whether a WHERE clause can be pushed into the scan without breaking RLS ordering.
+pub enum SecurityPushdown {
+    /// Securely promotable, or it would not become a heap filter.
+    Safe,
+    /// A non-leakproof heap filter that must not run before the relation's RLS policy /
+    /// security-barrier quals, or it could leak hidden rows (e.g. through an error message).
+    LeakyHeapFilter {
+        /// It also uses `@@@`, so it can't be evaluated above the scan either.
+        uses_our_operator: bool,
+    },
+}
+
+/// Classify `ri`, a clause of `rel`'s `baserestrictinfo` or `joininfo`, per [`SecurityPushdown`].
+pub unsafe fn classify_security_pushdown(
+    context: &PlannerContext,
+    rel: *mut pg_sys::RelOptInfo,
+    rti: pg_sys::Index,
+    ri: *mut pg_sys::RestrictInfo,
+    ri_type: RestrictInfoType,
+    indexrel: &PgSearchRelation,
+    attempt_pushdown: bool,
+) -> SecurityPushdown {
+    if pg_sys::restriction_is_securely_promotable(ri, rel) {
+        return SecurityPushdown::Safe;
+    }
+
+    let mut probe = QualExtractState::default();
+    let _ = extract_quals(
+        context,
+        rti,
+        ri.cast(),
+        ri_type,
+        indexrel,
+        matches!(ri_type, RestrictInfoType::Join),
+        &mut probe,
+        attempt_pushdown,
+    );
+    if probe.uses_heap_expr {
+        SecurityPushdown::LeakyHeapFilter {
+            uses_our_operator: probe.uses_our_operator,
+        }
+    } else {
+        SecurityPushdown::Safe
+    }
+}
+
+/// `restriction_is_securely_promotable` for an expression over `rti` that is not a
+/// `baserestrictinfo` clause, such as an aggregate `FILTER (WHERE ...)`.
+pub unsafe fn expr_is_securely_promotable(
+    root: *mut pg_sys::PlannerInfo,
+    rti: pg_sys::Index,
+    expr: *mut pg_sys::Node,
+) -> bool {
+    let rel_array = (*root).simple_rel_array;
+    if rel_array.is_null() || rti as isize >= (*root).simple_rel_array_size as isize {
+        return false;
+    }
+    let rel = *rel_array.offset(rti as isize);
+    if rel.is_null() {
+        return false;
+    }
+    (*root).qual_security_level <= (*rel).baserestrict_min_security
+        || !pg_sys::contain_leaked_vars(expr)
+}
+
+/// True if any clause of `restrict_info` is a [`SecurityPushdown::LeakyHeapFilter`]. Scans
+/// with no filter step above them must decline when it is.
+pub unsafe fn has_leaky_heap_filter(
+    root: *mut pg_sys::PlannerInfo,
+    rel: *mut pg_sys::RelOptInfo,
+    rti: pg_sys::Index,
+    indexrel: &PgSearchRelation,
+    restrict_info: &PgList<pg_sys::RestrictInfo>,
+) -> bool {
+    let context = PlannerContext::from_planner(root);
+    restrict_info.iter_ptr().any(|ri| {
+        matches!(
+            classify_security_pushdown(
+                &context,
+                rel,
+                rti,
+                ri,
+                RestrictInfoType::BaseRelation,
+                indexrel,
+                true,
+            ),
+            SecurityPushdown::LeakyHeapFilter { .. }
+        )
+    })
+}
+
 #[allow(clippy::too_many_arguments)]
 pub fn extract_quals(
     context: &PlannerContext,
@@ -1879,18 +20
```

---

### Incident Patch 2: `608f27b0` (2026-10-05)
**Commit Message**: fix: honor interrupts while advancing heap filters (#6670)

## What

Honor PostgreSQL interrupts while advancing past rejected heap-filter
candidates.

## Why

`HeapFilterScorer::advance()` can scan an entire segment without
returning to the outer scan's interrupt checks. This delays statement
timeouts, query cancellation, and backend termination. An empty scan can
even finish successfully without reporting a pending cancel.

**File**: `pg_search/src/query/heap_field_filter.rs` (modified, +2/-0)
```diff
@@ -561,6 +561,8 @@ impl Scorer for HeapFilterScorer {
 impl DocSet for HeapFilterScorer {
     fn advance(&mut self) -> DocId {
         loop {
+            pgrx::check_for_interrupts!();
+
             let doc = self.indexed_scorer.advance();
 
             if doc == TERMINATED {
```

---

### Incident Patch 3: `ace9bec2` (2026-10-05)
**Commit Message**: fix: Ensure column access is injected in all plan shapes (#6675)

## What

Reuse `visit_scan_nodes` to fix a failure to inject FFHelper in all
relevant positions.

## Why

To fix a failure in some plan shapes.

**File**: `pg_search/src/postgres/customscan/joinscan/mod.rs` (modified, +21/-4)
```diff
@@ -1726,13 +1726,13 @@ impl CustomScan for JoinScan {
                 };
 
                 for (plan_position, rel_state) in state.custom_state_mut().relations.iter_mut() {
-                    if let Some((_, ffhelper)) =
-                        crate::scan::visibility_ctid_resolver_rule::find_ffhelper_for_plan_position(
-                            plan.as_ref(),
+                    if let Some(resolver) =
+                        crate::scan::execution_plan::find_ctid_resolver_for_plan_position(
+                            &plan,
                             *plan_position,
                         )
                     {
-                        rel_state.ffhelper = Some(ffhelper);
+                        rel_state.ffhelper = Some(resolver.ffhelper);
                     }
                 }
 
@@ -1774,6 +1774,23 @@ impl CustomScan for JoinScan {
                     }
                 }
 
+                #[cfg(debug_assertions)]
+                {
+                    crate::scan::execution_plan::visit_scan_nodes(&plan, &mut |scan| {
+                        if let Some(pos) = scan.deferred_ctid_plan_position() {
+                            debug_assert!(
+                                state
+                                    .custom_state()
+                                    .relations
+                                    .get(&pos)
+                                    .and_then(|r| r.ffhelper.as_ref())
+                                    .is_some(),
+                                "JoinScan: relation at plan_position {pos} has deferred CTIDs but missing FFHelper on RelationState"
+                            );
+                        }
+                    });
+                }
+
                 let plan_sources = state.custom_state().join_clause.plan.sources();
                 let output_batch_col_indices: Vec<Option<usize>> = state
                     .custom_state()
```

**File**: `pg_search/src/postgres/customscan/joinscan/visibility_filter.rs` (modified, +17/-10)
```diff
@@ -82,7 +82,7 @@ use datafusion::physical_plan::{
 use datafusion::physical_planner::{ExtensionPlanner, PhysicalPlanner};
 use pgrx::pg_sys;
 
-use crate::index::fast_fields_helper::{FFHelper, for_each_segment};
+use crate::index::fast_fields_helper::for_each_segment;
 use crate::index::mvcc::{MvccSatisfies, SegmentView};
 use crate::postgres::customscan::joinscan::CtidColumn;
 use crate::postgres::heap::VisibilityChecker;
@@ -1124,15 +1124,15 @@ impl VisibilityFilterExec {
 
     /// Sets the ctid resolver (FFHelper and its index relation OID) for
     /// the given plan_position. Called by `VisibilityCtidResolverRule`.
-    pub fn set_ctid_resolver(&self, plan_pos: usize, indexrelid: u32, ffhelper: Arc<FFHelper>) {
+    pub fn set_ctid_resolver(&self, plan_pos: usize, resolver: CtidResolver) {
         let mut resolvers = self
             .ctid_resolvers
             .lock()
             .expect("VisibilityFilterExec ctid_resolvers lock poisoned");
         if plan_pos >= resolvers.len() {
             resolvers.resize(plan_pos + 1, None);
         }
-        resolvers[plan_pos] = Some((indexrelid, ffhelper));
+        resolvers[plan_pos] = Some(resolver);
     }
 
     /// Serialize for leader dispatch. The `ctid_resolvers` are live and don't travel; the worker
@@ -1144,7 +1144,7 @@ impl VisibilityFilterExec {
             .expect("VisibilityFilterExec ctid_resolvers lock poisoned")
             .iter()
             .enumerate()
-            .filter_map(|(pos, r)| r.as_ref().map(|(relid, _)| (pos, *relid)))
+            .filter_map(|(pos, r)| r.as_ref().map(|res| (pos, res.indexrelid)))
             .collect();
         let payload: VisibilityDispatchPayload = (
             self.plan_pos_oids.clone(),
@@ -1161,7 +1161,7 @@ impl VisibilityFilterExec {
     pub(crate) fn decode_for_dispatch(
         buf: &[u8],
         input: Arc<dyn ExecutionPlan>,
-        ctid_resolvers: Vec<(usize, u32, Arc<FFHelper>)>,
+        ctid_resolvers: Vec<(usize, CtidResolver)>,
         index_segment_views: &[SegmentView],
     ) -> Result<Arc<dyn ExecutionPlan>> {
         let (plan_pos_oids, table_names, projection, resolver_indexes): VisibilityDispatchPayload =
@@ -1171,11 +1171,18 @@ impl VisibilityFilterExec {
                 ))
             })?;
         let exec = VisibilityFilterExec::try_new(input, plan_pos_oids, table_names, projection)?;
-        for (plan_pos, indexrelid, ffhelper) in &ctid_resolvers {
-            exec.set_ctid_resolver(*plan_pos, *indexrelid, Arc::clone(ffhelper));
+        for (plan_pos, resolver) in ctid_resolvers {
+            exec.set_ctid_resolver(plan_pos, resolver);
         }
         for (plan_pos, indexrelid) in resolver_indexes {
-            if ctid_resolvers.iter().any(|(pos, _, _)| *pos == plan_pos) {
+            if exec
+                .ctid_resolvers
+                .lock()
+                .expect("VisibilityFilterExec ctid_resolvers lock poisoned")
+                .get(plan_pos)
+                .and_then(|r| r.as_ref())
+                .is_some()
+            {
                 continue;
             }
             let view = index_segment_views.get(plan_pos).cloned().ok_or_else(|| {
@@ -1185,7 +1192,7 @@ impl VisibilityFilterExec {
             })?;
             let ffhelper =
                 open_rebuilt_ffhelper(indexrelid, &[], MvccSatisfies::ParallelWorker(view))?;
-            exec.set_ctid_resolver(plan_pos, indexrelid, ffhelper);
+            exec.set_ctid_resolver(plan_pos, CtidResolver::new(indexrelid, ffhelper));
         }
         Ok(Arc::new(exec))
     }
@@ -1393,7 +1400,7 @@ impl ExecutionPlan for VisibilityFilterExec {
             let heaprel = PgSearchRelation::open(heap_oid);
             let resolver = resolvers
                 .get(plan_pos)
-                .and_then(|r| r.as_ref().map(|(_, ff)| Arc::clone(ff)))
+                .and_then(|r| r.as_ref().map(|res| Arc::clone(&res.ffhelper)))
                 .ok_or_else(|| {
                     DataFusionError::Execution(format!(
                         "VisibilityFilterExec: no ctid resolver wired for \
```

**File**: `pg_search/src/scan/execution_plan.rs` (modified, +51/-1)
```diff
@@ -1675,7 +1675,10 @@ pub(crate) fn stamp_parallel_state(plan: &Arc<dyn ExecutionPlan>, ps: *mut Paral
 /// `ParallelScanState`.
 ///
 /// [`DistributedLeafExec`]: datafusion_distributed::DistributedLeafExec
-fn visit_scan_nodes(plan: &Arc<dyn ExecutionPlan>, visit: &mut impl FnMut(&PgSearchScanPlan)) {
+pub(crate) fn visit_scan_nodes(
+    plan: &Arc<dyn ExecutionPlan>,
+    visit: &mut impl FnMut(&PgSearchScanPlan),
+) {
     if let Some(scan) = plan.downcast_ref::<PgSearchScanPlan>() {
         visit(scan);
     }
@@ -1700,6 +1703,53 @@ fn visit_scan_nodes(plan: &Arc<dyn ExecutionPlan>, visit: &mut impl FnMut(&PgSea
     }
 }
 
+/// The index relation OID and [`FFHelper`] needed to resolve deferred packed `DocAddress` values
+/// into real CTIDs for a specific table in a multi-table or deferred scan.
+///
+/// Wired by `VisibilityCtidResolverRule` from the source [`PgSearchScanPlan`] into the physical
+/// execution node performing visibility checking (`VisibilityFilterExec`), and into `JoinScanState`
+/// to resolve deferred CTIDs returned to PostgreSQL.
+#[derive(Clone)]
+pub struct CtidResolver {
+    pub indexrelid: u32,
+    pub ffhelper: Arc<FFHelper>,
+}
+
+impl std::fmt::Debug for CtidResolver {
+    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
+        f.debug_struct("CtidResolver")
+            .field("indexrelid", &self.indexrelid)
+            .finish_non_exhaustive()
+    }
+}
+
+impl CtidResolver {
+    pub fn new(indexrelid: u32, ffhelper: Arc<FFHelper>) -> Self {
+        Self {
+            indexrelid,
+            ffhelper,
+        }
+    }
+}
+
+/// Search the subtree for a [`PgSearchScanPlan`] whose deferred ctid metadata matches
+/// the given plan position. Returns its index relid and [`FFHelper`] if found.
+pub(crate) fn find_ctid_resolver_for_plan_position(
+    plan: &Arc<dyn ExecutionPlan>,
+    plan_position: usize,
+) -> Option<CtidResolver> {
+    let mut found = None;
+    visit_scan_nodes(plan, &mut |scan| {
+        if found.is_none()
+            && scan.deferred_ctid_plan_position() == Some(plan_position)
+            && let Some(ffhelper) = scan.ffhelper()
+        {
+            found = Some(CtidResolver::new(scan.indexrelid, ffhelper));
+        }
+    });
+    found
+}
+
 #[cfg(any(test, feature = "pg_test"))]
 #[pgrx::pg_schema]
 mod tests {
```

**File**: `pg_search/src/scan/mod.rs` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ mod udf_codec;
 pub mod visibility_ctid_resolver_rule;
 
 pub use batch_scanner::Scanner;
+pub use execution_plan::CtidResolver;
 pub use info::{GlobalPredicateIndex, ScanInfo, ScanMode, TagIndex, TaggedQuery};
 pub use table_provider::PgSearchTableProvider;
 pub(crate) use table_provider::VisibilityMode;
-pub use visibility_ctid_resolver_rule::CtidResolver;
```

**File**: `pg_search/src/scan/physical_codec.rs` (modified, +4/-3)
```diff
@@ -44,6 +44,7 @@ use crate::index::mvcc::SegmentView;
 use crate::postgres::ParallelScanState;
 use crate::postgres::customscan::datafusion::udaf_by_name;
 use crate::postgres::customscan::joinscan::visibility_filter::VisibilityFilterExec;
+use crate::scan::CtidResolver;
 use crate::scan::execution_plan::PgSearchScanPlan;
 use crate::scan::filter_passthrough_exec::FilterPassthroughExec;
 use crate::scan::segmented_topk_exec::SegmentedTopKExec;
@@ -265,15 +266,15 @@ fn single_input(inputs: &[Arc<dyn ExecutionPlan>]) -> Result<Arc<dyn ExecutionPl
     }
 }
 
-/// `(plan_position, indexrelid, ffhelper)` for each scan that resolves deferred ctids, for the
+/// `(plan_position, resolver)` for each scan that resolves deferred ctids, for the
 /// visibility exec.
-fn collect_ctid_resolvers(input: &Arc<dyn ExecutionPlan>) -> Vec<(usize, u32, Arc<FFHelper>)> {
+fn collect_ctid_resolvers(input: &Arc<dyn ExecutionPlan>) -> Vec<(usize, CtidResolver)> {
     let mut scans = Vec::new();
     collect_scan_runtime(input, &mut scans);
     scans
         .into_iter()
         .filter_map(|s| match (s.ctid_plan_position, s.ffhelper) {
-            (Some(pos), Some(ff)) => Some((pos, s.indexrelid, ff)),
+            (Some(pos), Some(ff)) => Some((pos, CtidResolver::new(s.indexrelid, ff))),
             _ => None,
         })
         .collect()
```

**File**: `pg_search/src/scan/visibility_ctid_resolver_rule.rs` (modified, +10/-65)
```diff
@@ -32,16 +32,8 @@ use datafusion::common::{DataFusionError, Result};
 use datafusion::physical_optimizer::PhysicalOptimizerRule;
 use datafusion::physical_plan::ExecutionPlan;
 
-use crate::index::fast_fields_helper::FFHelper;
 use crate::postgres::customscan::joinscan::visibility_filter::VisibilityFilterExec;
-use crate::scan::execution_plan::PgSearchScanPlan;
-
-/// The index relation OID and [`FFHelper`] needed to resolve deferred packed `DocAddress` values
-/// into real CTIDs for a specific table in a multi-table or deferred scan.
-///
-/// Wired by [`VisibilityCtidResolverRule`] from the source [`PgSearchScanPlan`] into the physical
-/// execution node performing visibility checking ([`VisibilityFilterExec`]).
-pub type CtidResolver = (u32, Arc<FFHelper>);
+use crate::scan::execution_plan::find_ctid_resolver_for_plan_position;
 
 #[derive(Debug)]
 pub struct VisibilityCtidResolverRule;
@@ -72,14 +64,14 @@ fn walk_plan(plan: &Arc<dyn ExecutionPlan>) -> Result<()> {
     // VisibilityFilterExec owns ctid resolution for its plan positions.
     if let Some(vf) = plan.downcast_ref::<VisibilityFilterExec>() {
         for &(plan_pos, _) in vf.plan_pos_oids() {
-            let (indexrelid, ffhelper) = find_ffhelper_for_plan_position(plan.as_ref(), plan_pos)
-                .ok_or_else(|| {
-                DataFusionError::Internal(format!(
-                    "VisibilityCtidResolverRule: no PgSearchScanPlan found \
+            let resolver =
+                find_ctid_resolver_for_plan_position(plan, plan_pos).ok_or_else(|| {
+                    DataFusionError::Internal(format!(
+                        "VisibilityCtidResolverRule: no PgSearchScanPlan found \
                      for VisibilityFilterExec deferred ctid plan_position {plan_pos}"
-                ))
-            })?;
-            vf.set_ctid_resolver(plan_pos, indexrelid, ffhelper);
+                    ))
+                })?;
+            vf.set_ctid_resolver(plan_pos, resolver);
         }
     }
     for child in plan.children() {
@@ -88,66 +80,20 @@ fn walk_plan(plan: &Arc<dyn ExecutionPlan>) -> Result<()> {
     Ok(())
 }
 
-/// Search the subtree for a PgSearchScanPlan whose deferred ctid metadata matches
-/// the given plan position. Returns its index relid and FFHelper if found.
-pub(crate) fn find_ffhelper_for_plan_position(
-    plan: &dyn ExecutionPlan,
-    plan_position: usize,
-) -> Option<CtidResolver> {
-    if let Some(scan) = plan.downcast_ref::<PgSearchScanPlan>()
-        && scan.deferred_ctid_plan_position() == Some(plan_position)
-    {
-        return scan.ffhelper().map(|ff| (scan.indexrelid, ff));
-    }
-
-    for child in plan.children() {
-        if let Some(helper) = find_ffhelper_for_plan_position(child.as_ref(), plan_position) {
-            return Some(helper);
-        }
-    }
-
-    None
-}
-
 #[cfg(any(test, feature = "pg_test"))]
 #[pgrx::pg_schema]
 mod tests {
-    use super::{VisibilityCtidResolverRule, find_ffhelper_for_plan_position};
+    use super::VisibilityCtidResolverRule;
     use std::sync::Arc;
 
     use arrow_schema::{Schema, SchemaRef};
     use pgrx::prelude::*;
 
     use crate::index::fast_fields_helper::FFHelper;
+    use crate::postgres::customscan::joinscan::visibility_filter::VisibilityFilterExec;
     use crate::query::SearchQueryInput;
     use crate::scan::execution_plan::PgSearchScanPlan;
 
-    fn empty_schema() -> SchemaRef {
-        Arc::new(Schema::empty())
-    }
-
-    #[pg_test]
-    fn matches_scan_by_deferred_ctid_plan_position() {
-        let ffhelper = Arc::new(FFHelper::empty());
-        let scan = PgSearchScanPlan::new(
-            None,
-            empty_schema(),
-            SearchQueryInput::All,
-            None,
-            Vec::new(),
-            Some(ffhelper.clone()),
-            0,
-            Some(7),
-            1,
-            None,
-            None,
-        );
-
-        let (_, found) = find_ffhelper_for_plan_position(&scan, 7)
-            .expect("matching plan_position should find ffhelper");
-        assert!(Arc::ptr_eq(&found, &ffhelper));
-        assert!(find_ffhelper_for_plan_position(&scan, 6).is_none());
-    }
     fn sort_schema() -> SchemaRef {
         use arrow_schema::{DataType, Field};
         Arc::new(Schema::new(vec![Field::new(
@@ -159,7 +105,6 @@ mod tests {
 
     #[pg_test]
     fn wires_ctid_resolver_to_visibility_filter_exec() {
-        use crate::postgres::customscan::joinscan::visibility_filter::VisibilityFilterExec;
         use datafusion::physical_optimizer::PhysicalOptimizerRule;
         use pgrx::pg_sys;
 
```

---

### Incident Patch 4: `e6c5c3e5` (2026-10-04)
**Commit Message**: perf: keep the first range partition's NULLs with an exclusion, not a union (#6592)

## Ticket(s) Closed

- Closes #6591

## What

This PR writes the first range partition's bounds as `all AND NOT (key
>= upper)` instead of `range OR (all AND NOT exists)`, and adds a
regress test that compares range co-partitioned joins over crossing
segments with their serial runs.

## Why

The first partition also takes the rows with a NULL key. In a segment
that crosses its edge, the old union walked every document however few
rows the base query matched, so that task lagged the others.

## How

The rows of the first partition are the ones not at or above its upper
edge. The NULLs stay in, and the base query drives the scan as it does
for the other partitions. The other shapes (a NULL split point, a single
partition) are unchanged.

## Tests

- `range_partition_crossing_segments` regress test
- `pg_partition_filter_is_omitted_only_when_redundant`
- `pg_test_range_partitioning_points_identical_values`

## Benchmark

20M, range variants, ms, `main` at `63152b584` against this PR. The
other joins are within 4%.

| Query | `main` | this PR |
| --- | ---: | ---: |
| `join_semi_filter` | 87 | 68 |
| `

**File**: `docs/project/changelog/unreleased/6592.performance.mdx` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+header: performance
+---
+
+Range-partitioned joins (`paradedb.enable_range_partitioned_join`) no longer walk every document of a segment that crosses the first partition's edge to find the rows with a NULL join key. Selective queries on that partition now cost the same as on the others.
```

**File**: `pg_search/src/index/reader/index.rs` (modified, +16/-13)
```diff
@@ -2868,25 +2868,28 @@ mod tests {
         );
         // Partition 0 owns the NULL rows, so a nullable segment inside its value range is fully
         // included and searches without the partition filter: all three rows belong to it.
-        // Partition 1 does not own NULLs, so the same segment stays partially included and
-        // the filter excludes the NULL row.
+        // With the edge inside the segment, partition 0 keeps the NULL row and drops the value
+        // above the edge. Partition 1 does not own NULLs, so the same segment stays partially
+        // included and the filter excludes the NULL row.
         for (split, partition, expected_all, included, partial) in
-            [(21, 0, 3, 1, 0), (5, 1, 2, 0, 1)]
+            [(21, 0, 3, 1, 0), (15, 0, 2, 0, 1), (5, 1, 2, 0, 1)]
         {
             let partitioning = RangePartitioning {
                 partition_by: FieldName::from("value"),
                 split_points: vec![PdbOwnedValue::I64(split)],
             };
-            check(
-                &index_rel,
-                &SearchQueryInput::All,
-                false,
-                &partitioning,
-                partition,
-                expected_all,
-                included,
-                partial,
-            );
+            for scoring in [false, true] {
+                check(
+                    &index_rel,
+                    &SearchQueryInput::All,
+                    scoring,
+                    &partitioning,
+                    partition,
+                    expected_all,
+                    included,
+                    partial,
+                );
+            }
         }
     }
 
```

**File**: `pg_search/src/scan/range_partitioning.rs` (modified, +37/-13)
```diff
@@ -71,7 +71,8 @@ impl RangePartitioning {
     /// rule reads it from here.
     pub const NULL_PARTITION: usize = 0;
 
-    /// Returns the logical bounds as a range query, including the NULL clause where needed.
+    /// Returns the rows of `partition` as a query. The first partition keeps its NULLs by
+    /// excluding the keys at or above its upper edge; every other partition is a plain range.
     ///
     /// **Consumer Caveats**:
     /// - A row whose partition field is NULL will be deterministically routed to
@@ -81,13 +82,29 @@ impl RangePartitioning {
         let Some(range) = self.partition_range(partition) else {
             return SearchQueryInput::All;
         };
+        // The NULLs and the values below `upper` are the rows that are not at or above it.
+        // Excluding that range lets the base query drive the scan; a union with a NULL clause
+        // would walk every document of the segment.
+        if range.includes_nulls()
+            && let Some((Bound::Unbounded, upper)) = range.values()
+            && let Some(at_or_above) = match upper {
+                Bound::Excluded(value) => Some(Bound::Included(value.clone())),
+                Bound::Included(value) => Some(Bound::Excluded(value.clone())),
+                Bound::Unbounded => None,
+            }
+        {
+            return self.all_except(Query::Range {
+                lower_bound: at_or_above,
+                upper_bound: Bound::Unbounded,
+            });
+        }
         let range_query = range
             .values()
             .map(|(lower, upper)| SearchQueryInput::FieldedQuery {
                 field: self.partition_by.clone(),
                 query: if matches!((lower, upper), (Bound::Unbounded, Bound::Unbounded)) {
-                    // After a NULL split, this partition contains every non-NULL value.
-                    // The range compiler requires at least one finite bound.
+                    // After a NULL split, this partition contains every non-NULL value. Two
+                    // unbounded bounds compile to a match-all, which would take the NULLs too.
                     Query::Exists
                 } else {
                     Query::Range {
@@ -96,16 +113,9 @@ impl RangePartitioning {
                     }
                 },
             });
-        let null_query = range.includes_nulls().then(|| SearchQueryInput::Boolean {
-            // A pure-negative Boolean matches nothing. All supplies the positive clause.
-            must: vec![SearchQueryInput::All],
-            should: vec![],
-            must_not: vec![SearchQueryInput::FieldedQuery {
-                field: self.partition_by.clone(),
-                query: Query::Exists,
-            }],
-            minimum_should_match: None,
-        });
+        let null_query = range
+            .includes_nulls()
+            .then(|| self.all_except(Query::Exists));
         match (range_query, null_query) {
             (Some(range_query), Some(null_query)) => SearchQueryInput::Boolean {
                 must: vec![],
@@ -118,6 +128,20 @@ impl RangePartitioning {
         }
     }
 
+    /// Every row except the ones `query` matches on the partition field. A pure-negative
+    /// Boolean matches nothing, so `All` supplies the positive clause.
+    fn all_except(&self, query: Query) -> SearchQueryInput {
+        SearchQueryInput::Boolean {
+            must: vec![SearchQueryInput::All],
+            should: vec![],
+            must_not: vec![SearchQueryInput::FieldedQuery {
+                field: self.partition_by.clone(),
+                query,
+            }],
+            minimum_should_match: None,
+        }
+    }
+
     /// The rows of `partition`, or `None` without split points, when every row belongs to the
     /// single partition. [`Self::partition_bounds`] queries exactly these rows.
     pub fn partition_range(&self, partition: usize) -> Option<PartitionRange> {
```

**File**: `pg_search/src/scan/tests.rs` (modified, +25/-2)
```diff
@@ -688,7 +688,9 @@ mod tests {
         use crate::api::FieldName;
         use crate::postgres::pdb_owned_value::PdbOwnedValue;
         use crate::query::SearchQueryInput;
+        use crate::query::pdb_query::pdb::Query;
         use crate::scan::range_partitioning::RangeSplitPoints;
+        use std::ops::Bound;
 
         let split_points = RangeSplitPoints {
             partition_by: FieldName::from("id"),
@@ -705,9 +707,30 @@ mod tests {
         assert_eq!(build.split_points[1], PdbOwnedValue::I64(10));
         assert_eq!(build.split_points[2], PdbOwnedValue::I64(10));
 
-        // partition 0: upper is 10 -> Range OR Boolean(All AND NOT Exists)
+        // partition 0: upper is 10 -> All AND NOT Range(at or above 10), which keeps the NULLs
+        // without a union.
         let p0 = build.partition_bounds(0);
-        assert!(matches!(p0, SearchQueryInput::Boolean { .. }));
+        let SearchQueryInput::Boolean {
+            must,
+            should,
+            must_not,
+            ..
+        } = p0
+        else {
+            panic!("expected a Boolean, got {p0:?}");
+        };
+        assert!(matches!(must.as_slice(), [SearchQueryInput::All]));
+        assert!(should.is_empty());
+        assert!(matches!(
+            must_not.as_slice(),
+            [SearchQueryInput::FieldedQuery {
+                field,
+                query: Query::Range {
+                    lower_bound: Bound::Included(PdbOwnedValue::I64(10)),
+                    upper_bound: Bound::Unbounded,
+                },
+            }] if field.as_ref() == "id"
+        ));
 
         // partition 1: lower is 10, upper is 10 -> Range
         let p1 = build.partition_bounds(1);
```

**File**: `pg_search/tests/pg_regress/expected/range_partition_crossing_segments.out` (added, +424/-0)
```diff
@@ -0,0 +1,424 @@
+-- =====================================================================
+-- A range co-partitioned join checks a partition's edges in the segments
+-- that cross them (`partial`). The check must only select rows. A NULL key
+-- belongs to the first partition only, every value lands in one partition,
+-- and a row scores the same as in a serial scan, on a numeric key and on a
+-- text key.
+--
+-- The property tests compare against Postgres, which has no `pdb.score()`,
+-- so a score that drifts between a whole and a crossing segment never shows
+-- there. They also leave it to chance whether a NULL key sits in a crossing
+-- segment. This test pins both with a serial run as the oracle.
+-- =====================================================================
+CREATE EXTENSION IF NOT EXISTS pg_search;
+SET paradedb.enable_join_custom_scan TO on;
+SET paradedb.enable_aggregate_custom_scan TO on;
+SET paradedb.enable_range_partitioned_join TO on;
+SET paradedb.mpp_min_rows TO 0;
+SET max_parallel_workers TO 8;
+SET min_parallel_table_scan_size TO 0;
+SET parallel_setup_cost TO 0;
+SET parallel_tuple_cost TO 0;
+SET max_parallel_maintenance_workers TO 0;
+CREATE TABLE rpx_users (id bigserial PRIMARY KEY, display_name text);
+CREATE TABLE rpx_posts (id bigserial PRIMARY KEY, owner_user_id bigint, owner_name text, title text);
+INSERT INTO rpx_users (display_name)
+SELECT 'user_' || lpad(g::text, 4, '0') FROM generate_series(1, 4000) g;
+-- Owners drift upward with `id`, so the `owner_user_id` boxes of the posts
+-- segments overlap and a join on that key crosses them.
+INSERT INTO rpx_posts (owner_user_id, owner_name, title)
+SELECT o, 'user_' || lpad(o::text, 4, '0'), CASE WHEN g % 3 = 0 THEN 'error in build ' ELSE 'note ' END || g
+FROM generate_series(1, 16000) g, LATERAL (SELECT 1 + ((g * 7919) % (2000 + g / 8)) AS o) owner;
+CREATE INDEX rpx_users_idx ON rpx_users USING paradedb (id, (display_name::pdb.literal))
+WITH (partition_by = 'id', target_segment_count = 4);
+WARNING:  only 0 parallel workers were available for index build
+CREATE INDEX rpx_posts_idx ON rpx_posts USING paradedb (id, owner_user_id, (owner_name::pdb.literal), title)
+WITH (partition_by = 'id, owner_user_id', target_segment_count = 8);
+WARNING:  only 0 parallel workers were available for index build
+-- One more segment whose keys span every partition and include NULLs, so it
+-- crosses every edge and its NULL rows must reach the first partition only.
+SET paradedb.global_mutable_segment_rows TO 0;
+INSERT INTO rpx_posts (owner_user_id, owner_name, title)
+SELECT o, 'user_' || lpad(o::text, 4, '0'), 'error without owner ' || g
+FROM generate_series(1, 400) g, LATERAL (SELECT CASE WHEN g % 4 = 0 THEN NULL ELSE 1 + ((g * 7919) % 4000) END AS o) owner;
+RESET paradedb.global_mutable_segment_rows;
+ANALYZE rpx_users;
+ANALYZE rpx_posts;
+-- Serial baselines.
+SET max_parallel_workers_per_gather TO 0;
+SELECT count(*) AS total, count(*) FILTER (WHERE u.id IS NULL) AS orphans
+FROM rpx_posts p LEFT JOIN rpx_users u ON u.id = p.owner_user_id AND u.id @@@ pdb.all()
+WHERE p.title ||| 'error';
+ total | orphans 
+-------+---------
+  5733 |     100
+(1 row)
+
+SELECT count(*) AS owner_join_rows
+FROM rpx_users u JOIN rpx_posts p ON u.id = p.owner_user_id
+WHERE u.id @@@ pdb.all() AND p.title ||| 'error';
+ owner_join_rows 
+-----------------
+            5633
+(1 row)
+
+SELECT p.id, pdb.score(p.id) AS score
+FROM rpx_users u JOIN rpx_posts p ON u.id = p.owner_user_id
+WHERE u.id @@@ pdb.all() AND p.title ||| 'error without owner'
+ORDER BY p.id DESC
+LIMIT 6;
+  id   | score  
+-------+--------
+ 16399 | 7.0799
+ 16398 | 7.0799
+ 16397 | 7.0799
+ 16395 | 7.0799
+ 16394 | 7.0799
+ 16393 | 7.0799
+(6 rows)
+
+SELECT p.id, pdb.score(p.id) AS score, u.id IS NULL AS orphan
+FROM rpx_posts p LEFT JOIN rpx_users u ON u.id = p.owner_user_id AND u.id @@@ pdb.all()
+WHERE p.title ||| 'error without owner'
+ORDER BY pdb.score(p.id) DESC, p.id
+LIMIT 8;
+  id   | score  | orphan 
+-------+--------+--------
+ 16001 | 7.0799 | f
+ 16002 | 7.0799 | f
+ 16003 | 7.0799 | f
+ 16004 | 7.0799 | t
+ 16005 | 7.0799 | f
+ 16006 | 7.0799 | f
+ 16007 | 7.0799 | f
+ 16008 | 7.0799 | t
+(8 rows)
+
+-- =====================================================================
+-- The range-partitioned join reaches into crossing segments in every task
+-- and must produce the same rows and the same scores.
+-- =====================================================================
+SET max_parallel_workers_per_gather TO 3;
+EXPLAIN (COSTS OFF, VERBOSE, TIMING OFF)
+SELECT count(*) AS total, count(*) FILTER (WHERE u.id IS NULL) AS orphans
+FROM rpx_posts p LEFT JOIN rpx_users u ON u.id = p.owner_user_id AND u.id @@@ pdb.all()
+WHERE p.title ||| 'error';
+                                                                                                                                                           QUERY PLAN                                          
```

**File**: `pg_search/tests/pg_regress/sql/range_partition_crossing_segments.sql` (added, +188/-0)
```diff
@@ -0,0 +1,188 @@
+-- =====================================================================
+-- A range co-partitioned join checks a partition's edges in the segments
+-- that cross them (`partial`). The check must only select rows. A NULL key
+-- belongs to the first partition only, every value lands in one partition,
+-- and a row scores the same as in a serial scan, on a numeric key and on a
+-- text key.
+--
+-- The property tests compare against Postgres, which has no `pdb.score()`,
+-- so a score that drifts between a whole and a crossing segment never shows
+-- there. They also leave it to chance whether a NULL key sits in a crossing
+-- segment. This test pins both with a serial run as the oracle.
+-- =====================================================================
+
+CREATE EXTENSION IF NOT EXISTS pg_search;
+
+SET paradedb.enable_join_custom_scan TO on;
+SET paradedb.enable_aggregate_custom_scan TO on;
+SET paradedb.enable_range_partitioned_join TO on;
+SET paradedb.mpp_min_rows TO 0;
+SET max_parallel_workers TO 8;
+SET min_parallel_table_scan_size TO 0;
+SET parallel_setup_cost TO 0;
+SET parallel_tuple_cost TO 0;
+SET max_parallel_maintenance_workers TO 0;
+
+CREATE TABLE rpx_users (id bigserial PRIMARY KEY, display_name text);
+CREATE TABLE rpx_posts (id bigserial PRIMARY KEY, owner_user_id bigint, owner_name text, title text);
+
+INSERT INTO rpx_users (display_name)
+SELECT 'user_' || lpad(g::text, 4, '0') FROM generate_series(1, 4000) g;
+-- Owners drift upward with `id`, so the `owner_user_id` boxes of the posts
+-- segments overlap and a join on that key crosses them.
+INSERT INTO rpx_posts (owner_user_id, owner_name, title)
+SELECT o, 'user_' || lpad(o::text, 4, '0'), CASE WHEN g % 3 = 0 THEN 'error in build ' ELSE 'note ' END || g
+FROM generate_series(1, 16000) g, LATERAL (SELECT 1 + ((g * 7919) % (2000 + g / 8)) AS o) owner;
+
+CREATE INDEX rpx_users_idx ON rpx_users USING paradedb (id, (display_name::pdb.literal))
+WITH (partition_by = 'id', target_segment_count = 4);
+CREATE INDEX rpx_posts_idx ON rpx_posts USING paradedb (id, owner_user_id, (owner_name::pdb.literal), title)
+WITH (partition_by = 'id, owner_user_id', target_segment_count = 8);
+
+-- One more segment whose keys span every partition and include NULLs, so it
+-- crosses every edge and its NULL rows must reach the first partition only.
+SET paradedb.global_mutable_segment_rows TO 0;
+INSERT INTO rpx_posts (owner_user_id, owner_name, title)
+SELECT o, 'user_' || lpad(o::text, 4, '0'), 'error without owner ' || g
+FROM generate_series(1, 400) g, LATERAL (SELECT CASE WHEN g % 4 = 0 THEN NULL ELSE 1 + ((g * 7919) % 4000) END AS o) owner;
+RESET paradedb.global_mutable_segment_rows;
+
+ANALYZE rpx_users;
+ANALYZE rpx_posts;
+
+-- Serial baselines.
+SET max_parallel_workers_per_gather TO 0;
+
+SELECT count(*) AS total, count(*) FILTER (WHERE u.id IS NULL) AS orphans
+FROM rpx_posts p LEFT JOIN rpx_users u ON u.id = p.owner_user_id AND u.id @@@ pdb.all()
+WHERE p.title ||| 'error';
+
+SELECT count(*) AS owner_join_rows
+FROM rpx_users u JOIN rpx_posts p ON u.id = p.owner_user_id
+WHERE u.id @@@ pdb.all() AND p.title ||| 'error';
+
+SELECT p.id, pdb.score(p.id) AS score
+FROM rpx_users u JOIN rpx_posts p ON u.id = p.owner_user_id
+WHERE u.id @@@ pdb.all() AND p.title ||| 'error without owner'
+ORDER BY p.id DESC
+LIMIT 6;
+
+SELECT p.id, pdb.score(p.id) AS score, u.id IS NULL AS orphan
+FROM rpx_posts p LEFT JOIN rpx_users u ON u.id = p.owner_user_id AND u.id @@@ pdb.all()
+WHERE p.title ||| 'error without owner'
+ORDER BY pdb.score(p.id) DESC, p.id
+LIMIT 8;
+
+-- =====================================================================
+-- The range-partitioned join reaches into crossing segments in every task
+-- and must produce the same rows and the same scores.
+-- =====================================================================
+
+SET max_parallel_workers_per_gather TO 3;
+
+EXPLAIN (COSTS OFF, VERBOSE, TIMING OFF)
+SELECT count(*) AS total, count(*) FILTER (WHERE u.id IS NULL) AS orphans
+FROM rpx_posts p LEFT JOIN rpx_users u ON u.id = p.owner_user_id AND u.id @@@ pdb.all()
+WHERE p.title ||| 'error';
+
+SELECT count(*) AS total, count(*) FILTER (WHERE u.id IS NULL) AS orphans
+FROM rpx_posts p LEFT JOIN rpx_users u ON u.id = p.owner_user_id AND u.id @@@ pdb.all()
+WHERE p.title ||| 'error';
+
+EXPLAIN (COSTS OFF, VERBOSE, TIMING OFF)
+SELECT count(*) AS owner_join_rows
+FROM rpx_users u JOIN rpx_posts p ON u.id = p.owner_user_id
+WHERE u.id @@@ pdb.all() AND p.title ||| 'error';
+
+SELECT count(*) AS owner_join_rows
+FROM rpx_users u JOIN rpx_posts p ON u.id = p.owner_user_id
+WHERE u.id @@@ pdb.all() AND p.title ||| 'error';
+
+-- Scored, with a Top K on another column.
+EXPLAIN (COSTS OFF, VERBOSE, TIMING OFF)
+SELECT p.id, pdb.score(p.id) AS score
+FROM rpx_users u JOIN rpx_posts p ON u.id = p.owner_user_id
+WHERE u.id @@@ pdb.all() AND p.title ||| 'error without owner'
+ORDER BY p.id DESC
+LIMIT 6;
+
+SELECT 
```

---

### Incident Patch 5: `6a48631c` (2026-10-04)
**Commit Message**: ci: fix upgrade coverage and consolidate PostgreSQL setup (#6647)

## Ticket(s) Closed

- Closes #6646

## What

Fix upgrade tests starting from 0.26.0 and consolidate PostgreSQL/pgrx
setup across CI workflows.

The kitchen-sink fixture now supports both test-table procedure names.
Legacy regex, key-field tokenizer, and vector-storage fixtures run only
when the starting release predates 0.26.0; that cutoff lives in the
action, without per-fixture metadata files.

## Upgrade Coverage

- Test from **0.25.0**, the first stable release supporting vector
indexes, and the **latest stable release**. This changes the oldest
CI-tested starting release from 0.22.0 to 0.25.0.
- The pinned row exercises legacy tokenizer behavior and the old vector
storage format. The latest-release row exercises the current upgrade
path.
- Create 10,000 vector rows, then insert another 10,000 after committing
setup, with a layer size based on the total size of the initial segments
to trigger a foreground merge. In 0.25.0 clustering occurs only during
merging; retain the assertion that verifies a clustered legacy segment
before upgrading. Post-upgrade writes bring the total to 40,000 rows.
- Use the `paradedb` 

**File**: `.github/actions/setup-benchmark-cluster/action.yml` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ runs:
         cache_prefix_key: "v2-benchmarks-rust-cache"
         cache_save: "true"
         cache_on_failure: "true"
-        extra_packages: lld libopenblas-dev postgresql-${{ inputs.pg_version }}-pgvector gdb
+        extra_packages: lld libopenblas-dev gdb
 
     - name: Enable Crash Dumps
       shell: bash
```

**File**: `.github/actions/setup-pg-search-build-environment/action.yml` (modified, +6/-11)
```diff
@@ -26,12 +26,6 @@ inputs:
 runs:
   using: composite
   steps:
-    - name: Install PostgreSQL ${{ inputs.pg_version }} and Build Dependencies
-      uses: ./.github/actions/setup-postgres
-      with:
-        pg_version: ${{ inputs.pg_version }}
-        extra_packages: ${{ inputs.extra_packages }}
-
     - name: Set Up pg_search Toolchain
       uses: ./.github/actions/setup-pg-search-toolchain
       with:
@@ -40,8 +34,9 @@ runs:
         cache_save: ${{ inputs.cache_save }}
         cache_on_failure: ${{ inputs.cache_on_failure }}
 
-    - name: Initialize pgrx Environment
-      shell: bash
-      env:
-        INPUTS_PG_VERSION: ${{ inputs.pg_version }}
-      run: cargo pgrx init "--pg${INPUTS_PG_VERSION}=/usr/lib/postgresql/${INPUTS_PG_VERSION}/bin/pg_config"
+    - name: Install PostgreSQL ${{ inputs.pg_version }} and Build Dependencies
+      id: postgres
+      uses: ./.github/actions/setup-postgres
+      with:
+        pg_version: ${{ inputs.pg_version }}
+        extra_packages: ${{ inputs.extra_packages }}
```

**File**: `.github/actions/setup-postgres/action.yml` (modified, +75/-2)
```diff
@@ -1,7 +1,19 @@
 name: Set Up PostgreSQL
-description: Configure the PostgreSQL APT repository (PGDG) and install PostgreSQL packages
+description: Set up system or pgrx-managed PostgreSQL with the required pgvector dependency
 
 inputs:
+  pg_impl:
+    description: "PostgreSQL installation: system or pgrx"
+    required: false
+    default: "system"
+  initialize_pgrx:
+    description: "Initialize cargo-pgrx for PostgreSQL; requires cargo-pgrx to be installed first"
+    required: false
+    default: "true"
+  pgrx_cache_hit:
+    description: "Use restored pgrx PostgreSQL binaries instead of downloading and compiling"
+    required: false
+    default: "false"
   pg_version:
     description: "PostgreSQL major version to install (e.g. 17, 18)"
     required: true
@@ -10,10 +22,16 @@ inputs:
     required: false
     default: ""
 
+outputs:
+  pg_config:
+    description: "Absolute path to the configured PostgreSQL pg_config"
+    value: ${{ steps.postgres.outputs.pg_config }}
+
 runs:
   using: composite
   steps:
     - name: Configure PGDG APT repository
+      if: inputs.pg_impl == 'system'
       shell: bash
       run: |
         set -euo pipefail
@@ -24,15 +42,70 @@ runs:
           | sudo tee /etc/apt/sources.list.d/pgdg.list >/dev/null
 
     - name: Install PostgreSQL Packages
+      if: inputs.pg_impl == 'system'
       uses: paradedb/actions/apt-install@v14
       with:
         packages: >-
           postgresql-${{ inputs.pg_version }}
           postgresql-server-dev-${{ inputs.pg_version }}
+          postgresql-${{ inputs.pg_version }}-pgvector
           ${{ inputs.extra_packages }}
 
+    - name: Initialize pgrx-managed PostgreSQL
+      if: inputs.pg_impl == 'pgrx' && inputs.initialize_pgrx == 'true'
+      shell: bash
+      env:
+        INPUTS_PG_VERSION: ${{ inputs.pg_version }}
+        PGRX_CACHE_HIT: ${{ inputs.pgrx_cache_hit }}
+      run: |
+        set -euo pipefail
+        if [ "$PGRX_CACHE_HIT" != 'true' ]; then
+          cargo pgrx init "--pg${INPUTS_PG_VERSION}=download" --configure-flag="--without-readline"
+        else
+          # Only compiled binaries are cached; recreate pgrx config and database state.
+          configs=("$HOME"/.pgrx/"${INPUTS_PG_VERSION}".*/pgrx-install/bin/pg_config)
+          test -x "${configs[0]}"
+          cargo pgrx init "--pg${INPUTS_PG_VERSION}=${configs[0]}"
+        fi
+
     - name: Configure PostgreSQL PATH
+      id: postgres
       shell: bash
       env:
         INPUTS_PG_VERSION: ${{ inputs.pg_version }}
-      run: echo "/usr/lib/postgresql/${INPUTS_PG_VERSION}/bin" >> "$GITHUB_PATH"
+        INPUTS_PG_IMPL: ${{ inputs.pg_impl }}
+      run: |
+        set -euo pipefail
+        case "$INPUTS_PG_IMPL" in
+          system) PG_CONFIG="/usr/lib/postgresql/${INPUTS_PG_VERSION}/bin/pg_config" ;;
+          pgrx)
+            configs=("$HOME"/.pgrx/"${INPUTS_PG_VERSION}".*/pgrx-install/bin/pg_config)
+            PG_CONFIG="${configs[0]}"
+            ;;
+          *) echo "Unsupported PostgreSQL installation: $INPUTS_PG_IMPL" >&2; exit 1 ;;
+        esac
+        test -x "$PG_CONFIG"
+        echo "$(dirname "$PG_CONFIG")" >> "$GITHUB_PATH"
+        echo "pg_config=$PG_CONFIG" >> "$GITHUB_OUTPUT"
+
+    - name: Initialize pgrx for System PostgreSQL
+      if: inputs.pg_impl == 'system' && inputs.initialize_pgrx == 'true'
+      shell: bash
+      env:
+        INPUTS_PG_VERSION: ${{ inputs.pg_version }}
+        PG_CONFIG: ${{ steps.postgres.outputs.pg_config }}
+      run: cargo pgrx init "--pg${INPUTS_PG_VERSION}=${PG_CONFIG}"
+
+    # System packages cannot install into pgrx's private PostgreSQL prefix, so we compile it from source.
+    - name: Install pgvector Dependency (pgrx)
+      if: inputs.pg_impl == 'pgrx'
+      shell: bash
+      env:
+        PG_CONFIG: ${{ steps.postgres.outputs.pg_config }}
+      run: |
+        set -euo pipefail
+        SOURCE_DIR="$(mktemp -d)"
+        trap 'rm -rf "$SOURCE_DIR"' EXIT
+        git clone --depth 1 --branch v0.8.6 https://github.com/pgvector/pgvector.git "$SOURCE_DIR"
+        make -C "$SOURCE_DIR" PG_CONFIG="$PG_CONFIG" -j "$(nproc)"
+        make -C "$SOURCE_DIR" PG_CONFIG="$PG_CONFIG" install
```

**File**: `.github/actions/test-pg_search-upgrade/README.md` (modified, +2/-0)
```diff
@@ -4,6 +4,8 @@ New versions of ParadeDB must maintain compatibility with old versions so that u
 
 To add a test, add a folder containing files called `setup.sql` and `queries.sql`. `setup.sql` should create the tables, indexes, and data necessary to arrange your test case and will be run on the old version of the DB. `queries.sql` should contain the queries to run against the upgraded DB. The folder name will be used as the name of the DB so that there is isolation between test cases.
 
+The `Preserve SQL Files` step skips the legacy regex, key-field tokenizer, and vector-storage cases for starting releases at or after 0.26.0. The pinned 0.25.0 row, the first stable release with vector indexes, covers legacy tokenizer behavior and the old vector storage format. The latest-release row covers the current upgrade path.
+
 After upgrading, we also assert that the upgraded schema is byte-for-byte identical to a fresh `CREATE EXTENSION` of the new version (the "Verify Upgraded Schema Matches Fresh Install" step, using `schema_snapshot.sql`). This catches migrations that are incomplete on the `ALTER EXTENSION ... UPDATE` path -- e.g. when an object's DDL is emitted into an already-shipped migration file, so it reaches fresh installs but never reaches users upgrading from a later version. This is independent of the per-case `queries.sql`, which only catches drift in objects a query happens to touch.
 
 We also run the integration tests after upgrading. This verifies that the extension symbols are upgraded properly but does not give any validation that the on-disk changes are correct because the tests don't use DBs created on the old version.
```

**File**: `.github/actions/test-pg_search-upgrade/action.yml` (modified, +25/-3)
```diff
@@ -17,12 +17,27 @@ runs:
   steps:
     - name: Preserve SQL Files
       shell: bash
+      env:
+        INPUTS_PRIOR_PG_SEARCH_VERSION: ${{ inputs.prior_pg_search_version }}
       run: |
         SQL_DIR="$(mktemp -d)"
+        PRIOR="${INPUTS_PRIOR_PG_SEARCH_VERSION#v}"
         for case_dir in "${GITHUB_ACTION_PATH}"/*; do
-          [ -d "$case_dir" ] && cp -R "$case_dir" "$SQL_DIR/"
+          [ -d "$case_dir" ] || continue
+          # These fixtures require pre-0.26 tokenizer behavior or vector storage.
+          # Keep them on the pinned older rows; newer releases cannot build them.
+          case "$(basename "$case_dir")" in
+            regex_tokenizers|key_field_tokenizers|vector_storage)
+              if [ "$(printf '%s\n%s\n' '0.26.0' "$PRIOR" | sort -V | head -n 1)" = '0.26.0' ]; then
+                echo "Skipping $(basename "$case_dir"): requires a release before 0.26.0"
+                continue
+              fi
+              ;;
+          esac
+          cp -R "$case_dir" "$SQL_DIR/"
         done
         echo "UPGRADE_SQL_DIR=$SQL_DIR" >> "$GITHUB_ENV"
+        echo "UPGRADE_CI_HELPERS_REF=$(git rev-parse HEAD)" >> "$GITHUB_ENV"
 
         # Preserve standalone helper SQL too: `git checkout <prior version>` below
         # replaces this action's directory with the prior version's contents,
@@ -224,8 +239,8 @@ runs:
         fi
         echo "Upgraded schema matches a fresh install."
 
-    # We test each BM25 index after the upgrade to test for version compatibility.
-    - name: Test BM25 Index
+    # We test each ParadeDB index after the upgrade to test for version compatibility.
+    - name: Test ParadeDB Index
       working-directory: pg_search/
       shell: bash
       env:
@@ -249,6 +264,13 @@ runs:
         export PG_CONFIG="/usr/lib/postgresql/${INPUTS_PG_VERSION}/bin/pg_config"
         RUST_BACKTRACE=1 cargo test --jobs $(nproc)
 
+    # An early failure can leave the checkout on an old release without current
+    # diagnostic scripts or local actions needed by post-job cache cleanup.
+    - name: Restore CI Helpers
+      if: always()
+      shell: bash
+      run: git restore --source="$UPGRADE_CI_HELPERS_REF" -- .github
+
     - name: Print the Postgres Logs
       if: always()
       shell: bash
```

**File**: `.github/actions/test-pg_search-upgrade/codecs/setup.sql` (modified, +2/-4)
```diff
@@ -1,16 +1,14 @@
 -- NOTE: this file runs against the PRIOR extension version, not the one being built.
 -- The `Preserve SQL Files` step copies these fixtures out of the PR head into a
 -- tmpdir, then checks out an older tag and installs that version, so everything here
--- must be valid SQL for the oldest tag in the upgrade matrix. That is why the index
--- below says `using bm25` rather than `using paradedb`: the `paradedb` access method
--- only exists from 0.25.0 onward. Do not sweep this into current naming.
+-- must be valid SQL for every tag in the upgrade matrix.
 
 create table items (
     id bigserial,
     number bigint
 );
 
 create index search_idx on items
-using bm25 (id, number) with (key_field='id');
+using paradedb (id, number) with (key_field='id');
 
 insert into items (id, number) values (1, 12345);
```

**File**: `.github/actions/test-pg_search-upgrade/key_field_tokenizers/setup.sql` (modified, +3/-3)
```diff
@@ -1,11 +1,11 @@
 CREATE TABLE text_key (id TEXT PRIMARY KEY, body TEXT);
 INSERT INTO text_key VALUES ('Original Case-ID', 'original');
-CREATE INDEX text_key_idx ON text_key USING bm25 (id, body) WITH (key_field = 'id');
+CREATE INDEX text_key_idx ON text_key USING paradedb (id, body) WITH (key_field = 'id');
 
 CREATE TABLE uuid_key (id UUID PRIMARY KEY, body TEXT);
 INSERT INTO uuid_key VALUES ('550e8400-e29b-41d4-a716-446655440000', 'original');
-CREATE INDEX uuid_key_idx ON uuid_key USING bm25 (id, body) WITH (key_field = 'id');
+CREATE INDEX uuid_key_idx ON uuid_key USING paradedb (id, body) WITH (key_field = 'id');
 
 CREATE TABLE json_key (id JSONB PRIMARY KEY, body TEXT);
 INSERT INTO json_key VALUES ('{"key": "original"}', 'original');
-CREATE INDEX json_key_idx ON json_key USING bm25 (id, body) WITH (key_field = 'id');
+CREATE INDEX json_key_idx ON json_key USING paradedb (id, body) WITH (key_field = 'id');
```

**File**: `.github/actions/test-pg_search-upgrade/kitchen_sink/setup.sql` (modified, +12/-6)
```diff
@@ -1,12 +1,18 @@
 -- NOTE: this file runs against the PRIOR extension version, not the one being built.
 -- The `Preserve SQL Files` step copies these fixtures out of the PR head into a
 -- tmpdir, then checks out an older tag and installs that version, so everything here
--- must be valid SQL for the oldest tag in the upgrade matrix. That is why the index
--- below says `using bm25` rather than `using paradedb` (the `paradedb` access method
--- only exists from 0.25.0 onward), and why `paradedb.create_bm25_test_table` keeps its
--- pre-rename name. Do not sweep these into current naming.
+-- must be valid SQL for every tag in the upgrade matrix.
 
-CALL paradedb.create_bm25_test_table(schema_name => 'public', table_name => 'mock_items');
+-- 0.26.0 renamed `paradedb.create_bm25_test_table` and dropped the old name, so the
+-- oldest and the newest tag in the matrix have one name each.
+DO $$
+BEGIN
+    IF to_regproc('paradedb.create_paradedb_test_table') IS NOT NULL THEN
+        CALL paradedb.create_paradedb_test_table(schema_name => 'public', table_name => 'mock_items');
+    ELSE
+        CALL paradedb.create_bm25_test_table(schema_name => 'public', table_name => 'mock_items');
+    END IF;
+END $$;
 
 ALTER TABLE mock_items
 ADD COLUMN price NUMERIC(10, 2),
@@ -28,7 +34,7 @@ SET
     active_period = daterange(last_updated_date, last_updated_date + rating, '[]');
 
 CREATE INDEX search_idx ON mock_items
-USING bm25 (
+USING paradedb (
     id,
     description,
     (category::pdb.literal),
```

---

### Incident Patch 6: `63152b58` (2026-10-03)
**Commit Message**: fix: run AggregateScan when PostgreSQL moves a `HAVING` condition to `WHERE` (#6638)

## Ticket(s) Closed

- Closes #6636

## What

This PR lets AggregateScan run a `GROUP BY` query with a `HAVING`
condition on a grouping key, and a grouped subquery with a condition of
the outer query on a grouping key:

```sql
SELECT *
FROM (
    SELECT account_id, kind, COUNT(*) AS n
    FROM items
    WHERE id @@@ paradedb.all()
    GROUP BY account_id, kind
) AS grouped
WHERE account_id > 1;
```

Both declined with `HAVING clause is not supported`.

## Why

Postgres moves a `HAVING` condition that has no aggregate to `WHERE`
(`subquery_planner()`), and it pushes a condition of an outer query into
a grouped subquery the same way. No `HAVING` clause is left, but
`root->hasHavingQual` stays set, and the Tantivy backend read that flag.

## How

The backend reads `parse->havingQual` instead, which holds only the
conditions that Postgres keeps in `HAVING`. A condition with an
aggregate, a volatile function or a SubPlan stays there and declines as
before. So does any condition other than constant true when there is no
`GROUP BY`.

A grouped subquery with an outer `ORDER BY` on its keys can return the


**File**: `docs/project/changelog/unreleased/6636.stability.mdx` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+header: stability
+---
+
+Aggregate Scan now runs a `GROUP BY` query with a `HAVING` condition that has no aggregate, such as a condition on a grouping key, and a grouped subquery with a condition of the outer query on a grouping key. Postgres moves such a condition to `WHERE`, and the scan declined the query with `HAVING clause is not supported`. A `pdb.agg()` query with such a condition failed with the same message (#6636).
```

**File**: `pg_search/src/postgres/customscan/aggregatescan/searchquery.rs` (modified, +4/-2)
```diff
@@ -63,8 +63,10 @@ impl CustomScanClause<AggregateScan> for SearchQueryClause {
         heap_rti: pg_sys::Index,
         index: &PgSearchRelation,
     ) -> Result<Self, CustomScanBuildError> {
-        // We can't handle HAVING yet
-        if args.root().hasHavingQual {
+        // We can't handle HAVING yet. PostgreSQL moves a HAVING condition that
+        // has no aggregate to WHERE and drops a constant true one, but
+        // `hasHavingQual` stays set. `havingQual` holds only what is left.
+        if unsafe { !(*args.root().parse).havingQual.is_null() } {
             return Err("HAVING clause is not supported (see https://github.com/paradedb/paradedb/issues/4206)".into());
         }
 
```

**File**: `pg_search/tests/pg_regress/expected/aggregate_having_moved_to_where.out` (added, +566/-0)
```diff
@@ -0,0 +1,566 @@
+-- PostgreSQL moves a HAVING condition that has no aggregate to WHERE. It does
+-- the same with a condition of an outer query on a grouped subquery. The
+-- Aggregate Scan must take such a query: no HAVING clause is left.
+\i common/common_setup.sql
+CREATE EXTENSION IF NOT EXISTS pg_search;
+-- Disable parallel workers to avoid differences in plans
+SET max_parallel_workers_per_gather = 0;
+SET enable_indexscan to OFF;
+SET paradedb.enable_columnar_exec = true;
+CREATE TABLE having_items (
+    id SERIAL PRIMARY KEY,
+    account_id BIGINT,
+    kind TEXT
+);
+INSERT INTO having_items (account_id, kind)
+SELECT (g % 3) + 1, (ARRAY['a', 'b', 'c', 'd'])[(g % 4) + 1]
+FROM generate_series(1, 120) g;
+CREATE INDEX having_items_idx ON having_items
+USING paradedb (id, account_id, (kind::pdb.literal));
+SET paradedb.enable_aggregate_custom_scan TO on;
+\echo 'Test 1: HAVING on a GROUP BY key'
+Test 1: HAVING on a GROUP BY key
+EXPLAIN (COSTS OFF, VERBOSE, TIMING OFF)
+SELECT account_id, kind, COUNT(*)
+FROM having_items
+WHERE id @@@ paradedb.all()
+GROUP BY account_id, kind
+HAVING account_id > 1
+ORDER BY account_id, kind;
+                                                                                                               QUERY PLAN                                                                                                               
+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
+ Custom Scan (ParadeDB Aggregate Scan) on public.having_items
+   Output: account_id, kind, pdb.agg_fn('COUNT(*)'::text)
+   Index: having_items_idx
+   Tantivy Query: {"boolean":{"must":[{"with_index":{"query":"all"}},{"range":{"field":"account_id","lower_bound":{"excluded":1},"upper_bound":null}}]}}
+     Applies to Aggregates: COUNT(*)
+     Group By: account_id, kind
+     Aggregate Definition: {"grouped":{"aggs":{"grouped":{"terms":{"field":"kind","order":{"_key":"asc"},"segment_size":65000,"size":65000}}},"terms":{"field":"account_id","order":{"_key":"asc"},"segment_size":65000,"size":65000}}}
+(7 rows)
+
+SELECT account_id, kind, COUNT(*)
+FROM having_items
+WHERE id @@@ paradedb.all()
+GROUP BY account_id, kind
+HAVING account_id > 1
+ORDER BY account_id, kind;
+ account_id | kind | count 
+------------+------+-------
+          2 | a    |    10
+          2 | b    |    10
+          2 | c    |    10
+          2 | d    |    10
+          3 | a    |    10
+          3 | b    |    10
+          3 | c    |    10
+          3 | d    |    10
+(8 rows)
+
+\echo 'Test 2: a condition of the outer query on a grouped subquery'
+Test 2: a condition of the outer query on a grouped subquery
+EXPLAIN (COSTS OFF, VERBOSE, TIMING OFF)
+SELECT *
+FROM (
+    SELECT account_id, kind, COUNT(*) AS n
+    FROM having_items
+    WHERE id @@@ paradedb.all()
+    GROUP BY account_id, kind
+) AS grouped
+WHERE account_id > 1
+ORDER BY account_id, kind;
+                                                                                        QUERY PLAN                                                                                        
+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
+ Custom Scan (ParadeDB Aggregate Scan) on public.having_items
+   Output: having_items.account_id, having_items.kind, pdb.agg_fn('COUNT(*)'::text)
+   Index: having_items_idx
+   Tantivy Query: {"boolean":{"must":[{"with_index":{"query":"all"}},{"range":{"field":"account_id","lower_bound":{"excluded":1},"upper_bound":null}}]}}
+     Applies to Aggregates: COUNT(*)
+     Group By: account_id, kind
+     Aggregate Definition: {"grouped":{"aggs":{"grouped":{"terms":{"field":"kind","segment_size":65000,"size":65000}}},"terms":{"field":"account_id","segment_size":65000,"size":65000}}}
+(7 rows)
+
+SELECT *
+FROM (
+    SELECT account_id, kind, COUNT(*) AS n
+    FROM having_items
+    WHERE id @@@ paradedb.all()
+    GROUP BY account_id, kind
+) AS grouped
+WHERE account_id > 1
+ORDER BY account_id, kind;
+ account_id | kind | n  
+------------+------+----
+          2 | a    | 10
+          2 | b    | 10
+          2 | c    | 10
+          2 | d    | 10
+          3 | a    | 10
+          3 | b    | 10
+          3 | c    | 10
+          3 | d    | 10
+(8 rows)
+
+\echo 'Test 3: the same through a CTE'
+Test 3: the same through a CTE
+EXPLAIN (COSTS OFF, VERBOSE, TIMING OFF)
+WITH grouped AS (
+    SELECT account_id, kind, COUNT(*) AS n
+    FROM having_items
+    WHERE id @@@ paradedb.all()
+    GROUP BY account_id, kind
+)
+SELECT * FROM grouped WHERE kind >= 'c' ORDER BY account_id, kind;
+                                                                                        QUERY PLAN                         
```

**File**: `pg_search/tests/pg_regress/sql/aggregate_having_moved_to_where.sql` (added, +265/-0)
```diff
@@ -0,0 +1,265 @@
+-- PostgreSQL moves a HAVING condition that has no aggregate to WHERE. It does
+-- the same with a condition of an outer query on a grouped subquery. The
+-- Aggregate Scan must take such a query: no HAVING clause is left.
+
+\i common/common_setup.sql
+
+CREATE TABLE having_items (
+    id SERIAL PRIMARY KEY,
+    account_id BIGINT,
+    kind TEXT
+);
+
+INSERT INTO having_items (account_id, kind)
+SELECT (g % 3) + 1, (ARRAY['a', 'b', 'c', 'd'])[(g % 4) + 1]
+FROM generate_series(1, 120) g;
+
+CREATE INDEX having_items_idx ON having_items
+USING paradedb (id, account_id, (kind::pdb.literal));
+
+SET paradedb.enable_aggregate_custom_scan TO on;
+
+\echo 'Test 1: HAVING on a GROUP BY key'
+EXPLAIN (COSTS OFF, VERBOSE, TIMING OFF)
+SELECT account_id, kind, COUNT(*)
+FROM having_items
+WHERE id @@@ paradedb.all()
+GROUP BY account_id, kind
+HAVING account_id > 1
+ORDER BY account_id, kind;
+
+SELECT account_id, kind, COUNT(*)
+FROM having_items
+WHERE id @@@ paradedb.all()
+GROUP BY account_id, kind
+HAVING account_id > 1
+ORDER BY account_id, kind;
+
+\echo 'Test 2: a condition of the outer query on a grouped subquery'
+EXPLAIN (COSTS OFF, VERBOSE, TIMING OFF)
+SELECT *
+FROM (
+    SELECT account_id, kind, COUNT(*) AS n
+    FROM having_items
+    WHERE id @@@ paradedb.all()
+    GROUP BY account_id, kind
+) AS grouped
+WHERE account_id > 1
+ORDER BY account_id, kind;
+
+SELECT *
+FROM (
+    SELECT account_id, kind, COUNT(*) AS n
+    FROM having_items
+    WHERE id @@@ paradedb.all()
+    GROUP BY account_id, kind
+) AS grouped
+WHERE account_id > 1
+ORDER BY account_id, kind;
+
+\echo 'Test 3: the same through a CTE'
+EXPLAIN (COSTS OFF, VERBOSE, TIMING OFF)
+WITH grouped AS (
+    SELECT account_id, kind, COUNT(*) AS n
+    FROM having_items
+    WHERE id @@@ paradedb.all()
+    GROUP BY account_id, kind
+)
+SELECT * FROM grouped WHERE kind >= 'c' ORDER BY account_id, kind;
+
+WITH grouped AS (
+    SELECT account_id, kind, COUNT(*) AS n
+    FROM having_items
+    WHERE id @@@ paradedb.all()
+    GROUP BY account_id, kind
+)
+SELECT * FROM grouped WHERE kind >= 'c' ORDER BY account_id, kind;
+
+\echo 'Test 4: a HAVING condition on an aggregate stays in HAVING -> declined'
+EXPLAIN (COSTS OFF, TIMING OFF)
+SELECT account_id, COUNT(*)
+FROM having_items
+WHERE id @@@ paradedb.all()
+GROUP BY account_id
+HAVING COUNT(*) > 10
+ORDER BY account_id;
+
+SELECT account_id, COUNT(*)
+FROM having_items
+WHERE id @@@ paradedb.all()
+GROUP BY account_id
+HAVING COUNT(*) > 10
+ORDER BY account_id;
+
+\echo 'Test 5: a condition of the outer query on the aggregate stays in HAVING -> declined'
+EXPLAIN (COSTS OFF, TIMING OFF)
+SELECT *
+FROM (
+    SELECT account_id, COUNT(*) AS n
+    FROM having_items
+    WHERE id @@@ paradedb.all()
+    GROUP BY account_id
+) AS grouped
+WHERE n > 10
+ORDER BY account_id;
+
+SELECT *
+FROM (
+    SELECT account_id, COUNT(*) AS n
+    FROM having_items
+    WHERE id @@@ paradedb.all()
+    GROUP BY account_id
+) AS grouped
+WHERE n > 10
+ORDER BY account_id;
+
+\echo 'Test 6: a constant true HAVING on an aggregate without GROUP BY'
+EXPLAIN (COSTS OFF, TIMING OFF)
+SELECT COUNT(*) FROM having_items WHERE id @@@ paradedb.all() HAVING 1 = 1;
+
+SELECT COUNT(*) FROM having_items WHERE id @@@ paradedb.all() HAVING 1 = 1;
+
+\echo 'Test 7: a constant false HAVING on an aggregate without GROUP BY stays in HAVING -> declined'
+EXPLAIN (COSTS OFF, TIMING OFF)
+SELECT COUNT(*) FROM having_items WHERE id @@@ paradedb.all() HAVING 1 = 2;
+
+SELECT COUNT(*) FROM having_items WHERE id @@@ paradedb.all() HAVING 1 = 2;
+
+\echo 'Test 8: a constant false HAVING with GROUP BY moves to WHERE'
+EXPLAIN (COSTS OFF, TIMING OFF)
+SELECT account_id, COUNT(*)
+FROM having_items
+WHERE id @@@ paradedb.all()
+GROUP BY account_id
+HAVING 1 = 2;
+
+SELECT account_id, COUNT(*)
+FROM having_items
+WHERE id @@@ paradedb.all()
+GROUP BY account_id
+HAVING 1 = 2;
+
+\echo 'Test 9: a volatile HAVING condition stays in HAVING -> declined'
+EXPLAIN (COSTS OFF, TIMING OFF)
+SELECT account_id, COUNT(*)
+FROM having_items
+WHERE id @@@ paradedb.all()
+GROUP BY account_id
+HAVING account_id > random() * 0
+ORDER BY account_id;
+
+SELECT account_id, COUNT(*)
+FROM having_items
+WHERE id @@@ paradedb.all()
+GROUP BY account_id
+HAVING account_id > random() * 0
+ORDER BY account_id;
+
+\echo 'Test 10: a moved condition that the index cannot answer is checked on the heap'
+EXPLAIN (COSTS OFF, TIMING OFF)
+SELECT account_id, kind, COUNT(*)
+FROM having_items
+WHERE id @@@ paradedb.all()
+GROUP BY account_id, kind
+HAVING length(kind) = 1 AND kind <> 'b'
+ORDER BY account_id, kind;
+
+SELECT account_id, kind, COUNT(*)
+FROM having_items
+WHERE id @@@ paradedb.all()
+GROUP BY account_id, kind
+HAVING length(kind) = 1 AND kind <> 'b'
+ORDER BY account_id, kind;
+
+\echo 'Test 11: a moved condition with a parameter in a generic plan'
+PREPARE having_param(BIGINT) AS
+SELECT account_id, kind, COUNT(*)
+FROM havin
```

---

### Incident Patch 7: `5d25d38f` (2026-10-03)
**Commit Message**: fix: use AggregateScan when PostgreSQL drops a `GROUP BY` key (#6608)

## Ticket(s) Closed

- Closes #6606
- Closes #6632
- Closes #6633

## What

This PR makes AggregateScan read the columns that PostgreSQL does not
group on from one row of the group, as PostgreSQL's Agg node does.

```sql
SELECT account_id, kind, COUNT(*) FROM items
WHERE account_id = 1 AND id @@@ paradedb.all()
GROUP BY account_id, kind;

SELECT id, rating, COUNT(*) FROM mock_items     -- id is the primary key
WHERE id @@@ paradedb.all()
GROUP BY id;
```

Both fell back to a Postgres aggregate with `Field 'account_id' is not a
grouping column` or `could not verify GROUP BY semantics`, and
`pdb.agg()` failed.

## Why

PostgreSQL leaves a key out of its grouping when the `WHERE` clause sets
it to a constant (`pathkey_is_redundant()`) or when the primary key
decides it (`remove_useless_groupby_columns()`). The query can also
return a column that the primary key decides, and the planner takes
columns out of expressions that a node above computes. The Agg node
reads all of these from one row of the group. The Tantivy backend
declined such a query. The DataFusion backend grouped on the column,
which splits a group whe

**File**: `docs/project/changelog/unreleased/6608.stability.mdx` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+header: stability
+---
+
+Aggregate Scan now runs a `GROUP BY` query that filters a grouping key to one value, or that selects a column the primary key decides. These queries fell back to Postgres, and `pdb.agg()` failed (#6606). This also fixes wrong rows for `GROUP BY date(ts)` under a window function (#6633), and an error on a `GROUP BY` key that is a cast (#6632).
```

**File**: `pg_search/src/postgres/customscan/aggregatescan/datafusion_build.rs` (modified, +2/-2)
```diff
@@ -1526,8 +1526,8 @@ impl FilterExpr {
                         .targetlist()
                         .group_columns
                         .iter()
-                        .find(|gc| gc.plan_position == pp && gc.attno == attno)
-                        .map(|gc| Self::GroupRef(gc.field_name.clone())),
+                        .position(|gc| gc.plan_position == pp && gc.attno == attno)
+                        .map(Self::GroupRef),
                 }
             }
             pg_sys::NodeTag::T_Const => {
```

**File**: `pg_search/src/postgres/customscan/aggregatescan/datafusion_exec.rs` (modified, +60/-11)
```diff
@@ -34,7 +34,9 @@ use crate::index::reader::index::SearchIndexManifest;
 use crate::postgres::customscan::aggregatescan::join_targetlist::{
     AggKind, JoinAggregateEntry, JoinAggregateTargetList,
 };
-use crate::postgres::customscan::aggregatescan::privdat::{CompareOp, DataFusionTopK, FilterExpr};
+use crate::postgres::customscan::aggregatescan::privdat::{
+    CompareOp, DataFusionTopK, FilterExpr, TopKSortTarget,
+};
 use crate::postgres::customscan::datafusion::cardinality_agg::tantivy_cardinality_udaf;
 use crate::postgres::customscan::datafusion::numeric_agg::{
     numeric_bytes_avg_udaf, numeric_bytes_sum_udaf, numeric64_avg_udaf, numeric64_sum_udaf,
@@ -54,13 +56,13 @@ use crate::postgres::customscan::joinscan::{CtidColumn, ScoreColumn};
 use crate::scan::PgSearchTableProvider;
 use crate::schema::SearchFieldType;
 use arrow_schema::DataType;
-use datafusion::common::{DataFusionError, NullHandling, Result, ScalarValue};
+use datafusion::common::{Column, DataFusionError, NullHandling, Result, ScalarValue};
 use datafusion::functions::core::expr_fn::coalesce;
 use datafusion::functions_aggregate::array_agg::array_agg_udaf;
 use datafusion::functions_aggregate::count::count_udaf;
 use datafusion::functions_aggregate::expr_fn::{
-    array_agg, avg, bool_and, bool_or, count, max, min, stddev, stddev_pop, sum, var_pop,
-    var_sample,
+    array_agg, avg, bool_and, bool_or, count, first_value, max, min, stddev, stddev_pop, sum,
+    var_pop, var_sample,
 };
 use datafusion::functions_aggregate::string_agg::string_agg_udaf;
 use datafusion::logical_expr::expr::{AggregateFunction, Sort};
@@ -83,6 +85,8 @@ pub struct JoinAggregatePlan {
     pub logical: datafusion::logical_expr::LogicalPlan,
     /// Per `targetlist.group_columns` entry, its DataFusion output column.
     pub group_df_indices: Vec<usize>,
+    /// The number of DataFusion grouping columns. The aggregates follow them.
+    pub num_group_exprs: usize,
     /// Set when the query carries `pdb.agg()` calls.
     pub pdb_plan: Option<PdbAggPlan>,
     /// `HAVING` of a scalar `pdb.agg()` query, applied to the assembled root row
@@ -119,15 +123,39 @@ pub async fn build_join_aggregate_plan(
     )
     .await?;
 
+    // A row value column reads the row with the lowest ctids in its group. One
+    // order for all of them makes them read the same row, which matters when an
+    // expression above uses more than one. With an order, `first_value` also has
+    // a groups accumulator, which keeps its state small enough to spill.
+    let row_order: Vec<Sort> = df
+        .schema()
+        .fields()
+        .iter()
+        .filter(|field| CtidColumn::try_from(field.name().as_str()).is_ok())
+        .map(|field| col(field.name()).sort(true, false))
+        .collect();
+
     // Step 2: Build GROUP BY expressions
     // DataFusion deduplicates grouping expressions that resolve to the same
     // column name (e.g. metadata.brand). We must track which DataFusion output
     // column index corresponds to each of our original targetlist.group_columns.
     let mut group_exprs = Vec::new();
     let mut field_to_df_idx = crate::api::HashMap::default();
     let mut group_df_indices = Vec::with_capacity(targetlist.group_columns.len());
-
-    for gc in &targetlist.group_columns {
+    // A row value column is an aggregate, so its index is known after them.
+    let mut row_values = Vec::new();
+
+    for (gc_idx, gc) in targetlist.group_columns.iter().enumerate() {
+        if gc.row_value {
+            // PostgreSQL's Agg node reads such a column from one row of the group.
+            let column = make_plan_position_col(plan, gc.plan_position, &gc.field_name);
+            row_values.push((
+                gc_idx,
+                first_value(column, row_order.clone()).alias(targetlist.row_value_name(gc_idx)),
+            ));
+            group_df_indices.push(usize::MAX);
+            continue;
+        }
         // Dedup key by (plan_position, field_name, transform): plan_position is the
         // unique source identity; field_name distinguishes columns within
         // a source, transform distinguishes different transformations of the same column.
@@ -156,6 +184,12 @@ pub async fn build_join_aggregate_plan(
         group_df_indices.push(df_idx);
     }
 
+    // With no key to group on, a GROUP BY query has one group when a row
+    // matches and none when no row does. A constant key gives that.
+    if targetlist.has_group_by && group_exprs.is_empty() {
+        group_exprs.push(lit(true).alias(targetlist.one_group_key()));
+    }
+
     // Step 3: Build aggregate expressions. `pdb.agg()` entries contribute no
     // expression of their own; their lowered plan is folded in below.
     let mut pdb_entries: Vec<(usize, &PdbAggRequest, bool)> = Vec::new();
@@ -268,16 +302,22 @@ pub async fn build_join_aggregate_plan(
                 None => agg_expr,
             };
             // Alias for stable reference
-            Ok(Some
```

**File**: `pg_search/src/postgres/customscan/aggregatescan/datafusion_project.rs` (modified, +4/-6)
```diff
@@ -50,6 +50,7 @@ pub unsafe fn project_aggregate_row_to_slot(
     row_idx: usize,
     targetlist: &JoinAggregateTargetList,
     group_df_indices: &[usize],
+    num_group_exprs: usize,
     pdb_agg_json: Vec<serde_json::Value>,
 ) {
     let tupdesc = (*slot).tts_tupleDescriptor;
@@ -103,12 +104,9 @@ pub unsafe fn project_aggregate_row_to_slot(
         }
     }
 
-    // Fill aggregate columns
-    // Aggregate columns always follow ALL deduplicated GROUP BY columns in the
-    // RecordBatch. The number of deduplicated group columns is the number of
-    // unique indices in group_df_indices.
-    let num_unique_group_cols = group_df_indices.iter().max().map(|&m| m + 1).unwrap_or(0);
-    let mut df_col_idx = num_unique_group_cols;
+    // Aggregate columns follow the deduplicated GROUP BY columns in the
+    // RecordBatch.
+    let mut df_col_idx = num_group_exprs;
     let mut pdb_agg_json = pdb_agg_json.into_iter();
 
     for (offset, agg) in targetlist.aggregates.iter().enumerate() {
```

**File**: `pg_search/src/postgres/customscan/aggregatescan/groupby.rs` (modified, +84/-3)
```diff
@@ -18,14 +18,14 @@
 use crate::postgres::PgSearchRelation;
 use crate::postgres::customscan::CustomScan;
 use crate::postgres::customscan::aggregatescan::{
-    AggregateScan, CustomScanBuildError, CustomScanClause,
+    AggregateScan, CustomScanBuildError, CustomScanClause, GroupingPushdownDeclineReason,
 };
 use crate::postgres::customscan::basescan::exec_methods::fast_fields::find_matching_fast_field;
 use crate::postgres::customscan::builders::custom_path::CustomPathBuilder;
-use crate::postgres::utils::strip_unnest_and_relabel;
+use crate::postgres::utils::{strip_relabel, strip_unnest_and_relabel};
 use crate::postgres::var::{VarContext, find_one_var_and_fieldname, find_var_relation};
-use pgrx::PgList;
 use pgrx::pg_sys;
+use pgrx::{PgList, pg_guard};
 
 #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
 pub struct GroupingColumn {
@@ -194,6 +194,87 @@ impl CustomScanClause<AggregateScan> for GroupByClause {
             }
         }
 
+        // PostgreSQL groups on no key when the WHERE clause pins every key to a
+        // constant. The query then has one group or none, which this backend
+        // cannot tell apart.
+        let parse = args.root().parse;
+        if grouping_columns.is_empty() && unsafe { !(*parse).groupClause.is_null() } {
+            return Err(GroupingPushdownDeclineReason::MissingPathKeys
+                .detail()
+                .into());
+        }
+
         Ok(Self { grouping_columns })
     }
 }
+
+/// Returns true if the grouped output has a column that PostgreSQL does not
+/// group on.
+///
+/// PostgreSQL does not group on a key that the WHERE clause pins to a constant
+/// (`pathkey_is_redundant`), or on a key that the primary key or a unique
+/// `NOT NULL` index decides (`remove_useless_groupby_columns`). The query can
+/// also return a column that the primary key decides, and the planner takes
+/// columns out of expressions that a node above computes. The Agg node reads
+/// all of these from one row of the group. The Tantivy backend has no row to
+/// read, so such a query goes to the DataFusion backend.
+pub(super) unsafe fn has_ungrouped_column(args: &<AggregateScan as CustomScan>::Args) -> bool {
+    let parse = (*args.root).parse;
+    if parse.is_null() || (*parse).groupClause.is_null() {
+        return false;
+    }
+    let keys: Vec<*mut pg_sys::Node> = args
+        .group_by_pathkeys()
+        .into_iter()
+        .filter(|pathkey| !(**pathkey).pk_eclass.is_null())
+        .flat_map(|pathkey| {
+            PgList::<pg_sys::EquivalenceMember>::from_pg((*(*pathkey).pk_eclass).ec_members)
+                .iter_ptr()
+                .map(|member| strip_relabel((*member).em_expr.cast()))
+                .collect::<Vec<_>>()
+        })
+        .collect();
+    if keys.is_empty() {
+        return true;
+    }
+
+    let reltarget = args.output_rel().reltarget;
+    if reltarget.is_null() {
+        return false;
+    }
+    PgList::<pg_sys::Node>::from_pg((*reltarget).exprs)
+        .iter_ptr()
+        .any(|expr| has_ungrouped_var(expr, &keys))
+}
+
+/// Returns true if `expr` reads a column outside of the GROUP BY keys and the
+/// aggregates. A key can be a whole expression, so the walk stops at one.
+unsafe fn has_ungrouped_var(expr: *mut pg_sys::Node, keys: &[*mut pg_sys::Node]) -> bool {
+    #[pg_guard]
+    unsafe extern "C-unwind" fn walker(
+        node: *mut pg_sys::Node,
+        context: *mut core::ffi::c_void,
+    ) -> bool {
+        if node.is_null() {
+            return false;
+        }
+        let keys = &*(context as *const &[*mut pg_sys::Node]);
+        let stripped = strip_relabel(node);
+        if keys
+            .iter()
+            .any(|key| pg_sys::equal((*key).cast(), stripped.cast()))
+        {
+            return false;
+        }
+        match (*node).type_ {
+            pg_sys::NodeTag::T_Aggref => false,
+            pg_sys::NodeTag::T_Var => true,
+            _ => pg_sys::expression_tree_walker(node, Some(walker), context),
+        }
+    }
+
+    walker(
+        expr,
+        (&keys as *const &[*mut pg_sys::Node]) as *mut core::ffi::c_void,
+    )
+}
```

**File**: `pg_search/src/postgres/customscan/aggregatescan/join_targetlist.rs` (modified, +155/-12)
```diff
@@ -29,10 +29,12 @@ use super::datafusion_build::{
 use super::pdb_agg::{PdbAggFieldRef, PdbAggRequest};
 use super::privdat::FilterExpr;
 use crate::api::{SortDirection, pdb_agg_spec};
+use crate::nodecast;
 use crate::postgres::customscan::CreateUpperPathsHookArgs;
 use crate::postgres::customscan::datafusion::explain::get_attname_safe;
 use crate::postgres::customscan::joinscan::build::RelationAlias;
 use crate::postgres::node::NodeExt;
+use crate::postgres::utils::strip_relabel;
 use crate::postgres::var::{VarContext, find_one_var_and_fieldname};
 use crate::schema::SearchFieldType;
 use pgrx::PgList;
@@ -144,6 +146,11 @@ pub struct JoinGroupColumn {
     /// Transformation applied to the fast-field value before grouping.
     #[serde(default)]
     pub transform: GroupingTransform,
+
+    /// A column that PostgreSQL does not group on. Its value comes from one row
+    /// of the group, as in PostgreSQL's Agg node.
+    #[serde(default)]
+    pub row_value: bool,
 }
 
 /// The NUMERIC field type an aggregate has to handle, or `None` when the
@@ -250,6 +257,10 @@ pub struct JoinAggregateEntry {
 pub struct JoinAggregateTargetList {
     pub group_columns: Vec<JoinGroupColumn>,
     pub aggregates: Vec<JoinAggregateEntry>,
+    /// The query has a GROUP BY clause. With no key to group on, it still has
+    /// no row when no row matches, unlike an aggregate with no GROUP BY.
+    #[serde(default)]
+    pub has_group_by: bool,
 }
 
 /// Planner-only aggregate extraction result.
@@ -314,6 +325,49 @@ unsafe fn push_unique<T>(nodes: &mut Vec<*mut T>, node: *mut T) {
 }
 
 impl JoinAggregateTargetList {
+    /// The columns that DataFusion groups on.
+    pub fn grouping_keys(&self) -> impl Iterator<Item = &JoinGroupColumn> {
+        self.group_columns.iter().filter(|gc| !gc.row_value)
+    }
+
+    /// The DataFusion name of the aggregate at `idx` in `aggregates`.
+    pub fn aggregate_name(&self, idx: usize) -> String {
+        format!("{}agg_{idx}", self.internal_prefix())
+    }
+
+    /// The DataFusion name of the row value column at `gc_idx` in `group_columns`.
+    pub fn row_value_name(&self, gc_idx: usize) -> String {
+        format!("{}row_{gc_idx}", self.internal_prefix())
+    }
+
+    /// The DataFusion name of the constant key of a GROUP BY with no key left.
+    pub fn one_group_key(&self) -> String {
+        format!("{}__one_group", self.internal_prefix())
+    }
+
+    /// DataFusion rejects a schema with a qualified and an unqualified column of
+    /// the same name, and its optimizer drops the qualifier of an aggregate
+    /// alias. So the names above stay unqualified, and get a longer prefix while
+    /// a GROUP BY column has one of them.
+    fn internal_prefix(&self) -> String {
+        let is_internal = |name: &str| {
+            name == "__one_group"
+                || ["agg_", "row_"].iter().any(|kind| {
+                    name.strip_prefix(kind)
+                        .is_some_and(|n| !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()))
+                })
+        };
+        let mut prefix = String::new();
+        while self.group_columns.iter().any(|gc| {
+            gc.field_name
+                .strip_prefix(prefix.as_str())
+                .is_some_and(is_internal)
+        }) {
+            prefix.push('_');
+        }
+        prefix
+    }
+
     /// The lowered `pdb.agg()` calls, in target-list order.
     pub fn pdb_agg_requests(&self) -> impl Iterator<Item = &PdbAggRequest> {
         self.aggregates
@@ -429,8 +483,8 @@ fn extract_timestamp_to_date_var(
 ///
 /// GROUP BY expressions and aggregate arguments are boundaries: setrefs first
 /// matches the former as whole expressions, while the latter are evaluated by
-/// DataFusion. Every other Var is one PostgreSQL admitted through functional
-/// dependency and must be carried in the raw tuple as a group column.
+/// DataFusion. Every other Var is a column that PostgreSQL does not group on,
+/// and it must be carried in the raw tuple.
 unsafe fn collect_output_nodes(
     expr: *mut pg_sys::Node,
     group_exprs: &mut Vec<*mut pg_sys::Node>,
@@ -531,16 +585,22 @@ pub unsafe fn extract_aggregate_targetlist(
             }
         }
     } else {
-        // Every GROUP BY item is also a target-list entry, resjunk when it is
-        // not selected, so a column PG16+ drops from `processed_groupClause`
-        // as functionally dependent comes straight back through the output
-        // walk below. Reading `parse->groupClause` keeps its written position.
+        // Group on the keys that PostgreSQL's Agg node groups on. It leaves out
+        // a key that the WHERE clause pins to a constant, and a key that a
+        // unique key decides. Every GROUP BY item is also a target-list entry,
+        // resjunk when it is not selected, so such a key comes back through the
+        // output walk below and is read from one row of the group.
         let written = PgList::<pg_sys::SortGroupClause>
```

**File**: `pg_search/src/postgres/customscan/aggregatescan/mod.rs` (modified, +55/-49)
```diff
@@ -193,37 +193,25 @@ unsafe fn validate_grouping_pushdown(
         }
     }
 
-    if num_group_by_keys == 0 {
-        // A scalar aggregate has no grouping keys.
-        if parse.is_null() || (*parse).groupClause.is_null() {
-            return Ok(());
-        }
-
-        // For multi-table join aggregates (which execute on DataFusion), grouping columns
-        // are extracted directly from the target list expressions rather than group_pathkeys.
-        // When all grouping keys are constant (e.g. `WHERE orders.color = 'blue' GROUP BY orders.color`),
-        // PostgreSQL's optimizer omits them from group_pathkeys via `EC_has_const`.
-        // We verify collation safety directly from `parse.groupClause`.
-        if args.input_rel().reloptkind == pg_sys::RelOptKind::RELOPT_JOINREL {
-            let group_clauses = PgList::<pg_sys::SortGroupClause>::from_pg((*parse).groupClause);
-            for gc in group_clauses.iter_ptr() {
-                let expr = pg_sys::get_sortgroupclause_expr(gc, (*parse).targetList);
-                if expr.is_null() {
-                    return Err(GroupingPushdownDeclineReason::MissingPathKeys);
-                }
-                let collation = pg_sys::exprCollation(expr);
-                if assess_collation(collation, CollationOperation::Equality)
-                    == CollationSafety::NondeterministicEquality
-                {
-                    return Err(GroupingPushdownDeclineReason::NondeterministicCollation);
-                }
+    // PostgreSQL leaves a key out of `group_pathkeys` when the WHERE clause pins
+    // it to a constant (`WHERE orders.color = 'blue' GROUP BY orders.color`) or
+    // a unique key decides it, so the loop above does not see it. The
+    // DataFusion backend can still group on such a key: PG15 groups on a pinned
+    // key, and a key that the primary key decides costs less to group on.
+    if !parse.is_null() {
+        let group_clauses = PgList::<pg_sys::SortGroupClause>::from_pg((*parse).groupClause);
+        for gc in group_clauses.iter_ptr() {
+            let expr = pg_sys::get_sortgroupclause_expr(gc, (*parse).targetList);
+            if expr.is_null() {
+                return Err(GroupingPushdownDeclineReason::MissingPathKeys);
+            }
+            let collation = pg_sys::exprCollation(expr);
+            if assess_collation(collation, CollationOperation::Equality)
+                == CollationSafety::NondeterministicEquality
+            {
+                return Err(GroupingPushdownDeclineReason::NondeterministicCollation);
             }
-            return Ok(());
         }
-
-        // For single-table aggregates on Tantivy, missing pathkeys prevent Tantivy
-        // from discovering grouping columns (see `groupby.rs`).
-        return Err(GroupingPushdownDeclineReason::MissingPathKeys);
     }
 
     Ok(())
@@ -556,6 +544,7 @@ impl CustomScan for AggregateScan {
                             // This only selects the backend to consider: the extractor still
                             // rejects DATE(timestamptz) and non-bare timestamp expressions.
                             || (!has_paradedb_agg && builder.args().has_date_group())
+                            || groupby::has_ungrouped_column(builder.args())
                     };
                 let use_datafusion = use_datafusion && (!has_paradedb_agg || pdb_route.is_some());
                 if use_datafusion {
@@ -727,6 +716,7 @@ impl CustomScan for AggregateScan {
                     current_batch: None,
                     batch_row_idx: 0,
                     group_df_indices: Vec::new(),
+                    num_group_exprs: 0,
                     pdb_plan: None,
                     pdb_root_having: None,
                     pdb_agg_json: None,
@@ -779,14 +769,13 @@ impl CustomScan for AggregateScan {
                 }
 
                 // Show GROUP BY columns
-                if !df_state.targetlist.group_columns.is_empty() {
+                if df_state.targetlist.grouping_keys().next().is_some() {
                     // TODO: When grouping on expressions with the same underlying input columns,
                     // it's possible to get dupes here. We should consider rendering the expression
                     // instead, but for now we dedupe.
                     let mut groups: Vec<String> = df_state
                         .targetlist
-                        .group_columns
-                        .iter()
+                        .grouping_keys()
                         .map(|gc| match gc.transform {
                             GroupingTransform::Identity => gc.field_name.clone(),
                             GroupingTransform::TimestampToDate => {
@@ -1264,6 +1253,7 @@ impl AggregateScan {
             )
             .await?;
             df_state.group_df_indices = built.group_df_indices;
+            df_state.num_group_exprs = built.num_group_exprs;
             df_state.pdb_plan = built.pdb_plan;
  
```

**File**: `pg_search/src/postgres/customscan/aggregatescan/privdat.rs` (modified, +12/-6)
```diff
@@ -37,8 +37,9 @@ use pgrx::prelude::*;
 pub enum FilterExpr {
     /// Reference to an aggregate result by index (HAVING context).
     AggRef(usize),
-    /// Reference to a GROUP BY column by field name (HAVING context).
-    GroupRef(String),
+    /// Reference to a GROUP BY column by its index in
+    /// `JoinAggregateTargetList.group_columns` (HAVING context).
+    GroupRef(usize),
     /// Reference to a pre-aggregate table column (FILTER context).
     /// Execution identity is `plan_position`, resolved against the
     /// `RelNode` tree at construction; rti/attno are kept for diagnostics
@@ -113,18 +114,23 @@ pub enum TopKSortTarget {
 impl TopKSortTarget {
     /// Resolve the DataFusion column reference for the sort target.
     ///
-    /// Aggregate targets use the `agg_{idx}` alias assigned during aggregate
-    /// expression building. Group targets use either the qualified source column
-    /// or the unqualified UDF output name, without parsing SQL identifiers.
+    /// Aggregate and row value targets use the names the plan gives them. Group
+    /// targets use either the qualified source column or the unqualified UDF
+    /// output name, without parsing SQL identifiers.
     pub fn resolve_sort_column(
         &self,
         targetlist: &JoinAggregateTargetList,
         plan: &RelNode,
     ) -> Column {
         match self {
-            TopKSortTarget::Aggregate(idx) => Column::new_unqualified(format!("agg_{idx}")),
+            TopKSortTarget::Aggregate(idx) => {
+                Column::new_unqualified(targetlist.aggregate_name(*idx))
+            }
             TopKSortTarget::GroupColumn(idx) => {
                 let gc = &targetlist.group_columns[*idx];
+                if gc.row_value {
+                    return Column::new_unqualified(targetlist.row_value_name(*idx));
+                }
                 let source = plan.source_at_plan_position(gc.plan_position);
                 let alias = if let Some(src) = source {
                     RelationAlias::new(src.scan_info.alias.as_deref()).execution(src.plan_position)
```

---

### Incident Patch 8: `584e4ae8` (2026-10-03)
**Commit Message**: Fix formatting and mention key_field deprecation.

**File**: `docs/project/changelog/0.26.0.mdx` (modified, +5/-4)
```diff
@@ -17,8 +17,7 @@ See GitHub release: [v0.26.0](https://github.com/paradedb/paradedb/releases/tag/
 Vector fields in a ParadeDB index are now quantized by default. Vectors are compressed into compact codes, which queries scan to shortlist candidates before reranking them against the full-precision vectors:
 
 ```sql
-CREATE INDEX ON items USING paradedb (id, embedding)
-WITH (key_field = 'id');
+CREATE INDEX ON items USING paradedb (id, embedding);
 ```
 
 Quantization is enabled by default for vector fields with at least 64 dimensions. Set `"quantization": false` in a field's `vector_fields` configuration to disable it. Quantization settings in `vector_fields` take effect only during `CREATE INDEX` and
@@ -95,11 +94,13 @@ See the [Partitioning Guide](/reference/indexing/partition-by) for data type con
 - Added TopK pushdown for queries that group and order by `DATE(timestamp)`, allowing DataFusion to apply the sort and limit during aggregation.
 
 - Added a `chinese_convert` option to the `chinese_compatible` tokenizer, matching the option
-already supported by `pdb.jieba`. Set `chinese_convert=t2s` (or `s2t`, `tw2s`, `tw2sp`, `s2tw`,
-`s2twp`) to convert between Traditional and Simplified Chinese before tokenization.
+  already supported by `pdb.jieba`. Set `chinese_convert=t2s` (or `s2t`, `tw2s`, `tw2sp`, `s2tw`,
+  `s2twp`) to convert between Traditional and Simplified Chinese before tokenization.
 
 - Shipped an experimental stacked IVF router with adaptive partition scanning for vector search.
 
+- Deprecated the `key_field` setting at `CREATE INDEX` time.
+
 - Enabled Block-Max WAND (BMW) and MAXSCORE dynamic pruning on queries combined with non-scoring filters, accelerating filtered full-text searches.
 
 ## Performance Improvements 🚀
```

---

### Incident Patch 9: `8f66bb1c` (2026-10-02)
**Commit Message**: ci: require impl_safe_drop! or a stated reason on every impl Drop (#6572)

# Ticket(s) Closed

- Closes #6530

## What

`lint-rust` and pre-commit now fail on any `impl Drop` in
`pg_search/src` unless the comment directly above it names
`impl_safe_drop!` and says why the macro does not apply. Every site on
main is classified.

## Why

A bare `Drop` that calls into Postgres can raise a second error while an
ERROR unwinds or the backend exits, and it is easy to miss in review.

## How

`.github/scripts/check_impl_drop.py`, same shape as
`check_migration_diff.py`, matches a header from `impl` to its brace
(nested generics, a qualified `Drop` and wrapped headers included); the
override is the comment the four annotated sites already carry. Of the
other 20 sites, 14 stay bare with a reason (Rust only bodies and one
commit assertion, the release callback guards and interrupt hold that
must run while unwinding, the BufFile closers `may_close` already gates)
and 6 move to the macro: `SysCacheEntry`, `TempPgList` and
`BitmapCursor` released bare, `PgExprState` and `FrameGuard` had a hand
rolled `panicking()` check, and `BufferIter`'s drop drains its iterator,
which extends the relation and 

**File**: `.github/scripts/check_impl_drop.py` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+#!/usr/bin/env python3
+"""
+Fail on any `impl Drop` in pg_search that does not say why it skips `impl_safe_drop!`.
+
+A `Drop` that calls into Postgres has to skip its body while a panic unwinds or the backend
+exits (#6479), which is what `impl_safe_drop!` in pg_search/src/postgres/utils.rs does. A bare
+`impl Drop` needs a comment directly above it that opts out in so many words: "We
+intentionally do NOT use `impl_safe_drop!` here because ...". pg_search is the only crate
+that links pgrx, so it is the only one scanned.
+"""
+
+import re
+import sys
+from pathlib import Path
+
+REPO = Path(__file__).resolve().parents[2]
+# The comment block and attributes directly above an impl, then its header up to the brace,
+# across lines when rustfmt wraps it.
+BARE_DROP = re.compile(
+    r"((?:^[ \t]*//.*\n)*)(?:^[ \t]*#\[.*\n)*^[ \t]*(impl\b[^{;]*?\bDrop\s+for\s+([^{;]+))",
+    re.MULTILINE,
+)
+# A comment that only names the macro, like a TODO, is not an opt out.
+OVERRIDE = re.compile(r"\bnot\s+us(?:e|ing)\W+impl_safe_drop\b", re.IGNORECASE)
+
+# Shapes the matcher must get right, with the findings each should produce.
+SELF_TEST = [
+    ("impl<T: From<A> + Into<A>> Drop for Nested<'_, T> {", 1),
+    ("impl<\n    T: Clone,\n> Drop for Wrapped<T>\n{", 1),
+    ("impl std::ops::Drop for Qualified {", 1),
+    ("impl DropGuard for NotDrop {", 0),
+    ("impl Drop for $ty {", 0),
+    ("// TODO: switch this to `impl_safe_drop!`.\nimpl Drop for Todo {", 1),
+    (
+        "// We intentionally do NOT use `impl_safe_drop!` here.\n\nimpl Drop for Detached {",
+        1,
+    ),
+    (
+        "// We intentionally do NOT use `impl_safe_drop!` here.\n#[cfg(test)]\nimpl Drop for A {",
+        0,
+    ),
+]
+
+
+def find_bare_drops(text):
+    """Return (line, header) for every `impl Drop` in `text` without an explaining comment."""
+    return [
+        (text.count("\n", 0, m.start(2)) + 1, " ".join(m.group(2).split()))
+        for m in BARE_DROP.finditer(text)
+        # `$ty` is the macro's own expansion.
+        if not m.group(3).startswith("$") and not OVERRIDE.search(m.group(1))
+    ]
+
+
+def main():
+    """Check the matcher, then report every bare `impl Drop` under pg_search/src."""
+    for text, expected in SELF_TEST:
+        assert len(find_bare_drops(text)) == expected, text
+    bad = [
+        f"{path.relative_to(REPO)}:{line}: {header}"
+        for path in sorted((REPO / "pg_search" / "src").rglob("*.rs"))
+        for line, header in find_bare_drops(path.read_text(encoding="utf-8"))
+    ]
+    if bad:
+        print("\n".join(bad))
+        print(
+            f"\n{len(bad)} bare `impl Drop`. Use `impl_safe_drop!` from "
+            'pg_search/src/postgres/utils.rs, or opt out directly above the impl with "We '
+            'intentionally do NOT use `impl_safe_drop!` here because ...".'
+        )
+    return 1 if bad else 0
+
+
+if __name__ == "__main__":
+    sys.exit(main())
```

**File**: `.github/workflows/lint-rust.yml` (modified, +5/-0)
```diff
@@ -11,6 +11,7 @@ on:
     paths:
       - ".github/actions/setup-pg-search-toolchain/**"
       - ".github/workflows/lint-rust.yml"
+      - ".github/scripts/check_impl_drop.py"
       - "**/*.rs"
       - "**/*.toml"
       - "Cargo.lock"
@@ -46,6 +47,10 @@ jobs:
       - name: Checkout Git Repository
         uses: actions/checkout@v7
 
+      # A bare `impl Drop` can abort the backend during an ERROR or at exit (#6479, #6530).
+      - name: Check impl Drop
+        run: python3 .github/scripts/check_impl_drop.py
+
       - name: Configure RunsOn Caching
         uses: runs-on/action@v2
 
```

**File**: `.pre-commit-config.yaml` (modified, +6/-0)
```diff
@@ -99,6 +99,12 @@ repos:
         pass_filenames: false
         env:
           RUSTDOCFLAGS: "-D warnings"
+      - id: impl-drop
+        name: check impl Drop
+        entry: python3 .github/scripts/check_impl_drop.py
+        language: system
+        types: [rust]
+        pass_filenames: false
 
   - repo: https://github.com/astral-sh/ruff-pre-commit
     rev: v0.16.4
```

**File**: `pg_search/src/index/directory/mvcc.rs` (modified, +2/-0)
```diff
@@ -125,6 +125,8 @@ impl Seek for PgTempFile {
     }
 }
 
+// NOTE: We intentionally do NOT use `impl_safe_drop!` here because `may_close` already refuses the
+// close while unwinding, after the owner released the file, and outside a transaction.
 impl Drop for PgTempFile {
     fn drop(&mut self) {
         if self.release_guard.may_close() {
```

**File**: `pg_search/src/index/reader/io_stats.rs` (modified, +7/-0)
```diff
@@ -81,6 +81,9 @@ pub struct Scope {
     before: i64,
 }
 
+// NOTE: We intentionally do NOT use `impl_safe_drop!` here because the body only reads the
+// `pgBufferUsage` global and updates a Rust side trace behind a `parking_lot` lock, neither of
+// which can raise, and it has to run on a panic too or `depth` never comes back down.
 impl Drop for Scope {
     fn drop(&mut self) {
         let mut data = self.trace.0.lock();
@@ -98,6 +101,8 @@ pub struct External {
     name: &'static str,
 }
 
+// NOTE: We intentionally do NOT use `impl_safe_drop!` here because the body, like `Scope`'s, only
+// reads `pgBufferUsage` and attributes the difference on the trace.
 impl Drop for External {
     fn drop(&mut self) {
         let mut data = self.trace.0.lock();
@@ -118,6 +123,8 @@ pub struct ScanInitGuard {
     before: (i64, i64),
 }
 
+// NOTE: We intentionally do NOT use `impl_safe_drop!` here because the body, like `Scope`'s, only
+// reads `pgBufferUsage` and records the scan init stage on the trace.
 impl Drop for ScanInitGuard {
     fn drop(&mut self) {
         let after = snapshot();
```

**File**: `pg_search/src/index/segment_pruning/snapshot.rs` (modified, +2/-0)
```diff
@@ -294,6 +294,8 @@ pub(crate) mod test_support {
         }
     }
 
+    // NOTE: We intentionally do NOT use `impl_safe_drop!` here because the entry has to go even
+    // when the test that registered it fails, and the body is Rust only.
     impl Drop for InjectedStatsFailureGuard {
         fn drop(&mut self) {
             // Runs during a failing test's unwind; a panic here would abort the backend.
```

**File**: `pg_search/src/index/writer/segment_component.rs` (modified, +2/-0)
```diff
@@ -307,6 +307,8 @@ mod tests {
         struct CallDuringDrop {
             writer: SegmentComponentWriter,
         }
+        // NOTE: We intentionally do NOT use `impl_safe_drop!` here because the test needs this body
+        // to run while unwinding.
         impl Drop for CallDuringDrop {
             fn drop(&mut self) {
                 if !std::thread::panicking() {
```

**File**: `pg_search/src/postgres/buffile.rs` (modified, +3/-0)
```diff
@@ -157,6 +157,9 @@ impl BufFileReleaseGuard {
     }
 }
 
+// NOTE: We intentionally do NOT use `impl_safe_drop!` here because the callback holds a pointer to
+// this guard, so it has to be unregistered on every drop or a later release would call through
+// freed memory. Unregistering is a list unlink and cannot raise.
 impl Drop for BufFileReleaseGuard {
     fn drop(&mut self) {
         unsafe {
```

---

### Incident Patch 10: `939abc54` (2026-10-02)
**Commit Message**: chore: Render the table name in the score function in plans. (#6529)

## What

Render the table name in the score function in plans.

## Why

So that you can tell which tables scores are coming from!

**File**: `pg_search/src/index/fast_fields_helper.rs` (modified, +17/-5)
```diff
@@ -184,7 +184,7 @@ impl FFHelper {
                 }
                 WhichFastField::Ctid
                 | WhichFastField::TableOid
-                | WhichFastField::Score
+                | WhichFastField::Score(_)
                 | WhichFastField::Junk(_)
                 | WhichFastField::DeferredCtid(_)
                 | WhichFastField::MatchTag(_) => FFType::Junk,
@@ -574,7 +574,7 @@ pub enum WhichFastField {
     Junk(String),
     Ctid,
     TableOid,
-    Score,
+    Score(Option<String>),
     Named {
         name: String,
         field_type: SearchFieldType,
@@ -594,7 +594,7 @@ impl<S: AsRef<str>> From<(S, SearchFieldType)> for WhichFastField {
         match name {
             CTID_FIELD_NAME => WhichFastField::Ctid,
             "tableoid" => WhichFastField::TableOid,
-            "pdb.score()" => WhichFastField::Score,
+            "pdb.score()" => WhichFastField::Score(None),
             other => {
                 if other.starts_with("junk(") && other.ends_with(")") {
                     WhichFastField::Junk(String::from(
@@ -609,12 +609,24 @@ impl<S: AsRef<str>> From<(S, SearchFieldType)> for WhichFastField {
 }
 
 impl WhichFastField {
+    pub fn score() -> Self {
+        Self::Score(None)
+    }
+
+    pub fn score_with_alias(alias: impl Into<String>) -> Self {
+        Self::Score(Some(alias.into()))
+    }
+
+    pub fn is_score(&self) -> bool {
+        matches!(self, Self::Score(_))
+    }
+
     pub fn name(&self) -> String {
         match self {
             WhichFastField::Junk(s) => format!("junk({s})"),
             WhichFastField::Ctid => CTID_FIELD_NAME.into(),
             WhichFastField::TableOid => "tableoid".into(),
-            WhichFastField::Score => "pdb.score()".into(),
+            WhichFastField::Score(alias) => alias.as_deref().unwrap_or("pdb.score()").into(),
             WhichFastField::Named { name, .. } => name.clone(),
             WhichFastField::DeferredCtid(alias) => alias.clone(),
             WhichFastField::MatchTag(alias) => alias.clone(),
@@ -636,7 +648,7 @@ impl WhichFastField {
         match self {
             WhichFastField::Ctid => DataType::UInt64,
             WhichFastField::TableOid => DataType::UInt32,
-            WhichFastField::Score => DataType::Float32,
+            WhichFastField::Score(_) => DataType::Float32,
             WhichFastField::Named {
                 delivery: FieldDelivery::Eager,
                 field_type,
```

**File**: `pg_search/src/postgres/customscan/aggregatescan/datafusion_build.rs` (modified, +1/-1)
```diff
@@ -95,7 +95,7 @@ impl JoinAggSource {
             .iter()
             .find(|f| f.attno == attno)
             .and_then(|f| match &f.field {
-                WhichFastField::Score | WhichFastField::Junk(_) => None,
+                WhichFastField::Score(_) | WhichFastField::Junk(_) => None,
                 _ => Some(f.field.name()),
             })
     }
```

**File**: `pg_search/src/postgres/customscan/aggregatescan/datafusion_exec.rs` (modified, +6/-4)
```diff
@@ -44,14 +44,13 @@ use crate::postgres::customscan::datafusion::translator::{
     ColumnMapper, PredicateTranslator, apply_join_level_filter, apply_relnode_unnest,
     build_join_df_with_filter, make_col, make_source_col, unnest_plan_column,
 };
-use crate::postgres::customscan::joinscan::CtidColumn;
 use crate::postgres::customscan::joinscan::build::{
     JoinSource, LateralUnnestInfo, RelNode, RelationAlias,
 };
-use crate::postgres::customscan::joinscan::privdat::SCORE_COL_NAME;
 use crate::postgres::customscan::joinscan::scan_state::{
     create_datafusion_session_context, optimize_logical_plan, register_source_table,
 };
+use crate::postgres::customscan::joinscan::{CtidColumn, ScoreColumn};
 use crate::scan::PgSearchTableProvider;
 use crate::schema::SearchFieldType;
 use arrow_schema::DataType;
@@ -1150,19 +1149,22 @@ async fn build_source_df(
             required_early.insert(col);
         }
     }
+    let display_alias =
+        RelationAlias::new(source.scan_info.alias.as_deref()).display(plan_position);
+
+    provider.set_score_alias(&ScoreColumn::new(&display_alias).to_string());
     provider.configure_deferred_outputs(&required_early, crate::scan::VisibilityMode::Eager);
 
     let df = register_source_table(ctx, alias.as_str(), provider).await?;
 
-    // Select fields AND ensure CTID and Score are aliased consistently with JoinScan
+    // Select fields AND ensure CTID is aliased consistently with JoinScan
     let mut exprs = Vec::new();
     for df_field in df.schema().fields().iter() {
         let name = df_field.name();
         let expr = match fields.iter().find(|w| w.name() == *name) {
             Some(WhichFastField::Ctid) => {
                 make_col(alias.as_str(), name).alias(CtidColumn::new(plan_position).to_string())
             }
-            Some(WhichFastField::Score) => make_col(alias.as_str(), SCORE_COL_NAME),
             _ => make_col(alias.as_str(), name),
         };
         exprs.push(expr);
```

**File**: `pg_search/src/postgres/customscan/basescan/exec_methods/fast_fields/columnar.rs` (modified, +1/-4)
```diff
@@ -340,10 +340,7 @@ impl ColumnarExecState {
             heap_relid: heap_rel.oid().to_u32(),
             batch_size_hint: self.batch_size_hint,
             // Basescan is never leader-dispatched; mirror the reader's scoring from the fields.
-            score_needed: self
-                .scanner_fast_fields
-                .iter()
-                .any(|f| matches!(f, crate::index::fast_fields_helper::WhichFastField::Score)),
+            score_needed: self.scanner_fast_fields.iter().any(|f| f.is_score()),
             scan_mode: crate::scan::ScanMode::all(),
         };
 
```

**File**: `pg_search/src/postgres/customscan/basescan/exec_methods/fast_fields/mod.rs` (modified, +3/-3)
```diff
@@ -270,12 +270,12 @@ pub unsafe fn pullup_fast_fields(
             // 2. a call to `pdb.score` inside of an expression which will be solved by a
             //    wrapping/outer scan because it contains vars from other relations.
             if is_score_func((*te).expr.cast(), rti) {
-                matches.push(WhichFastField::Score);
+                matches.push(WhichFastField::score());
                 continue;
             } else if !can_scan_evaluate_expr(rti, (*te).expr.cast()) {
                 // The expression depends on other relations, so it will be evaluated by an upper node.
                 // We just need to provide the score.
-                matches.push(WhichFastField::Score);
+                matches.push(WhichFastField::score());
                 continue;
             }
             // Fallthrough: expression is local but complex -> cannot use fast fields
@@ -413,7 +413,7 @@ pub fn is_all_special_or_junk_fields<'a>(
             WhichFastField::Junk(_)
                 | WhichFastField::TableOid
                 | WhichFastField::Ctid
-                | WhichFastField::Score
+                | WhichFastField::Score(_)
         )
     })
 }
```

**File**: `pg_search/src/postgres/customscan/datafusion/translator.rs` (modified, +12/-16)
```diff
@@ -28,9 +28,9 @@ use pgrx::pg_sys;
 use crate::index::fast_fields_helper::{FieldCardinality, WhichFastField};
 use crate::postgres::customscan::joinscan::build::{
     JoinLevelExpr, JoinNode, JoinSource, JoinType as PgJoinType, LateralUnnestInfo, RelNode,
-    RelationAlias, UnnestNode,
+    RelationAlias, ScoreColumn, UnnestNode,
 };
-use crate::postgres::customscan::joinscan::privdat::{OutputColumnInfo, SCORE_COL_NAME};
+use crate::postgres::customscan::joinscan::privdat::OutputColumnInfo;
 use crate::postgres::customscan::pg_expr_udf::InputDecode;
 use crate::scan::ScanMode;
 
@@ -309,13 +309,7 @@ impl<'a> PredicateTranslator<'a> {
             crate::postgres::customscan::joinscan::planning::get_score_func_rti(node.cast())
         {
             for source in self.sources.iter() {
-                if let Some(attno) = source.map_var(rti, 0) {
-                    if let Some(name) = source.column_name(attno) {
-                        return Some(make_source_col(source, &name));
-                    } else {
-                        return Some(make_source_score_col(source));
-                    }
-                } else if source.contains_rti(rti) {
+                if source.contains_rti(rti) {
                     return Some(make_source_score_col(source));
                 }
             }
@@ -774,9 +768,11 @@ pub fn make_source_col(source: &JoinSource, field_name: &str) -> Expr {
 }
 
 /// Build a DataFusion column expression for the synthetic score column on the
-/// given source. Equivalent to `make_source_col(source, SCORE_COL_NAME)`.
+/// given source. Uses `ScoreColumn::new(source.display_alias())` to produce
+/// a column named `pdb.score({table})`.
 pub fn make_source_score_col(source: &JoinSource) -> Expr {
-    make_source_col(source, SCORE_COL_NAME)
+    let score_name = ScoreColumn::new(source.display_alias()).to_string();
+    make_source_col(source, &score_name)
 }
 
 /// Build a DataFusion column expression for an unnested field on the given
@@ -871,14 +867,14 @@ impl<'a> ColumnMapper for CombinedMapper<'a> {
 
         if let Some(source) = self.sources.iter().find(|s| s.contains_rti(rti)) {
             if is_score {
-                if let Some(col_idx) = source.map_var(rti, 0)
-                    && let Some(name) = source.column_name(col_idx)
-                {
-                    return Some(make_source_col(source, &name));
-                }
                 return Some(make_source_score_col(source));
             }
 
+            // Whole-row variables (attno 0) cannot be mapped to a single column.
+            if attno == 0 {
+                return None;
+            }
+
             let mapped_attno = source.map_var(rti, attno)?;
             let col_name = source.column_name(mapped_attno)?;
             if self
```

**File**: `pg_search/src/postgres/customscan/joinscan/build.rs` (modified, +25/-4)
```diff
@@ -143,6 +143,26 @@ impl TryFrom<&str> for CtidColumn {
     }
 }
 
+/// DataFusion-facing synthetic score column name helper.
+///
+/// JoinScan and AggregateScan format score column names as `pdb.score({table})`
+/// so that EXPLAIN plans and physical plan columns clearly identify which relation
+/// the score was computed from.
+#[derive(Debug, Clone)]
+pub struct ScoreColumn(String);
+
+impl ScoreColumn {
+    pub fn new(table: impl Into<String>) -> Self {
+        Self(table.into())
+    }
+}
+
+impl fmt::Display for ScoreColumn {
+    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
+        write!(f, "pdb.score({})", self.0)
+    }
+}
+
 /// DataFusion/planning identity for the PostgreSQL planner root that produced a source.
 ///
 /// We carry this through JoinScan planning so repeated RTIs from different
@@ -595,10 +615,7 @@ impl JoinSource {
             .iter()
             .find(|f| f.attno == attno)
             .and_then(|f| {
-                if matches!(
-                    f.field,
-                    crate::index::fast_fields_helper::WhichFastField::Score
-                ) {
+                if f.field.is_score() {
                     None
                 } else {
                     Some(f.field.name())
@@ -611,6 +628,10 @@ impl JoinSource {
         acc.push(self.scan_info.clone());
     }
 
+    pub fn display_alias(&self) -> String {
+        RelationAlias::new(self.scan_info.alias.as_deref()).display(self.plan_position)
+    }
+
     pub fn execution_alias(&self) -> String {
         RelationAlias::new(self.scan_info.alias.as_deref()).execution(self.plan_position)
     }
```

**File**: `pg_search/src/postgres/customscan/joinscan/mod.rs` (modified, +20/-15)
```diff
@@ -145,7 +145,7 @@ pub mod scan_state;
 pub mod visibility_filter;
 pub mod window_func;
 
-pub use self::build::CtidColumn;
+pub use self::build::{CtidColumn, ScoreColumn};
 use self::build::{JoinCSClause, RelNode, RelationAlias};
 use self::planning::{
     collect_join_sources_base_rel, collect_required_fields, ensure_score_bubbling, extract_orderby,
@@ -1361,6 +1361,16 @@ impl CustomScan for JoinScan {
         }
 
         if !join_clause.order_by.is_empty() {
+            let score_name = |rti: &pg_sys::Index| {
+                join_clause
+                    .plan
+                    .sources()
+                    .iter()
+                    .find(|s| s.contains_rti(*rti))
+                    .map(|s| ScoreColumn::new(s.display_alias()).to_string())
+                    .unwrap_or_else(|| ScoreColumn::new("?").to_string())
+            };
+
             explainer.add_text(
                 "Order By",
                 join_clause
@@ -1370,6 +1380,13 @@ impl CustomScan for JoinScan {
                         OrderByFeature::Field { name: f, .. } => {
                             format!("{} {}", f, oi.direction.as_ref())
                         }
+                        OrderByFeature::Score { rti } => {
+                            format!("{} {}", score_name(rti), oi.direction.as_ref())
+                        }
+                        OrderByFeature::ScoreSum { rtis } => {
+                            let scores: Vec<String> = rtis.iter().map(score_name).collect();
+                            format!("{} {}", scores.join(" + "), oi.direction.as_ref())
+                        }
                         OrderByFeature::Var { rti, attno, name } => {
                             if let Some(info) = base_relations.iter().find(|i| i.heap_rti == *rti) {
                                 let col_name = get_attname_safe(
@@ -1750,21 +1767,9 @@ impl CustomScan for JoinScan {
                     .iter()
                     .enumerate()
                     .map(|(out_idx, col_info)| match col_info {
-                        privdat::OutputColumnInfo::Score { plan_position, .. } => {
+                        privdat::OutputColumnInfo::Score { .. } => {
                             let col_alias = format!("col_{}", out_idx + 1);
-                            if let Ok(idx) = schema.index_of(&col_alias) {
-                                Some(idx)
-                            } else if let Some(source) = plan_sources.get(*plan_position) {
-                                let alias = RelationAlias::new(source.scan_info.alias.as_deref())
-                                    .execution(*plan_position);
-                                let score_col = format!("_score_{alias}");
-                                schema
-                                    .index_of(&score_col)
-                                    .ok()
-                                    .or_else(|| schema.index_of(privdat::SCORE_COL_NAME).ok())
-                            } else {
-                                schema.index_of(privdat::SCORE_COL_NAME).ok()
-                            }
+                            schema.index_of(&col_alias).ok()
                         }
                         privdat::OutputColumnInfo::Unnested {
                             source_rti,
```

---

### Incident Patch 11: `544f4c67` (2026-10-02)
**Commit Message**: fix: stop AggregateScan from grouping on the sort keys of ordered aggregates (#6612)

## Ticket(s) Closed

- Closes #6607

## What

This PR stops AggregateScan from grouping on the `ORDER BY` column of an
ordered aggregate.

```sql
-- 4 rows of 30, one for each `kind`. Postgres: 1 row, 120.
SELECT COUNT(id ORDER BY kind) FROM items WHERE id @@@ paradedb.all();
```

The query returned one row for each value of the sort column, with and
without a `GROUP BY`.

## Why

On PG16 and later, `adjust_group_pathkeys_for_groupagg` appends the sort
keys of ordered and `DISTINCT` aggregates to `root->group_pathkeys`, so
that one sort can serve the aggregates. The GROUP BY keys are only the
first `root->num_groupby_pathkeys` entries. The Tantivy backend took
every entry as a grouping column.

## How

`CreateUpperPathsHookArgs::group_by_pathkeys()` returns the first
`num_groupby_pathkeys` pathkeys. On PG15 that is the full list. The
grouping columns come from it, and so does the check for the order of a
single grouping key.

The collation check in `validate_grouping_pushdown` still reads all of
`group_pathkeys`. The DataFusion backend compares the `DISTINCT` and
`ORDER BY` keys of an aggregate by

**File**: `docs/project/changelog/unreleased/6612.stability.mdx` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+header: stability
+---
+
+Fixed wrong results from Aggregate Scan for an aggregate with its own `ORDER BY`, such as `COUNT(id ORDER BY kind)`. On Postgres 16 and later, the scan grouped on the sort column and returned one row for each of its values (#6607).
```

**File**: `pg_search/src/postgres/customscan/aggregatescan/groupby.rs` (modified, +1/-7)
```diff
@@ -83,13 +83,7 @@ impl CustomScanClause<AggregateScan> for GroupByClause {
         // Use PostgreSQL's processed pathkeys, not `parse.groupClause`: redundant
         // GROUP BY columns may be removed, and AggregateScan eligibility validates
         // this same representation before allowing pushdown.
-        let pathkeys = if args.root().group_pathkeys.is_null() {
-            PgList::<pg_sys::PathKey>::new()
-        } else {
-            unsafe { PgList::<pg_sys::PathKey>::from_pg(args.root().group_pathkeys) }
-        };
-
-        for pathkey in pathkeys.iter_ptr() {
+        for pathkey in args.group_by_pathkeys() {
             let pathkey = unsafe { &*pathkey };
             let equivclass = unsafe { &*pathkey.pk_eclass };
             let members =
```

**File**: `pg_search/src/postgres/customscan/aggregatescan/mod.rs` (modified, +38/-26)
```diff
@@ -138,6 +138,7 @@ enum GroupingPushdownDeclineReason {
     GroupingSets,
     MissingPathKeys,
     NondeterministicCollation,
+    NondeterministicAggregateKey,
 }
 
 impl GroupingPushdownDeclineReason {
@@ -146,6 +147,9 @@ impl GroupingPushdownDeclineReason {
             Self::GroupingSets => "GROUPING SETS are not supported",
             Self::MissingPathKeys => "could not verify GROUP BY semantics",
             Self::NondeterministicCollation => "GROUP BY uses a nondeterministic collation",
+            Self::NondeterministicAggregateKey => {
+                "an aggregate has a DISTINCT or ORDER BY key with a nondeterministic collation"
+            }
         }
     }
 }
@@ -166,7 +170,30 @@ unsafe fn validate_grouping_pushdown(
         return Err(GroupingPushdownDeclineReason::GroupingSets);
     }
 
-    if args.root().group_pathkeys.is_null() {
+    // On PG16 and later, the sort keys of ordered and DISTINCT aggregates follow
+    // the GROUP BY keys in `group_pathkeys`. This checks them too: the DataFusion
+    // backend compares them by their bytes, like the GROUP BY keys.
+    let num_group_by_keys = args.group_by_pathkeys().len();
+    let pathkeys = PgList::<pg_sys::PathKey>::from_pg(args.root().group_pathkeys);
+    for (i, pathkey) in pathkeys.iter_ptr().enumerate() {
+        let equivalence_class = (*pathkey).pk_eclass;
+        if equivalence_class.is_null() {
+            return Err(GroupingPushdownDeclineReason::MissingPathKeys);
+        }
+
+        let collation = (*equivalence_class).ec_collation;
+        if assess_collation(collation, CollationOperation::Equality)
+            == CollationSafety::NondeterministicEquality
+        {
+            return Err(if i < num_group_by_keys {
+                GroupingPushdownDeclineReason::NondeterministicCollation
+            } else {
+                GroupingPushdownDeclineReason::NondeterministicAggregateKey
+            });
+        }
+    }
+
+    if num_group_by_keys == 0 {
         // A scalar aggregate has no grouping keys.
         if parse.is_null() || (*parse).groupClause.is_null() {
             return Ok(());
@@ -199,20 +226,6 @@ unsafe fn validate_grouping_pushdown(
         return Err(GroupingPushdownDeclineReason::MissingPathKeys);
     }
 
-    for pathkey in PgList::<pg_sys::PathKey>::from_pg(args.root().group_pathkeys).iter_ptr() {
-        let equivalence_class = (*pathkey).pk_eclass;
-        if equivalence_class.is_null() {
-            return Err(GroupingPushdownDeclineReason::MissingPathKeys);
-        }
-
-        let collation = (*equivalence_class).ec_collation;
-        if assess_collation(collation, CollationOperation::Equality)
-            == CollationSafety::NondeterministicEquality
-        {
-            return Err(GroupingPushdownDeclineReason::NondeterministicCollation);
-        }
-    }
-
     Ok(())
 }
 
@@ -221,20 +234,19 @@ unsafe fn validate_grouping_pushdown(
 /// This is stricter than grouping equality: deterministic ICU collations are
 /// safe for grouping, but PostgreSQL must still perform their ordering.
 unsafe fn grouping_key_order_is_pushdown_safe(args: &CreateUpperPathsHookArgs) -> bool {
-    if args.root().group_pathkeys.is_null() {
+    let pathkeys = args.group_by_pathkeys();
+    if pathkeys.is_empty() {
         return false;
     }
 
-    PgList::<pg_sys::PathKey>::from_pg(args.root().group_pathkeys)
-        .iter_ptr()
-        .all(|pathkey| {
-            let equivalence_class = (*pathkey).pk_eclass;
-            !equivalence_class.is_null()
-                && collation_supports(
-                    (*equivalence_class).ec_collation,
-                    CollationOperation::Ordering,
-                )
-        })
+    pathkeys.into_iter().all(|pathkey| {
+        let equivalence_class = (*pathkey).pk_eclass;
+        !equivalence_class.is_null()
+            && collation_supports(
+                (*equivalence_class).ec_collation,
+                CollationOperation::Ordering,
+            )
+    })
 }
 
 /// A collection of index information that is necessary for making result-rewriting decisions
```

**File**: `pg_search/src/postgres/customscan/mod.rs` (modified, +15/-0)
```diff
@@ -318,6 +318,21 @@ impl CreateUpperPathsHookArgs {
         }
     }
 
+    /// The pathkeys of the GROUP BY keys.
+    ///
+    /// On PG16 and later, `group_pathkeys` can have more entries after these:
+    /// the sort keys of ordered and DISTINCT aggregates, which PostgreSQL adds so
+    /// that one sort can serve them. They are not GROUP BY keys.
+    pub fn group_by_pathkeys(&self) -> Vec<*mut pg_sys::PathKey> {
+        // `group_pathkeys` of a valid `PlannerInfo` is NIL or a list of `PathKey`.
+        let pathkeys = unsafe { PgList::<pg_sys::PathKey>::from_pg(self.root().group_pathkeys) };
+        #[cfg(feature = "pg15")]
+        let count = pathkeys.len();
+        #[cfg(not(feature = "pg15"))]
+        let count = self.root().num_groupby_pathkeys as usize;
+        pathkeys.iter_ptr().take(count).collect()
+    }
+
     /// Estimate how many groups the GROUP BY will produce, so routing can send
     /// high-cardinality aggregates to DataFusion (no bucket cap) and keep
     /// low-cardinality ones on the faster Tantivy path.
```

**File**: `pg_search/tests/pg_regress/expected/aggregate_ordered_aggregate.out` (added, +332/-0)
```diff
@@ -0,0 +1,332 @@
+-- An aggregate with its own ORDER BY, such as `COUNT(id ORDER BY kind)`.
+-- On PG16 and later, PostgreSQL puts the sort keys of such an aggregate after
+-- the GROUP BY keys in `group_pathkeys`. The Aggregate Scan must not group on
+-- them.
+\i common/common_setup.sql
+CREATE EXTENSION IF NOT EXISTS pg_search;
+-- Disable parallel workers to avoid differences in plans
+SET max_parallel_workers_per_gather = 0;
+SET enable_indexscan to OFF;
+SET paradedb.enable_columnar_exec = true;
+CREATE COLLATION IF NOT EXISTS ordered_agg_case_insensitive (
+    provider = icu,
+    locale = 'und-u-ks-level2',
+    deterministic = false
+);
+CREATE TABLE ordered_agg_items (
+    id SERIAL PRIMARY KEY,
+    account_id BIGINT,
+    kind TEXT,
+    price FLOAT8,
+    amount NUMERIC(10, 2)
+);
+INSERT INTO ordered_agg_items (account_id, kind, price, amount)
+SELECT (g % 3) + 1, (ARRAY['a', 'b', 'c', 'd'])[(g % 4) + 1], g % 5, (g % 5) + 0.5
+FROM generate_series(1, 120) g;
+CREATE INDEX ordered_agg_items_idx ON ordered_agg_items
+USING paradedb (id, account_id, (kind::pdb.literal), price, amount);
+SET paradedb.enable_aggregate_custom_scan TO on;
+\echo 'Test 1: no GROUP BY -> one row'
+Test 1: no GROUP BY -> one row
+EXPLAIN (COSTS OFF, VERBOSE, TIMING OFF)
+SELECT COUNT(id ORDER BY kind)
+FROM ordered_agg_items
+WHERE id @@@ paradedb.all();
+                                  QUERY PLAN                                   
+-------------------------------------------------------------------------------
+ Custom Scan (ParadeDB Aggregate Scan) on public.ordered_agg_items
+   Output: pdb.agg_fn('COUNT'::text)
+   Index: ordered_agg_items_idx
+   Tantivy Query: {"with_index":{"query":"all"}}
+     Applies to Aggregates: COUNT(id)
+     Aggregate Definition: {"0":{"value_count":{"field":"id","missing":null}}}
+(6 rows)
+
+SELECT COUNT(id ORDER BY kind)
+FROM ordered_agg_items
+WHERE id @@@ paradedb.all();
+ count 
+-------
+   120
+(1 row)
+
+\echo 'Test 2: GROUP BY -> one row for each group'
+Test 2: GROUP BY -> one row for each group
+EXPLAIN (COSTS OFF, VERBOSE, TIMING OFF)
+SELECT account_id, COUNT(id ORDER BY kind)
+FROM ordered_agg_items
+WHERE id @@@ paradedb.all()
+GROUP BY account_id
+ORDER BY account_id;
+                                                                                         QUERY PLAN                                                                                         
+--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
+ Custom Scan (ParadeDB Aggregate Scan) on public.ordered_agg_items
+   Output: account_id, pdb.agg_fn('COUNT'::text)
+   Index: ordered_agg_items_idx
+   Tantivy Query: {"with_index":{"query":"all"}}
+     Applies to Aggregates: COUNT(id)
+     Group By: account_id
+     Aggregate Definition: {"grouped":{"aggs":{"0":{"value_count":{"field":"id","missing":null}}},"terms":{"field":"account_id","order":{"_key":"asc"},"segment_size":65000,"size":65000}}}
+(7 rows)
+
+SELECT account_id, COUNT(id ORDER BY kind)
+FROM ordered_agg_items
+WHERE id @@@ paradedb.all()
+GROUP BY account_id
+ORDER BY account_id;
+ account_id | count 
+------------+-------
+          1 |    40
+          2 |    40
+          3 |    40
+(3 rows)
+
+\echo 'Test 3: other aggregates, and a sort key that is not in the index'
+Test 3: other aggregates, and a sort key that is not in the index
+EXPLAIN (COSTS OFF, VERBOSE, TIMING OFF)
+SELECT account_id, SUM(price ORDER BY kind), MIN(price ORDER BY kind), MAX(price ORDER BY upper(kind))
+FROM ordered_agg_items
+WHERE id @@@ paradedb.all()
+GROUP BY account_id
+ORDER BY account_id;
+                                                                                                                                               QUERY PLAN                                                                                                                                                
+---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
+ Custom Scan (ParadeDB Aggregate Scan) on public.ordered_agg_items
+   Output: account_id, pdb.agg_fn('SUM'::text), pdb.agg_fn('MIN'::text), pdb.agg_fn('MAX'::text)
+   Index: ordered_agg_items_idx
+   Tantivy Query: {"with_index":{"query":"all"}}
+     Applies to Aggregates: SUM(price), MIN(price), MAX(price)
+     Group By: account_id
+     Aggregate Definition: {"grouped":{"aggs":{"0":{"sum":{"field":"price","missing":null,"none_if_no_match":true}},"1":{"min":{"field":"price","missing":null}},"2":{"max":{"field":"price","missing":null}}},"terms":{"field":"account_id","order":{"_key":"asc"},"segment_size":65000,"size":65000}}}
+(7 rows)
+
+SELECT acc
```

**File**: `pg_search/tests/pg_regress/sql/aggregate_ordered_aggregate.sql` (added, +164/-0)
```diff
@@ -0,0 +1,164 @@
+-- An aggregate with its own ORDER BY, such as `COUNT(id ORDER BY kind)`.
+-- On PG16 and later, PostgreSQL puts the sort keys of such an aggregate after
+-- the GROUP BY keys in `group_pathkeys`. The Aggregate Scan must not group on
+-- them.
+
+\i common/common_setup.sql
+
+CREATE COLLATION IF NOT EXISTS ordered_agg_case_insensitive (
+    provider = icu,
+    locale = 'und-u-ks-level2',
+    deterministic = false
+);
+
+CREATE TABLE ordered_agg_items (
+    id SERIAL PRIMARY KEY,
+    account_id BIGINT,
+    kind TEXT,
+    price FLOAT8,
+    amount NUMERIC(10, 2)
+);
+
+INSERT INTO ordered_agg_items (account_id, kind, price, amount)
+SELECT (g % 3) + 1, (ARRAY['a', 'b', 'c', 'd'])[(g % 4) + 1], g % 5, (g % 5) + 0.5
+FROM generate_series(1, 120) g;
+
+CREATE INDEX ordered_agg_items_idx ON ordered_agg_items
+USING paradedb (id, account_id, (kind::pdb.literal), price, amount);
+
+SET paradedb.enable_aggregate_custom_scan TO on;
+
+\echo 'Test 1: no GROUP BY -> one row'
+EXPLAIN (COSTS OFF, VERBOSE, TIMING OFF)
+SELECT COUNT(id ORDER BY kind)
+FROM ordered_agg_items
+WHERE id @@@ paradedb.all();
+
+SELECT COUNT(id ORDER BY kind)
+FROM ordered_agg_items
+WHERE id @@@ paradedb.all();
+
+\echo 'Test 2: GROUP BY -> one row for each group'
+EXPLAIN (COSTS OFF, VERBOSE, TIMING OFF)
+SELECT account_id, COUNT(id ORDER BY kind)
+FROM ordered_agg_items
+WHERE id @@@ paradedb.all()
+GROUP BY account_id
+ORDER BY account_id;
+
+SELECT account_id, COUNT(id ORDER BY kind)
+FROM ordered_agg_items
+WHERE id @@@ paradedb.all()
+GROUP BY account_id
+ORDER BY account_id;
+
+\echo 'Test 3: other aggregates, and a sort key that is not in the index'
+EXPLAIN (COSTS OFF, VERBOSE, TIMING OFF)
+SELECT account_id, SUM(price ORDER BY kind), MIN(price ORDER BY kind), MAX(price ORDER BY upper(kind))
+FROM ordered_agg_items
+WHERE id @@@ paradedb.all()
+GROUP BY account_id
+ORDER BY account_id;
+
+SELECT account_id, SUM(price ORDER BY kind), MIN(price ORDER BY kind), MAX(price ORDER BY upper(kind))
+FROM ordered_agg_items
+WHERE id @@@ paradedb.all()
+GROUP BY account_id
+ORDER BY account_id;
+
+\echo 'Test 4: the sort key is also a GROUP BY key'
+EXPLAIN (COSTS OFF, VERBOSE, TIMING OFF)
+SELECT kind, COUNT(id ORDER BY kind, account_id)
+FROM ordered_agg_items
+WHERE id @@@ paradedb.all()
+GROUP BY kind
+ORDER BY kind;
+
+SELECT kind, COUNT(id ORDER BY kind, account_id)
+FROM ordered_agg_items
+WHERE id @@@ paradedb.all()
+GROUP BY kind
+ORDER BY kind;
+
+\echo 'Test 5: DISTINCT aggregate -> declined'
+EXPLAIN (COSTS OFF, TIMING OFF)
+SELECT account_id, COUNT(DISTINCT kind)
+FROM ordered_agg_items
+WHERE id @@@ paradedb.all()
+GROUP BY account_id
+ORDER BY account_id;
+
+SELECT account_id, COUNT(DISTINCT kind)
+FROM ordered_agg_items
+WHERE id @@@ paradedb.all()
+GROUP BY account_id
+ORDER BY account_id;
+
+\echo 'Test 6: pdb.agg() -> one row'
+SELECT pdb.agg('{"value_count": {"field": "id"}}'::jsonb ORDER BY kind)
+FROM ordered_agg_items
+WHERE id @@@ paradedb.all();
+
+\echo 'Test 7: DataFusion backend, sort key with a nondeterministic collation -> declined'
+-- The NUMERIC aggregate routes the query to DataFusion, which sorts by the
+-- bytes of the key.
+EXPLAIN (COSTS OFF, TIMING OFF)
+SELECT account_id, SUM(amount), string_agg(kind, ',' ORDER BY kind COLLATE ordered_agg_case_insensitive)
+FROM ordered_agg_items
+WHERE id <= 12 AND id @@@ paradedb.all()
+GROUP BY account_id
+ORDER BY account_id;
+
+SELECT account_id, SUM(amount), string_agg(kind, ',' ORDER BY kind COLLATE ordered_agg_case_insensitive)
+FROM ordered_agg_items
+WHERE id <= 12 AND id @@@ paradedb.all()
+GROUP BY account_id
+ORDER BY account_id;
+
+EXPLAIN (COSTS OFF, TIMING OFF)
+SELECT SUM(amount), COUNT(DISTINCT kind COLLATE ordered_agg_case_insensitive)
+FROM ordered_agg_items
+WHERE id @@@ paradedb.all();
+
+SELECT SUM(amount), COUNT(DISTINCT kind COLLATE ordered_agg_case_insensitive)
+FROM ordered_agg_items
+WHERE id @@@ paradedb.all();
+
+\echo 'Same results from PostgreSQL'
+SET paradedb.enable_aggregate_custom_scan TO off;
+
+SELECT COUNT(id ORDER BY kind)
+FROM ordered_agg_items
+WHERE id @@@ paradedb.all();
+
+SELECT account_id, COUNT(id ORDER BY kind)
+FROM ordered_agg_items
+WHERE id @@@ paradedb.all()
+GROUP BY account_id
+ORDER BY account_id;
+
+SELECT account_id, SUM(price ORDER BY kind), MIN(price ORDER BY kind), MAX(price ORDER BY upper(kind))
+FROM ordered_agg_items
+WHERE id @@@ paradedb.all()
+GROUP BY account_id
+ORDER BY account_id;
+
+SELECT kind, COUNT(id ORDER BY kind, account_id)
+FROM ordered_agg_items
+WHERE id @@@ paradedb.all()
+GROUP BY kind
+ORDER BY kind;
+
+SELECT account_id, SUM(amount), string_agg(kind, ',' ORDER BY kind COLLATE ordered_agg_case_insensitive)
+FROM ordered_agg_items
+WHERE id <= 12 AND id @@@ paradedb.all()
+GROUP BY account_id
+ORDER BY account_id;
+
+SELECT SUM(amount), COUNT(DISTINCT kind COLLATE ordered_agg_case_insensitive)
+FROM ordered_agg_items
+WHERE id @@@ paradedb.all();
+
+RESET paraded
```

**File**: `tests/tests/aggregate_custom_scan.rs` (modified, +48/-0)
```diff
@@ -292,6 +292,54 @@ fn test_group_by_null_bucket(mut conn: PgConnection) {
     );
 }
 
+// On PG16 and later, PostgreSQL puts the sort keys of an ordered aggregate
+// after the GROUP BY keys in `group_pathkeys`. The scan must not group on them.
+// PG15 has no such keys, so this test does not fail there without the fix.
+#[rstest]
+fn test_ordered_aggregate_is_not_a_group_key(mut conn: PgConnection) {
+    r#"
+    CREATE TABLE ordered_aggs (
+        id SERIAL PRIMARY KEY,
+        account_id BIGINT,
+        kind TEXT,
+        price FLOAT8
+    );
+    INSERT INTO ordered_aggs (account_id, kind, price)
+    SELECT (g % 3) + 1, (ARRAY['a', 'b', 'c', 'd'])[(g % 4) + 1], g % 5
+    FROM generate_series(1, 120) g;
+    CREATE INDEX ordered_aggs_idx ON ordered_aggs
+    USING paradedb (id, account_id, (kind::pdb.literal), price);
+    "#
+    .execute(&mut conn);
+
+    let queries = [
+        "SELECT COUNT(id ORDER BY kind) FROM ordered_aggs WHERE id @@@ paradedb.all()",
+        "SELECT account_id, COUNT(id ORDER BY kind), SUM(price ORDER BY kind) FROM ordered_aggs
+         WHERE id @@@ paradedb.all() GROUP BY account_id",
+        "SELECT kind, MAX(price ORDER BY kind, account_id) FROM ordered_aggs
+         WHERE id @@@ paradedb.all() GROUP BY kind",
+    ];
+
+    for query in queries {
+        "SET paradedb.enable_aggregate_custom_scan TO on;".execute(&mut conn);
+        assert_uses_custom_scan(&mut conn, true, query);
+
+        // The comment gives each setting its own statement, and with it its own plan.
+        let [pushed_down, expected] = ["on", "off"].map(|enabled| {
+            format!("SET paradedb.enable_aggregate_custom_scan TO {enabled};").execute(&mut conn);
+            let (rows,) = format!(
+                "/* aggregate scan {enabled} */
+                 SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY to_jsonb(q)::text), '[]')::text
+                 FROM ({query}) q"
+            )
+            .fetch_one::<(String,)>(&mut conn);
+            rows
+        });
+
+        assert_eq!(pushed_down, expected, "{query}");
+    }
+}
+
 #[rstest]
 fn test_no_bm25_index(mut conn: PgConnection) {
     "CALL paradedb.create_paradedb_test_table(table_name => 'no_bm25', schema_name => 'paradedb');"
```

---

### Incident Patch 12: `5caa1e3c` (2026-10-02)
**Commit Message**: fix: keep the Aggref replacements of AggregateScan in the plan's memory context (#6611)

## Ticket(s) Closed

- Closes #6136

## What

This PR lets a prepared statement run a grouped aggregate on the Tantivy
backend of AggregateScan more than one time.

```sql
PREPARE group_by_region AS
SELECT region, COUNT(*) FROM sales WHERE id @@@ pdb.all() GROUP BY region ORDER BY region;

EXECUTE group_by_region;  -- rows
EXECUTE group_by_region;  -- ERROR:  PgList does not contain pointers
```

The second run of a cached plan failed. A statement with no parameters
gets a cached plan on its first run. A statement with parameters gets
one when PostgreSQL changes to a generic plan, which it can do after
five runs. A driver that prepares its statements, such as sqlx, hits
this when it sends the same query two times. A statement in a PL/pgSQL
function hits it on the second call.

## Why

For a grouped aggregate, `replace_aggrefs_in_target_list` runs at
`CreateCustomScanState`. The Aggrefs must stay in the target list
through planning, because the nodes above the scan look for them there.
The function then wrote the new target list into the plan node, but it
built the list in the memory context of 

**File**: `docs/project/changelog/unreleased/6611.stability.mdx` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+header: stability
+---
+
+Fixed `PgList does not contain pointers` when a prepared statement runs a `GROUP BY` aggregate on Aggregate Scan more than one time. The error came on the second run of a cached plan, which a driver that prepares its statements reaches when it sends the same query two times (#6136).
```

**File**: `pg_search/src/postgres/customscan/aggregatescan/mod.rs` (modified, +20/-11)
```diff
@@ -2684,8 +2684,14 @@ unsafe fn detect_join_aggregate_topk(
 }
 
 /// Replace any T_Aggref expressions in the target list with T_FuncExpr placeholders
-/// This is called at execution time to avoid "Aggref found in non-Agg plan node" errors
+/// This is called at plan time or at executor startup to avoid "Aggref found in non-Agg plan node" errors
 /// Uses expression_tree_mutator to handle nested Aggrefs (e.g., COALESCE(COUNT(*), 0))
+///
+/// The new target list lives in the memory context of the one it replaces. PostgreSQL
+/// can cache a plan and run it again (a prepared statement, or a statement in a
+/// function), so the plan can outlive the execution that calls this. The next
+/// execution finds no Aggref and changes nothing, so a plan keeps one old list
+/// and no more.
 unsafe fn replace_aggrefs_in_target_list(plan: *mut pg_sys::Plan) {
     use pgrx::pg_guard;
 
@@ -2752,18 +2758,21 @@ unsafe fn replace_aggrefs_in_target_list(plan: *mut pg_sys::Plan) {
     }
 
     // Build a new target list with Aggrefs replaced by placeholders and UNNEST stripped
-    let mut new_targetlist: *mut pg_sys::List = std::ptr::null_mut();
-    for te in targetlist.iter_ptr() {
-        let new_te = pg_sys::flatCopyTargetEntry(te);
-
-        // Use the mutator to replace any Aggref or UNNEST nodes in the expression
-        let new_expr = aggref_mutator((*te).expr as *mut pg_sys::Node, std::ptr::null_mut());
-        (*new_te).expr = new_expr as *mut pg_sys::Expr;
+    let mut plan_context = PgMemoryContexts::of((*plan).targetlist.cast())
+        .expect("the target list should be in a memory context");
+    (*plan).targetlist = plan_context.switch_to(|_| {
+        let mut new_targetlist: *mut pg_sys::List = std::ptr::null_mut();
+        for te in targetlist.iter_ptr() {
+            let new_te = pg_sys::flatCopyTargetEntry(te);
 
-        new_targetlist = pg_sys::lappend(new_targetlist, new_te.cast());
-    }
+            // Use the mutator to replace any Aggref or UNNEST nodes in the expression
+            let new_expr = aggref_mutator((*te).expr as *mut pg_sys::Node, std::ptr::null_mut());
+            (*new_te).expr = new_expr as *mut pg_sys::Expr;
 
-    (*plan).targetlist = new_targetlist;
+            new_targetlist = pg_sys::lappend(new_targetlist, new_te.cast());
+        }
+        new_targetlist
+    });
 }
 
 /// Creates a placeholder `FuncExpr` for a PostgreSQL `Aggref`.
```

**File**: `pg_search/tests/pg_regress/expected/prepared_statement_aggregate.out` (added, +542/-0)
```diff
@@ -0,0 +1,542 @@
+-- A prepared statement whose plan PostgreSQL caches and runs again. The
+-- Aggregate Scan must leave the cached plan in a state that the next run can
+-- use.
+\i common/common_setup.sql
+CREATE EXTENSION IF NOT EXISTS pg_search;
+-- Disable parallel workers to avoid differences in plans
+SET max_parallel_workers_per_gather = 0;
+SET enable_indexscan to OFF;
+SET paradedb.enable_columnar_exec = true;
+CREATE TABLE prepared_agg_sales (
+    id SERIAL PRIMARY KEY,
+    region TEXT NOT NULL,
+    rating INTEGER NOT NULL,
+    amount FLOAT8 NOT NULL,
+    tags TEXT[] NOT NULL
+);
+INSERT INTO prepared_agg_sales (region, rating, amount, tags)
+SELECT
+    (ARRAY['east', 'north', 'west'])[(g % 3) + 1],
+    (g % 4) + 1,
+    g,
+    CASE WHEN g % 2 = 0 THEN ARRAY['new', 'sale'] ELSE ARRAY['new'] END
+FROM generate_series(1, 60) g;
+CREATE INDEX prepared_agg_sales_idx ON prepared_agg_sales
+USING paradedb (id, (region::pdb.literal), rating, amount, (tags::pdb.literal));
+SET paradedb.enable_aggregate_custom_scan TO on;
+-- =====================================================================
+-- SECTION 1: No parameter -> PostgreSQL caches the plan on the first run
+-- =====================================================================
+\echo 'Test 1.1: GROUP BY'
+Test 1.1: GROUP BY
+PREPARE prepared_agg_group AS
+SELECT region, COUNT(*)
+FROM prepared_agg_sales
+WHERE id @@@ pdb.all()
+GROUP BY region
+ORDER BY region;
+EXPLAIN (COSTS OFF, VERBOSE, TIMING OFF) EXECUTE prepared_agg_group;
+                                                         QUERY PLAN                                                          
+-----------------------------------------------------------------------------------------------------------------------------
+ Custom Scan (ParadeDB Aggregate Scan) on public.prepared_agg_sales
+   Output: region, pdb.agg_fn('COUNT(*)'::text)
+   Index: prepared_agg_sales_idx
+   Tantivy Query: {"with_index":{"query":{"all":{"field":"id"}}}}
+     Applies to Aggregates: COUNT(*)
+     Group By: region
+     Aggregate Definition: {"grouped":{"terms":{"field":"region","order":{"_key":"asc"},"segment_size":65000,"size":65000}}}
+(7 rows)
+
+EXECUTE prepared_agg_group;
+ region | count 
+--------+-------
+ east   |    20
+ north  |    20
+ west   |    20
+(3 rows)
+
+EXECUTE prepared_agg_group;
+ region | count 
+--------+-------
+ east   |    20
+ north  |    20
+ west   |    20
+(3 rows)
+
+EXECUTE prepared_agg_group;
+ region | count 
+--------+-------
+ east   |    20
+ north  |    20
+ west   |    20
+(3 rows)
+
+\echo 'Test 1.2: aggregate in an expression'
+Test 1.2: aggregate in an expression
+PREPARE prepared_agg_wrapped AS
+SELECT region, COALESCE(SUM(amount), 0) + 1 AS total, COUNT(*)
+FROM prepared_agg_sales
+WHERE id @@@ pdb.all()
+GROUP BY region
+ORDER BY region;
+EXPLAIN (COSTS OFF, VERBOSE, TIMING OFF) EXECUTE prepared_agg_wrapped;
+                                                                                                 QUERY PLAN                                                                                                 
+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
+ Custom Scan (ParadeDB Aggregate Scan) on public.prepared_agg_sales
+   Output: region, (COALESCE(pdb.agg_fn('SUM'::text), '0'::double precision) + '1'::double precision), pdb.agg_fn('COUNT(*)'::text)
+   Index: prepared_agg_sales_idx
+   Tantivy Query: {"with_index":{"query":{"all":{"field":"id"}}}}
+     Applies to Aggregates: SUM(amount), COUNT(*)
+     Group By: region
+     Aggregate Definition: {"grouped":{"aggs":{"0":{"sum":{"field":"amount","missing":null,"none_if_no_match":true}}},"terms":{"field":"region","order":{"_key":"asc"},"segment_size":65000,"size":65000}}}
+(7 rows)
+
+EXECUTE prepared_agg_wrapped;
+ region | total | count 
+--------+-------+-------
+ east   |   631 |    20
+ north  |   591 |    20
+ west   |   611 |    20
+(3 rows)
+
+EXECUTE prepared_agg_wrapped;
+ region | total | count 
+--------+-------+-------
+ east   |   631 |    20
+ north  |   591 |    20
+ west   |   611 |    20
+(3 rows)
+
+EXECUTE prepared_agg_wrapped;
+ region | total | count 
+--------+-------+-------
+ east   |   631 |    20
+ north  |   591 |    20
+ west   |   611 |    20
+(3 rows)
+
+\echo 'Test 1.3: ORDER BY an aggregate'
+Test 1.3: ORDER BY an aggregate
+PREPARE prepared_agg_order AS
+SELECT rating, COUNT(*), MAX(amount)
+FROM prepared_agg_sales
+WHERE id @@@ pdb.all()
+GROUP BY rating
+ORDER BY MAX(amount) DESC, rating;
+EXPLAIN (COSTS OFF, VERBOSE, TIMING OFF) EXECUTE prepared_agg_order;
+                                                                            QUERY PLAN                                                                             
+--------------------------------------------------------------------------------
```

**File**: `pg_search/tests/pg_regress/sql/prepared_statement_aggregate.sql` (added, +226/-0)
```diff
@@ -0,0 +1,226 @@
+-- A prepared statement whose plan PostgreSQL caches and runs again. The
+-- Aggregate Scan must leave the cached plan in a state that the next run can
+-- use.
+
+\i common/common_setup.sql
+
+CREATE TABLE prepared_agg_sales (
+    id SERIAL PRIMARY KEY,
+    region TEXT NOT NULL,
+    rating INTEGER NOT NULL,
+    amount FLOAT8 NOT NULL,
+    tags TEXT[] NOT NULL
+);
+
+INSERT INTO prepared_agg_sales (region, rating, amount, tags)
+SELECT
+    (ARRAY['east', 'north', 'west'])[(g % 3) + 1],
+    (g % 4) + 1,
+    g,
+    CASE WHEN g % 2 = 0 THEN ARRAY['new', 'sale'] ELSE ARRAY['new'] END
+FROM generate_series(1, 60) g;
+
+CREATE INDEX prepared_agg_sales_idx ON prepared_agg_sales
+USING paradedb (id, (region::pdb.literal), rating, amount, (tags::pdb.literal));
+
+SET paradedb.enable_aggregate_custom_scan TO on;
+
+-- =====================================================================
+-- SECTION 1: No parameter -> PostgreSQL caches the plan on the first run
+-- =====================================================================
+
+\echo 'Test 1.1: GROUP BY'
+PREPARE prepared_agg_group AS
+SELECT region, COUNT(*)
+FROM prepared_agg_sales
+WHERE id @@@ pdb.all()
+GROUP BY region
+ORDER BY region;
+
+EXPLAIN (COSTS OFF, VERBOSE, TIMING OFF) EXECUTE prepared_agg_group;
+EXECUTE prepared_agg_group;
+EXECUTE prepared_agg_group;
+EXECUTE prepared_agg_group;
+
+\echo 'Test 1.2: aggregate in an expression'
+PREPARE prepared_agg_wrapped AS
+SELECT region, COALESCE(SUM(amount), 0) + 1 AS total, COUNT(*)
+FROM prepared_agg_sales
+WHERE id @@@ pdb.all()
+GROUP BY region
+ORDER BY region;
+
+EXPLAIN (COSTS OFF, VERBOSE, TIMING OFF) EXECUTE prepared_agg_wrapped;
+EXECUTE prepared_agg_wrapped;
+EXECUTE prepared_agg_wrapped;
+EXECUTE prepared_agg_wrapped;
+
+\echo 'Test 1.3: ORDER BY an aggregate'
+PREPARE prepared_agg_order AS
+SELECT rating, COUNT(*), MAX(amount)
+FROM prepared_agg_sales
+WHERE id @@@ pdb.all()
+GROUP BY rating
+ORDER BY MAX(amount) DESC, rating;
+
+EXPLAIN (COSTS OFF, VERBOSE, TIMING OFF) EXECUTE prepared_agg_order;
+EXECUTE prepared_agg_order;
+EXECUTE prepared_agg_order;
+EXECUTE prepared_agg_order;
+
+\echo 'Test 1.4: no GROUP BY, ORDER BY the aggregate'
+PREPARE prepared_agg_scalar AS
+SELECT COUNT(*)
+FROM prepared_agg_sales
+WHERE id @@@ pdb.all()
+ORDER BY COUNT(*);
+
+EXPLAIN (COSTS OFF, VERBOSE, TIMING OFF) EXECUTE prepared_agg_scalar;
+EXECUTE prepared_agg_scalar;
+EXECUTE prepared_agg_scalar;
+EXECUTE prepared_agg_scalar;
+
+\echo 'Test 1.5: pdb.agg()'
+PREPARE prepared_agg_custom AS
+SELECT region, pdb.agg('{"avg": {"field": "amount"}}'::jsonb)
+FROM prepared_agg_sales
+WHERE id @@@ pdb.all()
+GROUP BY region
+ORDER BY region;
+
+EXECUTE prepared_agg_custom;
+EXECUTE prepared_agg_custom;
+EXECUTE prepared_agg_custom;
+
+\echo 'Test 1.6: UNNEST in the GROUP BY'
+PREPARE prepared_agg_unnest AS
+SELECT UNNEST(tags) AS tag, COUNT(*)
+FROM prepared_agg_sales
+WHERE id @@@ pdb.all()
+GROUP BY tag
+ORDER BY tag;
+
+EXPLAIN (COSTS OFF, VERBOSE, TIMING OFF) EXECUTE prepared_agg_unnest;
+EXECUTE prepared_agg_unnest;
+EXECUTE prepared_agg_unnest;
+EXECUTE prepared_agg_unnest;
+
+-- =====================================================================
+-- SECTION 2: Parameters
+-- =====================================================================
+
+\echo 'Test 2.1: generic plan'
+SET plan_cache_mode = force_generic_plan;
+
+PREPARE prepared_agg_param(int) AS
+SELECT region, COUNT(*), SUM(amount)
+FROM prepared_agg_sales
+WHERE rating = $1 AND id @@@ pdb.all()
+GROUP BY region
+ORDER BY region;
+
+EXPLAIN (COSTS OFF, VERBOSE, TIMING OFF) EXECUTE prepared_agg_param(1);
+EXECUTE prepared_agg_param(1);
+EXECUTE prepared_agg_param(2);
+EXECUTE prepared_agg_param(99);
+EXECUTE prepared_agg_param(1);
+
+RESET plan_cache_mode;
+
+\echo 'Test 2.2: default plan cache mode, more runs than PostgreSQL makes custom plans for'
+PREPARE prepared_agg_default(int) AS
+SELECT region, COUNT(*), SUM(amount)
+FROM prepared_agg_sales
+WHERE rating = $1 AND id @@@ pdb.all()
+GROUP BY region
+ORDER BY region;
+
+EXECUTE prepared_agg_default(1);
+EXECUTE prepared_agg_default(2);
+EXECUTE prepared_agg_default(3);
+EXECUTE prepared_agg_default(4);
+EXECUTE prepared_agg_default(1);
+EXECUTE prepared_agg_default(2);
+EXECUTE prepared_agg_default(3);
+EXECUTE prepared_agg_default(4);
+
+-- =====================================================================
+-- SECTION 3: A statement in a function
+-- =====================================================================
+-- PL/pgSQL caches the plan of each statement. The function calls itself in
+-- its loop, so the plan runs again while an earlier run is still open.
+
+CREATE FUNCTION prepared_agg_walk(depth int) RETURNS SETOF text
+LANGUAGE plpgsql AS $$
+DECLARE
+    row record;
+BEGIN
+    FOR row IN
+        SELECT region, COUNT(*) AS count
+        FROM prepared_agg_sales
+        WHERE id @@@ pdb.all()
+        GROUP BY region
+        ORDER BY regio
```

**File**: `tests/tests/aggregate_custom_scan.rs` (modified, +82/-0)
```diff
@@ -17,6 +17,7 @@
 
 // Tests for ParadeDB's Aggregate Custom Scan implementation
 
+use futures::executor::block_on;
 use pretty_assertions::assert_eq;
 use rstest::*;
 use serde_json::Value;
@@ -171,6 +172,87 @@ fn test_count_with_group_by(mut conn: PgConnection) {
     assert_eq!(results[2], (5, 1)); // rating 5, count 1
 }
 
+// PostgreSQL caches the plan of a prepared statement and runs it again. The
+// scan must leave the plan in a state that the next run can use.
+#[rstest]
+fn test_prepared_tantivy_groupby_survives_reuse(mut conn: PgConnection) {
+    SimpleProductsTable::setup().execute(&mut conn);
+
+    "SET paradedb.enable_aggregate_custom_scan TO on;".execute(&mut conn);
+
+    let query = r#"
+        SELECT rating, COUNT(*)
+        FROM paradedb.bm25_search
+        WHERE description @@@ 'shoes'
+        GROUP BY rating
+        ORDER BY rating
+    "#;
+
+    assert_uses_custom_scan(&mut conn, true, query);
+    let (plan,) = format!("EXPLAIN (FORMAT JSON) {query}").fetch_one::<(Value,)>(&mut conn);
+    let plan = plan.to_string();
+    assert!(
+        !plan.contains("DataFusion Physical Plan"),
+        "expected the Tantivy aggregate backend:\n{plan}"
+    );
+
+    let expected: Vec<(i32, i64)> = query.fetch(&mut conn);
+    assert_eq!(expected, vec![(3, 1), (4, 1), (5, 1)]);
+
+    format!("PREPARE group_by_rating AS {query}").execute(&mut conn);
+
+    for _ in 0..8 {
+        let actual: Vec<(i32, i64)> = "EXECUTE group_by_rating".fetch(&mut conn);
+        assert_eq!(actual, expected);
+    }
+}
+
+// A driver sends the parameters apart from the statement. PostgreSQL makes
+// custom plans for the first runs, and then it can change to a cached generic
+// plan.
+#[rstest]
+fn test_bound_parameters_tantivy_groupby_survives_reuse(mut conn: PgConnection) {
+    SimpleProductsTable::setup().execute(&mut conn);
+
+    "SET paradedb.enable_aggregate_custom_scan TO on;".execute(&mut conn);
+
+    // The comment gives each mode its own statement.
+    const AUTO: &str = r#"
+        /* auto */
+        SELECT rating, COUNT(*)
+        FROM paradedb.bm25_search
+        WHERE rating >= $1 AND description @@@ 'shoes'
+        GROUP BY rating
+        ORDER BY rating
+    "#;
+    const FORCE_GENERIC_PLAN: &str = r#"
+        /* force_generic_plan */
+        SELECT rating, COUNT(*)
+        FROM paradedb.bm25_search
+        WHERE rating >= $1 AND description @@@ 'shoes'
+        GROUP BY rating
+        ORDER BY rating
+    "#;
+
+    fn run(conn: &mut PgConnection, query: &'static str, min_rating: i32) -> Vec<(i32, i64)> {
+        block_on(
+            sqlx::query_as::<_, (i32, i64)>(query)
+                .bind(min_rating)
+                .fetch_all(conn),
+        )
+        .expect("the prepared aggregate should run")
+    }
+
+    for (plan_cache_mode, query) in [("auto", AUTO), ("force_generic_plan", FORCE_GENERIC_PLAN)] {
+        format!("SET plan_cache_mode = {plan_cache_mode};").execute(&mut conn);
+        for _ in 0..4 {
+            assert_eq!(run(&mut conn, query, 3), vec![(3, 1), (4, 1), (5, 1)]);
+            assert_eq!(run(&mut conn, query, 4), vec![(4, 1), (5, 1)]);
+            assert_eq!(run(&mut conn, query, 6), vec![]);
+        }
+    }
+}
+
 #[rstest]
 fn test_group_by(mut conn: PgConnection) {
     SimpleProductsTable::setup().execute(&mut conn);
```

---

### Incident Patch 13: `93d455f8` (2026-10-02)
**Commit Message**: fix: include the pattern in regex tokenizer names (#6594)

# Ticket(s) Closed

- Closes #6519

## What

Regex tokenizers now register under a name that includes their pattern,
e.g. `regex_pattern:"[0-9]+"` instead of `regex`. Two
`pdb.regex_pattern` fields with different patterns in one index no
longer share an analyzer.

## Why

`SearchTokenizer::name()` built the regex name from the filters only.
Every regex field with the same filters registered as `regex[...]`, and
the last one registered won. The other fields got indexed and searched
with its pattern, with no error.

## How

- `name()` now includes the pattern, Debug-quoted the way `stopwords`
already is in the filter suffix.
- Existing indexes have the old name in their stored schema. I followed
the `UnicodeWordsDeprecated` / `*LinderaDeprecated` approach: a new
`RegexTokenizerDeprecated` variant, appended at the end of the enum,
produces the old name. `collect_search_tokenizers` registers it right
after each regex tokenizer, in the same order as before, so the last
regex tokenizer with the same filters still owns `regex[...]`. Existing
indexes behave exactly as they did, and a `REINDEX` gives each field its
own pattern.
- At

**File**: `.github/actions/test-pg_search-upgrade/regex_tokenizers/queries.sql` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+SET plpgsql.check_asserts = on;
+-- Exercise immutable segment writes to the existing, legacy-named index.
+SET paradedb.global_mutable_segment_rows = 0;
+
+DO $$
+BEGIN
+    ASSERT NOT EXISTS (
+        SELECT 1 FROM regex_results current
+        FULL JOIN regex_before_upgrade old USING (query)
+        WHERE current.ids IS DISTINCT FROM old.ids
+    ), 'regex query results changed after upgrade';
+    ASSERT NOT EXISTS (
+        SELECT 1 FROM (
+            SELECT name, tokenizer FROM paradedb.schema('regex_patterns_idx')
+            WHERE name IN ('digits', 'letters')
+        ) current
+        FULL JOIN regex_schema_before_upgrade old USING (name)
+        WHERE current.tokenizer IS DISTINCT FROM old.tokenizer
+    ), 'upgrade must preserve the stored legacy tokenizer names';
+END;
+$$;
+
+-- Duplicate row 1's text: every legacy query that matched row 1 must now
+-- match the new row too, and a query that did not match must remain empty.
+INSERT INTO regex_patterns VALUES (4, 'abc123', 'abc123');
+DO $$
+BEGIN
+    ASSERT NOT EXISTS (
+        SELECT 1 FROM regex_results current
+        FULL JOIN regex_before_upgrade old USING (query)
+        WHERE current.ids IS DISTINCT FROM
+            CASE WHEN 1 = ANY(old.ids) THEN old.ids || ARRAY[4] ELSE old.ids END
+    ), 'inserts after upgrade must use the same analyzers as the old index';
+END;
+$$;
+
+REINDEX INDEX regex_patterns_idx;
+DO $$
+BEGIN
+    ASSERT (SELECT count(*) FROM regex_results WHERE ids = ARRAY[1, 4]) = 4,
+        'REINDEX must give both exact and analyzed queries their field-specific patterns';
+    ASSERT (SELECT tokenizer FROM paradedb.schema('regex_patterns_idx') WHERE name = 'digits')
+        = 'regex_pattern:"[0-9]+"[remove_long=64,lowercase=true]',
+        'REINDEX must persist the digits pattern and filters';
+    ASSERT (SELECT tokenizer FROM paradedb.schema('regex_patterns_idx') WHERE name = 'letters')
+        = 'regex_pattern:"[a-z]+"[remove_long=64,lowercase=true]',
+        'REINDEX must persist the letters pattern and filters';
+END;
+$$;
```

**File**: `.github/actions/test-pg_search-upgrade/regex_tokenizers/setup.sql` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+-- Runs on the prior release, including v0.22.0: use its access method and options.
+-- Equal filters intentionally make these patterns collide under the legacy name.
+CREATE TABLE regex_patterns (id INTEGER PRIMARY KEY, digits TEXT, letters TEXT);
+INSERT INTO regex_patterns VALUES
+    (1, 'abc123', 'abc123'),
+    (2, 'def456', 'def456'),
+    (3, 'xyz789', 'xyz789');
+CREATE INDEX regex_patterns_idx ON regex_patterns USING bm25 (id, digits, letters)
+WITH (
+    key_field = 'id',
+    text_fields = '{
+        "digits": {"tokenizer": {"type": "regex", "pattern": "[0-9]+", "lowercase": true, "remove_long": 64}},
+        "letters": {"tokenizer": {"type": "regex", "pattern": "[a-z]+", "lowercase": true, "remove_long": 64}}
+    }'
+);
+
+-- Keep both exact-term and analyzed-query results, rather than assuming which
+-- pattern wins the old registration collision. This view is evaluated again
+-- against the upgraded extension, including rows written after the upgrade.
+CREATE VIEW regex_results AS
+SELECT 'digits_term' AS query, ARRAY(
+    SELECT id FROM regex_patterns WHERE id @@@ paradedb.term('digits', '123') ORDER BY id
+) AS ids
+UNION ALL
+SELECT 'letters_term', ARRAY(
+    SELECT id FROM regex_patterns WHERE id @@@ paradedb.term('letters', 'abc') ORDER BY id
+)
+UNION ALL
+SELECT 'digits_parse', ARRAY(
+    SELECT id FROM regex_patterns WHERE id @@@ 'digits:abc123' ORDER BY id
+)
+UNION ALL
+SELECT 'letters_parse', ARRAY(
+    SELECT id FROM regex_patterns WHERE id @@@ 'letters:abc123' ORDER BY id
+);
+CREATE TABLE regex_before_upgrade AS SELECT * FROM regex_results;
+CREATE TABLE regex_schema_before_upgrade AS
+SELECT name, tokenizer FROM paradedb.schema('regex_patterns_idx')
+WHERE name IN ('digits', 'letters');
+
+SET plpgsql.check_asserts = on;
+DO $$
+BEGIN
+    ASSERT (SELECT count(*) FROM regex_before_upgrade WHERE query LIKE '%_parse' AND ids = ARRAY[1]) = 2,
+        'legacy regex query tokenization must match the original row';
+    ASSERT (SELECT count(*) FROM regex_before_upgrade WHERE query LIKE '%_term' AND ids = ARRAY[1]) = 1,
+        'fixture must reproduce the legacy regex pattern collision';
+    ASSERT (SELECT count(*) FROM regex_schema_before_upgrade WHERE tokenizer LIKE 'regex[%') = 2,
+        'fixture must store legacy regex names with explicit filters';
+END;
+$$;
```

**File**: `docs/project/changelog/unreleased/6594.stability.mdx` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+header: stability
+---
+
+Fixed regex tokenizers with different patterns in one index sharing a single analyzer. The registered tokenizer name left out the pattern, so every `pdb.regex_pattern` field with the same filters was indexed and searched with the pattern of whichever field registered last (#6519). Existing indexes keep their current behavior; `REINDEX` an index that has more than one regex field to index each field with its own pattern.
```

**File**: `pg_search/src/api/tokenizers/mod.rs` (modified, +4/-2)
```diff
@@ -203,7 +203,8 @@ fn apply_expression_params(tokenizer: &mut SearchTokenizer, parsed: &typmod::Par
             }
             *filters = SearchTokenizerFilters::from(parsed);
         }
-        SearchTokenizer::RegexTokenizer { pattern, filters } => {
+        SearchTokenizer::RegexTokenizer { pattern, filters }
+        | SearchTokenizer::RegexTokenizerDeprecated { pattern, filters } => {
             if let Some(Ok(r)) = parsed.try_get("pattern", 0).and_then(|p| p.as_regex()) {
                 *pattern = r.as_str().to_string();
             }
@@ -415,7 +416,8 @@ pub fn apply_typmod(tokenizer: &mut SearchTokenizer, typmod: Typmod) {
             *token_chars = edge_ngram_typmod.token_chars;
             *filters = edge_ngram_typmod.filters;
         }
-        SearchTokenizer::RegexTokenizer { pattern, filters } => {
+        SearchTokenizer::RegexTokenizer { pattern, filters }
+        | SearchTokenizer::RegexTokenizerDeprecated { pattern, filters } => {
             let regex_typmod = RegexTypmod::try_from(typmod).unwrap_or_else(|e| e.report());
             *pattern = regex_typmod.pattern.to_string();
             *filters = regex_typmod.filters;
```

**File**: `pg_search/src/index/search.rs` (modified, +23/-1)
```diff
@@ -136,5 +136,27 @@ fn collect_search_tokenizers(index_relation: &PgSearchRelation) -> Result<Vec<Se
     // In 0.20.0 we changed the default tokenizer from `simple` to `unicode_words`
     tokenizers.push(SearchTokenizer::Simple(SearchTokenizerFilters::default()));
 
-    Ok(tokenizers)
+    Ok(with_regex_legacy_names(tokenizers))
+}
+
+/// Regex tokenizers used to be named without their pattern, so every regex tokenizer with the
+/// same filters registered under one name, and indexes built back then still reference it.
+/// Each regex tokenizer is followed by its old-name twin, in the same order as before, so the
+/// last one still owns the shared name, exactly as when those indexes were built.
+fn with_regex_legacy_names(tokenizers: Vec<SearchTokenizer>) -> Vec<SearchTokenizer> {
+    let mut out = Vec::with_capacity(tokenizers.len());
+    for tokenizer in tokenizers {
+        let legacy = match &tokenizer {
+            SearchTokenizer::RegexTokenizer { pattern, filters } => {
+                Some(SearchTokenizer::RegexTokenizerDeprecated {
+                    pattern: pattern.clone(),
+                    filters: filters.clone(),
+                })
+            }
+            _ => None,
+        };
+        out.push(tokenizer);
+        out.extend(legacy);
+    }
+    out
 }
```

**File**: `pg_search/tests/pg_regress/expected/regex-tokenizer-patterns.out` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+-- Two regex tokenizers with different patterns in one index each keep their own pattern.
+-- Both used to register under the same name, so one field was indexed with the other's pattern.
+DROP TABLE IF EXISTS regex_patterns;
+CREATE TABLE regex_patterns
+(
+    id serial8 not null primary key,
+    t  text
+);
+INSERT INTO regex_patterns (t)
+VALUES ('abc123'), ('def'), ('456');
+CREATE INDEX idx_regex_patterns ON regex_patterns USING paradedb
+    (
+     id,
+     (t::pdb.regex_pattern('[0-9]+', 'alias=digits')),
+     (t::pdb.regex_pattern('[a-z]+', 'alias=letters'))
+        );
+SELECT name, tokenizer FROM paradedb.schema('idx_regex_patterns') WHERE name IN ('digits', 'letters') ORDER BY name;
+  name   |       tokenizer        
+---------+------------------------
+ digits  | regex_pattern:"[0-9]+"
+ letters | regex_pattern:"[a-z]+"
+(2 rows)
+
+SELECT id, t FROM regex_patterns WHERE (t::pdb.regex_pattern('[0-9]+', 'alias=digits')) === '123' ORDER BY id;
+ id |   t    
+----+--------
+  1 | abc123
+(1 row)
+
+SELECT id, t FROM regex_patterns WHERE (t::pdb.regex_pattern('[0-9]+', 'alias=digits')) === '456' ORDER BY id;
+ id |  t  
+----+-----
+  3 | 456
+(1 row)
+
+SELECT id, t FROM regex_patterns WHERE (t::pdb.regex_pattern('[a-z]+', 'alias=letters')) === 'abc' ORDER BY id;
+ id |   t    
+----+--------
+  1 | abc123
+(1 row)
+
+SELECT id, t FROM regex_patterns WHERE (t::pdb.regex_pattern('[a-z]+', 'alias=letters')) === 'def' ORDER BY id;
+ id |  t  
+----+-----
+  2 | def
+(1 row)
+
+-- Query input must be split by the field's analyzer to match its indexed terms.
+SET plpgsql.check_asserts = on;
+DO $$
+BEGIN
+    ASSERT ARRAY(SELECT id FROM regex_patterns
+        WHERE (t::pdb.regex_pattern('[0-9]+', 'alias=digits')) ||| 'abc123' ORDER BY id) = ARRAY[1::bigint],
+        'digits query must extract 123 from abc123';
+    ASSERT ARRAY(SELECT id FROM regex_patterns
+        WHERE (t::pdb.regex_pattern('[a-z]+', 'alias=letters')) ||| 'abc123' ORDER BY id) = ARRAY[1::bigint],
+        'letters query must extract abc from abc123';
+END;
+$$;
+DROP TABLE regex_patterns;
```

**File**: `pg_search/tests/pg_regress/expected/tokenizer-types-in-create-index.out` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ SELECT * FROM paradedb.schema('idxtok_in_ci') ORDER BY name;
  lindera_korean     | Str        | f      | t       | f    | t          |             | korean_lindera_keepwhitespace:false        | position | 
  literal            | Str        | f      | t       | t    | f          |             | keyword[lowercase=false]                   | basic    | raw
  ngram              | Str        | f      | t       | f    | t          |             | ngram_mingram:3_maxgram:5_prefixonly:false | position | 
- regex              | Str        | f      | t       | f    | t          |             | regex                                      | position | 
+ regex              | Str        | f      | t       | f    | t          |             | regex_pattern:"is|a"                       | position | 
  simple             | Str        | f      | t       | f    | t          |             | default                                    | position | 
  source_code        | Str        | f      | t       | f    | t          |             | source_code                                | position | 
  stemmed            | Str        | f      | t       | f    | t          |             | default[stemmer=English]                   | position | 
```

**File**: `pg_search/tests/pg_regress/sql/regex-tokenizer-patterns.sql` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+-- Two regex tokenizers with different patterns in one index each keep their own pattern.
+-- Both used to register under the same name, so one field was indexed with the other's pattern.
+DROP TABLE IF EXISTS regex_patterns;
+
+CREATE TABLE regex_patterns
+(
+    id serial8 not null primary key,
+    t  text
+);
+
+INSERT INTO regex_patterns (t)
+VALUES ('abc123'), ('def'), ('456');
+
+CREATE INDEX idx_regex_patterns ON regex_patterns USING paradedb
+    (
+     id,
+     (t::pdb.regex_pattern('[0-9]+', 'alias=digits')),
+     (t::pdb.regex_pattern('[a-z]+', 'alias=letters'))
+        );
+
+SELECT name, tokenizer FROM paradedb.schema('idx_regex_patterns') WHERE name IN ('digits', 'letters') ORDER BY name;
+
+SELECT id, t FROM regex_patterns WHERE (t::pdb.regex_pattern('[0-9]+', 'alias=digits')) === '123' ORDER BY id;
+SELECT id, t FROM regex_patterns WHERE (t::pdb.regex_pattern('[0-9]+', 'alias=digits')) === '456' ORDER BY id;
+SELECT id, t FROM regex_patterns WHERE (t::pdb.regex_pattern('[a-z]+', 'alias=letters')) === 'abc' ORDER BY id;
+SELECT id, t FROM regex_patterns WHERE (t::pdb.regex_pattern('[a-z]+', 'alias=letters')) === 'def' ORDER BY id;
+
+-- Query input must be split by the field's analyzer to match its indexed terms.
+SET plpgsql.check_asserts = on;
+DO $$
+BEGIN
+    ASSERT ARRAY(SELECT id FROM regex_patterns
+        WHERE (t::pdb.regex_pattern('[0-9]+', 'alias=digits')) ||| 'abc123' ORDER BY id) = ARRAY[1::bigint],
+        'digits query must extract 123 from abc123';
+    ASSERT ARRAY(SELECT id FROM regex_patterns
+        WHERE (t::pdb.regex_pattern('[a-z]+', 'alias=letters')) ||| 'abc123' ORDER BY id) = ARRAY[1::bigint],
+        'letters query must extract abc from abc123';
+END;
+$$;
+
+DROP TABLE regex_patterns;
```

---

### Incident Patch 14: `c1977fd7` (2026-10-02)
**Commit Message**: test: make multi-page garbage collection fixtures deterministic (#6402)

The multi-page linked-item garbage collection test intermittently fails
on PostgreSQL 15 when a background writer pins one of its fake postings
blocks, causing an otherwise dead entry to be deferred.

Use fake file descriptors with `InvalidBlockNumber` only in
`test_linked_items_garbage_collect_multiple_pages`. This exercises the
existing no-pintest-block path and makes deletion and compaction
independent of background writer pins. The test retains its original
one-pass collection calls and assertions. The single-page test and
production code are unchanged; the retry helper and added pinned-entry
test are removed.

Validation: `git diff --check` passes; verified that only the multi-page
test differs from the PR base. Runtime tests were not run locally
because Cargo and PostgreSQL are unavailable; CI validation is pending.

Fixes #6334.

---------

Co-authored-by: Philippe Noël <[REDACTED_EMAIL]>

**File**: `pg_search/src/postgres/storage/linked_items.rs` (modified, +19/-4)
```diff
@@ -819,6 +819,9 @@ mod tests {
         let deleted_xid = pg_sys::FrozenTransactionId;
         let not_deleted_xid = pg_sys::InvalidTransactionId;
 
+        // These fixtures test list deletion and compaction, not buffer-pin deferral.
+        // Keep a file descriptor (required by pintest_blockno), but use an invalid block
+        // number so background writer pins cannot affect the one-pass assertions.
         // Add 2000 entries, delete every 10th entry
         {
             let mut list = LinkedItemList::<SegmentMetaEntry>::create_with_fsm(&indexrel);
@@ -833,7 +836,10 @@ mod tests {
                             not_deleted_xid
                         },
                         SegmentMetaEntryImmutable {
-                            postings: Some(make_fake_postings(&indexrel)),
+                            postings: Some(FileEntry {
+                                starting_block: pg_sys::InvalidBlockNumber,
+                                total_bytes: 0,
+                            }),
                             ..Default::default()
                         },
                     )
@@ -869,7 +875,10 @@ mod tests {
                         0,
                         not_deleted_xid,
                         SegmentMetaEntryImmutable {
-                            postings: Some(make_fake_postings(&indexrel)),
+                            postings: Some(FileEntry {
+                                starting_block: pg_sys::InvalidBlockNumber,
+                                total_bytes: 0,
+                            }),
                             ..Default::default()
                         },
                     )
@@ -884,7 +893,10 @@ mod tests {
                         0,
                         deleted_xid,
                         SegmentMetaEntryImmutable {
-                            postings: Some(make_fake_postings(&indexrel)),
+                            postings: Some(FileEntry {
+                                starting_block: pg_sys::InvalidBlockNumber,
+                                total_bytes: 0,
+                            }),
                             ..Default::default()
                         },
                     )
@@ -899,7 +911,10 @@ mod tests {
                         0,
                         not_deleted_xid,
                         SegmentMetaEntryImmutable {
-                            postings: Some(make_fake_postings(&indexrel)),
+                            postings: Some(FileEntry {
+                                starting_block: pg_sys::InvalidBlockNumber,
+                                total_bytes: 0,
+                            }),
                             ..Default::default()
                         },
                     )
```

---

### Incident Patch 15: `495ccbac` (2026-10-01)
**Commit Message**: fix: build the score and snippet projection one time per scan (#6589)

## Ticket(s) Closed

- Closes #6582

## What

This PR builds the score and snippet projection of the base scan one
time per scan.

A search query that has `pdb.score()` or `pdb.snippet()` together with a
subquery expression, such as `id IN (SELECT ...)`, in its `SELECT` list
or `ORDER BY` crashed the backend.

## Why

The scan wrote the score and the snippets of each row into `Const`
nodes. `ExecBuildProjectionInfo` copies a `Const` by value, so the scan
built the projection again for each row, in per-tuple memory.

Each build ran `ExecInitSubPlan` for every `SubPlan` in the target list.
That appended a new `SubPlanState` to `planstate->subPlan` and new slots
to `es_tupleTable`, and the memory reset of the next row freed them.
Later, the executor walked those lists and read the freed memory. This
gives the `signal 11`, or the `tupdesc reference ... is not owned by
resource owner Portal` error.

In addition, a hashed `SubPlan` built its hash table again for each row.

## How

The placeholders are `OUTER_VAR`s that read from a virtual slot. The
scan fills that slot for each row, and it builds the projection one
ti

**File**: `docs/project/changelog/unreleased/6589.stability.mdx` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+header: stability
+---
+
+Fixed a backend crash (`signal 11`, or a `tupdesc reference ... is not owned by resource owner Portal` error) in a search query that has `pdb.score()` or `pdb.snippet()` together with a subquery expression, such as `id IN (SELECT ...)`, in its `SELECT` list or `ORDER BY`. The scan initialized the subquery again for each row and left freed state behind (#6582). The same applies to an aggregate with such a subquery expression in the same `SELECT` list entry, as in `count(*) IN (SELECT ...)`.
```

**File**: `pg_search/src/postgres/customscan/aggregatescan/mod.rs` (modified, +35/-45)
```diff
@@ -109,7 +109,9 @@ use crate::postgres::customscan::hook::query_has_paradedb_agg;
 use crate::postgres::customscan::joinscan::scan_state::{
     build_physical_plan, build_task_context, clone_task_context_with_config,
 };
-use crate::postgres::customscan::projections::{create_placeholder_targetlist, placeholder_procid};
+use crate::postgres::customscan::projections::{
+    PlaceholderColumns, create_placeholder_targetlist, placeholder_procid,
+};
 use crate::postgres::customscan::solve_expr::SolvePostgresExpressions;
 use crate::postgres::customscan::{CreateUpperPathsHookArgs, CustomScan, range_table};
 use crate::postgres::datetime::PostgresDateTime;
@@ -944,19 +946,24 @@ impl CustomScan for AggregateScan {
                 pg_sys::MakeTupleTableSlot((*planstate).ps_ResultTupleDesc, &pg_sys::TTSOpsVirtual);
             state.custom_state_mut().scan_slot = Some(scan_slot);
 
-            // Set up placeholder targetlist for wrapped aggregate expression projection.
+            // Set up the projection for wrapped aggregate expressions.
             let plan_targetlist = (*(*planstate).plan).targetlist;
             // This creates a copy of the plan's targetlist with FuncExpr placeholders replaced
-            // by Const nodes. The Const nodes will be mutated with actual aggregate values
-            // before each ExecBuildProjectionInfo call in exec_custom_scan (basescan pattern).
-            let (placeholder_tlist, const_nodes, needs_projection) =
-                create_placeholder_targetlist(plan_targetlist);
+            // by Vars. They read the aggregate values that exec_custom_scan writes into the
+            // placeholder columns for each row.
+            let mut columns = PlaceholderColumns::default();
+            let (placeholder_tlist, placeholders, needs_projection) =
+                create_placeholder_targetlist(plan_targetlist, &mut columns);
             if needs_projection && !placeholder_tlist.is_null() {
+                let projection = columns.build_projection(
+                    placeholder_tlist,
+                    planstate,
+                    (*planstate).ps_ResultTupleDesc,
+                );
                 state.custom_state_mut().wrapped_projection = Some(WrappedAggregateProjection {
-                    targetlist: placeholder_tlist,
-                    const_nodes,
+                    projection,
+                    placeholders,
                 });
-                // Note: projection is built per-row in exec_custom_scan, not here
             }
         }
     }
@@ -1817,8 +1824,8 @@ impl AggregateScan {
         row
     }
 
-    /// If `wrapped_projection` is set on the scan state, mutate the
-    /// pre-baked Const nodes with the row's native aggregate values, switch
+    /// If `wrapped_projection` is set on the scan state, write the row's
+    /// native aggregate values into the placeholder columns, switch
     /// into the per-tuple memory context, and `ExecProject` to materialize
     /// the wrapped expressions. Returns the projected slot. When no wrapped
     /// projection is configured, returns the input slot unchanged.
@@ -1829,23 +1836,22 @@ impl AggregateScan {
     ) -> *mut pg_sys::TupleTableSlot {
         // Snapshot the projection state into locals so the immutable borrow
         // on `state.custom_state()` ends before the mutable `state.planstate()`
-        // call below. The targetlist is a raw pointer (Copy) and the const-node
-        // vec is small (one entry per output column).
-        let projection_snapshot: Option<(*mut pg_sys::List, Vec<Option<*mut pg_sys::Const>>)> =
-            state
-                .custom_state()
-                .wrapped_projection
-                .as_ref()
-                .map(|w| (w.targetlist, w.const_nodes.clone()));
-        let Some((placeholder_tlist, const_nodes)) = projection_snapshot else {
+        // call below. The projection is Copy and the placeholder vec is small
+        // (one entry per output column).
+        let projection_snapshot = state
+            .custom_state()
+            .wrapped_projection
+            .as_ref()
+            .map(|w| (w.projection, w.placeholders.clone()));
+        let Some((projection, placeholders)) = projection_snapshot else {
             return slot;
         };
 
         let planstate = state.planstate();
         let expr_context = (*planstate).ps_ExprContext;
 
         // Switch to per-tuple memory context and reset it to avoid memory leaks
-        // from ExecBuildProjectionInfo allocations and wrapper functions
+        // from the wrapper functions
         let mut per_tuple_context = PgMemoryContexts::For((*expr_context).ecxt_per_tuple_memory);
         per_tuple_context.reset();
 
@@ -1855,16 +1861,15 @@ impl AggregateScan {
         let datums = std::slice::from_raw_parts((*slot).tts_values, natts);
         let isnull = std::slice::from_raw_parts((*slot).tts_isnull, natts);
 
-        // Mutate Const nodes with values direct
```

**File**: `pg_search/src/postgres/customscan/aggregatescan/scan_state.rs` (modified, +8/-13)
```diff
@@ -27,6 +27,7 @@ use crate::postgres::customscan::bitmap_intersection::BitmapExec;
 use crate::postgres::customscan::joinscan::build::RelNode;
 use crate::postgres::customscan::mpp::glue::MppLaunchTiming;
 use crate::postgres::customscan::mpp::launch::MppLifecycle;
+use crate::postgres::customscan::projections::{PlaceholderColumn, PlaceholderProjection};
 use crate::postgres::customscan::solve_expr::SolvePostgresExpressions;
 use crate::postgres::heap::VisibilityStats;
 use crate::query::tid_bitmap_stream::BitmapCell;
@@ -113,20 +114,14 @@ pub struct DataFusionAggState {
 ///
 /// When the targetlist contains aggregates wrapped in `FuncExpr` calls, we
 /// build a copy of the targetlist with each `FuncExpr`'s aggregate replaced by
-/// a `Const` placeholder. Before each per-row projection we mutate those
-/// `Const`s in place with the live aggregate values, so the compiled projection
-/// bakes in the current row's values. This follows the basescan pattern.
-///
-/// The `const_nodes` pointers alias into `targetlist`'s memory context — if
-/// the targetlist is freed or replaced, the const pointers become dangling.
-/// Bundling both into one struct keeps the lifetime invariant type-level so
-/// neither half can be cleared without the other.
+/// a placeholder, and project that copy. Before each per-row projection we
+/// write the live aggregate values into the placeholder columns.
 pub struct WrappedAggregateProjection {
-    /// Targetlist copy with `Const` placeholders for each wrapped aggregate.
-    pub targetlist: *mut pg_sys::List,
-    /// Pointers to the `Const` nodes inside `targetlist`, indexed by target
-    /// entry position (0-based). `None` for entries without a Const node.
-    pub const_nodes: Vec<Option<*mut pg_sys::Const>>,
+    /// Projection of the targetlist copy, built one time for the scan.
+    pub projection: PlaceholderProjection,
+    /// The placeholder column and its type, indexed by target entry position
+    /// (0-based). `None` for entries without a placeholder.
+    pub placeholders: Vec<Option<(PlaceholderColumn, pg_sys::Oid)>>,
 }
 
 #[derive(Default)]
```

**File**: `pg_search/src/postgres/customscan/basescan/mod.rs` (modified, +134/-128)
```diff
@@ -56,7 +56,7 @@ use crate::postgres::customscan::basescan::projections::window_agg::{
     WindowAggregateInfo, deserialize_window_agg_placeholders,
     resolve_window_aggregate_filters_at_plan_time,
 };
-use crate::postgres::customscan::basescan::scan_state::BaseScanState;
+use crate::postgres::customscan::basescan::scan_state::{BasePlaceholders, BaseScanState};
 use crate::postgres::customscan::bitmap_intersection;
 use crate::postgres::customscan::builders::custom_path::{
     CustomPathBuilder, ExecMethodType, Flags, RestrictInfoType, restrict_info,
@@ -72,7 +72,9 @@ use crate::postgres::customscan::orderby::{
 use crate::postgres::customscan::parallel::{
     RowEstimate, compute_nworkers, max_useful_workers, segment_view,
 };
-use crate::postgres::customscan::projections::{inject_placeholders, pullout_funcexprs};
+use crate::postgres::customscan::projections::{
+    PlaceholderColumn, PlaceholderColumns, inject_placeholders, pullout_funcexprs,
+};
 use crate::postgres::customscan::qual_inspect::{
     PlannerContext, Qual, QualExtractState, extract_join_predicates, extract_quals, is_subplan,
     optimize_quals_with_heap_expr,
@@ -92,6 +94,7 @@ use crate::postgres::utils::{
 use crate::query::SearchQueryInput;
 use crate::query::pdb_query::pdb;
 use crate::schema::SearchIndexSchema;
+use crate::vector::metric::VectorMetric;
 use crate::{DEFAULT_STARTUP_COST, PARAMETERIZED_SELECTIVITY, UNKNOWN_SELECTIVITY, nodecast};
 use crate::{FULL_RELATION_SELECTIVITY, UNASSIGNED_SELECTIVITY};
 
@@ -231,7 +234,9 @@ impl BaseScan {
         }
 
         unsafe {
-            inject_pdb_placeholders(state);
+            let mut query_context =
+                PgMemoryContexts::For((*state.csstate.ss.ps.state).es_query_cxt);
+            query_context.switch_to(|_| inject_pdb_placeholders(state));
         }
 
         let wrapper_ns = wrapper_start.elapsed().as_nanos() as u64;
@@ -1808,34 +1813,32 @@ impl CustomScan for BaseScan {
                             //
                             // we do need scores or snippets
                             //
-                            // replace their placeholder values and then rebuild the ProjectionInfo
-                            // and project it
+                            // set their placeholder values and project
                             //
 
+                            let placeholders = state
+                                .custom_state()
+                                .placeholders
+                                .as_ref()
+                                .expect("placeholders must be set");
+                            let projection = placeholders.projection;
+
                             let mut per_tuple_context = PgMemoryContexts::For(
                                 (*(*state.projection_info()).pi_exprContext).ecxt_per_tuple_memory,
                             );
                             per_tuple_context.reset();
 
                             if state.custom_state().need_scores() {
-                                let const_score_node = state
-                                    .custom_state()
-                                    .const_score_node
-                                    .expect("const_score_node should be set");
-                                (*const_score_node).constvalue = score.into_datum().unwrap();
-                                (*const_score_node).constisnull = false;
+                                projection.set(placeholders.score, score.into_datum());
                             }
 
                             // Update window aggregate values
                             if let Some(agg_results) =
                                 &state.custom_state().window_aggregate_results
                             {
                                 for (te_idx, datum) in agg_results {
-                                    if let Some(const_node) =
-                                        state.custom_state().const_window_agg_nodes.get(te_idx)
-                                    {
-                                        (**const_node).constvalue = *datum;
-                                        (**const_node).constisnull = false;
+                                    if let Some(column) = placeholders.window_aggs.get(te_idx) {
+                                        projection.set(*column, Some(*datum));
                                     }
                                 }
                             }
@@ -1848,22 +1851,14 @@ impl CustomScan for BaseScan {
                                 // we need during our initial lookup above (but then we'd need to copy
                                 // into the correctly shaped slot for this scan).
                                 let estate = state.csstate.ss.ps.state;
-                                maybe_project_snippets(state.custom_state(), ctid, estate);
-
-                                let planstate = state.planstate();
-
-                          
```

**File**: `pg_search/src/postgres/customscan/basescan/projections/snippet.rs` (modified, +1/-1)
```diff
@@ -136,7 +136,7 @@ fn resolve_tag_or_default(
 // (which contain `ParameterizedValue<String>`) cannot use `resolve_mut` to
 // convert Param → Static in place — mutating a key would corrupt the map.
 // The clean fix is to separate identity (field name + param IDs → key) from
-// mutable config (resolved tags, generator, const nodes → value) into a
+// mutable config (resolved tags, generator, placeholder columns → value) into a
 // single `HashMap<SnippetId, SnippetState>`. Until then, snippet resolution
 // uses `resolve()` (clones per call) instead of `resolve_mut()`.
 #[derive(Debug, Clone, Eq, Hash, PartialEq)]
```

**File**: `pg_search/src/postgres/customscan/basescan/scan_state.rs` (modified, +15/-6)
```diff
@@ -30,6 +30,7 @@ use crate::postgres::customscan::basescan::projections::window_agg::WindowAggreg
 use crate::postgres::customscan::basescan::telemetry::ScanTelemetry;
 use crate::postgres::customscan::bitmap_intersection::BitmapExec;
 use crate::postgres::customscan::builders::custom_path::ExecMethodType;
+use crate::postgres::customscan::projections::{PlaceholderColumn, PlaceholderProjection};
 use crate::postgres::customscan::qual_inspect::Qual;
 use crate::postgres::customscan::solve_expr::SolvePostgresExpressions;
 use crate::postgres::heap::{HeapFetchState, VisibilityChecker};
@@ -89,7 +90,6 @@ pub struct BaseScanState {
     pub quals: Option<Qual>,
 
     pub need_scores: bool,
-    pub const_score_node: Option<*mut pg_sys::Const>,
     pub score_funcoids: [pg_sys::Oid; 2],
 
     /// True when a junk ORDER-BY `embedding <-> query` `OpExpr` in the scan's
@@ -98,19 +98,17 @@ pub struct BaseScanState {
     /// TopK scan already provides the ordering and the column is junk-stripped
     /// — so the placeholder just spares `ExecProject` from calling
     /// `l2_distance(embedding, query)` and detoasting the heap vector. We track
-    /// it only so the projection path knows it must use `placeholder_targetlist`.
+    /// it only so the projection path knows it must use `placeholders`.
     pub vector_distance_placeholder: bool,
 
-    pub const_snippet_nodes: HashMap<SnippetType, Vec<*mut pg_sys::Const>>,
-
     pub snippet_funcoids: [pg_sys::Oid; 2],
     pub snippets_funcoids: [pg_sys::Oid; 2],
     pub snippet_positions_funcoids: [pg_sys::Oid; 2],
 
     pub snippet_generators: HashMap<SnippetType, Option<SnippetGenerator>>,
 
     pub var_attname_lookup: HashMap<(Varno, pg_sys::AttrNumber), FieldName>,
-    pub placeholder_targetlist: Option<*mut pg_sys::List>,
+    pub placeholders: Option<BasePlaceholders>,
 
     // Store join-level search predicates for enhanced scoring/snippet generation
     pub join_predicates: Option<SearchQueryInput>,
@@ -128,12 +126,23 @@ pub struct BaseScanState {
     // Window aggregate support
     pub window_aggregates: Vec<WindowAggregateInfo>,
     pub window_aggregate_results: Option<HashMap<usize, pg_sys::Datum>>,
-    pub const_window_agg_nodes: HashMap<usize, *mut pg_sys::Const>,
 
     exec_method: UnsafeCell<Box<dyn ExecMethod>>,
     exec_method_name: String,
 }
 
+/// The projection that gives a row its score, snippets and window aggregates, and the placeholder
+/// columns it reads them from.
+///
+/// One struct holds them, because the columns are valid only for the slot of this projection.
+pub struct BasePlaceholders {
+    pub projection: PlaceholderProjection,
+    pub score: PlaceholderColumn,
+    pub snippets: HashMap<SnippetType, Vec<PlaceholderColumn>>,
+    /// Indexed by target entry position.
+    pub window_aggs: HashMap<usize, PlaceholderColumn>,
+}
+
 impl CustomScanState for BaseScanState {
     fn init_exec_method(&mut self, cstate: *mut pg_sys::CustomScanState) {
         unsafe {
```

**File**: `pg_search/src/postgres/customscan/hook.rs` (modified, +2/-2)
```diff
@@ -791,10 +791,10 @@ unsafe fn replace_windowfuncs_in_query(
 
 // Helper function to recursively replace WindowFunc nodes in an expression
 //
-// Note: This follows a similar recursive pattern to replace_window_agg_with_const() in mod.rs,
+// Note: This follows a similar recursive pattern to replace_window_agg_with_placeholder() in mod.rs,
 // but operates at a different stage:
 // - This function: Planning stage - replaces WindowFunc → window_agg() placeholder
-// - That function: Execution stage - replaces window_agg() → Const placeholder for value injection
+// - That function: Execution stage - replaces window_agg() → Var placeholder for value injection
 //
 // TODO: This duplication could potentially be eliminated by moving to UPPERREL_WINDOW handling.
 // See https://github.com/paradedb/paradedb/issues/3455
```

**File**: `pg_search/src/postgres/customscan/projections.rs` (modified, +153/-86)
```diff
@@ -56,23 +56,27 @@ pub(crate) fn placeholder_procid() -> pg_sys::Oid {
 ///
 /// This is called AFTER `replace_aggrefs_in_target_list` has replaced Aggrefs with FuncExprs.
 /// It performs two main tasks:
-/// 1. Replaces `pdb.agg_fn` FuncExprs with Const nodes that will be mutated with actual
-///    aggregate values before each `ExecBuildProjectionInfo` call. This follows the basescan
-///    pattern where Const values are baked in when projection is built.
+/// 1. Replaces `pdb.agg_fn` FuncExprs with placeholder Vars that read the aggregate values of
+///    the current row from the slot of a [`PlaceholderProjection`].
 /// 2. Replaces grouping column expressions with `INDEX_VAR` nodes. Because `AggregateScan`
 ///    groups by columns directly in Tantivy, it yields a virtual scan slot with only the
 ///    grouping column and aggregate results (unlike `BaseScan` which yields the heap relation).
 ///    By converting the original base relation Vars into `INDEX_VAR`s, `ExecProject` knows to
 ///    fetch the value from the virtual slot's attributes instead of attempting to evaluate
 ///    the original expressions (which would otherwise fail due to missing base columns).
 ///
-/// Returns: (placeholder_targetlist, const_nodes, needs_projection)
-/// - placeholder_targetlist: target list with FuncExprs replaced by Const nodes and grouping columns converted to `INDEX_VAR`s.
-/// - const_nodes: Vec of Const node pointers for later mutation, indexed by target entry position.
+/// Returns: (placeholder_targetlist, placeholders, needs_projection)
+/// - placeholder_targetlist: target list with FuncExprs replaced by placeholder Vars and grouping columns converted to `INDEX_VAR`s.
+/// - placeholders: the column of `columns` and its type for each placeholder, indexed by target entry position.
 /// - needs_projection: true if projection is needed (e.g., wrapped expressions exist).
 pub(crate) fn create_placeholder_targetlist(
     targetlist: *mut pg_sys::List,
-) -> (*mut pg_sys::List, Vec<Option<*mut pg_sys::Const>>, bool) {
+    columns: &mut PlaceholderColumns,
+) -> (
+    *mut pg_sys::List,
+    Vec<Option<(PlaceholderColumn, pg_sys::Oid)>>,
+    bool,
+) {
     if targetlist.is_null() {
         return (std::ptr::null_mut(), Default::default(), false);
     }
@@ -97,63 +101,64 @@ pub(crate) fn create_placeholder_targetlist(
         return (std::ptr::null_mut(), Default::default(), false);
     }
 
-    // Context for the Const placeholder mutator (defined inside function since only used here)
-    struct ConstPlaceholderContext {
+    // Context for the placeholder mutator (defined inside function since only used here)
+    struct PlaceholderContext<'a> {
         current_te_idx: usize,
         placeholder_funcid: pg_sys::Oid,
-        const_nodes: Vec<Option<*mut pg_sys::Const>>,
+        columns: &'a mut PlaceholderColumns,
+        placeholders: Vec<Option<(PlaceholderColumn, pg_sys::Oid)>>,
     }
 
     #[pg_guard]
-    unsafe extern "C-unwind" fn const_placeholder_mutator(
+    unsafe extern "C-unwind" fn placeholder_mutator(
         node: *mut pg_sys::Node,
         context: *mut core::ffi::c_void,
     ) -> *mut pg_sys::Node {
         if node.is_null() {
             return std::ptr::null_mut();
         }
 
-        let ctx = &mut *(context as *mut ConstPlaceholderContext);
+        let ctx = &mut *(context as *mut PlaceholderContext);
 
-        // If this is our placeholder FuncExpr, replace it with a Const
+        // If this is our placeholder FuncExpr, replace it with a placeholder Var
         if (*node).type_ == pg_sys::NodeTag::T_FuncExpr {
             let funcexpr = node as *mut pg_sys::FuncExpr;
             if (*funcexpr).funcid == ctx.placeholder_funcid {
-                // Create a Const node with NULL value (will be mutated before projection)
-                let const_node = make_placeholder_const_from_funcexpr(funcexpr);
-                // Store the pointer for later mutation
+                let result_type = (*funcexpr).funcresulttype;
+                let (column, var) = ctx.columns.add(result_type, (*funcexpr).funccollid);
                 debug_assert!(
-                    ctx.const_nodes[ctx.current_te_idx].is_none(),
+                    ctx.placeholders[ctx.current_te_idx].is_none(),
                     "AggregateScan supports only one aggregate per target entry"
                 );
-                ctx.const_nodes[ctx.current_te_idx] = Some(const_node);
-                return const_node as *mut pg_sys::Node;
+                ctx.placeholders[ctx.current_te_idx] = Some((column, result_type));
+                return var as *mut pg_sys::Node;
             }
         }
 
         // For all other nodes, use the standard mutator to walk children
         #[cfg(not(any(feature = "pg16", feature = "pg17", feature = "pg18")))]
         {
-            let fnptr = const_placeholder_mutator as *const ();
+            let fnptr = placeholder_mutator as *const ();
          
```

#### Recent Merged Pull Requests:
- **PR #6679** (2026-10-05): fix: respect RLS leaky-qual ordering in filter pushdown (@paradedb-github-bot[bot])
- **PR #6678** (closed): fix: respect RLS leaky-qual ordering in filter pushdown (@paradedb-github-bot[bot])
- **PR #6677** (2026-10-05): fix: honor interrupts while advancing heap filters (@paradedb-github-bot[bot])
- **PR #6676** (closed): fix: Ensure column access is injected in all plan shapes (@paradedb-github-bot[bot])
- **PR #6675** (2026-10-05): fix: Ensure column access is injected in all plan shapes (@stuhood)
- **PR #6672** (2026-10-05): perf: Defer fetching ctids to the top of join plans (@paradedb-github-bot[bot])
- **PR #6671** (2026-10-05): perf: Visibility checking cleanups (@paradedb-github-bot[bot])
- **PR #6670** (2026-10-05): fix: honor interrupts while advancing heap filters (@rebasedming)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
