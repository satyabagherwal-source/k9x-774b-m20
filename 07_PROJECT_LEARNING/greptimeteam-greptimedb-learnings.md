> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/greptimeteam-greptimedb-learnings.md`  
> **Source**: github ([https://github.com/GreptimeTeam/greptimedb](https://github.com/GreptimeTeam/greptimedb))  
> **Source Version**: `2cb47360`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T06:51:09.079Z  
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
> **Harvest Timestamp**: 2026-11-05T06:51:09.073Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GreptimeTeam/greptimedb`
- **Description**: The open-source observability database. One columnar engine for metrics, logs, and traces, on object storage.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6786 stars

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
- **Issue #10170** (2026-11-05): **test(compat): exercise the bloom-token case only below v1.3.0**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## What's changed and what's your intention?  `Compatibility Test (recent releases)` fails on `fulltext_bloom_tokens` for the v1.3.0 → current upgrade:  ``` expected: | false | 1 |      actual: | true  | 2 | expected: | true  | 1 | ```  The case reads a fulltext bloom SST in the **first** format and asserts its rows stay visible next to a current one. Its `from_range` started at `v1.0.0`, but the released v1.3.0 binary already writes `bloom_version: 2` (the token alignment fix is in it), so setup produces two current-format SSTs and "one old, one new" can never hold. The v1.2.1 run of the same case passes, which is what pointed at the window rather than the index.  Narrow `from_range` to the releases that still write the first format. The runner's constraint language has `>=`, `<=`, `==` and `=` only, and several entries are alternatives rather than a conjunction, so `<=v1.2.99` is the bound that excludes v1.3.0 while keeping v1.2.x and older — including the nightly window that samples extra versions.  Verified locally with the compat runner: - `--from-version v1.2.1 --dry-run` selects the case; - `--from-version v1.3.0 --dry-run` prints `Skipping case 'fulltext_bloom_tokens': from_range ["<=v1.2.99"] does not match version 'v1.3.0'`; - `update-compat-versions.py --check --published-only --check-anchors` passes.  ## PR Checklist - [x] I have written the necessary ru

- **Issue #10166** (2026-11-05): **fix(grpc): propagate cancellation for read query execution**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## What's changed and what's your intention?  Enable cascading cancellation for logical-plan and PromQL queries across the gRPC request and execution-runtime boundary. Previously, dropping a request future detached the spawned execution task, allowing it to keep running. Wrap the task in `AbortOnDropHandle` only for `LogicalPlan` and `PromRangeQuery` requests so cancellation also drops their pending execution futures.  Preserve the existing detached-task behavior for SQL, inserts, deletes, DDL, `InsertIntoPlan`, and unrecognized query payloads. SQL text may contain writes or DDL, and interrupting a state-changing operation between asynchronous steps can leave partially updated state. Retain the explanatory comment and its cancellation-safety reference. The inline path without a separate runtime, runtime selection, and join-error handling remain unchanged. There are no wire-format or storage-format changes.  Regression tests cover both paths:  - Logical-plan and PromQL execution is dropped when the caller is cancelled, with and without a separate runtime. - Spawned SQL, write, delete, DDL, and insert-plan execution can still finish normally after the caller is cancelled. The tests also preserve the existing inline cancellation behavior when no separate runtime is configured.  This change covers cancellation before `do_query` returns an `Output`; subsequent result-str
  **Post-Mortem & Fix Analysis**:
  > @codex review
  > <!-- codex-pull-request-review-summary --> <!-- codex-review-state:v1 {"code_review":{"commit_sha":"dcf05262f632a77acd628fde575d43de5579aac9","has_any_findings":false,"has_unresolved_findings":false,"status":"completed"},"security_review":{"commit_sha":null,"has_any_findings":null,"has_unresolved_findings":null,"status":null}} -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-11-05T02:37:20.026788Z">2026-11-05T02:37:20.026788Z</relative-time> | `dcf0526` | Manual request |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  C

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

### Incident Patch 1: `557843dd` (2026-11-04)
**Commit Message**: fix(catalog): use advertised peer address as process identity (#10153)

* fix(catalog): use advertised peer address as process identity

The process manager identified the local frontend by its public gRPC
address, while metasrv discovers peers by the address advertised in the
heartbeat (the internal gRPC address when configured). With separate
public and internal listeners, list_all_processes failed to exclude the
local node, queried its own management service as a remote frontend, and
appended the local registry again, so every local query was listed twice.
The same mismatch broke routing of KILL to other frontends.

Identify a frontend by the address it advertises to metasrv:
- add FrontendOptions::peer_addr, shared by the heartbeat and the process
  manager, and FrontendOptions::create_process_manager to wire it once;
- use the advertised address as the process identity, for self-exclusion
  in list_all_processes, and for local/remote routing in kill_process.

Process ids now carry the address other frontends use to reach the node.
When no internal gRPC listener is configured this is the public gRPC
address, so the previous behavior is unchanged. The internal listener is
the on

**File**: `src/catalog/src/process_manager.rs` (modified, +29/-12)
```diff
@@ -41,8 +41,14 @@ pub type ProcessManagerRef = Arc<ProcessManager>;
 
 /// Query process manager.
 pub struct ProcessManager {
-    /// Local frontend server address,
-    server_addr: String,
+    /// Address this frontend advertises to the cluster.
+    ///
+    /// It is the heartbeat peer address, which is also the only address other
+    /// frontends use to reach this node's process management service. The same
+    /// value identifies processes owned by this frontend and routes kill
+    /// requests, so discovery addresses and process addresses share one
+    /// namespace.
+    peer_addr: String,
     /// Next process id for local queries.
     next_id: AtomicU32,
     /// Running process per catalog.
@@ -79,11 +85,15 @@ impl Display for QueryStatement {
 }
 
 impl ProcessManager {
-    /// Create a [ProcessManager] instance with server address and kv client.
-    pub fn new(server_addr: String, meta_client: Option<MetaClientRef>) -> Self {
+    /// Creates a [ProcessManager] for the frontend identified by `peer_addr`.
+    ///
+    /// `peer_addr` must be the address the frontend advertises to metasrv, not
+    /// its public gRPC address: discovered peers are matched by that address to
+    /// exclude this node from remote listings and to route kill requests.
+    pub fn new(peer_addr: String, meta_client: Option<MetaClientRef>) -> Self {
         let frontend_selector = meta_client.map(MetaClientSelector::new);
         Self {
-            server_addr,
+            peer_addr,
             next_id: Default::default(),
             catalogs: Default::default(),
             frontend_selector,
@@ -111,7 +121,7 @@ impl ProcessManager {
             query,
             start_timestamp: current_time_millis(),
             client,
-            frontend: self.server_addr.clone(),
+            frontend: self.peer_addr.clone(),
         };
         let cancellation_handle = Arc::new(CancellationHandle::default());
         let cancellable_process = CancellableProcess::new(cancellation_handle.clone(), process);
@@ -168,6 +178,10 @@ impl ProcessManager {
 
     /// Lists running processes from every selected frontend and the local registry.
     ///
+    /// The local frontend is excluded from the remote selection by its advertised
+    /// peer address, which is what [`MetaClientSelector`] discovers. Its processes
+    /// are appended from the local registry exactly once.
+    ///
     /// Returns an error if a remote frontend cannot provide its process list.
     pub async fn list_all_processes(
         &self,
@@ -176,7 +190,7 @@ impl ProcessManager {
         let mut processes = vec![];
         if let Some(remote_frontend_selector) = self.frontend_selector.as_ref() {
             let frontends = remote_frontend_selector
-                .select(|peer| peer.addr != self.server_addr)
+                .select(|peer| peer.addr != self.peer_addr)
                 .await
                 .context(error::InvokeFrontendSnafu)?;
             for mut f in frontends {
@@ -194,29 +208,32 @@ impl ProcessManager {
     }
 
     /// Kills query with provided catalog and id.
+    ///
+    /// `peer_addr` is the frontend address from the process id, which is the
+    /// advertised peer address of the frontend that owns the process.
     pub async fn kill_process(
         &self,
-        server_addr: String,
+        peer_addr: String,
         catalog: String,
         id: ProcessId,
     ) -> error::Result<bool> {
-        if server_addr == self.server_addr {
+        if peer_addr == self.peer_addr {
             self.kill_local_process(catalog, id).await
         } else {
             let mut nodes = self
                 .frontend_selector
                 .as_ref()
                 .context(error::MetaClientMissingSnafu)?
-                .select(|peer| peer.addr == server_addr)
+                .select(|peer| peer.addr == peer_addr)
                 .await
                 .context(error::InvokeFrontendSnafu)?;
             ensure!(
                 !nodes.is_empty(),
-                error::FrontendNotFoundSnafu { addr: server_addr }
+                error::FrontendNotFoundSnafu { addr: peer_addr }
             );
 
             let request = KillProcessRequest {
-                server_addr,
+                server_addr: peer_addr,
                 catalog,
                 process_id: id,
             };
```

**File**: `src/cmd/src/frontend.rs` (modified, +1/-6)
```diff
@@ -27,7 +27,6 @@ use catalog::kvbackend::{
     CachedKvBackendBuilder, CatalogManagerConfiguratorRef, KvBackendCatalogManagerBuilder,
     new_read_only_meta_kv_backend,
 };
-use catalog::process_manager::ProcessManager;
 use clap::Parser;
 use client::client_manager::NodeClients;
 use common_base::Plugins;
@@ -53,7 +52,6 @@ use plugins::frontend::context::{
     CatalogManagerConfigureContext, DistributedCatalogManagerConfigureContext,
 };
 use plugins::options::PluginOptionsDeserializerImpl;
-use servers::addrs;
 use servers::grpc::GrpcOptions;
 use servers::tls::{TlsMode, TlsOption, merge_tls_option};
 use snafu::{OptionExt, ResultExt};
@@ -489,10 +487,7 @@ impl StartCommand {
         ));
         plugins.insert::<InformationExtensionRef>(information_extension.clone());
 
-        let process_manager = Arc::new(ProcessManager::new(
-            addrs::resolve_addr(&opts.grpc.bind_addr, Some(&opts.grpc.server_addr)),
-            Some(meta_client.clone()),
-        ));
+        let process_manager = opts.create_process_manager(Some(meta_client.clone()));
 
         let builder = KvBackendCatalogManagerBuilder::new(
             information_extension,
```

**File**: `src/frontend/src/frontend.rs` (modified, +49/-2)
```diff
@@ -14,6 +14,7 @@
 
 use std::sync::Arc;
 
+use catalog::process_manager::{ProcessManager, ProcessManagerRef};
 use common_base::readable_size::ReadableSize;
 use common_base::secrets::SecretString;
 use common_config::config::Configurable;
@@ -22,7 +23,7 @@ use common_memory_manager::OnExhaustedPolicy;
 use common_options::datanode::DatanodeClientOptions;
 use common_options::memory::MemoryOptions;
 use common_telemetry::logging::{LoggingOptions, SlowQueryOptions, TracingOptions};
-use meta_client::MetaClientOptions;
+use meta_client::{MetaClientOptions, MetaClientRef};
 use pipeline::PipelineOptions;
 use query::options::QueryOptions;
 use serde::{Deserialize, Serialize};
@@ -133,6 +134,33 @@ impl Default for FrontendOptions {
     }
 }
 
+impl FrontendOptions {
+    /// Returns the address this frontend advertises to the rest of the cluster.
+    ///
+    /// It is used as the heartbeat peer address and as the identity of the
+    /// frontend in the process list. When a dedicated internal gRPC server is
+    /// configured, it is that server's address, because the internal server is
+    /// the one that serves the frontend management service and peers connect to
+    /// it. Otherwise the public gRPC address is used: the peer address only
+    /// promises to be reachable by other components.
+    pub fn peer_addr(&self) -> String {
+        let grpc = self.internal_grpc.as_ref().unwrap_or(&self.grpc);
+        servers::addrs::resolve_addr(&grpc.bind_addr, Some(&grpc.server_addr))
+    }
+
+    /// Creates the process manager that tracks this frontend's running queries.
+    ///
+    /// The manager identifies this frontend by [`Self::peer_addr`], the same
+    /// address other frontends discover from metasrv. It must not use the public
+    /// gRPC address: a frontend with a dedicated internal gRPC server would fail
+    /// to recognize itself among the discovered peers, list its own queries
+    /// twice, and send `KILL` requests to an address that does not serve the
+    /// frontend management service.
+    pub fn create_process_manager(&self, meta_client: Option<MetaClientRef>) -> ProcessManagerRef {
+        Arc::new(ProcessManager::new(self.peer_addr(), meta_client))
+    }
+}
+
 impl Configurable for FrontendOptions {
     fn env_list_keys() -> Option<&'static [&'static str]> {
         Some(&[
@@ -217,7 +245,7 @@ mod tests {
     use meta_client::MetaClientRef;
     use meta_client::client::MetaClientBuilder;
     use servers::batcher::BatchingProtocol;
-    use servers::grpc::{FlightCompression, GRPC_SERVER};
+    use servers::grpc::{FlightCompression, GRPC_SERVER, GrpcOptions};
     use servers::http::HTTP_SERVER;
     use servers::http::result::greptime_result_v1::GreptimedbV1Response;
     use servers::server::Server;
@@ -287,6 +315,25 @@ mod tests {
         );
     }
 
+    #[test]
+    fn test_peer_addr_prefers_internal_grpc_server() {
+        let mut options = FrontendOptions::default();
+        options.grpc.bind_addr = "127.0.0.1:4001".to_string();
+        options.grpc.server_addr = "10.0.0.1:4001".to_string();
+
+        assert_eq!("10.0.0.1:4001", options.peer_addr());
+
+        options.internal_grpc = Some(GrpcOptions {
+            bind_addr: "127.0.0.1:4010".to_string(),
+            server_addr: "10.0.0.1".to_string(),
+            ..Default::default()
+        });
+
+        // The port falls back to the internal bind address when the advertised
+        // address does not carry one.
+        assert_eq!("10.0.0.1:4010", options.peer_addr());
+    }
+
     #[test]
     fn test_pipeline_host_access_config() {
         let defaults: FrontendOptions = toml::from_str("").unwrap();
```

**File**: `src/frontend/src/heartbeat.rs` (modified, +0/-12)
```diff
@@ -39,7 +39,6 @@ use common_stat::ResourceStatRef;
 use common_telemetry::{debug, error, info, warn};
 use meta_client::client::heartbeat::HeartbeatConfig;
 use meta_client::client::{HeartbeatSender, HeartbeatStream, MetaClient};
-use servers::addrs;
 use snafu::ResultExt;
 use tokio::sync::mpsc::Receiver;
 use tokio::sync::{Mutex, mpsc};
@@ -749,14 +748,3 @@ impl HeartbeatTask {
         self.runner.cancellation.is_cancelled()
     }
 }
-
-pub(crate) fn frontend_peer_addr(opts: &FrontendOptions) -> String {
-    // if internal grpc is configured, use its address as the peer address
-    // otherwise use the public grpc address, because peer address only promises to be reachable
-    // by other components, it doesn't matter whether it's internal or external
-    if let Some(internal) = &opts.internal_grpc {
-        addrs::resolve_addr(&internal.bind_addr, Some(&internal.server_addr))
-    } else {
-        addrs::resolve_addr(&opts.grpc.bind_addr, Some(&opts.grpc.server_addr))
-    }
-}
```

**File**: `src/frontend/src/instance/builder.rs` (modified, +1/-2)
```diff
@@ -58,7 +58,6 @@ use snafu::{OptionExt, ResultExt};
 use crate::error::{self, DataFusionSnafu, ExternalSnafu, Result};
 use crate::events::EventHandlerImpl;
 use crate::frontend::FrontendOptions;
-use crate::heartbeat::frontend_peer_addr;
 use crate::instance::Instance;
 use crate::instance::entity_graph::EntityGraphProviderImpl;
 use crate::instance::otlp::TraceAuxCache;
@@ -345,7 +344,7 @@ impl FrontendBuilder {
             kv_catalog.set_entity_graph_provider(provider);
         }
 
-        let frontend_peer_addr = frontend_peer_addr(&self.options);
+        let frontend_peer_addr = self.options.peer_addr();
         let statement_executor = StatementExecutor::new(
             self.catalog_manager.clone(),
             query_engine.clone(),
```

**File**: `tests-integration/src/cluster.rs` (modified, +1/-2)
```diff
@@ -32,7 +32,6 @@ use catalog::information_extension::DistributedInformationExtension;
 use catalog::kvbackend::{
     CachedKvBackendBuilder, KvBackendCatalogManagerBuilder, new_read_only_meta_kv_backend,
 };
-use catalog::process_manager::ProcessManager;
 use client::Client;
 use client::client_manager::NodeClients;
 use cmd::frontend::create_heartbeat_task;
@@ -634,7 +633,7 @@ impl GreptimeDbClusterBuilder {
             catalog_manager,
             datanode_clients,
             meta_client.clone(),
-            Arc::new(ProcessManager::new(fe_opts.grpc.server_addr.clone(), None)),
+            fe_opts.create_process_manager(None),
         )
         .with_local_file_access(self.local_file_access.clone())
         .with_local_cache_invalidator(cache_registry)
```

**File**: `tests-integration/tests/grpc.rs` (modified, +200/-18)
```diff
@@ -58,7 +58,8 @@ use datatypes::arrow::array::{
 use datatypes::arrow::datatypes::{DataType, Field};
 use datatypes::arrow::ipc::writer::StreamWriter;
 use datatypes::arrow::record_batch::RecordBatch as ArrowRecordBatch;
-use meta_client::client::MetaClientBuilder;
+use frontend::frontend::FrontendOptions;
+use meta_client::client::{MetaClient, MetaClientBuilder};
 use meta_srv::mocks::{self, MockInfo};
 use otel_arrow_rust::otlp::metrics::MetricType as ArrowMetricType;
 use otel_arrow_rust::proto::opentelemetry::arrow::v1::arrow_metrics_service_client::ArrowMetricsServiceClient;
@@ -70,7 +71,7 @@ use otel_arrow_rust::schema::consts as arrow_consts;
 use rstest_reuse::apply;
 use servers::grpc::builder::GrpcServerBuilder;
 use servers::grpc::frontend_grpc_handler::FrontendGrpcHandler;
-use servers::grpc::{GrpcServer, GrpcServerConfig};
+use servers::grpc::{GrpcOptions, GrpcServer, GrpcServerConfig};
 use servers::http::prometheus::{
     PromData, PromQueryResult, PromSampleValue, PromSeriesMatrix, PromSeriesVector,
     PrometheusJsonResponse, PrometheusResponse,
@@ -549,6 +550,17 @@ pub async fn test_grpc_auth(store_type: StorageType) {
 }
 
 async fn start_process_rpc_server(process_manager: Option<ProcessManagerRef>) -> GrpcServer {
+    start_process_rpc_server_at(
+        process_manager,
+        "127.0.0.1:0".parse::<SocketAddr>().unwrap(),
+    )
+    .await
+}
+
+async fn start_process_rpc_server_at(
+    process_manager: Option<ProcessManagerRef>,
+    addr: SocketAddr,
+) -> GrpcServer {
     let runtime: Runtime = RuntimeBuilder::default()
         .worker_threads(2)
         .thread_name("process-rpc-test")
@@ -559,16 +571,32 @@ async fn start_process_rpc_server(process_manager: Option<ProcessManagerRef>) ->
         builder = builder.frontend_grpc_handler(FrontendGrpcHandler::new(process_manager));
     }
     let mut server = builder.build();
-    server
-        .start("127.0.0.1:0".parse::<SocketAddr>().unwrap())
-        .await
-        .unwrap();
+    server.start(addr).await.unwrap();
     server
 }
 
-async fn register_process_rpc_peer(mock: &MockInfo, addr: String) {
+/// Reserves a loopback address for a test server.
+///
+/// A process manager must be created with the address it advertises before its
+/// gRPC listener starts, so pick a free port first and bind it right after.
+fn reserve_loopback_addr() -> SocketAddr {
+    std::net::TcpListener::bind("127.0.0.1:0")
+        .unwrap()
+        .local_addr()
+        .unwrap()
+}
+
+async fn build_meta_client_for_mock(mock: &MockInfo) -> Arc<MetaClient> {
+    let mut meta_client = MetaClientBuilder::frontend_default_options()
+        .channel_manager(mock.channel_manager.clone())
+        .build();
+    meta_client.start(&[&mock.server_addr]).await.unwrap();
+    Arc::new(meta_client)
+}
+
+async fn register_process_rpc_peer(mock: &MockInfo, node_id: u64, addr: String) {
     let node_info = NodeInfo {
-        peer: Peer { id: 1, addr },
+        peer: Peer { id: node_id, addr },
         last_activity_ts: util::current_time_millis(),
         status: NodeStatus::Frontend(FrontendStatus::default()),
         version: String::new(),
@@ -588,7 +616,7 @@ async fn register_process_rpc_peer(mock: &MockInfo, addr: String) {
         .put(PutRequest {
             key: Vec::from(&NodeInfoKey {
                 role: Role::Frontend,
-                node_id: 1,
+                node_id,
             }),
             value: node_info.try_into().unwrap(),
             prev_kv: false,
@@ -601,15 +629,9 @@ async fn build_process_manager_with_remote_peer(
     mock: &MockInfo,
     remote_addr: String,
 ) -> ProcessManagerRef {
-    register_process_rpc_peer(mock, remote_addr).await;
-    let mut meta_client = MetaClientBuilder::frontend_default_options()
-        .channel_manager(mock.channel_manager.clone())
-        .build();
-    meta_client.start(&[&mock.server_addr]).await.unwrap();
-    Arc::new(ProcessManager::new(
-        "local".to_string(),
-        Some(Arc::new(meta_client)),
-    ))
+    register_process_rpc_peer(mock, 1, remote_addr).await;
+    let meta_client = build_meta_client_for_mock(mock).await;
+    Arc::new(ProcessManager::new("local".to_string(), Some(meta_client)))
 }
 
 #[tokio::test(flavor = "multi_thread")]
@@ -700,6 +722,166 @@ async fn test_list_all_processes_collects_remote_and_local_catalog() {
     );
 }
 
+/// Regression test for frontends with separate public and internal gRPC
+/// addresses.
+///
+/// The local process manager must recognize itself by the peer address it
+/// advertises to metasrv (the internal gRPC address), not by its public gRPC
+/// address. Otherwise it queries its own management service as if it were a
+/// remote frontend and then appends the local registry a second time, so every
+/// local query is listed twice.
+#[tokio::test(flavor = "multi_thread")]
+async fn test_list_all_processes_excludes_local_peer_with_internal_grpc() {
+    let mock = mocks::mock_with_memstore().await;
```

---

### Incident Patch 2: `b21b1cdb` (2026-11-04)
**Commit Message**: fix(function): require ADMIN statement privileges to execute admin functions (#10120)

* fix(function): require ADMIN statement privileges to execute admin functions

Read-only accounts could execute the admin UDFs (flush_table,
compact_table, flush_flow, gc_regions, migrate_region, reconcile_*,
build_index, ...) through ordinary SELECT statements: SELECT is a
read-only statement so it passes the statement-level privilege check,
and the functions were only guarded by the greptime-catalog scope
check inside the UDF. That let read-only users trigger WAL flushes,
manifest version bumps, compactions, flow-sink writes and, in
distributed mode, region GC/migration and SST deletion.

Wrap the privilege check into the admin_fn macro itself, next to the
existing greptime-catalog check: before executing, every #[admin_fn]
function now requires the same privileges as its ADMIN statement. The
check synthesizes the PermissionReq::SqlStatement request an
ADMIN <fn>(...) statement produces and evaluates it with the same
PermissionCheckerRef plugin the frontend installs, so query invocation
(SELECT <fn>(...), EXPLAIN, views, flows) and the ADMIN statement path
are gated identically — in particular

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -2501,6 +2501,7 @@ dependencies = [
  "arrow 59.2.0",
  "arrow-schema 59.2.0",
  "async-trait",
+ "auth",
  "axum 0.8.4",
  "bincode",
  "catalog",
```

**File**: `src/common/function/Cargo.toml` (modified, +1/-0)
```diff
@@ -20,6 +20,7 @@ api.workspace = true
 arrow.workspace = true
 arrow-schema.workspace = true
 async-trait.workspace = true
+auth.workspace = true
 bincode = "=1.3.3"
 catalog.workspace = true
 common-base.workspace = true
```

**File**: `src/common/function/src/admin/flush_compact_table.rs` (modified, +59/-0)
```diff
@@ -768,4 +768,63 @@ mod tests {
             .is_err()
         );
     }
+
+    #[tokio::test]
+    async fn test_flush_table_requires_admin_privilege() {
+        use auth::{
+            DefaultPermissionChecker, Identity, Password, PermissionCheckerRef, UserProvider,
+            static_user_provider_from_option,
+        };
+        use common_base::Plugins;
+        use common_error::status_code::StatusCode;
+
+        async fn user(username: &str, mode: &str) -> auth::UserInfoRef {
+            let provider = static_user_provider_from_option(&format!(
+                "static_user_provider:cmd:{username}:{mode}={username}_pwd"
+            ))
+            .unwrap();
+            provider
+                .authenticate(
+                    Identity::UserId(username, None),
+                    Password::PlainText(format!("{username}_pwd").into()),
+                )
+                .await
+                .unwrap()
+        }
+
+        let plugins = Plugins::new();
+        plugins.insert::<PermissionCheckerRef>(DefaultPermissionChecker::arc());
+
+        let func_args = || datafusion::logical_expr::ScalarFunctionArgs {
+            args: vec![ColumnarValue::Array(Arc::new(StringArray::from(vec![
+                "test",
+            ])))],
+            arg_fields: vec![Arc::new(Field::new("arg_0", DataType::Utf8, false))],
+            return_field: Arc::new(Field::new("result", DataType::UInt64, true)),
+            number_rows: 1,
+            config_options: Arc::new(datafusion_common::config::ConfigOptions::default()),
+        };
+
+        let factory: ScalarFunctionFactory = FlushTableFunction::factory().into();
+
+        let func_ctx =
+            crate::permission::test_function_context(plugins.clone(), user("ro_user", "ro").await);
+        let provider = factory.provide(func_ctx);
+        let f = provider.as_async().unwrap();
+        let error = f.invoke_async_with_args(func_args()).await.unwrap_err();
+        assert_eq!(
+            StatusCode::PermissionDenied,
+            common_query::error::datafusion_status_code::<common_query::error::Error>(&error, None)
+        );
+
+        let func_ctx =
+            crate::permission::test_function_context(plugins, user("rw_user", "rw").await);
+        let provider = factory.provide(func_ctx);
+        let f = provider.as_async().unwrap();
+        let error = f.invoke_async_with_args(func_args()).await.unwrap_err();
+        assert_ne!(
+            StatusCode::PermissionDenied,
+            common_query::error::datafusion_status_code::<common_query::error::Error>(&error, None)
+        );
+    }
 }
```

**File**: `src/common/function/src/lib.rs` (modified, +5/-0)
```diff
@@ -15,6 +15,7 @@
 mod admin;
 mod flush_flow;
 mod macros;
+mod permission;
 mod system;
 mod uddsketch_compat;
 
@@ -27,3 +28,7 @@ pub mod helper;
 pub mod scalars;
 pub mod state;
 pub mod utils;
+
+// Public for `admin_fn` expansions in downstream crates; the module stays private.
+#[doc(hidden)]
+pub use permission::ensure_admin_privilege;
```

**File**: `src/common/function/src/permission.rs` (added, +130/-0)
```diff
@@ -0,0 +1,130 @@
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
+use auth::{PermissionChecker, PermissionCheckerRef, PermissionReq, PermissionResp};
+use common_error::ext::BoxedError;
+use common_query::error::PermissionDeniedSnafu;
+use datafusion_common::DataFusionError;
+use sql::ast::{FunctionArguments, Ident, ObjectName};
+use sql::statements::admin::Admin;
+use sql::statements::statement::Statement;
+
+use crate::function::FunctionContext;
+
+/// Checks ADMIN statement privileges for an `admin_fn`-generated UDF.
+pub fn ensure_admin_privilege(
+    func_ctx: &FunctionContext,
+    fn_name: &str,
+) -> datafusion_common::Result<()> {
+    let admin_stmt = Statement::Admin(Admin::Func(sql::ast::Function {
+        name: ObjectName::from(vec![Ident::new(fn_name)]),
+        uses_odbc_syntax: false,
+        parameters: FunctionArguments::None,
+        args: FunctionArguments::None,
+        filter: None,
+        null_treatment: None,
+        over: None,
+        within_group: vec![],
+    }));
+
+    let checker = func_ctx.state.plugins.get::<PermissionCheckerRef>();
+    match checker.as_ref().check_permission_with_context(
+        func_ctx.query_ctx.current_user(),
+        PermissionReq::SqlStatement(&admin_stmt),
+        Some(&func_ctx.query_ctx.current_schema()),
+    ) {
+        Ok(PermissionResp::Allow) => Ok(()),
+        Ok(PermissionResp::Reject) | Err(_) => {
+            let err = PermissionDeniedSnafu {
+                err_msg: format!(
+                    "Executing the admin function '{fn_name}' requires the privileges of an ADMIN statement"
+                ),
+            }
+            .build();
+            Err(DataFusionError::External(Box::new(BoxedError::new(err))))
+        }
+    }
+}
+
+#[cfg(test)]
+pub(crate) fn test_function_context(
+    plugins: common_base::Plugins,
+    user: auth::UserInfoRef,
+) -> FunctionContext {
+    let query_ctx = session::context::QueryContext::arc();
+    query_ctx.set_current_user(user);
+    FunctionContext {
+        query_ctx,
+        state: std::sync::Arc::new(crate::state::FunctionState {
+            plugins,
+            ..Default::default()
+        }),
+    }
+}
+
+#[cfg(test)]
+mod tests {
+    use auth::{
+        DefaultPermissionChecker, Identity, Password, PermissionCheckerRef, UserProvider,
+        static_user_provider_from_option,
+    };
+    use common_base::Plugins;
+    use common_error::status_code::StatusCode;
+
+    use super::*;
+
+    async fn user(username: &str, mode: &str) -> auth::UserInfoRef {
+        let provider = static_user_provider_from_option(&format!(
+            "static_user_provider:cmd:{username}:{mode}={username}_pwd"
+        ))
+        .unwrap();
+        provider
+            .authenticate(
+                Identity::UserId(username, None),
+                Password::PlainText(format!("{username}_pwd").into()),
+            )
+            .await
+            .unwrap()
+    }
+
+    fn denied_status(error: &DataFusionError) -> StatusCode {
+        common_query::error::datafusion_status_code::<common_query::error::Error>(error, None)
+    }
+
+    #[tokio::test]
+    async fn test_admin_privilege_without_checker_allows() {
+        let func_ctx = test_function_context(Plugins::default(), user("anyone", "ro").await);
+        ensure_admin_privilege(&func_ctx, "flush_table").unwrap();
+    }
+
+    #[tokio::test]
+    async fn test_admin_privilege_readonly_user_denied() {
+        let plugins = Plugins::new();
+        plugins.insert::<PermissionCheckerRef>(DefaultPermissionChecker::arc());
+        let func_ctx = test_function_context(plugins, user("ro_user", "ro").await);
+
+        let error = ensure_admin_privilege(&func_ctx, "flush_table")
+            .expect_err("read-only user must be denied");
+        assert_eq!(StatusCode::PermissionDenied, denied_status(&error));
+    }
+
+    #[tokio::test]
+    async fn test_admin_privilege_readwrite_user_allowed() {
+        let plugins = Plugins::new();
+        plugins.insert::<PermissionCheckerRef>(DefaultPermissionChecker::arc());
+        let func_ctx = test_function_context(plugins, user("rw_user", "rw").await);
+
+        ensure_admin_privilege(&func_ctx, "flush_table").unwrap();
+    }
+}
```

**File**: `src/common/function/tests/admin_fn.rs` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
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
+use common_function::function::FunctionContext;
+use common_function::function_factory::ScalarFunctionFactory;
+use common_function::handlers::ProcedureServiceHandlerRef;
+use common_macro::admin_fn;
+use common_query::error::{MissingProcedureServiceHandlerSnafu, Result};
+use datafusion_expr::{Signature, Volatility};
+use datatypes::value::{Value, ValueRef};
+use session::context::QueryContextRef;
+
+// Integration tests compile as a separate crate, matching downstream users of
+// the macro. All generated paths must be accessible through `common_function`.
+#[admin_fn(
+    name = ExternalAdminFunction,
+    display_name = external_admin,
+    sig_fn = signature,
+    ret = uint64,
+    user_path = common_function
+)]
+async fn external_admin(
+    _handler: &ProcedureServiceHandlerRef,
+    _query_ctx: &QueryContextRef,
+    _params: &[ValueRef<'_>],
+) -> Result<Value> {
+    Ok(Value::from(0u64))
+}
+
+fn signature() -> Signature {
+    Signature::nullary(Volatility::Volatile)
+}
+
+#[test]
+fn test_admin_fn_from_external_crate() {
+    let factory: ScalarFunctionFactory = ExternalAdminFunction::factory().into();
+    let udf = factory.provide(FunctionContext::default());
+
+    assert_eq!(udf.name(), "external_admin");
+    assert_eq!(udf.signature(), &signature());
+    assert!(udf.as_async().is_some());
+}
```

**File**: `src/common/macro/src/admin_fn.rs` (modified, +5/-0)
```diff
@@ -311,6 +311,11 @@ fn build_struct(
                 // Safety check: Ensure under the `greptime` catalog for security
                 #user_path::ensure_greptime!(self.func_ctx);
 
+                #user_path::ensure_admin_privilege(
+                    &self.func_ctx,
+                    #display_name,
+                )?;
+
                 // Zero-argument functions also execute once per input row.
                 let rows_num = columns.first().map_or(args.number_rows, |column| column.len());
                 #validate_rows
```

**File**: `tests-integration/src/instance.rs` (modified, +131/-0)
```diff
@@ -291,6 +291,137 @@ mod tests {
         )
     }
 
+    #[tokio::test(flavor = "multi_thread")]
+    async fn test_select_admin_function_requires_admin_privilege() {
+        use auth::{
+            DefaultPermissionChecker, Identity, Password, PermissionCheckerRef, UserProvider,
+            static_user_provider_from_option,
+        };
+
+        let plugins = Plugins::new();
+        plugins.insert::<PermissionCheckerRef>(DefaultPermissionChecker::arc());
+        let standalone =
+            GreptimeDbStandaloneBuilder::new("test_select_admin_function_requires_admin_privilege")
+                .with_plugin(plugins)
+                .build()
+                .await;
+        let instance = standalone.fe_instance();
+
+        create_table(
+            instance,
+            "CREATE TABLE admin_fn_demo(host STRING, ts TIMESTAMP TIME INDEX)",
+        )
+        .await;
+
+        async fn user_ctx(username: &str, mode: &str) -> QueryContextRef {
+            let provider = static_user_provider_from_option(&format!(
+                "static_user_provider:cmd:{username}:{mode}={username}_pwd"
+            ))
+            .unwrap();
+            let user = provider
+                .authenticate(
+                    Identity::UserId(username, None),
+                    Password::PlainText(format!("{username}_pwd").into()),
+                )
+                .await
+                .unwrap();
+            let ctx = QueryContext::arc();
+            ctx.set_current_user(user);
+            ctx
+        }
+
+        async fn assert_select_admin_denied(instance: &Instance, ctx: &QueryContextRef) {
+            for sql in [
+                "SELECT flush_table('admin_fn_demo')",
+                "SELECT compact_table('admin_fn_demo')",
+                "SELECT flush_region(0)",
+                "SELECT compact_region(0)",
+                "SELECT migrate_region(1, 2, 3)",
+                "SELECT gc_regions(0)",
+                "SELECT gc_table('admin_fn_demo')",
+                "SELECT build_index('admin_fn_demo')",
+                "SELECT build_series_index('admin_fn_demo')",
+                "SELECT flush_flow('admin_fn_demo')",
+                "SELECT reconcile_catalog()",
+                "SELECT reconcile_database('public')",
+                "SELECT reconcile_table('admin_fn_demo')",
+            ] {
+                let mut results = SqlQueryHandler::do_query(instance, sql, ctx.clone()).await;
+                let output = results
+                    .remove(0)
+                    .unwrap_or_else(|e| panic!("unexpected error for {sql}: {e}"));
+                let OutputData::Stream(stream) = output.data else {
+                    panic!("{sql} must return a stream, got {:?}", output.data)
+                };
+                let err = common_recordbatch::util::collect_batches(stream)
+                    .await
+                    .expect_err("read-only user must be denied");
+                assert_eq!(
+                    StatusCode::PermissionDenied,
+                    err.status_code(),
+                    "unexpected error for {sql}: {err}"
+                );
+            }
+        }
+
+        let readonly_ctx = user_ctx("ro_user", "ro").await;
+        let readwrite_ctx = user_ctx("rw_user", "rw").await;
+
+        assert_select_admin_denied(instance, &readonly_ctx).await;
+
+        let mut results = SqlQueryHandler::do_query(
+            instance.as_ref(),
+            "ADMIN FLUSH_TABLE('admin_fn_demo')",
+            readwrite_ctx.clone(),
+        )
+        .await;
+        assert!(
+            results.remove(0).is_ok(),
+            "ADMIN FLUSH_TABLE must keep working for read-write users"
+        );
+
+        for sql in [
+            "SELECT flush_table('admin_fn_demo')",
+            "SELECT compact_table('admin_fn_demo')",
+        ] {
+            let mut results =
+                SqlQueryHandler::do_query(instance.as_ref(), sql, readwrite_ctx.clone()).await;
+            let output = results
+                .remove(0)
+                .unwrap_or_else(|e| panic!("unexpected error for {sql}: {e}"));
+            let OutputData::Stream(stream) = output.data else {
+                panic!("{sql} must return a stream");
+            };
+            let batches = common_recordbatch::util::collect_batches(stream)
+                .await
+                .unwrap_or_else(|e| panic!("unexpected error for {sql}: {e}"));
+            assert_eq!(
+                1,
+                batches.iter().count(),
+                "{sql} must return one record batch"
+            );
+        }
+
+        let mut results = SqlQueryHandler::do_query(
+            instance.as_ref(),
+            "ADMIN FLUSH_TABLE('admin_fn_demo')",
+            readonly_ctx.clone(),
+        )
+        .await;
+        let err = results.remove(0).unwrap_err();
+        assert_eq!(
+            StatusCode::PermissionDenied,
+            err.status_code(),
+            "unexpected error: {err}"

```

---

### Incident Patch 3: `2cb47360` (2026-11-05)
**Commit Message**: fix(grpc): propagate cancellation for read query execution (#10166)

* x

* fix(grpc): restrict cascading cancellation to read query variants

Signed-off-by: luofucong <[REDACTED_EMAIL]>

---------

Signed-off-by: luofucong <[REDACTED_EMAIL]>

**File**: `src/servers/src/grpc/greptime_handler.rs` (modified, +151/-15)
```diff
@@ -22,7 +22,8 @@ use std::time::Instant;
 
 use api::helper::request_type;
 use api::v1::greptime_request::Request as QueryRequest;
-use api::v1::{GreptimeRequest, RequestHeader};
+use api::v1::query_request::Query;
+use api::v1::{GreptimeRequest, QueryRequest as ApiQueryRequest, RequestHeader};
 use auth::UserProviderRef;
 use common_catalog::consts::{DEFAULT_CATALOG_NAME, DEFAULT_SCHEMA_NAME};
 use common_catalog::parse_catalog_and_schema_from_db_string;
@@ -42,6 +43,7 @@ use session::hints::{INSERT_SKIP_WAL_HINT, READ_PREFERENCE_HINT, is_reserved_ext
 use snafu::{OptionExt, ResultExt};
 use tokio::sync::mpsc;
 use tokio::sync::mpsc::error::TrySendError;
+use tokio_util::task::AbortOnDropHandle;
 use tonic::Status;
 
 use crate::error::{InvalidQuerySnafu, JoinTaskSnafu, Result, UnknownHintSnafu};
@@ -108,6 +110,13 @@ impl GreptimeRequestHandler {
     ) -> impl Future<Output = Result<Output>> + Send + 'static {
         let handler = self.handler.clone();
         let runtime = self.runtime.clone();
+        // SQL can contain writes or DDL; only explicit read-query variants are cancellable.
+        let cancel_on_drop = matches!(
+            &query,
+            QueryRequest::Query(ApiQueryRequest {
+                query: Some(Query::LogicalPlan(_) | Query::PromRangeQuery(_)),
+            })
+        );
         let request_type = request_type(&query).to_string();
         let db = query_ctx.get_db_string();
         let timer = RequestTimer::new(db.clone(), request_type);
@@ -135,20 +144,17 @@ impl GreptimeRequestHandler {
 
             match runtime {
                 Some(runtime) => {
-                    // Executes requests in another runtime to
-                    // 1. prevent the execution from being cancelled unexpected by Tonic runtime;
-                    //   - Refer to our blog for the rational behind it:
-                    //     https://www.greptime.com/blogs/2023-01-12-hidden-control-flow.html
-                    //   - Obtaining a `JoinHandle` to get the panic message (if there's any).
-                    //     From its docs, `JoinHandle` is cancel safe. The task keeps running even it's handle been dropped.
-                    // 2. avoid the handler blocks the gRPC runtime incidentally.
-                    runtime
-                        .spawn(result_future)
-                        .await
-                        .context(JoinTaskSnafu)
-                        .inspect_err(|e| {
-                            timer.record(e.status_code());
-                        })?
+                    let task = runtime.spawn(result_future);
+                    let result = if cancel_on_drop {
+                        AbortOnDropHandle::new(task).await
+                    } else {
+                        // Writes must outlive the RPC to avoid cancellation between state updates.
+                        // https://www.greptime.com/blogs/2023-01-12-hidden-control-flow.html
+                        task.await
+                    };
+                    result.context(JoinTaskSnafu).inspect_err(|e| {
+                        timer.record(e.status_code());
+                    })?
                 }
                 None => result_future.await,
             }
@@ -317,20 +323,150 @@ impl Drop for RequestTimer {
 
 #[cfg(test)]
 mod tests {
+    use std::error::Error as StdError;
+    use std::result::Result as StdResult;
+    use std::time::Duration;
+
+    use async_trait::async_trait;
     use chrono::FixedOffset;
     use common_error::ext::BoxedError;
     use common_error::{GREPTIME_DB_HEADER_ERROR_CODE, GREPTIME_DB_HEADER_ERROR_RETRY_HINT};
     use common_time::Timezone;
+    use futures::stream::{self, BoxStream};
     use query::options::FLOW_SCHEDULED_TIME_MILLIS;
+    use session::context::QueryContext;
     use session::hints::{
         INITIAL_REMOTE_DYN_FILTER_REGISTRATIONS_EXTENSION_KEY, READ_PREFERENCE_EXTENSION_KEY,
         REMOTE_QUERY_ID_EXTENSION_KEY,
     };
     use snafu::ResultExt;
+    use tokio::sync::Notify;
+    use tokio::time::timeout;
     use tonic::Code;
 
     use super::*;
     use crate::error::{ExecuteGrpcRequestSnafu, InvalidParameterSnafu};
+    use crate::query_handler::grpc::GrpcQueryHandler;
+
+    struct BlockingQueryHandler {
+        started: Arc<Notify>,
+        finished: Arc<Notify>,
+        resume: Arc<Notify>,
+        completed: Arc<Notify>,
+    }
+
+    struct QueryFinished(Arc<Notify>);
+
+    impl Drop for QueryFinished {
+        fn drop(&mut self) {
+            self.0.notify_one();
+        }
+    }
+
+    #[async_trait]
+    impl GrpcQueryHandler for BlockingQueryHandler {
+        async fn do_query(&self, _: QueryRequest, _: QueryContextRef) -> Result<Output> {
+            let _finished = QueryFinished(self.finished.clone());
+            self.started.notify_one();
+            self.resume.notified().await;
+            self.completed.notify_one();
+            Ok(Output::new_with_affected_rows(1))
+        }
+
+        
```

#### Recent Merged Pull Requests:
- **PR #10170** (2026-11-05): test(compat): exercise the bloom-token case only below v1.3.0 (@discord9)
- **PR #10166** (2026-11-05): fix(grpc): propagate cancellation for read query execution (@MichaelScofield)
- **PR #10161** (closed): feat: expose live compaction tasks in information schema (@WenyXu)
- **PR #10158** (closed): docs(ci): clarify AWS runner region configuration (@WenyXu)
- **PR #10156** (2026-11-05): fix(ci): prepare Ubuntu build runners and default EC2 disks to 500 GiB (@WenyXu)
- **PR #10153** (2026-11-04): fix(catalog): use advertised peer address as process identity (@v0y4g3r)

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

## X. catalog): use advertised peer address as process identity (#10153)

**RULE**:
When implementing operations in `src/catalog/src/process_manager.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in GreptimeTeam/greptimedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `557843dd`: catalog): use advertised peer address as process identity (#10153). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/catalog/src/process_manager.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    /// Address this frontend advertises to the cluster.
    ///
    /// It is the heartbeat peer address, which is also the only address other
    /// frontends use to reach this node's process management service. The same
    /// value identifies processes owned by this frontend and routes kill
    /// requests, so discovery addresses and process addresses share one
    /// namespace.
    peer_addr: String,
    /// Creates a [ProcessManager] for the frontend identified by `peer_addr`.
    ///
    /// `peer_addr` must be the address the frontend advertises to metasrv, not
    /// its public gRPC address: discovered peers are matched by that address to
    /// exclude this node from remote listings and to route kill requests.
    pub fn new(peer_addr: String, meta_client: Option<MetaClientRef>) -> Self {
            peer_addr,
            frontend: self.peer_addr.clone(),
    /// The local frontend is excluded from the remote selection by its advertised
    /// peer address, which is what [`MetaClientSelector`] discovers. Its processes
    /// are appended from the local registry exactly once.
    ///
                .select(|peer| peer.addr != self.peer_addr)
    ///
    /// `peer
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
    /// Local frontend server address,
    server_addr: String,
    /// Create a [ProcessManager] instance with server address and kv client.
    pub fn new(server_addr: String, meta_client: Option<MetaClientRef>) -> Self {
            server_addr,
            frontend: self.server_addr.clone(),
                .select(|peer| peer.addr != self.server_addr)
        server_addr: String,
        if server_addr == self.server_addr {
                .select(|peer| peer.addr == server_addr)
                error::FrontendNotFoundSnafu { addr: server_addr }
                server_addr,
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `557843dd` are properly handled with clean fallback behavior.
