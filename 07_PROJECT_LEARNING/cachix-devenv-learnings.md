# Forensic Learning Record (Deep Inspection): cachix/devenv

> **Canonical Artifact**: `07_PROJECT_LEARNING/cachix-devenv-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/cachix/devenv](https://github.com/cachix/devenv))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:38:42.182Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cachix/devenv`
- **Description**: Fast, Declarative, Reproducible, and Composable Developer Environments using Nix
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 7706 stars

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
use schematic::ConfigLoader;
use semver::{Version, VersionReq};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    fmt,
    path::{Path, PathBuf},
};

const YAML_CONFIG: &str = "devenv.yaml";
const YAML_LOCAL_CONFIG: &str = "devenv.local.yaml";

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

    /// Return host environment variables filtered by the clean/keep settings.
    ///
    /// When `enabled`, only variables whose name appears in `keep` or
    /// `ALWAYS_KEEP` are returned. Otherwise every 
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

### Core Architecture Module: `devenv-core/src/eval_op.rs`
```
//! Evaluation operation types and structured Nix effect parsing.
//!
//! Nix emits evaluation dependencies through a dedicated one-shot callback.
//! Keeping the wire conversion here means cache invalidation and the UI use
//! the same typed representation without depending on logger activities.

use std::path::PathBuf;
use std::sync::Arc;

/// A filesystem or environment operation observed during Nix evaluation.
///
/// These operations are used for cache invalidation and dependency tracking.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub enum EvalOp {
    /// Copied a source path to the Nix store.
    CopiedSource { source: PathBuf, target: PathBuf },
    /// Filtered a source tree and copied it to the Nix store.
    FilteredSource { source: PathBuf, target: PathBuf },
    /// Evaluated a Nix file.
    EvaluatedFile { source: PathBuf, cached: bool },
    /// Read a file's contents with `builtins.readFile`.
    ReadFile { source: PathBuf },
    /// List a directory's contents with `builtins.readDir`.
    ReadDir { source: PathBuf },
    /// Read a file type with `builtins.readFileType`.
    ReadFileType { source: PathBuf },
    /// Hashed a file with `builtins.hashFile`.
    HashFile { source: PathBuf, algorithm: String },
    /// Read an environment variable with `builtins.getEnv`.
    GetEnv { name: String },
    /// Check that a file exists with `builtins.pathExists`.
    PathExists { source: PathBuf },
}

/// Exact state captured at the moment an evaluation input was consumed.
///
/// Primops use this when re-reading the input later could associate a stale
/// evaluation result with newer file or environment state.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub enum EvalInputState {
    File {
        path: PathBuf,
        content_sha256: Option<String>,
    },
    Env {
        name: String,
        content_sha256: Option<String>,
    },
}

impl EvalInputState {
    pub fn operation(&self) -> EvalOp {
        match self {
            Self::File { path, .. } => EvalOp::ReadFile {
                source: path.clone(),
            },
            Self::Env { name, .. } => EvalOp::GetEnv { name: name.clone() },
        }
    }
}

/// Convert to the activity event type for serialization.
impl From<EvalOp> for devenv_activity::EvalOp {
    fn from(op: EvalOp) -> Self {
        match op {
            EvalOp::CopiedSource { source, target } => {
                devenv_activity::EvalOp::CopiedSource { source, target }
            }
            EvalOp::FilteredSource { source, target } => {
                devenv_activity::EvalOp::FilteredSource { source, target }
            }
            EvalOp::EvaluatedFile { source, cached } => {
                devenv_activity::EvalOp::EvaluatedFile { source, cached }
            }
            EvalOp::ReadFile { source } => devenv_activity::EvalOp::ReadFile { source },
            EvalOp::ReadDir { source } => devenv_activity::EvalOp::ReadDir { source },
            EvalOp::ReadFileType { source } => devenv_activity::EvalOp::ReadFileType { source },
            EvalOp::HashFile { source, algorithm } => {
                devenv_activity::EvalOp::HashFile { source, algorithm }
            }
            EvalOp::GetEnv { name } => devenv_activity::EvalOp::GetEnv { name },
            EvalOp::PathExists { source } => devenv_activity::EvalOp::PathExists { source },
        }
    }
}

impl EvalOp {
    /// Extract an operation from the dedicated one-shot evaluator effect
    /// callback. This is the canonical wire conversion used by the Nix FFI.
    pub fn from_effect(kind: &str, subject: &str, detail: Option<&str>) -> Option<Self> {
        let path = || PathBuf::from(subject);

        match (kind, detail) {
            ("copy-source", Some(target)) => Some(EvalOp::CopiedSource {
                source: path(),
                target: PathBuf::from(target),
            }),
            ("filter-source", Some(target)) => Some(EvalOp::FilteredSource {
                source: path(),
                target: PathBuf::from(target),
            }),
            ("evaluated-file", Some("cached")) => Some(EvalOp::EvaluatedFile {
                source: path(),
                cached: true,
            }),
            ("evaluated-file", Some("uncached")) => Some(EvalOp::EvaluatedFile {
                source: path(),
                cached: false,
            }),
            ("read-file", None) => Some(EvalOp::ReadFile { source: path() }),
            ("read-dir", None) => Some(EvalOp::ReadDir { source: path() }),
            ("read-file-type", None) => Some(EvalOp::ReadFileType { source: path() }),
            ("hash-file", Some(algorithm)) if !algorithm.is_empty() => Some(EvalOp::HashFile {
                source: path(),
                algorithm: algorithm.to_owned(),
            }),
            ("get-env", None) => Some(EvalOp::GetEnv {
                name: subject.to_owned(),
            }),
            ("path-exists", None) => Some(EvalOp::PathExists { source: path() }),
            _ => None,
        }
    }
}

/// Observer trait for receiving evaluation operations.
///
/// Implementations can be registered with `NixLogBridge` to receive file and
/// environment dependencies during evaluation.
pub trait OpObserver: Send + Sync + 'static {
    /// Called when an operation is observed during evaluation.
    fn record(&self, op: EvalOp);

    /// Record both an input identity and the state actually consumed.
    fn record_input_state(&self, input: EvalInputState) {
        self.record(input.operation());
    }
}

/// Wrapper to allow `Arc<dyn OpObserver>` to implement `OpObserver`.
impl OpObserver for Arc<dyn OpObserver> {
    fn record(&self, op: EvalOp) {
        (**self).record(op);
    }

    fn record_input_state(&self, input: EvalInputState) {
        (**self).record_input_state(input);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_all_eval_effects() {
        let cases = [
            (
                "copy-source",
                "/source",
                Some("/nix/store/source"),
                EvalOp::CopiedSource {
                    source: "/source".into(),
                    target: "/nix/store/source".into(),
                },
            ),
            (
                "filter-source",
                "/source",
                Some("/nix/store/source"),
                EvalOp::FilteredSource {
                    source: "/source".into(),
                    target: "/nix/store/source".into(),
                },
            ),
            (
                "evaluated-file",
                "/default.nix",
                Some("cached"),
                EvalOp::EvaluatedFile {
                    source: "/default.nix".into(),
                    cached: true,
                },
            ),
            (
                "evaluated-file",
                "/default.nix",
                Some("uncached"),
                EvalOp::EvaluatedFile {
                    source: "/default.nix".into(),
                    cached: false,
                },
            ),
            (
                "read-file",
                "/file",
                None,
                EvalOp::ReadFile {
                    source: "/file".into(),
                },
            ),
            (
                "read-dir",
                "/dir",
                None,
                EvalOp::ReadDir {
                    source: "/dir".into(),
                },
            ),
            (
                "read-file-type",
                "/file",
                None,
                EvalOp::ReadFileType {
                    source: "/file".into(),
                },
            ),
            (
                "hash-file",
                "/file",
                Some("sha256"),
                EvalOp::HashFile {
                    source: "/file".into(),
                    algorithm: "sha256".into(),
                },
            ),
            (
                "get-env",
                "SOME_ENV",
                None,
                EvalOp::GetEnv {
                    name: "SOME_ENV".into(),
                },
            ),
            (
                "path-exists",
                "/file",
                None,
                EvalOp::PathExists {
                    source: "/file".into(),
                },
            ),
        ];

        for (kind, subject, detail, expected) in cases {
            assert_eq!(EvalOp::from_effect(kind, subject, detail), Some(expected));
        }
    }

    #[test]
    fn rejects_unknown_or_malformed_effects() {
        assert_eq!(EvalOp::from_effect("unknown", "/file", None), None);
        assert_eq!(
            EvalOp::from_effect("read-file", "/file", Some("unexpected")),
            None
        );
        assert_eq!(EvalOp::from_effect("copy-source", "/source", None), None);
        assert_eq!(
            EvalOp::from_effect("evaluated-file", "/file", Some("old")),
            None
        );
        assert_eq!(EvalOp::from_effect("hash-file", "/file", Some("")), None);
    }
}

```

### Core Architecture Module: `devenv-core/src/evaluator.rs`
```
//! Generic Nix evaluator interface.
//!
//! "A thing that can talk to Nix": evaluate attribute paths against the
//! project's devenv config root to JSON, build a derivation to store
//! paths, and surface a [`Store`] for the consumer. Nothing devenv-shaped
//! beyond the bootstrap-args contract (which the evaluator owns at
//! construction time, opaque-payload style). Anything else lives on
//! [`crate::Backend`].

use std::path::PathBuf;

use async_trait::async_trait;
use miette::Result;
use serde::{Deserialize, Serialize};

use crate::store::{Store, StorePath};

/// Options for [`Evaluator::build`].
#[derive(Clone, Debug, Default)]
pub struct BuildOptions {
    /// Optional GC root directory; if set, every output path gets a
    /// permanent GC root under this directory (named after the attr).
    pub gc_root: Option<PathBuf>,
}

/// Devenv shell environment build output.
#[derive(Debug, Clone, Default)]
pub struct DevEnvOutput {
    /// The bash environment script.
    pub bash_env: Vec<u8>,
    /// File paths that the evaluation depends on (for direnv to watch).
    pub inputs: Vec<PathBuf>,
}

/// Package search result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageSearchResult {
    pub pname: String,
    pub version: String,
    pub description: String,
}

/// Map of attr-path → package search result.
pub type SearchResults = std::collections::BTreeMap<String, PackageSearchResult>;

/// Build the eval-cache key suffix for the current invocation. Encodes
/// CLI-side knobs that affect evaluation output but are not part of the
/// Nix args themselves.
pub fn eval_cache_key_args(nix_args_str: &str, extension_fingerprint: &str) -> String {
    format!("{nix_args_str}:eval_extensions={extension_fingerprint}")
}

/// "A thing that can talk to Nix."
///
/// `eval` and `build` take attribute paths into the project's devenv
/// config root. The evaluator owns the bootstrap-args wiring and uses the
/// evaluation extensions installed when its concrete backend is composed.
#[async_trait(?Send)]
pub trait Evaluator: Send + Sync {
    /// Backend name (for logging / debugging).
    fn name(&self) -> &str;

    /// Store this evaluator is bound to.
    fn store(&self) -> &dyn Store;

    /// Evaluate `attrs` as an attribute path against the devenv config
    /// root and return JSON.
    async fn eval(&self, attrs: &[&str]) -> Result<String>;

    /// Build the derivation at `attrs` and return its output paths.
    async fn build(&self, attrs: &[&str], opts: BuildOptions) -> Result<Vec<StorePath>>;

    /// Object-safe downcast hook for callers that need the concrete
    /// backend type for evaluator-specific operations (lock updates,
    /// REPL, native dev-env, search). Implementors return `self`.
    fn as_any(&self) -> &dyn std::any::Any;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn eval_cache_key_args_includes_extension_fingerprint() {
        let key = eval_cache_key_args("{ foo = 1; }", "allocatePort:enabled=true:strict=false");
        assert!(key.contains("allocatePort:enabled=true:strict=false"));
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3230** (2026-09-27): **[nushell] reloading breaks because of non-string env vars**
  *Symptoms*: **Describe the bug** Non-string env vars such as the standard nu `$env.DIRS_LIST` make devenv reload crash with:  ``` Error: nu::shell::only_supports_this_input_type    × Input type not supported.     ╭─[/home/ywen/dev/devenv-test/.devenv/nu/config.nu:81:56]  80 │                             } else {  81 │                                 load-env {($var_name): $value}     ·                                                        ───┬──     ·                                                           ╰── input type: string  82 │                             }     ╰──── ```  **To reproduce** <!-- Please provide a Short, Self Contained, Correct (Compilable), Example: https://sscce.org The best way is to create a gist with `devenv.nix`, `devenv.yaml`, and optionally `devenv.lock`.  Create gist here: https://gist.github.com/  Make sure to include full logs and what you expected to happen. -->  Simply create a blank devenv project with `devenv init`, and then in `nu`, activate it with `devenv shell`. After modifying the `devenv.nix` and waiting for reload to finish, any further command will work, but the above error message will be repeated after each.  **Version** <!-- Paste the output of `devenv version` here or tell us if you're using flakes. --> devenv 2.4.0 (x86_64-linux)
  **Post-Mortem & Fix Analysis**:
  > @YPares I opened #3231 to fix this. Could you test it with the Nushell configuration that reproduced the issue? After editing `devenv.nix` and letting the shell reload, please check whether the error still appears on later prompts and whether your directory commands still work. If it still fails, please share your Nushell version and the new error output. 
  > @domenkozar I tried and it does fix it on that same nu config :) thanks!

- **Issue #3216** (2026-09-29): **devenv up -d: a 120s manager-pidfile wait that's just slow (not actually failed) drops the worktree's HTTPS proxy routes**
  *Symptoms*: ### Summary  A `devenv up -d` (detached) start that takes longer than devenv's fixed 120 s wait for the manager's PID file is treated as a failure even when the manager/daemon is still starting successfully in the background - and, as part of that failure handling, devenv removes this worktree's routes from the shared HTTPS proxy. The daemon then finishes starting normally, but every `https://<service>.<name>.localhost` route stays broken (TLS handshake failures) until something notices and runs `up -d` again against the now-live manager (a second attach does register the routes and does not clear them again).  ### Version  Observed with `devenv` 2.x on Linux with `process.proxy.enable = true`, native process manager, `devenv up -d`.  ### Reproduction shape  We work around this today with a wrapper script (paraphrased below) rather than a minimal `devenv.nix`, since reliably forcing a cold start past 120 s needs a genuinely slow first-run (a large Nix build/eval, or many processes to bring up) that is hard to package as a small reproducible example:  ```sh # usage: up-detached.sh <real-devenv> <devenv arguments...> runtime_dir="${DEVENV_RUNTIME:-}/processes" pid_file="${runtime_dir}/native-manager.pid" manager_alive() { ...; kill -0 "$(cat "$pid_file")" 2>/dev/null; } daemon_starting() { pgrep -f "daemon-processes ${runtime_dir}/daemon-config.json" >/dev/null 2>&1; }  "$real_devenv" "$@"          # devenv up -d ... status=$? if [ "$status" -eq 0 ] || ! { manager_alive || daem
  **Post-Mortem & Fix Analysis**:
  > Uhhhm, this is bad. Fixing.

- **Issue #3203** (2026-09-22): **`devenv shell` SIGABRTs (panics writing to stderr) when its terminal goes away**
  *Symptoms*: **Describe the bug**  The hook-spawned `devenv shell` aborts with SIGABRT instead of exiting quietly when its terminal stdio dies. Main thread panics inside an stderr write (`std::io::stdio::__eprint` → `panic_fmt` → abort; release profile uses `panic=abort`), producing a systemd-coredump report on every unclean terminal close. Likely sibling of #2798 (stdout broken-pipe panic, fixed in 2.1.2). This is the stderr variant on the SIGHUP/shutdown path from #2845.  **To reproduce**  Gist with a minimal project (bug triggers with an empty config, nothing project-specific involved):  `devenv.yaml`:  ```yaml inputs:   nixpkgs:     url: github:cachix/devenv-nixpkgs/rolling ```  `devenv.nix`:  ```nix {pkgs, ...}: { } ```  Steps (zsh with `eval "$(devenv hook zsh)"` in `.zshrc`):  1. `mkdir repro && cd repro`, place the two files, run `devenv allow`. 2. `cd repro` in a fresh terminal → hook auto-activates `devenv shell`. 3. Repro A: close the terminal window (no `exit`) → coredump report.    Repro B: from inside the shell run `codium .` (any Electron/GUI app),    then close the editor window → same coredump report. 4. `coredumpctl -1 info` shows:  ```text Signal: 6 (ABRT) Command Line: devenv shell Executable: /nix/store/...-devenv-2.3.1/bin/.devenv-wrapped Message: Process ... (.devenv-wrapped) of user ... dumped core. Stack trace of thread ...: #11 core::panicking::panic_fmt #12 std::io::stdio::__eprint #13 devenv::main #14 std::sys::backtrace::__rust_begin_short_backtrace #15 core::

- **Issue #3199** (2026-09-21): **Git hooks run during `devenv shell` despite `enterTest` being skipped**
  *Symptoms*: ## `devenv shell` unexpectedly runs `devenv:git-hooks:run`  ### Description  With git hooks enabled, `devenv shell` executes the `devenv:git-hooks:run` task even though `devenv:enterTest` is explicitly skipped.  This causes all configured hooks to run on every shell entry. In my case, `trufflehog` takes ~18 seconds, making every `devenv shell` invocation take ~20 seconds.  This appears to be related to the task graph traversal used by `devenv shell`.  ### Environment  * devenv: `2.3.1+2418e1b (x86_64-linux)` * NixOS / x86_64-linux * Using the `devenv:latest` container * No devenv version pin beyond `:latest`  ### Configuration  Relevant configuration:  ```nix git-hooks.hooks = {   golangci-lint.enable = true;   ripsecrets.enable = true;   trufflehog.enable = true;    gitleaks = {     enable = true;     entry = "${lib.getExe pkgs.gitleaks} git --pre-commit --redact --staged --verbose";     pass_filenames = false;   }; }; ```  I also initially had `enterTest`, Claude Code integration, etc., but removing those made no difference.  ### Reproduction  Run:  ```bash devenv shell --no-reload -v ```  The relevant output is:  ```text ✓ Running tasks 19.8s   ├ ✓ devenv:enterShell 38ms   │ ├ ✓ devenv:git-hooks:install 47ms   │ └ ✓ devenv:python:virtualenv 57ms   └ ✓ devenv:enterTest skipped 0ms     └ ✓ devenv:git-hooks:run 4 lines → trufflehog...Passed 19.6s       └ ✓ devenv:git-hooks:install ... cache decision=hit ```  The important part is that `enterTest` is skipped, but its `git-hook
  **Post-Mortem & Fix Analysis**:
  > Duplicate of https://github.com/cachix/devenv/issues/3184

- **Issue #3196** (2026-09-23): **`devenv lsp` fails inside devcontainer**
  *Symptoms*: **Describe the bug** When running inside a devcontainer `devenv lsp` errors with ``` • Validating lock ✓ Validating lock in 7.35ms   evaluating file '«nix-internal»/derivation-internal.nix' • Starting nixd language server terminate called after throwing an instance of 'nix::Error'   what():  error: Already registered store with name 'Dummy Store' ```  **To reproduce** Gist: https://gist.github.com/robertclarkenhsps/71ca1f075f13cbf00842f101f2c467f3 After running `devenv shell` to create the devcontainer.json and install the command line run: `devcontainer up` to build the dev container and then `devcontainer exec devenv lsp` to view the error  **Version** Host: devenv 2.3.1 (x86_64-linux) Devcontainer: devenv 2.3.1+2418e1b (x86_64-linux)  **Additional info** Running nixd from within devenv also fails with the same error 
  **Post-Mortem & Fix Analysis**:
  > Getting this on a plain Arch host too, no devcontainer, on versions 2.3 through 2.3.2, so it seems like it appeared in 2.3 and hasn't been fixed yet. Minimal repro in an empty project:  ```sh mkdir /tmp/repro && cd /tmp/repro printf '{ pkgs, ... }: { packages = [ pkgs.hello ]; }\n' > devenv.nix devenv lsp </dev/null; echo "exit=$?" ```  Same `Already registered store with name 'Dummy Store'`, exit 134. v2.2.2 is clean, v2.3 is broken.
  > The bundled `nixd` aborts the same way on its own with no arguments and no `devenv.nix` anywhere:  ```sh $ /nix/store/<hash>-nixd-nightly/bin/nixd </dev/null; echo "exit=$?" terminate called after throwing an instance of 'nix::Error'   what():  error: Already registered store with name 'Dummy Store' exit=134 ```  To test under `gdb`, I ran the following:  ```sh nixd_bin=$(nix-store -qR $(readlink -f $(which devenv)) | grep nixd)/bin/nixd gdb -batch -nx -ex 'set debuginfod enabled off' -ex 'break abort' \     -ex run -ex 'bt 8' --args "$nixd_bin" </dev/null ```  This shows the abort comes from `nix::Implementations::add<nix::DummyStoreConfig>()`. `libnixt.so` also carries its own full copy of the nix libraries (`nm -DC libnixt.so | grep -ci dummystore` gives 123), and its initializers run first as a shared library, so the executable's copy finds the store name already taken. I haven't confirmed which one registers first beyond that.

- **Issue #3194** (2026-09-19): **`languages.javascript.pnpm` fails with newer `nixpkgs` due to `nodejs` override**
  *Symptoms*: **Describe the bug** <!-- A clear and concise description of what the bug is. -->  `languages.javascript.pnpm.enable = true` fails to evaluate with newer nixpkgs revisions because devenv overrides `pkgs.pnpm` using the `nodejs` argument.  Newer nixpkgs versions use `nodejs-slim` instead, which results in:  ```text error: function 'anonymous lambda' called with unexpected argument 'nodejs' ```  This appears to be the pnpm equivalent of the Node.js packaging compatibility issue previously addressed for npm in #2538.  **To reproduce** <!-- Please provide a Short, Self Contained, Correct (Compilable), Example: https://sscce.org The best way is to create a gist with `devenv.nix`, `devenv.yaml`, and optionally `devenv.lock`.  Create gist here: https://gist.github.com/  Make sure to include full logs and what you expected to happen. -->  The existing `javascript-pnpm` integration test passes with devenv's currently pinned nixpkgs:  ```bash devenv shell -- devenv-run-tests run tests --only javascript-pnpm ```  but fails when run against current `nixpkgs-unstable`:  ```bash devenv shell -- devenv-run-tests run tests \   --only javascript-pnpm \   -o nixpkgs github:NixOS/nixpkgs/nixpkgs-unstable ```  The failure occurs while evaluating `languages.javascript.pnpm.package`:  ```text error: function 'anonymous lambda' called with unexpected argument 'nodejs' ```  Expected behavior: pnpm should use the appropriate override argument for the nixpkgs version in use, preserving compatibility w

- **Issue #3193** (2026-09-22): **fish hook: `devenv shell` exit via `cd` emits codes to terminal**
  *Symptoms*: **Describe the bug**  When using the standard `fish` hook, and within an activated `devenv shell`, exiting via `cd` changes the directory, but emits control codes to the terminal e.g. `^[]11;rgb:f2f2/...`. This started recently for me. Aside from upgrading `devenv`, I haven't changed anything else about my `fish` setup or terminal. I have observed this in `foot` and more recently `ghostty`.  I am no expert in terminal control flow and the like, but the issue appears to be a race between the child and parent shell:  ``` child fish:  writes ^[]11;? ^[[6n ^[[0c child fish:  fires fish_prompt handlers devenv hook: PWD is outside the project -> exit child fish:  dies terminal:    replies arrive... nobody is reading parent fish: resumes, reads pending input, sees ^[]11;rgb:f2f2/... as typed              characters, echoes them onto the command line ```  The robot gave me this wonderfully hacky workaround:  ```fish function _devenv_hook_exit_on_leave --on-variable PWD     set -q _devenv_hook_dir; or return     test -n "$DEVENV_ROOT"; or return     switch $PWD         case "$DEVENV_ROOT" "$DEVENV_ROOT/*"         case '*'             printf '%s' $PWD >"$DEVENV_ROOT/.devenv/exit-dir"             exit     end end ```  It mimics the builtin hook, but executes when there are no outstanding queries:  ``` child fish:  runs `cd /tmp`              PWD is assigned -> handler fires -> exit child fish:  dies with nothing pending parent fish: resumes, reads nothing, draws a clean prompt ```  Havi
  **Post-Mortem & Fix Analysis**:
  > Thanks for the fix @domenkozar! 

- **Issue #3190** (2026-09-22): **Python venv is not activated for tasks**
  *Symptoms*: **Describe the bug** <!-- A clear and concise description of what the bug is. -->  I have a task that depends on dependencies that I have configured in my Python virtual environment. When I try to run this task, it fails as the build cannot find python libraries that it needs. When I attempt to reproduce this in an interactive shell, the venv is activated correctly.  **To reproduce** <!-- Please provide a Short, Self Contained, Correct (Compilable), Example: https://sscce.org The best way is to create a gist with `devenv.nix`, `devenv.yaml`, and optionally `devenv.lock`.  Create gist here: https://gist.github.com/  Make sure to include full logs and what you expected to happen. -->  ```nix # devenv.nix { pkgs, lib, config, inputs, ... }:  {   languages.python = {     enable = true;     venv = {       enable = true;     };   };    tasks = {     "venv:check" = {       exec = ''         which python         exit 1  # To make output easily visible       '';     };   }; } ```  Running the task. Observe that the python path points to the nix store.  ```sh $ devenv tasks run -v venv:check ✓ Validating lock 1 files                                                       0ms ✓ Reading config.cachix.enable 160 files                                        0ms ✓ Configuring cachix                                                            0ms   └ ✓ Reading config.cachix.pull                                                0ms   └ ✓ Reading config.cachix.push                                 
  **Post-Mortem & Fix Analysis**:
  > I reproduced this with a direct task run. `devenv tasks run` schedules the requested task and its dependencies; it does not automatically run `devenv:enterShell`. The Python virtual environment is initialized by `devenv:python:virtualenv` as a dependency of shell entry, so a direct task without that dependency uses the Nix Python.  For a task that needs the virtual environment, add:  ```nix tasks."venv:check".after = [ "devenv:python:virtualenv" ]; ```  I verified that this runs virtualenv setup first and makes the task use `.devenv/state/venv/bin/python` with `VIRTUAL_ENV` set. The behavior and example are now documented in the [Python guide](https://devenv.sh/languages/python/#using-the-virtual-environment-in-tasks) and [Tasks guide](https://devenv.sh/tasks/#entershell--entertest) via commit [44eefd8a](https://github.com/cachix/devenv/commit/44eefd8a). 
  > @domenkozar this appears to work (thank you!), but causes a lengthy stdout for most of the tasks in my repo now.  Any suggestions for how to tidy this up?  ```sh $ devenv tasks run setup  ✓ Validating lock                                                                                            0ms ✓ Configuring cachix                                                                                         0ms ✓ Configuring shell                                                                                         4.4s   └ ✓ Evaluating shell 2142 files                                                                           4.4s     └ ✓ Building  setup-init                                                                                45ms     └ ✓ Building  tasks.json                                                                                51ms     └ ✓ Building  devenv-shell 1 lines                                                                     407ms     └ ✓ Querying  dev

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

### Incident Patch 1: `fe20b5cb` (2026-09-29)
**Commit Message**: fix(test): report disabled process dependencies before startup (#3239)

* fix(test): report disabled process dependencies before startup

* fix(test): validate dependencies before broker startup

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -9,6 +9,7 @@
 - fish auto-activation no longer hangs when `env` is a fish function, such as grc's wrapper ([#3222](https://github.com/cachix/devenv/issues/3222)).
 - Task names containing `::`, such as `foo::bar`, are now rejected with an invalid task name error. Previously they were accepted but could not be run by name ([#3227](https://github.com/cachix/devenv/issues/3227)).
 - Detached process startup now publishes the manager as soon as processes are scheduled, without waiting for service readiness, and keeps HTTPS proxy routes during a slow startup ([#3216](https://github.com/cachix/devenv/issues/3216)).
+- `devenv test` with the native process manager now reports a process dependency on `start.enable = false` before starting services, instead of waiting indefinitely for the disabled process ([#3215](https://github.com/cachix/devenv/issues/3215)).
 
 ## 2.4.0 (2026-09-24)
 
```

**File**: `devenv-tasks/src/tasks.rs` (modified, +95/-1)
```diff
@@ -15,7 +15,7 @@ use petgraph::graph::{DiGraph, NodeIndex};
 use petgraph::visit::{EdgeRef, Reversed};
 use std::borrow::Cow;
 use std::collections::{HashMap, HashSet};
-use std::path::PathBuf;
+use std::path::{Path, PathBuf};
 use std::sync::Arc;
 use tokio::sync::{Mutex, Notify, RwLock};
 use tokio::time::Instant;
@@ -242,6 +242,14 @@ impl Tasks {
         &self.process_runner
     }
 
+    /// Connect a capability broker before the task runner is shared or run.
+    /// This lets callers validate the task graph before prompting for sudo.
+    pub fn set_capability_broker(&mut self, path: &Path) -> miette::Result<()> {
+        let runner = Arc::get_mut(&mut self.process_runner)
+            .ok_or_else(|| miette::miette!("Cannot configure a shared process runner"))?;
+        runner.set_capability_broker(path)
+    }
+
     /// Wakes on task completions and process-map transitions.
     pub fn notified(&self) -> tokio::sync::futures::Notified<'_> {
         self.notify_finished.notified()
@@ -887,6 +895,40 @@ impl Tasks {
             .collect()
     }
 
+    /// Find cold-start dependencies that cannot progress without manually
+    /// starting a process disabled by `start.enable = false`. A noninteractive
+    /// caller such as `devenv test` cannot perform that action.
+    pub async fn disabled_process_dependencies(&self) -> Vec<(String, String)> {
+        let scheduled: HashSet<_> = self.tasks_order.iter().copied().collect();
+        let mut blockers = Vec::new();
+        for &index in &self.tasks_order {
+            let dependent_name = self.graph[index].read().await.task.name.clone();
+            for edge in self
+                .graph
+                .edges_directed(index, petgraph::Direction::Incoming)
+            {
+                if !scheduled.contains(&edge.source())
+                    || *edge.weight() == DependencyKind::Completed
+                {
+                    continue;
+                }
+                let dependency = self.graph[edge.source()].read().await;
+                if dependency.task.r#type == TaskType::Process
+                    && dependency
+                        .task
+                        .process
+                        .as_ref()
+                        .is_some_and(|process| !process.start.enable)
+                {
+                    blockers.push((dependent_name.clone(), dependency.task.name.clone()));
+                }
+            }
+        }
+        blockers.sort();
+        blockers.dedup();
+        blockers
+    }
+
     /// Start unseen one-shots in a dynamic dependency closure exactly once.
     /// Process dependencies still require explicit starts.
     async fn schedule_unseen_oneshot_dependencies(&self, index: NodeIndex) {
@@ -4374,6 +4416,58 @@ mod schedule_tests {
         tasks.process_runner().stop_all().await.unwrap();
     }
 
+    #[tokio::test]
+    async fn disabled_process_dependencies_report_blockers_in_the_cold_schedule() {
+        let mut disabled = long_process_task("disabled", vec![]);
+        disabled.process = Some(ProcessConfig {
+            start: devenv_processes::config::StartConfig { enable: false },
+            ready: Some(devenv_processes::ReadyConfig {
+                exec: Some("true".to_string()),
+                ..Default::default()
+            }),
+            ..Default::default()
+        });
+        let mut bridge = oneshot_task("test:bridge", vec![]);
+        bridge.after = vec![format!("{PROCESS_TASK_PREFIX}disabled@started")];
+        let mut app = long_process_task("app", vec![]);
+        app.after = vec!["test:bridge@succeeded".to_string()];
+        let mut unrelated = long_process_task("unrelated", vec![]);
+        unrelated.after = vec![format!("{PROCESS_TASK_PREFIX}disabled@started")];
+
+        let (tasks, _tmp) = build_test_tasks_with_run_mode(
+            vec![
+                disabled,
+                long_process_task("direct", vec!["disabled"]),
+                long_process_task("completed", vec!["disabled@completed"]),
+                bridge,
+                app,
+                unrelated,
+            ],
+            vec![
+                format!("{PROCESS_TASK_PREFIX}direct"),
+                format!("{PROCESS_TASK_PREFIX}completed"),
+                format!("{PROCESS_TASK_PREFIX}app"),
+            ],
+            RunMode::Before,
+            false,
+        )
+        .await;
+
+        assert_eq!(
+            tasks.disabled_process_dependencies().await,
+            vec![
+                (
+                    format!("{PROCESS_TASK_PREFIX}direct"),
+                    format!("{PROCESS_TASK_PREFIX}disabled"),
+                ),
+                (
+                    "test:bridge".to_string(),
+                    format!("{PROCESS_TASK_PREFIX}disabled"),
+                ),
+            ]
+        );
+    }
+
     #[tokio::test]
     async fn dependency_parked_does_not_park_on_running_oneshot() {
         let mut migrate = oneshot_task("deve
```

**File**: `devenv/src/devenv/mod.rs` (modified, +31/-9)
```diff
@@ -2928,7 +2928,7 @@ impl Devenv {
             let capability_requests = capability_requests(&task_configs);
             let capabilities_required_now = capabilities_required_now(&task_configs);
 
-            let mut config = self
+            let config = self
                 .make_task_config(roots, task_configs, task_mode, envs)
                 .await?;
 
@@ -2983,21 +2983,43 @@ impl Devenv {
                 return Ok(ProcessStartOutcome::Completed);
             }
 
-            config.capability_broker = processes::start_capability_broker(
+            let mut tasks_runner =
+                tasks::Tasks::builder(config, VerbosityLevel::Normal, self.shutdown.clone())
+                    .build()
+                    .await
+                    .map_err(|e| miette!("Failed to build task runner: {}", e))?;
+
+            if options.mode == ClientRunMode::ReturnAfterStart {
+                let blockers = tasks_runner.disabled_process_dependencies().await;
+                if !blockers.is_empty() {
+                    let details = blockers
+                        .iter()
+                        .map(|(dependent, dependency)| {
+                            format!("'{dependent}' waits for '{dependency}' (start.enable = false)")
+                        })
+                        .collect::<Vec<_>>()
+                        .join("; ");
+                    bail!(
+                        "Process dependencies cannot start: {details}. Enable the dependency or make the dependency edge conditional."
+                    );
+                }
+            }
+
+            if let Some(broker) = processes::start_capability_broker(
                 &capability_requests,
                 capabilities_required_now,
                 self.process_runtime_dir()?,
                 options.frontend_command_tx.as_ref(),
                 std::process::Stdio::inherit(),
             )
-            .await?;
+            .await?
+            {
+                tasks_runner
+                    .set_capability_broker(&broker)
+                    .wrap_err("Failed to connect capability broker")?;
+            }
 
-            let tasks_runner = Arc::new(
-                tasks::Tasks::builder(config, VerbosityLevel::Normal, self.shutdown.clone())
-                    .build()
-                    .await
-                    .map_err(|e| miette!("Failed to build task runner: {}", e))?,
-            );
+            let tasks_runner = Arc::new(tasks_runner);
 
             // The persistent manager owns the task execution scope. That scope
             // owns the one process runner used by all of its process tasks.
```

---

### Incident Patch 2: `aa24ddc2` (2026-09-29)
**Commit Message**: fix(processes): wait for live daemon startup (#3237)

* fix(processes): wait for live daemon startup

* fix(processes): publish daemon before service readiness

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@
 - MySQL now creates configured databases and users when started with `devenv up`, including `devenv up mysql` ([#2843](https://github.com/cachix/devenv/issues/2843)).
 - fish auto-activation no longer hangs when `env` is a fish function, such as grc's wrapper ([#3222](https://github.com/cachix/devenv/issues/3222)).
 - Task names containing `::`, such as `foo::bar`, are now rejected with an invalid task name error. Previously they were accepted but could not be run by name ([#3227](https://github.com/cachix/devenv/issues/3227)).
+- Detached process startup now publishes the manager as soon as processes are scheduled, without waiting for service readiness, and keeps HTTPS proxy routes during a slow startup ([#3216](https://github.com/cachix/devenv/issues/3216)).
 
 ## 2.4.0 (2026-09-24)
 
```

**File**: `devenv-tasks/src/tasks.rs` (modified, +75/-2)
```diff
@@ -655,14 +655,26 @@ impl Tasks {
             ))
         ));
 
-        self.run_internal(orchestration_activity, is_process_mode)
+        self.run_internal(orchestration_activity, is_process_mode, None)
             .await
     }
 
     /// Run process tasks under a caller-provided activity.
     #[instrument(skip(self, parent_activity))]
     pub async fn run_with_parent_activity(&self, parent_activity: Arc<Activity>) -> Outputs {
-        self.run_internal(parent_activity, true).await
+        self.run_internal(parent_activity, true, None).await
+    }
+
+    /// Signal once the initial process graph is registered and scheduled.
+    /// The daemon can expose its API before long-running tasks or readiness
+    /// probes settle, while clients still see the full process graph.
+    pub async fn run_with_parent_activity_and_signal_scheduled(
+        &self,
+        parent_activity: Arc<Activity>,
+        scheduled: tokio::sync::oneshot::Sender<()>,
+    ) -> Outputs {
+        self.run_internal(parent_activity, true, Some(scheduled))
+            .await
     }
 
     /// Schedule named process tasks and their dependencies against the live graph.
@@ -1236,6 +1248,7 @@ impl Tasks {
         &self,
         orchestration_activity: Arc<Activity>,
         register_unscheduled_processes: bool,
+        scheduled_signal: Option<tokio::sync::oneshot::Sender<()>>,
     ) -> Outputs {
         // Assign activity IDs upfront for all tasks
         let mut task_ids: HashMap<NodeIndex, u64> = HashMap::new();
@@ -1571,6 +1584,12 @@ impl Tasks {
             });
         }
 
+        // All process entries are registered before the daemon advertises its
+        // API. Task execution and readiness checks continue in the background.
+        if let Some(scheduled_signal) = scheduled_signal {
+            let _ = scheduled_signal.send(());
+        }
+
         // Wait for all tasks to complete
         running_tasks.wait_all().await;
 
@@ -2265,6 +2284,60 @@ mod schedule_tests {
         process_task_with_command(name, after, "exec tail -f /dev/null")
     }
 
+    #[tokio::test]
+    async fn daemon_can_publish_manager_before_initial_tasks_settle() {
+        let files = tempfile::tempdir().unwrap();
+        let hold = named_pipe(files.path(), "hold-setup");
+        let mut setup = oneshot_task("test:setup", vec![]);
+        setup.command = Some(
+            executable_script(
+                files.path(),
+                "setup",
+                &format!("read _ < '{}'", hold.display()),
+            )
+            .to_string_lossy()
+            .into_owned(),
+        );
+        let mut app = long_process_task("app", vec![]);
+        app.after = vec!["test:setup@succeeded".to_string()];
+        let (tasks, _tmp) = build_test_tasks(
+            vec![setup, app],
+            vec![format!("{PROCESS_TASK_PREFIX}app")],
+            false,
+        )
+        .await;
+        let tasks = Arc::new(tasks);
+        let (scheduled_tx, scheduled_rx) = tokio::sync::oneshot::channel();
+        let running = Arc::clone(&tasks);
+        let run = tokio::spawn(async move {
+            running
+                .run_with_parent_activity_and_signal_scheduled(
+                    Arc::new(devenv_activity::start!(
+                        Activity::operation("Running processes").parent(None)
+                    )),
+                    scheduled_tx,
+                )
+                .await
+        });
+
+        tokio::time::timeout(std::time::Duration::from_secs(10), scheduled_rx)
+            .await
+            .expect("process graph was not scheduled")
+            .expect("process scheduling ended without a signal");
+        assert!(!run.is_finished(), "setup should still be running");
+        assert_eq!(
+            tasks.process_runner().get_phase("app").await,
+            Some(ProcessPhase::Waiting)
+        );
+
+        tasks.shutdown.shutdown();
+        tokio::time::timeout(std::time::Duration::from_secs(10), run)
+            .await
+            .expect("cancelled task run did not settle")
+            .expect("task run panicked");
+        tasks.process_runner().stop_all().await.unwrap();
+    }
+
     fn self_exit_process_task(name: &str, after: Vec<&str>) -> TaskConfig {
         process_task_with_command(name, after, "echo")
     }
```

**File**: `devenv/src/commands/daemon_processes.rs` (modified, +18/-1)
```diff
@@ -51,7 +51,20 @@ pub fn run(config_file: &Path) -> Result<()> {
             devenv::processes::ManagerResidence::Daemon,
         ));
 
-        let _outputs = tasks_runner.run_with_parent_activity(Arc::new(phase)).await;
+        let (scheduled_tx, scheduled_rx) = tokio::sync::oneshot::channel();
+        let initial_tasks = {
+            let tasks_runner = Arc::clone(&tasks_runner);
+            tokio::spawn(async move {
+                tasks_runner
+                    .run_with_parent_activity_and_signal_scheduled(Arc::new(phase), scheduled_tx)
+                    .await
+            })
+        };
+
+        scheduled_rx
+            .await
+            .into_diagnostic()
+            .wrap_err("Initial process scheduling stopped before the manager was available")?;
 
         let api_server = tasks::NativeApiServer::start(manager)?;
 
@@ -70,6 +83,10 @@ pub fn run(config_file: &Path) -> Result<()> {
             .await
             .map_err(|e| miette::miette!("Process manager error: {}", e));
 
+        // Shutdown cancels the task runner's remaining work. Finish its
+        // cancellation sweep before removing the manager's PID file.
+        let _ = initial_tasks.await;
+
         let _ = tokio::fs::remove_file(&pid_file).await;
         result
     })
```

**File**: `devenv/src/devenv/mod.rs` (modified, +110/-39)
```diff
@@ -26,8 +26,6 @@ use devenv_core::{
 use devenv_mailbox::{FrontendCommand, FrontendEvent};
 use devenv_shell::dialect::{BashDialect, RcfileContext, ShellDialect, create_dialect};
 use miette::{IntoDiagnostic, Result, WrapErr, bail, miette};
-use nix::sys::signal;
-use nix::unistd::Pid;
 use once_cell::sync::{Lazy, OnceCell as SyncOnceCell};
 use processes::ProcessManagerControl as _;
 use serde::Serialize;
@@ -293,6 +291,43 @@ fn should_clear_proxy_routes(
     owns_foreground_manager || (!manager_was_running && start_failed)
 }
 
+/// Keep the startup lock and proxy routes while a slow daemon is still alive.
+/// The PID file is published after the initial process graph is registered.
+/// A slow or stuck daemon must not cause premature proxy route cleanup.
+async fn wait_for_daemon_pid(
+    child: &mut std::process::Child,
+    pid_file: &Path,
+    log_file_path: &Path,
+    warning_after: std::time::Duration,
+) -> Result<()> {
+    let start = std::time::Instant::now();
+    let mut warned = false;
+    loop {
+        if matches!(
+            processes::check_pid_file(pid_file).await,
+            Ok(processes::PidStatus::Running(_))
+        ) {
+            return Ok(());
+        }
+        if let Some(status) = child
+            .try_wait()
+            .into_diagnostic()
+            .wrap_err("Failed to check daemon startup status")?
+        {
+            let log_contents = std::fs::read_to_string(log_file_path).unwrap_or_default();
+            bail!("Daemon exited unexpectedly ({status}). Logs:\n{log_contents}");
+        }
+        if !warned && start.elapsed() >= warning_after {
+            warn!(
+                pid = child.id(),
+                "Daemon is still starting; waiting for its manager PID file"
+            );
+            warned = true;
+        }
+        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
+    }
+}
+
 /// A shell command ready to be executed.
 #[derive(Debug)]
 pub struct ShellCommand {
@@ -1222,10 +1257,10 @@ impl Devenv {
     /// dependencies, and out-of-subset dependencies are all resolved exactly
     /// like the cold-start path — the CLI no longer re-derives them.
     ///
-    /// The reply is truthful: it reports per name whether the daemon scheduled
-    /// it, skipped it (already running or pending), did not know it (the
-    /// manager was started with a different configuration), or failed to
-    /// schedule it. Unknown and failed names bail; so does a reply where
+    /// The reply reports requested names and automatically started prerequisites
+    /// as scheduled, skipped (already running or pending), unknown (the manager
+    /// was started with a different configuration), or failed. Unknown and
+    /// failed names bail; so does a reply where
     /// nothing was scheduled or skipped, so `devenv up` exits nonzero when it
     /// acted on nothing.
     async fn attach_start_up_processes(&self, names: &[String]) -> Result<()> {
@@ -3242,41 +3277,16 @@ impl Devenv {
             cmd.process_group(0);
         }
 
-        let child = cmd
+        let mut child = cmd
             .spawn()
             .map_err(|e| miette!("Failed to spawn daemon: {}", e))?;
-        let child_pid = child.id();
-
-        // Wait for the daemon to write its PID file (meaning processes are started)
-        let start = std::time::Instant::now();
-        let max_wait = std::time::Duration::from_secs(120);
-        while start.elapsed() < max_wait {
-            if matches!(
-                processes::check_pid_file(&pid_file).await,
-                Ok(processes::PidStatus::Running(_))
-            ) {
-                break;
-            }
-            // Check if the daemon exited early (crash)
-            if signal::kill(Pid::from_raw(child_pid as i32), None).is_err() {
-                let log_contents = std::fs::read_to_string(&log_file_path).unwrap_or_default();
-                bail!("Daemon exited unexpectedly. Logs:\n{}", log_contents);
-            }
-            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
-        }
-
-        if !matches!(
-            processes::check_pid_file(&pid_file).await,
-            Ok(processes::PidStatus::Running(_))
-        ) {
-            let log_contents = std::fs::read_to_string(&log_file_path).unwrap_or_default();
-            bail!(
-                "Daemon failed to start within {}s. Check logs at: {}\n{}",
-                max_wait.as_secs(),
-                log_file_path.display(),
-                log_contents
-            );
-        }
+        wait_for_daemon_pid(
+            &mut child,
+            &pid_file,
+            &log_file_path,
+            std::time::Duration::from_secs(120),
+        )
+        .await?;
 
         let pid = std::fs::read_to_string(&pid_file)
             .map(|s| s.trim().to_string())
@@ -4590,6 +4600,7 @@ mod tests {
 
     #[test]
     fn seeds_ports_only_from_a_live_native_manager() {
+        use nix::unistd::Pid;
         u
```

---

### Incident Patch 3: `bec318db` (2026-09-29)
**Commit Message**: fix(tests): declare python3 for process-compose-interactive (#3234)

devenv test starts processes, and repl runs bare python3, which only worked
when the host had python3 on PATH.

Claude-Session: https://claude.ai/code/session_01NFjjzzesiZ517TYSeSM533

**File**: `tests/process-compose-interactive/devenv.nix` (modified, +4/-0)
```diff
@@ -10,6 +10,10 @@ in
 {
   process.manager.implementation = "process-compose";
 
+  # `devenv test` starts the processes: provide the interpreter `repl` runs
+  # instead of relying on one being on the host's PATH.
+  packages = [ pkgs.python3 ];
+
   # An interactive process must be a direct child of the process-compose PTY.
   # Routing it through the `devenv-tasks` runner pipes its stdout/stderr and
   # breaks interactivity (no prompt, block-buffered output). Its generated
```

---

### Incident Patch 4: `d9d0527d` (2026-09-27)
**Commit Message**: fix(files): order treefmt after devenv:files, copy atomically (#3173)

devenv:treefmt:run and devenv:files both only declared
before = ["devenv:enterShell"], so devenv-tasks scheduled them
concurrently. copyMode = "copy" materialized files via rm -rf
followed by cp -RL, leaving the destination briefly absent, so
the tree-wide treefmt sweep could stat a managed file (e.g.
.qr-exclude.yaml under yamlfmt) mid-replacement and fail with
"no such file or directory".

Add after = ["devenv:files"] to devenv:treefmt:run so the sweep
always runs once managed files are in place, matching the
precedent already set by devenv:git-hooks:install. Make the
copy-mode write itself atomic as defense in depth: stage the
copy in a mktemp -d directory beside the destination and mv -f
it into place, replacing an existing file atomically and
replacing a destination symlink instead of writing through it,
including a symlink to a directory, which mv would otherwise
resolve and drop the copy inside. Directories at the source
keep the previous remove-then-copy path, since mv onto an
existing directory moves into it and mv -T is GNU-only.

Add tests/files-treefmt-order to assert the task edge and the
copy behav

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -42,6 +42,10 @@
 - Fixed `cachix.pull` containing duplicate caches. The module adds `devenv` (and `cachix.push`) to the list, so a cache also listed in `devenv.nix` was registered twice and Nix warned `Substituter '...' is already present in the substituters list` on every command. The option now deduplicates its value.
 - Fixed devenv no longer fetching the public signing keys of the caches in `cachix.pull`, a regression from the 2.0 rewrite. Only keys already present in `cachix_trusted_keys.json` were passed to Nix, so on a machine that had only ever run 2.x `extra-trusted-public-keys` was empty and Nix could not verify paths from those caches. The keys are fetched from the Cachix API again (using the resolved auth token for private caches) and cached ([#3176](https://github.com/cachix/devenv/issues/3176)).
 
+### Bug Fixes
+
+- Fixed `devenv shell` intermittently failing with a treefmt error such as `failed to stat <file>: no such file or directory` when `treefmt.enable = true` and the project has files managed by devenv. The tree-wide formatter now runs after devenv has written those files, and a file with `copyMode = "copy"` is replaced atomically, so tools that walk the project never see it missing.
+
 ## 2.3.0 (2026-09-07)
 
 ### Bug Fixes
```

**File**: `docs/src/content/docs/creating-files.mdx` (modified, +1/-1)
```diff
@@ -158,7 +158,7 @@ The `copyMode` attribute accepts:
 
 - `symlink` (default): symlink to the read-only file in the Nix store. Edits are not possible; devenv keeps the link pointed at the current contents.
 - `seed`: copy the file into place once, only if it does not already exist, and make it writable. Existing files are left untouched, so your edits are preserved. This is useful for seeding configuration files from templates that the user can then edit to fit their project.
-- `copy`: copy the file into place as a writable file, overwriting it with fresh contents on every shell entry. This is useful when a tool must write to the file in place but devenv should remain the source of truth.
+- `copy`: copy the file into place as a writable file, overwriting it with fresh contents on every shell entry. The file is replaced atomically, by renaming a temporary file in the same directory over it, so tools that walk the project never see it missing. This is useful when a tool must write to the file in place but devenv should remain the source of truth.
 
 <VersionCompatibility version="2.2" />
 
```

**File**: `src/modules/files.nix` (modified, +56/-12)
```diff
@@ -1,7 +1,7 @@
 { pkgs, lib, config, ... }:
 
 let
-  inherit (builtins) dirOf mapAttrs;
+  inherit (builtins) baseNameOf dirOf mapAttrs;
   inherit (lib) types optionalAttrs optionalString mkOption attrNames filter length mapAttrsToList concatStringsSep head assertMsg;
   inherit (types) attrsOf submodule;
 
@@ -101,7 +101,7 @@ let
 
         - `symlink` (default): symlink to the read-only file in the Nix store. Edits are not possible; devenv keeps the link pointed at the current contents.
         - `seed`: copy the file into place once, only if it does not already exist, and make it writable. Existing files are left untouched, so your edits are preserved. Useful for seeding configuration from templates the user then edits.
-        - `copy`: copy the file into place as a writable file, overwriting it with fresh contents on every shell entry. Useful when a tool must write to the file in place but devenv should remain the source of truth.
+        - `copy`: copy the file into place as a writable file, overwriting it with fresh contents on every shell entry. The file is replaced atomically, so tools that walk the project never see it missing. Useful when a tool must write to the file in place but devenv should remain the source of truth.
       '';
     };
   };
@@ -127,27 +127,71 @@ let
     fi
   '';
 
+  # Materialize the store contents at `filename` as a writable copy.
+  #
+  # A regular file is staged next to its destination and renamed over it, so the destination
+  # is never missing: tools that walk the project concurrently (a tree-wide formatter, an
+  # editor's file watcher) would otherwise stat a path that has momentarily disappeared.
+  writeCopyScript = filename: fileOption: ''
+    mkdir -p "${dirOf filename}"
+    if [ -d ${fileOption.file} ]; then
+      # A directory cannot be swapped in atomically: `mv` onto an existing directory moves
+      # the copy *inside* it and `mv -T` is GNU-only, so replace it in place.
+      rm -rf "${filename}"
+      cp -RL ${fileOption.file} "${filename}"
+      chmod -R u+w "${filename}"
+    else
+      # `mktemp -d` with a template (the portable form, BSD/macOS included) gives an
+      # unpredictable 0700 directory next to the destination, hence on the same filesystem.
+      # Letting `cp` create the file inside it keeps the store mode, executable bit included.
+      _devenv_staging=$(mktemp -d "${dirOf filename}/.${baseNameOf filename}.XXXXXX")
+      # A directory at the destination would swallow the rename: `mv` moves the staged file
+      # *inside* it. `mv` resolves a symlink to a directory as well, so unlink the link
+      # itself - `rm` on a symlink never touches its target. Only a destination that is
+      # already a symlink to a directory goes briefly missing here, never a managed file.
+      if [ -d "${filename}" ]; then
+        if [ -L "${filename}" ]; then
+          rm -f "${filename}"
+        else
+          rm -rf "${filename}"
+        fi
+      fi
+      # `mv -f` renames: it replaces an existing regular file atomically, and replaces any
+      # remaining symlink itself instead of following it. Both hold for GNU and BSD `mv`.
+      if ! {
+        cp -L ${fileOption.file} "$_devenv_staging/file" &&
+          chmod u+w "$_devenv_staging/file" &&
+          mv -f "$_devenv_staging/file" "${filename}"
+      }; then
+        rm -rf "$_devenv_staging"
+        exit 1
+      fi
+      rmdir "$_devenv_staging"
+    fi
+  '';
+
   # Copy the file into place as a writable file the user can edit.
   # "seed" only creates the file when missing; "copy" overwrites it every time.
   createCopyScript = filename: fileOption: ''
     # Drop a previous devenv-managed symlink into the store so we can seed a writable copy
     if [ -L "${filename}" ] && [[ "$(readlink "${filename}")" == /nix/store/* ]]; then
       rm "${filename}"
     fi
-    ${optionalString (fileOption.copyMode == "copy") ''
+    ${if fileOption.copyMode == "copy" then ''
       if [ -e "${filename}" ] || [ -L "${filename}" ]; then
         echo "Overwriting ${filename}"
-        rm -rf "${filename}"
+      else
+        echo "Creating ${filename}"
+      fi
+      ${writeCopyScript filename fileOption}
+    '' else ''
+      if [ -e "${filename}" ]; then
+        echo "Keeping existing ${filename}"
+      else
+        echo "Creating ${filename}"
+        ${writeCopyScript filename fileOption}
       fi
     ''}
-    if [ -e "${filename}" ]; then
-      echo "Keeping existing ${filename}"
-    else
-      echo "Creating ${filename}"
-      mkdir -p "${dirOf filename}"
-      cp -RL ${fileOption.file} "${filename}"
-      chmod -R u+w "${filename}"
-    fi
     echo "${filename}" >> "$DEVENV_FILES_CREATED"
   '';
 
```

**File**: `src/modules/integrations/treefmt.nix` (modified, +13/-9)
```diff
@@ -16,19 +16,24 @@ let
   # When enabled, use getInput (throws helpful error if missing)
   # Otherwise, use tryGetInput to populate the docs when the input is available.
   treefmt-nix =
-    if cfg.enable then config.lib.getInput inputArgs else config.lib.tryGetInput inputArgs;
+    if cfg.enable
+    then config.lib.getInput inputArgs
+    else config.lib.tryGetInput inputArgs;
 
   treefmtSubmodule =
-    if treefmt-nix != null then
+    if treefmt-nix != null
+    then
       treefmt-nix.lib.submoduleWith lib
         {
           specialArgs = { inherit pkgs; };
         }
-    else
-      lib.types.attrs;
+    else lib.types.attrs;
 
   # Determine tree root: prefer git.root, fallback to devenv.root
-  treeRoot = if config.git.root != null then config.git.root else config.devenv.root;
+  treeRoot =
+    if config.git.root != null
+    then config.git.root
+    else config.devenv.root;
 
   # Custom wrapper to point treefmt to the project root.
   #
@@ -38,10 +43,9 @@ let
   treefmtWrapper =
     let
       treeRootOption =
-        if cfg.config.projectRootFile != "" then
-          "--tree-root-file " + lib.escapeShellArg cfg.config.projectRootFile
-        else
-          "--tree-root " + lib.escapeShellArg treeRoot;
+        if cfg.config.projectRootFile != ""
+        then "--tree-root-file " + lib.escapeShellArg cfg.config.projectRootFile
+        else "--tree-root " + lib.escapeShellArg treeRoot;
     in
     pkgs.writeShellScriptBin "treefmt" ''
       exec ${cfg.config.package}/bin/treefmt --config-file ${cfg.config.build.configFile} "$@" ${treeRootOption}
```

**File**: `tests/files-treefmt-order/.gitignore` (modified, +5/-0)
```diff
@@ -1 +1,6 @@
+decoy.yaml
+decoydir
+dirlinked.yaml
+linked.yaml
 managed.txt
+managed.yaml
```

**File**: `tests/files-treefmt-order/.patch.sh` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+#!/usr/bin/env bash
+set -e
+
+# Set up the destinations enterTest (in devenv.nix) asserts on. The first run creates every
+# file; the state left here is what the run inside `devenv test` has to replace.
+devenv shell true
+
+# A user edit: the copy is renamed over an existing regular file.
+echo "user edit" > managed.yaml
+
+# A symlink: the copy replaces the link itself instead of writing through it.
+echo "untouched" > decoy.yaml
+rm linked.yaml
+ln -s decoy.yaml linked.yaml
+
+# A symlink to a directory: `mv` resolves such a link and would drop the copy inside the
+# directory, so the link has to be unlinked before the rename.
+mkdir -p decoydir
+rm dirlinked.yaml
+ln -s decoydir dirlinked.yaml
```

**File**: `tests/files-treefmt-order/devenv.nix` (modified, +101/-3)
```diff
@@ -1,7 +1,18 @@
-{ lib, ... }:
 {
-  treefmt.enable = true;
-  treefmt.config.programs.nixfmt.enable = true;
+  lib,
+  pkgs,
+  ...
+}:
+{
+  packages = [ pkgs.jq ];
+
+  treefmt = {
+    enable = true;
+
+    config.programs = {
+      nixfmt.enable = true;
+    };
+  };
 
   files."managed.txt" = {
     text = "managed content\n";
@@ -16,4 +27,91 @@
   tasks."devenv:treefmt:run".exec = lib.mkForce ''
     grep -qx "managed content" managed.txt
   '';
+
+  # Copy-mode files are rewritten by `devenv:files` on every shell entry, so the tree-wide
+  # treefmt sweep has to wait for them: without an ordering edge the two run concurrently
+  # and treefmt fails to stat a file that is being replaced.
+  files."managed.yaml" = {
+    text = "managed: content\n";
+    copyMode = "copy";
+  };
+  files."linked.yaml" = {
+    text = "linked: content\n";
+    copyMode = "copy";
+  };
+  files."dirlinked.yaml" = {
+    text = "dirlinked: content\n";
+    copyMode = "copy";
+  };
+
+  enterTest = ''
+    # The formatter walks the whole tree, so it must run after the files are in place.
+    # $DEVENV_TASK_FILE is the task graph devenv runs.
+    jq -e '
+      map(select(.name == "devenv:treefmt:run")) as $treefmt
+      | ($treefmt | length) == 1
+        and ($treefmt[0].after | index("devenv:files")) != null
+    ' "$DEVENV_TASK_FILE" > /dev/null || {
+      echo "devenv:treefmt:run is not ordered after devenv:files"
+      exit 1
+    }
+
+    # .patch.sh left a user edit here: the copy is renamed over the existing file.
+    test ! -L "$DEVENV_ROOT/managed.yaml" || {
+      echo "managed.yaml should not be a symlink"
+      exit 1
+    }
+    test -w "$DEVENV_ROOT/managed.yaml" || {
+      echo "managed.yaml should be writable"
+      exit 1
+    }
+    grep -qx "managed: content" "$DEVENV_ROOT/managed.yaml" || {
+      echo "managed.yaml not overwritten"
+      exit 1
+    }
+
+    # .patch.sh left a symlink here: the copy replaces the link itself, so the file it
+    # pointed at stays untouched.
+    test ! -L "$DEVENV_ROOT/linked.yaml" || {
+      echo "linked.yaml should have replaced the symlink"
+      exit 1
+    }
+    grep -qx "linked: content" "$DEVENV_ROOT/linked.yaml" || {
+      echo "linked.yaml not overwritten"
+      exit 1
+    }
+    grep -qx "untouched" "$DEVENV_ROOT/decoy.yaml" || {
+      echo "the symlink was followed instead of replaced"
+      exit 1
+    }
+
+    # .patch.sh left a symlink to a directory here: `mv` resolves such a link, so the link
+    # has to be unlinked first or the copy lands inside the directory.
+    test ! -L "$DEVENV_ROOT/dirlinked.yaml" || {
+      echo "dirlinked.yaml should have replaced the symlink"
+      exit 1
+    }
+    test -f "$DEVENV_ROOT/dirlinked.yaml" || {
+      echo "dirlinked.yaml should be a regular file"
+      exit 1
+    }
+    grep -qx "dirlinked: content" "$DEVENV_ROOT/dirlinked.yaml" || {
+      echo "dirlinked.yaml not overwritten"
+      exit 1
+    }
+    test -z "$(ls -A "$DEVENV_ROOT/decoydir")" || {
+      echo "the copy was moved into the directory the symlink pointed at"
+      exit 1
+    }
+
+    # Each copy is staged in a temporary directory next to its destination and renamed over
+    # it. Nothing may be left behind.
+    for staging in "$DEVENV_ROOT"/.managed.yaml.* "$DEVENV_ROOT"/.linked.yaml.* \
+      "$DEVENV_ROOT"/.dirlinked.yaml.*; do
+      if [ -e "$staging" ]; then
+        echo "staging path left behind: $staging"
+        exit 1
+      fi
+    done
+  '';
 }
```

---

### Incident Patch 5: `bd08a52a` (2026-09-27)
**Commit Message**: fix(shell): preserve structured Nushell env on reload (#3231)

Fixes #3230

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -4,6 +4,7 @@
 
 ### Bug Fixes
 
+- Nushell hot reload no longer breaks commands that use structured environment variables and now removes variables that disappeared after a reload ([#3230](https://github.com/cachix/devenv/issues/3230)).
 - MySQL now creates configured databases and users when started with `devenv up`, including `devenv up mysql` ([#2843](https://github.com/cachix/devenv/issues/2843)).
 - fish auto-activation no longer hangs when `env` is a fish function, such as grc's wrapper ([#3222](https://github.com/cachix/devenv/issues/3222)).
 - Task names containing `::`, such as `foo::bar`, are now rejected with an invalid task name error. Previously they were accepted but could not be run by name ([#3227](https://github.com/cachix/devenv/issues/3227)).
```

**File**: `devenv-shell/src/dialect/mod.rs` (modified, +178/-2)
```diff
@@ -107,9 +107,69 @@ pub(crate) fn xdg_config_home() -> Option<PathBuf> {
 /// reload (matching bash's behavior), falling back to discarding it when no
 /// controlling terminal is available.
 pub(crate) fn bash_reload_subprocess_script(env_diff_helpers: &str, reload_file: &str) -> String {
+    bash_reload_subprocess_script_with_output(env_diff_helpers, reload_file, "", "export -p")
+}
+
+/// Nushell must only import variables touched by devenv. Importing the entire
+/// bash environment turns structured Nushell variables (such as DIRS_LIST)
+/// into strings when they pass through the bash subprocess.
+pub(crate) fn nushell_reload_subprocess_script(
+    env_diff_helpers: &str,
+    reload_file: &str,
+) -> String {
+    bash_reload_subprocess_script_with_output(
+        env_diff_helpers,
+        reload_file,
+        r#"declare -A _devenv_reload_names=()
+__devenv_collect_reload_names() {
+    local line name
+    while IFS= read -r line; do
+        case "$line" in
+            P:declare\ -x\ *)
+                name="${line#P:declare -x }"
+                name="${name%%=*}" ;;
+            N:*) name="${line#N:}" ;;
+            *) continue ;;
+        esac
+        [[ "$name" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] && _devenv_reload_names["$name"]=1
+    done < <(__devenv_deserialize_diff "$1")
+}
+__devenv_collect_reload_names "$_DEVENV_DIFF""#,
+        r#"__devenv_collect_reload_names "$_DEVENV_DIFF"
+# The diff itself is needed to reverse this reload on the next one.
+_devenv_reload_names[_DEVENV_DIFF]=1
+
+while IFS= read -r _devenv_reload_line; do
+    [[ "$_devenv_reload_line" == declare\ -x\ * ]] || continue
+    _devenv_reload_name="${_devenv_reload_line#declare -x }"
+    _devenv_reload_name="${_devenv_reload_name%%=*}"
+    if [[ -n "${_devenv_reload_names[$_devenv_reload_name]+x}" ]]; then
+        if [[ "$_devenv_reload_line" == *=* ]]; then
+            printf '%s\n' "$_devenv_reload_line"
+        else
+            printf 'unset %s\n' "$_devenv_reload_name"
+        fi
+        unset "_devenv_reload_names[$_devenv_reload_name]"
+    fi
+done < <(export -p)
+
+for _devenv_reload_name in "${!_devenv_reload_names[@]}"; do
+    printf 'unset %s\n' "$_devenv_reload_name"
+done"#,
+    )
+}
+
+fn bash_reload_subprocess_script_with_output(
+    env_diff_helpers: &str,
+    reload_file: &str,
+    before_reload: &str,
+    output: &str,
+) -> String {
     format!(
         r#"{env_diff_helpers}
 
+{before_reload}
+
 # Reverse previous diff
 __devenv_apply_reverse_diff
 
@@ -135,10 +195,12 @@ unset _devenv_reload_out
 __devenv_compute_diff "$_before"
 rm -f "$_before"
 
-# Output current environment for the calling shell to parse
-export -p"#,
+# Output environment data for the calling shell to apply
+{output}"#,
         env_diff_helpers = env_diff_helpers,
+        before_reload = before_reload,
         reload_file = reload_file,
+        output = output,
     )
 }
 
@@ -236,6 +298,43 @@ export DEVENV_RELOAD_TEST_VAR=reload_works
         let _ = std::fs::remove_file(&reload_file);
     }
 
+    #[test]
+    fn nushell_reload_subprocess_only_emits_changed_variables() {
+        let tmp = unique_tmp_dir("nu-reload-exports");
+        let reload_file = tmp.join("reload.sh");
+        std::fs::write(&reload_file, "export DEVENV_RELOAD_ADDED=added\n").unwrap();
+        let initial_diff = Command::new("bash")
+            .args([
+                "-c",
+                "printf 'N:DEVENV_RELOAD_REMOVED\\n' | gzip -c | base64 -w0",
+            ])
+            .output()
+            .unwrap();
+        assert!(initial_diff.status.success());
+        let script = nushell_reload_subprocess_script(
+            BashDialect.env_diff_helpers(),
+            reload_file.to_str().unwrap(),
+        );
+        let output = Command::new("bash")
+            .arg("-c")
+            .arg(script)
+            .env(
+                "_DEVENV_DIFF",
+                String::from_utf8(initial_diff.stdout).unwrap(),
+            )
+            .env("DEVENV_RELOAD_REMOVED", "old")
+            .env("DIRS_LIST", "/tmp")
+            .output()
+            .unwrap();
+        assert!(output.status.success());
+        let stdout = String::from_utf8_lossy(&output.stdout);
+        assert!(stdout.contains("declare -x DEVENV_RELOAD_ADDED=\"added\""));
+        assert!(stdout.contains("unset DEVENV_RELOAD_REMOVED"));
+        assert!(stdout.contains("declare -x _DEVENV_DIFF="));
+        assert!(!stdout.contains("DIRS_LIST"));
+        let _ = std::fs::remove_dir_all(tmp);
+    }
+
     /// Regression tests for https://github.com/cachix/devenv/issues/2861
     ///
     /// A shell hook-spawned by `devenv shell` must `exit` when the user `cd`s
@@ -475,6 +574,83 @@ export DEVENV_RELOAD_TEST_VAR=reload_works
         let _ = std::fs::remove_dir_all(&tmp);
     }
 
+    /// Regression test for https://github.com/cachix/devenv/issues/3230.
+    /// `std/dirs` exports DIRS_LIST as a string to bash, but keeps it as a list
+    /// 
```

**File**: `devenv-shell/src/dialect/nushell.rs` (modified, +6/-4)
```diff
@@ -193,7 +193,7 @@ exit 1
             // This avoids quoting issues from embedding bash code in nushell strings.
             let bash_helper = format!(
                 "#!/usr/bin/env bash\n{}",
-                super::bash_reload_subprocess_script(
+                super::nushell_reload_subprocess_script(
                     super::BashDialect.env_diff_helpers(),
                     reload_file,
                 )
@@ -235,16 +235,18 @@ exit 1
 # --- devenv hot-reload support ---
 
 # Apply a reload: run the bash helper script to compute the env diff,
-# then parse `export -p` output and apply environment changes.
+# then apply only the variables changed by devenv.
 def --env __devenv_reload_apply [] {{
     let reload_file = "{reload_file}"
     if ($reload_file | path exists) {{
         let bash_output = (bash "{helper_path}" | complete)
         if ($bash_output.exit_code == 0) {{
-            # Parse `declare -x VAR="value"` lines from bash export -p output
+            # Parse changed exports and removals from the bash helper.
             for line in ($bash_output.stdout | lines) {{
                 let trimmed = ($line | str trim)
-                if ($trimmed | str starts-with "declare -x ") {{
+                if ($trimmed | str starts-with "unset ") {{
+                    hide-env -i ($trimmed | str substring 6..)
+                }} else if ($trimmed | str starts-with "declare -x ") {{
                     let vardef = ($trimmed | str substring 11..)
                     let eq_pos = ($vardef | str index-of "=")
                     if $eq_pos >= 0 {{
```

---

### Incident Patch 6: `38bdc098` (2026-09-26)
**Commit Message**: fix(tasks): reject task names containing "::" (#3228)

Task names containing `::` (e.g. `foo::bar`) passed validation when the
task graph was built, but `resolve_namespace_roots` rejects any requested
name containing `::` before looking for an exact match. So the task showed
up in `devenv tasks list` but `devenv tasks run foo::bar` failed with
`Task does not exist`.

Reject `::` at definition time with `InvalidTaskName` instead.

Fixes #3227

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@
 
 - MySQL now creates configured databases and users when started with `devenv up`, including `devenv up mysql` ([#2843](https://github.com/cachix/devenv/issues/2843)).
 - fish auto-activation no longer hangs when `env` is a fish function, such as grc's wrapper ([#3222](https://github.com/cachix/devenv/issues/3222)).
+- Task names containing `::`, such as `foo::bar`, are now rejected with an invalid task name error. Previously they were accepted but could not be run by name ([#3227](https://github.com/cachix/devenv/issues/3227)).
 
 ## 2.4.0 (2026-09-24)
 
```

**File**: `devenv-tasks/src/tasks.rs` (modified, +1/-0)
```diff
@@ -100,6 +100,7 @@ impl TasksBuilder {
                 || task.name.split(':').count() < 2
                 || task.name.starts_with(':')
                 || task.name.ends_with(':')
+                || task.name.contains("::")
                 || task.name.contains('@')
                 || !task
                     .name
```

**File**: `devenv-tasks/src/tests/mod.rs` (modified, +2/-0)
```diff
@@ -29,6 +29,7 @@ async fn test_task_name() -> Result<(), Error> {
         ":invalid",
         "invalid:",
         "invalid",
+        "invalid::name",
     ];
 
     for task in invalid_names {
@@ -4433,6 +4434,7 @@ mod property_tests {
                     && name.split(':').count() >= 2
                     && !name.starts_with(':')
                     && !name.ends_with(':')
+                    && !name.contains("::")
                     && name
                         .chars()
                         .all(|c| c.is_ascii_alphanumeric() || c == ':' || c == '_' || c == '-')
```

---

### Incident Patch 7: `f8f09b58` (2026-09-25)
**Commit Message**: fix(examples): prevent npm from installing uncompatible pnpm

**File**: `examples/claude-agents/package.json` (modified, +1/-11)
```diff
@@ -1,21 +1,11 @@
 {
-  "name": "conan-flake",
+  "name": "acai-dev",
   "version": "1.0.0",
   "description": "",
   "main": "index.js",
-  "scripts": {
-    "test": "echo \"Error: no test specified\" && exit 1"
-  },
   "keywords": [],
   "author": "",
   "license": "ISC",
-  "devEngines": {
-    "packageManager": {
-      "name": "pnpm",
-      "version": "^11.15.0",
-      "onFail": "download"
-    }
-  },
   "type": "module",
   "devDependencies": {
     "@acai.sh/cli": "^0.0.4"
```

---

### Incident Patch 8: `391d1ed4` (2026-09-25)
**Commit Message**: fix(opentofu): default lsp.package to tofu-ls (#3225)

* fix(opentofu): default lsp.package to tofu-ls

Fixes #3205

* Auto generate docs options data

* Auto generate missing individual markdowns

---------

Co-authored-by: github-actions <41898282+github-actions[bot]@users.noreply.github.com>

**File**: `docs/src/content/docs/languages/opentofu.md` (modified, +1/-1)
```diff
@@ -112,7 +112,7 @@ package
 *Default:*
 
 ```nix
-pkgs.terraform-ls
+pkgs.tofu-ls
 ```
 
 *Declared by:*
```

**File**: `src/modules/languages/opentofu.nix` (modified, +2/-2)
```diff
@@ -19,8 +19,8 @@ in
 
       package = lib.mkOption {
         type = lib.types.package;
-        default = pkgs.terraform-ls;
-        defaultText = lib.literalExpression "pkgs.terraform-ls";
+        default = pkgs.tofu-ls;
+        defaultText = lib.literalExpression "pkgs.tofu-ls";
         description = "The OpenTofu language server package to use.";
       };
     };
```

---

### Incident Patch 9: `a1465bf0` (2026-09-25)
**Commit Message**: fix(hook): use `command env` in fish hook (#3223)

A user fish function named `env` (grc wraps it) piped devenv shell's
stdout, so auto-activation hung. Fixes #3222.

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -5,6 +5,7 @@
 ### Bug Fixes
 
 - MySQL now creates configured databases and users when started with `devenv up`, including `devenv up mysql` ([#2843](https://github.com/cachix/devenv/issues/2843)).
+- fish auto-activation no longer hangs when `env` is a fish function, such as grc's wrapper ([#3222](https://github.com/cachix/devenv/issues/3222)).
 
 ## 2.4.0 (2026-09-24)
 
```

**File**: `devenv/hooks/hook.fish` (modified, +2/-1)
```diff
@@ -56,7 +56,8 @@ function _devenv_hook_activate
     if test -n "$DEVENV_ROOT"
         return
     end
-    env -C $project_dir _DEVENV_HOOK_DIR=$project_dir _DEVENV_CALLER=hook _DEVENV_SHELL_HINT=fish devenv shell@DEVENV_SHELL_ARGS@
+    # `command` skips user functions named `env` (e.g. grc wraps it and pipes stdout).
+    command env -C $project_dir _DEVENV_HOOK_DIR=$project_dir _DEVENV_CALLER=hook _DEVENV_SHELL_HINT=fish devenv shell@DEVENV_SHELL_ARGS@
     # If the devenv shell exited due to cd outside the project, follow the user there
     set -l exit_dir_file "$project_dir/.devenv/exit-dir"
     if test -f "$exit_dir_file"
```

---

### Incident Patch 10: `4c1ba7d6` (2026-09-25)
**Commit Message**: fix(mysql): run configuration when MySQL starts (#3219)

Select the configure task through wantedBy while keeping the readiness ordering edge. Add a named-up regression test and make the existing MySQL test use its allocated port.

Fixes #2843

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -2,6 +2,10 @@
 
 ## 2.4.1 (unreleased)
 
+### Bug Fixes
+
+- MySQL now creates configured databases and users when started with `devenv up`, including `devenv up mysql` ([#2843](https://github.com/cachix/devenv/issues/2843)).
+
 ## 2.4.0 (2026-09-24)
 
 ### Machines (experimental)
```

**File**: `src/modules/services/mysql.nix` (modified, +3/-0)
```diff
@@ -6,6 +6,8 @@
 with lib; let
   cfg = config.services.mysql;
   isMariaDB = getName cfg.package == getName pkgs.mariadb;
+  supportsWantedBy = config.devenv.cli.version == null
+    || versionAtLeast config.devenv.cli.version "2.3.2";
 
   # MariaDB 11.x renamed every `mysql*` client to `mariadb-*` and prints a
   # deprecation warning on every invocation of the old name. Oracle MySQL
@@ -349,6 +351,7 @@ in
     # race against an un-initialised server.
     tasks."devenv:mysql:configure" = {
       exec = configureScript;
+      wantedBy = mkIf supportsWantedBy [ "devenv:processes:mysql" ];
     };
   };
 }
```

**File**: `tests/mysql-named-up/.test-config.yml` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+use_shell: false
```

**File**: `tests/mysql-named-up/.test.sh` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+#!/usr/bin/env bash
+set -euo pipefail
+
+cleanup() {
+  devenv processes down >/dev/null 2>&1 || true
+}
+trap cleanup EXIT
+
+# A named start runs in before mode. It must still select MySQL's configure
+# task and wait for it to create the database and user.
+devenv up -d mysql
+devenv processes wait --timeout 120
+devenv shell -- bash -c 'mysql -h 127.0.0.1 -P "$MYSQL_TCP_PORT" -u named_up -pnamed_up named_up -e "SELECT 1"'
```

**File**: `tests/mysql-named-up/devenv.nix` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+{ ... }:
+{
+  services.mysql = {
+    enable = true;
+    initialDatabases = [ { name = "named_up"; } ];
+    ensureUsers = [
+      {
+        name = "named_up";
+        password = "named_up";
+        ensurePermissions."named_up.*" = "ALL PRIVILEGES";
+      }
+    ];
+  };
+}
```

**File**: `tests/mysql/.test.sh` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 set -e
 
-wait_for_port 3306
+wait_for_port "$MYSQL_TCP_PORT"
 
 # Wait for configure-mysql to finish.
 sleep 5
@@ -9,6 +9,6 @@ sleep 5
 mysql -e 'SELECT VERSION()'
 
 # through tcp/ip
-mysql -h "127.0.0.1" -udb -pdb -e 'SELECT VERSION()'
+mysql -h "127.0.0.1" -P "$MYSQL_TCP_PORT" -udb -pdb -e 'SELECT VERSION()'
 
 ping-mysql
```

---

### Incident Patch 11: `62a8e7df` (2026-09-24)
**Commit Message**: fix(tasks): add wantedBy for shell entry and Garage setup (#3207)

* fix(tasks): add wantedBy so shell entry skips enterTest

`after` and `before` both order tasks and select them: in `after` and
`all` modes, running a task also runs every task ordered after it. So
`devenv shell` (enterShell in `all` mode) pulled in enterTest, which runs
after enterShell, together with its prerequisites such as
devenv:git-hooks:run.

Add `tasks.<name>.wantedBy`, which chooses the selecting tasks explicitly,
like systemd. When set, the listed tasks select the task in every mode
except `single`, and ordering edges no longer select it. enterTest sets
`wantedBy = [ ]`, so it only runs as the `devenv test` root. A setup task
with `wantedBy = [ "devenv:processes:db" ]` now runs under `devenv up`.

The scheduler now selects tasks with one work list. Roots and wanted tasks
are active and select what runs after them; prerequisites stay passive,
which keeps the #2337 behavior.

Fixes #3184

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* Auto generate docs options data

* fix(garage): configure buckets on named starts

Select Garage configuration with wantedBy so a named up schedules it af

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -14,13 +14,15 @@
 - Fixed `devenv shell "git log"` and other quoted commands failing with `not found` ([#3187](https://github.com/cachix/devenv/issues/3187)).
 - Fixed treefmt intermittently failing to stat managed files during shell entry by running it after `devenv:files`.
 - Fixed `devenv shell` crashing with SIGABRT and leaving a coredump when its terminal window is closed while output is being written ([#3203](https://github.com/cachix/devenv/issues/3203)).
+- Fixed `devenv shell` running test setup such as `devenv:git-hooks:run` and tasks with `before = [ "devenv:enterTest" ]` ([#3184](https://github.com/cachix/devenv/issues/3184)).
 
 ### Improvements
 
 - Added an experimental target-side deployment executor for NixOS, with activation independent of SSH, deployment locking, health checks, persistent status, and explicit rollback. Unconfirmed deployments roll back after a deadline or reboot once NixOS reaches userspace; inspect and recover deployments with `machines status` and `machines rollback`.
 - Added configuration access checks to NixOS machine plans and `devenv machines check` to inspect them without building. Reviewed deployments reject disabled SSH or root login, report uncertain access changes, and require regenerated fleet plans.
 - Mixed NixOS, nix-darwin, and home-manager fleets share one review and confirmation. Every role is built and copied before activation; system roles run before home-manager. `--max-concurrent` supports bounded activation batches that stop after a failure.
 - `devenv machines deploy` builds a fleet plan, shows changes, asks for confirmation, and applies those exact outputs. NixOS uses generation checks and transactional rollback; nix-darwin and home-manager use direct activation. Use `--yes` for automation. `machines plan` saves a reusable plan ID; JSON export is optional with `--json`.
+- Added `tasks.<name>.wantedBy` to choose which tasks select a task, separately from `after`/`before` ordering. Garage now configures its layout and buckets when started with `devenv up garage` as well as bare `devenv up` ([#2852](https://github.com/cachix/devenv/issues/2852)).
 
 ## 2.3.1 (2026-09-11)
 
```

**File**: `devenv-tasks/src/config.rs` (modified, +6/-2)
```diff
@@ -15,6 +15,10 @@ pub struct TaskConfig {
     pub after: Vec<String>,
     #[serde(default)]
     pub before: Vec<String>,
+    /// Tasks that select this task when they run. When set, `after` and
+    /// `before` only order this task and no longer select it.
+    #[serde(default)]
+    pub wanted_by: Option<Vec<String>>,
     #[serde(default)]
     pub command: Option<String>,
     #[serde(default)]
@@ -40,12 +44,12 @@ pub struct TaskConfig {
 pub enum RunMode {
     /// Run only the specified task without dependencies
     Single,
-    /// Run the specified task and all tasks that depend on it (downstream tasks)
+    /// Run the specified task and the tasks that run after it (downstream tasks)
     After,
     /// Run all dependency tasks first, then the specified task (upstream tasks)
     Before,
     #[default]
-    /// Run the complete dependency graph (upstream and downstream tasks)
+    /// Run the specified task with its upstream and downstream tasks
     All,
 }
 
```

**File**: `devenv-tasks/src/tasks.rs` (modified, +250/-86)
```diff
@@ -124,6 +124,8 @@ impl TasksBuilder {
             roots,
             root_names: self.config.roots,
             graph,
+            wants: HashMap::new(),
+            wanted_by_declared: HashSet::new(),
             notify_finished,
             notify_ui: Arc::new(Notify::new()),
             tasks_order: vec![],
@@ -170,6 +172,10 @@ pub struct Tasks {
     // Stored for reporting
     pub(crate) root_names: Vec<String>,
     pub(crate) graph: DiGraph<Arc<RwLock<TaskState>>, DependencyKind>,
+    /// Tasks selected whenever the key task is selected (`wanted_by`, reversed).
+    pub(crate) wants: HashMap<NodeIndex, Vec<NodeIndex>>,
+    /// Tasks that declare `wanted_by`. Ordering edges never select them.
+    pub(crate) wanted_by_declared: HashSet<NodeIndex>,
     pub(crate) tasks_order: Vec<NodeIndex>,
     pub(crate) notify_finished: Arc<Notify>,
     pub(crate) notify_ui: Arc<Notify>,
@@ -393,6 +399,8 @@ impl Tasks {
         let mut unresolved = HashSet::new();
         let mut edges_to_add = Vec::new();
         let mut validation_errors = Vec::new();
+        let mut wants: HashMap<NodeIndex, Vec<NodeIndex>> = HashMap::new();
+        let mut wanted_by_declared = HashSet::new();
 
         for index in self.graph.node_indices() {
             let task_state = &self.graph[index].read().await;
@@ -502,6 +510,23 @@ impl Tasks {
                     unresolved.insert((task_state.task.name.clone(), before_name.clone()));
                 }
             }
+
+            if let Some(wanted_by) = &task_state.task.wanted_by {
+                wanted_by_declared.insert(index);
+                for name in wanted_by {
+                    if name.contains('@') {
+                        validation_errors.push(format!(
+                            "Task '{}' lists '{}' in wantedBy, which only selects tasks and takes no suffix. \
+                             Use after or before to order the tasks.",
+                            task_state.task.name, name
+                        ));
+                    } else if let Some(&selector) = task_indices.get(name) {
+                        wants.entry(selector).or_default().push(index);
+                    } else {
+                        unresolved.insert((task_state.task.name.clone(), name.clone()));
+                    }
+                }
+            }
         }
 
         // Return validation errors first
@@ -512,6 +537,8 @@ impl Tasks {
         for (from, to, kind) in edges_to_add {
             self.graph.update_edge(from, to, kind);
         }
+        self.wants = wants;
+        self.wanted_by_declared = wanted_by_declared;
 
         if unresolved.is_empty() {
             Ok(())
@@ -525,98 +552,40 @@ impl Tasks {
         let mut subgraph = DiGraph::new();
         let mut node_map = HashMap::new();
         let mut visited = HashSet::new();
-        let mut to_visit = Vec::new();
-
-        // Start with root nodes
-        for &root_index in &self.roots {
-            to_visit.push(root_index);
-        }
 
         // Find nodes to include based on run_mode
-        match self.run_mode {
-            RunMode::Single => {
-                // Only include the root nodes themselves
-                visited = self.roots.iter().cloned().collect();
-            }
-            RunMode::After => {
-                // Include root nodes and all tasks that come after (successor nodes)
-                while let Some(node) = to_visit.pop() {
-                    if visited.insert(node) {
-                        // Add outgoing neighbors (tasks that come after this one)
-                        for neighbor in self
-                            .graph
-                            .neighbors_directed(node, petgraph::Direction::Outgoing)
-                        {
-                            to_visit.push(neighbor);
-                        }
-                    }
-                }
-            }
-            RunMode::Before => {
-                // Include root nodes and all tasks that come before (predecessor nodes)
-                while let Some(node) = to_visit.pop() {
-                    if visited.insert(node) {
-                        // Add incoming neighbors (tasks that come before this one)
-                        for neighbor in self
-                            .graph
-                            .neighbors_directed(node, petgraph::Direction::Incoming)
-                        {
-                            to_visit.push(neighbor);
-                        }
-                    }
-                }
-            }
-            RunMode::All => {
-                // Include prerequisites (incoming) and dependents (outgoing) separately.
-                // This avoids "direction bouncing" through intermediate nodes that would
-                // incorrectly include unrelated tasks sharing a common prerequisite.
-                // See: https://github.com/cachix/devenv/issues/2337
-
-                // First: traverse incoming edges (prereq
```

**File**: `devenv/src/devenv/mod.rs` (modified, +31/-1)
```diff
@@ -1142,7 +1142,8 @@ impl Devenv {
         }
 
         // Dependency closure of the requested processes, traversing `after`
-        // edges and reversed `before` edges through tasks of every type
+        // edges, reversed `before` edges and reversed `wantedBy` (the
+        // scheduler selects wanted tasks too) through tasks of every type
         // (a process may depend on a oneshot that depends on a process).
         // `@kind` suffixes are stripped: the closure asks "which tasks does
         // this launch need", not how readiness is judged.
@@ -1161,6 +1162,9 @@ impl Devenv {
             for b in &t.before {
                 edges.entry(dep_name(b)).or_default().push(t.name.clone());
             }
+            for w in t.wanted_by.iter().flatten() {
+                edges.entry(w.clone()).or_default().push(t.name.clone());
+            }
         }
         let mut needed: HashSet<String> = HashSet::new();
         let mut queue: Vec<String> = requested
@@ -4084,6 +4088,7 @@ struct TaskListItem<'a> {
     r#type: tasks::TaskType,
     after: &'a [String],
     before: &'a [String],
+    wanted_by: Option<&'a [String]>,
     has_exec: bool,
     has_status: bool,
     cwd: Option<&'a str>,
@@ -4099,6 +4104,7 @@ fn format_tasks_json(tasks: &[tasks::TaskConfig]) -> Result<String> {
             r#type: task.r#type,
             after: &task.after,
             before: &task.before,
+            wanted_by: task.wanted_by.as_deref(),
             has_exec: task.command.is_some(),
             has_status: task.status.is_some(),
             cwd: task.cwd.as_deref(),
@@ -4968,6 +4974,29 @@ BOOTSTRAP_KEY = { description = "bootstrap key", as_path = true }
         assert!(!enable(0), "unrelated process stays parked");
     }
 
+    #[test]
+    fn resolve_launch_processes_follows_wanted_by() {
+        // beta wants configure, which needs alpha. gamma is unrelated.
+        let mut configs = vec![
+            process_task("alpha", true),
+            process_task("beta", true),
+            process_task("gamma", true),
+            tasks::TaskConfig {
+                name: "devenv:beta:configure".to_string(),
+                after: vec![format!("{}alpha", devenv_tasks::PROCESS_TASK_PREFIX)],
+                wanted_by: Some(vec![format!("{}beta", devenv_tasks::PROCESS_TASK_PREFIX)]),
+                ..Default::default()
+            },
+        ];
+
+        Devenv::resolve_launch_processes(&mut configs, &["beta".to_string()]).unwrap();
+
+        let enable = |i: usize| configs[i].process.as_ref().unwrap().start.enable;
+        assert!(enable(0), "alpha launches for the task beta wants");
+        assert!(enable(1), "requested beta launches");
+        assert!(!enable(2), "unrelated gamma is disabled");
+    }
+
     #[test]
     fn resolve_launch_processes_rejects_unknown_names() {
         let mut configs = vec![process_task("alpha", true)];
@@ -5180,6 +5209,7 @@ BOOTSTRAP_KEY = { description = "bootstrap key", as_path = true }
                     "type": "oneshot",
                     "after": ["test:build"],
                     "before": ["test:report"],
+                    "wantedBy": null,
                     "hasExec": true,
                     "hasStatus": true,
                     "cwd": "crates/app",
```

**File**: `docs/src/content/docs/processes.mdx` (modified, +1/-1)
```diff
@@ -241,7 +241,7 @@ See [Dependency states](/tasks/#dependency-states) for the full semantics, and [
 
 :::caution[Setup tasks that run after a process]
 
-`devenv up` schedules processes in `before` mode, which runs each process's upstream dependencies but **not** tasks that run *after* it. A setup or configure task wired downstream of a process — e.g. `processes.<name>.before = [ "devenv:<name>:configure" ]` — is skipped under `devenv up` and never runs. Use `devenv up --mode all`, or see [Processes as tasks](/tasks/#processes-as-tasks) for details.
+`devenv up` schedules processes in `before` mode, which runs each process's upstream dependencies but **not** tasks that run *after* it. A setup or configure task wired downstream of a process — e.g. `processes.<name>.before = [ "devenv:<name>:configure" ]` — is skipped under `devenv up` and never runs. Add `wantedBy = [ "devenv:processes:<name>" ];` to the setup task (2.3.2+), use `devenv up --mode all`, or see [Processes as tasks](/tasks/#processes-as-tasks) for details.
 :::
 
 
```

**File**: `docs/src/content/docs/tasks.mdx` (modified, +26/-2)
```diff
@@ -61,6 +61,28 @@ Processes are tasks too (see [Processes as tasks](#processes-as-tasks)), so the
 }
 ```
 
+### Selecting tasks with `wantedBy`
+
+<VersionCompatibility version="2.3.2" />
+
+`before` and `after` both order tasks and choose which tasks run. Running a task pulls in the tasks it runs after, and in `after` and `all` [modes](#execution-modes) also the tasks that run after it.
+
+Set `wantedBy` to choose explicitly which tasks select yours, like systemd's `wantedBy`. The listed tasks then select it in every mode except `single`, and `before`/`after` only order it:
+
+```nix title="devenv.nix"
+{
+  tasks."myapp:migrate" = {
+    exec = "myapp migrate";
+    after = [ "devenv:processes:db" ];     # order: wait until db is ready
+    wantedBy = [ "devenv:processes:db" ];  # select: run whenever db starts
+  };
+}
+```
+
+`wantedBy` does not order tasks, so pair it with `after` or `before`.
+A task with `wantedBy = [ ]` runs only when named directly or when a selected task runs after it.
+`devenv:enterTest` uses this, so entering a shell does not run test setup.
+
 ### Dependency states
 
 <VersionCompatibility version="2.0" />
@@ -100,7 +122,9 @@ When you run a task, devenv schedules a subgraph around it rather than only that
 | `single` | only the named task |
 | `before` (default) | the task and everything *upstream* of it (its dependencies) |
 | `after` | the task and everything *downstream* of it (tasks that depend on it) |
-| `all` | the entire connected graph, both upstream and downstream |
+| `all` | the task, everything upstream and downstream of it, and the upstream of those downstream tasks |
+
+In every mode except `single`, tasks that list a selected task in [`wantedBy`](#selecting-tasks-with-wantedby) also run, and downstream tasks that set `wantedBy` run only when one of their listed tasks is selected.
 
 ```sh
 $ devenv tasks run myapp:build               # before mode (default): build + its dependencies
@@ -368,7 +392,7 @@ This ensures that cleanup tasks like removing PID files or clearing caches are e
 
 A task that runs *after* a process — a setup or configure step wired with `processes.<name>.before = [ "devenv:<name>:configure" ]`, or equivalently `tasks."devenv:<name>:configure".after = [ "devenv:processes:<name>" ]` — is *downstream* of that process. `devenv up` schedules processes in `before` mode, which runs each process's upstream dependencies but **not** its downstream tasks, so the setup step is skipped and never runs.
 
-Until this is resolved ([#2852](https://github.com/cachix/devenv/issues/2852)), run `devenv up --mode all` to include downstream setup tasks. `devenv test` already runs in `all` mode, so these tasks run there. See [Execution modes](#execution-modes).
+Since 2.3.2, add `wantedBy = [ "devenv:processes:<name>" ];` to the setup task so it runs whenever the process starts, including under `devenv up` (see [Selecting tasks with `wantedBy`](#selecting-tasks-with-wantedby)). On older versions, run `devenv up --mode all` to include downstream setup tasks. `devenv test` already runs in `all` mode, so these tasks run there. See [Execution modes](#execution-modes).
 :::
 
 
```

**File**: `examples/garage/.test.sh` (modified, +2/-2)
```diff
@@ -1,8 +1,8 @@
 #!/usr/bin/env bash
 set -ex
 
-# Blocks until garage's readiness probe passes (which requires the bucket to
-# exist) and fails if garage-configure dies, so the checks below can't race.
+# Blocks until Garage's readiness probe passes, which requires the bucket to
+# exist. Configuration failures also fail process startup.
 wait_for_processes
 
 curl -sf -H "Authorization: Bearer devtoken" \
```

**File**: `src/modules/services/garage.nix` (modified, +27/-1)
```diff
@@ -7,6 +7,8 @@
 let
   cfg = config.services.garage;
   types = lib.types;
+  supportsWantedBy = config.devenv.cli.version == null
+    || lib.versionAtLeast config.devenv.cli.version "2.3.2";
 
   parsePort = addr: lib.toInt (lib.last (lib.splitString ":" addr));
   parseHost = addr: lib.head (lib.splitString ":" addr);
@@ -249,6 +251,19 @@ in
   };
 
   config = lib.mkIf cfg.enable {
+    changelogs = [
+      {
+        date = "2026-09-22";
+        title = "services.garage: configure layout and buckets on named starts";
+        when = supportsWantedBy;
+        description = ''
+          `devenv up garage` now configures the Garage layout and buckets.
+          Configuration runs as a task after the server starts, so
+          `garage-configure` no longer appears as a separate process.
+        '';
+      }
+    ];
+
     assertions = [
       {
         assertion = cfg.adminToken != "";
@@ -277,7 +292,18 @@ in
       GARAGE_CONFIG_FILE = "${configFile}";
     };
 
-    processes.garage-configure = {
+    # Select configuration when Garage starts, including `devenv up garage`.
+    # It must run after the server starts because it applies the layout through
+    # the Garage CLI, before the server's ready probe can see the buckets.
+    tasks."devenv:garage:configure" = lib.mkIf supportsWantedBy {
+      exec = "exec ${configureScript}/bin/configure";
+      after = [ "devenv:processes:garage@started" ];
+      wantedBy = [ "devenv:processes:garage" ];
+    };
+
+    # Older CLIs cannot read wantedBy. Bare `devenv up` still starts this
+    # process as an independent root, as it did before 2.3.2.
+    processes.garage-configure = lib.mkIf (!supportsWantedBy) {
       exec = "exec ${configureScript}/bin/configure";
       after = [ "devenv:processes:garage@started" ];
     };
```

---

### Incident Patch 12: `537d9464` (2026-09-24)
**Commit Message**: fix(ci): update docs generator to devenv 2.3.1 (#3218)

**File**: `.github/workflows/generate.yml` (modified, +1/-2)
```diff
@@ -21,8 +21,7 @@ jobs:
           name: devenv
 
       - name: Install devenv
-        # TODO(sander): go back to latest once a release includes the non-TUI stdout fix.
-        run: nix profile add github:cachix/devenv/29fcc8a9a778c2e3f822ef961cc9667122e79dd5 -L --accept-flake-config
+        run: nix profile add github:cachix/devenv/v2.3.1 -L --accept-flake-config
 
       - name: Disable git-hooks
         run: |
```

---

### Incident Patch 13: `21b09683` (2026-09-24)
**Commit Message**: fix(shell): resolve allocated ports from running manager (#3211)

Seed the port allocator before CLI evaluation so shell and direnv
environments use the ports held by a running native manager. Read-only
commands keep the allocator disabled, so they read the manager's
assignments without allocating new ports. Seed values are part of the
eval cache key and survive cache invalidation.

The manager query is bounded to two seconds only for read-only
commands; up and tasks run wait for the answer so they never allocate
ports that differ from running processes.

Hot reload asks the manager again before re-evaluating, and both the
reload watcher and direnv watch the manager's PID file, so the
environment updates when processes start or stop.

Fixes #3208.

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -4,8 +4,10 @@
 
 ### Bug Fixes
 
+- Fixed `devenv shell` and direnv resolving allocated service ports to the base port while a process manager is running. Shell commands now read the running service's port without allocating new ports, so PostgreSQL's `PGPORT` points to the intended database. direnv and the hot reloading shell update the environment when processes start or stop ([#3208](https://github.com/cachix/devenv/issues/3208)).
 - Release evaluation memory after `devenv mcp` initializes its package and option caches, reducing idle memory usage ([#3065](https://github.com/cachix/devenv/issues/3065)).
 - Fixed `devenv lsp` aborting on startup with `Already registered store with name 'Dummy Store'` ([#3196](https://github.com/cachix/devenv/issues/3196)).
+
 - Fixed `devenv-run-tests --override-input` using different inputs in nested `devenv` commands.
 
 - Fixed `devenv shell "git log"` and other quoted commands failing with `not found` ([#3187](https://github.com/cachix/devenv/issues/3187)).
```

**File**: `devenv-core/src/ports.rs` (modified, +119/-8)
```diff
@@ -87,6 +87,8 @@ impl Drop for PortReservations {
 struct PortEntry {
     port: u16,
     base: u16,
+    /// True when this value came from a running process manager.
+    seeded: bool,
     /// Listeners holding the port reservation. May contain an IPv4 listener,
     /// an IPv6 listener, or both. Empty after `take_reservations()` is called.
     listeners: Vec<TcpListener>,
@@ -122,7 +124,7 @@ pub struct PortAllocator {
     strict: AtomicBool,
     /// When true, allow replay to accept ports already in use (skip binding).
     allow_in_use: AtomicBool,
-    /// When false, return the base port without reserving or caching.
+    /// When false, read manager assignments but leave other ports at their base.
     enabled: AtomicBool,
 }
 
@@ -180,14 +182,52 @@ impl PortAllocator {
             ports.entry(key).or_insert(PortEntry {
                 port: *port,
                 base: *port,
+                seeded: true,
                 listeners: vec![],
             });
         }
     }
 
+    /// Forget ports supplied by a running process manager, keeping ports
+    /// this allocator reserved itself.
+    ///
+    /// Used before seeding again when the manager may have started, stopped
+    /// or reassigned ports since the last evaluation.
+    pub fn clear_seeds(&self) {
+        self.ports
+            .lock()
+            .unwrap_or_else(|poisoned| poisoned.into_inner())
+            .retain(|_, entry| !entry.seeded);
+    }
+
+    /// Whether a running process manager supplied any port values.
+    pub fn has_seeded_ports(&self) -> bool {
+        self.ports
+            .lock()
+            .unwrap_or_else(|poisoned| poisoned.into_inner())
+            .values()
+            .any(|entry| entry.seeded)
+    }
+
+    /// Stable cache key state for ports supplied by a running manager.
+    pub fn seeded_ports_cache_key(&self) -> String {
+        let ports = self
+            .ports
+            .lock()
+            .unwrap_or_else(|poisoned| poisoned.into_inner());
+        let mut seeds: Vec<_> = ports
+            .iter()
+            .filter(|(_, entry)| entry.seeded)
+            .map(|((process, name), entry)| (process, name, entry.port))
+            .collect();
+        seeds.sort();
+        format!("{seeds:?}")
+    }
+
     /// Enable or disable port allocation.
     ///
-    /// When disabled, `allocate()` returns the base port without reserving it.
+    /// When disabled, `allocate()` returns manager assignments for seeded ports
+    /// and the base port for all others, without making new reservations.
     pub fn set_enabled(&self, enabled: bool) {
         self.enabled.store(enabled, Ordering::SeqCst);
     }
@@ -206,18 +246,21 @@ impl PortAllocator {
     ///
     /// In strict mode, only tries the base port and fails with process info if unavailable.
     pub fn allocate(&self, process_name: &str, port_name: &str, base: u16) -> Result<u16, String> {
-        if !self.enabled.load(Ordering::SeqCst) {
-            return Ok(base);
-        }
-
+        let enabled = self.enabled.load(Ordering::SeqCst);
         let mut ports = self.ports.lock().map_err(|e| e.to_string())?;
         let key = (process_name.to_string(), port_name.to_string());
 
         // Check cache first - return existing allocation if present
-        if let Some(entry) = ports.get(&key) {
+        if let Some(entry) = ports.get(&key)
+            && (enabled || entry.seeded)
+        {
             return Ok(entry.port);
         }
 
+        if !enabled {
+            return Ok(base);
+        }
+
         let strict = self.strict.load(Ordering::SeqCst);
 
         // Collect already-allocated port numbers to avoid conflicts
@@ -242,6 +285,7 @@ impl PortAllocator {
                         PortEntry {
                             port: base,
                             base,
+                            seeded: false,
                             listeners,
                         },
                     );
@@ -279,6 +323,7 @@ impl PortAllocator {
                 PortEntry {
                     port,
                     base,
+                    seeded: false,
                     listeners,
                 },
             );
@@ -367,6 +412,7 @@ impl PortAllocator {
                     PortEntry {
                         port,
                         base: port,
+                        seeded: false,
                         listeners,
                     },
                 );
@@ -395,6 +441,7 @@ impl PortAllocator {
                         PortEntry {
                             port,
                             base: port,
+                            seeded: false,
                             listeners: vec![],
                         },
                     );
@@ -411,7 +458,13 @@ impl PortAllocator {
     /// Used after a replay failure to reset state before re-evaluation.
     pub fn clear(&self) {
         if let Ok(mut ports) = self.ports.lock() {
-            ports.clear();
+      
```

**File**: `devenv-nix-backend/src/primops.rs` (modified, +17/-3)
```diff
@@ -258,14 +258,15 @@ impl PrimopRegistration for AllocatePortPrimop {
     }
 
     fn is_enabled(&self) -> bool {
-        self.allocator.is_enabled()
+        self.allocator.is_enabled() || self.allocator.has_seeded_ports()
     }
 
     fn cache_key_fragment(&self) -> String {
         format!(
-            "enabled={}:strict={}",
+            "enabled={}:strict={}:seeds={}",
             self.allocator.is_enabled(),
-            self.allocator.is_strict()
+            self.allocator.is_strict(),
+            self.allocator.seeded_ports_cache_key()
         )
     }
 
@@ -345,4 +346,17 @@ mod tests {
 
         assert_eq!(first.cache_key_fragment(), second.cache_key_fragment());
     }
+
+    #[test]
+    fn seeded_ports_enable_primop_and_change_cache_key() {
+        let allocator = Arc::new(PortAllocator::new());
+        let primop = AllocatePortPrimop::new(allocator.clone());
+        let without_manager = primop.cache_key_fragment();
+        assert!(!primop.is_enabled());
+
+        allocator.seed(&[("pg".into(), "main".into(), 5433)]);
+        assert!(primop.is_enabled());
+        assert!(!allocator.is_enabled());
+        assert_ne!(without_manager, primop.cache_key_fragment());
+    }
 }
```

**File**: `devenv/src/devenv/mod.rs` (modified, +50/-9)
```diff
@@ -1634,6 +1634,10 @@ impl Devenv {
 
     /// Invalidate cached state for hot-reload.
     pub async fn invalidate_for_reload(&self) -> Result<()> {
+        // The process manager may have started, stopped or reassigned ports
+        // since the previous evaluation.
+        self.port_allocator.clear_seeds();
+        self.seed_running_ports().await;
         self.require_cnix()?.invalidate_eval_state()
     }
 
@@ -1707,6 +1711,13 @@ impl Devenv {
         Ok(config.watch_paths(&self.devenv_root))
     }
 
+    /// Files whose changes alter the ports a running process manager assigns.
+    /// The manager writes its PID file once it answers port queries and
+    /// removes it on shutdown, so watching it re-evaluates the environment.
+    pub(crate) fn process_manager_watch_paths(&self) -> Vec<PathBuf> {
+        vec![self.native_manager_pid_file()]
+    }
+
     pub async fn prepare_shell(
         &self,
         cmd: &Option<String>,
@@ -3509,8 +3520,19 @@ impl Devenv {
         .await
     }
 
+    /// Read allocations from a running native manager without enabling new
+    /// port allocation for commands that only inspect the environment.
+    pub async fn seed_running_ports(&self) {
+        self.load_running_ports(false).await;
+    }
+
     /// Reserve ports already in use by a running native process manager so
-    /// that Nix evaluation does not hand them out as fresh allocations.
+    /// that process-starting commands do not hand them out again.
+    pub async fn reserve_running_ports(&self) {
+        self.load_running_ports(true).await;
+    }
+
+    /// Seed manager assignments before Nix evaluation.
     ///
     /// Only seeds from a manager backed by a live PID file. A manager whose PID
     /// file is gone is shutting down (or already dead): its socket can keep
@@ -3521,8 +3543,8 @@ impl Devenv {
     /// PID file mirrors the liveness signal used by `up()`'s "already running"
     /// guard.
     ///
-    /// Best-effort: failures are logged at trace level and do not propagate.
-    pub async fn reserve_running_ports(&self) {
+    /// Best-effort: failures are logged and do not propagate.
+    async fn load_running_ports(&self, enable_new_allocations: bool) {
         // A healthy native manager has both a live PID file and an answering
         // socket. If the PID file is not alive, fall back to the generic
         // running-processes check and do not seed from the socket.
@@ -3535,12 +3557,28 @@ impl Devenv {
 
         self.port_allocator.set_allow_in_use(false);
 
-        match processes::NativeManagerClient::api_request(
-            &self.native_socket_path(),
+        let socket_path = self.native_socket_path();
+        let request = processes::NativeManagerClient::api_request(
+            &socket_path,
             &processes::ApiRequest::Ports,
-        )
-        .await
-        {
+        );
+        let response = if enable_new_allocations {
+            // Allocating without the manager's assignments would hand out
+            // ports that differ from the running processes, so wait for them.
+            request.await
+        } else {
+            // Reading runs before every CLI command. A socket that accepts but
+            // never answers must not leave those commands waiting indefinitely.
+            match tokio::time::timeout(std::time::Duration::from_secs(2), request).await {
+                Ok(response) => response,
+                Err(_) => {
+                    warn!("timed out querying native manager for ports, using base ports");
+                    return;
+                }
+            }
+        };
+
+        match response {
             Ok(processes::ApiResponse::PortAllocations { ports }) => {
                 let seeds: Vec<(String, String, u16)> = ports
                     .into_iter()
@@ -3552,7 +3590,9 @@ impl Devenv {
                         "Seeded port allocator from native manager"
                     );
                     self.port_allocator.seed(&seeds);
-                    self.port_allocator.set_enabled(true);
+                    if enable_new_allocations {
+                        self.port_allocator.set_enabled(true);
+                    }
                 }
             }
             Ok(_) => {
@@ -3635,6 +3675,7 @@ impl Devenv {
 
         let mut input_paths = env.inputs.clone();
         input_paths.extend(self.dotenv_watch_paths().await?);
+        input_paths.extend(self.process_manager_watch_paths());
         input_paths.sort();
         input_paths.dedup();
 
```

**File**: `devenv/src/main.rs` (modified, +5/-0)
```diff
@@ -1107,6 +1107,11 @@ async fn run_backend(
 
     let devenv = Devenv::new(devenv_options, shutdown.clone()).await?;
 
+    // Commands that evaluate the environment need the ports already assigned
+    // by a running process manager before their first Nix evaluation. Reading
+    // those assignments must not allocate new ports for unrelated commands.
+    devenv.seed_running_ports().await;
+
     // PTY shell hands Devenv off to an owner task; we reclaim it after the session.
     if use_pty && let Commands::Shell { cmd: None, args } = command {
         // Pre-compute shell environment while we still own Devenv directly.
```

**File**: `devenv/src/reload/owner.rs` (modified, +3/-0)
```diff
@@ -188,6 +188,9 @@ async fn add_watch_paths(devenv: &Devenv, watcher: &WatcherHandle) {
         }
         Err(e) => tracing::warn!("Failed to resolve dotenv watch paths: {}", e),
     }
+    watcher
+        .watch_logical_many(devenv.process_manager_watch_paths())
+        .await;
 
     let Some(pool) = devenv.eval_cache_pool() else {
         return;
```

**File**: `tests/postgres-allocated-port-shell/.gitignore` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+/repo1/
+/repo2/
```

**File**: `tests/postgres-allocated-port-shell/.test-config.yml` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+use_shell: true
```

---

### Incident Patch 14: `f7591a02` (2026-09-23)
**Commit Message**: fix(mcp): release evaluation memory after cache initialization (#3200)

* fix(mcp): collect evaluation garbage after cache initialization

Backport Nix root pooling through the pinned fork revision. Keep the memory regression to expose the remaining C API root retention.

Assisted-by: Codex (GPT-6)

* fix(mcp): use pooled roots for C API references

Pin the Nix fork with pooled C API root ownership. The evaluator release regression now passes and MCP returns evaluation memory after cache initialization.

Assisted-by: Codex (GPT-6)

* docs: link MCP memory fix to issue 3065

Assisted-by: Codex (GPT-6)

* fix(mcp): pin Nix fork with upstream GC test refinements

Update both lock files to cachix/nix@bd10d7f after adapting the final test changes from NixOS/nix#16503 to our pooled root implementation. The fork already contains the functional evaluator and C API fixes.

Assisted-by: Codex (GPT-6)

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -4,6 +4,7 @@
 
 ### Bug Fixes
 
+- Release evaluation memory after `devenv mcp` initializes its package and option caches, reducing idle memory usage ([#3065](https://github.com/cachix/devenv/issues/3065)).
 - Fixed `devenv lsp` aborting on startup with `Already registered store with name 'Dummy Store'` ([#3196](https://github.com/cachix/devenv/issues/3196)).
 - Fixed `devenv-run-tests --override-input` using different inputs in nested `devenv` commands.
 
```

**File**: `devenv-nix-backend/src/gc_boehm.rs` (modified, +63/-1)
```diff
@@ -214,6 +214,29 @@ pub fn collect(stage: &'static str) {
         return;
     }
 
+    collect_inner(stage, nix_bindings_expr::eval_state::gc_now);
+}
+
+/// Collect after a one-shot evaluator and its thread have been dropped.
+/// Idle servers may never allocate in Nix again, so cleanup cannot depend on
+/// allocation pressure or the opt-in diagnostics setting.
+pub fn collect_full(stage: &'static str) -> Result<()> {
+    register_current_thread()?;
+    collect_inner(stage, || {
+        // Two passes release finalized graphs. Up to seven more age the freed
+        // blocks past Boehm's default unmap threshold of six collections.
+        // Keep this idle-only work here rather than changing Nix's GC policy.
+        for pass in 0..9 {
+            nix_bindings_expr::eval_state::gc_now();
+            if pass >= 1 && heap_stats().free_bytes == 0 {
+                break;
+            }
+        }
+    });
+    Ok(())
+}
+
+fn collect_inner(stage: &'static str, collect: impl FnOnce()) {
     let before = heap_stats();
     let span = tracing::info_span!(
         target: "devenv_nix_backend::gc_boehm",
@@ -238,7 +261,7 @@ pub fn collect(stage: &'static str) {
     let _entered = span.enter();
 
     let started = Instant::now();
-    nix_bindings_expr::eval_state::gc_now();
+    collect();
     let elapsed = started.elapsed().as_secs_f64();
     let after = heap_stats();
     let reclaimed = before.live_bytes().saturating_sub(after.live_bytes());
@@ -257,3 +280,42 @@ pub fn collect(stage: &'static str) {
     span.record("gc_bytes_since_after", after.bytes_since_gc);
     span.record("gc_collections_after", after.collections);
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use nix_bindings_expr::eval_state::EvalState;
+    use nix_bindings_store::store::Store;
+
+    #[test]
+    fn releases_heap_after_evaluator_thread_exits() {
+        register_current_thread().unwrap();
+        let store = Store::open(Some("dummy://"), []).unwrap();
+        let mut state = EvalState::new(store, []).unwrap();
+        let live_value = state.new_value_str("still alive").unwrap();
+
+        const ALLOCATION: usize = 64 * 1024 * 1024;
+        std::thread::spawn(|| {
+            register_current_thread().unwrap();
+            let store = Store::open(Some("dummy://"), []).unwrap();
+            let mut state = EvalState::new(store, []).unwrap();
+            let value = state.new_value_str(&"x".repeat(ALLOCATION)).unwrap();
+            std::hint::black_box(&value);
+        })
+        .join()
+        .unwrap();
+
+        let before = heap_stats();
+        collect_full("test_evaluator_exited").unwrap();
+        let after = heap_stats();
+        assert!(
+            before.live_bytes().saturating_sub(after.live_bytes()) >= ALLOCATION as u64,
+            "evaluation garbage was retained: before={before:?}, after={after:?}"
+        );
+        assert!(
+            after.unmapped_bytes.saturating_sub(before.unmapped_bytes) >= ALLOCATION as u64,
+            "unused heap was not returned to the OS: before={before:?}, after={after:?}"
+        );
+        assert_eq!(state.require_string(&live_value).unwrap(), "still alive");
+    }
+}
```

**File**: `devenv.lock` (modified, +3/-3)
```diff
@@ -530,11 +530,11 @@
         "nixpkgs-regression": "nixpkgs-regression"
       },
       "locked": {
-        "lastModified": 1788036898,
-        "narHash": "sha256-3NT3yTvoRT7+rxLDNovpyeTDIJkZlBoO72rcu2x9Y9o=",
+        "lastModified": 1790176416,
+        "narHash": "sha256-acP7QvsB+dHghUeL9AwSSZ3qS//skpqjv484aveg1EQ=",
         "owner": "cachix",
         "repo": "nix",
-        "rev": "b9b81726b38469c55b9706d80d37d6c73cc7f76c",
+        "rev": "bd10d7f563420c6034b9d1dc75c4168fc01e5afc",
         "type": "github"
       },
       "original": {
```

**File**: `devenv/src/mcp.rs` (modified, +12/-2)
```diff
@@ -589,7 +589,17 @@ pub async fn run_mcp_server(
         })
         .map_err(|e| miette!("Failed to spawn MCP cache init thread: {}", e))?;
 
-    // Errors are held until the init thread is joined, so no path detaches it.
+    // Join immediately when evaluation finishes so its stack no longer roots
+    // Nix values. Cached searches do not allocate in Nix and cannot trigger GC.
+    let init_task = tokio::task::spawn_blocking(move || {
+        let result = init_handle.join();
+        if let Err(error) = devenv_nix_backend::gc_boehm::collect_full("mcp_cache_initialized") {
+            warn!(%error, "failed to collect MCP evaluation memory");
+        }
+        result
+    });
+
+    // Retain the join task until serving ends, including on serving errors.
     let serve_result: Result<()> = async {
         match http_port {
             Some(port) => {
@@ -661,7 +671,7 @@ pub async fn run_mcp_server(
 
     devenv_nix_backend::trigger_interrupt();
 
-    let init_result = tokio::task::spawn_blocking(move || init_handle.join())
+    let init_result = init_task
         .await
         .map_err(|e| miette!("Failed to join MCP cache init thread: {}", e))?;
 
```

**File**: `flake.lock` (modified, +3/-3)
```diff
@@ -139,11 +139,11 @@
         "nixpkgs-regression": []
       },
       "locked": {
-        "lastModified": 1788036898,
-        "narHash": "sha256-3NT3yTvoRT7+rxLDNovpyeTDIJkZlBoO72rcu2x9Y9o=",
+        "lastModified": 1790176416,
+        "narHash": "sha256-acP7QvsB+dHghUeL9AwSSZ3qS//skpqjv484aveg1EQ=",
         "owner": "cachix",
         "repo": "nix",
-        "rev": "b9b81726b38469c55b9706d80d37d6c73cc7f76c",
+        "rev": "bd10d7f563420c6034b9d1dc75c4168fc01e5afc",
         "type": "github"
       },
       "original": {
```

---

### Incident Patch 15: `51636c82` (2026-09-23)
**Commit Message**: fix(lsp): prevent duplicate Nix store registration in bundled nixd (#3213)

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -4,6 +4,7 @@
 
 ### Bug Fixes
 
+- Fixed `devenv lsp` aborting on startup with `Already registered store with name 'Dummy Store'` ([#3196](https://github.com/cachix/devenv/issues/3196)).
 - Fixed `devenv-run-tests --override-input` using different inputs in nested `devenv` commands.
 
 - Fixed `devenv shell "git log"` and other quoted commands failing with `not found` ([#3187](https://github.com/cachix/devenv/issues/3187)).
```

**File**: `flake.nix` (modified, +8/-1)
```diff
@@ -183,7 +183,14 @@
                     llvmStatic = true;
                     inherit nixComponents;
                     nixf = nixdPkgs.nixf.override { inherit (nixComponents) nix-expr; };
-                    nixt = nixdPkgs.nixt.override { inherit nixComponents; };
+                    # Shared libnixt would embed a second copy of the static Nix
+                    # libraries, causing duplicate store registration at startup.
+                    nixt = (nixdPkgs.nixt.override { inherit nixComponents; }).overrideAttrs (old: {
+                      mesonFlags = (old.mesonFlags or [ ]) ++ [
+                        (prev.lib.mesonOption "default_library" "static")
+                      ];
+                      propagatedBuildInputs = (old.propagatedBuildInputs or [ ]) ++ (old.buildInputs or [ ]);
+                    });
                   };
               crate2nix = final.callPackage "${inputs.crate2nix}/crate2nix/default.nix" { };
               libghostty-vt = final.callPackage "${inputs.ghostty}/nix/libghostty-vt.nix" {
```

**File**: `nix/workspace.nix` (modified, +3/-0)
```diff
@@ -168,6 +168,9 @@ let
         ''
           mkdir -p $out/bin
 
+          # Catch duplicate Nix store registrations in the bundled language server.
+          ${lib.getBin nixd}/bin/nixd --version > /dev/null
+
           cp $src/bin/devenv $out/bin/
           cp $devenvRunTests/bin/devenv-run-tests $out/bin/
           cp $devenvProxy/bin/devenv-proxy $out/bin/
```

#### Recent Merged Pull Requests:
- **PR #3239** (2026-09-29): fix(test): report disabled process dependencies before startup (@domenkozar)
- **PR #3237** (2026-09-29): fix(processes): wait for live daemon startup (@domenkozar)
- **PR #3236** (2026-09-29): feat(cli): complete process names in shell (@domenkozar)
- **PR #3235** (2026-09-29): Added docs about helix support (@YPares)
- **PR #3234** (2026-09-29): fix(tests): declare python3 for process-compose-interactive (@onnimonni)
- **PR #3231** (2026-09-27): fix(shell): preserve Nushell structured env on reload (@domenkozar)
- **PR #3228** (2026-09-26): fix(tasks): reject task names containing "::" (@daniel-chambers)
- **PR #3225** (2026-09-25): fix(opentofu): default lsp.package to tofu-ls (@onnimonni)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
