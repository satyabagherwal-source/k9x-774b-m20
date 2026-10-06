# Forensic Learning Record (Deep Inspection): GreptimeTeam/greptimedb

> **Canonical Artifact**: `07_PROJECT_LEARNING/greptimeteam-greptimedb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/GreptimeTeam/greptimedb](https://github.com/GreptimeTeam/greptimedb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:16:24.805Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GreptimeTeam/greptimedb`
- **Description**: The open-source observability database. One columnar engine for metrics, logs, and traces, on object storage.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6724 stars

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

### Core Architecture Module: `src/common/datasource/src/util.rs`
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

use std::sync::Arc;

pub fn find_dir_and_filename(path: &str) -> (String, Option<String>) {
    if path.is_empty() {
        ("/".to_string(), None)
    } else if path.ends_with('/') {
        (path.to_string(), None)
    } else if let Some(idx) = path.rfind('/') {
        (
            path[..idx + 1].to_string(),
            Some(path[idx + 1..].to_string()),
        )
    } else {
        ("/".to_string(), Some(path.to_string()))
    }
}

/// Normalize the schema inferred from the data.
/// If the data type is null, set the data type to Utf8.
pub fn normalize_infer_schema(schema: arrow_schema::Schema) -> arrow_schema::Schema {
    let fields = schema
        .fields
        .iter()
        .map(|f| {
            if f.data_type().is_null() {
                // Set the data type to Utf8 for null fields
                Arc::new((**f).clone().with_data_type(arrow_schema::DataType::Utf8))
            } else {
                f.clone()
            }
        })
        .collect::<Vec<_>>();

    arrow_schema::Schema {
        fields: arrow_schema::Fields::from(fields),
        metadata: schema.metadata,
    }
}

#[cfg(test)]
mod tests {
    use url::Url;

    use super::*;

    #[test]
    fn test_parse_uri() {
        struct Test<'a> {
            uri: &'a str,
            expected_path: &'a str,
            expected_schema: &'a str,
        }

        let tests = [
            Test {
                uri: "s3://bucket/to/path/",
                expected_path: "/to/path/",
                expected_schema: "s3",
            },
            Test {
                uri: "fs:///to/path/",
                expected_path: "/to/path/",
                expected_schema: "fs",
            },
            Test {
                uri: "fs:///to/path/file",
                expected_path: "/to/path/file",
                expected_schema: "fs",
            },
        ];
        for test in tests {
            let parsed_uri = Url::parse(test.uri).unwrap();
            assert_eq!(parsed_uri.path(), test.expected_path);
            assert_eq!(parsed_uri.scheme(), test.expected_schema);
        }
    }

    #[cfg(not(windows))]
    #[test]
    fn test_parse_path_and_dir() {
        let parsed = Url::from_file_path("/to/path/file").unwrap();
        assert_eq!(parsed.path(), "/to/path/file");

        let parsed = Url::from_directory_path("/to/path/").unwrap();
        assert_eq!(parsed.path(), "/to/path/");
    }

    #[cfg(windows)]
    #[test]
    fn test_parse_path_and_dir() {
        let parsed = Url::from_file_path("C:\\to\\path\\file").unwrap();
        assert_eq!(parsed.path(), "/C:/to/path/file");

        let parsed = Url::from_directory_path("C:\\to\\path\\").unwrap();
        assert_eq!(parsed.path(), "/C:/to/path/");
    }

    #[test]
    fn test_find_dir_and_filename() {
        struct Test<'a> {
            path: &'a str,
            expected_dir: &'a str,
            expected_filename: Option<String>,
        }

        let tests = [
            Test {
                path: "to/path/",
                expected_dir: "to/path/",
                expected_filename: None,
            },
            Test {
                path: "to/path/filename",
                expected_dir: "to/path/",
                expected_filename: Some("filename".into()),
            },
            Test {
                path: "/to/path/filename",
                expected_dir: "/to/path/",
                expected_filename: Some("filename".into()),
            },
            Test {
                path: "/",
                expected_dir: "/",
                expected_filename: None,
            },
            Test {
                path: "filename",
                expected_dir: "/",
                expected_filename: Some("filename".into()),
            },
            Test {
                path: "",
                expected_dir: "/",
                expected_filename: None,
            },
        ];

        for test in tests {
            let (path, filename) = find_dir_and_filename(test.path);
            assert_eq!(test.expected_dir, path);
            assert_eq!(test.expected_filename, filename)
        }
    }
}

```

### Core Architecture Module: `src/common/function/src/scalars/anomaly/utils.rs`
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

//! Shared statistical utilities for anomaly detection window functions.

use std::ops::Range;

use arrow::array::{Array, ArrayRef, Float64Array};
use arrow::compute;
use arrow::datatypes::DataType;
use datafusion_common::DataFusionError;

/// Cast an ArrayRef to Float64. Returns the array as-is if already Float64.
pub fn cast_to_f64(array: &ArrayRef) -> datafusion_common::Result<ArrayRef> {
    if array.data_type() == &DataType::Float64 {
        return Ok(array.clone());
    }
    compute::cast(array, &DataType::Float64)
        .map_err(|e| DataFusionError::Internal(format!("Failed to cast to Float64: {e}")))
}

/// Collect valid f64 values from a Float64Array within the given range,
/// skipping NULL, NaN, and ±Inf values.
pub fn collect_window_values(array: &Float64Array, range: &Range<usize>) -> Vec<f64> {
    let mut values = Vec::with_capacity(range.len());
    for i in range.clone() {
        if array.is_valid(i) {
            let v = array.value(i);
            if v.is_finite() {
                values.push(v);
            }
        }
    }
    values
}

/// Compute median of a mutable slice using O(n) selection algorithm.
///
/// The input slice will be partially reordered.
/// Returns `None` if the slice is empty.
pub fn median_f64(values: &mut [f64]) -> Option<f64> {
    let len = values.len();
    if len == 0 {
        return None;
    }
    let mid = len / 2;
    let (lower, median, _) = values.select_nth_unstable_by(mid, |a, b| a.total_cmp(b));
    if len % 2 == 1 {
        Some(*median)
    } else {
        let right = *median;
        // For even length, find the max of the left half (all elements before mid).
        let left = lower.iter().copied().max_by(|a, b| a.total_cmp(b)).unwrap();
        Some((left + right) / 2.0)
    }
}

/// Compute percentile on a sorted slice using linear interpolation.
///
/// `p` should be in [0.0, 1.0]. The slice must be sorted in ascending order.
/// Returns `None` if the slice is empty.
pub fn percentile_sorted(sorted: &[f64], p: f64) -> Option<f64> {
    let len = sorted.len();
    if len == 0 {
        return None;
    }
    if len == 1 {
        return Some(sorted[0]);
    }
    let idx = p * (len - 1) as f64;
    let lower = idx.floor() as usize;
    let upper = idx.ceil() as usize;
    if lower == upper {
        Some(sorted[lower])
    } else {
        let frac = idx - lower as f64;
        Some(sorted[lower] * (1.0 - frac) + sorted[upper] * frac)
    }
}

/// Compute a non-negative anomaly score ratio with stable zero-denominator semantics.
///
/// When `scale == 0.0`:
/// - returns `0.0` if `distance == 0.0` (on-center value),
/// - returns `+inf` if `distance > 0.0` (off-center value under zero spread).
#[inline]
pub fn anomaly_ratio(distance: f64, scale: f64) -> f64 {
    if scale == 0.0 {
        if distance == 0.0 { 0.0 } else { f64::INFINITY }
    } else {
        distance / scale
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_median_odd() {
        let mut v = vec![5.0, 1.0, 3.0, 2.0, 4.0];
        assert_eq!(median_f64(&mut v), Some(3.0));
    }

    #[test]
    fn test_median_even() {
        let mut v = vec![4.0, 1.0, 3.0, 2.0];
        assert_eq!(median_f64(&mut v), Some(2.5));
    }

    #[test]
    fn test_median_single() {
        let mut v = vec![42.0];
        assert_eq!(median_f64(&mut v), Some(42.0));
    }

    #[test]
    fn test_median_empty() {
        let mut v: Vec<f64> = vec![];
        assert_eq!(median_f64(&mut v), None);
    }

    #[test]
    fn test_percentile_sorted_quartiles() {
        let sorted = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0];
        let q1 = percentile_sorted(&sorted, 0.25).unwrap();
        let q3 = percentile_sorted(&sorted, 0.75).unwrap();
        assert!((q1 - 3.25).abs() < 1e-10);
        assert!((q3 - 7.75).abs() < 1e-10);
    }

    #[test]
    fn test_percentile_sorted_empty() {
        assert_eq!(percentile_sorted(&[], 0.5), None);
    }

    #[test]
    fn test_collect_window_values_filters_invalid() {
        let array = Float64Array::from(vec![
            Some(1.0),
            None,
            Some(f64::NAN),
            Some(f64::INFINITY),
            Some(f64::NEG_INFINITY),
            Some(2.0),
            Some(3.0),
        ]);
        let values = collect_window_values(&array, &(0..7));
        assert_eq!(values, vec![1.0, 2.0, 3.0]);
    }

    #[test]
    fn test_anomaly_ratio_zero_scale() {
        assert_eq!(anomaly_ratio(0.0, 0.0), 0.0);
        assert!(anomaly_ratio(1.0, 0.0).is_infinite());
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #9436** (2026-10-02): **fix: temporarily disable v2 series scan by default**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  Related to https://github.com/GreptimeTeam/greptimedb/issues/9435.  ## What's changed and what's your intention?  Temporarily default `experimental_series_scan_v2` to `false` while the long-range PromQL scan memory usage reported in #9435 is investigated. Eligible metric series scans use the legacy implementation unless users explicitly enable v2.  Update the datanode and standalone config examples, regenerate `config/config.md`, and update the `/config` API test expectation. Remove the dedicated flag configuration test: the config API test covers the serialized default, and existing scan tests explicitly exercise enabled and disabled v2 behavior.  Regenerate the affected sqlness TSID regression and EXPLAIN ANALYZE results using the shipping default. The sqlness configurations continue to inherit the default, while existing Rust scan tests cover explicit v2 opt-in.  This is a default rollback, not a fix for the underlying memory issue. Explicit `experimental_series_scan_v2 = true` remains supported, and #9435 should remain open.  Validation: - Passed `make fmt`, `cargo fmt --all -- --check`, `make config-docs`, `make check-udeps`, and `git diff --check`. - Full Rust tests and clippy were started but stopped during dependency compilation because local free disk space fell below 4 GiB; full Rust and clippy validation 

- **Issue #9434** (2026-10-02): **ci: make query regression non-blocking for scheduled nightly releases**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  None.  ## What's changed and what's your intention?  ### Summary  Scheduled nightly releases no longer gate publishing on the query regression release test. The test still **runs** (the validation policy stays `all` for automatic releases) and uploads its report, but any result — failure, timeout, cancellation, or skip — no longer blocks image publishing or the GitHub release for `schedule`-triggered runs.  ### How it works  `query-regression-release` calls a reusable workflow (`query-regression.yml`), and GitHub Actions forbids `continue-on-error` on jobs that call reusable workflows, so the gate is relaxed at the consumers instead: the `if` conditions of `release-images-to-dockerhub` and `publish-github-release` now also pass when `github.event_name == 'schedule'`, regardless of `needs.query-regression-release.result`. Both gates already start with `always() &&`, so they are still evaluated when the dependency fails.  All other gates (runner allocation, artifact builds, `prepare-release-validation`, `compat-release`) are unchanged and still required.  Also included:  - `prepare-release-validation` now notes in its step summary (on scheduled runs) that query-regression failure/cancellation is non-blocking. - The `release_validation` input description mentions that scheduled nightlies run query regression non-blocki

- **Issue #9431** (2026-10-02): **fix(catalog): skip backend batch_get on full cache hits**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  Related implementation: #3277.  ## What's changed and what's your intention?  `CachedKvBackend::batch_get` still calls the underlying backend when every requested key is cached, passing an empty key list. Repeated cache hits therefore produce unnecessary metadata RPCs; the PostgreSQL backend can also acquire a connection before checking that the request is empty.  Return the cached values immediately when `miss_keys` is empty. This also handles an empty input request. Requests with cache misses retain the existing fetch and cache-invalidation behavior.  Extend the test backend to count `batch_get` calls, since the existing per-key read counter cannot detect empty backend calls. Regression coverage checks cold reads, repeated full cache hits, partial hits, and empty requests.  No API, schema, configuration, or persisted-data changes.  Validation: - Passed: `rustfmt --check --edition 2024 src/catalog/src/kvbackend/client.rs`, `git diff --check`, and patch application check. - Unit tests not run: `cargo nextest` is not installed. The fallback `cargo test --locked -p catalog kvbackend::client::tests::test_cached_kv_backend --lib` was blocked before compilation by an unavailable pinned DataFusion dependency and DNS failure for github.com. - Local checks used the original reproduction checkout; the unmodified target file 
  **Post-Mortem & Fix Analysis**:
  > /ci rust
  > Dispatched Rust CI for branch `fix/cached-batch-get-empty-misses`.
  > @codex review

- **Issue #9430** (2026-10-01): **ci: upgrade EC2 runner action to restore runner registration**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  https://github.com/GreptimeTeam/greptimedb/issues/9413  Failed nightly allocation: https://github.com/GreptimeTeam/greptimedb/actions/runs/36796032062/job/110159565740  ## What's changed and what's your intention?  Update `machulav/ec2-github-runner` from `v2.3.8` to `v2.6.1` in both the start and stop composite actions.  The old action downloads GitHub runner `2.313.0` during EC2 bootstrap. GitHub now requires runner `2.329.0` or later for registration, with full enforcement starting September 29, 2026: https://github.blog/changelog/2026-09-28-self-hosted-runner-version-enforcement-date-has-moved/  The nightly allocation starts EC2 successfully but times out waiting for runner registration, before any Rust build. The same AMI and instance type succeeded early September 29 and failed on September 30 and October 1. This strongly suggests the outdated runner is being rejected; the allocation logs do not include the EC2 bootstrap error itself.  The updated action downloads the latest runner and uses Node 24. Update cleanup to the same action version to keep the runner lifecycle consistent. Existing inputs and output names remain supported.  Validation: - `make fmt` passed. - YAML parsing and comparison with the upstream action metadata passed: all supplied inputs and consumed output names are suppor

- **Issue #9420** (2026-09-30): **fix(mito2): truncate parquet column index min/max for SST writes**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  #6977 turned off both statistics truncation and column index truncation in the SST writers.  ## What's changed and what's your intention?  The SST writer (`ParquetWriter`) and `BulkPartEncoder` write the parquet column index with untruncated min/max values, so every page of a large string or binary field stores its full min and max values, uncompressed. Mito never reads the column index: it loads metadata with `PageIndexPolicy::Skip` for it and strips it before caching.  Both writers now truncate the column index to the parquet default of 64 bytes. Chunk statistics stay untruncated, since primary key pruning decodes them; `test_scan_corrupt` from #6977 still covers that case. A test pins both: truncated column index for a large field, exact `__primary_key` chunk statistics for a key longer than 64 bytes.  Measured on an agent trace workload where span payloads (LLM prompts) have a p50 of about 350KB, 36.66GB raw, written to S3 (MinIO) through a standalone instance:  | | main | This PR | Change | |---|---|---|---| | SST size after flush | 10.72 GB | 6.22 GB | −42% | | SST size after compaction | 9.18 GB | 6.20 GB | −32% | | Write throughput | 417 MB/s | 448 MB/s | +7% |  Query latency and bytes read from object storage are unchanged. On log-like data with 109-byte messages the file size does not change; the column in

- **Issue #9413** (2026-10-02): **Workflow run 'GreptimeDB Nightly Build' failed**
  *Symptoms*: @GreptimeTeam/db-approver New failure: https://github.com/GreptimeTeam/greptimedb/actions/runs/36649942632 
  **Post-Mortem & Fix Analysis**:
  > @GreptimeTeam/db-approver New failure: https://github.com/GreptimeTeam/greptimedb/actions/runs/36649942632 
  > @GreptimeTeam/db-approver New failure: https://github.com/GreptimeTeam/greptimedb/actions/runs/36796032062 
  > @GreptimeTeam/db-approver Back to success: https://github.com/GreptimeTeam/greptimedb/actions/runs/36945549695

- **Issue #9410** (2026-09-30): **feat(mito): wait for WAL durability before publishing a manifest watermark**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  - RFC: #9195 - Tracking issue: #9197  ## What's changed and what's your intention?  This is the "Cross-region and cross-restart recovery tests" item of #9197, together with the Mito half of the durability barrier that the `enqueued` acknowledgement mode (#9358) left for the wiring (#9386).  **Durability barrier in Mito**  In the `enqueued` mode the object store WAL acknowledges an append before its object exists, so an entry id Mito holds may still be lost by a crash. If the manifest named such an id as flushed, a restart would skip the entries that get that id again. Mito now waits on `LogStore::wait_durable` before it records an entry id in the manifest: - A flush waits for its `last_entry_id` after the SSTs are written and before the manifest edit. The wait observes the flush's cancellation, so a drop or truncate that cancels the flush is not held up behind the upload. - A full truncate waits for its `truncated_entry_id`, and a discard of unflushed data for its `discarded_entry_id`, before the manifest action. A failed wait becomes the result of the request. - `WaitWalDurable` carries the log store's error. With the `durable` mode and with every other log store the wait returns at once (the trait default).  **Engine tests on the object store WAL**  `object_store_wal_recovery_test.rs` runs Mito on a real `ObjectSt
  **Post-Mortem & Fix Analysis**:
  > @codex review  When you finish, append exactly this marker to the review summary: <!-- review-bridge-request-id: rbreq-a4259b2c4aad583e2920917f52908bfe -->

- **Issue #9408** (2026-09-30): **perf: batch schema export requests**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  Part of #9120 (PR10: Faster schema export).  ## What's changed and what's your intention?  Schema export currently builds a new HTTP client and sends one SHOW CREATE request per object. Reuse the client connection pool and share bounded multi-statement requests across legacy and V2 export: at most 128 statements and 128 KiB of escaped UTF-8 SQL per request. Validate every response without exposing arbitrary SQL or response bodies in client errors, and preserve database/physical-table/table/view order. Legacy schema failures now reach the command result and prevent a subsequent data export. V2 writes each schema's DDL after assembling it, reducing intermediate copies.  Focused tests cover batch boundaries, quoting, response errors, connection reuse, request context, legacy command failures and credential-safe errors. CLI regressions, real-server V1/packed roundtrips, targeted Clippy and formatting passed locally on macOS. The packed roundtrip crosses the batch boundary and verifies restored schema and values. Linux and Windows CI remain pending.  Diagnostic benchmark: actual debug CLI binaries, 10k one-row logical tables, 5 ms injected per HTTP request, A/B/B/A order. SHOW CREATE requests fell from 10004 to 79; median schema-only total time was 92.573 s vs 3.264 s, and full packed export was 90.068 s vs 6.516 s. All 

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

### Incident Patch 1: `3a4c24a8` (2026-10-02)
**Commit Message**: fix: temporarily disable v2 series scan by default (#9436)

* fix: disable v2 series scan by default temporarily

Signed-off-by: evenyag <[REDACTED_EMAIL]>

* test: explicitly enable v2 series scan in sqlness configs

Signed-off-by: evenyag <[REDACTED_EMAIL]>

* test: regenerate sqlness results for legacy series scan default

Signed-off-by: evenyag <[REDACTED_EMAIL]>

---------

Signed-off-by: evenyag <[REDACTED_EMAIL]>

**File**: `config/config.md` (modified, +2/-2)
```diff
@@ -217,7 +217,7 @@
 | `region_engine.mito.min_compaction_interval` | String | `0m` | Minimum time interval between two compactions.<br/>To align with the old behavior, the default value is 0 (no restrictions). |
 | `region_engine.mito.schedule_compaction_after_edit` | Bool | `true` | Whether to allow to schedule a compaction after a successful region edit.<br/><br/>Setting this to "true" is a necessary but not sufficient condition for scheduling compaction after a region edit.<br/>Other constraints, such as "min_compaction_interval", may still prevent compaction from being scheduled.<br/>Setting this to "false", however, guarantees that compaction will not be scheduled after a region edit. |
 | `region_engine.mito.default_flat_format` | Bool | `true` | Whether to enable flat format as the default SST format. |
-| `region_engine.mito.experimental_series_scan_v2` | Bool | `true` | Whether to enable the experimental two-phase mode for eligible metric series scans. |
+| `region_engine.mito.experimental_series_scan_v2` | Bool | `false` | Whether to enable the experimental two-phase mode for eligible metric series scans. |
 | `region_engine.mito.index` | -- | -- | The options for index in Mito engine. |
 | `region_engine.mito.index.aux_path` | String | `""` | Auxiliary directory path for the index in filesystem, used to store intermediate files for<br/>creating the index and staging files for searching the index, defaults to `{data_home}/index_intermediate`.<br/>The default name for this directory is `index_intermediate` for backward compatibility.<br/><br/>This path contains two subdirectories:<br/>- `__intm`: for storing intermediate files used during creating index.<br/>- `staging`: for storing staging files used during searching index. |
 | `region_engine.mito.index.staging_size` | String | `2GB` | The max capacity of the staging directory. |
@@ -687,7 +687,7 @@
 | `region_engine.mito.min_compaction_interval` | String | `0m` | Minimum time interval between two compactions.<br/>To align with the old behavior, the default value is 0 (no restrictions). |
 | `region_engine.mito.schedule_compaction_after_edit` | Bool | `true` | Whether to allow to schedule a compaction after a successful region edit.<br/><br/>Setting this to "true" is a necessary but not sufficient condition for scheduling compaction after a region edit.<br/>Other constraints, such as "min_compaction_interval", may still prevent compaction from being scheduled.<br/>Setting this to "false", however, guarantees that compaction will not be scheduled after a region edit. |
 | `region_engine.mito.default_flat_format` | Bool | `true` | Whether to enable flat format as the default SST format. |
-| `region_engine.mito.experimental_series_scan_v2` | Bool | `true` | Whether to enable the experimental two-phase mode for eligible metric series scans. |
+| `region_engine.mito.experimental_series_scan_v2` | Bool | `false` | Whether to enable the experimental two-phase mode for eligible metric series scans. |
 | `region_engine.mito.index` | -- | -- | The options for index in Mito engine. |
 | `region_engine.mito.index.aux_path` | String | `""` | Auxiliary directory path for the index in filesystem, used to store intermediate files for<br/>creating the index and staging files for searching the index, defaults to `{data_home}/index_intermediate`.<br/>The default name for this directory is `index_intermediate` for backward compatibility.<br/><br/>This path contains two subdirectories:<br/>- `__intm`: for storing intermediate files used during creating index.<br/>- `staging`: for storing staging files used during searching index. |
 | `region_engine.mito.index.staging_size` | String | `2GB` | The max capacity of the staging directory. |
```

**File**: `config/datanode.example.toml` (modified, +1/-1)
```diff
@@ -687,7 +687,7 @@ schedule_compaction_after_edit = true
 default_flat_format = true
 
 ## Whether to enable the experimental two-phase mode for eligible metric series scans.
-experimental_series_scan_v2 = true
+experimental_series_scan_v2 = false
 
 ## The options for index in Mito engine.
 [region_engine.mito.index]
```

**File**: `config/standalone.example.toml` (modified, +1/-1)
```diff
@@ -891,7 +891,7 @@ schedule_compaction_after_edit = true
 default_flat_format = true
 
 ## Whether to enable the experimental two-phase mode for eligible metric series scans.
-experimental_series_scan_v2 = true
+experimental_series_scan_v2 = false
 
 ## The options for index in Mito engine.
 [region_engine.mito.index]
```

**File**: `src/mito2/src/config.rs` (modified, +2/-9)
```diff
@@ -262,7 +262,8 @@ impl Default for MitoConfig {
             min_compaction_interval: Duration::from_secs(0),
             schedule_compaction_after_edit: true,
             default_flat_format: true,
-            experimental_series_scan_v2: true,
+            // FIXME(#9435): Keep v2 opt-in while long-range scan memory usage is investigated.
+            experimental_series_scan_v2: false,
             gc: GcConfig::default(),
         };
 
@@ -498,14 +499,6 @@ mod tests {
             assert_eq!(config, restored);
         }
     }
-
-    #[test]
-    fn test_experimental_series_scan_v2_config() {
-        assert!(MitoConfig::default().experimental_series_scan_v2);
-
-        let config: MitoConfig = toml::from_str("experimental_series_scan_v2 = false").unwrap();
-        assert!(!config.experimental_series_scan_v2);
-    }
 }
 
 /// Index build mode.
```

**File**: `tests-integration/tests/http.rs` (modified, +1/-1)
```diff
@@ -2984,7 +2984,7 @@ scan_memory_on_exhausted = "fail"
 min_compaction_interval = "0s"
 schedule_compaction_after_edit = true
 default_flat_format = true
-experimental_series_scan_v2 = true
+experimental_series_scan_v2 = false
 
 [region_engine.mito.index]
 aux_path = ""
```

**File**: `tests/cases/standalone/common/promql/tsid_binary_join_regression.result` (modified, +28/-28)
```diff
@@ -127,13 +127,13 @@ TQL ANALYZE (0, 5, '5s') tsid_binary_join_left / tsid_binary_join_right;
 |_|_|_PromSeriesDivideExec: tags=["__tsid"] REDACTED
 |_|_|_ProjectionExec: expr=[greptime_value@1 as greptime_value, host@3 as host, job@4 as job, __tsid@2 as __tsid, ts@0 as ts] REDACTED
 |_|_|_CooperativeExec REDACTED
-|_|_|_SeriesScan: region=REDACTED, "partition_count":REDACTED, "distribution":"PerSeries", "mode":"two_phase" REDACTED
+|_|_|_SeriesScan: region=REDACTED, "partition_count":REDACTED, "distribution":"PerSeries", "mode":"legacy" REDACTED
 |_|_|_|
 | 1_| 0_|_PromInstantManipulateExec: range=[0..5000], lookback=[300000], interval=[5000], time index=[ts] REDACTED
 |_|_|_PromSeriesDivideExec: tags=["__tsid"] REDACTED
 |_|_|_ProjectionExec: expr=[greptime_value@1 as greptime_value, host@3 as host, job@4 as job, __tsid@2 as __tsid, ts@0 as ts] REDACTED
 |_|_|_CooperativeExec REDACTED
-|_|_|_SeriesScan: region=REDACTED, "partition_count":REDACTED, "distribution":"PerSeries", "mode":"two_phase" REDACTED
+|_|_|_SeriesScan: region=REDACTED, "partition_count":REDACTED, "distribution":"PerSeries", "mode":"legacy" REDACTED
 |_|_|_|
 |_|_| Total rows: 4_|
 +-+-+-+
@@ -167,13 +167,13 @@ TQL ANALYZE (0, 5, '5s') (tsid_binary_join_left + tsid_binary_join_right) / tsid
 |_|_|_PromSeriesDivideExec: tags=["__tsid"] REDACTED
 |_|_|_ProjectionExec: expr=[greptime_value@1 as greptime_value, host@3 as host, job@4 as job, __tsid@2 as __tsid, ts@0 as ts] REDACTED
 |_|_|_CooperativeExec REDACTED
-|_|_|_SeriesScan: region=REDACTED, "partition_count":REDACTED, "distribution":"PerSeries", "mode":"two_phase" REDACTED
+|_|_|_SeriesScan: region=REDACTED, "partition_count":REDACTED, "distribution":"PerSeries", "mode":"legacy" REDACTED
 |_|_|_|
 | 1_| 0_|_PromInstantManipulateExec: range=[0..5000], lookback=[300000], interval=[5000], time index=[ts] REDACTED
 |_|_|_PromSeriesDivideExec: tags=["__tsid"] REDACTED
 |_|_|_ProjectionExec: expr=[greptime_value@1 as greptime_value, host@3 as host, job@4 as job, __tsid@2 as __tsid, ts@0 as ts] REDACTED
 |_|_|_CooperativeExec REDACTED
-|_|_|_SeriesScan: region=REDACTED, "partition_count":REDACTED, "distribution":"PerSeries", "mode":"two_phase" REDACTED
+|_|_|_SeriesScan: region=REDACTED, "partition_count":REDACTED, "distribution":"PerSeries", "mode":"legacy" REDACTED
 |_|_|_|
 |_|_| Total rows: 4_|
 +-+-+-+
@@ -210,19 +210,19 @@ TQL ANALYZE (0, 5, '5s') ((tsid_binary_join_left + tsid_binary_join_right) * (ts
 |_|_|_PromSeriesDivideExec: tags=["__tsid"] REDACTED
 |_|_|_ProjectionExec: expr=[greptime_value@1 as greptime_value, host@3 as host, job@4 as job, __tsid@2 as __tsid, ts@0 as ts] REDACTED
 |_|_|_CooperativeExec REDACTED
-|_|_|_SeriesScan: region=REDACTED, "partition_count":REDACTED, "distribution":"PerSeries", "mode":"two_phase" REDACTED
+|_|_|_SeriesScan: region=REDACTED, "partition_count":REDACTED, "distribution":"PerSeries", "mode":"legacy" REDACTED
 |_|_|_|
 | 1_| 0_|_PromInstantManipulateExec: range=[0..5000], lookback=[300000], interval=[5000], time index=[ts] REDACTED
 |_|_|_PromSeriesDivideExec: tags=["__tsid"] REDACTED
 |_|_|_ProjectionExec: expr=[greptime_value@1 as greptime_value, host@3 as host, job@4 as job, __tsid@2 as __tsid, ts@0 as ts] REDACTED
 |_|_|_CooperativeExec REDACTED
-|_|_|_SeriesScan: region=REDACTED, "partition_count":REDACTED, "distribution":"PerSeries", "mode":"two_phase" REDACTED
+|_|_|_SeriesScan: region=REDACTED, "partition_count":REDACTED, "distribution":"PerSeries", "mode":"legacy" REDACTED
 |_|_|_|
 | 1_| 0_|_PromInstantManipulateExec: range=[0..5000], lookback=[300000], interval=[5000], time index=[ts] REDACTED
 |_|_|_PromSeriesDivideExec: tags=["__tsid"] REDACTED
 |_|_|_ProjectionExec: expr=[greptime_value@1 as greptime_value, host@3 as host, job@4 as job, __tsid@2 as __tsid, ts@0 as ts] REDACTED
 |_|_|_CooperativeExec REDACTED
-|_|_|_SeriesScan: region=REDACTED, "partition_count":REDACTED, "distribution":"PerSeries", "mode":"two_phase" REDACTED
+|_|_|_SeriesScan: region=REDACTED, "partition_count":REDACTED, "distribution":"PerSeries", "mode":"legacy" REDACTED
 |_|_|_|
 |_|_| Total rows: 4_|
 +-+-+-+
@@ -262,13 +262,13 @@ TQL ANALYZE (0, 5, '5s') tsid_binary_join_left / ignoring(host) tsid_binary_join
 |_|_|_PromSeriesDivideExec: tags=["__tsid"] REDACTED
 |_|_|_ProjectionExec: expr=[greptime_value@1 as greptime_value, host@3 as host, job@4 as job, __tsid@2 as __tsid, ts@0 as ts] REDACTED
 |_|_|_CooperativeExec REDACTED
-|_|_|_SeriesScan: region=REDACTED, "partition_count":REDACTED, "distribution":"PerSeries", "mode":"two_phase" REDACTED
+|_|_|_SeriesScan: region=REDACTED, "partition_count":REDACTED, "distribution":"PerSeries", "mode":"legacy" REDACTED
 |_|_|_|
 | 1_| 0_|_PromInstantManipulateExec: range=[0..5000], lookback=[300000], interval=[5000], time index=[ts] REDACTED
 |_|_|_PromSeriesDivideExec: tags=["__tsid"] REDACTED
 |_|_|_ProjectionExec: expr=[greptime_value@1 as greptime_value, host@3 as host, job@4 as job, __tsid@2 as __tsid, ts@0 as
```

**File**: `tests/cases/standalone/common/promql/tsid_histogram_quantile_regression.result` (modified, +1/-1)
```diff
@@ -118,7 +118,7 @@ TQL ANALYZE (0, 10, '5s') histogram_quantile(0.5, tsid_no_aggr_histogram_bucket)
 |_|_|_PromSeriesDivideExec: tags=["__tsid"] REDACTED
 |_|_|_ProjectionExec: expr=[val@1 as val, job@3 as job, le@4 as le, __tsid@2 as __tsid, ts@0 as ts] REDACTED
 |_|_|_CooperativeExec REDACTED
-|_|_|_SeriesScan: region=REDACTED, "partition_count":{"count":1, "mem_ranges":1, "files":0, "file_ranges":0}, "distribution":"PerSeries", "mode":"two_phase" REDACTED
+|_|_|_SeriesScan: region=REDACTED, "partition_count":{"count":1, "mem_ranges":1, "files":0, "file_ranges":0}, "distribution":"PerSeries", "mode":"legacy" REDACTED
 |_|_|_|
 |_|_| Total rows: 3_|
 +-+-+-+
```

**File**: `tests/cases/standalone/tql-explain-analyze/tsid_column.result` (modified, +6/-6)
```diff
@@ -54,7 +54,7 @@ TQL ANALYZE (0, 10, '5s') sum(tsid_metric);
 |_|_|_PromInstantManipulateExec: range=[0..10000], lookback=[300000], interval=[5000], time index=[ts] REDACTED
 |_|_|_PromSeriesDivideExec: tags=["__tsid"] REDACTED
 |_|_|_ProjectionExec: expr=[val@1 as val, __tsid@2 as __tsid, ts@0 as ts] REDACTED
-|_|_|_SeriesScan: region=REDACTED, "partition_count":{"count":1, "mem_ranges":1, "files":0, "file_ranges":0}, "distribution":"PerSeries", "mode":"two_phase" REDACTED
+|_|_|_SeriesScan: region=REDACTED, "partition_count":{"count":1, "mem_ranges":1, "files":0, "file_ranges":0}, "distribution":"PerSeries", "mode":"legacy" REDACTED
 |_|_|_|
 |_|_| Total rows: 3_|
 +-+-+-+
@@ -82,7 +82,7 @@ TQL ANALYZE (0, 10, '5s') sum by (job, instance) (tsid_metric);
 |_|_|_PromInstantManipulateExec: range=[0..10000], lookback=[300000], interval=[5000], time index=[ts] REDACTED
 |_|_|_PromSeriesDivideExec: tags=["__tsid"] REDACTED
 |_|_|_ProjectionExec: expr=[val@1 as val, instance@3 as instance, job@4 as job, __tsid@2 as __tsid, ts@0 as ts] REDACTED
-|_|_|_SeriesScan: region=REDACTED, "partition_count":{"count":1, "mem_ranges":1, "files":0, "file_ranges":0}, "distribution":"PerSeries", "mode":"two_phase" REDACTED
+|_|_|_SeriesScan: region=REDACTED, "partition_count":{"count":1, "mem_ranges":1, "files":0, "file_ranges":0}, "distribution":"PerSeries", "mode":"legacy" REDACTED
 |_|_|_|
 |_|_| Total rows: 6_|
 +-+-+-+
@@ -120,7 +120,7 @@ TQL ANALYZE (0, 10, '5s')  sum(irate(tsid_metric[1h])) / scalar(count(count(tsid
 |_|_|_PromInstantManipulateExec: range=[0..10000], lookback=[300000], interval=[5000], time index=[ts] REDACTED
 |_|_|_PromSeriesDivideExec: tags=["__tsid"] REDACTED
 |_|_|_ProjectionExec: expr=[val@1 as val, job@3 as job, __tsid@2 as __tsid, ts@0 as ts] REDACTED
-|_|_|_SeriesScan: region=REDACTED, "partition_count":{"count":1, "mem_ranges":1, "files":0, "file_ranges":0}, "distribution":"PerSeries", "mode":"two_phase" REDACTED
+|_|_|_SeriesScan: region=REDACTED, "partition_count":{"count":1, "mem_ranges":1, "files":0, "file_ranges":0}, "distribution":"PerSeries", "mode":"legacy" REDACTED
 |_|_|_|
 | 1_| 0_|_SortPreservingMergeExec: [ts@0 ASC NULLS LAST] REDACTED
 |_|_|_SortExec: expr=[ts@0 ASC NULLS LAST], preserve_partitioning=[true] REDACTED
@@ -133,7 +133,7 @@ TQL ANALYZE (0, 10, '5s')  sum(irate(tsid_metric[1h])) / scalar(count(count(tsid
 |_|_|_PromSeriesNormalizeExec: offset=[0], time index=[ts], filter NaN: [true] REDACTED
 |_|_|_PromSeriesDivideExec: tags=["__tsid"] REDACTED
 |_|_|_ProjectionExec: expr=[val@1 as val, __tsid@2 as __tsid, ts@0 as ts] REDACTED
-|_|_|_SeriesScan: region=REDACTED, "partition_count":{"count":1, "mem_ranges":1, "files":0, "file_ranges":0}, "distribution":"PerSeries", "mode":"two_phase" REDACTED
+|_|_|_SeriesScan: region=REDACTED, "partition_count":{"count":1, "mem_ranges":1, "files":0, "file_ranges":0}, "distribution":"PerSeries", "mode":"legacy" REDACTED
 |_|_|_|
 |_|_| Total rows: 2_|
 +-+-+-+
@@ -172,7 +172,7 @@ TQL ANALYZE (0, 10, '5s')  sum(irate(tsid_metric[1h])) / scalar(count(sum(tsid_m
 |_|_|_PromInstantManipulateExec: range=[0..10000], lookback=[300000], interval=[5000], time index=[ts] REDACTED
 |_|_|_PromSeriesDivideExec: tags=["__tsid"] REDACTED
 |_|_|_ProjectionExec: expr=[val@1 as val, job@3 as job, __tsid@2 as __tsid, ts@0 as ts] REDACTED
-|_|_|_SeriesScan: region=REDACTED, "partition_count":{"count":1, "mem_ranges":1, "files":0, "file_ranges":0}, "distribution":"PerSeries", "mode":"two_phase" REDACTED
+|_|_|_SeriesScan: region=REDACTED, "partition_count":{"count":1, "mem_ranges":1, "files":0, "file_ranges":0}, "distribution":"PerSeries", "mode":"legacy" REDACTED
 |_|_|_|
 | 1_| 0_|_SortPreservingMergeExec: [ts@0 ASC NULLS LAST] REDACTED
 |_|_|_SortExec: expr=[ts@0 ASC NULLS LAST], preserve_partitioning=[true] REDACTED
@@ -185,7 +185,7 @@ TQL ANALYZE (0, 10, '5s')  sum(irate(tsid_metric[1h])) / scalar(count(sum(tsid_m
 |_|_|_PromSeriesNormalizeExec: offset=[0], time index=[ts], filter NaN: [true] REDACTED
 |_|_|_PromSeriesDivideExec: tags=["__tsid"] REDACTED
 |_|_|_ProjectionExec: expr=[val@1 as val, __tsid@2 as __tsid, ts@0 as ts] REDACTED
-|_|_|_SeriesScan: region=REDACTED, "partition_count":{"count":1, "mem_ranges":1, "files":0, "file_ranges":0}, "distribution":"PerSeries", "mode":"two_phase" REDACTED
+|_|_|_SeriesScan: region=REDACTED, "partition_count":{"count":1, "mem_ranges":1, "files":0, "file_ranges":0}, "distribution":"PerSeries", "mode":"legacy" REDACTED
 |_|_|_|
 |_|_| Total rows: 2_|
 +-+-+-+
```

---

### Incident Patch 2: `a9ce6e2d` (2026-10-02)
**Commit Message**: ci: make query regression non-blocking for scheduled nightly releases (#9434)

* ci: make query regression non-blocking for scheduled nightly releases

Scheduled nightly releases no longer gate publishing on the query
regression release test. The test still runs (validation policy stays
'all' for automatic releases) and uploads its report, but any result -
failure, timeout, cancellation, or skip - no longer blocks image
publishing or the GitHub release for schedule-triggered runs.

Since reusable-workflow caller jobs cannot use continue-on-error, the
gate is relaxed at the consumers instead: the if conditions of
release-images-to-dockerhub and publish-github-release now also pass
when github.event_name == 'schedule' regardless of the query-regression
result. All other gates (runner allocation, artifact builds,
prepare-release-validation) are unchanged.

Tag-push and manual-dispatch releases remain fully blocking unless a
skip policy is explicitly chosen via the release_validation input.

Signed-off-by: Ning Sun <[REDACTED_EMAIL]>

* ci: preserve downstream nightly release jobs after regression failures

Signed-off-by: evenyag <[REDACTED_EMAIL]>

---------

Signed-off-by: Ning Sun <

**File**: `.github/workflows/release.yml` (modified, +40/-5)
```diff
@@ -84,7 +84,7 @@ on:
         default: false
       release_validation:
         type: choice
-        description: Manual policy for accepted perf regressions or runner failures; automatic releases always run all validation
+        description: Manual policy for accepted perf regressions or runner failures; automatic releases always run all validation (scheduled nightlies run query regression non-blocking)
         required: true
         default: all
         options:
@@ -468,6 +468,9 @@ jobs:
             if [[ "${validation_policy}" != "all" ]]; then
               echo "- ⚠️ Validation bypassed: compatibility=${run_compat}, query-regression=${run_query_regression}"
             fi
+            if [[ "${GITHUB_EVENT_NAME}" == "schedule" ]]; then
+              echo "- ℹ️ Query-regression failure or cancellation is non-blocking for scheduled nightly releases"
+            fi
           } >> "${GITHUB_STEP_SUMMARY}"
 
   compat-release:
@@ -551,6 +554,9 @@ jobs:
 
   release-images-to-dockerhub:
     name: Build and push images to DockerHub
+    # Scheduled nightly releases do not gate on query regression: the test
+    # still runs and reports, but a failure or cancellation does not block
+    # the nightly release.
     if: |
       always() &&
       (inputs.release_images || github.event_name == 'push' || github.event_name == 'schedule') &&
@@ -562,7 +568,8 @@ jobs:
       (needs.compat-release.result == 'success' ||
        (needs.prepare-release-validation.outputs.run-compat == 'false' && needs.compat-release.result == 'skipped')) &&
       (needs.query-regression-release.result == 'success' ||
-       (needs.prepare-release-validation.outputs.run-query-regression == 'false' && needs.query-regression-release.result == 'skipped'))
+       (needs.prepare-release-validation.outputs.run-query-regression == 'false' && needs.query-regression-release.result == 'skipped') ||
+       github.event_name == 'schedule')
     needs: [
       allocate-runners,
       build-linux-amd64-artifacts,
@@ -598,7 +605,18 @@ jobs:
 
   release-cn-artifacts:
     name: Release artifacts to CN region
-    if: ${{ (inputs.release_images || github.event_name == 'push' || github.event_name == 'schedule') && (github.event_name != 'schedule' || needs.allocate-runners.outputs.nightly-required == 'true') }}
+    # A non-blocking query regression failure must not skip downstream releases.
+    if: |
+      always() &&
+      (inputs.release_images || github.event_name == 'push' || github.event_name == 'schedule') &&
+      (github.event_name != 'schedule' || needs.allocate-runners.outputs.nightly-required == 'true') &&
+      needs.allocate-runners.result == 'success' &&
+      needs.build-linux-amd64-artifacts.result == 'success' &&
+      needs.build-linux-arm64-artifacts.result == 'success' &&
+      needs.build-linux-riscv64-artifacts.result == 'success' &&
+      needs.build-macos-artifacts.result == 'success' &&
+      needs.build-windows-artifacts.result == 'success' &&
+      needs.release-images-to-dockerhub.result == 'success'
     needs: [ # The job have to wait for all the artifacts are built.
       allocate-runners,
       build-linux-amd64-artifacts,
@@ -642,6 +660,8 @@ jobs:
     name: Create GitHub release and upload artifacts
     # Use always() to run even when optional jobs (macos, windows) are skipped.
     # Then check that required jobs succeeded and optional jobs didn't fail.
+    # Scheduled nightly releases do not gate on query regression either
+    # (see release-images-to-dockerhub); the test still runs and reports.
     if: |
       always() &&
       (inputs.publish_github_release || github.event_name == 'push' || github.event_name == 'schedule') &&
@@ -651,7 +671,8 @@ jobs:
       (needs.compat-release.result == 'success' ||
        (needs.prepare-release-validation.outputs.run-compat == 'false' && needs.compat-release.result == 'skipped')) &&
       (needs.query-regression-release.result == 'success' ||
-       (needs.prepare-release-validation.outputs.run-query-regression == 'false' && needs.query-regression-release.result == 'skipped')) &&
+       (needs.prepare-release-validation.outputs.run-query-regression == 'false' && needs.query-regression-release.result == 'skipped') ||
+       github.event_name == 'schedule') &&
       needs.build-linux-amd64-artifacts.result == 'success' &&
       needs.build-linux-arm64-artifacts.result == 'success' &&
       needs.build-linux-riscv64-artifacts.result == 'success' &&
@@ -754,7 +775,21 @@ jobs:
 
   bump-downstream-repo-versions:
     name: Bump downstream repo versions
-    if: ${{ (github.event_name == 'schedule' && needs.allocate-runners.outputs.nightly-required == 'true') || ((github.event_name == 'push' || github.event_name == 'workflow_dispatch') && github.ref_type == 'tag' && !contains(github.ref_name, 'nightly')) && (needs.allocate-runners.outputs.is-current-version-stable == 'true' && needs.allocate-runners.outputs.is-current-version-latest == '
```

---

### Incident Patch 3: `acebd6b3` (2026-10-02)
**Commit Message**: fix(catalog): skip backend batch_get on full cache hits (#9431)

fix(catalog): return cached batch values without an empty backend call

Count backend batch_get invocations in regression tests and cover empty input.

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

**File**: `src/catalog/src/kvbackend/client.rs` (modified, +26/-2)
```diff
@@ -192,6 +192,10 @@ impl KvBackend for CachedKvBackend {
             }
         }
 
+        if miss_keys.is_empty() {
+            return Ok(BatchGetResponse { kvs });
+        }
+
         let batch_get_req = BatchGetRequest::new().with_keys(miss_keys.clone());
 
         let pre_version = self.version();
@@ -503,6 +507,7 @@ mod tests {
     pub struct SimpleKvBackend {
         inner_map: DashMap<Vec<u8>, Vec<u8>>,
         get_execute_times: Arc<AtomicU32>,
+        batch_get_execute_times: Arc<AtomicU32>,
     }
 
     impl TxnService for SimpleKvBackend {
@@ -520,6 +525,7 @@ mod tests {
         }
 
         async fn batch_get(&self, req: BatchGetRequest) -> Result<BatchGetResponse, Self::Error> {
+            self.batch_get_execute_times.fetch_add(1, Ordering::SeqCst);
             let mut kvs = Vec::with_capacity(req.keys.len());
             for key in req.keys.iter() {
                 if let Some(kv) = self.get(key).await? {
@@ -571,6 +577,7 @@ mod tests {
     async fn test_cached_kv_backend() {
         let simple_kv = Arc::new(SimpleKvBackend::default());
         let get_execute_times = simple_kv.get_execute_times.clone();
+        let batch_get_execute_times = simple_kv.batch_get_execute_times.clone();
         let cached_kv = CachedKvBackend::wrap(simple_kv);
 
         add_some_vals(&cached_kv).await;
@@ -582,9 +589,11 @@ mod tests {
         assert_eq!(get_execute_times.load(Ordering::SeqCst), 0);
 
         for _ in 0..10 {
-            let _batch_get_resp = cached_kv.batch_get(batch_get_req.clone()).await.unwrap();
+            let batch_get_resp = cached_kv.batch_get(batch_get_req.clone()).await.unwrap();
 
+            assert_eq!(batch_get_resp.kvs.len(), 2);
             assert_eq!(get_execute_times.load(Ordering::SeqCst), 2);
+            assert_eq!(batch_get_execute_times.load(Ordering::SeqCst), 1);
         }
 
         let batch_get_req = BatchGetRequest {
@@ -594,14 +603,29 @@ mod tests {
         let _batch_get_resp = cached_kv.batch_get(batch_get_req.clone()).await.unwrap();
 
         assert_eq!(get_execute_times.load(Ordering::SeqCst), 3);
+        assert_eq!(batch_get_execute_times.load(Ordering::SeqCst), 2);
 
         for _ in 0..10 {
-            let _batch_get_resp = cached_kv.batch_get(batch_get_req.clone()).await.unwrap();
+            let batch_get_resp = cached_kv.batch_get(batch_get_req.clone()).await.unwrap();
 
+            assert_eq!(batch_get_resp.kvs.len(), 3);
             assert_eq!(get_execute_times.load(Ordering::SeqCst), 3);
+            assert_eq!(batch_get_execute_times.load(Ordering::SeqCst), 2);
         }
     }
 
+    #[tokio::test]
+    async fn test_cached_kv_backend_empty_batch_get() {
+        let simple_kv = Arc::new(SimpleKvBackend::default());
+        let cached_kv = CachedKvBackend::wrap(simple_kv.clone());
+
+        let response = cached_kv.batch_get(BatchGetRequest::new()).await.unwrap();
+
+        assert!(response.kvs.is_empty());
+        assert_eq!(simple_kv.batch_get_execute_times.load(Ordering::SeqCst), 0);
+        assert_eq!(simple_kv.get_execute_times.load(Ordering::SeqCst), 0);
+    }
+
     #[tokio::test]
     async fn test_cached_kv_backend_rejects_writes_with_read_only_inner() {
         let inner = Arc::new(MemoryKvBackend::<common_meta::error::Error>::new());
```

---

### Incident Patch 4: `a314ac42` (2026-09-30)
**Commit Message**: fix(mito2): truncate parquet column index min/max for SST writes (#9420)

* fix(mito2): truncate parquet column index min/max for SST writes

The SST writer and the bulk part encoder disabled column index truncation
together with statistics truncation in #6977. Mito never reads the column
index, but every page of a large string or binary column still stored its
full min and max values, uncompressed. Truncate the column index to the
parquet default of 64 bytes and keep chunk statistics untruncated, since
primary key pruning decodes them.

Signed-off-by: Dennis Zhuang <[REDACTED_EMAIL]>

* docs(mito2): note that the column index must not be used to decode primary keys

Signed-off-by: Dennis Zhuang <[REDACTED_EMAIL]>

---------

Signed-off-by: Dennis Zhuang <[REDACTED_EMAIL]>

**File**: `src/mito2/src/memtable/bulk/part.rs` (modified, +4/-2)
```diff
@@ -71,7 +71,9 @@ use crate::sst::SeriesEstimator;
 use crate::sst::index::IndexOutput;
 use crate::sst::parquet::flat_format::primary_key_column_index;
 use crate::sst::parquet::format::{PrimaryKeyArray, PrimaryKeyArrayBuilder};
-use crate::sst::parquet::{PARQUET_METADATA_KEY, SstInfo, apply_float_field_encoding};
+use crate::sst::parquet::{
+    COLUMN_INDEX_TRUNCATE_LENGTH, PARQUET_METADATA_KEY, SstInfo, apply_float_field_encoding,
+};
 
 const INIT_DICT_VALUE_CAPACITY: usize = 8;
 
@@ -1334,7 +1336,7 @@ impl BulkPartEncoder {
             .set_write_batch_size(row_group_size)
             .set_max_row_group_row_count(Some(row_group_size))
             .set_compression(Compression::ZSTD(ZstdLevel::default()))
-            .set_column_index_truncate_length(None)
+            .set_column_index_truncate_length(COLUMN_INDEX_TRUNCATE_LENGTH)
             .set_statistics_truncate_length(None);
         props = apply_float_field_encoding(props, &metadata, float_field_encoding);
         let writer_props = Some(props.build());
```

**File**: `src/mito2/src/sst/parquet.rs` (modified, +114/-0)
```diff
@@ -77,6 +77,18 @@ pub(crate) struct Json2TargetLayout {
 /// batching without changing the row group layout of newly written SSTs.
 pub const DEFAULT_ROW_GROUP_SIZE: usize = 100 * 1024;
 
+/// Truncation length of min/max values in the parquet column index.
+///
+/// Mito never reads the column index (it is skipped or stripped on load), so truncating
+/// it is safe. Chunk statistics stay untruncated because pruning decodes primary keys
+/// from them. Without truncation every page of a large string column stores its whole
+/// min and max values, uncompressed.
+///
+/// Truncated values are only bounds: code that starts reading the column index must not
+/// decode primary keys from it.
+pub(crate) const COLUMN_INDEX_TRUNCATE_LENGTH: Option<usize> =
+    parquet::file::properties::DEFAULT_COLUMN_INDEX_TRUNCATE_LENGTH;
+
 /// Applies the configured encoding to direct floating-point field columns.
 pub(crate) fn apply_float_field_encoding(
     mut builder: WriterPropertiesBuilder,
@@ -901,6 +913,82 @@ mod tests {
         .await;
     }
 
+    #[tokio::test]
+    async fn test_column_index_truncates_large_field_values() {
+        let mut env = TestEnv::new().await;
+        let object_store = env.init_object_store_manager();
+        let handle = sst_file_handle(0, 1000);
+        let file_path = FixedPathProvider {
+            region_file_id: handle.file_id(),
+        };
+        let metadata = build_test_binary_test_region_metadata();
+        // A tag long enough that the encoded primary key exceeds the 64-byte truncation length.
+        let tag = "t".repeat(100);
+        let values: Vec<Vec<u8>> = (0..64)
+            .map(|i| format!("{i:08}").into_bytes().repeat(4 * 1024))
+            .collect();
+        let batch = new_record_batch_with_binary_values(&tag, &values);
+        let mut metrics = Metrics::new(WriteType::Flush);
+        let mut writer = ParquetWriter::new_with_object_store(
+            object_store.clone(),
+            metadata.clone(),
+            IndexConfig::default(),
+            NoopIndexBuilder,
+            file_path,
+            &mut metrics,
+        )
+        .await;
+        writer
+            .write_all_flat_as_primary_key(
+                new_flat_source_from_record_batches(vec![batch]),
+                None,
+                &WriteOptions::default(),
+            )
+            .await
+            .unwrap();
+
+        let path = handle.file_path(FILE_DIR, PathType::Bare);
+        let bytes = object_store.read(&path).await.unwrap().to_bytes();
+        let options = parquet::arrow::arrow_reader::ArrowReaderOptions::new()
+            .with_page_index_policy(PageIndexPolicy::Required);
+        let builder =
+            ParquetRecordBatchReaderBuilder::try_new_with_options(bytes, options).unwrap();
+        let parquet_meta = builder.metadata().clone();
+        let schema = parquet_meta.file_metadata().schema_descr();
+        let column = |name: &str| {
+            (0..schema.num_columns())
+                .find(|i| schema.column(*i).name() == name)
+                .unwrap()
+        };
+
+        let field_index = &parquet_meta.column_index().unwrap()[0][column("field_0")];
+        let parquet::file::page_index::column_index::ColumnIndexMetaData::BYTE_ARRAY(field_index) =
+            field_index
+        else {
+            panic!("unexpected column index: {field_index:?}");
+        };
+        let mut pages = 0;
+        for (min, max) in field_index
+            .min_values_iter()
+            .zip(field_index.max_values_iter())
+        {
+            assert!(min.unwrap().len() <= 64);
+            assert!(max.unwrap().len() <= 64);
+            pages += 1;
+        }
+        assert!(pages > 1, "values should span several pages");
+
+        // Chunk statistics keep exact primary keys; pruning decodes them.
+        let pk_stats = parquet_meta
+            .row_group(0)
+            .column(column(store_api::storage::consts::PRIMARY_KEY_COLUMN_NAME))
+            .statistics()
+            .unwrap();
+        let pk = new_primary_key(&[&tag]);
+        assert!(pk.len() > 64);
+        assert_eq!(pk_stats.max_bytes_opt().unwrap(), pk.as_slice());
+    }
+
     #[rstest::rstest]
     #[tokio::test]
     async fn test_write_multiple_files(#[values(1024, 4096)] write_buffer_size: usize) {
@@ -1475,6 +1563,32 @@ mod tests {
         assert!(cached.contains_row_group(3));
     }
 
+    fn new_record_batch_with_binary_values(tag: &str, values: &[Vec<u8>]) -> RecordBatch {
+        let metadata = build_test_binary_test_region_metadata();
+        let flat_schema = to_flat_sst_arrow_schema(&metadata, &FlatSchemaOptions::default());
+        let num_rows = values.len();
+        let mut tag_0_builder = StringDictionaryBuilder::<UInt32Type>::new();
+        let mut pk_builder = BinaryDictionaryBuilder::<UInt32Type>::new();
+        let pk = new_primary_key(&[tag]);
+        for _ in 0..num_rows {
+            tag_0_builder.append_value(tag);
+           
```

**File**: `src/mito2/src/sst/parquet/writer.rs` (modified, +3/-2)
```diff
@@ -62,7 +62,8 @@ use crate::sst::parquet::flat_format::{
 };
 use crate::sst::parquet::format::{PrimaryKeyArray, PrimaryKeyWriteFormat};
 use crate::sst::parquet::{
-    PARQUET_METADATA_KEY, SstInfo, WriteOptions, apply_float_field_encoding,
+    COLUMN_INDEX_TRUNCATE_LENGTH, PARQUET_METADATA_KEY, SstInfo, WriteOptions,
+    apply_float_field_encoding,
 };
 use crate::sst::{
     DEFAULT_WRITE_CONCURRENCY, FlatSchemaOptions, SeriesEstimator, maybe_wrap_schema,
@@ -544,7 +545,7 @@ where
                 .set_compression(Compression::ZSTD(ZstdLevel::default()))
                 .set_encoding(Encoding::PLAIN)
                 .set_max_row_group_row_count(Some(opts.row_group_size))
-                .set_column_index_truncate_length(None)
+                .set_column_index_truncate_length(COLUMN_INDEX_TRUNCATE_LENGTH)
                 .set_statistics_truncate_length(None);
             let ts_col = ColumnPath::new(vec![
                 self.metadata.time_index_column().column_schema.name.clone(),
```

---

### Incident Patch 5: `78a7b932` (2026-09-30)
**Commit Message**: fix(promql): align timestamp(), label_join and label_replace with Prometheus semantics (#9385)

* fix(promql): align timestamp() and label_join with Prometheus semantics

- timestamp() over a selector reports the selected sample's timestamp, without adding the offset.
- timestamp() over any other expression reports the evaluation time instead of the input value.
- label_join that overwrites an existing label rejects duplicate label sets at runtime.

Signed-off-by: Dennis Zhuang <[REDACTED_EMAIL]>

* fix(promql): align label_replace and label_join edge cases with Prometheus

- label_replace leaves non-matching series unchanged instead of copying the source value into the destination label.
- label_replace may overwrite an existing label; duplicate label sets are rejected at runtime like label_join.
- label_join with no source labels removes the destination label, and an empty source label name is rejected.
- Empty label values produced by these functions are NULL, the same as an absent label.

Signed-off-by: Dennis Zhuang <[REDACTED_EMAIL]>

* fix(promql): join absent labels as empty strings in label_join

concat_ws skips NULL arguments together with their separator, so a label that

**File**: `src/promql/src/functions/vector_matching.rs` (modified, +5/-0)
```diff
@@ -34,6 +34,8 @@ pub enum MatchGroupViolation {
     ImplicitManyToOne,
     /// A group modifier left several matches with the same result label set.
     AmbiguousGroupLabels,
+    /// A function rewrote labels so that several series share the same label set.
+    DuplicateLabelSet,
 }
 
 impl MatchGroupViolation {
@@ -54,6 +56,9 @@ impl MatchGroupViolation {
             Self::AmbiguousGroupLabels => format!(
                 "multiple matches for labels {group}: grouping labels must ensure unique matches"
             ),
+            Self::DuplicateLabelSet => {
+                "vector cannot contain metrics with the same labelset".to_string()
+            }
         }
     }
 }
```

**File**: `src/query/src/promql/error.rs` (modified, +0/-7)
```diff
@@ -217,12 +217,6 @@ pub enum Error {
         location: Location,
     },
 
-    #[snafu(display("vector cannot contain metrics with the same labelset"))]
-    SameLabelSet {
-        #[snafu(implicit)]
-        location: Location,
-    },
-
     #[snafu(display("Invalid regular expression in label_replace(): {}", regex))]
     InvalidRegularExpression {
         regex: String,
@@ -256,7 +250,6 @@ impl ErrorExt for Error {
             | CombineTableColumnMismatch { .. }
             | UnexpectedPlanExpr { .. }
             | UnsupportedMatcherOp { .. }
-            | SameLabelSet { .. }
             | TimestampOutOfRange { .. }
             | SystemTimeOutOfRange { .. }
             | AtModifierTimestampOutOfRange { .. }
```

**File**: `src/query/src/promql/planner.rs` (modified, +167/-138)
```diff
@@ -107,7 +107,7 @@ use crate::promql::error::{
     CatalogSnafu, ColumnNotFoundSnafu, DataFusionPlanningSnafu, ExpectRangeSelectorSnafu,
     FunctionInvalidArgumentSnafu, InvalidDestinationLabelNameSnafu, InvalidRegularExpressionSnafu,
     InvalidTimeRangeSnafu, MultiFieldsNotSupportedSnafu, MultipleMetricMatchersSnafu,
-    MultipleVectorSnafu, NoMetricMatcherSnafu, Result, SameLabelSetSnafu, TableNameNotFoundSnafu,
+    MultipleVectorSnafu, NoMetricMatcherSnafu, Result, TableNameNotFoundSnafu,
     TimeIndexNotFoundSnafu, UnexpectedPlanExprSnafu, UnexpectedTokenSnafu, UnknownTableSnafu,
     UnsupportedExprSnafu, UnsupportedMatcherOpSnafu, ValueNotFoundSnafu, ZeroRangeSelectorSnafu,
 };
@@ -1752,47 +1752,9 @@ impl PromPlanner {
                     DfExpr::Column(Column::new(qualifier.cloned(), field.name().clone()))
                 })
                 .collect::<Vec<_>>();
-            // `timestamp()` preserves the shifted selector timeline even though
-            // SeriesNormalize now retains raw native timestamp storage. Decimal
-            // arithmetic shifts before truncating to milliseconds.
-            let unit_factor = match ident(&time_index_column)
-                .get_type(normalize.schema())
-                .context(DataFusionPlanningSnafu)?
-            {
-                ArrowDataType::Timestamp(ArrowTimeUnit::Second, _) => (1_000_i128, 4, 0),
-                ArrowDataType::Timestamp(ArrowTimeUnit::Millisecond, _) => (1, 1, 0),
-                ArrowDataType::Timestamp(ArrowTimeUnit::Microsecond, _) => (1, 4, 3),
-                ArrowDataType::Timestamp(ArrowTimeUnit::Nanosecond, _) => (1, 7, 6),
-                _ => unreachable!("time index is a timestamp"),
-            };
-            let sample_time = ident(&time_index_column)
-                .cast_to(&ArrowDataType::Int64, normalize.schema())
-                .context(DataFusionPlanningSnafu)?
-                .cast_to(&ArrowDataType::Decimal128(19, 0), normalize.schema())
-                .context(DataFusionPlanningSnafu)?;
-            let sample_time = DfExpr::BinaryExpr(BinaryExpr {
-                left: Box::new(sample_time),
-                op: Operator::Multiply,
-                right: Box::new(lit(ScalarValue::Decimal128(
-                    Some(unit_factor.0),
-                    unit_factor.1,
-                    unit_factor.2,
-                ))),
-            });
-            let sample_time = DfExpr::BinaryExpr(BinaryExpr {
-                left: Box::new(sample_time),
-                op: Operator::Plus,
-                right: Box::new(lit(ScalarValue::Decimal128(Some(offset_ms as i128), 19, 0))),
-            })
-            .cast_to(&ArrowDataType::Int64, normalize.schema())
-            .context(DataFusionPlanningSnafu)?
-            .cast_to(&ArrowDataType::Float64, normalize.schema())
-            .context(DataFusionPlanningSnafu)?;
-            let sample_time = DfExpr::BinaryExpr(BinaryExpr {
-                left: Box::new(sample_time),
-                op: Operator::Divide,
-                right: Box::new(lit(1000.0)),
-            });
+            // The time index still holds the raw sample timestamp here, which is what
+            // `timestamp()` reports regardless of `offset` and `@`.
+            let sample_time = Self::timestamp_seconds_expr(&time_index_column, normalize.schema())?;
             project_exprs.push(sample_time.alias(&timestamp_value_column));
             let normalize = LogicalPlanBuilder::from(normalize)
                 .project(project_exprs)
@@ -1846,47 +1808,60 @@ impl PromPlanner {
             }),
         };
         if let Some(timestamp_value_column) = timestamp_value_column {
-            self.create_timestamp_func_plan(manipulate, &timestamp_value_column)
+            self.create_timestamp_func_plan(manipulate, ident(timestamp_value_column))
         } else {
             Ok(manipulate)
         }
     }
 
-    /// Builds a projection plan for the PromQL `timestamp()` function.
-    /// Projects the time index column as the value column for each row.
-    ///
-    /// # Arguments
-    /// * `input` - Input [`LogicalPlan`] after instant-vector selection.
-    /// * `timestamp_value_column` - Private column containing each selected sample's timestamp.
-    ///
-    /// # Returns
-    /// Returns a [`Result<LogicalPlan>`] where the resulting logical plan projects the timestamp
-    /// column as the value column, along with the original tag and time index columns.
-    ///
-    /// # Timestamp vs. Time Function
-    ///
-    /// - **Timestamp Function (`timestamp()`)**: In PromQL, the `timestamp()` function returns the
-    ///   timestamp (time index) of each sample as the value column.
-    ///
-    /// - **Time Function (`time()`)**: The `time()` function returns the evaluation time of the query
-    ///   as a scalar value.
+    /// Converts the timestamp column `column` into PromQL seconds, truncated to milliseconds.
+    fn timestamp_seconds_expr(c
```

**File**: `src/query/src/promql/planner/test.rs` (modified, +12/-11)
```diff
@@ -1699,12 +1699,13 @@ async fn single_timestamp_plan_preserves_source_value() {
         "Filter: value IS NOT NULL [timestamp:Timestamp(ms), value:Float64, tag_0:Utf8]\
             \n  Projection: some_metric.timestamp, value AS value, some_metric.tag_0 [timestamp:Timestamp(ms), value:Float64, tag_0:Utf8]\
             \n    Projection: some_metric.timestamp, __promql_timestamp_value_ AS value, some_metric.tag_0 [timestamp:Timestamp(ms), value:Float64, tag_0:Utf8]\
-            \n      PromInstantManipulate: range=[0..100000000], lookback=[1000], interval=[5000], time index=[timestamp] [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N, __promql_timestamp_value_:Float64]\
-            \n        Projection: some_metric.tag_0, some_metric.timestamp, some_metric.field_0, CAST(CAST(CAST(CAST(some_metric.timestamp AS Int64) AS Decimal128(19, 0)) * Decimal128(1,1,0) + Decimal128(0,19,0) AS Int64) AS Float64) / Float64(1000) AS __promql_timestamp_value_ [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N, __promql_timestamp_value_:Float64]\
-            \n          PromSeriesDivide: tags=[\"tag_0\"] [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]\
-            \n            Sort: some_metric.tag_0 ASC NULLS FIRST, some_metric.timestamp ASC NULLS FIRST [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]\
-            \n              Filter: some_metric.tag_0 != Utf8(\"bar\") AND some_metric.timestamp >= TimestampMillisecond(-999, None) AND some_metric.timestamp <= TimestampMillisecond(100000000, None) [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]\
-            \n                TableScan: some_metric [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]",
+            \n      Filter: some_metric.field_0 IS NOT NULL [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N, __promql_timestamp_value_:Float64]\
+            \n        PromInstantManipulate: range=[0..100000000], lookback=[1000], interval=[5000], time index=[timestamp] [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N, __promql_timestamp_value_:Float64]\
+            \n          Projection: some_metric.tag_0, some_metric.timestamp, some_metric.field_0, CAST(CAST(some_metric.timestamp AS Int64) AS Float64) / Float64(1000) AS __promql_timestamp_value_ [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N, __promql_timestamp_value_:Float64]\
+            \n            PromSeriesDivide: tags=[\"tag_0\"] [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]\
+            \n              Sort: some_metric.tag_0 ASC NULLS FIRST, some_metric.timestamp ASC NULLS FIRST [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]\
+            \n                Filter: some_metric.tag_0 != Utf8(\"bar\") AND some_metric.timestamp >= TimestampMillisecond(-999, None) AND some_metric.timestamp <= TimestampMillisecond(100000000, None) [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]\
+            \n                  TableScan: some_metric [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]",
     );
 
     assert_eq!(plan.display_indent_schema().to_string(), expected);
@@ -2413,9 +2414,9 @@ async fn at_modifier_keeps_multi_series_roots_out_of_promoted_subtree() {
 async fn at_modifier_does_not_promote_label_join() {
     for query in [
         // Directly above the anchored instant selector...
-        "label_join(some_metric @ 300, \"tag_0\", \"-\", \"\")",
+        "label_join(some_metric @ 300, \"tag_0\", \"-\", \"tag_0\", \"tag_0\")",
         // ... and below another call, which is planned as usual over the join.
-        "abs(label_join(some_metric @ 300, \"tag_0\", \"-\", \"\"))",
+        "abs(label_join(some_metric @ 300, \"tag_0\", \"-\", \"tag_0\", \"tag_0\"))",
     ] {
         let plan = build_at_modifier_plan(query, 0, 1000).await;
         let plan_str = plan.display_indent_schema().to_string();
@@ -2448,7 +2449,7 @@ async fn at_modifier_does_not_promote_label_join() {
     // A range call below the join is still promoted on its own: the anchored window is folded
     // once per series, and the join above it is evaluated at every step over that replay.
     let plan = build_at_modifier_plan(
-        "label_join(rate(some_metric[5m] @ 300), \"tag_0\", \"-\", \"\")",
+        "label_join(rate(some_metric[5m] @ 300), \"tag_0\", \"-\", \"tag_0\", \"tag_0\")",
         0,
         1000,
     )
@@ -5902,7 +5903,7 @@ async fn test_label_join() {
 
     let expected = r#"
 Filter: up.field_0 IS NOT NULL [timestamp:Timestamp(ms), field_0:Float64;N, foo:Utf8;N, tag_0:Utf8, tag_1:Utf8, tag_2:Utf8, tag_3:Utf8]
-  Projection: up.timestamp, up.field_0, concat_ws(Utf8(","), up.tag_1, up.tag_2, up.tag_3) AS foo, up.tag_0, up.tag_1, up.tag_2, up.tag_3 [timestamp:Timestamp(ms), field_0:Float64;N, foo:Utf8;N, tag_0:Utf8, tag_1:Utf8, tag_2:Utf8, tag_3:Utf8]
+  Projection: up.timestamp, up.field_0, nullif(concat_ws(Utf8(","), coalesce(up.tag_1, Utf8("")), coalesce(up.tag_2, Utf8("")), coalesce(up.tag_3, Utf8(""))
```

**File**: `src/query/src/promql/planner/test/delta.rs` (modified, +2/-2)
```diff
@@ -1102,12 +1102,12 @@ async fn delta_offsets_survive_optimized_plan_serialization() {
         (
             "timestamp positive offset",
             r#"timestamp(delta_metric{series="cumulative"} offset 60s)"#,
-            120.0,
+            60.0,
         ),
         (
             "timestamp negative offset",
             r#"timestamp(delta_metric{series="cumulative"} offset -60s)"#,
-            120.0,
+            180.0,
         ),
         (
             "range positive offset",
```

**File**: `tests-integration/tests/http.rs` (modified, +25/-0)
```diff
@@ -1022,6 +1022,31 @@ pub async fn test_prometheus_label_replace_response(store_type: StorageType) {
         .unwrap()
     );
 
+    // A series whose source value does not match keeps its labels, without `host_copy`.
+    let query = encode(r#"label_replace(demo, "host_copy", "$1", "host", "other(.*)")"#);
+    let res = client
+        .get(&format!("/v1/prometheus/api/v1/query?query={query}&time=0"))
+        .send()
+        .await;
+
+    assert_eq!(res.status(), StatusCode::OK);
+    let body = res.json::<PrometheusJsonResponse>().await;
+    assert_eq!(body.status, "success");
+    assert_eq!(
+        body.data,
+        serde_json::from_value::<PrometheusResponse>(json!({
+            "resultType": "vector",
+            "result": [{
+                "metric": {
+                    "__name__": "demo",
+                    "host": "host1"
+                },
+                "value": [0.0, "1.1"]
+            }]
+        }))
+        .unwrap()
+    );
+
     guard.remove_all().await;
 }
 
```

**File**: `tests/cases/standalone/common/promql/at_modifier.result` (modified, +62/-55)
```diff
@@ -621,9 +621,6 @@ TQL EVAL (330, 390, '60s') predict_linear(at_modifier_gauge{host="a"}[5m] offset
 -- on its own and `timestamp()` reports the timestamp of the sample the anchor selected at every
 -- step (300s here). Its plan keeps the anchored selection below the replay of the grid and projects
 -- the timestamp above it.
---
--- Only an `@` without an `offset` is asserted here: the value of `timestamp()` for an anchored
--- selector that also carries an `offset` is a pre-existing question of its own, out of scope here.
 -- SQLNESS SORT_RESULT 3 1
 TQL EVAL (0, 240, '60s') timestamp(at_modifier_gauge @ 300);
 
@@ -642,95 +639,105 @@ TQL EVAL (0, 240, '60s') timestamp(at_modifier_gauge @ 300);
 | 1970-01-01T00:04:00 | 300.0 | b    |
 +---------------------+-------+------+
 
+-- With an `offset`, the anchor selects the sample at 240s, and `timestamp()` reports 240s.
+-- SQLNESS SORT_RESULT 3 1
+TQL EVAL (0, 120, '60s') timestamp(at_modifier_gauge @ 300 offset 1m);
+
++---------------------+-------+------+
+| ts                  | value | host |
++---------------------+-------+------+
+| 1970-01-01T00:00:00 | 240.0 | a    |
+| 1970-01-01T00:00:00 | 240.0 | b    |
+| 1970-01-01T00:01:00 | 240.0 | a    |
+| 1970-01-01T00:01:00 | 240.0 | b    |
+| 1970-01-01T00:02:00 | 240.0 | a    |
+| 1970-01-01T00:02:00 | 240.0 | b    |
++---------------------+-------+------+
+
 -- SQLNESS REPLACE (RoundRobinBatch.*) REDACTED
 -- SQLNESS REPLACE (peers.*) REDACTED
 -- SQLNESS REPLACE (Hash.*) REDACTED
 -- SQLNESS REPLACE (RepartitionExec:.*) RepartitionExec: REDACTED
 TQL EXPLAIN (0, 240, '60s') timestamp(at_modifier_gauge @ 300);
 
-+---------------+--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
-| plan_type     | plan                                                                                                                                                                                                                                                                                 |
-+---------------+--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
-| logical_plan  | MergeScan [is_placeholder=false, remote_input=[                                                                                                                                                                                                                                      |
-|               | Projection: at_modifier_gauge.ts, value AS value, at_modifier_gauge.host                                                                                                                                                                                                             |
-|               |   Projection: at_modifier_gauge.ts, __promql_timestamp_value_ AS value, at_modifier_gauge.host                                                                                                                                                                                       |
-|               |     PromInstantManipulate: range=[0..240000], lookback=[240001], interval=[60000], time index=[ts]                                                                                                                                                                                   |
-|               |       PromInstantManipulate: range=[0..0], lookback=[300000], interval=[60000], time index=[ts]                                                                                                                                                                                      |
-|               |         Projection: at_modifier_gauge.ts, at_modifier_gauge.val, at_modifier_gauge.host, CAST(CAST(CAST(CAST(CAST(at_modifier_gauge.ts AS Int64) AS Decimal128(19, 0)) AS Decimal128(21, 0)) + Decimal128(0,19,0) AS Int64) AS Float64) / Float64(1000) AS __promql_timestamp_value_ |
-|               |           PromSeriesNormalize: offset=[-300000], time index=[ts], filter NaN: [false]                                                                                                                                                                                                |
-|               |             PromSeriesDivide: tags=["host"]                                                                                                                                                                                                                                          |
-|               |               Sort: at_modifier_gauge.host ASC NULLS FIRS
```

**File**: `tests/cases/standalone/common/promql/at_modifier.sql` (modified, +8/-13)
```diff
@@ -258,43 +258,38 @@ TQL EVAL (330, 390, '60s') predict_linear(at_modifier_gauge{host="a"}[5m] offset
 -- on its own and `timestamp()` reports the timestamp of the sample the anchor selected at every
 -- step (300s here). Its plan keeps the anchored selection below the replay of the grid and projects
 -- the timestamp above it.
---
--- Only an `@` without an `offset` is asserted here: the value of `timestamp()` for an anchored
--- selector that also carries an `offset` is a pre-existing question of its own, out of scope here.
 -- SQLNESS SORT_RESULT 3 1
 TQL EVAL (0, 240, '60s') timestamp(at_modifier_gauge @ 300);
 
+-- With an `offset`, the anchor selects the sample at 240s, and `timestamp()` reports 240s.
+-- SQLNESS SORT_RESULT 3 1
+TQL EVAL (0, 120, '60s') timestamp(at_modifier_gauge @ 300 offset 1m);
+
 -- SQLNESS REPLACE (RoundRobinBatch.*) REDACTED
 -- SQLNESS REPLACE (peers.*) REDACTED
 -- SQLNESS REPLACE (Hash.*) REDACTED
 -- SQLNESS REPLACE (RepartitionExec:.*) RepartitionExec: REDACTED
 TQL EXPLAIN (0, 240, '60s') timestamp(at_modifier_gauge @ 300);
 
 -- 11. `label_join` above an anchored selector. The call rewrites the label the input series are
--- told apart by (`host` becomes the empty string), so it is never promoted: it must stay above the
+-- told apart by (`host` becomes `a-a` and `b-b`), so it is never promoted: it must stay above the
 -- per-series replay of the selector and be evaluated at every step. Both hosts are still reported,
 -- with their own value, at every step. A promoted `label_join` would instead be replayed through
 -- the labels it just rewrote and report the two series as a single timeline, i.e. one mixed row
 -- per step.
---
--- The invariant asserted here is scoped to the replay: it must not drop or mix the input rows.
--- It is not a claim about the final PromQL semantics of this query: joining `host` to one value
--- leaves two samples with the same label set at the same timestamp, which Prometheus rejects,
--- while `label_join` does not validate that yet (`label_replace` errors on such a rewrite
--- instead). That duplicate-labelset validation gap is pre-existing and out of scope here.
 -- SQLNESS SORT_RESULT 3 1
-TQL EVAL (300, 480, '60s') label_join(at_modifier_gauge @ 300, "host", "", "");
+TQL EVAL (300, 480, '60s') label_join(at_modifier_gauge @ 300, "host", "-", "host", "host");
 
 -- The same join below another call: neither is promoted, and both are evaluated at every step over
 -- the per-series replay of the anchored selector.
 -- SQLNESS SORT_RESULT 3 1
-TQL EVAL (300, 480, '60s') abs(label_join(at_modifier_gauge @ 300, "host", "", ""));
+TQL EVAL (300, 480, '60s') abs(label_join(at_modifier_gauge @ 300, "host", "-", "host", "host"));
 
 -- A range call below the join is still promoted on its own (it is the direct call over the
 -- anchored range selector): the anchored window is folded once per series, and the join above that
 -- replay reports the rate of both hosts at every step.
 -- SQLNESS SORT_RESULT 3 1
-TQL EVAL (300, 480, '60s') label_join(rate(at_modifier_counter_total[5m] @ 300), "host", "", "");
+TQL EVAL (300, 480, '60s') label_join(rate(at_modifier_counter_total[5m] @ 300), "host", "-", "host", "host");
 
 DROP TABLE at_modifier_gauge;
 
```

---

### Incident Patch 6: `3131cdbc` (2026-09-29)
**Commit Message**: fix: bound decompressed request size and close memory-admission gaps for compressed requests (#9264)

* fix: bound decompressed request size and close memory-admission gaps for compressed requests

The request-memory accounting only bounds and charges the encoded bytes on
the wire, but a compressed body can expand far beyond that during
decompression, so tiny requests could allocate disproportionate frontend
memory before any protobuf validation or quota charge.

- Handler-level decompression (Prometheus remote read/write v1+v2, Loki)
  now enforces a hard 512 MiB decoded-size cap, checked before any output
  buffer is allocated, and charges the decoded bytes to the shared
  ServerMemoryLimiter, holding the permits for the lifetime of the
  decompressed buffer.
- gRPC requests with transport compression reserve the configured
  max_recv_message_size before tonic decompresses, so the decoding phase
  is admitted against max_in_flight_write_bytes; the later per-message
  charge is skipped to avoid double accounting.
- The HTTP memory-limit middleware keeps its upfront Content-Length charge
  but now also accounts the bytes actually streamed beyond it, so chunked
  requests and unders

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -13589,6 +13589,7 @@ dependencies = [
  "hex",
  "hostname 0.3.1",
  "http 1.5.0",
+ "http-body 1.0.1",
  "humantime",
  "humantime-serde",
  "hyper 1.6.0",
```

**File**: `src/servers/Cargo.toml` (modified, +1/-0)
```diff
@@ -70,6 +70,7 @@ headers = "0.4"
 hex.workspace = true
 hostname = "0.3"
 http.workspace = true
+http-body = "1"
 humantime.workspace = true
 humantime-serde.workspace = true
 hyper = { workspace = true, features = ["full"] }
```

**File**: `src/servers/src/error.rs` (modified, +13/-0)
```diff
@@ -319,6 +319,18 @@ pub enum Error {
         error: std::io::Error,
     },
 
+    #[snafu(display(
+        "Decompressed request body is too large: {} bytes exceeds the limit {} bytes",
+        size,
+        limit
+    ))]
+    DecompressedBodyTooLarge {
+        size: u64,
+        limit: u64,
+        #[snafu(implicit)]
+        location: Location,
+    },
+
     #[snafu(display("Failed to compress prometheus remote request"))]
     CompressPromRemoteRequest {
         #[snafu(implicit)]
@@ -785,6 +797,7 @@ impl ErrorExt for Error {
             | DecompressSnappyPromRemoteRequest { .. }
             | DecompressSnappyLokiRequest { .. }
             | DecompressZstdPromRemoteRequest { .. }
+            | DecompressedBodyTooLarge { .. }
             | InvalidPromRemoteRequest { .. }
             | InvalidFlightTicket { .. }
             | InvalidPrepareStatement { .. }
```

**File**: `src/servers/src/grpc.rs` (modified, +10/-8)
```diff
@@ -50,6 +50,7 @@ use tonic::{Request, Response, Status};
 use tonic_reflection::server::v1::{ServerReflection, ServerReflectionServer};
 
 use crate::error::{AlreadyStartedSnafu, InternalSnafu, Result, StartGrpcSnafu, TcpBindSnafu};
+use crate::grpc::memory_limit::MemoryLimiterExtensionService;
 use crate::install_default_crypto_provider;
 use crate::metrics::MetricsMiddlewareLayer;
 use crate::otel_arrow::{HeaderInterceptor, OtelArrowServiceHandler};
@@ -213,6 +214,14 @@ impl FlightCompression {
     }
 }
 
+/// The wrapped OTLP Arrow service type used by [`GrpcServer`].
+type OtelArrowService = MemoryLimiterExtensionService<
+    InterceptedService<
+        ArrowMetricsServiceServer<OtelArrowServiceHandler<OpenTelemetryProtocolHandlerRef>>,
+        HeaderInterceptor,
+    >,
+>;
+
 pub struct GrpcServer {
     // states
     shutdown_tx: Mutex<Option<Sender<()>>>,
@@ -224,14 +233,7 @@ pub struct GrpcServer {
     // tls config
     tls_config: Option<ServerTlsConfig>,
     // Otel arrow service
-    otel_arrow_service: Mutex<
-        Option<
-            InterceptedService<
-                ArrowMetricsServiceServer<OtelArrowServiceHandler<OpenTelemetryProtocolHandlerRef>>,
-                HeaderInterceptor,
-            >,
-        >,
-    >,
+    otel_arrow_service: Mutex<Option<OtelArrowService>>,
     bind_addr: Option<SocketAddr>,
     name: Option<String>,
     config: GrpcServerConfig,
```

**File**: `src/servers/src/grpc/builder.rs` (modified, +15/-4)
```diff
@@ -34,12 +34,13 @@ use tonic::codegen::Service;
 use tonic::service::RoutesBuilder;
 use tonic::service::interceptor::InterceptedService;
 use tonic::transport::{Identity, ServerTlsConfig};
-use tower::Layer;
+use tower::{Layer, ServiceBuilder};
 
 use crate::grpc::database::DatabaseService;
 use crate::grpc::flight::{FlightCraftRef, FlightCraftWrapper};
 use crate::grpc::frontend_grpc_handler::FrontendGrpcHandler;
 use crate::grpc::greptime_handler::GreptimeRequestHandler;
+use crate::grpc::memory_limit::{MemoryLimiterExtensionLayer, MemoryLimiterExtensionService};
 use crate::grpc::prom_query_gateway::PrometheusGatewayService;
 use crate::grpc::region_server::{RegionServerHandlerRef, RegionServerRequestHandler};
 use crate::grpc::{GrpcServer, GrpcServerConfig};
@@ -71,6 +72,7 @@ macro_rules! add_service {
         let service_with_limiter = $crate::tower::ServiceBuilder::new()
             .layer(MemoryLimiterExtensionLayer::new(
                 $builder.memory_limiter().clone(),
+                max_recv_message_size,
             ))
             .service(service_builder);
 
@@ -87,9 +89,11 @@ pub struct GrpcServerBuilder {
     routes_builder: RoutesBuilder,
     tls_config: Option<ServerTlsConfig>,
     otel_arrow_service: Option<
-        InterceptedService<
-            ArrowMetricsServiceServer<OtelArrowServiceHandler<OpenTelemetryProtocolHandlerRef>>,
-            HeaderInterceptor,
+        MemoryLimiterExtensionService<
+            InterceptedService<
+                ArrowMetricsServiceServer<OtelArrowServiceHandler<OpenTelemetryProtocolHandlerRef>>,
+                HeaderInterceptor,
+            >,
         >,
     >,
     memory_limiter: ServerMemoryLimiter,
@@ -185,6 +189,13 @@ impl GrpcServerBuilder {
             .accept_compressed(CompressionEncoding::Zstd)
             .send_compressed(CompressionEncoding::Zstd);
         let svc = InterceptedService::new(server, HeaderInterceptor {});
+        // Same pre-decode memory admission as `add_service!`.
+        let svc = ServiceBuilder::new()
+            .layer(MemoryLimiterExtensionLayer::new(
+                self.memory_limiter.clone(),
+                self.config.max_recv_message_size,
+            ))
+            .service(svc);
         self.otel_arrow_service = Some(svc);
         self
     }
```

**File**: `src/servers/src/grpc/database.rs` (modified, +31/-2)
```diff
@@ -25,6 +25,7 @@ use session::context::Channel;
 use tonic::{Request, Response, Status, Streaming};
 
 use crate::grpc::greptime_handler::GreptimeRequestHandler;
+use crate::grpc::memory_limit::PreDecodeMemoryReservation;
 use crate::grpc::{TonicResult, cancellation};
 use crate::hint_headers;
 use crate::request_memory_limiter::ServerMemoryLimiter;
@@ -57,7 +58,20 @@ impl GreptimeDatabase for DatabaseService {
             remote_addr, hints
         );
 
-        let _guard = if let Some(limiter) = request.extensions().get::<ServerMemoryLimiter>() {
+        // Retain the pre-decode reservation for the whole request: the
+        // extension holding the guard would be dropped when the request is
+        // consumed below, but the post-decode charge is skipped while it is
+        // active.
+        let _pre_reservation = request
+            .extensions()
+            .get::<PreDecodeMemoryReservation>()
+            .cloned();
+        let _guard = if _pre_reservation.is_some() {
+            // Compressed requests already reserved the worst-case decoded
+            // size before tonic decompressed the message; skip the exact
+            // post-decode charge to avoid double accounting.
+            None
+        } else if let Some(limiter) = request.extensions().get::<ServerMemoryLimiter>() {
             let message_size = request.get_ref().encoded_len() as u64;
             Some(limiter.acquire(message_size).await?)
         } else {
@@ -117,16 +131,31 @@ impl GreptimeDatabase for DatabaseService {
         );
 
         let limiter = request.extensions().get::<ServerMemoryLimiter>().cloned();
+        // For compressed streams the whole stream's decoding memory was
+        // reserved before tonic started decompressing; messages are decoded
+        // one at a time, so the reservation covers each of them. The
+        // reservation is retained below for the whole stream: the extension
+        // holding the guard would otherwise be dropped when the request is
+        // consumed, while per-message charges stay skipped.
+        let reservation = request
+            .extensions()
+            .get::<PreDecodeMemoryReservation>()
+            .cloned();
+        let pre_reserved = reservation.is_some();
 
         let handler = self.handler.clone();
         let request_future = async move {
             let mut affected_rows = 0;
 
+            // Hold the pre-decode reservation until the stream is exhausted.
+            let _reservation = reservation;
             let mut stream = request.into_inner();
             while let Some(request) = stream.next().await {
                 let request = request?;
 
-                let _guard = if let Some(limiter_ref) = &limiter {
+                let _guard = if pre_reserved {
+                    None
+                } else if let Some(limiter_ref) = &limiter {
                     let message_size = request.encoded_len() as u64;
                     Some(limiter_ref.acquire(message_size).await?)
                 } else {
```

**File**: `src/servers/src/grpc/memory_limit.rs` (modified, +230/-10)
```diff
@@ -12,22 +12,69 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
+//! Aggregate memory admission for gRPC services.
+//!
+//! Tonic decompresses and decodes a complete request message (up to
+//! `max_recv_message_size`, 512 MiB by default) *before* the typed handler is
+//! invoked, so a handler that charges the [`ServerMemoryLimiter`] only sees
+//! the request after the memory is already allocated. For transport-compressed
+//! messages (`grpc-encoding: gzip/zstd`) a few KiB on the wire can expand to
+//! hundreds of MiB during that window, which would bypass any aggregate quota.
+//!
+//! [`MemoryLimiterExtensionLayer`] therefore reserves the configured maximum
+//! decoded message size for every compressed request *before* the inner
+//! (tonic) service runs, and holds the reservation for the whole request.
+//! Handlers can detect the reservation via [`PreDecodeMemoryReservation`] in
+//! the request extensions and skip their own post-decode charge to avoid
+//! double accounting.
+//!
+//! The reservation is intentionally conservative (it upper-bounds the decoded
+//! size before it is known); with the default unlimited limiter it is a no-op.
+
+use std::convert::Infallible;
+use std::sync::Arc;
 use std::task::{Context, Poll};
 
+use axum::response::IntoResponse;
+use common_memory_manager::MemoryGuard;
 use futures::future::BoxFuture;
+use http::Request;
+use tonic::Status;
+use tonic::codegen::Service;
 use tonic::server::NamedService;
-use tower::{Layer, Service};
+use tower::Layer;
 
 use crate::request_memory_limiter::ServerMemoryLimiter;
+use crate::request_memory_metrics::RequestMemoryMetrics;
+
+/// The gRPC request compression selector header.
+const GRPC_ENCODING_HEADER: &str = "grpc-encoding";
+/// The "no compression" encoding value.
+const IDENTITY_ENCODING: &str = "identity";
+
+/// Present in the request extensions when memory for the (compressed)
+/// request's decoded message was reserved before tonic decompression.
+///
+/// Handlers that charge the [`ServerMemoryLimiter`] after decoding should skip
+/// that charge when this marker is present: the reservation already covers the
+/// peak decoding memory and stays alive for the whole request.
+#[derive(Clone)]
+pub(crate) struct PreDecodeMemoryReservation {
+    _guard: Arc<MemoryGuard<RequestMemoryMetrics>>,
+}
 
 #[derive(Clone)]
 pub struct MemoryLimiterExtensionLayer {
     limiter: ServerMemoryLimiter,
+    max_decoding_message_size: usize,
 }
 
 impl MemoryLimiterExtensionLayer {
-    pub fn new(limiter: ServerMemoryLimiter) -> Self {
-        Self { limiter }
+    pub fn new(limiter: ServerMemoryLimiter, max_decoding_message_size: usize) -> Self {
+        Self {
+            limiter,
+            max_decoding_message_size,
+        }
     }
 }
 
@@ -38,6 +85,7 @@ impl<S> Layer<S> for MemoryLimiterExtensionLayer {
         MemoryLimiterExtensionService {
             inner: service,
             limiter: self.limiter.clone(),
+            max_decoding_message_size: self.max_decoding_message_size,
         }
     }
 }
@@ -46,27 +94,199 @@ impl<S> Layer<S> for MemoryLimiterExtensionLayer {
 pub struct MemoryLimiterExtensionService<S> {
     inner: S,
     limiter: ServerMemoryLimiter,
+    max_decoding_message_size: usize,
 }
 
 impl<S: NamedService> NamedService for MemoryLimiterExtensionService<S> {
     const NAME: &'static str = S::NAME;
 }
 
-impl<S, ReqBody> Service<http::Request<ReqBody>> for MemoryLimiterExtensionService<S>
+impl<S, ReqBody> Service<Request<ReqBody>> for MemoryLimiterExtensionService<S>
 where
-    S: Service<http::Request<ReqBody>>,
+    S: Service<Request<ReqBody>, Error = Infallible> + Clone + Send + 'static,
+    S::Response: axum::response::IntoResponse,
     S::Future: Send + 'static,
+    ReqBody: Send + 'static,
 {
-    type Response = S::Response;
-    type Error = S::Error;
+    type Response = axum::response::Response;
+    type Error = Infallible;
     type Future = BoxFuture<'static, Result<Self::Response, Self::Error>>;
 
     fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
         self.inner.poll_ready(cx)
     }
 
-    fn call(&mut self, mut req: http::Request<ReqBody>) -> Self::Future {
-        req.extensions_mut().insert(self.limiter.clone());
-        Box::pin(self.inner.call(req))
+    fn call(&mut self, mut req: Request<ReqBody>) -> Self::Future {
+        // Own a clone of the service so the returned future does not borrow
+        // `self` (tower's load-shedding pattern).
+        let mut this = self.clone();
+        Box::pin(async move {
+            req.extensions_mut().insert(this.limiter.clone());
+
+            let compressed = req
+                .headers()
+                .get(GRPC_ENCODING_HEADER)
+                .and_then(|value| value.to_str().ok())
+                .is_some_and(|value| !value.eq_ignore_ascii_case(IDENTITY_ENCODING));
+
+            if compressed {
+
```

**File**: `src/servers/src/http.rs` (modified, +65/-16)
```diff
@@ -716,7 +716,7 @@ impl HttpServerBuilder {
         Self {
             router: self.router.nest(
                 &format!("/{HTTP_API_VERSION}/influxdb"),
-                HttpServer::route_influxdb(handler),
+                HttpServer::route_influxdb(handler, self.memory_limiter.clone()),
             ),
             ..self
         }
@@ -736,6 +736,7 @@ impl HttpServerBuilder {
             prom_store_with_metric_engine,
             prom_validation_mode,
             pending_rows_batcher,
+            memory_limiter: self.memory_limiter.clone(),
         };
 
         Self {
@@ -765,7 +766,7 @@ impl HttpServerBuilder {
         Self {
             router: self.router.nest(
                 &format!("/{HTTP_API_VERSION}/otlp"),
-                HttpServer::route_otlp(handler, with_metric_engine),
+                HttpServer::route_otlp(handler, with_metric_engine, self.memory_limiter.clone()),
             ),
             ..self
         }
@@ -799,23 +800,23 @@ impl HttpServerBuilder {
 
         let router = self.router.nest(
             &format!("/{HTTP_API_VERSION}"),
-            HttpServer::route_pipelines(log_state.clone()),
+            HttpServer::route_pipelines(log_state.clone(), self.memory_limiter.clone()),
         );
         // deprecated since v0.11.0. Use `/logs` and `/pipelines` instead.
         let router = router.nest(
             &format!("/{HTTP_API_VERSION}/events"),
             #[allow(deprecated)]
-            HttpServer::route_log_deprecated(log_state.clone()),
+            HttpServer::route_log_deprecated(log_state.clone(), self.memory_limiter.clone()),
         );
 
         let router = router.nest(
             &format!("/{HTTP_API_VERSION}/loki"),
-            HttpServer::route_loki(log_state.clone()),
+            HttpServer::route_loki(log_state.clone(), self.memory_limiter.clone()),
         );
 
         let router = router.nest(
             &format!("/{HTTP_API_VERSION}/elasticsearch"),
-            HttpServer::route_elasticsearch(log_state.clone()),
+            HttpServer::route_elasticsearch(log_state.clone(), self.memory_limiter.clone()),
         );
 
         let router = router.nest(
@@ -827,7 +828,7 @@ impl HttpServerBuilder {
 
         let router = router.nest(
             &format!("/{HTTP_API_VERSION}/splunk"),
-            HttpServer::route_splunk(log_state),
+            HttpServer::route_splunk(log_state, self.memory_limiter.clone()),
         );
 
         Self { router, ..self }
@@ -858,7 +859,7 @@ impl HttpServerBuilder {
         Self {
             router: self.router.nest(
                 &format!("/{HTTP_API_VERSION}/dashboards"),
-                HttpServer::route_dashboard(handler),
+                HttpServer::route_dashboard(handler, self.memory_limiter.clone()),
             ),
             ..self
         }
@@ -1184,9 +1185,13 @@ impl HttpServer {
             .with_state(metrics_handler)
     }
 
-    fn route_loki<S>(log_state: LogState) -> Router<S> {
+    fn route_loki<S>(log_state: LogState, memory_limiter: ServerMemoryLimiter) -> Router<S> {
         Router::new()
             .route("/api/v1/push", routing::post(loki::loki_ingest))
+            .layer(middleware::from_fn_with_state(
+                memory_limiter,
+                memory_limit::decoded_body_accounting_middleware,
+            ))
             .layer(
                 ServiceBuilder::new()
                     .layer(RequestDecompressionLayer::new().pass_through_unaccepted(true)),
@@ -1198,7 +1203,7 @@ impl HttpServer {
             .with_state(log_state)
     }
 
-    fn route_splunk<S>(log_state: LogState) -> Router<S> {
+    fn route_splunk<S>(log_state: LogState, memory_limiter: ServerMemoryLimiter) -> Router<S> {
         Router::new()
             .route(
                 "/services/collector/health",
@@ -1226,6 +1231,10 @@ impl HttpServer {
                 "/services/collector/raw/1.0",
                 routing::post(splunk::handle_raw),
             )
+            .layer(middleware::from_fn_with_state(
+                memory_limiter,
+                memory_limit::decoded_body_accounting_middleware,
+            ))
             .layer(
                 ServiceBuilder::new()
                     .layer(RequestDecompressionLayer::new().pass_through_unaccepted(true)),
@@ -1237,7 +1246,10 @@ impl HttpServer {
             .with_state(log_state)
     }
 
-    fn route_elasticsearch<S>(log_state: LogState) -> Router<S> {
+    fn route_elasticsearch<S>(
+        log_state: LogState,
+        memory_limiter: ServerMemoryLimiter,
+    ) -> Router<S> {
         Router::new()
             // Return fake responsefor HEAD '/' request.
             .route(
@@ -1309,6 +1321,10 @@ impl HttpServer {
                     axum::Json(serde_json::json!({})),
                 )),
             )
+            .layer(middleware::from_fn_with_state(
+                memory_limiter,
+                memory_limit::decoded_body_accounting_middleware,
+            ))
           
```

---

### Incident Patch 7: `218000e2` (2026-09-29)
**Commit Message**: fix(promql): resolve dotted column names as unqualified columns (#9391)

* fix(promql): resolve dotted column names as unqualified columns

col(), From<&str>/From<String> for Column and string join keys go through
Column::from_qualified_name, which splits `service.name` into relation
`service` and column `name` and lowercases unquoted identifiers. Build
PromQL column references with Column::from_name / ident() instead.

Signed-off-by: Dennis Zhuang <[REDACTED_EMAIL]>

* fix(servers): resolve remote read matcher labels as unqualified columns

Signed-off-by: Dennis Zhuang <[REDACTED_EMAIL]>

* test(promql): cover same-name columns differing in case and without()

Signed-off-by: Dennis Zhuang <[REDACTED_EMAIL]>

---------

Signed-off-by: Dennis Zhuang <[REDACTED_EMAIL]>

**File**: `src/promql/src/extension_plan/absent.rs` (modified, +2/-2)
```diff
@@ -34,7 +34,7 @@ use datafusion::physical_plan::{
     Partitioning, PhysicalExpr, PlanProperties, RecordBatchStream, SendableRecordBatchStream,
 };
 use datafusion_common::DFSchema;
-use datafusion_expr::{EmptyRelation, col};
+use datafusion_expr::{EmptyRelation, ident};
 use datatypes::arrow;
 use datatypes::arrow::array::{ArrayRef, Float64Array, TimestampMillisecondArray};
 use datatypes::arrow::datatypes::{DataType, Field, SchemaRef, TimeUnit};
@@ -108,7 +108,7 @@ impl UserDefinedLogicalNodeCore for Absent {
             return vec![];
         }
 
-        vec![col(&self.time_index_column)]
+        vec![ident(&self.time_index_column)]
     }
 
     fn necessary_children_exprs(&self, _output_columns: &[usize]) -> Option<Vec<Vec<usize>>> {
```

**File**: `src/promql/src/extension_plan/empty_metric.rs` (modified, +2/-2)
```diff
@@ -40,7 +40,7 @@ use datafusion::physical_plan::{
     SendableRecordBatchStream, StatisticsArgs,
 };
 use datafusion::physical_planner::PhysicalPlanner;
-use datafusion::prelude::{Expr, col, lit};
+use datafusion::prelude::{Expr, ident, lit};
 use datafusion_expr::LogicalPlanBuilder;
 use datatypes::arrow::array::TimestampMillisecondArray;
 use datatypes::arrow::datatypes::SchemaRef;
@@ -409,7 +409,7 @@ fn build_ts_only_schema(column_name: &str) -> DFSchema {
 pub fn build_special_time_expr(time_index_column_name: &str) -> Expr {
     let input_schema = build_ts_only_schema(time_index_column_name);
     // safety: should not failed (UT covers this)
-    col(time_index_column_name)
+    ident(time_index_column_name)
         .cast_to(&DataType::Int64, &input_schema)
         .unwrap()
         .cast_to(&DataType::Float64, &input_schema)
```

**File**: `src/promql/src/extension_plan/histogram_fold.rs` (modified, +5/-5)
```diff
@@ -41,7 +41,7 @@ use datafusion::physical_plan::{
     SendableRecordBatchStream, StatisticsArgs,
 };
 use datafusion::prelude::{Column, Expr};
-use datafusion_expr::{EmptyRelation, col};
+use datafusion_expr::{EmptyRelation, ident};
 use datatypes::arrow_array::string_array_value_at_index;
 use datatypes::prelude::{ConcreteDataType, DataType as GtDataType};
 use datatypes::value::{OrderedF64, Value, ValueRef};
@@ -141,14 +141,14 @@ impl UserDefinedLogicalNodeCore for HistogramFold {
         }
 
         let mut exprs = vec![
-            col(&self.le_column),
-            col(&self.ts_column),
-            col(&self.field_column),
+            ident(&self.le_column),
+            ident(&self.ts_column),
+            ident(&self.field_column),
         ];
         exprs.extend(self.input.schema().fields().iter().filter_map(|f| {
             let name = f.name();
             if name != &self.le_column && name != &self.ts_column && name != &self.field_column {
-                Some(col(name))
+                Some(ident(name))
             } else {
                 None
             }
```

**File**: `src/promql/src/extension_plan/instant_manipulate.rs` (modified, +3/-3)
```diff
@@ -37,7 +37,7 @@ use datafusion::physical_plan::{
     PhysicalExpr, PlanProperties, RecordBatchStream, SendableRecordBatchStream, Statistics,
     StatisticsArgs,
 };
-use datafusion_expr::col;
+use datafusion_expr::ident;
 use datatypes::arrow::compute;
 use datatypes::timestamp::timestamp_array_to_primitive;
 use futures::{Stream, StreamExt, ready};
@@ -140,8 +140,8 @@ impl UserDefinedLogicalNodeCore for InstantManipulate {
             return vec![];
         }
 
-        let mut exprs = vec![col(&self.time_index_column)];
-        exprs.extend(self.staleness_field_columns().map(col));
+        let mut exprs = vec![ident(&self.time_index_column)];
+        exprs.extend(self.staleness_field_columns().map(ident));
         exprs
     }
 
```

**File**: `src/promql/src/extension_plan/normalize.rs` (modified, +3/-3)
```diff
@@ -33,7 +33,7 @@ use datafusion::physical_plan::{
     InputDistributionRequirements, PhysicalExpr, PlanProperties, RecordBatchStream,
     SendableRecordBatchStream, StatisticsArgs,
 };
-use datafusion_expr::col;
+use datafusion_expr::ident;
 use datatypes::arrow::array::TimestampMillisecondArray;
 use datatypes::arrow::datatypes::{SchemaRef, TimestampMillisecondType};
 use datatypes::arrow::record_batch::RecordBatch;
@@ -93,8 +93,8 @@ impl UserDefinedLogicalNodeCore for SeriesNormalize {
 
         self.tag_columns
             .iter()
-            .map(col)
-            .chain(std::iter::once(col(&self.time_index_column_name)))
+            .map(ident)
+            .chain(std::iter::once(ident(&self.time_index_column_name)))
             .collect()
     }
 
```

**File**: `src/promql/src/extension_plan/range_manipulate.rs` (modified, +3/-3)
```diff
@@ -38,7 +38,7 @@ use datafusion::physical_plan::{
     InputDistributionRequirements, PhysicalExpr, PlanProperties, RecordBatchStream,
     SendableRecordBatchStream, Statistics, StatisticsArgs,
 };
-use datafusion_expr::col;
+use datafusion_expr::ident;
 use datatypes::timestamp::timestamp_array_to_primitive;
 use futures::{Stream, StreamExt, ready};
 use greptime_proto::substrait_extension as pb;
@@ -318,8 +318,8 @@ impl UserDefinedLogicalNodeCore for RangeManipulate {
         }
 
         let mut exprs = Vec::with_capacity(1 + self.field_columns.len());
-        exprs.push(col(&self.time_index));
-        exprs.extend(self.field_columns.iter().map(col));
+        exprs.push(ident(&self.time_index));
+        exprs.extend(self.field_columns.iter().map(ident));
         exprs
     }
 
```

**File**: `src/promql/src/extension_plan/scalar_calculate.rs` (modified, +4/-4)
```diff
@@ -33,7 +33,7 @@ use datafusion::physical_plan::{
     SendableRecordBatchStream, StatisticsArgs,
 };
 use datafusion::prelude::Expr;
-use datafusion_expr::col;
+use datafusion_expr::ident;
 use datatypes::arrow::array::{Array, ArrayRef, Float64Array, TimestampMillisecondArray};
 use datatypes::arrow::compute::{CastOptions, cast_with_options, concat_batches};
 use datatypes::arrow::datatypes::{DataType, Field, Schema, SchemaRef, TimeUnit};
@@ -282,9 +282,9 @@ impl UserDefinedLogicalNodeCore for ScalarCalculate {
 
         self.tag_columns
             .iter()
-            .map(col)
-            .chain(std::iter::once(col(&self.time_index)))
-            .chain(std::iter::once(col(&self.field_column)))
+            .map(ident)
+            .chain(std::iter::once(ident(&self.time_index)))
+            .chain(std::iter::once(ident(&self.field_column)))
             .collect()
     }
 
```

**File**: `src/promql/src/extension_plan/series_divide.rs` (modified, +3/-3)
```diff
@@ -38,7 +38,7 @@ use datafusion::physical_plan::{
     DisplayAs, DisplayFormatType, Distribution, ExecutionPlan, InputDistributionRequirements,
     PhysicalExpr, PlanProperties, RecordBatchStream, SendableRecordBatchStream,
 };
-use datafusion_expr::col;
+use datafusion_expr::ident;
 use datatypes::arrow::compute;
 use datatypes::arrow_array::string_array_value_at_index;
 use datatypes::compute::SortOptions;
@@ -186,8 +186,8 @@ impl UserDefinedLogicalNodeCore for SeriesDivide {
 
         self.tag_columns
             .iter()
-            .map(col)
-            .chain(std::iter::once(col(&self.time_index_column)))
+            .map(ident)
+            .chain(std::iter::once(ident(&self.time_index_column)))
             .collect()
     }
 
```

---

### Incident Patch 8: `abf1396c` (2026-09-29)
**Commit Message**: fix(client): yield Flight batches and affected rows without waiting for next message (#8918)

* fix(client): avoid Flight metrics lookahead stalls

Signed-off-by: discord9 <[REDACTED_EMAIL]>

* refactor(client): extract trailing Flight metrics task

Signed-off-by: discord9 <[REDACTED_EMAIL]>

* test(client): synchronize trailing metrics and bound cancellation

Signed-off-by: discord9 <[REDACTED_EMAIL]>

---------

Signed-off-by: discord9 <[REDACTED_EMAIL]>

**File**: `src/client/src/database.rs` (modified, +303/-45)
```diff
@@ -16,7 +16,7 @@ use std::collections::HashMap;
 use std::pin::Pin;
 use std::str::FromStr;
 use std::sync::atomic::{AtomicBool, Ordering};
-use std::sync::{Arc, RwLock};
+use std::sync::{Arc, Mutex, RwLock};
 use std::task::{Context, Poll};
 use std::time::Duration;
 
@@ -55,6 +55,7 @@ use futures::future;
 use futures_util::{Stream, StreamExt, TryStreamExt};
 use prost::Message;
 use snafu::{IntoError, ResultExt};
+use tokio::sync::Notify;
 use tonic::metadata::{AsciiMetadataKey, AsciiMetadataValue, MetadataMap, MetadataValue};
 use tonic::transport::Channel;
 
@@ -70,20 +71,47 @@ type FlightDataStream = Pin<Box<dyn Stream<Item = FlightData> + Send>>;
 type DoPutResponseStream = Pin<Box<dyn Stream<Item = Result<DoPutResponse>>>>;
 
 const HINTS_METADATA_KEY: &str = "x-greptime-hints";
+/// Maximum time to wait for the optional trailing metrics message after
+/// affected rows have already been delivered.
+const FLIGHT_TRAILING_METRICS_TIMEOUT: Duration = Duration::from_secs(5);
 
 /// Terminal metrics associated with a query output.
 ///
 /// For streaming outputs, metrics are only final after the stream is fully
-/// drained and [`Self::is_ready`] returns `true`.
+/// drained and [`Self::is_ready`] returns `true`. Affected-row outputs may
+/// briefly await a compatibility trailing metrics message.
 #[derive(Debug, Clone, Default)]
 pub struct OutputMetrics {
     inner: Arc<OutputMetricsInner>,
 }
 
-#[derive(Debug, Default)]
+#[derive(Debug)]
 struct OutputMetricsInner {
     metrics: RwLock<Option<RecordBatchMetrics>>,
+    completion_error: RwLock<Option<String>>,
     ready: AtomicBool,
+    ready_notify: Notify,
+    compatibility_task: Mutex<Option<tokio::task::AbortHandle>>,
+}
+
+impl Default for OutputMetricsInner {
+    fn default() -> Self {
+        Self {
+            metrics: RwLock::new(None),
+            completion_error: RwLock::new(None),
+            ready: AtomicBool::new(false),
+            ready_notify: Notify::new(),
+            compatibility_task: Mutex::new(None),
+        }
+    }
+}
+
+impl Drop for OutputMetricsInner {
+    fn drop(&mut self) {
+        if let Some(handle) = self.compatibility_task.get_mut().unwrap().take() {
+            handle.abort();
+        }
+    }
 }
 
 impl OutputMetrics {
@@ -98,10 +126,45 @@ impl OutputMetrics {
 
     /// Marks the terminal metrics as final for this output.
     pub fn mark_ready(&self) {
-        let _ = self
+        if self
             .inner
             .ready
-            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire);
+            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
+            .is_ok()
+        {
+            self.inner.ready_notify.notify_waiters();
+        }
+    }
+
+    /// Waits until terminal metrics are final.
+    pub async fn wait_ready(&self) {
+        loop {
+            let notified = self.inner.ready_notify.notified();
+            if self.is_ready() {
+                return;
+            }
+            notified.await;
+        }
+    }
+
+    /// Returns an error encountered while completing the output, if any.
+    pub fn completion_error(&self) -> Option<String> {
+        self.inner.completion_error.read().unwrap().clone()
+    }
+
+    fn set_completion_error(&self, error: impl Into<String>) {
+        *self.inner.completion_error.write().unwrap() = Some(error.into());
+    }
+
+    fn set_compatibility_task(&self, handle: tokio::task::AbortHandle) {
+        let mut task = self.inner.compatibility_task.lock().unwrap();
+        if !self.is_ready() {
+            *task = Some(handle);
+        }
+    }
+
+    fn take_compatibility_task(&self) -> Option<tokio::task::AbortHandle> {
+        self.inner.compatibility_task.lock().unwrap().take()
     }
 
     /// Returns whether terminal metrics are final.
@@ -148,7 +211,8 @@ impl OutputMetrics {
 ///
 /// The contained [`OutputMetrics`] lets callers read stream terminal metrics
 /// after consuming `output`. For non-stream outputs, metrics are ready
-/// immediately.
+/// immediately. Flight affected-row outputs without inline metrics require
+/// [`OutputMetrics::wait_ready`] before compatibility trailing metrics can be read.
 #[derive(Debug)]
 pub struct OutputWithMetrics {
     pub output: Output,
@@ -194,6 +258,55 @@ fn parse_terminal_metrics(metrics_json: &str) -> Result<RecordBatchMetrics> {
     })
 }
 
+fn spawn_affected_rows_trailing_metrics_task<S>(
+    terminal_metrics: &OutputMetrics,
+    mut reader: FlightMessageReader<S>,
+) where
+    S: Stream<Item = Result<FlightMessage>> + Send + Unpin + 'static,
+{
+    let metrics_ref = Arc::downgrade(&terminal_metrics.inner);
+    let remote_addr = reader.remote_addr().to_string();
+    let task = common_runtime::spawn_global(async move {
+        let result =
+            tokio::time::timeout(FLIGHT_TRAILING_METRICS_TIMEOUT, reader.read_next()).await;
+        let Some(inner) = metrics_ref.upgrade() else {
+            return;
+        };
+ 
```

**File**: `src/client/src/flight.rs` (modified, +2/-39)
```diff
@@ -12,40 +12,18 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
-use std::pin::Pin;
-
 use arrow_flight::FlightData;
 use common_grpc::flight::{FlightDecoder, FlightMessage};
-use futures_util::stream::Peekable;
 use futures_util::{Stream, StreamExt};
 use snafu::{OptionExt, ResultExt};
 
 use crate::Result;
 use crate::error::{ConvertFlightDataSnafu, Error, IllegalFlightMessagesSnafu};
 
-#[derive(Debug, Clone, Copy, PartialEq, Eq)]
-pub(crate) enum FlightMessageKind {
-    Schema,
-    RecordBatch,
-    AffectedRows,
-    Metrics,
-}
-
-impl From<&FlightMessage> for FlightMessageKind {
-    fn from(message: &FlightMessage) -> Self {
-        match message {
-            FlightMessage::Schema(_) => Self::Schema,
-            FlightMessage::RecordBatch(_) => Self::RecordBatch,
-            FlightMessage::AffectedRows { .. } => Self::AffectedRows,
-            FlightMessage::Metrics(_) => Self::Metrics,
-        }
-    }
-}
-
 pub(crate) struct FlightMessageReader<S: Stream + Unpin> {
     /// Remote Flight peer associated with this response stream.
     remote_addr: String,
-    messages: Peekable<S>,
+    messages: S,
 }
 
 impl<S> FlightMessageReader<S>
@@ -55,7 +33,7 @@ where
     pub(crate) fn new(remote_addr: impl Into<String>, messages: S) -> Self {
         Self {
             remote_addr: remote_addr.into(),
-            messages: messages.peekable(),
+            messages,
         }
     }
 
@@ -72,21 +50,6 @@ where
     pub(crate) async fn read_next(&mut self) -> Result<Option<FlightMessage>> {
         self.messages.next().await.transpose()
     }
-
-    pub(crate) async fn peek_next_message_kind(&mut self) -> Result<Option<FlightMessageKind>> {
-        match Pin::new(&mut self.messages).peek().await {
-            Some(Ok(message)) => Ok(Some(message.into())),
-            None => Ok(None),
-            Some(Err(_)) => match self.read_next().await {
-                // `peek` only borrows the error; consume it to preserve the source error.
-                Err(error) => Err(error),
-                Ok(_) => IllegalFlightMessagesSnafu {
-                    reason: "Flight stream changed after peek".to_string(),
-                }
-                .fail(),
-            },
-        }
-    }
 }
 
 pub(crate) fn decode_flight_data(
```

**File**: `src/client/src/region.rs` (modified, +50/-61)
```diff
@@ -48,7 +48,7 @@ use crate::error::{
     self, FlightGetSnafu, IllegalDatabaseResponseSnafu, IllegalFlightMessagesSnafu,
     MissingFieldSnafu, Result, ServerSnafu,
 };
-use crate::flight::{FlightMessageKind, FlightMessageReader, decode_flight_data};
+use crate::flight::{FlightMessageReader, decode_flight_data};
 use crate::{Client, metrics};
 
 const FLIGHT_DO_GET_TIMEOUT: Duration = Duration::from_secs(10);
@@ -247,9 +247,7 @@ where
             "poll_flight_data_stream"
         ));
 
-        let mut stream_ended = false;
-
-        while !stream_ended {
+        loop {
             let flight_message = match reader.read_next().await {
                 Ok(Some(message)) => message,
                 Ok(None) => break,
@@ -262,59 +260,27 @@ where
 
             match flight_message {
                 FlightMessage::RecordBatch(record_batch) => {
-                    let result_to_yield =
-                        RecordBatch::from_df_record_batch(schema_cloned.clone(), record_batch);
-
-                    // Metrics follow a batch so MergeScan can observe them before yielding it.
-                    match reader.peek_next_message_kind().await {
-                        Ok(Some(FlightMessageKind::Metrics)) => {
-                            let metrics_message = match reader.read_next().await {
-                                Ok(Some(FlightMessage::Metrics(metrics))) => metrics,
-                                Ok(Some(_) | None) => {
-                                    yield IllegalFlightMessagesSnafu {
-                                        reason: "Flight stream changed after peek",
-                                    }
-                                    .fail()
-                                    .map_err(BoxedError::new)
-                                    .context(ExternalSnafu);
-                                    break;
-                                }
-                                Err(error) => {
-                                    yield Err(BoxedError::new(flight_stream_error(
-                                        &stream_addr,
-                                        error,
-                                    )))
-                                    .context(ExternalSnafu);
-                                    break;
-                                }
-                            };
-                            let metrics = serde_json::from_str(&metrics_message).ok().map(Arc::new);
-                            metrics_ref.swap(metrics);
-                        }
-                        Ok(Some(FlightMessageKind::RecordBatch)) => {}
-                        Ok(Some(FlightMessageKind::Schema | FlightMessageKind::AffectedRows)) => {
-                            yield IllegalFlightMessagesSnafu {
-                                reason: "A RecordBatch message can only be succeeded by a Metrics message or another RecordBatch message"
-                            }
-                            .fail()
-                            .map_err(BoxedError::new)
-                            .context(ExternalSnafu);
-                            break;
+                    // Deliver each batch immediately. In particular, do not
+                    // wait for a possible following Metrics message; it is
+                    // consumed on the next poll of this stream.
+                    yield Ok(RecordBatch::from_df_record_batch(
+                        schema_cloned.clone(),
+                        record_batch,
+                    ));
+                }
+                FlightMessage::Metrics(s) => {
+                    // Metrics may arrive before the next RecordBatch.
+                    match serde_json::from_str(&s) {
+                        Ok(metrics) => {
+                            metrics_ref.swap(Some(Arc::new(metrics)));
                         }
-                        Ok(None) => stream_ended = true,
                         Err(error) => {
-                            yield Err(BoxedError::new(flight_stream_error(&stream_addr, error)))
-                                .context(ExternalSnafu);
-                            break;
+                            common_telemetry::warn!(
+                                "Failed to decode region Flight metrics: {}",
+                                error
+                            );
                         }
                     }
-
-                    yield Ok(result_to_yield);
-                }
-                FlightMessage::Metrics(s) => {
-                    // Metrics may arrive before the next RecordBatch.
-                    let m = serde_json::from_str(&s).ok().map(Arc::new);
-                    metrics_ref.swap(m);
                     continue;
                 }
                 _ => {
@@ -719,7 +685,34 @@ mod test {
     }
 
     #[tokio::test]
-    async fn test_record_batch_stream_updates_following_metrics_before_yielding_batch() {
+    async fn test_record_batch_is_yielded_without_waiting_f
```

**File**: `src/flow/src/batching_mode/task.rs` (modified, +6/-0)
```diff
@@ -1400,6 +1400,12 @@ impl BatchingTask {
         match res {
             Ok(res) => {
                 let (affected_rows, _) = res.output.extract_rows_and_cost();
+                if matches!(&res.output.data, common_query::OutputData::AffectedRows(_)) {
+                    res.metrics.wait_ready().await;
+                }
+                if let Some(error) = res.metrics.completion_error() {
+                    warn!("Flow {flow_id} completed with terminal metrics error: {error}");
+                }
                 debug!(
                     "Flow {flow_id} executed, affected_rows: {affected_rows:?}, elapsed: {:?}, watermark: {:?}",
                     elapsed,
```

**File**: `tests-integration/src/grpc/flight.rs` (modified, +2/-1)
```diff
@@ -990,7 +990,7 @@ mod test {
             panic!("expected affected rows output");
         };
         assert_eq!(affected_rows, 9);
-        assert!(result.metrics.is_ready());
+        result.metrics.wait_ready().await;
         assert!(result.region_watermark_map().is_none());
 
         let err = client
@@ -1016,6 +1016,7 @@ mod test {
             panic!("expected affected rows output");
         };
         assert_eq!(affected_rows, 9);
+        result.metrics.wait_ready().await;
         assert_eq!(
             result.region_watermark_map(),
             Some(std::collections::HashMap::from([previous_watermark]))
```

---

### Incident Patch 9: `d6474b96` (2026-09-29)
**Commit Message**: fix(promql): apply offset to subquery evaluation window (#9364)

* fix(promql): apply offset to subquery evaluation window

`prom_subquery_expr_to_plan` destructured `SubqueryExpr` without reading
`offset`, so `<subquery>[range:step] offset <d>` planned exactly the same
window as the un-offset form and silently returned data for the wrong time
range. The plain vector/matrix-selector paths already threaded the offset
through `selector_to_series_normalize_plan` and `RangeManipulate`.

Shift the inner evaluation window back by the offset and pass the offset to
the subquery's `RangeManipulate`, which maps the inner samples forward onto
the evaluation timeline before bucketing them into ranges. This matches
Prometheus, whose `evaluator.subqueryTimeRange` evaluates the inner
expression over `(start - offset - range, end - offset]` and whose
`evalSubquery` then hands the samples to the outer range-vector function as
a `MatrixSelector` that still carries the subquery offset. An offset on the
inner selector composes additively, as `subqueryTimes` documents.

`RangeManipulate`'s protobuf message has no offset field and recovers it on
decode from an immediately underlying `SeriesNormalize`. S

**File**: `src/query/src/promql/planner.rs` (modified, +39/-7)
```diff
@@ -403,18 +403,34 @@ impl PromPlanner {
         subquery_expr: &SubqueryExpr,
     ) -> Result<LogicalPlan> {
         let SubqueryExpr {
-            expr, range, step, ..
+            expr,
+            range,
+            step,
+            offset,
+            ..
         } = subquery_expr;
 
+        // Prometheus evaluates the inner expression over `(start - offset - range, end - offset]`
+        // (`subqueryTimeRange`). Shift the inner window back here; `RangeManipulate` maps the
+        // samples forward again by the same offset.
+        let offset_ms = match offset {
+            Some(Offset::Pos(duration)) => duration.as_millis() as Millisecond,
+            Some(Offset::Neg(duration)) => -(duration.as_millis() as Millisecond),
+            None => 0,
+        };
+
         let current_interval = self.ctx.interval;
         if let Some(step) = step {
             self.ctx.interval = step.as_millis() as _;
         }
         let current_start = self.ctx.start;
-        self.ctx.start -= range.as_millis() as i64 - self.ctx.interval;
+        let current_end = self.ctx.end;
+        self.ctx.start -= offset_ms + range.as_millis() as i64 - self.ctx.interval;
+        self.ctx.end -= offset_ms;
         let input = self.prom_expr_to_plan(expr, query_engine_state).await?;
         self.ctx.interval = current_interval;
         self.ctx.start = current_start;
+        self.ctx.end = current_end;
 
         ensure!(!range.is_zero(), ZeroRangeSelectorSnafu);
         let range_ms = range.as_millis() as _;
@@ -471,26 +487,42 @@ impl PromPlanner {
             .context(DataFusionPlanningSnafu)?;
         let divide_plan = LogicalPlan::Extension(Extension {
             node: Arc::new(SeriesDivide::new(
-                series_key_columns,
+                series_key_columns.clone(),
                 time_index_column.clone(),
                 sort_plan,
             )),
         });
 
+        // `RangeManipulate` has no offset in its protobuf message; decoding recovers it from the
+        // `SeriesNormalize` directly below. Stale markers are not filtered: the input is computed.
+        let divide_plan = if offset_ms != 0 {
+            LogicalPlan::Extension(Extension {
+                node: Arc::new(SeriesNormalize::new(
+                    offset_ms,
+                    time_index_column.clone(),
+                    false,
+                    series_key_columns,
+                    divide_plan,
+                )),
+            })
+        } else {
+            divide_plan
+        };
+
         let manipulate = RangeManipulate::new(
             self.ctx.start,
             self.ctx.end,
             self.ctx.interval,
-            0,
+            offset_ms,
             range_ms,
             time_index_column,
             self.ctx.field_columns.clone(),
             divide_plan,
         )
         .context(DataFusionPlanningSnafu)?;
-        // A subquery always folds with offset 0, so its payload timestamps are already on the
-        // evaluation timeline a function above it reads; see [`Self::create_range_eval_ts_expr`].
-        self.ctx.range_fold_offset = Some(0);
+        // The payload timestamps are shifted by the subquery offset; see
+        // [`Self::create_range_eval_ts_expr`].
+        self.ctx.range_fold_offset = Some(offset_ms);
 
         Ok(LogicalPlan::Extension(Extension {
             node: Arc::new(manipulate),
```

**File**: `src/query/src/promql/planner/test.rs` (modified, +22/-0)
```diff
@@ -5109,6 +5109,28 @@ async fn count_over_time_subquery() {
     indie_query_plan_compare(query, expected).await;
 }
 
+/// `offset` on a subquery must shift the inner evaluation window back and be
+/// carried into the outer range manipulation. See
+/// <https://github.com/GreptimeTeam/greptimedb/issues/9330>.
+#[tokio::test]
+async fn count_over_time_subquery_with_offset() {
+    let query = "count_over_time(some_metric[10m:1m] offset 5m)";
+    let expected = String::from(
+        "Filter: prom_count_over_time(timestamp_range,field_0) IS NOT NULL [timestamp:Timestamp(ms), prom_count_over_time(timestamp_range,field_0):Float64;N, tag_0:Utf8]\
+        \n  Projection: some_metric.timestamp, prom_count_over_time(timestamp_range, field_0) AS prom_count_over_time(timestamp_range,field_0), some_metric.tag_0 [timestamp:Timestamp(ms), prom_count_over_time(timestamp_range,field_0):Float64;N, tag_0:Utf8]\
+        \n    PromRangeManipulate: req range=[0..100000000], interval=[5000], eval range=[600000], time index=[timestamp], values=[\"field_0\"] [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Dictionary(Int64, Float64);N, timestamp_range:Dictionary(Int64, Timestamp(ms))]\
+        \n      PromSeriesNormalize: offset=[300000], time index=[timestamp], filter NaN: [false] [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]\
+        \n        PromSeriesDivide: tags=[\"tag_0\"] [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]\
+        \n          Sort: some_metric.tag_0 ASC NULLS FIRST, some_metric.timestamp ASC NULLS FIRST [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]\
+        \n            PromInstantManipulate: range=[-840000..99700000], lookback=[1000], interval=[60000], time index=[timestamp] [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]\
+        \n              PromSeriesDivide: tags=[\"tag_0\"] [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]\
+        \n                Sort: some_metric.tag_0 ASC NULLS FIRST, some_metric.timestamp ASC NULLS FIRST [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]\
+        \n                  Filter: some_metric.timestamp >= TimestampMillisecond(-840999, None) AND some_metric.timestamp <= TimestampMillisecond(99700000, None) [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]\
+        \n                    TableScan: some_metric [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]",
+    );
+    indie_query_plan_compare(query, expected).await;
+}
+
 #[tokio::test]
 async fn test_hash_join() {
     let mut eval_stmt = EvalStmt {
```

**File**: `tests/cases/standalone/common/promql/subquery.result` (modified, +100/-0)
```diff
@@ -63,3 +63,103 @@ drop table metric_total;
 
 Affected Rows: 0
 
+-- Offset on a subquery shifts the subquery's own evaluation window back by the offset.
+-- Reference: Prometheus `evaluator.subqueryTimeRange` (promql/engine.go).
+-- The offset cases stay on the subquery step grid so they match Prometheus directly.
+create table subquery_offset_total (
+    ts timestamp time index,
+    host string primary key,
+    val double,
+);
+
+Affected Rows: 0
+
+insert into subquery_offset_total values
+    (0, 'a', 1),
+    (10000, 'a', 2),
+    (20000, 'a', 3),
+    (30000, 'a', 4),
+    (40000, 'a', 5),
+    (50000, 'a', 6),
+    (60000, 'a', 7);
+
+Affected Rows: 7
+
+-- baseline: no offset at t=60 covers the 10s subquery points in (40s, 60s] -> 6 + 7
+tql eval (60, 60, '1s') sum_over_time(subquery_offset_total[20s:10s]);
+
++---------------------+----------------------------------+------+
+| ts                  | prom_sum_over_time(ts_range,val) | host |
++---------------------+----------------------------------+------+
+| 1970-01-01T00:01:00 | 13.0                             | a    |
++---------------------+----------------------------------+------+
+
+-- the same subquery evaluated at t=30 -> 3 + 4
+tql eval (30, 30, '1s') sum_over_time(subquery_offset_total[20s:10s]);
+
++---------------------+----------------------------------+------+
+| ts                  | prom_sum_over_time(ts_range,val) | host |
++---------------------+----------------------------------+------+
+| 1970-01-01T00:00:30 | 7.0                              | a    |
++---------------------+----------------------------------+------+
+
+-- `offset 30s` at t=60 must equal the un-offset subquery at t=30
+tql eval (60, 60, '1s') sum_over_time(subquery_offset_total[20s:10s] offset 30s);
+
++---------------------+----------------------------------+------+
+| ts                  | prom_sum_over_time(ts_range,val) | host |
++---------------------+----------------------------------+------+
+| 1970-01-01T00:01:00 | 7.0                              | a    |
++---------------------+----------------------------------+------+
+
+-- a negative offset looks ahead of the evaluation time
+tql eval (30, 30, '1s') sum_over_time(subquery_offset_total[20s:10s] offset -30s);
+
++---------------------+----------------------------------+------+
+| ts                  | prom_sum_over_time(ts_range,val) | host |
++---------------------+----------------------------------+------+
+| 1970-01-01T00:00:30 | 13.0                             | a    |
++---------------------+----------------------------------+------+
+
+-- an offset on the inner selector composes additively with the subquery offset: Prometheus
+-- `subqueryTimes` accumulates "the sum of offsets and ranges of all subqueries in the path",
+-- and the inner selector subtracts its own offset from the already shifted step timestamps.
+-- 20s + 10s therefore behaves like the un-offset subquery at t=30.
+tql eval (60, 60, '1s') sum_over_time((subquery_offset_total offset 10s)[20s:10s] offset 20s);
+
++---------------------+----------------------------------+------+
+| ts                  | prom_sum_over_time(ts_range,val) | host |
++---------------------+----------------------------------+------+
+| 1970-01-01T00:01:00 | 7.0                              | a    |
++---------------------+----------------------------------+------+
+
+-- ... and the inner offset alone accounts for the same total shift
+tql eval (60, 60, '1s') sum_over_time((subquery_offset_total offset 30s)[20s:10s]);
+
++---------------------+----------------------------------+------+
+| ts                  | prom_sum_over_time(ts_range,val) | host |
++---------------------+----------------------------------+------+
+| 1970-01-01T00:01:00 | 7.0                              | a    |
++---------------------+----------------------------------+------+
+
+-- `predict_linear` predicts from the evaluation time: 4 + 0.1 * 30 = 7 and 7 - 0.1 * 30 = 4
+tql eval (60, 60, '1s') predict_linear(subquery_offset_total[20s:10s] offset 30s, 0);
+
++---------------------+----------------------------------------------+------+
+| ts                  | prom_predict_linear(ts_range,val,Float64(0)) | host |
++---------------------+----------------------------------------------+------+
+| 1970-01-01T00:01:00 | 7.0                                          | a    |
++---------------------+----------------------------------------------+------+
+
+tql eval (30, 30, '1s') predict_linear(subquery_offset_total[20s:10s] offset -30s, 0);
+
++---------------------+----------------------------------------------+------+
+| ts                  | prom_predict_linear(ts_range,val,Float64(0)) | host |
++---------------------+----------------------------------------------+------+
+| 1970-01-01T00:00:30 | 4.0                                          | a    |
++---------------------+----------------------------------------------+------+
+
+drop table subquery_offset_total;
+
+Affected Rows: 0
```

**File**: `tests/cases/standalone/common/promql/subquery.sql` (modified, +46/-0)
```diff
@@ -20,3 +20,49 @@ tql eval (10, 10, '1s') rate(metric_total[20s:10s]);
 tql eval (20, 20, '1s') rate(metric_total[20s:5s]);
 
 drop table metric_total;
+
+-- Offset on a subquery shifts the subquery's own evaluation window back by the offset.
+-- Reference: Prometheus `evaluator.subqueryTimeRange` (promql/engine.go).
+-- The offset cases stay on the subquery step grid so they match Prometheus directly.
+create table subquery_offset_total (
+    ts timestamp time index,
+    host string primary key,
+    val double,
+);
+
+insert into subquery_offset_total values
+    (0, 'a', 1),
+    (10000, 'a', 2),
+    (20000, 'a', 3),
+    (30000, 'a', 4),
+    (40000, 'a', 5),
+    (50000, 'a', 6),
+    (60000, 'a', 7);
+
+-- baseline: no offset at t=60 covers the 10s subquery points in (40s, 60s] -> 6 + 7
+tql eval (60, 60, '1s') sum_over_time(subquery_offset_total[20s:10s]);
+
+-- the same subquery evaluated at t=30 -> 3 + 4
+tql eval (30, 30, '1s') sum_over_time(subquery_offset_total[20s:10s]);
+
+-- `offset 30s` at t=60 must equal the un-offset subquery at t=30
+tql eval (60, 60, '1s') sum_over_time(subquery_offset_total[20s:10s] offset 30s);
+
+-- a negative offset looks ahead of the evaluation time
+tql eval (30, 30, '1s') sum_over_time(subquery_offset_total[20s:10s] offset -30s);
+
+-- an offset on the inner selector composes additively with the subquery offset: Prometheus
+-- `subqueryTimes` accumulates "the sum of offsets and ranges of all subqueries in the path",
+-- and the inner selector subtracts its own offset from the already shifted step timestamps.
+-- 20s + 10s therefore behaves like the un-offset subquery at t=30.
+tql eval (60, 60, '1s') sum_over_time((subquery_offset_total offset 10s)[20s:10s] offset 20s);
+
+-- ... and the inner offset alone accounts for the same total shift
+tql eval (60, 60, '1s') sum_over_time((subquery_offset_total offset 30s)[20s:10s]);
+
+-- `predict_linear` predicts from the evaluation time: 4 + 0.1 * 30 = 7 and 7 - 0.1 * 30 = 4
+tql eval (60, 60, '1s') predict_linear(subquery_offset_total[20s:10s] offset 30s, 0);
+
+tql eval (30, 30, '1s') predict_linear(subquery_offset_total[20s:10s] offset -30s, 0);
+
+drop table subquery_offset_total;
```

---

### Incident Patch 10: `886e02f0` (2026-09-29)
**Commit Message**: ci(query-regression): bump RUNNER_IMAGE_EPOCH to 7 (#9395)

ci(query-regression): bump RUNNER_IMAGE_EPOCH to 7 for image m-0xihbfzm5xpbxolybo6i

Signed-off-by: greptimedb-ci <[REDACTED_EMAIL]>
Co-authored-by: greptimedb-ci <[REDACTED_EMAIL]>

**File**: `.github/workflows/query-regression.yml` (modified, +1/-1)
```diff
@@ -549,7 +549,7 @@ jobs:
           readonly EXPECTED_SCCACHE_DIR="/home/runner/.cache/sccache"
           readonly EXPECTED_RUSTC_WRAPPER="/usr/local/bin/sccache"
           readonly RUNNER_IMAGE_DIGEST="sha256:e713b294e23b7e15184e558866c90025e59930033e72c97650dbc7f1ca022d11"
-          readonly RUNNER_IMAGE_EPOCH="6"
+          readonly RUNNER_IMAGE_EPOCH="7"
 
           require_expected_root() {
             local name="$1"
```

---

### Incident Patch 11: `28f01d2f` (2026-09-29)
**Commit Message**: revert(ci): pin the query-regression runner toolchain to nightly-2026-03-21 (#9389)

* revert(ci): pin the query-regression runner toolchain to nightly-2026-03-21

The query-regression benchmark compiles both the candidate and the
BASE checkout (the previous nightly build). Base refs can predate the
stable-toolchain migration and still use #![feature] gates, so the
runner toolchain must stay a nightly that can build historical
revisions; deriving it from the workspace rust-toolchain.toml (now
stable 1.96.1) breaks base builds.

Revert the toolchain-toml coupling introduced in #9369 and keep the
parts that were correct:

- query-regression.yml: RUSTUP_TOOLCHAIN hard-pinned to
  nightly-2026-03-21 again (with a comment explaining why), Verify
  assertions back to the exact nightly versions, and the
  test-tooling pin-derivation machinery removed
- runner Dockerfile: ARG RUST_TOOLCHAIN=nightly-2026-03-21 + baked
  ENV restored; the COPY rust-toolchain.toml parsing removed
- build-ecs-image.py: the toml staging in the builder user-data
  removed; base-image auto-resolution kept but retargeted to Ubuntu
  26.04 to match the Verify tool pins (python3 3.14 etc.)
- the rebuild job keeps th

**File**: `.github/runner-scale-sets/query-regression/Dockerfile` (modified, +8/-12)
```diff
@@ -22,14 +22,14 @@ ARG SCCACHE_SHA256=aec995a83ad3dff3d14b6314e08858b7b73d35ca85a5bcf3d3a9ec07dee35
 ARG RUSTUP_INIT_VERSION=1.29.0
 ARG RUSTUP_INIT_TARGET=x86_64-unknown-linux-gnu
 ARG RUSTUP_INIT_SHA256=4acc9acc76d5079515b46346a485974457b5a79893cfb01112423c89aeb5aa10
-
-# Single source of truth for the Rust toolchain: parsed from
-# rust-toolchain.toml at build time, so the image always bakes the
-# workspace toolchain without a second hard-coded pin here.
-COPY rust-toolchain.toml /opt/rust-toolchain.toml
+# Pinned to a nightly deliberately: the benchmark compiles historical base
+# checkouts (previous nightly builds) that still use #![feature] gates, so
+# the runner cannot follow the workspace's rust-toolchain.toml (now stable).
+ARG RUST_TOOLCHAIN=nightly-2026-03-21
 
 ENV RUSTUP_HOME=/opt/rustup \
     CARGO_HOME=/opt/cargo \
+    RUSTUP_TOOLCHAIN=${RUST_TOOLCHAIN} \
     RUSTUP_AUTO_INSTALL=0 \
     PATH=/opt/cargo/bin:${PATH}
 
@@ -73,14 +73,12 @@ RUN curl --fail --location --silent --show-error \
     && install --mode=0755 /tmp/sccache/sccache /usr/local/bin/sccache \
     && rm -rf /tmp/sccache.tar.gz /tmp/sccache
 
-RUN rust_toolchain="$(grep -E '^channel' /opt/rust-toolchain.toml | cut -d'"' -f2)" \
-    && test -n "${rust_toolchain}" \
-    && curl --fail --location --silent --show-error \
+RUN curl --fail --location --silent --show-error \
         --output /tmp/rustup-init \
         "https://static.rust-lang.org/rustup/archive/${RUSTUP_INIT_VERSION}/${RUSTUP_INIT_TARGET}/rustup-init" \
     && echo "${RUSTUP_INIT_SHA256}  /tmp/rustup-init" | sha256sum --check --status - \
     && chmod 0755 /tmp/rustup-init \
-    && /tmp/rustup-init -y --profile minimal --default-toolchain "${rust_toolchain}" --no-modify-path \
+    && /tmp/rustup-init -y --profile minimal --default-toolchain "${RUST_TOOLCHAIN}" --no-modify-path \
     && rm -f /tmp/rustup-init \
     && chown -R root:root /opt/rustup /opt/cargo \
     && chmod -R go-w /opt/rustup /opt/cargo \
@@ -91,8 +89,6 @@ USER runner
 
 RUN set -eu \
     && test "$(id -u)" = "1001" \
-    && rust_toolchain="$(grep -E '^channel' /opt/rust-toolchain.toml | cut -d'"' -f2)" \
-    && test -n "${rust_toolchain}" \
     && temporary_cargo_home="$(mktemp --directory)" \
     && temporary_proto_dir="" \
     && cleanup() { rm -rf "${temporary_cargo_home}" "${temporary_proto_dir}"; } \
@@ -104,7 +100,7 @@ RUN set -eu \
     && rustc --version \
     && active_toolchain="$(rustup show active-toolchain)" \
     && printf 'Active toolchain: %s\n' "${active_toolchain}" \
-    && case "${active_toolchain}" in "${rust_toolchain}-x86_64-unknown-linux-gnu"|"${rust_toolchain}-x86_64-unknown-linux-gnu "*) ;; *) exit 1;; esac \
+    && case "${active_toolchain}" in "${RUST_TOOLCHAIN}-x86_64-unknown-linux-gnu"|"${RUST_TOOLCHAIN}-x86_64-unknown-linux-gnu "*) ;; *) exit 1;; esac \
     && test ! -w /opt/rustup \
     && test ! -w /opt/cargo/bin \
     && test -r /usr/include/google/protobuf/any.proto \
```

**File**: `.github/runner-scale-sets/query-regression/README.md` (modified, +18/-14)
```diff
@@ -88,12 +88,17 @@ sweep.
 The runner `Dockerfile` in the parent directory stays the single source of the
 tool contract. The image is rebuilt **automatically** by the
 `rebuild-query-regression-runner-image` job in
-`.github/workflows/release-dev-builder-images.yaml` whenever
-`rust-toolchain.toml` or anything under this directory changes on main (or via
-manual dispatch): it runs the ops tool below, then bumps
-`RUNNER_IMAGE_EPOCH` in `query-regression.yml` and points the
-`QUERY_REGRESSION_ECS_IMAGE_ID` repo variable at the new image, so the next
-regression run picks up image and epoch together.
+`.github/workflows/release-dev-builder-images.yaml` whenever anything under
+this directory changes on main (or via manual dispatch): it runs the ops tool
+below, opens an epoch-bump PR for `RUNNER_IMAGE_EPOCH` in
+`query-regression.yml`, and points the `QUERY_REGRESSION_ECS_IMAGE_ID` repo
+variable at the new image.
+
+The runner toolchain is **pinned inside the Dockerfile** to
+`nightly-2026-03-21` and deliberately does NOT follow the workspace
+`rust-toolchain.toml`: the benchmark also compiles the BASE checkout (the
+previous nightly build), which may predate the stable-toolchain migration and
+still require a nightly compiler.
 
 The manual fallback (also what the workflow runs):
 
@@ -105,10 +110,10 @@ uv run .github/runner-scale-sets/query-regression/ecs-image/build-ecs-image.py \
 ```
 
 `--base-image-id` is optional: the script defaults to the latest public
-Ubuntu 24.04 image in the region (the Dockerfile pins every tool version
-itself, so base drift is low-risk); pass it — or set the
-`ALIYUN_ECS_BASE_IMAGE_ID` repo variable consumed by the automated job —
-to pin a specific base image.
+Ubuntu 26.04 image in the region (26.04 matches the tool-version pins the
+Verify step asserts, e.g. python3 3.14; keep the two in sync); pass it — or
+set the `ALIYUN_ECS_BASE_IMAGE_ID` repo variable consumed by the automated
+job — to pin a specific base image.
 
 The script boots a temporary builder instance, `docker build`s the runner
 image, materializes `/opt/rustup`, `/opt/cargo`, `/usr/local/bin` tools, and
@@ -173,11 +178,10 @@ overridable via `QUERY_REGRESSION_RUNNER_UID`/`QUERY_REGRESSION_RUNNER_GID`)
 and exact tool versions: `libprotoc 3.21.12`, `uv 0.11.26`, `mold 2.40.4`,
 `Python 3.14.4`, `sccache 0.16.0`, `otelgen` commit
 `863a3f395d062c7322cc1de08a38774b7fdaa6c8`, root-owned `rustup 1.29.0`, and
-the image-baked Rust toolchain matching `rust-toolchain.toml` (the image
-parses the pin from the toml at build time, and the workflow asserts it
-dynamically at run time — there is no separately pinned toolchain version).
+the image-baked Rust toolchain `nightly-2026-03-21` pinned in the runner
+Dockerfile (deliberately independent of `rust-toolchain.toml` — see above).
 `mold` and `python3`
-come from apt at image-build time (not Ubuntu 24.04's default 3.12); if the
+come from apt at image-build time; if the
 Ubuntu archive ships a newer package revision between rebuilds, the Verify
 step fails with the observed version — bump those pins in `query-regression.yml`
 when that happens. Everything else (toolchain, uv, sccache, otelgen, rustup,
```

**File**: `.github/runner-scale-sets/query-regression/ecs-image/build-ecs-image.py` (modified, +16/-23)
```diff
@@ -25,7 +25,7 @@
 
 """Build the query-regression ECS custom image (manual ops tool).
 
-Boots a temporary pay-as-you-go ECS instance from a public Ubuntu 24.04 image,
+Boots a temporary pay-as-you-go ECS instance from a public Ubuntu 26.04 image,
 builds the existing runner container image (the Dockerfile in the parent
 directory remains the single source of the tool contract), materializes the
 tool directories onto the host filesystem so the workflow's "Verify runner
@@ -52,17 +52,15 @@
 from pathlib import Path
 
 ASSETS_DIR = Path(__file__).resolve().parent
-# Repo root: ecs-image -> query-regression -> runner-scale-sets -> .github -> root.
-REPO_ROOT = ASSETS_DIR.parents[3]
 DONE_MARKER = "QREG_IMAGE_BUILD_DONE"
 FAILED_MARKER = "QREG_IMAGE_BUILD_FAILED"
 POLL_INTERVAL_SECONDS = 15
 CONSOLE_POLL_INTERVAL_SECONDS = 30
 BUILD_TIMEOUT_SECONDS = 60 * 60
 
-# Same apt package contract as the runner Dockerfile; the base
-# actions-runner image is Ubuntu 24.04, so an Ubuntu 24.04 host resolves the
-# same tool versions (protoc 3.21.12, mold 2.40.4, Python 3.14.4).
+# Same apt package contract as the runner Dockerfile; the base is an
+# Ubuntu 26.04 image, so an Ubuntu 26.04 host resolves the same tool
+# versions (protoc 3.21.12, mold 2.40.4, Python 3.14.4).
 # Docker itself comes from Docker's official repository (docker-ce), not the
 # distribution-packaged docker.io.
 APT_PACKAGES = [
@@ -94,9 +92,8 @@
 DOCKER_CE_PACKAGES = "docker-ce docker-ce-cli containerd.io docker-buildx-plugin"
 
 
-def render_user_data(dockerfile: str, rust_toolchain_toml: str, start_runner: str, unit: str) -> str:
+def render_user_data(dockerfile: str, start_runner: str, unit: str) -> str:
     dockerfile_b64 = base64.b64encode(dockerfile.encode()).decode()
-    rust_toolchain_b64 = base64.b64encode(rust_toolchain_toml.encode()).decode()
     start_runner_b64 = base64.b64encode(start_runner.encode()).decode()
     unit_b64 = base64.b64encode(unit.encode()).decode()
     packages = " ".join(APT_PACKAGES)
@@ -125,11 +122,6 @@ def render_user_data(dockerfile: str, rust_toolchain_toml: str, start_runner: st
 {dockerfile_b64}
 EOF
 mkdir -p /tmp/image-context
-# The Dockerfile COPYies rust-toolchain.toml (single source of truth for
-# the baked toolchain); stage it into the build context.
-base64 -d > /tmp/image-context/rust-toolchain.toml <<'EOF'
-{rust_toolchain_b64}
-EOF
 docker build --platform linux/amd64 -f /tmp/Dockerfile -t qreg-runner:local /tmp/image-context
 
 # Materialize the tool contract onto the host filesystem.
@@ -238,20 +230,22 @@ def call_api_with_retry(fn, description: str, attempts: int = 5):
 
 
 def resolve_base_image_id(client, region_id: str) -> str:
-    """Resolve the latest public Ubuntu 24.04 x86_64 system image.
+    """Resolve the latest public Ubuntu 26.04 x86_64 system image.
 
     Used as the default for --base-image-id: the runner Dockerfile pins
-    every tool version itself, so a current stock Ubuntu 24.04 base is all
+    every tool version itself, so a current stock Ubuntu LTS base is all
     the builder needs. Pass --base-image-id (or ALIYUN_ECS_BASE_IMAGE_ID)
     to pin a specific base image deterministically.
     """
     from alibabacloud_ecs20140526 import models as ecs_models
 
-    def _is_ubuntu_2404(image) -> bool:
-        # osname is localized (e.g. "Ubuntu 24.04 64位"), osname_en the
-        # English form; accept either.
+    def _is_target_ubuntu(image) -> bool:
+        # osname is localized (e.g. "Ubuntu 26.04 64位"), osname_en the
+        # English form; accept either. Keep the Ubuntu version in sync with
+        # the tool-version pins asserted by the Verify step in
+        # query-regression.yml (e.g. python3 3.14 comes from 26.04).
         for os_name in (image.osname_en, image.osname):
-            if os_name and "Ubuntu" in os_name and "24.04" in os_name:
+            if os_name and "Ubuntu" in os_name and "26.04" in os_name:
                 return True
         return False
 
@@ -277,10 +271,10 @@ def _is_ubuntu_2404(image) -> bool:
             break
         page_number += 1
 
-    candidates = [image for image in images if _is_ubuntu_2404(image)]
+    candidates = [image for image in images if _is_target_ubuntu(image)]
     if not candidates:
         raise SystemExit(
-            "No public Ubuntu 24.04 x86_64 system image found in region "
+            "No public Ubuntu 26.04 x86_64 system image found in region "
             f"{region_id}; pass --base-image-id explicitly"
         )
     candidates.sort(key=lambda image: image.creation_time or "", reverse=True)
@@ -324,7 +318,7 @@ def main() -> int:
     from alibabacloud_ecs20140526 import models as ecs_models
 
     client = make_ecs_client(args.region_id)
-    # --base-image-id is optional: default to the latest public Ubuntu 24.04
+    # --base-image-id is optional: default to the latest public Ubuntu 26.04
     # image in the region (the Dockerfile pins every tool version itself, so
     # base drift i
```

**File**: `.github/workflows/query-regression.yml` (modified, +14/-18)
```diff
@@ -120,23 +120,12 @@ jobs:
     # Ordinary PRs also run the same tests from checks.yml.
     runs-on: ubuntu-latest
     timeout-minutes: 10
-    outputs:
-      # The Rust toolchain pin, resolved from rust-toolchain.toml so the
-      # benchmark always runs the workspace toolchain without a second
-      # hard-coded copy in this workflow.
-      rust_toolchain: ${{ steps.rust-toolchain.outputs.pin }}
     steps:
       - name: Checkout
         uses: actions/checkout@v4
         with:
           persist-credentials: false
 
-      - name: Resolve Rust toolchain pin
-        id: rust-toolchain
-        run: |
-          pin="$(grep -E '^channel' rust-toolchain.toml | cut -d'"' -f2)"
-          echo "pin=${pin}" >> "$GITHUB_OUTPUT"
-
       - name: Test query regression tooling
         run: |
           python3 tests/perf/test_query_regression_runner_compaction_toctou.py
@@ -201,7 +190,13 @@ jobs:
       CARGO_HOME: /home/runner/.cargo
       UV_CACHE_DIR: /home/runner/.cargo/uv-cache
       RUSTUP_HOME: /opt/rustup
-      RUSTUP_TOOLCHAIN: ${{ needs.test-tooling.outputs.rust_toolchain }}
+      # Deliberately NOT derived from rust-toolchain.toml: the benchmark
+      # also compiles the BASE checkout (the previous nightly build, which
+      # may predate the stable-toolchain migration and still uses
+      # #![feature] gates), so the runner must keep a nightly toolchain
+      # that can build historical revisions. This pin moves only via a
+      # deliberate runner-image rebuild.
+      RUSTUP_TOOLCHAIN: nightly-2026-03-21
       RUSTUP_AUTO_INSTALL: "0"
       CARGO_TARGET_DIR: /home/runner/query-regression-target
       QUERY_REGRESSION_CACHE_META: /home/runner/query-regression-cache-meta
@@ -515,16 +510,17 @@ jobs:
           require_eq cargo_path "$(command -v cargo || true)" "/opt/cargo/bin/cargo"
           require_eq rustc_path "$(command -v rustc || true)" "/opt/cargo/bin/rustc"
           require_match rustup "$(capture rustup --version)" '^rustup[[:space:]]1\.29\.0([[:space:]]|$)'
-          # The toolchain pin flows from rust-toolchain.toml (resolved in the
-          # test-tooling job); escape it for the regex assertions below.
-          pin_regex="${RUSTUP_TOOLCHAIN//./\\.}"
+          # The runner toolchain is pinned to nightly-2026-03-21 (see the
+          # RUSTUP_TOOLCHAIN comment): it must compile historical base
+          # checkouts, so it intentionally does not follow rust-toolchain.toml.
           require_match cargo "$(capture cargo --version)" \
-            "^cargo[[:space:]]${pin_regex}[[:space:]]\([0-9a-f]+[[:space:]][0-9]{4}-[0-9]{2}-[0-9]{2}\)$"
+            '^cargo[[:space:]]1\.96\.0-nightly[[:space:]]\(cbb9bb8bd[[:space:]][0-9]{4}-[0-9]{2}-[0-9]{2}\)$'
           require_match rustc "$(capture rustc --version)" \
-            "^rustc[[:space:]]${pin_regex}[[:space:]]\([0-9a-f]+[[:space:]][0-9]{4}-[0-9]{2}-[0-9]{2}\)$"
+            '^rustc[[:space:]]1\.96\.0-nightly[[:space:]]\(ac7f9ec7d[[:space:]][0-9]{4}-[0-9]{2}-[0-9]{2}\)$'
           require_match active_toolchain "$(capture rustup show active-toolchain)" \
-            "^${pin_regex}-x86_64-unknown-linux-gnu([[:space:]]|$)"
+            '^nightly-2026-03-21-x86_64-unknown-linux-gnu([[:space:]]|$)'
           require_eq RUSTUP_HOME "${RUSTUP_HOME}" "/opt/rustup"
+          require_eq RUSTUP_TOOLCHAIN "${RUSTUP_TOOLCHAIN}" "nightly-2026-03-21"
           require_eq RUSTUP_AUTO_INSTALL "${RUSTUP_AUTO_INSTALL}" "0"
           require "readable /opt/rustup" test -r /opt/rustup
           require "executable /opt/rustup" test -x /opt/rustup
```

**File**: `.github/workflows/release-dev-builder-images.yaml` (modified, +44/-16)
```diff
@@ -71,9 +71,13 @@ jobs:
           files="$(git diff --name-only "${base}" "${head}")"
           dev_builder=false
           query_regression_runner=false
+          # rust-toolchain.toml only gates the dev-builder images: they bake
+          # the workspace toolchain. The query-regression runner toolchain is
+          # pinned inside its Dockerfile (nightly-2026-03-21) and must NOT
+          # follow the workspace pin, so its rebuild triggers only on changes
+          # under its own directory.
           if grep -qx 'rust-toolchain.toml' <<<"${files}"; then
             dev_builder=true
-            query_regression_runner=true
           fi
           if grep -q '^docker/dev-builder/' <<<"${files}"; then
             dev_builder=true
@@ -335,18 +339,21 @@ jobs:
     # Rebuilds the query-regression ECS runner image via the ops tool in
     # .github/runner-scale-sets/query-regression/ecs-image/: boots a
     # temporary pay-as-you-go ECS builder, snapshots a new custom image,
-    # then completes the documented lockstep updates in order:
+    # then completes the documented lockstep updates:
     #   1. bumps RUNNER_IMAGE_EPOCH in query-regression.yml (target-cache
-    #      invalidation) and pushes the commit to main, and only then
+    #      invalidation) via a PR from a timestamped ci/ branch (main is
+    #      branch-protected; mirrors update-dev-builder-version.sh), and
     #   2. points the repo variable QUERY_REGRESSION_ECS_IMAGE_ID at the
-    #      new image, so the next regression run picks up image and epoch
-    #      together.
+    #      new image. The runner toolchain is pinned inside the Dockerfile
+    #      (nightly-2026-03-21, independent of rust-toolchain.toml — the
+    #      benchmark must compile historical base checkouts), so image
+    #      rebuilds do not change the cache ABI.
     #
     # Required repository configuration (same names the provisioning job
     # uses): vars ALIYUN_ECS_REGION_ID, ALIYUN_ECS_VSWITCH_ID,
     # ALIYUN_ECS_SECURITY_GROUP_ID, optionally ALIYUN_ECS_RESOURCE_GROUP_ID
     # and ALIYUN_ECS_BASE_IMAGE_ID (deterministic base-image pin; otherwise
-    # the rebuild auto-resolves the latest public Ubuntu 24.04 image).
+    # the rebuild auto-resolves the latest public Ubuntu 26.04 image).
     # Secrets: ALICLOUD_ECS_ACCESS_KEY_ID, ALICLOUD_ECS_ACCESS_KEY_SECRET,
     # GH_PERSONAL_ACCESS_TOKEN (repo push + actions-variable write).
     name: Rebuild query-regression runner image
@@ -392,7 +399,7 @@ jobs:
           echo "## Rebuilt runner image" >> "$GITHUB_STEP_SUMMARY"
           echo "New image: \`${image_id}\`" >> "$GITHUB_STEP_SUMMARY"
 
-      - name: Bump RUNNER_IMAGE_EPOCH and update the image id variable
+      - name: Open the epoch-bump PR and update the image id variable
         env:
           GH_TOKEN: ${{ secrets.GH_PERSONAL_ACCESS_TOKEN }}
         run: |
@@ -405,21 +412,42 @@ jobs:
             exit 1
           fi
           new_epoch=$((old_epoch + 1))
-          sed -i "s/readonly RUNNER_IMAGE_EPOCH=\"${old_epoch}\"/readonly RUNNER_IMAGE_EPOCH=\"${new_epoch}\"/" \
-            .github/workflows/query-regression.yml
 
+          # main is branch-protected (required reviews + status checks), so
+          # the epoch bump cannot be pushed there directly. Mirror
+          # .github/scripts/update-dev-builder-version.sh: timestamped bot
+          # branch, plain push, and a PR with reviewers. Do NOT use [skip ci]
+          # on the commit: the required checks must be able to run for the PR
+          # to become mergeable.
+          BRANCH="ci/update-query-regression-epoch-$(date +%Y%m%d%H%M%S)"
           git config user.name "greptimedb-ci"
-          git config user.email "greptimedb-ci@users.noreply.github.com"
+          git config user.email "greptimedb-ci@greptime.com"
+          git fetch origin main
+          git checkout -b "${BRANCH}" origin/main
+          sed -i "s/readonly RUNNER_IMAGE_EPOCH=\"${old_epoch}\"/readonly RUNNER_IMAGE_EPOCH=\"${new_epoch}\"/" \
+            .github/workflows/query-regression.yml
           git add .github/workflows/query-regression.yml
-          git commit -m "ci(query-regression): bump RUNNER_IMAGE_EPOCH to ${new_epoch} for image ${image_id} [skip ci]"
-          git pull --rebase origin main
-          git push origin HEAD:main
+          git commit -s -m "ci(query-regression): bump RUNNER_IMAGE_EPOCH to ${new_epoch} for image ${image_id}"
+          git push origin "${BRANCH}"
+
+          gh pr create \
+            --title "ci(query-regression): bump RUNNER_IMAGE_EPOCH to ${new_epoch}" \
+            --body "Auto-generated by the \`Rebuild query-regression runner image\` job in ${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID} for image \`${image_id}\`. Merging this invalidates the query-regression target cache (RUNNER_IMAGE_EPOCH ${old_epoch} → ${new_epoch}). The \`QUERY_REGRESSION_ECS_IMAGE_ID\` repo variable already points at the new image; t
```

---

### Incident Patch 12: `dd2c1d1a` (2026-09-29)
**Commit Message**: fix(meta-srv): use NoTls for disabled and Unix socket Postgres KV backends (#9059)

* fix(meta-srv): use NoTls for disabled and Unix socket Postgres KV backends

Signed-off-by: Tyagiquamar <[REDACTED_EMAIL]>

* fix(meta-srv): treat Postgres config as unix socket only when every host is a socket

tokio-postgres dials hostaddr over TCP even when host is a socket path,
and a mixed host list with Require/VerifyFull TLS would otherwise end up
sending plaintext over TCP. is_unix_socket_url now parses via
tokio_postgres::Config and requires no hostaddr and all-Unix hosts.
Adds regression cases for the libpq keyword form, the user@ percent
encoded socket URL, and the mixed host / hostaddr negatives.

Signed-off-by: Tyagiquamar <[REDACTED_EMAIL]>

---------

Signed-off-by: Tyagiquamar <[REDACTED_EMAIL]>

**File**: `src/meta-srv/src/utils/postgres.rs` (modified, +108/-12)
```diff
@@ -12,6 +12,9 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
+#[cfg(unix)]
+use std::str::FromStr;
+
 use common_error::ext::BoxedError;
 use common_meta::election::ElectionRef;
 use common_meta::election::rds::postgres::{ElectionPgClient, PgElection};
@@ -20,10 +23,13 @@ use common_meta::kv_backend::rds::PgStore;
 use common_meta::kv_backend::rds::postgres::{
     TlsMode as PgTlsMode, TlsOption as PgTlsOption, create_postgres_tls_connector,
 };
+use common_telemetry::warn;
 use deadpool_postgres::{Config, Runtime};
 use servers::tls::TlsOption;
 use snafu::{OptionExt, ResultExt};
 use tokio_postgres::NoTls;
+#[cfg(unix)]
+use tokio_postgres::config::Host;
 
 use crate::error::{self, Result};
 
@@ -60,23 +66,57 @@ pub async fn create_postgres_pool(
     })?;
     cfg.url = Some(postgres_url.clone());
 
-    let pool = if let Some(tls_config) = tls_config {
-        let pg_tls_config = convert_tls_option(&tls_config);
-        let tls_connector =
-            create_postgres_tls_connector(&pg_tls_config).map_err(|e| error::Error::Other {
-                source: BoxedError::new(e),
-                location: snafu::Location::new(file!(), line!(), 0),
-            })?;
-        cfg.create_pool(Some(Runtime::Tokio1), tls_connector)
-            .context(error::CreatePostgresPoolSnafu)?
-    } else {
-        cfg.create_pool(Some(Runtime::Tokio1), NoTls)
-            .context(error::CreatePostgresPoolSnafu)?
+    let is_unix_socket = is_unix_socket_url(postgres_url);
+    if is_unix_socket
+        && matches!(tls_config.as_ref(), Some(t) if t.mode != servers::tls::TlsMode::Disable)
+    {
+        warn!(
+            "TLS is not supported for Unix domain socket PostgreSQL connections, falling back to NoTls"
+        );
+    }
+
+    let pool = match tls_config {
+        Some(tls_config)
+            if tls_config.mode != servers::tls::TlsMode::Disable && !is_unix_socket =>
+        {
+            let pg_tls_config = convert_tls_option(&tls_config);
+            let tls_connector =
+                create_postgres_tls_connector(&pg_tls_config).map_err(|e| error::Error::Other {
+                    source: BoxedError::new(e),
+                    location: snafu::Location::new(file!(), line!(), 0),
+                })?;
+            cfg.create_pool(Some(Runtime::Tokio1), tls_connector)
+                .context(error::CreatePostgresPoolSnafu)?
+        }
+        _ => cfg
+            .create_pool(Some(Runtime::Tokio1), NoTls)
+            .context(error::CreatePostgresPoolSnafu)?,
     };
 
     Ok(pool)
 }
 
+#[cfg(unix)]
+fn is_unix_socket_url(url: &str) -> bool {
+    let Ok(cfg) = tokio_postgres::Config::from_str(url) else {
+        return false;
+    };
+    // tokio-postgres dials `hostaddr` over TCP even when `host` is a socket path,
+    // so treat the config as a socket only when every host is a Unix socket and
+    // no `hostaddr` is set.
+    cfg.get_hostaddrs().is_empty()
+        && !cfg.get_hosts().is_empty()
+        && cfg
+            .get_hosts()
+            .iter()
+            .all(|host| matches!(host, Host::Unix(_)))
+}
+
+#[cfg(not(unix))]
+fn is_unix_socket_url(_: &str) -> bool {
+    false
+}
+
 /// Builds a Postgres-backed metadata [`KvBackendRef`].
 ///
 /// * `store_addrs` - Postgres connection URLs; only the first address is used.
@@ -150,3 +190,59 @@ pub async fn build_postgres_election(
     .await
     .context(error::KvBackendSnafu)
 }
+
+#[cfg(test)]
+mod tests {
+    use super::is_unix_socket_url;
+
+    #[test]
+    fn detects_postgres_unix_socket_url() {
+        #[cfg(unix)]
+        {
+            // libpq keyword-value form (issue #7734)
+            assert!(is_unix_socket_url(
+                "host=/var/run/postgresql dbname=greptime user=greptime password=secret"
+            ));
+            // standard postgres URL with percent-encoded unix socket directory
+            assert!(is_unix_socket_url(
+                "postgresql://user:pw@%2Fvar%2Frun%2Fpostgresql/mydb"
+            ));
+            assert!(is_unix_socket_url(
+                "postgresql://user@%2Fvar%2Frun%2Fpostgresql/db"
+            ));
+            // postgres URL with socket dir in query param
+            assert!(is_unix_socket_url(
+                "postgresql:///mydb?host=%2Fvar%2Frun%2Fpostgresql"
+            ));
+            assert!(is_unix_socket_url(
+                "postgresql://user:secret@/mydb?host=%2Fvar%2Frun%2Fpostgresql"
+            ));
+
+            // TCP URLs should not be classified as unix socket
+            assert!(!is_unix_socket_url(
+                "postgresql://user:pw@localhost:5432/mydb"
+            ));
+            assert!(!is_unix_socket_url("postgresql://user@localhost/db"));
+            assert!(!is_unix_socket_url(
+                "host=127.0.0.1 port=5432 dbname=greptime user=greptime password=secret"
+            ));
+            // mixed socket and TCP hosts must not be treated as a 
```

---

### Incident Patch 13: `18022124` (2026-09-28)
**Commit Message**: test: remove unused legacy compatibility test suites (#9378)

Signed-off-by: Dennis Zhuang <[REDACTED_EMAIL]>

**File**: `tests/compat/README.md` (removed, +0/-31)
```diff
@@ -1,31 +0,0 @@
-# GreptimeDB compatibility test
-
-The compatibility test check whether a newer version of GreptimeDB can read from the data written by an old version of
-GreptimeDB (the "backward" compatibility), and vice-versa (the "forward" compatibility). It's often ran in the Github
-Actions to ensure there are no breaking changes by accident.
-
-The test work like this: reuse the sqlness-runner two times but each for a read or write side. For example, if we are
-testing backward compatibility, we use sqlness-runner to run the SQLs with writes against the old GreptimeDB binary, and
-use the same sqlness-runner to run the SQLs with reads against the new GreptimeDB binary. If the reads were executed
-expectedly, we have achieved backward compatibility.
-
-This compatibility test is inspired by [Databend](https://github.com/datafuselabs/databend/).
-
-## Usage
-
-```shell
-tests/compat/test-compat.sh <old_ver>
-```
-
-E.g. `tests/compat/test-compat.sh 0.6.0` tests if the data written by GreptimeDB **v0.6.0** can be read by **current**
-version of GreptimeDB, and vice-versa. By "current", it's meant the fresh binary built by current codes.
-
-## Prerequisites
-
-Current version of GreptimeDB's binaries must reside in `./bins`:
-
-- `./bins/current/greptime`
-- `./bins/current/sqlness-runner`
-
-The steps in Github Action already assure that. When running in local host, you have to `cp` them from target directory
-manually.
```

**File**: `tests/compat/case/read/standalone/read.result` (removed, +0/-13)
```diff
@@ -1,13 +0,0 @@
-select ts, i, s, f from foo order by ts;
-
-+---------------------+---+----------+-----+
-| ts                  | i | s        | f   |
-+---------------------+---+----------+-----+
-| 2024-02-01T17:00:00 | 1 | my_tag_1 |     |
-| 2024-02-01T18:00:00 | 2 | my_tag_2 |     |
-| 2024-02-01T19:00:00 | 3 | my_tag_3 |     |
-| 2024-02-01T20:00:00 | 4 | my_tag_4 | 4.4 |
-| 2024-02-01T21:00:00 | 5 | my_tag_5 | 5.5 |
-| 2024-02-01T22:00:00 | 6 | my_tag_6 | 6.6 |
-+---------------------+---+----------+-----+
-
```

**File**: `tests/compat/case/read/standalone/read.sql` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-select ts, i, s, f from foo order by ts;
```

**File**: `tests/compat/case/write/standalone/write.result` (removed, +0/-25)
```diff
@@ -1,25 +0,0 @@
-create table foo(ts timestamp time index, s string primary key, i int);
-
-Affected Rows: 0
-
-insert into foo values
-("2024-02-02 01:00:00+0800", "my_tag_1", 1),
-("2024-02-02 02:00:00+0800", "my_tag_2", 2),
-("2024-02-02 03:00:00+0800", "my_tag_3", 3);
-
-Affected Rows: 3
-
--- Alter the table to trigger a flush (will be executed before process being terminated).
--- Otherwise the SST might not be generated (the data could be remained in WAL).
--- If we have the explicitly flush table interface in the future, it's still good to have the alter table in the test.
-alter table foo add column f float;
-
-Affected Rows: 0
-
-insert into foo values
-("2024-02-02 04:00:00+0800", "my_tag_4", 4, 4.4),
-("2024-02-02 05:00:00+0800", "my_tag_5", 5, 5.5),
-("2024-02-02 06:00:00+0800", "my_tag_6", 6, 6.6);
-
-Affected Rows: 3
-
```

**File**: `tests/compat/case/write/standalone/write.sql` (removed, +0/-16)
```diff
@@ -1,16 +0,0 @@
-create table foo(ts timestamp time index, s string primary key, i int);
-
-insert into foo values
-("2024-02-02 01:00:00+0800", "my_tag_1", 1),
-("2024-02-02 02:00:00+0800", "my_tag_2", 2),
-("2024-02-02 03:00:00+0800", "my_tag_3", 3);
-
--- Alter the table to trigger a flush (will be executed before process being terminated).
--- Otherwise the SST might not be generated (the data could be remained in WAL).
--- If we have the explicitly flush table interface in the future, it's still good to have the alter table in the test.
-alter table foo add column f float;
-
-insert into foo values
-("2024-02-02 04:00:00+0800", "my_tag_4", 4, 4.4),
-("2024-02-02 05:00:00+0800", "my_tag_5", 5, 5.5),
-("2024-02-02 06:00:00+0800", "my_tag_6", 6, 6.6);
```

**File**: `tests/compat/test-compat.sh` (removed, +0/-37)
```diff
@@ -1,37 +0,0 @@
-#!/bin/bash
-
-set -o errexit
-
-usage() {
-    echo " Tests the compatibility between different versions of GreptimeDB."
-    echo " Expects the directory './bins/current' contains the newly built binaries."
-    echo " Usage: $0 <old_version>"
-}
-
-# The previous version of GreptimeDB to test compatibility with.
-# e.g. old_ver="0.6.0"
-old_ver="$1"
-
-if [ -z $old_ver ]
-then
-    usage
-    exit -1
-fi
-
-SCRIPT_PATH="$(cd "$(dirname "$0")" >/dev/null 2>&1 && pwd)"
-echo " === SCRIPT_PATH: $SCRIPT_PATH"
-source "${SCRIPT_PATH}/util.sh"
-
-# go to work tree root
-cd "$SCRIPT_PATH/../../"
-
-download_binary "$old_ver"
-
-run_test $old_ver "backward"
-
-echo " === Clear GreptimeDB data before running forward compatibility test"
-rm -rf /tmp/greptimedb-standalone
-
-run_test $old_ver "forward"
-
-echo "Compatibility test run successfully!"
```

**File**: `tests/compat/util.sh` (removed, +0/-82)
```diff
@@ -1,82 +0,0 @@
-#!/bin/bash
-
-# Assemble the GreptimeDB binary download URL for a specific version.
-binary_url() {
-    local ver="$1"
-    local bin_tar="greptime-$(uname -s | tr '[:upper:]' '[:lower:]')-amd64-v$ver.tar.gz"
-    echo "https://github.com/GreptimeTeam/greptimedb/releases/download/v$ver/$bin_tar"
-}
-
-# Download a specific version of GreptimeDB binary tar file, untar it to folder `./bins/$ver`.
-# `ver` is semver without prefix `v`
-download_binary() {
-    local ver="$1"
-    local url="$(binary_url $ver)"
-    local bin_tar="greptime-$(uname -s | tr '[:upper:]' '[:lower:]')-amd64-v$ver.tar.gz"
-
-    if [ -f ./bins/$ver/greptime ]; then
-        echo " === binaries exist: $(ls ./bins/$ver/* | tr '\n' ' ')"
-        chmod +x ./bins/$ver/*
-        return
-    fi
-
-    if [ -f "$bin_tar" ]; then
-        echo " === tar file exists: $bin_tar"
-    else
-        echo " === Download binary ver: $ver"
-        echo " === Download binary url: $url"
-        curl --connect-timeout 5 --retry 5 --retry-delay 1 -L "$url" -o "$bin_tar"
-    fi
-
-    mkdir -p ./bins/$ver
-    tar -xf "$bin_tar" --strip-components=1 -C ./bins/$ver
-
-    echo " === unpacked: ./bins/$ver:"
-    ls -lh ./bins/$ver
-
-    chmod +x ./bins/$ver/*
-}
-
-# Test data compatibility that:
-# - the data written by an old version of GreptimeDB can be read by the current one
-# - the data written by the current version of GreptimeDB can be read by an old one ("forward" compatibility)
-run_test() {
-    local old_ver="$1"
-    local forward="$2"
-
-    local write_case_dir="./tests/compat/case/write"
-    local read_case_dir="./tests/compat/case/read"
-    local bin_old="./bins/$old_ver/greptime"
-    local bin_new="./bins/current/greptime"
-    local runner="./bins/current/sqlness-runner"
-
-    echo " === Test with:"
-    echo " === old greptimedb version:"
-    "$bin_old" --version
-    echo " === new greptimedb version:"
-    "$bin_new" --version
-
-    # "forward" means we are testing forward compatibility:
-    # the data generated by current version GreptimeDB can be used by old.
-    # So we run new GreptimeDB binary first to write, then run old to read.
-    # And the opposite for backward compatibility.
-    if [ "$forward" == "forward" ]
-    then
-        echo " === Running forward compat test ..."
-        echo " === Run test: write with current GreptimeDB"
-        $runner bare --bins-dir $(dirname $bin_new) --case-dir $write_case_dir
-    else
-        echo " === Running backward compat test ..."
-        echo " === Run test: write with old GreptimeDB"
-        $runner bare --bins-dir $(dirname $bin_old) --case-dir $write_case_dir
-    fi
-
-    if [ "$forward" == 'forward' ]
-    then
-        echo " === Run test: read with old GreptimeDB"
-        $runner bare --bins-dir $(dirname $bin_old) --case-dir $read_case_dir
-    else
-        echo " === Run test: read with current GreptimeDB"
-        $runner bare --bins-dir $(dirname $bin_new) --case-dir $read_case_dir
-    fi
-}
```

**File**: `tests/upgrade-compat/distributed/common` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-../standalone/common
\ No newline at end of file
```

---

### Incident Patch 14: `a310ca2b` (2026-09-28)
**Commit Message**: ci(query-regression): bump RUNNER_IMAGE_EPOCH to 6 (#9381)

ci(query-regression): bump RUNNER_IMAGE_EPOCH to 6 for image m-0xidkbbavm3suxqd0y1m

Co-authored-by: greptimedb-ci <[REDACTED_EMAIL]>

**File**: `.github/workflows/query-regression.yml` (modified, +1/-1)
```diff
@@ -553,7 +553,7 @@ jobs:
           readonly EXPECTED_SCCACHE_DIR="/home/runner/.cache/sccache"
           readonly EXPECTED_RUSTC_WRAPPER="/usr/local/bin/sccache"
           readonly RUNNER_IMAGE_DIGEST="sha256:e713b294e23b7e15184e558866c90025e59930033e72c97650dbc7f1ca022d11"
-          readonly RUNNER_IMAGE_EPOCH="5"
+          readonly RUNNER_IMAGE_EPOCH="6"
 
           require_expected_root() {
             local name="$1"
```

---

### Incident Patch 15: `ffdd6d09` (2026-09-28)
**Commit Message**: perf(index): cut allocations when building bloom and inverted indexes (#9359)

* perf(index): build bloom filters from element hashes without per-token allocation

Signed-off-by: Dennis Zhuang <[REDACTED_EMAIL]>

* perf(index): speed up inverted index building with hashed buffers and sync pushes

Signed-off-by: Dennis Zhuang <[REDACTED_EMAIL]>

* chore(index): use BuildHasher::hash_one for element hashes

Signed-off-by: Dennis Zhuang <[REDACTED_EMAIL]>

* chore(index): require callers to act on spill requests

Signed-off-by: Dennis Zhuang <[REDACTED_EMAIL]>

* fix(index): insert bloom hashes one by one to keep segment set capacity bounded

Signed-off-by: Dennis Zhuang <[REDACTED_EMAIL]>

* test(index): add index build and bloom search benchmarks

Signed-off-by: Dennis Zhuang <[REDACTED_EMAIL]>

* test(index): keep applier setup out of the bloom search benchmark

Signed-off-by: Dennis Zhuang <[REDACTED_EMAIL]>

* fix(index): skip empty spills and keep the old inverted sort memory estimate

Signed-off-by: Dennis Zhuang <[REDACTED_EMAIL]>

* fix(index): stream fulltext token hashes and test spill dispatch

Signed-off-by: Dennis Zhuang <[REDACTED_EMAIL]>

* docs(index): note non-ASCII 

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -6813,6 +6813,7 @@ dependencies = [
 name = "index"
 version = "1.3.0-alpha.1"
 dependencies = [
+ "ahash 0.8.12",
  "async-trait",
  "asynchronous-codec",
  "bytemuck",
```

**File**: `src/index/Cargo.toml` (modified, +5/-0)
```diff
@@ -8,6 +8,7 @@ license.workspace = true
 workspace = true
 
 [dependencies]
+ahash.workspace = true
 async-trait.workspace = true
 asynchronous-codec = "0.7.0"
 bytemuck.workspace = true
@@ -57,3 +58,7 @@ harness = false
 [[bench]]
 name = "bytes_to_u64_vec"
 harness = false
+
+[[bench]]
+name = "index_build_bench"
+harness = false
```

**File**: `src/index/benches/index_build_bench.rs` (added, +424/-0)
```diff
@@ -0,0 +1,424 @@
+// Copyright 2023 Greptime Team
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+//! Index build and bloom search benchmarks over synthetic observability data.
+
+use std::collections::{BTreeSet, HashMap};
+use std::hint::black_box;
+use std::num::NonZeroUsize;
+use std::path::PathBuf;
+use std::sync::Arc;
+use std::sync::atomic::AtomicUsize;
+
+use async_trait::async_trait;
+use criterion::{BatchSize, Criterion, Throughput, criterion_group, criterion_main};
+use futures::{AsyncRead, AsyncReadExt};
+use index::bitmap::BitmapType;
+use index::bloom_filter::applier::{BloomFilterApplier, InListPredicate};
+use index::bloom_filter::creator::BloomFilterCreator;
+use index::bloom_filter::reader::BloomFilterReaderImpl;
+use index::external_provider::{ExternalTempFileProvider, Reader, Writer};
+use index::fulltext_index::Config;
+use index::fulltext_index::create::{BloomFilterFulltextIndexCreator, FulltextIndexCreator};
+use index::fulltext_index::tokenizer::{Analyzer, EnglishTokenizer};
+use index::inverted_index::create::InvertedIndexCreator;
+use index::inverted_index::create::sort::external_sort::ExternalSorter;
+use index::inverted_index::create::sort_create::SortIndexCreator;
+use index::inverted_index::format::writer::InvertedIndexBlobWriter;
+use puffin::puffin_manager::{PuffinWriter, PutOptions};
+use rand::seq::IndexedRandom;
+use rand::{Rng, SeedableRng};
+use rand_chacha::ChaCha8Rng;
+
+const ROWS: usize = 100_000;
+const SEGMENT_ROWS: usize = 10240;
+const ROW_GROUP_ROWS: usize = 102400;
+
+/// Drains blobs so the bloom fulltext creator can finish without a puffin file.
+struct DrainPuffinWriter;
+
+#[async_trait]
+impl PuffinWriter for DrainPuffinWriter {
+    async fn put_blob<R>(
+        &mut self,
+        _key: &str,
+        raw_data: R,
+        _options: PutOptions,
+        _properties: HashMap<String, String>,
+    ) -> puffin::error::Result<u64>
+    where
+        R: AsyncRead + Send,
+    {
+        let mut buf = Vec::new();
+        Box::pin(raw_data).read_to_end(&mut buf).await.unwrap();
+        Ok(buf.len() as u64)
+    }
+
+    async fn put_dir(
+        &mut self,
+        _key: &str,
+        _dir: PathBuf,
+        _options: PutOptions,
+        _properties: HashMap<String, String>,
+    ) -> puffin::error::Result<u64> {
+        unreachable!("bloom fulltext index only writes blobs")
+    }
+
+    fn set_footer_lz4_compressed(&mut self, _lz4_compressed: bool) {}
+
+    async fn finish(self) -> puffin::error::Result<u64> {
+        Ok(0)
+    }
+}
+
+/// The benchmarks set no memory limit, so nothing is spilled.
+struct NoSpill;
+
+#[async_trait]
+impl ExternalTempFileProvider for NoSpill {
+    async fn create(&self, _: &str, _: &str) -> Result<Writer, index::error::Error> {
+        unreachable!("no memory limit is set")
+    }
+
+    async fn read_all(&self, _: &str) -> Result<Vec<(String, Reader)>, index::error::Error> {
+        Ok(vec![])
+    }
+}
+
+fn uuid(rng: &mut ChaCha8Rng) -> String {
+    let h = format!("{:032x}", rng.random::<u128>());
+    format!(
+        "{}-{}-{}-{}-{}",
+        &h[0..8],
+        &h[8..12],
+        &h[12..16],
+        &h[16..20],
+        &h[20..32]
+    )
+}
+
+/// Access, auth, timeout and error log lines with request ids, IPs and numbers: most
+/// tokens of a segment are distinct.
+fn service_logs(rows: usize) -> Vec<String> {
+    let mut rng = ChaCha8Rng::seed_from_u64(1);
+    let paths = ["users", "orders", "items", "carts", "payments", "sessions"];
+    (0..rows)
+        .map(|_| {
+            let ip = format!(
+                "10.{}.{}.{}",
+                rng.random_range(0..16),
+                rng.random_range(0..256),
+                rng.random_range(1..255)
+            );
+            match rng.random_range(0..10) {
+                0..=5 => format!(
+                    "INFO GET /api/v1/{}/{}/detail?page={} 200 {}ms request_id={} client={}",
+                    paths.choose(&mut rng).unwrap(),
+                    rng.random_range(0..200000),
+                    rng.random_range(0..50),
+                    rng.random_range(1..2000),
+                    uuid(&mut rng),
+                    ip
+                ),
+                6..=7 => format!(
+                    "WARN connection to {}:{} timed out after {}ms retry={}",
+                    ip,
+                    rng.random_range(1024..65535),
+                    rng.random_range(100..30000),
+                    rng.random
```

**File**: `src/index/src/bloom_filter.rs` (modified, +68/-0)
```diff
@@ -17,5 +17,73 @@ pub mod creator;
 pub mod error;
 pub mod reader;
 
+use std::hash::{BuildHasher, BuildHasherDefault, Hasher};
+use std::sync::LazyLock;
+
 /// The seed used for the Bloom filter.
 pub const SEED: u128 = 42;
+
+static ELEMENT_HASHER: LazyLock<fastbloom::DefaultHasher> =
+    LazyLock::new(|| fastbloom::DefaultHasher::seeded(&SEED.to_be_bytes()));
+
+/// Returns the hash fastbloom derives for `elem` with the persisted [`SEED`].
+///
+/// A filter built from these hashes with [`PrehashedBuildHasher`] has exactly the same
+/// bits as one built by inserting the elements themselves, so files stay readable by
+/// both paths.
+pub fn element_hash(elem: &[u8]) -> u64 {
+    ELEMENT_HASHER.hash_one(elem)
+}
+
+/// Hasher that returns an already computed [`element_hash`] unchanged.
+#[derive(Default)]
+pub struct PrehashedHasher(u64);
+
+impl Hasher for PrehashedHasher {
+    fn finish(&self) -> u64 {
+        self.0
+    }
+
+    fn write(&mut self, _bytes: &[u8]) {
+        unreachable!("PrehashedHasher only accepts u64 hashes")
+    }
+
+    fn write_u64(&mut self, hash: u64) {
+        self.0 = hash;
+    }
+}
+
+pub type PrehashedBuildHasher = BuildHasherDefault<PrehashedHasher>;
+
+/// A persisted bloom filter probed by [`element_hash`] values.
+pub type PrehashedBloomFilter = fastbloom::BloomFilter<512, PrehashedBuildHasher>;
+
+#[cfg(test)]
+mod tests {
+    use fastbloom::BloomFilter;
+
+    use super::*;
+
+    #[test]
+    fn test_prehashed_filter_matches_seeded_filter() {
+        // Persisted filters are read back with `.seed(&SEED)`, so building them from
+        // precomputed hashes must set exactly the same bits.
+        for count in [0usize, 1, 7, 100, 5000] {
+            let elems = (0..count)
+                .map(|i| format!("elem-{i}").into_bytes())
+                .chain([Vec::new()])
+                .collect::<Vec<_>>();
+            let mut seeded = BloomFilter::with_false_pos(0.01)
+                .seed(&SEED)
+                .expected_items(elems.len());
+            let mut prehashed = BloomFilter::with_false_pos(0.01)
+                .hasher(PrehashedBuildHasher::default())
+                .expected_items(elems.len());
+            for elem in &elems {
+                seeded.insert(elem);
+                prehashed.insert(&element_hash(elem));
+            }
+            assert_eq!(seeded.as_slice(), prehashed.as_slice());
+        }
+    }
+}
```

**File**: `src/index/src/bloom_filter/applier.rs` (modified, +9/-8)
```diff
@@ -16,13 +16,13 @@ use std::collections::BTreeSet;
 use std::ops::Range;
 use std::sync::Arc;
 
-use fastbloom::BloomFilter;
 use greptime_proto::v1::index::BloomFilterMeta;
 use itertools::Itertools;
 
 use crate::Bytes;
 use crate::bloom_filter::error::Result;
 use crate::bloom_filter::reader::{BloomFilterReadMetrics, BloomFilterReader};
+use crate::bloom_filter::{PrehashedBloomFilter, element_hash};
 
 /// Filter bytes one batch of [`BloomFilterApplier::search_groups`] reads. A single row
 /// group larger than this is still read as one batch, so this is not a memory limit; a
@@ -190,7 +190,7 @@ impl BloomFilterApplier {
         &mut self,
         segments: &[usize],
         metrics: Option<&mut BloomFilterReadMetrics>,
-    ) -> Result<(Vec<(u64, usize)>, Vec<BloomFilter>)> {
+    ) -> Result<(Vec<(u64, usize)>, Vec<PrehashedBloomFilter>)> {
         let segment_locations = segments
             .iter()
             .map(|&seg| (self.meta.segment_loc_indices[seg], seg))
@@ -215,11 +215,15 @@ impl BloomFilterApplier {
     fn find_matching_rows(
         &self,
         segment_locations: Vec<(u64, usize)>,
-        bloom_filters: Vec<BloomFilter>,
+        bloom_filters: Vec<PrehashedBloomFilter>,
         predicates: &[InListPredicate],
     ) -> Vec<Range<usize>> {
         let rows_per_segment = self.meta.rows_per_segment as usize;
         let mut matching_row_ranges = Vec::with_capacity(bloom_filters.len());
+        let predicate_hashes = predicates
+            .iter()
+            .map(|p| p.list.iter().map(|v| element_hash(v)).collect::<Vec<_>>())
+            .collect::<Vec<_>>();
 
         // Group segments by their location index (since they have the same bloom filter) and check if they match all predicates
         for ((_loc_index, group), bloom_filter) in segment_locations
@@ -229,12 +233,9 @@ impl BloomFilterApplier {
             .zip(bloom_filters.iter())
         {
             // Check if this bloom filter matches each predicate (AND semantics)
-            let matches_all_predicates = predicates.iter().all(|predicate| {
+            let matches_all_predicates = predicate_hashes.iter().all(|hashes| {
                 // For each predicate, at least one probe must match (OR semantics)
-                predicate
-                    .list
-                    .iter()
-                    .any(|probe| bloom_filter.contains(probe))
+                hashes.iter().any(|hash| bloom_filter.contains(hash))
             });
 
             if !matches_all_predicates {
```

**File**: `src/index/src/bloom_filter/creator.rs` (modified, +70/-74)
```diff
@@ -26,8 +26,8 @@ use prost::Message;
 use snafu::ResultExt;
 
 use crate::Bytes;
-use crate::bloom_filter::SEED;
 use crate::bloom_filter::error::{IoSnafu, Result};
+use crate::bloom_filter::{PrehashedBuildHasher, element_hash};
 use crate::external_provider::ExternalTempFileProvider;
 
 /// `BloomFilterCreator` is responsible for creating and managing bloom filters
@@ -52,8 +52,11 @@ pub struct BloomFilterCreator {
     /// Row count that added to the bloom filter so far.
     accumulated_row_count: usize,
 
-    /// A set of distinct elements in the current segment.
-    cur_seg_distinct_elems: HashSet<Bytes>,
+    /// Distinct element hashes (see [`element_hash`]) in the current segment.
+    ///
+    /// Elements with equal hashes set the same bits, so deduplicating by hash loses
+    /// nothing and avoids copying the values.
+    cur_seg_distinct_elems: HashSet<u64, PrehashedBuildHasher>,
 
     /// The memory usage of the current segment's distinct elements.
     cur_seg_distinct_elems_mem_usage: usize,
@@ -106,71 +109,58 @@ impl BloomFilterCreator {
     /// reaches `rows_per_segment`, it finalizes the current segment.
     pub async fn push_n_row_elems(
         &mut self,
-        mut nrows: usize,
+        nrows: usize,
         elems: impl IntoIterator<Item = Bytes>,
     ) -> Result<()> {
-        if nrows == 0 {
-            return Ok(());
-        }
-        if nrows == 1 {
-            return self.push_row_elems(elems).await;
-        }
+        let hashes = elems
+            .into_iter()
+            .map(|e| element_hash(&e))
+            .collect::<Vec<_>>();
+        self.push_n_row_hashes(nrows, &hashes).await
+    }
 
-        let elems = elems.into_iter().collect::<Vec<_>>();
-        while nrows > 0 {
-            let rows_to_seg_end =
-                self.rows_per_segment - (self.accumulated_row_count % self.rows_per_segment);
-            let rows_to_push = nrows.min(rows_to_seg_end);
-            nrows -= rows_to_push;
+    /// Adds `nrows` copies of a single borrowed value (or null). Row counts advance for
+    /// nulls as well.
+    pub async fn push_n_row_elem(&mut self, nrows: usize, elem: Option<&[u8]>) -> Result<()> {
+        match elem {
+            Some(elem) => self.push_n_row_hashes(nrows, &[element_hash(elem)]).await,
+            None => self.push_n_row_hashes(nrows, &[]).await,
+        }
+    }
 
-            self.accumulated_row_count += rows_to_push;
+    /// Adds a row of elements to the bloom filter. If the number of accumulated rows
+    /// reaches `rows_per_segment`, it finalizes the current segment.
+    pub async fn push_row_elems(&mut self, elems: impl IntoIterator<Item = Bytes>) -> Result<()> {
+        self.push_row_hashes(elems.into_iter().map(|e| element_hash(&e)))
+            .await
+    }
 
-            let mut mem_diff = 0;
-            for elem in &elems {
-                let len = elem.len();
-                let is_new = self.cur_seg_distinct_elems.insert(elem.clone());
-                if is_new {
-                    mem_diff += len;
-                }
-            }
-            self.cur_seg_distinct_elems_mem_usage += mem_diff;
-            self.global_memory_usage
-                .fetch_add(mem_diff, Ordering::Relaxed);
+    /// Adds a row of element hashes computed by [`element_hash`].
+    pub async fn push_row_hashes(&mut self, hashes: impl IntoIterator<Item = u64>) -> Result<()> {
+        self.accumulated_row_count += 1;
+        self.insert_hashes(hashes);
 
-            if self
-                .accumulated_row_count
-                .is_multiple_of(self.rows_per_segment)
-            {
-                self.finalize_segment().await?;
-                self.finalized_row_count = self.accumulated_row_count;
-            }
+        if self
+            .accumulated_row_count
+            .is_multiple_of(self.rows_per_segment)
+        {
+            self.finalize_segment().await?;
+            self.finalized_row_count = self.accumulated_row_count;
         }
 
         Ok(())
     }
 
-    /// Adds `nrows` copies of a single borrowed value (or null), copying it only when
-    /// it is new to a segment. Row counts advance for nulls as well.
-    pub async fn push_n_row_elem(&mut self, mut nrows: usize, elem: Option<&[u8]>) -> Result<()> {
+    /// Adds `nrows` rows that all contain the element hashes in `hashes`.
+    pub async fn push_n_row_hashes(&mut self, mut nrows: usize, hashes: &[u64]) -> Result<()> {
         while nrows > 0 {
             let rows_to_seg_end =
                 self.rows_per_segment - (self.accumulated_row_count % self.rows_per_segment);
             let rows_to_push = nrows.min(rows_to_seg_end);
             nrows -= rows_to_push;
             self.accumulated_row_count += rows_to_push;
+            self.insert_hashes(hashes.iter().copied());
 
-            if let Some(elem) = elem {
-                let old_len = self.cur_seg_distinct_elems.len();
-                // Only allocate when the value is abse
```

**File**: `src/index/src/bloom_filter/creator/finalize_segment.rs` (modified, +11/-10)
```diff
@@ -22,8 +22,7 @@ use futures::stream::StreamExt;
 use futures::{AsyncWriteExt, Stream, stream};
 use snafu::ResultExt;
 
-use crate::Bytes;
-use crate::bloom_filter::creator::SEED;
+use crate::bloom_filter::PrehashedBuildHasher;
 use crate::bloom_filter::creator::intermediate_codec::IntermediateBloomFilterCodecV1;
 use crate::bloom_filter::error::{IntermediateSnafu, IoSnafu, Result};
 use crate::external_provider::ExternalTempFileProvider;
@@ -98,14 +97,14 @@ impl FinalizedBloomFilterStorage {
     /// If the memory usage exceeds the threshold, flushes the in-memory Bloom filters to disk.
     pub async fn add(
         &mut self,
-        elems: impl IntoIterator<Item = Bytes>,
+        elem_hashes: impl IntoIterator<Item = u64>,
         element_count: usize,
     ) -> Result<()> {
         let mut bf = BloomFilter::with_false_pos(self.false_positive_rate)
-            .seed(&SEED)
+            .hasher(PrehashedBuildHasher::default())
             .expected_items(element_count);
-        for elem in elems.into_iter() {
-            bf.insert(&elem);
+        for hash in elem_hashes.into_iter() {
+            bf.insert(&hash);
         }
 
         let fbf = FinalizedBloomFilterSegment::from(bf, element_count);
@@ -231,7 +230,7 @@ pub struct FinalizedBloomFilterSegment {
 }
 
 impl FinalizedBloomFilterSegment {
-    fn from(bf: BloomFilter, elem_count: usize) -> Self {
+    fn from<S: std::hash::BuildHasher>(bf: BloomFilter<512, S>, elem_count: usize) -> Self {
         let bf_slice = bf.as_slice();
         let mut bloom_filter_bytes = Vec::with_capacity(std::mem::size_of_val(bf_slice));
         for &x in bf_slice {
@@ -256,6 +255,7 @@ mod tests {
 
     use super::*;
     use crate::bloom_filter::creator::tests::u64_vec_from_bytes;
+    use crate::bloom_filter::{SEED, element_hash};
     use crate::external_provider::MockExternalTempFileProvider;
 
     #[tokio::test]
@@ -300,11 +300,12 @@ mod tests {
         let dup_batch = 200;
 
         for i in 0..(batch - dup_batch) {
-            let elems = (elem_count * i..elem_count * (i + 1)).map(|x| x.to_string().into_bytes());
+            let elems = (elem_count * i..elem_count * (i + 1))
+                .map(|x| element_hash(x.to_string().as_bytes()));
             storage.add(elems, elem_count).await.unwrap();
         }
         for _ in 0..dup_batch {
-            storage.add(Some(vec![]), 1).await.unwrap();
+            storage.add(Some(element_hash(&[])), 1).await.unwrap();
         }
 
         // Flush happens.
@@ -356,7 +357,7 @@ mod tests {
 
         let batch = 1000;
         for _ in 0..batch {
-            storage.add(Some(vec![]), 1).await.unwrap();
+            storage.add(Some(element_hash(&[])), 1).await.unwrap();
         }
 
         // Drain the storage.
```

**File**: `src/index/src/bloom_filter/reader.rs` (modified, +4/-3)
```diff
@@ -25,10 +25,10 @@ use greptime_proto::v1::index::{BloomFilterLoc, BloomFilterMeta};
 use prost::Message;
 use snafu::{ResultExt, ensure};
 
-use crate::bloom_filter::SEED;
 use crate::bloom_filter::error::{
     DecodeProtoSnafu, FileSizeTooSmallSnafu, IoSnafu, Result, UnexpectedMetaSizeSnafu,
 };
+use crate::bloom_filter::{PrehashedBloomFilter, PrehashedBuildHasher, SEED};
 
 /// Minimum size of the bloom filter, which is the size of the length of the bloom filter.
 const BLOOM_META_LEN_SIZE: u64 = 4;
@@ -181,11 +181,12 @@ pub trait BloomFilterReader: Sync {
         Ok(bm)
     }
 
+    /// Reads multiple bloom filters; probe them with [`crate::bloom_filter::element_hash`].
     async fn bloom_filter_vec(
         &self,
         locs: &[BloomFilterLoc],
         metrics: Option<&mut BloomFilterReadMetrics>,
-    ) -> Result<Vec<BloomFilter>> {
+    ) -> Result<Vec<PrehashedBloomFilter>> {
         let ranges = locs
             .iter()
             .map(|l| l.offset..l.offset + l.size)
@@ -196,7 +197,7 @@ pub trait BloomFilterReader: Sync {
         for (bs, loc) in bss.into_iter().zip(locs.iter()) {
             let vec = bytes_to_u64_vec(&bs);
             let bm = BloomFilter::from_vec(vec)
-                .seed(&SEED)
+                .hasher(PrehashedBuildHasher::default())
                 .expected_items(loc.element_count as _);
             result.push(bm);
         }
```

#### Recent Merged Pull Requests:
- **PR #9436** (2026-10-02): fix: temporarily disable v2 series scan by default (@evenyag)
- **PR #9434** (2026-10-02): ci: make query regression non-blocking for scheduled nightly releases (@sunng87)
- **PR #9431** (2026-10-02): fix(catalog): skip backend batch_get on full cache hits (@WenyXu)
- **PR #9430** (2026-10-01): ci: upgrade EC2 runner action to restore runner registration (@evenyag)
- **PR #9420** (2026-09-30): fix(mito2): truncate parquet column index min/max for SST writes (@killme2008)
- **PR #9410** (2026-09-30): feat(mito): wait for WAL durability before publishing a manifest watermark (@fengjiachun)
- **PR #9408** (2026-09-30): perf: batch schema export requests (@fengjiachun)
- **PR #9403** (2026-10-02): chore: bump version and start new 1.4 release cycle (@sunng87)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
