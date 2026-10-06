# Forensic Learning Record (Deep Inspection): BloopAI/vibe-kanban

> **Canonical Artifact**: `07_PROJECT_LEARNING/bloopai-vibe-kanban-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/BloopAI/vibe-kanban](https://github.com/BloopAI/vibe-kanban))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:37:23.487Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `BloopAI/vibe-kanban`
- **Description**: Get 10X more out of Claude Code, Codex or any coding agent
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 28263 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/db/src/models/execution_process_repo_state.rs`
```
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, TS)]
pub struct ExecutionProcessRepoState {
    pub id: Uuid,
    pub execution_process_id: Uuid,
    pub repo_id: Uuid,
    pub before_head_commit: Option<String>,
    pub after_head_commit: Option<String>,
    pub merge_commit: Option<String>,
    #[ts(type = "Date")]
    pub created_at: DateTime<Utc>,
    #[ts(type = "Date")]
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct CreateExecutionProcessRepoState {
    pub repo_id: Uuid,
    pub before_head_commit: Option<String>,
    pub after_head_commit: Option<String>,
    pub merge_commit: Option<String>,
}

impl ExecutionProcessRepoState {
    pub async fn create_many(
        pool: &SqlitePool,
        execution_process_id: Uuid,
        entries: &[CreateExecutionProcessRepoState],
    ) -> Result<(), sqlx::Error> {
        if entries.is_empty() {
            return Ok(());
        }

        let now = Utc::now();

        for entry in entries {
            let id = Uuid::new_v4();
            sqlx::query!(
                r#"INSERT INTO execution_process_repo_states (
                        id,
                        execution_process_id,
                        repo_id,
                        before_head_commit,
                        after_head_commit,
                        merge_commit,
                        created_at,
                        updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"#,
                id,
                execution_process_id,
                entry.repo_id,
                entry.before_head_commit,
                entry.after_head_commit,
                entry.merge_commit,
                now,
                now
            )
            .execute(pool)
            .await?;
        }

        Ok(())
    }

    pub async fn update_before_head_commit(
        pool: &SqlitePool,
        execution_process_id: Uuid,
        repo_id: Uuid,
        before_head_commit: &str,
    ) -> Result<(), sqlx::Error> {
        let now = Utc::now();
        sqlx::query!(
            r#"UPDATE execution_process_repo_states
               SET before_head_commit = $1, updated_at = $2
             WHERE execution_process_id = $3
               AND repo_id = $4"#,
            before_head_commit,
            now,
            execution_process_id,
            repo_id
        )
        .execute(pool)
        .await?;
        Ok(())
    }

    pub async fn update_after_head_commit(
        pool: &SqlitePool,
        execution_process_id: Uuid,
        repo_id: Uuid,
        after_head_commit: &str,
    ) -> Result<(), sqlx::Error> {
        let now = Utc::now();
        sqlx::query!(
            r#"UPDATE execution_process_repo_states
               SET after_head_commit = $1, updated_at = $2
             WHERE execution_process_id = $3
               AND repo_id = $4"#,
            after_head_commit,
            now,
            execution_process_id,
            repo_id
        )
        .execute(pool)
        .await?;
        Ok(())
    }

    pub async fn find_by_execution_process_id(
        pool: &SqlitePool,
        execution_process_id: Uuid,
    ) -> Result<Vec<Self>, sqlx::Error> {
        sqlx::query_as!(
            ExecutionProcessRepoState,
            r#"SELECT
                    id               as "id!: Uuid",
                    execution_process_id as "execution_process_id!: Uuid",
                    repo_id as "repo_id!: Uuid",
                    before_head_commit,
                    after_head_commit,
                    merge_commit,
                    created_at as "created_at!: DateTime<Utc>",
                    updated_at as "updated_at!: DateTime<Utc>"
               FROM execution_process_repo_states
               WHERE execution_process_id = $1
               ORDER BY created_at ASC"#,
            execution_process_id
        )
        .fetch_all(pool)
        .await
    }
}

```

### Core Architecture Module: `crates/executors/src/executors/utils.rs`
```
use std::{
    hash::Hash,
    num::NonZeroUsize,
    sync::{Arc, Mutex, OnceLock},
    time::{Duration, Instant},
};

use futures::StreamExt;
use lru::LruCache;

use super::{BaseCodingAgent, SlashCommandDescription, StandardCodingAgentExecutor};
use crate::{
    executor_discovery::{ExecutorConfigCacheKey, ExecutorDiscoveredOptions},
    profile::ExecutorConfigs,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SlashCommandCall<'a> {
    /// The command name in lowercase (without the leading slash)
    pub name: String,
    /// The arguments after the command name
    pub arguments: &'a str,
}

pub fn parse_slash_command<'a, T>(prompt: &'a str) -> Option<T>
where
    T: From<SlashCommandCall<'a>>,
{
    let trimmed = prompt.trim_start();
    let without_slash = trimmed.strip_prefix('/')?;
    let mut parts = without_slash.splitn(2, |ch: char| ch.is_whitespace());
    let name = parts.next()?.trim().to_lowercase();
    if name.is_empty() {
        return None;
    }
    let arguments = parts.next().map(|s| s.trim()).unwrap_or("");
    Some(T::from(SlashCommandCall { name, arguments }))
}

/// Reorder slash commands to prioritize compact then review.
#[must_use]
pub fn reorder_slash_commands(
    commands: impl IntoIterator<Item = SlashCommandDescription>,
) -> Vec<SlashCommandDescription> {
    let mut compact_command = None;
    let mut review_commands = None;
    let mut remaining_commands = Vec::new();

    for command in commands {
        match command.name.as_str() {
            "compact" => compact_command = Some(command),
            "review" => review_commands = Some(command),
            _ => remaining_commands.push(command),
        }
    }

    compact_command
        .into_iter()
        .chain(review_commands)
        .chain(remaining_commands)
        .collect()
}

#[derive(Clone, Debug)]
struct CacheEntry<V> {
    cached_at: Instant,
    value: Arc<V>,
}

pub struct TtlCache<K, V> {
    cache: Mutex<LruCache<K, CacheEntry<V>>>,
    ttl: Duration,
}

impl<K, V> TtlCache<K, V>
where
    K: Hash + Eq,
{
    pub fn new(capacity: usize, ttl: Duration) -> Self {
        Self {
            cache: Mutex::new(LruCache::new(
                NonZeroUsize::new(capacity).unwrap_or_else(|| NonZeroUsize::new(1).unwrap()),
            )),
            ttl,
        }
    }

    #[must_use]
    pub fn get(&self, key: &K) -> Option<Arc<V>> {
        let mut cache = self.cache.lock().unwrap_or_else(|e| e.into_inner());
        let entry = cache.get(key)?;
        let value = entry.value.clone();
        let expired = entry.cached_at.elapsed() > self.ttl;
        if expired {
            cache.pop(key);
            None
        } else {
            Some(value)
        }
    }

    pub fn put(&self, key: K, value: V) {
        let mut cache = self.cache.lock().unwrap_or_else(|e| e.into_inner());
        cache.put(
            key,
            CacheEntry {
                cached_at: Instant::now(),
                value: Arc::new(value),
            },
        );
    }
}

pub const EXECUTOR_OPTIONS_CACHE_CAPACITY: usize = 64;
pub const DEFAULT_CACHE_TTL: Duration = Duration::from_mins(5);

pub fn executor_options_cache()
-> &'static TtlCache<ExecutorConfigCacheKey, ExecutorDiscoveredOptions> {
    static INSTANCE: OnceLock<TtlCache<ExecutorConfigCacheKey, ExecutorDiscoveredOptions>> =
        OnceLock::new();
    INSTANCE.get_or_init(|| TtlCache::new(EXECUTOR_OPTIONS_CACHE_CAPACITY, DEFAULT_CACHE_TTL))
}

/// Spawn a background task to refresh the global cache for an executor.
/// This should be called on every use to keep the cache warm.
pub fn spawn_global_cache_refresh_for_agent(base_agent: BaseCodingAgent) {
    spawn_global_cache_refresh_for_agent_with_configs(base_agent, ExecutorConfigs::get_cached());
}

fn spawn_global_cache_refresh_for_agent_with_configs(
    base_agent: BaseCodingAgent,
    configs: ExecutorConfigs,
) {
    let profile_id = crate::profile::ExecutorProfileId::new(base_agent);

    if let Some(coding_agent) = configs.get_coding_agent(&profile_id) {
        tokio::spawn(async move {
            if let Ok(mut stream) = coding_agent.discover_options(None, None).await {
                while stream.next().await.is_some() {}
            }
        });
    }
}

/// Preload the global cache for all executors with DEFAULT presets.
/// This should be called on startup to warm the cache.
pub async fn preload_global_executor_options_cache() {
    let configs = ExecutorConfigs::get_cached();
    let executors: Vec<BaseCodingAgent> = configs.executors.keys().copied().collect();

    for base_agent in executors {
        spawn_global_cache_refresh_for_agent_with_configs(base_agent, configs.clone());
    }
}

```

### Core Architecture Module: `crates/executors/src/logs/utils/entry_index.rs`
```
//! Entry Index Provider for thread-safe monotonic indexing

use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};

use json_patch::PatchOperation;
use workspace_utils::{log_msg::LogMsg, msg_store::MsgStore};

/// Thread-safe provider for monotonically increasing entry indexes
#[derive(Debug, Clone)]
pub struct EntryIndexProvider(Arc<AtomicUsize>);

impl EntryIndexProvider {
    /// Create a new index provider starting from 0 (private; prefer seeding)
    fn new() -> Self {
        Self(Arc::new(AtomicUsize::new(0)))
    }

    /// Get the next available index
    pub fn next(&self) -> usize {
        self.0.fetch_add(1, Ordering::Relaxed)
    }

    /// Get the current index without incrementing
    pub fn current(&self) -> usize {
        self.0.load(Ordering::Relaxed)
    }

    pub fn reset(&self) {
        self.0.store(0, Ordering::Relaxed);
    }

    /// Create a provider starting from the maximum existing normalized-entry index
    /// observed in prior JSON patches in `MsgStore`.
    pub fn start_from(msg_store: &MsgStore) -> Self {
        let provider = EntryIndexProvider::new();

        let max_index: Option<usize> = msg_store
            .get_history()
            .iter()
            .filter_map(|msg| {
                if let LogMsg::JsonPatch(patch) = msg {
                    patch.iter().find_map(|op| {
                        if let PatchOperation::Add(add) = op {
                            add.path
                                .strip_prefix("/entries/")
                                .and_then(|n_str| n_str.parse::<usize>().ok())
                        } else {
                            None
                        }
                    })
                } else {
                    None
                }
            })
            .max();

        let start_at = max_index.map_or(0, |n| n.saturating_add(1));
        provider.0.store(start_at, Ordering::Relaxed);
        provider
    }
}

impl Default for EntryIndexProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
impl EntryIndexProvider {
    /// Test-only constructor for a fresh provider starting at 0
    pub fn test_new() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_entry_index_provider() {
        let provider = EntryIndexProvider::test_new();
        assert_eq!(provider.next(), 0);
        assert_eq!(provider.next(), 1);
        assert_eq!(provider.next(), 2);
    }

    #[test]
    fn test_entry_index_provider_clone() {
        let provider1 = EntryIndexProvider::test_new();
        let provider2 = provider1.clone();

        assert_eq!(provider1.next(), 0);
        assert_eq!(provider2.next(), 1);
        assert_eq!(provider1.next(), 2);
    }

    #[test]
    fn test_current_index() {
        let provider = EntryIndexProvider::test_new();
        assert_eq!(provider.current(), 0);

        provider.next();
        assert_eq!(provider.current(), 1);

        provider.next();
        assert_eq!(provider.current(), 2);
    }
}

```

### Core Architecture Module: `crates/executors/src/logs/utils/mod.rs`
```
//! Utility modules for executor framework

pub mod entry_index;
pub mod patch;

pub use entry_index::EntryIndexProvider;
pub use patch::ConversationPatch;
pub mod shell_command_parsing;

```

### Core Architecture Module: `crates/executors/src/logs/utils/patch.rs`
```
use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
};

use json_patch::Patch;
use serde::{Deserialize, Serialize};
use serde_json::{from_value, json, to_value};
use ts_rs::TS;
use workspace_utils::{diff::Diff, msg_store::MsgStore};

use crate::{
    executor_discovery::ExecutorDiscoveredOptions,
    executors::SlashCommandDescription,
    logs::{NormalizedEntry, utils::EntryIndexProvider},
};

#[derive(Deserialize, Serialize, Debug, Clone, PartialEq, Eq, TS)]
#[serde(rename_all = "lowercase")]
enum PatchOperation {
    Add,
    Replace,
    Remove,
}

#[allow(clippy::large_enum_variant)]
#[derive(Serialize, TS)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE", tag = "type", content = "content")]
pub enum PatchType {
    NormalizedEntry(NormalizedEntry),
    Stdout(String),
    Stderr(String),
    Diff(Diff),
}

#[derive(Serialize)]
struct PatchEntry {
    op: PatchOperation,
    path: String,
    value: PatchType,
}

pub fn escape_json_pointer_segment(s: &str) -> String {
    s.replace('~', "~0").replace('/', "~1")
}

/// Helper functions to create JSON patches for conversation entries
pub struct ConversationPatch;

impl ConversationPatch {
    /// Create an ADD patch for a new conversation entry at the given index
    pub fn add_normalized_entry(entry_index: usize, entry: NormalizedEntry) -> Patch {
        let patch_entry = PatchEntry {
            op: PatchOperation::Add,
            path: format!("/entries/{entry_index}"),
            value: PatchType::NormalizedEntry(entry),
        };

        from_value(json!([patch_entry])).unwrap()
    }

    /// Create an ADD patch for a new string at the given index
    pub fn add_stdout(entry_index: usize, entry: String) -> Patch {
        let patch_entry = PatchEntry {
            op: PatchOperation::Add,
            path: format!("/entries/{entry_index}"),
            value: PatchType::Stdout(entry),
        };

        from_value(json!([patch_entry])).unwrap()
    }

    /// Create an ADD patch for a new string at the given index
    pub fn add_stderr(entry_index: usize, entry: String) -> Patch {
        let patch_entry = PatchEntry {
            op: PatchOperation::Add,
            path: format!("/entries/{entry_index}"),
            value: PatchType::Stderr(entry),
        };

        from_value(json!([patch_entry])).unwrap()
    }

    /// Create a REMOVE patch for removing a diff.
    pub fn remove_diff(entry_index: String) -> Patch {
        from_value(json!([{
            "op": PatchOperation::Remove,
            "path": format!("/entries/{entry_index}"),
        }]))
        .unwrap()
    }

    /// Add a diff entry under a repo namespace: `/entries/<repo>/<file>`
    pub fn add_repo_diff(repo_key: &str, file_path: &str, diff: Diff) -> Patch {
        let patch_entry = PatchEntry {
            op: PatchOperation::Add,
            path: format!(
                "/entries/{}/{}",
                escape_json_pointer_segment(repo_key),
                escape_json_pointer_segment(file_path)
            ),
            value: PatchType::Diff(diff),
        };
        from_value(json!([patch_entry])).unwrap()
    }

    /// Remove a diff entry under a repo namespace: `/entries/<repo>/<file>`
    pub fn remove_repo_diff(repo_key: &str, file_path: &str) -> Patch {
        from_value(json!([{
            "op": PatchOperation::Remove,
            "path": format!(
                "/entries/{}/{}",
                escape_json_pointer_segment(repo_key),
                escape_json_pointer_segment(file_path)
            ),
        }]))
        .unwrap()
    }

    /// Atomically replace all diffs for a repo. Single op, no intermediate empty state.
    pub fn replace_repo_diffs(repo_key: &str, diffs: HashMap<String, Diff>) -> Patch {
        let entries: HashMap<String, PatchType> = diffs
            .into_iter()
            .map(|(path, diff)| (path, PatchType::Diff(diff)))
            .collect();
        from_value(json!([{
            "op": "replace",
            "path": format!("/entries/{}", escape_json_pointer_segment(repo_key)),
            "value": entries,
        }]))
        .unwrap()
    }

    /// Create a REPLACE patch for updating an existing conversation entry at the given index
    pub fn replace(entry_index: usize, entry: NormalizedEntry) -> Patch {
        let patch_entry = PatchEntry {
            op: PatchOperation::Replace,
            path: format!("/entries/{entry_index}"),
            value: PatchType::NormalizedEntry(entry),
        };

        from_value(json!([patch_entry])).unwrap()
    }

    pub fn remove(entry_index: usize) -> Patch {
        from_value(json!([{
            "op": PatchOperation::Remove,
            "path": format!("/entries/{entry_index}"),
        }]))
        .unwrap()
    }
}

/// Extract the entry index and `NormalizedEntry` from a JsonPatch if it contains one
pub fn extract_normalized_entry_from_patch(patch: &Patch) -> Option<(usize, NormalizedEntry)> {
    let value = to_value(patch).ok()?;
    let ops = value.as_array()?;
    ops.iter().rev().find_map(|op| {
        let path = op.get("path")?.as_str()?;
        let entry_index = path.strip_prefix("/entries/")?.parse::<usize>().ok()?;

        let value = op.get("value")?;
        (value.get("type")?.as_str()? == "NORMALIZED_ENTRY")
            .then(|| value.get("content"))
            .flatten()
            .and_then(|c| from_value::<NormalizedEntry>(c.clone()).ok())
            .map(|entry| (entry_index, entry))
    })
}

pub fn upsert_normalized_entry(
    msg_store: &Arc<MsgStore>,
    index: usize,
    normalized_entry: NormalizedEntry,
    is_new: bool,
) {
    if is_new {
        msg_store.push_patch(ConversationPatch::add_normalized_entry(
            index,
            normalized_entry,
        ));
    } else {
        msg_store.push_patch(ConversationPatch::replace(index, normalized_entry));
    }
}

pub fn add_normalized_entry(
    msg_store: &Arc<MsgStore>,
    index_provider: &EntryIndexProvider,
    normalized_entry: NormalizedEntry,
) -> usize {
    let index = index_provider.next();
    upsert_normalized_entry(msg_store, index, normalized_entry, true);
    index
}

pub fn replace_normalized_entry(
    msg_store: &Arc<MsgStore>,
    index: usize,
    normalized_entry: NormalizedEntry,
) {
    upsert_normalized_entry(msg_store, index, normalized_entry, false);
}

/// Extract the path string from a Patch (assumes single-operation patches).
pub fn patch_entry_path(patch: &Patch) -> Option<String> {
    patch.0.first().map(|op| op.path().to_string())
}

pub fn is_add_or_replace(patch: &Patch) -> bool {
    use json_patch::PatchOperation::*;
    patch.0.iter().all(|op| matches!(op, Add(..) | Replace(..)))
}

// Use the "replace" op for sent paths and "add" for new paths
pub fn fix_patch_ops(mut patch: Patch, sent_paths: &mut HashSet<String>) -> Patch {
    for op in &mut patch.0 {
        let path_sent = sent_paths.contains(op.path().as_str());
        match op {
            json_patch::PatchOperation::Add(add) if path_sent => {
                *op = json_patch::PatchOperation::Replace(json_patch::ReplaceOperation {
                    path: add.path.clone(),
                    value: add.value.clone(),
                });
            }
            json_patch::PatchOperation::Replace(replace) if !path_sent => {
                *op = json_patch::PatchOperation::Add(json_patch::AddOperation {
                    path: replace.path.clone(),
                    value: replace.value.clone(),
                });
            }
            _ => {}
        };
        if !path_sent {
            sent_paths.insert(op.path().to_string());
        }
    }
    patch
}

pub fn executor_discovered_options(options: ExecutorDiscoveredOptions) -> Patch {
    serde_json::from_value(json!([
        {"op": "replace", "path": "/options", "value": options},
    ]))
    .unwrap_or_default()
}

pub fn slash_commands(
    commands: Vec<SlashCommandDescription>,
    discovering: bool,
    error: Option<String>,
) -> Patch {
    serde_json::from_value(json!([
        {"op": "replace", "path": "/commands", "value": commands},
        {"op": "replace", "path": "/discovering", "value": discovering},
        {"op": "replace", "path": "/error", "value": error},
    ]))
    .unwrap_or_default()
}

pub fn update_models(models: Vec<crate::model_selector::ModelInfo>) -> Patch {
    serde_json::from_value(json!([
        {"op": "replace", "path": "/options/model_selector/models", "value": models},
    ]))
    .unwrap_or_default()
}

pub fn models_loaded() -> Patch {
    serde_json::from_value(json!([
        {"op": "replace", "path": "/options/loading_models", "value": false},
    ]))
    .unwrap_or_default()
}

pub fn update_agents(agents: Vec<crate::model_selector::AgentInfo>) -> Patch {
    serde_json::from_value(json!([
        {"op": "replace", "path": "/options/model_selector/agents", "value": agents},
    ]))
    .unwrap_or_default()
}

pub fn agents_loaded() -> Patch {
    serde_json::from_value(json!([
        {"op": "replace", "path": "/options/loading_agents", "value": false},
    ]))
    .unwrap_or_default()
}

pub fn update_slash_commands(
    slash_commands: Vec<crate::executors::SlashCommandDescription>,
) -> Patch {
    serde_json::from_value(json!([
        {"op": "replace", "path": "/options/slash_commands", "value": slash_commands},
    ]))
    .unwrap_or_default()
}

pub fn slash_commands_loaded() -> Patch {
    serde_json::from_value(json!([
        {"op": "replace", "path": "/options/loading_slash_commands", "value": false},
    ]))
    .unwrap_or_default()
}

pub fn update_providers(providers: Vec<crate::model_selector::ModelProvider>) -> Patch {
    serde_json::from_value(json!([
        {"op": "replace", "path": "/options/model_selector/providers", "value": providers},
    ]))
    .unwrap_or_default()
}

pub fn update_default_model(default_model: Option<String>) -> Patch {
    serde_json::from_value(json!([
        {"op": "replace", "path": "/options/model_sele
```

### Core Architecture Module: `crates/executors/src/logs/utils/shell_command_parsing.rs`
```
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Simple categories for common bash commands
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS, Default)]
#[serde(rename_all = "snake_case")]
pub enum CommandCategory {
    /// File reading commands (cat, head, tail, sed without -i)
    Read,
    /// File/directory search commands (grep, rg, find, awk)
    Search,
    /// File editing commands (any command with >, sed -i, tee, chmod, rm, mv, cp)
    Edit,
    /// Network fetch commands (curl, wget)
    Fetch,
    /// Default category for everything else
    #[default]
    Other,
}

impl CommandCategory {
    /// Categorize a bash command string.
    pub fn from_command(command: &str) -> Self {
        let command = command.trim();

        if command.is_empty() {
            return Self::Other;
        }

        let command = unwrap_shell_command(command);

        // Any output redirect to a real file is an edit operation, e.g. echo > file
        if has_file_redirect(command) {
            return Self::Edit;
        }

        let cmd = command
            .split_whitespace()
            .next()
            .and_then(|s| s.rsplit('/').next())
            .unwrap_or("")
            .to_lowercase();

        match cmd.as_str() {
            // File reading commands (ls lists directory contents)
            "cat" | "head" | "tail" | "zcat" | "gzcat" | "ls" => Self::Read,

            // Search commands
            "grep" | "rg" | "find" | "awk" => Self::Search,

            // sed: -i means in-place edit, otherwise read-only
            "sed" if command.contains("-i") => Self::Edit,
            "sed" => Self::Read,

            // Direct file edits
            "tee" | "truncate" | "chmod" | "chown" | "rm" | "mv" | "cp" | "touch" | "ln" => {
                Self::Edit
            }

            // Web Fetch commands
            "curl" | "wget" => Self::Fetch,

            _ => Self::Other,
        }
    }
}

/// Check whether a command contains a redirect to an actual file (not `/dev/null` or fd dup).
///
/// Uses shlex to tokenize (handles quoting), then looks for tokens containing `>`
/// and checks whether the redirect target is a real file.
fn has_file_redirect(command: &str) -> bool {
    if !command.contains('>') {
        return false;
    }

    let tokens: Vec<String> = shlex::Shlex::new(command).collect();
    let mut i = 0;
    while i < tokens.len() {
        let t = &tokens[i];
        if let Some(target) = redirect_target(t) {
            if is_file_target(target) {
                return true;
            }
        } else if (t == ">" || t == ">>" || t.ends_with('>') || t.ends_with(">>"))
            && let Some(next) = tokens.get(i + 1)
        {
            if is_file_target(next) {
                return true;
            }
            i += 1;
        }
        i += 1;
    }
    false
}

/// Given a token containing `>`, extract the redirect target if it's inline.
/// E.g. ">file" => Some("file"), "2>/dev/null" => Some("/dev/null"), ">" => None
fn redirect_target(token: &str) -> Option<&str> {
    let pos = token.find('>')?;
    let after = &token[pos + 1..];
    let after = after.strip_prefix('>').unwrap_or(after);
    if after.is_empty() { None } else { Some(after) }
}

/// Returns true if the redirect target is a real file (not /dev/null or &fd).
fn is_file_target(target: &str) -> bool {
    !target.starts_with('&') && target != "/dev/null"
}

/// Unwrap shell wrappers to get the actual command.
///
/// Handles: `zsh -c "command"` / `bash -lc 'command'` / etc.
pub fn unwrap_shell_command(command: &str) -> &str {
    let mut remaining = command;

    loop {
        let trimmed = remaining.trim_start();

        // Find first word
        let first_word_end = trimmed
            .find(|c: char| c.is_whitespace())
            .unwrap_or(trimmed.len());
        let first_word = &trimmed[..first_word_end];

        let cmd_name = first_word.rsplit('/').next().unwrap_or(first_word);

        // Check for shell -c "command"
        if matches!(cmd_name, "sh" | "bash" | "zsh") {
            let after_cmd = &trimmed[first_word_end..];
            if let Some(cmd_str) = extract_command_after_c_flag(after_cmd) {
                remaining = cmd_str;
                continue;
            }
        }

        break;
    }

    remaining
}

/// Extract the command string after a -c flag in shell arguments.
/// Handles: -c 'cmd', -c "cmd", -lc cmd, -cl 'cmd', etc.
fn extract_command_after_c_flag(args: &str) -> Option<&str> {
    let mut idx = 0;
    while idx < args.len() {
        let remaining = &args[idx..];
        let dash_pos = remaining.find('-')?;
        let after_dash = &remaining[dash_pos + 1..];

        let flag_end = after_dash
            .find(|c: char| !c.is_alphabetic())
            .unwrap_or(after_dash.len());
        let flags = &after_dash[..flag_end];

        if flags.contains('c') {
            let cmd_start = dash_pos + 1 + flag_end;
            return Some(strip_quotes(remaining[cmd_start..].trim_start()));
        }

        idx += dash_pos + 1 + flag_end;
    }

    None
}

/// Strip surrounding quotes from a command string.
fn strip_quotes(s: &str) -> &str {
    let s = s.trim();
    if s.len() >= 2 {
        let first = s.as_bytes()[0];
        let last = s.as_bytes()[s.len() - 1];
        if (first == b'"' || first == b'\'') && first == last {
            return &s[1..s.len() - 1];
        }
    }
    s
}

```

### Core Architecture Module: `crates/relay-tunnel-core/src/client.rs`
```
use std::{convert::Infallible, net::SocketAddr};

use anyhow::Context as _;
use axum::body::Body;
use futures_util::StreamExt;
use http::StatusCode;
use hyper::{
    Request, Response, body::Incoming, client::conn::http1 as client_http1,
    server::conn::http1 as server_http1, service::service_fn, upgrade,
};
use hyper_util::rt::TokioIo;
use tokio::net::TcpStream;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_util::sync::CancellationToken;
use tokio_yamux::Session;
use ws_bridge::tungstenite_ws_stream_io;

use crate::{tls::ws_connector, yamux_config};

pub struct RelayClientConfig {
    pub ws_url: String,
    pub bearer_token: String,
    pub local_addr: SocketAddr,
    pub shutdown: CancellationToken,
}

/// Connects the relay client control channel and starts handling inbound streams.
///
/// Returns when shutdown is requested or when the control channel disconnects/errors.
pub async fn start_relay_client(config: RelayClientConfig) -> anyhow::Result<()> {
    let mut request = config
        .ws_url
        .clone()
        .into_client_request()
        .context("Failed to build WS request")?;

    request.headers_mut().insert(
        "Authorization",
        format!("Bearer {}", config.bearer_token)
            .parse()
            .context("Invalid auth header")?,
    );
    let (ws_stream, _response) =
        tokio_tungstenite::connect_async_tls_with_config(request, None, false, ws_connector())
            .await
            .context("Failed to connect relay control channel")?;

    let ws_io = tungstenite_ws_stream_io(ws_stream);
    let mut session = Session::new_client(ws_io, yamux_config());
    let mut control = session.control();

    tracing::debug!("Relay control channel connected");

    let shutdown = config.shutdown;
    let local_addr = config.local_addr;

    loop {
        tokio::select! {
            _ = shutdown.cancelled() => {
                control.close().await;
                return Ok(());
            }
            inbound = session.next() => {
                let stream = inbound
                    .ok_or_else(|| anyhow::anyhow!("Relay control channel closed"))?
                    .map_err(|e| anyhow::anyhow!("Relay yamux session error: {e}"))?;

                tokio::spawn(async move {
                    if let Err(error) = handle_inbound_stream(stream, local_addr).await {
                        tracing::warn!(?error, "Relay stream handling failed");
                    }
                });
            }
        }
    }
}

async fn handle_inbound_stream(
    stream: tokio_yamux::StreamHandle,
    local_addr: SocketAddr,
) -> anyhow::Result<()> {
    let io = TokioIo::new(stream);

    server_http1::Builder::new()
        .serve_connection(
            io,
            service_fn(move |request: Request<Incoming>| proxy_to_local(request, local_addr)),
        )
        .with_upgrades()
        .await
        .context("Yamux stream server connection failed")
}

async fn proxy_to_local(
    mut request: Request<Incoming>,
    local_addr: SocketAddr,
) -> Result<Response<Body>, Infallible> {
    request
        .headers_mut()
        .insert("x-vk-relayed", http::HeaderValue::from_static("1"));

    // TODO: fix dev servers
    let local_stream = match TcpStream::connect(local_addr).await {
        Ok(stream) => stream,
        Err(error) => {
            tracing::warn!(
                ?error,
                "Failed to connect to local server for relay request"
            );
            return Ok(simple_response(
                StatusCode::BAD_GATEWAY,
                "Failed to connect to local server",
            ));
        }
    };

    let (mut sender, connection) = match client_http1::Builder::new()
        .handshake(TokioIo::new(local_stream))
        .await
    {
        Ok(value) => value,
        Err(error) => {
            tracing::warn!(?error, "Failed to create local proxy HTTP connection");
            return Ok(simple_response(
                StatusCode::BAD_GATEWAY,
                "Failed to initialize local proxy connection",
            ));
        }
    };

    tokio::spawn(async move {
        if let Err(error) = connection.with_upgrades().await {
            tracing::debug!(?error, "Local proxy connection closed");
        }
    });

    let request_upgrade = upgrade::on(&mut request);

    let mut response = match sender.send_request(request).await {
        Ok(response) => response,
        Err(error) => {
            tracing::warn!(?error, "Local proxy request failed");
            return Ok(simple_response(
                StatusCode::BAD_GATEWAY,
                "Local proxy request failed",
            ));
        }
    };

    if response.status() == StatusCode::SWITCHING_PROTOCOLS {
        let response_upgrade = upgrade::on(&mut response);
        tokio::spawn(async move {
            let mut from_remote = TokioIo::new(request_upgrade.await?);
            let mut to_local = TokioIo::new(response_upgrade.await?);
            tokio::io::copy_bidirectional(&mut from_remote, &mut to_local).await?;
            Ok::<_, anyhow::Error>(())
        });
    }

    let (parts, body) = response.into_parts();
    Ok(Response::from_parts(parts, Body::new(body)))
}

fn simple_response(status: StatusCode, body: &'static str) -> Response<Body> {
    Response::builder()
        .status(status)
        .body(Body::from(body))
        .unwrap_or_else(|_| Response::new(Body::from(body)))
}

```

### Core Architecture Module: `crates/relay-tunnel-core/src/lib.rs`
```
use std::time::Duration;

use tokio_yamux::Config as YamuxConfig;

pub mod client;
pub mod server;
pub mod tls;

/// Shared yamux configuration for both client and server sides of the relay tunnel.
///
/// Increases the stream window size and write timeout over the defaults (256 KB / 10s)
/// to handle large HTTP responses over slow connections without triggering write timeouts.
pub(crate) fn yamux_config() -> YamuxConfig {
    YamuxConfig {
        max_stream_window_size: 1024 * 1024, // 1 MB (default: 256 KB)
        connection_write_timeout: Duration::from_secs(30), // (default: 10s)
        ..Default::default()
    }
}

/// Convert an HTTP(S) URL to its WebSocket equivalent (ws:// or wss://).
pub fn http_to_ws_url(http_url: &str) -> anyhow::Result<String> {
    if let Some(rest) = http_url.strip_prefix("https://") {
        Ok(format!("wss://{rest}"))
    } else if let Some(rest) = http_url.strip_prefix("http://") {
        Ok(format!("ws://{rest}"))
    } else {
        anyhow::bail!("unsupported URL scheme: {http_url}")
    }
}

```

### Core Architecture Module: `crates/relay-tunnel-core/src/server.rs`
```
use std::{future::Future, sync::Arc};

use axum::{
    body::Body,
    extract::{Request, ws::WebSocket},
    http::{StatusCode, Uri},
    response::{IntoResponse, Response},
};
use futures_util::StreamExt;
use hyper::{client::conn::http1 as client_http1, upgrade};
use hyper_util::rt::TokioIo;
use tokio::sync::Mutex;
use tokio_yamux::{Control, Session};
use ws_bridge::axum_ws_stream_io;

use crate::yamux_config;

pub type SharedControl = Arc<Mutex<Control>>;

/// Runs the server-side control channel over an upgraded WebSocket.
///
/// The provided callback is invoked once, after yamux is initialized, with a
/// shared control handle that can be used to proxy requests over new streams.
pub async fn run_control_channel<F, Fut>(socket: WebSocket, on_connected: F) -> anyhow::Result<()>
where
    F: FnOnce(SharedControl) -> Fut,
    Fut: Future<Output = ()>,
{
    let ws_io = axum_ws_stream_io(socket);
    let mut session = Session::new_server(ws_io, yamux_config());
    let control = Arc::new(Mutex::new(session.control()));

    on_connected(control).await;

    while let Some(stream_result) = session.next().await {
        match stream_result {
            Ok(_stream) => {
                // The client side does not currently open server-initiated streams.
            }
            Err(error) => {
                return Err(anyhow::anyhow!("relay session error: {error}"));
            }
        }
    }

    Ok(())
}

/// Proxies one HTTP request over a new yamux stream using the shared control.
pub async fn proxy_request_over_control(
    control: &Mutex<Control>,
    request: Request,
    strip_prefix: &str,
) -> Response {
    let stream = {
        let mut control = control.lock().await;
        match control.open_stream().await {
            Ok(stream) => stream,
            Err(error) => {
                tracing::warn!(?error, "failed to open relay stream");
                return (StatusCode::BAD_GATEWAY, "Relay connection lost").into_response();
            }
        }
    };

    let (mut parts, body) = request.into_parts();
    let path = normalized_relay_path(&parts.uri, strip_prefix);
    parts.uri = match Uri::builder().path_and_query(path).build() {
        Ok(uri) => uri,
        Err(error) => {
            tracing::warn!(?error, "failed to build relay proxy URI");
            return (StatusCode::BAD_REQUEST, "Invalid request URI").into_response();
        }
    };

    let mut outbound = axum::http::Request::from_parts(parts, body);
    let request_upgrade = upgrade::on(&mut outbound);

    let (mut sender, connection) = match client_http1::Builder::new()
        .handshake(TokioIo::new(stream))
        .await
    {
        Ok(value) => value,
        Err(error) => {
            tracing::warn!(?error, "failed to initialize relay stream proxy connection");
            return (StatusCode::BAD_GATEWAY, "Relay connection failed").into_response();
        }
    };

    tokio::spawn(async move {
        if let Err(error) = connection.with_upgrades().await {
            tracing::debug!(?error, "relay stream connection closed");
        }
    });

    let mut response = match sender.send_request(outbound).await {
        Ok(response) => response,
        Err(error) => {
            tracing::warn!(?error, "relay proxy request failed");
            return (StatusCode::BAD_GATEWAY, "Relay request failed").into_response();
        }
    };

    if response.status() == StatusCode::SWITCHING_PROTOCOLS {
        let response_upgrade = upgrade::on(&mut response);
        tokio::spawn(async move {
            let Ok(from_client) = request_upgrade.await else {
                return;
            };
            let Ok(to_local) = response_upgrade.await else {
                return;
            };
            let mut from_client = TokioIo::new(from_client);
            let mut to_local = TokioIo::new(to_local);
            let _ = tokio::io::copy_bidirectional(&mut from_client, &mut to_local).await;
        });
    }

    let (parts, body) = response.into_parts();
    Response::from_parts(parts, Body::new(body))
}

fn normalized_relay_path(uri: &axum::http::Uri, strip_prefix: &str) -> String {
    let raw_path = uri.path();
    let path = raw_path.strip_prefix(strip_prefix).unwrap_or(raw_path);
    let path = if path.is_empty() { "/" } else { path };
    let query = uri.query().map(|q| format!("?{q}")).unwrap_or_default();
    format!("{path}{query}")
}

```

### Core Architecture Module: `crates/relay-tunnel-core/src/tls.rs`
```
use tokio_tungstenite::Connector;

/// Build TLS connector for the relay WebSocket client.
///
/// In debug builds, returns a connector that accepts all certificates (equivalent
/// to `danger_accept_invalid_certs`) so that Caddy's internal CA and other dev
/// certs work. In release builds, returns `None` to use the default webpki-roots
/// validation.
pub fn ws_connector() -> Option<Connector> {
    #[cfg(debug_assertions)]
    {
        use std::sync::Arc;

        let config = rustls::ClientConfig::builder()
            .dangerous()
            .with_custom_certificate_verifier(Arc::new(AcceptAllCerts))
            .with_no_client_auth();
        Some(Connector::Rustls(Arc::new(config)))
    }

    #[cfg(not(debug_assertions))]
    {
        None
    }
}

#[cfg(debug_assertions)]
#[derive(Debug)]
struct AcceptAllCerts;

#[cfg(debug_assertions)]
impl rustls::client::danger::ServerCertVerifier for AcceptAllCerts {
    fn verify_server_cert(
        &self,
        _end_entity: &rustls::pki_types::CertificateDer<'_>,
        _intermediates: &[rustls::pki_types::CertificateDer<'_>],
        _server_name: &rustls::pki_types::ServerName<'_>,
        _ocsp_response: &[u8],
        _now: rustls::pki_types::UnixTime,
    ) -> Result<rustls::client::danger::ServerCertVerified, rustls::Error> {
        Ok(rustls::client::danger::ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &rustls::pki_types::CertificateDer<'_>,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &rustls::pki_types::CertificateDer<'_>,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<rustls::SignatureScheme> {
        rustls::crypto::aws_lc_rs::default_provider()
            .signature_verification_algorithms
            .supported_schemes()
    }
}

```

### Core Architecture Module: `crates/relay-tunnel/src/server_bin/state.rs`
```
use std::sync::Arc;

use sqlx::PgPool;

use super::{auth::JwtService, config::RelayServerConfig, relay_registry::RelayRegistry};

#[derive(Clone)]
pub struct RelayAppState {
    pub pool: PgPool,
    pub config: RelayServerConfig,
    pub jwt: Arc<JwtService>,
    pub relay_registry: RelayRegistry,
}

impl RelayAppState {
    pub fn new(pool: PgPool, config: RelayServerConfig, jwt: Arc<JwtService>) -> Self {
        Self {
            pool,
            config,
            jwt,
            relay_registry: RelayRegistry::default(),
        }
    }
}

```

### Core Architecture Module: `crates/remote/src/github_app/webhook.rs`
```
use hmac::{Hmac, Mac};
use sha2::Sha256;
use subtle::ConstantTimeEq;

type HmacSha256 = Hmac<Sha256>;

/// Verify a GitHub webhook signature.
///
/// GitHub sends the HMAC-SHA256 signature in the `X-Hub-Signature-256` header
/// in the format `sha256=<hex-signature>`.
///
/// Returns true if the signature is valid.
pub fn verify_webhook_signature(secret: &[u8], signature_header: &str, payload: &[u8]) -> bool {
    // Extract the hex signature from the header
    let Some(hex_signature) = signature_header.strip_prefix("sha256=") else {
        return false;
    };

    // Decode the hex signature
    let Ok(expected_signature) = hex::decode(hex_signature) else {
        return false;
    };

    // Compute HMAC-SHA256
    let Ok(mut mac) = HmacSha256::new_from_slice(secret) else {
        return false;
    };
    mac.update(payload);
    let computed_signature = mac.finalize().into_bytes();

    // Constant-time comparison to prevent timing attacks
    computed_signature[..].ct_eq(&expected_signature).into()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_signature() {
        let secret = b"test-secret";
        let payload = b"test payload";

        // Compute expected signature
        let mut mac = HmacSha256::new_from_slice(secret).unwrap();
        mac.update(payload);
        let signature = mac.finalize().into_bytes();
        let signature_header = format!("sha256={}", hex::encode(signature));

        assert!(verify_webhook_signature(secret, &signature_header, payload));
    }

    #[test]
    fn test_invalid_signature() {
        let secret = b"test-secret";
        let payload = b"test payload";
        let wrong_signature =
            "sha256=0000000000000000000000000000000000000000000000000000000000000000";

        assert!(!verify_webhook_signature(secret, wrong_signature, payload));
    }

    #[test]
    fn test_missing_prefix() {
        let secret = b"test-secret";
        let payload = b"test payload";
        let no_prefix = "0000000000000000000000000000000000000000000000000000000000000000";

        assert!(!verify_webhook_signature(secret, no_prefix, payload));
    }

    #[test]
    fn test_invalid_hex() {
        let secret = b"test-secret";
        let payload = b"test payload";
        let invalid_hex = "sha256=not-valid-hex";

        assert!(!verify_webhook_signature(secret, invalid_hex, payload));
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1938** (2026-02-24): **Database Deadlocks and Codex Session Abnormalities**
  *Symptoms*: Some Codex sessions fail to continue after ending and encounter errors. This issue is quite unpredictable and occurs intermittently. Could it be related to running it in WSL2? Disk performance in WSL2 is poor, and I often see database deadlock issues and slow query warnings. Can support be added for configuring external databases such as MySQL?  Codex fail:  ``` I/O error: failed to decode resumeConversation response: unknown variant `context_compacted`, expected one of `error`, `warning`, `task_started`, `task_complete`, `token_count`, `agent_message`, `user_message`, `agent_message_delta`, `agent_reasoning`, `agent_reasoning_delta`, `agent_reasoning_raw_content`, `agent_reasoning_raw_content_delta`, `agent_reasoning_section_break`, `session_configured`, `mcp_startup_update`, `mcp_startup_complete`, `mcp_tool_call_begin`, `mcp_tool_call_end`, `web_search_begin`, `web_search_end`, `exec_command_begin`, `exec_command_output_delta`, `exec_command_end`, `view_image_tool_call`, `exec_approval_request`, `apply_patch_approval_request`, `deprecation_notice`, `background_event`, `undo_started`, `undo_completed`, `stream_error`, `patch_apply_begin`, `patch_apply_end`, `turn_diff`, `get_history_entry_response`, `mcp_list_tools_response`, `list_custom_prompts_response`, `plan_update`, `turn_aborted`, `shutdown_complete`, `entered_review_mode`, `exited_review_mode`, `raw_response_item`, `item_started`, `item_completed`, `agent_message_content_delta`, `reasoning_content_delta`, `reasoning
  **Post-Mortem & Fix Analysis**:
  > Same issue.
  > The codex session compaction issues have been resolved.  The database deadlock is being solved.

- **Issue #1731** (2026-01-09): **Vibe Kanban agents refuses to start (Invalid WS)**
  *Symptoms*: Starting vibe-kanban v0.0.143... 2026-01-03T13:51:02.364051Z  INFO executors::profile: Loaded user profile overrides from profiles.json 2026-01-03T13:51:44.765480Z  INFO services::services::oauth_credentials: OAuth credentials backend: file 2026-01-03T13:51:44.769011Z  INFO local_deployment: Remote client initialized with URL: https://api.vibekanban.com 2026-01-03T13:51:44.765655Z  INFO local_deployment: Starting orphaned image cleanup... 2026-01-03T13:51:44.857324Z  INFO services::services::workspace_manager: Found orphaned workspace: C:\Users\LOUSYB~1\AppData\Local\Temp\vibe-kanban\worktrees\ac7a-make-a-chess-gam 2026-01-03T13:51:44.857650Z  INFO services::services::workspace_manager: Cleaning up orphaned workspace at C:\Users\LOUSYB~1\AppData\Local\Temp\vibe-kanban\worktrees\ac7a-make-a-chess-gam 2026-01-03T13:51:47.534612Z  INFO services::services::workspace_manager: Successfully removed orphaned workspace: C:\Users\LOUSYB~1\AppData\Local\Temp\vibe-kanban\worktrees\ac7a-make-a-chess-gam 2026-01-03T13:51:47.537447Z  INFO services::services::workspace_manager: Found orphaned workspace: C:\Users\LOUSYB~1\AppData\Local\Temp\vibe-kanban\worktrees\e61f-install-and-inte 2026-01-03T13:51:47.537711Z  INFO services::services::workspace_manager: Cleaning up orphaned workspace at C:\Users\LOUSYB~1\AppData\Local\Temp\vibe-kanban\worktrees\e61f-install-and-inte 2026-01-03T13:51:48.371165Z  INFO services::services::workspace_manager: Successfully removed orphaned workspace: C:\Users\LOU
  **Post-Mortem & Fix Analysis**:
  > I can confirm that I am encountering this issue as well. Looking forward to a fix.
  > @toBeInTheDocument On windows right?i thought it was just my pc
  > Please confirm, are you using Opencode or another coding agent?

- **Issue #1727** (2026-01-08): **Images not accessible when agent_working_dir is set to subdirectory**
  *Symptoms*: # Issue: Images not accessible when agent_working_dir is set to subdirectory  ## Bug Description  When `agent_working_dir` is configured to a subdirectory (e.g., a repo folder in a multi-repo workspace), images uploaded via the task input are not accessible to the AI coding agent because the relative path `.vibe-images/xxx.png` resolves incorrectly.  ## Steps to Reproduce  1. Create a project with a repository 2. Set `Agent Working Dir` to a subdirectory (e.g., `my-repo` or the repo name) 3. Create a task and attach an image (screenshot/paste) 4. Start the task - the AI agent cannot read the image  ## Expected Behavior  The AI agent should be able to access the uploaded image regardless of the `agent_working_dir` setting.  ## Actual Behavior  The AI agent reports the image file cannot be found.  Investigation shows: - Images are stored at: `<workspace_root>/.vibe-images/xxx.png` - Agent working directory is: `<workspace_root>/<agent_working_dir>/` - The relative path `.vibe-images/xxx.png` passed to the agent resolves to `<workspace_root>/<agent_working_dir>/.vibe-images/xxx.png` which doesn't exist  ## Root Cause Analysis  In `crates/local-deployment/src/container.rs`, the `copy_images_by_task_to_worktree` function (line ~726-730) always copies images to `workspace_dir/.vibe-images/`, but when `agent_working_dir` is set, the AI agent's current working directory is `workspace_dir/<agent_working_dir>/`, making the relative path incorrect.  ## Suggested Fix  Option A: Copy imag

- **Issue #1718** (2026-01-08): **Running coding task never finishes (cannot stop or merge, database is locked)**
  *Symptoms*: While using Vibe Kanban, a running coding task does not terminate properly.  Once the task is started, it stays in a running state indefinitely and never completes. Because of this, the task cannot be merged and blocks further progress.  Clicking the Stop button has no effect — there is no UI response and the task continues to run.  In the console logs, the following error keeps appearing repeatedly:  ``` 2026-01-01T08:04:41.479277Z ERROR server::middleware::model_loaders: Failed to fetch Workspace 146f1f0f-652b-4842-a294-21e9e7177a67: error returned from database: (code: 5) database is locked ... 2026-01-01T08:05:16.851088Z ERROR services::services::events: Failed to fetch execution_process: Database(SqliteError { code: 5, message: "database is locked" }) ```  It seems the task process is stuck due to a database lock, and there is no way to stop or recover it from the UI.  Please let me know if you need additional logs or steps to reproduce.
  **Post-Mortem & Fix Analysis**:
  > How can I completely reset? It seems to have been broken since something went wrong once.
  > In Mac delete ~/Library/Application Support/ai.bloop.vibe-kanban
  > Thank you for your reply. But I’m using Linux (WSL).

- **Issue #1710** (2026-01-05): **Problem with rebase : GitServiceError: invalid data in index - calculated checksum does not match expected; class=Index (10)**
  *Symptoms*: When I try to rebase, I always have this error :   <img width="527" height="273" alt="Image" src="https://github.com/user-attachments/assets/a7e6c108-a606-4da6-8a3d-17af6a9b11c1" />
  **Post-Mortem & Fix Analysis**:
  > can you please share more about this, also can you share your `git status` of the original branch, where you want to make the changes...
  > Thanks for your answer. I do not really know what to share more. `git status` was clean on the original branch : nothing to commit
  > Delete the .husky directory under the project to temporarily solve this problem.  @damienlethiec @ggordonhall @LSRCT @rushichavda @skorokithakis   This is a bug and should be handled to be compatible with git husky.

- **Issue #1706** (2026-01-06): **feat: Add --body-file support for gh pr create**
  *Symptoms*: ## Summary  When using `--body` parameter with `gh pr create`, long or multiline content causes issues: - Shell escaping problems (special characters, quotes, newlines) - Command-line length limits (Windows 8191 chars, some shells even shorter)  ## Proposed Solution  Use `--body-file` parameter to write body content to a temp file: - Automatically use `--body-file` when body exceeds 1000 characters - Automatically use `--body-file` when body contains newlines - Temp file is automatically cleaned up after command execution  ## Implementation Plan  - Add `PreparedPrCreateArgs` struct for testable argument building - Extract `should_use_body_file()` helper with `BODY_FILE_THRESHOLD` constant - Refactor `create_pr` to use `prepare_pr_create_args()` - Add unit tests covering parsers, body-file logic, and argument building  This addresses the TODO comment in `cli.rs` line 132-133.

- **Issue #1668** (2026-01-08): **opencode integration in windows fails**
  *Symptoms*: running a task with opencode in Windows inevitably fails with the default settings with the logs saying-  {"SessionStart":"ses_4987e087cffepeMEbaGPEP8Fa6"}  {"User":"create detailed specs sheet of what needs to be built from the docs"}  {"Other":{"sessionId":"ses_4987e087cffepeMEbaGPEP8Fa6","update":{"sessionUpdate":"available_commands_update","availableCommands":[{"name":"init","description":"create/update AGENTS.md","input":null},{"name":"review","description":"review changes [commit|branch|pr], defaults to uncommitted","input":null},{"name":"compact","description":"compact the session","input":null}]}}}  the processes themselves can't be killed resulting in having to kill the entire vibe-kanban process. How to tacle this issue?
  **Post-Mortem & Fix Analysis**:
  > Hi @arnabclir, do you see any `ERROR` logs in the terminal window from which you ran Vibe Kanban?
  > I am able to reproduce the issue on windows x64. Opencode's ACP implementation, which we currently rely on,  is currently broken on windows https://github.com/anomalyco/opencode/issues/3730
  > Solved in the next release

- **Issue #1665** (2026-01-13): **If gh is old, PR creation will fail.**
  *Symptoms*: If your gh (GitHub CLI) version is old—for example, the one you get from Ubuntu 22.04’s apt—creating a pull request can fail.  With this version, if you run the command outside a Git repository directory, it tries to use Git internally during PR creation and ends up failing.  ``` 2025-12-27T07:58:15.004531Z ERROR server::routes::task_attempts::pr: Failed to create GitHub PR for attempt 0ba13a08-2ecf-4b5b-8271-5a33da7f642d: Pull request error:          fatal: not a git repository (or any of the parent directories): .git /usr/bin/git: exit status 128 ```  Log captured from hooking gh: ``` cwd=/home/Myname cmd=gh pr create --repo "Myname/MyRepo" --head vk/26b1-test --base develop --title "Title" --body "BODY" ```  ``` $ cat /etc/os-release | head -n1 PRETTY_NAME="Ubuntu 22.04.3 LTS"  $ gh --version gh version 2.4.0+dfsg1 (2022-03-23 Ubuntu 2.4.0+dfsg1-2) ```  
  **Post-Mortem & Fix Analysis**:
  > https://github.com/BloopAI/vibe-kanban/pull/1548/files
  > happens to follwoing error while submit pr:  GitHubServiceError: Pull request error: fatal: 不是 git 仓库（或者任何父目录）：.git /usr/bin/git: exit status 128  

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

### Incident Patch 1: `d5cbb538` (2026-09-19)
**Commit Message**: fix: Tanstack router api fix (#3464)

* Cargo.lock changes

* fix: @tanstack/react-router minor version bump changed their api for router.getMatchedRoutes

**File**: `Cargo.lock` (modified, +30/-30)
```diff
@@ -236,7 +236,7 @@ checksum = "7f202df86484c868dbad7eaa557ef785d5c66295e41b460ef922eca0723b842c"
 
 [[package]]
 name = "api-types"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "chrono",
  "schemars 1.2.1",
@@ -1223,7 +1223,7 @@ checksum = "c8d4a3bb8b1e0c1050499d1815f5ab16d04f0959b233085fb31653fbfc9d98f9"
 
 [[package]]
 name = "client-info"
-version = "0.1.44"
+version = "0.1.45"
 
 [[package]]
 name = "clipboard-win"
@@ -2016,7 +2016,7 @@ checksum = "d7a1e2f27636f116493b8b860f5546edb47c8d8f8ea73e1d2a20be88e28d1fea"
 
 [[package]]
 name = "db"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "anyhow",
  "chrono",
@@ -2069,7 +2069,7 @@ dependencies = [
 
 [[package]]
 name = "deployment"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "anyhow",
  "async-trait",
@@ -2234,7 +2234,7 @@ dependencies = [
 
 [[package]]
 name = "desktop-bridge"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "base64 0.22.1",
  "dirs 5.0.1",
@@ -2605,7 +2605,7 @@ checksum = "4ef6b89e5b37196644d8796de5268852ff179b44e96276cf4290264843743bb7"
 
 [[package]]
 name = "embedded-ssh"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "anyhow",
  "async-trait",
@@ -2793,7 +2793,7 @@ dependencies = [
 
 [[package]]
 name = "executors"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "agent-client-protocol",
  "async-stream",
@@ -3512,7 +3512,7 @@ dependencies = [
 
 [[package]]
 name = "git"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "chrono",
  "dirs 5.0.1",
@@ -3527,7 +3527,7 @@ dependencies = [
 
 [[package]]
 name = "git-host"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "async-trait",
  "backon",
@@ -4957,7 +4957,7 @@ checksum = "11d3d7f243d5c5a8b9bb5d6dd2b1602c0cb0b9db1621bafc7ed66e35ff9fe092"
 
 [[package]]
 name = "local-deployment"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "anyhow",
  "api-types",
@@ -5177,7 +5177,7 @@ checksum = "8863b587001c1b9a8a4e36008cebc6b3612cb1226fe2de94858e06092687b608"
 
 [[package]]
 name = "mcp"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "anyhow",
  "api-types",
@@ -6695,7 +6695,7 @@ dependencies = [
 
 [[package]]
 name = "preview-proxy"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "axum",
  "http",
@@ -7501,7 +7501,7 @@ checksum = "dc897dd8d9e8bd1ed8cdad82b5966c3e0ecae09fb1907d58efaa013543185d0a"
 
 [[package]]
 name = "relay-client"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "anyhow",
  "base64 0.22.1",
@@ -7524,7 +7524,7 @@ dependencies = [
 
 [[package]]
 name = "relay-control"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "anyhow",
  "base64 0.22.1",
@@ -7538,7 +7538,7 @@ dependencies = [
 
 [[package]]
 name = "relay-hosts"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "axum",
  "base64 0.22.1",
@@ -7571,7 +7571,7 @@ dependencies = [
 
 [[package]]
 name = "relay-protocol"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "anyhow",
  "axum",
@@ -7582,7 +7582,7 @@ dependencies = [
 
 [[package]]
 name = "relay-tunnel-core"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "anyhow",
  "axum",
@@ -7601,7 +7601,7 @@ dependencies = [
 
 [[package]]
 name = "relay-types"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "chrono",
  "serde",
@@ -7612,7 +7612,7 @@ dependencies = [
 
 [[package]]
 name = "relay-webrtc"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "anyhow",
  "base64 0.22.1",
@@ -7638,7 +7638,7 @@ dependencies = [
 
 [[package]]
 name = "relay-ws"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "anyhow",
  "axum",
@@ -7661,7 +7661,7 @@ dependencies = [
 
 [[package]]
 name = "remote-info"
-version = "0.1.44"
+version = "0.1.45"
 
 [[package]]
 name = "reqwest"
@@ -7760,7 +7760,7 @@ checksum = "1e061d1b48cb8d38042de4ae0a7a6401009d6143dc80d2e2d6f31f0bdd6470c7"
 
 [[package]]
 name = "review"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "anyhow",
  "clap",
@@ -8866,7 +8866,7 @@ dependencies = [
 
 [[package]]
 name = "server"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "anyhow",
  "api-types",
@@ -8932,7 +8932,7 @@ dependencies = [
 
 [[package]]
 name = "services"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "anyhow",
  "api-types",
@@ -10968,7 +10968,7 @@ checksum = "009994f150cc0cd50ff54917d5bc8bffe8cad10ca10d81c34da2ec421ae61782"
 
 [[package]]
 name = "trusted-key-auth"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "base64 0.22.1",
  "ed25519-dalek",
@@ -11317,7 +11317,7 @@ checksum = "06abde3611657adf66d383f00b093d7faecc7fa57071cce2578660c9f1010821"
 
 [[package]]
 name = "utils"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "axum",
  "bytes",
@@ -11390,7 +11390,7 @@ checksum = "0b928f33d975fc6ad9f86c8f283853ad26bdd5b10b7f1542aa2fa15e2289105a"
 
 [[package]]
 name = "vibe-kanban-tauri"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "arboard",
  "asyn
```

**File**: `packages/local-web/src/app/navigation/AppNavigation.ts` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ function parseLocalHostIdFromPathname(pathname: string): string | null {
 
 function resolveLocalDestinationFromPath(path: string): AppDestination | null {
   const { pathname } = new URL(path, 'http://localhost');
-  const { foundRoute, routeParams } = router.getMatchedRoutes(pathname);
+  const [, routeParams, foundRoute] = router.getMatchedRoutes(pathname);
 
   if (!foundRoute) {
     return null;
```

---

### Incident Patch 2: `78580443` (2026-09-18)
**Commit Message**: pnpm audit fixes (#3460)

**File**: `package.json` (modified, +5/-5)
```diff
@@ -52,14 +52,14 @@
     "tauri:build": "cd crates/tauri-app && cargo tauri build"
   },
   "devDependencies": {
-    "@types/adm-zip": "^0.5.7",
-    "@types/node": "^20.0.0",
+    "@types/adm-zip": "^0.5.8",
+    "@types/node": "^20.19.43",
     "bippy": "0.5.28",
     "concurrently": "^8.2.2",
-    "esbuild": "^0.27.2",
+    "esbuild": "^0.28.2",
     "jwt-decode": "^4.0.0",
-    "typescript": "^5.7.0",
-    "vite": "^7.3.1"
+    "typescript": "^5.9.3",
+    "vite": "^8.3.0"
   },
   "engines": {
     "node": ">=20",
```

**File**: `packages/local-web/package.json` (modified, +65/-65)
```diff
@@ -16,9 +16,9 @@
   },
   "dependencies": {
     "@codemirror/lang-json": "^6.0.2",
-    "@codemirror/language": "^6.11.2",
-    "@codemirror/lint": "^6.8.5",
-    "@codemirror/view": "^6.38.1",
+    "@codemirror/language": "^6.12.4",
+    "@codemirror/lint": "^6.9.7",
+    "@codemirror/view": "^6.43.12",
     "@dnd-kit/core": "^6.3.1",
     "@dnd-kit/sortable": "^10.0.0",
     "@dnd-kit/utilities": "^3.2.2",
@@ -35,95 +35,95 @@
     "@lexical/table": "^0.36.2",
     "@phosphor-icons/react": "^2.1.10",
     "@pierre/diffs": "1.1.4",
-    "@radix-ui/react-accordion": "^1.2.1",
-    "@radix-ui/react-dialog": "^1.1.15",
-    "@radix-ui/react-dropdown-menu": "^2.1.15",
-    "@radix-ui/react-label": "^2.1.7",
-    "@radix-ui/react-popover": "^1.1.15",
-    "@radix-ui/react-select": "^2.2.5",
-    "@radix-ui/react-separator": "^1.1.8",
-    "@radix-ui/react-slot": "^1.2.3",
-    "@radix-ui/react-switch": "^1.0.3",
-    "@radix-ui/react-toggle-group": "^1.1.11",
-    "@radix-ui/react-tooltip": "^1.2.7",
+    "@radix-ui/react-accordion": "^1.2.20",
+    "@radix-ui/react-dialog": "^1.1.23",
+    "@radix-ui/react-dropdown-menu": "^2.1.24",
+    "@radix-ui/react-label": "^2.1.15",
+    "@radix-ui/react-popover": "^1.1.23",
+    "@radix-ui/react-select": "^2.3.7",
+    "@radix-ui/react-separator": "^1.1.15",
+    "@radix-ui/react-slot": "^1.3.3",
+    "@radix-ui/react-switch": "^1.3.7",
+    "@radix-ui/react-toggle-group": "^1.1.19",
+    "@radix-ui/react-tooltip": "^1.2.16",
     "@rjsf/shadcn": "6.1.1",
-    "@sentry/react": "^9.34.0",
-    "@sentry/vite-plugin": "^3.5.0",
-    "@tanstack/electric-db-collection": "^0.2.6",
-    "@tanstack/react-db": "^0.1.50",
-    "@tanstack/react-form": "^1.23.8",
-    "@tanstack/react-query": "^5.85.5",
-    "@tanstack/react-router": "^1.161.1",
-    "@tanstack/zod-adapter": "^1.161.1",
-    "@tauri-apps/api": "^2.10.1",
-    "@uiw/react-codemirror": "^4.25.1",
-    "@vibe/web-core": "workspace:*",
+    "@sentry/react": "^9.47.1",
+    "@sentry/vite-plugin": "^3.6.1",
+    "@tanstack/electric-db-collection": "^0.2.43",
+    "@tanstack/react-db": "^0.1.96",
+    "@tanstack/react-form": "^1.33.5",
+    "@tanstack/react-query": "^5.103.1",
+    "@tanstack/react-router": "^1.170.38",
+    "@tanstack/zod-adapter": "^1.167.0",
+    "@tauri-apps/api": "^2.11.1",
+    "@uiw/react-codemirror": "^4.25.11",
     "@vibe/ui": "workspace:*",
-    "@virtuoso.dev/message-list": "^1.13.3",
+    "@vibe/web-core": "workspace:*",
+    "@virtuoso.dev/message-list": "^1.18.0",
     "@xterm/addon-fit": "^0.10.0",
     "@xterm/addon-web-links": "^0.11.0",
     "@xterm/xterm": "^5.5.0",
-    "class-variance-authority": "^0.7.0",
-    "click-to-react-component": "^1.1.2",
-    "clsx": "^2.0.0",
+    "class-variance-authority": "^0.7.1",
+    "click-to-react-component": "^1.1.3",
+    "clsx": "^2.1.1",
     "cmdk": "^1.1.1",
-    "developer-icons": "^6.0.4",
+    "developer-icons": "^6.0.5",
     "fancy-ansi": "^0.1.3",
-    "framer-motion": "^12.23.24",
-    "i18next": "^25.5.2",
-    "i18next-browser-languagedetector": "^8.2.0",
-    "immer": "^11.1.3",
+    "framer-motion": "^12.43.0",
+    "i18next": "^25.10.10",
+    "i18next-browser-languagedetector": "^8.2.1",
+    "immer": "^11.1.18",
     "jwt-decode": "^4.0.0",
     "lexical": "^0.36.2",
-    "lodash": "^4.17.21",
+    "lodash": "^4.18.1",
     "lucide-react": "^0.539.0",
-    "posthog-js": "^1.276.0",
-    "react": "^18.2.0",
+    "posthog-js": "^1.434.0",
+    "react": "^18.3.1",
     "react-compiler-runtime": "^1.0.0",
-    "react-dom": "^18.2.0",
-    "react-dropzone": "^14.3.8",
-    "react-hotkeys-hook": "^5.1.0",
-    "react-i18next": "^15.7.3",
-    "react-resizable-panels": "^4.0.13",
+    "react-dom": "^18.3.1",
+    "react-dropzone": "^14.4.1",
+    "react-hotkeys-hook": "^5.3.3",
+    "react-i18next": "^15.7.4",
+    "react-resizable-panels": "^4.12.4",
     "react-use-websocket": "^4.13.0",
-    "react-virtuoso": "^4.14.0",
-    "rfc6902": "^5.1.2",
-    "simple-icons": "^15.16.0",
-    "tailwind-merge": "^2.2.0",
+    "react-virtuoso": "^4.18.13",
+    "rfc6902": "^5.3.0",
+    "simple-icons": "^15.22.0",
+    "tailwind-merge": "^2.6.1",
     "tailwind-scrollbar": "^3.1.0",
     "tailwindcss-animate": "^1.0.7",
     "wa-sqlite": "^1.0.0",
     "zod": "^3.25.76",
-    "zustand": "^4.5.4"
+    "zustand": "^4.5.7"
   },
   "devDependencies": {
     "@rjsf/core": "6.1.1",
     "@rjsf/utils": "6.1.1",
     "@rjsf/validator-ajv8": "6.1.1",
     "@tailwindcss/container-queries": "^0.1.1",
-    "@tanstack/router-plugin": "^1.161.1",
-    "@types/lodash": "^4.17.20",
-    "@types/react": "^18.2.43",
-    "@types/react-dom": "^18.2.17",
+    "@tanstack/router-plugin": "^1.168.40",
+    "@types/lodash": "^4.17.25",
+    "@types/react": "^18.3.31",
+    "@types/react-dom": "^18.3.7",
     "@typescript-eslint/eslint-plugin": "^6.21.0",
     "@typescript-eslint/parser": "^6.21.0",
-    "@vitejs/plugin-react": "^4.2.1",
-    "autoprefixer": "^10.4
```

**File**: `packages/local-web/src/routeTree.gen.ts` (modified, +140/-140)
```diff
@@ -9,79 +9,67 @@
 // Additionally, you should also exclude this file from your linter and/or formatter to prevent it from being checked or modified.
 
 import { Route as rootRouteImport } from './routes/__root'
-import { Route as OnboardingRouteImport } from './routes/onboarding'
-import { Route as AppRouteImport } from './routes/_app'
 import { Route as IndexRouteImport } from './routes/index'
-import { Route as OnboardingSignInRouteImport } from './routes/onboarding_.sign-in'
-import { Route as AppWorkspacesRouteImport } from './routes/_app.workspaces'
-import { Route as AppNotificationsRouteImport } from './routes/_app.notifications'
+import { Route as AppRouteImport } from './routes/_app'
+import { Route as OnboardingRouteImport } from './routes/onboarding'
 import { Route as AppExportRouteImport } from './routes/_app.export'
-import { Route as WorkspacesWorkspaceIdVscodeRouteImport } from './routes/workspaces.$workspaceId.vscode'
-import { Route as AppWorkspacesElectricTestRouteImport } from './routes/_app.workspaces_.electric-test'
-import { Route as AppWorkspacesCreateRouteImport } from './routes/_app.workspaces_.create'
-import { Route as AppWorkspacesWorkspaceIdRouteImport } from './routes/_app.workspaces_.$workspaceId'
+import { Route as AppNotificationsRouteImport } from './routes/_app.notifications'
+import { Route as AppWorkspacesRouteImport } from './routes/_app.workspaces'
+import { Route as OnboardingSignInRouteImport } from './routes/onboarding_.sign-in'
 import { Route as AppProjectsProjectIdRouteImport } from './routes/_app.projects.$projectId'
+import { Route as AppWorkspacesWorkspaceIdRouteImport } from './routes/_app.workspaces_.$workspaceId'
+import { Route as AppWorkspacesCreateRouteImport } from './routes/_app.workspaces_.create'
+import { Route as AppWorkspacesElectricTestRouteImport } from './routes/_app.workspaces_.electric-test'
+import { Route as WorkspacesWorkspaceIdVscodeRouteImport } from './routes/workspaces.$workspaceId.vscode'
 import { Route as AppHostsHostIdWorkspacesRouteImport } from './routes/_app.hosts.$hostId.workspaces'
-import { Route as HostsHostIdWorkspacesWorkspaceIdVscodeRouteImport } from './routes/hosts.$hostId.workspaces.$workspaceId.vscode'
-import { Route as AppProjectsProjectIdIssuesIssueIdRouteImport } from './routes/_app.projects.$projectId_.issues.$issueId'
-import { Route as AppHostsHostIdWorkspacesCreateRouteImport } from './routes/_app.hosts.$hostId.workspaces_.create'
 import { Route as AppHostsHostIdWorkspacesWorkspaceIdRouteImport } from './routes/_app.hosts.$hostId.workspaces_.$workspaceId'
+import { Route as AppHostsHostIdWorkspacesCreateRouteImport } from './routes/_app.hosts.$hostId.workspaces_.create'
+import { Route as AppProjectsProjectIdIssuesIssueIdRouteImport } from './routes/_app.projects.$projectId_.issues.$issueId'
+import { Route as HostsHostIdWorkspacesWorkspaceIdVscodeRouteImport } from './routes/hosts.$hostId.workspaces.$workspaceId.vscode'
 import { Route as AppProjectsProjectIdWorkspacesCreateDraftIdRouteImport } from './routes/_app.projects.$projectId_.workspaces.create.$draftId'
 import { Route as AppProjectsProjectIdIssuesIssueIdWorkspacesWorkspaceIdRouteImport } from './routes/_app.projects.$projectId_.issues.$issueId_.workspaces.$workspaceId'
-import { Route as AppProjectsProjectIdIssuesIssueIdWorkspacesCreateDraftIdRouteImport } from './routes/_app.projects.$projectId_.issues.$issueId_.workspaces.create.$draftId'
 import { Route as AppProjectsProjectIdHostsHostIdWorkspacesCreateDraftIdRouteImport } from './routes/_app.projects.$projectId_.hosts.$hostId.workspaces.create.$draftId'
+import { Route as AppProjectsProjectIdIssuesIssueIdWorkspacesCreateDraftIdRouteImport } from './routes/_app.projects.$projectId_.issues.$issueId_.workspaces.create.$draftId'
 import { Route as AppProjectsProjectIdIssuesIssueIdHostsHostIdWorkspacesWorkspaceIdRouteImport } from './routes/_app.projects.$projectId_.issues.$issueId_.hosts.$hostId.workspaces.$workspaceId'
 import { Route as AppProjectsProjectIdIssuesIssueIdHostsHostIdWorkspacesCreateDraftIdRouteImport } from './routes/_app.projects.$projectId_.issues.$issueId_.hosts.$hostId.workspaces.create.$draftId'
 
-const OnboardingRoute = OnboardingRouteImport.update({
-  id: '/onboarding',
-  path: '/onboarding',
+const IndexRoute = IndexRouteImport.update({
+  id: '/',
+  path: '/',
   getParentRoute: () => rootRouteImport,
 } as any)
 const AppRoute = AppRouteImport.update({
   id: '/_app',
   getParentRoute: () => rootRouteImport,
 } as any)
-const IndexRoute = IndexRouteImport.update({
-  id: '/',
-  path: '/',
-  getParentRoute: () => rootRouteImport,
-} as any)
-const OnboardingSignInRoute = OnboardingSignInRouteImport.update({
-  id: '/onboarding_/sign-in',
-  path: '/onboarding/sign-in',
+const OnboardingRoute = OnboardingRouteImport.update({
+  id: '/onboarding',
+  path: '/onboarding',
   getParentRoute: () => rootRouteImport,
 } as any)
-const AppWorkspacesRoute = AppWorkspacesRou
```

**File**: `packages/remote-web/package.json` (modified, +19/-19)
```diff
@@ -16,36 +16,36 @@
   "dependencies": {
     "@ebay/nice-modal-react": "^1.2.13",
     "@phosphor-icons/react": "^2.1.10",
-    "@tanstack/react-query": "^5.85.5",
-    "@tanstack/react-router": "^1.161.1",
-    "@tanstack/zod-adapter": "^1.161.1",
+    "@tanstack/react-query": "^5.103.1",
+    "@tanstack/react-router": "^1.170.38",
+    "@tanstack/zod-adapter": "^1.167.0",
     "@vibe/ui": "workspace:*",
     "@vibe/web-core": "workspace:*",
     "clsx": "^2.1.1",
-    "posthog-js": "^1.283.0",
-    "prettier": "^3.6.1",
-    "react": "^18.2.0",
-    "react-hotkeys-hook": "^5.1.0",
+    "posthog-js": "^1.434.0",
+    "prettier": "^3.9.8",
+    "react": "^18.3.1",
     "react-compiler-runtime": "^1.0.0",
-    "react-dom": "^18.2.0",
-    "simple-icons": "^15.16.0",
-    "tailwind-merge": "^2.6.0",
+    "react-dom": "^18.3.1",
+    "react-hotkeys-hook": "^5.3.3",
+    "simple-icons": "^15.22.0",
+    "tailwind-merge": "^2.6.1",
     "zod": "^3.25.76",
     "zustand": "^4.5.7"
   },
   "devDependencies": {
     "@tailwindcss/container-queries": "^0.1.1",
-    "@tanstack/router-plugin": "^1.161.1",
-    "@types/react": "^18.2.43",
-    "@types/react-dom": "^18.2.17",
-    "@vitejs/plugin-react": "^4.2.1",
-    "autoprefixer": "^10.4.16",
+    "@tanstack/router-plugin": "^1.168.40",
+    "@types/react": "^18.3.31",
+    "@types/react-dom": "^18.3.7",
+    "@vitejs/plugin-react": "^4.7.0",
+    "autoprefixer": "^10.6.1",
     "babel-plugin-react-compiler": "^1.0.0",
-    "postcss": "^8.4.32",
+    "postcss": "^8.5.28",
     "tailwind-scrollbar": "^3.1.0",
-    "tailwindcss": "^3.4.0",
+    "tailwindcss": "^3.4.19",
     "tailwindcss-animate": "^1.0.7",
-    "typescript": "^5.9.2",
-    "vite": "^7.3.1"
+    "typescript": "^5.9.3",
+    "vite": "^7.3.6"
   }
 }
```

**File**: `packages/ui/package.json` (modified, +25/-25)
```diff
@@ -18,7 +18,6 @@
   },
   "dependencies": {
     "@ebay/nice-modal-react": "^1.2.13",
-    "@tanstack/react-virtual": "^3.13.23",
     "@hello-pangea/dnd": "^18.0.1",
     "@lexical/code": "^0.36.2",
     "@lexical/link": "^0.36.2",
@@ -28,39 +27,40 @@
     "@lexical/table": "^0.36.2",
     "@phosphor-icons/react": "^2.1.10",
     "@pierre/diffs": "1.1.4",
-    "@radix-ui/react-accordion": "^1.2.1",
-    "@radix-ui/react-dialog": "^1.1.4",
-    "@radix-ui/react-dropdown-menu": "^2.1.15",
-    "@radix-ui/react-label": "^2.1.7",
-    "@radix-ui/react-popover": "^1.1.15",
-    "@radix-ui/react-select": "^2.2.5",
-    "@radix-ui/react-slot": "^1.2.3",
-    "@radix-ui/react-switch": "^1.2.3",
-    "@radix-ui/react-tooltip": "^1.2.8",
-    "@tanstack/react-query": "^5.85.5",
+    "@radix-ui/react-accordion": "^1.2.20",
+    "@radix-ui/react-dialog": "^1.1.23",
+    "@radix-ui/react-dropdown-menu": "^2.1.24",
+    "@radix-ui/react-label": "^2.1.15",
+    "@radix-ui/react-popover": "^1.1.23",
+    "@radix-ui/react-select": "^2.3.7",
+    "@radix-ui/react-slot": "^1.3.3",
+    "@radix-ui/react-switch": "^1.3.7",
+    "@radix-ui/react-tooltip": "^1.2.16",
+    "@tanstack/react-query": "^5.103.1",
+    "@tanstack/react-virtual": "^3.14.13",
     "class-variance-authority": "^0.7.1",
     "clsx": "^2.1.1",
     "cmdk": "^1.1.1",
-    "developer-icons": "^6.0.4",
+    "developer-icons": "^6.0.5",
     "lexical": "^0.36.2",
     "lucide-react": "^0.541.0",
-    "react": "^18.2.0",
-    "react-dom": "^18.2.0",
-    "react-hotkeys-hook": "^5.1.0",
+    "react": "^18.3.1",
+    "react-dom": "^18.3.1",
+    "react-hotkeys-hook": "^5.3.3",
     "react-i18next": "^15.7.4",
-    "react-virtuoso": "^4.14.0",
-    "tailwind-merge": "^3.3.1"
+    "react-virtuoso": "^4.18.13",
+    "tailwind-merge": "^3.7.0"
   },
   "devDependencies": {
-    "@types/react": "^18.2.43",
-    "@types/react-dom": "^18.2.17",
+    "@types/react": "^18.3.31",
+    "@types/react-dom": "^18.3.7",
     "@typescript-eslint/eslint-plugin": "^6.21.0",
     "@typescript-eslint/parser": "^6.21.0",
-    "eslint": "^8.55.0",
-    "eslint-config-prettier": "^10.1.5",
-    "eslint-plugin-react-hooks": "^4.6.0",
-    "eslint-plugin-unused-imports": "^4.1.4",
-    "prettier": "^3.6.1",
-    "typescript": "^5.9.2"
+    "eslint": "^8.57.1",
+    "eslint-config-prettier": "^10.1.8",
+    "eslint-plugin-react-hooks": "^4.6.2",
+    "eslint-plugin-unused-imports": "^4.4.1",
+    "prettier": "^3.9.8",
+    "typescript": "^5.9.3"
   }
 }
```

**File**: `packages/web-core/package.json` (modified, +68/-68)
```diff
@@ -10,9 +10,9 @@
   },
   "dependencies": {
     "@codemirror/lang-json": "^6.0.2",
-    "@codemirror/language": "^6.11.2",
-    "@codemirror/lint": "^6.8.5",
-    "@codemirror/view": "^6.38.1",
+    "@codemirror/language": "^6.12.4",
+    "@codemirror/lint": "^6.9.7",
+    "@codemirror/view": "^6.43.12",
     "@dnd-kit/core": "^6.3.1",
     "@dnd-kit/sortable": "^10.0.0",
     "@dnd-kit/utilities": "^3.2.2",
@@ -30,71 +30,71 @@
     "@noble/curves": "^1.9.7",
     "@phosphor-icons/react": "^2.1.10",
     "@pierre/diffs": "1.1.4",
-    "@radix-ui/react-accordion": "^1.2.1",
-    "@radix-ui/react-dialog": "^1.1.15",
-    "@radix-ui/react-dropdown-menu": "^2.1.15",
-    "@radix-ui/react-label": "^2.1.7",
-    "@radix-ui/react-popover": "^1.1.15",
-    "@radix-ui/react-select": "^2.2.5",
-    "@radix-ui/react-separator": "^1.1.8",
-    "@radix-ui/react-slot": "^1.2.3",
-    "@radix-ui/react-switch": "^1.0.3",
-    "@radix-ui/react-toggle-group": "^1.1.11",
-    "@radix-ui/react-tooltip": "^1.2.7",
+    "@radix-ui/react-accordion": "^1.2.20",
+    "@radix-ui/react-dialog": "^1.1.23",
+    "@radix-ui/react-dropdown-menu": "^2.1.24",
+    "@radix-ui/react-label": "^2.1.15",
+    "@radix-ui/react-popover": "^1.1.23",
+    "@radix-ui/react-select": "^2.3.7",
+    "@radix-ui/react-separator": "^1.1.15",
+    "@radix-ui/react-slot": "^1.3.3",
+    "@radix-ui/react-switch": "^1.3.7",
+    "@radix-ui/react-toggle-group": "^1.1.19",
+    "@radix-ui/react-tooltip": "^1.2.16",
     "@rjsf/shadcn": "6.1.1",
-    "@sentry/react": "^9.34.0",
-    "@sentry/vite-plugin": "^3.5.0",
-    "@tanstack/electric-db-collection": "^0.2.6",
-    "@tanstack/react-db": "^0.1.50",
-    "@tanstack/react-form": "^1.23.8",
-    "@tanstack/react-query": "^5.85.5",
-    "@tanstack/react-router": "^1.161.1",
-    "@tanstack/react-virtual": "^3.13.23",
-    "@tanstack/zod-adapter": "^1.161.1",
-    "@uiw/react-codemirror": "^4.25.1",
+    "@sentry/react": "^9.47.1",
+    "@sentry/vite-plugin": "^3.6.1",
+    "@tanstack/electric-db-collection": "^0.2.43",
+    "@tanstack/react-db": "^0.1.96",
+    "@tanstack/react-form": "^1.33.5",
+    "@tanstack/react-query": "^5.103.1",
+    "@tanstack/react-router": "^1.170.38",
+    "@tanstack/react-virtual": "^3.14.13",
+    "@tanstack/zod-adapter": "^1.167.0",
+    "@uiw/react-codemirror": "^4.25.11",
     "@vibe/ui": "workspace:*",
-    "@virtuoso.dev/message-list": "^1.13.3",
+    "@virtuoso.dev/message-list": "^1.18.0",
     "@xterm/addon-fit": "^0.10.0",
     "@xterm/addon-web-links": "^0.11.0",
     "@xterm/xterm": "^5.5.0",
-    "class-variance-authority": "^0.7.0",
-    "click-to-react-component": "^1.1.2",
-    "clsx": "^2.0.0",
+    "class-variance-authority": "^0.7.1",
+    "click-to-react-component": "^1.1.3",
+    "clsx": "^2.1.1",
     "cmdk": "^1.1.1",
-    "developer-icons": "^6.0.4",
+    "developer-icons": "^6.0.5",
     "fancy-ansi": "^0.1.3",
-    "framer-motion": "^12.23.24",
-    "i18next": "^25.5.2",
-    "i18next-browser-languagedetector": "^8.2.0",
-    "immer": "^11.1.3",
+    "framer-motion": "^12.43.0",
+    "i18next": "^25.10.10",
+    "i18next-browser-languagedetector": "^8.2.1",
+    "immer": "^11.1.18",
     "jwt-decode": "^4.0.0",
     "lexical": "^0.36.2",
-    "lodash": "^4.17.21",
+    "lodash": "^4.18.1",
     "lucide-react": "^0.539.0",
-    "mermaid": "^11.4.0",
-    "posthog-js": "^1.276.0",
-    "react": "^18.2.0",
+    "mermaid": "^11.17.2",
+    "posthog-js": "^1.434.0",
+    "react": "^18.3.1",
     "react-compiler-runtime": "^1.0.0",
-    "react-dom": "^18.2.0",
-    "react-dropzone": "^14.3.8",
-    "react-hotkeys-hook": "^5.1.0",
-    "react-i18next": "^15.7.3",
-    "react-markdown": "^9.0.1",
-    "react-resizable-panels": "^4.0.13",
+    "react-dom": "^18.3.1",
+    "react-dropzone": "^14.4.1",
+    "react-hotkeys-hook": "^5.3.3",
+    "react-i18next": "^15.7.4",
+    "react-markdown": "^9.1.0",
+    "react-resizable-panels": "^4.12.4",
     "react-use-websocket": "^4.13.0",
-    "react-virtuoso": "^4.14.0",
-    "rehype-highlight": "^7.0.0",
+    "react-virtuoso": "^4.18.13",
+    "rehype-highlight": "^7.0.2",
     "rehype-raw": "^7.0.0",
     "rehype-sanitize": "^6.0.0",
-    "remark-gfm": "^4.0.0",
-    "rfc6902": "^5.1.2",
-    "simple-icons": "^15.16.0",
-    "tailwind-merge": "^2.2.0",
+    "remark-gfm": "^4.0.1",
+    "rfc6902": "^5.3.0",
+    "simple-icons": "^15.22.0",
+    "tailwind-merge": "^2.6.1",
     "tailwind-scrollbar": "^3.1.0",
     "tailwindcss-animate": "^1.0.7",
     "wa-sqlite": "^1.0.0",
     "zod": "^3.25.76",
-    "zustand": "^4.5.4"
+    "zustand": "^4.5.7"
   },
   "scripts": {
     "check": "tsc --noEmit",
@@ -106,29 +106,29 @@
     "@rjsf/utils": "6.1.1",
     "@rjsf/validator-ajv8": "6.1.1",
     "@tailwindcss/container-queries": "^0.1.1",
-    "@tanstack/router-plugin": "^1.161.1",
-    "@types/lodash": "^4.17.20",
-    "@types/react": "^18.2.43",
-    "@types/react-dom": "^18.2.17",
+    "@tanstack/router-plugin": "^1.168.40"
```

**File**: `pnpm-workspace.yaml` (modified, +7/-0)
```diff
@@ -6,5 +6,12 @@ onlyBuiltDependencies:
   - core-js
   - esbuild
 
+overrides:
+  diff@>=6.0.0 <8.0.3: '>=8.0.3'
+  esbuild@>=0.27.3 <0.28.1: '>=0.28.1'
+  minimatch@>=9.0.0 <9.0.7: '>=9.0.7'
+  picomatch@>=4.0.0 <4.0.4: '>=4.0.4'
+  uuid@>=13.0.0 <13.0.1: '>=13.0.1'
+
 patchedDependencies:
   '@pierre/diffs@1.1.4': patches/@pierre__diffs@1.1.4.patch
```

---

### Incident Patch 3: `824b37cd` (2026-09-18)
**Commit Message**: fix: an Enter that confirms an IME candidate is not an Enter (#3459)

* fix: an Enter that confirms an IME candidate is not an Enter

event.isComposing alone is not enough. Safari fires compositionend BEFORE the
confirming Enter's keydown, so the flag is already false when the handler runs
and the keypress goes through — the line submits half-composed. Chrome and
Firefox fire it after, which is why the naive guard looks correct there and the
bug reads as Safari-only.

Adds isImeConfirmation(): isComposing, OR a composition that ended within the
last 30ms. Composition is tracked on window in the capture phase, so one that
ends after focus moves still closes, and blur closes an abandoned one.

Wired into the two places that guard today: the shared useSemanticKey hook,
which covers every registered shortcut, and Input.tsx. The helper is duplicated
into each package because @vibe/ui does not depend on @vibe/web-core and this
change is not the place to create that edge.

* refactor: keep the IME helper in @vibe/ui, and fix three defects in it

Per review, the helper lives only in packages/ui and web-core imports it from
@vibe/ui/lib/imeComposition. Copying it into both packages was my m

**File**: `packages/ui/package.json` (modified, +3/-1)
```diff
@@ -9,7 +9,9 @@
     "format": "prettier --config ../../packages/local-web/.prettierrc.json --write \"src/**/*.{ts,tsx,js,jsx,json,md}\"",
     "format:check": "prettier --config ../../packages/local-web/.prettierrc.json --check \"src/**/*.{ts,tsx,js,jsx,json,md}\""
   },
-  "sideEffects": false,
+  "sideEffects": [
+    "./src/lib/imeComposition.ts"
+  ],
   "exports": {
     "./components/*": "./src/components/*.tsx",
     "./lib/*": "./src/lib/*.ts"
```

**File**: `packages/ui/src/components/Input.tsx` (modified, +2/-1)
```diff
@@ -1,4 +1,5 @@
 import * as React from 'react';
+import { isImeConfirmation } from '../lib/imeComposition';
 import { cn } from '../lib/cn';
 import { twMerge } from 'tailwind-merge';
 
@@ -24,7 +25,7 @@ const Input = React.forwardRef<HTMLInputElement, InputProps>(
       if (e.key === 'Escape') {
         e.currentTarget.blur();
       }
-      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
+      if (e.key === 'Enter' && !isImeConfirmation(e.nativeEvent)) {
         if (e.metaKey && e.shiftKey) {
           onCommandShiftEnter?.(e);
         } else {
```

**File**: `packages/ui/src/lib/imeComposition.ts` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+/**
+ * An Enter that CONFIRMS an IME candidate must not reach a shortcut or a submit handler.
+ *
+ * `event.isComposing` alone is not enough. **Safari fires `compositionend` BEFORE the confirming
+ * Enter's `keydown`**, so the flag is already `false` when the handler runs and the keypress goes
+ * through — the line submits half-composed. Chrome and Firefox fire it after, which is why the
+ * naive guard looks correct there and the bug reads as Safari-only.
+ *
+ * A tight window after `compositionend` covers it: that sequence is synchronous (microseconds),
+ * while a human pressing Enter a second time takes 100ms or more and never lands inside it.
+ *
+ * Composition is tracked on `window` in the capture phase rather than per field, so a composition
+ * that starts in one input and ends after focus moves still closes, and a handler bound to
+ * something that cannot hold text can call this safely — no composition ever opens there.
+ */
+export const SAFARI_IME_RACE_WINDOW_MS = 30;
+
+let composing = false;
+// Not 0: `performance.now()` counts from the page's time origin, so `now - 0` is under the
+// window for the first 30ms of the page and would swallow an Enter no composition preceded.
+let lastCompositionEndAt = Number.NEGATIVE_INFINITY;
+
+if (typeof window !== 'undefined') {
+  window.addEventListener(
+    'compositionstart',
+    () => {
+      composing = true;
+    },
+    true
+  );
+  window.addEventListener(
+    'compositionend',
+    () => {
+      composing = false;
+      lastCompositionEndAt = performance.now();
+    },
+    true
+  );
+  // `blur` does not bubble, but a capture-phase listener on `window` still sees it on the way
+  // down — otherwise a composition abandoned by clicking away would stay open forever.
+  window.addEventListener(
+    'blur',
+    () => {
+      composing = false;
+    },
+    true
+  );
+}
+
+/** True when this keydown is (or is very likely) an IME confirmation rather than a real keypress. */
+export function isImeConfirmation(
+  event: Pick<KeyboardEvent, 'isComposing' | 'key'>
+): boolean {
+  // An open composition swallows every key, because none of them reached the application.
+  if (event.isComposing || composing) return true;
+  // The window after it is Enter-only. It exists for the keystroke that CONFIRMS a candidate,
+  // and that keystroke is Enter; applying it to every key would drop an unrelated shortcut for
+  // 30ms after any composition ended.
+  if (event.key !== 'Enter') return false;
+  return performance.now() - lastCompositionEndAt < SAFARI_IME_RACE_WINDOW_MS;
+}
```

**File**: `packages/web-core/src/shared/keyboard/useSemanticKey.ts` (modified, +5/-3)
```diff
@@ -2,6 +2,7 @@ import { useMemo } from 'react';
 import type { EnableOnFormTags } from '@/shared/keyboard/types';
 import { Action, Scope, getKeysFor } from '@/shared/keyboard/registry';
 import { useHotkeys } from 'react-hotkeys-hook';
+import { isImeConfirmation } from '@vibe/ui/lib/imeComposition';
 
 export interface SemanticKeyOptions {
   scope?: Scope;
@@ -40,9 +41,10 @@ export function createSemanticHook<A extends Action>(action: A) {
     useHotkeys(
       keys,
       (event) => {
-        // Skip if IME composition is in progress (e.g., Japanese, Chinese, Korean input)
-        // This prevents shortcuts from firing when user is converting text with Enter
-        if (event.isComposing) {
+        // Skip a key the IME consumed (Japanese, Chinese, Korean input). `isComposing` alone
+        // misses Safari, which fires `compositionend` before the confirming keydown — see
+        // @vibe/ui/lib/imeComposition.
+        if (isImeConfirmation(event)) {
           return;
         }
 
```

---

### Incident Patch 4: `a4274e43` (2026-09-17)
**Commit Message**: fix: route server startup through startup::initialize_deployment (#3449)

main.rs open-coded its own initialization sequence, which had drifted from
server::startup::initialize_deployment. The inline path never called
migrate_legacy_attachment_directories, so the legacy attachment directory
migration did not run for anyone starting the server through this binary.

Replaces the duplicated block with the shared function, which also covers
sentry scope, orphan execution cleanup and the existing backfills.

Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `crates/server/src/main.rs` (modified, +2/-39)
```diff
@@ -3,6 +3,7 @@ use axum::Router;
 use deployment::{Deployment, DeploymentError};
 use server::{
     DeploymentImpl, middleware::origin::validate_origin, routes, runtime::relay_registration,
+    startup,
 };
 use services::services::container::ContainerService;
 use sqlx::Error as SqlxError;
@@ -12,7 +13,6 @@ use tokio_util::sync::CancellationToken;
 use tower_http::validate_request::ValidateRequestHeaderLayer;
 use tracing_subscriber::{EnvFilter, prelude::*};
 use utils::{
-    assets::asset_dir,
     port_file::write_port_file_with_proxy,
     sentry::{self as sentry_utils, SentrySource, sentry_layer},
 };
@@ -49,46 +49,9 @@ async fn main() -> Result<(), VibeKanbanError> {
         .with(sentry_layer())
         .init();
 
-    // Create asset directory if it doesn't exist
-    if !asset_dir().exists() {
-        std::fs::create_dir_all(asset_dir())?;
-    }
-
-    // Copy old database to new location for safe downgrades
-    let old_db = asset_dir().join("db.sqlite");
-    let new_db = asset_dir().join("db.v2.sqlite");
-    if !new_db.exists() && old_db.exists() {
-        tracing::info!(
-            "Copying database to new location: {:?} -> {:?}",
-            old_db,
-            new_db
-        );
-        std::fs::copy(&old_db, &new_db).expect("Failed to copy database file");
-        tracing::info!("Database copy complete");
-    }
-
     let shutdown_token = CancellationToken::new();
 
-    let deployment = DeploymentImpl::new(shutdown_token.clone()).await?;
-    deployment.update_sentry_scope().await?;
-    deployment
-        .container()
-        .cleanup_orphan_executions()
-        .await
-        .map_err(DeploymentError::from)?;
-    deployment
-        .container()
-        .backfill_before_head_commits()
-        .await
-        .map_err(DeploymentError::from)?;
-    deployment
-        .container()
-        .backfill_repo_names()
-        .await
-        .map_err(DeploymentError::from)?;
-    deployment
-        .track_if_analytics_allowed("session_start", serde_json::json!({}))
-        .await;
+    let deployment = startup::initialize_deployment(shutdown_token.clone()).await?;
     // Preload global executor options cache for all executors with DEFAULT presets
     tokio::spawn(async move {
         executors::executors::utils::preload_global_executor_options_cache().await;
```

---

### Incident Patch 5: `b36a567d` (2026-09-17)
**Commit Message**: docs: add SECURITY.md (#3448)

Documents how to report a vulnerability privately rather than through a
public issue.

Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `SECURITY.md` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+# Security Policy
+
+## Supported Versions
+
+The latest release is always supported with security updates. Older releases
+receive fixes on a best-effort basis.
+
+| Version | Supported          |
+| ------- | ------------------ |
+| latest  | :white_check_mark: |
+
+## Reporting a Vulnerability
+
+Please report security vulnerabilities by opening a **private** GitHub Security
+Advisory at `https://github.com/BloopAI/vibe-kanban/security/advisories/new`.
+
+Include a description of the issue, steps to reproduce, and your assessment of
+impact. You will receive an acknowledgement within 72 hours. If the report is
+accepted, a patch will be released as soon as possible and you will be credited
+in the release notes.
```

---

### Incident Patch 6: `3b2e2866` (2026-09-17)
**Commit Message**: fix: correct swapped stderr/stdout labels in git CLI error output (#3447)

When only one stream had content the labels were reversed, so stdout-only
failures were reported under '--- stderr' and stderr-only failures under
'--- stdout'. Makes git command failures misleading to debug.

Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `crates/git/src/cli.rs` (modified, +2/-2)
```diff
@@ -824,8 +824,8 @@ impl GitCli {
             let combined = match (stdout.is_empty(), stderr.is_empty()) {
                 (true, true) => "Command failed with no output".to_string(),
                 (false, false) => format!("--- stderr\n{stderr}\n--- stdout\n{stdout}"),
-                (false, true) => format!("--- stderr\n{stdout}"),
-                (true, false) => format!("--- stdout\n{stderr}"),
+                (false, true) => format!("--- stdout\n{stdout}"),
+                (true, false) => format!("--- stderr\n{stderr}"),
             };
             return Err(GitCliError::CommandFailed(combined));
         }
```

---

### Incident Patch 7: `a1339e5b` (2026-04-17)
**Commit Message**: fix: scope vendored openssl to linux to unbreak windows-msvc cross-compile (#3367)

native-tls only depends on openssl-sys on linux; macos uses
Security.framework and windows uses schannel. The previous global
openssl/vendored dep dragged openssl-sys onto windows-msvc, where
its build script invokes perl ./Configure VC-WIN64A and aborts
because linux perl produces forward-slash paths.

Move the vendored openssl dep into a [target.'cfg(target_os = "linux")']
block so only musl cross-compile vendors openssl, and windows-msvc /
macos backend builds skip openssl-sys entirely.

Co-authored-by: Claude Opus 4.7 <[REDACTED_EMAIL]>

**File**: `crates/executors/Cargo.toml` (modified, +7/-4)
```diff
@@ -41,10 +41,6 @@ codex-app-server-protocol = { git = "https://github.com/openai/codex.git", packa
 sha2 = "0.10"
 derivative = "2.2.0"
 reqwest = { workspace = true }
-# Forces openssl-sys (pulled in transitively by codex-protocol → reqwest →
-# hyper-tls → native-tls) to build from vendored C source. Required for
-# musl + windows-msvc cross-compile, which have no system OpenSSL.
-openssl = { version = "0.10", features = ["vendored"] }
 eventsource-stream = "0.2"
 walkdir = "2"
 rand = "0.8"
@@ -56,6 +52,13 @@ async-stream = "0.3"
 [target.'cfg(windows)'.dependencies]
 winsplit = "0.1.0"
 
+# On Linux, codex-protocol → reqwest → hyper-tls → native-tls pulls in
+# openssl-sys. Vendor it so musl cross-compile (no system OpenSSL) builds.
+# macOS uses Security.framework and Windows uses schannel via native-tls,
+# so neither pulls in openssl-sys — keep this Linux-only.
+[target.'cfg(target_os = "linux")'.dependencies]
+openssl = { version = "0.10", features = ["vendored"] }
+
 [features]
 default = []
 qa-mode = []
```

---

### Incident Patch 8: `d737b600` (2026-04-17)
**Commit Message**: fix: vendor openssl to unblock musl + windows-msvc cross-compile (#3366)

Codex 0.121 transitively enables reqwest's default-tls (via codex-protocol's
reqwest dep), which pulls openssl-sys into the build. cargo zigbuild and
cargo xwin have no system OpenSSL, so the openssl-sys build script aborts
when cross-compiling for musl/windows-msvc targets. Enabling openssl/vendored
forces openssl-sys to build from bundled C source.

Co-authored-by: Claude Opus 4.7 <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +11/-0)
```diff
@@ -2806,6 +2806,7 @@ dependencies = [
  "json-patch 2.0.0",
  "jsonc-parser",
  "lru 0.12.5",
+ "openssl",
  "os_pipe",
  "rand 0.8.5",
  "regex",
@@ -6024,6 +6025,15 @@ version = "0.2.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "7c87def4c32ab89d880effc9e097653c8da5d6ef28e6b539d313baaacfbafcbe"
 
+[[package]]
+name = "openssl-src"
+version = "300.5.5+3.5.5"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "3f1787d533e03597a7934fd0a765f0d28e94ecc5fb7789f8053b1e699a56f709"
+dependencies = [
+ "cc",
+]
+
 [[package]]
 name = "openssl-sys"
 version = "0.9.113"
@@ -6032,6 +6042,7 @@ checksum = "ad2f2c0eba47118757e4c6d2bff2838f3e0523380021356e7875e858372ce644"
 dependencies = [
  "cc",
  "libc",
+ "openssl-src",
  "pkg-config",
  "vcpkg",
 ]
```

**File**: `crates/executors/Cargo.toml` (modified, +4/-0)
```diff
@@ -41,6 +41,10 @@ codex-app-server-protocol = { git = "https://github.com/openai/codex.git", packa
 sha2 = "0.10"
 derivative = "2.2.0"
 reqwest = { workspace = true }
+# Forces openssl-sys (pulled in transitively by codex-protocol → reqwest →
+# hyper-tls → native-tls) to build from vendored C source. Required for
+# musl + windows-msvc cross-compile, which have no system OpenSSL.
+openssl = { version = "0.10", features = ["vendored"] }
 eventsource-stream = "0.2"
 walkdir = "2"
 rand = "0.8"
```

---

### Incident Patch 9: `71a25f4a` (2026-04-03)
**Commit Message**: fix: reap execution process groups on natural exit (Vibe Kanban) (#3318)

* fix: kill process group on natural executor exit to prevent orphaned MCP processes

The exit monitor's OS exit path (Branch 2) never called kill_process_group(),
leaving child processes like vibe-kanban-mcp running as orphans after the
executor exited naturally. This mirrors the cleanup already done in the
exit signal path (Branch 1).

Co-Authored-By: Claude Opus 4.6 (1M context) <[REDACTED_EMAIL]>

fix: kill process group on natural executor exit to prevent orphaned MCP processes

When an executor (e.g. claude) exits naturally, its child processes like
vibe-kanban-mcp were left running as orphans because no one sent a signal
to the process group.

Two changes:

1. spawn_os_exit_watcher now kills the process group immediately after
   detecting the leader has exited, cleaning up orphaned children at the
   single choke point for natural exit detection.

2. kill_process_group() handles ESRCH from getpgid() by falling back to
   using the leader PID as the PGID (always correct for group_spawn
   children which use setpgid(0,0)). Previously it returned early when
   the leader had already exited, never sending

**File**: `crates/local-deployment/src/container.rs` (modified, +7/-1)
```diff
@@ -801,7 +801,13 @@ impl LocalContainerService {
                 let _ = tokio::time::timeout(Duration::from_secs(5), handle).await;
             }
 
-            // Cleanup child handle
+            // SIGKILL any orphaned children (e.g. MCP servers) still in the
+            // process group. The executor itself is already done — either it
+            // exited naturally or was killed in the exit-signal branch above.
+            if let Some(child_lock) = child_store.read().await.get(&exec_id).cloned() {
+                let mut child = child_lock.write().await;
+                let _ = child.start_kill();
+            }
             child_store.write().await.remove(&exec_id);
         })
     }
```

**File**: `crates/utils/src/process.rs` (modified, +13/-23)
```diff
@@ -1,36 +1,26 @@
 use command_group::AsyncGroupChild;
 #[cfg(unix)]
-use nix::{
-    sys::signal::{Signal, killpg},
-    unistd::{Pid, getpgid},
-};
-#[cfg(unix)]
 use tokio::time::Duration;
 
 pub async fn kill_process_group(child: &mut AsyncGroupChild) -> std::io::Result<()> {
-    // hit the whole process group, not just the leader
     #[cfg(unix)]
     {
-        if let Some(pid) = child.inner().id() {
-            let pgid = getpgid(Some(Pid::from_raw(pid as i32)))
-                .map_err(|e| std::io::Error::other(e.to_string()))?;
+        // Use command_group's UnixChildExt::signal() which calls killpg()
+        // with the pgid captured at spawn time. This works even after the
+        // group leader has exited, unlike getpgid() which would fail.
+        use command_group::{Signal, UnixChildExt};
 
-            for sig in [Signal::SIGINT, Signal::SIGTERM, Signal::SIGKILL] {
-                tracing::info!("Sending {:?} to process group {}", sig, pgid);
-                if let Err(e) = killpg(pgid, sig) {
-                    tracing::warn!(
-                        "Failed to send signal {:?} to process group {}: {}",
-                        sig,
-                        pgid,
-                        e
-                    );
-                }
-                tracing::info!("Waiting 2s for process group {} to exit", pgid);
-                tokio::time::sleep(Duration::from_secs(2)).await;
-                if child.inner().try_wait()?.is_some() {
-                    tracing::info!("Process group {} exited after {:?}", pgid, sig);
+        for sig in [Signal::SIGINT, Signal::SIGTERM, Signal::SIGKILL] {
+            tracing::info!("Sending {:?} to process group", sig);
+            if let Err(e) = child.signal(sig) {
+                // break if the group does not exist anymore
+                if e.raw_os_error() == Some(nix::libc::ESRCH) {
                     break;
                 }
+                tracing::warn!("Failed to send signal {:?} to process group: {}", sig, e);
+            }
+            if sig != Signal::SIGKILL {
+                tokio::time::sleep(Duration::from_secs(2)).await;
             }
         }
     }
```

---

### Incident Patch 10: `2a484006` (2026-04-03)
**Commit Message**: fix: revert execution processes from Zustand store to React Context to fix conversation history leakage (Vibe Kanban) (#3314)

* fix: close running-process stream controllers on workspace switch to prevent conversation history leakage

When switching workspaces while a process is running, the new component
reads stale execution processes from the Zustand store (which lags one
render behind). The running-process effect starts a persistent WebSocket
stream for the stale process via loadRunningAndEmit. When the store
updates and the process disappears, the stream is never closed because
the controller is local to the Promise closure with no external handle.
The orphaned stream continues merging old workspace entries into the
display refs, causing conversation history from the previous workspace
to leak into the current one.

Replace streamingProcessIdsRef (Set<string>) with
activeStreamControllersRef (Map<string, {close}>) so the reset effect
can proactively close all active stream controllers when scopeKey
changes. Controllers are stored in the map on creation inside
loadRunningAndEmit and removed on natural completion (onFinished) or
after the full backoff sequence (.finally). On er

**File**: `packages/web-core/src/features/workspace-chat/model/contexts/RetryUiContext.tsx` (modified, +3/-2)
```diff
@@ -1,5 +1,5 @@
 import React, { useCallback, useMemo, useState } from 'react';
-import { useExecutionProcessesAll } from '@/shared/stores/useExecutionProcessesStore';
+import { useExecutionProcessesContext } from '@/shared/hooks/useExecutionProcessesContext';
 import {
   RetryUiContext,
   type RetryUiContextType,
@@ -11,7 +11,8 @@ export function RetryUiProvider({
   workspaceId?: string;
   children: React.ReactNode;
 }) {
-  const executionProcesses = useExecutionProcessesAll();
+  const { executionProcessesAll: executionProcesses } =
+    useExecutionProcessesContext();
 
   const [activeRetryProcessId, setActiveRetryProcessId] = useState<
     string | null
```

**File**: `packages/web-core/src/features/workspace-chat/model/hooks/useConversationHistory.ts` (modified, +6/-8)
```diff
@@ -3,11 +3,7 @@ import {
   ExecutionProcessStatus,
   PatchType,
 } from 'shared/types';
-import {
-  useExecutionProcessesVisible,
-  useExecutionProcessesIsLoading,
-  useExecutionProcessesIsConnected,
-} from '@/shared/stores/useExecutionProcessesStore';
+import { useExecutionProcessesContext } from '@/shared/hooks/useExecutionProcessesContext';
 import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
 import { streamJsonPatchEntries } from '@/shared/lib/streamJsonPatchEntries';
 import type {
@@ -34,9 +30,11 @@ export const useConversationHistory = ({
   onTimelineUpdated,
   scopeKey,
 }: UseConversationHistoryParams): UseConversationHistoryResult => {
-  const executionProcessesRaw = useExecutionProcessesVisible();
-  const isLoading = useExecutionProcessesIsLoading();
-  const isConnected = useExecutionProcessesIsConnected();
+  const {
+    executionProcessesVisible: executionProcessesRaw,
+    isLoading,
+    isConnected,
+  } = useExecutionProcessesContext();
   const executionProcesses = useRef<ExecutionProcess[]>(executionProcessesRaw);
   const displayedExecutionProcesses = useRef<ExecutionProcessStateStore>({});
   const loadedInitialEntries = useRef(false);
```

**File**: `packages/web-core/src/features/workspace-chat/model/hooks/useResetProcess.ts` (modified, +2/-2)
```diff
@@ -1,5 +1,5 @@
 import { useCallback, useMemo } from 'react';
-import { useExecutionProcessesAll } from '@/shared/stores/useExecutionProcessesStore';
+import { useExecutionProcessesContext } from '@/shared/hooks/useExecutionProcessesContext';
 import { useBranchStatus } from '@/shared/hooks/useBranchStatus';
 import { isCodingAgent } from '@/shared/constants/processes';
 import { useResetProcessMutation } from './useResetProcessMutation';
@@ -19,7 +19,7 @@ export function useResetProcess(
   selectedSessionId: string | undefined
 ): UseResetProcessResult {
   const { data: branchStatus } = useBranchStatus(workspaceId);
-  const processes = useExecutionProcessesAll();
+  const { executionProcessesAll: processes } = useExecutionProcessesContext();
 
   const resetMutation = useResetProcessMutation(selectedSessionId ?? '');
   const isResetPending = resetMutation.isPending;
```

**File**: `packages/web-core/src/pages/workspaces/ProcessListContainer.tsx` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 import { useEffect, useMemo, useCallback } from 'react';
 import { useTranslation } from 'react-i18next';
-import { useExecutionProcessesVisible } from '@/shared/stores/useExecutionProcessesStore';
+import { useExecutionProcessesContext } from '@/shared/hooks/useExecutionProcessesContext';
 import { useLogsPanel } from '@/shared/hooks/useLogsPanel';
 import { ProcessListItem } from '@vibe/ui/components/ProcessListItem';
 import { InputField } from '@vibe/ui/components/InputField';
@@ -31,7 +31,7 @@ export function ProcessListContainer() {
     logsPanelContent?.type === 'tool' || logsPanelContent?.type === 'terminal';
   const matchCount = logMatchIndices.length;
   const { t } = useTranslation('common');
-  const executionProcessesVisible = useExecutionProcessesVisible();
+  const { executionProcessesVisible } = useExecutionProcessesContext();
 
   // Sort processes by created_at descending (newest first)
   const sortedProcesses = useMemo(() => {
```

**File**: `packages/web-core/src/shared/hooks/useActionVisibilityContext.ts` (modified, +2/-2)
```diff
@@ -12,7 +12,7 @@ import { useUserSystem } from '@/shared/hooks/useUserSystem';
 import { useDevServer } from '@/shared/hooks/useDevServer';
 import { useBranchStatus } from '@/shared/hooks/useBranchStatus';
 import { useShape } from '@/shared/integrations/electric/hooks';
-import { useIsAttemptRunningVisible } from '@/shared/stores/useExecutionProcessesStore';
+import { useExecutionProcessesContext } from '@/shared/hooks/useExecutionProcessesContext';
 import { useLogsPanel } from '@/shared/hooks/useLogsPanel';
 import { useAuth } from '@/shared/hooks/auth/useAuth';
 import { isProjectDestination } from '@/shared/lib/routes/appNavigation';
@@ -92,7 +92,7 @@ export function useActionVisibilityContext(
   const { isStarting, isStopping, runningDevServers } =
     useDevServer(workspaceId);
   const { data: branchStatus } = useBranchStatus(workspaceId);
-  const isAttemptRunningVisible = useIsAttemptRunningVisible();
+  const { isAttemptRunningVisible } = useExecutionProcessesContext();
   const { logsPanelContent } = useLogsPanel();
   const { isSignedIn } = useAuth();
 
```

**File**: `packages/web-core/src/shared/hooks/useExecutionProcessesContext.ts` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+import { useContext } from 'react';
+import { createHmrContext } from '@/shared/lib/hmrContext';
+import type { ExecutionProcess } from 'shared/types';
+
+export type ExecutionProcessesContextType = {
+  executionProcessesAll: ExecutionProcess[];
+  executionProcessesByIdAll: Record<string, ExecutionProcess>;
+  isAttemptRunningAll: boolean;
+
+  executionProcessesVisible: ExecutionProcess[];
+  executionProcessesByIdVisible: Record<string, ExecutionProcess>;
+  isAttemptRunningVisible: boolean;
+
+  isLoading: boolean;
+  isConnected: boolean;
+  error: string | null;
+};
+
+export const ExecutionProcessesContext =
+  createHmrContext<ExecutionProcessesContextType | null>(
+    'ExecutionProcessesContext',
+    null
+  );
+
+export const useExecutionProcessesContext = () => {
+  const ctx = useContext(ExecutionProcessesContext);
+  if (!ctx) {
+    throw new Error(
+      'useExecutionProcessesContext must be used within ExecutionProcessesProvider'
+    );
+  }
+  return ctx;
+};
```

**File**: `packages/web-core/src/shared/hooks/useWorkspaceExecution.ts` (modified, +6/-8)
```diff
@@ -5,11 +5,7 @@ import {
   useQueries,
 } from '@tanstack/react-query';
 import { workspacesApi, executionProcessesApi } from '@/shared/lib/api';
-import {
-  useExecutionProcessesVisible,
-  useIsAttemptRunningVisible,
-  useExecutionProcessesIsLoading,
-} from '@/shared/stores/useExecutionProcessesStore';
+import { useExecutionProcessesContext } from '@/shared/hooks/useExecutionProcessesContext';
 import type { AttemptData } from '@/shared/lib/types';
 import type { ExecutionProcess } from 'shared/types';
 
@@ -35,9 +31,11 @@ export function useWorkspaceExecution(workspaceId?: string) {
       },
     }).length > 0;
 
-  const executionProcesses = useExecutionProcessesVisible();
-  const isAttemptRunning = useIsAttemptRunningVisible();
-  const streamLoading = useExecutionProcessesIsLoading();
+  const {
+    executionProcessesVisible: executionProcesses,
+    isAttemptRunningVisible: isAttemptRunning,
+    isLoading: streamLoading,
+  } = useExecutionProcessesContext();
 
   // Get setup script processes that need detailed info
   const setupProcesses = useMemo(() => {
```

**File**: `packages/web-core/src/shared/providers/ExecutionProcessesProvider.tsx` (modified, +25/-23)
```diff
@@ -1,7 +1,10 @@
-import React, { useEffect, useMemo } from 'react';
+import React, { useMemo } from 'react';
 import { useExecutionProcesses } from '@/shared/hooks/useExecutionProcesses';
 import type { ExecutionProcess } from 'shared/types';
-import { useExecutionProcessesStore } from '@/shared/stores/useExecutionProcessesStore';
+import {
+  ExecutionProcessesContext,
+  type ExecutionProcessesContextType,
+} from '@/shared/hooks/useExecutionProcessesContext';
 
 export const ExecutionProcessesProvider: React.FC<{
   sessionId?: string | undefined;
@@ -38,8 +41,8 @@ export const ExecutionProcessesProvider: React.FC<{
     [visible]
   );
 
-  useEffect(() => {
-    useExecutionProcessesStore.getState().setExecutionProcessesData({
+  const value = useMemo<ExecutionProcessesContextType>(
+    () => ({
       executionProcessesAll: executionProcesses,
       executionProcessesByIdAll: executionProcessesById,
       isAttemptRunningAll: isAttemptRunning,
@@ -49,24 +52,23 @@ export const ExecutionProcessesProvider: React.FC<{
       isLoading,
       isConnected,
       error,
-    });
-  }, [
-    executionProcesses,
-    executionProcessesById,
-    isAttemptRunning,
-    visible,
-    executionProcessesByIdVisible,
-    isAttemptRunningVisible,
-    isLoading,
-    isConnected,
-    error,
-  ]);
-
-  useEffect(() => {
-    return () => {
-      useExecutionProcessesStore.getState().clearExecutionProcessesData();
-    };
-  }, []);
+    }),
+    [
+      executionProcesses,
+      executionProcessesById,
+      isAttemptRunning,
+      visible,
+      executionProcessesByIdVisible,
+      isAttemptRunningVisible,
+      isLoading,
+      isConnected,
+      error,
+    ]
+  );
 
-  return <>{children}</>;
+  return (
+    <ExecutionProcessesContext.Provider value={value}>
+      {children}
+    </ExecutionProcessesContext.Provider>
+  );
 };
```

---

### Incident Patch 11: `552fe226` (2026-04-01)
**Commit Message**: fix: clear execution processes store on session change to fix conversation history load (#3311)

The Zustand store retained stale data when switching workspaces because
the cleanup effect only ran on unmount (empty deps). Since React runs
child effects before parent effects, ConversationList would read stale
isLoading=false from the store and prematurely set loadedInitialEntries,
preventing the actual history from loading. Adding sessionId to the
dependency array ensures the store is cleared during the cleanup phase
before any child setup effects read from it.



debug: add console logs to trace conversation history load on workspace switch

Adds [EPP], [CH], [CLC] prefixed logs to trace the execution processes
store writes, conversation history load effect decisions, and empty state
rendering to diagnose why switching workspaces shows empty conversation.



Cleanup script changes for workspace 1e47a3e4-b64b-490e-a507-d9c6e59ebbb6

fix: don't block conversation history reload after empty-initial emit

When switching workspaces, selectedSessionId transitions through
undefined before settling on the new session. During this transitional
state, useExecutionProcesses returns isLoading=

**File**: `packages/web-core/src/features/workspace-chat/model/hooks/useConversationHistory.ts` (modified, +1/-2)
```diff
@@ -400,16 +400,15 @@ export const useConversationHistory = ({
       if (executionProcesses.current.length === 0) {
         if (emittedEmptyInitialRef.current) return;
         emittedEmptyInitialRef.current = true;
-        loadedInitialEntries.current = true;
         emitEntries(displayedExecutionProcesses.current, 'initial', false);
         return;
       }
 
       emittedEmptyInitialRef.current = false;
-      loadedInitialEntries.current = true;
 
       const allInitialEntries = await loadHistoricEntries(MIN_INITIAL_ENTRIES);
       if (cancelled) return;
+      loadedInitialEntries.current = true;
       mergeIntoDisplayed((state) => {
         Object.assign(state, allInitialEntries);
       });
```

---

### Incident Patch 12: `1c319f06` (2026-04-01)
**Commit Message**: fix: use portable worker bundle to fix diff tab in prod builds (#3309)

The worker file `@pierre/diffs/worker/worker.js` has bare module
specifiers (shiki, diff, @shikijs/transformers) that require a bundler
to resolve. Vite only bundles workers when it sees the exact pattern
`new Worker(new URL(...), ...)`, but the code stored the URL in a
variable first, so Vite emitted the file as a static asset without
bundling its dependencies. Browsers cannot resolve bare specifiers in
module workers, causing immediate worker errors and leaving all diff
shadow roots empty.

Switch to `worker-portable.js` which is the pre-bundled variant with
all dependencies inlined (0 bare imports, ~490KB self-contained).

Co-authored-by: Claude Opus 4.6 (1M context) <[REDACTED_EMAIL]>

**File**: `packages/web-core/src/pages/workspaces/ChangesPanelContainer.tsx` (modified, +4/-2)
```diff
@@ -12,8 +12,10 @@ import {
   WorkerPoolContextProvider,
 } from '@pierre/diffs/react';
 import type { DiffLineAnnotation, AnnotationSide } from '@pierre/diffs';
-const WorkerUrl = new URL('@pierre/diffs/worker/worker.js', import.meta.url)
-  .href;
+const WorkerUrl = new URL(
+  '@pierre/diffs/worker/worker-portable.js',
+  import.meta.url
+).href;
 import { sortDiffs } from '@/shared/lib/fileTreeUtils';
 import { useChangesView } from '@/shared/hooks/useChangesView';
 import { useScrollSyncStateMachine } from '@/shared/hooks/useScrollSyncStateMachine';
```

---

### Incident Patch 13: `3ae51583` (2026-03-31)
**Commit Message**: fix: emit git-diff format from concatenate_diff_hunks to prevent PatchDiff crash (#3307)

Pierre's PatchDiff splits unified-format patches on /^---\s+\S/gm to
find file boundaries. This collides with deleted lines whose original
content starts with "-- " (e.g. SQL comments), causing
"FileDiff: Provided patch must contain exactly 1 file diff" errors.

Prepend `diff --git a/<path> b/<path>` to the header so Pierre uses
/^diff --git/gm instead, which is unambiguous.

Co-authored-by: Claude Opus 4.6 (1M context) <[REDACTED_EMAIL]>

**File**: `crates/utils/src/diff.rs` (modified, +7/-2)
```diff
@@ -190,11 +190,16 @@ fn fix_hunk_headers(hunks: Vec<String>) -> Vec<String> {
     new_hunks
 }
 
-/// Creates a full unified diff with the file path in the header,
+/// Creates a full unified diff with the file path in the header.
+///
+/// Outputs git-diff format (`diff --git` prefix) so that downstream parsers
+/// (e.g. @pierre/diffs) split on `^diff --git` boundaries instead of
+/// `^---\s+\S`, which collides with deleted lines starting with `-- `.
 pub fn concatenate_diff_hunks(file_path: &str, hunks: &[String]) -> String {
     let mut unified_diff = String::new();
 
-    let header = format!("--- a/{file_path}\n+++ b/{file_path}\n");
+    let header =
+        format!("diff --git a/{file_path} b/{file_path}\n--- a/{file_path}\n+++ b/{file_path}\n");
 
     unified_diff.push_str(&header);
 
```

---

### Incident Patch 14: `f6ca6a5c` (2026-03-31)
**Commit Message**: fix: copy patches/ directory in Dockerfile fe-builder stage (#3301)

pnpm requires patch files referenced in pnpm-lock.yaml to be present
during install. The patches/ dir was not copied, causing the build to
fail with ENOENT on @[REDACTED_EMAIL].

Fixes #3300

Co-authored-by: Claude Code <[REDACTED_EMAIL]>
Co-authored-by: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `crates/remote/Dockerfile` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@ COPY packages/local-web/package.json packages/local-web/package.json
 COPY packages/remote-web/package.json packages/remote-web/package.json
 COPY packages/ui/package.json packages/ui/package.json
 COPY packages/web-core/package.json packages/web-core/package.json
+COPY patches/ patches/
 
 RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
     pnpm install --frozen-lockfile
```

---

### Incident Patch 15: `83621868` (2026-03-30)
**Commit Message**: Add notification click handling for Windows, macOS, and Linux (Vibe Kanban) (#3217)

* Navigate to relevant page when user clicks OS notification on macOS

Use native UNUserNotificationCenter via objc2-user-notifications to handle
notification click events on macOS, bypassing tauri-plugin-notification which
has no desktop click support. A UNUserNotificationCenterDelegate receives the
click callback with the deeplinkPath stored in userInfo, then emits a Tauri
event so the frontend can navigate to the relevant issue or workspace.

Co-Authored-By: Claude Opus 4.6 <[REDACTED_EMAIL]>

* Fix compilation errors in macOS notification module

Replace static LazyLock<Retained<UNUserNotificationCenter>> with an
on-demand center() function to avoid Send/Sync requirements. Fix clippy
warnings (collapsible if, explicit auto-deref, needless return) and gate
unused imports behind cfg(not(target_os = "macos")).

Co-Authored-By: Claude Opus 4.6 <[REDACTED_EMAIL]>

* Gracefully skip native notifications in dev mode (no app bundle)

UNUserNotificationCenter crashes with NSInternalInconsistencyException
when the binary runs outside a proper .app bundle (e.g. cargo-tauri dev).
Check for a valid bundle i

**File**: `Cargo.lock` (modified, +201/-140)
```diff
@@ -33,7 +33,7 @@ version = "0.5.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "d122413f284cf2d62fb1b7db97e02edb8cda96d769b16e443a4f6195e35662b0"
 dependencies = [
- "crypto-common 0.1.6",
+ "crypto-common 0.1.7",
  "generic-array",
 ]
 
@@ -45,7 +45,7 @@ checksum = "b169f7a6d4742236a0a00c541b845991d0ac43e546831af1249753ab4c3aa3a0"
 dependencies = [
  "cfg-if",
  "cipher",
- "cpufeatures",
+ "cpufeatures 0.2.17",
 ]
 
 [[package]]
@@ -277,9 +277,9 @@ dependencies = [
 
 [[package]]
 name = "arc-swap"
-version = "1.8.2"
+version = "1.9.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f9f3647c145568cec02c42054e07bdf9a5a698e15b466fb2341bfc393cd24aa5"
+checksum = "a07d1f37ff60921c83bdfc7407723bdefe89b44b98a9b772f225c8f9d67141a6"
 dependencies = [
  "rustversion",
 ]
@@ -999,9 +999,9 @@ dependencies = [
 
 [[package]]
 name = "cc"
-version = "1.2.57"
+version = "1.2.58"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7a0dd1ca384932ff3641c8718a02769f1698e7563dc6974ffd03346116310423"
+checksum = "e1e928d4b69e3077709075a938a05ffbedfa53a84c8f766efbf8220bb1ff60e1"
 dependencies = [
  "find-msvc-tools",
  "jobserver",
@@ -1083,7 +1083,7 @@ checksum = "c3613f74bd2eac03dad61bd53dbe620703d4371614fe0bc3b9f04dd36fe4e818"
 dependencies = [
  "cfg-if",
  "cipher",
- "cpufeatures",
+ "cpufeatures 0.2.17",
 ]
 
 [[package]]
@@ -1106,7 +1106,7 @@ version = "0.4.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "773f3b9af64447d2ce9850330c473515014aa235e6a783b02db81ff39e4a3dad"
 dependencies = [
- "crypto-common 0.1.6",
+ "crypto-common 0.1.7",
  "inout",
 ]
 
@@ -1176,9 +1176,9 @@ dependencies = [
 
 [[package]]
 name = "cmake"
-version = "0.1.57"
+version = "0.1.58"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "75443c44cd6b379beb8c5b45d85d0773baf31cce901fe7bb252f4eff3008ef7d"
+checksum = "c0f78a02292a74a88ac736019ab962ece0bc380e3f977bf72e376c5d78ff0678"
 dependencies = [
  "cc",
 ]
@@ -1502,6 +1502,15 @@ dependencies = [
  "libc",
 ]
 
+[[package]]
+name = "cpufeatures"
+version = "0.3.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "8b2a41393f66f16b0823bb79094d54ac5fbd34ab292ddafb9a0456ac9f87d201"
+dependencies = [
+ "libc",
+]
+
 [[package]]
 name = "crc"
 version = "3.4.0"
@@ -1589,9 +1598,9 @@ dependencies = [
 
 [[package]]
 name = "crypto-common"
-version = "0.1.6"
+version = "0.1.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1bfb12502f3fc46cca1bb51ac28df9d618d813cdc3d2f25b9fe775a34af26bb3"
+checksum = "78c8292055d1c1df0cce5d180393dc8cce0abec0a7102adb6c7b1eef6016d60a"
 dependencies = [
  "generic-array",
  "rand_core 0.6.4",
@@ -1692,7 +1701,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "97fb8b7c4503de7d6ae7b42ab72a5a59857b4c937ec27a3d4539dba95b5ab2be"
 dependencies = [
  "cfg-if",
- "cpufeatures",
+ "cpufeatures 0.2.17",
  "curve25519-dalek-derive",
  "digest 0.10.7",
  "fiat-crypto 0.2.9",
@@ -1708,7 +1717,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "335f1947f241137a14106b6f5acc5918a5ede29c9d71d3f2cb1678d5075d9fc3"
 dependencies = [
  "cfg-if",
- "cpufeatures",
+ "cpufeatures 0.2.17",
  "curve25519-dalek-derive",
  "fiat-crypto 0.3.0",
  "rand_core 0.10.0",
@@ -2026,15 +2035,15 @@ checksum = "9ed9a281f7bc9b7576e61468ba615a66a5c8cfdff42420a70aa82701a3b1e292"
 dependencies = [
  "block-buffer 0.10.4",
  "const-oid",
- "crypto-common 0.1.6",
+ "crypto-common 0.1.7",
  "subtle",
 ]
 
 [[package]]
 name = "digest"
-version = "0.11.1"
+version = "0.11.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "285743a676ccb6b3e116bc14cc69319b957867930ae9c4822f8e0f54509d7243"
+checksum = "4850db49bf08e663084f7fb5c87d202ef91a3907271aff24a94eb97ff039153c"
 dependencies = [
  "block-buffer 0.12.0",
  "crypto-common 0.2.1",
@@ -2171,17 +2180,17 @@ dependencies = [
 
 [[package]]
 name = "dom_query"
-version = "0.25.1"
+version = "0.27.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "4d9c2e7f1d22d0f2ce07626d259b8a55f4a47cb0938d4006dd8ae037f17d585e"
+checksum = "521e380c0c8afb8d9a1e83a1822ee03556fc3e3e7dbc1fd30be14e37f9cb3f89"
 dependencies = [
  "bit-set 0.8.0",
  "cssparser 0.36.0",
  "foldhash 0.2.0",
- "html5ever 0.36.1",
+ "html5ever 0.38.0",
  "precomputed-hash",
- "selectors 0.35.0",
- "tendril",
+ "selectors 0.36.1",
+ "tendril 0.5.0",
 ]
 
 [[package]]
@@ -2329,9 +2338,9 @@ dependencies = [
 
 [[package]]
 name = "embed-resource"
-version = "3.0.7"
+version = "3.0.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "47ec73ddcf6b7f23173d5c3c5a32b5507dc0a734de7730aa14abc5d5e296bb5f"
+checksum = "63a1d0de4f2249aa0ff5884d7080814f446bb241a559af6c170a41e878ed2d45"
 dependencies = [
  "cc",
  "memchr",
@@ -3061,9 +3070,9 @@ dependencies = [
 
 [[pa
```

**File**: `crates/server-info/Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "server-info"
-version = "0.1.33"
+version = "0.1.36"
 edition = "2024"
 
 [dependencies]
```

**File**: `crates/tauri-app/Cargo.toml` (modified, +9/-1)
```diff
@@ -33,6 +33,14 @@ arboard = "3.6.1"
 
 [target.'cfg(target_os = "macos")'.dependencies]
 objc2 = "0.6"
-objc2-foundation = { version = "0.3", features = ["NSString"] }
+objc2-foundation = { version = "0.3", features = ["NSString", "NSBundle", "NSDictionary", "NSError", "NSKeyValueCoding"] }
 objc2-web-kit = { version = "0.3", features = ["WKWebView"] }
 tauri-plugin-macos-fps = "0.1"
+objc2-user-notifications = "0.3"
+block2 = "0.6"
+
+[target.'cfg(target_os = "windows")'.dependencies]
+tauri-winrt-notification = "0.7"
+
+[target.'cfg(target_os = "linux")'.dependencies]
+notify-rust = "4"
```

**File**: `crates/tauri-app/src/linux_notifications.rs` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+//! Linux notification system using `notify-rust`.
+//!
+//! Bypasses `tauri-plugin-notification` (which has no desktop click handling)
+//! and uses `notify-rust` directly with the D-Bus `ActionInvoked` signal.
+//! A `"default"` action is registered so clicking the notification body
+//! triggers the callback, which emits a Tauri event for frontend navigation.
+
+use std::sync::OnceLock;
+
+use notify_rust::Notification;
+use tauri::{Emitter, Manager};
+
+/// Global app handle so the click callback can emit events.
+static APP_HANDLE: OnceLock<tauri::AppHandle> = OnceLock::new();
+
+pub fn initialize(app_handle: tauri::AppHandle) {
+    let _ = APP_HANDLE.set(app_handle);
+}
+
+pub fn is_available() -> bool {
+    APP_HANDLE.get().is_some()
+}
+
+pub fn show_notification(title: &str, body: &str, deeplink_path: Option<&str>) {
+    let path = deeplink_path.map(|s| s.to_string());
+    let title = title.to_string();
+    let body = body.to_string();
+
+    // `wait_for_action` blocks until the user interacts with the notification,
+    // so we spawn a dedicated thread for each notification.
+    std::thread::spawn(move || {
+        let handle = Notification::new()
+            .summary(&title)
+            .body(&body)
+            .action("default", "default")
+            .show();
+
+        match handle {
+            Ok(handle) => {
+                handle.wait_for_action(|action| {
+                    if action == "default"
+                        && let Some(app) = APP_HANDLE.get()
+                    {
+                        if let Some(window) = app.get_webview_window("main") {
+                            let _ = window.show();
+                            let _ = window.set_focus();
+                        }
+                        if let Some(ref p) = path {
+                            let _ = app.emit(
+                                "notification-clicked",
+                                serde_json::json!({ "deeplinkPath": p }),
+                            );
+                        }
+                    }
+                });
+            }
+            Err(e) => tracing::warn!("Failed to show Linux notification: {e}"),
+        }
+    });
+}
```

**File**: `crates/tauri-app/src/macos_notifications.rs` (added, +232/-0)
```diff
@@ -0,0 +1,232 @@
+//! macOS-native notification system using `UNUserNotificationCenter`.
+//!
+//! Bypasses `tauri-plugin-notification` (which has no desktop click handling)
+//! and uses the native UserNotifications framework directly. A
+//! `UNUserNotificationCenterDelegate` receives click callbacks with the
+//! `deeplinkPath` stored in `userInfo`, then emits a Tauri event so the
+//! frontend can navigate.
+
+use std::sync::{
+    Once, OnceLock,
+    atomic::{AtomicBool, Ordering},
+};
+
+use block2::RcBlock;
+use objc2::{
+    AllocAnyThread, define_class, msg_send,
+    rc::Retained,
+    runtime::{Bool, NSObject, NSObjectProtocol, ProtocolObject},
+};
+use objc2_foundation::{NSBundle, NSDictionary, NSError, NSString, ns_string};
+use objc2_user_notifications::{
+    UNAuthorizationOptions, UNMutableNotificationContent, UNNotification,
+    UNNotificationPresentationOptions, UNNotificationRequest, UNNotificationResponse,
+    UNNotificationSound, UNUserNotificationCenter, UNUserNotificationCenterDelegate,
+};
+use tauri::{Emitter, Manager};
+
+/// Global app handle so the delegate can emit events and show the window.
+static APP_HANDLE: OnceLock<tauri::AppHandle> = OnceLock::new();
+
+/// Whether native notifications are available (requires a proper app bundle).
+/// False in dev mode where the binary runs outside a .app bundle.
+static AVAILABLE: AtomicBool = AtomicBool::new(false);
+
+/// Returns the shared `UNUserNotificationCenter` singleton.
+/// Called on-demand rather than stored in a static because
+/// `Retained<UNUserNotificationCenter>` is not `Send + Sync`.
+///
+/// # Panics
+/// Panics if called without a valid app bundle — always check `AVAILABLE` first.
+fn center() -> Retained<UNUserNotificationCenter> {
+    UNUserNotificationCenter::currentNotificationCenter()
+}
+
+// ---------------------------------------------------------------------------
+// Delegate
+// ---------------------------------------------------------------------------
+
+define_class!(
+    #[unsafe(super = NSObject)]
+    #[name = "VKNotifDelegate"]
+    #[derive(Debug)]
+    struct VKNotifDelegate;
+
+    unsafe impl NSObjectProtocol for VKNotifDelegate {}
+
+    unsafe impl UNUserNotificationCenterDelegate for VKNotifDelegate {
+        /// Called when a notification arrives while the app is in the foreground.
+        /// We ask the system to still show it as a banner + in Notification Center.
+        #[unsafe(method(userNotificationCenter:willPresentNotification:withCompletionHandler:))]
+        unsafe fn will_present(
+            &self,
+            _center: &UNUserNotificationCenter,
+            _notification: &UNNotification,
+            completion_handler: &block2::Block<dyn Fn(UNNotificationPresentationOptions)>,
+        ) {
+            let options = UNNotificationPresentationOptions::List
+                | UNNotificationPresentationOptions::Sound
+                | UNNotificationPresentationOptions::Banner;
+            completion_handler.call((options,));
+        }
+
+        /// Called when the user **clicks** a notification (the actual click event).
+        /// Extracts `deeplinkPath` from `userInfo` and emits a Tauri event.
+        #[unsafe(method(userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:))]
+        unsafe fn did_receive_notification(
+            &self,
+            _center: &UNUserNotificationCenter,
+            response: &UNNotificationResponse,
+            completion_handler: &block2::Block<dyn Fn()>,
+        ) {
+            // Always show/focus the window when a notification is clicked.
+            if let Some(handle) = APP_HANDLE.get() {
+                if let Some(window) = handle.get_webview_window("main") {
+                    let _ = window.show();
+                    let _ = window.set_focus();
+                }
+
+                // If the notification carries a deeplink path, emit an event
+                // so the frontend can navigate to the relevant page.
+                let user_info = response.notification().request().content().userInfo();
+                let deeplink = user_info.valueForKey(ns_string!("deeplinkPath"));
+
+                if let Some(value) = deeplink
+                    && let Ok(path) = value.downcast::<NSString>()
+                {
+                    let path_str = path.to_string();
+                    tracing::info!("Notification clicked, navigating to {path_str}");
+                    let _ = handle.emit(
+                        "notification-clicked",
+                        serde_json::json!({ "deeplinkPath": path_str }),
+                    );
+                }
+            }
+
+            completion_handler.call(());
+        }
+    }
+);
+
+impl VKNotifDelegate {
+    fn new() -> Retained<Self> {
+        let this = Self::alloc().set_ivars(());
+        unsafe { msg_send![super(this), init] }
+    }
+}
+
+// ---------------------------------------------------------------------------
+/
```

**File**: `crates/tauri-app/src/main.rs` (modified, +60/-11)
```diff
@@ -25,15 +25,54 @@ use uuid::Uuid;
 
 const UPDATE_CHECK_INTERVAL: Duration = Duration::from_secs(60 * 60);
 
-/// Native push notifier using Tauri's notification plugin.
-/// Emits a `navigate-to-workspace` event so the frontend can navigate to the
-/// relevant workspace when the user clicks the notification and the app activates.
+#[cfg(target_os = "linux")]
+mod linux_notifications;
+#[cfg(target_os = "macos")]
+mod macos_notifications;
+#[cfg(target_os = "windows")]
+mod windows_notifications;
+
+/// Native push notifier for backend-initiated notifications.
+/// Uses platform-native APIs with click handling where available,
+/// falls back to `tauri-plugin-notification` otherwise.
 struct TauriNotifier {
     app_handle: tauri::AppHandle,
 }
 
+/// Whether platform-native notifications with click handling are available.
+fn use_native_notifications() -> bool {
+    #[cfg(target_os = "macos")]
+    return macos_notifications::is_available();
+    #[cfg(target_os = "windows")]
+    return windows_notifications::is_available();
+    #[cfg(target_os = "linux")]
+    return linux_notifications::is_available();
+    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
+    false
+}
+
+/// Show a notification using the platform-native API (with click handling).
+fn show_native_notification(title: &str, body: &str, deeplink_path: Option<&str>) {
+    #[cfg(target_os = "macos")]
+    macos_notifications::show_notification(title, body, deeplink_path);
+    #[cfg(target_os = "windows")]
+    windows_notifications::show_notification(title, body, deeplink_path);
+    #[cfg(target_os = "linux")]
+    linux_notifications::show_notification(title, body, deeplink_path);
+}
+
 #[tauri::command]
-async fn show_system_notification(title: String, body: String) -> Result<(), String> {
+async fn show_system_notification(
+    title: String,
+    body: String,
+    deeplink_path: Option<String>,
+) -> Result<(), String> {
+    if use_native_notifications() {
+        show_native_notification(&title, &body, deeplink_path.as_deref());
+        return Ok(());
+    }
+
+    // Fallback: generic NotificationService (e.g. macOS dev mode).
     let config = load_config_from_file(&config_path()).await;
     let notification_service = NotificationService::new(Arc::new(tokio::sync::RwLock::new(config)));
     notification_service.notify(&title, &body, None).await;
@@ -49,6 +88,14 @@ fn read_clipboard_text() -> Result<String, String> {
 #[async_trait]
 impl PushNotifier for TauriNotifier {
     async fn send(&self, title: &str, message: &str, workspace_id: Option<Uuid>) {
+        let deeplink_path = workspace_id.map(|id| format!("/workspaces/{id}"));
+
+        if use_native_notifications() {
+            show_native_notification(title, message, deeplink_path.as_deref());
+            return;
+        }
+
+        // Fallback: tauri-plugin-notification (no click handling).
         if let Err(e) = self
             .app_handle
             .notification()
@@ -59,13 +106,6 @@ impl PushNotifier for TauriNotifier {
         {
             tracing::warn!("Failed to send Tauri notification: {}", e);
         }
-
-        if let Some(id) = workspace_id {
-            let _ = self.app_handle.emit(
-                "navigate-to-workspace",
-                serde_json::json!({ "workspaceId": id.to_string() }),
-            );
-        }
     }
 }
 
@@ -124,6 +164,15 @@ fn main() {
 
     builder
         .setup(move |app| {
+            // Initialize platform-native notifications (request permission,
+            // install click-handling delegates) before anything else.
+            #[cfg(target_os = "macos")]
+            macos_notifications::initialize(app.handle().clone());
+            #[cfg(target_os = "windows")]
+            windows_notifications::initialize(app.handle().clone());
+            #[cfg(target_os = "linux")]
+            linux_notifications::initialize(app.handle().clone());
+
             if cfg!(debug_assertions) {
                 // Dev mode: frontend dev server (Vite) and backend are started
                 // externally. Use WebviewUrl::External so that macOS WKWebView
```

**File**: `crates/tauri-app/src/windows_notifications.rs` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+//! Windows notification system using `tauri-winrt-notification`.
+//!
+//! Bypasses `tauri-plugin-notification` (which has no desktop click handling)
+//! and uses WinRT toast notifications directly. The `on_activated` callback
+//! fires when the user clicks the notification body, then emits a Tauri event
+//! so the frontend can navigate.
+
+use std::sync::OnceLock;
+
+use tauri::{Emitter, Manager};
+use tauri_winrt_notification::Toast;
+
+/// Global app handle so the `on_activated` callback can emit events.
+static APP_HANDLE: OnceLock<tauri::AppHandle> = OnceLock::new();
+
+/// App User Model ID used for toast notifications.
+/// Must match the identifier in `tauri.conf.json` for production builds.
+/// Falls back to PowerShell's AUMID in dev builds (where the app isn't
+/// installed and has no registered AUMID).
+fn app_id() -> &'static str {
+    if cfg!(debug_assertions) {
+        Toast::POWERSHELL_APP_ID
+    } else {
+        "ai.bloop.vibe-kanban"
+    }
+}
+
+pub fn initialize(app_handle: tauri::AppHandle) {
+    let _ = APP_HANDLE.set(app_handle);
+}
+
+pub fn is_available() -> bool {
+    APP_HANDLE.get().is_some()
+}
+
+pub fn show_notification(title: &str, body: &str, deeplink_path: Option<&str>) {
+    let path = deeplink_path.map(|s| s.to_string());
+
+    let result = Toast::new(app_id())
+        .title(title)
+        .text1(body)
+        .on_activated(move |_action| {
+            if let Some(handle) = APP_HANDLE.get() {
+                if let Some(window) = handle.get_webview_window("main") {
+                    let _ = window.show();
+                    let _ = window.set_focus();
+                }
+                if let Some(ref p) = path {
+                    let _ = handle.emit(
+                        "notification-clicked",
+                        serde_json::json!({ "deeplinkPath": p }),
+                    );
+                }
+            }
+            Ok(())
+        })
+        .show();
+
+    if let Err(e) = result {
+        tracing::warn!("Failed to show Windows notification: {e}");
+    }
+}
```

**File**: `packages/local-web/src/app/hooks/useTauriNotificationNavigation.ts` (modified, +31/-6)
```diff
@@ -1,10 +1,35 @@
+import { useEffect } from 'react';
+import { isTauriApp } from '@/shared/lib/platform';
+import { router } from '@web/app/router';
+
 /**
- * Listens for `navigate-to-workspace` events emitted by the Tauri backend
- * when a notification fires.
- *
- * Auto-navigation is temporarily disabled — the user handles navigation
- * manually for now.
+ * Listens for `notification-clicked` events emitted by the macOS native
+ * notification delegate when the user clicks an OS notification.
+ * Navigates to the `deeplinkPath` carried in the event payload.
  */
 export function useTauriNotificationNavigation() {
-  // noop — auto-navigation disabled for now
+  useEffect(() => {
+    if (!isTauriApp()) return;
+
+    let unlisten: (() => void) | undefined;
+
+    async function setup() {
+      const { listen } = await import('@tauri-apps/api/event');
+
+      unlisten = await listen<{ deeplinkPath: string }>(
+        'notification-clicked',
+        (event) => {
+          const path = event.payload.deeplinkPath;
+          if (path) {
+            router.navigate({ to: path as '/' });
+          }
+        }
+      );
+    }
+
+    setup();
+    return () => {
+      unlisten?.();
+    };
+  }, []);
 }
```

#### Recent Merged Pull Requests:
- **PR #3475** (closed): fix: copy patches/ before pnpm install in root Dockerfile (@oJaqob)
- **PR #3467** (closed): feat: add pi (pi-acp) executor support with model and thinking selection (@ball6847)
- **PR #3464** (2026-09-19): fix: Tanstack router api fix (@anastasiya1155)
- **PR #3462** (2026-09-19): chore: bump version to 0.1.45 (@anastasiya1155)
- **PR #3460** (2026-09-18): chore: pnpm audit fixes (@anastasiya1155)
- **PR #3459** (2026-09-18): fix: an Enter that confirms an IME candidate is not an Enter (@isamu)
- **PR #3457** (2026-09-16): Add script to bump version locally (@anastasiya1155)
- **PR #3456** (2026-09-17): Coalesce replayed stderr chunks so stored sessions load in linear time (@bornasamadi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
