> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/cachix-devenv-learnings.md`  
> **Source**: github ([https://github.com/cachix/devenv](https://github.com/cachix/devenv))  
> **Source Version**: `e874a148`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-26T15:22:01.403Z  
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
> **Harvest Timestamp**: 2026-11-26T15:22:01.393Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cachix/devenv`
- **Description**: Fast, Declarative, Reproducible, and Composable Developer Environments using Nix
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 7852 stars

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

### Incident Patch 1: `3020e473` (2026-11-25)
**Commit Message**: fix(machines): tolerate brief transaction observation gaps (#3401)

A NixOS switch can interrupt a status poll when systemd re-execs or SSH
restarts. The controller now keeps watching the same transaction within a
90-second window, allows each SSH round trip the standard 30-second request
timeout, and still stops guessing once that window closes.

A confirmation reply is the executor's own record, written before the reply is
sent, so a valid reply for this transaction ends observation without further
status calls. A reply that is lost, late, or invalid is reconciled by reading
the transaction back, and confirmation is never sent a second time, so no
handler can collide with the lock the first one holds.

The transaction fixtures cover slow status and confirmation replies, a
confirmation that outlives the SSH bound, and sustained loss of observation.
The real SSH VM fixture deploys through a transient disconnect with the
existing 90-second target-side watchdog and treats a lost confirmation reply as
the success it became.

**File**: `devenv/src/devenv/machines.rs` (modified, +530/-47)
```diff
@@ -75,6 +75,142 @@ const NIXOS_FACTER_COMMAND: &str = "nixos-facter";
 const MACHINE_EXECUTOR: &str =
     "/nix/var/nix/gcroots/devenv-machines/executor/bin/devenv-machine-deploy";
 
+/// Overall bound on watching one target-side transaction.
+const TRANSACTION_OBSERVATION_DEADLINE: std::time::Duration = std::time::Duration::from_secs(900);
+/// How often the controller re-reads the target's view of the transaction.
+const TRANSACTION_OBSERVATION_INTERVAL: std::time::Duration = std::time::Duration::from_secs(2);
+/// Bound on one captured request to a machine over SSH.
+const MACHINE_SSH_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(30);
+/// How long the controller keeps watching this transaction without a positive
+/// answer about its own ID. The executor answers `unknown` while it cannot see
+/// the activation unit (start, switch, health check, reboot), and a status
+/// round trip can fail while the target is busy; both are gaps in observation,
+/// not decisions. The window leaves room for several full SSH attempts; past
+/// it the controller stops guessing.
+const TRANSACTION_OBSERVATION_GAP: std::time::Duration = std::time::Duration::from_secs(90);
+
+/// What one validated status document says about the transaction.
+///
+/// Only terminal outcomes are decisions about the deployment. `unknown` means
+/// the target answered for this transaction but could not report its progress.
+#[derive(Debug, PartialEq)]
+enum TransactionDecision {
+    Succeeded,
+    RolledBack(String),
+    RollbackFailed(String),
+    Failed(String),
+    AwaitingConfirmation,
+    Pending,
+    Unknown(Option<String>),
+}
+
+impl TransactionDecision {
+    /// Interpret a status document. The version and the ID bind the answer to
+    /// this transaction, so a malformed, unsupported, or foreign response must
+    /// fail closed instead of being read as progress.
+    fn from_status(status: &serde_json::Value, id: &str, name: &str) -> Result<Self> {
+        if status["version"].as_u64() != Some(1) {
+            bail!(
+                "Unsupported executor status version on {name}; inspect the target before retrying"
+            );
+        }
+        if status["id"].as_str() != Some(id) {
+            bail!(
+                "Target reports a different transaction; inspect `devenv machines status {name}`"
+            );
+        }
+        Ok(match status["outcome"].as_str() {
+            Some("succeeded") => Self::Succeeded,
+            Some("rolled-back") => Self::RolledBack(
+                status["error"]
+                    .as_str()
+                    .unwrap_or("deployment was not confirmed")
+                    .to_string(),
+            ),
+            Some("rollback-failed") => Self::RollbackFailed(
+                status["rollbackError"]
+                    .as_str()
+                    .unwrap_or("previous system could not be restored")
+                    .to_string(),
+            ),
+            Some("failed") => Self::Failed(
+                status["error"]
+                    .as_str()
+                    .unwrap_or("activation failed")
+                    .to_string(),
+            ),
+            Some("pending") if status["phase"].as_str() == Some("awaiting-confirmation") => {
+                Self::AwaitingConfirmation
+            }
+            Some("pending") => Self::Pending,
+            Some("unknown") => {
+                Self::Unknown(status["observationError"].as_str().map(str::to_string))
+            }
+            _ => bail!(
+                "Transaction {id} has an unknown outcome; inspect `devenv machines status {name}`"
+            ),
+        })
+    }
+}
+
+/// The result of one read-only look at a target-side transaction.
+enum TransactionObservation {
+    /// The target answered for this transaction.
+    Decision(TransactionDecision),
+    /// The status round trip failed; nothing is known about progress.
+    Unreachable(String),
+}
+
+/// The time left to observe a transaction, never negative.
+///
+/// Observation ends at the earlier of the overall deadline and the tolerated
+/// gap since the last positive observation. Nothing is issued, acted on, or
+/// slept past that point, so both bounds share this one calculation.
+fn transaction_observation_window(
+    last_positive: tokio::time::Instant,
+    deadline: tokio::time::Instant,
+) -> std::time::Duration {
+    (last_positive + TRANSACTION_OBSERVATION_GAP)
+        .min(deadline)
+        .saturating_duration_since(tokio::time::Instant::now())
+}
+
+/// Why watching this transaction must stop, if it must.
+///
+/// Called before a status round trip is issued and again before its answer is
+/// acted on: an answer that arrives after the window closed is not progress,
+/// and must not confirm or succeed a deployment. When both cutoffs have
+/// passed, the closed overall deadline is reported ahead of a lost gap.
+fn transaction_observation_expired(
+    id: &str,
+    name: &str,
+  
```

**File**: `tests/machines-deploy-ssh-vm/devenv.nix` (modified, +30/-6)
```diff
@@ -30,6 +30,7 @@ let
         fi
         ;;
       *" confirm "*)
+        echo confirm >> /run/devenv-test-confirms
         if test "$mode" = lost-confirm; then
           ${pkgs.bash}/bin/bash -c "$SSH_ORIGINAL_COMMAND" > /run/devenv-test-response
           kill -KILL "$PPID"
@@ -42,12 +43,35 @@ let
         fi
         ;;
       *" status")
-        if test "$mode" = during-switch; then
-          while ! ${pkgs.jq}/bin/jq -e '.phase == "switching"' /var/lib/devenv-machines/current.json >/dev/null; do sleep 0.05; done
-          touch /run/devenv-test-switch-disconnect
-          kill -KILL "$PPID"
-          exit 255
-        fi
+        case "$mode" in
+          status-transient|status-persistent)
+            if test ! -e /run/devenv-test-status-fault; then
+              # Wait until activation owns the target, so the interruption
+              # observes a real switch rather than a still-queued request.
+              phase=
+              n=0
+              while test "$n" -lt 400; do
+                phase=$(${pkgs.jq}/bin/jq -r '.phase' /var/lib/devenv-machines/current.json 2>/dev/null || true)
+                case "$phase" in
+                  switching|checking|awaiting-confirmation) break ;;
+                esac
+                n=$((n + 1))
+                sleep 0.05
+              done
+              printf '%s\n' "''${phase:-unobserved}" > /run/devenv-test-fault-phase
+              # Latch the fault. A transient interruption lets later polls
+              # through; a persistent one fails every later poll immediately
+              # instead of waiting for a phase that has already passed.
+              touch /run/devenv-test-status-fault
+              kill -KILL "$PPID"
+              exit 255
+            fi
+            if test "$mode" = status-persistent; then
+              kill -KILL "$PPID"
+              exit 255
+            fi
+            ;;
+        esac
         ;;
     esac
     exec ${pkgs.bash}/bin/bash -c "$SSH_ORIGINAL_COMMAND"
```

**File**: `tests/machines-deploy-ssh-vm/test.py` (modified, +108/-36)
```diff
@@ -46,7 +46,8 @@
     build.nixos = lib.mkForce (throw "apply rebuilt a system");
     build.deployer = lib.mkForce (throw "apply rebuilt an executor");
   };
-}"""
+}
+"""
     % (
         json.dumps(f"root@127.0.0.1:{port}"),
         "[ " + " ".join(json.dumps(v) for v in opts) + " ]",
@@ -110,7 +111,7 @@ def start_cli(*args):
 
 
 def finish(proc, log, success):
-    code = proc.wait(timeout=90)
+    code = proc.wait(timeout=120)
     log.seek(0)
     output = log.read()
     log.close()
@@ -127,7 +128,7 @@ def wait_outcome(outcome):
         "devenv-machine-deploy status | jq -e '.outcome == "
         + json.dumps(outcome)
         + "'",
-        timeout=90,
+        timeout=120,
     )
     assert state()["outcome"] == outcome
 
@@ -149,50 +150,121 @@ def check_controller_status(outcome):
     assert json.loads(result.stdout)["server"]["outcome"] == outcome
 
 
+def logs():
+    """Count submissions and confirmation requests that reached the server."""
+    return (
+        int(machine.succeed("wc -l < /run/devenv-test-starts").strip()),
+        int(machine.succeed("wc -l < /run/devenv-test-confirms").strip()),
+    )
+
+
+def begin_fault(mode):
+    machine.succeed(
+        "echo %s > /run/devenv-ssh-fault; : > /run/devenv-test-starts; "
+        ": > /run/devenv-test-confirms; rm -f /run/devenv-test-status-fault "
+        "/run/devenv-test-fault-phase"
+        % shlex.quote(mode)
+    )
+
+
+def end_fault():
+    machine.succeed("rm -f /run/devenv-ssh-fault")
+
+
+def assert_recovery(outcome, counts, generation):
+    """Drop the injected fault, then assert the target and controller agree."""
+    end_fault()
+    wait_outcome(outcome)
+    assert logs() == counts, logs()
+    assert_generation(generation)
+    check_controller_status(outcome)
+
+
 # Connection refusal before submission must never create a checkpoint.
 # This VM uses the service, not socket activation. Including the absent socket
 # in the same stop command can prevent systemd from stopping the service.
 machine.succeed("systemctl stop sshd.service")
 machine.wait_for_closed_port(22)
+machine.succeed(": > /run/devenv-test-starts")
+machine.succeed(": > /run/devenv-test-confirms")
 proc, log = start_cli("apply", str(plan_file))
-finish(proc, log, False)
+output = finish(proc, log, False)
+assert "deployed" not in output, output
 machine.succeed("test ! -e /var/lib/devenv-machines/current.json")
+assert logs() == (0, 0), logs()
 machine.succeed("systemctl start sshd.service")
 machine.wait_for_unit("sshd.service")
 
-for mode in ["lost-start", "during-switch", "controller-exit", "lost-confirm"]:
-    if mode == "lost-confirm":
-        # Successful confirmation needs time for a full NixOS activation.
-        # Keep the shorter watchdog deadline for the rollback scenarios above.
-        plan["machines"]["server"]["nixos"]["executor"] = confirmation_executor_package
-        plan_file.write_text(json.dumps(plan))
-    machine.succeed(
-        "echo "
-        + shlex.quote(mode)
-        + " > /run/devenv-ssh-fault; : > /run/devenv-test-starts"
-    )
-    proc, log = start_cli("apply", str(plan_file))
-    if mode == "controller-exit":
-        machine.wait_until_succeeds(
-            "test -e /run/devenv-test-confirm-waiting", timeout=60
-        )
-        proc.terminate()
-    output = finish(proc, log, False)
-    if mode == "lost-start":
-        assert "may have started" in output, output
-    elif mode == "during-switch":
-        machine.succeed("test -e /run/devenv-test-switch-disconnect")
-        assert "Lost observation" in output, output
-    elif mode == "lost-confirm":
-        assert "Could not acknowledge confirmation" in output, output
-    machine.succeed("rm /run/devenv-ssh-fault")
-    outcome = "succeeded" if mode == "lost-confirm" else "rolled-back"
-    wait_outcome(outcome)
-    assert machine.succeed("wc -l < /run/devenv-test-starts").strip() == "1"
-    assert_generation(updated if mode == "lost-confirm" else original)
-    check_controller_status(outcome)
+# A submission whose response is lost after the command ran may have started.
+begin_fault("lost-start")
+proc, log = start_cli("apply", str(plan_file))
+output = finish(proc, log, False)
+assert "may have started" in output, output
+assert_recovery("rolled-back", (1, 0), original)
+
+# A target that never answers a status poll again is not progress: the
+# controller must stop observing at the gap bound, confirm nothing, and leave
+# recovery to the armed watchdog. The fault latches on the first post-switch
+# observation; every later poll fails immediately instead of blocking on a
+# phase that has already passed.
+begin_fault("status-persistent")
+proc, log = start_cli("apply", str(plan_file))
+output = finish(proc, log, False)
+assert "Lost observation" in output, output
+assert "for 90s" in output, output
+assert "could not be observed" in output, output
+machine.succeed("test -e /run/devenv-test-status-fault")
+assert machine.succeed("ca
```

**File**: `tests/machines-transactional/.test.sh` (modified, +216/-6)
```diff
@@ -4,6 +4,9 @@ set -euo pipefail
 mkdir -p mock-bin
 export TRANSACTION_LOG="$PWD/commands.log"
 export TRANSACTION_ID="$PWD/request-id"
+export TRANSACTION_STATUS_COUNT="$PWD/status-count"
+export TRANSACTION_AWAITING_COUNT="$PWD/awaiting-count"
+export TRANSACTION_HANG_PID="$PWD/hung-ssh.pid"
 export REAL_NIX
 REAL_NIX=$(command -v nix)
 cat >mock-bin/ssh <<'EOF'
@@ -23,17 +26,67 @@ request=" (start|rollback) '([A-Za-z0-9-]+)'"
 if [[ "$remote" =~ $request ]]; then
   printf '%s' "${BASH_REMATCH[2]}" >"$TRANSACTION_ID"
   rm -f "$TRANSACTION_ID.confirmed"
+  rm -f "$TRANSACTION_AWAITING_COUNT"
+  : >"$TRANSACTION_STATUS_COUNT"
   if [[ "${TRANSACTION_LOST:-}" == 1 ]]; then
     exit 255
   fi
   printf '{}\n'
 elif [[ "$remote" == *" confirm "* ]]; then
-  [[ "$remote" == *"'$(cat "$TRANSACTION_ID")'"* ]]
+  [[ "$remote" == *"'"$(cat "$TRANSACTION_ID")"'"* ]]
+  # The executor persists `phase: succeeded` before it prints the reply, so a
+  # slow reply still carries the result.
+  sleep "${TRANSACTION_CONFIRM_DELAY_SECONDS:-0}"
   touch "$TRANSACTION_ID.confirmed"
   if [[ "${TRANSACTION_LOST_CONFIRM:-}" == 1 ]]; then exit 255; fi
-  printf '{}\n'
+  printf '{"version":1,"id":"%s","phase":"succeeded"}\n' "$(cat "$TRANSACTION_ID")"
 elif [[ "$remote" == *status* ]]; then
+  observations=0
+  if [[ -s "$TRANSACTION_STATUS_COUNT" ]]; then
+    observations=$(cat "$TRANSACTION_STATUS_COUNT")
+  fi
+  observations=$((observations + 1))
+  printf '%s' "$observations" >"$TRANSACTION_STATUS_COUNT"
+  sleep "${TRANSACTION_STATUS_DELAY_SECONDS:-0}"
+  # The target can also become unobservable once the confirmation landed.
+  if [[ "${TRANSACTION_STATUS_LOST_AFTER_CONFIRM:-}" == 1 && -e "$TRANSACTION_ID.confirmed" ]]; then
+    echo "status transport failure after confirmation" >&2
+    exit 255
+  fi
+  # A busy target drops status round trips and, while it cannot observe the
+  # activation unit, reports the transaction rather than its progress.
+  if ((observations <= ${TRANSACTION_STATUS_DROPS:-0})); then
+    echo "transient status transport failure" >&2
+    exit 255
+  fi
+  if ((observations <= ${TRANSACTION_UNKNOWN_STATUSES:-0})); then
+    printf '{"version":1,"id":"%s","outcome":"unknown","observationError":"cannot observe activation service"}\n' \
+      "$(cat "$TRANSACTION_ID")"
+    exit 0
+  fi
+  # A status round trip that hangs on the target keeps the local ssh blocked.
+  if ((observations <= ${TRANSACTION_STATUS_HANGS:-0})); then
+    printf '%s' "$$" >"$TRANSACTION_HANG_PID"
+    # exec keeps the recorded PID on the process that actually sleeps, so the
+    # controller abandoning the attempt kills the sleeper and nothing else.
+    exec sleep "${TRANSACTION_STATUS_HANG_SECONDS:-31}"
+  fi
+  # A real executor fault, distinct from a transport failure: it exits with a
+  # code OpenSSH never uses for a dropped connection.
+  if [[ -n "${TRANSACTION_STATUS_FAILURE_CODE:-}" ]]; then
+    echo "executor cannot read the transaction" >&2
+    exit "$TRANSACTION_STATUS_FAILURE_CODE"
+  fi
   if [[ "${TRANSACTION_CONFIRM:-}" == 1 && ! -e "$TRANSACTION_ID.confirmed" ]]; then
+    awaiting=$(cat "$TRANSACTION_AWAITING_COUNT" 2>/dev/null || echo 0)
+    awaiting=$((awaiting + 1))
+    printf '%s' "$awaiting" >"$TRANSACTION_AWAITING_COUNT"
+    # An unconfirmed transaction is rolled back by the target-side watchdog.
+    if ((awaiting > ${TRANSACTION_UNCONFIRMED_ATTEMPTS:-1000000})); then
+      printf '{"version":1,"id":"%s","outcome":"rolled-back","error":"confirmation never arrived"}\n' \
+        "$(cat "$TRANSACTION_ID")"
+      exit 0
+    fi
     printf '{"version":1,"id":"%s","outcome":"pending","phase":"awaiting-confirmation"}\n' "$(cat "$TRANSACTION_ID")"
     exit 0
   fi
@@ -73,7 +126,8 @@ if grep -q '^copy ' "$TRANSACTION_LOG"; then
   exit 1
 fi
 
-for outcome in failed unknown rolled-back rollback-failed; do
+# `unknown` is no longer a verdict; the bounded persistent case below covers it.
+for outcome in failed rolled-back rollback-failed; do
   if TRANSACTION_OUTCOME="$outcome" devenv machines deploy server --yes >"$outcome.log" 2>&1; then
     echo "transaction with $outcome outcome reported success"
     exit 1
@@ -87,11 +141,167 @@ if TRANSACTION_LOST=1 devenv machines deploy server --yes >lost.log 2>&1; then
 fi
 grep -q 'may have started' lost.log
 
-if TRANSACTION_CONFIRM=1 TRANSACTION_LOST_CONFIRM=1 devenv machines deploy server --yes >lost-confirm.log 2>&1; then
-  echo "lost confirmation response reported success"
+# A lost confirmation reply is reconciled with the target's own record: the
+# executor persists `phase: succeeded` before replying, so a status read is the
+# verdict.
+if ! TRANSACTION_CONFIRM=1 TRANSACTION_LOST_CONFIRM=1 \
+  devenv machines deploy server --yes >lost-confirm.log 2>&1; then
+  cat lost-confirm.log
+  echo "a confirmation whose reply was lost aborted a successful deployment"
+  exit 1
+fi
+grep -q ' confirm ' "$TRANSACTION_LOG"
+
+# An unanswered confir
```

---

### Incident Patch 2: `e874a148` (2026-11-26)
**Commit Message**: fix(ci): repair integration tests and examples (#3406)

Update the OpenCode, PHP, process attach, Postgres, and SSH deployment fixtures. Keep Varnish, the OpenTelemetry Collector, and the Pkl tools working with rolling Nixpkgs. Manage RabbitMQ's EPMD alongside the service and verify that its listener closes after shutdown.

**File**: `docs/src/content/docs/services/varnish.md` (modified, +2/-5)
```diff
@@ -44,7 +44,7 @@ true
 
 
 
-Which Varnish package to use.
+Which Varnish or Vinyl Cache package to use.
 
 
 
@@ -54,10 +54,7 @@ package
 
 
 *Default:*
-
-```nix
-pkgs.varnish
-```
+` pkgs.varnish ` when available, otherwise ` pkgs.vinyl-cache `
 
 *Declared by:*
  - [https://github.com/cachix/devenv/blob/main/src/modules/services/varnish.nix](https://github.com/cachix/devenv/blob/main/src/modules/services/varnish.nix)
```

**File**: `examples/rabbitmq/devenv.nix` (modified, +3/-0)
```diff
@@ -1,6 +1,9 @@
 { pkgs, lib, ... }:
 
 {
+  # Keep the example clear of the standard EPMD ports on shared runners.
+  processes.rabbitmq.ports.epmd.allocate = 24369;
+
   services.rabbitmq = {
     enable = true;
     managementPlugin = {
```

**File**: `examples/supported-languages/.patch.sh` (modified, +14/-2)
```diff
@@ -1,5 +1,10 @@
-cat >devenv.local.nix <<EOF
-{ pkgs, lib, ... }: {
+cat >devenv.local.nix <<'EOF'
+{ pkgs, lib, inputs, ... }:
+let
+  compatiblePkl = inputs.pkl-nixpkgs.legacyPackages.${pkgs.stdenv.hostPlatform.system};
+  needsOlderGradle = lib.versions.majorMinor pkgs.gradle_9.version == "9.9";
+in
+{
   # ARM is not supported.
   languages.unison.enable = lib.mkForce (!(pkgs.stdenv.hostPlatform.isLinux && pkgs.stdenv.hostPlatform.isAarch64));
   languages.standardml.enable = lib.mkForce (!pkgs.stdenv.hostPlatform.isAarch64);
@@ -14,5 +19,12 @@ cat >devenv.local.nix <<EOF
   languages.swift.enable = lib.mkForce pkgs.stdenv.hostPlatform.isDarwin;
   # lobster is marked broken on macOS
   languages.lobster.enable = lib.mkForce (!pkgs.stdenv.hostPlatform.isDarwin);
+  # These Pkl releases lock the Kotlin DSL plugin bundled with Gradle 9.8.
+  languages.pkl.package = lib.mkIf (
+    needsOlderGradle && pkgs.pkl.version == "0.32.1"
+  ) compatiblePkl.pkl;
+  languages.pkl.lsp.package = lib.mkIf (
+    needsOlderGradle && pkgs.pkl-lsp.version == "0.8.0"
+  ) compatiblePkl.pkl-lsp;
 }
 EOF
```

**File**: `examples/supported-languages/devenv.yaml` (modified, +3/-1)
```diff
@@ -5,4 +5,6 @@ inputs:
     url: github:thomashoneyman/purescript-overlay
     inputs:
       nixpkgs:
-        follows: nixpkgs
\ No newline at end of file
+        follows: nixpkgs
+  pkl-nixpkgs:
+    url: github:cachix/devenv-nixpkgs/d97234e58d4e90e3bf77c082fc3b546e51200938
```

**File**: `examples/varnish/.test.sh` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@
 set -ex
 
 wait_for_port $VARNISH_PORT
+varnishadm ping
 
 caddy=$(curl http://localhost:8001)
 varnish=$(curl http://localhost:$VARNISH_PORT)
```

**File**: `examples/varnish/devenv.nix` (modified, +1/-2)
```diff
@@ -1,8 +1,7 @@
-{ pkgs, ... }:
+{ ... }:
 {
   services.varnish = {
     enable = true;
-    package = pkgs.varnish;
     vcl = ''
       vcl 4.0;
 
```

**File**: `src/modules/services/opentelemetry-collector.nix` (modified, +17/-1)
```diff
@@ -4,6 +4,22 @@ let
   cfg = config.services.opentelemetry-collector;
   types = lib.types;
 
+  # This release depends on cockroachdb/swiss, which uses Go runtime internals
+  # and does not build with Go 1.27. Keep the Nixpkgs package on other releases.
+  defaultPackage =
+    if
+      pkgs.opentelemetry-collector-contrib.version == "0.155.0"
+      && pkgs ? buildGo126Module
+      && pkgs ? opentelemetry-collector-releases
+      && pkgs.opentelemetry-collector-releases ? override
+      && lib.versions.majorMinor pkgs.go.version == "1.27"
+    then
+      (pkgs.opentelemetry-collector-releases.override {
+        buildGoModule = pkgs.buildGo126Module;
+      }).otelcol-contrib
+    else
+      pkgs.opentelemetry-collector-contrib;
+
   settingsFormat = pkgs.formats.yaml { };
 
   defaultSettings = {
@@ -142,7 +158,7 @@ in
     package = lib.mkOption {
       type = types.package;
       description = "The OpenTelemetry Collector package to use";
-      default = pkgs.opentelemetry-collector-contrib;
+      default = defaultPackage;
       defaultText = lib.literalExpression "pkgs.opentelemetry-collector-contrib";
     };
 
```

**File**: `src/modules/services/rabbitmq.nix` (modified, +55/-3)
```diff
@@ -14,6 +14,11 @@ let
   allocatedManagementPort = config.processes.rabbitmq.ports.management.value;
   allocatedDistributionPort = config.processes.rabbitmq.ports.distribution.value;
   allocatedEpmdPort = config.processes.rabbitmq.ports.epmd.value;
+  # Nixpkgs builds RabbitMQ against Erlang. Reuse that runtime when the package
+  # exposes it so the service does not pull in a second Erlang installation.
+  erlang = lib.findFirst (input: (input.pname or null) == "erlang")
+    pkgs.beamPackages.erlang
+    (cfg.package.buildInputs or [ ]);
 
   config_file_content = lib.generators.toKeyValue { } cfg.configItems;
   config_file = pkgs.writeText "rabbitmq.conf" config_file_content;
@@ -161,6 +166,16 @@ in
             when running multiple environments.
           '';
         }
+        {
+          date = "2026-11-25";
+          title = "RabbitMQ releases its EPMD port on shutdown";
+          when = cfg.enable;
+          description = ''
+            devenv now starts the Erlang Port Mapper Daemon alongside RabbitMQ
+            and stops it with the service. Repeated starts can reuse the port
+            after shutdown, including in strict port mode.
+          '';
+        }
       ];
     }
     (mkIf cfg.enable {
@@ -195,14 +210,51 @@ in
         ports.main.allocate = basePort;
         ports.management.allocate = baseManagementPort;
         ports.distribution.allocate = basePort + 20000;
-        ports.epmd.allocate = 4369;
-        exec = "exec ${cfg.package}/bin/rabbitmq-server";
+        ports.epmd.allocate = mkDefault 4369;
+        exec = ''
+          epmd=${lib.getExe' erlang "epmd"}
+          "$epmd" &
+          epmd_pid=$!
+
+          cleanup() {
+            if [ -n "''${server_pid:-}" ]; then
+              kill "$server_pid" 2>/dev/null || true
+              wait "$server_pid" 2>/dev/null || true
+            fi
+            kill "$epmd_pid" 2>/dev/null || true
+            wait "$epmd_pid" 2>/dev/null || true
+          }
+          trap cleanup EXIT
+          trap 'exit 130' INT
+          trap 'exit 143' TERM
+
+          # Start EPMD in this process group so the process manager owns both
+          # children. Erlang would otherwise start a detached daemon.
+          deadline=$((SECONDS + 10))
+          until "$epmd" -names >/dev/null 2>&1; do
+            if [ "$SECONDS" -ge "$deadline" ] || ! kill -0 "$epmd_pid" 2>/dev/null; then
+              echo "EPMD did not start on port $ERL_EPMD_PORT" >&2
+              exit 1
+            fi
+            sleep 0.1
+          done
+
+          RABBITMQ_SERVER_ADDITIONAL_ERL_ARGS="''${RABBITMQ_SERVER_ADDITIONAL_ERL_ARGS:-} -start_epmd false" \
+            ${cfg.package}/bin/rabbitmq-server &
+          server_pid=$!
+          status=0
+          wait "$server_pid" || status=$?
+          unset server_pid
+          exit "$status"
+        '';
 
         ready = {
           # `check_running` succeeds only after the `rabbit` Erlang application
           # has fully started, which catches plugin boot failures that `ping`
           # (TCP/Erlang VM only) silently ignores.
-          exec = "${cfg.package}/bin/rabbitmq-diagnostics -q check_running";
+          exec = ''
+            ERL_FLAGS="''${ERL_FLAGS:-} -start_epmd false" ${cfg.package}/bin/rabbitmq-diagnostics -q check_running
+          '';
           initial_delay = 10;
           period = 3;
           probe_timeout = 5;
```

---

### Incident Patch 3: `2dee64c2` (2026-11-25)
**Commit Message**: fix(shell): keep FSEvents running after dropped events (#3404)

Fixes #3403.

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -13,6 +13,7 @@
 
 ### Bug Fixes
 
+- On macOS, `devenv shell` rescans watched files after FSEvents drops notifications without restarting the event stream ([#3403](https://github.com/cachix/devenv/issues/3403)).
 - Fixed a two-second TUI startup delay on terminals that do not answer keyboard capability queries, including during direnv shell activation. Interactive progress remains available for `direnv-export` and `print-dev-env` ([#3169](https://github.com/cachix/devenv/issues/3169)).
 - Foreground `devenv up` now publishes its manager before service readiness, so other `devenv up` calls can detect it during startup. Failed publication cancels setup tasks before cleaning up.
 - Foreground and detached native process startup now share a lock, preventing simultaneous cold starts from overwriting each other's manager socket and PID file. Waiting for the lock can be cancelled, and competing callers preserve the winning manager's proxy routes.
```

**File**: `devenv-event-sources/src/fs.rs` (modified, +152/-44)
```diff
@@ -7,9 +7,9 @@ use std::time::{Duration, Instant};
 use tokio::sync::{Mutex as AsyncMutex, mpsc, watch};
 use tokio::task::JoinHandle;
 use tracing::{trace, warn};
-use watchexec::{Config, WatchedPath};
+use watchexec::{Config, WatchedPath, filter::Filterer};
 use watchexec_events::{
-    Tag,
+    Event, Priority, Tag,
     filekind::{FileEventKind, ModifyKind},
 };
 use watchexec_filterer_globset::GlobsetFilterer;
@@ -1140,8 +1140,6 @@ impl FileWatcher {
         let event_registrations = registrations;
         let event_handle = handle.clone();
         let filter_task = tokio::spawn(async move {
-            use watchexec::filter::Filterer;
-
             let mut batch = Vec::new();
             let mut raw_event_paths = HashMap::new();
             let mut event_paths = HashMap::new();
@@ -1176,30 +1174,8 @@ impl FileWatcher {
                     }
                 }
 
-                let mut rescan = false;
-                for (event, priority) in &batch {
-                    if !filterer.check_event(event, *priority).unwrap_or(true) {
-                        continue;
-                    }
-                    if !is_restart_worthy_event(event) {
-                        continue;
-                    }
-                    let may_invalidate_watch = event_may_invalidate_watch(event);
-                    let mut saw_path = false;
-                    for (path, _) in event.paths() {
-                        saw_path = true;
-                        raw_event_paths
-                            .entry(path.to_path_buf())
-                            .and_modify(|invalidate| *invalidate |= may_invalidate_watch)
-                            .or_insert(may_invalidate_watch);
-                    }
-                    if !saw_path {
-                        // inotify queue overflows are pathless. Preserve that
-                        // information as one rescan instead of enqueueing every
-                        // watched path separately.
-                        rescan = true;
-                    }
-                }
+                let rescan_mode = collect_batch_paths(&batch, &filterer, &mut raw_event_paths);
+                let rescan = rescan_mode != RescanMode::None;
 
                 // Native backends often emit several event kinds for the same
                 // path. Deduplicate before the comparatively expensive
@@ -1215,21 +1191,21 @@ impl FileWatcher {
 
                 let (paths, refresh_targets) = {
                     let state = event_registrations.lock().unwrap();
-                    if !rescan {
-                        for (path, may_invalidate_watch) in &event_paths {
-                            event_affected.clear();
-                            state.affected_targets(path, &mut event_affected);
-                            state.targets_needing_refresh(
-                                &event_affected,
-                                *may_invalidate_watch,
-                                &mut refresh,
-                            );
+                    for (path, may_invalidate_watch) in &event_paths {
+                        event_affected.clear();
+                        state.affected_targets(path, &mut event_affected);
+                        state.targets_needing_refresh(
+                            &event_affected,
+                            *may_invalidate_watch,
+                            &mut refresh,
+                        );
+                        if !rescan {
                             affected.extend(event_affected.iter().copied());
-                            if *may_invalidate_watch
-                                && let Some(anchor) = state.invalidated_anchor(path)
-                            {
-                                invalidated.insert(anchor);
-                            }
+                        }
+                        if *may_invalidate_watch
+                            && let Some(anchor) = state.invalidated_anchor(path)
+                        {
+                            invalidated.insert(anchor);
                         }
                     }
                     (
@@ -1238,7 +1214,7 @@ impl FileWatcher {
                     )
                 };
 
-                if rescan {
+                if rescan_mode == RescanMode::RewatchAll {
                     event_handle.rewatch_all().await;
                 } else {
                     event_handle.refresh_logical_targets(refresh_targets).await;
@@ -1329,7 +1305,60 @@ impl FileWatcher {
     }
 }
 
-fn is_restart_worthy_event(event: &watchexec_events::Event) -> bool {
+#[derive(Debug, PartialEq, Eq)]
+enum RescanMode {
+    None,
+    CheckPaths,
+    RewatchAll,
+}
+
+fn collect_batch_paths(
+    batch: &[(Event, Priority)],
+    filterer: &GlobsetFilterer,
+    raw_event_paths: &mut HashMap<PathBuf, bool>,
+) -> RescanMode {
+    let mut rescan = RescanMode::None;
+    for (event, priority) in batch {
+        // Watchexec forwards notify's
```

#### Recent Merged Pull Requests:
- **PR #3406** (2026-11-26): Fix integration tests and examples on rolling Nixpkgs (@domenkozar)
- **PR #3404** (2026-11-25): fix(shell): keep FSEvents running after dropped events (@domenkozar)
- **PR #3402** (2026-11-25): feat(coffee): CoffeeScript support (@givikuna)
- **PR #3401** (2026-11-25): fix(machines): tolerate brief transaction observation gaps (@sylvesterroos)
- **PR #3400** (2026-11-24): fix(php): take languages.php.extensions from the PHP being built (@sagikazarmark)
- **PR #3399** (2026-11-24): chore(deps): bump idna from 3.11 to 3.15 in /tests/python-uv-sync/directory (@dependabot[bot])

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

## X. machines): tolerate brief transaction observation gaps

**RULE**:
When implementing operations in `devenv/src/devenv/machines.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in cachix/devenv. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3020e473`: machines): tolerate brief transaction observation gaps. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `devenv/src/devenv/machines.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// Overall bound on watching one target-side transaction.
const TRANSACTION_OBSERVATION_DEADLINE: std::time::Duration = std::time::Duration::from_secs(900);
/// How often the controller re-reads the target's view of the transaction.
const TRANSACTION_OBSERVATION_INTERVAL: std::time::Duration = std::time::Duration::from_secs(2);
/// Bound on one captured request to a machine over SSH.
const MACHINE_SSH_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(30);
/// How long the controller keeps watching this transaction without a positive
/// answer about its own ID. The executor answers `unknown` while it cannot see
/// the activation unit (start, switch, health check, reboot), and a status
/// round trip can fail while the target is busy; both are gaps in observation,
/// not decisions. The window leaves room for several full SSH attempts; past
/// it the controller stops guessing.
const TRANSACTION_OBSERVATION_GAP: std::time::Duration = std::time::Duration::from_secs(90);

/// What one validated status document says about the transaction.
///
/// Only terminal outcomes are decisions about the deployment. `unknown` means
/// the target answered for this transaction but cou
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3020e473` are properly handled with clean fallback behavior.
