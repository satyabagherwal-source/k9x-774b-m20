> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/greptimeteam-greptimedb-learnings.md`  
> **Source**: github ([https://github.com/GreptimeTeam/greptimedb](https://github.com/GreptimeTeam/greptimedb))  
> **Source Version**: `62ebf71f`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-28T00:53:42.582Z  
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
> **Harvest Timestamp**: 2026-10-28T00:53:42.397Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GreptimeTeam/greptimedb`
- **Description**: The open-source observability database. One columnar engine for metrics, logs, and traces, on object storage.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6768 stars

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
- **Issue #10013** (2026-10-27): **fix(query): stop windowed sort on precision-lowering time casts [Backport release/v1.3]**
  *Symptoms*: Backport of #9524 to release/v1.3.  --- Original PR: #9524 Merged by: @WenyXu

- **Issue #10012** (2026-10-27): **perf(mito2): index encoded bulk parts from memory during flush [Backport release/v1.3]**
  *Symptoms*: Backport of #9913 to release/v1.3.  --- Original PR: #9913 Merged by: @killme2008 

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

### Incident Patch 1: `44df6e5d` (2026-10-27)
**Commit Message**: fix(mito2): coordinate range cache invalidation and singleflight reads (#9935)

* fix(mito2): invalidate retired SST range results and coalesce loads

Coordinate decoded range loads by their full scan key, bound shared work, and prevent late fills after SST retirement. Invalidate range results for local purge and object-store GC while preserving old snapshot reads.

Fixes #9934

Signed-off-by: Lei, HUANG <[REDACTED_EMAIL]>

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
  runs in the last FileHandleInner::drop (Arc::strong_count == 1, wh

**File**: `src/mito2/src/cache.rs` (modified, +88/-19)
```diff
@@ -19,6 +19,7 @@ pub(crate) mod cache_size;
 pub(crate) mod file_cache;
 pub(crate) mod index;
 pub(crate) mod manifest_cache;
+pub(crate) mod range_cache;
 #[cfg(test)]
 pub(crate) mod test_util;
 pub(crate) mod write_cache;
@@ -145,6 +146,40 @@ impl RangeResultMemoryLimiter {
         self.semaphore.available_permits()
     }
 
+    /// Never wait while holding a partial load: several partial loads could
+    /// otherwise exhaust the budget and wait on each other indefinitely.
+    pub(crate) fn try_acquire(&self, bytes: usize) -> Option<tokio::sync::OwnedSemaphorePermit> {
+        let permits = bytes.div_ceil(self.permit_bytes).max(1);
+        if permits > self.total_permits {
+            return None;
+        }
+        self.semaphore
+            .clone()
+            .try_acquire_many_owned(permits.try_into().ok()?)
+            .ok()
+    }
+
+    /// Transfers a load's reservation to its completed result without a gap in
+    /// accounting. Compaction may shrink buffers or add metadata; growing the
+    /// reservation must remain nonblocking just like loading more input.
+    pub(crate) fn try_resize(
+        &self,
+        permit: Option<tokio::sync::OwnedSemaphorePermit>,
+        bytes: usize,
+    ) -> Option<tokio::sync::OwnedSemaphorePermit> {
+        let Some(mut permit) = permit else {
+            return self.try_acquire(bytes);
+        };
+        let required = bytes.div_ceil(self.permit_bytes).max(1);
+        let reserved = permit.num_permits();
+        if required > reserved {
+            permit.merge(self.try_acquire((required - reserved).checked_mul(self.permit_bytes)?)?);
+        } else {
+            drop(permit.split(reserved - required));
+        }
+        Some(permit)
+    }
+
     pub(crate) async fn acquire(&self, bytes: usize) -> Result<tokio::sync::SemaphorePermit<'_>> {
         let permits = bytes.div_ceil(self.permit_bytes).max(1);
         if permits > self.total_permits {
@@ -898,6 +933,7 @@ impl CacheStrategy {
 
     /// Calls [CacheManager::get_range_result()].
     /// It returns None if the strategy is [CacheStrategy::Compaction] or [CacheStrategy::Disabled].
+    #[cfg(test)]
     pub(crate) fn get_range_result(
         &self,
         key: &RangeScanCacheKey,
@@ -910,6 +946,7 @@ impl CacheStrategy {
 
     /// Calls [CacheManager::put_range_result()].
     /// It does nothing if the strategy isn't [CacheStrategy::EnableAll].
+    #[cfg(any(test, feature = "test"))]
     pub(crate) fn put_range_result(
         &self,
         key: RangeScanCacheKey,
@@ -920,6 +957,13 @@ impl CacheStrategy {
         }
     }
 
+    pub(crate) fn range_cache_worker(&self) -> Option<&Arc<range_cache::RangeCacheWorker>> {
+        match self {
+            Self::EnableAll(manager) => manager.range_result_cache.as_ref(),
+            Self::Compaction(_) | Self::Disabled => None,
+        }
+    }
+
     /// Returns true if the range result cache is enabled.
     pub(crate) fn has_range_result_cache(&self) -> bool {
         match self {
@@ -1389,7 +1433,15 @@ impl CacheManager {
         }
     }
 
+    /// Retires decoded range results when an SST leaves the current version.
+    pub(crate) fn invalidate_range_results(&self, file_id: FileId) {
+        if let Some(worker) = &self.range_result_cache {
+            worker.invalidate_file(file_id);
+        }
+    }
+
     /// Gets cached result for range scan.
+    #[cfg(test)]
     pub(crate) fn get_range_result(
         &self,
         key: &RangeScanCacheKey,
@@ -1400,15 +1452,13 @@ impl CacheManager {
     }
 
     /// Puts range scan result into cache.
+    #[cfg(any(test, feature = "test"))]
     pub(crate) fn put_range_result(
         &self,
         key: RangeScanCacheKey,
         result: Arc<RangeScanCacheValue>,
     ) {
         if let Some(cache) = &self.range_result_cache {
-            CACHE_BYTES
-                .with_label_values(&[RANGE_RESULT_TYPE])
-                .add(range_result_cache_weight(&key, &result).into());
             cache.insert(key, result);
         }
     }
@@ -1649,21 +1699,8 @@ impl CacheManagerBuilder {
                 })
                 .build()
         });
-        let range_result_cache = (self.range_result_cache_size != 0).then(|| {
-            Cache::builder()
-                .max_capacity(self.range_result_cache_size)
-                .weigher(range_result_cache_weight)
-                .eviction_listener(move |k, v, cause| {
-                    let size = range_result_cache_weight(&k, &v);
-                    CACHE_BYTES
-                        .with_label_values(&[RANGE_RESULT_TYPE])
-                        .sub(size.into());
-                    CACHE_EVICTION
-                        .with_label_values(&[RANGE_RESULT_TYPE, removal_cause_str(cause)])
-                        .inc();
-                })
-                .build()
-        });
+        let range_result_cache = (self.range_result_cache_size != 0)
+            .then(|| range_cache::RangeCacheWo
```

**File**: `src/mito2/src/cache/range_cache.rs` (added, +733/-0)
```diff
@@ -0,0 +1,733 @@
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
+//! Coordinates range-result cache loads and SST retirement. No I/O or decoding
+//! runs under the coordinator lock; loaders use the shared query runtime.
+
+use std::collections::HashMap;
+use std::future::Future;
+use std::sync::{Arc, Mutex, Weak, mpsc};
+
+use moka::sync::Cache;
+use store_api::storage::FileId;
+use tokio::sync::{OwnedSemaphorePermit, watch};
+
+use crate::cache::{
+    RANGE_RESULT_TYPE, RangeResultMemoryLimiter, range_result_cache_weight, removal_cause_str,
+};
+use crate::metrics::{CACHE_BYTES, CACHE_EVICTION, RANGE_CACHE_WORKER_EVENTS};
+use crate::read::range_cache::{RangeScanCacheKey, RangeScanCacheValue};
+use crate::sst::file::FileHandle;
+
+/// Admission, not a queue: excess distinct misses keep using ordinary scans.
+const MAX_IN_FLIGHT_RANGES: usize = 32;
+
+type SharedResult = Option<Arc<RangeCacheDelivery>>;
+
+/// Keeps completed results charged while subscribers or replay streams own them.
+/// Cache entries retain only a weak reference: after the last reader leaves,
+/// the resident value is covered solely by the cache's capacity accounting.
+pub(crate) struct RangeCacheDelivery {
+    value: Arc<RangeScanCacheValue>,
+    _permit: OwnedSemaphorePermit,
+}
+
+impl RangeCacheDelivery {
+    /// Shares a decoded result together with its memory reservation.
+    pub(crate) fn new(value: Arc<RangeScanCacheValue>, permit: OwnedSemaphorePermit) -> Arc<Self> {
+        Arc::new(Self {
+            value,
+            _permit: permit,
+        })
+    }
+
+    /// Borrows the result without detaching it from the delivery reservation.
+    pub(crate) fn value(&self) -> &RangeScanCacheValue {
+        &self.value
+    }
+}
+
+pub(crate) enum RangeCacheLookup {
+    Hit(Arc<RangeCacheDelivery>),
+    Loading(watch::Receiver<SharedResult>),
+    Bypass,
+}
+
+struct Entry {
+    generation: u64,
+    value: Arc<RangeScanCacheValue>,
+    delivery: Mutex<Weak<RangeCacheDelivery>>,
+}
+
+impl Entry {
+    fn deliver(&self, memory: &RangeResultMemoryLimiter) -> SharedResult {
+        // Serialize cache-hit reservations so readers of the same result share
+        // one charge, including when the last previous reader just left.
+        let mut shared_delivery = self
+            .delivery
+            .lock()
+            .unwrap_or_else(std::sync::PoisonError::into_inner);
+        if let Some(delivery) = shared_delivery.upgrade() {
+            return Some(delivery);
+        }
+        let permit = memory.try_acquire(self.value.estimated_size())?;
+        let delivery = RangeCacheDelivery::new(self.value.clone(), permit);
+        *shared_delivery = Arc::downgrade(&delivery);
+        Some(delivery)
+    }
+}
+
+struct Flight {
+    generation: u64,
+    sender: watch::Sender<SharedResult>,
+    invalidated: bool,
+}
+
+#[derive(Default)]
+struct State {
+    generation: u64,
+    flights: HashMap<RangeScanCacheKey, Flight>,
+    /// File IDs are globally unique. Index by physical file, not query region:
+    /// a copied region can read an SST whose original region differs from its own.
+    files: HashMap<FileId, HashMap<Arc<RangeScanCacheKey>, u64>>,
+}
+
+impl State {
+    fn next_generation(&mut self) -> u64 {
+        self.generation += 1;
+        self.generation
+    }
+
+    fn forget(&mut self, key: &RangeScanCacheKey, generation: u64) {
+        for (file, _) in &key.row_groups {
+            if let Some(keys) = self.files.get_mut(file) {
+                // Eviction callbacks may arrive after the same key is refilled.
+                if keys.get(key) == Some(&generation) {
+                    keys.remove(key);
+                }
+                if keys.is_empty() {
+                    self.files.remove(file);
+                }
+            }
+        }
+    }
+}
+
+pub(crate) struct RangeCacheWorker {
+    cache: Cache<RangeScanCacheKey, Arc<Entry>>,
+    state: Mutex<State>,
+    /// Moka can call listeners during a cache operation. Queue only cleanup
+    /// metadata instead of reentering `state` from its eviction listener.
+    evictions: Mutex<mpsc::Receiver<(Arc<RangeScanCacheKey>, u64)>>,
+    /// Covers loads and completed deliveries, separately from cache residency
+    /// and the temporary concat-memory limiter. Never wait for this budget.
+    pub(crate) load_memory: RangeResultMemoryLimiter,
+}
+
+impl RangeCacheWorker {
+    pub(crate) 
```

**File**: `src/mito2/src/cache/test_util.rs` (modified, +26/-0)
```diff
@@ -145,3 +145,29 @@ pub(crate) fn assert_parquet_metadata_equal(x: Arc<ParquetMetaData>, y: Arc<Parq
     let y = normalize_statistics(Arc::unwrap_or_clone(y));
     assert_eq!(x, y);
 }
+
+/// A file-only range key shared by cache and SST-lifecycle regression tests.
+pub(crate) fn range_cache_key(
+    files: &[store_api::storage::FileId],
+) -> crate::read::range_cache::RangeScanCacheKey {
+    use crate::read::range_cache::{RangeScanCacheKey, ScanRequestFingerprintBuilder};
+    use crate::read::read_columns::ReadColumns;
+
+    RangeScanCacheKey {
+        region_id: store_api::storage::RegionId::new(1, 1),
+        row_groups: files.iter().map(|file| (*file, 0)).collect(),
+        scan: ScanRequestFingerprintBuilder {
+            read_columns: ReadColumns::new(std::iter::empty()),
+            read_column_types: vec![],
+            filters: vec![],
+            time_filters: vec![],
+            series_row_selector: None,
+            append_mode: false,
+            filter_deleted: true,
+            merge_mode: crate::region::options::MergeMode::LastRow,
+            sequence_range: None,
+            partition_expr_version: 0,
+        }
+        .build(),
+    }
+}
```

**File**: `src/mito2/src/metrics.rs` (modified, +8/-0)
```diff
@@ -319,6 +319,14 @@ lazy_static! {
         "mito upload bytes total",
     )
     .unwrap();
+    /// Bounded event labels distinguish lookup misses from actual shared loads.
+    pub static ref RANGE_CACHE_WORKER_EVENTS: IntCounterVec = register_int_counter_vec!(
+        "greptime_mito_range_cache_worker_events_total",
+        "Range cache load coordination and SST retirement events",
+        &["event"]
+    )
+    .unwrap();
+
     /// Cache eviction counter, labeled with cache type and eviction reason.
     pub static ref CACHE_EVICTION: IntCounterVec = register_int_counter_vec!(
         "greptime_mito_cache_eviction",
```

**File**: `src/mito2/src/read/range_cache.rs` (modified, +467/-84)
```diff
@@ -14,6 +14,7 @@
 
 //! Utilities for the partition range scan result cache.
 
+use std::future::Future;
 use std::mem;
 use std::sync::Arc;
 
@@ -36,6 +37,7 @@ use table::predicate::is_string_timestamp_literal;
 use tokio::sync::{mpsc, oneshot};
 
 use crate::cache::CacheStrategy;
+use crate::cache::range_cache::{RangeCacheDelivery, RangeCacheLookup, RangeCacheWorker};
 use crate::error::{ComputeArrowSnafu, Result};
 use crate::read::BoxedRecordBatchStream;
 use crate::read::read_columns::ReadColumns;
@@ -608,9 +610,14 @@ fn build_range_cache_key_inner(
 }
 
 /// Returns a stream that replays cached record batches.
-pub(crate) fn cached_flat_range_stream(value: Arc<RangeScanCacheValue>) -> BoxedRecordBatchStream {
+pub(crate) fn cached_flat_range_stream(
+    delivery: Arc<RangeCacheDelivery>,
+) -> BoxedRecordBatchStream {
     Box::pin(try_stream! {
-        for cached_batch in &value.cached_batches {
+        // Borrow through the delivery guard so it survives every yield. Batches
+        // handed to downstream operators are then owned by the query, not by
+        // this completed-result backlog.
+        for cached_batch in &delivery.value().cached_batches {
             let mut offset = 0;
             for &len in &cached_batch.slice_lengths {
                 yield cached_batch.batch.slice(offset, len);
@@ -620,14 +627,147 @@ pub(crate) fn cached_flat_range_stream(value: Arc<RangeScanCacheValue>) -> Boxed
     })
 }
 
+/// Builds only one decoded result per full cache key. A load must be driven
+/// independently of any caller: merge readers can wait for another stream with
+/// the same key before polling their first stream to completion.
+pub(crate) struct CachedRangeReader<'a> {
+    pub(crate) stream_ctx: &'a StreamContext,
+    pub(crate) part_range: &'a PartitionRange,
+    pub(crate) key: Option<RangeScanCacheKey>,
+    pub(crate) metrics: &'a PartitionMetrics,
+}
+
+impl CachedRangeReader<'_> {
+    pub(crate) async fn build<F, Fut>(self, build: F) -> Result<(BoxedRecordBatchStream, usize)>
+    where
+        F: FnOnce() -> Fut + Clone + Send + 'static,
+        Fut: Future<Output = Result<(BoxedRecordBatchStream, usize)>> + Send + 'static,
+    {
+        let Self {
+            stream_ctx,
+            part_range,
+            key,
+            metrics,
+        } = self;
+        let strategy = &stream_ctx.input.cache_strategy;
+        let (Some(key), Some(worker)) = (key, strategy.range_cache_worker()) else {
+            return build().await;
+        };
+        let files = stream_ctx.ranges[part_range.identifier]
+            .row_group_indices
+            .iter()
+            .map(|index| stream_ctx.input.file_from_index(*index).clone())
+            .collect();
+        let loader = build.clone();
+        let load_worker = worker.clone();
+        let load_strategy = strategy.clone();
+        let load_metrics = metrics.clone();
+        let key_size = key.estimated_size();
+        match worker.get_or_load(key, files, async move {
+            let result = async {
+                let (stream, _) = loader().await?;
+                collect_range_result(stream, &load_worker, &load_strategy).await
+            }
+            .await;
+            match result {
+                Ok(Some(value)) => {
+                    load_metrics.inc_range_cache_size(key_size + value.value().estimated_size());
+                    Some(value)
+                }
+                Ok(None) => None,
+                Err(error) => {
+                    warn!(error; "Failed to load range cache; falling back to an uncached scan");
+                    None
+                }
+            }
+        }) {
+            RangeCacheLookup::Hit(value) => {
+                metrics.inc_range_cache_hit();
+                Ok((cached_flat_range_stream(value), DEFAULT_READ_BATCH_SIZE))
+            }
+            RangeCacheLookup::Loading(receiver) => {
+                metrics.inc_range_cache_miss();
+                Ok((
+                    shared_range_stream(receiver, build),
+                    DEFAULT_READ_BATCH_SIZE,
+                ))
+            }
+            RangeCacheLookup::Bypass => {
+                metrics.inc_range_cache_miss();
+                build().await
+            }
+        }
+    }
+}
+
+/// Waiting is lazy, but the producer is independent of every consumer.
+fn shared_range_stream<F, Fut>(
+    mut receiver: tokio::sync::watch::Receiver<Option<Arc<RangeCacheDelivery>>>,
+    build: F,
+) -> BoxedRecordBatchStream
+where
+    F: FnOnce() -> Fut + Send + 'static,
+    Fut: Future<Output = Result<(BoxedRecordBatchStream, usize)>> + Send + 'static,
+{
+    Box::pin(try_stream! {
+        let cached = receiver.wait_for(|cached| cached.is_some()).await
+            .ok().and_then(|cached| cached.clone());
+        drop(receiver);
+        let mut stream = if let Some(cached) = cached {
+            cached_flat_range_stream(cached)
+        } else {
+            // A failed/oversize
```

**File**: `src/mito2/src/read/seq_scan.rs` (modified, +32/-20)
```diff
@@ -42,9 +42,7 @@ use crate::read::flat_merge::FlatMergeReader;
 use crate::read::last_row::FlatLastRowReader;
 use crate::read::pruner::{PartitionPruner, Pruner};
 use crate::read::range::RangeMeta;
-use crate::read::range_cache::{
-    build_range_cache_key, cache_flat_range_stream, cached_flat_range_stream,
-};
+use crate::read::range_cache::{CachedRangeReader, build_range_cache_key};
 use crate::read::scan_region::{ScanInput, StreamContext};
 use crate::read::scan_util::{
     BATCH_SIZE_THRESHOLD, MIN_COMPACTION_SPLIT_ROWS, PartitionMetrics, PartitionMetricsList,
@@ -307,15 +305,39 @@ impl SeqScan {
                 key
             }
         });
-
-        if let Some(key) = cache_key.as_ref() {
-            if let Some(value) = stream_ctx.input.cache_strategy.get_range_result(key) {
-                part_metrics.inc_range_cache_hit();
-                return Ok((cached_flat_range_stream(value), DEFAULT_READ_BATCH_SIZE));
-            }
-            part_metrics.inc_range_cache_miss();
+        let ctx = stream_ctx.clone();
+        let range = *part_range;
+        let metrics = part_metrics.clone();
+        CachedRangeReader {
+            stream_ctx,
+            part_range,
+            key: cache_key,
+            metrics: part_metrics,
         }
+        .build(move || async move {
+            Self::build_uncached_partition_range(
+                &ctx,
+                &range,
+                read_mode,
+                &metrics,
+                partition_pruner,
+                file_scan_semaphore,
+                merge_semaphore,
+            )
+            .await
+        })
+        .await
+    }
 
+    async fn build_uncached_partition_range(
+        stream_ctx: &Arc<StreamContext>,
+        part_range: &PartitionRange,
+        read_mode: FlatReadMode,
+        part_metrics: &PartitionMetrics,
+        partition_pruner: Arc<PartitionPruner>,
+        file_scan_semaphore: Option<Arc<Semaphore>>,
+        merge_semaphore: Option<Arc<Semaphore>>,
+    ) -> Result<(BoxedRecordBatchStream, usize)> {
         let mut sources = Vec::new();
         let split_batch_size = build_flat_sources(
             stream_ctx,
@@ -339,16 +361,6 @@ impl SeqScan {
         )
         .await?;
 
-        let stream = match cache_key {
-            Some(key) => cache_flat_range_stream(
-                stream,
-                stream_ctx.input.cache_strategy.clone(),
-                key,
-                part_metrics.clone(),
-            ),
-            None => stream,
-        };
-
         Ok((stream, estimated_rows_per_batch))
     }
 
```

**File**: `src/mito2/src/read/series_candidate.rs` (modified, +23/-18)
```diff
@@ -47,9 +47,7 @@ use crate::error::{
 use crate::read::BoxedRecordBatchStream;
 use crate::read::pruner::{PartitionPruner, Pruner};
 use crate::read::range::RowGroupIndex;
-use crate::read::range_cache::{
-    build_candidate_range_cache_key, cache_flat_range_stream, cached_flat_range_stream,
-};
+use crate::read::range_cache::{CachedRangeReader, build_candidate_range_cache_key};
 use crate::read::scan_region::StreamContext;
 use crate::read::scan_util::{PartitionMetrics, new_filter_metrics, scan_flat_mem_ranges};
 use crate::series_index::{
@@ -371,14 +369,29 @@ impl SeriesCandidateRangeBuilder {
         } else {
             build_candidate_range_cache_key(&self.stream_ctx, &part_range)
         };
-        if let Some(key) = cache_key.as_ref() {
-            if let Some(value) = self.stream_ctx.input.cache_strategy.get_range_result(key) {
-                self.part_metrics.inc_range_cache_hit();
-                return Ok(cached_flat_range_stream(value));
-            }
-            self.part_metrics.inc_range_cache_miss();
+        let builder = self.clone();
+        let (stream, _) = CachedRangeReader {
+            stream_ctx: &self.stream_ctx,
+            part_range: &part_range,
+            key: cache_key,
+            metrics: &self.part_metrics,
         }
+        .build(move || async move {
+            let stream = builder
+                .build_uncached_range_stream(part_range, merge_partition)
+                .await?;
+            Ok((stream, DEFAULT_READ_BATCH_SIZE))
+        })
+        .await?;
+        Ok(stream)
+    }
 
+    async fn build_uncached_range_stream(
+        &self,
+        part_range: PartitionRange,
+        merge_partition: usize,
+    ) -> Result<BoxedRecordBatchStream> {
+        let range_meta = &self.stream_ctx.ranges[part_range.identifier];
         let mut sources = Vec::with_capacity(range_meta.row_group_indices.len());
         for index in &range_meta.row_group_indices {
             let source = self.build_source(*index, range_meta.time_range).await?;
@@ -400,15 +413,7 @@ impl SeriesCandidateRangeBuilder {
             "SeriesCandidateScanner::range_merge",
         )?;
 
-        Ok(match cache_key {
-            Some(key) => cache_flat_range_stream(
-                stream,
-                self.stream_ctx.input.cache_strategy.clone(),
-                key,
-                self.part_metrics.clone(),
-            ),
-            None => stream,
-        })
+        Ok(stream)
     }
 
     async fn build_source(
```

**File**: `src/mito2/src/read/series_reader.rs` (modified, +29/-18)
```diff
@@ -31,9 +31,7 @@ use crate::error::InvalidRequestSnafu;
 use crate::error::{JoinSnafu, Result, UnexpectedSnafu};
 use crate::read::BoxedRecordBatchStream;
 use crate::read::pruner::PartitionPruner;
-use crate::read::range_cache::{
-    build_series_range_cache_key, cache_flat_range_stream, cached_flat_range_stream,
-};
+use crate::read::range_cache::{CachedRangeReader, build_series_range_cache_key};
 use crate::read::scan_region::StreamContext;
 use crate::read::scan_util::{
     PartitionMetrics, SplitRecordBatchStream, compute_average_batch_size,
@@ -377,14 +375,36 @@ async fn build_series_partition_range(
         .enable_range_cache
         .then(|| build_series_range_cache_key(&stream_ctx, &part_range, range))
         .flatten();
-    if let Some(key) = cache_key.as_ref() {
-        if let Some(value) = stream_ctx.input.cache_strategy.get_range_result(key) {
-            part_metrics.inc_range_cache_hit();
-            return Ok((cached_flat_range_stream(value), DEFAULT_READ_BATCH_SIZE));
-        }
-        part_metrics.inc_range_cache_miss();
+    let ctx = stream_ctx.clone();
+    let metrics = part_metrics.clone();
+    CachedRangeReader {
+        stream_ctx: &stream_ctx,
+        part_range: &part_range,
+        key: cache_key,
+        metrics: &part_metrics,
     }
+    .build(move || async move {
+        build_uncached_series_partition_range(
+            ctx,
+            part_range,
+            filter,
+            codec,
+            partition_pruner,
+            metrics,
+        )
+        .await
+    })
+    .await
+}
 
+async fn build_uncached_series_partition_range(
+    stream_ctx: Arc<StreamContext>,
+    part_range: PartitionRange,
+    filter: MetricSeriesFilter,
+    codec: SparsePrimaryKeyCodec,
+    partition_pruner: Arc<PartitionPruner>,
+    part_metrics: PartitionMetrics,
+) -> Result<(BoxedRecordBatchStream, usize)> {
     let range_meta = &stream_ctx.ranges[part_range.identifier];
     let split_batch_size = should_split_flat_batches_for_merge(&stream_ctx, range_meta);
     let mut sources = Vec::with_capacity(range_meta.row_group_indices.len());
@@ -480,15 +500,6 @@ async fn build_series_partition_range(
         compute_parallel_channel_size(estimated_batch_size),
     )
     .await?;
-    let stream = match cache_key {
-        Some(key) => cache_flat_range_stream(
-            stream,
-            stream_ctx.input.cache_strategy.clone(),
-            key,
-            part_metrics,
-        ),
-        None => stream,
-    };
     Ok((stream, estimated_batch_size))
 }
 
```

---

### Incident Patch 2: `984f80e2` (2026-10-27)
**Commit Message**: fix(query): stop windowed sort on precision-lowering time casts (#9524)

* test: cover windowed sort cast unit mismatch

Signed-off-by: discord9 <[REDACTED_EMAIL]>

* fix(query): stop windowed sort on unit- or timezone-changing time casts

A cast on the time index column keeps the windowed-sort optimization
eligible only when it preserves the underlying timestamp values. Casts
that change the time unit (e.g. ms -> s) or that add a timezone to a
naive timestamp re-interpret the values, so the working ranges derived
from the time index no longer describe the sort column and the scan
fails with a working-range error or silently wrong order. Reject both
cast shapes so such queries fall back to the normal SortExec path.

The integration fixture uses two rows 1000 seconds apart so the cast
output stays distinct and the ordering assertions are not vacuous; the
descending arm gets its own expectation.

Signed-off-by: discord9 <[REDACTED_EMAIL]>

* fix(query): stop windowed sort on unit-changing timestamp wrappers

to_timestamp_seconds/millis/... cast their argument to their own unit
inside the function, so the hidden cast bypassed the explicit-cast guard
and kept the windowed-sort optimiza

**File**: `src/query/src/optimizer/windowed_sort.rs` (modified, +228/-35)
```diff
@@ -222,18 +222,31 @@ fn is_time_index_expr(
     }
 
     if let Some(cast_expr) = expr.downcast_ref::<CastExpr>() {
-        return if matches!(cast_expr.cast_type(), DataType::Timestamp(_, _)) {
+        let source_type = cast_expr.expr().data_type(plan.schema().as_ref())?;
+        return if preserves_timestamp_values(cast_expr.cast_type(), &source_type) {
             is_time_index_expr(plan, cast_expr.expr())
         } else {
             Ok(false)
         };
     }
 
     if let Some(scalar_function_expr) = expr.downcast_ref::<ScalarFunctionExpr>() {
-        return if is_supported_time_index_wrapper(scalar_function_expr)
-            && scalar_function_expr.args().len() == 1
+        if !is_supported_time_index_wrapper(scalar_function_expr)
+            || scalar_function_expr.args().len() != 1
         {
-            is_time_index_expr(plan, &scalar_function_expr.args()[0])
+            return Ok(false);
+        }
+
+        // Wrappers such as `to_timestamp_seconds` cast their argument to another time unit
+        // inside the function. That cast does not show up as a `CastExpr` in the plan, but it
+        // changes the values of the sort column exactly like a cast in the plan does, so the
+        // wrapper is only still the time index if its result keeps both the unit and the values
+        // of its argument.
+        let arg = &scalar_function_expr.args()[0];
+        let return_type = scalar_function_expr.data_type(plan.schema().as_ref())?;
+        let arg_type = arg.data_type(plan.schema().as_ref())?;
+        return if preserves_timestamp_values(&return_type, &arg_type) {
+            is_time_index_expr(plan, arg)
         } else {
             Ok(false)
         };
@@ -242,6 +255,24 @@ fn is_time_index_expr(
     Ok(false)
 }
 
+/// Returns true if a cast, or a function wrapper, that turns `source` into `target` keeps both the
+/// time unit and the underlying values of a timestamp.
+///
+/// A cast (or a hidden cast inside a function wrapper) that changes the time unit changes the
+/// values of the sort column, so the working ranges derived from the time index, which keep the
+/// unit of the time index, no longer apply. The optimizer conservatively rejects every cast that
+/// adds a timezone to a naive timestamp, including UTC, even though UTC has a zero offset. Only a
+/// target that keeps both the unit and the values of its source can still be the time index.
+fn preserves_timestamp_values(target: &DataType, source: &DataType) -> bool {
+    matches!(
+        (target, source),
+        (
+            DataType::Timestamp(target_unit, target_tz),
+            DataType::Timestamp(source_unit, source_tz)
+        ) if target_unit == source_unit && (source_tz.is_some() || target_tz.is_none())
+    )
+}
+
 fn is_time_index_column(
     plan: &Arc<dyn ExecutionPlan>,
     column_expr: &PhysicalColumn,
@@ -344,7 +375,7 @@ mod test {
     use datafusion::config::ConfigOptions;
     use datafusion::physical_plan::filter::FilterExecBuilder;
     use datafusion_common::ScalarValue;
-    use datafusion_functions::datetime::to_timestamp_millis;
+    use datafusion_functions::datetime::{to_timestamp, to_timestamp_millis, to_timestamp_seconds};
     use datafusion_physical_expr::expressions::{CastExpr, Literal};
     use datatypes::data_type::ConcreteDataType;
     use datatypes::schema::{ColumnSchema, Schema};
@@ -416,37 +447,92 @@ mod test {
     }
 
     #[test]
-    fn test_is_time_index_expr_tracks_wrapped_aliases_through_projection() {
-        let scan = new_region_scan();
+    fn test_is_time_index_expr_tracks_value_preserving_wrapper_through_projection() {
+        let scan = new_region_scan_with_unit(TimeUnit::Millisecond);
         let config = Arc::new(ConfigOptions::default());
-        let return_field = Arc::new(Field::new(
-            "ts",
-            DataType::Timestamp(TimeUnit::Millisecond, None),
-            false,
-        ));
+        let wrapper = ScalarFunctionExpr::try_new(
+            to_timestamp_millis(config.as_ref()),
+            vec![Arc::new(PhysicalColumn::new("ts", 1))],
+            scan.schema().as_ref(),
+            config,
+        )
+        .unwrap();
+        // `to_timestamp_millis` keeps both the unit and the values of a millisecond timestamp.
+        assert_eq!(
+            wrapper.data_type(scan.schema().as_ref()).unwrap(),
+            DataType::Timestamp(TimeUnit::Millisecond, None)
+        );
         let projection = Arc::new(
             ProjectionExec::try_new(
-                vec![(
-                    Arc::new(ScalarFunctionExpr::new(
-                        "to_timestamp_millis",
-                        to_timestamp_millis(config.as_ref()),
-                        vec![Arc::new(PhysicalColumn::new("ts", 1))],
-                        return_field,
-                        config,
-                    )) as Arc<dyn PhysicalExpr>,
-                    "ts".to_string(),
-                )],
+                vec![(Arc::new
```

**File**: `tests-integration/src/tests/instance_test.rs` (modified, +168/-0)
```diff
@@ -949,6 +949,174 @@ ORDER BY t.key_id"#;
     );
 }
 
+/// Sorting by `CAST(ts AS TIMESTAMP(0))` must not be optimized as if it were sorting by the
+/// (millisecond) time index column.
+///
+/// The windowed sort rule still recognizes the cast as the time index column, but the working
+/// ranges it derives from the region scan's `PartitionRange`s stay in the unit of the table's time
+/// index (millisecond here). `PartSortExec` projects those ranges onto the unit of the sort column
+/// while `WindowedSortExec` does not, so sorted runs (second) are checked against working ranges
+/// (millisecond) and the range invariant trips with
+/// "Current batch have data on the left side of working range, something is very wrong".
+///
+/// The two rows are 1000 seconds apart, so casting the millisecond time index to second precision
+/// truncates sub-second parts and collapses the first row onto second 0, which is before the start
+/// of the region's time range.
+///
+/// `to_timestamp_seconds(ts)` casts the time index to second precision *inside* the function, so it
+/// has to be rejected exactly like the cast in the plan; the cast is just not visible as a
+/// `CastExpr`. `to_timestamp_millis(ts)` keeps the values of the millisecond time index and is used
+/// as the value-preserving control.
+#[apply(standalone_instance_case)]
+async fn test_windowed_sort_sort_column_cast_time_unit_mismatch(instance: Arc<dyn MockInstance>) {
+    let frontend = instance.frontend();
+
+    execute_sql(
+        &frontend,
+        r#"CREATE TABLE f05_mito_wc (
+            ts TIMESTAMP(3) TIME INDEX,
+            host STRING PRIMARY KEY,
+            val DOUBLE
+        ) ENGINE = mito"#,
+    )
+    .await;
+
+    // The metric engine flavor only creates its physical table explicitly; rows are written to and
+    // read from the logical table built on it.
+    execute_sql(
+        &frontend,
+        r#"CREATE TABLE f05_metric_phy (
+            ts TIMESTAMP(3) TIME INDEX,
+            host STRING PRIMARY KEY,
+            val DOUBLE
+        ) ENGINE = metric WITH ('physical_metric_table' = '')"#,
+    )
+    .await;
+    execute_sql(
+        &frontend,
+        r#"CREATE TABLE f05_metric_wc (
+            ts TIMESTAMP(3) TIME INDEX,
+            host STRING PRIMARY KEY,
+            val DOUBLE
+        ) ENGINE = metric WITH ('on_physical_table' = 'f05_metric_phy')"#,
+    )
+    .await;
+
+    let rows_by_time_index = r#"+-------------------------+------+
+| ts                      | host |
++-------------------------+------+
+| 1970-01-01T00:00:00.001 | a    |
+| 1970-01-01T00:16:40.001 | b    |
++-------------------------+------+"#;
+    let rows_by_cast = r#"+---------------------+------+
+| t                   | host |
++---------------------+------+
+| 1970-01-01T00:00:00 | a    |
+| 1970-01-01T00:16:40 | b    |
++---------------------+------+"#;
+    // `ORDER BY t DESC` returns the same rows in the opposite order; without distinct cast values
+    // the two rows tie and this expectation would be vacuous. `rows_by_cast` is an ascending
+    // fixture, so the descending query needs its own.
+    let rows_by_cast_desc = r#"+---------------------+------+
+| t                   | host |
++---------------------+------+
+| 1970-01-01T00:16:40 | b    |
+| 1970-01-01T00:00:00 | a    |
++---------------------+------+"#;
+
+    // `to_timestamp_seconds` casts the millisecond time index to second precision inside the
+    // function, so it returns the same rows as the direct cast above (the function is registered
+    // without a session time zone, so its result stays a naive timestamp).
+    let rows_by_seconds_wrapper = rows_by_cast;
+    let rows_by_seconds_wrapper_desc = rows_by_cast_desc;
+    // `to_timestamp_millis` keeps the values of the millisecond time index, so the control below
+    // returns the same rows as sorting by the time index itself, only under the `t` alias.
+    let rows_by_millis_wrapper = r#"+-------------------------+------+
+| t                       | host |
++-------------------------+------+
+| 1970-01-01T00:00:00.001 | a    |
+| 1970-01-01T00:16:40.001 | b    |
++-------------------------+------+"#;
+
+    for table in ["f05_mito_wc", "f05_metric_wc"] {
+        let output = execute_sql(
+            &frontend,
+            &format!("INSERT INTO {table} (ts, host, val) VALUES (1, 'a', 1), (1000001, 'b', 2)"),
+        )
+        .await
+        .data;
+        assert!(matches!(output, OutputData::AffectedRows(2)), "{table}");
+
+        // Controls: sorting by the time index itself, applying a fetch, or sorting by the cast
+        // together with another column all keep working.
+        let output = execute_sql(
+            &frontend,
+            &format!("SELECT ts, host FROM {table} ORDER BY ts"),
+        )
+        .await
+        .data;
+        check_output_stream(output, rows_by_time_index).await;
+
+        let output = execute_sql(
+            &frontend,
+            &fo
```

**File**: `tests/cases/distributed/optimizer/windowed_sort_advance.result` (modified, +1/-1)
```diff
@@ -107,7 +107,7 @@ EXPLAIN ANALYZE select to_timestamp_millis(ts) as ts, status, value from `a` whe
 |_|_|_|
 | 1_| 0_|_ProjectionExec: expr=[to_timestamp_millis(a.ts)@0 as ts, status@1 as status, value@2 as value] REDACTED
 |_|_|_SortPreservingMergeExec: [to_timestamp_millis(a.ts)@0 ASC NULLS LAST] REDACTED
-|_|_|_WindowedSortExec: expr=to_timestamp_millis(a.ts)@0 ASC NULLS LAST num_ranges=REDACTED REDACTED
+|_|_|_SortExec: expr=[to_timestamp_millis(a.ts)@0 ASC NULLS LAST], preserve_partitioning=[true] REDACTED
 |_|_|_ProjectionExec: expr=[to_timestamp_millis(ts@2) as to_timestamp_millis(a.ts), status@1 as status, value@0 as value] REDACTED
 |_|_|_SeqScan: region=REDACTED, "partition_count":{"count":1, "mem_ranges":1, "files":0, "file_ranges":0}, "projection": ["value", "status", "ts"], "filters": ["ts >= TimestampNanosecond(1773273600000000000, None)", "ts < TimestampNanosecond(1773273721000000000, None)"], "time_range":REDACTED
 |_|_|_|
```

**File**: `tests/cases/distributed/optimizer/windowed_sort_nanos.result` (modified, +1/-1)
```diff
@@ -67,7 +67,7 @@ EXPLAIN ANALYZE select to_timestamp_nanos(ts) as ts, status, value from `a_ms` w
 |_|_|_|
 | 1_| 0_|_ProjectionExec: expr=[to_timestamp_nanos(a_ms.ts)@0 as ts, status@1 as status, value@2 as value] REDACTED
 |_|_|_SortPreservingMergeExec: [to_timestamp_nanos(a_ms.ts)@0 ASC NULLS LAST] REDACTED
-|_|_|_WindowedSortExec: expr=to_timestamp_nanos(a_ms.ts)@0 ASC NULLS LAST num_ranges=REDACTED REDACTED
+|_|_|_SortExec: expr=[to_timestamp_nanos(a_ms.ts)@0 ASC NULLS LAST], preserve_partitioning=[true] REDACTED
 |_|_|_ProjectionExec: expr=[to_timestamp_nanos(ts@2) as to_timestamp_nanos(a_ms.ts), status@1 as status, value@0 as value] REDACTED
 |_|_|_SeqScan: region=REDACTED, "partition_count":{"count":1, "mem_ranges":1, "files":0, "file_ranges":0}, "projection": ["value", "status", "ts"], "filters": ["ts >= TimestampMillisecond(1773273600000, None)", "ts < TimestampMillisecond(1773273721000, None)"], "time_range":REDACTED
 |_|_|_|
```

**File**: `tests/cases/standalone/optimizer/windowed_sort_advance.result` (modified, +1/-1)
```diff
@@ -106,7 +106,7 @@ EXPLAIN ANALYZE select to_timestamp_millis(ts) as ts, status, value from `a` whe
 |_|_|_MergeScanExec: REDACTED
 |_|_|_|
 | 1_| 0_|_SortPreservingMergeExec: [ts@0 ASC NULLS LAST] REDACTED
-|_|_|_WindowedSortExec: expr=ts@0 ASC NULLS LAST num_ranges=REDACTED REDACTED
+|_|_|_SortExec: expr=[ts@0 ASC NULLS LAST], preserve_partitioning=[true] REDACTED
 |_|_|_ProjectionExec: expr=[to_timestamp_millis(ts@2) as ts, status@1 as status, value@0 as value] REDACTED
 |_|_|_SeqScan: region=REDACTED, "partition_count":{"count":1, "mem_ranges":1, "files":0, "file_ranges":0}, "projection": ["value", "status", "ts"], "filters": ["ts >= TimestampNanosecond(1773273600000000000, None)", "ts < TimestampNanosecond(1773273721000000000, None)"], "time_range":REDACTED
 |_|_|_|
```

**File**: `tests/cases/standalone/optimizer/windowed_sort_nanos.result` (modified, +1/-1)
```diff
@@ -66,7 +66,7 @@ EXPLAIN ANALYZE select to_timestamp_nanos(ts) as ts, status, value from `a_ms` w
 |_|_|_MergeScanExec: REDACTED
 |_|_|_|
 | 1_| 0_|_SortPreservingMergeExec: [ts@0 ASC NULLS LAST] REDACTED
-|_|_|_WindowedSortExec: expr=ts@0 ASC NULLS LAST num_ranges=REDACTED REDACTED
+|_|_|_SortExec: expr=[ts@0 ASC NULLS LAST], preserve_partitioning=[true] REDACTED
 |_|_|_ProjectionExec: expr=[to_timestamp_nanos(ts@2) as ts, status@1 as status, value@0 as value] REDACTED
 |_|_|_SeqScan: region=REDACTED, "partition_count":{"count":1, "mem_ranges":1, "files":0, "file_ranges":0}, "projection": ["value", "status", "ts"], "filters": ["ts >= TimestampMillisecond(1773273600000, None)", "ts < TimestampMillisecond(1773273721000, None)"], "time_range":REDACTED
 |_|_|_|
```

---

### Incident Patch 3: `62ebf71f` (2026-10-27)
**Commit Message**: fix(meta): exclude route followers from failover targets (#10001)

* fix(meta): exclude route followers from failover targets

Failover target selection did not exclude the region's route followers.
The selector could keep picking a follower, the submit rejected it as a
peer conflict, and the region never failed over.

Group the failed regions by their followers and exclude them per group.
A group without a candidate is skipped instead of failing every region of
the datanode.

Signed-off-by: jeremyhi <[REDACTED_EMAIL]>

* test: check failover continues after a group without candidates

Signed-off-by: jeremyhi <[REDACTED_EMAIL]>

* fix(meta): keep failover going when follower routes can't be read

Fall back to selecting without follower exclusion when the routes can't
be read, log skipped groups with their followers at warn level, and test
a region without a route.

Signed-off-by: jeremyhi <[REDACTED_EMAIL]>

* refactor(meta): select failover targets per exclusion set in select_peers

generate_failover_tasks now only reads the route followers of the regions.
select_peers resolves the affinity and the unschedulable datanodes once,
then selects per group of regions that exclude the sa

**File**: `src/meta-srv/src/region/supervisor.rs` (modified, +283/-48)
```diff
@@ -12,7 +12,7 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
-use std::collections::{HashMap, HashSet};
+use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
 use std::fmt::Debug;
 use std::sync::{Arc, Mutex};
 use std::time::{Duration, Instant};
@@ -23,7 +23,7 @@ use common_meta::affinity::{AffinityFallback, AffinityReference, AffinityResolve
 use common_meta::datanode::Stat;
 use common_meta::ddl::{DetectingRegion, RegionFailureDetectorController};
 use common_meta::key::runtime_switch::RuntimeSwitchManagerRef;
-use common_meta::key::table_route::{TableRouteKey, TableRouteValue};
+use common_meta::key::table_route::{TableRouteKey, TableRouteStorage, TableRouteValue};
 use common_meta::key::{MetadataKey, MetadataValue};
 use common_meta::kv_backend::KvBackendRef;
 use common_meta::leadership_notifier::LeadershipChangeListener;
@@ -34,6 +34,7 @@ use common_runtime::JoinHandle;
 use common_telemetry::{debug, error, info, warn};
 use common_time::util::current_time_millis;
 use futures::{StreamExt, TryStreamExt};
+use itertools::Itertools;
 use snafu::{ResultExt, ensure};
 use store_api::storage::RegionId;
 use tokio::sync::mpsc::error::TrySendError;
@@ -44,7 +45,7 @@ use tokio::time::{MissedTickBehavior, interval, interval_at};
 use crate::discovery::utils::accept_ingest_workload;
 use crate::error::{self, Result};
 use crate::failure_detector::PhiAccrualFailureDetectorOptions;
-use crate::metasrv::{RegionStatAwareSelectorRef, SelectTarget, SelectorContext, SelectorRef};
+use crate::metasrv::{RegionStatAwareSelectorRef, SelectorContext, SelectorRef};
 use crate::metrics::METRIC_META_HEARTBEAT_DROPPED;
 use crate::procedure::region_migration::manager::{
     RegionMigrationManagerRef, RegionMigrationTriggerReason, SubmitRegionMigrationTaskResult,
@@ -667,11 +668,15 @@ impl RegionSupervisor {
             .context(error::RuntimeSwitchManagerSnafu)
     }
 
+    /// Selects a target for each of `regions`, excluding `failure_datanodes`, the unschedulable
+    /// datanodes and the region's datanodes in `exclude_peer_ids_by_region`. Regions without a
+    /// candidate are left out.
     async fn select_peers(
         &self,
         from_peer_id: DatanodeId,
         regions: &[RegionId],
         failure_datanodes: &[DatanodeId],
+        exclude_peer_ids_by_region: &HashMap<RegionId, BTreeSet<DatanodeId>>,
     ) -> Result<Vec<(RegionId, Peer)>> {
         let affinity = if let Some(resolver) = &self.affinity_resolver {
             match resolver
@@ -715,54 +720,66 @@ impl RegionSupervisor {
             .filter(|datanode| !datanode.is_schedulable())
             .map(|datanode| datanode.peer.id);
         exclude_peer_ids.extend(unschedulable_datanodes);
-        match &self.selector {
+
+        let region_peers = match &self.selector {
             RegionSupervisorSelector::NaiveSelector(selector) => {
-                let opts = SelectorOptions {
-                    affinity: affinity.as_ref(),
-                    min_required_items: regions.len(),
-                    allow_duplication: true,
-                    exclude_peer_ids,
-                    workload_filter: Some(accept_ingest_workload),
-                };
-                let peers = selector.select(&self.selector_context, opts).await?;
-                ensure!(
-                    peers.len() == regions.len(),
-                    error::NoEnoughAvailableNodeSnafu {
-                        required: regions.len(),
-                        available: peers.len(),
-                        select_target: SelectTarget::Datanode,
+                // `Selector` takes one exclusion set, so select once per distinct set of excluded
+                // datanodes.
+                let empty = BTreeSet::new();
+                let mut groups = BTreeMap::<_, Vec<_>>::new();
+                for region_id in regions {
+                    let excluded = exclude_peer_ids_by_region.get(region_id).unwrap_or(&empty);
+                    groups.entry(excluded).or_default().push(*region_id);
+                }
+                let mut region_peers = Vec::with_capacity(regions.len());
+                for (excluded, regions) in groups {
+                    let mut exclude_peer_ids = exclude_peer_ids.clone();
+                    exclude_peer_ids.extend(excluded);
+                    let opts = SelectorOptions {
+                        affinity: affinity.as_ref(),
+                        min_required_items: regions.len(),
+                        allow_duplication: true,
+                        exclude_peer_ids,
+                        workload_filter: Some(accept_ingest_workload),
+                    };
+                    match selector.select(&self.selector_context, opts).await {
+                        Ok(peers) => region_peers.extend(regions.into_iter().zip(peers)),
+                        // Other groups may still have candidates.
+                        Err(error::E
```

**File**: `src/meta-srv/src/selector.rs` (modified, +6/-1)
```diff
@@ -20,7 +20,7 @@ pub mod round_robin;
 pub(crate) mod test_utils;
 pub mod weight_compute;
 pub mod weighted_choose;
-use std::collections::HashSet;
+use std::collections::{BTreeSet, HashMap, HashSet};
 
 use api::v1::meta::heartbeat_request::NodeWorkloads;
 use common_meta::affinity::AffinityRequirements;
@@ -43,6 +43,10 @@ pub trait Selector: Send + Sync {
 ///
 /// It selects the best destination peer for a list of regions.
 /// The selection is based on the region statistics, such as the region leader's write throughput.
+///
+/// A region is never placed on `exclude_peer_ids`, nor on its own peers in
+/// `exclude_peer_ids_by_region`. It returns the regions it placed, possibly none: a region
+/// without a remaining candidate is left out. Errors are for other failures.
 #[async_trait::async_trait]
 pub trait RegionStatAwareSelector: Send + Sync {
     type Context;
@@ -54,6 +58,7 @@ pub trait RegionStatAwareSelector: Send + Sync {
         from_peer_id: u64,
         region_ids: &[RegionId],
         exclude_peer_ids: HashSet<u64>,
+        exclude_peer_ids_by_region: &HashMap<RegionId, BTreeSet<u64>>,
         affinity: Option<&AffinityRequirements>,
     ) -> Result<Self::Output>;
 }
```

#### Recent Merged Pull Requests:
- **PR #10013** (2026-10-27): fix(query): stop windowed sort on precision-lowering time casts [Backport release/v1.3] (@MichaelScofield)
- **PR #10012** (2026-10-27): perf(mito2): index encoded bulk parts from memory during flush [Backport release/v1.3] (@killme2008)
- **PR #10004** (2026-10-27): feat(promql): run native statements over any number of selectors (@killme2008)
- **PR #10003** (2026-10-27): fix(mito2): stop the series distributor from stalling on unread partitions (@killme2008)
- **PR #10001** (2026-10-27): fix(meta): exclude route followers from failover targets (@fengjiachun)
- **PR #9998** (closed): feat(promql): split distributed aggregates over the raw fan-in (@discord9)

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

## X. mito2): coordinate range cache invalidation and singleflight reads (#9935)

**RULE**:
When implementing operations in `src/mito2/src/cache.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in GreptimeTeam/greptimedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `44df6e5d`: mito2): coordinate range cache invalidation and singleflight reads (#9935). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/mito2/src/cache.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
pub(crate) mod range_cache;
    /// Never wait while holding a partial load: several partial loads could
    /// otherwise exhaust the budget and wait on each other indefinitely.
    pub(crate) fn try_acquire(&self, bytes: usize) -> Option<tokio::sync::OwnedSemaphorePermit> {
        let permits = bytes.div_ceil(self.permit_bytes).max(1);
        if permits > self.total_permits {
            return None;
        }
        self.semaphore
            .clone()
            .try_acquire_many_owned(permits.try_into().ok()?)
            .ok()
    }

    /// Transfers a load's reservation to its completed result without a gap in
    /// accounting. Compaction may shrink buffers or add metadata; growing the
    /// reservation must remain nonblocking just like loading more input.
    pub(crate) fn try_resize(
        &self,
        permit: Option<tokio::sync::OwnedSemaphorePermit>,
        bytes: usize,
    ) -> Option<tokio::sync::OwnedSemaphorePermit> {
        let Some(mut permit) = permit else {
            return self.try_acquire(bytes);
        };
        let required = bytes.div_ceil(self.permit_bytes).max(1);
        let reserved = permit.num_permits();
        if required > reserve
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
            CACHE_BYTES
                .with_label_values(&[RANGE_RESULT_TYPE])
                .add(range_result_cache_weight(&key, &result).into());
        let range_result_cache = (self.range_result_cache_size != 0).then(|| {
            Cache::builder()
                .max_capacity(self.range_result_cache_size)
                .weigher(range_result_cache_weight)
                .eviction_listener(move |k, v, cause| {
                    let size = range_result_cache_weight(&k, &v);
                    CACHE_BYTES
                        .with_label_values(&[RANGE_RESULT_TYPE])
                        .sub(size.into());
                    CACHE_EVICTION
                        .with_label_values(&[RANGE_RESULT_TYPE, removal_cause_str(cause)])
                        .inc();
                })
                .build()
        });
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `44df6e5d` are properly handled with clean fallback behavior.
