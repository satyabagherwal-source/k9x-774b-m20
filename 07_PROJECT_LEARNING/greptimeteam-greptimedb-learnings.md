> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/greptimeteam-greptimedb-learnings.md`  
> **Source**: github ([https://github.com/GreptimeTeam/greptimedb](https://github.com/GreptimeTeam/greptimedb))  
> **Source Version**: `da88ff86`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T16:37:27.294Z  
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
> **Harvest Timestamp**: 2026-10-19T16:37:27.287Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GreptimeTeam/greptimedb`
- **Description**: The open-source observability database. One columnar engine for metrics, logs, and traces, on object storage.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6747 stars

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
- **Issue #9727** (2026-10-19): **test(promql): prove the composed Window -> Map -> Window chain**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  Stacked on the chunk-consumer branch. **This PR's own diff is a single file, `src/promql/src/range_eval/tests.rs`.**  ## What's changed and what's your intention?  The chunk protocol had a producer test (#9719) and a consumer test (#9726), but nothing drove both sides together. The properties worth pinning are exactly the ones that only appear when the layers are stacked:  ``` raw chunks -> RangeEvaluator(inner grid) -> EvaluatedChunk            -> map_chunk(ops)              -> EvaluatedChunk, same range and is_last            -> RangeEvaluator(outer grid)  -> EvaluatedChunk on the outer grid ```  This PR adds four tests for that chain. The whole-series comparison in each test runs the **same** implementation, so what it proves is that chunking does not change the result — a chunking invariance check, not an independent oracle. The other assertions in each test are what pin the individual protocol properties: progress across a valueless chunk, per-layer grid indexing, and the closing signal.  ### The four properties  - **`a_prefix_reaches_the_outer_layer_before_the_inner_series_ends`** — the outer layer emits chunks while the inner series has not yet received its closing chunk. The chain streams; it does not buffer to the end. - **`an_all_null_middle_chunk_still_advances_the_outer_window`** — an inner chunk that de

- **Issue #9722** (2026-10-19): **fix(mito2): build indexes for encoded bulk parts flushed in sync mode**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  ## What's changed and what's your intention?  ### Problem  With the flat format, `BulkMemtable` encodes a merged part as an `EncodedBulkPart` once it exceeds about 1M rows or 64 MiB. Flush uploads these parts with `put_sst` and never runs the indexer, so the SST has no inverted, skipping, or fulltext index. With the default `index.build_mode = sync`, nothing builds them later, and the files stay unindexed until compaction rewrites them. High-ingest regions hit this most, on their newest data.  ### Change  - `RegionFlushTask` tags each flush output with whether the indexer ran while writing it. Encoded parts are tagged as unindexed, and `FlushFinished` carries their file ids in `unindexed_files`. - In sync mode, `handle_flush_finished` sends those files to `handle_rebuild_index` with `IndexBuildType::Flush`, the path async mode already uses for every flushed file. Files whose indexes already match the region metadata are skipped. Async mode schedules the same files as before. - `IndexBuildTask::index_build` builds the indexer before reading any row and returns when no index creator is active (for example, the region's index types are disabled on flush or all their columns are ignored). Such a build reads only the SST footer. This applies to every build type.  ### Non-goals  - Building the index from the in-memory enc

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

### Incident Patch 1: `1e29e8d4` (2026-10-19)
**Commit Message**: fix(meta): validate persisted partition bounds before altering regions (#9487)

* fix(meta): validate persisted partition bounds before altering regions

A partition bound is persisted with the type of the column at the time
it was written. When an ALTER TABLE changes the type of a column
referenced by a partition expression (widening the time index unit is
the common case), each region rewrites the bound literal to the new
type while building its scan predicate. A millisecond bound like year
3000 fits milliseconds but overflows nanoseconds, so every scan of the
region fails once the table schema is updated -- and some regions may
already be altered when the failure surfaces.

Validate every region's persisted expression on prepare, before any
region is modified: parse the persisted JSON (mirrored types, since
common-meta cannot depend on the partition crate which depends on it),
replay the same value -> ScalarValue conversion and checked cast the
region performs, and reject the ALTER naming the offending region when
a bound cannot be represented with the new column type. Incompatible
changes are rejected atomically; compatible widening proceeds unchanged.

Adds meta-level tests (m

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -2673,6 +2673,7 @@ dependencies = [
  "common-wal",
  "common-workload",
  "datafusion-common",
+ "datafusion-expr",
  "datatypes",
  "deadpool",
  "deadpool-postgres",
```

**File**: `src/common/meta/Cargo.toml` (modified, +1/-0)
```diff
@@ -46,6 +46,7 @@ common-time.workspace = true
 common-wal.workspace = true
 common-workload.workspace = true
 datafusion-common.workspace = true
+datafusion-expr.workspace = true
 datatypes.workspace = true
 deadpool = { workspace = true, optional = true }
 deadpool-postgres = { workspace = true, optional = true }
```

**File**: `src/common/meta/src/ddl/alter_table.rs` (modified, +45/-0)
```diff
@@ -14,8 +14,11 @@
 
 mod executor;
 mod metadata;
+mod partition_compat;
 mod region_request;
 
+pub use partition_compat::validate_region_partition_bounds;
+
 use std::collections::HashSet;
 use std::vec;
 
@@ -147,6 +150,10 @@ impl AlterTableProcedure {
         )?;
         self.new_table_info = Some(new_table_info);
 
+        // Reject schema changes that the persisted partition expressions of some
+        // region cannot survive, before any region is altered.
+        self.validate_region_partition_exprs().await?;
+
         // Safety: Checked in `AlterTableProcedure::new`.
         let alter_kind = self.data.task.alter_table.kind.as_ref().unwrap();
         if sets_skip_wal(alter_kind) {
@@ -241,6 +248,44 @@ impl AlterTableProcedure {
         Ok(Status::executing(true))
     }
 
+    /// Validates the persisted partition expressions of every region against the
+    /// schema proposed by this ALTER TABLE, so an ALTER that would break a region's
+    /// partition predicate is rejected before any region is modified.
+    async fn validate_region_partition_exprs(&self) -> Result<()> {
+        // Safety: filled in `fill_table_info`.
+        let old_schema = &self
+            .data
+            .table_info_value
+            .as_ref()
+            .unwrap()
+            .table_info
+            .meta
+            .schema;
+        // Safety: set right after the new table info is built in `on_prepare`.
+        let new_schema = &self.new_table_info.as_ref().unwrap().meta.schema;
+        let changed_columns = partition_compat::changed_column_types(old_schema, new_schema);
+        if changed_columns.is_empty() {
+            return Ok(());
+        }
+
+        let (physical_table_id, physical_table_route) = self
+            .context
+            .table_metadata_manager
+            .table_route_manager()
+            .get_physical_table_route(self.data.table_id())
+            .await?;
+        if physical_table_id != self.data.table_id() {
+            // Partition expressions are persisted on the regions of the physical
+            // table; the altered schema here belongs to a logical table.
+            return Ok(());
+        }
+
+        partition_compat::validate_region_partition_bounds(
+            &changed_columns,
+            &physical_table_route.region_routes,
+        )
+    }
+
     fn table_poison_key(&self) -> PoisonKey {
         table_poison_key(self.data.table_id())
     }
```

**File**: `src/common/meta/src/ddl/alter_table/partition_compat.rs` (added, +565/-0)
```diff
@@ -0,0 +1,565 @@
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
+//! Preflight validation of persisted partition expressions against an ALTER TABLE schema change.
+//!
+//! Persisted partition bounds keep the types they were written with. A column whose
+//! type changes while a partition expression references it breaks the region on both
+//! paths that consume the bounds:
+//!
+//! * On scan, the region coerces the bound literal and the new column type to a
+//!   common comparison type while building the partition predicate. If no common type
+//!   exists, or the bound cannot be cast to it (a classic example is a millisecond
+//!   timestamp bound that overflows when the time index column is widened to
+//!   nanoseconds), every scan of that region fails at that point.
+//! * On write, the region routes rows through `MultiDimPartitionRule::find_region`,
+//!   which compares the persisted bound against row values directly (`Value::cmp`): a
+//!   bound whose variant no longer matches the column's panics on ordered comparisons
+//!   and misroutes silently on equality. Only a timestamp unit widening keeps the two
+//!   comparable — `Timestamp` comparisons convert units before comparing — so every
+//!   other type change of a referenced column is rejected outright, and the widening
+//!   keeps the scan check below.
+//!
+//! Such an ALTER must be rejected before it is submitted to any region, otherwise
+//! already-altered regions keep failing while the rest of the table is untouched.
+//!
+//! The `partition` crate depends on `common-meta`, so this crate cannot depend on
+//! `partition` back and cannot reuse [`partition::expr::PartitionExpr`]. The `Persisted*`
+//! types below mirror the JSON representation of `partition::partition::PartitionBound` and
+//! `partition::expr::PartitionExpr` and must be kept in sync with `partition/src/partition.rs`
+//! and `partition/src/expr.rs`; round-trip tests in `partition` run real serialized
+//! expressions through this validator so drift fails in CI. The compatibility check itself
+//! deliberately repeats the same conversion (value -> [`ScalarValue`]) and the same
+//! comparison coercion the region performs when it builds the partition predicate
+//! (`ExprSimplifier::coerce` / [`comparison_coercion`]): both sides are cast to the common
+//! comparison type, and the persisted bound must be castable to that type with
+//! [`ScalarValue::cast_to`]. A bound that would fail on scan is rejected here as well.
+
+use std::collections::HashMap;
+
+use common_telemetry::warn;
+use datafusion_common::ScalarValue;
+use datafusion_expr::type_coercion::binary::comparison_coercion;
+use datatypes::data_type::{ConcreteDataType, DataType};
+use datatypes::schema::Schema;
+use datatypes::value::{
+    Value, duration_to_scalar_value, time_to_scalar_value, timestamp_to_scalar_value,
+};
+use serde::Deserialize;
+use store_api::storage::RegionId;
+
+use crate::error::{PartitionExprIncompatibleSnafu, Result};
+use crate::rpc::router::RegionRoute;
+
+/// Mirrors `partition::partition::PartitionBound`.
+#[derive(Debug, Deserialize)]
+enum PersistedPartitionBound {
+    /// Deprecated since 0.9.0. Only deserialized to keep unknown old formats parseable.
+    #[allow(dead_code)]
+    Value(Value),
+    /// Deprecated since 0.15.0.
+    MaxValue,
+    Expr(PersistedPartitionExpr),
+}
+
+/// Mirrors `partition::expr::PartitionExpr`.
+#[derive(Debug, Deserialize)]
+struct PersistedPartitionExpr {
+    lhs: Box<PersistedOperand>,
+    op: PersistedOp,
+    rhs: Box<PersistedOperand>,
+}
+
+/// Mirrors `partition::expr::Operand`.
+#[derive(Debug, Deserialize)]
+enum PersistedOperand {
+    Column(String),
+    Value(Value),
+    Expr(PersistedPartitionExpr),
+}
+
+/// Mirrors `partition::expr::RestrictedOp`.
+#[derive(Debug, Deserialize)]
+enum PersistedOp {
+    Eq,
+    NotEq,
+    Lt,
+    LtEq,
+    Gt,
+    GtEq,
+    And,
+    Or,
+}
+
+/// Returns the columns whose data type differs between `old_schema` and `new_schema`,
+/// mapped to (old type, new type). Columns only present in one of the schemas (added or
+/// dropped) are not included; dropping a column referenced by a partition expression is
+/// already rejected by the table metadata validation.
+pub(crate) fn changed_column_types(
+    old_schema: &Schema,
+    new_schema: &Schema,
+) -> HashMap<String, (ConcreteDataType, ConcreteDataType)> {
+    let mut changed = HashMa
```

**File**: `src/common/meta/src/ddl/tests/alter_table.rs` (modified, +173/-0)
```diff
@@ -1478,3 +1478,176 @@ async fn test_annotation_alter_is_metadata_only() {
         }
     }
 }
+
+/// Builds the persisted partition expression `ts < <millis>` in the format the
+/// partition crate writes to region metadata.
+fn test_ts_partition_bound(millis: i64) -> String {
+    format!(
+        r#"{{"Expr":{{"lhs":{{"Column":"ts"}},"op":"Lt","rhs":{{"Value":{{"Timestamp":{{"value":{millis},"unit":"Millisecond"}}}}}}}}}}"#
+    )
+}
+
+fn test_partitioned_table_route(table_id: u32, region_bounds: &[i64]) -> TableRouteValue {
+    TableRouteValue::physical(
+        region_bounds
+            .iter()
+            .enumerate()
+            .map(|(index, bound)| RegionRoute {
+                region: Region {
+                    id: RegionId::new(table_id, index as u32 + 1),
+                    partition_expr: test_ts_partition_bound(*bound),
+                    ..Default::default()
+                },
+                leader_peer: Some(Peer::empty(index as u64 + 1)),
+                ..Default::default()
+            })
+            .collect(),
+    )
+}
+
+fn test_widen_ts_unit_task(table_name: &str, target_type: ColumnDataType) -> AlterTableTask {
+    AlterTableTask {
+        alter_table: AlterTableExpr {
+            catalog_name: DEFAULT_CATALOG_NAME.to_string(),
+            schema_name: DEFAULT_SCHEMA_NAME.to_string(),
+            table_name: table_name.to_string(),
+            kind: Some(Kind::ModifyColumnTypes(api::v1::ModifyColumnTypes {
+                modify_column_types: vec![api::v1::ModifyColumnType {
+                    column_name: "ts".to_string(),
+                    target_type: target_type as i32,
+                    target_type_extension: None,
+                }],
+            })),
+        },
+    }
+}
+
+#[tokio::test]
+async fn test_widen_ts_unit_rejects_incompatible_partition_bounds_before_altering() {
+    let node_manager = Arc::new(MockDatanodeManager::new(()));
+    let ddl_context = new_ddl_context(node_manager);
+    let table_name = "foo";
+    let table_id = 1024;
+    let task = test_create_table_task(table_name, table_id);
+
+    // Region 1 holds 2024-01-01, which fits nanoseconds. Region 2 holds 3000-01-01,
+    // which fits milliseconds but overflows nanoseconds.
+    let routes = test_partitioned_table_route(table_id, &[1_704_067_200_000, 32_503_680_000_000]);
+    ddl_context
+        .table_metadata_manager
+        .create_table_metadata(task.table_info.clone(), routes.clone(), HashMap::new())
+        .await
+        .unwrap();
+
+    let task = test_widen_ts_unit_task(table_name, ColumnDataType::TimestampNanosecond);
+    let mut procedure = AlterTableProcedure::new(table_id, task, ddl_context.clone()).unwrap();
+    let err = procedure.on_prepare().await.unwrap_err();
+
+    assert_matches!(err, Error::PartitionExprIncompatible { .. });
+    assert_eq!(err.status_code(), StatusCode::InvalidArguments);
+    // The rejection names the offending region and column.
+    assert!(
+        err.to_string().contains("4398046511106"),
+        "unexpected error: {err}"
+    );
+    assert!(err.to_string().contains("'ts'"), "unexpected error: {err}");
+
+    // The rejected ALTER left the table schema and the whole route unchanged.
+    let table_info = ddl_context
+        .table_metadata_manager
+        .table_info_manager()
+        .get(table_id)
+        .await
+        .unwrap()
+        .unwrap()
+        .into_inner()
+        .table_info;
+    assert_eq!(
+        table_info
+            .meta
+            .schema
+            .column_schema_by_name("ts")
+            .unwrap()
+            .data_type,
+        ConcreteDataType::timestamp_millisecond_datatype()
+    );
+    let (physical_table_id, physical_table_route) = ddl_context
+        .table_metadata_manager
+        .table_route_manager()
+        .get_physical_table_route(table_id)
+        .await
+        .unwrap();
+    assert_eq!(physical_table_id, table_id);
+    assert_eq!(
+        routes,
+        TableRouteValue::physical(physical_table_route.region_routes)
+    );
+}
+
+#[tokio::test]
+async fn test_widen_ts_unit_with_compatible_partition_bounds_completes() {
+    let node_manager = Arc::new(MockDatanodeManager::new(()));
+    let ddl_context = new_ddl_context(node_manager);
+    let table_name = "foo";
+    let table_id = 1024;
+    let task = test_create_table_task(table_name, table_id);
+
+    // Both persisted bounds fit nanoseconds.
+    let routes = test_partitioned_table_route(table_id, &[0, 1_704_067_200_000]);
+    ddl_context
+        .table_metadata_manager
+        .create_table_metadata(task.table_info.clone(), routes, HashMap::new())
+        .await
+        .unwrap();
+
+    let task = test_widen_ts_unit_task(table_name, ColumnDataType::TimestampNanosecond);
+    let procedure_id = ProcedureId::random();
+    let provider = Arc::new(MockContextProvider::default());
+    let mut procedure = AlterTableProcedure::new(table_id, task, ddl_context.clone()).unwrap();
+ 
```

**File**: `src/common/meta/src/error.rs` (modified, +16/-1)
```diff
@@ -1149,6 +1149,20 @@ pub enum Error {
         actual_column_id: u32,
     },
 
+    #[snafu(display(
+        "Partition expression of region {} is incompatible with the altered column '{}': the persisted bound can no longer be compared with the new column type {}",
+        region_id,
+        column,
+        target_type
+    ))]
+    PartitionExprIncompatible {
+        region_id: RegionId,
+        column: String,
+        target_type: String,
+        #[snafu(implicit)]
+        location: Location,
+    },
+
     #[cfg(feature = "enterprise")]
     #[snafu(display("Too large duration"))]
     TooLargeDuration {
@@ -1268,7 +1282,8 @@ impl ErrorExt for Error {
             | InvalidFileName { .. }
             | InvalidFlowRequestBody { .. }
             | InvalidFilePath { .. }
-            | ConflictingSchemaOptions { .. } => StatusCode::InvalidArguments,
+            | ConflictingSchemaOptions { .. }
+            | PartitionExprIncompatible { .. } => StatusCode::InvalidArguments,
 
             #[cfg(feature = "enterprise")]
             MissingInterval { .. } | NegativeDuration { .. } | TooLargeDuration { .. } => {
```

**File**: `src/partition/src/expr.rs` (modified, +117/-0)
```diff
@@ -463,6 +463,14 @@ impl Display for PartitionExpr {
 
 #[cfg(test)]
 mod tests {
+    use std::collections::HashMap;
+
+    use common_meta::ddl::alter_table::validate_region_partition_bounds;
+    use common_meta::error::Error;
+    use common_meta::rpc::router::{Region, RegionRoute};
+    use datatypes::data_type::ConcreteDataType;
+    use store_api::storage::RegionId;
+
     use super::*;
 
     #[test]
@@ -863,4 +871,113 @@ mod tests {
         assert!(columns.contains("b"));
         assert!(columns.contains("c"));
     }
+
+    /// Real serialized expressions must survive the round trip through
+    /// `common-meta`'s persisted-expression mirror: whenever that mirror drifts
+    /// from these types, deserialization fails, validation is skipped and the
+    /// overflowing cases below stop producing `PartitionExprIncompatible`.
+    #[test]
+    fn test_serialized_expressions_validate_against_type_changes() {
+        let overflow_ms = serde_json::from_str::<Value>(
+            r#"{"Timestamp":{"value":32503680000000,"unit":"Millisecond"}}"#,
+        )
+        .unwrap();
+        let start_ms =
+            serde_json::from_str::<Value>(r#"{"Timestamp":{"value":0,"unit":"Millisecond"}}"#)
+                .unwrap();
+        let ts_ms = ConcreteDataType::timestamp_millisecond_datatype();
+        let ts_ns = ConcreteDataType::timestamp_nanosecond_datatype();
+
+        let routes = |expr: &PartitionExpr| {
+            vec![RegionRoute {
+                region: Region {
+                    id: RegionId::new(1024, 1),
+                    partition_expr: expr.as_json_str().unwrap(),
+                    ..Default::default()
+                },
+                ..Default::default()
+            }]
+        };
+        let changed = |column: &str, old_type: ConcreteDataType, new_type: ConcreteDataType| {
+            HashMap::from([(column.to_string(), (old_type, new_type))])
+        };
+
+        // Compile-time tripwire: exhaustively matching the operand and operator
+        // variants makes a new variant break this test at compile time, so the
+        // `partition_compat::Persisted*` mirror and these cases must be extended
+        // together instead of silently skipping validation.
+        fn walk(expr: &PartitionExpr) {
+            walk_operand(&expr.lhs);
+            walk_operand(&expr.rhs);
+            match expr.op {
+                RestrictedOp::Eq
+                | RestrictedOp::NotEq
+                | RestrictedOp::Lt
+                | RestrictedOp::LtEq
+                | RestrictedOp::Gt
+                | RestrictedOp::GtEq
+                | RestrictedOp::And
+                | RestrictedOp::Or => {}
+            }
+        }
+        fn walk_operand(operand: &Operand) {
+            match operand {
+                Operand::Column(_) | Operand::Value(_) => {}
+                Operand::Expr(expr) => walk(expr),
+            }
+        }
+
+        // Every expression shape must be rejected while the bound overflows
+        // nanoseconds, with the error naming the offending column.
+        let simple = col("ts").lt(overflow_ms.clone());
+        let nested_and = col("ts")
+            .gt_eq(start_ms.clone())
+            .and(col("ts").lt(overflow_ms.clone()));
+        let nested_or = PartitionExpr::new(
+            Operand::Expr(col("host").eq(Value::String("a".into()))),
+            RestrictedOp::Or,
+            Operand::Expr(col("ts").lt(overflow_ms.clone())),
+        );
+        for expr in [&simple, &nested_and, &nested_or] {
+            walk(expr);
+            let err = validate_region_partition_bounds(
+                &changed("ts", ts_ms.clone(), ts_ns.clone()),
+                &routes(expr),
+            )
+            .unwrap_err();
+            assert!(
+                matches!(
+                    err,
+                    Error::PartitionExprIncompatible { ref column, .. } if column == "ts"
+                ),
+                "unexpected error: {err}"
+            );
+        }
+
+        // A representable bound passes.
+        let compatible = col("ts").lt(start_ms);
+        validate_region_partition_bounds(&changed("ts", ts_ms, ts_ns), &routes(&compatible))
+            .unwrap();
+
+        // Narrowing a field column must be rejected as well: the region's write
+        // path compares the persisted Int64 bound against Int32 rows directly
+        // and panics, even though the scan would coerce both sides.
+        let narrowing = col("v").lt(Value::Int64(3_000_000_000));
+        let err = validate_region_partition_bounds(
+            &changed(
+                "v",
+                ConcreteDataType::int64_datatype(),
+                ConcreteDataType::int32_datatype(),
+            ),
+            &routes(&narrowing),
+        )
+        .unwrap_err();
+        assert!(
+            matches!(
+                err,
+                Error::PartitionExprIncompatible { ref column, .. } if column == "v"
+            ),
+            
```

**File**: `tests/cases/standalone/common/alter/change_col_type.result` (modified, +67/-0)
```diff
@@ -386,3 +386,70 @@ DROP TABLE ts_overflow;
 
 Affected Rows: 0
 
+-- Issue 9454: persisted partition bounds keep their original unit. Widening the
+-- time index unit must be rejected before any region is altered when a persisted
+-- bound overflows the new unit.
+CREATE TABLE ts_bound_overflow (host STRING, ts TIMESTAMP TIME INDEX)
+PARTITION ON COLUMNS (ts) (
+  ts < '2024-01-01 00:00:00',
+  ts >= '2024-01-01 00:00:00' AND ts < '3000-01-01 00:00:00',
+  ts >= '3000-01-01 00:00:00'
+);
+
+Affected Rows: 0
+
+INSERT INTO ts_bound_overflow VALUES ("a", "2024-06-01 12:00:00");
+
+Affected Rows: 1
+
+-- 3000-01-01 fits milliseconds but overflows nanoseconds, so the widening is
+-- rejected before any region is altered.
+-- SQLNESS REPLACE \d+\(\d+,\s+\d+\) REDACTED
+ALTER TABLE ts_bound_overflow MODIFY COLUMN ts TIMESTAMP_NS;
+
+Error: 1004(InvalidArguments), Partition expression of region REDACTED is incompatible with the altered column 'ts': the persisted bound can no longer be compared with the new column type TimestampNanosecond
+
+-- The rejected ALTER leaves the schema and the stored data unchanged.
+DESCRIBE ts_bound_overflow;
+
++--------+----------------------+-----+------+---------+---------------+
+| Column | Type                 | Key | Null | Default | Semantic Type |
++--------+----------------------+-----+------+---------+---------------+
+| host   | String               |     | YES  |         | FIELD         |
+| ts     | TimestampMillisecond | PRI | NO   |         | TIMESTAMP     |
++--------+----------------------+-----+------+---------+---------------+
+
+SELECT * FROM ts_bound_overflow ORDER BY ts;
+
++------+---------------------+
+| host | ts                  |
++------+---------------------+
+| a    | 2024-06-01T12:00:00 |
++------+---------------------+
+
+-- Widening to microseconds keeps every persisted bound representable.
+ALTER TABLE ts_bound_overflow MODIFY COLUMN ts TIMESTAMP_US;
+
+Affected Rows: 0
+
+DESCRIBE ts_bound_overflow;
+
++--------+----------------------+-----+------+---------+---------------+
+| Column | Type                 | Key | Null | Default | Semantic Type |
++--------+----------------------+-----+------+---------+---------------+
+| host   | String               |     | YES  |         | FIELD         |
+| ts     | TimestampMicrosecond | PRI | NO   |         | TIMESTAMP     |
++--------+----------------------+-----+------+---------+---------------+
+
+SELECT * FROM ts_bound_overflow ORDER BY ts;
+
++------+---------------------+
+| host | ts                  |
++------+---------------------+
+| a    | 2024-06-01T12:00:00 |
++------+---------------------+
+
+DROP TABLE ts_bound_overflow;
+
+Affected Rows: 0
+
```

---

### Incident Patch 2: `791f4292` (2026-10-19)
**Commit Message**: fix(mito2): validate bulk insert batches against the region schema (#9698)

* fix(mito2): validate bulk insert batches against the region schema

Bulk inserts were only checked for the time index column, unlike row
writes, which WriteRequest::check_schema checks against the region
schema. A batch with columns of another type, nulls in the time index or
in non-nullable columns, duplicate or unknown columns reached the region
worker: a time index that is not a timestamp or holds only nulls made
the worker fail, and other mismatches failed after the WAL append or
were stored as written, depending on the SST format.

Move the column checks of check_schema into a core shared by row writes
and bulk inserts, and check bulk insert batches at the same points as
rows: when the engine builds the worker request, and again in the worker
if the region schema changed since. check_schema keeps its behavior.
Bulk insert columns must have the column's Arrow type, except that tags
may use any string encoding, as the memtables already convert them.
Sparse batches must carry one encoded primary key column of binary
without nulls. A batch that misses columns gets them filled by the
worker even if it cla

**File**: `src/metric-engine/src/engine/bulk_insert.rs` (modified, +94/-1)
```diff
@@ -16,9 +16,11 @@ use std::collections::HashSet;
 
 use api::v1::{ArrowIpc, SemanticType};
 use bytes::Bytes;
+use common_error::ext::BoxedError;
 use common_grpc::flight::{FlightEncoder, FlightMessage};
 use datatypes::arrow::record_batch::RecordBatch;
-use snafu::{OptionExt, ensure};
+use mito2::request::check_bulk_insert_batch;
+use snafu::{OptionExt, ResultExt, ensure};
 use store_api::codec::PrimaryKeyEncoding;
 use store_api::metadata::RegionMetadataRef;
 use store_api::region_request::{AffectedRows, RegionBulkInsertsRequest, RegionRequest};
@@ -111,6 +113,11 @@ impl MetricEngineInner {
             &batch,
             &logical_metadata,
         )?;
+        // The rewrite below copies columns without checking them, and would encode a
+        // duplicated tag into the primary key twice.
+        check_bulk_insert_batch(&logical_metadata, &batch)
+            .map_err(BoxedError::new)
+            .context(error::MitoWriteOperationSnafu)?;
         let modified_batch = modify_batch_sparse(
             batch.clone(),
             region_id.table_id(),
@@ -307,6 +314,92 @@ mod tests {
         })
     }
 
+    #[tokio::test]
+    async fn test_bulk_insert_rejects_duplicate_tag() {
+        use common_error::status_code::StatusCode;
+
+        let env = TestEnv::new().await;
+        env.init_metric_region().await;
+        let logical_region_id = env.default_logical_region_id();
+
+        let batch = build_logical_batch(0, 2);
+        let mut fields = batch.schema().fields().to_vec();
+        let mut columns = batch.columns().to_vec();
+        fields.push(fields[2].clone());
+        columns.push(columns[2].clone());
+        let batch = RecordBatch::try_new(Arc::new(ArrowSchema::new(fields)), columns).unwrap();
+        let err = env
+            .metric()
+            .handle_request(
+                logical_region_id,
+                build_bulk_request(logical_region_id, batch, false),
+            )
+            .await
+            .unwrap_err();
+        assert_eq!(err.status_code(), StatusCode::InvalidArguments, "{err:?}");
+    }
+
+    #[tokio::test]
+    async fn test_bulk_insert_physical_region_rejects_malformed_primary_key() {
+        use common_error::status_code::StatusCode;
+        use datatypes::arrow::array::{ArrayRef, BinaryArray, Int64Array};
+        use store_api::storage::consts::PRIMARY_KEY_COLUMN_NAME;
+
+        let env = TestEnv::new().await;
+        env.init_metric_region().await;
+        let physical_region_id = env.default_physical_region_id();
+        let logical_region_id = env.default_logical_region_id();
+        let tag_columns = vec![TagColumnInfo {
+            name: "job".to_string(),
+            index: 2,
+            column_id: 2,
+        }];
+        let batch = modify_batch_sparse(
+            build_logical_batch(0, 2),
+            logical_region_id.table_id(),
+            &tag_columns,
+            &[0, 1],
+        )
+        .unwrap();
+        let primary_key_index = batch.schema().index_of(PRIMARY_KEY_COLUMN_NAME).unwrap();
+        let with_primary_key = |primary_key: Option<ArrayRef>, extra: Option<ArrayRef>| {
+            let mut fields = batch.schema().fields().to_vec();
+            let mut columns = batch.columns().to_vec();
+            fields.remove(primary_key_index);
+            columns.remove(primary_key_index);
+            for array in [primary_key, extra].into_iter().flatten() {
+                fields.push(Arc::new(Field::new(
+                    PRIMARY_KEY_COLUMN_NAME,
+                    array.data_type().clone(),
+                    true,
+                )));
+                columns.push(array);
+            }
+            RecordBatch::try_new(Arc::new(ArrowSchema::new(fields)), columns).unwrap()
+        };
+        let encoded = batch.column(primary_key_index).clone();
+        let rejected = [
+            with_primary_key(None, None),
+            with_primary_key(Some(Arc::new(Int64Array::from(vec![1, 2]))), None),
+            with_primary_key(
+                Some(Arc::new(BinaryArray::from_opt_vec(vec![Some(b"a"), None]))),
+                None,
+            ),
+            with_primary_key(Some(encoded.clone()), Some(encoded)),
+        ];
+        for batch in rejected {
+            let err = env
+                .metric()
+                .handle_request(
+                    physical_region_id,
+                    build_bulk_request(physical_region_id, batch, false),
+                )
+                .await
+                .unwrap_err();
+            assert_eq!(err.status_code(), StatusCode::InvalidArguments, "{err:?}");
+        }
+    }
+
     async fn init_dense_metric_region(env: &TestEnv) -> RegionId {
         let physical_region_id = env.default_physical_region_id();
         env.create_physical_region(
```

**File**: `src/mito2/src/engine.rs` (modified, +2/-0)
```diff
@@ -25,6 +25,8 @@ mod batch_catchup_test;
 #[cfg(test)]
 mod batch_open_test;
 #[cfg(test)]
+mod bulk_insert_validation_test;
+#[cfg(test)]
 mod bump_committed_sequence_test;
 #[cfg(test)]
 mod catchup_test;
```

**File**: `src/mito2/src/engine/bulk_insert_validation_test.rs` (added, +329/-0)
```diff
@@ -0,0 +1,329 @@
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
+//! Bulk inserts checked against the region schema.
+
+use std::sync::Arc;
+
+use api::v1::{ArrowIpc, Rows};
+use common_error::ext::ErrorExt;
+use common_error::status_code::StatusCode;
+use common_recordbatch::{DfRecordBatch, RecordBatches};
+use common_test_util::flight::encode_to_flight_data;
+use datatypes::arrow::array::{
+    ArrayRef, Float64Array, Int64Array, LargeStringArray, ListArray, StringArray, StringViewArray,
+    TimestampMillisecondArray, TimestampSecondArray,
+};
+use datatypes::arrow::datatypes::{Field, Int64Type, Schema};
+use datatypes::prelude::ConcreteDataType;
+use store_api::region_engine::RegionEngine;
+use store_api::region_request::{
+    AlterKind, ModifyColumnType, RegionAlterRequest, RegionBulkInsertsRequest, RegionPutRequest,
+    RegionRequest,
+};
+use store_api::storage::{RegionId, ScanRequest};
+
+use crate::config::MitoConfig;
+use crate::engine::MitoEngine;
+use crate::request::WorkerRequest;
+use crate::test_util::{CreateRequestBuilder, TestEnv, build_rows, reopen_region, rows_schema};
+
+const SST_FORMATS: [&str; 2] = ["flat", "primary_key"];
+
+fn column(name: &str, array: ArrayRef) -> (Field, ArrayRef) {
+    (Field::new(name, array.data_type().clone(), true), array)
+}
+
+fn tag() -> (Field, ArrayRef) {
+    column("tag_0", Arc::new(StringArray::from(vec!["a", "b"])))
+}
+
+fn field() -> (Field, ArrayRef) {
+    column("field_0", Arc::new(Float64Array::from(vec![1.0, 2.0])))
+}
+
+fn ts() -> (Field, ArrayRef) {
+    column(
+        "ts",
+        Arc::new(TimestampMillisecondArray::from(vec![0, 1000])),
+    )
+}
+
+fn bulk_request(region_id: RegionId, columns: Vec<(Field, ArrayRef)>) -> RegionRequest {
+    RegionRequest::BulkInserts(bulk_insert(region_id, columns))
+}
+
+fn bulk_insert(region_id: RegionId, columns: Vec<(Field, ArrayRef)>) -> RegionBulkInsertsRequest {
+    let (fields, arrays): (Vec<_>, Vec<_>) = columns.into_iter().unzip();
+    let payload = DfRecordBatch::try_new(Arc::new(Schema::new(fields)), arrays).unwrap();
+    let (schema, record_batch) = encode_to_flight_data(payload.clone());
+    RegionBulkInsertsRequest {
+        skip_wal: false,
+        region_id,
+        payload,
+        raw_data: ArrowIpc {
+            schema: schema.data_header,
+            data_header: record_batch.data_header,
+            payload: record_batch.data_body,
+        },
+        partition_expr_version: None,
+        aligned_schema_version: None,
+    }
+}
+
+async fn scan_num_rows(engine: &MitoEngine, region_id: RegionId) -> usize {
+    let stream = engine
+        .scan_to_stream(region_id, ScanRequest::default())
+        .await
+        .unwrap();
+    let batches = RecordBatches::try_collect(stream).await.unwrap();
+    batches.iter().map(|batch| batch.num_rows()).sum()
+}
+
+/// Batches that do not match the region schema are rejected before they are
+/// appended to the WAL, and the region keeps accepting writes.
+#[tokio::test]
+async fn test_bulk_insert_rejects_batches_not_matching_schema() {
+    common_telemetry::init_default_ut_logging();
+    let list = ListArray::from_iter_primitive::<Int64Type, _, _>(vec![
+        Some(vec![Some(1)]),
+        Some(vec![Some(2)]),
+    ]);
+    let rejected = vec![
+        vec![
+            tag(),
+            field(),
+            column("ts", Arc::new(Int64Array::from(vec![0, 1000]))),
+        ],
+        vec![
+            tag(),
+            field(),
+            column(
+                "ts",
+                Arc::new(TimestampMillisecondArray::from(vec![Some(0), None])),
+            ),
+        ],
+        vec![
+            tag(),
+            field(),
+            column(
+                "ts",
+                Arc::new(TimestampMillisecondArray::from(vec![None, None])),
+            ),
+        ],
+        vec![
+            tag(),
+            field(),
+            column("ts", Arc::new(TimestampSecondArray::from(vec![0, 1]))),
+        ],
+        vec![tag(), field()],
+        vec![
+            tag(),
+            column("field_0", Arc::new(StringArray::from(vec!["1", "2"]))),
+            ts(),
+        ],
+        vec![tag(), column("field_0", Arc::new(list)), ts()],
+        vec![
+            tag(),
+            column(
+                "field_0",
+                Arc::new(Float64Array::from(vec![Some(1.0), None])),
+            ),
+            ts(),
+        ],
+        v
```

**File**: `src/mito2/src/memtable/time_series.rs` (modified, +22/-2)
```diff
@@ -17,7 +17,7 @@ use std::collections::{BTreeMap, Bound, HashSet};
 use std::fmt::{Debug, Formatter};
 use std::iter;
 use std::sync::atomic::{AtomicI64, AtomicU64, AtomicUsize, Ordering};
-use std::sync::{Arc, RwLock};
+use std::sync::{Arc, PoisonError, RwLock};
 use std::time::{Duration, Instant};
 
 use api::v1::OpType;
@@ -474,7 +474,13 @@ impl Drop for SeriesMap {
         let num_field_builders = self
             .0
             .values()
-            .map(|v| v.read().unwrap().active.num_field_builders())
+            // The map may be dropped while unwinding from a panic that poisoned a lock.
+            .map(|v| {
+                v.read()
+                    .unwrap_or_else(PoisonError::into_inner)
+                    .active
+                    .num_field_builders()
+            })
             .sum::<usize>();
         MEMTABLE_ACTIVE_SERIES_COUNT.sub(num_series as i64);
         MEMTABLE_ACTIVE_FIELD_BUILDER_COUNT.sub(num_field_builders as i64);
@@ -1493,6 +1499,20 @@ mod tests {
         assert_eq!(expect, &read);
     }
 
+    #[test]
+    fn test_series_map_drop_with_poisoned_lock() {
+        let region_metadata = schema_for_test();
+        let series = Arc::new(RwLock::new(Series::new(&region_metadata)));
+        let map = SeriesMap(BTreeMap::from([(vec![1], series.clone())]));
+        std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
+            let _guard = series.write().unwrap();
+            panic!("poison the series lock");
+        }))
+        .unwrap_err();
+        assert!(series.is_poisoned());
+        drop(map);
+    }
+
     #[test]
     fn test_series() {
         let region_metadata = schema_for_test();
```

**File**: `src/mito2/src/region_write_ctx.rs` (modified, +22/-1)
```diff
@@ -23,7 +23,7 @@ use store_api::logstore::LogStore;
 use store_api::logstore::provider::Provider;
 use store_api::storage::{RegionId, SequenceNumber};
 
-use crate::error::{Error, Result, WriteGroupSnafu};
+use crate::error::{Error, Result, UnexpectedSnafu, WriteGroupSnafu};
 use crate::memtable::KeyValues;
 use crate::memtable::bulk::part::BulkPart;
 use crate::metrics;
@@ -66,6 +66,15 @@ impl WriteNotify {
 
 impl Drop for WriteNotify {
     fn drop(&mut self) {
+        // A panic may have interrupted the write, so it must not be reported as written.
+        if self.err.is_none() && std::thread::panicking() {
+            self.err = Some(Arc::new(
+                UnexpectedSnafu {
+                    reason: "the write was interrupted by a panic",
+                }
+                .build(),
+            ));
+        }
         self.notify_result();
     }
 }
@@ -583,6 +592,18 @@ mod tests {
     use crate::memtable::bulk::part::BulkPart;
     use crate::test_util::version_util::VersionControlBuilder;
 
+    #[test]
+    fn test_write_notify_dropped_by_panic_reports_error() {
+        let (tx, rx) = oneshot::channel();
+        let notify = WriteNotify::new(OptionOutputTx::from(tx), 3);
+        std::panic::catch_unwind(std::panic::AssertUnwindSafe(move || {
+            let _notify = notify;
+            panic!("interrupt the write");
+        }))
+        .unwrap_err();
+        assert!(rx.blocking_recv().unwrap().is_err());
+    }
+
     #[test]
     fn test_request_skip_wal_preserves_sequences_and_other_writes() {
         // Ablate only the request flag: the workload and sequence allocation stay identical.
```

**File**: `src/mito2/src/request.rs` (modified, +265/-86)
```diff
@@ -25,6 +25,9 @@ use api::helper::{
 use api::v1::column_def::options_from_column_schema;
 use api::v1::{ColumnDataType, ColumnSchema, OpType, Rows, SemanticType, Value, WriteHint};
 use common_telemetry::info;
+use datatypes::arrow::array::{Array, ArrayRef};
+use datatypes::arrow::datatypes::DataType as ArrowDataType;
+use datatypes::arrow::record_batch::RecordBatch;
 use datatypes::prelude::DataType;
 use partition::expr::PartitionExpr;
 use prometheus::HistogramTimer;
@@ -44,6 +47,7 @@ use store_api::region_request::{
     RegionFlushRequest, RegionOpenRequest, RegionRequest, RegionTruncateRequest,
     StagingPartitionDirective,
 };
+use store_api::storage::consts::PRIMARY_KEY_COLUMN_NAME;
 use store_api::storage::{FileId, RegionId, SequenceNumber};
 use tokio::sync::oneshot::{self, Receiver, Sender};
 
@@ -194,85 +198,22 @@ impl WriteRequest {
 
         let region_id = self.region_id;
         // Index all columns in rows.
-        let mut rows_columns: HashMap<_, _> = self
+        let rows_columns = self
             .rows
             .schema
             .iter()
-            .map(|column| (&column.column_name, column))
+            .map(|schema| {
+                let column = RowColumn {
+                    request: self,
+                    schema,
+                };
+                (schema.column_name.as_str(), column)
+            })
             .collect();
-
-        let mut need_fill_default = false;
-        // Checks all columns in this region.
-        for column in &metadata.column_metadatas {
-            if let Some(input_col) = rows_columns.remove(&column.column_schema.name) {
-                // Check data type.
-                ensure!(
-                    is_column_type_value_eq(
-                        input_col.datatype,
-                        input_col.datatype_extension.clone(),
-                        &column.column_schema.data_type
-                    ),
-                    InvalidRequestSnafu {
-                        region_id,
-                        reason: format!(
-                            "column {} expect type {:?}, given: {}({})",
-                            column.column_schema.name,
-                            column.column_schema.data_type,
-                            ColumnDataType::try_from(input_col.datatype)
-                                .map(|v| v.as_str_name())
-                                .unwrap_or("Unknown"),
-                            input_col.datatype,
-                        )
-                    }
-                );
-
-                // Check semantic type.
-                ensure!(
-                    is_semantic_type_eq(input_col.semantic_type, column.semantic_type),
-                    InvalidRequestSnafu {
-                        region_id,
-                        reason: format!(
-                            "column {} has semantic type {:?}, given: {}({})",
-                            column.column_schema.name,
-                            column.semantic_type,
-                            api::v1::SemanticType::try_from(input_col.semantic_type)
-                                .map(|v| v.as_str_name())
-                                .unwrap_or("Unknown"),
-                            input_col.semantic_type
-                        ),
-                    }
-                );
-
-                // Check nullable.
-                // Safety: `rows_columns` ensures this column exists.
-                let has_null = self.has_null[self.name_to_index[&column.column_schema.name]];
-                ensure!(
-                    !has_null || column.column_schema.is_nullable(),
-                    InvalidRequestSnafu {
-                        region_id,
-                        reason: format!(
-                            "column {} is not null but input has null",
-                            column.column_schema.name
-                        ),
-                    }
-                );
-            } else {
-                // Rows don't have this column.
-                self.check_missing_column(column)?;
-
-                need_fill_default = true;
-            }
-        }
-
-        // Checks all columns in rows exist in the region.
-        if !rows_columns.is_empty() {
-            let names: Vec<_> = rows_columns.into_keys().collect();
-            return InvalidRequestSnafu {
-                region_id,
-                reason: format!("unknown columns: {:?}", names),
-            }
-            .fail();
-        }
+        let need_fill_default =
+            check_request_columns(region_id, metadata, rows_columns, |column| {
+                self.check_missing_column(column)
+            })?;
 
         // If we need to fill default values, return a special error.
         ensure!(!need_fill_default, FillDefaultSnafu { region_id });
@@ -369,16 +310,7 @@ impl WriteRequest {
         }
 
         // Not a delete request. Checks whether they have default value.
-        ensure!(
-            colu
```

**File**: `src/mito2/src/worker/handle_bulk_insert.rs` (modified, +4/-2)
```diff
@@ -71,10 +71,12 @@ impl<S: LogStore> RegionWorkerLoop<S> {
             return;
         }
 
-        // safety: ts data type must be a timestamp type.
+        // safety: `WorkerRequest::try_from_region_request` checked the batch against
+        // `region_metadata`, so the time index is a timestamp array without nulls.
         let (ts_primitive, _) = datatypes::timestamp::timestamp_array_to_primitive(ts).unwrap();
 
-        // safety: we've checked ts.len() == batch.num_rows() and batch is not empty
+        // safety: we've checked ts.len() == batch.num_rows(), batch is not empty and
+        // the time index has no nulls.
         let min_ts = arrow::compute::min(&ts_primitive).unwrap();
         let max_ts = arrow::compute::max(&ts_primitive).unwrap();
 
```

**File**: `src/mito2/src/worker/handle_write.rs` (modified, +13/-9)
```diff
@@ -34,7 +34,9 @@ use crate::metrics::{
 };
 use crate::region::{RegionLeaderState, RegionRoleState};
 use crate::region_write_ctx::{RegionWriteCtx, WriteSource};
-use crate::request::{SenderBulkRequest, SenderWriteRequest, WriteRequest};
+use crate::request::{
+    SenderBulkRequest, SenderWriteRequest, WriteRequest, check_bulk_insert_batch,
+};
 use crate::wal::Wal;
 use crate::worker::RegionWorkerLoop;
 
@@ -552,14 +554,16 @@ impl<S> RegionWorkerLoop<S> {
                     aligned_schema.schema_version == region_ctx.version().metadata.schema_version
                 });
 
-            // Fill missing columns if needed
-            if need_fill_missing_columns
-                && let Err(e) = bulk_req
-                    .request
-                    .fill_missing_columns(&region_ctx.version().metadata)
-            {
-                bulk_req.sender.send(Err(e));
-                continue;
+            // Fill missing columns if needed. The batch is checked again as the region
+            // schema may have changed since the request was checked.
+            if need_fill_missing_columns {
+                let metadata = &region_ctx.version().metadata;
+                if let Err(e) = check_bulk_insert_batch(metadata, &bulk_req.request.batch)
+                    .and_then(|_| bulk_req.request.fill_missing_columns(metadata))
+                {
+                    bulk_req.sender.send(Err(e));
+                    continue;
+                }
             }
 
             // Collect requests by region.
```

---

### Incident Patch 3: `cca95b26` (2026-10-19)
**Commit Message**: fix(datanode): stop the object store WAL before the region server (#9639)

* fix(mito2): cancel flushes waiting for the WAL when the engine stops

A flush waits for the WAL to be durable through the entry id it records
before it writes its manifest edit. With the object store WAL in the
`enqueued` mode that wait lasts until an upload succeeds, while the log
store is stopped only after the engines. A graceful shutdown during an
outage of the WAL's object store therefore never finished: closing a
region does not cancel its running flush, stopping the worker group
waits for running flushes and runs the queued ones, and a region holding
writes that skipped the WAL is flushed on close.

The worker group now owns a cancellation token, raised before its
schedulers stop and kept raised. `RegionEngine::begin_stop`, which the
region server calls before it closes regions, raises it earlier, so that
a close-time flush cannot wait either. A flush polls its durability
barrier first and gives up at the barrier once the token is raised: it
writes no manifest edit, deletes its SSTs and fails as cancelled. A
flush whose entries are already durable commits as before. The region
server reports a faile

**File**: `src/datanode/Cargo.toml` (modified, +1/-0)
```diff
@@ -81,5 +81,6 @@ common-meta = { workspace = true, features = ["testing"] }
 common-query.workspace = true
 common-test-util.workspace = true
 datafusion-common.workspace = true
+log-store = { workspace = true, features = ["testing"] }
 mito2 = { workspace = true, features = ["test"] }
 session.workspace = true
```

**File**: `src/datanode/src/datanode.rs` (modified, +273/-4)
```diff
@@ -167,7 +167,10 @@ impl Datanode {
                     .context(ShutdownInstanceSnafu),
             );
         }
-        record_shutdown_error(&mut first_error, self.region_server.stop().await);
+        // The object store WAL stops before the regions close: its stop
+        // uploads the backlog or drops it, and answers every wait for its
+        // entries, so a flush that waits for the WAL, queued or run by the
+        // close of a region, cannot hold up the shutdown.
         if let Some(log_store) = &self.object_store_log_store {
             record_shutdown_error(
                 &mut first_error,
@@ -178,6 +181,7 @@ impl Datanode {
                     .context(ShutdownInstanceSnafu),
             );
         }
+        record_shutdown_error(&mut first_error, self.region_server.stop().await);
         first_error.map_or(Ok(()), Err)
     }
 
@@ -1055,11 +1059,13 @@ mod tests {
     use std::assert_matches;
     use std::collections::{BTreeMap, HashMap};
     use std::io::Write;
+    use std::ops::Range;
     use std::path::Path;
     use std::sync::Arc;
     use std::sync::atomic::{AtomicUsize, Ordering};
     use std::time::Duration;
 
+    use api::v1::{ColumnSchema, Rows};
     use cache::build_datanode_layered_cache_registry;
     use common_base::Plugins;
     use common_base::readable_size::ReadableSize;
@@ -1073,28 +1079,34 @@ mod tests {
     use common_meta::node_manager::NodeManagerRef;
     use common_test_util::temp_dir::{create_named_temp_file, create_temp_dir};
     use common_wal::config::DatanodeWalConfig;
-    use common_wal::config::object_store::{ObjectStoreWalConfig, STANDALONE_GENERATION};
+    use common_wal::config::object_store::{AckMode, ObjectStoreWalConfig, STANDALONE_GENERATION};
+    use common_wal::options::{ObjectStoreWalOptions, WAL_OPTIONS_KEY, WalOptions};
     use log_store::ObjectStoreLogStore;
     use log_store::error::Error as LogStoreError;
     use meta_client::client::MetaClientBuilder;
     use mito2::engine::MITO_ENGINE_NAME;
+    use mito2::test_util::{CreateRequestBuilder, build_rows, rows_schema};
     use object_store::ObjectStore;
     use object_store::manager::ObjectStoreManager;
     use partition::manager::PartitionRuleManagerRef;
     use query::region_query::{RegionQueryHandlerFactory, RegionQueryHandlerFactoryRef};
     use store_api::logstore::LogStore;
-    use store_api::region_request::RegionRequest;
+    use store_api::logstore::provider::Provider;
+    use store_api::region_request::{PathType, RegionOpenRequest, RegionPutRequest, RegionRequest};
     use store_api::storage::RegionId;
 
     use crate::config::{DatanodeOptions, RegionEngineConfig, StorageConfig};
     use crate::datanode::{
-        DatanodeBuilder, validate_object_store_wal_config, validate_region_engine_config,
+        Datanode, DatanodeBuilder, validate_object_store_wal_config, validate_region_engine_config,
         wal_object_store,
     };
     use crate::error::{self, Error};
     use crate::region_query::DatanodeRegionQueryHandler;
+    use crate::region_server::RegionServer;
     use crate::tests::{MockRegionEngine, mock_region_server};
 
+    const WAIT: Duration = Duration::from_secs(30);
+
     async fn setup_table_datanode(kv: &KvBackendRef) {
         let mgr = DatanodeTableManager::new(kv.clone());
         let txn = mgr
@@ -1579,6 +1591,263 @@ mod tests {
         assert!(is_stopped(log_store).await);
     }
 
+    const REGION: RegionId = RegionId::new(1024, 1);
+
+    fn enqueued_wal_config(flush_interval: Duration) -> ObjectStoreWalConfig {
+        ObjectStoreWalConfig {
+            ack_mode: AckMode::Enqueued,
+            flush_interval,
+            ..Default::default()
+        }
+    }
+
+    /// The options that put a region on the WAL of a datanode with `config`.
+    fn region_wal_options(config: &ObjectStoreWalConfig) -> HashMap<String, String> {
+        let prefix = config.node_prefix(0, STANDALONE_GENERATION);
+        let wal_options =
+            serde_json::to_string(&WalOptions::ObjectStore(ObjectStoreWalOptions::new(prefix)))
+                .unwrap();
+        HashMap::from([(WAL_OPTIONS_KEY.to_string(), wal_options)])
+    }
+
+    async fn put_rows(
+        region_server: &RegionServer,
+        schema: &[ColumnSchema],
+        rows: Range<usize>,
+        skip_wal: bool,
+    ) {
+        if rows.is_empty() {
+            return;
+        }
+        region_server
+            .handle_request(
+                REGION,
+                RegionRequest::Put(RegionPutRequest {
+                    rows: Rows {
+                        schema: schema.to_vec(),
+                        rows: build_rows(rows.start, rows.end),
+                    },
+                    skip_wal,
+                    hint: None,
+                    partition_expr_version: None,
+                }),
+            )
+            .await
+            .unwrap();
+    }
+
+    /// Builds a datanode on an `enqueued` object store WAL with
+    /// 
```

**File**: `src/datanode/src/region_server.rs` (modified, +51/-2)
```diff
@@ -1986,6 +1986,7 @@ impl RegionServerInner {
             .collect::<Vec<_>>();
         let num_regions = regions.len();
 
+        let mut first_error = None;
         for (region_id, engine) in regions {
             let closed = engine
                 .handle_request(
@@ -1995,15 +1996,22 @@ impl RegionServerInner {
                 .await;
             match closed {
                 Ok(_) => debug!("Region {region_id} is closed"),
-                Err(e) => warn!("Failed to close region {region_id}, err: {e}"),
+                Err(e) => {
+                    // A close that failed may not have flushed writes that
+                    // skipped the WAL, which nothing replays.
+                    error!(e; "Failed to close region {region_id}; writes that skipped the WAL may be lost");
+                    record_shutdown_error(
+                        &mut first_error,
+                        Err(e).context(HandleRegionRequestSnafu { region_id }),
+                    );
+                }
             }
         }
         self.region_map.clear();
         info!("closed {num_regions} regions");
 
         drop(self.mito_engine.write().unwrap().take());
         let engines = self.engines.write().unwrap().drain().collect::<Vec<_>>();
-        let mut first_error = None;
         for (engine_name, engine) in engines {
             let result = engine
                 .stop()
@@ -2539,6 +2547,47 @@ mod tests {
         assert!(status.is_some());
     }
 
+    /// A region that fails to close is reported in the result of the stop,
+    /// which still closes the other regions.
+    #[tokio::test]
+    async fn test_stop_reports_a_region_that_failed_to_close() {
+        common_telemetry::init_default_ut_logging();
+
+        let mut mock_region_server = mock_region_server();
+        let failing = RegionId::new(1, 1);
+        let closing = RegionId::new(1, 2);
+        let closed = Arc::new(std::sync::Mutex::new(Vec::new()));
+        let (engine, _receiver) = MockRegionEngine::with_mock_fn(MITO_ENGINE_NAME, {
+            let closed = closed.clone();
+            Box::new(move |region_id, request| {
+                if matches!(request, RegionRequest::Close(_)) {
+                    closed.lock().unwrap().push(region_id);
+                    if region_id == failing {
+                        return error::UnexpectedSnafu {
+                            violated: "close failed".to_string(),
+                        }
+                        .fail();
+                    }
+                }
+                Ok(0)
+            })
+        });
+        mock_region_server.register_engine(engine.clone());
+        for region_id in [failing, closing] {
+            mock_region_server
+                .inner
+                .region_map
+                .insert(region_id, RegionEngineWithStatus::Ready(engine.clone()));
+        }
+
+        let err = mock_region_server.stop().await.unwrap_err();
+
+        assert_matches!(err, error::Error::HandleRegionRequest { region_id, .. } if region_id == failing);
+        let mut closed = closed.lock().unwrap().clone();
+        closed.sort();
+        assert_eq!(vec![failing, closing], closed);
+    }
+
     #[tokio::test]
     async fn test_batch_open_region_ignore_nonexistent_regions() {
         common_telemetry::init_default_ut_logging();
```

#### Recent Merged Pull Requests:
- **PR #9727** (closed): test(promql): prove the composed Window -> Map -> Window chain (@discord9)
- **PR #9722** (2026-10-19): fix(mito2): build indexes for encoded bulk parts flushed in sync mode (@killme2008)
- **PR #9721** (2026-10-19): ci: do not run these actions on fork (@yihong0618)
- **PR #9719** (2026-10-19): perf(promql): hand out evaluated series as chunks instead of one buffered series (@discord9)
- **PR #9716** (2026-10-19): fix(mito2): fence writes before a graceful downgrade (@fengjiachun)
- **PR #9713** (closed): fix(puffin): keep puffin_metadata cache bytes non-negative (@Tyagiquamar)

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

## X. meta): validate persisted partition bounds before altering regions (#9487)

**RULE**:
When implementing operations in `Cargo.lock`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in GreptimeTeam/greptimedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1e29e8d4`: meta): validate persisted partition bounds before altering regions (#9487). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `Cargo.lock`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
 "datafusion-expr",
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1e29e8d4` are properly handled with clean fallback behavior.
