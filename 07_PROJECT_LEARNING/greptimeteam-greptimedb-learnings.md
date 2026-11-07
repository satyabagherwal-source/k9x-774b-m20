> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/greptimeteam-greptimedb-learnings.md`  
> **Source**: github ([https://github.com/GreptimeTeam/greptimedb](https://github.com/GreptimeTeam/greptimedb))  
> **Source Version**: `2fefad6a`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-07T22:23:46.921Z  
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
> **Harvest Timestamp**: 2026-11-07T22:23:46.663Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GreptimeTeam/greptimedb`
- **Description**: The open-source observability database. One columnar engine for metrics, logs, and traces, on object storage.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6793 stars

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
- **Issue #10227** (2026-11-06): **feat(query): read a split-series table through a raw source**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  Follow-up to #10150; sibling of #10226 (which removes the deployment flag from the multi-selector decision).  ## What's changed and what's your intention?  A table partitioned on a column that is not a tag splits one series across regions. A bare scan inside one region therefore holds a fragment, and a window evaluated there sees part of the series: a five-minute range that straddles the boundary has fewer than two samples in each region and produces no value at all. The single-selector route declined that shape in process, so the existing planner answered it.  Read it through a raw source instead:  - `prepare_one_scan` reports whether the declared partition splits a series (partition columns that are not all tags), and that occurrence is wrapped in a `RawSeriesSource` like any other source-backed input. - The segmentation boundary keeps that source (`self_contained || any_split_series`), so a prefix runs above the reconciliation rather than over one region's fragment. - A partition on tags keeps every series whole in one region and keeps the bare-scan path, so nothing changes for the common case.  The last in-process-only refusal keyed on the deployment flag disappears with this change; what remains is the shape.  Tests: an integration regression puts the two samples of one series on either side of a time-partition

- **Issue #10226** (2026-11-06): **feat(query): match a partitioned multi-selector tree above its sources**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  Supersedes #10209 and #10211, which are semantically coupled: the admission change makes a partitioned pair report the duplicate match group natively, and that expectation lives in #10209's test changes. Landing them separately would leave `narthex` red in between.  ## What's changed and what's your intention?  A multi-selector native PromQL tree over a partitioned table had no region-local placement — one node over the bare scans reads neither the other scans nor the fragments another region holds — so it was refused in process and pushed through the frontend hybrid route. The hybrid route copies a matcher into the other operand's scan, which its own documentation says can hide a duplicate that Prometheus reports.  The shape now runs natively on both routes:  - **Every selector occurrence reads its own source.** Wrapping follows the shape (`cross_table || (multi_input && (any_partitioned || required_placement))`). `cross_table` remains one of the terms — what is gone is the deployment flag as an alternative for a multi-input tree, and the in-process refusal for a partitioned multi-selector tree. - **A cut keeps those sources.** A table split into regions now keeps the raw source under the cut in process as well as over the wire (`self_contained || (per_source_inputs && any_partitioned)`), so a window evaluates abov

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

### Incident Patch 1: `c9acb55a` (2026-11-06)
**Commit Message**: fix(meta-srv): acquire remote WAL read lock once before upgrade retries (#10205)

UpgradeCandidateRegion acquired RemoteWalLock::Read for each topic on every
retry attempt while keeping the guards from earlier attempts. If a
WalPruneProcedure queued RemoteWalLock::Write on the same topic during the first
attempt, the retry's second read acquire waited behind the writer (the lock is a
fair tokio RwLock), and the writer waited on the first read guard. The region
migration and the WAL prune then hung until metasrv restarted.

Acquire the read guards once before the retry loop and hold them until the
function returns.

Fixes #10204

**File**: `src/meta-srv/src/procedure/region_migration/upgrade_candidate_region.rs` (modified, +214/-10)
```diff
@@ -309,19 +309,21 @@ impl UpgradeCandidateRegion {
         let mut retry = 0;
         let mut upgraded = false;
 
+        // If using Kafka WAL, hold a read lock on each topic for all attempts to prevent WAL
+        // pruning during the upgrade. Acquire once: re-acquiring a held read lock on retry
+        // queues behind a waiting `WalPruneProcedure` writer, which waits on the first guard.
         let mut guards = Vec::with_capacity(topics.len());
+        for topic in &topics {
+            guards.push(
+                procedure_ctx
+                    .provider
+                    .acquire_lock(&(RemoteWalLock::Read(topic.clone()).into()))
+                    .await,
+            );
+        }
+
         loop {
             let timer = Instant::now();
-            // If using Kafka WAL, acquire a read lock on the topic to prevent WAL pruning during the upgrade.
-            for topic in &topics {
-                guards.push(
-                    procedure_ctx
-                        .provider
-                        .acquire_lock(&(RemoteWalLock::Read(topic.clone()).into()))
-                        .await,
-                );
-            }
-
             if let Err(err) = self.upgrade_region(ctx).await {
                 retry += 1;
                 ctx.update_operations_elapsed(timer);
@@ -856,3 +858,205 @@ mod tests {
         assert_matches!(update_metadata, UpdateMetadata::Rollback);
     }
 }
+
+/// Regression tests for a deadlock between the upgrade step's per-retry `RemoteWalLock::Read`
+/// (now acquired once before the retry loop) and `WalPruneProcedure`'s `RemoteWalLock::Write`
+/// on the same topic.
+///
+/// Mirrors a datanode rolling restart: failover sends the upgrade instruction to a candidate
+/// datanode that never answers, the mailbox times out (retryable), and the periodic WAL prune
+/// for the region's topic starts while the upgrade is waiting. Both procedures share one
+/// `ContextProvider`, as they do inside metasrv's procedure manager.
+///
+/// Requires a Kafka broker: `GT_KAFKA_ENDPOINTS=127.0.0.1:9092`.
+#[cfg(test)]
+mod wal_prune_deadlock_tests {
+    use std::assert_matches;
+    use std::sync::Arc;
+    use std::sync::atomic::{AtomicUsize, Ordering};
+
+    use common_meta::key::table_route::TableRouteValue;
+    use common_meta::key::test_utils::new_test_table_info;
+    use common_meta::peer::Peer;
+    use common_meta::region_registry::LeaderRegionRegistry;
+    use common_meta::rpc::router::{Region, RegionRoute};
+    use common_meta::wal_provider::{RegionWalOptions, build_kafka_client};
+    use common_procedure::Procedure;
+    use common_wal::config::kafka::common::KafkaConnectionConfig;
+    use common_wal::maybe_skip_kafka_integration_test;
+    use common_wal::options::KafkaWalOptions;
+    use common_wal::test_util::get_kafka_endpoints;
+    use store_api::storage::RegionId;
+    use tokio::time::timeout;
+
+    use super::*;
+    use crate::procedure::region_migration::test_util::{TestingEnv, new_procedure_context};
+    use crate::procedure::region_migration::{
+        ContextFactory, PersistentContext, RegionMigrationTriggerReason,
+    };
+    use crate::procedure::wal_prune::{Context as WalPruneContext, WalPruneProcedure};
+
+    struct Scenario {
+        env: TestingEnv,
+        ctx: Context,
+        topic: String,
+        upgrade_instructions: Arc<AtomicUsize>,
+    }
+
+    /// One region on a Kafka topic, failing over to a datanode that receives the upgrade
+    /// instruction but never replies (it is restarting).
+    async fn setup(name: &str) -> Scenario {
+        let topic = format!("{name}_{}", uuid::Uuid::new_v4());
+        let region_id = RegionId::new(1024, 1);
+        let persistent_ctx = PersistentContext::new(
+            vec![("greptime".into(), "public".into())],
+            Peer::empty(1),
+            Peer::empty(2),
+            vec![region_id],
+            // The migration timeout; the first upgrade attempt consumes all of it.
+            Duration::from_millis(1000),
+            RegionMigrationTriggerReason::Failover,
+        );
+        let to_peer_id = persistent_ctx.to_peer.id;
+
+        let mut env = TestingEnv::new();
+        let ctx = env.context_factory().new_context(persistent_ctx);
+        let region_routes = vec![RegionRoute {
+            region: Region::new_test(region_id),
+            leader_peer: Some(ctx.persistent_ctx.from_peer.clone()),
+            follower_peers: vec![ctx.persistent_ctx.to_peer.clone()],
+            ..Default::default()
+        }];
+        let wal_options = RegionWalOptions::from([(
+            region_id.region_number(),
+            WalOptions::Kafka(KafkaWalOptions::new(topic.clone())),
+        )]);
+        ctx.table_metadata_manager
+            .create_table_metadata(
+                new_test_table_info(region_id.table_id()),
+                TableRouteValue::physical(region_routes),
+                wal_options,
+            )
+            .await
+    
```

---

### Incident Patch 2: `bba6818c` (2026-11-06)
**Commit Message**: fix(ci): honor configured region in metric snapshot benchmark (#10157)

* fix(ci): honor configured region in metric snapshot benchmark

Signed-off-by: WenyXu <[REDACTED_EMAIL]>

* docs(ci): clarify AWS runner region configuration

Include the documentation changes from #10158 alongside the region fix.

Signed-off-by: Weny Xu <[REDACTED_EMAIL]>

---------

Signed-off-by: WenyXu <[REDACTED_EMAIL]>
Signed-off-by: Weny Xu <[REDACTED_EMAIL]>

**File**: `.github/scripts/ci-runners.md` (modified, +6/-2)
```diff
@@ -13,8 +13,12 @@ AWS uses `aws-ec2-runner-provision.py` and `aws-ec2-runner-teardown.py` directly
 Repository variables supply `EC2_RUNNER_REGION`, `EC2_RUNNER_SUBNET_ID`, and
 `EC2_RUNNER_SECURITY_GROUP_ID`; credentials use `AWS_ACCESS_KEY_ID`,
 `AWS_SECRET_ACCESS_KEY`, and `GH_PERSONAL_ACCESS_TOKEN` secrets.
-The current region is Singapore (`ap-southeast-1`). By default the script selects
-the newest available Canonical Ubuntu 24.04 amd64 server AMI in that region
+The runner region comes from `EC2_RUNNER_REGION` (currently `us-east-1`).
+The subnet and security group must belong to the selected AWS account and region.
+For benchmarks using real S3, `AWS_CI_TEST_BUCKET_REGION` must match the runner
+region; `AWS_CI_TEST_BUCKET` must be accessible with the configured credentials.
+By default the script selects the newest available Canonical Ubuntu 24.04 amd64
+server AMI in that region
 (owner `099720109477`) and logs its ID. Set `BENCHMARK_EC2_IMAGE_ID` to pin a
 prepared Ubuntu AMI. Existing build CI's `EC2_RUNNER_LINUX_AMD64_IMAGE_ID` is
 unaffected. Both workflows default `system_disk_gib` to `auto` (also accepting
```

**File**: `.github/scripts/metric-snapshot-s3-bench.py` (modified, +4/-3)
```diff
@@ -105,8 +105,9 @@ def __init__(self, local_smoke):
         self.endpoint = os.environ.get("S3_ENDPOINT", "")
         if self.endpoint and not local_smoke:
             raise ValueError("Custom S3 endpoints are restricted to local smoke")
-        if not local_smoke and os.environ["S3_REGION"] != "ap-southeast-1":
-            raise ValueError("Cloud benchmark requires ap-southeast-1")
+        if not local_smoke and (not os.environ["S3_REGION"].strip()
+                                or os.environ["S3_REGION"] != os.environ["RUNNER_REGION"]):
+            raise ValueError("Cloud benchmark requires the same nonempty bucket and runner region")
         self.containers = set()
         self.network_created = False
         self.phases = []
@@ -324,7 +325,7 @@ def summary(self):
         lines = ["# Metric packed snapshot benchmark", "", f"Image: `{self.image}`",
                  f"Source commit: `{self.commit}`", "",
                  "Local smoke only; timings are not AWS results." if self.local_smoke else
-                 "AWS S3 in ap-southeast-1; source and target use local File storage.", "",
+                 f"S3 in {os.environ['S3_REGION']}; source and target use local File storage.", "",
                  "| Round | Phase | Seconds | Result |", "| --- | --- | ---: | --- |"]
         for phase in self.phases:
             lines.append(f"| {phase['round']} | {phase['phase']} | {phase['wall_seconds']:.3f} | {phase['outcome']} |")
```

**File**: `.github/scripts/metric-snapshot-s3-ops.py` (modified, +25/-12)
```diff
@@ -21,16 +21,16 @@
 """Budget preflight and strictly scoped S3 operations for the metric snapshot benchmark."""
 
 import argparse
-from decimal import Decimal
+from decimal import Decimal, InvalidOperation
 import json
 import os
 from pathlib import Path
 import re
 import time
 import urllib.request
 
-REGION = "ap-southeast-1"
-HOURLY_USD = Decimal("0.9408")
+# Historical budget estimate; dispatch can supply a rate for the configured region.
+DEFAULT_HOURLY_USD = "0.9408"
 OTHER_RESERVE_USD = Decimal("1.50")
 
 
@@ -40,6 +40,16 @@ def owned_prefix(prefix):
     return prefix
 
 
+def hourly_estimate(env):
+    try:
+        estimate = Decimal(env.get("EC2_HOURLY_USD", DEFAULT_HOURLY_USD))
+    except InvalidOperation as error:
+        raise ValueError("EC2_HOURLY_USD must be a positive finite estimate") from error
+    if not estimate.is_finite() or estimate <= 0:
+        raise ValueError("EC2_HOURLY_USD must be a positive finite estimate")
+    return estimate
+
+
 def plan(env):
     image = env["GREPTIMEDB_IMAGE"]
     if not re.fullmatch(r"greptime/greptimedb(?:-nightly)?@sha256:[0-9a-f]{64}", image):
@@ -49,30 +59,31 @@ def plan(env):
     tables, minutes = int(env["LOGICAL_TABLES_PER_GROUP"]), int(env["BENCHMARK_TIMEOUT_MINUTES"])
     if not 50 <= tables <= 10_000 or not 30 <= minutes <= 240:
         raise ValueError("logical tables per group must be 50..10000; timeout must be 30..240 minutes")
-    if env["S3_REGION"] != REGION or env["RUNNER_REGION"] != REGION:
-        raise ValueError("bucket and runner must both use ap-southeast-1")
+    if not env["S3_REGION"].strip() or env["S3_REGION"] != env["RUNNER_REGION"]:
+        raise ValueError("bucket and runner must use the same nonempty region")
     if not env["S3_BUCKET"]:
         raise ValueError("S3 bucket is required")
     prior = Decimal(env["PRIOR_SPEND_USD"])
     # Reserve 45m provision, 10m queue allowance and 20m cleanup beyond the job timeout.
-    reservation = HOURLY_USD * Decimal(minutes + 75) / 60 + OTHER_RESERVE_USD
+    hourly = hourly_estimate(env)
+    reservation = hourly * Decimal(minutes + 75) / 60 + OTHER_RESERVE_USD
     if not prior.is_finite() or prior < 0 or prior >= 15 or prior + reservation > 20:
         raise ValueError("campaign budget exhausted: prior spend must be below $15 and leave the full attempt reserve within $20")
     return {"image": image, "expected_commit": env["EXPECTED_COMMIT"],
             "logical_tables_per_group": tables, "smoke_logical_tables": 500,
             "timeout_minutes": minutes, "prefix": owned_prefix(env["RUN_PREFIX"]),
-            "instance_type": "c6id.4xlarge", "region": REGION,
+            "instance_type": "c6id.4xlarge", "region": env["S3_REGION"],
             "prior_estimated_usd": str(prior), "attempt_reserve_usd": str(reservation),
-            "ec2_hourly_usd": str(HOURLY_USD), "other_reserve_usd": str(OTHER_RESERVE_USD),
+            "ec2_hourly_usd": str(hourly), "other_reserve_usd": str(OTHER_RESERVE_USD),
             "cost_note": "Estimate, not an AWS billing total or a hard spending cap."}
 
 
 def client(region):
     import boto3
     from botocore.config import Config
 
-    if region != REGION:
-        raise ValueError("S3 region must be ap-southeast-1")
+    if not region.strip():
+        raise ValueError("S3 region is required")
     return boto3.client("s3", region_name=region, config=Config(
         connect_timeout=10, read_timeout=30, retries={"mode": "standard", "max_attempts": 3}))
 
@@ -193,8 +204,10 @@ def main():
         if args.started_at is None:
             parser.error("cost requires --started-at")
         seconds = max(0, int(time.time()) - args.started_at)
-        estimate = HOURLY_USD * Decimal(seconds) / 3600
-        result = {"allocation_window_seconds": seconds, "ec2_estimate_usd": str(round(estimate, 4)),
+        hourly = hourly_estimate(os.environ)
+        estimate = hourly * Decimal(seconds) / 3600
+        result = {"allocation_window_seconds": seconds, "ec2_hourly_usd": str(hourly),
+                  "ec2_estimate_usd": str(round(estimate, 4)),
                   "campaign_estimate_with_other_reserve_usd": str(round(
                       Decimal(os.environ["PRIOR_SPEND_USD"]) + estimate + OTHER_RESERVE_USD, 4)),
                   "note": "Allocation wall-time estimate plus $1.50 reserve for S3, disk and IPv4; not an AWS bill."}
```

**File**: `.github/scripts/tests/test_metric_snapshot_s3_bench.py` (modified, +19/-0)
```diff
@@ -28,6 +28,25 @@
 
 
 class PhaseTests(unittest.TestCase):
+    def test_cloud_region_configuration(self):
+        for bucket, runner, accepted in (("us-east-1", "us-east-1", True),
+                                          ("ap-southeast-1", "ap-southeast-1", True),
+                                          ("us-east-1", "ap-southeast-1", False),
+                                          ("", "", False)):
+            with self.subTest(bucket=bucket, runner=runner), tempfile.TemporaryDirectory() as directory:
+                env = dict(GREPTIMEDB_IMAGE="greptime/greptimedb@sha256:" + "a" * 64,
+                           EXPECTED_COMMIT="b" * 40, RUN_PREFIX="metric-snapshot-bench/123-1/",
+                           RESULTS=str(Path(directory) / "results"), DATA_ROOT=str(Path(directory) / "data"),
+                           S3_REGION=bucket, RUNNER_REGION=runner, S3_ENDPOINT="")
+                with patch.dict(bench.os.environ, env):
+                    if accepted:
+                        benchmark = bench.Benchmark(local_smoke=False)
+                        benchmark.summary()
+                        self.assertIn(f"S3 in {bucket};", (benchmark.results / "summary.md").read_text())
+                    else:
+                        with self.assertRaisesRegex(ValueError, "same nonempty"):
+                            bench.Benchmark(local_smoke=False)
+
     def test_docker_nanosecond_timestamps(self):
         start = bench.docker_timestamp("2026-10-14T06:06:44.72000818Z")
         end = bench.docker_timestamp("2026-10-14T06:06:46.123456789Z")
```

**File**: `.github/scripts/tests/test_metric_snapshot_s3_ops.py` (modified, +40/-0)
```diff
@@ -20,6 +20,7 @@
 import json
 from pathlib import Path
 import tempfile
+import types
 import unittest
 from unittest import mock
 
@@ -82,6 +83,45 @@ def test_budget_includes_provision_cleanup_and_other_cost_reserve(self):
             with self.subTest(changes=changes), self.assertRaises(ValueError):
                 ops.plan(self.env(**changes))
 
+    def test_regions_follow_configuration_and_reject_mismatch_or_empty(self):
+        for region in ("us-east-1", "ap-southeast-1"):
+            with self.subTest(region=region):
+                self.assertEqual(ops.plan(self.env(S3_REGION=region, RUNNER_REGION=region))["region"], region)
+        for bucket, runner in (("us-east-1", "ap-southeast-1"), ("", ""), (" ", " ")):
+            with self.subTest(bucket=bucket, runner=runner), self.assertRaises(ValueError):
+                ops.plan(self.env(S3_REGION=bucket, RUNNER_REGION=runner))
+
+    def test_client_uses_configured_region(self):
+        boto = types.ModuleType("boto3")
+        boto.client = mock.Mock()
+        config = types.ModuleType("botocore.config")
+        config.Config = mock.Mock()
+        with mock.patch.dict("sys.modules", {"boto3": boto, "botocore.config": config}):
+            for region in ("us-east-1", "ap-southeast-1"):
+                ops.client(region)
+                self.assertEqual(boto.client.call_args.kwargs["region_name"], region)
+            with self.assertRaises(ValueError):
+                ops.client("")
+
+    def test_hourly_estimate_controls_reservation_and_cost(self):
+        env = self.env(EC2_HOURLY_USD="2", BENCHMARK_TIMEOUT_MINUTES="30")
+        plan = ops.plan(env)
+        self.assertEqual(plan["ec2_hourly_usd"], "2")
+        self.assertEqual(plan["attempt_reserve_usd"], "5.00")
+        with mock.patch.dict(ops.os.environ, env), mock.patch.object(ops.time, "time", return_value=4600), \
+                mock.patch("sys.argv", ["ops", "cost", "--started-at", "1000"]), \
+                mock.patch("sys.stdout", new_callable=io.StringIO) as output:
+            ops.main()
+        cost = json.loads(output.getvalue())
+        self.assertEqual(cost["ec2_hourly_usd"], "2")
+        self.assertEqual(cost["ec2_estimate_usd"], "2.0000")
+        self.assertEqual(cost["campaign_estimate_with_other_reserve_usd"], "3.5000")
+        for rate in ("", "invalid", "0", "-1", "NaN", "Infinity", "-Infinity"):
+            with self.subTest(rate=rate), self.assertRaises(ValueError):
+                ops.plan(self.env(EC2_HOURLY_USD=rate))
+        with self.assertRaises(ValueError):
+            ops.plan(self.env(EC2_HOURLY_USD="4"))
+
     def watcher_env(self):
         return self.env(GITHUB_REPOSITORY="GreptimeTeam/greptimedb", GITHUB_RUN_ID="123",
                         GITHUB_RUN_ATTEMPT="2", GH_TOKEN="test-token", BENCHMARK_TIMEOUT_MINUTES="30")
```

**File**: `.github/workflows/metric-snapshot-s3-bench.yml` (modified, +6/-0)
```diff
@@ -18,6 +18,11 @@ on:
         description: 'Setup, 500-table smoke and full run timeout, 30..240 minutes'
         type: number
         default: 240
+      ec2_hourly_usd:
+        description: 'Positive EC2 hourly USD budget estimate; historical default, not live regional pricing'
+        required: true
+        type: string
+        default: '0.9408'
       prior_spend_usd:
         description: 'Cumulative estimated cloud spend for all earlier attempts in this $20 campaign'
         required: true
@@ -34,6 +39,7 @@ env:
   LOGICAL_TABLES_PER_GROUP: ${{ inputs.logical_tables_per_group }}
   BENCHMARK_TIMEOUT_MINUTES: ${{ inputs.benchmark_timeout_minutes }}
   PRIOR_SPEND_USD: ${{ inputs.prior_spend_usd }}
+  EC2_HOURLY_USD: ${{ inputs.ec2_hourly_usd }}
   RUN_PREFIX: metric-snapshot-bench/${{ github.run_id }}-${{ github.run_attempt }}/
   S3_BUCKET: ${{ vars.AWS_CI_TEST_BUCKET }}
   S3_REGION: ${{ vars.AWS_CI_TEST_BUCKET_REGION }}
```

**File**: `docs/how-to/metric-snapshot-s3-bench.md` (modified, +12/-5)
```diff
@@ -1,14 +1,17 @@
 # Metric snapshot benchmark on AWS S3
 
 The manual `Metric Snapshot S3 Benchmark` workflow tests packed Metric export and
-restore against real S3 in `ap-southeast-1`. It must first exist on the repository's
-default branch for GitHub to register `workflow_dispatch`. It was validated on AWS
+restore against real S3 in the configured CI bucket region. It must first exist on
+the repository's default branch for GitHub to register `workflow_dispatch`. It was validated on AWS
 by run [38544464731](https://github.com/GreptimeTeam/greptimedb/actions/runs/38544464731);
 [#9573](https://github.com/GreptimeTeam/greptimedb/pull/9573) records its conditions and results.
 
 ## Run
 
 Use the repository's existing EC2 runner configuration and CI S3 credentials.
+`AWS_CI_TEST_BUCKET_REGION` and `EC2_RUNNER_REGION` must be nonempty and equal;
+for example, both can be `us-east-1`. The configured subnet, security group and
+AMI (if explicitly supplied) must also belong to the runner region.
 The workflow passes credentials only through CI; no local AWS credentials are
 needed. Source, target and CLI use the same immutable image. This image's source
 SHA and required CLI capabilities have been checked:
@@ -20,6 +23,7 @@ gh workflow run metric-snapshot-s3-bench.yml \
   -f expected_commit=f690bbb2040865c0d22b0b57d51612b60ae27cd0 \
   -f logical_tables_per_group=10000 \
   -f benchmark_timeout_minutes=240 \
+  -f ec2_hourly_usd=0.9408 \
   -f prior_spend_usd=0
 ```
 
@@ -28,9 +32,12 @@ earlier cloud attempts in the campaign, including failed setup and cleanup.
 Do not reset the estimate to zero when retrying. The workflow accepts 50–10,000
 logical tables per group and a 30–240 minute benchmark job timeout.
 
-The runner is fixed at `c6id.4xlarge` (16 vCPU, 32 GiB RAM). At the recorded
-Singapore Linux on-demand estimate of $0.9408/hour, the default attempt reserves
-$6.4392: four benchmark hours, 45 minutes of provisioning, 10 minutes for queueing,
+The runner is fixed at `c6id.4xlarge` (16 vCPU, 32 GiB RAM). Set
+`ec2_hourly_usd` to a positive, finite hourly budget estimate appropriate for the
+selected region and instance. Its default $0.9408/hour preserves the historical
+Singapore estimate; it is not a live regional price or a guaranteed upper bound.
+The same estimate is used for preflight reservation and the final cost summary.
+At that default rate, the default attempt reserves $6.4392: four benchmark hours, 45 minutes of provisioning, 10 minutes for queueing,
 20 minutes of cleanup, and $1.50 for S3, disk and IPv4 costs. Preflight rejects prior spend at or above
 $15, or an attempt whose reserve would exceed the cumulative $20 budget.
 These estimates and checks are not an AWS hard spending cap or an AWS bill.
```

---

### Incident Patch 3: `ae422ef4` (2026-11-06)
**Commit Message**: fix: prioritize region ALTER over queued edits (#10193)

* fix: prioritize region ALTER over queued edits

Signed-off-by: evenyag <[REDACTED_EMAIL]>

* test: use valid edits in ALTER priority regression

Signed-off-by: evenyag <[REDACTED_EMAIL]>

* refactor: make region edit dispatch outcomes explicit

Signed-off-by: evenyag <[REDACTED_EMAIL]>

* fix: reject queued alters and edits when dropping regions

Signed-off-by: evenyag <[REDACTED_EMAIL]>

* test: cover queued ALTER handoff before region edits

Signed-off-by: evenyag <[REDACTED_EMAIL]>

---------

Signed-off-by: evenyag <[REDACTED_EMAIL]>

**File**: `src/mito2/src/engine/edit_region_test.rs` (modified, +336/-0)
```diff
@@ -884,3 +884,339 @@ async fn test_edit_region_concurrently_with_format(flat_format: bool) {
         tasks_count * EDITS_PER_TASK
     );
 }
+
+#[tokio::test]
+async fn test_alter_precedes_edit_backlog() {
+    use store_api::region_request::{AddColumn, AlterKind, RegionAlterRequest};
+    use tokio::sync::Notify;
+    struct Listener {
+        tx: mpsc::UnboundedSender<usize>,
+        altering: Notify,
+        release: Notify,
+        flushing: Notify,
+        release_flush: Notify,
+    }
+    #[async_trait::async_trait]
+    impl EventListener for Listener {
+        fn on_recv_requests(&self, count: usize) {
+            let _ = self.tx.send(count);
+        }
+        async fn on_flush_begin(&self, _: RegionId) {
+            self.flushing.notify_one();
+            self.release_flush.notified().await;
+        }
+        async fn on_notify_region_change_result_begin(&self, _: RegionId) {
+            self.altering.notify_one();
+            self.release.notified().await;
+        }
+    }
+    for (dirty, invalid) in [(false, false), (true, false), (false, true)] {
+        let mut env = TestEnv::new().await;
+        let (tx, mut rx) = mpsc::unbounded_channel();
+        let listener = Arc::new(Listener {
+            tx,
+            altering: Notify::new(),
+            release: Notify::new(),
+            flushing: Notify::new(),
+            release_flush: Notify::new(),
+        });
+        let engine = env
+            .create_engine_with(
+                MitoConfig {
+                    schedule_compaction_after_edit: false,
+                    ..Default::default()
+                },
+                None,
+                Some(listener.clone()),
+                None,
+            )
+            .await;
+        let region_id = RegionId::new(1, 1);
+        let create = CreateRequestBuilder::new().build();
+        let schema = rows_schema(&create);
+        engine
+            .handle_request(region_id, RegionRequest::Create(create))
+            .await
+            .unwrap();
+        if dirty {
+            crate::test_util::put_rows(
+                &engine,
+                region_id,
+                Rows {
+                    schema,
+                    rows: build_rows(0, 1),
+                },
+            )
+            .await;
+        }
+        let region = engine.get_region(region_id).unwrap();
+        let guard = region.manifest_ctx.manifest_manager.write().await;
+        let e = engine.clone();
+        let first = tokio::spawn(async move {
+            e.edit_region(region_id, test_region_edit(region_id, FileId::random()))
+                .await
+        });
+        wait_until_region_is_in_editing(&region).await;
+        drain_worker_recv_events(&mut rx);
+        let file_id = FileId::random();
+        let e = engine.clone();
+        let queued = tokio::spawn(async move {
+            e.edit_region(region_id, test_region_edit(region_id, file_id))
+                .await
+        });
+        wait_worker_recv_event(&mut rx).await;
+        let e = engine.clone();
+        let alter = tokio::spawn(async move {
+            e.handle_request(
+                region_id,
+                RegionRequest::Alter(RegionAlterRequest {
+                    kind: AlterKind::AddColumns {
+                        columns: vec![AddColumn {
+                            column_metadata: store_api::metadata::ColumnMetadata {
+                                column_schema: datatypes::schema::ColumnSchema::new(
+                                    if invalid { "ts" } else { "new_field" },
+                                    datatypes::data_type::ConcreteDataType::float64_datatype(),
+                                    true,
+                                ),
+                                semantic_type: api::v1::SemanticType::Field,
+                                column_id: 100,
+                            },
+                            location: None,
+                        }],
+                    },
+                }),
+            )
+            .await
+        });
+        wait_worker_recv_event(&mut rx).await;
+        drop(guard);
+        let late = if dirty {
+            tokio::time::timeout(Duration::from_secs(10), listener.flushing.notified())
+                .await
+                .unwrap();
+            drain_worker_recv_events(&mut rx);
+            let e = engine.clone();
+            let task = tokio::spawn(async move {
+                e.edit_region(region_id, test_region_edit(region_id, FileId::random()))
+                    .await
+            });
+            wait_worker_recv_event(&mut rx).await;
+            listener.release_flush.notify_one();
+            Some(task)
+        } else {
+            None
+        };
+        if invalid {
+            assert!(alter.await.unwrap().is_err());
+            first.await.unwrap().unwrap();
+            tokio::time::timeout(Duration::from_secs(10), queued)
+                .await
+             
```

**File**: `src/mito2/src/flush.rs` (modified, +10/-0)
```diff
@@ -1497,6 +1497,16 @@ impl FlushScheduler {
         status.pending_bulk_writes.push(request);
     }
 
+    /// Whether an ALTER owns a turn while waiting for its memtables to flush.
+    pub(crate) fn has_pending_alter(&self, region_id: RegionId) -> bool {
+        self.region_status.get(&region_id).is_some_and(|status| {
+            status
+                .pending_ddls
+                .iter()
+                .any(|ddl| matches!(ddl.request, DdlRequest::Alter(_)))
+        })
+    }
+
     /// Returns true if the region has pending DDLs or a close-time flush.
     pub(crate) fn has_pending_ddls(&self, region_id: RegionId) -> bool {
         self.region_status
```

**File**: `src/mito2/src/worker.rs` (modified, +3/-0)
```diff
@@ -769,6 +769,7 @@ impl<S: LogStore> WorkerStarter<S> {
             region_count: REGION_COUNT.with_label_values(&[&id_string]),
             request_wait_time: REQUEST_WAIT_TIME.with_label_values(&[&id_string]),
             region_edit_queues: RegionEditQueues::default(),
+            pending_alters: Default::default(),
             schema_metadata_manager: self.schema_metadata_manager,
             file_ref_manager: self.file_ref_manager.clone(),
             partition_expr_fetcher: self.partition_expr_fetcher,
@@ -1100,6 +1101,8 @@ struct RegionWorkerLoop<S> {
     request_wait_time: Histogram,
     /// Queues for region edit requests.
     region_edit_queues: RegionEditQueues,
+    /// ALTER requests waiting for the current edit or ALTER to finish.
+    pending_alters: handle_alter::PendingAlters,
     /// Database level metadata manager.
     schema_metadata_manager: SchemaMetadataManagerRef,
     /// Datanode level file references manager.
```

**File**: `src/mito2/src/worker/handle_alter.rs` (modified, +35/-0)
```diff
@@ -45,12 +45,47 @@ use crate::request::{DdlRequest, OptionOutputTx, SenderDdlRequest};
 use crate::sst::FormatType;
 use crate::worker::RegionWorkerLoop;
 
+pub(crate) type PendingAlters = std::collections::HashMap<
+    RegionId,
+    std::collections::VecDeque<(RegionAlterRequest, OptionOutputTx)>,
+>;
+
 impl<S: LogStore> RegionWorkerLoop<S> {
     pub(crate) async fn handle_alter_request(
         &mut self,
         region_id: RegionId,
         request: RegionAlterRequest,
         sender: OptionOutputTx,
+    ) {
+        if self.flush_scheduler.has_pending_alter(region_id)
+            || self.pending_alters.contains_key(&region_id)
+            || self.regions.get_region(region_id).is_some_and(|region| {
+                matches!(
+                    region.state(),
+                    crate::region::RegionRoleState::Leader(
+                        crate::region::RegionLeaderState::Editing
+                            | crate::region::RegionLeaderState::Altering
+                    )
+                )
+            })
+        {
+            let queue = self.pending_alters.entry(region_id).or_default();
+            if queue.len() >= 128 {
+                sender.send(crate::error::RegionBusySnafu { region_id }.fail());
+            } else {
+                queue.push_back((request, sender));
+            }
+            self.dispatch_pending_region_requests(region_id).await;
+            return;
+        }
+        self.execute_alter_request(region_id, request, sender).await;
+    }
+
+    pub(crate) async fn execute_alter_request(
+        &mut self,
+        region_id: RegionId,
+        request: RegionAlterRequest,
+        sender: OptionOutputTx,
     ) {
         let requested_skip_wal = skip_wal_value(&request.kind);
         let (region, follower_skip_wal) = match self.regions.writable_non_staging_region(region_id)
```

**File**: `src/mito2/src/worker/handle_drop.rs` (modified, +3/-0)
```diff
@@ -223,6 +223,9 @@ where
 
     /// Cleans runtime state for a region that is no longer available to serve requests.
     pub(crate) async fn cleanup_dropped_region_runtime_state(&mut self, region_id: RegionId) {
+        // A successful flush may hand off DROP before queued ALTERs and edits resume.
+        // Reject their waiters here because the removed region has no next turn.
+        self.reject_region_edit_queue_as_not_found(region_id);
         // Notifies flush scheduler.
         self.flush_scheduler.on_region_dropped(region_id);
         // Notifies compaction scheduler.
```

**File**: `src/mito2/src/worker/handle_flush.rs` (modified, +11/-1)
```diff
@@ -74,6 +74,7 @@ impl<S: LogStore> RegionWorkerLoop<S> {
 
         // Handle stalled requests.
         self.handle_stalled_requests().await;
+        self.dispatch_pending_region_requests(region_id).await;
     }
 
     /// Checks whether the engine reaches flush threshold. If so, finds regions in this
@@ -483,7 +484,15 @@ impl<S: LogStore> RegionWorkerLoop<S> {
             self.flush_scheduler.on_flush_success(region_id)
         {
             // Perform DDLs first because they require empty memtables.
-            self.handle_ddl_requests(&mut ddl_requests).await;
+            // These ALTERs already own the flush turn; bypass initial admission.
+            for ddl in ddl_requests.drain(..) {
+                if let crate::request::DdlRequest::Alter(request) = ddl.request {
+                    self.execute_alter_request(ddl.region_id, request, ddl.sender)
+                        .await;
+                } else {
+                    self.handle_ddl_requests(&mut vec![ddl]).await;
+                }
+            }
             if self.flush_scheduler.is_flush_requested(region_id) {
                 // The DDL may schedule another flush, e.g. a close-time flush after writes
                 // arrived in the mutable memtable during the previous flush. Keep pending
@@ -518,6 +527,7 @@ impl<S: LogStore> RegionWorkerLoop<S> {
         // Schedules compaction.
         self.schedule_compaction(&region).await;
 
+        self.dispatch_pending_region_requests(region_id).await;
         self.listener.on_flush_success(region_id);
     }
 
```

**File**: `src/mito2/src/worker/handle_manifest.rs` (modified, +89/-25)
```diff
@@ -52,7 +52,14 @@ use crate::worker::{RegionWorkerLoop, WorkerListener};
 
 pub(crate) type RegionEditQueues = HashMap<RegionId, RegionEditQueue>;
 
-/// A queue for region edit requests received while the region is already `Editing`.
+/// Outcome of admitting a region edit, independent of subsequent region role changes.
+pub(crate) enum RegionEditDispatch {
+    Started,
+    Queued,
+    Rejected,
+}
+
+/// A queue for region edits waiting behind an active edit or ALTER.
 ///
 /// Normal writes and bulk inserts that arrive during `Editing` use the stalled-write queue instead.
 /// When an edit completes, those writes are handled before the next queued edit starts, preserving
@@ -74,17 +81,18 @@ impl RegionEditQueue {
         }
     }
 
-    fn enqueue(&mut self, request: RegionEditRequest) {
+    fn enqueue(&mut self, request: RegionEditRequest) -> RegionEditDispatch {
         if self.requests.len() > Self::QUEUE_MAX_LEN {
             request.waiters.reply_with(|| {
                 RegionBusySnafu {
                     region_id: self.region_id,
                 }
                 .fail()
             });
-            return;
+            return RegionEditDispatch::Rejected;
         };
         self.requests.push_back(request);
+        RegionEditDispatch::Queued
     }
 
     fn dequeue(&mut self) -> Option<RegionEditRequest> {
@@ -149,8 +157,13 @@ impl RegionEditQueue {
 }
 
 impl<S: LogStore> RegionWorkerLoop<S> {
-    /// Rejects queued region edit requests as region not found.
+    /// Rejects queued ALTER and region edit requests as region not found.
     pub(crate) fn reject_region_edit_queue_as_not_found(&mut self, region_id: RegionId) {
+        if let Some(queue) = self.pending_alters.remove(&region_id) {
+            for (_, sender) in queue {
+                sender.send(RegionNotFoundSnafu { region_id }.fail());
+            }
+        }
         if let Some(edit_queue) = self.region_edit_queues.remove(&region_id) {
             edit_queue.reject_all_as_not_found();
         }
@@ -206,6 +219,8 @@ impl<S: LogStore> RegionWorkerLoop<S> {
         // Handles the stalled requests.
         self.handle_region_stalled_requests(&change_result.region_id, true)
             .await;
+        self.dispatch_pending_region_requests(change_result.region_id)
+            .await;
     }
 
     /// Handles region sync request.
@@ -285,19 +300,24 @@ impl<S: LogStore> RegionWorkerLoop<S> {
 }
 
 impl<S: LogStore> RegionWorkerLoop<S> {
-    /// Handles region edit request.
-    pub(crate) fn handle_region_edit(&mut self, request: RegionEditRequest) {
+    /// Admits an edit and reports whether it started, queued, or failed synchronously.
+    pub(crate) fn handle_region_edit(&mut self, request: RegionEditRequest) -> RegionEditDispatch {
         let region_id = request.region_id;
         let Some(region) = self.regions.get_region(region_id) else {
             request
                 .waiters
                 .reply_with(|| RegionNotFoundSnafu { region_id }.fail());
-            return;
+            return RegionEditDispatch::Rejected;
         };
 
-        if !region.is_writable() {
-            if region.state() == RegionRoleState::Leader(RegionLeaderState::Editing) {
-                self.region_edit_queues
+        if !region.is_writable() || self.flush_scheduler.has_pending_alter(region_id) {
+            if matches!(
+                region.state(),
+                RegionRoleState::Leader(RegionLeaderState::Editing | RegionLeaderState::Altering)
+            ) || (region.is_writable() && self.flush_scheduler.has_pending_alter(region_id))
+            {
+                return self
+                    .region_edit_queues
                     .entry(region_id)
                     .or_insert_with(|| RegionEditQueue::new(region_id))
                     .enqueue(request);
@@ -306,7 +326,7 @@ impl<S: LogStore> RegionWorkerLoop<S> {
                     .waiters
                     .reply_with(|| RegionBusySnafu { region_id }.fail());
             }
-            return;
+            return RegionEditDispatch::Rejected;
         }
 
         let RegionEditRequest {
@@ -339,7 +359,7 @@ impl<S: LogStore> RegionWorkerLoop<S> {
         if let Err(e) = region.set_editing(expect_state) {
             let e = Arc::new(e);
             waiters.reply_with(|| Err(e.clone()).context(EditRegionSnafu { region_id }));
-            return;
+            return RegionEditDispatch::Rejected;
         }
         region.version_control.update_last_sequence(file_sequence);
 
@@ -383,6 +403,7 @@ impl<S: LogStore> RegionWorkerLoop<S> {
                 );
             }
         });
+        RegionEditDispatch::Started
     }
 
     /// Handles region edit result.
@@ -450,25 +471,68 @@ impl<S: LogStore> RegionWorkerLoop<S> {
                 .await;
         }
 
-        let next_request =
-            if let Some(edit_queue) = self.region_edit_queues.get_mut(&edit_result.region_id) {
-                let request = edit_
```

#### Recent Merged Pull Requests:
- **PR #10227** (2026-11-06): feat(query): read a split-series table through a raw source (@discord9)
- **PR #10226** (2026-11-06): feat(query): match a partitioned multi-selector tree above its sources (@discord9)
- **PR #10224** (2026-11-06): fix(query): plan a data-free statement and a zero-match discovery natively (@discord9)
- **PR #10223** (2026-11-06): feat(promql): match an empty on() and grouped cardinalities natively (@discord9)
- **PR #10219** (2026-11-06): fix(meta-srv): invalidate leader cache on transaction errors (@WenyXu)
- **PR #10218** (2026-11-07): feat(meta): configure drain parallelism and strategy over HTTP (@WenyXu)

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

## X. meta-srv): acquire remote WAL read lock once before upgrade retries (#10205)

**RULE**:
When implementing operations in `src/meta-srv/src/procedure/region_migration/upgrade_candidate_region.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in GreptimeTeam/greptimedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c9acb55a`: meta-srv): acquire remote WAL read lock once before upgrade retries (#10205). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/meta-srv/src/procedure/region_migration/upgrade_candidate_region.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        // If using Kafka WAL, hold a read lock on each topic for all attempts to prevent WAL
        // pruning during the upgrade. Acquire once: re-acquiring a held read lock on retry
        // queues behind a waiting `WalPruneProcedure` writer, which waits on the first guard.
        for topic in &topics {
            guards.push(
                procedure_ctx
                    .provider
                    .acquire_lock(&(RemoteWalLock::Read(topic.clone()).into()))
                    .await,
            );
        }


/// Regression tests for a deadlock between the upgrade step's per-retry `RemoteWalLock::Read`
/// (now acquired once before the retry loop) and `WalPruneProcedure`'s `RemoteWalLock::Write`
/// on the same topic.
///
/// Mirrors a datanode rolling restart: failover sends the upgrade instruction to a candidate
/// datanode that never answers, the mailbox times out (retryable), and the periodic WAL prune
/// for the region's topic starts while the upgrade is waiting. Both procedures share one
/// `ContextProvider`, as they do inside metasrv's procedure manager.
///
/// Requires a Kafka broker: `GT_KAFKA_ENDPOINTS=127.0.0.1:9092`.
#[cfg(test)]
mod wal_prune_deadl
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
            // If using Kafka WAL, acquire a read lock on the topic to prevent WAL pruning during the upgrade.
            for topic in &topics {
                guards.push(
                    procedure_ctx
                        .provider
                        .acquire_lock(&(RemoteWalLock::Read(topic.clone()).into()))
                        .await,
                );
            }

```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c9acb55a` are properly handled with clean fallback behavior.
