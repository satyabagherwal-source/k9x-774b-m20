# Forensic Learning Record (Deep Inspection): t8y2/dbx

> **Canonical Artifact**: `07_PROJECT_LEARNING/t8y2-dbx-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/t8y2/dbx](https://github.com/t8y2/dbx))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:41:09.553Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `t8y2/dbx`
- **Description**: 25 MB lightweight cross-platform database client for 100+ databases, including MySQL, PostgreSQL, SQLite, Redis, MongoDB, DuckDB, SQL Server, and Dameng. Built-in AI, MCP Server, CLI, desktop and Docker. | 轻量级跨平台数据库管理工具，支持 MySQL、PostgreSQL、SQLite、Redis、MongoDB、达梦等 100+ 数据库，提供桌面端、Docker、CLI、内置 AI 助手和 MCP。
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 24758 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agents/drivers/tdengine/src/config.rs`
```
use anyhow::{bail, Context, Result};
use percent_encoding::percent_decode_str;
use std::net::IpAddr;
use url::Url;

use crate::model::ConnectParams;

const DEFAULT_HOST: &str = "127.0.0.1";
const DEFAULT_PORT: u16 = 6041;
const DEFAULT_USER: &str = "root";
const DEFAULT_PASSWORD: &str = "taosdata";

#[derive(Debug)]
pub struct BuiltDsn {
    pub value: String,
    pub database: String,
}

pub fn build_dsn(params: &ConnectParams) -> Result<BuiltDsn> {
    if !params.client_cert_path.trim().is_empty() || !params.client_key_path.trim().is_empty() {
        bail!("TDengine Rust WebSocket connector does not support client certificate authentication");
    }

    let mut url = if params.connection_string.trim().is_empty() {
        build_from_fields(params)?
    } else {
        normalize_connection_string(params.connection_string.trim(), params.ssl)?
    };

    apply_connection_fields(&mut url, params)?;
    merge_query_params(&mut url, &params.url_params);
    if (params.ssl || !params.ca_cert_path.trim().is_empty()) && url.scheme() == "ws" {
        url.set_scheme("wss").map_err(|_| anyhow::anyhow!("failed to enable TLS in TDengine connection URL"))?;
    }
    if !params.ca_cert_path.trim().is_empty() {
        set_query_param(&mut url, "tls_mode", "verify_identity");
        set_query_param(&mut url, "tls_ca", params.ca_cert_path.trim());
    }
    let database = url
        .path_segments()
        .and_then(|mut segments| segments.find(|segment| !segment.is_empty()))
        .map(|segment| percent_decode_str(segment).decode_utf8_lossy().into_owned())
        .unwrap_or_default();
    Ok(BuiltDsn { value: url.into(), database })
}

fn build_from_fields(params: &ConnectParams) -> Result<Url> {
    let scheme = if params.ssl { "wss" } else { "ws" };
    let host = if params.host.trim().is_empty() { DEFAULT_HOST } else { params.host.trim() };
    let port = if params.port == 0 { DEFAULT_PORT } else { params.port };
    let username = if params.username.is_empty() { DEFAULT_USER } else { &params.username };
    let password = if params.password.is_empty() { DEFAULT_PASSWORD } else { &params.password };
    let mut url = Url::parse(&format!("{scheme}://{DEFAULT_HOST}:{port}/"))?;
    if let Ok(address) = host.parse::<IpAddr>() {
        url.set_ip_host(address).map_err(|_| anyhow::anyhow!("invalid TDengine host"))?;
    } else {
        url.set_host(Some(host)).map_err(|_| anyhow::anyhow!("invalid TDengine host"))?;
    }
    url.set_username(username).map_err(|_| anyhow::anyhow!("invalid TDengine username"))?;
    url.set_password(Some(password)).map_err(|_| anyhow::anyhow!("invalid TDengine password"))?;
    if !params.database.trim().is_empty() {
        url.set_path(&format!("/{}", params.database.trim()));
    }
    Ok(url)
}

fn apply_connection_fields(url: &mut Url, params: &ConnectParams) -> Result<()> {
    if url.username().is_empty() {
        let username = if params.username.is_empty() { DEFAULT_USER } else { &params.username };
        url.set_username(username).map_err(|_| anyhow::anyhow!("invalid TDengine username"))?;
    }
    if url.password().is_none() {
        let password = if params.password.is_empty() { DEFAULT_PASSWORD } else { &params.password };
        url.set_password(Some(password)).map_err(|_| anyhow::anyhow!("invalid TDengine password"))?;
    }
    if url.path().trim_matches('/').is_empty() && !params.database.trim().is_empty() {
        url.set_path(&format!("/{}", params.database.trim()));
    }
    Ok(())
}

fn normalize_connection_string(raw: &str, ssl: bool) -> Result<Url> {
    let trimmed = raw.trim();
    let normalized = if let Some(value) = strip_prefix_ignore_ascii_case(trimmed, "jdbc:TAOS-WS://") {
        format!("{}://{value}", if ssl { "wss" } else { "ws" })
    } else if let Some(value) = strip_prefix_ignore_ascii_case(trimmed, "jdbc:TAOS-RS://") {
        format!("{}://{value}", if ssl { "wss" } else { "ws" })
    } else if let Some(value) = strip_prefix_ignore_ascii_case(trimmed, "tdengine://") {
        format!("{}://{value}", if ssl { "wss" } else { "ws" })
    } else if let Some(value) = strip_prefix_ignore_ascii_case(trimmed, "taosws://") {
        format!("{}://{value}", if ssl { "wss" } else { "ws" })
    } else if let Some(value) = strip_prefix_ignore_ascii_case(trimmed, "taoswss://") {
        format!("wss://{value}")
    } else {
        trimmed.to_string()
    };
    let mut url = Url::parse(&normalized).with_context(|| "invalid TDengine connection string")?;
    if !matches!(url.scheme(), "ws" | "wss" | "http" | "https") {
        bail!("TDengine native agent supports only WebSocket connection strings");
    }
    if matches!(url.scheme(), "http") {
        url.set_scheme("ws").map_err(|_| anyhow::anyhow!("invalid TDengine HTTP connection string"))?;
    } else if matches!(url.scheme(), "https") {
        url.set_scheme("wss").map_err(|_| anyhow::anyhow!("invalid TDengine HTTPS connection string"))?;
    }
    remove_control_params(&mut url);
    Ok(url)
}

fn merge_query_params(url: &mut Url, raw: &str) {
    let raw = raw.trim().trim_start_matches('?');
    if raw.is_empty() {
        return;
    }
    let additions = url::form_urlencoded::parse(raw.as_bytes())
        .filter(|(key, _)| !is_control_param(key))
        .map(|(key, value)| (key.into_owned(), value.into_owned()))
        .collect::<Vec<_>>();
    let mut query = url.query_pairs_mut();
    for (key, value) in additions {
        query.append_pair(&key, &value);
    }
}

fn remove_control_params(url: &mut Url) {
    let kept = url
        .query_pairs()
        .filter(|(key, _)| !is_control_param(key))
        .map(|(key, value)| (key.into_owned(), value.into_owned()))
        .collect::<Vec<_>>();
    url.set_query(None);
    if kept.is_empty() {
        return;
    }
    let mut query = url.query_pairs_mut();
    for (key, value) in kept {
        query.append_pair(&key, &value);
    }
}

fn set_query_param(url: &mut Url, key: &str, value: &str) {
    let mut pairs = url
        .query_pairs()
        .filter(|(existing, _)| !existing.eq_ignore_ascii_case(key))
        .map(|(existing, value)| (existing.into_owned(), value.into_owned()))
        .collect::<Vec<_>>();
    pairs.push((key.to_string(), value.to_string()));
    url.set_query(None);
    let mut query = url.query_pairs_mut();
    for (key, value) in pairs {
        query.append_pair(&key, &value);
    }
}

fn is_control_param(key: &str) -> bool {
    key.eq_ignore_ascii_case("transport") || key.eq_ignore_ascii_case("dbx.transport")
}

fn strip_prefix_ignore_ascii_case<'a>(value: &'a str, prefix: &str) -> Option<&'a str> {
    value.get(..prefix.len()).filter(|head| head.eq_ignore_ascii_case(prefix))?;
    value.get(prefix.len()..)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_ws_dsn_from_connection_fields() {
        let dsn = build_dsn(&ConnectParams {
            host: "db.example.com".into(),
            port: 6041,
            database: "power_data".into(),
            username: "root".into(),
            password: "secret".into(),
            url_params: "timezone=UTC&dbx.transport=rest".into(),
            ..Default::default()
        })
        .unwrap();
        assert_eq!(dsn.value, "ws://root:secret@db.example.com:6041/power_data?timezone=UTC");
        assert_eq!(dsn.database, "power_data");
    }

    #[test]
    fn accepts_legacy_jdbc_urls_without_transport_controls() {
        let dsn = build_dsn(&ConnectParams {
            connection_string: "jdbc:TAOS-WS://127.0.0.1:6041/db?transport=ws&timezone=UTC".into(),
            ..Default::default()
        })
        .unwrap();
        assert_eq!(dsn.value, "ws://root:taosdata@127.0.0.1:6041/db?timezone=UTC");
        assert_eq!(dsn.database, "db");
    }

    #[test]
    fn fills_connection_string_credentials_and_database_from_fields() {
        let dsn = build_dsn(&ConnectParams {
            username: "reader".into(),
            password: "secret".into(),
            database: "metrics".into(),
            connection_string: "jdbc:TAOS-WS://td.example.com:6041?transport=ws".into(),
            ..Default::default()
        })
        .unwrap();
        assert_eq!(dsn.value, "ws://reader:secret@td.example.com:6041/metrics");
        assert_eq!(dsn.database, "metrics");
    }

    #[test]
    fn preserves_explicit_connection_string_credentials_and_database() {
        let dsn = build_dsn(&ConnectParams {
            username: "ignored".into(),
            password: "ignored".into(),
            database: "ignored".into(),
            connection_string: "ws://url-user:url-pass@td.example.com:6041/url-db".into(),
            ..Default::default()
        })
        .unwrap();
        assert_eq!(dsn.value, "ws://url-user:url-pass@td.example.com:6041/url-db");
        assert_eq!(dsn.database, "url-db");
    }

    #[test]
    fn passes_ca_certificate_path_to_the_websocket_connector() {
        let dsn =
            build_dsn(&ConnectParams { ssl: true, ca_cert_path: "/tmp/tdengine-ca.pem".into(), ..Default::default() })
                .unwrap();
        let url = Url::parse(&dsn.value).unwrap();
        assert_eq!(url.scheme(), "wss");
        let query = url.query_pairs().collect::<std::collections::HashMap<_, _>>();
        assert_eq!(query.get("tls_mode").map(|value| value.as_ref()), Some("verify_identity"));
        assert_eq!(query.get("tls_ca").map(|value| value.as_ref()), Some("/tmp/tdengine-ca.pem"));
    }

    #[test]
    fn rejects_mutual_tls_paths_instead_of_ignoring_them() {
        let error =
            build_dsn(&ConnectParams { client_cert_path: "/tmp/client.pem".into(), ..Default::default() }).unwrap_err();
        assert!(error.to_string().contains("client certificate"));
    }

    #[test]
    fn ca_certificate_enables_tls_and_replaces_conflicting_query_values() {
        let dsn = build_dsn(&ConnectParams {
            connection_string: "ws://td.example.com:6041/db?tls_mode=verify_ca&tls_ca=old.pem".into(),
          
```

### Core Architecture Module: `agents/drivers/tdengine/src/driver.rs`
```
use std::collections::{HashMap, HashSet};
use std::future::Future;
use std::time::{Duration, Instant};

use anyhow::{anyhow, bail, Context, Result};
use chrono_tz::Tz;
use futures::future::poll_fn;
use serde_json::Value;
use taos::{AsyncFetchable, AsyncQueryable, AsyncTBuilder, RawBlock, ResultSet, Taos, TaosBuilder};
use tokio::time::timeout;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::config::build_dsn;
use crate::model::{
    AgentConnectionInfo, ColumnInfo, CompletionAssistantCandidate, CompletionAssistantRequest,
    CompletionAssistantResponse, ConnectParams, DatabaseConnectionInfo, DatabaseInfo, MetadataListConstraints,
    ObjectInfo, ObjectSource, QueryOptions, QueryPageResult, QueryResult, TableInfo, DEFAULT_MAX_ROWS,
    TDENGINE_DATA_TYPES,
};
use crate::value::borrowed_value_to_json;

const TABLE_CACHE_TTL: Duration = Duration::from_secs(10);
const QUERY_SESSION_IDLE_TIMEOUT: Duration = Duration::from_secs(10 * 60);
const DEFAULT_CONNECT_TIMEOUT: Duration = Duration::from_secs(15);

pub struct TdengineDriver {
    connection: Option<Taos>,
    params: ConnectParams,
    server_version: Option<String>,
    session_timezone: Option<Tz>,
    current_database: String,
    query_sessions: HashMap<String, QueryCursor>,
    table_cache: Option<TableCache>,
}

struct TableCache {
    database: String,
    loaded_at: Instant,
    tables: Vec<TableInfo>,
}

struct QueryCursor {
    result_set: ResultSet,
    timezone: Option<Tz>,
    session_timezone: Option<Tz>,
    columns: Vec<String>,
    column_types: Vec<String>,
    affected_rows: i64,
    max_rows: usize,
    rows_read: usize,
    pending_block: Option<RawBlock>,
    pending_row_index: usize,
    pending_row: Option<Vec<Value>>,
    last_accessed_at: Instant,
}

impl TdengineDriver {
    pub fn new() -> Self {
        Self {
            connection: None,
            params: ConnectParams::default(),
            server_version: None,
            session_timezone: None,
            current_database: String::new(),
            query_sessions: HashMap::new(),
            table_cache: None,
        }
    }

    pub async fn connect(&mut self, params: ConnectParams) -> Result<()> {
        self.disconnect().await;
        let dsn = build_dsn(&params)?;
        let builder =
            TaosBuilder::from_dsn(&dsn.value).with_context(|| "failed to configure TDengine WebSocket connector")?;
        let connect_timeout = connect_timeout(&params);
        let connection = timeout(connect_timeout, builder.build())
            .await
            .map_err(|_| anyhow!("TDengine connection timed out after {} seconds", connect_timeout.as_secs()))??;
        let token = CancellationToken::new();
        let server_version = query_scalar_string(&connection, "SELECT server_version()", &token, 5).await.ok();
        let session_timezone = query_scalar_string(&connection, "SELECT timezone()", &token, 5)
            .await
            .ok()
            .and_then(|value| parse_server_timezone(&value));
        self.current_database = dsn.database;
        self.server_version = server_version;
        self.session_timezone = session_timezone;
        self.params = params;
        self.connection = Some(connection);
        Ok(())
    }

    pub async fn test_connection(params: ConnectParams) -> Result<DatabaseConnectionInfo> {
        let mut driver = Self::new();
        driver.connect(params).await?;
        let token = CancellationToken::new();
        driver.validate_connection(&token).await?;
        driver.connection_info()?.database_info.ok_or_else(|| anyhow!("TDengine connection metadata is unavailable"))
    }

    pub async fn disconnect(&mut self) {
        self.query_sessions.clear();
        self.table_cache = None;
        self.server_version = None;
        self.session_timezone = None;
        self.current_database.clear();
        self.connection = None;
    }

    pub async fn validate_connection(&self, token: &CancellationToken) -> Result<()> {
        query_scalar_string(self.require_connection()?, "SELECT server_version()", token, 3).await?;
        Ok(())
    }

    pub fn connection_info(&self) -> Result<AgentConnectionInfo> {
        self.require_connection()?;
        Ok(AgentConnectionInfo {
            identifier_quote: "`".into(),
            compatibility_mode: None,
            database_info: Some(DatabaseConnectionInfo {
                product_name: Some("TDengine".into()),
                product_version: self.server_version.clone(),
                current_database: non_empty(&self.current_database),
                driver_name: Some("taos-connector-rust".into()),
                driver_version: Some("0.12.4-git-f49c3718".into()),
                unquoted_identifier_case: Some("lower"),
                quoted_identifier_case: Some("lower"),
            }),
        })
    }

    pub async fn list_databases(&self, token: &CancellationToken) -> Result<Vec<DatabaseInfo>> {
        let rows = self.query_rows("SHOW DATABASES", token, 0).await?;
        Ok(rows
            .into_iter()
            .filter_map(|row| row.first().and_then(json_text).map(str::to_string))
            .filter(|name| !is_system_database(name))
            .map(|name| DatabaseInfo { name })
            .collect())
    }

    pub fn list_schemas(&self) -> Vec<String> {
        Vec::new()
    }

    pub fn list_data_types(&self) -> Vec<String> {
        TDENGINE_DATA_TYPES.iter().map(|value| (*value).to_string()).collect()
    }

    pub async fn list_tables(
        &mut self,
        database: &str,
        constraints: MetadataListConstraints,
        token: &CancellationToken,
    ) -> Result<Vec<TableInfo>> {
        if !table_type_allowed(&constraints.object_types, "TABLE") {
            return Ok(Vec::new());
        }
        let database = effective_database(database, &self.current_database)?.to_string();
        // `SHOW <db>.TABLES` / `SHOW <db>.STABLES` are unordered, so a server-side page
        // offset can skip or repeat rows between two requests. Always read the full
        // (sorted, cached) list and slice it locally instead.
        let tables = self.all_tables(&database, token).await?;
        Ok(filter_tables(tables, &constraints))
    }

    pub async fn list_objects(
        &mut self,
        database: &str,
        constraints: MetadataListConstraints,
        token: &CancellationToken,
    ) -> Result<Vec<ObjectInfo>> {
        let database = effective_database(database, &self.current_database)?.to_string();
        let tables = self.list_tables(&database, constraints, token).await?;
        Ok(tables
            .into_iter()
            .map(|table| ObjectInfo {
                name: table.name,
                object_type: table.table_type,
                schema: database.clone(),
                comment: table.comment,
            })
            .collect())
    }

    pub async fn get_columns(&self, database: &str, table: &str, token: &CancellationToken) -> Result<Vec<ColumnInfo>> {
        let database = effective_database(database, &self.current_database)?;
        let rows = self.query_rows(&format!("DESCRIBE {}", qualified_name(database, table)), token, 0).await?;
        Ok(parse_describe_columns(rows))
    }

    pub async fn get_table_comment(&self, _database: &str, _table: &str) -> Result<Option<String>> {
        Ok(None)
    }

    pub async fn get_object_source(
        &self,
        database: &str,
        name: &str,
        object_type: &str,
        token: &CancellationToken,
    ) -> Result<ObjectSource> {
        let database = effective_database(database, &self.current_database)?;
        let mut source = self.get_create_sql(database, name, object_type, token).await?;
        if source.is_empty() {
            let columns = self.get_columns(database, name, token).await?;
            source = build_fallback_table_ddl(database, name, &columns);
        }
        Ok(ObjectSource {
            name: name.to_string(),
            object_type: object_type.to_string(),
            schema: database.to_string(),
            source,
            editable: true,
        })
    }

    pub async fn get_table_ddl(&self, database: &str, table: &str, token: &CancellationToken) -> Result<String> {
        let stable = self.get_create_sql(database, table, "STABLE", token).await?;
        if !stable.is_empty() {
            return Ok(stable);
        }
        let table_source = self.get_create_sql(database, table, "TABLE", token).await?;
        if !table_source.is_empty() {
            return Ok(table_source);
        }
        let columns = self.get_columns(database, table, token).await?;
        Ok(build_fallback_table_ddl(database, table, &columns))
    }

    pub async fn completion_assistant_search(
        &mut self,
        request: CompletionAssistantRequest,
        token: &CancellationToken,
    ) -> Result<CompletionAssistantResponse> {
        let allowed = request.object_kinds.iter().map(|kind| kind.to_ascii_lowercase()).collect::<HashSet<_>>();
        let include_databases = allowed.contains("database") || allowed.contains("schema");
        let include_tables = allowed.is_empty() || allowed.contains("table") || allowed.contains("view");
        let include_columns = allowed.contains("column");
        let max_results = if request.max_results == 0 { 100 } else { request.max_results.min(1000) };
        let mut candidates = Vec::new();
        let requested_database = if !request.parent_schema.trim().is_empty() {
            request.parent_schema.trim()
        } else if !request.schema.trim().is_empty() {
            request.schema.trim()
        } else {
            request.database.trim()
        };
        let databases = if request.global_search || (include_databases && requested_database.is_empty()) {
            self.list_databases(token).await?.into_iter().map(|database| database.name).collect()
        } else {
            vec![effective_database(requested_database, &self.current_database)?.t
```

### Core Architecture Module: `agents/drivers/tdengine/src/lib.rs`
```
mod config;
mod driver;
mod model;
mod runtime;
mod value;

pub use runtime::run;

```

### Core Architecture Module: `agents/drivers/tdengine/src/main.rs`
```
#[tokio::main]
async fn main() {
    if let Err(error) = dbx_tdengine_driver::run().await {
        eprintln!("TDengine driver failed: {error:#}");
        std::process::exit(1);
    }
}

```

### Core Architecture Module: `agents/drivers/tdengine/src/model.rs`
```
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;

pub const PROTOCOL_VERSION: u32 = 2;
pub const LEGACY_SESSION_ID: &str = "__legacy__";
pub const DEFAULT_MAX_ROWS: usize = 10_000;
pub const MAX_AGENT_SESSIONS: usize = 256;
pub const MAX_CONCURRENT_REQUESTS: usize = 64;

#[derive(Debug, Deserialize)]
pub struct RpcRequest {
    #[serde(default)]
    pub id: Value,
    pub method: String,
    #[serde(default)]
    pub params: Value,
}

#[derive(Debug, Serialize)]
pub struct RpcResponse {
    pub jsonrpc: &'static str,
    pub id: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<RpcError>,
}

#[derive(Debug, Serialize)]
pub struct RpcError {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<StructuredError>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StructuredError {
    pub category: &'static str,
    pub retryable: bool,
    pub session_disposition: &'static str,
    pub stage: &'static str,
    pub contract_version: u32,
    pub operation_outcome: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exception_class: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct ConnectParams {
    #[serde(default)]
    pub host: String,
    #[serde(default)]
    pub port: u16,
    #[serde(default)]
    pub database: String,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub password: String,
    #[serde(default)]
    pub url_params: String,
    #[serde(default)]
    pub connection_string: String,
    #[serde(default)]
    pub ssl: bool,
    #[serde(default)]
    pub ca_cert_path: String,
    #[serde(default)]
    pub client_cert_path: String,
    #[serde(default)]
    pub client_key_path: String,
    #[serde(default)]
    pub connect_timeout_secs: u64,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct QueryOptions {
    #[serde(default)]
    pub sql: String,
    #[serde(default)]
    pub database: String,
    #[serde(default)]
    pub schema: String,
    #[serde(default, rename = "maxRows")]
    pub max_rows: usize,
    #[serde(default, rename = "fetchSize")]
    pub fetch_size: usize,
    #[serde(default, rename = "timeoutSecs")]
    pub timeout_secs: u64,
    #[serde(default, rename = "pageSize")]
    pub page_size: usize,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct MetadataListConstraints {
    #[serde(default)]
    pub filter: String,
    #[serde(default)]
    pub limit: usize,
    #[serde(default)]
    pub offset: usize,
    #[serde(default)]
    pub object_types: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct CompletionAssistantRequest {
    #[serde(default)]
    pub database: String,
    #[serde(default, deserialize_with = "deserialize_null_default")]
    pub schema: String,
    #[serde(default)]
    pub object_kinds: Vec<String>,
    #[serde(default)]
    pub mask: String,
    #[serde(default)]
    pub case_sensitive: bool,
    #[serde(default)]
    pub global_search: bool,
    #[serde(default, deserialize_with = "deserialize_null_default")]
    pub max_results: usize,
    #[serde(default, deserialize_with = "deserialize_null_default")]
    pub parent_schema: String,
    #[serde(default, deserialize_with = "deserialize_null_default")]
    pub parent_name: String,
    #[serde(default, deserialize_with = "deserialize_null_default")]
    pub match_mode: String,
}

fn deserialize_null_default<'de, D, T>(deserializer: D) -> Result<T, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de> + Default,
{
    Ok(Option::<T>::deserialize(deserializer)?.unwrap_or_default())
}

#[derive(Debug, Serialize)]
pub struct HandshakeResult {
    #[serde(rename = "protocolVersion")]
    pub protocol_version: u32,
    #[serde(rename = "agentProtocolVersion")]
    pub agent_protocol_version: u32,
    pub capabilities: Vec<&'static str>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct DatabaseInfo {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct TableInfo {
    pub name: String,
    pub table_type: String,
    pub comment: Option<String>,
    pub parent_schema: Option<String>,
    pub parent_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ObjectInfo {
    pub name: String,
    pub object_type: String,
    pub schema: String,
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub is_nullable: bool,
    pub column_default: Option<String>,
    pub is_primary_key: bool,
    pub extra: Option<String>,
    pub comment: Option<String>,
    pub numeric_precision: Option<u32>,
    pub numeric_scale: Option<u32>,
    pub character_maximum_length: Option<u32>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ObjectSource {
    pub name: String,
    pub object_type: String,
    pub schema: String,
    pub source: String,
    pub editable: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct CompletionAssistantCandidate {
    pub name: String,
    pub kind: String,
    pub database: Option<String>,
    pub schema: Option<String>,
    pub parent_schema: Option<String>,
    pub parent_name: Option<String>,
    pub comment: Option<String>,
    pub data_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct CompletionAssistantResponse {
    pub candidates: Vec<CompletionAssistantCandidate>,
    pub incomplete: bool,
    pub fallback_used: bool,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub column_types: Vec<String>,
    pub rows: Vec<Vec<Value>>,
    pub affected_rows: i64,
    pub execution_time_ms: i64,
    pub truncated: bool,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
pub struct QueryPageResult {
    pub columns: Vec<String>,
    pub column_types: Vec<String>,
    pub rows: Vec<Vec<Value>>,
    pub affected_rows: i64,
    pub execution_time_ms: i64,
    pub truncated: bool,
    pub session_id: Option<String>,
    pub has_more: bool,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseConnectionInfo {
    pub product_name: Option<String>,
    pub product_version: Option<String>,
    pub current_database: Option<String>,
    pub driver_name: Option<String>,
    pub driver_version: Option<String>,
    pub unquoted_identifier_case: Option<&'static str>,
    pub quoted_identifier_case: Option<&'static str>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentConnectionInfo {
    pub identifier_quote: String,
    pub compatibility_mode: Option<String>,
    pub database_info: Option<DatabaseConnectionInfo>,
}

pub const TDENGINE_DATA_TYPES: &[&str] = &[
    "TIMESTAMP",
    "BOOL",
    "TINYINT",
    "SMALLINT",
    "INT",
    "BIGINT",
    "TINYINT UNSIGNED",
    "SMALLINT UNSIGNED",
    "INT UNSIGNED",
    "BIGINT UNSIGNED",
    "FLOAT",
    "DOUBLE",
    "BINARY",
    "VARCHAR",
    "NCHAR",
    "JSON",
    "VARBINARY",
    "GEOMETRY",
    "DECIMAL",
    "BLOB",
    "MEDIUMBLOB",
];

```

### Core Architecture Module: `agents/drivers/tdengine/src/runtime.rs`
```
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex as StdMutex};

use anyhow::{anyhow, bail, Context, Result};
use serde::de::DeserializeOwned;
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::{mpsc, Mutex, OwnedSemaphorePermit, RwLock, Semaphore};
use tokio::task::JoinSet;
use tokio_util::sync::CancellationToken;

use crate::driver::TdengineDriver;
use crate::model::{
    ConnectParams, HandshakeResult, RpcError, RpcRequest, RpcResponse, StructuredError, LEGACY_SESSION_ID,
    MAX_AGENT_SESSIONS, MAX_CONCURRENT_REQUESTS, PROTOCOL_VERSION,
};

struct RuntimeServer {
    sessions: RwLock<HashMap<String, Arc<AgentSession>>>,
    session_slots: Arc<Semaphore>,
    request_slots: Arc<Semaphore>,
}

struct AgentSession {
    driver: Mutex<TdengineDriver>,
    active: StdMutex<Option<ActiveOperation>>,
    next_operation_id: AtomicU64,
    _slot: OwnedSemaphorePermit,
}

struct ActiveOperation {
    id: u64,
    token: CancellationToken,
}

struct OperationGuard<'a> {
    session: &'a AgentSession,
    id: u64,
}

impl Drop for OperationGuard<'_> {
    fn drop(&mut self) {
        let mut active = self.session.active.lock().expect("active operation lock poisoned");
        if active.as_ref().is_some_and(|operation| operation.id == self.id) {
            *active = None;
        }
    }
}

impl AgentSession {
    fn begin_operation(&self) -> (CancellationToken, OperationGuard<'_>) {
        let id = self.next_operation_id.fetch_add(1, Ordering::Relaxed);
        let token = CancellationToken::new();
        *self.active.lock().expect("active operation lock poisoned") =
            Some(ActiveOperation { id, token: token.clone() });
        (token, OperationGuard { session: self, id })
    }

    fn cancel(&self) {
        if let Some(operation) = self.active.lock().expect("active operation lock poisoned").as_ref() {
            operation.token.cancel();
        }
    }
}

pub async fn run() -> Result<()> {
    let runtime = Arc::new(RuntimeServer::new());
    let (responses, mut response_rx) = mpsc::unbounded_channel::<RpcResponse>();
    let writer = tokio::spawn(async move {
        let mut stdout = tokio::io::stdout();
        stdout.write_all(b"{\"ready\":true}\n").await?;
        stdout.flush().await?;
        while let Some(response) = response_rx.recv().await {
            let line = serde_json::to_vec(&response)?;
            stdout.write_all(&line).await?;
            stdout.write_all(b"\n").await?;
            stdout.flush().await?;
        }
        Ok::<(), anyhow::Error>(())
    });

    let mut lines = BufReader::new(tokio::io::stdin()).lines();
    let mut requests = JoinSet::new();
    while let Some(line) = lines.next_line().await? {
        while requests.try_join_next().is_some() {}
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let parsed = serde_json::from_str::<RpcRequest>(line);
        if parsed.as_ref().is_ok_and(|request| request.method == "shutdown") {
            let response = match parsed {
                Ok(request) => handle_request(runtime.clone(), request).await,
                Err(error) => error_response(Value::Null, "request", None, error.into()),
            };
            responses.send(response).map_err(|_| anyhow!("TDengine response writer stopped"))?;
            while requests.join_next().await.is_some() {}
            break;
        }
        let request_permit = if parsed.as_ref().is_ok_and(|request| is_capacity_exempt(&request.method)) {
            None
        } else {
            match runtime.request_slots.clone().try_acquire_owned() {
                Ok(permit) => Some(permit),
                Err(_) => {
                    let response = match parsed {
                        Ok(request) => error_response(
                            if request.id.is_null() { json!(1) } else { request.id },
                            &request.method,
                            session_id(&request.params),
                            anyhow!("agent request capacity is temporarily exhausted"),
                        ),
                        Err(error) => error_response(Value::Null, "request", None, error.into()),
                    };
                    responses.send(response).map_err(|_| anyhow!("TDengine response writer stopped"))?;
                    continue;
                }
            }
        };
        let runtime = runtime.clone();
        let responses = responses.clone();
        requests.spawn(async move {
            let _request_permit = request_permit;
            let response = match parsed {
                Ok(request) => handle_request(runtime, request).await,
                Err(error) => error_response(Value::Null, "request", None, error.into()),
            };
            let _ = responses.send(response);
        });
    }
    runtime.close_all_sessions().await;
    while requests.join_next().await.is_some() {}
    drop(responses);
    writer.await.context("TDengine response writer task failed")??;
    Ok(())
}

async fn handle_request(runtime: Arc<RuntimeServer>, request: RpcRequest) -> RpcResponse {
    let id = if request.id.is_null() { json!(1) } else { request.id.clone() };
    let session_id = session_id(&request.params);
    match runtime.dispatch(&request.method, request.params).await {
        Ok(result) => RpcResponse { jsonrpc: "2.0", id, result: Some(result), error: None },
        Err(error) => error_response(id, &request.method, session_id, error),
    }
}

impl RuntimeServer {
    fn new() -> Self {
        Self {
            sessions: RwLock::new(HashMap::new()),
            session_slots: Arc::new(Semaphore::new(MAX_AGENT_SESSIONS)),
            request_slots: Arc::new(Semaphore::new(MAX_CONCURRENT_REQUESTS)),
        }
    }

    async fn dispatch(&self, method: &str, params: Value) -> Result<Value> {
        match method {
            "handshake" => serialize(HandshakeResult {
                protocol_version: PROTOCOL_VERSION,
                agent_protocol_version: PROTOCOL_VERSION,
                capabilities: vec![
                    "connect",
                    "test_connection",
                    "metadata",
                    "query",
                    "paged_query",
                    "transaction",
                    "ddl",
                    "multi_session",
                    "structured_error_v1",
                ],
            }),
            "open_session" => {
                let id = required_string(&params, "agentSessionId")?;
                let connect = decode::<ConnectParams>(&params)?;
                self.open_session(&id, connect).await?;
                Ok(json!({"ok": true}))
            }
            "close_session" => {
                self.close_session(&required_string(&params, "agentSessionId")?).await?;
                Ok(json!({"ok": true}))
            }
            "validate_session" => {
                let session = self.session(&required_string(&params, "agentSessionId")?).await?;
                let driver = session.driver.lock().await;
                let (token, _operation) = session.begin_operation();
                driver.validate_connection(&token).await?;
                Ok(json!({"ok": true}))
            }
            "cancel_session" => {
                self.session(&required_string(&params, "agentSessionId")?).await?.cancel();
                Ok(json!({"ok": true}))
            }
            "test_connection" => {
                let database_info = TdengineDriver::test_connection(decode::<ConnectParams>(&params)?).await?;
                Ok(json!({"ok": true, "databaseInfo": database_info}))
            }
            "connect" => {
                self.close_session(LEGACY_SESSION_ID).await?;
                self.open_session(LEGACY_SESSION_ID, decode::<ConnectParams>(&params)?).await?;
                Ok(json!({"ok": true}))
            }
            "disconnect" => {
                self.close_session(LEGACY_SESSION_ID).await?;
                Ok(json!({"ok": true}))
            }
            "shutdown" => {
                self.close_all_sessions().await;
                Ok(json!({"ok": true}))
            }
            _ => {
                if !is_driver_method(method) {
                    bail!("unknown method: {method}");
                }
                let id = session_id(&params).unwrap_or_else(|| LEGACY_SESSION_ID.to_string());
                let session = self.session(&id).await?;
                let mut driver = session.driver.lock().await;
                let (token, _operation) = session.begin_operation();
                dispatch_driver(&mut driver, method, &params, &token).await
            }
        }
    }

    async fn open_session(&self, id: &str, params: ConnectParams) -> Result<()> {
        if id.trim().is_empty() {
            bail!("agentSessionId is required");
        }
        {
            let sessions = self.sessions.read().await;
            if sessions.contains_key(id) {
                bail!("agent session already exists: {id}");
            }
        }
        let slot = self
            .session_slots
            .clone()
            .try_acquire_owned()
            .map_err(|_| anyhow!("agent session limit reached: {MAX_AGENT_SESSIONS}"))?;
        let mut driver = TdengineDriver::new();
        driver.connect(params).await?;
        let session = Arc::new(AgentSession {
            driver: Mutex::new(driver),
            active: StdMutex::new(None),
            next_operation_id: AtomicU64::new(1),
            _slot: slot,
        });
        let mut sessions = self.sessions.write().await;
        if sessions.contains_key(id) {
            bail!("agent session already exists: {id}");
        }
        sessions.insert(id.to_string(), session);
        Ok(())
    }

    async fn session(&self, id: &str) -> Result<Arc<AgentSession>> {
        self.sessions.read().awa
```

### Core Architecture Module: `agents/drivers/tdengine/src/value.rs`
```
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use chrono::{NaiveDateTime, Timelike};
use chrono_tz::Tz;
use serde_json::{json, Number, Value};
use taos::taos_query::common::Timestamp;
use taos::BorrowedValue;

pub fn borrowed_value_to_json(value: BorrowedValue<'_>, timezone: Option<Tz>) -> Value {
    match value {
        BorrowedValue::Null(_) => Value::Null,
        BorrowedValue::Bool(value) => Value::Bool(value),
        BorrowedValue::TinyInt(value) => json!(value),
        BorrowedValue::SmallInt(value) => json!(value),
        BorrowedValue::Int(value) => json!(value),
        BorrowedValue::BigInt(value) => json!(value),
        BorrowedValue::UTinyInt(value) => json!(value),
        BorrowedValue::USmallInt(value) => json!(value),
        BorrowedValue::UInt(value) => json!(value),
        BorrowedValue::UBigInt(value) => json!(value),
        BorrowedValue::Float(value) => finite_float_number(value),
        BorrowedValue::Double(value) => finite_number(value),
        BorrowedValue::VarChar(value) => Value::String(value.to_string()),
        BorrowedValue::NChar(value) => Value::String(value.into_owned()),
        BorrowedValue::Timestamp(value) => Value::String(format_timestamp(value, timezone)),
        BorrowedValue::Json(value) => serde_json::from_slice(&value)
            .unwrap_or_else(|_| Value::String(String::from_utf8_lossy(&value).into_owned())),
        BorrowedValue::VarBinary(value) | BorrowedValue::Blob(value) | BorrowedValue::MediumBlob(value) => {
            binary_json(&value)
        }
        BorrowedValue::Geometry(value) => geometry_json(&value),
        BorrowedValue::Decimal(value) => Value::String(value.to_string()),
        BorrowedValue::Decimal64(value) => Value::String(value.to_string()),
    }
}

fn finite_number(value: f64) -> Value {
    Number::from_f64(value).map(Value::Number).unwrap_or_else(|| Value::String(value.to_string()))
}

fn finite_float_number(value: f32) -> Value {
    let shortest = value.to_string();
    if value.is_finite() {
        // Widening f32 directly exposes binary approximation digits that were never significant in FLOAT.
        let rounded = shortest.parse::<f64>().expect("a formatted finite f32 is a valid f64");
        Value::Number(Number::from_f64(rounded).expect("a finite f32 is a finite f64"))
    } else {
        Value::String(shortest)
    }
}

fn binary_json(value: &[u8]) -> Value {
    json!({ "$binary": STANDARD.encode(value) })
}

fn geometry_json(value: &[u8]) -> Value {
    if let Ok(text) = std::str::from_utf8(value) {
        let trimmed = text.trim();
        if looks_like_wkt(trimmed) {
            return Value::String(trimmed.to_string());
        }
    }
    binary_json(value)
}

fn looks_like_wkt(value: &str) -> bool {
    let upper = value.to_ascii_uppercase();
    ["POINT", "LINESTRING", "POLYGON", "MULTIPOINT", "MULTILINESTRING", "MULTIPOLYGON", "GEOMETRYCOLLECTION"]
        .iter()
        .any(|prefix| upper.starts_with(prefix))
}

fn format_timestamp(timestamp: Timestamp, timezone: Option<Tz>) -> String {
    let datetime = match timezone {
        Some(timezone) => timestamp.to_datetime_with_custom_tz(&timezone).naive_local(),
        None => timestamp.to_naive_datetime(),
    };
    format_naive_datetime(datetime, timestamp)
}

fn format_naive_datetime(datetime: NaiveDateTime, timestamp: Timestamp) -> String {
    let digits = match timestamp {
        Timestamp::Milliseconds(_) => 3,
        Timestamp::Microseconds(_) => 6,
        Timestamp::Nanoseconds(_) => 9,
    };
    let mut fraction = format!("{:09}", datetime.nanosecond());
    fraction.truncate(digits);
    while fraction.len() > 3 && fraction.ends_with('0') {
        fraction.pop();
    }
    format!("{}.{}", datetime.format("%Y-%m-%d %H:%M:%S"), fraction)
}

#[cfg(test)]
mod tests {
    use super::*;
    use taos::Ty;

    #[test]
    fn serializes_float_with_shortest_round_trippable_decimal() {
        let cases = [
            (8.6_f32, "8.6"),
            (0.72_f32, "0.72"),
            (59.6_f32, "59.6"),
            (-13.25_f32, "-13.25"),
            (0.0_f32, "0.0"),
            (-0.0_f32, "-0.0"),
            (f32::from_bits(1), "1e-45"),
            (f32::MIN_POSITIVE, "1.1754944e-38"),
            (f32::MAX, "3.4028235e+38"),
            (1.0e-7_f32, "1e-7"),
            (1.0e20_f32, "1e+20"),
        ];

        for (value, expected) in cases {
            let encoded = borrowed_value_to_json(BorrowedValue::Float(value), None);
            assert!(encoded.is_number(), "finite FLOAT must remain a JSON number");
            assert_eq!(encoded.to_string(), expected);
            assert_eq!((encoded.as_f64().unwrap() as f32).to_bits(), value.to_bits());
        }
    }

    #[test]
    fn keeps_float_fallback_and_other_numeric_types_unchanged() {
        assert_eq!(borrowed_value_to_json(BorrowedValue::Float(f32::NAN), None), json!("NaN"));
        assert_eq!(borrowed_value_to_json(BorrowedValue::Float(f32::INFINITY), None), json!("inf"));
        assert_eq!(borrowed_value_to_json(BorrowedValue::Float(f32::NEG_INFINITY), None), json!("-inf"));
        assert_eq!(borrowed_value_to_json(BorrowedValue::Null(Ty::Float), None), Value::Null);
        assert_eq!(borrowed_value_to_json(BorrowedValue::Double(8.600000381469727), None), json!(8.600000381469727));
        assert_eq!(borrowed_value_to_json(BorrowedValue::Int(42), None), json!(42));
    }

    #[test]
    fn preserves_timestamp_precision_with_at_least_milliseconds() {
        assert_eq!(
            borrowed_value_to_json(
                BorrowedValue::Timestamp(Timestamp::Milliseconds(1_704_067_200_123)),
                Some(chrono_tz::UTC)
            ),
            Value::String("2024-01-01 00:00:00.123".into())
        );
        assert_eq!(
            borrowed_value_to_json(
                BorrowedValue::Timestamp(Timestamp::Microseconds(1_704_067_200_123_400)),
                Some(chrono_tz::UTC)
            ),
            Value::String("2024-01-01 00:00:00.1234".into())
        );
        assert_eq!(
            borrowed_value_to_json(
                BorrowedValue::Timestamp(Timestamp::Nanoseconds(1_704_067_200_123_456_789)),
                Some(chrono_tz::UTC)
            ),
            Value::String("2024-01-01 00:00:00.123456789".into())
        );
    }

    #[test]
    fn formats_timestamps_in_the_selected_timezone() {
        let timestamp = BorrowedValue::Timestamp(Timestamp::Milliseconds(1_704_067_200_123));
        assert_eq!(
            borrowed_value_to_json(timestamp.clone(), Some(chrono_tz::Asia::Shanghai)),
            Value::String("2024-01-01 08:00:00.123".into())
        );
        assert_eq!(borrowed_value_to_json(timestamp, None), Value::String("2024-01-01 00:00:00.123".into()));
    }

    #[test]
    fn keeps_text_and_binary_values_distinct() {
        assert_eq!(borrowed_value_to_json(BorrowedValue::VarChar("hello"), None), json!("hello"));
        assert_eq!(
            borrowed_value_to_json(BorrowedValue::VarBinary(vec![0, 255].into()), None),
            json!({"$binary": "AP8="})
        );
        assert_eq!(borrowed_value_to_json(BorrowedValue::Null(Ty::Int), None), Value::Null);
    }

    #[test]
    fn returns_wkt_geometry_as_text() {
        assert_eq!(
            borrowed_value_to_json(BorrowedValue::Geometry(b"POINT (1 2)".as_slice().into()), None),
            json!("POINT (1 2)")
        );
    }
}

```

### Core Architecture Module: `agents/drivers/vastbase-go/connection_state.go`
```
package main

import (
	"database/sql"
	"reflect"
	"regexp"
	"strings"
)

var (
	sessionAffinityFunction = regexp.MustCompile(`(?is)\b(?:SET_CONFIG|PG_(?:TRY_)?ADVISORY_(?:(?:XACT_)?LOCK(?:_SHARED)?|UNLOCK(?:_SHARED|_ALL)?)|GET_LOCK|RELEASE_LOCK|SP_GETAPPLOCK|DBMS_LOCK)\s*\(`)
	sessionUserVariable     = regexp.MustCompile(`(?is)(?:SET\s+)?@[A-Z0-9_$]+\s*(?::=|=)`)
	sessionTemporaryObject  = regexp.MustCompile(`(?is)(?:^|[^A-Z0-9_$])#{1,2}[A-Z0-9_$]+`)
)

func sqlConnectionIdentity(conn *sql.Conn) uintptr {
	var identity uintptr
	_ = conn.Raw(func(raw any) error {
		value := reflect.ValueOf(raw)
		if value.IsValid() && value.Kind() == reflect.Pointer {
			identity = value.Pointer()
		}
		return nil
	})
	return identity
}

func (s *server) resetSchemaCache() {
	s.currentSchema = ""
	s.schemaInitialized = false
	s.schemaConnectionID = 0
}

func (s *server) invalidateSchemaAfterSQL(sqlText string) {
	if sqlMayChangeSessionState(sqlText) {
		s.resetSchemaCache()
	}
}

func (s *server) noteSQLSessionState(sqlText string) {
	s.invalidateSchemaAfterSQL(sqlText)
	if sqlRequiresSessionAffinity(sqlText) {
		s.sessionAffinity = true
	}
}

func sqlRequiresSessionAffinity(sqlText string) bool {
	normalized := strings.ToUpper(sanitizeSessionStateSQL(sqlText))
	if sessionAffinityFunction.MatchString(normalized) || sessionUserVariable.MatchString(normalized) || sessionTemporaryObject.MatchString(normalized) {
		return true
	}
	for _, statement := range strings.Split(normalized, ";") {
		fields := strings.Fields(statement)
		if len(fields) == 0 {
			continue
		}
		switch fields[0] {
		case "BEGIN", "SET", "RESET", "UNSET", "USE", "DATABASE", "DECLARE", "PREPARE", "DEALLOCATE", "ATTACH", "DETACH", "PRAGMA", "CALL", "EXEC", "EXECUTE", "DO", "LISTEN", "UNLISTEN", "LOAD", "INSTALL":
			return true
		case "START":
			if len(fields) > 1 && fields[1] == "TRANSACTION" {
				return true
			}
		case "ALTER":
			if len(fields) > 1 && fields[1] == "SESSION" {
				return true
			}
		case "LOCK", "UNLOCK":
			if len(fields) > 1 && strings.HasPrefix(fields[1], "TABLE") {
				return true
			}
		case "CREATE":
			for _, field := range fields[1:] {
				if field == "TEMP" || field == "TEMPORARY" || field == "VOLATILE" {
					return true
				}
				if field == "TABLE" {
					break
				}
			}
		case "SELECT":
			for index, field := range fields {
				if field == "INTO" && index+1 < len(fields) && (fields[index+1] == "TEMP" || fields[index+1] == "TEMPORARY") {
					return true
				}
			}
		case "ADD", "DELETE":
			if len(fields) > 1 && (fields[1] == "JAR" || fields[1] == "FILE" || fields[1] == "ARCHIVE") {
				return true
			}
		case "CACHE", "UNCACHE":
			if len(fields) > 1 && fields[1] == "TABLE" {
				return true
			}
		}
	}
	return false
}

func sqlMayChangeSessionState(sqlText string) bool {
	normalized := strings.ToUpper(sanitizeSessionStateSQL(sqlText))
	if strings.Contains(normalized, "SET_CONFIG") {
		return true
	}
	for _, statement := range strings.Split(normalized, ";") {
		fields := strings.Fields(statement)
		if len(fields) == 0 {
			continue
		}
		switch fields[0] {
		case "SET", "RESET", "DISCARD":
			return true
		case "ALTER":
			if len(fields) > 1 && fields[1] == "SESSION" {
				return true
			}
		}
	}
	return false
}

func sanitizeSessionStateSQL(sqlText string) string {
	var sanitized strings.Builder
	sanitized.Grow(len(sqlText))
	for index := 0; index < len(sqlText); {
		switch {
		case index+1 < len(sqlText) && sqlText[index] == '-' && sqlText[index+1] == '-':
			index = sanitizeSQLLine(sqlText, &sanitized, index, index+2)
		case sqlText[index] == '#':
			index = sanitizeSQLLine(sqlText, &sanitized, index, index+1)
		case index+1 < len(sqlText) && sqlText[index] == '/' && sqlText[index+1] == '*':
			index = sanitizeSQLBlock(sqlText, &sanitized, index+2)
		case sqlText[index] == '\'' || sqlText[index] == '"' || sqlText[index] == '`':
			index = sanitizeSQLQuoted(sqlText, &sanitized, index, sqlText[index])
		case sqlText[index] == '[':
			index = sanitizeSQLQuoted(sqlText, &sanitized, index, ']')
		case sqlText[index] == '$':
			delimiter := sqlDollarQuoteDelimiter(sqlText, index)
			if delimiter == "" {
				sanitized.WriteByte(sqlText[index])
				index++
				continue
			}
			closing := strings.Index(sqlText[index+len(delimiter):], delimiter)
			if closing < 0 {
				sanitized.WriteByte(sqlText[index])
				index++
				continue
			}
			end := index + len(delimiter) + closing + len(delimiter)
			appendSanitizedSQL(sqlText, &sanitized, index, end)
			index = end
		default:
			sanitized.WriteByte(sqlText[index])
			index++
		}
	}
	return sanitized.String()
}

func sanitizeSQLLine(sqlText string, sanitized *strings.Builder, start, index int) int {
	for index < len(sqlText) && sqlText[index] != '\n' && sqlText[index] != '\r' {
		index++
	}
	appendSanitizedSQL(sqlText, sanitized, start, index)
	return index
}

func sanitizeSQLBlock(sqlText string, sanitized *strings.Builder, index int) int {
	start := index - 2
	closing := strings.Index(sqlText[index:], "*/")
	end := len(sqlText)
	if closing >= 0 {
		end = index + closing + 2
	}
	appendSanitizedSQL(sqlText, sanitized, start, end)
	return end
}

func sanitizeSQLQuoted(sqlText string, sanitized *strings.Builder, start int, closing byte) int {
	index := start + 1
	for index < len(sqlText) {
		if sqlText[index] == closing {
			if index+1 < len(sqlText) && sqlText[index+1] == closing {
				index += 2
				continue
			}
			index++
			break
		}
		if sqlText[index] == '\\' && index+1 < len(sqlText) {
			index += 2
			continue
		}
		index++
	}
	appendSanitizedSQL(sqlText, sanitized, start, index)
	return index
}

func sqlDollarQuoteDelimiter(sqlText string, start int) string {
	for index := start + 1; index < len(sqlText); index++ {
		if sqlText[index] == '$' {
			return sqlText[start : index+1]
		}
		char := sqlText[index]
		if !((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9') || char == '_') {
			return ""
		}
	}
	return ""
}

func appendSanitizedSQL(sqlText string, sanitized *strings.Builder, start, end int) {
	for index := start; index < end; index++ {
		if sqlText[index] == '\n' || sqlText[index] == '\r' || sqlText[index] == ';' {
			sanitized.WriteByte(sqlText[index])
		} else {
			sanitized.WriteByte(' ')
		}
	}
}

```

### Core Architecture Module: `agents/go-common/iotdb-client-go/client/utils.go`
```
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package client

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/apache/iotdb-client-go/v2/common"
	"github.com/apache/iotdb-client-go/v2/rpc"
)

const (
	DEFAULT_TIME_FORMAT = "default"
	TIME_PRECISION      = "timestamp_precision"
	MILLISECOND         = "ms"
	MICROSECOND         = "us"
	NANOSECOND          = "ns"
)

func getTimeFactor(openResp *rpc.TSOpenSessionResp) (int32, error) {
	if !openResp.IsSetConfiguration() {
		return 1_000, nil
	}
	precision, exists := openResp.GetConfiguration()[TIME_PRECISION]
	if !exists {
		return 1_000, nil
	}
	switch precision {
	case MILLISECOND:
		return 1_000, nil
	case MICROSECOND:
		return 1_000_000, nil
	case NANOSECOND:
		return 1_000_000_000, nil
	default:
		return 0, fmt.Errorf("unknown time precision: %v", precision)
	}
}

func getTimePrecision(timeFactor int32) (string, error) {
	switch timeFactor {
	case 1_000:
		return MILLISECOND, nil
	case 1_000_000:
		return MICROSECOND, nil
	case 1_000_000_000:
		return NANOSECOND, nil
	default:
		return "", fmt.Errorf("unknown time factor: %v", timeFactor)
	}
}

func formatDatetime(timeFormat, timePrecision string, timestamp int64, zone *time.Location) string {
	switch timeFormat {
	case "long", "number":
		return strconv.FormatInt(timestamp, 10)
	case "default", "iso8601":
		return parseLongToDateWithPrecision(timestamp, zone, timePrecision)
	default:
		sec := timestamp / 1000
		nsec := (timestamp % 1000) * int64(time.Millisecond)
		t := time.Unix(sec, nsec).In(zone)
		return t.Format(timeFormat)
	}
}

func getMilliSecond(timeValue int64, timeFactor int32) int64 {
	return (timeValue / int64(timeFactor)) * 1_000
}

func getNanoSecond(timeValue int64, timeFactor int32) int {
	return int((timeValue % int64(timeFactor)) * (1_000_000_000 / int64(timeFactor)))
}

func convertToTimestamp(timeValue int64, timeFactor int32) time.Time {
	millis := getMilliSecond(timeValue, timeFactor)
	nanos := getNanoSecond(timeValue, timeFactor)
	return time.Unix(millis/1e3, (millis%1e3)*1e6).Add(time.Duration(nanos) * time.Nanosecond)
}

func parseLongToDateWithPrecision(timestamp int64, zone *time.Location, precision string) string {
	var divisor int64
	var digits int

	switch precision {
	case MILLISECOND:
		divisor = 1000
		digits = 3
	case MICROSECOND:
		divisor = 1_000_000
		digits = 6
	case NANOSECOND:
		divisor = 1_000_000_000
		digits = 9
	default:
		return ""
	}

	quotient := timestamp / divisor
	remainder := timestamp % divisor

	if timestamp < 0 && remainder != 0 {
		quotient--
		remainder += divisor
	}

	t := time.Unix(quotient, 0).In(zone)
	year, month, day := t.Date()
	hour, min, sec := t.Clock()

	_, offset := t.Zone()
	offsetSeconds := offset
	sign := "+"
	if offsetSeconds < 0 {
		sign = "-"
		offsetSeconds = -offsetSeconds
	}
	hours := offsetSeconds / 3600
	minutes := (offsetSeconds % 3600) / 60

	zoneOffset := fmt.Sprintf("%s%02d:%02d", sign, hours, minutes)
	if offset == 0 {
		zoneOffset = "Z"
	}

	formatStr := fmt.Sprintf("%%0%dd", digits)
	fraction := fmt.Sprintf(formatStr, remainder)

	isoStr := fmt.Sprintf("%04d-%02d-%02dT%02d:%02d:%02d.%s%s",
		year, month, day, hour, min, sec, fraction, zoneOffset)

	return isoStr
}

func int32ToString(n int32) string {
	return strconv.Itoa(int(n))
}

func int64ToString(n int64) string {
	return strconv.FormatInt(n, 10)
}

func float32ToString(val float32) string {
	return strconv.FormatFloat(float64(val), 'f', -1, 32)
}

func float64ToString(val float64) string {
	return strconv.FormatFloat(val, 'f', -1, 64)
}

func int32ToBytes(n int32) []byte {
	bytesBuffer := bytes.NewBuffer([]byte{})
	binary.Write(bytesBuffer, binary.BigEndian, n)
	return bytesBuffer.Bytes()
}

func int64ToBytes(n int64) []byte {
	bytesBuffer := bytes.NewBuffer([]byte{})
	binary.Write(bytesBuffer, binary.BigEndian, n)
	return bytesBuffer.Bytes()
}

func bytesToInt32(bys []byte) int32 {
	bytesBuffer := bytes.NewBuffer(bys)
	var data int32
	binary.Read(bytesBuffer, binary.BigEndian, &data)
	return data
}

func bytesToInt64(bys []byte) int64 {
	bytesBuffer := bytes.NewBuffer(bys)
	var data int64
	binary.Read(bytesBuffer, binary.BigEndian, &data)
	return data
}

func bytesToHexString(input []byte) string {
	hexString := "0x"
	if input != nil {
		for _, b := range input {
			hexString += fmt.Sprintf("%02x", b)
		}
	}
	return hexString
}

func DateToInt32(localDate time.Time) (int32, error) {
	if localDate.IsZero() {
		return 0, errors.New("date expression is null or empty")
	}

	year := localDate.Year()
	if year < 1000 || year > 9999 {
		return 0, errors.New("year must be between 1000 and 9999")
	}

	// Convert to YYYY/MM/DD format
	result := year*10000 + int(localDate.Month())*100 + localDate.Day()
	return int32(result), nil
}

func Int32ToDate(val int32) (time.Time, error) {
	date := int(val)
	year := date / 10000
	month := (date / 100) % 100
	day := date % 100

	localDate := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)

	if localDate.Year() != year || int(localDate.Month()) != month || localDate.Day() != day {
		return time.Time{}, errors.New("invalid date format")
	}

	return localDate, nil
}

func bytesToDate(bys []byte) (time.Time, error) {
	return Int32ToDate(bytesToInt32(bys))
}

func verifySuccesses(statuses []*common.TSStatus) error {
	buff := bytes.Buffer{}
	for _, status := range statuses {
		if status.Code != SuccessStatus && status.Code != RedirectionRecommend {
			buff.WriteString(*status.Message + ";")
		}
	}
	errMsg := buff.String()
	if len(errMsg) > 0 {
		return &BatchError{statuses, errMsg}
	}
	return nil
}

func VerifySuccess(status *common.TSStatus) error {
	if status.Code == RedirectionRecommend {
		return nil
	}

	if status.Code == MultipleError {
		if err := verifySuccesses(status.GetSubStatus()); err != nil {
			return err
		}
		return nil
	}
	if status.Code != SuccessStatus {
		msg := ""
		if status.Message != nil {
			msg = *status.Message
		}
		return &ExecutionError{Code: status.Code, Message: msg}
	}
	return nil
}

type Binary struct {
	values []byte
}

func NewBinary(v []byte) *Binary {
	return &Binary{v}
}

func (b *Binary) GetStringValue() string {
	return string(b.values)
}

func (b *Binary) GetValues() []byte {
	return b.values
}

```

### Core Architecture Module: `apps/desktop/src/components/editor/useQueryEditorDocumentState.ts`
```
import { watch, nextTick } from "vue";
import { Transaction } from "@codemirror/state";
import type { EditorView as EditorViewType } from "@codemirror/view";
import { createDeferredEditorTask } from "@/lib/editor/deferredEditorTask";
import { focusEditorView } from "@/lib/editor/queryEditorFocus";
import type { ShallowRef, Ref } from "vue";
import type { QueryEditorProps } from "./queryEditorTypes";

const BEFORE_TAB_SWITCH_EVENT = "dbx:before-tab-switch";

interface QueryEditorDocumentStateRuntime {
  historyResetComp: import("@codemirror/state").Compartment | null;
  codeMirrorHistory: typeof import("@codemirror/commands").history | null;
  codeMirrorEditorSelection: typeof import("@codemirror/state").EditorSelection | null;
  editorIsActive: boolean;
}

interface QueryEditorDocumentStateOptions {
  props: Readonly<QueryEditorProps>;
  view: ShallowRef<EditorViewType | null>;
  previewContextSql: Readonly<Ref<string>>;
  runtime: QueryEditorDocumentStateRuntime;
  emit: {
    (event: "selectionStateChange", selection: { anchor: number; head: number }): void;
    (event: "viewportChange", viewport: { scrollTop: number; scrollLeft: number }, tabId?: string): void;
    (event: "editorStateFlushed"): void;
    (event: "editorRevealConsumed"): void;
    (event: "previewChangesAvailable", value: boolean): void;
  };
  scheduleSemanticDiagnostics: (delay?: number, options?: { preserveOutsideRanges?: boolean }) => void;
  clearScheduledPreviewContextRefresh: () => void;
  syncContextMenuState: (view: EditorViewType) => void;
  applyEditorAppearance: () => Promise<void>;
  applyEditorShortcutKeymaps: () => void;
  applyEditorIndentExtension: () => void;
  applyEditorCompletionExtension: () => void;
  invalidateSemanticDiagnosticsForDocumentChange: () => void;
  currentEditorDocText: (view: EditorViewType) => string;
  scheduleDocumentSearchUpdate: () => void;
  isEditorComposing: (view: EditorViewType) => boolean;
}

export function useQueryEditorDocumentState(options: QueryEditorDocumentStateOptions) {
  const { isEditorComposing } = options;
  const {
    props,
    view,
    previewContextSql,
    runtime,
    emit,
    scheduleDocumentSearchUpdate,
    scheduleSemanticDiagnostics,
    clearScheduledPreviewContextRefresh,
    syncContextMenuState,
    applyEditorAppearance,
    applyEditorShortcutKeymaps,
    applyEditorIndentExtension,
    applyEditorCompletionExtension,
    invalidateSemanticDiagnosticsForDocumentChange,
    currentEditorDocText,
  } = options;

  let viewportOwnerTabId = props.tabId;
  const viewportEmitTask = createDeferredEditorTask(() => {
    if (latestViewport) emitEditorViewport(latestViewport);
  }, 150);
  let viewportRestoreFrame: number | null = null;
  let latestViewport: { scrollTop: number; scrollLeft: number } | undefined = props.initialViewport;
  let lastEmittedViewport: { scrollTop: number; scrollLeft: number } | undefined = props.initialViewport;
  let tabSwitchStateCaptured = false;
  let latestSelection: { anchor: number; head: number } | undefined = props.initialSelection;

  // A single editor instance serves every tab, so the document swap on tab
  // switches must not push "previous tab's content → new content" onto a shared
  // undo history (one undo in the new tab restored the old tab's text). Each
  // tab's editor state — including its undo history — is cached per tabId and
  // reinstalled with setState; first-seen tabs get the document swapped in with a
  // transaction excluded from history, and the history extension is dropped and
  // re-added in two separate transactions (a compartment reconfigure alone keeps
  // the old field value) so the previous tab's edits cannot leak in.
  const tabStateCache = new Map<string, import("@codemirror/state").EditorState>();
  const MAX_CACHED_TAB_STATES = 16;

  function swapEditorDocument(doc: string) {
    const currentView = view.value;
    if (!currentView || !runtime.historyResetComp || !runtime.codeMirrorHistory) return;
    if (doc !== currentView.state.doc.toString()) {
      currentView.dispatch({
        changes: { from: 0, to: currentView.state.doc.length, insert: doc },
        annotations: Transaction.addToHistory.of(false),
      });
    }
    currentView.dispatch({ effects: runtime.historyResetComp.reconfigure([]) });
    currentView.dispatch({ effects: runtime.historyResetComp.reconfigure(runtime.codeMirrorHistory()) });
    scheduleSemanticDiagnostics();
  }

  function activateTabDocument(prevTabId: string | undefined, tabId: string | undefined, doc: string) {
    const currentView = view.value;
    if (!currentView) return;
    // Flush the outgoing document before props and restored scroll positions
    // become the new tab's state. The event carries its original owner. A
    // before-tab-switch capture already flushed this editor while it was still
    // visible, so avoid reading the reset scroll position during the transition.
    if (!tabSwitchStateCaptured) flushEditorViewport();
    viewportOwnerTabId = tabId;
    latestViewport = props.initialViewport ?? { scrollTop: 0, scrollLeft: 0 };
    lastEmittedViewport = undefined;
    clearScheduledPreviewContextRefresh();
    if (prevTabId !== undefined) {
      tabStateCache.set(prevTabId, currentView.state);
      if (tabStateCache.size > MAX_CACHED_TAB_STATES) {
        const oldest = tabStateCache.keys().next();
        if (!oldest.done) tabStateCache.delete(oldest.value);
      }
    }
    const cached = tabId === undefined ? undefined : tabStateCache.get(tabId);
    if (!cached) {
      swapEditorDocument(doc);
      // First activation in this editor instance (or a cache-evicted tab, e.g.
      // beyond MAX_CACHED_TAB_STATES): restore the tab's saved cursor and scroll
      // position exactly like the cached-state branch, otherwise the swapped-in
      // document keeps whatever scroll offset the dispatch left behind (#8374).
      // A brand-new tab has no saved state, so reset it instead of falling back
      // to the previous tab's latest position (#8378).
      restoreEditorSelection(props.initialSelection ?? { anchor: 0, head: 0 }, !props.initialViewport);
      restoreEditorViewport(props.initialViewport ?? { scrollTop: 0, scrollLeft: 0 });
      clearScheduledPreviewContextRefresh();
      syncContextMenuState(currentView);
      emit("previewChangesAvailable", !!previewContextSql.value);
      return;
    }
    // setState swaps doc, selection, undo history and all fields at once, but it
    // is not a transaction, so update-listener side effects are re-run manually.
    currentView.setState(cached);
    // Compartments in the restored state may lag behind settings that changed
    // while another tab was active; re-sync them from current values.
    void applyEditorAppearance();
    applyEditorShortcutKeymaps();
    applyEditorIndentExtension();
    applyEditorCompletionExtension();
    if (doc !== currentView.state.doc.toString()) {
      // Content changed while the tab was inactive (external file change, AI
      // edit, another split group): apply it as a regular undoable edit.
      currentView.dispatch({
        changes: { from: 0, to: currentView.state.doc.length, insert: doc },
      });
    }
    scheduleDocumentSearchUpdate();
    invalidateSemanticDiagnosticsForDocumentChange();
    restoreEditorSelection(undefined, !props.initialViewport);
    restoreEditorViewport();
    clearScheduledPreviewContextRefresh();
    syncContextMenuState(currentView);
    emit("previewChangesAvailable", !!previewContextSql.value);
    scheduleSemanticDiagnostics();
  }

  watch([() => props.tabId, () => props.modelValue], ([tabId, val], [prevTabId]) => {
    if (!view.value) return;
    if (tabId !== prevTabId) {
      activateTabDocument(prevTabId, tabId, val);
      if (props.autoFocus) restoreEditorFocus();
      return;
    }
    if (val !== currentEditorDocText(view.value)) {
      if (isEditorComposing(view.value)) return;
      view.value.dispatch({
        changes: { from: 0, to: view.value.state.doc.length, insert: val },
      });
      scheduleSemanticDiagnostics();
    }
  });

  watch(
    () => props.initialViewport,
    (viewport, previousViewport) => {
      if (!view.value || !viewport || previousViewport) return;
      // Saved SQL content can hydrate after the editor has already mounted. In
      // that case the initial prop was undefined and the mount-time restore had
      // nothing to apply.
      latestViewport = { ...viewport };
      lastEmittedViewport = { ...viewport };
      restoreEditorViewport(viewport);
    },
    { deep: true },
  );

  watch(
    () => props.initialSelection,
    (selection, previousSelection) => {
      if (!view.value || !selection || previousSelection) return;
      // Keep the cursor and viewport in sync when a saved SQL tab hydrates after
      // the editor component has already been mounted.
      restoreEditorSelection(selection, !props.initialViewport);
    },
    { deep: true },
  );

  function captureEditorStateBeforeTabSwitch(event: Event) {
    const fromTabId = (event as CustomEvent<{ fromTabId?: string }>).detail?.fromTabId;
    if (!view.value || !fromTabId || fromTabId !== props.tabId) return;
    // Capture while the outgoing editor is still visible. Once KeepAlive starts
    // deactivating the surface, WebKit can report a reset scrollTop of zero.
    flushEditorViewport();
    flushEditorSelection();
    emit("editorStateFlushed");
    tabSwitchStateCaptured = true;
  }

  function readEditorViewport(currentView: EditorViewType) {
    return {
      scrollTop: Math.max(0, currentView.scrollDOM.scrollTop),
      scrollLeft: Math.max(0, currentView.scrollDOM.scrollLeft),
    };
  }

  function sameEditorViewport(a: { scrollTop: number; scrollLeft: number } | undefined, b: { scrollTop: number; scrollLeft: number }) {
    return a?.scrollTop === b.scrollTop && a.scrollLeft === b.scrollLeft;
  }

  function normalizedEditorSelection(selection: { anchor: number; head: nu
```

### Core Architecture Module: `apps/desktop/src/components/editor/useQueryEditorStatementBoundaries.ts`
```
import type { ShallowRef } from "vue";
import { RangeSet, RangeValue, type EditorState } from "@codemirror/state";
import type { EditorView as EditorViewType, ViewPlugin as ViewPluginType } from "@codemirror/view";
import { executableStatementRangeCacheForDoc, statementGutterStartIndexForCache, mapStatementGutterStartIndex, type ExecutableStatementRangeCache, type StatementGutterStartIndex } from "@/lib/sql/executableStatementRangeCache";
import type { SqlParameterOptions } from "@/lib/sql/sqlParameters";
import type { QueryEditorProps } from "./queryEditorTypes";
import type { QueryEditorCodeMirrorRuntime } from "./queryEditorCodeMirrorRuntime";
import { createSqlStatementAnalysisWorker } from "@/lib/sql/sqlStatementAnalysisWorker";
import { shouldUseQueryEditorLargeDocumentModeForSize } from "@/lib/editor/queryEditorLargeDocument";
import type { FoldRange } from "@/lib/editor/codemirrorSqlBlockFolding";

class FoldRangeMarker extends RangeValue {
  startSide = 1;
  endSide = 1;
}

const foldRangeMarker = new FoldRangeMarker();

interface QueryEditorStatementBoundariesOptions {
  props: Readonly<QueryEditorProps>;
  view: ShallowRef<EditorViewType | null>;
  sqlStatementParameterOptions: () => SqlParameterOptions;
  cache: { value: ExecutableStatementRangeCache | null };
  runtime: QueryEditorCodeMirrorRuntime;
  driverProfile?: () => string | undefined;
}

export function useQueryEditorStatementBoundaries(options: QueryEditorStatementBoundariesOptions) {
  const { props, view, sqlStatementParameterOptions, cache, runtime: codeMirrorRuntime } = options;
  // Lenient statement-boundary view shared by the run-statement gutter and the
  // current-statement frame. Re-parsing the whole document on every keystroke is
  // the dominant typing cost on large scripts, so while typing we only shift the
  // known positions through RangeSet mapping and rebuild after typing pauses,
  // off-thread for large documents. Paths that must stay exact (gutter
  // click-to-execute, execution picker) keep using the full on-demand parse.
  const STATEMENT_BOUNDARIES_REFRESH_MS = 150;
  const analysisWorker = createSqlStatementAnalysisWorker();
  let trackedView: EditorViewType | null = null;
  let pendingAnalysis: { doc: EditorState["doc"]; generation: number; result: Promise<ExecutableStatementRangeCache | null> } | null = null;

  let statementBoundariesView: {
    doc: import("@codemirror/state").Text;
    startsIndex: StatementGutterStartIndex;
    folds: RangeSet<FoldRangeMarker>;
    frameRange: { from: number; to: number } | null;
    fresh: boolean;
    generation: number;
  } | null = null;

  let statementBoundariesGeneration = 0;

  let statementBoundariesRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  function cancelStatementBoundariesRefresh() {
    if (statementBoundariesRefreshTimer !== null) clearTimeout(statementBoundariesRefreshTimer);
    statementBoundariesRefreshTimer = null;
  }

  function clearStatementBoundaries() {
    cancelStatementBoundariesRefresh();
    analysisWorker.dispose();
    pendingAnalysis = null;
    statementBoundariesGeneration += 1;
    cache.value = null;
    statementBoundariesView = null;
  }

  function installStatementBoundaries(state: EditorState, result: ExecutableStatementRangeCache, folds?: Map<number, FoldRange>) {
    cache.value = result;
    statementBoundariesView = {
      doc: state.doc,
      startsIndex: statementGutterStartIndexForCache(result),
      folds: folds
        ? RangeSet.of(
            [...folds.values()].map((range) => foldRangeMarker.range(range.from, range.to)),
            true,
          )
        : RangeSet.empty,
      frameRange: null,
      fresh: true,
      generation: statementBoundariesGeneration,
    };
  }

  function ensureStatementCache(state: EditorState): Promise<ExecutableStatementRangeCache | null> {
    if (pendingAnalysis?.doc === state.doc && pendingAnalysis.generation === statementBoundariesGeneration) return pendingAnalysis.result;
    const generation = statementBoundariesGeneration;
    const result = analysisWorker.analyze({ sql: state.doc.toString(), databaseType: props.databaseType, parameterOptions: sqlStatementParameterOptions(), includeFolds: true, syntaxDialect: props.syntaxDialect ?? props.dialect, driverProfile: options.driverProfile?.() }).then((analysis) => {
      const currentView = view.value ?? trackedView;
      if (!analysis || generation !== statementBoundariesGeneration || currentView?.state.doc !== state.doc) return null;
      const resolved = { ...analysis, doc: state.doc };
      installStatementBoundaries(state, resolved, analysis.folds);
      const refreshEffect = codeMirrorRuntime.statementBoundariesRefreshEffect;
      if (refreshEffect) currentView.dispatch({ effects: refreshEffect.of(null) });
      return resolved;
    });
    pendingAnalysis = { doc: state.doc, generation, result };
    return result;
  }

  function refreshStatementBoundaries(state: EditorState) {
    if (shouldUseQueryEditorLargeDocumentModeForSize(state.doc.length, state.doc.lines)) {
      void ensureStatementCache(state);
    } else {
      installStatementBoundaries(state, executableStatementRangeCacheForDoc(cache.value, state.doc, props.databaseType, sqlStatementParameterOptions()));
    }
  }

  interface StatementBoundariesView {
    doc: import("@codemirror/state").Text;
    startsIndex: StatementGutterStartIndex;
    folds: RangeSet<FoldRangeMarker>;
    frameRange: { from: number; to: number } | null;
    fresh: boolean;
    generation: number;
  }

  // Returns the view matching `state`, rebuilding it synchronously when the
  // tracked doc fell out of sync (first use, tab switch via setState) or the
  // dialect generation moved. While typing, the tracking plugin keeps the doc
  // reference current through ChangeSet mapping, so this stays cheap.
  function statementBoundariesForState(state: import("@codemirror/state").EditorState): StatementBoundariesView {
    if (statementBoundariesView && statementBoundariesView.doc === state.doc && statementBoundariesView.generation === statementBoundariesGeneration) return statementBoundariesView;
    statementBoundariesView = { doc: state.doc, startsIndex: { starts: RangeSet.empty, executableLineStarts: RangeSet.empty }, folds: RangeSet.empty, frameRange: null, fresh: false, generation: statementBoundariesGeneration };
    refreshStatementBoundaries(state);
    return statementBoundariesView!;
  }

  function scheduleStatementBoundariesRefresh(currentView: EditorViewType) {
    // True debounce: continuous typing must never pay a full-document parse —
    // mapped positions serve the gutter/frame, and one rebuild lands only after
    // the pause.
    if (statementBoundariesRefreshTimer !== null) clearTimeout(statementBoundariesRefreshTimer);
    statementBoundariesRefreshTimer = setTimeout(() => {
      statementBoundariesRefreshTimer = null;
      if (view.value !== currentView || !currentView.dom.isConnected) return;
      refreshStatementBoundaries(currentView.state);
      if (codeMirrorRuntime.statementBoundariesRefreshEffect) {
        currentView.dispatch({ effects: codeMirrorRuntime.statementBoundariesRefreshEffect.of(null) });
      }
    }, STATEMENT_BOUNDARIES_REFRESH_MS);
  }

  function createTrackingPlugin(ViewPlugin: typeof ViewPluginType) {
    const statementBoundariesTrackingPlugin = ViewPlugin.fromClass(
      class {
        constructor(currentView: EditorViewType) {
          trackedView = currentView;
        }

        update(update: import("@codemirror/view").ViewUpdate) {
          if (!update.docChanged) return;
          analysisWorker.cancel();
          pendingAnalysis = null;
          const boundaries = statementBoundariesView;
          // No consumer (run gutter off + statement frame off) ever initialized
          // the view — nothing to maintain and no refresh to schedule.
          if (!boundaries) return;
          if (boundaries.doc === update.startState.doc) {
            statementBoundariesView = {
              doc: update.state.doc,
              startsIndex: mapStatementGutterStartIndex(boundaries.startsIndex, update.changes),
              folds: boundaries.folds.map(update.changes),
              frameRange: boundaries.frameRange
                ? {
                    from: update.changes.mapPos(boundaries.frameRange.from, 1),
                    to: update.changes.mapPos(boundaries.frameRange.to, 1),
                  }
                : null,
              fresh: false,
              generation: boundaries.generation,
            };
          }
          scheduleStatementBoundariesRefresh(update.view);
        }

        destroy() {
          clearStatementBoundaries();
          trackedView = null;
        }
      },
    );
    return statementBoundariesTrackingPlugin;
  }
  return {
    foldRangeForState(state: EditorState, lineStart: number): FoldRange | null | undefined {
      if (!shouldUseQueryEditorLargeDocumentModeForSize(state.doc.length, state.doc.lines)) return undefined;
      const lineEnd = state.doc.lineAt(lineStart).to;
      let range: FoldRange | null = null;
      statementBoundariesForState(state).folds.between(lineEnd, lineEnd, (from, to) => {
        if (from !== lineEnd) return;
        range = { from, to };
        return false;
      });
      return range;
    },
    statementBoundariesForState,
    createTrackingPlugin,
    ensureStatementCache,
    clear: clearStatementBoundaries,
    invalidate() {
      analysisWorker.cancel();
      pendingAnalysis = null;
      statementBoundariesGeneration += 1;
    },
  };
}

```

### Core Architecture Module: `apps/desktop/src/components/sidebar/sidebarTreeDialogState.ts`
```
import { ref, shallowRef } from "vue";
import type { DatabaseType, TreeNode } from "@/types/database";
import type { PasteTableMode } from "@/lib/table/tableClipboard";
import { fallbackCreateDatabaseCharsetMetadata } from "@/lib/database/createDatabaseCharsetOptions";
import type { DatabaseUserIdentity } from "@/lib/database/databaseUserAdmin";
import type { AuthorizationPlan, AuthorizationStepResult } from "@/lib/database/databaseAuthorizationPlan";
import type { MongoCreateIndexForm, MongoIndexRow } from "@/lib/sidebar/mongoCollectionMutation";
import type { TableVGroupScope } from "@/lib/table/tableVGroup";

export type DuplicateStructureSource = TreeNode & { connectionId: string; database: string };
type ConnectionDeleteTarget = TreeNode & { connectionId: string };
type ConnectionGroupDeleteTarget = TreeNode & { type: "connection-group" };

export const fallbackCreateDatabaseCharset = fallbackCreateDatabaseCharsetMetadata();

export const sidebarTreeDialogOwner = shallowRef<symbol | null>(null);
export const sidebarDangerTarget = shallowRef<TreeNode | null>(null);
export const sidebarDangerRunningExecutionId = ref<string>("");
export const sidebarDangerRunningCancel = ref<(() => void | Promise<void>) | null>(null);
export const sidebarFormTarget = shallowRef<TreeNode | null>(null);
export const connectionDeleteTargetSnapshot = ref<ConnectionDeleteTarget[]>([]);
export const connectionGroupDeleteTargetSnapshot = ref<ConnectionGroupDeleteTarget[]>([]);
export const deleteConnectionsWithGroup = ref(false);
export const showTableVGroupDialog = ref(false);
export const tableVGroupName = ref("");
/** Scope snapshot + creation payload for the table vgroup naming dialog. */
export const tableVGroupDialogScope = shallowRef<TreeNode | null>(null);
export const tableVGroupDialogParentGroupId = ref<string | null>(null);
export const tableVGroupDialogTableNames = ref<string[]>([]);
export const showTableVGroupDeleteConfirm = ref(false);
/** Scope + group snapshot for the table vgroup delete confirmation. */
export const tableVGroupDeleteTarget = shallowRef<{ scope: TableVGroupScope; groupId: string; name: string } | null>(null);
export const showDeleteConfirm = ref(false);
export const showDropTableConfirm = ref(false);
export const showDropTableChildObjectConfirm = ref(false);
export const showBatchDropConfirm = ref(false);
export const showBatchEmptyConfirm = ref(false);
export const showBatchTruncateConfirm = ref(false);
export const showStructurePreviewDialog = ref(false);
export const showStructureDocCopyDialog = ref(false);
export const structurePreviewSql = ref("");
export const structurePreviewDdlStorageType = ref<DatabaseType | undefined>(undefined);
export const structurePreviewTitle = ref("");
export const structurePreviewDefaultFileName = ref("structure.sql");
export const structurePreviewError = ref("");
export const structureDocCopyText = ref("");
export const structureDocCopyTitle = ref("");
export const isLoadingStructurePreview = ref(false);
export const showEmptyTableConfirm = ref(false);
export const showTruncateTableConfirm = ref(false);
export const showVacuumTableConfirm = ref(false);
export const showMysqlAutoIncrementConfirm = ref(false);
export const showBatchMysqlAutoIncrementConfirm = ref(false);
export const batchMysqlAutoIncrementTargets = ref<TreeNode[]>([]);
export const batchMysqlAutoIncrementPreviewSql = ref("");
export const showRenameObjectDialog = ref(false);
export const renameObjectName = ref("");
export const renameObjectError = ref("");
export const renameObjectPreviewSql = ref("");
export const dropTablePreviewSql = ref("");
export const dropTableCascade = ref(false);
export const batchDropCascade = ref(false);
export const emptyTablePreviewSql = ref("");
export const truncateTablePreviewSql = ref("");
export const truncateTableCascade = ref(false);
export const vacuumTableFull = ref(false);
export const vacuumTableAnalyze = ref(false);
export const vacuumTablePreviewSql = ref("");
export const vacuumTablePreviewKey = ref("");
export const vacuumTableExecuting = ref(false);
export const mysqlAutoIncrementValue = ref("1");
export const mysqlAutoIncrementPreviewSql = ref("");
export const mysqlAutoIncrementPreviewKey = ref("");
export const dropObjectPreviewSql = ref("");
export const showDropObjectConfirm = ref(false);
export const dropTableChildObjectPreviewSql = ref("");
export const batchDropPreviewSql = ref("");
export const batchEmptyPreviewSql = ref("");
export const batchEmptyTargets = ref<TreeNode[]>([]);
export const batchDropTargets = ref<TreeNode[]>([]);
export const batchTruncateTargets = ref<TreeNode[]>([]);
export const batchTruncatePreviewSql = ref("");
export const batchTruncateCascade = ref(false);
export const dropDatabasePreviewSql = ref("");
export const dropSchemaPreviewSql = ref("");
export const showDuplicateDialog = ref(false);
export const duplicateTableName = ref("");
export const duplicateStructureSource = ref<DuplicateStructureSource | null>(null);
export const showPasteDialog = ref(false);
export const pasteTableMode = ref<PasteTableMode>("structure-and-data");
export const pasteTableEntries = ref<Array<{ sourceName: string; targetName: string; connectionId: string; database: string; schema?: string; tableComment?: string | null }>>([]);
export const showCreateDatabaseDialog = ref(false);
export const createDatabaseName = ref("");
export const createDatabaseCharset = ref("utf8mb4");
export const createDatabaseCollation = ref("utf8mb4_unicode_ci");
export const createDatabaseUsers = ref<DatabaseUserIdentity[]>([]);
export const createDatabaseSelectedUsers = ref<DatabaseUserIdentity[]>([]);
export const createDatabaseUsersLoading = ref(false);
export const showCreateDatabasePreviewDialog = ref(false);
export const createDatabaseAuthorizationPlan = ref<AuthorizationPlan>();
export const createDatabasePreviewSql = ref("");
export const createDatabaseAuthorizationResults = ref<AuthorizationStepResult[]>([]);
export const createDatabaseAuthorizationApplying = ref(false);
export const showCreateNacosNamespaceDialog = ref(false);
export const createNacosNamespaceId = ref("");
export const createNacosNamespaceName = ref("");
export const createNacosNamespaceDesc = ref("");
export const createNacosNamespaceLoading = ref(false);
export const showEditNacosNamespaceDialog = ref(false);
export const editNacosNamespaceName = ref("");
export const editNacosNamespaceDesc = ref("");
export const editNacosNamespaceLoading = ref(false);
export const showDeleteNacosNamespaceConfirm = ref(false);
export const deleteNacosNamespaceLoading = ref(false);
export const createDatabaseCharsetOptions = ref<string[]>(fallbackCreateDatabaseCharset.charsets);
export const createDatabaseCollationsByCharset = ref<Record<string, string[]>>(fallbackCreateDatabaseCharset.collationsByCharset);
export const createDatabaseCharsetLoading = ref(false);
export const showDropDatabaseConfirm = ref(false);
export const dropDatabaseLoading = ref(false);
export const showDropMongoCollectionConfirm = ref(false);
export const dropMongoCollectionLoading = ref(false);
export const showRenameMongoCollectionDialog = ref(false);
export const renameMongoCollectionName = ref("");
export const renameMongoCollectionError = ref("");
export const renameMongoCollectionPreview = ref("");
export const renameMongoCollectionLoading = ref(false);
export const showCloneMongoCollectionDialog = ref(false);
export const cloneMongoCollectionName = ref("");
export const cloneMongoCollectionError = ref("");
export const cloneMongoCollectionLoading = ref(false);
export const showDropMongoIndexConfirm = ref(false);
export const dropMongoIndexLoading = ref(false);
export const showDropAllMongoIndexesConfirm = ref(false);
export const dropAllMongoIndexesLoading = ref(false);
export const showCreateMongoIndexDialog = ref(false);
export const showCreateMeilisearchIndexDialog = ref(false);
export const meilisearchCreateIndexUid = ref("");
export const meilisearchCreateIndexPrimaryKey = ref("");
export const meilisearchCreateIndexError = ref("");
export const meilisearchCreateIndexLoading = ref(false);

function emptyMongoCreateIndexForm(): MongoCreateIndexForm {
  return {
    name: "",
    fields: [{ id: 1, path: "", type: "1" }],
    unique: false,
    sparse: false,
    expireAfterSeconds: "",
    partialFilterExpression: "",
    background: false,
    bucketSize: "",
    hidden: false,
  };
}

export const mongoCreateIndexForm = ref<MongoCreateIndexForm>(emptyMongoCreateIndexForm());
export const mongoCreateIndexFieldOptions = ref<string[]>([]);
export const mongoCreateIndexError = ref("");
export const mongoCreateIndexLoading = ref(false);

export function resetMongoCreateIndexForm() {
  mongoCreateIndexForm.value = emptyMongoCreateIndexForm();
  mongoCreateIndexFieldOptions.value = [];
  mongoCreateIndexError.value = "";
  mongoCreateIndexLoading.value = false;
}

export const showMongoIndexManagerDialog = ref(false);
export const mongoIndexManagerRows = ref<MongoIndexRow[]>([]);
export const mongoIndexManagerLoading = ref(false);
export const mongoIndexManagerError = ref("");
export const mongoIndexManagerSelectedName = ref("");
export const mongoIndexManagerMode = ref<"view" | "create" | "edit">("view");
/** Name of the index being edited, so the confirm step knows which one to drop. */
export const mongoEditIndexOriginalName = ref("");

export function resetMongoIndexManager() {
  mongoIndexManagerRows.value = [];
  mongoIndexManagerLoading.value = false;
  mongoIndexManagerError.value = "";
  mongoIndexManagerSelectedName.value = "";
  mongoIndexManagerMode.value = "view";
  mongoEditIndexOriginalName.value = "";
}
export const showClearElasticsearchIndexConfirm = ref(false);
export const clearElasticsearchIndexLoading = ref(false);
/** Name typed back by the operator before a wildcard index node may be cleared. */
export const clearElasticsearchIndexTypedName = ref("");
export const showFlushRedisDbConfirm = ref(false);
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #11103** (2026-10-05): **fix(safety): read the production scan with the connection's lexer rules**
  *Symptoms*: ## 问题  生产库写操作的保护判定（`targets_production_database`、MCP 的 `sql_references_disallowed_database`）先用一个扫描器剔除字符串与注释，再从剩下的文本里找目标库。该扫描器此前把 MySQL 的词法当成所有引擎的通用规则：`#` 一律当行注释、反斜杠一律当字符串转义。SQL Server 两者都不是 —— `#tmp` 是临时表名，T-SQL 用双写单引号转义引号。  于是下面两条在 SQL Server 上都被扫成"只读文本"，落在被标记的生产库 `prod_app` 上的写操作不再要求确认：  ```sql SELECT * FROM #tmp; DELETE FROM prod_app.dbo.users; SELECT 'dir\'; DELETE FROM prod_app.dbo.users; ```  ## 修复  - `sql_target_safety_text` 增加方言参数（唯一调用方 `referenced_databases` 本来就持有 `db_type`）； - `#` 行注释只在 MySQL 系（mysql / doris / starrocks / manticoresearch / goldendb）成立； - 反斜杠转义只在 MySQL 系成立；PostgreSQL 家族（Postgres / openGauss / GaussDB / Vastbase / Kingbase / Highgo / Uxdb / Kwdb）保留 `E'...'` 内的转义（`E'` 前缀需自成 token，`DATE'2020-01-01'` 不算）； - 其余引擎按字面处理反斜杠。这道闸门里"少吞文本"只会让写操作**更早被要求确认**，不会放宽；ClickHouse/Hive 确实在普通字符串里转义，可能偶尔多问一次，方向是安全的。  ## 验证（本机实跑，gnu 交叉工具链）  新增用例在修复前（main）与修复后：  | 用例 | main | 本 PR | | --- | --- | --- | | SQL Server `#tmp` 后的生产库 DELETE | **FAILED**（被吞） | ok | | SQL Server `'dir\'` 后的生产库 DELETE | **FAILED**（被吞） | ok | | MySQL `#` 注释 / 反斜杠转义（守护） | ok | ok | | 扫描文本断言：PostgreSQL 普通字符串 / `E'...'` | — | ok |  - `cargo test -p dbx-core --lib --no-default-features --features sqlite-bundled`：**2881 通过 / 1 失败**。该失败为 `persistence::storage::tests::secret_migration_running_state_resumes_after_reopen`（`MIGRATION_LOCK_UNAVAILABLE`，单独复跑同样失败，与本次改动无关的环境锁问题）； - 共享语料 `tests/fixtures/production-safety-corpus.json` 的既有 31 例保持通过（其中含 SQL Server 两段名按 schema 解析等语义）； - `cargo fmt --check` 通过。  ## 说明  前
  **Post-Mortem & Fix Analysis**:
  > Thanks for the contribution! Merged in 1a57e54f17, will be released in the next version.

- **Issue #11102** (2026-10-05): **fix(sql): read backslash escapes from the dialect string rules**
  *Symptoms*: ## 问题  切分器把"反斜杠转义引号"当成所有引擎的通用规则。PostgreSQL 的普通字符串不是这样：`standard_conforming_strings` 自 9.1 起默认 `on`，反斜杠只在 `E'...'` 字面量里转义（官方文档："backslash escapes are recognized only in escape string constants"）。  于是下面这段在 PostgreSQL 上被切成**一条**语句，`DELETE` 被吞进字符串：执行计划、结果分栏，以及 `dbx-mcp` 的风险清单（`sql_execution_plan_for_database`）都看不到这条写操作。  ```sql SELECT 'dir\'; DELETE FROM users; ```  ## 修复  - `SqlDialectProfile` 新增两个开关：`supports_backslash_escaped_quotes`（普通字符串是否用反斜杠转义）与 `supports_postgres_escape_strings`（`E'...'`）； - 流式切分 `SqlStatementSplitter` 与游标切分 `split_sql_statement_ranges_with_options` 都改为向 profile 询问； - PostgreSQL 家族（Postgres / openGauss / GaussDB，以及 Vastbase / Kingbase / Highgo / Uxdb / Kwdb）关闭普通字符串转义、保留 E-string 转义； - `E'` 前缀必须自成 token（`DATE'2020-01-01'`、`x$e'...'` 不算），避免类型名字面量误判； - **其余引擎维持原有行为**：ClickHouse、Hive 等确实在普通字符串里用反斜杠转义，Redshift 基于 PostgreSQL 8.0（早于该默认值变更），都保持现状 —— 把"引擎认为未结束的字符串"切开执行会带来新的风险，所以这些引擎等各自有证据再单独归类。  ## 验证  - `cargo test -p dbx-sql-core --lib`：**447 通过**（含新增 7 例：PostgreSQL 普通字符串 / E-string / 游标路径、Vastbase 普通字符串与 E-string、DuckDB E-string、profile 断言）； - `cargo test -p dbx-sql-schema --lib`：**681 通过** —— 其中 Vastbase 复刻表结构的 `E'C:\\订单\n明细\t\''` 用例正是本次要保护的既有期望； - `cargo fmt --check` 通过。  说明：`dbx-core` 的测试在本机（Windows + MinGW 交叉）因 `openssl-sys` 无法构建，未能运行；该 crate 里没有"PostgreSQL 非 E-string 反斜杠"的用例，且它自身就用 `E'\n'` 生成 PostgreSQL SQL、并识别 `E'` 前缀。  另：`crates/dbx-sql-data/src/query_result_sql.rs` 的 `skip_sql_quoted` 是第三处相同的通用转义假设，涉及跨 crate 签名，留作后续单独处理。 
  **Post-Mortem & Fix Analysis**:
  > ﻿补一份修复前后的实测对比（本机直接调用 `split_sql_statements_for_database`，非推理）：  输入 `SELECT 'dir\'; DELETE FROM users;`  | 方言 | 修复前（main） | 修复后 | | --- | --- | --- | | postgres | `["SELECT 'dir\'; DELETE FROM users;"]`（1 条，DELETE 被吞进字符串） | `["SELECT 'dir\'", "DELETE FROM users"]` | | vastbase | 同上（1 条） | `["SELECT 'dir\'", "DELETE FROM users"]` | | clickhouse | `["SELECT 'dir\'; DELETE FROM users;"]` | 不变（有意保持现状，避免把引擎认为未结束的字符串切开） |  输入 `SELECT E'it\'s; x'; SELECT 1;`（postgres）：修复前后都是 `["SELECT E'it\'s; x'", "SELECT 1"]`，E-string 转义未受影响。 
  > Thanks for the contribution! Merged in 5067514e8, will be released in the next version.

- **Issue #11101** (2026-10-05): **fix(sql): apply dialect rules when scanning comments and escapes for risk**
  *Symptoms*: ## 问题  `sqlSafetyText` 是方言无关的扫描器：它把 MySQL 的 `#` 行注释和反斜杠转义套用到**所有**数据库。于是写在后面的语句被当成注释/字符串吞掉，整段脚本被判为只读，`classifyAiSqlExecution` 返回 `auto_execute` —— AI 生成的写语句无需确认即被执行。  ## 复现证据（真实运行输出）  | 输入 | 修复前 安全文本 / 切分 | 修复前 风险 | 修复前 AI 动作 | 修复后 | | --- | --- | --- | --- | --- | | SQL Server `SELECT * FROM #tmp; DELETE FROM #tmp;` | `"SELECT * FROM  "` / 1 条 | `read` | `auto_execute` | `confirm`、`write`、2 条 | | PostgreSQL `SELECT 'dir\'; DELETE FROM users;` | `"SELECT  "` / 1 条 | `read` | `auto_execute` | `confirm`、`write`、2 条 |  方言依据：  - SQL Server 中 `#tmp` 是临时表名，不是注释； - PostgreSQL `standard_conforming_strings` 自 9.1 起默认为 `on`，反斜杠只转义 `E'...'`，所以 `'dir\'` 是完整字符串（官方文档："backslash escapes are recognized only in escape string constants"）。  仓库里已有同样的方言门控：`crates/dbx-sql-core/src/sql.rs` 的 `is_mysql_compatible_database` 决定 `supports_hash_line_comments`，前端分类器漏了这层判断。  ## 修复  - 新增 `MYSQL_LEXER_DATABASE_TYPES`（`mysql / doris / starrocks / manticoresearch / goldendb`，与 `is_mysql_compatible_database` 一致）； - `sqlSafetyText`、`splitSqlStatementsForSafety`、`stripAiSqlComments` 增加可选 `dialect` 参数，仅在 MySQL 系方言下把 `#` 当行注释、把 `\` 当字符串转义； - `classifySqlRisk` 传入已有的 `options.dialect`，`classifyAiSqlExecution` 传入 `connection?.db_type`； - 未知方言按字面处理：只会切出更多语句，风险只升不降（fail-closed）。  ## 验证  - 新增 `sqlRisk.dialect.spec.ts` 7 例：T-SQL、PostgreSQL、MySQL `#` 行为不变、MySQL 反斜杠转义不变、未知方言 fail-closed，全部通过； - 相关套件回归：101 文件 / 2122 用例通过（`lib/__tests__/sql`、`lib/ai/__tests__`、`lib/database/__tests__`）； - `vue-tsc --noEmit` 通过；`oxfmt --check
  **Post-Mortem & Fix Analysis**:
  > Thanks for the contribution! Merged in 67b9565979, will be released in the next version.

- **Issue #11099** (2026-10-05): **fix(grid): reconcile an exact total when a page lands beyond it**
  *Symptoms*: ## 变更说明 / Change Description  Fixes #10968.  From the issue's screenshots: after counting 2892 rows, clicking **Last Page** twice first showed the correct final page (rows 2801–2892, "Total 92 rows (2892 total)"), and then rows **2992–3000** against the same "2892 total" — a full 200-row page fetched at offset 2800, i.e. row indexes rendered **past the claimed end of the result**, with the page position and total contradicting what the grid displays.  The COUNT that produces the exact total and the query that serves a page are two separate snapshots:  - rows can land between the COUNT and the page fetch on a table being written to, and - for Oracle user queries / generic JDBC, pagination runs against a long-lived agent result session (#8993) that serves the snapshot it was opened with, even when the re-COUNT at last-page jump time already reports fewer rows.  Rendering that page against the stale total is what makes the position/count line look wrong. This PR makes the grid self-consistent: when a page finishes loading with rows beyond the exact total, the observed extent becomes the new exact total (`reconcileDataGridExactTotalWithObservedPage` in `dataGridPagination.ts`, wired through a small watcher next to `manualTotalRowCount`). The status bar then shows the extent the grid can actually display ("3000 total" for the case above) instead of a total that the visible rows already exceed.  ## 行为对比 / Behavior  - Page fits inside the exact total → total unchanged (including the
  **Post-Mortem & Fix Analysis**:
  > Thanks for the contribution! Merged in f8b7ffe516, will be released in the next version.

- **Issue #11098** (2026-10-05): **fix(postgres): don't let a zeroed stats entry mask reltuples in object statistics**
  *Symptoms*: ## 变更说明 / Change Description  Fixes #11072.  The object browser's row/size estimates come from `POSTGRES_OBJECT_STATISTICS_SQL`:  ```sql GREATEST(COALESCE(s.n_live_tup, c.reltuples), 0)::bigint AS estimated_rows ```  The intent (from #10461) is that the live estimate wins. But a zero `n_live_tup` only carries information when the statistics collector has actually observed DML on the table. After `pg_stat_reset()`, a `pg_upgrade`, or an import that bypassed the collector, the `pg_stat_user_tables` entry reports `n_live_tup = 0` while a recent ANALYZE left a perfectly good `pg_class.reltuples` behind — and `COALESCE(0, reltuples)` masks that count, so populated tables show **0 rows** until the next DML repopulates the collector. That matches the report: opening the database shows 0 entries for every table on PostgreSQL 16 / v0.6.33.  The fix trusts `n_live_tup` only when the collector has observed DML (`n_tup_ins/upd/del > 0`), and falls back to `reltuples` otherwise:  ```sql GREATEST(CASE WHEN COALESCE(s.n_tup_ins, 0) + COALESCE(s.n_tup_upd, 0) + COALESCE(s.n_tup_del, 0) > 0               THEN COALESCE(s.n_live_tup, 0)               ELSE c.reltuples END, 0)::bigint AS estimated_rows ```  ## 行为对比 / Behavior  Verified against a local PostgreSQL 18.1 instance (`autovacuum_enabled = false` to keep the collector state deterministic):  | Scenario | `reltuples` | `n_live_tup` | collector DML | before | after | | --- | --- | --- | --- | --- | --- | | analyzed table, stats reset (#1107
  **Post-Mortem & Fix Analysis**:
  > Thanks for the contribution! Merged in 7c28b6789e, will be released in the next version.

- **Issue #11095** (2026-10-05): **fix(postgres): preserve identity values and sequence state in SQL exports**
  *Symptoms*: ## 变更说明 / Change Description  PostgreSQL SQL exports currently insert explicit values into `GENERATED ALWAYS AS IDENTITY` columns without `OVERRIDING SYSTEM VALUE`, so importing the exported file fails. Add the clause in the shared INSERT builder when an included column is an ALWAYS identity; this covers database, table, and metadata-backed query exports, including single-row and batched INSERTs. BY DEFAULT identities, serial columns, and excluded identity columns retain their existing INSERT behavior.  For complete database restores, let CREATE TABLE create its identity/serial sequence and configure the actual table-bound sequence through `pg_get_serial_sequence`. Precreating the source sequence otherwise makes the restored column use a different sequence, leaving subsequent default INSERTs at the wrong counter. Preserve sequence options and restore counters for ascending, descending, unused, renamed, and cycled sequences. Include complete identity sequence options in both PostgreSQL column metadata queries so descending/custom identity DDL can be restored.  Extend the existing live all-schema export test to restore original IDs and sequence parameters, check subsequent default INSERTs and constraints, and round-trip table/query exports in both INSERT modes. Test AppState helpers use explicit temporary plugin/agent directories.  ## 变更类型 / Change Type  - [ ] 新功能 / New feature - [x] Bug 修复 / Bug fix - [ ] 性能优化 / Performance improvement - [ ] 代码重构 / Code refactorin
  **Post-Mortem & Fix Analysis**:
  > Thanks for the contribution! Merged in de265287e, will be released in the next version.

- **Issue #11094** (2026-10-05): **fix(sql): quote PostgreSQL array literals with backslashes as escape strings**
  *Symptoms*: ## 变更说明 / Change Description  `format_pg_array_sql_literal` (used for PostgreSQL array values in data grid save SQL, SQL export, and transfer) builds the array text with the usual array escapes (`\\` for a backslash, `\"` for a double quote inside an element) and then doubles every backslash again before wrapping it in a plain `'...'` literal.  Doubling backslashes is only correct inside an escape string (`E'...'`). With PostgreSQL's default `standard_conforming_strings = on`, a plain `'...'` keeps backslashes verbatim, so the array parser sees the doubled escapes:  | element | generated literal | result in PostgreSQL 17 | | --- | --- | --- | | `C:\tmp` | `'{"C:\\\\tmp"}'` | element becomes `C:\\tmp` (extra backslash) | | `say "hi"` | `'{"say \\"hi\\""}'` | `ERROR: malformed array literal ... Incorrectly quoted array element.` |  So saving/exporting/transferring a `text[]` row that contains a backslash silently corrupts it, and one containing a double quote produces SQL that fails.  The fix passes the array text to the existing `quote_postgres_string_literal`, which the scalar PostgreSQL path already uses: values without backslashes or control characters stay a plain `'...'` literal (so existing output such as `'{"first",NULL,"second"}'` is unchanged), and values with backslashes become `E'...'`, which is correct regardless of `standard_conforming_strings`. The jsonb array path (`format_postgres_json_array_sql_literal`) already uses `E'...'` the same way.  I checked both lite
  **Post-Mortem & Fix Analysis**:
  > Thanks for the contribution! Merged in f19b62be0, will be released in the next version.

- **Issue #11083** (2026-10-05): **fix(sql): match file-import quote and dash-dash rules when finding the statement at the cursor**
  *Symptoms*: ## 变更说明 / Change Description  Run-at-cursor (`find_statement_at_cursor_for_database`, which backs Ctrl+Enter in the desktop and web editors) uses `split_sql_statement_ranges_with_options`. That splitter still had two rules that the main execution/file-import splitter (`SqlStatementSplitter`) already fixed:  1. **`--` without whitespace in MySQL.** `SqlStatementSplitter` follows `requires_whitespace_after_line_comment_dashes` (#5382), so `5--1` is subtraction. The range splitter always started a line comment. The rest of the line was swallowed, including the `;`. 2. **Escaped backslash before a closing quote.** `SqlStatementSplitter` uses `has_odd_trailing_backslashes`. The range splitter only checked whether the previous byte was `\`. So `'a\\'` was treated as still open, and the next `;` was not seen as a statement boundary.  Repro (MySQL connection, cursor on line 2, Ctrl+Enter):  ```sql SELECT 5--1; SELECT 2; ```  The cursor resolves to `SELECT 5--1;\nSELECT 2` and not `SELECT 2`. The same happens with `SELECT 'a\\';` on line 1.  The fix makes the range splitter use the same helpers: `dash_dash_starts_line_comment` for `--`, and `has_odd_trailing_backslashes` for `'` and `"`, as `SqlStatementSplitter` already does. The now-unused `is_escaped_single_quote` is removed. Other dialects are unchanged: Postgres, Oracle, etc. still treat `--` as a comment unconditionally.  ## 变更类型 / Change Type  - [ ] 新功能 / New feature - [x] Bug 修复 / Bug fix - [ ] 性能优化 / Performance improvement -
  **Post-Mortem & Fix Analysis**:
  > Thanks for the contribution! Merged in 4778aa05b, will be released in the next version.

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

### Incident Patch 1: `f8b7ffe5` (2026-10-05)
**Commit Message**: fix(grid): reconcile an exact total when a page lands beyond it

Closes #10968

**File**: `apps/desktop/src/components/grid/DataGrid.vue` (modified, +17/-0)
```diff
@@ -230,6 +230,7 @@ import {
   ELASTICSEARCH_PAGE_JUMP_WARNING_REQUESTS,
   elasticsearchCursorPageJumpRequestCount,
   hasCompleteLocalDataGridResult,
+  reconcileDataGridExactTotalWithObservedPage,
   resolveDataGridPaginationTotal,
   showDataGridRerunTotalCountAction,
   type DataGridInexactTotalRowCountMode,
@@ -3462,6 +3463,22 @@ const serverKnownTotalRowCount = computed(() => (typeof manualTotalRowCount.valu
 const displayedTotalRowCount = computed(() => serverKnownTotalRowCount.value ?? inferredBackendTotalRowCount.value);
 const totalRowCountIsExact = computed(() => typeof manualTotalRowCount.value === "number" || props.totalRowCountIsExact !== false);
 const totalRowCountLabelKey = computed(() => dataGridTotalRowCountLabelKey(totalRowCountIsExact.value, props.inexactTotalRowCountMode));
+// The COUNT behind an exact total and the query serving a page are two
+// separate snapshots: rows can land in between (a table being written to), and
+// an agent result session serves the snapshot it was opened with. A page that
+// lands with rows past the exact total must not render row indexes beyond the
+// claimed end of the result (#10968) — adopt the observed extent instead.
+watch(
+  () => [props.loading, props.pageOffset, props.result.rows.length, props.result.appended_from_row_count] as const,
+  ([loading, offset, rowCount, appendedFromRowCount]) => {
+    if (loading || isInfiniteScrollPaginating.value || appendedFromRowCount !== undefined) return;
+    const exactTotal = serverKnownTotalRowCount.value;
+    if (!totalRowCountIsExact.value || typeof offset !== "number" || typeof exactTotal !== "number") return;
+    const reconciled = reconcileDataGridExactTotalWithObservedPage({ offset, rowCount, exactTotal });
+    if (reconciled !== undefined) manualTotalRowCount.value = reconciled;
+  },
+  { flush: "post" },
+);
 // A backend can expose an exact display total while deliberately restricting
 // offset pagination to a smaller safe range.
 const paginationTotalRowCount = computed(() =>
```

**File**: `apps/desktop/src/components/grid/__tests__/DataGridTotalRowCountRefresh.spec.ts` (modified, +16/-0)
```diff
@@ -117,6 +117,22 @@ describe("DataGrid manual count freshness", () => {
     expect(totalText(host)).toContain("250");
   });
 
+  it("reconciles a stale exact total when a page lands beyond it (#10968)", async () => {
+    const { host, state } = mountGrid();
+    await settle();
+    clickButton(host, String(i18n.global.t("grid.calculateTotalRowsInline")));
+    await settle();
+    expect(totalText(host)).toContain("250");
+
+    // The COUNT said 250, but the served snapshot holds more: the counted last
+    // page (offset 200, page size 100) comes back full, so row indexes reach
+    // 300 — adopt the observed extent instead of showing rows past the total.
+    state.pageOffset = 200;
+    state.result = pageResult();
+    await settle();
+    expect(totalText(host)).toContain("300");
+  });
+
   it("does not let an old manual count override a refreshed automatic count", async () => {
     let resolveCount!: (total: number) => void;
     const countTotalRows = vi.fn(() => new Promise<number>((resolve) => (resolveCount = resolve)));
```

**File**: `apps/desktop/src/lib/dataGrid/__tests__/dataGridPagination.spec.ts` (modified, +31/-1)
```diff
@@ -1,5 +1,5 @@
 import { describe, expect, it } from "vitest";
-import { ELASTICSEARCH_PAGE_JUMP_WARNING_REQUESTS, elasticsearchCursorPageJumpRequestCount, hasCompleteLocalDataGridResult } from "@/lib/dataGrid/dataGridPagination";
+import { ELASTICSEARCH_PAGE_JUMP_WARNING_REQUESTS, elasticsearchCursorPageJumpRequestCount, hasCompleteLocalDataGridResult, reconcileDataGridExactTotalWithObservedPage } from "@/lib/dataGrid/dataGridPagination";
 
 describe("Elasticsearch cursor page jumps", () => {
   it("counts only missing forward cursors", () => {
@@ -54,3 +54,33 @@ describe("complete local DataGrid results", () => {
     ).toBe(false);
   });
 });
+
+describe("reconciling an exact total with an observed page (#10968)", () => {
+  it("adopts the observed extent when a page lands past the counted total", () => {
+    // Issue screenshot: COUNT said 2892, but the counted last page (offset 2800,
+    // 200 rows) came back full from a snapshot holding more rows.
+    expect(reconcileDataGridExactTotalWithObservedPage({ offset: 2800, rowCount: 200, exactTotal: 2892 })).toBe(3000);
+  });
+
+  it("keeps the counted total for pages that fit inside it", () => {
+    expect(reconcileDataGridExactTotalWithObservedPage({ offset: 2800, rowCount: 92, exactTotal: 2892 })).toBeUndefined();
+    expect(reconcileDataGridExactTotalWithObservedPage({ offset: 0, rowCount: 200, exactTotal: 2892 })).toBeUndefined();
+    expect(reconcileDataGridExactTotalWithObservedPage({ offset: 400, rowCount: 200, exactTotal: 2892 })).toBeUndefined();
+  });
+
+  it("keeps the counted total when the page comes back short at its end", () => {
+    expect(reconcileDataGridExactTotalWithObservedPage({ offset: 2800, rowCount: 92, exactTotal: 2892 })).toBeUndefined();
+    expect(reconcileDataGridExactTotalWithObservedPage({ offset: 2800, rowCount: 0, exactTotal: 2892 })).toBeUndefined();
+  });
+
+  it("extends a zero or missing total as soon as rows are on screen", () => {
+    expect(reconcileDataGridExactTotalWithObservedPage({ offset: 0, rowCount: 5, exactTotal: 0 })).toBe(5);
+  });
+
+  it("ignores malformed offsets, rows, and totals", () => {
+    expect(reconcileDataGridExactTotalWithObservedPage({ offset: -1, rowCount: 200, exactTotal: 2892 })).toBeUndefined();
+    expect(reconcileDataGridExactTotalWithObservedPage({ offset: 2800, rowCount: -1, exactTotal: 2892 })).toBeUndefined();
+    expect(reconcileDataGridExactTotalWithObservedPage({ offset: Number.NaN, rowCount: 200, exactTotal: 2892 })).toBeUndefined();
+    expect(reconcileDataGridExactTotalWithObservedPage({ offset: 2800, rowCount: 200, exactTotal: Number.NaN })).toBeUndefined();
+  });
+});
```

**File**: `apps/desktop/src/lib/dataGrid/dataGridPagination.ts` (modified, +28/-0)
```diff
@@ -73,6 +73,34 @@ export function resolveDataGridPaginationTotal(options: { paginationTotalRowCoun
   return Math.min(total, options.maxRows);
 }
 
+export interface ReconcileDataGridExactTotalOptions {
+  offset: number;
+  rowCount: number;
+  exactTotal: number;
+}
+
+/**
+ * Total to display after a page landed with rows beyond the exact counted
+ * total, or `undefined` when the counted total still describes the page.
+ *
+ * The COUNT that produced the exact total and the query that served the page
+ * are two separate snapshots: rows can land between them (a table being
+ * written to), and an agent result session serves the snapshot it was opened
+ * with even after newer rows were counted. Rendering that page against the
+ * stale total shows row indexes past the claimed end of the result (#10968) —
+ * adopt the observed extent instead, so the displayed total always covers
+ * every row the grid actually shows.
+ */
+export function reconcileDataGridExactTotalWithObservedPage(options: ReconcileDataGridExactTotalOptions): number | undefined {
+  const { offset, rowCount, exactTotal } = options;
+  if (!Number.isSafeInteger(offset) || offset < 0) return undefined;
+  if (!Number.isSafeInteger(rowCount) || rowCount <= 0) return undefined;
+  if (!Number.isSafeInteger(exactTotal) || exactTotal < 0) return undefined;
+  const observedExtent = offset + rowCount;
+  if (observedExtent <= exactTotal) return undefined;
+  return observedExtent;
+}
+
 export function hasCompleteLocalDataGridResult(options: CompleteLocalDataGridResultOptions): boolean {
   if (!options.isResultsContext || options.truncated === true || options.hasMore === true) return false;
   if (options.pageLimit === undefined) return true;
```

---

### Incident Patch 2: `7c28b678` (2026-10-05)
**Commit Message**: fix(postgres): ignore zeroed stats entries masking reltuples

Closes #11072

**File**: `crates/dbx-driver-postgres/src/postgres.rs` (modified, +17/-3)
```diff
@@ -7479,8 +7479,16 @@ pub async fn get_custom_type_details(pool: &Pool, schema: &str, name: &str) -> R
 /// last known count, often `0` (#10461). `pg_stat_user_tables.n_live_tup` is the
 /// statistics collector's live estimate: it tracks DML within seconds and still
 /// avoids a `COUNT(*)` scan, which is what the UI promises in its column hint.
+///
+/// A zero `n_live_tup` only carries information when the collector has actually
+/// observed DML on the table (`n_tup_ins/upd/del`): after `pg_stat_reset()`, an
+/// import that bypasses the collector, or `pg_upgrade`, the entry reports zeros
+/// while a recent ANALYZE left a perfectly good `reltuples` behind — trusting the
+/// zero masked that count and showed a populated table as `0` rows (#11072).
+/// When no DML was observed, fall back to `reltuples` instead.
 const POSTGRES_OBJECT_STATISTICS_SQL: &str = "SELECT c.relname, \
-        GREATEST(COALESCE(s.n_live_tup, c.reltuples), 0)::bigint AS estimated_rows, \
+        GREATEST(CASE WHEN COALESCE(s.n_tup_ins, 0) + COALESCE(s.n_tup_upd, 0) + COALESCE(s.n_tup_del, 0) > 0 \
+        THEN COALESCE(s.n_live_tup, 0) ELSE c.reltuples END, 0)::bigint AS estimated_rows, \
         pg_catalog.pg_total_relation_size(c.oid)::bigint AS total_bytes \
  FROM pg_catalog.pg_class c \
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace \
@@ -15761,9 +15769,15 @@ mod tests {
     #[test]
     fn object_statistics_prefers_live_tuples_and_keeps_a_reltuples_fallback() {
         // #10461: `reltuples` lags behind DML, so the live estimate must win when
-        // `pg_stat_user_tables` is available...
+        // the collector has observed DML on the table...
         assert!(POSTGRES_OBJECT_STATISTICS_SQL.contains("pg_catalog.pg_stat_user_tables"));
-        assert!(POSTGRES_OBJECT_STATISTICS_SQL.contains("COALESCE(s.n_live_tup, c.reltuples)"));
+        assert!(POSTGRES_OBJECT_STATISTICS_SQL.contains("THEN COALESCE(s.n_live_tup, 0)"));
+        // ...while a zeroed collector entry (pg_stat_reset / pg_upgrade / an
+        // import that bypassed the collector, #11072) carries no information and
+        // must not mask a recent ANALYZE's `reltuples`.
+        assert!(POSTGRES_OBJECT_STATISTICS_SQL
+            .contains("WHEN COALESCE(s.n_tup_ins, 0) + COALESCE(s.n_tup_upd, 0) + COALESCE(s.n_tup_del, 0) > 0",));
+        assert!(POSTGRES_OBJECT_STATISTICS_SQL.contains("ELSE c.reltuples END"));
         // ...while an engine without that view still reports counts.
         assert!(!POSTGRES_OBJECT_STATISTICS_FALLBACK_SQL.contains("pg_stat_user_tables"));
         assert!(POSTGRES_OBJECT_STATISTICS_FALLBACK_SQL.contains("GREATEST(c.reltuples, 0)"));
```

---

### Incident Patch 3: `67b95659` (2026-10-05)
**Commit Message**: fix(sql): apply dialect rules when scanning comments and escapes for risk

**File**: `apps/desktop/src/lib/__tests__/sql/sqlRisk.dialect.spec.ts` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+import { describe, expect, it } from "vitest";
+import { classifySqlRisk, splitSqlStatementsForSafety, sqlSafetyText } from "@/lib/sql/sqlRisk";
+import { classifyAiSqlExecution } from "@/lib/ai/aiSqlExecutionPolicy";
+import type { ConnectionConfig } from "@/types/database";
+
+/**
+ * `#` line comments and backslash-escaped quotes are MySQL lexer features.
+ * Applying them to every dialect hid statements from the classifier, so a write
+ * placed after a SQL Server `#temp` reference or a PostgreSQL `'dir\'` string was
+ * read as comment/string content and the whole script was auto-executed.
+ */
+const sqlServerConnection: ConnectionConfig = {
+  id: "conn-sqlserver",
+  name: "Reporting",
+  db_type: "sqlserver",
+  host: "db.internal",
+  port: 1433,
+  username: "app",
+  password: "",
+};
+
+const postgresConnection: ConnectionConfig = {
+  id: "conn-postgres",
+  name: "Reporting",
+  db_type: "postgres",
+  host: "db.internal",
+  port: 5432,
+  username: "app",
+  password: "",
+};
+
+describe("SQL risk dialect lexer rules", () => {
+  it("keeps the SQL Server DELETE after a #temp reference", () => {
+    const sql = "SELECT * FROM #tmp; DELETE FROM #tmp;";
+
+    expect(sqlSafetyText(sql, "sqlserver")).toContain("DELETE FROM #tmp");
+    expect(splitSqlStatementsForSafety(sql, "sqlserver")).toEqual(["SELECT * FROM #tmp", "DELETE FROM #tmp"]);
+    expect(classifySqlRisk(sql, { dialect: "sqlserver" }).risk).toBe("write");
+  });
+
+  it("does not auto-execute a SQL Server write hidden behind a #temp reference", () => {
+    const sql = "SELECT * FROM #tmp; DELETE FROM #tmp;";
+
+    expect(classifyAiSqlExecution(sql, sqlServerConnection)).toMatchObject({
+      action: "confirm",
+      category: "write",
+    });
+  });
+
+  it("keeps the PostgreSQL DELETE after a string that ends in a backslash", () => {
+    const sql = "SELECT 'dir\\'; DELETE FROM users;";
+
+    expect(sqlSafetyText(sql, "postgres")).toContain("DELETE FROM users");
+    // The classifier blanks out literals, so only the DELETE text has to survive.
+    expect(splitSqlStatementsForSafety(sql, "postgres")).toEqual(["SELECT", "DELETE FROM users"]);
+    expect(classifySqlRisk(sql, { dialect: "postgres" }).risk).toBe("write");
+  });
+
+  it("does not auto-execute a PostgreSQL write hidden behind a backslash string", () => {
+    const sql = "SELECT 'dir\\'; DELETE FROM users;";
+
+    expect(classifyAiSqlExecution(sql, postgresConnection)).toMatchObject({
+      action: "confirm",
+      category: "write",
+    });
+  });
+
+  it("still reads # as a line comment on MySQL", () => {
+    const sql = "SELECT * FROM #tmp; DELETE FROM #tmp;";
+
+    expect(sqlSafetyText(sql, "mysql")).not.toContain("DELETE FROM #tmp");
+    expect(splitSqlStatementsForSafety(sql, "mysql")).toEqual(["SELECT * FROM"]);
+  });
+
+  it("still honours backslash-escaped quotes on MySQL", () => {
+    const sql = "INSERT INTO notes VALUES ('it\\'s; still one value'); SELECT 1;";
+
+    // The semicolon inside the escaped string must not split the statement; the
+    // literal itself is blanked out by the classifier.
+    expect(splitSqlStatementsForSafety(sql, "mysql")).toEqual(["INSERT INTO notes VALUES ( )", "SELECT 1"]);
+  });
+
+  it("fails closed for an unknown dialect", () => {
+    const sql = "SELECT * FROM #tmp; DELETE FROM #tmp;";
+
+    expect(splitSqlStatementsForSafety(sql)).toEqual(["SELECT * FROM #tmp", "DELETE FROM #tmp"]);
+    expect(classifySqlRisk(sql).risk).toBe("write");
+  });
+});
```

**File**: `apps/desktop/src/lib/ai/aiSqlExecutionPolicy.ts` (modified, +6/-6)
```diff
@@ -1,4 +1,4 @@
-import type { ConnectionConfig } from "@/types/database";
+import type { ConnectionConfig, DatabaseType } from "@/types/database";
 import { assessProductionSql, productionContextForDatabase } from "@/lib/database/productionSafety";
 import { classifySqlStatementRisk, splitSqlStatementsForSafety, sqlSafetyText } from "@/lib/sql/sqlRisk";
 
@@ -18,12 +18,12 @@ const NON_PRODUCTION_RE = /\b(local|localhost|dev|develop|development|test|testi
 const LOCAL_HOST_RE = /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|::1)$/i;
 const NEGATIVE_EXECUTION_RE = /(不要|别|不用|禁止|只生成|仅生成|只写|仅写).{0,12}(执行|运行|跑)|do\s+not\s+execute|don't\s+execute|dont\s+execute|without\s+executing|only\s+(generate|write|return)/i;
 
-export function stripAiSqlComments(sql: string): string {
-  return sqlSafetyText(sql);
+export function stripAiSqlComments(sql: string, dialect?: DatabaseType | string): string {
+  return sqlSafetyText(sql, dialect);
 }
 
-function sqlStatements(sql: string): string[] {
-  return splitSqlStatementsForSafety(sql);
+function sqlStatements(sql: string, connection?: ConnectionConfig): string[] {
+  return splitSqlStatementsForSafety(sql, connection?.db_type);
 }
 
 function classifyStatement(statement: string, connection?: ConnectionConfig): AiSqlExecutionCategory {
@@ -60,7 +60,7 @@ export function classifyConnectionEnvironment(connection?: ConnectionConfig, dat
 
 export function classifyAiSqlExecution(sql: string, connection?: ConnectionConfig, database?: string): AiSqlExecutionDecision {
   const environment = classifyConnectionEnvironment(connection, database);
-  const statements = sqlStatements(sql);
+  const statements = sqlStatements(sql, connection);
   const reasons: string[] = [];
 
   if (!statements.length) {
```

**File**: `apps/desktop/src/lib/sql/sqlRisk.ts` (modified, +31/-9)
```diff
@@ -32,6 +32,27 @@ const EXPLAIN_OPTION_KEYWORDS = new Set(["explain", "analyze", "analyse", "verbo
 const PRIMARY_STATEMENT_KEYWORDS = new Set([...READ_KEYWORDS, ...WRITE_KEYWORDS, ...DDL_KEYWORDS, ...TRANSACTION_KEYWORDS, "with", "copy", "pragma", "use", "set"]);
 const SAFE_READ_PRAGMA_NAMES = new Set(["table_info", "table_xinfo", "index_list", "index_info", "foreign_key_list", "database_list", "compile_options", "data_version"]);
 
+/**
+ * Engines whose lexer treats `#` as a line-comment opener and a backslash as a
+ * string escape. Both rules are MySQL family features: on SQL Server `#tmp` is a
+ * temporary table, and on PostgreSQL `standard_conforming_strings` is on by
+ * default, so `'dir\'` is a complete string. Assuming the MySQL rules everywhere
+ * hides SQL from the classifier — `SELECT * FROM #tmp; DELETE FROM #tmp;` (SQL
+ * Server) and `SELECT 'dir\'; DELETE FROM users;` (PostgreSQL) would otherwise be
+ * read as one read-only statement and auto-execute unconfirmed.
+ *
+ * Mirrors `is_mysql_compatible_database` in `crates/dbx-sql-core/src/sql.rs`,
+ * which gates `supports_hash_line_comments` the same way. An unknown dialect is
+ * deliberately not treated as MySQL: keeping `#` and backslashes literal can only
+ * split more statements than before, which raises the assessed risk rather than
+ * lowering it.
+ */
+const MYSQL_LEXER_DATABASE_TYPES = new Set<string>(["mysql", "doris", "starrocks", "manticoresearch", "goldendb"]);
+
+function usesMysqlLexerRules(dialect?: DatabaseType | string): boolean {
+  return typeof dialect === "string" && MYSQL_LEXER_DATABASE_TYPES.has(dialect.trim().toLowerCase());
+}
+
 const RISK_ORDER: Record<SqlRiskLevel, number> = {
   read: 0,
   write: 1,
@@ -40,8 +61,8 @@ const RISK_ORDER: Record<SqlRiskLevel, number> = {
   unknown: 4,
 };
 
-export function splitSqlStatementsForSafety(sql: string): string[] {
-  return sqlSafetyText(sql)
+export function splitSqlStatementsForSafety(sql: string, dialect?: DatabaseType | string): string[] {
+  return sqlSafetyText(sql, dialect)
     .split(";")
     .map((statement) => statement.trim())
     .filter(Boolean);
@@ -59,7 +80,7 @@ export function classifySqlRisk(sql: string, options: SqlRiskOptions = {}): SqlR
   const searchEngineRisk = searchEngineAssessment(sql, options.dialect, { elasticsearch: classifyElasticsearchSourceRisk, solr: classifySolrSourceRisk, couchdb: classifyCouchDbSourceRisk });
   if (searchEngineRisk) return { ...searchEngineRisk, statements: [searchEngineRisk] };
 
-  const statements = splitSqlStatementsForSafety(sql).map((statement) => classifySqlStatementRisk(statement, options));
+  const statements = splitSqlStatementsForSafety(sql, options.dialect).map((statement) => classifySqlStatementRisk(statement, options));
   if (!statements.length) return { risk: "unknown", statements: [] };
   const highest = statements.reduce<SqlRiskStatementAssessment>((current, statement) => (RISK_ORDER[statement.risk] > RISK_ORDER[current.risk] ? statement : current), { risk: "read" });
   return { ...highest, statements };
@@ -154,7 +175,8 @@ export function isSqlRiskMutation(risk: SqlRiskLevel): boolean {
   return risk !== "read";
 }
 
-export function sqlSafetyText(sql: string): string {
+export function sqlSafetyText(sql: string, dialect?: DatabaseType | string): string {
+  const mysqlLexer = usesMysqlLexerRules(dialect);
   let output = "";
   let index = 0;
 
@@ -169,7 +191,7 @@ export function sqlSafetyText(sql: string): string {
       continue;
     }
 
-    if (char === "#") {
+    if (char === "#" && mysqlLexer) {
       index += 1;
       while (index < sql.length && sql[index] !== "\n" && sql[index] !== "\r") index += 1;
       output += " ";
@@ -199,14 +221,14 @@ export function sqlSafetyText(sql: string): string {
     }
 
     if (char === "'") {
-      index = readQuotedEnd(sql, index, "'", "'");
+      index = readQuotedEnd(sql, index, "'", "'", mysqlLexer);
       output += " ";
       continue;
     }
 
     if (char === '"' || char === "`" || char === "[") {
       const close = char === "[" ? "]" : char;
-      const end = readQuotedEnd(sql, index, char, close);
+      const end = readQuotedEnd(sql, index, char, close, mysqlLexer);
       output += ` ${unquoteIdentifier(sql.slice(index, end), char, close).replace(/[;]/g, " ")} `;
       index = end;
       continue;
@@ -347,10 +369,10 @@ function dollarQuoteTagAt(sql: string, index: number): string | undefined {
   return match?.[0];
 }
 
-function readQuotedEnd(sql: string, start: number, open: string, close: string): number {
+function readQuotedEnd(sql: string, start: number, open: string, close: string, backslashEscapes: boolean): number {
   let index = start + open.length;
   while (index < sql.length) {
-    if (sql[index] === "\\" && (open === "'" || open === '"')) {
+    if (backslashEscapes && sql[index] === "\\" && (open === "'" || open === '"')) {
       index += 2;
       continue;
     }
```

---

### Incident Patch 4: `1a57e54f` (2026-10-05)
**Commit Message**: fix(safety): read the production scan with the connection's lexer rules

**File**: `crates/dbx-core/src/safety/production_safety.rs` (modified, +107/-10)
```diff
@@ -242,7 +242,7 @@ fn referenced_databases(
     include_read_references: bool,
 ) -> ReferencedDatabaseAssessment {
     let mut assessment = ReferencedDatabaseAssessment::default();
-    let cleaned = sql_target_safety_text(sql);
+    let cleaned = sql_target_safety_text(sql, db_type);
     let mut use_database = String::new();
     let normalized_active_database = normalize_database_name(active_database);
 
@@ -567,14 +567,75 @@ fn is_transaction_keyword(keyword: &str) -> bool {
     matches!(keyword, "begin" | "start" | "commit" | "rollback" | "abort" | "savepoint" | "release" | "end" | "declare")
 }
 
-fn sql_target_safety_text(sql: &str) -> SqlTargetSafetyText {
+fn sql_target_safety_text(sql: &str, db_type: &DatabaseType) -> SqlTargetSafetyText {
     let chars: Vec<char> = sql.chars().collect();
     let mut result = SqlTargetSafetyText { text: String::with_capacity(sql.len()), quoted_identifiers: HashMap::new() };
-    append_sql_target_safety_text(&chars, &mut result);
+    append_sql_target_safety_text(&chars, SqlScanLexerRules::for_database_type(db_type), &mut result);
     result
 }
 
-fn append_sql_target_safety_text(chars: &[char], result: &mut SqlTargetSafetyText) {
+/// Lexer rules this scan reads. Everything the scan removes is text no target can
+/// be found in, so claiming a feature the connection does not have hides writes
+/// from the production gate: `SELECT * FROM #tmp; DELETE FROM prod_db.dbo.users;`
+/// and `SELECT 'dir\'; DELETE FROM prod_db.dbo.users;` on SQL Server both lose the
+/// `DELETE` when `#` and backslashes are read as MySQL constructs. Only features
+/// the engine really has are assumed here, which can only make the gate stricter.
+#[derive(Clone, Copy)]
+struct SqlScanLexerRules {
+    /// `#` starts a line comment: a MySQL family feature. On SQL Server `#tmp` is
+    /// a temporary table, so the rest of the line is still SQL.
+    hash_line_comments: bool,
+    /// A backslash escapes the next character inside an ordinary `'...'` string.
+    backslash_escaped_quotes: bool,
+    /// `E'...'` literals escape with a backslash (PostgreSQL family).
+    postgres_escape_strings: bool,
+}
+
+impl SqlScanLexerRules {
+    fn for_database_type(db_type: &DatabaseType) -> Self {
+        let mysql_family = matches!(
+            db_type,
+            DatabaseType::Mysql
+                | DatabaseType::Doris
+                | DatabaseType::StarRocks
+                | DatabaseType::ManticoreSearch
+                | DatabaseType::Goldendb
+        );
+        let postgres_family = matches!(
+            db_type,
+            DatabaseType::Postgres
+                | DatabaseType::OpenGauss
+                | DatabaseType::Gaussdb
+                | DatabaseType::Vastbase
+                | DatabaseType::Kingbase
+                | DatabaseType::Highgo
+                | DatabaseType::Uxdb
+                | DatabaseType::Kwdb
+        );
+        Self {
+            hash_line_comments: mysql_family,
+            // Only claim the escape where the engine has it: MySQL, and
+            // PostgreSQL inside `E'...'`. Everywhere else a literal backslash can
+            // only make this scan see more text, which asks for confirmation
+            // sooner instead of hiding a write. (`ClickHouse` and Hive do escape,
+            // so they may ask once too often — the safe direction here.)
+            backslash_escaped_quotes: mysql_family,
+            postgres_escape_strings: postgres_family,
+        }
+    }
+}
+
+/// True when `prefix` ends with a PostgreSQL `E'`/`e'` introducer that starts its
+/// own token, so `DATE'2020-01-01'` and `x$e'...'` are ordinary strings.
+fn ends_with_escape_string_prefix(prefix: &[char]) -> bool {
+    let mut chars = prefix.iter().rev();
+    if !matches!(chars.next(), Some('E' | 'e')) {
+        return false;
+    }
+    !chars.next().is_some_and(|ch| ch.is_alphanumeric() || *ch == '_' || *ch == '$')
+}
+
+fn append_sql_target_safety_text(chars: &[char], rules: SqlScanLexerRules, result: &mut SqlTargetSafetyText) {
     let mut index = 0usize;
 
     while index < chars.len() {
@@ -589,7 +650,7 @@ fn append_sql_target_safety_text(chars: &[char], result: &mut SqlTargetSafetyTex
             result.text.push(' ');
             continue;
         }
-        if ch == '#' {
+        if ch == '#' && rules.hash_line_comments {
             index += 1;
             while index < chars.len() && chars[index] != '\n' && chars[index] != '\r' {
                 index += 1;
@@ -601,7 +662,7 @@ fn append_sql_target_safety_text(chars: &[char], result: &mut SqlTargetSafetyTex
             if let Some((body, close_index)) = mysql_executable_comment_body(chars, index) {
                 result.text.push(' ');
                 let body_chars: Vec<char> = body.chars().collect();
-                append_sql_target_safety_text(&body_chars, result);
+                append_sql_target_safety_text(&body_chars, rules, result);
                 result.text.pu
```

---

### Incident Patch 5: `5067514e` (2026-10-05)
**Commit Message**: fix(sql): read backslash escapes from the dialect string rules

**File**: `crates/dbx-sql-core/src/sql.rs` (modified, +194/-4)
```diff
@@ -135,6 +135,19 @@ pub struct SqlFileImportStatement {
 #[derive(Debug, Clone, Copy, PartialEq, Eq)]
 struct SqlDialectProfile {
     supports_hash_line_comments: bool,
+    /// Whether a backslash inside an ordinary `'...'` string escapes the next
+    /// character, so `'it\'s'` stays one string.
+    ///
+    /// This defaults to the historical behaviour (escape) because several
+    /// engines — MySQL and ClickHouse among them — do escape there, and the ones
+    /// that do not are listed explicitly below. PostgreSQL and its forks are the
+    /// engines this repository has evidence for: `standard_conforming_strings` is
+    /// on by default, which is also why the generated PostgreSQL SQL writes
+    /// newlines as `E'\n'` instead of `'\n'`.
+    supports_backslash_escaped_quotes: bool,
+    /// PostgreSQL escape string literals (`E'...'`), which keep backslash escapes
+    /// even where ordinary `'...'` literals do not.
+    supports_postgres_escape_strings: bool,
     supports_oracle_plsql_blocks: bool,
     supports_oracle_style_routine_bodies: bool,
     supports_slash_line_block_delimiter: bool,
@@ -154,6 +167,8 @@ impl Default for SqlDialectProfile {
     fn default() -> Self {
         Self {
             supports_hash_line_comments: false,
+            supports_backslash_escaped_quotes: true,
+            supports_postgres_escape_strings: false,
             supports_oracle_plsql_blocks: false,
             supports_oracle_style_routine_bodies: false,
             supports_slash_line_block_delimiter: false,
@@ -206,12 +221,38 @@ impl SqlDialectProfile {
             return Self::sap_hana();
         }
 
+        if Self::is_postgres_string_lexer_database(db_type) {
+            return Self {
+                supports_backslash_escaped_quotes: false,
+                supports_postgres_escape_strings: true,
+                ..Self::default()
+            };
+        }
+
         Self::default()
     }
 
+    /// PostgreSQL and the forks that inherit its string literal rules without
+    /// inheriting the routine/delimiter handling of [`Self::postgres_family`].
+    ///
+    /// Redshift is deliberately absent: it descends from PostgreSQL 8.0, which
+    /// predates `standard_conforming_strings` defaulting to `on`, so it keeps the
+    /// historical behaviour until its own evidence shows otherwise.
+    fn is_postgres_string_lexer_database(db_type: DatabaseType) -> bool {
+        matches!(
+            db_type,
+            DatabaseType::Vastbase
+                | DatabaseType::Kingbase
+                | DatabaseType::Highgo
+                | DatabaseType::Uxdb
+                | DatabaseType::Kwdb
+        )
+    }
+
     fn mysql_compatible() -> Self {
         Self {
             supports_hash_line_comments: true,
+            supports_backslash_escaped_quotes: true,
             supports_mysql_routine_blocks: true,
             requires_whitespace_after_line_comment_dashes: true,
             ..Self::default()
@@ -230,7 +271,9 @@ impl SqlDialectProfile {
     /// Oracle PL/SQL dialect.
     fn postgres_family() -> Self {
         Self {
+            supports_backslash_escaped_quotes: false,
             supports_oracle_style_routine_bodies: true,
+            supports_postgres_escape_strings: true,
             supports_slash_line_block_delimiter: true,
             supports_psql_control_commands: true,
             ..Self::default()
@@ -239,7 +282,9 @@ impl SqlDialectProfile {
 
     fn gaussdb() -> Self {
         Self {
+            supports_backslash_escaped_quotes: false,
             supports_postgres_dollar_quoted_routines: true,
+            supports_postgres_escape_strings: true,
             supports_psql_control_commands: true,
             ..Self::oracle_like()
         }
@@ -406,6 +451,9 @@ fn dash_dash_starts_line_comment(profile: SqlDialectProfile, char_after_dashes:
 pub struct SqlStatementSplitter {
     buffer: String,
     in_single_quote: bool,
+    /// Whether the open `'...'` literal reads a backslash as escaping the next
+    /// character: MySQL strings always do, PostgreSQL only inside `E'...'`.
+    single_quote_escape_string: bool,
     in_double_quote: bool,
     in_backtick: bool,
     in_line_comment: bool,
@@ -579,11 +627,22 @@ impl SqlStatementSplitter {
             }
 
             match ch {
-                '\'' if !self.in_double_quote && !self.in_backtick && !has_odd_trailing_backslashes(&self.buffer) => {
+                '\'' if !self.in_double_quote
+                    && !self.in_backtick
+                    && !(self.single_quote_backslash_escapes() && has_odd_trailing_backslashes(&self.buffer)) =>
+                {
                     self.in_single_quote = !self.in_single_quote;
+                    self.single_quote_escape_string = self.in_single_quote
+                        && (self.options.profile.supports_backslash_escaped_quotes
+                            || (self.options.profile.supports_postgres_escape_strings
+         
```

---

### Incident Patch 6: `de265287` (2026-10-05)
**Commit Message**: fix(postgres): preserve identity and sequence state in SQL exports

**File**: `crates/dbx-core/src/data/database_export.rs` (modified, +166/-38)
```diff
@@ -19,9 +19,9 @@ use crate::sql::{SqlParsingOptions, SqlStatementSplitter};
 use crate::sql_dialect::{qualified_table_name, uses_single_row_insert_statements};
 use crate::transfer::{
     format_ch_array_sql_literal, format_pg_array_sql_literal, format_postgres_vector_sql_literal,
-    is_identity_column_extra, is_mysql_generated_column_extra, is_postgres_vector_type,
-    keyset_pagination_sql_with_identifier_quote, quote_identifier, quote_postgres_string_literal,
-    wrap_dameng_identity_insert_sql_for_table,
+    is_identity_column_extra, is_mysql_generated_column_extra, is_postgres_generated_always_identity_extra,
+    is_postgres_vector_type, keyset_pagination_sql_with_identifier_quote, quote_identifier,
+    quote_postgres_string_literal, wrap_dameng_identity_insert_sql_for_table,
 };
 use crate::types::{ObjectSourceKind, SpatialColumn, SqlExportColumnSelection};
 
@@ -465,6 +465,7 @@ struct PostgresExportSequence {
     last_value: Option<String>,
     owner_table: Option<String>,
     owner_column: Option<String>,
+    created_by_table: bool,
 }
 
 #[derive(Debug, Clone, PartialEq, Eq)]
@@ -1523,7 +1524,17 @@ pub(crate) fn build_export_insert_statements_excluding_with_dialect(
     // `.sql` files stay readable in plain text editors. Statements that hold a
     // single tuple keep the compact `VALUES (..);` form, which also preserves
     // the "one INSERT per row" output of the single-row insert mode.
-    let statement_head = format!("INSERT INTO {table} ({columns}) VALUES");
+    let overriding = if options.database_type == Some(DatabaseType::Postgres)
+        && insert_columns.iter().any(|(index, _, _)| {
+            is_postgres_generated_always_identity_extra(
+                options.column_extras.get(*index).and_then(|value| value.as_deref()),
+            )
+        }) {
+        " OVERRIDING SYSTEM VALUE"
+    } else {
+        ""
+    };
+    let statement_head = format!("INSERT INTO {table} ({columns}){overriding} VALUES");
     let statement_prefix = format!("{statement_head} ");
     let output_database_type = if insert_dialect == SqlInsertDialect::Source { options.database_type } else { None };
     let statement_overhead_bytes = export_sql_statement_bytes(output_database_type, &statement_prefix) + 1;
@@ -2040,11 +2051,10 @@ fn postgres_sequence_qualified_name(schema: &str, sequence_name: &str) -> String
     }
 }
 
-fn generate_postgres_sequence_create_ddl(sequence: &PostgresExportSequence, schema: &str) -> String {
-    let qualified_name = postgres_sequence_qualified_name(schema, &sequence.name);
+fn postgres_sequence_options(sequence: &PostgresExportSequence) -> String {
     let cycle = if sequence.cycle { "CYCLE" } else { "NO CYCLE" };
     format!(
-        "CREATE SEQUENCE IF NOT EXISTS {qualified_name}\n  AS {data_type}\n  START WITH {start_value}\n  INCREMENT BY {increment}\n  MINVALUE {min_value}\n  MAXVALUE {max_value}\n  CACHE {cache_value}\n  {cycle}",
+        "  AS {data_type}\n  START WITH {start_value}\n  INCREMENT BY {increment}\n  MINVALUE {min_value}\n  MAXVALUE {max_value}\n  CACHE {cache_value}\n  {cycle}",
         data_type = sequence.data_type,
         start_value = sequence.start_value,
         increment = sequence.increment,
@@ -2054,33 +2064,73 @@ fn generate_postgres_sequence_create_ddl(sequence: &PostgresExportSequence, sche
     )
 }
 
-fn generate_postgres_sequence_owner_ddl(sequence: &PostgresExportSequence, schema: &str) -> Option<String> {
+fn generate_postgres_sequence_create_ddl(sequence: &PostgresExportSequence, schema: &str) -> String {
+    format!(
+        "CREATE SEQUENCE IF NOT EXISTS {}\n{}",
+        postgres_sequence_qualified_name(schema, &sequence.name),
+        postgres_sequence_options(sequence),
+    )
+}
+
+fn generate_postgres_sequence_post_table_ddl(sequence: &PostgresExportSequence, schema: &str) -> Option<String> {
     let owner_table = sequence.owner_table.as_deref()?;
     let owner_column = sequence.owner_column.as_deref()?;
+    let owner_table = crate::transfer::qualified_table(owner_table, schema, &DatabaseType::Postgres, None);
+    if sequence.created_by_table {
+        // CREATE TABLE owns the sequence. Configure that actual binding without
+        // relying on its name, and quote the whole DO body (identifiers may contain dollar tags).
+        let body = format!(
+            "BEGIN EXECUTE 'ALTER SEQUENCE ' || pg_get_serial_sequence({}, {}) || {}; END;",
+            quote_postgres_string_literal(&owner_table),
+            quote_postgres_string_literal(owner_column),
+            quote_postgres_string_literal(&format!(
+                "\n{} RESTART WITH {}",
+                postgres_sequence_options(sequence),
+                sequence.start_value
+            )),
+        );
+        return Some(format!("DO {}", quote_postgres_string_literal(&body)));
+    }
     Some(format!(
         "ALTER SEQUENCE {} OWNED BY {}.{}",
         postgres_sequence_qualified_name(schema, &sequence.name),
-        cra
```

**File**: `crates/dbx-core/src/data/transfer.rs` (modified, +8/-2)
```diff
@@ -1634,7 +1634,7 @@ fn is_postgres_identity_extra(extra: Option<&str>) -> bool {
     })
 }
 
-fn is_postgres_generated_always_identity_extra(extra: Option<&str>) -> bool {
+pub(crate) fn is_postgres_generated_always_identity_extra(extra: Option<&str>) -> bool {
     extra.is_some_and(|value| {
         let mut parts = value.split_whitespace();
         parts.next().is_some_and(|part| part.eq_ignore_ascii_case("generated"))
@@ -12415,7 +12415,13 @@ CREATE TABLE "Other"."prefix""Source"."NAME" ("ID" INT);"#;
         let dir = std::env::temp_dir().join(format!("dbx-transfer-test-{}", uuid::Uuid::new_v4()));
         std::fs::create_dir_all(&dir).unwrap();
         let storage = crate::persistence::test_storage::open(&dir.join("storage.db")).await.unwrap();
-        (AppState::new(storage), dir)
+        let state = AppState::new_with_plugin_and_agent_dir_and_app_version(
+            storage,
+            dir.join("plugins"),
+            dir.join("agents"),
+            env!("CARGO_PKG_VERSION"),
+        );
+        (state, dir)
     }
 
     async fn spawn_influxdb3_transfer_server() -> (String, tokio::task::JoinHandle<String>) {
```

**File**: `crates/dbx-core/tests/live_postgres_all_schema_export.rs` (modified, +251/-2)
```diff
@@ -2,8 +2,10 @@ use dbx_core::connection::AppState;
 use dbx_core::database_export::{export_database_sql_core, DatabaseExportRequest, ExportStatus};
 use dbx_core::models::connection::{ConnectionConfig, DatabaseType};
 use dbx_core::query::execute_sql_statement;
+use dbx_core::query_result_export::{export_query_result_core, QueryResultExportRequest};
 use dbx_core::sql::SqlFileRequest;
 use dbx_core::sql_file_import::execute_sql_file_path;
+use dbx_core::table_export::{export_table_data_core, TableExportRequest};
 use std::sync::{Arc, Mutex};
 use tokio_util::sync::CancellationToken;
 
@@ -45,7 +47,12 @@ async fn live_postgres_all_schema_export_restores_one_sql_file() {
     let dir = tempfile::tempdir().expect("create export temp directory");
     let storage =
         dbx_core::persistence::test_storage::open(&dir.path().join("storage.db")).await.expect("open temp storage");
-    let state = Arc::new(AppState::new(storage));
+    let state = Arc::new(AppState::new_with_plugin_and_agent_dir_and_app_version(
+        storage,
+        dir.path().join("plugins"),
+        dir.path().join("agents"),
+        env!("CARGO_PKG_VERSION"),
+    ));
     state
         .configs
         .write()
@@ -78,12 +85,41 @@ async fn live_postgres_all_schema_export_restores_one_sql_file() {
         "CREATE SCHEMA inventory",
         "CREATE SCHEMA reporting",
         "CREATE TABLE public.accounts (id integer PRIMARY KEY, name text NOT NULL)",
+        "CREATE TABLE public.identity_always (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text NOT NULL)",
+        "CREATE TABLE public.identity_default (id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, name text NOT NULL)",
+        "CREATE TABLE public.serial_ids (id serial PRIMARY KEY, name text NOT NULL)",
+        "CREATE TABLE public.identity_desc (id integer GENERATED ALWAYS AS IDENTITY (START WITH 0 INCREMENT BY -1 MINVALUE -100 MAXVALUE 0) PRIMARY KEY, name text NOT NULL)",
+        "CREATE TABLE public.identity_unused (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text NOT NULL)",
+        "CREATE TABLE public.serial_unused (id serial PRIMARY KEY, name text NOT NULL)",
+        "CREATE TABLE public.identity_empty (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY)",
+        "CREATE TABLE public.identity_cycle (id integer GENERATED ALWAYS AS IDENTITY (MINVALUE 1 MAXVALUE 5 CYCLE) PRIMARY KEY, name text NOT NULL)",
         "CREATE TABLE inventory.products (id integer PRIMARY KEY, sku text NOT NULL)",
         "CREATE TABLE reporting.daily_totals (day date PRIMARY KEY, amount numeric(12,2) NOT NULL)",
         "CREATE VIEW reporting.positive_totals AS SELECT day, amount FROM reporting.daily_totals WHERE amount > 0",
         "INSERT INTO public.accounts VALUES (1, 'Alice'), (2, 'Bob')",
         "INSERT INTO inventory.products VALUES (10, 'SKU-10')",
         "INSERT INTO reporting.daily_totals VALUES ('2026-09-07', 42.50)",
+        "INSERT INTO public.identity_always (name) VALUES ('one'), ('two')",
+        "INSERT INTO public.identity_default (name) VALUES ('one'), ('two')",
+        "INSERT INTO public.serial_ids (name) VALUES ('one'), ('two')",
+        "INSERT INTO public.identity_always OVERRIDING SYSTEM VALUE VALUES (42, 'explicit')",
+        "INSERT INTO public.identity_default VALUES (42, 'explicit')",
+        "INSERT INTO public.serial_ids VALUES (42, 'explicit')",
+        "ALTER SEQUENCE public.identity_always_id_seq RENAME TO renamed_identity_sequence",
+        "ALTER SEQUENCE public.renamed_identity_sequence MINVALUE -100 MAXVALUE 1000 CACHE 3 CYCLE",
+        "ALTER SEQUENCE public.serial_ids_id_seq START WITH 10 INCREMENT BY 5 MINVALUE 1 MAXVALUE 1000 CACHE 3 CYCLE",
+        "SELECT setval('public.renamed_identity_sequence', 80)",
+        "SELECT setval('public.identity_default_id_seq', 80)",
+        "SELECT setval('public.serial_ids_id_seq', 80)",
+        "INSERT INTO public.identity_desc (name) VALUES ('zero'), ('minus one')",
+        "INSERT INTO public.identity_desc OVERRIDING SYSTEM VALUE VALUES (-42, 'explicit')",
+        "SELECT setval('public.identity_desc_id_seq', -80)",
+        "INSERT INTO public.identity_unused OVERRIDING SYSTEM VALUE VALUES (1, 'explicit')",
+        "INSERT INTO public.serial_unused VALUES (1, 'explicit')",
+        "INSERT INTO public.identity_cycle (name) VALUES ('one')",
+        "INSERT INTO public.identity_cycle OVERRIDING SYSTEM VALUE VALUES (5, 'explicit')",
+        "SELECT setval('public.identity_cycle_id_seq', 5)",
+        "SELECT nextval('public.identity_cycle_id_seq')",
     ] {
         Box::pin(execute_sql_statement(&state, &source_connection_id, &source_database, statement, None, None))
             .await
@@ -97,7 +133,7 @@ async fn live_postgres_all_schema_export_restores_one_sql_file() {
         &state,
         &DatabaseExportRequest {
             export_id: format!("postgres-all-schema-export-{suffix}"),
-            connection_id: source_connection_id,
+
```

**File**: `crates/dbx-driver-postgres/src/postgres.rs` (modified, +4/-4)
```diff
@@ -4736,8 +4736,8 @@ fn postgres_columns_for_relations_sql() -> &'static str {
              ) AS is_pk, \
              col_description(a.attrelid, a.attnum) AS column_comment, \
              CASE a.attidentity \
-               WHEN 'd' THEN 'generated by default as identity' || CASE WHEN pseq.seqstart IS NOT NULL THEN format(' (start with %s increment by %s)', pseq.seqstart, pseq.seqincrement) ELSE '' END \
-               WHEN 'a' THEN 'generated always as identity' || CASE WHEN pseq.seqstart IS NOT NULL THEN format(' (start with %s increment by %s)', pseq.seqstart, pseq.seqincrement) ELSE '' END \
+               WHEN 'd' THEN 'generated by default as identity' || CASE WHEN pseq.seqstart IS NOT NULL THEN format(' (start with %s increment by %s minvalue %s maxvalue %s cache %s %s)', pseq.seqstart, pseq.seqincrement, pseq.seqmin, pseq.seqmax, pseq.seqcache, CASE WHEN pseq.seqcycle THEN 'cycle' ELSE 'no cycle' END) ELSE '' END \
+               WHEN 'a' THEN 'generated always as identity' || CASE WHEN pseq.seqstart IS NOT NULL THEN format(' (start with %s increment by %s minvalue %s maxvalue %s cache %s %s)', pseq.seqstart, pseq.seqincrement, pseq.seqmin, pseq.seqmax, pseq.seqcache, CASE WHEN pseq.seqcycle THEN 'cycle' ELSE 'no cycle' END) ELSE '' END \
                ELSE CASE a.attgenerated \
                  WHEN 's' THEN 'generated always as (' || pg_get_expr(ad.adbin, ad.adrelid) || ') stored' \
                  WHEN 'v' THEN 'generated always as (' || pg_get_expr(ad.adbin, ad.adrelid) || ') virtual' \
@@ -7594,8 +7594,8 @@ const POSTGRES_COLUMNS_SQL: &str = "SELECT a.attname AS column_name, \
              ) AS is_pk, \
              col_description(a.attrelid, a.attnum) AS column_comment, \
              CASE a.attidentity \
-               WHEN 'd' THEN 'generated by default as identity' || CASE WHEN pseq.seqstart IS NOT NULL THEN format(' (start with %s increment by %s)', pseq.seqstart, pseq.seqincrement) ELSE '' END \
-               WHEN 'a' THEN 'generated always as identity' || CASE WHEN pseq.seqstart IS NOT NULL THEN format(' (start with %s increment by %s)', pseq.seqstart, pseq.seqincrement) ELSE '' END \
+               WHEN 'd' THEN 'generated by default as identity' || CASE WHEN pseq.seqstart IS NOT NULL THEN format(' (start with %s increment by %s minvalue %s maxvalue %s cache %s %s)', pseq.seqstart, pseq.seqincrement, pseq.seqmin, pseq.seqmax, pseq.seqcache, CASE WHEN pseq.seqcycle THEN 'cycle' ELSE 'no cycle' END) ELSE '' END \
+               WHEN 'a' THEN 'generated always as identity' || CASE WHEN pseq.seqstart IS NOT NULL THEN format(' (start with %s increment by %s minvalue %s maxvalue %s cache %s %s)', pseq.seqstart, pseq.seqincrement, pseq.seqmin, pseq.seqmax, pseq.seqcache, CASE WHEN pseq.seqcycle THEN 'cycle' ELSE 'no cycle' END) ELSE '' END \
                ELSE CASE a.attgenerated \
                  WHEN 's' THEN 'generated always as (' || pg_get_expr(ad.adbin, ad.adrelid) || ') stored' \
                  WHEN 'v' THEN 'generated always as (' || pg_get_expr(ad.adbin, ad.adrelid) || ') virtual' \
```

---

### Incident Patch 7: `f19b62be` (2026-10-05)
**Commit Message**: fix(sql): quote PostgreSQL array literals with backslashes as escape strings

**File**: `crates/dbx-sql-core/src/value_literals.rs` (modified, +29/-1)
```diff
@@ -4,7 +4,11 @@ pub fn format_pg_array_sql_literal(arr: &[serde_json::Value]) -> String {
     }
     let elements: Vec<String> = arr.iter().map(format_pg_array_element).collect();
     let inner = format!("{{{}}}", elements.join(","));
-    format!("'{}'", inner.replace('\\', "\\\\").replace('\'', "''"))
+    // The array text already carries its own backslash escapes, so doubling
+    // them is only valid inside an escape string constant (E'...'); a plain
+    // '...' literal keeps backslashes verbatim under the default
+    // standard_conforming_strings = on.
+    quote_postgres_string_literal(&inner)
 }
 
 pub fn format_pg_array_element(val: &serde_json::Value) -> String {
@@ -148,3 +152,27 @@ pub fn format_postgres_vector_element(value: &serde_json::Value) -> String {
 pub fn quote_string_literal(value: &str) -> String {
     format!("'{}'", value.replace('\'', "''"))
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use serde_json::json;
+
+    #[test]
+    fn pg_array_literal_without_backslashes_stays_a_plain_string() {
+        assert_eq!(format_pg_array_sql_literal(&[]), "'{}'");
+        assert_eq!(format_pg_array_sql_literal(&[json!("a"), json!(null), json!(1)]), r#"'{"a",NULL,1}'"#);
+        assert_eq!(format_pg_array_sql_literal(&[json!("it's")]), r#"'{"it''s"}'"#);
+    }
+
+    #[test]
+    fn pg_array_literal_escapes_backslashes_inside_an_escape_string() {
+        // PostgreSQL reads E'{"C:\\\\tmp"}' as the array text {"C:\\tmp"},
+        // whose single element is C:\tmp.
+        assert_eq!(format_pg_array_sql_literal(&[json!(r"C:\tmp")]), r#"E'{"C:\\\\tmp"}'"#);
+        // A double quote is escaped as \" in the array text; without the E
+        // prefix PostgreSQL keeps both backslashes, the first escapes the
+        // second, and the quote then ends the element early.
+        assert_eq!(format_pg_array_sql_literal(&[json!(r#"say "hi""#)]), r#"E'{"say \\"hi\\""}'"#);
+    }
+}
```

---

### Incident Patch 8: `4778aa05` (2026-10-05)
**Commit Message**: fix(sql): match quote and dash-dash rules in cursor statement split

**File**: `crates/dbx-sql-core/src/sql.rs` (modified, +22/-7)
```diff
@@ -1056,7 +1056,10 @@ fn split_sql_statement_ranges_with_options(sql: &str, options: SqlParsingOptions
         }
 
         if !in_single_quote && !in_double_quote && !in_backtick {
-            if ch == '-' && next == Some('-') {
+            if ch == '-'
+                && next == Some('-')
+                && dash_dash_starts_line_comment(options.profile, next_char_at(sql, i + 2))
+            {
                 in_line_comment = true;
                 i += 2;
                 continue;
@@ -1118,11 +1121,11 @@ fn split_sql_statement_ranges_with_options(sql: &str, options: SqlParsingOptions
         }
 
         match ch {
-            '\'' if !in_double_quote && !in_backtick && !is_escaped_single_quote(sql, i) => {
+            '\'' if !in_double_quote && !in_backtick && !has_odd_trailing_backslashes(&sql[start..i]) => {
                 in_single_quote = !in_single_quote;
                 i += ch.len_utf8();
             }
-            '"' if !in_single_quote && !in_backtick => {
+            '"' if !in_single_quote && !in_backtick && !has_odd_trailing_backslashes(&sql[start..i]) => {
                 in_double_quote = !in_double_quote;
                 i += ch.len_utf8();
             }
@@ -1253,10 +1256,6 @@ fn next_char_len(sql: &str, index: usize) -> usize {
     next_char(sql, index).len_utf8()
 }
 
-fn is_escaped_single_quote(sql: &str, index: usize) -> bool {
-    index > 0 && sql.as_bytes().get(index - 1) == Some(&b'\\')
-}
-
 fn is_on_delimiter_line(sql: &str, range_start: usize, index: usize, options: SqlParsingOptions) -> bool {
     let line_start = sql[range_start..index].rfind('\n').map_or(range_start, |pos| range_start + pos + 1);
     sql[line_start..index].trim_start().as_bytes().get(..9).is_some_and(|prefix| {
@@ -3357,6 +3356,22 @@ mod tests {
         );
     }
 
+    #[test]
+    fn cursor_statement_closes_mysql_string_after_escaped_backslash() {
+        let sql = "SELECT 'a\\\\';\nSELECT 2;";
+        let cursor = sql.find("SELECT 2").unwrap() + 3;
+        assert_eq!(find_statement_at_cursor_for_database(sql, cursor, DatabaseType::Mysql), "SELECT 2");
+        assert_eq!(find_statement_at_cursor_for_database(sql, 3, DatabaseType::Mysql), "SELECT 'a\\\\'");
+    }
+
+    #[test]
+    fn cursor_statement_treats_mysql_dash_dash_without_space_as_minus() {
+        let sql = "SELECT 5--1;\nSELECT 2;";
+        let cursor = sql.find("SELECT 2").unwrap() + 3;
+        assert_eq!(find_statement_at_cursor_for_database(sql, cursor, DatabaseType::Mysql), "SELECT 2");
+        assert_eq!(find_statement_at_cursor_for_database(sql, 3, DatabaseType::Mysql), "SELECT 5--1");
+    }
+
     #[test]
     fn keeps_mysql_string_open_after_odd_trailing_backslashes() {
         let sql = r#"INSERT INTO notes VALUES ('it\'s; still one value'); SELECT 1;"#;
```

---

### Incident Patch 9: `1d9223ee` (2026-10-04)
**Commit Message**: fix(mongodb): honour directConnection in the legacy agent

**File**: `agents/drivers/mongodb/src/main/java/com/dbx/agent/mongodb/MongoAgent.java` (modified, +52/-1)
```diff
@@ -16,6 +16,7 @@
 import com.mongodb.MongoCredential;
 import com.mongodb.MongoClientSettings;
 import com.mongodb.ServerAddress;
+import com.mongodb.connection.ClusterConnectionMode;
 import com.mongodb.bulk.BulkWriteError;
 import com.mongodb.bulk.WriteConcernError;
 import com.mongodb.client.AggregateIterable;
@@ -153,7 +154,17 @@ static MongoClientSettings.Builder configureBuilder(JsonObject connObj) {
 
         MongoClientSettings.Builder builder = MongoClientSettings.builder();
         if (connectionString != null && !connectionString.isBlank()) {
-            builder.applyConnectionString(new ConnectionString(connectionString));
+            ConnectionString cs = new ConnectionString(connectionString);
+            builder.applyConnectionString(cs);
+            // Driver 3.12 predates the directConnection URI option (introduced in driver 4.x)
+            // and silently ignores it. When directConnection=true is present in the query of a
+            // single-host URI, force ClusterConnectionMode.SINGLE so the driver connects directly
+            // to that host instead of discovering replica-set members that may be unreachable
+            // (e.g. through an SSH tunnel). We preserve requiredReplicaSetName as parsed because
+            // ClusterSettings in 3.12 accepts it in SINGLE mode to validate the replica set name.
+            if (!cs.isSrvProtocol() && cs.getHosts().size() == 1 && hasDirectConnectionTrue(connectionString)) {
+                builder.applyToClusterSettings(settings -> settings.mode(ClusterConnectionMode.SINGLE));
+            }
         } else {
             builder.applyToClusterSettings(
                 settings -> settings.hosts(Collections.singletonList(new ServerAddress(host, port))));
@@ -169,6 +180,46 @@ static MongoClientSettings.Builder configureBuilder(JsonObject connObj) {
         return builder;
     }
 
+    static boolean hasDirectConnectionTrue(String connectionString) {
+        if (connectionString == null) {
+            return false;
+        }
+        int hashStart = connectionString.indexOf('#');
+        int queryStart = connectionString.indexOf('?');
+        if (queryStart < 0 || (hashStart >= 0 && queryStart > hashStart)) {
+            return false;
+        }
+        int queryEnd = hashStart >= 0 ? hashStart : connectionString.length();
+        String query = connectionString.substring(queryStart + 1, queryEnd);
+        if (query.isEmpty()) {
+            return false;
+        }
+
+        Boolean directConnection = null;
+        for (String param : query.split("[&;]")) {
+            if (param.isEmpty()) {
+                continue;
+            }
+            int eq = param.indexOf('=');
+            String key = eq >= 0 ? param.substring(0, eq) : param;
+            String val = eq >= 0 ? param.substring(eq + 1) : "";
+            String decodedKey = decodeUriComponent(key);
+            String decodedVal = decodeUriComponent(val);
+            if ("directConnection".equalsIgnoreCase(decodedKey)) {
+                directConnection = "true".equalsIgnoreCase(decodedVal);
+            }
+        }
+        return Boolean.TRUE.equals(directConnection);
+    }
+
+    private static String decodeUriComponent(String s) {
+        try {
+            return URLDecoder.decode(s, StandardCharsets.UTF_8);
+        } catch (IllegalArgumentException e) {
+            return s;
+        }
+    }
+
     private static MongoClient openClient(JsonObject params) {
         JsonObject connObj = params.has("connection") && params.get("connection").isJsonObject()
             ? params.getAsJsonObject("connection")
```

**File**: `agents/drivers/mongodb/src/test/java/com/dbx/agent/mongodb/MongoAgentTest.java` (modified, +113/-0)
```diff
@@ -17,6 +17,7 @@
 import com.mongodb.MongoCommandException;
 import com.mongodb.MongoClientSettings;
 import com.mongodb.ServerAddress;
+import com.mongodb.connection.ClusterConnectionMode;
 import com.mongodb.bulk.BulkWriteError;
 import com.mongodb.bulk.BulkWriteResult;
 import com.mongodb.bulk.WriteConcernError;
@@ -1520,6 +1521,118 @@ void fallsBackToAdminWhenAuthSourceIsMissing() {
         assertEquals("admin", MongoAgent.authenticationDatabase(connection));
     }
 
+    // ─── Direct connection: configureBuilder directConnection parsing ───
+
+    @Test
+    void configureBuilderWithDirectConnectionTrueSetsSingleModeAndKeepsReplicaSetName() {
+        JsonObject connection = new JsonObject();
+        connection.addProperty(
+            "connection_string",
+            "mongodb://u:p@127.0.0.1:27017/admin?replicaSet=cardetail&directConnection=true&authSource=admin");
+
+        MongoClientSettings settings = MongoAgent.configureBuilder(connection).build();
+
+        assertEquals(ClusterConnectionMode.SINGLE, settings.getClusterSettings().getMode());
+        assertEquals("cardetail", settings.getClusterSettings().getRequiredReplicaSetName());
+    }
+
+    @Test
+    void configureBuilderWithCaseInsensitiveDirectConnectionSetsSingleMode() {
+        JsonObject connection = new JsonObject();
+        connection.addProperty(
+            "connection_string",
+            "mongodb://u:p@127.0.0.1:27017/admin?replicaSet=cardetail&DirectConnection=TRUE&authSource=admin");
+
+        MongoClientSettings settings = MongoAgent.configureBuilder(connection).build();
+
+        assertEquals(ClusterConnectionMode.SINGLE, settings.getClusterSettings().getMode());
+        assertEquals("cardetail", settings.getClusterSettings().getRequiredReplicaSetName());
+    }
+
+    @Test
+    void configureBuilderWithReplicaSetWithoutDirectConnectionDefaultsToMultipleMode() {
+        JsonObject connection = new JsonObject();
+        connection.addProperty(
+            "connection_string",
+            "mongodb://u:p@127.0.0.1:27017/admin?replicaSet=cardetail&authSource=admin");
+
+        MongoClientSettings settings = MongoAgent.configureBuilder(connection).build();
+
+        assertEquals(ClusterConnectionMode.MULTIPLE, settings.getClusterSettings().getMode());
+        assertEquals("cardetail", settings.getClusterSettings().getRequiredReplicaSetName());
+    }
+
+    @Test
+    void configureBuilderWithDirectConnectionFalseAndReplicaSetLeavesMultipleMode() {
+        JsonObject connection = new JsonObject();
+        connection.addProperty(
+            "connection_string",
+            "mongodb://u:p@127.0.0.1:27017/admin?directConnection=false&replicaSet=cardetail&authSource=admin");
+
+        MongoClientSettings settings = MongoAgent.configureBuilder(connection).build();
+
+        assertEquals(ClusterConnectionMode.MULTIPLE, settings.getClusterSettings().getMode());
+        assertEquals("cardetail", settings.getClusterSettings().getRequiredReplicaSetName());
+    }
+
+    @Test
+    void configureBuilderSingleHostNoOptionsRemainsUnchanged() {
+        JsonObject connection = new JsonObject();
+        connection.addProperty("connection_string", "mongodb://127.0.0.1:27017");
+
+        MongoClientSettings settings = MongoAgent.configureBuilder(connection).build();
+
+        assertEquals(ClusterConnectionMode.SINGLE, settings.getClusterSettings().getMode());
+    }
+
+    @Test
+    void configureBuilderTwoHostsWithDirectConnectionTrueRemainsMultipleMode() {
+        JsonObject connection = new JsonObject();
+        connection.addProperty(
+            "connection_string",
+            "mongodb://127.0.0.1:27017,127.0.0.1:27018/?replicaSet=cardetail&directConnection=true");
+
+        MongoClientSettings settings = MongoAgent.configureBuilder(connection).build();
+
+        assertEquals(ClusterConnectionMode.MULTIPLE, settings.getClusterSettings().getMode());
+    }
+
+    @Test
+    void configureBuilderWithPercentEncodedDirectConnectionSetsSingleMode() {
+        JsonObject connection = new JsonObject();
+        connection.addProperty(
+            "connection_string",
+            "mongodb://u:p@127.0.0.1:27017/admin?replicaSet=cardetail&%64irect%43onnection=%74rue&authSource=admin");
+
+        MongoClientSettings settings = MongoAgent.configureBuilder(connection).build();
+
+        assertEquals(ClusterConnectionMode.SINGLE, settings.getClusterSettings().getMode());
+        assertEquals("cardetail", settings.getClusterSettings().getRequiredReplicaSetName());
+    }
+
+    @Test
+    void hasDirectConnectionTrueHandlesVariousQueryFormats() {
+        assertTrue(MongoAgent.hasDirectConnectionTrue("mongodb://127.0.0.1:27017/?directConnection=true"));
+        assertTrue(MongoAgent.hasDirectConnectionTrue("mongodb://127.0.0.1:27017/?DirectConnection=TRUE"));
+        assertTrue(MongoAgent.hasDirectConnectionTrue("mongodb://127.0.0.1:27017/?directconnection=true&other=1"));
+        assertTrue(MongoAgent.h
```

---

### Incident Patch 10: `75c91227` (2026-10-04)
**Commit Message**: fix(secrets): unlock Secret Service items on retry

Closes #11052

**File**: `apps/desktop/src/components/migration/SecurityMigrationWizard.spec.ts` (modified, +2/-0)
```diff
@@ -31,6 +31,8 @@ describe("migration failure actions", () => {
       button("migration.retryStatus").click();
       await nextTick();
       expect(backend.migrationStatus).toHaveBeenCalledTimes(2);
+      expect(backend.migrationStatus).toHaveBeenNthCalledWith(1, false);
+      expect(backend.migrationStatus).toHaveBeenNthCalledWith(2, true);
       expect(backend.migrationRetry).not.toHaveBeenCalled();
     } finally {
       app.unmount();
```

**File**: `apps/desktop/src/components/migration/SecurityMigrationWizard.vue` (modified, +2/-2)
```diff
@@ -148,7 +148,7 @@ async function diagnostic() {
             <p>{{ t(errorAdviceKey) }}</p>
           </div>
           <div class="flex flex-wrap gap-3">
-            <button v-if="props.store.state.error === 'statusFailed' || (status?.keyProviderAvailable === false && !status?.keyCreationAllowed)" class="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" :disabled="props.store.state.busy" @click="props.store.initialize">
+            <button v-if="props.store.state.error === 'statusFailed' || (status?.keyProviderAvailable === false && !status?.keyCreationAllowed)" class="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" :disabled="props.store.state.busy" @click="props.store.retryStatus">
               {{ t("migration.retryStatus") }}</button
             ><button
               v-else
@@ -173,7 +173,7 @@ async function diagnostic() {
             <p class="mt-3 text-sm text-muted-foreground">{{ props.store.state.error ? t(errorAdviceKey) : t("migration.progress") }}</p>
           </div>
           <div v-if="props.store.state.error" class="flex flex-wrap gap-3">
-            <button class="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" :disabled="props.store.state.busy" @click="props.store.state.error === 'statusFailed' ? props.store.initialize() : props.store.retry()">
+            <button class="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" :disabled="props.store.state.busy" @click="props.store.state.error === 'statusFailed' ? props.store.retryStatus() : props.store.retry()">
               {{ props.store.state.busy ? t("migration.running") : props.store.state.error === "statusFailed" ? t("migration.retryStatus") : t("migration.retryMigration") }}</button
             ><button class="rounded-md border px-4 py-2 disabled:opacity-50" :disabled="props.store.state.busy" @click="diagnostic">{{ t("migration.exportDiagnostic") }}</button
             ><button class="rounded-md border px-4 py-2 disabled:opacity-50" :disabled="props.store.state.busy" @click="exitApp">{{ t("migration.exit") }}</button>
```

**File**: `apps/desktop/src/lib/backend/__tests__/cloudSyncWebApi.spec.ts` (modified, +11/-0)
```diff
@@ -125,6 +125,17 @@ describe("WebDAV sync HTTP API", () => {
     await expect(migrationCleanupBackups()).resolves.toBeUndefined();
     expect(lastCall(fetchMock)).toEqual({ url: "/api/migration/cleanup-backups", body: {} });
   });
+
+  it("forwards explicit migration status retries to the Web backend", async () => {
+    const fetchMock = stubFetch({});
+    const { migrationStatus } = await import("@/lib/backend/http");
+
+    await migrationStatus();
+    await migrationStatus(true);
+
+    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/migration/status");
+    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/migration/status?retry=true");
+  });
 });
 
 describe("GitLab snippet sync HTTP API", () => {
```

**File**: `apps/desktop/src/lib/backend/http.ts` (modified, +1/-1)
```diff
@@ -205,7 +205,7 @@ import type { PluginToolPreview } from "@/types/pluginAiTools";
 import type { CsvQuoteMode } from "@/lib/export/csvQuoteMode";
 import type { MigrationPreflight, MigrationReport } from "./migration";
 export type { MigrationPreflight, MigrationReport } from "./migration";
-export const migrationStatus = (): Promise<MigrationPreflight> => get("/api/migration/status");
+export const migrationStatus = (retry = false): Promise<MigrationPreflight> => get(`/api/migration/status${retry ? "?retry=true" : ""}`);
 export const migrationStart = (): Promise<MigrationReport> => post("/api/migration/start", {});
 export const migrationRetry = (): Promise<MigrationReport> => post("/api/migration/retry", {});
 export const migrationCleanupBackups = (): Promise<void> => post("/api/migration/cleanup-backups", {});
```

**File**: `apps/desktop/src/lib/backend/tauri.ts` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>
 
 import type { MigrationPreflight, MigrationReport } from "./migration";
 export type { MigrationPreflight, MigrationReport } from "./migration";
-export const migrationStatus = (): Promise<MigrationPreflight> => invoke("migration_status");
+export const migrationStatus = (retry = false): Promise<MigrationPreflight> => invoke("migration_status", { retry });
 export const migrationStart = (): Promise<MigrationReport> => invoke("migration_start");
 export const migrationRetry = (): Promise<MigrationReport> => invoke("migration_retry");
 export const migrationCleanupBackups = (): Promise<void> => invoke("migration_cleanup_backups");
```

**File**: `apps/desktop/src/stores/migrationStore.spec.ts` (modified, +4/-2)
```diff
@@ -74,9 +74,11 @@ describe("migration store", () => {
     expect(store.state.error).toBe("statusFailed");
     expect(store.state.errorCode).toBeNull();
     expect(store.state.errorMessage).toBeNull();
-    await store.initialize();
+    await store.retryStatus();
     expect(store.state.error).toBeNull();
     expect(store.completed.value).toBe(true);
+    expect(status).toHaveBeenNthCalledWith(1, false);
+    expect(status).toHaveBeenNthCalledWith(2, true);
   });
   it("discards arbitrary transport exception values in state and diagnostics", async () => {
     const secret = "password=DO_NOT_EXPOSE";
@@ -194,7 +196,7 @@ describe("migration store", () => {
     await store.initialize();
     await store.start();
     expect(store.state.error).toBe("statusFailed");
-    await store.initialize();
+    await store.retryStatus();
     expect(store.completed.value).toBe(true);
     expect(store.state.report).toBeNull();
     expect(store.blocking.value).toBe(true);
```

**File**: `apps/desktop/src/stores/migrationStore.ts` (modified, +7/-5)
```diff
@@ -32,18 +32,18 @@ export function useMigrationStore(backend: MigrationApi = api) {
     state.errorCode = null;
     state.errorMessage = null;
   }
-  async function refreshStatus() {
+  async function refreshStatus(retry = false) {
     // Only this endpoint returns classified, redacted migration errors. Transport
     // exceptions may contain configuration values and must never enter UI state.
-    state.status = await backend.migrationStatus();
+    state.status = await backend.migrationStatus(retry);
     state.errorCode = state.status.errorCode ?? null;
     state.errorMessage = state.status.errorMessage ?? null;
   }
-  async function initialize() {
+  async function checkStatus(retry: boolean) {
     state.loading = true;
     clearError();
     try {
-      await refreshStatus();
+      await refreshStatus(retry);
       state.step = completed.value ? 3 : 1;
       // A completed migration only needs the success page in the session that
       // performed it. On later launches, retained backups are recovery assets,
@@ -57,6 +57,8 @@ export function useMigrationStore(backend: MigrationApi = api) {
       state.loading = false;
     }
   }
+  const initialize = () => checkStatus(false);
+  const retryStatus = () => checkStatus(true);
   async function run(retry: boolean) {
     if (state.busy) return;
     state.busy = true;
@@ -114,5 +116,5 @@ export function useMigrationStore(backend: MigrationApi = api) {
   function enter() {
     if (completed.value && !state.busy) state.entered = true;
   }
-  return { state, blocking, completed, initialize, start: () => run(false), retry: () => run(true), cleanup, diagnostic, enter };
+  return { state, blocking, completed, initialize, retryStatus, start: () => run(false), retry: () => run(true), cleanup, diagnostic, enter };
 }
```

**File**: `crates/dbx-core/src/persistence/secret_codec.rs` (modified, +107/-6)
```diff
@@ -345,6 +345,31 @@ where
     worker.join().map_err(|_| "KEYRING_ACCESS_FAILED: secret service worker failed".to_string())?
 }
 
+#[cfg(any(test, all(feature = "os-keyring", target_os = "linux")))]
+fn read_secret_service_item<I, U, R, E>(mut is_locked: I, mut unlock: U, mut read: R) -> Result<Vec<u8>, String>
+where
+    I: FnMut() -> Result<bool, E>,
+    U: FnMut() -> Result<(), E>,
+    R: FnMut() -> Result<Vec<u8>, E>,
+    E: std::fmt::Display,
+{
+    let locked =
+        is_locked().map_err(|error| format!("KEYRING_ACCESS_FAILED: secret lock status check failed: {error}"))?;
+    if locked {
+        // Unlock drives the provider's prompt flow (KWallet, GNOME Keyring,
+        // and other Secret Service implementations). Never treat a denied or
+        // failed prompt as a missing item: doing so could provision a
+        // replacement key and strand existing ciphertext.
+        unlock().map_err(|error| format!("KEYRING_ACCESS_FAILED: secret unlock failed: {error}"))?;
+        let still_locked = is_locked()
+            .map_err(|error| format!("KEYRING_ACCESS_FAILED: secret lock status check failed after unlock: {error}"))?;
+        if still_locked {
+            return Err("KEYRING_ACCESS_FAILED: secret remained locked after unlock".to_string());
+        }
+    }
+    read().map_err(|error| format!("KEYRING_ACCESS_FAILED: secret read failed: {error}"))
+}
+
 #[cfg(all(feature = "os-keyring", target_os = "linux"))]
 fn secret_service_keyring_codec(allow_create: bool) -> Result<Option<SecretCodec>, String> {
     use secret_service::{blocking::SecretService, EncryptionType, Error as SecretServiceError};
@@ -372,8 +397,7 @@ fn secret_service_keyring_codec(allow_create: bool) -> Result<Option<SecretCodec
 
     let item = search.unlocked.into_iter().next().or_else(|| search.locked.into_iter().next());
     if let Some(item) = item {
-        let secret =
-            item.get_secret().map_err(|error| format!("KEYRING_ACCESS_FAILED: secret read failed: {error}"))?;
+        let secret = read_secret_service_item(|| item.is_locked(), || item.unlock(), || item.get_secret())?;
         let material = String::from_utf8(secret).map_err(|_| "SECRET_KEY_INVALID".to_string())?;
         let codec = SecretCodec::from_key_material(material.trim()).map_err(|_| "SECRET_KEY_INVALID".to_string())?;
         return Ok(Some(codec));
@@ -411,8 +435,7 @@ fn secret_service_keyring_codec(allow_create: bool) -> Result<Option<SecretCodec
     let item = found.into_iter().next();
     match item {
         Some(item) => {
-            let secret =
-                item.get_secret().map_err(|error| format!("KEYRING_ACCESS_FAILED: secret read failed: {error}"))?;
+            let secret = read_secret_service_item(|| item.is_locked(), || item.unlock(), || item.get_secret())?;
             let material = String::from_utf8(secret).map_err(|_| "SECRET_KEY_INVALID".to_string())?;
             let codec =
                 SecretCodec::from_key_material(material.trim()).map_err(|_| "SECRET_KEY_INVALID".to_string())?;
@@ -599,8 +622,8 @@ mod tests {
     }
 
     use super::{
-        managed_key_path, read_key_file_with_retry, run_secret_service_operation, SecretCodec, SecretKeyPolicy,
-        SecretKeySource,
+        managed_key_path, read_key_file_with_retry, read_secret_service_item, run_secret_service_operation,
+        SecretCodec, SecretKeyPolicy, SecretKeySource,
     };
     use base64::Engine as _;
     use std::sync::{Mutex, OnceLock};
@@ -699,6 +722,84 @@ mod tests {
         assert!(!path.exists());
     }
 
+    #[test]
+    fn locked_secret_service_item_is_unlocked_before_read() {
+        use std::cell::{Cell, RefCell};
+
+        let locked = Cell::new(true);
+        let calls = RefCell::new(Vec::new());
+        let secret = read_secret_service_item(
+            || {
+                calls.borrow_mut().push("is_locked");
+                Ok::<_, &'static str>(locked.get())
+            },
+            || {
+                calls.borrow_mut().push("unlock");
+                locked.set(false);
+                Ok::<_, &'static str>(())
+            },
+            || {
+                calls.borrow_mut().push("read");
+                Ok::<_, &'static str>(b"secret".to_vec())
+            },
+        )
+        .unwrap();
+
+        assert_eq!(secret, b"secret");
+        assert_eq!(*calls.borrow(), ["is_locked", "unlock", "is_locked", "read"]);
+    }
+
+    #[test]
+    fn unlocked_secret_service_item_is_read_without_an_unlock_prompt() {
+        let unlock_called = std::cell::Cell::new(false);
+        let secret = read_secret_service_item(
+            || Ok::<_, &'static str>(false),
+            || {
+                unlock_called.set(true);
+                Ok::<_, &'static str>(())
+            },
+            || Ok::<_, &'static str>(b"secret".to_vec()),
+        )
+        .unwrap();
+
+        assert_eq!(secret, b"secret");
+        assert!(!unlock_called.get());
+    }
+
+    #[test]
+    fn
```

---

### Incident Patch 11: `320e37aa` (2026-10-04)
**Commit Message**: fix(jdbc): expose routine parameter metadata

Closes #11045

**File**: `apps/desktop/src/components/objects/ObjectSourceDialog.vue` (modified, +5/-3)
```diff
@@ -9,7 +9,7 @@ import { copyToClipboard } from "@/lib/common/clipboard";
 import { formatSqlForDisplay, type SqlFormatDialect } from "@/lib/sql/sqlFormatter";
 import { buildEditableObjectSource, buildExecutableObjectSourceStatements, executeObjectSourceSave, formatObjectSourceSaveError, resolveObjectSourceEditDraft } from "@/lib/table/objectSourceEditor";
 import { loadObjectSourceWithRoutineFallback } from "@/lib/table/objectSourceLoad";
-import { xuguRoutineMetadataFromDefinition, type XuguRoutineMetadata } from "@/lib/table/routineParameters";
+import { jdbcRoutineMetadata, xuguRoutineMetadataFromDefinition, type RoutineMetadata } from "@/lib/table/routineParameters";
 import { executeWithProductionSqlGuard } from "@/lib/database/productionExecutionGuard";
 import * as api from "@/lib/backend/api";
 import QueryEditor from "@/components/editor/QueryEditor.vue";
@@ -57,7 +57,7 @@ const editing = ref(false);
 const sourceEditable = ref(true);
 const error = ref("");
 const saveError = ref("");
-const routineMetadata = ref<XuguRoutineMetadata | null>(null);
+const routineMetadata = ref<RoutineMetadata | null>(null);
 /** May differ from props.objectType after PROCEDURE/FUNCTION/PACKAGE fallback resolution. */
 const resolvedObjectType = ref<ObjectSourceKind>(props.objectType);
 let loadSerial = 0;
@@ -111,7 +111,8 @@ async function loadSource(nextEditing = props.initialEditing && canEdit.value) {
     });
     if (serial !== loadSerial) return;
     resolvedObjectType.value = resolvedType;
-    routineMetadata.value = props.databaseType === "xugu" && (resolvedType === "PROCEDURE" || resolvedType === "FUNCTION") ? xuguRoutineMetadataFromDefinition(result.source) : null;
+    const isRoutine = resolvedType === "PROCEDURE" || resolvedType === "FUNCTION";
+    routineMetadata.value = !isRoutine ? null : result.routine_parameters !== undefined ? jdbcRoutineMetadata(result.routine_parameters) : target.databaseType === "xugu" ? xuguRoutineMetadataFromDefinition(result.source) : null;
     sourceEditable.value = editableAllowed;
     const displaySource = resolvedType === "SEQUENCE" ? result.source : editable;
     const formatted = await formatSqlForDisplay(displaySource, target.formatDialect ?? target.dialect, settingsStore.editorSettings.sqlFormatter);
@@ -259,6 +260,7 @@ function closeDialog() {
       <div v-else class="flex min-h-0 flex-col gap-3 overflow-hidden">
         <RoutineMetadataPanel v-if="hasRoutineMetadata && routineMetadata" :parameters="routineMetadata.parameters" :return-type="routineMetadata.returnType" />
         <QueryEditor
+          v-if="content || !hasRoutineMetadata"
           :key="`${props.connectionId}:${props.database}:${props.schema || ''}:${props.name}:${props.objectType}`"
           :model-value="content"
           class="object-source-dialog-editor min-h-0 flex-1 overflow-hidden rounded border"
```

**File**: `apps/desktop/src/components/objects/RoutineMetadataPanel.vue` (modified, +20/-4)
```diff
@@ -1,18 +1,26 @@
 <script setup lang="ts">
+import { computed } from "vue";
 import { useI18n } from "vue-i18n";
 import type { RoutineParameter } from "@/lib/table/routineExecutionSql";
 
-defineProps<{
+const props = defineProps<{
   parameters: RoutineParameter[];
   returnType?: string;
 }>();
 
 const { t } = useI18n();
+const showNullable = computed(() => props.parameters.some((parameter) => parameter.nullable !== undefined && parameter.nullable !== null));
 
 function defaultLabel(parameter: RoutineParameter): string {
   if (!parameter.hasDefault) return "-";
   return parameter.defaultValue?.trim() || "DEFAULT";
 }
+
+function nullableLabel(parameter: RoutineParameter): string {
+  if (parameter.nullable === true) return t("structureEditor.nullable");
+  if (parameter.nullable === false) return t("structureEditor.notNull");
+  return "-";
+}
 </script>
 
 <template>
@@ -21,17 +29,25 @@ function defaultLabel(parameter: RoutineParameter): string {
       <span class="font-semibold text-muted-foreground">RETURN</span>
       <span class="font-mono">{{ returnType }}</span>
     </div>
-    <div v-if="parameters.length" class="min-w-[620px]">
-      <div class="grid grid-cols-[minmax(140px,1.2fr)_minmax(150px,1.3fr)_80px_minmax(150px,1.3fr)] border-b bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
+    <div v-if="parameters.length" :class="showNullable ? 'min-w-[720px]' : 'min-w-[620px]'">
+      <div class="grid border-b bg-muted px-3 py-2 text-xs font-medium text-muted-foreground" :class="showNullable ? 'grid-cols-[minmax(140px,1.2fr)_minmax(150px,1.3fr)_80px_100px_minmax(150px,1.3fr)]' : 'grid-cols-[minmax(140px,1.2fr)_minmax(150px,1.3fr)_80px_minmax(150px,1.3fr)]'">
         <div>{{ t("contextMenu.parameterName") }}</div>
         <div>{{ t("contextMenu.parameterType") }}</div>
         <div>{{ t("contextMenu.parameterMode") }}</div>
+        <div v-if="showNullable">{{ t("structureEditor.nullable") }}</div>
         <div>{{ t("contextMenu.parameterDefault") }}</div>
       </div>
-      <div v-for="parameter in parameters" :key="`${parameter.ordinal}:${parameter.name}`" class="grid grid-cols-[minmax(140px,1.2fr)_minmax(150px,1.3fr)_80px_minmax(150px,1.3fr)] gap-2 border-b px-3 py-2 text-xs last:border-b-0" data-routine-parameter>
+      <div
+        v-for="parameter in parameters"
+        :key="`${parameter.ordinal}:${parameter.name}`"
+        class="grid gap-2 border-b px-3 py-2 text-xs last:border-b-0"
+        :class="showNullable ? 'grid-cols-[minmax(140px,1.2fr)_minmax(150px,1.3fr)_80px_100px_minmax(150px,1.3fr)]' : 'grid-cols-[minmax(140px,1.2fr)_minmax(150px,1.3fr)_80px_minmax(150px,1.3fr)]'"
+        data-routine-parameter
+      >
         <div class="truncate font-medium" :title="parameter.name">{{ parameter.name }}</div>
         <div class="truncate font-mono text-muted-foreground" :title="parameter.dataType">{{ parameter.dataType }}</div>
         <div class="text-muted-foreground">{{ parameter.mode }}</div>
+        <div v-if="showNullable" class="text-muted-foreground" data-routine-nullable>{{ nullableLabel(parameter) }}</div>
         <div class="truncate font-mono text-muted-foreground" :title="defaultLabel(parameter)">
           {{ defaultLabel(parameter) }}
         </div>
```

**File**: `apps/desktop/src/components/objects/__tests__/ObjectSourceDialog.jdbcRoutineMetadata.spec.ts` (added, +111/-0)
```diff
@@ -0,0 +1,111 @@
+// @vitest-environment happy-dom
+
+import { createApp, defineComponent, h, type App } from "vue";
+import { createPinia, setActivePinia } from "pinia";
+import { createI18n } from "vue-i18n";
+import { afterEach, describe, expect, it, vi } from "vitest";
+import { useConnectionStore } from "@/stores/connectionStore";
+import ObjectSourceDialog from "@/components/objects/ObjectSourceDialog.vue";
+
+const mocks = vi.hoisted(() => ({
+  getObjectSource: vi.fn(),
+  buildEditableObjectSource: vi.fn(),
+}));
+
+vi.mock("@/lib/backend/api", async (importOriginal) => ({
+  ...(await importOriginal<typeof import("@/lib/backend/api")>()),
+  ...mocks,
+}));
+vi.mock("@/components/editor/QueryEditor.vue", () => ({
+  default: defineComponent({
+    name: "QueryEditorStub",
+    props: { modelValue: { type: String, default: "" } },
+    template: "<div data-query-editor-stub>{{ modelValue }}</div>",
+  }),
+}));
+
+const mountedApps: Array<{ app: App; host: HTMLElement }> = [];
+
+afterEach(() => {
+  for (const { app, host } of mountedApps.splice(0)) {
+    app.unmount();
+    host.remove();
+  }
+  vi.restoreAllMocks();
+  Object.values(mocks).forEach((mock) => mock.mockReset());
+});
+
+async function mountDialog() {
+  const pinia = createPinia();
+  setActivePinia(pinia);
+  const connectionStore = useConnectionStore();
+  vi.spyOn(connectionStore, "ensureConnected").mockResolvedValue(undefined);
+  const host = document.createElement("div");
+  document.body.append(host);
+  const app = createApp({
+    render: () =>
+      h(ObjectSourceDialog, {
+        open: true,
+        connectionId: "jdbc-1",
+        database: "catalog1",
+        schema: "APP",
+        name: "calculate_total",
+        objectType: "FUNCTION",
+        databaseType: "jdbc",
+        dialect: "mysql",
+      }),
+  });
+  app.use(pinia);
+  app.use(createI18n({ legacy: false, locale: "en", messages: { en: {} }, missingWarn: false, fallbackWarn: false }));
+  app.mount(host);
+  mountedApps.push({ app, host });
+  return host;
+}
+
+describe("ObjectSourceDialog generic JDBC routine metadata", () => {
+  it("renders a source-less function as read-only structured metadata", async () => {
+    mocks.getObjectSource.mockResolvedValue({
+      name: "calculate_total",
+      object_type: "FUNCTION",
+      schema: "APP",
+      source: "",
+      editable: false,
+      routine_parameters: [
+        { name: "result", mode: "OUT", jdbc_type: 12, type_name: "VARCHAR", length: 32, nullable: true, ordinal: 2 },
+        { name: "RETURN", mode: "RETURN", jdbc_type: 3, type_name: "DECIMAL", precision: 12, scale: 2, ordinal: 0 },
+        { name: "amount", mode: "IN", jdbc_type: 3, type_name: "DECIMAL", precision: 10, scale: 2, nullable: false, ordinal: 1 },
+      ],
+    });
+    mocks.buildEditableObjectSource.mockResolvedValue("");
+
+    await mountDialog();
+    await vi.waitFor(() => expect(document.querySelectorAll("[data-routine-parameter]")).toHaveLength(2));
+
+    expect(document.querySelector("[data-routine-return-type]")?.textContent).toContain("DECIMAL(12,2)");
+    const rows = [...document.querySelectorAll("[data-routine-parameter]")];
+    expect(rows[0].textContent).toContain("amount");
+    expect(rows[0].textContent).toContain("DECIMAL(10,2)");
+    expect(rows[1].textContent).toContain("VARCHAR(32)");
+    expect(document.querySelector("[data-query-editor-stub]")).toBeNull();
+    expect(document.body.textContent).not.toContain("Object source is not supported");
+    expect(mocks.getObjectSource).toHaveBeenCalledTimes(1);
+    expect([...document.querySelectorAll("button")].some((button) => button.textContent?.trim() === "contextMenu.editView")).toBe(false);
+  });
+
+  it("keeps a legacy source payload without the optional field on the existing preview path", async () => {
+    mocks.getObjectSource.mockResolvedValue({
+      name: "calculate_total",
+      object_type: "FUNCTION",
+      schema: "APP",
+      source: "CREATE FUNCTION calculate_total() RETURNS INTEGER RETURN 1",
+      editable: false,
+    });
+    mocks.buildEditableObjectSource.mockResolvedValue("CREATE FUNCTION calculate_total() RETURNS INTEGER RETURN 1");
+
+    await mountDialog();
+    await vi.waitFor(() => expect(document.querySelector("[data-query-editor-stub]")).not.toBeNull());
+
+    expect(document.querySelector("[data-routine-metadata]")).toBeNull();
+    expect(document.querySelector("[data-query-editor-stub]")?.textContent).toContain("CREATE FUNCTION");
+  });
+});
```

**File**: `apps/desktop/src/components/objects/__tests__/RoutineMetadataPanel.spec.ts` (modified, +18/-0)
```diff
@@ -50,4 +50,22 @@ describe("RoutineMetadataPanel", () => {
     expect(host.querySelector("[data-routine-return-type]")?.textContent).toContain("INTEGER");
     expect(host.querySelectorAll("[data-routine-parameter]")).toHaveLength(0);
   });
+
+  it("renders known JDBC nullability without changing legacy parameter rows", () => {
+    const host = document.createElement("div");
+    document.body.append(host);
+    const app = createApp(RoutineMetadataPanel, {
+      parameters: [
+        { name: "required_id", dataType: "BIGINT", mode: "IN", ordinal: 1, nullable: false },
+        { name: "optional_note", dataType: "VARCHAR(64)", mode: "OUT", ordinal: 2, nullable: true },
+        { name: "unknown", dataType: "OTHER", mode: "UNKNOWN", ordinal: 3, nullable: null },
+      ],
+    });
+    app.use(i18n);
+    app.mount(host);
+    mountedApps.push({ app, host });
+
+    const nullability = [...host.querySelectorAll("[data-routine-nullable]")].map((cell) => cell.textContent?.trim());
+    expect(nullability).toEqual(["Not null", "Nullable", "-"]);
+  });
 });
```

**File**: `apps/desktop/src/lib/table/__tests__/objectSourceLoad.spec.ts` (modified, +33/-0)
```diff
@@ -1,5 +1,6 @@
 import { describe, expect, it, vi } from "vitest";
 import { loadEditableObjectSourceForEditor, loadObjectSourceWithRoutineFallback } from "@/lib/table/objectSourceLoad";
+import { jdbcRoutineMetadata } from "@/lib/table/routineParameters";
 import type { ObjectSource } from "@/types/database";
 
 function source(text: string): ObjectSource {
@@ -26,6 +27,38 @@ describe("loadObjectSourceWithRoutineFallback", () => {
     expect(getObjectSource).toHaveBeenCalledTimes(2);
     expect(getObjectSource.mock.calls[1][4]).toBe("FUNCTION");
   });
+
+  it("keeps a source-less routine response when structured metadata is present", async () => {
+    const getObjectSource = vi.fn().mockResolvedValue({ ...source(""), editable: false, routine_parameters: [] });
+    const result = await loadObjectSourceWithRoutineFallback(getObjectSource, "c1", "catalog", "APP", "P1", "PROCEDURE");
+
+    expect(result.objectType).toBe("PROCEDURE");
+    expect(result.source.routine_parameters).toEqual([]);
+    expect(getObjectSource).toHaveBeenCalledTimes(1);
+  });
+});
+
+describe("jdbcRoutineMetadata", () => {
+  it("keeps legacy payloads optional and normalizes sorted JDBC display metadata", () => {
+    expect(jdbcRoutineMetadata(undefined)).toBeNull();
+    expect(
+      jdbcRoutineMetadata([
+        { name: "p_note", mode: "OUT", jdbc_type: 12, type_name: "VARCHAR", length: 64, nullable: true, ordinal: 3 },
+        { name: null, mode: "RETURN", jdbc_type: 3, type_name: "DECIMAL", precision: 12, scale: 3, ordinal: 0 },
+        { name: "p_id", mode: "IN", jdbc_type: -5, type_name: "BIGINT", nullable: false, ordinal: 1 },
+        { name: null, mode: "INOUT", jdbc_type: null, type_name: null, nullable: null, ordinal: 2 },
+        { name: "p_unknown", mode: "UNKNOWN" },
+      ]),
+    ).toEqual({
+      returnType: "DECIMAL(12,3)",
+      parameters: [
+        { name: "p_id", dataType: "BIGINT", mode: "IN", ordinal: 1, hasDefault: false, nullable: false },
+        { name: "arg2", dataType: "UNKNOWN", mode: "INOUT", ordinal: 2, hasDefault: false, nullable: null },
+        { name: "p_note", dataType: "VARCHAR(64)", mode: "OUT", ordinal: 3, hasDefault: false, nullable: true },
+        { name: "p_unknown", dataType: "UNKNOWN", mode: "UNKNOWN", ordinal: 4, hasDefault: false, nullable: undefined },
+      ],
+    });
+  });
 });
 
 describe("loadEditableObjectSourceForEditor", () => {
```

**File**: `apps/desktop/src/lib/table/objectSourceLoad.ts` (modified, +2/-2)
```diff
@@ -19,7 +19,7 @@ export async function loadObjectSourceWithRoutineFallback(
   relationName?: string,
 ): Promise<{ source: ObjectSource; objectType: ObjectSourceKind }> {
   const primary = await getObjectSource(connectionId, database, schema, name, objectType, signature, relationName);
-  if (primary.source?.trim()) {
+  if (primary.source?.trim() || primary.routine_parameters !== undefined) {
     return { source: primary, objectType };
   }
 
@@ -28,7 +28,7 @@ export async function loadObjectSourceWithRoutineFallback(
   for (const fallbackType of fallbacks) {
     try {
       const alternate = await getObjectSource(connectionId, database, schema, name, fallbackType, signature, relationName);
-      if (alternate.source?.trim()) {
+      if (alternate.source?.trim() || alternate.routine_parameters !== undefined) {
         return { source: alternate, objectType: fallbackType };
       }
     } catch {
```

**File**: `apps/desktop/src/lib/table/routineExecutionSql.ts` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@ export interface RoutineParameter {
   ordinal: number;
   hasDefault?: boolean;
   defaultValue?: string | null;
+  nullable?: boolean | null;
 }
 
 export interface RoutineParameterValue extends RoutineParameter {
```

**File**: `apps/desktop/src/lib/table/routineParameters.ts` (modified, +62/-2)
```diff
@@ -1,5 +1,5 @@
 import * as api from "@/lib/backend/api";
-import type { DatabaseType, QueryResult } from "@/types/database";
+import type { DatabaseType, QueryResult, RoutineParameterMetadata } from "@/types/database";
 import type { RoutineParameter, RoutineParameterMode } from "@/lib/table/routineExecutionSql";
 
 export interface LoadRoutineParametersOptions {
@@ -142,12 +142,72 @@ ORDER BY SEQUENCE;`.trim();
   return null;
 }
 
-export interface XuguRoutineMetadata {
+export interface RoutineMetadata {
   kind?: "PROCEDURE" | "FUNCTION";
   parameters: RoutineParameter[];
   returnType?: string;
 }
 
+export type XuguRoutineMetadata = RoutineMetadata;
+
+/** Convert optional generic-JDBC wire metadata into the existing read-only panel model. */
+export function jdbcRoutineMetadata(parameters: RoutineParameterMetadata[] | undefined): RoutineMetadata | null {
+  if (parameters === undefined) return null;
+
+  const ordered = parameters
+    .map((parameter, index) => ({ parameter, index }))
+    .sort((left, right) => routineMetadataOrdinal(left.parameter) - routineMetadataOrdinal(right.parameter) || left.index - right.index)
+    .map(({ parameter }) => parameter);
+  const returnParameter = ordered.find((parameter) => parameter.mode === "RETURN");
+  return {
+    parameters: ordered
+      .filter((parameter) => parameter.mode !== "RETURN")
+      .map((parameter, index) => ({
+        name: parameter.name?.trim() || `arg${positiveRoutineOrdinal(parameter.ordinal) ?? index + 1}`,
+        dataType: jdbcRoutineParameterType(parameter),
+        mode: parameter.mode,
+        ordinal: positiveRoutineOrdinal(parameter.ordinal) ?? index + 1,
+        hasDefault: false,
+        nullable: parameter.nullable,
+      })),
+    returnType: returnParameter ? jdbcRoutineParameterType(returnParameter) : undefined,
+  };
+}
+
+function routineMetadataOrdinal(parameter: RoutineParameterMetadata): number {
+  return typeof parameter.ordinal === "number" && Number.isFinite(parameter.ordinal) ? parameter.ordinal : Number.MAX_SAFE_INTEGER;
+}
+
+function positiveRoutineOrdinal(ordinal: number | null | undefined): number | undefined {
+  return typeof ordinal === "number" && Number.isFinite(ordinal) && ordinal > 0 ? ordinal : undefined;
+}
+
+function jdbcRoutineParameterType(parameter: RoutineParameterMetadata): string {
+  const typeName = parameter.type_name?.trim() || (typeof parameter.jdbc_type === "number" ? `JDBC ${parameter.jdbc_type}` : "UNKNOWN");
+  if (/\([^)]*\)\s*$/.test(typeName)) return typeName;
+
+  const jdbcType = parameter.jdbc_type;
+  const precision = positiveMetadataSize(parameter.precision);
+  const length = positiveMetadataSize(parameter.length);
+  const scale = typeof parameter.scale === "number" && Number.isFinite(parameter.scale) && parameter.scale >= 0 ? parameter.scale : undefined;
+  if (jdbcType === 2 || jdbcType === 3) {
+    if (precision === undefined) return typeName;
+    return scale === undefined ? `${typeName}(${precision})` : `${typeName}(${precision},${scale})`;
+  }
+  if (jdbcType === 92 || jdbcType === 93 || jdbcType === 2013 || jdbcType === 2014) {
+    return scale === undefined ? typeName : `${typeName}(${scale})`;
+  }
+  if (jdbcType === 1 || jdbcType === 12 || jdbcType === -1 || jdbcType === -15 || jdbcType === -9 || jdbcType === -16 || jdbcType === -2 || jdbcType === -3 || jdbcType === -4) {
+    const size = length ?? precision;
+    return size === undefined ? typeName : `${typeName}(${size})`;
+  }
+  return typeName;
+}
+
+function positiveMetadataSize(value: number | null | undefined): number | undefined {
+  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
+}
+
 interface XuguRoutineToken {
   kind: "word" | "quoted-identifier" | "string" | "symbol";
   text: string;
```

---

### Incident Patch 12: `30e86367` (2026-10-04)
**Commit Message**: fix(nix): update pnpm dependency hash

**File**: `flake.nix` (modified, +1/-1)
```diff
@@ -197,7 +197,7 @@
             fetcherVersion = 4;
             # Update with the hash reported by a failed fixed-output build:
             #   nix build .#dbx-pnpm-deps 2>&1 | grep 'got:'
-            hash = "sha256-M79LmFqGZMv/0/3VMq1B6l44GpAAJYhoN4HbcTdu5vw=";
+            hash = "sha256-WH7jvgDWvh8coatfWsdZNzsjElVDPyB48CV0HkTcqj4=";
           };
 
           # ── Step 2: vendor Cargo dependencies ───────────────────────────── #
```

---

### Incident Patch 13: `c2d9610d` (2026-10-04)
**Commit Message**: fix(sql-file): preserve target database when selecting SQL file

**File**: `apps/desktop/src/components/sql-file/SqlFileExecutionDialog.retry.spec.ts` (modified, +108/-3)
```diff
@@ -148,8 +148,21 @@ vi.mock("@/components/ui/select", () => ({
   Select: defineComponent({
     inheritAttrs: false,
     props: ["modelValue"],
-    setup(props, { attrs, slots }) {
-      return () => h("div", { ...attrs, "data-select-value": props.modelValue ?? "" }, slots.default?.());
+    emits: ["update:modelValue"],
+    setup(props, { attrs, slots, emit }) {
+      return () =>
+        h(
+          "div",
+          {
+            ...attrs,
+            "data-select-value": props.modelValue ?? "",
+            onClick: (e: MouseEvent) => {
+              const target = (e.target as HTMLElement)?.closest?.("[data-select-item]") as HTMLElement | null;
+              if (target?.dataset?.selectItem) emit("update:modelValue", target.dataset.selectItem);
+            },
+          },
+          slots.default?.(),
+        );
     },
   }),
   SelectContent: passthrough("div"),
@@ -167,7 +180,7 @@ vi.mock("@/components/icons/DatabaseIcon.vue", () => ({ default: passthrough("sp
 vi.mock("@/components/connection/ConnectionGroupBadge.vue", () => ({ default: passthrough("span") }));
 
 import SqlFileExecutionDialog from "./SqlFileExecutionDialog.vue";
-import { rememberExternalSqlFileTarget } from "@/lib/sql/externalSqlFileTarget";
+import { rememberExternalSqlFileTarget, resolveExternalSqlFileTarget, unassociatedExternalSqlFileTarget } from "@/lib/sql/externalSqlFileTarget";
 
 let app: ReturnType<typeof createApp> | undefined;
 let root: HTMLDivElement | undefined;
@@ -1036,3 +1049,95 @@ describe("SqlFileExecutionDialog selected-table restore", () => {
     expect(input.value).toBe("/tmp/missing.sql");
   });
 });
+
+describe("SqlFileExecutionDialog target preservation (#4844)", () => {
+  it("preserves prefilled database when browsing for a new unassociated SQL file", async () => {
+    mocks.connections = [{ id: "mysql-1", name: "MySQL", db_type: "mysql", driver_profile: "mysql", database: "" }];
+    mocks.queryStore.tabs = [{ id: "tab-1", connectionId: "mysql-1", database: "first_db" }];
+    mocks.queryStore.activeTabId = "tab-1";
+    mocks.fetchSqlFileTargetOptions.mockResolvedValue(["first_db", "target_db"]);
+    mocks.openFileDialog.mockResolvedValueOnce(["/tmp/unassociated.sql"]);
+
+    root = document.createElement("div");
+    document.body.append(root);
+    app = createApp(SqlFileExecutionDialog, { open: true, prefillConnectionId: "mysql-1", prefillDatabase: "target_db" });
+    app.mount(root);
+
+    await vi.waitFor(() => expect(mocks.fetchSqlFileTargetOptions).toHaveBeenCalledWith("mysql-1", expect.anything()));
+    expect(root.querySelector('[data-select-value="target_db"]')).not.toBeNull();
+
+    findButton("sqlFile.browse").click();
+    await vi.waitFor(() => expect(mocks.previewSqlFile).toHaveBeenCalledWith("/tmp/unassociated.sql"));
+
+    // Target database MUST NOT have been overwritten by activeTab database ("first_db")
+    expect(root.querySelector('[data-select-value="target_db"]')).not.toBeNull();
+
+    mocks.executeSqlFiles.mockImplementationOnce(async (request) => {
+      mocks.progressHandler?.(progress(request.executionId, "done"));
+    });
+    findButton("sqlFile.execute").click();
+
+    await vi.waitFor(() => expect(mocks.executeSqlFiles).toHaveBeenCalledWith(expect.objectContaining({ connectionId: "mysql-1", database: "target_db" }), ["/tmp/unassociated.sql"]));
+    expect(resolveExternalSqlFileTarget("/tmp/unassociated.sql", () => true, unassociatedExternalSqlFileTarget())).toMatchObject({
+      connectionId: "mysql-1",
+      database: "target_db",
+    });
+  });
+
+  it("does not overwrite prefilled connection and database even if the selected file has a saved target", async () => {
+    mocks.connections = [
+      { id: "mysql-1", name: "MySQL", db_type: "mysql", driver_profile: "mysql", database: "" },
+      { id: "mysql-2", name: "MySQL 2", db_type: "mysql", driver_profile: "mysql", database: "" },
+    ];
+    rememberExternalSqlFileTarget("/tmp/saved_other.sql", { connectionId: "mysql-2", database: "other_db" });
+    mocks.fetchSqlFileTargetOptions.mockResolvedValue(["first_db", "explicit_prefill_db"]);
+    mocks.openFileDialog.mockResolvedValueOnce(["/tmp/saved_other.sql"]);
+
+    root = document.createElement("div");
+    document.body.append(root);
+    app = createApp(SqlFileExecutionDialog, { open: true, prefillConnectionId: "mysql-1", prefillDatabase: "explicit_prefill_db" });
+    app.mount(root);
+
+    await vi.waitFor(() => expect(mocks.fetchSqlFileTargetOptions).toHaveBeenCalledWith("mysql-1", expect.anything()));
+    findButton("sqlFile.browse").click();
+    await vi.waitFor(() => expect(mocks.previewSqlFile).toHaveBeenCalledWith("/tmp/saved_other.sql"));
+
+    expect(root.querySelector('[data-select-value="mysql-1"]')).not.toBeNull();
+    expect(root.querySelector('[data-select-value="explicit_prefill_db"]')).not.toBeNull();
+  });
+
+  it("preserves user-selected database in the dialog when browsing an unassociated file", 
```

**File**: `apps/desktop/src/components/sql-file/SqlFileExecutionDialog.vue` (modified, +35/-5)
```diff
@@ -24,7 +24,7 @@ import { formatError, isManualTransactionSessionExpired } from "@/lib/backend/er
 import { fetchSqlFileTargetOptions, namespaceOptionsAreSchemas } from "@/composables/useDatabaseOptions";
 import { requiresSqlFileTargetDatabaseSelection, supportsConnectionLevelDatabaseBootstrap } from "@/lib/connection/connectionLevelDatabaseBootstrap";
 import { beginManualTransaction, commitManualTransaction, rollbackManualTransaction, cancelSqlFileExecution, executeSqlFiles, inspectSqlFileTables, listenSqlFileProgress, previewSqlFile, type SqlFilePreview, type SqlFileProgress, type SqlFileStatus, type SqlFileTable } from "@/lib/backend/api";
-import { activeTabExternalSqlFileTarget, resolveExternalSqlFileTargetForActiveTab, type ExternalSqlFileTarget } from "@/lib/sql/externalSqlFileTarget";
+import { activeTabExternalSqlFileTarget, rememberExternalSqlFileTarget, resolveExternalSqlFileTarget, unassociatedExternalSqlFileTarget, type ExternalSqlFileTarget } from "@/lib/sql/externalSqlFileTarget";
 import { isSqlFilePath } from "@/lib/sql/sqlFileOpen";
 import { buildDisplayFileNames, tooltipText as computeTooltipText } from "./sqlFilePreviewLabel";
 import { parseSqlFilePathInput } from "./sqlFilePathInput";
@@ -427,6 +427,8 @@ function chooseNamespace(names: string[], id: string) {
   const preferred = preferredTarget.value?.connectionId === id ? preferredTarget.value : undefined;
   const preferredNamespace = preferred ? (optionsAreSchemas ? preferred.schema : preferred.database) : optionsAreSchemas ? (id === props.prefillConnectionId ? props.prefillSchema : undefined) : props.prefillDatabase;
   const configuredNamespace = optionsAreSchemas ? (connection?.default_schema ?? "") : (connection?.database ?? "");
+  const currentNamespace = targetNamespace.value.trim();
+  if (currentNamespace && connectionId.value === id && names.includes(currentNamespace)) return currentNamespace;
   if (names.length > 0) {
     if (preferredNamespace && names.includes(preferredNamespace)) return preferredNamespace;
     if (configuredNamespace && names.includes(configuredNamespace)) return configuredNamespace;
@@ -435,6 +437,17 @@ function chooseNamespace(names: string[], id: string) {
   return preferredNamespace ?? configuredNamespace;
 }
 
+watch(targetNamespace, (namespace) => {
+  if (!connectionId.value) return;
+  const connection = store.getConfig(connectionId.value);
+  const optionsAreSchemas = namespaceOptionsAreSchemas(connection);
+  preferredTarget.value = {
+    connectionId: connectionId.value,
+    database: optionsAreSchemas ? connection?.database?.trim() || "" : namespace.trim(),
+    ...(optionsAreSchemas ? { schema: namespace.trim() } : {}),
+  };
+});
+
 function sqlFileExecutionTarget(): SqlFileExecutionTarget {
   const namespace = targetNamespace.value.trim();
   const connection = store.getConfig(connectionId.value);
@@ -534,10 +547,14 @@ async function loadPreviews(filesOrPaths: Array<string | File>, resolveSelectedF
       nextPreviews.push(await previewSelectedSqlFile(fileOrPath));
     }
     previews.value = nextPreviews;
-    if (resolveSelectedFileTarget) {
+    if (resolveSelectedFileTarget && !props.prefillConnectionId) {
       const firstPath = typeof filesOrPaths[0] === "string" && isSqlFilePath(filesOrPaths[0]) ? filesOrPaths[0] : undefined;
-      const target = firstPath ? resolveExternalSqlFileTargetForActiveTab(firstPath, queryStore.tabs, queryStore.activeTabId, (connectionId) => store.getConfig(connectionId)) : activeTabExternalSqlFileTarget(queryStore.tabs, queryStore.activeTabId, (connectionId) => store.getConfig(connectionId));
-      applyTarget(target);
+      const remembered = firstPath ? resolveExternalSqlFileTarget(firstPath, (id) => sqlConnections.value.some((c) => c.id === id), unassociatedExternalSqlFileTarget()) : undefined;
+      if (remembered?.connectionId) {
+        applyTarget(remembered);
+      } else if (!connectionId.value) {
+        applyTarget(activeTabExternalSqlFileTarget(queryStore.tabs, queryStore.activeTabId, (connectionId) => store.getConfig(connectionId)));
+      }
     }
   } catch (e: any) {
     toast(e?.message || String(e), 5000);
@@ -771,7 +788,20 @@ async function startExecution() {
       unlisten();
     }
 
-    if (completedSuccessfully && !txnSessionId.value) await refreshTargetAfterImport(target);
+    if (completedSuccessfully) {
+      if (isDesktopRuntime) {
+        for (const item of previews.value) {
+          if (item.filePath) {
+            rememberExternalSqlFileTarget(item.filePath, {
+              connectionId: connectionId.value,
+              database: target.database,
+              schema: target.schema,
+            });
+          }
+        }
+      }
+      if (!txnSessionId.value) await refreshTargetAfterImport(target);
+    }
   } catch (e: any) {
     terminalStatus.value = cancelRequested.value ? "cancelled" : "error";
     terminalError.value = e?.message || String(e);
```

---

### Incident Patch 14: `3f707635` (2026-10-04)
**Commit Message**: fix(layout): adapt query history panel width and isolate special pages

**File**: `apps/desktop/src/App.vue` (modified, +14/-8)
```diff
@@ -402,6 +402,7 @@ const immediateSyncing = ref(false);
 const showDriverStore = computed(() => driverStoreTabOpen.value && driverStoreActive.value);
 const showPluginCenter = computed(() => pluginCenterTabOpen.value && pluginCenterActive.value);
 const showSettingsPage = computed(() => Boolean(settingsPageTabOpen.value && settingsStore.settingsPageActive));
+const isSpecialPageActive = computed(() => !isDetachedWindowContext && (driverStoreActive.value || pluginCenterActive.value || settingsStore.settingsPageActive));
 const showQuickOpen = ref(false);
 const quickOpenForceContent = ref(false);
 const showTabSwitcher = ref(false);
@@ -1016,7 +1017,7 @@ const specialPageTabs = computed(() => ({
   driverStoreActive: driverStoreActive.value,
   driverUpdateCount: showDriverStoreUpdateBadge.value,
 }));
-provide(GROUP_TAB_BAR_PORTAL, createGroupTabBarPortal(computed(() => !isDetachedWindowContext && (driverStoreActive.value || pluginCenterActive.value || settingsStore.settingsPageActive))));
+provide(GROUP_TAB_BAR_PORTAL, createGroupTabBarPortal(isSpecialPageActive));
 provide(EDITOR_TOOLBAR_ACTIONS, {
   canNewQuery: canCreateNewQuery,
   newQuery: (groupId: string) => {
@@ -1756,6 +1757,9 @@ function applyRightSidebarPanelState(next: RightSidebarPanelState) {
 }
 
 function setRightSidebarPanelOpen(panelId: RightSidebarPanelId, open: boolean) {
+  if (open && isSpecialPageActive.value) {
+    activateQuerySurface();
+  }
   if ((panelId === "history" && !open) || (panelId !== "history" && open)) isHistoryPanelMaximized.value = false;
   if (panelId === "ai" && !open) {
     isAiPanelMaximized.value = false;
@@ -3644,6 +3648,8 @@ function activateQueryTab(tabId: string): boolean {
   if (!queryStore.activateTab(tabId)) return false;
   activateQuerySurface();
   pluginCenterActive.value = false;
+  isHistoryPanelMaximized.value = false;
+  isAiPanelMaximized.value = false;
   return true;
 }
 
@@ -4478,7 +4484,7 @@ onUnmounted(() => {
 
           <div
             data-editor-content
-            v-show="(!isAiPanelMaximized && !isHistoryPanelMaximized) || isZenMode"
+            v-show="isSpecialPageActive || (!isAiPanelMaximized && !isHistoryPanelMaximized) || isZenMode"
             :class="isDetachedWindowContext ? 'flex-1 min-w-0 overflow-hidden bg-background' : isClassicLayout ? 'flex-1 min-w-0 overflow-hidden' : 'flex-1 min-w-0 overflow-hidden rounded-md border border-border/80 bg-background'"
           >
             <div class="h-full flex min-h-0 min-w-0 flex-col">
@@ -4758,7 +4764,7 @@ onUnmounted(() => {
 
           <div
             v-if="!isDetachedWindowContext && showAiPanel"
-            v-show="!isHistoryPanelMaximized && !isZenMode"
+            v-show="!isSpecialPageActive && !isHistoryPanelMaximized && !isZenMode"
             :class="[isClassicLayout ? 'h-full relative z-30 isolate bg-background' : 'h-full relative z-30 isolate rounded-md border border-border/80 bg-background', isAiPanelMaximized ? 'min-w-0 flex-1' : 'min-w-[240px] max-w-full']"
             :style="isAiPanelMaximized ? {} : { width: aiPanelWidth + 'px' }"
           >
@@ -4787,9 +4793,9 @@ onUnmounted(() => {
 
           <div
             v-if="!isDetachedWindowContext && showHistory"
-            v-show="!isAiPanelMaximized && !isZenMode"
-            :class="[isClassicLayout ? 'h-full relative z-30 isolate bg-background' : 'h-full relative z-30 isolate rounded-md border border-border/80 bg-background', isHistoryPanelMaximized ? 'min-w-0 flex-1' : 'shrink-0 max-w-full']"
-            :style="isHistoryPanelMaximized ? {} : { width: historyWidth + 'px' }"
+            v-show="!isSpecialPageActive && !isAiPanelMaximized && !isZenMode"
+            :class="[isClassicLayout ? 'h-full relative z-30 isolate bg-background' : 'h-full relative z-30 isolate rounded-md border border-border/80 bg-background', isHistoryPanelMaximized ? 'min-w-0 flex-1' : 'min-w-[240px] max-w-full']"
+            :style="isHistoryPanelMaximized ? {} : { width: historyWidth + 'px', maxWidth: 'calc(100% - 240px)' }"
           >
             <div v-if="!isHistoryPanelMaximized" class="panel-resize-handle panel-resize-handle--left" @pointerdown="startHistoryResize" />
             <div class="h-full min-h-0 overflow-hidden rounded-[inherit]" @mousedown="rememberAuxiliarySearchSurface('history')">
@@ -4809,7 +4815,7 @@ onUnmounted(() => {
 
           <div
             v-if="!isDetachedWindowContext && showSqlLibraryPanel"
-            v-show="!isAiPanelMaximized && !isHistoryPanelMaximized && !isZenMode"
+            v-show="!isSpecialPageActive && !isAiPanelMaximized && !isHistoryPanelMaximized && !isZenMode"
             :class="isClassicLayout ? 'h-full shrink-0 relative z-30 isolate bg-background' : 'h-full shrink-0 relative z-30 isolate rounded-md border border-border/80 bg-background'"
             :style="{ width: sqlLibraryWidth + 'px' }"
           >
@@ -4823,7 +4829,7 @@ onUnmounted(() => {
 
           <div
             v-if="!isDetache
```

**File**: `apps/desktop/src/components/layout/__tests__/SpecialPageLayoutPanels.spec.ts` (added, +79/-0)
```diff
@@ -0,0 +1,79 @@
+// @vitest-environment happy-dom
+import { computed, ref } from "vue";
+import { describe, expect, it } from "vitest";
+
+describe("Special page layout and right sidebar panels visibility", () => {
+  it("shows editor content and hides right panels when a special page is active", () => {
+    const isDetachedWindowContext = false;
+    const driverStoreActive = ref(false);
+    const pluginCenterActive = ref(false);
+    const settingsPageActive = ref(false);
+    const isAiPanelMaximized = ref(false);
+    const isHistoryPanelMaximized = ref(true);
+    const isZenMode = ref(false);
+
+    const isSpecialPageActive = computed(() => !isDetachedWindowContext && (driverStoreActive.value || pluginCenterActive.value || settingsPageActive.value));
+
+    const showEditorContent = computed(() => isSpecialPageActive.value || (!isAiPanelMaximized.value && !isHistoryPanelMaximized.value) || isZenMode.value);
+
+    const showAiPanelVisible = computed(() => !isSpecialPageActive.value && !isHistoryPanelMaximized.value && !isZenMode.value);
+
+    const showHistoryPanelVisible = computed(() => !isSpecialPageActive.value && !isAiPanelMaximized.value && !isZenMode.value);
+
+    const showSqlLibraryPanelVisible = computed(() => !isSpecialPageActive.value && !isAiPanelMaximized.value && !isHistoryPanelMaximized.value && !isZenMode.value);
+
+    // Initially: query workspace, history is maximized
+    expect(isSpecialPageActive.value).toBe(false);
+    expect(showEditorContent.value).toBe(false); // editor content hidden because history is maximized
+    expect(showHistoryPanelVisible.value).toBe(true);
+
+    // User opens settings page
+    settingsPageActive.value = true;
+    expect(isSpecialPageActive.value).toBe(true);
+    // Settings page in editor content must be visible even if history was maximized
+    expect(showEditorContent.value).toBe(true);
+    // Right sidebar panels must be hidden on settings page
+    expect(showHistoryPanelVisible.value).toBe(false);
+    expect(showAiPanelVisible.value).toBe(false);
+    expect(showSqlLibraryPanelVisible.value).toBe(false);
+
+    // User closes settings and returns to query editor
+    settingsPageActive.value = false;
+    expect(isSpecialPageActive.value).toBe(false);
+    expect(showEditorContent.value).toBe(false); // back to maximized history
+    expect(showHistoryPanelVisible.value).toBe(true);
+  });
+
+  it("switches to query surface if a right sidebar panel is toggled from a special page", () => {
+    const surface = ref("settings");
+    const isSpecialPageActive = computed(() => surface.value === "settings");
+
+    function activateQuerySurface() {
+      surface.value = "query";
+    }
+
+    function setRightSidebarPanelOpen(open: boolean) {
+      if (open && isSpecialPageActive.value) {
+        activateQuerySurface();
+      }
+    }
+
+    setRightSidebarPanelOpen(true);
+    expect(surface.value).toBe("query");
+    expect(isSpecialPageActive.value).toBe(false);
+  });
+
+  it("resets maximized panel state when an ordinary query tab is activated", () => {
+    const isHistoryPanelMaximized = ref(true);
+    const isAiPanelMaximized = ref(true);
+
+    function activateQueryTab() {
+      isHistoryPanelMaximized.value = false;
+      isAiPanelMaximized.value = false;
+    }
+
+    activateQueryTab();
+    expect(isHistoryPanelMaximized.value).toBe(false);
+    expect(isAiPanelMaximized.value).toBe(false);
+  });
+});
```

---

### Incident Patch 15: `99d603fe` (2026-10-04)
**Commit Message**: fix(db2): resolve the login schema for unqualified completion columns

**File**: `apps/desktop/src/stores/__tests__/connectionStore.completion.spec.ts` (modified, +39/-0)
```diff
@@ -132,6 +132,18 @@ function damengConnection(): ConnectionConfig {
   } as ConnectionConfig;
 }
 
+function db2Connection(): ConnectionConfig {
+  return {
+    ...postgresConnection(),
+    id: "db2-1",
+    name: "DB2",
+    db_type: "db2",
+    port: 50000,
+    username: "DBX_TEST",
+    database: "",
+  } as ConnectionConfig;
+}
+
 function dorisConnection(): ConnectionConfig {
   return {
     ...postgresConnection(),
@@ -926,6 +938,33 @@ describe("connectionStore completion assistant", () => {
     expect(cached).toEqual(first);
   });
 
+  it("uses the DB2 login schema for unqualified column completion", async () => {
+    // DB2's CURRENT SCHEMA starts as the authorization ID of the session user, so an
+    // unqualified reference resolves against the login schema — the same convention
+    // as Dameng (see the test above). Without the fallback `listCompletionColumns`
+    // takes its schema-required early return and never asks for the columns at all,
+    // so a tab that has no schema selected gets an empty candidate list.
+    const completionAssistantSearch = vi.fn().mockRejectedValue(new Error("assistant unavailable"));
+    const getColumns = vi.fn().mockResolvedValue([{ name: "PMNUM", data_type: "VARCHAR", is_nullable: false, column_default: null, is_primary_key: false, extra: null, comment: null }]);
+
+    vi.doMock("@/lib/backend/tauriRuntime", () => ({ isTauriRuntime: () => false }));
+    vi.doMock("@/lib/backend/api", () => ({
+      checkConnectionHealth: vi.fn().mockResolvedValue(undefined),
+      completionAssistantSearch,
+      getColumns,
+    }));
+
+    const { useConnectionStore } = await import("@/stores/connectionStore");
+    const store = useConnectionStore();
+    store.connections = [db2Connection()];
+    store.connectedIds.add("db2-1");
+
+    const first = await store.listCompletionColumns("db2-1", "", "pm");
+
+    expect(getColumns).toHaveBeenCalledWith("db2-1", "", "DBX_TEST", "pm", undefined, undefined);
+    expect(first).toEqual([expect.objectContaining({ name: "PMNUM", table: "pm", schema: "DBX_TEST" })]);
+  });
+
   it("rejects assistant columns returned for a different MySQL parent table", async () => {
     const completionAssistantSearch = vi.fn().mockResolvedValue({
       candidates: [
```

**File**: `apps/desktop/src/stores/connectionStore.ts` (modified, +12/-1)
```diff
@@ -9223,6 +9223,16 @@ export const useConnectionStore = defineStore("connection", () => {
     return deduped;
   }
 
+  /// Engines whose CURRENT SCHEMA defaults to the login identity. An unqualified
+  /// reference resolves against the login schema there, so `listCompletionColumns`
+  /// falls back to the username instead of letting its schema-required early return
+  /// discard the lookup. A query tab hits that state when it never picked a schema
+  /// (`jdbcDialect.ts` records a new query tab or a reopened `.sql` file as the
+  /// cases). Dameng was the first engine fixed for this (#8301); DB2's CURRENT
+  /// SCHEMA is documented as the authorization ID of the session user, so it needs
+  /// the same fallback.
+  const LOGIN_SCHEMA_COMPLETION_TYPES = new Set(["dameng", "db2"]);
+
   async function listCompletionColumns(connectionId: string, database: string, table: string, schema?: string, context?: { clientSessionId?: string; version?: number; tableQuoted?: boolean; schemaQuoted?: boolean }, catalog?: string): Promise<SqlCompletionColumn[]> {
     const config = getConfig(connectionId);
     // Use the effective database type (e.g. a JDBC connection whose URL is
@@ -9236,7 +9246,8 @@ export const useConnectionStore = defineStore("connection", () => {
     const uppercaseUnquotedIdentifier = oracleIdentifier || effectiveDbType === "saphana";
     const completionTable = uppercaseUnquotedIdentifier && context?.tableQuoted === false ? table.toUpperCase() : table;
     const normalizedSchema = schema?.trim();
-    const rawCompletionSchema = effectiveDbType === "spanner" ? normalizedSchema : normalizedSchema || (effectiveDbType === "dameng" ? config?.username?.trim() || undefined : undefined);
+    const loginSchema = effectiveDbType && LOGIN_SCHEMA_COMPLETION_TYPES.has(effectiveDbType) ? config?.username?.trim() || undefined : undefined;
+    const rawCompletionSchema = effectiveDbType === "spanner" ? normalizedSchema : normalizedSchema || loginSchema;
     const completionSchema = uppercaseUnquotedIdentifier && rawCompletionSchema && context?.schemaQuoted === false ? rawCompletionSchema.toUpperCase() : rawCompletionSchema;
     const usesCurrentSchema = usesOracleCurrentSchemaCompletion(effectiveDbType, completionSchema);
     const hasCompletionSchema = completionSchema != null && (completionSchema !== "" || effectiveDbType === "spanner");
```

#### Recent Merged Pull Requests:
- **PR #11108** (2026-10-05): feat(editor): support selectable SQL file encodings (@eryajf)
- **PR #11104** (2026-10-05): docs: add Apache CouchDB to supported databases (@saefulrahman)
- **PR #11103** (2026-10-05): fix(safety): read the production scan with the connection's lexer rules (@Tong-bit-art)
- **PR #11102** (2026-10-05): fix(sql): read backslash escapes from the dialect string rules (@Tong-bit-art)
- **PR #11101** (2026-10-05): fix(sql): apply dialect rules when scanning comments and escapes for risk (@Tong-bit-art)
- **PR #11100** (2026-10-05): feat(sqlserver): support manual transactions with SQL Server 2000 compatibility (@Rendegou)
- **PR #11099** (2026-10-05): fix(grid): reconcile an exact total when a page lands beyond it (@yiqiui)
- **PR #11098** (2026-10-05): fix(postgres): don't let a zeroed stats entry mask reltuples in object statistics (@yiqiui)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
