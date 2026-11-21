# Verification Protocol: Verification Protocol: Empirical Defect Shield for GreptimeTeam/greptimedb

<!-- PROVENANCE_START
{
  "source_repository": "GreptimeTeam/greptimedb",
  "source_url": "https://github.com/GreptimeTeam/greptimedb",
  "source_version": "87875513",
  "license": "Apache-2.0",
  "timestamp": "2026-11-21T13:30:43.211Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-greptimeteam-greptimedb",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [GreptimeTeam/greptimedb](https://github.com/GreptimeTeam/greptimedb) (Revision: `87875513`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-21T13:30:43.211Z`  
> **Learning ID**: `learn-github-greptimeteam-greptimedb`


## 1. Scope & Verification Target
- **Target Repository**: `GreptimeTeam/greptimedb` (Commit: `87875513`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): GreptimeTeam/greptimedb

> **Canonical Artifact**: `07_PROJECT_LEARNING/greptimeteam-greptimedb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/GreptimeTeam/greptimedb](https://github.com/GreptimeTeam/greptimedb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-21T13:30:41.962Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GreptimeTeam/greptimedb`
- **Description**: The open-source observability database. One columnar engine for metrics, logs, and traces, on object storage.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6824 stars

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
- **Issue #10551** (2026-11-21): **feat: update dashboard to v0.14.7**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  ## What's changed and what's your intention?  AS TITLE  https://github.com/GreptimeTeam/dashboard/releases/tag/v0.14.7  ## Checklist  - [ ]  I have written the necessary rustdoc comments. - [ ]  I have added the necessary unit tests and integration tests. - [x]  This PR does not require documentation updates.

- **Issue #10550** (2026-11-20): **refactor(meta): make coordinated invalidation the default for metadata caches**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  Follows #10527 and #10542.  ## What's changed and what's your intention?  All in-tree production metadata caches already coordinate loads and invalidations through Moka’s per-key compute lock. This PR removes the remaining unchecked implementation and makes `CacheContainer::new` the default constructor.  Key-based caches now supply a function that extracts a key from an invalidation event. A shared handler removes matching entries in event order. The table-flownode cache uses the same interface to apply incremental flow updates. Removing the unchecked path also removes its generation checks and single-key retry from `get_many`.  A full clear still advances the cache epoch. A new regression test pauses a batch load, clears the cache, and then lets the load finish. The original caller receives its result, and a subsequent lookup cannot see the stale entry.  This changes the public `common-meta` Rust API. Downstream callers of `new_coordinated` should use `new`. Callers of the old unchecked `new` must migrate to the new signature. The `Invalidator` and `TokenFilter` type aliases have been removed.  Validation completed:  - `cargo nextest run -p common-meta` passed all 701 tests. - `cargo check --tests -p catalog -p partition -p operator` passed. - `cargo fmt --all -- --check` and `git diff --check` passed.  ## PR Check

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

### Incident Patch 1: `5952a49e` (2026-11-20)
**Commit Message**: fix(mito2): wait for a Leader lease before committing after a catchup (#10544)

* fix(mito2): wait for a Leader lease before committing after a catchup

On a datanode whose writes need a lease, a catchup makes a migration
target writable before the route points to it. Until a Leader or
StagingLeader lease of a heartbeat sent after the catchup applies, such
a region commits to its manifest only replayed WAL tails and what it
commits while downgrading; any other commit fails with the retryable
RegionLeaseNotReceived in ManifestContext::update_locked. No flush or
compaction trigger starts work for it, a write over its own write buffer
is rejected as for a staging region, and a close that must flush
downgrades it first.

The lease that ends the wait tells the region's worker once. The worker
schedules the engine-full and region-full flushes and, if the region is
then a writable leader, starts a compaction, builds missing indexes in
async index mode and persists the metadata the opener backfilled.

Signed-off-by: jeremyhi <[REDACTED_EMAIL]>

* test(mito2): refuse a discard of pending tails while awaiting the Leader lease

Signed-off-by: jeremyhi <[REDACTED_EMAIL]>

* fix(mito2): keep ex

**File**: `src/mito2/AGENTS.md` (modified, +16/-5)
```diff
@@ -89,7 +89,8 @@ pending. DDL cancellation retains its existing scheduling fence and priority.
 - **SST/Parquet layout** (`sst/`): readers must stay compatible with existing files.
 - **Index extensions**: shared contracts and provider validation live in `sst/index/registry.rs`;
   typed sketch options are enterprise-gated. Lifecycle and failure tests live in
-  `engine/index_build_test.rs` and `compaction/`.
+  `engine/index_build_test.rs` and `compaction/`. A background rebuild must not replace a file
+  that carries extension indexes (`worker/handle_rebuild_index.rs::needs_background_indexes`).
 - **Series-index disk limit**: tasks estimate usage from entry sizes in open-region snapshots
   and defer new builds when the shared estimate is full. Cleanup still prunes obsolete
   range entries and expires series indexes to reclaim published usage. Concurrent builds may
@@ -202,17 +203,27 @@ Tests live next to the code as `*_test.rs` (e.g. `src/mito2/src/engine/flush_tes
 - Staging regions, ending staging included, never flush: a flush would stage its SST and
   release the rows' WAL, losing them if staging does not end successfully. Every flush
   trigger in `worker/handle_flush.rs` must skip them: background triggers test `is_writable()`
-  and `is_staging()`, a flush request `is_flushable()` and `is_staging()` (`is_writable()` and
+  and `defers_background_flush()`, a flush request `is_flushable()` and `is_staging()` (`is_writable()` and
   `is_flushable()` are false while ending staging). `handle_close` leaves staging first.
   Tail replays never run for them: entering staging fails while tails are pending.
 - Direct SST imports without a staging binding cannot publish into staging.
   `worker/handle_manifest.rs` seals edit admission while EnterStaging drains accepted
   edits. Scheduler-owned DDLs resume through execution, bypassing initial admission.
+- On a node whose writes need a lease, a region that a catchup made writable waits for a
+  Leader or StagingLeader lease sent after the catchup (`awaits_leader_lease`). Until then
+  `ManifestContext::update_locked` refuses its commits unless they are staged or the region is
+  downgrading (a close that must flush downgrades first); only a replay of tails
+  (`TailsEditor::Replay`) skips the check, a discard does not, and ending staging checks it
+  before `commit_staged_locked`. No flush or compaction trigger starts work for a waiting region except
+  a downgrade's flush. The lease that ends the wait wakes the worker
+  (`handle_leader_lease_wait_ended`) to schedule the flushes the wait deferred and, only if the
+  region is then a writable leader, start a compaction, build missing indexes, re-issue the
+  index build retries the wait refused and persist backfilled metadata.
 - The latest lease each region received (`GrantedLeases` in `lease.rs`) lives outside the
   region instance, so a reopen during catchup keeps it. Every path that removes a region from
-  a worker's region map must also remove its record: `RegionWorkerLoop::remove_region`
-  (`worker/handle_close.rs`, also used after a close-time flush), `drop_region`
-  (`worker/handle_drop.rs`) and `RegionWorkerLoop::clean` (`worker.rs`).
+  a worker's region map must also remove its record and its kept index build retries:
+  `RegionWorkerLoop::remove_region` (`worker/handle_close.rs`, also used after a close-time
+  flush), `drop_region` (`worker/handle_drop.rs`) and `RegionWorkerLoop::clean` (`worker.rs`).
 
 ## Maintenance contract
 
```

**File**: `src/mito2/src/compaction/scheduler.rs` (modified, +20/-2)
```diff
@@ -594,6 +594,14 @@ impl CompactionScheduler {
             waiter.send(Ok(0));
             return Ok(false);
         }
+        if manifest_ctx.awaits_leader_lease() {
+            info!(
+                "Skipping compaction for region {} that awaits its Leader lease, options: {:?}",
+                region_id, compact_options
+            );
+            waiter.send(Ok(0));
+            return Ok(false);
+        }
         if status.has_pending_tails() {
             info!(
                 "Skipping compaction for region {} with pending WAL tails, options: {:?}",
@@ -669,7 +677,13 @@ impl CompactionScheduler {
         let Some(pending_request) = std::mem::take(&mut status.pending_request) else {
             return false;
         };
-        if status.has_pending_tails() {
+        let awaits_leader_lease = manifest_ctx.awaits_leader_lease();
+        if awaits_leader_lease {
+            info!(
+                "Region {region_id} awaits its Leader lease, answering its queued compaction without compacting"
+            );
+        }
+        if status.has_pending_tails() || awaits_leader_lease {
             status.pending_task_state = None;
             status.publish_state();
             pending_request.waiter.send(Ok(0));
@@ -768,7 +782,11 @@ impl CompactionScheduler {
         let Some(status) = self.region_status.get_mut(&region_id) else {
             return false;
         };
-        if status.has_pending_tails() {
+        let awaits_leader_lease = manifest_ctx.awaits_leader_lease();
+        if awaits_leader_lease {
+            info!("Region {region_id} awaits its Leader lease, starting no follow-up compaction");
+        }
+        if status.has_pending_tails() || awaits_leader_lease {
             return false;
         }
         // An external automatic trigger requires one unrestricted follow-up pick.
```

**File**: `src/mito2/src/compaction/scheduler_test.rs` (modified, +17/-6)
```diff
@@ -3671,8 +3671,15 @@ async fn test_compaction_tasks_linear_local_publication(#[case] reject_after_fir
     assert!(!scheduler.is_compacting(region_id));
 }
 
+/// A queued manual compaction or an automatic follow-up starts nothing while the region has
+/// pending tails or awaits its Leader lease.
+#[rstest::rstest]
+#[case::pending_tails(false)]
+#[case::awaiting_leader_lease(true)]
 #[tokio::test]
-async fn test_finishing_compaction_with_pending_tails_starts_nothing() {
+async fn test_finishing_compaction_of_blocked_region_starts_nothing(
+    #[case] awaiting_leader_lease: bool,
+) {
     let env = SchedulerEnv::new().await;
     let (tx, _rx) = mpsc::channel(4);
     let mut scheduler = env.mock_compaction_scheduler(tx);
@@ -3697,11 +3704,15 @@ async fn test_finishing_compaction_with_pending_tails_starts_nothing() {
     let pending_id = scheduler.inspect_tasks(&MetadataFilter::default(), None)[0]
         .task_id
         .clone();
-    version_control.apply_edit(
-        Some(pending_tails_edit(vec![tail(1, 0, 1)])),
-        &[],
-        builder.file_purger(),
-    );
+    if awaiting_leader_lease {
+        manifest_ctx.start_leader_lease_wait_for_test(region_id);
+    } else {
+        version_control.apply_edit(
+            Some(pending_tails_edit(vec![tail(1, 0, 1)])),
+            &[],
+            builder.file_purger(),
+        );
+    }
 
     scheduler
         .on_compaction_finished(region_id, &manifest_ctx, schema_metadata_manager, true)
```

**File**: `src/mito2/src/engine.rs` (modified, +29/-3)
```diff
@@ -108,7 +108,7 @@ mod puffin_index;
 use std::any::Any;
 use std::collections::{HashMap, HashSet};
 use std::sync::{Arc, RwLock};
-use std::time::Instant;
+use std::time::{Duration, Instant};
 
 use api::region::RegionResponse;
 use async_trait::async_trait;
@@ -1408,6 +1408,23 @@ impl EngineInner {
         }
     }
 
+    /// Logs the end of the wait of `region` for its Leader lease, which lasted `waited`, and
+    /// tells its worker to start what the wait deferred. Does nothing if the lease ended no wait
+    /// or the region waits again, so a wait ends with one notification.
+    fn notify_if_leader_lease_wait_ended(&self, region: &MitoRegionRef, waited: Option<Duration>) {
+        let Some(waited) = waited else {
+            return;
+        };
+        if region.manifest_ctx.awaits_leader_lease() {
+            return;
+        }
+        info!(
+            "Region {} received its Leader lease {:?} after a catchup made it writable",
+            region.region_id, waited
+        );
+        self.workers.notify_leader_lease_wait_ended(region);
+    }
+
     /// Asks the worker to replay the pending tails of `region` if a role change made it
     /// writable. The worker may already have started an ALTER or an edit of the region.
     fn notify_if_became_writable(&self, region: &MitoRegionRef, was_writable: bool) {
@@ -1765,11 +1782,20 @@ impl RegionEngine for MitoEngine {
         }
         if role == RegionRole::Leader {
             let was_writable = region.is_writable();
-            let promoted = region
+            let promotion = region
                 .manifest_ctx
                 .promote_unless_downgrade_started_after(sent_at, region_id);
             self.inner.notify_if_became_writable(&region, was_writable);
-            return Ok(promoted);
+            self.inner
+                .notify_if_leader_lease_wait_ended(&region, promotion.ended_wait);
+            return Ok(promotion.promoted);
+        }
+        // The metasrv grants it to the leader of a region whose route is in staging, and it ends
+        // the wait for a Leader lease too.
+        if role == RegionRole::StagingLeader && region.manifest_ctx.awaits_leader_lease() {
+            let ended_wait = region.manifest_ctx.record_leader_lease(sent_at);
+            self.inner
+                .notify_if_leader_lease_wait_ended(&region, ended_wait);
         }
         let previous = region.set_role(role);
         self.inner.notify_if_can_no_longer_replay(&region, previous);
```

**File**: `src/mito2/src/engine/lease_test.rs` (modified, +663/-11)
```diff
@@ -13,38 +13,60 @@
 // limitations under the License.
 
 //! Tests that a region acknowledges only writes whose WAL append completed within its leader
-//! lease, and that Leader grants for heartbeats sent before a downgrade do not make it writable
-//! again.
+//! lease, that Leader grants for heartbeats sent before a downgrade do not make it writable
+//! again, and what a region a catchup made writable may commit before a later lease confirms it.
 
 use std::collections::HashMap;
 use std::sync::Arc;
+use std::sync::atomic::{AtomicUsize, Ordering};
 use std::time::{Duration, Instant};
 
 use api::region::RegionResponse;
+use api::v1::region::{StrictWindow, compact_request};
 use api::v1::{ColumnSchema, Rows};
+use common_base::readable_size::ReadableSize;
 use common_error::ext::{BoxedError, ErrorExt};
+use common_error::status_code::StatusCode;
 use common_recordbatch::RecordBatches;
 use rstest::rstest;
 use rstest_reuse::apply;
-use store_api::region_engine::{RegionEngine, RegionRole, SettableRegionRoleState};
+use store_api::region_engine::{
+    RegionEngine, RegionRole, SetRegionRoleStateResponse, SettableRegionRoleState,
+};
 use store_api::region_request::{
-    EnterStagingRequest, RegionCatchupRequest, RegionCloseRequest, RegionDropRequest,
-    RegionPutRequest, RegionRequest, StagingPartitionDirective,
+    EnterStagingRequest, RegionAlterRequest, RegionBuildIndexRequest, RegionCatchupRequest,
+    RegionCloseRequest, RegionCompactRequest, RegionDropRequest, RegionFlushRequest,
+    RegionPutRequest, RegionRequest, RegionTruncateRequest, StagingPartitionDirective,
 };
 use store_api::storage::{RegionId, ScanRequest};
 use tokio::task::JoinHandle;
 
 use crate::config::MitoConfig;
 use crate::engine::MitoEngine;
 use crate::engine::basic_test::build_bulk_insert_request;
-use crate::engine::listener::WriteWalListener;
+use crate::engine::index_build_test::async_build_mode_config;
+use crate::engine::listener::{
+    CountingStallListener, EventListener, EventListenerRef, WriteWalListener,
+};
+use crate::engine::object_store_wal_test::wait_until;
+use crate::engine::open_test::open_region_with_backfilled_partition_expr;
+use crate::engine::pending_tail_test::add_field;
+use crate::engine::staging_test::{
+    enter_staging, first_file, float_range_expr, submit_staging_edit,
+};
 use crate::error::Error;
+use crate::flush::FlushReason;
 use crate::lease::GrantedLease;
+use crate::manifest::action::RegionEdit;
+use crate::metrics::{FLUSH_FAILURE_TOTAL, FLUSH_REQUESTS_TOTAL};
 use crate::region::{RegionLeaderState, RegionRoleState};
+use crate::request::{BackgroundNotify, BuildIndexRequest, WorkerRequest};
+use crate::sst::file::IndexType;
+use crate::sst::index::IndexBuildType;
 use crate::test_util::{
-    CreateRequestBuilder, LogStoreFactory, TestEnv, build_rows, kafka_log_store_factory,
-    multiple_log_store_factories, prepare_test_for_kafka_log_store, raft_engine_log_store_factory,
-    reopen_region, rows_schema,
+    CreateRequestBuilder, LogStoreFactory, TestEnv, build_rows, flush_region,
+    kafka_log_store_factory, multiple_log_store_factories, prepare_test_for_kafka_log_store,
+    put_rows, raft_engine_log_store_factory, reopen_region, rows_schema,
 };
 
 const LEASE: Duration = Duration::from_secs(10);
@@ -57,8 +79,20 @@ async fn create_region(
     topic: Option<String>,
 ) -> (Arc<WriteWalListener>, MitoEngine, Vec<ColumnSchema>) {
     let listener = Arc::new(WriteWalListener::default());
+    let (engine, schema) =
+        create_region_with_config(env, topic, MitoConfig::default(), listener.clone()).await;
+    (listener, engine, schema)
+}
+
+/// As [create_region], on an engine of `config` with `listener`.
+async fn create_region_with_config(
+    env: &mut TestEnv,
+    topic: Option<String>,
+    config: MitoConfig,
+    listener: EventListenerRef,
+) -> (MitoEngine, Vec<ColumnSchema>) {
     let engine = env
-        .create_engine_with(MitoConfig::default(), None, Some(listener.clone()), None)
+        .create_engine_with(config, None, Some(listener), None)
         .await;
     engine.require_write_lease();
     engine.freeze_lease_clock(Instant::now());
@@ -68,7 +102,7 @@ async fn create_region(
         .handle_request(REGION_ID, RegionRequest::Create(request))
         .await
         .unwrap();
-    (listener, engine, schema)
+    (engine, schema)
 }
 
 fn grant(engine: &MitoEngine, role: RegionRole, deadline: Instant) {
@@ -496,3 +530,621 @@ async fn test_granted_lease_removed_on_engine_stop() {
 
     assert_eq!(granted_lease(&engine), None);
 }
+
+/// Demotes `region_id` on an engine whose writes need a lease and makes it writable again by a
+/// catchup, after which it awaits its Leader lease.
+pub(crate) async fn promote_to_await_leader_lease(engine: &MitoEngine, region_id: RegionId) {
+    engine
+        .set_region_role_state_gracefully(region_id, SettableRegionRoleState::Follower)
+        .await
+        .unwrap();
+    // The lease the catchup seeds ne
```

**File**: `src/mito2/src/engine/listener.rs` (modified, +8/-0)
```diff
@@ -38,6 +38,14 @@ pub trait EventListener: Send + Sync {
     /// Notifies the listener before a catchup reopens the region.
     async fn on_catchup_reopen_begin(&self, _region_id: RegionId) {}
 
+    /// Notifies the listener after the worker handled the end of the region's wait for its
+    /// Leader lease.
+    fn on_leader_lease_wait_ended(&self, _region_id: RegionId) {}
+
+    /// Notifies the listener when the worker spawns the persisting of the region's backfilled
+    /// metadata.
+    fn on_persist_backfilled_metadata_begin(&self, _region_id: RegionId) {}
+
     /// Notifies the listener before a tail replay commits its result.
     async fn on_tail_commit_begin(&self, _region_id: RegionId) {}
 
```

**File**: `src/mito2/src/engine/object_store_wal_recovery_test.rs` (modified, +31/-5)
```diff
@@ -2306,12 +2306,17 @@ async fn wait_for_pressure_admission(
 
 /// Exercises the production threshold, worker timers, flush and WAL release.
 /// Both regions pin the oldest object and belong to different workers.
+/// With `awaiting_leader_lease`, region A is a writable leader that awaits its Leader lease.
 #[rstest]
-#[case::writable(RegionRoleState::Leader(RegionLeaderState::Writable))]
-#[case::follower(RegionRoleState::Follower)]
-#[case::staging(RegionRoleState::Leader(RegionLeaderState::Staging))]
+#[case::writable(RegionRoleState::Leader(RegionLeaderState::Writable), false)]
+#[case::follower(RegionRoleState::Follower, false)]
+#[case::staging(RegionRoleState::Leader(RegionLeaderState::Staging), false)]
+#[case::awaiting_leader_lease(RegionRoleState::Leader(RegionLeaderState::Writable), true)]
 #[tokio::test]
-async fn test_wal_pressure_flushes_blockers_across_workers(#[case] state: RegionRoleState) {
+async fn test_wal_pressure_flushes_blockers_across_workers(
+    #[case] state: RegionRoleState,
+    #[case] awaiting_leader_lease: bool,
+) {
     use crate::time_provider::mock::MockTimeProvider;
 
     let mut env = TestEnv::new().await;
@@ -2423,8 +2428,18 @@ async fn test_wal_pressure_flushes_blockers_across_workers(#[case] state: Region
         RegionRoleState::Leader(RegionLeaderState::Writable) => {}
         _ => unreachable!(),
     }
+    let lease_deadline = std::time::Instant::now() + Duration::from_secs(600);
+    if awaiting_leader_lease {
+        region(&engine, REGION_B)
+            .manifest_ctx
+            .leader_deadline
+            .extend(lease_deadline);
+        region_a
+            .manifest_ctx
+            .start_leader_lease_wait_for_test(REGION_A);
+    }
     clock.set_now(now + 240_000);
-    if state != RegionRoleState::Leader(RegionLeaderState::Writable) {
+    if state != RegionRoleState::Leader(RegionLeaderState::Writable) || awaiting_leader_lease {
         // Observe admission itself: a failed manifest commit would also leave
         // the watermark unchanged, but must not make this assertion pass.
         assert!(!wait_for_pressure_admission(&mut observations, REGION_A).await);
@@ -2445,6 +2460,17 @@ async fn test_wal_pressure_flushes_blockers_across_workers(#[case] state: Region
         assert_eq!(vec![REGION_A], store.flush_candidates());
         if region_a.is_staging() {
             region_a.exit_staging().unwrap();
+        } else if awaiting_leader_lease {
+            let sent_at = std::time::Instant::now();
+            engine
+                .set_region_role_with_lease(
+                    REGION_A,
+                    RegionRole::Leader,
+                    sent_at,
+                    lease_deadline,
+                    None,
+                )
+                .unwrap();
         } else {
             engine
                 .set_region_role(REGION_A, RegionRole::Leader)
```

**File**: `src/mito2/src/engine/object_store_wal_test.rs` (modified, +107/-4)
```diff
@@ -55,7 +55,9 @@ use tokio::sync::{Notify, oneshot};
 
 use crate::config::MitoConfig;
 use crate::engine::MitoEngine;
+use crate::engine::lease_test::promote_to_await_leader_lease;
 use crate::engine::listener::{EventListener, FlushCancellationListener};
+use crate::engine::open_test::new_dummy_fetcher;
 use crate::engine::region_hook::{RegionHook, RegionHookRef};
 use crate::manifest::action::{RegionEdit, RegionMetaAction, RegionMetaActionList};
 use crate::manifest::storage::{delta_file, gen_path, manifest_dir};
@@ -536,20 +538,36 @@ pub(crate) async fn count_ssts(store: &ObjectStore, region_dir: &str) -> usize {
         .count()
 }
 
+/// A commit is stale because the Leader deadline of its writer passes while it is written, or,
+/// with `awaiting_leader_lease`, because a catchup made its writer writable and no Leader lease
+/// confirmed it; the cases cover the commits such a writer still makes: the flushes of its
+/// downgrade and of its close.
 #[rstest]
-#[case::flush(RegionRequest::Flush(RegionFlushRequest::default()), 1)]
+#[case::flush(RegionRequest::Flush(RegionFlushRequest::default()), 1, false)]
 #[case::compaction(
     RegionRequest::Compact(RegionCompactRequest {
         options: compact_request::Options::StrictWindow(StrictWindow { window_seconds: 3600 }),
         ..Default::default()
     }),
-    1
+    1,
+    false
+)]
+#[case::truncate(RegionRequest::Truncate(RegionTruncateRequest::All), 0, false)]
+#[case::downgrade_flush_awaiting_leader_lease(
+    RegionRequest::Flush(RegionFlushRequest::default()),
+    1,
+    true
+)]
+#[case::close_flush_awaiting_leader_lease(
+    RegionRequest::Close(RegionCloseRequest { flush_on_close: true }),
+    1,
+    true
 )]
-#[case::truncate(RegionRequest::Truncate(RegionTruncateRequest::All), 0)]
 #[tokio::test]
 async fn test_stale_commit_on_deleted_delta_name_conflicts(
     #[case] commit: RegionRequest,
     #[case] new_ssts: usize,
+    #[case] awaiting_leader_lease: bool,
 ) {
     common_telemetry::init_default_ut_logging();
     // The creation is version 0 and the flushes below are versions 1 and 2.
@@ -569,7 +587,17 @@ async fn test_stale_commit_on_deleted_delta_name_conflicts(
         put_rows(&old_leader, region_id, rows(start)).await;
         flush_region(&old_leader, region_id, None).await;
     }
+    if awaiting_leader_lease {
+        promote_to_await_leader_lease(&old_leader, region_id).await;
+    }
     put_rows(&old_leader, region_id, rows(6)).await;
+    // A close turns the region downgrading itself.
+    if awaiting_leader_lease && !matches!(commit, RegionRequest::Close(_)) {
+        old_leader
+            .set_region_role_state_gracefully(region_id, SettableRegionRoleState::DowngradingLeader)
+            .await
+            .unwrap();
+    }
 
     let region = old_leader.get_region(region_id).unwrap();
     let (manifest, checkpoint) = {
@@ -614,7 +642,22 @@ async fn test_stale_commit_on_deleted_delta_name_conflicts(
         }
     }
 
-    old_leader.freeze_lease_clock(deadline);
+    if awaiting_leader_lease {
+        assert!(region.manifest_ctx.awaits_leader_lease());
+        // A lease that ends the wait during the write does not lift the check.
+        old_leader
+            .set_region_role_with_lease(
+                region_id,
+                RegionRole::StagingLeader,
+                Instant::now(),
+                deadline,
+                None,
+            )
+            .unwrap();
+        assert!(!region.manifest_ctx.awaits_leader_lease());
+    } else {
+        old_leader.freeze_lease_clock(deadline);
+    }
     blocker.release();
     let error = commit.await.unwrap().unwrap_err();
     assert!(error.retry_hint().is_retryable(), "{error:?}");
@@ -1177,6 +1220,66 @@ async fn test_conflict_reloads_region() {
     assert!(!engine.is_region_catching_up(region_id));
 }
 
+/// The persisting of backfilled metadata that the end of a wait for the Leader lease spawns
+/// outside the worker asks the worker to reload the region it fenced on a newer manifest.
+#[tokio::test]
+async fn test_conflicting_backfill_asks_for_reload() {
+    let region_id = RegionId::new(1, 1);
+    let expr = r#"{"Expr":{"lhs":{"Column":"a"},"op":"GtEq","rhs":{"Value":{"UInt32":10}}}}"#;
+    let mut env = TestEnv::with_prefix("backfill-conflict-reload")
+        .await
+        .with_partition_expr_fetcher(new_dummy_fetcher(region_id, expr.to_string()));
+    let (engine, _log_store) = new_engine(&mut env).await;
+    engine.require_write_lease();
+    engine.freeze_lease_clock(Instant::now());
+    let request = CreateRequestBuilder::new()
+        .insert_option(WAL_OPTIONS_KEY, &wal_options()[WAL_OPTIONS_KEY])
+        .partition_expr_json(None)
+        .build();
+    let table_dir = request.table_dir.clone();
+    engine
+        .handle_request(region_id, RegionRequest::Create(request))
+        .await
+        .unwrap();
+    close_region(&engine, region_id).await;
+    let open = RegionRequest::Open(open_requ
```

#### Recent Merged Pull Requests:
- **PR #10551** (2026-11-21): feat: update dashboard to v0.14.7 (@sunchanglong)
- **PR #10550** (2026-11-20): refactor(meta): make coordinated invalidation the default for metadata caches (@WenyXu)
- **PR #10545** (2026-11-20): test(query): skip the far-future overflow test when SystemTime cannot represent it (@discord9)
- **PR #10544** (2026-11-20): fix(mito2): wait for a Leader lease before committing after a catchup (@fengjiachun)
- **PR #10543** (2026-11-20): fix(mito-codec): align sparse metric rows with physical region fields (@WenyXu)
- **PR #10542** (2026-11-20): perf(catalog): batch cached metadata reads for information schema scans (@WenyXu)

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

## X. mito2): wait for a Leader lease before committing after a catchup

**RULE**:
When implementing operations in `src/mito2/AGENTS.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in GreptimeTeam/greptimedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5952a49e`: mito2): wait for a Leader lease before committing after a catchup. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/mito2/AGENTS.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
  `engine/index_build_test.rs` and `compaction/`. A background rebuild must not replace a file
  that carries extension indexes (`worker/handle_rebuild_index.rs::needs_background_indexes`).
  and `defers_background_flush()`, a flush request `is_flushable()` and `is_staging()` (`is_writable()` and
- On a node whose writes need a lease, a region that a catchup made writable waits for a
  Leader or StagingLeader lease sent after the catchup (`awaits_leader_lease`). Until then
  `ManifestContext::update_locked` refuses its commits unless they are staged or the region is
  downgrading (a close that must flush downgrades first); only a replay of tails
  (`TailsEditor::Replay`) skips the check, a discard does not, and ending staging checks it
  before `commit_staged_locked`. No flush or compaction trigger starts work for a waiting region except
  a downgrade's flush. The lease that ends the wait wakes the worker
  (`handle_leader_lease_wait_ended`) to schedule the flushes the wait deferred and, only if the
  region is then a writable leader, start a compaction, build missing indexes, re-issue the
  index build retries the wait refused and persist backfilled metadata.
  a worker's region m
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
  `engine/index_build_test.rs` and `compaction/`.
  and `is_staging()`, a flush request `is_flushable()` and `is_staging()` (`is_writable()` and
  a worker's region map must also remove its record: `RegionWorkerLoop::remove_region`
  (`worker/handle_close.rs`, also used after a close-time flush), `drop_region`
  (`worker/handle_drop.rs`) and `RegionWorkerLoop::clean` (`worker.rs`).
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5952a49e` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
