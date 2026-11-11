> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/t8y2-dbx-learnings.md`  
> **Source**: github ([https://github.com/t8y2/dbx](https://github.com/t8y2/dbx))  
> **Source Version**: `e91a85c4`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-11T07:27:43.559Z  
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
> **Harvest Timestamp**: 2026-11-11T07:27:43.553Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `t8y2/dbx`
- **Description**: 25 MB lightweight cross-platform database client for 100+ databases, including MySQL, PostgreSQL, SQLite, Redis, MongoDB, DuckDB, SQL Server, and Dameng. Built-in AI, MCP Server, CLI, desktop and Docker. | 轻量级跨平台数据库管理工具，支持 MySQL、PostgreSQL、SQLite、Redis、MongoDB、达梦等 100+ 数据库，提供桌面端、Docker、CLI、内置 AI 助手和 MCP。
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 29986 stars

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
- **Issue #14709** (2026-11-11): **[Bug] 主键使用触发器实现的自增，无法保存**
  *Symptoms*: ### 数据库类型和版本 / Database type and version  Firebird 0.1.91  ### 问题描述 / Problem description  <img width="1335" height="396" alt="Image" src="https://github.com/user-attachments/assets/40f0e1e9-02b7-428e-b6f2-38b75f03e890" /> 如图，主键是触发器实现的自增保存会提示保存失败`Column "REPORT_DID" does not allow NULL.` ，在dbeaver中是可以正常保存的  ### 支持信息 / Support information  dbx v0.6.68  Windows11  ### 优先级（是否紧急） / Priority (urgency)  🟠 P1 重要 · 尽快处理 / Important · Fix soon  ### 补充信息 / Additional information  _No response_
  **Post-Mortem & Fix Analysis**:
  > /claim
  > ✅ @thailoc-dev 已认领 #14709，开始处理吧！

- **Issue #14698** (2026-11-11): **[Bug] 快捷键中给接受补全设置的是tab，在写SQL时需要敲空格还是自动补全了**
  *Symptoms*: ### 数据库类型和版本 / Database type and version  SQL Server 2019  ### 问题描述 / Problem description  快捷键中给接受补全设置的是tab，在写SQL时需要敲空格还是自动补全了，每次inner join后的条件on想补个空格 自动补全了  <img width="1575" height="967" alt="Image" src="https://github.com/user-attachments/assets/95459018-3c60-40dd-b51e-e0de5cdbe948" />  <img width="1552" height="694" alt="Image" src="https://github.com/user-attachments/assets/fb0aec58-561f-4943-86c8-893c0a52b693" />  ### 支持信息 / Support information  DBX 版本: v0.6.68 (0.6.68-beta.20261107.4) 运行环境: 桌面端 操作系统: Windows 11 (10.0.26200.9168) 系统架构: x86_64 User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0 数据库类型: mysql, plugin, sqlserver  ### 优先级（是否紧急） / Priority (urgency)  🔴 P0 紧急 · 下个版本必须修 / Urgent · Must fix next release  ### 补充信息 / Additional information  _No response_

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

### Incident Patch 1: `b62e570a` (2026-11-10)
**Commit Message**: fix(iotdb): honor unlimited query timeout across paged fetches

**File**: `agents/drivers/iotdb/driver.go` (modified, +24/-6)
```diff
@@ -22,16 +22,34 @@ type iotdbSession interface {
 	Close() error
 }
 
+// The narrow surface nativeIoTDBSession needs from the vendored client.
+// Keeping it an interface lets adapter tests assert that the per-query
+// timeout reaches the session layer instead of being dropped (#13935).
+type clientQuerySession interface {
+	ExecuteQueryStatementWithContext(context.Context, string, *int64) (*client.SessionDataSet, error)
+	ExecuteStatementWithContext(context.Context, string) (*client.SessionDataSet, error)
+	Close() error
+}
+
 type nativeIoTDBSession struct {
-	session *client.Session
+	session clientQuerySession
 }
 
-func (s *nativeIoTDBSession) ExecuteQueryStatement(ctx context.Context, sql string, _ *int64) (*client.SessionDataSet, error) {
-	return executeIoTDBStatement(ctx, s.session, sql)
+func (s *nativeIoTDBSession) ExecuteQueryStatement(ctx context.Context, sql string, timeoutMs *int64) (*client.SessionDataSet, error) {
+	return executeIoTDBStatement(ctx, func() (*client.SessionDataSet, error) {
+		// #13935: the timeout must ride inside the RPC — an omitted value
+		// falls back to the server's query_timeout_threshold (60 s default),
+		// so whatever timeoutMilliseconds produced (the 100-year no-limit
+		// budget, or a positive bound) reaches the request. The old adapter
+		// dropped it here.
+		return s.session.ExecuteQueryStatementWithContext(ctx, sql, timeoutMs)
+	})
 }
 
 func (s *nativeIoTDBSession) ExecuteNonQueryStatement(ctx context.Context, sql string) error {
-	dataset, err := executeIoTDBStatement(ctx, s.session, sql)
+	dataset, err := executeIoTDBStatement(ctx, func() (*client.SessionDataSet, error) {
+		return s.session.ExecuteStatementWithContext(ctx, sql)
+	})
 	if err != nil {
 		return err
 	}
@@ -45,7 +63,7 @@ func (s *nativeIoTDBSession) Close() error {
 	return s.session.Close()
 }
 
-func executeIoTDBStatement(ctx context.Context, session *client.Session, sql string) (dataset *client.SessionDataSet, err error) {
+func executeIoTDBStatement(ctx context.Context, run func() (*client.SessionDataSet, error)) (dataset *client.SessionDataSet, err error) {
 	defer func() {
 		if recovered := recover(); recovered != nil {
 			if ctxErr := ctx.Err(); ctxErr != nil {
@@ -57,7 +75,7 @@ func executeIoTDBStatement(ctx context.Context, session *client.Session, sql str
 			err = fmt.Errorf("IoTDB Go client panicked while executing statement: %v", recovered)
 		}
 	}()
-	return session.ExecuteStatementWithContext(ctx, sql)
+	return run()
 }
 
 type connectionConfig struct {
```

**File**: `agents/drivers/iotdb/integration_test.go` (modified, +149/-0)
```diff
@@ -4,6 +4,7 @@ import (
 	"bufio"
 	"context"
 	"encoding/json"
+	"errors"
 	"fmt"
 	"os"
 	"os/exec"
@@ -13,6 +14,8 @@ import (
 	"sync"
 	"testing"
 	"time"
+
+	"github.com/apache/iotdb-client-go/v2/client"
 )
 
 func TestLiveIoTDBAgentTreeAndTable(t *testing.T) {
@@ -406,3 +409,149 @@ func (b *synchronizedBuffer) String() string {
 	defer b.mu.Unlock()
 	return b.builder.String()
 }
+
+// #13935 review round 3: self-contained live verification against IoTDB 1.3.7.
+//
+// Preconditions: a real IoTDB server reachable via DBX_IOTDB_HOST/PORT with
+//   query_timeout_threshold = 1   (1 ms, in conf/iotdb-system.properties)
+// The test creates its own database/timeseries, asserts the tightened server
+// timeout is actually in effect (a nil-timeout read must fail with the server
+// timeout error), then proves that:
+//   * timeoutSecs=0 (the 100-year no-limit budget) survives every paged fetch
+//     on the agent's session path (executeQueryPage/fetchQueryPage), and
+//   * a cancelled context stops a paged read instead of waiting for the
+//     blocking fetch RPC (client-level NextWithContext).
+func TestLiveIoTDBNoLimitQueryCarriesBudgetThroughFetchPages(t *testing.T) {
+	if os.Getenv("DBX_IOTDB_LIVE") != "1" {
+		t.Skip("set DBX_IOTDB_LIVE=1 to run against a real IoTDB server")
+	}
+	database := fmt.Sprintf("root.dbx_timeout_%d", os.Getpid())
+	device := database + ".d1"
+	seedRows := 50000
+
+	admin := liveIoTDBServer(t, connectParams{})
+	mustExecuteNonQuery(t, admin, "CREATE DATABASE "+database, "")
+	defer func() { _ = admin.executeNonQuery("DELETE DATABASE "+database, "", 0) }()
+	mustExecuteNonQuery(t, admin, "CREATE TIMESERIES "+device+".s0 WITH DATATYPE=INT64, ENCODING=RLE", "")
+	admin.disconnect()
+
+	// Seed 50000 rows through a direct client session so every paged read spans
+	// fetchSize 1000 → 50 fetch pages.
+	seedSession := client.NewSession(&client.Config{
+		Host:      envOr("DBX_IOTDB_HOST", "127.0.0.1"),
+		Port:      strconv.Itoa(envIntOr("DBX_IOTDB_PORT", defaultIoTDBPort)),
+		UserName:  envOr("DBX_IOTDB_USER", "root"),
+		Password:  envOr("DBX_IOTDB_PASSWORD", "root"),
+		FetchSize: 1000,
+		TimeZone:  client.DefaultTimeZone,
+	})
+	if err := seedSession.Open(false, 10000); err != nil {
+		t.Fatalf("seed session: %v", err)
+	}
+	defer func() { _ = seedSession.Close() }()
+	tabletRows := 5000
+	tablet, tabletErr := client.NewTablet(device, []*client.MeasurementSchema{
+		{Measurement: "s0", DataType: client.INT64},
+	}, tabletRows)
+	if tabletErr != nil {
+		t.Fatalf("seed tablet: %v", tabletErr)
+	}
+	for batch := 0; batch < seedRows/tabletRows; batch++ {
+		for index := 0; index < tabletRows; index++ {
+			tablet.SetTimestamp(int64(batch)*int64(tabletRows)+int64(index), index)
+			if err := tablet.SetValueAt(int64(batch*tabletRows+index), 0, index); err != nil {
+				t.Fatalf("seed value: %v", err)
+			}
+		}
+		tablet.RowSize = tabletRows
+		if err := seedSession.InsertTablet(tablet, true); err != nil {
+			t.Fatalf("seed tablet %d: %v", batch, err)
+		}
+		tablet.Reset()
+	}
+
+	server := liveIoTDBServer(t, connectParams{Database: database})
+	defer server.disconnect()
+
+	// 1. Precondition check: a nil (absent) timeout falls back to the server's
+	// query_timeout_threshold. With the documented 1 ms value this paged read
+	// must be aborted by the server; otherwise the environment is misconfigured
+	// and the comparison below proves nothing.
+	started := time.Now()
+	_, err := server.executeQuery(queryOptions{SQL: "SELECT s0 FROM " + device, MaxRows: seedRows, TimeoutSecs: -1})
+	elapsed := time.Since(started)
+	if err == nil {
+		t.Fatalf("server query_timeout_threshold is not tightened: a nil-timeout %d-row read succeeded in %v; set query_timeout_threshold = 1 in conf/iotdb-system.properties", seedRows, elapsed)
+	}
+	lowered := strings.ToLower(err.Error())
+	if !strings.Contains(lowered, "time out") && !strings.Contains(lowered, "timeout") {
+		t.Fatalf("expected the server timeout error for a nil-timeout read, got: %v", err)
+	}
+	t.Logf("precondition ok: nil-timeout paged read failed after %v with: %v", elapsed, err)
+
+	// 2. timeoutSecs=0 maps to the 100-year budget: the same paged read now
+	// returns every row, and each fetch page carries that budget.
+	started = time.Now()
+	result, err := server.executeQuery(queryOptions{SQL: "SELECT s0 FROM " + device, MaxRows: seedRows, TimeoutSecs: 0})
+	if err != nil {
+		t.Fatalf("timeoutSecs=0 must carry the budget through every fetch page: %v", err)
+	}
+	if len(result.Rows) != seedRows {
+		t.Fatalf("expected %d rows through all fetch pages, got %d", seedRows, len(result.Rows))
+	}
+	t.Logf("queryValues path: %d rows in %v", len(result.Rows), time.Since(started))
+
+	// 3. The agent's session pagination path (executeQueryPage/fetchQueryPage)
+	// must also survive the tightened threshold page after page.
+	page, err := server.executeQueryPage(queryOptions{SQL: "SELECT s0 FROM " + device, MaxRows: seedRows, TimeoutSec
```

**File**: `agents/drivers/iotdb/main_test.go` (modified, +101/-0)
```diff
@@ -376,3 +376,104 @@ func (s *blockingIoTDBSession) Close() error {
 	}
 	return nil
 }
+
+func TestTimeoutMillisecondsMapsNoLimitToABoundedHugeBudget(t *testing.T) {
+	// dbx's "no limit" setting is 0. Probing 1.3.7 shows IoTDB's per-query
+	// timeout has no wire-level "disable": 0 and negatives fall back to the
+	// server's query_timeout_threshold (60 s default), so the no-limit setting
+	// maps to a 100-year budget that can never fire within int64 deadline
+	// arithmetic (#13935).
+	noLimit := timeoutMilliseconds(0)
+	if noLimit == nil || *noLimit != hundredYearsMs {
+		t.Fatalf("timeoutMilliseconds(0) = %v, want pointer to %d", noLimit, hundredYearsMs)
+	}
+	positive := timeoutMilliseconds(90)
+	if positive == nil || *positive != 90000 {
+		t.Fatalf("timeoutMilliseconds(90) = %v, want pointer to 90000", positive)
+	}
+	if negative := timeoutMilliseconds(-1); negative != nil {
+		t.Fatalf("timeoutMilliseconds(-1) = %v, want nil", *negative)
+	}
+}
+
+const hundredYearsMs = 100 * 365 * 24 * int64(time.Hour) / int64(time.Millisecond)
+
+type timeoutRecordingSession struct {
+	received []*int64
+}
+
+func (s *timeoutRecordingSession) ExecuteQueryStatement(_ context.Context, _ string, timeoutMs *int64) (*client.SessionDataSet, error) {
+	s.received = append(s.received, timeoutMs)
+	return nil, errors.New("recorded")
+}
+
+func (s *timeoutRecordingSession) ExecuteNonQueryStatement(context.Context, string) error {
+	return errors.New("not implemented")
+}
+
+func (s *timeoutRecordingSession) Close() error { return nil }
+
+func TestQueryValuesSendsHugeBudgetForNoLimit(t *testing.T) {
+	recording := &timeoutRecordingSession{}
+	connected := &sessionClient{session: recording, dialect: client.TreeSqlDialect}
+	server := &server{client: connected}
+
+	_, _ = server.queryValues("SELECT value FROM root.dbx_13935.d", "", 10, 0)
+
+	if len(recording.received) != 1 {
+		t.Fatalf("ExecuteQueryStatement calls = %d, want 1", len(recording.received))
+	}
+	timeout := recording.received[0]
+	if timeout == nil || *timeout != hundredYearsMs {
+		t.Fatalf("query timeout = %v, want the 100-year no-limit budget", timeout)
+	}
+}
+
+type timeoutCaptureSession struct {
+	capturedTimeout []*int64
+	capturedContext []context.Context
+}
+
+func (s *timeoutCaptureSession) ExecuteQueryStatementWithContext(ctx context.Context, _ string, timeoutMs *int64) (*client.SessionDataSet, error) {
+	s.capturedTimeout = append(s.capturedTimeout, timeoutMs)
+	s.capturedContext = append(s.capturedContext, ctx)
+	return nil, errors.New("recorded")
+}
+
+func (s *timeoutCaptureSession) ExecuteStatementWithContext(context.Context, string) (*client.SessionDataSet, error) {
+	return nil, errors.New("not implemented")
+}
+
+func (s *timeoutCaptureSession) Close() error { return nil }
+
+// The production adapter must forward the per-query timeout to the session
+// layer instead of dropping it: whatever timeoutMilliseconds produced (a
+// positive budget, or the 100-year no-limit budget) has to reach the session
+// call untouched, together with the caller's context (#13935).
+func TestNativeSessionForwardsQueryTimeoutToClient(t *testing.T) {
+	recording := &timeoutCaptureSession{}
+	session := &nativeIoTDBSession{session: recording}
+
+	ctx, cancel := context.WithCancel(context.Background())
+	defer cancel()
+	zero := int64(0)
+	for _, timeout := range []*int64{nil, &zero} {
+		if _, err := session.ExecuteQueryStatement(ctx, "SELECT value FROM root.dbx.d", timeout); err == nil {
+			t.Fatal("expected the recorded error to surface")
+		}
+	}
+	if len(recording.capturedTimeout) != 2 {
+		t.Fatalf("ExecuteQueryStatementWithContext calls = %d, want 2", len(recording.capturedTimeout))
+	}
+	if recording.capturedTimeout[0] != nil {
+		t.Fatalf("first call timeout = %v, want nil passthrough", *recording.capturedTimeout[0])
+	}
+	if recording.capturedTimeout[1] == nil || *recording.capturedTimeout[1] != 0 {
+		t.Fatalf("second call timeout = %v, want pointer to 0 (no limit)", recording.capturedTimeout[1])
+	}
+	for _, captured := range recording.capturedContext {
+		if captured != ctx {
+			t.Fatal("the caller's context must reach the session layer for cancellation")
+		}
+	}
+}
```

**File**: `agents/drivers/iotdb/query.go` (modified, +16/-4)
```diff
@@ -273,7 +273,7 @@ func (s *server) nextDatasetRow(ctx context.Context, state *querySession) ([]any
 	if err := ctx.Err(); err != nil {
 		return nil, false, err
 	}
-	hasNext, err := state.dataset.Next()
+	hasNext, err := state.dataset.NextWithContext(ctx)
 	if err != nil || !hasNext {
 		return nil, false, err
 	}
@@ -388,7 +388,7 @@ func readDataset(ctx context.Context, dataset *client.SessionDataSet, connected
 		if err := ctx.Err(); err != nil {
 			return nil, false, err
 		}
-		hasNext, err := dataset.Next()
+		hasNext, err := dataset.NextWithContext(ctx)
 		if err != nil {
 			return nil, false, err
 		}
@@ -407,7 +407,7 @@ func readDataset(ctx context.Context, dataset *client.SessionDataSet, connected
 	if err := ctx.Err(); err != nil {
 		return nil, false, err
 	}
-	hasNext, err := dataset.Next()
+	hasNext, err := dataset.NextWithContext(ctx)
 	return rows, hasNext, err
 }
 
@@ -527,10 +527,22 @@ func isTreeTimeColumn(dialect string, columns []string, index int) bool {
 	return dialect == client.TreeSqlDialect && index == 0 && len(columns) > 0 && strings.EqualFold(columns[0], "Time")
 }
 
+// noLimitTimeoutMs is what dbx's "no limit" setting (timeoutSecs = 0) maps to.
+// IoTDB's per-query timeout has no true "disable" value on the wire: probing
+// 1.3.7 shows 0 and negatives both fall back to the server's
+// query_timeout_threshold (60 s default — the cause of #13935), so a no-limit
+// run sends a 100-year budget instead, which bounds deadline arithmetic far
+// below int64 overflow while never firing.
+const noLimitTimeoutMs = int64(100 * 365 * 24 * time.Hour / time.Millisecond)
+
 func timeoutMilliseconds(timeoutSecs int) *int64 {
-	if timeoutSecs <= 0 {
+	if timeoutSecs < 0 {
 		return nil
 	}
+	if timeoutSecs == 0 {
+		value := noLimitTimeoutMs
+		return &value
+	}
 	value := int64(timeoutSecs) * 1000
 	return &value
 }
```

**File**: `agents/drivers/iotdb/query_cancel_socket_test.go` (added, +147/-0)
```diff
@@ -0,0 +1,147 @@
+package main
+
+import (
+	"context"
+	"errors"
+	"fmt"
+	"net"
+	"sync"
+	"testing"
+	"time"
+
+	"github.com/apache/thrift/lib/go/thrift"
+
+	"github.com/apache/iotdb-client-go/v2/client"
+	"github.com/apache/iotdb-client-go/v2/common"
+	"github.com/apache/iotdb-client-go/v2/rpc"
+)
+
+// cancelSocketHandler is a minimal real-socket IoTDB endpoint whose query RPC
+// never answers, so the client parks in a Thrift socket read. It exists to
+// prove that the agent's cancel_session path (cancelActiveQuery) can interrupt
+// that read instead of waiting for the server.
+type cancelSocketHandler struct {
+	rpc.IClientRPCService
+
+	queryStarted     chan struct{}
+	queryStartedOnce sync.Once
+	release          chan struct{}
+	releaseOnce      sync.Once
+}
+
+func newCancelSocketHandler() *cancelSocketHandler {
+	return &cancelSocketHandler{queryStarted: make(chan struct{}), release: make(chan struct{})}
+}
+
+func (h *cancelSocketHandler) releaseAll() {
+	h.releaseOnce.Do(func() { close(h.release) })
+}
+
+func (h *cancelSocketHandler) OpenSession(context.Context, *rpc.TSOpenSessionReq) (*rpc.TSOpenSessionResp, error) {
+	resp := rpc.NewTSOpenSessionResp()
+	resp.Status = &common.TSStatus{Code: client.SuccessStatus}
+	sessionID := int64(5)
+	resp.SessionId = &sessionID
+	resp.Configuration = map[string]string{}
+	return resp, nil
+}
+
+func (h *cancelSocketHandler) RequestStatementId(context.Context, int64) (int64, error) {
+	return 9, nil
+}
+
+func (h *cancelSocketHandler) CloseSession(context.Context, *rpc.TSCloseSessionReq) (*common.TSStatus, error) {
+	return &common.TSStatus{Code: client.SuccessStatus}, nil
+}
+
+func (h *cancelSocketHandler) ExecuteQueryStatementV2(context.Context, *rpc.TSExecuteStatementReq) (*rpc.TSExecuteStatementResp, error) {
+	h.queryStartedOnce.Do(func() { close(h.queryStarted) })
+	<-h.release
+	return nil, fmt.Errorf("query was never answered")
+}
+
+func TestCancelActiveQueryInterruptsBlockedSocket(t *testing.T) {
+	handler := newCancelSocketHandler()
+	ln, err := net.Listen("tcp", "127.0.0.1:0")
+	if err != nil {
+		t.Fatalf("listen: %v", err)
+	}
+	processor := rpc.NewIClientRPCServiceProcessor(handler)
+	serveCtx, stopServing := context.WithCancel(context.Background())
+	var wg sync.WaitGroup
+	wg.Add(1)
+	go func() {
+		defer wg.Done()
+		for {
+			conn, err := ln.Accept()
+			if err != nil {
+				return
+			}
+			wg.Add(1)
+			go func(conn net.Conn) {
+				defer wg.Done()
+				defer conn.Close()
+				conf := &thrift.TConfiguration{}
+				trans := thrift.NewTFramedTransportConf(thrift.NewTSocketFromConnConf(conn, conf), conf)
+				iprot := thrift.NewTBinaryProtocolFactoryConf(conf).GetProtocol(trans)
+				oprot := thrift.NewTBinaryProtocolFactoryConf(conf).GetProtocol(trans)
+				for serveCtx.Err() == nil {
+					if _, err := processor.Process(serveCtx, iprot, oprot); err != nil {
+						return
+					}
+				}
+			}(conn)
+		}
+	}()
+	t.Cleanup(func() {
+		handler.releaseAll()
+		stopServing()
+		_ = ln.Close()
+		wg.Wait()
+	})
+
+	addr := ln.Addr().(*net.TCPAddr)
+	session := client.NewSession(&client.Config{
+		Host:            addr.IP.String(),
+		Port:            fmt.Sprintf("%d", addr.Port),
+		UserName:        "root",
+		Password:        "root",
+		FetchSize:       16,
+		TimeZone:        client.DefaultTimeZone,
+		ConnectRetryMax: 3,
+	})
+	if err := session.Open(false, 2000); err != nil {
+		t.Fatalf("open session: %v", err)
+	}
+	connected := &sessionClient{session: &nativeIoTDBSession{session: &session}, dialect: client.TreeSqlDialect}
+	server := &server{client: connected}
+
+	done := make(chan error, 1)
+	go func() {
+		_, err := runCancelable(server, 0, connected, func(ctx context.Context) (struct{}, error) {
+			_, err := connected.session.ExecuteQueryStatement(ctx, "select v from root.s", nil)
+			return struct{}{}, err
+		})
+		done <- err
+	}()
+
+	select {
+	case <-handler.queryStarted:
+	case <-time.After(5 * time.Second):
+		t.Fatal("query RPC was never issued")
+	}
+	started := time.Now()
+	server.cancelActiveQuery()
+
+	select {
+	case err := <-done:
+		if !errors.Is(err, context.Canceled) {
+			t.Fatalf("runCancelable() error = %v, want context.Canceled", err)
+		}
+		if elapsed := time.Since(started); elapsed > 5*time.Second {
+			t.Fatalf("cancel_session took %s to interrupt the blocked RPC", elapsed)
+		}
+	case <-time.After(5 * time.Second):
+		t.Fatal("cancel_session did not interrupt the blocked socket read")
+	}
+}
```

**File**: `agents/go-common/iotdb-client-go/client/rpcdataset.go` (modified, +31/-4)
```diff
@@ -51,9 +51,15 @@ type IoTDBRpcDataSet struct {
 	timeFormat    string
 	timeFactor    int32
 	timePrecision string
+
+	// interrupt closes the owning session's transport so a paged Fetch that is
+	// blocked in a Thrift socket read returns when its context is cancelled.
+	interrupt func()
 }
 
-func NewIoTDBRpcDataSet(sql string, columnNameList []string, columnTypeList []string, columnNameIndex map[string]int32, ignoreTimestamp bool, moreData bool, queryId int64, statementId int64, client *rpc.IClientRPCServiceClient, sessionId int64, queryResult [][]byte, fetchSize int32, timeout *int64, zoneId string, timeFormat string, timeFactor int32, columnIndex2TsBlockColumnIndexList []int32) (rpcDataSet *IoTDBRpcDataSet, err error) {
+// NewIoTDBRpcDataSet builds a result set. The optional interrupt func is
+// variadic to keep upstream call sites source-compatible.
+func NewIoTDBRpcDataSet(sql string, columnNameList []string, columnTypeList []string, columnNameIndex map[string]int32, ignoreTimestamp bool, moreData bool, queryId int64, statementId int64, client *rpc.IClientRPCServiceClient, sessionId int64, queryResult [][]byte, fetchSize int32, timeout *int64, zoneId string, timeFormat string, timeFactor int32, columnIndex2TsBlockColumnIndexList []int32, interrupt ...func()) (rpcDataSet *IoTDBRpcDataSet, err error) {
 	ds := &IoTDBRpcDataSet{
 		sessionId:                        sessionId,
 		statementId:                      statementId,
@@ -70,6 +76,9 @@ func NewIoTDBRpcDataSet(sql string, columnNameList []string, columnTypeList []st
 		columnOrdinalMap:                 make(map[string]int32),
 		columnName2TsBlockColumnIndexMap: make(map[string]int32),
 	}
+	if len(interrupt) > 0 {
+		ds.interrupt = interrupt[0]
+	}
 	columnStartIndex := int32(1)
 	resultSetColumnSize := int32(len(columnNameList))
 	// newly generated or updated columnIndex2TsBlockColumnIndexList.size() may not be equal to
@@ -186,6 +195,16 @@ func (s *IoTDBRpcDataSet) Close() (err error) {
 }
 
 func (s *IoTDBRpcDataSet) Next() (result bool, err error) {
+	return s.NextWithContext(context.Background())
+}
+
+// NextWithContext reads the next row, driving fetchResults with the caller's
+// context so a cancelled or timed-out query stops paging instead of waiting
+// for the blocking Thrift call to return (#13935 review round 3).
+func (s *IoTDBRpcDataSet) NextWithContext(ctx context.Context) (result bool, err error) {
+	if err = ctx.Err(); err != nil {
+		return false, err
+	}
 	if s.hasCachedBlock() {
 		s.lastReadWasNull = false
 		err = s.constructOneRow()
@@ -200,7 +219,7 @@ func (s *IoTDBRpcDataSet) Next() (result bool, err error) {
 	}
 
 	if s.moreData {
-		hasResultSet, err := s.fetchResults()
+		hasResultSet, err := s.fetchResults(ctx)
 		if err != nil {
 			return false, err
 		}
@@ -219,10 +238,15 @@ func (s *IoTDBRpcDataSet) Next() (result bool, err error) {
 	return false, nil
 }
 
-func (s *IoTDBRpcDataSet) fetchResults() (bool, error) {
+func (s *IoTDBRpcDataSet) fetchResults(ctx context.Context) (bool, error) {
 	if s.isClosed {
 		return false, fmt.Errorf("this data set is already closed")
 	}
+	// FetchResultsV2 is a blocking Thrift read that does not observe ctx; the
+	// session watcher closes the transport so cancellation/deadline returns
+	// instead of waiting for the page (#13935 review round 3).
+	stop := watchContextDone(ctx, s.interrupt)
+	defer stop()
 	req := rpc.TSFetchResultsReq{
 		SessionId: s.sessionId,
 		Statement: s.sql,
@@ -232,8 +256,11 @@ func (s *IoTDBRpcDataSet) fetchResults() (bool, error) {
 	}
 	req.Timeout = s.timeout
 
-	resp, err := s.client.FetchResultsV2(context.Background(), &req)
+	resp, err := s.client.FetchResultsV2(ctx, &req)
 
+	if ctxErr := ctx.Err(); ctxErr != nil {
+		return false, ctxErr
+	}
 	if err != nil {
 		return false, err
 	}
```

**File**: `agents/go-common/iotdb-client-go/client/session.go` (modified, +258/-44)
```diff
@@ -29,6 +29,7 @@ import (
 	"net"
 	"reflect"
 	"sort"
+	"sync"
 	"time"
 
 	"github.com/apache/thrift/lib/go/thrift"
@@ -74,11 +75,114 @@ type Session struct {
 	config             *Config
 	client             *rpc.IClientRPCServiceClient
 	sessionId          int64
-	trans              thrift.TTransport
 	requestStatementId int64
 	protocolFactory    thrift.TProtocolFactory
 	endPointList       []endPoint
 	timeFactor         int32
+
+	// Session is a value type across the client API, so the mutable transport
+	// state lives behind a pointer: embedding sync.Mutex directly would make
+	// every copy a copylocks vet failure. A blocked Thrift RPC cannot be
+	// stopped through its context (TSocket.Read waits on net.Conn.Read), so
+	// cancellation closes the socket instead; see Interrupt (#13935 review
+	// round 3).
+	transport *sessionTransportState
+}
+
+type sessionTransportState struct {
+	mu          sync.Mutex
+	trans       thrift.TTransport
+	interrupted bool
+}
+
+func (s *Session) transportState() *sessionTransportState {
+	if s.transport == nil {
+		s.transport = &sessionTransportState{}
+	}
+	return s.transport
+}
+
+// setTransport installs the transport used by the next RPC. If the session was
+// interrupted while the transport was being dialed, the fresh transport is
+// closed immediately so a cancellation that raced with reconnect cannot leave
+// a live socket behind.
+func (s *Session) setTransport(trans thrift.TTransport) error {
+	state := s.transportState()
+	state.mu.Lock()
+	state.trans = trans
+	interrupted := state.interrupted
+	state.mu.Unlock()
+	if interrupted {
+		_ = trans.Close()
+		return fmt.Errorf("IoTDB session was interrupted")
+	}
+	return nil
+}
+
+func (s *Session) currentTransport() thrift.TTransport {
+	if s.transport == nil {
+		return nil
+	}
+	state := s.transportState()
+	state.mu.Lock()
+	defer state.mu.Unlock()
+	return state.trans
+}
+
+func (s *Session) wasInterrupted() bool {
+	if s.transport == nil {
+		return false
+	}
+	state := s.transportState()
+	state.mu.Lock()
+	defer state.mu.Unlock()
+	return state.interrupted
+}
+
+// Interrupt closes the transport that a blocked RPC is reading from, so the
+// call returns instead of waiting for a server response that the caller no
+// longer wants. It permanently disables the session: callers must discard it
+// afterwards (the agent drops the whole client on cancellation).
+func (s *Session) Interrupt() {
+	state := s.transportState()
+	state.mu.Lock()
+	state.interrupted = true
+	trans := state.trans
+	state.mu.Unlock()
+	if trans != nil {
+		_ = trans.Close()
+	}
+}
+
+// watchContext calls Interrupt when ctx is cancelled or its deadline passes
+// before stop is called. Thrift's blocking socket read ignores ctx, so closing
+// the transport is the only way to abort an in-flight RPC. The returned stop
+// function must be called once the RPC finishes; it waits for the watcher so a
+// normal completion cannot race with a late interrupt.
+func (s *Session) watchContext(ctx context.Context) (stop func()) {
+	return watchContextDone(ctx, s.Interrupt)
+}
+
+// watchContextDone is the transport-independent half of Session.watchContext;
+// SessionDataSet reuses it for paged Fetch RPCs.
+func watchContextDone(ctx context.Context, interrupt func()) (stop func()) {
+	if ctx.Done() == nil || interrupt == nil {
+		return func() {}
+	}
+	done := make(chan struct{})
+	finished := make(chan struct{})
+	go func() {
+		defer close(finished)
+		select {
+		case <-ctx.Done():
+			interrupt()
+		case <-done:
+		}
+	}()
+	return func() {
+		close(done)
+		<-finished
+	}
 }
 
 type endPoint struct {
@@ -100,19 +204,22 @@ func (s *Session) Open(enableRPCCompression bool, connectionTimeoutInMs int) err
 
 	var err error
 
-	s.trans, err = newTransport(s.config.Host, s.config.Port, connectionTimeoutInMs, s.config.TLSConfig)
+	trans, err := newTransport(s.config.Host, s.config.Port, connectionTimeoutInMs, s.config.TLSConfig)
 	if err != nil {
 		return err
 	}
-	if !s.trans.IsOpen() {
-		err = s.trans.Open()
+	if err = s.setTransport(trans); err != nil {
+		return err
+	}
+	if !trans.IsOpen() {
+		err = trans.Open()
 		if err != nil {
 			return err
 		}
 	}
 	s.protocolFactory = getProtocolFactory(enableRPCCompression)
-	iprot := s.protocolFactory.GetProtocol(s.trans)
-	oprot := s.protocolFactory.GetProtocol(s.trans)
+	iprot := s.protocolFactory.GetProtocol(trans)
+	oprot := s.protocolFactory.GetProtocol(trans)
 	s.client = rpc.NewIClientRPCServiceClient(thrift.NewTStandardClient(iprot, oprot))
 	req := rpc.TSOpenSessionReq{
 		ClientProtocol: rpc.TSProtocolVersion_IOTDB_SERVICE_PROTOCOL_V3, ZoneId: s.config.TimeZone, Username: s.config.UserName,
@@ -168,9 +275,13 @@ func (s *Session) OpenCluster(enableRPCCompression bool) error {
 
 	var err error
 
+	trans := s.currentTransport()
+	if trans == nil {
+		return fmt.Errorf("IoTDB cluster session has no transport")
+	}
 	s.protocolFactory = getProtocolFactory(enableRPCCompression)

```

**File**: `agents/go-common/iotdb-client-go/client/session_interrupt_test.go` (added, +310/-0)
```diff
@@ -0,0 +1,310 @@
+package client
+
+import (
+	"context"
+	"errors"
+	"fmt"
+	"net"
+	"sync"
+	"testing"
+	"time"
+
+	"github.com/apache/thrift/lib/go/thrift"
+
+	"github.com/apache/iotdb-client-go/v2/common"
+	"github.com/apache/iotdb-client-go/v2/rpc"
+)
+
+// blockingIoTServer is a minimal real-socket IoTDB endpoint. Handlers can block
+// selected RPCs forever, which reproduces the situation the context cannot fix:
+// the client is parked inside net.Conn.Read when the query is cancelled.
+type blockingIoTServer struct {
+	ln        net.Listener
+	handler   *blockingIoTDBHandler
+	processor thrift.TProcessor
+	cancel    context.CancelFunc
+	wg        sync.WaitGroup
+}
+
+type blockingIoTDBHandler struct {
+	rpc.IClientRPCService // embedded nil: unimplemented RPCs panic if called
+
+	mu             sync.Mutex
+	openSessions   int
+	executeCalls   int
+	fetchCalls     int
+	blockOpenAfter int
+	failFirstQuery bool
+	blockExecute   bool
+	blockFetch     bool
+
+	release          chan struct{}
+	releaseOnce      sync.Once
+	openBlocked      chan struct{}
+	openBlockedOnce  sync.Once
+	queryStarted     chan struct{}
+	queryStartedOnce sync.Once
+	fetchStarted     chan struct{}
+	fetchStartedOnce sync.Once
+}
+
+func newBlockingIoTDBHandler() *blockingIoTDBHandler {
+	return &blockingIoTDBHandler{
+		release:      make(chan struct{}),
+		openBlocked:  make(chan struct{}),
+		queryStarted: make(chan struct{}),
+		fetchStarted: make(chan struct{}),
+	}
+}
+
+func (h *blockingIoTDBHandler) releaseAll() {
+	h.releaseOnce.Do(func() { close(h.release) })
+}
+
+func (h *blockingIoTDBHandler) counts() (opens, executes, fetches int) {
+	h.mu.Lock()
+	defer h.mu.Unlock()
+	return h.openSessions, h.executeCalls, h.fetchCalls
+}
+
+func (h *blockingIoTDBHandler) OpenSession(context.Context, *rpc.TSOpenSessionReq) (*rpc.TSOpenSessionResp, error) {
+	h.mu.Lock()
+	h.openSessions++
+	block := h.blockOpenAfter > 0 && h.openSessions > h.blockOpenAfter
+	h.mu.Unlock()
+	if block {
+		h.openBlockedOnce.Do(func() { close(h.openBlocked) })
+		<-h.release
+	}
+	resp := rpc.NewTSOpenSessionResp()
+	resp.Status = &common.TSStatus{Code: SuccessStatus}
+	sessionID := int64(7)
+	resp.SessionId = &sessionID
+	resp.Configuration = map[string]string{}
+	return resp, nil
+}
+
+func (h *blockingIoTDBHandler) RequestStatementId(context.Context, int64) (int64, error) {
+	return 11, nil
+}
+
+func (h *blockingIoTDBHandler) CloseSession(context.Context, *rpc.TSCloseSessionReq) (*common.TSStatus, error) {
+	return &common.TSStatus{Code: SuccessStatus}, nil
+}
+
+func (h *blockingIoTDBHandler) ExecuteQueryStatementV2(context.Context, *rpc.TSExecuteStatementReq) (*rpc.TSExecuteStatementResp, error) {
+	h.mu.Lock()
+	h.executeCalls++
+	call := h.executeCalls
+	block := h.blockExecute
+	h.mu.Unlock()
+	if h.failFirstQuery && call == 1 {
+		// Returning an error makes the test server drop the connection, which
+		// is what the client sees when a server disappears mid-query.
+		return nil, fmt.Errorf("simulated connection loss")
+	}
+	if block {
+		h.queryStartedOnce.Do(func() { close(h.queryStarted) })
+		<-h.release
+	}
+	ignoreTimestamp := false
+	moreData := true
+	queryID := int64(3)
+	resp := rpc.NewTSExecuteStatementResp()
+	resp.Status = &common.TSStatus{Code: SuccessStatus}
+	resp.QueryId = &queryID
+	resp.MoreData = &moreData
+	resp.IgnoreTimeStamp = &ignoreTimestamp
+	resp.Columns = []string{"v"}
+	resp.DataTypeList = []string{"INT64"}
+	return resp, nil
+}
+
+func (h *blockingIoTDBHandler) FetchResultsV2(context.Context, *rpc.TSFetchResultsReq) (*rpc.TSFetchResultsResp, error) {
+	h.mu.Lock()
+	h.fetchCalls++
+	block := h.blockFetch
+	h.mu.Unlock()
+	if block {
+		h.fetchStartedOnce.Do(func() { close(h.fetchStarted) })
+		<-h.release
+	}
+	status := &common.TSStatus{Code: SuccessStatus}
+	return &rpc.TSFetchResultsResp{Status: status, HasResultSet: false, IsAlign: true}, nil
+}
+
+func startBlockingIoTServer(t *testing.T, handler *blockingIoTDBHandler) (host string, port string) {
+	t.Helper()
+	ln, err := net.Listen("tcp", "127.0.0.1:0")
+	if err != nil {
+		t.Fatalf("listen: %v", err)
+	}
+	ctx, cancel := context.WithCancel(context.Background())
+	server := &blockingIoTServer{ln: ln, handler: handler, processor: rpc.NewIClientRPCServiceProcessor(handler), cancel: cancel}
+	go server.serve(ctx)
+	t.Cleanup(func() {
+		handler.releaseAll()
+		server.stop()
+	})
+	addr := ln.Addr().(*net.TCPAddr)
+	return addr.IP.String(), fmt.Sprintf("%d", addr.Port)
+}
+
+func (s *blockingIoTServer) serve(ctx context.Context) {
+	for {
+		conn, err := s.ln.Accept()
+		if err != nil {
+			return
+		}
+		s.wg.Add(1)
+		go func(conn net.Conn) {
+			defer s.wg.Done()
+			defer conn.Close()
+			conf := &thrift.TConfiguration{}
+			trans := thrift.NewTFramedTransportConf(thrift.NewTSocketFromConnConf(conn, conf), conf)
+			iprot := thrift.NewTBinaryProtocolFactoryConf(conf).GetProtocol(trans)
+			oprot := thrift.NewTBinaryProtocolFactoryConf(conf).GetProtoco
```

---

### Incident Patch 2: `48f3ed1d` (2026-11-11)
**Commit Message**: fix(plugin-stats): store the archive as one KV document

The archive kept one KV key per counter and rewrote each touched key on every
aggregation pass. The free plan caps writes to different keys at 1,000/day, so
a catch-up window spent the day's allowance, later retries failed mid-pass, and
the backlog kept growing. A pass now reads, mutates and writes a single
document, so the number of distinct keys is constant regardless of how many
plugins exist.

migrate-archive.mjs converts the legacy keys, verifies every value against the
document, and leaves the old keys in place as a read-only backup.

**File**: `deploy/plugin-stats-worker/README.md` (modified, +41/-27)
```diff
@@ -61,35 +61,49 @@ AE retains only three months, so cron triggers aggregate the trailing window
 into the `plugin_stats_archive` KV namespace — the permanent layer future UI
 reads:
 
-- `total:{kind}:{pluginId}:{version}` — all-time cumulative events
+- `archive:v2` — **one** JSON document holding every counter:
+  `{v:2, lastSuccess, total:{"kind:pluginId:version": n}, uniqd:{"kind:pluginId:day": n}}`
+  (plus `kind:pluginId` rollups inside `total`). A pass reads it once, folds in
+  the window, writes it back — the number of distinct keys touched per pass is
+  constant (archive + summary + lock) no matter how many plugins exist.
 - `summary` — one JSON blob `{dl: {pluginId: n}, inst: {...}, updt: {...}}` for
   single-read display; `inst` carries the pre-2026-09-19 mixed install+update
-  base (the switch to classified kinds), so treat it as the display number
-- `uniqd:{kind}:{pluginId}:{day}` — per-day distinct identities (machines for
-  classified inst/updt events; no longer written for dl)
-- `meta:last-success` — window marker; only advanced after all writes land, so a
-  failed run retries the same window on the next cron
-- `agg:state` / `agg:tuning` / `agg:lock` — resumable-pass cursor, adaptive
-  chunk size, and best-effort mutex (see below)
-
-**Chunked resumable passes** (added 2026-10-20). The original single-shot loop
-needed one KV get+put pair per aggregated key; once a failed window grew the
-retry backlog past the Workers per-invocation subrequest ceiling (1000 paid /
-50 free), every run died mid-loop and the watermark never advanced — the
-aggregation stalled silently for three weeks (2026-09-28 → 2026-10-20) while
-raw AE data kept flowing. Now every invocation processes at most `chunk` keys
-(tuning halves on failure, creeps up on success, 8–400), persists its cursor in
-`agg:state`, and completes the summary write + watermark advance only when the
-pass finishes. Crons: `30 0 * * *` opens the day's window, `0 * * * *`
-resumes any in-flight pass (a normal window finishes in a few ticks ≈ hours;
-the hourly cadence keeps daily KV writes under the free-plan 1000/day alert
-line — freshness is a decorative concern here, raise the frequency only if
-display latency starts to matter). AE row order is normalized with a JS sort because
-the offset cursor must index identically across invocations. Required
-subrequests per invocation: `chunk`-bounded (~2·chunk + 6) — never the whole
-backlog. After deploying schema-affecting changes, or to backfill from scratch,
-pass `x-archive-from: reset` (totals are additive — only safe when the
-archive is known-empty).
+  base (the switch to classified kinds), so treat it as the display number.
+- `agg:lock` — best-effort mutex; overlapping crons would otherwise
+  read-modify-write the same document and lose one side of the update.
+
+**Why one document** (2026-11-10). The previous layout used one key per counter
+(`total:{kind}:{pluginId}:{version}`, `uniqd:{kind}:{pluginId}:{day}`) and
+rewrote each touched key per pass. The Workers free plan caps writes to
+*different keys* at 1,000/day, so a catch-up window that touched a few hundred
+counters consumed the day's allowance; every later retry then failed mid-pass,
+the resumable cursor could not advance, the window kept growing, and the next
+day blew the cap earlier still. On 2026-11-10 the 12:00 UTC pass hit the cap
+after ~800 distinct keys and the archive stalled with a growing backlog. Under
+the single-document model a pass needs `get` + `put` on one value, so history
+cannot starve the quota.
+
+The remaining ceiling is the value, not the key count: the document is ~450 KiB
+today (4,279 counters + 7,213 unique-days) and a full read-modify-write costs
+roughly 4–5 ms of the free plan's 10 ms CPU budget. Past ~1–2 MB (a few thousand
+plugins) split `archive:v2` by kind into separate documents, and past that move
+the per-version detail to D1. Pruning `uniqd:` entries older than ~90 days
+reclaims most of the growth in the meantime.
+
+**Migrating the legacy keys.** `migrate-archive.mjs` reads every legacy key
+(bulk get), builds the document, verifies every value, and — with `--apply` —
+uploads it and re-reads it to diff. It never deletes the legacy keys, so the old
+layout stays as a read-only backup:
+
+```sh
+node migrate-archive.mjs              # dry run: verify + dump the document
+node migrate-archive.mjs --apply      # write archive:v2 and verify read-back
+```
+
+Run the migration *before* deploying a Worker whose aggregation expects
+`archive:v2`; the new code refuses to aggregate when the document is missing
+(`{"skipped":"unmigrated"}`) instead of silently starting from zero. Legacy keys
+can be deleted later at 1,000 deletes/day (free plan) or left in place.
 
 Required secret (SQL API access; OAuth login does not carry analytics scope):
 
```

**File**: `deploy/plugin-stats-worker/migrate-archive.mjs` (added, +300/-0)
```diff
@@ -0,0 +1,300 @@
+#!/usr/bin/env node
+// One-shot migration: legacy per-counter KV keys -> the single archive document.
+//
+// Legacy layout (one KV key per counter, what filled the free-plan
+// "1,000 different keys per day" quota):
+//   total:{kind}:{plugin}:{version}  -> cumulative events
+//   uniqd:{kind}:{plugin}:{day}      -> per-day distinct identities
+//   meta:last-success                -> window watermark
+//   summary                          -> public {kind: {plugin: count}} blob
+//
+// New layout (read/modified/written by worker.ts as one value):
+//   archive:v2 = {v:2, lastSuccess, total:{"kind:plugin:version": n},
+//                 uniqd:{"kind:plugin:day": n}}
+//
+// The legacy keys are never deleted here, so a bad run cannot lose history:
+// the only write is the new document, and --apply re-reads it and compares.
+//
+// Usage:
+//   node migrate-archive.mjs            # dry run: read everything, verify, print
+//   node migrate-archive.mjs --apply    # write archive:v2, verify read-back
+//   node migrate-archive.mjs --apply --force   # overwrite an existing archive:v2
+// Flags: --out=<file> --account=<id> --namespace=<id>
+// Auth: CLOUDFLARE_API_TOKEN, or the wrangler OAuth refresh token (the script
+// refreshes it and writes the new tokens back to the wrangler config file).
+
+import fs from "node:fs";
+import os from "node:os";
+import path from "node:path";
+import crypto from "node:crypto";
+import { pathToFileURL } from "node:url";
+
+const API = "https://api.cloudflare.com/client/v4";
+const ARCHIVE_KEY = "archive:v2";
+const ARCHIVE_VERSION = 2;
+const SUMMARY_KEY = "summary";
+const META_KEY = "meta:last-success";
+const LEGACY_PREFIXES = ["total:", "uniqd:"];
+const BULK_GET_BATCH = 100;
+const WRANGLER_CLIENT_ID = "54d11594-84e4-41aa-b438-e81b8fa78ee7";
+
+function parseArgs(argv) {
+  const args = { apply: false, force: false, out: null, account: "7ad3349ede62c17968a90108d39fd4d0", namespace: "0cc9e49a117f4edeb931464fa0256834" };
+  for (const arg of argv) {
+    if (arg === "--apply") args.apply = true;
+    else if (arg === "--force") args.force = true;
+    else if (arg.startsWith("--out=")) args.out = arg.slice(6);
+    else if (arg.startsWith("--account=")) args.account = arg.slice(10);
+    else if (arg.startsWith("--namespace=")) args.namespace = arg.slice(12);
+    else if (arg === "--help" || arg === "-h") {
+      console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1, 22).join("\n"));
+      process.exit(0);
+    } else throw new Error(`unknown argument: ${arg}`);
+  }
+  return args;
+}
+
+/** Legacy key -> document key. `total:`/`uniqd:` are both 6 chars. */
+export function documentKey(legacyKey) {
+  if (legacyKey.startsWith("total:")) return { section: "total", key: legacyKey.slice("total:".length) };
+  if (legacyKey.startsWith("uniqd:")) return { section: "uniqd", key: legacyKey.slice("uniqd:".length) };
+  return null;
+}
+
+/**
+ * Pure builder: legacy {key: value} entries -> archive document.
+ * Throws on a malformed legacy key or value instead of skipping it silently.
+ */
+export function buildArchive(entries) {
+  const doc = { v: ARCHIVE_VERSION, lastSuccess: "", total: {}, uniqd: {} };
+  const problems = [];
+  for (const [legacyKey, rawValue] of entries) {
+    if (legacyKey === META_KEY) {
+      doc.lastSuccess = String(rawValue).trim();
+      continue;
+    }
+    const mapped = documentKey(legacyKey);
+    if (!mapped) continue; // agg:*, summary, archive:v2 — handled separately
+    const value = Number.parseInt(String(rawValue), 10);
+    if (!/^\d+$/.test(String(rawValue).trim()) || !Number.isSafeInteger(value)) {
+      problems.push(`${legacyKey}: non-integer value ${JSON.stringify(rawValue)}`);
+      continue;
+    }
+    // `total:` holds both shapes written by the old aggregator: the
+    // per-version counters (`kind:plugin:version`) and the plugin rollups
+    // (`kind:plugin`). `uniqd:` is always `kind:plugin:day`.
+    const parts = mapped.key.split(":");
+    const validLengths = mapped.section === "total" ? [2, 3] : [3];
+    if (!validLengths.includes(parts.length)) {
+      problems.push(`${legacyKey}: unexpected shape ${JSON.stringify(mapped.key)}`);
+      continue;
+    }
+    if (mapped.section === "total") doc.total[mapped.key] = value;
+    else doc.uniqd[mapped.key] = value;
+  }
+  if (problems.length) throw new Error(`malformed legacy entries:\n  ${problems.slice(0, 20).join("\n  ")}`);
+  return doc;
+}
+
+/** Every legacy entry must survive into the document with the same value. */
+export function verifyArchive(doc, entries) {
+  const problems = [];
+  const expected = { total: new Map(), uniqd: new Map() };
+  for (const [legacyKey, rawValue] of entries) {
+    const mapped = documentKey(legacyKey);
+    if (!mapped) {
+      if (legacyKey === META_KEY && String(rawValue).trim() !== doc.lastSuccess) {
+        problems.push(`lastSuccess mismatch: legacy ${JSON.stringi
```

**File**: `deploy/plugin-stats-worker/migrate-archive.test.mjs` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+// Unit tests for the legacy -> single-document archive migration.
+// Run: node --test deploy/plugin-stats-worker/migrate-archive.test.mjs
+import assert from "node:assert/strict";
+import test from "node:test";
+
+import { buildArchive, documentKey, verifyArchive } from "./migrate-archive.mjs";
+
+const SAMPLE = new Map([
+  ["total:inst:foo:1.0.0", "12"],
+  ["total:inst:foo:1.1.0", "37"],
+  ["total:updt:foo:1.1.0", "4"],
+  ["total:dl:bar:0.2.0", "1034"],
+  ["total:dl:bar", "1050"],
+  ["uniqd:inst:foo:2026-11-09", "5"],
+  ["uniqd:updt:foo:2026-11-09", "2"],
+  ["meta:last-success", "2026-11-10 04:00:42"],
+  ["summary", '{"inst":{"foo":49}}'],
+  ["agg:tuning", "400"],
+]);
+
+test("documentKey strips the legacy prefix and ignores unrelated keys", () => {
+  assert.deepEqual(documentKey("total:inst:foo:1.0.0"), { section: "total", key: "inst:foo:1.0.0" });
+  assert.deepEqual(documentKey("uniqd:updt:foo:2026-11-09"), { section: "uniqd", key: "updt:foo:2026-11-09" });
+  assert.equal(documentKey("summary"), null);
+  assert.equal(documentKey("agg:lock"), null);
+  assert.equal(documentKey("archive:v2"), null);
+});
+
+test("buildArchive copies every counter and the watermark", () => {
+  const doc = buildArchive(SAMPLE);
+  assert.equal(doc.v, 2);
+  assert.equal(doc.lastSuccess, "2026-11-10 04:00:42");
+  assert.deepEqual(doc.total, {
+    "inst:foo:1.0.0": 12,
+    "inst:foo:1.1.0": 37,
+    "updt:foo:1.1.0": 4,
+    "dl:bar:0.2.0": 1034,
+    "dl:bar": 1050,
+  });
+  assert.deepEqual(doc.uniqd, { "inst:foo:2026-11-09": 5, "updt:foo:2026-11-09": 2 });
+});
+
+test("buildArchive keeps a missing watermark empty instead of inventing one", () => {
+  const doc = buildArchive(new Map([["total:inst:foo:1.0.0", "1"]]));
+  assert.equal(doc.lastSuccess, "");
+});
+
+test("buildArchive rejects a non-integer counter instead of dropping it", () => {
+  assert.throws(() => buildArchive(new Map([["total:inst:foo:1.0.0", "12x"]])), /non-integer value/);
+  assert.throws(() => buildArchive(new Map([["total:inst:foo:1.0.0", "-3"]])), /non-integer value/);
+});
+
+test("buildArchive accepts plugin rollups and rejects a key without a plugin", () => {
+  assert.deepEqual(buildArchive(new Map([["total:inst:foo", "49"]])).total, { "inst:foo": 49 });
+  assert.throws(() => buildArchive(new Map([["total:inst", "1"]])), /unexpected shape/);
+});
+
+test("verifyArchive accepts a faithful document", () => {
+  assert.deepEqual(verifyArchive(buildArchive(SAMPLE), SAMPLE), []);
+});
+
+test("verifyArchive reports a missing counter", () => {
+  const doc = buildArchive(SAMPLE);
+  delete doc.total["inst:foo:1.1.0"];
+  const problems = verifyArchive(doc, SAMPLE);
+  assert.ok(problems.some((problem) => problem.includes("total: doc has")), problems.join("; "));
+});
+
+test("verifyArchive reports a wrong counter value", () => {
+  const doc = buildArchive(SAMPLE);
+  doc.uniqd["inst:foo:2026-11-09"] = 6;
+  const problems = verifyArchive(doc, SAMPLE);
+  assert.ok(problems.some((problem) => problem.includes("uniqd[inst:foo:2026-11-09]")), problems.join("; "));
+});
+
+test("verifyArchive reports a diverged watermark", () => {
+  const doc = buildArchive(SAMPLE);
+  doc.lastSuccess = "2026-11-10 05:00:00";
+  const problems = verifyArchive(doc, SAMPLE);
+  assert.ok(problems.some((problem) => problem.includes("lastSuccess mismatch")), problems.join("; "));
+});
```

**File**: `deploy/plugin-stats-worker/worker.ts` (modified, +138/-117)
```diff
@@ -35,9 +35,11 @@
 //
 // Storage:
 // - Workers Analytics Engine (binding PLUGIN_STATS) — one datapoint per event.
-//   AE only retains three months, so a daily cron aggregates the trailing
-//   window into the `plugin_stats_archive` KV namespace, which holds the
-//   permanent totals. KV is fine here: ~1 write per active key per day.
+//   AE only retains three months, so cron aggregates the trailing window into
+//   the `plugin_stats_archive` KV namespace, which holds the permanent totals
+//   as ONE document (see ARCHIVE_KEY). A pass therefore writes a constant
+//   number of distinct keys, which keeps it inside the free plan's
+//   1,000-different-keys/day cap no matter how many plugins exist.
 
 type AnalyticsEngineBinding = {
   writeDataPoint(event: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void;
@@ -290,133 +292,152 @@ async function fetchWindowCounts(env: Env, from: Date, to: Date): Promise<Window
     .sort((a, b) => `${a.kind}:${a.plugin}:${a.version}`.localeCompare(`${b.kind}:${b.plugin}:${b.version}`));
 }
 
-// Aggregates events in (last-success, now] into permanent KV totals, chunked
-// and resumable. The pre-2026-10 unchunked loop died mid-run once the window
-// grew past the Workers per-invocation subrequest ceiling (1000 paid / 50
-// free; every versioned total costs a get+put pair). A single failed run then
-// left the watermark behind, the next window grew larger, and the aggregation
-// stalled permanently (2026-09-28 → 2026-10-20). Now every trigger processes
-// at most `chunk` keys, persists a cursor in `agg:state`, and the next cron
-// (daily start + */10 continue) resumes until the pass completes; only then
-// are the summary written and the watermark advanced. `agg:tuning` carries
-// the chunk size across passes — it halves on failure and creeps up on
-// progress, so the worker adapts to whatever subrequest/KV limits the
-// account has. A crash mid-chunk can double-count that chunk's additive
-// totals; acceptable for decorative stats (same stance as v1).
-type AggPhase = "counts" | "pluginTotals" | "uniques";
-type AggState = { windowFrom: string; windowTo: string; phase: AggPhase; offset: number; chunk: number };
-
-const AGG_STATE_KEY = "agg:state";
+// ---------------------------------------------------------------------------
+// Permanent archive: ONE KV value holds every cumulative counter.
+//
+// The previous model stored one key per counter (`total:kind:plugin:version`,
+// `uniqd:kind:plugin:day`). Every aggregation pass then wrote one *different*
+// key per counter it touched. On the free plan the cap is "writes to different
+// keys: 1,000/day", so a catch-up window touching a few hundred counters ate
+// the day's allowance; after that every retry failed mid-pass, the resumable
+// cursor could not advance, the window kept growing, and the next day blew the
+// cap earlier still. Now a pass reads one value, mutates it in memory and
+// writes it back, so the number of distinct keys it touches (archive, summary,
+// lock) is constant and independent of the plugin count. The remaining ceiling
+// is value size / JSON CPU cost, not the key count (see README).
+export const ARCHIVE_KEY = "archive:v2";
+const ARCHIVE_VERSION = 2;
+const ARCHIVE_EPOCH = "1970-01-01 00:00:00";
+
+export type ArchiveDoc = {
+  v: number;
+  /** SQL timestamp of the last completed window; "" until the first pass. */
+  lastSuccess: string;
+  /** "kind:plugin:version" -> cumulative events. */
+  total: Record<string, number>;
+  /** "kind:plugin:day" -> distinct identities seen that day. */
+  uniqd: Record<string, number>;
+};
+
+/** `{kind: {plugin: count}}`, exactly what the website reads. */
+export type Summary = Record<string, Record<string, number>>;
+
 const AGG_LOCK_KEY = "agg:lock";
-const AGG_TUNING_KEY = "agg:tuning";
-const AGG_MIN_CHUNK = 8; // keeps get+put pairs + AE fetches under the free plan's 50 subrequests
-const AGG_MAX_CHUNK = 400; // 400×2 + fetches + state writes stays under the paid plan's 1000
 const AGG_LOCK_TTL_SECONDS = 300;
 
-async function readChunkSize(env: Env): Promise<number> {
-  const chunk = Number.parseInt((await env.PLUGIN_ARCHIVE.get(AGG_TUNING_KEY)) ?? "", 10);
-  return Number.isFinite(chunk) && chunk >= AGG_MIN_CHUNK && chunk <= AGG_MAX_CHUNK ? chunk : AGG_MAX_CHUNK;
+export function emptyArchive(): ArchiveDoc {
+  return { v: ARCHIVE_VERSION, lastSuccess: "", total: {}, uniqd: {} };
+}
+
+/** Parse a stored archive; an unknown schema throws instead of resetting data. */
+export function parseArchive(raw: string): ArchiveDoc {
+  const parsed = JSON.parse(raw) as Partial<ArchiveDoc> | null;
+  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("archive: stored value is not an object");
+  if (parsed.v !== ARCHIVE_VERSION) throw new Error(`archive: unsupported version ${String(parsed.v)}`);
+  const total = parsed.total ?? {};
+  const uniqd = parsed.uniqd ?? {};
+  if (typeo
```

---

### Incident Patch 3: `e91a85c4` (2026-11-11)
**Commit Message**: fix(sqlserver): keep stored-procedure header comments in module batches

**File**: `apps/desktop/src/lib/__tests__/sql/executableStatementRangeCache.spec.ts` (modified, +11/-0)
```diff
@@ -71,6 +71,17 @@ describe("executableStatementRangeCacheForDoc", () => {
     expect(executableStatementRangeStartingAt(cache, doc.line(1).from)?.sql).toBe(sql.slice(0, -1));
   });
 
+  it.each(["-- 存储过程说明\n-- 作者 : 张三", "/* 说明 /* 内部说明 */\nGO\n保留完整注释 */"])("includes SQL Server procedure header comments when running from the CREATE line: %s", (header) => {
+    const procedure = `${header}\nCREATE PROCEDURE dbo.p AS\nBEGIN\n    SELECT 1;\n    SELECT 2;\nEND;`;
+    const sql = `${procedure}\nGO\nSELECT 3;`;
+    const doc = Text.of(sql.split("\n"));
+    const cache = executableStatementRangeCacheForDoc(null, doc, "sqlserver");
+
+    expect(executableStatementRangeStartingAt(cache, doc.lineAt(sql.indexOf("CREATE PROCEDURE")).from)?.sql).toBe(procedure);
+    expect(executableStatementRangeStartingAt(cache, doc.lineAt(sql.indexOf("SELECT 1")).from)).toBeNull();
+    expect(executableStatementRangeAtCursor(cache, sql.indexOf("SELECT 2"))?.sql).toBe(procedure);
+  });
+
   it("keeps a valid placeholder-only line executable and respects disabled MyBatis syntax", () => {
     const sql = ["SELECT *", "FROM t", "#{where_clause};"].join("\n");
     const doc = Text.of(sql.split("\n"));
```

**File**: `apps/desktop/src/lib/__tests__/sql/sqlStatementRanges.spec.ts` (modified, +44/-0)
```diff
@@ -659,6 +659,50 @@ describe("splitSqlStatementRanges", () => {
     expect(rangeSqlTexts(splitSqlStatementRanges(sql, "sqlserver"))).toEqual(["SELECT 'GO'\n-- GO\nSELECT 2", "SELECT 3"]);
   });
 
+  it("preserves the SQL Server procedure documentation header in execution ranges", () => {
+    const procedure = `-- =============================================================
+-- 存储过程名 : usp_GetUserById
+-- 功能描述   : 根据用户ID查询单个用户信息
+-- 参数说明   : @UserId  INT  用户唯一标识
+-- 返回值     : 结果集(UserId, UserName, Email, CreatedAt)
+-- 作者       : 张三
+-- 创建日期   : 2026-11-10
+-- 修改记录   : 2026-11-10  张三  初始创建
+-- 备注       : 无
+-- =============================================================
+CREATE PROCEDURE usp_GetUserById
+    @UserId INT
+AS
+BEGIN
+    SET NOCOUNT ON;
+
+    -- 查询用户信息
+    SELECT UserId, UserName, Email, CreatedAt
+    FROM dbo.Users
+    WHERE UserId = @UserId;
+END`;
+    const sql = `SELECT 0;\nGO\n\n${procedure}\nGO\nSELECT 2;`;
+    expect(rangeSqlTexts(splitSqlStatementRanges(sql, "sqlserver"))).toEqual(["SELECT 0", procedure, "SELECT 2"]);
+    expect(rangeSqlTexts(executableStatementRanges(sql, "sqlserver"))).toEqual(["SELECT 0", procedure, "SELECT 2"]);
+    for (const marker of ["CREATE PROCEDURE", "SET NOCOUNT", "WHERE UserId"]) {
+      const cursor = sql.indexOf(marker);
+      expect(currentExecutableStatementRange(sql, cursor, "sqlserver")?.sql).toBe(procedure);
+      expect(buildExecutionCandidates(sql, cursor, "sqlserver")[0]?.sql).toBe(procedure);
+    }
+  });
+
+  it.each(["CREATE PROCEDURE", "ALTER PROC", "CREATE OR ALTER PROCEDURE"])("keeps header comments and internal semicolons in a SQL Server %s batch", (operation) => {
+    for (const header of ["-- 作者 : 张三", "/* 根据用户ID查询\nGO\n保留完整注释 */", "/* 说明 /* 内部说明 */\nGO\n保留完整注释 */"]) {
+      const procedure = `${header}\n${operation} dbo.p AS\nBEGIN\n    SELECT 1;\n    SELECT 2;\nEND;`;
+      expect(rangeSqlTexts(executableStatementRanges(`${procedure}\nGO\nSELECT 3;`, "sqlserver"))).toEqual([procedure, "SELECT 3"]);
+    }
+  });
+
+  it("keeps SQL Server nested comment-only batches non-executable", () => {
+    const sql = "/* 说明 /* CREATE PROCEDURE fake AS SELECT 0; */\nGO\n仍是注释 */\nGO\n-- 普通查询说明\nSELECT 1;";
+    expect(rangeSqlTexts(splitSqlStatementRanges(sql, "sqlserver"))).toEqual(["SELECT 1"]);
+  });
+
   it("keeps Oracle PL/SQL blocks together and treats slash lines as delimiters", () => {
     const ranges = splitSqlStatementRanges(oraclePlSqlFixture, "oracle");
     expect(rangeSqlTexts(ranges)).toEqual([oraclePlSqlFixture.slice(0, oraclePlSqlFixture.indexOf("\n/")), "SELECT 1"]);
```

**File**: `apps/desktop/src/lib/sql/executableStatementRangeCache.ts` (modified, +6/-5)
```diff
@@ -1,7 +1,7 @@
 import { RangeSet, RangeValue, type ChangeSet, type Text } from "@codemirror/state";
 import type { DatabaseType } from "@/types/database";
 import type { SqlParameterOptions } from "@/lib/sql/sqlParameters";
-import { executableStatementRanges, startsHashLineComment, statementParsingDatabaseType, type SqlTextRange } from "@/lib/sql/sqlStatementRanges";
+import { executableStatementRanges, findSqlBlockCommentEnd, startsHashLineComment, statementParsingDatabaseType, type SqlTextRange } from "@/lib/sql/sqlStatementRanges";
 import { cursorBelongsToTrailingStatementDelimiter } from "@/lib/sql/statementDelimiter";
 
 export interface ExecutableStatementRangeCache {
@@ -87,26 +87,27 @@ export function executableStatementRangeCacheForDoc(
     if (doc.sliceString(currentLine.from, range.from).trim() === "") {
       byExecutableLineStart.set(currentLine.from, range);
     }
-    const executableStart = executableStartAfterLeadingDirective(sql, range, databaseType, parameterOptions);
+    const executableStart = executableStartAfterLeadingComments(sql, range, databaseType, parameterOptions);
     if (executableStart !== null) {
       byExecutableLineStart.set(doc.lineAt(executableStart).from, range);
     }
   }
   return { doc, databaseType, parameterOptions, parameterSyntaxKey, byStart, byExecutableLineStart, ranges };
 }
 
-function executableStartAfterLeadingDirective(sql: string, range: SqlTextRange, databaseType?: DatabaseType, parameterOptions?: SqlParameterOptions): number | null {
+function executableStartAfterLeadingComments(sql: string, range: SqlTextRange, databaseType?: DatabaseType, parameterOptions?: SqlParameterOptions): number | null {
   databaseType = statementParsingDatabaseType(databaseType, parameterOptions);
   const text = range.sql;
   const hasExecutableDirective = text.startsWith("/*+") || text.startsWith("/*@") || text.startsWith("/*&") || (databaseType === "mysql" && text.startsWith("/*proxy*/"));
-  if (!hasExecutableDirective) return null;
+  const hasModuleComment = databaseType === "sqlserver" && (text.startsWith("--") || text.startsWith("/*"));
+  if (!hasExecutableDirective && !hasModuleComment) return null;
 
   let offset = 0;
   while (offset < text.length) {
     while (/\s/.test(text[offset] ?? "")) offset += 1;
 
     if (text.startsWith("/*", offset)) {
-      const close = text.indexOf("*/", offset + 2);
+      const close = findSqlBlockCommentEnd(text, offset, databaseType);
       if (close < 0) return null;
       offset = close + 2;
       continue;
```

**File**: `apps/desktop/src/lib/sql/sqlStatementRanges.ts` (modified, +45/-2)
```diff
@@ -431,6 +431,7 @@ export function splitSqlStatementRanges(sql: string, databaseType?: DatabaseType
   let singleQuoteBackslashEscapes = false;
   let dollarTag = "";
   let postgresDollarQuotedRoutine = false;
+  let sqlServerModuleBatch = false;
   let oraclePlSqlStatementEnd: number | null | undefined;
   let i = 0;
 
@@ -471,6 +472,12 @@ export function splitSqlStatementRanges(sql: string, databaseType?: DatabaseType
       // exact /*proxy*/ directive also keeps its historical multiline support.
       const directiveStart = pendingMysqlDirectiveStart !== -1 && (sql.startsWith("/*proxy*/", pendingMysqlDirectiveStart) || pos < pendingMysqlDirectiveLineEnd) ? pendingMysqlDirectiveStart : -1;
       statementStart = directiveStart !== -1 ? directiveStart : pendingHintStart === -1 ? pos : pendingHintStart;
+      sqlServerModuleBatch = databaseType === "sqlserver" && startsWithSqlServerModuleDdl(sql, pos, parameterOptions);
+      if (sqlServerModuleBatch) {
+        // SQL Server stores the module's leading comments in its definition.
+        statementStart = statementHitStart;
+        while (isWhitespace(sql[statementStart])) statementStart += 1;
+      }
       pendingHintStart = -1;
       pendingMysqlDirectiveStart = -1;
       pendingMysqlDirectiveLineEnd = -1;
@@ -485,6 +492,7 @@ export function splitSqlStatementRanges(sql: string, databaseType?: DatabaseType
       pendingMysqlDirectiveStart = -1;
       pendingMysqlDirectiveLineEnd = -1;
       postgresDollarQuotedRoutine = false;
+      sqlServerModuleBatch = false;
       oraclePlSqlStatementEnd = undefined;
       return;
     }
@@ -498,6 +506,7 @@ export function splitSqlStatementRanges(sql: string, databaseType?: DatabaseType
     pendingMysqlDirectiveStart = -1;
     pendingMysqlDirectiveLineEnd = -1;
     postgresDollarQuotedRoutine = false;
+    sqlServerModuleBatch = false;
     oraclePlSqlStatementEnd = undefined;
     mysqlRoutineScan = null;
   };
@@ -622,7 +631,7 @@ export function splitSqlStatementRanges(sql: string, databaseType?: DatabaseType
     if (ch === "/" && next === "*") {
       const hintMarker = sql[i + 2];
       if (statementStart === -1 && pendingHintStart === -1 && (hintMarker === "+" || hintMarker === "@" || hintMarker === "&")) pendingHintStart = i;
-      const close = sql.indexOf("*/", i + 2);
+      const close = findSqlBlockCommentEnd(sql, i, databaseType);
       if (statementStart === -1) {
         if (databaseType === "mysql") {
           if (pendingMysqlDirectiveStart === -1 || i > pendingMysqlDirectiveLineEnd) {
@@ -694,6 +703,11 @@ export function splitSqlStatementRanges(sql: string, databaseType?: DatabaseType
         continue;
       }
     } else if (ch === ";" && !isXmlEntityReferenceSemicolon(sql, i)) {
+      if (sqlServerModuleBatch) {
+        markContent(i);
+        i += 1;
+        continue;
+      }
       const routineTokensBeforeSemicolon = isMysqlRoutineBlockDatabase(databaseType) && statementStart !== -1 ? mysqlRoutineTokensUpTo(i) : null;
       const isMysqlRoutineBlock = routineTokensBeforeSemicolon !== null && isMysqlRoutineDdlStartFromWords(mysqlRoutineDdlStartWords(routineTokensBeforeSemicolon)) && mysqlRoutineTokensContainBegin(routineTokensBeforeSemicolon);
       if (isMysqlRoutineBlock) {
@@ -857,6 +871,7 @@ function splitStatementRangeAtSoftStarts(sql: string, statement: RawStatement, d
   if (isFirebirdRoutineBlockStatement(statement.sql, databaseType)) return [statement];
   // Routine bodies contain top-level-looking SET/INSERT/SELECT lines that are not independent statements.
   if (isMysqlRoutineBlockDatabase(databaseType) && startsWithMysqlRoutineBlock(statement.sql, parameterOptions)) return [statement];
+  if (databaseType === "sqlserver" && startsWithSqlServerModuleDdl(sql, statement.from, parameterOptions)) return [statement];
   // SQL Server control-flow batches use line-oriented BEGIN/EXEC tokens inside one IF/ELSE statement.
   if (isSqlServerControlFlowBatch(sql, statement, databaseType, parameterOptions)) return [statement];
 
@@ -1056,6 +1071,18 @@ function scanSqlServerControlFlow(sql: string, from: number, to: number, databas
   return { openBlocks, closedAt, wordAfterClose, sawBlockBegin, hasControlFlowElse };
 }
 
+function startsWithSqlServerModuleDdl(sql: string, from: number, parameterOptions?: SqlParameterOptions): boolean {
+  const operation = nextSqlWordToken(sql, from, "sqlserver", parameterOptions);
+  if (operation?.word !== "CREATE" && operation?.word !== "ALTER") return false;
+  let kind = nextSqlWordToken(sql, operation.end, "sqlserver", parameterOptions);
+  if (operation.word === "CREATE" && kind?.word === "OR") {
+    const alter = nextSqlWordToken(sql, kind.end, "sqlserver", parameterOptions);
+    if (alter?.word !== "ALTER") return false;
+    kind = nextSqlWordToken(sql, alter.end, "sqlserver", parameterOptions);
+  }
+  return kind != null && ["PROC", "PROCEDURE", "FUNCTION", "TRIGGER", "VIEW"].includes(kind.word);
+}
+
 /**
  * T
```

**File**: `crates/dbx-sql-core/src/sql.rs` (modified, +46/-8)
```diff
@@ -2002,8 +2002,8 @@ fn split_sql_batch_ranges(sql: &str, profile: SqlDialectProfile) -> Vec<SqlState
 }
 
 fn push_batch_range(ranges: &mut Vec<SqlStatementRange>, sql: &str, start: usize, end: usize) {
-    let Some((relative_start, relative_end)) = executable_sql_bounds(&sql[start..end], SqlParsingOptions::default())
-    else {
+    let options = SqlParsingOptions::for_database_type(DatabaseType::SqlServer);
+    let Some((relative_start, relative_end)) = executable_sql_bounds(&sql[start..end], options) else {
         return;
     };
     let statement_start = start + relative_start;
@@ -2326,7 +2326,9 @@ fn starts_with_sqlserver_control_flow_batch(sql: &str) -> bool {
 }
 
 pub fn starts_with_sqlserver_module_ddl(sql: &str) -> bool {
-    let tokens = first_sql_tokens(sql, 4);
+    let executable =
+        leading_executable_sql_with_options(sql, SqlParsingOptions::for_database_type(DatabaseType::SqlServer));
+    let tokens = first_sql_tokens(executable, 4);
     if tokens.len() >= 4
         && tokens[0].eq_ignore_ascii_case("CREATE")
         && tokens[1].eq_ignore_ascii_case("OR")
@@ -4817,11 +4819,15 @@ fn executable_sql_bounds(statement: &str, options: SqlParsingOptions) -> Option<
         return None;
     }
     let executable_start = trimmed.len() - executable.len();
-    let start = if options.profile.preserves_tdsql_leading_directives {
-        crate::tdsql_mysql::leading_directive_start(trimmed, executable_start).unwrap_or(executable_start)
-    } else {
-        executable_start
-    };
+    let start =
+        if options.profile.keeps_sqlserver_module_batch_at_cursor && starts_with_sqlserver_module_ddl(executable) {
+            // SQL Server stores a module's leading comments as part of its definition.
+            trimmed.len() - trimmed.trim_start().len()
+        } else if options.profile.preserves_tdsql_leading_directives {
+            crate::tdsql_mysql::leading_directive_start(trimmed, executable_start).unwrap_or(executable_start)
+        } else {
+            executable_start
+        };
     Some((start, trimmed_end))
 }
 
@@ -6180,6 +6186,38 @@ mod tests {
         );
     }
 
+    #[test]
+    fn sqlserver_batches_preserve_module_header_comments() {
+        for header in [
+            "-- 存储过程名 : usp_GetUserById\n-- 作者 : 张三",
+            "/* 根据用户ID查询用户信息 */",
+            "/* 说明 /* 内部说明 */\nGO\n保留完整注释 */",
+        ] {
+            for operation in ["CREATE PROCEDURE", "ALTER PROC", "CREATE OR ALTER PROCEDURE"] {
+                let procedure = format!(
+                    "{header}\n{operation} dbo.usp_GetUserById @UserId INT AS\nBEGIN\n    SET NOCOUNT ON;\n    -- 查询用户\n    SELECT UserId FROM dbo.Users WHERE UserId = @UserId;\nEND;"
+                );
+                let sql = format!("SELECT 0;\nGO\n\n{procedure}\nGO\nSELECT 2;");
+
+                assert_eq!(super::split_sql_batches(&sql), vec!["SELECT 0;", &procedure, "SELECT 2;"]);
+                for marker in [header, operation, "WHERE UserId"] {
+                    let cursor = sql[..sql.find(marker).unwrap()].encode_utf16().count();
+                    assert_eq!(
+                        super::find_statement_at_cursor_for_database(&sql, cursor, DatabaseType::SqlServer),
+                        procedure,
+                        "{operation}: cursor on {marker}"
+                    );
+                }
+            }
+        }
+    }
+
+    #[test]
+    fn sqlserver_batch_headers_keep_comment_only_batches_non_executable() {
+        let sql = "-- CREATE PROCEDURE fake AS SELECT 0;\nGO\n/* 说明 /* CREATE PROC fake */ 仍是注释 */\nGO\n-- 普通查询说明\nSELECT 1;";
+        assert_eq!(super::split_sql_batches(sql), vec!["SELECT 1;"]);
+    }
+
     // --- DELIMITER support ---
 
     #[test]
```

#### Recent Merged Pull Requests:
- **PR #14734** (2026-11-11): fix(kingbase): return result sets when executing stored procedures (@thailoc-dev)
- **PR #14731** (2026-11-11): fix(grid): allow Firebird triggers to populate omitted NOT NULL columns on insert (@thailoc-dev)
- **PR #14730** (2026-11-11): fix(saphana): support view object source lookup and DDL formatting (@thailoc-dev)
- **PR #14720** (2026-11-11): fix(sqlserver): 保留存储过程头部注释 (@onceMisery)
- **PR #14719** (2026-11-11): feat(plugin): 支持将插件生成的 PNG 复制到系统剪贴板 (@CSXFanMeng)
- **PR #14718** (2026-11-11): fix(teradata): keep user queries free of the unsupported LIMIT clause (#14604) (@xiaou61)

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

## X. iotdb): honor unlimited query timeout across paged fetches

**RULE**:
When implementing operations in `agents/drivers/iotdb/driver.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in t8y2/dbx. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b62e570a`: iotdb): honor unlimited query timeout across paged fetches. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `agents/drivers/iotdb/driver.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
// The narrow surface nativeIoTDBSession needs from the vendored client.
// Keeping it an interface lets adapter tests assert that the per-query
// timeout reaches the session layer instead of being dropped (#13935).
type clientQuerySession interface {
	ExecuteQueryStatementWithContext(context.Context, string, *int64) (*client.SessionDataSet, error)
	ExecuteStatementWithContext(context.Context, string) (*client.SessionDataSet, error)
	Close() error
}

	session clientQuerySession
func (s *nativeIoTDBSession) ExecuteQueryStatement(ctx context.Context, sql string, timeoutMs *int64) (*client.SessionDataSet, error) {
	return executeIoTDBStatement(ctx, func() (*client.SessionDataSet, error) {
		// #13935: the timeout must ride inside the RPC — an omitted value
		// falls back to the server's query_timeout_threshold (60 s default),
		// so whatever timeoutMilliseconds produced (the 100-year no-limit
		// budget, or a positive bound) reaches the request. The old adapter
		// dropped it here.
		return s.session.ExecuteQueryStatementWithContext(ctx, sql, timeoutMs)
	})
	dataset, err := executeIoTDBStatement(ctx, func() (*client.SessionDataSet, error) {
		return s.session.ExecuteStatementWith
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
	session *client.Session
func (s *nativeIoTDBSession) ExecuteQueryStatement(ctx context.Context, sql string, _ *int64) (*client.SessionDataSet, error) {
	return executeIoTDBStatement(ctx, s.session, sql)
	dataset, err := executeIoTDBStatement(ctx, s.session, sql)
func executeIoTDBStatement(ctx context.Context, session *client.Session, sql string) (dataset *client.SessionDataSet, err error) {
	return session.ExecuteStatementWithContext(ctx, sql)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b62e570a` are properly handled with clean fallback behavior.
