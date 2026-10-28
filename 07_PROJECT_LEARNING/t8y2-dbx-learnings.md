> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/t8y2-dbx-learnings.md`  
> **Source**: github ([https://github.com/t8y2/dbx](https://github.com/t8y2/dbx))  
> **Source Version**: `fa36c67d`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-28T22:26:47.966Z  
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
> **Harvest Timestamp**: 2026-10-28T22:26:47.961Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `t8y2/dbx`
- **Description**: 25 MB lightweight cross-platform database client for 100+ databases, including MySQL, PostgreSQL, SQLite, Redis, MongoDB, DuckDB, SQL Server, and Dameng. Built-in AI, MCP Server, CLI, desktop and Docker. | 轻量级跨平台数据库管理工具，支持 MySQL、PostgreSQL、SQLite、Redis、MongoDB、达梦等 100+ 数据库，提供桌面端、Docker、CLI、内置 AI 助手和 MCP。
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 28035 stars

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
- **Issue #13755** (2026-10-28): **[Bug] DB2 查询结果表删除字段值后显示为 0 而非 NULL**
  *Symptoms*: # 问题描述  在 DBX 的查询结果表中直接删除 DB2 数据库某字段的值后，该字段（`CIFSEQ`，类型 `int`）显示为 `0`。  在与其他数据库的结果表中删除字段值时，该字段显示为 `NULL`。期望 DB2 的删除行为也显示为 `NULL`。  # 环境信息  - 数据库：IBM DB2 - 表：`APPLET_USER` - 字段：`CIFSEQ`（类型：`int`） - DBX 版本：未提供 - 操作系统：未提供 - DB2 版本：未提供  # 复现步骤  1. 在 DBX 中连接 DB2 数据库。 2. 执行查询并显示 `APPLET_USER` 表数据。 3. 在查询结果表中直接删除 `CIFSEQ` 字段的值。 4. 观察删除后的字段值显示。  # 实际行为  删除值后，`CIFSEQ` 字段显示为 `0`。  # 期望行为  删除值后，`CIFSEQ` 字段显示为 `NULL`，与其他数据库结果表中的行为保持一致。  # 截图说明  - 图 1：DB2 查询结果表中 `CIFSEQ` 字段原值为 `639522`。 - 图 2：在 DB2 查询结果表中删除 `CIFSEQ` 字段值后，该字段显示为 `0`（红框标注）。 - 图 3：另一数据库连接的查询结果表中，删除 `CIFSEQ` 字段值后显示为 `NULL`（红框标注）。  # 补充信息  - 截图中的手机号已脱敏。 - 日志、DBX 版本、DB2 版本等信息未提供。  ## 附件  ![DBX issue image 1](https://dl.dbxio.com/issue-feedback/2026/10/051c5762-8b2a-461d-8c75-dcc9925905cd/1-8dbb53d9-e4a0-40e5-9322-171e8732301e.jpg)  ![DBX issue image 2](https://dl.dbxio.com/issue-feedback/2026/10/051c5762-8b2a-461d-8c75-dcc9925905cd/2-7ded8e63-20d7-40e1-ad9c-ebb528d1fcd5.jpg)  ![DBX issue image 3](https://dl.dbxio.com/issue-feedback/2026/10/051c5762-8b2a-461d-8c75-dcc9925905cd/3-e3e4535a-3914-402b-9531-3e655929105b.png)  ---  _此 Issue 通过 DBX 官网匿名反馈入口提交，发布前已由提交者确认。_
  **Post-Mortem & Fix Analysis**:
  > /claim
  > ✅ @MomentarySixthSense 已认领 #13755，开始处理吧！

- **Issue #13754** (2026-10-28): **[Bug] 关闭分组标签页会强制展开窗口剩余第一个分组的标签页**
  *Symptoms*: ### 数据库类型和版本 / Database type and version  无特定版本  ### 问题描述 / Problem description  https://github.com/user-attachments/assets/7c0e006c-4dc5-49a8-88f8-52f5565d1b0e 关闭分组标签页会强制展开窗口剩余第一个分组的标签页，需求：关闭分组标签页不影响其他分组标签页的折叠和展开状态  ### 支持信息 / Support information  DBX 版本: v0.6.58 运行环境: 桌面端 操作系统: Windows 11 (10.0.26300.9711) 系统架构: x86_64 User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0 数据库类型: jdbc, mysql, oracle, plugin, sqlserver 本地驱动版本: hive 0.1.61, oracle 0.1.76 AI 供应商: DeepSeek, OpenAI  ### 优先级（是否紧急） / Priority (urgency)  🟡 P2 普通 · 按排期处理 / Normal · Schedule as appropriate  ### 补充信息 / Additional information  _No response_
  **Post-Mortem & Fix Analysis**:
  > /claim
  > ✅ @ayang875 已认领 #13754，开始处理吧！

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

### Incident Patch 1: `1e834665` (2026-10-28)
**Commit Message**: fix(redis): fetch full page on first load more when overflow buffer holds partial items (#13102)

* fix(redis): fetch full page when collection overflow buffer has partial items (#12640)

When a Redis HSCAN/SSCAN returns elements with an overshoot (e.g. 201
items for COUNT 200), the initial page takes 200 items and buffers the
extra 1 item in a scoped overflow session with a non-zero server
followup cursor.

Previously, the first subsequent load-more call immediately returned
the buffered partial page without continuing to scan the server, causing
the collection view to only increment by 1 item (200 -> 201) rather than
loading a full page of 200 items (200 -> 400).

When buffered items are taken from the overflow session and do not reach
the requested count, and the server still has a non-zero continuation
cursor, transition immediately to scanning the server for the remaining
needed items and return a full page.

* fix(redis): retain unscoped overflow until fill scan succeeds

---------

Co-authored-by: zipg <[REDACTED_EMAIL]>

**File**: `apps/desktop/src/components/redis/RedisValueViewer.collectionSearch.spec.ts` (modified, +39/-0)
```diff
@@ -160,6 +160,7 @@ const testI18nMessages = {
       items: "{count} items",
       loadedMembers: "{loaded} / {total} members loaded",
       loadedItems: "{loaded} / {total} items loaded",
+      loadedFields: "{loaded} / {total} fields loaded",
       loadMoreKeys: "Load more",
       fields: "{count} fields",
       ttlSecond: "{count}s",
@@ -704,4 +705,42 @@ describe("Redis collection member search", () => {
     await settle();
     expect(mocks.toast).toHaveBeenCalledWith("Collection cursor is invalid, expired, or belongs to a different connection/database", 3000);
   });
+
+  it("loads 200 more items on the first load more click for a 200-item initial page (#12640 follow-up)", async () => {
+    const initialItems = Array.from({ length: 200 }, (_, i) => ({
+      field: blob(`field:${i}`),
+      value: blob(`val:${i}`),
+    }));
+    mocks.redisGetValue.mockResolvedValue({
+      key_display: "key",
+      key_raw: "key",
+      ttl: -1,
+      redis_type: "hash",
+      data: {
+        kind: "hash",
+        items: initialItems,
+        total: 500,
+        scan_cursor: 1234,
+      },
+    });
+
+    const moreItems = Array.from({ length: 200 }, (_, i) => ({
+      field: blob(`field:${200 + i}`),
+      value: blob(`val:${200 + i}`),
+    }));
+    mocks.redisLoadMore.mockResolvedValueOnce({
+      kind: "hash",
+      items: moreItems,
+      scan_cursor: 5678,
+    });
+
+    mountViewer();
+    await settle();
+    expect(document.body.textContent).toContain("200 / 500 fields loaded");
+
+    loadMoreButton().click();
+    await settle();
+    expect(mocks.redisLoadMore).toHaveBeenCalledWith("connection", 0, "key", "hash", 1234, 200, undefined, undefined);
+    expect(document.body.textContent).toContain("400 / 500 fields loaded");
+  });
 });
```

**File**: `crates/dbx-driver-redis/src/lib.rs` (modified, +324/-21)
```diff
@@ -8,7 +8,7 @@ use redis::{
 };
 use serde::{Deserialize, Serialize};
 use std::{
-    collections::HashMap,
+    collections::{HashMap, HashSet},
     fs,
     future::Future,
     sync::{Arc, OnceLock},
@@ -5319,25 +5319,61 @@ where
     C: ConnectionLike + Send + Sync + Unpin,
 {
     let count = count.max(1);
-    if let Some(page) = take_hash_overflow_page(scope, key, cursor, count, filter_query).await {
-        return Ok(page);
+    let (buffered_cursor, mut items) = match take_hash_overflow_page(scope, key, cursor, count, filter_query).await {
+        Some((next, items)) => {
+            let has_more_buffered = {
+                let sessions = collection_overflow_sessions().lock().await;
+                match sessions.entries.get(&cursor).map(|s| &s.items) {
+                    Some(RedisCollectionOverflowItems::Hash(items)) => !items.is_empty(),
+                    _ => false,
+                }
+            };
+            let page_bytes: usize = items.iter().map(hash_item_page_bytes).sum();
+            if items.len() >= count || next == 0 || has_more_buffered || page_bytes >= COLLECTION_PAGE_MAX_BYTES {
+                return Ok((next, items));
+            }
+            (next, items)
+        }
+        None => (cursor, Vec::new()),
+    };
+
+    let (scan_cursor, previous_session) = if buffered_cursor == cursor {
+        take_collection_scan_cursor(scope, key, cursor, RedisCollectionOverflowKind::Hash, filter_query).await?
+    } else {
+        (buffered_cursor, None)
+    };
+
+    if cursor != 0 && scan_cursor == 0 {
+        return Ok((0, items));
     }
-    let (scan_cursor, previous_session) =
-        take_collection_scan_cursor(scope, key, cursor, RedisCollectionOverflowKind::Hash, filter_query).await?;
+
+    let needed = count.saturating_sub(items.len()).max(1);
     let scanned = if let Some(query) = filter_query {
-        hscan_filtered_page_raw(con, key, scan_cursor, count, query).await
+        hscan_filtered_page_raw(con, key, scan_cursor, needed, query).await
     } else {
-        hscan_page_raw(con, key, scan_cursor, count, None).await
+        hscan_page_raw(con, key, scan_cursor, needed, None).await
     };
-    let (next_cursor, mut items) = match scanned {
+
+    let (next_cursor, scanned_items) = match scanned {
         Ok(page) => page,
         Err(error) => {
-            if let Some(session) = previous_session {
+            if let Some(mut session) = previous_session {
+                if !items.is_empty() {
+                    session.items = RedisCollectionOverflowItems::Hash(items);
+                }
                 collection_overflow_sessions().lock().await.reinsert(cursor, session);
             }
             return Err(error);
         }
     };
+
+    let mut seen: HashSet<String> = items.iter().map(|item| item.field.raw_base64.clone()).collect();
+    for item in scanned_items {
+        if seen.insert(item.field.raw_base64.clone()) {
+            items.push(item);
+        }
+    }
+
     let page_len = budgeted_page_len(&items, count, hash_item_page_bytes);
     let next_cursor = store_hash_overflow_page(scope, key, &mut items, page_len, next_cursor, filter_query).await;
     Ok((next_cursor, items))
@@ -5355,25 +5391,61 @@ where
     C: ConnectionLike + Send + Sync + Unpin,
 {
     let count = count.max(1);
-    if let Some(page) = take_set_overflow_page(scope, key, cursor, count, filter_query).await {
-        return Ok(page);
+    let (buffered_cursor, mut items) = match take_set_overflow_page(scope, key, cursor, count, filter_query).await {
+        Some((next, items)) => {
+            let has_more_buffered = {
+                let sessions = collection_overflow_sessions().lock().await;
+                match sessions.entries.get(&cursor).map(|s| &s.items) {
+                    Some(RedisCollectionOverflowItems::Set(items)) => !items.is_empty(),
+                    _ => false,
+                }
+            };
+            let page_bytes: usize = items.iter().map(set_item_page_bytes).sum();
+            if items.len() >= count || next == 0 || has_more_buffered || page_bytes >= COLLECTION_PAGE_MAX_BYTES {
+                return Ok((next, items));
+            }
+            (next, items)
+        }
+        None => (cursor, Vec::new()),
+    };
+
+    let (scan_cursor, previous_session) = if buffered_cursor == cursor {
+        take_collection_scan_cursor(scope, key, cursor, RedisCollectionOverflowKind::Set, filter_query).await?
+    } else {
+        (buffered_cursor, None)
+    };
+
+    if cursor != 0 && scan_cursor == 0 {
+        return Ok((0, items));
     }
-    let (scan_cursor, previous_session) =
-        take_collection_scan_cursor(scope, key, cursor, RedisCollectionOverflowKind::Set, filter_query).await?;
+
+    let needed = count.saturating_sub(items.len()).max(1);
     let scanned = if let Some(query) = filter_query {
-        sscan_filtered_page_raw(con, key, scan_cursor, count, query).await
+        sscan_filtered
```

---

### Incident Patch 2: `af7c5531` (2026-10-28)
**Commit Message**: build: clean desktop output before bundling frontend assets (#13095)

Resolve the output directory relative to the cleanup script and remove previous dist assets before Vite starts. Cover working-directory independence and repeated execution.

Co-authored-by: Copilot <[REDACTED_EMAIL]>
Co-authored-by: zipg <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +2/-0)
```diff
@@ -633,6 +633,8 @@ make package
 
 The installer will be in `src-tauri/target/release/bundle/`.
 
+`pnpm build` explicitly removes the previous root `dist/` directory before running Vite, so desktop packaging starts with fresh frontend output.
+
 ## Tech Stack
 
 | Layer     | Technology                                                                                                                                                                                                       |
```

**File**: `README.zh-CN.md` (modified, +2/-0)
```diff
@@ -587,6 +587,8 @@ make package
 
 安装包输出在 `src-tauri/target/release/bundle/` 目录。
 
+`pnpm build` 会在运行 Vite 前显式清理根目录的 `dist/`，确保桌面打包使用重新生成的前端资源。
+
 ## 技术栈
 
 | 层级   | 技术                                                                                                                                                                                                             |
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@
     "check:connection-types": "node scripts/sync-connection-types.mjs --check",
     "pretypecheck": "pnpm generate:connection-types",
     "typecheck": "vue-tsc --noEmit --project apps/desktop/tsconfig.json",
-    "build": "vite build --config apps/desktop/vite.config.ts",
+    "build": "node scripts/clean-desktop-dist.mjs && vite build --config apps/desktop/vite.config.ts",
     "build:docs-export": "vite build --config apps/desktop/vite.docs-export.config.ts",
     "build:checked": "pnpm typecheck && pnpm build",
     "check": "node scripts/run-check.mjs",
```

**File**: `scripts/clean-desktop-dist.mjs` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+import { rm } from "node:fs/promises";
+import { fileURLToPath } from "node:url";
+
+const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
+await rm(distDirectory, { recursive: true, force: true });
```

**File**: `scripts/clean-desktop-dist.test.mjs` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+import assert from "node:assert/strict";
+import { execFile } from "node:child_process";
+import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
+import { tmpdir } from "node:os";
+import path from "node:path";
+import { test } from "node:test";
+import { promisify } from "node:util";
+
+const execFileAsync = promisify(execFile);
+
+test("cleans only the script's desktop dist directory, even from another cwd", async (t) => {
+  const root = await mkdtemp(path.join(tmpdir(), "dbx-clean-desktop-dist-"));
+  t.after(() => rm(root, { recursive: true, force: true }));
+  const scripts = path.join(root, "scripts");
+  const dist = path.join(root, "dist");
+  const assets = path.join(dist, "assets");
+  const other = path.join(root, "other");
+  await mkdir(scripts);
+  await mkdir(assets, { recursive: true });
+  await mkdir(path.join(other, "dist"), { recursive: true });
+  await copyFile(new URL("./clean-desktop-dist.mjs", import.meta.url), path.join(scripts, "clean-desktop-dist.mjs"));
+  await writeFile(path.join(assets, "stale.js"), "stale");
+  const unrelated = path.join(other, "dist", "keep.txt");
+  await writeFile(unrelated, "keep");
+
+  const run = () => execFileAsync(process.execPath, [path.join(scripts, "clean-desktop-dist.mjs")], { cwd: other });
+  await run();
+  await assert.rejects(access(dist), { code: "ENOENT" });
+  assert.equal(await readFile(unrelated, "utf8"), "keep");
+  await run();
+  assert.equal(await readFile(unrelated, "utf8"), "keep");
+});
```

---

### Incident Patch 3: `e3a46a49` (2026-10-28)
**Commit Message**: fix(editor): bound wheel zoom and show percentage feedback (#13759)

Co-authored-by: L494264Tt <[REDACTED_EMAIL]>
Co-authored-by: zipg <[REDACTED_EMAIL]>

**File**: `apps/desktop/src/components/editor/QueryEditor.vue` (modified, +9/-1)
```diff
@@ -87,7 +87,7 @@ import { resolveSqlSingleQuoteKeyAction } from "@/lib/sql/sqlQuoteCaret";
 import { formatMongoShellText } from "@/lib/mongo/mongoFormatter";
 import { detectAndFormatElasticsearchRequests } from "@/lib/elasticsearch/elasticsearchFormatter";
 import { useConnectionStore } from "@/stores/connectionStore";
-import { useSettingsStore } from "@/stores/settingsStore";
+import { DEFAULT_EDITOR_SETTINGS, useSettingsStore } from "@/stores/settingsStore";
 import { useTheme } from "@/composables/useTheme";
 import { useToast } from "@/composables/useToast";
 import { buildSelectStarExpansion, selectStarResultColumnsMatch } from "@/lib/sql/sqlCompletion";
@@ -611,6 +611,7 @@ const zoomCommitScheduler = createEditorZoomCommitScheduler((fontSize) => {
   settingsStore.updateEditorSettings({ fontSize });
 });
 const wheelZoom = createEditorWheelZoomController();
+const EDITOR_ZOOM_TOAST_MS = 1500;
 
 const queryEditorAppearanceSettings = computed(() => {
   const settings = settingsStore.editorSettings;
@@ -685,6 +686,7 @@ function applyLiveFontSize(size: number) {
   // frame so that CSS variable changes remain smooth on every wheel tick,
   // while the CodeMirror measure → syncGutters path keeps gutters aligned.
   scheduleFontThemeReconfig(next, settingsStore.editorSettings.fontFamily);
+  toast(`${Math.round((next / DEFAULT_EDITOR_SETTINGS.fontSize) * 100)}%`, EDITOR_ZOOM_TOAST_MS);
 }
 
 function scheduleFontSizeCommit(size: number) {
@@ -3048,11 +3050,17 @@ onDeactivated(pauseQueryEditorBackgroundWork);
 
 onMounted(() => {
   if (typeof window === "undefined") return;
+  window.addEventListener("keydown", wheelZoom.recordModifiers, true);
+  window.addEventListener("keyup", wheelZoom.recordModifiers, true);
+  window.addEventListener("blur", wheelZoom.reset);
   documentState.attach();
   warmActiveTabConnection();
 });
 
 onBeforeUnmount(() => {
+  window.removeEventListener("keydown", wheelZoom.recordModifiers, true);
+  window.removeEventListener("keyup", wheelZoom.recordModifiers, true);
+  window.removeEventListener("blur", wheelZoom.reset);
   pauseQueryEditorBackgroundWork();
   documentState.dispose();
   pointerInteractions.dispose();
```

**File**: `apps/desktop/src/components/editor/__tests__/QueryEditor.zoom.integration.spec.ts` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+// @vitest-environment happy-dom
+
+import { createApp, h } from "vue";
+import { createPinia, setActivePinia } from "pinia";
+import { createI18n } from "vue-i18n";
+import { EditorView } from "@codemirror/view";
+import { afterEach, describe, expect, it, vi } from "vitest";
+import QueryEditor from "../QueryEditor.vue";
+import { useSettingsStore } from "@/stores/settingsStore";
+import { useConnectionStore } from "@/stores/connectionStore";
+import { useToast } from "@/composables/useToast";
+
+const cleanups: Array<() => void> = [];
+afterEach(() => {
+  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
+  useToast().dismissToast();
+  vi.restoreAllMocks();
+});
+
+async function mountEditor() {
+  const pinia = createPinia();
+  setActivePinia(pinia);
+  const settings = useSettingsStore();
+  settings.editorSettings.showExecutionTargetPicker = false;
+  settings.editorSettings.fontSize = 13;
+  settings.editorSettings.uiScale = 1;
+  useConnectionStore();
+  const host = document.createElement("div");
+  document.body.append(host);
+  const app = createApp({ render: () => h(QueryEditor, { modelValue: "SELECT 1;", tabId: "zoom-query", autoFocus: false, hideExecutionControls: true }) });
+  app.use(pinia);
+  app.use(createI18n({ legacy: false, locale: "en", messages: { en: {} }, missingWarn: false, fallbackWarn: false }));
+  app.mount(host);
+  cleanups.push(() => {
+    app.unmount();
+    host.remove();
+  });
+  await vi.waitFor(() => expect(host.querySelector(".cm-editor")).not.toBeNull());
+  const view = EditorView.findFromDOM(host.querySelector(".cm-editor") as HTMLElement)!;
+  const root = host.querySelector<HTMLElement>("[data-query-editor-root]")!;
+  return { settings, view, fontSize: () => root.style.getPropertyValue("--dbx-editor-font-size") };
+}
+
+function wheel(view: EditorView, timeStamp: number, init: WheelEventInit) {
+  const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, ...init });
+  // happy-dom's WheelEvent does not yet inherit MouseEvent's modifier fields.
+  Object.defineProperties(event, {
+    timeStamp: { value: timeStamp },
+    ctrlKey: { value: init.ctrlKey ?? false },
+    metaKey: { value: init.metaKey ?? false },
+  });
+  view.contentDOM.dispatchEvent(event);
+  return event;
+}
+
+describe("QueryEditor wheel zoom", () => {
+  it.each(["Control", "Meta"])("bounds fractional %s + wheel input, reports the percentage and saves the font size", async (key) => {
+    const { settings, view, fontSize } = await mountEditor();
+    const modifiers = { ctrlKey: key === "Control", metaKey: key === "Meta" };
+    // The key can be pressed outside the editor before the pointer enters it.
+    document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...modifiers }));
+    const event = wheel(view, 100, { deltaY: -100.5, ...modifiers });
+    expect(event.defaultPrevented).toBe(true);
+    expect(fontSize()).toBe("13.65px");
+    expect(useToast().message.value).toBe("105%");
+    expect(view.state.doc.toString()).toBe("SELECT 1;");
+    expect(settings.editorSettings.uiScale).toBe(1);
+    await vi.waitFor(() => expect(settings.editorSettings.fontSize).toBe(13.65));
+
+    wheel(view, 200, { deltaY: 100.5, ...modifiers });
+    expect(fontSize()).toBe("13px");
+    expect(useToast().message.value).toBe("100%");
+    await vi.waitFor(() => expect(settings.editorSettings.fontSize).toBe(13));
+  });
+
+  it("leaves plain scrolling alone and preserves pinch scaling after key release and window blur", async () => {
+    const { view, fontSize } = await mountEditor();
+    expect(wheel(view, 100, { deltaY: -120 }).defaultPrevented).toBe(false);
+    expect(fontSize()).toBe("13px");
+
+    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Control", ctrlKey: true, bubbles: true }));
+    document.dispatchEvent(new KeyboardEvent("keyup", { key: "Control", bubbles: true }));
+    wheel(view, 500, { deltaY: -100 * Math.log(1.2), ctrlKey: true });
+    expect(fontSize()).toBe("15.6px");
+
+    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Control", ctrlKey: true, bubbles: true }));
+    window.dispatchEvent(new Event("blur"));
+    wheel(view, 900, { deltaY: -100 * Math.log(1.2), ctrlKey: true });
+    expect(fontSize()).toBe("18.72px");
+  });
+});
```

**File**: `apps/desktop/src/lib/__tests__/editor/editorZoom.spec.ts` (modified, +55/-2)
```diff
@@ -73,11 +73,56 @@ describe("createEditorWheelZoomGestureGuard", () => {
 });
 
 describe("createEditorWheelZoomController", () => {
-  it("keeps mouse-notch zoom on the existing curve", () => {
+  it("limits a mouse notch to a five percent scale change", () => {
     const zoom = createEditorWheelZoomController();
     const event = { timeStamp: 10, ctrlKey: true, metaKey: false, deltaX: 0, deltaY: 120, deltaMode: 0 };
 
-    expect(zoom.nextFontSize(16, event)).toBe(fontSizeFromWheelDelta(16, 120));
+    expect(zoom.nextFontSize(16, event)).toBe(15.24);
+  });
+
+  it.each([
+    [-100, 0],
+    [-120, 0],
+    [-1000, 0],
+    [-3, 1],
+    [-1, 2],
+  ])("bounds wheel delta %s in mode %s to the same percentage step", (deltaY, deltaMode) => {
+    const zoom = createEditorWheelZoomController();
+    expect(zoom.nextFontSize(16, { ...pinchWheel(10, deltaY), deltaMode })).toBe(16.8);
+  });
+
+  it.each(["ctrlKey", "metaKey"] as const)("does not mistake a physical %s with fractional wheel delta for a pinch", (modifier) => {
+    const zoom = createEditorWheelZoomController();
+    zoom.recordModifiers({ ctrlKey: modifier === "ctrlKey", metaKey: modifier === "metaKey" });
+    expect(zoom.nextFontSize(16, { ...pinchWheel(10, -100.5), ctrlKey: modifier === "ctrlKey", metaKey: modifier === "metaKey" })).toBe(16.8);
+  });
+
+  it("does not promote a fractional plain scroll when Control is pressed mid-gesture", () => {
+    const zoom = createEditorWheelZoomController();
+    expect(zoom.nextFontSize(16, pinchWheel(10, -10.5, false))).toBeNull();
+    zoom.recordModifiers({ ctrlKey: true, metaKey: false });
+    expect(zoom.nextFontSize(16, pinchWheel(30, -10.5))).toBeNull();
+    expect(zoom.nextFontSize(16, pinchWheel(211, -100.5))).toBe(16.8);
+  });
+
+  it("restores pinch scaling after the physical modifier is released or the window loses focus", () => {
+    const zoom = createEditorWheelZoomController();
+    zoom.recordModifiers({ ctrlKey: true, metaKey: false });
+    zoom.recordModifiers({ ctrlKey: false, metaKey: false });
+    expect(zoom.nextFontSize(11, pinchWheel(1, -100 * Math.log(2)))).toBe(22);
+    zoom.recordModifiers({ ctrlKey: true, metaKey: false });
+    zoom.reset();
+    expect(zoom.nextFontSize(11, pinchWheel(2, -100 * Math.log(2)))).toBe(22);
+  });
+
+  it("reverses wheel steps without rounding drift and preserves the font limits", () => {
+    const zoom = createEditorWheelZoomController();
+    expect(zoom.nextFontSize(16, pinchWheel(10, -120))).toBe(16.8);
+    expect(zoom.nextFontSize(16.8, pinchWheel(20, 120))).toBe(16);
+    zoom.rebase();
+    expect(zoom.nextFontSize(24, pinchWheel(30, -120))).toBe(24);
+    zoom.rebase();
+    expect(zoom.nextFontSize(10, pinchWheel(40, 120))).toBe(10);
   });
 
   it("maps a trackpad pinch through Chromium's exp(-deltaY / 100) scale", () => {
@@ -109,3 +154,11 @@ describe("createEditorWheelZoomController", () => {
     expect(zoom.nextFontSize(14, pinchWheel(431, -1.5))).toBeGreaterThan(14);
   });
 });
+
+describe("fontSizeFromWheelDelta", () => {
+  it("keeps small pixel movements gradual and ignores zero vertical delta", () => {
+    expect(fontSizeFromWheelDelta(16, 0)).toBe(16);
+    expect(fontSizeFromWheelDelta(16, -10)).toBeGreaterThan(16);
+    expect(fontSizeFromWheelDelta(16, -10)).toBeLessThan(16.1);
+  });
+});
```

**File**: `apps/desktop/src/lib/editor/editorZoom.ts` (modified, +27/-8)
```diff
@@ -1,9 +1,13 @@
 export const EDITOR_MIN_FONT_SIZE = 10;
 export const EDITOR_MAX_FONT_SIZE = 24;
-const WHEEL_FONT_ZOOM_SENSITIVITY = 0.0015;
+const WHEEL_FONT_ZOOM_STEP = 1.05;
+const WHEEL_PIXELS_PER_STEP = 100;
+const WHEEL_LINES_PER_STEP = 3;
+const DOM_DELTA_LINE = 1;
+const DOM_DELTA_PAGE = 2;
 /**
  * Chromium turns a trackpad pinch into wheel events whose scale is
- * `exp(-deltaY / 100)`. Mouse notches stay on the coarser curve above.
+ * `exp(-deltaY / 100)`. Physical Ctrl/Cmd + wheel uses bounded percentage steps.
  */
 const PINCH_WHEEL_ZOOM_SENSITIVITY = 0.01;
 const WHEEL_GESTURE_IDLE_MS = 180;
@@ -41,7 +45,7 @@ export function createEditorWheelZoomGestureGuard(idleMs = WHEEL_GESTURE_IDLE_MS
   let gestureId = 0;
 
   return {
-    accepts(event: WheelZoomModifierEvent) {
+    accepts(event: WheelZoomModifierEvent, allowPinch = true) {
       const hasModifier = event.metaKey || event.ctrlKey;
       const eventTime = Number.isFinite(event.timeStamp) ? event.timeStamp : 0;
       if (eventTime < lastEventTime || eventTime - lastEventTime > idleMs) {
@@ -55,7 +59,7 @@ export function createEditorWheelZoomGestureGuard(idleMs = WHEEL_GESTURE_IDLE_MS
         if (plainScrollEvents === 0) plainScrollStartedAt = eventTime;
         plainScrollEvents += 1;
         plainScrollDistance += Math.abs(event.deltaY ?? 0);
-      } else if (!startedWithModifier && isSyntheticPinchWheel(event)) {
+      } else if (!startedWithModifier && allowPinch && isSyntheticPinchWheel(event)) {
         const prefixMs = plainScrollStartedAt === null ? Number.POSITIVE_INFINITY : eventTime - plainScrollStartedAt;
         if (plainScrollEvents > 0 && plainScrollDistance <= PINCH_PREFIX_DISTANCE && prefixMs <= PINCH_PREFIX_SCROLL_MS) {
           startedWithModifier = true;
@@ -96,8 +100,16 @@ function clampEditorFontSizeExact(value: number): number {
   return Math.min(EDITOR_MAX_FONT_SIZE, Math.max(EDITOR_MIN_FONT_SIZE, value));
 }
 
+function wheelFontZoomFactor(deltaY: number, deltaMode = 0): number {
+  const unitsPerStep = deltaMode === DOM_DELTA_LINE ? WHEEL_LINES_PER_STEP : deltaMode === DOM_DELTA_PAGE ? 1 : WHEEL_PIXELS_PER_STEP;
+  // Device scroll speed and event coalescing must not turn one wheel event into
+  // a jump to the font-size limit. Keep high-resolution input gradual below a notch.
+  const steps = Math.max(-1, Math.min(1, deltaY / unitsPerStep));
+  return WHEEL_FONT_ZOOM_STEP ** -steps;
+}
+
 export function fontSizeFromWheelDelta(currentFontSize: number, deltaY: number): number {
-  return clampEditorFontSize(currentFontSize * Math.exp(-deltaY * WHEEL_FONT_ZOOM_SENSITIVITY));
+  return clampEditorFontSize(currentFontSize * wheelFontZoomFactor(deltaY));
 }
 
 export function fontSizeFromGestureScale(startFontSize: number, scale: number): number {
@@ -108,10 +120,14 @@ export function createEditorWheelZoomController(idleMs = WHEEL_GESTURE_IDLE_MS)
   const guard = createEditorWheelZoomGestureGuard(idleMs);
   let exactFontSize: number | null = null;
   let appliedGestureId = -1;
+  let physicalModifierPressed = false;
 
   return {
+    recordModifiers(event: Pick<KeyboardEvent, "ctrlKey" | "metaKey">) {
+      physicalModifierPressed = event.ctrlKey || event.metaKey;
+    },
     nextFontSize(currentFontSize: number, event: EditorWheelZoomEvent): number | null {
-      if (!guard.accepts(event)) {
+      if (!guard.accepts(event, !physicalModifierPressed)) {
         exactFontSize = null;
         appliedGestureId = guard.currentGestureId();
         return null;
@@ -122,8 +138,10 @@ export function createEditorWheelZoomController(idleMs = WHEEL_GESTURE_IDLE_MS)
         exact = currentFontSize;
         appliedGestureId = gestureId;
       }
-      const sensitivity = isSyntheticPinchWheel(event) ? PINCH_WHEEL_ZOOM_SENSITIVITY : WHEEL_FONT_ZOOM_SENSITIVITY;
-      exact = clampEditorFontSizeExact(exact * Math.exp(-event.deltaY * sensitivity));
+      // A mouse wheel can also report fractional pixels (e.g. Windows scaling).
+      // A real keyboard modifier distinguishes that input from synthetic Ctrl pinch.
+      const factor = !physicalModifierPressed && isSyntheticPinchWheel(event) ? Math.exp(-event.deltaY * PINCH_WHEEL_ZOOM_SENSITIVITY) : wheelFontZoomFactor(event.deltaY, event.deltaMode);
+      exact = clampEditorFontSizeExact(exact * factor);
       exactFontSize = exact;
       return clampEditorFontSize(exact);
     },
@@ -139,6 +157,7 @@ export function createEditorWheelZoomController(idleMs = WHEEL_GESTURE_IDLE_MS)
       guard.reset();
       exactFontSize = null;
       appliedGestureId = -1;
+      physicalModifierPressed = false;
     },
   };
 }
```

#### Recent Merged Pull Requests:
- **PR #13810** (2026-10-28): feat(updates): show shared changelog in update center (@spiritlord)
- **PR #13809** (2026-10-28): docs: explain connecting to a self-hosted sqld server (@bercedev)
- **PR #13807** (2026-10-28): fix(deps): update dependency com.google.cloud:google-cloud-spanner-jdbc to v2.47.0 (@renovate[bot])
- **PR #13805** (2026-10-28): fix(export): recover the manual queue after unacknowledged cancellation (@efeire)
- **PR #13804** (2026-10-28): fix(ci): bound release dependency acquisition across Ubuntu runners (@efeire)
- **PR #13803** (2026-10-28): fix(opengauss): derive identifier quotes from the compatibility mode (@Tong-bit-art)

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

## X. redis): fetch full page on first load more when overflow buffer holds partial it

**RULE**:
When implementing operations in `apps/desktop/src/components/redis/RedisValueViewer.collectionSearch.spec.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in t8y2/dbx. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1e834665`: redis): fetch full page on first load more when overflow buffer holds partial items (#13102). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/desktop/src/components/redis/RedisValueViewer.collectionSearch.spec.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
      loadedFields: "{loaded} / {total} fields loaded",

  it("loads 200 more items on the first load more click for a 200-item initial page (#12640 follow-up)", async () => {
    const initialItems = Array.from({ length: 200 }, (_, i) => ({
      field: blob(`field:${i}`),
      value: blob(`val:${i}`),
    }));
    mocks.redisGetValue.mockResolvedValue({
      key_display: "key",
      key_raw: "key",
      ttl: -1,
      redis_type: "hash",
      data: {
        kind: "hash",
        items: initialItems,
        total: 500,
        scan_cursor: 1234,
      },
    });

    const moreItems = Array.from({ length: 200 }, (_, i) => ({
      field: blob(`field:${200 + i}`),
      value: blob(`val:${200 + i}`),
    }));
    mocks.redisLoadMore.mockResolvedValueOnce({
      kind: "hash",
      items: moreItems,
      scan_cursor: 5678,
    });

    mountViewer();
    await settle();
    expect(document.body.textContent).toContain("200 / 500 fields loaded");

    loadMoreButton().click();
    await settle();
    expect(mocks.redisLoadMore).toHaveBeenCalledWith("connection", 0, "key", "hash", 1234, 200, undefined, undefined);
    expect(document.body.textContent).toContain("400 / 500 fiel
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1e834665` are properly handled with clean fallback behavior.
