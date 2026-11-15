# Verification Protocol: Verification Protocol: Empirical Defect Shield for t8y2-dbx-learnings

<!-- PROVENANCE_START
{
  "source_repository": "t8y2-dbx-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T06:37:32.297Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-t8y2-dbx-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [t8y2-dbx-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T06:37:32.297Z`  
> **Learning ID**: `LEARN-EVO-t8y2-dbx-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `t8y2-dbx-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/t8y2-dbx-learnings.md`  
> **Source**: github ([https://github.com/t8y2/dbx](https://github.com/t8y2/dbx))  
> **Source Version**: `0c019880`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-15T06:36:56.964Z  
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
> **Harvest Timestamp**: 2026-11-15T06:36:56.958Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `t8y2/dbx`
- **Description**: 25 MB lightweight cross-platform database client for 100+ databases, including MySQL, PostgreSQL, SQLite, Redis, MongoDB, DuckDB, SQL Server, and Dameng. Built-in AI, MCP Server, CLI, desktop and Docker. | 轻量级跨平台数据库管理工具，支持 MySQL、PostgreSQL、SQLite、Redis、MongoDB、达梦等 100+ 数据库，提供桌面端、Docker、CLI、内置 AI 助手和 MCP。
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 30359 stars

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
- **Issue #14966** (2026-11-14): **[Bug] 查看表结构与 DDL 弹窗叠加导致层级异常、交互锁定**
  *Symptoms*: ### 数据库类型和版本 / Database type and version  ClickHouse 25.3.14.14  ### 问题描述 / Problem description  1. 复现步骤 ①新建连接，在 SQL 编辑器输入查询语句 ②右键表名 → 选择「查看表结构」，弹出表结构弹窗 ③再次右键同一表名 → 选择「查看 DDL」，弹出 DDL 弹窗 ④观察两弹窗层级、可见性及交互状态；尝试点击表结构弹窗右上角关闭 × 2. 期望结果 ①表结构与 DDL 弹窗应互斥（或打开替换前弹窗）或正确分层（后者在上且独立） ②鼠标焦点应跟随或选择当前活动弹窗，实现正常查看/操作 ③任意弹窗均可独立关闭；无需依赖 先后顺序 3. 实际结果 ①层级遮挡：​ DDL 弹窗显示在下层，表结构弹窗在上层，整体层级混乱，视觉重叠 ②交互锁定：​ 鼠标只能操作 DDL 框，表结构弹窗无法交互 ③关闭链异常：​无法操作表结构弹窗，必须先关闭 DDL 弹窗，操作阻塞 ④截图日志 如图  <img width="589" height="274" alt="d0489b1082942b3e47ac2edaabaca75e" src="https://github.com/user-attachments/assets/980c8012-34d1-4a21-9d7b-90441932f84d" />  <img width="1320" height="774" alt="3a9f1b3c5acf7975cac363e94f9e33d2" src="https://github.com/user-attachments/assets/723dabe2-a898-4f2a-948e-c647254ea655" />  <img width="1257" height="812" alt="92bbf3537be6e8f80c3c29583e1104df" src="https://github.com/user-attachments/assets/1d927423-7b0a-4642-ac4f-325499a5b88b" />  ### 支持信息 / Support information  DBX 版本: v0.6.69 (0.6.69-beta.20261110.1) 运行环境: 桌面端 操作系统: Windows 10 (10.0.19045.3324) 系统架构: x86_64 User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0 数据库类型: clickhouse, postgres, redis  ### 优先级（是否紧急） / Priority (urgency)  🟢 P3 低优 · 有空再修 / Low · Fix when possible  ### 补充信息 / Additional information  _No response_

- **Issue #14946** (2026-11-14): **[Bug] 禁用 DBX 【设置-安全】搜索框表单自动补全**
  *Symptoms*: ### 数据库类型和版本 / Database type and version  None  ### 问题描述 / Problem description  默认情况下，浏览器会记录用户网页上提交的<input>框的信息，DBX 【设置-安全】搜索框哪怕清除了输入信息还是会自动填入，其它页面搜索框自动填入后清除了不会自动填入，请检查前端 autocomplete 的属性设置  ### 支持信息 / Support information  运行环境:Docker  ### 优先级（是否紧急） / Priority (urgency)  🟡 P2 普通 · 按排期处理 / Normal · Schedule as appropriate  ### 补充信息 / Additional information  _No response_
  **Post-Mortem & Fix Analysis**:
  > 结论：与 #14952 是同一问题——设置搜索框被浏览器表单历史自动填充。main 已由 e759e60cc（fix(desktop): stop settings search from autofilling browser history，关闭 #14952）修复：该搜索框此前是应用里唯一 `type="text"` 的搜索框（其它搜索框都不是 text 类型，所以只有它会被浏览器记住表单内容），现已改为 `type="search"` 并隐藏 WebKit 自带的清除按钮，升级到包含该提交的版本即可。  两点补充：  - 若指的是「安全」标签页里密码输入框旁的凭据自动填充（浏览器在密码字段旁弹出已保存凭据）：那是浏览器凭据管理器的行为，与表单历史是两条机制；密码字段已在代码里带 `autocomplete="off"` 且隐藏了 WebKit 的自动填充按钮，Chrome 对密码型输入会忽略 `off`，标准解法是把三个密码框改为 `autocomplete="current-password"` / `"new-password"` 让浏览器行为可预期（旧密码提供已保存凭据、新密码不自动填充）。如果升级后仍有这个问题，可以按这个方向单独提增强。 - 建议将本 issue 关闭为 #14952 的重复项。 

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

### Incident Patch 1: `9ce79533` (2026-11-14)
**Commit Message**: fix(updater): retry the update cache rename on transient Windows locks (#14821)

* fix(updater): retry the cache commit rename on transient Windows locks

Real-time security software opens the freshly written update package for a moment, and Windows rejects the commit directory rename while any file below it is still open. Reuse the plugin installer's transient-lock retry (Windows 5/32, 200..2000 ms) for the updater commit, and run the commit on the blocking pool so the wait cannot stall the async runtime.

Fixes #14574.

* fix(updater): do not publish a download canceled during the cache rename retry

The scanner wait can last several seconds. A committing slot keeps that wait off the state mutex, so cancel discards the package and a second download cannot start.

**File**: `crates/dbx-platform/src/fs_retry.rs` (added, +117/-0)
```diff
@@ -0,0 +1,117 @@
+//! Retries for filesystem operations that security software can briefly block.
+//!
+//! Real-time antivirus/EDR scanners open a file right after it is written. On Windows a
+//! directory rename is rejected with `ERROR_ACCESS_DENIED` (5) while any file below it is
+//! still open, even when the opening handle allows delete sharing, and file operations can
+//! fail with `ERROR_SHARING_VIOLATION` (32). The scan normally finishes well inside this
+//! retry window, so callers can keep a single atomic rename as their commit point instead
+//! of falling back to a non-atomic write protocol.
+
+use std::path::Path;
+use std::time::Duration;
+
+/// Field reports put the scan window at roughly 1-2 seconds for a large installer, so this
+/// budget gives the scanner several times that window. The plugin installer and the desktop
+/// updater share it deliberately: both commit by renaming a freshly written package.
+pub const TRANSIENT_LOCK_RETRY_DELAYS: [Duration; 5] = [
+    Duration::from_millis(200),
+    Duration::from_millis(400),
+    Duration::from_millis(800),
+    Duration::from_millis(1500),
+    Duration::from_millis(2000),
+];
+
+/// Rename `src` to `dst`, retrying the transient Windows locks described above.
+pub fn rename_with_transient_lock_retry(src: &Path, dst: &Path) -> std::io::Result<()> {
+    retry_transient_lock(&TRANSIENT_LOCK_RETRY_DELAYS, || std::fs::rename(src, dst))
+}
+
+/// Run `operation`, sleeping for each entry in `delays` after a transient Windows lock error.
+///
+/// Every other error is returned immediately. After the last delay the operation is tried
+/// once more, so at most `delays.len() + 1` attempts are made and the final error is the
+/// original one.
+pub fn retry_transient_lock<T>(
+    delays: &[Duration],
+    mut operation: impl FnMut() -> std::io::Result<T>,
+) -> std::io::Result<T> {
+    for delay in delays {
+        match operation() {
+            Ok(value) => return Ok(value),
+            Err(error) if cfg!(windows) && is_windows_lock_error(&error) => std::thread::sleep(*delay),
+            Err(error) => return Err(error),
+        }
+    }
+    operation()
+}
+
+fn is_windows_lock_error(error: &std::io::Error) -> bool {
+    matches!(error.raw_os_error(), Some(5 | 32))
+}
+
+#[cfg(test)]
+mod tests {
+    use super::retry_transient_lock;
+    use std::time::Duration;
+
+    #[test]
+    #[cfg(windows)]
+    fn transient_lock_retry_recovers_from_windows_lock_errors() {
+        use std::sync::atomic::{AtomicUsize, Ordering};
+
+        for code in [5, 32] {
+            let attempts = AtomicUsize::new(0);
+            let result = retry_transient_lock(&[Duration::ZERO, Duration::ZERO, Duration::ZERO], || {
+                if attempts.fetch_add(1, Ordering::SeqCst) < 2 {
+                    Err(std::io::Error::from_raw_os_error(code))
+                } else {
+                    Ok(())
+                }
+            });
+            assert!(result.is_ok());
+            assert_eq!(attempts.load(Ordering::SeqCst), 3);
+        }
+    }
+
+    #[test]
+    #[cfg(windows)]
+    fn transient_lock_retry_returns_last_error_after_exhausting_delays() {
+        use std::sync::atomic::{AtomicUsize, Ordering};
+
+        let attempts = AtomicUsize::new(0);
+        let result: std::io::Result<()> = retry_transient_lock(&[Duration::ZERO], || {
+            attempts.fetch_add(1, Ordering::SeqCst);
+            Err(std::io::Error::from_raw_os_error(5))
+        });
+        assert_eq!(attempts.load(Ordering::SeqCst), 2);
+        assert_eq!(result.unwrap_err().raw_os_error(), Some(5));
+    }
+
+    #[test]
+    fn transient_lock_retry_does_not_retry_other_errors() {
+        use std::sync::atomic::{AtomicUsize, Ordering};
+
+        let attempts = AtomicUsize::new(0);
+        let result: std::io::Result<()> = retry_transient_lock(&[Duration::ZERO; 3], || {
+            attempts.fetch_add(1, Ordering::SeqCst);
+            Err(std::io::Error::from_raw_os_error(2))
+        });
+        assert_eq!(attempts.load(Ordering::SeqCst), 1);
+        assert_eq!(result.unwrap_err().raw_os_error(), Some(2));
+    }
+
+    #[test]
+    #[cfg(unix)]
+    fn transient_lock_retry_treats_windows_lock_codes_as_final_on_unix() {
+        use std::sync::atomic::{AtomicUsize, Ordering};
+
+        // Raw code 5 on Unix is EIO, not a Windows lock error, so the retry gate must leave it final.
+        let attempts = AtomicUsize::new(0);
+        let result: std::io::Result<()> = retry_transient_lock(&[Duration::ZERO; 3], || {
+            attempts.fetch_add(1, Ordering::SeqCst);
+            Err(std::io::Error::from_raw_os_error(5))
+        });
+        assert_eq!(attempts.load(Ordering::SeqCst), 1);
+        assert_eq!(result.unwrap_err().raw_os_error(), Some(5));
+    }
+}
```

**File**: `crates/dbx-platform/src/lib.rs` (modified, +1/-0)
```diff
@@ -1,3 +1,4 @@
+pub mod fs_retry;
 pub mod path_utils;
 pub mod process;
 pub mod proxy;
```

**File**: `crates/dbx-plugin-runtime/src/plugins/installer.rs` (modified, +2/-99)
```diff
@@ -7,6 +7,7 @@ use std::time::Duration;
 
 use base64::Engine;
 use chrono::Utc;
+use dbx_platform::fs_retry::{rename_with_transient_lock_retry, retry_transient_lock, TRANSIENT_LOCK_RETRY_DELAYS};
 use ed25519_dalek::{Signature, Verifier, VerifyingKey};
 use fs2::FileExt;
 use semver::Version;
@@ -1155,43 +1156,6 @@ fn open_install_lock(root_dir: &Path) -> Result<File, String> {
         .map_err(|error| error.to_string())
 }
 
-// Antivirus scanners briefly hold handles on freshly extracted plugin binaries, which fails
-// directory renames with ERROR_ACCESS_DENIED (5) or ERROR_SHARING_VIOLATION (32); the scan
-// normally finishes well inside this retry window.
-const TRANSIENT_LOCK_RETRY_DELAYS: [Duration; 5] = [
-    Duration::from_millis(200),
-    Duration::from_millis(400),
-    Duration::from_millis(800),
-    Duration::from_millis(1500),
-    Duration::from_millis(2000),
-];
-
-pub(crate) fn rename_with_transient_lock_retry(src: &Path, dst: &Path) -> std::io::Result<()> {
-    retry_transient_lock(&TRANSIENT_LOCK_RETRY_DELAYS, || std::fs::rename(src, dst))
-}
-
-fn retry_transient_lock<T>(
-    delays: &[Duration],
-    mut operation: impl FnMut() -> std::io::Result<T>,
-) -> std::io::Result<T> {
-    for delay in delays {
-        match operation() {
-            Ok(value) => return Ok(value),
-            Err(error) if cfg!(windows) && is_windows_lock_error(&error) => {
-                // If a file in the directory has the read-only attribute set on Windows,
-                // renames and removals fail with ERROR_ACCESS_DENIED (5). Ensure write permissions.
-                std::thread::sleep(*delay);
-            }
-            Err(error) => return Err(error),
-        }
-    }
-    operation()
-}
-
-fn is_windows_lock_error(error: &std::io::Error) -> bool {
-    matches!(error.raw_os_error(), Some(5 | 32))
-}
-
 #[allow(clippy::permissions_set_readonly_false)]
 fn ensure_tree_writable(path: &Path) {
     if !path.exists() {
@@ -1344,7 +1308,7 @@ mod tests {
     use zip::write::SimpleFileOptions;
 
     use super::{
-        ensure_tree_writable, is_activation_record_file, read_install_identity, retry_transient_lock, sha256_hex,
+        ensure_tree_writable, is_activation_record_file, read_install_identity, sha256_hex,
         validate_package_expectation, write_json_atomically, PluginInstallPolicy, PluginPackageExpectation,
         PluginPackageInstaller, PluginSignatureStatus, PluginTrustStore, ACTIVATIONS_DIR, INSTALL_LOCK_FILE,
         PLUGIN_CHECKSUMS_FILE, PLUGIN_SIGNATURE_FILE, PLUGIN_TRASH_DIR, VERSIONS_DIR,
@@ -2194,67 +2158,6 @@ mod tests {
         output.into_inner()
     }
 
-    #[test]
-    #[cfg(windows)]
-    fn transient_lock_retry_recovers_from_windows_lock_errors() {
-        use std::sync::atomic::{AtomicUsize, Ordering};
-
-        for code in [5, 32] {
-            let attempts = AtomicUsize::new(0);
-            let result = retry_transient_lock(&[Duration::ZERO, Duration::ZERO, Duration::ZERO], || {
-                if attempts.fetch_add(1, Ordering::SeqCst) < 2 {
-                    Err(std::io::Error::from_raw_os_error(code))
-                } else {
-                    Ok(())
-                }
-            });
-            assert!(result.is_ok());
-            assert_eq!(attempts.load(Ordering::SeqCst), 3);
-        }
-    }
-
-    #[test]
-    #[cfg(windows)]
-    fn transient_lock_retry_returns_last_error_after_exhausting_delays() {
-        use std::sync::atomic::{AtomicUsize, Ordering};
-
-        let attempts = AtomicUsize::new(0);
-        let result: std::io::Result<()> = retry_transient_lock(&[Duration::ZERO], || {
-            attempts.fetch_add(1, Ordering::SeqCst);
-            Err(std::io::Error::from_raw_os_error(5))
-        });
-        assert_eq!(attempts.load(Ordering::SeqCst), 2);
-        assert_eq!(result.unwrap_err().raw_os_error(), Some(5));
-    }
-
-    #[test]
-    fn transient_lock_retry_does_not_retry_other_errors() {
-        use std::sync::atomic::{AtomicUsize, Ordering};
-
-        let attempts = AtomicUsize::new(0);
-        let result: std::io::Result<()> = retry_transient_lock(&[Duration::ZERO; 3], || {
-            attempts.fetch_add(1, Ordering::SeqCst);
-            Err(std::io::Error::from_raw_os_error(2))
-        });
-        assert_eq!(attempts.load(Ordering::SeqCst), 1);
-        assert_eq!(result.unwrap_err().raw_os_error(), Some(2));
-    }
-
-    #[test]
-    #[cfg(unix)]
-    fn transient_lock_retry_treats_windows_lock_codes_as_final_on_unix() {
-        use std::sync::atomic::{AtomicUsize, Ordering};
-
-        // Raw code 5 on Unix is EIO, not a Windows lock error, so the retry gate must leave it final.
-        let attempts = AtomicUsize::new(0);
-        let result: std::io::Result<()> = retry_transient_lock(&[Duration::ZERO; 3], || {
-            attempts.fetch_add(1, Ordering::SeqCst);
-            Err(std::io::Error::from_raw_os_error(5))
-        });
-        assert_eq!(attempts.load(Ordering::SeqCst), 1
```

**File**: `crates/dbx-plugin-runtime/src/plugins/marketplace.rs` (modified, +2/-1)
```diff
@@ -4,6 +4,7 @@ use std::io::Write;
 use std::path::{Path, PathBuf};
 use std::time::Duration;
 
+use dbx_platform::fs_retry::rename_with_transient_lock_retry;
 use fs2::FileExt;
 use reqwest::redirect::Policy;
 use reqwest::{Client, Url};
@@ -804,7 +805,7 @@ fn write_json_atomically<T: Serialize>(path: &Path, value: &T) -> Result<(), Str
     // std::fs::rename atomically replaces an existing destination on POSIX
     // and Windows alike; remove-then-rename could lose the repository
     // document to a crash between the two calls.
-    crate::plugins::installer::rename_with_transient_lock_retry(&temporary, path).map_err(|error| error.to_string())?;
+    rename_with_transient_lock_retry(&temporary, path).map_err(|error| error.to_string())?;
     Ok(())
 }
 
```

**File**: `src-tauri/src/commands/update.rs` (modified, +166/-12)
```diff
@@ -85,10 +85,31 @@ impl UpdateDownloadProgressGate {
 
 enum PendingUpdate {
     Downloading(Arc<DownloadCancellation>),
+    /// The package is being renamed into the cache. Cancel is recorded on the token, but the slot
+    /// stays occupied so another download cannot start and cache cleanup cannot sweep staging.
+    Committing(Arc<DownloadCancellation>),
     Installing,
     Ready(Box<CachedUpdate>),
 }
 
+/// Clears a commit slot that `finish_commit` did not finish, including when the commit panics.
+struct CommitGuard<'a> {
+    state: &'a PendingUpdateState,
+    cancellation: &'a Arc<DownloadCancellation>,
+}
+
+impl Drop for CommitGuard<'_> {
+    fn drop(&mut self) {
+        let Ok(mut pending) = self.state.pending.lock() else { return };
+        if matches!(
+            pending.as_ref(),
+            Some(PendingUpdate::Committing(current)) if Arc::ptr_eq(current, self.cancellation)
+        ) {
+            *pending = None;
+        }
+    }
+}
+
 struct CachedUpdate {
     record: CacheRecord,
     ready: ReadyUpdate,
@@ -161,6 +182,19 @@ impl PendingUpdateState {
         update: CachedUpdate,
         root: &std::path::Path,
     ) -> Result<(), String> {
+        let guard = self.begin_commit(cancellation)?;
+        let bytes = match &update.ready {
+            ReadyUpdate::Installer { bytes, .. } => bytes,
+            ReadyUpdate::Portable { archive, .. } => archive,
+        };
+        // `commit` retries while security software scans the package. That wait must not run
+        // under the state lock: cancel and a later download both need the lock, and holding it
+        // across the scan would publish a package the user had already canceled.
+        let committed = update_cache::commit(root, &update.record, bytes);
+        self.finish_commit(guard, update, root, committed)
+    }
+
+    fn begin_commit<'a>(&'a self, cancellation: &'a Arc<DownloadCancellation>) -> Result<CommitGuard<'a>, String> {
         let mut pending = self.pending.lock().map_err(|_| "Update state is unavailable.".to_string())?;
         let is_current = matches!(
             pending.as_ref(),
@@ -170,13 +204,63 @@ impl PendingUpdateState {
         if !is_current {
             return Err(DOWNLOAD_CANCELED_ERROR.to_string());
         }
-        let bytes = match &update.ready {
-            ReadyUpdate::Installer { bytes, .. } => bytes,
-            ReadyUpdate::Portable { archive, .. } => archive,
+        *pending = Some(PendingUpdate::Committing(Arc::clone(cancellation)));
+        drop(pending);
+        Ok(CommitGuard { state: self, cancellation })
+    }
+
+    fn finish_commit(
+        &self,
+        guard: CommitGuard<'_>,
+        update: CachedUpdate,
+        root: &std::path::Path,
+        committed: Result<(), String>,
+    ) -> Result<(), String> {
+        let canceled = {
+            let mut pending = self.pending.lock().map_err(|_| "Update state is unavailable.".to_string())?;
+            if !Self::is_our_commit(&pending, guard.cancellation) {
+                drop(pending);
+                return Err("Update state is unavailable.".into());
+            }
+            if guard.cancellation.is_canceled() {
+                true
+            } else if let Err(error) = committed {
+                *pending = None;
+                drop(pending);
+                return Err(error);
+            } else {
+                *pending = Some(PendingUpdate::Ready(Box::new(update)));
+                false
+            }
         };
-        update_cache::commit(root, &update.record, bytes)?;
-        *pending = Some(PendingUpdate::Ready(Box::new(update)));
-        Ok(())
+        if !canceled {
+            return Ok(());
+        }
+        // Stay in `Committing` while the package is removed so a new download cannot observe
+        // or replace the cache directory mid-delete.
+        self.discard_canceled_cache(root);
+        self.clear_our_commit(guard.cancellation);
+        Err(DOWNLOAD_CANCELED_ERROR.to_string())
+    }
+
+    fn discard_canceled_cache(&self, root: &std::path::Path) {
+        if let Err(error) = update_cache::discard(root) {
+            eprintln!("[DBX updater] failed to discard a canceled update cache: {error}");
+        }
+    }
+
+    fn clear_our_commit(&self, cancellation: &Arc<DownloadCancellation>) {
+        let Ok(mut pending) = self.pending.lock() else { return };
+        if Self::is_our_commit(&pending, cancellation) {
+            *pending = None;
+        }
+    }
+
+    fn is_our_commit(pending: &Option<PendingUpdate>, cancellation: &Arc<DownloadCancellation>) -> bool {
+        matches!(
+            pending.as_ref(),
+            Some(PendingUpdate::Committing(current)) if Arc::ptr_eq(current, cancellation)
+        )
     }
 
     fn finish_failed_download(&self, cancellation: &Arc<DownloadCancellation>) -> Result<(), String> {
@@ -192,11 +276,22 @@ impl PendingUpdateState {
     }
 
     pub fn cancel_download(&self) {
-        if let Ok
```

**File**: `src-tauri/src/commands/update_cache.rs` (modified, +172/-13)
```diff
@@ -1,10 +1,16 @@
 //! A single committed update. The directory rename is the commit point; partial writes are never read.
+//!
+//! Security software opens a freshly written package to scan it, which makes Windows reject
+//! directory removal and the commit rename for a moment. `commit` retries that transient lock
+//! so a scan cannot turn a finished download into a failed one.
+use dbx_platform::fs_retry::{retry_transient_lock, TRANSIENT_LOCK_RETRY_DELAYS};
 use serde::{Deserialize, Serialize};
 use sha2::{Digest, Sha256};
 use std::{
     fs,
     io::{Read, Write},
     path::{Path, PathBuf},
+    time::Duration,
 };
 
 fn default_is_promoted() -> bool {
@@ -60,6 +66,18 @@ fn write_synced(path: &Path, bytes: &[u8]) -> Result<(), String> {
 }
 
 pub(super) fn commit(root: &Path, record: &CacheRecord, bytes: &[u8]) -> Result<(), String> {
+    commit_with(root, record, bytes, &TRANSIENT_LOCK_RETRY_DELAYS, |src, dst| fs::rename(src, dst))
+}
+
+/// `commit` with an injectable rename so tests can prove the transient-lock retry without
+/// racing a real antivirus scan.
+fn commit_with(
+    root: &Path,
+    record: &CacheRecord,
+    bytes: &[u8],
+    retry_delays: &[Duration],
+    mut rename: impl FnMut(&Path, &Path) -> std::io::Result<()>,
+) -> Result<(), String> {
     let metadata = serde_json::to_vec(record).map_err(|e| e.to_string())?;
     if metadata.len() > 4 * 1024 * 1024 || bytes.len() > 512 * 1024 * 1024 {
         return Err("Cached update exceeds size limits.".into());
@@ -75,11 +93,14 @@ pub(super) fn commit(root: &Path, record: &CacheRecord, bytes: &[u8]) -> Result<
         #[cfg(unix)]
         fs::File::open(&staging).and_then(|dir| dir.sync_all()).map_err(|e| e.to_string())?;
         let ready = root.join("ready");
-        // Windows cannot rename onto an existing directory: `fs::rename` fails with
-        // `os error 5` when `ready` is still present from an earlier attempt. Clear
-        // it first so the commit is idempotent and does not need a manual retry.
-        discard(root)?;
-        fs::rename(&staging, &ready)
+        // Windows cannot rename onto an existing directory, and a scanner can hold that
+        // previous tree open with the same access-denied error as the commit rename.
+        discard_with(root, retry_delays, remove_cache_entry)?;
+        // A real-time antivirus/EDR scanner opens the freshly written package for a moment.
+        // While that handle exists Windows rejects the directory rename with `os error 5`,
+        // even though the scan releases it shortly after, so wait out the scan instead of
+        // failing the download and making the user transfer the package again.
+        retry_transient_lock(retry_delays, || rename(&staging, &ready))
             .map_err(|error| context("Failed to finalize the DBX update cache", &ready, error))?;
         #[cfg(unix)]
         fs::File::open(root).and_then(|dir| dir.sync_all()).map_err(|e| e.to_string())?;
@@ -175,16 +196,27 @@ pub(super) fn cleanup_partial(root: &Path) -> Result<(), String> {
 }
 
 pub(super) fn discard(root: &Path) -> Result<(), String> {
-    let ready = root.join("ready");
-    let result = if fs::symlink_metadata(&ready).is_ok_and(|m| !m.file_type().is_dir()) {
-        fs::remove_file(&ready)
+    discard_with(root, &TRANSIENT_LOCK_RETRY_DELAYS, remove_cache_entry)
+}
+
+fn remove_cache_entry(path: &Path) -> std::io::Result<()> {
+    if fs::symlink_metadata(path).is_ok_and(|metadata| !metadata.file_type().is_dir()) {
+        fs::remove_file(path)
     } else {
-        fs::remove_dir_all(&ready)
-    };
-    match result {
+        fs::remove_dir_all(path)
+    }
+}
+
+fn discard_with(
+    root: &Path,
+    retry_delays: &[Duration],
+    mut remove: impl FnMut(&Path) -> std::io::Result<()>,
+) -> Result<(), String> {
+    let ready = root.join("ready");
+    match retry_transient_lock(retry_delays, || remove(&ready)) {
         Ok(()) => Ok(()),
-        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
-        Err(e) => Err(context("Failed to clear the previous DBX update cache", &ready, e)),
+        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
+        Err(error) => Err(context("Failed to clear the previous DBX update cache", &ready, error)),
     }
 }
 
@@ -196,6 +228,31 @@ pub(super) fn root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
 #[cfg(test)]
 mod tests {
     use super::*;
+    use std::time::Duration;
+
+    fn record_for(bytes: &[u8]) -> CacheRecord {
+        CacheRecord {
+            schema_version: 1,
+            package_kind: "test".into(),
+            package_length: bytes.len() as u64,
+            package_sha256: digest(bytes),
+            info: DownloadedUpdate {
+                cache_id: "test".into(),
+                version: "99.0.0".into(),
+                portable_mode: false,
+                release_url: String::new(),
+                release_notes: String::new(),
+                do
```

---

### Incident Patch 2: `64184374` (2026-11-14)
**Commit Message**: fix(editor): keep structure peek panels below modal dialogs (#14967)

* fix(editor): keep structure peek panels below modal dialogs

Opening "View DDL" while a structure peek panel was up produced a broken
stack: the peek panel shared the dialog layer band, so it drew over the
dialog's overlay while the dialog's modal pointer-event guard still blocked
it -- the panel looked on top but could not be focused or closed, and the
window order was unpredictable.

Peek panels are modeless, so allocate their z-index from a dedicated band
(40-49) that always stays below dialog layers (which start at 50). Repeated
activations can no longer climb into the dialog band.

Refs #14966

* fix(editor): stack peek panels by activation order

Keeping modeless peek panels below modal dialogs by allocating from a
monotonic counter that saturates at the top of the band breaks the existing
bring-to-front behaviour: after enough activations two panels share a
layer, so the panel clicked last can no longer be raised above the other.

Keep panels in activation order instead and derive their z-index from that
order, so any number of activations keeps a strict order inside the band.
Expose BASE_DIALOG_Z_INDEX 

**File**: `apps/desktop/src/components/editor/QueryEditor.vue` (modified, +21/-7)
```diff
@@ -57,7 +57,7 @@ import type { ColumnInfo } from "@/types/database";
 import { createColumnReferencePayload, tableReferenceInsertText } from "@/lib/editor/queryEditorTableDrop";
 import { clearRememberedFocusedQueryEditorView, focusedQueryEditorView, queryEditorInsertContext, registerQueryEditorInsertContext, rememberFocusedQueryEditorView, unregisterQueryEditorInsertContext } from "@/lib/editor/focusedQueryEditorView";
 import { loadObjectMetadataFacet } from "@/lib/metadata/objectMetadataCache";
-import { structurePeekPanelId } from "@/lib/editor/structurePeekPanel";
+import { structurePeekPanelId, structurePeekZIndexesByOrder } from "@/lib/editor/structurePeekPanel";
 import { createQueryEditorNativeSelectionGuard, parkEditorNativeSelection, type EditorNativeSelectionPark } from "@/lib/editor/queryEditorNativeSelection";
 import CodeSnapshotDialog from "@/components/codeSnapshot/CodeSnapshotDialog.vue";
 import QueryEditorContextMenu, { type QueryEditorContextMenuState, type QueryEditorContextMenuActions } from "./QueryEditorContextMenu.vue";
@@ -366,18 +366,32 @@ interface StructurePeekPanelState {
 
 const structurePeekPanels = ref<StructurePeekPanelState[]>([]);
 let structurePeekRequestSeq = 0;
-let structurePeekZIndexSeq = 50;
 let structurePeekCascadeSeq = 0;
 
+/**
+ * Peek panels are kept in activation order (back to front) and their z-index is
+ * derived from that order, so any number of activations keeps a strict order and
+ * the stack never leaves the band below modal dialogs.
+ */
+function restackStructurePeekPanels() {
+  const zIndexes = structurePeekZIndexesByOrder(structurePeekPanels.value.length);
+  structurePeekPanels.value.forEach((panel, index) => {
+    panel.zIndex = zIndexes[index] ?? panel.zIndex;
+  });
+}
+
 function bringStructurePeekToFront(panelId: string) {
-  const panel = structurePeekPanels.value.find((item) => item.id === panelId);
+  const index = structurePeekPanels.value.findIndex((item) => item.id === panelId);
+  if (index < 0) return;
+  const [panel] = structurePeekPanels.value.splice(index, 1);
   if (!panel) return;
-  structurePeekZIndexSeq += 1;
-  panel.zIndex = structurePeekZIndexSeq;
+  structurePeekPanels.value.push(panel);
+  restackStructurePeekPanels();
 }
 
 function closeStructurePeekPanel(panelId: string) {
   structurePeekPanels.value = structurePeekPanels.value.filter((item) => item.id !== panelId);
+  restackStructurePeekPanels();
 }
 
 async function loadStructurePeekColumns(panelId: string, requestId: number, target: SqlObjectNavigationTarget, database: string, schema: string) {
@@ -427,7 +441,6 @@ async function openTableStructurePeek(target: SqlObjectNavigationTarget) {
     return;
   }
 
-  structurePeekZIndexSeq += 1;
   const requestId = ++structurePeekRequestSeq;
   const cascadeIndex = structurePeekCascadeSeq++;
   const panel: StructurePeekPanelState = {
@@ -436,11 +449,12 @@ async function openTableStructurePeek(target: SqlObjectNavigationTarget) {
     columns: [],
     loading: true,
     error: "",
-    zIndex: structurePeekZIndexSeq,
+    zIndex: 0,
     cascadeIndex,
     requestId,
   };
   structurePeekPanels.value = [...structurePeekPanels.value, panel];
+  restackStructurePeekPanels();
   await loadStructurePeekColumns(id, requestId, panel.target, database, schema);
 }
 
```

**File**: `apps/desktop/src/components/editor/TableStructurePeekDialog.vue` (modified, +2/-2)
```diff
@@ -5,7 +5,7 @@ import { useI18n } from "vue-i18n";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { formatMetadataColumnTypeLabel } from "@/lib/dataGrid/dataGridColumnType";
-import { STRUCTURE_PEEK_MIN_HEIGHT, STRUCTURE_PEEK_MIN_WIDTH, centeredStructurePeekRect, clampStructurePeekRect, defaultStructurePeekSize, resizeStructurePeekRect, type StructurePeekResizeEdge } from "@/lib/editor/structurePeekPanel";
+import { STRUCTURE_PEEK_MAX_Z_INDEX, STRUCTURE_PEEK_MIN_HEIGHT, STRUCTURE_PEEK_MIN_WIDTH, centeredStructurePeekRect, clampStructurePeekRect, defaultStructurePeekSize, resizeStructurePeekRect, type StructurePeekResizeEdge } from "@/lib/editor/structurePeekPanel";
 import { shouldPreserveEditorFocusOnPeekPointerDown } from "@/lib/editor/focusedQueryEditorView";
 import { tableColumnDefaultDisplayValue } from "@/lib/table/tableColumnDefaultPresentation";
 import { filterObjectBrowserTableColumns, sortObjectBrowserTableColumns, type ObjectBrowserTableColumnSort, type ObjectBrowserTableColumnSortKey } from "@/lib/table/objectBrowserTableInfo";
@@ -82,7 +82,7 @@ const panelStyle = computed(() => {
     top: `${panelTop.value}px`,
     width: `${panelWidth.value}px`,
     height: `${panelHeight.value}px`,
-    zIndex: String(props.zIndex ?? 50),
+    zIndex: String(props.zIndex ?? STRUCTURE_PEEK_MAX_Z_INDEX),
   };
   if (interacting.value) style.transition = "none";
   return style;
```

**File**: `apps/desktop/src/components/ui/dialog/useDialogLayerOrder.ts` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 import { injectDialogRootContext, useForwardExpose } from "reka-ui";
 import { computed, onBeforeUnmount, onUpdated, ref, watch, watchPostEffect, type Ref } from "vue";
 
-const BASE_DIALOG_Z_INDEX = 50;
+export const BASE_DIALOG_Z_INDEX = 50;
 const DIALOG_TOP_Z_INDEX_VAR = "--dbx-dialog-top-z-index";
 const FLOATING_LAYER_Z_INDEX_VAR = "--dbx-floating-layer-z-index";
 
```

**File**: `apps/desktop/src/lib/__tests__/editor/structurePeekPanel.spec.ts` (modified, +50/-1)
```diff
@@ -1,5 +1,6 @@
 import { describe, expect, it } from "vitest";
-import { STRUCTURE_PEEK_MIN_HEIGHT, STRUCTURE_PEEK_MIN_WIDTH, clampStructurePeekRect, resizeStructurePeekRect, structurePeekPanelId } from "@/lib/editor/structurePeekPanel";
+import { BASE_DIALOG_Z_INDEX } from "@/components/ui/dialog/useDialogLayerOrder";
+import { STRUCTURE_PEEK_BASE_Z_INDEX, STRUCTURE_PEEK_DEPTH, STRUCTURE_PEEK_MAX_Z_INDEX, STRUCTURE_PEEK_MIN_HEIGHT, STRUCTURE_PEEK_MIN_WIDTH, clampStructurePeekRect, resizeStructurePeekRect, structurePeekPanelId, structurePeekZIndexesByOrder } from "@/lib/editor/structurePeekPanel";
 
 describe("structurePeekPanel", () => {
   it("builds a stable case-insensitive identity including catalog", () => {
@@ -42,4 +43,52 @@ describe("structurePeekPanel", () => {
     expect(grown.left).toBe(100);
     expect(grown.top).toBe(60);
   });
+
+  it("keeps peek panels in a layer band strictly below modal dialogs", () => {
+    expect(STRUCTURE_PEEK_MAX_Z_INDEX).toBeLessThan(BASE_DIALOG_Z_INDEX);
+    expect(STRUCTURE_PEEK_BASE_Z_INDEX).toBeLessThan(STRUCTURE_PEEK_MAX_Z_INDEX);
+    expect(STRUCTURE_PEEK_DEPTH).toBe(STRUCTURE_PEEK_MAX_Z_INDEX - STRUCTURE_PEEK_BASE_Z_INDEX + 1);
+  });
+
+  it("stacks open panels by activation order so the last activated one stays on top", () => {
+    // Mirror the editor: `open` holds panels back to front, z-index comes from order.
+    let open: string[] = [];
+    const zIndexOf = (panelId: string) => structurePeekZIndexesByOrder(open.length)[open.indexOf(panelId)]!;
+    const openPanel = (panelId: string) => {
+      open = [...open, panelId];
+    };
+    const activate = (panelId: string) => {
+      open = [...open.filter((item) => item !== panelId), panelId];
+    };
+
+    openPanel("a");
+    openPanel("b");
+    expect(zIndexOf("b")).toBeGreaterThan(zIndexOf("a"));
+
+    // Repeated A/B/A cycles must not saturate: whichever panel is activated last wins.
+    for (let round = 0; round < 24; round += 1) {
+      const top = round % 2 === 0 ? "a" : "b";
+      const other = top === "a" ? "b" : "a";
+      activate(top);
+      expect(zIndexOf(top)).toBe(STRUCTURE_PEEK_MAX_Z_INDEX);
+      expect(zIndexOf(top)).toBeGreaterThan(zIndexOf(other));
+    }
+  });
+
+  it("keeps the front panels in strict order no matter how many are open", () => {
+    expect(structurePeekZIndexesByOrder(0)).toEqual([]);
+
+    const count = 20;
+    const zIndexes = structurePeekZIndexesByOrder(count);
+    expect(zIndexes).toHaveLength(count);
+    expect(zIndexes[count - 1]).toBe(STRUCTURE_PEEK_MAX_Z_INDEX);
+    for (const zIndex of zIndexes) {
+      expect(zIndex).toBeGreaterThanOrEqual(STRUCTURE_PEEK_BASE_Z_INDEX);
+      expect(zIndex).toBeLessThan(BASE_DIALOG_Z_INDEX);
+    }
+    // The `STRUCTURE_PEEK_DEPTH` front panels stay strictly ordered; older ones share the base layer.
+    for (let index = count - STRUCTURE_PEEK_DEPTH + 1; index < count; index += 1) {
+      expect(zIndexes[index]!).toBeGreaterThan(zIndexes[index - 1]!);
+    }
+  });
 });
```

**File**: `apps/desktop/src/lib/editor/structurePeekPanel.ts` (modified, +34/-0)
```diff
@@ -9,6 +9,40 @@ export const STRUCTURE_PEEK_MIN_WIDTH = 360;
 export const STRUCTURE_PEEK_MIN_HEIGHT = 240;
 export const STRUCTURE_PEEK_CASCADE = 24;
 
+/**
+ * Peek panels are modeless windows, so they must stay below modal dialogs.
+ * Dialog layers start at 50 (BASE_DIALOG_Z_INDEX in useDialogLayerOrder), and
+ * allocating peek panels from the same band used to tie a panel with an open
+ * dialog: the dialog's overlay painted behind the panel while its modal
+ * pointer-event guard still blocked the panel, so the panel looked on top but
+ * could not be clicked or closed.
+ */
+export const STRUCTURE_PEEK_BASE_Z_INDEX = 40;
+export const STRUCTURE_PEEK_MAX_Z_INDEX = 49;
+
+/** Number of layers available inside the peek band. */
+export const STRUCTURE_PEEK_DEPTH = STRUCTURE_PEEK_MAX_Z_INDEX - STRUCTURE_PEEK_BASE_Z_INDEX + 1;
+
+/**
+ * z-indexes for `count` open panels, ordered bottom to top: the last entry is
+ * the panel the user activated most recently and always lands on
+ * STRUCTURE_PEEK_MAX_Z_INDEX, so the whole stack stays strictly below dialogs.
+ *
+ * Peek panels are re-stacked by their current order instead of being handed a
+ * monotonic counter. A counter saturates at the top of the band after a handful
+ * of activations, after which two panels share one layer and the older panel can
+ * no longer be raised above the newer one even when clicked last. With more open
+ * panels than band slots the ones furthest back share the base layer while the
+ * front STRUCTURE_PEEK_DEPTH panels keep a strict order.
+ */
+export function structurePeekZIndexesByOrder(count: number): number[] {
+  const total = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
+  return Array.from({ length: total }, (_unused, index) => {
+    const offset = Math.max(0, index - (total - STRUCTURE_PEEK_DEPTH));
+    return STRUCTURE_PEEK_BASE_Z_INDEX + offset;
+  });
+}
+
 export function defaultStructurePeekSize(viewportWidth: number, viewportHeight: number): { width: number; height: number } {
   const maxWidth = Math.max(STRUCTURE_PEEK_MIN_WIDTH, viewportWidth - STRUCTURE_PEEK_MARGIN * 2);
   const maxHeight = Math.max(STRUCTURE_PEEK_MIN_HEIGHT, viewportHeight - STRUCTURE_PEEK_MARGIN * 2);
```

---

### Incident Patch 3: `f91cc454` (2026-11-14)
**Commit Message**: feat(postgres): show row-level security from the sidebar (#14935)

* feat(postgres): show row-level security from the sidebar

* chore(i18n): autofill new translations

* chore: trigger CI for updated translations

---------

Co-authored-by: ThugKd <[REDACTED_EMAIL]>
Co-authored-by: dbx-i18n-bot <github-actions[bot]@users.noreply.github.com>

**File**: `apps/desktop/src/components/sidebar/SidebarTreeRuntimeHost.vue` (modified, +28/-0)
```diff
@@ -3317,6 +3317,31 @@ async function openDatabaseObjectDependencies() {
   }
 }
 
+async function openPostgresRowLevelSecurity(node: TreeNode) {
+  if (!node.connectionId || !hasTreeNodeDatabaseContext(node) || (node.type === "schema" && !node.schema)) return;
+  // An escape string keeps schema names containing backslashes safe with either
+  // setting of standard_conforming_strings.
+  const schemaFilter = node.type === "schema" && node.schema ? `\n  AND n.nspname = E'${node.schema.replaceAll("\\", "\\\\").replaceAll("'", "''")}'` : "";
+  const sql = `SELECT n.nspname AS schema_name, c.relname AS table_name,
+       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced,
+       p.policyname AS policy_name, p.permissive, p.roles, p.cmd AS command,
+       p.qual AS using_expression, p.with_check AS check_expression
+FROM pg_catalog.pg_class AS c
+JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
+LEFT JOIN pg_catalog.pg_policies AS p ON p.schemaname = n.nspname AND p.tablename = c.relname
+WHERE (c.relrowsecurity OR c.relforcerowsecurity OR p.policyname IS NOT NULL)${schemaFilter}
+ORDER BY n.nspname, c.relname, p.policyname;`;
+  try {
+    await connectionStore.ensureConnected(node.connectionId);
+    connectionStore.activeConnectionId = node.connectionId;
+    const title = `${t("contextMenu.viewPostgresRowLevelSecurity")} - ${node.label}`;
+    const tabId = queryStore.createTab(node.connectionId, node.database, title, "query", node.schema, sql, node.catalog, { forceNew: true });
+    await queryStore.executeTabSql(tabId, sql);
+  } catch (error) {
+    toast(t("contextMenu.tableOperationFailed", { message: error instanceof Error ? error.message : String(error) }), 5000);
+  }
+}
+
 async function compileXuguObject() {
   const node = activeNode.value;
   if (currentDatabaseType() !== "xugu" || !node.connectionId || !node.database) return;
@@ -7833,6 +7858,9 @@ function buildDatabaseSidebarMenu(context: SidebarMenuFactoryContext): boolean {
     if (canOpenObjectBrowser.value) {
       items.push({ sidebarActionId: "contextMenu.openObjectBrowser", label: t("contextMenu.openObjectBrowser"), action: openObjectBrowser, icon: TableProperties });
     }
+    if (currentDatabaseType() === "postgres" && hasTreeNodeDatabaseContext(node)) {
+      items.push({ sidebarActionId: "contextMenu.viewPostgresRowLevelSecurity", label: t("contextMenu.viewPostgresRowLevelSecurity"), action: () => openPostgresRowLevelSecurity(node), icon: ShieldCheck });
+    }
     if (canCreateOracleTriggerAt(node)) items.push({ sidebarActionId: "contextMenu.createTrigger", label: t("contextMenu.createTrigger"), action: createOracleTrigger, icon: Plus });
     if (supportsConnectionQueryActions(currentDatabaseType())) {
       items.push({ sidebarActionId: "contextMenu.newQuery", label: t("contextMenu.newQuery"), action: newQuery, icon: TerminalSquare });
```

**File**: `apps/desktop/src/i18n/locales/en.ts` (modified, +1/-0)
```diff
@@ -5357,6 +5357,7 @@ export default {
     editView: "Edit View",
     viewSource: "View Source",
     viewDependencies: "View Dependencies",
+    viewPostgresRowLevelSecurity: "View Row-Level Security",
     viewObject: "View",
     changeOpenMode: "Change open mode",
     copyDdl: "Copy DDL",
```

**File**: `apps/desktop/src/i18n/locales/es.ts` (modified, +1/-0)
```diff
@@ -5335,6 +5335,7 @@ export default withEnglishFallback({
     foreignKeyChecksEnable: "Habilitar",
     foreignKeyChecksDisable: "Deshabilitar",
     foreignKeyChecksHint: "De forma predeterminada, se usa la configuración de la sesión. Al deshabilitarla, se ejecuta con SET FOREIGN_KEY_CHECKS = 0, lo que permite procesar las tablas referenciadas en cualquier orden; después de la ejecución, se restaura el valor original.",
+    viewPostgresRowLevelSecurity: "Ver políticas de seguridad a nivel de fila",
   },
   visibleDatabases: {
     title: "Bases de datos visibles",
```

**File**: `apps/desktop/src/i18n/locales/it.ts` (modified, +1/-0)
```diff
@@ -5156,6 +5156,7 @@ export default withEnglishFallback({
     foreignKeyChecksEnable: "Abilita",
     foreignKeyChecksDisable: "Disabilita",
     foreignKeyChecksHint: "Per impostazione predefinita viene mantenuta l'impostazione della sessione. Se disabilitato, viene eseguito con SET FOREIGN_KEY_CHECKS = 0, così le tabelle referenziate possono essere gestite in qualsiasi ordine; al termine, il valore originale viene ripristinato.",
+    viewPostgresRowLevelSecurity: "Visualizza criteri di sicurezza a livello di riga",
   },
   visibleDatabases: {
     title: "Database Visibili",
```

**File**: `apps/desktop/src/i18n/locales/ja.ts` (modified, +1/-0)
```diff
@@ -5177,6 +5177,7 @@ export default withEnglishFallback({
     foreignKeyChecksEnable: "有効",
     foreignKeyChecksDisable: "無効",
     foreignKeyChecksHint: "デフォルトではセッション設定を引き継ぎます。無効時は SET FOREIGN_KEY_CHECKS = 0 で実行し、参照されるテーブルを任意の順序で処理できます。実行後は元の値に戻します。",
+    viewPostgresRowLevelSecurity: "行レベルセキュリティポリシーを表示",
   },
   visibleDatabases: {
     title: "表示するデータベース",
```

**File**: `apps/desktop/src/i18n/locales/ko.ts` (modified, +1/-0)
```diff
@@ -5089,6 +5089,7 @@ export default withEnglishFallback({
     foreignKeyChecksEnable: "활성화",
     foreignKeyChecksDisable: "비활성화",
     foreignKeyChecksHint: "기본적으로 세션 설정을 따릅니다. 비활성화하면 SET FOREIGN_KEY_CHECKS = 0으로 실행하며, 참조되는 테이블을 임의 순서로 처리할 수 있습니다. 실행 후 원래 값으로 복원합니다.",
+    viewPostgresRowLevelSecurity: "행 수준 보안 정책 보기",
   },
   visibleDatabases: {
     title: "표시할 데이터베이스",
```

**File**: `apps/desktop/src/i18n/locales/pt-BR.ts` (modified, +1/-0)
```diff
@@ -5154,6 +5154,7 @@ export default withEnglishFallback({
     foreignKeyChecksEnable: "Ativar",
     foreignKeyChecksDisable: "Desativar",
     foreignKeyChecksHint: "Por padrão, segue a configuração da sessão. Quando desativado, executa com SET FOREIGN_KEY_CHECKS = 0, permitindo processar as tabelas referenciadas em qualquer ordem; após a execução, o valor original é restaurado.",
+    viewPostgresRowLevelSecurity: "Ver políticas de segurança em nível de linha",
   },
   visibleDatabases: {
     title: "Bancos de dados visíveis",
```

**File**: `apps/desktop/src/i18n/locales/ru.ts` (modified, +1/-0)
```diff
@@ -5275,6 +5275,7 @@ export default withEnglishFallback({
     foreignKeyChecksEnable: "Включить",
     foreignKeyChecksDisable: "Отключить",
     foreignKeyChecksHint: "По умолчанию используется параметр сеанса. При отключении выполняется с SET FOREIGN_KEY_CHECKS = 0, что позволяет обрабатывать таблицы, на которые есть ссылки, в любом порядке; после выполнения исходное значение восстанавливается.",
+    viewPostgresRowLevelSecurity: "Просмотреть политики безопасности на уровне строк",
   },
   visibleDatabases: {
     title: "Видимые базы данных",
```

#### Recent Merged Pull Requests:
- **PR #14979** (2026-11-14): fix(oracle): scope metadata queries to requested object types (@Acd-kk)
- **PR #14975** (2026-11-14): feat(grid): 结果集筛选可视化——列头漏斗标识与单字段关闭 (@dienaso)
- **PR #14973** (2026-11-14): fix(plugin-sdk): encode nil capabilities as [] and tolerate null on initialize (@sx4im)
- **PR #14967** (2026-11-14): fix(editor): keep structure peek panels below modal dialogs (@xiaou61)
- **PR #14965** (2026-11-14): fix(sidebar): show table sizes for Doris and StarRocks tables (@xiaou61)
- **PR #14959** (2026-11-14): fix(object-browser): prioritize common columns and restore timestamps (@Acd-kk)

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

## X. updater): retry the update cache rename on transient Windows locks

**RULE**:
When implementing operations in `crates/dbx-platform/src/fs_retry.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in t8y2/dbx. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9ce79533`: updater): retry the update cache rename on transient Windows locks. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/dbx-platform/src/fs_retry.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
//! Retries for filesystem operations that security software can briefly block.
//!
//! Real-time antivirus/EDR scanners open a file right after it is written. On Windows a
//! directory rename is rejected with `ERROR_ACCESS_DENIED` (5) while any file below it is
//! still open, even when the opening handle allows delete sharing, and file operations can
//! fail with `ERROR_SHARING_VIOLATION` (32). The scan normally finishes well inside this
//! retry window, so callers can keep a single atomic rename as their commit point instead
//! of falling back to a non-atomic write protocol.

use std::path::Path;
use std::time::Duration;

/// Field reports put the scan window at roughly 1-2 seconds for a large installer, so this
/// budget gives the scanner several times that window. The plugin installer and the desktop
/// updater share it deliberately: both commit by renaming a freshly written package.
pub const TRANSIENT_LOCK_RETRY_DELAYS: [Duration; 5] = [
    Duration::from_millis(200),
    Duration::from_millis(400),
    Duration::from_millis(800),
    Duration::from_millis(1500),
    Duration::from_millis(2000),
];

/// Rename `src` to `dst`, retrying the transient Windows locks descr
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9ce79533` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
