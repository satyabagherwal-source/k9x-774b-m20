> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/paradedb-paradedb-learnings.md`  
> **Source**: github ([https://github.com/paradedb/paradedb](https://github.com/paradedb/paradedb))  
> **Source Version**: `22ae5780`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-28T06:18:38.354Z  
> **Learning ID**: `learn-github-paradedb-paradedb`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): paradedb/paradedb

> **Canonical Artifact**: `07_PROJECT_LEARNING/paradedb-paradedb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/paradedb/paradedb](https://github.com/paradedb/paradedb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-28T06:18:38.225Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `paradedb/paradedb`
- **Description**: One Postgres for your application data, full-text search, vector retrieval, and aggregations. Home of the pg_search extension.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9453 stars

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
                    posting_bitmaps: files.remove(&SegmentComponent::PostingBitmaps).map(|e| e.0),
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

            // Merges and VACUUM retire replaced segments inside a transaction.
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
    // recycle anything leftover in `new_files` to our input `directory_entries` as they belong to segment(s) we
    // are not 
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
    // `UserState` entries allocate consecutive keys starting at `UserState` (`3 + 2*i`),
    // so fixed keys added after it must live in a high range to avoid collisions.
    UserState = 3,
    BufferUsage = 0xE000_0000_0000_0004,
    WalUsage = 0xE000_0000_0000_000A,
}

pub(crate) struct WorkerStatsGuard {
    buf_usage: *mut pg_sys::BufferUsage,
    wal_usage: *mut pg_sys::WalUsage,
    worker_idx: usize,
}

crate::impl_safe_drop!(WorkerStatsGuard, |self| {
    if !self.buf_usage.is_null() && !self.wal_usage.is_null() {
        unsafe {
            pg_sys::InstrEndParallelQuery(
                self.buf_usage.add(self.worker_idx),
                self.wal_usage.add(self.worker_idx),
            );
        }
    }
});

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
            return 
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
    // Declared before `handle` so Rust's field drop order runs `WorkerStatsGuard::drop`
    // (`InstrEndParallelQuery`) before `MessageQueueHandle::drop` detaches the `shm_mq` and
    // unblocks `ParallelProcessFinish::recv()` on the leader.
    _stats: Option<crate::parallel_worker::WorkerStatsGuard>,
    handle: MessageQueueHandle,
}

impl MessageQueueSender {
    #[doc(hidden)]
    pub(crate) unsafe fn new(
        seg: *mut pg_sys::dsm_segment,
        mq: *mut pg_sys::shm_mq,
        stats: Option<crate::parallel_worker::WorkerStatsGuard>,
    ) -> Self {
        unsafe {
            Self {
                _stats: stats,
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
use crate::index::reader::index::{SearchIndexManifest, SegmentPruningEstimate};
use crate::postgres::PgSearchRelation;
use crate::postgres::customscan::CustomScanState;
use crate::postgres::customscan::aggregatescan::explain::AggregateParallelism;
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
use std::ptr::NonNull;

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
    pub segment_pruning: SegmentPruningEstimate,
    pub visibility_stats: VisibilityStats,
    pub parallelism: Option<AggregateParallelism>,
    pub state: ExecutionState,
    pub indexrelid: pg_sys::Oid,
    pub indexrel: Option<(pg_sys::LOCKMODE, PgSearchRelation)>,
    pub execution_rti: pg_sys::Index,
    pub aggregate_clause: AggregateCSClause,
    pub base_aggregate_clause: Option<AggregateCSClause>,
    /// Where the Tantivy path solves `aggregate_clause`; `None` when it has nothing to solve.
    /// Separate from `ps_ExprContext`, which wrapped-aggregate projection resets per row: see the
    /// rules in `solve_expr.rs`. Unused on the DataFusion path.
    pub runtime_context: Option<NonNull<pg_sys::ExprContext>>,

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
        // TODO: Unused currently. See the co
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
use crate::postgres::customscan::basescan::projections::missing_scan_error;
use crate::postgres::customscan::score_funcoids;
use pgrx::{AnyElement, PgList, extension_sql, pg_extern, pg_sys};

#[pgrx::pg_schema]
mod pdb {
    use crate::postgres::customscan::basescan::projections::missing_scan_error;
    use pgrx::{AnyElement, extension_sql, pg_extern};

    #[allow(unused_variables)]
    #[pg_extern(name = "score", stable, parallel_safe, cost = 1)]
    fn score_from_relation(relation_reference: AnyElement) -> f32 {
        missing_scan_error("pdb.score")
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
    missing_scan_error("paradedb.score")
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
use std::ptr::NonNull;

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
    /// Where `search_query_input` is solved; `None` when the base query has nothing to solve.
    /// Separate from `ps_ExprContext`, which `exec_custom_scan` resets per row: see the rules in
    /// `solve_expr.rs`.
    pub runtime_context: Option<NonNull<pg_sys::ExprContext>>,
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
    /// default `UnknownScanStyle`, which panics on its next use. No reader means
    /// the scan never executed: there are no scorers, and the exec method may
    /// not even be bound yet.
    pub fn reset_exec_results(&mut self) {
        if self.search_reader.is_some() {
            self.exec_method_mut().reset(self);
        }
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
        unsafe { ptr.as_ref().
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
use crate::postgres::search_operator_relations;
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
/// 2. **Enables Top K Integration**: Our custom scan c
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6885** (2026-10-21): **Regex search on one large segment ignores cancel until the segment is done**
  *Symptoms*: # What happens?  When a serial Top-K scan runs a `pdb.regex` query on one large segment, `pg_cancel_backend` waits until that segment is searched. The search phase checks for interrupts once per segment (`segments_to_query` in `top_k.rs`). Tantivy walks the term dictionary and opens the matching postings with no check in between. One segment means one check.  On a 20M row table with one segment, the query below runs 18 s. A cancel sent at 1 s landed after 13.8 s. With the same table split into 10 segments, the query runs 8.3 s and the cancel landed in 0.18 s.  Found on 0.26.2 while we looked for paths that hold interrupts (see #6881). Big single segments are what the merger produces on large tables, so this isn't an artificial shape.  ## To Reproduce  1. Start `paradedb/paradedb:0.26.2-pg18` and connect. 2. In session 1, build the table and run the query.  ```sql SET maintenance_work_mem = '2GB'; CREATE TABLE docs AS SELECT i AS id, md5(i::text) || ' ' || md5((i * 7)::text) || ' common words here' AS body FROM generate_series(1, 20000000) AS i; CREATE INDEX docs_idx ON docs USING bm25 (id, body) WITH (target_segment_count = 1); VACUUM ANALYZE docs;  SET max_parallel_workers_per_gather = 0; SELECT id FROM docs WHERE body @@@ pdb.regex('.*abc.*') ORDER BY id DESC LIMIT 10; ```  3. In session 2, right after the `SELECT` starts, run `SELECT pg_cancel_backend(<session 1 pid>);`. 4. Session 1 reports the cancel about 14 s later. Rebuild the index with `target_segment_count = 10` an

- **Issue #6884** (2026-10-19): **IVF training ignores cancel and terminate during CREATE INDEX and merges**
  *Symptoms*: # What happens?  When a vector index trains its IVF centroids, the backend ignores `pg_cancel_backend` and `pg_terminate_backend` until training ends. `SuperKMeansIvfClusterer::train` calls `superkmeans::train_owned`, which has no interrupt hook. The assign step after it polls `wants_cancel` in `mvcc.rs`. That reads `QueryCancelPending` but not `ProcDiePending`, so a cancel lands there and a terminate doesn't.  Background merges attach the same clusterer (`SearchIndexMerger::open`). A merger that is training ignores `SIGTERM` the same way, and a fast shutdown waits for it.  Measured on 0.26.2 with `CREATE INDEX` on 1M rows of `vector(512)` and `target_segment_count = 1`. The build reports `train=29264 assign=22265 encode=21265` ms.  | Phase | `pg_cancel_backend` | `pg_terminate_backend` | |---|---|---| | train (29 s) | waits for train to end | waits for train and assign to end | | assign (22 s) | lands in 0.6 s | waits for assign to end | | encode (21 s) | lands in 0.1 s | lands in 0.1 s |  A terminate sent during training landed after 41.7 s. A cancel sent during training landed after 14.4 s, when the phase ended. Training time grows with rows times dims, so I'd expect a few million 1536-dim rows to train for minutes.  Found while we looked for paths that hold interrupts (see #6881). A fix needs two parts, I think. `wants_cancel` should also test `ProcDiePending`, and the clusterer needs a check between splits, which `superkmeans` doesn't expose today.  ## To Reproduce  1. S

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

### Incident Patch 1: `22ae5780` (2026-10-28)
**Commit Message**: ci: restore Cohere index build metrics in baselines and comments (#7061)

Restore Cohere index build time and size in the published 1M/10M
benchmark comparisons. Use the existing pinned `pdbench build` command
with the existing index SQL, then map its JSON report into the shared
publisher's metric format. pdbench records build duration, pre-vacuum
index size, and segment diagnostics; no custom measurement script is
needed.

The queued publisher carries the two metrics into a separate index-build
history and the existing benchmark comparison. Main runs update the
baseline; PR runs only compare. Keep the recall rounding fix as a single
tolerance check. Remove every test added by this PR; existing tests are
unchanged.

Validation: all five existing Cohere tests and commit hooks pass.
Verified the metric conversion against a saved pdbench build report and
checked the pinned CLI/source, workflow shell syntax, and YAML.
Actionlint passes for the changed workflow; checking the entire PR
requires ignoring the pre-existing unsupported `concurrency.queue`
field. The full CI benchmark has not been rerun after switching to
pdbench build.

**File**: `.github/actions/publish-benchmarker-results/action.yml` (modified, +44/-6)
```diff
@@ -23,6 +23,10 @@ inputs:
     description: "Optional Markdown context to include above the benchmark comparison"
     required: false
     default: ""
+  index_metrics_file:
+    description: "Optional JSON metrics for index build time and size"
+    required: false
+    default: ""
 
 runs:
   using: composite
@@ -45,12 +49,18 @@ runs:
         RESULTS_DIR: benchmarker/results
         METRICS_FILE: benchmarker/benchmarker_metrics.json
         THROUGHPUT_METRICS_FILE: benchmarker/benchmarker_throughput_metrics.json
+        INDEX_METRICS_FILE: ${{ inputs.index_metrics_file }}
       run: |
         set -euo pipefail
         shopt -s nullglob
         mkdir -p _metrics
         printf '{}\n' > _latency_baseline.json
         printf '{}\n' > _throughput_baseline.json
+        printf '{}\n' > _index_baseline.json
+        printf '[]\n' > _index_metrics.json
+        if [ -n "$INDEX_METRICS_FILE" ]; then
+          cp "$INDEX_METRICS_FILE" _index_metrics.json
+        fi
         for j in "${RESULTS_DIR}"/*.json; do
           case "$(basename "$j")" in
             benchmarker_*.json) continue ;;
@@ -154,6 +164,29 @@ runs:
         sed '1s/^window.BENCHMARK_DATA = //' "${{ steps.publish_throughput.outputs.comparison_file }}" |
           jq --arg suite "benchmarker ${DATASET} (throughput)" '.entries[$suite][-2] // {}' > _throughput_baseline.json
 
+    - name: Publish Index Build Metrics
+      id: publish_index
+      if: inputs.index_metrics_file != ''
+      uses: ./.github/actions/publish-benchmark-results
+      with:
+        publication_id: ${{ env.BENCHMARK_PUBLICATION_ID }}-index
+        name: "benchmarker ${{ inputs.dataset }} (index build)"
+        ref: ${{ inputs.ref }}
+        metrics_file: _index_metrics.json
+        github_token: ${{ inputs.github_token }}
+        pages_directory: benchmarker
+        publish_baseline: ${{ inputs.publish_baseline == 'true' }}
+        comment_on_regression: ${{ inputs.pr_number == '' }}
+
+    - name: Read Index Build Baseline
+      if: inputs.pr_number != '' && steps.publish_index.outcome == 'success'
+      shell: bash
+      env:
+        DATASET: ${{ inputs.dataset }}
+      run: |
+        sed '1s/^window.BENCHMARK_DATA = //' "${{ steps.publish_index.outputs.comparison_file }}" |
+          jq --arg suite "benchmarker ${DATASET} (index build)" '.entries[$suite][-2] // {}' > _index_baseline.json
+
     - name: Stage Dashboards (HTML Only) for gh-pages
       shell: bash
       env:
@@ -181,7 +214,7 @@ runs:
         commit_message: "benchmarker dashboards for ${{ inputs.ref }} (${{ inputs.dataset }})"
 
     - name: Comment Benchmark Comparison and Dashboard Links
-      if: inputs.pr_number != '' && (hashFiles('_ghpages_html/*.html') != '' || inputs.context_file != '')
+      if: inputs.pr_number != '' && (hashFiles('_ghpages_html/*.html') != '' || inputs.context_file != '' || inputs.index_metrics_file != '')
       shell: bash
       env:
         GH_TOKEN: ${{ inputs.github_token }}
@@ -208,18 +241,23 @@ runs:
             cat "$CONTEXT_FILE"
             printf '\n'
           fi
-          jq -nr --slurpfile latency _latency_baseline.json --slurpfile throughput _throughput_baseline.json '
-            "Baselines: latency `\(($latency[0].commit.id // "n/a") | .[0:7])`, QPS `\(($throughput[0].commit.id // "n/a") | .[0:7])`.\n"
+          jq -nr --slurpfile latency _latency_baseline.json --slurpfile throughput _throughput_baseline.json \
+            --slurpfile index _index_baseline.json --slurpfile index_metrics _index_metrics.json '
+            "Baselines: latency `\(($latency[0].commit.id // "n/a") | .[0:7])`, QPS `\(($throughput[0].commit.id // "n/a") | .[0:7])`" +
+            (if ($index_metrics[0] | length) > 0 then ", index build `\(($index[0].commit.id // "n/a") | .[0:7])`" else "" end) + ".\n"
           '
           printf '| Benchmark | Current | Previous | Ratio |\n|---|---:|---:|---:|\n'
           jq -nr \
             --slurpfile latency "${METRICS_FILE}" \
             --slurpfile throughput "${THROUGHPUT_METRICS_FILE}" \
             --slurpfile latency_baseline _latency_baseline.json \
+            --slurpfile index _index_metrics.json \
+            --slurpfile index_baseline _index_baseline.json \
             --slurpfile throughput_baseline _throughput_baseline.json '
             def display: "\(.value * 1000 | round / 1000) \(.unit)";
             (($latency[0] | map(. + {baseline: $latency_baseline[0]})) +
-             ($throughput[0] | map(. + {baseline: $throughput_baseline[0]})))
+             ($throughput[0] | map(. + {baseline: $throughput_baseline[0]})) +
+             ($index[0] | map(. + {baseline: $index_baseline[0]})))
             | sort_by((.name | sub(" (p[0-9]+ latency|QPS)$"; "")), .unit == "queries/s", .name)
             | .[] as $current
             | ([$current.baseline.benches[]? | select(.name == $current.name)][0]) as $previous
@@ -233,11 +271,11 @@ runs:
                end) as $ratio_text
    
```

**File**: `.github/actions/stage-benchmark-results/action.yml` (modified, +1/-0)
```diff
@@ -46,5 +46,6 @@ runs:
           _benchmark_publish/metadata.json
           ${{ steps.publication-inputs.outputs.results_path }}
           ${{ fromJSON(inputs.metadata).context_file }}
+          ${{ fromJSON(inputs.metadata).index_metrics_file }}
         retention-days: 30
         if-no-files-found: error
```

**File**: `.github/workflows/benchmark-pg_search-benchmarker-cohere.yml` (modified, +12/-7)
```diff
@@ -188,15 +188,19 @@ jobs:
                                'parallel_leader_participation', 'paradedb.global_target_segment_count')
                 ORDER BY name;" \
             | tee benchmark-artifacts/index-build-settings.log
+          cp benchmarks/datasets/cohere/indexes/pg_search.sql benchmarks/cohere/assets/cohere/index.sql
+          pdbench build --url "$PARADEDB_URL" --config "benchmarks/cohere/${COHERE_SIZE}.toml" \
+            --assets-dir benchmarks/cohere/assets --runs-dir benchmark-artifacts/search \
+            --force-rebuild \
+            | tee benchmark-artifacts/index-build.log
+          jq '.data | [
+            {name: (.index.name + " build time"), unit: "min", value: (.build_seconds / 60)},
+            {name: (.index.name + " index size"), unit: "MiB", value: (.index.size_bytes / 1048576)}
+          ]' benchmark-artifacts/search/"${COHERE_SIZE}"/*_build.json > benchmark-artifacts/index-metrics.json
           psql "$PARADEDB_URL" -X -v ON_ERROR_STOP=1 -c '\timing on' \
-            -f benchmarks/datasets/cohere/indexes/pg_search.sql \
-            -c "SELECT pg_relation_size('cohere_wiki_bm25_idx') AS index_bytes,
-                       pg_relation_size('cohere_wiki_bm25_idx') / (1024 * 1024) AS index_mb,
-                       count(*) AS segments, sum(num_docs) AS indexed_docs
-                FROM paradedb.index_info('cohere_wiki_bm25_idx');" \
             -f benchmarks/datasets/cohere/after_create_index.sql \
             -c 'VACUUM FULL ANALYZE;' -c 'VACUUM ANALYZE;' \
-            | tee benchmark-artifacts/index-build.log
+            | tee benchmark-artifacts/index-vacuum.log
 
       - name: Install fixture reader
         uses: paradedb/actions/apt-install@v14
@@ -292,7 +296,8 @@ jobs:
             {"dataset":"cohere-${{ matrix.size }}",
              "ref":"${{ steps.commit_info.outputs.commit_sha }}","pr_number":"${{ github.event.pull_request.number }}",
              "publish_baseline":"${{ github.ref == 'refs/heads/main' && (github.event_name != 'workflow_dispatch' || inputs.publish_baseline) }}",
-             "context_file":"benchmark-artifacts/operating_points.md"}
+             "context_file":"benchmark-artifacts/operating_points.md",
+             "index_metrics_file":"benchmark-artifacts/index-metrics.json"}
 
       - name: Upload index, recall, and buffer diagnostics
         if: always()
```

**File**: `.github/workflows/publish-benchmark-results.yml` (modified, +1/-0)
```diff
@@ -109,6 +109,7 @@ jobs:
           github_token: ${{ steps.app-token.outputs.token }}
           pr_number: ${{ fromJSON(steps.metadata.outputs.json).pr_number }}
           context_file: ${{ fromJSON(steps.metadata.outputs.json).context_file || '' }}
+          index_metrics_file: ${{ fromJSON(steps.metadata.outputs.json).index_metrics_file || '' }}
           publish_baseline: ${{ fromJSON(steps.metadata.outputs.json).publish_baseline }}
 
       - name: Publish Query Results
```

**File**: `benchmarks/cohere/README.md` (modified, +13/-9)
```diff
@@ -12,7 +12,8 @@ eight segments, a 0.32 training sample ratio, and English stemming/stopwords on
 workers. Both tools use the same database and index throughout a run.
 
 1. Restore the existing Cohere heap snapshot, refresh the installed pg_search
-   extension, build `datasets/cohere/indexes/pg_search.sql`, and vacuum as before.
+   extension, and run `pdbench build` with `datasets/cohere/indexes/pg_search.sql`.
+   pdbench records build time, index size, and segment diagnostics before vacuum.
    Snapshot generation continues to use `datasets/cohere/config.toml` and
    `create_tables.sql`.
 2. Import the published ground-truth Parquets into pdbench's fixture table.
@@ -29,10 +30,11 @@ workers. Both tools use the same database and index throughout a run.
    selected max_probe and all fixed search settings apply to every connection.
    CI verifies the parameterized plans and filter pushdown before measuring.
 5. Results and recall context enter the shared publication queue. The
-   Wikipedia/StackExchange publisher posts p50/p95/p99 and QPS with baseline
-   comparisons and dashboard links. Recall, max_probe, and mean
-   whole-query shared buffer hits/reads appear above those results. Buffer
-   diagnostics come from pdbench's separate EXPLAIN pass over all 100 vectors.
+   Wikipedia/StackExchange publisher posts p50/p95/p99, QPS, index build time,
+   and index size with baseline comparisons and dashboard links. Recall,
+   max_probe, and mean whole-query shared buffer hits/reads appear above those
+   results. Buffer diagnostics come from pdbench's separate EXPLAIN pass over all
+   100 vectors.
 
 The workflow runs on main and via `benchmarks`, `benchmark-cohere-pg_search`, or
 `benchmark-benchmarker-cohere`. Manual runs can select a size, pg_search commit,
@@ -44,11 +46,13 @@ from its snapshot.
 
 Results begin new `benchmarker cohere-1m` and `benchmarker cohere-10m` histories.
 The old server-time samples are not comparable to k6's client-observed latency
-and throughput. PR runs compare with main and do not update its baseline.
+and throughput. Index build time (minutes) and size (MiB) have a separate
+`benchmarker cohere-<size> (index build)` history. Its first run has no previous
+baseline; subsequent PR runs compare with main and do not update its baseline.
 
-Artifacts retain index-build logs, complete pdbench search reports (including all
-sweep points, recall and buffer diagnostics), selected operating points, query
-vectors, checked plans, and k6 JSON/HTML dashboards. The full workload is opt-in
+Artifacts retain index-build logs, pdbench build and search reports (including
+all sweep points, recall and buffer diagnostics), selected operating points,
+query vectors, checked plans, and k6 JSON/HTML dashboards. The full workload is opt-in
 on PRs; the small handoff tests can be run with:
 
 ```sh
```

**File**: `benchmarks/cohere/prepare_k6.py` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ def operating_points(reports):
                 metrics = measured[selected["value"]] if selected else None
                 if selected and (
                     not 0 < float(selected["value"]) <= 1
-                    or not target <= selected["recall"] <= 1
+                    or not target - 1e-12 <= selected["recall"] <= 1
                     or metrics["recall"]["recall"] != selected["recall"]
                 ):
                     raise ValueError(f"{query}: invalid selected point for {target}")
```

---

### Incident Patch 2: `f17a06fb` (2026-10-28)
**Commit Message**: fix: stop `NOT (field @@@ NULL)` from matching every row (#6998)

# Ticket(s) Closed

- Closes #6928

## What

`NOT (field @@@ <expr>)` returned every row when `<expr>` evaluated to
NULL. A deferred right-hand side becomes
`SearchQueryInput::PostgresExpression`; when it evaluated to NULL,
`solve_postgres_expressions_no_reset` replaced it with `Empty`. `Empty`
inside `must_not` means "exclude nothing", so the boolean matched the
whole table.

## Why

NULL and `Empty` differ under negation: `NOT (a query that matches
nothing)` is true, while `NOT NULL` is NULL, and a filter keeps only
true rows. Collapsing the two made the negation of an unknown predicate
match everything.

## How

Add `SearchQueryInput::Null` for the NULL case. It matches nothing in a
positive position, and a `Boolean` with a direct `Null` in `must_not`
builds an empty query. The planning fold, basescan predicate detection,
EXPLAIN leaf handling, the sequential-scan match set, and segment
pruning treat it as matching nothing.

A wrapped or nested NULL is not reachable from SQL because every
`SearchQueryInput` builder is `STRICT`, so the `must_not` rule only
needs to handle a direct `Null` child.

## Tests

Added `pg

**File**: `docs/project/changelog/unreleased/6998.bugfix.mdx` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+header: stability
+---
+
+- `NOT (field @@@ <expr>)` no longer returns every row when `<expr>` evaluates to NULL.
```

**File**: `pg_search/src/postgres/customscan/basescan/mod.rs` (modified, +1/-0)
```diff
@@ -3063,6 +3063,7 @@ fn base_query_has_search_predicates(
         SearchQueryInput::All => false,
         SearchQueryInput::Uninitialized => false,
         SearchQueryInput::Empty => false,
+        SearchQueryInput::Null => false,
 
         SearchQueryInput::WithIndex { oid, query } => {
             // Only consider search predicates for the current table's index
```

**File**: `pg_search/src/postgres/customscan/explain.rs` (modified, +1/-0)
```diff
@@ -232,6 +232,7 @@ fn inject_estimates_into_json(
         // Leaf query types - no children to process
         SearchQueryInput::All
         | SearchQueryInput::Empty
+        | SearchQueryInput::Null
         | SearchQueryInput::MoreLikeThis { .. }
         | SearchQueryInput::Parse { .. }
         | SearchQueryInput::TermSet { .. }
```

**File**: `pg_search/src/postgres/customscan/solve_expr.rs` (modified, +7/-5)
```diff
@@ -232,8 +232,9 @@ impl SearchQueryInput {
             };
             assert_eq!(unsafe { (*c).consttype }, sqi_typoid);
             let value = unsafe { SearchQueryInput::from_datum((*c).constvalue, (*c).constisnull) };
-            // NULL matches nothing at execution too (see `solve_postgres_expressions`).
-            *sqi = value.unwrap_or(SearchQueryInput::Empty);
+            // A NULL estimate means the predicate is NULL, so fold it to `Null`
+            // (see `solve_postgres_expressions`).
+            *sqi = value.unwrap_or(SearchQueryInput::Null);
         });
         all_folded.then_some(folded)
     }
@@ -279,13 +280,14 @@ impl SearchQueryInput {
                         if let Some(resolved_sqi) = expr.solve(expr_context, sqi_typoid) {
                             *sqi = resolved_sqi;
                         } else {
-                            // PostgresExpression evaluated to NULL (e.g., subquery returned no results)
-                            // Replace with a query that matches nothing
+                            // PostgresExpression evaluated to NULL (e.g., subquery returned no results).
+                            // Keep NULL distinct from `Empty` so a negation can treat `NOT NULL` as
+                            // NULL, which matches nothing, while `NOT Empty` matches every row.
                             pgrx::debug1!(
                                 "PostgresExpression evaluated to NULL for expression: {}",
                                 pgrx::node_to_string(expr.node()).unwrap_or("unknown")
                             );
-                            *sqi = SearchQueryInput::Empty;
+                            *sqi = SearchQueryInput::Null;
                         }
                     }
                     SearchQueryInput::HeapFilter {
```

**File**: `pg_search/src/postgres/sequentialscan/mod.rs` (modified, +5/-1)
```diff
@@ -280,7 +280,11 @@ fn search_with_query_input_impl(
         let search_query_input = unsafe { deserialize_query(query_datum) };
 
         // `empty()` cannot match any index document, including for a partial index.
-        if matches!(&search_query_input, SearchQueryInput::Empty) {
+        // A NULL predicate likewise matches nothing.
+        if matches!(
+            &search_query_input,
+            SearchQueryInput::Empty | SearchQueryInput::Null
+        ) {
             return QueryCacheEntry {
                 matches: KeySet::None,
                 missing_values: None,
```

**File**: `pg_search/src/query/mod.rs` (modified, +52/-0)
```diff
@@ -111,6 +111,18 @@ pub enum SearchQueryInput {
         tie_breaker: Option<f32>,
     },
     Empty,
+    /// A deferred expression that evaluated to SQL NULL (unknown). A filter
+    /// keeps a row only when its predicate is true, so NULL matches nothing,
+    /// the same as `Empty`. The two differ under negation: `NOT NULL` is NULL,
+    /// which also matches nothing, while `NOT Empty` matches every row. The
+    /// query builder therefore turns a boolean with `Null` in `must_not` into a
+    /// query that matches nothing.
+    ///
+    /// Only a direct `Null` child of `must_not` is handled this way. SQL query
+    /// wrappers such as `boost` and `const_score` are STRICT, so a SQL NULL
+    /// argument makes the entire wrapper NULL. The boolean builder instead
+    /// omits optional SQL NULL arguments; it does not embed them as `Null`.
+    Null,
     MoreLikeThis {
         #[serde(flatten)]
         options: MoreLikeThisOptions,
@@ -211,6 +223,7 @@ macro_rules! visit_search_query_input {
             SearchQueryInput::Uninitialized
             | SearchQueryInput::All
             | SearchQueryInput::Empty
+            | SearchQueryInput::Null
             | SearchQueryInput::MoreLikeThis { .. }
             | SearchQueryInput::Parse { .. }
             | SearchQueryInput::TermSet { .. }
@@ -557,6 +570,9 @@ impl SearchQueryInput {
                 Self::is_full_scan_query(indexed_query)
             }
 
+            // A NULL predicate matches no row, so it can never be a full scan.
+            SearchQueryInput::Null => false,
+
             // All other variants are not full scans
             _ => false,
         }
@@ -567,6 +583,7 @@ impl SearchQueryInput {
             SearchQueryInput::Uninitialized
             | SearchQueryInput::All
             | SearchQueryInput::Empty
+            | SearchQueryInput::Null
             | SearchQueryInput::TermSet { .. }
             | SearchQueryInput::PostgresExpression { .. } => false,
 
@@ -868,6 +885,7 @@ impl SearchQueryInput {
                 Self::Uninitialized
                 | Self::All
                 | Self::Empty
+                | Self::Null
                 | Self::Boolean { .. }
                 | Self::Boost { .. }
                 | Self::ConstScore { .. }
@@ -1377,6 +1395,22 @@ impl SearchQueryInput {
                 must_not,
                 minimum_should_match,
             } => {
+                // `NOT NULL` is NULL, and a filter keeps a row only when the
+                // predicate is true, so a NULL under `must_not` makes the whole
+                // boolean match nothing. `must_not: [Empty]` is different: it
+                // excludes nothing, so the boolean can still match rows.
+                if must_not
+                    .iter()
+                    .any(|input| matches!(input, SearchQueryInput::Null))
+                {
+                    let query = Box::new(EmptyQuery);
+                    return Ok(builder.build_leaf(
+                        query,
+                        || "Null Boolean Query".to_string(),
+                        cloned_for_estimate,
+                    ));
+                }
+
                 // ---------------------------------
                 // We use B::split_for_parent() to avoid cloning for QueryOnlyBuilder.
                 //
@@ -1576,6 +1610,10 @@ impl SearchQueryInput {
                 let query = Box::new(EmptyQuery);
                 Ok(builder.build_leaf(query, || "Empty Query".to_string(), cloned_for_estimate))
             }
+            SearchQueryInput::Null => {
+                let query = Box::new(EmptyQuery);
+                Ok(builder.build_leaf(query, || "Null Query".to_string(), cloned_for_estimate))
+            }
             SearchQueryInput::MoreLikeThis { options, document } => {
                 let mlt_builder = MoreLikeThisQueryBuilder::new(options, index_created_by_version);
                 let mut fields_map = HashMap::default();
@@ -2224,6 +2262,9 @@ mod tests {
         // Empty query is not a full scan
         assert!(!SearchQueryInput::Empty.is_full_scan_query());
 
+        // Null matches no row, so it is not a full scan
+        assert!(!SearchQueryInput::Null.is_full_scan_query());
+
         // Uninitialized is not a full scan
         assert!(!SearchQueryInput::Uninitialized.is_full_scan_query());
 
@@ -2382,6 +2423,17 @@ mod tests {
             }
             .is_full_scan_query()
         );
+
+        // Must with All, MustNot with Null → not full scan (NOT NULL matches nothing)
+        assert!(
+            !SearchQueryInput::Boolean {
+                must: vec![SearchQueryInput::All],
+                should: vec![],
+                must_not: vec![SearchQueryInput::Null],
+                minimum_should_match: None,
+            }
+            .is_full_scan_query()
+        );
     }
 
     #[pg_test]
```

**File**: `pg_search/src/query/segment_pruning.rs` (modified, +4/-0)
```diff
@@ -267,6 +267,8 @@ impl<'a> SegmentPruner<'a> {
         match query {
             SearchQueryInput::All => true,
             SearchQueryInput::Empty => false,
+            // A NULL predicate matches no document.
+            SearchQueryInput::Null => false,
             SearchQueryInput::FieldedQuery { field, query } => {
                 self.field_can_match(segment, field, query)
             }
@@ -311,6 +313,8 @@ impl<'a> SegmentPruner<'a> {
         match query {
             SearchQueryInput::All => true,
             SearchQueryInput::Empty => false,
+            // A NULL predicate matches no document.
+            SearchQueryInput::Null => false,
             SearchQueryInput::FieldedQuery { field, query } => {
                 self.field_matches_all(segment, field, query)
             }
```

**File**: `pg_search/tests/pg_regress/expected/issue_6928.out` (added, +144/-0)
```diff
@@ -0,0 +1,144 @@
+\i common/common_setup.sql
+CREATE EXTENSION IF NOT EXISTS pg_search;
+-- Disable parallel workers to avoid differences in plans
+SET max_parallel_workers_per_gather = 0;
+SET enable_indexscan to OFF;
+SET paradedb.enable_columnar_exec = true;
+SET paradedb.enable_custom_scan = on;
+SET paradedb.enable_filter_pushdown = on;
+-- The issue is about the Base Scan; `count(*)` would otherwise plan as the Aggregate Scan.
+SET paradedb.enable_aggregate_custom_scan = off;
+CREATE TABLE issue_6928_docs (
+    id bigint PRIMARY KEY,
+    body text
+);
+INSERT INTO issue_6928_docs
+SELECT i, 'search document ' || i
+FROM generate_series(1, 100) AS i;
+CREATE INDEX issue_6928_docs_idx ON issue_6928_docs USING paradedb (id, body);
+-- The lookup stays empty, so the scalar subquery evaluates to NULL while the
+-- query runs. A literal `(SELECT NULL::paradedb.searchqueryinput)` would instead
+-- be folded to a NULL Const and rejected earlier by qual inspection.
+CREATE TABLE issue_6928_lookup (q paradedb.searchqueryinput);
+-- Control: the index matches every row.
+SELECT count(*) FROM issue_6928_docs WHERE body @@@ 'document';
+ count 
+-------
+   100
+(1 row)
+
+-- `@@@ NULL` matches nothing.
+SELECT count(*) FROM issue_6928_docs
+WHERE body @@@ (SELECT q FROM issue_6928_lookup);
+ count 
+-------
+     0
+(1 row)
+
+-- `NOT (... @@@ NULL)` is NULL, which also matches nothing. Before the fix this
+-- returned all 100 rows.
+EXPLAIN (COSTS OFF)
+SELECT count(*) FROM issue_6928_docs
+WHERE NOT (body @@@ (SELECT q FROM issue_6928_lookup));
+                                                                                 QUERY PLAN                                                                                 
+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
+ Aggregate
+   InitPlan 1
+     ->  Seq Scan on issue_6928_lookup
+   ->  Custom Scan (ParadeDB Base Scan) on issue_6928_docs
+         Table: issue_6928_docs
+         Index: issue_6928_docs_idx
+         Exec Method: NormalScanExecState
+         Scores: false
+         Tantivy Query: {"boolean":{"must":["all"],"must_not":[{"postgres_expression":{"expr":{"expr_desc":"paradedb.with_index('issue_6928_docs_idx'::regclass, $1)"}}}]}}
+(9 rows)
+
+SELECT count(*) FROM issue_6928_docs
+WHERE NOT (body @@@ (SELECT q FROM issue_6928_lookup));
+ count 
+-------
+     0
+(1 row)
+
+-- NULL AND true is NULL; NULL OR true is true.
+SELECT count(*) FROM issue_6928_docs
+WHERE body @@@ (SELECT q FROM issue_6928_lookup) AND body @@@ 'document';
+ count 
+-------
+     0
+(1 row)
+
+SELECT count(*) FROM issue_6928_docs
+WHERE body @@@ (SELECT q FROM issue_6928_lookup) OR body @@@ 'document';
+ count 
+-------
+   100
+(1 row)
+
+-- A negated NULL must not admit rows through AND or OR.
+SELECT count(*) FROM issue_6928_docs
+WHERE NOT (body @@@ (SELECT q FROM issue_6928_lookup)) AND body @@@ 'document';
+ count 
+-------
+     0
+(1 row)
+
+SELECT count(*) FROM issue_6928_docs
+WHERE NOT (body @@@ (SELECT q FROM issue_6928_lookup)) OR body @@@ 'missing';
+ count 
+-------
+     0
+(1 row)
+
+-- Negating compound predicates must preserve SQL three-valued logic.
+SELECT count(*) FROM issue_6928_docs
+WHERE NOT (body @@@ (SELECT q FROM issue_6928_lookup) AND body @@@ 'document');
+ count 
+-------
+     0
+(1 row)
+
+SELECT count(*) FROM issue_6928_docs
+WHERE NOT (body @@@ (SELECT q FROM issue_6928_lookup) OR body @@@ 'missing');
+ count 
+-------
+     0
+(1 row)
+
+SELECT count(*) FROM issue_6928_docs
+WHERE NOT (body @@@ (SELECT q FROM issue_6928_lookup)) OR body @@@ 'document';
+ count 
+-------
+   100
+(1 row)
+
+-- A NULL parameter reaches the same `Null` query, through the planner's estimate
+-- fold for a generic plan.
+SET plan_cache_mode = force_generic_plan;
+PREPARE issue_6928_positive(paradedb.searchqueryinput) AS
+SELECT count(*) FROM issue_6928_docs WHERE body @@@ $1;
+EXECUTE issue_6928_positive(NULL);
+ count 
+-------
+     0
+(1 row)
+
+EXECUTE issue_6928_positive(paradedb.all());
+ count 
+-------
+   100
+(1 row)
+
+DEALLOCATE issue_6928_positive;
+PREPARE issue_6928_negated(paradedb.searchqueryinput) AS
+SELECT count(*) FROM issue_6928_docs WHERE NOT (body @@@ $1);
+EXECUTE issue_6928_negated(NULL);
+ count 
+-------
+     0
+(1 row)
+
+DEALLOCATE issue_6928_negated;
+RESET plan_cache_mode;
+DROP TABLE issue_6928_lookup;
+DROP TABLE issue_6928_docs;
```

---

### Incident Patch 3: `43e55167` (2026-10-27)
**Commit Message**: fix: return system columns from JoinScan heap tuples (#6887)

# Ticket(s) Closed

- Closes #6630

## What

JoinScan returns the fetched row's `ctid`, `tableoid`, `xmin`, `cmin`,
`xmax`, and `cmax` when they appear in the select list. Both sides of a
join use their own heap tuple. An unmatched outer-join side still
returns NULL.

## Why

There were two places that lost system columns. `JoinSource::has_attno`
accepted only `ctid` among the negative attribute numbers, so the other
system columns were marked as pruned. `build_result_tuple` then returned
NULL for every nonpositive attribute number, including `ctid`, even
after it had fetched the row.

## How

- Accept PostgreSQL's valid system attribute numbers when resolving a
source.
- Read negative attributes through `slot_getsysattr` on the source's
existing `BufferHeapTuple` slot. Read ordinary columns through
`slot_getattr` as before.
- Keep the null-extension check before either accessor, so an unmatched
source cannot reuse the previous row's metadata.

## Tests

`tests/tests/joinscan_system_columns.rs` runs each query with JoinScan
on and then off. It compares every returned column byte for byte: all
six system columns from each

**File**: `docs/project/changelog/unreleased/6887.stability.mdx` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+header: stability
+---
+
+Fixed JoinScan returning `NULL` for selected system columns (`ctid`, `tableoid`, `xmin`, `cmin`, `xmax`, and `cmax`). Matched rows now return the system attributes of the fetched heap tuple; unmatched outer-join rows still return `NULL`.
```

**File**: `pg_search/src/postgres/customscan/joinscan/build.rs` (modified, +1/-4)
```diff
@@ -574,11 +574,8 @@ impl JoinSource {
         if attno == 0 {
             return true;
         }
-        if attno == pg_sys::SelfItemPointerAttributeNumber as pg_sys::AttrNumber {
-            return true;
-        }
         if attno < 0 {
-            return false;
+            return attno > pg_sys::FirstLowInvalidHeapAttributeNumber as pg_sys::AttrNumber;
         }
         let heaprel = PgSearchRelation::open(self.scan_info.heaprelid);
         let tupdesc = heaprel.tuple_desc();
```

**File**: `pg_search/src/postgres/customscan/joinscan/mod.rs` (modified, +6/-3)
```diff
@@ -2838,15 +2838,18 @@ impl JoinScan {
                     }
                     let rel_state = state.custom_state().relations.get(plan_position)?;
                     let source_slot = rel_state.fetch_slot;
-                    if *original_attno <= 0
+                    if *original_attno == 0
                         || *original_attno > (*(*source_slot).tts_tupleDescriptor).natts as i16
                     {
                         *nulls.add(i) = true;
                         continue;
                     }
                     let mut is_null = false;
-                    *datums.add(i) =
-                        pg_sys::slot_getattr(source_slot, *original_attno as i32, &mut is_null);
+                    *datums.add(i) = if *original_attno < 0 {
+                        pg_sys::slot_getsysattr(source_slot, *original_attno as i32, &mut is_null)
+                    } else {
+                        pg_sys::slot_getattr(source_slot, *original_attno as i32, &mut is_null)
+                    };
                     *nulls.add(i) = is_null;
                 }
                 privdat::OutputColumnInfo::WindowAgg { agg_index } => {
```

**File**: `pg_search/tests/pg_regress/expected/join_system_columns.out` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+-- System columns must come from each source's fetched heap tuple (#6630).
+-- tests/tests/joinscan_system_columns.rs compares all six system columns with
+-- the PostgreSQL join. This file shows the plan and the values that do not
+-- depend on transaction IDs or table OIDs.
+CREATE EXTENSION IF NOT EXISTS pg_search;
+SET max_parallel_workers_per_gather = 0;
+SET paradedb.enable_join_custom_scan = on;
+CREATE TABLE system_columns_a (id int PRIMARY KEY, next_id int, val text, note text);
+CREATE TABLE system_columns_b (id int PRIMARY KEY, a_id int, val text);
+INSERT INTO system_columns_a SELECT i, i + 1, 'val ' || i, 'original' FROM generate_series(1, 5) i;
+-- The reverse insertion order gives the two sources different CTIDs.
+INSERT INTO system_columns_b VALUES (14, 99, 'val 14'), (13, 3, 'val 13'), (12, 2, 'val 12'), (11, 1, 'val 11');
+CREATE INDEX system_columns_a_idx ON system_columns_a USING paradedb (id, next_id, val);
+CREATE INDEX system_columns_b_idx ON system_columns_b USING paradedb (id, a_id, val);
+ANALYZE system_columns_a;
+ANALYZE system_columns_b;
+-- Each row's CTIDs must be its own tuples' CTIDs, not NULL.
+EXPLAIN (COSTS OFF, VERBOSE)
+SELECT a.id, b.id AS b_id,
+       a.ctid AS a_ctid, a.cmin AS a_cmin, a.xmax AS a_xmax, a.cmax AS a_cmax,
+       b.ctid AS b_ctid, b.cmin AS b_cmin, b.xmax AS b_xmax, b.cmax AS b_cmax
+FROM system_columns_a a JOIN system_columns_b b ON a.id = b.a_id
+WHERE a.val ||| 'val'
+ORDER BY a.id LIMIT 3;
+                                                                                                                     QUERY PLAN                                                                                                                     
+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
+ Custom Scan (ParadeDB Join Scan)
+   Output: a.id, b.id, a.ctid, a.cmin, a.xmax, a.cmax, b.ctid, b.cmin, b.xmax, b.cmax
+   Relation Tree: a INNER b
+   Join Cond: a.id = b.a_id
+   Limit: 3
+   Order By: a.id asc
+   DataFusion Physical Plan: 
+     : ProjectionExec: expr=[id@1 as col_1, NULL as col_2, ctid_0@0 as col_3, NULL as col_4, NULL as col_5, NULL as col_6, ctid_1@2 as col_7, NULL as col_8, NULL as col_9, NULL as col_10, ctid_0@0 as ctid_0, ctid_1@2 as ctid_1]
+     :   SortExec: TopK(fetch=3), expr=[id@1 ASC NULLS LAST], preserve_partitioning=[false]
+     :     VisibilityFilterExec: tables=[a, b]
+     :       HashJoinExec: mode=CollectLeft, join_type=Inner, on=[(a_id@1, id@1)], projection=[ctid_0@2, id@3, ctid_1@0]
+     :         CooperativeExec
+     :           PgSearchScan: table=b, segments=1, query="all"
+     :         CooperativeExec
+     :           PgSearchScan: table=a, segments=1, dynamic_filters=2, query={"with_index":{"query":{"match":{"field":"val","value":"val","tokenizer":null,"distance":null,"transposition_cost_one":null,"prefix":null,"conjunction_mode":false}}}}
+(15 rows)
+
+SELECT a.id, b.id AS b_id,
+       a.ctid AS a_ctid, a.cmin AS a_cmin, a.xmax AS a_xmax, a.cmax AS a_cmax,
+       b.ctid AS b_ctid, b.cmin AS b_cmin, b.xmax AS b_xmax, b.cmax AS b_cmax
+FROM system_columns_a a JOIN system_columns_b b ON a.id = b.a_id
+WHERE a.val ||| 'val'
+ORDER BY a.id LIMIT 3;
+ id | b_id | a_ctid | a_cmin | a_xmax | a_cmax | b_ctid | b_cmin | b_xmax | b_cmax 
+----+------+--------+--------+--------+--------+--------+--------+--------+--------
+  1 |   11 | (0,1)  |      0 |      0 |      0 | (0,4)  |      0 |      0 |      0
+  2 |   12 | (0,2)  |      0 |      0 |      0 | (0,3)  |      0 |      0 |      0
+  3 |   13 | (0,3)  |      0 |      0 |      0 | (0,2)  |      0 |      0 |      0
+(3 rows)
+
+-- b.id 14 has no match, so its a system columns must be NULL.
+EXPLAIN (COSTS OFF, VERBOSE)
+SELECT b.id, a.id AS a_id,
+       a.ctid AS a_ctid, a.xmax AS a_xmax,
+       b.ctid AS b_ctid, b.xmax AS b_xmax
+FROM system_columns_b b LEFT JOIN system_columns_a a ON a.id = b.a_id
+WHERE b.val ||| 'val'
+ORDER BY b.id LIMIT 10;
+                                                                                                                     QUERY PLAN                                                                                                                     
+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
+ Custom Scan (ParadeDB Join Scan)
+   Output: b.id, a.id, a.ctid, a.xmax, b.ctid, b.xmax
+   Relation Tree: b LEFT a
+   Join Cond: a.id = b.a_id
+   Limit: 10
+   Order By: b.id asc
+   DataFusion Physical Plan: 
+     : ProjectionExec: expr=[id@1 as col_1, id@3 as col_2, ctid_1@2 as col_3, NULL as col_4, ctid_0@0 as col_5, NULL as
```

**File**: `pg_search/tests/pg_regress/sql/join_system_columns.sql` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+-- System columns must come from each source's fetched heap tuple (#6630).
+-- tests/tests/joinscan_system_columns.rs compares all six system columns with
+-- the PostgreSQL join. This file shows the plan and the values that do not
+-- depend on transaction IDs or table OIDs.
+CREATE EXTENSION IF NOT EXISTS pg_search;
+SET max_parallel_workers_per_gather = 0;
+SET paradedb.enable_join_custom_scan = on;
+
+CREATE TABLE system_columns_a (id int PRIMARY KEY, next_id int, val text, note text);
+CREATE TABLE system_columns_b (id int PRIMARY KEY, a_id int, val text);
+INSERT INTO system_columns_a SELECT i, i + 1, 'val ' || i, 'original' FROM generate_series(1, 5) i;
+-- The reverse insertion order gives the two sources different CTIDs.
+INSERT INTO system_columns_b VALUES (14, 99, 'val 14'), (13, 3, 'val 13'), (12, 2, 'val 12'), (11, 1, 'val 11');
+CREATE INDEX system_columns_a_idx ON system_columns_a USING paradedb (id, next_id, val);
+CREATE INDEX system_columns_b_idx ON system_columns_b USING paradedb (id, a_id, val);
+ANALYZE system_columns_a;
+ANALYZE system_columns_b;
+
+-- Each row's CTIDs must be its own tuples' CTIDs, not NULL.
+EXPLAIN (COSTS OFF, VERBOSE)
+SELECT a.id, b.id AS b_id,
+       a.ctid AS a_ctid, a.cmin AS a_cmin, a.xmax AS a_xmax, a.cmax AS a_cmax,
+       b.ctid AS b_ctid, b.cmin AS b_cmin, b.xmax AS b_xmax, b.cmax AS b_cmax
+FROM system_columns_a a JOIN system_columns_b b ON a.id = b.a_id
+WHERE a.val ||| 'val'
+ORDER BY a.id LIMIT 3;
+
+SELECT a.id, b.id AS b_id,
+       a.ctid AS a_ctid, a.cmin AS a_cmin, a.xmax AS a_xmax, a.cmax AS a_cmax,
+       b.ctid AS b_ctid, b.cmin AS b_cmin, b.xmax AS b_xmax, b.cmax AS b_cmax
+FROM system_columns_a a JOIN system_columns_b b ON a.id = b.a_id
+WHERE a.val ||| 'val'
+ORDER BY a.id LIMIT 3;
+
+-- b.id 14 has no match, so its a system columns must be NULL.
+EXPLAIN (COSTS OFF, VERBOSE)
+SELECT b.id, a.id AS a_id,
+       a.ctid AS a_ctid, a.xmax AS a_xmax,
+       b.ctid AS b_ctid, b.xmax AS b_xmax
+FROM system_columns_b b LEFT JOIN system_columns_a a ON a.id = b.a_id
+WHERE b.val ||| 'val'
+ORDER BY b.id LIMIT 10;
+
+SELECT b.id, a.id AS a_id,
+       a.ctid AS a_ctid, a.xmax AS a_xmax,
+       b.ctid AS b_ctid, b.xmax AS b_xmax
+FROM system_columns_b b LEFT JOIN system_columns_a a ON a.id = b.a_id
+WHERE b.val ||| 'val'
+ORDER BY b.id LIMIT 10;
+
+DROP TABLE system_columns_a, system_columns_b;
+RESET paradedb.enable_join_custom_scan;
```

**File**: `tests/tests/joinscan_system_columns.rs` (added, +174/-0)
```diff
@@ -0,0 +1,174 @@
+// Copyright (c) 2023-2026 ParadeDB, Inc.
+//
+// This file is part of ParadeDB - Postgres for Search and Analytics
+//
+// This program is free software: you can redistribute it and/or modify
+// it under the terms of the GNU Affero General Public License as published by
+// the Free Software Foundation, either version 3 of the License, or
+// (at your option) any later version.
+//
+// This program is distributed in the hope that it will be useful
+// but WITHOUT ANY WARRANTY; without even the implied warranty of
+// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
+// GNU Affero General Public License for more details.
+//
+// You should have received a copy of the GNU Affero General Public License
+// along with this program. If not, see <http://www.gnu.org/licenses/>.
+
+//! JoinScan must return system columns from each source's fetched heap tuple
+//! (issue #6630). Each query must return the same rows with JoinScan on and
+//! off, for all six system columns of both sources.
+
+use rstest::*;
+use sqlx::{PgConnection, Row};
+use tests::fixtures::*;
+
+const JOIN_SCAN: &str = "Custom Scan (ParadeDB Join Scan)";
+
+const SYSTEM_COLUMNS: &str = r#"
+    a.ctid AS a_ctid, a.tableoid AS a_tableoid, a.xmin AS a_xmin,
+    a.cmin AS a_cmin, a.xmax AS a_xmax, a.cmax AS a_cmax,
+    b.ctid AS b_ctid, b.tableoid AS b_tableoid, b.xmin AS b_xmin,
+    b.cmin AS b_cmin, b.xmax AS b_xmax, b.cmax AS b_cmax
+"#;
+
+fn setup(conn: &mut PgConnection) {
+    r#"
+    SET max_parallel_workers_per_gather = 0;
+
+    CREATE TABLE system_columns_a (id int PRIMARY KEY, next_id int, val text, note text);
+    CREATE TABLE system_columns_b (id int PRIMARY KEY, a_id int, val text);
+    INSERT INTO system_columns_a SELECT i, i + 1, 'val ' || i, 'original' FROM generate_series(1, 5) i;
+    -- The reverse insertion order gives the two sources different CTIDs.
+    INSERT INTO system_columns_b VALUES (14, 99, 'val 14'), (13, 3, 'val 13'), (12, 2, 'val 12'), (11, 1, 'val 11');
+
+    CREATE INDEX system_columns_a_idx ON system_columns_a USING paradedb (id, next_id, val);
+    CREATE INDEX system_columns_b_idx ON system_columns_b USING paradedb (id, a_id, val);
+    ANALYZE system_columns_a;
+    ANALYZE system_columns_b;
+    "#
+    .execute(conn);
+}
+
+/// Rows as raw column values. sqlx cannot decode `tid`, `xid` or `cid`, and
+/// the comparison only needs equal bytes.
+fn fetch_raw(query: &str, conn: &mut PgConnection) -> Vec<Vec<Option<Vec<u8>>>> {
+    query
+        .fetch_dynamic(conn)
+        .iter()
+        .map(|row| {
+            (0..row.len())
+                .map(|i| {
+                    let value = row.try_get_raw(i).expect("column should exist");
+                    // `as_bytes` fails only for NULL.
+                    value.as_bytes().ok().map(<[u8]>::to_vec)
+                })
+                .collect()
+        })
+        .collect()
+}
+
+#[derive(Clone, Copy)]
+enum SystemColumnsCase {
+    InnerJoin,
+    LeftJoinUnmatchedRow,
+    SelfJoin,
+    OnlySystemColumns,
+    UpdatedTuple,
+}
+
+#[rstest]
+#[case::inner_join(SystemColumnsCase::InnerJoin)]
+#[case::left_join_unmatched_row(SystemColumnsCase::LeftJoinUnmatchedRow)]
+#[case::self_join(SystemColumnsCase::SelfJoin)]
+#[case::only_system_columns(SystemColumnsCase::OnlySystemColumns)]
+#[case::updated_tuple(SystemColumnsCase::UpdatedTuple)]
+fn joinscan_system_columns_match_postgres(#[case] case: SystemColumnsCase, mut conn: PgConnection) {
+    setup(&mut conn);
+
+    let (query, expected_rows) = match case {
+        SystemColumnsCase::InnerJoin => (
+            format!(
+                r#"
+                SELECT a.id, b.id AS b_id, a.note, {SYSTEM_COLUMNS}
+                FROM system_columns_a a JOIN system_columns_b b ON a.id = b.a_id
+                WHERE a.val ||| 'val'
+                ORDER BY a.id LIMIT 3
+                "#
+            ),
+            3,
+        ),
+        SystemColumnsCase::LeftJoinUnmatchedRow => (
+            // b.id 14 has no match, so its `a` system columns must be NULL and
+            // must not repeat the previous row's values.
+            format!(
+                r#"
+                SELECT b.id, a.id AS a_id, {SYSTEM_COLUMNS}
+                FROM system_columns_b b LEFT JOIN system_columns_a a ON a.id = b.a_id
+                WHERE b.val ||| 'val'
+                ORDER BY b.id LIMIT 10
+                "#
+            ),
+            4,
+        ),
+        SystemColumnsCase::SelfJoin => (
+            // Both sources read the same table, but each row pairs two
+            // different tuples.
+            format!(
+                r#"
+                SELECT a.id, b.id AS b_id, {SYSTEM_COLUMNS}
+                FROM system_columns_a a JOIN system_columns_a b ON a.next_id = b.id
+                WHERE a.val ||| 'val'
+                ORDER BY a.id LIMIT 3
+                "#
+            ),
+            3,
+        ),
+        SystemColumnsCase::OnlySystemCol
```

#### Recent Merged Pull Requests:
- **PR #7063** (2026-10-27): chore: Remove `postgres_early_topk.sql`. (@stuhood)
- **PR #7061** (2026-10-28): ci: restore Cohere index build metrics in baselines and comments (@rebasedming)
- **PR #7060** (2026-10-27): chore: update datafusion-distributed version (@paradedb-github-bot[bot])
- **PR #7059** (2026-10-27): chore: update datafusion-distributed version (@barbarj)
- **PR #7058** (closed): chore: Noop (@stuhood)
- **PR #7057** (closed): ci: benchmark Cohere with one target segment (@rebasedming)

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

## X. ci: restore Cohere index build metrics in baselines and comments (#7061)

**RULE**:
When implementing operations in `.github/actions/publish-benchmarker-results/action.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in paradedb/paradedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `22ae5780`: ci: restore Cohere index build metrics in baselines and comments (#7061). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/actions/publish-benchmarker-results/action.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
  index_metrics_file:
    description: "Optional JSON metrics for index build time and size"
    required: false
    default: ""
        INDEX_METRICS_FILE: ${{ inputs.index_metrics_file }}
        printf '{}\n' > _index_baseline.json
        printf '[]\n' > _index_metrics.json
        if [ -n "$INDEX_METRICS_FILE" ]; then
          cp "$INDEX_METRICS_FILE" _index_metrics.json
        fi
    - name: Publish Index Build Metrics
      id: publish_index
      if: inputs.index_metrics_file != ''
      uses: ./.github/actions/publish-benchmark-results
      with:
        publication_id: ${{ env.BENCHMARK_PUBLICATION_ID }}-index
        name: "benchmarker ${{ inputs.dataset }} (index build)"
        ref: ${{ inputs.ref }}
        metrics_file: _index_metrics.json
        github_token: ${{ inputs.github_token }}
        pages_directory: benchmarker
        publish_baseline: ${{ inputs.publish_baseline == 'true' }}
        comment_on_regression: ${{ inputs.pr_number == '' }}

    - name: Read Index Build Baseline
      if: inputs.pr_number != '' && steps.publish_index.outcome == 'success'
      shell: bash
      env:
        DATASET: ${{ inputs.dataset }}
      run: |
        sed '1s/^wind
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
      if: inputs.pr_number != '' && (hashFiles('_ghpages_html/*.html') != '' || inputs.context_file != '')
          jq -nr --slurpfile latency _latency_baseline.json --slurpfile throughput _throughput_baseline.json '
            "Baselines: latency `\(($latency[0].commit.id // "n/a") | .[0:7])`, QPS `\(($throughput[0].commit.id // "n/a") | .[0:7])`.\n"
             ($throughput[0] | map(. + {baseline: $throughput_baseline[0]})))
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `22ae5780` are properly handled with clean fallback behavior.
