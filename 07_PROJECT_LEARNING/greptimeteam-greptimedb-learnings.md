> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/greptimeteam-greptimedb-learnings.md`  
> **Source**: github ([https://github.com/GreptimeTeam/greptimedb](https://github.com/GreptimeTeam/greptimedb))  
> **Source Version**: `8e167104`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-28T16:58:58.864Z  
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
> **Harvest Timestamp**: 2026-10-28T16:58:58.859Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GreptimeTeam/greptimedb`
- **Description**: The open-source observability database. One columnar engine for metrics, logs, and traces, on object storage.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6769 stars

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
- **Issue #10040** (2026-10-28): **ci: enqueue eligible pull requests during the nightly window**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  None.  ## What's changed and what's your intention?  Shift automatic merge-queue admission to the nightly window to reduce competition with daytime PR CI. The PR template defaults to a checked nightly-merge option; creating or editing a PR synchronizes the `merge nightly` label, and unchecking removes it.  Run hourly from 02:10 through 08:10 Beijing time (UTC+8), enqueueing at most five eligible PRs per run, oldest first. Only open, non-draft PRs targeting `main` with approval, a clean merge status, and all review threads resolved are eligible. Recheck the current checkbox and labels and supply the expected head SHA when enqueueing. Leave existing queue entries and manually enabled auto-merge untouched so maintainers can use **Merge when ready** earlier.  Add a manual dry-run option, setup documentation, and mocked workflow-script tests wired into the existing GitHub Script Tests job. Before rollout, create the label and verify the existing automation token can enqueue PRs. Conversation-resolution protection is already enabled according to the maintainer. Actual GitHub permissions and runner savings have not been validated.  Validation passed: actionlint for the changed workflows, the existing and new Node test files, and `git diff --check`. The new tests cover checkbox synchronization, eligibility gates, paginated 

- **Issue #10034** (2026-10-28): **fix(log-store): accept a retried first create of the conditional create probe**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  Follow-up to #9909.  ## What's changed and what's your intention?  **Problem.** The conditional create probe that #9909 added to the object store WAL wrote its first create by hand and failed the open on any error. The object store sits behind a retry layer. When that first create is stored but its response is lost, for example to a timeout, the retry layer repeats it and the repeat finds the object, so the probe reports a failed write and the WAL refuses to open. A restart uses a new key and usually passes, but the startup failure is spurious.  **Fix.** `put_if_absent` already handles this case: when a create fails, it reads the object back and accepts identical content. Its body moves unchanged into a private path-based core, `put_path_if_absent`, which both `put_if_absent` and the probe's first create now call. The probe treats `Created` and `AlreadyPresent` alike for the first create. The second create, which the store must refuse, and the delete are unchanged, so a store that ignores the condition is still refused. `put_if_absent` keeps its behaviour and errors.  **Tests.** A new test wraps the store so that the probe's first create is stored and then reported as `ConditionNotMatch`, as its retry would see it, and asserts that the store opens and only the start object remains. It fails without the fix. The exis

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

### Incident Patch 1: `180e2716` (2026-10-28)
**Commit Message**: fix(log-store): make raft-engine periodic WAL sync actually fsync (#9715)

* fix(log-store): make raft-engine periodic WAL sync actually fsync

On raft-engine 0.4.2, Engine::sync() writes an empty LogBatch and
write() returns before fsync (tikv/raft-engine#395). The periodic
sync task therefore never durable-flushed acknowledged WAL data.

Work around by writing a minimal non-empty marker with sync=true so
the fsync path is reached until a crates.io release includes
tikv/raft-engine#400.

Fixes #9712

Signed-off-by: Yvan Wang <[REDACTED_EMAIL]>

* perf(log-store): reuse LogBatch across periodic WAL syncs

Keep the periodic sync task's LogBatch across ticks instead of
allocating a fresh one (4 KiB encode buffer plus item vec) every
period. A successful Engine::write drains the batch but retains its
buffers; after a failed write or a panicked blocking task the batch is
discarded and recreated on the next tick, since it may be left
partially encoded.

Keep the marker put rather than deleting an empty key: the put
overwrites a single key, whereas every delete would become a recovery
tombstone that raft-engine keeps in memory while replaying append
files.

Also document that the marker 

**File**: `src/log-store/src/raft_engine/log_store.rs` (modified, +118/-4)
```diff
@@ -82,17 +82,60 @@ impl TaskFunction<Error> for PurgeExpiredFilesFunction {
     }
 }
 
+/// Key used by the periodic WAL sync task. Overwritten each period so the
+/// write stays non-empty on raft-engine 0.4.2 (see [`durable_sync`]).
+const PERIODIC_SYNC_MARKER_KEY: &[u8] = b"$wal_periodic_sync";
+
+/// Force an fsync of previously appended WAL data on raft-engine 0.4.2.
+///
+/// `Engine::sync()` writes an empty [`LogBatch`] with `sync = true`, but
+/// 0.4.2's `Engine::write` returns early for empty batches *before* the
+/// fsync (tikv/raft-engine#395). Upstream fixed this in tikv/raft-engine#400,
+/// which is not on crates.io yet. Issuing a minimal non-empty put with
+/// `sync = true` reaches the fsync path on 0.4.2.
+///
+/// `batch` must be empty and can be reused across calls: a successful
+/// `Engine::write` drains its items but keeps its encoding buffer. On error the
+/// batch may be left partially encoded, so callers must discard it.
+fn durable_sync(engine: &Engine, batch: &mut LogBatch) -> raft_engine::Result<usize> {
+    debug_assert!(batch.is_empty());
+    // The value is unused, but it must not decode as a `NamespaceImpl`: the
+    // marker key sorts after `NAMESPACE_PREFIX`, inside the range scanned by
+    // `list_namespaces`. Overwriting the same key keeps the marker bounded.
+    batch.put(SYSTEM_NAMESPACE, PERIODIC_SYNC_MARKER_KEY.to_vec(), vec![0])?;
+    engine.write(batch, true)
+}
+
 pub struct SyncWalTaskFunction {
     engine: Arc<Engine>,
+    /// Batch reused across ticks to avoid allocating a new one each period.
+    /// `None` after a failed sync; a fresh batch is created on the next tick.
+    batch: Option<LogBatch>,
 }
 
 #[async_trait::async_trait]
 impl TaskFunction<Error> for SyncWalTaskFunction {
     async fn call(&mut self) -> std::result::Result<(), Error> {
         let engine = self.engine.clone();
-        if let Err(e) = tokio::task::spawn_blocking(move || engine.sync()).await {
-            error!(e; "Failed to sync raft engine log files");
-        };
+        let mut batch = self
+            .batch
+            .take()
+            .unwrap_or_else(|| LogBatch::with_capacity(1));
+        match tokio::task::spawn_blocking(move || {
+            let res = durable_sync(&engine, &mut batch);
+            (res, batch)
+        })
+        .await
+        {
+            Ok((Ok(_), batch)) => self.batch = Some(batch),
+            // The batch may be partially encoded after a failed write; drop it.
+            Ok((Err(e), _)) => {
+                error!(e; "Failed to sync raft engine log files");
+            }
+            Err(e) => {
+                error!(e; "Failed to sync raft engine log files");
+            }
+        }
         Ok(())
     }
 
@@ -103,7 +146,10 @@ impl TaskFunction<Error> for SyncWalTaskFunction {
 
 impl SyncWalTaskFunction {
     pub fn new(engine: Arc<Engine>) -> Self {
-        Self { engine }
+        Self {
+            engine,
+            batch: None,
+        }
     }
 }
 
@@ -555,6 +601,74 @@ mod tests {
         assert_eq!(0, namespaces.len());
     }
 
+    /// Regression for #9712: periodic sync must write a non-empty batch so
+    /// raft-engine 0.4.2 actually fsyncs (empty `Engine::sync()` is a no-op).
+    #[tokio::test]
+    async fn test_durable_sync_writes_non_empty_batch() {
+        let dir = create_temp_dir("raft-engine-durable-sync-test");
+        let cfg = Config {
+            dir: dir.path().to_str().unwrap().to_string(),
+            recovery_mode: RecoveryMode::TolerateTailCorruption,
+            ..Default::default()
+        };
+        let engine = Engine::open(cfg).unwrap();
+
+        // Control: empty sync leaves no marker and returns Ok without fsync
+        // on 0.4.2 (we cannot count fsyncs here, but we can show the empty
+        // path writes nothing).
+        engine.sync().unwrap();
+        assert!(
+            engine
+                .get(SYSTEM_NAMESPACE, PERIODIC_SYNC_MARKER_KEY)
+                .is_none(),
+            "Engine::sync must not create the periodic sync marker"
+        );
+
+        let mut batch = LogBatch::with_capacity(1);
+        let written = durable_sync(&engine, &mut batch).unwrap();
+        assert!(written > 0, "durable_sync must write a non-empty batch");
+        assert!(batch.is_empty(), "a successful write drains the batch");
+        assert_eq!(
+            engine
+                .get(SYSTEM_NAMESPACE, PERIODIC_SYNC_MARKER_KEY)
+                .as_deref(),
+            Some(&[0][..]),
+            "durable_sync must persist the periodic sync marker"
+        );
+
+        // Reusing the drained batch overwrites the same key and still writes.
+        let written_again = durable_sync(&engine, &mut batch).unwrap();
+        assert!(written_again > 0);
+        assert!(batch.is_empty());
+    }
+
+    #[tokio::test]
+    async fn test_sync_wal_task_reuses_batch_and_keeps_namespaces() {
+        let dir = create_temp_dir("raft-engine-sync-wal-task-
```

---

### Incident Patch 2: `4135e65a` (2026-10-28)
**Commit Message**: fix(query): keep requested sort when filtering on a lossy cast (#10026)

fix(query): pin DataFusion cast constraint propagation fix

Update the pinned GreptimeTeam/datafusion revision from e3221b8 to
cc55344 (the 55.1 fork carrying apache/datafusion#25531 plus a stronger
regression test).

CastExpr::propagate_constraints used to cast a filter's output interval
straight back to the input type. For CAST(k AS BIGINT) = 1 the singleton
output [1, 1] was inverted to [1.0, 1.0] although k = 1.5 matches too, so
FilterExec advertised k as constant, the equivalence classes dropped the
ordering required by ORDER BY k, and rows returned in scan order.

The sqlness case keeps every #9600 assertion and the explicit ORDER BY,
and adds ascending and descending checks for the partitioned table, the
control table and a table whose matching rows are stored in neither
ascending nor descending k order.

Cargo.lock only rewrites the 35 datafusion source lines.

Signed-off-by: discord9 <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +35/-35)
```diff
@@ -3756,7 +3756,7 @@ checksum = "a4ae5f15dda3c708c0ade84bfee31ccab44a3da4f88015ed22f63732abe300c8"
 [[package]]
 name = "datafusion"
 version = "55.1.0"
-source = "git+https://github.com/GreptimeTeam/datafusion.git?rev=e3221b8f74b15c7192621576e5d1e354a6cf097a#e3221b8f74b15c7192621576e5d1e354a6cf097a"
+source = "git+https://github.com/GreptimeTeam/datafusion.git?rev=cc5534492d5408831395609cdafb6520c7d514b7#cc5534492d5408831395609cdafb6520c7d514b7"
 dependencies = [
  "arrow 59.2.0",
  "arrow-schema 59.2.0",
@@ -3808,7 +3808,7 @@ dependencies = [
 [[package]]
 name = "datafusion-catalog"
 version = "55.1.0"
-source = "git+https://github.com/GreptimeTeam/datafusion.git?rev=e3221b8f74b15c7192621576e5d1e354a6cf097a#e3221b8f74b15c7192621576e5d1e354a6cf097a"
+source = "git+https://github.com/GreptimeTeam/datafusion.git?rev=cc5534492d5408831395609cdafb6520c7d514b7#cc5534492d5408831395609cdafb6520c7d514b7"
 dependencies = [
  "arrow 59.2.0",
  "async-trait",
@@ -3832,7 +3832,7 @@ dependencies = [
 [[package]]
 name = "datafusion-catalog-listing"
 version = "55.1.0"
-source = "git+https://github.com/GreptimeTeam/datafusion.git?rev=e3221b8f74b15c7192621576e5d1e354a6cf097a#e3221b8f74b15c7192621576e5d1e354a6cf097a"
+source = "git+https://github.com/GreptimeTeam/datafusion.git?rev=cc5534492d5408831395609cdafb6520c7d514b7#cc5534492d5408831395609cdafb6520c7d514b7"
 dependencies = [
  "arrow 59.2.0",
  "async-trait",
@@ -3855,7 +3855,7 @@ dependencies = [
 [[package]]
 name = "datafusion-common"
 version = "55.1.0"
-source = "git+https://github.com/GreptimeTeam/datafusion.git?rev=e3221b8f74b15c7192621576e5d1e354a6cf097a#e3221b8f74b15c7192621576e5d1e354a6cf097a"
+source = "git+https://github.com/GreptimeTeam/datafusion.git?rev=cc5534492d5408831395609cdafb6520c7d514b7#cc5534492d5408831395609cdafb6520c7d514b7"
 dependencies = [
  "arrow 59.2.0",
  "arrow-ipc 59.2.0",
@@ -3881,7 +3881,7 @@ dependencies = [
 [[package]]
 name = "datafusion-common-runtime"
 version = "55.1.0"
-source = "git+https://github.com/GreptimeTeam/datafusion.git?rev=e3221b8f74b15c7192621576e5d1e354a6cf097a#e3221b8f74b15c7192621576e5d1e354a6cf097a"
+source = "git+https://github.com/GreptimeTeam/datafusion.git?rev=cc5534492d5408831395609cdafb6520c7d514b7#cc5534492d5408831395609cdafb6520c7d514b7"
 dependencies = [
  "futures",
  "log",
@@ -3891,7 +3891,7 @@ dependencies = [
 [[package]]
 name = "datafusion-datasource"
 version = "55.1.0"
-source = "git+https://github.com/GreptimeTeam/datafusion.git?rev=e3221b8f74b15c7192621576e5d1e354a6cf097a#e3221b8f74b15c7192621576e5d1e354a6cf097a"
+source = "git+https://github.com/GreptimeTeam/datafusion.git?rev=cc5534492d5408831395609cdafb6520c7d514b7#cc5534492d5408831395609cdafb6520c7d514b7"
 dependencies = [
  "arrow 59.2.0",
  "async-compression",
@@ -3927,7 +3927,7 @@ dependencies = [
 [[package]]
 name = "datafusion-datasource-arrow"
 version = "55.1.0"
-source = "git+https://github.com/GreptimeTeam/datafusion.git?rev=e3221b8f74b15c7192621576e5d1e354a6cf097a#e3221b8f74b15c7192621576e5d1e354a6cf097a"
+source = "git+https://github.com/GreptimeTeam/datafusion.git?rev=cc5534492d5408831395609cdafb6520c7d514b7#cc5534492d5408831395609cdafb6520c7d514b7"
 dependencies = [
  "arrow 59.2.0",
  "arrow-ipc 59.2.0",
@@ -3951,7 +3951,7 @@ dependencies = [
 [[package]]
 name = "datafusion-datasource-csv"
 version = "55.1.0"
-source = "git+https://github.com/GreptimeTeam/datafusion.git?rev=e3221b8f74b15c7192621576e5d1e354a6cf097a#e3221b8f74b15c7192621576e5d1e354a6cf097a"
+source = "git+https://github.com/GreptimeTeam/datafusion.git?rev=cc5534492d5408831395609cdafb6520c7d514b7#cc5534492d5408831395609cdafb6520c7d514b7"
 dependencies = [
  "arrow 59.2.0",
  "async-trait",
@@ -3974,7 +3974,7 @@ dependencies = [
 [[package]]
 name = "datafusion-datasource-json"
 version = "55.1.0"
-source = "git+https://github.com/GreptimeTeam/datafusion.git?rev=e3221b8f74b15c7192621576e5d1e354a6cf097a#e3221b8f74b15c7192621576e5d1e354a6cf097a"
+source = "git+https://github.com/GreptimeTeam/datafusion.git?rev=cc5534492d5408831395609cdafb6520c7d514b7#cc5534492d5408831395609cdafb6520c7d514b7"
 dependencies = [
  "arrow 59.2.0",
  "async-trait",
@@ -3997,7 +3997,7 @@ dependencies = [
 [[package]]
 name = "datafusion-datasource-parquet"
 version = "55.1.0"
-source = "git+https://github.com/GreptimeTeam/datafusion.git?rev=e3221b8f74b15c7192621576e5d1e354a6cf097a#e3221b8f74b15c7192621576e5d1e354a6cf097a"
+source = "git+https://github.com/GreptimeTeam/datafusion.git?rev=cc5534492d5408831395609cdafb6520c7d514b7#cc5534492d5408831395609cdafb6520c7d514b7"
 dependencies = [
  "arrow 59.2.0",
  "arrow-schema 59.2.0",
@@ -4029,12 +4029,12 @@ dependencies = [
 [[package]]
 name = "datafusion-doc"
 version = "55.1.0"
-source = "git+https://github.com/GreptimeTeam/datafusion.git?rev=e3221b8f74b15c7192621576e5d1e354a6cf097a#e3221b8f74b15c7192621576e5d1e354a6cf097a"
+source = "git+https://github.com/GreptimeTeam/datafusion.git?rev=cc5534492d5408831395609cdafb6520c7d514b7#c
```

**File**: `Cargo.toml` (modified, +16/-16)
```diff
@@ -367,22 +367,22 @@ rev = "f743c3a5fe8c1f57363eac5866c356b7d91f9b39"
 
 [patch.crates-io]
 substrait = { git = "https://github.com/GreptimeTeam/substrait-rs.git", rev = "91ec978b0649417ad3da8390e7a515baec723b1b" }
-datafusion = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "e3221b8f74b15c7192621576e5d1e354a6cf097a" }
-datafusion-common = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "e3221b8f74b15c7192621576e5d1e354a6cf097a" }
-datafusion-datasource = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "e3221b8f74b15c7192621576e5d1e354a6cf097a" }
-datafusion-execution = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "e3221b8f74b15c7192621576e5d1e354a6cf097a" }
-datafusion-expr = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "e3221b8f74b15c7192621576e5d1e354a6cf097a" }
-datafusion-expr-common = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "e3221b8f74b15c7192621576e5d1e354a6cf097a" }
-datafusion-functions = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "e3221b8f74b15c7192621576e5d1e354a6cf097a" }
-datafusion-functions-aggregate-common = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "e3221b8f74b15c7192621576e5d1e354a6cf097a" }
-datafusion-functions-window-common = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "e3221b8f74b15c7192621576e5d1e354a6cf097a" }
-datafusion-optimizer = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "e3221b8f74b15c7192621576e5d1e354a6cf097a" }
-datafusion-physical-expr = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "e3221b8f74b15c7192621576e5d1e354a6cf097a" }
-datafusion-physical-expr-common = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "e3221b8f74b15c7192621576e5d1e354a6cf097a" }
-datafusion-physical-plan = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "e3221b8f74b15c7192621576e5d1e354a6cf097a" }
-datafusion-proto = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "e3221b8f74b15c7192621576e5d1e354a6cf097a" }
-datafusion-sql = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "e3221b8f74b15c7192621576e5d1e354a6cf097a" }
-datafusion-substrait = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "e3221b8f74b15c7192621576e5d1e354a6cf097a" }
+datafusion = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "cc5534492d5408831395609cdafb6520c7d514b7" }
+datafusion-common = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "cc5534492d5408831395609cdafb6520c7d514b7" }
+datafusion-datasource = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "cc5534492d5408831395609cdafb6520c7d514b7" }
+datafusion-execution = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "cc5534492d5408831395609cdafb6520c7d514b7" }
+datafusion-expr = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "cc5534492d5408831395609cdafb6520c7d514b7" }
+datafusion-expr-common = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "cc5534492d5408831395609cdafb6520c7d514b7" }
+datafusion-functions = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "cc5534492d5408831395609cdafb6520c7d514b7" }
+datafusion-functions-aggregate-common = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "cc5534492d5408831395609cdafb6520c7d514b7" }
+datafusion-functions-window-common = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "cc5534492d5408831395609cdafb6520c7d514b7" }
+datafusion-optimizer = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "cc5534492d5408831395609cdafb6520c7d514b7" }
+datafusion-physical-expr = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "cc5534492d5408831395609cdafb6520c7d514b7" }
+datafusion-physical-expr-common = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "cc5534492d5408831395609cdafb6520c7d514b7" }
+datafusion-physical-plan = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "cc5534492d5408831395609cdafb6520c7d514b7" }
+datafusion-proto = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "cc5534492d5408831395609cdafb6520c7d514b7" }
+datafusion-sql = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "cc5534492d5408831395609cdafb6520c7d514b7" }
+datafusion-substrait = { git = "https://github.com/GreptimeTeam/datafusion.git", rev = "cc5534492d5408831395609cdafb6520c7d514b7" }
 datafusion-pg-catalog = { git = "https://github.com/datafusion-contrib/datafusion-postgres.git", rev = "3ae0a6cb30b1c5131687f4637247ff4f84ac11e4" }
 arrow-pg = { git = "https://github.com/datafusion-contrib/datafusion-postgres.git", rev = "3ae0a6cb30b1c5131687f4637247ff4f84ac11e4" }
 sqlparser = { git = "https://github.com/GreptimeTeam/sqlparser-rs.git", rev = "9e9019bb1c7040ed956f654e39378dd42ab17884" }
```

**File**: `tests/cases/distributed/optimizer/partition_pruning_cast.result` (modified, +74/-0)
```diff
@@ -97,6 +97,80 @@ ORDER BY k;
 | 1970-01-01T00:00:01 | 1.5 | 15 | 1      |
 +---------------------+-----+----+--------+
 
+-- The same rows must also come back in descending order: a filter on a lossy
+-- cast must not turn `k` into a constant and drop the requested sort.
+SELECT ts, k, v, CAST(k AS BIGINT) AS cast_k
+FROM partition_pruning_cast_partitioned
+WHERE CAST(k AS BIGINT) = 1
+ORDER BY k DESC;
+
++---------------------+-----+----+--------+
+| ts                  | k   | v  | cast_k |
++---------------------+-----+----+--------+
+| 1970-01-01T00:00:01 | 1.5 | 15 | 1      |
+| 1970-01-01T00:00:01 | 1.0 | 10 | 1      |
++---------------------+-----+----+--------+
+
+SELECT ts, k, v, CAST(k AS BIGINT) AS cast_k
+FROM partition_pruning_cast_control
+WHERE CAST(k AS BIGINT) = 1
+ORDER BY k DESC;
+
++---------------------+-----+----+--------+
+| ts                  | k   | v  | cast_k |
++---------------------+-----+----+--------+
+| 1970-01-01T00:00:01 | 1.5 | 15 | 1      |
+| 1970-01-01T00:00:01 | 1.0 | 10 | 1      |
++---------------------+-----+----+--------+
+
+-- A table whose matching rows are stored in neither ascending nor descending
+-- order, so a dropped sort cannot accidentally satisfy the ASC assertion.
+CREATE TABLE partition_pruning_cast_unsorted (
+    ts TIMESTAMP TIME INDEX,
+    k FLOAT PRIMARY KEY,
+    v BIGINT,
+);
+
+Affected Rows: 0
+
+INSERT INTO partition_pruning_cast_unsorted VALUES
+    (1000, 1.5, 15),
+    (1000, 2.5, 25),
+    (1000, 1.0, 10),
+    (1000, 1.25, 12);
+
+Affected Rows: 4
+
+SELECT ts, k, v, CAST(k AS BIGINT) AS cast_k
+FROM partition_pruning_cast_unsorted
+WHERE CAST(k AS BIGINT) = 1
+ORDER BY k;
+
++---------------------+------+----+--------+
+| ts                  | k    | v  | cast_k |
++---------------------+------+----+--------+
+| 1970-01-01T00:00:01 | 1.0  | 10 | 1      |
+| 1970-01-01T00:00:01 | 1.25 | 12 | 1      |
+| 1970-01-01T00:00:01 | 1.5  | 15 | 1      |
++---------------------+------+----+--------+
+
+SELECT ts, k, v, CAST(k AS BIGINT) AS cast_k
+FROM partition_pruning_cast_unsorted
+WHERE CAST(k AS BIGINT) = 1
+ORDER BY k DESC;
+
++---------------------+------+----+--------+
+| ts                  | k    | v  | cast_k |
++---------------------+------+----+--------+
+| 1970-01-01T00:00:01 | 1.5  | 15 | 1      |
+| 1970-01-01T00:00:01 | 1.25 | 12 | 1      |
+| 1970-01-01T00:00:01 | 1.0  | 10 | 1      |
++---------------------+------+----+--------+
+
+DROP TABLE partition_pruning_cast_unsorted;
+
+Affected Rows: 0
+
 -- SQLNESS REPLACE (-+) -
 -- SQLNESS REPLACE (\s\s+) _
 -- SQLNESS REPLACE (elapsed_compute.*) REDACTED
```

**File**: `tests/cases/distributed/optimizer/partition_pruning_cast.sql` (modified, +36/-0)
```diff
@@ -43,6 +43,42 @@ FROM partition_pruning_cast_control
 WHERE CAST(k AS BIGINT) = 1
 ORDER BY k;
 
+-- The same rows must also come back in descending order: a filter on a lossy
+-- cast must not turn `k` into a constant and drop the requested sort.
+SELECT ts, k, v, CAST(k AS BIGINT) AS cast_k
+FROM partition_pruning_cast_partitioned
+WHERE CAST(k AS BIGINT) = 1
+ORDER BY k DESC;
+SELECT ts, k, v, CAST(k AS BIGINT) AS cast_k
+FROM partition_pruning_cast_control
+WHERE CAST(k AS BIGINT) = 1
+ORDER BY k DESC;
+
+-- A table whose matching rows are stored in neither ascending nor descending
+-- order, so a dropped sort cannot accidentally satisfy the ASC assertion.
+CREATE TABLE partition_pruning_cast_unsorted (
+    ts TIMESTAMP TIME INDEX,
+    k FLOAT PRIMARY KEY,
+    v BIGINT,
+);
+
+INSERT INTO partition_pruning_cast_unsorted VALUES
+    (1000, 1.5, 15),
+    (1000, 2.5, 25),
+    (1000, 1.0, 10),
+    (1000, 1.25, 12);
+
+SELECT ts, k, v, CAST(k AS BIGINT) AS cast_k
+FROM partition_pruning_cast_unsorted
+WHERE CAST(k AS BIGINT) = 1
+ORDER BY k;
+SELECT ts, k, v, CAST(k AS BIGINT) AS cast_k
+FROM partition_pruning_cast_unsorted
+WHERE CAST(k AS BIGINT) = 1
+ORDER BY k DESC;
+
+DROP TABLE partition_pruning_cast_unsorted;
+
 -- SQLNESS REPLACE (-+) -
 -- SQLNESS REPLACE (\s\s+) _
 -- SQLNESS REPLACE (elapsed_compute.*) REDACTED
```

---

### Incident Patch 3: `c818b6ac` (2026-10-28)
**Commit Message**: feat(postgres): influxdb line protocol ingest via COPY FROM STDIN (#9982)

* feat(postgres): influxdb line protocol ingest via COPY FROM STDIN

COPY FROM STDIN WITH (FORMAT influxdb [, precision 'ns']) ingests
InfluxDB line protocol over the postgres wire protocol, reusing the
HTTP ingestion pipeline wholesale for correctness and performance
parity: the whole payload is buffered and completed once at CopyDone
through the frontend's InfluxdbLineProtocolHandler::exec — conversion,
permissions, line-protocol interceptors, timestamp alignment to table
time-index units, merge mode and inserts are the same path an HTTP
write of the same bytes takes, under the connection's regular postgres
query context.

Formats are an explicit, closed enum (CopyFormat::Csv |
CopyFormat::Influxdb(options)); each variant states its own rules in
the copy lifecycle's match arms — csv requires a target table and
parses incrementally, influxdb forbids one (each line names its own
measurement) and buffers one bounded request body. The COPY layer owns
only the buffering: record boundaries, including newlines inside quoted
field values and after escapes, belong to the line-protocol parser
alone — one COPY statem

**File**: `src/frontend/src/server.rs` (modified, +1/-0)
```diff
@@ -429,6 +429,7 @@ where
                     user_provider.clone(),
                     Some(self.instance.process_manager().clone()),
                 )
+                .with_influxdb_handler(instance.clone())
                 .with_batching_enabled(postgres_batching),
             ) as Box<dyn Server>;
 
```

**File**: `src/servers/src/http/influxdb.rs` (modified, +3/-20)
```diff
@@ -24,7 +24,7 @@ use common_grpc::precision::Precision;
 use common_telemetry::tracing;
 use session::context::{Channel, QueryContext, QueryContextRef};
 
-use crate::error::{Result, TimePrecisionSnafu};
+use crate::error::Result;
 use crate::http::header::write_cost_header_map;
 use crate::influxdb::InfluxdbRequest;
 use crate::query_handler::InfluxdbLineProtocolHandlerRef;
@@ -107,30 +107,13 @@ pub async fn influxdb_write(
     ))
 }
 
-fn parse_time_precision(value: &str) -> Result<Precision> {
-    // Precision conversion needs to be compatible with influxdb v1 v2 api.
-    // For details, see the Influxdb documents.
-    // https://docs.influxdata.com/influxdb/v1.8/tools/api/#apiv2write-http-endpoint
-    // https://docs.influxdata.com/influxdb/v1.8/tools/api/#write-http-endpoint
-    match value {
-        "n" | "ns" => Ok(Precision::Nanosecond),
-        "u" | "us" => Ok(Precision::Microsecond),
-        "ms" => Ok(Precision::Millisecond),
-        "s" => Ok(Precision::Second),
-        "m" => Ok(Precision::Minute),
-        "h" => Ok(Precision::Hour),
-        unknown => TimePrecisionSnafu {
-            name: unknown.to_string(),
-        }
-        .fail(),
-    }
-}
+pub(crate) use crate::influxdb::parse_time_precision;
 
 #[cfg(test)]
 mod tests {
     use common_grpc::precision::Precision;
 
-    use crate::http::influxdb::parse_time_precision;
+    use super::parse_time_precision;
 
     #[test]
     fn test_parse_time_precision() {
```

**File**: `src/servers/src/influxdb.rs` (modified, +22/-1)
```diff
@@ -20,7 +20,7 @@ use hyper::Request;
 use influxdb_line_protocol::{FieldValue, parse_lines};
 use snafu::ResultExt;
 
-use crate::error::{Error, InfluxdbLineProtocolSnafu};
+use crate::error::{Error, InfluxdbLineProtocolSnafu, TimePrecisionSnafu};
 use crate::row_writer::{self, MultiTableData};
 
 const INFLUXDB_API_PATH_NAME: &str = "influxdb";
@@ -113,6 +113,27 @@ fn unwrap_or_default_precision(precision: Option<Precision>) -> Precision {
     }
 }
 
+/// Parses an InfluxDB time-precision name shared by the HTTP write
+/// endpoints (v1/v2) and the `precision` option of COPY FROM STDIN.
+pub(crate) fn parse_time_precision(value: &str) -> crate::error::Result<Precision> {
+    // Precision conversion needs to be compatible with influxdb v1 v2 api.
+    // For details, see the Influxdb documents.
+    // https://docs.influxdata.com/influxdb/v1.8/tools/api/#apiv2write-http-endpoint
+    // https://docs.influxdata.com/influxdb/v1.8/tools/api/#write-http-endpoint
+    match value {
+        "n" | "ns" => Ok(Precision::Nanosecond),
+        "u" | "us" => Ok(Precision::Microsecond),
+        "ms" => Ok(Precision::Millisecond),
+        "s" => Ok(Precision::Second),
+        "m" => Ok(Precision::Minute),
+        "h" => Ok(Precision::Hour),
+        unknown => TimePrecisionSnafu {
+            name: unknown.to_string(),
+        }
+        .fail(),
+    }
+}
+
 #[cfg(test)]
 mod tests {
     use api::v1::value::ValueData;
```

**File**: `src/servers/src/postgres.rs` (modified, +9/-1)
```diff
@@ -43,8 +43,8 @@ use session::context::Channel;
 
 use self::auth_handler::{PgUserProviderSource, ZeroPidSecretKeyGenerator};
 use self::handler::DefaultQueryParser;
-use crate::query_handler::CopyInHandlerRef;
 use crate::query_handler::sql::ServerSqlQueryHandlerRef;
+use crate::query_handler::{CopyInHandlerRef, InfluxdbLineProtocolHandlerRef};
 
 pub(crate) struct GreptimeDBStartupParameters {
     version: String,
@@ -81,6 +81,11 @@ pub struct PostgresServerHandlerInner {
     query_handler: ServerSqlQueryHandlerRef,
     auth_source: Option<Arc<PgUserProviderSource>>,
     copy_in_handler: CopyInHandlerRef,
+    /// Executes influxdb line-protocol batches flushed by a table-less
+    /// COPY FROM STDIN — the same handler the HTTP write endpoints use.
+    /// Absent on servers not wired for it; such connections reject the
+    /// influxdb format when a copy starts.
+    influxdb_handler: Option<InfluxdbLineProtocolHandlerRef>,
     force_tls: bool,
     auth_driver: AuthDriver<Arc<GreptimeDBStartupParameters>, UserInfoRef>,
     /// SCRAM selected; failures get the uniform metric label.
@@ -99,6 +104,8 @@ pub struct PostgresServerHandlerInner {
 pub(crate) struct MakePostgresServerHandler {
     query_handler: ServerSqlQueryHandlerRef,
     copy_in_handler: CopyInHandlerRef,
+    #[builder(default)]
+    influxdb_handler: Option<InfluxdbLineProtocolHandlerRef>,
     user_provider: Option<UserProviderRef>,
     #[builder(default = "Arc::new(GreptimeDBStartupParameters::new())")]
     param_provider: Arc<GreptimeDBStartupParameters>,
@@ -149,6 +156,7 @@ impl MakePostgresServerHandler {
                 .clone()
                 .map(|p| Arc::new(PgUserProviderSource::new(p))),
             copy_in_handler: self.copy_in_handler.clone(),
+            influxdb_handler: self.influxdb_handler.clone(),
             force_tls: self.force_tls,
             auth_driver: AuthDriver::new(self.param_provider.clone())
                 .with_pid_secret_key_generator(Arc::new(ZeroPidSecretKeyGenerator)),
```

**File**: `src/servers/src/postgres/copy_in/codec.rs` (modified, +46/-72)
```diff
@@ -12,58 +12,63 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
-//! The COPY FROM STDIN codec framework.
+//! The COPY FROM STDIN formats.
 //!
-//! A *codec* binds one COPY data format to its implementation. Codecs are
-//! stateless strategies: they validate the options they accept at
-//! statement-parse time, describe which column types they can ingest, and
-//! create the stateful [`RecordParser`] per stream.
-//!
-//! Formats are not limited to PostgreSQL's own — GreptimeDB-specific
-//! formats (a line protocol, a JSON-lines dialect, ...) register exactly
-//! like `csv` does, and may define their own options through the open
-//! `WITH (...)` clause.
+//! [`CopyFormat`] is the closed, explicit set of supported formats — a
+//! small enum over the real implementations rather than a generic
+//! format framework. Each variant carries its validated options and
+//! its rules are stated where they apply: a variant's match arms in
+//! the copy lifecycle (see the parent module) decide whether a target
+//! table is required, how the `CopyData` bytes are consumed, and which
+//! existing ingestion pipeline completes the copy. Adding a format is
+//! a normal extension: a new variant plus its arms.
 //!
 //! # Parsing and conversion
 //!
-//! A [`RecordParser`] consumes raw `CopyData` bytes and emits complete,
-//! insertable rows: one [`ParsedRow`] per record, in the order of the
-//! targeted columns. Parsers validate record shape (field counts) and
-//! convert field values themselves — `csv` delegates both splitting and
-//! typed conversion to arrow-csv's incremental decoder (the engine
-//! behind `COPY ... FROM 'file.csv'`) and turns decoded batches into
-//! rows with the shared `api::helper::vectors_to_rows`. A future format
-//! that carries values as text (e.g. a line protocol) would reintroduce
-//! shared field-conversion helpers here; see the removed `text` codec in
-//! git history for the shape they had.
+//! Table-bound formats parse incrementally through a [`RecordParser`]:
+//! it consumes raw `CopyData` bytes and emits complete, insertable
+//! rows — one [`ParsedRow`] per record, in the order of the targeted
+//! columns. `csv` delegates splitting and typed conversion to
+//! arrow-csv's incremental decoder (the engine behind
+//! `COPY ... FROM 'file.csv'`) and turns decoded batches into rows
+//! with the shared `api::helper::vectors_to_rows`.
+//!
+//! Formats that delegate to an existing ingestion pipeline (the
+//! influxdb line protocol) do not parse here at all: the whole payload
+//! is buffered as one bounded request body and completed through that
+//! pipeline, so record boundaries and values stay with the pipeline's
+//! own parser.
 //!
 //! # Options
 //!
 //! The `WITH (...)` clause is open: every `KEY value` entry the client
-//! writes is collected into a [`CopyOptionSet`] (see `options`) regardless
-//! of whether any format understands it — the statement is parsed
-//! textually (see `parse`) precisely so options beyond sqlparser's COPY
-//! grammar can reach the codecs. A codec builder takes the options it
-//! understands (`take_string`, `take_single_byte`, `take_flag`, or raw
-//! `take_value` for codec-specific shapes) and rejects the rest with
-//! `reject_leftovers`, so a future format like
-//! `COPY t FROM STDIN WITH (FORMAT influxdb_line, precision 'ns')` only
-//! needs its own codec and registry entry.
-//!
-//! To add a format:
-//!
-//! 1. implement [`CopyInCodec`] for a config struct holding the format's
-//!    validated options (see `csv::CsvCodec` for the example),
-//! 2. write a builder `fn(CopyOptionSet) -> PgWireResult<Arc<dyn
-//!    CopyInCodec>>` that applies defaults and rejects options the format
-//!    does not accept,
-//! 3. register the builder under every accepted `FORMAT` name (including
-//!    aliases) in `REGISTERED_FORMATS` in the parent module.
+//! writes is collected into a [`CopyOptionSet`] (see `options`)
+//! regardless of whether any format understands it — the statement is
+//! parsed textually (see `parse`) precisely so options beyond
+//! sqlparser's COPY grammar can reach the formats. A format builder
+//! takes the options it understands (`take_string`,
+//! `take_single_byte`, `take_flag`, or raw `take_value` for
+//! format-specific shapes) and rejects the rest with
+//! `reject_leftovers`.
 
-use datatypes::prelude::ConcreteDataType;
-use datatypes::schema::ColumnSchema;
 use pgwire::error::PgWireResult;
 
+use crate::postgres::copy_in::csv::CsvCodec;
+use crate::postgres::copy_in::influxdb::InfluxdbOptions;
+
+/// A resolved COPY FROM STDIN format with its validated options.
+#[derive(Debug, Clone)]
+pub(super) enum CopyFormat {
+    /// Table-bound CSV: records are parsed incrementally against the
+    /// targeted table's columns and inserted in batches.
+    Csv(CsvCodec),
+    /// Table-less influxdb line protocol: the whole payload is one
+    /
```

**File**: `src/servers/src/postgres/copy_in/csv.rs` (modified, +24/-28)
```diff
@@ -40,12 +40,12 @@ use datatypes::schema::{ColumnSchema, Schema as GreptimeSchema};
 use datatypes::vectors::{BooleanVector, Helper, StringVector, Vector};
 use pgwire::error::{PgWireError, PgWireResult};
 
-use crate::postgres::copy_in::codec::{CopyInCodec, ParsedRow, RecordParser};
+use crate::postgres::copy_in::codec::{CopyFormat, ParsedRow, RecordParser};
 use crate::postgres::copy_in::options::CopyOptionSet;
 use crate::postgres::copy_in::{COPY_IN_FLUSH_ROWS, bad_copy_data, invalid_text_repr, unsupported};
 
 /// The validated `csv` format configuration.
-#[derive(Debug)]
+#[derive(Debug, Clone)]
 pub(super) struct CsvCodec {
     delimiter: u8,
     quote: u8,
@@ -54,7 +54,7 @@ pub(super) struct CsvCodec {
 }
 
 /// Builds the CSV codec from the parsed options.
-pub(super) fn build_csv_codec(mut options: CopyOptionSet) -> PgWireResult<Arc<dyn CopyInCodec>> {
+pub(super) fn build_csv_codec(mut options: CopyOptionSet) -> PgWireResult<CopyFormat> {
     let delimiter = options.take_single_byte("DELIMITER")?.unwrap_or(b',');
     let quote = options.take_single_byte("QUOTE")?.unwrap_or(b'"');
     // In PostgreSQL the default escape character for CSV is the quote
@@ -75,21 +75,17 @@ pub(super) fn build_csv_codec(mut options: CopyOptionSet) -> PgWireResult<Arc<dy
     if delimiter == quote {
         return Err(bad_copy_data("DELIMITER must not be equal to QUOTE"));
     }
-    Ok(Arc::new(CsvCodec {
+    Ok(CopyFormat::Csv(CsvCodec {
         delimiter,
         quote,
         escape,
         header,
     }))
 }
 
-impl CopyInCodec for CsvCodec {
-    fn name(&self) -> &'static str {
-        "csv"
-    }
-
+impl CsvCodec {
     /// The column types arrow-csv can decode against.
-    fn check_column_type(&self, data_type: &ConcreteDataType) -> PgWireResult<()> {
+    pub(super) fn check_column_type(&self, data_type: &ConcreteDataType) -> PgWireResult<()> {
         let supported = matches!(
             data_type,
             ConcreteDataType::Boolean(_)
@@ -117,7 +113,7 @@ impl CopyInCodec for CsvCodec {
         Ok(())
     }
 
-    fn create_parser(
+    pub(super) fn create_parser(
         &self,
         columns: &[ColumnSchema],
         timezone: &str,
@@ -292,9 +288,15 @@ mod tests {
         ]
     }
 
+    fn build_codec(set: CopyOptionSet) -> CsvCodec {
+        match build_csv_codec(set).unwrap() {
+            CopyFormat::Csv(codec) => codec,
+            other => panic!("expected csv format, got {other:?}"),
+        }
+    }
+
     fn parser() -> Box<dyn RecordParser + Send> {
-        build_csv_codec(CopyOptionSet::default())
-            .unwrap()
+        build_codec(CopyOptionSet::default())
             .create_parser(&test_columns(), "UTC")
             .unwrap()
     }
@@ -308,8 +310,7 @@ mod tests {
 
     fn rows_with(mut set: CopyOptionSet) -> Box<dyn RecordParser + Send> {
         set.take_format().unwrap();
-        build_csv_codec(set)
-            .unwrap()
+        build_codec(set)
             .create_parser(&test_columns(), "UTC")
             .unwrap()
     }
@@ -329,8 +330,8 @@ mod tests {
 
     #[test]
     fn test_build_defaults() {
-        let codec = build_csv_codec(CopyOptionSet::default()).unwrap();
-        assert_eq!(codec.name(), "csv");
+        let codec = build_codec(CopyOptionSet::default());
+        assert!(matches!(codec, CsvCodec { .. }));
     }
 
     #[test]
@@ -368,7 +369,7 @@ mod tests {
 
     #[test]
     fn test_check_column_type() {
-        let codec = build_csv_codec(CopyOptionSet::default()).unwrap();
+        let codec = build_codec(CopyOptionSet::default());
         assert!(
             codec
                 .check_column_type(&ConcreteDataType::json_datatype())
@@ -524,8 +525,7 @@ mod tests {
             .into_bytes();
 
         let check = |chunk: usize| {
-            let mut parser = build_csv_codec(CopyOptionSet::default())
-                .unwrap()
+            let mut parser = build_codec(CopyOptionSet::default())
                 .create_parser(&sweep_columns, "UTC")
                 .unwrap();
             let mut ids: Vec<i32> = Vec::new();
@@ -560,8 +560,7 @@ mod tests {
             check(chunk);
             let mut shifted = payload.clone();
             shifted.drain(..37);
-            let mut parser = build_csv_codec(CopyOptionSet::default())
-                .unwrap()
+            let mut parser = build_codec(CopyOptionSet::default())
                 .create_parser(&sweep_columns, "UTC")
                 .unwrap();
             let mut count = 0usize;
@@ -585,8 +584,7 @@ mod tests {
                 false,
             ),
         ];
-        let mut parser = build_csv_codec(CopyOptionSet::default())
-            .unwrap()
+        let mut parser = build_codec(CopyOptionSet::default())
             .create_parser(&columns, "UTC")
             .unwrap();
         let rows = feed_all(
@@ -628,8 +626,7 @@ mod tests {
                 false,
             ),
         ];
-        let mut parser = build_csv_codec(Co
```

**File**: `src/servers/src/postgres/copy_in/influxdb.rs` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
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
+//! The `influxdb` line protocol format for COPY FROM STDIN.
+//!
+//! `COPY FROM STDIN WITH (FORMAT influxdb, precision 'ns')` ingests
+//! [InfluxDB line protocol](https://docs.influxdata.com/influxdb/v1.8/write_protocols/line_protocol_reference/)
+//! text. The format is table-less — each line names its own measurement
+//! — and does not parse here at all: the COPY layer buffers the whole
+//! payload (bounded by [`crate::postgres::copy_in::COPY_IN_MAX_PAYLOAD_BYTES`])
+//! and completes the copy by handing it to the frontend's line-protocol
+//! write pipeline as one body, exactly like the HTTP
+//! `/v1/influxdb/v1/write` endpoint receives one request body:
+//! conversion, permissions, interceptors, timestamp alignment, merge
+//! mode and inserts are the same path, and record boundaries (including
+//! newlines inside quoted field values and after escapes) are decided
+//! by the line-protocol parser alone — the COPY layer never splits
+//! records.
+//!
+//! One COPY statement is therefore one bounded ingestion request; a
+//! larger import is multiple COPY statements.
+//!
+//! The `precision` option carries the same values as the HTTP
+//! `precision` query parameter (`ns`, `us`, `ms`, `s`, ...), defaults to
+//! nanoseconds, and is resolved by the shared `parse_time_precision`.
+
+use common_grpc::precision::Precision;
+use pgwire::error::PgWireResult;
+
+use crate::postgres::copy_in::bad_copy_data;
+use crate::postgres::copy_in::codec::CopyFormat;
+use crate::postgres::copy_in::options::CopyOptionSet;
+
+/// The format's validated options. A `None` precision carries the
+/// pipeline's default (nanoseconds), exactly like an HTTP write without
+/// a `precision` parameter.
+#[derive(Debug, Clone)]
+pub(super) struct InfluxdbOptions {
+    pub(super) precision: Option<Precision>,
+}
+
+pub(super) fn build_influxdb_codec(mut options: CopyOptionSet) -> PgWireResult<CopyFormat> {
+    let precision = match options.take_string("precision")? {
+        Some(value) => Some(
+            crate::influxdb::parse_time_precision(&value)
+                .map_err(|e| bad_copy_data(format!("invalid precision option: {e}")))?,
+        ),
+        None => None,
+    };
+    options.reject_leftovers("influxdb")?;
+    Ok(CopyFormat::Influxdb(InfluxdbOptions { precision }))
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use crate::postgres::copy_in::options::CopyOptionValue;
+
+    #[test]
+    fn test_builder_options() {
+        let format = build_influxdb_codec(CopyOptionSet::default()).unwrap();
+        assert!(matches!(format, CopyFormat::Influxdb(_)));
+        assert!(matches!(format, CopyFormat::Influxdb(_)));
+
+        let mut set = CopyOptionSet::default();
+        set.insert("precision".into(), CopyOptionValue::String("ms".into()))
+            .unwrap();
+        assert!(matches!(
+            build_influxdb_codec(set).unwrap(),
+            CopyFormat::Influxdb(InfluxdbOptions {
+                precision: Some(Precision::Millisecond)
+            })
+        ));
+
+        let mut set = CopyOptionSet::default();
+        set.insert("precision".into(), CopyOptionValue::String("bogus".into()))
+            .unwrap();
+        assert!(build_influxdb_codec(set).is_err());
+
+        let mut set = CopyOptionSet::default();
+        set.insert("unknown".into(), CopyOptionValue::Flag).unwrap();
+        assert!(build_influxdb_codec(set).is_err());
+    }
+}
```

**File**: `src/servers/src/postgres/copy_in/mod.rs` (modified, +229/-76)
```diff
@@ -21,38 +21,42 @@
 //! the data stream incrementally and flushes it into the query handler as
 //! [`RowInsertRequests`] batches.
 //!
-//! # Format framework
+//! # Formats
 //!
-//! Each COPY data format is implemented as a [`codec::CopyInCodec`]: a
-//! stateless strategy that validates its options at statement-parse time,
-//! describes the column types it can ingest, and creates the stateful
-//! record parser for one stream. Formats register a builder under every
-//! accepted `FORMAT` name in [`REGISTERED_FORMATS`] — `csv` is the only
-//! implemented format today; PostgreSQL's `text`/`binary` and
-//! GreptimeDB-specific formats alike can be added the same way. See the
-//! `codec` module docs.
+//! The supported formats are the explicit [`codec::CopyFormat`] enum —
+//! `csv` (table-bound, incremental row parsing) and `influxdb`
+//! (table-less, one bounded whole-payload request). Each format states
+//! its own target rule and ingestion shape in the match arms of the
+//! copy lifecycle below; adding a format is a new variant plus its
+//! arms. Builders resolve a `FORMAT` name (and its aliases) through
+//! [`REGISTERED_FORMATS`]. See the `codec` module docs.
 
 mod codec;
 mod csv;
+mod influxdb;
 mod options;
 mod parse;
 
 use std::fmt::Debug;
 use std::sync::Arc;
 
+use crate::influxdb::InfluxdbRequest;
 use api::helper::ColumnDataTypeWrapper;
 use api::v1::column_def::options_from_column_schema;
 use api::v1::{
     Row as GrpcRow, RowInsertRequest, RowInsertRequests, Rows as GrpcRows, SemanticType,
 };
 use async_trait::async_trait;
-use codec::{CopyInCodec, RecordParser};
+use codec::{CopyFormat, RecordParser};
+use common_grpc::precision::Precision;
 use common_query::OutputData;
 use common_telemetry::{info, warn};
+use csv::CsvCodec;
 use datafusion::sql::sqlparser::ast::{CopyTarget, Statement as SqlParserStatement};
 use datatypes::data_type::DataType;
 use datatypes::schema::{ColumnSchema, SchemaRef};
 use futures::{Sink, SinkExt, stream};
+use influxdb::InfluxdbOptions;
 use pgwire::api::copy::CopyHandler;
 use pgwire::api::results::{CopyResponse, Response, Tag};
 use pgwire::api::{ClientInfo, PgWireConnectionState};
@@ -80,38 +84,43 @@ use crate::postgres::utils::convert_err;
 /// the per-batch fixed costs negligible.
 pub(crate) const COPY_IN_FLUSH_ROWS: usize = 32768;
 
-/// Builds a codec from the format-neutral option set.
-type CodecBuilder = fn(options::CopyOptionSet) -> PgWireResult<Arc<dyn CopyInCodec>>;
+/// Upper bound of an influxdb COPY FROM STDIN payload. One COPY
+/// statement is one bounded ingestion request (the whole payload is
+/// buffered like one HTTP write body); a larger import is multiple COPY
+/// statements. Streaming ingest may arrive later, with framing owned by
+/// the shared line-protocol parser rather than the COPY layer.
+pub(crate) const COPY_IN_MAX_PAYLOAD_BYTES: usize = 64 * 1024 * 1024;
+
+/// Builds a format from the format-neutral option set.
+type FormatBuilder = fn(options::CopyOptionSet) -> PgWireResult<CopyFormat>;
 
 /// The registered COPY FROM STDIN formats: accepted `FORMAT` name to
 /// builder. `csv` is the only implemented format; the others are
 /// registered so they report a clear "not supported yet" instead of an
 /// unknown-format error.
-const REGISTERED_FORMATS: &[(&str, CodecBuilder)] = &[
+const REGISTERED_FORMATS: &[(&str, FormatBuilder)] = &[
     ("csv", csv::build_csv_codec),
+    ("influxdb", influxdb::build_influxdb_codec),
+    ("influxdb_line", influxdb::build_influxdb_codec),
     ("text", build_unimplemented_text_codec),
     ("txt", build_unimplemented_text_codec),
     ("binary", build_unimplemented_binary_codec),
 ];
 
-fn build_unimplemented_text_codec(
-    _options: options::CopyOptionSet,
-) -> PgWireResult<Arc<dyn CopyInCodec>> {
+fn build_unimplemented_text_codec(_options: options::CopyOptionSet) -> PgWireResult<CopyFormat> {
     Err(unsupported(
         "the text format is not supported yet; use WITH (FORMAT csv)",
     ))
 }
 
-fn build_unimplemented_binary_codec(
-    _options: options::CopyOptionSet,
-) -> PgWireResult<Arc<dyn CopyInCodec>> {
+fn build_unimplemented_binary_codec(_options: options::CopyOptionSet) -> PgWireResult<CopyFormat> {
     Err(unsupported(
         "COPY FROM STDIN WITH (FORMAT binary) is not supported yet",
     ))
 }
 
-/// Resolves the format codec from the parsed options.
-fn resolve_codec(options: &mut options::CopyOptionSet) -> PgWireResult<Arc<dyn CopyInCodec>> {
+/// Resolves the format from the parsed options.
+fn resolve_format(options: &mut options::CopyOptionSet) -> PgWireResult<CopyFormat> {
     let name = options.take_format()?.ok_or_else(|| {
         unsupported(
             "COPY FROM STDIN requires an explicit format in this version; use WITH (FORMAT csv)",
@@ -133,15 +142,15 @@ pub(crate) struct CopyFromStdin {
     table: Vec<String>,
     /// Requested column list; empty means all columns in table order.
     columns: Vec<String>,
-    /// The resol
```

#### Recent Merged Pull Requests:
- **PR #10040** (2026-10-28): ci: enqueue eligible pull requests during the nightly window (@WenyXu)
- **PR #10034** (2026-10-28): fix(log-store): accept a retried first create of the conditional create probe (@fengjiachun)
- **PR #10032** (closed): test(promql): cover the canonical merge and the routing node end to end (@discord9)
- **PR #10031** (closed): feat(promql): route evaluated fragments to their canonical owner (@discord9)
- **PR #10030** (closed): feat(promql): answer one series per canonical label set in the native path (@discord9)
- **PR #10026** (2026-10-28): fix(query): keep requested sort when filtering on a lossy cast (@discord9)

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

## X. log-store): make raft-engine periodic WAL sync actually fsync (#9715)

**RULE**:
When implementing operations in `src/log-store/src/raft_engine/log_store.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in GreptimeTeam/greptimedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `180e2716`: log-store): make raft-engine periodic WAL sync actually fsync (#9715). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/log-store/src/raft_engine/log_store.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// Key used by the periodic WAL sync task. Overwritten each period so the
/// write stays non-empty on raft-engine 0.4.2 (see [`durable_sync`]).
const PERIODIC_SYNC_MARKER_KEY: &[u8] = b"$wal_periodic_sync";

/// Force an fsync of previously appended WAL data on raft-engine 0.4.2.
///
/// `Engine::sync()` writes an empty [`LogBatch`] with `sync = true`, but
/// 0.4.2's `Engine::write` returns early for empty batches *before* the
/// fsync (tikv/raft-engine#395). Upstream fixed this in tikv/raft-engine#400,
/// which is not on crates.io yet. Issuing a minimal non-empty put with
/// `sync = true` reaches the fsync path on 0.4.2.
///
/// `batch` must be empty and can be reused across calls: a successful
/// `Engine::write` drains its items but keeps its encoding buffer. On error the
/// batch may be left partially encoded, so callers must discard it.
fn durable_sync(engine: &Engine, batch: &mut LogBatch) -> raft_engine::Result<usize> {
    debug_assert!(batch.is_empty());
    // The value is unused, but it must not decode as a `NamespaceImpl`: the
    // marker key sorts after `NAMESPACE_PREFIX`, inside the range scanned by
    // `list_namespaces`. Overwriting the same key keeps the
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
        if let Err(e) = tokio::task::spawn_blocking(move || engine.sync()).await {
            error!(e; "Failed to sync raft engine log files");
        };
        Self { engine }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `180e2716` are properly handled with clean fallback behavior.
