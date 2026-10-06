# Forensic Learning Record (Deep Inspection): TabularisDB/tabularis

> **Canonical Artifact**: `07_PROJECT_LEARNING/tabularisdb-tabularis-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/TabularisDB/tabularis](https://github.com/TabularisDB/tabularis))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:26:52.635Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `TabularisDB/tabularis`
- **Description**: Open-source desktop SQL workspace with 3 built-in database drivers and 16 shipped plugins, including SQL Server, DuckDB, ClickHouse and Redis. Built-in MCP server for Claude, Cursor and Devin, SQL notebooks and visual EXPLAIN.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5120 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/create-plugin/templates/rust-driver/src/utils/identifiers.rs`
```
//! SQL identifier quoting.

/// Quote an identifier using the given quote character, doubling any
/// occurrences of that character inside the identifier to escape them.
///
/// ```
/// assert_eq!(quote_identifier("users", '"'), "\"users\"");
/// assert_eq!(quote_identifier("weird\"name", '"'), "\"weird\"\"name\"");
/// assert_eq!(quote_identifier("items", '`'),  "`items`");
/// ```
pub fn quote_identifier(name: &str, quote: char) -> String {
    let mut out = String::with_capacity(name.len() + 2);
    out.push(quote);
    for c in name.chars() {
        if c == quote {
            out.push(quote);
        }
        out.push(c);
    }
    out.push(quote);
    out
}

#[cfg(test)]
mod tests {
    use super::quote_identifier;

    #[test]
    fn quotes_plain_names() {
        assert_eq!(quote_identifier("users", '"'), "\"users\"");
        assert_eq!(quote_identifier("users", '`'), "`users`");
    }

    #[test]
    fn escapes_embedded_quotes() {
        assert_eq!(quote_identifier("a\"b", '"'), "\"a\"\"b\"");
        assert_eq!(quote_identifier("a`b", '`'), "`a``b`");
    }

    #[test]
    fn handles_empty() {
        assert_eq!(quote_identifier("", '"'), "\"\"");
    }
}

```

### Core Architecture Module: `packages/create-plugin/templates/rust-driver/src/utils/mod.rs`
```
pub mod identifiers;
pub mod pagination;

```

### Core Architecture Module: `packages/create-plugin/templates/rust-driver/src/utils/pagination.rs`
```
//! Pagination helpers.

/// Wrap a SELECT with LIMIT/OFFSET. Page numbers are 1-indexed.
///
/// ```
/// assert_eq!(
///   paginate("SELECT * FROM users", 2, 50),
///   "SELECT * FROM users LIMIT 50 OFFSET 50"
/// );
/// ```
pub fn paginate(query: &str, page: u64, page_size: u64) -> String {
    let safe_page = page.max(1);
    let offset = (safe_page - 1).saturating_mul(page_size);
    format!("{} LIMIT {} OFFSET {}", query.trim(), page_size, offset)
}

#[cfg(test)]
mod tests {
    use super::paginate;

    #[test]
    fn first_page() {
        assert_eq!(paginate("SELECT 1", 1, 100), "SELECT 1 LIMIT 100 OFFSET 0");
    }

    #[test]
    fn later_page() {
        assert_eq!(paginate("SELECT 1", 3, 25), "SELECT 1 LIMIT 25 OFFSET 50");
    }

    #[test]
    fn page_zero_treated_as_one() {
        assert_eq!(paginate("SELECT 1", 0, 10), "SELECT 1 LIMIT 10 OFFSET 0");
    }
}

```

### Core Architecture Module: `packages/plugin-api/src/hooks.ts`
```
import { getHost } from "./host";
import type {
  UsePluginConnectionReturn,
  UsePluginModalReturn,
  UsePluginQueryReturn,
  UsePluginSettingReturn,
  UsePluginThemeReturn,
  UsePluginToastReturn,
  PluginTranslator,
} from "./types";

/**
 * Execute read-only SQL queries against the active connection.
 * Returns `{ executeQuery, loading, error }` — `executeQuery` resolves with
 * `{ columns, rows }` or throws a plain Error with the host's error message.
 */
export function usePluginQuery(): UsePluginQueryReturn {
  return getHost().usePluginQuery();
}

/**
 * Active connection metadata. Fields are null when no connection is active.
 */
export function usePluginConnection(): UsePluginConnectionReturn {
  return getHost().usePluginConnection();
}

/**
 * Show system-level info/warning/error notifications.
 */
export function usePluginToast(): UsePluginToastReturn {
  return getHost().usePluginToast();
}

/**
 * Read and write settings owned by a specific plugin.
 * Pass your plugin id (the one declared in the `.tabularium` manifest).
 */
export function usePluginSetting(pluginId: string): UsePluginSettingReturn {
  return getHost().usePluginSetting(pluginId);
}

/**
 * Access the plugin's translations. Uses the plugin id as the i18next
 * namespace — the host registers it automatically from locales/*.json.
 */
export function usePluginTranslation(pluginId: string): PluginTranslator {
  return getHost().usePluginTranslation(pluginId);
}

/**
 * Open and close host-managed modals with custom content.
 */
export function usePluginModal(): UsePluginModalReturn {
  return getHost().usePluginModal();
}

/**
 * Current theme metadata plus the full design-token color map.
 */
export function usePluginTheme(): UsePluginThemeReturn {
  return getHost().usePluginTheme();
}

/**
 * Open a URL in the system's default browser.
 * Plugin components should use this instead of window.open for external URLs.
 */
export async function openUrl(url: string): Promise<void> {
  return getHost().openUrl(url);
}

```

### Core Architecture Module: `src-tauri/src/dump_utils.rs`
```
/// Returns a properly quoted, schema-qualified table identifier for SQL output.
///
/// - MySQL: `table` (backtick-quoted, no schema prefix)
/// - PostgreSQL: "schema"."table" (double-quote-quoted, schema-qualified)
/// - SQLite / other: "table" (double-quote-quoted)
pub fn format_table_ref(driver: &str, schema: &str, table: &str) -> String {
    match driver {
        "mysql" => format!("`{}`", table),
        "postgres" => format!(r#""{}"."{}""#, schema, table),
        _ => format!(r#""{}""#, table),
    }
}

/// Returns a DROP TABLE IF EXISTS statement using driver-specific quoting.
pub fn drop_table_if_exists(driver: &str, schema: &str, table: &str) -> String {
    format!(
        "DROP TABLE IF EXISTS {};",
        format_table_ref(driver, schema, table)
    )
}

/// Returns an INSERT INTO ... VALUES ... statement using driver-specific quoting.
pub fn insert_into_statement(driver: &str, schema: &str, table: &str, values: &str) -> String {
    format!(
        "INSERT INTO {} VALUES {};",
        format_table_ref(driver, schema, table),
        values
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    mod format_table_ref_tests {
        use super::*;

        #[test]
        fn mysql_uses_backticks_no_schema() {
            assert_eq!(format_table_ref("mysql", "mydb", "users"), "`users`");
        }

        #[test]
        fn postgres_uses_double_quotes_with_schema() {
            assert_eq!(
                format_table_ref("postgres", "public", "users"),
                r#""public"."users""#
            );
        }

        #[test]
        fn postgres_preserves_custom_schema() {
            assert_eq!(
                format_table_ref("postgres", "myschema", "orders"),
                r#""myschema"."orders""#
            );
        }

        #[test]
        fn sqlite_uses_double_quotes_no_schema() {
            assert_eq!(format_table_ref("sqlite", "", "products"), r#""products""#);
        }

        #[test]
        fn unknown_driver_uses_double_quotes() {
            assert_eq!(format_table_ref("unknown", "", "t"), r#""t""#);
        }
    }

    mod drop_table_if_exists_tests {
        use super::*;

        #[test]
        fn mysql_statement() {
            assert_eq!(
                drop_table_if_exists("mysql", "", "users"),
                "DROP TABLE IF EXISTS `users`;"
            );
        }

        #[test]
        fn postgres_statement_with_schema() {
            assert_eq!(
                drop_table_if_exists("postgres", "public", "users"),
                r#"DROP TABLE IF EXISTS "public"."users";"#
            );
        }

        #[test]
        fn sqlite_statement() {
            assert_eq!(
                drop_table_if_exists("sqlite", "", "users"),
                r#"DROP TABLE IF EXISTS "users";"#
            );
        }
    }

    mod insert_into_statement_tests {
        use super::*;

        #[test]
        fn mysql_statement() {
            assert_eq!(
                insert_into_statement("mysql", "", "users", "(1, 'Alice')"),
                "INSERT INTO `users` VALUES (1, 'Alice');"
            );
        }

        #[test]
        fn postgres_statement_with_schema() {
            assert_eq!(
                insert_into_statement("postgres", "public", "users", "(1, 'Alice')"),
                r#"INSERT INTO "public"."users" VALUES (1, 'Alice');"#
            );
        }

        #[test]
        fn sqlite_statement() {
            assert_eq!(
                insert_into_statement("sqlite", "", "users", "(1, 'Alice')"),
                r#"INSERT INTO "users" VALUES (1, 'Alice');"#
            );
        }

        #[test]
        fn postgres_multiple_rows() {
            assert_eq!(
                insert_into_statement("postgres", "app", "orders", "(1, 100), (2, 200)"),
                r#"INSERT INTO "app"."orders" VALUES (1, 100), (2, 200);"#
            );
        }
    }
}

```

### Core Architecture Module: `src-tauri/src/keychain_utils.rs`
```
use keyring::Entry;

use crate::sandbox::{self, Sandbox};

const SERVICE_NAME: &str = "tabularis";

/// Advice appended to keychain failures inside the Snap package.
///
/// `password-manager-service` is declared as a plug but is not auto-connected
/// by default, so every Secret Service call is refused by AppArmor until the
/// user (or the Snap Store, once auto-connection is granted) connects it.
pub const SNAP_KEYCHAIN_HINT: &str = "The snap sandbox is blocking access to the system keychain. \
Run `sudo snap connect tabularis:password-manager-service` and restart Tabularis.";

/// Converts a keyring failure into the message surfaced to the frontend.
///
/// Delegates to [`describe_error`] with the sandbox of the running process.
pub fn keychain_error(err: keyring::Error) -> String {
    describe_error(&err, sandbox::current())
}

/// Pure formatter behind [`keychain_error`].
///
/// A platform failure inside a snap is almost always the missing
/// `password-manager-service` connection, so the message tells the user how
/// to fix it instead of leaving them with a raw D-Bus/AppArmor error. Every
/// other error keeps the keyring crate's own description.
pub fn describe_error(err: &keyring::Error, sandbox: Option<Sandbox>) -> String {
    let message = err.to_string();
    match (err, sandbox) {
        (keyring::Error::PlatformFailure(_), Some(Sandbox::Snap)) => {
            format!("{message}. {SNAP_KEYCHAIN_HINT}")
        }
        _ => message,
    }
}

/// What `save_connection` / `update_connection` must do with the keychain
/// entry of a password-like field, given the value the frontend sent.
///
/// * `None`: the edit dialog omits a password the user did not touch, so the
///   stored secret is kept.
/// * `Some("")`: an explicit "no password" (a plugin hid the login inputs, or
///   the field was cleared on purpose). Any stored secret must go, otherwise
///   the next connect would hand a stale login to the driver. Storing the
///   empty string instead is not an option: the Linux keyutils store rejects
///   empty secrets.
/// * anything else is stored as-is.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StoredPasswordChange<'a> {
    Keep,
    Delete,
    Store(&'a str),
}

pub fn stored_password_change(password: Option<&str>) -> StoredPasswordChange<'_> {
    match password {
        None => StoredPasswordChange::Keep,
        Some("") => StoredPasswordChange::Delete,
        Some(value) => StoredPasswordChange::Store(value),
    }
}

pub fn set_db_password(connection_id: &str, password: &str) -> Result<(), String> {
    eprintln!("[Keychain] Setting DB password for {}", connection_id);
    let entry =
        Entry::new(SERVICE_NAME, &format!("{}:db", connection_id)).map_err(|e| e.to_string())?;
    entry.set_password(password).map_err(|e| {
        eprintln!("[Keychain] Error setting password: {}", e);
        keychain_error(e)
    })
}

pub fn get_db_password(connection_id: &str, connection_name: &str) -> Result<String, String> {
    if connection_name.is_empty() {
        eprintln!("[Keychain] Getting DB password for {}", connection_id);
    } else {
        eprintln!(
            "[Keychain] Getting DB password for {} ({})",
            connection_name, connection_id
        );
    }
    let entry =
        Entry::new(SERVICE_NAME, &format!("{}:db", connection_id)).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(pwd) => {
            eprintln!("[Keychain] Password found for {}", connection_id);
            Ok(pwd)
        }
        Err(e) => {
            eprintln!(
                "[Keychain] Error getting password for {}: {}",
                connection_id, e
            );
            Err(keychain_error(e))
        }
    }
}

pub fn delete_db_password(connection_id: &str) -> Result<(), String> {
    let entry =
        Entry::new(SERVICE_NAME, &format!("{}:db", connection_id)).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(keychain_error(e)),
    }
}

pub fn set_connection_uri(connection_id: &str, connection_uri: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, &format!("{}:connection_uri", connection_id))
        .map_err(|e| e.to_string())?;
    entry.set_password(connection_uri).map_err(keychain_error)
}

pub fn get_connection_uri(connection_id: &str) -> Result<String, String> {
    let entry = Entry::new(SERVICE_NAME, &format!("{}:connection_uri", connection_id))
        .map_err(|e| e.to_string())?;
    entry.get_password().map_err(keychain_error)
}

pub fn delete_connection_uri(connection_id: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, &format!("{}:connection_uri", connection_id))
        .map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(keychain_error(e)),
    }
}

pub fn set_ssh_password(connection_id: &str, password: &str) -> Result<(), String> {
    eprintln!("[Keychain] Setting SSH password for {}", connection_id);
    let entry =
        Entry::new(SERVICE_NAME, &format!("{}:ssh", connection_id)).map_err(|e| e.to_string())?;
    entry.set_password(password).map_err(|e| {
        eprintln!("[Keychain] Error setting SSH password: {}", e);
        keychain_error(e)
    })
}

pub fn get_ssh_password(connection_id: &str, connection_name: &str) -> Result<String, String> {
    if connection_name.is_empty() {
        eprintln!("[Keychain] Getting SSH password for {}", connection_id);
    } else {
        eprintln!(
            "[Keychain] Getting SSH password for {} ({})",
            connection_name, connection_id
        );
    }
    let entry =
        Entry::new(SERVICE_NAME, &format!("{}:ssh", connection_id)).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(pwd) => {
            eprintln!("[Keychain] SSH Password found for {}", connection_id);
            Ok(pwd)
        }
        Err(e) => {
            eprintln!(
                "[Keychain] Error getting SSH password for {}: {}",
                connection_id, e
            );
            Err(keychain_error(e))
        }
    }
}

pub fn delete_ssh_password(connection_id: &str) -> Result<(), String> {
    let entry =
        Entry::new(SERVICE_NAME, &format!("{}:ssh", connection_id)).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(keychain_error(e)),
    }
}

pub fn set_ssh_key_passphrase(connection_id: &str, passphrase: &str) -> Result<(), String> {
    eprintln!(
        "[Keychain] Setting SSH key passphrase for {}",
        connection_id
    );
    let entry = Entry::new(SERVICE_NAME, &format!("{}:ssh_passphrase", connection_id))
        .map_err(|e| e.to_string())?;
    entry.set_password(passphrase).map_err(|e| {
        eprintln!("[Keychain] Error setting SSH key passphrase: {}", e);
        keychain_error(e)
    })
}

pub fn get_ssh_key_passphrase(
    connection_id: &str,
    connection_name: &str,
) -> Result<String, String> {
    if connection_name.is_empty() {
        eprintln!(
            "[Keychain] Getting SSH key passphrase for {}",
            connection_id
        );
    } else {
        eprintln!(
            "[Keychain] Getting SSH key passphrase for {} ({})",
            connection_name, connection_id
        );
    }
    let entry = Entry::new(SERVICE_NAME, &format!("{}:ssh_passphrase", connection_id))
        .map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(pwd) => {
            eprintln!("[Keychain] SSH key passphrase found for {}", connection_id);
            Ok(pwd)
        }
        Err(e) => {
            eprintln!(
                "[Keychain] Error getting SSH key passphrase for {}: {}",
                connection_id, e
            );
            Err(keychain_error(e))
        }
    }
}

pub fn delete_ssh_key_passphrase(connection_id: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, &format!("{}:ssh_passphrase", connection_id))
        .map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(keychain_error(e)),
    }
}

pub fn set_ai_key(provider: &str, key: &str) -> Result<(), String> {
    eprintln!("[Keychain] Setting AI key for {}", provider);
    let entry =
        Entry::new(SERVICE_NAME, &format!("ai_key:{}", provider)).map_err(|e| e.to_string())?;
    entry.set_password(key).map_err(|e| {
        eprintln!("[Keychain] Error setting AI key: {}", e);
        keychain_error(e)
    })
}

/// Read an AI key from the keychain.
///
/// Returns `Ok(Some(key))` when present, `Ok(None)` when the keychain
/// definitively has no such entry (`NoEntry`), and `Err` only for genuine /
/// transient failures (access denied, prompt timeout, securityd error, ...).
/// Distinguishing the two lets the cache layer avoid storing a transient
/// failure as a permanent "absent" — which would otherwise make a configured
/// key appear missing until the app restarts.
pub fn get_ai_key(provider: &str) -> Result<Option<String>, String> {
    #[cfg(debug_assertions)]
    log::info!("[Keychain] Getting AI key for {}", provider);
    let entry =
        Entry::new(SERVICE_NAME, &format!("ai_key:{}", provider)).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(pwd) => Ok(Some(pwd)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => {
            eprintln!("[Keychain] Error getting AI key for {}: {}", provider, e);
            Err(keychain_error(e))
        }
    }
}

pub fn delete_ai_key(provider: &str) -> Result<(), String> {
    let entry =
        Entry::new(SERVICE_NAME, &format!("ai_key:{}", provider)).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        
```

### Core Architecture Module: `src-tauri/src/sql_database_statements.rs`
```
//! Recognises the few SQL statements that change which databases exist, so the
//! app can keep the sidebar in sync with the server instead of waiting for a
//! manual refresh (#525, following #518 and #524).
//!
//! Everything here is deliberately narrow and fails closed: a statement that
//! isn't unambiguously recognised returns `None` rather than a guess. A missed
//! detection just leaves the sidebar stale until the next refresh, which is
//! today's behaviour anyway; a wrong detection would tell the user a database
//! is gone when it isn't, which is worse than doing nothing.

use crate::ai_activity::{has_trailing_statements, strip_strings_and_comments};

#[cfg(test)]
mod tests;

/// The database targeted by a `DROP DATABASE` / `DROP SCHEMA` statement.
///
/// Returns `None` unless the input is exactly one such statement. In
/// particular, a multi-statement payload returns `None`: which statement
/// actually succeeded is the caller's problem to disambiguate, not this
/// function's to guess.
///
/// The statement must also start with `DROP`, so a leading comment (`-- note`
/// before the statement) is not recognised. Callers pass the statement they
/// just executed, which in practice starts at the keyword; and a miss here only
/// costs a stale sidebar until the next refresh.
pub fn dropped_database(sql: &str) -> Option<String> {
    // Only used to reject multi-statement payloads and to ignore text inside
    // comments and string literals. The walk below reads the original string,
    // because stripping also blanks out quoted identifiers -- which is exactly
    // where the database name lives.
    if has_trailing_statements(&strip_strings_and_comments(sql)) {
        return None;
    }

    let rest = after_keyword(sql, "DROP")?;
    // MySQL and Postgres both accept SCHEMA as a synonym of DATABASE here.
    let rest = after_keyword(rest, "DATABASE").or_else(|| after_keyword(rest, "SCHEMA"))?;
    let rest = match after_keyword(rest, "IF") {
        Some(after_if) => after_keyword(after_if, "EXISTS")?,
        None => rest,
    };

    identifier(rest)
}

/// The text following an ASCII SQL keyword at the start of `s` (after leading
/// whitespace), matched case-insensitively and left-trimmed.
///
/// Requires a word boundary after the keyword -- whitespace, an identifier
/// quote, or end of input -- so `DATABASEX` never matches `DATABASE`.
fn after_keyword<'a>(s: &'a str, keyword: &str) -> Option<&'a str> {
    let s = s.trim_start();
    // Byte slicing is safe here: the keyword is pure ASCII, so if the leading
    // bytes match it they are all single-byte characters and `keyword.len()`
    // lands on a character boundary.
    if s.len() < keyword.len()
        || !s.as_bytes()[..keyword.len()].eq_ignore_ascii_case(keyword.as_bytes())
    {
        return None;
    }
    let tail = &s[keyword.len()..];
    match tail.chars().next() {
        None => Some(tail),
        Some(c) if c.is_whitespace() || is_quote(c) => Some(tail.trim_start()),
        Some(_) => None,
    }
}

/// Whether `c` opens a quoted identifier in any dialect the app supports.
fn is_quote(c: char) -> bool {
    matches!(c, '`' | '"' | '[')
}

/// The single identifier `s` consists of, unquoted.
///
/// Accepts backticks (MySQL/MariaDB), double quotes (Postgres, SQL standard)
/// and brackets (SQL Server), or a bare name. Anything other than whitespace
/// and an optional `;` after the identifier returns `None`, so
/// `DROP DATABASE foo bar` yields nothing rather than silently taking `foo`.
///
/// A doubled quote inside a quoted identifier (a literal backtick in the name)
/// is not handled: it ends the name early, the leftover fails the trailing
/// check, and the result is `None`. That shape is vanishingly rare for a
/// database name, and failing closed costs a missed detection rather than a
/// truncated name.
fn identifier(s: &str) -> Option<String> {
    let name = match s.chars().next()? {
        quote @ ('`' | '"') => delimited(s, quote, quote)?,
        '[' => delimited(s, '[', ']')?,
        _ => bare(s)?,
    };
    Some(name.to_string())
}

/// The text between `open` and the next `close`, if what follows it is only
/// whitespace and an optional statement terminator.
fn delimited(s: &str, open: char, close: char) -> Option<&str> {
    let body = s.strip_prefix(open)?;
    let (name, after) = body.split_once(close)?;
    only_terminator(after).then_some(name)
}

/// A leading unquoted identifier: alphanumerics, `_` and `$` (accepted by
/// MySQL, and present in some legacy schema names).
fn bare(s: &str) -> Option<&str> {
    let end = s
        .find(|c: char| !(c.is_alphanumeric() || c == '_' || c == '$'))
        .unwrap_or(s.len());
    let (name, after) = s.split_at(end);
    (!name.is_empty() && only_terminator(after)).then_some(name)
}

fn only_terminator(s: &str) -> bool {
    matches!(s.trim(), "" | ";")
}

```

### Core Architecture Module: `src-tauri/src/theme_packages/lifecycle.rs`
```
use super::{
    catalog, files, validate_manifest_json, validate_theme_archive, ThemeCommit, ThemeContribution,
    ValidatedThemePackage,
};
use fs2::FileExt;
use serde::Serialize;
use serde_json::json;
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};

pub const ARCHIVE_BYTES: usize = 8 * 1024 * 1024;

pub fn local_registry_key() -> String {
    format!("{:x}", Sha256::digest(b"tabularis:local-theme-packages:v1"))
}

pub fn read_local_archive(path: &Path) -> Result<Vec<u8>, String> {
    files::check_path(path)?;
    let metadata = fs::symlink_metadata(path).map_err(|e| e.to_string())?;
    if !metadata.is_file() || metadata.len() > ARCHIVE_BYTES as u64 {
        return Err("Local theme archive exceeds its byte limit or is not a regular file".into());
    }
    let mut bytes = Vec::new();
    File::open(path)
        .map_err(|e| e.to_string())?
        .take(ARCHIVE_BYTES as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() > ARCHIVE_BYTES {
        return Err("Local theme archive exceeds its byte limit".into());
    }
    Ok(bytes)
}

/// Local identity discovery still preflights the ZIP BEFORE library indexing.
pub fn validate_local_archive(
    bytes: &[u8],
    host: &str,
    cancelled: &impl Fn() -> Result<(), String>,
) -> Result<ValidatedThemePackage, String> {
    cancelled()?;
    if bytes.len() > ARCHIVE_BYTES {
        return Err("Theme archive exceeds its byte limit".into());
    }
    super::zip_layout::preflight_zip(bytes, 128)?;
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|e| e.to_string())?;
    let manifest = archive.by_name(".tabularium").map_err(|e| e.to_string())?;
    if manifest.size() > 64 * 1024 {
        return Err("Theme manifest exceeds its byte limit".into());
    }
    let mut source = Vec::new();
    manifest
        .take(64 * 1024 + 1)
        .read_to_end(&mut source)
        .map_err(|e| e.to_string())?;
    let value = validate_manifest_json(&source)?;
    validate_theme_archive(
        bytes,
        super::package_id(&value)?,
        catalog::label(&value, "version")?,
        host,
        cancelled,
    )
}

#[derive(Serialize)]
pub struct LocalThemePreview {
    pub digest: String,
    pub manifest: serde_json::Value,
    pub variants: Vec<ThemeContribution>,
}

pub fn local_preview(bytes: &[u8], host: &str) -> Result<LocalThemePreview, String> {
    let package = validate_local_archive(bytes, host, &|| Ok(()))?;
    let key = local_registry_key();
    let name = super::package_id(&package.manifest)?;
    let version = catalog::label(&package.manifest, "version")?;
    let mut variants = Vec::new();
    for variant in package.manifest["theme_variants"]
        .as_array()
        .ok_or("Missing theme variants")?
    {
        let id = catalog::label(variant, "id")?;
        let source = String::from_utf8(package.files[catalog::label(variant, "file")?].clone())
            .map_err(|e| e.to_string())?;
        variants.push(ThemeContribution {
            id: format!("theme:{key}:{name}:{id}"), name: catalog::label(variant, "name")?.into(),
            revision: catalog::revision(&source), origin: json!({"kind":"installed","identity":{"registryKey":key,"packageName":name,"variantId":id},"packageVersion":version}),
            read_only:true, mode:catalog::label(&package.definitions[catalog::label(variant, "file")?], "mode")?.into(), format:"v1".into(), source,
            available:true, editor:None,
        });
    }
    Ok(LocalThemePreview {
        digest: format!("{:x}", Sha256::digest(bytes)),
        manifest: package.manifest,
        variants,
    })
}

pub(super) fn validate_package_name(package: &str) -> Result<(), String> {
    if !super::is_package_slug(package) {
        return Err("Invalid theme package name".into());
    }
    Ok(())
}

fn package_location(
    root: &Path,
    registry: &str,
    package: &str,
) -> Result<(PathBuf, PathBuf), String> {
    validate_package_name(package)?;
    if registry.len() != 64
        || !registry
            .bytes()
            .all(|c| c.is_ascii_digit() || matches!(c, b'a'..=b'f'))
    {
        return Err("Invalid installed theme identity".into());
    }
    let location = super::locations::resolve_package(root, package)?;
    if super::locations::package_registry(&location)? != registry {
        return Err("Installed theme identity changed; refresh the catalog".into());
    }
    let namespace = location.parent().ok_or("Missing theme parent")?.to_path_buf();
    files::check_path(&location)?;
    if !fs::symlink_metadata(&location)
        .map_err(|e| e.to_string())?
        .is_dir()
    {
        return Err("Installed theme package is not a directory".into());
    }
    Ok((namespace, location))
}

fn lock_namespace(namespace: &Path) -> Result<File, String> {
    let path = namespace.join(".lock");
    files::check_path(&path)?;
    match fs::symlink_metadata(&path) {
        Ok(meta) if !meta.is_file() => return Err("Invalid theme storage lock".into()),
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => return Err(e.to_string()),
        _ => (),
    }
    let file = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(path)
        .map_err(|e| e.to_string())?;
    FileExt::try_lock_exclusive(&file)
        .map_err(|_| "Another theme operation is in progress".to_string())?;
    Ok(file)
}

pub fn set_package_enabled(
    root: &Path,
    registry: &str,
    package: &str,
    enabled: bool,
) -> Result<(), String> {
    let storage = root.join(catalog::PACKAGES_DIR).join(super::locations::directory_name());
    // Serialize flat-bundle mutations with installs into the canonical folder.
    package_location(root, registry, package)?;
    files::create_directory(&storage)?;
    let _lock = lock_namespace(&storage)?;
    let (namespace, _) = package_location(root, registry, package)?;
    let marker = namespace.join(format!(".disabled-{package}"));
    files::check_path(&marker)?;
    if enabled {
        match fs::remove_file(marker) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    } else {
        files::atomic_write(&marker, b"1", true)
    }
}

pub fn remove_package(root: &Path, registry: &str, package: &str) -> Result<ThemeCommit, String> {
    let storage = root.join(catalog::PACKAGES_DIR).join(super::locations::directory_name());
    package_location(root, registry, package)?;
    files::create_directory(&storage)?;
    let _lock = lock_namespace(&storage)?;
    let (namespace, location) = package_location(root, registry, package)?;
    let fallback = root.join(catalog::PACKAGES_DIR).join(package);
    if !crate::plugins::layout::is_kind_directory(package) && fallback != location
        && super::locations::is_theme_package(&fallback).unwrap_or(false) {
        fs::remove_dir_all(&fallback).map_err(|e| e.to_string())?;
    }
    let removed = namespace.join(format!(".removed-{}", uuid::Uuid::new_v4()));
    fs::rename(location, &removed).map_err(|e| e.to_string())?;
    let mut warnings = Vec::new();
    if let Err(error) = fs::remove_dir_all(&removed) {
        warnings.push(format!("Theme removed; deferred cleanup: {error}"));
    }
    // Keep the stable namespace lock and disable marker. Reinstall restores the
    // user's enabled/disabled state; deleting a lock inode could split waiters.
    Ok(ThemeCommit { warnings })
}

```

### Core Architecture Module: `src/components/modals/connection/EngineCard.tsx`
```
import clsx from "clsx";
import { Database, Download, MonitorOff, ShieldCheck } from "lucide-react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import type { PluginManifest } from "../../../types/plugins";
import type { CatalogueDriver, EngineGroup } from "../../../utils/connectionCatalogue";
import { labelForParadigm } from "../../../utils/connectionCatalogue";
import { getDriverIcon, isUrlIcon } from "../../../utils/driverUI";
import { RegistryDriverIcon } from "../../RegistryDriverIcon";

interface EngineCardProps {
  group: EngineGroup;
  onSelect: (group: EngineGroup) => void;
}

/** Pleasant accent per data-model family, used when a driver declares no color. */
const PARADIGM_ACCENT: Record<string, string> = {
  sql: "#3b82f6",
  nosql: "#10b981",
  document: "#10b981",
  "key-value": "#14b8a6",
  vector: "#a855f7",
  graph: "#f59e0b",
  timeseries: "#ec4899",
  relational: "#3b82f6",
  other: "#64748b",
};

function accentFor(group: EngineGroup, rep: CatalogueDriver): string {
  return rep.color || PARADIGM_ACCENT[group.primaryParadigm] || "#64748b";
}

function renderIcon(rep: CatalogueDriver) {
  const icon = rep.icon ?? "";
  if (isUrlIcon(icon)) {
    return <RegistryDriverIcon src={icon} size={24} fallback={<Database size={20} />} />;
  }
  if (rep.isBuiltin) {
    return getDriverIcon({ icon, color: rep.color ?? undefined } as PluginManifest, 22);
  }
  return <Database size={20} />;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function EngineCard({ group, onSelect }: EngineCardProps) {
  const { t } = useTranslation();
  const rep = group.drivers.find((d) => d.isBuiltin) ?? group.drivers[0];
  const accent = accentFor(group, rep);
  const driverCount = group.drivers.length;
  const unsupported = !group.platformSupported;

  return (
    <button
      type="button"
      aria-label={t("connectionCatalogue.connectTo", {
        name: group.displayName,
        defaultValue: "Connect to {{name}}",
      })}
      onClick={() => onSelect(group)}
      style={{ "--accent": accent } as CSSProperties}
      className={clsx(
        "group relative flex cursor-pointer flex-col gap-2 overflow-hidden rounded-xl border p-3 text-left",
        "border-default bg-surface-secondary transition-all duration-150",
        "hover:-translate-y-px hover:border-[var(--accent)] hover:bg-surface hover:shadow-md hover:shadow-black/5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
      )}
    >
      {/* accent rail */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-0.5 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ backgroundColor: accent }}
      />

      {/* header row: icon · name · status */}
      <span className="flex w-full items-center gap-2.5">
        {/* icon tile — dimmed instead of the whole card so the text stays readable */}
        <span
          className={clsx(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            unsupported && "opacity-50 grayscale",
          )}
          style={{ backgroundColor: `${accent}1f`, color: accent }}
        >
          {renderIcon(rep)}
        </span>

        {/* name wraps (up to 2 lines) instead of truncating; icon stays glued to the last word */}
        <span
          className="line-clamp-2 min-w-0 flex-1 font-semibold leading-snug text-primary [overflow-wrap:anywhere]"
          title={group.displayName}
        >
          {group.displayName}
          {group.verified && (
            <span
              className="ml-1.5 inline-flex translate-y-px items-center align-baseline text-accent"
              title={t("connectionCatalogue.verified", { defaultValue: "Verified" })}
            >
              <ShieldCheck size={13} aria-hidden />
              <span className="sr-only">{t("connectionCatalogue.verified", { defaultValue: "Verified" })}</span>
            </span>
          )}
          {rep.deprecated && (
            <span
              className="ml-1.5 inline-flex items-center align-baseline text-[10px] font-semibold text-accent-warning"
              title={t("connectionCatalogue.deprecatedTooltip", { defaultValue: "This built-in driver is being replaced by a plugin" })}
            >
              {t("connectionCatalogue.deprecated", { defaultValue: "Deprecated" })}
            </span>
          )}
        </span>

        {/* trailing status */}
        {group.installed ? (
          <span className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-accent-success/15 px-2 py-0.5 text-[10px] font-semibold text-accent-success">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-success" />
            {t("connectionCatalogue.installed", { defaultValue: "Installed" })}
          </span>
        ) : unsupported ? (
          <span
            className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-accent-warning/30 px-2 py-0.5 text-[10px] font-medium text-accent-warning"
            title={t("connectionCatalogue.unavailableOnPlatform", { defaultValue: "Unavailable on your platform" })}
          >
            <MonitorOff size={10} aria-hidden />
            {t("connectionCatalogue.unavailable", { defaultValue: "Unavailable" })}
          </span>
        ) : (
          <span className="shrink-0 whitespace-nowrap rounded-full border border-default px-2 py-0.5 text-[10px] font-medium text-muted transition-colors group-hover:border-[var(--accent)] group-hover:text-primary">
            {t("connectionCatalogue.install", { defaultValue: "Install" })}
          </span>
        )}
      </span>

      {/* meta row, full card width: paradigm (+n) · drivers · downloads */}
      <span className="block w-full truncate text-[11px] text-muted">
        {labelForParadigm(group.primaryParadigm)}
        {group.secondaryParadigms.length > 0 && (
          <span className="text-muted/70"> +{group.secondaryParadigms.length}</span>
        )}
        {driverCount > 1 && (
          <span className="text-muted/70">
            {" · "}
            {t("connectionCatalogue.driverCount", { count: driverCount, defaultValue: "{{count}} drivers" })}
          </span>
        )}
        {group.downloads != null && (
          <span className="text-muted/70">
            {" · "}
            <Download size={10} className="inline -translate-y-px" aria-hidden />
            {formatCount(group.downloads)}
          </span>
        )}
      </span>
    </button>
  );
}

```

### Core Architecture Module: `src/components/ui/LoadingState.tsx`
```
import { Loader2 } from "lucide-react";

export const LoadingState = () => (
  <div className="flex h-full min-h-24 w-full items-center justify-center bg-base text-muted" aria-busy="true">
    <Loader2 size={24} className="animate-spin" />
  </div>
);

```

### Core Architecture Module: `src/hooks/useAiActivity.ts`
```
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  AiActivityEvent,
  AiEventFilter,
  AiNotebookExport,
  AiSessionSummary,
  ApprovalDecisionPayload,
  PendingApproval,
} from "../types/ai";

const PENDING_APPROVAL_EVENT = "ai://pending_approval";

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface UseAiActivityEventsResult {
  events: AiActivityEvent[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAiActivityEvents(
  filter: AiEventFilter = {},
): UseAiActivityEventsResult {
  const [events, setEvents] = useState<AiActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stabilise the filter reference so `useCallback` below does not re-bind on
  // every render (callers can pass an inline object literal safely).
  const filterKey = JSON.stringify(filter);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- filterKey captures filter content
  const stableFilter = useMemo(() => filter, [filterKey]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoke<AiActivityEvent[]>("get_ai_activity", {
        filter: stableFilter,
      });
      setEvents(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [stableFilter]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { events, loading, error, refetch };
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export interface UseAiSessionsResult {
  sessions: AiSessionSummary[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAiSessions(): UseAiSessionsResult {
  const [sessions, setSessions] = useState<AiSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoke<AiSessionSummary[]>("get_ai_sessions");
      setSessions(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { sessions, loading, error, refetch };
}

// ---------------------------------------------------------------------------
// Single session events
// ---------------------------------------------------------------------------

export interface UseAiSessionEventsResult {
  events: AiActivityEvent[];
  loading: boolean;
  error: string | null;
}

export function useAiSessionEvents(
  sessionId: string | null,
): UseAiSessionEventsResult {
  const [events, setEvents] = useState<AiActivityEvent[]>([]);
  const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(
    async (id: string, isCancelled: () => boolean) => {
      setLoading(true);
      setError(null);
      try {
        const data = await invoke<AiActivityEvent[]>("get_ai_session_events", {
          sessionId: id,
        });
        if (!isCancelled()) {
          setEvents(data);
          setLoadedSessionId(id);
        }
      } catch (err) {
        if (!isCancelled()) setError(String(err));
      } finally {
        if (!isCancelled()) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    fetchSession(sessionId, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [sessionId, fetchSession]);

  // Derive an empty list when no session is selected (or while a new session
  // is loading) instead of clearing state inside the effect body.
  const visibleEvents =
    sessionId !== null && sessionId === loadedSessionId ? events : [];

  return { events: visibleEvents, loading, error };
}

// ---------------------------------------------------------------------------
// Pending approvals
// ---------------------------------------------------------------------------

export interface UsePendingApprovalsResult {
  pending: PendingApproval[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  decide: (payload: ApprovalDecisionPayload) => Promise<void>;
}

export function usePendingApprovals(): UsePendingApprovalsResult {
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refetchRef = useRef<() => Promise<void>>(async () => {});

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoke<PendingApproval[]>("list_pending_approvals");
      setPending(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);
  refetchRef.current = refetch;

  useEffect(() => {
    refetch();
    const unlisten = listen<PendingApproval>(PENDING_APPROVAL_EVENT, () => {
      refetchRef.current();
    });
    return () => {
      unlisten.then((fn) => fn()).catch(() => {});
    };
  }, [refetch]);

  const decide = useCallback(
    async ({
      approvalId,
      decision,
      reason,
      editedQuery,
    }: ApprovalDecisionPayload) => {
      await invoke("decide_pending_approval", {
        approvalId,
        decision,
        reason,
        editedQuery,
      });
      // Optimistically drop the approval from the list — the file watcher
      // will reconcile if anything else changes.
      setPending((prev) => prev.filter((p) => p.id !== approvalId));
    },
    [],
  );

  return { pending, loading, error, refetch, decide };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function clearAiActivity(): Promise<void> {
  await invoke("clear_ai_activity");
}

export async function exportAiActivityJson(): Promise<string> {
  return invoke<string>("export_ai_activity_json");
}

export async function exportAiActivityCsv(): Promise<string> {
  return invoke<string>("export_ai_activity_csv");
}

export async function exportSessionAsNotebook(
  sessionId: string,
): Promise<AiNotebookExport> {
  return invoke<AiNotebookExport>("export_ai_session_as_notebook", {
    sessionId,
  });
}

```

### Core Architecture Module: `src/hooks/useAlert.ts`
```
import { useContext } from "react";
import { AlertContext } from "../contexts/AlertContext";

export const useAlert = () => useContext(AlertContext);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #845** (2026-10-03): **[Bug]: Brew: `depends_on macos:` and `postflight` are deprecated**
  *Symptoms*: ### Describe the bug  When I upgrade brew :  "Warning: Calling string comparison format for `depends_on macos:` is deprecated! Use `depends_on macos: :monterey` instead." And : "Warning: Calling `postflight` is deprecated! Use `postflight_steps` instead."  ### To Reproduce  brew upgrade  ### OS Version  macOS 26.7  ### Tabularis Version  v0.25.0  ### Relevant Log Output  ```shell  ```

- **Issue #832** (2026-10-03): **[Bug]: Plugin calls time out after a hardcoded 120s, and the query keeps running on the server**
  *Symptoms*: ### Describe the bug  With the PostgreSQL driver plugin, any query that runs longer than 120 seconds fails with:  ``` Plugin call 'execute_query' timed out after 120s ```  Two problems:  1. **The timeout isn't configurable.** It appears to be hardcoded in the host's plugin call path. No setting in `config.json` affects it, and it can't be set from the connection string, because it isn't a Postgres or libpq parameter. Setting it through the connection string doesn't work either: pasting `postgresql://user:pass@host:5432/db?options=-c%20statement_timeout%3D115s` into the connection form keeps the host, port, user and database but drops `options`, so `SHOW statement_timeout` still returns `0`. There is no field for connection options; the startup script (below) is the only way to set it. Long-running maintenance statements (batched `DELETE`s, `VACUUM`, index builds) can't be run from Tabularis at all. 2. **The timeout doesn't cancel the query on the server.** After Tabularis reports the failure, the statement keeps running in Postgres, so a `DELETE` or `UPDATE` still takes effect. From the UI it looks like the query failed, so the natural reaction is to run it again, which starts a second copy alongside the first. On production data that is easy to get wrong.  Expected:  - A configurable plugin call / query timeout (or none for `execute_query`, leaving it to the user to cancel). - When a call does time out, cancel the statement on the server (for Postgres, `pg_cancel_backend` on
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed writeup, @gergelylendvai — both the repro and the `pg_stat_activity` follow-up make the orphan-query failure mode easy to confirm. I dug into where each half actually lives, since they're not both in this plugin's reach.  ## Findings  The 120s timeout and the missing server-side cancel both live in the **host** (`tabularis`), not in this plugin:  - **The 120s ceiling is hardcoded and not configurable.** `tabularis/src-tauri/src/plugins/driver.rs:29` — `const PLUGIN_CALL_TIMEOUT: Duration = Duration::from_secs(120);`, applied to every plugin call including `execute_query` at `driver.rs:208-211`. No setting feeds it, no per-method override exists. - **On timeout the host drops its own pending slot but does not cancel the server query.** `driver.rs:282-292` sends a `PluginCommand::Cancel(id)` — that frees the oneshot slot in the management task; it sends nothing to the database and nothing to the plugin. The plugin's `pg_client.query()` future keeps running server-
  > @aesslinger  We could consider:  * A configurable value on the host side, which would serve as the default. * The ability to override that value for each plugin.  Before proceeding, I’d like to run a few internal checks to see whether we could remove the option altogether.
  > @aesslinger I moved this issue here since, as you found, the core of it lives in the host.  I opened #833 for the timeout part:  - a global setting (Settings > Plugins > Plugin runtime), default 120s, `0` disables the limit - a per-plugin override in each plugin's settings page (blank inherits the global value), stored in the host config so no plugin needs to change - the value is resolved on every call, so changes apply without restarting the plugin, also in the MCP subprocess  With this, long maintenance statements can run by raising the limit or setting it to 0 for the PostgreSQL plugin only.  Still open: on timeout the statement keeps running server side. I'd handle that separately, either with the `CancelToken` approach you described on the plugin side or with a cancel notification from the host to the plugin. Same for the `options` passthrough in the connection string. Let me know which direction you prefer for the cancel. 

- **Issue #826** (2026-09-29): **[Bug]: New row color contrast is not WCAG-ready and made text unreadable**
  *Symptoms*: ### Describe the bug  <img width="1451" height="305" alt="Image" src="https://github.com/user-attachments/assets/a492633f-f5c5-4817-9d7a-b3c9e431736b" />  ### To Reproduce  1. Open any table 2. Click on the + icon 3. Fill the values   you can't see them  Another UX Issue: The "too ugly" field is the Date fields, there's no way to accept the current values (that auto appear) without changing values.  ### OS Version  Windows 11  ### Tabularis Version  v0.25.0  ### Relevant Log Output  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report! The fix is in #828.  **Unreadable values in new rows.** Values you type into a new row were drawn in the same green as the row background. They now use the normal text color, and the green tint plus the `NEW` marker still show the row state. The same change applies to modified cells in existing rows, which had the same problem with blue.  Before, on all built-in themes:  ![New row and modified cell before the fix](https://github.com/user-attachments/assets/8e71b049-9e0b-46f0-a612-113d252c2511)  After:  ![New row and modified cell after the fix](https://github.com/user-attachments/assets/247f1c22-e56e-4be4-a4fe-0b0004390f45)  **Empty date fields.** The editor showed today's date but there was no way to keep it without changing a field. Now, when the value is empty, you can press Enter or click "Use this value" to accept the date on screen. Leaving the cell without doing either still keeps it `NULL`.  ![Empty date cell editor on all built-in themes](https://github.

- **Issue #824** (2026-09-27): **[Bug]: Theme plugins appear as database engines in New Connection**
  *Symptoms*: ### Describe the bug  Since theme plugins were added to the registry, the New Connection catalogue lists them next to the database engines. A theme shows up as an engine you can pick (under "Other", since it has no paradigms), and choosing it opens the install/connect flow as if it were a driver.  The catalogue should only offer plugins with `kind: driver`. Registry entries without a `kind` should keep counting as drivers, as they do in the Plugin Center.  ### To Reproduce  1. Make sure the registry you use has at least one theme plugin 2. Open New Connection 3. Scroll the engine list: the theme is listed as a database engine  ### OS Version  macOS 26  ### Tabularis Version  v0.25.0  ### Relevant Log Output  _No response_ 

- **Issue #823** (2026-09-29): **[Bug]: Tabs are not remembering their scroll position**
  *Symptoms*: ### Describe the bug  In two tabs, if focus out, the tab's vertical scrolling is getting lost.  BTW, the horizontal scroll position is remembered and that's working fine. 💖  ### To Reproduce  1. Open two tables in two tabs 2. In one of them, scroll down a bit (vertically) 3. Now switch to another tab 4. Get back to previous [scrolled] tab  Your vertical scrolling is lost.  ### OS Version  Windows 11  ### Tabularis Version  v0.25.0  ### Relevant Log Output  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > Hi!  Would you be interested in create a PR for this issue?

- **Issue #743** (2026-09-16): **[Bug]: Query Name not visible in editor for Save query in light theme**
  *Symptoms*: ### Describe the bug  Query Name not visible in editor for Save query in light theme because font is white.  <!-- Failed to upload "Screenshot 2026-09-11 at 4.20.37 PM.png" --> <!-- Failed to upload "Screenshot 2026-09-11 at 4.20.45 PM.png" -->  ### To Reproduce  1. Keep Tabularis Light theme 2. Go to any MYSQL SQL editor 3. Type a query  4. Add to Saved Queries 5. You can see Name is not visible because its in white font. 6. Post saving its visible in saved list , as there it is black.  ### OS Version  macOS 26.41.  ### Tabularis Version  v0.23.0  ### Relevant Log Output  ```shell  ```

- **Issue #739** (2026-09-21): **[Bug]: Won't accept MongoDB replica set connection strings**
  *Symptoms*: ### Describe the bug  Either the UI or something in the backend will not accept a MongoDB replica set connection string. For example:  `mongodb://USER:PASSWORD@server1.com:27017,server2.com:27017,server3.com:27017/mydatabase?replicaSet=rs0&authSource=admin`  The problem is the commas in the connection string.  This is a perfectly valid connection string for MongoDB and is supported by other MongoDB tools and drivers.  Even crazier is that the same connection string will test successfully!  ### To Reproduce  1. Have a MongoDB replica set. 2. Create a new MongoDB connection. 3. Use the valid replica set connection string that includes commas. 4. Receive error "invalid connection string format."  ### OS Version  macOS 26.6.2  ### Tabularis Version  0.22.0
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. The issue was in Tabularis' connection-string parser rather than in the MongoDB plugin: the WHATWG URL parser rejects comma-separated hosts before the URI reaches the plugin.  I opened #740 with a regression test and a fix that preserves the complete replica-set URI for the MongoDB driver. I also added the `preview` label to the PR so preview artifacts can be generated for testing.

- **Issue #724** (2026-09-09): **[Bug & UX defects]: quick search result need better sort, and should support specify and switch objects and scopes**
  *Symptoms*: ### Describe the bug  When I press cmd + P to enter quick search and I try type "user" want to enter the user table, and it show irrelevant result, I think it's a bug.  <img width="763" height="707" alt="Image" src="https://github.com/user-attachments/assets/86bdef46-f928-4d9d-b999-a31ec6303ca3" />  And, I think it's better can type "t/" or "t tab" or other similar way to allow specify and switch objects and scopes to "tables", other object for example funtion can use "f", sql file can use "s".  ### To Reproduce  As described above。  ### OS Version  26.6.2  ### Tabularis Version  0.21.0  ### Relevant Log Output  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > Hi @JasonLamv-t have you been tried with latest release and nightly ? We fixed some bugs and made improvements in Quick Navigator.
  > @debba I think the bug in the latest nightly is fixed.

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

### Incident Patch 1: `524af98a` (2026-10-01)
**Commit Message**: Merge pull request #833 from TabularisDB/feat/configurable-plugin-call-timeout

feat(plugins): configurable plugin call timeout with per-plugin override

**File**: `src-tauri/src/config.rs` (modified, +62/-6)
```diff
@@ -15,6 +15,10 @@ pub struct PluginConfig {
     pub interpreter: Option<String>,
     #[serde(default)]
     pub settings: HashMap<String, serde_json::Value>,
+    /// Per-plugin override of `AppConfig::plugin_call_timeout_seconds`.
+    /// `None` inherits the global value; `0` disables the timeout.
+    #[serde(default, skip_serializing_if = "Option::is_none")]
+    pub call_timeout_seconds: Option<u32>,
 }
 
 #[derive(Serialize, Deserialize, Debug, Clone, Copy, Default, PartialEq, Eq)]
@@ -84,6 +88,9 @@ pub struct AppConfig {
     /// Update channel: "stable" (default) or "nightly". None ⇒ stable.
     pub release_channel: Option<String>,
     pub plugins: Option<HashMap<String, PluginConfig>>,
+    /// Maximum seconds the host waits for a plugin to answer a single call.
+    /// `0` disables the timeout. Default: 120. Overridable per plugin.
+    pub plugin_call_timeout_seconds: Option<u32>,
     pub editor_theme: Option<String>,
     /// Font for query result cells ("inherit" follows the interface font). Default: JetBrains Mono.
     pub result_font_family: Option<String>,
@@ -261,6 +268,7 @@ pub fn get_config_dir<R: tauri::Runtime>(_app: &AppHandle<R>) -> Option<PathBuf>
 }
 
 fn cache_config(config: &AppConfig) {
+    crate::plugins::call_timeout::apply_config(config);
     if let Ok(mut cached) = CONFIG_CACHE.write() {
         *cached = config.clone();
     }
@@ -292,13 +300,29 @@ pub const DEFAULT_MCP_APPROVAL_NOTIFY_SOUND: bool = true;
 /// unreadable.
 pub fn load_config_from_disk() -> AppConfig {
     let path = crate::paths::get_app_config_dir().join("config.json");
-    if !path.exists() {
-        return AppConfig::default();
+    let (config, trusted) = parse_config_file(fs::read_to_string(&path));
+    // The MCP subprocess never goes through `cache_config`; keep its plugin
+    // call timeouts in sync with what is on disk. A transient read or parse
+    // failure must not reset them to the defaults, so the last-known-good
+    // snapshot is kept in that case.
+    if trusted {
+        crate::plugins::call_timeout::apply_config(&config);
+    }
+    config
+}
+
+/// Turns the result of reading `config.json` into a config plus whether it
+/// reflects what the user actually configured. A missing file is trusted
+/// (the defaults are the real config), a read or parse error is not.
+fn parse_config_file(read: std::io::Result<String>) -> (AppConfig, bool) {
+    match read {
+        Ok(content) => match serde_json::from_str::<AppConfig>(&content) {
+            Ok(config) => (config, true),
+            Err(_) => (AppConfig::default(), false),
+        },
+        Err(e) if e.kind() == std::io::ErrorKind::NotFound => (AppConfig::default(), true),
+        Err(_) => (AppConfig::default(), false),
     }
-    fs::read_to_string(&path)
-        .ok()
-        .and_then(|s| serde_json::from_str::<AppConfig>(&s).ok())
-        .unwrap_or_default()
 }
 
 /// True when `connection_id` should be treated as read-only by MCP, taking
@@ -453,6 +477,9 @@ pub fn save_config(app: AppHandle, config: AppConfig) -> Result<(), String> {
         if config.plugins.is_some() {
             existing_config.plugins = config.plugins;
         }
+        if config.plugin_call_timeout_seconds.is_some() {
+            existing_config.plugin_call_timeout_seconds = config.plugin_call_timeout_seconds;
+        }
         if config.editor_theme.is_some() {
             existing_config.editor_theme = config.editor_theme;
         }
@@ -1302,4 +1329,33 @@ mod tests {
         // path is exercised indirectly via parse failures + missing file).
         let _ = load_config_from_disk();
     }
+
+    #[test]
+    fn parse_config_file_trusts_valid_content() {
+        let (config, trusted) =
+            parse_config_file(Ok(r#"{"pluginCallTimeoutSeconds":0}"#.to_string()));
+        assert!(trusted);
+        assert_eq!(config.plugin_call_timeout_seconds, Some(0));
+    }
+
+    #[test]
+    fn parse_config_file_trusts_missing_file() {
+        let missing = std::io::Error::from(std::io::ErrorKind::NotFound);
+        let (config, trusted) = parse_config_file(Err(missing));
+        assert!(trusted);
+        assert_eq!(config.plugin_call_timeout_seconds, None);
+    }
+
+    #[test]
+    fn parse_config_file_distrusts_read_errors() {
+        let denied = std::io::Error::from(std::io::ErrorKind::PermissionDenied);
+        let (_, trusted) = parse_config_file(Err(denied));
+        assert!(!trusted);
+    }
+
+    #[test]
+    fn parse_config_file_distrusts_malformed_content() {
+        let (_, trusted) = parse_config_file(Ok("{ truncated".to_string()));
+        assert!(!trusted);
+    }
 }
```

**File**: `src-tauri/src/plugins/call_timeout.rs` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+//! Resolution of the per-call JSON-RPC timeout applied to plugin drivers.
+//!
+//! The effective timeout for a plugin is, in order of precedence:
+//! 1. the plugin's own override (`plugins.<id>.callTimeoutSeconds`),
+//! 2. the global host setting (`pluginCallTimeoutSeconds`),
+//! 3. [`DEFAULT_PLUGIN_CALL_TIMEOUT_SECS`].
+//!
+//! A value of `0` disables the timeout entirely, so long-running statements
+//! (maintenance jobs, index builds, …) are never cut off by the host.
+//!
+//! The resolved values are kept in a small process-wide snapshot refreshed
+//! whenever the config is loaded or saved, so a change applies to the next
+//! plugin call without restarting the plugin process — in both the GUI and
+//! the standalone MCP subprocess (which re-reads the config from disk).
+
+use std::collections::HashMap;
+use std::sync::RwLock;
+use std::time::Duration;
+
+use once_cell::sync::Lazy;
+
+use crate::config::AppConfig;
+
+/// Default time to wait for a plugin to answer a single JSON-RPC call.
+/// Generous enough for slow query execution, bounded so a wedged plugin
+/// cannot block the (single-threaded) MCP request loop forever.
+pub const DEFAULT_PLUGIN_CALL_TIMEOUT_SECS: u32 = 120;
+
+#[derive(Debug, Clone, Default, PartialEq, Eq)]
+pub(crate) struct CallTimeoutSettings {
+    global: Option<u32>,
+    per_plugin: HashMap<String, u32>,
+}
+
+impl CallTimeoutSettings {
+    pub(crate) fn from_config(config: &AppConfig) -> Self {
+        let per_plugin = config
+            .plugins
+            .as_ref()
+            .map(|plugins| {
+                plugins
+                    .iter()
+                    .filter_map(|(id, cfg)| cfg.call_timeout_seconds.map(|s| (id.clone(), s)))
+                    .collect()
+            })
+            .unwrap_or_default();
+        Self {
+            global: config.plugin_call_timeout_seconds,
+            per_plugin,
+        }
+    }
+
+    /// Effective timeout for `plugin_id`; `None` means "wait indefinitely".
+    pub(crate) fn resolve(&self, plugin_id: &str) -> Option<Duration> {
+        let seconds = self
+            .per_plugin
+            .get(plugin_id)
+            .copied()
+            .or(self.global)
+            .unwrap_or(DEFAULT_PLUGIN_CALL_TIMEOUT_SECS);
+        (seconds > 0).then(|| Duration::from_secs(u64::from(seconds)))
+    }
+}
+
+static CURRENT: Lazy<RwLock<CallTimeoutSettings>> =
+    Lazy::new(|| RwLock::new(CallTimeoutSettings::default()));
+
+/// Refreshes the snapshot from a freshly loaded or saved config.
+pub fn apply_config(config: &AppConfig) {
+    let next = CallTimeoutSettings::from_config(config);
+    if let Ok(mut current) = CURRENT.write() {
+        *current = next;
+    }
+}
+
+/// Effective call timeout for `plugin_id` under the current config.
+pub fn for_plugin(plugin_id: &str) -> Option<Duration> {
+    CURRENT
+        .read()
+        .map(|current| current.resolve(plugin_id))
+        .unwrap_or_else(|_| {
+            Some(Duration::from_secs(u64::from(
+                DEFAULT_PLUGIN_CALL_TIMEOUT_SECS,
+            )))
+        })
+}
+
+#[cfg(test)]
+#[path = "call_timeout_tests.rs"]
+mod tests;
```

**File**: `src-tauri/src/plugins/call_timeout_tests.rs` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+use super::*;
+use crate::config::PluginConfig;
+
+fn config_with(global: Option<u32>, overrides: &[(&str, Option<u32>)]) -> AppConfig {
+    let plugins = overrides
+        .iter()
+        .map(|(id, seconds)| {
+            (
+                id.to_string(),
+                PluginConfig {
+                    call_timeout_seconds: *seconds,
+                    ..PluginConfig::default()
+                },
+            )
+        })
+        .collect();
+    AppConfig {
+        plugin_call_timeout_seconds: global,
+        plugins: Some(plugins),
+        ..AppConfig::default()
+    }
+}
+
+#[test]
+fn falls_back_to_default_when_nothing_is_configured() {
+    let settings = CallTimeoutSettings::from_config(&AppConfig::default());
+    assert_eq!(
+        settings.resolve("postgresql"),
+        Some(Duration::from_secs(u64::from(
+            DEFAULT_PLUGIN_CALL_TIMEOUT_SECS
+        )))
+    );
+}
+
+#[test]
+fn global_setting_applies_to_every_plugin() {
+    let settings = CallTimeoutSettings::from_config(&config_with(Some(600), &[]));
+    assert_eq!(
+        settings.resolve("postgresql"),
+        Some(Duration::from_secs(600))
+    );
+    assert_eq!(settings.resolve("duckdb"), Some(Duration::from_secs(600)));
+}
+
+#[test]
+fn plugin_override_wins_over_global() {
+    let settings = CallTimeoutSettings::from_config(&config_with(
+        Some(600),
+        &[("postgresql", Some(30)), ("duckdb", None)],
+    ));
+    assert_eq!(
+        settings.resolve("postgresql"),
+        Some(Duration::from_secs(30))
+    );
+    // A plugin entry without an override inherits the global value.
+    assert_eq!(settings.resolve("duckdb"), Some(Duration::from_secs(600)));
+}
+
+#[test]
+fn zero_disables_the_timeout() {
+    let settings = CallTimeoutSettings::from_config(&config_with(Some(0), &[]));
+    assert_eq!(settings.resolve("postgresql"), None);
+
+    let settings =
+        CallTimeoutSettings::from_config(&config_with(Some(60), &[("postgresql", Some(0))]));
+    assert_eq!(settings.resolve("postgresql"), None);
+    assert_eq!(settings.resolve("duckdb"), Some(Duration::from_secs(60)));
+}
+
+#[test]
+fn plugin_override_can_restore_a_limit_when_global_is_disabled() {
+    let settings =
+        CallTimeoutSettings::from_config(&config_with(Some(0), &[("postgresql", Some(45))]));
+    assert_eq!(
+        settings.resolve("postgresql"),
+        Some(Duration::from_secs(45))
+    );
+    assert_eq!(settings.resolve("duckdb"), None);
+}
+
+#[test]
+fn deserializes_camel_case_config_keys() {
+    let config: AppConfig = serde_json::from_value(serde_json::json!({
+        "pluginCallTimeoutSeconds": 300,
+        "plugins": { "postgresql": { "callTimeoutSeconds": 0 } }
+    }))
+    .unwrap();
+    let settings = CallTimeoutSettings::from_config(&config);
+    assert_eq!(settings.resolve("postgresql"), None);
+    assert_eq!(settings.resolve("duckdb"), Some(Duration::from_secs(300)));
+}
```

**File**: `src-tauri/src/plugins/driver.rs` (modified, +31/-32)
```diff
@@ -23,11 +23,6 @@ use crate::plugins::rpc::{JsonRpcRequest, JsonRpcResponse, PluginCallError};
 #[cfg(windows)]
 use std::os::windows::process::CommandExt;
 
-/// Maximum time to wait for a plugin to answer a single JSON-RPC call before
-/// giving up. Generous enough for slow query execution, bounded so a wedged
-/// plugin cannot block the (single-threaded) MCP request loop forever.
-const PLUGIN_CALL_TIMEOUT: Duration = Duration::from_secs(120);
-
 /// The first operation waits for initialization of its own plugin only.
 const PLUGIN_INIT_TIMEOUT: Duration = Duration::from_secs(15);
 
@@ -127,6 +122,8 @@ enum PluginCommand {
 }
 
 pub struct PluginProcess {
+    /// Plugin id used to resolve the configured call timeout.
+    plugin_id: String,
     sender: mpsc::Sender<PluginCommand>,
     next_id: AtomicU64,
     shutdown_tx: tokio::sync::Mutex<Option<oneshot::Sender<()>>>,
@@ -136,7 +133,11 @@ pub struct PluginProcess {
 }
 
 impl PluginProcess {
-    async fn new(executable_path: PathBuf, interpreter: Option<String>) -> Result<Self, String> {
+    async fn new(
+        plugin_id: String,
+        executable_path: PathBuf,
+        interpreter: Option<String>,
+    ) -> Result<Self, String> {
         let (tx, rx) = mpsc::channel::<PluginCommand>(100);
         let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
 
@@ -260,6 +261,7 @@ impl PluginProcess {
         });
 
         Ok(Self {
+            plugin_id,
             sender: tx,
             next_id: AtomicU64::new(1),
             shutdown_tx: tokio::sync::Mutex::new(Some(shutdown_tx)),
@@ -276,32 +278,18 @@ impl PluginProcess {
         }
     }
 
+    /// Sends a JSON-RPC request to the plugin and waits at most the configured
+    /// call timeout (see [`crate::plugins::call_timeout`]) for a response. A
+    /// hung or unresponsive plugin therefore fails this single call instead of
+    /// blocking the caller — and, in the single-threaded MCP request loop,
+    /// every subsequent request — forever, unless the user disabled the limit.
     async fn call(&self, method: &str, params: Value) -> Result<Value, String> {
-        self.call_with_timeout(method, params, PLUGIN_CALL_TIMEOUT)
-            .await
-    }
-
-    /// Sends a JSON-RPC request to the plugin and waits at most `timeout` for a
-    /// response. A hung or unresponsive plugin therefore fails this single call
-    /// instead of blocking the caller — and, in the single-threaded MCP request
-    /// loop, every subsequent request — forever.
-    async fn call_with_timeout(
-        &self,
-        method: &str,
-        params: Value,
-        timeout: Duration,
-    ) -> Result<Value, String> {
-        self.call_detailed(method, params, timeout)
+        self.call_detailed(method, params)
             .await
             .map_err(|e| e.to_string())
     }
 
-    async fn call_detailed(
-        &self,
-        method: &str,
-        params: Value,
-        timeout: Duration,
-    ) -> Result<Value, PluginCallError> {
+    async fn call_detailed(&self, method: &str, params: Value) -> Result<Value, PluginCallError> {
         if let Some(settings) = &self.initialization_settings {
             self.initialized
                 .get_or_init(|| async {
@@ -311,7 +299,7 @@ impl PluginProcess {
                         .send_request(
                             "initialize",
                             json!({ "settings": settings }),
-                            PLUGIN_INIT_TIMEOUT,
+                            Some(PLUGIN_INIT_TIMEOUT),
                         )
                         .await
                     {
@@ -320,14 +308,16 @@ impl PluginProcess {
                 })
                 .await;
         }
+        let timeout = crate::plugins::call_timeout::for_plugin(&self.plugin_id);
         self.send_request(method, params, timeout).await
     }
 
+    /// `timeout: None` waits for the response indefinitely.
     async fn send_request(
         &self,
         method: &str,
         params: Value,
-        timeout: Duration,
+        timeout: Option<Duration>,
     ) -> Result<Value, PluginCallError> {
         let id = self.next_id.fetch_add(1, Ordering::SeqCst);
         let req = JsonRpcRequest {
@@ -343,6 +333,12 @@ impl PluginProcess {
             .await
             .map_err(|_| "Plugin process channel closed".to_string())?;
 
+        let Some(timeout) = timeout else {
+            return rx
+                .await
+                .unwrap_or_else(|_| Err("Plugin process did not respond".to_string().into()));
+        };
+
         match tokio::time::timeout(timeout, rx).await {
             Ok(Ok(result)) => result,
             Ok(Err(_)) => Err("Plugin process did not respond".to_string().into()),
@@ -378,7 +374,8 @@ impl RpcDriver {
         data_types: Vec<DataTypeInfo>,
         settings: HashMap<String, serde_json::Value>,
     ) -> Result<Self, String> {
-        let mut process = PluginProcess::new(executable_path, interpreter).await?;
+  
```

**File**: `src-tauri/src/plugins/mod.rs` (modified, +1/-0)
```diff
@@ -1,3 +1,4 @@
+pub mod call_timeout;
 pub mod commands;
 pub mod compat; // COMPAT(registry-ga): remove with the BC layer
 pub mod connection_metadata;
```

**File**: `src-tauri/src/plugins/startup_tests.rs` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@ use super::*;
 fn process_with_settings() -> (Arc<PluginProcess>, mpsc::Receiver<PluginCommand>) {
     let (sender, receiver) = mpsc::channel(8);
     let process = PluginProcess {
+        plugin_id: "test-plugin".to_string(),
         sender,
         next_id: AtomicU64::new(1),
         shutdown_tx: tokio::sync::Mutex::new(None),
```

**File**: `src/components/settings/PluginCallTimeoutSection.tsx` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+import { useState } from "react";
+import { useTranslation } from "react-i18next";
+import { Timer } from "lucide-react";
+import { useSettings } from "../../hooks/useSettings";
+import { SettingSection, SettingRow } from "./SettingControls";
+import {
+  DEFAULT_PLUGIN_CALL_TIMEOUT_SECONDS,
+  MAX_PLUGIN_CALL_TIMEOUT_SECONDS,
+  parseCallTimeoutSeconds,
+} from "../../utils/pluginConfig";
+
+/** Global default for how long the host waits on a single plugin call. */
+export function PluginCallTimeoutSection() {
+  const { t } = useTranslation();
+  const { settings, updateSetting } = useSettings();
+  const current =
+    settings.pluginCallTimeoutSeconds ?? DEFAULT_PLUGIN_CALL_TIMEOUT_SECONDS;
+  const [draft, setDraft] = useState(String(current));
+
+  const commit = () => {
+    const seconds =
+      parseCallTimeoutSeconds(draft) ?? DEFAULT_PLUGIN_CALL_TIMEOUT_SECONDS;
+    setDraft(String(seconds));
+    if (seconds !== current) {
+      void updateSetting("pluginCallTimeoutSeconds", seconds);
+    }
+  };
+
+  return (
+    <SettingSection
+      title={t("settings.plugins.runtimeTitle")}
+      icon={<Timer size={12} className="text-muted" />}
+    >
+      <SettingRow
+        label={t("settings.plugins.callTimeout")}
+        description={t("settings.plugins.callTimeoutDesc")}
+      >
+        <div className="flex items-center gap-2">
+          <input autoCorrect="off" autoCapitalize="off" autoComplete="off" spellCheck={false}
+            type="number"
+            min={0}
+            max={MAX_PLUGIN_CALL_TIMEOUT_SECONDS}
+            step={1}
+            value={draft}
+            aria-label={t("settings.plugins.callTimeout")}
+            onChange={(e) => setDraft(e.target.value)}
+            onBlur={commit}
+            onKeyDown={(e) => {
+              if (e.key === "Enter") e.currentTarget.blur();
+            }}
+            className="bg-base border border-strong rounded px-3 py-2 text-primary w-24 focus:outline-none focus:border-focus transition-colors"
+          />
+          <span className="text-sm text-muted">{t("settings.seconds")}</span>
+        </div>
+      </SettingRow>
+    </SettingSection>
+  );
+}
```

**File**: `src/components/settings/PluginSettingsPage.tsx` (modified, +57/-1)
```diff
@@ -14,6 +14,9 @@ import { SlotAnchor } from "../ui/SlotAnchor";
 import {
   resolvePluginConfig,
   getDisplayInterpreter,
+  withCallTimeoutOverride,
+  resolveEffectiveCallTimeout,
+  MAX_PLUGIN_CALL_TIMEOUT_SECONDS,
   resolveSettingsWithDefaults,
   validateSettings,
 } from "../../utils/pluginConfig";
@@ -70,6 +73,13 @@ function PluginSettingsForm({ pluginId, manifest }: PluginSettingsFormProps) {
   const [interpreter, setInterpreter] = useState(
     getDisplayInterpreter(currentConfig),
   );
+  const [callTimeout, setCallTimeout] = useState(
+    currentConfig?.callTimeoutSeconds?.toString() ?? "",
+  );
+  const inheritedCallTimeout = resolveEffectiveCallTimeout(
+    settings.pluginCallTimeoutSeconds,
+    undefined,
+  );
   const definitions = useMemo(() => manifest?.settings ?? [], [manifest]);
   const [dynamicValues, setDynamicValues] = useState<
     Record<string, unknown>
@@ -138,7 +148,10 @@ function PluginSettingsForm({ pluginId, manifest }: PluginSettingsFormProps) {
       return;
     }
 
-    const baseConfig = resolvePluginConfig(currentConfig, interpreter);
+    const baseConfig = withCallTimeoutOverride(
+      resolvePluginConfig(currentConfig, interpreter),
+      callTimeout,
+    );
     const mergedSettings =
       definitions.length > 0
         ? { ...(baseConfig.settings ?? {}), ...dynamicValues }
@@ -172,6 +185,7 @@ function PluginSettingsForm({ pluginId, manifest }: PluginSettingsFormProps) {
     definitions,
     dynamicValues,
     interpreter,
+    callTimeout,
     currentConfig,
     settings.plugins,
     updateSetting,
@@ -345,6 +359,48 @@ function PluginSettingsForm({ pluginId, manifest }: PluginSettingsFormProps) {
         </SettingSection>
       )}
 
+      {!isBuiltin && (
+        <SettingSection
+          title={t("settings.plugins.pluginSettings.callTimeout")}
+          description={t("settings.plugins.pluginSettings.callTimeoutDesc")}
+        >
+          <div className="py-3 flex items-center gap-2">
+            <input autoCorrect="off" autoCapitalize="off" autoComplete="off" spellCheck={false}
+              type="number"
+              min={0}
+              max={MAX_PLUGIN_CALL_TIMEOUT_SECONDS}
+              step={1}
+              value={callTimeout}
+              aria-label={t("settings.plugins.pluginSettings.callTimeout")}
+              placeholder={t(
+                "settings.plugins.pluginSettings.callTimeoutPlaceholder",
+                { seconds: inheritedCallTimeout },
+              )}
+              onChange={(e) => {
+                setCallTimeout(e.target.value);
+                setSaved(false);
+              }}
+              className="w-56 bg-base border border-default rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-focus/50"
+            />
+            <span className="text-sm text-muted">{t("settings.seconds")}</span>
+            {callTimeout !== "" && (
+              <button
+                type="button"
+                onClick={() => {
+                  setCallTimeout("");
+                  setSaved(false);
+                }}
+                className="inline-flex items-center justify-center w-8 h-8 border border-default rounded-md text-muted hover:text-primary hover:border-strong transition-colors shrink-0"
+                title={t("settings.plugins.pluginSettings.callTimeoutInherit")}
+                aria-label={t("settings.plugins.pluginSettings.callTimeoutInherit")}
+              >
+                <RotateCcw size={12} />
+              </button>
+            )}
+          </div>
+        </SettingSection>
+      )}
+
       {/* Plugin UI extension slot */}
       <SlotAnchor
         name="settings.plugin.before_settings"
```

---

### Incident Patch 2: `f8185959` (2026-10-01)
**Commit Message**: feat(plugins): send a cancel notification to the plugin on call timeout

When a plugin call times out the host only dropped its own pending entry,
so the plugin kept working and, for SQL drivers, the statement kept
running on the server (#832). The management task now also writes a
JSON-RPC notification to the plugin's stdin:

  {"jsonrpc":"2.0","method":"cancel","params":{"id":<request id>}}

It is only sent while the request is still pending, so a response that
raced the timeout does not trigger it, and never when the timeout is
disabled. The contract is documented in PLUGIN_GUIDE.md.

**File**: `plugins/PLUGIN_GUIDE.md` (modified, +15/-0)
```diff
@@ -673,6 +673,21 @@ The `params.params` object is a `ConnectionParams` — the same values the user
 | `-32602` | Invalid params |
 | `-32603` | Internal error |
 
+### Cancel Notification (Optional)
+
+When a call exceeds the configured plugin call timeout, Tabularis stops waiting and reports the error to the user. Right after that it writes a JSON-RPC **notification** (no top-level `id`) naming the abandoned request:
+
+```json
+{ "jsonrpc": "2.0", "method": "cancel", "params": { "id": 1 } }
+```
+
+`params.id` is the `id` of the original request. Handling it is optional, but recommended for drivers that run statements on a server: without it a timed-out `execute_query` keeps running there (and a `DELETE` or `UPDATE` still takes effect) even though the user already saw an error.
+
+- **Do not reply.** A notification has no response; writing one would put an unexpected line on `stdout`.
+- **Ignore unknown ids** (already finished, already cancelled, or not cancellable). A late or duplicate cancel must never be treated as an error.
+- **Keep reading `stdin` while a request runs.** A plugin that processes requests strictly one at a time only sees the cancel after the long call has finished.
+- No cancel is sent when the timeout is disabled (`0`): the call simply waits.
+
 ---
 
 ## 5. Required Methods
```

**File**: `src-tauri/src/plugins/cancel_tests.rs` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+use super::*;
+
+/// Spawns a plugin that never answers and records every stdin line in a file.
+/// fd 3 keeps the stdout pipe open, otherwise the host sees EOF and treats
+/// the plugin as exited.
+#[cfg(unix)]
+async fn silent_recording_plugin(dir: &std::path::Path) -> (PluginProcess, PathBuf) {
+    let log = dir.join("stdin.log");
+    let script = dir.join("plugin.sh");
+    std::fs::write(&script, format!("exec 3>&1 cat > '{}'\n", log.display())).unwrap();
+    let process = PluginProcess::new("test-plugin".to_string(), script, Some("/bin/sh".into()))
+        .await
+        .expect("spawn sh");
+    (process, log)
+}
+
+#[cfg(unix)]
+async fn wait_for_lines(log: &std::path::Path, count: usize, within: Duration) -> Vec<Value> {
+    let deadline = tokio::time::Instant::now() + within;
+    loop {
+        let lines: Vec<Value> = std::fs::read_to_string(log)
+            .unwrap_or_default()
+            .lines()
+            .map(|line| serde_json::from_str(line).unwrap())
+            .collect();
+        if lines.len() >= count || tokio::time::Instant::now() >= deadline {
+            return lines;
+        }
+        tokio::time::sleep(Duration::from_millis(20)).await;
+    }
+}
+
+#[cfg(unix)]
+#[tokio::test]
+async fn timed_out_call_sends_a_cancel_notification_for_its_id() {
+    let dir = tempfile::tempdir().unwrap();
+    let (process, log) = silent_recording_plugin(dir.path()).await;
+
+    let error = process
+        .send_request(
+            "execute_query",
+            json!({ "query": "SELECT pg_sleep(330)" }),
+            Some(Duration::from_millis(100)),
+        )
+        .await
+        .unwrap_err();
+    assert!(error.to_string().contains("timed out"));
+
+    let lines = wait_for_lines(&log, 2, Duration::from_secs(5)).await;
+    process.shutdown().await;
+
+    assert_eq!(lines.len(), 2, "expected request + cancel, got {lines:?}");
+    assert_eq!(lines[0]["method"], "execute_query");
+    let id = lines[0]["id"].as_u64().unwrap();
+    assert_eq!(
+        lines[1],
+        json!({ "jsonrpc": "2.0", "method": "cancel", "params": { "id": id } })
+    );
+}
+
+#[cfg(unix)]
+#[tokio::test]
+async fn call_without_timeout_never_sends_a_cancel() {
+    let dir = tempfile::tempdir().unwrap();
+    let (process, log) = silent_recording_plugin(dir.path()).await;
+    let process = Arc::new(process);
+
+    let call = tokio::spawn({
+        let process = process.clone();
+        async move {
+            process
+                .send_request("execute_query", json!({ "query": "SELECT 1" }), None)
+                .await
+        }
+    });
+
+    let lines = wait_for_lines(&log, 1, Duration::from_secs(5)).await;
+    let lines_later = wait_for_lines(&log, 2, Duration::from_millis(300)).await;
+    assert!(!call.is_finished(), "an unlimited call must keep waiting");
+    call.abort();
+    process.shutdown().await;
+
+    assert_eq!(lines.len(), 1);
+    assert_eq!(
+        lines_later.len(),
+        1,
+        "no cancel expected, got {lines_later:?}"
+    );
+}
```

**File**: `src-tauri/src/plugins/driver.rs` (modified, +22/-3)
```diff
@@ -18,7 +18,9 @@ use crate::models::{
     TriggerInfo, ViewInfo,
 };
 use crate::plugins::connection_metadata::{ConnectionMetadataCache, ConnectionMetadataOverrides};
-use crate::plugins::rpc::{JsonRpcRequest, JsonRpcResponse, PluginCallError};
+use crate::plugins::rpc::{
+    cancel_notification_line, JsonRpcRequest, JsonRpcResponse, PluginCallError,
+};
 
 #[cfg(windows)]
 use std::os::windows::process::CommandExt;
@@ -46,7 +48,8 @@ enum PluginCommand {
         oneshot::Sender<Result<Value, PluginCallError>>,
     ),
     /// Drop the pending entry for `id` because the caller stopped waiting
-    /// (timed out). Prevents an unbounded leak of orphaned response senders.
+    /// (timed out), and send the plugin a `cancel` notification for it.
+    /// Prevents an unbounded leak of orphaned response senders.
     Cancel(u64),
 }
 
@@ -145,7 +148,19 @@ impl PluginProcess {
                             Some(PluginCommand::Cancel(id)) => {
                                 // Caller timed out; drop the orphaned sender so
                                 // pending_requests does not grow without bound.
-                                pending_requests.remove(&id);
+                                // If it was still pending, ask the plugin to stop
+                                // the work too, so e.g. a SQL statement does not
+                                // keep running on the server after the error.
+                                if pending_requests.remove(&id).is_some() {
+                                    let line = cancel_notification_line(id);
+                                    if let Err(e) = stdin.write_all(line.as_bytes()).await {
+                                        log::warn!(
+                                            "Failed to send cancel for plugin request {}: {}",
+                                            id,
+                                            e
+                                        );
+                                    }
+                                }
                             }
                             None => {
                                 // Channel closed without explicit shutdown — kill the process anyway.
@@ -2411,3 +2426,7 @@ mod table_query_template_tests;
 #[cfg(test)]
 #[path = "startup_tests.rs"]
 mod startup_tests;
+
+#[cfg(test)]
+#[path = "cancel_tests.rs"]
+mod cancel_tests;
```

**File**: `src-tauri/src/plugins/rpc.rs` (modified, +26/-0)
```diff
@@ -52,3 +52,29 @@ pub enum JsonRpcResponse {
         id: u64,
     },
 }
+
+/// A JSON-RPC notification: no `id`, so the plugin must not reply.
+#[derive(Serialize, Debug)]
+pub struct JsonRpcNotification {
+    pub jsonrpc: String,
+    pub method: String,
+    pub params: Value,
+}
+
+/// Line written to the plugin's stdin when the host stops waiting for request
+/// `id` (call timeout). Plugins that support it cancel the in-flight work,
+/// e.g. the server-side statement; unknown ids must be ignored.
+pub fn cancel_notification_line(id: u64) -> String {
+    let notification = JsonRpcNotification {
+        jsonrpc: "2.0".to_string(),
+        method: "cancel".to_string(),
+        params: serde_json::json!({ "id": id }),
+    };
+    let mut line = serde_json::to_string(&notification).unwrap();
+    line.push('\n');
+    line
+}
+
+#[cfg(test)]
+#[path = "rpc_tests.rs"]
+mod tests;
```

**File**: `src-tauri/src/plugins/rpc_tests.rs` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+use super::*;
+
+#[test]
+fn cancel_notification_line_is_a_newline_terminated_notification() {
+    let line = cancel_notification_line(42);
+
+    assert!(line.ends_with('\n'));
+    assert_eq!(line.matches('\n').count(), 1);
+
+    let value: Value = serde_json::from_str(line.trim_end()).unwrap();
+    assert_eq!(
+        value,
+        serde_json::json!({ "jsonrpc": "2.0", "method": "cancel", "params": { "id": 42 } })
+    );
+}
+
+#[test]
+fn cancel_notification_line_omits_the_top_level_id() {
+    let value: Value = serde_json::from_str(cancel_notification_line(7).trim_end()).unwrap();
+
+    assert!(value.as_object().unwrap().get("id").is_none());
+}
+
+#[test]
+fn cancel_notification_line_keeps_large_ids_exact() {
+    let value: Value = serde_json::from_str(cancel_notification_line(u64::MAX).trim_end()).unwrap();
+
+    assert_eq!(value["params"]["id"].as_u64(), Some(u64::MAX));
+}
```

---

### Incident Patch 3: `ea853b1e` (2026-09-30)
**Commit Message**: fix(plugins): resolve call timeout for get_table_query_template after merging main

**File**: `src-tauri/src/plugins/driver.rs` (modified, +0/-1)
```diff
@@ -1076,7 +1076,6 @@ impl DatabaseDriver for RpcDriver {
             .call_detailed(
                 "get_table_query_template",
                 json!({ "params": params, "request": request }),
-                PLUGIN_CALL_TIMEOUT,
             )
             .await
         {
```

---

### Incident Patch 4: `e4aa6b04` (2026-09-30)
**Commit Message**: Merge remote-tracking branch 'origin/main' into feat/configurable-plugin-call-timeout

**File**: `.github/workflows/build.yml` (modified, +5/-14)
```diff
@@ -234,20 +234,11 @@ jobs:
       - name: Override app version (nightly channel)
         if: inputs.updater_version != ''
         shell: bash
-        run: |
-          set -euo pipefail
-          v='${{ inputs.updater_version }}'
-          node -e "const f='src-tauri/tauri.conf.json';const c=require('./'+f);const fs=require('fs');c.version=process.argv[1];fs.writeFileSync(f, JSON.stringify(c, null, 2)+'\n');" "$v"
-          # First version key in Cargo.toml is the [package] version.
-          # sed -i.bak keeps it portable across GNU and macOS BSD sed.
-          sed -i.bak "0,/^version = \".*\"/s//version = \"$v\"/" src-tauri/Cargo.toml && rm -f src-tauri/Cargo.toml.bak
-          # The frontend does not read tauri.conf.json: the About page, the
-          # Updates card and plugin compatibility checks all use the constant
-          # in src/version.ts (kept in sync by scripts/sync-version.js on
-          # release). Patch it too, or a nightly shows the stable version it
-          # was branched from instead of its own.
-          printf 'export const APP_VERSION = "%s";\n' "$v" > src/version.ts
-          echo "Patched version to $v"
+        env:
+          NIGHTLY_VERSION: ${{ inputs.updater_version }}
+        # One portable implementation keeps the bundle, Rust runtime floor
+        # checks and frontend aligned. BSD sed does not support GNU's 0,/.../.
+        run: node scripts/set-nightly-version.mjs "$NIGHTLY_VERSION"
 
       - name: Build signed bundles (+ upload to GitHub Release unless preview)
         if: env.CAN_SIGN == 'true'
```

**File**: `.github/workflows/nightly.yml` (modified, +4/-1)
```diff
@@ -19,7 +19,10 @@ on:
 
 concurrency:
   group: nightly
-  cancel-in-progress: true
+  # Each platform publishes independently. Finish the current matrix before
+  # the next gate checks its tag, or a scheduled run can cancel the remaining
+  # platforms and then skip because the partially published tag already exists.
+  cancel-in-progress: false
 
 jobs:
   gate:
```

**File**: `plugins/PLUGIN_GUIDE.md` (modified, +61/-0)
```diff
@@ -127,6 +127,7 @@ Upgrade the registry before publishing the new format. Add `id` equal to the **e
 | `connection_string` | bool | Set `false` to hide the connection string import UI for this driver. Defaults to `true` for network drivers. `file_based` and `folder_based` drivers skip the import UI automatically regardless of this flag. |
 | `connection_string_example` | string | Optional placeholder example shown in the connection string import field (e.g. `"clickhouse://user:pass@localhost:9000/db"`). Also accepted as camelCase `connectionStringExample`. |
 | `identifier_quote` | string | Character used to quote SQL identifiers. Use `"\""` for ANSI standard or `` "`" `` for MySQL style. |
+| `table_query_templates` | bool | Opts the Generate SQL dialog into the optional `get_table_query_template` RPC for SELECT/UPDATE/DELETE previews. Defaults to `false`; older plugins and built-in drivers keep the existing host templates. See [Table Query Templates](#table-query-templates). |
 | `sql_dialect` | string | Optional statement-splitting dialect: `postgres`, `mysql`, `mssql`, `sqlite`, `oracle`, or `generic`. Oracle-like plugins, including DM/Dameng, should use `"oracle"`. |
 | `alter_primary_key` | bool | `true` if the database supports altering primary keys after table creation. |
 | `manage_tables` | bool | `true` to enable table and column management UI (Create Table, Add/Modify/Drop Column, Drop Table). Does not control index or FK operations. Defaults to `true`. |
@@ -1302,6 +1303,66 @@ Return foreign keys for all tables at once.
 
 ---
 
+### Table Query Templates
+
+`get_table_query_template` is an **optional, additive** RPC, called only when
+`capabilities.table_query_templates` is `true`. It returns a SQL preview and
+**must not execute** the generated statement.
+
+**Params:**
+
+```json
+{
+  "params": { "driver": "sqlserver", "connection_id": "..." },
+  "request": {
+    "table": "orders",
+    "schema": "sales",
+    "kind": "select",
+    "columns": ["id", "status"],
+    "limit": 100
+  }
+}
+```
+
+`params` is the usual resolved `ConnectionParams`. `request.kind` is `select`,
+`update` or `delete`. Table, schema and column names are **unquoted identifiers**,
+not SQL fragments; the driver must quote and escape them. `columns` defaults to
+`[]`: SELECT uses `*`, UPDATE produces an editable column placeholder. `schema`
+and `limit` may be omitted or null. `limit` is an unsigned 32-bit explicit SELECT
+row limit (including zero); UPDATE/DELETE reject a non-null limit. SELECT All
+passes no limit; SELECT Fields passes 100. UPDATE/DELETE templates must include
+`WHERE 1 = 0` to prevent accidental broad writes. UPDATE values use the host
+editor's named placeholders (`:value_1`, etc.), not driver-native bind markers.
+
+**Result:** a string, for example
+`"SELECT TOP (100) [id], [status] FROM [sales].[orders];"`.
+
+Compatibility:
+
+- Missing/false capability: no new RPC is sent; legacy generation is unchanged.
+- Remote JSON-RPC error **code** `-32601`: the host falls back to its legacy
+  template. Transport errors, other remote errors and malformed results are
+  surfaced, not silently replaced with another SQL dialect.
+- The Tauri command returns `string | null`; null is the host's fallback signal,
+  **not** a valid plugin success result.
+- Existing RPC signatures, built-in driver behavior and CREATE TABLE generation
+  are unchanged. This is not a replacement for the existing DDL methods.
+- Older hosts ignore the new manifest capability and never call the method.
+  Plugins need not raise `min_runtime_version` solely for this optional feature.
+- The capability is a static manifest opt-in, not a connection-metadata override.
+
+Registry rollout: add an optional boolean `table_query_templates` (default
+false) to the driver kind's `capabilities.properties` in Tabularium for schema
+validation and generated documentation. Do not make it required. The registry
+only distributes the manifest and release; it does not route the RPC. No change
+to registry endpoints, release formats or the Tabularium SDK is needed. Register
+the property before publishing: Tabularium ingestion uses lenient validation with
+AJV `removeAdditional: 'all'`, which strips undeclared capability keys even when
+the capabilities schema otherwise allows additional properties. Refresh an
+already-ingested manifest after updating the schema.
+
+---
+
 ### DDL Generation
 
 These methods generate SQL statements. Tabularis may display the SQL to the user before executing it. When `get_tables` / `get_columns` return comments, the host preserves them in generated inspection SQL for MySQL-family dialects and dialects that use `COMMENT ON` (currently PostgreSQL and Oracle). Other dialects continue to receive the existing DDL without comments; no manifest change is required.
```

**File**: `plugins/manifest.schema.json` (modified, +5/-0)
```diff
@@ -163,6 +163,11 @@
           "default": false,
           "description": "true if primary key is defined inline in the column definition (e.g. SQLite AUTOINCREMENT style)."
         },
+        "table_query_templates": {
+          "type": "boolean",
+          "default": false,
+          "description": "Generate SQL SELECT/UPDATE/DELETE previews through the optional get_table_query_template RPC."
+        },
         "alter_column": {
           "type": "boolean",
           "default": false,
```

**File**: `plugins/tabularium-extensions.schema.json` (modified, +5/-0)
```diff
@@ -115,6 +115,11 @@
           "type": "boolean",
           "description": "Primary key is declared inline in the column definition (e.g. SQLite `AUTOINCREMENT`)."
         },
+        "table_query_templates": {
+          "type": "boolean",
+          "default": false,
+          "description": "Generate SQL SELECT/UPDATE/DELETE previews through the optional get_table_query_template RPC."
+        },
         "no_connection_required": {
           "type": "boolean",
           "description": "API-based driver with no host/port/credentials. Hides the connection form entirely."
```

**File**: `scripts/set-nightly-version.mjs` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+import { readFileSync, writeFileSync } from "node:fs";
+
+const version = process.argv[2];
+if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-(0|[1-9]\d*)$/.test(version ?? "")) {
+  throw new Error("Expected a nightly version with one numeric suffix, e.g. 0.25.1-6");
+}
+
+const configPath = "src-tauri/tauri.conf.json";
+const cargoPath = "src-tauri/Cargo.toml";
+const frontendPath = "src/version.ts";
+const config = JSON.parse(readFileSync(configPath, "utf8"));
+const cargo = readFileSync(cargoPath, "utf8");
+const lines = cargo.split(/\r?\n/);
+const packageStart = lines.findIndex((line) => line.trim() === "[package]");
+if (packageStart < 0) throw new Error("Cargo.toml has no [package] section");
+let packageEnd = lines.findIndex((line, index) => index > packageStart && /^\s*\[/.test(line));
+if (packageEnd < 0) packageEnd = lines.length;
+const versionLines = lines.flatMap((line, index) =>
+  index > packageStart && index < packageEnd && /^\s*version\s*=\s*"[^"]+"/.test(line) ? [index] : [],
+);
+if (versionLines.length !== 1) throw new Error("Expected one literal Cargo package version");
+
+// Validate every input before writing. A BSD/GNU sed mismatch previously left
+// CARGO_PKG_VERSION at the stable version while the app advertised a nightly.
+readFileSync(frontendPath, "utf8");
+config.version = version;
+lines[versionLines[0]] = lines[versionLines[0]].replace(/^(\s*version\s*=\s*)"[^"]+"/, `$1"${version}"`);
+writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
+writeFileSync(cargoPath, lines.join("\n"));
+writeFileSync(frontendPath, `export const APP_VERSION = "${version}";\n`);
+console.log(`Patched Tauri, Cargo and frontend versions to ${version}`);
```

**File**: `src-tauri/src/commands.rs` (modified, +15/-0)
```diff
@@ -1080,6 +1080,21 @@ pub async fn get_routine_definition<R: Runtime>(
         .await
 }
 
+/// Preview generation only; the returned SQL is never executed here.
+#[tauri::command]
+pub async fn get_table_query_template<R: Runtime>(
+    app: AppHandle<R>,
+    connection_id: String,
+    request: crate::models::TableQueryTemplateRequest,
+) -> Result<Option<String>, String> {
+    let saved_conn = find_connection_by_id(&app, &connection_id)?;
+    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
+    let expanded_params = expand_k8s_connection_params(&app, &expanded_params).await?;
+    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;
+    let drv = driver_for_params(&params).await?;
+    drv.get_table_query_template(&params, &request).await
+}
+
 #[tauri::command]
 pub async fn build_routine_call_sql<R: Runtime>(
     app: AppHandle<R>,
```

**File**: `src-tauri/src/drivers/driver_trait.rs` (modified, +14/-0)
```diff
@@ -100,6 +100,10 @@ pub struct DriverCapabilities {
     /// Whether primary key is defined inline in the column definition (e.g. SQLite AUTOINCREMENT).
     #[serde(default)]
     pub inline_pk: bool,
+    /// Opts Generate SQL into the optional get_table_query_template RPC.
+    /// Omitted/false preserves the host's existing template generation.
+    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
+    pub table_query_templates: bool,
     // DDL capabilities
     /// Supports ALTER TABLE MODIFY/ALTER COLUMN on existing tables.
     #[serde(default)]
@@ -744,6 +748,16 @@ pub trait DatabaseDriver: Send + Sync {
         Err("BLOB preview not supported by this driver".into())
     }
 
+    /// Optional SQL preview generation. None asks the host to use its legacy
+    /// templates. Built-in and older drivers need no implementation changes.
+    async fn get_table_query_template(
+        &self,
+        _params: &ConnectionParams,
+        _request: &crate::models::TableQueryTemplateRequest,
+    ) -> Result<Option<String>, String> {
+        Ok(None)
+    }
+
     // --- DDL generation (SQL preview) ----------------------------------------
 
     async fn get_create_table_sql(
```

---

### Incident Patch 5: `96b42459` (2026-09-30)
**Commit Message**: fix(plugins): keep last-known-good call timeouts on config read failure

load_config_from_disk() refreshed the plugin call timeout snapshot on every
call, including unrelated callers like display_timezone(). A transient read
or parse failure fell back to AppConfig::default() and silently reset every
global and per-plugin timeout to 120s.

Only refresh the snapshot when the file was parsed successfully or is
missing (first run); keep the previous snapshot on read or parse errors.

**File**: `src-tauri/src/config.rs` (modified, +50/-6)
```diff
@@ -300,16 +300,31 @@ pub const DEFAULT_MCP_APPROVAL_NOTIFY_SOUND: bool = true;
 /// unreadable.
 pub fn load_config_from_disk() -> AppConfig {
     let path = crate::paths::get_app_config_dir().join("config.json");
-    let config = fs::read_to_string(&path)
-        .ok()
-        .and_then(|s| serde_json::from_str::<AppConfig>(&s).ok())
-        .unwrap_or_default();
+    let (config, trusted) = parse_config_file(fs::read_to_string(&path));
     // The MCP subprocess never goes through `cache_config`; keep its plugin
-    // call timeouts in sync with what is on disk.
-    crate::plugins::call_timeout::apply_config(&config);
+    // call timeouts in sync with what is on disk. A transient read or parse
+    // failure must not reset them to the defaults, so the last-known-good
+    // snapshot is kept in that case.
+    if trusted {
+        crate::plugins::call_timeout::apply_config(&config);
+    }
     config
 }
 
+/// Turns the result of reading `config.json` into a config plus whether it
+/// reflects what the user actually configured. A missing file is trusted
+/// (the defaults are the real config), a read or parse error is not.
+fn parse_config_file(read: std::io::Result<String>) -> (AppConfig, bool) {
+    match read {
+        Ok(content) => match serde_json::from_str::<AppConfig>(&content) {
+            Ok(config) => (config, true),
+            Err(_) => (AppConfig::default(), false),
+        },
+        Err(e) if e.kind() == std::io::ErrorKind::NotFound => (AppConfig::default(), true),
+        Err(_) => (AppConfig::default(), false),
+    }
+}
+
 /// True when `connection_id` should be treated as read-only by MCP, taking
 /// the per-connection override list into account.
 pub fn is_connection_readonly(config: &AppConfig, connection_id: &str) -> bool {
@@ -1314,4 +1329,33 @@ mod tests {
         // path is exercised indirectly via parse failures + missing file).
         let _ = load_config_from_disk();
     }
+
+    #[test]
+    fn parse_config_file_trusts_valid_content() {
+        let (config, trusted) =
+            parse_config_file(Ok(r#"{"pluginCallTimeoutSeconds":0}"#.to_string()));
+        assert!(trusted);
+        assert_eq!(config.plugin_call_timeout_seconds, Some(0));
+    }
+
+    #[test]
+    fn parse_config_file_trusts_missing_file() {
+        let missing = std::io::Error::from(std::io::ErrorKind::NotFound);
+        let (config, trusted) = parse_config_file(Err(missing));
+        assert!(trusted);
+        assert_eq!(config.plugin_call_timeout_seconds, None);
+    }
+
+    #[test]
+    fn parse_config_file_distrusts_read_errors() {
+        let denied = std::io::Error::from(std::io::ErrorKind::PermissionDenied);
+        let (_, trusted) = parse_config_file(Err(denied));
+        assert!(!trusted);
+    }
+
+    #[test]
+    fn parse_config_file_distrusts_malformed_content() {
+        let (_, trusted) = parse_config_file(Ok("{ truncated".to_string()));
+        assert!(!trusted);
+    }
 }
```

---

### Incident Patch 6: `09a11f41` (2026-09-29)
**Commit Message**: fix: keep scroll position of grids in multi-result panel

Follow-up to #831: pass initialScrollTop/onScrollTopChange through MultiResultPanel, StackedResultItem and ResultEntryContent, keyed per tab and result entry in Editor.

**File**: `src/components/ui/MultiResultPanel.tsx` (modified, +9/-0)
```diff
@@ -59,6 +59,9 @@ interface MultiResultPanelProps {
   onCloseAllEntries: () => void;
   onRenameEntry: (entryId: string, label: string) => void;
   commandTargetRef?: Ref<DataGridCommandTarget>;
+  /** Scroll offset to restore for an entry's grid when it remounts (#823). */
+  getInitialScrollTop?: (entryId: string) => number | undefined;
+  onScrollTopChange?: (entryId: string, scrollTop: number) => void;
 }
 
 function ResultTab({
@@ -256,6 +259,8 @@ export function MultiResultPanel({
   onCloseAllEntries,
   onRenameEntry,
   commandTargetRef,
+  getInitialScrollTop,
+  onScrollTopChange,
 }: MultiResultPanelProps) {
   const { t } = useTranslation();
   const { settings } = useSettings();
@@ -474,6 +479,8 @@ export function MultiResultPanel({
               csvDelimiter={csvDelimiter}
               csvIncludeHeaders={csvIncludeHeaders}
               onPageChange={(page) => onPageChange(activeEntry.id, page)}
+              initialScrollTop={getInitialScrollTop?.(activeEntry.id)}
+              onScrollTopChange={(top) => onScrollTopChange?.(activeEntry.id, top)}
             />
           </div>
         </>
@@ -544,6 +551,8 @@ export function MultiResultPanel({
                 onRerun={() => onRerunEntry(entry.id)}
                 onAiRename={() => handleAiRename(entry.id)}
                 onClose={() => onCloseEntry(entry.id)}
+                initialScrollTop={getInitialScrollTop?.(entry.id)}
+                onScrollTopChange={(top) => onScrollTopChange?.(entry.id, top)}
               />
             ))}
           </div>
```

**File**: `src/components/ui/ResultEntryContent.tsx` (modified, +8/-0)
```diff
@@ -17,6 +17,8 @@ interface ResultEntryContentProps {
   onPageChange: (page: number) => void;
   compact?: boolean;
   commandTargetRef?: Ref<DataGridCommandTarget>;
+  initialScrollTop?: number;
+  onScrollTopChange?: (scrollTop: number) => void;
 }
 
 export function ResultEntryContent({
@@ -28,6 +30,8 @@ export function ResultEntryContent({
   onPageChange,
   compact,
   commandTargetRef,
+  initialScrollTop,
+  onScrollTopChange,
 }: ResultEntryContentProps) {
   const { t } = useTranslation();
 
@@ -128,6 +132,8 @@ export function ResultEntryContent({
           readonly={true}
           totalRows={entry.result.pagination?.total_rows}
           hasMore={entry.result.pagination?.has_more}
+          initialScrollTop={initialScrollTop}
+          onScrollTopChange={onScrollTopChange}
         />
       </div>
     );
@@ -179,6 +185,8 @@ export function ResultEntryContent({
           readonly={true}
           totalRows={entry.result.pagination?.total_rows}
           hasMore={entry.result.pagination?.has_more}
+          initialScrollTop={initialScrollTop}
+          onScrollTopChange={onScrollTopChange}
         />
       </div>
     </div>
```

**File**: `src/components/ui/StackedResultItem.tsx` (modified, +6/-0)
```diff
@@ -38,6 +38,8 @@ interface StackedResultItemProps {
   onAiRename: () => void;
   onClose: () => void;
   commandTargetRef?: Ref<DataGridCommandTarget>;
+  initialScrollTop?: number;
+  onScrollTopChange?: (scrollTop: number) => void;
 }
 
 export function StackedResultItem({
@@ -56,6 +58,8 @@ export function StackedResultItem({
   onAiRename,
   onClose,
   commandTargetRef,
+  initialScrollTop,
+  onScrollTopChange,
 }: StackedResultItemProps) {
   const { t } = useTranslation();
   const [queryExpanded, setQueryExpanded] = useState(false);
@@ -325,6 +329,8 @@ export function StackedResultItem({
                   csvDelimiter={csvDelimiter}
                   csvIncludeHeaders={csvIncludeHeaders}
                   onPageChange={onPageChange}
+                  initialScrollTop={initialScrollTop}
+                  onScrollTopChange={onScrollTopChange}
                   compact
                 />
               </div>
```

**File**: `src/pages/Editor.tsx` (modified, +35/-1)
```diff
@@ -108,6 +108,7 @@ import { splitQueries, splitStatements, findStatementAtOffset, extractTableName,
 import { resolveRunTarget, type RunContext } from "../utils/runTarget";
 import {
   createResultEntries,
+  clearEntryScrollTops as clearScrollTopsForTab,
   createEntriesFromResultSets,
   updateResultEntry,
   removeResultEntry,
@@ -416,6 +417,8 @@ export const Editor = ({ commandScopeId }: EditorProps) => {
   // routing it through updateTab would fire EditorProvider's tabs-changed
   // effect (which persists via a Tauri invoke) on every scroll pixel.
   const scrollTopByTabIdRef = useRef<Map<string, number>>(new Map());
+  // Same, for each MultiResultPanel grid, keyed `${tabId}:${entryId}`.
+  const scrollTopByEntryKeyRef = useRef<Map<string, number>>(new Map());
   // Insertion count last seen per tab's DataGrid mount (#823 follow-up).
   // DataGrid remounts on every pendingInsertions size change, so it can't
   // detect the transition itself; tracked here so a real new insertion
@@ -921,16 +924,21 @@ export const Editor = ({ commandScopeId }: EditorProps) => {
     [],
   );
 
+  const clearEntryScrollTops = useCallback((tabId: string) => {
+    clearScrollTopsForTab(scrollTopByEntryKeyRef.current, tabId);
+  }, []);
+
   const handleCloseTab = useCallback(
     (tabId: string) => {
       requestTabClosure([tabId], () => {
         delete editorsRef.current[tabId];
         scrollTopByTabIdRef.current.delete(tabId);
+        clearEntryScrollTops(tabId);
         prevInsertionCountByTabIdRef.current.delete(tabId);
         closeTab(tabId);
       });
     },
-    [closeTab, requestTabClosure],
+    [clearEntryScrollTops, closeTab, requestTabClosure],
   );
 
   const handleCloseOtherTabs = useCallback(
@@ -1191,6 +1199,7 @@ export const Editor = ({ commandScopeId }: EditorProps) => {
       // A fresh query's result set can be a different size (or empty), so an
       // old scroll offset from a larger one shouldn't linger (#823).
       scrollTopByTabIdRef.current.delete(targetTabId);
+      clearEntryScrollTops(targetTabId);
 
       const shouldRecordHistory =
         targetTab?.type === "console" || targetTab?.type === "query_builder";
@@ -1350,6 +1359,7 @@ export const Editor = ({ commandScopeId }: EditorProps) => {
       }
     },
     [
+      clearEntryScrollTops,
       activeConnectionId,
       updateTab,
       settings.resultPageSize,
@@ -1417,6 +1427,8 @@ export const Editor = ({ commandScopeId }: EditorProps) => {
         || (isMultiDb ? activeDatabaseName : undefined)
         || undefined;
 
+      // Entry ids are reused per tab, so drop offsets from the previous run.
+      clearEntryScrollTops(targetTabId);
       const entries = createResultEntries(targetTabId, queries);
 
       setIsResultsCollapsed(false);
@@ -1561,6 +1573,7 @@ export const Editor = ({ commandScopeId }: EditorProps) => {
       });
     },
     [
+      clearEntryScrollTops,
       activeConnectionId,
       updateTab,
       patchResultEntry,
@@ -1645,6 +1658,8 @@ export const Editor = ({ commandScopeId }: EditorProps) => {
       );
       const schema = currentTab?.schema ?? activeSchema;
 
+      scrollTopByEntryKeyRef.current.delete(`${targetTabId}:${entryId}`);
+
       // Mark this entry as loading
       if (currentTab?.results) {
         updateTab(targetTabId, {
@@ -2560,6 +2575,13 @@ export const Editor = ({ commandScopeId }: EditorProps) => {
     [updateTab],
   );
 
+  const handleEntryScrollTopChange = useCallback(
+    (tabId: string, entryId: string, scrollTop: number) => {
+      scrollTopByEntryKeyRef.current.set(`${tabId}:${entryId}`, scrollTop);
+    },
+    [],
+  );
+
   const handleScrollTopChange = useCallback((scrollTop: number) => {
     if (!activeTabIdRef.current) return;
     // Kept in a plain ref, not tab state — see scrollTopByTabIdRef above.
@@ -4661,6 +4683,14 @@ export const Editor = ({ commandScopeId }: EditorProps) => {
             ) : activeTab.results && activeTab.results.length > 0 ? (
               <MultiResultPanel
                 commandTargetRef={dataGridCommandTargetRef}
+                getInitialScrollTop={(entryId) =>
+                  scrollTopByEntryKeyRef.current.get(
+                    `${activeTab.id}:${entryId}`,
+                  )
+                }
+                onScrollTopChange={(entryId, scrollTop) =>
+                  handleEntryScrollTopChange(activeTab.id, entryId, scrollTop)
+                }
                 results={activeTab.results}
                 activeResultId={activeTab.activeResultId}
                 tabId={activeTab.id}
@@ -4674,6 +4704,9 @@ export const Editor = ({ commandScopeId }: EditorProps) => {
                 onRerunEntry={(entryId) => runResultEntryPage(entryId, 1)}
                 onPageChange={runResultEntryPage}
                 onCloseEntry={(entryId) => {
+                  scrollTopByEntryKeyRef.current.delete(
+                    `${activeTab.id}:${entryId}`,
+                  );
                
```

**File**: `src/utils/multiResult.ts` (modified, +13/-0)
```diff
@@ -202,3 +202,16 @@ export function removeEntriesToLeft(
     nextActiveId: activeStillExists ? activeResultId : entryId,
   };
 }
+
+/**
+ * Removes the saved scroll offsets of every result entry of a tab.
+ * Keys are `${tabId}:${entryId}`.
+ */
+export function clearEntryScrollTops(
+  offsets: Map<string, number>,
+  tabId: string,
+): void {
+  for (const key of offsets.keys()) {
+    if (key.startsWith(`${tabId}:`)) offsets.delete(key);
+  }
+}
```

**File**: `tests/components/ui/MultiResultPanel.test.tsx` (modified, +89/-7)
```diff
@@ -7,13 +7,27 @@ import type { QueryResultEntry, QueryResult } from "../../../src/types/editor";
 
 // Mock DataGrid
 vi.mock("../../../src/components/ui/DataGrid", () => ({
-  DataGrid: vi.fn(({ ref, data }: { ref?: unknown; data: unknown[][] }) => (
-    <div
-      data-testid="data-grid"
-      data-has-command-target={String(Boolean(ref))}
-      data-first-value={String(data[0]?.[0] ?? "")}
-    />
-  )),
+  DataGrid: vi.fn(
+    ({
+      ref,
+      data,
+      initialScrollTop,
+      onScrollTopChange,
+    }: {
+      ref?: unknown;
+      data: unknown[][];
+      initialScrollTop?: number;
+      onScrollTopChange?: (scrollTop: number) => void;
+    }) => (
+      <div
+        data-testid="data-grid"
+        data-has-command-target={String(Boolean(ref))}
+        data-first-value={String(data[0]?.[0] ?? "")}
+        data-initial-scroll-top={String(initialScrollTop ?? "")}
+        onScroll={(e) => onScrollTopChange?.(e.currentTarget.scrollTop)}
+      />
+    ),
+  ),
 }));
 
 // Mock ErrorDisplay
@@ -438,4 +452,72 @@ describe("MultiResultPanel", () => {
     );
     expect(screen.getByText("My Query")).toBeInTheDocument();
   });
+
+  describe("scroll position (#823)", () => {
+    const results = [
+      makeEntry({ id: "r-0", result: makeResult([[10]]), isLoading: false }),
+      makeEntry({ id: "r-1", result: makeResult([[20]]), isLoading: false }),
+    ];
+
+    it("passes each entry's offset to its grid in tabs view", () => {
+      const offsets: Record<string, number> = { "r-0": 120, "r-1": 340 };
+      const getInitialScrollTop = vi.fn((id: string) => offsets[id]);
+      const { rerender } = render(
+        <MultiResultPanel
+          {...defaultProps}
+          results={results}
+          activeResultId="r-0"
+          getInitialScrollTop={getInitialScrollTop}
+        />,
+      );
+      expect(
+        screen.getByTestId("data-grid").getAttribute("data-initial-scroll-top"),
+      ).toBe("120");
+
+      rerender(
+        <MultiResultPanel
+          {...defaultProps}
+          results={results}
+          activeResultId="r-1"
+          getInitialScrollTop={getInitialScrollTop}
+        />,
+      );
+      expect(
+        screen.getByTestId("data-grid").getAttribute("data-initial-scroll-top"),
+      ).toBe("340");
+    });
+
+    it("restores every grid's offset in stacked view", () => {
+      const offsets: Record<string, number> = { "r-0": 120, "r-1": 340 };
+      render(
+        <MultiResultPanel
+          {...defaultProps}
+          results={results}
+          activeResultId="r-0"
+          getInitialScrollTop={(id) => offsets[id]}
+        />,
+      );
+      fireEvent.click(screen.getByTitle("editor.multiResult.viewStacked"));
+      const grids = screen.getAllByTestId("data-grid");
+      expect(
+        grids.map((g) => g.getAttribute("data-initial-scroll-top")),
+      ).toEqual(["120", "340"]);
+    });
+
+    it("reports scroll changes with the entry id", () => {
+      const onScrollTopChange = vi.fn();
+      render(
+        <MultiResultPanel
+          {...defaultProps}
+          results={results}
+          activeResultId="r-0"
+          onScrollTopChange={onScrollTopChange}
+        />,
+      );
+      fireEvent.click(screen.getByTitle("editor.multiResult.viewStacked"));
+      const grids = screen.getAllByTestId("data-grid");
+      fireEvent.scroll(grids[1], { target: { scrollTop: 77 } });
+      expect(onScrollTopChange).toHaveBeenCalledWith("r-1", 77);
+    });
+  });
 });
```

**File**: `tests/utils/multiResult.test.ts` (modified, +13/-0)
```diff
@@ -1,5 +1,6 @@
 import { describe, it, expect } from "vitest";
 import {
+  clearEntryScrollTops,
   createResultEntries,
   createEntriesFromResultSets,
   updateResultEntry,
@@ -525,3 +526,15 @@ describe("multiResult", () => {
     });
   });
 });
+
+describe("clearEntryScrollTops", () => {
+  it("removes only the given tab's entry offsets", () => {
+    const offsets = new Map([
+      ["tab1:tab1-result-0", 120],
+      ["tab1:tab1-result-1", 340],
+      ["tab10:tab10-result-0", 50],
+    ]);
+    clearEntryScrollTops(offsets, "tab1");
+    expect([...offsets.keys()]).toEqual(["tab10:tab10-result-0"]);
+  });
+});
```

---

### Incident Patch 7: `ff4c5e46` (2026-09-29)
**Commit Message**: Merge pull request #831 from drakeo338/claude/823-fix

**File**: `src/components/ui/DataGrid.tsx` (modified, +56/-13)
```diff
@@ -1,6 +1,7 @@
 import React, {
   useState,
   useEffect,
+  useLayoutEffect,
   useRef,
   useCallback,
   useMemo,
@@ -162,6 +163,21 @@ interface DataGridProps {
   hasMore?: boolean;
   /** Fetches and copies every row of the result set (not just the page). */
   onCopyAllRows?: () => void;
+  /**
+   * Vertical scroll position to restore on mount (#823). The grid is keyed
+   * by tab/result identity and remounts on tab switches, so this has to be
+   * handed back in rather than surviving on its own.
+   */
+  initialScrollTop?: number;
+  /** Reports the scroll container's scrollTop on every scroll, so the caller can persist it. */
+  onScrollTopChange?: (scrollTop: number) => void;
+  /**
+   * True when this mount is caused by a genuine new pending insertion, not
+   * just a remount from switching tabs. The caller tracks this itself,
+   * since the grid remounts on insertion-count change and can't see the
+   * transition from inside. Read once on mount; wins over `initialScrollTop`.
+   */
+  scrollToNewInsertion?: boolean;
 }
 
 // Keys handled by the grid itself when a cell is focused; anything else keeps
@@ -226,6 +242,9 @@ export const DataGrid = React.memo(
     totalRows,
     hasMore,
     onCopyAllRows,
+    initialScrollTop,
+    onScrollTopChange,
+    scrollToNewInsertion,
   }: DataGridProps) {
     const { t } = useTranslation();
     const { activeSchema, connections } = useDatabase();
@@ -1391,6 +1410,13 @@ export const DataGrid = React.memo(
       return () => ro.disconnect();
     }, []);
 
+    const handleScroll = useCallback(
+      (e: React.UIEvent<HTMLDivElement>) => {
+        onScrollTopChange?.(e.currentTarget.scrollTop);
+      },
+      [onScrollTopChange],
+    );
+
     // Memoize table data to prevent unnecessary re-renders
     const tableData = useMemo(
       () => mergedRows.map((r) => r.rowData),
@@ -1412,20 +1438,36 @@ export const DataGrid = React.memo(
       overscan: 10,
     });
 
-    // Track insertion count to auto-scroll to bottom when new rows are added
-    const prevInsertionCountRef = useRef(0);
-    useEffect(() => {
-      const insertionCount = pendingInsertions
-        ? Object.keys(pendingInsertions).length
-        : 0;
-      if (
-        insertionCount > prevInsertionCountRef.current &&
-        tableRows.length > 0
-      ) {
-        rowVirtualizer.scrollToIndex(tableRows.length - 1, { align: "end" });
+    // Decide this grid's initial scroll position once, on mount (#823).
+    // scrollToNewInsertion wins outright when set, so a just-inserted row is
+    // always scrolled to instead of a restored offset from before. The ref
+    // guard (rather than an empty dep array) keeps this mount-only while
+    // still declaring its real dependencies. hasRenderedRows holds it off
+    // until the virtualizer has actually rendered rows: on the first commit
+    // it has none, the scroll container's height isn't measured yet, and a
+    // scroll attempted then just clamps to 0.
+    const hasSetInitialScrollRef = useRef(false);
+    const hasRenderedRows = rowVirtualizer.getVirtualItems().length > 0;
+    useLayoutEffect(() => {
+      if (hasSetInitialScrollRef.current || !hasRenderedRows) return;
+      hasSetInitialScrollRef.current = true;
+      if (scrollToNewInsertion) {
+        if (tableRows.length > 0) {
+          rowVirtualizer.scrollToIndex(tableRows.length - 1, { align: "end" });
+        }
+        return;
+      }
+      if (initialScrollTop) {
+        // Through the virtualizer, not the DOM node directly.
+        rowVirtualizer.scrollToOffset(initialScrollTop);
       }
-      prevInsertionCountRef.current = insertionCount;
-    }, [pendingInsertions, tableRows.length, rowVirtualizer]);
+    }, [
+      scrollToNewInsertion,
+      initialScrollTop,
+      tableRows.length,
+      rowVirtualizer,
+      hasRenderedRows,
+    ]);
 
     const handleContextMenu = useCallback(
       (
@@ -2534,6 +2576,7 @@ export const DataGrid = React.memo(
           // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- same focus host: must be reachable with Tab to use the keyboard model
           tabIndex={0}
           onKeyDown={handleGridKeyDown}
+          onScroll={handleScroll}
           className="h-full overflow-auto border border-default rounded bg-elevated relative focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
         >
           <table className="w-full text-left border-collapse">
```

**File**: `src/pages/Editor.tsx` (modified, +44/-0)
```diff
@@ -412,6 +412,15 @@ export const Editor = ({ commandScopeId }: EditorProps) => {
   const isDragging = useRef(false);
   const rafRef = useRef<number | null>(null);
   const editorsRef = useRef<Record<string, Parameters<OnMount>[0]>>({});
+  // DataGrid's scroll offset per tab (#823), kept out of tab/store state:
+  // routing it through updateTab would fire EditorProvider's tabs-changed
+  // effect (which persists via a Tauri invoke) on every scroll pixel.
+  const scrollTopByTabIdRef = useRef<Map<string, number>>(new Map());
+  // Insertion count last seen per tab's DataGrid mount (#823 follow-up).
+  // DataGrid remounts on every pendingInsertions size change, so it can't
+  // detect the transition itself; tracked here so a real new insertion
+  // still auto-scrolls without firing just from switching tabs.
+  const prevInsertionCountByTabIdRef = useRef<Map<string, number>>(new Map());
   const [monacoInstance, setMonacoInstance] = useState<Monaco | null>(null);
 
   const [selectableQueries, setSelectableQueries] = useState<string[]>([]);
@@ -916,6 +925,8 @@ export const Editor = ({ commandScopeId }: EditorProps) => {
     (tabId: string) => {
       requestTabClosure([tabId], () => {
         delete editorsRef.current[tabId];
+        scrollTopByTabIdRef.current.delete(tabId);
+        prevInsertionCountByTabIdRef.current.delete(tabId);
         closeTab(tabId);
       });
     },
@@ -1177,6 +1188,9 @@ export const Editor = ({ commandScopeId }: EditorProps) => {
         pendingInsertions: preservePendingChanges?.pendingInsertions,
         selectedRows: [],
       });
+      // A fresh query's result set can be a different size (or empty), so an
+      // old scroll offset from a larger one shouldn't linger (#823).
+      scrollTopByTabIdRef.current.delete(targetTabId);
 
       const shouldRecordHistory =
         targetTab?.type === "console" || targetTab?.type === "query_builder";
@@ -2546,6 +2560,31 @@ export const Editor = ({ commandScopeId }: EditorProps) => {
     [updateTab],
   );
 
+  const handleScrollTopChange = useCallback((scrollTop: number) => {
+    if (!activeTabIdRef.current) return;
+    // Kept in a plain ref, not tab state — see scrollTopByTabIdRef above.
+    scrollTopByTabIdRef.current.set(activeTabIdRef.current, scrollTop);
+  }, []);
+
+  // See prevInsertionCountByTabIdRef above. Derived at render time, then
+  // committed only after that render lands, so a discarded/retried render
+  // can't desync the two.
+  const activeTabInsertionCount = activeTab?.pendingInsertions
+    ? Object.keys(activeTab.pendingInsertions).length
+    : 0;
+  const scrollToNewInsertion =
+    !!activeTab &&
+    activeTabInsertionCount >
+      (prevInsertionCountByTabIdRef.current.get(activeTab.id) ?? 0);
+  useEffect(() => {
+    if (activeTab) {
+      prevInsertionCountByTabIdRef.current.set(
+        activeTab.id,
+        activeTabInsertionCount,
+      );
+    }
+  }, [activeTab, activeTabInsertionCount]);
+
   const handleDeleteRows = useCallback(() => {
     if (
       !activeTab ||
@@ -5123,6 +5162,11 @@ export const Editor = ({ commandScopeId }: EditorProps) => {
                       totalRows={activeTab.result?.pagination?.total_rows}
                       hasMore={activeTab.result?.pagination?.has_more}
                       onCopyAllRows={handleCopyAllRows}
+                      initialScrollTop={scrollTopByTabIdRef.current.get(
+                        activeTab.id,
+                      )}
+                      onScrollTopChange={handleScrollTopChange}
+                      scrollToNewInsertion={scrollToNewInsertion}
                     />
                   </div>
                   {activeFkQuery && activeConnectionId && (
```

**File**: `tests/components/ui/DataGrid.test.tsx` (modified, +214/-14)
```diff
@@ -20,10 +20,22 @@ vi.mock("../../../src/hooks/useAlert", () => ({
   useAlert: () => ({ showAlert: vi.fn() }),
 }));
 
-const { showToastMock, openRowEditorMock, translationMock } = vi.hoisted(() => ({
+const {
+  showToastMock,
+  openRowEditorMock,
+  translationMock,
+  scrollToIndexMock,
+  scrollToOffsetMock,
+  virtualizerRenderControl,
+} = vi.hoisted(() => ({
   showToastMock: vi.fn(),
   openRowEditorMock: vi.fn(),
   translationMock: vi.fn((key: string) => key),
+  scrollToIndexMock: vi.fn(),
+  scrollToOffsetMock: vi.fn(),
+  // Lets a single test simulate the virtualizer's first, unmeasured commit,
+  // where it has no virtual items yet.
+  virtualizerRenderControl: { forceEmpty: false },
 }));
 
 vi.mock("../../../src/hooks/useToast", () => ({
@@ -69,20 +81,40 @@ vi.mock("@tauri-apps/api/event", () => ({
 }));
 
 // JSDOM has no layout, so the real virtualizer renders zero rows. Mock it to
-// render every row — tests here assert behavior, not virtualization.
+// render every row — tests here assert behavior, not virtualization. Unless
+// virtualizerRenderControl.forceEmpty is set, which simulates the real
+// virtualizer's first, unmeasured commit (no virtual items yet).
 vi.mock("@tanstack/react-virtual", () => ({
-  useVirtualizer: ({ count }: { count: number }) => ({
-    getVirtualItems: () =>
-      Array.from({ length: count }, (_, index) => ({
-        index,
-        key: index,
-        start: index * 35,
-        end: (index + 1) * 35,
-        size: 35,
-      })),
-    getTotalSize: () => count * 35,
-    scrollToIndex: () => {},
-  }),
+  useVirtualizer: ({
+    count,
+    getScrollElement,
+  }: {
+    count: number;
+    getScrollElement: () => HTMLElement | null;
+  }) => {
+    const items = virtualizerRenderControl.forceEmpty
+      ? []
+      : Array.from({ length: count }, (_, index) => ({
+          index,
+          key: index,
+          start: index * 35,
+          end: (index + 1) * 35,
+          size: 35,
+        }));
+    return {
+      getVirtualItems: () => items,
+      getTotalSize: () => count * 35,
+      scrollToIndex: scrollToIndexMock,
+      // The real virtualizer applies the offset to the scroll element
+      // itself, and — like a real, unmeasured browser viewport — clamps it
+      // to 0 when nothing has rendered yet.
+      scrollToOffset: (offset: number) => {
+        scrollToOffsetMock(offset);
+        const el = getScrollElement();
+        if (el) el.scrollTop = items.length > 0 ? offset : 0;
+      },
+    };
+  },
 }));
 
 class ResizeObserverMock {
@@ -1484,3 +1516,171 @@ describe("DataGrid sensitive-column masking (#485)", () => {
     expect(container.querySelector("textarea")).toBeInTheDocument();
   });
 });
+
+describe("DataGrid vertical scroll position across tab switches (#823)", () => {
+  // Editor.tsx keys the <DataGrid> it renders by the active tab's id (plus
+  // sort/filter/result state), so switching tabs fully unmounts the previous
+  // grid and mounts a fresh one for the newly active tab — it does not just
+  // hide it. Editor.tsx is expected to remember the last scrollTop it saw
+  // (via onScrollTopChange) and hand it back as initialScrollTop when the
+  // tab's grid is remounted.
+  it("restores the scrollTop the caller passes back in as initialScrollTop", () => {
+    scrollToOffsetMock.mockClear();
+    const columns = ["id"];
+    const data = Array.from({ length: 200 }, (_, i) => [i]);
+
+    const { container, unmount } = render(
+      <DataGrid
+        columns={columns}
+        data={data}
+        selectedRows={new Set()}
+        onSelectionChange={vi.fn()}
+      />,
+    );
+    const scrollEl = container.querySelector(".overflow-auto") as HTMLElement;
+    expect(scrollEl).not.toBeNull();
+
+    fireEvent.scroll(scrollEl, { target: { scrollTop: 400 } });
+    expect(scrollEl.scrollTop).toBe(400);
+
+    // Simulate switching away and back to this tab: the old grid is gone,
+    // a brand new one is mounted in its place.
+    unmount();
+
+    const { container: container2 } = render(
+      <DataGrid
+        columns={columns}
+        data={data}
+        selectedRows={new Set()}
+        onSelectionChange={vi.fn()}
+        initialScrollTop={400}
+      />,
+    );
+    const scrollEl2 = container2.querySelector(
+      ".overflow-auto",
+    ) as HTMLElement;
+
+    expect(scrollToOffsetMock).toHaveBeenCalledWith(400);
+    expect(scrollEl2.scrollTop).toBe(400);
+  });
+
+  it("reports scroll position changes via onScrollTopChange", () => {
+    const onScrollTopChange = vi.fn();
+    const { container } = render(
+      <DataGrid
+        columns={["id"]}
+        data={Array.from({ length: 200 }, (_, i) => [i])}
+        selectedRows={new Set()}
+        onSelectionChange={vi.fn()}
+        onScrollTopChange={onScrollTopChange}
+      />,
+    );
+    const scrollEl = container.querySelector(".overflow-auto") as HTMLElement;
+
+    fireEvent.scroll(scrollEl, { target: { scrollTop: 250 }
```

---

### Incident Patch 8: `fe4e0c2c` (2026-09-29)
**Commit Message**: Merge pull request #836 from TabularisDB/fix/nightly-publication-concurrency

fix: do not cancel partially published nightlies

**File**: `.github/workflows/nightly.yml` (modified, +4/-1)
```diff
@@ -19,7 +19,10 @@ on:
 
 concurrency:
   group: nightly
-  cancel-in-progress: true
+  # Each platform publishes independently. Finish the current matrix before
+  # the next gate checks its tag, or a scheduled run can cancel the remaining
+  # platforms and then skip because the partially published tag already exists.
+  cancel-in-progress: false
 
 jobs:
   gate:
```

---

### Incident Patch 9: `6d8d4a62` (2026-09-29)
**Commit Message**: fix: finish nightly publication before starting another run

**File**: `.github/workflows/nightly.yml` (modified, +4/-1)
```diff
@@ -19,7 +19,10 @@ on:
 
 concurrency:
   group: nightly
-  cancel-in-progress: true
+  # Each platform publishes independently. Finish the current matrix before
+  # the next gate checks its tag, or a scheduled run can cancel the remaining
+  # platforms and then skip because the partially published tag already exists.
+  cancel-in-progress: false
 
 jobs:
   gate:
```

---

### Incident Patch 10: `8d946249` (2026-09-29)
**Commit Message**: Merge pull request #835 from TabularisDB/fix/nightly-cargo-version

fix: stamp nightly Cargo versions portably on macOS

**File**: `.github/workflows/build.yml` (modified, +5/-14)
```diff
@@ -234,20 +234,11 @@ jobs:
       - name: Override app version (nightly channel)
         if: inputs.updater_version != ''
         shell: bash
-        run: |
-          set -euo pipefail
-          v='${{ inputs.updater_version }}'
-          node -e "const f='src-tauri/tauri.conf.json';const c=require('./'+f);const fs=require('fs');c.version=process.argv[1];fs.writeFileSync(f, JSON.stringify(c, null, 2)+'\n');" "$v"
-          # First version key in Cargo.toml is the [package] version.
-          # sed -i.bak keeps it portable across GNU and macOS BSD sed.
-          sed -i.bak "0,/^version = \".*\"/s//version = \"$v\"/" src-tauri/Cargo.toml && rm -f src-tauri/Cargo.toml.bak
-          # The frontend does not read tauri.conf.json: the About page, the
-          # Updates card and plugin compatibility checks all use the constant
-          # in src/version.ts (kept in sync by scripts/sync-version.js on
-          # release). Patch it too, or a nightly shows the stable version it
-          # was branched from instead of its own.
-          printf 'export const APP_VERSION = "%s";\n' "$v" > src/version.ts
-          echo "Patched version to $v"
+        env:
+          NIGHTLY_VERSION: ${{ inputs.updater_version }}
+        # One portable implementation keeps the bundle, Rust runtime floor
+        # checks and frontend aligned. BSD sed does not support GNU's 0,/.../.
+        run: node scripts/set-nightly-version.mjs "$NIGHTLY_VERSION"
 
       - name: Build signed bundles (+ upload to GitHub Release unless preview)
         if: env.CAN_SIGN == 'true'
```

**File**: `scripts/set-nightly-version.mjs` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+import { readFileSync, writeFileSync } from "node:fs";
+
+const version = process.argv[2];
+if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-(0|[1-9]\d*)$/.test(version ?? "")) {
+  throw new Error("Expected a nightly version with one numeric suffix, e.g. 0.25.1-6");
+}
+
+const configPath = "src-tauri/tauri.conf.json";
+const cargoPath = "src-tauri/Cargo.toml";
+const frontendPath = "src/version.ts";
+const config = JSON.parse(readFileSync(configPath, "utf8"));
+const cargo = readFileSync(cargoPath, "utf8");
+const lines = cargo.split(/\r?\n/);
+const packageStart = lines.findIndex((line) => line.trim() === "[package]");
+if (packageStart < 0) throw new Error("Cargo.toml has no [package] section");
+let packageEnd = lines.findIndex((line, index) => index > packageStart && /^\s*\[/.test(line));
+if (packageEnd < 0) packageEnd = lines.length;
+const versionLines = lines.flatMap((line, index) =>
+  index > packageStart && index < packageEnd && /^\s*version\s*=\s*"[^"]+"/.test(line) ? [index] : [],
+);
+if (versionLines.length !== 1) throw new Error("Expected one literal Cargo package version");
+
+// Validate every input before writing. A BSD/GNU sed mismatch previously left
+// CARGO_PKG_VERSION at the stable version while the app advertised a nightly.
+readFileSync(frontendPath, "utf8");
+config.version = version;
+lines[versionLines[0]] = lines[versionLines[0]].replace(/^(\s*version\s*=\s*)"[^"]+"/, `$1"${version}"`);
+writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
+writeFileSync(cargoPath, lines.join("\n"));
+writeFileSync(frontendPath, `export const APP_VERSION = "${version}";\n`);
+console.log(`Patched Tauri, Cargo and frontend versions to ${version}`);
```

**File**: `tests/scripts/set-nightly-version.test.ts` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+import { execFileSync } from "node:child_process";
+import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join, resolve } from "node:path";
+import { afterEach, describe, expect, it } from "vitest";
+
+const script = resolve("scripts/set-nightly-version.mjs");
+const directories: string[] = [];
+const originalCargo = '[package]\nname = "tabularis"\nversion = "0.25.0"\n\n[dependencies.example]\nversion = "1.2.3"\n';
+
+function fixture(cargo = originalCargo): string {
+  const directory = mkdtempSync(join(tmpdir(), "tabularis-nightly-"));
+  directories.push(directory);
+  mkdirSync(join(directory, "src-tauri"));
+  mkdirSync(join(directory, "src"));
+  writeFileSync(join(directory, "src-tauri/Cargo.toml"), cargo);
+  writeFileSync(join(directory, "src-tauri/tauri.conf.json"), JSON.stringify({ version: "0.25.0", identifier: "tabularis" }));
+  writeFileSync(join(directory, "src/version.ts"), 'export const APP_VERSION = "0.25.0";\n');
+  return directory;
+}
+
+afterEach(() => {
+  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
+});
+
+describe("nightly version stamping", () => {
+  it.each(["\n", "\r\n"])("aligns all three version sources with %j line endings", (ending) => {
+    const directory = fixture(originalCargo.replaceAll("\n", ending));
+    execFileSync(process.execPath, [script, "0.25.1-6"], { cwd: directory });
+    expect(readFileSync(join(directory, "src-tauri/Cargo.toml"), "utf8"))
+      .toBe(originalCargo.replace('version = "0.25.0"', 'version = "0.25.1-6"'));
+    expect(JSON.parse(readFileSync(join(directory, "src-tauri/tauri.conf.json"), "utf8")))
+      .toEqual({ version: "0.25.1-6", identifier: "tabularis" });
+    expect(readFileSync(join(directory, "src/version.ts"), "utf8"))
+      .toBe('export const APP_VERSION = "0.25.1-6";\n');
+  });
+
+  it("fails before writes when Cargo has no literal package version", () => {
+    const directory = fixture('[package]\nname = "tabularis"\nversion.workspace = true\n');
+    expect(() => execFileSync(process.execPath, [script, "0.25.1-6"], { cwd: directory, stdio: "pipe" })).toThrow();
+    expect(JSON.parse(readFileSync(join(directory, "src-tauri/tauri.conf.json"), "utf8")).version).toBe("0.25.0");
+    expect(readFileSync(join(directory, "src/version.ts"), "utf8")).toContain('"0.25.0"');
+  });
+
+  it.each(["0.25.1-nightly.6", "0.25.1", "0.25.1-06", "not-a-version"])("rejects invalid nightly version %s before writes", (version) => {
+    const directory = fixture();
+    expect(() => execFileSync(process.execPath, [script, version], { cwd: directory, stdio: "pipe" })).toThrow();
+    expect(readFileSync(join(directory, "src-tauri/Cargo.toml"), "utf8")).toBe(originalCargo);
+  });
+});
```

---

### Incident Patch 11: `e3a64291` (2026-09-29)
**Commit Message**: fix: address review feedback on DataGrid scroll restore

Replace the mount-only eslint-disable with an explicit hasSetInitialScrollRef
guard, so the effect declares its real dependencies instead of an empty
array. Move the restore into useLayoutEffect and go through
rowVirtualizer.scrollToOffset instead of assigning scrollTop directly, since
it's the virtualizer, not the DOM node, that should own the offset. Trim the
comments this feature added that had grown longer than the rest of the file.

Also gate the restore on the virtualizer having actually rendered rows: on
its first commit it has none, because the scroll container isn't measured
yet, so an earlier attempt just clamps the offset to 0 and the has-run ref
then marks the restore done for good.

**File**: `src/components/ui/DataGrid.tsx` (modified, +31/-29)
```diff
@@ -1,6 +1,7 @@
 import React, {
   useState,
   useEffect,
+  useLayoutEffect,
   useRef,
   useCallback,
   useMemo,
@@ -163,24 +164,18 @@ interface DataGridProps {
   /** Fetches and copies every row of the result set (not just the page). */
   onCopyAllRows?: () => void;
   /**
-   * Vertical scroll position to restore on mount (#823). The caller is
-   * expected to key this DataGrid by tab/result identity, which unmounts
-   * and remounts it on tab switches rather than just hiding it, so the
-   * scroll position has to be handed back in rather than surviving on its
-   * own.
+   * Vertical scroll position to restore on mount (#823). The grid is keyed
+   * by tab/result identity and remounts on tab switches, so this has to be
+   * handed back in rather than surviving on its own.
    */
   initialScrollTop?: number;
   /** Reports the scroll container's scrollTop on every scroll, so the caller can persist it. */
   onScrollTopChange?: (scrollTop: number) => void;
   /**
-   * True when this mount is caused by a genuine new pending insertion (as
-   * opposed to a remount for any other reason, e.g. switching back to a tab
-   * that already had pending insertions). The caller is expected to track
-   * this itself: this grid is keyed by pending-insertion count, so a plain
-   * "did the count go up" check made inside this component would never see
-   * the transition — by the time it could fire, a whole new instance has
-   * already replaced the old one. Read once on mount; takes priority over
-   * `initialScrollTop` so a fresh insert always wins the scroll position.
+   * True when this mount is caused by a genuine new pending insertion, not
+   * just a remount from switching tabs. The caller tracks this itself,
+   * since the grid remounts on insertion-count change and can't see the
+   * transition from inside. Read once on mount; wins over `initialScrollTop`.
    */
   scrollToNewInsertion?: boolean;
 }
@@ -1436,29 +1431,36 @@ export const DataGrid = React.memo(
       overscan: 10,
     });
 
-    // Decide this grid's initial scroll position once, on mount (#823). This
-    // grid is keyed by tab/result identity, so switching tabs — and adding
-    // or removing a pending insertion — unmounts and remounts it rather than
-    // just hiding it; plain browser scroll restore never applies, and a
-    // "count changed since last render" check made in here would never see
-    // the transition, since a fresh instance already exists by the time it
-    // could run. Both values are decided by the caller and read once here:
-    // scrollToNewInsertion wins outright when set, so a just-inserted row
-    // always gets scrolled to and never fights a restored offset that
-    // belonged to the grid's previous mount.
-    useEffect(() => {
+    // Decide this grid's initial scroll position once, on mount (#823).
+    // scrollToNewInsertion wins outright when set, so a just-inserted row is
+    // always scrolled to instead of a restored offset from before. The ref
+    // guard (rather than an empty dep array) keeps this mount-only while
+    // still declaring its real dependencies. hasRenderedRows holds it off
+    // until the virtualizer has actually rendered rows: on the first commit
+    // it has none, the scroll container's height isn't measured yet, and a
+    // scroll attempted then just clamps to 0.
+    const hasSetInitialScrollRef = useRef(false);
+    const hasRenderedRows = rowVirtualizer.getVirtualItems().length > 0;
+    useLayoutEffect(() => {
+      if (hasSetInitialScrollRef.current || !hasRenderedRows) return;
+      hasSetInitialScrollRef.current = true;
       if (scrollToNewInsertion) {
         if (tableRows.length > 0) {
           rowVirtualizer.scrollToIndex(tableRows.length - 1, { align: "end" });
         }
         return;
       }
-      const el = parentRef.current;
-      if (el && initialScrollTop) {
-        el.scrollTop = initialScrollTop;
+      if (initialScrollTop) {
+        // Through the virtualizer, not the DOM node directly.
+        rowVirtualizer.scrollToOffset(initialScrollTop);
       }
-      // eslint-disable-next-line react-hooks/exhaustive-deps
-    }, []);
+    }, [
+      scrollToNewInsertion,
+      initialScrollTop,
+      tableRows.length,
+      rowVirtualizer,
+      hasRenderedRows,
+    ]);
 
     const handleContextMenu = useCallback(
       (
```

**File**: `src/pages/Editor.tsx` (modified, +10/-19)
```diff
@@ -412,21 +412,14 @@ export const Editor = ({ commandScopeId }: EditorProps) => {
   const isDragging = useRef(false);
   const rafRef = useRef<number | null>(null);
   const editorsRef = useRef<Record<string, Parameters<OnMount>[0]>>({});
-  // DataGrid's scroll offset per tab (#823), kept out of tab/store state on
-  // purpose: routing it through updateTab would fire the tabs-changed effect
-  // in EditorProvider (which persists tabs via a Tauri invoke) on every
-  // scroll pixel. This ref survives DataGrid's unmount/remount across tab
-  // switches without ever touching React state.
+  // DataGrid's scroll offset per tab (#823), kept out of tab/store state:
+  // routing it through updateTab would fire EditorProvider's tabs-changed
+  // effect (which persists via a Tauri invoke) on every scroll pixel.
   const scrollTopByTabIdRef = useRef<Map<string, number>>(new Map());
-  // Insertion count last seen for each tab's DataGrid mount (#823 follow-up).
-  // DataGrid is remounted (via its key below) whenever pendingInsertions'
-  // size changes, so its own "did an insertion just happen" check can never
-  // observe a transition — by the time it would fire, a fresh instance
-  // already exists. Tracking the prior count here, outside that remount,
-  // lets a genuine new insertion still auto-scroll to the bottom without
-  // that same logic firing (and fighting the restored scrollTop above) just
-  // because switching back to a tab remounts the grid with insertions it
-  // already had.
+  // Insertion count last seen per tab's DataGrid mount (#823 follow-up).
+  // DataGrid remounts on every pendingInsertions size change, so it can't
+  // detect the transition itself; tracked here so a real new insertion
+  // still auto-scrolls without firing just from switching tabs.
   const prevInsertionCountByTabIdRef = useRef<Map<string, number>>(new Map());
   const [monacoInstance, setMonacoInstance] = useState<Monaco | null>(null);
 
@@ -2573,11 +2566,9 @@ export const Editor = ({ commandScopeId }: EditorProps) => {
     scrollTopByTabIdRef.current.set(activeTabIdRef.current, scrollTop);
   }, []);
 
-  // See prevInsertionCountByTabIdRef above: derive "did this tab just gain a
-  // new pending insertion" from a value read at render time (safe — it's
-  // never mutated during render) and commit the new count only after the
-  // render that used it has actually been committed, so a discarded/retried
-  // render can't desync the two.
+  // See prevInsertionCountByTabIdRef above. Derived at render time, then
+  // committed only after that render lands, so a discarded/retried render
+  // can't desync the two.
   const activeTabInsertionCount = activeTab?.pendingInsertions
     ? Object.keys(activeTab.pendingInsertions).length
     : 0;
```

**File**: `tests/components/ui/DataGrid.test.tsx` (modified, +104/-22)
```diff
@@ -20,13 +20,23 @@ vi.mock("../../../src/hooks/useAlert", () => ({
   useAlert: () => ({ showAlert: vi.fn() }),
 }));
 
-const { showToastMock, openRowEditorMock, translationMock, scrollToIndexMock } =
-  vi.hoisted(() => ({
-    showToastMock: vi.fn(),
-    openRowEditorMock: vi.fn(),
-    translationMock: vi.fn((key: string) => key),
-    scrollToIndexMock: vi.fn(),
-  }));
+const {
+  showToastMock,
+  openRowEditorMock,
+  translationMock,
+  scrollToIndexMock,
+  scrollToOffsetMock,
+  virtualizerRenderControl,
+} = vi.hoisted(() => ({
+  showToastMock: vi.fn(),
+  openRowEditorMock: vi.fn(),
+  translationMock: vi.fn((key: string) => key),
+  scrollToIndexMock: vi.fn(),
+  scrollToOffsetMock: vi.fn(),
+  // Lets a single test simulate the virtualizer's first, unmeasured commit,
+  // where it has no virtual items yet.
+  virtualizerRenderControl: { forceEmpty: false },
+}));
 
 vi.mock("../../../src/hooks/useToast", () => ({
   useToast: () => ({ showToast: showToastMock }),
@@ -71,20 +81,40 @@ vi.mock("@tauri-apps/api/event", () => ({
 }));
 
 // JSDOM has no layout, so the real virtualizer renders zero rows. Mock it to
-// render every row — tests here assert behavior, not virtualization.
+// render every row — tests here assert behavior, not virtualization. Unless
+// virtualizerRenderControl.forceEmpty is set, which simulates the real
+// virtualizer's first, unmeasured commit (no virtual items yet).
 vi.mock("@tanstack/react-virtual", () => ({
-  useVirtualizer: ({ count }: { count: number }) => ({
-    getVirtualItems: () =>
-      Array.from({ length: count }, (_, index) => ({
-        index,
-        key: index,
-        start: index * 35,
-        end: (index + 1) * 35,
-        size: 35,
-      })),
-    getTotalSize: () => count * 35,
-    scrollToIndex: scrollToIndexMock,
-  }),
+  useVirtualizer: ({
+    count,
+    getScrollElement,
+  }: {
+    count: number;
+    getScrollElement: () => HTMLElement | null;
+  }) => {
+    const items = virtualizerRenderControl.forceEmpty
+      ? []
+      : Array.from({ length: count }, (_, index) => ({
+          index,
+          key: index,
+          start: index * 35,
+          end: (index + 1) * 35,
+          size: 35,
+        }));
+    return {
+      getVirtualItems: () => items,
+      getTotalSize: () => count * 35,
+      scrollToIndex: scrollToIndexMock,
+      // The real virtualizer applies the offset to the scroll element
+      // itself, and — like a real, unmeasured browser viewport — clamps it
+      // to 0 when nothing has rendered yet.
+      scrollToOffset: (offset: number) => {
+        scrollToOffsetMock(offset);
+        const el = getScrollElement();
+        if (el) el.scrollTop = items.length > 0 ? offset : 0;
+      },
+    };
+  },
 }));
 
 class ResizeObserverMock {
@@ -1450,6 +1480,7 @@ describe("DataGrid vertical scroll position across tab switches (#823)", () => {
   // (via onScrollTopChange) and hand it back as initialScrollTop when the
   // tab's grid is remounted.
   it("restores the scrollTop the caller passes back in as initialScrollTop", () => {
+    scrollToOffsetMock.mockClear();
     const columns = ["id"];
     const data = Array.from({ length: 200 }, (_, i) => [i]);
 
@@ -1484,6 +1515,7 @@ describe("DataGrid vertical scroll position across tab switches (#823)", () => {
       ".overflow-auto",
     ) as HTMLElement;
 
+    expect(scrollToOffsetMock).toHaveBeenCalledWith(400);
     expect(scrollEl2.scrollTop).toBe(400);
   });
 
@@ -1514,6 +1546,7 @@ describe("DataGrid vertical scroll position across tab switches (#823)", () => {
   // into view, never left below a stale scroll position.
   it("scrolls to the newly inserted row instead of restoring initialScrollTop when both are set", () => {
     scrollToIndexMock.mockClear();
+    scrollToOffsetMock.mockClear();
     const data = Array.from({ length: 200 }, (_, i) => [i]);
 
     const { container } = render(
@@ -1531,14 +1564,17 @@ describe("DataGrid vertical scroll position across tab switches (#823)", () => {
       align: "end",
     });
 
-    // The restore path must not also have run: it directly sets scrollTop,
-    // which would clobber whatever the (mocked) scroll-to-bottom did.
+    // The restore path must not also have run: it goes through
+    // scrollToOffset, which would clobber whatever the (mocked)
+    // scroll-to-bottom did.
+    expect(scrollToOffsetMock).not.toHaveBeenCalled();
     const scrollEl = container.querySelector(".overflow-auto") as HTMLElement;
     expect(scrollEl.scrollTop).toBe(0);
   });
 
   it("restores initialScrollTop when there is no new insertion to scroll to", () => {
     scrollToIndexMock.mockClear();
+    scrollToOffsetMock.mockClear();
     const data = Array.from({ length: 200 }, (_, i) => [i]);
 
     const { container } = render(
@@ -1553,7 +1589,53 @@ describe("DataGrid vertical scroll position across tab switches (#823)", () => {
     );
 
     expect(scrollToIndexMock).not.toHaveBeenCalled();
```

---

### Incident Patch 12: `a998fc0f` (2026-09-29)
**Commit Message**: fix: safely pass nightly version and organize script tests

**File**: `.github/workflows/build.yml` (modified, +3/-1)
```diff
@@ -234,9 +234,11 @@ jobs:
       - name: Override app version (nightly channel)
         if: inputs.updater_version != ''
         shell: bash
+        env:
+          NIGHTLY_VERSION: ${{ inputs.updater_version }}
         # One portable implementation keeps the bundle, Rust runtime floor
         # checks and frontend aligned. BSD sed does not support GNU's 0,/.../.
-        run: node scripts/set-nightly-version.mjs '${{ inputs.updater_version }}'
+        run: node scripts/set-nightly-version.mjs "$NIGHTLY_VERSION"
 
       - name: Build signed bundles (+ upload to GitHub Release unless preview)
         if: env.CAN_SIGN == 'true'
```

---

### Incident Patch 13: `84ac1562` (2026-09-29)
**Commit Message**: fix: stamp nightly Cargo versions portably on macOS

**File**: `.github/workflows/build.yml` (modified, +3/-14)
```diff
@@ -234,20 +234,9 @@ jobs:
       - name: Override app version (nightly channel)
         if: inputs.updater_version != ''
         shell: bash
-        run: |
-          set -euo pipefail
-          v='${{ inputs.updater_version }}'
-          node -e "const f='src-tauri/tauri.conf.json';const c=require('./'+f);const fs=require('fs');c.version=process.argv[1];fs.writeFileSync(f, JSON.stringify(c, null, 2)+'\n');" "$v"
-          # First version key in Cargo.toml is the [package] version.
-          # sed -i.bak keeps it portable across GNU and macOS BSD sed.
-          sed -i.bak "0,/^version = \".*\"/s//version = \"$v\"/" src-tauri/Cargo.toml && rm -f src-tauri/Cargo.toml.bak
-          # The frontend does not read tauri.conf.json: the About page, the
-          # Updates card and plugin compatibility checks all use the constant
-          # in src/version.ts (kept in sync by scripts/sync-version.js on
-          # release). Patch it too, or a nightly shows the stable version it
-          # was branched from instead of its own.
-          printf 'export const APP_VERSION = "%s";\n' "$v" > src/version.ts
-          echo "Patched version to $v"
+        # One portable implementation keeps the bundle, Rust runtime floor
+        # checks and frontend aligned. BSD sed does not support GNU's 0,/.../.
+        run: node scripts/set-nightly-version.mjs '${{ inputs.updater_version }}'
 
       - name: Build signed bundles (+ upload to GitHub Release unless preview)
         if: env.CAN_SIGN == 'true'
```

**File**: `scripts/set-nightly-version.mjs` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+import { readFileSync, writeFileSync } from "node:fs";
+
+const version = process.argv[2];
+if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-(0|[1-9]\d*)$/.test(version ?? "")) {
+  throw new Error("Expected a nightly version with one numeric suffix, e.g. 0.25.1-6");
+}
+
+const configPath = "src-tauri/tauri.conf.json";
+const cargoPath = "src-tauri/Cargo.toml";
+const frontendPath = "src/version.ts";
+const config = JSON.parse(readFileSync(configPath, "utf8"));
+const cargo = readFileSync(cargoPath, "utf8");
+const lines = cargo.split(/\r?\n/);
+const packageStart = lines.findIndex((line) => line.trim() === "[package]");
+if (packageStart < 0) throw new Error("Cargo.toml has no [package] section");
+let packageEnd = lines.findIndex((line, index) => index > packageStart && /^\s*\[/.test(line));
+if (packageEnd < 0) packageEnd = lines.length;
+const versionLines = lines.flatMap((line, index) =>
+  index > packageStart && index < packageEnd && /^\s*version\s*=\s*"[^"]+"/.test(line) ? [index] : [],
+);
+if (versionLines.length !== 1) throw new Error("Expected one literal Cargo package version");
+
+// Validate every input before writing. A BSD/GNU sed mismatch previously left
+// CARGO_PKG_VERSION at the stable version while the app advertised a nightly.
+readFileSync(frontendPath, "utf8");
+config.version = version;
+lines[versionLines[0]] = lines[versionLines[0]].replace(/^(\s*version\s*=\s*)"[^"]+"/, `$1"${version}"`);
+writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
+writeFileSync(cargoPath, lines.join("\n"));
+writeFileSync(frontendPath, `export const APP_VERSION = "${version}";\n`);
+console.log(`Patched Tauri, Cargo and frontend versions to ${version}`);
```

**File**: `tests/utils/nightlyVersion.test.ts` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+import { execFileSync } from "node:child_process";
+import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join, resolve } from "node:path";
+import { afterEach, describe, expect, it } from "vitest";
+
+const script = resolve("scripts/set-nightly-version.mjs");
+const directories: string[] = [];
+const originalCargo = '[package]\nname = "tabularis"\nversion = "0.25.0"\n\n[dependencies.example]\nversion = "1.2.3"\n';
+
+function fixture(cargo = originalCargo): string {
+  const directory = mkdtempSync(join(tmpdir(), "tabularis-nightly-"));
+  directories.push(directory);
+  mkdirSync(join(directory, "src-tauri"));
+  mkdirSync(join(directory, "src"));
+  writeFileSync(join(directory, "src-tauri/Cargo.toml"), cargo);
+  writeFileSync(join(directory, "src-tauri/tauri.conf.json"), JSON.stringify({ version: "0.25.0", identifier: "tabularis" }));
+  writeFileSync(join(directory, "src/version.ts"), 'export const APP_VERSION = "0.25.0";\n');
+  return directory;
+}
+
+afterEach(() => {
+  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
+});
+
+describe("nightly version stamping", () => {
+  it.each(["\n", "\r\n"])("aligns all three version sources with %j line endings", (ending) => {
+    const directory = fixture(originalCargo.replaceAll("\n", ending));
+    execFileSync(process.execPath, [script, "0.25.1-6"], { cwd: directory });
+    expect(readFileSync(join(directory, "src-tauri/Cargo.toml"), "utf8"))
+      .toBe(originalCargo.replace('version = "0.25.0"', 'version = "0.25.1-6"'));
+    expect(JSON.parse(readFileSync(join(directory, "src-tauri/tauri.conf.json"), "utf8")))
+      .toEqual({ version: "0.25.1-6", identifier: "tabularis" });
+    expect(readFileSync(join(directory, "src/version.ts"), "utf8"))
+      .toBe('export const APP_VERSION = "0.25.1-6";\n');
+  });
+
+  it("fails before writes when Cargo has no literal package version", () => {
+    const directory = fixture('[package]\nname = "tabularis"\nversion.workspace = true\n');
+    expect(() => execFileSync(process.execPath, [script, "0.25.1-6"], { cwd: directory, stdio: "pipe" })).toThrow();
+    expect(JSON.parse(readFileSync(join(directory, "src-tauri/tauri.conf.json"), "utf8")).version).toBe("0.25.0");
+    expect(readFileSync(join(directory, "src/version.ts"), "utf8")).toContain('"0.25.0"');
+  });
+
+  it.each(["0.25.1-nightly.6", "0.25.1", "0.25.1-06", "not-a-version"])("rejects invalid nightly version %s before writes", (version) => {
+    const directory = fixture();
+    expect(() => execFileSync(process.execPath, [script, version], { cwd: directory, stdio: "pipe" })).toThrow();
+    expect(readFileSync(join(directory, "src-tauri/Cargo.toml"), "utf8")).toBe(originalCargo);
+  });
+});
```

---

### Incident Patch 14: `a54684c6` (2026-09-29)
**Commit Message**: fix: declare optional query templates in manifest schemas

**File**: `plugins/manifest.schema.json` (modified, +5/-0)
```diff
@@ -163,6 +163,11 @@
           "default": false,
           "description": "true if primary key is defined inline in the column definition (e.g. SQLite AUTOINCREMENT style)."
         },
+        "table_query_templates": {
+          "type": "boolean",
+          "default": false,
+          "description": "Generate SQL SELECT/UPDATE/DELETE previews through the optional get_table_query_template RPC."
+        },
         "alter_column": {
           "type": "boolean",
           "default": false,
```

**File**: `plugins/tabularium-extensions.schema.json` (modified, +5/-0)
```diff
@@ -115,6 +115,11 @@
           "type": "boolean",
           "description": "Primary key is declared inline in the column definition (e.g. SQLite `AUTOINCREMENT`)."
         },
+        "table_query_templates": {
+          "type": "boolean",
+          "default": false,
+          "description": "Generate SQL SELECT/UPDATE/DELETE previews through the optional get_table_query_template RPC."
+        },
         "no_connection_required": {
           "type": "boolean",
           "description": "API-based driver with no host/port/credentials. Hides the connection form entirely."
```

**File**: `tests/utils/tableQueryTemplateSchema.test.ts` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+import { describe, expect, it } from "vitest";
+import manifestSchema from "../../plugins/manifest.schema.json";
+import extensionsSchema from "../../plugins/tabularium-extensions.schema.json";
+
+describe("table query template manifest contract", () => {
+  for (const [name, schema] of Object.entries({ manifestSchema, extensionsSchema })) {
+    it(`declares an optional, default-false capability in ${name}`, () => {
+      const capabilities = schema.properties.capabilities;
+      expect(capabilities.properties.table_query_templates).toMatchObject({
+        type: "boolean",
+        default: false,
+      });
+      if ("required" in capabilities) {
+        expect(capabilities.required).not.toContain("table_query_templates");
+      }
+    });
+  }
+});
```

---

### Incident Patch 15: `61e847b0` (2026-09-29)
**Commit Message**: Merge main and fix PostgreSQL parity template capability

**File**: `.github/workflows/aur.yml` (modified, +76/-20)
```diff
@@ -1,52 +1,108 @@
 name: Publish to AUR
 
+# One PKGBUILD (aur/PKGBUILD), two AUR packages:
+#   * tabularis-bin          stable releases (release published / manual)
+#   * tabularis-nightly-bin  nightlies, called by nightly.yml after the build
+# The channel is derived from the tag: `nightly-*` is nightly, anything else
+# is stable.
 on:
   release:
     types: [published]
+  workflow_call:
+    inputs:
+      tag:
+        description: "Release tag to publish (e.g. v0.25.0 or nightly-20260923-ef21476)."
+        required: true
+        type: string
   workflow_dispatch:
     inputs:
-      version:
-        description: 'Release version (without v prefix, e.g. 0.9.14)'
+      tag:
+        description: "Release tag to publish (e.g. v0.25.0 or nightly-20260923-ef21476)."
         required: true
 
 jobs:
   aur-publish:
-    if: ${{ github.event_name == 'workflow_dispatch' || !github.event.release.prerelease }}
+    # Stable prereleases never reach the AUR. Nightlies are prereleases too,
+    # but they arrive via workflow_call, never via the release event (releases
+    # created with GITHUB_TOKEN don't trigger workflows).
+    if: ${{ github.event_name != 'release' || !github.event.release.prerelease }}
     runs-on: ubuntu-latest
+    permissions:
+      contents: read
     steps:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
 
-      - name: Get Release Version
-        id: version
+      - name: Resolve package metadata
+        id: meta
+        env:
+          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+          GH_REPO: ${{ github.repository }}
+          TAG: ${{ inputs.tag || github.event.release.tag_name }}
+        shell: bash
         run: |
-          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
-            echo "version=${{ github.event.inputs.version }}" >> $GITHUB_OUTPUT
-          else
-            echo "version=${GITHUB_REF_NAME#v}" >> $GITHUB_OUTPUT
+          set -euo pipefail
+
+          # Read the .deb name from the release instead of rebuilding it: a
+          # nightly's tag (nightly-<date>-<sha>) differs from its version.
+          deb=$(gh release view "$TAG" --json assets \
+            --jq '.assets[].name | select(endswith("_amd64.deb"))')
+          if [ -z "$deb" ]; then
+            echo "::error::No _amd64.deb asset on release $TAG"
+            exit 1
           fi
+          gh release download "$TAG" --pattern "$deb" --output app.deb
+          debver="${deb#tabularis_}"
+          debver="${debver%_amd64.deb}"
 
-      - name: Download .deb Artifact
-        run: |
-          wget "https://github.com/${{ github.repository }}/releases/download/v${{ steps.version.outputs.version }}/tabularis_${{ steps.version.outputs.version }}_amd64.deb" -O app.deb
+          if [[ "$TAG" == nightly-* ]]; then
+            pkgname=tabularis-nightly-bin
+            # pacman forbids '-' in pkgver: 0.25.1-2 -> 0.25.1.nightly2
+            pkgver="${debver//-/.nightly}"
+          else
+            pkgname=tabularis-bin
+            pkgver="$debver"
+            if [[ "$pkgver" == *-* ]]; then
+              echo "::error::Stable version $pkgver is a prerelease; refusing to publish it to tabularis-bin"
+              exit 1
+            fi
+          fi
 
-      - name: Calculate SHA256
-        id: shasum
-        run: |
-          echo "sha256=$(sha256sum app.deb | awk '{print $1}')" >> $GITHUB_OUTPUT
+          {
+            echo "tag=$TAG"
+            echo "debver=$debver"
+            echo "pkgname=$pkgname"
+            echo "pkgver=$pkgver"
+            echo "sha256=$(sha256sum app.deb | awk '{print $1}')"
+          } >> "$GITHUB_OUTPUT"
 
       - name: Update PKGBUILD
+        env:
+          PKGNAME: ${{ steps.meta.outputs.pkgname }}
+          PKGVER: ${{ steps.meta.outputs.pkgver }}
+          TAG: ${{ steps.meta.outputs.tag }}
+          DEBVER: ${{ steps.meta.outputs.debver }}
+          SHA256: ${{ steps.meta.outputs.sha256 }}
         run: |
           cd aur
-          sed -i "s/^pkgver=.*/pkgver=${{ steps.version.outputs.version }}/" PKGBUILD
-          sed -i "s/^sha256sums=.*/sha256sums=('${{ steps.shasum.outputs.sha256 }}')/" PKGBUILD
+          sed -i \
+            -e "s/^pkgname=.*/pkgname=${PKGNAME}/" \
+            -e "s/^pkgver=.*/pkgver=${PKGVER}/" \
+            -e "s/^_tag=.*/_tag=${TAG}/" \
+            -e "s/^_debver=.*/_debver=${DEBVER}/" \
+            -e "s/^sha256sums=.*/sha256sums=('${SHA256}')/" \
+            PKGBUILD
+          if [ "$PKGNAME" = "tabularis-nightly-bin" ]; then
+            sed -i 's/^pkgdesc="\(.*\)"$/pkgdesc="\1 (nightly build)"/' PKGBUILD
+          fi
+          cat PKGBUILD
 
       - name: Publish to AUR
         uses: KSXGitHub/github-actions-deploy-aur@084b0d9b15415bf9cdb65d44dad1efe37a354050 # v4.2.0
         with:
-          pkgname: tabularis-bin
+          pkgname: ${{ steps.meta.outputs.pkgname }}
           pkgbuild: ./aur/PKGBUILD
           commit_username: ${{ 
```

**File**: `.github/workflows/nightly.yml` (modified, +12/-2)
```diff
@@ -9,8 +9,9 @@ name: Nightly
 #   * that green commit hasn't already been shipped as a nightly.
 # We build the last GREEN commit (not necessarily main's tip), so a failing or
 # still-running CI never produces a nightly, and a day with no new tested code
-# produces no release. The prerelease flag keeps nightlies out of
-# AUR/Snap/Winget (those gate on !prerelease).
+# produces no release. The prerelease flag keeps nightlies out of Snap/Winget
+# and out of the stable tabularis-bin AUR package (those gate on !prerelease);
+# the `aur` job below publishes them to tabularis-nightly-bin instead.
 on:
   schedule:
     - cron: "0 3 * * *" # 03:00 UTC daily
@@ -158,3 +159,12 @@ jobs:
       # Nightlies double as the daily canary for the sharun-based AppImage
       # format (tauri PR #12491); releases stay on the official bundler.
       experimental_appimage: true
+
+  aur:
+    needs: [gate, build]
+    permissions:
+      contents: read
+    uses: ./.github/workflows/aur.yml
+    secrets: inherit
+    with:
+      tag: ${{ needs.gate.outputs.tag }}
```

**File**: `README.de.md` (modified, +3/-3)
```diff
@@ -74,15 +74,15 @@ Die Benutzeroberfläche der App ist auf Englisch, Italienisch, Spanisch, Chinesi
 | Plugins in **jeder Sprache** (JSON-RPC über stdio) | ✅ | Java-/Eclipse-Plugins | JavaScript-Plugins | ❌ |
 | KI-Text-to-SQL mit **lokalen Modellen** (Ollama) | ✅ | Cloud-basierter KI-Assistent | ❌ | ❌ |
 | Visual EXPLAIN mit interaktiven Plan-Graphen | ✅ | ✅ | ❌ | ❌ |
-| Datenbanken ab Werk | 3 integriert + 15 offizielle Plugins | 100+ | 20+ | ~10 |
+| Datenbanken ab Werk | 3 integriert + 21 offizielle Plugins | 100+ | 20+ | ~10 |
 
 > Vergleich mit Stand Juni 2026; die Funktionen anderer Tools können sich seitdem geändert haben. Wer Dutzende Treiber braucht, ist mit DBeaver besser bedient — tabularis konzentriert sich darauf, wenige Datenbanken gut zu unterstützen.
 
 ### Datenbankunterstützung
 
-PostgreSQL, MySQL/MariaDB und SQLite sind integriert. Alles andere ist ein Plugin — hier siehst du, wo jede Integration heute steht; dies entspricht der [Treiber- & Plugin-Abdeckung](https://tabularis.dev/#driver-coverage) auf der Website.
+PostgreSQL, MySQL/MariaDB und SQLite sind integriert. Der integrierte PostgreSQL-Treiber ist zugunsten des [PostgreSQL-Plugins](https://github.com/TabularisDB/tabularis-postgresql-plugin) veraltet, das Tabularis automatisch installiert. Alles andere ist ein Plugin — hier siehst du, wo jede Integration heute steht; dies entspricht der [Treiber- & Plugin-Abdeckung](https://tabularis.dev/#driver-coverage) auf der Website.
 
-ClickHouse (veröffentlicht), Cloudflare D1 (veröffentlicht), DuckDB (veröffentlicht), Firestore (veröffentlicht), IBM Db2 (veröffentlicht), IBM Informix (veröffentlicht), Redis (veröffentlicht), CSV Folder (veröffentlicht), Google Sheets (veröffentlicht), HackerNews (veröffentlicht), Google BigQuery (übernommen), LibSQL / Turso (übernommen), Meilisearch (übernommen), MongoDB (übernommen), Oracle (übernommen), SQL Server (übernommen), Amazon Redshift (spezifiziert), CockroachDB (spezifiziert), TiDB (spezifiziert), DynamoDB (demnächst), Snowflake (demnächst), Cassandra (offen), Elasticsearch (offen), Etcd (offen), Firebird (offen), ScyllaDB (offen), SQL Anywhere (offen), SurrealDB (offen) und Trino / Presto (offen).
+[ClickHouse](https://github.com/TabularisDB/tabularis-clickhouse-plugin) (veröffentlicht), [Cloudflare D1](https://github.com/josejorge/tabularis_cloudflare_d1_plugin) (veröffentlicht), [Cloudflare D1 (HTTP API)](https://github.com/GabrielMalava/cloudflare-tabularis) (veröffentlicht), [DM / Dameng](https://github.com/haos666/tabularis-dameng-plugin) (veröffentlicht), [DuckDB](https://github.com/TabularisDB/tabularis-duckdb-plugin) (veröffentlicht), [DynamoDB](https://github.com/TabularisDB/tabularis-dynamodb-plugin) (veröffentlicht), [Elasticsearch](https://github.com/TabularisDB/tabularis-elasticsearch-plugin) (veröffentlicht), [Firestore](https://codeberg.org/NewtTheWolf/firestore-tabularis) (veröffentlicht), [IBM Db2](https://github.com/TabularisDB/tabularis-db2-plugin) (veröffentlicht), [IBM Informix](https://github.com/danielnuld/tabularis-informix-plugin) (veröffentlicht), [LibSQL / Turso](https://github.com/TabularisDB/tabularis-libsql-plugin) (veröffentlicht), [MongoDB](https://github.com/danielnuld/tabularis-mongodb-plugin) (veröffentlicht), [MongoDB Atlas](https://github.com/TabularisDB/tabularis-mongodb-plugin) (veröffentlicht), [Oracle](https://github.com/TabularisDB/tabularis-oracle-plugin) (veröffentlicht), [Redis (Go)](https://github.com/gzamboni/tabularis-redis-plugin-go) (veröffentlicht), [Redis (Rust)](https://github.com/nicholas-papachriston/tabularis-redis-plugin) (veröffentlicht), [SQL Server](https://github.com/TabularisDB/tabularis-sqlserver-plugin) (veröffentlicht), [CSV Folder](https://github.com/TabularisDB/tabularis-csv-plugin) (veröffentlicht), [Google Sheets](https://github.com/TabularisDB/tabularis-google-sheets-plugin) (veröffentlicht), [HackerNews](https://github.com/TabularisDB/tabularis-hackernews-plugin) (veröffentlicht), Google BigQuery (übernommen), Meilisearch (übernommen), Amazon Redshift (spezifiziert), CockroachDB (spezifiziert), TiDB (spezifiziert), Snowflake (demnächst), Cassandra (offen), Etcd (offen), Firebird (offen), ScyllaDB (offen), SQL Anywhere (offen), SurrealDB (offen) und Trino / Presto (offen).
 
 > **Veröffentlichte** Treiber lassen sich aus der [Plugin-Registry](https://tabularis.dev/plugins) installieren. Alles andere steht auf dem [Bounty-Board](https://tabularis.dev/plugins/bounties) — übernimm eines, sponsere eines oder [fordere eine Datenbank an](https://github.com/TabularisDB/tabularis/discussions).
 
```

**File**: `README.es.md` (modified, +3/-3)
```diff
@@ -74,15 +74,15 @@ La interfaz de la aplicación está disponible en inglés, italiano, español, c
 | Plugins en **cualquier lenguaje** (JSON-RPC sobre stdio) | ✅ | Plugins Java/Eclipse | Plugins JavaScript | ❌ |
 | Text-to-SQL con IA usando **modelos locales** (Ollama) | ✅ | Asistente de IA en la nube | ❌ | ❌ |
 | EXPLAIN visual con grafos de plan interactivos | ✅ | ✅ | ❌ | ❌ |
-| Bases de datos soportadas de serie | 3 integradas + 15 plugins oficiales | 100+ | 20+ | ~10 |
+| Bases de datos soportadas de serie | 3 integradas + 21 plugins oficiales | 100+ | 20+ | ~10 |
 
 > Comparativa a junio de 2026; las funcionalidades de las otras herramientas pueden haber cambiado desde entonces. Si necesitas decenas de drivers, usa DBeaver — tabularis se centra en hacer bien unas pocas bases de datos.
 
 ### Bases de datos soportadas
 
-PostgreSQL, MySQL/MariaDB y SQLite vienen integradas. Todo lo demás es un plugin — aquí está el estado actual de cada integración, reflejando la [cobertura de drivers y plugins](https://tabularis.dev/#driver-coverage) del sitio web.
+PostgreSQL, MySQL/MariaDB y SQLite vienen integradas. El driver de PostgreSQL integrado está obsoleto en favor del [plugin de PostgreSQL](https://github.com/TabularisDB/tabularis-postgresql-plugin), que Tabularis instala automáticamente. Todo lo demás es un plugin — aquí está el estado actual de cada integración, reflejando la [cobertura de drivers y plugins](https://tabularis.dev/#driver-coverage) del sitio web.
 
-Más allá de las integradas: ClickHouse (disponible), Cloudflare D1 (disponible), DuckDB (disponible), Firestore (disponible), IBM Db2 (disponible), IBM Informix (disponible), Redis (disponible), CSV Folder (disponible), Google Sheets (disponible), HackerNews (disponible), Google BigQuery (reclamado), LibSQL / Turso (reclamado), Meilisearch (reclamado), MongoDB (reclamado), Oracle (reclamado), SQL Server (reclamado), Amazon Redshift (planificado), CockroachDB (planificado), TiDB (planificado), DynamoDB (próximamente), Snowflake (próximamente), Cassandra (abierto), Elasticsearch (abierto), Etcd (abierto), Firebird (abierto), ScyllaDB (abierto), SQL Anywhere (abierto), SurrealDB (abierto) y Trino / Presto (abierto).
+Más allá de las integradas: [ClickHouse](https://github.com/TabularisDB/tabularis-clickhouse-plugin) (disponible), [Cloudflare D1](https://github.com/josejorge/tabularis_cloudflare_d1_plugin) (disponible), [Cloudflare D1 (HTTP API)](https://github.com/GabrielMalava/cloudflare-tabularis) (disponible), [DM / Dameng](https://github.com/haos666/tabularis-dameng-plugin) (disponible), [DuckDB](https://github.com/TabularisDB/tabularis-duckdb-plugin) (disponible), [DynamoDB](https://github.com/TabularisDB/tabularis-dynamodb-plugin) (disponible), [Elasticsearch](https://github.com/TabularisDB/tabularis-elasticsearch-plugin) (disponible), [Firestore](https://codeberg.org/NewtTheWolf/firestore-tabularis) (disponible), [IBM Db2](https://github.com/TabularisDB/tabularis-db2-plugin) (disponible), [IBM Informix](https://github.com/danielnuld/tabularis-informix-plugin) (disponible), [LibSQL / Turso](https://github.com/TabularisDB/tabularis-libsql-plugin) (disponible), [MongoDB](https://github.com/danielnuld/tabularis-mongodb-plugin) (disponible), [MongoDB Atlas](https://github.com/TabularisDB/tabularis-mongodb-plugin) (disponible), [Oracle](https://github.com/TabularisDB/tabularis-oracle-plugin) (disponible), [Redis (Go)](https://github.com/gzamboni/tabularis-redis-plugin-go) (disponible), [Redis (Rust)](https://github.com/nicholas-papachriston/tabularis-redis-plugin) (disponible), [SQL Server](https://github.com/TabularisDB/tabularis-sqlserver-plugin) (disponible), [CSV Folder](https://github.com/TabularisDB/tabularis-csv-plugin) (disponible), [Google Sheets](https://github.com/TabularisDB/tabularis-google-sheets-plugin) (disponible), [HackerNews](https://github.com/TabularisDB/tabularis-hackernews-plugin) (disponible), Google BigQuery (reclamado), Meilisearch (reclamado), Amazon Redshift (planificado), CockroachDB (planificado), TiDB (planificado), Snowflake (próximamente), Cassandra (abierto), Etcd (abierto), Firebird (abierto), ScyllaDB (abierto), SQL Anywhere (abierto), SurrealDB (abierto) y Trino / Presto (abierto).
 
 > Los drivers **disponibles** se instalan desde el [registro de plugins](https://tabularis.dev/plugins). Todo lo demás está en el [tablón de recompensas](https://tabularis.dev/plugins/bounties) — reclama uno, patrocina uno o [solicita una base de datos](https://github.com/TabularisDB/tabularis/discussions).
 
```

**File**: `README.fr.md` (modified, +3/-3)
```diff
@@ -74,15 +74,15 @@ L’interface de l’application est disponible en anglais, italien, espagnol, c
 | Plugins dans **n’importe quel langage** (JSON-RPC sur stdio) | ✅ | Plugins Java/Eclipse | Plugins JavaScript | ❌ |
 | Text-to-SQL par IA avec **modèles locaux** (Ollama) | ✅ | Assistant IA dans le cloud | ❌ | ❌ |
 | EXPLAIN visuel avec graphes de plan interactifs | ✅ | ✅ | ❌ | ❌ |
-| Bases de données prises en charge nativement | 3 intégrées + 15 plugins officiels | 100+ | 20+ | ~10 |
+| Bases de données prises en charge nativement | 3 intégrées + 21 plugins officiels | 100+ | 20+ | ~10 |
 
 > Comparaison datée de juin 2026 ; les fonctionnalités des autres outils ont pu évoluer depuis. Si vous avez besoin de dizaines de drivers, utilisez DBeaver — tabularis se concentre sur bien prendre en charge quelques bases de données.
 
 ### Bases de données prises en charge
 
-PostgreSQL, MySQL/MariaDB et SQLite sont intégrés nativement. Tout le reste est un plugin — voici l’état actuel de chaque intégration, qui reflète la [couverture des drivers et plugins](https://tabularis.dev/#driver-coverage) sur le site web.
+PostgreSQL, MySQL/MariaDB et SQLite sont intégrés nativement. Le driver PostgreSQL intégré est déprécié au profit du [plugin PostgreSQL](https://github.com/TabularisDB/tabularis-postgresql-plugin), que Tabularis installe automatiquement. Tout le reste est un plugin — voici l’état actuel de chaque intégration, qui reflète la [couverture des drivers et plugins](https://tabularis.dev/#driver-coverage) sur le site web.
 
-Au-delà des bases intégrées : ClickHouse (disponible), Cloudflare D1 (disponible), DuckDB (disponible), Firestore (disponible), IBM Db2 (disponible), IBM Informix (disponible), Redis (disponible), CSV Folder (disponible), Google Sheets (disponible), HackerNews (disponible), Google BigQuery (réservé), LibSQL / Turso (réservé), Meilisearch (réservé), MongoDB (réservé), Oracle (réservé), SQL Server (réservé), Amazon Redshift (cadré), CockroachDB (cadré), TiDB (cadré), DynamoDB (bientôt disponible), Snowflake (bientôt disponible), Cassandra (ouvert), Elasticsearch (ouvert), Etcd (ouvert), Firebird (ouvert), ScyllaDB (ouvert), SQL Anywhere (ouvert), SurrealDB (ouvert) et Trino / Presto (ouvert).
+Au-delà des bases intégrées : [ClickHouse](https://github.com/TabularisDB/tabularis-clickhouse-plugin) (disponible), [Cloudflare D1](https://github.com/josejorge/tabularis_cloudflare_d1_plugin) (disponible), [Cloudflare D1 (HTTP API)](https://github.com/GabrielMalava/cloudflare-tabularis) (disponible), [DM / Dameng](https://github.com/haos666/tabularis-dameng-plugin) (disponible), [DuckDB](https://github.com/TabularisDB/tabularis-duckdb-plugin) (disponible), [DynamoDB](https://github.com/TabularisDB/tabularis-dynamodb-plugin) (disponible), [Elasticsearch](https://github.com/TabularisDB/tabularis-elasticsearch-plugin) (disponible), [Firestore](https://codeberg.org/NewtTheWolf/firestore-tabularis) (disponible), [IBM Db2](https://github.com/TabularisDB/tabularis-db2-plugin) (disponible), [IBM Informix](https://github.com/danielnuld/tabularis-informix-plugin) (disponible), [LibSQL / Turso](https://github.com/TabularisDB/tabularis-libsql-plugin) (disponible), [MongoDB](https://github.com/danielnuld/tabularis-mongodb-plugin) (disponible), [MongoDB Atlas](https://github.com/TabularisDB/tabularis-mongodb-plugin) (disponible), [Oracle](https://github.com/TabularisDB/tabularis-oracle-plugin) (disponible), [Redis (Go)](https://github.com/gzamboni/tabularis-redis-plugin-go) (disponible), [Redis (Rust)](https://github.com/nicholas-papachriston/tabularis-redis-plugin) (disponible), [SQL Server](https://github.com/TabularisDB/tabularis-sqlserver-plugin) (disponible), [CSV Folder](https://github.com/TabularisDB/tabularis-csv-plugin) (disponible), [Google Sheets](https://github.com/TabularisDB/tabularis-google-sheets-plugin) (disponible), [HackerNews](https://github.com/TabularisDB/tabularis-hackernews-plugin) (disponible), Google BigQuery (réservé), Meilisearch (réservé), Amazon Redshift (cadré), CockroachDB (cadré), TiDB (cadré), Snowflake (bientôt disponible), Cassandra (ouvert), Etcd (ouvert), Firebird (ouvert), ScyllaDB (ouvert), SQL Anywhere (ouvert), SurrealDB (ouvert) et Trino / Presto (ouvert).
 
 > Les drivers **Disponibles** sont installables depuis le [registre des plugins](https://tabularis.dev/plugins). Tout le reste se trouve sur le [tableau des primes](https://tabularis.dev/plugins/bounties) — réservez-en un, sponsorisez-en un, ou [demandez une base de données](https://github.com/TabularisDB/tabularis/discussions).
 
```

**File**: `README.it.md` (modified, +3/-3)
```diff
@@ -74,15 +74,15 @@ L’interfaccia dell’app è disponibile in inglese, italiano, spagnolo, cinese
 | Plugin in **qualsiasi linguaggio** (JSON-RPC su stdio) | ✅ | Plugin Java/Eclipse | Plugin JavaScript | ❌ |
 | Text-to-SQL AI con **modelli locali** (Ollama) | ✅ | Assistente AI basato su cloud | ❌ | ❌ |
 | Visual EXPLAIN con grafi interattivi del piano | ✅ | ✅ | ❌ | ❌ |
-| Database supportati nativamente | 3 nativi + 15 plugin ufficiali | 100+ | 20+ | ~10 |
+| Database supportati nativamente | 3 nativi + 21 plugin ufficiali | 100+ | 20+ | ~10 |
 
 > Confronto aggiornato a giugno 2026; le funzionalità degli altri strumenti potrebbero essere cambiate nel frattempo. Se ti servono decine di driver, usa DBeaver — tabularis si concentra sul supportare bene pochi database.
 
 ### Database supportati
 
-PostgreSQL, MySQL/MariaDB e SQLite sono integrati nativamente. Tutto il resto è un plugin — ecco a che punto è oggi ogni integrazione, rispecchiando la [copertura driver & plugin](https://tabularis.dev/#driver-coverage) sul sito.
+PostgreSQL, MySQL/MariaDB e SQLite sono integrati nativamente. Il driver PostgreSQL integrato è deprecato in favore del [plugin PostgreSQL](https://github.com/TabularisDB/tabularis-postgresql-plugin), che Tabularis installa automaticamente. Tutto il resto è un plugin — ecco a che punto è oggi ogni integrazione, rispecchiando la [copertura driver & plugin](https://tabularis.dev/#driver-coverage) sul sito.
 
-ClickHouse (disponibile), Cloudflare D1 (disponibile), DuckDB (disponibile), Firestore (disponibile), IBM Db2 (disponibile), IBM Informix (disponibile), Redis (disponibile), CSV Folder (disponibile), Google Sheets (disponibile), HackerNews (disponibile), Google BigQuery (assegnato), LibSQL / Turso (assegnato), Meilisearch (assegnato), MongoDB (assegnato), Oracle (assegnato), SQL Server (assegnato), Amazon Redshift (definito), CockroachDB (definito), TiDB (definito), DynamoDB (in arrivo), Snowflake (in arrivo), Cassandra (aperto), Elasticsearch (aperto), Etcd (aperto), Firebird (aperto), ScyllaDB (aperto), SQL Anywhere (aperto), SurrealDB (aperto), Trino / Presto (aperto).
+[ClickHouse](https://github.com/TabularisDB/tabularis-clickhouse-plugin) (disponibile), [Cloudflare D1](https://github.com/josejorge/tabularis_cloudflare_d1_plugin) (disponibile), [Cloudflare D1 (HTTP API)](https://github.com/GabrielMalava/cloudflare-tabularis) (disponibile), [DM / Dameng](https://github.com/haos666/tabularis-dameng-plugin) (disponibile), [DuckDB](https://github.com/TabularisDB/tabularis-duckdb-plugin) (disponibile), [DynamoDB](https://github.com/TabularisDB/tabularis-dynamodb-plugin) (disponibile), [Elasticsearch](https://github.com/TabularisDB/tabularis-elasticsearch-plugin) (disponibile), [Firestore](https://codeberg.org/NewtTheWolf/firestore-tabularis) (disponibile), [IBM Db2](https://github.com/TabularisDB/tabularis-db2-plugin) (disponibile), [IBM Informix](https://github.com/danielnuld/tabularis-informix-plugin) (disponibile), [LibSQL / Turso](https://github.com/TabularisDB/tabularis-libsql-plugin) (disponibile), [MongoDB](https://github.com/danielnuld/tabularis-mongodb-plugin) (disponibile), [MongoDB Atlas](https://github.com/TabularisDB/tabularis-mongodb-plugin) (disponibile), [Oracle](https://github.com/TabularisDB/tabularis-oracle-plugin) (disponibile), [Redis (Go)](https://github.com/gzamboni/tabularis-redis-plugin-go) (disponibile), [Redis (Rust)](https://github.com/nicholas-papachriston/tabularis-redis-plugin) (disponibile), [SQL Server](https://github.com/TabularisDB/tabularis-sqlserver-plugin) (disponibile), [CSV Folder](https://github.com/TabularisDB/tabularis-csv-plugin) (disponibile), [Google Sheets](https://github.com/TabularisDB/tabularis-google-sheets-plugin) (disponibile), [HackerNews](https://github.com/TabularisDB/tabularis-hackernews-plugin) (disponibile), Google BigQuery (assegnato), Meilisearch (assegnato), Amazon Redshift (definito), CockroachDB (definito), TiDB (definito), Snowflake (in arrivo), Cassandra (aperto), Etcd (aperto), Firebird (aperto), ScyllaDB (aperto), SQL Anywhere (aperto), SurrealDB (aperto), Trino / Presto (aperto).
 
 > I driver **Disponibili** sono installabili dal [registro dei plugin](https://tabularis.dev/plugins). Tutto il resto è sulla [bacheca delle taglie](https://tabularis.dev/plugins/bounties) — prendine una in carico, sponsorizzala o [richiedi un database](https://github.com/TabularisDB/tabularis/discussions).
 
```

**File**: `README.ja.md` (modified, +3/-3)
```diff
@@ -74,15 +74,15 @@ sudo snap install tabularis                                      # Linux
 | **任意の言語**でプラグイン開発（stdio 経由の JSON-RPC） | ✅ | Java/Eclipse プラグイン | JavaScript プラグイン | ❌ |
 | **ローカルモデル**（Ollama）対応の AI テキストから SQL 変換 | ✅ | クラウドベースの AI アシスタント | ❌ | ❌ |
 | インタラクティブなプラングラフ付き Visual EXPLAIN | ✅ | ✅ | ❌ | ❌ |
-| 標準対応データベース数 | 標準搭載 3 + 公式プラグイン 15 | 100+ | 20+ | 約 10 |
+| 標準対応データベース数 | 標準搭載 3 + 公式プラグイン 21 | 100+ | 20+ | 約 10 |
 
 > 比較は 2026 年 6 月時点のものです。他ツールの機能はその後変わっている可能性があります。数十のドライバーが必要な場合は DBeaver を使ってください。tabularis は、少数のデータベースをしっかりサポートすることに注力しています。
 
 ### 対応データベース
 
-PostgreSQL、MySQL/MariaDB、SQLite は標準搭載されています。それ以外はすべてプラグインです。ここでは各インテグレーションの現状を、ウェブサイトの[ドライバー＆プラグイン対応状況](https://tabularis.dev/#driver-coverage)に合わせて示します。
+PostgreSQL、MySQL/MariaDB、SQLite は標準搭載されています。標準搭載の PostgreSQL ドライバーは非推奨となり、Tabularis が自動でインストールする [PostgreSQL プラグイン](https://github.com/TabularisDB/tabularis-postgresql-plugin)に置き換えられます。それ以外はすべてプラグインです。ここでは各インテグレーションの現状を、ウェブサイトの[ドライバー＆プラグイン対応状況](https://tabularis.dev/#driver-coverage)に合わせて示します。
 
-ClickHouse（提供中）、Cloudflare D1（提供中）、DuckDB（提供中）、Firestore（提供中）、IBM Db2（提供中）、IBM Informix（提供中）、Redis（提供中）、CSV Folder（提供中）、Google Sheets（提供中）、HackerNews（提供中）、Google BigQuery（担当者決定）、LibSQL / Turso（担当者決定）、Meilisearch（担当者決定）、MongoDB（担当者決定）、Oracle（担当者決定）、SQL Server（担当者決定）、Amazon Redshift（計画策定済み）、CockroachDB（計画策定済み）、TiDB（計画策定済み）、DynamoDB（近日対応）、Snowflake（近日対応）、Cassandra（募集中）、Elasticsearch（募集中）、Etcd（募集中）、Firebird（募集中）、ScyllaDB（募集中）、SQL Anywhere（募集中）、SurrealDB（募集中）、Trino / Presto（募集中）。
+[ClickHouse](https://github.com/TabularisDB/tabularis-clickhouse-plugin)（提供中）、[Cloudflare D1](https://github.com/josejorge/tabularis_cloudflare_d1_plugin)（提供中）、[Cloudflare D1 (HTTP API)](https://github.com/GabrielMalava/cloudflare-tabularis)（提供中）、[DM / Dameng](https://github.com/haos666/tabularis-dameng-plugin)（提供中）、[DuckDB](https://github.com/TabularisDB/tabularis-duckdb-plugin)（提供中）、[DynamoDB](https://github.com/TabularisDB/tabularis-dynamodb-plugin)（提供中）、[Elasticsearch](https://github.com/TabularisDB/tabularis-elasticsearch-plugin)（提供中）、[Firestore](https://codeberg.org/NewtTheWolf/firestore-tabularis)（提供中）、[IBM Db2](https://github.com/TabularisDB/tabularis-db2-plugin)（提供中）、[IBM Informix](https://github.com/danielnuld/tabularis-informix-plugin)（提供中）、[LibSQL / Turso](https://github.com/TabularisDB/tabularis-libsql-plugin)（提供中）、[MongoDB](https://github.com/danielnuld/tabularis-mongodb-plugin)（提供中）、[MongoDB Atlas](https://github.com/TabularisDB/tabularis-mongodb-plugin)（提供中）、[Oracle](https://github.com/TabularisDB/tabularis-oracle-plugin)（提供中）、[Redis (Go)](https://github.com/gzamboni/tabularis-redis-plugin-go)（提供中）、[Redis (Rust)](https://github.com/nicholas-papachriston/tabularis-redis-plugin)（提供中）、[SQL Server](https://github.com/TabularisDB/tabularis-sqlserver-plugin)（提供中）、[CSV Folder](https://github.com/TabularisDB/tabularis-csv-plugin)（提供中）、[Google Sheets](https://github.com/TabularisDB/tabularis-google-sheets-plugin)（提供中）、[HackerNews](https://github.com/TabularisDB/tabularis-hackernews-plugin)（提供中）、Google BigQuery（担当者決定）、Meilisearch（担当者決定）、Amazon Redshift（計画策定済み）、CockroachDB（計画策定済み）、TiDB（計画策定済み）、Snowflake（近日対応）、Cassandra（募集中）、Etcd（募集中）、Firebird（募集中）、ScyllaDB（募集中）、SQL Anywhere（募集中）、SurrealDB（募集中）、Trino / Presto（募集中）。
 
 > **提供中**のドライバーは[プラグインレジストリ](https://tabularis.dev/plugins)からインストールできます。それ以外は[バウンティボード](https://tabularis.dev/plugins/bounties)に掲載されています。担当する、スポンサーになる、または[データベースをリクエスト](https://github.com/TabularisDB/tabularis/discussions)してください。
 
```

**File**: `README.ko.md` (modified, +3/-3)
```diff
@@ -74,15 +74,15 @@ sudo snap install tabularis                                      # Linux
 | **모든 언어**로 작성 가능한 플러그인 (stdio 기반 JSON-RPC) | ✅ | Java/Eclipse 플러그인 | JavaScript 플러그인 | ❌ |
 | **로컬 모델**(Ollama)을 사용하는 AI text-to-SQL | ✅ | 클라우드 기반 AI 어시스턴트 | ❌ | ❌ |
 | 인터랙티브 플랜 그래프가 있는 Visual EXPLAIN | ✅ | ✅ | ❌ | ❌ |
-| 기본 제공 데이터베이스 | 내장 3종 + 공식 플러그인 15종 | 100종 이상 | 20종 이상 | 약 10종 |
+| 기본 제공 데이터베이스 | 내장 3종 + 공식 플러그인 21종 | 100종 이상 | 20종 이상 | 약 10종 |
 
 > 2026년 6월 기준 비교이며, 다른 도구의 기능은 이후 변경되었을 수 있습니다. 수십 종의 드라이버가 필요하다면 DBeaver를 사용하세요 — tabularis는 소수의 데이터베이스를 제대로 지원하는 데 집중합니다.
 
 ### 데이터베이스 지원
 
-PostgreSQL, MySQL/MariaDB, SQLite는 기본 내장되어 있습니다. 그 외 모든 것은 플러그인이며, 웹사이트의 [드라이버 및 플러그인 커버리지](https://tabularis.dev/#driver-coverage)를 반영해 각 통합의 현재 상태를 아래에 정리했습니다.
+PostgreSQL, MySQL/MariaDB, SQLite는 기본 내장되어 있습니다. 내장 PostgreSQL 드라이버는 더 이상 권장되지 않으며, Tabularis가 자동으로 설치하는 [PostgreSQL 플러그인](https://github.com/TabularisDB/tabularis-postgresql-plugin)으로 대체됩니다. 그 외 모든 것은 플러그인이며, 웹사이트의 [드라이버 및 플러그인 커버리지](https://tabularis.dev/#driver-coverage)를 반영해 각 통합의 현재 상태를 아래에 정리했습니다.
 
-ClickHouse (출시됨), Cloudflare D1 (출시됨), DM / Dameng (출시됨), DuckDB (출시됨), Firestore (출시됨), IBM Db2 (출시됨), IBM Informix (출시됨), Redis (출시됨), CSV Folder (출시됨), Google Sheets (출시됨), HackerNews (출시됨), Google BigQuery (예정), LibSQL / Turso (예정), Meilisearch (예정), MongoDB (예정), Oracle (예정), SQL Server (예정), Amazon Redshift (계획됨), CockroachDB (계획됨), TiDB (계획됨), DynamoDB (곧 출시), Snowflake (곧 출시), Cassandra (오픈), Elasticsearch (오픈), Etcd (오픈), Firebird (오픈), ScyllaDB (오픈), SQL Anywhere (오픈), SurrealDB (오픈), Trino / Presto (오픈).
+[ClickHouse](https://github.com/TabularisDB/tabularis-clickhouse-plugin) (출시됨), [Cloudflare D1](https://github.com/josejorge/tabularis_cloudflare_d1_plugin) (출시됨), [Cloudflare D1 (HTTP API)](https://github.com/GabrielMalava/cloudflare-tabularis) (출시됨), [DM / Dameng](https://github.com/haos666/tabularis-dameng-plugin) (출시됨), [DuckDB](https://github.com/TabularisDB/tabularis-duckdb-plugin) (출시됨), [DynamoDB](https://github.com/TabularisDB/tabularis-dynamodb-plugin) (출시됨), [Elasticsearch](https://github.com/TabularisDB/tabularis-elasticsearch-plugin) (출시됨), [Firestore](https://codeberg.org/NewtTheWolf/firestore-tabularis) (출시됨), [IBM Db2](https://github.com/TabularisDB/tabularis-db2-plugin) (출시됨), [IBM Informix](https://github.com/danielnuld/tabularis-informix-plugin) (출시됨), [LibSQL / Turso](https://github.com/TabularisDB/tabularis-libsql-plugin) (출시됨), [MongoDB](https://github.com/danielnuld/tabularis-mongodb-plugin) (출시됨), [MongoDB Atlas](https://github.com/TabularisDB/tabularis-mongodb-plugin) (출시됨), [Oracle](https://github.com/TabularisDB/tabularis-oracle-plugin) (출시됨), [Redis (Go)](https://github.com/gzamboni/tabularis-redis-plugin-go) (출시됨), [Redis (Rust)](https://github.com/nicholas-papachriston/tabularis-redis-plugin) (출시됨), [SQL Server](https://github.com/TabularisDB/tabularis-sqlserver-plugin) (출시됨), [CSV Folder](https://github.com/TabularisDB/tabularis-csv-plugin) (출시됨), [Google Sheets](https://github.com/TabularisDB/tabularis-google-sheets-plugin) (출시됨), [HackerNews](https://github.com/TabularisDB/tabularis-hackernews-plugin) (출시됨), Google BigQuery (예정), Meilisearch (예정), Amazon Redshift (계획됨), CockroachDB (계획됨), TiDB (계획됨), Snowflake (곧 출시), Cassandra (오픈), Etcd (오픈), Firebird (오픈), ScyllaDB (오픈), SQL Anywhere (오픈), SurrealDB (오픈), Trino / Presto (오픈).
 
 > **출시됨** 상태의 드라이버는 [플러그인 레지스트리](https://tabularis.dev/plugins)에서 설치할 수 있습니다. 그 외 모든 것은 [바운티 보드](https://tabularis.dev/plugins/bounties)에 있습니다 — 직접 맡거나, 후원하거나, [데이터베이스를 요청](https://github.com/TabularisDB/tabularis/discussions)하세요.
 
```

#### Recent Merged Pull Requests:
- **PR #843** (2026-10-01): chore(release): prepare v0.26.0 (@debba)
- **PR #842** (2026-10-01): feat(plugins): send a cancel notification to the plugin on call timeout (@debba)
- **PR #838** (2026-10-01): fix: keep scroll position of grids in multi-result panel (@drakeo338)
- **PR #836** (2026-09-29): fix: do not cancel partially published nightlies (@debba)
- **PR #835** (2026-09-29): fix: stamp nightly Cargo versions portably on macOS (@debba)
- **PR #834** (2026-09-29): feat(autocomplete): harden nearest-table ranking edge cases and quoted identifiers (@debba)
- **PR #833** (2026-10-01): feat(plugins): configurable plugin call timeout with per-plugin override (@debba)
- **PR #831** (2026-09-29): fix: restore DataGrid scroll position across tab switches (@drakeo338)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
