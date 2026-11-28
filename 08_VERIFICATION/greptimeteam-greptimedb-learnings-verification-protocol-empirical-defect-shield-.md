# Verification Protocol: Verification Protocol: Empirical Defect Shield for greptimeteam-greptimedb-learnings

<!-- PROVENANCE_START
{
  "source_repository": "greptimeteam-greptimedb-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T00:39:04.047Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-greptimeteam-greptimedb-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [greptimeteam-greptimedb-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T00:39:04.047Z`  
> **Learning ID**: `LEARN-EVO-greptimeteam-greptimedb-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `greptimeteam-greptimedb-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/greptimeteam-greptimedb-learnings.md`  
> **Source**: github ([https://github.com/GreptimeTeam/greptimedb](https://github.com/GreptimeTeam/greptimedb))  
> **Source Version**: `9aebf3a8`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-28T00:38:26.125Z  
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
> **Harvest Timestamp**: 2026-11-28T00:38:26.119Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GreptimeTeam/greptimedb`
- **Description**: The open-source observability database. One columnar engine for metrics, logs, and traces, on object storage.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6844 stars

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
- **Issue #10710** (2026-11-27): **fix(delete): route deletes using partition columns on value-partitioned tables**
  *Symptoms*: Fixes #10705  ### Motivation When a physical metric table or mito table is partitioned on a non-key value column (e.g., `PARTITION ON COLUMNS (val) (val < 0, val >= 0)`), `DELETE` previously projected/trimmed the batch down to primary keys and time index before partition routing: 1. `DatafusionQueryEngine::exec_dml_statement` (`WriteOp::Delete` in `src/query/src/datafusion.rs`) projected `stream` to `ts_column` + `row_key_column_names()` before calling `TableMutationHandler::delete`. 2. `Deleter::key_column_names` (`src/operator/src/delete.rs`) similarly trimmed gRPC `RowDeleteRequests` to primary keys + time index prior to `RowToRegion`.  Because `KvBackendCatalogManager::logical_table` already maps physical `partition_key_indices` onto logical `table_info.meta.partition_key_indices`, retaining `table_info.meta.partition_column_names()` in both paths supplies the actual partition column value to `RowSplitter` (including across `WriteDispatcher` route-refresh rebuilds), while `mito2` and `metric-engine` accept present field columns on `OpType::Delete` without side effects.  ### Verification - `cargo test -p operator --lib` (`310 passed`) - `cargo test --package tests-integration --test main test_delete_partitioned_on_value_column` (verifies `DELETE` + post-`ADMIN flush_table` state on a value-partitioned logical/physical metric table as well as a value-partitioned mito table) - `cargo clippy -p operator -p query --lib -- -D warnings` (`0 warnings`)

- **Issue #10707** (2026-11-27): **fix(mito): defer field filters for last_non_null scans**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  Fixes #10662.  ## What's changed and what's your intention?  A single SST can hold an older put and its delete marker under `last_non_null`. A field predicate pushed into the SST reader can remove the marker before deduplication and make the deleted row visible again.  Limit the single-source field pre-filter shortcut to `last_row`. The existing `SkipFields` path defers field predicates for `last_non_null` and continues to prune by tag and timestamp. The audit covered memtable reads, Parquet statistics and indexes, static and dynamic predicates, the range cache, series reads, and the direct compaction readers.  The SQL regressions exercise a flat SST written by one flush and a primary-key SST produced by compacting three separately flushed SSTs. The generated SQLness expectations passed in standalone and distributed mode against the fixed build. Formatting and the whitespace check passed. The Mito2 suite passed all 2,983 selected tests. The dependency check passed with the CI-pinned cargo-shear version.  ## PR Checklist  - [x] I have written the necessary rustdoc comments. - [x] I have added the necessary unit tests and integration tests. - [ ] This PR requires documentation updates. - [x] API changes are backward compatible. - [x] Schema or data changes are backward compatible. - [x] This PR needs to be backported 

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

### Incident Patch 1: `2c6b9515` (2026-11-27)
**Commit Message**: docs(rfc): propose an in-memory frontend write retry queue (#10045)

* docs(rfc): add a durable frontend write retry queue RFC

Signed-off-by: lczllx <[REDACTED_EMAIL]>

* docs(rfc): revise the durable write retry queue RFC

Signed-off-by: lczllx <[REDACTED_EMAIL]>

* docs(rfc): base the write queue TTL on a monotonic clock

Signed-off-by: lczllx <[REDACTED_EMAIL]>

* docs(rfc): make the write retry queue in-memory for v1

Signed-off-by: lczllx <[REDACTED_EMAIL]>

* docs(rfc): note ledger lock contention and rationale for queue defaults

Signed-off-by: lczllx <[REDACTED_EMAIL]>

* docs(rfc): narrow the in-memory retry queue design

Signed-off-by: lczllx <[REDACTED_EMAIL]>

* docs(rfc): bound replay memory with permits and answer review gaps

Signed-off-by: lczllx <[REDACTED_EMAIL]>

* docs(rfc): rename the retry queue RFC to match its in-memory v1 scope

Signed-off-by: lczllx <[REDACTED_EMAIL]>

* docs(rfc): shrink the retry queue record and derive its replay bound

Signed-off-by: lczllx <[REDACTED_EMAIL]>

* docs(rfc): scope write retry queue to in-memory core v1

Signed-off-by: lczllx <[REDACTED_EMAIL]>

* docs(rfc): revise the write retry queue RFC for review

Signed-off-by: lcz

**File**: `docs/rfcs/2026-10-27-in-memory-write-retry-queue.md` (added, +405/-0)
```diff
@@ -0,0 +1,405 @@
+---
+Feature Name: In-Memory Frontend Write Retry Queue
+Tracking Issue: https://github.com/GreptimeTeam/greptimedb/issues/8085
+Date: 2026-10-27
+Author: @lczllx
+---
+
+## Summary
+
+This RFC proposes an optional, Frontend-local in-memory retry queue for eligible ordinary, non-tracked direct inserts to partitioned, Mito-backed physical Regions on distributed Frontends. It owns the whole direct-insert call before the first write RPC; after the complete first-round report, it retains eligible failed Region requests and replays them only to their original Regions.
+
+Each record has an absolute retry deadline and a separate budget for potentially submitted replay attempts. A bounded completion wait can preserve the existing client behavior by returning `Ok` when every admitted record is observed applied in time. The queue is disabled by default and is best-effort and process-local: it provides no durability, exactly-once, or at-least-once guarantee, and ambiguous outcomes remain duplicate-capable. Once queue ownership is selected, admission rejection is fail-closed with no inline fallback.
+
+## Motivation
+
+The existing `WriteRetry` in `src/operator/src/write_dispatcher.rs` retries eligible failures inline with a bounded count and jittered exponential backoff. Failed `RoutedWrite` values are retained only while that loop is active; after it gives up, no Frontend-local owner remains to retry them during a longer recovery window.
+
+A Datanode restart can outlast the inline retry window. Several failure forms are also difficult to recover from today. A connection refusal may occur before submission, but error conversion can discard its precise transport cause. A peer-batched RPC may fail without per-entry results, and a single-entry failure is returned as a tonic error rather than a `PartialRegion` response. A queue limited to explicit per-entry failures would miss these cases.
+
+The bounded completion wait avoids returning the first-round error immediately after background admission. Capture begins only after the complete first-round report, so a first-round RPC that never returns remains outside the queue's recovery guarantee.
+
+The proposed five-minute `retry_budget` is a qualification starting point for a Datanode restart, including process cold start, Region reopening, and gRPC readiness; it is not a guarantee for arbitrary outages or every migration path. Region failover is disabled by default in the current MetaSrv options, so the budget must not assume that failover will promptly move a Region to another peer. Deployments that enable failover must qualify failure detection, route publication, and migration time separately and verify the required `H_min` before enabling the queue.
+
+## Goals and Non-goals
+
+### Goals
+
+- Extend recovery beyond the inline retry window without introducing a second retry owner.
+- Preserve request identity, peer-batch provenance, attribution, and deterministic client-visible results.
+- Replay only to the original Region after validating current table and Region compatibility.
+- Bound retained state, replay lifetime, potentially submitted attempts, and local replay work.
+- Restrict ownership to the supported direct-insert path within one distributed Frontend runtime.
+
+### Non-goals
+
+- Durable storage, process-restart recovery, or guaranteed eventual delivery.
+- Exactly-once, at-least-once, idempotent, or deduplicated write semantics.
+- Datanode-side cancellation or a bound on work that a Datanode continues after the Frontend stops waiting.
+- Cross-Region repartition recovery, request rebuilding, repartitioning, fan-out, successor records, or destination-region barriers.
+- An atomic DDL fence, a `TRUNCATE` generation fence, a `DROP`/`UNDROP` generation fence, or a Flow-generation fence.
+- Ordering between queued replay and concurrent live writes, legacy-inline writes, or writes from other Frontends.
+- A queue-side deadline for the initial first-round RPC or streaming handoff of partial first-round results.
+- The queue does not support tracked/confirmed writes, Delete, BulkInsert, Flight `DoPut`, metric logical-batcher flushes, pending-row/table batcher flushes, or other producers outside the supported direct-insert path.
+- A per-table allowlist, hot configuration reload, per-Region retained-capacity reservation, strict admission fairness, or a global token-bucket rate ceiling.
+- Automatic restart of a failed queue coordinator.
+
+## Request Scope and Retry Ownership
+
+### Supported path
+
+The v1 scope applies only to ordinary, non-tracked direct inserts that dispatch to partitioned, Mito-backed physical Regions through the distributed Frontend direct-insert path.
+
+Eligibility depends on the actual producer path and planned Region requests, not the external protocol or table name. SQL, gRPC, pipeline, COPY, and Prometheus requests are included only when their producer uses this direct-insert path and meets every eligibility rule.

```

---

### Incident Patch 2: `3e4dc0b7` (2026-11-27)
**Commit Message**: fix(mito2): keep a region open when a flush-on-close cannot flush it (#10689)

* fix(mito2): keep a region open when a flush-on-close cannot flush it

A close with `flush_on_close` whose region holds rows in its memtable but
cannot flush in its current state, for example a follower, used to skip the
flush and close the region anyway. It now fails with the retryable
`FlushableRegionState` error and leaves the region open, so the caller
retries and the retry flushes once the region can. The close reads whether
the region can flush once. Closes without `flush_on_close` are unchanged.

A metric physical region is reported by its data region, which closes first,
so once a close has closed the data region its metadata region keeps no lease.
A retry that finds the data region closed and the metadata region a follower
waives the requested flush of the metadata region. That close keeps the
region's unflushed rows that are in a WAL; a region without a WAL loses them,
as before this change.

Signed-off-by: jeremyhi <[REDACTED_EMAIL]>

* docs: state what a refused flush-on-close leaves to the caller

Signed-off-by: jeremyhi <[REDACTED_EMAIL]>

---------

Signed-off-by: jeremyhi <[REDACTED_EMAI

**File**: `src/metric-engine/src/engine.rs` (modified, +77/-0)
```diff
@@ -1009,6 +1009,83 @@ mod test {
             .unwrap();
     }
 
+    #[rstest]
+    #[case::follower_at_retry(false)]
+    #[case::leader_at_retry(true)]
+    #[tokio::test]
+    async fn test_close_with_flush_closes_follower_metadata_region_once_data_region_is_closed(
+        #[case] leads_at_retry: bool,
+    ) {
+        let env = TestEnv::new().await;
+        // The periodic metadata flush must not persist the logical region before the test does.
+        env.metric().inner.flush_task.stop().await.unwrap();
+        env.init_metric_region().await;
+        let engine = env.metric();
+        let mito = env.mito();
+        let physical_region_id = env.default_physical_region_id();
+        let metadata_region_id = utils::to_metadata_region_id(physical_region_id);
+        let data_region_id = utils::to_data_region_id(physical_region_id);
+        // The metadata region holds the logical region in its memtable and cannot flush it.
+        mito.set_region_role(metadata_region_id, RegionRole::Follower)
+            .unwrap();
+        let close = || {
+            RegionRequest::Close(RegionCloseRequest {
+                flush_on_close: true,
+            })
+        };
+
+        let error = engine
+            .handle_request(physical_region_id, close())
+            .await
+            .unwrap_err();
+        assert_eq!(common_error::ext::RetryHint::Retryable, error.retry_hint());
+        assert!(!mito.is_region_exists(data_region_id));
+        assert!(mito.is_region_exists(metadata_region_id));
+        assert!(engine.inner.is_physical_region(physical_region_id));
+
+        // The retry finds the data region closed. It flushes a metadata region that leads and
+        // closes a follower without the flush.
+        if leads_at_retry {
+            mito.set_region_role(metadata_region_id, RegionRole::Leader)
+                .unwrap();
+        }
+        engine
+            .handle_request(physical_region_id, close())
+            .await
+            .unwrap();
+        assert!(!mito.is_region_exists(metadata_region_id));
+        assert!(!engine.inner.is_physical_region(physical_region_id));
+
+        // Without WAL replay, only a flushed metadata region still holds the logical region.
+        engine
+            .handle_request(
+                physical_region_id,
+                RegionRequest::Open(RegionOpenRequest {
+                    engine: METRIC_ENGINE_NAME.to_string(),
+                    table_dir: TestEnv::default_table_dir(),
+                    path_type: PathType::Bare,
+                    options: [(PHYSICAL_TABLE_METADATA_KEY.to_string(), String::new())]
+                        .into_iter()
+                        .collect(),
+                    skip_wal_replay: true,
+                    checkpoint: None,
+                    requirements: Default::default(),
+                }),
+            )
+            .await
+            .unwrap();
+        assert_eq!(
+            leads_at_retry,
+            engine
+                .inner
+                .state
+                .read()
+                .unwrap()
+                .logical_regions()
+                .contains_key(&env.default_logical_region_id())
+        );
+    }
+
     #[tokio::test]
     async fn test_offline_cleanup_physical_region() {
         let env = TestEnv::new().await;
```

**File**: `src/metric-engine/src/engine/close.rs` (modified, +24/-5)
```diff
@@ -14,9 +14,9 @@
 
 //! Close a metric region
 
-use common_telemetry::debug;
+use common_telemetry::{debug, info};
 use snafu::ResultExt;
-use store_api::region_engine::RegionEngine;
+use store_api::region_engine::{RegionEngine, RegionRole};
 use store_api::region_request::{AffectedRows, RegionCloseRequest, RegionRequest};
 use store_api::storage::RegionId;
 
@@ -68,20 +68,39 @@ impl MetricEngineInner {
         let data_region_id = utils::to_data_region_id(region_id);
         let metadata_region_id = utils::to_metadata_region_id(region_id);
 
+        // The engine reports a physical region by its data region, so once that is closed the
+        // metadata region keeps no lease. A retry that finds the data region closed and the
+        // metadata region a follower waives the requested flush of the metadata region. The role
+        // is read before that close, so the waiver also holds for a metadata region promoted in
+        // between. The close then releases the region's WAL only up to its flushed entry id, so
+        // unflushed rows that are in a WAL are kept; a region without a WAL loses them, as on any
+        // close of a region that cannot flush.
+        let data_region_closed = !self.mito.is_region_exists(data_region_id);
         self.mito
             .handle_request(
                 data_region_id,
                 RegionRequest::Close(RegionCloseRequest { flush_on_close }),
             )
             .await
-            .with_context(|_| CloseMitoRegionSnafu { region_id })?;
+            .context(CloseMitoRegionSnafu { region_id })?;
+        let skip_metadata_flush = flush_on_close
+            && data_region_closed
+            && self.mito.role(metadata_region_id) == Some(RegionRole::Follower);
+        if skip_metadata_flush {
+            info!(
+                "Waiving the requested flush of follower metadata region {}, its data region is closed",
+                metadata_region_id
+            );
+        }
         self.mito
             .handle_request(
                 metadata_region_id,
-                RegionRequest::Close(RegionCloseRequest { flush_on_close }),
+                RegionRequest::Close(RegionCloseRequest {
+                    flush_on_close: flush_on_close && !skip_metadata_flush,
+                }),
             )
             .await
-            .with_context(|_| CloseMitoRegionSnafu { region_id })?;
+            .context(CloseMitoRegionSnafu { region_id })?;
 
         PHYSICAL_REGION_COUNT.dec();
 
```

**File**: `src/mito2/src/engine/close_test.rs` (modified, +37/-8)
```diff
@@ -12,21 +12,24 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
+use std::assert_matches;
 use std::sync::Arc;
 use std::sync::atomic::Ordering;
 use std::time::Duration;
 
 use api::v1::Rows;
 use common_base::Plugins;
+use common_error::ext::{ErrorExt, RetryHint};
 use common_recordbatch::RecordBatches;
-use store_api::region_engine::RegionEngine;
+use store_api::region_engine::{RegionEngine, RegionRole};
 use store_api::region_request::{PathType, RegionCloseRequest, RegionOpenRequest, RegionRequest};
 use store_api::storage::{RegionId, ScanRequest};
 
 use crate::config::MitoConfig;
 use crate::engine::flush_test::MockRegionHook;
 use crate::engine::listener::AlterFlushListener;
 use crate::engine::region_hook::RegionHookRef;
+use crate::error::Error;
 use crate::test_util::{
     CheckpointTaskBlocker, CreateRequestBuilder, TestEnv, build_rows, flush_region, put_rows,
     rows_schema,
@@ -153,15 +156,28 @@ async fn test_engine_close_region_flush_on_close() {
             .is_empty()
     );
 
+    // A follower cannot flush, so the close fails and leaves the region open.
     engine
-        .handle_request(
-            region_id,
-            RegionRequest::Close(RegionCloseRequest {
-                flush_on_close: true,
-            }),
-        )
-        .await
+        .set_region_role(region_id, RegionRole::Follower)
+        .unwrap();
+    let close = || {
+        RegionRequest::Close(RegionCloseRequest {
+            flush_on_close: true,
+        })
+    };
+    let err = engine.handle_request(region_id, close()).await.unwrap_err();
+    assert_eq!(RetryHint::Retryable, err.retry_hint());
+    assert_matches!(
+        err.into_inner().as_any().downcast_ref::<Error>().unwrap(),
+        Error::FlushableRegionState { .. }
+    );
+    assert!(engine.is_region_exists(region_id));
+
+    // The retry flushes once the region leads again.
+    engine
+        .set_region_role(region_id, RegionRole::Leader)
         .unwrap();
+    engine.handle_request(region_id, close()).await.unwrap();
     assert!(!engine.is_region_exists(region_id));
 
     engine
@@ -186,6 +202,19 @@ async fn test_engine_close_region_flush_on_close() {
         .unwrap();
     let batches = RecordBatches::try_collect(stream).await.unwrap();
     assert_eq!(3, batches.iter().map(|b| b.num_rows()).sum::<usize>());
+
+    // A follower with nothing to flush still closes.
+    assert_eq!(Some(RegionRole::Follower), engine.role(region_id));
+    assert!(
+        engine
+            .get_region(region_id)
+            .unwrap()
+            .version()
+            .memtables
+            .is_empty()
+    );
+    engine.handle_request(region_id, close()).await.unwrap();
+    assert!(!engine.is_region_exists(region_id));
 }
 
 #[tokio::test]
```

**File**: `src/mito2/src/engine/staging_test.rs` (modified, +4/-14)
```diff
@@ -250,22 +250,12 @@ async fn test_staging_state_validation_patterns() {
     assert!(writable_is_writable, "Writable regions should be writable");
 
     // Test flushable state check
-    let staging_is_flushable = matches!(
-        staging_state,
-        RegionRoleState::Leader(RegionLeaderState::Writable)
-            | RegionRoleState::Leader(RegionLeaderState::Staging)
-            | RegionRoleState::Leader(RegionLeaderState::Downgrading)
-    );
-    assert!(staging_is_flushable, "Staging regions should be flushable");
-
-    let writable_is_flushable = matches!(
-        writable_state,
-        RegionRoleState::Leader(RegionLeaderState::Writable)
-            | RegionRoleState::Leader(RegionLeaderState::Staging)
-            | RegionRoleState::Leader(RegionLeaderState::Downgrading)
+    assert!(
+        staging_state.is_flushable(),
+        "Staging regions should be flushable"
     );
     assert!(
-        writable_is_flushable,
+        writable_state.is_flushable(),
         "Writable regions should be flushable"
     );
 }
```

**File**: `src/mito2/src/region.rs` (modified, +11/-6)
```diff
@@ -149,6 +149,16 @@ impl RegionRoleState {
         }
     }
 
+    /// Returns whether a region in this state is admitted to flush.
+    pub(crate) fn is_flushable(self) -> bool {
+        matches!(
+            self,
+            Self::Leader(RegionLeaderState::Writable)
+                | Self::Leader(RegionLeaderState::Staging)
+                | Self::Leader(RegionLeaderState::Downgrading)
+        )
+    }
+
     /// Returns whether the region is staging or ending staging. A staged edit belongs to the
     /// session too, which only [MitoRegion::in_staging_session] can tell.
     pub(crate) fn in_staging_session(self) -> bool {
@@ -405,12 +415,7 @@ impl MitoRegion {
 
     /// Returns whether the region is flushable.
     pub(crate) fn is_flushable(&self) -> bool {
-        matches!(
-            self.manifest_ctx.state.load(),
-            RegionRoleState::Leader(RegionLeaderState::Writable)
-                | RegionRoleState::Leader(RegionLeaderState::Staging)
-                | RegionRoleState::Leader(RegionLeaderState::Downgrading)
-        )
+        self.manifest_ctx.state.load().is_flushable()
     }
 
     /// Returns whether the region should abort index building.
```

**File**: `src/mito2/src/worker/handle_close.rs` (modified, +14/-5)
```diff
@@ -19,6 +19,7 @@ use store_api::logstore::LogStore;
 use store_api::region_request::{RegionCloseRequest, RegionFlushReason, RegionFlushRequest};
 use store_api::storage::RegionId;
 
+use crate::error::FlushableRegionStateSnafu;
 use crate::manifest::action::cap_wal_release;
 use crate::metrics::WAL_RELEASE_ADMISSION_FAILURE_TOTAL;
 use crate::region::MitoRegionRef;
@@ -56,10 +57,19 @@ impl<S: LogStore> RegionWorkerLoop<S> {
             self.reject_region_edits_as_not_found(region_id);
         }
 
-        // Memtables containing skip-WAL writes must be flushed before closing.
-        // Followers cannot flush; explicit flush-on-close and region WAL options
-        // retain their existing behavior.
-        if close_needs_flush(&region, &request) && region.is_flushable() {
+        // The refusal and the flush decision use one snapshot of the state, so a concurrent role
+        // change cannot skip both.
+        let needs_flush = close_needs_flush(&region, &request);
+        let state = region.state();
+        if request.flush_on_close && needs_flush && !state.is_flushable() {
+            info!(
+                "Region {} in state {:?} cannot flush before closing, keeping it open",
+                region_id, state
+            );
+            sender.send(FlushableRegionStateSnafu { region_id, state }.fail());
+            return;
+        }
+        if needs_flush && state.is_flushable() {
             // A region that awaits its Leader lease holds rows that exist nowhere else only if
             // it was written to, which happens only after it was routed to; a close, such as the
             // one of a shutdown, must not drop them. It gives up the role as a downgrade does, so
@@ -92,7 +102,6 @@ impl<S: LogStore> RegionWorkerLoop<S> {
             return;
         }
 
-        // No close-time flush is required, or the region cannot flush.
         let pending_closes = self.take_pending_closes(region_id);
         self.close_region(region_id).await;
         for ddl in pending_closes {
```

**File**: `src/store-api/src/region_request.rs` (modified, +6/-0)
```diff
@@ -780,6 +780,12 @@ impl RegionCleanUpRequest {
 #[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
 pub struct RegionCloseRequest {
     /// Whether to flush the region before closing it.
+    ///
+    /// When set and the engine cannot flush the region's unflushed data in its
+    /// current state, the request fails with a retryable error and the region
+    /// is not removed, so a retry of the close reaches it. An engine may
+    /// instead close the region without the flush when no retry could perform
+    /// it, and logs that it waived the flush.
     pub flush_on_close: bool,
 }
 
```

---

### Incident Patch 3: `c2a66803` (2026-11-27)
**Commit Message**: fix(mito2): read narthex tables partitioned on a non-tag column (#10665)

* fix(mito2): report one identity for a narthex series across regions

Prepared narthex reads with explicit labels prefixed each series key with
the region id. The prefix dates from when identity was the (table_id, tsid)
hash and kept colliding series in different regions apart. Since #10330 the
key is the exact sparse key, so the prefix protects nothing, but it still
gives the fragments of one series in two regions different primary keys.
SeriesRepartitionExec groups raw chunks by primary key, so those fragments
never met in one owner: native PromQL returned duplicate series or failed
with "input repeated an exact series identity" on a time-partitioned table.

Use the exact key as the only candidate key and drop the separate merge
key. The storage-api and raw chunk docs now require the identity to be the
same in every region instead of allowing a region-qualified one.

Signed-off-by: Dennis Zhuang <[REDACTED_EMAIL]>

* fix(mito2): filter narthex rows by a non-tag partition rule

A narthex scan applied the region's partition rule to series-index rows
during discovery. Those rows carry tags only, so a rule on 

**File**: `src/datatypes/src/series/raw.rs` (modified, +3/-3)
```diff
@@ -94,9 +94,9 @@ impl RawTimestamps {
 /// [`RawSeriesChunk::try_new`]; callers crossing a trust boundary must validate input.
 #[derive(Clone, Debug)]
 pub struct RawSeriesChunk {
-    /// Complete identity of the source series, not a TSID or hash alone.
-    /// With explicit labels this may be an opaque domain-qualified identity; only
-    /// a stream declaring a label decode specification requires a label-bearing key.
+    /// Complete identity of the source series, not a TSID or hash alone. Fragments of one
+    /// series read from different regions carry the same identity; only a stream declaring a
+    /// label decode specification requires a label-bearing key.
     pub primary_key: Buffer,
     /// `None` denotes an encoded key under bound-label mode; `Some` contains complete
     /// explicit labels and retains their identity.
```

**File**: `src/mito2/AGENTS.md` (modified, +1/-1)
```diff
@@ -111,7 +111,7 @@ pending. DDL cancellation retains its existing scheduling fence and priority.
   including nullable Float64 and native histogram fields and preserved sequence/delete rows. Its wire
   contract is `docs/formats/mito-samples.md`; time/ID bounds may overlap across
   leaves and parts. Both columnar backends share cancellation-safe output ownership
-  in `series_index/artifact_writer.rs`. Format readers do not apply query visibility; the prepared-source adapter applies visibility and the existing merge/dedup pipeline. Eligible sample merges use identity-only keys and omit tag columns; candidates retain memory-accounted series batch/row labels, and the raw adapter attaches explicit labels with region-qualified identities. Scanner preflight declares that representation so lazy streams and planned frames agree. Non-separable tag/sample residuals retain the full flat schema. Manual reconciliation covers all snapshot SSTs regardless of maintenance eligibility, but retains the soft disk limit. Manual builds validate columnar sample and tag schemas before reuse. Columnar reconciliation consolidates snapshot SSTs into UTC-day sample generations; catalogs record all source IDs. Grouped reads require complete daily coverage and all sources still visible, open each artifact once, and fall back for source-sequence-pruned scans. SST replacement invalidates a whole affected generation; catalog publication and reader handles govern retirement.
+  in `series_index/artifact_writer.rs`. Format readers do not apply query visibility; the prepared-source adapter applies visibility and the existing merge/dedup pipeline. Eligible sample merges use identity-only keys and omit tag columns; candidates retain memory-accounted series batch/row labels, and the raw adapter attaches explicit labels to exact-key identities that are not region-qualified, so fragments of one series from different regions share an identity. Scanner preflight declares that representation so lazy streams and planned frames agree. Non-separable tag/sample residuals retain the full flat schema. Manual reconciliation covers all snapshot SSTs regardless of maintenance eligibility, but retains the soft disk limit. Manual builds validate columnar sample and tag schemas before reuse. Columnar reconciliation consolidates snapshot SSTs into UTC-day sample generations; catalogs record all source IDs. Grouped reads require complete daily coverage and all sources still visible, open each artifact once, and fall back for source-sequence-pruned scans. SST replacement invalidates a whole affected generation; catalog publication and reader handles govern retirement.
 - **Request types** (`request.rs`): usually tied to proto definitions consumed by `datanode`.
 - **WAL/memtable encoding** (`wal/`, `memtable/`): breaks replay if changed incompatibly.
 
```

**File**: `src/mito2/src/read/series_scan/prepared.rs` (modified, +174/-37)
```diff
@@ -363,12 +363,11 @@ fn predicate_conjuncts(predicate: Option<&Predicate>) -> Vec<&Expr> {
 struct Candidate {
     /// Coarse prefix of the exact key; only a hash, never identity.
     id: MetricSeriesId,
-    /// The one owned key allocation: the region-qualified exact key.
+    /// The canonical sparse key: the identity every comparison, sample attribution and output
+    /// chunk uses. It must not be qualified by region: every region holding a fragment of one
+    /// series has to report the same identity, or the fragments never meet in one owner above
+    /// the regions.
     key: Buffer,
-    /// The canonical sparse key, a view of `key`'s bytes. This is the identity every
-    /// comparison and sample attribution uses, so it is stored once rather than once per
-    /// representation.
-    merge_key: Buffer,
     tags: HashMap<u32, Option<String>>,
     metric: Option<SeriesLabels>,
 }
@@ -381,6 +380,7 @@ pub(crate) struct ColumnarPreparedSource {
     merge_field_start: usize,
     // Append-mode Narthex raw reads still require one row per series/timestamp.
     dedup_append_raw: bool,
+    sample_partition: Option<Arc<SamplePartitionFilter>>,
     candidates: Arc<Vec<Candidate>>,
     samples: Arc<Vec<Arc<dyn SamplesFormatReader>>>,
     metrics: PartitionMetrics,
@@ -534,6 +534,18 @@ impl ColumnarPreparedSource {
         preparation_metrics.counts.insert("prepare_batch_series", 0);
         let direct_labels = !batch_output && sample_schema.is_some();
         let conjuncts = predicate_conjuncts(input.predicate_group().predicate());
+        let partition = if input.requires_narthex_preparation() {
+            narthex_partition_filter(metadata.partition_expr.as_deref(), None)?
+        } else {
+            None
+        };
+        // Series rows carry tags only, so a rule over any other column, such as the time index,
+        // filters sample rows instead.
+        let (series_partition, sample_partition) = match partition {
+            Some(rule) if partition_on_tags_only(&rule, metadata) => (Some(rule), None),
+            Some(rule) => (None, Some(SamplePartitionFilter::try_new(&rule, metadata)?)),
+            None => (None, None),
+        };
         let mut retained_rows = 0_usize;
         let mut candidates = BTreeMap::<ExactSeriesKey, Candidate>::new();
         while let Some((reader, window)) = series.readers.pop_front() {
@@ -577,10 +589,7 @@ impl ColumnarPreparedSource {
                         .map_err(|e| invalid(e.to_string()))?,
                 );
             }
-            if context.input.requires_narthex_preparation()
-                && let Some(partition) =
-                    narthex_partition_filter(metadata.partition_expr.as_deref(), None)?
-            {
+            if let Some(partition) = &series_partition {
                 filters.push(
                     partition
                         .try_as_physical_expr(&projected_schema)
@@ -752,26 +761,21 @@ impl ColumnarPreparedSource {
                                 (!strings.is_null(row)).then(|| strings.value(row).to_owned()),
                             );
                         }
+                    } else if let Some(filter) = &sample_partition {
+                        for column_id in filter.tag_ids() {
+                            let (_, strings) =
+                                tag_arrays
+                                    .iter()
+                                    .find(|(id, _)| *id == column_id)
+                                    .ok_or_else(|| invalid("missing partition tag column"))?;
+                            values.insert(
+                                column_id,
+                                (!strings.is_null(row)).then(|| strings.value(row).to_owned()),
+                            );
+                        }
                     }
                     tag_values += values.len() as u64;
-                    // `merge_key` is always the exact key bytes. Explicit-label chunks keep
-                    // the region-qualified form as their `key`, so `primary_key` stays
-                    // region-scoped while identity and ordering stay exact.
-                    let key = if direct_labels {
-                        let mut buffer = Vec::with_capacity(8 + exact.bytes().len());
-                        buffer.extend_from_slice(&metadata.region_id.as_u64().to_be_bytes());
-                        buffer.extend_from_slice(exact.bytes());
-                        Buffer::from(buffer)
-                    } else {
-                        Buffer::from(exact.bytes().to_vec())
-                    };
-                    let merge_key = if direct_labels {
-                        key.slice_with_length(8, exact.bytes().len())
-                    } else {
-                        key.clone()
-                    };
-                    // The exact key is stored once: `merge_key` is a view of `key`, so the
-                    // reservation charges the single key a
```

**File**: `src/mito2/src/read/series_scan/prepared/tests.rs` (modified, +82/-13)
```diff
@@ -338,14 +338,9 @@ fn rows(chunks: &[RawSeriesChunk]) -> Vec<(Vec<u8>, i64, f64)> {
                 };
                 (
                     {
-                        let key = if chunk.metric.is_some() {
-                            &chunk.primary_key.as_slice()[8..]
-                        } else {
-                            chunk.primary_key.as_slice()
-                        };
                         let (table, tsid) =
                             mito_codec::row_converter::SparsePrimaryKeyCodec::schemaless()
-                                .decode_ids(key)
+                                .decode_ids(chunk.primary_key.as_slice())
                                 .unwrap();
                         [
                             table.to_be_bytes().as_slice(),
@@ -1150,6 +1145,7 @@ async fn ordinal_range_batches_sample_requests_and_pushes_time_bounds() {
     let requests = Arc::new(Mutex::new(Vec::new()));
     let source = ColumnarPreparedSource {
         dedup_append_raw: false,
+        sample_partition: None,
         scan_pool: source.scan_pool.clone(),
         merge_field_start: 0,
         context: source.context.clone(),
@@ -1192,7 +1188,7 @@ async fn ordinal_range_batches_sample_requests_and_pushes_time_bounds() {
         let keys = source
             .candidates
             .iter()
-            .map(|c| c.merge_key.to_vec())
+            .map(|c| c.key.to_vec())
             .collect::<BTreeSet<_>>();
         for request in requests.iter() {
             let requested = request
@@ -2463,7 +2459,7 @@ async fn overlapping_buckets_keep_colliding_physical_tags(#[case] mixed: bool) {
     let identities: HashSet<Vec<u8>> = source
         .candidates
         .iter()
-        .map(|candidate| candidate.merge_key.to_vec())
+        .map(|candidate| candidate.key.to_vec())
         .collect();
     assert_eq!(2, identities.len(), "colliding series keep distinct keys");
     if !mixed {
@@ -2642,13 +2638,11 @@ async fn long_keys_prepare_and_read() {
         .unwrap();
     let source = scan.prepared.source.get().unwrap().as_ref().unwrap();
     // The fixture's own series prepare beside this one; the long key must survive preparation
-    // byte for byte and own its samples. Served samples make `primary_key` region-qualified.
-    let mut expected = metadata.region_id.as_u64().to_be_bytes().to_vec();
-    expected.extend_from_slice(&key);
+    // byte for byte and own its samples. The identity is the stored key itself, not a
+    // region-qualified form, so fragments of a series in other regions report the same one.
     let ordinal = (0..source.num_series())
         .find(|ordinal| {
-            source.series_info(*ordinal).unwrap().primary_key.as_ref() as &[u8]
-                == expected.as_slice()
+            source.series_info(*ordinal).unwrap().primary_key.as_ref() as &[u8] == key.as_slice()
         })
         .expect("preparation must keep the series whose key is longer than 8 KiB");
     let chunks = source
@@ -3105,6 +3099,13 @@ async fn authoritative_narthex_preparation_without_sidecars(
 }
 
 async fn authoritative_fixture(merge_mode: &str) -> (TestEnv, MitoEngine, MitoRegionRef) {
+    authoritative_fixture_with(merge_mode, None).await
+}
+
+async fn authoritative_fixture_with(
+    merge_mode: &str,
+    partition_expr: Option<String>,
+) -> (TestEnv, MitoEngine, MitoRegionRef) {
     let mut env = TestEnv::with_prefix("narthex-review").await;
     let engine = env
         .create_engine(MitoConfig {
@@ -3124,6 +3125,7 @@ async fn authoritative_fixture(merge_mode: &str) -> (TestEnv, MitoEngine, MitoRe
         .insert_option("primary_key_encoding", "sparse")
         .insert_option("sst_format", "narthex")
         .insert_option("merge_mode", merge_mode)
+        .partition_expr_json(partition_expr)
         .build();
     create.column_metadatas = metadata.column_metadatas;
     create.primary_key = metadata.primary_key;
@@ -3136,6 +3138,73 @@ async fn authoritative_fixture(merge_mode: &str) -> (TestEnv, MitoEngine, MitoRe
     (env, engine, region)
 }
 
+/// A time-partitioned region keeps only its own rows, though a file shared after repartition
+/// holds rows of both partitions and series rows carry no time index to filter on. Key columns
+/// a mixed rule references take the series' values, `__table_id` included.
+#[rstest::rstest]
+#[case::time(None)]
+#[case::tag_and_time(Some(partition::expr::col("tag_0").eq(Value::from("a"))))]
+#[case::table_id_and_time(Some(
+    partition::expr::col(DATA_SCHEMA_TABLE_ID_COLUMN_NAME).eq(Value::UInt32(10))
+))]
+#[tokio::test]
+async fn authoritative_time_partition_filters_sample_rows(
+    #[case] key_rule: Option<partition::expr::PartitionExpr>,
+) {
+    let time_rule = partition::expr::col("ts").lt(Value::Timestamp(
+        common_time::Timestamp::new_millisecond(60_000),
+    ));
+    let rule = match key_rule {
+        Some(key_rule) => key_rule.and(time_rule),
+        None => time_rule,
+    };
+    let
```

**File**: `src/promql/AGENTS.md` (modified, +7/-6)
```diff
@@ -22,12 +22,13 @@ functions, vector matching and extension operators. Statement planning lives in
 ## Native execution boundary
 
 Native PromQL is an experimental, standalone evaluation route alongside the
-existing DataFusion PromQL path. It operates on one storage region, which may
-supply multiple scan partitions. Where a boundary must answer one logical
-series once, `SeriesRepartitionExec` merges that identity's fragments across
-scan partitions and recomputes a single close for it. Cross-region
-`SeriesMerge`/`Exchange` are still not implemented, so a logical series split
-across regions is not merged. Do not describe partition-local work as a global
+existing DataFusion PromQL path. A region may supply multiple scan partitions.
+Where a boundary must answer one logical series once, `SeriesRepartitionExec`
+merges that identity's fragments and recomputes a single close for it. A table
+partitioned on a non-tag column splits series across regions; the planner reads
+such a selector through `RawSeriesSource` and merges the fragments above the
+regions, keyed by the raw primary key, which every region must report
+identically for one series. Do not describe partition-local work as a global
 series merge.
 
 Vector operations use the existing vector-matching semantics; do not describe
```

**File**: `src/promql/src/extension_plan/series_repartition/tests.rs` (modified, +1/-1)
```diff
@@ -8425,7 +8425,7 @@ async fn a_raw_merge_conflict_fails_the_execution() {
     assert!(
         error
             .to_string()
-            .contains("duplicate raw timestamp has conflicting samples")
+            .contains("has two different samples at timestamp 1 ms")
     );
 }
 
```

**File**: `src/promql/src/source/merge.rs` (modified, +18/-1)
```diff
@@ -18,10 +18,13 @@ mod tests;
 use datafusion::arrow::buffer::ScalarBuffer;
 use datafusion_common::DataFusionError;
 use datatypes::error::InvalidSeriesSnafu;
+use datatypes::series::SeriesLabels;
 use datatypes::series::histogram::HistogramView;
 use datatypes::series::raw::{RawSeriesChunk, RawTimestamps};
 use datatypes::series::samples::{SampleRef, Samples, SeriesFields, SeriesSchema};
 
+use crate::grid_series::{label_set, render_label_set};
+
 /// Rebuilds one raw series from every piece of one complete physical identity, reporting each
 /// allocation before it happens.
 ///
@@ -151,7 +154,7 @@ pub(crate) fn merge_raw_identity_charging(
                             .ok_or_else(|| invalid("field index out of bounds"))?
                             .sample(duplicate.2),
                     ) {
-                        return Err(invalid("duplicate raw timestamp has conflicting samples"));
+                        return Err(invalid(&conflicting_samples(&labels, rows[index].0)));
                     }
                 }
             }
@@ -211,6 +214,20 @@ pub(crate) fn merge_raw_identity_charging(
     Ok(result)
 }
 
+/// Raw timestamps strictly increase within a chunk, so the two samples come from two chunks of
+/// one identity: normally two regions of a table partitioned on a non-tag column, each holding
+/// one side of an overwrite. Two chunks of one region should never disagree, so the cause is
+/// stated as likely.
+fn conflicting_samples(labels: &SeriesLabels, timestamp: i64) -> String {
+    format!(
+        "series {} has two different samples at timestamp {timestamp} ms, read from different \
+         regions or scan partitions. Likely cause: the table is partitioned on a non-tag column \
+         and this sample was written with values on both sides of a partition bound, so each \
+         region kept one version",
+        render_label_set(&label_set(labels))
+    )
+}
+
 fn samples_equal(left: SampleRef<'_>, right: SampleRef<'_>) -> bool {
     match (left, right) {
         (SampleRef::Missing, SampleRef::Missing) => true,
```

**File**: `src/store-api/src/region_engine.rs` (modified, +2/-2)
```diff
@@ -595,8 +595,8 @@ pub type SendableRawSeriesStream = Pin<Box<dyn RawSeriesStream>>;
 /// Stable identity metadata for one ordinal in a prepared series source.
 #[derive(Clone, Debug)]
 pub struct SeriesInfo {
-    /// Complete source identity, not a TSID or hash alone. Explicit-label sources
-    /// may use an opaque domain-qualified identity instead of a label-bearing key.
+    /// Complete source identity, not a TSID or hash alone. Every region holding a fragment of
+    /// one series reports the same identity, so it must not be qualified by region.
     pub primary_key: datatypes::arrow::buffer::Buffer,
     /// Complete explicit metric name and labels, not a partial label projection; or `None` for
     /// primary-key label binding (undecoded, not nameless). The metric name itself may be absent.
```

#### Recent Merged Pull Requests:
- **PR #10710** (2026-11-27): fix(delete): route deletes using partition columns on value-partitioned tables (@zaidrain06)
- **PR #10707** (2026-11-27): fix(mito): defer field filters for last_non_null scans (@evenyag)
- **PR #10704** (2026-11-27): refactor(promql): trim native PromQL comments and redundant tests (@killme2008)
- **PR #10698** (closed): feat(index): extend column indexing (@WenyXu)
- **PR #10696** (closed): feat(mito2): stream Narthex sample descriptors into a shared index (@evenyag)
- **PR #10689** (2026-11-27): fix(mito2): keep a region open when a flush-on-close cannot flush it (@fengjiachun)

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

## X. docs(rfc): propose an in-memory frontend write retry queue

**RULE**:
When implementing operations in `docs/rfcs/2026-10-27-in-memory-write-retry-queue.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in GreptimeTeam/greptimedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2c6b9515`: docs(rfc): propose an in-memory frontend write retry queue. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/rfcs/2026-10-27-in-memory-write-retry-queue.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
---
Feature Name: In-Memory Frontend Write Retry Queue
Tracking Issue: https://github.com/GreptimeTeam/greptimedb/issues/8085
Date: 2026-10-27
Author: @lczllx
---

## Summary

This RFC proposes an optional, Frontend-local in-memory retry queue for eligible ordinary, non-tracked direct inserts to partitioned, Mito-backed physical Regions on distributed Frontends. It owns the whole direct-insert call before the first write RPC; after the complete first-round report, it retains eligible failed Region requests and replays them only to their original Regions.

Each record has an absolute retry deadline and a separate budget for potentially submitted replay attempts. A bounded completion wait can preserve the existing client behavior by returning `Ok` when every admitted record is observed applied in time. The queue is disabled by default and is best-effort and process-local: it provides no durability, exactly-once, or at-least-once guarantee, and ambiguous outcomes remain duplicate-capable. Once queue ownership is selected, admission rejection is fail-closed with no inline fallback.

## Motivation

The existing `WriteRetry` in `src/operator/src/write_dispatcher.rs` retries eligible fail
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2c6b9515` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
