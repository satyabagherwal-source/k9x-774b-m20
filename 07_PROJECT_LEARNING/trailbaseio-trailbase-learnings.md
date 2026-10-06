# Forensic Learning Record (Deep Inspection): trailbaseio/trailbase

> **Canonical Artifact**: `07_PROJECT_LEARNING/trailbaseio-trailbase-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/trailbaseio/trailbase](https://github.com/trailbaseio/trailbase))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:10:51.658Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `trailbaseio/trailbase`
- **Description**: An open, sub-millisecond, single-executable Firebase alternative with type-safe APIs, built-in WebAssembly runtime, realtime subscriptions, auth, MCP and admin UI built on Rust, SQLite (PG) & Wasmtime.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 5645 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/assets/js/admin/src/lib/utils.ts`
```
import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { stringify as uuidStringify } from "uuid";
import { urlSafeBase64Decode } from "trailbase";

import { showToast } from "@/components/ui/toast";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function pathJoin(parts: string[], sep?: string): string {
  const separator = sep ?? "/";
  const replace = new RegExp(`${separator}{1,}`, "g");
  return parts.join(separator).replace(replace, separator);
}

export function copyToClipboard(
  contents: string,
  showContents?: boolean,
  message?: string,
) {
  navigator.clipboard.writeText(contents);
  const msg = message ?? "Copied to clipboard";
  showToast({
    title: (showContents ?? false) ? `${msg}: ${contents}` : msg,
  });
}

export function tryParseInt(value: string): number | undefined {
  const n = parseInt(value.trim());
  return isNaN(n) ? undefined : n;
}

export function safeParseInt(value: string | undefined): number | undefined {
  if (value !== undefined) {
    try {
      return tryParseInt(value);
    } catch (err) {
      console.warn(err);
    }
  }
  return undefined;
}

export function tryParseBigInt(value: string): bigint | undefined {
  if (value === "") {
    return undefined;
  }

  try {
    return BigInt(value.trim());
  } catch {
    return undefined;
  }
}

export function tryParseFloat(value: string): number | undefined {
  const n = parseFloat(value.trim());
  return isNaN(n) ? undefined : n;
}

export function urlSafeBase64ToUuid(id: string): string {
  return uuidStringify(urlSafeBase64Decode(id));
}

export function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

export async function showSaveFileDialog(opts: {
  contents: () => Promise<ReadableStream<Uint8Array> | null>;
  filename: string;
  mimeType?: string;
}): Promise<boolean> {
  const stream = await opts.contents();
  if (stream === null) {
    return false;
  }

  // Not supported by firefox: https://developer.mozilla.org/en-US/docs/Web/API/Window/showSaveFilePicker#browser_compatibility
  // possible fallback: https://stackoverflow.com/a/67806663
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: opts.filename,
      });

      const writable = await handle.createWritable();
      await stream.pipeTo(writable);
    } catch (err) {
      // Ignore user abortions.
      if (err instanceof Error && err.name === "AbortError") {
        return false;
      }
      throw err;
    }
  } else {
    const blob = await readableStreamToBlob(stream, opts.mimeType);

    const saveFile = document.createElement("a");
    saveFile.href = URL.createObjectURL(blob);
    saveFile.download = opts.filename;
    saveFile.click();

    // Cleanup.
    setTimeout(() => {
      saveFile.remove();
      URL.revokeObjectURL(saveFile.href);
    }, 60 * 1000);
  }

  return true;
}

async function readableStreamToBlob(
  stream: ReadableStream<Uint8Array>,
  mimeType?: string,
) {
  const reader = stream.getReader();

  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
  }

  // Concatenate all chunks
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return new Blob([merged], { type: mimeType });
}

export function stringToReadableStream(s: string): ReadableStream {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(s));
      controller.close();
    },
  });
}

```

### Core Architecture Module: `crates/auth-ui/ui/src/lib/utils.ts`
```
import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

```

### Core Architecture Module: `crates/core/benches/benchmark.rs`
```
#![allow(clippy::needless_return)]

#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

use axum::body::Body;
use axum::extract::{Json, State};
use axum::http::{self, Request};
use base64::prelude::*;
use criterion::{Bencher, Criterion, Throughput, criterion_group, criterion_main};
use eventsource_stream::Eventsource;
use futures_util::StreamExt;
use hyper::StatusCode;
use serde::Deserialize;
use std::time::{Duration, Instant};
use tower::{Service, ServiceExt};

use trailbase::api::{
  CreateUserRequest, InitArgs, create_user_handler, login_with_password_for_test,
};
use trailbase::config::proto::{PermissionFlag, RecordApiConfig};
use trailbase::constants::RECORD_API_PATH;
use trailbase::{AppState, SocketAddr};
use trailbase::{DataDir, Server, ServerOptions};
use trailbase_sqlite::params;

#[derive(Clone, Debug, Deserialize)]
pub struct CreateRecordResponse {
  /// Url-Safe base64 encoded ids of the newly created record.
  pub ids: Vec<String>,
}

async fn create_chat_message_app_tables(
  conn: &trailbase_sqlite::Connection,
) -> Result<(), trailbase_sqlite::Error> {
  // Create a messages, chat room and members tables.
  conn
    .execute_batch(
      r#"
          CREATE TABLE room (
            id           BLOB PRIMARY KEY NOT NULL CHECK(is_uuid_v7(id)) DEFAULT(uuid_v7()),
            name         TEXT
          ) STRICT;

          CREATE TABLE message (
            id           INTEGER PRIMARY KEY,
            _owner       BLOB NOT NULL,
            room         BLOB NOT NULL,
            data         TEXT NOT NULL DEFAULT 'empty',

            -- on user delete, toombstone it.
            FOREIGN KEY(_owner) REFERENCES _user(id) ON DELETE SET NULL,
            -- On chatroom delete, delete message
            FOREIGN KEY(room) REFERENCES room(id) ON DELETE CASCADE
          ) STRICT;

          CREATE TABLE room_members (
            user         BLOB NOT NULL,
            room         BLOB NOT NULL,

            FOREIGN KEY(room) REFERENCES room(id) ON DELETE CASCADE,
            FOREIGN KEY(user) REFERENCES _user(id) ON DELETE CASCADE
          ) STRICT;
        "#,
    )
    .await?;

  return Ok(());
}

async fn add_room(
  conn: &trailbase_sqlite::Connection,
  name: &str,
) -> Result<[u8; 16], anyhow::Error> {
  let room: [u8; 16] = conn
    .write_query_row_get(
      "INSERT INTO room (name) VALUES ($1) RETURNING id",
      params!(name.to_string()),
      0,
    )
    .await?
    .unwrap();

  return Ok(room);
}

async fn add_user_to_room(
  conn: &trailbase_sqlite::Connection,
  user: [u8; 16],
  room: [u8; 16],
) -> Result<(), trailbase_sqlite::Error> {
  conn
    .execute(
      "INSERT INTO room_members (user, room) VALUES ($1, $2)",
      params!(user, room),
    )
    .await?;
  return Ok(());
}

struct Setup {
  app: Server,

  room: [u8; 16],
  user_x: [u8; 16],
  user_x_token: String,
}

pub(crate) async fn add_record_api_config(
  state: &AppState,
  api: RecordApiConfig,
) -> Result<(), anyhow::Error> {
  let mut config = (*state.get_config()).clone();
  config.record_apis.push(api);
  return Ok(state.validate_and_update_config(config, None).await?);
}

async fn setup_app() -> Result<Setup, anyhow::Error> {
  let data_dir = temp_dir::TempDir::new()?;

  let (_new, state) = AppState::init(InitArgs {
    data_dir: DataDir(data_dir.path().to_path_buf()),
    ..Default::default()
  })
  .await
  .unwrap();

  let app = Server::init(
    state,
    SocketAddr::parse("localhost:4020").unwrap(),
    ServerOptions {
      ..Default::default()
    },
  )
  .await?;

  let main_conn = app.state.connection_manager().main_entry();
  let conn = &main_conn.connection;

  create_chat_message_app_tables(conn).await?;
  app.state.rebuild_connection_metadata().await?;

  let room = add_room(conn, "room0").await?;
  let password = "Secret!1!!";

  let create_access_rule =
    r#"(SELECT 1 FROM room_members WHERE user = _USER_.id AND room = _REQ_.room)"#;

  add_record_api_config(
    &app.state,
    RecordApiConfig {
      name: Some("messages_api".to_string()),
      table_name: Some("message".to_string()),
      acl_authenticated: [PermissionFlag::Read as i32, PermissionFlag::Create as i32].into(),
      create_access_rule: Some(create_access_rule.to_string()),
      ..Default::default()
    },
  )
  .await?;

  let email = "user_x@bar.com";
  let user_x = create_user_handler(
    State(app.state.clone()),
    Json(CreateUserRequest {
      email: Some(email.to_string()),
      username: None,
      password: password.to_string(),
      verified: true,
      admin: false,
    }),
  )
  .await?
  .id
  .into_bytes();

  let user_x_token = login_with_password_for_test(
    &app.state,
    trailbase::api::UserIdentifier::Email(email.to_string()),
    password,
  )
  .await?
  .unwrap()
  .auth_token;

  add_user_to_room(conn, user_x, room).await?;

  return Ok(Setup {
    app,
    room,
    user_x,
    user_x_token,
  });
}

async fn check_health(router: &mut axum::Router<()>) -> Result<(), anyhow::Error> {
  let response = router
    .call(
      Request::builder()
        .method(http::Method::GET)
        .uri("/api/healthcheck")
        .body(Body::from(vec![]))
        .unwrap(),
    )
    .await?;

  if response.status() != StatusCode::OK {
    anyhow::bail!("Expected 'Ok' status");
  }

  let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
    .await
    .unwrap();

  if bytes.to_vec() != b"Ok" {
    anyhow::bail!("Expected 'Ok'");
  }

  return Ok(());
}

fn create_message_benchmark(b: &mut Bencher, runtime: &tokio::runtime::Runtime, setup: &Setup) {
  let authorization = format!("Bearer {}", setup.user_x_token);
  let body = {
    let request = serde_json::json!({
      "_owner": BASE64_URL_SAFE.encode(setup.user_x),
      "room": BASE64_URL_SAFE.encode(setup.room),
      "data": "user_x message to room",
    });

    serde_json::to_vec(&request).unwrap()
  };

  let request = move || {
    return Request::builder()
      .method(http::Method::POST)
      .uri(&format!("/{RECORD_API_PATH}/messages_api"))
      .header(http::header::CONTENT_TYPE, "application/json")
      .header(http::header::AUTHORIZATION, &authorization)
      .body(Body::from(body.clone()))
      .unwrap();
  };

  b.to_async(runtime).iter_custom(async |iters| {
    let start = Instant::now();

    let tasks = (0..iters).map(|_i| {
      let request = request.clone();
      let mut router = setup.app.main_router.1.clone();

      return runtime.spawn(async move {
        let response = router.call(request()).await.unwrap();
        assert!(response.status().is_success());
      });
    });

    futures_util::future::join_all(tasks).await;

    return start.elapsed();
  });
}

fn read_message_benchmark(b: &mut Bencher, runtime: &tokio::runtime::Runtime, setup: &Setup) {
  let authorization = format!("Bearer {}", setup.user_x_token);

  let ids = runtime.block_on({
    let mut router = setup.app.main_router.1.clone();
    let authorization = authorization.clone();

    async move {
      let body = serde_json::json!({
        "_owner": BASE64_URL_SAFE.encode(setup.user_x),
        "room": BASE64_URL_SAFE.encode(setup.room),
        "data": "user_x message to room",
      });

      let create_request = Request::builder()
        .method(http::Method::POST)
        .uri(&format!("/{RECORD_API_PATH}/messages_api"))
        .header(http::header::CONTENT_TYPE, "application/json")
        .header(http::header::AUTHORIZATION, &authorization)
        .body(Body::from(serde_json::to_vec(&body).unwrap()))
        .unwrap();

      let response = router.call(create_request).await.unwrap();
      assert!(response.status().is_success());
      let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
      let created: CreateRecordResponse = serde_json::from_slice(&body).unwrap();
      return created.ids;
    }
  });

  let read_request = move || {
    Request::builder()
      .method(http::Method::GET)
      .uri(&format!(
        "/{RECORD_API_PATH}/messages_api/{id}",
        id = ids[0]
      ))
      .header(http::header::CONTENT_TYPE, "application/json")
      .header(http::header::AUTHORIZATION, &authorization)
      .body(Body::empty())
      .unwrap()
  };

  b.to_async(runtime).iter_custom(async |iters| {
    let start = Instant::now();

    let tasks = (0..iters).map(|_i| {
      let read_request = read_request.clone();
      let mut router = setup.app.main_router.1.clone();

      return runtime.spawn(async move {
        let response = router.call(read_request()).await.unwrap();
        assert!(response.status().is_success());
      });
    });

    futures_util::future::join_all(tasks).await;

    return start.elapsed();
  });
}

fn list_message_benchmark(b: &mut Bencher, runtime: &tokio::runtime::Runtime, setup: &Setup) {
  let authorization = format!("Bearer {}", setup.user_x_token);

  let request = move || {
    return Request::builder()
      .method(http::Method::GET)
      .uri(&format!("/{RECORD_API_PATH}/messages_api?limit=50"))
      .header(http::header::CONTENT_TYPE, "application/json")
      .header(http::header::AUTHORIZATION, &authorization)
      .body(Body::empty())
      .unwrap();
  };

  b.to_async(runtime).iter_custom(async |iters| {
    let start = Instant::now();

    let tasks = (0..iters).map(|_i| {
      let request = request.clone();
      let mut router = setup.app.main_router.1.clone();

      return runtime.spawn(async move {
        let response = router.call(request()).await.unwrap();
        assert!(response.status().is_success());
      });
    });

    futures_util::future::join_all(tasks).await;

    return start.elapsed();
  });
}

fn subscribe_message_benchmark(b: &mut Bencher, runtime: &tokio::runtime::Runtime, setup: &Setup) {
  let authorization = format!("Bearer {}", setup.user_x_token);
  let create_request_body = {
    let request = serde_json::json!({
      "_owner": BASE64_URL_SAFE.encode(setup.u
```

### Core Architecture Module: `crates/core/bindings/ListWasmModulesResponse.ts`
```
// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { WasmModuleEntry } from "./WasmModuleEntry";

export type ListWasmModulesResponse = { modules: Array<WasmModuleEntry>, };

```

### Core Architecture Module: `crates/core/bindings/WasmModuleEntry.ts`
```
// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.

export type WasmModuleEntry = {
name: string,
display_name: string,
icon: string | null,
config_path: string | null,
description: string | null,
};

```

### Core Architecture Module: `crates/core/src/admin/backup.rs`
```
use axum::extract::{Json, State};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::admin::AdminError as Error;
use crate::app_state::AppState;
use crate::backup;

#[derive(Debug, Deserialize, Serialize, TS, utoipa::ToSchema)]
pub struct Backup {
  timestamp: i64,
}

#[derive(Debug, Deserialize, Serialize, TS, utoipa::ToSchema)]
#[ts(export)]
pub struct ListBackupsResponse {
  backups: Vec<Backup>,
}

#[utoipa::path(
  get,
  path = "/backups",
  tag = "admin",
  responses(
    (status = 200, description = "Success", body = ListBackupsResponse),
  )
)]
pub async fn list_backups_handler(
  State(state): State<AppState>,
) -> Result<Json<ListBackupsResponse>, Error> {
  return Ok(Json(ListBackupsResponse {
    backups: backup::find_backups(state.data_dir())
      .await?
      .into_iter()
      .map(|b| {
        return Backup {
          timestamp: b.timestamp.timestamp(),
        };
      })
      .collect(),
  }));
}

#[utoipa::path(
  post,
  path = "/backups/trigger",
  tag = "admin",
  responses(
    (status = 200, description = "Success", body = ListBackupsResponse),
  )
)]
pub async fn trigger_backup_handler(
  State(state): State<AppState>,
) -> Result<Json<ListBackupsResponse>, Error> {
  let backup_window_size =
    state.access_config(|c| c.server.backup_window_size.unwrap_or(5)) as usize;
  if backup_window_size == 0 {
    return Err(Error::Precondition(
      "Backups disabled. Window size explicitly set to 0".into(),
    ));
  }

  let data_dir = state.data_dir();

  let result =
    crate::backup::backup_all(data_dir, &state.connection_manager(), &state.get_config()).await;

  if let Err(err) = crate::backup::delete_backups(data_dir, backup_window_size).await {
    log::warn!("Failed to clean-up backups: {err}");
  }

  result?;

  return Ok(Json(ListBackupsResponse {
    backups: backup::find_backups(state.data_dir())
      .await?
      .into_iter()
      .map(|b| {
        return Backup {
          timestamp: b.timestamp.timestamp(),
        };
      })
      .collect(),
  }));
}

#[derive(Debug, Deserialize, Serialize, TS, utoipa::ToSchema)]
#[ts(export)]
pub struct DeleteBackupsRequest {
  timestamps: Vec<i64>,
}

#[utoipa::path(
  delete,
  path = "/backups/delete",
  tag = "admin",
  request_body = DeleteBackupsRequest,
  responses(
    (status = 200, description = "Success"),
  )
)]
pub async fn delete_backups_handler(
  State(state): State<AppState>,
  Json(request): Json<DeleteBackupsRequest>,
) -> Result<(), Error> {
  let backup_dir = state.data_dir().backup_path();
  for ts in request.timestamps {
    let instant = chrono::DateTime::from_timestamp(ts, 0)
      .ok_or_else(|| Error::Precondition("invalid timestamp".into()))?;

    tokio::fs::remove_dir_all(backup_dir.join(instant.timestamp().to_string()))
      .await
      .map_err(|err| Error::Other(err.to_string()))?;
  }

  return Ok(());
}

#[derive(Debug, Deserialize, Serialize, TS, utoipa::ToSchema)]
#[ts(export)]
pub struct RestoreBackupRequest {
  timestamp: i64,
}

#[utoipa::path(
  patch,
  path = "/backups/restore",
  tag = "admin",
  request_body = RestoreBackupRequest,
  responses(
    (status = 200, description = "Success"),
  )
)]
pub async fn restore_backup_handler(
  State(state): State<AppState>,
  Json(request): Json<RestoreBackupRequest>,
) -> Result<(), Error> {
  let instant = chrono::DateTime::from_timestamp(request.timestamp, 0)
    .ok_or_else(|| Error::Precondition("invalid timestamp".into()))?;

  let backup = backup::Backup {
    path: state
      .data_dir()
      .backup_path()
      .join(instant.timestamp().to_string()),
    timestamp: instant,
  };

  backup::restore_all(state.data_dir(), &backup).await?;

  return Ok(());
}

```

### Core Architecture Module: `crates/core/src/admin/config/get_config.rs`
```
use axum::extract::State;
use axum::http::{HeaderMap, header::CONTENT_TYPE};
use axum::response::{IntoResponse, Response};

use crate::admin::AdminError as Error;
use crate::app_state::AppState;
use crate::config::proto;
use crate::config::vault::redact_secrets;
use crate::extract::protobuf::{Protobuf, Textproto};

#[utoipa::path(
  get,
  path = "/config",
  tag = "admin",
  responses(
    (status = 200, content_type = "application/x-protobuf", description = "config.GetConfigResponse protobuf"),
    (status = 200, content_type = "text/plain", description = "config.GetConfigResponse textproto"),
  )
)]
pub async fn get_config_handler(
  State(state): State<AppState>,
  headers: HeaderMap,
) -> Result<Response, Error> {
  let config = state.get_config();
  let hash = proto::hash_config(&config);

  let (stripped, _secrets) = redact_secrets(&config)?;

  return match headers.get(CONTENT_TYPE) {
    Some(content_type) if content_type == "text/plain" => Ok(
      Textproto(proto::GetConfigResponse {
        config: Some(stripped),
        hash: Some(hash),
      })
      .into_response(),
    ),
    _ => Ok(
      Protobuf(proto::GetConfigResponse {
        config: Some(stripped),
        hash: Some(hash),
      })
      .into_response(),
    ),
  };
}

```

### Core Architecture Module: `crates/core/src/admin/config/mod.rs`
```
pub mod get_config;
pub mod update_config;

```

### Core Architecture Module: `crates/core/src/admin/config/update_config.rs`
```
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;

use crate::admin::AdminError as Error;
use crate::app_state::AppState;
use crate::config::proto;
use crate::config::vault::{merge_vault_and_env, redact_secrets};
use crate::extract::protobuf::ProtobufOrTextproto;

#[utoipa::path(
  post,
  path = "/config",
  tag = "admin",
  request_body(
    description = "config.UpdateConfigRequest protobuf",
    content(
      (Vec<u8> = "application/x-protobuf"),
      (String = "text/plain"),
    ),
  ),
  responses(
    (status = 200, description = "Success"),
  )
)]
pub async fn update_config_handler(
  State(state): State<AppState>,
  ProtobufOrTextproto(request): ProtobufOrTextproto<proto::UpdateConfigRequest>,
) -> Result<impl IntoResponse, Error> {
  if state.demo_mode() {
    return Err(Error::Precondition("Disallowed in demo".into()));
  }
  if state.read_only() {
    return Err(Error::Precondition("Disallowed in read-only".into()));
  }

  let Some(hash) = request.hash else {
    return Err(Error::Precondition("Missing hash".to_string()));
  };
  let Some(config) = request.config else {
    return Err(Error::Precondition("Missing config".to_string()));
  };

  let current = state.get_config();
  let (_, secrets) = redact_secrets(&current)?;

  let merged = merge_vault_and_env(config, proto::Vault { secrets })?;

  state.validate_and_update_config(merged, Some(hash)).await?;

  return Ok((StatusCode::OK, "Config updated"));
}

```

### Core Architecture Module: `crates/core/src/admin/email.rs`
```
use axum::{Json, extract::State};
use serde::Deserialize;
use ts_rs::TS;

use crate::admin::AdminError as Error;
use crate::app_state::AppState;
use crate::auth::util::validate_and_normalize_email_address;
use crate::email::Email;

/// Request the delivery of a test email.
///
/// NOTE: Email contents are deliberately not exposed to reduce opportunity for abuse. It's a
/// privilege for sys-admins using the CLI and the auth sub-system.
#[derive(Debug, Deserialize, TS, utoipa::ToSchema)]
#[ts(export)]
pub struct TestEmailRequest {
  /// Address to send test email to.
  email_address: String,
}

#[utoipa::path(
  post,
  path = "/email/test",
  tag = "admin",
  request_body = TestEmailRequest,
  responses(
    (status = 200, description = "Success"),
  )
)]
pub async fn test_email_handler(
  State(state): State<AppState>,
  Json(request): Json<TestEmailRequest>,
) -> Result<(), Error> {
  let email_address = validate_and_normalize_email_address(&request.email_address)?;

  let email = Email::new(
    &state,
    &email_address,
    "test email".to_string(),
    "This is a test. Do not reply".to_string(),
  )?;

  email.send().await?;

  return Ok(());
}

```

### Core Architecture Module: `crates/core/src/admin/error.rs`
```
use axum::body::Body;
use axum::http::{StatusCode, header::CONTENT_TYPE};
use axum::response::{IntoResponse, Response};
use thiserror::Error;

// FIXME: Admin APIs also deserve more explicit error handling eventually.
#[derive(Debug, Error)]
pub enum AdminError {
  #[error("TrailbaseSqlite error: {0}")]
  TrailbaseSqlite(#[from] trailbase_sqlite::Error),
  #[error("Rusqlite: {0}")]
  Rusqlite(#[from] rusqlite::Error),
  #[error("Connection: {0}")]
  Connection(#[from] crate::connection::ConnectionError),
  #[error("FromSql: {0}")]
  FromSql(#[from] trailbase_sqlite::from_sql::FromSqlError),
  #[error("Deserialization: {0}")]
  Deserialization(#[from] serde::de::value::Error),
  #[error("JsonSerialization: {0}")]
  JsonSerialization(#[from] serde_json::Error),
  #[error("Base64 decoding: {0}")]
  Base64Decode(#[from] base64::DecodeError),
  #[error("Already exists: {0}")]
  AlreadyExists(&'static str),
  #[error("Bad request: {0}")]
  BadRequest(Box<dyn std::error::Error + Send + Sync>),
  #[error("Precondition: {0}")]
  Precondition(String),
  #[error("Forbidden: {0}")]
  Forbidden(String),
  #[error("Internal: {0}")]
  Internal(Box<dyn std::error::Error + Send + Sync>),
  #[error("Schema: {0}")]
  Schema(#[from] trailbase_schema::db::sqlite::SchemaError),
  #[error("TableLookup: {0}")]
  TableLookup(#[from] crate::schema_metadata::SchemaLookupError),
  #[error("DBMigration: {0}")]
  Migration(#[from] trailbase_refinery::Error),
  #[error("SQL -> Json: {0}")]
  Json(#[from] trailbase_schema::json::JsonError),
  #[error("JsonSchema: {0}")]
  JsonSchemaError(#[from] trailbase_schema::json_schema::Error),
  #[error("Json -> SQL Params: {0}")]
  Params(#[from] crate::records::params::ParamsError),
  #[error("Config: {0}")]
  Config(#[from] crate::config::ConfigError),
  #[error("Auth: {0}")]
  Auth(#[from] crate::auth::AuthError),
  #[error("WhereClause: {0}")]
  WhereClause(#[from] crate::listing::WhereClauseError),
  #[error("Transaction: {0}")]
  Transaction(#[from] crate::transaction_recorder::TransactionError),
  #[error("JSON schema: {0}")]
  JSONSchema(#[from] crate::schema_metadata::JsonSchemaError),
  #[error("Email: {0}")]
  Email(#[from] crate::email::EmailError),
  #[error("Record: {0}")]
  Record(#[from] crate::records::RecordError),
  #[error("File: {0}")]
  File(#[from] crate::records::files::FileError),
  #[error("Backup: {0}")]
  Backup(#[from] crate::backup::BackupError),
  #[error("SqlValueDecode: {0}")]
  SqlValueDecode(#[from] trailbase_sqlvalue::DecodeError),
  #[error("Other: {0}")]
  Other(String),
}

impl IntoResponse for AdminError {
  fn into_response(self) -> Response {
    let (status, msg) = match self {
      // NOTE: For error types that already implement "into_response" we should just unpack them.
      // We should be able to use a generic for that.
      Self::Auth(err) => return err.into_response(),
      Self::Record(err) => return err.into_response(),
      Self::Deserialization(err) => (StatusCode::BAD_REQUEST, err.to_string()),
      Self::Precondition(_) => (StatusCode::PRECONDITION_FAILED, self.to_string()),
      Self::Forbidden(_) => (StatusCode::FORBIDDEN, self.to_string()),
      Self::BadRequest(err) => (StatusCode::BAD_REQUEST, err.to_string()),
      Self::Internal(err) => (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
      Self::AlreadyExists(_) => (StatusCode::CONFLICT, self.to_string()),
      // NOTE: We can almost always leak the internal error (except for permission errors) since
      // these are errors for the admin apis.
      err => (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
    };

    return Response::builder()
      .status(status)
      .header(CONTENT_TYPE, "text/plain")
      .body(Body::new(msg))
      .unwrap_or_default();
  }
}

```

### Core Architecture Module: `crates/core/src/admin/info.rs`
```
use axum::{Json, extract::State};
use serde::Serialize;
use trailbase_sqlite::ConnectionType;
use ts_rs::TS;

use crate::admin::AdminError as Error;
use crate::app_state::AppState;

#[derive(Clone, Debug, Default, Serialize, TS, utoipa::ToSchema)]
pub struct GitVersion {
  tag: String,
  offset: usize,
}

#[derive(Clone, Debug, Default, Serialize, TS, utoipa::ToSchema)]
#[ts(export)]
pub struct InfoResponse {
  /// Build metadata.
  compiler: Option<String>,
  /// Git metadata
  commit_hash: Option<String>,
  commit_date: Option<String>,
  git_version: Option<GitVersion>,
  /// Runtime metadata.
  threads: usize,
  command_line_arguments: Option<Vec<String>>,
  /// Start time in seconds since epoch,
  start_time: u64,
  /// Experimental Postgres mode
  postgres: bool,
}

#[utoipa::path(
  get,
  path = "/info",
  tag = "admin",
  responses(
    (status = 200, description = "Success", body = InfoResponse),
  )
)]
pub async fn info_handler(State(state): State<AppState>) -> Result<Json<InfoResponse>, Error> {
  return Ok(Json(build_info_response(&state)));
}

fn build_info_response(state: &AppState) -> InfoResponse {
  let version_info = state.version();
  let git_version = version_info.git_version().map(|v| GitVersion {
    tag: v.tag(),
    offset: v.commits_since.unwrap_or(0) as usize,
  });

  return InfoResponse {
    compiler: version_info.host_compiler,
    commit_hash: version_info.git_commit_hash,
    commit_date: version_info.git_commit_date,
    git_version,
    threads: std::thread::available_parallelism().map_or(0, |v| v.into()),
    command_line_arguments: Some(std::env::args().collect()),
    start_time: state
      .start_time()
      .duration_since(std::time::UNIX_EPOCH)
      .unwrap_or_default()
      .as_secs(),
    postgres: matches!(
      state
        .connection_manager()
        .main_entry()
        .connection
        .connection_type(),
      ConnectionType::Pg
    ),
  };
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #299** (2026-10-03): **Question: SSE authentication lifetime and renewal after access JWT expiry**
  *Symptoms*: This is a bounded lifecycle/semantics question, not a severity/CVE claim. All accounts, rows and backends are disposable owned fixtures. No tokens, identities, links, raw bodies or private logs are included.  ## Environment  TrailBase v0.34.3 (`eab5039392a624736ab0c6a9f07f6793423dc979`), macOS arm64, Node 22.23.2, native owner-protected `todos` API with subscriptions enabled. An explicit fresh-depot test profile sets `auth_token_ttl_sec: 3`; production/default fixture configuration is unchanged.  ## Reproduction  Harness command at the pinned reproduction checkout: `npm run test:phase-a -- expiry` (supported Node/Docker setup in the [repository README](https://github.com/burggraf/trailbase-supabase/blob/8b089da25057b6a74f066402634230423caf0c85/README.md)). It preserves the failing server-lifetime assertion separately from a client-only deadline proof.  1. Register and genuinely confirm an owned user, then explicitly log in. 2. Open the real native `/api/records/v1/todos/subscribe/*` stream with a genuine current access JWT. 3. Confirm the token claims' actual `exp - iat` is three seconds and an ordinary protected HTTP read using that same JWT initially succeeds. 4. Keep the stream open. Wait under an 80-second bound until an ordinary raw HTTP read using the original JWT is denied, allowing the server's real clock-skew grace. No token editing, fake clock or logout substitute is used. 5. Through a separately refreshed writer of the same owner, create a new protected row. 6. Obs
  **Post-Mortem & Fix Analysis**:
  > The semantics as implemented and described: authentication is checked on establishing the connection.  At least for SSE, which is one-way, users couldn't possibly provide new tokens. So the server could internally re-validate. It's unclear to me why token expiry would be the right time to re-validate, there's many reasons why an access restriction may no longer apply, e.g. table contents used in the access rule may changes, etc 🤷‍♀️   We can certainly change things around, but we'd need an understandable lifecycle definition first, which developers could also reason about. At the moment, the lifecycle model is very simple and the expectation is that access is granted for the entire lifetime of the stream
  > Thanks for clarifying the intended lifecycle. We'll align our compatibility contract with the implemented model: authentication is checked when the SSE connection is established, and access is expected to continue for that stream's lifetime; token expiry alone does not revalidate or close an established stream. We'll keep any client-side close/reconnect behavior distinct from a server-side authorization guarantee. This report was a lifecycle clarification, not a foreign-owner access or severity claim. The answer resolves our question, so we're closing it. If we later have a concrete, separately scoped lifecycle proposal, we'll open a new discussion.

- **Issue #298** (2026-10-05): **v0.34.3: duplicate pending email registrations block confirmation; resend misses pending accounts after SMTP failure**
  *Symptoms*: No real addresses, passwords, tokens, confirmation links, logs or admin credentials are included. Reproduce on disposable local resources only.  ## Environment  - TrailBase v0.34.3, commit `eab5039392a624736ab0c6a9f07f6793423dc979`. - Installed `trailbase@0.14.3` client; native SQLite backend. - macOS arm64, Node 22.23.2; confirmation-required email/password auth and local Mailpit SMTP. - Stock upstream auth migrations, no additional auth uniqueness constraints for the baseline reproduction. - Sanitized, source-hashed local evidence: [stock regression](https://github.com/burggraf/trailbase-supabase/blob/97e33ac/docs/evidence/phase-a-auth-stock-characterization.json). The broader previous failing run is [also preserved](https://github.com/burggraf/trailbase-supabase/blob/97e33ac/docs/evidence/phase-a-g1-blocker-node22.json).  ## Reproduction A: duplicate unconfirmed registration  1. Start a fresh local depot with real working SMTP and email confirmation enabled. 2. POST `/api/auth/v1/register` twice for the same new email before verification, with matching `password`/`password_repeat` in each request. The second request can use a different password. 3. Both requests return registration success without an authenticated session. 4. Follow a real delivered verification link. 5. Observed: confirmation returns HTTP 400; the intended original account cannot complete its normal confirmation/login flow. A fresh address registered once confirms normally.  Expected safety: duplicate sig
  **Post-Mortem & Fix Analysis**:
  > There's layers. The fact that you can try to register more than once and each time get one email, isn't inherently an issue. We definitely shouldn't `panic!` nor should we block out the user indefinitely. The origin of the issue is that we didn't initially have a separate unverified_email column and when introducing it a uniqueness constrained was overlooked. We might want to add this or change the `UPDATE` query to apply to not roll back on email uniqueness constraint violations. The latter would require different queries for SQLite and Postgres, so I'm leaning the former. Independently, we should also clean up old users with `unverified_email`s.

- **Issue #297** (2026-10-01): **Jobs page misreports WASM jobs: >20 s jobs show as failed, failing jobs show as successful**
  *Symptoms*: ## Summary  The outcome TrailBase records for a WASM job (`latest` in `GET /api/_admin/jobs`, shown on the admin UI's Jobs page, and the response of `POST /api/_admin/job/run`) is wrong in both directions:  1. **A job that runs longer than 20 s is recorded as failed**, with    `Timeout: Some(http://__job/?name=<job>)` and a duration of ~20 s, although    the guest keeps running in the background and completes. Because    `Job::run_now` returns at 20 s, the scheduler also stops waiting for the job,    so a job longer than its period runs several copies of itself at once. 2. **A job that fails is recorded as successful.** The TS guest SDK turns an    uncaught exception into a `500` response (`errorToOutgoingResponse`), and a    Rust job returning `Err(HttpError)` does the same, but the job callback    ignores the response status.  ## Reproduction  Built `trail` from `main` at `9054b6e` (v0.34.2) with `cargo build --release -p trailbase-cli --bin trail --no-default-features --features trailbase/wasm`. The guest is `client/testfixture/guests/rust` with these extra jobs added:  ```rust const SPEC: &str = "0 0 0 1 1 * 2099"; Job::new("probe_ok_fast", SPEC, None, async || -> Result<(), HttpError> { Ok(()) }).unwrap(), Job::new("probe_ok_25s", SPEC, None, async || -> Result<(), HttpError> {   Timer::after(Duration::from_secs(25)).wait().await;   eprintln!("PROBE_END probe_ok_25s");   Ok(()) }).unwrap(), Job::new("probe_err_fast", SPEC, None, async || -> Result<(), HttpError> {   Err(
  **Post-Mortem & Fix Analysis**:
  > Well spotted and sorry for the blatant bugs. I did take the liberty to clean-up the non-sensical second timeout entirely 🙏 

- **Issue #296** (2026-10-01): **Add audit GitHub workflow**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Much appreciated and thank you for pushing best practices. I will 100% merge this, I've just been fighting CI all day :hot_face: 
  > I tried it out on a fork. I was baffled, a <1min CI run :). Jokes aside, I can see quite a bit of activity on your end, so I was wondering if I should hold off. Otherwise, I'm happy to move forward :pray: . WDYT?
  > Yo, all is cool! You can proceed just fine. It's just that in the meantime another `compress` vulnerability has been reported. 😂  While the Rust `rsa` vulnerability has no fix yet, I believe that `csv-parse` and `stream-json` can be fixed by bumping dependencies. I'm not sure about the `compress` ones. Nevertheless, I think that it's better to let someone more fluent in this ecosystem do it.  PS. Believe it or not, I had been fighting CI in another project just a several days ago. 🤣

- **Issue #294** (2026-10-01): **Support `ON DELETE CASCADE` for foreign keys in table editor**
  *Symptoms*: Trailbase already supports cascading deletes if you manually write an SQL migration, as documented in https://trailbase.io/documentation/models_and_relations/#tables-schemas--data-types.  Since the table editor is much more convenient for people that are to stupid for writing SQL with syntax errors (including me), being able to set `DELETE CASCADE` in the editor would be very helpful. I imagine this to be a dropdown to choose between cascade / set null / set default / restrict that is shown as soon as you select a column to be a foreign table reference.  Afaik, the problem generally is that SQLite supports no ALTER COLUMN, but I think Trailbase already has inbuilt logic for copying things into a new database instead (otherwise all other column-changing migrations wouldn't work either).  I'd volunteer for working on this, but I want to discuss it first and see if this is desired / what to look out for.
  **Post-Mortem & Fix Analysis**:
  > > I'd volunteer for working on this, but I want to discuss it first and see if this is desired / what to look out for.  Much appreciated 🙏 - certainly prefer a quick chat over a late surprise :)  Generally, there's a whole bunch of column constraints (besides FKs) that are generally supported but not accessible through the schema editor UI. A complete list for Sqlite is here: https://sqlite.org/syntax/column-constraint.html.  I think there's a bunch of trade-offs that need to be balanced:  * The constraints are DB dependent, TB also supports PG * It's fine to not subject ourselves to the least-common-denominator problem and implement per-DB solutions, however than we need to make an inventory of which ones are the most worthy and how to realize the branching (right now we don't).   * In fact, now that you bring it up, I would expect the ALTER TABLE ui to be pretty broken for PG :hide: (yay, another rabbit hole :)) * Can we offer enough constrained convenience that it beats out asking 
  > Thanks a lot for the input 👍   I'm not sure when I will find time for it - if anyone else finds time and feels motivated to work on this before me, I wouldn't mind it :)
  > No worries, thought you wanted to give it a shot. The next release will sport referential actions 🙏 

- **Issue #293** (2026-09-18): **Add built-in helpers for expanded types to Kotlin client**
  *Symptoms*: Currently, you would need to use two different data types if you want to expand columns: - When sending data, only the id must be sent: `{"parent": "<id>"}` - When reading data, the response layout is different: `{"parent": {"id": "<id>", "data": {...}}}`  The `Expanded` type wrapper basically allows you to do both with a single type. - When serializing, it only serializes the id as a plain JSON string. - When deserializing, it deserializes id and data.  I personally find this very helpful (I wrote this for my own project and decided to try to upstream it) because I can handle everything with a single data type, which makes it much easier to keep all models up to date.  I also understand if you don't like this approach though, it's possible to create this wrapper type in your app without modifying the Trailbase Kotlin client.
  **Post-Mortem & Fix Analysis**:
  > > I also understand if you don't like this approach though, it's possible to create this wrapper type in your app without modifying the Trailbase Kotlin client.  I actually like this a lot: nifty way of dealing with conditional expansion. Also an interesting precedent for other languages.  I have only low-value nits to offer:  ```kotlin children.create(Child(parent = Expanded(parentId))) ```  may sound a bit definitive. I wonder if   ```kotlin children.create(Child(parent = Expandable(parentId))) ```  would reflect the conditional nature more (and follow Omittable's naming practices). I could also see an explicit initializer like `Omittable.Present()`, a la:  ```kotlin children.create(Child(parent = Expandable.Id(parentId))) ```  Ignorant question, how hard would it be to pull the impl (which is pleasantly straightforward) into a separate file? I've broken up all the other clients but I've always postponed kotlin to another day, simply all my tooling (LSP, ...) is
  > Since we're already at discussing computer science's hardest problem, I could also see this being called `Reference` and s/id/ref/, e.g.:  ```kotlin val ref = Reference.Ref(id); ```  :woman_shrugging: 
  > > I have only low-value nits to offer: >  > ```kotlin > children.create(Child(parent = Expanded(parentId))) > ``` >  > may sound a bit definitive. I wonder if >  > ```kotlin > children.create(Child(parent = Expandable(parentId))) > ``` >  > would reflect the conditional nature more (and follow Omittable's naming practices). I could also see an explicit initializer like `Omittable.Present()`, a la: >  > ```kotlin > children.create(Child(parent = Expandable.Id(parentId))) > ``` >  Sounds like a good idea, I'll adapt the PR to use the Expandable.Id naming. > Ignorant question, how hard would it be to pull the impl (which is pleasantly straightforward) into a separate file? I've broken up all the other clients but I've always postponed kotlin to another day, simply all my tooling (LSP, ...) is generally unhappy with kotlin > It should work without any issues, it's as simple as just moving things to a different file and letting the IDE automatically import the other fil

- **Issue #292** (2026-09-17): **Add README documentation to kotlin client**
  *Symptoms*: draft until we found a solution for https://github.com/trailbaseio/trailbase/pull/287#issuecomment-5669132707
  **Post-Mortem & Fix Analysis**:
  > Thanks for the docs, very much appreciated :pray: . Sorry for being so anal and doctoring so much. Personally, I find writing "good" docs worth reading way more laborious then writing "good enough" code. This is likely also why the current docs (or lack thereof) are so lackluster. That said, with us iterating on each other, I'm pretty happy with the concise, useful discussion that really every user of any client impl should be aware off :heart: . We should probably put a flavor of this front and center into the broader docs.
  > Thanks a lot for the follow-up, I agree that it's much easier to read now and get started with!  I haven't got any experience with writing docs because I'm only working on end user applications, but not on libraries, so the feedback is greatly appreciated :)

- **Issue #291** (2026-09-14): **docs: Clarify how to upload files with JSON requests**
  *Symptoms*: I didn't really understand how this is supposed to work before reading the source code, so I think it makes sense to clarify it in the docs (and especially to link to the fields that can be set).
  **Post-Mortem & Fix Analysis**:
  > Appreciated :pray: and sorry for the lackluster docs. I pushed your changes in https://github.com/trailbaseio/trailbase/commit/a3d9124934277c0bb4c814329c32f2f83a4ec822 and gave the entire paragraph a little bit more love
  > Oh, I (again) forgot to target the dev branch instead of the main branch with my PR.  Thanks for merging!

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

### Incident Patch 1: `6e95534d` (2026-10-04)
**Commit Message**: Add a unique `_user.unverified_email` constraint and a periodic cleanup for users with unverified email addresses. Fixes #298.

Also test all the default jobs.

**File**: `crates/core/migrations/main/U1791097712__unique_unverified_email.sql` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+-- Crate a unique constraint for unverified_email addresses too to catch
+-- redundant registrations early and avoid ambiguous lingering users with
+-- the same unverified email address.
+
+-- Do a quick cleanup to reduce likelihood of pre-existing violations. We also
+-- started to do this cleanup scheduled periodically.
+DELETE FROM _user WHERE
+  unverified_email IS NOT NULL AND
+  UNIXEPOCH() > (created + 24 * 3600);
+
+CREATE UNIQUE INDEX __user__unverified_email_index ON _user (unverified_email);
```

**File**: `crates/core/migrations/pg_main/U1791097712__unique_unverified_email.sql` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+-- Crate a unique constraint for unverified_email addresses too to catch
+-- redundant registrations early and avoid ambiguous lingering users with
+-- the same unverified email address.
+
+-- Do a quick cleanup to reduce likelihood of pre-existing violations. We also
+-- started to do this cleanup scheduled periodically.
+DELETE FROM _user WHERE
+  unverified_email IS NOT NULL AND
+  UNIXEPOCH() > (created + 24 * 3600);
+
+CREATE UNIQUE INDEX __user__unverified_email_index ON _user (unverified_email);
+
+-- Turns out we were missing the username uniqueness constraint for PG.
+CREATE UNIQUE INDEX __user__username_index ON _user (username);
```

**File**: `crates/core/src/auth/api/register.rs` (modified, +12/-14)
```diff
@@ -21,12 +21,12 @@ use crate::email::Email;
 use crate::extract::Either;
 use crate::util::urlencode;
 
-#[derive(Debug, Default, Deserialize, IntoParams, ToSchema, TS)]
+#[derive(Clone, Debug, Default, Deserialize, IntoParams, ToSchema, TS)]
 pub struct RegisterUserParams {
   pub redirect_uri: Option<String>,
 }
 
-#[derive(Debug, Default, Deserialize, ToSchema, TS)]
+#[derive(Clone, Debug, Default, Deserialize, ToSchema, TS)]
 #[ts(export)]
 pub struct RegisterUserRequest {
   pub email: Option<String>,
@@ -118,10 +118,9 @@ pub async fn register_user_handler(
 
   const INSERT_USER_QUERY: &str = formatcp!(
     "\
-      INSERT INTO \"{USER_TABLE}\" \
-        (unverified_email, username, password_hash) \
-      VALUES \
-        (:unverified_email, :username, :password_hash) \
+      INSERT INTO \"{USER_TABLE}\" (unverified_email, username, password_hash) \
+        SELECT :unverified_email, :username, :password_hash \
+          WHERE NOT EXISTS(SELECT 1 FROM \"{USER_TABLE}\" WHERE email = :unverified_email) \
       RETURNING {columns} \
     ",
     columns = DbUser::COLUMNS
@@ -132,23 +131,22 @@ pub async fn register_user_handler(
     .write_query_row(
       INSERT_USER_QUERY,
       named_params! {
-        ":unverified_email": normalized_email.clone(),
+        ":unverified_email": normalized_email,
         ":username": username,
         ":password_hash": hashed_password,
       },
     )
     .await
   {
     Ok(Some(row)) => DbUser::from_row(row)?,
-    Err(_err) => {
-      #[cfg(debug_assertions)]
-      log::debug!("Failed to register new user {normalized_email:?}: {_err:?}");
-
-      // In case the user already exists, we claim success to avoid leaking users' email addresses.
+    Ok(None) => {
+      // Above nested SELECT returned no rows, i.e. email address is already registered. We claim
+      // success to avoid account enumerations.
       return Ok(success_response());
     }
-    Ok(None) => {
-      return Err(AuthError::Internal("Failed to get user".into()));
+    Err(_err) => {
+      // The `unverified_email` or username is already present. We claim success to avoid account enumerations.
+      return Ok(success_response());
     }
   };
 
```

**File**: `crates/core/src/auth/api/verify_email.rs` (modified, +5/-5)
```diff
@@ -1,6 +1,7 @@
 use axum::extract::{Path, Query, State};
 use axum::http::StatusCode;
 use axum::response::{IntoResponse, Redirect, Response};
+use chrono::Duration;
 use const_format::formatcp;
 use mini_moka::sync::Cache;
 use serde::Deserialize;
@@ -34,7 +35,7 @@ pub struct EmailVerificationParams {
     (status = 400, description = "Malformed email address."),
   )
 )]
-pub async fn request_email_verification_handler(
+pub async fn email_verification_request_handler(
   State(state): State<AppState>,
   Query(query): Query<EmailVerificationParams>,
 ) -> Result<Response, AuthError> {
@@ -65,7 +66,7 @@ pub async fn request_email_verification_handler(
   let claims = EmailVerificationTokenClaims::new(
     &user.uuid(),
     normalized_email.clone(),
-    chrono::Duration::seconds(TTL_SEC),
+    EMAIL_VERIFICATION_TTL,
   );
   let token = state
     .jwt()
@@ -87,7 +88,6 @@ pub(crate) struct VerifyEmailParams {
   redirect_uri: Option<String>,
 }
 
-/// Request a new email to verify email address.
 #[utoipa::path(
   get,
   path = "/verify_email/confirm/{email_verification_token}",
@@ -99,7 +99,7 @@ pub(crate) struct VerifyEmailParams {
     (status = 401, description = "Unauthorized: invalid reset code."),
   )
 )]
-pub(crate) async fn verify_email_handler(
+pub(crate) async fn email_verification_confirm_handler(
   State(state): State<AppState>,
   Path(email_verification_token): Path<String>,
   Query(query): Query<VerifyEmailParams>,
@@ -142,7 +142,7 @@ pub(crate) async fn verify_email_handler(
   };
 }
 
-const TTL_SEC: i64 = 3600;
+pub const EMAIL_VERIFICATION_TTL: Duration = Duration::hours(2);
 
 // Track login attempts for abuse prevention.
 fn rate_limit_verify_email_attempts(id: String) -> Result<(), AuthError> {
```

**File**: `crates/core/src/auth/auth_test.rs` (modified, +53/-6)
```diff
@@ -39,7 +39,7 @@ use crate::auth::api::reset_password::{
 };
 use crate::auth::api::token::{AuthCodeToTokenRequest, TokenResponse, auth_code_to_token_handler};
 use crate::auth::api::totp;
-use crate::auth::api::verify_email::{VerifyEmailParams, verify_email_handler};
+use crate::auth::api::verify_email::{VerifyEmailParams, email_verification_confirm_handler};
 use crate::auth::jwt::PasswordResetTokenClaims;
 use crate::auth::login_params::{LoginInputParams, ResponseType};
 use crate::auth::user::{DbUser, User};
@@ -118,7 +118,6 @@ async fn register_test_user(
   password: &str,
 ) -> Result<User, anyhow::Error> {
   // Register new user and email verification flow.
-
   let request = match identifier {
     Identifier::Email(ref email) => RegisterUserRequest {
       email: Some(email.clone()),
@@ -148,10 +147,37 @@ async fn register_test_user(
   let _ = register_user_handler(
     State(state.clone()),
     Query(RegisterUserParams::default()),
-    Either::Form(request),
+    Either::Form(request.clone()),
   )
   .await?;
 
+  {
+    let num_users = async || {
+      return state
+        .user_conn()
+        .read_query_row_get::<i64>(format!("SELECT COUNT(*) FROM {USER_TABLE}"), (), 0)
+        .await
+        .unwrap()
+        .unwrap() as usize;
+    };
+
+    let n_users_before = num_users().await;
+
+    // Make sure re-registrations appear successful to avoid account enumerations, while doing
+    // nothing.
+    assert_matches!(
+      register_user_handler(
+        State(state.clone()),
+        Query(RegisterUserParams::default()),
+        Either::Form(request.clone()),
+      )
+      .await,
+      Ok(_),
+    );
+
+    assert_eq!(n_users_before, num_users().await);
+  }
+
   // Assert that a verification email was sent.
   if has_email {
     assert_eq!(mailer.get_logs().len(), 1);
@@ -224,7 +250,7 @@ async fn register_test_user(
       _ => {}
     }
 
-    let _ = verify_email_handler(
+    let _ = email_verification_confirm_handler(
       State(state.clone()),
       Path(verification_email_token.clone()),
       Query(VerifyEmailParams::default()),
@@ -1220,6 +1246,27 @@ async fn test_auth_otp_flow_using_email() {
 
   let (state, mailer, user) = setup_state_and_test_user(&email, &password, None, false).await;
 
+  // Re-register the existing user should yield success to prevent account enumerations.
+  {
+    let before = mailer.get_logs().len();
+    let _ = register_user_handler(
+      State(state.clone()),
+      Query(RegisterUserParams::default()),
+      Either::Json(RegisterUserRequest {
+        email: Some(email.clone()),
+        username: None,
+        password: password.to_string(),
+        password_repeat: password.to_string(),
+        ..Default::default()
+      }),
+    )
+    .await
+    .unwrap();
+
+    // No email was sent.
+    assert_eq!(before, mailer.get_logs().len(), "{:?}", mailer.get_logs());
+  }
+
   assert_eq!(Some(&email), user.email.as_ref());
 
   // NOTE: We return a success response on unknown user to avoid leaks.
@@ -1523,7 +1570,7 @@ async fn test_auth_annonymous_signin() {
   // Steal the verification code from the DB and verify.
   let verification_email_token: String = extract_email_verification_token(&mailer.get_logs()[0].1);
 
-  verify_email_handler(
+  email_verification_confirm_handler(
     State(state.clone()),
     Path(verification_email_token.clone()),
     Query(VerifyEmailParams::default()),
@@ -1622,7 +1669,7 @@ async fn test_auth_refresh_after_anonymous_promotion() {
   // Steal the verification code from the DB and verify.
   let verification_email_token: String = extract_email_verification_token(&mailer.get_logs()[0].1);
 
-  verify_email_handler(
+  email_verification_confirm_handler(
     State(state.clone()),
     Path(verification_email_token.clone()),
     Query(VerifyEmailParams::default()),
```

**File**: `crates/core/src/auth/mod.rs` (modified, +5/-2)
```diff
@@ -14,6 +14,7 @@ pub(crate) mod util;
 
 mod error;
 
+pub use api::verify_email::EMAIL_VERIFICATION_TTL;
 pub use error::AuthError;
 pub use jwt::{AuthTokenClaims, JwtHelper};
 pub use user::{DbUser, User};
@@ -48,9 +49,11 @@ pub(super) fn auth_router(
     .routes(routes!(api::register::register_user_handler))
     // E-mail verification and change flows.
     .routes(routes!(
-      api::verify_email::request_email_verification_handler,
+      api::verify_email::email_verification_request_handler,
+    ))
+    .routes(routes!(
+      api::verify_email::email_verification_confirm_handler
     ))
-    .routes(routes!(api::verify_email::verify_email_handler))
     .routes(routes!(api::change_email::change_email_request_handler))
     .routes(routes!(api::change_email::change_email_confirm_handler))
     // Change username flow.
```

**File**: `crates/core/src/scheduler.rs` (modified, +86/-14)
```diff
@@ -13,9 +13,10 @@ use std::sync::{
   atomic::{AtomicI32, Ordering},
 };
 use trailbase_schema::db::{QualifiedName, QualifiedNameEscaped};
-use trailbase_sqlite::{Connection, named_params, params};
+use trailbase_sqlite::{Connection, ConnectionType, named_params, params};
 
 use crate::DataDir;
+use crate::auth::EMAIL_VERIFICATION_TTL;
 use crate::config::proto;
 use crate::connection::ConnectionManager;
 use crate::constants::{
@@ -354,9 +355,10 @@ fn build_job(id: proto::SystemJobId, opts: &BuildJobOptions) -> DefaultSystemJob
     }
     proto::SystemJobId::AuthCleaner => {
       let session_conn = opts.session_conn.clone();
+      let user_conn = opts.connection_manager.main_entry().connection.clone();
 
       DefaultSystemJob {
-        name: "Session Cleanup",
+        name: "Auth Cleanup",
         default_config: proto::SystemJob {
           id: Some(id as i32),
           schedule: Some("@hourly".into()),
@@ -365,21 +367,46 @@ fn build_job(id: proto::SystemJobId, opts: &BuildJobOptions) -> DefaultSystemJob
           timeout: None,
         },
         callback: build_callback(move || {
+          let user_conn = user_conn.clone();
           let session_conn = session_conn.clone();
 
-          const QUERY: &str = formatcp!(
+          const SESSION_CLEANUP_QUERY: &str = formatcp!(
             "\
-              DELETE FROM '{SESSION_TABLE}' WHERE expires < (UNIXEPOCH() - 60); \
-              DELETE FROM '{AUTHORIZATION_CODE_TABLE}' WHERE expires < (UNIXEPOCH() - 60); \
-              DELETE FROM '{OTP_CODE_TABLE}' WHERE expires < (UNIXEPOCH() - 60); \
+              DELETE FROM \"{SESSION_TABLE}\" WHERE expires < (UNIXEPOCH() - 60); \
+              DELETE FROM \"{AUTHORIZATION_CODE_TABLE}\" WHERE expires < (UNIXEPOCH() - 60); \
+              DELETE FROM \"{OTP_CODE_TABLE}\" WHERE expires < (UNIXEPOCH() - 60); \
             "
           );
 
+          const STALE_EMAIL_VERIFICATION_CLEANUP: &str = formatcp!(
+            "DELETE FROM \"{USER_TABLE}\" WHERE \
+               unverified_email IS NOT NULL AND UNIXEPOCH() > (created + :ttl_seconds);"
+          );
+
           return async move {
-            session_conn.execute_batch(QUERY).await.map_err(|err| {
-              warn!("Periodic session cleanup failed: {err}");
-              err
-            })?;
+            let session_result = session_conn
+              .execute_batch(SESSION_CLEANUP_QUERY)
+              .await
+              .map_err(|err| {
+                warn!("Periodic session cleanup failed: {err}");
+                err
+              });
+
+            let user_result = user_conn
+              .execute(
+                STALE_EMAIL_VERIFICATION_CLEANUP,
+                named_params! {
+                  ":ttl_seconds": EMAIL_VERIFICATION_TTL.num_seconds() + 10,
+                },
+              )
+              .await
+              .map_err(|err| {
+                warn!("Stale unverified email cleanup failed: {err}");
+                err
+              });
+
+            session_result?;
+            user_result?;
 
             return Ok::<(), trailbase_sqlite::Error>(());
           };
@@ -401,7 +428,14 @@ fn build_job(id: proto::SystemJobId, opts: &BuildJobOptions) -> DefaultSystemJob
           let conn = main_conn.clone();
 
           return async move {
-            conn.execute("PRAGMA optimize", ()).await.map_err(|err| {
+            let query = match conn.connection_type() {
+              ConnectionType::Sqlite => "PRAGMA optimize",
+              // QUESTION: should we run VACCUM for PG, can be quite expensive. May bet better to
+              // leave maintenance to external tooling.
+              ConnectionType::Pg => "VACUUM",
+            };
+
+            conn.execute_batch(query).await.map_err(|err| {
               warn!("Periodic query optimizer failed: {err}");
               return err;
             })?;
@@ -463,7 +497,7 @@ fn build_job(id: proto::SystemJobId, opts: &BuildJobOptions) -> DefaultSystemJob
       }
     }
     proto::SystemJobId::AnonymousCleaner => {
-      let main_conn = opts.connection_manager.main_entry().connection.clone();
+      let user_conn = opts.connection_manager.main_entry().connection.clone();
       let anonymous_refresh_token_ttl = opts
         .config
         .auth
@@ -479,9 +513,9 @@ fn build_job(id: proto::SystemJobId, opts: &BuildJobOptions) -> DefaultSystemJob
           timeout: None,
         },
         callback: build_callback(move || {
-          let main_conn = main_conn.clone();
+          let user_conn = user_conn.clone();
           return async move {
-            return cleanup_anonymous_users(&main_conn, anonymous_refresh_token_ttl).await;
+            return cleanup_anonymous_users(&user_conn, anonymous_refresh_token_ttl).await;
           };
         }),
       }
@@ -701,4 +735,42 @@ mod tests {
       .await
       .unwrap();
   }
+
+  #[tokio::test]
+  async fn all_default_jobs() {
+    let state = crate::app_state::test_state(Non
```

---

### Incident Patch 2: `f7c4d9b4` (2026-10-03)
**Commit Message**: Fix JSON schema for nullable ANY columns and update csv-parse dependency.

**File**: `client/dart/test/trailbase_test.dart` (modified, +33/-23)
```diff
@@ -712,26 +712,36 @@ Future<void> main() async {
       final client = await connect();
       final api = client.records('simple_schema_table');
 
-      expect(() async {
-        // data object is string encoded.
-        await api.create({
-          'data': '{ "name": "TheEntireObjectIsAString" }',
-        });
-      }, throwsA(predicate((e) {
-        if (e is HttpException) {
-          return e.status == HttpStatus.badRequest;
-        }
-        return false;
-      })));
+      // Data object is string encoded. We accept this since at the DB-level it's a DB anyway. Less de and re-servialization
+      final id0 = await api.create({
+        'data': '{ "name": "TheEntireObjectIsAString" }',
+      });
+      expect(
+        await api.read(id0),
+        equals({
+          'id': id0,
+          'data': {'name': 'TheEntireObjectIsAString'},
+        }),
+      );
+      await api.createBulk([
+        {'data': '{ "name": "TheEntireObjectIsAString" }'},
+        {'data': '{ "name": "TheEntireObjectIsAString" }'},
+      ]);
 
+      // Data object is a JSON object and needs to be encoded to string and backend by the backend.
       final id = await api.create({
         'data': {'name': 'Eve'},
       });
-
+      expect(
+        await api.read(id),
+        equals({
+          'id': id,
+          'data': {'name': 'Eve'},
+        }),
+      );
       await api.update(id, {
         'data': {'name': 'Alice'},
       });
-
       await api.createBulk([
         {
           'data': {'name': 'Eve'},
@@ -742,16 +752,16 @@ Future<void> main() async {
       ]);
 
       // Test that invalid input produces a client-error, i.e. 400.
-      expect(() async {
-        await api.create({
-          'data': "{ 4: 'Eve' }",
-        });
-      }, throwsA(predicate((e) {
-        if (e is HttpException) {
-          return e.status == HttpStatus.badRequest;
-        }
-        return false;
-      })));
+      await expectLater(
+        api.create({'data': "{ 4: 'Eve' }"}),
+        throwsA(isA<HttpException>()
+            .having((e) => e.status, 'status', equals(HttpStatus.badRequest))),
+      );
+      await expectLater(
+        api.update(id, {'data': "{ 4: 'Eve' }"}),
+        throwsA(isA<HttpException>()
+            .having((e) => e.status, 'status', equals(HttpStatus.badRequest))),
+      );
     });
   });
 }
```

**File**: `crates/client/tests/server/mod.rs` (modified, +0/-1)
```diff
@@ -34,7 +34,6 @@ pub async fn start_server(timeout: Duration) -> Result<Option<Server>, std::io::
     assert!(cwd.ends_with("client"));
 
     let command_cwd = cwd.parent().unwrap().parent().unwrap();
-    let depot_path = "client/testfixture";
 
     log::info!("Building dev server... (cold builds may take a while)");
     let _output = std::process::Command::new("python3")
```

**File**: `crates/core/src/records/create_record.rs` (modified, +1/-10)
```diff
@@ -116,20 +116,11 @@ pub async fn create_record_handler(
       }
     }
 
-    #[cfg(debug_assertions)]
-    crate::records::json_schema::validate_api_json_schema(
-      &state,
-      &api,
-      trailbase_schema::json_schema::JsonSchemaMode::Insert,
-      &serde_json::Value::Object(record.clone()),
-    )
-    .map_err(|_err| RecordError::BadRequest("Invalid Parameters"))?;
-
     let mut lazy_params =
       LazyParams::for_insert(&api, state.json_schema_registry().clone(), record, files);
 
     // NOTE: We're currently serializing the async checks, we could parallelize them however it's
-    // unclear if this would be much faster.
+    // unclear if this would be much faster. Batching might help.
     api
       .check_record_level_access(
         Permission::Create,
```

**File**: `crates/core/src/records/update_record.rs` (modified, +5/-13)
```diff
@@ -39,15 +39,6 @@ pub async fn update_record_handler(
 
   let record_id = api.primary_key_to_value(record)?;
 
-  #[cfg(debug_assertions)]
-  crate::records::json_schema::validate_api_json_schema(
-    &state,
-    &api,
-    trailbase_schema::json_schema::JsonSchemaMode::Update,
-    &serde_json::Value::Object(request.clone()),
-  )
-  .map_err(|_err| RecordError::BadRequest("Invalid Parameters"))?;
-
   let mut lazy_params = LazyParams::for_update(
     &api,
     state.json_schema_registry().clone(),
@@ -198,10 +189,11 @@ mod tests {
     )
     .await;
 
-    assert!(matches!(
-      response.err().unwrap(),
-      RecordError::BadRequest(_)
-    ))
+    assert!(
+      matches!(response.as_ref().err().unwrap(), RecordError::BadRequest(_)),
+      "{:?}",
+      response.err()
+    )
   }
 
   #[tokio::test]
```

**File**: `crates/schema/src/db/metadata.rs` (modified, +4/-4)
```diff
@@ -16,13 +16,13 @@ use crate::db::sqlite::{
 // TODO: Can we merge this with crate::sqlite::SchemaError?
 #[derive(Debug, Clone, Error)]
 pub enum JsonSchemaError {
-  #[error("Schema compile error: {0}")]
+  #[error("SchemaCompile: {0}")]
   SchemaCompile(String),
-  #[error("Validation error")]
+  #[error("Validation")]
   Validation,
-  #[error("Schema not found: {0}")]
+  #[error("SchemaNotFound: {0}")]
   NotFound(String),
-  #[error("Json serialization error: {0}")]
+  #[error("JsonSerialization: {0}")]
   JsonSerialization(Arc<serde_json::Error>),
   #[error("Other: {0}")]
   Other(String),
```

**File**: `crates/schema/src/json_schema/mod.rs` (modified, +14/-2)
```diff
@@ -72,7 +72,15 @@ pub fn build_json_schema_expanded(
   }
 
   return Ok((
-    Validator::new(&schema).map_err(|err| JsonSchemaError::SchemaCompile(err.to_string()))?,
+    Validator::new(&schema).map_err(|err| {
+      return cfg_select! {
+        debug_assertions => JsonSchemaError::SchemaCompile(format!(
+          "${err}:\n{schema}",
+          schema = serde_json::to_string_pretty(&schema).unwrap_or_default()
+        )),
+        _ => JsonSchemaError::SchemaCompile(err.to_string()),
+      };
+    })?,
     schema,
   ));
 }
@@ -291,7 +299,11 @@ fn build_json_schema_expanded_impl(
           // Not sure this is the best approach, especially since we also don't mark them as
           // required.
           "type": if nullable {
-            serde_json::json!(["null", column_data_type_to_json_type(col.data_type)])
+            match col.data_type {
+                ColumnDataType::Any => column_data_type_to_json_type(col.data_type),
+                _  => serde_json::json!(["null", column_data_type_to_json_type(col.data_type)])
+            }
+
           } else {
             column_data_type_to_json_type(col.data_type)
           }
```

**File**: `examples/data-cli-tutorial/package.json` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@
     "typescript-eslint": "^8.71.0"
   },
   "dependencies": {
-    "csv-parse": "^5.6.0",
+    "csv-parse": "^7.0.3",
     "trailbase": "^0.14.3"
   }
 }
```

**File**: `examples/data-cli-tutorial/src/fill.ts` (modified, +13/-1)
```diff
@@ -4,6 +4,18 @@ import { parse } from "csv-parse/sync";
 import { initClient } from "trailbase";
 import type { Movie } from "@schema/movie";
 
+type MovieCsv = {
+  rank: string;
+  name: string;
+  year: string;
+  watch_time: string;
+  rating: string;
+  metascore: string;
+  gross: string;
+  votes: string;
+  description: string;
+};
+
 const client = initClient("http://localhost:4000");
 await client.login("admin@localhost", "secret");
 const api = client.records<Movie>("movies");
@@ -32,7 +44,7 @@ while (true) {
 console.log(`Cleaned up ${cnt} movies`);
 
 const file = await readFile("data/Top_1000_IMDb_movies_New_version.csv");
-const records = parse(file, {
+const records: MovieCsv[] = parse(file, {
   fromLine: 2,
   // prettier-ignore
   columns: ["rank", "name", "year", "watch_time", "rating", "metascore", "gross", "votes", "description"],
```

---

### Incident Patch 3: `2a1a4cf3` (2026-10-03)
**Commit Message**: Handle JSON bindings an internal NPM package rather than hacky tsconfig aliases. Also strip `devDependencies` from JS/TS client library to avoid leaking the rolled-up type definitions.

**File**: `.cargo/config.toml` (modified, +1/-1)
```diff
@@ -13,4 +13,4 @@
 # rustflags = ["-C", "target-feature=+crt-static"]
 
 [env]
-TS_RS_EXPORT_DIR = { value = "./crates/assets/js/bindings", relative = true }
+TS_RS_EXPORT_DIR = { value = "./crates/assets/js/bindings/src", relative = true }
```

**File**: `crates/assets/js/admin/package.json` (modified, +1/-0)
```diff
@@ -72,6 +72,7 @@
     "prettier-plugin-tailwindcss": "^0.8.1",
     "tailwindcss": "^4.3.3",
     "tailwindcss-animate": "^1.0.7",
+    "trailbase-bindings": "file:../bindings",
     "ts-proto": "^2.12.4",
     "tw-animate-css": "^1.4.0",
     "typescript": "^6.0.3",
```

**File**: `crates/assets/js/admin/src/components/Version.tsx` (modified, +2/-1)
```diff
@@ -1,5 +1,6 @@
 import { Match, Switch } from "solid-js";
-import type { InfoResponse } from "@bindings/InfoResponse";
+
+import type { InfoResponse } from "trailbase-bindings";
 
 export function Version(props: { info: InfoResponse | undefined }) {
   // Version tags have the shape <tag>[-<n>-<hash>], where the latter part is
```

**File**: `crates/assets/js/admin/src/components/accounts/AccountsPage.tsx` (modified, +1/-2)
```diff
@@ -67,8 +67,7 @@ import { deleteUser, updateUser, fetchUsers } from "@/lib/api/user";
 import { copyToClipboard, safeParseInt } from "@/lib/utils";
 import { formatSortingAsOrder } from "@/lib/list";
 
-import type { UpdateUserRequest } from "@bindings/UpdateUserRequest";
-import type { UserJson } from "@bindings/UserJson";
+import type { UpdateUserRequest, UserJson } from "trailbase-bindings";
 
 function buildColumns(): ColumnDef<StockFeatures, UserJson>[] {
   // NOTE: the headers are lower-case to match the column names and don't confuse when trying to use the filter bar.
```

**File**: `crates/assets/js/admin/src/components/accounts/AddUser.tsx` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ import {
 
 import { createUser } from "@/lib/api/user";
 
-import type { CreateUserRequest } from "@bindings/CreateUserRequest";
+import type { CreateUserRequest } from "trailbase-bindings";
 
 export function AddUser(props: {
   close: () => void;
```

**File**: `crates/assets/js/admin/src/components/editor/EditorPage.tsx` (modified, +6/-4)
```diff
@@ -90,10 +90,12 @@ import { useNavbar, DirtyDialog } from "@/components/Navbar";
 import { renderCell, deriveCellType } from "@/components/table/SqlCell";
 import { ExportMenu } from "@/components/editor/Export";
 
-import type { Column } from "@bindings/Column";
-import type { ListSchemasResponse } from "@bindings/ListSchemasResponse";
-import type { QueryResponse } from "@bindings/QueryResponse";
-import type { SqlValue } from "@bindings/SqlValue";
+import type {
+  Column,
+  ListSchemasResponse,
+  QueryResponse,
+  SqlValue,
+} from "trailbase-bindings";
 
 import { createConfigQuery } from "@/lib/api/config";
 import { createTheme } from "@/lib/theme";
```

**File**: `crates/assets/js/admin/src/components/editor/Export.tsx` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ import {
   showSaveFileDialog,
 } from "@/lib/utils";
 
-import type { QueryResponse } from "@bindings/QueryResponse";
+import type { QueryResponse } from "trailbase-bindings";
 
 function buildDelimited(response: QueryResponse, delimiter: string): string {
   const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
```

**File**: `crates/assets/js/admin/src/components/erd/ErdGraph.tsx` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ export type { PortMetadata } from "@antv/x6/lib/model/port";
 import type { ResolvedTheme } from "@/lib/theme";
 import { createWindowSize } from "@/lib/signals";
 
-import type { Column } from "@bindings/Column";
+import type { Column } from "trailbase-bindings";
 
 export const LINE_HEIGHT = 24;
 export const NODE_WIDTH = 250;
```

---

### Incident Patch 4: `7f45b367` (2026-10-02)
**Commit Message**: Add watchdog to all tests involving deadlocking pglite :/. Also explicitly `--skip=postgres` tests that are not excluded by the feature flags.

**File**: `.github/workflows/test.yml` (modified, +1/-1)
```diff
@@ -180,7 +180,7 @@ jobs:
           # NOTE: The internal watchdog may terminate the test with a non-zero exit code.
           retry_on: any # options: any, timeout, error
           continue_on_error: false
-          command: cargo test --features=geos,otel,pg-test
+          command: cargo test --features=geos,otel,pg,pg-test
 
       # Just to monitor the runner's disk consumption.
       - name: Monitor Disk Space (End)
```

**File**: `Cargo.lock` (modified, +1/-17)
```diff
@@ -1857,16 +1857,6 @@ dependencies = [
  "memchr",
 ]
 
-[[package]]
-name = "ctor"
-version = "1.0.13"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "914a755b7c2d4af2bdcff7ce1739e2db9a1b81a9b07123d8015786ae03c0980d"
-dependencies = [
- "link-section",
- "linktime-proc-macro",
-]
-
 [[package]]
 name = "ctr"
 version = "0.10.1"
@@ -4437,12 +4427,6 @@ dependencies = [
  "cc",
 ]
 
-[[package]]
-name = "link-section"
-version = "0.19.3"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "39c29a617ce3df32c08497bdc1ab6e2376e0b17948ac166a2fbe5977c5954cd9"
-
 [[package]]
 name = "linked-hash-map"
 version = "0.5.6"
@@ -8861,7 +8845,6 @@ dependencies = [
  "async-trait",
  "base64 0.23.1",
  "bytes",
- "ctor",
  "dtor",
  "env_logger",
  "eventsource-stream",
@@ -8916,6 +8899,7 @@ dependencies = [
  "itertools 0.15.0",
  "log",
  "oliphaunt-wasix",
+ "parking_lot",
  "serde",
  "tempfile",
  "thiserror 2.0.21",
```

**File**: `crates/core/src/app_state.rs` (modified, +1/-47)
```diff
@@ -737,15 +737,12 @@ mod test_utils {
       let db = Arc::new(parking_lot::Mutex::new(Some(db)));
 
       // NOTE: During CI, we have tests occasionally time out. This is an attempt at getting ahead.
-      start_watchdog(
+      trailbase_sqlite::test_util::start_watchdog(
         &db,
         |db| {
           if let Some(mut db) = db.lock().take() {
             info!("shutting down pglite");
             db.close().unwrap();
-
-            // Give the test a chance to terminate.
-            std::thread::sleep(std::time::Duration::from_secs(15));
           } else {
             info!("pglite already consumed");
           }
@@ -865,48 +862,5 @@ pub(crate) fn validate_path(path: Option<&PathBuf>) -> Result<(), InitError> {
   return Ok(());
 }
 
-#[cfg(feature = "pg-test")]
-pub fn start_watchdog<T: Send + Sync + 'static>(
-  resource: &Arc<T>,
-  cb: impl FnOnce(&T) + Send + Sync + 'static,
-  timeout: std::time::Duration,
-) {
-  use std::sync::OnceLock;
-  use std::thread::{JoinHandle, sleep};
-  use std::time::{Duration, SystemTime};
-
-  let resource = Arc::downgrade(&resource);
-  let _handle = tokio::runtime::Handle::current();
-
-  let watcher = move || {
-    debug!("WATCHDOG: started");
-
-    let started = SystemTime::now();
-    loop {
-      let elapsed = SystemTime::now()
-        .duration_since(started)
-        .unwrap_or_default();
-
-      if elapsed >= timeout {
-        error!("WATCHDOG: expired");
-
-        if let Some(resource) = resource.upgrade() {
-          cb(&resource);
-        } else {
-          info!("WATCHDOG: resource already dropped");
-        }
-
-        error!("WATCHDOG: terminating process");
-        std::process::exit(42);
-      }
-
-      sleep(Duration::from_mins(1));
-    }
-  };
-
-  static WATCHDOG_THREAD: OnceLock<JoinHandle<()>> = OnceLock::new();
-  WATCHDOG_THREAD.get_or_init(|| std::thread::spawn(watcher));
-}
-
 #[cfg(test)]
 pub use test_utils::*;
```

**File**: `crates/core/tests/core_integration_test.rs` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ fn start_pg() -> PgSetup {
   let db = Arc::new(parking_lot::Mutex::new(Some(db)));
 
   // NOTE: During CI, we have tests occasionally time out. This is an attempt at getting ahead.
-  trailbase::app_state::start_watchdog(
+  trailbase_sqlite::test_util::start_watchdog(
     &db,
     |db| {
       if let Some(mut db) = db.lock().take() {
```

**File**: `crates/pg-schema/Cargo.toml` (modified, +1/-0)
```diff
@@ -15,3 +15,4 @@ trailbase-sqlite = { workspace = true, features = ["generic"] }
 [dev-dependencies]
 oliphaunt-wasix = { workspace = true }
 tempfile = "3.27.0"
+parking_lot = { workspace = true }
```

**File**: `crates/pg-schema/src/util.rs` (modified, +13/-1)
```diff
@@ -1,6 +1,6 @@
 #[cfg(test)]
 pub async fn test_connection() -> (
-  oliphaunt_wasix::OliphauntServer,
+  std::sync::Arc<parking_lot::Mutex<Option<oliphaunt_wasix::OliphauntServer>>>,
   trailbase_sqlite::Connection,
 ) {
   let temp_dir = tempfile::TempDir::new().unwrap();
@@ -16,6 +16,18 @@ pub async fn test_connection() -> (
     temp_dir.path().to_string_lossy()
   );
 
+  let db = std::sync::Arc::new(parking_lot::Mutex::new(Some(db)));
+  trailbase_sqlite::test_util::start_watchdog(
+    &db,
+    |db| {
+      log::info!("shutting down pglite");
+      if let Some(mut db) = db.lock().take() {
+        db.close().unwrap();
+      }
+    },
+    std::time::Duration::from_mins(8),
+  );
+
   return (
     db,
     trailbase_sqlite::Connection::pg_with_opts(trailbase_sqlite::generic::PgOptions {
```

**File**: `crates/sqlite/src/generic.rs` (modified, +59/-23)
```diff
@@ -698,12 +698,12 @@ mod tests {
   use serde::Deserialize;
 
   use super::*;
-  use crate::pg::executor::build_pg_test_executor;
+  use crate::pg::executor::build_postgres_test_executor;
   use crate::{named_params, params};
 
   #[tokio::test]
-  async fn generic_pg_poc_test() {
-    let (_db, exec) = build_pg_test_executor().unwrap();
+  async fn simple_postgres_test() {
+    let (_db, exec) = build_postgres_test_executor().unwrap();
     let conn = Connection::new(Executor::Pg(Arc::new(exec)));
 
     // IMPORTANT: PgLite only handles a single concurrent connection.
@@ -771,10 +771,22 @@ mod tests {
   }
 
   #[tokio::test]
-  async fn generic_connection_w_pg_test() {
+  async fn generic_connection_w_postgres_test() {
     let db = OliphauntServer::builder().start().unwrap();
     let pg_uri = db.connection_string().to_string();
-    println!("Started PgLite: {pg_uri}");
+    log::debug!("Started PgLite: {pg_uri}");
+
+    let db = std::sync::Arc::new(parking_lot::Mutex::new(Some(db)));
+    crate::test_util::start_watchdog(
+      &db,
+      |db| {
+        log::info!("shutting down pglite");
+        if let Some(mut db) = db.lock().take() {
+          db.close().unwrap();
+        }
+      },
+      std::time::Duration::from_mins(8),
+    );
 
     let conn = Connection::pg_with_opts(PgOptions {
       connection: PgConnection::Uri(pg_uri),
@@ -836,10 +848,22 @@ mod tests {
   }
 
   #[tokio::test]
-  async fn generic_connection_w_pg_create_simple_table_test() {
+  async fn generic_connection_w_postgres_create_simple_table_test() {
     let db = OliphauntServer::builder().start().unwrap();
     let pg_uri = db.connection_string().to_string();
-    println!("Started PgLite: {pg_uri}");
+    log::debug!("Started PgLite: {pg_uri}");
+
+    let db = std::sync::Arc::new(parking_lot::Mutex::new(Some(db)));
+    crate::test_util::start_watchdog(
+      &db,
+      |db| {
+        log::info!("shutting down pglite");
+        if let Some(mut db) = db.lock().take() {
+          db.close().unwrap();
+        }
+      },
+      std::time::Duration::from_mins(8),
+    );
 
     let conn = Connection::pg_with_opts(PgOptions {
       connection: PgConnection::Uri(pg_uri),
@@ -877,10 +901,22 @@ mod tests {
   }
 
   #[tokio::test]
-  async fn generic_connection_w_pg_create_more_complex_table_test() {
+  async fn generic_connection_w_postgres_create_more_complex_table_test() {
     let db = OliphauntServer::builder().start().unwrap();
     let pg_uri = db.connection_string().to_string();
-    println!("Started PgLite: {pg_uri}");
+    log::debug!("Started PgLite: {pg_uri}");
+
+    let db = std::sync::Arc::new(parking_lot::Mutex::new(Some(db)));
+    crate::test_util::start_watchdog(
+      &db,
+      |db| {
+        log::info!("shutting down pglite");
+        if let Some(mut db) = db.lock().take() {
+          db.close().unwrap();
+        }
+      },
+      std::time::Duration::from_mins(8),
+    );
 
     let conn = Connection::pg_with_opts(PgOptions {
       connection: PgConnection::Uri(pg_uri),
@@ -1040,8 +1076,8 @@ mod tests {
   }
 
   #[tokio::test]
-  async fn pg_lite_test() {
-    let (_db, exec) = build_pg_test_executor().unwrap();
+  async fn postgres_lite_test() {
+    let (_db, exec) = build_postgres_test_executor().unwrap();
     let conn = Connection::new(Executor::Pg(Arc::new(exec)));
 
     {
@@ -1064,8 +1100,8 @@ mod tests {
   }
 
   #[tokio::test]
-  async fn pg_int_test() {
-    let (_db, exec) = build_pg_test_executor().unwrap();
+  async fn postgres_int_test() {
+    let (_db, exec) = build_postgres_test_executor().unwrap();
     let conn = Connection::new(Executor::Pg(Arc::new(exec)));
 
     conn
@@ -1109,8 +1145,8 @@ mod tests {
   }
 
   #[tokio::test]
-  async fn pg_float_test() {
-    let (_db, exec) = build_pg_test_executor().unwrap();
+  async fn postgres_float_test() {
+    let (_db, exec) = build_postgres_test_executor().unwrap();
     let conn = Connection::new(Executor::Pg(Arc::new(exec)));
 
     conn
@@ -1151,8 +1187,8 @@ mod tests {
   }
 
   #[tokio::test]
-  async fn pg_uuids_test() {
-    let (_db, exec) = build_pg_test_executor().unwrap();
+  async fn postgres_uuids_test() {
+    let (_db, exec) = build_postgres_test_executor().unwrap();
     let conn = Connection::new(Executor::Pg(Arc::new(exec)));
 
     let uuid: Vec<u8> = conn
@@ -1211,8 +1247,8 @@ mod tests {
   }
 
   #[tokio::test]
-  async fn pg_json_test() {
-    let (_db, exec) = build_pg_test_executor().unwrap();
+  async fn postgres_json_test() {
+    let (_db, exec) = build_postgres_test_executor().unwrap();
     let conn = Connection::new(Executor::Pg(Arc::new(exec)));
 
     conn
@@ -1256,8 +1292,8 @@ mod tests {
   }
 
   #[tokio::test]
-  async fn pg_tid_test() {
-    let (_db, exec) = build_pg_test_executor().unwrap();
+  async fn postgres_tid_test() {
+    let (_db, exec) = build_postgres_test_executor().unwrap();
     let conn = Connection::new(Executor::Pg(Arc::new(exec)));
 
     conn
@@ -1294,8 +1
```

**File**: `crates/sqlite/src/lib.rs` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@ mod params;
 mod rows;
 pub mod sqlite;
 mod statement;
+pub mod test_util;
 pub mod to_sql;
 pub mod traits;
 mod r#type;
```

---

### Incident Patch 5: `801f3696` (2026-10-02)
**Commit Message**: Update JS and add `pnpm -r build` to hooks.

**File**: `.github/workflows/audit.yaml` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ jobs:
 
       # Audit JS/TS
       - uses: ./.github/actions/setup_pnpm
-      - run: pnpm audit --prod
+      - run: pnpm audit --prod --ignore-unfixable
 
       # Audit Rust
       - uses: taiki-e/install-action@v2
```

**File**: `client/testfixture/guests/typescript/package.json` (modified, +6/-6)
```diff
@@ -16,13 +16,13 @@
     "trailbase-wasm": "workspace:*"
   },
   "devDependencies": {
-    "@bytecodealliance/jco": "^1.34.0",
+    "@bytecodealliance/jco": "^1.35.0",
     "@eslint/js": "^10.0.1",
-    "@types/node": "^26.6.1",
-    "eslint": "^10.10.0",
-    "prettier": "^3.9.7",
+    "@types/node": "^26.6.3",
+    "eslint": "^10.11.0",
+    "prettier": "^3.9.9",
     "typescript": "^6.0.3",
-    "typescript-eslint": "^8.70.0",
-    "vite": "^8.3.0"
+    "typescript-eslint": "^8.71.0",
+    "vite": "^8.3.1"
   }
 }
```

**File**: `crates/assets/js/admin/package.json` (modified, +14/-14)
```diff
@@ -15,24 +15,24 @@
   },
   "dependencies": {
     "@antv/x6": "^3.1.8",
-    "@bufbuild/protobuf": "^2.15.0",
+    "@bufbuild/protobuf": "^2.16.0",
     "@codemirror/autocomplete": "^6.20.3",
     "@codemirror/lang-sql": "^6.10.0",
     "@codemirror/language": "^6.12.4",
-    "@codemirror/state": "^6.7.5",
-    "@codemirror/view": "^6.43.12",
+    "@codemirror/state": "^6.7.6",
+    "@codemirror/view": "^6.43.13",
     "@corvu/resizable": "^0.2.5",
     "@kobalte/core": "^0.13.14",
     "@kobalte/tailwindcss": "^0.9.0",
     "@kobalte/utils": "^0.9.2",
-    "@lezer/highlight": "^1.2.3",
+    "@lezer/highlight": "^1.2.5",
     "@nanostores/persistent": "^1.3.5",
     "@nanostores/solid": "^1.1.1",
     "@panzoom/panzoom": "^4.6.2",
     "@solid-primitives/memo": "^1.5.1",
     "@solidjs/router": "^1.0.0",
     "@tanstack/solid-form": "^1.33.5",
-    "@tanstack/solid-query": "^5.103.0",
+    "@tanstack/solid-query": "^5.104.0",
     "@tanstack/solid-table": "^9.2.4",
     "@tanstack/table-core": "^9.2.4",
     "@tiledb-inc/wkx": "github:TileDB-Inc/wkx",
@@ -43,8 +43,8 @@
     "geojson": "^0.5.0",
     "i18n-iso-countries": "^7.14.0",
     "long": "^5.3.2",
-    "maplibre-gl": "^6.10.0",
-    "nanostores": "^1.5.3",
+    "maplibre-gl": "^6.11.2",
+    "nanostores": "^1.5.4",
     "rapidoc": "^9.3.8",
     "solid-icons": "^1.2.0",
     "solid-js": "^1.9.15",
@@ -54,7 +54,7 @@
   },
   "devDependencies": {
     "@eslint/js": "^10.0.1",
-    "@iconify-json/tabler": "^1.2.38",
+    "@iconify-json/tabler": "^1.2.41",
     "@solidjs/testing-library": "^0.8.10",
     "@tailwindcss/typography": "^0.5.20",
     "@tailwindcss/vite": "^4.3.3",
@@ -63,20 +63,20 @@
     "@types/geojson": "^7946.0.16",
     "@types/wicg-file-system-access": "^2023.10.7",
     "autoprefixer": "^10.6.1",
-    "eslint": "^10.10.0",
+    "eslint": "^10.11.0",
     "eslint-plugin-better-tailwindcss": "^4.7.0",
     "eslint-plugin-solid": "^0.18.0",
-    "globals": "^17.12.0",
-    "jsdom": "^30.0.1",
-    "prettier": "^3.9.7",
+    "globals": "^17.13.0",
+    "jsdom": "^30.1.1",
+    "prettier": "^3.9.9",
     "prettier-plugin-tailwindcss": "^0.8.1",
     "tailwindcss": "^4.3.3",
     "tailwindcss-animate": "^1.0.7",
     "ts-proto": "^2.12.4",
     "tw-animate-css": "^1.4.0",
     "typescript": "^6.0.3",
-    "typescript-eslint": "^8.70.0",
-    "vite": "^8.3.0",
+    "typescript-eslint": "^8.71.0",
+    "vite": "^8.3.1",
     "vite-plugin-csp-guard": "^4.0.1",
     "vite-plugin-solid": "^2.11.14",
     "vite-tsconfig-paths": "6.1.1",
```

**File**: `crates/assets/js/client/package.json` (modified, +9/-9)
```diff
@@ -2,7 +2,7 @@
   "name": "trailbase",
   "description": "Official TrailBase Client",
   "homepage": "https://trailbase.io",
-  "version": "0.14.1",
+  "version": "0.14.3",
   "license": "Apache-2.0 OR OSL-3.0",
   "type": "module",
   "main": "./src/index.ts",
@@ -43,21 +43,21 @@
   },
   "devDependencies": {
     "@eslint/js": "^10.0.1",
-    "@microsoft/api-extractor": "^7.59.1",
-    "eslint": "^10.10.0",
-    "globals": "^17.12.0",
+    "@microsoft/api-extractor": "^7.59.3",
+    "eslint": "^10.11.0",
+    "globals": "^17.13.0",
     "http-status": "^2.1.0",
-    "jsdom": "^30.0.1",
+    "jsdom": "^30.1.1",
     "nano-spawn": "^2.1.0",
     "oauth2-mock-server": "^8.2.3",
     "otplib": "^13.5.0",
-    "prettier": "^3.9.7",
+    "prettier": "^3.9.9",
     "tinybench": "^6.2.0",
     "typescript": "^6.0.3",
-    "typescript-eslint": "^8.70.0",
-    "vite": "^8.3.0",
+    "typescript-eslint": "^8.71.0",
+    "vite": "^8.3.1",
     "vite-node": "^6.0.0",
-    "vite-plugin-dts": "^5.1.0",
+    "vite-plugin-dts": "^5.1.1",
     "vitest": "^4.1.11"
   }
 }
```

**File**: `crates/assets/js/client/src/record_api.ts` (modified, +5/-7)
```diff
@@ -5,8 +5,6 @@ import { isDev, jsonContentTypeHeader } from "./constants.ts";
 import { parseJSON } from "./json.ts";
 import { Client } from "./client.ts";
 
-import type { JsonValue } from "@bindings/serde_json/JsonValue";
-import type { Operation } from "@bindings/Operation";
 import type { WsProtocol } from "@bindings/WsProtocol";
 
 export interface FileUpload {
@@ -158,11 +156,11 @@ export class CreateOperation<
     return parseJSON(await response.text()).ids[0];
   }
 
-  protected toJSON(): Operation {
+  protected toJSON() {
     return {
       Create: {
         api_name: this.apiName,
-        value: this.record as JsonValue,
+        value: this.record,
       },
     };
   }
@@ -185,12 +183,12 @@ export class UpdateOperation<
     });
   }
 
-  protected toJSON(): Operation {
+  protected toJSON() {
     return {
       Update: {
         api_name: this.apiName,
         record_id: this.id.toString(),
-        value: this.record as JsonValue,
+        value: this.record,
       },
     };
   }
@@ -208,7 +206,7 @@ export class DeleteOperation implements DeferredMutation<void> {
     });
   }
 
-  protected toJSON(): Operation {
+  protected toJSON() {
     return {
       Delete: {
         api_name: this.apiName,
```

**File**: `crates/assets/js/client/vite.config.ts` (modified, +2/-10)
```diff
@@ -2,16 +2,6 @@ import { defineConfig } from "vite";
 import dts from "vite-plugin-dts";
 import { resolve } from "path";
 
-// eslint-disable-next-line @typescript-eslint/no-unused-vars
-function external(
-  source: string,
-  _importer: string | undefined,
-  _isResolved: boolean,
-): boolean {
-  console.log(source);
-  return source.startsWith("../bindings");
-}
-
 export default defineConfig({
   build: {
     outDir: "./dist",
@@ -30,6 +20,8 @@ export default defineConfig({
       // staticImport: true,
       // insertTypesEntry: true,
       bundleTypes: true,
+      // Do not include type-declarations in ./tests/.
+      include: ["src/*"],
     }),
   ],
 });
```

**File**: `crates/auth-ui/ui/package.json` (modified, +10/-10)
```diff
@@ -18,11 +18,11 @@
     "@kobalte/core": "^0.13.14",
     "@nanostores/persistent": "^1.3.5",
     "@nanostores/solid": "^1.1.1",
-    "astro": "^7.3.2",
+    "astro": "^7.3.5",
     "astro-icon": "^1.2.0",
     "class-variance-authority": "^0.7.1",
     "clsx": "^2.1.1",
-    "nanostores": "^1.5.3",
+    "nanostores": "^1.5.4",
     "solid-icons": "^1.2.0",
     "solid-js": "^1.9.15",
     "tailwind-merge": "^3.7.0",
@@ -31,22 +31,22 @@
   },
   "devDependencies": {
     "@eslint/js": "^10.0.1",
-    "@iconify-json/tabler": "^1.2.38",
+    "@iconify-json/tabler": "^1.2.41",
     "@kobalte/tailwindcss": "^0.9.0",
     "@tailwindcss/typography": "^0.5.20",
     "@tailwindcss/vite": "^4.3.3",
-    "eslint": "^10.10.0",
-    "eslint-plugin-astro": "^3.1.0",
+    "eslint": "^10.11.0",
+    "eslint-plugin-astro": "^3.2.1",
     "eslint-plugin-better-tailwindcss": "^4.7.0",
     "eslint-plugin-solid": "^0.18.0",
-    "globals": "^17.12.0",
-    "prettier": "^3.9.7",
-    "prettier-plugin-astro": "^1.0.0",
+    "globals": "^17.13.0",
+    "prettier": "^3.9.9",
+    "prettier-plugin-astro": "^1.1.0",
     "prettier-plugin-tailwindcss": "^0.8.1",
-    "sharp": "^0.35.4",
+    "sharp": "^0.35.5",
     "tailwindcss": "^4.3.3",
     "tw-animate-css": "^1.4.0",
     "typescript": "^6.0.3",
-    "typescript-eslint": "^8.70.0"
+    "typescript-eslint": "^8.71.0"
   }
 }
```

**File**: `docs/examples/record_api_ts/package.json` (modified, +4/-4)
```diff
@@ -9,11 +9,11 @@
   },
   "devDependencies": {
     "@eslint/js": "^10.0.1",
-    "@types/node": "^26.6.1",
-    "eslint": "^10.10.0",
-    "prettier": "^3.9.7",
+    "@types/node": "^26.6.3",
+    "eslint": "^10.11.0",
+    "prettier": "^3.9.9",
     "typescript": "^6.0.3",
-    "typescript-eslint": "^8.70.0",
+    "typescript-eslint": "^8.71.0",
     "vitest": "^4.1.11"
   },
   "dependencies": {
```

---

### Incident Patch 6: `a9daff5b` (2026-10-02)
**Commit Message**: The `trailbase-sqlite` pg tests seem to be causing the timeouts. Remove from default runs.

**File**: `lefthook.yml` (modified, +1/-1)
```diff
@@ -63,7 +63,7 @@ pre-commit:
       glob: "*.rs"
       exclude:
         - bindings/**
-      run: pnpm i --frozen-lockfile --prefer-offline --reporter=append-only && PNPM_OFFLINE=TRUE cargo test --workspace --features=geos,otel,pg,wasm -- --nocapture
+      run: pnpm i --frozen-lockfile --prefer-offline && PNPM_OFFLINE=TRUE cargo test --workspace --features=geos,otel,wasm -- --nocapture
 
     clippy:
       glob: "*.rs"
```

---

### Incident Patch 7: `76424ce5` (2026-10-01)
**Commit Message**: Add referential actions to FKs in create/alter table forms. Fixes #294.

**File**: `crates/assets/js/admin/src/components/explorer/CreateAlterColumnForm.tsx` (modified, +107/-15)
```diff
@@ -63,6 +63,7 @@ import { cn } from "@/lib/utils";
 import type { Column } from "@bindings/Column";
 import type { ColumnDataType } from "@bindings/ColumnDataType";
 import type { ColumnOption } from "@bindings/ColumnOption";
+import type { ReferentialAction } from "@bindings/ReferentialAction";
 import type { Table } from "@bindings/Table";
 
 export function newDefaultColumn(
@@ -162,10 +163,10 @@ function ColumnOptionCheckField(props: {
 
       <HoverCardContent class="ui-expanded:shadow-md w-80">
         <div class="flex justify-between space-x-4">
-          <div class="space-y-1">
-            <h4 class="text-sm font-semibold">Column Constraint</h4>
+          <div class="space-y-1 text-sm">
+            <h4 class="font-semibold">Column Constraint</h4>
 
-            <p class="text-sm">
+            <p>
               Can be any boolean expression constant like{" "}
               <span class="font-mono font-bold">{`${props.columnName} < 42 `}</span>
               including SQL function calls like{" "}
@@ -235,10 +236,10 @@ function ColumnOptionDefaultField(props: {
 
       <HoverCardContent class="w-80">
         <div class="flex justify-between space-x-4">
-          <div class="space-y-1">
-            <h4 class="text-sm font-semibold">Column Default Value</h4>
+          <div class="space-y-1 text-sm">
+            <h4 class="font-semibold">Column Default Value</h4>
 
-            <p class="text-sm">
+            <p>
               Can either be a constant like{" "}
               <span class="font-mono font-bold">'foo'</span>,{" "}
               <span class="font-mono font-bold">42</span>, and{" "}
@@ -324,11 +325,16 @@ function ColumnOptionForeignKeySelect(props: {
   data_type: ColumnDataType;
   databaseSchema: string | null;
 }) {
-  const fkValue = (): string =>
-    getForeignKey(props.value)?.foreign_table ?? "None";
+  const foreignTable = (): string | null =>
+    getForeignKey(props.value)?.foreign_table ?? null;
+
+  const onDelete = (): ReferentialAction | null =>
+    getForeignKey(props.value)?.on_delete ?? null;
+
+  const onUpdate = (): ReferentialAction | null =>
+    getForeignKey(props.value)?.on_update ?? null;
 
   const fkTableOptions = createMemo((): string[] => [
-    "None",
     ...props.allTables
       .filter((schema) => {
         if (schema.temporary || schema.virtual_table) {
@@ -355,10 +361,10 @@ function ColumnOptionForeignKeySelect(props: {
 
       <Select
         multiple={false}
-        value={fkValue()}
+        value={foreignTable()}
         options={fkTableOptions()}
         onChange={(table: string | null) => {
-          if (!table || table === "None") {
+          if (!table) {
             props.onChange(setForeignKey(props.value, undefined));
             return;
           }
@@ -370,7 +376,7 @@ function ColumnOptionForeignKeySelect(props: {
                 (props.databaseSchema ?? "main") && t.name.name === table,
           );
           if (referredTable === undefined) {
-            throw new Error(`Failed to find table '${table}' for fk`);
+            throw new Error(`Failed to find referenced table '${table}'`);
           }
 
           const pkIndex = findPrimaryKeyColumnIndex(referredTable.columns);
@@ -410,6 +416,84 @@ function ColumnOptionForeignKeySelect(props: {
 
         <SelectContent />
       </Select>
+
+      <Show when={foreignTable()}>
+        <div></div>
+
+        <div class="flex flex-col gap-2">
+          <div class="flex w-full items-center gap-2">
+            <div class="min-w-22">ON DELETE</div>
+
+            <Select
+              class="grow"
+              multiple={false}
+              value={onDelete()}
+              options={referentialActions}
+              onChange={(action: ReferentialAction | null) => {
+                const fk = getForeignKey(props.value);
+                if (!fk) {
+                  return;
+                }
+
+                props.onChange(
+                  setForeignKey(props.value, {
+                    ...fk,
+                    on_delete: action,
+                  }),
+                );
+              }}
+              itemComponent={(props) => (
+                <SelectItem item={props.item}>{props.item.rawValue}</SelectItem>
+              )}
+              disabled={props.disabled}
+            >
+              <SelectTrigger>
+                <SelectValue<ReferentialAction>>
+                  {(state) => state.selectedOption()}
+                </SelectValue>
+              </SelectTrigger>
+
+              <SelectContent />
+            </Select>
+          </div>
+
+          <div class="flex w-full items-center gap-2">
+            <div class="min-w-22">ON UPDATE</div>
+
+            <Select
+              class="grow"
+              multiple={false}
+              value={onUpdate()}
+              options={referentialActions}
+              onChange={(action: ReferentialAction | null) => {
+                const fk = getForeignKey(props.value);
+     
```

---

### Incident Patch 8: `782c3b89` (2026-09-28)
**Commit Message**: Add security audit GitHub workflow. Mostly #296 by @0rzech - Thanks.

**File**: `.github/workflows/audit.yaml` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+name: audit
+
+on:
+  push:
+    branches:
+      - main
+      - dev
+    paths:
+      - "**/Cargo.lock"
+      - "**/Cargo.toml"
+      - "**/deny.toml"
+      - ".github/workflows/audit.yaml"
+      - "pnpm-lock.yaml"
+      - "pnpm-workspace.yaml"
+  schedule:
+    - cron: "0 7 * * *"
+  workflow_dispatch:
+
+permissions:
+  contents: read
+
+concurrency:
+  group: ${{ github.workflow }}-${{ github.event_name }}-${{ github.event.pull_request.number || github.ref_name }}
+  cancel-in-progress: true
+
+jobs:
+  check-advisories-and-sources:
+    runs-on: ubuntu-latest
+    timeout-minutes: 5
+
+    steps:
+      - uses: actions/checkout@v7
+        with:
+          submodules: true
+
+      # Audit JS/TS
+      - uses: ./.github/actions/setup_pnpm
+      - run: pnpm audit --prod
+
+      # Audit Rust
+      - uses: taiki-e/install-action@v2
+        with:
+          tool: cargo-deny
+      - run: cargo deny check advisories sources
```

**File**: `Cargo.lock` (modified, +39/-18)
```diff
@@ -3117,9 +3117,9 @@ dependencies = [
 
 [[package]]
 name = "geos"
-version = "11.2.2"
+version = "11.3.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "acbd75af3e7609d8c30dcefff46016dde2fdb355b38c3caefcf712fd48558372"
+checksum = "7b131d80ad838c8e5b9e0d31482f893961267fbd29903ea1b6a1565d814b07e5"
 dependencies = [
  "geo-types",
  "geojson",
@@ -4246,9 +4246,9 @@ dependencies = [
 
 [[package]]
 name = "lazy_static"
-version = "1.5.0"
+version = "1.5.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "bbd2bcb4c963f2ddae06a2efc7e9f3591312473c50c6685e1f298068316e66fe"
+checksum = "20870f649af7073d53e38067b2a84312175d56ea15217e1b15bc83506ec50afb"
 dependencies = [
  "spin 0.9.9",
 ]
@@ -5660,9 +5660,9 @@ checksum = "a89322df9ebe1c1578d689c92318e070967d1042b512afbe49518723f4e6d5cd"
 
 [[package]]
 name = "pin-utils"
-version = "0.1.0"
+version = "0.1.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8b870d8c151b6f2fb93e84a13146138f05d02ed11c7e7c54f8826aaaf7c9f184"
+checksum = "13bee6c73da26345c729282832b60b0363cf3dd9f4bfd81d8551b7a1c889a113"
 
 [[package]]
 name = "piper"
@@ -6210,9 +6210,9 @@ dependencies = [
 
 [[package]]
 name = "quinn-proto"
-version = "0.11.18"
+version = "0.11.19"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a9746dbde176634f4f2f1faf2404e30a31b2bc1e9cafb5329c95d8177a18c9fc"
+checksum = "0e750cca55fe4f0439a15d0bb529da9651e79993e8e72c61a899a36d462befbe"
 dependencies = [
  "aws-lc-rs",
  "bytes",
@@ -6233,9 +6233,9 @@ dependencies = [
 
 [[package]]
 name = "quinn-udp"
-version = "0.5.15"
+version = "0.5.16"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "35a133f956daabe89a61a685c2649f13d82d5aa4bd5d12d1277e1072a21c0694"
+checksum = "af66907df18639dcf4db56ca65490cabc4b27a97dbadd96f2926cca73298f016"
 dependencies = [
  "cfg_aliases",
  "libc",
@@ -8944,7 +8944,7 @@ version = "0.1.0"
 dependencies = [
  "futures-util",
  "parking_lot",
- "paste",
+ "pastey",
  "tokio",
 ]
 
@@ -9842,6 +9842,16 @@ dependencies = [
  "wasmparser 0.259.0",
 ]
 
+[[package]]
+name = "wasm-encoder"
+version = "0.260.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "e1e9692da9ef627c5ee12b45378f68ac2689ce306f88078f5cf849b7c3444ed8"
+dependencies = [
+ "leb128fmt",
+ "wasmparser 0.260.0",
+]
+
 [[package]]
 name = "wasm-metadata"
 version = "0.254.0"
@@ -10245,6 +10255,17 @@ dependencies = [
  "semver",
 ]
 
+[[package]]
+name = "wasmparser"
+version = "0.260.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "4c94519d78304dc4a4bb5925eda6ff153bf06167467cff9233dc9593bae28fdd"
+dependencies = [
+ "bitflags 2.13.2",
+ "indexmap",
+ "semver",
+]
+
 [[package]]
 name = "wasmprinter"
 version = "0.254.0"
@@ -10573,22 +10594,22 @@ dependencies = [
 
 [[package]]
 name = "wast"
-version = "259.0.0"
+version = "260.0.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c69beba8d9da07af9a0971b559149a2ac4729895b55144de4fddbf5a02660648"
+checksum = "17573754cde137d26852892330414efb6d1d33480adcd10e8825d092b2132229"
 dependencies = [
  "bumpalo",
  "leb128fmt",
  "memchr",
  "unicode-width",
- "wasm-encoder 0.259.0",
+ "wasm-encoder 0.260.0",
 ]
 
 [[package]]
 name = "wat"
-version = "1.259.0"
+version = "1.260.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c6eec44b0c80391b20fb7ad9ea440c72c5d382385bdf74444bb18321c425017e"
+checksum = "5f56de9341c410d04121da51dd16c11d095cb6a914bd2b2850cd3c60558c0c15"
 dependencies = [
  "wast",
 ]
@@ -11263,9 +11284,9 @@ dependencies = [
 
 [[package]]
 name = "yoke-derive"
-version = "0.8.3"
+version = "0.8.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "33811428bee40dbceb6d545e95754741d17a6aef9a4849f0fd62e2ba4f412a78"
+checksum = "ec8ebde2db3681e8c9980cc27822030e68752690ddfa9473e739aeb4dbde6d71"
 dependencies = [
  "proc-macro2",
  "quote",
```

**File**: `crates/reactive/Cargo.toml` (modified, +1/-1)
```diff
@@ -10,5 +10,5 @@ readme = "../../README.md"
 [dependencies]
 futures-util = { workspace = true }
 parking_lot = { workspace = true }
-paste = "1"
+pastey = "0.2.3"
 tokio = { workspace = true }
```

**File**: `crates/reactive/src/macros.rs` (modified, +2/-4)
```diff
@@ -1,5 +1,3 @@
-use paste::paste;
-
 use crate::{Merge, Reactive};
 
 impl<T: Clone + Default + Send + Sync + 'static> Merge for &Reactive<T> {
@@ -11,7 +9,7 @@ impl<T: Clone + Default + Send + Sync + 'static> Merge for &Reactive<T> {
 }
 
 macro_rules! impl_merge_for_nested_tuple {
-    ( $($i:literal),* ) => { paste!{
+    ( $($i:literal),* ) => { pastey::paste!{
     impl < $( [<T $i>], )* > Merge for ( $( [<T $i>], )* )
     where
         $( [<T $i>]: Merge, ) *
@@ -23,7 +21,7 @@ macro_rules! impl_merge_for_nested_tuple {
 }
 
 macro_rules! body {
-    ( $($i:literal),* ) => {paste!{
+    ( $($i:literal),* ) => { pastey::paste!{
         type Output = ( $([<T $i>]::Output,)* );
 
         fn merge(self) -> Reactive<Self::Output> {
```

**File**: `deny.toml` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+[advisories]
+unmaintained = "workspace"
+ignore = [{ id = "RUSTSEC-2023-0071", reason = "rsa: no safe upgrade availble and only used for Signin-with-Apple pub-key RSA" }]
+
+[sources]
+required-git-spec = "rev"
+unknown-git = "deny"
+unknown-registry = "deny"
```

**File**: `pnpm-lock.yaml` (modified, +101/-88)
```diff
@@ -4,6 +4,9 @@ settings:
   autoInstallPeers: true
   excludeLinksFromLockfile: false
 
+overrides:
+  form-data@>=4.0.0 <4.0.6: ^4.0.6
+
 importers:
 
   client/testfixture/guests/typescript:
@@ -26,7 +29,7 @@ importers:
         version: 10.10.0(jiti@2.7.0)(supports-color@10.2.2)
       prettier:
         specifier: ^3.9.7
-        version: 3.9.7
+        version: 3.9.8
       typescript:
         specifier: ^6.0.3
         version: 6.0.3
@@ -198,10 +201,10 @@ importers:
         version: 30.0.1(@noble/hashes@2.4.0)
       prettier:
         specifier: ^3.9.7
-        version: 3.9.7
+        version: 3.9.8
       prettier-plugin-tailwindcss:
         specifier: ^0.8.1
-        version: 0.8.1(prettier-plugin-astro@1.0.0(@emnapi/core@1.11.3)(@emnapi/runtime@1.11.3)(prettier@3.9.7))(prettier@3.9.7)
+        version: 0.8.1(prettier-plugin-astro@1.0.0(@emnapi/core@1.11.3)(@emnapi/runtime@1.11.3)(prettier@3.9.8))(prettier@3.9.8)
       tailwindcss:
         specifier: ^4.3.3
         version: 4.3.3
@@ -283,7 +286,7 @@ importers:
         version: 13.5.0
       prettier:
         specifier: ^3.9.7
-        version: 3.9.7
+        version: 3.9.8
       tinybench:
         specifier: ^6.2.0
         version: 6.2.0
@@ -310,7 +313,7 @@ importers:
     dependencies:
       '@astrojs/check':
         specifier: ^0.9.10
-        version: 0.9.10(prettier-plugin-astro@1.0.0(@emnapi/core@1.11.3)(@emnapi/runtime@1.11.3)(prettier@3.9.7))(prettier@3.9.7)(typescript@6.0.3)
+        version: 0.9.10(prettier-plugin-astro@1.0.0(@emnapi/core@1.11.3)(@emnapi/runtime@1.11.3)(prettier@3.9.8))(prettier@3.9.8)(typescript@6.0.3)
       '@astrojs/solid-js':
         specifier: ^7.0.2
         version: 7.0.2(@testing-library/jest-dom@7.0.1(@testing-library/dom@10.4.2)(vitest@4.1.11(@types/node@26.6.1)(happy-dom@20.14.5)(jsdom@30.0.1(@noble/hashes@2.4.0))(vite@8.3.0(@types/node@26.6.1)(esbuild@0.28.2)(jiti@2.7.0)(terser@5.48.0)(yaml@2.9.1))))(@types/node@26.6.1)(esbuild@0.28.2)(jiti@2.7.0)(solid-js@1.9.15)(supports-color@10.2.2)(terser@5.48.0)(yaml@2.9.1)
@@ -386,13 +389,13 @@ importers:
         version: 17.12.0
       prettier:
         specifier: ^3.9.7
-        version: 3.9.7
+        version: 3.9.8
       prettier-plugin-astro:
         specifier: ^1.0.0
-        version: 1.0.0(@emnapi/core@1.11.3)(@emnapi/runtime@1.11.3)(prettier@3.9.7)
+        version: 1.0.0(@emnapi/core@1.11.3)(@emnapi/runtime@1.11.3)(prettier@3.9.8)
       prettier-plugin-tailwindcss:
         specifier: ^0.8.1
-        version: 0.8.1(prettier-plugin-astro@1.0.0(@emnapi/core@1.11.3)(@emnapi/runtime@1.11.3)(prettier@3.9.7))(prettier@3.9.7)
+        version: 0.8.1(prettier-plugin-astro@1.0.0(@emnapi/core@1.11.3)(@emnapi/runtime@1.11.3)(prettier@3.9.8))(prettier@3.9.8)
       sharp:
         specifier: ^0.35.4
         version: 0.35.4(@types/node@26.6.1)
@@ -413,7 +416,7 @@ importers:
     dependencies:
       '@astrojs/check':
         specifier: ^0.9.10
-        version: 0.9.10(prettier-plugin-astro@1.0.0(@emnapi/core@1.11.3)(@emnapi/runtime@1.11.3)(prettier@3.9.7))(prettier@3.9.7)(typescript@6.0.3)
+        version: 0.9.10(prettier-plugin-astro@1.0.0(@emnapi/core@1.11.3)(@emnapi/runtime@1.11.3)(prettier@3.9.8))(prettier@3.9.8)(typescript@6.0.3)
       '@astrojs/rss':
         specifier: ^4.0.19
         version: 4.0.19
@@ -495,13 +498,13 @@ importers:
         version: 17.12.0
       prettier:
         specifier: ^3.9.7
-        version: 3.9.7
+        version: 3.9.8
       prettier-plugin-astro:
         specifier: ^1.0.0
-        version: 1.0.0(@emnapi/core@1.11.3)(@emnapi/runtime@1.11.3)(prettier@3.9.7)
+        version: 1.0.0(@emnapi/core@1.11.3)(@emnapi/runtime@1.11.3)(prettier@3.9.8)
       prettier-plugin-tailwindcss:
         specifier: ^0.8.1
-        version: 0.8.1(prettier-plugin-astro@1.0.0(@emnapi/core@1.11.3)(@emnapi/runtime@1.11.3)(prettier@3.9.7))(prettier@3.9.7)
+        version: 0.8.1(prettier-plugin-astro@1.0.0(@emnapi/core@1.11.3)(@emnapi/runtime@1.11.3)(prettier@3.9.8))(prettier@3.9.8)
       typescript:
         specifier: ^6.0.3
         version: 6.0.3
@@ -526,7 +529,7 @@ importers:
         version: 10.10.0(jiti@2.7.0)(supports-color@10.2.2)
       prettier:
         specifier: ^3.9.7
-        version: 3.9.7
+        version: 3.9.8
       typescript:
         specifier: ^6.0.3
         version: 6.0.3
@@ -563,7 +566,7 @@ importers:
         version: 2.1.0
       prettier:
         specifier: ^3.9.7
-        version: 3.9.7
+        version: 3.9.8
       typescript:
         specifier: ^6.0.3
         version: 6.0.3
@@ -636,10 +639,10 @@ importers:
         version: 17.12.0
       prettier:
         specifier: ^3.9.7
-        version: 3.9.7
+        version: 3.9.8
       prettier-plugin-astro:
         specifier: ^1.0.0
-        version: 1.0.0(@emnapi/core@1.11.3)(@emnapi/runtime@1.11.3)(prettier@3.9.7)
+        version: 1.0.0(@emnapi/core@1.11.3)(@emnapi/runtime@1.11.3)(prettier@3.9.8)
       quicktype:
         specifier: ^23.3.25
       
```

**File**: `pnpm-workspace.yaml` (modified, +5/-0)
```diff
@@ -27,3 +27,8 @@ allowBuilds:
   tree-sitter-json: true
 minimumReleaseAgeExclude:
   - trailbase@0.13.1
+overrides:
+  form-data@>=4.0.0 <4.0.6: ^4.0.6
+audit:
+  ignore:
+    - GHSA-8cw4-87c7-c6xx # csv-parse: update requires major version bump
```

---

### Incident Patch 9: `2fdafd3a` (2026-10-01)
**Commit Message**: Fix call WASM timeouts and Job error response handling. Based on #297 - 🙏 @jimmydjabali. Fixes #297.

**File**: `crates/wasm-runtime-axum/src/lib.rs` (modified, +14/-1)
```diff
@@ -231,13 +231,26 @@ pub async fn install_routes_and_jobs<S: Clone + Send + Sync + 'static>(
             .body(empty())
             .map_err(|err| WasmError::Other(err.to_string()))?;
 
-          store
+          let response = store
             .call_incoming_http_handler(
               request,
               Some(timeout.map_or_else(|| Duration::from_mins(60), Duration::from_millis)),
             )
             .await?;
 
+          // Translate non-ok HTTP responses back to errors.
+          let status = response.status();
+          if !status.is_success() {
+            let body = response.into_body().collect().await.unwrap_or_default();
+            return Err(
+              format!(
+                "Job failed [{status}]: {body}",
+                body = String::from_utf8_lossy(&body.to_bytes())
+              )
+              .into(),
+            );
+          }
+
           Ok::<_, AnyError>(())
         });
       }),
```

**File**: `crates/wasm-runtime-host/src/lib.rs` (modified, +16/-7)
```diff
@@ -9,6 +9,7 @@ mod sqlite;
 
 use bytes::Bytes;
 use core::future::Future;
+use deadpool::managed::Timeouts;
 use http::Uri;
 use http_body_util::combinators::UnsyncBoxBody;
 use std::path::{Path, PathBuf};
@@ -378,9 +379,7 @@ impl HttpStore {
           .max_size(POOL_HARD_LIMIT)
           .runtime(deadpool::Runtime::Tokio1)
           .timeouts(Timeouts {
-            wait: Some(WASM_WAIT_TIMEOUT),
-            // create: Some(WASM_WAIT_TIMEOUT.into()),
-            // recycle: Some(WASM_WAIT_TIMEOUT.into()),
+            wait: Some(DEFAULT_CALL_TIMEOUT),
             ..Default::default()
           })
           .build()
@@ -497,7 +496,15 @@ impl HttpStore {
                   ref mut store,
                   ref proxy_bindings,
                   ref mut has_trapped,
-                } = *pool.get().await.map_err(|_err| Error::Timeout(None))?;
+                } = *pool
+                  .timeout_get(&Timeouts {
+                    // NOTE: In principle we could wait shorter here, i.e. `call_timeout - dt`, the
+                    // time we spent to get here. Typically `dt` should be small.
+                    wait: Some(call_timeout),
+                    ..Default::default()
+                  })
+                  .await
+                  .map_err(|_err| Error::Timeout(None))?;
 
                 debug_assert!(!*has_trapped);
 
@@ -574,8 +581,11 @@ impl HttpStore {
           },
           // NOTE: We have a separate timeout here (besides the call timeout above), since
           // cancelling the call won't drop the sender to close the receiver (the sender is
-          // leaked via the store). Thus we have to separately time out the receiving end.
-          _timeout = tokio::time::sleep(WASM_WAIT_TIMEOUT) => {
+          // leaked via the Wasmtime store). We thus have this additional timeout on the receiving
+          // end.
+          // It must not be shorter than the call timeout: guests only respond once a job
+          // handler returns, so a shorter wait may report a still-running job as timed out.
+          _timeout = tokio::time::sleep(call_timeout) => {
             Err(Error::Timeout(Some(uri)))
           },
         };
@@ -910,5 +920,4 @@ mod tests {
 }
 
 const DEFAULT_CALL_TIMEOUT: Duration = Duration::from_secs(20);
-const WASM_WAIT_TIMEOUT: Duration = Duration::from_secs(20);
 const POOL_HARD_LIMIT: usize = 65536;
```

---

### Incident Patch 10: `63f8ca6e` (2026-10-01)
**Commit Message**: For `pg-test` runs, `lifecycle_record_api_and_logs_integration_tests` seems to have the sole but aggressive offender when it comes to timeouts. Apply the same tooling (explict shutdown + watchdog) as for unit tests :/.

**File**: `crates/core/src/app_state.rs` (modified, +57/-49)
```diff
@@ -735,7 +735,23 @@ mod test_utils {
       let pg_uri = db.connection_string().to_string();
 
       let db = Arc::new(parking_lot::Mutex::new(Some(db)));
-      start_watchdog(&db);
+
+      // NOTE: During CI, we have tests occasionally time out. This is an attempt at getting ahead.
+      start_watchdog(
+        &db,
+        |db| {
+          if let Some(mut db) = db.lock().take() {
+            info!("shutting down pglite");
+            db.close().unwrap();
+
+            // Give the test a chance to terminate.
+            std::thread::sleep(std::time::Duration::from_secs(15));
+          } else {
+            info!("pglite already consumed");
+          }
+        },
+        std::time::Duration::from_mins(8),
+      );
 
       let pg_shutdown = scopeguard::guard(db, |db| {
         if let Some(mut db) = db.lock().take() {
@@ -849,64 +865,56 @@ pub(crate) fn validate_path(path: Option<&PathBuf>) -> Result<(), InitError> {
   return Ok(());
 }
 
-#[cfg(all(feature = "pg-test", test))]
-fn start_watchdog(db: &Arc<parking_lot::Mutex<Option<oliphaunt_wasix::OliphauntServer>>>) {
+#[cfg(feature = "pg-test")]
+pub fn start_watchdog<T: Send + Sync + 'static>(
+  resource: &Arc<T>,
+  cb: impl FnOnce(&T) + Send + Sync + 'static,
+  timeout: std::time::Duration,
+) {
   use std::sync::OnceLock;
   use std::thread::{JoinHandle, sleep};
   use std::time::{Duration, SystemTime};
 
-  let db = Arc::downgrade(&db);
+  let resource = Arc::downgrade(&resource);
+  let _handle = tokio::runtime::Handle::current();
 
-  static WATCHDOG_THREAD: OnceLock<JoinHandle<()>> = OnceLock::new();
-  WATCHDOG_THREAD.get_or_init(|| {
-    return std::thread::spawn({
-      // NOTE: During CI, we have random tests occasionally time out. This is an attempt
-      // to get ahead of CI's own timeout of 6h.
-      let handle = tokio::runtime::Handle::current();
-
-      #[allow(unreachable_code)]
-      move || {
-        let started = SystemTime::now();
-
-        debug!("WATCHDOG: started");
-
-        loop {
-          let now = SystemTime::now();
-          let elapsed = now.duration_since(started).unwrap_or_default();
-
-          let runtime_monitor = tokio_metrics::RuntimeMonitor::new(&handle);
-          // NOTE: For some reasons iterating .intervals() bricks the test.
-          info!(
-            "WATCHDOG elapsed {elapsed:?}: metrics = {:?}",
-            runtime_monitor.intervals()
-          );
+  let watcher = move || {
+    debug!("WATCHDOG: started");
 
-          if elapsed > Duration::from_mins(8) {
-            error!("WATCHDOG: expired");
-
-            if let Some(arc) = db.upgrade() {
-              if let Some(mut db) = arc.lock().take() {
-                info!("WATCHDOG: shutting down pglite");
-                db.close().unwrap();
-
-                // Give the test a chance to terminate.
-                sleep(Duration::from_secs(15));
-              } else {
-                info!("WATCHDOG: DB already consumed");
-              }
-            } else {
-              info!("WATCHDOG: DB already shut-down");
-            }
+    let started = SystemTime::now();
+    loop {
+      let now = SystemTime::now();
+      let elapsed = now.duration_since(started).unwrap_or_default();
 
-            error!("WATCHDOG: terminated");
-            std::process::exit(1);
-          }
+      #[cfg(test)]
+      {
+        let runtime_monitor = tokio_metrics::RuntimeMonitor::new(&_handle);
+        // NOTE: For some reasons iterating .intervals() bricks the test.
+        info!(
+          "WATCHDOG elapsed {elapsed:?}: metrics = {:?}",
+          runtime_monitor.intervals()
+        );
+      }
+
+      if elapsed >= timeout {
+        error!("WATCHDOG: expired");
 
-          sleep(Duration::from_mins(1));
+        if let Some(resource) = resource.upgrade() {
+          cb(&resource);
+        } else {
+          info!("WATCHDOG: resource already dropped");
         }
+
+        error!("WATCHDOG: terminating process");
+        std::process::exit(42);
       }
-    });
-  });
+
+      sleep(Duration::from_mins(1));
+    }
+  };
+
+  static WATCHDOG_THREAD: OnceLock<JoinHandle<()>> = OnceLock::new();
+  WATCHDOG_THREAD.get_or_init(|| std::thread::spawn(watcher));
 }
 
 #[cfg(test)]
```

**File**: `crates/core/tests/core_integration_test.rs` (modified, +54/-15)
```diff
@@ -17,32 +17,71 @@ use trailbase::test_utils::*;
 use trailbase::util::id_to_b64;
 use trailbase::{DataDir, Server, ServerOptions, SocketAddr};
 
-/// Tests setup, record APIs, and logs writes (and OpenTelemetry if present).
-#[tokio::test]
-async fn lifecycle_record_api_and_logs_integration_tests() {
-  let data_dir = temp_dir::TempDir::new().unwrap();
+#[allow(unused)]
+struct PgSetup {
+  pg_uri: String,
+  cleanup: Vec<Box<dyn std::any::Any + Send + Sync>>,
+}
 
-  #[cfg(feature = "pg-test")]
+#[cfg(all(test, feature = "pg-test"))]
+fn start_pg() -> PgSetup {
   let db = oliphaunt_wasix::OliphauntServer::builder()
     .extensions([
+      oliphaunt_wasix::Extension::PGCRYPTO,
       // Enable case-insensitive text columns.
       oliphaunt_wasix::Extension::CITEXT,
-      // NOTE: pgcrypto and postgis, which would be interesting for us, are not currently
-      // supported: https://github.com/f0rr0/oliphaunt/blob/main/docs/EXTENSIONS.md
+      // Enable postgis.
+      // oliphaunt_wasix::Extension::POSTGIS,
     ])
     .start()
     .unwrap();
 
+  let pg_uri = db.connection_string().to_string();
+
+  let db = Arc::new(parking_lot::Mutex::new(Some(db)));
+
+  // NOTE: During CI, we have tests occasionally time out. This is an attempt at getting ahead.
+  trailbase::app_state::start_watchdog(
+    &db,
+    |db| {
+      if let Some(mut db) = db.lock().take() {
+        log::info!("shutting down pglite");
+        db.close().unwrap();
+
+        // Give the test a chance to terminate.
+        std::thread::sleep(std::time::Duration::from_secs(15));
+      } else {
+        log::info!("pglite already consumed");
+      }
+    },
+    std::time::Duration::from_mins(8),
+  );
+
+  let pg_shutdown = scopeguard::guard(db, |db| {
+    if let Some(mut db) = db.lock().take() {
+      db.close().unwrap();
+    }
+  });
+
+  return PgSetup {
+    pg_uri,
+    cleanup: vec![Box::new(pg_shutdown)],
+  };
+}
+
+/// Tests setup, record APIs, and logs writes (and OpenTelemetry if present).
+#[tokio::test]
+async fn lifecycle_record_api_and_logs_integration_tests() {
+  let data_dir = temp_dir::TempDir::new().unwrap();
+
+  let pg_setup: Option<PgSetup> = cfg_select! {
+      feature = "pg-test" => Some(start_pg()),
+      _ => None,
+  };
+
   let Server {
     state, main_router, ..
-  } = initialize_server(
-    &data_dir,
-    cfg_select! {
-        feature = "pg-test" => Some(db.connection_string().to_string()),
-        _ => None,
-    },
-  )
-  .await;
+  } = initialize_server(&data_dir, pg_setup.as_ref().map(|s| s.pg_uri.clone())).await;
 
   let conn = state.connection_manager().main_entry().connection;
 
```

---

### Incident Patch 11: `1f807862` (2026-09-30)
**Commit Message**: Use an expoential moving average + randomization to make check-password-equivalent waits a bit less obvious.

**File**: `Cargo.lock` (modified, +0/-2)
```diff
@@ -8599,7 +8599,6 @@ version = "0.2.0"
 dependencies = [
  "aes-gcm-siv",
  "anyhow",
- "argon2",
  "askama",
  "async-channel 2.5.0",
  "async-trait",
@@ -8713,7 +8712,6 @@ name = "trailbase-assets"
 version = "0.2.0"
 dependencies = [
  "axum",
- "itertools 0.15.0",
  "log",
  "rust-embed",
  "tower-service",
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -71,7 +71,7 @@ http-body-util = { version = "0.1.5", default-features = false }
 hyper = { version = "1.11.1", default-features = false }
 itertools = { version = "0.15.0", default-features = false, features = ["use_std"] }
 jsonwebtoken = { version = "11.1.0", default-features = false, features = ["use_pem", "rust_crypto"] }
-libsqlite3-sys = { version = "0.38.2", default-features = false, features = ["bundled", "preupdate_hook"] }
+# libsqlite3-sys = { version = "0.38.2", default-features = false, features = ["bundled", "preupdate_hook"] }
 litegis = { version = "0.0.7", default-features = false }
 log = { version = "0.4.34", default-features = false }
 mimalloc = { version = "^0.1.52", default-features = false }
```

**File**: `crates/assets/Cargo.toml` (modified, +0/-1)
```diff
@@ -14,7 +14,6 @@ exclude = [
 
 [dependencies]
 axum = { workspace = true }
-itertools = { workspace = true }
 log = { workspace = true }
 rust-embed = { workspace = true }
 tower-service = { version = "0.3.3", default-features = false }
```

**File**: `crates/core/Cargo.toml` (modified, +0/-1)
```diff
@@ -36,7 +36,6 @@ ws = ["axum/ws"]
 
 [dependencies]
 aes-gcm-siv = "0.12.1"
-argon2 = { workspace = true }
 askama = { workspace = true }
 async-channel = "2.5.0"
 async-trait = "0.1.92"
```

**File**: `crates/core/src/auth/api/login.rs` (modified, +5/-36)
```diff
@@ -14,7 +14,7 @@ use crate::app_state::AppState;
 use crate::auth::api::totp::new_totp;
 use crate::auth::jwt::PendingAuthTokenClaims;
 use crate::auth::login_params::{LoginInputParams, LoginParams, build_and_validate_input_params};
-use crate::auth::password::{check_user_password, measure_password_verification_timing};
+use crate::auth::password::{check_user_password, sleep_for_password_check_equivalent};
 use crate::auth::user::DbUser;
 use crate::auth::util::{
   SameSite, new_cookie, remove_cookie, user_by_email, user_by_id, user_by_username,
@@ -228,35 +228,6 @@ pub(crate) async fn login_handler(
   };
 }
 
-fn get_somewhat_stable_password_verification_timing() -> std::time::Duration {
-  use std::time::Duration;
-
-  fn micros(d: Duration) -> f64 {
-    return d.as_micros() as f64;
-  }
-
-  const TOLERANCE: f64 = 0.5;
-
-  let mut prev: Option<Duration> = None;
-  let mut i = 0;
-
-  loop {
-    let curr = measure_password_verification_timing();
-    if i > 5 {
-      return curr;
-    }
-
-    if let Some(prev) = prev
-      && (micros(curr) - micros(prev)).abs() <= TOLERANCE * micros(prev)
-    {
-      return curr;
-    }
-
-    prev = Some(curr);
-    i += 1;
-  }
-}
-
 async fn check_credentials(
   state: &AppState,
   id: UserIdentifier,
@@ -270,12 +241,10 @@ async fn check_credentials(
   let db_user = match maybe_db_user {
     Ok(db_user) => db_user,
     Err(_err) => {
-      // Hashing is quite expensive: tens of milliseconds for release builds and hundreds for
-      // debug builds. To avoid leaking account presence w/o burning cycles, we have to wait here.
-      static WAIT: LazyLock<std::time::Duration> =
-        LazyLock::new(get_somewhat_stable_password_verification_timing);
-
-      tokio::time::sleep(*WAIT).await;
+      // To avoid leaking account presence w/o burning cycles, we have to wait here for a roughly
+      // check equivalent amount of time. We don't just hash nonsense because hashing is quite
+      // expensive: tens of milliseconds for release builds and hundreds for debug builds.
+      sleep_for_password_check_equivalent().await;
 
       // Don't let the error code reveal account pressence either.
       return Err(AuthError::Unauthorized);
```

**File**: `crates/core/src/auth/password.rs` (modified, +78/-9)
```diff
@@ -1,3 +1,4 @@
+use rand::RngExt;
 use std::time::Duration;
 
 use crate::auth::AuthError;
@@ -115,27 +116,82 @@ pub async fn check_user_password(db_user: &DbUser, password: String) -> Result<(
     );
   }
 
-  return tokio::time::timeout(
+  let started = std::time::Instant::now();
+  let result = tokio::time::timeout(
     HASHING_TIMEOUT,
     tokio::task::spawn_blocking(move || {
       return check_user_password_impl(&password, &password_hash);
     }),
   )
-  .await
-  .map_err(|_| AuthError::Timeout)?
-  .map_err(|_err| {
+  .await;
+
+  exponential_moving_average::update(started.elapsed());
+
+  return result.map_err(|_| AuthError::Timeout)?.map_err(|_err| {
     return cfg_select! {
       debug_assertions => AuthError::Internal(_err.into()),
       _ => AuthError::Internal("busy".into()),
     };
   })?;
 }
 
-pub(crate) fn measure_password_verification_timing() -> std::time::Duration {
-  let hash = hash_password_impl("pw").expect("constant input");
-  let started = std::time::Instant::now();
-  let _ = trailbase_extension::password::verify_password(b"pw", &hash);
-  return started.elapsed();
+mod exponential_moving_average {
+  use std::sync::atomic::AtomicU64;
+  use std::sync::atomic::Ordering;
+  use std::time::Duration;
+
+  // Effective window size of 5.
+  pub const ALPHA: f64 = 2.0 / (5.0 + 1.0);
+  pub static MICROS: AtomicU64 = AtomicU64::new(0);
+
+  pub fn update(d: Duration) {
+    let new = d.as_micros().try_into().unwrap_or(50 * 1000);
+    let old = MICROS.load(Ordering::SeqCst);
+    if old == 0 {
+      MICROS.store(new, Ordering::Relaxed);
+    } else {
+      MICROS.store(
+        // Compute the updated exponential moving average.
+        (ALPHA * (new as f64) + (1.0 - ALPHA) * (old as f64)).ceil() as u64,
+        Ordering::Relaxed,
+      );
+    }
+  }
+
+  pub fn get_micros() -> u64 {
+    let micros = MICROS.load(Ordering::SeqCst);
+    if micros == 0 {
+      let t = measure_password_verification_timing().as_millis() as u64;
+      MICROS.store(t, Ordering::Relaxed);
+      return t;
+    }
+    return micros;
+  }
+
+  fn measure_password_verification_timing() -> Duration {
+    const PW: &str = "?";
+    let hash = super::hash_password_impl(PW).expect("static input");
+    let started = std::time::Instant::now();
+    let _ = trailbase_extension::password::verify_password(PW, &hash);
+    return started.elapsed();
+  }
+}
+
+/// To avoid leaking account presence w/o burning cycles, we have to wait here for a roughly
+/// check equivalent amount of time. We don't just hash nonsense because hashing is quite
+/// expensive: tens of milliseconds for release builds and hundreds for debug builds.
+pub async fn sleep_for_password_check_equivalent() {
+  tokio::time::sleep(get_password_check_equivalent_duration()).await;
+}
+
+fn get_password_check_equivalent_duration() -> Duration {
+  let avg = exponential_moving_average::get_micros() as i64;
+
+  // Randomize the wait to make it less obvious.
+  let range = avg / 10;
+  let delta = rand::rng().random_range(-range..range);
+
+  return Duration::from_micros(std::cmp::max(0, avg + delta) as u64);
 }
 
 const HASHING_TIMEOUT: Duration = Duration::from_secs(5);
@@ -224,4 +280,17 @@ mod tests {
       assert!(test("2.", &options).is_ok());
     }
   }
+
+  #[test]
+  fn password_check_equivalent_durations() {
+    let durations: Vec<_> = (0..10)
+      .map(|_| get_password_check_equivalent_duration())
+      .collect();
+
+    assert!(durations[0].as_micros() > 0);
+
+    // Make sure there's some randomness.
+    let has_diff = durations.windows(2).any(|w| w[0] != w[1]);
+    assert!(has_diff);
+  }
 }
```

---

### Incident Patch 12: `fd8f2f88` (2026-09-30)
**Commit Message**: Push password hashing onto worker-threads. Argon2 is quite expensive: tens of milliseconds in dev builds iif you have AVX. Otherwise, easily hundreds, thus logging in en masse can starve other operations.

**File**: `crates/client/tests/client_integration_test.rs` (modified, +66/-2)
```diff
@@ -90,8 +90,8 @@ fn start_server() -> Result<Option<Server>, std::io::Error> {
           Rlimit {
             // Soft limit.
             current: Some(current_limits.maximum.unwrap_or(1024).min(2048)),
-            // Hard limit.
-            maximum: None,
+            // Hard limit. Don't use None, which implies infinite.
+            maximum: current_limits.maximum,
           },
         ) {
           eprintln!("ERROR: Failed to raise OPEN FILE LIMIT: {err}");
@@ -237,6 +237,70 @@ async fn login_test() {
   client.refresh().await.unwrap();
 }
 
+#[test]
+#[serial]
+fn login_flood_test() {
+  use reqwest::Client;
+  use reqwest::header::{self, HeaderValue};
+  use std::time::Duration;
+
+  let client = Client::builder()
+    .pool_idle_timeout(Some(Duration::from_secs(120)))
+    // .pool_max_idle_per_host(10)
+    // .timeout(Duration::from_secs(5))
+    .build()
+    .unwrap();
+
+  #[derive(Serialize)]
+  struct Credentials<'a> {
+    email_or_username: &'a str,
+    password: &'a str,
+  }
+
+  let url = url::Url::parse(&format!("{}/api/auth/v1/login", site())).unwrap();
+
+  const N: usize = 100;
+  let join_handles = (0..N).map(|_| {
+    let client = client.clone();
+    let url = url.clone();
+
+    return std::thread::spawn(move || {
+      let rt = tokio::runtime::Builder::new_current_thread()
+        .enable_all()
+        .build()
+        .unwrap();
+
+      rt.block_on(async {
+        let response = client
+          .post(url.clone())
+          .header(
+            header::CONTENT_TYPE,
+            HeaderValue::from_static("application/json"),
+          )
+          .body(
+            serde_json::to_vec(&Credentials {
+              email_or_username: "admin@localhost",
+              password: "secret",
+            })
+            .unwrap(),
+          )
+          .send()
+          .await
+          .unwrap();
+
+        assert!(response.status().is_success(), "Got: {}", response.status());
+
+        let _ = response.bytes().await.unwrap();
+      });
+    });
+  });
+
+  let _results: Vec<_> = join_handles
+    .into_iter()
+    .map(|h| h.join().unwrap())
+    .collect();
+}
+
 #[tokio::test]
 #[serial]
 async fn register_test() {
```

**File**: `crates/core/src/admin/user/create_user.rs` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ pub async fn create_user_handler(
     _ => {}
   };
 
-  let hashed_password = hash_password(&request.password)?;
+  let hashed_password = hash_password(request.password).await?;
 
   const INSERT_USER_QUERY: &str = formatcp!(
     "\
```

**File**: `crates/core/src/admin/user/update_user.rs` (modified, +1/-1)
```diff
@@ -73,7 +73,7 @@ pub async fn update_user_handler(
 
   let user_id_bytes: [u8; 16] = user_id.into_bytes();
   let hashed_password = match password {
-    Some(ref pw) => Some(hash_password(pw)?),
+    Some(pw) => Some(hash_password(pw).await?),
     None => None,
   };
 
```

**File**: `crates/core/src/app_state.rs` (modified, +1/-1)
```diff
@@ -275,7 +275,7 @@ impl AppState {
         let email = "admin@localhost";
         let username = "admin";
         let password = random_alphanumeric(20);
-        let hashed_password = crate::auth::password::hash_password(&password)?;
+        let hashed_password = crate::auth::password::hash_password(password.clone()).await?;
 
         app_state
           .user_conn()
```

**File**: `crates/core/src/auth/api/change_password.rs` (modified, +2/-2)
```diff
@@ -94,7 +94,7 @@ pub async fn change_password_handler(
   // Optionally validate old password.
   // TODO: It would probably be good practice to check TOTP as well for users of multi-factor
   // auth.
-  if let Err(_err) = check_user_password(&db_user, &request.old_password) {
+  if let Err(_err) = check_user_password(&db_user, request.old_password).await {
     const MSG: &str = "invalid `old_password`";
     if !json && let Some(redirect_uri) = err_redirect_uri.or(redirect_uri) {
       return Ok(
@@ -107,7 +107,7 @@ pub async fn change_password_handler(
   // NOTE: we're using the old_password_hash to prevent races between concurrent change requests
   // for the same user.
   let old_password_hash = db_user.password_hash;
-  let new_password_hash = hash_password(&request.new_password)?;
+  let new_password_hash = hash_password(request.new_password).await?;
 
   const QUERY: &str = formatcp!(
     "\
```

**File**: `crates/core/src/auth/api/login.rs` (modified, +3/-3)
```diff
@@ -171,7 +171,7 @@ pub(crate) async fn login_handler(
   }
 
   // Check credentials.
-  let db_user = match check_credentials(&state, user_identifier, &password).await {
+  let db_user = match check_credentials(&state, user_identifier, password).await {
     Err(err) => {
       let attempts = FAILED_LOGIN_ATTEMPTS.get(&rate_limit_id).unwrap_or(0);
       FAILED_LOGIN_ATTEMPTS.insert(rate_limit_id, attempts + 1);
@@ -260,7 +260,7 @@ fn get_somewhat_stable_password_verification_timing() -> std::time::Duration {
 async fn check_credentials(
   state: &AppState,
   id: UserIdentifier,
-  password: &str,
+  password: String,
 ) -> Result<DbUser, AuthError> {
   let maybe_db_user = match id {
     UserIdentifier::Email(normalized_email) => user_by_email(state, &normalized_email).await,
@@ -282,7 +282,7 @@ async fn check_credentials(
     }
   };
 
-  check_user_password(&db_user, password)?;
+  check_user_password(&db_user, password).await?;
 
   return Ok(db_user);
 }
```

**File**: `crates/core/src/auth/api/promote_anonymous.rs` (modified, +1/-1)
```diff
@@ -109,7 +109,7 @@ pub async fn promote_anonymous_user_handler(
 
   // NOTE: we're using the old_password_hash to prevent races between concurrent change requests
   // for the same user.
-  let new_password_hash = hash_password(&request.new_password)?;
+  let new_password_hash = hash_password(request.new_password).await?;
 
   // FIXME: Right now there's no flow to recover anonymous accounts when a user typos their email
   // address. They'll be locked out forever or until a manual operator un-sets password and
```

**File**: `crates/core/src/auth/api/register.rs` (modified, +1/-1)
```diff
@@ -114,7 +114,7 @@ pub async fn register_user_handler(
     }
   };
 
-  let hashed_password = hash_password(&request.password)?;
+  let hashed_password = hash_password(request.password).await?;
 
   const INSERT_USER_QUERY: &str = formatcp!(
     "\
```

---

### Incident Patch 13: `88802217` (2026-09-29)
**Commit Message**: Fix admin UI dashboard failing to fetch logs and prepare new release v0.34.1.

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+## v0.34.1
+
+- Fix admin UI failing to fetch logs.
+
 ## v0.34.0
 
 - Performance release - many small and large improvements across the board:
```

**File**: `crates/core/src/admin/logs/list_logs.rs` (modified, +4/-3)
```diff
@@ -264,7 +264,8 @@ struct LogEntry {
 }
 
 impl LogEntry {
-  pub const COLUMNS: &str = "id, created, status, method, url, latency, client_ip, referrer, user_agent, user_id, client_geoip_cc, client_geoip_city";
+  pub const COLUMNS: &str =
+    "id, created, status, method, url, latency, client_ip, referer, user_agent, user_id";
 
   fn from_row(
     row: &trailbase_sqlite::Row,
@@ -282,11 +283,11 @@ impl LogEntry {
       user_agent: row.get(8)?,
       user_id: row.get(9)?,
       client_geoip_cc: match geoip_db_type {
-        Some(DatabaseType::GeoLite2Country) => Some(row.get(10)?),
+        Some(DatabaseType::GeoLite2Country) => row.get(10)?,
         _ => None,
       },
       client_geoip_city: match geoip_db_type {
-        Some(DatabaseType::GeoLite2City) => Some(row.get(10)?),
+        Some(DatabaseType::GeoLite2City) => row.get(10)?,
         _ => None,
       },
     });
```

**File**: `crates/core/src/extract/raw_json.rs` (modified, +1/-1)
```diff
@@ -15,6 +15,6 @@ impl IntoResponse for RawJson {
         HeaderValue::from_static("application/json"),
       )
       .body(Body::from(String::from(body)))
-      .expect("valid");
+      .unwrap_or_default();
   }
 }
```

**File**: `crates/core/src/records/list_records.rs` (modified, +3/-3)
```diff
@@ -397,10 +397,10 @@ pub async fn list_records_handler(
     records: records
       .into_iter()
       .map(|obj| {
-        serde_json::value::to_raw_value(&trailbase_schema::json::Value::Object(obj))
-          .expect("well-formed")
+        return serde_json::value::to_raw_value(&trailbase_schema::json::Value::Object(obj));
       })
-      .collect(),
+      .collect::<Result<Vec<_>, _>>()
+      .map_err(|err| RecordError::Internal(err.into()))?,
   })));
 }
 
```

**File**: `crates/core/src/records/read_record.rs` (modified, +2/-1)
```diff
@@ -134,7 +134,8 @@ pub async fn read_record_handler(
   }
 
   return Ok(RawJson(
-    serde_json::value::to_raw_value(&json_response).expect("well-formed"),
+    serde_json::value::to_raw_value(&json_response)
+      .map_err(|err| RecordError::Internal(err.into()))?,
   ));
 }
 
```

**File**: `crates/schema/src/json/record.rs` (modified, +3/-9)
```diff
@@ -44,15 +44,9 @@ pub fn record_to_json_expand(
   record: &impl Record,
   expand: Option<Vec<(compact_str::CompactString, Box<serde_json::value::RawValue>)>>,
 ) -> Result<Box<serde_json::value::RawValue>, JsonError> {
-  return Ok(
-    serde_json::value::to_raw_value(&Value::Object(record_to_json_expand_ref(
-      column_metadata,
-      expand_config,
-      record,
-      expand,
-    )?))
-    .expect("from well-formed value"),
-  );
+  return Ok(serde_json::value::to_raw_value(&Value::Object(
+    record_to_json_expand_ref(column_metadata, expand_config, record, expand)?,
+  ))?);
 }
 
 pub fn record_to_json_expand_ref<'a>(
```

**File**: `crates/schema/src/json/value.rs` (modified, +2/-2)
```diff
@@ -40,15 +40,15 @@ impl<'ctx> From<Value<'ctx>> for serde_json::Value {
         if let Some(data) = data {
           serde_json::json!({
             "id": id,
-            "data": serde_json::from_str::<JValue>(data.get()).expect("well-formed"),
+            "data": data,
           })
         } else {
           serde_json::json!({
             "id": id,
           })
         }
       }
-      Value::Raw(raw) => serde_json::from_str(raw.get()).expect("well-formed"),
+      Value::Raw(raw) => serde_json::from_str(raw.get()).expect("RawValue => Value"),
     };
   }
 }
```

---

### Incident Patch 14: `220d059c` (2026-09-29)
**Commit Message**: Fix performance regression in v0.33.3.

Introduced by ceee852539fdb8285e03c453cacc749ad7dcbad8.

**File**: `crates/core/src/admin/mod.rs` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@ mod util;
 mod wasm;
 
 pub use error::AdminError;
+pub(super) use openapi::OpenApiExtension;
 
 use crate::app_state::AppState;
 use utoipa_axum::router::OpenApiRouter;
```

**File**: `crates/core/src/admin/openapi.rs` (modified, +14/-3)
```diff
@@ -1,8 +1,15 @@
 use axum::extract::Extension;
+use parking_lot::Mutex;
+use std::sync::Arc;
 use utoipa::openapi::OpenApi;
 
 use crate::admin::AdminError as Error;
 
+#[derive(Clone, Default)]
+pub(crate) struct OpenApiExtension {
+  pub api: Arc<Mutex<Option<OpenApi>>>,
+}
+
 #[utoipa::path(
   get,
   path = "/openapi.json",
@@ -11,7 +18,7 @@ use crate::admin::AdminError as Error;
     (status = 200, description = "Success"),
   )
 )]
-pub async fn openapi_handler(openapi: Option<Extension<OpenApi>>) -> Result<String, Error> {
+pub async fn openapi_handler(openapi: Extension<OpenApiExtension>) -> Result<String, Error> {
   // NOTE: If memoizing Extension<OpenApi> turns out to be too much overhead but we still want the
   // WASM result. We could memoize WASM only. Rebuild OpenApiRouter for everything else here and
   // merge :shrug:. Feels overly complicated.
@@ -22,8 +29,12 @@ pub async fn openapi_handler(openapi: Option<Extension<OpenApi>>) -> Result<Stri
   //   .to_pretty_json()
   //   .map_err(|err| Error::Other(err.to_string()));
 
-  return openapi
-    .unwrap_or_default()
+  let lock = openapi.api.lock();
+  let Some(api) = lock.as_ref() else {
+    return Err(Error::Precondition("missing OpenApi defs".into()));
+  };
+
+  return api
     .to_pretty_json()
     .map_err(|err| Error::Other(err.to_string()));
 }
```

**File**: `crates/core/src/auth/api/change_email.rs` (modified, +2/-2)
```diff
@@ -10,10 +10,10 @@ use utoipa::{IntoParams, ToSchema};
 use crate::app_state::AppState;
 use crate::auth::jwt::EmailChangeTokenClaims;
 use crate::auth::util::{user_by_id, validate_and_normalize_email_address, validate_redirect};
-use crate::auth::{AuthError, User};
+use crate::auth::{AuthError, HasRoot, User};
 use crate::constants::USER_TABLE;
 use crate::email::Email;
-use crate::extract::{Either, HasRoot};
+use crate::extract::Either;
 use crate::util::urlencode;
 
 #[derive(Debug, Default, Deserialize, IntoParams, ToSchema, TS)]
```

**File**: `crates/core/src/auth/api/login.rs` (modified, +2/-2)
```diff
@@ -11,7 +11,6 @@ use ts_rs::TS;
 use utoipa::ToSchema;
 
 use crate::app_state::AppState;
-use crate::auth::AuthError;
 use crate::auth::api::totp::new_totp;
 use crate::auth::jwt::PendingAuthTokenClaims;
 use crate::auth::login_params::{LoginInputParams, LoginParams, build_and_validate_input_params};
@@ -21,11 +20,12 @@ use crate::auth::util::{
   SameSite, new_cookie, remove_cookie, user_by_email, user_by_id, user_by_username,
   validate_and_normalize_email_address, validate_and_normalize_username,
 };
+use crate::auth::{AuthError, HasRoot};
 use crate::constants::{
   AUTHORIZATION_CODE_TABLE, COOKIE_AUTH_TOKEN, COOKIE_REFRESH_TOKEN,
   DEFAULT_AUTHORIZATION_CODE_TTL, DEFAULT_MFA_TOKEN_TTL, VERIFICATION_CODE_LENGTH,
 };
-use crate::extract::{Either, HasRoot};
+use crate::extract::Either;
 use crate::rand::random_alphanumeric;
 use crate::util::{b64_to_uuid, urlencode};
 
```

**File**: `crates/core/src/auth/api/login_anonymous.rs` (modified, +2/-2)
```diff
@@ -9,12 +9,12 @@ use ts_rs::TS;
 use utoipa::ToSchema;
 
 use crate::app_state::AppState;
-use crate::auth::AuthError;
 use crate::auth::api::register::RegisterUserParams;
 use crate::auth::user::DbUser;
 use crate::auth::util::validate_redirect;
+use crate::auth::{AuthError, HasRoot};
 use crate::constants::{DEFAULT_ANONYMOUS_REFRESH_TOKEN_TTL, DEFAULT_AUTH_TOKEN_TTL, USER_TABLE};
-use crate::extract::{Either, HasRoot};
+use crate::extract::Either;
 
 #[derive(Debug, Default, Deserialize, ToSchema, TS)]
 #[ts(export)]
```

**File**: `crates/core/src/auth/api/logout.rs` (modified, +1/-2)
```diff
@@ -7,12 +7,11 @@ use ts_rs::TS;
 use utoipa::{IntoParams, ToSchema};
 
 use crate::AppState;
-use crate::auth::AuthError;
 use crate::auth::user::User;
 use crate::auth::util::{
   delete_all_sessions_for_user, delete_session, remove_all_cookies, validate_redirect,
 };
-use crate::extract::HasRoot;
+use crate::auth::{AuthError, HasRoot};
 
 #[derive(Debug, Default, Deserialize, IntoParams)]
 pub struct LogoutParams {
```

**File**: `crates/core/src/auth/api/otp.rs` (modified, +2/-2)
```diff
@@ -13,16 +13,16 @@ use utoipa::{IntoParams, ToSchema};
 use uuid::Uuid;
 
 use crate::app_state::AppState;
-use crate::auth::AuthError;
 use crate::auth::api::login::{LoginResponse, build_auth_token_flow_response};
 use crate::auth::user::DbUser;
 use crate::auth::util::{
   get_user_by_id, user_by_email, user_by_username, validate_and_normalize_email_address,
   validate_and_normalize_username, validate_redirect,
 };
+use crate::auth::{AuthError, HasRoot};
 use crate::constants::OTP_CODE_TABLE;
 use crate::email::Email;
-use crate::extract::{Either, HasRoot};
+use crate::extract::Either;
 use crate::rand::random_numeric_and_uppercase;
 use crate::util::urlencode;
 
```

**File**: `crates/core/src/auth/auth_test.rs` (modified, +2/-1)
```diff
@@ -13,6 +13,7 @@ use crate::AppState;
 use crate::api::AuthTokenClaims;
 use crate::app_state::{TestStateOptions, test_state};
 use crate::auth::AuthError;
+use crate::auth::HasRoot;
 use crate::auth::api::change_email::{self, ChangeEmailConfigParams};
 use crate::auth::api::change_password::{
   ChangePasswordParams, ChangePasswordRequest, change_password_handler,
@@ -46,7 +47,7 @@ use crate::auth::util::{login_with_password, login_with_password_for_test};
 use crate::config::proto;
 use crate::constants::*;
 use crate::email::{Mailer, testing::TestAsyncSmtpTransport};
-use crate::extract::{Either, HasRoot};
+use crate::extract::Either;
 
 fn build_test_config_with_trivial_tokens() -> proto::Config {
   let mut config = crate::app_state::test_config();
```

---

### Incident Patch 15: `29a024e7` (2026-09-27)
**Commit Message**: Fix `DbUser` construction on PG with a different column order.

**File**: `crates/core/src/admin/user/update_user.rs` (modified, +1/-1)
```diff
@@ -80,7 +80,7 @@ pub async fn update_user_handler(
   // NOTE: Empty string for username/email is used to unset ''.
   const UPDATE_QUERY: &str = formatcp!(
     "\
-    UPDATE {USER_TABLE} SET \
+    UPDATE '{USER_TABLE}' SET \
       email = CASE :email \
         WHEN '' THEN NULL \
         ELSE COALESCE(:email, prev.email) \
```

**File**: `crates/core/src/auth/user.rs` (modified, +47/-23)
```diff
@@ -3,6 +3,7 @@ use axum::{
   http::request::Parts,
 };
 use serde::{Deserialize, Serialize};
+use std::sync::OnceLock;
 use trailbase_sqlite::Row;
 use uuid::Uuid;
 
@@ -41,32 +42,55 @@ impl DbUser {
   }
 
   pub fn from_row(row: Row) -> Result<Self, AuthError> {
-    #[inline]
-    fn from_row_impl(mut row: Row) -> Result<DbUser, trailbase_sqlite::from_sql::FromSqlError> {
-      // Sanity check.
-      debug_assert_eq!(Some("id"), row.column_name(0));
-      debug_assert_eq!(Some("username"), row.column_name(3));
-      debug_assert_eq!(Some("totp_secret"), row.column_name(6));
-      debug_assert_eq!(Some("provider_id"), row.column_name(9));
-
-      return Ok(DbUser {
-        id: row.get(0)?,
-        email: row.consume_value(1)?.try_into()?,
-        unverified_email: row.consume_value(2)?.try_into()?,
-        username: row.consume_value(3)?.try_into()?,
-        password_hash: row.consume_value(4)?.try_into()?,
-        admin: row.get(5)?,
-        totp_secret: row.consume_value(6)?.try_into()?,
-        created: row.get(7)?,
-        updated: row.get(8)?,
-        provider_id: row.get(9)?,
-        provider_user_id: row.consume_value(10)?.try_into()?,
-        provider_avatar_url: row.consume_value(11)?.try_into()?,
+    use trailbase_sqlite::from_sql::FromSqlError;
+
+    // NOTE: The migrations used "ALTER TABLE" for PG leading to a different column ordering between
+    // SQLite and Postgres. We thus have to look up the column indexes for generic de-serialization.
+    // Alternatively, we could tract down all the uses of `SELECT * {USER_TABLE}` and specify an
+    // explicit column order.
+    type Builder = dyn Fn(Row) -> Result<DbUser, FromSqlError> + Sync + Send;
+    static ROW_TO_USER: OnceLock<Box<Builder>> = OnceLock::new();
+
+    let row_to_user = ROW_TO_USER.get_or_init(|| {
+      let columns = row.columns();
+
+      let find = |name: &str| -> usize {
+        return columns.iter().position(|c| c.name == name).expect("schema");
+      };
+
+      let idx_id = find("id");
+      let idx_email = find("email");
+      let idx_unverified_email = find("unverified_email");
+      let idx_username = find("username");
+      let idx_password_hash = find("password_hash");
+      let idx_admin = find("admin");
+      let idx_totp_secret = find("totp_secret");
+      let idx_created = find("created");
+      let idx_updated = find("updated");
+      let idx_provider_id = find("provider_id");
+      let idx_provider_user_id = find("provider_user_id");
+      let idx_provider_avatar_url = find("provider_avatar_url");
+
+      return Box::new(move |mut row: Row| {
+        return Ok(DbUser {
+          id: row.get(idx_id)?,
+          email: row.consume_value(idx_email)?.try_into()?,
+          unverified_email: row.consume_value(idx_unverified_email)?.try_into()?,
+          username: row.consume_value(idx_username)?.try_into()?,
+          password_hash: row.consume_value(idx_password_hash)?.try_into()?,
+          admin: row.get(idx_admin)?,
+          totp_secret: row.consume_value(idx_totp_secret)?.try_into()?,
+          created: row.get(idx_created)?,
+          updated: row.get(idx_updated)?,
+          provider_id: row.get(idx_provider_id)?,
+          provider_user_id: row.consume_value(idx_provider_user_id)?.try_into()?,
+          provider_avatar_url: row.consume_value(idx_provider_avatar_url)?.try_into()?,
+        });
       });
-    }
+    });
 
     // Should never fail. This means there's a schema mismatch.
-    return from_row_impl(row).map_err(|err| AuthError::Internal(err.into()));
+    return row_to_user(row).map_err(|err| AuthError::Internal(err.into()));
   }
 
   #[cfg(test)]
```

**File**: `crates/core/src/records/update_record.rs` (modified, +2/-1)
```diff
@@ -93,6 +93,7 @@ mod tests {
   use crate::auth::user::User;
   use crate::auth::util::login_with_password;
   use crate::config::proto::{self, PermissionFlag};
+  use crate::constants::USER_TABLE;
   use crate::extract::Either;
   use crate::records::create_record::{
     CreateRecordQuery, CreateRecordResponse, create_record_handler,
@@ -354,7 +355,7 @@ mod tests {
             "data"    TEXT NOT NULL
           ) {strict};
 
-          INSERT INTO test ("user", data) SELECT id, 'secret' FROM _user WHERE email = 'x@test.org';
+          INSERT INTO test ("user", data) SELECT id, 'secret' FROM {USER_TABLE} WHERE email = 'x@test.org';
         "#,
         strict = strict(conn),
         uuid = uuid_column(conn),
```

**File**: `crates/schema/src/record.rs` (modified, +4/-6)
```diff
@@ -99,6 +99,7 @@ fn value_to_flat_json_borrow<'a>(value: &'a SqliteValue) -> Result<Value<'a>, Js
   };
 }
 
+#[allow(clippy::len_without_is_empty)]
 pub trait Record {
   fn len(&self) -> usize;
   fn get_value(&self, index: usize) -> Option<(&str, &trailbase_sqlite::Value)>;
@@ -113,7 +114,7 @@ impl Record for trailbase_sqlite::Row {
   #[inline]
   fn get_value(&self, index: usize) -> Option<(&str, &trailbase_sqlite::Value)> {
     let value = self.get_value(index).ok()?;
-    let name = self.column_name(index)?;
+    let name = self.column(index)?.name.as_str();
     return Some((name, value));
   }
 }
@@ -183,16 +184,13 @@ pub fn record_to_json_expand_ref<'a>(
       if meta.is_fk && expand_config.iter().any(|c| *c == column.name) {
         let id = value_ref_to_flat_json(value)?;
         let Some(expand) = expand.as_mut() else {
-          return Ok((
-            column.name.as_str(),
-            Value::ForeignKey { id: id, data: None },
-          ));
+          return Ok((column.name.as_str(), Value::ForeignKey { id, data: None }));
         };
 
         return Ok((
           column.name.as_str(),
           Value::ForeignKey {
-            id: id,
+            id,
             data: pop_first_matching(expand, |(c, _)| *c == column.name).map(|(_, v)| v),
           },
         ));
```

**File**: `crates/sqlite/src/rows.rs` (modified, +6/-2)
```diff
@@ -153,8 +153,12 @@ impl Row {
   }
 
   #[inline]
-  pub fn column_name(&self, idx: usize) -> Option<&str> {
-    return self.columns.get(idx).map(|c| c.name.as_str());
+  pub fn column(&self, idx: usize) -> Option<&Column> {
+    return self.columns.get(idx);
+  }
+
+  pub fn columns(&self) -> &[Column] {
+    return &self.columns;
   }
 
   #[inline]
```

#### Recent Merged Pull Requests:
- **PR #296** (closed): Add audit GitHub workflow (@0rzech)
- **PR #293** (2026-09-18): Add built-in helpers for expanded types to Kotlin client (@Bnyro)
- **PR #292** (2026-09-17): Add README documentation to kotlin client (@Bnyro)
- **PR #291** (closed): docs: Clarify how to upload files with JSON requests (@Bnyro)
- **PR #290** (2026-09-14): Fix table explorer resetting page size on sort/filter (@brigon-dev)
- **PR #288** (2026-09-14): Pr/native apple signin (@ignatz)
- **PR #287** (2026-09-11): Fix creating records using default values with Kotlin client (@Bnyro)
- **PR #286** (closed): native apple signin (@yurvon-screamo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
