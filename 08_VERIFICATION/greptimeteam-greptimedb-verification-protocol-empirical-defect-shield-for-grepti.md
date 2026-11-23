# Verification Protocol: Verification Protocol: Empirical Defect Shield for GreptimeTeam/greptimedb

<!-- PROVENANCE_START
{
  "source_repository": "GreptimeTeam/greptimedb",
  "source_url": "https://github.com/GreptimeTeam/greptimedb",
  "source_version": "b26b87f9",
  "license": "Apache-2.0",
  "timestamp": "2026-11-23T18:50:50.046Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-greptimeteam-greptimedb",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [GreptimeTeam/greptimedb](https://github.com/GreptimeTeam/greptimedb) (Revision: `b26b87f9`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-23T18:50:50.046Z`  
> **Learning ID**: `learn-github-greptimeteam-greptimedb`


## 1. Scope & Verification Target
- **Target Repository**: `GreptimeTeam/greptimedb` (Commit: `b26b87f9`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): GreptimeTeam/greptimedb

> **Canonical Artifact**: `07_PROJECT_LEARNING/greptimeteam-greptimedb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/GreptimeTeam/greptimedb](https://github.com/GreptimeTeam/greptimedb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-23T18:50:48.403Z  
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
- **Issue #10582** (2026-11-23): **mito2: persisted primary key bounds are located by parquet leaf name, and are now consumed as a correctness premise**
  *Symptoms*: ### Summary  `FileMeta.primary_key_min/max` is produced by `extract_primary_key_range`, which finds the primary key column by **parquet leaf column name**:  ```rust // src/mito2/src/sst/parquet/metadata.rs:124-137 let pk_column_idx = parquet_meta     .file_metadata()     .schema_descr()     .columns()     .iter()     .position(|column| column.name() == PRIMARY_KEY_COLUMN_NAME)?; ```  `SchemaDescr::columns()` returns the flattened leaves, and user columns come *before* the internal ones, which `internal_fields()` appends last (`src/mito2/src/sst.rs:300-336`). A JSON2 field can be concretized into an Arrow `Struct` (`src/datatypes/src/types/json_type.rs:139-145`), so if a JSON layout contains a child key literally named `__primary_key`, that leaf is found first and the recorded bounds describe the JSON strings rather than the primary key.  Until now that was a statistics problem. #10564 and #10561 are the first consumers to treat the bounds as a **correctness premise**: #10564 prunes a whole file by them, #10561 splits a sequential scan into ranges that are deduplicated independently. A wrong bound therefore drops rows or splits the versions of one key.  Neither consumer re-checks the bounds against the file's footer; `FileHandle::primary_key_range` returns whatever the manifest recorded (`src/mito2/src/sst/file.rs:856-863`).  ### Suggested fix  1. Locate the column by field id (`PRIMARY_KEY_PARQUET_FIELD_ID`, already attached in `internal_fields()`) or by the top-level field r

- **Issue #10564** (2026-11-23): **perf(mito2): prune files by their primary key range before reading footers**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  ## What's changed and what's your intention?  Manifest-level file pruning runs before any footer read, but `FileLevelPruningStats` only exposes the time index range. Every file whose time range overlaps the query has its footer fetched, and files that hold none of the requested keys are dropped only later, by row group statistics of the first tag.  `FileLevelPruningStats` now also exposes min and max of the first primary key column, decoded from `FileMeta.primary_key_min/max` with `decode_leftmost`, the same way row group pruning decodes `first_tag_values`. With the dense encoding this is the first tag; with the sparse encoding of the metric engine it is `__table_id`, so a logical table scan skips files that hold no rows of that table. Files without a recorded key range keep the old behavior.  The key range is decoded only when pruning asks for the first primary key column, so predicates on the time index or fields pay nothing extra. Pruning 20,000 files with such predicates costs 3.0–3.3 µs per file on both main and this PR; decoding eagerly would add about 0.5 µs per file.  `files_time_range_pruned` now also counts files pruned by key range.  Benchmark: k8s metrics (metric engine, 29.3M samples) with compaction outputs split at 8 MB, 11 files per window; base `8787551393`, Apple M4 Max, MinIO behind a proxy that a
  **Post-Mortem & Fix Analysis**:
  > <!-- pr-open-limit --> > [!WARNING] > @killme2008 has **6** open non-draft pull requests in this repository, over the limit of **5**.  Review is the scarcest resource here. Please land or close some of these before pushing this one forward.  - [PR 10235: perf\(mito2\)\: box file range streams to reduce state copies](https://redirect.github.com/GreptimeTeam/greptimedb/pull/10235) - [PR 10516: docs\: add RFC for time\-slice aggregate cache](https://redirect.github.com/GreptimeTeam/greptimedb/pull/10516) - [PR 10528: perf\(mito2\)\: bound row group bytes and skip statistics for large field values](https://redirect.github.com/GreptimeTeam/greptimedb/pull/10528) - [PR 10556: fix\(sql\)\: keep column options in ALTER TABLE ADD COLUMN](https://redirect.github.com/GreptimeTeam/greptimedb/pull/10556) - [PR 10561: perf\(mito2\)\: split seq scan ranges of files with disjoint primary keys](https://redirect.github.com/GreptimeTeam/greptimedb/pull/10561)  [View your open pull requests](https://githu
  > On #10582: the leaf-name lookup is real. `extract_primary_key_range` and `ParquetReader::build_primary_key` both match `__primary_key` by leaf name, so a nested child with that name is found first. I am fixing both in #10561 to match the top-level column only, since that PR also relies on the bounds.

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

### Incident Patch 1: `946e599d` (2026-11-23)
**Commit Message**: fix: catch up a writable region that still awaits its Leader lease (#10559)

* feat(store-api): ask an engine whether a region is a confirmed leader

Add RegionEngine::is_confirmed_leader. It answers None for a region the
engine does not find, Some(false) for a follower or, on a node that
requires leases to confirm its leaders, for a leader that a catchup
promoted and that no Leader or StagingLeader lease has confirmed since,
and Some(true) otherwise. The default answers from the role alone, with
the mapping RegionServer::is_region_leader uses.

Document that set_region_role_with_lease also returns false while a
catchup runs on the region or it waits for a reload, and that a catchup
also applies to a leader that is not confirmed.

Signed-off-by: jeremyhi <[REDACTED_EMAIL]>

* fix(mito2): catch a writable region awaiting its Leader lease up again

A migration that rolls back after its catchup can leave the target
region writable but waiting for a Leader lease that never comes, while
the source keeps acknowledging writes. A later upgrade must catch it up
again instead of treating it as ready.

- MitoEngine::is_confirmed_leader reads the role and the lease wait of
  one instance toget

**File**: `src/datanode/src/heartbeat/handler/upgrade_region.rs` (modified, +40/-3)
```diff
@@ -101,7 +101,9 @@ impl UpgradeRegionsHandler {
         let mut timeout = None;
 
         for upgrade_region in upgrade_regions {
-            let Some(writable) = ctx.region_server.is_region_leader(upgrade_region.region_id)
+            let Some(confirmed) = ctx
+                .region_server
+                .is_confirmed_leader(upgrade_region.region_id)
             else {
                 // Region is not found.
                 debug!("Region {} is not found", upgrade_region.region_id);
@@ -114,8 +116,10 @@ impl UpgradeRegionsHandler {
                 continue;
             };
 
-            // Ignores the catchup requests for writable regions.
-            if writable {
+            // Ignores the catchup requests for writable regions, except those a catchup made
+            // writable with no Leader lease since: they may lack what the leader has written
+            // since, and the engine catches them up again.
+            if confirmed {
                 warn!(
                     "Region {} is writable, ignores the catchup request",
                     upgrade_region.region_id
@@ -226,6 +230,7 @@ mod tests {
     use common_meta::kv_backend::memory::MemoryKvBackend;
     use mito2::engine::MITO_ENGINE_NAME;
     use store_api::region_engine::RegionRole;
+    use store_api::region_request::RegionRequest;
     use store_api::storage::RegionId;
 
     use crate::error;
@@ -361,6 +366,38 @@ mod tests {
         }
     }
 
+    #[tokio::test]
+    async fn test_writable_region_awaiting_leader_lease_catches_up() {
+        let mock_region_server = mock_region_server();
+        let region_id = RegionId::new(1024, 1);
+
+        let (mock_engine, mut requests) =
+            MockRegionEngine::with_custom_apply_fn(MITO_ENGINE_NAME, |region_engine| {
+                region_engine.mock_role = Some(Some(RegionRole::Leader));
+                region_engine.mock_confirmed_leader = Some(false);
+            });
+        mock_region_server.register_test_region(region_id, mock_engine);
+        let kv_backend = Arc::new(MemoryKvBackend::new());
+        let handler_context = HandlerContext::new_for_test(mock_region_server, kv_backend);
+        let reply = UpgradeRegionsHandler::new_test()
+            .handle(
+                &handler_context,
+                vec![UpgradeRegion {
+                    region_id,
+                    replay_timeout: Duration::from_secs(1),
+                    ..Default::default()
+                }],
+            )
+            .await;
+
+        let reply = &reply.unwrap().expect_upgrade_regions_reply()[0];
+        assert!(reply.ready);
+        assert!(reply.error.is_none());
+        let (caught_up, request) = requests.try_recv().unwrap();
+        assert_eq!(caught_up, region_id);
+        assert!(matches!(request, RegionRequest::Catchup(_)));
+    }
+
     #[tokio::test]
     async fn test_region_not_ready() {
         let mock_region_server = mock_region_server();
```

**File**: `src/datanode/src/region_server.rs` (modified, +10/-1)
```diff
@@ -478,6 +478,14 @@ impl RegionServer {
         })
     }
 
+    /// See [`RegionEngine::is_confirmed_leader`](store_api::region_engine::RegionEngine::is_confirmed_leader).
+    pub fn is_confirmed_leader(&self, region_id: RegionId) -> Option<bool> {
+        self.inner
+            .region_map
+            .get(&region_id)
+            .and_then(|engine| engine.is_confirmed_leader(region_id))
+    }
+
     pub fn set_region_role(&self, region_id: RegionId, role: RegionRole) -> Result<()> {
         let engine = self
             .inner
@@ -491,7 +499,8 @@ impl RegionServer {
 
     /// Sets the role of a region from a lease the metasrv grants until `deadline`, in reply to a
     /// heartbeat sent at `sent_at`. Returns false if the engine ignores a Leader lease because the
-    /// region was downgraded or (re)opened after `sent_at`.
+    /// region was downgraded or (re)opened after `sent_at`, a catchup runs on it, or it waits for a
+    /// reload.
     pub fn set_region_role_with_lease(
         &self,
         region_id: RegionId,
```

**File**: `src/datanode/src/tests.rs` (modified, +12/-0)
```diff
@@ -135,6 +135,7 @@ pub struct MockRegionEngine {
     pub(crate) handle_sync_region_mock_fn: Option<MockSyncRegionHandler>,
     pub(crate) handle_stop_mock_fn: Option<MockStopHandler>,
     pub(crate) mock_role: Option<Option<RegionRole>>,
+    pub(crate) mock_confirmed_leader: Option<bool>,
     /// The candidate lease ids of the leases the engine received.
     pub(crate) candidate_lease_ids: Mutex<Vec<Option<u64>>>,
     engine: String,
@@ -154,6 +155,7 @@ impl MockRegionEngine {
                 handle_sync_region_mock_fn: None,
                 handle_stop_mock_fn: None,
                 mock_role: None,
+                mock_confirmed_leader: None,
                 candidate_lease_ids: Mutex::default(),
                 engine: engine.to_string(),
             }),
@@ -177,6 +179,7 @@ impl MockRegionEngine {
                 handle_sync_region_mock_fn: None,
                 handle_stop_mock_fn: None,
                 mock_role: None,
+                mock_confirmed_leader: None,
                 candidate_lease_ids: Mutex::default(),
                 engine: engine.to_string(),
             }),
@@ -200,6 +203,7 @@ impl MockRegionEngine {
                 handle_sync_region_mock_fn: None,
                 handle_stop_mock_fn: None,
                 mock_role: None,
+                mock_confirmed_leader: None,
                 candidate_lease_ids: Mutex::default(),
                 engine: engine.to_string(),
             }),
@@ -224,6 +228,7 @@ impl MockRegionEngine {
             handle_sync_region_mock_fn: None,
             handle_stop_mock_fn: None,
             mock_role: None,
+            mock_confirmed_leader: None,
             candidate_lease_ids: Mutex::default(),
             engine: engine.to_string(),
         };
@@ -330,6 +335,13 @@ impl RegionEngine for MockRegionEngine {
         Some(RegionRole::Leader)
     }
 
+    fn is_confirmed_leader(&self, region_id: RegionId) -> Option<bool> {
+        self.role(region_id).map(|role| {
+            self.mock_confirmed_leader
+                .unwrap_or(role != RegionRole::Follower)
+        })
+    }
+
     async fn sync_region(
         &self,
         region_id: RegionId,
```

**File**: `src/metric-engine/src/engine.rs` (modified, +146/-7)
```diff
@@ -421,14 +421,12 @@ impl RegionEngine for MetricEngine {
                 Ok(true) => {}
                 Ok(false) => {
                     // If the metadata region ignored the grant, the data region is not handed it, so
-                    // record it for the data region. If the data region ignored it, the data region
-                    // has already recorded it.
+                    // record it and extend the deadline for the data region, as an ignored Leader
+                    // lease does. If the data region ignored it, the data region has done both.
                     if x == metadata_region_id {
-                        self.inner.mito.record_granted_lease(
-                            data_region_id,
-                            sent_at,
-                            candidate_lease_id,
-                        );
+                        let mito = &self.inner.mito;
+                        mito.record_granted_lease(data_region_id, sent_at, candidate_lease_id);
+                        mito.extend_leader_deadline(data_region_id, deadline);
                     }
                     return Ok(false);
                 }
@@ -539,6 +537,18 @@ impl RegionEngine for MetricEngine {
         }
     }
 
+    /// A physical region is a confirmed leader only if both regions of the pair are, since one
+    /// may have been promoted without the other.
+    fn is_confirmed_leader(&self, region_id: RegionId) -> Option<bool> {
+        if !self.inner.is_physical_region(region_id) {
+            return None;
+        }
+        let mito = &self.inner.mito;
+        let metadata = mito.is_confirmed_leader(utils::to_metadata_region_id(region_id))?;
+        let data = mito.is_confirmed_leader(utils::to_data_region_id(region_id))?;
+        Some(metadata && data)
+    }
+
     fn as_any(&self) -> &dyn Any {
         self
     }
@@ -1126,6 +1136,135 @@ mod test {
         assert_eq!(engine.role(physical_region_id), Some(RegionRole::Leader));
     }
 
+    #[tokio::test]
+    async fn test_physical_region_is_confirmed_leader_only_with_both_regions() {
+        let env = TestEnv::new().await;
+        env.init_metric_region().await;
+        let (engine, mito) = (env.metric(), env.mito());
+        mito.require_write_lease();
+        mito.renew_node_lease(Instant::now() + LEASE);
+        let physical_region_id = env.default_physical_region_id();
+        let metadata_region_id = utils::to_metadata_region_id(physical_region_id);
+        // A logical region has no role of its own.
+        assert_eq!(
+            engine.is_confirmed_leader(env.default_logical_region_id()),
+            None
+        );
+        for region_id in [
+            metadata_region_id,
+            utils::to_data_region_id(physical_region_id),
+        ] {
+            mito.set_region_role_state_gracefully(region_id, SettableRegionRoleState::Follower)
+                .await
+                .unwrap();
+        }
+        let catchup = RegionCatchupRequest {
+            set_writable: true,
+            ..Default::default()
+        };
+        engine
+            .handle_batch_catchup_requests(1, vec![(physical_region_id, catchup)])
+            .await
+            .unwrap()
+            .into_iter()
+            .for_each(|(_, result)| {
+                result.unwrap();
+            });
+        assert_eq!(engine.role(physical_region_id), Some(RegionRole::Leader));
+        assert_eq!(engine.is_confirmed_leader(physical_region_id), Some(false));
+
+        // The data region still waits after the metadata region received its lease.
+        let sent_at = Instant::now();
+        mito.set_region_role_with_lease(
+            metadata_region_id,
+            RegionRole::Leader,
+            sent_at,
+            sent_at + LEASE,
+            None,
+        )
+        .unwrap();
+        assert_eq!(engine.is_confirmed_leader(physical_region_id), Some(false));
+
+        engine
+            .set_region_role_with_lease(
+                physical_region_id,
+                RegionRole::Leader,
+                sent_at,
+                sent_at + LEASE,
+                None,
+            )
+            .unwrap();
+        assert_eq!(engine.is_confirmed_leader(physical_region_id), Some(true));
+
+        // A confirmed data region alone does not make the physical region confirmed.
+        mito.set_region_role(metadata_region_id, RegionRole::Follower)
+            .unwrap();
+        assert_eq!(engine.is_confirmed_leader(physical_region_id), Some(false));
+    }
+
+    /// A physical Leader lease that the metadata region ignores is still recorded for the data
+    /// region and extends its deadline.
+    #[tokio::test]
+    async fn test_lease_ignored_by_metadata_region_extends_data_deadline() {
+        let env = TestEnv::new().await;
+        env.init_metric_region().await;
+        let (engine, mito) = (env.metric(), env.mito());
+        let physical_region_id = env.default_physical_region_id();
+        let metadata_region_i
```

**File**: `src/mito2/AGENTS.md` (modified, +8/-1)
```diff
@@ -218,7 +218,14 @@ Tests live next to the code as `*_test.rs` (e.g. `src/mito2/src/engine/flush_tes
   a downgrade's flush. The lease that ends the wait wakes the worker
   (`handle_leader_lease_wait_ended`) to schedule the flushes the wait deferred and, only if the
   region is then a writable leader, start a compaction, build missing indexes, re-issue the
-  index build retries the wait refused and persist backfilled metadata.
+  index build retries the wait refused and persist backfilled metadata. A catchup of a waiting
+  region catches it up again into an unregistered replacement while the region stays registered,
+  demoted unless it is in a transient leader state. The replacement replaces it only if the replay
+  succeeds and the region took no write and made no commit meanwhile; otherwise the region keeps
+  its memtable for the next Leader lease (`catch_up_again`, `handle_caught_up_again`); the datanode
+  upgrade handler sends that catchup unless `RegionEngine::is_confirmed_leader` is true, so an
+  engine wrapping mito must implement that method from mito's answers (the metric engine requires
+  both regions of the pair).
 - The latest lease each region received (`GrantedLeases` in `lease.rs`) lives outside the
   region instance, so a reopen during catchup keeps it. Every path that removes a region from
   a worker's region map must also remove its record and its kept index build retries:
```

**File**: `src/mito2/src/engine.rs` (modified, +19/-4)
```diff
@@ -375,6 +375,15 @@ impl MitoEngine {
             });
     }
 
+    /// Extends the Leader deadline of a region as a Leader or StagingLeader lease that the region
+    /// ignores does. Like [Self::record_granted_lease], it serves a region of a group that received
+    /// the lease as a whole. Does nothing if the region is not open.
+    pub fn extend_leader_deadline(&self, region_id: RegionId, deadline: Instant) {
+        if let Ok(region) = self.inner.find_region(region_id) {
+            region.manifest_ctx.leader_deadline.extend(deadline);
+        }
+    }
+
     /// Freezes the clock of the lease checks at `at`.
     #[cfg(any(test, feature = "test"))]
     pub fn freeze_lease_clock(&self, at: Instant) {
@@ -1398,7 +1407,8 @@ impl EngineInner {
     }
 
     /// Converts the [`RegionRole`]. Unlike lease and catchup promotions, a conversion to Leader
-    /// does not check whether the region waits for a reload.
+    /// does not check whether the region waits for a reload, and unlike a lease it is not held
+    /// back while a catchup runs on the region.
     fn set_region_role(&self, region_id: RegionId, role: RegionRole) -> Result<()> {
         let region = self.find_region(region_id)?;
         let was_leader = region.region_role() == RegionRole::Leader;
@@ -1809,10 +1819,10 @@ impl RegionEngine for MitoEngine {
                 .notify_if_leader_lease_wait_ended(&region, promotion.ended_wait);
             return Ok(promotion.promoted);
         }
-        // The metasrv grants it to the leader of a region whose route is in staging, and it ends
-        // the wait for a Leader lease too.
+        // The metasrv grants it to the leader of a region whose route is in staging, and unless a
+        // catchup runs on the region it ends the wait for a Leader lease too.
         if role == RegionRole::StagingLeader && region.manifest_ctx.awaits_leader_lease() {
-            let ended_wait = region.manifest_ctx.record_leader_lease(sent_at);
+            let ended_wait = region.manifest_ctx.record_staging_leader_lease(sent_at);
             self.inner
                 .notify_if_leader_lease_wait_ended(&region, ended_wait);
         }
@@ -1870,6 +1880,11 @@ impl RegionEngine for MitoEngine {
         self.inner.role(region_id)
     }
 
+    fn is_confirmed_leader(&self, region_id: RegionId) -> Option<bool> {
+        self.find_region(region_id)
+            .map(|region| region.is_confirmed_leader())
+    }
+
     fn as_any(&self) -> &dyn Any {
         self
     }
```

**File**: `src/mito2/src/engine/catchup_test.rs` (modified, +20/-4)
```diff
@@ -32,6 +32,7 @@ use store_api::storage::{RegionId, ScanRequest};
 
 use crate::config::MitoConfig;
 use crate::engine::MitoEngine;
+use crate::engine::lease_test::promote_to_await_leader_lease;
 use crate::error::Error;
 use crate::manifest::action::RegionEdit;
 use crate::test_util::{
@@ -962,8 +963,13 @@ async fn test_catchup_not_exist_with_format(flat_format: bool) {
     assert_matches!(err.status_code(), StatusCode::RegionNotFound);
 }
 
+/// With `awaiting_leader_lease`, a catchup made the region writable and it awaits its Leader
+/// lease: a catchup refused as busy leaves it as it is, so the catchup in progress keeps it.
+#[rstest]
+#[case::follower(false)]
+#[case::awaiting_leader_lease(true)]
 #[tokio::test]
-async fn test_catchup_region_busy() {
+async fn test_catchup_region_busy(#[case] awaiting_leader_lease: bool) {
     common_telemetry::init_default_ut_logging();
     let mut env = TestEnv::new().await;
     let engine = env.create_engine(MitoConfig::default()).await;
@@ -973,9 +979,14 @@ async fn test_catchup_region_busy() {
         .handle_request(region_id, RegionRequest::Create(request))
         .await
         .unwrap();
-    engine
-        .set_region_role(region_id, RegionRole::Follower)
-        .unwrap();
+    if awaiting_leader_lease {
+        engine.require_write_lease();
+        promote_to_await_leader_lease(&engine, region_id).await;
+    } else {
+        engine
+            .set_region_role(region_id, RegionRole::Follower)
+            .unwrap();
+    }
     let worker = engine.inner.workers.worker(region_id);
     let catchup_regions = worker.catchup_regions();
     catchup_regions.insert_region(region_id);
@@ -990,4 +1001,9 @@ async fn test_catchup_region_busy() {
         .await
         .unwrap_err();
     assert_matches!(err.status_code(), StatusCode::RegionBusy);
+    if awaiting_leader_lease {
+        let region = engine.get_region(region_id).unwrap();
+        assert!(region.is_writable());
+        assert!(region.manifest_ctx.awaits_leader_lease());
+    }
 }
```

**File**: `src/mito2/src/engine/lease_test.rs` (modified, +55/-1)
```diff
@@ -46,7 +46,8 @@ use crate::engine::MitoEngine;
 use crate::engine::basic_test::build_bulk_insert_request;
 use crate::engine::index_build_test::async_build_mode_config;
 use crate::engine::listener::{
-    CountingStallListener, EventListener, EventListenerRef, WriteWalListener,
+    CountingStallListener, EventListener, EventListenerRef, FlushCancellationListener,
+    WriteWalListener,
 };
 use crate::engine::object_store_wal_test::wait_until;
 use crate::engine::open_test::open_region_with_backfilled_partition_expr;
@@ -840,6 +841,59 @@ async fn test_downgrade_flushes_region_awaiting_leader_lease() {
     assert_eq!(manifest_files(&engine).await, vec![3]);
 }
 
+/// A catchup again keeps a region whose flush is in flight, as the flush of a downgrade of a
+/// region that awaits its Leader lease can be, and answers busy.
+#[tokio::test]
+async fn test_catchup_again_keeps_region_with_flush_in_flight() {
+    common_telemetry::init_default_ut_logging();
+    let mut env = TestEnv::with_prefix("catchup-again-flush-in-flight").await;
+    let listener = Arc::new(FlushCancellationListener::default());
+    let (engine, schema) =
+        create_region_with_config(&mut env, None, MitoConfig::default(), listener.clone()).await;
+    promote_to_await_leader_lease(&engine, REGION_ID).await;
+    engine
+        .handle_request(REGION_ID, put_request(&schema, 0))
+        .await
+        .unwrap();
+    engine
+        .set_region_role_state_gracefully(REGION_ID, SettableRegionRoleState::DowngradingLeader)
+        .await
+        .unwrap();
+    let region = engine.get_region(REGION_ID).unwrap();
+    let flush = {
+        let engine = engine.clone();
+        tokio::spawn(async move { flush(&engine).await })
+    };
+    listener.wait_flush_started().await;
+
+    let error = catchup(&engine).await.unwrap_err();
+    assert_eq!(StatusCode::RegionBusy, error.status_code(), "{error:?}");
+    assert!(Arc::ptr_eq(&region, &engine.get_region(REGION_ID).unwrap()));
+    listener.resume_flush();
+    flush.await.unwrap().unwrap();
+    assert_eq!(count_rows(&engine).await, 3);
+}
+
+/// Under a local WAL, which replays nothing, a successful catchup again drops the region's
+/// unflushed rows.
+#[tokio::test]
+async fn test_catchup_again_drops_unflushed_rows_under_local_wal() {
+    common_telemetry::init_default_ut_logging();
+    let mut env = TestEnv::with_prefix("catchup-again-local-wal").await;
+    let (_listener, engine, schema) = create_region(&mut env, None).await;
+    promote_to_await_leader_lease(&engine, REGION_ID).await;
+    put(&engine, REGION_ID, &schema, 0).await.unwrap().unwrap();
+    let region = engine.get_region(REGION_ID).unwrap();
+    assert_eq!(count_rows(&engine).await, 3);
+
+    catchup(&engine).await.unwrap();
+    assert!(!Arc::ptr_eq(
+        &region,
+        &engine.get_region(REGION_ID).unwrap()
+    ));
+    assert_eq!(count_rows(&engine).await, 0);
+}
+
 /// Opens a region whose opener filled in the partition expression its manifest lacks and makes
 /// it writable by a catchup, after which it awaits its Leader lease. Returns the engine and the
 /// expression.
```

---

### Incident Patch 2: `517a1376` (2026-11-23)
**Commit Message**: fix(otlp): reject malformed cumulative histogram points (#10552)

* fix(otlp): reject malformed cumulative histogram points

Signed-off-by: shuiyisong <[REDACTED_EMAIL]>

* refactor(otlp): check bucket sum overflow once

Signed-off-by: shuiyisong <[REDACTED_EMAIL]>

---------

Signed-off-by: shuiyisong <[REDACTED_EMAIL]>

**File**: `src/servers/src/otlp/metrics.rs` (modified, +82/-77)
```diff
@@ -578,13 +578,11 @@ fn encode_exponential_histogram(
         .context(error::InternalSnafu {
             err_msg: "missing native histogram schema",
         })?;
-    for (index, data_point) in histogram.data_points.iter().enumerate() {
+    for data_point in &histogram.data_points {
         let (value, timestamp_nanos) = match exponential_histogram_value(data_point, temporality) {
             Ok(value) => value,
             Err(reason) => {
-                reject_data_points(outcome, 1, || {
-                    format!("metric `{name}` data point {index}: {reason}")
-                })?;
+                reject_data_points(outcome, 1, || format!("metric `{name}`: {reason}"))?;
                 OTLP_EXPONENTIAL_HISTOGRAM_REJECTED_DATA_POINTS
                     .with_label_values(&["invalid_data_point"])
                     .inc();
@@ -1175,11 +1173,9 @@ fn encode_histogram(
         Ok(AggregationTemporality::Delta)
     );
     let stale_value = f64::from_bits(PROMETHEUS_STALE_NAN_BITS);
-    for (index, data_point) in hist.data_points.iter().enumerate() {
-        if let Some(reason) = histogram_data_point_rejection(data_point, is_delta) {
-            reject_data_points(outcome, 1, || {
-                format!("metric `{name}` data point {index}: {reason}")
-            })?;
+    for data_point in &hist.data_points {
+        if let Some(reason) = histogram_data_point_rejection(data_point) {
+            reject_data_points(outcome, 1, || format!("metric `{name}`: {reason}"))?;
             continue;
         }
 
@@ -1206,22 +1202,15 @@ fn encode_histogram(
         } else {
             let mut accumulated_count = 0u64;
             let mut values = Vec::with_capacity(data_point.bucket_counts.len());
-            for (idx, count) in data_point.bucket_counts.iter().enumerate() {
-                accumulated_count = accumulated_count.checked_add(*count).ok_or_else(|| {
-                    error::InvalidParameterSnafu {
-                        reason: format!(
-                            "metric `{name}` data point {index}: bucket prefix overflows u64"
-                        ),
-                    }
-                    .build()
-                })?;
-                let bound =
-                    data_point.explicit_bounds.get(idx).copied().or_else(|| {
-                        (idx == data_point.explicit_bounds.len()).then_some(f64::INFINITY)
-                    });
-                if let Some(bound) = bound {
-                    values.push((bound, accumulated_count as f64));
-                }
+            for (bound, count) in data_point
+                .explicit_bounds
+                .iter()
+                .copied()
+                .chain(std::iter::once(f64::INFINITY))
+                .zip(&data_point.bucket_counts)
+            {
+                accumulated_count += *count;
+                values.push((bound, accumulated_count as f64));
             }
             values
         };
@@ -1331,39 +1320,36 @@ fn encode_histogram(
     Ok(())
 }
 
-pub(crate) fn histogram_data_point_rejection(
-    data_point: &HistogramDataPoint,
-    is_delta: bool,
-) -> Option<String> {
+pub(crate) fn histogram_data_point_rejection(data_point: &HistogramDataPoint) -> Option<String> {
     if has_no_recorded_value(data_point.flags) {
         return None;
     }
 
-    if is_delta {
-        let valid_empty_layout =
-            data_point.bucket_counts.is_empty() && data_point.explicit_bounds.is_empty();
-        let expected_buckets = data_point.explicit_bounds.len().checked_add(1);
-        if !valid_empty_layout && expected_buckets != Some(data_point.bucket_counts.len()) {
-            return Some(format!(
-                "bucket_counts length {} must equal explicit_bounds length {} plus one",
-                data_point.bucket_counts.len(),
-                data_point.explicit_bounds.len()
-            ));
-        }
-        if data_point
+    let valid_empty_layout =
+        data_point.bucket_counts.is_empty() && data_point.explicit_bounds.is_empty();
+    let expected_buckets = data_point.explicit_bounds.len().checked_add(1);
+    if !valid_empty_layout && expected_buckets != Some(data_point.bucket_counts.len()) {
+        return Some(format!(
+            "bucket_counts length {} must equal explicit_bounds length {} plus one",
+            data_point.bucket_counts.len(),
+            data_point.explicit_bounds.len()
+        ));
+    }
+    // OTLP requires strictly increasing explicit_bounds; GreptimeDB also requires finite
+    // bounds so an explicit +Inf cannot duplicate the le="inf" bucket appended above.
+    if data_point
+        .explicit_bounds
+        .iter()
+        .any(|bound| !bound.is_finite())
+        || data_point
             .explicit_bounds
-            .iter()
-            .any(|bound| !bound.is_finite())
-            || data_point
-                .explicit_bounds
-                .windows(2)
-                .any(|bounds| bounds[0] >= bounds[1])
```

**File**: `src/servers/src/otlp/metrics/tests/delta.rs` (modified, +187/-0)
```diff
@@ -1031,3 +1031,190 @@ fn test_shared_physical_conflicts_and_independent_backings() {
         }
     }
 }
+
+#[test]
+fn test_cumulative_and_unspecified_histogram_validation() {
+    for temporality in [
+        AggregationTemporality::Cumulative,
+        AggregationTemporality::Unspecified,
+    ] {
+        let convert = |data_points| {
+            let metric = Metric {
+                name: "latency".to_string(),
+                data: Some(metric::Data::Histogram(Histogram {
+                    data_points,
+                    aggregation_temporality: temporality as i32,
+                })),
+                ..Default::default()
+            };
+            to_grpc_insert_requests(metrics_request(vec![metric]), &mut OtlpMetricCtx::default())
+                .unwrap()
+        };
+
+        // 1. Reported layout mismatch (missing +Inf bucket).
+        // 2. Extra buckets beyond explicit_bounds.len() + 1.
+        // 3. Isolated bucket count total mismatch with valid layout length.
+        for (point, expected_err) in [
+            (
+                HistogramDataPoint {
+                    explicit_bounds: vec![0.0, 1.0],
+                    bucket_counts: vec![1, 2],
+                    count: 8,
+                    sum: Some(10.0),
+                    ..Default::default()
+                },
+                "bucket_counts length",
+            ),
+            (
+                HistogramDataPoint {
+                    explicit_bounds: vec![0.0],
+                    bucket_counts: vec![1, 2, 3],
+                    count: 6,
+                    ..Default::default()
+                },
+                "bucket_counts length",
+            ),
+            (
+                HistogramDataPoint {
+                    explicit_bounds: vec![0.0, 1.0],
+                    bucket_counts: vec![1, 2, 4],
+                    count: 8,
+                    sum: Some(10.0),
+                    ..Default::default()
+                },
+                "buckets contain 7 observations, declared count is 8",
+            ),
+        ] {
+            let conversion = convert(vec![point]);
+            assert_eq!(
+                0, conversion.outcome.accepted_data_points,
+                "{temporality:?}"
+            );
+            assert_eq!(
+                1, conversion.outcome.rejected_data_points,
+                "{temporality:?}"
+            );
+            assert!(
+                conversion
+                    .outcome
+                    .error_message
+                    .as_deref()
+                    .unwrap()
+                    .contains(expected_err),
+                "{temporality:?}: {:?}",
+                conversion.outcome.error_message
+            );
+            assert!(conversion.requests.inserts.is_empty());
+        }
+
+        // 4. Bounds checks: non-finite or non-strictly-increasing explicit_bounds.
+        for bounds in [
+            vec![0.0, f64::INFINITY],
+            vec![f64::NEG_INFINITY, 1.0],
+            vec![f64::NAN],
+            vec![1.0, 1.0],
+            vec![2.0, 1.0],
+        ] {
+            let bucket_len = bounds.len() + 1;
+            let point = HistogramDataPoint {
+                explicit_bounds: bounds,
+                bucket_counts: vec![1; bucket_len],
+                count: bucket_len as u64,
+                ..Default::default()
+            };
+            let conversion = convert(vec![point]);
+            assert_eq!(
+                0, conversion.outcome.accepted_data_points,
+                "{temporality:?}"
+            );
+            assert_eq!(
+                1, conversion.outcome.rejected_data_points,
+                "{temporality:?}"
+            );
+            assert!(
+                conversion
+                    .outcome
+                    .error_message
+                    .as_deref()
+                    .unwrap()
+                    .contains("explicit_bounds must be finite and strictly increasing"),
+                "{temporality:?}: {:?}",
+                conversion.outcome.error_message
+            );
+        }
+
+        // 5. Zero-count sum check.
+        for bad_sum in [Some(1.0), Some(f64::NAN)] {
+            let conversion = convert(vec![HistogramDataPoint {
+                count: 0,
+                sum: bad_sum,
+                ..Default::default()
+            }]);
+            assert_eq!(
+                0, conversion.outcome.accepted_data_points,
+                "{temporality:?}"
+            );
+            assert_eq!(
+                1, conversion.outcome.rejected_data_points,
+                "{temporality:?}"
+            );
+            assert!(
+                conversion
+                    .outcome
+                    .error_message
+                    .as_deref()
+                    .unwrap()
+                    .contains("sum must be absent or zero when count is zero"),
+                "{temporality:?}: {:?}",
+                conversion.outcome.er
```

**File**: `tests-integration/tests/http.rs` (modified, +210/-1)
```diff
@@ -12954,9 +12954,215 @@ pub async fn test_otlp_metrics_new(store_type: StorageType) {
     )
     .await;
 
+    test_otlp_cumulative_histogram_validation(&client).await;
+
     guard.remove_all().await;
 }
 
+async fn test_otlp_cumulative_histogram_validation(client: &TestClient) {
+    use opentelemetry_proto::tonic::common::v1::{AnyValue, KeyValue, any_value};
+    use opentelemetry_proto::tonic::metrics::v1::{
+        self as otel_metrics, AggregationTemporality, Exemplar, HistogramDataPoint, Metric,
+        ResourceMetrics, ScopeMetrics, exemplar, metric,
+    };
+
+    const TS_NANOS: u64 = 1_753_780_559_000_000_000;
+    const TS_SECS: i64 = 1_753_780_559;
+
+    let series_attr = |value: &str| KeyValue {
+        key: "series".to_string(),
+        value: Some(AnyValue {
+            value: Some(any_value::Value::StringValue(value.to_string())),
+        }),
+        ..Default::default()
+    };
+    let exemplar_point = |val: f64| Exemplar {
+        time_unix_nano: TS_NANOS,
+        value: Some(exemplar::Value::AsDouble(val)),
+        ..Default::default()
+    };
+    let cumulative_request =
+        |name: &str, data_points: Vec<HistogramDataPoint>| ExportMetricsServiceRequest {
+            resource_metrics: vec![ResourceMetrics {
+                scope_metrics: vec![ScopeMetrics {
+                    metrics: vec![Metric {
+                        name: name.to_string(),
+                        data: Some(metric::Data::Histogram(otel_metrics::Histogram {
+                            data_points,
+                            aggregation_temporality: AggregationTemporality::Cumulative as i32,
+                        })),
+                        ..Default::default()
+                    }],
+                    ..Default::default()
+                }],
+                ..Default::default()
+            }],
+        };
+    let send_otlp_metrics = |req: ExportMetricsServiceRequest| {
+        send_req(
+            client,
+            vec![(
+                HeaderName::from_static("content-type"),
+                HeaderValue::from_static("application/x-protobuf"),
+            )],
+            "/v1/otlp/v1/metrics",
+            req.encode_to_vec(),
+            false,
+        )
+    };
+
+    // All-rejected cases: reported layout mismatch and isolated count-total mismatch.
+    for (name, bad_counts, expected_err) in [
+        ("malformed_cum_len_hist", vec![1, 2], "bucket_counts length"),
+        (
+            "malformed_cum_count_hist",
+            vec![1, 2, 4],
+            "buckets contain 7 observations, declared count is 8",
+        ),
+    ] {
+        let req = cumulative_request(
+            name,
+            vec![HistogramDataPoint {
+                time_unix_nano: TS_NANOS,
+                count: 8,
+                sum: Some(10.0),
+                explicit_bounds: vec![0.0, 1.0],
+                bucket_counts: bad_counts,
+                exemplars: vec![exemplar_point(0.75)],
+                ..Default::default()
+            }],
+        );
+        let res = send_otlp_metrics(req).await;
+        assert_eq!(StatusCode::BAD_REQUEST, res.status(), "{name}");
+        let status = GoogleRpcStatus::decode(res.bytes().await.as_ref()).unwrap();
+        assert_eq!(tonic::Code::InvalidArgument as i32, status.code, "{name}");
+        assert!(
+            status.message.contains(expected_err),
+            "{name}: {}",
+            status.message
+        );
+        validate_data(
+            name,
+            client,
+            &format!(
+                "select count(*) from information_schema.tables where table_name in \
+                 ('{name}_bucket', '{name}_sum', '{name}_count', 'greptime_metrics_exemplars');"
+            ),
+            "[[0]]",
+        )
+        .await;
+    }
+
+    // Mixed valid control + malformed sibling: only the valid sibling writes rows/exemplars.
+    for (name, bad_counts, expected_err) in [
+        (
+            "mixed_cum_len_hist",
+            vec![1, 2],
+            "bucket_counts length 2 must equal explicit_bounds length 2 plus one",
+        ),
+        (
+            "mixed_cum_count_hist",
+            vec![1, 2, 4],
+            "buckets contain 7 observations, declared count is 8",
+        ),
+    ] {
+        let valid = HistogramDataPoint {
+            attributes: vec![series_attr("valid")],
+            time_unix_nano: TS_NANOS,
+            count: 4,
+            sum: Some(2.0),
+            explicit_bounds: vec![0.0, 1.0],
+            bucket_counts: vec![1, 2, 1],
+            exemplars: vec![exemplar_point(0.25)],
+            ..Default::default()
+        };
+        let malformed = HistogramDataPoint {
+            attributes: vec![series_attr("malformed")],
+            time_unix_nano: TS_NANOS,
+            count: 8,
+            sum: Some(10.0),
+            explicit_bounds: vec![0.0, 1.0],
+            bucket_counts: bad_counts,
+            exemplars: vec![exemplar_point(0.75)],
+    
```

---

### Incident Patch 3: `b948fb78` (2026-11-23)
**Commit Message**: fix(promql): plan absent_over_time over a nameless multi-metric selector (#10512)

`absent_over_time({job="x"}[20m])` was declined by the native route, and the plan it fell back to
answers with an error, so the shape produced no answer at all: the existing planner needs one
`__name__` equality matcher to read a table from (`Expect a metric matcher, but not found`).

The guard that declined it assumed that a nameless selector's tree declares `__name__` while binding
no metric name, and that the fused node refuses such a tree. That is not the shape: a discovered
selector's prepared input is the `Union` of one `RawSeriesSource` per metric, so the node is handed
explicit-label frames, and only its bare-region-scan arm reads the binding's name - an arm a nameless
selector never reaches, because a successful scan always binds one metric. A statement such as
`sum by (__name__) ({tag_0="x"})` over discovered metrics already builds and runs exactly this
combination.

The guard now declines only a nameless input that is not already sourced, which keeps the bare-scan
arm closed if that invariant ever regresses. The presence fold keeps the metric name, so two metrics
sharing ordinary labels st

**File**: `src/promql/src/extension_plan/fused_series.rs` (modified, +6/-3)
```diff
@@ -150,9 +150,12 @@ pub struct FusedSeriesBinding {
     pub grid: Arc<EvalGrid>,
     /// The metric name every input series is bound to, when the input reads one named metric.
     ///
-    /// The logical node requires it when [`tags`](Self::tags) declares [`METRIC_NAME`]: a reader of
-    /// the output has to be able to tell that a range function dropped the name, which needs a name
-    /// to drop. The physical node takes the names from the frames, which carry each series' own.
+    /// The requirement that a binding naming [`METRIC_NAME`] among [`tags`](Self::tags) also declares
+    /// this name belongs to the bare-scan arm of `plan_fused_series`, not to this node: a child that
+    /// is a region scan is asked for the series of this one metric, while a child that already
+    /// produces raw frames - a discovered selector's `RawSeriesSource`, or the union of them - names
+    /// each series in its own labels and is accepted with `None` here. A reader of the output still
+    /// sees which range functions dropped the name, which needs no binding.
     pub metric_name: Option<Arc<str>>,
     /// The output column holding the grid timestamps.
     pub time_index: String,
```

**File**: `src/promql/src/extension_plan/planner.rs` (modified, +186/-1)
```diff
@@ -327,18 +327,36 @@ fn explicit_label_frame_ordering(schema: &Schema) -> Option<SeriesOrdering> {
 
 #[cfg(test)]
 mod tests {
+    use std::fmt::{self, Formatter};
     use std::sync::Arc;
 
+    use common_error::ext::BoxedError;
     use common_query::series_frame::{
         raw_series_frame_schema_with_ordering, series_frame_ordering,
     };
+    use common_recordbatch::{EmptyRecordBatchStream, SendableRecordBatchStream};
+    use datafusion::common::DFSchema;
+    use datafusion::logical_expr::{EmptyRelation, LogicalPlan};
     use datafusion::physical_plan::ExecutionPlan;
     use datafusion::physical_plan::empty::EmptyExec;
+    use datafusion::physical_plan::metrics::ExecutionPlanMetricsSet;
     use datafusion::physical_plan::union::UnionExec;
+    use datafusion::physical_plan::{DisplayAs, DisplayFormatType};
+    use datatypes::prelude::ConcreteDataType;
+    use datatypes::schema::{ColumnSchema, SchemaRef as DatatypesSchemaRef};
     use datatypes::series::SeriesOrdering;
     use datatypes::series::samples::{FieldSpec, SeriesSchema};
+    use datatypes::series::time::{EvalGrid, GridSpec};
+    use store_api::metadata::{ColumnMetadata, RegionMetadataBuilder, RegionMetadataRef};
+    use store_api::region_engine::{
+        PrepareRequest, QueryScanContext, RegionScanner, ScannerProperties,
+    };
+    use store_api::storage::{RegionId, ScanRequest};
+    use table::table::scan::RegionScanExec;
 
-    use super::normalize_raw_union;
+    use super::{METRIC_NAME, normalize_raw_union, plan_fused_series};
+    use crate::extension_plan::{FusedSeries, FusedSeriesBinding};
+    use crate::native::plan::{BoundInput, NativeExpr, NativeNode, NativeTree, NativeType};
 
     fn raw_frame(ordering: SeriesOrdering) -> Arc<datafusion::arrow::datatypes::Schema> {
         let series = SeriesSchema {
@@ -399,4 +417,171 @@ mod tests {
             "nothing is lowered when every member is complete"
         );
     }
+
+    /// A region whose only column is the time index: the scan below publishes an ordinary region
+    /// schema, not a series frame.
+    fn region_metadata() -> RegionMetadataRef {
+        let mut builder = RegionMetadataBuilder::new(RegionId::new(1024, 1));
+        builder
+            .push_column_metadata(ColumnMetadata {
+                column_schema: ColumnSchema::new(
+                    "ts",
+                    ConcreteDataType::timestamp_millisecond_datatype(),
+                    false,
+                )
+                .with_time_index(true),
+                semantic_type: api::v1::SemanticType::Timestamp,
+                column_id: 1,
+            })
+            .primary_key(vec![]);
+        Arc::new(builder.build().expect("the fixture metadata is valid"))
+    }
+
+    /// The scanner of [`bare_region_scan`], which never answers a chunk here.
+    #[derive(Debug)]
+    struct BareScanner {
+        metadata: RegionMetadataRef,
+        properties: ScannerProperties,
+    }
+
+    impl DisplayAs for BareScanner {
+        fn fmt_as(&self, _format: DisplayFormatType, f: &mut Formatter<'_>) -> fmt::Result {
+            write!(f, "BareScanner")
+        }
+    }
+
+    impl RegionScanner for BareScanner {
+        fn name(&self) -> &str {
+            "BareScanner"
+        }
+
+        fn properties(&self) -> &ScannerProperties {
+            &self.properties
+        }
+
+        fn schema(&self) -> DatatypesSchemaRef {
+            Arc::clone(&self.metadata.schema)
+        }
+
+        fn metadata(&self) -> RegionMetadataRef {
+            Arc::clone(&self.metadata)
+        }
+
+        fn prepare(&mut self, request: PrepareRequest) -> Result<(), BoxedError> {
+            self.properties.prepare(request);
+            Ok(())
+        }
+
+        fn scan_partition(
+            &self,
+            _ctx: &QueryScanContext,
+            _metrics: &ExecutionPlanMetricsSet,
+            _partition: usize,
+        ) -> Result<SendableRecordBatchStream, BoxedError> {
+            Ok(Box::pin(EmptyRecordBatchStream::new(Arc::clone(
+                &self.metadata.schema,
+            ))))
+        }
+
+        fn set_logical_region(&mut self, logical_region: bool) {
+            self.properties.set_logical_region(logical_region);
+        }
+
+        fn set_query_load_region_id(&mut self, region_id: RegionId) {
+            self.properties.set_query_load_region_id(region_id);
+        }
+
+        fn has_predicate_without_region(&self) -> bool {
+            true
+        }
+
+        fn add_dyn_filter_to_predicate(
+            &mut self,
+            filter_exprs: Vec<Arc<dyn datafusion::physical_expr::PhysicalExpr>>,
+        ) -> Vec<bool> {
+            vec![false; filter_exprs.len()]
+        }
+    }
+
+    /// A bare region scan: the input of a node that runs inside the region it reads.
+    fn bare_region_scan() -> Arc<dyn ExecutionPlan> {
+        let scanner = BareScanner {
+            metadata: region_metadata(),
+            properties: ScannerPropertie
```

**File**: `src/promql/src/native/segment.rs` (modified, +23/-5)
```diff
@@ -730,6 +730,19 @@ fn is_raw_series_source(plan: &LogicalPlan) -> bool {
     }
 }
 
+/// Whether `plan` already answers raw series frames of its own.
+///
+/// A selector naming no metric is prepared as one [`RawSeriesSource`] per discovered metric, or as
+/// the `Union` of them when it discovered several, and each source names the metric it reads. So
+/// such a plan is a frame producer in its own right: a segment hands it to the node it builds
+/// instead of binding it again. Binding it again nests a source in a source, and the physical
+/// planner reads a source's child as the region scan that source binds - a union is no such child
+/// either - so the nested input is refused after the statement has already been committed to this
+/// route.
+fn is_sourced_plan(plan: &LogicalPlan) -> bool {
+    matches!(plan, LogicalPlan::Union(_)) || is_raw_series_source(plan)
+}
+
 fn find_input_node(node: &NativeNode, source_index: usize) -> Option<&BoundInput> {
     node.inputs()
         .into_iter()
@@ -918,11 +931,16 @@ fn build_inner_segment(
         let source_fields = tree_source_fields(&tree).ok()?;
         let mut children = Vec::with_capacity(sources.len());
         for (local_index, &source_index) in sources.iter().enumerate() {
-            let (Some((Some(metric), _, source_tags)), Some(fields), Some(scan)) = (
-                per_source.get(source_index),
-                source_fields.get(local_index),
-                scans.get(local_index),
-            ) else {
+            let scan = scans.get(local_index)?;
+            // A scan that is already a source - one metric of a discovery, or the union of several -
+            // is the frame producer this segment reads, so it stays as it is; see [`is_sourced_plan`].
+            if is_sourced_plan(scan) {
+                children.push(scan.clone());
+                continue;
+            }
+            let (Some((Some(metric), _, source_tags)), Some(fields)) =
+                (per_source.get(source_index), source_fields.get(local_index))
+            else {
                 return None;
             };
             children.push(LogicalPlan::Extension(Extension {
```

**File**: `src/query/src/promql/planner/native.rs` (modified, +30/-20)
```diff
@@ -1070,17 +1070,20 @@ impl PromPlanner {
         let Some((mut prepared, logical_ids_differ, statement_kind)) = preparation? else {
             return Ok(None);
         };
-        // `absent_over_time` reads its window through a fold that keeps the metric name, so the segment that
-        // runs it reports names across a boundary. A nameless selector that discovery expands into more
-        // than one metric binds no single name for that boundary, and the fused node refuses a tree
-        // declaring `__name__` without one. A fold that dropped the name would plan, but it would read two
-        // metrics sharing their ordinary labels as one series, so the route declines.
+        // `absent_over_time` reads its window through a fold that keeps the metric name, which the fused
+        // node hands over in a frame's labels. Only the bare-scan arm of that node needs the binding's own
+        // name: it asks a region scan for the series of one metric, and that is exactly the shape with a
+        // name to ask for. A nameless selector that discovery expands into several metric tables never
+        // reaches that arm, because its prepared input is the `Union` of one `RawSeriesSource` per
+        // discovered metric, and each source names its own metric, so the node is handed explicit-label
+        // frames instead. So the case declined here is a nameless input that is *not* sourced, which is the
+        // one shape where a tree keeping `__name__` would meet a scan that has no name to bind.
         //
-        // A selector that matched no table is not that shape: its typed empty input holds no series.
+        // A selector that matched no table is not that shape either: its typed empty input holds no series.
         if reads_presence(prom_expr)
-            && prepared
-                .iter()
-                .any(|(scan, _, metric, ..)| !is_empty_discovered_input(scan) && metric.is_none())
+            && prepared.iter().any(|(scan, _, metric, ..)| {
+                !is_empty_discovered_input(scan) && metric.is_none() && !is_sourced_plan(scan)
+            })
         {
             return Ok(None);
         }
@@ -1386,15 +1389,6 @@ impl PromPlanner {
         let children = prepared
             .into_iter()
             .map(|(scan, schema, metric, _, tags, _, split_series)| {
-                // A discovered selector already carries its own sources: a single metric is one
-                // `RawSeriesSource`, several are a `Union` of them, and each names the metric it
-                // reads. Wrapping either again would nest a source in a source.
-                let already_sourced = matches!(&scan, LogicalPlan::Union(_))
-                    || matches!(
-                        &scan,
-                        LogicalPlan::Extension(extension)
-                            if extension.node.as_any().is::<RawSeriesSource>()
-                    );
                 // The typed empty frame of a selector that matched no table is already the input: it reads
                 // no region and has no metric to bind, so it stays itself on both routes.
                 if is_empty_discovered_input(&scan) {
@@ -1404,8 +1398,9 @@ impl PromPlanner {
                 // reads every input through a raw source: the source names each region's half and
                 // reconciles the fragments of a series several regions hold. A partition that splits one
                 // series across regions has to be read through a raw source even where no split is
-                // planned, since a bare scan would hand a region only its own fragment.
-                if (!per_source_inputs && !split_series) || already_sourced {
+                // planned, since a bare scan would hand a region only its own fragment. A selector that
+                // already carries its own sources stays as it is; see [`is_sourced_plan`].
+                if (!per_source_inputs && !split_series) || is_sourced_plan(&scan) {
                     return Ok(scan);
                 }
                 let Some(metric) = metric else {
@@ -1862,6 +1857,21 @@ fn reads_presence(expr: &PromExpr) -> bool {
     presence.0
 }
 
+/// Whether a prepared selector already carries its own raw sources, and so hands the fused node
+/// explicit-label frames rather than a bare region scan.
+///
+/// A discovered selector is that shape: a single metric is one [`RawSeriesSource`], several are a
+/// `Union` of them, and each names the metric it reads. Wrapping either again would nest a source in
+/// a source.
+fn is_sourced_plan(plan: &LogicalPlan) -> bool {
+    matches!(plan, LogicalPlan::Union(_))
+        || matches!(
+            plan,
+            LogicalPlan::Extension(extension)
+                if extension.node.as_any().is::<RawSeriesSource>()
+        )
+}
+
 /// The moment `millis` milliseconds from the Unix epoch, on whichever side of it that lands.
 ///
 /// A pre-epoch statement reaches the planner as a negative millis
```

**File**: `src/query/src/promql/planner/test.rs` (modified, +66/-13)
```diff
@@ -2582,7 +2582,7 @@ async fn native_zero_match_takes_the_layout_of_its_set_operand() {
 async fn native_absent_over_time_plans_over_discovered_metrics() {
     // Only one of the two metrics carries `no_such_label`, so the matcher that wants a value of it
     // narrows the discovery to that one metric and the route plans. A selector that narrowed to
-    // both would decline: its presence read keeps the names, and one segment could not bind them.
+    // both - checked below - plans as well, since each discovered metric answers for itself.
     let specs = ["alpha_total", "beta_total"]
         .into_iter()
         .map(|name| ((DEFAULT_SCHEMA_NAME.to_string(), name.to_string()), 2, 1))
@@ -2656,9 +2656,9 @@ async fn native_absent_over_time_plans_over_discovered_metrics() {
         "a selector that matched no table still answers its matchers: {tree}"
     );
 
-    // The same selector over metrics that all carry the label narrows to several: the presence
-    // read keeps their names and one segment cannot bind them, so the route declines rather than
-    // planning a tree that cannot be built or one that would read two metrics as one series.
+    // The same selector over metrics that all carry the label narrows to several, and it plans: each
+    // discovered metric is read through its own raw source, so the presence read keeps every name
+    // and the fused node is handed the union of those sources rather than a scan to bind.
     let specs = ["alpha_total", "beta_total"]
         .into_iter()
         .map(|name| ((DEFAULT_SCHEMA_NAME.to_string(), name.to_string()), 2, 1))
@@ -2668,19 +2668,72 @@ async fn native_absent_over_time_plans_over_discovered_metrics() {
         vec!["tag_0".to_string(), "no_such_label".to_string()],
     ];
     let provider = build_test_table_provider_with_tsid_tag_names(&specs, &tags, None).await;
-    let error = PromPlanner::stmt_to_plan_with_annotations(
-        provider,
-        &build_eval_stmt(r#"absent_over_time({no_such_label="x", tag_0="api"}[5m])"#),
-        &build_query_engine_state(),
-        None,
+    let plan = build_native_fused_plan_with_provider(
+        r#"absent_over_time({no_such_label="x", tag_0="api"}[5m])"#,
         true,
+        provider,
     )
-    .await
-    .expect_err("a nameless selector over several metrics must decline");
+    .await;
+    let display = plan.display_indent().to_string();
+    assert!(display.contains("FusedSeries"), "{display}");
+    assert!(
+        !display.contains("prom_absent_over_time"),
+        "the answer must not be the existing per-series UDF: {display}"
+    );
+    let fused = find_fused_series(&plan).expect("fused plan");
+    // One input holds the whole discovery: the two metrics are the union's sources, not two inputs.
+    assert_eq!(1, fused.inputs().len(), "{plan:?}");
+    // Each discovered metric is read through its own source, and that source names the metric it
+    // reads: this is why the binding below needs no name of its own.
+    fn source_metrics(plan: &LogicalPlan, out: &mut Vec<String>) {
+        if let LogicalPlan::Extension(extension) = plan
+            && let Some(source) = extension.node.as_any().downcast_ref::<RawSeriesSource>()
+        {
+            out.push(source.metric_name().to_string());
+        }
+        for input in plan.inputs() {
+            source_metrics(input, out);
+        }
+    }
+    let mut sources = Vec::new();
+    for input in fused.inputs() {
+        source_metrics(input, &mut sources);
+    }
+    sources.sort();
+    assert_eq!(vec!["alpha_total", "beta_total"], sources, "{plan:?}");
+    // The tree reads presence through a fold that keeps the name, which is what tells two metrics
+    // apart at runtime; a fold that dropped it would read them as one series.
+    let trees = fused_trees(&plan).join("\n");
+    assert!(
+        trees.contains(r#"Vector: absent {no_such_label="x", tag_0="api"}"#),
+        "the labels are the selector's matchers: {trees}"
+    );
+    assert!(
+        trees.contains("Window: last_over_time [300000ms]"),
+        "the presence read folds the window: {trees}"
+    );
     assert!(
-        error.to_string().contains("metric matcher"),
-        "the decline keeps the existing plan's answer: {error}"
+        !trees.contains("present_over_time"),
+        "the fold keeps the name rather than dropping it: {trees}"
+    );
+    // The layout still declares the per-row name column, and an `absent` answer names no row: the
+    // column is the nullable one every row leaves empty.
+    let names = plan.schema().fields();
+    let last = names.last().expect("the plan publishes a name column");
+    assert_eq!(METRIC_NAME, last.name().as_str(), "{names:?}");
+    assert_eq!(&ArrowDataType::Utf8, last.data_type(), "{names:?}");
+    assert!(last.is_nullable(), "{names:?}");
+    assert_eq!(
+        1,
+        names
+            .iter()
+            .filter(|field| field.name() == METRIC_NAME)
+            
```

**File**: `tests-integration/src/tests/promql_test.rs` (modified, +122/-23)
```diff
@@ -6635,10 +6635,11 @@ async fn promql_output(
 /// `absent_over_time` answers with the labels its selector's matchers fix at every point no series
 /// of the selector has a sample at, and with nothing at the points one does. Three metric tables
 /// make the shapes reachable: `absent_probe` carries `probe_label`, which no row's value matches, so
-/// a nameless selector narrows to it; `absent_a` and `absent_b` carry the same ordinary labels, so a
-/// nameless selector over them is one discovery expands into several metrics; and no table carries
-/// `no_such_label`, which is the reported query - the one whose selector matches no metric table and
-/// whose labels therefore have to come from the matchers alone.
+/// a nameless selector narrows to it; `absent_a` and `absent_b` carry the same ordinary labels, so
+/// a nameless selector covers both and is one discovery expanding into several metrics, each
+/// answering through its own raw source; and no table carries `no_such_label`, which is the reported
+/// query - the one whose selector matches no metric table and whose labels therefore have to come
+/// from the matchers alone.
 ///
 /// The existing plan answers the call per series with a UDF, which needs a metric name to read a
 /// table from: such a selector writes none, and the labels still have to reach the answer at every
@@ -6748,33 +6749,131 @@ async fn native_promql_absent_over_time_answers_like_prometheus() {
         );
     }
 
-    // A nameless selector that discovery expands into more than one metric declines. The presence
-    // read keeps the metric name, and no single name is bound for the segment that hands it over; a
-    // fold that dropped the name would plan, and would read two metrics sharing their ordinary
-    // labels as one series. Neither tree is planned, so the query keeps the existing plan's answer
-    // for a selector that names no metric - an error - rather than answering wrongly.
+    // A nameless selector that discovery expands into more than one metric answers. `absent_a`,
+    // `absent_b` and `absent_probe` all carry `job`, and the first two carry the same ordinary
+    // labels, so `{job="api"}` is one discovery expanding into several metrics whose series would
+    // collapse into one if the presence read dropped the metric name. It does not, so the node
+    // reads a frame per metric - its child is the union of their raw sources - rather than one scan
+    // bound to one name.
+    //
+    // Both metrics holding samples in the window answer nothing: neither may be read as the other.
     observer.clear();
-    let declined = servers::prometheus_handler::PrometheusHandler::do_query(
-        instance.as_ref(),
-        &PromQuery {
-            query: r#"absent_over_time({job="api"}[5m])"#.to_string(),
-            start: "120".to_string(),
-            end: "120".to_string(),
-            step: "1s".to_string(),
-            ..PromQuery::default()
-        },
-        native_query_context(true, 4),
+    let (columns, rows) = native_labelled_rows(
+        promql_output(
+            &instance,
+            r#"absent_over_time({job="api"}[5m])"#,
+            "120",
+            "120",
+            "1s",
+        )
+        .await,
     )
     .await;
     assert!(
-        declined.is_err(),
-        "a nameless selector over several metrics must not be answered natively yet"
+        observed_physical_nodes(&observer)
+            .iter()
+            .any(|node| node.name() == "FusedSeriesExec"),
+        "a nameless selector over several metrics must run a fused node: {columns:?}"
+    );
+    assert!(
+        rows.is_empty(),
+        "two metrics with equal labels holding samples in the window: {columns:?} {rows:?}"
+    );
+
+    // The same selector where the window holds no sample of any of them answers once, with the
+    // selector's equality labels alone: the name the presence read kept is not a label of the
+    // answer, and neither is `probe_label`, which no matcher fixes.
+    let (columns, rows) = native_labelled_rows(
+        promql_output(
+            &instance,
+            r#"absent_over_time({job="api"}[5m])"#,
+            "400",
+            "400",
+            "1s",
+        )
+        .await,
+    )
+    .await;
+    assert_eq!(
+        vec![(400000, labels(&[("job", "api")]), 1.0)],
+        rows,
+        "{columns:?}"
+    );
+
+    // A range answers every step whose window holds nothing.
+    let (columns, rows) = native_labelled_rows(
+        promql_output(
+            &instance,
+            r#"absent_over_time({job="api"}[5m])"#,
+            "400",
+            "470",
+            "70s",
+        )
+        .await,
+    )
+    .await;
+    assert_eq!(
+        vec![
+            (400000, labels(&[("job", "api")]), 1.0),
+            (470000, labels(&[("job", "api")]), 1.0),
+        ],
+        rows,
+        "{columns:?}"
     );
+
+    // A statement that compares a discovery over several metrics with o
```

#### Recent Merged Pull Requests:
- **PR #10564** (2026-11-23): perf(mito2): prune files by their primary key range before reading footers (@killme2008)
- **PR #10561** (2026-11-23): perf(mito2): split seq scan ranges of files with disjoint primary keys (@killme2008)
- **PR #10559** (2026-11-23): fix: catch up a writable region that still awaits its Leader lease (@fengjiachun)
- **PR #10558** (closed): feat(frontend): add background-refreshed PromQL range cache (@discord9)
- **PR #10556** (2026-11-23): fix(sql): keep column options in ALTER TABLE ADD COLUMN (@killme2008)
- **PR #10552** (2026-11-23): fix(otlp): reject malformed cumulative histogram points (@shuiyisong)

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

## X. catch up a writable region that still awaits its Leader lease

**RULE**:
When implementing operations in `src/datanode/src/heartbeat/handler/upgrade_region.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in GreptimeTeam/greptimedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `946e599d`: catch up a writable region that still awaits its Leader lease. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/datanode/src/heartbeat/handler/upgrade_region.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
            let Some(confirmed) = ctx
                .region_server
                .is_confirmed_leader(upgrade_region.region_id)
            // Ignores the catchup requests for writable regions, except those a catchup made
            // writable with no Leader lease since: they may lack what the leader has written
            // since, and the engine catches them up again.
            if confirmed {
    use store_api::region_request::RegionRequest;
    #[tokio::test]
    async fn test_writable_region_awaiting_leader_lease_catches_up() {
        let mock_region_server = mock_region_server();
        let region_id = RegionId::new(1024, 1);

        let (mock_engine, mut requests) =
            MockRegionEngine::with_custom_apply_fn(MITO_ENGINE_NAME, |region_engine| {
                region_engine.mock_role = Some(Some(RegionRole::Leader));
                region_engine.mock_confirmed_leader = Some(false);
            });
        mock_region_server.register_test_region(region_id, mock_engine);
        let kv_backend = Arc::new(MemoryKvBackend::new());
        let handler_context = HandlerContext::new_for_test(mock_region_server, kv_backend);
        let reply = UpgradeRegionsHandl
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
            let Some(writable) = ctx.region_server.is_region_leader(upgrade_region.region_id)
            // Ignores the catchup requests for writable regions.
            if writable {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `946e599d` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
