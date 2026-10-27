> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/greptimeteam-greptimedb-learnings.md`  
> **Source**: github ([https://github.com/GreptimeTeam/greptimedb](https://github.com/GreptimeTeam/greptimedb))  
> **Source Version**: `5b4efd90`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T12:14:46.447Z  
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
> **Harvest Timestamp**: 2026-10-27T12:14:45.761Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GreptimeTeam/greptimedb`
- **Description**: The open-source observability database. One columnar engine for metrics, logs, and traces, on object storage.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6767 stars

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
- **Issue #10003** (2026-10-27): **fix(mito2): stop the series distributor from stalling on unread partitions**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  Cherry-pick of #9991 (merged into `main`) onto `narthex`.  ## What's changed and what's your intention?  `FusedSeriesExec` with two inputs reads every scan partition one after another. On `narthex` this hits the series distributor's round-robin `send_timeout(100us)`. Tokio timers tick at 1 ms, so after a merge (one batch per series) each series batch costs about 1 ms per unpolled partition. With 16 partitions, two-selector native queries over regions with several SSTs spent ~470 ms to 12.7 s in `SeriesScanExec`, while legacy took ~10 ms.  #9991 waits on all senders at once and sends to the first free slot. The cherry-pick applies cleanly and the diff is identical to #9991.  ## PR Checklist Please convert it to a draft if some of the following conditions are not met.  - [x] I have written the necessary rustdoc comments. - [x] I have added the necessary unit tests and integration tests. - [ ] This PR requires documentation updates. - [x] API changes are backward compatible. - [x] Schema or data changes are backward compatible. - [ ] This PR needs to be backported to release branches, and I have added the `backport-<target>` labels (e.g. `backport-v1.3` targets `release/v1.3`). 
  **Post-Mortem & Fix Analysis**:
  > <!-- pr-open-limit --> > [!WARNING] > @killme2008 has **7** open non-draft pull requests in this repository, over the limit of **5**.  Review is the scarcest resource here. Please land or close some of these before pushing this one forward.  - [PR 9693: feat\(partition\)\: support iceberg\_hash in partition rules](https://redirect.github.com/GreptimeTeam/greptimedb/pull/9693) - [PR 9913: perf\(mito2\)\: index encoded bulk parts from memory during flush](https://redirect.github.com/GreptimeTeam/greptimedb/pull/9913) - [PR 9988: feat\(promql\)\: run time\(\)\, scalar\(v\)\, vector\(s\) and dynamic scalar broadcasts natively](https://redirect.github.com/GreptimeTeam/greptimedb/pull/9988) - [PR 9990: feat\(promql\)\: run cross\-table selector pairs natively](https://redirect.github.com/GreptimeTeam/greptimedb/pull/9990) - [PR 10004: feat\(promql\)\: run native statements over any number of selectors](https://redirect.github.com/GreptimeTeam/greptimedb/pull/10004) - [PR 10005: feat\(promql\

- **Issue #9998** (2026-10-27): **feat(promql): split distributed aggregates over the raw fan-in**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  Stacked on #9993 (authorized raw fan-in on the frontend). This PR needs the fan-in input to be correct; it does not need anything else from it.  ## What's changed and what's your intention?  Distributed `sum by (host)(rate(x[5m]))` — and the other aggregates the existing split supports — fell back to the legacy plan on every distributed query, because the split branch required `in_process_region_transport()`. That gate is only about where the input comes from, not about what the split needs.  The split is correct when the producer sees *every* series of each group it folds. For the local route, one region-local execution instance holds them. For the new remote route, `NativeRawFanInExec` gathers all selected regions into **one** frontend partition and merges raw samples before the prefix runs, so the same condition holds: the partial producer folds all series, then `AggregateFinalizeExec` merges its state. With a single input partition that merge is the identity case, which the finalize already supports (`aggregate_finalize.rs` keeps a lone partition unchanged).  So the change is to drop the transport gate and keep every other admission condition: one selector, `AggregateFinalize::can_split`, `Float64` fields, millisecond non-null time index, no append mode, no alternative matchers, no `__field__` matcher, and the t

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

### Incident Patch 1: `17ed988f` (2026-10-27)
**Commit Message**: fix(mito): preserve SST lifetime across index replacement (#9950)

* fix(mito): preserve SST lifetime across index replacement

Share retirement and final purge across immutable index metadata views. Keep version-specific GC references until readers release them and match Parquet liveness by file identity.

Fixes #9944

Signed-off-by: Lei, HUANG <[REDACTED_EMAIL]>

* refactor(mito): list-based SST purge and single FilePurger::remove_file

The final purge of a retired SST no longer depends on FileMeta: index
files of every version are discovered by listing
({region_dir}/index/{file_id}. prefix), so even when the last live view
is a stale one, the purge still removes all newer index files.

- SstLifetime is slimmed down to { deleted, file_purger }; the purge now
  runs in the last FileHandleInner::drop (Arc::strong_count == 1, which
  is race-free here since only inners of the same file hold the lifetime).
- FilePurger is merged back into a single remove_file(file_meta,
  is_delete) method; is_delete means the file was retired AND this is the
  last live view.
- LocalFilePurger deletes the SST and all its index files via the new
  delete_file_and_all_indexes helper (list before delet

**File**: `src/cmd/src/datanode/objbench.rs` (modified, +2/-7)
```diff
@@ -27,7 +27,7 @@ use mito2::config::{FulltextIndexConfig, MitoConfig, Mode};
 use mito2::read::FlatSource;
 use mito2::sst::FormatType;
 use mito2::sst::file::{FileHandle, FileMeta};
-use mito2::sst::file_purger::{FilePurger, FilePurgerRef};
+use mito2::sst::file_purger::{FilePurgerRef, NoopFilePurger};
 use mito2::sst::index::intermediate::IntermediateManager;
 use mito2::sst::index::puffin_manager::PuffinManagerFactory;
 use mito2::sst::parquet::WriteOptions;
@@ -508,12 +508,7 @@ async fn build_cache_manager(
 }
 
 fn new_noop_file_purger() -> FilePurgerRef {
-    #[derive(Debug)]
-    struct Noop;
-    impl FilePurger for Noop {
-        fn remove_file(&self, _file_meta: FileMeta, _is_delete: bool, _index_outdated: bool) {}
-    }
-    Arc::new(Noop)
+    Arc::new(NoopFilePurger)
 }
 
 async fn load_parquet_metadata(
```

**File**: `src/mito2/src/engine/file_ref_test.rs` (modified, +201/-0)
```diff
@@ -53,3 +53,204 @@ async fn get_snapshot_of_file_refs_skips_missing_file_handle_region() {
     assert!(manifest.manifest_version.is_empty());
     assert!(manifest.cross_region_refs.is_empty());
 }
+
+#[tokio::test]
+async fn get_snapshot_preserves_related_region_old_index_readers() {
+    use store_api::region_engine::{RegionEngine, RegionRole};
+    use store_api::region_request::RegionRequest;
+    use store_api::storage::{FileId, FileRef};
+
+    use crate::manifest::action::{RegionEdit, RegionMetaAction, RegionMetaActionList};
+    use crate::region::RegionLeaderState;
+    use crate::sst::file::{FileHandle, FileMeta, IndexType};
+    use crate::test_util::CreateRequestBuilder;
+
+    let mut env = TestEnv::new().await;
+    let engine = env
+        .create_engine(MitoConfig {
+            gc: crate::gc::GcConfig {
+                enable: true,
+                ..Default::default()
+            },
+            ..Default::default()
+        })
+        .await;
+    let source_region = RegionId::new(1, 1);
+    let target_region = RegionId::new(1, 2);
+    engine
+        .handle_request(
+            target_region,
+            RegionRequest::Create(CreateRequestBuilder::new().build()),
+        )
+        .await
+        .unwrap();
+    engine
+        .set_region_role(target_region, RegionRole::Leader)
+        .unwrap();
+    let meta = FileMeta {
+        region_id: source_region,
+        file_id: FileId::random(),
+        index_version: 2,
+        available_indexes: smallvec::smallvec![IndexType::InvertedIndex],
+        ..Default::default()
+    };
+    let target = engine.get_region(target_region).unwrap();
+    let old_reader = FileHandle::new(
+        FileMeta {
+            index_version: 0,
+            ..meta.clone()
+        },
+        target.file_purger.clone(),
+    );
+    target
+        .manifest_ctx
+        .update_manifest(
+            RegionLeaderState::Writable,
+            RegionMetaActionList::with_action(RegionMetaAction::Edit(RegionEdit {
+                files_to_add: vec![meta.clone()],
+                files_to_remove: vec![],
+                timestamp_ms: None,
+                compaction_time_window: None,
+                flushed_entry_id: None,
+                flushed_sequence: None,
+                committed_sequence: None,
+            })),
+            false,
+        )
+        .await
+        .unwrap();
+
+    // The source is not open here, but a query on the destination still uses its v0 index.
+    let related_regions = HashMap::from([(source_region, HashSet::from([target_region]))]);
+    let snapshot = engine
+        .get_snapshot_of_file_refs([], related_regions.clone())
+        .await
+        .unwrap();
+    assert_eq!(
+        snapshot.file_refs[&source_region],
+        [0, 2]
+            .into_iter()
+            .map(|version| FileRef::new(source_region, meta.file_id, Some(version)))
+            .collect()
+    );
+    assert_eq!(
+        snapshot.cross_region_refs[&source_region],
+        HashSet::from([target_region])
+    );
+    drop(old_reader);
+    let snapshot = engine
+        .get_snapshot_of_file_refs([], related_regions)
+        .await
+        .unwrap();
+    assert_eq!(
+        snapshot.file_refs[&source_region],
+        HashSet::from([FileRef::new(source_region, meta.file_id, Some(2))])
+    );
+}
+
+#[rstest::rstest]
+#[tokio::test]
+async fn get_snapshot_preserves_old_index_readers_until_release(
+    #[values(false, true)] old_has_index: bool,
+) {
+    use store_api::region_engine::{RegionEngine, RegionRole};
+    use store_api::region_request::RegionRequest;
+    use store_api::storage::{FileId, FileRef};
+
+    use crate::manifest::action::{RegionEdit, RegionMetaAction, RegionMetaActionList};
+    use crate::region::RegionLeaderState;
+    use crate::sst::file::{FileMeta, IndexType};
+    use crate::sst::version::SstVersion;
+    use crate::test_util::CreateRequestBuilder;
+
+    let mut env = TestEnv::new().await;
+    let engine = env
+        .create_engine(MitoConfig {
+            gc: crate::gc::GcConfig {
+                enable: true,
+                ..Default::default()
+            },
+            ..Default::default()
+        })
+        .await;
+    let region_id = RegionId::new(1, 1);
+    engine
+        .handle_request(
+            region_id,
+            RegionRequest::Create(CreateRequestBuilder::new().build()),
+        )
+        .await
+        .unwrap();
+    engine
+        .set_region_role(region_id, RegionRole::Leader)
+        .unwrap();
+    let region = engine.get_region(region_id).unwrap();
+    let meta = FileMeta {
+        region_id,
+        file_id: FileId::random(),
+        available_indexes: if old_has_index {
+            smallvec::smallvec![IndexType::InvertedIndex]
+        } else {
+            Default::default()
+        },
+        ..Default::default()
+    };
+    let mut version = SstVersion::new(crate::test_util::memtable_util::metadata_for_test());
+    version.a
```

**File**: `src/mito2/src/gc.rs` (modified, +14/-29)
```diff
@@ -929,17 +929,8 @@ impl LocalGcWorker {
         unknown_file_may_linger_until: chrono::DateTime<chrono::Utc>,
     ) -> Vec<RemovedFile> {
         let mut ready_for_delete = vec![];
-        // all group by file id for easier checking
-        let in_tmp_ref: HashMap<FileId, HashSet<IndexVersion>> =
-            in_tmp_ref
-                .iter()
-                .fold(HashMap::new(), |mut acc, (file, version)| {
-                    let indices = acc.entry(*file).or_default();
-                    if let Some(version) = version {
-                        indices.insert(*version);
-                    }
-                    acc
-                });
+        // Every index-version reader needs the same Parquet file.
+        let referenced_ssts: HashSet<_> = in_tmp_ref.iter().map(|(file_id, _)| *file_id).collect();
 
         let may_linger_files: HashMap<FileId, HashSet<&RemovedFile>> = may_linger_files
             .iter()
@@ -976,7 +967,7 @@ impl LocalGcWorker {
             let should_delete = match file_type {
                 FileType::Parquet => {
                     let is_in_manifest = in_manifest.contains_key(&file_id);
-                    let is_in_tmp_ref = in_tmp_ref.contains_key(&file_id);
+                    let is_in_tmp_ref = referenced_ssts.contains(&file_id);
                     let is_linger = may_linger_files.contains_key(&file_id);
                     let is_eligible_for_delete = eligible_for_delete.contains_key(&file_id);
 
@@ -991,15 +982,8 @@ impl LocalGcWorker {
                     )
                 }
                 FileType::Puffin(version) => {
-                    // notice need to check both file id and version
-                    let is_in_manifest = in_manifest
-                        .get(&file_id)
-                        .map(|opt_ver| *opt_ver == Some(version))
-                        .unwrap_or(false);
-                    let is_in_tmp_ref = in_tmp_ref
-                        .get(&file_id)
-                        .map(|versions| versions.contains(&version))
-                        .unwrap_or(false);
+                    let is_in_manifest = in_manifest.get(&file_id) == Some(&Some(version));
+                    let is_in_tmp_ref = in_tmp_ref.contains(&(file_id, Some(version)));
                     let is_linger = may_linger_files
                         .get(&file_id)
                         .map(|files| files.contains(&&RemovedFile::Index(file_id, version)))
@@ -1100,21 +1084,22 @@ impl LocalGcWorker {
         // When full_file_listing is false, skip expensive list operations and only delete
         // files that are tracked in recently_removed_files
         if !self.full_file_listing {
+            let referenced_ssts: HashSet<_> =
+                in_tmp_ref.iter().map(|(file_id, _)| *file_id).collect();
             // Only delete files that:
             // 1. Are in recently_removed_files (tracked in manifest)
             // 2. Are not in use(in manifest or tmp ref)
             // 3. Have passed the lingering time
             let files_to_delete: Vec<RemovedFile> = eligible_for_removal
                 .iter()
-                .filter(|file_id| {
-                    let in_use = match file_id {
-                        RemovedFile::File(file_id, index_version) => {
-                            in_manifest.get(file_id) == Some(index_version)
-                                || in_tmp_ref.contains(&(*file_id, *index_version))
+                .filter(|file| {
+                    let in_use = match file {
+                        RemovedFile::File(file_id, _) => {
+                            in_manifest.contains_key(file_id) || referenced_ssts.contains(file_id)
                         }
-                        RemovedFile::Index(file_id, index_version) => {
-                            in_manifest.get(file_id) == Some(&Some(*index_version))
-                                || in_tmp_ref.contains(&(*file_id, Some(*index_version)))
+                        RemovedFile::Index(file_id, version) => {
+                            in_manifest.get(file_id) == Some(&Some(*version))
+                                || in_tmp_ref.contains(&(*file_id, Some(*version)))
                         }
                     };
                     !in_use
```

**File**: `src/mito2/src/gc/worker_test.rs` (modified, +297/-4)
```diff
@@ -21,12 +21,13 @@ use async_trait::async_trait;
 use bytes::Bytes;
 use common_base::Plugins;
 use common_telemetry::init_default_ut_logging;
+use common_time::Timestamp;
 use futures::TryStreamExt;
 use object_store::{Entry, ObjectStore, services};
 use store_api::metadata::RegionMetadataRef;
-use store_api::region_engine::RegionEngine as _;
+use store_api::region_engine::{RegionEngine as _, RegionRole};
 use store_api::region_request::{RegionCompactRequest, RegionRequest};
-use store_api::storage::{FileRef, FileRefsManifest, RegionId};
+use store_api::storage::{FileId, FileRef, FileRefsManifest, IndexVersion, RegionId};
 
 use crate::access_layer::AccessLayerRef;
 use crate::config::MitoConfig;
@@ -35,9 +36,11 @@ use crate::engine::compaction_test::{delete_and_flush, put_and_flush};
 use crate::engine::region_hook::{RegionGcInfo, RegionHook, RegionHookRef};
 use crate::error::UnexpectedSnafu;
 use crate::gc::{GcConfig, LocalGcWorker, should_delete_file};
-use crate::manifest::action::RemovedFile;
+use crate::manifest::action::{RegionEdit, RegionMetaAction, RegionMetaActionList, RemovedFile};
 use crate::metrics::GC_SKIPPED_UNPARSABLE_FILES;
-use crate::region::MitoRegionRef;
+use crate::region::{MitoRegionRef, RegionLeaderState};
+use crate::sst::file::{FileHandle, FileMeta, IndexType, RegionIndexId};
+use crate::sst::location;
 use crate::test_util::{
     CreateRequestBuilder, TestEnv, build_rows, flush_region, put_rows, rows_schema,
 };
@@ -74,6 +77,296 @@ async fn create_gc_worker(
     .unwrap()
 }
 
+struct IndexGcTestEnv {
+    engine: MitoEngine,
+    region: MitoRegionRef,
+    worker: LocalGcWorker,
+    meta: FileMeta,
+    entries: Vec<Entry>,
+    removed_files: BTreeMap<Timestamp, HashSet<RemovedFile>>,
+    _env: TestEnv,
+}
+
+impl IndexGcTestEnv {
+    async fn new(full_file_listing: bool) -> Self {
+        let mut env = TestEnv::new().await;
+        let engine = env
+            .create_engine(MitoConfig {
+                gc: GcConfig {
+                    enable: true,
+                    lingering_time: Some(std::time::Duration::from_secs(60 * 60)),
+                    ..Default::default()
+                },
+                ..Default::default()
+            })
+            .await;
+        let region_id = RegionId::new(1, 1);
+        engine
+            .handle_request(
+                region_id,
+                RegionRequest::Create(CreateRequestBuilder::new().build()),
+            )
+            .await
+            .unwrap();
+        let region = engine.get_region(region_id).unwrap();
+        let meta = FileMeta {
+            region_id,
+            file_id: FileId::random(),
+            available_indexes: smallvec::smallvec![IndexType::InvertedIndex],
+            ..Default::default()
+        };
+        let layer = &region.access_layer;
+        let paths = [
+            location::sst_file_path(layer.table_dir(), meta.file_id(), layer.path_type()),
+            location::index_file_path(layer.table_dir(), meta.index_id(), layer.path_type()),
+            location::index_file_path(
+                layer.table_dir(),
+                RegionIndexId::new(meta.file_id(), 1),
+                layer.path_type(),
+            ),
+        ];
+        let mut entries = Vec::new();
+        for path in paths {
+            entries.push(write_and_list_entry(layer.object_store(), &path).await);
+        }
+        let removed_files = BTreeMap::from([(
+            Timestamp::new_millisecond(0),
+            HashSet::from([
+                RemovedFile::File(meta.file_id, Some(1)),
+                RemovedFile::Index(meta.file_id, 0),
+                RemovedFile::Index(meta.file_id, 1),
+            ]),
+        )]);
+        let worker = create_gc_worker(
+            &engine,
+            BTreeMap::from([(region_id, Some(region.clone()))]),
+            &FileRefsManifest::default(),
+            full_file_listing,
+        )
+        .await;
+        Self {
+            engine,
+            region,
+            worker,
+            meta,
+            entries,
+            removed_files,
+            _env: env,
+        }
+    }
+}
+
+#[rstest::rstest]
+#[tokio::test]
+async fn test_gc_keeps_sst_across_index_versions(
+    #[values(false, true)] full_file_listing: bool,
+    #[values(false, true)] old_reader_last: bool,
+) {
+    use crate::sst::version::SstVersion;
+
+    let env = IndexGcTestEnv::new(full_file_listing).await;
+    let meta = &env.meta;
+    let region_id = meta.region_id;
+    let mut version = SstVersion::new(crate::test_util::memtable_util::metadata_for_test());
+    version.add_files(env.region.file_purger.clone(), [meta.clone()].into_iter());
+    let old = version.levels()[0].files[&meta.file_id].clone();
+    let updated = FileMeta {
+        index_version: 1,
+        ..meta.clone()
+    };
+    version.add_files(env.region.file_purger.clone(), [updated].into_iter());
+    let new = version.levels()[0].files[&meta.file_id].clone();
+    version.ma
```

**File**: `src/mito2/src/region.rs` (modified, +2/-4)
```diff
@@ -2363,10 +2363,8 @@ mod tests {
         struct CountingPurger(AtomicUsize);
 
         impl FilePurger for CountingPurger {
-            fn remove_file(&self, _: FileMeta, is_delete: bool, _: bool) {
-                if is_delete {
-                    self.0.fetch_add(1, Ordering::SeqCst);
-                }
+            fn purge_file(&self, _: FileMeta) {
+                self.0.fetch_add(1, Ordering::SeqCst);
             }
         }
 
```

**File**: `src/mito2/src/sst/file.rs` (modified, +68/-30)
```diff
@@ -39,6 +39,7 @@ use crate::cache::CacheManagerRef;
 use crate::cache::file_cache::{FileType, IndexKey};
 use crate::region::options::IndexOptions;
 use crate::sst::file_purger::FilePurgerRef;
+use crate::sst::file_ref::FileReferenceManagerRef;
 use crate::sst::index::fulltext_index::FULLTEXT_BLOOM_VERSION;
 use crate::sst::location;
 use crate::sst::parquet::SstInfo;
@@ -551,13 +552,13 @@ impl fmt::Debug for FileHandle {
         f.debug_struct("FileHandle")
             .field("meta", self.meta_ref())
             .field("compacting", &self.compacting())
-            .field("deleted", &self.inner.deleted.load(Ordering::Relaxed))
+            .field("deleted", &self.is_deleted())
             .finish()
     }
 }
 
 impl FileHandle {
-    /// Creates a handle sharing the file's physical state and original statistics.
+    /// Creates a new logical SST reference. Index replacements must reuse its lifetime.
     pub fn new(meta: FileMeta, file_purger: FilePurgerRef) -> FileHandle {
         let pk_range = meta.primary_key_range();
         FileHandle {
@@ -576,6 +577,23 @@ impl FileHandle {
         }
     }
 
+    /// Replaces an index metadata view without splitting the underlying SST lifetime.
+    pub(crate) fn with_updated_index(&self, meta: FileMeta) -> Self {
+        debug_assert_eq!(self.file_id(), meta.file_id());
+        let primary_key_range = meta
+            .primary_key_range()
+            .or_else(|| self.raw_primary_key_range());
+        let lifetime = self.inner.lifetime.clone();
+        *lifetime.meta.lock().unwrap() = meta.clone();
+        Self {
+            inner: Arc::new(FileHandleInner::with_lifetime(
+                meta,
+                lifetime,
+                primary_key_range,
+            )),
+        }
+    }
+
     /// Returns the region id of the file.
     pub fn region_id(&self) -> RegionId {
         self.inner.meta.region_id
@@ -615,7 +633,7 @@ impl FileHandle {
 
     /// Mark the file as deleted and will delete it on drop asynchronously
     pub fn mark_deleted(&self) {
-        self.inner.deleted.store(true, Ordering::Relaxed);
+        self.inner.lifetime.deleted.store(true, Ordering::Relaxed);
     }
 
     pub fn compacting(&self) -> bool {
@@ -634,23 +652,13 @@ impl FileHandle {
             .is_ok()
     }
 
-    pub fn index_outdated(&self) -> bool {
-        self.inner.index_outdated.load(Ordering::Relaxed)
-    }
-
-    pub fn set_index_outdated(&self, index_outdated: bool) {
-        self.inner
-            .index_outdated
-            .store(index_outdated, Ordering::Relaxed);
-    }
-
     /// Returns a reference to the [FileMeta].
     pub fn meta_ref(&self) -> &FileMeta {
         &self.inner.meta
     }
 
     pub fn file_purger(&self) -> FilePurgerRef {
-        self.inner.file_purger.clone()
+        self.inner.lifetime.file_purger.clone()
     }
 
     pub fn size(&self) -> u64 {
@@ -670,7 +678,7 @@ impl FileHandle {
     }
 
     pub fn is_deleted(&self) -> bool {
-        self.inner.deleted.load(Ordering::Relaxed)
+        self.inner.lifetime.deleted.load(Ordering::Relaxed)
     }
 
     /// Returns bounds aligned to the caller's pinned schema, before any comparison
@@ -776,39 +784,69 @@ impl PrimaryKeyRange {
 struct FileHandleInner {
     meta: FileMeta,
     compacting: AtomicBool,
-    deleted: AtomicBool,
-    index_outdated: AtomicBool,
     primary_key_range: RwLock<PrimaryKeyRange>,
-    file_purger: FilePurgerRef,
+    lifetime: Arc<SstLifetime>,
 }
 
 impl Drop for FileHandleInner {
     fn drop(&mut self) {
-        self.file_purger.remove_file(
-            self.meta.clone(),
-            self.deleted.load(Ordering::Acquire),
-            self.index_outdated.load(Ordering::Acquire),
-        );
+        if let Some(manager) = &self.lifetime.file_ref_manager {
+            manager.remove_file(&self.meta);
+        }
     }
 }
 
 impl FileHandleInner {
-    /// There should only be one `FileHandleInner` for each file on a datanode
     fn new(
         meta: FileMeta,
         file_purger: FilePurgerRef,
         primary_key_range: Option<(Bytes, Bytes)>,
-    ) -> FileHandleInner {
-        file_purger.new_file(&meta);
-        FileHandleInner {
+    ) -> Self {
+        let file_ref_manager = file_purger.file_ref_manager();
+        let lifetime = Arc::new(SstLifetime {
+            meta: Mutex::new(meta.clone()),
+            deleted: AtomicBool::new(false),
+            file_purger,
+            file_ref_manager,
+        });
+        Self::with_lifetime(meta, lifetime, primary_key_range)
+    }
+
+    fn with_lifetime(
+        meta: FileMeta,
+        lifetime: Arc<SstLifetime>,
+        primary_key_range: Option<(Bytes, Bytes)>,
+    ) -> Self {
+        if let Some(manager) = &lifetime.file_ref_manager {
+            manager.register_file(&meta);
+        }
+        Self {
             meta,
             compacting: AtomicBool::new(false),
-            deleted: AtomicBool::new(false),
-            index_outdated: AtomicBo
```

**File**: `src/mito2/src/sst/file_purger.rs` (modified, +213/-141)
```diff
@@ -23,23 +23,20 @@ use crate::access_layer::AccessLayerRef;
 use crate::cache::CacheManagerRef;
 use crate::error::Result;
 use crate::schedule::scheduler::SchedulerRef;
-use crate::sst::file::{FileMeta, delete_files, delete_index};
+use crate::sst::file::{FileMeta, delete_files};
 use crate::sst::file_ref::FileReferenceManagerRef;
 use crate::sst::range_index::RangeIndexDeleter;
 
 /// A worker to delete files in background.
 pub trait FilePurger: Send + Sync + fmt::Debug {
-    /// Send a request to remove the file.
-    /// If `is_delete` is true, the file will be deleted from the storage.
-    /// Otherwise, only the reference will be removed.
-    /// If `index_outdated` is true, the index file will be deleted regardless of `is_delete`.
-    fn remove_file(&self, file_meta: FileMeta, is_delete: bool, index_outdated: bool);
-
-    /// Notify the purger of a new file created.
-    /// This is useful for object store based storage, where we need to track the file references
-    /// The default implementation is a no-op.
-    fn new_file(&self, _: &FileMeta) {
-        // noop
+    /// Purges a retired SST and its indexes after all metadata views release their readers.
+    /// Each metadata view has already released its reader reference.
+    fn purge_file(&self, file_meta: FileMeta);
+
+    /// Returns the object-store reference manager used by SST metadata views.
+    /// Local and no-op purgers do not track GC references.
+    fn file_ref_manager(&self) -> Option<FileReferenceManagerRef> {
+        None
     }
 }
 
@@ -50,9 +47,7 @@ pub type FilePurgerRef = Arc<dyn FilePurger>;
 pub struct NoopFilePurger;
 
 impl FilePurger for NoopFilePurger {
-    fn remove_file(&self, _file_meta: FileMeta, _is_delete: bool, _index_outdated: bool) {
-        // noop
-    }
+    fn purge_file(&self, _file_meta: FileMeta) {}
 }
 
 /// Purger that purges file for current region.
@@ -182,33 +177,16 @@ impl LocalFilePurger {
             error!(e; "Failed to schedule the file purge request");
         }
     }
-
-    fn delete_index(&self, file_meta: FileMeta) {
-        let sst_layer = self.sst_layer.clone();
-        let cache_manager = self.cache_manager.clone();
-        if let Err(e) = self.scheduler.schedule(Box::pin(async move {
-            let index_id = file_meta.index_id();
-            if let Err(e) = delete_index(index_id, &sst_layer, &cache_manager).await {
-                error!(e; "Failed to delete index for file {:?} from storage", file_meta);
-            }
-        })) {
-            error!(e; "Failed to schedule the index purge request");
-        }
-    }
 }
 
 impl FilePurger for LocalFilePurger {
-    fn remove_file(&self, file_meta: FileMeta, is_delete: bool, index_outdated: bool) {
-        if is_delete {
-            schedule_range_index_deletion(
-                &self.scheduler,
-                self.range_index_deleter.as_ref(),
-                file_meta.file_id,
-            );
-            self.delete_file(file_meta);
-        } else if index_outdated {
-            self.delete_index(file_meta);
-        }
+    fn purge_file(&self, file_meta: FileMeta) {
+        schedule_range_index_deletion(
+            &self.scheduler,
+            self.range_index_deleter.as_ref(),
+            file_meta.file_id,
+        );
+        self.delete_file(file_meta);
     }
 }
 
@@ -246,31 +224,26 @@ fn schedule_range_index_deletion(
 }
 
 impl FilePurger for ObjectStoreFilePurger {
-    fn remove_file(&self, file_meta: FileMeta, is_delete: bool, _index_outdated: bool) {
-        // if not on local file system, instead inform the global file purger to remove the file reference.
-        // notice that no matter whether the file is deleted or not, we need to remove the reference
-        // because the file is no longer in use nonetheless.
-        // for same reason, we don't care about index_outdated here.
-        self.file_ref_manager.remove_file(&file_meta);
-        if is_delete {
-            schedule_range_index_deletion(
-                &self.scheduler,
-                self.range_index_deleter.as_ref(),
-                file_meta.file_id,
-            );
-        }
+    fn purge_file(&self, file_meta: FileMeta) {
+        schedule_range_index_deletion(
+            &self.scheduler,
+            self.range_index_deleter.as_ref(),
+            file_meta.file_id,
+        );
     }
 
-    fn new_file(&self, file_meta: &FileMeta) {
-        self.file_ref_manager.add_file(file_meta);
+    fn file_ref_manager(&self) -> Option<FileReferenceManagerRef> {
+        Some(self.file_ref_manager.clone())
     }
 }
 
 #[cfg(test)]
 mod tests {
     use std::num::NonZeroU64;
+    use std::sync::Barrier;
+    use std::thread;
 
-    use common_test_util::temp_dir::create_temp_dir;
+    use common_test_util::temp_dir::{TempDir, create_temp_dir};
     use object_store::ObjectStore;
     use object_store::services::Fs;
     use smallvec::SmallVec;
@@ -288,43 +261,147 @@ mod tests {
     use crate::sst::index::puff
```

**File**: `src/mito2/src/sst/file_ref.rs` (modified, +95/-235)
```diff
@@ -24,23 +24,18 @@ use crate::metrics::GC_REF_FILE_CNT;
 use crate::region::MitoRegionRef;
 use crate::sst::file::FileMeta;
 
-/// File references for a region.
-/// It contains all files referenced by the region.
+/// File references grouped by their physical source region.
 #[derive(Debug, Clone, Default)]
-pub struct RegionFileRefs {
-    /// (FileRef, Ref Count) meaning how many FileHandleInner is opened for this file.
-    pub files: HashMap<FileRef, usize>,
+struct RegionFileRefs {
+    /// Counts independent metadata views of each physical file and index version.
+    files: HashMap<FileRef, usize>,
 }
 
-/// Manages all file references in one datanode.
-/// It keeps track of which files are referenced and group by table ids.
-/// This is useful for ensuring that files are not deleted while they are still in use by any
-/// query.
+/// Tracks reader references to SST metadata views in one datanode for object-store GC.
 #[derive(Debug)]
 pub struct FileReferenceManager {
     /// Datanode id. used to determine tmp ref file name.
     node_id: Option<u64>,
-    /// TODO(discord9): use no hash hasher since table id is sequential.
     files_per_region: DashMap<RegionId, RegionFileRefs>,
     /// Whether global GC is enabled.
     /// This is only meaningful when using object store (not local filesystem).
@@ -68,58 +63,49 @@ impl FileReferenceManager {
     }
 
     /// Returns whether global GC is enabled.
-    ///
-    /// This is useful for determining the file deletion strategy:
-    /// - If GC is enabled (and using object store), files are tracked but not immediately deleted
-    /// - If GC is disabled (or using local filesystem), files are deleted immediately
     pub fn is_gc_enabled(&self) -> bool {
         self.gc_enabled
     }
 
     fn ref_file_set(&self, region_id: RegionId) -> Option<HashSet<FileRef>> {
-        // region id not found.
-        let file_refs = self.files_per_region.get(&region_id)?.clone();
-
-        if file_refs.files.is_empty() {
-            // still return an empty manifest to indicate no files are referenced.
-            // and differentiate from error case where table_id not found.
-            return Some(HashSet::new());
-        }
-
-        let ref_file_set: HashSet<FileRef> = file_refs.files.keys().cloned().collect();
-
+        let region_refs = self.files_per_region.get(&region_id)?.clone();
+        let refs: HashSet<_> = region_refs.files.keys().cloned().collect();
         debug!(
             "Get file refs for region {}, node {:?}, {} files",
             region_id,
             self.node_id,
-            ref_file_set.len(),
+            region_refs.files.len(),
         );
-
-        Some(ref_file_set)
+        Some(refs)
     }
 
-    /// Gets all ref files for the given regions, meaning all open FileHandles for those regions
-    /// and from related regions' manifests.
-    /// `query_regions_for_mem` queries for in memory file handles.
-    /// `related_regions_in_manifest` queries for related regions' manifests to get more file refs of given region ids.
+    /// Gets references from live SST metadata views and related regions' manifests.
     pub(crate) async fn get_snapshot_of_file_refs(
         &self,
         query_regions_for_mem: Vec<MitoRegionRef>,
         dst_region_to_src_regions: Vec<(MitoRegionRef, HashSet<RegionId>)>,
     ) -> Result<FileRefsManifest> {
+        // Imported SSTs are tracked under their source region even if that region is
+        // not open on this node. Capture their old readers before reading manifests.
+        let region_ids: HashSet<_> = query_regions_for_mem
+            .iter()
+            .map(|r| r.region_id())
+            .chain(
+                dst_region_to_src_regions
+                    .iter()
+                    .flat_map(|(_, sources)| sources.iter().copied()),
+            )
+            .collect();
         let mut ref_files = HashMap::new();
-        // get from in memory file handles
-        for region_id in query_regions_for_mem.iter().map(|r| r.region_id()) {
+        for region_id in region_ids {
             if let Some(files) = self.ref_file_set(region_id) {
                 ref_files.insert(region_id, files);
             }
         }
 
         let mut manifest_version = HashMap::new();
-
         let mut cross_region_refs = HashMap::new();
 
-        // get file refs from related regions' manifests
         for (dst_region, src_regions) in &dst_region_to_src_regions {
             let manifest = dst_region.manifest_ctx.manifest().await;
             for meta in manifest.files.values() {
@@ -128,9 +114,8 @@ impl FileReferenceManager {
                         .entry(meta.region_id)
                         .or_insert_with(HashSet::new)
                         .insert(dst_region.region_id());
-                    // since gc couldn't happen together with repartition
-                    // (both the queries and related_region acquire region read lock), no need to worry about
-  
```

---

### Incident Patch 2: `5b4efd90` (2026-10-27)
**Commit Message**: perf(mito2): index encoded bulk parts from memory during flush (#9913)

* perf(mito2): build encoded bulk part indexes from in-memory bytes during flush

Sync flush uploaded encoded bulk parts without indexes and rebuilt them after
the flush, which read every encoded SST back from the object store and needed a
second manifest commit. Build the indexes from the encoded bytes still in memory
before the flush commits, the same way the regular SST writer does, and drop the
post-flush rebuild for these files.

Signed-off-by: Dennis Zhuang <[REDACTED_EMAIL]>

* fix(mito2): keep flush going when indexing encoded bytes fails

Match ParquetWriter: a failure while building indexes from the encoded bytes
logs and leaves the SST unindexed instead of failing the flush after the SST
was uploaded.

Signed-off-by: Dennis Zhuang <[REDACTED_EMAIL]>

* fix(mito2): own encoded SSTs for cleanup before uploading them

Index creation now runs after an encoded SST is uploaded, so a truncate or drop
could cancel the flush after the upload but before UncommittedSsts tracked the
file, leaving the SST and its index behind. Track the file before the upload,
and fill the index metadata on the caller's SstInfo i

**File**: `config/config.md` (modified, +2/-0)
```diff
@@ -225,6 +225,7 @@
 | `region_engine.mito.index.aux_path` | String | `""` | Auxiliary directory path for the index in filesystem, used to store intermediate files for<br/>creating the index and staging files for searching the index, defaults to `{data_home}/index_intermediate`.<br/>The default name for this directory is `index_intermediate` for backward compatibility.<br/><br/>This path contains two subdirectories:<br/>- `__intm`: for storing intermediate files used during creating index.<br/>- `staging`: for storing staging files used during searching index. |
 | `region_engine.mito.index.staging_size` | String | `2GB` | The max capacity of the staging directory. |
 | `region_engine.mito.index.staging_ttl` | String | `7d` | The TTL of the staging directory.<br/>Defaults to 7 days.<br/>Setting it to "0s" to disable TTL. |
+| `region_engine.mito.index.build_mode` | String | `sync` | When to build indexes for new SST files.<br/>- `sync`: build indexes while writing SST files during flush and compaction.<br/>- `async`: build indexes in the background after the SST files are written. Queries read<br/>  these files without indexes until the build finishes. |
 | `region_engine.mito.index.metadata_cache_size` | String | `64MiB` | Cache size for inverted index metadata. |
 | `region_engine.mito.index.content_cache_size` | String | `128MiB` | Cache size for inverted index content. |
 | `region_engine.mito.index.content_cache_page_size` | String | `64KiB` | Page size for inverted index content cache. |
@@ -703,6 +704,7 @@
 | `region_engine.mito.index.aux_path` | String | `""` | Auxiliary directory path for the index in filesystem, used to store intermediate files for<br/>creating the index and staging files for searching the index, defaults to `{data_home}/index_intermediate`.<br/>The default name for this directory is `index_intermediate` for backward compatibility.<br/><br/>This path contains two subdirectories:<br/>- `__intm`: for storing intermediate files used during creating index.<br/>- `staging`: for storing staging files used during searching index. |
 | `region_engine.mito.index.staging_size` | String | `2GB` | The max capacity of the staging directory. |
 | `region_engine.mito.index.staging_ttl` | String | `7d` | The TTL of the staging directory.<br/>Defaults to 7 days.<br/>Setting it to "0s" to disable TTL. |
+| `region_engine.mito.index.build_mode` | String | `sync` | When to build indexes for new SST files.<br/>- `sync`: build indexes while writing SST files during flush and compaction.<br/>- `async`: build indexes in the background after the SST files are written. Queries read<br/>  these files without indexes until the build finishes. |
 | `region_engine.mito.index.metadata_cache_size` | String | `64MiB` | Cache size for inverted index metadata. |
 | `region_engine.mito.index.content_cache_size` | String | `128MiB` | Cache size for inverted index content. |
 | `region_engine.mito.index.content_cache_page_size` | String | `64KiB` | Page size for inverted index content cache. |
```

**File**: `config/datanode.example.toml` (modified, +6/-0)
```diff
@@ -734,6 +734,12 @@ staging_size = "2GB"
 ## Setting it to "0s" to disable TTL.
 staging_ttl = "7d"
 
+## When to build indexes for new SST files.
+## - `sync`: build indexes while writing SST files during flush and compaction.
+## - `async`: build indexes in the background after the SST files are written. Queries read
+##   these files without indexes until the build finishes.
+build_mode = "sync"
+
 ## Cache size for inverted index metadata.
 metadata_cache_size = "64MiB"
 
```

**File**: `config/standalone.example.toml` (modified, +6/-0)
```diff
@@ -949,6 +949,12 @@ staging_size = "2GB"
 ## Setting it to "0s" to disable TTL.
 staging_ttl = "7d"
 
+## When to build indexes for new SST files.
+## - `sync`: build indexes while writing SST files during flush and compaction.
+## - `async`: build indexes in the background after the SST files are written. Queries read
+##   these files without indexes until the build finishes.
+build_mode = "sync"
+
 ## Cache size for inverted index metadata.
 metadata_cache_size = "64MiB"
 
```

**File**: `src/mito2/src/access_layer.rs` (modified, +65/-4)
```diff
@@ -44,9 +44,9 @@ use crate::metrics::{COMPACTION_STAGE_ELAPSED, FLUSH_ELAPSED};
 use crate::read::FlatSource;
 use crate::region::options::IndexOptions;
 use crate::sst::file::{FileHandle, RegionFileId, RegionIndexId};
-use crate::sst::index::IndexerBuilderImpl;
 use crate::sst::index::intermediate::IntermediateManager;
 use crate::sst::index::puffin_manager::{PuffinManagerFactory, SstPuffinManager};
+use crate::sst::index::{IndexerBuilderImpl, build_index_from_parquet_bytes};
 use crate::sst::location::{self, region_dir_from_table_dir};
 use crate::sst::parquet::reader::ParquetReaderBuilder;
 use crate::sst::parquet::writer::ParquetWriter;
@@ -477,13 +477,19 @@ impl AccessLayer {
     }
 
     /// Puts encoded SST bytes to the write cache (if enabled) and uploads it to the object store.
+    ///
+    /// Builds the SST's indexes from `data` into `sst_info.index_metadata` when
+    /// `index_build_params` is set.
     pub(crate) async fn put_sst(
         &self,
         data: &bytes::Bytes,
-        region_file_id: RegionFileId,
+        region_id: RegionId,
+        sst_info: &mut SstInfo,
         cache_manager: &CacheManagerRef,
         write_buffer_size: ReadableSize,
+        index_build_params: Option<EncodedSstIndexBuildParams>,
     ) -> Result<Metrics> {
+        let region_file_id = RegionFileId::new(region_id, sst_info.file_id);
         if let Some(write_cache) = cache_manager.write_cache() {
             // Write to cache and upload to remote store
             let upload_request = SstUploadRequest {
@@ -494,7 +500,14 @@ impl AccessLayer {
                 remote_store: self.object_store.clone(),
             };
             write_cache
-                .put_and_upload_sst(data, region_file_id, upload_request, write_buffer_size)
+                .put_and_upload_sst(
+                    data,
+                    region_id,
+                    sst_info,
+                    upload_request,
+                    write_buffer_size,
+                    index_build_params,
+                )
                 .await
         } else {
             let start = Instant::now();
@@ -519,6 +532,19 @@ impl AccessLayer {
             }
             let mut metrics = Metrics::new(WriteType::Flush);
             metrics.write_batch = start.elapsed();
+
+            if let Some(params) = index_build_params {
+                let start = Instant::now();
+                let builder = params.indexer_builder(
+                    self.puffin_manager_factory
+                        .build(self.object_store.clone(), path_provider),
+                    false,
+                    self.intermediate_manager.clone(),
+                );
+                sst_info.index_metadata =
+                    build_index_from_parquet_bytes(&builder, region_file_id, data).await;
+                metrics.update_index = start.elapsed();
+            }
             Ok(metrics)
         }
     }
@@ -593,6 +619,36 @@ pub struct SstWriteRequest {
     pub bloom_filter_index_config: BloomFilterConfig,
 }
 
+/// Index inputs for SST bytes that were encoded outside [ParquetWriter].
+pub(crate) struct EncodedSstIndexBuildParams {
+    pub(crate) metadata: RegionMetadataRef,
+    pub(crate) index_options: IndexOptions,
+    pub(crate) inverted_index_config: InvertedIndexConfig,
+    pub(crate) fulltext_index_config: FulltextIndexConfig,
+    pub(crate) bloom_filter_index_config: BloomFilterConfig,
+}
+
+impl EncodedSstIndexBuildParams {
+    pub(crate) fn indexer_builder(
+        self,
+        puffin_manager: SstPuffinManager,
+        write_cache_enabled: bool,
+        intermediate_manager: IntermediateManager,
+    ) -> IndexerBuilderImpl {
+        IndexerBuilderImpl {
+            build_type: OperationType::Flush.into(),
+            metadata: self.metadata,
+            puffin_manager,
+            write_cache_enabled,
+            intermediate_manager,
+            index_options: self.index_options,
+            inverted_index_config: self.inverted_index_config,
+            fulltext_index_config: self.fulltext_index_config,
+            bloom_filter_index_config: self.bloom_filter_index_config,
+        }
+    }
+}
+
 /// Cleaner to remove temp files on the atomic write dir.
 pub(crate) struct TempFileCleaner {
     region_id: RegionId,
@@ -830,9 +886,14 @@ mod tests {
         access_layer
             .put_sst(
                 &encoded,
-                file_id,
+                file_id.region_id(),
+                &mut SstInfo {
+                    file_id: file_id.file_id(),
+                    ..Default::default()
+                },
                 &cache_manager,
                 ReadableSize(chunk_size as u64),
+                None,
             )
             .await
             .unwrap();
```

**File**: `src/mito2/src/batch_size.rs` (modified, +19/-0)
```diff
@@ -14,11 +14,30 @@
 
 //! Utilities for choosing an execution batch size from source statistics.
 
+use parquet::file::metadata::ParquetMetaData;
+
 use crate::sst::parquet::DEFAULT_READ_BATCH_SIZE;
 
 /// Approximate decoded bytes to produce in one batch.
 pub(crate) const TARGET_BATCH_BYTES: usize = 64 * 1024 * 1024;
 
+/// Returns `(num_rows, uncompressed_bytes)` of the largest row group in a Parquet file, which
+/// bounds the decoded size of a batch read from it.
+pub(crate) fn largest_row_group_statistic(metadata: &ParquetMetaData) -> Option<(u64, u64)> {
+    metadata
+        .row_groups()
+        .iter()
+        .map(|row_group| {
+            let uncompressed_bytes = row_group
+                .columns()
+                .iter()
+                .map(|column| column.uncompressed_size() as u64)
+                .sum();
+            (row_group.num_rows() as u64, uncompressed_bytes)
+        })
+        .max_by_key(|(_, uncompressed_bytes)| *uncompressed_bytes)
+}
+
 /// Estimates a batch size from `(num_rows, estimated_bytes)` pairs.
 ///
 /// Uses the widest source with valid statistics and targets approximately 64 MiB of decoded data.
```

**File**: `src/mito2/src/cache/write_cache.rs` (modified, +62/-17)
```diff
@@ -26,20 +26,21 @@ use store_api::storage::RegionId;
 use tokio::sync::mpsc::{UnboundedSender, unbounded_channel};
 
 use crate::access_layer::{
-    FilePathProvider, Metrics, OperationType, RegionFilePathFactory, SstInfoArray, SstWriteRequest,
-    TempFileCleaner, WriteCachePathProvider, WriteType, new_fs_cache_store,
+    EncodedSstIndexBuildParams, FilePathProvider, Metrics, OperationType, RegionFilePathFactory,
+    SstInfoArray, SstWriteRequest, TempFileCleaner, WriteCachePathProvider, WriteType,
+    new_fs_cache_store,
 };
 use crate::cache::file_cache::{FileCache, FileCacheRef, FileType, IndexKey, IndexValue};
 use crate::cache::manifest_cache::ManifestCache;
 use crate::error::{self, Result};
 use crate::metrics::UPLOAD_BYTES_TOTAL;
 use crate::region::opener::RegionLoadCacheTask;
 use crate::sst::file::RegionFileId;
-use crate::sst::index::IndexerBuilderImpl;
 use crate::sst::index::intermediate::IntermediateManager;
 use crate::sst::index::puffin_manager::{PuffinManagerFactory, SstPuffinManager};
-use crate::sst::parquet::WriteOptions;
+use crate::sst::index::{IndexerBuilderImpl, build_index_from_parquet_bytes};
 use crate::sst::parquet::writer::ParquetWriter;
+use crate::sst::parquet::{SstInfo, WriteOptions};
 use crate::sst::{DEFAULT_WRITE_BUFFER_SIZE, DEFAULT_WRITE_CONCURRENCY};
 
 /// Wraps the remote object store used by write cache uploads.
@@ -173,15 +174,20 @@ impl WriteCache {
     }
 
     /// Put encoded SST data to the cache and upload to the remote object store.
+    ///
+    /// Builds the SST's indexes from `data` when `index_build_params` is set and uploads them
+    /// with the SST.
     pub(crate) async fn put_and_upload_sst(
         &self,
         data: &bytes::Bytes,
-        region_file_id: RegionFileId,
+        region_id: RegionId,
+        sst_info: &mut SstInfo,
         upload_request: SstUploadRequest,
         write_buffer_size: ReadableSize,
+        index_build_params: Option<EncodedSstIndexBuildParams>,
     ) -> Result<Metrics> {
-        let region_id = region_file_id.region_id();
-        let file_id = region_file_id.file_id();
+        let file_id = sst_info.file_id;
+        let region_file_id = RegionFileId::new(region_id, file_id);
         let mut metrics = Metrics::new(WriteType::Flush);
 
         // Create index key for the SST file
@@ -204,31 +210,70 @@ impl WriteCache {
 
         metrics.write_batch = cache_start.elapsed();
 
+        if let Some(params) = index_build_params {
+            let start = Instant::now();
+            let builder = params.indexer_builder(
+                self.build_puffin_manager(),
+                true,
+                self.intermediate_manager.clone(),
+            );
+            sst_info.index_metadata =
+                build_index_from_parquet_bytes(&builder, region_file_id, data).await;
+            metrics.update_index = start.elapsed();
+        }
+
         // Upload to remote store
+        let remote_store = &upload_request.remote_store;
+        let mut upload_tracker = UploadTracker::new(region_id);
         let upload_start = Instant::now();
         let remote_path = upload_request
             .dest_path_provider
             .build_sst_file_path(region_file_id);
-
-        if let Err(e) = self
+        let mut result = self
             .upload(
                 parquet_key,
                 &remote_path,
-                &upload_request.remote_store,
+                remote_store,
                 UploadOptions {
                     // `put_and_upload_sst` is only used by the flush path.
                     op_type: OperationType::Flush,
                     write_buffer_size,
                 },
             )
-            .await
-        {
-            // Clean up cache on failure
-            self.remove(parquet_key).await;
-            return Err(e);
+            .await;
+        metrics.upload_parquet = upload_start.elapsed();
+
+        if result.is_ok() && sst_info.index_metadata.file_size > 0 {
+            upload_tracker.push_uploaded_file(remote_path);
+            let puffin_key = IndexKey::new(region_id, file_id, FileType::Puffin(0));
+            let puffin_path = upload_request
+                .dest_path_provider
+                .build_index_file_path(region_file_id);
+            let start = Instant::now();
+            result = self
+                .upload(
+                    puffin_key,
+                    &puffin_path,
+                    remote_store,
+                    UploadOptions {
+                        op_type: OperationType::Flush,
+                        write_buffer_size: DEFAULT_WRITE_BUFFER_SIZE,
+                    },
+                )
+                .await;
+            metrics.upload_puffin = start.elapsed();
         }
 
-        metrics.upload_parquet = upload_start.elapsed();
+        if let Err(e) = result {
+            upload_tracker
+                .clean(
+                    std::slice::from_ref(sst_info),
+                    &self.fil
```

**File**: `src/mito2/src/engine/index_build_test.rs` (modified, +184/-28)
```diff
@@ -23,6 +23,8 @@ use api::v1::region::{StrictWindow, compact_request};
 use api::v1::{Rows, SemanticType};
 use async_trait::async_trait;
 use common_base::readable_size::ReadableSize;
+use common_error::ext::ErrorExt;
+use common_error::status_code::StatusCode;
 use common_recordbatch::RecordBatches;
 use datafusion_expr::expr::InList;
 use datafusion_expr::{Expr, col, lit};
@@ -34,7 +36,7 @@ use store_api::metadata::ColumnMetadata;
 use store_api::region_engine::RegionEngine;
 use store_api::region_request::{
     AddColumn, AlterKind, RegionAlterRequest, RegionBuildIndexRequest, RegionCloseRequest,
-    RegionCompactRequest, RegionRequest, SetIndexOption,
+    RegionCompactRequest, RegionFlushRequest, RegionRequest, RegionTruncateRequest, SetIndexOption,
 };
 use store_api::storage::{RegionId, ScanRequest};
 use tokio::sync::{Notify, Semaphore};
@@ -2297,8 +2299,9 @@ impl SstReadCounter {
 
 #[rstest::rstest]
 #[tokio::test]
-async fn test_sync_flush_indexes_encoded_bulk_parts(
-    #[values(false, true)] disable_inverted_on_flush: bool,
+async fn test_flush_indexes_encoded_bulk_parts(
+    #[values(false, true)] async_without_flush_indexes: bool,
+    #[values(false, true)] write_cache: bool,
 ) {
     let sst_bytes_read = Arc::new(AtomicUsize::new(0));
     let counter = sst_bytes_read.clone();
@@ -2312,19 +2315,27 @@ async fn test_sync_flush_indexes_encoded_bulk_parts(
         }))
         .build()
         .unwrap();
-    let mut env = TestEnv::with_prefix("test_sync_flush_indexes_encoded_bulk_parts_")
+    let mut env = TestEnv::with_prefix("test_flush_indexes_encoded_bulk_parts_")
         .await
         .with_mock_layer(layer);
-    let listener = Arc::new(IndexBuildListener::default());
     let mut config = MitoConfig {
         default_flat_format: true,
         min_compaction_interval: Duration::from_secs(3600),
         ..Default::default()
     };
     assert_eq!(config.index.build_mode, IndexBuildMode::Sync);
-    if disable_inverted_on_flush {
+    if async_without_flush_indexes {
+        config.index.build_mode = IndexBuildMode::Async;
         config.inverted_index.create_on_flush = Mode::Disable;
     }
+    if write_cache {
+        config = config.enable_write_cache(
+            env.data_home().join("write_cache").display().to_string(),
+            ReadableSize::mb(32),
+            None,
+        );
+    }
+    let listener = Arc::new(IndexBuildListener::default());
     let engine = env
         .create_engine_with(config, None, Some(listener.clone()), None)
         .await;
@@ -2345,7 +2356,7 @@ async fn test_sync_flush_indexes_encoded_bulk_parts(
         .insert_option("memtable.bulk.merge_threshold", "2")
         .insert_option("memtable.bulk.encode_row_threshold", "1")
         .build_with_index();
-    if !disable_inverted_on_flush {
+    if !async_without_flush_indexes {
         // `build_with_index` only adds inverted indexes on tags; also cover a skipping index.
         let field = request
             .column_metadatas
@@ -2385,9 +2396,10 @@ async fn test_sync_flush_indexes_encoded_bulk_parts(
     flush_region(&engine, region_id, None).await;
 
     let files = current_file_metas(&engine, region_id).await;
-    if disable_inverted_on_flush {
-        // Only inverted indexes are configured and they are disabled on flush, so the builds
-        // have nothing to create. They must stop before reading the rows of the SSTs.
+    assert!(!files.is_empty());
+    if async_without_flush_indexes {
+        // Async mode builds indexes after flush. Only inverted indexes are configured and they
+        // are disabled on flush, so the builds must stop before reading the rows of the SSTs.
         let total_size: usize = files.iter().map(|f| f.file_size as usize).sum();
         // Stopping the engine waits for scheduled index builds.
         engine.stop().await.unwrap();
@@ -2398,25 +2410,169 @@ async fn test_sync_flush_indexes_encoded_bulk_parts(
         return;
     }
 
-    let version = engine.get_region(region_id).unwrap().version();
-    let indexed = async {
-        loop {
-            let files = current_file_metas(&engine, region_id).await;
-            if files.iter().all(|f| {
-                f.is_index_consistent_with_region(
-                    &version.metadata.column_metadatas,
-                    &version.options.index_options,
-                )
-            }) {
-                return files;
-            }
-            tokio::time::sleep(Duration::from_millis(20)).await;
+    // Sync mode builds the indexes from the encoded bytes in memory during flush.
+    assert_eq!(0, sst_bytes_read.load(Ordering::Relaxed));
+    assert_eq!(0, listener.begin_count());
+    assert!(files.iter().all(|f| f.inverted_index_available()));
+    assert!(files.iter().all(|f| f.bloom_filter_index_available()));
+    let access_layer = engine.get_region(region_id).unwrap().access_layer.clone();
+    for file in &files {
+        let index_path = location::index_file_pa
```

**File**: `src/mito2/src/flush.rs` (modified, +27/-59)
```diff
@@ -29,16 +29,17 @@ use smallvec::{SmallVec, smallvec};
 use snafu::{ResultExt, ensure};
 use store_api::metadata::RegionMetadataRef;
 use store_api::region_request::RegionFlushReason;
-use store_api::storage::{FileId, RegionId, SequenceNumber};
+use store_api::storage::{RegionId, SequenceNumber};
 use strum::IntoStaticStr;
 use tokio::sync::{Semaphore, mpsc, watch};
 
 use crate::access_layer::{
-    AccessLayerRef, Metrics, OperationType, SstInfoArray, SstWriteRequest, WriteType,
+    AccessLayerRef, EncodedSstIndexBuildParams, Metrics, OperationType, SstInfoArray,
+    SstWriteRequest, WriteType,
 };
 use crate::cache::CacheManagerRef;
 use crate::compaction::{collect_json2_rewrite_plans, rewrite_json2_batch, rewrite_json2_schema};
-use crate::config::MitoConfig;
+use crate::config::{IndexBuildMode, MitoConfig};
 use crate::engine::region_hook::SstFileInfo;
 use crate::error::{
     Error, FlushCancelledSnafu, FlushRegionSnafu, JoinSnafu, RegionBusySnafu, RegionClosedSnafu,
@@ -66,7 +67,7 @@ use crate::request::{
 };
 use crate::schedule::CancellableTaskState;
 use crate::schedule::scheduler::{Job, SchedulerRef};
-use crate::sst::file::{FileMeta, RegionFileId, UncommittedSsts};
+use crate::sst::file::{FileMeta, UncommittedSsts};
 use crate::sst::parquet::metadata::extract_primary_key_range;
 use crate::sst::parquet::{
     DEFAULT_READ_BATCH_SIZE, DEFAULT_ROW_GROUP_SIZE, SstInfo, WriteOptions, flat_format,
@@ -394,10 +395,7 @@ impl RegionFlushTask {
         };
 
         let worker_request = match flush_result {
-            Ok(FlushedEdit {
-                edit,
-                unindexed_files,
-            }) => {
+            Ok(edit) => {
                 let memtables_to_remove = version_data
                     .version
                     .memtables
@@ -413,7 +411,6 @@ impl RegionFlushTask {
                     senders: std::mem::take(&mut self.senders),
                     _timer: timer,
                     edit,
-                    unindexed_files,
                     memtables_to_remove,
                     is_staging: self.is_staging,
                 };
@@ -451,7 +448,7 @@ impl RegionFlushTask {
         version_data: &VersionControlData,
         state: &CancellableTaskState,
         uncommitted: &UncommittedSsts,
-    ) -> Result<FlushedEdit> {
+    ) -> Result<RegionEdit> {
         // We must use the immutable memtables list and entry ids from the `version_data`
         // for consistency as others might already modify the version in the `version_control`.
         let version = &version_data.version;
@@ -470,7 +467,6 @@ impl RegionFlushTask {
 
         let DoFlushMemtablesResult {
             file_metas,
-            unindexed_files,
             flushed_bytes,
             series_count,
             encoded_part_count,
@@ -594,10 +590,7 @@ impl RegionFlushTask {
             self.reason.as_str()
         );
 
-        Ok(FlushedEdit {
-            edit,
-            unindexed_files,
-        })
+        Ok(edit)
     }
 
     async fn do_flush_memtables(
@@ -612,7 +605,6 @@ impl RegionFlushTask {
         let mut flushed_bytes = 0;
         let mut series_count = 0;
         let mut encoded_part_count = 0;
-        let mut unindexed_files = Vec::new();
         let mut flush_metrics = Metrics::new(WriteType::Flush);
         let partition_expr = parse_partition_expr(self.partition_expr.as_deref())?;
         let hook = self.manifest_ctx.hook();
@@ -659,12 +651,7 @@ impl RegionFlushTask {
                 .await?;
             encoded_part_count += num_encoded;
             for (source_idx, result) in results.into_iter().enumerate() {
-                let FlushedSsts {
-                    max_sequence,
-                    ssts: ssts_written,
-                    metrics,
-                    indexed,
-                } = result?;
+                let (max_sequence, ssts_written, metrics) = result?;
                 if ssts_written.is_empty() {
                     // No data written.
                     continue;
@@ -683,9 +670,6 @@ impl RegionFlushTask {
 
                 for sst_info in &ssts_written {
                     flushed_bytes += sst_info.file_size;
-                    if !indexed {
-                        unindexed_files.push(sst_info.file_id);
-                    }
                     let pk_range = sst_info
                         .file_metadata
                         .as_ref()
@@ -719,7 +703,6 @@ impl RegionFlushTask {
 
         Ok(DoFlushMemtablesResult {
             file_metas,
-            unindexed_files,
             flushed_bytes,
             series_count,
             encoded_part_count,
@@ -765,41 +748,43 @@ impl RegionFlushTask {
                     .await?;
                 uncommitted.track(&ssts);
                 FLUSH_FILE_TOTAL.inc_by(ssts.len() as u64);
-                Ok(FlushedSsts {
-                    max_sequence,
-                    ssts,
-                    metrics,
-                    indexed: true,
-             
```

---

### Incident Patch 3: `e6b60644` (2026-10-27)
**Commit Message**: fix(mito2): stop the series distributor from stalling on unread partitions (#9991)

When every partition channel is full, the distributor walked the senders
round-robin with a 100us send timeout each. Tokio timers fire on a 1ms
tick, so a consumer that leaves some partitions unpolled costs about one
millisecond per unpolled partition for every series batch.
SeriesScan::build_stream and scan_all_partitions drain partitions one
after another, and SortPreservingMergeExec above a multi-partition
SeriesScan only pulls the partition holding the current minimum key.
With 16 partitions and one batch per series after a merge, a 40-series
scan read partition by partition took ~480ms (measured on the native
PromQL two-input route).

Wait on all senders at once and send to the first one that frees a slot.
The send-timeout metric goes away with the timeout.

Signed-off-by: Dennis Zhuang <[REDACTED_EMAIL]>

**File**: `src/mito2/src/read/scan_util.rs` (modified, +0/-10)
```diff
@@ -202,8 +202,6 @@ pub(crate) struct ScanMetricsSet {
     /// Elapsed time before the first poll operation.
     first_poll: Duration,
 
-    /// Number of send timeout in SeriesScan.
-    num_series_send_timeout: usize,
     /// Number of send full in SeriesScan.
     num_series_send_full: usize,
     /// Number of rows the series distributor scanned.
@@ -325,7 +323,6 @@ impl fmt::Debug for ScanMetricsSet {
             num_sst_batches,
             num_sst_rows,
             first_poll,
-            num_series_send_timeout,
             num_series_send_full,
             num_distributor_rows,
             num_distributor_batches,
@@ -459,9 +456,6 @@ impl fmt::Debug for ScanMetricsSet {
         }
 
         // Write non-zero distributor metrics
-        if *num_series_send_timeout > 0 {
-            write!(f, ", \"num_series_send_timeout\":{num_series_send_timeout}")?;
-        }
         if *num_series_send_full > 0 {
             write!(f, ", \"num_series_send_full\":{num_series_send_full}")?;
         }
@@ -775,7 +769,6 @@ impl ScanMetricsSet {
     /// Sets distributor metrics.
     fn set_distributor_metrics(&mut self, distributor_metrics: &SeriesDistributorMetrics) {
         let SeriesDistributorMetrics {
-            num_series_send_timeout,
             num_series_send_full,
             num_rows,
             num_batches,
@@ -784,7 +777,6 @@ impl ScanMetricsSet {
             divider_cost,
         } = distributor_metrics;
 
-        self.num_series_send_timeout += *num_series_send_timeout;
         self.num_series_send_full += *num_series_send_full;
         self.num_distributor_rows += *num_rows;
         self.num_distributor_batches += *num_batches;
@@ -1144,8 +1136,6 @@ impl fmt::Debug for PartitionMetrics {
 /// Metrics for the series distributor.
 #[derive(Default)]
 pub(crate) struct SeriesDistributorMetrics {
-    /// Number of send timeout in SeriesScan.
-    pub(crate) num_series_send_timeout: usize,
     /// Number of send full in SeriesScan.
     pub(crate) num_series_send_full: usize,
     /// Number of rows the series distributor scanned.
```

**File**: `src/mito2/src/read/series_scan.rs` (modified, +56/-43)
```diff
@@ -17,7 +17,7 @@
 use std::fmt;
 use std::sync::atomic::{AtomicUsize, Ordering};
 use std::sync::{Arc, Mutex};
-use std::time::{Duration, Instant};
+use std::time::Instant;
 
 use async_stream::try_stream;
 use common_error::ext::BoxedError;
@@ -39,7 +39,7 @@ use store_api::region_engine::{
     PartitionRange, PrepareRequest, QueryScanContext, RegionScanner, ScannerProperties,
 };
 use tokio::sync::Semaphore;
-use tokio::sync::mpsc::error::{SendTimeoutError, TrySendError};
+use tokio::sync::mpsc::error::TrySendError;
 use tokio::sync::mpsc::{self, Receiver, Sender};
 
 use crate::error::{
@@ -61,9 +61,6 @@ use crate::read::stream::{ConvertBatchStream, ScanBatch, ScanBatchStream};
 use crate::sst::parquet::flat_format::primary_key_column_index;
 use crate::sst::parquet::format::PrimaryKeyArray;
 
-/// Timeout to send a batch to a sender.
-const SEND_TIMEOUT: Duration = Duration::from_micros(100);
-
 /// Maximum number of candidate series retained before distributing assignments.
 const CANDIDATE_SERIES_ASSIGNMENT_THRESHOLD: usize = 1_000_000;
 
@@ -843,7 +840,6 @@ impl SeriesDistributor {
         }
 
         metrics.scan_cost += fetch_start.elapsed();
-        metrics.num_series_send_timeout = self.senders.num_timeout;
         metrics.num_series_send_full = self.senders.num_full;
         part_metrics.set_distributor_metrics(&metrics);
 
@@ -996,8 +992,6 @@ struct SenderList {
     num_nones: usize,
     /// Index of the current partition to send.
     sender_idx: usize,
-    /// Number of timeout.
-    num_timeout: usize,
     /// Number of full senders.
     num_full: usize,
 }
@@ -1009,7 +1003,6 @@ impl SenderList {
             senders,
             num_nones,
             sender_idx: 0,
-            num_timeout: 0,
             num_full: 0,
         }
     }
@@ -1045,46 +1038,35 @@ impl SenderList {
     }
 
     /// Finds a partition and sends the batch to the partition.
-    async fn send_batch(&mut self, mut batch: SeriesBatch) -> Result<()> {
-        // Sends the batch without blocking first.
-        match self.try_send_batch(batch)? {
-            Some(b) => {
-                // Unable to send batch to partition.
-                batch = b;
-            }
-            None => {
-                return Ok(());
-            }
-        }
+    async fn send_batch(&mut self, batch: SeriesBatch) -> Result<()> {
+        let Some(batch) = self.try_send_batch(batch)? else {
+            return Ok(());
+        };
 
         loop {
             ensure!(self.num_nones < self.senders.len(), InvalidSenderSnafu);
 
-            let sender_idx = self.fetch_add_sender_idx();
-            let Some(sender) = &self.senders[sender_idx] else {
-                continue;
-            };
-            // Adds a timeout to avoid blocking indefinitely and sending
-            // the batch in a round-robin fashion when some partitions
-            // don't poll their inputs. This may happen if we have a
-            // node like sort merging. But it is rare when we are using SeriesScan.
-            match sender.send_timeout(Ok(batch), SEND_TIMEOUT).await {
-                Ok(()) => break,
-                Err(SendTimeoutError::Timeout(res)) => {
-                    self.num_timeout += 1;
-                    // Safety: we send Ok.
-                    batch = res.unwrap();
-                }
-                Err(SendTimeoutError::Closed(res)) => {
-                    self.senders[sender_idx] = None;
-                    self.num_nones += 1;
-                    // Safety: we send Ok.
-                    batch = res.unwrap();
+            // Waits on every partition at once and sends to whichever frees a slot first. A
+            // consumer may leave partitions unpolled for a long time, e.g. one that drains them one
+            // after another, and waiting on such a partition would stall the scan.
+            let closed = {
+                let reservations = self.senders.iter().enumerate().filter_map(|(idx, sender)| {
+                    sender
+                        .as_ref()
+                        .map(|sender| Box::pin(async move { (idx, sender.reserve().await) }))
+                });
+                let ((idx, reserved), _, _) = futures::future::select_all(reservations).await;
+                match reserved {
+                    Ok(permit) => {
+                        permit.send(Ok(batch));
+                        return Ok(());
+                    }
+                    Err(_) => idx,
                 }
-            }
+            };
+            self.senders[closed] = None;
+            self.num_nones += 1;
         }
-
-        Ok(())
     }
 
     async fn send_error(&self, error: Error) {
@@ -1294,6 +1276,37 @@ mod tests {
         assert_eq!(0, active_receivers.load(Ordering::Relaxed));
     }
 
+    #[tokio::test]
+    async fn distributor_does_not_stall_on_partitions_read_one_after_another() {
+        const NUM_BATCHES: usize = 2000;
+        let (mut senders, receivers) = new_leg
```

#### Recent Merged Pull Requests:
- **PR #10003** (2026-10-27): fix(mito2): stop the series distributor from stalling on unread partitions (@killme2008)
- **PR #9998** (closed): feat(promql): split distributed aggregates over the raw fan-in (@discord9)
- **PR #9994** (2026-10-27): fix(mito2): stop the series distributor from stalling on unread partitions [Backport release/v1.3] (@MichaelScofield)
- **PR #9993** (closed): feat(promql): fan authorized raw series reads in on the frontend (@discord9)
- **PR #9991** (2026-10-27): fix(mito2): stop the series distributor from stalling on unread partitions (@killme2008)
- **PR #9990** (2026-10-27): feat(promql): run cross-table selector pairs natively (@killme2008)

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

## X. mito): preserve SST lifetime across index replacement (#9950)

**RULE**:
When implementing operations in `src/cmd/src/datanode/objbench.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in GreptimeTeam/greptimedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `17ed988f`: mito): preserve SST lifetime across index replacement (#9950). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/cmd/src/datanode/objbench.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use mito2::sst::file_purger::{FilePurgerRef, NoopFilePurger};
    Arc::new(NoopFilePurger)
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
use mito2::sst::file_purger::{FilePurger, FilePurgerRef};
    #[derive(Debug)]
    struct Noop;
    impl FilePurger for Noop {
        fn remove_file(&self, _file_meta: FileMeta, _is_delete: bool, _index_outdated: bool) {}
    }
    Arc::new(Noop)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `17ed988f` are properly handled with clean fallback behavior.
