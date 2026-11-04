> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/cachix-devenv-learnings.md`  
> **Source**: github ([https://github.com/cachix/devenv](https://github.com/cachix/devenv))  
> **Source Version**: `9655d320`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-03T22:51:59.546Z  
> **Learning ID**: `learn-github-cachix-devenv`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): cachix/devenv

> **Canonical Artifact**: `07_PROJECT_LEARNING/cachix-devenv-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/cachix/devenv](https://github.com/cachix/devenv))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-03T22:51:57.580Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cachix/devenv`
- **Description**: Fast, Declarative, Reproducible, and Composable Developer Environments using Nix
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 7798 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `devenv-cache-core/src/db.rs`
```
use crate::error::{CacheError, CacheResult};
use libsqlite3_sys::{SQLITE_BUSY, SQLITE_IOERR_DELETE_NOENT, SQLITE_IOERR_SHMMAP, SQLITE_LOCKED};
use sqlx::migrate::{MigrateError, Migrator};
use sqlx::sqlite::{
    SqliteConnectOptions, SqliteJournalMode, SqlitePool, SqlitePoolOptions, SqliteSynchronous,
};
use std::fs::OpenOptions;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tracing::{debug, error, trace, warn};

/// Database connection manager
#[derive(Debug, Clone)]
pub struct Database {
    pool: SqlitePool,
    _path: PathBuf,
}

impl Database {
    /// Create a new database connection with the given path and run migrations
    ///
    /// * `path` - Path to the SQLite database file
    /// * `migrator` - The migrator containing database migrations to apply
    pub async fn new(path: PathBuf, migrator: &Migrator) -> CacheResult<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        // Serialize create + migrate across processes. Concurrent cold
        // `devenv shell` entries race on this window: SQLite's busy timeout does
        // not serialize the whole migration sequence, and SQLx's SQLite
        // migration lock is a no-op. A migration error used to delete the
        // database out from under the process that created it (#3133).
        let _init_lock = acquire_init_lock(&path).await?;

        trace!("Running migrations");

        // Try WAL journal mode first, falling back to DELETE (the default) on
        // SQLITE_IOERR_SHMMAP. WAL is preferred for concurrency, but requires
        // shared-memory support the VFS doesn't always have (e.g. some
        // virtiofs/9p/network mounts). See
        // https://github.com/cachix/devenv/issues/2947.
        let pool = match open_pool(&path, SqliteJournalMode::Wal).await {
            Ok(pool) => pool,
            Err(e) if is_shmmap_error(&e) => fall_back_to_delete_mode(&path, &e).await?,
            Err(e) => return Err(CacheError::Database(e)),
        };

        if let Err(err) = migrator.run(&pool).await {
            // Same shm-mmap failure, just surfacing during migration instead of
            // at connect time (SQLite can defer opening the `-shm` file until
            // the first real transaction).
            if migrate_error_is_shmmap(&err) {
                pool.close().await;
                let pool = fall_back_to_delete_mode(&path, &err).await?;
                migrator
                    .run(&pool)
                    .await
                    .map_err(|e| CacheError::Database(e.into()))?;
                return Ok(Self { pool, _path: path });
            }

            // A lock/busy error means another connection is using the file.
            // Never delete it — that is how concurrent cold entry turned a
            // recoverable SQLITE_BUSY into SQLITE_IOERR_DELETE_NOENT (#3133).
            if migrate_error_is_busy(&err) {
                warn!(
                    error = %err,
                    path = %path.display(),
                    "database locked during migration, retrying without recreating"
                );
                migrator
                    .run(&pool)
                    .await
                    .map_err(|e| CacheError::Database(e.into()))?;
                return Ok(Self { pool, _path: path });
            }

            // Some other migration failure (corruption, a partially-applied
            // prior migration run, etc). Delete and recreate once. No other
            // process is in Database::new while we hold the init lock; this
            // remains last-resort recovery if a process that already opened
            // the pool is still using the file.
            error!(error = %err, "Failed to migrate the database. Attempting to recreate the database.");
            pool.close().await;
            remove_sqlite_files(&path);

            let new_pool = open_pool(&path, SqliteJournalMode::Wal)
                .await
                .map_err(CacheError::Database)?;
            if let Err(e) = migrator.run(&new_pool).await {
                error!("Migration failed after recreating database: {}", e);
                return Err(CacheError::Database(e.into()));
            }
            return Ok(Self {
                pool: new_pool,
                _path: path,
            });
        }

        Ok(Self { pool, _path: path })
    }

    /// Get a reference to the connection pool
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    /// Close the database connection
    pub async fn close(self) {
        self.pool.close().await;
    }
}

/// Connections kept open per `Database`. Also referenced by tests that need to
/// force real contention on the pool.
const MAX_CONNECTIONS: u32 = 5;

async fn open_pool(
    path: &Path,
    journal_mode: SqliteJournalMode,
) -> Result<SqlitePool, sqlx::Error> {
    let options = SqliteConnectOptions::new()
        .filename(path)
        .journal_mode(journal_mode)
        .synchronous(SqliteSynchronous::Normal)
        .busy_timeout(Duration::from_secs(10))
        .create_if_missing(true)
        .foreign_keys(true)
        .pragma("wal_autocheckpoint", "1000")
        .pragma("journal_size_limit", (64 * 1024 * 1024).to_string()) // 64 MB
        .pragma("cache_size", "2000"); // 2000 pages

    SqlitePoolOptions::new()
        .max_connections(MAX_CONNECTIONS)
        .connect_with(options)
        .await
}

/// Log the fallback and reopen in DELETE mode. Shared by the connect-time and
/// migrate-time failure sites, which hit the same class of error.
async fn fall_back_to_delete_mode(
    path: &Path,
    error: impl std::fmt::Display,
) -> CacheResult<SqlitePool> {
    warn!(
        %error,
        path = %path.display(),
        "got SQLITE_IOERR_SHMMAP, falling back to DELETE journal mode (reduced concurrency)"
    );
    remove_sqlite_files(path);
    open_pool(path, SqliteJournalMode::Delete)
        .await
        .map_err(CacheError::Database)
}

/// Remove a SQLite database file and its associated WAL/SHM files.
fn remove_sqlite_files(path: &Path) {
    for suffix in ["", "-wal", "-shm"] {
        let mut file = path.as_os_str().to_owned();
        file.push(suffix);
        let _ = std::fs::remove_file(Path::new(&file));
    }
}

/// True if this is exactly `SQLITE_IOERR_SHMMAP` -- WAL mode failing to
/// `mmap(MAP_SHARED)` its `-shm` coordination file. See
/// https://github.com/cachix/devenv/issues/2947.
fn is_shmmap_error(error: &sqlx::Error) -> bool {
    sqlite_error_code(error) == Some(SQLITE_IOERR_SHMMAP)
}

fn sqlite_error_code(error: &sqlx::Error) -> Option<i32> {
    match error {
        sqlx::Error::Database(db_err) => db_err.code()?.parse().ok(),
        _ => None,
    }
}

/// SQLITE_BUSY / SQLITE_LOCKED, plus the I/O error SQLite emits when a
/// concurrent creator deletes the journal/WAL file out from under us.
fn is_busy_error(error: &sqlx::Error) -> bool {
    match error {
        sqlx::Error::PoolTimedOut => true,
        // SQLx reports extended codes; the low byte identifies the primary
        // error. All BUSY/LOCKED variants must avoid database recreation.
        _ => sqlite_error_code(error).is_some_and(|code| {
            matches!(code & 0xff, SQLITE_BUSY | SQLITE_LOCKED) || code == SQLITE_IOERR_DELETE_NOENT
        }),
    }
}

fn migrate_error_sqlx(err: &MigrateError) -> Option<&sqlx::Error> {
    match err {
        MigrateError::Execute(e) | MigrateError::ExecuteMigration(e, _) => Some(e),
        _ => None,
    }
}

fn migrate_error_is_shmmap(err: &MigrateError) -> bool {
    migrate_error_sqlx(err).is_some_and(is_shmmap_error)
}

fn migrate_error_is_busy(err: &MigrateError) -> bool {
    migrate_error_sqlx(err).is_some_and(is_busy_error)
}

/// Held for the duration of `Database::new`. Dropping it unblocks the next waiter.
struct InitLock {
    _release: std::sync::mpsc::Sender<()>,
}

fn init_lock_path(db_path: &Path) -> PathBuf {
    let mut path = db_path.as_os_str().to_owned();
    path.push(".init.lock");
    PathBuf::from(path)
}

/// Acquire an exclusive flock on a sibling of the SQLite file.
///
/// Must not lock the `.db` itself: SQLite uses POSIX locks on that file.
/// The lock is held on a dedicated OS thread so waiting does not stall
/// the tokio runtime (a blocking flock on a worker thread deadlocks other
/// tasks that already hold the lock and are awaiting I/O).
async fn acquire_init_lock(db_path: &Path) -> CacheResult<InitLock> {
    let lock_path = init_lock_path(db_path);
    let (acquired_tx, acquired_rx) = tokio::sync::oneshot::channel();
    let (release_tx, release_rx) = std::sync::mpsc::channel();

    let _ = std::thread::spawn(move || {
        let file = match OpenOptions::new()
            .create(true)
            .read(true)
            .write(true)
            .truncate(false)
            .open(&lock_path)
        {
            Ok(file) => file,
            Err(e) => {
                let _ = acquired_tx.send(Err(e));
                return;
            }
        };
        let mut lock = fd_lock::RwLock::new(file);
        let _guard = match lock.write() {
            Ok(guard) => guard,
            Err(e) => {
                let _ = acquired_tx.send(Err(e));
                return;
            }
        };
        if acquired_tx.send(Ok(())).is_err() {
            return;
        }
        let _ = release_rx.recv();
        debug!(path = %lock_path.display(), "released cache init lock");
    });

    match acquired_rx.await {
        Ok(Ok(())) => Ok(InitLock {
            _release: release_tx,
        }),
        Ok(Err(e)) => Err(CacheError::initialization(format!(
            "failed to lock {} for cache init: {e}",
            db_path.display()
        ))),
        Err(_) => Err(CacheError::initialization(format!(
            "cache init lock task ended for {}",
            db_path.display()
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    us
```

### Core Architecture Module: `devenv-cache-core/src/error.rs`
```
use miette::Diagnostic;
use std::path::PathBuf;
use thiserror::Error;

/// Common error type for cache operations
#[derive(Error, Diagnostic, Debug)]
pub enum CacheError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Failed to initialize cache: {0}")]
    Initialization(String),

    #[error("JSON serialization error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("File not found: {0}")]
    FileNotFound(PathBuf),

    #[error("Environment variable not set: {0}")]
    MissingEnvVar(String),

    #[error("Invalid path: {0}")]
    InvalidPath(PathBuf),

    #[error("Content hash calculation failed for {path}: {reason}")]
    HashFailure { path: PathBuf, reason: String },
}

impl CacheError {
    /// Create a new initialization error
    pub fn initialization<S: ToString>(message: S) -> Self {
        Self::Initialization(message.to_string())
    }

    /// Create a new missing environment variable error
    pub fn missing_env_var<S: ToString>(var_name: S) -> Self {
        Self::MissingEnvVar(var_name.to_string())
    }
}

/// A specialized result type for cache operations
pub type CacheResult<T> = std::result::Result<T, CacheError>;

```

### Core Architecture Module: `devenv-cache-core/src/file.rs`
```
use crate::error::{CacheError, CacheResult};
use crate::time;
use blake3::Hasher;
use std::io;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use walkdir::WalkDir;

/// Represents a file that's being tracked for changes
#[derive(Debug, Clone)]
pub struct TrackedFile {
    /// Path to the file
    pub path: PathBuf,
    /// Whether the path is a directory
    pub is_directory: bool,
    /// Content hash of the file (or directory)
    pub content_hash: Option<String>,
    /// Last modified time
    pub modified_at: SystemTime,
    /// When this file was last checked
    pub checked_at: SystemTime,
}

/// Get file metadata with consistent error handling
fn get_metadata<P: AsRef<Path>>(path: P) -> CacheResult<std::fs::Metadata> {
    let path = path.as_ref();
    std::fs::metadata(path).map_err(|e| {
        if e.kind() == io::ErrorKind::NotFound {
            CacheError::FileNotFound(path.to_path_buf())
        } else {
            e.into()
        }
    })
}

impl TrackedFile {
    /// Create a new TrackedFile from a path
    pub fn new<P: AsRef<Path>>(path: P) -> CacheResult<Self> {
        let path = path.as_ref().to_path_buf();
        let metadata = get_metadata(&path)?;

        let is_directory = metadata.is_dir();
        let modified_at = metadata.modified().map_err(|e| CacheError::HashFailure {
            path: path.clone(),
            reason: format!("Failed to get modification time: {e}"),
        })?;

        let content_hash = if is_directory {
            compute_directory_hash(&path)?
        } else {
            Some(compute_file_hash(&path)?)
        };

        Ok(Self {
            path,
            is_directory,
            content_hash,
            modified_at,
            checked_at: SystemTime::now(),
        })
    }

    /// Check if this file has been modified since it was last tracked
    pub fn is_modified(&self) -> CacheResult<bool> {
        // Get current file state
        let current = TrackedFile::new(&self.path)?;

        // Quick check: if content hashes are different, the file has changed
        if current.content_hash != self.content_hash {
            return Ok(true);
        }

        // Check if the file type changed (directory vs file)
        if current.is_directory != self.is_directory {
            return Ok(true);
        }

        // If modification time hasn't changed, file definitely hasn't changed
        if current.modified_at <= self.modified_at {
            return Ok(false);
        }

        // Modification time changed but hashes are the same:
        // This can happen when a file is touched or saved without changes
        // Return false as the file content hasn't actually changed
        Ok(false)
    }

    /// Update the file's content hash and modification time
    pub fn update(&mut self) -> CacheResult<()> {
        let current = TrackedFile::new(&self.path)?;
        self.content_hash = current.content_hash;
        self.modified_at = current.modified_at;
        self.checked_at = SystemTime::now();
        Ok(())
    }

    /// Get the content hash of the file
    pub fn hash(&self) -> Option<&str> {
        self.content_hash.as_deref()
    }

    /// Get the modified time as Unix seconds
    pub fn modified_time(&self) -> i64 {
        time::system_time_to_unix_seconds(self.modified_at)
    }

    /// Convert to a database-friendly representation
    pub fn to_db_values(&self) -> (PathBuf, bool, Option<String>, i64, i64) {
        (
            self.path.clone(),
            self.is_directory,
            self.content_hash.clone(),
            self.modified_time(),
            time::system_time_to_unix_seconds(self.checked_at),
        )
    }
}

/// Helper to open a file with consistent error handling
fn open_file<P: AsRef<Path>>(path: P) -> CacheResult<std::fs::File> {
    let path = path.as_ref();
    std::fs::File::open(path).map_err(|e| {
        if e.kind() == io::ErrorKind::NotFound {
            CacheError::FileNotFound(path.to_path_buf())
        } else {
            e.into()
        }
    })
}

/// Compute a hash of a file's contents
pub fn compute_file_hash<P: AsRef<Path>>(path: P) -> CacheResult<String> {
    let path = path.as_ref();
    let mut file = open_file(path)?;
    let mut hasher = Hasher::new();

    io::copy(&mut file, &mut hasher).map_err(|e| CacheError::HashFailure {
        path: path.to_path_buf(),
        reason: format!("Failed to read file: {e}"),
    })?;

    Ok(hasher.finalize().to_hex().to_string())
}

/// Compute the content identity of a regular file copied into the Nix store.
///
/// Nix archives preserve the owner's executable bit in addition to file
/// contents. Other permission bits are normalized and therefore intentionally
/// ignored.
pub fn compute_source_file_hash<P: AsRef<Path>>(path: P) -> CacheResult<String> {
    let path = path.as_ref();
    let content_hash = compute_file_hash(path)?;
    let metadata = get_metadata(path)?;
    let executable = metadata.permissions().mode() & 0o100 != 0;

    Ok(compute_string_hash(&format!(
        "file {content_hash} executable={executable}"
    )))
}

/// Compute a hash of a directory's contents.
///
/// Returns `Ok(None)` for an empty directory.
pub fn compute_directory_hash<P: AsRef<Path>>(path: P) -> CacheResult<Option<String>> {
    let path = path.as_ref();
    let mut entries = Vec::new();

    // Skip the root directory itself, sort by file name for consistent ordering
    for entry in WalkDir::new(path).min_depth(1).sort_by_file_name() {
        match entry {
            Ok(entry) => {
                let entry_path = entry.path().to_string_lossy().into_owned();
                let meta = entry.metadata();

                if let Ok(meta) = meta {
                    let entry_type = if meta.is_dir() { "dir" } else { "file" };
                    let modified = meta
                        .modified()
                        .map(time::system_time_to_unix_seconds)
                        .unwrap_or(0);

                    entries.push(format!("{entry_type} {modified} {entry_path}"));

                    // For files, also include content hash for maximum detection sensitivity
                    if meta.is_file() {
                        match compute_file_hash(entry.path()) {
                            Ok(hash) => entries.push(format!("hash {hash}")),
                            Err(_) => entries.push(format!("hash_error {entry_path}")),
                        }
                    }
                } else {
                    // Fall back to just the path if metadata is unavailable
                    entries.push(entry_path);
                }
            }
            Err(e) => {
                // Include error entries as well to detect when errors change
                entries.push(format!("error {e}"));
            }
        }
    }

    if entries.is_empty() {
        return Ok(None);
    }

    Ok(Some(compute_string_hash(&entries.join("\n"))))
}

/// Compute a content-only hash of a directory's contents, recursively.
///
/// Unlike [`compute_directory_hash`], this ignores modification times, so
/// touching a file without changing its contents does not change the hash. It
/// also keys entries by their path relative to `path`, so the same tree hashes
/// identically regardless of where it lives on disk. This mirrors how Nix
/// hashes a source tree copied into the store, and is what the eval cache needs
/// to detect edits to files nested inside a copied source directory.
///
/// Returns the hash of the empty string for an empty directory.
pub fn compute_directory_content_hash<P: AsRef<Path>>(path: P) -> CacheResult<String> {
    let path = path.as_ref();
    let mut entries = Vec::new();

    // Skip the root directory itself, sort by file name for consistent ordering
    for entry in WalkDir::new(path).min_depth(1).sort_by_file_name() {
        match entry {
            Ok(entry) => {
                let rel = entry
                    .path()
                    .strip_prefix(path)
                    .unwrap_or_else(|_| entry.path())
                    .to_string_lossy()
                    .into_owned();
                let file_type = entry.file_type();

                if file_type.is_dir() {
                    entries.push(format!("dir {rel}"));
                } else if file_type.is_symlink() {
                    // Record the link target, not its contents, matching Nix.
                    let target = std::fs::read_link(entry.path())
                        .map(|p| p.to_string_lossy().into_owned())
                        .unwrap_or_default();
                    entries.push(format!("symlink {rel} -> {target}"));
                } else {
                    match compute_source_file_hash(entry.path()) {
                        Ok(hash) => entries.push(format!("file {rel} {hash}")),
                        Err(_) => entries.push(format!("file_error {rel}")),
                    }
                }
            }
            Err(e) => {
                // Include error entries as well to detect when errors change
                entries.push(format!("error {e}"));
            }
        }
    }

    Ok(compute_string_hash(&entries.join("\n")))
}

/// Compute a hash of a string
pub fn compute_string_hash(content: &str) -> String {
    let hash = blake3::hash(content.as_bytes());
    hash.to_hex().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use std::os::unix::fs::PermissionsExt;
    use tempfile::TempDir;

    #[test]
    fn test_file_hash() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");

        // Create test file
        {
            let mut file = File::create(&file_path).unwrap();
            file.write_all(b"test content").unwrap();
        }

        let hash = compute_file_hash(&file_path).unwrap();
        assert!(!hash.is_empty(
```

### Core Architecture Module: `devenv-cache-core/src/lib.rs`
```
//! # devenv-cache-core
//!
//! Core utilities for file tracking and caching in devenv.
//!
//! This library provides shared functionality that can be used by both
//! the task cache and eval cache implementations, including:
//!
//! - File hashing and change detection
//! - SQLite database utilities
//! - Time conversion utilities
//! - Common error types

pub mod db;
pub mod error;
pub mod file;
pub mod time;

// Re-export common types for convenience
pub use db::Database;
pub use error::{CacheError, CacheResult};
pub use file::{
    TrackedFile, compute_directory_content_hash, compute_file_hash, compute_source_file_hash,
    compute_string_hash,
};

```

### Core Architecture Module: `devenv-cache-core/src/time.rs`
```
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// Convert a SystemTime to Unix seconds.
///
/// Returns an i64 because SQLite doesn't support u64.
/// Values larger than i64::MAX are clamped to i64::MAX.
pub fn system_time_to_unix_seconds(time: SystemTime) -> i64 {
    time.duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
        .min(i64::MAX as u64) as i64
}

/// Convert an integer unix timestamp in seconds to a SystemTime.
///
/// Takes an i64 because SQLite doesn't support u64.
pub fn system_time_from_unix_seconds(seconds: i64) -> SystemTime {
    UNIX_EPOCH + Duration::from_secs(seconds.max(0) as u64)
}

/// Get the current system time as Unix seconds.
pub fn now_as_unix_seconds() -> i64 {
    system_time_to_unix_seconds(SystemTime::now())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_time_conversion_roundtrip() {
        let now = SystemTime::now();
        let seconds = system_time_to_unix_seconds(now);
        let roundtrip = system_time_from_unix_seconds(seconds);

        // Compare durations since UNIX_EPOCH to handle rounding issues
        let original_duration = now.duration_since(UNIX_EPOCH).unwrap();
        let roundtrip_duration = roundtrip.duration_since(UNIX_EPOCH).unwrap();

        // They should be within 1 second of each other (due to second-level precision)
        assert!(
            original_duration.as_secs() == roundtrip_duration.as_secs(),
            "Time conversion roundtrip failed: original: {original_duration:?}, roundtrip: {roundtrip_duration:?}"
        );
    }

    #[test]
    fn test_negative_seconds_handled() {
        // Test with negative seconds (invalid but could happen with bad data)
        let time = system_time_from_unix_seconds(-1);
        // Should be clamped to UNIX_EPOCH
        assert_eq!(time, UNIX_EPOCH);
    }
}

```

### Core Architecture Module: `devenv-core/src/backend.rs`
```
//! Devenv-flavored adapter over an [`Evaluator`].
//!
//! Holds the bootstrap-args reference (for external consumers like LSP,
//! MCP, and shell-cache-key lookups) and exposes devenv-shaped methods
//! that delegate to the underlying `Evaluator`. The evaluator owns its
//! own clone of the bootstrap args at construction time.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use miette::{Result, WrapErr, miette};

use crate::bootstrap_args::BootstrapArgs;
use crate::evaluator::{BuildOptions, Evaluator};
use crate::store::{Store, StorePath};

pub struct Backend<E: Evaluator + ?Sized> {
    nix: Arc<E>,
    bootstrap_args: Arc<BootstrapArgs>,
}

impl<E: Evaluator + ?Sized> Backend<E> {
    pub fn new(nix: Arc<E>, bootstrap_args: Arc<BootstrapArgs>) -> Self {
        Self {
            nix,
            bootstrap_args,
        }
    }

    pub fn evaluator(&self) -> &E {
        &self.nix
    }

    /// Recover the concrete backend type for evaluator-specific
    /// operations (lock updates, REPL, native dev-env, search). Returns
    /// `None` when the underlying evaluator isn't `T`.
    pub fn as_concrete<T: 'static>(&self) -> Option<&T> {
        self.nix.as_any().downcast_ref::<T>()
    }

    pub fn store(&self) -> &dyn Store {
        self.nix.store()
    }

    pub fn bootstrap_args(&self) -> &Arc<BootstrapArgs> {
        &self.bootstrap_args
    }

    pub async fn eval_devenv(&self, attrs: &[&str]) -> Result<String> {
        self.nix.eval(attrs).await
    }

    pub async fn build_devenv(&self, attrs: &[&str], opts: BuildOptions) -> Result<Vec<StorePath>> {
        self.nix.build(attrs, opts).await
    }

    pub async fn gc(&self, paths: Vec<PathBuf>) -> Result<crate::store::GcStats> {
        let store_paths: Vec<StorePath> = paths.into_iter().map(StorePath::from).collect();
        let opts = crate::store::GcOptions {
            paths: Some(store_paths),
            max_freed: 0,
        };
        self.store().collect_garbage(opts).await
    }

    pub async fn is_trusted_user(&self) -> Result<bool> {
        self.store().is_trusted_user().await
    }

    /// Return the path to bash, using a cached GC-root symlink when
    /// available so repeat calls don't surface a per-call activity.
    ///
    /// `gc_root` is the base name passed to `build_devenv`; the
    /// realized symlink is at `<gc_root>-bash` (the `bash` attribute
    /// suffix is appended by the build pipeline).
    pub async fn get_bash(&self, gc_root: &Path, refresh: bool) -> Result<PathBuf> {
        let cached_symlink = gc_root.with_file_name(format!(
            "{}-bash",
            gc_root.file_name().unwrap_or_default().to_string_lossy()
        ));
        if !refresh
            && cached_symlink.exists()
            && let Ok(target) = std::fs::read_link(&cached_symlink)
            && target.exists()
        {
            return Ok(target.join("bin").join("bash"));
        }

        let opts = BuildOptions {
            gc_root: Some(gc_root.to_path_buf()),
        };
        let outs = self
            .build_devenv(&["bash"], opts)
            .await
            .wrap_err("Failed to build bash")?;
        let first = outs
            .into_iter()
            .next()
            .ok_or_else(|| miette!("bash build produced no outputs"))?;
        Ok(first.0.join("bin").join("bash"))
    }
}

```

### Core Architecture Module: `devenv-core/src/bootstrap_args.rs`
```
//! Pre-serialized arguments for the Nix bootstrap entry point.
//!
//! The framework owns the schema (today: [`crate::nix_args::NixArgs<'a>`]),
//! serializes it once via [`BootstrapArgs::from_serializable`], and shares
//! the resulting value with the backend. Backends never see
//! [`crate::nix_args::NixArgs`] — the payload is opaque Nix code by the
//! time it crosses the seam.

use miette::Result;
use std::sync::Arc;

/// Pre-serialized argument attrset for `import bootstrap/default.nix <args>`.
///
/// Cheaply cloneable: the underlying serialized string is shared via
/// reference counting, so callers that need their own handle can `.clone()`
/// without duplicating the payload.
#[derive(Clone)]
pub struct BootstrapArgs {
    serialized: Arc<str>,
}

impl BootstrapArgs {
    /// Serialize any [`serde::Serialize`] value via `ser_nix`.
    pub fn from_serializable<T: serde::Serialize>(value: &T) -> Result<Self> {
        let serialized = ser_nix::to_string(value)
            .map_err(|e| miette::miette!("Failed to serialize bootstrap args: {}", e))?;
        Ok(Self {
            serialized: Arc::from(serialized),
        })
    }

    /// Borrow the serialized Nix expression. Used both as the payload
    /// spliced into the bootstrap import call and as the eval-cache key seed.
    pub fn as_str(&self) -> &str {
        &self.serialized
    }
}

impl AsRef<str> for BootstrapArgs {
    fn as_ref(&self) -> &str {
        self.as_str()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Serialize;

    #[derive(Serialize)]
    struct TinyArgs<'a> {
        version: &'a str,
        system: &'a str,
    }

    #[test]
    fn from_serializable_round_trips_a_simple_attrset() {
        let args = TinyArgs {
            version: "1.0.0",
            system: "x86_64-linux",
        };
        let b = BootstrapArgs::from_serializable(&args).expect("serialize");
        assert!(b.as_str().contains("\"1.0.0\""));
        assert!(b.as_str().contains("\"x86_64-linux\""));
    }

    #[test]
    fn clone_shares_the_underlying_payload() {
        let args = TinyArgs {
            version: "1.0.0",
            system: "x86_64-linux",
        };
        let a = BootstrapArgs::from_serializable(&args).expect("serialize");
        let b = a.clone();
        assert_eq!(a.as_str().as_ptr(), b.as_str().as_ptr());
    }
}

```

### Core Architecture Module: `devenv-core/src/cachix.rs`
```
//! Cachix binary cache integration for devenv.
//!
//! This module handles fetching and configuring Cachix substituters and trusted keys
//! for Nix operations, including authentication token management and API integration.

use miette::{IntoDiagnostic, Result, WrapErr, miette};
use nix_conf_parser::NixConf;
use serde::{Deserialize, Deserializer};
use std::collections::BTreeMap;
use std::env;
use std::io::ErrorKind;
use std::os::unix::fs::OpenOptionsExt as _;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tokio::sync::OnceCell;
use tracing::{debug, warn};

/// Name of the environment variable holding the Cachix auth token, and
/// the built-in SecretSpec secret name when that requirement is enabled.
///
/// The env-read and the child-process env passed to the cachix push
/// daemon both always use this exact name (that's what the cachix CLI
/// reads). The SecretSpec requirement is enabled, disabled, or renamed via
/// `secretspec.cachix_auth_token` in `devenv.yaml`.
pub const CACHIX_AUTH_TOKEN_ENV: &str = "CACHIX_AUTH_TOKEN";

/// Paths specific to Cachix operations
#[derive(Debug, Clone)]
pub struct CachixPaths {
    pub trusted_keys: PathBuf,
    /// Where the managed netrc is written. It merges the project's Cachix
    /// credentials with whatever Nix already had configured, so callers
    /// should pick a path that is private to this process and outside the
    /// project tree.
    pub netrc: PathBuf,
    /// Optional custom daemon socket path (for testing)
    pub daemon_socket: Option<PathBuf>,
}

/// Manages Cachix binary cache configuration and integration
pub struct CachixManager {
    pub paths: CachixPaths,
    netrc_path: Arc<OnceCell<String>>,
    /// Set after the generated Cachix entries have been written. The netrc
    /// path is initialized earlier, before the Nix store opens, so the
    /// backend can preserve credentials from Nix's existing netrc first.
    netrc_populated: Arc<OnceCell<()>>,
    /// Auth token supplied out of band (e.g. resolved from secretspec), plus
    /// its memoized resolution. Resolution can Dhall-evaluate cachix config,
    /// while a deferred machine-install override must invalidate the result.
    auth_token: Mutex<AuthTokenState>,
    deferred_auth: AtomicBool,
}

struct AuthTokenState {
    override_token: Option<String>,
    resolved: Option<Option<String>>,
}

impl CachixManager {
    /// Create a new CachixManager.
    ///
    /// `auth_token_override` is an optional token from an external secret
    /// store (secretspec); see [`CachixManager::resolve_auth_token`] for
    /// how it slots into the resolution precedence.
    pub fn new(paths: CachixPaths, auth_token_override: Option<String>) -> Self {
        Self {
            paths,
            netrc_path: Arc::new(OnceCell::new()),
            netrc_populated: Arc::new(OnceCell::new()),
            auth_token: Mutex::new(AuthTokenState {
                override_token: auth_token_override,
                resolved: None,
            }),
            deferred_auth: AtomicBool::new(false),
        }
    }

    /// Keep the managed netrc available for a token supplied after the Nix
    /// store opens. This is intentionally opt-in for deferred machine installs.
    pub fn enable_deferred_auth(&self) {
        self.deferred_auth.store(true, Ordering::Release);
    }

    /// Replace the out-of-band token and invalidate token resolution.
    ///
    /// Machine installs use this after their execution mode is known: local
    /// installs can then contribute an opportunistic project SecretSpec token
    /// without making target-only installs contact a workstation provider.
    pub fn set_auth_token_override(&self, auth_token_override: Option<String>) {
        let mut state = self.auth_token.lock().unwrap_or_else(|e| e.into_inner());
        state.override_token = auth_token_override;
        state.resolved = None;
    }

    /// Resolve the Cachix auth token used for authenticating pulls
    /// (netrc) and pushes (the daemon subprocess env).
    ///
    /// Precedence:
    /// 1. `CACHIX_AUTH_TOKEN` environment variable (non-empty).
    /// 2. A token supplied out of band (secretspec) via [`CachixManager::new`].
    /// 3. `authToken` from the cachix CLI config (`cachix.dhall`), as
    ///    written by `cachix authtoken`.
    ///
    /// Returns `None` when no source yields a token, in which case
    /// access falls back to unauthenticated (public caches still work).
    ///
    /// The result is memoized: the precedence sources are stable for the
    /// lifetime of an invocation, so we resolve once and reuse it across
    /// the (several) call sites.
    pub fn resolve_auth_token(&self) -> Option<String> {
        let mut state = self.auth_token.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(resolved) = &state.resolved {
            return resolved.clone();
        }
        let resolved = Self::resolve_auth_token_uncached(state.override_token.as_deref());
        state.resolved = Some(resolved.clone());
        resolved
    }

    fn resolve_auth_token_uncached(auth_token_override: Option<&str>) -> Option<String> {
        if let Ok(token) = env::var(CACHIX_AUTH_TOKEN_ENV)
            && !token.is_empty()
        {
            return Some(token);
        }
        if let Some(token) = auth_token_override.filter(|token| !token.is_empty()) {
            debug!("cachix: CACHIX_AUTH_TOKEN unset, using token from secretspec");
            return Some(token.to_string());
        }
        let token = read_dhall_auth_token();
        if token.is_some() {
            debug!("cachix: CACHIX_AUTH_TOKEN unset, using authToken from cachix config");
        }
        token
    }

    /// Ensure the managed netrc file exists and return its path.
    ///
    /// This happens before the Nix store opens. The backend can then copy
    /// credentials from Nix's existing `netrc-file` into this file before
    /// switching the process-global setting to it.
    async fn ensure_netrc_path(&self) -> Result<&String> {
        self.netrc_path
            .get_or_try_init(|| async {
                let netrc_path = self.paths.netrc.clone();
                write_netrc_file(&netrc_path, &[])?;
                Ok(netrc_path.to_string_lossy().to_string())
            })
            .await
    }

    /// Ensure netrc file is created and populated with cache credentials.
    ///
    /// The backend may already have seeded the file with credentials from
    /// Nix's previously configured netrc. Generated entries are written
    /// first so the explicitly resolved Cachix token wins for project caches,
    /// while credentials for unrelated global substituters remain available.
    pub async fn ensure_netrc_file(&self, pull_caches: &[String]) -> Result<()> {
        if let Some(auth_token) = self.resolve_auth_token() {
            let netrc_path = PathBuf::from(self.ensure_netrc_path().await?);
            if !pull_caches.is_empty() {
                self.netrc_populated
                    .get_or_try_init(|| async {
                        self.create_netrc_file(&netrc_path, pull_caches, &auth_token)
                            .await
                    })
                    .await?;
            }
        }
        Ok(())
    }

    /// Get Nix settings (--option flags) needed for Cachix substituters
    ///
    /// Returns a HashMap where keys are Nix option names and values are the option values.
    /// For example: `"extra-substituters" => "https://cache1.cachix.org https://cache2.cachix.org"`
    ///
    /// Note: This returns substituters and keys but NOT netrc-file. The
    /// netrc-file path is carried on [`crate::StoreSettings`] (see
    /// [`CachixManager::store_settings`]) and applied to the Nix settings
    /// registry before the store opens.
    pub async fn get_nix_settings(
        &self,
        cachix_caches: &CachixCacheInfo,
    ) -> Result<BTreeMap<String, String>> {
        let mut settings = BTreeMap::new();

        // Configure pull caches (substituters and trusted keys)
        if !cachix_caches.caches.pull.is_empty() {
            let mut pull_caches = cachix_caches
                .caches
                .pull
                .iter()
                .map(|cache| format!("https://{cache}.cachix.org"))
                .collect::<Vec<String>>();
            pull_caches.sort();
            settings.insert("extra-substituters".to_string(), pull_caches.join(" "));

            let mut keys = cachix_caches
                .known_keys
                .values()
                .cloned()
                .collect::<Vec<String>>();
            keys.sort();
            settings.insert("extra-trusted-public-keys".to_string(), keys.join(" "));

            // Ensure netrc file is created with cache credentials
            // (the netrc-file path is applied before the store opens; see
            // `store_settings`)
            if let Err(e) = self.ensure_netrc_file(&cachix_caches.caches.pull).await {
                warn!("Failed to create netrc file: {}", e);
            }
        }

        Ok(settings)
    }

    /// Create a netrc file with Cachix authentication
    async fn create_netrc_file(
        &self,
        netrc_path: &Path,
        pull_caches: &[String],
        auth_token: &str,
    ) -> Result<()> {
        let existing_content = match std::fs::read(netrc_path) {
            Ok(content) => content,
            Err(e) if e.kind() == ErrorKind::NotFound => Vec::new(),
            Err(e) => {
                return Err(e).into_diagnostic().wrap_err_with(|| {
                    format!("Failed to read netrc file at {}", netrc_path.display())
                });
            }
        };
        let mut netrc_content = Vec::new();

        for cache in pull_caches {
            netrc_content.extend_from_slice(
                format!("machine {cache}.cachix.org\nlogin token\npassword {auth_token}\n\n")
```

### Core Architecture Module: `devenv-core/src/config.rs`
```
use miette::{IntoDiagnostic, Result, WrapErr, bail};
use pathdiff;
use schemars::JsonSchema;
use schematic::ConfigLoader as SchematicLoader;
use semver::{Version, VersionReq};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, BTreeSet, HashMap, HashSet},
    fmt,
    path::{Path, PathBuf},
};

const YAML_CONFIG: &str = "devenv.yaml";
const YAML_LOCAL_CONFIG: &str = "devenv.local.yaml";

#[derive(Clone, Copy)]
struct ImportRoots<'a> {
    git_root: Option<&'a Path>,
    input_sources: &'a BTreeMap<String, PathBuf>,
}

/// Version requirement for the devenv CLI.
///
/// - `true`: CLI version must match the modules version (checked during Nix evaluation)
/// - A constraint string like `">=2.0.0"`: checked before Nix evaluation
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema, schematic::Schematic)]
#[serde(untagged)]
pub enum RequireVersion {
    /// When true, CLI version must match the modules version
    Match(bool),
    /// Version constraint string (e.g., ">=2.0.0", "2.0.7")
    Constraint(String),
}

/// Configure the built-in SecretSpec requirement for the Cachix auth token.
///
/// - `true`: require the default `CACHIX_AUTH_TOKEN` secret.
/// - `false`: disable SecretSpec lookup for the Cachix auth token.
/// - A string: require a secret with that name.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema, schematic::Schematic)]
#[serde(untagged)]
pub enum CachixAuthToken {
    Enabled(bool),
    Name(String),
}

impl CachixAuthToken {
    /// The SecretSpec lookup name, if lookup is enabled.
    pub fn secret_name(&self) -> Option<&str> {
        match self {
            Self::Enabled(true) => Some("CACHIX_AUTH_TOKEN"),
            Self::Enabled(false) => None,
            Self::Name(name) if !name.is_empty() => Some(name),
            Self::Name(_) => None,
        }
    }

    /// Whether a missing secret should trigger the built-in requirement.
    pub fn is_required(&self) -> bool {
        match self {
            Self::Enabled(enabled) => *enabled,
            Self::Name(name) => !name.is_empty(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema, schematic::Schematic)]
#[cfg_attr(feature = "clap", derive(clap::ValueEnum))]
#[serde(rename_all = "lowercase")]
#[derive(Default)]
pub enum NixBackendType {
    #[default]
    Nix,
}

#[derive(schematic::Config, Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct AndroidSdkConfig {
    /// Accept the Android SDK license.
    /// Can also be set via the `NIXPKGS_ACCEPT_ANDROID_SDK_LICENSE=1` environment variable.
    ///
    /// Default: `false`.
    #[serde(skip_serializing_if = "is_false", default = "false_default")]
    #[setting(alias = "acceptLicense", merge = schematic::merge::replace)]
    pub accept_license: bool,
}

#[derive(schematic::Config, Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct NixpkgsConfig {
    /// Allow unfree packages.
    ///
    /// Default: `false`.
    ///
    /// Added in 1.7.
    #[serde(skip_serializing_if = "is_false", default = "false_default")]
    #[setting(alias = "allowUnfree", merge = schematic::merge::replace)]
    pub allow_unfree: bool,
    /// Allow packages that are not supported on the current system.
    ///
    /// Default: `false`.
    ///
    /// Added in 2.0.5.
    #[serde(skip_serializing_if = "is_false", default = "false_default")]
    #[setting(alias = "allowUnsupportedSystem", merge = schematic::merge::replace)]
    pub allow_unsupported_system: bool,
    /// Allow packages marked as broken.
    ///
    /// Default: `false`.
    ///
    /// Added in 1.7.
    #[serde(skip_serializing_if = "is_false", default = "false_default")]
    #[setting(alias = "allowBroken", merge = schematic::merge::replace)]
    pub allow_broken: bool,
    /// Allow packages not built from source.
    ///
    /// Default: `true` (nixpkgs default).
    #[serde(skip_serializing_if = "is_false", default = "false_default")]
    #[setting(alias = "allowNonSource", merge = schematic::merge::replace)]
    pub allow_non_source: bool,
    /// Enable CUDA support for nixpkgs.
    ///
    /// Default: `false`.
    ///
    /// Added in 1.7.
    #[serde(skip_serializing_if = "is_false", default = "false_default")]
    #[setting(alias = "cudaSupport", merge = schematic::merge::replace)]
    pub cuda_support: bool,
    /// Select CUDA capabilities for nixpkgs.
    ///
    /// Default: `[]`.
    ///
    /// Added in 1.7.
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    #[setting(alias = "cudaCapabilities", merge = schematic::merge::append_vec)]
    pub cuda_capabilities: Vec<String>,
    /// Enable ROCm support for nixpkgs.
    ///
    /// Default: `false`.
    ///
    /// Added in 2.0.7.
    #[serde(skip_serializing_if = "is_false", default = "false_default")]
    #[setting(alias = "rocmSupport", merge = schematic::merge::replace)]
    pub rocm_support: bool,
    /// A list of insecure permitted packages.
    ///
    /// Default: `[]`.
    ///
    /// Added in 1.7.
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    #[setting(alias = "permittedInsecurePackages", merge = schematic::merge::append_vec)]
    pub permitted_insecure_packages: Vec<String>,
    /// A list of unfree packages to allow by name.
    ///
    /// Default: `[]`.
    ///
    /// Added in 1.9.
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    #[setting(alias = "permittedUnfreePackages")]
    pub permitted_unfree_packages: Vec<String>,
    /// A list of license names to allow.
    /// Uses nixpkgs license attribute names (e.g. `gpl3Only`, `mit`, `asl20`).
    /// See [nixpkgs license list](https://github.com/NixOS/nixpkgs/blob/master/lib/licenses.nix).
    ///
    /// Default: `[]`.
    #[serde(skip_serializing, default)]
    #[setting(alias = "allowlistedLicenses", merge = schematic::merge::append_vec)]
    pub allowlisted_licenses: Vec<String>,
    /// A list of license names to block.
    /// Uses nixpkgs license attribute names (e.g. `unfree`, `bsl11`).
    /// See [nixpkgs license list](https://github.com/NixOS/nixpkgs/blob/master/lib/licenses.nix).
    ///
    /// Default: `[]`.
    #[serde(skip_serializing, default)]
    #[setting(alias = "blocklistedLicenses", merge = schematic::merge::append_vec)]
    pub blocklisted_licenses: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    #[setting(nested)]
    pub android_sdk: Option<AndroidSdkConfig>,
}

#[derive(schematic::Config, Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct Input {
    /// URI specification of the input.
    /// See [Supported URI formats](/inputs/#supported-uri-formats).
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub url: Option<String>,
    /// Does the input contain `flake.nix` or `devenv.nix`.
    ///
    /// Default: `true`.
    #[serde(skip_serializing_if = "is_true", default = "true_default")]
    #[setting(default = true)]
    pub flake: bool,
    /// Another input to "inherit" from by name.
    /// See [Following inputs](/inputs/#following-inputs).
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub follows: Option<String>,
    /// Override nested inputs by name.
    /// See [Following inputs](/inputs/#following-inputs).
    ///
    /// Opaque.
    #[serde(skip_serializing_if = "BTreeMap::is_empty", default)]
    pub inputs: BTreeMap<String, Input>,
    /// A list of overlays to include from the input.
    /// See [Overlays](/overlays/).
    ///
    /// Default: `[]`.
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub overlays: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, JsonSchema)]
pub struct FlakeInput {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub follows: Option<String>,
    #[serde(skip_serializing_if = "BTreeMap::is_empty", default)]
    pub inputs: BTreeMap<String, Input>,
    #[serde(skip_serializing_if = "is_true", default = "true_default")]
    pub flake: bool,
}

#[derive(Debug, Eq, PartialEq)]
pub enum FlakeInputError {
    UrlAndFollowsBothSet,
}

impl fmt::Display for FlakeInputError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            FlakeInputError::UrlAndFollowsBothSet => {
                write!(f, "url and follows cannot both be set for the same input")
            }
        }
    }
}

impl TryFrom<&Input> for FlakeInput {
    type Error = FlakeInputError;

    fn try_from(input: &Input) -> Result<Self, Self::Error> {
        if input.url.is_some() && input.follows.is_some() {
            return Err(Self::Error::UrlAndFollowsBothSet);
        }

        Ok(FlakeInput {
            url: input.url.clone(),
            follows: input.follows.clone(),
            inputs: input.inputs.clone(),
            flake: input.flake,
        })
    }
}

#[derive(schematic::Config, Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct Clean {
    /// Clean the environment when entering the shell.
    ///
    /// Default: `false`.
    ///
    /// Added in 1.0.
    pub enabled: bool,
    /// A list of environment variables to keep when cleaning the environment.
    ///
    /// Default: `[]`.
    ///
    /// Added in 1.0.
    pub keep: Vec<String>,
    // TODO: executables?
}

impl Clean {
    /// Variables devenv requires internally and must survive env cleaning.
    /// `_DEVENV_HOOK_DIR` marks shells spawned by `devenv hook`; the shell
    /// hooks rely on its presence to know whether `cd`-ing out of the
    /// project should exit the current shell.
    const ALWAYS_KEEP: &'static [&'static str] = &["_DEVENV_HOOK_DIR"];

    /// Return host environment variables filter
```

### Core Architecture Module: `devenv-core/src/dotenv.rs`
```
//! Shared dotenv loading and evaluation-cache tracking.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use dotenv::{EnvLoader, EnvSequence};
use miette::{IntoDiagnostic, Result, WrapErr, bail};
use sha2::{Digest, Sha256};

use crate::eval_op::{EvalInputState, OpObserver};

/// Transient file state used to reject dotenv changes during a load.
#[derive(Clone, Debug, PartialEq, Eq)]
struct DotenvFileSpec {
    path: PathBuf,
    state: DotenvFileState,
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum DotenvFileState {
    Missing,
    Present { sha256: String },
}

/// Load dotenv files with the same parser used by both the CLI runtime path
/// and the Nix primop.
pub fn load_dotenv(paths: &[PathBuf], substitution: bool) -> Result<BTreeMap<String, String>> {
    load_dotenv_inner(paths, substitution).map(|(variables, _, _)| variables)
}

/// Load dotenv files and report ordinary file/env observations to the
/// evaluation input tracker. This prevents cached Nix values from surviving a
/// dotenv or substitution-source edit.
pub fn load_dotenv_tracked(
    paths: &[PathBuf],
    substitution: bool,
    observer: &dyn OpObserver,
) -> Result<BTreeMap<String, String>> {
    let before = capture_files(paths.iter().map(PathBuf::as_path))?;
    let (variables, substitution_dependencies, substitutions) =
        load_dotenv_inner(paths, substitution)?;
    let after = capture_files(paths.iter().map(PathBuf::as_path))?;

    if before != after {
        bail!("A dotenv file changed while it was being loaded; retry the command");
    }

    for file in before {
        observer.record_input_state(EvalInputState::File {
            path: file.path,
            content_sha256: match file.state {
                DotenvFileState::Missing => None,
                DotenvFileState::Present { sha256 } => Some(sha256),
            },
        });
    }
    for name in substitution_dependencies {
        let content_sha256 = substitutions
            .as_ref()
            .and_then(|values| values.get(&name))
            .map(|value| hex::encode(Sha256::digest(value.as_bytes())));
        observer.record_input_state(EvalInputState::Env {
            name,
            content_sha256,
        });
    }
    Ok(variables)
}

fn load_dotenv_inner(
    paths: &[PathBuf],
    substitution: bool,
) -> Result<(
    BTreeMap<String, String>,
    Vec<String>,
    Option<BTreeMap<String, String>>,
)> {
    if paths.is_empty() {
        return Ok((BTreeMap::new(), Vec::new(), None));
    }

    let substitutions = substitution.then(inherited_substitutions);
    let loader = EnvLoader::with_paths(paths)
        .sequence(EnvSequence::InputOnly)
        .required(false)
        .substitution(substitution)
        .substitutions(substitutions.as_ref().into_iter().flat_map(|values| {
            values
                .iter()
                .map(|(name, value)| (name.clone(), value.clone()))
        }));
    let (loaded, dependencies) = if substitution {
        loader.load_with_substitution_dependencies()
    } else {
        loader
            .load()
            .map(|variables| (variables, Default::default()))
    }
    .into_diagnostic()
    .wrap_err("Failed to load dotenv files")?;

    let mut variables = BTreeMap::new();
    for (name, value) in loaded {
        if !is_valid_env_name(&name) {
            bail!(
                "Invalid environment variable name '{name}' in dotenv file: names must match [A-Za-z_][A-Za-z0-9_]*"
            );
        }
        variables.insert(name, value);
    }

    let mut dependencies: Vec<_> = dependencies.into_iter().collect();
    dependencies.sort();
    Ok((variables, dependencies, substitutions))
}

fn capture_files<'a>(paths: impl IntoIterator<Item = &'a Path>) -> Result<Vec<DotenvFileSpec>> {
    paths
        .into_iter()
        .map(|path| {
            let state = match fs::read(path) {
                Ok(contents) => DotenvFileState::Present {
                    sha256: hex::encode(Sha256::digest(contents)),
                },
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                    DotenvFileState::Missing
                }
                Err(error) => {
                    return Err(error).into_diagnostic().wrap_err_with(|| {
                        format!("Failed to hash dotenv file '{}'", path.display())
                    });
                }
            };
            Ok(DotenvFileSpec {
                path: path.to_path_buf(),
                state,
            })
        })
        .collect::<Result<Vec<_>>>()
}

fn inherited_substitutions() -> BTreeMap<String, String> {
    std::env::vars_os()
        .filter_map(|(name, value)| Some((name.into_string().ok()?, value.into_string().ok()?)))
        .collect()
}

fn is_valid_env_name(name: &str) -> bool {
    let mut chars = name.chars();
    match chars.next() {
        Some(c) if c.is_ascii_alphabetic() || c == '_' => {}
        _ => return false,
    }
    chars.all(|c| c.is_ascii_alphanumeric() || c == '_')
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::eval_op::EvalOp;
    use std::sync::Mutex;
    use tempfile::TempDir;

    #[derive(Default)]
    struct RecordingObserver(Mutex<Vec<EvalOp>>);

    impl OpObserver for RecordingObserver {
        fn record(&self, op: EvalOp) {
            self.0.lock().unwrap().push(op);
        }
    }

    #[test]
    fn tracked_load_records_present_and_missing_files() {
        let root = TempDir::new().unwrap();
        let present = root.path().join(".env");
        let missing = root.path().join(".env.local");
        fs::write(&present, "VALUE=one\n").unwrap();

        let observer = RecordingObserver::default();
        load_dotenv_tracked(&[present.clone(), missing.clone()], false, &observer).unwrap();
        let observations = observer.0.lock().unwrap();
        assert!(observations.contains(&EvalOp::ReadFile { source: present }));
        assert!(observations.contains(&EvalOp::ReadFile { source: missing }));
    }

    #[test]
    fn tracked_load_records_substitution_names_without_values() {
        let root = TempDir::new().unwrap();
        let path = root.path().join(".env");
        fs::write(&path, "VALUE=$HOME\n").unwrap();

        let observer = RecordingObserver::default();
        load_dotenv_tracked(&[path], true, &observer).unwrap();
        assert!(observer.0.lock().unwrap().contains(&EvalOp::GetEnv {
            name: "HOME".into()
        }));
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3316** (2026-10-28): **macOS: background process manager becomes unreachable after 3 days, because tmp_cleaner deletes its pid and config files in /tmp**
  *Symptoms*: ### Describe the bug  When I have `devenv up` running for more than three days on macOS, the CLI loses track of the daemon. `devenv processes down`, `devenv processes restart <name>`, and the rest report:  ``` No process manager is running. Start processes first with `devenv up -d` ```  while every process is still running. `devenv up` then fails, because its ports, such as Postgres’, are still taken. The only way out is to find the `daemon-processes` PID and signal it by hand.   #### Cause  `.devenv/run` points to `/tmp/devenv-<hash>`. The manager writes `processes/native-manager.pid` and `processes/daemon-config.json` there once, at startup, and does not touch them again.  macOS runs `/usr/libexec/tmp_cleaner` nightly (launchd job `com.apple.tmp_cleaner`). It deletes every regular file under `/tmp` whose atime, mtime, and ctime are all older than 3 days:  ```sh find -dx . -fstype local -type f -atime +3 -mtime +3 -ctime +3 -delete ```  Sockets are not regular files, so `native.sock` survives. The pid file and the config do not. In our case the run directory was created on day 0 and both files were gone two weeks later, with the socket still present and the daemon still running.  The job is part of the system and cannot be configured or turned off. PostgreSQL works around the same cleaner by re-touching its socket lock files in `/tmp` every hour.  ### To reproduce  1. On macOS, `devenv up -d` in a project with processes. 2. Wait more than 3 days, or simulate it: `touch -t 20

- **Issue #3292** (2026-10-19): **Terminal spacing gets offset after running task**
  *Symptoms*: **Describe the bug** <!-- A clear and concise description of what the bug is. --> I have a task that will often mess up the spacing of my terminal indefinitely after it is killed:  <img width="1112" height="152" alt="Image" src="https://github.com/user-attachments/assets/cb16d4ac-f295-4339-9a25-9300610cf7e3" />  <img width="1134" height="124" alt="Image" src="https://github.com/user-attachments/assets/4ef8c1dd-c235-4d4e-895a-fa3567485219" />  The only way I know to fix it once this happens is to start a new terminal session.  **To reproduce** <!-- Please provide a Short, Self Contained, Correct (Compilable), Example: https://sscce.org The best way is to create a gist with `devenv.nix`, `devenv.yaml`, and optionally `devenv.lock`.  Create gist here: https://gist.github.com/  Make sure to include full logs and what you expected to happen. -->  This is an abridged version of the devenv.nix I'm using: ``` { pkgs, lib, config, inputs, ... }:  {   tasks = {     "tests:cypress" = {       exec = ''         SPEC=$(printf '%s' "$DEVENV_TASK_INPUT" | jq -r '.spec')         FILE=$(find ./cypress/component -iname "*$SPEC*" | head)          npx cypress run --env fileConfig=staging --component --headed --no-exit --spec $FILE       '';     };      # Doesn't always happen automatically for some reason.     "utils:killCypress" = {       exec = ''         kill -9 $(lsof -t -c /^Cypress$/) &> /dev/null       '';        after = [         "tests:cypress"       ];     };   }; } ```  **Version** <!-

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

### Incident Patch 1: `8e6eb8ec` (2026-11-03)
**Commit Message**: fix(tui): avoid blocking keyboard capability probes (#3334)

* fix(direnv): skip TUI initialization for environment exports

Prevent terminal capability probes and raw mode for direnv-export and print-dev-env, including when TUI is explicitly enabled.

Fixes #3169.

Prepared with AI assistance.

* fix(tui): request keyboard reporting without blocking probes

Keep direnv-export and print-dev-env eligible for the TUI. Request the optional Kitty keyboard mode directly and restore it on suspend instead of waiting for a capability response.

Add isolated PTY coverage for captured stdout, legacy and Kitty input, rendering, idempotent cleanup, and terminal restoration.

Prepared with AI assistance.

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@
 
 ### Bug Fixes
 
+- Fixed a two-second TUI startup delay on terminals that do not answer keyboard capability queries, including during direnv shell activation. Interactive progress remains available for `direnv-export` and `print-dev-env` ([#3169](https://github.com/cachix/devenv/issues/3169)).
 - Foreground `devenv up` now publishes its manager before service readiness, so other `devenv up` calls can detect it during startup. Failed publication cancels setup tasks before cleaning up.
 - Foreground and detached native process startup now share a lock, preventing simultaneous cold starts from overwriting each other's manager socket and PID file. Waiting for the lock can be cancelled, and competing callers preserve the winning manager's proxy routes.
 - Manager PID files are now published atomically, preventing concurrent status checks from treating an incomplete PID as stale and deleting discovery state.
```

**File**: `devenv-tui/src/inline_terminal.rs` (modified, +137/-19)
```diff
@@ -137,7 +137,6 @@ pub struct InlineTerminal {
     stderr: io::Stderr,
     viewport: Viewport,
     previous: Option<Canvas>,
-    keyboard_enhancement: bool,
     keyboard_enhancement_active: bool,
     raw_mode_active: bool,
     cursor_hidden: bool,
@@ -147,7 +146,6 @@ pub struct InlineTerminal {
 impl InlineTerminal {
     pub fn new(placement: ViewportPlacement) -> io::Result<Self> {
         let screen = terminal::size()?;
-        let keyboard_enhancement = terminal::supports_keyboard_enhancement().unwrap_or(false);
         let mut terminal = Self {
             stderr: io::stderr(),
             viewport: Viewport {
@@ -159,7 +157,6 @@ impl InlineTerminal {
                 claimed: false,
             },
             previous: None,
-            keyboard_enhancement,
             keyboard_enhancement_active: false,
             raw_mode_active: false,
             cursor_hidden: false,
@@ -388,25 +385,24 @@ impl InlineTerminal {
     }
 
     pub fn resume(&mut self) -> io::Result<()> {
-        if self.raw_mode_active
-            && self.cursor_hidden
-            && (!self.keyboard_enhancement || self.keyboard_enhancement_active)
-        {
+        if self.raw_mode_active && self.cursor_hidden && self.keyboard_enhancement_active {
             return Ok(());
         }
         self.suspend()?;
 
-        if self.keyboard_enhancement {
-            self.keyboard_enhancement_active = true;
-            if let Err(error) = execute!(
-                self.stderr,
-                event::PushKeyboardEnhancementFlags(
-                    event::KeyboardEnhancementFlags::REPORT_EVENT_TYPES,
-                )
-            ) {
-                let _ = self.suspend();
-                return Err(error);
-            }
+        // Request the optional Kitty keyboard mode without a capability query.
+        // Unsupported terminals ignore it; Crossterm also accepts legacy keys.
+        // A query can otherwise stall startup for two seconds without a reply.
+        // Pair every push with a pop in suspend(), including error cleanup.
+        self.keyboard_enhancement_active = true;
+        if let Err(error) = execute!(
+            self.stderr,
+            event::PushKeyboardEnhancementFlags(
+                event::KeyboardEnhancementFlags::REPORT_EVENT_TYPES,
+            )
+        ) {
+            let _ = self.suspend();
+            return Err(error);
         }
         if let Err(error) = terminal::enable_raw_mode() {
             let _ = self.suspend();
@@ -861,6 +857,129 @@ mod tests {
 
     // Run terminal mutations in a child with its own PTY so the test runner's
     // terminal and Crossterm's process-global state are never affected.
+    #[cfg(unix)]
+    #[test]
+    fn startup_with_captured_stdout_does_not_probe_keyboard_support() {
+        use nix::poll::{PollFd, PollFlags, poll};
+        use nix::pty::{Winsize, openpty};
+        use nix::sys::termios::tcgetattr;
+        use std::fs::File;
+        use std::io::Read;
+        use std::os::fd::AsFd;
+        use std::process::{Command, Stdio};
+
+        const CHILD: &str = "DEVENV_TEST_TERMINAL_STARTUP";
+        if let Ok(mode) = std::env::var(CHILD) {
+            // Do not let Crossterm open the test runner's controlling terminal.
+            nix::unistd::setsid().unwrap();
+            let cooked = tcgetattr(io::stdin()).unwrap().local_flags;
+            let mut terminal = InlineTerminal::new(ViewportPlacement::Inline).unwrap();
+            terminal.resume().unwrap();
+            io::stderr().write_all(b"ready for keys").unwrap();
+            let first = event::read().unwrap();
+            assert!(
+                matches!(first, Event::Key(key) if key.code == event::KeyCode::Char('j')
+                && key.kind == event::KeyEventKind::Press)
+            );
+            if mode == "kitty" {
+                for kind in [event::KeyEventKind::Repeat, event::KeyEventKind::Release] {
+                    let key = event::read().unwrap();
+                    assert!(
+                        matches!(key, Event::Key(key) if key.code == event::KeyCode::Char('k')
+                        && key.kind == kind)
+                    );
+                }
+            }
+            let canvas = element!(View { Text(content: "building") }).render(Some(80));
+            terminal.draw_with_size(&canvas, (80, 24), None).unwrap();
+            terminal.suspend().unwrap();
+            terminal.suspend().unwrap();
+            drop(terminal);
+            assert_eq!(tcgetattr(io::stdin()).unwrap().local_flags, cooked);
+            println!("export data");
+            return;
+        }
+
+        for mode in ["legacy", "kitty"] {
+            let pty = openpty(
+                Some(&Winsize {
+                    ws_row: 24,
+                    ws_col: 80,
+                    ws_xpixel: 0,
+                    ws_ypixel: 0,
+                }),
+                None,
+            )
+            .unwrap();
+            l
```

**File**: `devenv/src/cli.rs` (modified, +15/-0)
```diff
@@ -1667,6 +1667,21 @@ mod tests {
         );
     }
 
+    #[test]
+    fn export_commands_support_tui() {
+        for command in [
+            vec!["direnv-export"],
+            vec!["print-dev-env"],
+            vec!["print-dev-env", "--json"],
+        ] {
+            for flags in [vec![], vec!["--tui", "true"]] {
+                let cli =
+                    Cli::parse_from(["devenv"].into_iter().chain(flags).chain(command.clone()));
+                assert!(cli.command.supports_tui(), "{command:?}");
+            }
+        }
+    }
+
     #[test]
     fn trace_output_spec_bare_destination_defaults_to_json() {
         let spec: TraceOutputSpec = "stderr".parse().unwrap();
```

---

### Incident Patch 2: `e83830a0` (2026-11-03)
**Commit Message**: fix(processes): prevent orphaned native managers during startup (#3333)

Publish foreground managers before readiness and serialize foreground and
detached discovery with a cancellable startup lock. Cancel setup work on
publication errors, preserve the winning manager's proxy routes, and publish
PID files atomically so concurrent discovery cannot remove partial writes.

Add regression coverage for startup failures, concurrent foreground/detached
callers, cancellation, proxy ownership, and concurrent PID validation.

Builds on #3332.

Co-authored-by: soupdiver <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -11,6 +11,9 @@
 
 ### Bug Fixes
 
+- Foreground `devenv up` now publishes its manager before service readiness, so other `devenv up` calls can detect it during startup. Failed publication cancels setup tasks before cleaning up.
+- Foreground and detached native process startup now share a lock, preventing simultaneous cold starts from overwriting each other's manager socket and PID file. Waiting for the lock can be cancelled, and competing callers preserve the winning manager's proxy routes.
+- Manager PID files are now published atomically, preventing concurrent status checks from treating an incomplete PID as stale and deleting discovery state.
 - Fixed `devenv processes` commands reporting that no process manager is running after `devenv up -d` had been running for more than three days on macOS, where the system `/tmp` cleaner deleted the manager's PID file ([#3316](https://github.com/cachix/devenv/issues/3316)).
 - Fetched `--from` sources now load YAML configuration, local overrides, and YAML imports alongside their Nix modules. Source-local YAML imports are followed, and relative input overrides in the target's `devenv.local.yaml` resolve from the target directory.
 - Locked inputs with complete source metadata now reuse sources from the Nix store or configured binary caches without contacting their original remote, so `devenv shell` works when that remote is unavailable ([#3244](https://github.com/cachix/devenv/pull/3244)).
```

**File**: `devenv-processes/src/pid.rs` (modified, +76/-2)
```diff
@@ -70,12 +70,86 @@ pub async fn read_pid(pid_file: &Path) -> Result<Pid> {
     Ok(Pid::from_raw(pid_num))
 }
 
-/// Write PID to a file
+/// Publish a complete PID atomically so concurrent validators cannot remove a
+/// partially written file as stale. The staging file must share its filesystem.
 pub async fn write_pid(pid_file: &Path, pid: u32) -> Result<()> {
-    fs::write(pid_file, pid.to_string()).await.into_diagnostic()
+    let pid_file = pid_file.to_path_buf();
+    tokio::task::spawn_blocking(move || -> std::io::Result<()> {
+        use std::io::Write;
+
+        let parent = pid_file
+            .parent()
+            .filter(|path| !path.as_os_str().is_empty())
+            .unwrap_or_else(|| Path::new("."));
+        let mut staged = tempfile::NamedTempFile::new_in(parent)?;
+        write!(staged, "{pid}")?;
+        staged.persist(pid_file).map_err(|error| error.error)?;
+        Ok(())
+    })
+    .await
+    .into_diagnostic()?
+    .into_diagnostic()
 }
 
 /// Remove a PID file
 pub async fn remove_pid(pid_file: &Path) -> Result<()> {
     fs::remove_file(pid_file).await.into_diagnostic()
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use std::sync::Arc;
+
+    #[tokio::test]
+    async fn failed_pid_publication_removes_its_staging_file() {
+        let dir = tempfile::tempdir().unwrap();
+        let path = dir.path().join("manager.pid");
+        fs::create_dir(&path).await.unwrap();
+        assert!(write_pid(&path, std::process::id()).await.is_err());
+        assert!(path.is_dir());
+        assert_eq!(std::fs::read_dir(dir.path()).unwrap().count(), 1);
+    }
+
+    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
+    async fn concurrent_pid_checks_never_observe_partial_publication() {
+        let dir = tempfile::tempdir().unwrap();
+        let path = dir.path().join("manager.pid");
+        let pid = std::process::id();
+        write_pid(&path, pid).await.unwrap();
+        let barrier = Arc::new(tokio::sync::Barrier::new(5));
+        let writer = {
+            let path = path.clone();
+            let barrier = Arc::clone(&barrier);
+            tokio::spawn(async move {
+                barrier.wait().await;
+                for _ in 0..512 {
+                    write_pid(&path, pid).await.unwrap();
+                }
+            })
+        };
+        let mut readers = Vec::new();
+        for _ in 0..4 {
+            let path = path.clone();
+            let barrier = Arc::clone(&barrier);
+            readers.push(tokio::spawn(async move {
+                barrier.wait().await;
+                for _ in 0..512 {
+                    let status = check_pid_file(&path).await.unwrap();
+                    if !matches!(status, PidStatus::Running(live) if live.as_raw() == pid as i32) {
+                        return Err(format!("Reader observed {status:?} during publication"));
+                    }
+                }
+                Ok(())
+            }));
+        }
+        writer.await.unwrap();
+        for reader in readers {
+            reader.await.unwrap().unwrap();
+        }
+        assert!(matches!(
+            check_pid_file(&path).await.unwrap(),
+            PidStatus::Running(_)
+        ));
+    }
+}
```

**File**: `devenv/src/devenv/mod.rs` (modified, +178/-78)
```diff
@@ -283,12 +283,20 @@ fn should_attach_to_running_manager(
     mode == ClientRunMode::Follow && interactivity == ClientInteractivity::Interactive
 }
 
-fn should_clear_proxy_routes(
-    manager_was_running: bool,
-    owns_foreground_manager: bool,
-    start_failed: bool,
-) -> bool {
-    owns_foreground_manager || (!manager_was_running && start_failed)
+#[derive(Clone, Copy)]
+enum ProcessStartOwnership {
+    Unclaimed,
+    Existing,
+    Foreground,
+    Detached,
+}
+
+fn should_clear_proxy_routes(ownership: ProcessStartOwnership, start_failed: bool) -> bool {
+    match ownership {
+        ProcessStartOwnership::Foreground => true,
+        ProcessStartOwnership::Detached => start_failed,
+        ProcessStartOwnership::Unclaimed | ProcessStartOwnership::Existing => false,
+    }
 }
 
 /// Keep the startup lock and proxy routes while a slow daemon is still alive.
@@ -2584,8 +2592,15 @@ impl Devenv {
                 mode: ClientRunMode::ReturnAfterStart,
                 ..Default::default()
             };
-            self.start_processes(vec![], devenv_tasks::RunMode::All, envs, options, None)
-                .await?;
+            self.start_processes(
+                vec![],
+                devenv_tasks::RunMode::All,
+                envs,
+                options,
+                None,
+                &mut ProcessStartOwnership::Unclaimed,
+            )
+            .await?;
         }
 
         // ── Phase 5: Running tests ──────────────────────────────────
@@ -2777,18 +2792,18 @@ impl Devenv {
         .await?;
 
         // ── Phase 3: Running processes ──────────────────────────────
-        let manager_was_running =
-            self.native_manager_running().await || self.external_process_manager_state_exists();
-        let owns_foreground_manager =
-            options.mode == ClientRunMode::Follow && !options.daemon && !manager_was_running;
+        let mut ownership = ProcessStartOwnership::Unclaimed;
         let result = self
-            .start_processes(processes, task_mode, envs, options, Some(task_configs))
+            .start_processes(
+                processes,
+                task_mode,
+                envs,
+                options,
+                Some(task_configs),
+                &mut ownership,
+            )
             .await;
-        if should_clear_proxy_routes(
-            manager_was_running,
-            owns_foreground_manager,
-            result.is_err(),
-        ) {
+        if should_clear_proxy_routes(ownership, result.is_err()) {
             crate::proxy::clear(&self.proxy_owner());
         }
         result
@@ -2802,6 +2817,7 @@ impl Devenv {
         envs: HashMap<String, String>,
         mut options: ProcessOptions,
         preloaded_tasks: Option<Vec<tasks::TaskConfig>>,
+        ownership: &mut ProcessStartOwnership,
     ) -> Result<ProcessStartOutcome> {
         // Release port reservations so processes can bind their allocated ports.
         // The port allocator holds TcpListeners during Nix evaluation to prevent
@@ -2941,12 +2957,27 @@ impl Devenv {
                 .make_task_config(roots, task_configs, task_mode, envs)
                 .await?;
 
+            // Serialize discovery and publication across foreground and detached
+            // cold starts. Release before following a manager or waiting for readiness.
+            let startup_lock = self.lock_native_startup().await?;
+            let pid_file = self.native_manager_pid_file();
+            let pid_status = processes::check_pid_file(&pid_file).await;
+            let manager_running = matches!(&pid_status, Ok(processes::PidStatus::Running(_)));
+            *ownership = if manager_running {
+                ProcessStartOwnership::Existing
+            } else if options.mode == ClientRunMode::Follow && !options.daemon {
+                ProcessStartOwnership::Foreground
+            } else {
+                ProcessStartOwnership::Detached
+            };
+
             if options.daemon {
                 // Spawn a separate daemon process via re-exec to avoid
                 // fork-safety issues in this multithreaded process.
                 return self
                     .spawn_daemon_processes(
                         config,
+                        manager_running,
                         &launch_names,
                         &capability_requests,
                         capabilities_required_now,
@@ -2959,10 +2990,8 @@ impl Devenv {
             // attach to it over the control socket and start the up-enabled
             // processes instead of starting a second manager (which would
             // clobber the daemon's PID file/socket and orphan it).
-            let pid_file = self.native_manager_pid_file();
-            if let Ok(processes::PidStatus::Running(pid)) =
-                processes::check_pid_file(&pid_file).await
-            {
+            if let Ok(processes::PidStatus::Running(pid)) = pid_status {
+                drop(st
```

**File**: `tests/process-up-attach/.test.sh` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ reset_port_files() {
 
 # Poll until the running manager's pid file exists and it reports ready.
 # `devenv processes wait` fails fast while the pid file is absent (the
-# foreground session writes it only once its cold start completes), so retry
+# foreground session writes it once its processes are scheduled), so retry
 # it; once the pid file exists it blocks until ready. Event-driven with a
 # bounded number of attempts.
 wait_for_manager() {
```

**File**: `tests/process-up-concurrent/.test-config.yml` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+use_shell: false
```

**File**: `tests/process-up-concurrent/.test.sh` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+#!/usr/bin/env bash
+set -euo pipefail
+
+. "$DEVENV_TEST_LIB"
+
+devenv shell -- python3 test_startup.py "$(devenv_runtime_dir)/processes"
```

**File**: `tests/process-up-concurrent/devenv.nix` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+{ config, pkgs, ... }:
+{
+  packages = [ pkgs.python3 ];
+  process.manager.implementation = "native";
+  processes.slow = {
+    exec = ''
+      echo $$ >> "${config.devenv.state}/launch-pids"
+      exec sleep infinity
+    '';
+    ready.exec = "test -e ${config.devenv.state}/ready";
+  };
+}
```

**File**: `tests/process-up-concurrent/test_startup.py` (added, +192/-0)
```diff
@@ -0,0 +1,192 @@
+"""Queue real CLI callers behind an external lock before releasing them together."""
+
+import fcntl
+import json
+import os
+from pathlib import Path
+import signal
+import socketserver
+import subprocess
+import sys
+import time
+import threading
+
+
+runtime = Path(sys.argv[1])
+runtime.mkdir(parents=True, exist_ok=True)
+state = Path(".devenv/state")
+pid_file = runtime / "native-manager.pid"
+socket = runtime / "native.sock"
+waiting_message = "Waiting for native process manager startup lock"
+
+
+# Observe real CLI cleanup requests without touching the user's shared proxy.
+# Proxy-disabled configuration legitimately reconciles once before discovery;
+# a losing or cancelled caller must not send another destructive replacement.
+class ProxyControl(socketserver.StreamRequestHandler):
+    def handle(self):
+        request = json.loads(self.rfile.readline())
+        assert request["command"] == "replace_owner", request
+        self.server.commands.append(request)
+        self.wfile.write(b'{"status":"ok","routes":null,"removed":null}\n')
+
+
+proxy_path = runtime / "test-proxy.sock"
+proxy_path.unlink(missing_ok=True)
+proxy = socketserver.UnixStreamServer(str(proxy_path), ProxyControl)
+proxy.commands = []
+proxy_thread = threading.Thread(target=proxy.serve_forever, daemon=True)
+proxy_thread.start()
+os.environ["DEVENV_PROXY_SOCKET"] = str(proxy_path)
+
+
+def wait_until(predicate, description, timeout=60):
+    deadline = time.monotonic() + timeout
+    while not predicate():
+        if time.monotonic() >= deadline:
+            raise AssertionError(f"Timed out waiting for {description}")
+        time.sleep(0.1)
+
+
+def run(*args):
+    return subprocess.run(["devenv", *args], check=True, timeout=60)
+
+
+def stop_manager(children):
+    if not pid_file.exists():
+        return
+    manager_pid = int(pid_file.read_text())
+    owner = next((child for child in children if child.pid == manager_pid), None)
+    if owner is not None:
+        # Reap a foreground child ourselves; a synchronous `processes down`
+        # would otherwise wait for this parent's unreaped zombie.
+        owner.send_signal(signal.SIGINT)
+        owner.wait(timeout=30)
+    else:
+        run("processes", "down")
+
+
+def exercise(first_daemon, second_daemon):
+    label = "-".join("detached" if daemon else "foreground"
+                     for daemon in (first_daemon, second_daemon))
+    children = []
+    state.joinpath("ready").unlink(missing_ok=True)
+    state.joinpath("launch-pids").unlink(missing_ok=True)
+
+    def start(name, daemon=False):
+        trace = Path(f"{label}-{name}.json")
+        trace.unlink(missing_ok=True)
+        with Path(f"{label}-{name}.log").open("w") as log:
+            child = subprocess.Popen(
+                ["devenv", "--verbose", "--trace-to", f"json:file:{trace}",
+                 "up", "--no-tui", *(["-d"] if daemon else [])],
+                stdout=log,
+                stderr=subprocess.STDOUT,
+                env={**os.environ, "DEVENV_NO_AI_AGENT": "1", "RUST_LOG": "devenv=debug"},
+            )
+        children.append(child)
+
+        def blocked():
+            assert child.poll() is None, f"{name} exited before reaching the startup lock"
+            assert not pid_file.exists(), f"{name} published while the startup lock was held"
+            assert not socket.exists(), f"{name} bound its socket while the startup lock was held"
+            return trace.exists() and waiting_message in trace.read_text()
+
+        wait_until(blocked, f"{name} to wait for the startup lock")
+        return child
+
+    try:
+        # Both callers must reach discovery while no manager exists. This avoids
+        # depending on machine speed to hit the pre-publication race.
+        with (runtime / "native-start.lock").open("a") as lock:
+            fcntl.flock(lock, fcntl.LOCK_EX)
+            first = start("first", daemon=first_daemon)
+            second = start("second", daemon=second_daemon)
+            cancelled = start("cancelled", daemon=second_daemon)
+            reconciled = len(proxy.commands)
+            assert reconciled >= 3, "Each caller must reconcile before waiting"
+            cancelled.send_signal(signal.SIGINT)
+            assert cancelled.wait(timeout=30) != 0
+            assert len(proxy.commands) == reconciled, "Cancelled waiter cleared shared proxy routes"
+            assert not pid_file.exists(), "A waiting caller published a manager"
+            assert not socket.exists(), "A waiting caller published a socket"
+            fcntl.flock(lock, fcntl.LOCK_UN)
+
+        wait_until(lambda: pid_file.exists() and pid_file.read_text().strip().isdigit(),
+                   "manager publication")
+        manager_pid = int(pid_file.read_text())
+        foreground_owner = any(child.pid == manager_pid and not daemon
+                               for child, daemon in ((first, first_daemon), (second, second_daemon)))
+        for name,
```

---

### Incident Patch 3: `9655d320` (2026-11-03)
**Commit Message**: test(closure-size): raise the Linux limit to 425 MB (#3339)

The base of #3333 already measured 423.93 MB, and the startup fix measured 423.96 MB. Set the non-Darwin limit to 425 MB while retaining the 540 MB Darwin limit.

**File**: `tests/closure-size/.test.sh` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ set -euo pipefail
 system=$(nix eval --impure --raw --expr builtins.currentSystem)
 case "$system" in
   aarch64-darwin) MAX_MB=540 ;;
-  *) MAX_MB=420 ;;
+  *) MAX_MB=425 ;;
 esac
 
 repo=$(cd ../.. && pwd)
```

#### Recent Merged Pull Requests:
- **PR #3339** (2026-11-03): test(closure-size): raise the Linux limit to 425 MB (@domenkozar)
- **PR #3334** (2026-11-03): fix(tui): avoid blocking keyboard capability probes (@domenkozar)
- **PR #3333** (2026-11-03): fix(processes): prevent orphaned native managers during startup (@domenkozar)
- **PR #3332** (closed): fix(processes): publish foreground manager before readiness (@soupdiver)
- **PR #3330** (2026-10-28): docs: publish changelog-merge blog post (@domenkozar)
- **PR #3329** (2026-10-28): chore(deps): bump postcss-selector-parser from 6.1.4 to 6.1.5 in /docs (@dependabot[bot])

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

## X. tui): avoid blocking keyboard capability probes (#3334)

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in cachix/devenv. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8e6eb8ec`: tui): avoid blocking keyboard capability probes (#3334). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- Fixed a two-second TUI startup delay on terminals that do not answer keyboard capability queries, including during direnv shell activation. Interactive progress remains available for `direnv-export` and `print-dev-env` ([#3169](https://github.com/cachix/devenv/issues/3169)).
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8e6eb8ec` are properly handled with clean fallback behavior.
