# Forensic Learning Record (Deep Inspection): SeaQL/sea-orm

> **Canonical Artifact**: `07_PROJECT_LEARNING/seaql-sea-orm-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/SeaQL/sea-orm](https://github.com/SeaQL/sea-orm))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:45:30.355Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `SeaQL/sea-orm`
- **Description**: 🐚 A powerful relational ORM for Rust
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9912 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/loco_seaography/src/workers/downloader.rs`
```
use std::time::Duration;

use loco_rs::prelude::*;
use serde::{Deserialize, Serialize};
use tokio::time::sleep;

use crate::models::users;

pub struct DownloadWorker {
    pub ctx: AppContext,
}

#[derive(Deserialize, Debug, Serialize)]
pub struct DownloadWorkerArgs {
    pub user_guid: String,
}

#[async_trait]
impl BackgroundWorker<DownloadWorkerArgs> for DownloadWorker {
    fn build(ctx: &AppContext) -> Self {
        Self { ctx: ctx.clone() }
    }

    async fn perform(&self, args: DownloadWorkerArgs) -> Result<()> {
        // TODO: Some actual work goes here...
        println!("================================================");
        println!("Sending payment report to user {}", args.user_guid);

        sleep(Duration::from_millis(2000)).await;

        let all = users::Entity::find()
            .all(&self.ctx.db)
            .await
            .map_err(Box::from)?;
        for user in &all {
            println!("user: {}", user.id);
        }
        println!("================================================");
        Ok(())
    }
}

```

### Core Architecture Module: `examples/loco_seaography/src/workers/mod.rs`
```
pub mod downloader;

```

### Core Architecture Module: `examples/loco_starter/src/workers/downloader.rs`
```
use std::time::Duration;

use loco_rs::prelude::*;
use serde::{Deserialize, Serialize};
use tokio::time::sleep;

use crate::models::users;

pub struct DownloadWorker {
    pub ctx: AppContext,
}

#[derive(Deserialize, Debug, Serialize)]
pub struct DownloadWorkerArgs {
    pub user_guid: String,
}

#[async_trait]
impl BackgroundWorker<DownloadWorkerArgs> for DownloadWorker {
    fn build(ctx: &AppContext) -> Self {
        Self { ctx: ctx.clone() }
    }

    async fn perform(&self, args: DownloadWorkerArgs) -> Result<()> {
        // TODO: Some actual work goes here...
        println!("================================================");
        println!("Sending payment report to user {}", args.user_guid);

        sleep(Duration::from_millis(2000)).await;

        let all = users::Entity::find()
            .all(&self.ctx.db)
            .await
            .map_err(Box::from)?;
        for user in &all {
            println!("user: {}", user.id);
        }
        println!("================================================");
        Ok(())
    }
}

```

### Core Architecture Module: `examples/loco_starter/src/workers/mod.rs`
```
pub mod downloader;

```

### Core Architecture Module: `examples/proxy_cloudflare_worker_example/src/d1bridge.rs`
```
use std::{collections::BTreeMap, sync::Arc};
use wasm_bindgen::JsValue;

use sea_orm::{
    Database, DatabaseConnection, DbBackend, DbErr, ProxyDatabaseTrait, ProxyExecResult, ProxyRow,
    RuntimeErr, Statement, Value, Values,
};
use worker::D1Database;

struct D1(Arc<D1Database>);

pub async fn connect_d1(d1: D1Database) -> Result<DatabaseConnection, DbErr> {
    Database::connect_proxy(DbBackend::Sqlite, Arc::new(Box::new(D1(d1.into())))).await
}

impl std::fmt::Debug for D1 {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "D1Stuct")
    }
}

#[async_trait::async_trait]
impl ProxyDatabaseTrait for D1 {
    async fn query(&self, statement: Statement) -> Result<Vec<ProxyRow>, DbErr> {
        let d1 = Arc::clone(&self.0);
        let values = map_values(&statement);
        let sql = statement.sql;

        worker::send::SendFuture::new(async move {
            let res = d1.prepare(sql).bind(&values)?.all().await?;

            if let Some(message) = res.error() {
                anyhow::bail!(message.to_string());
            }

            let rows = res.results::<serde_json::Value>()?;
            anyhow::Ok(rows.into_iter().map(json_to_proxy_row).collect())
        })
        .await
        .map_err(|e| DbErr::Exec(RuntimeErr::Internal(e.to_string())))
    }

    async fn execute(&self, statement: Statement) -> Result<ProxyExecResult, DbErr> {
        let d1 = Arc::clone(&self.0);
        let values = map_values(&statement);
        let sql = statement.sql;

        worker::send::SendFuture::new(async move {
            let meta = d1.prepare(sql).bind(&values)?.run().await?.meta()?;

            let last_insert_id = meta.as_ref().and_then(|m| m.last_row_id).unwrap_or(0) as u64;
            let rows_affected = meta.and_then(|m| m.rows_written).unwrap_or(0) as u64;

            anyhow::Ok(ProxyExecResult {
                last_insert_id,
                rows_affected,
            })
        })
        .await
        .map_err(|err| DbErr::Conn(RuntimeErr::Internal(err.to_string())))
    }
}

fn map_values(statement: &Statement) -> Vec<JsValue> {
    match &statement.values {
        Some(Values(values)) => values
            .iter()
            .map(|val| match val {
                Value::Bool(Some(val)) => JsValue::from(*val),
                Value::Char(Some(val)) => JsValue::from(val.to_string()),

                // Float values.
                Value::Float(Some(val)) => JsValue::from_f64(*val as f64),
                Value::Double(Some(val)) => JsValue::from_f64(*val),

                // Signed values
                Value::BigInt(Some(val)) => JsValue::from(val.to_string()),
                Value::Int(Some(val)) => JsValue::from(*val),
                Value::SmallInt(Some(val)) => JsValue::from(*val),
                Value::TinyInt(Some(val)) => JsValue::from(*val),

                // Unsigned values
                Value::BigUnsigned(Some(val)) => JsValue::from(val.to_string()),
                Value::Unsigned(Some(val)) => JsValue::from(*val),
                Value::SmallUnsigned(Some(val)) => JsValue::from(*val),
                Value::TinyUnsigned(Some(val)) => JsValue::from(*val),

                Value::String(Some(val)) => JsValue::from(val.to_string()),
                Value::Json(Some(val)) => JsValue::from(val.to_string()),
                Value::Bytes(Some(val)) => JsValue::from(format!(
                    "X'{}'",
                    val.iter()
                        .map(|byte| format!("{:02x}", byte))
                        .collect::<String>()
                )),

                Value::ChronoDate(Some(val)) => JsValue::from(val.to_string()),
                Value::ChronoDateTime(Some(val)) => JsValue::from(val.to_string()),
                Value::ChronoDateTimeLocal(Some(val)) => JsValue::from(val.to_string()),
                Value::ChronoDateTimeUtc(Some(val)) => JsValue::from(val.to_string()),
                Value::ChronoDateTimeWithTimeZone(Some(val)) => JsValue::from(val.to_string()),

                _ => JsValue::NULL,
            })
            .collect(),
        None => Vec::new(),
    }
}

fn json_to_proxy_row(row: serde_json::Value) -> ProxyRow {
    let mut values = BTreeMap::new();

    let Some(obj) = row.as_object() else {
        return ProxyRow { values };
    };

    for (k, v) in obj {
        let sea_val = match v {
            serde_json::Value::Bool(val) => Value::Bool(Some(*val)),
            serde_json::Value::Number(val) => {
                if let Some(i) = val.as_i64() {
                    Value::BigInt(Some(i))
                } else if let Some(u) = val.as_u64() {
                    Value::BigUnsigned(Some(u))
                } else {
                    Value::Double(Some(val.as_f64().unwrap_or(0.0)))
                }
            }
            serde_json::Value::String(val) => Value::String(Some(val.clone())),
            _ => unreachable!(),
        };
        values.insert(k.clone(), sea_val);
    }
    ProxyRow { values }
}

```

### Core Architecture Module: `examples/proxy_cloudflare_worker_example/src/entity.rs`
```
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Deserialize, Serialize)]
#[sea_orm(table_name = "posts")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,

    pub title: String,
    pub text: String,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

```

### Core Architecture Module: `examples/proxy_cloudflare_worker_example/src/lib.rs`
```
use tower_service::Service;
use worker::{Context, Env, HttpRequest, console_log, event};

pub(crate) mod d1bridge;
pub(crate) mod entity;
pub(crate) mod route;
pub(crate) mod utility;

// https://developers.cloudflare.com/workers/languages/rust
#[event(fetch)]
async fn fetch(
    req: HttpRequest,
    env: Env,
    _ctx: Context,
) -> Result<axum::http::Response<axum::body::Body>, worker::Error> {
    console_error_panic_hook::set_once();

    // https://developers.cloudflare.com/d1/worker-api/
    let d1 = env.d1("D1TEST")?;
    let db = crate::d1bridge::connect_d1(d1)
        .await
        .map_err(|e| worker::Error::from(e.to_string()))?;
    console_log!("Connected to database");

    Ok(route::router(db).call(req).await?)
}

```

### Core Architecture Module: `examples/proxy_cloudflare_worker_example/src/route.rs`
```
use std::sync::Arc;

use axum::{Router, extract::State, http::StatusCode, response::IntoResponse, routing::get};

use sea_orm::{
    ActiveModelTrait,
    ActiveValue::{NotSet, Set},
    DatabaseConnection, EntityTrait,
};

use crate::utility::map_error;

struct AppState {
    pub db: DatabaseConnection,
}

pub fn router(db: DatabaseConnection) -> Router {
    // generally, it is much simpler and cleaner to wrap the AppState itself,
    // rather than its individual members.
    let state = Arc::new(AppState { db });

    Router::new()
        .route("/", get(handler_get))
        .route("/generate", get(handler_generate))
        .with_state(state)
}

async fn handler_get(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    crate::utility::ensure_schema(&state.db)
        .await
        .map_err(|err| map_error(err, "Failed to create table"))?;

    let ret = crate::entity::Entity::find()
        .all(&state.db)
        .await
        .map_err(|err| map_error(err, "Failed to query database"))?;
    let ret = serde_json::to_string(&ret)
        .map_err(|err| map_error(err, "Failed to serialize response"))?;

    Ok(ret.into_response())
}

async fn handler_generate(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    crate::utility::ensure_schema(&state.db)
        .await
        .map_err(|err| map_error(err, "Failed to serialize response"))?;

    let ret = crate::entity::ActiveModel {
        id: NotSet,
        title: Set(chrono::Utc::now().to_rfc3339()),
        text: Set(uuid::Uuid::new_v4().to_string()),
    };

    let ret = ret
        .insert(&state.db)
        .await
        .map_err(|err| map_error(err, "Failed to insert into database"))?;

    Ok(format!("Inserted: {:?}", ret).into_response())
}

```

### Core Architecture Module: `examples/proxy_cloudflare_worker_example/src/utility.rs`
```
use axum::http::StatusCode;
use sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Schema};
use worker::console_error;

pub async fn ensure_schema(db: &DatabaseConnection) -> Result<(), DbErr> {
    let backend = db.get_database_backend();
    let stmt = Schema::new(backend)
        .create_table_from_entity(crate::entity::Entity)
        .if_not_exists()
        .to_owned();
    db.execute(&stmt).await?;

    Ok(())
}

// If you are learning from examples, this is not a recommended way of handling it,
// it was used here only for simplicity and to preserve remnants of previous code.
// Instead, it is recommended to use the `IntoResponse` trait.
pub fn map_error<E: std::fmt::Debug>(err: E, msg: &str) -> (StatusCode, String) {
    console_error!("{}: {:?}", msg, err);
    (StatusCode::INTERNAL_SERVER_ERROR, msg.to_string())
}

```

### Core Architecture Module: `examples/react_admin/backend/src/workers/downloader.rs`
```
use std::time::Duration;

use loco_rs::prelude::*;
use serde::{Deserialize, Serialize};
use tokio::time::sleep;

use crate::models::users;

pub struct DownloadWorker {
    pub ctx: AppContext,
}

#[derive(Deserialize, Debug, Serialize)]
pub struct DownloadWorkerArgs {
    pub user_guid: String,
}

#[async_trait]
impl BackgroundWorker<DownloadWorkerArgs> for DownloadWorker {
    fn build(ctx: &AppContext) -> Self {
        Self { ctx: ctx.clone() }
    }

    async fn perform(&self, args: DownloadWorkerArgs) -> Result<()> {
        // TODO: Some actual work goes here...
        println!("================================================");
        println!("Sending payment report to user {}", args.user_guid);

        sleep(Duration::from_millis(2000)).await;

        let all = users::Entity::find()
            .all(&self.ctx.db)
            .await
            .map_err(Box::from)?;
        for user in &all {
            println!("user: {}", user.id);
        }
        println!("================================================");
        Ok(())
    }
}

```

### Core Architecture Module: `examples/react_admin/backend/src/workers/mod.rs`
```
pub mod downloader;

```

### Core Architecture Module: `issues/630/src/entity/underscores.rs`
```
//! SeaORM Entity. Generated by sea-orm-codegen 0.6.0

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "underscores")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: u32,
    pub a_b_c_d: i32,
    pub a_b_c_dd: i32,
    pub a_b_cc_d: i32,
    pub a_bb_c_d: i32,
    pub aa_b_c_d: i32,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

#[cfg(test)]
mod tests {
    use super::*;
    use sea_orm::Iterable;

    #[test]
    fn column_names() {
        assert_eq!(
            Column::iter().map(|c| c.to_string()).collect::<Vec<_>>(),
            vec!["id", "a_b_c_d", "a_b_c_dd", "a_b_cc_d", "a_bb_c_d", "aa_b_c_d"]
        )
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3221** (2026-10-04): **Ci impr**
  *Symptoms*: 

- **Issue #3220** (2026-10-04): **Fix compilation failures with the proxy feature**
  *Symptoms*: 

- **Issue #3215** (2026-10-03): **Perf impr**
  *Symptoms*: 1. Add an associated function to `TryGetable` for decoding `Option<T>`, and fix the extra error string allocation in the previous implementation.  2. Use stream by default when collecting `sqlx` results, which reduces peak memory usage.  These two changes bring the diesel's benchmark results closer to `sqlx`.
  **Post-Mortem & Fix Analysis**:
  > @codex review

- **Issue #3212** (2026-09-26): **Update 2.0.4.md**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-09-26T23:28:20.754770Z">2026-09-26T23:28:20.754770Z</relative-time> | `2f1a824` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>

- **Issue #3211** (2026-09-25): **Add `select_except` to select all columns except the given ones**
  *Symptoms*: Lands #3123 by @WookiesRpeople2, plus a review fix.  - `Select::select_except(columns)` selects every entity column except the given ones - Clears any prior selection, so it does not compose with `select_only` / `column` - Rows still hydrate into the full `Model`: only `Option<_>` columns can be excluded; a non-nullable column fails with `Missing value for column` - Review fix: build the selection via `into_select_expr`, as `column_list` does since #3194. The original pushed un-aliased casts, so a `select_as` column lost its alias (MySQL / SQLite could not hydrate it) and chaining `select_also` / `select_both` panicked with `cannot apply alias for expr other than Column or AsEnum` - Tests: async + sync integration tests (exclusion, non-nullable failure) and a SQL-level regression test for cast aliases in single and combined selects  Squash body:  ``` Co-authored-by: WookiesRpeople2 <keentobiansky@gmail.com> ``` 
  **Post-Mortem & Fix Analysis**:
  > ### :tada: Released In [2.0.4](https://github.com/SeaQL/sea-orm/releases/tag/2.0.4) :tada:  Huge thanks for the contribution! This feature has now been released, so it's a great time to upgrade. Show some love with a ⭐ on our repo, every star counts!

- **Issue #3210** (2026-09-25): **Split tests/common so each test binary compiles only what it uses**
  *Symptoms*: - Each test declares an inline `mod common { ... }` with only the modules it needs, instead of pulling in all of `tests/common` - Test build on 15 cores: 81s -> 22-31s; an empty test with the old `common` took 5.8s to compile - `TestContext` moved into `setup`; `tests/common/mod.rs` removed - sea-orm-sync regenerated

- **Issue #3209** (2026-09-25): **improve CI runtime**
  *Symptoms*: 

- **Issue #3208** (2026-09-23): **Apply `save_as` cast to `eq_any` / `ne_all` arrays**
  *Symptoms*: ```rust #[sea_orm(column_type = r#"custom("citext")"#, save_as = "citext")] pub email: String,  Entity::find().filter(Column::Email.eq_any(["a@x.com".to_owned(), "B@x.com".to_owned()])) ```  Before (`text[]`, case-sensitive):  ```sql WHERE "user"."email" = ANY(ARRAY ['a@x.com','B@x.com']) ```  After:  ```sql WHERE "user"."email" = ANY(CAST(ARRAY ['a@x.com','B@x.com'] AS citext[])) ``` 
  **Post-Mortem & Fix Analysis**:
  > ### :tada: Released In [2.0.4](https://github.com/SeaQL/sea-orm/releases/tag/2.0.4) :tada:  Huge thanks for the contribution! This feature has now been released, so it's a great time to upgrade. Show some love with a ⭐ on our repo, every star counts!

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

### Incident Patch 1: `693cd0e1` (2026-10-04)
**Commit Message**: Fix compilation failures with the proxy feature (#3220)

* Fix compilation failures with the proxy feature

* Use standard format! delimiters in migration template

* Fix sea-orm-sync compilation with proxy

**File**: `.github/workflows/rust.yml` (modified, +3/-2)
```diff
@@ -115,7 +115,8 @@ jobs:
           key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.toml') }}
       - uses: mozilla-actions/sccache-action@v0.0.9
       - run: cargo clippy --all -- -D warnings
-      - run: cargo clippy --all --features runtime-tokio-native-tls,sqlx-all -- -D warnings
+      - run: cargo clippy --all --features runtime-tokio-native-tls,sqlx-all,proxy -- -D warnings
+      - run: cargo clippy --all --features runtime-tokio-native-tls,sqlx-all,proxy,with-bigdecimal -- -D warnings
       - run: cargo clippy --manifest-path sea-orm-cli/Cargo.toml -- -D warnings
       - run: cargo clippy --manifest-path sea-orm-migration/Cargo.toml -- -D warnings
 
@@ -356,7 +357,7 @@ jobs:
           key: ${{ runner.os }}-cargo-sqlite-tests-rusqlite-${{ hashFiles('**/Cargo.toml') }}
       - uses: mozilla-actions/sccache-action@v0.0.9
       - working-directory: ./sea-orm-sync
-        run: cargo test --test '*' --features tests-features,rusqlite
+        run: cargo test --test '*' --features tests-features,rusqlite,proxy
       - working-directory: ./sea-orm-sync/examples/quickstart
         run: cargo run
       - working-directory: ./sea-orm-sync/examples/parquet_example
```

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -17,6 +17,10 @@ and this project adheres to [Semantic Versioning](http://semver.org/).
 
     The default implementation still calls `try_get_by` for compatibility. So you have to implement `try_get_by_optional` manually to avoid the extra allocation of error strings.
 
+### Bug Fixes
+
+- Fix compilation failures with the `proxy` feature https://github.com/SeaQL/sea-orm/pull/3220
+
 ## [2.0.4](changelog/2.0.4.md) - 2026-09-27
 
 `select_except`, `save_as` casts for `eq_any` / `ne_all`, linked-join alias and `condition_type` fixes, MySQL schema-sync index drop fix, arrow 60
```

**File**: `build-tools/make-sync.sh` (modified, +1/-0)
```diff
@@ -40,6 +40,7 @@ replace_rs 's/AsyncFnOnce/FnOnce/g' src
 replace_rs 's/transaction_with_config_async/transaction_with_config/g' src tests
 replace_rs 's/transaction_async/transaction/g' src tests
 replace_rs 's/async //' src
+replace_rs 's/futures_util::stream::once({/std::iter::once({/' src
 replace_rs 's/async //' tests
 replace_rs 's/async //' examples
 replace_rs 's/\.await//' src
```

**File**: `sea-orm-arrow/src/lib.rs` (modified, +1/-1)
```diff
@@ -380,7 +380,7 @@ fn decimal256_to_value(_value: i256, _precision: u8, _scale: i8) -> Result<Value
 
         let bigint = BigInt::from_bytes_be(sign, &magnitude);
         let decimal = BigDecimal::new(bigint, _scale as i64);
-        return Ok(Value::BigDecimal(Some(Box::new(decimal))));
+        Ok(Value::BigDecimal(Some(Box::new(decimal))))
     }
 
     #[cfg(not(feature = "with-bigdecimal"))]
```

**File**: `sea-orm-cli/src/commands/migrate.rs` (modified, +2/-2)
```diff
@@ -188,7 +188,7 @@ fn create_new_migration(migration_name: &str, migration_dir: &str) -> Result<(),
 }
 
 fn fmt_migration_template(migration_name: &str) -> String {
-    format! {
+    format!(
         r#"use sea_orm_migration::{{prelude::*, schema::*}};
 
 pub struct Migration;
@@ -212,7 +212,7 @@ impl MigrationTrait for Migration {{
     }}
 }}
 "#
-    }
+    )
 }
 
 /// `get_migrator_filepath` looks for a file `migration_dir/src/lib.rs`
```

**File**: `sea-orm-sync/src/database/proxy.rs` (modified, +29/-0)
```diff
@@ -80,6 +80,14 @@ impl From<ExecResult> for ProxyExecResult {
                 last_insert_id: result.last_insert_rowid() as u64,
                 rows_affected: result.rows_affected(),
             },
+            #[cfg(feature = "rusqlite")]
+            ExecResultHolder::Rusqlite(result) => Self {
+                last_insert_id: result
+                    .last_insert_rowid
+                    .try_into()
+                    .expect("negative last_insert_rowid"),
+                rows_affected: result.rows_affected,
+            },
             #[cfg(feature = "mock")]
             ExecResultHolder::Mock(result) => Self {
                 last_insert_id: result.last_insert_id,
@@ -150,6 +158,27 @@ pub fn from_query_result_to_proxy_row(result: &QueryResult) -> ProxyRow {
         QueryResultRow::SqlxPostgres(row) => crate::from_sqlx_postgres_row_to_proxy_row(row),
         #[cfg(feature = "sqlx-sqlite")]
         QueryResultRow::SqlxSqlite(row) => crate::from_sqlx_sqlite_row_to_proxy_row(row),
+        #[cfg(feature = "rusqlite")]
+        QueryResultRow::Rusqlite(row) => ProxyRow {
+            values: row
+                .columns
+                .iter()
+                .zip(&row.values)
+                .map(|(name, value)| {
+                    use crate::driver::rusqlite::RusqliteOwnedValue;
+
+                    let value = match value {
+                        // SQLite NULL has no storage type, and OwnedRow has no column type metadata.
+                        RusqliteOwnedValue::Null => Value::String(None),
+                        RusqliteOwnedValue::Integer(value) => Value::BigInt(Some(*value)),
+                        RusqliteOwnedValue::Real(value) => Value::Double(Some(*value)),
+                        RusqliteOwnedValue::Text(value) => Value::String(Some(value.clone())),
+                        RusqliteOwnedValue::Blob(value) => Value::Bytes(Some(value.clone())),
+                    };
+                    (name.to_string(), value)
+                })
+                .collect(),
+        },
         #[cfg(feature = "mock")]
         QueryResultRow::Mock(row) => ProxyRow {
             values: row.values.clone(),
```

**File**: `sea-orm-sync/src/database/stream/query.rs` (modified, +1/-1)
```diff
@@ -97,7 +97,7 @@ impl QueryStream {
                 #[cfg(feature = "proxy")]
                 InnerConnection::Proxy(c) => {
                     let start = _metric_callback.is_some().then(std::time::SystemTime::now);
-                    let stream = futures_util::stream::once({
+                    let stream = std::iter::once({
                         Err(DbErr::BackendNotSupported {
                             db: "Proxy",
                             ctx: "QueryStream",
```

**File**: `sea-orm-sync/src/database/stream/transaction.rs` (modified, +1/-1)
```diff
@@ -90,7 +90,7 @@ impl TransactionStream<'_> {
                 #[cfg(feature = "proxy")]
                 InnerConnection::Proxy(c) => {
                     let start = _metric_callback.is_some().then(std::time::SystemTime::now);
-                    let stream = futures_util::stream::once({
+                    let stream = std::iter::once({
                         Err(DbErr::BackendNotSupported {
                             db: "Proxy",
                             ctx: "TransactionStream",
```

---

### Incident Patch 2: `48e18090` (2026-09-27)
**Commit Message**: Fix 2.0.4 changelog index after #3200 revert

**File**: `CHANGELOG.md` (modified, +2/-2)
```diff
@@ -5,9 +5,9 @@ All notable changes to this project will be documented in this file.
 The format is based on [Keep a Changelog](http://keepachangelog.com/)
 and this project adheres to [Semantic Versioning](http://semver.org/).
 
-## [2.0.4](changelog/2.0.4.md) - 2026-09-25
+## [2.0.4](changelog/2.0.4.md) - 2026-09-27
 
-`select_except`, `sea-orm-migration` trimmed to the SeaORM features it needs, `save_as` casts for `eq_any` / `ne_all`, linked-join alias and `condition_type` fixes, MySQL schema-sync index drop fix
+`select_except`, `save_as` casts for `eq_any` / `ne_all`, linked-join alias and `condition_type` fixes, MySQL schema-sync index drop fix
 
 ## [2.0.3](changelog/2.0.3.md) - 2026-09-12
 
```

---

### Incident Patch 3: `d11ef8c3` (2026-09-26)
**Commit Message**: Revert "sea-orm-migration: don't depend on stream feature (#3200)"

This reverts commit f21b51c72a11bb6c88815952b7e7492d0ed21755.

**File**: `changelog/2.0.4.md` (modified, +0/-12)
```diff
@@ -2,18 +2,6 @@
 
 *(since 2.0.3)*
 
-## Potential Breaking Change
-
-`sea-orm-migration` no longer enables SeaORM's default features https://github.com/SeaQL/sea-orm/pull/3200
-
-Previously, depending on `sea-orm-migration` also enabled all default features of `sea-orm`. This could make a project with `default-features = false` compile only because the migration crate enabled those features transitively.
-
-`sea-orm-migration` now enables only the SeaORM features it needs: `schema-sync` and `macros`. Projects relying on the previous behavior need to enable the required features explicitly.
-
-Technically, this is a compatibility break, but should have a bit impact in practice. The affected projects are those that relied on `sea-orm-migration` to implicitly enable SeaORM's default features.
-
-Since the previous behavior could unexpectedly change SeaORM's features, we consider this suitable for a patch release.
-
 ## Enhancements
 
 * Add `select_except` to select all columns except the given ones https://github.com/SeaQL/sea-orm/pull/3211
```

**File**: `sea-orm-migration/Cargo.toml` (modified, +1/-2)
```diff
@@ -25,8 +25,7 @@ clap = { version = "4.3", features = ["env", "derive"], optional = true }
 dotenvy = { version = "0.15", default-features = false, optional = true }
 sea-orm = { version = "~2.0.3", path = "../", features = [
     "schema-sync",
-    "macros",
-], default-features = false }
+] }
 sea-orm-cli = { version = "~2.0.3", path = "../sea-orm-cli", default-features = false, optional = true }
 sea-schema = { version = "0.18.1", default-features = false, features = [
     "discovery",
```

---

### Incident Patch 4: `5c451004` (2026-09-25)
**Commit Message**: Fix schema sync failing to drop a stale index on MySQL (#3202)

The non-PostgreSQL branch of the unique-index drop built
`Index::drop().name(...)` with no target table. SeaQuery's MySQL builder
always writes the ` ON ` clause, so the statement came out as
`DROP INDEX `ref_no` ON ` and MySQL rejected it with error 1064. SQLite
ignores the table in `DROP INDEX`, so only MySQL was affected, and the
existing regression test for this path is gated on `sqlx-postgres`.

Pass the entity's table through `index_table_ref`, the same helper the
index-creation paths use, so MySQL gets a bare table name and SQLite is
unchanged.

**File**: `sea-orm-sync/src/schema/builder.rs` (modified, +11/-1)
```diff
@@ -594,7 +594,17 @@ impl EntitySchemaInfo {
                                     .drop_constraint(drop_existing),
                             )?;
                         } else {
-                            db.execute(sea_query::Index::drop().name(drop_existing))?;
+                            // MySQL requires `DROP INDEX <name> ON <table>`; without the
+                            // target table the statement is a syntax error.
+                            let table_ref = index_table_ref(
+                                self.table.get_table_name().expect("Checked above").clone(),
+                                db_backend,
+                            );
+                            db.execute(
+                                sea_query::Index::drop()
+                                    .name(drop_existing)
+                                    .table(table_ref),
+                            )?;
                         }
                     }
                 }
```

**File**: `sea-orm-sync/tests/schema_sync_tests.rs` (modified, +55/-0)
```diff
@@ -478,3 +478,58 @@ fn pg_index_exists(db: &DatabaseConnection, table: &str, index: &str) -> Result<
     .try_get_by_index(0)
     .map_err(DbErr::from)
 }
+
+/// MySQL counterpart of [`test_sync_drop_unique_constraint`].
+///
+/// A column marked `#[sea_orm(unique)]` is synced, then the unique attribute is
+/// removed. The second sync must drop the index without error: MySQL only accepts
+/// `DROP INDEX <name> ON <table>`.
+#[sea_orm_macros::test]
+#[cfg(feature = "sqlx-mysql")]
+fn test_sync_drop_unique_index() -> Result<(), DbErr> {
+    let ctx = TestContext::new("test_sync_drop_unique_index");
+    let db = &ctx.db;
+
+    #[cfg(feature = "schema-sync")]
+    {
+        // First sync: creates the table with the unique index
+        db.get_schema_builder()
+            .register(order_v1::Entity)
+            .sync(db)?;
+
+        assert!(
+            mysql_index_exists(db, "sync_order", "ref_no")?,
+            "unique index should exist after first sync"
+        );
+
+        // Second sync: unique is removed — must not error on MySQL
+        db.get_schema_builder()
+            .register(order_v2::Entity)
+            .sync(db)?;
+
+        assert!(
+            !mysql_index_exists(db, "sync_order", "ref_no")?,
+            "unique index should be gone after second sync"
+        );
+    }
+
+    Ok(())
+}
+
+#[cfg(feature = "sqlx-mysql")]
+fn mysql_index_exists(db: &DatabaseConnection, table: &str, index: &str) -> Result<bool, DbErr> {
+    db.query_one(
+        Query::select()
+            .expr(Expr::cust("COUNT(*) > 0"))
+            .from(("information_schema", "statistics"))
+            .cond_where(
+                Condition::all()
+                    .add(Expr::cust("TABLE_SCHEMA = DATABASE()"))
+                    .add(Expr::col("TABLE_NAME").eq(table))
+                    .add(Expr::col("INDEX_NAME").eq(index)),
+            ),
+    )?
+    .unwrap()
+    .try_get_by_index(0)
+    .map_err(DbErr::from)
+}
```

**File**: `src/schema/builder.rs` (modified, +12/-2)
```diff
@@ -602,8 +602,18 @@ impl EntitySchemaInfo {
                             )
                             .await?;
                         } else {
-                            db.execute(sea_query::Index::drop().name(drop_existing))
-                                .await?;
+                            // MySQL requires `DROP INDEX <name> ON <table>`; without the
+                            // target table the statement is a syntax error.
+                            let table_ref = index_table_ref(
+                                self.table.get_table_name().expect("Checked above").clone(),
+                                db_backend,
+                            );
+                            db.execute(
+                                sea_query::Index::drop()
+                                    .name(drop_existing)
+                                    .table(table_ref),
+                            )
+                            .await?;
                         }
                     }
                 }
```

**File**: `tests/schema_sync_tests.rs` (modified, +62/-0)
```diff
@@ -509,3 +509,65 @@ async fn pg_index_exists(db: &DatabaseConnection, table: &str, index: &str) -> R
     .try_get_by_index(0)
     .map_err(DbErr::from)
 }
+
+/// MySQL counterpart of [`test_sync_drop_unique_constraint`].
+///
+/// A column marked `#[sea_orm(unique)]` is synced, then the unique attribute is
+/// removed. The second sync must drop the index without error: MySQL only accepts
+/// `DROP INDEX <name> ON <table>`.
+#[sea_orm_macros::test]
+#[cfg(feature = "sqlx-mysql")]
+async fn test_sync_drop_unique_index() -> Result<(), DbErr> {
+    let ctx = TestContext::new("test_sync_drop_unique_index").await;
+    let db = &ctx.db;
+
+    #[cfg(feature = "schema-sync")]
+    {
+        // First sync: creates the table with the unique index
+        db.get_schema_builder()
+            .register(order_v1::Entity)
+            .sync(db)
+            .await?;
+
+        assert!(
+            mysql_index_exists(db, "sync_order", "ref_no").await?,
+            "unique index should exist after first sync"
+        );
+
+        // Second sync: unique is removed — must not error on MySQL
+        db.get_schema_builder()
+            .register(order_v2::Entity)
+            .sync(db)
+            .await?;
+
+        assert!(
+            !mysql_index_exists(db, "sync_order", "ref_no").await?,
+            "unique index should be gone after second sync"
+        );
+    }
+
+    Ok(())
+}
+
+#[cfg(feature = "sqlx-mysql")]
+async fn mysql_index_exists(
+    db: &DatabaseConnection,
+    table: &str,
+    index: &str,
+) -> Result<bool, DbErr> {
+    db.query_one(
+        Query::select()
+            .expr(Expr::cust("COUNT(*) > 0"))
+            .from(("information_schema", "statistics"))
+            .cond_where(
+                Condition::all()
+                    .add(Expr::cust("TABLE_SCHEMA = DATABASE()"))
+                    .add(Expr::col("TABLE_NAME").eq(table))
+                    .add(Expr::col("INDEX_NAME").eq(index)),
+            ),
+    )
+    .await?
+    .unwrap()
+    .try_get_by_index(0)
+    .map_err(DbErr::from)
+}
```

---

### Incident Patch 5: `bdbdc4f5` (2026-09-25)
**Commit Message**: Build the 3 slowest examples as one workspace

**File**: `.github/workflows/rust.yml` (modified, +6/-1)
```diff
@@ -255,7 +255,12 @@ jobs:
             echo "::group::$path"
             find $path -type f -name 'Cargo.toml' -print0 | xargs -t -0 -I {} cargo fmt --manifest-path {} -- --check
             find $path -type f -name 'Cargo.toml' -print0 | xargs -t -0 -I {} cargo update --manifest-path {}
-            find $path -type f -name 'Cargo.toml' -print0 | xargs -t -0 -I {} cargo test --manifest-path {}
+            case $path in
+              # Slowest examples: one workspace build, instead of rebuilding shared deps per member
+              react_admin) cargo test --workspace --manifest-path react_admin/backend/Cargo.toml ;;
+              loco_seaography|rocket_example) cargo test --workspace --manifest-path $path/Cargo.toml ;;
+              *) find $path -type f -name 'Cargo.toml' -print0 | xargs -t -0 -I {} cargo test --manifest-path {} ;;
+            esac
             if [ "$path" = quickstart ]; then (cd quickstart && cargo run); fi
             echo "::endgroup::"
           done
```

---

### Incident Patch 6: `b276dbdd` (2026-09-14)
**Commit Message**: Fix left_join_linked joining multi-hop links onto the wrong alias (#3199)

Since `left_join_linked` can be called several times, table aliases come from
`linked_index`, but each non-first hop still joined onto `r{i-1}`, the alias
from the first linked call. Chaining a multi-hop link after another link
produced a join onto the previous link's tables.

---------

Co-authored-by: Huliiiiii <[REDACTED_EMAIL]>

**File**: `sea-orm-sync/src/query/join.rs` (modified, +22/-1)
```diff
@@ -110,7 +110,7 @@ where
             self.linked_index += 1;
             let to_tbl = format!("r{r}").into_iden();
             let from_tbl = if i > 0 {
-                format!("r{}", i - 1).into_iden()
+                format!("r{}", r - 1).into_iden()
             } else {
                 rel.from_tbl.sea_orm_table().clone()
             };
@@ -817,4 +817,25 @@ mod tests {
             .join(" ")
         );
     }
+
+    #[test]
+    fn chained_left_join_linked_uses_previous_hop_alias() {
+        assert_eq!(
+            cake::Entity::find()
+                .left_join_linked(entity_linked::CakeToFilling)
+                .left_join_linked(entity_linked::CakeToFilling)
+                .select_only()
+                .column(cake::Column::Id)
+                .build(DbBackend::MySql)
+                .to_string(),
+            [
+                r"SELECT `cake`.`id` FROM `cake`",
+                r"LEFT JOIN `cake_filling` AS `r0` ON `cake`.`id` = `r0`.`cake_id`",
+                r"LEFT JOIN `filling` AS `r1` ON `r0`.`filling_id` = `r1`.`id`",
+                r"LEFT JOIN `cake_filling` AS `r2` ON `cake`.`id` = `r2`.`cake_id`",
+                r"LEFT JOIN `filling` AS `r3` ON `r2`.`filling_id` = `r3`.`id`",
+            ]
+            .join(" ")
+        );
+    }
 }
```

**File**: `src/query/join.rs` (modified, +22/-1)
```diff
@@ -110,7 +110,7 @@ where
             self.linked_index += 1;
             let to_tbl = format!("r{r}").into_iden();
             let from_tbl = if i > 0 {
-                format!("r{}", i - 1).into_iden()
+                format!("r{}", r - 1).into_iden()
             } else {
                 rel.from_tbl.sea_orm_table().clone()
             };
@@ -817,4 +817,25 @@ mod tests {
             .join(" ")
         );
     }
+
+    #[test]
+    fn chained_left_join_linked_uses_previous_hop_alias() {
+        assert_eq!(
+            cake::Entity::find()
+                .left_join_linked(entity_linked::CakeToFilling)
+                .left_join_linked(entity_linked::CakeToFilling)
+                .select_only()
+                .column(cake::Column::Id)
+                .build(DbBackend::MySql)
+                .to_string(),
+            [
+                r"SELECT `cake`.`id` FROM `cake`",
+                r"LEFT JOIN `cake_filling` AS `r0` ON `cake`.`id` = `r0`.`cake_id`",
+                r"LEFT JOIN `filling` AS `r1` ON `r0`.`filling_id` = `r1`.`id`",
+                r"LEFT JOIN `cake_filling` AS `r2` ON `cake`.`id` = `r2`.`cake_id`",
+                r"LEFT JOIN `filling` AS `r3` ON `r2`.`filling_id` = `r3`.`id`",
+            ]
+            .join(" ")
+        );
+    }
 }
```

---

### Incident Patch 7: `457067e1` (2026-09-13)
**Commit Message**: Fix bump.sh taplo no-op, and document it in RELEASE.md

`taplo fmt .` from inside examples/ formatted nothing: `.taplo.toml` sets
`include = ["**/*.toml"]`, which taplo anchors at the config's directory, so a
directory argument collects zero files ("total=1 excluded=1"). The bump's sed
collapses the comment alignment on every release, and nothing put it back --
2.0.3 shipped with a red Taplo job as a result.

Run taplo from the repo root over the tracked example manifests instead. Also
add the formatting jobs to RELEASE.md's local validation step, note why the
push-before-publish ordering matters, and correct the binary target count to 4.

**File**: `build-tools/RELEASE.md` (modified, +18/-1)
```diff
@@ -92,6 +92,18 @@ cargo check --manifest-path sea-orm-sync/Cargo.toml
 
 Known warnings are acceptable only if they already exist and are unrelated to the release.
 
+Also run the formatting jobs, which `cargo check` does not cover and which a bump
+can break on its own:
+
+```sh
+taplo fmt --check
+cargo +nightly fmt --all -- --check
+```
+
+Note `taplo fmt` silently formats nothing when given a directory: `.taplo.toml` sets
+`include = ["**/*.toml"]`, anchored at the config's directory, so `taplo fmt examples`
+collects no files. Run it with no argument, or with explicit file paths.
+
 ## 6. Push and Wait for CI
 
 Push `master`:
@@ -102,6 +114,11 @@ git push origin master
 
 Wait for GitHub Actions to pass before publishing. Do not publish while CI is still running or red.
 
+This ordering is the point of the step. Publishing first cannot be undone: a crates.io
+release is permanent, so a failure CI would have caught lands on a commit that is
+already tagged and published. The 2.0.3 release was published before the push and the
+Taplo job then failed on the tagged commit.
+
 ## 7. Publish Crates
 
 After CI passes, run:
@@ -147,7 +164,7 @@ git tag -a "sea-orm-cli@2.0.0-rc.N" -m "sea-orm-cli 2.0.0-rc.N"
 git push origin "sea-orm-cli@2.0.0-rc.N"
 ```
 
-The workflow then builds the 5 targets, attaches the archives to a draft release,
+The workflow then builds the 4 targets, attaches the archives to a draft release,
 and publishes it. Confirm the assets appear on the `sea-orm-cli@2.0.0-rc.N`
 release and that `cargo binstall sea-orm-cli` resolves.
 
```

**File**: `build-tools/bump.sh` (modified, +12/-3)
```diff
@@ -63,7 +63,16 @@ cd examples
 # Tolerate taplo align_entries padding around `=` and before the comment.
 find . -depth -type f -name '*.toml' -exec "${SI[@]}" 's/^version *= ".*" *# sea-orm version$/version = "'~$1'" # sea-orm version/' {} \;
 find . -depth -type f -name '*.toml' -exec "${SI[@]}" 's/^version *= ".*" *# sea-orm-migration version$/version = "'~$1'" # sea-orm-migration version/' {} \;
-# Re-align comments the sed above may have shifted (align_entries) so CI Taplo passes.
-taplo fmt .
-git add .
+cd ..
+
+# Re-align the comments the sed above collapsed (align_entries), so CI Taplo passes.
+#
+# This must run from the repo root and be given explicit FILE paths. `.taplo.toml`
+# sets `include = ["**/*.toml"]`, which taplo anchors at the config's directory, so
+# passing a directory (`taplo fmt .` from examples/, or `taplo fmt examples` from
+# here) collects nothing -- "total=1 excluded=1" -- and silently formats no files.
+# That no-op is why 2.0.3 shipped with a red Taplo job.
+git ls-files -z '*.toml' -- examples | xargs -0 taplo fmt
+
+git add examples
 git commit -m "update examples"
```

---

### Incident Patch 8: `6bd711e1` (2026-08-08)
**Commit Message**: Fix codegen and macro edge cases (#3158)

Co-authored-by: Ziggy K <[REDACTED_EMAIL]>

**File**: `sea-orm-macros/src/derives/active_enum.rs` (modified, +1/-1)
```diff
@@ -556,7 +556,7 @@ impl ActiveEnum {
                 impl std::convert::TryFrom<&str> for #ident {
                     type Error = sea_orm::DbErr;
 
-                    fn try_from(source: &str) -> std::result::Result<Self, Self::Error> {
+                    fn try_from(source: &str) -> std::result::Result<Self, sea_orm::DbErr> {
                         match source {
                             #( #variant_values => Ok(Self::#variant_idents), )*
                             _ => Err(sea_orm::DbErr::Type(format!(
```

**File**: `sea-orm-macros/src/derives/from_query_result.rs` (modified, +8/-8)
```diff
@@ -47,7 +47,7 @@ impl ToTokens for TryFromQueryResultCheck<'_> {
                     .to_owned()
                     .unwrap_or_else(|| ident.unraw().to_string());
                 tokens.extend(quote! {
-                    let #ident = match row.try_get_nullable(pre, #name) {
+                    let #ident = match __sea_orm_row.try_get_nullable(__sea_orm_pre, #name) {
                         Err(v @ sea_orm::TryGetError::DbErr(_)) => {
                             return Err(v);
                         }
@@ -62,16 +62,16 @@ impl ToTokens for TryFromQueryResultCheck<'_> {
             }
             ItemType::Nested { prefix } => {
                 let prefix = match (self.0, prefix) {
-                    (_, Some(p)) => quote! { &format!("{pre}{}", #p) },
+                    (_, Some(p)) => quote! { &format!("{}{}", __sea_orm_pre, #p) },
                     (true, None) => {
                         let name = ident.unraw().to_string();
-                        quote! { &format!("{pre}{}_", #name) }
+                        quote! { &format!("{}{}_", __sea_orm_pre, #name) }
                     }
-                    (false, None) => quote! { pre },
+                    (false, None) => quote! { __sea_orm_pre },
                 };
 
                 tokens.extend(quote! {
-                    let #ident = match sea_orm::FromQueryResult::from_query_result_nullable(row, #prefix) {
+                    let #ident = match sea_orm::FromQueryResult::from_query_result_nullable(__sea_orm_row, #prefix) {
                         Err(v @ sea_orm::TryGetError::DbErr(_)) => {
                             return Err(v);
                         }
@@ -223,11 +223,11 @@ impl DeriveFromQueryResult {
         quote!(
             #[automatically_derived]
             impl #impl_generics sea_orm::FromQueryResult for #ident #ty_generics #where_clause {
-                fn from_query_result(row: &sea_orm::QueryResult, pre: &str) -> std::result::Result<Self, sea_orm::DbErr> {
-                    Ok(Self::from_query_result_nullable(row, pre)?)
+                fn from_query_result(__sea_orm_row: &sea_orm::QueryResult, __sea_orm_pre: &str) -> std::result::Result<Self, sea_orm::DbErr> {
+                    Ok(Self::from_query_result_nullable(__sea_orm_row, __sea_orm_pre)?)
                 }
 
-                fn from_query_result_nullable(row: &sea_orm::QueryResult, pre: &str) -> std::result::Result<Self, sea_orm::TryGetError> {
+                fn from_query_result_nullable(__sea_orm_row: &sea_orm::QueryResult, __sea_orm_pre: &str) -> std::result::Result<Self, sea_orm::TryGetError> {
                     #(#ident_try_init)*
 
                     Ok(Self {
```

**File**: `sea-orm-macros/src/derives/model.rs` (modified, +5/-5)
```diff
@@ -125,8 +125,8 @@ impl DeriveModel {
             } else {
                 let reader = quote! {
                     let #field_ident =
-                        row.try_get_nullable::<Option<#field_type>>(
-                            pre,
+                        __sea_orm_row.try_get_nullable::<Option<#field_type>>(
+                            __sea_orm_pre,
                             sea_orm::IdenStatic::as_str(
                                 &<<Self as sea_orm::ModelTrait>::Entity
                                     as sea_orm::entity::EntityTrait>::Column::#column_ident
@@ -169,11 +169,11 @@ impl DeriveModel {
         quote!(
             #[automatically_derived]
             impl sea_orm::FromQueryResult for #ident {
-                fn from_query_result(row: &sea_orm::QueryResult, pre: &str) -> std::result::Result<Self, sea_orm::DbErr> {
-                    Self::from_query_result_nullable(row, pre).map_err(Into::into)
+                fn from_query_result(__sea_orm_row: &sea_orm::QueryResult, __sea_orm_pre: &str) -> std::result::Result<Self, sea_orm::DbErr> {
+                    Self::from_query_result_nullable(__sea_orm_row, __sea_orm_pre).map_err(Into::into)
                 }
 
-                fn from_query_result_nullable(row: &sea_orm::QueryResult, pre: &str) -> std::result::Result<Self, sea_orm::TryGetError> {
+                fn from_query_result_nullable(__sea_orm_row: &sea_orm::QueryResult, __sea_orm_pre: &str) -> std::result::Result<Self, sea_orm::TryGetError> {
                     #(#field_readers)*
 
                     if #all_null_check {
```

**File**: `sea-orm-macros/tests/derive_active_enum_test.rs` (modified, +15/-0)
```diff
@@ -74,6 +74,13 @@ pub enum TestEnum3 {
     HelloWorld,
 }
 
+#[derive(Debug, EnumIter, DeriveActiveEnum, Eq, PartialEq)]
+#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "error_variant")]
+enum ErrorVariantEnum {
+    #[sea_orm(string_value = "error")]
+    Error,
+}
+
 #[test]
 fn derive_active_enum_value() {
     assert_eq!(TestEnum::DefaultVariant.to_value(), "defaultVariant");
@@ -96,6 +103,14 @@ fn derive_active_enum_value() {
     assert_eq!(TestEnum::CustomStringValue.to_value(), "CuStOmStRiNgVaLuE");
 }
 
+#[test]
+fn derive_active_enum_with_error_variant() {
+    assert_eq!(
+        <ErrorVariantEnum as TryFrom<&str>>::try_from("error"),
+        Ok(ErrorVariantEnum::Error)
+    );
+}
+
 #[test]
 fn derive_active_enum_from_value() {
     assert_eq!(
```

**File**: `sea-orm-macros/tests/derive_entity_model_column_name_test.rs` (modified, +26/-0)
```diff
@@ -56,3 +56,29 @@ fn test_column_names() {
         Column::from_str("lAsTnAmE").expect("column from str should recognize column_name attr");
     assert!(matches!(col, Column::LastName));
 }
+
+#[allow(dead_code)]
+mod query_parameter_name_collisions {
+    use sea_orm::entity::prelude::*;
+    use sea_orm_macros::{DeriveEntityModel, FromQueryResult};
+
+    #[derive(FromQueryResult)]
+    struct QueryResultProjection {
+        row: String,
+        pre: String,
+    }
+
+    #[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
+    #[sea_orm(table_name = "query_parameter_name_collision")]
+    pub struct Model {
+        #[sea_orm(primary_key)]
+        id: i32,
+        row: String,
+        pre: String,
+    }
+
+    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
+    pub enum Relation {}
+
+    impl ActiveModelBehavior for ActiveModel {}
+}
```

---

### Incident Patch 9: `f03535a5` (2026-08-09)
**Commit Message**: Fix documentation typo

**File**: `COMMUNITY.md` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ If you have built an app using SeaORM and want to showcase it, feel free to open
 
 - [Caido](https://caido.io/) | A lightweight web security auditing toolkit
 - [FirstLook.gg](https://firstlook.gg/) | A platform to onboard, understand, and reward players | DB: Postgres
-- [Lapdev](https://lap.dev/) [![GitHub stars](https://img.shields.io/github/stars/lapce/lapdev.svg?style=social)](https://github.com/lapce/lapdev) | Self-hosted remote development enviroment | DB: Postgres
+- [Lapdev](https://lap.dev/) [![GitHub stars](https://img.shields.io/github/stars/lapce/lapdev.svg?style=social)](https://github.com/lapce/lapdev) | Self-hosted remote development environment | DB: Postgres
 - [OpenObserve](https://openobserve.ai/) [![GitHub stars](https://img.shields.io/github/stars/openobserve/openobserve.svg?style=social)](https://github.com/openobserve/openobserve) | Open-source observability platform | DB: MySQL, Postgres, SQLite
 - [My Data My Consent](https://mydatamyconsent.com/) | Online data sharing for people and businesses simplified
 - [Noorle](https://noorle.com/) | Managed AI agent runtime with MCP gateways, WASM plugins and connectors | DB: Postgres, SQLite
```

---

### Incident Patch 10: `d0b8b2a6` (2026-08-08)
**Commit Message**: Add require_one: fetch exactly one row, error if none (#2974) (#3164)

Adds a non-optional counterpart to one(): where one() returns
Option<Item>, require_one() returns Item directly and yields
DbErr::RecordNotFound when no row matches, so call sites can use ? instead
of unwrapping/matching an Option. This mirrors the fetch_one vs
fetch_optional distinction common in other query APIs.

Implemented on the base Selector and SelectorRaw executors, with ergonomic
wrappers on Select, SelectTwo, and SelectTwoRequired. Mirrored to
sea-orm-sync via make-sync.sh.

**File**: `sea-orm-sync/src/executor/select.rs` (modified, +91/-0)
```diff
@@ -28,6 +28,12 @@ type PinBoxStream<'b, S> = std::pin::Pin<Box<dyn Stream<Item = Result<S, DbErr>>
 #[cfg(feature = "sync")]
 type PinBoxStream<'b, S> = Box<dyn Iterator<Item = Result<S, DbErr>> + 'b>;
 
+/// The error returned by the `require_one` family when a query that must match a
+/// row matches none.
+fn record_not_found() -> DbErr {
+    DbErr::RecordNotFound("None of the models match the query".to_owned())
+}
+
 /// A ready-to-execute `SELECT` query backed by a [`SelectStatement`]. The
 /// type parameter `S` (a [`SelectorTrait`]) determines what each row is
 /// decoded into. Build one via
@@ -535,6 +541,49 @@ where
         self.into_model().one(db)
     }
 
+    /// Get exactly one Model from the SELECT query, returning
+    /// [`DbErr::RecordNotFound`] when nothing matches. The non-optional
+    /// counterpart to [`one`](Self::one): use it when a missing row is an error,
+    /// so the call site can use `?` instead of unwrapping an `Option`.
+    ///
+    /// ```
+    /// # use sea_orm::{error::*, tests_cfg::*, *};
+    /// #
+    /// # #[cfg(feature = "mock")]
+    /// # pub fn main() -> Result<(), DbErr> {
+    /// #
+    /// # let db = MockDatabase::new(DbBackend::Postgres)
+    /// #     .append_query_results([
+    /// #         vec![cake::Model {
+    /// #             id: 1,
+    /// #             name: "New York Cheese".to_owned(),
+    /// #         }],
+    /// #         vec![],
+    /// #     ])
+    /// #     .into_connection();
+    /// #
+    /// use sea_orm::{entity::*, tests_cfg::cake};
+    ///
+    /// // A matching row is returned directly — no `Option` to unwrap.
+    /// let cake = cake::Entity::find_by_id(1).require_one(&db)?;
+    /// assert_eq!(cake.name, "New York Cheese");
+    ///
+    /// // No matching row is a `RecordNotFound` error.
+    /// assert!(matches!(
+    ///     cake::Entity::find_by_id(2).require_one(&db),
+    ///     Err(DbErr::RecordNotFound(_))
+    /// ));
+    /// #
+    /// # Ok(())
+    /// # }
+    /// ```
+    pub fn require_one<C>(self, db: &C) -> Result<E::Model, DbErr>
+    where
+        C: ConnectionTrait,
+    {
+        self.into_model().require_one(db)
+    }
+
     /// Get all Models from the SELECT query
     pub fn all<C>(self, db: &C) -> Result<Vec<E::Model>, DbErr>
     where
@@ -615,6 +664,16 @@ where
         self.into_model().one(db)
     }
 
+    /// Get exactly one row from the Select query, returning
+    /// [`DbErr::RecordNotFound`] when nothing matches. The non-optional
+    /// counterpart to [`one`](Self::one).
+    pub fn require_one<C>(self, db: &C) -> Result<(E::Model, Option<F::Model>), DbErr>
+    where
+        C: ConnectionTrait,
+    {
+        self.into_model().require_one(db)
+    }
+
     /// Get all Models from the Select query
     pub fn all<C>(self, db: &C) -> Result<Vec<(E::Model, Option<F::Model>)>, DbErr>
     where
@@ -741,6 +800,16 @@ where
         self.into_model().one(db)
     }
 
+    /// Get exactly one row from the Select query, returning
+    /// [`DbErr::RecordNotFound`] when nothing matches. The non-optional
+    /// counterpart to [`one`](Self::one).
+    pub fn require_one<C>(self, db: &C) -> Result<(E::Model, F::Model), DbErr>
+    where
+        C: ConnectionTrait,
+    {
+        self.into_model().require_one(db)
+    }
+
     /// Get all Models from the Select query
     pub fn all<C>(self, db: &C) -> Result<Vec<(E::Model, F::Model)>, DbErr>
     where
@@ -798,6 +867,19 @@ where
         }
     }
 
+    /// Get exactly one item from the Select query, returning
+    /// [`DbErr::RecordNotFound`] when no row matches.
+    ///
+    /// This is the non-optional counterpart to [`one`](Self::one): reach for it
+    /// when a missing row is an error rather than an expected `None`, so the
+    /// call site can use `?` instead of unwrapping an `Option`.
+    pub fn require_one<C>(self, db: &C) -> Result<S::Item, DbErr>
+    where
+        C: ConnectionTrait,
+    {
+        self.one(db)?.ok_or(record_not_found())
+    }
+
     /// Get all items from the Select query
     pub fn all<C>(self, db: &C) -> Result<Vec<S::Item>, DbErr>
     where
@@ -1038,6 +1120,15 @@ where
         }
     }
 
+    /// Get exactly one item from the query, returning [`DbErr::RecordNotFound`]
+    /// when no row matches. The non-optional counterpart to [`one`](Self::one).
+    pub fn require_one<C>(self, db: &C) -> Result<S::Item, DbErr>
+    where
+        C: ConnectionTrait,
+    {
+        self.one(db)?.ok_or(record_not_found())
+    }
+
     /// Get all items from the Select query
     /// ```
     /// # use sea_orm::{error::*, tests_cfg::*, *};
```

**File**: `src/executor/select.rs` (modified, +92/-0)
```diff
@@ -30,6 +30,12 @@ type PinBoxStream<'b, S> = std::pin::Pin<Box<dyn Stream<Item = Result<S, DbErr>>
 #[cfg(feature = "sync")]
 type PinBoxStream<'b, S> = Box<dyn Iterator<Item = Result<S, DbErr>> + 'b + Send>;
 
+/// The error returned by the `require_one` family when a query that must match a
+/// row matches none.
+fn record_not_found() -> DbErr {
+    DbErr::RecordNotFound("None of the models match the query".to_owned())
+}
+
 /// A ready-to-execute `SELECT` query backed by a [`SelectStatement`]. The
 /// type parameter `S` (a [`SelectorTrait`]) determines what each row is
 /// decoded into. Build one via
@@ -545,6 +551,50 @@ where
         self.into_model().one(db).await
     }
 
+    /// Get exactly one Model from the SELECT query, returning
+    /// [`DbErr::RecordNotFound`] when nothing matches. The non-optional
+    /// counterpart to [`one`](Self::one): use it when a missing row is an error,
+    /// so the call site can use `?` instead of unwrapping an `Option`.
+    ///
+    /// ```
+    /// # use sea_orm::{error::*, tests_cfg::*, *};
+    /// #
+    /// # #[smol_potat::main]
+    /// # #[cfg(feature = "mock")]
+    /// # pub async fn main() -> Result<(), DbErr> {
+    /// #
+    /// # let db = MockDatabase::new(DbBackend::Postgres)
+    /// #     .append_query_results([
+    /// #         vec![cake::Model {
+    /// #             id: 1,
+    /// #             name: "New York Cheese".to_owned(),
+    /// #         }],
+    /// #         vec![],
+    /// #     ])
+    /// #     .into_connection();
+    /// #
+    /// use sea_orm::{entity::*, tests_cfg::cake};
+    ///
+    /// // A matching row is returned directly — no `Option` to unwrap.
+    /// let cake = cake::Entity::find_by_id(1).require_one(&db).await?;
+    /// assert_eq!(cake.name, "New York Cheese");
+    ///
+    /// // No matching row is a `RecordNotFound` error.
+    /// assert!(matches!(
+    ///     cake::Entity::find_by_id(2).require_one(&db).await,
+    ///     Err(DbErr::RecordNotFound(_))
+    /// ));
+    /// #
+    /// # Ok(())
+    /// # }
+    /// ```
+    pub async fn require_one<C>(self, db: &C) -> Result<E::Model, DbErr>
+    where
+        C: ConnectionTrait,
+    {
+        self.into_model().require_one(db).await
+    }
+
     /// Get all Models from the SELECT query
     pub async fn all<C>(self, db: &C) -> Result<Vec<E::Model>, DbErr>
     where
@@ -625,6 +675,16 @@ where
         self.into_model().one(db).await
     }
 
+    /// Get exactly one row from the Select query, returning
+    /// [`DbErr::RecordNotFound`] when nothing matches. The non-optional
+    /// counterpart to [`one`](Self::one).
+    pub async fn require_one<C>(self, db: &C) -> Result<(E::Model, Option<F::Model>), DbErr>
+    where
+        C: ConnectionTrait,
+    {
+        self.into_model().require_one(db).await
+    }
+
     /// Get all Models from the Select query
     pub async fn all<C>(self, db: &C) -> Result<Vec<(E::Model, Option<F::Model>)>, DbErr>
     where
@@ -751,6 +811,16 @@ where
         self.into_model().one(db).await
     }
 
+    /// Get exactly one row from the Select query, returning
+    /// [`DbErr::RecordNotFound`] when nothing matches. The non-optional
+    /// counterpart to [`one`](Self::one).
+    pub async fn require_one<C>(self, db: &C) -> Result<(E::Model, F::Model), DbErr>
+    where
+        C: ConnectionTrait,
+    {
+        self.into_model().require_one(db).await
+    }
+
     /// Get all Models from the Select query
     pub async fn all<C>(self, db: &C) -> Result<Vec<(E::Model, F::Model)>, DbErr>
     where
@@ -808,6 +878,19 @@ where
         }
     }
 
+    /// Get exactly one item from the Select query, returning
+    /// [`DbErr::RecordNotFound`] when no row matches.
+    ///
+    /// This is the non-optional counterpart to [`one`](Self::one): reach for it
+    /// when a missing row is an error rather than an expected `None`, so the
+    /// call site can use `?` instead of unwrapping an `Option`.
+    pub async fn require_one<C>(self, db: &C) -> Result<S::Item, DbErr>
+    where
+        C: ConnectionTrait,
+    {
+        self.one(db).await?.ok_or(record_not_found())
+    }
+
     /// Get all items from the Select query
     pub async fn all<C>(self, db: &C) -> Result<Vec<S::Item>, DbErr>
     where
@@ -1055,6 +1138,15 @@ where
         }
     }
 
+    /// Get exactly one item from the query, returning [`DbErr::RecordNotFound`]
+    /// when no row matches. The non-optional counterpart to [`one`](Self::one).
+    pub async fn require_one<C>(self, db: &C) -> Result<S::Item, DbErr>
+    where
+        C: ConnectionTrait,
+    {
+        self.one(db).await?.ok_or(record_not_found())
+    }
+
     /// Get all items from the Select query
     /// ```
     /// # use sea_orm::{error::*, tests_cfg::*, *};
```

---

### Incident Patch 11: `6fcfad86` (2026-08-02)
**Commit Message**: Regenerate sea-orm-sync (ActiveValue helpers, before_acquire)

**File**: `sea-orm-sync/src/database/mod.rs` (modified, +179/-0)
```diff
@@ -113,6 +113,9 @@ pub struct ConnectOptions {
     /// Statement timeout (PostgreSQL only)
     pub(crate) statement_timeout: Option<Duration>,
     pub(crate) test_before_acquire: bool,
+    /// If set, a pooled connection is pinged before being handed out only when it has been
+    /// idle for at least this long (see [`ConnectOptions::test_before_acquire_if_idle_for`]).
+    pub(crate) test_before_acquire_if_idle_for: Option<Duration>,
     /// Only establish connections to the DB as needed. If set to `true`, the db connection will
     /// be created using SQLx's [connect_lazy](https://docs.rs/sqlx/latest/sqlx/struct.Pool.html#method.connect_lazy)
     /// method.
@@ -139,6 +142,16 @@ pub struct ConnectOptions {
     #[cfg(feature = "sqlx-sqlite")]
     #[debug(skip)]
     pub(crate) sqlite_opts_fn: Option<Arc<dyn Fn(SqliteConnectOptions) -> SqliteConnectOptions>>,
+
+    #[cfg(feature = "sqlx-mysql")]
+    #[debug(skip)]
+    pub(crate) mysql_before_acquire_fn: Option<crate::driver::BeforeAcquireFn<sqlx::MySql>>,
+    #[cfg(feature = "sqlx-postgres")]
+    #[debug(skip)]
+    pub(crate) pg_before_acquire_fn: Option<crate::driver::BeforeAcquireFn<sqlx::Postgres>>,
+    #[cfg(feature = "sqlx-sqlite")]
+    #[debug(skip)]
+    pub(crate) sqlite_before_acquire_fn: Option<crate::driver::BeforeAcquireFn<sqlx::Sqlite>>,
 }
 
 impl Database {
@@ -248,6 +261,7 @@ impl ConnectOptions {
             application_name: None,
             statement_timeout: None,
             test_before_acquire: true,
+            test_before_acquire_if_idle_for: None,
             connect_lazy: false,
             after_connect: None,
             #[cfg(feature = "sqlx-mysql")]
@@ -262,6 +276,12 @@ impl ConnectOptions {
             pg_opts_fn: None,
             #[cfg(feature = "sqlx-sqlite")]
             sqlite_opts_fn: None,
+            #[cfg(feature = "sqlx-mysql")]
+            mysql_before_acquire_fn: None,
+            #[cfg(feature = "sqlx-postgres")]
+            pg_before_acquire_fn: None,
+            #[cfg(feature = "sqlx-sqlite")]
+            sqlite_before_acquire_fn: None,
         }
     }
 
@@ -441,11 +461,78 @@ impl ConnectOptions {
     }
 
     /// If true, the connection will be pinged upon acquiring from the pool (default true).
+    ///
+    /// See [`test_before_acquire_if_idle_for`](Self::test_before_acquire_if_idle_for) for the
+    /// cheaper "only ping stale connections" variant.
     pub fn test_before_acquire(&mut self, value: bool) -> &mut Self {
         self.test_before_acquire = value;
         self
     }
 
+    /// Get whether a pooled connection is pinged on every acquire (default true).
+    pub fn get_test_before_acquire(&self) -> bool {
+        self.test_before_acquire
+    }
+
+    /// Ping a pooled connection before handing it out, but only once it has been idle for at
+    /// least `idle`.
+    ///
+    /// [`test_before_acquire`](Self::test_before_acquire) pings on *every* acquire, which adds
+    /// a round-trip to each checkout. This shorthand instead pings only connections that have
+    /// been idle long enough to plausibly have been dropped by the server, a proxy, or a
+    /// firewall — the common failure mode — while letting hot connections through untouched.
+    ///
+    /// Calling this sets [`test_before_acquire`](Self::test_before_acquire) to `false` (SQLx
+    /// runs the per-acquire ping *and* this hook, so leaving it enabled would ping on every
+    /// acquire regardless and defeat the threshold).
+    ///
+    /// It composes with a per-backend [`map_sqlx_postgres_before_acquire`] callback (and its
+    /// MySQL / SQLite counterparts): the idle-ping runs first, then your callback.
+    ///
+    /// # Expands to
+    /// With no per-backend callback set, this is exactly the following configuration on the
+    /// underlying [`sqlx::pool::PoolOptions`]:
+    ///
+    /// ```ignore
+    /// pool_options
+    ///     .test_before_acquire(false)
+    ///     .before_acquire(move |conn, meta| {
+    ///         ({
+    ///             if meta.idle_for >= idle {
+    ///                 conn.ping()?;
+    ///             }
+    ///             Ok(true)
+    ///         })
+    ///     })
+    /// ```
+    ///
+    /// Applies only to pools built through [`Database::connect`]. Pools adopted via
+    /// `SqlxPostgresConnector::from_sqlx_postgres_pool` (and the MySQL / SQLite equivalents)
+    /// bypass [`ConnectOptions`] entirely — configure `before_acquire` on your own
+    /// [`sqlx::pool::PoolOptions`] in that case.
+    ///
+    /// # Example
+    /// ```
+    /// # use sea_orm::ConnectOptions;
+    /// # use std::time::Duration;
+    /// let mut opt = ConnectOptions::new("postgres://localhost/db");
+    /// opt.test_before_acquire_if_idle_for(Duration::from_secs(30));
+    /// assert_eq!(opt.get_test_before_acquire(), false);
+    /// ```
+    ///
+    /// [`map_sqlx_postgres_before_acquire`]: Self::map_sqlx_postgres_before_acquire
+    pub fn test_before_acqu
```

**File**: `sea-orm-sync/src/driver/sqlx_common.rs` (modified, +115/-0)
```diff
@@ -1,4 +1,19 @@
 use crate::{ConnAcquireErr, ConnectOptions, DbErr, RuntimeErr};
+use std::{sync::Arc, time::Duration};
+
+/// Callback stored for a `before_acquire` hook on [`ConnectOptions`].
+///
+/// This mirrors the signature accepted by SQLx's
+/// [`PoolOptions::before_acquire`][sqlx::pool::PoolOptions::before_acquire] for the given
+/// database backend `DB`. Note the fully-qualified [`futures_util::future::BoxFuture`]: the
+/// crate-local `BoxFuture` alias collapses to `T` under the `sync` feature, which would not
+/// match SQLx's signature.
+pub(crate) type BeforeAcquireFn<DB> = Arc<
+    dyn for<'c> Fn(
+        &'c mut <DB as sqlx::Database>::Connection,
+        sqlx::pool::PoolConnectionMetadata,
+    ) -> futures_util::future::BoxFuture<'c, Result<bool, sqlx::Error>>,
+>;
 
 /// Converts an [sqlx::error] execution error to a [DbErr]
 pub fn sqlx_error_to_exec_err(err: sqlx::Error) -> DbErr {
@@ -63,4 +78,104 @@ impl ConnectOptions {
         opt = opt.test_before_acquire(self.test_before_acquire);
         opt
     }
+
+    /// Install the composed `before_acquire` hook onto a [`sqlx::pool::PoolOptions`].
+    ///
+    /// SQLx exposes a single `before_acquire` slot whose setter *replaces* rather than
+    /// composes, and offers no getter to read it back. To let the idle-ping shorthand
+    /// ([`ConnectOptions::test_before_acquire_if_idle_for`]) coexist with a user-provided
+    /// per-backend callback ([`ConnectOptions::map_sqlx_postgres_before_acquire`] and
+    /// friends), this composes both into one closure: the idle-ping runs first, then the
+    /// user callback. When a ping threshold is set, `test_before_acquire` is forced off so
+    /// the connection is pinged only past the threshold rather than on every acquire.
+    ///
+    /// Returns `opt` untouched when neither option is configured, so callers that opt into
+    /// nothing get byte-for-byte the previous behavior.
+    pub(crate) fn apply_before_acquire<DB>(
+        mut opt: sqlx::pool::PoolOptions<DB>,
+        ping_after_idle: Option<Duration>,
+        user_cb: Option<BeforeAcquireFn<DB>>,
+    ) -> sqlx::pool::PoolOptions<DB>
+    where
+        DB: sqlx::Database,
+    {
+        use sqlx::Connection;
+
+        if ping_after_idle.is_none() && user_cb.is_none() {
+            return opt;
+        }
+        if ping_after_idle.is_some() {
+            opt = opt.test_before_acquire(false);
+        }
+        opt.before_acquire(move |conn, meta| {
+            let user_cb = user_cb.clone();
+            ({
+                if let Some(threshold) = ping_after_idle {
+                    // `idle_for` is `Copy`; read it before `meta` is moved into the user callback.
+                    // `>=` matches the "idle for at least `threshold`" contract documented on
+                    // `ConnectOptions::test_before_acquire_if_idle_for`.
+                    if meta.idle_for >= threshold {
+                        conn.ping()?;
+                    }
+                }
+                match user_cb {
+                    Some(user_cb) => user_cb(conn, meta),
+                    None => Ok(true),
+                }
+            })
+        })
+    }
+}
+
+#[cfg(all(test, feature = "sqlx-postgres"))]
+mod tests {
+    use crate::ConnectOptions;
+    use sqlx::Connection;
+    use std::time::Duration;
+
+    #[test]
+    fn idle_shorthand_disables_test_before_acquire() {
+        let mut opt = ConnectOptions::new("postgres://localhost/db");
+        assert!(opt.get_test_before_acquire());
+        assert_eq!(opt.get_test_before_acquire_if_idle_for(), None);
+
+        opt.test_before_acquire_if_idle_for(Duration::from_secs(30));
+        assert!(!opt.get_test_before_acquire());
+        assert_eq!(
+            opt.get_test_before_acquire_if_idle_for(),
+            Some(Duration::from_secs(30))
+        );
+    }
+
+    #[test]
+    fn compose_shorthand_and_user_callback() {
+        let mut opt = ConnectOptions::new("postgres://localhost/db");
+        opt.test_before_acquire_if_idle_for(Duration::from_secs(30))
+            .map_sqlx_postgres_before_acquire(|conn, _meta| {
+                ({
+                    conn.ping()?;
+                    Ok(true)
+                })
+            });
+
+        // Composing both into SQLx's single `before_acquire` slot type-checks and returns a
+        // usable `PoolOptions`. Behavioral ping timing requires a live pool, covered elsewhere.
+        let pool_opts = ConnectOptions::apply_before_acquire::<sqlx::Postgres>(
+            sqlx::pool::PoolOptions::new(),
+            opt.get_test_before_acquire_if_idle_for(),
+            opt.pg_before_acquire_fn.clone(),
+        );
+        let _ = pool_opts;
+    }
+
+    #[test]
+    fn apply_before_acquire_noop_when_unset() {
+        // With neither option set, the helper must return the options untouched.
+        let opts = ConnectOptions::apply_before_acquire::<sqlx::Postgres>(
+            sqlx::pool::PoolOptions::new(),
```

**File**: `sea-orm-sync/src/driver/sqlx_mysql.rs` (modified, +7/-0)
```diff
@@ -89,7 +89,14 @@ impl SqlxMySqlConnector {
         let after_connect = options.after_connect.clone();
         let connect_lazy = options.connect_lazy;
         let mysql_pool_opts_fn = options.mysql_pool_opts_fn.clone();
+        let mysql_before_acquire = options.mysql_before_acquire_fn.clone();
+        let ping_after_idle = options.test_before_acquire_if_idle_for;
         let mut pool_options = options.sqlx_pool_options();
+        pool_options = crate::ConnectOptions::apply_before_acquire::<sqlx::MySql>(
+            pool_options,
+            ping_after_idle,
+            mysql_before_acquire,
+        );
         if let Some(f) = &mysql_pool_opts_fn {
             pool_options = f(pool_options);
         }
```

**File**: `sea-orm-sync/src/driver/sqlx_postgres.rs` (modified, +7/-0)
```diff
@@ -117,7 +117,14 @@ impl SqlxPostgresConnector {
         let lazy = options.connect_lazy;
         let after_connect = options.after_connect.clone();
         let pg_pool_opts_fn = options.pg_pool_opts_fn.clone();
+        let pg_before_acquire = options.pg_before_acquire_fn.clone();
+        let ping_after_idle = options.test_before_acquire_if_idle_for;
         let mut pool_options = options.sqlx_pool_options();
+        pool_options = crate::ConnectOptions::apply_before_acquire::<sqlx::Postgres>(
+            pool_options,
+            ping_after_idle,
+            pg_before_acquire,
+        );
 
         if let Some(sql) = set_search_path_sql {
             pool_options = pool_options.after_connect(move |conn, _| {
```

**File**: `sea-orm-sync/src/driver/sqlx_sqlite.rs` (modified, +7/-0)
```diff
@@ -99,7 +99,14 @@ impl SqlxSqliteConnector {
         let after_conn = options.after_connect.clone();
         let connect_lazy = options.connect_lazy;
         let sqlite_pool_opts_fn = options.sqlite_pool_opts_fn.clone();
+        let sqlite_before_acquire = options.sqlite_before_acquire_fn.clone();
+        let ping_after_idle = options.test_before_acquire_if_idle_for;
         let mut pool_options = options.sqlx_pool_options();
+        pool_options = crate::ConnectOptions::apply_before_acquire::<sqlx::Sqlite>(
+            pool_options,
+            ping_after_idle,
+            sqlite_before_acquire,
+        );
 
         if let Some(f) = &sqlite_pool_opts_fn {
             pool_options = f(pool_options);
```

**File**: `sea-orm-sync/src/entity/active_value.rs` (modified, +182/-0)
```diff
@@ -240,6 +240,12 @@ where
         matches!(self, Self::Set(_))
     }
 
+    /// Check if the [ActiveValue] is [ActiveValue::Set] and that the inner value
+    /// matches a given predicate.
+    pub fn is_set_and(&self, f: impl FnOnce(&V) -> bool) -> bool {
+        matches!(self, Self::Set(v) if f(v))
+    }
+
     /// Create an [ActiveValue::Unchanged]
     pub fn unchanged(value: V) -> Self {
         Self::Unchanged(value)
@@ -250,6 +256,12 @@ where
         matches!(self, Self::Unchanged(_))
     }
 
+    /// Check if the [ActiveValue] is [ActiveValue::Unchanged] and that the inner
+    /// value matches a given predicate.
+    pub fn is_unchanged_and(&self, f: impl FnOnce(&V) -> bool) -> bool {
+        matches!(self, Self::Unchanged(v) if f(v))
+    }
+
     /// Create an [ActiveValue::NotSet]
     pub fn not_set() -> Self {
         Self::default()
@@ -394,6 +406,120 @@ where
         self.set_ne_and(value, f);
     }
 
+    /// `Set(value)` if [`self.is_not_set()`][ActiveValue#method.is_not_set], no-op otherwise.
+    /// Similar to "null coalescing" or [Option#method.get_or_insert], but without
+    /// returning the inner value if it is set/unchanged.
+    ///
+    /// ## Examples
+    ///
+    /// ```
+    /// # use sea_orm::ActiveValue;
+    /// #
+    /// let mut set_value = ActiveValue::Set(true);
+    /// let mut unchanged_value = ActiveValue::Unchanged(true);
+    /// let mut notset_value = ActiveValue::NotSet;
+    ///
+    /// // since `set_value.is_not_set == false`, we leave the existing set value alone
+    /// set_value.set_if_unset(false);
+    /// assert_eq!(set_value, ActiveValue::Set(true));
+    ///
+    /// // since `set_value.is_not_set == false`, we leave the existing set value alone
+    /// unchanged_value.set_if_unset(false);
+    /// assert_eq!(unchanged_value, ActiveValue::Unchanged(true));
+    ///
+    /// // since `set_value.is_not_set == true`, we fill with the provided value
+    /// notset_value.set_if_unset(false);
+    /// assert_eq!(notset_value, ActiveValue::Set(false));
+    /// ```
+    pub fn set_if_unset(&mut self, value: V) {
+        if let ActiveValue::NotSet = self {
+            *self = ActiveValue::Set(value);
+        }
+    }
+
+    /// `Set(f())` if [`self.is_not_set()`][ActiveValue#method.is_not_set], no-op otherwise.
+    /// Similar to "null coalescing" or [Option#method.get_or_insert_with], but without
+    /// returning the inner value if it is set/unchanged.
+    ///
+    /// This can be useful if the value you want to replace it with is expensive to compute,
+    /// or has side-effects which need to be ran (like logging).
+    ///
+    /// ## Examples
+    ///
+    /// ```
+    /// # use sea_orm::ActiveValue;
+    /// #
+    /// let mut set_value = ActiveValue::Set(true);
+    /// let mut unchanged_value = ActiveValue::Unchanged(true);
+    /// let mut notset_value = ActiveValue::NotSet;
+    ///
+    /// let mut count = 0;
+    /// // since `set_value.is_not_set == false`, we leave the existing set value alone
+    /// set_value.set_if_unset_with(|| {
+    ///     count += 1;
+    ///     false
+    /// });
+    /// assert_eq!(set_value, ActiveValue::Set(true));
+    ///
+    /// // since `set_value.is_not_set == false`, we leave the existing set value alone
+    /// unchanged_value.set_if_unset_with(|| {
+    ///     count += 1;
+    ///     false
+    /// });
+    /// assert_eq!(unchanged_value, ActiveValue::Unchanged(true));
+    ///
+    /// // since `set_value.is_not_set == true`, we fill with the result of the provided computation.
+    /// notset_value.set_if_unset_with(|| {
+    ///     count += 1;
+    ///     false
+    /// });
+    /// assert_eq!(notset_value, ActiveValue::Set(false));
+    ///
+    /// // Only the last closure actually executed.
+    /// assert_eq!(count, 1);
+    /// ```
+    pub fn set_if_unset_with(&mut self, f: impl FnOnce() -> V) {
+        if let ActiveValue::NotSet = self {
+            *self = ActiveValue::Set(f());
+        }
+    }
+
+    /// `Set(V::default())` if [`self.is_not_set()`][ActiveValue#method.is_not_set], no-op otherwise.
+    /// Similar to "null coalescing" or [Option#method.get_or_insert_default], but without
+    /// returning the inner value if it is set/unchanged.
+    ///
+    /// Convenient shorthand for `set_if_unset(Default::default())`.
+    ///
+    /// ## Examples
+    ///
+    /// ```
+    /// # use sea_orm::ActiveValue;
+    /// #
+    /// let mut set_value = ActiveValue::Set(100);
+    /// let mut unchanged_value = ActiveValue::Unchanged(100);
+    /// let mut notset_value = ActiveValue::NotSet;
+    ///
+    /// // since `set_value.is_not_set == false`, we leave the existing set value alone
+    /// set_value.set_if_unset_default();
+    /// assert_eq!(set_value, ActiveValue::Set(100));
+    ///
+    /// // since `set_value.is_not_set == false`, we leave the existing set value alone
+    /// unchanged_value.set_if_unset_default();
+    /// assert_eq!(unchanged_value, Ac
```

---

### Incident Patch 12: `d2e0e58e` (2026-07-31)
**Commit Message**: Require `TransactionTrait::Transaction` to be a fixed point (#3153)

The methods generated by `#[sea_orm::model]` (`insert`/`update`/`save`/
`delete`/`action`/`cascade_delete`) open a transaction and then save related
models inside it, so `action::<C>` recurses into `action::<C::Transaction>`.
Proving those futures `Send` without a concrete `C` walked the unbounded
`C::Transaction::Transaction::...` chain and overflowed (E0275 /
`clippy::future_not_send`), so the documented 2.0 entity format failed to
compile under clippy.

Fix it on the trait rather than on the generated methods: `TransactionTrait`
now requires `Sync` and pins its associated `Transaction` to a fixed point
(`Transaction::Transaction == Transaction`) that is `Send`. That collapses the
chain to a single type, so the obligation terminates.

`Sync` and `Send` exclude no implementor: the `#[async_trait]` desugaring
already forces both, since `begin` holds `&self` across an await and
`TransactionSession::commit` takes `self` by value. Only a non-fixed-point
`Transaction` is newly rejected, and it errors at the offending `impl` rather
than at `#[sea_orm::model]`. All in-crate implementors are fixed points already.

Puttin

**File**: `sea-orm-sync/src/database/connection.rs` (modified, +7/-1)
```diff
@@ -168,9 +168,15 @@ pub struct TransactionOptions {
 /// transactions via SAVEPOINTs). Use [`begin`](Self::begin) for a manually
 /// managed transaction, or [`transaction`](Self::transaction) for a closure
 /// that auto-commits on `Ok` and rolls back on `Err`.
+///
+/// [`Self::Transaction`] must be a fixed point — its own transaction type is
+/// itself — because the `ActiveModelEx` mutation methods recurse through it
+/// (see <https://github.com/SeaQL/sea-orm/issues/3147>).
 pub trait TransactionTrait {
     /// The concrete type for the transaction
-    type Transaction: ConnectionTrait + TransactionTrait + TransactionSession;
+    type Transaction: ConnectionTrait
+        + TransactionTrait<Transaction = Self::Transaction>
+        + TransactionSession;
 
     /// Execute SQL `BEGIN` transaction.
     /// Returns a Transaction that can be committed or rolled back
```

**File**: `sea-orm-sync/tests/derive_active_model_ex_send_future_test.rs` (added, +374/-0)
```diff
@@ -0,0 +1,374 @@
+//! Regression tests for <https://github.com/SeaQL/sea-orm/issues/3147>: the
+//! mutation methods generated by `#[sea_orm::model]` must produce `Send`
+//! futures, including when the caller is generic over the connection type.
+//!
+//! The generated `action` opens a transaction and then saves related models
+//! inside it, so `action::<C>` recurses into `action::<C::Transaction>`. Proving
+//! such a future `Send` without knowing `C` used to walk an unbounded
+//! `C::Transaction::Transaction::...` chain and never terminate (E0275).
+//!
+//! `TransactionTrait` now requires `Sync` and pins `Transaction` to a fixed
+//! point, which collapses that chain to a single type. The `assert_send` calls
+//! below are the actual regression tests: each one fails to compile without
+//! those bounds. `clippy::future_not_send` is denied as a second net, since that
+//! is the lint the original reporter hit.
+//!
+//! This is an async-only concern: the sync crate (`sea-orm-sync`) has no futures
+//! to prove `Send`, so the gate below compiles the whole file out there. `Send`
+//! is only ever demanded in a `sqlx` (async) build, hence `feature = "sqlx-dep"`.
+
+#![cfg(feature = "sqlx-dep")]
+#![deny(clippy::future_not_send)]
+#![allow(dead_code)]
+
+mod parent {
+    use sea_orm::entity::prelude::*;
+
+    #[sea_orm::model]
+    #[derive(Debug, Clone, PartialEq, Eq, DeriveEntityModel)]
+    #[sea_orm(table_name = "sf_parent")]
+    pub struct Model {
+        #[sea_orm(primary_key)]
+        pub id: i32,
+        pub name: String,
+        #[sea_orm(has_many)]
+        pub children: HasMany<super::child::Entity>,
+        #[sea_orm(has_one)]
+        pub detail: HasOne<super::detail::Entity>,
+    }
+
+    impl ActiveModelBehavior for ActiveModel {}
+}
+
+mod child {
+    use sea_orm::entity::prelude::*;
+
+    #[sea_orm::model]
+    #[derive(Debug, Clone, PartialEq, Eq, DeriveEntityModel)]
+    #[sea_orm(table_name = "sf_child")]
+    pub struct Model {
+        #[sea_orm(primary_key)]
+        pub id: i32,
+        pub parent_id: Option<i32>,
+        #[sea_orm(belongs_to, from = "parent_id", to = "id")]
+        pub parent: BelongsTo<Option<super::parent::Entity>>,
+    }
+
+    impl ActiveModelBehavior for ActiveModel {}
+}
+
+mod detail {
+    use sea_orm::entity::prelude::*;
+
+    #[sea_orm::model]
+    #[derive(Debug, Clone, PartialEq, Eq, DeriveEntityModel)]
+    #[sea_orm(table_name = "sf_detail")]
+    pub struct Model {
+        #[sea_orm(primary_key)]
+        pub id: i32,
+        pub parent_id: i32,
+        #[sea_orm(belongs_to, from = "parent_id", to = "id")]
+        pub parent: BelongsTo<super::parent::Entity>,
+    }
+
+    impl ActiveModelBehavior for ActiveModel {}
+}
+
+// Many-to-many through a junction table exercises the `many_to_many_action`
+// recursion path, which the macro generates separately from has_many.
+mod post {
+    use sea_orm::entity::prelude::*;
+
+    #[sea_orm::model]
+    #[derive(Debug, Clone, PartialEq, Eq, DeriveEntityModel)]
+    #[sea_orm(table_name = "sf_post")]
+    pub struct Model {
+        #[sea_orm(primary_key)]
+        pub id: i32,
+        pub title: String,
+        #[sea_orm(has_many, via = "post_tag")]
+        pub tags: HasMany<super::tag::Entity>,
+    }
+
+    impl ActiveModelBehavior for ActiveModel {}
+}
+
+mod tag {
+    use sea_orm::entity::prelude::*;
+
+    #[sea_orm::model]
+    #[derive(Debug, Clone, PartialEq, Eq, DeriveEntityModel)]
+    #[sea_orm(table_name = "sf_tag")]
+    pub struct Model {
+        #[sea_orm(primary_key)]
+        pub id: i32,
+        pub name: String,
+        #[sea_orm(has_many, via = "post_tag")]
+        pub posts: HasMany<super::post::Entity>,
+    }
+
+    impl ActiveModelBehavior for ActiveModel {}
+}
+
+mod post_tag {
+    use sea_orm::entity::prelude::*;
+
+    #[sea_orm::model]
+    #[derive(Debug, Clone, PartialEq, Eq, DeriveEntityModel)]
+    #[sea_orm(table_name = "sf_post_tag")]
+    pub struct Model {
+        #[sea_orm(primary_key, auto_increment = false)]
+        pub post_id: i32,
+        #[sea_orm(primary_key, auto_increment = false)]
+        pub tag_id: i32,
+        #[sea_orm(belongs_to, from = "post_id", to = "id")]
+        pub post: BelongsTo<super::post::Entity>,
+        #[sea_orm(belongs_to, from = "tag_id", to = "id")]
+        pub tag: BelongsTo<super::tag::Entity>,
+    }
+
+    impl ActiveModelBehavior for ActiveModel {}
+}
+
+// A self-referential relation is the tightest case: the recursion returns to the
+// same entity, so nothing but the fixed-point bound can terminate it.
+mod node {
+    use sea_orm::entity::prelude::*;
+
+    #[sea_orm::model]
+    #[derive(Debug, Clone, PartialEq, Eq, DeriveEntityModel)]
+    #[sea_orm(table_name = "sf_node")]
+    pub struct Model {
+        #[sea_orm(primary_key)]
+        pub id: i32,
+        #[sea_orm(enum_name = "ParentId")]
+        pub parent_ref: Option<i32>,
+        #[sea_orm(self_ref, relation_enum = "Parent", from 
```

**File**: `src/database/connection.rs` (modified, +9/-2)
```diff
@@ -180,10 +180,17 @@ pub struct TransactionOptions {
 /// transactions via SAVEPOINTs). Use [`begin`](Self::begin) for a manually
 /// managed transaction, or [`transaction`](Self::transaction) for a closure
 /// that auto-commits on `Ok` and rolls back on `Err`.
+///
+/// [`Self::Transaction`] must be a fixed point — its own transaction type is
+/// itself — because the `ActiveModelEx` mutation methods recurse through it
+/// (see <https://github.com/SeaQL/sea-orm/issues/3147>).
 #[async_trait::async_trait]
-pub trait TransactionTrait {
+pub trait TransactionTrait: Sync {
     /// The concrete type for the transaction
-    type Transaction: ConnectionTrait + TransactionTrait + TransactionSession;
+    type Transaction: ConnectionTrait
+        + TransactionTrait<Transaction = Self::Transaction>
+        + TransactionSession
+        + Send;
 
     /// Execute SQL `BEGIN` transaction.
     /// Returns a Transaction that can be committed or rolled back
```

**File**: `tests/derive_active_model_ex_send_future_test.rs` (added, +387/-0)
```diff
@@ -0,0 +1,387 @@
+//! Regression tests for <https://github.com/SeaQL/sea-orm/issues/3147>: the
+//! mutation methods generated by `#[sea_orm::model]` must produce `Send`
+//! futures, including when the caller is generic over the connection type.
+//!
+//! The generated `action` opens a transaction and then saves related models
+//! inside it, so `action::<C>` recurses into `action::<C::Transaction>`. Proving
+//! such a future `Send` without knowing `C` used to walk an unbounded
+//! `C::Transaction::Transaction::...` chain and never terminate (E0275).
+//!
+//! `TransactionTrait` now requires `Sync` and pins `Transaction` to a fixed
+//! point, which collapses that chain to a single type. The `assert_send` calls
+//! below are the actual regression tests: each one fails to compile without
+//! those bounds. `clippy::future_not_send` is denied as a second net, since that
+//! is the lint the original reporter hit.
+//!
+//! This is an async-only concern: the sync crate (`sea-orm-sync`) has no futures
+//! to prove `Send`, so the gate below compiles the whole file out there. `Send`
+//! is only ever demanded in a `sqlx` (async) build, hence `feature = "sqlx-dep"`.
+
+#![cfg(feature = "sqlx-dep")]
+#![deny(clippy::future_not_send)]
+#![allow(dead_code)]
+
+mod parent {
+    use sea_orm::entity::prelude::*;
+
+    #[sea_orm::model]
+    #[derive(Debug, Clone, PartialEq, Eq, DeriveEntityModel)]
+    #[sea_orm(table_name = "sf_parent")]
+    pub struct Model {
+        #[sea_orm(primary_key)]
+        pub id: i32,
+        pub name: String,
+        #[sea_orm(has_many)]
+        pub children: HasMany<super::child::Entity>,
+        #[sea_orm(has_one)]
+        pub detail: HasOne<super::detail::Entity>,
+    }
+
+    impl ActiveModelBehavior for ActiveModel {}
+}
+
+mod child {
+    use sea_orm::entity::prelude::*;
+
+    #[sea_orm::model]
+    #[derive(Debug, Clone, PartialEq, Eq, DeriveEntityModel)]
+    #[sea_orm(table_name = "sf_child")]
+    pub struct Model {
+        #[sea_orm(primary_key)]
+        pub id: i32,
+        pub parent_id: Option<i32>,
+        #[sea_orm(belongs_to, from = "parent_id", to = "id")]
+        pub parent: BelongsTo<Option<super::parent::Entity>>,
+    }
+
+    impl ActiveModelBehavior for ActiveModel {}
+}
+
+mod detail {
+    use sea_orm::entity::prelude::*;
+
+    #[sea_orm::model]
+    #[derive(Debug, Clone, PartialEq, Eq, DeriveEntityModel)]
+    #[sea_orm(table_name = "sf_detail")]
+    pub struct Model {
+        #[sea_orm(primary_key)]
+        pub id: i32,
+        pub parent_id: i32,
+        #[sea_orm(belongs_to, from = "parent_id", to = "id")]
+        pub parent: BelongsTo<super::parent::Entity>,
+    }
+
+    impl ActiveModelBehavior for ActiveModel {}
+}
+
+// Many-to-many through a junction table exercises the `many_to_many_action`
+// recursion path, which the macro generates separately from has_many.
+mod post {
+    use sea_orm::entity::prelude::*;
+
+    #[sea_orm::model]
+    #[derive(Debug, Clone, PartialEq, Eq, DeriveEntityModel)]
+    #[sea_orm(table_name = "sf_post")]
+    pub struct Model {
+        #[sea_orm(primary_key)]
+        pub id: i32,
+        pub title: String,
+        #[sea_orm(has_many, via = "post_tag")]
+        pub tags: HasMany<super::tag::Entity>,
+    }
+
+    impl ActiveModelBehavior for ActiveModel {}
+}
+
+mod tag {
+    use sea_orm::entity::prelude::*;
+
+    #[sea_orm::model]
+    #[derive(Debug, Clone, PartialEq, Eq, DeriveEntityModel)]
+    #[sea_orm(table_name = "sf_tag")]
+    pub struct Model {
+        #[sea_orm(primary_key)]
+        pub id: i32,
+        pub name: String,
+        #[sea_orm(has_many, via = "post_tag")]
+        pub posts: HasMany<super::post::Entity>,
+    }
+
+    impl ActiveModelBehavior for ActiveModel {}
+}
+
+mod post_tag {
+    use sea_orm::entity::prelude::*;
+
+    #[sea_orm::model]
+    #[derive(Debug, Clone, PartialEq, Eq, DeriveEntityModel)]
+    #[sea_orm(table_name = "sf_post_tag")]
+    pub struct Model {
+        #[sea_orm(primary_key, auto_increment = false)]
+        pub post_id: i32,
+        #[sea_orm(primary_key, auto_increment = false)]
+        pub tag_id: i32,
+        #[sea_orm(belongs_to, from = "post_id", to = "id")]
+        pub post: BelongsTo<super::post::Entity>,
+        #[sea_orm(belongs_to, from = "tag_id", to = "id")]
+        pub tag: BelongsTo<super::tag::Entity>,
+    }
+
+    impl ActiveModelBehavior for ActiveModel {}
+}
+
+// A self-referential relation is the tightest case: the recursion returns to the
+// same entity, so nothing but the fixed-point bound can terminate it.
+mod node {
+    use sea_orm::entity::prelude::*;
+
+    #[sea_orm::model]
+    #[derive(Debug, Clone, PartialEq, Eq, DeriveEntityModel)]
+    #[sea_orm(table_name = "sf_node")]
+    pub struct Model {
+        #[sea_orm(primary_key)]
+        pub id: i32,
+        #[sea_orm(enum_name = "ParentId")]
+        pub parent_ref: Option<i32>,
+        #[sea_orm(self_ref, relation_enum = "Parent", from 
```

---

### Incident Patch 13: `b2fcc013` (2026-07-23)
**Commit Message**: Document what test_before_acquire_if_idle_for expands to

Add an 'Expands to' section showing the equivalent test_before_acquire(false)
+ before_acquire configuration, so the shorthand's exact behavior is clear.

**File**: `src/database/mod.rs` (modified, +17/-0)
```diff
@@ -505,6 +505,23 @@ impl ConnectOptions {
     /// It composes with a per-backend [`map_sqlx_postgres_before_acquire`] callback (and its
     /// MySQL / SQLite counterparts): the idle-ping runs first, then your callback.
     ///
+    /// # Expands to
+    /// With no per-backend callback set, this is exactly the following configuration on the
+    /// underlying [`sqlx::pool::PoolOptions`]:
+    ///
+    /// ```ignore
+    /// pool_options
+    ///     .test_before_acquire(false)
+    ///     .before_acquire(move |conn, meta| {
+    ///         Box::pin(async move {
+    ///             if meta.idle_for >= idle {
+    ///                 conn.ping().await?;
+    ///             }
+    ///             Ok(true)
+    ///         })
+    ///     })
+    /// ```
+    ///
     /// Applies only to pools built through [`Database::connect`]. Pools adopted via
     /// `SqlxPostgresConnector::from_sqlx_postgres_pool` (and the MySQL / SQLite equivalents)
     /// bypass [`ConnectOptions`] entirely — configure `before_acquire` on your own
```

---

### Incident Patch 14: `38aa6d9c` (2026-07-23)
**Commit Message**: Fix misleading map_sqlx_postgres_before_acquire doc example

The example paired test_before_acquire_if_idle_for with a callback that
pinged unconditionally, which pings on every acquire and defeats the idle
threshold. Replace with a custom check (recycle connections by age) that
shows a genuine use of the hook.

**File**: `src/database/mod.rs` (modified, +7/-9)
```diff
@@ -681,16 +681,14 @@ impl ConnectOptions {
     /// ```
     /// # use sea_orm::ConnectOptions;
     /// # use std::time::Duration;
-    /// use sea_orm::sqlx::Connection;
-    ///
     /// let mut opt = ConnectOptions::new("postgres://localhost/db");
-    /// opt.test_before_acquire_if_idle_for(Duration::from_secs(30))
-    ///     .map_sqlx_postgres_before_acquire(|conn, _meta| {
-    ///         Box::pin(async move {
-    ///             conn.ping().await?;
-    ///             Ok(true)
-    ///         })
-    ///     });
+    /// opt.map_sqlx_postgres_before_acquire(|_conn, meta| {
+    ///     Box::pin(async move {
+    ///         // Discard (and transparently replace) connections older than 10 minutes,
+    ///         // rather than pinging on every acquire.
+    ///         Ok(meta.age < Duration::from_secs(600))
+    ///     })
+    /// });
     /// ```
     pub fn map_sqlx_postgres_before_acquire<F>(&mut self, f: F) -> &mut Self
     where
```

---

### Incident Patch 15: `d612926a` (2026-07-23)
**Commit Message**: Add before_acquire passthrough and idle-ping shorthand to ConnectOptions (#3143)

Expose SQLx's `before_acquire` pool hook, which SeaORM previously only
reachable through the raw `map_sqlx_<db>_pool_opts` escape hatch.

- `test_before_acquire_if_idle_for(Duration)`: DB-agnostic shorthand that
  pings a pooled connection before handing it out only once it has been idle
  for at least the given duration, instead of on every acquire. Sets
  `test_before_acquire(false)`.
- `map_sqlx_{postgres,mysql,sqlite}_before_acquire`: per-backend passthrough of
  SQLx's `before_acquire` callback.
- `get_test_before_acquire` / `get_test_before_acquire_if_idle_for` getters.

Because SQLx's single `before_acquire` slot replaces rather than composes and
has no getter, a generic `apply_before_acquire` helper composes the idle-ping
shorthand with any user-provided callback into one closure (idle-ping first,
then the user callback). The helper returns the pool options untouched when
neither option is set, so existing behavior is unchanged.

Purely additive: no existing signature, default, or behavior is changed.

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -5,6 +5,14 @@ All notable changes to this project will be documented in this file.
 The format is based on [Keep a Changelog](http://keepachangelog.com/)
 and this project adheres to [Semantic Versioning](http://semver.org/).
 
+## [Unreleased]
+
+### Added
+
+- `ConnectOptions::test_before_acquire_if_idle_for(Duration)` — ping a pooled connection before it is handed out only once it has been idle for at least the given duration, instead of on every acquire (`test_before_acquire`). Setting it disables `test_before_acquire`.
+- `ConnectOptions::map_sqlx_postgres_before_acquire` / `map_sqlx_mysql_before_acquire` / `map_sqlx_sqlite_before_acquire` — install a per-backend SQLx `before_acquire` callback. Composes with the idle-ping shorthand above: the idle-ping runs first, then the callback.
+- `ConnectOptions::get_test_before_acquire` / `get_test_before_acquire_if_idle_for` getters.
+
 ## 2.0.0 - 2026-07-19
 
 ### Release Candidates
```

**File**: `src/database/mod.rs` (modified, +170/-0)
```diff
@@ -127,6 +127,9 @@ pub struct ConnectOptions {
     /// Statement timeout (PostgreSQL only)
     pub(crate) statement_timeout: Option<Duration>,
     pub(crate) test_before_acquire: bool,
+    /// If set, a pooled connection is pinged before being handed out only when it has been
+    /// idle for at least this long (see [`ConnectOptions::test_before_acquire_if_idle_for`]).
+    pub(crate) test_before_acquire_if_idle_for: Option<Duration>,
     /// Only establish connections to the DB as needed. If set to `true`, the db connection will
     /// be created using SQLx's [connect_lazy](https://docs.rs/sqlx/latest/sqlx/struct.Pool.html#method.connect_lazy)
     /// method.
@@ -155,6 +158,16 @@ pub struct ConnectOptions {
     #[debug(skip)]
     pub(crate) sqlite_opts_fn:
         Option<Arc<dyn Fn(SqliteConnectOptions) -> SqliteConnectOptions + Send + Sync>>,
+
+    #[cfg(feature = "sqlx-mysql")]
+    #[debug(skip)]
+    pub(crate) mysql_before_acquire_fn: Option<crate::driver::BeforeAcquireFn<sqlx::MySql>>,
+    #[cfg(feature = "sqlx-postgres")]
+    #[debug(skip)]
+    pub(crate) pg_before_acquire_fn: Option<crate::driver::BeforeAcquireFn<sqlx::Postgres>>,
+    #[cfg(feature = "sqlx-sqlite")]
+    #[debug(skip)]
+    pub(crate) sqlite_before_acquire_fn: Option<crate::driver::BeforeAcquireFn<sqlx::Sqlite>>,
 }
 
 impl Database {
@@ -264,6 +277,7 @@ impl ConnectOptions {
             application_name: None,
             statement_timeout: None,
             test_before_acquire: true,
+            test_before_acquire_if_idle_for: None,
             connect_lazy: false,
             after_connect: None,
             #[cfg(feature = "sqlx-mysql")]
@@ -278,6 +292,12 @@ impl ConnectOptions {
             pg_opts_fn: None,
             #[cfg(feature = "sqlx-sqlite")]
             sqlite_opts_fn: None,
+            #[cfg(feature = "sqlx-mysql")]
+            mysql_before_acquire_fn: None,
+            #[cfg(feature = "sqlx-postgres")]
+            pg_before_acquire_fn: None,
+            #[cfg(feature = "sqlx-sqlite")]
+            sqlite_before_acquire_fn: None,
         }
     }
 
@@ -457,11 +477,61 @@ impl ConnectOptions {
     }
 
     /// If true, the connection will be pinged upon acquiring from the pool (default true).
+    ///
+    /// See [`test_before_acquire_if_idle_for`](Self::test_before_acquire_if_idle_for) for the
+    /// cheaper "only ping stale connections" variant.
     pub fn test_before_acquire(&mut self, value: bool) -> &mut Self {
         self.test_before_acquire = value;
         self
     }
 
+    /// Get whether a pooled connection is pinged on every acquire (default true).
+    pub fn get_test_before_acquire(&self) -> bool {
+        self.test_before_acquire
+    }
+
+    /// Ping a pooled connection before handing it out, but only once it has been idle for at
+    /// least `idle`.
+    ///
+    /// [`test_before_acquire`](Self::test_before_acquire) pings on *every* acquire, which adds
+    /// a round-trip to each checkout. This shorthand instead pings only connections that have
+    /// been idle long enough to plausibly have been dropped by the server, a proxy, or a
+    /// firewall — the common failure mode — while letting hot connections through untouched.
+    ///
+    /// Calling this sets [`test_before_acquire`](Self::test_before_acquire) to `false` (SQLx
+    /// runs the per-acquire ping *and* this hook, so leaving it enabled would ping on every
+    /// acquire regardless and defeat the threshold).
+    ///
+    /// It composes with a per-backend [`map_sqlx_postgres_before_acquire`] callback (and its
+    /// MySQL / SQLite counterparts): the idle-ping runs first, then your callback.
+    ///
+    /// Applies only to pools built through [`Database::connect`]. Pools adopted via
+    /// `SqlxPostgresConnector::from_sqlx_postgres_pool` (and the MySQL / SQLite equivalents)
+    /// bypass [`ConnectOptions`] entirely — configure `before_acquire` on your own
+    /// [`sqlx::pool::PoolOptions`] in that case.
+    ///
+    /// # Example
+    /// ```
+    /// # use sea_orm::ConnectOptions;
+    /// # use std::time::Duration;
+    /// let mut opt = ConnectOptions::new("postgres://localhost/db");
+    /// opt.test_before_acquire_if_idle_for(Duration::from_secs(30));
+    /// assert_eq!(opt.get_test_before_acquire(), false);
+    /// ```
+    ///
+    /// [`map_sqlx_postgres_before_acquire`]: Self::map_sqlx_postgres_before_acquire
+    pub fn test_before_acquire_if_idle_for(&mut self, idle: Duration) -> &mut Self {
+        self.test_before_acquire = false;
+        self.test_before_acquire_if_idle_for = Some(idle);
+        self
+    }
+
+    /// Get the idle threshold set by
+    /// [`test_before_acquire_if_idle_for`](Self::test_before_acquire_if_idle_for), if any.
+    pub fn get_test_before_acquire_if_idle_for(&self) -> Option<Duration> {
+        self.test_before_acquire_if_idle_for
+    }
+
     /// If set to `true`, the db connection pool will be created using SQLx's
     /// [
```

**File**: `src/driver/sqlx_common.rs` (modified, +117/-0)
```diff
@@ -1,4 +1,21 @@
 use crate::{ConnAcquireErr, ConnectOptions, DbErr, RuntimeErr};
+use std::{sync::Arc, time::Duration};
+
+/// Callback stored for a `before_acquire` hook on [`ConnectOptions`].
+///
+/// This mirrors the signature accepted by SQLx's
+/// [`PoolOptions::before_acquire`][sqlx::pool::PoolOptions::before_acquire] for the given
+/// database backend `DB`. Note the fully-qualified [`futures_util::future::BoxFuture`]: the
+/// crate-local `BoxFuture` alias collapses to `T` under the `sync` feature, which would not
+/// match SQLx's signature.
+pub(crate) type BeforeAcquireFn<DB> = Arc<
+    dyn for<'c> Fn(
+            &'c mut <DB as sqlx::Database>::Connection,
+            sqlx::pool::PoolConnectionMetadata,
+        ) -> futures_util::future::BoxFuture<'c, Result<bool, sqlx::Error>>
+        + Send
+        + Sync,
+>;
 
 /// Converts an [sqlx::error] execution error to a [DbErr]
 pub fn sqlx_error_to_exec_err(err: sqlx::Error) -> DbErr {
@@ -63,4 +80,104 @@ impl ConnectOptions {
         opt = opt.test_before_acquire(self.test_before_acquire);
         opt
     }
+
+    /// Install the composed `before_acquire` hook onto a [`sqlx::pool::PoolOptions`].
+    ///
+    /// SQLx exposes a single `before_acquire` slot whose setter *replaces* rather than
+    /// composes, and offers no getter to read it back. To let the idle-ping shorthand
+    /// ([`ConnectOptions::test_before_acquire_if_idle_for`]) coexist with a user-provided
+    /// per-backend callback ([`ConnectOptions::map_sqlx_postgres_before_acquire`] and
+    /// friends), this composes both into one closure: the idle-ping runs first, then the
+    /// user callback. When a ping threshold is set, `test_before_acquire` is forced off so
+    /// the connection is pinged only past the threshold rather than on every acquire.
+    ///
+    /// Returns `opt` untouched when neither option is configured, so callers that opt into
+    /// nothing get byte-for-byte the previous behavior.
+    pub(crate) fn apply_before_acquire<DB>(
+        mut opt: sqlx::pool::PoolOptions<DB>,
+        ping_after_idle: Option<Duration>,
+        user_cb: Option<BeforeAcquireFn<DB>>,
+    ) -> sqlx::pool::PoolOptions<DB>
+    where
+        DB: sqlx::Database,
+    {
+        use sqlx::Connection;
+
+        if ping_after_idle.is_none() && user_cb.is_none() {
+            return opt;
+        }
+        if ping_after_idle.is_some() {
+            opt = opt.test_before_acquire(false);
+        }
+        opt.before_acquire(move |conn, meta| {
+            let user_cb = user_cb.clone();
+            Box::pin(async move {
+                if let Some(threshold) = ping_after_idle {
+                    // `idle_for` is `Copy`; read it before `meta` is moved into the user callback.
+                    // `>=` matches the "idle for at least `threshold`" contract documented on
+                    // `ConnectOptions::test_before_acquire_if_idle_for`.
+                    if meta.idle_for >= threshold {
+                        conn.ping().await?;
+                    }
+                }
+                match user_cb {
+                    Some(user_cb) => user_cb(conn, meta).await,
+                    None => Ok(true),
+                }
+            })
+        })
+    }
+}
+
+#[cfg(all(test, feature = "sqlx-postgres"))]
+mod tests {
+    use crate::ConnectOptions;
+    use sqlx::Connection;
+    use std::time::Duration;
+
+    #[test]
+    fn idle_shorthand_disables_test_before_acquire() {
+        let mut opt = ConnectOptions::new("postgres://localhost/db");
+        assert!(opt.get_test_before_acquire());
+        assert_eq!(opt.get_test_before_acquire_if_idle_for(), None);
+
+        opt.test_before_acquire_if_idle_for(Duration::from_secs(30));
+        assert!(!opt.get_test_before_acquire());
+        assert_eq!(
+            opt.get_test_before_acquire_if_idle_for(),
+            Some(Duration::from_secs(30))
+        );
+    }
+
+    #[test]
+    fn compose_shorthand_and_user_callback() {
+        let mut opt = ConnectOptions::new("postgres://localhost/db");
+        opt.test_before_acquire_if_idle_for(Duration::from_secs(30))
+            .map_sqlx_postgres_before_acquire(|conn, _meta| {
+                Box::pin(async move {
+                    conn.ping().await?;
+                    Ok(true)
+                })
+            });
+
+        // Composing both into SQLx's single `before_acquire` slot type-checks and returns a
+        // usable `PoolOptions`. Behavioral ping timing requires a live pool, covered elsewhere.
+        let pool_opts = ConnectOptions::apply_before_acquire::<sqlx::Postgres>(
+            sqlx::pool::PoolOptions::new(),
+            opt.get_test_before_acquire_if_idle_for(),
+            opt.pg_before_acquire_fn.clone(),
+        );
+        let _ = pool_opts;
+    }
+
+    #[test]
+    fn apply_before_acquire_noop_when_unset() {
+        // With neither option set, the helper must return the options untouched.
+        let opts = 
```

**File**: `src/driver/sqlx_mysql.rs` (modified, +7/-0)
```diff
@@ -89,7 +89,14 @@ impl SqlxMySqlConnector {
         let after_connect = options.after_connect.clone();
         let connect_lazy = options.connect_lazy;
         let mysql_pool_opts_fn = options.mysql_pool_opts_fn.clone();
+        let mysql_before_acquire = options.mysql_before_acquire_fn.clone();
+        let ping_after_idle = options.test_before_acquire_if_idle_for;
         let mut pool_options = options.sqlx_pool_options();
+        pool_options = crate::ConnectOptions::apply_before_acquire::<sqlx::MySql>(
+            pool_options,
+            ping_after_idle,
+            mysql_before_acquire,
+        );
         if let Some(f) = &mysql_pool_opts_fn {
             pool_options = f(pool_options);
         }
```

**File**: `src/driver/sqlx_postgres.rs` (modified, +7/-0)
```diff
@@ -117,7 +117,14 @@ impl SqlxPostgresConnector {
         let lazy = options.connect_lazy;
         let after_connect = options.after_connect.clone();
         let pg_pool_opts_fn = options.pg_pool_opts_fn.clone();
+        let pg_before_acquire = options.pg_before_acquire_fn.clone();
+        let ping_after_idle = options.test_before_acquire_if_idle_for;
         let mut pool_options = options.sqlx_pool_options();
+        pool_options = crate::ConnectOptions::apply_before_acquire::<sqlx::Postgres>(
+            pool_options,
+            ping_after_idle,
+            pg_before_acquire,
+        );
 
         if let Some(sql) = set_search_path_sql {
             pool_options = pool_options.after_connect(move |conn, _| {
```

**File**: `src/driver/sqlx_sqlite.rs` (modified, +7/-0)
```diff
@@ -99,7 +99,14 @@ impl SqlxSqliteConnector {
         let after_conn = options.after_connect.clone();
         let connect_lazy = options.connect_lazy;
         let sqlite_pool_opts_fn = options.sqlite_pool_opts_fn.clone();
+        let sqlite_before_acquire = options.sqlite_before_acquire_fn.clone();
+        let ping_after_idle = options.test_before_acquire_if_idle_for;
         let mut pool_options = options.sqlx_pool_options();
+        pool_options = crate::ConnectOptions::apply_before_acquire::<sqlx::Sqlite>(
+            pool_options,
+            ping_after_idle,
+            sqlite_before_acquire,
+        );
 
         if let Some(f) = &sqlite_pool_opts_fn {
             pool_options = f(pool_options);
```

#### Recent Merged Pull Requests:
- **PR #3221** (2026-10-04): Ci impr (@Huliiiiii)
- **PR #3220** (2026-10-04): Fix compilation failures with the proxy feature (@Huliiiiii)
- **PR #3215** (2026-10-03): Perf impr (@Huliiiiii)
- **PR #3212** (2026-09-26): Update 2.0.4.md (@Huliiiiii)
- **PR #3211** (2026-09-25): Add `select_except` to select all columns except the given ones (@tyt2y3)
- **PR #3210** (2026-09-25): Split tests/common so each test binary compiles only what it uses (@tyt2y3)
- **PR #3209** (2026-09-25): improve CI runtime (@tyt2y3)
- **PR #3208** (2026-09-23): Apply `save_as` cast to `eq_any` / `ne_all` arrays (@tyt2y3)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
