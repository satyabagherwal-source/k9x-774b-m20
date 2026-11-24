# Verification Protocol: Verification Protocol: Empirical Defect Shield for greptimeteam-greptimedb-learnings

<!-- PROVENANCE_START
{
  "source_repository": "greptimeteam-greptimedb-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T15:17:35.695Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-greptimeteam-greptimedb-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [greptimeteam-greptimedb-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T15:17:35.695Z`  
> **Learning ID**: `LEARN-EVO-greptimeteam-greptimedb-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `greptimeteam-greptimedb-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/greptimeteam-greptimedb-learnings.md`  
> **Source**: github ([https://github.com/GreptimeTeam/greptimedb](https://github.com/GreptimeTeam/greptimedb))  
> **Source Version**: `81e60511`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-24T15:17:29.380Z  
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
> **Harvest Timestamp**: 2026-11-24T15:17:29.374Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GreptimeTeam/greptimedb`
- **Description**: The open-source observability database. One columnar engine for metrics, logs, and traces, on object storage.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6828 stars

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
- **Issue #10605** (2026-11-24): **fix(datatypes): bounds-check Vector::get and get_ref [Backport release/v1.3]**
  *Symptoms*: Backport of #10594 to release/v1.3.  --- Original PR: #10594 Merged by: @evenyag

- **Issue #10604** (2026-11-24): **fix(meta): persist segmented procedure checkpoints atomically on RDS**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  Refs #10597.  ## What's changed and what's your intention?  A procedure checkpoint can span several metadata keys. Writing each segment independently lets an interrupted write leave a partially committed checkpoint. PostgreSQL and MySQL now receive all segments in one batch_put call. If a later SQL statement fails, the transaction rolls back the earlier writes and preserves the last committed checkpoint.  KvBackend exposes an atomic_batch_put guarantee, and TxnService exposes explicit transaction support and its operation limit. MySQL reads max_allowed_packet when the backend opens and sizes prepared statements using both the packet budget and the existing row and bind limits. All chunks of a batch share the same transaction.  Tests exercise failure on a new checkpoint, failed replacement of an existing checkpoint, retry, and byte-for-byte recovery through an independent connection. The persisted keys and values keep their existing format. Recovery from previously corrupted checkpoints remains a separate issue.  ## PR Checklist  Please convert it to a draft if some of the following conditions are not met.  - [x] I have written the necessary rustdoc comments. - [x] I have added the necessary unit tests and integration tests. - [ ] This PR requires documentation updates. - [ ] API changes are backward compatible. - [x
  **Post-Mortem & Fix Analysis**:
  > Changed the PR description to `Refs #10597`. The issue stays open to track recovery of unrelated procedures when a stored checkpoint already has a missing segment.

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

### Incident Patch 1: `883ae6ea` (2026-11-24)
**Commit Message**: fix(promql): answer a named selector over a missing table with the empty vector (#10472)

A selector that names a metric whose table does not exist made the native route decline the whole
statement, so the existing planner answered it. The route already has that answer when the selector
names no metric: a nameless selector that matches no table is planned as the typed empty input and
answers the empty vector. `setup_context` reports a missing table by returning the `EmptyMetric`
plan, which a native tree cannot bind, and the named path read that as "cannot plan" rather than as
"no rows".

The named path now pushes the same typed empty input the zero-match nameless path pushes, so
Prometheus' answers follow from the ordinary empty-input handling: a bare selector answers no rows,
`rate`/`sum`/`count`/`topk`/`sum by (__name__)` answer no rows (`sum` of nothing is empty, not 0),
`absent` answers one row holding 1 with a null name, `absent` over equality matchers carries those
labels, `absent_over_time` answers the same, and `or`, `and` and `unless` keep, drop or ignore what
the other side holds. A `__field__` matcher still declines, exactly as it does over a table that
exists: the matc

**File**: `src/query/src/promql/planner/native.rs` (modified, +86/-43)
```diff
@@ -728,29 +728,8 @@ impl PromPlanner {
             let Some(values) = native_root_fields(tree.root()) else {
                 return Ok(None);
             };
-            // A label named `time` is the one collision the default time column can have: the
-            // value columns are named after the expression, so they never take that name. The
-            // time column is this route's own synthetic name - no label or value is renamed - so
-            // a statement whose output already holds a `time` column publishes its grid under the
-            // first free `native_time_N` instead of dropping or renaming the label.
             let value_names = expression_field_names(&expression, &values);
-            let time_index = if value_names
-                .iter()
-                .chain(&output_tags)
-                .any(|name| name == DEFAULT_TIME_INDEX_COLUMN)
-            {
-                (0usize..)
-                    .map(|index| format!("native_time_{index}"))
-                    .find(|candidate| {
-                        !value_names
-                            .iter()
-                            .chain(&output_tags)
-                            .any(|name| name == candidate)
-                    })
-                    .expect("the time column candidate sequence is unbounded")
-            } else {
-                DEFAULT_TIME_INDEX_COLUMN.to_string()
-            };
+            let time_index = free_time_index(DEFAULT_TIME_INDEX_COLUMN, &value_names, &output_tags);
             // The metadata a consumer of a frame operand reads: the evaluated layout this tree's
             // root declares on the statement grid, and the labels a `vector(s)` reports.
             let metadata = match format {
@@ -909,11 +888,9 @@ impl PromPlanner {
                         //
                         // An empty raw series frame is an ordinary input to the node; multi-input placement
                         // and partition normalization are decided after compilation. A `__field__` matcher
-                        // is declined for a scan this route can read, and the same refusal keeps the empty
-                        // input from claiming a field layout the matcher would have decided.
-                        if self.ctx.field_column_matcher.is_some() {
-                            return Ok(None);
-                        }
+                        // narrows the field set of a scan this route can read, and a selector that matched
+                        // no table has no scan to narrow: the answer is the empty vector either way, exactly
+                        // as the named branch below answers a missing table.
                         prepared.push(empty_discovered_input(
                             self.ctx
                                 .time_index_column
@@ -1047,7 +1024,25 @@ impl PromPlanner {
                         Err(_) => return Ok(None),
                     };
                 if self.setup_context().await?.is_some() {
-                    return Ok(None);
+                    // The selector names a metric whose table does not exist, so the query still has an
+                    // answer: the empty vector, planned from the same typed empty input a nameless selector
+                    // that matched no table is. Planning it here keeps `TableNameNotFound` out of the
+                    // existing planner, which has no table to bind.
+                    //
+                    // A `__field__` matcher does not decline here, though one over a scan this route can
+                    // read does: it narrows the field set of the table its selector reads, and this table has
+                    // no field set to narrow, so every field selection over it is empty. The existing planner
+                    // answers the same way, because a missing table is planned as `EmptyMetric` before the
+                    // projection a `__field__` matcher builds (`setup_context` returns it, and
+                    // `selector_to_series_normalize_plan` never runs). The empty input's own placeholder
+                    // field is internal to the tree; no answer publishes it.
+                    prepared.push(empty_discovered_input(
+                        self.ctx
+                            .time_index_column
+                            .clone()
+                            .unwrap_or_else(|| DEFAULT_TIME_INDEX_COLUMN.to_string()),
+                    )?);
+                    continue;
                 }
                 let Some(one) = self
                     .prepare_one_scan(
@@ -1130,6 +1125,9 @@ impl PromPlanner {
             prepared[index].1 = Arc::clone(&schema);
         }
         // A real input names the output's time index and, on one table, binds every scan.
+        let named_by_a_real_input = prepared
+            .iter()
+            .any(|(scan, ..)| !is_empty_discovered_input(scan));
         let Some((_, _, metric, time, tags, _, _)) = p
```

**File**: `src/query/src/promql/planner/test.rs` (modified, +500/-0)
```diff
@@ -2490,6 +2490,455 @@ async fn native_zero_match_discovery_with_real_selector_binds_both_inputs() {
     }
 }
 
+/// A fixture whose `x` and `exists` tables exist, so any other metric a selector names has no table
+/// to bind.
+async fn named_missing_table_provider() -> DfTableSourceProvider {
+    build_test_table_provider_with_options(
+        &[
+            (DEFAULT_SCHEMA_NAME.to_string(), "x".to_string()),
+            (DEFAULT_SCHEMA_NAME.to_string(), "exists".to_string()),
+        ],
+        1,
+        1,
+        vec![],
+        ConcreteDataType::timestamp_millisecond_datatype(),
+        false,
+        ConcreteDataType::float64_datatype(),
+        NATIVE_ENGINE,
+    )
+    .await
+}
+
+/// Whether `plan` holds the typed empty input a selector that read no table is planned as.
+fn contains_typed_empty_input(plan: &LogicalPlan) -> bool {
+    super::native::is_empty_discovered_input(plan)
+        || plan
+            .inputs()
+            .iter()
+            .any(|child| contains_typed_empty_input(child))
+}
+
+/// A selector that names a metric whose table does not exist is planned natively, as the typed
+/// empty input a nameless selector that matches nothing is.
+///
+/// Prometheus answers each statement below over an empty input, so handing the statement back to
+/// the existing planner - which has no table to bind and raises `TableNameNotFound` - is not an
+/// answer. `x` and `exists` do exist, and the statements reading them keep the plan they had: an
+/// existing table is read through its scan whether or not it holds rows.
+#[tokio::test]
+async fn native_named_selector_over_a_missing_table_plans_as_an_empty_input() {
+    // `(query, reads an existing table)`.
+    for (query, reads_existing) in [
+        // The selection itself.
+        ("nonexistent_metric", false),
+        ("nonexistent_metric @ 300", false),
+        ("nonexistent offset 5m", false),
+        // An operator over the empty input keeps its own answer for zero series.
+        ("rate(nonexistent[5m])", false),
+        ("sum(nonexistent)", false),
+        ("count(nonexistent)", false),
+        ("topk(3, nonexistent)", false),
+        ("sum by (__name__) (nonexistent)", false),
+        // The two shapes whose answer over zero series is a row rather than none.
+        ("absent(nonexistent_metric)", false),
+        (r#"absent(nonexistent_metric{job="x"})"#, false),
+        (r#"absent_over_time(nonexistent{job="x"}[5m])"#, false),
+        // A set operation pairs the empty input with a real one, on either side and in either
+        // position, and a statement whose selectors are all missing has no real side at all.
+        ("nonexistent or exists", true),
+        ("nonexistent and exists", true),
+        ("nonexistent unless exists", true),
+        ("exists or nonexistent", true),
+        ("a1 or a2", false),
+        // A table that exists is read through its scan, with and without rows.
+        ("x", true),
+        ("sum(x)", true),
+        ("x or nonexistent", true),
+    ] {
+        let plan = build_native_fused_plan_with_provider(
+            query,
+            true,
+            named_missing_table_provider().await,
+        )
+        .await;
+        assert!(
+            find_fused_series(&plan).is_some(),
+            "`{query}` did not take the native route: {plan:?}"
+        );
+        let display = plan.display_indent().to_string();
+        if reads_existing {
+            assert!(display.contains("TableScan"), "{query}: {display}");
+        } else {
+            assert!(
+                contains_typed_empty_input(&plan),
+                "`{query}` is not planned over the typed empty input: {plan:?}"
+            );
+            assert!(
+                !display.contains("TableScan"),
+                "`{query}` reads a table it has none of: {display}"
+            );
+        }
+    }
+
+    // A `__field__` matcher still declines over a table this route can read: the matcher narrows the
+    // field set of the scan below the node, and the raw series scan reports every field the scan
+    // carries. That refusal is about the scan, not about the table existing - a missing table has no
+    // field set to narrow and is admitted as the empty input, which
+    // `native_missing_table_with_a_field_matcher_answers_the_empty_vector` asserts beside its rows.
+    let query = r#"x{__field__="field_0"}"#;
+    let plan =
+        build_native_fused_plan_with_provider(query, true, named_missing_table_provider().await)
+            .await;
+    assert!(
+        find_fused_series(&plan).is_none(),
+        "`{query}` claimed a field layout its scan does not report: {plan:?}"
+    );
+}
+
+/// The same statements plan natively when the engine plans distributed statements.
+///
+/// Such a planner reads every input above the regions, so each occurrence is source-backed and the
+/// typed empty input is the one input that stays itself. The route is the same one the statements
```

---

### Incident Patch 2: `f51d01b1` (2026-11-24)
**Commit Message**: fix(datatypes): bounds-check Vector::get and get_ref (#10594)

The indexed accessors checked is_valid() and then called
value_unchecked(), but is_valid() is not a bounds check: it returns true
for any index when the array has no null buffer. An out-of-range index
read past the array buffers instead of panicking.

Use the bounds-checked value() accessors. This also covers
DictionaryVector, whose lookups go through the item vector's get().

Signed-off-by: Dennis Zhuang <[REDACTED_EMAIL]>

**File**: `src/datatypes/src/vectors.rs` (modified, +2/-4)
```diff
@@ -260,8 +260,7 @@ macro_rules! impl_validity_for_vector {
 macro_rules! impl_get_for_vector {
     ($array: expr, $index: ident) => {
         if $array.is_valid($index) {
-            // Safety: The index have been checked by `is_valid()`.
-            unsafe { $array.value_unchecked($index).into() }
+            $array.value($index).into()
         } else {
             Value::Null
         }
@@ -271,8 +270,7 @@ macro_rules! impl_get_for_vector {
 macro_rules! impl_get_ref_for_vector {
     ($array: expr, $index: ident) => {
         if $array.is_valid($index) {
-            // Safety: The index have been checked by `is_valid()`.
-            unsafe { $array.value_unchecked($index).into() }
+            $array.value($index).into()
         } else {
             ValueRef::Null
         }
```

**File**: `src/datatypes/src/vectors/decimal.rs` (modified, +1/-2)
```diff
@@ -138,8 +138,7 @@ impl Decimal128Vector {
     /// Get decimal128 Value from array by index.
     fn get_decimal128_value_from_array(&self, index: usize) -> Option<Decimal128> {
         if self.array.is_valid(index) {
-            // Safety: The index have been checked by `is_valid()`.
-            let value = unsafe { self.array.value_unchecked(index) };
+            let value = self.array.value(index);
             // Safety: The precision and scale have been checked by Vector.
             Some(Decimal128::new(value, self.precision(), self.scale()))
         } else {
```

**File**: `src/datatypes/src/vectors/primitive.rs` (modified, +9/-4)
```diff
@@ -164,8 +164,7 @@ impl<T: LogicalPrimitiveType> Vector for PrimitiveVector<T> {
 
     fn get(&self, index: usize) -> Value {
         if self.array.is_valid(index) {
-            // Safety: The index have been checked by `is_valid()`.
-            let wrapper = unsafe { T::Wrapper::from_native(self.array.value_unchecked(index)) };
+            let wrapper = T::Wrapper::from_native(self.array.value(index));
             wrapper.into()
         } else {
             Value::Null
@@ -174,8 +173,7 @@ impl<T: LogicalPrimitiveType> Vector for PrimitiveVector<T> {
 
     fn get_ref(&self, index: usize) -> ValueRef<'_> {
         if self.array.is_valid(index) {
-            // Safety: The index have been checked by `is_valid()`.
-            let wrapper = unsafe { T::Wrapper::from_native(self.array.value_unchecked(index)) };
+            let wrapper = T::Wrapper::from_native(self.array.value(index));
             wrapper.into()
         } else {
             ValueRef::Null
@@ -416,6 +414,13 @@ mod tests {
         assert_eq!(&ArrowDataType::Int32, arrow_arr.data_type());
     }
 
+    #[test]
+    #[should_panic(expected = "Trying to access an element at index")]
+    fn test_get_out_of_bounds_without_nulls_panics() {
+        let vector = Int32Vector::from_slice([1]);
+        vector.get(1);
+    }
+
     #[test]
     fn test_from_values() {
         let v = Int32Vector::from_values(vec![1, 2, 3, 4]);
```

**File**: `src/datatypes/src/vectors/string.rs` (modified, +7/-0)
```diff
@@ -523,6 +523,13 @@ mod tests {
 
     use super::*;
 
+    #[test]
+    #[should_panic(expected = "Trying to access an element at index")]
+    fn test_get_ref_out_of_bounds_without_nulls_panics() {
+        let vector = StringVector::from(vec!["a"]);
+        vector.get_ref(1);
+    }
+
     #[test]
     fn test_string_vector_build_get() {
         let mut builder = StringVectorBuilder::with_capacity(4);
```

---

### Incident Patch 3: `82bdd7fd` (2026-11-24)
**Commit Message**: fix(mito2): keep a caught-up region writable on candidate leases (#10590)

* fix(mito2): keep a caught-up region writable on candidate leases

A region that a catchup made writable waits for its Leader lease until the
route switch. Meanwhile the metasrv keeps granting it Follower leases that
carry a candidate_lease_id, and each of them demoted the region, so the next
upgrade attempt had to catch it up again.

A Follower lease that carries a candidate_lease_id now leaves a region that
awaits its Leader lease alone. It checks the wait under the promotion fence,
so a concurrent catchup promotion is either seen or happens after the
demotion. Other Follower leases, and candidate leases to a region that does
not wait, demote it as before.

The store-api contract now says an engine may use the presence of the id
this way; it still must not interpret its value.

Signed-off-by: jeremyhi <[REDACTED_EMAIL]>

* docs(mito2): clarify the candidate lease wait and its tests

Describe the condition demote_candidate checks, name both lease kinds that
end the wait in the store-api contract, and check that a candidate lease
keeps a waiting physical region a leader that is not confirmed.

Signed-off-by

**File**: `src/meta-srv/src/region/lease_keeper.rs` (modified, +83/-7)
```diff
@@ -20,7 +20,7 @@ use common_meta::key::TableMetadataManagerRef;
 use common_meta::key::table_route::TableRouteValue;
 use common_meta::region_keeper::{MemoryRegionKeeperRef, OperatingRegion};
 use common_meta::rpc::router::RegionRoute;
-use common_telemetry::{info, warn};
+use common_telemetry::{debug, info, warn};
 use snafu::ResultExt;
 use store_api::region_engine::{GrantedRegion, RegionRole};
 use store_api::storage::{RegionId, TableId};
@@ -97,10 +97,20 @@ fn renew_region_lease_via_operating_regions(
             region_lease_info.candidate_lease_id = operating_region.candidate_lease_id;
         }
         if role != reported_role {
-            info!(
-                "The region {} on datanode {} is operating with role {:?}, but reported as {:?}",
-                region_id, datanode_id, role, reported_role
-            );
+            // A candidate lease id with a reported Leader means a migration target that a catchup
+            // promoted before the route switch, which is expected until the switch.
+            if region_lease_info.candidate_lease_id.is_some() && reported_role == RegionRole::Leader
+            {
+                debug!(
+                    "The candidate region {} on datanode {} is operating with role {:?}, but reported as {:?}",
+                    region_id, datanode_id, role, reported_role
+                );
+            } else {
+                info!(
+                    "The region {} on datanode {} is operating with role {:?}, but reported as {:?}",
+                    region_id, datanode_id, role, reported_role
+                );
+            }
         }
         return Some(region_lease_info);
     }
@@ -291,7 +301,7 @@ impl RegionLeaseKeeper {
 #[cfg(test)]
 mod tests {
     use std::collections::{HashMap, HashSet};
-    use std::sync::Arc;
+    use std::sync::{Arc, Mutex};
 
     use common_meta::DatanodeId;
     use common_meta::key::TableMetadataManager;
@@ -305,7 +315,10 @@ mod tests {
     use store_api::storage::RegionId;
     use table::metadata::TableInfo;
 
-    use super::{RegionLeaseKeeper, renew_region_lease_via_region_route};
+    use super::{
+        RegionLeaseKeeper, renew_region_lease_via_operating_regions,
+        renew_region_lease_via_region_route,
+    };
     use crate::region::lease_keeper::{RegionLeaseInfo, RenewRegionLeasesResponse};
 
     fn new_test_keeper() -> RegionLeaseKeeper {
@@ -317,6 +330,69 @@ mod tests {
         RegionLeaseKeeper::new(table_metadata_manager, opening_region_keeper)
     }
 
+    #[derive(Clone, Default)]
+    struct LevelCapture(Arc<Mutex<Vec<tracing::Level>>>);
+
+    impl<S: tracing::Subscriber> tracing_subscriber::Layer<S> for LevelCapture {
+        fn on_event(
+            &self,
+            event: &tracing::Event<'_>,
+            _: tracing_subscriber::layer::Context<'_, S>,
+        ) {
+            self.0.lock().unwrap().push(*event.metadata().level());
+        }
+    }
+
+    /// The expected mismatch of a migration target that a catchup promoted logs at debug; every
+    /// other mismatch logs at info, and a matching role logs nothing.
+    #[test]
+    fn test_role_mismatch_log_level_of_operating_region() {
+        use tracing::Level;
+        use tracing_subscriber::layer::SubscriberExt;
+
+        let region_id = RegionId::new(1024, 1);
+        let log_levels = |role, candidate_lease_id, reported_role, table_route_exists| {
+            let capture = LevelCapture::default();
+            let subscriber = tracing_subscriber::registry().with(capture.clone());
+            let operating_regions = HashMap::from([(
+                region_id,
+                OperatingRegion {
+                    role,
+                    candidate_lease_id,
+                },
+            )]);
+            tracing::subscriber::with_default(subscriber, || {
+                renew_region_lease_via_operating_regions(
+                    &operating_regions,
+                    1,
+                    region_id,
+                    reported_role,
+                    table_route_exists,
+                )
+                .unwrap();
+            });
+            capture.0.lock().unwrap().clone()
+        };
+        let follower = RegionRole::Follower;
+        let leader = RegionRole::Leader;
+
+        assert_eq!(
+            log_levels(follower, Some(7), leader, true),
+            vec![Level::DEBUG]
+        );
+        assert_eq!(log_levels(follower, None, leader, true), vec![Level::INFO]);
+        assert_eq!(
+            log_levels(follower, Some(7), leader, false),
+            vec![Level::INFO]
+        );
+        assert_eq!(
+            log_levels(follower, Some(7), RegionRole::DowngradingLeader, true),
+            vec![Level::INFO]
+        );
+        assert!(log_levels(follower, Some(7), follower, true).is_empty());
+        assert!(log_levels(leader, Some(7), leader, true).is_empty());
+    }
+
     #[test]
     fn test_renew_region_lease_via_region_route() {
         let region_id =
```

**File**: `src/metric-engine/src/engine.rs` (modified, +24/-2)
```diff
@@ -1137,7 +1137,7 @@ mod test {
     }
 
     #[tokio::test]
-    async fn test_physical_region_is_confirmed_leader_only_with_both_regions() {
+    async fn test_physical_region_is_confirmed_leader_only_after_both_leader_leases() {
         let env = TestEnv::new().await;
         env.init_metric_region().await;
         let (engine, mito) = (env.metric(), env.mito());
@@ -1173,8 +1173,30 @@ mod test {
         assert_eq!(engine.role(physical_region_id), Some(RegionRole::Leader));
         assert_eq!(engine.is_confirmed_leader(physical_region_id), Some(false));
 
-        // The data region still waits after the metadata region received its lease.
+        // A candidate lease leaves both waiting regions writable, and the physical region
+        // unconfirmed, so an upgrade still catches it up.
         let sent_at = Instant::now();
+        assert!(
+            engine
+                .set_region_role_with_lease(
+                    physical_region_id,
+                    RegionRole::Follower,
+                    sent_at,
+                    sent_at + LEASE,
+                    Some(7),
+                )
+                .unwrap()
+        );
+        for region_id in [
+            metadata_region_id,
+            utils::to_data_region_id(physical_region_id),
+        ] {
+            assert_eq!(mito.role(region_id), Some(RegionRole::Leader));
+        }
+        assert_eq!(engine.role(physical_region_id), Some(RegionRole::Leader));
+        assert_eq!(engine.is_confirmed_leader(physical_region_id), Some(false));
+
+        // The data region still waits after the metadata region received its lease.
         mito.set_region_role_with_lease(
             metadata_region_id,
             RegionRole::Leader,
```

**File**: `src/mito2/AGENTS.md` (modified, +2/-1)
```diff
@@ -241,7 +241,8 @@ Tests live next to the code as `*_test.rs` (e.g. `src/mito2/src/engine/flush_tes
   its memtable for the next Leader lease (`catch_up_again`, `handle_caught_up_again`); the datanode
   upgrade handler sends that catchup unless `RegionEngine::is_confirmed_leader` is true, so an
   engine wrapping mito must implement that method from mito's answers (the metric engine requires
-  both regions of the pair).
+  both regions of the pair). A Follower lease that carries a `candidate_lease_id` leaves a waiting
+  region alone (`ManifestContext::demote_candidate`); other Follower leases demote it.
 - The latest lease each region received (`GrantedLeases` in `lease.rs`) lives outside the
   region instance, so a reopen during catchup keeps it. Every path that removes a region from
   a worker's region map must also remove its record and its kept index build retries:
```

**File**: `src/mito2/src/engine.rs` (modified, +9/-1)
```diff
@@ -1823,7 +1823,15 @@ impl RegionEngine for MitoEngine {
             self.inner
                 .notify_if_leader_lease_wait_ended(&region, ended_wait);
         }
-        let previous = region.set_role(role);
+        // A Follower lease carrying a candidate lease id goes to a migration's target. It leaves
+        // the state of a region that awaits its Leader lease unchanged instead of demoting it, and
+        // still counts as applied. Keep this out of `MitoRegion::set_role`, whose other callers
+        // must demote such a region.
+        let previous = if role == RegionRole::Follower && candidate_lease_id.is_some() {
+            region.manifest_ctx.demote_candidate(region_id)
+        } else {
+            region.set_role(role)
+        };
         self.inner.notify_if_can_no_longer_replay(&region, previous);
         Ok(true)
     }
```

**File**: `src/mito2/src/engine/lease_test.rs` (modified, +45/-0)
```diff
@@ -894,6 +894,51 @@ async fn test_catchup_again_drops_unflushed_rows_under_local_wal() {
     assert_eq!(count_rows(&engine).await, 0);
 }
 
+/// A candidate lease leaves a region that awaits its Leader lease writable, also the replacement a
+/// catchup again swapped in; other Follower leases, and candidate leases after the Leader lease,
+/// demote it.
+#[rstest]
+#[case::awaiting_leader_lease(false, false)]
+#[case::caught_up_again(false, true)]
+#[case::leader_lease_received(true, false)]
+#[tokio::test]
+async fn test_candidate_lease_after_catchup(
+    #[case] leader_lease_received: bool,
+    #[case] catch_up_again: bool,
+) {
+    common_telemetry::init_default_ut_logging();
+    let mut env = TestEnv::with_prefix("candidate-lease-after-catchup").await;
+    let (_listener, engine, _schema) = create_region(&mut env, None).await;
+    promote_to_await_leader_lease(&engine, REGION_ID).await;
+    if catch_up_again {
+        let region = engine.get_region(REGION_ID).unwrap();
+        catchup(&engine).await.unwrap();
+        assert!(!Arc::ptr_eq(
+            &region,
+            &engine.get_region(REGION_ID).unwrap()
+        ));
+    }
+    if leader_lease_received {
+        grant_at(&engine, RegionRole::Leader, Instant::now(), None);
+    }
+    let region = engine.get_region(REGION_ID).unwrap();
+
+    assert!(grant_at(
+        &engine,
+        RegionRole::Follower,
+        Instant::now(),
+        Some(7)
+    ));
+    assert_eq!(region.is_writable(), !leader_lease_received);
+    assert_eq!(
+        region.manifest_ctx.awaits_leader_lease(),
+        !leader_lease_received
+    );
+
+    grant_at(&engine, RegionRole::Follower, Instant::now(), None);
+    assert!(region.is_follower());
+}
+
 /// Opens a region whose opener filled in the partition expression its manifest lacks and makes
 /// it writable by a catchup, after which it awaits its Leader lease. Returns the engine and the
 /// expression.
```

**File**: `src/mito2/src/region.rs` (modified, +45/-0)
```diff
@@ -2299,6 +2299,21 @@ impl ManifestContext {
         self.record_leader_lease(issued_at)
     }
 
+    /// Demotes the region to a follower for a lease the metasrv granted to it as the candidate of
+    /// a migration, unless the region [awaits its Leader lease](Self::awaits_leader_lease) (a
+    /// catchup of the migration promoted it, and the route switch that follows grants that lease).
+    /// Returns the state this call replaced, None if it left the state unchanged.
+    ///
+    /// It holds the lock of [Self::promote_after_catchup], so a promotion is either seen or
+    /// happens after the demotion.
+    pub(crate) fn demote_candidate(&self, region_id: RegionId) -> Option<RegionRoleState> {
+        let _fence = self.promotion_fence.lock().unwrap();
+        if self.awaits_leader_lease() {
+            return None;
+        }
+        self.set_role(RegionRole::Follower, region_id)
+    }
+
     /// Ends a catchup that does not promote the region, so the next Leader lease promotes it.
     pub(crate) fn end_catchup(&self) {
         self.promotion_fence.lock().unwrap().catching_up = false;
@@ -3429,6 +3444,36 @@ mod tests {
         assert!(region.manifest_ctx.awaits_leader_lease());
     }
 
+    /// A candidate lease reads the wait for a Leader lease under the fence lock, so it does not
+    /// demote a region that a catchup promotes meanwhile.
+    #[tokio::test]
+    async fn test_candidate_demotion_sees_catchup_promotion_under_fence() {
+        let env = SchedulerEnv::new().await;
+        let region = Arc::new(build_test_region(&env).await);
+        region.manifest_ctx.node_lease.enable();
+        // A writable leader, so a demotion that misses the fence returns Some and fails below.
+        assert!(region.is_writable());
+        assert!(!region.manifest_ctx.awaits_leader_lease());
+        let demoted = run_blocked_on_fence(
+            &region,
+            |r| r.manifest_ctx.demote_candidate(r.region_id),
+            // What a catchup's promotion does under the lock.
+            |fence| {
+                assert!(region.manifest_ctx.promote_unless_reload_pending(
+                    fence,
+                    region.region_id,
+                    true
+                ))
+            },
+        );
+        assert_eq!(demoted, None);
+        assert!(region.manifest_ctx.awaits_leader_lease());
+        assert_eq!(
+            region.state(),
+            RegionRoleState::Leader(RegionLeaderState::Writable)
+        );
+    }
+
     /// The readiness of an upgrade reads the role and the wait for a Leader lease under the fence
     /// lock, so it sees a change of both made under that lock as a whole.
     #[tokio::test]
```

**File**: `src/store-api/src/region_engine.rs` (modified, +9/-4)
```diff
@@ -185,9 +185,12 @@ impl SetRegionRoleStateResponse {
 pub struct GrantedRegion {
     pub region_id: RegionId,
     pub region_role: RegionRole,
-    /// An opaque non-zero id the metadata plane attaches to some leases, `None` for a lease
-    /// without one. It reaches the engine through [`RegionEngine::set_region_role_with_lease`];
-    /// engines may keep it with the lease and must not interpret it.
+    /// A non-zero id the metadata plane attaches to the Follower leases of a region migration's
+    /// target before the route names that target, `None` for a lease without one. It reaches the
+    /// engine through [`RegionEngine::set_region_role_with_lease`]. An engine may keep it with the
+    /// lease, and may use its presence to keep such a lease from demoting a region that the
+    /// migration's catchup made writable and that still awaits a Leader or StagingLeader lease.
+    /// Engines must not interpret its value.
     pub candidate_lease_id: Option<u64>,
     pub extensions: HashMap<String, Vec<u8>>,
 }
@@ -1536,7 +1539,9 @@ pub trait RegionEngine: Send + Sync {
     /// deadline of its latest Leader or StagingLeader lease. Leases of other roles do not extend
     /// that deadline.
     ///
-    /// `candidate_lease_id` is the lease's [GrantedRegion::candidate_lease_id].
+    /// `candidate_lease_id` is the lease's [GrantedRegion::candidate_lease_id]. A Follower lease
+    /// that carries one may leave a region that a catchup made writable alone until its Leader or
+    /// StagingLeader lease, see [`is_confirmed_leader`](Self::is_confirmed_leader).
     fn set_region_role_with_lease(
         &self,
         region_id: RegionId,
```

#### Recent Merged Pull Requests:
- **PR #10605** (2026-11-24): fix(datatypes): bounds-check Vector::get and get_ref [Backport release/v1.3] (@MichaelScofield)
- **PR #10604** (2026-11-24): fix(meta): persist segmented procedure checkpoints atomically on RDS (@WenyXu)
- **PR #10601** (2026-11-24): ci: make nightly merge opt-out and simplify Docbot labels (@shuiyisong)
- **PR #10599** (2026-11-24): fix(servers)!: validate UTF-8 in unchecked Prometheus validation mode [Backport release/v1.3] (@MichaelScofield)
- **PR #10596** (2026-11-24): fix(deps): upgrade url to 2.5.9 (@fengys1996)
- **PR #10595** (2026-11-24): chore: fix cargo-shear warnings in common-telemetry and session (@fengys1996)

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

## X. promql): answer a named selector over a missing table with the empty vector

**RULE**:
When implementing operations in `src/query/src/promql/planner/native.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in GreptimeTeam/greptimedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `883ae6ea`: promql): answer a named selector over a missing table with the empty vector. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/query/src/promql/planner/native.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
            let time_index = free_time_index(DEFAULT_TIME_INDEX_COLUMN, &value_names, &output_tags);
                        // narrows the field set of a scan this route can read, and a selector that matched
                        // no table has no scan to narrow: the answer is the empty vector either way, exactly
                        // as the named branch below answers a missing table.
                    // The selector names a metric whose table does not exist, so the query still has an
                    // answer: the empty vector, planned from the same typed empty input a nameless selector
                    // that matched no table is. Planning it here keeps `TableNameNotFound` out of the
                    // existing planner, which has no table to bind.
                    //
                    // A `__field__` matcher does not decline here, though one over a scan this route can
                    // read does: it narrows the field set of the table its selector reads, and this table has
                    // no field set to narrow, so every field selection over it is empty. The existing planner
                    // answers the same way, because a missing tab
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
            // A label named `time` is the one collision the default time column can have: the
            // value columns are named after the expression, so they never take that name. The
            // time column is this route's own synthetic name - no label or value is renamed - so
            // a statement whose output already holds a `time` column publishes its grid under the
            // first free `native_time_N` instead of dropping or renaming the label.
            let time_index = if value_names
                .iter()
                .chain(&output_tags)
                .any(|name| name == DEFAULT_TIME_INDEX_COLUMN)
            {
                (0usize..)
                    .map(|index| format!("native_time_{index}"))
                    .find(|candidate| {
                        !value_names
                            .iter()
                            .chain(&output_tags)
                            .any(|name| name == candidate)
                    })
                    .expect("the time column candidate sequence is unbounded")
            } else {
                DEFAULT_TIME_INDEX_COLUMN.to_string()
            };
                        // is declined fo
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `883ae6ea` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
