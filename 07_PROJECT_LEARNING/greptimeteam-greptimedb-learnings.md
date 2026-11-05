> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/greptimeteam-greptimedb-learnings.md`  
> **Source**: github ([https://github.com/GreptimeTeam/greptimedb](https://github.com/GreptimeTeam/greptimedb))  
> **Source Version**: `5bcb576b`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T23:40:02.609Z  
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
> **Harvest Timestamp**: 2026-11-05T23:40:02.602Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GreptimeTeam/greptimedb`
- **Description**: The open-source observability database. One columnar engine for metrics, logs, and traces, on object storage.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6789 stars

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
- **Issue #10203** (2026-11-05): **Region migration and WAL prune can deadlock on the remote WAL topic lock, leaving procedures stuck in Running**
  *Symptoms*: ### What type of bug is this?  Locking issue (deadlock), Unexpected error  ### What subsystems are affected?  Metasrv (procedure framework, region migration / failover, remote WAL pruning)  ### What happened?  In a distributed cluster with Kafka remote WAL, a rolling restart of datanodes left several regions stuck in `DOWNGRADING` for hours. The cluster was not queryable for those regions.  - Some `RegionMigration` (failover) procedures and the `WalPrune` procedures for two topics stayed in `Running` indefinitely. - Region migrations never finished or timed out. New migrations for the affected regions were rejected with "Another migration procedure is running for region ...". - WAL pruning for the affected topics stopped. - Restarting metasrv cleared the hung procedures. After that, manual `migrate_region` calls completed normally, so the datanodes, Kafka and object storage were fine.  ### Root cause  It is a deadlock between the upgrade step of region migration and `WalPruneProcedure`. Both use the dynamic lock on the remote WAL topic (`RemoteWalLock`):  - [`UpgradeCandidateRegion::upgrade_region_with_retry`](https://github.com/GreptimeTeam/greptimedb/blob/v1.3.0-beta.2/src/meta-srv/src/procedure/region_migration/upgrade_candidate_region.rs#L303-L345) acquires a **shared** `RemoteWalLock` for each topic **inside its retry loop**. It pushes each guard into a `Vec` that is not cleared between attempts, so attempt N holds N−1 shared guards and requests another. The `Vec` came i

- **Issue #10194** (2026-11-05): **docs: tighten README facts and move quick start up**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  ## What's changed and what's your intention?  ### Problem The README had a dead link (`contributor-guide/overview.html` returns 404), linked a nightly docs page for "support windows" it does not describe, and ranked a March 2025 JSONBench result as current. The quick start sat after six evaluation sections, and the Troubleshooting tip ran `docker logs` on a container started with `--rm`.  ### Change - Move Try GreptimeDB after the cross-signal SQL example; fold Getting Started into it; drop Troubleshooting. - Drop the blockquote under the tagline; drop "We invite you to engage and contribute!". - Fold Commercial Support into Limitations and Edition Boundary. The License section stays separate. - Fix the contributor guide link; point the version link at the stable Semantic Versioning page; point the 2026 roadmap link at #7685, matching the header. - Remove index creation from the list of manual operations in the Apache-2.0 build. - Benchmarks: add the Agent RCA Bench scope (168 investigations per interface across six models) and say "estimated cost"; date the JSONBench result. - What's Supported: add native histograms over Remote Write 2.0 and log pipelines. - Architecture: drop the Frontend protocol list duplicated from What's Supported, drop "Elastic.", and replace "security" in Metasrv with the coordination work i

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

### Incident Patch 1: `ec1ad1f1` (2026-11-05)
**Commit Message**: fix(datatypes): escape object keys when rendering jsonb as text (#10112)

* fix(datatypes): escape object keys when rendering jsonb as text

Signed-off-by: Yvan Wang <[REDACTED_EMAIL]>

* fix(datatypes): skip unicode normalization for escaped jsonb keys

Signed-off-by: Yvan Wang <[REDACTED_EMAIL]>

* refactor(datatypes): serialize jsonb to text directly with serde_json

Serialize the binary jsonb with serde_json::to_string(&RawJsonb) so that
both object keys and string values are escaped by serde_json. This drops
fix_unicode_point, its regex and the hand-written key escaping. Errors are
propagated instead of falling back to lossy raw bytes.

Characters such as U+2028 are now emitted as-is, which is still valid
JSON, so the affected sqlness result lines are regenerated.

Signed-off-by: Yvan Wang <[REDACTED_EMAIL]>

* fix(datatypes): accept JSON text bytes in jsonb_to_string

Some write paths (COPY FROM csv/json/parquet, JSON bound as text via
MySQL) store JSON text instead of binary jsonb in JSON columns. Re-encode
such bytes as jsonb before serializing with serde_json, so they still
render (properly escaped) instead of failing with InvalidJsonb.

Signed-off-by: Yvan Wang <[REDACTED

**File**: `Cargo.lock` (modified, +0/-1)
```diff
@@ -4613,7 +4613,6 @@ dependencies = [
  "parquet-variant-compute",
  "parquet-variant-json",
  "paste",
- "regex",
  "serde",
  "serde_json",
  "snafu 0.8.6",
```

**File**: `src/datatypes/Cargo.toml` (modified, +0/-1)
```diff
@@ -31,7 +31,6 @@ parquet-variant.workspace = true
 parquet-variant-compute.workspace = true
 parquet-variant-json.workspace = true
 paste.workspace = true
-regex.workspace = true
 serde.workspace = true
 serde_json.workspace = true
 snafu.workspace = true
```

**File**: `src/datatypes/src/types/json_type.rs` (modified, +112/-107)
```diff
@@ -14,12 +14,11 @@
 
 use std::collections::BTreeMap;
 use std::fmt::{Debug, Display, Formatter};
-use std::sync::{Arc, LazyLock};
+use std::sync::Arc;
 
 use arrow::datatypes::DataType as ArrowDataType;
 use arrow_schema::{Field, Fields};
 use common_base::bytes::Bytes;
-use regex::{Captures, Regex};
 use serde::{Deserialize, Serialize};
 
 use crate::Error;
@@ -389,16 +388,35 @@ impl Display for JsonType {
 }
 
 /// Converts a json type value to string
+///
+/// The binary jsonb is serialized directly with `serde_json`, so both object keys and
+/// string values are escaped by `serde_json`. `RawJsonb::to_string()` is deliberately
+/// avoided, since it falls back to the lossy raw bytes when serialization fails.
+///
+/// Some write paths (e.g. `COPY FROM` csv/json/parquet files, or a JSON parameter bound
+/// as text through the MySQL protocol) currently store the JSON *text* as the column
+/// bytes instead of binary jsonb, and such data may already be persisted. When the bytes
+/// are not valid jsonb but are valid JSON text, they are re-encoded as jsonb and then
+/// serialized the same way, so the output is still escaped by `serde_json`. Anything else
+/// is reported as an error.
 pub fn jsonb_to_string(val: &[u8]) -> Result<String> {
     if val.is_empty() {
         return Ok("".to_string());
     }
-    match jsonb::from_slice(val) {
-        Ok(jsonb_value) => {
-            let serialized = jsonb_value.to_string();
-            fix_unicode_point(&serialized)
-        }
-        Err(e) => InvalidJsonbSnafu { error: e }.fail(),
+    match serde_json::to_string(&jsonb::RawJsonb::new(val)) {
+        Ok(s) => Ok(s),
+        Err(e) => match jsonb::parse_value_standard_mode(val) {
+            Ok(json) => serde_json::to_string(&jsonb::RawJsonb::new(&json.to_vec())).map_err(|e| {
+                InvalidJsonSnafu {
+                    value: e.to_string(),
+                }
+                .build()
+            }),
+            Err(_) => InvalidJsonSnafu {
+                value: e.to_string(),
+            }
+            .fail(),
+        },
     }
 }
 
@@ -409,59 +427,6 @@ pub fn jsonb_to_serde_json(val: &[u8]) -> Result<serde_json::Value> {
         .map_err(|error| InvalidJsonbSnafu { error }.build())
 }
 
-/// Normalizes a JSON string by converting Rust-style Unicode escape sequences to JSON-compatible format.
-///
-/// The input is scanned for Rust-style Unicode code
-/// point escapes of the form `\\u{H...}` (a backslash, `u`, an opening brace,
-/// followed by 1–6 hexadecimal digits, and a closing brace). Each such escape is
-/// converted into JSON-compatible UTF‑16 escape sequences:
-///
-/// - For code points in the Basic Multilingual Plane (≤ `0xFFFF`), the escape is
-///   converted to a single JSON `\\uXXXX` sequence with four uppercase hex digits.
-/// - For code points above `0xFFFF` and less than Unicode max code point `0x10FFFF`,
-///   the code point is encoded as a UTF‑16 surrogate pair and emitted as two consecutive
-///   `\\uXXXX` sequences (as JSON format required).
-///
-/// After this normalization, the function returns the normalized string
-fn fix_unicode_point(json: &str) -> Result<String> {
-    static UNICODE_CODE_POINT_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
-        // Match literal "\u{...}" sequences, capturing 1–6 (code point range) hex digits
-        // inside braces.
-        Regex::new(r"\\u\{([0-9a-fA-F]{1,6})}").unwrap_or_else(|e| panic!("{}", e))
-    });
-
-    let v = UNICODE_CODE_POINT_PATTERN.replace_all(json, |caps: &Captures| {
-        // Extract the hex payload (without braces) and parse to a code point.
-        let hex = &caps[1];
-        let Ok(code) = u32::from_str_radix(hex, 16) else {
-            // On parse failure, leave the original escape sequence unchanged.
-            return caps[0].to_string();
-        };
-
-        if code <= 0xFFFF {
-            // Basic Multilingual Plane: JSON can represent this directly as \uXXXX.
-            format!("\\u{:04X}", code)
-        } else if code > 0x10FFFF {
-            // Beyond max Unicode code point
-            caps[0].to_string()
-        } else {
-            // Supplementary planes: JSON needs UTF-16 surrogate pairs.
-            // Convert the code point to a 20-bit value.
-            let code = code - 0x10000;
-
-            // High surrogate: top 10 bits, offset by 0xD800.
-            let high = 0xD800 + ((code >> 10) & 0x3FF);
-
-            // Low surrogate: bottom 10 bits, offset by 0xDC00.
-            let low = 0xDC00 + (code & 0x3FF);
-
-            // Emit two \uXXXX escapes in sequence.
-            format!("\\u{:04X}\\u{:04X}", high, low)
-        }
-    });
-    Ok(v.to_string())
-}
-
 /// Parses a string to a json type value
 pub fn parse_string_to_jsonb(s: &str) -> Result<Vec<u8>> {
     jsonb::parse_value_standard_mode(s.as_bytes())
@@ -488,60 +453,100 @@ mod tests {
         Ok(())
     }
 
-    use super::*;
+    #[test]
+    fn test_jsonb_to_string_escapes_ob
```

**File**: `tests/cases/standalone/common/types/json/json.result` (modified, +2/-2)
```diff
@@ -99,7 +99,7 @@ SELECT json_to_string(j), t FROM jsons;
 | {"a":null,"foo":"bar"}                                                                                                                                                                                                                                                                                                    | 1970-01-01T00:00:00.009 |
 | [-1]                                                                                                                                                                                                                                                                                                                      | 1970-01-01T00:00:00.010 |
 | {"entities":{"description":{"urls":[{"display_url":"pixiv.net/member.php?id=…","expanded_url":"http://www.pixiv.net/member.php?id=4776","indices":[58,80],"url":"http://t.co/QMLJeFmfMT"},{"display_url":"ask.fm/KATANA77","expanded_url":"http://ask.fm/KATANA77","indices":[95,117],"url":"http://t.co/LU8T7vmU3h"}]}}} | 1970-01-01T00:00:00.011 |
-| {"a":"abc\u2028tom"}                                                                                                                                                                                                                                                                                                      | 1970-01-01T00:00:00.012 |
+| {"a":"abc tom"}                                                                                                                                                                                                                                                                                                           | 1970-01-01T00:00:00.012 |
 | [null]                                                                                                                                                                                                                                                                                                                    | 1970-01-01T00:00:01     |
 | [true]                                                                                                                                                                                                                                                                                                                    | 1970-01-01T00:00:01.001 |
 | [false]                                                                                                                                                                                                                                                                                                                   | 1970-01-01T00:00:01.002 |
@@ -113,7 +113,7 @@ SELECT json_to_string(j), t FROM jsons;
 | [-1]                                                                                                                                                                                                                                                                                                                      | 1970-01-01T00:00:01.010 |
 | [-2147483648]                                                                                                                                                                                                                                                                                                             | 1970-01-01T00:00:01.011 |
 | {"entities":{"description":{"urls":[{"display_url":"pixiv.net/member.php?id=…","expanded_url":"http://www.pixiv.net/member.php?id=4776","indices":[58,80],"url":"http://t.co/QMLJeFmfMT"},{"display_url":"ask.fm/KATANA77","expanded_url":"http://ask.fm/KATANA77","indices":[95,117],"url":"http://t.co/LU8T7vmU3h"}]}}} | 1970-01-01T00:00:01.012 |
-| {"a":"abc\u2028tom"}                                                                                                                                                                                                                                                                                                      | 1970-01-01T00:00:01.013 |
+| {"a":"abc tom"}                                                                                                                                                                                                                                                                                                           | 1970-01-01T00:00:01.013 |
 +---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+-------------------------+
 
 --Insert invalid json strings--
```

---

### Incident Patch 2: `4263f5fc` (2026-11-05)
**Commit Message**: fix(mito): decode cached manifest payloads (#10179)

* test(mito2): cover compressed manifest cache recovery

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

* fix(mito2): decode cached manifest object payloads

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

* fix(mito2): address manifest cache review feedback

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

---------

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

**File**: `src/mito2/src/cache/manifest_cache.rs` (modified, +2/-2)
```diff
@@ -237,7 +237,7 @@ impl ManifestCache {
         join_path(MANIFEST_DIR, key)
     }
 
-    /// Gets a manifest file from cache.
+    /// Gets the encoded object-store payload from cache.
     /// Returns the file data if found in cache, None otherwise.
     pub(crate) async fn get_file(&self, key: &str) -> Option<Vec<u8>> {
         if self.get(key).await.is_none() {
@@ -259,7 +259,7 @@ impl ManifestCache {
         }
     }
 
-    /// Puts a manifest file into cache.
+    /// Caches the object-store payload verbatim, before decompression.
     pub(crate) async fn put_file(&self, key: String, data: Vec<u8>) {
         let cache_file_path = self.cache_file_path(&key);
 
```

**File**: `src/mito2/src/engine/open_test.rs` (modified, +63/-0)
```diff
@@ -1366,3 +1366,66 @@ async fn test_region_hook_on_open() {
     assert_eq!(hook.closed_count.load(Ordering::Relaxed), 1);
     assert_eq!(hook.dropped_count.load(Ordering::Relaxed), 0);
 }
+
+#[tokio::test]
+async fn test_reopen_region_with_compressed_manifest_cache() {
+    let mut env = TestEnv::new().await;
+    let engine = env
+        .create_engine(MitoConfig {
+            enable_write_cache: true,
+            compress_manifest: true,
+            manifest_checkpoint_distance: 1,
+            ..Default::default()
+        })
+        .await;
+    let region_id = RegionId::new(1, 1);
+    let request = CreateRequestBuilder::new().build();
+    let table_dir = request.table_dir.clone();
+    let schema = rows_schema(&request);
+    engine
+        .handle_request(region_id, RegionRequest::Create(request))
+        .await
+        .unwrap();
+    for i in 0..3 {
+        put_rows(
+            &engine,
+            region_id,
+            Rows {
+                schema: schema.clone(),
+                rows: build_rows(i * 3, (i + 1) * 3),
+            },
+        )
+        .await;
+        flush_region(&engine, region_id, None).await;
+    }
+    let region = engine.get_region(region_id).unwrap();
+    let mut manager = region.manifest_ctx.manifest_manager.write().await;
+    tokio::time::timeout(
+        Duration::from_secs(10),
+        manager.wait_for_pending_checkpoint(),
+    )
+    .await
+    .unwrap();
+    assert!(manager.checkpointer().last_checkpoint_version() > 0);
+    drop(manager);
+    let stream = engine
+        .scan_to_stream(region_id, ScanRequest::default())
+        .await
+        .unwrap();
+    let expected = RecordBatches::try_collect(stream)
+        .await
+        .unwrap()
+        .pretty_print()
+        .unwrap();
+    reopen_region(&engine, region_id, table_dir, true, HashMap::new()).await;
+    let stream = engine
+        .scan_to_stream(region_id, ScanRequest::default())
+        .await
+        .unwrap();
+    let actual = RecordBatches::try_collect(stream)
+        .await
+        .unwrap()
+        .pretty_print()
+        .unwrap();
+    assert_eq!(expected, actual);
+}
```

**File**: `src/mito2/src/manifest/storage.rs` (modified, +239/-0)
```diff
@@ -846,4 +846,243 @@ mod tests {
             .unwrap();
         assert!(entries.is_empty());
     }
+
+    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
+    enum CacheSource {
+        WriteThrough,
+        RemoteFill,
+        LegacyDecoded,
+        Truncated,
+    }
+
+    #[derive(Debug, Clone, Copy)]
+    enum PayloadKind {
+        Delta,
+        Checkpoint { checksum: bool },
+    }
+
+    // Exercise both representations left by older versions, as well as new writes
+    // and remote fills. Truncation only applies to compression envelopes.
+    #[rstest::rstest]
+    #[case::write_through_uncompressed(CacheSource::WriteThrough, CompressionType::Uncompressed)]
+    #[case::write_through_gzip(CacheSource::WriteThrough, CompressionType::Gzip)]
+    #[case::write_through_zstd(CacheSource::WriteThrough, CompressionType::Zstd)]
+    #[case::write_through_xz(CacheSource::WriteThrough, CompressionType::Xz)]
+    #[case::write_through_bzip2(CacheSource::WriteThrough, CompressionType::Bzip2)]
+    #[case::remote_fill_uncompressed(CacheSource::RemoteFill, CompressionType::Uncompressed)]
+    #[case::remote_fill_gzip(CacheSource::RemoteFill, CompressionType::Gzip)]
+    #[case::remote_fill_zstd(CacheSource::RemoteFill, CompressionType::Zstd)]
+    #[case::remote_fill_xz(CacheSource::RemoteFill, CompressionType::Xz)]
+    #[case::remote_fill_bzip2(CacheSource::RemoteFill, CompressionType::Bzip2)]
+    #[case::legacy_decoded_uncompressed(CacheSource::LegacyDecoded, CompressionType::Uncompressed)]
+    #[case::legacy_decoded_gzip(CacheSource::LegacyDecoded, CompressionType::Gzip)]
+    #[case::legacy_decoded_zstd(CacheSource::LegacyDecoded, CompressionType::Zstd)]
+    #[case::legacy_decoded_xz(CacheSource::LegacyDecoded, CompressionType::Xz)]
+    #[case::legacy_decoded_bzip2(CacheSource::LegacyDecoded, CompressionType::Bzip2)]
+    #[case::truncated_gzip(CacheSource::Truncated, CompressionType::Gzip)]
+    #[case::truncated_zstd(CacheSource::Truncated, CompressionType::Zstd)]
+    #[case::truncated_xz(CacheSource::Truncated, CompressionType::Xz)]
+    #[case::truncated_bzip2(CacheSource::Truncated, CompressionType::Bzip2)]
+    #[tokio::test]
+    async fn test_manifest_cache_payload(
+        #[case] source: CacheSource,
+        #[case] compression: CompressionType,
+        #[values(PayloadKind::Delta, PayloadKind::Checkpoint { checksum: false }, PayloadKind::Checkpoint { checksum: true })]
+        payload: PayloadKind,
+    ) {
+        use std::sync::atomic::{AtomicUsize, Ordering};
+
+        use common_base::readable_size::ReadableSize;
+        use object_store::layers::mock::MockLayerBuilder;
+
+        let remote_dir = create_temp_dir("manifest-cache-remote");
+        let cache_dir = create_temp_dir("manifest-cache-local");
+        let remote =
+            ObjectStore::new(Fs::default().root(remote_dir.path().to_str().unwrap())).unwrap();
+        let local =
+            ObjectStore::new(Fs::default().root(cache_dir.path().to_str().unwrap())).unwrap();
+        let reads = Arc::new(AtomicUsize::new(0));
+        let observed = reads.clone();
+        let remote = remote.layer(
+            MockLayerBuilder::default()
+                .reader_factory(Arc::new(move |_, _, reader| {
+                    observed.fetch_add(1, Ordering::Relaxed);
+                    reader
+                }))
+                .build()
+                .unwrap(),
+        );
+        let mut cache = ManifestCache::new(local.clone(), ReadableSize::mb(32), None, true).await;
+        let mut store = ManifestObjectStore::new(
+            "region/manifest/",
+            remote.clone(),
+            compression,
+            Default::default(),
+            (source != CacheSource::RemoteFill).then(|| cache.clone()),
+        );
+        let data = br#"{"manifest":"persistent cache payload"}"#;
+        let key = gen_path(
+            "region/manifest/",
+            &if matches!(payload, PayloadKind::Checkpoint { .. }) {
+                checkpoint_file(3)
+            } else {
+                delta_file(3)
+            },
+            compression,
+        );
+        if matches!(payload, PayloadKind::Checkpoint { .. }) {
+            store.save_checkpoint(3, data).await.unwrap();
+        } else {
+            store.save(3, data, false).await.unwrap();
+        }
+        let encoded = remote.read(&key).await.unwrap().to_vec();
+        if source == CacheSource::LegacyDecoded {
+            cache.put_file(key.clone(), data.to_vec()).await;
+        } else if source == CacheSource::Truncated {
+            cache
+                .put_file(key.clone(), encoded[..encoded.len() / 2].to_vec())
+                .await;
+        }
+        drop(store);
+        for iteration in 0..2 {
+            drop(cache);
+            cache = ManifestCache::new(local.clone(), ReadableSize::mb(32), None, true).await;
+            if source != CacheSource::RemoteFill || iteration > 0 {
+                assert!(
+                   
```

**File**: `src/mito2/src/manifest/storage/checkpoint.rs` (modified, +26/-21)
```diff
@@ -27,7 +27,7 @@ use crate::error::{
     CompressObjectSnafu, DecompressObjectSnafu, OpenDalSnafu, Result, SerdeJsonSnafu, Utf8Snafu,
 };
 use crate::manifest::storage::size_tracker::Tracker;
-use crate::manifest::storage::utils::{get_from_cache, put_to_cache, write_and_put_cache};
+use crate::manifest::storage::utils::{get_from_cache_decoded, write_and_put_cache};
 use crate::manifest::storage::{
     FALL_BACK_COMPRESS_TYPE, LAST_CHECKPOINT_FILE, checkpoint_checksum, checkpoint_file, gen_path,
     verify_checksum,
@@ -102,7 +102,9 @@ impl<T: Tracker> CheckpointStorage<T> {
         let path = self.checkpoint_file_path(version);
 
         // Try to get from cache first
-        if let Some(data) = get_from_cache(self.manifest_cache.as_ref(), &path).await {
+        if let Some(data) =
+            get_from_cache_decoded(self.manifest_cache.as_ref(), &path, self.compress_type).await
+        {
             verify_checksum(&data, metadata.checksum)?;
             self.record_cached_checkpoint_size(version, &path).await;
             return Ok(Some((version, data)));
@@ -113,19 +115,21 @@ impl<T: Tracker> CheckpointStorage<T> {
         let checkpoint_data = match self.object_store.read(&path).await {
             Ok(checkpoint) => {
                 let checkpoint_size = checkpoint.len();
-                let decompress_data =
-                    self.compress_type
-                        .decode(checkpoint)
-                        .await
-                        .with_context(|_| DecompressObjectSnafu {
-                            compress_type: self.compress_type,
-                            path: path.clone(),
-                        })?;
+                let decompress_data = self
+                    .compress_type
+                    .decode(checkpoint.clone())
+                    .await
+                    .with_context(|_| DecompressObjectSnafu {
+                        compress_type: self.compress_type,
+                        path: path.clone(),
+                    })?;
                 verify_checksum(&decompress_data, metadata.checksum)?;
                 // set the checkpoint size
                 self.size_tracker.record(version, checkpoint_size as u64);
                 // Add to cache
-                put_to_cache(self.manifest_cache.as_ref(), path, &decompress_data).await;
+                if let Some(cache) = &self.manifest_cache {
+                    cache.put_file(path, checkpoint.to_vec()).await;
+                }
                 Ok(Some(decompress_data))
             }
             Err(e) => {
@@ -142,8 +146,12 @@ impl<T: Tracker> CheckpointStorage<T> {
                         );
 
                         // Try to get fallback from cache first
-                        if let Some(data) =
-                            get_from_cache(self.manifest_cache.as_ref(), &fall_back_path).await
+                        if let Some(data) = get_from_cache_decoded(
+                            self.manifest_cache.as_ref(),
+                            &fall_back_path,
+                            FALL_BACK_COMPRESS_TYPE,
+                        )
+                        .await
                         {
                             verify_checksum(&data, metadata.checksum)?;
                             self.record_cached_checkpoint_size(version, &fall_back_path)
@@ -155,7 +163,7 @@ impl<T: Tracker> CheckpointStorage<T> {
                             Ok(checkpoint) => {
                                 let checkpoint_size = checkpoint.len();
                                 let decompress_data = FALL_BACK_COMPRESS_TYPE
-                                    .decode(checkpoint)
+                                    .decode(checkpoint.clone())
                                     .await
                                     .with_context(|_| DecompressObjectSnafu {
                                         compress_type: FALL_BACK_COMPRESS_TYPE,
@@ -164,12 +172,9 @@ impl<T: Tracker> CheckpointStorage<T> {
                                 verify_checksum(&decompress_data, metadata.checksum)?;
                                 self.size_tracker.record(version, checkpoint_size as u64);
                                 // Add fallback to cache
-                                put_to_cache(
-                                    self.manifest_cache.as_ref(),
-                                    fall_back_path,
-                                    &decompress_data,
-                                )
-                                .await;
+                                if let Some(cache) = &self.manifest_cache {
+                                    cache.put_file(fall_back_path, checkpoint.to_vec()).await;
+                                }
                                 Ok(Some(decompress_data))
                             }
                             Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
@@ -220,7 +225,7 @@ impl<T: Tracker> CheckpointStorage<T> {
         Ok(Some(che
```

**File**: `src/mito2/src/manifest/storage/delta.rs` (modified, +7/-5)
```diff
@@ -31,7 +31,7 @@ use crate::error::{
 };
 use crate::manifest::storage::size_tracker::Tracker;
 use crate::manifest::storage::utils::{
-    get_from_cache, put_to_cache, sort_manifests, write_and_put_cache,
+    get_from_cache_decoded, sort_manifests, write_and_put_cache,
 };
 use crate::manifest::storage::{
     FETCH_MANIFEST_PARALLELISM, delta_file, file_compress_type, file_version, gen_path,
@@ -206,8 +206,9 @@ impl<T: Tracker> DeltaStorage<T> {
             let _permit = semaphore.acquire().await.unwrap();
 
             let cache_key = entry.path();
+            let compress_type = file_compress_type(entry.name());
             // Try to get from cache first
-            if let Some(data) = get_from_cache(self.manifest_cache.as_ref(), cache_key).await {
+            if let Some(data) = get_from_cache_decoded(self.manifest_cache.as_ref(), cache_key, compress_type).await {
                 let size = entry.metadata().content_length();
                 if size > 0 {
                     self.delta_tracker.record(*v, size);
@@ -221,7 +222,6 @@ impl<T: Tracker> DeltaStorage<T> {
             }
 
             // Fetch from remote object store
-            let compress_type = file_compress_type(entry.name());
             let bytes = match self.object_store.read(entry.path()).await {
                 Ok(bytes) => bytes,
                 Err(error) if error.kind() == ErrorKind::NotFound => {
@@ -234,15 +234,17 @@ impl<T: Tracker> DeltaStorage<T> {
             };
             self.delta_tracker.record(*v, bytes.len() as u64);
             let data = compress_type
-                .decode(bytes)
+                .decode(bytes.clone())
                 .await
                 .context(DecompressObjectSnafu {
                     compress_type,
                     path: entry.path(),
                 })?;
 
             // Add to cache
-            put_to_cache(self.manifest_cache.as_ref(), cache_key.to_string(), &data).await;
+            if let Some(cache) = &self.manifest_cache {
+                cache.put_file(cache_key.to_string(), bytes.to_vec()).await;
+            }
 
             Ok((*v, data))
         });
```

**File**: `src/mito2/src/manifest/storage/utils.rs` (modified, +29/-21)
```diff
@@ -12,6 +12,8 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
+use common_datasource::compression::CompressionType;
+use common_telemetry::debug;
 use object_store::{Entry, ObjectStore};
 use snafu::ResultExt;
 use store_api::ManifestVersion;
@@ -21,19 +23,29 @@ use crate::error::{OpenDalSnafu, Result};
 
 const CHUNK_SIZE: usize = 64 * 1024 * 1024; // 64MB
 
-/// Gets a manifest file from cache.
-/// Returns the file data if found in cache, None otherwise.
-pub(crate) async fn get_from_cache(cache: Option<&ManifestCache>, key: &str) -> Option<Vec<u8>> {
+/// Gets and decodes the object payload cached under `key`.
+///
+/// Older remote fills cached decoded content. If decoding fails, discard the
+/// entry and let the caller refill it from object storage. Remote decode and
+/// checksum errors are still returned by the caller.
+pub(crate) async fn get_from_cache_decoded(
+    cache: Option<&ManifestCache>,
+    key: &str,
+    compress_type: CompressionType,
+) -> Option<Vec<u8>> {
     let cache = cache?;
-    cache.get_file(key).await
-}
-
-/// Puts a manifest file into cache.
-pub(crate) async fn put_to_cache(cache: Option<&ManifestCache>, key: String, data: &[u8]) {
-    let Some(cache) = cache else {
-        return;
-    };
-    cache.put_file(key, data.to_vec()).await
+    let raw = cache.get_file(key).await?;
+    match compress_type.decode(raw.as_slice()).await {
+        Ok(data) => Some(data),
+        Err(error) => {
+            debug!(
+                "Failed to decode cached manifest {}, removing entry: {}",
+                key, error
+            );
+            cache.remove(key).await;
+            None
+        }
+    }
 }
 
 /// Removes a manifest file from cache.
@@ -44,19 +56,15 @@ pub(crate) async fn remove_from_cache(cache: Option<&ManifestCache>, key: &str)
     cache.remove(key).await
 }
 
-/// Writes data to object store and puts it into cache.
+/// Writes data to object store and caches the same encoded payload.
 pub(crate) async fn write_and_put_cache(
     object_store: &ObjectStore,
     cache: Option<&ManifestCache>,
     path: &str,
     data: Vec<u8>,
 ) -> Result<()> {
-    // Clone data for cache before writing, only if cache is enabled.
-    let cache_data = if cache.is_some() {
-        Some(data.clone())
-    } else {
-        None
-    };
+    // Clone only when caching is enabled; retain the owner for the cache write.
+    let cache_data = cache.map(|cache| (cache, data.clone()));
 
     // Write to object store
     object_store
@@ -66,8 +74,8 @@ pub(crate) async fn write_and_put_cache(
         .context(OpenDalSnafu)?;
 
     // Put to cache if we cloned the data
-    if let Some(data) = cache_data {
-        put_to_cache(cache, path.to_string(), &data).await;
+    if let Some((cache, data)) = cache_data {
+        cache.put_file(path.to_string(), data).await;
     }
 
     Ok(())
```

**File**: `src/mito2/src/manifest/tests/checkpoint.rs` (modified, +69/-0)
```diff
@@ -1072,3 +1072,72 @@ impl oio::List for ZeroSizeLister {
         Ok(Some(oio::Entry::new(&path, builder.build())))
     }
 }
+
+#[rstest::rstest]
+#[case(CompressionType::Uncompressed)]
+#[case(CompressionType::Gzip)]
+#[case(CompressionType::Zstd)]
+#[tokio::test]
+async fn manifest_cache_write_through_survives_reopen(#[case] compression: CompressionType) {
+    use common_base::readable_size::ReadableSize;
+    use common_test_util::temp_dir::create_temp_dir;
+    use object_store::ObjectStore;
+    use object_store::services::Fs;
+
+    use crate::cache::manifest_cache::ManifestCache;
+    use crate::manifest::manager::RegionManifestOptions;
+    use crate::sst::FormatType;
+
+    let remote_dir = create_temp_dir("manifest-manager-remote");
+    let cache_dir = create_temp_dir("manifest-manager-cache");
+    let remote = ObjectStore::new(Fs::default().root(remote_dir.path().to_str().unwrap())).unwrap();
+    let local = ObjectStore::new(Fs::default().root(cache_dir.path().to_str().unwrap())).unwrap();
+    let cache = ManifestCache::new(local.clone(), ReadableSize::mb(32), None, true).await;
+    // Use a relative prefix, matching production keys and the recovered index.
+    let mut options = RegionManifestOptions {
+        manifest_dir: "region/".to_string(),
+        object_store: remote,
+        compress_type: compression,
+        checkpoint_distance: 3,
+        remove_file_options: Default::default(),
+        manifest_cache: Some(cache.clone()),
+    };
+    let mut writer = RegionManifestManager::new(
+        Arc::new(basic_region_metadata()),
+        0,
+        options.clone(),
+        FormatType::PrimaryKey,
+        false,
+        &Default::default(),
+    )
+    .await
+    .unwrap();
+    for _ in 0..7 {
+        writer.update(nop_action(), false).await.unwrap();
+        wait_for_manifest_checkpoint(&writer).await;
+    }
+    let key = gen_path(
+        "region/",
+        &checkpoint_file(writer.checkpointer().last_checkpoint_version()),
+        compression,
+    );
+    assert!(cache.get(&key).await.is_some());
+    let version = writer.manifest().manifest_version;
+    let usage = writer.manifest_usage();
+    drop(writer);
+    drop(cache);
+    // Release the final old cache handle before recovering a new index.
+    drop(options.manifest_cache.take());
+    let cache = ManifestCache::new(local, ReadableSize::mb(32), None, true).await;
+    assert!(
+        cache.get(&key).await.is_some(),
+        "cache recovery missed {key}"
+    );
+    options.manifest_cache = Some(cache);
+    let reopened = RegionManifestManager::open(options, &Default::default())
+        .await
+        .unwrap()
+        .unwrap();
+    assert_eq!(version, reopened.manifest().manifest_version);
+    assert_eq!(usage, reopened.manifest_usage());
+}
```

---

### Incident Patch 3: `8e4aa4c8` (2026-11-05)
**Commit Message**: fix(grafana): correct autopilot counters and show baseline reasons (#10160)

* fix(grafana): correct autopilot counters and show baseline reasons

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

* fix(grafana): retain baseline totals when details are unavailable

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

---------

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

**File**: `grafana/dashboards/metrics/cluster/dashboard.json` (modified, +18/-5)
```diff
@@ -13962,7 +13962,7 @@
                 "uid": "${metrics}"
               },
               "editorMode": "code",
-              "expr": "sum by (result) (\n  changes(greptime_region_balancer_actions_total[$__rate_interval])\n)",
+              "expr": "sum by (result) (\n  increase(greptime_region_balancer_actions_total[$__rate_interval])\n)",
               "hide": false,
               "instant": false,
               "legendFormat": "{{result}}",
@@ -14064,7 +14064,7 @@
                 "uid": "${metrics}"
               },
               "editorMode": "code",
-              "expr": "sum by (gate, reason) (changes(greptime_region_balancer_gate_stop_total[$__rate_interval]))",
+              "expr": "sum by (gate, reason) (increase(greptime_region_balancer_gate_stop_total[$__rate_interval]))",
               "hide": false,
               "instant": false,
               "legendFormat": "{{gate}} / {{reason}}",
@@ -14399,7 +14399,7 @@
                 "uid": "${metrics}"
               },
               "editorMode": "code",
-              "expr": "sum by (result) (changes(greptime_auto_repartition_actions_total[$__rate_interval]))",
+              "expr": "sum by (result) (increase(greptime_auto_repartition_actions_total[$__rate_interval]))",
               "hide": false,
               "instant": false,
               "legendFormat": "{{result}}",
@@ -14415,7 +14415,7 @@
             "type": "prometheus",
             "uid": "${metrics}"
           },
-          "description": "Auto repartition gate stop count by gate and reason",
+          "description": "Repartition gate stop increments. Baseline failures show detailed reasons when available; otherwise the aggregate invalid_baseline series is retained. Fallback is matched per source before aggregation to avoid double counting across mixed versions.",
           "fieldConfig": {
             "defaults": {
               "color": {
@@ -14501,12 +14501,25 @@
                 "uid": "${metrics}"
               },
               "editorMode": "code",
-              "expr": "sum by (gate, reason) (changes(greptime_auto_repartition_gate_stop_total[$__rate_interval]))",
+              "expr": "sum by (gate, reason) (\n  increase(greptime_auto_repartition_gate_stop_total{reason!=\"invalid_baseline\"}[$__rate_interval])\n  or\n  (increase(greptime_auto_repartition_gate_stop_total{reason=\"invalid_baseline\"}[$__rate_interval])\n    unless ignoring (gate, reason)\n    increase(greptime_auto_repartition_invalid_baseline_total[$__rate_interval]))\n)",
               "hide": false,
               "instant": false,
               "legendFormat": "{{gate}} / {{reason}}",
               "range": true,
               "refId": "A"
+            },
+            {
+              "datasource": {
+                "type": "prometheus",
+                "uid": "${metrics}"
+              },
+              "editorMode": "code",
+              "expr": "sum by (reason) (increase(greptime_auto_repartition_invalid_baseline_total[$__rate_interval]))",
+              "hide": false,
+              "instant": false,
+              "legendFormat": "baseline / {{reason}}",
+              "range": true,
+              "refId": "B"
             }
           ],
           "title": "Auto Repartition Gate Stops",
```

**File**: `grafana/dashboards/metrics/cluster/dashboard.md` (modified, +10/-4)
```diff
@@ -241,14 +241,20 @@ ORDER BY data_size DESC;` | `piechart` | Distribution of leader regions and data
 | Title | Query | Type | Description | Datasource | Unit | Legend Format |
 | --- | --- | --- | --- | --- | --- | --- |
 | Region Balancer Actions | `sum by (result) (
-  changes(greptime_region_balancer_actions_total[$__rate_interval])
+  increase(greptime_region_balancer_actions_total[$__rate_interval])
 )` | `timeseries` | Region balancer action count | `prometheus` | `short` | `{{result}}` |
-| Region Balancer Gate Stops | `sum by (gate, reason) (changes(greptime_region_balancer_gate_stop_total[$__rate_interval]))` | `timeseries` | Region balancer gate stop count by gate and reason | `prometheus` | `short` | `{{gate}} / {{reason}}` |
+| Region Balancer Gate Stops | `sum by (gate, reason) (increase(greptime_region_balancer_gate_stop_total[$__rate_interval]))` | `timeseries` | Region balancer gate stop count by gate and reason | `prometheus` | `short` | `{{gate}} / {{reason}}` |
 | Region Balancer Datanodes | `sum by (state) (greptime_region_balancer_datanodes)` | `stat` | Region balancer datanode count by state | `prometheus` | `short` | `{{state}}` |
 | Region Balancer Regions | `sum by (state) (greptime_region_balancer_regions)` | `stat` | Region balancer region count by state | `prometheus` | `short` | `{{state}}` |
 | Region Balancer Datanode Stability | `sum by (state) (greptime_region_balancer_datanode_stability)` | `stat` | Region balancer datanode stability statistics by state | `prometheus` | `binBps` | `{{state}}` |
-| Auto Repartition Actions | `sum by (result) (changes(greptime_auto_repartition_actions_total[$__rate_interval]))` | `timeseries` | Auto repartition action count by result | `prometheus` | `short` | `{{result}}` |
-| Auto Repartition Gate Stops | `sum by (gate, reason) (changes(greptime_auto_repartition_gate_stop_total[$__rate_interval]))` | `timeseries` | Auto repartition gate stop count by gate and reason | `prometheus` | `short` | `{{gate}} / {{reason}}` |
+| Auto Repartition Actions | `sum by (result) (increase(greptime_auto_repartition_actions_total[$__rate_interval]))` | `timeseries` | Auto repartition action count by result | `prometheus` | `short` | `{{result}}` |
+| Auto Repartition Gate Stops | `sum by (gate, reason) (
+  increase(greptime_auto_repartition_gate_stop_total{reason!="invalid_baseline"}[$__rate_interval])
+  or
+  (increase(greptime_auto_repartition_gate_stop_total{reason="invalid_baseline"}[$__rate_interval])
+    unless ignoring (gate, reason)
+    increase(greptime_auto_repartition_invalid_baseline_total[$__rate_interval]))
+)`<br/>`sum by (reason) (increase(greptime_auto_repartition_invalid_baseline_total[$__rate_interval]))` | `timeseries` | Repartition gate stop increments. Baseline failures show detailed reasons when available; otherwise the aggregate invalid_baseline series is retained. Fallback is matched per source before aggregation to avoid double counting across mixed versions. | `prometheus` | `short` | `{{gate}} / {{reason}}` |
 | Auto Repartition Sampling P99 | `histogram_quantile(0.99, sum by (le, stage) (rate(greptime_auto_repartition_sampling_elapsed_bucket[$__rate_interval])))` | `timeseries` | Auto repartition sampling elapsed time by stage | `prometheus` | `s` | `{{stage}}` |
 | Auto Repartition Executor P99 | `histogram_quantile(0.99, sum by (le, stage) (rate(greptime_auto_repartition_executor_elapsed_bucket[$__rate_interval])))` | `timeseries` | Auto repartition executor elapsed time by stage | `prometheus` | `s` | `{{stage}}` |
 # Object Store
```

**File**: `grafana/dashboards/metrics/cluster/dashboard.yaml` (modified, +17/-5)
```diff
@@ -1904,7 +1904,7 @@ groups:
           queries:
             - expr: |-
                 sum by (result) (
-                  changes(greptime_region_balancer_actions_total[$__rate_interval])
+                  increase(greptime_region_balancer_actions_total[$__rate_interval])
                 )
               datasource:
                 type: prometheus
@@ -1915,7 +1915,7 @@ groups:
           description: Region balancer gate stop count by gate and reason
           unit: short
           queries:
-            - expr: sum by (gate, reason) (changes(greptime_region_balancer_gate_stop_total[$__rate_interval]))
+            - expr: sum by (gate, reason) (increase(greptime_region_balancer_gate_stop_total[$__rate_interval]))
               datasource:
                 type: prometheus
                 uid: ${metrics}
@@ -1955,21 +1955,33 @@ groups:
           description: Auto repartition action count by result
           unit: short
           queries:
-            - expr: sum by (result) (changes(greptime_auto_repartition_actions_total[$__rate_interval]))
+            - expr: sum by (result) (increase(greptime_auto_repartition_actions_total[$__rate_interval]))
               datasource:
                 type: prometheus
                 uid: ${metrics}
               legendFormat: '{{result}}'
         - title: Auto Repartition Gate Stops
           type: timeseries
-          description: Auto repartition gate stop count by gate and reason
+          description: Repartition gate stop increments. Baseline failures show detailed reasons when available; otherwise the aggregate invalid_baseline series is retained. Fallback is matched per source before aggregation to avoid double counting across mixed versions.
           unit: short
           queries:
-            - expr: sum by (gate, reason) (changes(greptime_auto_repartition_gate_stop_total[$__rate_interval]))
+            - expr: |-
+                sum by (gate, reason) (
+                  increase(greptime_auto_repartition_gate_stop_total{reason!="invalid_baseline"}[$__rate_interval])
+                  or
+                  (increase(greptime_auto_repartition_gate_stop_total{reason="invalid_baseline"}[$__rate_interval])
+                    unless ignoring (gate, reason)
+                    increase(greptime_auto_repartition_invalid_baseline_total[$__rate_interval]))
+                )
               datasource:
                 type: prometheus
                 uid: ${metrics}
               legendFormat: '{{gate}} / {{reason}}'
+            - expr: sum by (reason) (increase(greptime_auto_repartition_invalid_baseline_total[$__rate_interval]))
+              datasource:
+                type: prometheus
+                uid: ${metrics}
+              legendFormat: baseline / {{reason}}
         - title: Auto Repartition Sampling P99
           type: timeseries
           description: Auto repartition sampling elapsed time by stage
```

**File**: `grafana/dashboards/metrics/standalone/dashboard.json` (modified, +18/-5)
```diff
@@ -13962,7 +13962,7 @@
                 "uid": "${metrics}"
               },
               "editorMode": "code",
-              "expr": "sum by (result) (\n  changes(greptime_region_balancer_actions_total[$__rate_interval])\n)",
+              "expr": "sum by (result) (\n  increase(greptime_region_balancer_actions_total[$__rate_interval])\n)",
               "hide": false,
               "instant": false,
               "legendFormat": "{{result}}",
@@ -14064,7 +14064,7 @@
                 "uid": "${metrics}"
               },
               "editorMode": "code",
-              "expr": "sum by (gate, reason) (changes(greptime_region_balancer_gate_stop_total[$__rate_interval]))",
+              "expr": "sum by (gate, reason) (increase(greptime_region_balancer_gate_stop_total[$__rate_interval]))",
               "hide": false,
               "instant": false,
               "legendFormat": "{{gate}} / {{reason}}",
@@ -14399,7 +14399,7 @@
                 "uid": "${metrics}"
               },
               "editorMode": "code",
-              "expr": "sum by (result) (changes(greptime_auto_repartition_actions_total[$__rate_interval]))",
+              "expr": "sum by (result) (increase(greptime_auto_repartition_actions_total[$__rate_interval]))",
               "hide": false,
               "instant": false,
               "legendFormat": "{{result}}",
@@ -14415,7 +14415,7 @@
             "type": "prometheus",
             "uid": "${metrics}"
           },
-          "description": "Auto repartition gate stop count by gate and reason",
+          "description": "Repartition gate stop increments. Baseline failures show detailed reasons when available; otherwise the aggregate invalid_baseline series is retained. Fallback is matched per source before aggregation to avoid double counting across mixed versions.",
           "fieldConfig": {
             "defaults": {
               "color": {
@@ -14501,12 +14501,25 @@
                 "uid": "${metrics}"
               },
               "editorMode": "code",
-              "expr": "sum by (gate, reason) (changes(greptime_auto_repartition_gate_stop_total[$__rate_interval]))",
+              "expr": "sum by (gate, reason) (\n  increase(greptime_auto_repartition_gate_stop_total{reason!=\"invalid_baseline\"}[$__rate_interval])\n  or\n  (increase(greptime_auto_repartition_gate_stop_total{reason=\"invalid_baseline\"}[$__rate_interval])\n    unless ignoring (gate, reason)\n    increase(greptime_auto_repartition_invalid_baseline_total[$__rate_interval]))\n)",
               "hide": false,
               "instant": false,
               "legendFormat": "{{gate}} / {{reason}}",
               "range": true,
               "refId": "A"
+            },
+            {
+              "datasource": {
+                "type": "prometheus",
+                "uid": "${metrics}"
+              },
+              "editorMode": "code",
+              "expr": "sum by (reason) (increase(greptime_auto_repartition_invalid_baseline_total[$__rate_interval]))",
+              "hide": false,
+              "instant": false,
+              "legendFormat": "baseline / {{reason}}",
+              "range": true,
+              "refId": "B"
             }
           ],
           "title": "Auto Repartition Gate Stops",
```

**File**: `grafana/dashboards/metrics/standalone/dashboard.md` (modified, +10/-4)
```diff
@@ -241,14 +241,20 @@ ORDER BY data_size DESC;` | `piechart` | Distribution of leader regions and data
 | Title | Query | Type | Description | Datasource | Unit | Legend Format |
 | --- | --- | --- | --- | --- | --- | --- |
 | Region Balancer Actions | `sum by (result) (
-  changes(greptime_region_balancer_actions_total[$__rate_interval])
+  increase(greptime_region_balancer_actions_total[$__rate_interval])
 )` | `timeseries` | Region balancer action count | `prometheus` | `short` | `{{result}}` |
-| Region Balancer Gate Stops | `sum by (gate, reason) (changes(greptime_region_balancer_gate_stop_total[$__rate_interval]))` | `timeseries` | Region balancer gate stop count by gate and reason | `prometheus` | `short` | `{{gate}} / {{reason}}` |
+| Region Balancer Gate Stops | `sum by (gate, reason) (increase(greptime_region_balancer_gate_stop_total[$__rate_interval]))` | `timeseries` | Region balancer gate stop count by gate and reason | `prometheus` | `short` | `{{gate}} / {{reason}}` |
 | Region Balancer Datanodes | `sum by (state) (greptime_region_balancer_datanodes)` | `stat` | Region balancer datanode count by state | `prometheus` | `short` | `{{state}}` |
 | Region Balancer Regions | `sum by (state) (greptime_region_balancer_regions)` | `stat` | Region balancer region count by state | `prometheus` | `short` | `{{state}}` |
 | Region Balancer Datanode Stability | `sum by (state) (greptime_region_balancer_datanode_stability)` | `stat` | Region balancer datanode stability statistics by state | `prometheus` | `binBps` | `{{state}}` |
-| Auto Repartition Actions | `sum by (result) (changes(greptime_auto_repartition_actions_total[$__rate_interval]))` | `timeseries` | Auto repartition action count by result | `prometheus` | `short` | `{{result}}` |
-| Auto Repartition Gate Stops | `sum by (gate, reason) (changes(greptime_auto_repartition_gate_stop_total[$__rate_interval]))` | `timeseries` | Auto repartition gate stop count by gate and reason | `prometheus` | `short` | `{{gate}} / {{reason}}` |
+| Auto Repartition Actions | `sum by (result) (increase(greptime_auto_repartition_actions_total[$__rate_interval]))` | `timeseries` | Auto repartition action count by result | `prometheus` | `short` | `{{result}}` |
+| Auto Repartition Gate Stops | `sum by (gate, reason) (
+  increase(greptime_auto_repartition_gate_stop_total{reason!="invalid_baseline"}[$__rate_interval])
+  or
+  (increase(greptime_auto_repartition_gate_stop_total{reason="invalid_baseline"}[$__rate_interval])
+    unless ignoring (gate, reason)
+    increase(greptime_auto_repartition_invalid_baseline_total[$__rate_interval]))
+)`<br/>`sum by (reason) (increase(greptime_auto_repartition_invalid_baseline_total[$__rate_interval]))` | `timeseries` | Repartition gate stop increments. Baseline failures show detailed reasons when available; otherwise the aggregate invalid_baseline series is retained. Fallback is matched per source before aggregation to avoid double counting across mixed versions. | `prometheus` | `short` | `{{gate}} / {{reason}}` |
 | Auto Repartition Sampling P99 | `histogram_quantile(0.99, sum by (le, stage) (rate(greptime_auto_repartition_sampling_elapsed_bucket[$__rate_interval])))` | `timeseries` | Auto repartition sampling elapsed time by stage | `prometheus` | `s` | `{{stage}}` |
 | Auto Repartition Executor P99 | `histogram_quantile(0.99, sum by (le, stage) (rate(greptime_auto_repartition_executor_elapsed_bucket[$__rate_interval])))` | `timeseries` | Auto repartition executor elapsed time by stage | `prometheus` | `s` | `{{stage}}` |
 # Object Store
```

**File**: `grafana/dashboards/metrics/standalone/dashboard.yaml` (modified, +17/-5)
```diff
@@ -1904,7 +1904,7 @@ groups:
           queries:
             - expr: |-
                 sum by (result) (
-                  changes(greptime_region_balancer_actions_total[$__rate_interval])
+                  increase(greptime_region_balancer_actions_total[$__rate_interval])
                 )
               datasource:
                 type: prometheus
@@ -1915,7 +1915,7 @@ groups:
           description: Region balancer gate stop count by gate and reason
           unit: short
           queries:
-            - expr: sum by (gate, reason) (changes(greptime_region_balancer_gate_stop_total[$__rate_interval]))
+            - expr: sum by (gate, reason) (increase(greptime_region_balancer_gate_stop_total[$__rate_interval]))
               datasource:
                 type: prometheus
                 uid: ${metrics}
@@ -1955,21 +1955,33 @@ groups:
           description: Auto repartition action count by result
           unit: short
           queries:
-            - expr: sum by (result) (changes(greptime_auto_repartition_actions_total[$__rate_interval]))
+            - expr: sum by (result) (increase(greptime_auto_repartition_actions_total[$__rate_interval]))
               datasource:
                 type: prometheus
                 uid: ${metrics}
               legendFormat: '{{result}}'
         - title: Auto Repartition Gate Stops
           type: timeseries
-          description: Auto repartition gate stop count by gate and reason
+          description: Repartition gate stop increments. Baseline failures show detailed reasons when available; otherwise the aggregate invalid_baseline series is retained. Fallback is matched per source before aggregation to avoid double counting across mixed versions.
           unit: short
           queries:
-            - expr: sum by (gate, reason) (changes(greptime_auto_repartition_gate_stop_total[$__rate_interval]))
+            - expr: |-
+                sum by (gate, reason) (
+                  increase(greptime_auto_repartition_gate_stop_total{reason!="invalid_baseline"}[$__rate_interval])
+                  or
+                  (increase(greptime_auto_repartition_gate_stop_total{reason="invalid_baseline"}[$__rate_interval])
+                    unless ignoring (gate, reason)
+                    increase(greptime_auto_repartition_invalid_baseline_total[$__rate_interval]))
+                )
               datasource:
                 type: prometheus
                 uid: ${metrics}
               legendFormat: '{{gate}} / {{reason}}'
+            - expr: sum by (reason) (increase(greptime_auto_repartition_invalid_baseline_total[$__rate_interval]))
+              datasource:
+                type: prometheus
+                uid: ${metrics}
+              legendFormat: baseline / {{reason}}
         - title: Auto Repartition Sampling P99
           type: timeseries
           description: Auto repartition sampling elapsed time by stage
```

#### Recent Merged Pull Requests:
- **PR #10194** (2026-11-05): docs: tighten README facts and move quick start up (@killme2008)
- **PR #10190** (closed): feat: update dashboard to v0.14.4 (@sunchanglong)
- **PR #10187** (2026-11-05): ci: compare GreptimeDB File and S3 in observability benchmarks (@WenyXu)
- **PR #10186** (2026-11-05): feat: update dashboard to v0.14.3 (@sunchanglong)
- **PR #10184** (2026-11-05): docs: add demo link (@sunchanglong)
- **PR #10182** (closed): fix(common-recordbatch): prune SQL UInt64 predicates in SST manifest scans (@WenyXu)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
