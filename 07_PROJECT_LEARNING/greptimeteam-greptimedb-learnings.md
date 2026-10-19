> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/greptimeteam-greptimedb-learnings.md`  
> **Source**: github ([https://github.com/GreptimeTeam/greptimedb](https://github.com/GreptimeTeam/greptimedb))  
> **Source Version**: `baa56301`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T03:33:09.235Z  
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
> **Harvest Timestamp**: 2026-10-19T03:33:09.227Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GreptimeTeam/greptimedb`
- **Description**: The open-source observability database. One columnar engine for metrics, logs, and traces, on object storage.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6745 stars

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

use std::sync::Weak;

use common_meta::key::TableMetadataManagerRef;
use snafu::OptionExt;

use crate::CatalogManager;
use crate::error::{GetInformationExtensionSnafu, Result, UpgradeWeakCatalogManagerRefSnafu};
use crate::information_schema::InformationExtensionRef;
use crate::kvbackend::KvBackendCatalogManager;
use crate::system_schema::semantic_graph::EntityGraphProviderRef;

pub mod tables;

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
- **Issue #9713** (2026-10-19): **fix(puffin): keep puffin_metadata cache bytes non-negative**
  *Symptoms*: ## Summary - Adjust `PuffinMetadataCache` gauge updates so replacements do not subtract twice from `greptime_mito_cache_bytes{type="puffin_metadata"}`. - Skip `RemovalCause::Replaced` in the eviction listener and subtract the previous entry weight before inserting an updated value.  Fixes #5727.  ## Test plan - [ ] CI (fork PR checks) 
  **Post-Mortem & Fix Analysis**:
  > Thanks for looking into this. The missing gauge increment was already fixed in #7539, merged on January 13, 2026. Before that change, put_metadata() inserted entries without increasing the gauge, while the eviction listener decreased it.  Current main adds the new entry weight before insertion, and the Moka replacement notification subtracts the old entry weight. That balances correctly without a double subtraction.  The proposed get-then-insert accounting introduces a race: an entry can be invalidated after get(), causing both the eviction listener and put_metadata() to subtract its weight. Concurrent inserts for an absent key can also overcount because replacement notifications are ignored.  Closing as unnecessary. If negative values can still be reproduced on current main, please share a reproduction so we can investigate that separately.

- **Issue #9696** (2026-10-18): **feat(promql): match vectors holding native histograms**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  MATCH-HIST in internal-docs#27. Builds on #9679 (`vector_match`) and #9686 (`FloatHistogram`).  ## What's changed and what's your intention?  ### Problem `binary_vectors` and `set_vectors` rejected native histogram samples with `NotImplemented`.  ### Change - `vector_match::elem_binop` ports Prometheus `vectorElemBinop` for histograms:   - histogram `+`/`-` histogram, compacted, with `-` marking the result as a gauge;   - histogram `==`/`!=` histogram, layout-sensitive like Go's `Equals`, keeping the left histogram;   - histogram `*` float, float `*` histogram, histogram `/` float, compacted. - Every other pairing that involves a histogram, and a `+`/`-` between exponential and custom buckets, is skipped: no result, `bool` included, and the pair does not count as a match. This follows Prometheus, which reports these as annotations before recording the match. - The one-to-one "multiple matches" check now counts the matches actually made per group and point, so skipped pairs do not count. - Set operators carry histogram values through; results with histograms are built with `GridSeriesBuilder::push_samples`. - Operand presence no longer reads values, and the helpers that could only fail on histograms are infallible now.  Review focus: - `elem_binop` against `vectorElemBinop`: which pairings keep, filter or skip. - `bi

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

### Incident Patch 1: `deae75ff` (2026-10-15)
**Commit Message**: fix(log-store): refuse to open object store WAL regions whose history is missing (#9561)

* fix(log-store): refuse to open object store WAL regions whose history is missing

A region persists only its WAL prefix, not the object store that holds it.
After `[wal].storage_provider`, or the bucket or root of the provider it
names, changes, or after the objects under the prefix are deleted, every
region reopened against a prefix without its history, replayed nothing and
silently lost its acknowledged writes that were not flushed.

Add `LogStore::check_region_history` and `LogStore::start_region_history`,
whose defaults accept and do nothing, so Raft Engine and Kafka are
unchanged. The object store WAL reports the history of a region as missing
when recovery found no object under the prefix, or when the region's
watermark names an object above the newest object holding entries that
recovery indexed, unless the catalog holds the region's entries through the
watermark or the region's history starts in the store. Both rest on
invariants of the prefix: an opened prefix is never empty, and a persisted
watermark names an object at or below the newest object holding entries,
which collection ne

**File**: `config/config.md` (modified, +2/-0)
```diff
@@ -131,6 +131,7 @@
 | `wal.max_unpersisted_bytes` | String | `64MB` | The size of the unpersisted backlog at which new appends stall until an upload completes, in `enqueued` mode.<br/>Nothing is dropped and nothing is rejected; the threshold does not bound what a crash during an outage can lose.<br/>**It's only used when the provider is `experimental_object_store` and `ack_mode` is `enqueued`**. |
 | `wal.max_unpersisted_age` | String | `8s` | The age of the oldest unpersisted entry at which new appends stall until an upload completes, in `enqueued` mode.<br/>**It's only used when the provider is `experimental_object_store` and `ack_mode` is `enqueued`**. |
 | `wal.on_corrupted_segment` | String | `skip` | What a read does with a segment that still does not decode after a second fetch, because its checksum does not match or its content disagrees with its footer entry.<br/>- `skip`: the segment is skipped and recorded as a WAL hole of its region, a metric is incremented and a warning is logged; the other regions of the object are unaffected (the default).<br/>- `fail`: the read fails, so the region does not open.<br/>**It's only used when the provider is `experimental_object_store`**. |
+| `wal.accept_missing_history` | Bool | `false` | Whether a region opens although the WAL objects under the prefix do not hold its history.<br/>An existing region fails to open when the prefix held no object when the WAL opened, or when the flushed entry id of the region names an object above every object of the prefix that holds entries. Both happen after `storage_provider`, or the bucket or root of the provider it names, changed without the WAL objects being copied, or after the objects were deleted.<br/>To move the WAL, stop the instance, copy every object under the prefix to the new location and then change the configuration; the regions open with all their writes.<br/>When the old WAL is lost, set this to `true` for one start: the regions open without their writes that were not flushed, which are lost, a warning names each region, and `greptime_logstore_object_store_wal_missing_history_accepted_total` counts them. Turn it off again once the instance has written to the WAL after that start; until then a later start refuses a region whose flushed entry id names an object above every object of the prefix that holds entries.<br/>**It's only used when the provider is `experimental_object_store`**. |
 | `metadata_store` | -- | -- | Metadata storage options. |
 | `metadata_store.file_size` | String | `64MB` | The size of the metadata store log file. |
 | `metadata_store.purge_threshold` | String | `256MB` | The threshold of the metadata store size to trigger a purge. |
@@ -614,6 +615,7 @@
 | `wal.max_unpersisted_bytes` | String | `64MB` | The size of the unpersisted backlog at which new appends stall until an upload completes, in `enqueued` mode.<br/>Nothing is dropped and nothing is rejected; the threshold does not bound what a crash during an outage can lose.<br/>**It's only used when the provider is `experimental_object_store` and `ack_mode` is `enqueued`**. |
 | `wal.max_unpersisted_age` | String | `8s` | The age of the oldest unpersisted entry at which new appends stall until an upload completes, in `enqueued` mode.<br/>**It's only used when the provider is `experimental_object_store` and `ack_mode` is `enqueued`**. |
 | `wal.on_corrupted_segment` | String | `skip` | What a read does with a segment that still does not decode after a second fetch, because its checksum does not match or its content disagrees with its footer entry.<br/>- `skip`: the segment is skipped and recorded as a WAL hole of its region, a metric is incremented and a warning is logged; the other regions of the object are unaffected (the default).<br/>- `fail`: the read fails, so the region does not open.<br/>**It's only used when the provider is `experimental_object_store`**. |
+| `wal.accept_missing_history` | Bool | `false` | Whether a region opens although the WAL objects under the prefix do not hold its history.<br/>An existing region fails to open when the prefix held no object when the WAL opened, or when the flushed entry id of the region names an object above every object of the prefix that holds entries. Both happen after `storage_provider`, or the bucket or root of the provider it names, changed without the WAL objects being copied, or after the objects were deleted.<br/>To move the WAL, stop the instance, copy every object under the prefix to the new location and then change the configuration; the regions open with all their writes.<br/>When the old WAL is lost, set this to `true` for one start: the regions open without their writes that were not flushed, which are lost, a warning names each region, and `greptime_logstore_object_store_wal_missing_history_accepted_total` counts them. Turn it off again once the instance has written to the WAL after that start; until then a later start refuses a region whose flushed entry id names an object abo
```

**File**: `config/datanode.example.toml` (modified, +7/-0)
```diff
@@ -258,6 +258,13 @@ overwrite_entry_start_id = false
 ## **It's only used when the provider is `experimental_object_store`**.
 #+ on_corrupted_segment = "skip"
 
+## Whether a region opens although the WAL objects under the prefix do not hold its history.
+## An existing region fails to open when the prefix held no object when the WAL opened, or when the flushed entry id of the region names an object above every object of the prefix that holds entries. Both happen after `storage_provider`, or the bucket or root of the provider it names, changed without the WAL objects being copied, or after the objects were deleted.
+## To move the WAL, stop the instance, copy every object under the prefix to the new location and then change the configuration; the regions open with all their writes.
+## When the old WAL is lost, set this to `true` for one start: the regions open without their writes that were not flushed, which are lost, a warning names each region, and `greptime_logstore_object_store_wal_missing_history_accepted_total` counts them. Turn it off again once the instance has written to the WAL after that start; until then a later start refuses a region whose flushed entry id names an object above every object of the prefix that holds entries.
+## **It's only used when the provider is `experimental_object_store`**.
+#+ accept_missing_history = false
+
 # The Kafka SASL configuration.
 # **It's only used when the provider is `kafka`**.
 # Available SASL mechanisms:
```

**File**: `config/standalone.example.toml` (modified, +7/-0)
```diff
@@ -449,6 +449,13 @@ overwrite_entry_start_id = false
 ## **It's only used when the provider is `experimental_object_store`**.
 #+ on_corrupted_segment = "skip"
 
+## Whether a region opens although the WAL objects under the prefix do not hold its history.
+## An existing region fails to open when the prefix held no object when the WAL opened, or when the flushed entry id of the region names an object above every object of the prefix that holds entries. Both happen after `storage_provider`, or the bucket or root of the provider it names, changed without the WAL objects being copied, or after the objects were deleted.
+## To move the WAL, stop the instance, copy every object under the prefix to the new location and then change the configuration; the regions open with all their writes.
+## When the old WAL is lost, set this to `true` for one start: the regions open without their writes that were not flushed, which are lost, a warning names each region, and `greptime_logstore_object_store_wal_missing_history_accepted_total` counts them. Turn it off again once the instance has written to the WAL after that start; until then a later start refuses a region whose flushed entry id names an object above every object of the prefix that holds entries.
+## **It's only used when the provider is `experimental_object_store`**.
+#+ accept_missing_history = false
+
 # The Kafka SASL configuration.
 # **It's only used when the provider is `kafka`**.
 # Available SASL mechanisms:
```

**File**: `docs/rfcs/2026-09-06-object-store-wal.md` (modified, +22/-9)
```diff
@@ -50,7 +50,7 @@ The provider is added to the four parallel WAL enums so that every resolution pa
 
 Two choices are deliberate:
 
-- The persisted `WalOptions` carry the derived node prefix `<prefix>/datanodes/<node_id>/epochs/<generation>` described under *Object format*, not the configured root. On reopen the log store compares the persisted prefix with the one it runs under and fails fast on a mismatch, so an operator who changes the prefix or the node id cannot silently point a region at an empty WAL. Changing the prefix of an existing region requires an explicit migration, which is out of scope here.
+- The persisted `WalOptions` carry the derived node prefix `<prefix>/datanodes/<node_id>/epochs/<generation>` described under *Object format*, not the configured root. On reopen the log store compares the persisted prefix with the one it runs under and fails fast on a mismatch, so an operator who changes the prefix or the node id cannot silently point a region at an empty WAL. Changing the prefix of an existing region requires an explicit migration, which is out of scope here. The prefix does not name the object store that holds it, so changing `storage_provider`, or the bucket or root of the provider it names, keeps the prefix; the history check under *Log store* catches such a change when a region opens.
 - `Provider::ObjectStore` is classified as a remote WAL. Mito's remote-WAL branches (initial flushed entry id from `latest_entry_id`, `topic_latest_entry_id` after replay, region-scoped reads, no topic grouping on batch open) apply unchanged. This is a classification of replay semantics, not of physical location.
 
 A datanode that is configured with a metasrv client rejects the provider before any store is built: `DatanodeBuilder` returns an error stating that the object store WAL is standalone-only. Separately, `DatanodeWalConfig::ObjectStore` cannot be converted into `MetasrvWalConfig`, so a metasrv cannot be configured with it either. The standalone bootstrap matches the datanode WAL configuration before that conversion and constructs `WalProvider::ObjectStore` directly.
@@ -102,11 +102,11 @@ Positions start at one, so entry id zero is never assigned: Mito treats zero as
 
 `latest_entry_id(provider)` is region-scoped: the highest entry id durable under the prefix for the provider's region, or zero when the region has none. A freshly created region therefore starts at zero even if other regions under the prefix have entries. This differs from Kafka, whose high watermark is per topic; it is sufficient here because ids are per region, and Mito consumes the value only for the region that asked.
 
-Two rules keep every new id of a region above every id it already has, on a prefix that already holds objects and across the watermark Mito hands the store. On open, the next object sequence is the larger of the largest listed sequence plus one, orphans included, and, over every region, the object named by the region's largest existing entry id plus one, that is `(max_entry_id >> 20) + 1`, so that the catalog's strictly increasing ranges hold; sequence gaps are tolerated, and a sequence at or above `2^44` is rejected as exhausted. Objects written under an earlier contiguous scheme are not rewritten: they remain readable, their ids carry no object information, and the rule places them by their high bits just the same.
+Two rules keep every new id of a region above every id it already has, on a prefix that already holds objects and across the watermark Mito hands the store. On open, the next object sequence is the larger of the largest listed sequence plus one, orphans included, and, over every region, the object named by the region's largest existing entry id plus one, that is `(max_entry_id >> 20) + 1`, so that the catalog's strictly increasing ranges hold; sequence gaps are tolerated, and a sequence at or above `2^44` is rejected as exhausted. Ids have been object-sequence-major since the first version of the provider; a contiguous scheme existed only in the reference implementation before release, so no deployed prefix holds ids without object information, and the history check under *Log store* relies on that.
 
-The second rule is the sequence floor of `obsolete`. Mito calls `obsolete` with the manifest's `flushed_entry_id` when it opens a region, and the actor applies the watermark and a floor derived from that entry id together: the next object sequence is raised to `(entry_id >> 20) + 1` unless it is there already, while zero, the watermark of a region without entries, names no object and needs no floor, so that a watermark assigned under another prefix, or one whose object this prefix no longer holds, is never passed by a new id. The floor moves only the next sequence, never the chain: the next batch still links to its predecessor, so a skipped sequence leaves no gap in the history recovery replays. While the open batch holds ids under the next sequence, the call is refused with a retryable error a
```

**File**: `src/common/wal/src/config.rs` (modified, +4/-0)
```diff
@@ -298,6 +298,7 @@ mod tests {
         assert_eq!(config.max_unpersisted_bytes, ReadableSize::mb(64));
         assert_eq!(config.max_unpersisted_age, Duration::from_secs(8));
         assert_eq!(config.on_corrupted_segment, CorruptedSegmentAction::Skip);
+        assert!(!config.accept_missing_history);
         assert!(matches!(
             MetasrvWalConfig::try_from(datanode_wal_config).unwrap_err(),
             Error::UnsupportedWalProvider { .. }
@@ -313,6 +314,7 @@ mod tests {
             max_unpersisted_bytes = "32MB"
             max_unpersisted_age = "4s"
             on_corrupted_segment = "fail"
+            accept_missing_history = true
         "#;
         let datanode_wal_config: DatanodeWalConfig = toml::from_str(toml_str).unwrap();
         let expected = ObjectStoreWalConfig {
@@ -324,6 +326,7 @@ mod tests {
             max_unpersisted_bytes: ReadableSize::mb(32),
             max_unpersisted_age: Duration::from_secs(4),
             on_corrupted_segment: CorruptedSegmentAction::Fail,
+            accept_missing_history: true,
         };
         assert_eq!(
             datanode_wal_config,
@@ -334,6 +337,7 @@ mod tests {
         assert_eq!(table["ack_mode"].as_str(), Some("enqueued"));
         assert_eq!(table["max_unpersisted_bytes"].as_str(), Some("32MiB"));
         assert_eq!(table["max_unpersisted_age"].as_str(), Some("4s"));
+        assert_eq!(table["accept_missing_history"].as_bool(), Some(true));
         assert_eq!(
             datanode_wal_config,
             toml::from_str::<DatanodeWalConfig>(&serialized).unwrap()
```

**File**: `src/common/wal/src/config/object_store.rs` (modified, +6/-0)
```diff
@@ -81,6 +81,11 @@ pub struct ObjectStoreWalConfig {
     /// second fetch, because its checksum does not match or its content
     /// disagrees with its footer entry, defaults to `skip`.
     pub on_corrupted_segment: CorruptedSegmentAction,
+    /// Whether a region whose WAL history the configured location does not
+    /// hold opens anyway, with its writes that were not flushed lost, instead
+    /// of failing to open, defaults to false. Meant for one start after the
+    /// old WAL location is lost.
+    pub accept_missing_history: bool,
 }
 
 impl Default for ObjectStoreWalConfig {
@@ -94,6 +99,7 @@ impl Default for ObjectStoreWalConfig {
             max_unpersisted_bytes: ReadableSize::mb(64),
             max_unpersisted_age: Duration::from_secs(8),
             on_corrupted_segment: CorruptedSegmentAction::Skip,
+            accept_missing_history: false,
         }
     }
 }
```

**File**: `src/log-store/src/error.rs` (modified, +33/-0)
```diff
@@ -424,6 +424,37 @@ pub enum Error {
         location: Location,
     },
 
+    #[snafu(display(
+        "Object store WAL prefix {} on {} does not hold the history of region {}: {}. \
+         If the WAL was moved, stop the instance, copy every object under the prefix from the \
+         old location to this one and start again. If the old WAL is lost, start once with \
+         `[wal].accept_missing_history = true`, which opens the region without its writes that \
+         were not flushed, and turn the option off again once the instance has written to the WAL",
+        prefix,
+        storage,
+        region_id,
+        reason
+    ))]
+    MissingWalHistory {
+        region_id: RegionId,
+        prefix: String,
+        /// The storage the prefix is read from, as configured.
+        storage: String,
+        reason: String,
+        #[snafu(implicit)]
+        location: Location,
+    },
+
+    #[snafu(display(
+        "Object store WAL gave up its start object {} after refusing a region without its history, and accepts nothing more until it opens again",
+        path
+    ))]
+    WalStartWithdrawn {
+        path: String,
+        #[snafu(implicit)]
+        location: Location,
+    },
+
     #[snafu(display("Object store WAL log store is stopped"))]
     ObjectStoreWalStopped {
         #[snafu(implicit)]
@@ -478,6 +509,7 @@ impl ErrorExt for Error {
             | OverrideCompactedEntry { .. }
             | InvalidWalObjectStore { .. }
             | MismatchedWalPrefix { .. }
+            | MissingWalHistory { .. }
             | MismatchedWalRegion { .. }
             | IncompleteWalEntry { .. }
             | InvalidWalEntryRange { .. } => StatusCode::InvalidArguments,
@@ -494,6 +526,7 @@ impl ErrorExt for Error {
             | WaitProduceResultReceiver { .. }
             | MetaLengthExceededLimit { .. }
             | ObjectStoreWalStopped { .. }
+            | WalStartWithdrawn { .. }
             | WalSegmentFetch { .. } => StatusCode::Internal,
 
             CorruptedWalObject { .. }
```

**File**: `src/log-store/src/metrics.rs` (modified, +11/-0)
```diff
@@ -97,6 +97,17 @@ lazy_static! {
         "object store logstore skipped corrupted segments total",
     )
     .unwrap();
+
+    /// Counter of regions the object store logstore let open although its
+    /// prefix does not hold their WAL history, because
+    /// `accept_missing_history` is set; their writes that were not flushed
+    /// are lost.
+    pub static ref METRIC_OBJECT_STORE_WAL_MISSING_HISTORY_ACCEPTED_TOTAL: IntCounter = register_int_counter!(
+        "greptime_logstore_object_store_wal_missing_history_accepted_total",
+        "object store logstore regions opened without their WAL history total",
+    )
+    .unwrap();
+
     /// Counter of objects the object store logstore deleted because no
     /// region needs them any more.
     pub static ref METRIC_OBJECT_STORE_WAL_DELETED_OBJECTS_TOTAL: IntCounter = register_int_counter!(
```

---

### Incident Patch 2: `c3469fad` (2026-10-15)
**Commit Message**: fix(flow): retain tracked write completion across transient failures (#9525)

* fix(flow): retain tracked write completion across transient failures

Use receiver-issued single-write capabilities at the frontend and datanode. Rejoin exact admitted writes across unknown transport outcomes, then close and drain before allowing subsequent rounds. Keep ordinary clients and reads on their existing paths.

Separate schema map equality from encoded row identity so fresh protobuf decodes replay consistently even with NaN values. Cover receiver admission, owner cancellation, all-child drain, and retired capabilities.

Local feature-worktree checkpoint only. Main verified core enterprise check and 484 tests, plus DN enterprise check and all four tracked owner tests. Corrected seven-case timer acceptance remains to be rerun; this checkpoint does not authorize publishing or integration.

Signed-off-by: discord9 <[REDACTED_EMAIL]>

* fix(flow): preserve upstream dependencies after rebase

Signed-off-by: discord9 <[REDACTED_EMAIL]>

* fix(flow): fail fast on definitive tracked-write open rejection

A tracked write treats every application-level error from the frontend as
an ambiguous transport f

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -2581,6 +2581,7 @@ dependencies = [
  "tokio-util",
  "tonic 0.14.2",
  "tower 0.5.2",
+ "uuid",
  "vec1",
 ]
 
```

**File**: `licenserc-enterprise.toml` (modified, +5/-0)
```diff
@@ -15,6 +15,11 @@ headerPath = "licenses/enterprise-header.txt"
 # with the "# enterprise" block in `licenserc.toml`'s `excludes` — both are
 # enforced by `make check-enterprise-license`.
 includes = [
+    "src/common/grpc/src/flow_write.rs",
+    "src/frontend/src/instance/flow_write.rs",
+    "src/datanode/src/region_server/flow_write.rs",
+    "src/operator/src/insert/flow_write.rs",
+    "src/flow/src/batching_mode/frontend_client/flow_write.rs",
     "src/common/meta/src/rpc/ddl/trigger.rs",
     "src/operator/src/expr_helper/trigger.rs",
     "src/sql/src/statements/alter/trigger.rs",
```

**File**: `licenserc.toml` (modified, +5/-0)
```diff
@@ -31,6 +31,11 @@ excludes = [
     # Keep this list in sync with that file's `includes`; enforced by
     # `make check-enterprise-license`.
     # enterprise:start
+    "src/common/grpc/src/flow_write.rs",
+    "src/frontend/src/instance/flow_write.rs",
+    "src/datanode/src/region_server/flow_write.rs",
+    "src/operator/src/insert/flow_write.rs",
+    "src/flow/src/batching_mode/frontend_client/flow_write.rs",
     "src/common/meta/src/rpc/ddl/trigger.rs",
     "src/operator/src/expr_helper/trigger.rs",
     "src/sql/src/statements/alter/trigger.rs",
```

**File**: `src/common/grpc/Cargo.toml` (modified, +4/-0)
```diff
@@ -7,6 +7,9 @@ license.workspace = true
 [lints]
 workspace = true
 
+[features]
+enterprise = []
+
 [dependencies]
 api.workspace = true
 arrow-flight.workspace = true
@@ -32,6 +35,7 @@ tokio.workspace = true
 tokio-util.workspace = true
 tonic.workspace = true
 tower.workspace = true
+uuid.workspace = true
 vec1 = "1.12"
 
 [dev-dependencies]
```

**File**: `src/common/grpc/src/flow_write.rs` (added, +477/-0)
```diff
@@ -0,0 +1,477 @@
+// Copyright 2023-2026 GrepTime Inc.
+//
+// This file is part of the GreptimeDB Enterprise Edition and is licensed under
+// the GreptimeDB Enterprise License. You may not use this file except in
+// compliance with that license. A copy of the license is available at the root
+// of this repository in the file LICENSE-ENTERPRISE.
+//
+// Unless required by applicable law or agreed to in writing, this software is
+// distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
+// either express or implied.
+
+use std::collections::HashMap;
+use std::sync::{Arc, Mutex};
+
+use common_error::ext::{ErrorExt, StackError};
+use common_error::status_code::StatusCode;
+
+use common_recordbatch::{RecordBatch, RecordBatches};
+use datatypes::arrow::array::{Array, StringArray};
+use datatypes::prelude::{ConcreteDataType, VectorRef};
+use datatypes::schema::{ColumnSchema, Schema};
+use datatypes::vectors::StringVector;
+use serde::{Deserialize, Serialize};
+use tokio::sync::watch;
+use uuid::Uuid;
+
+pub const COMMAND_KEY: &str = "flow_write_command";
+pub const CHILD_KEY: &str = "flow_write_child";
+
+/// The control command carried by a Flow write request.
+#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
+pub enum Command {
+    Open { nonce: String },
+    Write { capability: String },
+    Close { capability: String },
+}
+
+impl Command {
+    /// Serializes this command as JSON.
+    pub fn encode(&self) -> serde_json::Result<String> {
+        serde_json::to_string(self)
+    }
+
+    /// Parses a serialized command.
+    pub fn decode(value: &str) -> serde_json::Result<Self> {
+        serde_json::from_str(value)
+    }
+}
+
+/// A safe terminal application error.
+#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
+pub struct TerminalError {
+    pub code: u32,
+    pub message: String,
+}
+
+impl std::fmt::Display for TerminalError {
+    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
+        write!(f, "{}", self.message)
+    }
+}
+
+impl std::error::Error for TerminalError {}
+
+impl StackError for TerminalError {
+    fn debug_fmt(&self, layer: usize, buf: &mut Vec<String>) {
+        buf.push(format!("{layer}: {self:?}"));
+    }
+
+    fn next(&self) -> Option<&dyn StackError> {
+        None
+    }
+}
+
+impl ErrorExt for TerminalError {
+    fn status_code(&self) -> StatusCode {
+        StatusCode::from_u32(self.code).unwrap_or(StatusCode::Internal)
+    }
+
+    fn as_any(&self) -> &dyn std::any::Any {
+        self
+    }
+}
+
+/// A finite response for a tracked Flow write.
+#[derive(Debug, Clone, Serialize, Deserialize)]
+pub enum Reply {
+    Opened {
+        capability: String,
+    },
+    Closed,
+    Complete {
+        rows: usize,
+        cost: usize,
+        metrics: Option<common_recordbatch::adapter::RecordBatchMetrics>,
+        error: Option<TerminalError>,
+    },
+}
+
+fn envelope_schema() -> Arc<Schema> {
+    Arc::new(Schema::new(vec![ColumnSchema::new(
+        "envelope",
+        ConcreteDataType::string_datatype(),
+        false,
+    )]))
+}
+
+fn response_error(reason: impl Into<String>) -> common_recordbatch::error::Error {
+    common_recordbatch::error::Error::CreateRecordBatches {
+        reason: reason.into(),
+        location: snafu::Location::new(file!(), line!(), column!()),
+    }
+}
+
+/// Encodes a reply in the finite one-string-column record-batch envelope.
+pub fn reply_batches(reply: &Reply) -> common_recordbatch::error::Result<RecordBatches> {
+    let value = serde_json::to_string(reply).map_err(|e| response_error(e.to_string()))?;
+    let batch = RecordBatch::new(
+        envelope_schema(),
+        vec![Arc::new(StringVector::from(vec![value])) as VectorRef],
+    )?;
+    RecordBatches::try_new(batch.schema.clone(), vec![batch])
+}
+
+/// Decodes a reply from its finite one-string-column record-batch envelope.
+pub fn decode_reply(batches: &RecordBatches) -> common_recordbatch::error::Result<Reply> {
+    let batch = batches
+        .iter()
+        .next()
+        .ok_or_else(|| response_error("missing reply batch"))?;
+    if batches.iter().count() != 1 || batch.num_columns() != 1 || batch.num_rows() != 1 {
+        return Err(response_error("reply must be exactly one string value"));
+    }
+    let values = batch.columns()[0]
+        .as_any()
+        .downcast_ref::<StringArray>()
+        .ok_or_else(|| response_error("reply value is not a string"))?;
+    if values.is_null(0) {
+        return Err(response_error("reply value is null"));
+    }
+    let value = values.value(0);
+    serde_json::from_str(value).map_err(|e| response_error(e.to_string()))
+}
+
+/// Errors that reject admission or indicate that an admitted writer was lost.
+#[derive(Debug, Clone, PartialEq, Eq)]
+pub enum RegistryError {
+    UnknownCapability,
+    Closing,
+    WriterLost,
+    PayloadMismatch,
+}
+
+impl std::fmt::Display for RegistryError {
+    fn fmt(&self, f: &mut s
```

**File**: `src/common/grpc/src/lib.rs` (modified, +2/-0)
```diff
@@ -15,6 +15,8 @@
 pub mod channel_manager;
 pub mod error;
 pub mod flight;
+#[cfg(feature = "enterprise")]
+pub mod flow_write;
 pub mod precision;
 pub mod reloadable_tls;
 pub mod select;
```

**File**: `src/datanode/Cargo.toml` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ license.workspace = true
 
 [features]
 testing = []
-enterprise = ["mito2/enterprise"]
+enterprise = ["mito2/enterprise", "common-grpc/enterprise"]
 
 [lints]
 workspace = true
```

**File**: `src/datanode/src/region_server.rs` (modified, +31/-1)
```diff
@@ -13,6 +13,10 @@
 // limitations under the License.
 
 mod catalog;
+#[cfg(feature = "enterprise")]
+mod flow_write;
+#[cfg(feature = "enterprise")]
+use flow_write::TrackedPayload;
 mod registrations;
 mod remote_dyn_filter;
 
@@ -29,14 +33,17 @@ use api::region::RegionResponse;
 use api::v1::meta::TopicStat;
 use api::v1::region::sync_request::ManifestInfo;
 use api::v1::region::{
-    ListMetadataRequest, RegionResponse as RegionResponseV1, SyncRequest, region_request,
+    ListMetadataRequest, RegionRequest as RegionRequestV1, RegionResponse as RegionResponseV1,
+    SyncRequest, region_request,
 };
 use api::v1::{ResponseHeader, Status};
 use arrow_flight::{FlightData, Ticket};
 use async_trait::async_trait;
 use bytes::Bytes;
 use common_error::ext::{BoxedError, ErrorExt};
 use common_error::status_code::StatusCode;
+#[cfg(feature = "enterprise")]
+use common_grpc::flow_write::{COMMAND_KEY, FlowWriteRegistry, Reply};
 use common_meta::datanode::TopicStatsReporter;
 use common_query::OutputData;
 use common_query::request::QueryRequest;
@@ -115,6 +122,8 @@ pub struct RegionServer {
     inner: Arc<RegionServerInner>,
     flight_compression: FlightCompression,
     suspend: Arc<AtomicBool>,
+    #[cfg(feature = "enterprise")]
+    flow_write_registry: Arc<FlowWriteRegistry<TrackedPayload, Reply>>,
 }
 
 pub struct RegionStat {
@@ -163,6 +172,8 @@ impl RegionServer {
             )),
             flight_compression,
             suspend: Arc::new(AtomicBool::new(false)),
+            #[cfg(feature = "enterprise")]
+            flow_write_registry: Arc::new(FlowWriteRegistry::default()),
         }
     }
 
@@ -925,6 +936,25 @@ impl Stream for RegionWatermarkStream {
 
 #[async_trait]
 impl RegionServerHandler for RegionServer {
+    async fn handle_region_request(
+        &self,
+        request: RegionRequestV1,
+    ) -> ServerResult<RegionResponseV1> {
+        #[cfg(feature = "enterprise")]
+        if request
+            .header
+            .as_ref()
+            .and_then(|header| header.query_context.as_ref())
+            .is_some_and(|context| context.extensions.contains_key(COMMAND_KEY))
+        {
+            return self.handle_flow_write_request(request).await;
+        }
+        let body = request.body.context(servers_error::InvalidQuerySnafu {
+            reason: "Expecting non-empty region request body.",
+        })?;
+        self.handle(body).await
+    }
+
     async fn handle(&self, request: region_request::Body) -> ServerResult<RegionResponseV1> {
         let failed_requests_cnt = crate::metrics::REGION_SERVER_REQUEST_FAILURE_COUNT
             .with_label_values(&[request.as_ref()]);
```

---

### Incident Patch 3: `0dc81777` (2026-10-15)
**Commit Message**: fix(pprof): initialize framehop before signal sampling (#9612)

fix(pprof): pin upstream framehop initialization fix

Pin pprof workspace-wide to 01cff82d containing tikv/pprof-rs#282. Initialize framehop before sampling instead of allocating and discovering shared libraries in the first SIGPROF handler. Regenerate the lockfile without unrelated dependency changes.

Signed-off-by: Lei, HUANG <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +1/-2)
```diff
@@ -11106,8 +11106,7 @@ checksum = "439ee305def115ba05938db6eb1644ff94165c5ab5e9420d1c1bcedbba909391"
 [[package]]
 name = "pprof"
 version = "0.15.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "38a01da47675efa7673b032bf8efd8214f1917d89685e07e395ab125ea42b187"
+source = "git+https://github.com/tikv/pprof-rs?rev=01cff82dbe6fe110a707bf2b38d8ebb1d14a18f8#01cff82dbe6fe110a707bf2b38d8ebb1d14a18f8"
 dependencies = [
  "aligned-vec",
  "backtrace",
```

**File**: `Cargo.toml` (modified, +4/-0)
```diff
@@ -384,6 +384,10 @@ datafusion-pg-catalog = { git = "https://github.com/datafusion-contrib/datafusio
 arrow-pg = { git = "https://github.com/datafusion-contrib/datafusion-postgres.git", rev = "ffb14a52b3d7c7489559812e1ec38096f225ce93" }
 sqlparser = { git = "https://github.com/GreptimeTeam/sqlparser-rs.git", rev = "9e9019bb1c7040ed956f654e39378dd42ab17884" }
 
+# pprof 0.15.0 initializes framehop inside SIGPROF; pin the unreleased fix
+# that initializes it before sampling. Remove once tikv/pprof-rs#282 is released.
+pprof = { git = "https://github.com/tikv/pprof-rs", rev = "01cff82dbe6fe110a707bf2b38d8ebb1d14a18f8" }
+
 # Temporary: use the GreptimeTeam fork of tikv-jemalloc-sys embedding
 # jemalloc 5.3.1 + backport of 54f22c83 ("Initialize TSD tcache before
 # enabling it"), fixing the TSD/tcache enable-before-init reentrancy
```

#### Recent Merged Pull Requests:
- **PR #9713** (closed): fix(puffin): keep puffin_metadata cache bytes non-negative (@Tyagiquamar)
- **PR #9696** (2026-10-18): feat(promql): match vectors holding native histograms (@killme2008)
- **PR #9695** (2026-10-18): feat(promql): evaluate range functions over native histogram samples (@killme2008)
- **PR #9694** (2026-10-17): feat(promql): cover absent_over_time and vector(), sort quantile_over_time like Go (@killme2008)
- **PR #9690** (2026-10-17): fix(promql): keep no samples past a skipped anchored window and trim Narthex operators (@killme2008)
- **PR #9689** (2026-10-17): chore(promql): import parent items through crate paths (@killme2008)

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

## X. log-store): refuse to open object store WAL regions whose history is missing (#9

**RULE**:
When implementing operations in `config/config.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in GreptimeTeam/greptimedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `deae75ff`: log-store): refuse to open object store WAL regions whose history is missing (#9561). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `config/config.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
| `wal.accept_missing_history` | Bool | `false` | Whether a region opens although the WAL objects under the prefix do not hold its history.<br/>An existing region fails to open when the prefix held no object when the WAL opened, or when the flushed entry id of the region names an object above every object of the prefix that holds entries. Both happen after `storage_provider`, or the bucket or root of the provider it names, changed without the WAL objects being copied, or after the objects were deleted.<br/>To move the WAL, stop the instance, copy every object under the prefix to the new location and then change the configuration; the regions open with all their writes.<br/>When the old WAL is lost, set this to `true` for one start: the regions open without their writes that were not flushed, which are lost, a warning names each region, and `greptime_logstore_object_store_wal_missing_history_accepted_total` counts them. Turn it off again once the instance has written to the WAL after that start; until then a later start refuses a region whose flushed entry id names an object above every object of the prefix that holds entries.<br/>**It's only used when the provider is `experimental_
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `deae75ff` are properly handled with clean fallback behavior.
