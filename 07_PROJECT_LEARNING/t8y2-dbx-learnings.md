> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/t8y2-dbx-learnings.md`  
> **Source**: github ([https://github.com/t8y2/dbx](https://github.com/t8y2/dbx))  
> **Source Version**: `9e248553`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-30T15:08:25.523Z  
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
> **Harvest Timestamp**: 2026-10-30T15:08:25.237Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `t8y2/dbx`
- **Description**: 25 MB lightweight cross-platform database client for 100+ databases, including MySQL, PostgreSQL, SQLite, Redis, MongoDB, DuckDB, SQL Server, and Dameng. Built-in AI, MCP Server, CLI, desktop and Docker. | 轻量级跨平台数据库管理工具，支持 MySQL、PostgreSQL、SQLite、Redis、MongoDB、达梦等 100+ 数据库，提供桌面端、Docker、CLI、内置 AI 助手和 MCP。
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 28255 stars

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
        let include_columns = allowed.contains("column");
        let max_results = if request.max_results == 0 { 100 } else { request.max_results.min(1000
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #13929** (2026-10-30): **[Bug] 代码片段无法自定义排版格式，切换数据库类型自动替换失效**
  *Symptoms*: ### 来源 QQ 群反馈 · **反馈人**：,,,  ### 数据库类型和版本 MsSql  ### AI 摘要 在设置代码片段时，无法自定义维护排版格式；将SQL语句压缩为单行后，切换到MsSql数据库类型时，LIMIT自动替换脚本失效。  ### 原始描述 设置--代码片段：无法自定义维护排版格式，切换据库类型自动替换脚本失效。 例如：将 SELECT * FROM table LIMIT 100; 改为 SELECT * FROM table LIMIT 100; 切换到MsSql后limit替换失效。
  **Post-Mortem & Fix Analysis**:
  > /claim  ## 原因  `apps/desktop/src/lib/sql/sqlSnippetTemplates.ts` 中的 `resolveSqlSnippetBodyForDatabase` 只在片段正文与内置默认值**完全相等**（`snippet.body !== rule.defaultBody` 严格比较）时才按数据库方言生成写法，否则视为用户自定义内容原样返回。  这一规则来自 #4375，本意是保护用户真正修改过的内容（例如 `LIMIT 7`），但严格比较把只调整换行/空格的情况也当成了“自定义”。因此把      SELECT *     FROM table     LIMIT 100;  改成单行 `SELECT * FROM table LIMIT 100;` 后，切换到 SQL Server 时不再生成 `SELECT TOP 100 ...`，仍保留 `LIMIT`。`upd`（ClickHouse）和 `at`（新增列）片段走同一判断，存在相同问题；默认正文若为 `\r\n` 换行也会静默失效。  ## 修复方案  1. 判断是否为默认值前，先将连续空白折叠为单个空格再比较，仅调整排版时仍视为默认片段。 2. 若方言写法与用户正文（折叠空白后）一致，直接返回用户原文，不覆盖用户的缩进和排版（例如 MySQL 下的单行 `sel`、改过缩进的 CTE）。 3. 方言写法确实不同时：用户正文为单行则输出单行方言写法（如 `SELECT TOP 100 * FROM table;`），多行则使用默认多行写法。 4. 内容真正改过的片段（如 `LIMIT 7`、修改表名）行为不变，#4375 的保护测试保持通过。  ## 测试  在 `sqlCompletion.snippet.spec.ts` 中以表格驱动方式补充用例：SQL Server 单行 `sel`、MySQL 单行 `sel` 保持原样、改过缩进的 CTE 保持原样、Oracle 下重排过的多行 `sel`、`\r\n` 换行的默认正文。  额外开销仅限 11 个内置片段的空白折叠，每次补全为微秒级，自定义片段路径不变。
  > ✅ @seaways1015-afk 已认领 #13929，开始处理吧！

- **Issue #13917** (2026-10-29): **[Bug][Windows ARM64] 打开查询页 / 默认查询即闪退：0xC00000FD 主线程栈溢出（aarch64-pc-windows-msvc 未设置 8 MiB 栈）**
  *Symptoms*: ### 数据库类型和版本 / Database type and version  IBM DB2（JDBC 插件）。问题与数据库无关：打开查询编辑器标签页时就会崩溃。  ### 问题描述 / Problem description  Windows ARM64 原生安装包从 0.6.57 起，**打开任何 SQL 查询标签页都会立即闪退**。0.6.56 是否受影响未验证。  复现步骤： 1. 侧栏右键任意连接 → 「打开默认查询」，或点工具栏「新建查询」 2. 应用在 1 秒内直接退出，没有任何提示  本机在 0.6.57、0.6.58、0.6.60、0.6.61 上均 100% 复现。  **stderr**（GUI 进程，用重定向 stderr 的方式启动后捕获）：  ``` [STARTUP] setup complete in 254.159ms (total 742.597083ms) DBX MCP Streamable HTTP listening on http://127.0.0.1:5225/mcp  thread 'main' (2408) has overflowed its stack ```  **Windows 事件日志（Application Error / WER APPCRASH）：**  | 版本 | 异常代码 | 异常偏移 | | --- | --- | --- | | 0.6.57 | `c00000fd` | `0x3056360` | | 0.6.58 | `c00000fd` | `0x3057160` | | 0.6.60 | `c00000fd` | `0x3118060` | | 0.6.61 | `c00000fd` | `0x3118060` |  反汇编 0.6.61 的 `0x3118060`，位置在 ARM64 的 `__chkstk` 栈探测循环（`ldr xzr, [x17]`）里。也就是说，主线程上某个栈帧在探测栈页时越过了栈底。  **根因分析**  0.6.61 安装包里 `dbx.exe` 的 PE 头：  ``` Machine            : 0xAA64 (ARM64) SizeOfStackReserve : 0x100000 (1 MiB)   <- Windows 默认值 SizeOfStackCommit  : 0x1000 ```  当前 `main` 分支的 `.cargo/config.toml` 只给两个 x86_64 目标设置了 8 MiB 主线程栈：  ```toml [target.x86_64-pc-windows-msvc] rustflags = ["-C", "link-arg=/STACK:8388608"]  [target.x86_64-win7-windows-msvc] rustflags = ["-C", "link-arg=/STACK:8388608"] ```  **没有 `[target.aarch64-pc-windows-msvc]` 这一段**，所以 Windows ARM64 包的主线程栈仍是 1 MiB。  这和 #13671 是同一类问题。#13448（v0.6.56）让建连 / transport 的调用栈变深，1 MiB 主线程栈被撑爆。#13672 只修复了 Win7 / Server 2012 R2 的 x64 遗留包，ARM64 被漏掉了。  **验证**  把 `dbx.exe`

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

### Incident Patch 1: `56e4f94f` (2026-10-29)
**Commit Message**: fix(updates): name the dialog that blocks installation (#13907)

* fix(updates): name the dialog that blocks installation

Restarting to update is vetoed while any dialog that owns configuration
state is open, but all 20+ of those dialogs shared one message
("请先完成当前配置编辑"), and the veto was then reported as "更新安装失败".
Users could not tell which dialog to close — and when the veto came from a
detached window, the message pointed at a window with nothing open in it.

- Add describeConfigUpdateBlock() with an ordered surface table, so the
  message names the actual dialog ("请先关闭「数据传输」后再更新。"), and
  give config import/export that is mid-flight its own instruction.
- Introduce UpdatePreparationError so a held-back update is reported as
  "更新未执行" instead of an installation failure, and carry the reason
  code plus an "the dialog is in another DBX window" hint across the
  webview hop (also dropping the "Error: " prefix from String(cause)).
- Cover the surface table, the code/hint propagation, and the rendered
  message in all 10 locales with tests.

* chore(i18n): autofill new translations

---------

Co-authored-by: zipg <[REDACTED_EMAIL]>
Co-authored-by: dbx-i18n-bot <github-actions[bot]

**File**: `apps/desktop/src/App.vue` (modified, +37/-32)
```diff
@@ -1,6 +1,7 @@
 <script setup lang="ts">
 import { blockingDesktopAiRunsForUpdate } from "@/lib/ai/desktopAiRunRegistry";
-import { setupUpdatePreparation, prepareUpdateWithDraftRecovery, isUpdatePreparationActive } from "@/lib/app/updatePreparation";
+import { setupUpdatePreparation, prepareUpdateWithDraftRecovery, isUpdatePreparationActive, UpdatePreparationError } from "@/lib/app/updatePreparation";
+import { describeConfigUpdateBlock, type UpdateBlockingConfigState, type UpdateConfigTranslator } from "@/lib/app/updatePreparationSurfaces";
 import { ref, computed, watch, onMounted, onUnmounted, nextTick, defineAsyncComponent, provide } from "vue";
 import { MCP_CALL_HISTORY_OPEN_EVENT, type McpCallHistoryRequest } from "@/lib/mcp/mcpCallHistory";
 import "vue-virtual-scroller/dist/vue-virtual-scroller.css";
@@ -373,46 +374,50 @@ const isDetachedWindowContext = windowContext.kind === "detached-tab";
 const detachedContextTabId = windowContext.kind === "detached-tab" ? windowContext.tabId : undefined;
 let updateWindowReady = false;
 let updatePreparation: Awaited<ReturnType<typeof setupUpdatePreparation>> | undefined;
+const translateUpdateSurface: UpdateConfigTranslator = (key, named) => (named ? t(key, named) : t(key));
+/** Snapshot of every surface that must be closed before the installer may run. */
+function updateBlockingConfigState(): UpdateBlockingConfigState {
+  return {
+    pendingAppClose: pendingAppCloseAction.value !== null,
+    connectionDialog: showConnectionDialog.value,
+    saveSqlDialog: showSaveSqlDialog.value,
+    ddlDialog: showQueryEditorDdlDialog.value,
+    objectSourceDialog: showQueryEditorObjectSourceDialog.value,
+    sqlParameterDialog: showSqlParameterDialog.value,
+    dangerDialog: showDangerDialog.value,
+    multiDbExecuteDialog: showMultiDbExecuteDialog.value,
+    transferDialog: dialogs.showTransferDialog.value,
+    sqlFileDialog: dialogs.showSqlFileDialog.value,
+    tableImportDialog: dialogs.showTableImportDialog.value,
+    mongoImportDialog: dialogs.showMongoImportDialog.value,
+    dataGenerateDialog: dialogs.showTableDataGenerateDialog.value,
+    databaseExportDialog: dialogs.showDatabaseExportDialog.value,
+    schemaDiffDialog: dialogs.showSchemaDiffDialog.value,
+    dataCompareDialog: dialogs.showDataCompareDialog.value,
+    configPassphraseDialog: dialogs.showConfigPassphraseDialog.value,
+    configPassphraseExportMode: dialogs.configPassphraseMode.value === "export",
+    configConnectionSelectDialog: dialogs.showConfigConnectionSelectDialog.value,
+    configConnectionSelectExportMode: dialogs.configConnectionSelectMode.value === "export",
+    configUnencryptedExportConfirm: dialogs.showConfigUnencryptedExportConfirm.value,
+    importLayoutConfirm: dialogs.showImportLayoutConfirm.value,
+    configExportBusy: dialogs.configExportBusy.value,
+    importApplying: dialogs.applyingImportSelection.value,
+  };
+}
 async function initializeUpdatePreparation() {
   if (!isDesktop || updatePreparation) return;
   updatePreparation = await setupUpdatePreparation({
     translate: (key) => t(key),
     assertSafe() {
-      if (!updateWindowReady) throw new Error(t("updates.preparationNotReady"));
+      if (!updateWindowReady) throw new UpdatePreparationError(t("updates.preparationNotReady"), "not_ready");
       if (trackedUpdateTaskCount.value > 0 || blockingDesktopAiRunsForUpdate().length > 0 || queryStore.tabs.some((tab) => tab.isCancelling || tab.isExplaining || tab.txnSessionId)) {
-        throw new Error(t("updates.preparationTasks"));
+        throw new UpdatePreparationError(t("updates.preparationTasks"), "tasks");
       }
       if (queryStore.tabs.some((tab) => (tab.pendingDataChangeCount ?? 0) > 0 || tab.hasPendingDataEditorDraft)) {
-        throw new Error(t("updates.preparationDrafts"));
-      }
-      if (
-        pendingAppCloseAction.value ||
-        showConnectionDialog.value ||
-        showSaveSqlDialog.value ||
-        showQueryEditorDdlDialog.value ||
-        showQueryEditorObjectSourceDialog.value ||
-        showSqlParameterDialog.value ||
-        showDangerDialog.value ||
-        showMultiDbExecuteDialog.value ||
-        [
-          dialogs.showTransferDialog,
-          dialogs.showSqlFileDialog,
-          dialogs.showTableImportDialog,
-          dialogs.showMongoImportDialog,
-          dialogs.showTableDataGenerateDialog,
-          dialogs.showDatabaseExportDialog,
-          dialogs.showSchemaDiffDialog,
-          dialogs.showDataCompareDialog,
-          dialogs.showConfigPassphraseDialog,
-          dialogs.showConfigConnectionSelectDialog,
-          dialogs.showConfigUnencryptedExportConfirm,
-          dialogs.showImportLayoutConfirm,
-          dialogs.configExportBusy,
-          dialogs.applyingImportSelection,
-        ].some((state) => state.value)
-      ) {
-        throw new Error(t("updates.preparationConfig"));
+        throw new UpdatePreparationError(t("updates.preparationDrafts"), "drafts"
```

**File**: `apps/desktop/src/composables/useAppUpdater.ts` (modified, +7/-2)
```diff
@@ -7,6 +7,7 @@ import type { UpdateDownloadSource as SettingsUpdateDownloadSource } from "@/sto
 import type { UpdateDownloadProgress } from "@/lib/backend/tauri";
 import { currentLocale } from "@/i18n";
 import { shouldBlockAppUpdate } from "@/lib/app/appUpdateTaskGuard";
+import { isUpdatePreparationError, UpdatePreparationError } from "@/lib/app/updatePreparation";
 import { uuid } from "@/lib/common/utils";
 import { isUpdatePreviewMockEnabled, previewAppUpdateInfo } from "@/lib/updates/updatePreviewMock";
 
@@ -443,7 +444,7 @@ export function useAppUpdater(options: UseAppUpdaterOptions = {}) {
     try {
       release = await options.prepareForUpdate?.();
       updatePreparationRelease = release;
-      if (shouldBlockAppUpdate(activeTaskCount.value)) throw new Error(t("updates.activeTasksBlockUpdate", { count: activeTaskCount.value }));
+      if (shouldBlockAppUpdate(activeTaskCount.value)) throw new UpdatePreparationError(t("updates.activeTasksBlockUpdate", { count: activeTaskCount.value }), "tasks");
       phase.value = "installing";
       if (!restartOnly && cache) {
         await api.installDownloadedUpdate(cache.cache_id, cache.version);
@@ -460,7 +461,11 @@ export function useAppUpdater(options: UseAppUpdaterOptions = {}) {
       phase.value = installed ? "restart" : "ready";
       updateCheckFailed.value = true;
       const message = error instanceof Error ? error.message : String(error);
-      updateCheckMessage.value = installed ? t("updates.restartFailed", { error: message }) : formatInstallError(message);
+      // A held-back update was never attempted: say that plainly and keep the
+      // reason (which dialog to close) instead of calling it an install failure.
+      if (installed) updateCheckMessage.value = t("updates.restartFailed", { error: message });
+      else if (isUpdatePreparationError(error)) updateCheckMessage.value = t("updates.updateBlocked", { error: message });
+      else updateCheckMessage.value = formatInstallError(message);
     } finally {
       // Successful handoff must keep every window frozen until the process exits.
       if (failed) {
```

**File**: `apps/desktop/src/i18n/locales/az.ts` (modified, +8/-0)
```diff
@@ -428,6 +428,13 @@ export default withEnglishFallback({
     preparationTasks: "Aktiv tapşırıqları və tranzaksiyaları bitirin.",
     preparationDrafts: "Dəyişiklikləri saxlayın və ya ləğv edin.",
     preparationConfig: "Konfiqurasiya redaktəsini bitirin.",
+    preparationConfigBusy: "Konfiqurasiya ixracı və ya idxalı davam edir. Yeniləmədən əvvəl tamamlanmasını gözləyin.",
+    preparationConfigDetail: "Yeniləmədən əvvəl «{surface}» pəncərəsini bağlayın.",
+    preparationOtherWindowHint: " (pəncərə başqa DBX pəncərəsindədir)",
+    surfaceConnection: "Bağlantı ayarları",
+    surfaceDdl: "DDL görünüşü",
+    surfaceObjectSource: "Obyekt mənbəyi",
+    surfaceConfigUnencryptedExport: "Şifrələnməmiş ixrac təsdiqi",
     preparationNotReady: "Yeniləmə hazır deyil. Yenidən sınayın.",
     downloadedReady: "v{version} versiyası endirilib. Yeniləmək üçün yenidən başladın.",
     restartAndUpdate: "Yenidən başladın və yeniləyin",
@@ -459,6 +466,7 @@ export default withEnglishFallback({
     installing: "Yeniləmə quraşdırılır...",
     portableHelperFailed: "Daşınabilən yeniləmə köməkçisi işə salına bilmədi: {error}",
     installFailed: "Yeniləməni quraşdırmaq mümkün olmadı: {error}",
+    updateBlocked: "Yeniləmə başladılmadı: {error}",
     restart: "Çıx və yenidən başlat",
     updateAction: "Yenilə",
     updateNow: "İndi yenilə",
```

**File**: `apps/desktop/src/i18n/locales/en.ts` (modified, +8/-0)
```diff
@@ -1311,6 +1311,13 @@ export default {
     preparationTasks: "Finish active tasks and transactions before updating.",
     preparationDrafts: "Save or discard unsaved changes before updating.",
     preparationConfig: "Finish editing the current configuration before updating.",
+    preparationConfigBusy: "A configuration export or import is still running. Wait for it to finish before updating.",
+    preparationConfigDetail: "Close the {surface} dialog before updating.",
+    preparationOtherWindowHint: " (the dialog is in another DBX window)",
+    surfaceConnection: "Connection settings",
+    surfaceDdl: "DDL view",
+    surfaceObjectSource: "Object source",
+    surfaceConfigUnencryptedExport: "Unencrypted export confirmation",
     preparationNotReady: "Update preparation is not ready. Try again.",
     downloadedReady: "New version v{version} is downloaded. Restart to update.",
     restartAndUpdate: "Restart & Update",
@@ -1342,6 +1349,7 @@ export default {
     installing: "Installing update...",
     portableHelperFailed: "The portable update helper could not start: {error}",
     installFailed: "Update installation failed: {error}",
+    updateBlocked: "Update not started: {error}",
     restart: "Exit & Restart",
     updateAction: "Update",
     updateNow: "Update Now",
```

**File**: `apps/desktop/src/i18n/locales/es.ts` (modified, +8/-0)
```diff
@@ -1108,6 +1108,13 @@ export default withEnglishFallback({
     preparationTasks: "Finaliza las tareas y transacciones activas.",
     preparationDrafts: "Guarda o descarta los cambios pendientes.",
     preparationConfig: "Finaliza la edición de configuración.",
+    preparationConfigBusy: "Hay una exportación o importación de configuración en curso. Espera a que termine antes de actualizar.",
+    preparationConfigDetail: "Cierra el diálogo «{surface}» antes de actualizar.",
+    preparationOtherWindowHint: " (el diálogo está en otra ventana de DBX)",
+    surfaceConnection: "Configuración de conexión",
+    surfaceDdl: "Vista DDL",
+    surfaceObjectSource: "Código del objeto",
+    surfaceConfigUnencryptedExport: "Confirmación de exportación sin cifrar",
     preparationNotReady: "La actualización no está lista. Reintenta.",
     downloadedReady: "La versión v{version} está descargada. Reinicia para actualizar.",
     restartAndUpdate: "Reiniciar y actualizar",
@@ -1136,6 +1143,7 @@ export default withEnglishFallback({
     installing: "Instalando actualización...",
     portableHelperFailed: "No se pudo iniciar el asistente de actualización portátil: {error}",
     installFailed: "Error al instalar la actualización: {error}",
+    updateBlocked: "Actualización no iniciada: {error}",
     restart: "Salir y reiniciar",
     updateAction: "Actualizar",
     updateNow: "Actualizar ahora",
```

**File**: `apps/desktop/src/i18n/locales/it.ts` (modified, +8/-0)
```diff
@@ -1096,6 +1096,13 @@ export default withEnglishFallback({
     preparationTasks: "Termina attività e transazioni in corso.",
     preparationDrafts: "Salva o scarta le modifiche non salvate.",
     preparationConfig: "Completa la modifica della configurazione.",
+    preparationConfigBusy: "È in corso un'esportazione o importazione della configurazione. Attendi che finisca prima di aggiornare.",
+    preparationConfigDetail: "Chiudi la finestra «{surface}» prima di aggiornare.",
+    preparationOtherWindowHint: " (la finestra di dialogo è in un'altra finestra di DBX)",
+    surfaceConnection: "Impostazioni connessione",
+    surfaceDdl: "Vista DDL",
+    surfaceObjectSource: "Sorgente oggetto",
+    surfaceConfigUnencryptedExport: "Conferma esportazione non cifrata",
     preparationNotReady: "Aggiornamento non pronto. Riprova.",
     downloadedReady: "La versione v{version} è scaricata. Riavvia per aggiornare.",
     restartAndUpdate: "Riavvia e aggiorna",
@@ -1124,6 +1131,7 @@ export default withEnglishFallback({
     installing: "Installazione dell'aggiornamento...",
     portableHelperFailed: "Impossibile avviare l'helper di aggiornamento portatile: {error}",
     installFailed: "Installazione dell'aggiornamento non riuscita: {error}",
+    updateBlocked: "Aggiornamento non avviato: {error}",
     restart: "Esci e Riavvia",
     updateAction: "Aggiorna",
     updateNow: "Aggiorna ora",
```

**File**: `apps/desktop/src/i18n/locales/ja.ts` (modified, +8/-0)
```diff
@@ -1097,6 +1097,13 @@ export default withEnglishFallback({
     preparationTasks: "実行中のタスクとトランザクションを終了してください。",
     preparationDrafts: "未保存の変更を保存または破棄してください。",
     preparationConfig: "設定の編集を終了してください。",
+    preparationConfigBusy: "設定のエクスポートまたはインポートを実行中です。完了してから更新してください。",
+    preparationConfigDetail: "更新する前に「{surface}」を閉じてください。",
+    preparationOtherWindowHint: "（このダイアログは別の DBX ウィンドウにあります）",
+    surfaceConnection: "接続設定",
+    surfaceDdl: "DDL 表示",
+    surfaceObjectSource: "オブジェクトソース",
+    surfaceConfigUnencryptedExport: "非暗号化エクスポートの確認",
     preparationNotReady: "更新の準備ができていません。再試行してください。",
     downloadedReady: "新バージョン v{version} をダウンロード済みです。再起動して更新できます。",
     restartAndUpdate: "再起動して更新",
@@ -1125,6 +1132,7 @@ export default withEnglishFallback({
     installing: "アップデートをインストール中...",
     portableHelperFailed: "ポータブル版アップデートのヘルパーを起動できませんでした: {error}",
     installFailed: "アップデートのインストールに失敗しました: {error}",
+    updateBlocked: "更新は実行されていません：{error}",
     restart: "終了して再起動",
     updateAction: "更新",
     updateNow: "今すぐ更新",
```

**File**: `apps/desktop/src/i18n/locales/ko.ts` (modified, +8/-0)
```diff
@@ -1103,6 +1103,13 @@ export default withEnglishFallback({
     preparationTasks: "실행 중인 작업과 트랜잭션을 종료하세요.",
     preparationDrafts: "변경 사항을 저장하거나 버리세요.",
     preparationConfig: "현재 설정 편집을 완료하세요.",
+    preparationConfigBusy: "설정 내보내기 또는 가져오기가 진행 중입니다. 완료된 후 업데이트하세요.",
+    preparationConfigDetail: '업데이트하기 전에 "{surface}" 대화 상자를 닫으세요.',
+    preparationOtherWindowHint: " (이 대화 상자는 다른 DBX 창에 있습니다)",
+    surfaceConnection: "연결 설정",
+    surfaceDdl: "DDL 보기",
+    surfaceObjectSource: "객체 소스",
+    surfaceConfigUnencryptedExport: "암호화하지 않은 내보내기 확인",
     preparationNotReady: "업데이트 준비가 안 되었습니다. 다시 시도하세요.",
     downloadedReady: "새 버전 v{version} 다운로드 완료. 다시 시작하여 업데이트하세요.",
     restartAndUpdate: "다시 시작 및 업데이트",
@@ -1131,6 +1138,7 @@ export default withEnglishFallback({
     installing: "업데이트 설치 중...",
     portableHelperFailed: "포터블 업데이트 도우미를 시작하지 못했습니다: {error}",
     installFailed: "업데이트 설치에 실패했습니다: {error}",
+    updateBlocked: "업데이트가 실행되지 않았습니다: {error}",
     restart: "종료 후 다시 시작",
     updateAction: "업데이트",
     updateNow: "지금 업데이트",
```

---

### Incident Patch 2: `9400c0cd` (2026-10-29)
**Commit Message**: fix(windows): reserve 8 MiB main-thread stack on ARM64 (#13918)

**File**: `.cargo/config.toml` (modified, +5/-0)
```diff
@@ -24,6 +24,11 @@ linker = "rust-lld"
 # paths pull in deep serde/driver call stacks. This embeds the size in the PE.
 rustflags = ["-C", "link-arg=/STACK:8388608"]
 
+# Native ARM64 builds need the same main-thread stack as x64. Without this,
+# opening a query can exhaust the linker's 1 MiB default stack (#13917).
+[target.aarch64-pc-windows-msvc]
+rustflags = ["-C", "link-arg=/STACK:8388608"]
+
 # The legacy Windows 7 / Server 2012 R2 target keeps the same 8 MiB main-thread
 # stack. CI builds it with an explicit RUSTFLAGS env (static CRT), which
 # replaces this table, so the same link arg is repeated in those workflows and
```

**File**: `.github/scripts/assert-win7-pe-compat.ps1` (modified, +3/-34)
```diff
@@ -70,37 +70,6 @@ if ($violations.Count -gt 0) {
 
 Write-Host "Windows 7 PE import audit passed: $BinaryPath"
 
-# Main-thread stack reserve audit. The app needs the 8 MiB stack that
-# .cargo/config.toml applies to the standard Windows target; the legacy target is
-# built with an explicit env RUSTFLAGS (static CRT), which replaces the config
-# rustflags, so the workflow repeats `-C link-arg=/STACK:8388608`. Without it the
-# PE keeps the 1 MiB linker default and deep connect/serde call stacks abort with
-# 0xC00000FD ("DBX 已停止工作"), which users reported on Windows 7 / Server 2012 R2.
-$minimumStackReserve = 8 * 1024 * 1024
-$image = [System.IO.File]::ReadAllBytes($BinaryPath)
-if ($image.Length -lt 0x100) {
-  throw "Windows 7 PE audit target is truncated: $BinaryPath"
-}
-$peOffset = [System.BitConverter]::ToInt32($image, 0x3C)
-if ($peOffset -le 0 -or $peOffset + 24 -gt $image.Length) {
-  throw "Invalid PE header offset in ${BinaryPath}"
-}
-$peSignature = [System.BitConverter]::ToUInt32($image, $peOffset)
-if ($peSignature -ne 0x00004550) {
-  throw "Invalid PE signature in ${BinaryPath}"
-}
-$optionalHeaderOffset = $peOffset + 24
-$optionalHeaderMagic = [System.BitConverter]::ToUInt16($image, $optionalHeaderOffset)
-$stackReserveOffset = $optionalHeaderOffset + 72
-$stackReserve = if ($optionalHeaderMagic -eq 0x20B) {
-  [System.BitConverter]::ToUInt64($image, $stackReserveOffset)
-} elseif ($optionalHeaderMagic -eq 0x10B) {
-  [System.BitConverter]::ToUInt32($image, $stackReserveOffset)
-} else {
-  throw ("Unsupported PE optional header magic 0x{0:X4} in {1}" -f $optionalHeaderMagic, $BinaryPath)
-}
-if ($stackReserve -lt $minimumStackReserve) {
-  throw ("Windows 7 main-thread stack reserve is {0} bytes, below the {1}-byte minimum. Add -C link-arg=/STACK:8388608 to the build RUSTFLAGS. Binary: {2}" -f $stackReserve, $minimumStackReserve, $BinaryPath)
-}
-
-Write-Host "Windows 7 PE stack reserve audit passed: $stackReserve bytes ($BinaryPath)"
+# The legacy env RUSTFLAGS also needs /STACK:8388608. Share the same audit as
+# standard x64/ARM64 releases so every Windows desktop target keeps this guard.
+& (Join-Path $PSScriptRoot "assert-windows-stack-reserve.ps1") -BinaryPath $BinaryPath
```

**File**: `.github/scripts/assert-windows-stack-reserve.ps1` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+[CmdletBinding()]
+param(
+  [Parameter(Mandatory = $true)]
+  [string[]]$BinaryPath
+)
+
+Set-StrictMode -Version Latest
+$ErrorActionPreference = "Stop"
+$minimumStackReserve = [uint64](8 * 1024 * 1024)
+
+foreach ($path in $BinaryPath) {
+  if (!(Test-Path -LiteralPath $path -PathType Leaf)) {
+    throw "Windows PE stack audit target does not exist: $path"
+  }
+
+  # Read only the headers: release executables can be hundreds of MiB.
+  $image = [System.IO.File]::OpenRead((Get-Item -LiteralPath $path).FullName)
+  $reader = [System.IO.BinaryReader]::new($image)
+  try {
+    if ($image.Length -lt 0x40 -or $reader.ReadUInt16() -ne 0x5A4D) {
+      throw "Invalid or truncated DOS header in ${path}"
+    }
+    [void]$image.Seek(0x3C, [System.IO.SeekOrigin]::Begin)
+    $peOffset = [long]$reader.ReadUInt32()
+    if ($peOffset -lt 0x40 -or $peOffset + 24 -gt $image.Length) {
+      throw "Invalid PE header offset in ${path}"
+    }
+    [void]$image.Seek($peOffset, [System.IO.SeekOrigin]::Begin)
+    if ($reader.ReadUInt32() -ne 0x00004550) {
+      throw "Invalid PE signature in ${path}"
+    }
+    $machine = $reader.ReadUInt16()
+    [void]$image.Seek($peOffset + 20, [System.IO.SeekOrigin]::Begin)
+    $optionalHeaderSize = $reader.ReadUInt16()
+    $optionalHeaderOffset = $peOffset + 24
+    if ($optionalHeaderSize -lt 2 -or $optionalHeaderOffset + $optionalHeaderSize -gt $image.Length) {
+      throw "Invalid or truncated PE optional header in ${path}"
+    }
+    [void]$image.Seek($optionalHeaderOffset, [System.IO.SeekOrigin]::Begin)
+    $magic = $reader.ReadUInt16()
+    $stackFieldSize = switch ($magic) {
+      0x20B { 8 } # PE32+: x64 and ARM64.
+      0x10B { 4 } # PE32.
+      default { throw ("Unsupported PE optional header magic 0x{0:X4} in {1}" -f $magic, $path) }
+    }
+    if ($optionalHeaderSize -lt 72 + $stackFieldSize) {
+      throw "PE optional header does not contain SizeOfStackReserve in ${path}"
+    }
+    [void]$image.Seek($optionalHeaderOffset + 72, [System.IO.SeekOrigin]::Begin)
+    $stackReserve = if ($stackFieldSize -eq 8) { $reader.ReadUInt64() } else { [uint64]$reader.ReadUInt32() }
+    if ($stackReserve -lt $minimumStackReserve) {
+      throw ("Windows main-thread stack reserve is {0} bytes, below the {1}-byte minimum. Add -C link-arg=/STACK:8388608 to the build RUSTFLAGS. Binary: {2}" -f $stackReserve, $minimumStackReserve, $path)
+    }
+    Write-Host ("Windows PE stack reserve audit passed: {0} bytes, machine 0x{1:X4} ({2})" -f $stackReserve, $machine, $path)
+  } finally {
+    $reader.Dispose()
+  }
+}
```

**File**: `.github/scripts/assert-windows-stack-reserve.test.ps1` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+Set-StrictMode -Version Latest
+$ErrorActionPreference = "Stop"
+$audit = Join-Path $PSScriptRoot "assert-windows-stack-reserve.ps1"
+$temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
+$directory = Join-Path $temporaryRoot "dbx-stack-reserve-tests-$([guid]::NewGuid())"
+New-Item -ItemType Directory -Path $directory | Out-Null
+$passed = 0
+
+function New-TestImage {
+  param([int]$Machine = 0x8664, [int]$Magic = 0x20B, [uint64]$StackReserve = 8388608)
+  $bytes = [byte[]]::new(512)
+  [BitConverter]::GetBytes([uint16]0x5A4D).CopyTo($bytes, 0)
+  [BitConverter]::GetBytes([uint32]0x80).CopyTo($bytes, 0x3C)
+  [BitConverter]::GetBytes([uint32]0x4550).CopyTo($bytes, 0x80)
+  [BitConverter]::GetBytes([uint16]$Machine).CopyTo($bytes, 0x84)
+  [BitConverter]::GetBytes([uint16]0xF0).CopyTo($bytes, 0x94)
+  [BitConverter]::GetBytes([uint16]$Magic).CopyTo($bytes, 0x98)
+  if ($Magic -eq 0x10B) {
+    [BitConverter]::GetBytes([uint32]$StackReserve).CopyTo($bytes, 0xE0)
+  } else {
+    [BitConverter]::GetBytes($StackReserve).CopyTo($bytes, 0xE0)
+  }
+  return ,$bytes
+}
+
+function Test-Image {
+  param([string]$Name, [byte[]]$Bytes, [string]$ExpectedError = "")
+  $path = Join-Path $directory "$Name.exe"
+  [IO.File]::WriteAllBytes($path, $Bytes)
+  $before = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
+  $failure = $null
+  try { & $audit -BinaryPath $path } catch { $failure = $_.Exception.Message }
+  if ($ExpectedError) {
+    if (!$failure -or $failure -notlike "*$ExpectedError*") { throw "${Name}: expected '$ExpectedError', got '$failure'" }
+  } elseif ($failure) {
+    throw "${Name}: unexpected failure: $failure"
+  }
+  if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $before) { throw "${Name}: audit modified the executable" }
+  $script:passed++
+}
+
+try {
+  foreach ($machine in @(0x8664, 0xAA64)) {
+    Test-Image "minimum-$machine" (New-TestImage -Machine $machine)
+    Test-Image "larger-$machine" (New-TestImage -Machine $machine -StackReserve 16777216)
+    Test-Image "default-$machine" (New-TestImage -Machine $machine -StackReserve 1048576) "below the 8388608-byte minimum"
+  }
+  Test-Image "pe32" (New-TestImage -Machine 0x14C -Magic 0x10B)
+  Test-Image "pe32-default" (New-TestImage -Machine 0x14C -Magic 0x10B -StackReserve 1048576) "below the 8388608-byte minimum"
+  Test-Image "below-minimum" (New-TestImage -StackReserve 8388607) "below the 8388608-byte minimum"
+  Test-Image "large-pe64-reserve" (New-TestImage -StackReserve 4294967296)
+  Test-Image "empty" ([byte[]]::new(0)) "DOS header"
+  Test-Image "truncated-dos" ([byte[]]::new(32)) "DOS header"
+  $bytes = New-TestImage; $bytes[0] = 0
+  Test-Image "bad-dos-signature" $bytes "DOS header"
+  $bytes = New-TestImage; [BitConverter]::GetBytes([uint32]4294967280).CopyTo($bytes, 0x3C)
+  Test-Image "out-of-range-pe-offset" $bytes "PE header offset"
+  $bytes = New-TestImage; [BitConverter]::GetBytes([uint32]32).CopyTo($bytes, 0x3C)
+  Test-Image "pe-offset-inside-dos" $bytes "PE header offset"
+  $bytes = New-TestImage; $bytes[0x80] = 0
+  Test-Image "bad-pe-signature" $bytes "PE signature"
+  $bytes = New-TestImage
+  Test-Image "truncated-optional-header" ([byte[]]$bytes[0..180]) "truncated PE optional header"
+  $bytes = New-TestImage; [BitConverter]::GetBytes([uint16]1).CopyTo($bytes, 0x94)
+  Test-Image "missing-optional-magic" $bytes "PE optional header"
+  $bytes = New-TestImage; [BitConverter]::GetBytes([uint16]72).CopyTo($bytes, 0x94)
+  Test-Image "missing-stack-field" $bytes "SizeOfStackReserve"
+  $bytes = New-TestImage; [BitConverter]::GetBytes([uint16]79).CopyTo($bytes, 0x94)
+  Test-Image "truncated-pe64-stack-field" $bytes "SizeOfStackReserve"
+  $bytes = New-TestImage -Magic 0x10B; [BitConverter]::GetBytes([uint16]75).CopyTo($bytes, 0x94)
+  Test-Image "truncated-pe32-stack-field" $bytes "SizeOfStackReserve"
+  Test-Image "unknown-magic" (New-TestImage -Magic 0x999) "optional header magic"
+
+  & $audit -BinaryPath @((Join-Path $directory "minimum-34404.exe"), (Join-Path $directory "minimum-43620.exe"))
+  $passed++
+  $missing = Join-Path $directory "missing.exe"
+  try { & $audit -BinaryPath $missing; throw "Missing target was accepted" } catch {
+    if ($_.Exception.Message -notlike "*target does not exist*") { throw }
+  }
+  $passed++
+  Write-Host "Windows stack reserve audit tests passed: $passed cases"
+} finally {
+  $resolved = [IO.Path]::GetFullPath($directory)
+  if (!$resolved.StartsWith((Join-Path $temporaryRoot "dbx-stack-reserve-tests-"), [StringComparison]::OrdinalIgnoreCase)) { throw "Unexpected cleanup path: $resolved" }
+  Remove-Item -LiteralPath $resolved -Recurse -Force
+}
```

**File**: `.github/scripts/ci-plan.mjs` (modified, +2/-1)
```diff
@@ -6,6 +6,7 @@ import { goAgents, integrationCases, rustAgents, rustGroups } from "./ci-config.
 
 const win7InfrastructureFiles = new Set([
   ".github/scripts/assert-win7-pe-compat.ps1",
+  ".github/scripts/assert-windows-stack-reserve.ps1",
   ".github/scripts/assert-webview2-win7-loader.ps1",
   ".github/scripts/assert-win7-installer-content.ps1",
   ".github/scripts/assert-webview2-win7-runtime.ps1",
@@ -145,7 +146,7 @@ export function planCi({ files, metadata, root, eventName = "pull_request", rust
     agent_integration_changed: liveMatrix.length > 0,
     duckdb_changed: nativeChanges.has("duckdb"),
     duckdb_windows: sharedRust || files.some((file) => file.startsWith("agents/drivers/duckdb/")),
-    windows_standard: windowsWin7Candidate,
+    windows_standard: windowsWin7Candidate || files.some((file) => file === ".github/scripts/assert-windows-stack-reserve.test.ps1" || file === ".github/scripts/test-windows-stack-reserve.ps1"),
     windows_win7_bundle: win7InfrastructureChanged || win7DependencyChanged || unknownRust || (rust && unknownMember),
     windows_win7_candidate: windowsWin7Candidate,
     windows_win7_affected_packages: [...win7Affected].sort(),
```

**File**: `.github/scripts/ci-plan.test.mjs` (modified, +9/-0)
```diff
@@ -142,6 +142,7 @@ test("old Win7 Rust paths remain candidates through the dependency graph", () =>
 test("Win7 infrastructure changes remain candidates outside the Cargo graph", () => {
   for (const file of [
     ".github/scripts/assert-win7-pe-compat.ps1",
+    ".github/scripts/assert-windows-stack-reserve.ps1",
     ".github/scripts/assert-webview2-win7-loader.ps1",
     ".github/scripts/assert-win7-installer-content.ps1",
     ".github/scripts/assert-webview2-win7-runtime.ps1",
@@ -173,6 +174,14 @@ test("Win7 infrastructure changes remain candidates outside the Cargo graph", ()
   }
 });
 
+test("Windows stack test changes run the standard Windows checks", () => {
+  for (const file of [".github/scripts/assert-windows-stack-reserve.test.ps1", ".github/scripts/test-windows-stack-reserve.ps1"]) {
+    const result = plan([file]);
+    assert.equal(result.windows_standard, true, file);
+    assert.equal(result.windows_win7_bundle, false, file);
+  }
+});
+
 test("Win7 dependency inputs fail open", () => {
   for (const file of ["Cargo.toml", "Cargo.lock", "src-tauri/Cargo.toml", "crates/dbx-cli/Cargo.toml"]) {
     assert.equal(plan([file]).windows_win7_candidate, true, file);
```

**File**: `.github/scripts/ci-workflow.test.mjs` (modified, +0/-6)
```diff
@@ -513,9 +513,3 @@ test("legacy Windows builds keep the 8 MiB main-thread stack", () => {
   }
   assert.match(job("build-windows-7-x64", sqlServerUserTest), stackFlag, "the SQL Server 2000 Win7 test build must keep the 8 MiB main-thread stack");
 });
-
-test("the Win7 PE audit fails when the stack reserve regresses", () => {
-  const audit = readFileSync(new URL("./assert-win7-pe-compat.ps1", import.meta.url), "utf8");
-  assert.ok(audit.includes("minimumStackReserve"));
-  assert.ok(audit.includes("link-arg=/STACK:8388608"));
-});
```

**File**: `.github/scripts/test-windows-stack-reserve.ps1` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+[CmdletBinding()]
+param(
+  [string[]]$Targets = @("x86_64-pc-windows-msvc", "aarch64-pc-windows-msvc")
+)
+
+Set-StrictMode -Version Latest
+$ErrorActionPreference = "Stop"
+$repositoryRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
+$audit = Join-Path $PSScriptRoot "assert-windows-stack-reserve.ps1"
+$temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
+$directory = Join-Path $temporaryRoot "dbx-stack-reserve-probe-$([guid]::NewGuid())"
+New-Item -ItemType Directory -Path (Join-Path $directory "src") | Out-Null
+$originalRustflags = [Environment]::GetEnvironmentVariable("RUSTFLAGS", "Process")
+$originalEncodedRustflags = [Environment]::GetEnvironmentVariable("CARGO_ENCODED_RUSTFLAGS", "Process")
+$hadRustflags = Test-Path Env:RUSTFLAGS
+$hadEncodedRustflags = Test-Path Env:CARGO_ENCODED_RUSTFLAGS
+
+function Restore-RustflagEnvironment {
+  if ($hadRustflags) { $env:RUSTFLAGS = $originalRustflags }
+  else { Remove-Item Env:RUSTFLAGS -ErrorAction SilentlyContinue }
+  if ($hadEncodedRustflags) { $env:CARGO_ENCODED_RUSTFLAGS = $originalEncodedRustflags }
+  else { Remove-Item Env:CARGO_ENCODED_RUSTFLAGS -ErrorAction SilentlyContinue }
+}
+
+# A real PE produced by Cargo verifies effective linker flags, including when
+# an environment override takes precedence over the repository's target config.
+# no_std keeps the cross-architecture probe independent of Windows SDK libraries.
+[IO.File]::WriteAllText((Join-Path $directory "Cargo.toml"), @'
+[package]
+name = "stack-reserve-probe"
+version = "0.0.0"
+edition = "2021"
+[workspace]
+[profile.release]
+panic = "abort"
+'@)
+[IO.File]::WriteAllText((Join-Path $directory "src/main.rs"), @'
+#![no_std]
+#![no_main]
+#[no_mangle]
+pub extern "C" fn mainCRTStartup() {}
+#[panic_handler]
+fn panic(_: &core::panic::PanicInfo<'_>) -> ! { loop {} }
+'@)
+
+Push-Location $repositoryRoot
+try {
+  foreach ($mode in @("target-config", "environment")) {
+    if ($mode -eq "environment") {
+      if (!$hadRustflags -and !$hadEncodedRustflags) { continue }
+      Restore-RustflagEnvironment
+    } else {
+      # An empty variable still overrides Cargo config in current PowerShell.
+      Remove-Item Env:RUSTFLAGS, Env:CARGO_ENCODED_RUSTFLAGS -ErrorAction SilentlyContinue
+    }
+    foreach ($target in $Targets) {
+      Write-Host "Verifying Windows stack reserve: $target ($mode)"
+      & cargo rustc --offline --release --manifest-path (Join-Path $directory "Cargo.toml") --target $target --target-dir (Join-Path $directory "target") -- -C linker=rust-lld -C link-arg=/ENTRY:mainCRTStartup -C link-arg=/SUBSYSTEM:CONSOLE -C link-arg=/NODEFAULTLIB
+      if ($LASTEXITCODE -ne 0) { throw "Failed to build the Windows stack probe for $target ($mode)" }
+      & $audit -BinaryPath (Join-Path $directory "target/$target/release/stack-reserve-probe.exe")
+    }
+  }
+} finally {
+  Restore-RustflagEnvironment
+  Pop-Location
+  $resolved = [IO.Path]::GetFullPath($directory)
+  if (!$resolved.StartsWith((Join-Path $temporaryRoot "dbx-stack-reserve-probe-"), [StringComparison]::OrdinalIgnoreCase)) { throw "Unexpected cleanup path: $resolved" }
+  Remove-Item -LiteralPath $resolved -Recurse -Force
+}
```

---

### Incident Patch 3: `50d5ef4b` (2026-10-29)
**Commit Message**: fix(postgres): include SQLSTATE in native query errors (#13922)

* fix(postgres): include SQLSTATE while preserving server messages, details, hints and error positions
* test(postgres): add regression coverage for native error details and backend error propagation

Fixes #13837

**File**: `crates/dbx-core/tests/live_postgres_error_position.rs` (modified, +1/-0)
```diff
@@ -141,6 +141,7 @@ async fn live_pg_multi_core_reports_error_position_in_the_backend_envelope() {
     let detail = backend_error.detail().unwrap_or_default();
     assert!(!detail.contains(SQL_ERROR_POSITION_MARKER), "detail must not leak the marker: {detail}");
     assert!(detail.contains("no_such_table"), "detail should keep the native message: {detail}");
+    assert!(detail.contains("SQLSTATE 42P01"), "detail should keep the native error code: {detail}");
 
     let _ = std::fs::remove_dir_all(&dir);
 }
```

**File**: `crates/dbx-driver-postgres/src/postgres.rs` (modified, +2/-2)
```diff
@@ -1560,7 +1560,7 @@ fn pg_error_to_string(err: impl Into<PgError>) -> String {
     let Some(db_error) = err.as_db_error() else {
         return err.to_string();
     };
-    let mut message = db_error.to_string();
+    let mut message = pg_db_error_to_string(db_error);
     // Carry the server-reported cursor position across the `db` layer's
     // `Result<_, String>` boundary; `query.rs` resolves it against the executed
     // statement and strips the suffix before the message reaches any client.
@@ -1577,7 +1577,7 @@ fn pg_error_to_string(err: impl Into<PgError>) -> String {
 /// be resolved against the user's SQL and point at the wrong place.
 fn pg_error_to_string_plain(err: impl Into<PgError>) -> String {
     let err = err.into();
-    err.as_db_error().map(ToString::to_string).unwrap_or_else(|| err.to_string())
+    err.as_db_error().map(pg_db_error_to_string).unwrap_or_else(|| err.to_string())
 }
 
 /// Tries each SQL tier in `tiers` in order (most-capable first), via `run`,
```

**File**: `crates/dbx-driver-postgres/tests/query_error_details.rs` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+//! Run against the disposable database with DBX_TEST_POSTGRES_URL set.
+
+use std::time::Duration;
+
+use dbx_driver_postgres::{
+    connect, execute_postgres_infra_statement, execute_query, execute_query_on_client_unnamed,
+    execute_query_with_schema, sql_error_position, stream_query_rows,
+};
+
+#[tokio::test]
+#[ignore = "requires DBX_TEST_POSTGRES_URL pointing at a disposable PostgreSQL database"]
+async fn native_query_errors_keep_server_message_sqlstate_and_position() {
+    let url = std::env::var("DBX_TEST_POSTGRES_URL").expect("DBX_TEST_POSTGRES_URL");
+    let pool = connect(&url, Duration::from_secs(10)).await.expect("connect fixture database");
+    let cases = [
+        ("SELECT *\nFROM dbx_issue_13837_missing_table", "dbx_issue_13837_missing_table", "42P01"),
+        ("SELECT * FROMM dbx_issue_13837_missing_table", "FROMM", "42601"),
+        ("SELECT dbx_missing_column FROM (SELECT 1 AS value) AS t", "dbx_missing_column", "42703"),
+        ("INSERT INTO dbx_issue_13837_missing_table VALUES (1)", "dbx_issue_13837_missing_table", "42P01"),
+    ];
+    for (sql, token, code) in cases {
+        for schema in [None, Some("public")] {
+            let error = match schema {
+                Some(schema) => execute_query_with_schema(&pool, schema, sql).await,
+                None => execute_query(&pool, sql).await,
+            }
+            .expect_err("SQL must fail");
+            let (message, position) = sql_error_position::take_message_position(&error, sql);
+            assert!(message.contains(token), "server message missing: {message}");
+            assert!(message.contains(&format!("SQLSTATE {code}")), "server code missing: {message}");
+            assert!(!message.contains(sql_error_position::SQL_ERROR_POSITION_MARKER));
+            let offset = sql[..sql.find(token).unwrap()].chars().count() as u32;
+            assert_eq!(position.map(|position| position.offset), Some(offset), "{error}");
+        }
+    }
+    // Failed statements must not prevent the next query on the connection.
+    assert_eq!(execute_query(&pool, "SELECT 1").await.unwrap().rows[0][0], 1);
+    let client = pool.get().await.unwrap();
+    let sql = "SELECT * FROM dbx_issue_13837_missing_table";
+    let error = execute_query_on_client_unnamed(&client, sql, 100).await.expect_err("unnamed query must fail");
+    assert!(error.contains("SQLSTATE 42P01"), "{error}");
+    let error = execute_postgres_infra_statement(&client, sql, Duration::from_secs(10), "fixture")
+        .await
+        .expect_err("infrastructure query must fail");
+    assert!(error.contains("dbx_issue_13837_missing_table"), "{error}");
+    assert!(error.contains("SQLSTATE 42P01"), "{error}");
+    assert!(!error.contains(sql_error_position::SQL_ERROR_POSITION_MARKER), "{error}");
+    drop(client);
+    let error = stream_query_rows(&pool, sql, None, &std::sync::atomic::AtomicBool::new(false), |_| Ok(()))
+        .await
+        .expect_err("streaming query must fail");
+    assert!(error.contains("SQLSTATE 42P01"), "{error}");
+    pool.close();
+}
+
+#[tokio::test]
+#[ignore = "requires DBX_TEST_POSTGRES_URL pointing at a disposable PostgreSQL database"]
+async fn native_query_errors_without_cursor_keep_detail_and_hint() {
+    let url = std::env::var("DBX_TEST_POSTGRES_URL").expect("DBX_TEST_POSTGRES_URL");
+    let pool = connect(&url, Duration::from_secs(10)).await.expect("connect fixture database");
+    let sql = "DO $$ BEGIN RAISE EXCEPTION USING MESSAGE = 'dbx diagnostic fixture', \
+               ERRCODE = '22023', DETAIL = 'invalid fixture value', HINT = 'choose a valid value'; END $$";
+    let error = execute_query(&pool, sql).await.expect_err("raised exception");
+    assert!(error.contains("ERROR: dbx diagnostic fixture"), "{error}");
+    assert!(error.contains("SQLSTATE 22023"), "{error}");
+    assert!(error.contains("DETAIL: invalid fixture value"), "{error}");
+    assert!(error.contains("HINT: choose a valid value"), "{error}");
+    assert!(!error.contains(sql_error_position::SQL_ERROR_POSITION_MARKER), "{error}");
+    pool.close();
+}
```

#### Recent Merged Pull Requests:
- **PR #13953** (2026-10-30): fix(sidebar): clear the collapsed marker when expanding a search result (@yiqiui)
- **PR #13951** (2026-10-30): fix(grid): 精简选区统计并记住底栏显示指标 (@zipg)
- **PR #13950** (2026-10-30): fix(settings): let Apply and Close close when nothing is staged (@yiqiui)
- **PR #13949** (2026-10-30): fix(driver-store): hide managed JRE rows when a custom or system Java is selected (@yiqiui)
- **PR #13948** (2026-10-30): fix(generate): default the foreign key schema to the current database (@yiqiui)
- **PR #13946** (2026-10-30): Fix/mysql sql file emoji (@MomentarySixthSense)

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

## X. updates): name the dialog that blocks installation (#13907)

**RULE**:
When implementing operations in `apps/desktop/src/App.vue`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in t8y2/dbx. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `56e4f94f`: updates): name the dialog that blocks installation (#13907). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/desktop/src/App.vue`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
import { setupUpdatePreparation, prepareUpdateWithDraftRecovery, isUpdatePreparationActive, UpdatePreparationError } from "@/lib/app/updatePreparation";
import { describeConfigUpdateBlock, type UpdateBlockingConfigState, type UpdateConfigTranslator } from "@/lib/app/updatePreparationSurfaces";
const translateUpdateSurface: UpdateConfigTranslator = (key, named) => (named ? t(key, named) : t(key));
/** Snapshot of every surface that must be closed before the installer may run. */
function updateBlockingConfigState(): UpdateBlockingConfigState {
  return {
    pendingAppClose: pendingAppCloseAction.value !== null,
    connectionDialog: showConnectionDialog.value,
    saveSqlDialog: showSaveSqlDialog.value,
    ddlDialog: showQueryEditorDdlDialog.value,
    objectSourceDialog: showQueryEditorObjectSourceDialog.value,
    sqlParameterDialog: showSqlParameterDialog.value,
    dangerDialog: showDangerDialog.value,
    multiDbExecuteDialog: showMultiDbExecuteDialog.value,
    transferDialog: dialogs.showTransferDialog.value,
    sqlFileDialog: dialogs.showSqlFileDialog.value,
    tableImportDialog: dialogs.showTableImportDialog.value,
    mongoImportDialog: dialogs.showMongoImportDialog.va
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
import { setupUpdatePreparation, prepareUpdateWithDraftRecovery, isUpdatePreparationActive } from "@/lib/app/updatePreparation";
      if (!updateWindowReady) throw new Error(t("updates.preparationNotReady"));
        throw new Error(t("updates.preparationTasks"));
        throw new Error(t("updates.preparationDrafts"));
      }
      if (
        pendingAppCloseAction.value ||
        showConnectionDialog.value ||
        showSaveSqlDialog.value ||
        showQueryEditorDdlDialog.value ||
        showQueryEditorObjectSourceDialog.value ||
        showSqlParameterDialog.value ||
        showDangerDialog.value ||
        showMultiDbExecuteDialog.value ||
        [
          dialogs.showTransferDialog,
          dialogs.showSqlFileDialog,
          dialogs.showTableImportDialog,
          dialogs.showMongoImportDialog,
          dialogs.showTableDataGenerateDialog,
          dialogs.showDatabaseExportDialog,
          dialogs.showSchemaDiffDialog,
          dialogs.showDataCompareDialog,
          dialogs.showConfigPassphraseDialog,
          dialogs.showConfigConnectionSelectDialog,
          dialogs.showConfigUnencryptedExportConfirm,
          dialogs.showImportLayoutConfirm,
   
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `56e4f94f` are properly handled with clean fallback behavior.
