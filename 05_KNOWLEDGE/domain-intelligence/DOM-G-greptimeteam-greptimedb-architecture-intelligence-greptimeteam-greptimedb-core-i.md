# Domain G — Architecture Intelligence: Architecture Intelligence: GreptimeTeam/greptimedb Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "GreptimeTeam/greptimedb",
  "source_url": "https://github.com/GreptimeTeam/greptimedb",
  "source_version": "bceb12f7",
  "license": "Apache-2.0",
  "timestamp": "2026-11-27T05:30:20.725Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-greptimeteam-greptimedb",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [GreptimeTeam/greptimedb](https://github.com/GreptimeTeam/greptimedb) (Revision: `bceb12f7`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-27T05:30:20.725Z`  
> **Learning ID**: `learn-github-greptimeteam-greptimedb`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), I (Content & Information Intelligence), K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), B (Product Intelligence), J (Search & Distribution Intelligence), A (Human & Need Intelligence)
- **Confidence Rating**: 69%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from GreptimeTeam/greptimedb:

# Forensic Learning Record (Deep Inspection): GreptimeTeam/greptimedb

> **Canonical Artifact**: `07_PROJECT_LEARNING/greptimeteam-greptimedb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/GreptimeTeam/greptimedb](https://github.com/GreptimeTeam/greptimedb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-27T05:30:19.245Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GreptimeTeam/greptimedb`
- **Description**: The open-source observability database. One columnar engine for metrics, logs, and traces, on object storage.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6843 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/catalog/src/system_schema/utils.rs`
```
// Copyright 2023 Greptime Team
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

pub mod tables;

use std::sync::{Arc, Weak};

#[cfg(feature = "enterprise")]
use common_meta::key::TableMetadataManagerRef;
use common_query::logical_plan::is_lossless_substrait_type;
use datafusion::common::DFSchema;
use datafusion::common::tree_node::{TreeNode, TreeNodeRecursion};
use datafusion::logical_expr::ExprSchemable;
use datafusion::physical_plan::ExecutionPlan;
use datatypes::schema::SchemaRef;
use snafu::{OptionExt, ResultExt};
use store_api::storage::ScanRequest;

use crate::CatalogManager;
use crate::error::{
    GetInformationExtensionSnafu, ProjectSchemaSnafu, Result, UpgradeWeakCatalogManagerRefSnafu,
};
use crate::information_schema::{
    DatanodeInspectKind, DatanodeInspectRequest, InformationExtensionRef,
};
use crate::kvbackend::KvBackendCatalogManager;
use crate::system_schema::semantic_graph::EntityGraphProviderRef;

/// Adapts incremental system-table output, including one schema-bearing batch for an empty scan.
pub(crate) fn record_batch_stream(
    schema: &SchemaRef,
    batches: impl futures::Stream<Item = Result<common_recordbatch::RecordBatch>> + Send + 'static,
) -> common_recordbatch::DfSendableRecordBatchStream {
    use futures::TryStreamExt;

    let schema = schema.clone();
    let arrow_schema = schema.arrow_schema().clone();
    let stream = async_stream::try_stream!({
        let mut batches = std::pin::pin!(batches);
        let mut emitted = false;
        while let Some(batch) = batches.try_next().await? {
            if batch.num_rows() > 0 {
                emitted = true;
                yield batch.into_df_record_batch();
            }
        }
        if !emitted {
            yield common_recordbatch::RecordBatch::new_empty(schema).into_df_record_batch();
        }
    });
    Box::pin(datafusion::physical_plan::stream::RecordBatchStreamAdapter::new(arrow_schema, stream))
}

/// Projects an inspection table schema according to the scan request.
pub(crate) fn projected_schema(schema: &SchemaRef, request: &ScanRequest) -> Result<SchemaRef> {
    if let Some(p) = request.projection.as_deref() {
        Ok(Arc::new(schema.try_project(p).context(ProjectSchemaSnafu)?))
    } else {
        Ok(schema.clone())
    }
}

/// Builds a datanode inspection plan with the requested output schema.
pub(crate) fn inspect_plan(
    catalog_manager: &Weak<dyn CatalogManager>,
    kind: DatanodeInspectKind,
    schema: &SchemaRef,
    request: ScanRequest,
) -> Result<Option<Arc<dyn ExecutionPlan>>> {
    let projected_schema = projected_schema(schema, &request)?;
    let info_ext = information_extension(catalog_manager)?;
    let req = inspect_request(kind, schema, request)?;

    info_ext.inspect_datanode_plan(req, projected_schema)
}

/// System table predicates are inexact: the frontend keeps a residual filter. Dropping
/// an unsafe remote filter preserves correctness only if no remote limit truncates it.
pub(crate) fn inspect_request(
    kind: DatanodeInspectKind,
    schema: &SchemaRef,
    mut scan: ScanRequest,
) -> Result<DatanodeInspectRequest> {
    let schema =
        DFSchema::try_from(schema.arrow_schema().clone()).context(crate::error::DatafusionSnafu)?;
    let filter_count = scan.filters.len();
    scan.filters.retain(|filter| {
        let mut supported = true;
        let visited = filter.apply(|expr| {
            if !expr
                .get_type(&schema)
                .is_ok_and(|data_type| is_lossless_substrait_type(&data_type))
            {
                supported = false;
                return Ok(TreeNodeRecursion::Stop);
            }
            Ok(TreeNodeRecursion::Continue)
        });
        visited.is_ok() && supported
    });
    if scan.filters.len() != filter_count {
        scan.limit = None;
    }
    Ok(DatanodeInspectRequest { kind, scan })
}

/// Try to get the entity-graph provider from a `[CatalogManager]` weak reference.
/// Returns `None` when the manager is not the kv-backed one or the provider has
/// not been injected yet (the computed graph tables then stream empty).
pub fn entity_graph_provider(
    catalog_manager: &Weak<dyn CatalogManager>,
) -> Result<Option<EntityGraphProviderRef>> {
    let catalog_manager = catalog_manager
        .upgrade()
        .context(UpgradeWeakCatalogManagerRefSnafu)?;

    Ok(catalog_manager
        .as_any()
        .downcast_ref::<KvBackendCatalogManager>()
        .and_then(|manager| manager.entity_graph_provider()))
}

/// Try to get the `[InformationExtension]` from `[CatalogManager]` weak reference.
pub fn information_extension(
    catalog_manager: &Weak<dyn CatalogManager>,
) -> Result<InformationExtensionRef> {
    let catalog_manager = catalog_manager
        .upgrade()
        .context(UpgradeWeakCatalogManagerRefSnafu)?;

    let information_extension = catalog_manager
        .as_any()
        .downcast_ref::<KvBackendCatalogManager>()
        .map(|manager| manager.information_extension())
        .context(GetInformationExtensionSnafu)?;

    Ok(information_extension)
}

/// Try to get the `[TableMetadataManagerRef]` from `[CatalogManager]` weak reference.
#[cfg(feature = "enterprise")]
pub fn table_meta_manager(
    catalog_manager: &Weak<dyn CatalogManager>,
) -> Result<Option<TableMetadataManagerRef>> {
    let catalog_manager = catalog_manager
        .upgrade()
        .context(UpgradeWeakCatalogManagerRefSnafu)?;

    Ok(catalog_manager
        .as_any()
        .downcast_ref::<KvBackendCatalogManager>()
        .map(|manager| manager.table_metadata_manager_ref().clone()))
}

```

### Core Architecture Module: `src/catalog/src/system_schema/utils/tables.rs`
```
// Copyright 2023 Greptime Team
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use datatypes::prelude::ConcreteDataType;
use datatypes::schema::ColumnSchema;

pub fn string_columns(names: &[&'static str]) -> Vec<ColumnSchema> {
    names.iter().map(|name| string_column(name)).collect()
}

pub fn string_column(name: &str) -> ColumnSchema {
    ColumnSchema::new(
        str::to_lowercase(name),
        ConcreteDataType::string_datatype(),
        false,
    )
}

pub fn bigint_column(name: &str) -> ColumnSchema {
    ColumnSchema::new(
        str::to_lowercase(name),
        ConcreteDataType::int64_datatype(),
        false,
    )
}

pub fn timestamp_micro_column(name: &str) -> ColumnSchema {
    ColumnSchema::new(
        str::to_lowercase(name),
        ConcreteDataType::timestamp_microsecond_datatype(),
        false,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_string_columns() {
        let columns = ["a", "b", "c"];
        let column_schemas = string_columns(&columns);

        assert_eq!(3, column_schemas.len());
        for (i, name) in columns.iter().enumerate() {
            let cs = column_schemas.get(i).unwrap();

            assert_eq!(*name, cs.name);
            assert_eq!(ConcreteDataType::string_datatype(), cs.data_type);
        }
    }
}

```

### Core Architecture Module: `src/cli/src/data/import_v2/state.rs`
```
// Copyright 2023 Greptime Team
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use chrono::{DateTime, Utc};
use fs2::FileExt;
use serde::{Deserialize, Serialize};
use snafu::{IntoError, OptionExt, ResultExt};
use tokio::io::AsyncWriteExt;

use crate::data::import_v2::error::{
    ImportStateIoSnafu, ImportStateLockedSnafu, ImportStateParseSnafu, ImportStateUnknownTaskSnafu,
    Result,
};
use crate::data::path::encode_path_segment;

const IMPORT_STATE_ROOT: &str = ".greptime";
const IMPORT_STATE_DIR: &str = "import_state";
static IMPORT_STATE_TMP_ID: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ImportTaskStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct ImportTaskKey {
    pub(crate) chunk_id: u32,
    pub(crate) schema: String,
}

impl ImportTaskKey {
    pub(crate) fn new(chunk_id: u32, schema: impl Into<String>) -> Self {
        Self {
            chunk_id,
            schema: schema.into(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct ImportTaskState {
    pub(crate) chunk_id: u32,
    pub(crate) schema: String,
    pub(crate) status: ImportTaskStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct ImportState {
    pub(crate) snapshot_id: String,
    pub(crate) target_addr: String,
    pub(crate) catalog: String,
    pub(crate) schemas: Vec<String>,
    #[serde(default)]
    pub(crate) ddl_completed: bool,
    pub(crate) updated_at: DateTime<Utc>,
    // Tasks are (chunk-schema) tuples and can reach the tens of thousands;
    // linear scans here are accepted because per-task work is dominated by
    // network I/O and an fsync, but if the bound grows further this should be
    // backed by a HashMap<(chunk_id, schema), index> rebuilt after load.
    pub(crate) tasks: Vec<ImportTaskState>,
}

impl ImportState {
    pub(crate) fn new<I>(
        snapshot_id: impl Into<String>,
        target_addr: impl Into<String>,
        catalog: impl Into<String>,
        schemas: &[String],
        tasks: I,
    ) -> Self
    where
        I: IntoIterator<Item = ImportTaskKey>,
    {
        Self {
            snapshot_id: snapshot_id.into(),
            target_addr: target_addr.into(),
            catalog: catalog.into(),
            schemas: canonical_schema_selection(schemas),
            ddl_completed: false,
            updated_at: Utc::now(),
            tasks: tasks
                .into_iter()
                .map(|task| ImportTaskState {
                    chunk_id: task.chunk_id,
                    schema: task.schema,
                    status: ImportTaskStatus::Pending,
                    error: None,
                })
                .collect(),
        }
    }

    pub(crate) fn mark_ddl_completed(&mut self) {
        self.ddl_completed = true;
        self.updated_at = Utc::now();
    }

    pub(crate) fn task_status(&self, chunk_id: u32, schema: &str) -> Option<ImportTaskStatus> {
        self.tasks
            .iter()
            .find(|task| task.chunk_id == chunk_id && task.schema == schema)
            .map(|task| task.status)
    }

    pub(crate) fn set_task_status(
        &mut self,
        chunk_id: u32,
        schema: &str,
        status: ImportTaskStatus,
        error: Option<String>,
    ) -> Result<()> {
        let task = self
            .tasks
            .iter_mut()
            .find(|task| task.chunk_id == chunk_id && task.schema == schema)
            .context(ImportStateUnknownTaskSnafu {
                chunk_id,
                schema: schema.to_string(),
            })?;
        task.status = status;
        task.error = error;
        self.updated_at = Utc::now();
        Ok(())
    }
}

#[derive(Debug)]
pub(crate) struct ImportStateLockGuard {
    file: std::fs::File,
}

impl Drop for ImportStateLockGuard {
    fn drop(&mut self) {
        let _ = self.file.unlock();
    }
}

pub(crate) fn default_state_path(
    snapshot_id: &str,
    target_addr: &str,
    catalog: &str,
    schemas: &[String],
) -> Option<PathBuf> {
    let home = default_home_dir_with(|key| std::env::var_os(key));
    let cwd = std::env::current_dir().ok();
    default_state_path_with(
        home.as_deref(),
        cwd.as_deref(),
        snapshot_id,
        target_addr,
        catalog,
        schemas,
    )
}

fn default_home_dir_with<F>(get: F) -> Option<PathBuf>
where
    F: Fn(&str) -> Option<std::ffi::OsString>,
{
    get("HOME")
        .or_else(|| get("USERPROFILE"))
        .map(PathBuf::from)
        .or_else(|| {
            let drive = get("HOMEDRIVE")?;
            let path = get("HOMEPATH")?;
            Some(PathBuf::from(drive).join(path))
        })
}

fn default_state_path_with(
    home: Option<&Path>,
    cwd: Option<&Path>,
    snapshot_id: &str,
    target_addr: &str,
    catalog: &str,
    schemas: &[String],
) -> Option<PathBuf> {
    let file_name = import_state_file_name(snapshot_id, target_addr, catalog, schemas);
    match (home, cwd) {
        (Some(home), _) => Some(
            home.join(IMPORT_STATE_ROOT)
                .join(IMPORT_STATE_DIR)
                .join(file_name),
        ),
        (None, Some(cwd)) => Some(cwd.join(file_name)),
        (None, None) => None,
    }
}

fn import_state_file_name(
    snapshot_id: &str,
    target_addr: &str,
    catalog: &str,
    schemas: &[String],
) -> String {
    format!(
        ".import_state_{}_{}_{}.json",
        encode_path_segment(snapshot_id),
        encode_path_segment(target_addr),
        import_identity_hash(catalog, schemas)
    )
}

pub(crate) fn canonical_schema_selection(schemas: &[String]) -> Vec<String> {
    let mut canonicalized = schemas
        .iter()
        .map(|schema| schema.to_ascii_lowercase())
        .collect::<Vec<_>>();
    canonicalized.sort();
    canonicalized.dedup();
    canonicalized
}

/// FNV-1a over `(catalog, schemas)`. The output is part of the persisted state
/// filename, so we cannot use `std::collections::hash_map::DefaultHasher` -
/// Rust does not guarantee its algorithm across releases, which would make a
/// state file written by one toolchain undiscoverable by another.
fn import_identity_hash(catalog: &str, schemas: &[String]) -> String {
    const FNV_OFFSET: u64 = 0xcbf29ce484222325;
    const FNV_PRIME: u64 = 0x100000001b3;

    fn hash_bytes(mut hash: u64, bytes: &[u8]) -> u64 {
        for byte in bytes {
            hash ^= u64::from(*byte);
            hash = hash.wrapping_mul(FNV_PRIME);
        }
        hash
    }

    let mut hash = FNV_OFFSET;
    hash = hash_bytes(hash, catalog.as_bytes());
    // 0xff cannot appear in valid UTF-8, so it works as an unambiguous
    // field separator between adjacent identifiers.
    hash = hash_bytes(hash, &[0xff]);
    for schema in canonical_schema_selection(schemas) {
        hash = hash_bytes(hash, schema.as_bytes());
        hash = hash_bytes(hash, &[0xff]);
    }
    format!("{hash:016x}")
}

pub(crate) async fn load_import_state(path: &Path) -> Result<Option<ImportState>> {
    match tokio::fs::read(path).await {
        Ok(bytes) => {
            let mut state: ImportState =
                serde_json::from_slice(&bytes).context(ImportStateParseSnafu)?;
            normalize_import_state_for_resume(&mut state);
            Ok(Some(state))
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(source) => Err(source).context(ImportStateIoSnafu {
            path: path.display().to_string(),
        }),
    }
}

/// Caller must hold the lock acquired via `try_acquire_import_state_lock`.
pub(crate) async fn save_import_state(path: &Path, state: &ImportState) -> Result<()> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .context(ImportStateIoSnafu {
                path: parent.display().to_string(),
            })?;
    }

    let bytes =
        serde_json::to_vec_pretty(state).expect("ImportState should always be serializable");
    let tmp_path = unique_tmp_path(path);
    let mut file = tokio::fs::File::create(&tmp_path)
        .await
        .context(ImportStateIoSnafu {
            path: tmp_path.display().to_string(),
        })?;
    file.write_all(&bytes).await.context(ImportStateIoSnafu {
        path: tmp_path.display().to_string(),
    })?;
    file.sync_all().await.context(ImportStateIoSnafu {
        path: tmp_path.display().to_string(),
    })?;
    // Close before rename; Windows forbids renaming an open file.
    drop(file);

    tokio::fs::rename(&tmp_path, path)
        .await
        .context(ImportStateIoSnafu {
            path: path.display().to_string(),
        })?;
    sync_parent_dir(path).await?;
    Ok(())
}

pub(crate) fn try_acquire_import_state_lock(path: &Path) -> Result<ImportStateLockGuard> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).context(ImportStateIoSnafu {
            path: parent.display().to_string(),
        })?;
    }

    let lock_path = import_state_lock_path(path);
    let file = std::fs::OpenOptions::new()
        .create(true)
        .read
```

### Core Architecture Module: `src/cli/src/metadata/control/utils.rs`
```
// Copyright 2023 Greptime Team
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use common_error::ext::BoxedError;
use common_meta::error::Result as CommonMetaResult;
use common_meta::key::table_name::{TableNameKey, TableNameManager};
use common_meta::rpc::KeyValue;
use serde::Serialize;
use store_api::storage::TableId;

/// Decodes a key-value pair into a string.
pub fn decode_key_value(kv: KeyValue) -> CommonMetaResult<(String, String)> {
    let key = String::from_utf8_lossy(&kv.key).to_string();
    let value = String::from_utf8_lossy(&kv.value).to_string();
    Ok((key, value))
}

/// Formats a value as a JSON string.
pub fn json_formatter<T>(pretty: bool, value: &T) -> String
where
    T: Serialize,
{
    if pretty {
        serde_json::to_string_pretty(value).unwrap()
    } else {
        serde_json::to_string(value).unwrap()
    }
}

/// Gets the table id by table name.
pub async fn get_table_id_by_name(
    table_name_manager: &TableNameManager,
    catalog_name: &str,
    schema_name: &str,
    table_name: &str,
) -> Result<Option<TableId>, BoxedError> {
    let table_name_key = TableNameKey::new(catalog_name, schema_name, table_name);
    let Some(table_name_value) = table_name_manager
        .get(table_name_key)
        .await
        .map_err(BoxedError::new)?
    else {
        return Ok(None);
    };
    Ok(Some(table_name_value.table_id()))
}

```

### Core Architecture Module: `src/cli/src/metadata/utils.rs`
```
// Copyright 2023 Greptime Team
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use std::collections::VecDeque;

use async_stream::try_stream;
use common_catalog::consts::METRIC_ENGINE;
use common_catalog::format_full_table_name;
use common_meta::key::TableMetadataManager;
use common_meta::key::table_name::TableNameKey;
use common_meta::key::table_route::TableRouteValue;
use common_meta::kv_backend::KvBackendRef;
use futures::Stream;
use snafu::{OptionExt, ResultExt};
use store_api::storage::TableId;
use table::metadata::TableInfo;

use crate::error::{Result, TableMetadataSnafu, UnexpectedSnafu};

/// The input for the iterator.
pub enum IteratorInput {
    TableIds(VecDeque<TableId>),
    TableNames(VecDeque<(String, String, String)>),
}

impl IteratorInput {
    /// Creates a new iterator input from a list of table ids.
    pub fn new_table_ids(table_ids: Vec<TableId>) -> Self {
        Self::TableIds(table_ids.into())
    }

    /// Creates a new iterator input from a list of table names.
    pub fn new_table_names(table_names: Vec<(String, String, String)>) -> Self {
        Self::TableNames(table_names.into())
    }
}

/// An iterator for retrieving table metadata from the metadata store.
///
/// This struct provides functionality to iterate over table metadata based on
/// either [`TableId`] and their associated regions or fully qualified table names.
pub struct TableMetadataIterator {
    input: IteratorInput,
    table_metadata_manager: TableMetadataManager,
}

/// The full table metadata.
pub struct FullTableMetadata {
    pub table_id: TableId,
    pub table_info: TableInfo,
    pub table_route: TableRouteValue,
}

impl FullTableMetadata {
    /// Returns true if it's [TableRouteValue::Physical].
    pub fn is_physical_table(&self) -> bool {
        self.table_route.is_physical()
    }

    /// Returns true if it's a metric engine table.
    pub fn is_metric_engine(&self) -> bool {
        self.table_info.meta.engine == METRIC_ENGINE
    }

    /// Returns the full table name.
    pub fn full_table_name(&self) -> String {
        format_full_table_name(
            &self.table_info.catalog_name,
            &self.table_info.schema_name,
            &self.table_info.name,
        )
    }
}

impl TableMetadataIterator {
    pub fn new(kvbackend: KvBackendRef, input: IteratorInput) -> Self {
        let table_metadata_manager = TableMetadataManager::new(kvbackend);
        Self {
            input,
            table_metadata_manager,
        }
    }

    /// Returns the next table metadata.
    ///
    /// This method handles two types of inputs:
    /// - TableIds: Returns metadata for a specific [`TableId`].
    /// - TableNames: Returns metadata for a table identified by its full name (catalog.schema.table).
    ///
    /// Returns `None` when there are no more tables to process.
    pub async fn next(&mut self) -> Result<Option<FullTableMetadata>> {
        match &mut self.input {
            IteratorInput::TableIds(table_ids) => {
                if let Some(table_id) = table_ids.pop_front() {
                    let full_table_metadata = self.get_table_metadata(table_id).await?;
                    return Ok(Some(full_table_metadata));
                }
            }

            IteratorInput::TableNames(table_names) => {
                if let Some(full_table_name) = table_names.pop_front() {
                    let table_id = self.get_table_id_by_name(full_table_name).await?;
                    let full_table_metadata = self.get_table_metadata(table_id).await?;
                    return Ok(Some(full_table_metadata));
                }
            }
        }

        Ok(None)
    }

    /// Converts the iterator into a stream of table metadata.
    pub fn into_stream(mut self) -> impl Stream<Item = Result<FullTableMetadata>> {
        try_stream!({
            while let Some(full_table_metadata) = self.next().await? {
                yield full_table_metadata;
            }
        })
    }

    async fn get_table_id_by_name(
        &mut self,
        (catalog_name, schema_name, table_name): (String, String, String),
    ) -> Result<TableId> {
        let key = TableNameKey::new(&catalog_name, &schema_name, &table_name);
        let table_id = self
            .table_metadata_manager
            .table_name_manager()
            .get(key)
            .await
            .context(TableMetadataSnafu)?
            .with_context(|| UnexpectedSnafu {
                msg: format!(
                    "Table not found: {}",
                    format_full_table_name(&catalog_name, &schema_name, &table_name)
                ),
            })?
            .table_id();
        Ok(table_id)
    }

    async fn get_table_metadata(&mut self, table_id: TableId) -> Result<FullTableMetadata> {
        let (table_info, table_route) = self
            .table_metadata_manager
            .get_full_table_info(table_id)
            .await
            .context(TableMetadataSnafu)?;

        let table_info = table_info
            .with_context(|| UnexpectedSnafu {
                msg: format!("Table info not found for table id: {table_id}"),
            })?
            .into_inner()
            .table_info;
        let table_route = table_route
            .with_context(|| UnexpectedSnafu {
                msg: format!("Table route not found for table id: {table_id}"),
            })?
            .into_inner();

        Ok(FullTableMetadata {
            table_id,
            table_info,
            table_route,
        })
    }
}

```

### Core Architecture Module: `src/cli/src/utils.rs`
```
// Copyright 2023 Greptime Team
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use std::env;
use std::path::Path;

use snafu::ResultExt;

use crate::error::{GetCurrentDirSnafu, Result};

/// Resolves the relative path to an absolute path.
pub fn resolve_relative_path(current_dir: impl AsRef<Path>, path_str: &str) -> String {
    let path = Path::new(path_str);
    if path.is_relative() {
        let path = current_dir.as_ref().join(path);
        common_telemetry::debug!("Resolved relative path: {}", path.to_string_lossy());
        path.to_string_lossy().to_string()
    } else {
        path_str.to_string()
    }
}

/// Resolves the relative path to an absolute path.
pub fn resolve_relative_path_with_current_dir(path_str: &str) -> Result<String> {
    let current_dir = env::current_dir().context(GetCurrentDirSnafu)?;
    Ok(resolve_relative_path(current_dir, path_str))
}

#[cfg(test)]
mod tests {
    use std::env;
    use std::path::PathBuf;

    use super::*;

    #[test]
    fn test_resolve_relative_path_absolute() {
        let abs_path = if cfg!(windows) {
            "C:\\foo\\bar"
        } else {
            "/foo/bar"
        };
        let current_dir = PathBuf::from("/tmp");
        let result = resolve_relative_path(&current_dir, abs_path);
        assert_eq!(result, abs_path);
    }

    #[test]
    fn test_resolve_relative_path_relative() {
        let current_dir = PathBuf::from("/tmp");
        let rel_path = "foo/bar";
        let expected = "/tmp/foo/bar";
        let result = resolve_relative_path(&current_dir, rel_path);
        // On Windows, the separator is '\', so normalize for comparison
        // '/' is as a normal character in Windows paths
        if cfg!(windows) {
            assert!(result.ends_with("foo/bar"));
            assert!(result.contains("/tmp\\"));
        } else {
            assert_eq!(result, expected);
        }
    }

    #[test]
    fn test_resolve_relative_path_with_current_dir_absolute() {
        let abs_path = if cfg!(windows) {
            "C:\\foo\\bar"
        } else {
            "/foo/bar"
        };
        let result = resolve_relative_path_with_current_dir(abs_path).unwrap();
        assert_eq!(result, abs_path);
    }

    #[test]
    fn test_resolve_relative_path_with_current_dir_relative() {
        let rel_path = "foo/bar";
        let current_dir = env::current_dir().unwrap();
        let expected = current_dir.join(rel_path).to_string_lossy().to_string();
        let result = resolve_relative_path_with_current_dir(rel_path).unwrap();
        assert_eq!(result, expected);
    }
}

```

### Core Architecture Module: `src/cmd/src/bin/query_perf_fixture/util.rs`
```
// Copyright 2023 Greptime Team
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use std::path::Path;

pub(super) fn case_name_from_path(path: &Path) -> String {
    path.parent()
        .and_then(Path::file_name)
        .and_then(|name| name.to_str())
        .unwrap_or("query_perf_case")
        .to_string()
}

```

### Core Architecture Module: `src/cmd/src/datanode/tool_util.rs`
```
// Copyright 2023 Greptime Team
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#[cfg(feature = "dev-tools")]
use std::fs::File;
use std::path::Path;
use std::sync::Arc;

use common_wal::config::DatanodeWalConfig;
use datanode::config::RegionEngineConfig;
use datanode::store;
use mito2::config::MitoConfig;
use object_store::ObjectStore;
#[cfg(feature = "dev-tools")]
use parquet::basic::Compression;
use parquet::file::metadata::{KeyValue, ParquetMetaData};
#[cfg(feature = "dev-tools")]
use parquet::file::metadata::{PageIndexPolicy, ParquetMetaDataReader};
use snafu::OptionExt;
#[cfg(feature = "dev-tools")]
use snafu::ResultExt;
use store_api::metadata::{RegionMetadata, RegionMetadataRef};
use store_api::region_request::PathType;
use store_api::storage::{FileId, RegionId};

use crate::datanode::{StorageConfig, StorageConfigWrapper};
use crate::error;

pub(crate) fn parse_config(
    config_path: &Path,
) -> error::Result<(StorageConfig, MitoConfig, DatanodeWalConfig)> {
    let cfg_str = std::fs::read_to_string(config_path).map_err(|e| {
        error::IllegalConfigSnafu {
            msg: format!("failed to read config {}: {e}", config_path.display()),
        }
        .build()
    })?;

    let store_cfg: StorageConfigWrapper = toml::from_str(&cfg_str).map_err(|e| {
        error::IllegalConfigSnafu {
            msg: format!("failed to parse config {}: {e}", config_path.display()),
        }
        .build()
    })?;

    let wal_config = store_cfg.wal;
    let storage_config = store_cfg.storage;
    let mito_engine_config = store_cfg
        .region_engine
        .into_iter()
        .find_map(|config| match config {
            RegionEngineConfig::Mito(mito) => Some(mito),
            _ => None,
        })
        .with_context(|| error::IllegalConfigSnafu {
            msg: format!("Engine config not found in {:?}", config_path),
        })?;

    Ok((storage_config, mito_engine_config, wal_config))
}

pub(crate) async fn build_object_store(config: &StorageConfig) -> error::Result<ObjectStore> {
    store::new_object_store(config.store.clone(), &config.data_home)
        .await
        .map_err(|e| {
            error::IllegalConfigSnafu {
                msg: format!("Failed to build object store: {e:?}"),
            }
            .build()
        })
}

pub(crate) fn extract_region_metadata(
    file_path: &str,
    metadata: &ParquetMetaData,
) -> error::Result<RegionMetadataRef> {
    let key_values: Option<&Vec<KeyValue>> = metadata.file_metadata().key_value_metadata();
    let Some(key_values) = key_values else {
        return Err(error::IllegalConfigSnafu {
            msg: format!("{file_path}: missing parquet key_value metadata"),
        }
        .build());
    };
    let json = key_values
        .iter()
        .find(|key_value| key_value.key == mito2::sst::parquet::PARQUET_METADATA_KEY)
        .and_then(|key_value| key_value.value.as_ref())
        .ok_or_else(|| {
            error::IllegalConfigSnafu {
                msg: format!(
                    "{file_path}: key {} not found or empty",
                    mito2::sst::parquet::PARQUET_METADATA_KEY
                ),
            }
            .build()
        })?;
    let region = RegionMetadata::from_json(json).map_err(|e| {
        error::IllegalConfigSnafu {
            msg: format!("invalid region metadata json: {e}"),
        }
        .build()
    })?;
    Ok(Arc::new(region))
}

pub(crate) fn parse_region_id(value: &str) -> error::Result<RegionId> {
    if let Some((table_id, region_number)) = value.split_once(':') {
        let table_id = table_id.parse().map_err(|e| {
            error::IllegalConfigSnafu {
                msg: format!("invalid table_id in region_id '{value}': {e}"),
            }
            .build()
        })?;
        let region_number = region_number.parse().map_err(|e| {
            error::IllegalConfigSnafu {
                msg: format!("invalid region_num in region_id '{value}': {e}"),
            }
            .build()
        })?;
        Ok(RegionId::new(table_id, region_number))
    } else {
        value.parse().map(RegionId::from_u64).map_err(|e| {
            error::IllegalConfigSnafu {
                msg: format!("invalid region_id '{value}': {e}"),
            }
            .build()
        })
    }
}

pub(crate) fn parse_file_id(value: &str) -> error::Result<FileId> {
    FileId::parse_str(value).map_err(|e| {
        error::IllegalConfigSnafu {
            msg: format!("invalid file_id '{value}': {e}"),
        }
        .build()
    })
}

pub(crate) fn parse_path_type(value: &str) -> error::Result<PathType> {
    match value.to_lowercase().as_str() {
        "bare" => Ok(PathType::Bare),
        "data" => Ok(PathType::Data),
        "metadata" => Ok(PathType::Metadata),
        _ => Err(error::IllegalConfigSnafu {
            msg: format!("invalid path_type '{value}', expected: bare, data, metadata"),
        }
        .build()),
    }
}

pub(crate) fn format_bytes(bytes: u64) -> String {
    const KIB: u64 = 1024;
    const MIB: u64 = 1024 * KIB;
    const GIB: u64 = 1024 * MIB;
    if bytes >= GIB {
        format!("{:.2} GiB", bytes as f64 / GIB as f64)
    } else if bytes >= MIB {
        format!("{:.2} MiB", bytes as f64 / MIB as f64)
    } else if bytes >= KIB {
        format!("{:.2} KiB", bytes as f64 / KIB as f64)
    } else {
        format!("{bytes} B")
    }
}

pub(crate) fn max_row_group_uncompressed_size(metadata: &ParquetMetaData) -> u64 {
    metadata
        .row_groups()
        .iter()
        .map(|row_group| {
            row_group
                .columns()
                .iter()
                .map(|column| column.uncompressed_size() as u64)
                .sum::<u64>()
        })
        .max()
        .unwrap_or(0)
}

#[cfg(feature = "dev-tools")]
pub(crate) fn load_local_parquet_metadata(path: &Path) -> error::Result<ParquetMetaData> {
    let file = File::open(path).context(error::FileIoSnafu)?;
    ParquetMetaDataReader::new()
        .with_page_index_policy(PageIndexPolicy::Optional)
        .parse_and_finish(&file)
        .map_err(|e| {
            error::IllegalConfigSnafu {
                msg: format!("read parquet metadata failed for {}: {e}", path.display()),
            }
            .build()
        })
}

#[cfg(feature = "dev-tools")]
pub(crate) fn compression_name(compression: Compression) -> &'static str {
    match compression {
        Compression::UNCOMPRESSED => "uncompressed",
        Compression::SNAPPY => "snappy",
        Compression::GZIP(_) => "gzip",
        Compression::LZO => "lzo",
        Compression::BROTLI(_) => "brotli",
        Compression::LZ4 => "lz4",
        Compression::ZSTD(_) => "zstd",
        Compression::LZ4_RAW => "lz4-raw",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_region_and_path_type() {
        assert_eq!(parse_region_id("1024:7").unwrap(), RegionId::new(1024, 7));
        assert_eq!(
            parse_region_id(&RegionId::new(1, 2).as_u64().to_string()).unwrap(),
            RegionId::new(1, 2)
        );
        assert_eq!(parse_path_type("bare").unwrap(), PathType::Bare);
        assert_eq!(parse_path_type("data").unwrap(), PathType::Data);
        assert_eq!(parse_path_type("metadata").unwrap(), PathType::Metadata);
    }
}

```

### Core Architecture Module: `src/common/batcher/src/pending_worker.rs`
```
// Copyright 2023 Greptime Team
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use tokio::time::Instant;

use crate::flush_policy::{FlushPolicy, FlushTrigger};
use crate::flush_timer::FlushTimer;
use crate::pending_batch::PendingBatch;

/// Batch state for one grouping key, independent of the caller's event loop.
///
/// The caller owns channels, idle/shutdown decisions, execution limits, task
/// spawning and business completion. Taking a batch transfers its items to the
/// caller; no background task is started by this worker.
pub struct PendingWorker<T, P> {
    batch: PendingBatch<T>,
    flush_policy: P,
    flush_timer: FlushTimer,
}

impl<T, P> PendingWorker<T, P> {
    /// Creates an empty worker without starting a timer or runtime task.
    pub fn new(flush_policy: P) -> Self {
        Self {
            batch: PendingBatch::new(),
            flush_policy,
            flush_timer: FlushTimer::new(),
        }
    }

    /// Returns whether the worker has no submissions, including zero-row items.
    pub fn is_empty(&self) -> bool {
        self.batch.is_empty()
    }

    /// Returns the pending row count before ownership is transferred to the caller.
    pub fn total_rows(&self) -> usize {
        self.batch.total_rows()
    }

    /// Waits for a timer wakeup without taking or executing the batch.
    ///
    /// Cancellation is safe: selecting another event does not lose items or
    /// reset the deadline. After a wakeup, call [`Self::take_ready`] with
    /// [`FlushTrigger::Deadline`]. An empty or unarmed worker stays pending.
    pub async fn wait_flush(&mut self) {
        self.flush_timer.wait().await;
    }

    /// Takes all pending submissions regardless of policy, for example on shutdown.
    ///
    /// Returns `None` for an empty batch. The caller decides whether to execute
    /// inline, acquire a flush permit or discard the returned items.
    pub fn take_pending(&mut self) -> Option<Vec<T>> {
        self.flush_timer.set_deadline(None);
        if self.batch.is_empty() {
            None
        } else {
            Some(self.batch.take())
        }
    }
}

impl<T, P: FlushPolicy> PendingWorker<T, P> {
    /// Appends one complete submission and arms the policy's deadline.
    ///
    /// Call [`Self::take_ready`] with [`FlushTrigger::Submission`] afterwards to
    /// check whether this submission triggered a flush. Timer-backed policies
    /// require a Tokio runtime with time enabled.
    ///
    /// # Panics
    ///
    /// Panics if arming a new timer outside a Tokio runtime with time enabled.
    pub fn submit(&mut self, item: T, total_rows: usize) {
        self.batch.push(item, total_rows, Instant::now());
        self.refresh_deadline();
    }

    /// Takes the batch only when the policy permits flushing for this event.
    ///
    /// Like [`Self::submit`], this may arm a timer and requires a time-enabled
    /// Tokio runtime when the policy starts using deadlines.
    pub fn take_ready(&mut self, trigger: FlushTrigger) -> Option<Vec<T>> {
        if !self.batch.is_empty()
            && self
                .flush_policy
                .should_flush(&self.batch, Instant::now(), trigger)
        {
            self.take_pending()
        } else {
            self.refresh_deadline();
            None
        }
    }

    fn refresh_deadline(&mut self) {
        let deadline = if self.batch.is_empty() {
            None
        } else {
            self.flush_policy.deadline(&self.batch)
        };
        self.flush_timer.set_deadline(deadline);
    }
}

#[cfg(test)]
mod tests {
    use std::future::Future;
    use std::task::Poll;
    use std::time::Duration;

    use super::*;
    use crate::flush_policy::timing::TimingFlushPolicy;

    fn worker(rows: usize) -> PendingWorker<i32, TimingFlushPolicy> {
        PendingWorker::new(TimingFlushPolicy::try_new(Duration::from_millis(10), rows).unwrap())
    }

    async fn assert_wait_pending<T, P>(worker: &mut PendingWorker<T, P>) {
        let wait = worker.wait_flush();
        tokio::pin!(wait);
        assert!(std::future::poll_fn(|cx| Poll::Ready(wait.as_mut().poll(cx).is_pending())).await);
    }

    #[tokio::test(start_paused = true)]
    async fn test_first_deadline_and_cancelled_wait() {
        let mut worker = worker(100);
        let start = Instant::now();
        worker.submit(1, 1);
        assert_wait_pending(&mut worker).await;
        tokio::time::advance(Duration::from_millis(5)).await;
        worker.submit(2, 1);
        assert!(worker.take_ready(FlushTrigger::Submission).is_none());
        assert_wait_pending(&mut worker).await;
        worker.wait_flush().await;
        assert_eq!(start + Duration::from_millis(10), Instant::now());
        assert_eq!(Some(vec![1, 2]), worker.take_ready(FlushTrigger::Deadline));
        assert!(worker.is_empty());
        assert_eq!(0, worker.total_rows());
        assert_wait_pending(&mut worker).await;
    }

    #[tokio::test(start_paused = true)]
    async fn test_submission_does_not_consume_expired_deadline() {
        let mut worker = worker(100);
        worker.submit(1, 1);
        tokio::time::advance(Duration::from_millis(10)).await;
        worker.submit(2, 1);
        assert!(worker.take_ready(FlushTrigger::Submission).is_none());
        worker.wait_flush().await;
        assert_eq!(Some(vec![1, 2]), worker.take_ready(FlushTrigger::Deadline));
    }

    #[tokio::test(start_paused = true)]
    async fn test_size_flush_and_rearm() {
        let mut worker = worker(2);
        worker.submit(1, 3);
        assert_eq!(3, worker.total_rows());
        assert_eq!(Some(vec![1]), worker.take_ready(FlushTrigger::Submission));
        tokio::time::advance(Duration::from_secs(1)).await;
        assert_wait_pending(&mut worker).await;
        let start = Instant::now();
        worker.submit(2, 1);
        worker.wait_flush().await;
        assert_eq!(start + Duration::from_millis(10), Instant::now());
        assert_eq!(Some(vec![2]), worker.take_ready(FlushTrigger::Deadline));
    }

    #[tokio::test(start_paused = true)]
    async fn test_take_pending_without_waiting() {
        let mut worker = worker(100);
        assert_eq!(None, worker.take_pending());
        worker.submit(1, 0);
        assert!(!worker.is_empty());
        let now = Instant::now();
        assert_eq!(Some(vec![1]), worker.take_pending());
        assert_eq!(now, Instant::now());
        tokio::time::advance(Duration::from_secs(1)).await;
        assert_wait_pending(&mut worker).await;
    }

    #[tokio::test(start_paused = true)]
    async fn test_row_threshold_ablation() {
        for (rows, early) in [(2, true), (100, false)] {
            let mut worker = worker(rows);
            let start = Instant::now();
            worker.submit(1, 1);
            tokio::time::advance(Duration::from_millis(5)).await;
            worker.submit(2, 1);
            let batch = worker.take_ready(FlushTrigger::Submission);
            if early {
                assert_eq!(Some(vec![1, 2]), batch);
                assert_eq!(start + Duration::from_millis(5), Instant::now());
            } else {
                assert!(batch.is_none());
                worker.wait_flush().await;
                assert_eq!(start + Duration::from_millis(10), Instant::now());
                assert_eq!(Some(vec![1, 2]), worker.take_ready(FlushTrigger::Deadline));
            }
        }
    }

    #[tokio::test]
    async fn test_non_timing_policy() {
        struct TwoSubmissionsPolicy;
        impl FlushPolicy for TwoSubmissionsPolicy {
            fn deadline<T>(&self, _: &PendingBatch<T>) -> Option<Instant> {
                None
            }
            fn should_flush<T>(
                &self,
                batch: &PendingBatch<T>,
                _: Instant,
                _: FlushTrigger,
            ) -> bool {
                batch.len() >= 2
            }
        }
        let mut worker = PendingWorker::new(TwoSubmissionsPolicy);
        worker.submit(1, 0);
        assert_wait_pending(&mut worker).await;
        assert!(worker.take_ready(FlushTrigger::Submission).is_none());
        worker.submit(2, 0);
        assert_eq!(
            Some(vec![1, 2]),
            worker.take_ready(FlushTrigger::Submission)
        );
    }

    #[tokio::test(start_paused = true)]
    async fn test_caller_owns_event_loop() {
        let mut worker = worker(100);
        let (tx, mut rx) = tokio::sync::mpsc::channel(1);
        tx.send(1).await.unwrap();
        tokio::select! {
            _ = worker.wait_flush() => panic!("empty worker must not wake"),
            item = rx.recv() => worker.submit(item.unwrap(), 1),
        }
        assert!(worker.take_ready(FlushTrigger::Submission).is_none());
        let start = Instant::now();
        tokio::select! {
            _ = worker.wait_flush() => {
                assert_eq!(Some(vec![1]), worker.take_ready(FlushTrigger::Deadline));
            }
            _ = rx.recv() => panic!("sender is still open without another submission"),
        }
        assert_eq!(start + Duration::from_millis(10), Instant::now());
    }
}

```

### Core Architecture Module: `src/common/batcher/src/worker_registry.rs`
```
// Copyright 2023 Greptime Team
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use std::hash::Hash;

use dashmap::DashMap;
use dashmap::mapref::entry::Entry;
use tokio::sync::mpsc::{self, Receiver, Sender};

/// Registers worker senders by key, without owning workers or their execution.
///
/// Closed senders are replaced on lookup/creation. Cleanup checks channel
/// identity under the same lock as replacement, so an old worker cannot remove
/// a replacement registered under its key.
pub struct WorkerRegistry<K, T> {
    workers: DashMap<K, Sender<T>>,
}

impl<K: Eq + Hash, T> Default for WorkerRegistry<K, T> {
    fn default() -> Self {
        Self {
            workers: DashMap::new(),
        }
    }
}

impl<K: Eq + Hash, T> WorkerRegistry<K, T> {
    pub fn new() -> Self {
        Self::default()
    }

    /// Returns a live sender, if one is currently registered.
    /// The receiver can close after this method returns; callers must handle a
    /// failed send and retry worker lookup without discarding the unsent item.
    pub async fn get(&self, key: &K) -> Option<Sender<T>> {
        self.workers
            .get(key)
            .filter(|tx| !tx.is_closed())
            .map(|tx| tx.value().clone())
    }

    /// Returns the registered sender and, only when created, its receiver.
    ///
    /// Start the new worker before the next await so cancellation cannot leave
    /// a registered channel without a consumer. Existing channels retain their
    /// original capacity. New channel capacity must satisfy `mpsc::channel`.
    pub async fn get_or_create(&self, key: K, capacity: usize) -> (Sender<T>, Option<Receiver<T>>) {
        let mut receiver = None;
        let sender = self
            .get_or_insert_with(key, || {
                let (sender, rx) = mpsc::channel(capacity);
                receiver = Some(rx);
                sender
            })
            .await;
        (sender, receiver)
    }

    /// Reuses a live sender or atomically creates its replacement.
    ///
    /// `create` runs synchronously under the registry shard lock. It should only
    /// prepare the sender and capture any initialization state (such as the
    /// receiver) for the caller; start the worker after this method returns.
    /// Do not block or reenter the registry from `create`.
    pub async fn get_or_insert_with<F>(&self, key: K, create: F) -> Sender<T>
    where
        F: FnOnce() -> Sender<T>,
    {
        if let Some(tx) = self.get(&key).await {
            return tx;
        }

        match self.workers.entry(key) {
            Entry::Occupied(mut entry) => {
                if entry.get().is_closed() {
                    entry.insert(create());
                }
                entry.get().clone()
            }
            Entry::Vacant(entry) => entry.insert(create()).value().clone(),
        }
    }

    /// Removes the key only if it still points to this worker's channel.
    pub async fn remove_if_same(&self, key: &K, tx: &Sender<T>) -> bool {
        self.workers
            .remove_if(key, |_, current| current.same_channel(tx))
            .is_some()
    }

    /// Number of registered entries, including senders whose receivers closed.
    pub async fn len(&self) -> usize {
        self.workers.len()
    }

    pub async fn is_empty(&self) -> bool {
        self.workers.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use std::sync::atomic::{AtomicUsize, Ordering};

    use tokio::sync::{Barrier, mpsc};

    use crate::worker_registry::WorkerRegistry;

    #[tokio::test]
    async fn test_live_lookup_uses_read_lock() {
        let registry = Arc::new(WorkerRegistry::<_, ()>::new());
        let (sender, _receiver) = registry.get_or_create(1, 1).await;
        let guard = registry.workers.get(&1).unwrap();
        let (result_tx, result_rx) = std::sync::mpsc::channel();
        let worker_registry = registry.clone();
        let runtime = tokio::runtime::Handle::current();
        let thread = std::thread::spawn(move || {
            let result = runtime.block_on(worker_registry.get_or_create(1, 1));
            let _ = result_tx.send(result);
        });
        // Release the read guard before joining, even if lookup needs a write lock.
        let result = result_rx.recv_timeout(std::time::Duration::from_secs(5));
        drop(guard);
        thread.join().unwrap();
        let (reused, receiver) = result.expect("live lookup must not wait for an exclusive lock");
        assert!(sender.same_channel(&reused));
        assert!(receiver.is_none());
    }

    #[tokio::test]
    async fn test_reuses_live_sender_and_returns_receiver_to_caller() {
        let registry = WorkerRegistry::new();
        assert!(registry.is_empty().await);
        assert!(registry.get(&1).await.is_none());
        let mut receiver = None;
        let first = registry
            .get_or_insert_with(1, || {
                let (tx, rx) = mpsc::channel(1);
                receiver = Some(rx);
                tx
            })
            .await;
        let second = registry
            .get_or_insert_with(1, || panic!("live worker must be reused"))
            .await;
        assert!(first.same_channel(&second));
        assert!(registry.get(&1).await.unwrap().same_channel(&first));
        first.send(7).await.unwrap();
        assert_eq!(Some(7), receiver.as_mut().unwrap().recv().await);
        assert_eq!(1, registry.len().await);
        assert!(registry.remove_if_same(&1, &first).await);
        assert!(!registry.remove_if_same(&1, &first).await);
        assert!(registry.is_empty().await);
    }

    #[tokio::test]
    async fn test_old_cleanup_does_not_remove_replacement() {
        let registry = WorkerRegistry::<_, ()>::new();
        let (first, mut receiver) = mpsc::channel(1);
        registry.get_or_insert_with("table", || first.clone()).await;
        receiver.close();
        assert!(registry.get(&"table").await.is_none());
        // Closed entries remain accounted until replacement or explicit removal.
        assert_eq!(1, registry.len().await);
        let (second, _receiver) = mpsc::channel(1);
        registry
            .get_or_insert_with("table", || second.clone())
            .await;
        assert!(!registry.remove_if_same(&"table", &first).await);
        assert!(registry.get(&"table").await.unwrap().same_channel(&second));
        assert_eq!(1, registry.len().await);
        assert!(registry.remove_if_same(&"table", &second).await);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn test_concurrent_lookup_initializes_once() {
        let registry = Arc::new(WorkerRegistry::<_, ()>::new());
        let barrier = Arc::new(Barrier::new(3));
        let count = Arc::new(AtomicUsize::new(0));
        let mut tasks = Vec::new();
        for _ in 0..2 {
            let registry = registry.clone();
            let barrier = barrier.clone();
            let count = count.clone();
            tasks.push(tokio::spawn(async move {
                barrier.wait().await;
                let mut receiver = None;
                let tx = registry
                    .get_or_insert_with(1, || {
                        count.fetch_add(1, Ordering::Relaxed);
                        let (tx, rx) = mpsc::channel(1);
                        receiver = Some(rx);
                        tx
                    })
                    .await;
                // Keep the newly created receiver alive while both lookups run.
                barrier.wait().await;
                (tx, receiver)
            }));
        }
        barrier.wait().await;
        barrier.wait().await;
        let first = tasks.remove(0).await.unwrap();
        let second = tasks.remove(0).await.unwrap();
        assert!(first.0.same_channel(&second.0));
        assert_eq!(1, count.load(Ordering::Relaxed));
        assert_eq!(1, registry.len().await);
    }
    #[tokio::test]
    async fn test_channel_creation_replacement_and_cleanup() {
        let registry = WorkerRegistry::<_, usize>::new();
        let (first, receiver) = registry.get_or_create(1, 2).await;
        let mut receiver = receiver.unwrap();
        let (reused, absent) = registry.get_or_create(1, 3).await;
        assert!(absent.is_none());
        assert!(first.same_channel(&reused));
        assert_eq!(2, reused.max_capacity());
        first.send(7).await.unwrap();
        assert_eq!(Some(7), receiver.recv().await);
        receiver.close();
        let (replacement, receiver) = registry.get_or_create(1, 3).await;
        assert!(receiver.is_some());
        assert_eq!(3, replacement.max_capacity());
        assert!(!first.same_channel(&replacement));
        assert!(!registry.remove_if_same(&1, &first).await);
        assert!(registry.get(&1).await.unwrap().same_channel(&replacement));
        assert!(registry.remove_if_same(&1, &replacement).await);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn test_concurrent_channel_creation_returns_one_receiver() {
        let registry = Arc::new(WorkerRegistry::<_, ()>::new());
        let barrier = Arc::new(Barrier::new(3));
        let mut tasks = Vec::new();
        for _ in 0..2 {
            let registry = registry.clone();
            let barrier = barrier.clone();
            tasks.push(tokio::spawn(async move {
                barrier.wait().await;
                let channel = registry.get_or_create(1, 2).await;
                
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #10652** (2026-11-26): **perf(query): open regions of a merge scan partition ahead for bounded results**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  ## What's changed and what's your intention?  `MergeScanExec::to_stream` reads the regions of an output partition one after another: it sends the `DoGet` for a region only after the previous region's stream is drained. With 16 regions and 4 partitions, a TopK query waits for 4 region queries in sequence per partition, although each region returns at most `fetch` rows.  When `remote_plan_row_bound` bounds every region's result to at most one batch (`LIMIT`, `ORDER BY ... LIMIT`, aggregates without `GROUP BY`), a partition now sends the `DoGet`s of its regions together, up to `target_partitions` at a time, and drains them in region order through `buffered`. The partition's output order is unchanged. Unbounded plans, and plans with a query-wide `RegionReadLimiter` (native PromQL), keep reading one region at a time.  The remote dynamic filter fanout starts as soon as a region's `DoGet` succeeds, so regions opened ahead receive threshold updates while earlier regions are drained.  Known limitation: a region opened ahead starts with the initial remote dynamic filter instead of the threshold the regions before it tightened. Updates still reach it through the fanout.  Local cluster (metasrv, 2 datanodes, frontend; `query.parallelism = 4`), 16-region traces table with 17.4M rows and 168 SST files per region. Only the fronten
  **Post-Mortem & Fix Analysis**:
  > Closing this. The review is right: `max_concurrent_queries` on the datanode bounds in-flight reads per datanode, and the permit is held until the stream drops. Opening regions ahead lets one query exceed a budget sized for `target_partitions` and time out on its own reads.  The same latency gain is available without code. With the frontend's `query.parallelism` at least the region count, each merge scan partition reads one region, so all regions run at once and the datanode budget stays an explicit operator setting.  Same main binary, 16-region table, single client, median of 15 runs, three rounds each:  | Query | parallelism 4 | parallelism 16 | |---|---|---| | root spans, 8 columns, `ORDER BY ts DESC LIMIT 100` | 26.2 ms | 16.9 ms | | root spans, `SELECT *`, same order and limit | 78.3 ms | 55.4 ms | | root spans with a rare status, same order and limit | 49.7 ms | 39.1 ms | | `count(*)` of root spans | 172.9 ms | 155.5 ms | | `ORDER BY ts DESC LIMIT 100`, no filter | 24.3 ms | 12.9 

- **Issue #10651** (2026-11-26): **fix(mito2): make table compaction publication retries idempotent**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  ## What's changed and what's your intention?  A datanode can publish a table compaction and lose the acknowledgement. Retrying the same request then returned `StaleInputs` because the first attempt had already removed the shared input files.  Mito now returns `Applied` when the region manifest shows that every input ID is absent and every expected output is present with exactly the requested `FileMeta`. The output set must be nonempty. The worker confirms the file set under the manifest lock and checks the schema, region state, and leader lease. A successful replay skips output verification, manifest writes, in-memory file installation, and compaction scheduling.  If a later compaction has replaced an output, the retry still returns `StaleInputs`. The same applies to an empty-output retry after its inputs disappear, since the manifest cannot establish that the requested replacement occurred.  Publication allows region options to change after the job takes its snapshot. If an ALTER enables `preserve_row_sequence` and a fresh publication would install unmarked outputs, Mito returns `StaleInputs` so the caller can replan. This protects exact sequence-range reads even when the inputs have mixed sequence markers. Mito checks the policy before reading output objects, so a missing object cannot mask an already stale policy

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

### Incident Patch 1: `0127d638` (2026-11-26)
**Commit Message**: fix(mito2): require a region to own its files before a remap (#10646)

* fix(mito2): require a region to own its files before a remap

A remap (split or merge) moves file references between regions. Today mito2 checks
only that the inputs come from the same table, so a merge can be applied while a
participant still holds files another region created; a later compaction then
materialises a copy of the same rows and both references survive the file-id
dedup, so the merged region reads those rows twice.

Reject such a remap instead: every participating region must hold only files whose
creation expression equals that region's own partition expression. The error names
each offending (region, file, creator expression) so the caller can compact the
region and retry. A one-source-to-many-targets split is exempt: no target combines
file sets there and the region predicate keeps a split's rows apart.

This trades a merge-time error and a compaction for the per-reference row range
that #10616 adds.

Signed-off-by: discord9 <[REDACTED_EMAIL]>

* fix(mito2): treat a file without a recorded creator as the region's own

Files written before the partition expression was recorded carry no creator,

**File**: `src/common/meta/src/instruction.rs` (modified, +75/-4)
```diff
@@ -993,7 +993,7 @@ impl Display for SyncRegion {
     }
 }
 
-#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
+#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
 pub struct RemapManifest {
     pub region_id: RegionId,
     /// Regions to remap manifests from.
@@ -1002,14 +1002,33 @@ pub struct RemapManifest {
     pub region_mapping: HashMap<RegionId, Vec<RegionId>>,
     /// New partition expressions for the new regions.
     pub new_partition_exprs: HashMap<RegionId, String>,
+    /// Only verify that the remap would be accepted instead of writing staging manifests.
+    ///
+    /// The repartition procedure sends such a request to each *source leader* before it publishes
+    /// the new routes; the datanode then reads the region's persisted manifest and reports whether
+    /// the region holds a file it did not create itself. Nothing is staged and nothing is written.
+    ///
+    /// An older datanode ignores this unknown field (it is `#[serde(default)]`, so it simply
+    /// deserializes as `false`) and performs an ordinary remap. That is still safe: an ordinary
+    /// remap requires the region to be in staging state, and these sources are not staged yet, so
+    /// the datanode answers with the structured stage-required error
+    /// (`mito2::worker::handle_remap` → `InvalidRequest` "region is not in staging state"). Metasrv
+    /// therefore sees an error rather than a silent success, and aborts the group before the
+    /// routes are published.
+    #[serde(default)]
+    pub validate_only: bool,
 }
 
 impl Display for RemapManifest {
     fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
         write!(
             f,
-            "RemapManifest(region_id={}, input_regions={:?}, region_mapping={:?}, new_partition_exprs={:?})",
-            self.region_id, self.input_regions, self.region_mapping, self.new_partition_exprs
+            "RemapManifest(region_id={}, input_regions={:?}, region_mapping={:?}, new_partition_exprs={:?}, validate_only={})",
+            self.region_id,
+            self.input_regions,
+            self.region_mapping,
+            self.new_partition_exprs,
+            self.validate_only
         )
     }
 }
@@ -1477,7 +1496,7 @@ impl InstructionReply {
 
 #[cfg(test)]
 mod tests {
-    use std::collections::HashSet;
+    use std::collections::{HashMap, HashSet};
     use std::error::Error as _;
 
     use common_error::mock::MockError;
@@ -1563,6 +1582,58 @@ mod tests {
         assert_eq!(error.retry_hint.as_str(), "retry_after_route_refresh");
     }
 
+    #[test]
+    fn test_remap_manifest_wire_accepts_a_metasrv_without_validate_only() {
+        // A metasrv that predates the pre-publication check sends no `validate_only` key. A new
+        // datanode has to read that as an ordinary remap - the old behaviour - so a mixed
+        // cluster keeps working: nothing is staged yet, and the remap is refused.
+        let region_id = RegionId::new(1, 2);
+        let new_region_id = RegionId::new(1, 3);
+        let mut wire = serde_json::to_value(Instruction::RemapManifest(RemapManifest {
+            region_id,
+            input_regions: vec![region_id],
+            region_mapping: HashMap::from([(region_id, vec![new_region_id])]),
+            new_partition_exprs: HashMap::from([(
+                new_region_id,
+                "col(x) >= 0 AND col(x) < 100".to_string(),
+            )]),
+            validate_only: true,
+        }))
+        .unwrap();
+        wire["RemapManifest"]
+            .as_object_mut()
+            .unwrap()
+            .remove("validate_only");
+
+        let instruction: Instruction = serde_json::from_value(wire).unwrap();
+        let Instruction::RemapManifest(remap) = instruction else {
+            panic!("expected a remap manifest instruction");
+        };
+        assert!(!remap.validate_only);
+        assert_eq!(remap.region_id, region_id);
+
+        // A validate-only instruction is told apart by the key alone, and an old datanode that
+        // drops it performs an ordinary remap, which fails because nothing is staged: metasrv
+        // never mistakes it for a successful check.
+        let wire = serde_json::to_value(Instruction::RemapManifest(RemapManifest {
+            region_id,
+            input_regions: vec![region_id],
+            region_mapping: HashMap::from([(region_id, vec![new_region_id])]),
+            new_partition_exprs: HashMap::new(),
+            validate_only: true,
+        }))
+        .unwrap();
+        assert_eq!(
+            wire["RemapManifest"]["validate_only"],
+            serde_json::json!(true)
+        );
+        let decoded: Instruction = serde_json::from_value(wire).unwrap();
+        let Instruction::RemapManifest(decoded) = decoded else {
+            panic!("expected a remap manifest instruction");
+        };
+        assert!(decoded.validate_only);
+    }
+
     #[test]
     fn test_instruction_error_from_error() {
         
```

**File**: `src/datanode/src/heartbeat/handler/apply_staging_manifest.rs` (modified, +1/-0)
```diff
@@ -246,6 +246,7 @@ mod tests {
             .handle(
                 &handler_context,
                 RemapManifest {
+                    validate_only: false,
                     region_id,
                     input_regions: vec![region_id, region_id2],
                     region_mapping: HashMap::from([
```

**File**: `src/datanode/src/heartbeat/handler/remap_manifest.rs` (modified, +9/-2)
```diff
@@ -35,12 +35,14 @@ impl InstructionHandler for RemapManifestHandler {
             input_regions,
             region_mapping,
             new_partition_exprs,
+            validate_only,
         } = request;
         info!(
-            "Datanode received remap manifest request, region_id: {}, input_regions: {}, target_regions: {}",
+            "Datanode received remap manifest request, region_id: {}, input_regions: {}, target_regions: {}, validate_only: {}",
             region_id,
             input_regions.len(),
-            new_partition_exprs.len()
+            new_partition_exprs.len(),
+            validate_only
         );
         let Some(leader) = ctx.region_server.is_region_leader(region_id) else {
             warn!("Region: {} is not found", region_id);
@@ -65,6 +67,7 @@ impl InstructionHandler for RemapManifestHandler {
         let reply = match ctx
             .region_server
             .remap_manifests(RemapManifestsRequest {
+                validate_only,
                 region_id,
                 input_regions,
                 region_mapping,
@@ -131,6 +134,7 @@ mod tests {
             .handle(
                 &handler_context,
                 RemapManifest {
+                    validate_only: false,
                     region_id,
                     input_regions: vec![],
                     region_mapping: HashMap::new(),
@@ -161,6 +165,7 @@ mod tests {
             .handle(
                 &handler_context,
                 RemapManifest {
+                    validate_only: false,
                     region_id,
                     input_regions: vec![],
                     region_mapping: HashMap::new(),
@@ -225,6 +230,7 @@ mod tests {
             .handle(
                 &handler_context,
                 RemapManifest {
+                    validate_only: false,
                     region_id,
                     input_regions: vec![region_id, region_id2],
                     region_mapping: HashMap::from([
@@ -249,6 +255,7 @@ mod tests {
             .handle(
                 &handler_context,
                 RemapManifest {
+                    validate_only: false,
                     region_id,
                     input_regions: vec![region_id],
                     region_mapping: HashMap::from([
```

**File**: `src/meta-srv/src/procedure/repartition/collect.rs` (modified, +85/-10)
```diff
@@ -44,6 +44,10 @@ pub struct Collect {
     pub succeeded_procedures: Vec<ProcedureMeta>,
     /// Sub-procedures that have failed.
     pub failed_procedures: Vec<ProcedureMeta>,
+    /// The errors the failed sub-procedures reported, so that a caller of the parent procedure
+    /// learns why a group failed - for instance which region holds a file it did not create.
+    #[serde(default)]
+    pub failed_procedure_errors: Vec<String>,
     /// Sub-procedures whose state could not be determined.
     pub unknown_procedures: Vec<ProcedureMeta>,
 }
@@ -54,6 +58,7 @@ impl Collect {
             inflight_procedures,
             succeeded_procedures: Vec::new(),
             failed_procedures: Vec::new(),
+            failed_procedure_errors: Vec::new(),
             unknown_procedures: Vec::new(),
         }
     }
@@ -90,6 +95,8 @@ impl State for Collect {
                 Err(e) => {
                     error!(e; "failed to wait for repartition subprocedure, procedure_id: {}, group_id: {}", procedure_id, group_id);
                     self.failed_procedures.push(*procedure_meta);
+                    self.failed_procedure_errors
+                        .push(format!("group {group_id}: {}", describe_cause(&e)));
                 }
             }
         }
@@ -111,8 +118,11 @@ impl State for Collect {
                 .extend(self.unknown_procedures.iter());
             return crate::error::UnexpectedSnafu {
                 violated: format!(
-                    "Repartition groups failed or became unknown, table_id: {}, failed: {}, unknown: {}",
-                    table_id, failed, unknown
+                    "Repartition groups failed or became unknown, table_id: {}, failed: {}, unknown: {}{}",
+                    table_id,
+                    failed,
+                    unknown,
+                    describe_failed_groups(&self.failed_procedure_errors)
                 ),
             }
             .fail();
@@ -130,18 +140,54 @@ impl State for Collect {
     }
 }
 
+/// Renders `error` together with every cause it wraps.
+///
+/// [`watcher::wait`] reports a child failure as `ProcedureExec`, whose own message is only
+/// "Failed to execute procedure": the reason a group failed - which region holds a file it did
+/// not create - lives in the wrapped error. Walking the source chain keeps it, so the parent
+/// error a SQL caller sees still names the region and the file.
+fn describe_cause(error: &(dyn std::error::Error + 'static)) -> String {
+    let mut message = error.to_string();
+    let mut cause = error.source();
+    while let Some(error) = cause {
+        let text = error.to_string();
+        if !message.contains(&text) {
+            message.push_str(": ");
+            message.push_str(&text);
+        }
+        cause = error.source();
+    }
+    message
+}
+
+/// Appends the errors of the failed groups, bounded so an error message stays readable.
+fn describe_failed_groups(errors: &[String]) -> String {
+    const MAX_REPORTED: usize = 4;
+    if errors.is_empty() {
+        return String::new();
+    }
+    let mut details = errors
+        .iter()
+        .take(MAX_REPORTED)
+        .cloned()
+        .collect::<Vec<_>>()
+        .join("; ");
+    if errors.len() > MAX_REPORTED {
+        details.push_str(&format!("; and {} more", errors.len() - MAX_REPORTED));
+    }
+    format!(": {details}")
+}
+
 #[cfg(test)]
 mod tests {
     use std::sync::Arc;
 
-    use common_error::mock::MockError;
-    use common_error::status_code::StatusCode;
     use common_meta::test_util::MockDatanodeManager;
     use common_procedure::{
-        Context as ProcedureContext, ContextProvider, Error as ProcedureError, ProcedureId,
-        ProcedureState,
+        Context as ProcedureContext, ContextProvider, ProcedureId, ProcedureState,
     };
     use common_procedure_test::MockContextProvider;
+    use store_api::storage::RegionId;
     use tokio::sync::watch;
 
     use super::*;
@@ -204,6 +250,7 @@ mod tests {
             inflight_procedures: vec![],
             succeeded_procedures: vec![],
             failed_procedures: vec![],
+            failed_procedure_errors: vec![],
             unknown_procedures: vec![ProcedureMeta {
                 plan_index: 0,
                 group_id: uuid::Uuid::new_v4(),
@@ -234,12 +281,22 @@ mod tests {
             env.server_addr.clone(),
             persistent_ctx,
         );
+        // The group fails the way a refused merge does: the child error names the region that
+        // holds a file it did not create, and the file. The parent error has to keep both, so
+        // the fixture fixes them here and the assertions below look for these very values.
+        let refused_region = RegionId::new(1024, 1);
+        let refused_file = "018f3b1e-0000-7000-8000-0000000000aa";
+        let child_error = common_procedure::error::UnexpectedSnafu {
+            err_msg: format!(
+                "region {refused_region} holds file {refused_fi
```

**File**: `src/meta-srv/src/procedure/repartition/group/remap_manifest.rs` (modified, +1/-0)
```diff
@@ -121,6 +121,7 @@ impl RemapManifest {
             input_regions: source_regions.iter().map(|r| r.region_id()).collect(),
             region_mapping: region_mapping.clone(),
             new_partition_exprs,
+            validate_only: false,
         })
     }
 
```

**File**: `src/meta-srv/src/procedure/repartition/group/repartition_start.rs` (modified, +7/-0)
```diff
@@ -24,6 +24,7 @@ use snafu::{OptionExt, ensure};
 use crate::error::{self, Result};
 use crate::procedure::repartition::group::sync_region::SyncRegion;
 use crate::procedure::repartition::group::update_metadata::UpdateMetadata;
+use crate::procedure::repartition::group::utils::validate_merge_sources;
 use crate::procedure::repartition::group::{
     Context, GroupId, GroupPrepareResult, State, region_routes,
 };
@@ -146,6 +147,9 @@ impl State for RepartitionStart {
         _procedure_ctx: &ProcedureContext,
     ) -> Result<(Box<dyn State>, Status)> {
         if ctx.persistent_ctx.group_prepare_result.is_some() {
+            // Refuse a merge whose sources still hold another region's files while the old
+            // routes are still the published ones.
+            validate_merge_sources(ctx).await?;
             return Ok((
                 Box::new(UpdateMetadata::ApplyStaging),
                 Status::executing(true),
@@ -191,6 +195,9 @@ impl State for RepartitionStart {
             }
         }
 
+        // The last edge into `UpdateMetadata::ApplyStaging`: the routes are still the old ones
+        // here, so a refusal cannot strand an acknowledged write on an unpublished route.
+        validate_merge_sources(ctx).await?;
         Ok((
             Box::new(UpdateMetadata::ApplyStaging),
             Status::executing(true),
```

**File**: `src/meta-srv/src/procedure/repartition/group/sync_region.rs` (modified, +3/-0)
```diff
@@ -37,6 +37,7 @@ use crate::handler::HeartbeatMailbox;
 use crate::procedure::repartition::group::update_metadata::UpdateMetadata;
 use crate::procedure::repartition::group::utils::{
     HandleMultipleResult, group_region_routes_by_peer, handle_multiple_results,
+    validate_merge_sources,
 };
 use crate::procedure::repartition::group::{Context, State};
 use crate::procedure::utils::{ErrorStrategy, instruction_error_result};
@@ -60,6 +61,8 @@ impl State for SyncRegion {
     ) -> Result<(Box<dyn State>, Status)> {
         Self::flush_central_region(ctx).await?;
         self.sync_with_paused_source(ctx).await?;
+        // The other edge into `UpdateMetadata::ApplyStaging`, still before publication.
+        validate_merge_sources(ctx).await?;
 
         Ok((
             Box::new(UpdateMetadata::ApplyStaging),
```

**File**: `src/meta-srv/src/procedure/repartition/group/utils.rs` (modified, +590/-1)
```diff
@@ -13,12 +13,23 @@
 // limitations under the License.
 
 use std::collections::HashMap;
+use std::time::Instant;
 
+use api::v1::meta::MailboxMessage;
+use common_error::ext::ErrorExt;
+use common_meta::instruction::{Instruction, InstructionReply};
 use common_meta::peer::Peer;
 use common_meta::rpc::router::RegionRoute;
+use common_telemetry::tracing_context::TracingContext;
+use common_telemetry::warn;
+use common_time::util as time_util;
+use snafu::{OptionExt, ResultExt};
 use store_api::storage::RegionId;
 
-use crate::error::{Error, Result};
+use crate::error::{self, Error, Result};
+use crate::handler::HeartbeatMailbox;
+use crate::procedure::repartition::group::Context;
+use crate::service::mailbox::{Channel, MailboxRef};
 
 /// Groups the region routes by the leader peer.
 ///
@@ -86,3 +97,581 @@ pub(crate) fn handle_multiple_results<'a>(results: &'a [Result<()>]) -> HandleMu
         (true, true) => HandleMultipleResult::AllSuccessful,
     }
 }
+
+/// Verifies that every source of a **merge** holds only the files it created itself, before the
+/// procedure publishes the new routes.
+///
+/// The remap-time guard in mito2 refuses the same state, but it fires inside `RemapManifest`,
+/// which runs *after* `UpdateMetadata::ApplyStaging` has already published the target write
+/// routes: an acknowledged write could then land in a region the rollback no longer routes
+/// correctly. This asks each merge source leader first, with a validate-only remap that only
+/// reads the region's persisted manifest, so the refusal happens while the old routes still apply.
+///
+/// A one-to-many split is exempt: every target receives only that source's files and no target
+/// combines copies, so the check is skipped unless two or more sources feed the same target.
+pub(crate) async fn validate_merge_sources(ctx: &Context) -> Result<()> {
+    // Only a target fed by two or more distinct sources can publish one object twice, so only the
+    // sources that feed such a target are checked. The remap-time guard exempts exactly the other
+    // shapes through the same predicate, so a repartition this check lets through cannot be
+    // refused after its routes are published.
+    let checked_sources =
+        store_api::region_engine::sources_sharing_a_target(&ctx.persistent_ctx.region_mapping);
+    if checked_sources.is_empty() {
+        return Ok(());
+    }
+    let Some(prepare_result) = ctx.persistent_ctx.group_prepare_result.as_ref() else {
+        // The prepare result is captured by `RepartitionStart` before any edge into
+        // `UpdateMetadata::ApplyStaging`, so it is always present here.
+        return Ok(());
+    };
+
+    let operation_timeout = ctx
+        .next_operation_timeout()
+        .context(error::ExceededDeadlineSnafu {
+            operation: "Validate merge sources",
+        })?;
+
+    let mut requests = Vec::with_capacity(checked_sources.len());
+    for &region_id in &checked_sources {
+        // A source without a route would silently go unchecked, so refuse to guess.
+        let route = prepare_result
+            .source_routes
+            .iter()
+            .find(|route| route.region.id == region_id)
+            .context(error::UnexpectedSnafu {
+                violated: format!("No source route for region: {region_id}"),
+            })?;
+        let peer = route.leader_peer.clone().context(error::UnexpectedSnafu {
+            violated: format!("Leader peer is not set for source region: {region_id}"),
+        })?;
+        requests.push((region_id, peer));
+    }
+
+    let mut pending = Vec::with_capacity(requests.len());
+    for (region_id, peer) in requests {
+        let instruction = build_validate_only_instruction(ctx, region_id)?;
+        pending.push(send_validate_only(
+            ctx.mailbox.clone(),
+            ctx.server_addr.clone(),
+            peer,
+            instruction,
+            operation_timeout,
+        ));
+    }
+    let results = futures::future::join_all(pending).await;
+
+    let mut offenders = Vec::new();
+    for (region_id, result) in checked_sources.into_iter().zip(results) {
+        match result {
+            Ok(()) => {}
+            // A retryable failure - a mailbox timeout, a channel that closed, a region that is
+            // not a leader yet - says nothing about which region owns what. It reaches the
+            // procedure as retryable, so it is retried instead of turning into a terminal
+            // "compact the region" refusal.
+            Err(err) if err.retry_hint().is_retryable() => return Err(err),
+            Err(err) => offenders.push(format!("region {region_id}: {err}")),
+        }
+    }
+
+    if offenders.is_empty() {
+        return Ok(());
+    }
+    error::UnexpectedSnafu {
+        violated: format!(
+            "The repartition refuses to merge regions that hold files another region created, \
+             before the new routes are published: {}. Compact the offending regions
```

---

### Incident Patch 2: `5cd42ef8` (2026-11-26)
**Commit Message**: fix(mito2): make table compaction publication retries idempotent (#10651)

* fix(mito2): make table compaction publication retries idempotent

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

* fix(mito2): allow table compaction publication across region option changes

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

* fix(mito2): preserve exact sequence reads across table compaction publication

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

* fix(mito2): guard mixed compaction inputs after sequence preservation is enabled

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

* fix(mito2): check sequence policy before verifying compaction outputs

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

---------

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

**File**: `src/mito2/src/engine/edit_region_test.rs` (modified, +1/-1)
```diff
@@ -103,7 +103,7 @@ async fn test_delayed_series_index_notification_after_removal() -> WhateverResul
                             ..Default::default()
                         },
                         waiters: crate::request::Waiters::one(tx),
-                        result: Ok(()),
+                        result: Ok(crate::request::RegionEditOutcome::Written),
                         is_staging: false,
                         update_region_state: false,
                     },
```

**File**: `src/mito2/src/engine/table_compaction.rs` (modified, +3/-3)
```diff
@@ -50,8 +50,10 @@ pub(crate) struct PublicationContext {
 /// A result for this publication attempt, not a durable task receipt.
 #[derive(Debug, Clone, Copy, PartialEq, Eq)]
 pub enum PublicationOutcome {
+    /// This attempt installed the replacement, or its nonempty outputs are still fully visible
+    /// with all of its inputs absent.
     Applied,
-    /// The captured inputs/schema/options no longer match. Re-snapshot and replan.
+    /// The schema or file set no longer matches this publication. Re-snapshot and replan.
     StaleInputs,
 }
 
@@ -99,8 +101,6 @@ impl MitoEngine {
                 reason: "Publication requires this region's nonempty input snapshot"
             }
         );
-        // The public snapshot keeps JSON options; parse them once here so the
-        // worker compares typed options and reads typed flags without reparsing.
         let options = serde_json::from_value(snapshot.options).context(SerdeJsonSnafu)?;
         let edit = RegionEdit {
             files_to_remove: snapshot.inputs,
```

**File**: `src/mito2/src/engine/table_compaction/tests.rs` (modified, +215/-81)
```diff
@@ -21,7 +21,9 @@ use common_time::Timestamp;
 use common_time::timestamp::TimeUnit;
 use parquet::file::metadata::ParquetMetaData;
 use store_api::region_engine::{RegionEngine, RegionRole};
-use store_api::region_request::{RegionRequest, RegionTruncateRequest};
+use store_api::region_request::{
+    AlterKind, RegionAlterRequest, RegionRequest, RegionTruncateRequest, SetRegionOption,
+};
 use store_api::storage::{FileId, RegionId};
 
 use super::{PublicationOutcome, TableCompactionSnapshot};
@@ -147,12 +149,24 @@ async fn row_count(engine: &MitoEngine, region_id: RegionId) -> usize {
     .sum()
 }
 
+#[rstest::rstest]
+#[case::fresh(false)]
+#[case::replay(true)]
 #[tokio::test]
-async fn test_publication_refused_awaiting_leader_lease() {
+async fn test_publication_refused_awaiting_leader_lease(#[case] replay: bool) {
     let mut env = TestEnv::new().await;
     let engine = env.create_engine(config()).await;
     let region_id = RegionId::new(1, 1);
     let (snapshot, output) = seed(&engine, region_id).await;
+    if replay {
+        assert_eq!(
+            PublicationOutcome::Applied,
+            engine
+                .publish_table_compaction(region_id, snapshot.clone(), vec![output.clone()])
+                .await
+                .unwrap()
+        );
+    }
     engine.require_write_lease();
     engine.freeze_lease_clock(Instant::now());
     promote_to_await_leader_lease(&engine, region_id).await;
@@ -196,25 +210,16 @@ async fn test_duplicate_publication_and_later_replacement_do_not_readmit_inputs(
     let (snapshot, output) = seed(&engine, region_id).await;
     let region = engine.get_region(region_id).unwrap();
     let sequence = region.version_control.committed_sequence();
+    let version = region.manifest_ctx.manifest_version().await;
     let (first, second) = tokio::join!(
         engine.publish_table_compaction(region_id, snapshot.clone(), vec![output.clone()]),
         engine.publish_table_compaction(region_id, snapshot.clone(), vec![output.clone()])
     );
-    let outcomes = [first.unwrap(), second.unwrap()];
     assert_eq!(
-        1,
-        outcomes
-            .iter()
-            .filter(|outcome| **outcome == PublicationOutcome::Applied)
-            .count()
-    );
-    assert_eq!(
-        1,
-        outcomes
-            .iter()
-            .filter(|outcome| **outcome == PublicationOutcome::StaleInputs)
-            .count()
+        [PublicationOutcome::Applied; 2],
+        [first.unwrap(), second.unwrap()]
     );
+    assert_eq!(version + 1, region.manifest_ctx.manifest_version().await);
     assert_eq!(sequence, region.version_control.committed_sequence());
     assert_eq!(sequence, region.version_control.current().last_sequence);
     assert_eq!(3, row_count(&engine, region_id).await);
@@ -266,6 +271,45 @@ async fn test_duplicate_publication_and_later_replacement_do_not_readmit_inputs(
     assert_eq!(3, row_count(&engine, region_id).await);
 }
 
+#[tokio::test]
+async fn test_replay_requires_all_inputs_absent_and_all_outputs_matching() {
+    let mut env = TestEnv::new().await;
+    let engine = env.create_engine(config()).await;
+    let region_id = RegionId::new(1, 1);
+    let (snapshot, outputs) = seed_shared_inputs(&engine, region_id, &[(0, 3), (3, 6)]).await;
+    let mut subset = snapshot.clone();
+    subset.inputs.truncate(1);
+    let output = outputs[0].clone();
+    assert_eq!(
+        PublicationOutcome::Applied,
+        engine
+            .publish_table_compaction(region_id, subset.clone(), vec![output.clone()])
+            .await
+            .unwrap()
+    );
+    let region = engine.get_region(region_id).unwrap();
+    let version = region.manifest_ctx.manifest_version().await;
+    let different = FileMeta {
+        file_size: output.file_size + 1,
+        ..output.clone()
+    };
+    for (request, expected_outputs) in [
+        (snapshot, vec![output]),
+        (subset.clone(), outputs),
+        (subset, vec![different]),
+    ] {
+        assert_eq!(
+            PublicationOutcome::StaleInputs,
+            engine
+                .publish_table_compaction(region_id, request, expected_outputs)
+                .await
+                .unwrap()
+        );
+    }
+    assert_eq!(version, region.manifest_ctx.manifest_version().await);
+    assert_eq!(6, row_count(&engine, region_id).await);
+}
+
 #[tokio::test]
 async fn test_partial_success_can_retry_both_regions_without_duplicate_files() {
     let mut env = TestEnv::new().await;
@@ -292,7 +336,7 @@ async fn test_partial_success_can_retry_both_regions_without_duplicate_files() {
         engine.publish_table_compaction(a, snapshot_a, vec![output_a.clone()]),
         engine.publish_table_compaction(b, snapshot_b, vec![output_b.clone()])
     );
-    assert_eq!(PublicationOutcome::StaleInputs, retry_a.unwrap());
+    assert_eq!(PublicationOutcome::Applied, retry_a.unwrap());
     assert_eq!(PublicationOutcome::Applied, retry_b.unwrap());
     for (id, output) in [(a, out
```

**File**: `src/mito2/src/region.rs` (modified, +14/-4)
```diff
@@ -2172,10 +2172,9 @@ impl ManifestContext {
         commit: impl AsyncFnOnce(&mut RegionManifestManager) -> Result<T>,
     ) -> Result<T> {
         let region_id = manager.manifest().metadata.region_id;
-        let result = if manager.is_conditional_publication() && self.is_leader_lease_expired() {
-            RegionLeaseExpiredSnafu { region_id }.fail()
-        } else {
-            commit(manager).await
+        let result = match self.ensure_commit_deadline(manager) {
+            Ok(()) => commit(manager).await,
+            Err(error) => Err(error),
         };
         if let Err(e) = &result {
             error!(e; "Failed to update manifest, region_id: {}", region_id);
@@ -2186,6 +2185,17 @@ impl ManifestContext {
         result
     }
 
+    /// Checks the leader deadline for a conditionally published manifest.
+    pub(crate) fn ensure_commit_deadline(&self, manager: &RegionManifestManager) -> Result<()> {
+        ensure!(
+            !manager.is_conditional_publication() || !self.is_leader_lease_expired(),
+            RegionLeaseExpiredSnafu {
+                region_id: manager.manifest().metadata.region_id
+            }
+        );
+        Ok(())
+    }
+
     /// Returns whether a commit, once written, checks that no checkpoint covers its version: a
     /// region past its Leader deadline may no longer hold the region, and one that [awaits its
     /// Leader lease](Self::awaits_leader_lease) may not hold it yet, so either may have written a
```

**File**: `src/mito2/src/request.rs` (modified, +10/-2)
```diff
@@ -1583,7 +1583,15 @@ impl RegionEditRequest {
     }
 }
 
-/// Notifies the regin the result of editing region.
+/// Whether the worker needs to install the edit in the in-memory version.
+#[derive(Debug)]
+pub(crate) enum RegionEditOutcome {
+    Written,
+    #[cfg(feature = "enterprise")]
+    AlreadyApplied,
+}
+
+/// Notifies the region of the result of editing its manifest.
 #[derive(Debug)]
 pub(crate) struct RegionEditResult {
     /// Region id.
@@ -1595,7 +1603,7 @@ pub(crate) struct RegionEditResult {
     /// Region edit to apply.
     pub(crate) edit: RegionEdit,
     /// Result from the manifest manager.
-    pub(crate) result: std::result::Result<(), Arc<Error>>,
+    pub(crate) result: std::result::Result<RegionEditOutcome, Arc<Error>>,
     /// Whether region state need to be set to Writable after handling this request.
     pub(crate) update_region_state: bool,
     /// The region is in staging mode before handling this request.
```

**File**: `src/mito2/src/series_index/task.rs` (modified, +5/-2)
```diff
@@ -37,7 +37,8 @@ use crate::metrics::{
 use crate::read::series_candidate::is_sparse_metric_metadata;
 use crate::region::{MitoRegionRef, RegionLeaderState, RegionMapRef, RegionRoleState};
 use crate::request::{
-    BackgroundNotify, RegionEditResult, Waiters, WorkerRequest, WorkerRequestWithTime,
+    BackgroundNotify, RegionEditOutcome, RegionEditResult, Waiters, WorkerRequest,
+    WorkerRequestWithTime,
 };
 
 use crate::series_index::maintenance::{ReconcileStats, reconcile_series_indexes_with_mode};
@@ -616,7 +617,9 @@ impl SeriesIndexTask {
                 region_id: region.region_id,
                 origin: region.clone(),
                 edit,
-                result: result.map_err(Arc::new),
+                result: result
+                    .map(|()| RegionEditOutcome::Written)
+                    .map_err(Arc::new),
                 waiters: Waiters::one(tx),
                 is_staging: false,
                 update_region_state: false,
```

**File**: `src/mito2/src/worker/handle_manifest.rs` (modified, +16/-17)
```diff
@@ -46,8 +46,8 @@ use crate::region::version::VersionControlRef;
 use crate::region::{MitoRegionRef, RegionLeaderState, RegionRoleState};
 use crate::request::{
     BackgroundNotify, BuildIndexRequest, DdlRequest, DiscardUnflushedResult, OptionOutputTx,
-    RegionChangeResult, RegionEditKind, RegionEditRequest, RegionEditResult, RegionSyncRequest,
-    SenderDdlRequest, TruncateResult, WorkerRequest, WorkerRequestWithTime,
+    RegionChangeResult, RegionEditKind, RegionEditOutcome, RegionEditRequest, RegionEditResult,
+    RegionSyncRequest, SenderDdlRequest, TruncateResult, WorkerRequest, WorkerRequestWithTime,
 };
 use crate::sst::index::IndexBuildType;
 use crate::sst::{file, location};
@@ -465,17 +465,16 @@ impl<S: LogStore> RegionWorkerLoop<S> {
         // Updates manifest in background.
         common_runtime::spawn_global(async move {
             let result = match kind {
-                RegionEditKind::Import => {
-                    edit_region(
-                        &region,
-                        &mut edit,
-                        cache_manager,
-                        listener,
-                        is_staging,
-                        preload_sst_cache,
-                    )
-                    .await
-                }
+                RegionEditKind::Import => edit_region(
+                    &region,
+                    &mut edit,
+                    cache_manager,
+                    listener,
+                    is_staging,
+                    preload_sst_cache,
+                )
+                .await
+                .map(|()| RegionEditOutcome::Written),
                 #[cfg(feature = "enterprise")]
                 RegionEditKind::Compaction(context) => {
                     crate::worker::handle_table_compaction::publish(&region, &context, edit.clone())
@@ -573,16 +572,16 @@ impl<S: LogStore> RegionWorkerLoop<S> {
 
             false
         } else {
+            let written = matches!(edit_result.result, Ok(RegionEditOutcome::Written));
             let need_compaction = self.config.schedule_compaction_after_edit
-                && edit_result.result.is_ok()
+                && written
                 && edit_result
                     .edit
                     .files_to_add
                     .iter()
                     .any(|file| file.level < file::LEVEL_SHARED);
 
-            // Only apply the edit if the result is ok and region is not in staging state.
-            if edit_result.result.is_ok() {
+            if written {
                 let mut edit = edit_result.edit;
                 // A background publication can be superseded before its notification arrives.
                 let guard = if !edit_result.update_region_state {
@@ -617,7 +616,7 @@ impl<S: LogStore> RegionWorkerLoop<S> {
         edit_result
             .waiters
             .reply_with(|| match &edit_result.result {
-                Ok(()) => Ok(()),
+                Ok(_) => Ok(()),
                 Err(e) => Err(e.clone()).context(EditRegionSnafu {
                     region_id: edit_result.region_id,
                 }),
```

**File**: `src/mito2/src/worker/handle_table_compaction.rs` (modified, +75/-34)
```diff
@@ -19,24 +19,21 @@ use crate::engine::table_compaction::{PublicationContext, output};
 use crate::error::{InvalidRequestSnafu, RegionBusySnafu, Result, StaleCompactionExecutionSnafu};
 use crate::manifest::action::{RegionEdit, RegionManifest, RegionMetaAction, RegionMetaActionList};
 use crate::region::{MitoRegionRef, RegionLeaderState, RegionRoleState};
-use crate::sst::file::LEVEL_SHARED;
+use crate::request::RegionEditOutcome;
+use crate::sst::file::{FileMeta, LEVEL_SHARED};
 
 pub(crate) async fn publish(
     region: &MitoRegionRef,
     context: &PublicationContext,
     edit: RegionEdit,
-) -> Result<()> {
+) -> Result<RegionEditOutcome> {
     let snapshot = region.manifest_ctx.manifest().await;
-    // An old result can name outputs already compacted away. Reject stale inputs
-    // before inspecting those objects; absence of an output is not a task receipt.
-    ensure!(
-        is_current(region, context, &edit, &snapshot),
-        StaleCompactionExecutionSnafu {
-            region_id: region.region_id
-        }
-    );
-    validate_files(region, context, &edit, &snapshot)?;
-    output::verify_and_notify(region, &context.metadata, &edit.files_to_add).await?;
+    let replay = is_replay(region, context, &edit, &snapshot)?;
+    validate_files(region, context, &edit)?;
+    if !replay {
+        check_sequence_policy(region, context, &edit)?;
+        output::verify_and_notify(region, &context.metadata, &edit.files_to_add).await?;
+    }
 
     let mut manager = region.manifest_ctx.manifest_manager.write().await;
     ensure!(
@@ -48,14 +45,21 @@ pub(crate) async fn publish(
             region_id: region.region_id
         }
     );
-    let manifest = manager.manifest();
+    if is_replay(region, context, &edit, &manager.manifest())? {
+        region
+            .manifest_ctx
+            .ensure_leader_lease_or_downgrading(region.region_id)?;
+        region.manifest_ctx.ensure_commit_deadline(&manager)?;
+        return Ok(RegionEditOutcome::AlreadyApplied);
+    }
+    // A previously satisfied request skipped object verification.
     ensure!(
-        is_current(region, context, &edit, &manifest),
+        !replay,
         StaleCompactionExecutionSnafu {
             region_id: region.region_id
         }
     );
-    validate_files(region, context, &edit, &manifest)?;
+    check_sequence_policy(region, context, &edit)?;
     let pending = match region
         .manifest_ctx
         .update_locked(
@@ -77,30 +81,71 @@ pub(crate) async fn publish(
     };
     drop(manager);
     pending.fire().await;
+    Ok(RegionEditOutcome::Written)
+}
+
+fn check_sequence_policy(
+    region: &MitoRegionRef,
+    context: &PublicationContext,
+    edit: &RegionEdit,
+) -> Result<()> {
+    // An exact scan can skip an unmarked input below its lower bound, but
+    // an unmarked replacement can inherit a higher sequence from another input.
+    if !context.options.preserve_row_sequence && region.version().options.preserve_row_sequence {
+        ensure!(
+            edit.files_to_add
+                .iter()
+                .all(|file| file.preserve_row_sequence),
+            StaleCompactionExecutionSnafu {
+                region_id: region.region_id
+            }
+        );
+    }
     Ok(())
 }
 
-fn is_current(
+fn is_replay(
     region: &MitoRegionRef,
     context: &PublicationContext,
     edit: &RegionEdit,
     manifest: &RegionManifest,
-) -> bool {
-    let current = region.version_control.current();
-    context.metadata == manifest.metadata
-        && context.options == current.version.options
-        && !edit.files_to_remove.is_empty()
-        && edit
-            .files_to_remove
+) -> Result<bool> {
+    let region_id = region.region_id;
+    ensure!(
+        context.metadata == manifest.metadata && !edit.files_to_remove.is_empty(),
+        StaleCompactionExecutionSnafu { region_id }
+    );
+    let matches =
+        |file: &FileMeta| manifest.files.get(&file.file_id).map(AsRef::as_ref) == Some(file);
+    if edit.files_to_remove.iter().all(matches) {
+        ensure!(
+            edit.files_to_add
+                .iter()
+                .all(|file| !manifest.files.contains_key(&file.file_id)),
+            InvalidRequestSnafu {
+                region_id,
+                reason: "Invalid region-local compaction output"
+            }
+        );
+        return Ok(false);
+    }
+
+    // With no durable receipt, only a still-visible, nonempty replacement proves success.
+    ensure!(
+        edit.files_to_remove
             .iter()
-            .all(|file| manifest.files.get(&file.file_id).map(AsRef::as_ref) == Some(file))
+            .all(|file| !manifest.files.contains_key(&file.file_id))
+            && !edit.files_to_add.is_empty()
+            && edit.files_to_add.iter().all(matches),
+        StaleCompactionExecutionSnafu { region_id }
+    );
+    Ok(true)
 }
 
 fn validate_files(
     region: &MitoRegionRef,
     context: &PublicationContext,
    
```

---

### Incident Patch 3: `59b108af` (2026-11-27)
**Commit Message**: fix(procedure): recover from the last readable checkpoint (#10612)

* fix(procedure): recover from the last readable checkpoint

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

* fix(procedure): keep unreadable checkpoints out of GC checks

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

* fix(procedure): use the SNAFU selector for corrupt checkpoints

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

---------

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

**File**: `src/common/procedure/src/error.rs` (modified, +6/-7)
```diff
@@ -211,13 +211,12 @@ pub enum Error {
         location: Location,
     },
 
-    #[snafu(display("Failed to parse segment key: {key}"))]
-    ParseSegmentKey {
-        #[snafu(implicit)]
-        location: Location,
+    #[snafu(display("Corrupt checkpoint {key}: {reason}"))]
+    CorruptCheckpoint {
         key: String,
-        #[snafu(source)]
-        error: std::num::ParseIntError,
+        /// Actual stored keys, including surviving segments when the base key is missing.
+        keys: Vec<String>,
+        reason: String,
     },
 
     #[snafu(display("Unexpected: {err_msg}"))]
@@ -281,7 +280,7 @@ impl ErrorExt for Error {
                 StatusCode::InvalidArguments
             }
             Error::ProcedurePanic { .. }
-            | Error::ParseSegmentKey { .. }
+            | Error::CorruptCheckpoint { .. }
             | Error::Unexpected { .. }
             | &Error::ProcedureNotFound { .. }
             | Error::PoisonKeyNotDefined { .. } => StatusCode::Unexpected,
```

**File**: `src/common/procedure/src/store.rs` (modified, +133/-53)
```diff
@@ -16,11 +16,11 @@ use std::collections::HashMap;
 use std::fmt;
 
 use common_telemetry::{debug, error, info, warn};
-use futures::TryStreamExt;
+use futures::StreamExt;
 use serde::{Deserialize, Serialize};
 use snafu::ResultExt;
 
-use crate::error::{Result, ToJsonSnafu};
+use crate::error::{Error, Result, ToJsonSnafu};
 pub(crate) use crate::store::state_store::StateStoreRef;
 use crate::{ProcedureContext, ProcedureId, SubprocedureRecovery};
 
@@ -203,17 +203,21 @@ impl ProcedureStore {
         // 8 should be enough for most procedures.
         let mut step_keys = Vec::with_capacity(8);
         let mut finish_keys = Vec::new();
-        while let Some((key_set, _)) = key_values.try_next().await? {
-            let key = key_set.key();
-            let Some(curr_key) = ParsedKey::parse_str(&self.proc_path, key) else {
+        while let Some(item) = key_values.next().await {
+            let (key, keys) = match item {
+                Ok((key_set, _)) => (key_set.key().to_owned(), key_set.keys()),
+                Err(Error::CorruptCheckpoint { key, keys, .. }) => (key, keys),
+                Err(error) => return Err(error),
+            };
+            let Some(curr_key) = ParsedKey::parse_str(&self.proc_path, &key) else {
                 warn!("Unknown key while deleting procedures, key: {}", key);
                 continue;
             };
             if curr_key.key_type == KeyType::Step {
-                step_keys.extend(key_set.keys());
+                step_keys.extend(keys);
             } else {
                 // .commit or .rollback
-                finish_keys.extend(key_set.keys());
+                finish_keys.extend(keys);
             }
         }
 
@@ -235,79 +239,96 @@ impl ProcedureStore {
 
     /// Load procedures from the storage.
     pub(crate) async fn load_messages(&self) -> Result<ProcedureMessages> {
-        // Track the key-value pair by procedure id.
-        let mut procedure_key_values: HashMap<_, (ParsedKey, Vec<u8>)> = HashMap::new();
-
-        // Scan all procedures.
-        let mut key_values = self.store.walk_top_down(&self.proc_path).await?;
-        while let Some((key_set, value)) = key_values.try_next().await? {
-            let key = key_set.key();
-            let Some(curr_key) = ParsedKey::parse_str(&self.proc_path, key) else {
+        // Keep one usable checkpoint per procedure even if keys arrive out of order.
+        let mut latest = HashMap::new();
+        let mut damaged = HashMap::<ProcedureId, ParsedKey>::new();
+        let mut stream = self.store.walk_top_down(&self.proc_path).await?;
+        while let Some(item) = stream.next().await {
+            let (key, value) = match item {
+                Ok((key, value)) => (key.key().to_owned(), Ok(value)),
+                Err(Error::CorruptCheckpoint { key, reason, .. }) => (key, Err(reason)),
+                Err(error) => return Err(error),
+            };
+            let Some(parsed) = ParsedKey::parse_str(&self.proc_path, &key) else {
                 warn!("Unknown key while loading procedures, key: {}", key);
                 continue;
             };
-
-            if let Some(entry) = procedure_key_values.get_mut(&curr_key.procedure_id) {
-                if entry.0.step < curr_key.step {
-                    entry.0 = curr_key;
-                    entry.1 = value;
+            let id = parsed.procedure_id;
+            let message = value.and_then(|value| match parsed.key_type {
+                KeyType::Commit => Ok(None),
+                _ => serde_json::from_slice::<ProcedureMessage>(&value)
+                    .map(Some)
+                    .map_err(|e| e.to_string()),
+            });
+            match message {
+                Ok(message) => {
+                    let rank = (parsed.step, parsed.key_type);
+                    if latest.get(&id).is_none_or(|(old, _)| *old < rank) {
+                        latest.insert(id, (rank, message));
+                    }
+                }
+                Err(reason) => {
+                    error!(
+                        "Unreadable procedure checkpoint, procedure_id: {id}, key: {key}, reason: {reason}"
+                    );
+                    if damaged
+                        .get(&id)
+                        .is_none_or(|old| (old.step, old.key_type) < (parsed.step, parsed.key_type))
+                    {
+                        damaged.insert(id, parsed);
+                    }
                 }
-            } else {
-                let _ = procedure_key_values.insert(curr_key.procedure_id, (curr_key, value));
             }
         }
 
-        let mut messages = HashMap::with_capacity(procedure_key_values.len());
+        let mut messages = HashMap::new();
         let mut rollback_messages = HashMap::new();
         let mut finished_ids = Vec::new();
-        for (procedure_id, (parsed_key, value)) in procedure_key_values {
-            match parsed_key.key_type {
+        for (id, ((step, kind), messa
```

**File**: `src/common/procedure/src/store/util.rs` (modified, +94/-84)
```diff
@@ -14,89 +14,73 @@
 
 use std::pin::Pin;
 
-use async_stream::try_stream;
-use futures::{Stream, TryStreamExt};
-use snafu::{ResultExt, ensure};
+use async_stream::stream;
+use futures::{Stream, StreamExt};
 
 use crate::error;
 use crate::error::Result;
 use crate::store::state_store::KeySet;
 
 struct CollectingState {
+    key: String,
     pairs: Vec<(String, Vec<u8>)>,
 }
 
-fn parse_segments(segments: Vec<(String, Vec<u8>)>, prefix: &str) -> Result<Vec<(usize, Vec<u8>)>> {
-    segments
-        .into_iter()
-        .map(|(key, value)| {
-            let suffix = key.trim_start_matches(prefix);
-            let index = suffix
-                .parse::<usize>()
-                .context(error::ParseSegmentKeySnafu { key })?;
-
-            Ok((index, value))
-        })
-        .collect::<Result<Vec<_>>>()
-}
-
-/// Merges multiple values into a single key-value pair.
-/// Returns an error if:
-/// - Part values are lost.
-/// - Failed to parse the key of segment.
-fn merge_multiple_values(
-    CollectingState { mut pairs }: CollectingState,
-) -> Result<(KeySet, Vec<u8>)> {
-    if pairs.len() == 1 {
-        // Safety: must exist.
-        let (key, value) = pairs.into_iter().next().unwrap();
-        Ok((KeySet::new(key, 0), value))
-    } else {
-        let segments = pairs.split_off(1);
-        // Safety: must exist.
-        let (key, value) = pairs.into_iter().next().unwrap();
-        let prefix = KeySet::with_prefix(&key);
-        let mut parsed_segments = parse_segments(segments, &prefix)?;
-        parsed_segments.sort_unstable_by_key(|a| a.0);
-
-        // Safety: `parsed_segments` must larger than 0.
-        let segment_num = parsed_segments.last().unwrap().0;
-        ensure!(
-            // The segment index start from 1.
-            parsed_segments.len() == segment_num,
-            error::UnexpectedSnafu {
-                err_msg: format!(
-                    "Corrupted segment keys, parsed segment indexes: {:?}",
-                    parsed_segments
-                        .into_iter()
-                        .map(|(key, _)| key)
-                        .collect::<Vec<_>>()
-                )
-            }
-        );
-
-        let segment_values = parsed_segments.into_iter().map(|(_, value)| value);
-        let mut values = Vec::with_capacity(segment_values.len() + 1);
-        values.push(value);
-        values.extend(segment_values);
-
-        Ok((KeySet::new(key, segment_num), values.concat()))
-    }
-}
-
 impl CollectingState {
-    fn new(key: String, value: Vec<u8>) -> CollectingState {
+    fn new(key: String, value: Vec<u8>) -> Self {
+        // A surviving suffix may be the first key in a damaged checkpoint.
+        let base = super::ParsedKey::checkpoint_base_of_segment(&key)
+            .unwrap_or(&key)
+            .to_owned();
         Self {
+            key: base,
             pairs: vec![(key, value)],
         }
     }
 
-    fn push(&mut self, key: String, value: Vec<u8>) {
-        self.pairs.push((key, value));
-    }
-
-    fn key(&self) -> &str {
-        self.pairs[0].0.as_str()
+    fn finish(mut self) -> Result<(KeySet, Vec<u8>)> {
+        let corrupt = |reason: String| {
+            error::CorruptCheckpointSnafu {
+                key: self.key.clone(),
+                keys: self
+                    .pairs
+                    .iter()
+                    .map(|(key, _)| key.clone())
+                    .collect::<Vec<_>>(),
+                reason,
+            }
+            .build()
+        };
+        if self.pairs[0].0 != self.key {
+            return Err(corrupt("missing base segment".to_string()));
+        }
+        if self.pairs.len() == 1 {
+            let (key, value) = self.pairs.pop().unwrap();
+            return Ok((KeySet::new(key, 0), value));
+        }
+        let prefix = KeySet::with_prefix(&self.key);
+        let mut indexed = Vec::with_capacity(self.pairs.len());
+        indexed.push((0, 0));
+        for (position, (key, _)) in self.pairs.iter().enumerate().skip(1) {
+            let idx = key
+                .strip_prefix(&prefix)
+                .and_then(|suffix| suffix.parse::<usize>().ok())
+                .ok_or_else(|| corrupt(format!("invalid segment key {key}")))?;
+            indexed.push((idx, position));
+        }
+        indexed.sort_unstable();
+        for (expected, (actual, _)) in indexed.iter().enumerate() {
+            if expected != *actual {
+                return Err(corrupt(format!(
+                    "expected segment {expected}, found {actual}"
+                )));
+            }
+        }
+        let mut value = Vec::with_capacity(self.pairs.iter().map(|(_, part)| part.len()).sum());
+        for (_, position) in indexed {
+            value.extend_from_slice(&self.pairs[position].1);
+        }
+        Ok((KeySet::new(self.key, self.pairs.len() - 1), value))
     }
 }
 
@@ -107,26 +91,28 @@ type Upstream = dyn Stream<Item = Result<(String, Vec<u8>)>> + Send;
```

**File**: `tests-integration/src/cluster.rs` (modified, +102/-0)
```diff
@@ -1086,6 +1086,108 @@ mod tests {
 
     use super::*;
 
+    #[tokio::test(flavor = "multi_thread")]
+    async fn test_recover_procedures_with_missing_checkpoint_segments() {
+        use common_meta::ddl::create_database::{
+            CreateDatabaseData, CreateDatabaseProcedure, CreateDatabaseState,
+        };
+        use common_meta::rpc::store::RangeRequest;
+        use common_meta::state_store::KvStateStore;
+        use common_procedure::store::ProcedureMessage;
+        use common_procedure::store::state_store::StateStore;
+        use common_procedure::{ProcedureId, SubprocedureRecovery};
+
+        let builder = GreptimeDbClusterBuilder::new("corrupt_checkpoint_recovery")
+            .await
+            .with_datanodes(1);
+        let kv = builder.kv_backend.clone();
+        let store = KvStateStore::new(kv.clone()).with_max_value_size(Some(32));
+        let replayed_id = ProcedureId::random();
+        let lost_id = ProcedureId::random();
+        for (schema, id, damage, has_previous) in [
+            ("replayed_db", replayed_id, true, true),
+            ("healthy_db", ProcedureId::random(), false, false),
+            ("lost_db", lost_id, true, false),
+        ] {
+            let data = CreateDatabaseData {
+                state: CreateDatabaseState::Prepare,
+                catalog: "greptime".to_string(),
+                schema: schema.to_string(),
+                create_if_not_exists: false,
+                options: Default::default(),
+                creator: None,
+            };
+            let mut message = ProcedureMessage {
+                type_name: CreateDatabaseProcedure::TYPE_NAME.into(),
+                data: serde_json::to_string(&data).unwrap(),
+                parent_id: None,
+                subprocedure_recovery: SubprocedureRecovery::Discard,
+                step: 7,
+                error: None,
+                context: Default::default(),
+            };
+            if has_previous {
+                store
+                    .put(
+                        &format!("procedure/{id}/0000000007.step"),
+                        serde_json::to_vec(&message).unwrap(),
+                    )
+                    .await
+                    .unwrap();
+            }
+            message.step = 8;
+            let suffix = if has_previous { "rollback" } else { "step" };
+            let key = format!("procedure/{id}/0000000008.{suffix}");
+            store
+                .put(&key, serde_json::to_vec(&message).unwrap())
+                .await
+                .unwrap();
+            if damage {
+                store.delete(&format!("{key}/0000000001")).await.unwrap();
+            }
+        }
+
+        let lost_keys = RangeRequest::new()
+            .with_prefix(format!("/__procedure__/procedure/{lost_id}/").into_bytes());
+        let replayed_keys = RangeRequest::new()
+            .with_prefix(format!("/__procedure__/procedure/{replayed_id}/").into_bytes());
+        let before = kv.range(lost_keys.clone()).await.unwrap().kvs;
+        assert!(before.len() > 1);
+        let cluster = builder.build(false).await;
+        let schemas = cluster.metasrv.table_metadata_manager().schema_manager();
+        tokio::time::timeout(std::time::Duration::from_secs(30), async {
+            loop {
+                use common_meta::key::schema_name::SchemaNameKey;
+                if schemas
+                    .exists(SchemaNameKey::new("greptime", "replayed_db"))
+                    .await
+                    .unwrap()
+                    && schemas
+                        .exists(SchemaNameKey::new("greptime", "healthy_db"))
+                        .await
+                        .unwrap()
+                    && kv
+                        .range(replayed_keys.clone())
+                        .await
+                        .unwrap()
+                        .kvs
+                        .is_empty()
+                {
+                    break;
+                }
+                tokio::time::sleep(std::time::Duration::from_millis(20)).await;
+            }
+        })
+        .await
+        .unwrap();
+        crate::test_util::execute_sql(
+            cluster.fe_instance(),
+            "CREATE TABLE after_recovery (ts TIMESTAMP TIME INDEX)",
+        )
+        .await;
+        assert_eq!(kv.range(lost_keys).await.unwrap().kvs, before);
+    }
+
     #[tokio::test]
     async fn test_do_get_stats_follow_response_body_lifetime() {
         let stats = Arc::new(DatanodeRpcStats::default());
```

#### Recent Merged Pull Requests:
- **PR #10652** (closed): perf(query): open regions of a merge scan partition ahead for bounded results (@killme2008)
- **PR #10651** (2026-11-26): fix(mito2): make table compaction publication retries idempotent (@WenyXu)
- **PR #10649** (2026-11-26): feat(mito): compact native series indexes within a coverage window (@evenyag)
- **PR #10646** (2026-11-26): fix(mito2): require a region to own its files before a remap (@discord9)
- **PR #10645** (2026-11-26): fix(query): prune logical metric scans by table ID (@evenyag)
- **PR #10640** (closed): test(mito2): add storage-side model-based tests for repartition visibility (@discord9)

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

## X. mito2): require a region to own its files before a remap

**RULE**:
When implementing operations in `src/common/meta/src/instruction.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in GreptimeTeam/greptimedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0127d638`: mito2): require a region to own its files before a remap. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/common/meta/src/instruction.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
    /// Only verify that the remap would be accepted instead of writing staging manifests.
    ///
    /// The repartition procedure sends such a request to each *source leader* before it publishes
    /// the new routes; the datanode then reads the region's persisted manifest and reports whether
    /// the region holds a file it did not create itself. Nothing is staged and nothing is written.
    ///
    /// An older datanode ignores this unknown field (it is `#[serde(default)]`, so it simply
    /// deserializes as `false`) and performs an ordinary remap. That is still safe: an ordinary
    /// remap requires the region to be in staging state, and these sources are not staged yet, so
    /// the datanode answers with the structured stage-required error
    /// (`mito2::worker::handle_remap` → `InvalidRequest` "region is not in staging state"). Metasrv
    /// therefore sees an error rather than a silent success, and aborts the group before the
    /// routes are published.
    #[serde(default)]
    pub validate_only: bool,
            "RemapManifest(region_id={}, input_regions={:?}, region_mapping={:?}, new_part
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
            "RemapManifest(region_id={}, input_regions={:?}, region_mapping={:?}, new_partition_exprs={:?})",
            self.region_id, self.input_regions, self.region_mapping, self.new_partition_exprs
    use std::collections::HashSet;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0127d638` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
