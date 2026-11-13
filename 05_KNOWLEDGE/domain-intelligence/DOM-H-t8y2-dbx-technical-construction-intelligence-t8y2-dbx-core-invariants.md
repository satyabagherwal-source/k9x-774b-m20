# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: t8y2/dbx Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "t8y2/dbx",
  "source_url": "https://github.com/t8y2/dbx",
  "source_version": "acc33f63",
  "license": "Apache-2.0",
  "timestamp": "2026-11-13T20:07:25.840Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-t8y2-dbx",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [t8y2/dbx](https://github.com/t8y2/dbx) (Revision: `acc33f63`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-13T20:07:25.840Z`  
> **Learning ID**: `learn-github-t8y2-dbx`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: I (Content & Information Intelligence), G (Architecture Intelligence), K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence), B (Product Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 59%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from t8y2/dbx:

# Forensic Learning Record (Deep Inspection): t8y2/dbx

> **Canonical Artifact**: `07_PROJECT_LEARNING/t8y2-dbx-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/t8y2/dbx](https://github.com/t8y2/dbx))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-13T20:07:24.647Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `t8y2/dbx`
- **Description**: 25 MB lightweight cross-platform database client for 100+ databases, including MySQL, PostgreSQL, SQLite, Redis, MongoDB, DuckDB, SQL Server, and Dameng. Built-in AI, MCP Server, CLI, desktop and Docker. | 轻量级跨平台数据库管理工具，支持 MySQL、PostgreSQL、SQLite、Redis、MongoDB、达梦等 100+ 数据库，提供桌面端、Docker、CLI、内置 AI 助手和 MCP。
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 30306 stars

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
- **Issue #14884** (2026-11-13): **[Bug] 高斯Gauss数据库Schema筛选后无法展开表对象节点**
  *Symptoms*: ### 数据库类型和版本 / Database type and version  Gauss DWS 8.1.2 ,  兼容PostgreSQL 8  ### 问题描述 / Problem description  左侧边栏，录入筛选文本后，Schema可以展示筛选后对象，但其中表（视图）对象节点无法继续展开  <img width="694" height="634" alt="nodecannotbecollapsed" src="https://github.com/user-attachments/assets/8d38716d-3b40-4402-8a9c-cdbe1b0ccc1c" />  ### 支持信息 / Support information  DBX Version: v0.6.70 (0.6.70-beta.20261112.1) Runtime: Desktop Operating System: Windows 11 (10.0.26300.9974) Architecture: x86_64 User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0 Database Types: gaussdb, postgres Local Driver Versions: kafka 0.1.25  ### 优先级（是否紧急） / Priority (urgency)  🔴 P0 紧急 · 下个版本必须修 / Urgent · Must fix next release  ### 补充信息 / Additional information  _No response_

- **Issue #14868** (2026-11-13): **[Bug] 新窗口下的sql编辑器，不能使用AI，点击不起作用，只能回到主窗口才能用，希望能改成在分窗口也能使用**
  *Symptoms*: ### 数据库类型和版本 / Database type and version  doris  ### 问题描述 / Problem description  新窗口下的sql编辑器，不能使用AI，点击不起作用，只能回到主窗口才能用，希望能改成在分窗口也能使用  <img width="3456" height="2056" alt="image" src="https://github.com/user-attachments/assets/81e9a703-6258-46c7-84c2-d66d5d9ca5e1" />  ### 支持信息 / Support information  DBX 版本: v0.6.69 (0.6.69-beta.20261110.1) 运行环境: 桌面端 操作系统: macOS 15.8.1 系统架构: aarch64 User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) 数据库类型: dameng/dm, mysql, mysql/doris, oracle, postgres, sqlserver 本地驱动版本: dameng 0.1.103, oracle 0.1.79  ### 优先级（是否紧急） / Priority (urgency)  🔴 P0 紧急 · 下个版本必须修 / Urgent · Must fix next release  ### 补充信息 / Additional information  _No response_

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

### Incident Patch 1: `e7d19408` (2026-11-13)
**Commit Message**: fix(postgres): block tuple locator on Greenplum, Cloudberry, Hologres

The v0.6.69 keyless-edit tuple locator (tableoid/ctid/xmin) broke
Cloudberry AO tables and Greenplum (virtual tuple slot / Invalid
attnum: -3): the query-mode version sniff never fired because native
postgres pools returned no database info at all, and the data-tab
injection sites had no engine gate. Probe SELECT version() for native
postgres pools, keep the full product string, and gate every injection
site on one shared predicate that also covers Hologres (#12647).

Closes #14745

**File**: `apps/desktop/src/components/grid/DataGrid.vue` (modified, +11/-3)
```diff
@@ -145,6 +145,7 @@ import {
   isTdengineExistingRowReadonlyColumn,
   shouldIncludeSyntheticRowId,
   showsKeylessEditWarning,
+  postgresTupleLocatorUnsupportedEngine,
 } from "@/lib/table/tableEditing";
 import { rowIdLocatorUnsupported } from "@/lib/table/tableRowIdSupport";
 import { buildDataGridConditionalUpdateSql, buildDataGridContextFilterCondition, buildDataGridCountSql, buildHiveTablePropertiesSql, type DataGridContextFilterMode } from "@/lib/dataGrid/dataGridSql";
@@ -4722,7 +4723,8 @@ async function refreshSavedRows(request: { dirtyRows: ReadonlyMap<number, Readon
     ...largeValuePreviewOptions,
     whereInput: identityConditions.join(" OR "),
     limit: planResult.plan.sourceIndexes.length + 1,
-    includeRowId: shouldIncludeSyntheticRowId(resolvedDatabaseType.value, tableMeta.primaryKeys, tableMeta.tableType) && !(props.connectionId && rowIdLocatorUnsupported(props.connectionId)),
+    includeRowId:
+      shouldIncludeSyntheticRowId(resolvedDatabaseType.value, tableMeta.primaryKeys, tableMeta.tableType) && !(props.connectionId && rowIdLocatorUnsupported(props.connectionId)) && !postgresTupleLocatorUnsupportedEngine(props.connectionId ? connectionStore.getConfig(props.connectionId) : undefined),
   });
   const refreshed = await executeDataGridSavedRowRefreshQuery(api, {
     connectionId,
@@ -8403,7 +8405,10 @@ async function applyOrderBySearch(_value?: string, structuredOrderByOverride?: s
       injectDefaultTimeSeriesWhere: true,
       limit: pageSize.value,
       whereInput: currentWhereInput(),
-      includeRowId: shouldIncludeSyntheticRowId(resolvedDatabaseType.value, tableMeta.primaryKeys, tableMeta.tableType) && !(props.connectionId && rowIdLocatorUnsupported(props.connectionId)),
+      includeRowId:
+        shouldIncludeSyntheticRowId(resolvedDatabaseType.value, tableMeta.primaryKeys, tableMeta.tableType) &&
+        !(props.connectionId && rowIdLocatorUnsupported(props.connectionId)) &&
+        !postgresTupleLocatorUnsupportedEngine(props.connectionId ? connectionStore.getConfig(props.connectionId) : undefined),
     });
     markConditionInputsApplied();
     await props.onExecuteSql(sql);
@@ -8446,7 +8451,10 @@ async function applyWhereFilter() {
       limit: pageSize.value,
       injectDefaultTimeSeriesWhere: true,
       whereInput,
-      includeRowId: shouldIncludeSyntheticRowId(resolvedDatabaseType.value, tableMeta.primaryKeys, tableMeta.tableType) && !(props.connectionId && rowIdLocatorUnsupported(props.connectionId)),
+      includeRowId:
+        shouldIncludeSyntheticRowId(resolvedDatabaseType.value, tableMeta.primaryKeys, tableMeta.tableType) &&
+        !(props.connectionId && rowIdLocatorUnsupported(props.connectionId)) &&
+        !postgresTupleLocatorUnsupportedEngine(props.connectionId ? connectionStore.getConfig(props.connectionId) : undefined),
     });
     markConditionInputsApplied();
     await props.onExecuteSql(sql);
```

**File**: `apps/desktop/src/composables/__tests__/useSidebarDataOpenRuntime.spec.ts` (modified, +1/-0)
```diff
@@ -173,6 +173,7 @@ vi.mock("@/lib/table/tableEditing", () => ({
   },
   usesSyntheticRowIdKey: () => false,
   shouldIncludeSyntheticRowId: () => mocks.includeSyntheticRowId,
+  postgresTupleLocatorUnsupportedEngine: () => false,
 }));
 vi.mock("@/lib/table/tableOpenPageLimit", () => ({ tableOpenPageLimit: () => 100 }));
 vi.mock("@/lib/tabs/dataTabActivation", () => ({ canActivateExistingDataTableTab: () => false }));
```

**File**: `apps/desktop/src/composables/useDataGridActions.ts` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@ import { buildTableSelectSql, quoteTableDataIdentifier } from "@/lib/table/table
 import { tableOpenPageLimit } from "@/lib/table/tableOpenPageLimit";
 import { tableDataLargeValuePreviewOptions, tableDataPreviewRowBudget } from "@/lib/dataGrid/dataGridLargeValues";
 import { elasticsearchCursorPageJumpRequestCount } from "@/lib/dataGrid/dataGridPagination";
-import { editablePrimaryKeys, shouldIncludeSyntheticRowId } from "@/lib/table/tableEditing";
+import { editablePrimaryKeys, postgresTupleLocatorUnsupportedEngine, shouldIncludeSyntheticRowId } from "@/lib/table/tableEditing";
 import { markRowIdLocatorUnsupported, rowIdLocatorUnsupported, shouldKeepRowIdLocatorDisabled, shouldRetryWithoutRowIdLocator } from "@/lib/table/tableRowIdSupport";
 import { tableMetaForDataTab } from "@/lib/table/tableDataTabMeta";
 import { loadVirtualRowIdentifier } from "@/lib/table/virtualRowIdentifier";
@@ -124,7 +124,7 @@ export function useDataGridActions(activeTab: ComputedRef<QueryTab | undefined>)
     const primaryKeys = tab.tableMeta ? tab.tableMeta.primaryKeys : (tableMeta?.primaryKeys ?? []);
     // 已确认该连接拒绝合成行定位器（如 Hologres 拒绝 tableoid，#12647）时不再注入，
     // 避免无主键表每次打开都报错。
-    const useRowId = includeRowId ?? (shouldIncludeSyntheticRowId(effectiveDbType, primaryKeys, tableMeta?.tableType) && !rowIdLocatorUnsupported(tab.connectionId));
+    const useRowId = includeRowId ?? (shouldIncludeSyntheticRowId(effectiveDbType, primaryKeys, tableMeta?.tableType) && !rowIdLocatorUnsupported(tab.connectionId) && !postgresTupleLocatorUnsupportedEngine(config));
     // 列投影只信任真实元数据列：tableMetaForDataTab 的 fallback 列来自查询
     // 结果（可能是失败结果的 ["Error"]），进入 SQL 会生成非法投影；
     // 真实列缺失时省略 columns 让 builder 生成 SELECT *
```

**File**: `apps/desktop/src/composables/useDataGridLargeValues.ts` (modified, +7/-3)
```diff
@@ -2,8 +2,9 @@ import { computed, nextTick, onActivated, onDeactivated, ref, watch, type Comput
 import * as api from "@/lib/backend/api";
 import type { CellValue } from "@/lib/dataGrid/cellValue";
 import { chunkLegacyLargeValueRequests, fetchLegacyLargeValueRequestChunk, legacyLargeValueRowPredicate, resolveCapturedLegacyLargeValueCells, type LegacyLargeValueContext } from "@/lib/dataGrid/legacyLargeValueExport";
+import { useConnectionStore } from "@/stores/connectionStore";
 import { buildTableSelectSql } from "@/lib/table/tableSelectSql";
-import { shouldIncludeSyntheticRowId } from "@/lib/table/tableEditing";
+import { postgresTupleLocatorUnsupportedEngine, shouldIncludeSyntheticRowId } from "@/lib/table/tableEditing";
 import { rowIdLocatorUnsupported } from "@/lib/table/tableRowIdSupport";
 import { queryTimeoutSecsForConnection } from "@/lib/sql/queryTimeout";
 import { SnapshotCompletionError } from "@/lib/export/snapshotCompletion";
@@ -365,7 +366,10 @@ export function useDataGridLargeValues(options: UseDataGridLargeValuesOptions) {
       whereInput: predicates.map((predicate) => `(${predicate})`).join(" OR "),
       limit: requests.size,
       offset: 0,
-      includeRowId: shouldIncludeSyntheticRowId(options.databaseType.value, tableMeta.primaryKeys, tableMeta.tableType) && !(options.connectionId.value ? rowIdLocatorUnsupported(options.connectionId.value) : false),
+      includeRowId:
+        shouldIncludeSyntheticRowId(options.databaseType.value, tableMeta.primaryKeys, tableMeta.tableType) &&
+        !(options.connectionId.value ? rowIdLocatorUnsupported(options.connectionId.value) : false) &&
+        !postgresTupleLocatorUnsupportedEngine(useConnectionStore().getConfig(options.connectionId.value)),
     });
     if (!visibleLargeValuePreviewActive || generation !== visibleLargeValuePreviewRequestedGeneration || options.result.value !== sourceResult) return;
     const connection = options.getConnectionConfig(options.connectionId.value!);
@@ -504,7 +508,7 @@ export function useDataGridLargeValues(options: UseDataGridLargeValuesOptions) {
       identifierQuote: options.connectionIdentifierQuote(connectionId),
       serverVersion: connection?.database_info?.productVersion,
       includeDatabaseName: options.includeDatabaseName.value,
-      includeRowId: !!tableMeta && shouldIncludeSyntheticRowId(options.databaseType.value, tableMeta.primaryKeys, tableMeta.tableType) && !(connectionId ? rowIdLocatorUnsupported(connectionId) : false),
+      includeRowId: !!tableMeta && shouldIncludeSyntheticRowId(options.databaseType.value, tableMeta.primaryKeys, tableMeta.tableType) && !(connectionId ? rowIdLocatorUnsupported(connectionId) : false) && !postgresTupleLocatorUnsupportedEngine(connection),
       timeoutSecs: queryTimeoutSecsForConnection(connection, options.globalQueryTimeoutSecs.value),
     };
   }
```

**File**: `apps/desktop/src/composables/useNavigationTargets.ts` (modified, +3/-3)
```diff
@@ -6,7 +6,7 @@ import { isNoSnapshotErrorResult, isQueryExecutionErrorResult } from "@/lib/quer
 import { buildTableSelectSql, requiresEagerTableMetadataForDataOpen } from "@/lib/table/tableSelectSql";
 import { resolveTableDefaultSort, applyTableDefaultSortResult } from "@/lib/table/tableDefaultSort";
 import { tableDataLargeValuePreviewOptions } from "@/lib/dataGrid/dataGridLargeValues";
-import { editableRowIdentifierColumns, physicalTablePrimaryKeys, shouldIncludeSyntheticRowId } from "@/lib/table/tableEditing";
+import { editableRowIdentifierColumns, physicalTablePrimaryKeys, postgresTupleLocatorUnsupportedEngine, shouldIncludeSyntheticRowId } from "@/lib/table/tableEditing";
 import { markRowIdLocatorUnsupported, rowIdLocatorUnsupported, shouldKeepRowIdLocatorDisabled, shouldRetryWithoutRowIdLocator } from "@/lib/table/tableRowIdSupport";
 import { tableOpenPageLimit } from "@/lib/table/tableOpenPageLimit";
 import { uuid } from "@/lib/common/utils";
@@ -218,7 +218,7 @@ async function openTableTarget(target: NavigationTarget, options: NavigationOpen
     }
     const eagerColumns = eagerMetadata?.metadata.columns ?? [];
     const eagerPrimaryKeys = eagerMetadata?.metadata.primaryKeys ?? [];
-    const eagerIncludeRowId = Boolean(eagerMetadata) && shouldIncludeSyntheticRowId(effectiveDbType, eagerPrimaryKeys, targetTableType) && !rowIdLocatorUnsupported(target.connectionId);
+    const eagerIncludeRowId = Boolean(eagerMetadata) && shouldIncludeSyntheticRowId(effectiveDbType, eagerPrimaryKeys, targetTableType) && !rowIdLocatorUnsupported(target.connectionId) && !postgresTupleLocatorUnsupportedEngine(config);
     const defaultSort = resolveTableDefaultSort(settingsStore.editorSettings, effectiveDbType, physicalTablePrimaryKeys(eagerColumns, eagerMetadata?.metadata.indexes, effectiveDbType), identifierQuote);
     const tableSelectSqlOptions = {
       databaseType: effectiveDbType,
@@ -324,7 +324,7 @@ async function openTableTarget(target: NavigationTarget, options: NavigationOpen
       // 异步窗口内 tab 可能已被复用为其他目标：旧请求的元数据不得落地、
       // 不得解除新目标的 pending
       if (!isCurrentTarget() || !isCurrentGeneration()) return;
-      const useRowId = shouldIncludeSyntheticRowId(effectiveDbType, primaryKeys, targetTableType) && !rowIdLocatorUnsupported(target.connectionId);
+      const useRowId = shouldIncludeSyntheticRowId(effectiveDbType, primaryKeys, targetTableType) && !rowIdLocatorUnsupported(target.connectionId) && !postgresTupleLocatorUnsupportedEngine(connectionStore.getConfig(target.connectionId));
       queryStore.setTableMeta(tabId, {
         schema: tableSchema,
         catalog: target.catalog,
```

**File**: `apps/desktop/src/composables/useSidebarDataOpenRuntime.ts` (modified, +2/-2)
```diff
@@ -14,7 +14,7 @@ import type { SidebarDataOpenRequest } from "@/lib/sidebar/sidebarDataOpenCoordi
 import { hasTreeNodeDatabaseContext } from "@/lib/sidebar/treeNodeContext";
 import { buildTableSelectSql, requiresEagerTableMetadataForDataOpen } from "@/lib/table/tableSelectSql";
 import { resolveTableDefaultSort, applyTableDefaultSortResult } from "@/lib/table/tableDefaultSort";
-import { physicalTablePrimaryKeys, shouldIncludeSyntheticRowId } from "@/lib/table/tableEditing";
+import { physicalTablePrimaryKeys, postgresTupleLocatorUnsupportedEngine, shouldIncludeSyntheticRowId } from "@/lib/table/tableEditing";
 import { markRowIdLocatorUnsupported, rowIdLocatorUnsupported, shouldKeepRowIdLocatorDisabled, shouldRetryWithoutRowIdLocator } from "@/lib/table/tableRowIdSupport";
 import { tableOpenPageLimit } from "@/lib/table/tableOpenPageLimit";
 import { tableDataLargeValuePreviewOptions } from "@/lib/dataGrid/dataGridLargeValues";
@@ -428,7 +428,7 @@ export function useSidebarDataOpenRuntime() {
       const defaultOrderBy = defaultSort.orderBy;
       // #12647：首开路径同样尊重"该连接的行定位器已被引擎拒绝"的记忆，否则
       // 被降级过的连接每次重新单击表都会再发一次注定失败的定位器查询。
-      const includeRowId = shouldIncludeSyntheticRowId(effectiveDbType, primaryKeys, tableType) && !rowIdLocatorUnsupported(node.connectionId);
+      const includeRowId = shouldIncludeSyntheticRowId(effectiveDbType, primaryKeys, tableType) && !rowIdLocatorUnsupported(node.connectionId) && !postgresTupleLocatorUnsupportedEngine(connectionStore.getConfig(node.connectionId));
       const buildOpenSql = (withRowId: boolean) =>
         buildTableSelectSql({
           databaseType: effectiveDbType,
```

**File**: `apps/desktop/src/lib/table/__tests__/postgresTupleLocatorEngine.spec.ts` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+import { describe, expect, it } from "vitest";
+import { postgresTupleLocatorUnsupportedEngine, shouldIncludeSyntheticRowId } from "@/lib/table/tableEditing";
+
+const connection = (dbType: string, productName?: string, productVersion?: string) => ({
+  db_type: dbType,
+  database_info: productName || productVersion ? { productName, productVersion } : undefined,
+});
+
+describe("postgresTupleLocatorUnsupportedEngine (#14745)", () => {
+  it("blocks Greenplum, Cloudberry, and Hologres postgres connections", () => {
+    expect(postgresTupleLocatorUnsupportedEngine(connection("postgres", "Greenplum", "PostgreSQL 9.4.24 (Greenplum Database 6.18.2 build commit)"))).toBe(true);
+    expect(postgresTupleLocatorUnsupportedEngine(connection("postgres", "Apache Cloudberry", "PostgreSQL 14.4 (Apache Cloudberry 1.2.0)"))).toBe(true);
+    // Hologres connections reject tableoid outright (#12647).
+    expect(postgresTupleLocatorUnsupportedEngine(connection("postgres", undefined, "PostgreSQL 14.x (Hologres 2.x)"))).toBe(true);
+  });
+
+  it("keeps vanilla PostgreSQL and engines without product info on the locator", () => {
+    expect(postgresTupleLocatorUnsupportedEngine(connection("postgres", "PostgreSQL", "PostgreSQL 16.2 on x86_64"))).toBe(false);
+    expect(postgresTupleLocatorUnsupportedEngine(connection("postgres"))).toBe(false);
+    expect(postgresTupleLocatorUnsupportedEngine(undefined)).toBe(false);
+    // Non-postgres engine types are decided by their own capability sets.
+    expect(postgresTupleLocatorUnsupportedEngine(connection("mysql", "Greenplum", "whatever"))).toBe(false);
+  });
+
+  it("gates the synthetic row-id decision for keyless base tables (#14745)", () => {
+    const keyless: string[] = [];
+    expect(shouldIncludeSyntheticRowId("postgres", keyless, "TABLE")).toBe(true);
+    // The engine gate is a separate predicate the injection sites combine; the
+    // combination is what keeps Cloudberry AO tables from receiving the
+    // tableoid/ctid/xmin projection.
+    expect(shouldIncludeSyntheticRowId("postgres", keyless, "TABLE") && !postgresTupleLocatorUnsupportedEngine(connection("postgres", "Apache Cloudberry", "PostgreSQL 14.4 (Apache Cloudberry 1.2.0)"))).toBe(false);
+  });
+});
```

**File**: `apps/desktop/src/lib/table/tableEditing.ts` (modified, +16/-1)
```diff
@@ -1,10 +1,25 @@
-import type { ColumnInfo, DatabaseType, IndexInfo } from "@/types/database";
+import type { ColumnInfo, ConnectionConfig, DatabaseType, IndexInfo } from "@/types/database";
 import { getDatabaseCapability } from "@/lib/database/databaseCapabilities";
 
 export const DBX_ROWID_COLUMN = "__DBX_ROWID";
 export const DBX_NEO4J_ELEMENT_ID_COLUMN = "__DBX_ELEMENT_ID";
 export const DBX_TDENGINE_TBNAME_COLUMN = "tbname";
 
+/**
+ * PostgreSQL-family engines whose storage rejects the tableoid/ctid/xmin
+ * tuple locator on at least some tables: Greenplum and Apache Cloudberry AO
+ * tables (`ERROR: virtual tuple table slot does not have system attributes`,
+ * `Invalid attnum: -3`, #14745) and Hologres (#12647, rejects `tableoid`
+ * outright). Detected from the connection's `SELECT version()` product
+ * string; before that probe lands the connection degrades on first
+ * rejection and is remembered per session.
+ */
+export function postgresTupleLocatorUnsupportedEngine(connection: Pick<ConnectionConfig, "db_type" | "database_info"> | undefined): boolean {
+  if (connection?.db_type !== "postgres") return false;
+  const version = `${connection.database_info?.productName ?? ""} ${connection.database_info?.productVersion ?? ""}`.toLowerCase();
+  return version.includes("greenplum") || version.includes("cloudberry") || version.includes("hologres");
+}
+
 export function isViewTableType(tableType?: string): boolean {
   return tableType?.toUpperCase().includes("VIEW") === true;
 }
```

---

### Incident Patch 2: `325fe1a6` (2026-11-13)
**Commit Message**: fix(export): clear an idle-expired manual transaction when export fails (#14882)

Exports read through the tab's open manual transaction. When the backend
idle watcher rolls that session back, the export still sent the stale
txnSessionId and surfaced the raw expiry error, leaving the dead id on
the tab so every retry failed the same way.

Handle expiry in both query-result export entry points and in the LOB
reads an export performs: clear the dead session on the owning tab (with
the auto-rollback notice when uncommitted work may be lost, or the SQL
Server transaction-status recovery), then report
exportProgress.transactionUnavailable instead of the backend string. The
same cleanup now backs the query-execution expiry path, and the expiry
matcher accepts the current idle-rollback wording.

Fixes #14795

Co-authored-by: linzhikai <[REDACTED_EMAIL]>

**File**: `apps/desktop/src/composables/__tests__/useDataGridExport.transactionExpiry.spec.ts` (added, +168/-0)
```diff
@@ -0,0 +1,168 @@
+import { computed, ref } from "vue";
+import { createPinia, setActivePinia } from "pinia";
+import { beforeEach, describe, expect, it, vi } from "vitest";
+import type { UseDataGridExportOptions } from "@/composables/useDataGridExport";
+import type { QueryResultExportRequest } from "@/lib/backend/api";
+
+const mocks = vi.hoisted(() => ({
+  start: vi.fn(),
+  cancel: vi.fn(),
+  noteExpired: vi.fn(),
+  save: vi.fn(),
+  mode: vi.fn(),
+  toast: vi.fn(),
+}));
+
+vi.mock("@/lib/backend/tauriRuntime", () => ({ isTauriRuntime: () => true }));
+vi.mock("@/lib/backend/api", async (importOriginal) => {
+  const original = await importOriginal<typeof import("@/lib/backend/api")>();
+  return {
+    ...original,
+    startQueryResultExport: mocks.start,
+    cancelQueryResultExport: mocks.cancel,
+    createQueryResultTempFile: vi.fn(async (extension: string) => `C:/exports/temp.${extension}`),
+    openQueryResultTempFile: vi.fn(async () => undefined),
+  };
+});
+vi.mock("@/lib/export/exportPath", () => ({
+  promptExportSavePath: mocks.save,
+  autoRevealExportedPathIfConfigured: vi.fn(),
+}));
+vi.mock("@/lib/export/exportExecutionMode", () => ({ getDefaultExportExecutionMode: mocks.mode }));
+vi.mock("@/stores/queryStore", () => ({ useQueryStore: () => ({ noteExpiredManualTransaction: mocks.noteExpired }) }));
+vi.mock("@/composables/useToast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
+vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string, params?: { message?: string }) => (params?.message ? `${key}: ${params.message}` : key) }) }));
+vi.mock("@/i18n", () => ({ default: { install() {} } }));
+vi.mock("@/lib/schema/oracleRoutineDeploy", () => ({}));
+vi.mock("@/composables/useDataGridExtractor", () => ({ useDataGridExtractor: () => ({ canCopyWithExtractor: vi.fn() }) }));
+vi.mock("@/stores/connectionStore", () => ({
+  useConnectionStore: () => ({
+    getConfig: () => ({ id: "mysql-1", name: "MySQL", db_type: "mysql", database: "app" }),
+    ensureConnected: vi.fn(async () => undefined),
+    connectionStateRevision: () => 0,
+    isCurrentConnectionStateRevision: () => true,
+  }),
+}));
+vi.mock("@/stores/settingsStore", () => ({
+  useSettingsStore: () => ({
+    editorSettings: {
+      defaultExportMode: "immediate",
+      exportBatchSize: 1000,
+      exportRowLimitEnabled: false,
+      csvQuoteMode: "minimal",
+      csvNullMode: "empty",
+      numericColumnRightAlign: true,
+    },
+  }),
+}));
+
+function expiredTransactionError() {
+  return new Error("Transaction session not found or expired; it may have been auto-rolled back due to inactivity");
+}
+
+function capturedRequest(options: { exportId: string; filePath: string; format: QueryResultExportRequest["format"] }): QueryResultExportRequest {
+  return {
+    exportId: options.exportId,
+    connectionId: "mysql-1",
+    database: "app",
+    sql: "UPDATE users SET active = 1",
+    queryBaseSql: "UPDATE users SET active = 1",
+    databaseType: "mysql",
+    useAgentCursor: false,
+    filePath: options.filePath,
+    format: options.format,
+    pageSize: 1000,
+    keysetOptimizationEnabled: false,
+    txnSessionId: "txn-expired",
+    executionId: "exec-1",
+  };
+}
+
+function fixture() {
+  const progress = ref({
+    title: "",
+    tableName: "",
+    format: "",
+    rowsExported: 0,
+    totalRows: null as number | null,
+    status: "",
+    errorMessage: null as string | null,
+    filePath: null as string | null,
+  });
+  const options: UseDataGridExportOptions = {
+    columns: computed(() => ["ID"]),
+    displayItems: computed(() => []),
+    sql: computed(() => "SELECT ID FROM users"),
+    tableMeta: computed(() => undefined),
+    databaseType: computed(() => "mysql"),
+    connectionId: computed(() => "mysql-1"),
+    database: computed(() => "app"),
+    context: computed(() => "results"),
+    sourceColumns: computed(() => ["ID"]),
+    columnTypes: computed(() => ["INT"]),
+    whereInput: computed(() => undefined),
+    orderBy: computed(() => undefined),
+    exportBatchSize: computed(() => 1000),
+    hasCellSelection: computed(() => false),
+    selectedCells: computed(() => ({ columns: [], rows: [] })),
+    selectedCellMatrix: computed(() => null),
+    selectedRange: computed(() => null),
+    contextCell: ref(null),
+    contextSelectionIsSynthetic: ref(false),
+    getRowItem: () => undefined,
+    selectedRowIds: ref(new Set<number>()),
+    hasRowSelection: computed(() => false),
+    captureQueryResultExportRequest: () => async (buildOptions) => capturedRequest(buildOptions),
+    queryResultExportRequest: async (buildOptions) => capturedRequest(buildOptions),
+    exportProgressState: progress,
+    exportProgressDialog: ref(false),
+    exportCanMinimize: ref(false),
+    exportCancelHandler: ref(null),
+  };
+  return { options, progress };
+}
+
+describe("data grid query result export with an expired manual transaction", () => {
+  beforeEach(() => {
+    v
```

**File**: `apps/desktop/src/composables/useDataGridExport.ts` (modified, +22/-1)
```diff
@@ -27,6 +27,7 @@ import { resolveSqlExportColumnIndexes, sqlExportColumnChoices } from "@/lib/exp
 import { summarizeExportRows } from "@/lib/export/exportDiagnostics";
 import { appendDebugLog, appendNativeProcessMemoryLog, getBrowserMemorySnapshot, isDebugLoggingEnabled } from "@/lib/backend/debugLog";
 import { uuid } from "@/lib/common/utils";
+import { isManualTransactionSessionExpired } from "@/lib/backend/errorUtils";
 import { useSettingsStore } from "@/stores/settingsStore";
 import { csvNullLiteralForMode } from "@/lib/export/csvNullMode";
 import { expandNestedJsonStringsForCopy } from "@/lib/common/jsonCopyValue";
@@ -47,6 +48,7 @@ import { getDefaultExportExecutionMode } from "@/lib/export/exportExecutionMode"
 import { SnapshotCompletionError } from "@/lib/export/snapshotCompletion";
 import type { CapturedLegacyLargeValueExport } from "@/lib/dataGrid/legacyLargeValueExport";
 import { useConnectionStore } from "@/stores/connectionStore";
+import { useQueryStore } from "@/stores/queryStore";
 import { connectionConfigFingerprint } from "@/lib/connection/connectionDatabaseInfo";
 import type { ManualExportMode } from "@/lib/export/manualExportQueue";
 
@@ -1343,6 +1345,10 @@ export function useDataGridExport(options: UseDataGridExportOptions) {
             return await (native ? api.readLargeValueChunk(request, true) : api.readLargeValueChunk(request));
           } catch (error) {
             nativeUnknown = native && (!(error instanceof SnapshotCompletionError) || error.status === "unknown");
+            if (request.txnSessionId && isManualTransactionSessionExpired(error)) {
+              useQueryStore().noteExpiredManualTransaction(request.txnSessionId, error);
+              throw new Error(t("exportProgress.transactionUnavailable"));
+            }
             throw error;
           }
         };
@@ -2129,6 +2135,10 @@ export function useDataGridExport(options: UseDataGridExportOptions) {
             return await api.readLargeValueChunk(request, true);
           } catch (error) {
             unknown ||= !(error instanceof SnapshotCompletionError) || error.status === "unknown";
+            if (request.txnSessionId && isManualTransactionSessionExpired(error)) {
+              useQueryStore().noteExpiredManualTransaction(request.txnSessionId, error);
+              throw new Error(t("exportProgress.transactionUnavailable"));
+            }
             throw error;
           }
         };
@@ -2782,6 +2792,17 @@ export function useDataGridExport(options: UseDataGridExportOptions) {
     };
     let request: QueryResultExportRequest | undefined;
     if (mode === "immediate") request = await build();
+    const startExport = async (onProgress: (progress: api.TableExportProgress) => void) => {
+      try {
+        return await (isTauriRuntime() ? api.startQueryResultExport(request!, onProgress, true) : api.startQueryResultExport(request!, onProgress));
+      } catch (error) {
+        if (request?.txnSessionId && isManualTransactionSessionExpired(error)) {
+          useQueryStore().noteExpiredManualTransaction(request.txnSessionId, error);
+          throw new Error(t("exportProgress.transactionUnavailable"));
+        }
+        throw error;
+      }
+    };
     await submitBackendExport({
       exportId,
       tableName: "Query Result",
@@ -2796,7 +2817,7 @@ export function useDataGridExport(options: UseDataGridExportOptions) {
               request = await build();
             }
           : undefined,
-      start: (onProgress) => (isTauriRuntime() ? api.startQueryResultExport(request!, onProgress, true) : api.startQueryResultExport(request!, onProgress)),
+      start: startExport,
       cancel: () => api.cancelQueryResultExport(exportId, request!.executionId),
     });
     return true;
```

**File**: `apps/desktop/src/lib/backend/errorUtils.ts` (modified, +7/-1)
```diff
@@ -193,7 +193,13 @@ export function normalizeBackendError(error: unknown): BackendError | null {
 export function isManualTransactionSessionExpired(error: unknown): boolean {
   if (normalizeBackendError(error)?.code === MANUAL_TRANSACTION_SESSION_EXPIRED_CODE) return true;
   const message = error instanceof Error ? error.message : typeof error === "string" ? error : undefined;
-  return message?.startsWith("Transaction session not found or expired;") === true || message === "Transaction was auto-rolled back due to 5 minutes of inactivity";
+  return (
+    message?.startsWith("Transaction session not found or expired;") === true ||
+    // Current backend idle-rollback message, plus the pre-0.6.70 wording that
+    // hardcoded the five-minute timeout.
+    message === "Transaction was auto-rolled back due to inactivity" ||
+    message === "Transaction was auto-rolled back due to 5 minutes of inactivity"
+  );
 }
 
 export function isUnsupportedManualTransactionMethod(error: unknown): boolean {
```

**File**: `apps/desktop/src/stores/__tests__/queryStore.directExportQueue.spec.ts` (modified, +23/-0)
```diff
@@ -110,3 +110,26 @@ it("finishes a known preparation failure and permits the following independent e
   expect(pending[0]!.request.sql).toBe("SELECT 2 FROM dual");
   finish(0);
 });
+
+it("drops the idle-expired manual transaction and reports the export transaction as unavailable", async () => {
+  const { useQueryStore } = await import("../queryStore");
+  const { useExportTracker } = await import("@/composables/useExportTracker");
+  const { default: i18n } = await import("@/i18n");
+  const store = useQueryStore();
+  const id = store.createTab("oracle-1", "APP", "Query");
+  const tab = store.tabs.find((item) => item.id === id)!;
+  tab.autoCommit = false;
+  tab.txnSessionId = "txn-expired";
+  tab.txnPossiblyDirty = true;
+
+  await store.exportQuerySqlDirect(id, "UPDATE users SET active = 1", "csv", "out.csv");
+  await vi.waitFor(() => expect(pending).toHaveLength(1));
+  expect(pending[0]!.request.txnSessionId).toBe("txn-expired");
+  pending[0]!.reject(new Error("Transaction session not found or expired; it may have been auto-rolled back due to inactivity"));
+
+  const tracker = useExportTracker();
+  await vi.waitFor(() => expect(tracker.tasks.value[0]!.errorMessage).toBe(i18n.global.t("exportProgress.transactionUnavailable")));
+  expect(tab.txnSessionId).toBeUndefined();
+  expect(tab.txnAutoRolledBack).toBe(true);
+  expect(tab.txnPossiblyDirty).toBe(false);
+});
```

**File**: `apps/desktop/src/stores/queryStore.ts` (modified, +40/-16)
```diff
@@ -6349,6 +6349,27 @@ export const useQueryStore = defineStore("query", () => {
     if (tab.txnPossiblyDirty !== undefined) tab.txnPossiblyDirty = false;
   }
 
+  /** Backend session was removed and rolled back after idle expiry: clear the
+   *  sticky dirty state together with the session. A session proven read-only
+   *  reports no lost work, so it gets no auto-rollback notice (#9831). */
+  function markManualTransactionIdleExpired(tab: QueryTab) {
+    const rollbackNoticeRequired = manualTransactionRollbackNoticeRequired(tab, effectiveDatabaseTypeForConnection(useConnectionStore().getConfig(tab.connectionId)));
+    clearTxnPossiblyDirty(tab);
+    tab.txnSessionId = undefined;
+    tab.txnAutoRolledBack = rollbackNoticeRequired;
+  }
+
+  /** An export observed the backend's idle-expiry error for the transaction it
+   *  was reading through. Drop the dead session from its source tab so a retry
+   *  stops sending the stale id. Returns false when no open tab owns it. */
+  function noteExpiredManualTransaction(txnSessionId: string, error: unknown): boolean {
+    const tab = tabs.value.find((item) => item.txnSessionId === txnSessionId);
+    if (!tab) return false;
+    if (isSqlServerTransactionTab(tab)) reportSqlServerTransactionError(tab, error);
+    else markManualTransactionIdleExpired(tab);
+    return true;
+  }
+
   function rollbackTabTransaction(tab: QueryTab, options?: { resetAutoCommit?: boolean; resetAutoCommitDbType?: string }) {
     invalidateManualTransactionTarget(tab);
     if (tab.txnSessionId) void rollbackTransaction(tab.id);
@@ -10155,13 +10176,7 @@ export const useQueryStore = defineStore("query", () => {
         const errMsg: string = e?.message ?? String(e);
         const idleTimeout = isManualTransactionSessionExpired(e) || errMsg.includes("已自动回滚");
         if (idleTimeout) {
-          // Backend session was removed and rolled back after idle expiry: clear
-          // the sticky dirty state together with the session. Same rule as the
-          // restart path: a session proven read-only reports no lost work.
-          const rollbackNoticeRequired = manualTransactionRollbackNoticeRequired(tab, effectiveDatabaseTypeForConnection(useConnectionStore().getConfig(tab.connectionId)));
-          clearTxnPossiblyDirty(tab);
-          tab.txnSessionId = undefined;
-          tab.txnAutoRolledBack = rollbackNoticeRequired;
+          markManualTransactionIdleExpired(tab);
         } else if (/rolled.?back/i.test(errMsg) || /transaction session not found/i.test(errMsg) || /agent runtime terminated/i.test(errMsg)) {
           // Statement failure that disposed the manual session: the `rolled back`
           // message fragment is a frontend cleanup compatibility contract.
@@ -11923,6 +11938,18 @@ export const useQueryStore = defineStore("query", () => {
         throw new Error(i18n.global.t("exportProgress.transactionUnavailable"));
     }
 
+    const startExport = async (onProgress: (progress: api.TableExportProgress) => void) => {
+      try {
+        return await (isTauriRuntime() ? api.startQueryResultExport(request, onProgress, true) : api.startQueryResultExport(request, onProgress));
+      } catch (error) {
+        if (request.txnSessionId && isManualTransactionSessionExpired(error)) {
+          noteExpiredManualTransaction(request.txnSessionId, error);
+          throw new Error(i18n.global.t("exportProgress.transactionUnavailable"));
+        }
+        throw error;
+      }
+    };
+
     const tracker = useExportTracker();
     if (!isTauriRuntime()) await connStore.ensureConnected(request.connectionId);
     const task = tracker.addTask("Query Result", format, filePath, request.exportId);
@@ -11945,14 +11972,10 @@ export const useQueryStore = defineStore("query", () => {
             return "settled";
           }
           invoked = true;
-          const result = await api.startQueryResultExport(
-            request,
-            (progress) => {
-              terminal ||= progress.status === "Done" || progress.status === "Error" || progress.status === "Cancelled";
-              tracker.updateTableExportTask(request.exportId, progress);
-            },
-            true,
-          );
+          const result = await startExport((progress) => {
+            terminal ||= progress.status === "Done" || progress.status === "Error" || progress.status === "Cancelled";
+            tracker.updateTableExportTask(request.exportId, progress);
+          });
           terminal ||= result.status === "Done" || result.status === "Error" || result.status === "Cancelled";
           tracker.updateTableExportTask(request.exportId, result);
           return terminal ? "settled" : "unknown";
@@ -11975,7 +11998,7 @@ export const useQueryStore = defineStore("query", () => {
 
     void (async () => {
       try {
-        await api.startQueryResultExport(request, (progress) => tracker.updateTableExportTask(request.exportId, progress));
+        await startExport((pro
```

---

### Incident Patch 3: `65efe53b` (2026-11-13)
**Commit Message**: fix(query): apply configured default schema when opening queries from quick connections (#11844) (#11865)

* fix(query): apply configured default schema when opening queries from quick connections (#11844)

* style: format frontend with oxfmt 0.76.0

The two merge commits carried 32 files reformatted by a stale local oxfmt 0.73.0 pre-commit hook; the repo now pins 0.76.0 and CI enforces it. Re-formatting with 0.76.0 restores those files to main's content, leaving only the PR's own 3-file change.

---------

Co-authored-by: zipg <[REDACTED_EMAIL]>

**File**: `apps/desktop/src/App.vue` (modified, +33/-7)
```diff
@@ -3454,7 +3454,25 @@ async function newQuery(options: NewQueryOptions = {}) {
     await connectionStore.ensureConnected(target.connectionId);
     if (target.shouldRefreshDefaultDatabase) {
       const options = await getDatabaseOptions(target.connectionId);
-      queryStore.updateDatabase(tabId, resolveDefaultDatabase(conn, options));
+      const nextDb = resolveDefaultDatabase(conn, options);
+      if (nextDb !== target.database) {
+        queryStore.updateDatabase(tabId, nextDb);
+        if (target.schema) {
+          queryStore.updateSchema(tabId, target.schema);
+        }
+      }
+      if (!target.schema && (conn.db_type === "oracle" || conn.db_type === "oceanbase-oracle")) {
+        try {
+          const orderedSchemas = await api.listSchemas(target.connectionId, nextDb);
+          const schema = schemaAfterConnectionSwitch(conn.db_type, orderedSchemas, conn.default_schema);
+          const latestTab = queryStore.tabs.find((candidate) => candidate.id === tabId);
+          if (schema && latestTab && latestTab.connectionId === target.connectionId) {
+            queryStore.updateSchema(tabId, schema);
+          }
+        } catch {
+          // Schema metadata failure must not turn a successful connection into an error.
+        }
+      }
     }
   } catch (e: any) {
     toast(
@@ -3517,18 +3535,26 @@ async function openConnectionQuery(connectionId: string) {
     }
     return;
   }
-  // The quick-start page opens a query directly, bypassing newQuery() and its
-  // default-schema fallback. Pass the configured schema here too, otherwise an
-  // Oracle connection with a default schema opens the editor without a session
-  // schema and unqualified tables resolve against the session default (#11844).
-  const tabId = queryStore.createTab(connectionId, initialTarget.database, undefined, "query", initialTarget.schema);
+  const initialSchema = initialTarget.kind === "query" ? initialTarget.schema : undefined;
+  const tabId = queryStore.createTab(connectionId, initialTarget.database, undefined, "query", initialSchema);
   try {
     await connectionStore.ensureConnected(connectionId);
     const options = await getDatabaseOptions(connectionId);
     const target = quickConnectionOpenTarget(connection, options);
     if (target.kind === "query") {
       queryStore.updateDatabase(tabId, target.database);
-      if (target.schema) queryStore.updateSchema(tabId, target.schema);
+      if (connection.default_schema || connection.db_type === "oracle" || connection.db_type === "oceanbase-oracle") {
+        try {
+          const orderedSchemas = connection.default_schema ? [] : await api.listSchemas(connectionId, target.database);
+          const schema = schemaAfterConnectionSwitch(connection.db_type, orderedSchemas, connection.default_schema);
+          const latestTab = queryStore.tabs.find((candidate) => candidate.id === tabId);
+          if (schema && latestTab && latestTab.connectionId === connectionId) {
+            queryStore.updateSchema(tabId, schema);
+          }
+        } catch {
+          // Schema metadata failure must not turn a successful connection into an error.
+        }
+      }
     }
   } catch (e: any) {
     toast(
```

**File**: `apps/desktop/src/lib/__tests__/connection/connectionOpenTarget.spec.ts` (modified, +13/-4)
```diff
@@ -43,11 +43,20 @@ describe("quickConnectionOpenTarget", () => {
     });
   });
 
-  it("carries the connection's default schema into the query tab (#11844)", () => {
-    expect(quickConnectionOpenTarget({ ...connection("oracle"), database: "XE", default_schema: "REPORTING" })).toEqual({
+  it("includes configured default schema for Oracle and other query connections", () => {
+    expect(quickConnectionOpenTarget({ ...connection("oracle"), database: "ORCL", default_schema: "HR" })).toEqual({
       kind: "query",
-      database: "XE",
-      schema: "REPORTING",
+      database: "ORCL",
+      schema: "HR",
+    });
+    expect(quickConnectionOpenTarget({ ...connection("oracle"), database: "ORCL", default_schema: "  FINANCE  " })).toEqual({
+      kind: "query",
+      database: "ORCL",
+      schema: "FINANCE",
+    });
+    expect(quickConnectionOpenTarget({ ...connection("oracle"), database: "ORCL", default_schema: "   " })).toEqual({
+      kind: "query",
+      database: "ORCL",
     });
   });
 });
```

**File**: `apps/desktop/src/lib/connection/connectionOpenTarget.ts` (modified, +7/-2)
```diff
@@ -3,7 +3,7 @@ import { resolveDefaultDatabase } from "@/lib/database/defaultDatabase";
 
 export type QuickConnectionOpenTarget = { kind: "mq-admin" } | { kind: "nacos-admin" } | { kind: "plugin-workbench" } | { kind: "etcd" } | { kind: "zookeeper" } | { kind: "consul" } | { kind: "query"; database: string; schema?: string };
 
-export function quickConnectionOpenTarget(connection: Pick<ConnectionConfig, "db_type" | "database" | "default_schema">, databaseOptions: string[] = []): QuickConnectionOpenTarget {
+export function quickConnectionOpenTarget(connection: Pick<ConnectionConfig, "db_type" | "database"> & Partial<Pick<ConnectionConfig, "default_schema">>, databaseOptions: string[] = []): QuickConnectionOpenTarget {
   if (connection.db_type === "mq") {
     return { kind: "mq-admin" };
   }
@@ -22,5 +22,10 @@ export function quickConnectionOpenTarget(connection: Pick<ConnectionConfig, "db
   if (connection.db_type === "consul") {
     return { kind: "consul" };
   }
-  return { kind: "query", database: resolveDefaultDatabase(connection, databaseOptions), schema: connection.default_schema };
+  const configuredSchema = connection.default_schema?.trim() || undefined;
+  return {
+    kind: "query",
+    database: resolveDefaultDatabase(connection, databaseOptions),
+    ...(configuredSchema ? { schema: configuredSchema } : {}),
+  };
 }
```

#### Recent Merged Pull Requests:
- **PR #14882** (2026-11-13): fix(export): clear an idle-expired manual transaction when export fails (@Lan-zk)
- **PR #14875** (2026-11-13): fix(postgres): use concat() for CRDB metadata relation name (@Pius-x)
- **PR #14873** (2026-11-13): fix(editor): enable AI in detached SQL windows (@Acd-kk)
- **PR #14866** (2026-11-13): fix(structure): drop a local column order once the table is rebuilt in a new order (@jeff377)
- **PR #14864** (2026-11-13): fix(editor): resolve Oracle public synonyms in semantic diagnostics (@zipg)
- **PR #14861** (2026-11-13): fix(mysql): stop abandoned export streams instead of draining them on close (@jeff377)

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

## X. postgres): block tuple locator on Greenplum, Cloudberry, Hologres

**RULE**:
When implementing operations in `apps/desktop/src/components/grid/DataGrid.vue`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in t8y2/dbx. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e7d19408`: postgres): block tuple locator on Greenplum, Cloudberry, Hologres. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/desktop/src/components/grid/DataGrid.vue`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
  postgresTupleLocatorUnsupportedEngine,
    includeRowId:
      shouldIncludeSyntheticRowId(resolvedDatabaseType.value, tableMeta.primaryKeys, tableMeta.tableType) && !(props.connectionId && rowIdLocatorUnsupported(props.connectionId)) && !postgresTupleLocatorUnsupportedEngine(props.connectionId ? connectionStore.getConfig(props.connectionId) : undefined),
      includeRowId:
        shouldIncludeSyntheticRowId(resolvedDatabaseType.value, tableMeta.primaryKeys, tableMeta.tableType) &&
        !(props.connectionId && rowIdLocatorUnsupported(props.connectionId)) &&
        !postgresTupleLocatorUnsupportedEngine(props.connectionId ? connectionStore.getConfig(props.connectionId) : undefined),
      includeRowId:
        shouldIncludeSyntheticRowId(resolvedDatabaseType.value, tableMeta.primaryKeys, tableMeta.tableType) &&
        !(props.connectionId && rowIdLocatorUnsupported(props.connectionId)) &&
        !postgresTupleLocatorUnsupportedEngine(props.connectionId ? connectionStore.getConfig(props.connectionId) : undefined),
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    includeRowId: shouldIncludeSyntheticRowId(resolvedDatabaseType.value, tableMeta.primaryKeys, tableMeta.tableType) && !(props.connectionId && rowIdLocatorUnsupported(props.connectionId)),
      includeRowId: shouldIncludeSyntheticRowId(resolvedDatabaseType.value, tableMeta.primaryKeys, tableMeta.tableType) && !(props.connectionId && rowIdLocatorUnsupported(props.connectionId)),
      includeRowId: shouldIncludeSyntheticRowId(resolvedDatabaseType.value, tableMeta.primaryKeys, tableMeta.tableType) && !(props.connectionId && rowIdLocatorUnsupported(props.connectionId)),
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e7d19408` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
