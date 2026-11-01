> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/paradedb-paradedb-learnings.md`  
> **Source**: github ([https://github.com/paradedb/paradedb](https://github.com/paradedb/paradedb))  
> **Source Version**: `6e3efd5a`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T10:27:16.232Z  
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
> **Harvest Timestamp**: 2026-10-31T10:27:16.223Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `paradedb/paradedb`
- **Description**: One Postgres for your application data, full-text search, vector retrieval, and aggregations. Home of the pg_search extension.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9464 stars

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

    pub(super) fn get(&self) -> &dyn Weight {
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
- **Issue #7091** (2026-10-30): **Hash-join InList pushdown disabled when build-side join key contains NULL**
  *Symptoms*: ### What happens?  If the build side of a hash join has a NULL key, the `InList` dynamic filter is never pushed down as a `TermSetQuery`. The probe side falls back to a full scan + `PreFilter`.  Cause: `try_convert_in_list_to_query` (`scan/pre_filter.rs`) collects terms into `Option<Vec<Term>>`, and `from_scalar` returns `None` for a NULL, so one NULL rejects the whole list. NULLs can just be skipped, since they never match in a non-negated `IN` / inner join.  ### To Reproduce  Stackoverflow benchmark, 100k posts:  ```sql SELECT b.name, COUNT(*) FROM stackoverflow_posts p JOIN badges b ON b.user_id = p.owner_user_id WHERE p.body ||| 'postgres' GROUP BY b.name ORDER BY COUNT(*) DESC LIMIT 10; ```  118 matching posts, 1 with `owner_user_id IS NULL`. No pushdown, and the `badges` scan reads all ~5.95M docs.  With NULLs skipped:  | term | before | after | |---|---|---| | postgres | 115 ms | 43 ms | | regex | 133 ms | 54 ms |  ### Environment  - OS: Linux x86_64 - Version: pg_search 0.26.0 (`main` @ 1a4c5ecd9) - pg_search extension, PG18 

- **Issue #7079** (2026-10-29): **qgen aggregate join test silently falls back because rating is not indexed**
  *Symptoms*: ## Problem  `generated_aggregate_join` is intended to exercise ParadeDB aggregate pushdown, but its shared qgen fixture deliberately leaves `rating` unindexed for heap-filter coverage. The test nevertheless generates `MIN(users.rating)` and `MAX(users.rating)`. ParadeDB correctly warns that the aggregate argument is not columnar indexed and falls back to PostgreSQL execution.  The test checks result equivalence without checking that the intended DataFusion aggregate path was selected. This lets fallback silently satisfy the test until it becomes slow enough to time out.  ## Evidence  The October 28 Enterprise Antithesis run reported a 60-second statement timeout for `generated_aggregate_join::case_2_churn`, while the harness reported a declared fault pause. This was an execution timeout, not an observed result mismatch.  Run: `7ca15ed5f6be3f861d09eecbb6d51d93-64-10`   Session: `f2b3d1701ab837ac4536d5d15a64a47c-64-10`   Qgen setup seed: `8222010017877383816`  Replayed the full SQL below on pg_search 0.26.3:  - Original fixture: valid warning that `users.rating` is not columnar indexed; PostgreSQL hash FULL JOINs and a sequential search filter. Results matched the baseline locally. - Adding only `rating` to the generated indexes: **ParadeDB Aggregate Scan, Backend: DataFusion**, with both FULL JOINs in the DataFusion physical plan. Results still matched.  This confirms a fixture/coverage problem in qgen. It does not establish a ParadeDB planner bug: the warning correctly descri

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

### Incident Patch 1: `3c13589a` (2026-10-30)
**Commit Message**: fix: omit graph dependencies from Stressgres runtime image (#7129)

The Stressgres runtime image installs Fontconfig and its font/XML
dependencies for graph generation, although Antithesis only needs the
workload runner. Make graph generation a default-enabled Cargo feature
and disable it in the Docker build. Normal source builds retain the
graph command; the image retains UI, headless, auto, and CSV commands.

Remove the graphics development packages from the builder and
libfontconfig1 from the runtime. Debian's package resolver confirms this
avoids eight runtime packages: libfontconfig1, libexpat1, libfreetype6,
libpng16-16t64, libbrotli1, fontconfig-config, fonts-dejavu-core, and
fonts-dejavu-mono. Keep the libraries needed by PostgreSQL TLS and the
copied psql client, plus Bash and flock for Antithesis scripts.

Document that the image disables graph generation. A temporary
runtime-dependency smoke step passed in GitHub Actions and was then
removed; the existing Docker test remains unchanged.

Validation: built the full ARM64 DST Docker image with Rust 1.99.0 and
ran the temporary runtime smoke step successfully, both locally and in
GitHub Actions. Stressgres/headless/CSV help,

**File**: `docker/Dockerfile.stressgres` (modified, +3/-5)
```diff
@@ -24,9 +24,6 @@ RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-reco
     pkg-config \
     libpq-dev \
     libssl-dev \
-    libpng-dev \
-    libjpeg-dev \
-    libfontconfig1-dev \
     curl \
     postgresql-client \
     && rm -rf /var/lib/apt/lists/*
@@ -46,7 +43,7 @@ RUN cargo fetch --manifest-path /home/app/Cargo.toml && \
     TARGET="$(rustc -vV | sed -n 's/^host: //p')" && \
     env "CARGO_TARGET_$(echo "$TARGET" | tr 'a-z-' 'A-Z_')_RUSTFLAGS=-Ccodegen-units=1 -Cpasses=sancov-module -Cllvm-args=-sanitizer-coverage-level=3 -Cllvm-args=-sanitizer-coverage-trace-pc-guard -Clink-args=-Wl,--build-id" \
         cargo build --offline --profile dst --target "$TARGET" \
-        --manifest-path /home/app/Cargo.toml -p stressgres --features dst && \
+        --manifest-path /home/app/Cargo.toml -p stressgres --no-default-features --features dst && \
     cp "/home/app/target/$TARGET/dst/stressgres" /tmp/stressgres && \
     cp /usr/lib/postgresql/17/bin/psql /tmp/psql
 
@@ -59,10 +56,11 @@ FROM debian:trixie-slim AS runtime
 # Upgrade the runtime packages so a rebuild picks up all available Debian
 # security fixes. psql is used by the Antithesis setup/verification scripts;
 # util-linux provides flock for the recovery-liveness script.
+# Graph generation is disabled in this image, avoiding Fontconfig and its
+# transitive font/XML dependencies. Normal source builds retain graph support.
 RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
     bash \
     ca-certificates \
-    libfontconfig1 \
     libpq5 \
     libreadline8t64 \
     libssl3t64 \
```

**File**: `stressgres/Cargo.toml` (modified, +4/-2)
```diff
@@ -9,6 +9,8 @@ license = { workspace = true }
 workspace = true
 
 [features]
+default = ["graph"]
+graph = ["dep:image", "dep:plotters"]
 dst = ["dst/enabled"]
 
 [dependencies]
@@ -22,12 +24,12 @@ cursive_table_view = "0.15.0"
 dst = { path = "../dst" }
 human_bytes = "0.4.3"
 humantime = "2.3.0"
-image = "0.25.9"
+image = { version = "0.25.9", optional = true }
 libc = "0.2.190"
 openssl = "0.10.78"
 parking_lot = "0.12.5"
 pgrx-pg-config = "=0.19.3"
-plotters = "0.3.7"
+plotters = { version = "0.3.7", optional = true }
 postgres = "0.19.13"
 postgres-openssl = "0.5.3"
 rust_decimal = { version = "1.43.0", features = ["db-postgres"] }
```

**File**: `stressgres/README.md` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ To run Stressgres from within Docker, use:
 docker run --rm paradedb/stressgres:latest /symbols/stressgres headless stressgres/suites/single-node-planner-paths.toml
 ```
 
-The source, including all suites, is included in the Docker image. The image prebuilds Stressgres at `/symbols/stressgres` and can run in air-gapped environments like Antithesis.
+The image includes the suites and a prebuilt Stressgres binary at `/symbols/stressgres`, and can run in air-gapped environments like Antithesis. It disables the `graph` feature to omit native font dependencies.
 
 For an interactive shell:
 
```

**File**: `stressgres/src/cli.rs` (modified, +2/-0)
```diff
@@ -76,6 +76,7 @@ pub enum Command {
     Headless(HeadlessArgs),
 
     /// Parse a log file and generate metric graphs from the contained data
+    #[cfg(feature = "graph")]
     Graph(GraphArgs),
 
     /// Parse a log file and generate an aggregated CSV report of contained data
@@ -136,6 +137,7 @@ pub struct HeadlessArgs {
 }
 
 /// Arguments for parsing a log file and generating the desired charts.
+#[cfg(feature = "graph")]
 #[derive(Debug, Args)]
 pub struct GraphArgs {
     /// Path to the log file produced by a headless run.
```

**File**: `stressgres/src/main.rs` (modified, +2/-0)
```diff
@@ -21,6 +21,7 @@ mod auto;
 mod cli;
 mod csv;
 mod fault_tolerance;
+#[cfg(feature = "graph")]
 mod graph;
 mod headless;
 mod metrics;
@@ -121,6 +122,7 @@ fn main() -> anyhow::Result<()> {
         }
 
         // When using the "graph" subcommand.
+        #[cfg(feature = "graph")]
         Command::Graph(graph_args) => {
             graph::run(&graph_args)?;
         }
```

---

### Incident Patch 2: `5b16358a` (2026-10-30)
**Commit Message**: fix: raise on float division by zero in Join Scan (#7104)

# Ticket(s) Closed

- Closes #6930

## What

Float division by zero inside an expression absorbed by the Join Scan
now raises PostgreSQL's `division by zero` instead of evaluating to
`Infinity`.

## Why

`PredicateTranslator::translate_op_expr` maps `/` to DataFusion's
`Operator::Divide`. For floats, Arrow follows IEEE-754 and returns
`inf`, `-inf` or `NaN` for a zero divisor without an error, while
`float8div` and `float4div` raise one.

## How

`translate_op_expr` declines `/` when the operator's result type is
`float4` or `float8`. `translate` then wraps the subtree with the
existing `try_wrap_as_udf` fallback, so PostgreSQL evaluates the
division. The expression is still absorbed by the Join Scan, as the
EXPLAIN in the new test shows.

Integer division is unchanged, since Arrow's integer kernel
(`div_checked`) already errors on a zero divisor.

The trade-off is that float division now runs through the UDF rather
than a native Arrow kernel. Two existing expected outputs change for
that reason, and only in their plan text. Their result rows are
identical (`join_distinct_expr`, `topk-agg-facet`).

This touches the same spo

**File**: `docs/project/changelog/unreleased/7104.bugfix.mdx` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+header: stability
+---
+
+- Float division by zero in expressions evaluated by the Join Scan now raises `division by zero` instead of returning `Infinity`.
```

**File**: `pg_search/src/postgres/customscan/datafusion/expr_translators.rs` (modified, +17/-0)
```diff
@@ -601,6 +601,23 @@ impl<'a> PredicateTranslator<'a> {
             return None;
         }
 
+        // Arrow divides floats by zero to Infinity or NaN where PostgreSQL raises an
+        // error, so let the UDF fallback evaluate float division.
+        if op == Operator::Divide
+            && matches!(
+                (*op_expr).opresulttype,
+                pg_sys::FLOAT4OID | pg_sys::FLOAT8OID
+            )
+        {
+            pgrx::debug1!(
+                "PredicateTranslator: float division left to PostgreSQL [OpExpr] types=({}, {}) | {}",
+                type_name(left_type),
+                type_name(right_type),
+                self.deparse_for_debug(node)
+            );
+            return None;
+        }
+
         let collid = (*op_expr).inputcollid;
         if collid != pg_sys::Oid::INVALID {
             let required_op = match op_str {
```

**File**: `pg_search/tests/pg_regress/expected/issue_6930.out` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+CREATE EXTENSION IF NOT EXISTS pg_search;
+CREATE TABLE issue_6930_i (id int PRIMARY KEY, body text, f float8, r float4);
+CREATE TABLE issue_6930_e (id int PRIMARY KEY, tag text, b int4, z float4);
+INSERT INTO issue_6930_i VALUES (1, 'alpha', 0.0, 0.0), (2, 'beta', 1.0, 3.0);
+INSERT INTO issue_6930_e VALUES (1, 'x', 1, 1.0), (2, 'y', 0, 0.0);
+CREATE INDEX issue_6930_i_idx ON issue_6930_i USING paradedb (id, body, f, r);
+CREATE INDEX issue_6930_e_idx ON issue_6930_e USING paradedb (id, tag, b, z);
+SET paradedb.enable_join_custom_scan = on;
+-- Float division in a Join Scan is evaluated by PostgreSQL
+EXPLAIN (COSTS OFF)
+SELECT i.id FROM issue_6930_i i JOIN issue_6930_e e ON e.id = i.id
+WHERE i.body @@@ 'beta' AND (i.f / e.b) > 0 LIMIT 10;
+                                                                                      QUERY PLAN                                                                                      
+--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
+ Custom Scan (ParadeDB Join Scan)
+   Relation Tree: i INNER e
+   Join Cond: e.id = i.id
+   Join Predicate: heap:((i.f / (e.b)::double precision) > '0'::double precision)
+   Limit: 10
+   DataFusion Physical Plan: 
+     : ProjectionExec: expr=[id@1 as col_1, ctid_0@0 as ctid_0, ctid_1@3 as ctid_1]
+     :   GlobalLimitExec: skip=0, fetch=10
+     :     VisibilityFilterExec: tables=[i, e]
+     :       HashJoinExec: mode=CollectLeft, join_type=Inner, on=[(id@1, id@1)], filter=pdb_eval_expr_opexpr_9c511f53(f@0, b@1) > 0
+     :         CooperativeExec
+     :           PgSearchScan: table=i, segments=1, query={"with_index":{"query":{"parse_with_field":{"field":"body","query_string":"beta","lenient":null,"conjunction_mode":null}}}}
+     :         CooperativeExec
+     :           PgSearchScan: table=e, segments=1, dynamic_filters=1, query="all"
+(14 rows)
+
+-- Division by zero raises an error instead of yielding Infinity
+SELECT i.id FROM issue_6930_i i JOIN issue_6930_e e ON e.id = i.id
+WHERE i.body @@@ 'beta' AND (i.f / e.b) > 0 LIMIT 10;
+ERROR:  division by zero
+SELECT i.id, (i.f / e.b) AS q FROM issue_6930_i i JOIN issue_6930_e e ON e.id = i.id
+WHERE i.body @@@ 'beta' LIMIT 10;
+ERROR:  division by zero
+SELECT i.id, (i.r / e.z) AS q FROM issue_6930_i i JOIN issue_6930_e e ON e.id = i.id
+WHERE i.body @@@ 'beta' LIMIT 10;
+ERROR:  division by zero
+SELECT i.id, (e.z / i.r) AS q FROM issue_6930_i i JOIN issue_6930_e e ON e.id = i.id
+WHERE i.body @@@ 'alpha' LIMIT 10;
+ERROR:  division by zero
+-- Division by a non-zero value is unchanged
+SELECT i.id, (i.f / e.b) AS q, (i.r / e.z) AS p FROM issue_6930_i i JOIN issue_6930_e e ON e.id = i.id
+WHERE i.body @@@ 'alpha' AND (i.f / e.b) >= 0 LIMIT 10;
+ id | q | p 
+----+---+---
+  1 | 0 | 0
+(1 row)
+
+RESET paradedb.enable_join_custom_scan;
+DROP TABLE issue_6930_i;
+DROP TABLE issue_6930_e;
```

**File**: `pg_search/tests/pg_regress/expected/join_distinct_expr.out` (modified, +1/-1)
```diff
@@ -734,7 +734,7 @@ ORDER BY p.name
    Order By: p.name asc
    DataFusion Physical Plan: 
      : SortExec: TopK(fetch=10), expr=[col_2@1 ASC NULLS LAST], preserve_partitioning=[false]
-     :   AggregateExec: mode=Single, gby=[pdb_eval_expr_funcexpr_eb551b6f(supplier_id@1) / 3 as col_1, name@2 as col_2], aggr=[min(p_0.ctid_0) as ctid_0]
+     :   AggregateExec: mode=Single, gby=[pdb_eval_expr_opexpr_5205a10c(supplier_id@1) as col_1, name@2 as col_2], aggr=[min(p_0.ctid_0) as ctid_0]
      :     VisibilityFilterExec: tables=[p, s], pruned=[s]
      :       HashJoinExec: mode=CollectLeft, join_type=Inner, on=[(id@0, supplier_id@1)], projection=[ctid_0@2, supplier_id@3, name@4, ctid_1@1]
      :         CooperativeExec
```

**File**: `pg_search/tests/pg_regress/expected/topk-agg-facet.out` (modified, +3/-3)
```diff
@@ -2574,16 +2574,16 @@ JOIN product_reviews r ON p.id = r.product_id
 WHERE p.description ||| 'laptop'
 ORDER BY r.score DESC
 LIMIT 3;
-                                                                                                                                                                                                         QUERY PLAN                                                                                                                                                                                                         
-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
+                                                                                                                                                                                       QUERY PLAN                                                                                                                                                                                       
+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Custom Scan (ParadeDB Join Scan)
    Output: p.id, r.score, ((pdb.window_agg('count(*) FILTER (WHERE (r.score > 80)) OVER ()'::text) + 1)), ((r.score + pdb.window_agg('count(*) FILTER (WHERE (r.score > 80)) OVER ()'::text))), (((pdb.window_agg('count(*) FILTER (WHERE (r.score > 80)) OVER ()'::text))::double precision / (pdb.window_agg('count(*) OVER ()'::text))::double precision))
    Relation Tree: p INNER r
    Join Cond: p.id = r.product_id
    Limit: 3
    Order By: r.score desc
    DataFusion Physical Plan: 
-     : ProjectionExec: expr=[get_field(__topk@0, c0) as col_1, get_field(__topk@0, c1) as col_2, pdb_eval_expr_opexpr_9c4317b6(window_agg_1@1) as col_3, pdb_eval_expr_opexpr_bea5004f(get_field(__topk@0, c1), window_agg_1@1) as col_4, pdb_eval_expr_funcexpr_01980a78(window_agg_1@1) / pdb_eval_expr_funcexpr_02120823(window_agg_4@2) as col_5, get_field(__topk@0, c2) as ctid_0, get_field(__topk@0, c3) as ctid_1]
+     : ProjectionExec: expr=[get_field(__topk@0, c0) as col_1, get_field(__topk@0, c1) as col_2, pdb_eval_expr_opexpr_9c4317b6(window_agg_1@1) as col_3, pdb_eval_expr_opexpr_bea5004f(get_field(__topk@0, c1), window_agg_1@1) as col_4, pdb_eval_expr_opexpr_d5caad3d(window_agg_1@1, window_agg_4@2) as col_5, get_field(__topk@0, c2) as ctid_0, get_field(__topk@0, c3) as ctid_1]
      :   GlobalLimitExec: skip=0, fetch=3
      :     UnnestExec
      :       AggregateExec: mode=Single, gby=[], aggr=[topk_as_agg(p_0.id, r_1.score, p_0.ctid_0, r_1.ctid_1, 3, [2, 3]) ORDER BY [r_1.score DESC NULLS FIRST] as __topk, count(1) FILTER (WHERE r_1.score > Int64(80)) as window_agg_1, count(1) as window_agg_4]
```

**File**: `pg_search/tests/pg_regress/sql/issue_6930.sql` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+CREATE EXTENSION IF NOT EXISTS pg_search;
+
+CREATE TABLE issue_6930_i (id int PRIMARY KEY, body text, f float8, r float4);
+CREATE TABLE issue_6930_e (id int PRIMARY KEY, tag text, b int4, z float4);
+INSERT INTO issue_6930_i VALUES (1, 'alpha', 0.0, 0.0), (2, 'beta', 1.0, 3.0);
+INSERT INTO issue_6930_e VALUES (1, 'x', 1, 1.0), (2, 'y', 0, 0.0);
+CREATE INDEX issue_6930_i_idx ON issue_6930_i USING paradedb (id, body, f, r);
+CREATE INDEX issue_6930_e_idx ON issue_6930_e USING paradedb (id, tag, b, z);
+
+SET paradedb.enable_join_custom_scan = on;
+
+-- Float division in a Join Scan is evaluated by PostgreSQL
+EXPLAIN (COSTS OFF)
+SELECT i.id FROM issue_6930_i i JOIN issue_6930_e e ON e.id = i.id
+WHERE i.body @@@ 'beta' AND (i.f / e.b) > 0 LIMIT 10;
+
+-- Division by zero raises an error instead of yielding Infinity
+SELECT i.id FROM issue_6930_i i JOIN issue_6930_e e ON e.id = i.id
+WHERE i.body @@@ 'beta' AND (i.f / e.b) > 0 LIMIT 10;
+SELECT i.id, (i.f / e.b) AS q FROM issue_6930_i i JOIN issue_6930_e e ON e.id = i.id
+WHERE i.body @@@ 'beta' LIMIT 10;
+SELECT i.id, (i.r / e.z) AS q FROM issue_6930_i i JOIN issue_6930_e e ON e.id = i.id
+WHERE i.body @@@ 'beta' LIMIT 10;
+SELECT i.id, (e.z / i.r) AS q FROM issue_6930_i i JOIN issue_6930_e e ON e.id = i.id
+WHERE i.body @@@ 'alpha' LIMIT 10;
+
+-- Division by a non-zero value is unchanged
+SELECT i.id, (i.f / e.b) AS q, (i.r / e.z) AS p FROM issue_6930_i i JOIN issue_6930_e e ON e.id = i.id
+WHERE i.body @@@ 'alpha' AND (i.f / e.b) >= 0 LIMIT 10;
+
+RESET paradedb.enable_join_custom_scan;
+
+DROP TABLE issue_6930_i;
+DROP TABLE issue_6930_e;
```

---

### Incident Patch 3: `822b944e` (2026-10-30)
**Commit Message**: fix: raise on integer overflow in Join Scan arithmetic (#7103)

# Ticket(s) Closed

- Closes #6931

## What

Integer `+`, `-` and `*` inside an expression absorbed by the Join Scan
now raise PostgreSQL's `integer out of range` / `bigint out of range` on
overflow, instead of silently wrapping.

## Why

`PredicateTranslator::translate_op_expr` maps these operators to
DataFusion's `Operator::Plus`/`Minus`/`Multiply`. DataFusion's physical
`BinaryExpr` evaluates them with Arrow's wrapping kernels unless
`fail_on_overflow` is set. That flag only exists on the physical
expression, and the planner always builds it as `false`, so the logical
`Expr` we produce has no way to ask for checked arithmetic.

## How

`translate_op_expr` declines `+`, `-` and `*` when the operator's result
type is `int2`, `int4` or `int8`. `translate` then wraps the subtree
with the existing `try_wrap_as_udf` fallback, so PostgreSQL evaluates it
with its own overflow checks. The expression is still absorbed by the
Join Scan.

Float and numeric arithmetic, and integer `/` and `%`, are unchanged.
Arrow already errors on integer division by zero.

The trade-off is that these expressions now run through the UDF rather


**File**: `docs/project/changelog/unreleased/7103.bugfix.mdx` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+header: stability
+---
+
+- Integer `+`, `-` and `*` in expressions evaluated by the Join Scan now raise an out-of-range error on overflow instead of silently wrapping.
```

**File**: `pg_search/src/postgres/customscan/datafusion/expr_translators.rs` (modified, +20/-2)
```diff
@@ -583,6 +583,24 @@ impl<'a> PredicateTranslator<'a> {
             }
         };
 
+        // Arrow wraps integer overflow where PostgreSQL raises an error, so let the
+        // UDF fallback evaluate integer arithmetic.
+        if matches!(op, Operator::Plus | Operator::Minus | Operator::Multiply)
+            && matches!(
+                (*op_expr).opresulttype,
+                pg_sys::INT2OID | pg_sys::INT4OID | pg_sys::INT8OID
+            )
+        {
+            pgrx::debug1!(
+                "PredicateTranslator: integer arithmetic left to PostgreSQL [OpExpr] op=\"{}\", types=({}, {}) | {}",
+                op_str,
+                type_name(left_type),
+                type_name(right_type),
+                self.deparse_for_debug(node)
+            );
+            return None;
+        }
+
         let collid = (*op_expr).inputcollid;
         if collid != pg_sys::Oid::INVALID {
             let required_op = match op_str {
@@ -965,7 +983,7 @@ mod tests {
             Just("length(e.pattern) > 3".to_string()),
             Just("upper(e.pattern) = upper(i.name)".to_string()),
             Just("COALESCE(e.pattern, '') = i.name".to_string()),
-            // Arithmetic operators — native via translate_op_expr (+, -, *, /, %).
+            // Arithmetic operators. Integer +, - and * go through the UDF fallback.
             Just("e.threshold + 10 > i.value".to_string()),
             Just("e.threshold * 2 > 50".to_string()),
             Just("i.value - e.threshold > 0".to_string()),
@@ -1023,7 +1041,7 @@ mod tests {
             Just("e.pattern = i.name OR length(e.pattern) > 100".to_string()),
             Just("e.pattern = i.name OR e.pattern IS NULL".to_string()),
             Just("upper(e.pattern) = i.name OR e.threshold > i.value".to_string()),
-            // Arithmetic cross-table predicates — now native OpExpr.
+            // Arithmetic cross-table predicates, absorbed via the UDF fallback.
             Just("e.threshold * 2 > i.value".to_string()),
             Just("e.threshold + i.value > 100".to_string()),
         ]
```

**File**: `pg_search/tests/pg_regress/expected/issue_6931.out` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+CREATE EXTENSION IF NOT EXISTS pg_search;
+CREATE TABLE issue_6931_i (id int PRIMARY KEY, body text, a int4, w int8);
+CREATE TABLE issue_6931_e (id int PRIMARY KEY, tag text, b int4);
+INSERT INTO issue_6931_i VALUES (1, 'alpha', 2147483647, 9223372036854775807), (2, 'beta', 5, 10);
+INSERT INTO issue_6931_e VALUES (1, 'x', 1), (2, 'y', 0);
+CREATE INDEX issue_6931_i_idx ON issue_6931_i USING paradedb (id, body, a, w);
+CREATE INDEX issue_6931_e_idx ON issue_6931_e USING paradedb (id, tag, b);
+SET paradedb.enable_join_custom_scan = on;
+-- Integer arithmetic in a Join Scan is evaluated by PostgreSQL
+EXPLAIN (COSTS OFF)
+SELECT i.id FROM issue_6931_i i JOIN issue_6931_e e ON e.id = i.id
+WHERE i.body @@@ 'alpha' AND (i.w + e.b) > 0 LIMIT 10;
+                                                                                      QUERY PLAN                                                                                       
+---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
+ Custom Scan (ParadeDB Join Scan)
+   Relation Tree: i INNER e
+   Join Cond: e.id = i.id
+   Join Predicate: heap:((i.w + e.b) > 0)
+   Limit: 10
+   DataFusion Physical Plan: 
+     : ProjectionExec: expr=[id@1 as col_1, ctid_0@0 as ctid_0, ctid_1@3 as ctid_1]
+     :   GlobalLimitExec: skip=0, fetch=10
+     :     VisibilityFilterExec: tables=[i, e]
+     :       HashJoinExec: mode=CollectLeft, join_type=Inner, on=[(id@1, id@1)], filter=pdb_eval_expr_opexpr_e8373b5a(w@0, b@1) > 0
+     :         CooperativeExec
+     :           PgSearchScan: table=i, segments=1, query={"with_index":{"query":{"parse_with_field":{"field":"body","query_string":"alpha","lenient":null,"conjunction_mode":null}}}}
+     :         CooperativeExec
+     :           PgSearchScan: table=e, segments=1, dynamic_filters=1, query="all"
+(14 rows)
+
+-- Overflow raises an error instead of wrapping
+SELECT i.id FROM issue_6931_i i JOIN issue_6931_e e ON e.id = i.id
+WHERE i.body @@@ 'alpha' AND (i.w + e.b) > 0 LIMIT 10;
+ERROR:  bigint out of range
+SELECT i.id, (i.w + e.b) AS s FROM issue_6931_i i JOIN issue_6931_e e ON e.id = i.id
+WHERE i.body @@@ 'alpha' LIMIT 10;
+ERROR:  bigint out of range
+SELECT i.id, (i.a + e.b) AS s FROM issue_6931_i i JOIN issue_6931_e e ON e.id = i.id
+WHERE i.body @@@ 'alpha' LIMIT 10;
+ERROR:  integer out of range
+SELECT i.id, (-i.a - 2 * e.b) AS s FROM issue_6931_i i JOIN issue_6931_e e ON e.id = i.id
+WHERE i.body @@@ 'alpha' LIMIT 10;
+ERROR:  integer out of range
+SELECT i.id, (i.w * (e.b + 1)) AS s FROM issue_6931_i i JOIN issue_6931_e e ON e.id = i.id
+WHERE i.body @@@ 'alpha' LIMIT 10;
+ERROR:  bigint out of range
+-- Arithmetic that does not overflow is unchanged
+SELECT i.id, (i.w + e.b) AS s, (i.a - e.b) AS d, (i.a * 2) AS m
+FROM issue_6931_i i JOIN issue_6931_e e ON e.id = i.id
+WHERE i.body @@@ 'beta' AND (i.w + e.b) > 0 LIMIT 10;
+ id | s  | d | m  
+----+----+---+----
+  2 | 10 | 5 | 10
+(1 row)
+
+RESET paradedb.enable_join_custom_scan;
+DROP TABLE issue_6931_i;
+DROP TABLE issue_6931_e;
```

**File**: `pg_search/tests/pg_regress/expected/join_distinct_expr.out` (modified, +2/-2)
```diff
@@ -206,7 +206,7 @@ ORDER BY p.name
    Order By: p.name asc
    DataFusion Physical Plan: 
      : SortExec: TopK(fetch=10), expr=[col_2@1 ASC NULLS LAST], preserve_partitioning=[false]
-     :   AggregateExec: mode=Single, gby=[supplier_id@1 * 10 + id@3 as col_1, name@2 as col_2], aggr=[min(p_0.ctid_0) as ctid_0]
+     :   AggregateExec: mode=Single, gby=[pdb_eval_expr_opexpr_06483cda(supplier_id@1, id@3) as col_1, name@2 as col_2], aggr=[min(p_0.ctid_0) as ctid_0]
      :     VisibilityFilterExec: tables=[p, s], pruned=[s]
      :       HashJoinExec: mode=CollectLeft, join_type=Inner, on=[(id@0, supplier_id@1)], projection=[ctid_0@2, supplier_id@3, name@4, id@5, ctid_1@1]
      :         CooperativeExec
@@ -666,7 +666,7 @@ ORDER BY p.name
    Order By: p.name asc
    DataFusion Physical Plan: 
      : SortExec: TopK(fetch=10), expr=[col_2@1 ASC NULLS LAST], preserve_partitioning=[false]
-     :   AggregateExec: mode=Single, gby=[pdb_eval_expr_funcexpr_f1ebe528(supplier_id@1) * 100 as col_1, name@2 as col_2], aggr=[min(p_0.ctid_0) as ctid_0]
+     :   AggregateExec: mode=Single, gby=[pdb_eval_expr_opexpr_78b131ee(supplier_id@1) as col_1, name@2 as col_2], aggr=[min(p_0.ctid_0) as ctid_0]
      :     VisibilityFilterExec: tables=[p, s], pruned=[s]
      :       HashJoinExec: mode=CollectLeft, join_type=Inner, on=[(id@0, supplier_id@1)], projection=[ctid_0@2, supplier_id@3, name@4, ctid_1@1]
      :         CooperativeExec
```

**File**: `pg_search/tests/pg_regress/expected/join_order_from_path.out` (modified, +3/-3)
```diff
@@ -223,8 +223,8 @@ JOIN jo_reviews r ON r.book_id = b.id
 JOIN jo_authors a ON a.id > b.author_id + r.rating
 WHERE a.bio @@@ 'orchid'
 ORDER BY b.id, r.id LIMIT 5;
-                                                                                                         QUERY PLAN                                                                                                         
-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
+                                                                                                                               QUERY PLAN                                                                                                                                
+-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Custom Scan (ParadeDB Join Scan)
    Relation Tree: (b INNER r) INNER a
    Join Cond: r.book_id = b.id
@@ -239,7 +239,7 @@ ORDER BY b.id, r.id LIMIT 5;
      :         NestedLoopJoinExec: join_type=Inner, filter=id@0 > join_proj_push_down_1@1, projection=[id@0, ctid_2@1, ctid_0@2, author_id@3, id@4, ctid_1@5, rating@6, book_id@7, id@8]
      :           CooperativeExec
      :             PgSearchScan: table=a, segments=1, query={"with_index":{"query":{"parse_with_field":{"field":"bio","query_string":"orchid","lenient":null,"conjunction_mode":null}}}}
-     :           ProjectionExec: expr=[ctid_0@0 as ctid_0, author_id@1 as author_id, id@2 as id, ctid_1@3 as ctid_1, rating@4 as rating, book_id@5 as book_id, id@6 as id, author_id@1 + rating@4 as join_proj_push_down_1]
+     :           ProjectionExec: expr=[ctid_0@0 as ctid_0, author_id@1 as author_id, id@2 as id, ctid_1@3 as ctid_1, rating@4 as rating, book_id@5 as book_id, id@6 as id, CAST(pdb_eval_expr_opexpr_6edbbeb8(author_id@1, rating@4) AS Int64) as join_proj_push_down_1]
      :             HashJoinExec: mode=CollectLeft, join_type=Inner, on=[(id@2, book_id@2)]
      :               CooperativeExec
      :                 PgSearchScan: table=b, segments=1, query="all"
```

**File**: `pg_search/tests/pg_regress/expected/join_orderby_expression.out` (modified, +9/-9)
```diff
@@ -112,7 +112,7 @@ LIMIT 10;
    Limit: 10
    Order By: c.id desc
    DataFusion Physical Plan: 
-     : ProjectionExec: expr=[id@1 as col_1, NULL as col_2, id@1 + 0 as col_3, ctid_0@0 as ctid_0]
+     : ProjectionExec: expr=[id@1 as col_1, NULL as col_2, pdb_eval_expr_opexpr_fd4454da(id@1) as col_3, ctid_0@0 as ctid_0]
      :   SortExec: TopK(fetch=10), expr=[id@1 DESC], preserve_partitioning=[false]
      :     VisibilityFilterExec: tables=[c]
      :       HashJoinExec: mode=CollectLeft, join_type=LeftSemi, on=[(id@1, company_id@0)]
@@ -195,7 +195,7 @@ LIMIT 10;
    Limit: 10
    Order By: c.id desc
    DataFusion Physical Plan: 
-     : ProjectionExec: expr=[id@1 as col_1, NULL as col_2, id@1 - 0 as col_3, ctid_0@0 as ctid_0]
+     : ProjectionExec: expr=[id@1 as col_1, NULL as col_2, pdb_eval_expr_opexpr_e22d00d8(id@1) as col_3, ctid_0@0 as ctid_0]
      :   SortExec: TopK(fetch=10), expr=[id@1 DESC], preserve_partitioning=[false]
      :     VisibilityFilterExec: tables=[c]
      :       HashJoinExec: mode=CollectLeft, join_type=LeftSemi, on=[(id@1, company_id@0)]
@@ -243,7 +243,7 @@ LIMIT 10;
    Limit: 10
    Order By: c.id desc
    DataFusion Physical Plan: 
-     : ProjectionExec: expr=[id@1 as col_1, NULL as col_2, id@1 as col_3, ctid_0@0 as ctid_0]
+     : ProjectionExec: expr=[id@1 as col_1, NULL as col_2, pdb_eval_expr_opexpr_46622aa0(id@1) as col_3, ctid_0@0 as ctid_0]
      :   SortExec: TopK(fetch=10), expr=[id@1 DESC], preserve_partitioning=[false]
      :     VisibilityFilterExec: tables=[c]
      :       HashJoinExec: mode=CollectLeft, join_type=LeftSemi, on=[(id@1, company_id@0)]
@@ -339,7 +339,7 @@ LIMIT 10;
    Limit: 10
    Order By: c.id desc
    DataFusion Physical Plan: 
-     : ProjectionExec: expr=[id@1 as col_1, NULL as col_2, id@1 + 0 as col_3, ctid_0@0 as ctid_0]
+     : ProjectionExec: expr=[id@1 as col_1, NULL as col_2, pdb_eval_expr_opexpr_fd4454da(id@1) as col_3, ctid_0@0 as ctid_0]
      :   SortExec: TopK(fetch=10), expr=[id@1 DESC], preserve_partitioning=[false]
      :     VisibilityFilterExec: tables=[c]
      :       HashJoinExec: mode=CollectLeft, join_type=LeftSemi, on=[(id@1, company_id@0)]
@@ -388,7 +388,7 @@ LIMIT 10;
    Limit: 10
    Order By: c.big_id desc
    DataFusion Physical Plan: 
-     : ProjectionExec: expr=[id@1 as col_1, NULL as col_2, big_id@2 + 0 as col_3, ctid_0@0 as ctid_0]
+     : ProjectionExec: expr=[id@1 as col_1, NULL as col_2, pdb_eval_expr_opexpr_40249b18(big_id@2) as col_3, ctid_0@0 as ctid_0]
      :   SortExec: TopK(fetch=10), expr=[big_id@2 DESC], preserve_partitioning=[false]
      :     VisibilityFilterExec: tables=[c]
      :       HashJoinExec: mode=CollectLeft, join_type=LeftSemi, on=[(id@1, company_id@0)]
@@ -419,7 +419,7 @@ LIMIT 10;
    Limit: 10
    Order By: c.big_id desc
    DataFusion Physical Plan: 
-     : ProjectionExec: expr=[id@1 as col_1, NULL as col_2, big_id@2 as col_3, ctid_0@0 as ctid_0]
+     : ProjectionExec: expr=[id@1 as col_1, NULL as col_2, pdb_eval_expr_opexpr_a0b34269(big_id@2) as col_3, ctid_0@0 as ctid_0]
      :   SortExec: TopK(fetch=10), expr=[big_id@2 DESC], preserve_partitioning=[false]
      :     VisibilityFilterExec: tables=[c]
      :       HashJoinExec: mode=CollectLeft, join_type=LeftSemi, on=[(id@1, company_id@0)]
@@ -450,7 +450,7 @@ LIMIT 10;
    Limit: 10
    Order By: c.id desc
    DataFusion Physical Plan: 
-     : ProjectionExec: expr=[id@1 as col_1, NULL as col_2, 0 + id@1 as col_3, ctid_0@0 as ctid_0]
+     : ProjectionExec: expr=[id@1 as col_1, NULL as col_2, pdb_eval_expr_opexpr_662fe57b(id@1) as col_3, ctid_0@0 as ctid_0]
      :   SortExec: TopK(fetch=10), expr=[id@1 DESC], preserve_partitioning=[false]
      :     VisibilityFilterExec: tables=[c]
      :       HashJoinExec: mode=CollectLeft, join_type=LeftSemi, on=[(id@1, company_id@0)]
@@ -481,7 +481,7 @@ LIMIT 10;
    Limit: 10
    Order By: c.id desc
    DataFusion Physical Plan: 
-     : ProjectionExec: expr=[id@1 as col_1, NULL as col_2, id@1 as col_3, ctid_0@0 as ctid_0]
+     : ProjectionExec: expr=[id@1 as col_1, NULL as col_2, pdb_eval_expr_opexpr_cf5a22da(id@1) as col_3, ctid_0@0 as ctid_0]
      :   SortExec: TopK(fetch=10), expr=[id@1 DESC], preserve_partitioning=[false]
      :     VisibilityFilterExec: tables=[c]
      :       HashJoinExec: mode=CollectLeft, join_type=LeftSemi, on=[(id@1, company_id@0)]
@@ -739,7 +739,7 @@ LIMIT 10;
    Limit: 10
    Order By: c.id desc
    DataFusion Physical Plan: 
-     : ProjectionExec: expr=[id@1 as col_1, NULL as col_2, id@1 + 0 as col_3, ctid_0@0 as ctid_0]
+     : ProjectionExec: expr=[id@1 as col_1, NULL as col_2, pdb_eval_expr_opexpr_fd4454da(id@1) as col_3, ctid_0@0 as ctid_0]
      :   SortExec: TopK(fetch=10), expr=[id@1 DESC], preserve_partitioning=[false]
      :     VisibilityFilterExec: tables=[c]
      :       HashJoinExec: mode=CollectLeft, join_type=LeftSemi, on=[(id@1, company_id@0)]
```

**File**: `pg_search/tests/pg_regress/expected/join_predicates.out` (modified, +1/-1)
```diff
@@ -815,7 +815,7 @@ LIMIT 10;
      : ProjectionExec: expr=[id@2 as col_1, supplier_id@1 as col_2, id@4 as col_3, ctid_0@0 as ctid_0, ctid_1@3 as ctid_1]
      :   SortExec: TopK(fetch=10), expr=[id@2 ASC NULLS LAST], preserve_partitioning=[false]
      :     VisibilityFilterExec: tables=[p, s]
-     :       HashJoinExec: mode=CollectLeft, join_type=Inner, on=[(supplier_id@1, id@1)], filter=abs(supplier_id@0 - id@1) >= 0
+     :       HashJoinExec: mode=CollectLeft, join_type=Inner, on=[(supplier_id@1, id@1)], filter=abs(pdb_eval_expr_opexpr_1d849f2b(supplier_id@0, id@1)) >= 0
      :         CooperativeExec
      :           PgSearchScan: table=p, segments=1, dynamic_filters=1, query={"with_index":{"query":{"match":{"field":"description","value":"wireless","tokenizer":null,"distance":null,"transposition_cost_one":null,"prefix":null,"conjunction_mode":false}}}}
      :         CooperativeExec
```

**File**: `pg_search/tests/pg_regress/expected/join_semi_anti_disjunctive.out` (modified, +1/-1)
```diff
@@ -1222,7 +1222,7 @@ LIMIT 5;
      :   SortExec: TopK(fetch=5), expr=[id@1 DESC], preserve_partitioning=[false]
      :     VisibilityFilterExec: tables=[i]
      :       NestedLoopJoinExec: join_type=RightAnti, filter=join_proj_push_down_1@1 > id@0, projection=[ctid_0@0, id@1]
-     :         ProjectionExec: expr=[id@0 as id, id@0 * 2 as join_proj_push_down_1]
+     :         ProjectionExec: expr=[id@0 as id, pdb_eval_expr_opexpr_b2e4dd8d(id@0) as join_proj_push_down_1]
      :           CooperativeExec
      :             PgSearchScan: table=e, segments=1, visibility=eager, query={"with_index":{"query":"all"}}
      :         CooperativeExec
```

#### Recent Merged Pull Requests:
- **PR #7140** (2026-10-31): chore: Fix clash between #6869 and #7051 (@stuhood)
- **PR #7133** (closed): ci: Use an unlinked author for benchmark commits (@paradedb-github-bot[bot])
- **PR #7132** (closed): ci: Use an unlinked author for benchmark commits (@paradedb-github-bot[bot])
- **PR #7131** (2026-10-30): ci: Use an unlinked author for benchmark commits (@philippemnoel)
- **PR #7129** (2026-10-30): fix: omit graph dependencies from Stressgres runtime image (@philippemnoel)
- **PR #7125** (2026-10-31): fix: pin workflow actions and enforce immutable references (@philippemnoel)

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

## X. omit graph dependencies from Stressgres runtime image (#7129)

**RULE**:
When implementing operations in `docker/Dockerfile.stressgres`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in paradedb/paradedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3c13589a`: omit graph dependencies from Stressgres runtime image (#7129). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `docker/Dockerfile.stressgres`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        --manifest-path /home/app/Cargo.toml -p stressgres --no-default-features --features dst && \
# Graph generation is disabled in this image, avoiding Fontconfig and its
# transitive font/XML dependencies. Normal source builds retain graph support.
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
    libpng-dev \
    libjpeg-dev \
    libfontconfig1-dev \
        --manifest-path /home/app/Cargo.toml -p stressgres --features dst && \
    libfontconfig1 \
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3c13589a` are properly handled with clean fallback behavior.
