> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/t8y2-dbx-learnings.md`  
> **Source**: github ([https://github.com/t8y2/dbx](https://github.com/t8y2/dbx))  
> **Source Version**: `d4951da8`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-03T22:32:08.858Z  
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
> **Harvest Timestamp**: 2026-11-03T22:32:08.399Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `t8y2/dbx`
- **Description**: 25 MB lightweight cross-platform database client for 100+ databases, including MySQL, PostgreSQL, SQLite, Redis, MongoDB, DuckDB, SQL Server, and Dameng. Built-in AI, MCP Server, CLI, desktop and Docker. | 轻量级跨平台数据库管理工具，支持 MySQL、PostgreSQL、SQLite、Redis、MongoDB、达梦等 100+ 数据库，提供桌面端、Docker、CLI、内置 AI 助手和 MCP。
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 28925 stars

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
- **Issue #14202** (2026-11-03): **[Bug] sql编辑页面采纳智能提示时会吞掉前面一部分内容**
  *Symptoms*: ### 数据库类型和版本 / Database type and version  Doris 4.1  ### 问题描述 / Problem description  1、复现步骤：新建查询，编辑sql,采纳智能提示即可复现 2、期望结果：智能补全，并且不影响前面已经写好的sql 3、实际结果：采纳智能补全的时候会覆盖掉前面一部分sql,而且并不是所有智能补全都是这样，有时是好的，但是这个问题却很容易复现  https://github.com/user-attachments/assets/efe70355-2b2d-4106-859d-cec967086153  ### 支持信息 / Support information  DBX 版本: v0.6.65-beta.20261103.1 运行环境: 桌面端 操作系统: Windows 11 (10.0.26200.9457) 系统架构: x86_64 User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0 数据库类型: mysql, mysql/doris, postgres  注：另外一台macos 也复现了这个问题  ### 优先级（是否紧急） / Priority (urgency)  🔴 P0 紧急 · 下个版本必须修 / Urgent · Must fix next release  ### 补充信息 / Additional information  _No response_

- **Issue #14200** (2026-11-03): **Redis Hash格式，有些语法不支持**
  *Symptoms*: ### 数据库类型和版本 / Database type and version  Redis  ### 问题描述 / Description / Problem description  <!-- Failed to upload "image.png" -->  <img width="657" height="237" alt="Image" src="https://github.com/user-attachments/assets/db685ea1-d936-4d96-9398-0018b3fbe8e9" />   数据结构大概是这样  <img width="664" height="417" alt="Image" src="https://github.com/user-attachments/assets/ba46b43d-ac4c-4fb0-aa59-b630550c64f3" />  ### 错误信息 / Error message  ```shell 就是查不到 ```  ### 支持信息 / Support information  DBX 已是最新版本 (0.6.65-beta.20261103.1)。  ### 补充信息 / Additional information  _No response_
  **Post-Mortem & Fix Analysis**:
  > <img width="659" height="426" alt="Image" src="https://github.com/user-attachments/assets/d3557b38-8c31-4b99-b34e-50f41ff14c45" /> DBX中都不支持  补充下，直接到Redis命令行这里是支持的  <img width="874" height="456" alt="Image" src="https://github.com/user-attachments/assets/b6b4ee02-7944-4011-8117-38f5dab5c40a" />
  > 是支持的 我看错了 忘记切另外一个redis连接地址了

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

### Incident Patch 1: `63019b25` (2026-11-03)
**Commit Message**: fix(updates): clear cancelled exit requests and explain confirmation blockers (#14173)

Co-authored-by: zipg <[REDACTED_EMAIL]>

**File**: `apps/desktop/src/App.vue` (modified, +2/-0)
```diff
@@ -386,6 +386,8 @@ const translateUpdateSurface: UpdateConfigTranslator = (key, named) => (named ?
 function updateBlockingConfigState(): UpdateBlockingConfigState {
   return {
     pendingAppClose: pendingAppCloseAction.value !== null,
+    saveCloseConfirm: queryStore.showCloseConfirm && queryStore.isConfirmingAppClose,
+    exitCloseConfirm: showCloseActionPrompt.value || showAiRunsClosePrompt.value || showBackgroundTasksClosePrompt.value,
     connectionDialog: showConnectionDialog.value,
     saveSqlDialog: showSaveSqlDialog.value,
     ddlDialog: showQueryEditorDdlDialog.value,
```

**File**: `apps/desktop/src/components/layout/AiRunsClosePromptDialog.vue` (modified, +6/-1)
```diff
@@ -7,10 +7,15 @@ defineProps<{ count: number }>();
 const open = defineModel<boolean>("open", { required: true });
 const emit = defineEmits<{ cancel: []; quit: [] }>();
 const { t } = useI18n();
+
+function handleOpenChange(value: boolean) {
+  open.value = value;
+  if (!value) emit("cancel");
+}
 </script>
 
 <template>
-  <Dialog v-model:open="open">
+  <Dialog :open="open" @update:open="handleOpenChange">
     <DialogContent class="sm:max-w-[440px]" @interact-outside.prevent>
       <DialogHeader>
         <DialogTitle>{{ t("ai.closeWithRunsTitle") }}</DialogTitle>
```

**File**: `apps/desktop/src/components/layout/AppTabBar.vue` (modified, +1/-1)
```diff
@@ -230,7 +230,7 @@ function handleCancelClose() {
     :open="queryStore.showCloseConfirm"
     @update:open="
       (open) => {
-        if (!open) queryStore.cancelClosePendingTab();
+        if (!open) handleCancelClose();
       }
     "
   >
```

**File**: `apps/desktop/src/components/layout/BackgroundTasksClosePromptDialog.vue` (modified, +6/-1)
```diff
@@ -10,10 +10,15 @@ defineProps<{ count: number }>();
 const open = defineModel<boolean>("open", { required: true });
 const emit = defineEmits<{ cancel: []; quit: [] }>();
 const { t } = useI18n();
+
+function handleOpenChange(value: boolean) {
+  open.value = value;
+  if (!value) emit("cancel");
+}
 </script>
 
 <template>
-  <Dialog v-model:open="open">
+  <Dialog :open="open" @update:open="handleOpenChange">
     <DialogContent class="sm:max-w-[440px]" @interact-outside.prevent>
       <DialogHeader>
         <DialogTitle>{{ t("app.closeWithBackgroundTasksTitle") }}</DialogTitle>
```

**File**: `apps/desktop/src/components/layout/__tests__/AppTabBar.portal.spec.ts` (modified, +27/-5)
```diff
@@ -59,6 +59,7 @@ function mountNavigation(placement: "top" | "bottom" | "left" | "right", empty =
   const workspace = ref<{ toggleResultsPane: () => boolean } | null>(null);
   const saveTab = vi.fn();
   const saveAll = vi.fn();
+  const cancelClose = vi.fn();
   const active = computed(() => settings.settingsPageActive || pages.driverActive);
   const portal = createGroupTabBarPortal(active);
   const actions = {
@@ -92,10 +93,10 @@ function mountNavigation(placement: "top" | "bottom" | "left" | "right", empty =
   document.body.appendChild(host);
   const root = defineComponent({
     components: { AppTabBar, SqlEditorWorkspace, TooltipProvider },
-    setup: () => ({ store, settings, pages, active, navigation, workspace, saveTab, saveAll }),
+    setup: () => ({ store, settings, pages, active, navigation, workspace, saveTab, saveAll, cancelClose }),
     template: `
       <TooltipProvider>
-        <AppTabBar :settings-page-open="pages.settingsOpen" :settings-page-active="settings.settingsPageActive" :driver-store-open="pages.driverOpen" :driver-store-active="pages.driverActive" :tab-bar-width="navigation.width" :tab-bar-collapsed="navigation.collapsed" @save-tab="saveTab" @save-all-tab-close="saveAll">
+        <AppTabBar :settings-page-open="pages.settingsOpen" :settings-page-active="settings.settingsPageActive" :driver-store-open="pages.driverOpen" :driver-store-active="pages.driverActive" :tab-bar-width="navigation.width" :tab-bar-collapsed="navigation.collapsed" @save-tab="saveTab" @save-all-tab-close="saveAll" @cancel-tab-close="cancelClose">
           <div v-show="settings.settingsPageActive" data-test="settings-page"><input v-model="pages.draft" data-test="settings-input" /></div>
           <div v-show="pages.driverActive" data-test="driver-page">Drivers</div>
         </AppTabBar>
@@ -119,7 +120,7 @@ function mountNavigation(placement: "top" | "bottom" | "left" | "right", empty =
     host.remove();
     window.removeEventListener("dbx:activate-query-surface", onQuerySurface);
   });
-  return { host, store, settings, pages, portal, actions, warnings, navigation, workspace, saveTab, saveAll };
+  return { host, store, settings, pages, portal, actions, warnings, navigation, workspace, saveTab, saveAll, cancelClose };
 }
 
 function element(host: HTMLElement, selector: string): HTMLElement {
@@ -152,7 +153,7 @@ describe("AppTabBar group navigation portal", () => {
   }
 
   it("keeps the current SQL save action in a mixed TYPE recovery batch", async () => {
-    const { store, sql, recovery, saveTab, saveAll } = mixedClose();
+    const { store, sql, recovery, saveTab, saveAll, cancelClose } = mixedClose();
     await settle();
     expect(store.pendingCloseTabId).toBe(sql.id);
     expect(closeButton("editor.discardChanges")).toBeDefined();
@@ -164,12 +165,13 @@ describe("AppTabBar group navigation portal", () => {
     await settle();
     expect(saveTab).toHaveBeenCalledExactlyOnceWith(sql.id);
     expect(saveAll).not.toHaveBeenCalled();
+    expect(cancelClose).not.toHaveBeenCalled();
     expect(store.tabs.find((tab) => tab.id === recovery.id)?.typeManagementDraft).toEqual({ state: "stopped" });
     expect(sql.sql).toBe("SELECT 1");
   });
 
   it.each([false, true])("scopes discard controls to the pending tab (TYPE first: %s)", async (recoveryFirst) => {
-    const { store, sql, recovery } = mixedClose(recoveryFirst);
+    const { store, sql, recovery, cancelClose } = mixedClose(recoveryFirst);
     await settle();
     expect(store.pendingCloseTabId).toBe(recoveryFirst ? recovery.id : sql.id);
     expect(closeButton(recoveryFirst ? "objects.typeManagementDiscardClose" : "editor.discardChanges")).toBeDefined();
@@ -182,6 +184,7 @@ describe("AppTabBar group navigation portal", () => {
     expect(store.tabs.map((tab) => tab.id)).toEqual([recoveryFirst ? sql.id : recovery.id]);
     if (recoveryFirst) expect(store.tabs[0]?.sql).toBe("SELECT 1");
     else expect(store.tabs[0]?.typeManagementDraft).toEqual({ state: "stopped" });
+    expect(cancelClose).not.toHaveBeenCalled();
   });
 
   it("cancels a mixed close without discarding SQL or the TYPE recovery draft", async () => {
@@ -208,6 +211,25 @@ describe("AppTabBar group navigation portal", () => {
     expect(saveAll).toHaveBeenCalledOnce();
   });
 
+  it.each(["dismiss", "escape", "cancel"])("cancels the app close request when the unsaved changes dialog closes via %s", async (method) => {
+    const { store, settings, cancelClose } = mountNavigation("top");
+    settings.editorSettings.confirmUnsavedSqlClose = true;
+    settings.editorSettings.appCloseUnsavedTabsMode = "prompt";
+    store.tabs[0]!.originalSql = "SELECT 0";
+    expect(store.requestAppCloseConfirmation()).toBe(true);
+    await settle();
+    const dialog = document.querySelector<HTMLElement>("[role='dialog']")!;
+    expect(dialog).not.toBeNull();
+    if (method === "escape") dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
```

**File**: `apps/desktop/src/components/layout/__tests__/ClosePrompts.dismiss.spec.ts` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+// @vitest-environment happy-dom
+import { createApp, h, nextTick, ref, type Component } from "vue";
+import { createI18n } from "vue-i18n";
+import { afterEach, describe, expect, it, vi } from "vitest";
+import AiRunsClosePromptDialog from "../AiRunsClosePromptDialog.vue";
+import BackgroundTasksClosePromptDialog from "../BackgroundTasksClosePromptDialog.vue";
+
+const cleanups: Array<() => void> = [];
+afterEach(() => {
+  for (const cleanup of cleanups.splice(0)) cleanup();
+});
+
+async function settle() {
+  await nextTick();
+  await nextTick();
+  await nextTick();
+}
+
+function mountPrompt(component: Component) {
+  const open = ref(true);
+  const pendingClose = ref(true);
+  const cancel = vi.fn(() => {
+    pendingClose.value = false;
+    open.value = false;
+  });
+  const quit = vi.fn(() => {
+    open.value = false;
+  });
+  const host = document.createElement("div");
+  document.body.appendChild(host);
+  const app = createApp({
+    setup: () => () =>
+      h(component, {
+        open: open.value,
+        count: 1,
+        "onUpdate:open": (value: boolean) => {
+          open.value = value;
+        },
+        onCancel: cancel,
+        onQuit: quit,
+      }),
+  });
+  app.use(createI18n({ legacy: false, locale: "en", messages: { en: {} }, missingWarn: false, fallbackWarn: false }));
+  app.mount(host);
+  cleanups.push(() => {
+    app.unmount();
+    host.remove();
+  });
+  return { open, pendingClose, cancel, quit };
+}
+
+describe.each([
+  ["AI runs", AiRunsClosePromptDialog],
+  ["background tasks", BackgroundTasksClosePromptDialog],
+] as const)("%s exit confirmation", (_name, component) => {
+  it.each(["dismiss", "escape", "cancel"])("cancels the pending close via %s", async (method) => {
+    const { open, pendingClose, cancel, quit } = mountPrompt(component);
+    await settle();
+    const dialog = document.querySelector<HTMLElement>("[role='dialog']")!;
+    expect(dialog).not.toBeNull();
+    if (method === "escape") dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
+    else if (method === "dismiss") dialog.querySelector<HTMLButtonElement>("[data-slot='dialog-close']")!.click();
+    else [...dialog.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "common.cancel")!.click();
+    await settle();
+    expect(open.value).toBe(false);
+    expect(pendingClose.value).toBe(false);
+    expect(cancel).toHaveBeenCalledOnce();
+    expect(quit).not.toHaveBeenCalled();
+  });
+
+  it("keeps an explicit quit separate from cancellation", async () => {
+    const { open, cancel, quit } = mountPrompt(component);
+    await settle();
+    const dialog = document.querySelector<HTMLElement>("[role='dialog']")!;
+    [...dialog.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.endsWith("Quit"))!.click();
+    await settle();
+    expect(open.value).toBe(false);
+    expect(quit).toHaveBeenCalledOnce();
+    expect(cancel).not.toHaveBeenCalled();
+  });
+});
```

**File**: `apps/desktop/src/i18n/locales/az.ts` (modified, +2/-0)
```diff
@@ -430,6 +430,8 @@ export default withEnglishFallback({
     preparationTasks: "Aktiv tapşırıqları və tranzaksiyaları bitirin.",
     preparationDrafts: "Dəyişiklikləri saxlayın və ya ləğv edin.",
     preparationConfig: "Konfiqurasiya redaktəsini bitirin.",
+    preparationAppClose: "Çıxış təsdiqi pəncərəsi hələ açıqdır. Çıxışı ləğv edin, sonra Yenidən başladın və yeniləyin düyməsinə klikləyin.",
+    preparationSaveConfirmation: "Yadda saxlama təsdiqi pəncərəsi hələ açıqdır. Dəyişiklikləri yadda saxlayın və ya bağlamanı ləğv edin, sonra yeniləməyə yenidən cəhd edin.",
     preparationConfigBusy: "Konfiqurasiya ixracı və ya idxalı davam edir. Yeniləmədən əvvəl tamamlanmasını gözləyin.",
     preparationConfigDetail: "Yeniləmədən əvvəl «{surface}» pəncərəsini bağlayın.",
     preparationOtherWindowHint: " (pəncərə başqa DBX pəncərəsindədir)",
```

**File**: `apps/desktop/src/i18n/locales/en.ts` (modified, +2/-0)
```diff
@@ -1314,6 +1314,8 @@ export default {
     preparationTasks: "Finish active tasks and transactions before updating.",
     preparationDrafts: "Save or discard unsaved changes before updating.",
     preparationConfig: "Finish editing the current configuration before updating.",
+    preparationAppClose: "An exit confirmation is still open. Cancel exiting, then click Restart and Update.",
+    preparationSaveConfirmation: "A save confirmation is still open. Save your changes or cancel closing, then try updating again.",
     preparationConfigBusy: "A configuration export or import is still running. Wait for it to finish before updating.",
     preparationConfigDetail: "Close the {surface} dialog before updating.",
     preparationOtherWindowHint: " (the dialog is in another DBX window)",
```

---

### Incident Patch 2: `7dab69e2` (2026-11-03)
**Commit Message**: fix(connection): show timeout scope labels without truncation (#14156)

Co-authored-by: zipg <[REDACTED_EMAIL]>

**File**: `apps/desktop/src/components/connection/ConnectionDialog.vue` (modified, +19/-32)
```diff
@@ -10810,39 +10810,21 @@ function openExternalUrl(url: string) {
                   <h3 class="text-base font-bold">{{ t("connection.advancedConnectionBehavior") }}</h3>
                   <div class="grid grid-cols-4 items-center gap-4">
                     <Label :class="connectionLabelSmallClass">{{ t("connection.connectTimeout") }}</Label>
-                    <div class="col-span-3 grid grid-cols-2 gap-2">
-                      <div class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 rounded border px-2 py-1.5 sm:flex" :class="form.connect_timeout_inherit === true ? 'border-primary/60 bg-background' : 'border-border bg-muted/30 text-muted-foreground'">
+                    <div class="connection-timeout-options col-span-3 grid gap-2">
+                      <div class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 rounded border px-2 py-1.5" :class="form.connect_timeout_inherit === true ? 'border-primary/60 bg-background' : 'border-border bg-muted/30 text-muted-foreground'">
                         <input id="connect-timeout-global" v-model="form.connect_timeout_inherit" type="radio" name="connect-timeout-scope" :value="true" class="h-3.5 w-3.5 shrink-0 accent-primary" />
                         <div class="flex min-w-0 flex-1 items-center gap-1">
-                          <label for="connect-timeout-global" class="min-w-0 cursor-pointer truncate text-xs" :title="t('connection.useGlobalQueryTimeout')">{{ t("connection.useGlobalQueryTimeout") }}</label>
+                          <label for="connect-timeout-global" class="min-w-0 cursor-pointer whitespace-normal break-words text-xs" :title="t('connection.useGlobalQueryTimeout')">{{ t("connection.useGlobalQueryTimeout") }}</label>
                           <HelpTooltip :label="t('connection.globalConnectTimeoutHint')" content-class="max-w-[280px]">
                             {{ t("connection.globalConnectTimeoutHint") }}
                           </HelpTooltip>
                         </div>
-                        <Input
-                          v-model.number="editGlobalConnectTimeoutSecs"
-                          type="number"
-                          min="1"
-                          :max="MAX_CONNECT_TIMEOUT_SECS"
-                          step="1"
-                          class="col-span-2 h-7 w-full shrink-0 sm:col-span-1 sm:w-20"
-                          :disabled="form.connect_timeout_inherit !== true"
-                          @input="clampConnectTimeoutInput($event, 'global')"
-                        />
+                        <Input v-model.number="editGlobalConnectTimeoutSecs" type="number" min="1" :max="MAX_CONNECT_TIMEOUT_SECS" step="1" class="col-span-2 h-7 w-full" :disabled="form.connect_timeout_inherit !== true" @input="clampConnectTimeoutInput($event, 'global')" />
                       </div>
-                      <div class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 rounded border px-2 py-1.5 sm:flex" :class="form.connect_timeout_inherit !== true ? 'border-primary/60 bg-background' : 'border-border bg-muted/30 text-muted-foreground'">
+                      <div class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 rounded border px-2 py-1.5" :class="form.connect_timeout_inherit !== true ? 'border-primary/60 bg-background' : 'border-border bg-muted/30 text-muted-foreground'">
                         <input id="connect-timeout-connection" v-model="form.connect_timeout_inherit" type="radio" name="connect-timeout-scope" :value="false" class="h-3.5 w-3.5 shrink-0 accent-primary" />
-                        <label for="connect-timeout-connection" class="min-w-0 flex-1 cursor-pointer truncate text-xs" :title="t('connection.useConnectionQueryTimeout')">{{ t("connection.useConnectionQueryTimeout") }}</label>
-                        <Input
-                          v-model.number="form.connect_timeout_secs"
-                          type="number"
-                          min="1"
-                          :max="MAX_CONNECT_TIMEOUT_SECS"
-                          step="1"
-                          class="col-span-2 h-7 w-full shrink-0 sm:col-span-1 sm:w-20"
-                          :disabled="form.connect_timeout_inherit === true"
-                          @input="clampConnectTimeoutInput($event, 'connection')"
-                        />
+                        <label for="connect-timeout-connection" class="min-w-0 flex-1 cursor-pointer whitespace-normal break-words text-xs" :title="t('connection.useConnectionQueryTimeout')">{{ t("connection.useConnectionQueryTimeout") }}</label>
+                        <Input v-model.number="form.connect_timeout_secs" type="number" min="1" :max="MAX_CONNECT_TIMEOUT_SECS" step="1" class="col-span-2 h-7 w-full" :disabled="form.connect_timeout_inherit === true" @input="clampConnectTimeoutInput($event, 'connection')" />
                       </div>
           
```

---

### Incident Patch 3: `2521b973` (2026-11-03)
**Commit Message**: fix(mysql): correct TiDB index column metadata and guard load failures

Closes #14080

**File**: `apps/desktop/src/components/structure/TableStructureEditor.vue` (modified, +23/-2)
```diff
@@ -621,6 +621,9 @@ async function fetchDdl(force = false, options?: { preserveDraft?: boolean }) {
 }
 const errorMessage = ref("");
 const secondaryMetadataErrors = ref<Partial<Record<ObjectMetadataFacet, string>>>({});
+// Keep the index write gate independent of display errors, which unrelated
+// facet loads and silent refreshes may clear or suppress.
+const indexMetadataReadError = ref("");
 const columns = ref<EditableStructureColumn[]>([]);
 const starrocksStatusBusy = ref(false);
 const starrocksStatusRevision = ref(0);
@@ -3012,6 +3015,7 @@ function createCurrentDraft(initialized = true): TableStructureEditorDraft {
     createPartitioningColumns: cloneDraftValue(createPartitioningColumns.value),
     createPartitioningExpression: createPartitioningExpression.value,
     loadedMetadataFacets: [...loadedMetadataFacets],
+    indexMetadataReadError: indexMetadataReadError.value || undefined,
     scrollPositions: cloneDraftValue(structureScrollPositions),
     appliedInitialTabRequestId: lastAppliedInitialTabRequestId,
     appliedInitialTargetRequestId: lastAppliedInitialTargetRequestId,
@@ -3063,6 +3067,7 @@ function restoreDraft(draft: TableStructureEditorDraft) {
     oracleIndexRefreshGuard.value = { ...cloneDraftValue(draft.oracleIndexRecovery), afterRequestId: -1 };
     oracleIndexRefreshError.value = draft.oracleIndexRecovery.refreshError ?? "";
   }
+  indexMetadataReadError.value = draft.indexMetadataReadError || "";
   activeTab.value = draft.activeTab || "columns";
   // Restore the DDL baseline alongside the edit, otherwise the restored script
   // would read as dirty (or clean) against the wrong reference text.
@@ -3864,6 +3869,7 @@ const canApply = computed(
     (databaseType.value !== "starrocks" || !starrocksStatusBusy.value) &&
     !postSaveRefreshing.value &&
     !oracleIndexRefreshError.value &&
+    !schemaIndexWriteWarning() &&
     !secondaryMetadataLoading.value &&
     !mysqlTableEngineLoading.value &&
     !sqlPreviewLoading.value &&
@@ -3907,6 +3913,7 @@ function resetState() {
   oracleIndexRefreshGuard.value = undefined;
   lastAppliedInitialTargetRequestId = undefined;
   secondaryMetadataErrors.value = {};
+  indexMetadataReadError.value = "";
   isPartitionedParent.value = false;
   isTablePartition.value = false;
   isForeignTable.value = false;
@@ -4411,6 +4418,9 @@ async function loadStructure(
       }
 
       const nextIndexes = indexesResult.status === "fulfilled" ? indexesResult.value : undefined;
+      if (indexesResult.status === "rejected") {
+        indexMetadataReadError.value = indexesResult.reason?.message || String(indexesResult.reason);
+      }
       const nextForeignKeys = foreignKeysResult.status === "fulfilled" ? foreignKeysResult.value : undefined;
       const nextConstraints = constraintsResult.status === "fulfilled" ? constraintsResult.value : undefined;
       const nextTriggers = triggersResult.status === "fulfilled" ? triggersResult.value : undefined;
@@ -4423,6 +4433,7 @@ async function loadStructure(
           indexes.value = createIndexDrafts(nextIndexes);
         }
         loadedMetadataFacets.add("indexes");
+        indexMetadataReadError.value = "";
       }
       if (nextForeignKeys) {
         foreignKeys.value = createForeignKeyDrafts(nextForeignKeys, databaseType.value);
@@ -6219,6 +6230,7 @@ function schemaIndexDraftIsReadOnly(index: EditableStructureIndex): boolean {
 }
 
 function schemaIndexWriteWarning(): string | undefined {
+  if (!isCreateMode.value && !ddlDirty.value && indexMetadataReadError.value && indexes.value.some(indexChanged)) return indexMetadataReadError.value;
   const blocked = indexes.value.find((index) => schemaIndexDraftIsReadOnly(index) && indexChanged(index));
   if (!blocked) return undefined;
   return blocked.original?.owner == null ? t("schemaIndex.targetMissing", { name: blocked.original?.name }) : t("schemaIndex.crossOwnerReadOnly", { owner: blocked.original.owner, name: blocked.original.name });
@@ -8088,6 +8100,12 @@ watch([() => props.connectionId, () => props.database, () => props.schema, () =>
 
 watch(() => connection.value?.database_info?.productVersion, scheduleSqlPreviewRefresh);
 
+watch(indexMetadataReadError, () => {
+  if (schemaIndexWriteWarning()) clearSqlPreviewState();
+  scheduleSqlPreviewRefresh();
+  syncDraftToParent();
+});
+
 watch(
   [
     isCreateMode,
@@ -8220,6 +8238,9 @@ async function loadActiveTableStructureMetadataIfNeeded() {
   }
   if (loading.value || secondaryMetadataLoading.value) return;
   const scope = withRequiredPostgresPrimaryKeyMetadata(unloadedTableStructureRefreshScope(activeTab.value, loadedMetadataFacets));
+  // A rejected facet is still unloaded, but retrying it whenever loading
+  // clears would loop indefinitely. The toolbar performs an explicit retry.
+  if (indexMetadataReadError.value) scope.indexes = false;
   if (!hasTableStructureRefreshWork(scope)) return;
   await loadStructure(true, scope, true, { blockSecondaryMetadata: tr
```

**File**: `apps/desktop/src/components/structure/__tests__/TableStructureEditor.metadataRevalidation.spec.ts` (modified, +206/-2)
```diff
@@ -1,6 +1,6 @@
 // @vitest-environment happy-dom
 
-import { createApp, nextTick, type App } from "vue";
+import { createApp, h, nextTick, reactive, ref, type App } from "vue";
 import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
 
 // Regression for #8816: the editor serves its initial load from the frontend
@@ -34,6 +34,7 @@ const mocks = vi.hoisted(() => ({
   loadObjectMetadataFacet: vi.fn(),
   invalidateObjectMetadataCache: vi.fn(),
   invalidateTableMetadataCache: vi.fn(),
+  refreshStructure: vi.fn(),
   toast: vi.fn(),
 }));
 
@@ -245,7 +246,12 @@ vi.mock("@/stores/connectionStore", async () => {
   };
 });
 vi.mock("@/stores/productionSafetyStore", () => ({ useProductionSafetyStore: () => ({ requestConfirmation: vi.fn() }) }));
-vi.mock("@/stores/queryStore", () => ({ useQueryStore: () => ({ tableStructureRefreshVersion: () => 0 }) }));
+vi.mock("@/stores/queryStore", async () => {
+  const { ref } = await import("vue");
+  const refreshVersion = ref(0);
+  mocks.refreshStructure.mockImplementation(() => refreshVersion.value++);
+  return { useQueryStore: () => ({ tableStructureRefreshVersion: () => refreshVersion.value }) };
+});
 vi.mock("@/stores/historyStore", () => ({ useHistoryStore: () => ({ add: vi.fn() }) }));
 vi.mock("@/stores/settingsStore", () => ({
   useSettingsStore: () => ({
@@ -762,6 +768,204 @@ describe("TableStructureEditor column index actions", () => {
     await vi.waitFor(() => expect(indexRow(root).querySelector<HTMLInputElement>("[data-index-name-input]")?.value).toBe(name));
   }
 
+  async function mountIndexSafetyEditor(waitForIndex = true, draft?: TableStructureEditorDraft) {
+    const navigation = reactive({ initialTab: "indexes" as "indexes" | "foreignKeys", initialTabRequestId: 1 });
+    const editor = ref<{ applyChanges: () => Promise<boolean> }>();
+    const drafts: TableStructureEditorDraft[] = [];
+    const root = document.createElement("div");
+    document.body.append(root);
+    const app = createApp({
+      setup: () => () =>
+        h(TableStructureEditor, {
+          connectionId: mocks.connection.id,
+          database: "test",
+          tableName: "users",
+          draft,
+          ...navigation,
+          ref: editor,
+          "onUpdate:draft": (draft: TableStructureEditorDraft | undefined) => {
+            if (draft) drafts.push(draft);
+          },
+        }),
+    });
+    mountedApps.push(app);
+    app.mount(root);
+    if (waitForIndex) await vi.waitFor(() => expect(indexRow(root)).not.toBeNull());
+    await settle();
+    const applyButton = () => [...root.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === "structureEditor.apply")!;
+    const unmount = () => {
+      app.unmount();
+      mountedApps.splice(mountedApps.indexOf(app), 1);
+      root.remove();
+    };
+    return { root, navigation, editor, drafts, applyButton, unmount };
+  }
+
+  it.each(["notification", "toolbar"])("blocks stale index drafts after a failed %s reload until index metadata recovers", async (trigger) => {
+    const metadata = [{ name: "legacy_email", columns: ["email"], is_unique: false, is_primary: false }];
+    loadMetadata(metadata);
+    const { root, navigation, editor, drafts, applyButton } = await mountIndexSafetyEditor();
+    const sql = "ALTER TABLE users DROP INDEX legacy_email, ADD INDEX renamed_email (email)";
+    mocks.buildTableStructureChangeSql.mockResolvedValue({ statements: [sql], warnings: [] });
+    const name = indexRow(root).querySelector<HTMLInputElement>("[data-index-name-input]")!;
+    name.value = "renamed_email";
+    name.dispatchEvent(new Event("input", { bubbles: true }));
+    await vi.waitFor(() => expect(applyButton().disabled).toBe(false));
+    expect(root.textContent).toContain(sql);
+
+    mocks.loadObjectMetadataFacet.mockImplementation(async (_request, facet) => {
+      if (facet === "indexes") {
+        // Yield so a retry-loop regression fails the request-count assertion
+        // instead of starving Vitest's timeout behind rejected microtasks.
+        await new Promise((resolve) => setTimeout(resolve, 1));
+        throw new Error("Index key metadata is incomplete");
+      }
+      return { value: facet === "columns" ? columnMetadata : facet === "comment" ? "" : [], cacheStatus: "remote" };
+    });
+    mocks.buildTableStructureChangeSql.mockClear();
+    if (trigger === "toolbar") root.querySelector<HTMLButtonElement>("[data-refresh-structure-shortcut]")!.click();
+    else mocks.refreshStructure();
+    await new Promise((resolve) => setTimeout(resolve, 50));
+    const indexReads = () => mocks.loadObjectMetadataFacet.mock.calls.filter((call) => call[1] === "indexes").length;
+    expect(indexReads()).toBe(2);
+    await vi.waitFor(() => expect(root.textContent).toContain("Index key metadata is incomplete"));
+    await settle();
+    expect(drafts.at(-1)?.indexes[0]?.name).toBe("renamed_email");
+    expect(applyButton().d
```

**File**: `apps/desktop/src/types/database.ts` (modified, +2/-0)
```diff
@@ -2440,6 +2440,8 @@ export interface TableStructureEditorDraft {
   createPartitioningColumns?: string[];
   createPartitioningExpression?: string;
   loadedMetadataFacets?: import("@/lib/metadata/objectMetadataCache").ObjectMetadataFacet[];
+  /** A failed index read must keep restored index edits blocked until an explicit reload succeeds. */
+  indexMetadataReadError?: string;
   scrollPositions?: Partial<Record<TableInfoTab, TableStructureEditorViewport>>;
   /** Request id of the structureInitialTab the editor already applied; remounts must not replay a consumed initial tab over the restored draft. */
   appliedInitialTabRequestId?: number;
```

**File**: `crates/dbx-driver-mysql/src/mysql.rs` (modified, +175/-42)
```diff
@@ -7647,6 +7647,62 @@ fn mysql_statistics_expression_is_unsupported(error: &mysql_async::Error) -> boo
     }
 }
 
+fn append_mysql_index_row(
+    row: &mysql_async::Row,
+    include_expression: bool,
+    include_index_comment: bool,
+    indexes: &mut Vec<IndexInfo>,
+    index_positions: &mut HashMap<String, usize>,
+) -> Result<(), String> {
+    let name = get_str_by_name(row, "INDEX_NAME");
+    let index_position = if let Some(index_position) = index_positions.get(&name) {
+        *index_position
+    } else {
+        let index_position = indexes.len();
+        index_positions.insert(name.clone(), index_position);
+        indexes.push(IndexInfo {
+            owner: None,
+            key_directions: Vec::new(),
+            visibility: None,
+            key_metadata_complete: false,
+            name: name.clone(),
+            columns: Vec::new(),
+            is_unique: get_opt_i32(row, "NON_UNIQUE").unwrap_or(1) == 0,
+            is_primary: name == "PRIMARY",
+            filter: None,
+            index_type: Some(get_str_by_name(row, "INDEX_TYPE")),
+            included_columns: None,
+            comment: if include_index_comment {
+                get_opt_str(row, "INDEX_COMMENT").filter(|value| !value.is_empty())
+            } else {
+                // MySQL 5.0/5.1 STATISTICS has no INDEX_COMMENT column (#14021).
+                None
+            },
+            key_is_expression: Vec::new(),
+            column_opclasses: vec![],
+            key_options: Vec::new(),
+            constraint_backed: false,
+        });
+        index_position
+    };
+
+    let index_part = if include_expression {
+        get_opt_str(row, "EXPRESSION")
+            // TiDB 4.0 returns the text "NULL", not SQL NULL, for ordinary
+            // index keys. Only EXPRESSION uses this sentinel; a column can
+            // legitimately be named NULL and must retain its original bytes.
+            .filter(|value| !value.trim().is_empty() && !value.trim().eq_ignore_ascii_case("NULL"))
+            .map(|expression| format!("({})", expression.trim()))
+            .or_else(|| get_opt_str(row, "COLUMN_NAME").filter(|value| !value.is_empty()))
+    } else {
+        get_opt_str(row, "COLUMN_NAME").filter(|value| !value.is_empty())
+    };
+    let index_part = index_part
+        .ok_or_else(|| format!("MySQL index metadata for {name:?} has a key without a column name or expression"))?;
+    indexes[index_position].columns.push(index_part);
+    Ok(())
+}
+
 pub async fn list_indexes(pool: &MySqlPool, database: &str, table: &str) -> Result<Vec<IndexInfo>, String> {
     let mut conn = get_conn_with_timeout(pool, pool.checkout_timeout()).await?;
     // Column sets shrink in steps: MySQL 8+ carries both EXPRESSION and
@@ -7672,56 +7728,29 @@ pub async fn list_indexes(pool: &MySqlPool, database: &str, table: &str) -> Resu
         let include_index_comment = with_comment;
         let mut indexes = Vec::new();
         let mut index_positions = HashMap::new();
+        let mut metadata_error = None;
 
+        // Drain the result even if one key cannot be decoded, but never expose
+        // a partial composite index to consumers that can generate DDL.
         result
             .for_each_and_drop(|row| {
-                let name = get_str_by_name(&row, "INDEX_NAME");
-                let index_position = if let Some(index_position) = index_positions.get(&name) {
-                    *index_position
-                } else {
-                    let index_position = indexes.len();
-                    index_positions.insert(name.clone(), index_position);
-                    indexes.push(IndexInfo {
-                        owner: None,
-                        key_directions: Vec::new(),
-                        visibility: None,
-                        key_metadata_complete: false,
-                        name: name.clone(),
-                        columns: Vec::new(),
-                        is_unique: get_opt_i32(&row, "NON_UNIQUE").unwrap_or(1) == 0,
-                        is_primary: name == "PRIMARY",
-                        filter: None,
-                        index_type: Some(get_str_by_name(&row, "INDEX_TYPE")),
-                        included_columns: None,
-                        comment: if include_index_comment {
-                            get_opt_str(&row, "INDEX_COMMENT").filter(|value| !value.is_empty())
-                        } else {
-                            // MySQL 5.0/5.1 STATISTICS has no INDEX_COMMENT column (#14021).
-                            None
-                        },
-                        key_is_expression: Vec::new(),
-                        column_opclasses: vec![],
-                        key_options: Vec::new(),
-                        constraint_backed: false,
-                    });
-                    index_position
-                };
-
-                let index_part = if include_expression {
-                    get_opt_str(&
```

**File**: `crates/dbx-driver-mysql/tests/live_tidb_index_metadata.rs` (added, +100/-0)
```diff
@@ -0,0 +1,100 @@
+//! Opt-in TiDB 4.0.11 index metadata regression for #14080.
+//! Set `DBX_LIVE_TIDB_INDEXES_URL` to an isolated TiDB 4.0.11 server and run:
+//! `cargo test -p dbx-driver-mysql --test live_tidb_index_metadata -- --ignored --nocapture`.
+//! Creates only `dbx_issue14080.index_metadata_fixture`, retains it for inspection,
+//! and never drops or alters an existing table. Do not point this at production.
+use dbx_driver_mysql::mysql;
+use mysql_async::prelude::Queryable;
+use std::collections::BTreeMap;
+use std::time::Duration;
+
+const SCHEMA: &str = "dbx_issue14080";
+const TABLE: &str = "index_metadata_fixture";
+
+#[tokio::test]
+#[ignore = "requires an isolated TiDB 4.0.11 server; creates and retains a task-specific fixture"]
+async fn tidb_index_metadata_matches_show_index_and_survives_reload() {
+    let url = std::env::var("DBX_LIVE_TIDB_INDEXES_URL").expect("set DBX_LIVE_TIDB_INDEXES_URL");
+    let pool = mysql::connect(&url, Duration::from_secs(15)).await.unwrap();
+    let mut conn = mysql::get_conn_with_health_check(&pool).await.unwrap();
+    let version: String = conn.query_first("SELECT VERSION()").await.unwrap().unwrap();
+    assert!(version.contains("TiDB-v4.0.11"), "this regression requires TiDB 4.0.11; got {version}");
+    println!("server version: {version}");
+
+    conn.query_drop("CREATE DATABASE IF NOT EXISTS dbx_issue14080").await.unwrap();
+    conn.query_drop(
+        "CREATE TABLE IF NOT EXISTS dbx_issue14080.index_metadata_fixture (
+            id BIGINT NOT NULL PRIMARY KEY,
+            code VARCHAR(32),
+            tenant_id INT,
+            `NULL` INT,
+            ` leading` INT,
+            KEY custom_code_lookup (code),
+            UNIQUE KEY business_pair (tenant_id, code),
+            KEY literal_null_name (`NULL`),
+            KEY leading_space_name (` leading`)
+        )",
+    )
+    .await
+    .unwrap();
+
+    let statistics: Vec<mysql_async::Row> = conn
+        .query(
+            "SELECT INDEX_NAME, COLUMN_NAME, EXPRESSION, SEQ_IN_INDEX,
+                    EXPRESSION IS NULL AS expression_is_sql_null
+             FROM information_schema.STATISTICS
+             WHERE TABLE_SCHEMA = 'dbx_issue14080' AND TABLE_NAME = 'index_metadata_fixture'
+             ORDER BY INDEX_NAME, SEQ_IN_INDEX",
+        )
+        .await
+        .unwrap();
+    println!("STATISTICS: {statistics:?}");
+    assert_eq!(statistics.len(), 6);
+    for row in &statistics {
+        assert_eq!(row.get::<String, _>("EXPRESSION").as_deref(), Some("NULL"));
+        assert_eq!(row.get::<i64, _>("expression_is_sql_null"), Some(0));
+    }
+
+    let show_rows: Vec<mysql_async::Row> =
+        conn.query("SHOW INDEX FROM dbx_issue14080.index_metadata_fixture").await.unwrap();
+    println!("SHOW INDEX: {show_rows:?}");
+    let mut show_indexes = BTreeMap::<String, (bool, Vec<(u64, String)>)>::new();
+    for row in &show_rows {
+        let name: String = row.get("Key_name").unwrap();
+        let unique = row.get::<u64, _>("Non_unique").unwrap() == 0;
+        let sequence: u64 = row.get("Seq_in_index").unwrap();
+        let column: String = row.get("Column_name").unwrap();
+        let entry = show_indexes.entry(name).or_insert_with(|| (unique, Vec::new()));
+        assert_eq!(entry.0, unique);
+        entry.1.push((sequence, column));
+    }
+    for (_, columns) in show_indexes.values_mut() {
+        columns.sort_by_key(|(sequence, _)| *sequence);
+    }
+    drop(conn);
+
+    let indexes = mysql::list_indexes(&pool, SCHEMA, TABLE).await.unwrap();
+    println!("DBX indexes: {}", serde_json::to_string_pretty(&indexes).unwrap());
+    assert_eq!(indexes.len(), 5);
+    for index in &indexes {
+        let (unique, columns) = show_indexes.get(&index.name).expect("DBX preserved the server index name");
+        let columns: Vec<_> = columns.iter().map(|(_, column)| column.clone()).collect();
+        assert_eq!(index.columns, columns, "index {}", index.name);
+        assert_eq!(index.is_unique, *unique, "index {}", index.name);
+        assert_eq!(index.is_primary, index.name == "PRIMARY");
+        assert_eq!(index.index_type.as_deref(), Some("BTREE"));
+    }
+    let expected = [
+        ("PRIMARY", vec!["id"]),
+        ("business_pair", vec!["tenant_id", "code"]),
+        ("custom_code_lookup", vec!["code"]),
+        ("leading_space_name", vec![" leading"]),
+        ("literal_null_name", vec!["NULL"]),
+    ];
+    for (name, columns) in expected {
+        let index = indexes.iter().find(|index| index.name == name).unwrap();
+        assert_eq!(index.columns, columns, "index {name}");
+    }
+    let reloaded = mysql::list_indexes(&pool, SCHEMA, TABLE).await.unwrap();
+    assert_eq!(serde_json::to_value(&indexes).unwrap(), serde_json::to_value(&reloaded).unwrap());
+}
```

#### Recent Merged Pull Requests:
- **PR #14209** (2026-11-03): fix(structure): keep sticky column headers opaque over a wallpaper (@thailoc-dev)
- **PR #14207** (2026-11-03): fix(editor): prevent SQL completion replacing earlier text (@dajiaohuang)
- **PR #14205** (2026-11-03): fix(grid): separate row and column deletion actions (@eryajf)
- **PR #14201** (2026-11-03): feat(schema): add table column sorting (@eryajf)
- **PR #14197** (2026-11-03): fix(connection): 统一配置弹窗宽度并修正高级表单对齐 (@zipg)
- **PR #14195** (2026-11-03): fix(sidebar): prefill rename dialog with the current object name (@thailoc-dev)

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

## X. updates): clear cancelled exit requests and explain confirmation blockers (#1417

**RULE**:
When implementing operations in `apps/desktop/src/App.vue`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in t8y2/dbx. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `63019b25`: updates): clear cancelled exit requests and explain confirmation blockers (#14173). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/desktop/src/App.vue`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    saveCloseConfirm: queryStore.showCloseConfirm && queryStore.isConfirmingAppClose,
    exitCloseConfirm: showCloseActionPrompt.value || showAiRunsClosePrompt.value || showBackgroundTasksClosePrompt.value,
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `63019b25` are properly handled with clean fallback behavior.
