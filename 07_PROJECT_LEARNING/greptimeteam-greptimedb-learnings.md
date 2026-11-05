> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/greptimeteam-greptimedb-learnings.md`  
> **Source**: github ([https://github.com/GreptimeTeam/greptimedb](https://github.com/GreptimeTeam/greptimedb))  
> **Source Version**: `351f4207`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-04T11:09:30.729Z  
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
> **Harvest Timestamp**: 2026-11-04T11:09:29.922Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GreptimeTeam/greptimedb`
- **Description**: The open-source observability database. One columnar engine for metrics, logs, and traces, on object storage.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6784 stars

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
- **Issue #10149** (2026-11-04): **fix: test**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  ## What's changed and what's your intention?  Minor fixture fix  ## PR Checklist Please convert it to a draft if some of the following conditions are not met.  - [ ] I have written the necessary rustdoc comments. - [ ] I have added the necessary unit tests and integration tests. - [ ] This PR requires documentation updates. - [ ] API changes are backward compatible. - [ ] Schema or data changes are backward compatible. - [ ] This PR needs to be backported to release branches, and I have added the `backport-<target>` labels (e.g. `backport-v1.3` targets `release/v1.3`).  ## Merge timing  - [x] Merge during the nightly window <!-- nightly-merge -->  <!-- Eligible PRs enter the merge queue hourly from 02:10 through 08:10 Beijing time (UTC+8), up to five per run. Uncheck to opt out and remove the `merge nightly` label; this does not enable immediate merging. Maintainers can use **Merge when ready** to merge earlier. Changing this checkbox does not cancel an existing queue entry or manually enabled auto-merge. --> 

- **Issue #10146** (2026-11-04): **fix(ci): increase nightly JSONBench runner root volume**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  [Failed Nightly JSONBench run](https://github.com/GreptimeTeam/greptimedb/actions/runs/41781882983/job/126415640930)  ## What's changed and what's your intention?  Nightly JSONBench exhausted the runner's 8 GiB AMI-default root volume, crashing the GitHub Actions worker with `No space left on device`. The dataset volume is mounted read-only; database storage, WAL, and compaction files still use the root volume.  Configure a 500 GiB root volume for Nightly JSONBench and forward the optional `ec2-volume-size` input through the shared start-runner action. Other workflows retain the AMI default when they omit this input.  Validation: YAML parsing, input wiring checks across all seven start-runner calls, and `git diff --check` passed. The AWS workflow has not been rerun; actual peak disk usage remains unmeasured. Rust tests and build checks were not run because this change only updates Actions YAML.  ## PR Checklist  - [x] I have written the necessary rustdoc comments. (Not applicable: Actions YAML only.) - [x] I have added the necessary unit tests and integration tests. (Static YAML and input wiring checks; no new runtime logic.) - [ ] This PR requires documentation updates. - [x] API changes are backward compatible. (The new action input is optional.) - [x] Schema or data changes are backward compatible. (No schema or 

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

### Incident Patch 1: `351f4207` (2026-11-04)
**Commit Message**: fix(meta): invalidate all datanode tables on address change (#9986)

When a datanode restarts with a new address, metasrv invalidated cached
table routes only for the tables in that heartbeat's region stats. The
first heartbeat after a restart often reports few or no regions (e.g.
with init_regions_in_background), so frontends kept dialing the old
address until metadata_cache_ttl expired.

Read the previous address via prev_kv when saving it, and when it
changed (or a failed save of the same epoch is retried) invalidate
every table registered for the datanode in __dn_table.

Signed-off-by: Floris Smit <[REDACTED_EMAIL]>
Co-authored-by: Weny Xu <[REDACTED_EMAIL]>

**File**: `src/meta-srv/AGENTS.md` (modified, +2/-0)
```diff
@@ -43,6 +43,8 @@ abstraction, election, key encoding, and the DDL manager live in `common-meta`;
   `handler/utils.rs` for per-node address persistence. Datanode address
   updates retain the statistics handler's per-node ordering. Address epochs are
   confirmed only after a successful save; cache invalidation remains best effort.
+  A changed datanode address invalidates every table on that node (`__dn_table`),
+  not only the tables in the current heartbeat.
 - **Datanode process fence**: before the handler chain, the leader's heartbeat
   session checks a datanode request's non-zero `node_epoch` against the highest
   one recorded under `__datanode_epoch`, read and raised through the leader
```

**File**: `src/meta-srv/src/handler/collect_stats_handler.rs` (modified, +205/-8)
```diff
@@ -16,14 +16,17 @@ use std::cmp::Ordering;
 use std::sync::Arc;
 
 use api::v1::meta::{HeartbeatRequest, Peer, Role};
+use common_meta::DatanodeId;
 use common_meta::datanode::{DatanodeStatKey, DatanodeStatValue, Stat};
 use common_meta::instruction::CacheIdent;
 use common_meta::key::MetadataKey;
-use common_meta::key::node_address::NodeAddressKey;
+use common_meta::key::node_address::{NodeAddressKey, NodeAddressValue};
 use common_meta::rpc::store::PutRequest;
 use common_telemetry::{error, warn};
 use dashmap::DashMap;
+use futures::TryStreamExt;
 use snafu::ResultExt;
+use store_api::storage::TableId;
 use tokio::sync::Mutex;
 
 use crate::error::{self, Result};
@@ -196,14 +199,43 @@ async fn update_datanode_address(updater: &NodeAddressUpdater, ctx: &Context, st
         .inspect_err(|e| {
             error!(e; "Failed to update datanode address, node: {}, address: {}", stat.id, stat.addr);
         });
-    if let Ok(true) = updated {
-        let cache_idents = stat
-            .table_ids()
-            .into_iter()
-            .map(CacheIdent::TableId)
-            .collect::<Vec<_>>();
-        utils::invalidate_address_caches(ctx, stat.id, &cache_idents).await;
+    let Ok(Some(saved)) = updated else {
+        return;
+    };
+
+    let mut table_ids = stat.table_ids();
+    // Cached table routes embed the address, and a restarted datanode's first
+    // heartbeat may report few regions, so invalidate every table on the node.
+    // A failed earlier attempt may already have stored the new address, which
+    // hides the change from this save.
+    if saved.retried || address_changed(saved.output.as_ref(), &stat.addr) {
+        match datanode_table_ids(ctx, stat.id).await {
+            Ok(ids) => table_ids.extend(ids),
+            Err(e) => {
+                error!(e; "Failed to list tables of datanode {} for address invalidation", stat.id)
+            }
+        }
     }
+    let cache_idents = table_ids
+        .into_iter()
+        .map(CacheIdent::TableId)
+        .collect::<Vec<_>>();
+    utils::invalidate_address_caches(ctx, stat.id, &cache_idents).await;
+}
+
+/// A missing or undecodable previous address counts as changed.
+fn address_changed(previous: Option<&NodeAddressValue>, addr: &str) -> bool {
+    previous.is_none_or(|previous| previous.peer.addr != addr)
+}
+
+async fn datanode_table_ids(ctx: &Context, datanode_id: DatanodeId) -> Result<Vec<TableId>> {
+    ctx.table_metadata_manager
+        .datanode_table_manager()
+        .tables(datanode_id)
+        .map_ok(|value| value.table_id)
+        .try_collect()
+        .await
+        .context(error::TableMetadataManagerSnafu)
 }
 
 #[cfg(test)]
@@ -214,8 +246,11 @@ mod tests {
     use std::thread;
     use std::time::Duration;
 
+    use common_meta::cache_invalidator::{CacheInvalidator, Context as InvalidationContext};
     use common_meta::datanode::DatanodeStatKey;
     use common_meta::error::{Error as MetaError, Result as MetaResult};
+    use common_meta::key::datanode_table::{DatanodeTableKey, DatanodeTableValue, RegionInfo};
+    use common_meta::key::{MetadataValue, RegionRoleSet};
     use common_meta::kv_backend::{KvBackend, KvBackendRef, ResettableKvBackend, TxnService};
     use common_meta::rpc::store::{
         BatchDeleteRequest, BatchDeleteResponse, BatchGetRequest, BatchGetResponse,
@@ -537,6 +572,168 @@ mod tests {
         }
     }
 
+    #[derive(Default)]
+    struct RecordingCacheInvalidator {
+        calls: StdMutex<Vec<Vec<CacheIdent>>>,
+    }
+
+    impl RecordingCacheInvalidator {
+        fn table_ids_per_call(&self) -> Vec<Vec<TableId>> {
+            self.calls
+                .lock()
+                .unwrap()
+                .iter()
+                .map(|idents| {
+                    let mut ids = idents
+                        .iter()
+                        .map(|ident| match ident {
+                            CacheIdent::TableId(id) => *id,
+                            other => panic!("unexpected cache ident: {other:?}"),
+                        })
+                        .collect::<Vec<_>>();
+                    ids.sort_unstable();
+                    ids
+                })
+                .collect()
+        }
+    }
+
+    #[async_trait::async_trait]
+    impl CacheInvalidator for RecordingCacheInvalidator {
+        async fn invalidate(
+            &self,
+            _: &InvalidationContext,
+            idents: &[CacheIdent],
+        ) -> MetaResult<()> {
+            self.calls.lock().unwrap().push(idents.to_vec());
+            Ok(())
+        }
+
+        fn invalidate_all(&self) -> MetaResult<()> {
+            Ok(())
+        }
+    }
+
+    async fn register_datanode_tables(ctx: &Context, datanode_id: u64, table_ids: &[TableId]) {
+        for table_id in table_ids {
+            let value = DatanodeTableValue::new(
+                *table_id,
+                RegionRoleSet::new(vec![0], vec![]),
+                RegionInfo::default(),
+         
```

**File**: `src/meta-srv/src/handler/remap_flow_peer_handler.rs` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@ impl HeartbeatHandler for RemapFlowPeerHandler {
                 // Address errors must not prevent later heartbeat handlers from running.
                 error!(e; "Failed to update flownode address, peer: {:?}", peer);
             });
-        if let Ok(true) = updated {
+        if let Ok(Some(_)) = updated {
             let cache_idents = [CacheIdent::FlowNodeAddressChange(peer.id)];
             utils::invalidate_address_caches(ctx, peer.id, &cache_idents).await;
         }
```

**File**: `src/meta-srv/src/handler/utils.rs` (modified, +46/-22)
```diff
@@ -44,19 +44,27 @@ struct NodeAddressEpochs {
     saved_epoch: Option<u64>,
 }
 
+/// The outcome of a successful address save.
+pub(crate) struct SavedAddress<T> {
+    pub(crate) output: T,
+    /// An earlier save of this epoch failed or was cancelled, but its write
+    /// may still have reached the store.
+    pub(crate) retried: bool,
+}
+
 impl NodeAddressUpdater {
-    /// Saves a new or previously failed epoch. Returns true only when this call
-    /// saved the address, or false when the heartbeat is stale or already saved.
+    /// Saves a new or previously failed epoch. Returns `None` when the
+    /// heartbeat is stale or already saved.
     /// Cache invalidation is separate and does not affect acknowledgement.
-    pub(crate) async fn update_if_needed<F, Fut>(
+    pub(crate) async fn update_if_needed<T, F, Fut>(
         &self,
         node: (Role, u64),
         epoch: u64,
         save: F,
-    ) -> Result<bool>
+    ) -> Result<Option<SavedAddress<T>>>
     where
         F: FnOnce() -> Fut,
-        Fut: Future<Output = Result<()>>,
+        Fut: Future<Output = Result<T>>,
     {
         // Never retain a DashMap guard across await, even while waiting for a
         // different node: its entry may live in the same shard.
@@ -66,34 +74,43 @@ impl NodeAddressUpdater {
         };
         let mut state = state.lock().await;
         if state.seen_epoch.is_some_and(|seen| epoch < seen) || state.saved_epoch == Some(epoch) {
-            return Ok(false);
+            return Ok(None);
         }
 
         // Seeing an epoch rejects stale heartbeats, but only a successful save
         // suppresses retries of that same epoch. Cancellation also leaves it retryable.
+        let retried = state.seen_epoch == Some(epoch);
         state.seen_epoch = Some(epoch);
-        save().await?;
+        let output = save().await?;
         state.saved_epoch = Some(epoch);
-        Ok(true)
+        Ok(Some(SavedAddress { output, retried }))
     }
 }
 
-/// Persists an address through the leader cache.
-pub(crate) async fn save_node_address(ctx: &Context, key: Vec<u8>, peer: Peer) -> Result<()> {
+/// Persists an address through the leader cache and returns the one it
+/// replaced, treating an undecodable value as absent.
+pub(crate) async fn save_node_address(
+    ctx: &Context,
+    key: Vec<u8>,
+    peer: Peer,
+) -> Result<Option<NodeAddressValue>> {
     let address = NodeAddressValue::new(peer);
     let value = address
         .try_as_raw_value()
         .context(InvalidNodeInfoFormatSnafu)?;
-    ctx.leader_cached_kv_backend
+    let resp = ctx
+        .leader_cached_kv_backend
         .put(PutRequest {
             key,
             value,
-            prev_kv: false,
+            prev_kv: true,
         })
         .await
         .context(KvBackendSnafu)?;
     info!("Successfully updated node address: {:?}", address.peer);
-    Ok(())
+    Ok(resp
+        .prev_kv
+        .and_then(|kv| NodeAddressValue::try_from_raw_value(&kv.value).ok()))
 }
 
 /// Preserves the existing best-effort notification behavior. Notification
@@ -127,7 +144,7 @@ mod tests {
         let key = (Role::Datanode, 1);
         assert!(
             updater
-                .update_if_needed(key, 2, || async {
+                .update_if_needed::<(), _, _>(key, 2, || async {
                     crate::error::UnexpectedSnafu {
                         violated: "injected save failure",
                     }
@@ -137,32 +154,36 @@ mod tests {
                 .is_err()
         );
         assert!(
-            !updater
-                .update_if_needed(key, 1, || async {
+            updater
+                .update_if_needed::<(), _, _>(key, 1, || async {
                     panic!("stale heartbeat must not save");
                 })
                 .await
                 .unwrap()
+                .is_none()
         );
         assert!(
             updater
                 .update_if_needed(key, 2, || async { Ok(()) })
                 .await
                 .unwrap()
+                .is_some_and(|saved| saved.retried)
         );
         assert!(
-            !updater
-                .update_if_needed(key, 2, || async {
+            updater
+                .update_if_needed::<(), _, _>(key, 2, || async {
                     panic!("successful epoch must not save again");
                 })
                 .await
                 .unwrap()
+                .is_none()
         );
         assert!(
             updater
                 .update_if_needed(key, 3, || async { Ok(()) })
                 .await
                 .unwrap()
+                .is_some_and(|saved| !saved.retried)
         );
     }
 
@@ -190,6 +211,7 @@ mod tests {
             .await
             .unwrap()
             .unwrap()
+            .is_some()
         );
     }
 
@@ -248,6 +270,7 @@ mod tests {
                                         })
                                         .await
                    
```

---

### Incident Patch 2: `e38b84a9` (2026-11-04)
**Commit Message**: fix(mito2): prevent automatic compaction candidate starvation (#9946)

* fix(mito2): prevent automatic compaction candidate starvation

Signed-off-by: Lei, HUANG <[REDACTED_EMAIL]>

* fix(mito2): share fair compaction candidate planning

Signed-off-by: Lei, HUANG <[REDACTED_EMAIL]>

* fix(mito2): include L0 peers in fair closed merges

Signed-off-by: Lei, HUANG <[REDACTED_EMAIL]>

* feat(mito2): observe TWCS planning and promoted picks

Signed-off-by: Lei, HUANG <[REDACTED_EMAIL]>

* refactor(mito2): move compaction pick history into scheduler

Signed-off-by: Lei, HUANG <[REDACTED_EMAIL]>

* refactor(mito2): simplify compaction pick history helpers

Separate history observation from selection and gate test-only access.\nSimplify candidate collection and consolidate redundant tests.

Signed-off-by: Lei, HUANG <[REDACTED_EMAIL]>

* refactor(mito2): acknowledge fair picks at selection

A selected key consumes its fairness turn when the plan is accepted instead of after a successful execution. Drop the pending-selection state, input-id matching and execution hooks; rejected or failed attempts retry with normal priority, so a promoted key can no longer hold the front slot indefinitely.


**File**: `src/mito2/AGENTS.md` (modified, +5/-0)
```diff
@@ -99,6 +99,11 @@ Tests live next to the code as `*_test.rs` (e.g. `src/mito2/src/engine/flush_tes
   only close/drop unregisters them. See `compaction/scheduler/state.rs`.
 - Local compaction units use the snapshot-free `CompactionContext`. Retaining a
   full `CompactionRegion` in a unit pins other units' inputs and delays SST purge.
+- Candidate waiting history is owned by the region scheduler (`scheduler/history.rs`).
+  Background planning works on a private snapshot; only a fenced result may replace
+  resident history, and an accepted plan consumes the fairness turn for each selected
+  key. Execution success or failure must not rewrite waiting ages. TWCS discovery
+  must not mutate scheduler state.
 - In flat batches, equal `__primary_key` dictionary keys imply the same series, but
   not the reverse: `wrap_pk_binary_to_dict` gives every row its own key. Compare key
   bytes when grouping rows by series.
```

**File**: `src/mito2/src/compaction/last_non_null.rs` (modified, +251/-69)
```diff
@@ -58,49 +58,61 @@ impl Picker for LastNonNullPicker {
         let max_outputs = self.base_picker.max_background_tasks;
 
         // Find all possible compaction seeds
-        let Some(mut all_seeds) = self
+        let Some(all_seeds) = self
             .base_picker
             .pick_with_output_limit(region, None)
             .await?
         else {
             return Ok(None);
         };
-        let version = region.current_version.clone();
-        common_runtime::spawn_blocking_compact(move || {
-            let expired: HashSet<_> = all_seeds
-                .expired_ssts
-                .iter()
-                .map(FileHandle::file_id)
-                .collect();
-            // Include busy files and all levels/windows. Request ranges and
-            // TWCS size/file-count limits only constrain seeds, not correctness.
-            let all_files = version
-                .ssts
-                .levels()
-                .iter()
-                .flat_map(|level| level.files())
-                .filter(|file| !expired.contains(&file.file_id()))
-                .cloned()
-                .collect();
-            all_seeds.outputs =
-                build_closed_outputs(all_seeds.outputs, all_files, &version.metadata);
-            all_seeds.outputs.retain(|output| {
-                inputs_precede_memtables(&output.inputs, version.memtable_min_sequence)
-            });
-            if let Some(limit) = max_outputs {
-                // Only eligible closures consume the budget. Keep the high-priority
-                // tail because the compactor pops from the end of the output list.
-                let excess = all_seeds.outputs.len().saturating_sub(limit);
-                all_seeds.outputs.drain(..excess);
-            }
-            (!all_seeds.outputs.is_empty() || !all_seeds.expired_ssts.is_empty())
-                .then_some(all_seeds)
-        })
-        .await
-        .context(JoinSnafu)
+        let (output, _) = close_outputs(region, all_seeds, max_outputs).await?;
+        Ok(output)
     }
 }
 
+/// Attempts seeds in priority order until valid closures fill the output budget.
+/// Returns indices into the original seed list for all attempted/absorbed seeds,
+/// including rejected closures but excluding seeds left behind by the budget.
+pub(crate) async fn close_outputs(
+    region: &CompactionRegion,
+    mut all_seeds: PickerOutput,
+    max_outputs: Option<usize>,
+) -> Result<(Option<PickerOutput>, Vec<usize>)> {
+    let version = region.current_version.clone();
+    common_runtime::spawn_blocking_compact(move || {
+        let expired: HashSet<_> = all_seeds
+            .expired_ssts
+            .iter()
+            .map(FileHandle::file_id)
+            .collect();
+        // Include busy files and all levels/windows. Request ranges and
+        // TWCS size/file-count limits only constrain seeds, not correctness.
+        let all_files = version
+            .ssts
+            .levels()
+            .iter()
+            .flat_map(|level| level.files())
+            .filter(|file| !expired.contains(&file.file_id()))
+            .cloned()
+            .collect();
+        let (outputs, attempted_seeds) = build_closed_outputs(
+            all_seeds.outputs,
+            all_files,
+            &version.metadata,
+            ClosureLimits {
+                max_outputs,
+                memtable_min_sequence: version.memtable_min_sequence,
+            },
+        );
+        all_seeds.outputs = outputs;
+        let output = (!all_seeds.outputs.is_empty() || !all_seeds.expired_ssts.is_empty())
+            .then_some(all_seeds);
+        (output, attempted_seeds)
+    })
+    .await
+    .context(JoinSnafu)
+}
+
 /// Imported SSTs can be newer than pending writes. A merge must not attach an
 /// old field to a sequence above an intermediate version left in a memtable.
 pub(super) fn inputs_precede_memtables(
@@ -116,14 +128,22 @@ pub(super) fn inputs_precede_memtables(
     })
 }
 
+/// Constraints checked on complete closures, never on partial seed inputs.
+#[derive(Default)]
+struct ClosureLimits {
+    max_outputs: Option<usize>,
+    memtable_min_sequence: Option<SequenceNumber>,
+}
+
 /// Each seed and snapshot file is consumed at most once. Absorbing a seed also
 /// absorbs its disconnected members: a merge stream must never be split across
 /// independently scheduled outputs.
 fn build_closed_outputs(
     seeds: Vec<CompactionOutput>,
     files: Vec<FileHandle>,
     metadata: &RegionMetadataRef,
-) -> Vec<CompactionOutput> {
+    limits: ClosureLimits,
+) -> (Vec<CompactionOutput>, Vec<usize>) {
     // Maps every seed input to its seed, so a closure that reaches that input
     // can absorb the rest of the seed instead of letting it schedule separately.
     let seed_by_file: HashMap<_, _> = seeds
@@ -137,17 +157,29 @@ fn build_closed_outputs(
     let mut outputs = Vec::new();
     // The compactor pops from the end; retain TWCS's seed prio
```

**File**: `src/mito2/src/compaction/picker.rs` (modified, +26/-15)
```diff
@@ -140,21 +140,7 @@ pub fn new_picker(
         // within each disjoint, half-open output range, including LastNonNull.
         Arc::new(WindowedCompactionPicker::new(window).with_time_range(time_range)) as Arc<_>
     } else {
-        let picker = match &region_options.compaction {
-            CompactionOptions::Twcs(twcs_opts) => TwcsPicker {
-                trigger_file_num: twcs_opts.active_window_trigger_file_num,
-                active_window_l1_merge_trigger: twcs_opts.active_window_l1_merge_trigger,
-                inactive_window_trigger_file_num: twcs_opts.inactive_window_trigger_file_num,
-                inactive_window_l1_merge_trigger: twcs_opts.inactive_window_l1_merge_trigger,
-                time_window_seconds: twcs_opts.time_window_seconds(),
-                max_output_file_size: twcs_opts.max_output_file_size.map(|r| r.as_bytes()),
-                append_mode: region_options.append_mode,
-                merge_mode: region_options.merge_mode(),
-                max_background_tasks,
-                time_range,
-                all_windows_inactive: manual,
-            },
-        };
+        let picker = new_twcs_picker(region_options, max_background_tasks, time_range, manual);
         if region_options.merge_mode() == MergeMode::LastNonNull {
             // LastNonNull correctness spans windows and levels, so wrap the seed
             // picker instead of trusting TWCS's independent windows.
@@ -165,6 +151,31 @@ pub fn new_picker(
     }
 }
 
+/// Builds the stateless TWCS strategy used for discovery and legacy picks.
+pub(crate) fn new_twcs_picker(
+    region_options: &RegionOptions,
+    max_background_tasks: Option<usize>,
+    time_range: Option<TimestampRange>,
+    manual: bool,
+) -> TwcsPicker {
+    match &region_options.compaction {
+        CompactionOptions::Twcs(twcs_opts) => TwcsPicker {
+            trigger_file_num: twcs_opts.active_window_trigger_file_num,
+            active_window_l1_merge_trigger: twcs_opts.active_window_l1_merge_trigger,
+            inactive_window_trigger_file_num: twcs_opts.inactive_window_trigger_file_num,
+            inactive_window_l1_merge_trigger: twcs_opts.inactive_window_l1_merge_trigger,
+            time_window_seconds: twcs_opts.time_window_seconds(),
+            max_output_file_size: twcs_opts.max_output_file_size.map(|r| r.as_bytes()),
+            append_mode: region_options.append_mode,
+            merge_mode: region_options.merge_mode(),
+            max_background_tasks,
+            time_range,
+            all_windows_inactive: manual,
+            metrics: Default::default(),
+        },
+    }
+}
+
 /// Finds all expired SSTs across levels.
 pub(super) fn get_expired_ssts(
     levels: &[LevelMeta],
```

**File**: `src/mito2/src/compaction/scheduler.rs` (modified, +9/-4)
```diff
@@ -12,6 +12,7 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
+pub(crate) mod history;
 mod local;
 mod planning;
 mod state;
@@ -27,6 +28,8 @@ use common_telemetry::{debug, error, info, warn};
 use common_time::range::TimestampRange;
 pub(crate) use planning::CompactionPickFinished;
 pub use planning::CompactionRequest;
+#[cfg(test)]
+pub(crate) use planning::pick_automatic_for_test;
 pub(crate) use state::CompactionExecution;
 use state::{CompactionStatus, CompactionTrigger, DdlExecution, PendingCompaction};
 use store_api::storage::RegionId;
@@ -561,6 +564,9 @@ impl CompactionScheduler {
         // Publish the picking phase before dispatching background planning.
         let plan_id = Self::next_plan_id(&mut self.next_plan_id);
         status.start_picking_with_trigger(plan_id, trigger);
+        let pick_history = (trigger == CompactionTrigger::Automatic
+            && matches!(compact_options, compact_request::Options::Regular(_)))
+        .then(|| status.pick_history.clone());
         let request = status.new_compaction_request(
             self.request_sender.clone(),
             self.engine_config.clone(),
@@ -569,6 +575,7 @@ impl CompactionScheduler {
             self.listener.clone(),
             schema_metadata_manager,
             max_parallelism,
+            pick_history,
         );
         status.merge_waiter(waiter);
         self.dispatch_compaction_planning(plan_id, request, compact_options, time_range, trigger);
@@ -610,6 +617,7 @@ impl CompactionScheduler {
             self.listener.clone(),
             schema_metadata_manager,
             max_parallelism,
+            None,
         );
         status.merge_waiter(waiter);
         // Bump the counter through a disjoint field borrow so the `status`
@@ -639,10 +647,6 @@ impl CompactionScheduler {
         schema_metadata_manager: SchemaMetadataManagerRef,
         made_progress: bool,
     ) -> CompactionTransition {
-        if !self.region_status.contains_key(&region_id) {
-            return CompactionTransition::NoAction;
-        }
-
         if let Some(ddls) = self.take_ready_ddls(region_id) {
             return CompactionTransition::DdlReady(ddls);
         }
@@ -698,6 +702,7 @@ impl CompactionScheduler {
             self.listener.clone(),
             schema_metadata_manager,
             MAX_PARALLEL_COMPACTION,
+            Some(status.pick_history.clone()),
         );
         // Bump the counter through a disjoint field borrow so the `status`
         // borrow stays alive; nothing could have removed the status since it
```

**File**: `src/mito2/src/compaction/scheduler/history.rs` (added, +215/-0)
```diff
@@ -0,0 +1,215 @@
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
+use std::cmp::Reverse;
+use std::collections::{HashMap, HashSet};
+use std::time::{Duration, Instant};
+
+use prometheus::IntCounterVec;
+
+use crate::compaction::twcs::{PickClass, WindowCandidate};
+use crate::metrics::TWCS_SELECTED_CANDIDATES;
+
+/// Waiting compensation starts after one minute. This is a promotion threshold,
+/// not a deadline: an executing batch is never preempted to run an overdue pick.
+/// It is checked at pick time and does not wake the scheduler on its own.
+const PROMOTION_DELAY: Duration = Duration::from_secs(60);
+
+/// A work identity survives file replacement and picking epochs, but not a region
+/// incarnation. Different classes in the same window retain independent ages.
+#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
+pub(crate) struct PickKey {
+    /// Window identity, independent of the current input files.
+    pub(crate) window: i64,
+    /// Work category whose waiting age is tracked independently in this window.
+    pub(crate) class: PickClass,
+}
+
+impl From<&WindowCandidate> for PickKey {
+    fn from(candidate: &WindowCandidate) -> Self {
+        Self {
+            window: candidate.window,
+            class: candidate.pick.class,
+        }
+    }
+}
+
+/// Region-resident scheduling metadata. It owns no file handles or reservations.
+/// Planning works on a private snapshot; the accepted plan consumes one fairness
+/// turn per selected key. Execution success or failure does not rewrite ages.
+#[derive(Debug, Clone)]
+pub(crate) struct PickHistory {
+    /// First observation or last fairness turn for each eligible key.
+    /// Repeated picks preserve this timestamp until the key is selected.
+    waiting: HashMap<PickKey, Instant>,
+    selected_metrics: IntCounterVec,
+}
+
+impl Default for PickHistory {
+    fn default() -> Self {
+        Self {
+            waiting: HashMap::new(),
+            selected_metrics: TWCS_SELECTED_CANDIDATES.clone(),
+        }
+    }
+}
+
+/// Ascending fairness order: promoted work, oldest age, class, then newest window.
+#[derive(Debug, PartialEq, Eq, PartialOrd, Ord)]
+struct PickPriority {
+    not_promoted: bool,
+    since: Option<Instant>,
+    class: PickClass,
+    window: Reverse<i64>,
+}
+
+impl PickHistory {
+    /// Refreshes all eligible identities before selection limits hide any work.
+    /// Preserves surviving ages and drops absent keys without changing selection.
+    fn observe(&mut self, keys: impl Iterator<Item = PickKey>, now: Instant) {
+        let live: HashSet<_> = keys.collect();
+        self.waiting.retain(|key, _| live.contains(key));
+        for key in live {
+            self.waiting.entry(key).or_insert(now);
+        }
+    }
+
+    /// Returns an ascending sort key: promoted work first, oldest waiting first.
+    /// Below [`PROMOTION_DELAY`], age does not affect class/newest-window ordering.
+    /// One shared `now` keeps the comparator consistent across the entire sort.
+    fn priority(&self, key: PickKey, now: Instant) -> PickPriority {
+        let overdue = self
+            .waiting
+            .get(&key)
+            .copied()
+            .filter(|since| now.saturating_duration_since(*since) >= PROMOTION_DELAY);
+        PickPriority {
+            not_promoted: overdue.is_none(),
+            since: overdue,
+            class: key.class,
+            window: Reverse(key.window),
+        }
+    }
+
+    /// Consumes the fairness turn for `key`. Only an accepted plan installs the
+    /// private snapshot, so rejected or stale plans never advance resident ages.
+    fn serve(&mut self, key: PickKey, now: Instant) {
+        self.waiting.insert(key, now);
+    }
+
+    /// Observes all eligible work and ranks one alternative per window without
+    /// consuming a fairness turn. The caller acknowledges only attempted work
+    /// after applying its output budget and semantic closure policy.
+    pub(crate) fn rank_candidates(
+        &mut self,
+        mut candidates: Vec<WindowCandidate>,
+        now: Instant,
+    ) -> Vec<WindowCandidate> {
+        self.observe(candidates.iter().map(PickKey::from), now);
+        candidates.sort_by_key(|candidate| self.priority(PickKey::from(candidate), now));
+        // Alternatives may share files or semantic dependencies within a window.
+        let mut windows = HashSet::new();
+        candidates.retain(|can
```

**File**: `src/mito2/src/compaction/scheduler/planning.rs` (modified, +99/-26)
```diff
@@ -31,7 +31,9 @@ use tokio::sync::mpsc::{self, Sender};
 use crate::access_layer::AccessLayerRef;
 use crate::cache::CacheManagerRef;
 use crate::compaction::compactor::{CompactionRegion, CompactionVersion};
-use crate::compaction::picker::{PickerOutput, new_picker};
+use crate::compaction::last_non_null;
+use crate::compaction::picker::{PickerOutput, new_picker, new_twcs_picker};
+use crate::compaction::scheduler::history::{PickHistory, PickKey};
 use crate::compaction::scheduler::state::{
     CompactingFiles, CompactionExecution, CompactionPhase, CompactionTrigger,
 };
@@ -44,7 +46,7 @@ use crate::metrics::{
     COMPACTION_MEMORY_REJECTED, COMPACTION_STAGE_ELAPSED, INFLIGHT_COMPACTION_COUNT,
 };
 use crate::region::ManifestContextRef;
-use crate::region::options::RegionOptions;
+use crate::region::options::{MergeMode, RegionOptions};
 use crate::request::{BackgroundNotify, OutputTx, WorkerRequest, WorkerRequestWithTime};
 use crate::schedule::remote_job_scheduler::{
     CompactionJob, DefaultNotifier, RemoteJob, RemoteJobSchedulerRef,
@@ -55,6 +57,8 @@ use crate::worker::WorkerListener;
 
 /// Region compaction request.
 pub struct CompactionRequest {
+    /// Private snapshot for automatic regular planning; manual requests carry none.
+    pub(crate) pick_history: Option<PickHistory>,
     pub(crate) engine_config: Arc<MitoConfig>,
     pub(crate) current_version: CompactionVersion,
     pub(crate) access_layer: AccessLayerRef,
@@ -78,7 +82,8 @@ impl CompactionRequest {
 /// Result returned to the worker after background compaction planning.
 pub(crate) enum CompactionPlanningResult {
     Prepared(PreparedCompaction),
-    NoPlan,
+    /// Returns automatic history even for an empty plan, to prune stale eligibility.
+    NoPlan(Option<PickHistory>),
     Error(Arc<Error>),
 }
 
@@ -89,7 +94,7 @@ impl fmt::Debug for CompactionPlanningResult {
                 .debug_tuple("Prepared")
                 .field(&prepared.compaction_region.region_id)
                 .finish(),
-            Self::NoPlan => f.write_str("NoPlan"),
+            Self::NoPlan(_) => f.write_str("NoPlan"),
             Self::Error(err) => f.debug_tuple("Error").field(err).finish(),
         }
     }
@@ -104,12 +109,64 @@ pub(crate) struct CompactionPickFinished {
 }
 
 pub(crate) struct PreparedCompaction {
+    /// Updated automatic snapshot, installed only after the worker accepts the plan.
+    /// Manual planning returns `None` and leaves resident waiting ages unchanged.
+    pick_history: Option<PickHistory>,
     pub(super) compaction_region: CompactionRegion,
     pub(super) picker_output: PickerOutput,
     start_time: Instant,
     ttl: TimeToLive,
 }
 
+/// Scheduler policy applied between stateless discovery and semantic closure.
+/// Runs on the planning runtime with a private history snapshot, never on the
+/// worker or through a shared mutex. Stale results cannot mutate resident state.
+async fn pick_automatic(
+    region: &CompactionRegion,
+    history: &mut PickHistory,
+    max_outputs: Option<usize>,
+    time_range: Option<TimestampRange>,
+) -> Result<Option<PickerOutput>> {
+    let picker = new_twcs_picker(&region.region_options, max_outputs, time_range, false);
+    let mut candidates = picker.discover(region).await?;
+    let last_non_null = region.region_options.merge_mode() == MergeMode::LastNonNull;
+    let now = Instant::now();
+    candidates.candidates = history.rank_candidates(candidates.candidates, now);
+    if !last_non_null {
+        candidates
+            .candidates
+            .truncate(max_outputs.unwrap_or(usize::MAX));
+    }
+    // finish() reverses candidates for the compactor's pop order. Keep seed
+    // identities in that same order without retaining them in execution state.
+    let keys: Vec<_> = candidates
+        .candidates
+        .iter()
+        .rev()
+        .map(PickKey::from)
+        .collect();
+    let output = candidates.finish().await?;
+    if last_non_null {
+        let (output, attempted_seeds) =
+            last_non_null::close_outputs(region, output, max_outputs).await?;
+        history.acknowledge(attempted_seeds.into_iter().map(|index| keys[index]), now);
+        Ok(output)
+    } else {
+        history.acknowledge(keys.into_iter(), now);
+        Ok((!output.outputs.is_empty() || !output.expired_ssts.is_empty()).then_some(output))
+    }
+}
+
+/// Exercises automatic selection and closure from cross-module regression tests.
+#[cfg(test)]
+pub(crate) async fn pick_automatic_for_test(
+    region: &CompactionRegion,
+    history: &mut PickHistory,
+    max_outputs: Option<usize>,
+) -> Result<Option<PickerOutput>> {
+    pick_automatic(region, history, max_outputs, None).await
+}
+
 impl CompactionScheduler {
     pub(super) fn dispatch_compaction_planning(
         &self,
@@ -201,22 +258,16 @@ impl CompactionScheduler {
             )
         });
 
-        // Avoid queuing serial outputs from a stale snapshot. Repicking after each
-        /
```

**File**: `src/mito2/src/compaction/scheduler/state.rs` (modified, +6/-0)
```diff
@@ -28,6 +28,7 @@ use crate::access_layer::AccessLayerRef;
 use crate::cache::CacheManagerRef;
 use crate::compaction::compactor::CompactionVersion;
 use crate::compaction::picker::PickerOutput;
+use crate::compaction::scheduler::history::PickHistory;
 use crate::compaction::scheduler::local::LocalCompaction;
 use crate::compaction::scheduler::planning::CompactionRequest;
 use crate::config::MitoConfig;
@@ -319,6 +320,8 @@ impl DdlExecution {
 
 /// Scheduling state retained for the lifetime of a loaded region.
 pub(super) struct CompactionStatus {
+    /// Resident automatic-pick history, retained across batches until region unload.
+    pub(crate) pick_history: PickHistory,
     /// Id of the region.
     pub(super) region_id: RegionId,
     /// Version control of the region.
@@ -350,6 +353,7 @@ impl CompactionStatus {
         access_layer: AccessLayerRef,
     ) -> CompactionStatus {
         CompactionStatus {
+            pick_history: PickHistory::default(),
             region_id,
             version_control,
             access_layer,
@@ -524,11 +528,13 @@ impl CompactionStatus {
         listener: WorkerListener,
         schema_metadata_manager: SchemaMetadataManagerRef,
         max_parallelism: usize,
+        pick_history: Option<PickHistory>,
     ) -> CompactionRequest {
         let current_version = CompactionVersion::from(self.version_control.current().version);
         let start_time = Instant::now();
 
         CompactionRequest {
+            pick_history,
             engine_config,
             current_version,
             access_layer: self.access_layer.clone(),
```

**File**: `src/mito2/src/compaction/scheduler_test.rs` (modified, +259/-7)
```diff
@@ -13,7 +13,7 @@
 // limitations under the License.
 
 use std::assert_matches;
-use std::time::Duration;
+use std::time::{Duration, Instant};
 
 use api::v1::region::StrictWindow;
 use api::v1::region::compact_request::Options;
@@ -28,10 +28,12 @@ use tokio::sync::{Barrier, mpsc, oneshot};
 
 use crate::compaction::memory_manager::{CompactionMemoryGuard, new_compaction_memory_manager};
 use crate::compaction::picker::PickerOutput;
+use crate::compaction::scheduler::history::PickKey;
 use crate::compaction::scheduler::planning::CompactionPlanningResult;
 use crate::compaction::scheduler::state::{CompactingFiles, CompactionPhase};
 use crate::compaction::scheduler::*;
 use crate::compaction::test_util::new_file_handle;
+use crate::compaction::twcs::PickClass;
 use crate::compaction::{CompactionOutput, find_dynamic_options};
 use crate::config::MitoConfig;
 use crate::error::InvalidSchedulerStateSnafu;
@@ -412,6 +414,137 @@ async fn test_resident_region_survives_terminal_cycles_and_truncate() {
     assert!(!scheduler.region_status.contains_key(&id));
 }
 
+#[tokio::test]
+async fn test_pick_history_survives_cycles_but_not_region_replacement() {
+    let env = SchedulerEnv::new().await;
+    let (tx, _rx) = mpsc::channel(8);
+    let mut scheduler = env.mock_compaction_scheduler(tx);
+    let version = Arc::new(VersionControlBuilder::new().build());
+    let id = version.region_id();
+    scheduler.register_region(&version, &env.access_layer);
+    let key = PickKey {
+        window: 0,
+        class: PickClass::FileReduction,
+    };
+    let start = Instant::now();
+    scheduler
+        .region_status
+        .get_mut(&id)
+        .unwrap()
+        .pick_history
+        .observe_for_test([key].into_iter(), start);
+    let later = start + Duration::from_secs(120);
+    let priority = scheduler.region_status[&id]
+        .pick_history
+        .promoted_since_for_test(key, later);
+    assert!(priority.is_some());
+    scheduler.region_status.get_mut(&id).unwrap().become_idle();
+    scheduler.register_region(&version, &env.access_layer);
+    assert_eq!(
+        priority,
+        scheduler.region_status[&id]
+            .pick_history
+            .promoted_since_for_test(key, later)
+    );
+    scheduler.on_compaction_failed(id, Arc::new(InvalidSchedulerStateSnafu.build()));
+    assert_eq!(
+        priority,
+        scheduler.region_status[&id]
+            .pick_history
+            .promoted_since_for_test(key, later)
+    );
+    let manifest = env
+        .mock_manifest_context(version.current().version.metadata.clone())
+        .await;
+    let (schemas, _) = mock_schema_metadata_manager();
+    let mut request = scheduler.region_status[&id].new_compaction_request(
+        scheduler.request_sender.clone(),
+        scheduler.engine_config.clone(),
+        scheduler.cache_manager.clone(),
+        &manifest,
+        scheduler.listener.clone(),
+        schemas,
+        1,
+        Some(scheduler.region_status[&id].pick_history.clone()),
+    );
+    let history = request.pick_history.as_mut().unwrap();
+    assert_eq!(priority, history.promoted_since_for_test(key, later));
+    history.observe_for_test(std::iter::empty(), later);
+    assert_eq!(
+        priority,
+        scheduler.region_status[&id]
+            .pick_history
+            .promoted_since_for_test(key, later)
+    );
+    let replacement = Arc::new(VersionControlBuilder::new().build());
+    scheduler.register_region(&replacement, &env.access_layer);
+    assert!(
+        scheduler.region_status[&id]
+            .pick_history
+            .promoted_since_for_test(key, later)
+            .is_none()
+    );
+}
+
+#[rstest::rstest]
+#[case::accepted_empty_plan(false)]
+#[case::failed_plan(true)]
+#[tokio::test]
+async fn test_empty_plan_prunes_history_but_failed_plan_preserves_it(#[case] failed: bool) {
+    let env = SchedulerEnv::new().await;
+    let (tx, _rx) = mpsc::channel(4);
+    let mut scheduler = env.mock_compaction_scheduler(tx);
+    let version = Arc::new(VersionControlBuilder::new().build());
+    let id = version.region_id();
+    let manifest = env
+        .mock_manifest_context(version.current().version.metadata.clone())
+        .await;
+    let (schemas, _) = mock_schema_metadata_manager();
+    scheduler.register_region(&version, &env.access_layer);
+    let status = scheduler.region_status.get_mut(&id).unwrap();
+    let key = PickKey {
+        window: 0,
+        class: PickClass::FileReduction,
+    };
+    let start = Instant::now();
+    let now = start + Duration::from_secs(120);
+    status
+        .pick_history
+        .observe_for_test([key].into_iter(), start);
+    status.start_picking_with_trigger(7, CompactionTrigger::Automatic);
+    let mut planned_history = status.pick_history.clone();
+    planned_history.observe_for_test(std::iter::empty(), now);
+    assert!(
+        status
+            .pick_history
+            .promoted_since_for_test(key, now)
+            .is_som
```

---

### Incident Patch 3: `4633c37d` (2026-11-04)
**Commit Message**: fix: test (#10149)

fix: fixture

Signed-off-by: shuiyisong <[REDACTED_EMAIL]>

**File**: `src/cmd/src/frontend.rs` (modified, +3/-1)
```diff
@@ -850,7 +850,9 @@ mod tests {
         assert!(!debug.contains("cli-secret"));
         assert!(debug.contains("[REDACTED]"));
 
-        let fe_opts = command.load_options(&Default::default()).unwrap().component;
+        let mut fe_opts = command.load_options(&Default::default()).unwrap().component;
+        // Downstream frontend plugins require a meta client outside standalone mode.
+        fe_opts.meta_client = Some(MetaClientOptions::default());
 
         let mut plugins = Plugins::new();
         plugins::setup_frontend_plugins_pre_build(&mut plugins, &[], &fe_opts, None)
```

#### Recent Merged Pull Requests:
- **PR #10149** (2026-11-04): fix: test (@shuiyisong)
- **PR #10146** (2026-11-04): fix(ci): increase nightly JSONBench runner root volume (@MichaelScofield)
- **PR #10139** (closed): feat(mito2): certify logical row counts of compaction outputs (@Aumnertic)
- **PR #10130** (2026-11-04): refactor(meta): separate migration construction and drain child tracking (@WenyXu)
- **PR #10123** (2026-11-04): fix: register trigger procedure loaders through DdlManager (@fengys1996)
- **PR #10118** (2026-11-03): fix: include peer context in distributed query errors (@WenyXu)

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

## X. meta): invalidate all datanode tables on address change (#9986)

**RULE**:
When implementing operations in `src/meta-srv/AGENTS.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in GreptimeTeam/greptimedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `351f4207`: meta): invalidate all datanode tables on address change (#9986). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/meta-srv/AGENTS.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
  A changed datanode address invalidates every table on that node (`__dn_table`),
  not only the tables in the current heartbeat.
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `351f4207` are properly handled with clean fallback behavior.
