> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/greptimeteam-greptimedb-learnings.md`  
> **Source**: github ([https://github.com/GreptimeTeam/greptimedb](https://github.com/GreptimeTeam/greptimedb))  
> **Source Version**: `68145fc7`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T12:16:18.483Z  
> **Learning ID**: `learn-github-greptimeteam-greptimedb`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): GreptimeTeam/greptimedb

> **Canonical Artifact**: `07_PROJECT_LEARNING/greptimeteam-greptimedb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/GreptimeTeam/greptimedb](https://github.com/GreptimeTeam/greptimedb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-13T12:16:18.477Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GreptimeTeam/greptimedb`
- **Description**: The open-source observability database. One columnar engine for metrics, logs, and traces, on object storage.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6810 stars

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
- **Issue #10434** (2026-11-13): **fix(auth): backport physical metric permission targets to v1.3**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  #10084, #10415, #10148  ## What's changed and what's your intention?  Backport #10084 from its main merge commit to `release/v1.3`. Preserve physical metric-table permission targets and filter Prometheus discovery by access.  This supplies the permission-target API needed by #10415. After this PR merges, update #10415 from the release branch and rerun its CI. The same source fix is already included in candidate #10264.  The backport has the same stable patch ID as the main merge. Formatting and diff checks passed. Runtime and downstream interface validation remain pending; this PR is draft.   ## PR Checklist Please convert it to a draft if some of the following conditions are not met.  - [ ] I have written the necessary rustdoc comments. - [ ] I have added the necessary unit tests and integration tests. - [ ] This PR requires documentation updates. - [ ] API changes are backward compatible. - [ ] Schema or data changes are backward compatible. - [ ] This PR needs to be backported to release branches, and I have added the `backport-<target>` labels (e.g. `backport-v1.3` targets `release/v1.3`). 

- **Issue #10419** (2026-11-13): **perf(mito-codec): index sparse label columns by id once at bind time**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  ## What's changed and what's your intention?  The sparse-label audit walked the physical primary key once per label: `column()` and `position()` were linear scans over the described columns, so decoding a key with N labels over M primary-key columns cost O(N·M) per chunk.  Build an id→encoding-position index once in `bind()` and use it for both lookups, so the cost drops to O(N). The full structural audit still runs before any value is read, and error text and error-selection order are unchanged.  ## PR Checklist - [x] I have written the necessary rustdoc comments. - [x] I have added the necessary unit tests and integration tests. - [ ] This PR requires documentation updates. - [x] API changes are backward compatible. - [x] Schema or data changes are backward compatible. - [ ] This PR needs to be backported to release branches, and I have added the `backport-<target>` labels (e.g. `backport-v1.3` targets `release/v1.3`).  ## Merge timing  - [x] Merge during the nightly window <!-- nightly-merge --> 
  **Post-Mortem & Fix Analysis**:
  > <!-- pr-open-limit --> > [!WARNING] > @discord9 has **35** open non-draft pull requests in this repository, over the limit of **5**.  Review is the scarcest resource here. Please land or close some of these before pushing this one forward.  - [PR 9404: feat\(query\)\: add opt\-in distributed broadcast join planner](https://redirect.github.com/GreptimeTeam/greptimedb/pull/9404) - [PR 9463: fix\(flow\)\: clean up cross\-mode replacements without checker deadlocks](https://redirect.github.com/GreptimeTeam/greptimedb/pull/9463) - [PR 9496: test\: query option regressions separate from capability](https://redirect.github.com/GreptimeTeam/greptimedb/pull/9496) - [PR 9546: feat\(query\)\: opt\-in experimental factorized join aggregation rewrite \(WIP\)](https://redirect.github.com/GreptimeTeam/greptimedb/pull/9546) - [PR 9557: feat\(query\)\: materialized broadcast join for volatile small sides](https://redirect.github.com/GreptimeTeam/greptimedb/pull/9557) - [PR 10039: test\(promql\)\: cover

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

### Incident Patch 1: `9f6c957e` (2026-11-12)
**Commit Message**: fix(mito2): commit staging edits once when staging ends (#10322)

* fix(mito2): commit staging edits once when staging ends

Staging edits (the new partition expression, the imported files) were saved
as deltas in the staging directory, each taking a manifest version. The end of
staging listed that directory and merged every delta it found, including
deltas a stale writer wrote late.

Staged actions now stay in memory and take no version. The end of staging
commits them once, as the next version, in a new EndingStaging state that
stalls writes and holds role changes back until the commit returns. If the
commit may have been written and the region stays staging, the encoded commit
is kept: a retried request stages nothing new and commits the same content,
and other staged edits are refused with a retryable error meanwhile.

Signed-off-by: jeremyhi <[REDACTED_EMAIL]>

* fix(mito2): settle an uncertain end of staging before later commits

Under overwrite publication a save that may have landed must not be
overwritten, so every commit takes its version before the save and a failed
save leaves that version unused. For the end of staging, the version is now
taken only once the result is 

**File**: `src/mito2/AGENTS.md` (modified, +8/-4)
```diff
@@ -111,7 +111,9 @@ Tests live next to the code as `*_test.rs` (e.g. `src/mito2/src/engine/flush_tes
   arbitrary partial groups: readers and index row IDs rely on this layout.
 - Sequence numbers are strictly increasing per region; dedup and snapshot reads
   depend on this. Do not change assignment lightly.
-- Manifest version is monotonic — never reset or skip it.
+- Manifest version is monotonic — never reset or skip it. Staging takes no version:
+  its actions stay in memory (`manifest/manager.rs`) and are committed once, as the
+  next version, when staging ends (`MitoRegion::end_staging_locked`).
 - In regions whose writes require a lease and whose WAL is the object store WAL,
   each manifest version has one fixed object name, created conditionally. A late
   create can succeed again once checkpoint cleanup frees the name, so a commit
@@ -156,9 +158,11 @@ Tests live next to the code as `*_test.rs` (e.g. `src/mito2/src/engine/flush_tes
 - In flat batches, equal `__primary_key` dictionary keys imply the same series, but
   not the reverse: `wrap_pk_binary_to_dict` gives every row its own key. Compare key
   bytes when grouping rows by series.
-- Staging regions never flush: a flush would move rows into the staging manifest and
-  release their WAL, losing them if staging does not end successfully. Every flush
-  trigger in `worker/handle_flush.rs` must skip them, and `handle_close` leaves staging first.
+- Staging regions, ending staging included, never flush: a flush would stage its SST and
+  release the rows' WAL, losing them if staging does not end successfully. Every flush
+  trigger in `worker/handle_flush.rs` must skip them: background triggers test `is_writable()`
+  and `is_staging()`, a flush request `is_flushable()` and `is_staging()` (`is_writable()` and
+  `is_flushable()` are false while ending staging). `handle_close` leaves staging first.
 
 ## Maintenance contract
 
```

**File**: `src/mito2/src/compaction/scheduler.rs` (modified, +2/-2)
```diff
@@ -51,8 +51,8 @@ use crate::error::{
     CompactionCancelledSnafu, Error, ManualCompactionAlreadyRunningSnafu, RegionClosedSnafu,
     RegionDroppedSnafu, RegionTruncatedSnafu, Result, UnsupportedOperationSnafu,
 };
+use crate::region::ManifestContextRef;
 use crate::region::version::VersionControlRef;
-use crate::region::{ManifestContextRef, RegionLeaderState, RegionRoleState};
 use crate::request::{DdlRequest, OptionOutputTx, SenderDdlRequest, WorkerRequestWithTime};
 use crate::schedule::RequestCancelResult;
 use crate::worker::WorkerListener;
@@ -569,7 +569,7 @@ impl CompactionScheduler {
             return Ok(false);
         }
         let current_state = manifest_ctx.current_state();
-        if current_state == RegionRoleState::Leader(RegionLeaderState::Staging) {
+        if current_state.in_staging_session() {
             info!(
                 "Skipping compaction for region {} in staging mode, options: {:?}",
                 region_id, compact_options
```

**File**: `src/mito2/src/compaction/scheduler_test.rs` (modified, +6/-3)
```diff
@@ -45,7 +45,7 @@ use crate::engine::pending_tail_test::{pending_tails_edit, tail};
 use crate::error::InvalidSchedulerStateSnafu;
 use crate::manifest::manager::{RegionManifestManager, RegionManifestOptions};
 use crate::metrics::COMPACTION_MEMORY_REJECTED;
-use crate::region::ManifestContext;
+use crate::region::{ManifestContext, RegionLeaderState, RegionRoleState};
 use crate::request::{BackgroundNotify, CompactionUnitNotification, OutputTx, WorkerRequest};
 use crate::schedule::CancellableTaskState;
 use crate::schedule::remote_job_scheduler::{RemoteJob, RemoteJobSchedulerRef};
@@ -2314,8 +2314,11 @@ async fn test_scheduler_env_submits_compactions_to_injected_executor() {
     assert_eq!(1, injected.num_jobs());
 }
 
+#[rstest::rstest]
+#[case::staging(RegionLeaderState::Staging)]
+#[case::ending_staging(RegionLeaderState::EndingStaging)]
 #[tokio::test]
-async fn test_compaction_bypass_in_staging_mode() {
+async fn test_compaction_bypass_in_staging_mode(#[case] state: RegionLeaderState) {
     let env = SchedulerEnv::new().await;
     let (tx, _rx) = mpsc::channel(4);
     let mut scheduler = env.mock_compaction_scheduler(tx);
@@ -2346,7 +2349,7 @@ async fn test_compaction_bypass_in_staging_mode() {
         .unwrap();
         Arc::new(ManifestContext::new(
             manager,
-            RegionRoleState::Leader(RegionLeaderState::Staging),
+            RegionRoleState::Leader(state),
             None,
             Default::default(),
         ))
```

**File**: `src/mito2/src/engine/apply_staging_manifest_test.rs` (modified, +154/-4)
```diff
@@ -18,6 +18,7 @@ use std::{assert_matches, fs};
 
 use api::v1::Rows;
 use api::v1::region::{StrictWindow, compact_request};
+use common_error::ext::{ErrorExt, RetryHint};
 use common_function::utils::partition_expr_version;
 use common_recordbatch::RecordBatches;
 use datatypes::arrow::array::{AsArray, UInt64Array};
@@ -42,7 +43,8 @@ use crate::manifest::action::{
 use crate::sst::FormatType;
 use crate::sst::file::FileMeta;
 use crate::test_util::{
-    CreateRequestBuilder, TestEnv, build_rows, build_rows_for_key, put_rows, rows_schema,
+    CreateRequestBuilder, DeltaFaults, TestEnv, build_rows, build_rows_for_key, put_rows,
+    reopen_region, rows_schema,
 };
 
 fn range_expr(col_name: &str, start: i64, end: i64) -> PartitionExpr {
@@ -609,6 +611,16 @@ async fn test_apply_staging_manifest_success_with_format(flat_format: bool) {
     assert_eq!(manifest.files.len(), 0);
     let staging_manifest = region.manifest_ctx.staging_manifest().await.unwrap();
     assert_eq!(staging_manifest.files.len(), 0);
+    // A delta that an older binary left in the staging directory goes when staging ends.
+    let data_home = env.data_home();
+    let region_dir = format!("{}/data/test/1_0000000002", data_home.display());
+    let staging_manifest_dir = format!("{}/staging/manifest", region_dir);
+    fs::create_dir_all(&staging_manifest_dir).unwrap();
+    fs::write(
+        format!("{staging_manifest_dir}/00000000000000000001.json"),
+        "{}",
+    )
+    .unwrap();
 
     engine
         .handle_request(
@@ -638,9 +650,6 @@ async fn test_apply_staging_manifest_success_with_format(flat_format: bool) {
     // The staging partition expr should be cleared.
     assert!(region.manifest_ctx.staging_partition_info().is_none());
     // The staging manifest directory should be empty.
-    let data_home = env.data_home();
-    let region_dir = format!("{}/data/test/1_0000000001", data_home.display());
-    let staging_manifest_dir = format!("{}/staging/manifest", region_dir);
     let staging_files = fs::read_dir(&staging_manifest_dir)
         .map(|entries| {
             entries
@@ -1359,3 +1368,144 @@ async fn test_merge_repartition_data_integrity() {
         batches.pretty_print().unwrap()
     );
 }
+
+/// The end commit fails after its delta landed (a lost response) or before. The retry writes the
+/// same delta at the next version, and a reopen sees one commit.
+#[rstest::rstest]
+#[case::landed(true)]
+#[case::not_landed(false)]
+#[tokio::test]
+async fn test_apply_staging_manifest_retries_failed_commit(#[case] landed: bool) {
+    let faults = DeltaFaults::default();
+    let mut env = TestEnv::with_prefix("apply-failed-commit")
+        .await
+        .with_mock_layer(faults.layer());
+    let engine = env.create_engine(MitoConfig::default()).await;
+    let region_id = RegionId::new(2, 2);
+    let request = CreateRequestBuilder::new().build();
+    let table_dir = request.table_dir.clone();
+    let schema = rows_schema(&request);
+    engine
+        .handle_request(region_id, RegionRequest::Create(request))
+        .await
+        .unwrap();
+    put_rows(
+        &engine,
+        region_id,
+        Rows {
+            schema,
+            rows: build_rows(0, 3),
+        },
+    )
+    .await;
+    engine
+        .handle_request(region_id, RegionRequest::Flush(Default::default()))
+        .await
+        .unwrap();
+    let partition_expr = range_expr("tag_0", 0, 50).as_json_str().unwrap();
+    engine
+        .handle_request(
+            region_id,
+            RegionRequest::EnterStaging(EnterStagingRequest {
+                partition_directive: StagingPartitionDirective::UpdatePartitionExpr(
+                    partition_expr.clone(),
+                ),
+            }),
+        )
+        .await
+        .unwrap();
+    let remap_result = engine
+        .remap_manifests(RemapManifestsRequest {
+            region_id,
+            input_regions: vec![region_id],
+            region_mapping: [(region_id, vec![region_id])].into_iter().collect(),
+            new_partition_exprs: [(region_id, partition_expr.clone())].into_iter().collect(),
+        })
+        .await
+        .unwrap();
+    let apply = || {
+        RegionRequest::ApplyStagingManifest(ApplyStagingManifestRequest {
+            partition_expr: partition_expr.clone(),
+            central_region_id: region_id,
+            manifest_path: remap_result.manifest_paths[&region_id].clone(),
+        })
+    };
+    let region = engine.get_region(region_id).unwrap();
+    let version = region.manifest_ctx.manifest_version().await;
+
+    if landed {
+        faults.lose_next_response();
+    } else {
+        faults.fail_next_write();
+    }
+    // The region stays staging and keeps its edits for a retry.
+    let err = engine.handle_request(region_id, apply()).await.unwrap_err();
+    assert_eq!(RetryHint::Retryable, err.retry_hint());
+    assert!(region.is_staging());
+    // Until the retry, another edit is refused with
```

**File**: `src/mito2/src/engine/listener.rs` (modified, +28/-0)
```diff
@@ -190,6 +190,34 @@ impl EventListener for StallListener {
     }
 }
 
+/// Counts write stalls, for tests that wait for more than one.
+#[derive(Default)]
+pub struct CountingStallListener {
+    count: AtomicUsize,
+    notify: Notify,
+}
+
+impl CountingStallListener {
+    /// Waits until the engine has stalled writes at least `expected` times.
+    pub async fn wait_for_count(&self, expected: usize) {
+        loop {
+            let notified = self.notify.notified();
+            if self.count.load(Ordering::Relaxed) >= expected {
+                return;
+            }
+            notified.await;
+        }
+    }
+}
+
+#[async_trait]
+impl EventListener for CountingStallListener {
+    fn on_write_stall(&self) {
+        self.count.fetch_add(1, Ordering::Relaxed);
+        self.notify.notify_waiters();
+    }
+}
+
 /// Blocks a flush at its begin event until the worker requests flush cancellation.
 ///
 /// Tests use this gate to ensure a flush is active before submitting a lifecycle DDL.
```

**File**: `src/mito2/src/engine/object_store_wal_test.rs` (modified, +54/-3)
```diff
@@ -828,7 +828,7 @@ async fn test_staging_save_after_deadline_sends_nothing() {
     let region = engine.get_region(region_id).unwrap();
     let version = next_manifest_version(&region).await;
 
-    // The memtable is empty, so entering staging saves its manifest without a flush.
+    // The memtable is empty, so entering staging stages its change without a flush.
     engine.freeze_lease_clock(deadline);
     let error = engine
         .handle_request(region_id, enter_staging_request())
@@ -840,12 +840,63 @@ async fn test_staging_save_after_deadline_sends_nothing() {
         "{error:?}"
     );
     assert_eq!(version, next_manifest_version(&region).await);
-    let store = region.manifest_ctx.manifest_manager.read().await.store();
-    assert!(store.fetch_staging_manifests().await.unwrap().is_empty());
+    let manager = region.manifest_ctx.manifest_manager.read().await;
+    assert!(manager.staged_actions().is_none());
+    drop(manager);
     assert!(!region.manifest_ctx.is_reload_pending());
     assert!(region.is_writable());
 }
 
+#[tokio::test]
+async fn test_end_of_staging_after_deadline_sends_nothing() {
+    let mut env = TestEnv::with_prefix("end-staging-after-deadline").await;
+    let region_id = RegionId::new(1, 1);
+    let (engine, _log_store, table_dir, schema, deadline) =
+        create_leased_region(&mut env, region_id).await;
+    put_range(&engine, region_id, &schema, 0, 3).await;
+    flush_region(&engine, region_id, None).await;
+    let region = engine.get_region(region_id).unwrap();
+    let file = region
+        .manifest_ctx
+        .manifest()
+        .await
+        .files
+        .values()
+        .next()
+        .unwrap()
+        .clone();
+    engine
+        .handle_request(region_id, enter_staging_request())
+        .await
+        .unwrap();
+    engine
+        .edit_region(region_id, edit_files(vec![file], vec![]))
+        .await
+        .unwrap();
+    let version = next_manifest_version(&region).await;
+
+    engine.freeze_lease_clock(deadline);
+    let response = engine
+        .set_region_role_state_gracefully(region_id, SettableRegionRoleState::Leader)
+        .await
+        .unwrap();
+
+    assert!(response.is_invalid_transition(), "{response:?}");
+    assert_eq!(version, next_manifest_version(&region).await);
+    let store = env.get_object_store().unwrap();
+    let region_dir = region_dir_from_table_dir(&table_dir, region_id, PathType::Bare);
+    let delta = gen_path(
+        &manifest_dir(&region_dir),
+        &delta_file(version),
+        CompressionType::Gzip,
+    );
+    assert!(!store.exists(&delta).await.unwrap());
+    assert!(region.is_follower());
+    assert!(!region.manifest_ctx.is_reload_pending());
+    // The staged edit leaves with staging.
+    assert!(region.manifest_ctx.staging_manifest().await.is_none());
+}
+
 #[tokio::test]
 async fn test_default_mode_commit_ignores_leader_deadline() {
     let mut env = TestEnv::with_prefix("default-mode-deadline").await;
```

**File**: `src/mito2/src/engine/open_test.rs` (modified, +21/-1)
```diff
@@ -1198,8 +1198,11 @@ fn new_dummy_fetcher(region_id: RegionId, expr_json: String) -> PartitionExprFet
     })
 }
 
+#[rstest::rstest]
+#[case::from_writable(false)]
+#[case::after_empty_staging(true)]
 #[tokio::test]
-async fn test_open_backfills_partition_expr_with_fetcher() {
+async fn test_open_backfills_partition_expr_with_fetcher(#[case] staging: bool) {
     let mut env = TestEnv::with_prefix("open-backfill-fetcher").await;
 
     // prepare plugins with dummy fetcher
@@ -1255,10 +1258,27 @@ async fn test_open_backfills_partition_expr_with_fetcher() {
     engine
         .set_region_role(region_id, RegionRole::Leader)
         .unwrap();
+    if staging {
+        // Ending a staging with nothing to commit also backfills.
+        engine
+            .set_region_role_state_gracefully(region_id, SettableRegionRoleState::StagingLeader)
+            .await
+            .unwrap();
+    }
     engine
         .set_region_role_state_gracefully(region_id, SettableRegionRoleState::Leader)
         .await
         .unwrap();
+    let manifest = engine
+        .get_region(region_id)
+        .unwrap()
+        .manifest_ctx
+        .manifest()
+        .await;
+    assert_eq!(
+        manifest.metadata.partition_expr.as_deref(),
+        Some(expr_json.as_str())
+    );
 
     // reopen again to ensure no further changes and still Some
     engine
```

**File**: `src/mito2/src/engine/region_hook.rs` (modified, +16/-16)
```diff
@@ -24,7 +24,7 @@
 //!   (see [`SstFileInfo`] and the coverage footnote).
 //!
 //! - [`on_manifest_updated`]: Fires after a manifest write is committed to the **live**
-//!   (normal) manifest directory. Writes to the staging directory (enter staging,
+//!   (normal) manifest directory. Actions staged in memory (enter staging,
 //!   operations during staging, the intermediate apply-staging edit) are suppressed —
 //!   their effects are accumulated and delivered in a single notification when the
 //!   staged actions are promoted to the live manifest. Receives the full
@@ -43,10 +43,10 @@
 //! ## Coverage
 //!
 //! Only manifest writes to the **normal** (live) manifest directory trigger
-//! `on_manifest_updated`. Writes to the staging manifest directory (operations
+//! `on_manifest_updated`. Actions staged in memory (operations
 //! that happen while the region is in staging mode) are intentionally suppressed:
 //! their effects are accumulated and delivered in a single notification when
-//! the staged actions are promoted to the live manifest via `exit_staging_on_success`.
+//! the staged actions are committed to the live manifest via `end_staging_locked`.
 //!
 //! | Scenario                     | `on_sst_files_written` | `on_manifest_updated` |
 //! |------------------------------|:----------------------:|:---------------------:|
@@ -58,17 +58,17 @@
 //! | Apply staging (promote)      | ❌ (delegates to edit)  | ✅ Yes ²               |
 //! | Alter (schema change)        | ❌ (no SST files)       | ✅ Yes                |
 //! | Truncate                     | ❌ (removes files)      | ✅ Yes                |
-//! | Enter staging                | ❌ (no SST files)       | ❌ (staging dir)      |
-//! | Operations during staging    | N/A                    | ❌ (staging dir)      |
+//! | Enter staging                | ❌ (no SST files)       | ❌ (in memory)        |
+//! | Operations during staging    | N/A                    | ❌ (in memory)        |
 //! | Async index build            | ❌ (index files only)   | ✅ Yes                |
 //!
 //! ¹ Remote compaction runs on a dedicated compactor node via `CompactionRegionOpener::open()`;
 //!   pass plugins via `OpenCompactionRegionRequest` to enable hooks there. `sst_infos` is
 //!   `#[serde(skip)]` over the wire, so each [`SstInfo`] is rebuilt from [`FileMeta`] with
 //!   empty footer/index — see [`SstFileInfo`] for field-level detail.
-//! ² Apply staging fires `on_manifest_updated` once when `exit_staging_on_success` promotes
+//! ² Apply staging fires `on_manifest_updated` once when `end_staging_locked` commits
 //!   all staged manifest actions (including the SST file additions) into the live manifest.
-//!   The intermediate staging `RegionEdit` is written to the staging directory and does not
+//!   The intermediate staging `RegionEdit` is staged in memory and does not
 //!   fire the hook — its file list is included in the promote notification.
 //!
 //! The following paths do **not** trigger any hook:
@@ -176,18 +176,18 @@ use crate::sst::parquet::SstInfo;
 ///
 /// ## Staging suppression
 ///
-/// When `is_staging` is `true`, [`fire`](Self::fire) is a no-op — the write went to
-/// the staging manifest directory. The hook only observes writes to the live (normal)
+/// When `is_staging` is `true`, [`fire`](Self::fire) is a no-op — the actions were
+/// staged in memory. The hook only observes writes to the live (normal)
 /// manifest directory. Staging actions are accumulated and delivered in a single
-/// notification when `exit_staging_on_success` promotes them (`is_staging = false`).
+/// notification when `end_staging_locked` commits them (`is_staging = false`).
 #[must_use = "the region hook must be fired after releasing the manifest write lock"]
 pub(crate) struct PendingManifestHook {
     region_id: RegionId,
     /// `None` when no hook is registered (fire becomes a no-op).
     action_list: Option<RegionMetaActionList>,
     version: ManifestVersion,
     hook: Option<RegionHookRef>,
-    /// Whether the manifest write went to the staging directory.
+    /// Whether the actions were staged in memory.
     /// When `true`, `fire()` is suppressed — the hook only observes live manifest writes.
     is_staging: bool,
 }
@@ -214,9 +214,9 @@ impl PendingManifestHook {
         self.version
     }
 
-    /// Fires the hook if one is registered, **unless** the write went to the staging
-    /// manifest directory (`is_staging = true`). Safe to call unconditionally:
-    /// it is a no-op when no hook is registered or when the write is staging-only.
+    /// Fires the hook if one is registered, **unless** the actions were staged in
+    /// memory (`is_staging = true`). Safe to call unconditionally:
+    /// it is a no-op when no hook is registered or when the actions were staged in memory.
     pub(crate) async fn fire(self) {
         if self.is_staging {
             return;
@@ -342,8 +342,8 @@ pub trait RegionHook: Send + Sync + Debug {
     //
```

---

### Incident Patch 2: `643bdd72` (2026-11-13)
**Commit Message**: fix(metric-engine): reuse existing column ids when adding columns is retried (#10372)

The metric engine derives the columns to add from the cached physical
schema, and `DataRegion::assemble_alter_request` assigned every given
column `max(non-reserved column id) + 1` without checking the existing
names. That cache can lag behind: Mito reads its in-memory metadata
without going through the region worker, and a caller future dropped on a
client timeout does not withdraw the request that is already queued. A
retry then treats an installed column as new and Mito rejects it, because
the name exists with a different id.

Recheck the real metadata in `assemble_alter_request`, validate an
existing column with `validate_shared_column` and drop it from the
payload, assign ids only to genuinely new columns, and skip the alter when
nothing is new. Serialize the existence check, the id allocation and the
physical alter per physical data region: the mutex lives in
`PhysicalRegionState` and is held by the metric engine orchestration, so
concurrent requests on logical regions sharing the region cannot allocate
one id to different columns. `DataRegion` stays a stateless adapter.

Build the logical 

**File**: `src/metric-engine/src/data_region.rs` (modified, +178/-12)
```diff
@@ -12,6 +12,8 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
+use std::collections::HashMap;
+
 use api::v1::SemanticType;
 use common_query::native_histogram::is_native_histogram_value_type;
 use common_telemetry::{debug, info};
@@ -26,7 +28,7 @@ use store_api::region_request::{
 use store_api::storage::consts::ReservedColumnId;
 use store_api::storage::{ConcreteDataType, RegionId};
 
-use crate::engine::IndexOptions;
+use crate::engine::{IndexOptions, validate_shared_column};
 use crate::error::{
     AddingFieldColumnSnafu, ColumnTypeMismatchSnafu, ForbiddenPhysicalAlterSnafu,
     MitoReadOperationSnafu, MitoWriteOperationSnafu, Result, SetSkippingIndexOptionSnafu,
@@ -44,7 +46,7 @@ pub struct DataRegion {
 }
 
 impl DataRegion {
-    pub fn new(mito: MitoEngine) -> Self {
+    pub(crate) fn new(mito: MitoEngine) -> Self {
         Self { mito }
     }
 
@@ -55,10 +57,16 @@ impl DataRegion {
     /// logical regions.
     ///
     /// Invoker don't need to set up or verify the column id. This method will adjust
-    /// it using underlying schema.
+    /// it using underlying schema, and reuse the persisted id of a column that the
+    /// physical region already has.
     ///
     /// This method will also set the nullable marker to true. All of those change are applies
     /// to `columns` in-place.
+    ///
+    /// Callers must hold the column-add lock of the physical region, otherwise two
+    /// concurrent requests could read the same metadata and assign one column id to
+    /// different columns. Use
+    /// [MetricEngineInner::add_physical_columns](crate::engine::MetricEngineInner::add_physical_columns).
     pub async fn add_columns(
         &self,
         region_id: RegionId,
@@ -72,10 +80,13 @@ impl DataRegion {
 
         let region_id = utils::to_data_region_id(region_id);
 
-        let num_columns = columns.len();
-        let request = self
+        let Some((new_column_count, request)) = self
             .assemble_alter_request(region_id, columns, index_options)
-            .await?;
+            .await?
+        else {
+            // Every requested column already exists.
+            return Ok(());
+        };
 
         let _timer = MITO_DDL_DURATION.start_timer();
 
@@ -85,26 +96,55 @@ impl DataRegion {
             .await
             .context(MitoWriteOperationSnafu)?;
 
-        PHYSICAL_COLUMN_COUNT.add(num_columns as _);
+        PHYSICAL_COLUMN_COUNT.add(new_column_count as _);
 
         Ok(())
     }
 
     /// Generate wrapped [RegionAlterRequest] with given [ColumnMetadata].
-    /// This method will modify `columns` in-place.
+    ///
+    /// Columns that the physical region already has are not added again: their
+    /// definitions are validated and their persisted column ids are reused.
+    /// Returns `None` if every given column already exists.
     async fn assemble_alter_request(
         &self,
         region_id: RegionId,
         columns: Vec<ColumnMetadata>,
         index_options: IndexOptions,
-    ) -> Result<RegionRequest> {
-        // retrieve underlying version
+    ) -> Result<Option<(usize, RegionRequest)>> {
         let region_metadata = self
             .mito
             .get_metadata(region_id)
             .await
             .context(MitoReadOperationSnafu)?;
 
+        // The caller derives the columns to add from a cached schema that a cancelled or
+        // concurrent alter may have left behind, so the names are checked against the
+        // real metadata instead of being trusted.
+        let mut seen: HashMap<String, usize> = HashMap::with_capacity(columns.len());
+        let mut columns_to_add = Vec::with_capacity(columns.len());
+        for column in columns {
+            let name = column.column_schema.name.clone();
+            if let Some(existing) = region_metadata.column_by_name(&name) {
+                validate_shared_column(region_id, existing, &column)?;
+                continue;
+            }
+            // The batch itself may repeat a column that is not installed yet: the duplicate
+            // must agree with the first occurrence, and only one of them is added.
+            if let Some(&index) = seen.get(&name) {
+                validate_shared_column(region_id, &columns_to_add[index], &column)?;
+                continue;
+            }
+            seen.insert(name, columns_to_add.len());
+            columns_to_add.push(column);
+        }
+
+        if columns_to_add.is_empty() {
+            debug!("No new columns to add to physical region {region_id:?}");
+            return Ok(None);
+        }
+        let new_column_count = columns_to_add.len();
+
         // find the max column id
         let new_column_id_start = 1 + region_metadata
             .column_metadatas
@@ -120,7 +160,7 @@ impl DataRegion {
             .unwrap_or(0);
 
         // overwrite semantic type
-        let new_columns = columns
+        let new_columns
```

**File**: `src/metric-engine/src/engine.rs` (modified, +40/-4)
```diff
@@ -25,7 +25,7 @@ mod put;
 mod read;
 mod region_metadata;
 mod staging;
-mod state;
+pub(crate) mod state;
 mod sync;
 
 use std::any::Any;
@@ -59,8 +59,8 @@ use store_api::storage::{RegionId, ScanRequest, SequenceNumber};
 use crate::config::EngineConfig;
 use crate::data_region::DataRegion;
 use crate::error::{
-    self, Error, Result, StartRepeatedTaskSnafu, UnsupportedRegionRequestSnafu,
-    UnsupportedRemapManifestsRequestSnafu,
+    self, Error, PhysicalRegionNotFoundSnafu, Result, StartRepeatedTaskSnafu,
+    UnsupportedRegionRequestSnafu, UnsupportedRemapManifestsRequestSnafu,
 };
 use crate::metadata_region::MetadataRegion;
 use crate::repeated_task::FlushMetadataRegionTask;
@@ -608,7 +608,7 @@ impl MetricEngine {
 }
 
 /// Shared definitions must agree before CREATE/ALTER mutates either region.
-fn validate_shared_column(
+pub(crate) fn validate_shared_column(
     region_id: store_api::storage::RegionId,
     existing: &store_api::metadata::ColumnMetadata,
     proposed: &store_api::metadata::ColumnMetadata,
@@ -647,6 +647,42 @@ struct MetricEngineInner {
     flush_task: RepeatedTask<Error>,
 }
 
+impl MetricEngineInner {
+    /// Adds columns to the physical region while holding its column-add lock.
+    ///
+    /// Column ids are derived from the metadata of the physical region, so requests
+    /// on logical regions that share one physical region must not allocate ids at
+    /// the same time, otherwise two different columns could get one id.
+    async fn add_physical_columns(
+        &self,
+        physical_region_id: RegionId,
+        columns: Vec<store_api::metadata::ColumnMetadata>,
+        index_options: IndexOptions,
+    ) -> Result<()> {
+        if columns.is_empty() {
+            return Ok(());
+        }
+
+        let data_region_id = utils::to_data_region_id(physical_region_id);
+        let column_add_lock = {
+            let state = self.state.read().unwrap();
+            state
+                .physical_region_states()
+                .get(&data_region_id)
+                .with_context(|| PhysicalRegionNotFoundSnafu {
+                    region_id: data_region_id,
+                })?
+                .column_add_lock()
+                .clone()
+        };
+
+        let _guard = column_add_lock.lock().await;
+        self.data_region
+            .add_columns(physical_region_id, columns, index_options)
+            .await
+    }
+}
+
 #[cfg(test)]
 mod test {
     use std::assert_matches;
```

**File**: `src/metric-engine/src/engine/alter.rs` (modified, +147/-23)
```diff
@@ -29,8 +29,8 @@ use validate::validate_alter_region_requests;
 
 use crate::engine::MetricEngineInner;
 use crate::error::{
-    AddingFieldColumnSnafu, LogicalRegionNotFoundSnafu, PhysicalRegionNotFoundSnafu, Result,
-    SerializeColumnMetadataSnafu, UnexpectedRequestSnafu,
+    AddingFieldColumnSnafu, LogicalRegionNotFoundSnafu, MissingPhysicalColumnSnafu,
+    PhysicalRegionNotFoundSnafu, Result, SerializeColumnMetadataSnafu, UnexpectedRequestSnafu,
 };
 use crate::utils::{append_manifest_info, encode_manifest_info_to_extensions, to_data_region_id};
 
@@ -163,8 +163,7 @@ impl MetricEngineInner {
             );
         }
 
-        self.data_region
-            .add_columns(data_region_id, new_columns_to_add, index_options)
+        self.add_physical_columns(physical_region_id, new_columns_to_add, index_options)
             .await?;
 
         let physical_columns = self.data_region.physical_columns(data_region_id).await?;
@@ -173,28 +172,39 @@ impl MetricEngineInner {
             .map(|metadata| (metadata.column_schema.name.as_str(), metadata))
             .collect::<HashMap<_, _>>();
 
-        let logical_region_columns = requests.iter().map(|(region_id, request)| {
+        // The physical region now has every requested column, either because this call
+        // added it or because it was already there with the same definition.
+        let mut logical_region_columns = Vec::with_capacity(requests.len());
+        for (region_id, request) in &requests {
             let AlterKind::AddColumns { columns } = &request.kind else {
                 unreachable!()
             };
-            (
-                *region_id,
-                columns
-                    .iter()
-                    .map(|col| {
-                        let column_name = col.column_metadata.column_schema.name.as_str();
-                        let column_metadata = *physical_schema_map.get(column_name).unwrap();
-                        (column_name, column_metadata)
-                    })
-                    .collect::<HashMap<_, _>>(),
-            )
-        });
+            let mut column_metadata = HashMap::with_capacity(columns.len());
+            for col in columns {
+                let column_name = col.column_metadata.column_schema.name.as_str();
+                let metadata =
+                    physical_schema_map
+                        .get(column_name)
+                        .copied()
+                        .with_context(|| MissingPhysicalColumnSnafu {
+                            name: column_name,
+                            region_id: physical_region_id,
+                        })?;
+                column_metadata.insert(column_name, metadata);
+            }
+            logical_region_columns.push((*region_id, column_metadata));
+        }
 
-        let new_add_columns = new_column_indices.keys().map(|name| {
-            // Safety: previous steps ensure the physical region exist
-            let column_metadata = *physical_schema_map.get(name).unwrap();
-            (name.to_string(), column_metadata.clone())
-        });
+        let mut new_add_columns = Vec::with_capacity(new_column_indices.len());
+        for name in new_column_indices.keys() {
+            let column_metadata = physical_schema_map.get(name).copied().with_context(|| {
+                MissingPhysicalColumnSnafu {
+                    name: name.to_string(),
+                    region_id: physical_region_id,
+                }
+            })?;
+            new_add_columns.push((name.to_string(), column_metadata.clone()));
+        }
 
         // The data region has the new columns, whatever happens to the metadata write.
         self.state
@@ -205,7 +215,11 @@ impl MetricEngineInner {
         // Writes logical regions metadata to metadata region
         let result = self
             .metadata_region
-            .add_logical_regions(physical_region_id, false, logical_region_columns)
+            .add_logical_regions(
+                physical_region_id,
+                false,
+                logical_region_columns.into_iter(),
+            )
             .await;
         // A failed write may still be applied, e.g. when the region lease expires after the WAL
         // append, so the cached logical columns are dropped either way.
@@ -284,6 +298,9 @@ mod test {
     use common_meta::ddl::test_util::assert_column_name_and_id;
     use common_meta::ddl::utils::{parse_column_metadatas, parse_manifest_infos_from_extensions};
     use common_query::prelude::{greptime_timestamp, greptime_value};
+    use datatypes::prelude::ConcreteDataType;
+    use datatypes::schema::ColumnSchema;
+    use store_api::metadata::ColumnMetadata;
     use store_api::metric_engine_consts::ALTER_PHYSICAL_EXTENSION_KEY;
     use store_api::region_engine::RegionEngine;
     use store_api::region_request::{
@@ -292,7 +309,9 @@ mod test {
     use store_api::storage::RegionId;
     use store_api::storage::consts::ReservedColumnId;
 
+ 
```

**File**: `src/metric-engine/src/engine/create.rs` (modified, +33/-27)
```diff
@@ -45,9 +45,9 @@ use crate::engine::create::extract_new_columns::extract_new_columns;
 use crate::engine::options::{PhysicalRegionOptions, set_data_region_options};
 use crate::error::{
     ColumnTypeMismatchSnafu, ConflictRegionOptionSnafu, CreateMitoRegionSnafu,
-    InternalColumnOccupiedSnafu, InvalidMetadataSnafu, MissingRegionOptionSnafu,
-    MultipleFieldColumnSnafu, NoFieldColumnSnafu, ParseRegionIdSnafu, PhysicalRegionNotFoundSnafu,
-    Result, SerializeColumnMetadataSnafu, UnexpectedRequestSnafu,
+    InternalColumnOccupiedSnafu, InvalidMetadataSnafu, MissingPhysicalColumnSnafu,
+    MissingRegionOptionSnafu, MultipleFieldColumnSnafu, NoFieldColumnSnafu, ParseRegionIdSnafu,
+    PhysicalRegionNotFoundSnafu, Result, SerializeColumnMetadataSnafu, UnexpectedRequestSnafu,
 };
 use crate::metrics::PHYSICAL_REGION_COUNT;
 use crate::utils::{
@@ -289,8 +289,7 @@ impl MetricEngineInner {
         };
 
         // TODO(weny): we dont need to pass a mutable new_columns here.
-        self.data_region
-            .add_columns(data_region_id, new_columns, index_option)
+        self.add_physical_columns(physical_region_id, new_columns, index_option)
             .await?;
 
         let physical_columns = self.data_region.physical_columns(data_region_id).await?;
@@ -302,28 +301,35 @@ impl MetricEngineInner {
             .iter()
             .map(|(region_id, _)| *region_id)
             .collect::<Vec<_>>();
-        let logical_region_columns = requests.iter().map(|(region_id, request)| {
-            (
-                *region_id,
-                request
-                    .column_metadatas
-                    .iter()
-                    .map(|metadata| {
-                        // Safety: previous steps ensure the physical region exist
-                        let column_metadata = *physical_schema_map
-                            .get(metadata.column_schema.name.as_str())
-                            .unwrap();
-                        (metadata.column_schema.name.as_str(), column_metadata)
-                    })
-                    .collect::<HashMap<_, _>>(),
-            )
-        });
+        // The physical region now has every requested column, either because this call
+        // added it or because it was already there with the same definition.
+        let mut logical_region_columns = Vec::with_capacity(requests.len());
+        for (region_id, request) in &requests {
+            let mut column_metadata = HashMap::with_capacity(request.column_metadatas.len());
+            for metadata in &request.column_metadatas {
+                let name = metadata.column_schema.name.as_str();
+                let physical_metadata =
+                    physical_schema_map.get(name).copied().with_context(|| {
+                        MissingPhysicalColumnSnafu {
+                            name,
+                            region_id: physical_region_id,
+                        }
+                    })?;
+                column_metadata.insert(name, physical_metadata);
+            }
+            logical_region_columns.push((*region_id, column_metadata));
+        }
 
-        let new_add_columns = new_column_indices.keys().map(|name| {
-            // Safety: previous steps ensure the physical region exist
-            let column_metadata = *physical_schema_map.get(name).unwrap();
-            (name.to_string(), column_metadata.clone())
-        });
+        let mut new_add_columns = Vec::with_capacity(new_column_indices.len());
+        for name in new_column_indices.keys() {
+            let column_metadata = physical_schema_map.get(name).copied().with_context(|| {
+                MissingPhysicalColumnSnafu {
+                    name: name.to_string(),
+                    region_id: physical_region_id,
+                }
+            })?;
+            new_add_columns.push((name.to_string(), column_metadata.clone()));
+        }
         // The data region has the new columns, whatever happens to the metadata write.
         self.state
             .write()
@@ -337,7 +343,7 @@ impl MetricEngineInner {
 
         // Writes logical regions metadata to metadata region
         self.metadata_region
-            .add_logical_regions(physical_region_id, true, logical_region_columns)
+            .add_logical_regions(physical_region_id, true, logical_region_columns.into_iter())
             .await?;
 
         self.state
```

**File**: `src/metric-engine/src/engine/state.rs` (modified, +15/-0)
```diff
@@ -43,6 +43,15 @@ pub struct PhysicalRegionState {
     primary_key_encoding: PrimaryKeyEncoding,
     options: PhysicalRegionOptions,
     time_index_unit: TimeUnit,
+    /// Serializes adding columns to this physical region: the column existence
+    /// check, the column id allocation and the physical ALTER that installs the
+    /// columns. Column ids are derived from the current metadata, so two
+    /// concurrent add-column requests on logical regions sharing this physical
+    /// region could otherwise assign the same id to different columns.
+    ///
+    /// Callers clone the [`Arc`] out of the state and hold it across the
+    /// physical alter; see [`crate::data_region::DataRegion::add_columns`].
+    column_add_lock: Arc<tokio::sync::Mutex<()>>,
 }
 
 impl PhysicalRegionState {
@@ -67,9 +76,15 @@ impl PhysicalRegionState {
             primary_key_encoding,
             options,
             time_index_unit,
+            column_add_lock: Arc::new(tokio::sync::Mutex::new(())),
         }
     }
 
+    /// Returns the lock that serializes adding columns to this physical region.
+    pub fn column_add_lock(&self) -> &Arc<tokio::sync::Mutex<()>> {
+        &self.column_add_lock
+    }
+
     /// Returns a reference to the logical region ids.
     pub fn logical_regions(&self) -> &HashSet<RegionId> {
         &self.logical_regions
```

**File**: `src/metric-engine/src/error.rs` (modified, +16/-0)
```diff
@@ -255,6 +255,18 @@ pub enum Error {
         location: Location,
     },
 
+    #[snafu(display(
+        "Column {} is missing from physical region {} after adding columns",
+        name,
+        region_id
+    ))]
+    MissingPhysicalColumn {
+        name: String,
+        region_id: RegionId,
+        #[snafu(implicit)]
+        location: Location,
+    },
+
     #[snafu(display("Table id count mismatch. Expect {}, got {}", expected, actual))]
     TableIdCountMismatch {
         expected: usize,
@@ -451,6 +463,10 @@ impl ErrorExt for Error {
 
             ColumnNotFound { .. } => StatusCode::TableColumnNotFound,
 
+            // The physical region was read twice around the alter and lost a column in
+            // between, so the failure is an inconsistent server state, not a bad request.
+            MissingPhysicalColumn { .. } => StatusCode::Unexpected,
+
             CreateMitoRegion { source, .. }
             | OpenMitoRegion { source, .. }
             | CleanUpMitoRegion { source, .. }
```

---

### Incident Patch 3: `68145fc7` (2026-11-13)
**Commit Message**: fix(mito2): coordinate region edits with repartition lifecycle requests (#10354)

* fix(mito2): coordinate region edits with repartition requests

Extend the pending ALTER queue to defer lifecycle requests blocked by region edits. Preserve scheduler handoffs and drain accepted edits before entering staging, rejecting new unbound imports at that boundary.

Keep ApplyStagingManifest's asynchronous execution and close-time flush behavior. Cover queue bounds, failures, staging transitions, close/reload races, and flush concurrency.

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

* fix(mito2): settle region waiters before completion returns

Reject pending lifecycle requests when retiring a region. Give each completion one dispatch owner while preserving stalled-write ordering, edit-before-compaction dispatch, and fenced-region reload handling.

Cover edit retirement with queued requests; the regression times out when removal only rejects edits.

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

* fix(mito2): preserve queued close flush requirements

Defer later closes behind a pending close even when they do not request a flush themselves. Reuse the existing close-time flush and waiter handoff.

Co

**File**: `src/mito2/AGENTS.md` (modified, +3/-0)
```diff
@@ -187,6 +187,9 @@ Tests live next to the code as `*_test.rs` (e.g. `src/mito2/src/engine/flush_tes
   and `is_staging()`, a flush request `is_flushable()` and `is_staging()` (`is_writable()` and
   `is_flushable()` are false while ending staging). `handle_close` leaves staging first.
   Tail replays never run for them: entering staging fails while tails are pending.
+- Direct SST imports without a staging binding cannot publish into staging.
+  `worker/handle_manifest.rs` seals edit admission while EnterStaging drains accepted
+  edits. Scheduler-owned DDLs resume through execution, bypassing initial admission.
 
 ## Maintenance contract
 
```

**File**: `src/mito2/src/compaction/scheduler.rs` (modified, +17/-0)
```diff
@@ -516,6 +516,23 @@ impl CompactionScheduler {
         status.pending_ddl_requests.push(request);
         Ok(())
     }
+
+    /// Pending and handed-off DDLs retain their turn until the final reply.
+    pub(crate) fn blocks_region_edits(&self, region_id: RegionId) -> bool {
+        self.region_status
+            .get(&region_id)
+            .is_some_and(|status| status.has_ddl())
+    }
+
+    /// Whether a staging request is still waiting for compaction cancellation.
+    pub(crate) fn has_pending_enter_staging(&self, region_id: RegionId) -> bool {
+        self.region_status.get(&region_id).is_some_and(|status| {
+            status
+                .pending_ddl_requests
+                .iter()
+                .any(|ddl| matches!(ddl.request, DdlRequest::EnterStaging(_)))
+        })
+    }
 }
 
 // Internal state-machine helpers.
```

**File**: `src/mito2/src/engine/apply_staging_manifest_test.rs` (modified, +10/-1)
```diff
@@ -1527,7 +1527,16 @@ async fn test_apply_staging_manifest_retries_failed_commit(#[case] landed: bool)
         }],
         ..Default::default()
     };
-    let err = engine.edit_region(region_id, edit).await.unwrap_err();
+    let (sender, receiver) = tokio::sync::oneshot::channel();
+    let edit = crate::request::RegionEditRequest::new(region_id, edit, true, sender)
+        .for_staging(partition_expr.clone());
+    engine
+        .inner
+        .workers
+        .submit_to_worker(region_id, crate::request::WorkerRequest::EditRegion(edit))
+        .await
+        .unwrap();
+    let err = receiver.await.unwrap().unwrap_err();
     assert_eq!(RetryHint::Retryable, err.retry_hint());
     assert!(region.is_staging());
     assert!(
```

**File**: `src/mito2/src/engine/close_test.rs` (modified, +134/-0)
```diff
@@ -277,3 +277,137 @@ async fn test_engine_close_region_flush_on_close_while_flushing() {
     let batches = RecordBatches::try_collect(stream).await.unwrap();
     assert_eq!(6, batches.iter().map(|b| b.num_rows()).sum::<usize>());
 }
+
+#[rstest::rstest]
+#[case::skip_wal(true, [false, false])]
+#[case::flush_on_close(false, [true, false])]
+#[tokio::test]
+async fn test_repeated_close_during_edit_preserves_flush_requirement(
+    #[case] skip_wal: bool,
+    #[case] flush_on_close: [bool; 2],
+) {
+    use crate::manifest::action::RegionEdit;
+    use crate::region::{RegionLeaderState, RegionRoleState};
+    use crate::request::{DdlRequest, SenderDdlRequest, WorkerRequest};
+    use store_api::region_request::RegionPutRequest;
+
+    let mut env = TestEnv::new().await;
+    let engine = env
+        .create_engine(MitoConfig {
+            num_workers: 1,
+            schedule_compaction_after_edit: false,
+            ..Default::default()
+        })
+        .await;
+    let region_id = RegionId::new(1, 1);
+    let other_id = RegionId::new(1, 2);
+    let create = CreateRequestBuilder::new().build();
+    let schema = rows_schema(&create);
+    for id in [region_id, other_id] {
+        engine
+            .handle_request(id, RegionRequest::Create(create.clone()))
+            .await
+            .unwrap();
+    }
+    engine
+        .handle_request(
+            region_id,
+            RegionRequest::Put(RegionPutRequest {
+                rows: Rows {
+                    schema,
+                    rows: build_rows(0, 3),
+                },
+                hint: None,
+                partition_expr_version: None,
+                skip_wal,
+            }),
+        )
+        .await
+        .unwrap();
+    let region = engine.get_region(region_id).unwrap();
+    let guard = region.manifest_ctx.manifest_manager.write().await;
+    // A removal of a nonexistent file exercises manifest serialization without fake SSTs.
+    let e = engine.clone();
+    let edit = tokio::spawn(async move {
+        e.edit_region(
+            region_id,
+            RegionEdit {
+                files_to_remove: vec![crate::sst::file::FileMeta {
+                    region_id,
+                    file_id: store_api::storage::FileId::random(),
+                    ..Default::default()
+                }],
+                ..Default::default()
+            },
+        )
+        .await
+    });
+    tokio::time::timeout(std::time::Duration::from_secs(5), async {
+        while region.state() != RegionRoleState::Leader(RegionLeaderState::Editing) {
+            tokio::task::yield_now().await;
+        }
+    })
+    .await
+    .unwrap();
+    let mut closes = Vec::new();
+    for flush_on_close in flush_on_close {
+        let (sender, receiver) = tokio::sync::oneshot::channel();
+        engine
+            .inner
+            .workers
+            .submit_to_worker(
+                region_id,
+                WorkerRequest::Ddl(SenderDdlRequest {
+                    region_id,
+                    sender: sender.into(),
+                    request: DdlRequest::Close(RegionCloseRequest { flush_on_close }),
+                }),
+            )
+            .await
+            .unwrap();
+        closes.push(receiver);
+    }
+    tokio::time::timeout(
+        std::time::Duration::from_secs(5),
+        flush_region(&engine, other_id, None),
+    )
+    .await
+    .unwrap();
+    for close in &mut closes {
+        assert!(matches!(
+            close.try_recv(),
+            Err(tokio::sync::oneshot::error::TryRecvError::Empty)
+        ));
+    }
+    drop(guard);
+    tokio::time::timeout(std::time::Duration::from_secs(5), edit)
+        .await
+        .unwrap()
+        .unwrap()
+        .unwrap();
+    for close in closes {
+        assert_eq!(
+            0,
+            tokio::time::timeout(std::time::Duration::from_secs(5), close)
+                .await
+                .unwrap()
+                .unwrap()
+                .unwrap()
+        );
+    }
+    assert!(!engine.is_region_exists(region_id));
+    // WAL replay could hide a skipped flush after reopening. Check the committed SST first.
+    assert!(!region.manifest_ctx.manifest().await.files.is_empty());
+    crate::test_util::reopen_region(&engine, region_id, create.table_dir, true, create.options)
+        .await;
+    let stream = engine
+        .scan_to_stream(region_id, ScanRequest::default())
+        .await
+        .unwrap();
+    let batches = RecordBatches::try_collect(stream).await.unwrap();
+    assert_eq!(
+        3,
+        batches.iter().map(|batch| batch.num_rows()).sum::<usize>()
+    );
+    engine.stop().await.unwrap();
+}
```

**File**: `src/mito2/src/engine/compaction_test.rs` (modified, +20/-0)
```diff
@@ -2687,6 +2687,26 @@ async fn test_enter_staging_waits_for_picking_logical_cancellation_ack() {
     assert!(!compact_task.is_finished());
     assert!(!staging_task.is_finished());
 
+    // Moving EnterStaging into the compaction scheduler must keep import admission sealed.
+    let error = tokio::time::timeout(
+        Duration::from_secs(5),
+        engine.edit_region(
+            region_id,
+            crate::manifest::action::RegionEdit {
+                files_to_add: vec![crate::sst::file::FileMeta {
+                    region_id,
+                    file_id: store_api::storage::FileId::random(),
+                    ..Default::default()
+                }],
+                ..Default::default()
+            },
+        ),
+    )
+    .await
+    .unwrap()
+    .unwrap_err();
+    assert_eq!(StatusCode::RegionBusy, error.status_code());
+
     gate_guard.release();
     let compact_err = tokio::time::timeout(Duration::from_secs(5), compact_task)
         .await
```

**File**: `src/mito2/src/engine/edit_region_test.rs` (modified, +512/-1)
```diff
@@ -1271,7 +1271,7 @@ async fn test_drop_rejects_alter_and_edit_queues_after_flush_commit() {
     });
     wait_worker_recv_event(&mut rx).await;
 
-    // The first ALTER waits in the flush scheduler; the second uses pending_alters.
+    // The first ALTER waits in the flush scheduler; the second uses pending_ddls.
     let mut alters = Vec::new();
     for _ in 0..2 {
         let e = engine.clone();
@@ -1321,3 +1321,514 @@ async fn test_drop_rejects_alter_and_edit_queues_after_flush_commit() {
     .await
     .expect("DROP left queued ALTER or edit requests unresolved");
 }
+
+/// Submits without awaiting the reply so a test can observe a deferred control request.
+async fn submit_control(
+    engine: &MitoEngine,
+    region_id: RegionId,
+    request: crate::request::DdlRequest,
+) -> oneshot::Receiver<crate::error::Result<store_api::region_request::AffectedRows>> {
+    let (sender, receiver) = oneshot::channel();
+    engine
+        .inner
+        .workers
+        .submit_to_worker(
+            region_id,
+            WorkerRequest::Ddl(crate::request::SenderDdlRequest {
+                region_id,
+                request,
+                sender: sender.into(),
+            }),
+        )
+        .await
+        .unwrap();
+    receiver
+}
+
+#[tokio::test]
+async fn test_edit_retirement_rejects_pending_requests() {
+    use crate::request::DdlRequest;
+    use store_api::region_request::RegionFlushRequest;
+
+    let mut env = TestEnv::new().await;
+    let engine = env
+        .create_engine(MitoConfig {
+            num_workers: 1,
+            schedule_compaction_after_edit: false,
+            ..Default::default()
+        })
+        .await;
+    let region_id = RegionId::new(1, 1);
+    let other_id = RegionId::new(1, 2);
+    for id in [region_id, other_id] {
+        engine
+            .handle_request(
+                id,
+                RegionRequest::Create(CreateRequestBuilder::new().build()),
+            )
+            .await
+            .unwrap();
+    }
+    let region = engine.get_region(region_id).unwrap();
+    let mut guard = region.manifest_ctx.manifest_manager.write().await;
+    let e = engine.clone();
+    let edit = tokio::spawn(async move {
+        e.edit_region(region_id, test_region_edit(region_id, FileId::random()))
+            .await
+    });
+    wait_until_region_is_in_editing(&region).await;
+    let mut flush = submit_control(
+        &engine,
+        region_id,
+        DdlRequest::Flush(RegionFlushRequest::default()),
+    )
+    .await;
+    let (sender, queued_edit) = oneshot::channel();
+    engine
+        .inner
+        .workers
+        .submit_to_worker(
+            region_id,
+            WorkerRequest::EditRegion(RegionEditRequest::new(
+                region_id,
+                test_region_edit(region_id, FileId::random()),
+                true,
+                sender,
+            )),
+        )
+        .await
+        .unwrap();
+    tokio::time::timeout(
+        Duration::from_secs(5),
+        crate::test_util::flush_region(&engine, other_id, None),
+    )
+    .await
+    .unwrap();
+    assert!(matches!(
+        flush.try_recv(),
+        Err(oneshot::error::TryRecvError::Empty)
+    ));
+
+    // A stopped manager without reload pending forces edit completion to retire the region
+    // and return early. Its queued requests must finish without another dispatch notification.
+    guard.stop().await;
+    drop(guard);
+    tokio::time::timeout(Duration::from_secs(5), edit)
+        .await
+        .unwrap()
+        .unwrap()
+        .unwrap_err();
+    let error = tokio::time::timeout(Duration::from_secs(5), flush)
+        .await
+        .unwrap()
+        .unwrap()
+        .unwrap_err();
+    assert_eq!(StatusCode::RegionNotFound, error.status_code());
+    let error = tokio::time::timeout(Duration::from_secs(5), queued_edit)
+        .await
+        .unwrap()
+        .unwrap()
+        .unwrap_err();
+    assert_eq!(StatusCode::RegionNotFound, error.status_code());
+    assert!(!engine.is_region_exists(region_id));
+    engine.stop().await.unwrap();
+}
+
+#[tokio::test]
+async fn test_repartition_flush_waits_for_region_edit() {
+    use crate::request::DdlRequest;
+    use store_api::region_request::{RegionFlushReason, RegionFlushRequest};
+
+    let mut env = TestEnv::new().await;
+    let engine = env
+        .create_engine(MitoConfig {
+            num_workers: 1,
+            schedule_compaction_after_edit: false,
+            ..Default::default()
+        })
+        .await;
+    let region_id = RegionId::new(1, 1);
+    let other_id = RegionId::new(1, 2);
+    for id in [region_id, other_id] {
+        engine
+            .handle_request(
+                id,
+                RegionRequest::Create(CreateRequestBuilder::new().build()),
+            )
+            .await
+            .unwrap();
+    }
+    let region = engine.get_region(region_id).unwrap();
+    let guard = region.manifest_ctx.manifest_manage
```

**File**: `src/mito2/src/engine/object_store_wal_test.rs` (modified, +54/-6)
```diff
@@ -877,10 +877,32 @@ async fn test_end_of_staging_after_deadline_sends_nothing() {
         .handle_request(region_id, enter_staging_request())
         .await
         .unwrap();
+    let partition_expr = region
+        .manifest_ctx
+        .staging_partition_info()
+        .unwrap()
+        .partition_expr()
+        .unwrap()
+        .to_string();
+    let (sender, receiver) = oneshot::channel();
     engine
-        .edit_region(region_id, edit_files(vec![file.as_ref().clone()], vec![]))
+        .inner
+        .workers
+        .submit_to_worker(
+            region_id,
+            WorkerRequest::EditRegion(
+                RegionEditRequest::new(
+                    region_id,
+                    edit_files(vec![file.as_ref().clone()], vec![]),
+                    false,
+                    sender,
+                )
+                .for_staging(partition_expr),
+            ),
+        )
         .await
         .unwrap();
+    receiver.await.unwrap().unwrap();
     let version = next_manifest_version(&region).await;
 
     engine.freeze_lease_clock(deadline);
@@ -1187,7 +1209,10 @@ async fn test_reload_ignores_edit_of_replaced_instance() {
     plugins.insert::<RegionHookRef>(hook.clone());
     let engine = env
         .create_engine_with_log_store_and_plugins(
-            MitoConfig::default(),
+            MitoConfig {
+                num_workers: 1,
+                ..Default::default()
+            },
             new_log_store().await,
             plugins,
         )
@@ -1212,6 +1237,8 @@ async fn test_reload_ignores_edit_of_replaced_instance() {
     };
     let added = file(FileId::random());
 
+    let barrier_region_id = RegionId::new(1, 2);
+    create_leased_region_on(&engine, barrier_region_id).await;
     hook.armed.store(true, Ordering::Relaxed);
     let committed = {
         let engine = engine.clone();
@@ -1228,9 +1255,8 @@ async fn test_reload_ignores_edit_of_replaced_instance() {
         .submit_to_worker(region_id, request)
         .await
         .unwrap();
-    // The worker queues the edit before it handles the flush request sent after it.
-    let flush = RegionRequest::Flush(RegionFlushRequest::default());
-    engine.handle_request(region_id, flush).await.unwrap_err();
+    // An empty flush on the same worker acknowledges receipt without waiting for this edit.
+    flush_region(&engine, barrier_region_id, None).await;
     let region_dir = region_dir_from_table_dir(&table_dir, region_id, PathType::Bare);
     let version = next_manifest_version(&old).await;
     let removal = RegionMetaActionList::with_action(RegionMetaAction::Edit(edit_files(
@@ -1406,10 +1432,32 @@ async fn test_end_of_staging_conflict_reloads_region() {
         .handle_request(region_id, enter_staging_request())
         .await
         .unwrap();
+    let partition_expr = old
+        .manifest_ctx
+        .staging_partition_info()
+        .unwrap()
+        .partition_expr()
+        .unwrap()
+        .to_string();
+    let (sender, receiver) = oneshot::channel();
     engine
-        .edit_region(region_id, edit_files(vec![file.as_ref().clone()], vec![]))
+        .inner
+        .workers
+        .submit_to_worker(
+            region_id,
+            WorkerRequest::EditRegion(
+                RegionEditRequest::new(
+                    region_id,
+                    edit_files(vec![file.as_ref().clone()], vec![]),
+                    false,
+                    sender,
+                )
+                .for_staging(partition_expr),
+            ),
+        )
         .await
         .unwrap();
+    receiver.await.unwrap().unwrap();
     let region_dir = region_dir_from_table_dir(&table_dir, region_id, PathType::Bare);
     let version = next_manifest_version(&old).await;
     let store = env.get_object_store().unwrap();
```

**File**: `src/mito2/src/engine/staging_test.rs` (modified, +195/-53)
```diff
@@ -749,22 +749,14 @@ async fn test_staging_exit_success_with_manifests_with_format(flat_format: bool)
 
     let region = engine.get_region(region_id).unwrap();
     for (file, expected) in source_files.into_iter().zip([11, 12]) {
-        engine
-            .edit_region(
-                region_id,
-                RegionEdit {
-                    files_to_add: vec![file.as_ref().clone()],
-                    files_to_remove: vec![],
-                    timestamp_ms: None,
-                    compaction_time_window: None,
-                    flushed_entry_id: None,
-                    flushed_sequence: None,
-                    committed_sequence: None,
-                    wal_recovery: Default::default(),
-                },
-            )
-            .await
-            .unwrap();
+        submit_staging_edit(
+            &engine,
+            region_id,
+            file.as_ref().clone(),
+            partition_expr.clone(),
+        )
+        .await
+        .unwrap();
         let current = region.version_control.current();
         assert_eq!(current.last_sequence, expected);
         assert_eq!(current.committed_sequence, 10);
@@ -1560,14 +1552,26 @@ fn edit_adding(file: FileMeta) -> RegionEdit {
     }
 }
 
-/// Spawns an edit importing `file`.
+/// Spawns an edit importing `file`, retaining the current staging binding when present.
 fn spawn_edit(
     engine: &MitoEngine,
     region_id: RegionId,
     file: FileMeta,
 ) -> tokio::task::JoinHandle<crate::error::Result<()>> {
     let edit_engine = engine.clone();
-    tokio::spawn(async move { edit_engine.edit_region(region_id, edit_adding(file)).await })
+    let partition_expr = engine
+        .get_region(region_id)
+        .unwrap()
+        .manifest_ctx
+        .staging_partition_info()
+        .and_then(|info| info.partition_expr().map(ToOwned::to_owned));
+    tokio::spawn(async move {
+        if let Some(partition_expr) = partition_expr {
+            submit_staging_edit(&edit_engine, region_id, file, partition_expr).await
+        } else {
+            edit_engine.edit_region(region_id, edit_adding(file)).await
+        }
+    })
 }
 
 /// Starts an edit importing `file` and waits until the region is `Editing`.
@@ -1905,22 +1909,14 @@ async fn test_successful_staging_end_keeps_rows_of_rejected_flush() {
         .unwrap_err();
 
     let imported_file = first_file(&engine.get_region(region_id).unwrap()).await;
-    engine
-        .edit_region(
-            region_id,
-            RegionEdit {
-                files_to_add: vec![imported_file],
-                files_to_remove: vec![],
-                timestamp_ms: None,
-                compaction_time_window: None,
-                flushed_entry_id: None,
-                flushed_sequence: None,
-                committed_sequence: None,
-                wal_recovery: Default::default(),
-            },
-        )
-        .await
-        .unwrap();
+    submit_staging_edit(
+        &engine,
+        region_id,
+        imported_file,
+        float_range_expr("field_0", 0., 100.).as_json_str().unwrap(),
+    )
+    .await
+    .unwrap();
     engine
         .set_region_role_state_gracefully(region_id, SettableRegionRoleState::Leader)
         .await
@@ -2010,7 +2006,7 @@ impl EventListener for RequestCountListener {
 }
 
 #[tokio::test]
-async fn test_edit_returns_to_staging_after_staging_leader_role() {
+async fn test_unbound_edit_rejected_after_staging_leader_role() {
     let mut env = TestEnv::new().await;
     let engine = env.create_engine(MitoConfig::default()).await;
     let region_id = RegionId::new(1024, 0);
@@ -2029,8 +2025,11 @@ async fn test_edit_returns_to_staging_after_staging_leader_role() {
 
     let region = engine.get_region(region_id).unwrap();
     let file = first_file(&region).await;
-    spawn_edit(&engine, region_id, file).await.unwrap().unwrap();
-
+    let err = spawn_edit(&engine, region_id, file)
+        .await
+        .unwrap()
+        .unwrap_err();
+    assert_matches!(err, Error::RejectWriteInStaging { .. });
     assert!(region.is_staging());
 }
 
@@ -2360,22 +2359,14 @@ async fn test_close_after_end_of_staging_is_queued_keeps_committed_result() {
     put_range(&engine, region_id, &schema, (3, 5)).await;
     let region = engine.get_region(region_id).unwrap();
     let file = first_file(&region).await;
-    engine
-        .edit_region(
-            region_id,
-            RegionEdit {
-                files_to_add: vec![file],
-                files_to_remove: vec![],
-                timestamp_ms: None,
-                compaction_time_window: None,
-                flushed_entry_id: None,
-                flushed_sequence: None,
-                committed_sequence: None,
-                wal_recovery: Default::default(),
-            },
-        )
-        .await
-        .unwrap();
+    submit_staging_edit(
+        &engine,
+        region_id,
+        file,
+        float_range_expr("field_0", 0., 100.).as_json_str().u
```

#### Recent Merged Pull Requests:
- **PR #10434** (2026-11-13): fix(auth): backport physical metric permission targets to v1.3 (@WenyXu)
- **PR #10419** (2026-11-13): perf(mito-codec): index sparse label columns by id once at bind time (@discord9)
- **PR #10417** (2026-11-13): feat(common-meta): make RDS metadata backends closable (@WenyXu)
- **PR #10415** (2026-11-13): fix(frontend): classify physical entity graph sources [Backport release/v1.3] (@MichaelScofield)
- **PR #10410** (2026-11-13): fix(function): handle unaligned binary vector literals [Backport release/v1.3] (@MichaelScofield)
- **PR #10407** (closed): perf(promql): advance both binary operands in turn (@discord9)

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

## X. mito2): commit staging edits once when staging ends (#10322)

**RULE**:
When implementing operations in `src/mito2/AGENTS.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in GreptimeTeam/greptimedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9f6c957e`: mito2): commit staging edits once when staging ends (#10322). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/mito2/AGENTS.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- Manifest version is monotonic — never reset or skip it. Staging takes no version:
  its actions stay in memory (`manifest/manager.rs`) and are committed once, as the
  next version, when staging ends (`MitoRegion::end_staging_locked`).
- Staging regions, ending staging included, never flush: a flush would stage its SST and
  release the rows' WAL, losing them if staging does not end successfully. Every flush
  trigger in `worker/handle_flush.rs` must skip them: background triggers test `is_writable()`
  and `is_staging()`, a flush request `is_flushable()` and `is_staging()` (`is_writable()` and
  `is_flushable()` are false while ending staging). `handle_close` leaves staging first.
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
- Manifest version is monotonic — never reset or skip it.
- Staging regions never flush: a flush would move rows into the staging manifest and
  release their WAL, losing them if staging does not end successfully. Every flush
  trigger in `worker/handle_flush.rs` must skip them, and `handle_close` leaves staging first.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9f6c957e` are properly handled with clean fallback behavior.
