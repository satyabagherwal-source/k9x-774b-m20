# Domain G — Architecture Intelligence: Architecture Intelligence: GreptimeTeam/greptimedb Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "GreptimeTeam/greptimedb",
  "source_url": "https://github.com/GreptimeTeam/greptimedb",
  "source_version": "48aa0ed3",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T10:51:40.017Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-greptimeteam-greptimedb",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [GreptimeTeam/greptimedb](https://github.com/GreptimeTeam/greptimedb) (Revision: `48aa0ed3`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T10:51:40.017Z`  
> **Learning ID**: `learn-github-greptimeteam-greptimedb`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), K (Quality & Verification Intelligence), I (Content & Information Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), B (Product Intelligence), J (Search & Distribution Intelligence), A (Human & Need Intelligence)
- **Confidence Rating**: 59%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from GreptimeTeam/greptimedb:

# Forensic Learning Record (Deep Inspection): GreptimeTeam/greptimedb

> **Canonical Artifact**: `07_PROJECT_LEARNING/greptimeteam-greptimedb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/GreptimeTeam/greptimedb](https://github.com/GreptimeTeam/greptimedb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-17T10:51:38.860Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GreptimeTeam/greptimedb`
- **Description**: The open-source observability database. One columnar engine for metrics, logs, and traces, on object storage.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6815 stars

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
- **Issue #10479** (2026-11-17): **fix(test): render the schema view in the quantile fold test**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  Follow-up to #10202 (native tree as plan lines) and #10433 (the quantile fold test).  ## What's changed and what's your intention?  `native_fused_quantile_is_never_folded_per_partition` fails on a clean `narthex` (`7ba85f6369b`):  ``` the quantile must not be split: ... (the statement text the test looks for is gone) ```  `#10202` changed what `display_indent` renders — plan lines with per-node metrics, without the statement. The test's last assertion checks that the statement is still named by the quantile it wrote (`quantile(0.5, some_metric)`), which is a property of the statement, not of the plan lines.  Fix: read `display_indent_schema` for that assertion, which still renders the statement.  This is the only call site in the file that depends on statement text; the other `~100` `display_indent` uses assert plan structure and are unaffected.  **Every PR based on `narthex` currently fails this test**, which is why this is a standalone one-line fix rather than something folded into another PR.  ### Verification  - `cargo nextest run -p query -E 'test(native_fused_quantile_is_never_folded_per_partition)'` → 1/1 passed.  ## PR Checklist Please convert it to a draft if some of the following conditions are not met.  - [ ] I have written the necessary rustdoc comments. - [x] I have added the necessary unit tests and in

- **Issue #10469** (2026-11-17): **fix(test): stop requiring every scan partition to be non-empty**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  Same class as #10466: a test that asserts a plan property the uniform topology (#10418) no longer guarantees.  ## What's changed and what's your intention?  `test_remote_write_v2_histogram_native_partitions` asserts that each of the four scan partitions reports at least one `native.root.output_values`. It fails on `narthex`:  ``` empty native output partition: {0: 0, 1: 3, 2: 3, 3: 2} ```  `SeriesRepartitionExec` routes a series by hashing its **label set** with `XxHash64` (see `series_repartition.rs`), so eight series over four partitions can legitimately leave one empty — with four buckets and eight items the chance of an empty bucket is about 10%. The fixture used to hash evenly; after the topology changes it does not.  So the assertion was checking a property of the hash, not of the topology. The test's actual intent — visible in its own comment — is that the fused producer runs on several partitions and that the merge is exercised.  This replaces "every partition non-empty" with:  - `non_empty >= 2` — more than one partition must actually run, otherwise there is nothing to merge and the test proves nothing; - `sum == 8` — every series must still produce exactly one value, so routing cannot lose data.  The existing `partitions.len() == 4` check stays.  ### Verification  - `cargo nextest run -p tests-integration 

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

### Incident Patch 1: `dd941a8e` (2026-11-16)
**Commit Message**: fix(mito2): wait for a stopped region's checkpoint before reopening it (#10376)

* fix(mito2): wait for a stopped region's checkpoint before reopening it

A region's manifest checkpoint runs as a background task that writes the
checkpoint, then `_last_checkpoint`, then deletes older manifest files:
the deltas up to the previous checkpoint, or every older delta at the
region's first checkpoint. Stopping the manifest manager does not wait
for it, so a new instance of the region could read the manifest while the
old task still wrote it. On a store that writes files in place the open
could read an empty `_last_checkpoint`. On any store, an open that found
no checkpoint could have deltas it had just listed deleted by the first
checkpoint's cleanup.

Wait for the stopped instance's checkpoint at engine stop, after the
worker loop ends, and before a fenced region is reloaded. The wait does
not hold the manifest lock, which the worker may take meanwhile: the
checkpoint task owns the sender of a watch channel, which closes however
the task ends.

Fixes the flaky test_change_region_compaction_window (#7135).

Signed-off-by: jeremyhi <[REDACTED_EMAIL]>

* test(mito2): cover the checkpoint wai

**File**: `src/mito2/src/engine/close_test.rs` (modified, +77/-2)
```diff
@@ -14,20 +14,22 @@
 
 use std::sync::Arc;
 use std::sync::atomic::Ordering;
+use std::time::Duration;
 
 use api::v1::Rows;
 use common_base::Plugins;
 use common_recordbatch::RecordBatches;
 use store_api::region_engine::RegionEngine;
-use store_api::region_request::{RegionCloseRequest, RegionRequest};
+use store_api::region_request::{PathType, RegionCloseRequest, RegionOpenRequest, RegionRequest};
 use store_api::storage::{RegionId, ScanRequest};
 
 use crate::config::MitoConfig;
 use crate::engine::flush_test::MockRegionHook;
 use crate::engine::listener::AlterFlushListener;
 use crate::engine::region_hook::RegionHookRef;
 use crate::test_util::{
-    CreateRequestBuilder, TestEnv, build_rows, flush_region, put_rows, rows_schema,
+    CheckpointTaskBlocker, CreateRequestBuilder, TestEnv, build_rows, flush_region, put_rows,
+    rows_schema,
 };
 
 #[tokio::test]
@@ -411,3 +413,76 @@ async fn test_repeated_close_during_edit_preserves_flush_requirement(
     );
     engine.stop().await.unwrap();
 }
+
+#[tokio::test(flavor = "multi_thread")]
+async fn test_engine_stop_waits_for_checkpoint() {
+    let (blocker, mock_layer) = CheckpointTaskBlocker::block_last_checkpoint_write();
+    let mut env = TestEnv::with_prefix("stop-waits-for-checkpoint")
+        .await
+        .with_mock_layer(mock_layer);
+    let config = MitoConfig {
+        manifest_checkpoint_distance: 1,
+        ..Default::default()
+    };
+    let engine = env.create_engine(config.clone()).await;
+    let region_id = RegionId::new(1, 1);
+    let request = CreateRequestBuilder::new().build();
+    let table_dir = request.table_dir.clone();
+    let column_schemas = rows_schema(&request);
+    engine
+        .handle_request(region_id, RegionRequest::Create(request))
+        .await
+        .unwrap();
+    put_rows(
+        &engine,
+        region_id,
+        Rows {
+            schema: column_schemas,
+            rows: build_rows(0, 3),
+        },
+    )
+    .await;
+    // The flush starts a checkpoint, which blocks after it has created `_last_checkpoint`
+    // and before it has written the pointer.
+    flush_region(&engine, region_id, None).await;
+    blocker.wait_until_blocked().await;
+    let wait_started = engine
+        .get_region(region_id)
+        .unwrap()
+        .manifest_ctx
+        .manifest_manager
+        .read()
+        .await
+        .checkpointer()
+        .pending_checkpoint_wait_started();
+
+    let mut reopen = tokio::spawn(async move {
+        let engine = env.reopen_engine(engine, config).await;
+        let open = RegionRequest::Open(RegionOpenRequest {
+            engine: String::new(),
+            table_dir,
+            path_type: PathType::Bare,
+            options: Default::default(),
+            skip_wal_replay: false,
+            checkpoint: None,
+            requirements: Default::default(),
+        });
+        let result = engine.handle_request(region_id, open).await;
+        (env, result)
+    });
+    tokio::time::timeout(Duration::from_secs(10), wait_started.notified())
+        .await
+        .expect("the engine stop does not wait for the checkpoint");
+    // The new engine would read the empty pointer while the old checkpoint is blocked.
+    assert!(
+        tokio::time::timeout(Duration::from_millis(500), &mut reopen)
+            .await
+            .is_err()
+    );
+    blocker.release();
+    let (_env, result) = tokio::time::timeout(Duration::from_secs(10), reopen)
+        .await
+        .unwrap()
+        .unwrap();
+    result.unwrap();
+}
```

**File**: `src/mito2/src/engine/object_store_wal_test.rs` (modified, +43/-0)
```diff
@@ -1092,6 +1092,49 @@ async fn test_reload_waits_for_held_upload() {
     assert_eq!(3, count_rows(&engine, region_id).await);
 }
 
+#[tokio::test]
+async fn test_reload_waits_for_running_checkpoint() {
+    let (blocker, layer) = CheckpointTaskBlocker::block_last_checkpoint_write();
+    let mut env = TestEnv::with_prefix("reload-waits-for-running-checkpoint")
+        .await
+        .with_mock_layer(layer);
+    let region_id = RegionId::new(1, 1);
+    let (engine, _log_store, _, schema, _) = create_leased_region(&mut env, region_id).await;
+    put_range(&engine, region_id, &schema, 0, 3).await;
+    // The flush starts a checkpoint, which blocks after it has created `_last_checkpoint`
+    // and before it has written the pointer.
+    flush_region(&engine, region_id, None).await;
+    blocker.wait_until_blocked().await;
+    let old = engine.get_region(region_id).unwrap();
+    let wait_started = old
+        .manifest_ctx
+        .manifest_manager
+        .read()
+        .await
+        .checkpointer()
+        .pending_checkpoint_wait_started();
+    fence(&old).await;
+
+    notify_fenced(&engine, region_id).await;
+    tokio::time::timeout(Duration::from_secs(10), wait_started.notified())
+        .await
+        .expect("the reload does not wait for the checkpoint");
+    // The worker takes the manifest lock of the fenced instance, for example to close it,
+    // while the reload waits.
+    let manager = tokio::time::timeout(
+        Duration::from_secs(10),
+        old.manifest_ctx.manifest_manager.write(),
+    )
+    .await
+    .expect("the reload holds the manifest lock while it waits");
+    drop(manager);
+    assert!(!is_replaced(&engine, &old));
+    blocker.release();
+
+    wait_until(|| is_replaced(&engine, &old)).await;
+    assert_eq!(3, count_rows(&engine, region_id).await);
+}
+
 #[tokio::test]
 async fn test_reload_waits_for_running_flush() {
     let mut env = TestEnv::with_prefix("reload-waits-for-flush").await;
```

**File**: `src/mito2/src/manifest/checkpointer.rs` (modified, +52/-7)
```diff
@@ -22,6 +22,7 @@ use store_api::storage::RegionId;
 use store_api::{MIN_VERSION, ManifestVersion};
 #[cfg(test)]
 use tokio::sync::Notify;
+use tokio::sync::watch;
 
 use crate::error::Result;
 use crate::manifest::action::{RegionCheckpoint, RegionManifest};
@@ -34,11 +35,19 @@ use crate::metrics::MANIFEST_OP_ELAPSED;
 pub(crate) struct Checkpointer {
     manifest_options: RegionManifestOptions,
     inner: Arc<Inner>,
-    checkpoint_task: Option<JoinHandle<()>>,
+    checkpoint_task: Option<CheckpointTask>,
     #[cfg(test)]
     pending_checkpoint_wait_started: Arc<Notify>,
 }
 
+/// A spawned checkpoint task and the signal that it has ended.
+#[derive(Debug)]
+struct CheckpointTask {
+    handle: JoinHandle<()>,
+    /// Closes when the task ends, so that it can be awaited without borrowing the checkpointer.
+    done: watch::Receiver<()>,
+}
+
 #[derive(Debug)]
 struct Inner {
     region_id: RegionId,
@@ -142,7 +151,7 @@ impl Checkpointer {
         if self
             .checkpoint_task
             .as_ref()
-            .is_some_and(|handle| !handle.is_finished())
+            .is_some_and(|task| !task.handle.is_finished())
         {
             return;
         }
@@ -187,24 +196,51 @@ impl Checkpointer {
 
     fn do_checkpoint(&mut self, checkpoint: RegionCheckpoint) {
         let inner = self.inner.clone();
-        self.checkpoint_task = Some(common_runtime::spawn_global(async move {
+        let (done_sender, done) = watch::channel(());
+        let handle = common_runtime::spawn_global(async move {
+            // The sender is dropped however the task ends, which closes the channel.
+            let _done_sender = done_sender;
             inner.do_checkpoint(checkpoint).await;
-        }));
+        });
+        self.checkpoint_task = Some(CheckpointTask { handle, done });
+    }
+
+    /// Returns a future that resolves once the checkpoint task running now has ended.
+    ///
+    /// Unlike [Self::wait_for_pending_checkpoint], which borrows the checkpointer mutably and reaps
+    /// the task handle, this does neither, so the caller can await the future without holding the
+    /// manifest lock.
+    pub(crate) fn pending_checkpoint_completion(&self) -> impl Future<Output = ()> + Send + use<> {
+        let done = self.checkpoint_task.as_ref().map(|task| task.done.clone());
+        let region_id = self.inner.region_id();
+        #[cfg(test)]
+        let wait_started = self.pending_checkpoint_wait_started.clone();
+        async move {
+            // The channel is closed once the task has ended.
+            let Some(mut done) = done.filter(|receiver| receiver.has_changed().is_ok()) else {
+                return;
+            };
+            #[cfg(test)]
+            wait_started.notify_one();
+            info!("Waiting for the pending checkpoint of region {}", region_id);
+            // Nothing is ever sent, so this returns once the task drops the sender.
+            let _ = done.changed().await;
+        }
     }
 
     /// Waits for the current checkpoint task without removing its handle first.
     ///
     /// Keeping the handle in `self` while awaiting is important. If the caller is
     /// cancelled, another lifecycle transition can still wait for the same task.
     pub(crate) async fn wait_for_pending_checkpoint(&mut self) {
-        let Some(handle) = self.checkpoint_task.as_mut() else {
+        let Some(task) = self.checkpoint_task.as_mut() else {
             return;
         };
 
         #[cfg(test)]
         self.pending_checkpoint_wait_started.notify_one();
 
-        let result = (&mut *handle).await;
+        let result = (&mut task.handle).await;
         // There is no cancellation point between observing completion and
         // clearing the handle.
         self.checkpoint_task = None;
@@ -218,7 +254,16 @@ impl Checkpointer {
     pub(crate) fn is_doing_checkpoint(&self) -> bool {
         self.checkpoint_task
             .as_ref()
-            .is_some_and(|handle| !handle.is_finished())
+            .is_some_and(|task| !task.handle.is_finished())
+    }
+
+    #[cfg(test)]
+    pub(crate) fn abort_checkpoint_task(&self) {
+        self.checkpoint_task
+            .as_ref()
+            .expect("checkpoint task must exist")
+            .handle
+            .abort();
     }
 
     #[cfg(test)]
```

**File**: `src/mito2/src/manifest/manager.rs` (modified, +13/-1)
```diff
@@ -442,7 +442,12 @@ impl RegionManifestManager {
         Ok(Some(manager))
     }
 
-    /// Stops the manager.
+    /// Stops the manager. A stopped manager takes no update and starts no checkpoint, but a
+    /// checkpoint already running keeps writing the manifest directory until it ends.
+    ///
+    /// A caller that hands the storage to another instance waits for that checkpoint with
+    /// `pending_checkpoint_completion` after the stop, as engine stop and reload do. Close and
+    /// drop, which run in the region worker loop, deliberately do not.
     pub async fn stop(&mut self) {
         self.stopped = true;
     }
@@ -849,6 +854,13 @@ impl RegionManifestManager {
         self.checkpointer.wait_for_pending_checkpoint().await;
     }
 
+    /// Returns a future that resolves once the in-flight checkpoint has finished, including its
+    /// cleanup. Unlike [Self::wait_for_pending_checkpoint], which borrows the manager mutably and
+    /// reaps the task handle, this does neither.
+    pub(crate) fn pending_checkpoint_completion(&self) -> impl Future<Output = ()> + Send + use<> {
+        self.checkpointer.pending_checkpoint_completion()
+    }
+
     /// Clear deleted files from manifest's `removed_files` field without update version. Notice if datanode exit before checkpoint then new manifest by open region may still contain these deleted files, which is acceptable for gc process.
     pub fn clear_deleted_files(&mut self, deleted_files: Vec<RemovedFile>) {
         let mut manifest = (*self.manifest()).clone();
```

**File**: `src/mito2/src/manifest/tests/checkpoint.rs` (modified, +128/-1)
```diff
@@ -14,7 +14,7 @@
 
 use std::assert_matches;
 use std::sync::Arc;
-use std::sync::atomic::{AtomicUsize, Ordering};
+use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
 use std::time::Duration;
 
 use common_datasource::compression::CompressionType;
@@ -25,6 +25,7 @@ use object_store::layers::mock::{
 };
 use store_api::storage::{FileId, RegionId};
 use strum::IntoEnumIterator;
+use tokio::sync::Notify;
 
 use crate::error::Error::{ChecksumMismatch, ManifestDeltaNotFound};
 use crate::manifest::action::{
@@ -828,6 +829,132 @@ async fn completed_checkpoint_is_reaped_before_scheduling_the_next_one() {
     assert_eq!(2, manager.checkpointer().last_checkpoint_version());
 }
 
+#[rstest::rstest]
+#[case::cleanup_finished(false)]
+#[case::task_aborted(true)]
+#[tokio::test]
+async fn pending_checkpoint_completion_waits_until_the_task_ends(#[case] abort: bool) {
+    let (blocker, mock_layer) = CheckpointTaskBlocker::block_cleanup();
+    let env = TestEnv::new().await.with_mock_layer(mock_layer);
+    let metadata = Arc::new(basic_region_metadata());
+    let mut manager = env
+        .create_manifest_manager(CompressionType::Uncompressed, 1, Some(metadata))
+        .await
+        .unwrap()
+        .unwrap();
+
+    manager.update(nop_action(), false).await.unwrap();
+    tokio::time::timeout(Duration::from_secs(5), blocker.wait_until_blocked())
+        .await
+        .expect("checkpoint cleanup did not start");
+
+    // Two waiters stay on their own tasks until the checkpoint ends; a third is cancelled.
+    let waiters = [
+        manager.pending_checkpoint_completion(),
+        manager.pending_checkpoint_completion(),
+    ]
+    .map(tokio::spawn);
+    let mut cancelled = Box::pin(manager.pending_checkpoint_completion());
+    assert!(
+        tokio::time::timeout(Duration::from_millis(100), &mut cancelled)
+            .await
+            .is_err(),
+        "the cancelled wait ended before the checkpoint cleanup"
+    );
+    drop(cancelled);
+    assert!(
+        waiters.iter().all(|waiter| !waiter.is_finished()),
+        "a spawned wait ended before the checkpoint cleanup"
+    );
+    // The cleanup stays blocked in the abort case, so only the abort can end the task.
+    if abort {
+        manager.checkpointer().abort_checkpoint_task();
+    } else {
+        blocker.release();
+    }
+    for waiter in waiters {
+        tokio::time::timeout(Duration::from_secs(5), waiter)
+            .await
+            .expect("the wait did not end with the checkpoint task")
+            .unwrap();
+    }
+    let wait_started = manager.checkpointer().pending_checkpoint_wait_started();
+    // Consumes the permit the waiters above left.
+    let _ = tokio::time::timeout(Duration::ZERO, wait_started.notified()).await;
+    tokio::time::timeout(Duration::ZERO, manager.pending_checkpoint_completion())
+        .await
+        .expect("a wait after the checkpoint task ended did not return at once");
+    assert!(
+        tokio::time::timeout(Duration::ZERO, wait_started.notified())
+            .await
+            .is_err(),
+        "a wait after the checkpoint task ended started waiting"
+    );
+}
+
+/// Panics on the first delete, which a checkpoint issues in its cleanup, once released.
+struct PanickingDeleter {
+    entered: Arc<Notify>,
+    release: Arc<Notify>,
+    panicked: Arc<AtomicBool>,
+}
+
+impl oio::Delete for PanickingDeleter {
+    async fn delete(&mut self, _path: &str, _args: OpDelete) -> MockResult<()> {
+        self.entered.notify_one();
+        self.release.notified().await;
+        self.panicked.store(true, Ordering::Relaxed);
+        panic!("mock manifest delete panic");
+    }
+
+    async fn close(&mut self) -> MockResult<()> {
+        Ok(())
+    }
+}
+
+#[tokio::test]
+async fn pending_checkpoint_completion_ends_when_the_task_panics() {
+    let entered = Arc::new(Notify::new());
+    let release = Arc::new(Notify::new());
+    let panicked = Arc::new(AtomicBool::new(false));
+    let (factory_entered, factory_release, factory_panicked) =
+        (entered.clone(), release.clone(), panicked.clone());
+    let mock_layer = MockLayerBuilder::default()
+        .deleter_factory(Arc::new(move |_inner| {
+            Box::new(PanickingDeleter {
+                entered: factory_entered.clone(),
+                release: factory_release.clone(),
+                panicked: factory_panicked.clone(),
+            })
+        }))
+        .build()
+        .unwrap();
+    let env = TestEnv::new().await.with_mock_layer(mock_layer);
+    let metadata = Arc::new(basic_region_metadata());
+    let mut manager = env
+        .create_manifest_manager(CompressionType::Uncompressed, 1, Some(metadata))
+        .await
+        .unwrap()
+        .unwrap();
+
+    manager.update(nop_action(), false).await.unwrap();
+    tokio::time::timeout(Duration::from_secs(5), entered.notified())
+        .await
+        .expect("checkpoint cleanup did not start");
+    let mut done = Box::pi
```

**File**: `src/mito2/src/region.rs` (modified, +15/-0)
```diff
@@ -1528,6 +1528,21 @@ impl ManifestContext {
         self.manifest_manager.read().await.has_update().await
     }
 
+    /// Waits for the in-flight checkpoint of a stopped manager. A stopped manager starts no
+    /// checkpoint, so this instance no longer writes the manifest directory afterwards.
+    ///
+    /// Callers must not hold the manifest lock: this takes its read lock, and the lock is not
+    /// reentrant. Under the lock, use [RegionManifestManager::wait_for_pending_checkpoint]
+    /// instead. The wait itself holds no lock.
+    pub(crate) async fn wait_for_checkpoint_after_stop(&self) {
+        let done = {
+            let manager = self.manifest_manager.read().await;
+            debug_assert!(manager.is_stopped());
+            manager.pending_checkpoint_completion()
+        };
+        done.await;
+    }
+
     /// Returns the current region role state.
     pub(crate) fn current_state(&self) -> RegionRoleState {
         self.state.load()
```

**File**: `src/mito2/src/worker.rs` (modified, +10/-1)
```diff
@@ -1847,10 +1847,19 @@ impl<S> RegionWorkerLoop<S> {
         }
         // Closes remaining regions.
         let regions = self.regions.list_regions();
-        for region in regions {
+        for region in &regions {
             region.deactivate_region_manifest_size_metric();
             region.stop().await;
         }
+        // Another engine may open these regions from the same storage after the stop. Regions
+        // closed earlier are not waited for; a datanode or standalone shutdown closes every region
+        // first, so there this only covers regions whose close failed.
+        join_all(
+            regions
+                .iter()
+                .map(|region| region.manifest_ctx.wait_for_checkpoint_after_stop()),
+        )
+        .await;
 
         self.regions.clear();
     }
```

**File**: `src/mito2/src/worker/handle_reload.rs` (modified, +3/-0)
```diff
@@ -66,6 +66,9 @@ impl<S: LogStore> RegionWorkerLoop<S> {
         let sender = self.sender.clone();
         common_runtime::spawn_global(async move {
             let result = async {
+                // The fenced instance is stopped, but its last checkpoint may still be writing
+                // the manifest that the reload reads.
+                region.manifest_ctx.wait_for_checkpoint_after_stop().await;
                 // The replay reads only what the log store has made durable.
                 durability_barrier.wait(last_entry_id).await?;
                 opener.open(&config, &wal).await
```

---

### Incident Patch 2: `416f08de` (2026-11-17)
**Commit Message**: fix(mito2): release the manifest lock while a downgrade waits for the checkpoint (#10468)

* fix(mito2): release the manifest lock while a downgrade waits for the checkpoint

A graceful change to follower or downgrading leader waited for the pending
checkpoint under the manifest write lock. The region worker reads the manifest
of that region inline when an index build finishes, so it stopped serving every
region it owns until the checkpoint ended.

The wait now uses `pending_checkpoint_completion` with the lock released, and
takes the lock again afterwards.

Signed-off-by: jeremyhi <[REDACTED_EMAIL]>

* fix(mito2): wait for the checkpoint when the region is already a follower

A request that finds the region already a follower returned at once, while the change that made it a follower could still wait for the checkpoint with the lock released.

Signed-off-by: jeremyhi <[REDACTED_EMAIL]>

---------

Signed-off-by: jeremyhi <[REDACTED_EMAIL]>

**File**: `src/mito2/src/engine/index_build_test.rs` (modified, +108/-2)
```diff
@@ -36,7 +36,7 @@ use datatypes::prelude::ConcreteDataType;
 use datatypes::schema::{ColumnSchema, FulltextOptions, SkippingIndexOptions, SkippingIndexType};
 use puffin::puffin_manager::{PuffinManager, PuffinReader, PuffinWriter};
 use store_api::metadata::ColumnMetadata;
-use store_api::region_engine::RegionEngine;
+use store_api::region_engine::{RegionEngine, SetRegionRoleStateResponse, SettableRegionRoleState};
 use store_api::region_request::{
     AddColumn, AlterKind, RegionAlterRequest, RegionBuildIndexRequest, RegionCloseRequest,
     RegionCompactRequest, RegionFlushRequest, RegionRequest, RegionTruncateRequest, SetIndexOption,
@@ -64,7 +64,8 @@ use crate::sst::index::{CompletedEntry, IndexBuildType};
 use crate::sst::location;
 use crate::test_util::batch_util::sort_batches_and_print;
 use crate::test_util::{
-    CreateRequestBuilder, TestEnv, build_rows, flush_region, put_rows, reopen_region, rows_schema,
+    CheckpointTaskBlocker, CreateRequestBuilder, TestEnv, build_rows, flush_region, put_rows,
+    reopen_region, rows_schema,
 };
 
 pub(crate) fn async_build_mode_config(is_create_on_flush: bool) -> MitoConfig {
@@ -3320,3 +3321,108 @@ async fn test_manual_rebuild_reports_budget_discard_of_new_plugin() {
     );
     engine.stop().await.unwrap();
 }
+
+/// Tests that the worker applies an index publication of a region, and serves other regions,
+/// while a graceful downgrade of that region waits for the pending checkpoint.
+#[tokio::test(flavor = "multi_thread")]
+async fn test_worker_serves_regions_while_downgrade_waits_for_checkpoint() {
+    let (blocker, mock_layer) = CheckpointTaskBlocker::block_cleanup();
+    let mut env =
+        TestEnv::with_prefix("test_worker_serves_regions_while_downgrade_waits_for_checkpoint_")
+            .await
+            .with_mock_layer(mock_layer);
+    let gate = Arc::new(IndexPublicationGate::new(
+        IndexPublicationPhase::AfterManifestCommit,
+    ));
+    let mut config = async_build_mode_config(true);
+    config.num_workers = 1;
+    config.manifest_checkpoint_distance = 1;
+    let engine = env
+        .create_engine_with(config, None, Some(gate.clone()), None)
+        .await;
+
+    let region_id = RegionId::new(1, 1);
+    let other_region_id = RegionId::new(2, 1);
+    for (id, table_dir) in [(region_id, "test"), (other_region_id, "other")] {
+        env.get_schema_metadata_manager()
+            .register_region_table_info(
+                id.table_id(),
+                "test_table",
+                "test_catalog",
+                "test_schema",
+                None,
+                env.get_kv_backend(),
+            )
+            .await;
+        let request = CreateRequestBuilder::new()
+            .table_dir(table_dir)
+            .build_with_index();
+        engine
+            .handle_request(id, RegionRequest::Create(request))
+            .await
+            .unwrap();
+    }
+    let column_schemas = rows_schema(&CreateRequestBuilder::new().build_with_index());
+
+    // The flush commit starts a checkpoint whose cleanup blocks. The index build of the flushed
+    // file then commits its own manifest version and stops before notifying the worker.
+    put_and_flush(&engine, region_id, &column_schemas, 0..20).await;
+    tokio::time::timeout(Duration::from_secs(10), blocker.wait_until_blocked())
+        .await
+        .expect("checkpoint cleanup did not start");
+    tokio::time::timeout(Duration::from_secs(10), gate.wait_entered(1))
+        .await
+        .expect("index build did not commit the manifest");
+
+    let region = engine.get_region(region_id).unwrap();
+    let wait_started = region
+        .manifest_ctx
+        .manifest_manager
+        .read()
+        .await
+        .checkpointer()
+        .pending_checkpoint_wait_started();
+    // Register before starting the transition so the notification cannot be lost.
+    let wait_started = wait_started.notified();
+    let engine_for_downgrade = engine.clone();
+    let downgrade = tokio::spawn(async move {
+        engine_for_downgrade
+            .set_region_role_state_gracefully(region_id, SettableRegionRoleState::DowngradingLeader)
+            .await
+    });
+    tokio::time::timeout(Duration::from_secs(5), wait_started)
+        .await
+        .expect("downgrade did not start waiting for the checkpoint");
+
+    // The worker handles the index publication of the downgrading region, which reads its
+    // manifest, and then a write to the other region.
+    gate.release(1);
+    tokio::time::timeout(Duration::from_secs(10), gate.wait_finished(1))
+        .await
+        .expect("worker did not apply the index publication");
+    tokio::time::timeout(
+        Duration::from_secs(5),
+        put_rows(
+            &engine,
+            other_region_id,
+            Rows {
+                schema: column_schemas.clone(),
+                rows: build_rows(0, 1),
+            },
+        ),
+    )
+    .await
+    .expect("write to another 
```

**File**: `src/mito2/src/engine/set_role_state_test.rs` (modified, +49/-3)
```diff
@@ -309,6 +309,10 @@ async fn test_downgrading_waits_for_checkpoint_and_stops_new_checkpoints() {
         !downgrade.is_finished(),
         "downgrade returned before checkpoint cleanup finished"
     );
+    assert!(
+        region.manifest_ctx.manifest_manager.try_read().is_ok(),
+        "downgrade held the manifest lock while waiting for the checkpoint"
+    );
 
     blocker.release();
     assert_success_response(&downgrade.await.unwrap().unwrap(), 2);
@@ -441,9 +445,47 @@ async fn test_direct_follower_waits_for_pending_checkpoint() {
         !set_follower.is_finished(),
         "follower transition returned before checkpoint cleanup finished"
     );
+    assert!(
+        region.manifest_ctx.manifest_manager.try_read().is_ok(),
+        "follower transition held the manifest lock while waiting for the checkpoint"
+    );
+
+    // Requests that observe the region as a follower wait for the same checkpoint.
+    let mut concurrent_requests = Vec::new();
+    for state in [
+        SettableRegionRoleState::Follower,
+        SettableRegionRoleState::DowngradingLeader,
+    ] {
+        let wait_started = region
+            .manifest_ctx
+            .manifest_manager
+            .read()
+            .await
+            .checkpointer()
+            .pending_checkpoint_wait_started();
+        let wait_started = wait_started.notified();
+        let cloned_engine = engine.clone();
+        let request = tokio::spawn(async move {
+            cloned_engine
+                .set_region_role_state_gracefully(region_id, state)
+                .await
+        });
+        tokio::time::timeout(Duration::from_secs(5), wait_started)
+            .await
+            .expect("concurrent request did not start waiting for the checkpoint");
+        assert!(
+            !request.is_finished(),
+            "concurrent request returned before checkpoint cleanup finished"
+        );
+        concurrent_requests.push(request);
+    }
+    assert_eq!(RegionRoleState::Follower, region.state());
 
     blocker.release();
     assert_success_response(&set_follower.await.unwrap().unwrap(), 1);
+    for request in concurrent_requests {
+        assert_success_response(&request.await.unwrap().unwrap(), 1);
+    }
 }
 
 #[tokio::test(flavor = "multi_thread")]
@@ -514,9 +556,9 @@ async fn test_retried_downgrade_waits_after_first_request_is_cancelled() {
         "first downgrade did not wait for checkpoint cleanup"
     );
 
-    // Cancelling the first caller must not remove the checkpoint handle from
-    // the manifest manager. A retried migration request observes Downgrading
-    // and must wait for the same checkpoint task before it can proceed.
+    // Cancelling the first caller does not cancel the checkpoint. A retried
+    // migration request observes Downgrading and waits for the same checkpoint
+    // task before it proceeds.
     first_downgrade.abort();
     assert!(first_downgrade.await.unwrap_err().is_cancelled());
     assert_eq!(
@@ -546,6 +588,10 @@ async fn test_retried_downgrade_waits_after_first_request_is_cancelled() {
         !retry_downgrade.is_finished(),
         "retried downgrade did not wait for checkpoint cleanup"
     );
+    assert!(
+        region.manifest_ctx.manifest_manager.try_read().is_ok(),
+        "retried downgrade held the manifest lock while waiting for the checkpoint"
+    );
 
     blocker.release();
     retry_downgrade.await.unwrap().unwrap();
```

**File**: `src/mito2/src/region.rs` (modified, +14/-6)
```diff
@@ -599,7 +599,8 @@ impl MitoRegion {
         }
     }
 
-    /// Sets the region role state gracefully. This acquires the manifest write lock.
+    /// Sets the region role state gracefully. This acquires the manifest write lock, and releases
+    /// it while a change to follower or downgrading leader waits for the pending checkpoint.
     ///
     /// Ending staging awaits `drain_stalled_writes` (see [Self::end_staging]); other changes
     /// drop it.
@@ -696,8 +697,10 @@ impl MitoRegion {
                         wait_for_checkpoint = true;
                     }
                     RegionRoleState::Follower => {
-                        // Already in desired state - no-op
+                        // Already in desired state. The change that made it a follower may
+                        // still wait for the checkpoint.
                         info!("Region {} already in follower mode", self.region_id);
+                        wait_for_checkpoint = true;
                     }
                 }
                 None
@@ -730,6 +733,7 @@ impl MitoRegion {
                             "Cannot start downgrade for region {} from state {:?}",
                             self.region_id, current_state
                         );
+                        wait_for_checkpoint = true;
                     }
                     RegionRoleState::Leader(_) => {
                         // The region may become writable again when the
@@ -748,11 +752,15 @@ impl MitoRegion {
             }
         };
 
-        // The state is changed before waiting, so no new writable-leader work
-        // can race with the barrier. Keep the manager lock while joining to
-        // serialize the barrier with checkpoint scheduling.
+        // The checkpoint task is taken under the lock after the state change, so every commit
+        // that could start a checkpoint has registered it: a follower takes no commit, and a
+        // commit of a downgrading leader starts no checkpoint. The wait holds no lock, so the
+        // worker and other users of the manifest are not blocked while the checkpoint finishes.
         if wait_for_checkpoint {
-            manager.wait_for_pending_checkpoint().await;
+            let checkpoint_done = manager.pending_checkpoint_completion();
+            drop(manager);
+            checkpoint_done.await;
+            manager = self.manifest_ctx.manifest_manager.write().await;
         }
 
         // Hack(zhongzc): If we have just become leader (writable), persist any backfilled metadata.
```

---

### Incident Patch 3: `0a93810c` (2026-11-16)
**Commit Message**: fix: improve exemplar handling and batch memory admission (#10363)

* chore: update README

Signed-off-by: shuiyisong <[REDACTED_EMAIL]>

* fix(ingest): reserve memory for table batches

Signed-off-by: shuiyisong <[REDACTED_EMAIL]>

* fix(exemplar): prefix the labels column

Signed-off-by: shuiyisong <[REDACTED_EMAIL]>

* fix(prometheus): hide exemplar table from metadata

Signed-off-by: shuiyisong <[REDACTED_EMAIL]>

* fix(exemplar): reconcile source tags before writes

Signed-off-by: shuiyisong <[REDACTED_EMAIL]>

* perf(exemplar): prune tags and retain source IDs

Signed-off-by: shuiyisong <[REDACTED_EMAIL]>

* fix(exemplar): record slow queries

Signed-off-by: shuiyisong <[REDACTED_EMAIL]>

* fix(otlp): skip exemplars when source writes fail

Signed-off-by: shuiyisong <[REDACTED_EMAIL]>

* fix(prometheus): skip exemplars when source writes fail

Signed-off-by: shuiyisong <[REDACTED_EMAIL]>

* fix: account for held memory in batch admission

Signed-off-by: shuiyisong <[REDACTED_EMAIL]>

* fix: config comments

Signed-off-by: shuiyisong <[REDACTED_EMAIL]>

* test: simplify exemplar and memory tests

Signed-off-by: shuiyisong <[REDACTED_EMAIL]>

* test: deduplicate exemplar setup


**File**: `config/config.md` (modified, +7/-7)
```diff
@@ -13,11 +13,11 @@
 | Key | Type | Default | Descriptions |
 | --- | -----| ------- | ----------- |
 | `default_timezone` | String | Unset | The default timezone of the server. |
-| `default_column_prefix` | String | Unset | The default column prefix for auto-created time index, value, and native histogram columns.<br/>Legacy OTLP summary columns keep their historical `greptime_` prefix. |
+| `default_column_prefix` | String | Unset | The default column prefix for auto-created time index, value, native histogram, and exemplar-label columns.<br/>Legacy OTLP summary columns keep their historical `greptime_` prefix. |
 | `auto_create_table` | Bool | `true` | Server-side global switch for auto table creation on write.<br/>When `false`, a missing table is never auto-created even if the request sets the `auto_create_table` hint to `true`. Default: `true`. |
 | `user_provider` | String | Unset | The user provider for authentication.<br/>Examples: "static_user_provider:file:/path/to/users", "static_user_provider:cmd:greptime_user=greptime_pwd"<br/>Password verifier formats: "plain:<password>", "pbkdf2_sha256:<iterations>:<hex_salt>:<hex_hash>",<br/>"mysql_native_password:<hex_sha1_sha1_password>",<br/>"pg_scram_sha256:<iterations>:<hex_salt>:<hex_stored_key>:<hex_server_key>"<br/>"pbkdf2_sha256" and "pg_scram_sha256" protect passwords at rest, but such users cannot log in over MySQL:<br/>`static_user_provider` and `watch_file_user_provider` only negotiate `mysql_native_password`, which cannot verify these formats.<br/>"mysql_native_password" is MySQL-specific and cannot authenticate over PostgreSQL at all.<br/>PostgreSQL SCRAM only covers "plain" and "pg_scram_sha256" users; if any user is "pbkdf2_sha256" or<br/>"mysql_native_password", PostgreSQL falls back to cleartext password auth for every user.<br/>For "pg_scram_sha256" users, keep the default iteration count (4096) and salt length (16): both are<br/>observable in the SCRAM server-first message, and non-default values weaken resistance to username<br/>enumeration. |
-| `max_in_flight_write_bytes` | String | 0 | Maximum total memory for all concurrent write request bodies and messages (HTTP, gRPC, Flight).<br/>Set to 0 to disable the limit. Default: "0" (unlimited) |
-| `write_bytes_exhausted_policy` | String | `wait` | Policy when write bytes quota is exhausted.<br/>Options: "wait" (default, 10s timeout), "wait(<duration>)" (e.g., "wait(30s)"), "fail" |
+| `max_in_flight_write_bytes` | String | 0 | Shared quota for concurrent write request bodies and messages (HTTP, gRPC, Flight)<br/>plus retained decoder memory and estimated PB-to-Arrow conversion memory for ordinary-table batching.<br/>A batch must fit together with its request's existing reservations; only additional memory is acquired.<br/>Set to 0 to disable the limit. Default: "0" (unlimited) |
+| `write_bytes_exhausted_policy` | String | `wait` | Policy when write bytes quota is exhausted.<br/>Options: "wait" (default, 10s timeout), "wait(<duration>)" (e.g., "wait(30s)"), "fail"<br/>Table-batch conversion never waits for additional memory. Under a wait policy,<br/>temporary contention returns a retryable error; requests that cannot fit are rejected. |
 | `init_regions_in_background` | Bool | `false` | Initialize all regions in the background during the startup.<br/>By default, it provides services after all regions have been initialized. |
 | `init_regions_parallelism` | Integer | `16` | Parallelism of initializing regions. |
 | `max_concurrent_queries` | Integer | `0` | The maximum concurrent region-read streams. Zero means unlimited.<br/>A single query can consume multiple permits. |
@@ -291,11 +291,11 @@
 | Key | Type | Default | Descriptions |
 | --- | -----| ------- | ----------- |
 | `default_timezone` | String | Unset | The default timezone of the server. |
-| `default_column_prefix` | String | Unset | The default column prefix for auto-created time index, value, and native histogram columns.<br/>Legacy OTLP summary columns keep their historical `greptime_` prefix. |
+| `default_column_prefix` | String | Unset | The default column prefix for auto-created time index, value, native histogram, and exemplar-label columns.<br/>Legacy OTLP summary columns keep their historical `greptime_` prefix. |
 | `auto_create_table` | Bool | `true` | Server-side global switch for auto table creation on write.<br/>When `false`, a missing table is never auto-created even if the request sets the `auto_create_table` hint to `true`. Default: `true`. |
 | `user_provider` | String | Unset | The user provider for authentication.<br/>Examples: "static_user_provider:file:/path/to/users", "static_user_provider:cmd:greptime_user=greptime_pwd"<br/>Password verifier formats: "plain:<password>", "pbkdf2_sha256:<iterations>:<hex_salt>:<hex_hash>",<br/>"mysql_native_password:<hex_sha1_sha1_password>",<br/>"pg_scram_sha256:<iterations>:<hex_salt>:<hex_stored_key>:<hex_server_key>"<br/>"pbkdf2_sha256" and "pg_scram_sha256" protect
```

**File**: `config/datanode.example.toml` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 ## @toml2docs:none-default
 node_id = 42
 
-## The default column prefix for auto-created time index, value, and native histogram columns.
+## The default column prefix for auto-created time index, value, native histogram, and exemplar-label columns.
 ## Legacy OTLP summary columns keep their historical `greptime_` prefix.
 ## @toml2docs:none-default
 default_column_prefix = "greptime"
```

**File**: `config/frontend.example.toml` (modified, +6/-2)
```diff
@@ -2,7 +2,7 @@
 ## @toml2docs:none-default
 default_timezone = "UTC"
 
-## The default column prefix for auto-created time index, value, and native histogram columns.
+## The default column prefix for auto-created time index, value, native histogram, and exemplar-label columns.
 ## Legacy OTLP summary columns keep their historical `greptime_` prefix.
 ## @toml2docs:none-default
 default_column_prefix = "greptime"
@@ -27,13 +27,17 @@ default_column_prefix = "greptime"
 ## @toml2docs:none-default
 #+ user_provider = "static_user_provider:file:/path/to/users"
 
-## Maximum total memory for all concurrent write request bodies and messages (HTTP, gRPC, Flight).
+## Shared quota for concurrent write request bodies and messages (HTTP, gRPC, Flight)
+## plus retained decoder memory and estimated PB-to-Arrow conversion memory for ordinary-table batching.
+## A batch must fit together with its request's existing reservations; only additional memory is acquired.
 ## Set to 0 to disable the limit. Default: "0" (unlimited)
 ## @toml2docs:none-default="0"
 #+ max_in_flight_write_bytes = "1GB"
 
 ## Policy when write bytes quota is exhausted.
 ## Options: "wait" (default, 10s timeout), "wait(<duration>)" (e.g., "wait(30s)"), "fail"
+## Table-batch conversion never waits for additional memory. Under a wait policy,
+## temporary contention returns a retryable error; requests that cannot fit are rejected.
 #+ write_bytes_exhausted_policy = "wait"
 
 ## The runtime options.
```

**File**: `config/standalone.example.toml` (modified, +6/-2)
```diff
@@ -2,7 +2,7 @@
 ## @toml2docs:none-default
 default_timezone = "UTC"
 
-## The default column prefix for auto-created time index, value, and native histogram columns.
+## The default column prefix for auto-created time index, value, native histogram, and exemplar-label columns.
 ## Legacy OTLP summary columns keep their historical `greptime_` prefix.
 ## @toml2docs:none-default
 default_column_prefix = "greptime"
@@ -27,13 +27,17 @@ default_column_prefix = "greptime"
 ## @toml2docs:none-default
 #+ user_provider = "static_user_provider:file:/path/to/users"
 
-## Maximum total memory for all concurrent write request bodies and messages (HTTP, gRPC, Flight).
+## Shared quota for concurrent write request bodies and messages (HTTP, gRPC, Flight)
+## plus retained decoder memory and estimated PB-to-Arrow conversion memory for ordinary-table batching.
+## A batch must fit together with its request's existing reservations; only additional memory is acquired.
 ## Set to 0 to disable the limit. Default: "0" (unlimited)
 ## @toml2docs:none-default="0"
 #+ max_in_flight_write_bytes = "1GB"
 
 ## Policy when write bytes quota is exhausted.
 ## Options: "wait" (default, 10s timeout), "wait(<duration>)" (e.g., "wait(30s)"), "fail"
+## Table-batch conversion never waits for additional memory. Under a wait policy,
+## temporary contention returns a retryable error; requests that cannot fit are rejected.
 #+ write_bytes_exhausted_policy = "wait"
 
 ## Initialize all regions in the background during the startup.
```

**File**: `src/common/meta/src/ddl/alter_logical_tables.rs` (modified, +3/-23)
```diff
@@ -24,7 +24,7 @@ use common_procedure::{Context, EventContext, EventTrigger, LockKey, Procedure,
 use common_telemetry::{debug, error, info, warn};
 pub use executor::make_alter_region_request;
 use serde::{Deserialize, Serialize};
-use snafu::{ResultExt, ensure};
+use snafu::ResultExt;
 use store_api::metadata::ColumnMetadata;
 use store_api::metric_engine_consts::ALTER_PHYSICAL_EXTENSION_KEY;
 use strum::AsRefStr;
@@ -40,7 +40,7 @@ use crate::ddl::event::table::{
     TableDdlEvent, TableDdlEventType, TableDdlLocator, alter_table_kind_name,
 };
 use crate::ddl::utils::{extract_column_metadatas, map_to_procedure_error, sync_follower_regions};
-use crate::error::{self, Result};
+use crate::error::Result;
 use crate::instruction::CacheIdent;
 use crate::key::DeserializedValueWithBytes;
 use crate::key::table_info::TableInfoValue;
@@ -67,7 +67,7 @@ fn build_validator_from_alter_table_data<'a>(
         .iter()
         .map(|task| &task.alter_table)
         .collect::<Vec<_>>();
-    AlterLogicalTableValidator::new(physical_table_id, alters)
+    AlterLogicalTableValidator::new(physical_table_id, alters, &data.logical_table_ids)
 }
 
 /// Builds the executor from the [`AlterTablesData`].
@@ -149,26 +149,6 @@ impl AlterLogicalTablesProcedure {
             );
         }
 
-        // Locks are fixed at submission. A logical table that resolves to an
-        // id outside the locked set here was dropped and recreated in between,
-        // so this procedure holds no lock for it. Procedures restored from
-        // pre-upgrade state have no recorded ids and keep the old behavior.
-        if !self.data.logical_table_ids.is_empty() {
-            for value in &table_info_values {
-                let table_id = value.get_inner_ref().table_info.ident.table_id;
-                ensure!(
-                    self.data.logical_table_ids.contains(&table_id),
-                    error::UnexpectedSnafu {
-                        err_msg: format!(
-                            "logical table {} (id {table_id}) is not covered by the \
-                             procedure locks; retry the statement",
-                            value.get_inner_ref().table_info.name
-                        ),
-                    }
-                );
-            }
-        }
-
         // Updates the procedure state.
         retain_unskipped(&mut self.data.tasks, &skip_alter);
         self.data.physical_table_info = Some(physical_table_info);
```

**File**: `src/common/meta/src/ddl/alter_logical_tables/validator.rs` (modified, +16/-2)
```diff
@@ -26,7 +26,7 @@ use crate::ddl::utils::table_info::{
 };
 use crate::error::{
     AlterLogicalTablesInvalidArgumentsSnafu, Result, TableInfoNotFoundSnafu,
-    TableRouteNotFoundSnafu,
+    TableRouteNotFoundSnafu, UnexpectedSnafu,
 };
 use crate::key::table_info::TableInfoValue;
 use crate::key::table_route::{PhysicalTableRouteValue, TableRouteManager, TableRouteValue};
@@ -36,13 +36,19 @@ use crate::key::{DeserializedValueWithBytes, TableMetadataManagerRef};
 pub struct AlterLogicalTableValidator<'a> {
     physical_table_id: TableId,
     alters: Vec<&'a AlterTableExpr>,
+    expected_table_ids: &'a [TableId],
 }
 
 impl<'a> AlterLogicalTableValidator<'a> {
-    pub fn new(physical_table_id: TableId, alters: Vec<&'a AlterTableExpr>) -> Self {
+    pub fn new(
+        physical_table_id: TableId,
+        alters: Vec<&'a AlterTableExpr>,
+        expected_table_ids: &'a [TableId],
+    ) -> Self {
         Self {
             physical_table_id,
             alters,
+            expected_table_ids,
         }
     }
 
@@ -187,6 +193,14 @@ impl<'a> AlterLogicalTableValidator<'a> {
         let table_ids =
             get_all_table_ids_by_names(table_metadata_manager.table_name_manager(), &table_names)
                 .await?;
+        // Check before skipping completed ALTERs, while the procedure holds the pinned ID locks.
+        // Old persisted procedures have no pinned IDs and retain their previous behavior.
+        ensure!(
+            self.expected_table_ids.is_empty() || self.expected_table_ids == table_ids,
+            UnexpectedSnafu {
+                err_msg: "logical tables changed and are not covered by the procedure locks; retry the statement",
+            }
+        );
         let mut table_info_values = get_all_table_info_values_by_table_ids(
             table_metadata_manager.table_info_manager(),
             &table_ids,
```

**File**: `src/common/meta/src/ddl/tests/alter_logical_tables.rs` (modified, +20/-14)
```diff
@@ -713,21 +713,27 @@ async fn test_on_prepare_rejects_table_outside_locked_set() {
     let phy_id = create_physical_table(&ddl_context, "phy").await;
     create_logical_table(ddl_context.clone(), phy_id, "table1").await;
 
-    let tasks = vec![make_alter_logical_table_add_column_task(
-        None,
-        "table1",
-        vec!["column1".to_string()],
-    )];
-
     // The table resolved at prepare time is not in the locked set, as if it
     // had been dropped and recreated after submission.
     let stale_locked_id = phy_id + 1000;
-    let mut procedure =
-        AlterLogicalTablesProcedure::new(tasks, phy_id, vec![stale_locked_id], ddl_context);
-    let err = procedure.on_prepare().await.unwrap_err();
-    assert!(
-        err.to_string()
-            .contains("not covered by the procedure locks"),
-        "{err}"
-    );
+    // A completed ADD must also reject rebinding, even when no schema changes are needed.
+    for column in ["column1", "host"] {
+        let tasks = vec![make_alter_logical_table_add_column_task(
+            None,
+            "table1",
+            vec![column.into()],
+        )];
+        let mut procedure = AlterLogicalTablesProcedure::new(
+            tasks,
+            phy_id,
+            vec![stale_locked_id],
+            ddl_context.clone(),
+        );
+        let err = procedure.on_prepare().await.unwrap_err();
+        assert!(
+            err.to_string()
+                .contains("not covered by the procedure locks"),
+            "{err}"
+        );
+    }
 }
```

**File**: `src/common/meta/src/ddl_manager.rs` (modified, +78/-4)
```diff
@@ -625,13 +625,22 @@ impl DdlManager {
         &self,
         alter_table_tasks: Vec<AlterTableTask>,
         physical_table_id: TableId,
+        expected_table_ids: Option<Vec<TableId>>,
         procedure_context: ProcedureContext,
     ) -> Result<(ProcedureId, Option<Output>)> {
         let context = self.create_context();
 
         // Resolve the logical table ids up front: procedure locks are fixed
         // at submission, so `lock_key` cannot derive them during `Prepare`.
-        let logical_table_ids = {
+        let logical_table_ids = if let Some(ids) = expected_table_ids {
+            ensure!(
+                ids.len() == alter_table_tasks.len(),
+                error::AlterLogicalTablesInvalidArgumentsSnafu {
+                    err_msg: "Expected one pinned table ID per logical ALTER task",
+                }
+            );
+            ids
+        } else {
             let table_refs = alter_table_tasks
                 .iter()
                 .map(|task| task.table_ref())
@@ -1043,8 +1052,13 @@ impl DdlManager {
                         .await
                 }
                 AlterLogicalTables(alter_table_tasks) => {
-                    handle_alter_logical_table_tasks(self, alter_table_tasks, procedure_context)
-                        .await
+                    handle_alter_logical_table_tasks(
+                        self,
+                        alter_table_tasks,
+                        query_context,
+                        procedure_context,
+                    )
+                    .await
                 }
                 DropLogicalTables(_) => todo!(),
                 CreateDatabase(create_database_task) => {
@@ -1598,6 +1612,7 @@ async fn handle_create_trigger_task(
 async fn handle_alter_logical_table_tasks(
     ddl_manager: &DdlManager,
     alter_table_tasks: Vec<AlterTableTask>,
+    query_context: QueryContext,
     procedure_context: ProcedureContext,
 ) -> Result<SubmitDdlTaskResponse> {
     ensure!(
@@ -1616,9 +1631,15 @@ async fn handle_alter_logical_table_tasks(
     let physical_table_id =
         utils::get_physical_table_id(ddl_manager.table_metadata_manager(), first_table).await?;
     let num_logical_tables = alter_table_tasks.len();
+    let expected_table_ids = query_context.pinned_logical_table_ids()?;
 
     let (id, _) = ddl_manager
-        .submit_alter_logical_table_tasks(alter_table_tasks, physical_table_id, procedure_context)
+        .submit_alter_logical_table_tasks(
+            alter_table_tasks,
+            physical_table_id,
+            expected_table_ids,
+            procedure_context,
+        )
         .await?;
 
     info!(
@@ -2061,6 +2082,59 @@ mod tests {
         )
     }
 
+    #[tokio::test]
+    async fn test_alter_logical_tables_preserves_caller_pinned_ids() {
+        use crate::ddl::test_util::alter_table::TestAlterTableExprBuilder;
+        use crate::ddl::test_util::{create_logical_table, create_physical_table};
+        use crate::rpc::ddl::ALTER_LOGICAL_TABLE_IDS_EXTENSION_KEY;
+
+        let manager = build_soft_drop_test_ddl_manager();
+        manager.register_loaders().unwrap();
+        manager.procedure_manager.start().await.unwrap();
+        let context = manager.create_context();
+        let physical_id = create_physical_table(&context, "physical").await;
+        let logical_id = create_logical_table(context, physical_id, "logical").await;
+        let expr: api::v1::AlterTableExpr = TestAlterTableExprBuilder::default()
+            .table_name("logical")
+            .add_columns(vec![api::v1::ColumnDef {
+                name: "host".into(),
+                data_type: api::v1::ColumnDataType::String as i32,
+                semantic_type: api::v1::SemanticType::Tag as i32,
+                is_nullable: true,
+                ..Default::default()
+            }])
+            .add_if_not_exists(true)
+            .build()
+            .unwrap()
+            .into();
+        for (ids, succeeds) in [
+            (Some((logical_id + 1000).to_string()), false),
+            (Some(format!("{logical_id},{logical_id}")), false),
+            (Some(logical_id.to_string()), true),
+            (None, true),
+        ] {
+            let mut context = QueryContext::default();
+            if let Some(ids) = ids {
+                context
+                    .extensions
+                    .insert(ALTER_LOGICAL_TABLE_IDS_EXTENSION_KEY.into(), ids);
+            }
+            let result = manager
+                .submit_ddl_task(
+                    ExecutorContext {
+                        query_context: Some(context),
+                        ..Default::default()
+                    },
+                    SubmitDdlTaskRequest::new(DdlTask::new_alter_logical_tables(vec![
+                        expr.clone(),
+                    ])),
+                )
+                .await;
+            assert_eq!(result.is_ok(), succeeds, "{result:?}");
+        }
+        manager.procedure_mana
```

#### Recent Merged Pull Requests:
- **PR #10479** (2026-11-17): fix(test): render the schema view in the quantile fold test (@discord9)
- **PR #10469** (2026-11-17): fix(test): stop requiring every scan partition to be non-empty (@discord9)
- **PR #10468** (2026-11-17): fix(mito2): release the manifest lock while a downgrade waits for the checkpoint (@fengjiachun)
- **PR #10466** (2026-11-16): test(query): pin the plan shapes the uniform topology builds (@discord9)
- **PR #10464** (2026-11-17): chore(merge): merge main into narthex (@discord9)
- **PR #10463** (2026-11-16): chore: drop a PR description that was committed by accident (@discord9)

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

## X. mito2): wait for a stopped region's checkpoint before reopening it

**RULE**:
When implementing operations in `src/mito2/src/engine/close_test.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in GreptimeTeam/greptimedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `dd941a8e`: mito2): wait for a stopped region's checkpoint before reopening it. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/mito2/src/engine/close_test.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use std::time::Duration;
use store_api::region_request::{PathType, RegionCloseRequest, RegionOpenRequest, RegionRequest};
    CheckpointTaskBlocker, CreateRequestBuilder, TestEnv, build_rows, flush_region, put_rows,
    rows_schema,

#[tokio::test(flavor = "multi_thread")]
async fn test_engine_stop_waits_for_checkpoint() {
    let (blocker, mock_layer) = CheckpointTaskBlocker::block_last_checkpoint_write();
    let mut env = TestEnv::with_prefix("stop-waits-for-checkpoint")
        .await
        .with_mock_layer(mock_layer);
    let config = MitoConfig {
        manifest_checkpoint_distance: 1,
        ..Default::default()
    };
    let engine = env.create_engine(config.clone()).await;
    let region_id = RegionId::new(1, 1);
    let request = CreateRequestBuilder::new().build();
    let table_dir = request.table_dir.clone();
    let column_schemas = rows_schema(&request);
    engine
        .handle_request(region_id, RegionRequest::Create(request))
        .await
        .unwrap();
    put_rows(
        &engine,
        region_id,
        Rows {
            schema: column_schemas,
            rows: build_rows(0, 3),
        },
    )
    .await;
    // The flush starts a checkpoi
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
use store_api::region_request::{RegionCloseRequest, RegionRequest};
    CreateRequestBuilder, TestEnv, build_rows, flush_region, put_rows, rows_schema,
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `dd941a8e` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
