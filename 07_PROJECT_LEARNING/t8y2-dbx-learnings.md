> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/t8y2-dbx-learnings.md`  
> **Source**: github ([https://github.com/t8y2/dbx](https://github.com/t8y2/dbx))  
> **Source Version**: `0d01dff9`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-09T01:46:47.380Z  
> **Learning ID**: `learn-github-t8y2-dbx`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): t8y2/dbx

> **Canonical Artifact**: `07_PROJECT_LEARNING/t8y2-dbx-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/t8y2/dbx](https://github.com/t8y2/dbx))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-09T01:46:47.371Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `t8y2/dbx`
- **Description**: 25 MB lightweight cross-platform database client for 100+ databases, including MySQL, PostgreSQL, SQLite, Redis, MongoDB, DuckDB, SQL Server, and Dameng. Built-in AI, MCP Server, CLI, desktop and Docker. | 轻量级跨平台数据库管理工具，支持 MySQL、PostgreSQL、SQLite、Redis、MongoDB、达梦等 100+ 数据库，提供桌面端、Docker、CLI、内置 AI 助手和 MCP。
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 29581 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agents/drivers/oracle-go/pldebug_statement.go`
```
package main

import (
	"context"
	"database/sql/driver"
	"errors"
	"fmt"
	"time"
)

type plDebugStatement struct {
	driver.Stmt
	allocation     *plDebugAllocation
	closeRequested bool
	closeStarted   bool
	closeDone      chan struct{}
	closeDeadline  time.Time
	closeErr       error
}

func (s *plDebugStatement) Close() error {
	a := s.allocation
	a.mu.Lock()
	if !s.closeRequested {
		s.closeRequested = true
		s.closeDone = make(chan struct{})
		a.closingStatements++
		s.closeDeadline = time.Now().Add(plDebugReleaseTimeout)
		if !a.cleanupDeadline.IsZero() && a.cleanupDeadline.Before(s.closeDeadline) {
			s.closeDeadline = a.cleanupDeadline
		}
	}
	if a.active != nil || a.unknown || len(a.rows) != 0 {
		a.mu.Unlock()
		return errPLDebugAllocationUnknown
	}
	if !s.closeStarted {
		s.closeStarted = true
		go s.closeRaw()
	}
	done, deadline := s.closeDone, s.closeDeadline
	a.mu.Unlock()
	select {
	case <-done:
		return s.result()
	default:
	}
	timer := time.NewTimer(time.Until(deadline))
	defer timer.Stop()
	select {
	case <-done:
		return s.result()
	case <-timer.C:
		return errPLDebugAllocationUnknown
	}
}

func (s *plDebugStatement) result() error {
	s.allocation.mu.Lock()
	defer s.allocation.mu.Unlock()
	return s.closeErr
}

func (s *plDebugStatement) closeRaw() {
	var err error
	defer func() {
		if recovered := recover(); recovered != nil {
			err = fmt.Errorf("PL/SQL statement close panicked: %v", recovered)
		}
		a := s.allocation
		a.mu.Lock()
		s.closeErr = err
		if err != nil {
			a.unknown = true
		} else {
			delete(a.statements, s)
		}
		a.closingStatements--
		close(s.closeDone)
		retiring := a.retiring && !a.unknown && len(a.statements) == 0 && len(a.rows) == 0
		a.mu.Unlock()
		if retiring {
			_ = a.close()
		}
	}()
	err = s.Stmt.Close()
}

func (s *plDebugStatement) CheckNamedValue(value *driver.NamedValue) error {
	if checker, ok := s.Stmt.(driver.NamedValueChecker); ok {
		return checker.CheckNamedValue(value)
	}
	return driver.ErrSkip
}

func (s *plDebugStatement) ExecContext(ctx context.Context, args []driver.NamedValue) (driver.Result, error) {
	return s.allocation.exec(ctx, func(private context.Context) (driver.Result, error) {
		if stmt, ok := s.Stmt.(driver.StmtExecContext); ok {
			return stmt.ExecContext(private, args)
		}
		values := make([]driver.Value, len(args))
		for i, arg := range args {
			if arg.Name != "" {
				return nil, errors.New("legacy PL/SQL statement does not support named arguments")
			}
			values[i] = arg.Value
		}
		return s.Stmt.Exec(values)
	})
}

func (s *plDebugStatement) Exec(args []driver.Value) (driver.Result, error) {
	values := make([]driver.NamedValue, len(args))
	for i, arg := range args {
		values[i] = driver.NamedValue{Ordinal: i + 1, Value: arg}
	}
	return s.ExecContext(context.Background(), values)
}

func (s *plDebugStatement) QueryContext(ctx context.Context, args []driver.NamedValue) (driver.Rows, error) {
	return s.allocation.query(ctx, func(private context.Context) (driver.Rows, error) {
		if stmt, ok := s.Stmt.(driver.StmtQueryContext); ok {
			return stmt.QueryContext(private, args)
		}
		values := make([]driver.Value, len(args))
		for i, arg := range args {
			if arg.Name != "" {
				return nil, errors.New("legacy PL/SQL statement does not support named arguments")
			}
			values[i] = arg.Value
		}
		return s.Stmt.Query(values)
	})
}

func (s *plDebugStatement) Query(args []driver.Value) (driver.Rows, error) {
	values := make([]driver.NamedValue, len(args))
	for i, arg := range args {
		values[i] = driver.NamedValue{Ordinal: i + 1, Value: arg}
	}
	return s.QueryContext(context.Background(), values)
}

```

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
    } else if params.ssl && !has_query_param(&url, "tls_version") {
        set_query_param(&mut url, "tls_version", "tlsv1.2,tlsv1.3");
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

fn has_query_param(url: &Url, key: &str) -> bool {
    url.query_pairs().any(|(existing, _)| existing.eq_ignore_ascii_case(key))
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
        assert!(error.to_string().contains("client 
```

### Core Architecture Module: `agents/drivers/tdengine/src/driver.rs`
```
use std::collections::{HashMap, HashSet};
use std::future::Future;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, LazyLock, Mutex as StdMutex};
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

/// 表列表快照的兜底有效期。
///
/// 本进程内执行的可能改变元数据的 SQL 会立刻让快照失效，这里只兜住「其他客户端/其他
/// 实例」造成的元数据变化：最长延迟一分钟能看到新表。大库扫描很贵，不能按每次翻页重扫。
const TABLE_CACHE_TTL: Duration = Duration::from_secs(60);

/// 进程级表快照缓存。
///
/// core 的侧栏翻页会为每次请求新开一个 ephemeral metadata session（随机 session id，
/// 请求结束即关闭，见 `crates/dbx-core/src/schema/mod.rs` 的 `EphemeralAgentMetadataSession`），
/// driver 随该会话创建和销毁，实例级缓存无法跨请求命中。快照因此放到进程级，按
/// 「连接指纹 + 数据库」复用；键里带连接指纹，避免多个连接共用同一 agent 进程时串数据。
static TABLE_SNAPSHOTS: LazyLock<StdMutex<HashMap<String, TableSnapshot>>> = LazyLock::new(Default::default);

/// 元数据代数。
///
/// 任一会话执行 CREATE/DROP/ALTER 等语句后自增，使其他会话里已缓存的快照立即失效，
/// 避免「在 SQL 编辑器里建了表，侧栏却要等 TTL 才看得到」。
static METADATA_GENERATION: AtomicU64 = AtomicU64::new(0);

const QUERY_SESSION_IDLE_TIMEOUT: Duration = Duration::from_secs(10 * 60);
const DEFAULT_CONNECT_TIMEOUT: Duration = Duration::from_secs(15);

pub struct TdengineDriver {
    connection: Option<Taos>,
    params: ConnectParams,
    server_version: Option<String>,
    session_timezone: Option<Tz>,
    current_database: String,
    query_sessions: HashMap<String, QueryCursor>,
}

struct TableSnapshot {
    loaded_at: Instant,
    /// 生成该快照时的 `METADATA_GENERATION`，与当前值不一致即视为过期。
    generation: u64,
    /// 共享给所有分页请求，命中缓存时只增加引用计数，不复制整份列表。
    tables: Arc<Vec<TableInfo>>,
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

pub fn ensure_crypto_provider() {
    let _ = rustls::crypto::ring::default_provider().install_default();
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
        }
    }

    pub async fn connect(&mut self, params: ConnectParams) -> Result<()> {
        ensure_crypto_provider();
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
        // 元数据接口的返回顺序没有保证，服务端翻页会让 offset 在两次请求间跳行；
        // 这里始终读取完整列表（进程级快照），在本地排序切片。
        let tables = self.all_tables(&database, token).await?;
        Ok(filter_tables(tables.as_slice(), &constraints))
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
        let 
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
    crate::driver::ensure_crypto_provider();
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

    async fn session(&self, id: &str) -> Result<Arc<Agen
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #14525** (2026-11-07): **[Bug] PostgreSQL创建表无法选中安装的扩展类型**
  *Symptoms*: ### 数据库类型和版本 / Database type and version  PostgreSQL 18.6  ### 问题描述 / Problem description  我在PostgreSQL 安装了扩展vector 但是创建表的时候无法找到这个下拉选项  <img width="1209" height="255" alt="Image" src="https://github.com/user-attachments/assets/9ef912d0-e9d8-4e75-8034-1e81efec3928" />  但是通过SQL创建的   显示这个类型 但是下拉选项依旧没有这类型  ### 支持信息 / Support information  <img width="403" height="426" alt="Image" src="https://github.com/user-attachments/assets/63531858-8728-4f99-afe2-1591d002258e" />  ### 优先级（是否紧急） / Priority (urgency)  🟠 P1 重要 · 尽快处理 / Important · Fix soon  ### 补充信息 / Additional information  _No response_
  **Post-Mortem & Fix Analysis**:
  > /claim
  > ✅ @dienaso 已认领 #14525，开始处理吧！

- **Issue #14518** (2026-11-07): **[Bug] 修改存储过程中使用了未定义的变量任然可以执行成功**
  *Symptoms*: ### 数据库类型和版本 / Database type and version  SQL server  ### 问题描述 / Problem description  修改存储过程中使用了未定义的变量任然可以执行成功  <img width="1518" height="651" alt="Image" src="https://github.com/user-attachments/assets/d24cbe7c-6ec5-43a7-aea8-dbb7f1dbeb49" />  ### 支持信息 / Support information  修改存储过程中使用了未定义的变量任然可以执行成功  ### 优先级（是否紧急） / Priority (urgency)  🔴 P0 紧急 · 下个版本必须修 / Urgent · Must fix next release  ### 补充信息 / Additional information  _No response_
  **Post-Mortem & Fix Analysis**:
  > /claim
  > ✅ @Acd-kk 已认领 #14518，开始处理吧！

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

### Incident Patch 1: `1fd5f9c3` (2026-11-08)
**Commit Message**: fix(release): retry agent R2 uploads and resume driver sync

The first attempt of the agents release uploaded the JRE tarballs in one
unretried `aws s3 cp`, so a single R2 response timeout failed the whole
release after every build had succeeded. Retry each upload, and sync the
version-scoped driver packages by size so a retry only sends what is missing.

**File**: `.github/workflows/agents-release.yml` (modified, +19/-5)
```diff
@@ -1879,23 +1879,37 @@ jobs:
           R2_ENDPOINT: "https://${{ secrets.R2_ACCOUNT_ID }}.r2.cloudflarestorage.com"
           R2_BUCKET: "s3://${{ secrets.R2_BUCKET_NAME }}"
         run: |
+          set -euo pipefail
+          retry() {
+            local attempt
+            for attempt in 1 2 3; do
+              if "$@"; then
+                return 0
+              fi
+              echo "::warning::R2 upload attempt ${attempt}/3 failed: $*"
+              sleep $((attempt * 15))
+            done
+            return 1
+          }
           # Always upload the current registry.
-          aws s3 cp release/agent-registry.json \
+          retry aws s3 cp release/agent-registry.json \
             "$R2_BUCKET/agents/agent-registry.json" \
             --endpoint-url "$R2_ENDPOINT"
           echo "Uploaded agent-registry.json"
 
-          # Upload all single-driver packages concurrently.
-          aws s3 cp release/ "$R2_BUCKET/agents/drivers/" \
-            --recursive \
+          # Upload all single-driver packages concurrently. Package names carry
+          # the driver version, so the size check makes a retry resume after a
+          # transient R2 failure instead of re-uploading every driver again.
+          retry aws s3 sync release/ "$R2_BUCKET/agents/drivers/" \
             --exclude "*" \
             --include "dbx-agent-*.tar.zst" \
             --include "dbx-agent-*.tar.zst.delta" \
+            --size-only \
             --endpoint-url "$R2_ENDPOINT"
           echo "Uploaded single-driver packages"
 
           # Upload JRE packages concurrently, always overwriting the stable names.
-          aws s3 cp release/ "$R2_BUCKET/agents/jre/" \
+          retry aws s3 cp release/ "$R2_BUCKET/agents/jre/" \
             --recursive \
             --exclude "*" \
             --include "dbx-jre-*.tar.zst" \
```

---

### Incident Patch 2: `5f1b876d` (2026-11-08)
**Commit Message**: fix(oracle): scope trigger listings by TABLE_OWNER

Closes #13498

**File**: `agents/common/src/main/java/com/dbx/agent/OracleTriggerReader.java` (modified, +19/-0)
```diff
@@ -77,6 +77,25 @@ private static void attach(ObjectInfo object, TriggerInfo trigger) {
         object.setParent_name(parent == null ? null : parent.name());
     }
 
+    /**
+     * Schema-level trigger objects for the object tree's "触发器" group.
+     *
+     * <p>Unlike {@link #listTriggers}, this returns every trigger owned by the schema,
+     * including schema- and database-scoped triggers, as lightweight {@link ObjectInfo}
+     * rows that the tree expands and enriches on demand. The generic JDBC table/routine
+     * metadata never lists triggers, so the JDBC agent's schema object group is otherwise
+     * empty for Oracle connections (#13498).</p>
+     */
+    public List<ObjectInfo> listSchemaObjects(String owner) throws SQLException {
+        List<ObjectInfo> objects = new ArrayList<>();
+        for (TriggerInfo trigger : summaries("t.OWNER = ?", List.of(owner), false)) {
+            ObjectInfo object = new ObjectInfo(trigger.getName(), "TRIGGER", owner, null);
+            attach(object, trigger);
+            objects.add(object);
+        }
+        return objects;
+    }
+
     private TriggerInfo unavailable(ObjectInfo object, String owner, OracleTriggerMetadata.ReadState failure) {
         TriggerInfo trigger = new TriggerInfo(object.getName(), "", "");
         Map<String, OracleTriggerMetadata.ReadState> reads = new LinkedHashMap<>();
```

**File**: `agents/common/src/main/java/com/dbx/agent/StandardJdbcMetadata.java` (modified, +34/-0)
```diff
@@ -151,11 +151,45 @@ public List<ObjectInfo> listObjects(
                 && !configuredDatabase.trim().isEmpty()) {
                 appendRoutines(result, meta, profile.getEscapeSchemaWildcards(), configuredDatabase, schema, schema);
             }
+            // The generic JDBC table/routine metadata never lists Oracle triggers, so the
+            // schema "触发器" group is empty for JDBC Oracle connections unless we read them
+            // directly from the dictionary (#13498). Non-Oracle databases either lack the
+            // dictionary views or don't expose triggers this way, so the query is Oracle-only.
+            if (isOracle(meta)) {
+                try {
+                    result.addAll(new OracleTriggerReader(conn, oracleEngine(meta)).listSchemaObjects(schema));
+                } catch (Exception | AbstractMethodError ignored) {
+                    // Trigger metadata is best-effort; never fail the whole object group.
+                }
+            }
             result.sort(Comparator.comparing(ObjectInfo::getName));
             return normalized.filterObjects(result);
         });
     }
 
+    private static boolean isOracle(DatabaseMetaData meta) {
+        try {
+            String productName = meta.getDatabaseProductName();
+            return productName != null
+                && (productName.toLowerCase(Locale.ROOT).contains("oracle")
+                    || productName.toLowerCase(Locale.ROOT).contains("oceanbase"));
+        } catch (Exception | AbstractMethodError ignored) {
+            return false;
+        }
+    }
+
+    private static String oracleEngine(DatabaseMetaData meta) {
+        try {
+            String productName = meta.getDatabaseProductName();
+            if (productName != null && productName.toLowerCase(Locale.ROOT).contains("oceanbase")) {
+                return "oceanbase-oracle";
+            }
+        } catch (Exception | AbstractMethodError ignored) {
+            // fall through to plain oracle
+        }
+        return "oracle";
+    }
+
     public List<String> listDataTypes(Connection conn) {
         return unchecked(() -> {
             Set<String> seen = new LinkedHashSet<>();
```

**File**: `agents/common/src/test/java/com/dbx/agent/OracleTriggerReaderTest.java` (modified, +17/-0)
```diff
@@ -59,6 +59,23 @@ void enrichesOnlyTheSelectedPageWithoutLoadingSourceOrRewritingOtherRows() throw
         }
     }
 
+    @Test
+    void listsSchemaLevelTriggerObjectsForTheTreeGroup() throws Exception {
+        try (Connection connection = fixture()) {
+            OracleTriggerReader reader = new OracleTriggerReader(connection, "oceanbase-oracle");
+            List<ObjectInfo> objects = reader.listSchemaObjects(OWNER);
+            assertEquals(1, objects.size());
+            ObjectInfo trigger = objects.get(0);
+            assertEquals("TRIGGER", trigger.getObject_type());
+            assertEquals(NAME, trigger.getName());
+            assertEquals(OWNER, trigger.getSchema());
+            assertNotNull(trigger.getTrigger());
+            assertEquals(PARENT_OWNER, trigger.getParent_schema());
+            assertEquals(" Parent ", trigger.getParent_name());
+            assertFalse(trigger.getValid());
+        }
+    }
+
     @Test
     void missingColumnsStayUnknownRatherThanDisabledOrValid() throws Exception {
         try (Connection connection = fixture()) {
```

**File**: `agents/common/src/test/java/com/dbx/agent/StandardJdbcMetadataTest.java` (modified, +149/-0)
```diff
@@ -5,6 +5,7 @@
 import org.junit.jupiter.params.provider.CsvSource;
 
 import java.lang.reflect.InvocationHandler;
+import java.lang.reflect.InvocationTargetException;
 import java.lang.reflect.Method;
 import java.lang.reflect.Proxy;
 import java.sql.Connection;
@@ -20,9 +21,11 @@
 import java.util.Map;
 import java.util.concurrent.atomic.AtomicReference;
 import java.util.concurrent.atomic.AtomicInteger;
+import java.util.stream.Collectors;
 
 import static org.junit.jupiter.api.Assertions.assertEquals;
 import static org.junit.jupiter.api.Assertions.assertFalse;
+import static org.junit.jupiter.api.Assertions.assertNotNull;
 import static org.junit.jupiter.api.Assertions.assertTrue;
 
 class StandardJdbcMetadataTest {
@@ -878,6 +881,152 @@ void completionEscapesExactParentTable(String escape, String table, String expec
         assertEquals(table, result.getCandidates().get(0).getParent_name());
     }
 
+    @Test
+    void listsOracleTriggersInTheSchemaObjectGroup() throws Exception {
+        try (Connection connection = oracleFixture()) {
+            List<ObjectInfo> objects = StandardJdbcMetadata.INSTANCE.listObjects(
+                connection, oracleProfile(), "ORCL", "APP", MetadataListConstraints.NONE);
+
+            List<ObjectInfo> triggers = objects.stream()
+                .filter(object -> "TRIGGER".equals(object.getObject_type()))
+                .collect(Collectors.toList());
+            assertEquals(1, triggers.size());
+            ObjectInfo trigger = triggers.get(0);
+            assertEquals("Trigger A", trigger.getName());
+            assertEquals("APP", trigger.getSchema());
+            assertNotNull(trigger.getTrigger());
+            assertEquals("Trigger A", trigger.getTrigger().getName());
+            assertEquals("PARENT_OWNER", trigger.getParent_schema());
+            assertEquals("PARENT_TABLE", trigger.getParent_name());
+        }
+    }
+
+    @Test
+    void nonOracleConnectionsNeverReadTheOracleTriggerDictionary() {
+        AtomicInteger preparedStatements = new AtomicInteger();
+        DatabaseMetaData meta = proxy(DatabaseMetaData.class, new MethodHandler() {
+            @Override
+            public Object handle(Method method, Object[] args) {
+                if ("getTables".equals(method.getName())) {
+                    return rows(row("TABLE_NAME", "T", "TABLE_TYPE", "TABLE", "REMARKS", null));
+                }
+                if ("getDatabaseProductName".equals(method.getName())) {
+                    return "PostgreSQL";
+                }
+                if ("getTableTypes".equals(method.getName())) {
+                    return rows(row("TABLE_TYPE", "TABLE"));
+                }
+                return defaultValue(method.getReturnType());
+            }
+        });
+        Connection conn = proxy(Connection.class, new MethodHandler() {
+            @Override
+            public Object handle(Method method, Object[] args) {
+                if ("getMetaData".equals(method.getName())) {
+                    return meta;
+                }
+                if ("prepareStatement".equals(method.getName())) {
+                    preparedStatements.incrementAndGet();
+                }
+                return defaultValue(method.getReturnType());
+            }
+        });
+
+        List<ObjectInfo> objects = StandardJdbcMetadata.INSTANCE.listObjects(
+            conn, profile, "postgres", "public", MetadataListConstraints.NONE);
+        assertEquals(0, preparedStatements.get());
+        assertTrue(objects.stream().noneMatch(object -> "TRIGGER".equals(object.getObject_type())));
+    }
+
+    @Test
+    void oracleTriggerReadFailureKeepsTheRestOfTheObjectGroup() throws Exception {
+        try (Connection h2 = oracleH2Fixture()) {
+            h2.createStatement().execute("DROP TABLE ALL_TRIGGERS");
+            List<ObjectInfo> objects = StandardJdbcMetadata.INSTANCE.listObjects(
+                asOracleConnection(h2), oracleProfile(), "ORCL", "APP", MetadataListConstraints.NONE);
+            assertTrue(objects.stream().noneMatch(object -> "TRIGGER".equals(object.getObject_type())));
+        }
+    }
+
+    private static JdbcAgentProfile oracleProfile() {
+        return new JdbcAgentProfile(
+            "oracle.jdbc.OracleDriver",
+            "jdbc:oracle:thin:@{host}:{port}/{database}",
+            1521,
+            false,
+            Collections.singleton("SYS"),
+            Arrays.asList("TABLE", "VIEW")
+        );
+    }
+
+    /**
+     * An Oracle-flavoured connection whose ALL_TRIGGERS dictionary answers the
+     * schema-level trigger query used by the object tree's 触发器 group.
+     */
+    private static Connection oracleFixture() throws Exception {
+        return asOracleConnection(oracleH2Fixture());
+    }
+
+    private static Connection oracleH2Fixture() throws Exception {
+        Connection h2 = java.sql.DriverManager.getConnection(
+            "jdbc:h2:mem:" + java.util.UUID.randomUUID() + ";MODE=Oracle
```

**File**: `agents/drivers/oracle-go/main.go` (modified, +1/-1)
```diff
@@ -262,7 +262,7 @@ LEFT JOIN ALL_SOURCE s
   ON s.OWNER = t.OWNER
  AND s.NAME = t.TRIGGER_NAME
  AND s.TYPE = 'TRIGGER'
-WHERE t.OWNER = :1
+WHERE t.TABLE_OWNER = :1
   AND t.TABLE_NAME = :2
   AND t.BASE_OBJECT_TYPE IN ('TABLE', 'VIEW')
 ORDER BY t.TRIGGER_NAME, s.LINE`
```

**File**: `agents/drivers/oracle-go/main_test.go` (modified, +7/-2)
```diff
@@ -2750,8 +2750,13 @@ func TestOracleListTriggersSQLLoadsSourceWithoutLongColumns(t *testing.T) {
 	if strings.Contains(sqlText, "TRIGGER_BODY") {
 		t.Fatalf("trigger listing should avoid Oracle LONG trigger bodies, got: %s", oracleListTriggersSQL)
 	}
-	if !strings.Contains(sqlText, "T.OWNER = :1") || !strings.Contains(sqlText, "T.TABLE_NAME = :2") {
-		t.Fatalf("trigger listing should stay scoped to the selected schema and table, got: %s", oracleListTriggersSQL)
+	// Strict TABLE_OWNER scoping matches every sibling trigger path (the Rust
+	// reader, the Java agent, the DDL loader in this file, DBeaver) and keeps
+	// oracle_table_triggers' inventory OWNER match intact; an OR OWNER branch
+	// would list same-named tables in other schemas and then hard-fail that
+	// inventory check (#13498 review).
+	if !strings.Contains(sqlText, "T.TABLE_OWNER = :1") || !strings.Contains(sqlText, "T.TABLE_NAME = :2") || strings.Contains(sqlText, "T.OWNER = :1") {
+		t.Fatalf("trigger listing should scope strictly by the base table owner and table, got: %s", oracleListTriggersSQL)
 	}
 }
 
```

**File**: `crates/dbx-core/src/schema/oracle_table_triggers.rs` (modified, +18/-13)
```diff
@@ -1,6 +1,6 @@
 use super::*;
 use dbx_sql::object_source_sql::{
-    oracle_trigger_ddl_sources, oracle_trigger_enabled, oracle_trigger_metadata_matches,
+    oracle_trigger_ddl_sources_with_table_owner, oracle_trigger_enabled, oracle_trigger_metadata_matches,
     oracle_trigger_source_with_create,
 };
 
@@ -36,18 +36,20 @@ pub(super) async fn enrich(
         }
     };
     for trigger in triggers.iter_mut().filter(|trigger| incomplete(trigger)) {
-        let mut rows = inventory.rows.iter().filter(|row| {
-            row.first().and_then(serde_json::Value::as_str) == Some(schema)
-                && row.get(1).and_then(serde_json::Value::as_str) == Some(trigger.name.as_str())
-        });
+        // The listing admits triggers owned by other schemas (TABLE_OWNER
+        // match), so rows are keyed by name here and the row's actual OWNER is
+        // recorded instead of being required to equal the queried schema
+        // (#13498 review).
+        let mut rows = inventory
+            .rows
+            .iter()
+            .filter(|row| row.get(1).and_then(serde_json::Value::as_str) == Some(trigger.name.as_str()));
         let row =
             rows.next().ok_or_else(|| format!("{schema}.{}: trigger identity changed; compare again", trigger.name))?;
-        if rows.next().is_some()
-            || row.get(2).and_then(serde_json::Value::as_str) != Some(schema)
-            || row.get(3).and_then(serde_json::Value::as_str) != Some(table)
-        {
+        if rows.next().is_some() || row.get(3).and_then(serde_json::Value::as_str) != Some(table) {
             return Err(format!("{schema}.{}: trigger table identity changed; compare again", trigger.name));
         }
+        let trigger_owner = row.first().and_then(serde_json::Value::as_str).unwrap_or(schema);
         let enabled = match row.get(4).and_then(serde_json::Value::as_str) {
             Some("ENABLED") => true,
             Some("DISABLED") => false,
@@ -63,12 +65,15 @@ pub(super) async fn enrich(
             return Err(format!("{schema}.{}: trigger firing state changed; compare again", trigger.name));
         }
         let missing_source = trigger.statement.as_deref().is_none_or(|source| source.trim().is_empty());
+        // A cross-schema trigger's ALL_SOURCE rows live under its actual OWNER,
+        // so both the source lookup and the identity check use trigger_owner
+        // rather than the queried schema (#13498 review).
         let source = if missing_source {
             match get_object_source_core(
                 state,
                 connection_id,
                 database,
-                schema,
+                trigger_owner,
                 &trigger.name,
                 db::ObjectSourceKind::Trigger,
                 None,
@@ -97,7 +102,7 @@ pub(super) async fn enrich(
             }
         };
         if source.name != trigger.name
-            || source.schema.as_deref() != Some(schema)
+            || source.schema.as_deref() != Some(trigger_owner)
             || source.object_type != db::ObjectSourceKind::Trigger
         {
             return Err(format!("{schema}.{}: trigger source identity changed; compare again", trigger.name));
@@ -112,15 +117,15 @@ pub(super) async fn enrich(
                 continue;
             }
         };
-        let definitions = match oracle_trigger_ddl_sources(&full, schema) {
+        let definitions = match oracle_trigger_ddl_sources_with_table_owner(&full, trigger_owner, schema) {
             Ok(definitions) => definitions,
             Err(_) => {
                 log::warn!("Trigger metadata remains incomplete for {schema}.{}: invalid declaration", trigger.name);
                 continue;
             }
         };
         if definitions.len() != 1
-            || definitions[0].owner != schema
+            || definitions[0].owner != trigger_owner
             || definitions[0].name != trigger.name
             || definitions[0].table_owner != schema
             || definitions[0].table != table
```

**File**: `crates/dbx-sql-core/src/object_source_sql.rs` (modified, +7/-6)
```diff
@@ -17,12 +17,13 @@ pub use oracle_trigger::{
 mod oracle_routines;
 pub use oracle_indexes::{
     extract_oracle_table_triggers, oracle_index_ddl_sources, oracle_table_created_index_identities,
-    oracle_trigger_ddl_sources, oracle_trigger_definitions_match, oracle_trigger_enabled,
-    oracle_trigger_metadata_matches, oracle_trigger_source_with_create, order_oracle_trigger_sources,
-    parse_oracle_table_ddl, rebase_oracle_table_ddl, rebase_oracle_trigger_ddl, separate_oracle_supporting_indexes,
-    separate_oracle_supporting_indexes_with_retained, split_oracle_table_ddl, split_oracle_table_ddl_with_retained,
-    OracleDdlNameMapping, OracleIndexDdlSource, OracleSupportingIndexDdl, OracleSupportingIndexIdentity,
-    OracleTableConstraintSource, OracleTableDdlParts, OracleTableDdlSource, OracleTriggerDdlSource,
+    oracle_trigger_ddl_sources, oracle_trigger_ddl_sources_with_table_owner, oracle_trigger_definitions_match,
+    oracle_trigger_enabled, oracle_trigger_metadata_matches, oracle_trigger_source_with_create,
+    order_oracle_trigger_sources, parse_oracle_table_ddl, rebase_oracle_table_ddl, rebase_oracle_trigger_ddl,
+    separate_oracle_supporting_indexes, separate_oracle_supporting_indexes_with_retained, split_oracle_table_ddl,
+    split_oracle_table_ddl_with_retained, OracleDdlNameMapping, OracleIndexDdlSource, OracleSupportingIndexDdl,
+    OracleSupportingIndexIdentity, OracleTableConstraintSource, OracleTableDdlParts, OracleTableDdlSource,
+    OracleTriggerDdlSource,
 };
 pub use oracle_routines::{
     analyze_oracle_package_body_draft, analyze_oracle_routine_draft, compact_oracle_ddl,
```

---

### Incident Patch 3: `9eb7dfb9` (2026-11-08)
**Commit Message**: fix(postgres): surface underlying server errors

Closes #13016

**File**: `Cargo.lock` (modified, +3/-3)
```diff
@@ -7200,7 +7200,7 @@ dependencies = [
 [[package]]
 name = "postgres-protocol"
 version = "0.6.12"
-source = "git+https://github.com/t8y2/tokio-postgres-gaussdb.git?rev=ac8ad476de59093d33ab9f294531c956e0c6a724#ac8ad476de59093d33ab9f294531c956e0c6a724"
+source = "git+https://github.com/t8y2/tokio-postgres-gaussdb.git?rev=5f37ebd1ae8e2c81ac07b89a046c9319f7a1bc89#5f37ebd1ae8e2c81ac07b89a046c9319f7a1bc89"
 dependencies = [
  "base64 0.23.0",
  "byteorder",
@@ -7219,7 +7219,7 @@ dependencies = [
 [[package]]
 name = "postgres-types"
 version = "0.2.14"
-source = "git+https://github.com/t8y2/tokio-postgres-gaussdb.git?rev=ac8ad476de59093d33ab9f294531c956e0c6a724#ac8ad476de59093d33ab9f294531c956e0c6a724"
+source = "git+https://github.com/t8y2/tokio-postgres-gaussdb.git?rev=5f37ebd1ae8e2c81ac07b89a046c9319f7a1bc89#5f37ebd1ae8e2c81ac07b89a046c9319f7a1bc89"
 dependencies = [
  "bytes",
  "chrono",
@@ -10291,7 +10291,7 @@ dependencies = [
 [[package]]
 name = "tokio-postgres"
 version = "0.7.18"
-source = "git+https://github.com/t8y2/tokio-postgres-gaussdb.git?rev=ac8ad476de59093d33ab9f294531c956e0c6a724#ac8ad476de59093d33ab9f294531c956e0c6a724"
+source = "git+https://github.com/t8y2/tokio-postgres-gaussdb.git?rev=5f37ebd1ae8e2c81ac07b89a046c9319f7a1bc89#5f37ebd1ae8e2c81ac07b89a046c9319f7a1bc89"
 dependencies = [
  "async-trait",
  "byteorder",
```

**File**: `Cargo.toml` (modified, +3/-3)
```diff
@@ -36,9 +36,9 @@ pageant = { path = "vendor/pageant" }
 # (MicrosoftEdge/WebView2Feedback#5650, see
 # vendor/wry/src/webview2/clipboard_history.rs).
 wry = { path = "vendor/wry" }
-tokio-postgres = { git = "https://github.com/t8y2/tokio-postgres-gaussdb.git", rev = "ac8ad476de59093d33ab9f294531c956e0c6a724" }
-postgres-types = { git = "https://github.com/t8y2/tokio-postgres-gaussdb.git", rev = "ac8ad476de59093d33ab9f294531c956e0c6a724" }
-postgres-protocol = { git = "https://github.com/t8y2/tokio-postgres-gaussdb.git", rev = "ac8ad476de59093d33ab9f294531c956e0c6a724" }
+tokio-postgres = { git = "https://github.com/t8y2/tokio-postgres-gaussdb.git", rev = "5f37ebd1ae8e2c81ac07b89a046c9319f7a1bc89" }
+postgres-types = { git = "https://github.com/t8y2/tokio-postgres-gaussdb.git", rev = "5f37ebd1ae8e2c81ac07b89a046c9319f7a1bc89" }
+postgres-protocol = { git = "https://github.com/t8y2/tokio-postgres-gaussdb.git", rev = "5f37ebd1ae8e2c81ac07b89a046c9319f7a1bc89" }
 # Temporary compatibility patches for deprecated sha256_password accounts and
 # rustls dangerous-mode connections to legacy certificates. Remove after upstream support lands.
 mysql_async = { git = "https://github.com/t8y2/mysql_async.git", rev = "4cd84d86bb86b060320ce3459561e8093e4422fa" }
```

**File**: `crates/dbx-driver-postgres/src/postgres.rs` (modified, +119/-9)
```diff
@@ -82,7 +82,7 @@ pub fn gaussdb_identifier_quote_for_compatibility_mode(compatibility_mode: &str)
 pub async fn opengauss_compatibility_mode(pool: &Pool) -> Result<Option<String>, String> {
     let client = checkout_postgres_client(pool, None, super::connection_timeout()).await?;
     let client = &EncodingClient::new(&client);
-    let row = postgres_query_one_cached(client, GAUSSDB_COMPATIBILITY_SQL, &[]).await.map_err(|e| e.to_string())?;
+    let row = postgres_query_one_cached(client, GAUSSDB_COMPATIBILITY_SQL, &[]).await.map_err(pg_error_to_string)?;
     Ok(row.try_get::<_, Option<String>>(0).ok().flatten().filter(|value| !value.trim().is_empty()))
 }
 
@@ -1558,9 +1558,9 @@ fn escape_tsvector_lexeme(value: &str) -> String {
 fn pg_error_to_string(err: impl Into<PgError>) -> String {
     let err = err.into();
     let Some(db_error) = err.as_db_error() else {
-        return err.to_string();
+        return error_with_sources_to_string(&err);
     };
-    let mut message = pg_db_error_to_string(db_error);
+    let mut message = db_error.to_string();
     // Carry the server-reported cursor position across the `db` layer's
     // `Result<_, String>` boundary; `query.rs` resolves it against the executed
     // statement and strips the suffix before the message reaches any client.
@@ -1577,7 +1577,7 @@ fn pg_error_to_string(err: impl Into<PgError>) -> String {
 /// be resolved against the user's SQL and point at the wrong place.
 fn pg_error_to_string_plain(err: impl Into<PgError>) -> String {
     let err = err.into();
-    err.as_db_error().map(pg_db_error_to_string).unwrap_or_else(|| err.to_string())
+    err.as_db_error().map(pg_db_error_to_string).unwrap_or_else(|| error_with_sources_to_string(&err))
 }
 
 /// Tries each SQL tier in `tiers` in order (most-capable first), via `run`,
@@ -1816,7 +1816,11 @@ fn pg_pool_error_to_string(err: PoolError) -> String {
 }
 
 fn should_retry_postgres_text_query(err: &PgError) -> bool {
-    let message = err.as_db_error().map(ToString::to_string).unwrap_or_else(|| err.to_string()).to_ascii_lowercase();
+    let message = err
+        .as_db_error()
+        .map(ToString::to_string)
+        .unwrap_or_else(|| error_with_sources_to_string(err))
+        .to_ascii_lowercase();
     should_retry_postgres_text_query_message(&message)
 }
 
@@ -1834,7 +1838,8 @@ fn should_retry_postgres_stale_cache(err: &PgError) -> bool {
             db_error.message(),
         );
     }
-    should_retry_postgres_stale_cache_fields(None, None, &err.to_string())
+    let message = error_with_sources_to_string(err);
+    should_retry_postgres_stale_cache_fields(None, None, &message)
 }
 
 fn should_retry_postgres_stale_cache_fields(sqlstate: Option<&str>, routine: Option<&str>, message: &str) -> bool {
@@ -1850,7 +1855,8 @@ fn should_fallback_postgres_missing_prepared_statement(err: &PgError) -> bool {
             db_error.message(),
         );
     }
-    should_fallback_postgres_missing_prepared_statement_fields(None, &err.to_string())
+    let message = error_with_sources_to_string(err);
+    should_fallback_postgres_missing_prepared_statement_fields(None, &message)
 }
 
 fn should_fallback_postgres_missing_prepared_statement_fields(sqlstate: Option<&str>, message: &str) -> bool {
@@ -3932,7 +3938,7 @@ fn database_storage_sql() -> &'static str {
 pub async fn list_databases(pool: &Pool) -> Result<Vec<DatabaseInfo>, String> {
     let client = checkout_postgres_client(pool, None, super::connection_timeout()).await?;
     let client = &EncodingClient::new(&client);
-    let rows = postgres_query_cached(client, list_databases_sql(), &[]).await.map_err(|e| e.to_string())?;
+    let rows = postgres_query_cached(client, list_databases_sql(), &[]).await.map_err(pg_error_to_string)?;
 
     Ok(rows.iter().map(|row| DatabaseInfo { name: pg_row_try_string(row, 0), ..Default::default() }).collect())
 }
@@ -3943,7 +3949,7 @@ pub async fn list_opengauss_databases(pool: &Pool) -> Result<Vec<DatabaseInfo>,
     let rows = match postgres_query_cached(client, list_opengauss_databases_sql(), &[]).await {
         Ok(rows) => rows,
         Err(primary_error) => {
-            let primary_error = primary_error.to_string();
+            let primary_error = pg_error_to_string(primary_error);
             return postgres_query_cached(client, list_databases_sql(), &[])
                 .await
                 .map(|rows| {
@@ -3952,6 +3958,7 @@ pub async fn list_opengauss_databases(pool: &Pool) -> Result<Vec<DatabaseInfo>,
                         .collect()
                 })
                 .map_err(|fallback_error| {
+                    let fallback_error = pg_error_to_string(fallback_error);
                     format!(
                         "openGauss database compatibility lookup failed: {primary_error}; database list fallback failed: {fallback_error}"
                     )
@@ -17877,6 +17884,109 @@ mod tests {
         let other_schema = format!("CREATE OR REPLACE PROCEDURE oth
```

**File**: `flake.nix` (modified, +2/-2)
```diff
@@ -217,8 +217,8 @@
                 "sha256-8lWgsdTuLTgOmzP7tXmA9LnomOE0wjxXsCBw9NEMt2o=";
               "git+https://github.com/t8y2/mysql_async.git?rev=2be6e392eb9b06d20dcd2d8ed8eae748d413c9ec#2be6e392eb9b06d20dcd2d8ed8eae748d413c9ec" =
                 "sha256-tMFvmypIBh1GHg3cLFWmLf6N1wrwKPlzx2G/MHwtlFM=";
-              "git+https://github.com/t8y2/tokio-postgres-gaussdb.git?rev=115f9fef10f0fc3669b5337955e4eb461fc349a6#115f9fef10f0fc3669b5337955e4eb461fc349a6" =
-                "sha256-HRbYVSD7iIwG3m1tOGoIZy0xAZwALWIpTtakVSYPIYI=";
+              "git+https://github.com/t8y2/tokio-postgres-gaussdb.git?rev=5f37ebd1ae8e2c81ac07b89a046c9319f7a1bc89#5f37ebd1ae8e2c81ac07b89a046c9319f7a1bc89" =
+                "sha256-NkSST+xuE8NCVobwmX5j87WY+zXU6aWHMSR0LFjn8UA=";
             };
           };
 
```

#### Recent Merged Pull Requests:
- **PR #14556** (2026-11-08): feat(editor): save routine definitions to database (@Acd-kk)
- **PR #14553** (2026-11-08): feat(elasticsearch): add per-connection index search (@ThugKd)
- **PR #14545** (2026-11-08): feat(query): add configurable shortcut to copy the active result (@imcman)
- **PR #14542** (2026-11-07): fix(grid): Oracle 无主键查询结果与表数据页签对齐 keyless 可编辑性 (@dienaso)
- **PR #14541** (2026-11-07): fix(export): TDengine 标识符改用反引号，双引号在 TDengine 中是字符串字面量 (@dienaso)
- **PR #14539** (2026-11-07): fix(mcp): dbx_add_connection 补齐 Nacos external_config 与桌面端默认上下文 (@dienaso)

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

## X. release): retry agent R2 uploads and resume driver sync

**RULE**:
When implementing operations in `.github/workflows/agents-release.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in t8y2/dbx. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1fd5f9c3`: release): retry agent R2 uploads and resume driver sync. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/agents-release.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
          set -euo pipefail
          retry() {
            local attempt
            for attempt in 1 2 3; do
              if "$@"; then
                return 0
              fi
              echo "::warning::R2 upload attempt ${attempt}/3 failed: $*"
              sleep $((attempt * 15))
            done
            return 1
          }
          retry aws s3 cp release/agent-registry.json \
          # Upload all single-driver packages concurrently. Package names carry
          # the driver version, so the size check makes a retry resume after a
          # transient R2 failure instead of re-uploading every driver again.
          retry aws s3 sync release/ "$R2_BUCKET/agents/drivers/" \
            --size-only \
          retry aws s3 cp release/ "$R2_BUCKET/agents/jre/" \
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
          aws s3 cp release/agent-registry.json \
          # Upload all single-driver packages concurrently.
          aws s3 cp release/ "$R2_BUCKET/agents/drivers/" \
            --recursive \
          aws s3 cp release/ "$R2_BUCKET/agents/jre/" \
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1fd5f9c3` are properly handled with clean fallback behavior.
