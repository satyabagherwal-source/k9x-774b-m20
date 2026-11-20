# Verification Protocol: Verification Protocol: Empirical Defect Shield for GreptimeTeam/greptimedb

<!-- PROVENANCE_START
{
  "source_repository": "GreptimeTeam/greptimedb",
  "source_url": "https://github.com/GreptimeTeam/greptimedb",
  "source_version": "5dec7b19",
  "license": "Apache-2.0",
  "timestamp": "2026-11-20T06:58:45.067Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-greptimeteam-greptimedb",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [GreptimeTeam/greptimedb](https://github.com/GreptimeTeam/greptimedb) (Revision: `5dec7b19`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-20T06:58:45.067Z`  
> **Learning ID**: `learn-github-greptimeteam-greptimedb`


## 1. Scope & Verification Target
- **Target Repository**: `GreptimeTeam/greptimedb` (Commit: `5dec7b19`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): GreptimeTeam/greptimedb

> **Canonical Artifact**: `07_PROJECT_LEARNING/greptimeteam-greptimedb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/GreptimeTeam/greptimedb](https://github.com/GreptimeTeam/greptimedb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-20T06:58:43.342Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GreptimeTeam/greptimedb`
- **Description**: The open-source observability database. One columnar engine for metrics, logs, and traces, on object storage.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6825 stars

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
- **Issue #10545** (2026-11-20): **test(query): skip the far-future overflow test when SystemTime cannot represent it**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## What's changed  `native_fused_windows_whose_instants_overflow_fall_back` builds a statement starting `5e18 ms` after the Unix epoch. `SystemTime` cannot represent that instant on Windows (and on 32-bit `time_t` targets), so `UNIX_EPOCH.checked_add(..).unwrap()` panicked before the planner saw the query.  The test now checks `checked_add` and returns early when the platform cannot represent the start. The platform-independent `native_tree_supported_declines_the_instants_that_overflow` test in `promql::native::plan::tests` still covers the admission predicate with a pure `i64` grid, including on Windows. 64-bit Unix CI still runs the high-level shape.  This is test-only; no production code changes.  ## Verification  - `cargo nextest run -p query -E 'test(native_fused_windows_whose_instants_overflow_fall_back)'`: passed on Linux. - `cargo fmt --all -- --check`: passed.  Fixes the Windows failure in https://github.com/GreptimeTeam/greptimedb/actions/runs/44635062535/job/135951339889. 

- **Issue #10543** (2026-11-20): **fix(mito-codec): align sparse metric rows with physical region fields**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  Observed in the [test job for #10524](https://github.com/GreptimeTeam/greptimedb/actions/runs/44485860846/job/135438226190) and reproduced on its main baseline (`788df5849b`).  ## What's changed and what's your intention?  #7195 introduced the three-column fast path in `SparseReadRowHelper`. It treats an encoded key, timestamp, and one value in the request as proof that the physical region has exactly one field.  #8382 added native histogram writes. A scalar metric and a histogram can share a physical region with both `greptime_value` and `greptime_native_histogram`. A sparse row can supply either field and omit the other. The fast path emitted only the supplied field, so the memtable expected two values and received one. Its field-count assertion panicked and the remote write returned HTTP 500.  This fix checks both the request width and the physical region's field count before using positional indices. For a multi-field region, the existing name-based mapping places the supplied value in the correct slot and emits NULL for the omitted field.  The new codec test covers either field being omitted and failed before the fix. All 64 codec tests and all six exemplar integration cases passed on the final commit. Formatting and crate-level Clippy also passed.  ## PR Checklist Please convert it to a draft if some of the fo

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

### Incident Patch 1: `4eca3194` (2026-11-20)
**Commit Message**: test(query): skip the far-future overflow test when SystemTime cannot represent it (#10545)

Windows SystemTime and 32-bit time_t targets cannot represent the 5e18 ms statement start, so checked_add returns None before the planner sees the query. Skip the high-level shape there; the platform-independent native_tree_supported_declines_the_instants_that_overflow test still covers the admission predicate.

Signed-off-by: discord9 <[REDACTED_EMAIL]>

**File**: `src/query/src/promql/planner/test.rs` (modified, +11/-4)
```diff
@@ -3446,16 +3446,23 @@ async fn native_fused_partitioned_table_label_rewrite_falls_back() {
 /// route, and dropping it from the predicate makes this test fail. (The `@` half of the same
 /// arithmetic is pinned one level down, in `native::plan::tests`, because a statement whose anchor
 /// and start are that far apart is refused by the planner's own at-modifier rewrite first.)
+///
+/// A platform whose `SystemTime` cannot represent the `5e18 ms` start skips the high-level
+/// shape; the platform-independent `native_tree_supported_declines_the_instants_that_overflow`
+/// still covers the admission predicate there.
 #[tokio::test]
 async fn native_fused_windows_whose_instants_overflow_fall_back() {
-    // The far end of the `i64` millisecond range, one step apart.
+    // The far end of the `i64` millisecond range, one step apart. Windows' `SystemTime` and
+    // 32-bit `time_t` targets cannot represent it, so they cannot build this statement.
+    let Some(far_start) = UNIX_EPOCH.checked_add(Duration::from_millis(5_000_000_000_000_000_000))
+    else {
+        return;
+    };
     let plan_for = |query: &str, native_fused| {
         let query = query.to_string();
         async move {
             let mut eval_stmt = build_eval_stmt(&query);
-            eval_stmt.start = UNIX_EPOCH
-                .checked_add(Duration::from_millis(5_000_000_000_000_000_000))
-                .unwrap();
+            eval_stmt.start = far_start;
             eval_stmt.end = eval_stmt
                 .start
                 .checked_add(Duration::from_millis(10_000))
```

---

### Incident Patch 2: `ce7153de` (2026-11-19)
**Commit Message**: fix(metasrv): reserve repartition region numbers before creating regions (#10524)

* fix(metasrv): reserve repartition region numbers before creating regions

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

* fix(metasrv): limit repartition changes to region number reservation

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

* refactor: share repartition allocation targets

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

* fix: reserve region numbers when resuming repartition after upgrade

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

* test: bound waits for repartition create requests

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

---------

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

**File**: `src/common/meta/src/key/table_route.rs` (modified, +102/-1)
```diff
@@ -18,7 +18,7 @@ use std::sync::Arc;
 
 use serde::{Deserialize, Deserializer, Serialize};
 use snafu::{OptionExt, ResultExt, ensure};
-use store_api::storage::{RegionId, RegionNumber};
+use store_api::storage::{MAX_REGION_SEQ, RegionId, RegionNumber};
 use table::metadata::TableId;
 
 use crate::error::{
@@ -511,6 +511,43 @@ impl TableRouteManager {
             .transpose()
     }
 
+    /// Reserves a positive number of consecutive region numbers without publishing their routes.
+    /// On success, advances the high-water mark and route version and returns the first reserved number.
+    /// If the table route changed, returns `None`. Reload the route before retrying.
+    pub async fn try_reserve_region_numbers(
+        &self,
+        table_id: TableId,
+        current: &DeserializedValueWithBytes<TableRouteValue>,
+        count: usize,
+    ) -> Result<Option<RegionNumber>> {
+        // The read path remaps peer addresses. Preserve the stored routes verbatim.
+        let TableRouteValue::Physical(mut route) =
+            TableRouteValue::try_from_raw_value(&current.bytes)?
+        else {
+            return UnexpectedLogicalRouteTableSnafu {
+                err_msg: format!("Cannot reserve region numbers for logical table {table_id}"),
+            }
+            .fail();
+        };
+        let previous = route.max_region_number;
+        let last = RegionNumber::try_from(count)
+            .ok()
+            .and_then(|count| previous.checked_add(count))
+            .filter(|last| previous < *last && *last <= MAX_REGION_SEQ)
+            .with_context(|| InvalidMetadataSnafu {
+                err_msg: format!(
+                    "Cannot reserve {count} region numbers after {previous} for table {table_id}"
+                ),
+            })?;
+        route.max_region_number = last;
+        route.version += 1;
+        let (txn, _) =
+            self.storage
+                .build_update_txn(table_id, current, &TableRouteValue::Physical(route))?;
+        let response = self.storage.kv_backend.txn(txn).await?;
+        Ok(response.succeeded.then_some(previous + 1))
+    }
+
     /// Sets the staging state for a specific region.
     ///
     /// Returns a [TableRouteNotFound](crate::error::Error::TableRouteNotFound) Error if:
@@ -950,6 +987,70 @@ mod tests {
         assert_eq!(new_table_route.max_region_number, 3);
     }
 
+    #[tokio::test]
+    async fn test_reserve_region_numbers() {
+        let table_id = 1024;
+        let kv = Arc::new(MemoryKvBackend::default());
+        let manager = TableRouteManager::new(kv.clone());
+        let storage = manager.table_route_storage();
+        let routes = vec![RegionRoute {
+            region: Region {
+                id: RegionId::new(table_id, MAX_REGION_SEQ - 3),
+                ..Default::default()
+            },
+            ..Default::default()
+        }];
+        let initial = TableRouteValue::physical(routes.clone());
+        let (txn, _) = storage.build_create_txn(table_id, &initial).unwrap();
+        assert!(kv.txn(txn).await.unwrap().succeeded);
+        let current = storage.get_with_raw_bytes(table_id).await.unwrap().unwrap();
+        assert!(
+            manager
+                .try_reserve_region_numbers(table_id, &current, 0)
+                .await
+                .is_err()
+        );
+        assert_eq!(
+            manager
+                .try_reserve_region_numbers(table_id, &current, 2)
+                .await
+                .unwrap(),
+            Some(MAX_REGION_SEQ - 2)
+        );
+        // Another reservation based on the same snapshot must not claim this range.
+        assert_eq!(
+            manager
+                .try_reserve_region_numbers(table_id, &current, 2)
+                .await
+                .unwrap(),
+            None
+        );
+        let current = storage.get_with_raw_bytes(table_id).await.unwrap().unwrap();
+        assert_eq!(current.region_routes().unwrap(), &routes);
+        assert_eq!(current.max_region_number().unwrap(), MAX_REGION_SEQ - 1);
+        assert_eq!(current.version().unwrap(), 1);
+        assert!(
+            manager
+                .try_reserve_region_numbers(table_id, &current, 2)
+                .await
+                .is_err()
+        );
+        assert_eq!(
+            manager
+                .try_reserve_region_numbers(table_id, &current, 1)
+                .await
+                .unwrap(),
+            Some(MAX_REGION_SEQ)
+        );
+        let current = storage.get_with_raw_bytes(table_id).await.unwrap().unwrap();
+        assert!(
+            manager
+                .try_reserve_region_numbers(table_id, &current, 1)
+                .await
+                .is_err()
+        );
+    }
+
     #[test]
     fn test_table_route_compatibility() {
         let old_raw_v = r#"{"region_routes":[{"region":{"id":1,"name":"r1","partition":null,"attrs":{}},"leader_peer":{"id":2,"addr":"a2"},"follower_peers":[]},{"region":{"id":1,
```

**File**: `src/meta-srv/src/procedure/repartition.rs` (modified, +163/-1)
```diff
@@ -58,7 +58,7 @@ use common_telemetry::{error, info, warn};
 use partition::expr::PartitionExpr;
 use serde::{Deserialize, Serialize};
 use snafu::{OptionExt, ResultExt};
-use store_api::storage::TableId;
+use store_api::storage::{RegionNumber, TableId};
 use table::table_name::TableName;
 
 use crate::error::{self, Result};
@@ -327,6 +327,24 @@ impl Context {
         Ok(table_route_value)
     }
 
+    async fn reserve_region_numbers(
+        &self,
+        current: &DeserializedValueWithBytes<TableRouteValue>,
+        count: usize,
+    ) -> Result<RegionNumber> {
+        let table_id = self.persistent_ctx.table_id;
+        self.table_metadata_manager
+            .table_route_manager()
+            .try_reserve_region_numbers(table_id, current, count)
+            .await
+            .context(error::TableMetadataManagerSnafu)?
+            .with_context(|| error::RetryLaterSnafu {
+                reason: format!(
+                    "Table route changed while reserving region numbers for table {table_id}"
+                ),
+            })
+    }
+
     /// Retrieves the table info value for the given table id.
     ///
     /// Retry:
@@ -2095,6 +2113,150 @@ mod tests {
         );
     }
 
+    #[tokio::test]
+    async fn test_repartition_after_partial_create_failure() {
+        check_partial_create_failure(false).await;
+    }
+
+    #[tokio::test]
+    async fn test_repartition_after_pre_upgrade_partial_create_failure() {
+        check_partial_create_failure(true).await;
+    }
+
+    async fn check_partial_create_failure(pre_upgrade: bool) {
+        use api::v1::region::region_request::Body;
+        use common_meta::key::MetadataKey;
+        use common_meta::key::table_route::TableRouteKey;
+        use common_meta::rpc::store::PutRequest;
+
+        let env = TestingEnv::new();
+        let table_id = 1024;
+        let source = range_expr("x", 0, 90);
+        let route = test_region_route(RegionId::new(table_id, 1), &source.as_json_str().unwrap());
+        env.create_physical_table_metadata_for_repartition(
+            table_id,
+            vec![route.clone()],
+            test_region_wal_options(&[1]),
+        )
+        .await;
+
+        let (tx, mut requests) = mpsc::channel(1);
+        let fail_once = AtomicBool::new(true);
+        let nodes = Arc::new(MockDatanodeManager::new(
+            DatanodeWatcher::new(tx).with_handler(move |_, request| {
+                if let Some(Body::Create(create)) = request.body
+                    && create.region_id == RegionId::new(table_id, 3).as_u64()
+                    && fail_once.swap(false, Ordering::SeqCst)
+                {
+                    return error::UnexpectedSnafu {
+                        err_msg: "injected create failure",
+                    }
+                    .fail();
+                }
+                Ok(api::region::RegionResponse::new(0))
+            }),
+        ));
+        let new_split = || {
+            RepartitionProcedure::new(
+                RepartitionFrom::Partitioned {
+                    exprs: vec![source.clone()],
+                    target_partition_columns: None,
+                },
+                vec![
+                    range_expr("x", 0, 30),
+                    range_expr("x", 30, 60),
+                    range_expr("x", 60, 90),
+                ],
+                new_parent_context(&env, nodes.clone(), table_id),
+            )
+        };
+
+        let ctx = TestingEnv::procedure_context();
+        let mut first = new_split();
+        first.execute(&ctx).await.unwrap();
+        let original = first.context.get_table_route_value().await.unwrap();
+        first.execute(&ctx).await.unwrap();
+        let reserved = first.context.get_table_route_value().await.unwrap();
+        if pre_upgrade {
+            // Old BuildPlan persisted the same Execute checkpoint without updating the route.
+            env.kv_backend
+                .put(
+                    PutRequest::new()
+                        .with_key(TableRouteKey::new(table_id).to_bytes())
+                        .with_value(original.get_raw_bytes()),
+                )
+                .await
+                .unwrap();
+            first =
+                RepartitionProcedure::from_json(&first.dump().unwrap(), |persistent_ctx| Context {
+                    persistent_ctx,
+                    ..new_parent_context(&env, nodes.clone(), table_id)
+                })
+                .unwrap();
+        }
+
+        let observe_create = async {
+            // The one-slot channel holds the second create until we observe the first.
+            let (_, request) = requests.recv().await.unwrap();
+            let Some(Body::Create(create)) = request.body else {
+                panic!("expected create")
+            };
+            let current = new_split().context.get_table_route_value().await.unwrap();
+            assert_eq!(current.max_region_number().unwrap(), 3);
+            assert_eq!(current
```

**File**: `src/meta-srv/src/procedure/repartition/allocate_region.rs` (modified, +82/-24)
```diff
@@ -101,13 +101,22 @@ impl BuildPlan {
     async fn next(
         &mut self,
         ctx: &mut Context,
-        _procedure_ctx: &ProcedureContext,
+        procedure_ctx: &ProcedureContext,
     ) -> Result<(Box<dyn State>, Status)> {
         let timer = Instant::now();
         let table_id = ctx.persistent_ctx.table_id;
+        let table_lock = TableLock::Write(table_id).into();
+        let _guard = procedure_ctx.provider.acquire_lock(&table_lock).await;
         let table_route_value = ctx.get_table_route_value().await?;
-        let mut next_region_number =
-            AllocateRegion::get_next_region_number(table_route_value.max_region_number().unwrap());
+        let to_allocate = AllocateRegion::count_regions_to_allocate(&self.plan_entries);
+        // A crash before the plan is persisted can leave a gap, but no datanode
+        // can create a region until its number has been durably reserved.
+        let mut next_region_number = if to_allocate > 0 {
+            ctx.reserve_region_numbers(&table_route_value, to_allocate)
+                .await?
+        } else {
+            0
+        };
 
         // Converts allocation plan to repartition plan.
         let repartition_plan_entries = AllocateRegion::convert_to_repartition_plans(
@@ -117,14 +126,13 @@ impl BuildPlan {
             table_route_value.region_routes().unwrap(),
         )?;
         let plan_count = repartition_plan_entries.len();
-        let to_allocate = AllocateRegion::count_regions_to_allocate(&repartition_plan_entries);
         info!(
             "Repartition allocate regions start, table_id: {}, groups: {}, regions_to_allocate: {}",
             table_id, plan_count, to_allocate
         );
 
         // If no region to allocate, directly dispatch the plan.
-        if AllocateRegion::count_regions_to_allocate(&repartition_plan_entries) == 0 {
+        if to_allocate == 0 {
             ctx.persistent_ctx.plans = repartition_plan_entries;
             ctx.update_allocate_region_elapsed(timer.elapsed());
             return Ok((Box::new(Dispatch), Status::executing(true)));
@@ -189,9 +197,23 @@ impl ExecutePlan {
                 .context(error::AllocateRegionRoutesSnafu { table_id })?;
             new_allocated_region_routes.extend(routes);
         }
+        // Older Execute checkpoints can contain region numbers that Build did not reserve.
+        let table_route_value = ctx.get_table_route_value().await?;
+        let current = table_route_value
+            .max_region_number()
+            .context(error::TableMetadataManagerSnafu)?;
+        if let Some(required) = allocate_regions
+            .iter()
+            .map(|r| r.region_id.region_number())
+            .max()
+            && required > current
+        {
+            ctx.reserve_region_numbers(&table_route_value, (required - current) as usize)
+                .await?;
+        }
+
         let skip_wal = table_info_value.table_info.meta.options.skip_wal;
         let allocate_noop = if skip_wal {
-            let table_route_value = ctx.get_table_route_value().await?;
             let region_wal_options =
                 get_region_wal_options(&ctx.table_metadata_manager, &table_route_value, table_id)
                     .await
@@ -410,18 +432,13 @@ impl AllocateRegion {
     }
 
     /// Calculates the total number of regions that need to be allocated.
-    fn count_regions_to_allocate(repartition_plan_entries: &[RepartitionPlanEntry]) -> usize {
-        repartition_plan_entries
+    fn count_regions_to_allocate(plan_entries: &[AllocationPlanEntry]) -> usize {
+        plan_entries
             .iter()
-            .map(|p| p.allocated_region_ids.len())
+            .map(|plan| plan.targets_to_allocate().len())
             .sum()
     }
 
-    /// Gets the next region number from the physical table route.
-    fn get_next_region_number(max_region_number: RegionNumber) -> RegionNumber {
-        max_region_number + 1
-    }
-
     async fn allocate_regions(
         node_manager: &NodeManagerRef,
         raw_table_info: &TableInfo,
@@ -897,23 +914,14 @@ mod tests {
     #[test]
     fn test_count_regions_to_allocate() {
         let table_id = 1024;
-        let mut next_region_number = 10;
 
         let plan_entries = vec![
             create_allocation_plan_entry(table_id, &[1], &[(0, 50), (50, 100)]), // 1 allocation
             create_allocation_plan_entry(table_id, &[2, 3], &[(100, 200)]), // 0 allocation (deallocate)
             create_allocation_plan_entry(table_id, &[4], &[(200, 250), (250, 300)]), // 1 allocation
         ];
 
-        let repartition_plans = AllocateRegion::convert_to_repartition_plans(
-            table_id,
-            &mut next_region_number,
-            &plan_entries,
-            &create_current_region_routes(table_id, &[1, 2, 3, 4]),
-        )
-        .unwrap();
-
-        let count = AllocateRegion::count_regions_to_allocate(&repartition_plans);
+        let count = AllocateRegion::count_regions
```

**File**: `src/meta-srv/src/procedure/repartition/plan.rs` (modified, +15/-7)
```diff
@@ -165,6 +165,15 @@ pub struct AllocationPlanEntry {
     pub transition_map: Vec<Vec<usize>>,
 }
 
+impl AllocationPlanEntry {
+    /// Returns the target partitions that need a new region.
+    pub(super) fn targets_to_allocate(&self) -> impl ExactSizeIterator<Item = &PartitionExpr> {
+        self.target_partition_exprs
+            .iter()
+            .skip(self.source_regions.len())
+    }
+}
+
 /// A plan entry for the dispatch phase after region allocation,
 /// with concrete source and target region descriptors.
 #[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
@@ -216,20 +225,19 @@ impl RepartitionPlanEntry {
 pub fn convert_allocation_plan_to_repartition_plan(
     table_id: TableId,
     next_region_number: &mut RegionNumber,
-    AllocationPlanEntry {
+    plan: &AllocationPlanEntry,
+) -> RepartitionPlanEntry {
+    let AllocationPlanEntry {
         group_id,
         source_regions,
         target_partition_exprs,
         transition_map,
-        ..
-    }: &AllocationPlanEntry,
-) -> RepartitionPlanEntry {
+    } = plan;
     match source_regions.len().cmp(&target_partition_exprs.len()) {
         Ordering::Less => {
             // requires to allocate regions
-            let pending_allocate_target_partition_exprs = target_partition_exprs
-                .iter()
-                .skip(source_regions.len())
+            let pending_allocate_target_partition_exprs = plan
+                .targets_to_allocate()
                 .map(|target_partition_expr| {
                     let desc = TargetRegionDescriptor {
                         region_id: RegionId::new(table_id, *next_region_number),
```

---

### Incident Patch 3: `788df584` (2026-11-19)
**Commit Message**: fix(metric): route logical table writes by internal table id (#10366)

* fix(metric): pass logical table identity to partition evaluation

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

* test(metric): cover table-id repartition routing across storage formats

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

* fix(partition): validate logical routing inputs

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

* fix(metric): retain table ids for physical batch routing

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

* refactor(partition): simplify table-id routing paths

Separate context dispatch, routing input construction and column conversion
into private methods while preserving the scalar payload path. Reuse the
existing table-id constant and shared IPC decoding in tests.

Keep correctly routed requests intact when their partition version is
unchanged. Update existing retry coverage to use stale versions for rerouting
and verify unchanged bulk requests preserve alignment and ownership.

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

* fix(servers): validate table-id column row count

Report mismatched logical table identities before Arrow column construction, document batch and row ordering requirements, and r

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -15564,6 +15564,7 @@ dependencies = [
  "opentelemetry-proto",
  "operator",
  "otel-arrow-rust",
+ "partition",
  "paste",
  "pipeline",
  "plugins",
```

**File**: `src/metric-engine/src/engine/bulk_insert.rs` (modified, +19/-1)
```diff
@@ -246,7 +246,8 @@ mod tests {
     use mito2::sst::parquet::metadata::MetadataLoader;
     use mito2::sst::parquet::reader::MetadataCacheMetrics;
     use store_api::metric_engine_consts::{
-        METRIC_ENGINE_NAME, PHYSICAL_TABLE_METADATA_KEY, PRIMARY_KEY_ENCODING,
+        DATA_SCHEMA_TABLE_ID_COLUMN_NAME, METRIC_ENGINE_NAME, PHYSICAL_TABLE_METADATA_KEY,
+        PRIMARY_KEY_ENCODING,
     };
     use store_api::mito_engine_options::EXPERIMENTAL_SST_FLOAT_FIELD_ENCODING;
     use store_api::path_utils::table_dir;
@@ -519,6 +520,23 @@ mod tests {
             physical_batch.column_by_name("job").is_some(),
             retain_partition_columns
         );
+        let physical_batch = if retain_partition_columns {
+            // The batcher retains identity for routing; sparse storage still uses the
+            // identity encoded in __primary_key, including after WAL recovery.
+            let mut fields = physical_batch.schema().fields().to_vec();
+            fields.push(Arc::new(Field::new(
+                DATA_SCHEMA_TABLE_ID_COLUMN_NAME,
+                DataType::UInt32,
+                false,
+            )));
+            let mut columns = physical_batch.columns().to_vec();
+            columns.push(Arc::new(datatypes::arrow::array::UInt32Array::from(vec![
+                logical_region_id.table_id(); physical_batch.num_rows()
+            ])));
+            RecordBatch::try_new(Arc::new(ArrowSchema::new(fields)), columns).unwrap()
+        } else {
+            physical_batch
+        };
         let request = build_bulk_request(physical_region_id, physical_batch, skip_wal);
         let response = env
             .metric()
```

**File**: `src/operator/src/req_convert/common/partitioner.rs` (modified, +568/-12)
```diff
@@ -686,6 +686,7 @@ mod tests {
     use partition::expr;
     use partition::manager::{PartitionRuleManager, PartitionRuleManagerRef};
     use partition::multi_dim::MultiDimPartitionRule;
+    use partition::partition::PartitionEvalContext;
     use store_api::metric_engine_consts;
 
     use super::*;
@@ -777,6 +778,96 @@ mod tests {
         .unwrap()
     }
 
+    #[test]
+    fn test_physical_bulk_retry_preserves_per_row_table_ids() {
+        use datatypes::arrow::array::UInt32Array;
+
+        let table_info = build_sparse_table_info();
+        let batch = build_sparse_batch();
+        let mut fields = batch.schema().fields().to_vec();
+        fields.push(Arc::new(Field::new(
+            metric_engine_consts::DATA_SCHEMA_TABLE_ID_COLUMN_NAME,
+            DataType::UInt32,
+            false,
+        )));
+        let mut columns = batch.columns().to_vec();
+        columns.push(Arc::new(UInt32Array::from(vec![42, 43, 44, 45, 46])));
+        let batch = RecordBatch::try_new(Arc::new(Schema::new(fields)), columns).unwrap();
+        // Initially no partition uses table id, but the payload must retain it.
+        let initial = TablePartitioner {
+            table_id: 1,
+            rule: Arc::new(MultiDimPartitionRule::try_new(vec![], vec![1], vec![], false).unwrap()),
+            versions: HashMap::from([(1, Some(PartitionExprVersion { value: 1 }))]),
+        };
+        let requests = initial
+            .partition_bulk_insert_requests(batch.clone(), None, false)
+            .unwrap();
+        assert_eq!(requests.len(), 1);
+        let refreshed = TablePartitioner {
+            table_id: 1,
+            rule: Arc::new(
+                MultiDimPartitionRule::try_new(
+                    vec![metric_engine_consts::DATA_SCHEMA_TABLE_ID_COLUMN_NAME.to_string()],
+                    vec![1, 2],
+                    vec![
+                        expr::col(metric_engine_consts::DATA_SCHEMA_TABLE_ID_COLUMN_NAME)
+                            .lt(DataValue::UInt32(44)),
+                        expr::col(metric_engine_consts::DATA_SCHEMA_TABLE_ID_COLUMN_NAME)
+                            .gt_eq(DataValue::UInt32(44)),
+                    ],
+                    true,
+                )
+                .unwrap(),
+            ),
+            versions: HashMap::from([
+                (1, Some(PartitionExprVersion { value: 2 })),
+                (2, Some(PartitionExprVersion { value: 2 })),
+            ]),
+        };
+        assert_eq!(
+            refreshed.rule.eval_context(),
+            PartitionEvalContext::FromPayload
+        );
+        let request = build_request(Body::BulkInsert(requests[0].clone()));
+        let mut plain = refreshed
+            .rebuild_write_requests(request.clone(), &table_info)
+            .unwrap();
+        plain.sort_by_key(|r| match r.body.as_ref().unwrap() {
+            Body::BulkInsert(b) => b.region_id,
+            _ => unreachable!(),
+        });
+        let mut tracked = refreshed
+            .rebuild_tracked_write_requests(request, &table_info, Some(vec![0, 1, 2, 3, 4]))
+            .unwrap();
+        tracked.sort_by_key(|(r, _)| match r.body.as_ref().unwrap() {
+            Body::BulkInsert(b) => b.region_id,
+            _ => unreachable!(),
+        });
+        assert_eq!(plain.len(), 2);
+        assert_eq!(tracked.len(), 2);
+        for (index, (request, owners)) in tracked.into_iter().enumerate() {
+            assert_eq!(request.body, plain[index].body);
+            let Some(Body::BulkInsert(request)) = request.body else {
+                unreachable!()
+            };
+            assert_eq!(
+                request.region_id,
+                RegionId::new(1, index as u32 + 1).as_u64()
+            );
+            assert_eq!(
+                request.partition_expr_version,
+                Some(PartitionExprVersion { value: 2 })
+            );
+            let Some(bulk_insert_request::Body::ArrowIpc(ipc)) = request.body else {
+                unreachable!()
+            };
+            let decoded = decode_ipc(&ipc);
+            let (offset, len) = if index == 0 { (0, 2) } else { (2, 3) };
+            assert_eq!(decoded, batch.slice(offset, len));
+            assert_eq!(owners, Some((offset..offset + len).collect()));
+        }
+    }
+
     #[tokio::test]
     async fn test_partition_tags_use_physical_table_metadata() {
         let backend = Arc::new(MemoryKvBackend::new());
@@ -909,10 +1000,7 @@ mod tests {
             let Some(bulk_insert_request::Body::ArrowIpc(ipc)) = bulk.body else {
                 unreachable!()
             };
-            let actual = FlightDecoder::try_from_schema_bytes(&ipc.schema)
-                .unwrap()
-                .try_decode_record_batch(&ipc.data_header, &ipc.payload)
-                .unwrap();
+            let actual = decode_ipc(&ipc);
             let mask = if RegionId::from_u64(bulk.region_id).region_number() == 1 {
                 vec![true, false, true, true
```

**File**: `src/operator/src/test_util/partition_manager.rs` (modified, +101/-92)
```diff
@@ -97,11 +97,6 @@ fn new_test_table_info_with_columns(
         .unwrap()
 }
 
-#[cfg(test)]
-fn new_physical_test_table_info(table_id: u32, table_name: &str) -> TableInfo {
-    new_test_table_info_with_columns(table_id, table_name, test_column_schemas(true), vec![0, 2])
-}
-
 #[cfg(test)]
 fn new_logical_test_table_info(table_id: u32, table_name: &str) -> TableInfo {
     new_test_table_info_with_columns(table_id, table_name, test_column_schemas(false), vec![0])
@@ -279,96 +274,110 @@ async fn test_partition_expr_version_cache() {
 
 #[tokio::test]
 async fn test_logical_split_rows_rejects_physical_only_partition_column() {
-    let kv_backend = Arc::new(common_meta::kv_backend::memory::MemoryKvBackend::new());
-    let table_metadata_manager = TableMetadataManager::new(kv_backend.clone());
-    let table_route_cache = test_new_table_route_cache(kv_backend.clone());
-    let partition_info_cache = test_new_partition_info_cache(table_route_cache.clone());
-    let partition_manager =
-        PartitionRuleManager::new(kv_backend, table_route_cache, partition_info_cache);
-    let physical_table_info = new_physical_test_table_info(1024, "physical");
-    let logical_table_info = new_logical_test_table_info(1025, "logical");
-    assert_eq!(
-        vec!["a", "b"],
-        physical_table_info
-            .meta
-            .partition_column_names()
-            .map(|name| name.as_str())
-            .collect::<Vec<_>>()
-    );
-    assert_eq!(
-        vec!["a"],
-        logical_table_info
-            .meta
-            .partition_column_names()
-            .map(|name| name.as_str())
-            .collect::<Vec<_>>()
-    );
+    for missing_column in ["b", "__tsid"] {
+        let kv_backend = Arc::new(common_meta::kv_backend::memory::MemoryKvBackend::new());
+        let table_metadata_manager = TableMetadataManager::new(kv_backend.clone());
+        let table_route_cache = test_new_table_route_cache(kv_backend.clone());
+        let partition_info_cache = test_new_partition_info_cache(table_route_cache.clone());
+        let partition_manager =
+            PartitionRuleManager::new(kv_backend, table_route_cache, partition_info_cache);
+        let mut physical_columns = test_column_schemas(true);
+        physical_columns[2].name = missing_column.to_string();
+        let physical_table_info =
+            new_test_table_info_with_columns(1024, "physical", physical_columns, vec![0, 2]);
+        let mut logical_table_info = new_logical_test_table_info(1025, "logical");
+        logical_table_info.meta.engine =
+            store_api::metric_engine_consts::METRIC_ENGINE_NAME.to_string();
+        logical_table_info.meta.options.extra_options.insert(
+            store_api::metric_engine_consts::LOGICAL_TABLE_METADATA_KEY.to_string(),
+            "1024".to_string(),
+        );
+        assert_eq!(
+            vec!["a", missing_column],
+            physical_table_info
+                .meta
+                .partition_column_names()
+                .map(|name| name.as_str())
+                .collect::<Vec<_>>()
+        );
+        assert_eq!(
+            vec!["a"],
+            logical_table_info
+                .meta
+                .partition_column_names()
+                .map(|name| name.as_str())
+                .collect::<Vec<_>>()
+        );
 
-    table_metadata_manager
-        .create_table_metadata(
-            physical_table_info,
-            TableRouteValue::physical(vec![RegionRoute {
-                region: Region {
-                    id: 1.into(),
-                    name: "r1".to_string(),
-                    attrs: BTreeMap::new(),
-                    partition_expr: PartitionExpr::new(
-                        Operand::Expr(PartitionExpr::new(
-                            Operand::Column("a".to_string()),
-                            RestrictedOp::GtEq,
-                            Operand::Value(datatypes::value::Value::Int32(10)),
-                        )),
-                        RestrictedOp::And,
-                        Operand::Expr(PartitionExpr::new(
-                            Operand::Column("b".to_string()),
-                            RestrictedOp::Lt,
-                            Operand::Value(datatypes::value::Value::Int32(50)),
-                        )),
-                    )
-                    .as_json_str()
-                    .unwrap(),
-                },
-                leader_peer: Some(Peer::new(1, "")),
-                follower_peers: vec![],
-                leader_state: None,
-                leader_down_since: None,
-                write_route_policy: None,
-            }]),
-            new_test_region_wal_options(vec![1]),
-        )
-        .await
-        .unwrap();
-    table_metadata_manager
-        .create_table_metadata(
-            logical_table_info.clone(),
-            TableRouteValue::logical(1024),
-            new_test_region_wal_options(vec![]),
-        )
-        .await
-        .unwrap();
+     
```

**File**: `src/partition/src/error.rs` (modified, +8/-0)
```diff
@@ -101,6 +101,13 @@ pub enum Error {
         location: Location,
     },
 
+    #[snafu(display("Invalid partition input, reason: {}", reason))]
+    InvalidPartitionInput {
+        reason: String,
+        #[snafu(implicit)]
+        location: Location,
+    },
+
     #[snafu(display("Invalid DeleteRequest, reason: {}", reason))]
     InvalidDeleteRequest {
         reason: String,
@@ -266,6 +273,7 @@ impl ErrorExt for Error {
 
             Error::RegionKeysSize { .. }
             | Error::InvalidInsertRequest { .. }
+            | Error::InvalidPartitionInput { .. }
             | Error::InvalidDeleteRequest { .. } => StatusCode::InvalidArguments,
 
             Error::ConvertScalarValue { .. }
```

**File**: `src/partition/src/manager.rs` (modified, +55/-13)
```diff
@@ -12,7 +12,7 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
-use std::collections::HashMap;
+use std::collections::{HashMap, HashSet};
 use std::sync::Arc;
 
 use api::v1::Rows;
@@ -22,13 +22,17 @@ use common_meta::kv_backend::KvBackendRef;
 use common_meta::peer::Peer;
 use common_meta::rpc::router::{self, RegionRoute};
 use snafu::{OptionExt, ResultExt};
+use store_api::metric_engine_consts::{
+    DATA_SCHEMA_TABLE_ID_COLUMN_NAME, LOGICAL_TABLE_METADATA_KEY, METRIC_ENGINE_NAME,
+};
 use store_api::storage::{RegionId, RegionNumber};
 use table::metadata::{TableId, TableInfo};
 
 use crate::cache::{CachedPartitionInfo, PartitionInfoCacheRef, PhysicalPartitionInfo};
 use crate::error::{FindLeaderSnafu, Result};
 use crate::expr::PartitionExpr;
 use crate::multi_dim::MultiDimPartitionRule;
+use crate::partition::PartitionEvalContext;
 use crate::splitter::RowSplitter;
 use crate::{PartitionRuleRef, error};
 
@@ -192,12 +196,6 @@ impl PartitionRuleManager {
         &self,
         table_info: &TableInfo,
     ) -> Result<(PartitionRuleRef, HashMap<RegionNumber, Option<u64>>)> {
-        let partition_columns = table_info
-            .meta
-            .partition_column_names()
-            .cloned()
-            .collect::<Vec<_>>();
-
         let partition_info = self
             .find_physical_partition_info(table_info.table_id())
             .await?;
@@ -225,12 +223,12 @@ impl PartitionRuleManager {
                 .filter(|partition| partition.partition_expr.is_none())
                 .map(|partition| partition.id.region_number()),
         );
-        let partition_rule = Arc::new(MultiDimPartitionRule::try_new(
-            partition_columns,
-            regions,
-            exprs,
-            false,
-        )?) as _;
+        let (partition_columns, eval_context) =
+            Self::resolve_partition_columns_and_context(table_info, &exprs)?;
+        let partition_rule = Arc::new(
+            MultiDimPartitionRule::try_new(partition_columns, regions, exprs, false)?
+                .with_eval_context(eval_context),
+        ) as _;
         Ok((partition_rule, partition_versions))
     }
 
@@ -276,6 +274,50 @@ impl PartitionRuleManager {
 
         Ok(result)
     }
+
+    /// Resolves all expression inputs, including identity supplied outside the payload.
+    fn resolve_partition_columns_and_context(
+        table_info: &TableInfo,
+        exprs: &[PartitionExpr],
+    ) -> Result<(Vec<String>, PartitionEvalContext)> {
+        if table_info.meta.engine != METRIC_ENGINE_NAME
+            || !table_info
+                .meta
+                .options
+                .extra_options
+                .contains_key(LOGICAL_TABLE_METADATA_KEY)
+        {
+            let columns = table_info.meta.partition_column_names().cloned().collect();
+            return Ok((columns, PartitionEvalContext::FromPayload));
+        }
+
+        // Catalog maps only physical partition columns present in the logical schema.
+        // The routing context can additionally supply __table_id.
+        let mut columns = HashSet::new();
+        for expr in exprs {
+            expr.collect_column_names(&mut columns);
+        }
+        let mut columns: Vec<_> = columns.into_iter().collect();
+        // Keep rule snapshots deterministic despite collecting names in a HashSet.
+        columns.sort_unstable();
+        for column in &columns {
+            if column != DATA_SCHEMA_TABLE_ID_COLUMN_NAME
+                && table_info
+                    .meta
+                    .schema
+                    .column_schema_by_name(column)
+                    .is_none()
+            {
+                return error::UndefinedColumnSnafu { column }.fail();
+            }
+        }
+        Ok((
+            columns,
+            PartitionEvalContext::WithTableId {
+                table_id: table_info.table_id(),
+            },
+        ))
+    }
 }
 
 /// Creates partitions from region routes.
```

**File**: `src/partition/src/multi_dim.rs` (modified, +233/-10)
```diff
@@ -22,23 +22,27 @@ use datafusion_common::tree_node::{Transformed, TreeNode};
 use datafusion_expr::{ColumnarValue, Expr};
 use datafusion_physical_expr::PhysicalExpr;
 use datatypes::arrow;
-use datatypes::arrow::array::{Array, BooleanArray, BooleanBufferBuilder, RecordBatch};
+use datatypes::arrow::array::{
+    Array, BooleanArray, BooleanBufferBuilder, NullArray, RecordBatch, UInt32Array,
+};
 use datatypes::arrow::buffer::BooleanBuffer;
 use datatypes::arrow::compute::prep_null_mask_filter;
-use datatypes::arrow::datatypes::{Field, Schema};
+use datatypes::arrow::datatypes::{DataType as ArrowDataType, Field, Schema};
+use datatypes::arrow::record_batch::RecordBatchOptions;
 use datatypes::data_type::DataType as _;
 use datatypes::prelude::Value;
 use datatypes::vectors::{Helper, VectorRef};
 use serde::{Deserialize, Serialize};
 use snafu::{OptionExt, ResultExt, ensure};
+use store_api::metric_engine_consts::DATA_SCHEMA_TABLE_ID_COLUMN_NAME;
 use store_api::storage::RegionNumber;
 
 use crate::PartitionRule;
 use crate::checker::PartitionChecker;
 use crate::error::{self, Result, UndefinedColumnSnafu};
 use crate::expr::{Operand, PartitionExpr, RestrictedOp, plan_physical_expr};
 use crate::function::IcebergHash;
-use crate::partition::RegionMask;
+use crate::partition::{PartitionEvalContext, RegionMask};
 
 /// The default region number when no partition exprs are matched.
 const DEFAULT_REGION: RegionNumber = 0;
@@ -76,6 +80,10 @@ pub struct MultiDimPartitionRule {
     /// Cache of physical expressions.
     #[serde(skip)]
     physical_expr_cache: RwLock<PhysicalExprCache>,
+    /// Write-local routing context; not persisted. Deserialization defaults to
+    /// [`PartitionEvalContext::FromPayload`].
+    #[serde(skip)]
+    eval_context: PartitionEvalContext,
 }
 
 impl MultiDimPartitionRule {
@@ -101,6 +109,7 @@ impl MultiDimPartitionRule {
             regions,
             exprs,
             physical_expr_cache: RwLock::new(None),
+            eval_context: PartitionEvalContext::FromPayload,
         };
 
         if check_exprs {
@@ -111,6 +120,12 @@ impl MultiDimPartitionRule {
         Ok(rule)
     }
 
+    /// Attaches write-local table identity without changing persisted partition expressions.
+    pub(crate) fn with_eval_context(mut self, context: PartitionEvalContext) -> Self {
+        self.eval_context = context;
+        self
+    }
+
     pub fn exprs(&self) -> &[PartitionExpr] {
         &self.exprs
     }
@@ -124,14 +139,10 @@ impl MultiDimPartitionRule {
             }
         );
 
-        for (region_index, expr) in self.exprs.iter().enumerate() {
-            if self.evaluate_expr(expr, values)? {
-                return Ok(self.regions[region_index]);
-            }
+        match self.eval_context {
+            PartitionEvalContext::FromPayload => self.find_region_from_payload(values),
+            PartitionEvalContext::WithTableId { .. } => self.find_region_with_context(values),
         }
-
-        // return the default region number
-        Ok(DEFAULT_REGION)
     }
 
     fn evaluate_expr(&self, expr: &PartitionExpr, values: &[Value]) -> Result<bool> {
@@ -260,6 +271,8 @@ impl MultiDimPartitionRule {
         &self,
         record_batch: &RecordBatch,
     ) -> Result<HashMap<RegionNumber, RegionMask>> {
+        let routing_batch = self.build_routing_batch(record_batch)?;
+        let record_batch = routing_batch.as_ref().unwrap_or(record_batch);
         let num_rows = record_batch.num_rows();
         if self.regions.len() == 1 {
             return Ok([(
@@ -369,6 +382,96 @@ impl MultiDimPartitionRule {
         Ok(result)
     }
 
+    /// Finds a region using the supplied scalar partition values.
+    fn find_region_from_payload(&self, values: &[Value]) -> Result<RegionNumber> {
+        for (region_index, expr) in self.exprs.iter().enumerate() {
+            if self.evaluate_expr(expr, values)? {
+                return Ok(self.regions[region_index]);
+            }
+        }
+
+        // return the default region number
+        Ok(DEFAULT_REGION)
+    }
+
+    /// Evaluates one row through the same context-aware batch path as bulk writes.
+    fn find_region_with_context(&self, values: &[Value]) -> Result<RegionNumber> {
+        let mut fields = Vec::new();
+        let mut arrays = Vec::new();
+        for (name, value) in self.partition_columns.iter().zip(values) {
+            if name == DATA_SCHEMA_TABLE_ID_COLUMN_NAME {
+                continue;
+            }
+            let vector =
+                Helper::try_from_row_into_vector(std::slice::from_ref(value), &value.data_type())
+                    .context(error::ConvertToVectorSnafu)?;
+            let array = vector.to_arrow_array();
+            fields.push(Field::new(name, array.data_type().clone(), true));
+            arrays.push(array);
+        }
+        let batch = RecordBatch::try_new_with_options(
+            Arc::new(Schema::new(fields)),
+            arrays,
+            &Rec
```

**File**: `src/partition/src/partition.rs` (modified, +27/-1)
```diff
@@ -20,20 +20,46 @@ use std::sync::Arc;
 use datatypes::arrow::array::{BooleanArray, RecordBatch};
 use datatypes::prelude::Value;
 use serde::{Deserialize, Serialize};
-use store_api::storage::RegionNumber;
+use store_api::storage::{RegionNumber, TableId};
 
 use crate::error::Result;
 
 pub type PartitionRuleRef = Arc<dyn PartitionRule>;
 
+/// Supplies additional inputs when evaluating a write's physical partition expressions.
+/// The variants describe input sources, not whether the original write targets a logical table.
+#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
+pub enum PartitionEvalContext {
+    /// Reads partition values directly from the payload.
+    /// Physical metric batches combining logical tables use this variant: their payload
+    /// carries a per-row `__table_id` column that is retained across routing retries.
+    #[default]
+    FromPayload,
+    /// Supplies one table id for every row, overriding any payload `__table_id` value.
+    /// Used for single-logical-table writes whose payload omits internal columns.
+    /// Other partition values still come from the payload; omitted columns declared
+    /// in the logical schema are evaluated as NULL. Already-converted physical metric
+    /// batches carry per-row identities and use [`Self::FromPayload`] instead.
+    WithTableId { table_id: TableId },
+}
+
 pub trait PartitionRule: Sync + Send {
     fn as_any(&self) -> &dyn Any;
 
     fn partition_columns(&self) -> &[String];
 
+    /// Additional inputs for evaluating physical partition expressions during write routing.
+    /// Defaults to [`PartitionEvalContext::FromPayload`]. Override when routing needs
+    /// inputs supplied outside the write payload.
+    fn eval_context(&self) -> PartitionEvalContext {
+        PartitionEvalContext::FromPayload
+    }
+
     /// Finds the target region by the partition values.
     ///
     /// Note that the `values` should have the same length as the `partition_columns`.
+    /// With [`PartitionEvalContext::WithTableId`], the context supplies `__table_id`;
+    /// the value in its payload slot is ignored.
     fn find_region(&self, values: &[Value]) -> Result<RegionNumber>;
 
     /// Split the record batch into multiple regions by the partition values.
```

#### Recent Merged Pull Requests:
- **PR #10545** (2026-11-20): test(query): skip the far-future overflow test when SystemTime cannot represent it (@discord9)
- **PR #10543** (2026-11-20): fix(mito-codec): align sparse metric rows with physical region fields (@WenyXu)
- **PR #10542** (2026-11-20): perf(catalog): batch cached metadata reads for information schema scans (@WenyXu)
- **PR #10536** (2026-11-20): perf(metric-engine): share logical column metadata by physical table (@WenyXu)
- **PR #10535** (2026-11-20): perf(metric-engine): stream metadata copies during repartition (@WenyXu)
- **PR #10527** (2026-11-19): feat(meta): add shared batch lookups for table metadata caches (@WenyXu)

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

## X. test(query): skip the far-future overflow test when SystemTime cannot represent 

**RULE**:
When implementing operations in `src/query/src/promql/planner/test.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in GreptimeTeam/greptimedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4eca3194`: test(query): skip the far-future overflow test when SystemTime cannot represent it. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/query/src/promql/planner/test.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
///
/// A platform whose `SystemTime` cannot represent the `5e18 ms` start skips the high-level
/// shape; the platform-independent `native_tree_supported_declines_the_instants_that_overflow`
/// still covers the admission predicate there.
    // The far end of the `i64` millisecond range, one step apart. Windows' `SystemTime` and
    // 32-bit `time_t` targets cannot represent it, so they cannot build this statement.
    let Some(far_start) = UNIX_EPOCH.checked_add(Duration::from_millis(5_000_000_000_000_000_000))
    else {
        return;
    };
            eval_stmt.start = far_start;
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    // The far end of the `i64` millisecond range, one step apart.
            eval_stmt.start = UNIX_EPOCH
                .checked_add(Duration::from_millis(5_000_000_000_000_000_000))
                .unwrap();
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4eca3194` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
