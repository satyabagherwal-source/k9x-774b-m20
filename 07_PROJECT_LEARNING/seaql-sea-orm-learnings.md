# Forensic Learning Record (Deep Inspection): SeaQL/sea-orm

> **Canonical Artifact**: `07_PROJECT_LEARNING/seaql-sea-orm-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/SeaQL/sea-orm](https://github.com/SeaQL/sea-orm))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-29T21:27:45.072Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `SeaQL/sea-orm`
- **Description**: 🐚 A powerful relational ORM for Rust
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9906 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/actix_example/api/src/lib.rs`
```
pub mod service;

use actix_files::Files as Fs;
use actix_web::{
    App, Error, HttpRequest, HttpResponse, HttpServer, Result, error, get, middleware, post, web,
};

use entity::post;
use listenfd::ListenFd;
use migration::{Migrator, MigratorTrait};
use sea_orm::{Database, DatabaseConnection};
use serde::{Deserialize, Serialize};
use service::{Mutation, Query};
use std::env;
use tera::Tera;

const DEFAULT_POSTS_PER_PAGE: u64 = 5;

#[derive(Debug, Clone)]
struct AppState {
    templates: tera::Tera,
    conn: DatabaseConnection,
}

#[derive(Debug, Deserialize)]
pub struct Params {
    page: Option<u64>,
    posts_per_page: Option<u64>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
struct FlashData {
    kind: String,
    message: String,
}

#[get("/")]
async fn list(req: HttpRequest, data: web::Data<AppState>) -> Result<HttpResponse, Error> {
    let template = &data.templates;
    let conn = &data.conn;

    // get params
    let params = web::Query::<Params>::from_query(req.query_string()).unwrap();

    let page = params.page.unwrap_or(1);
    let posts_per_page = params.posts_per_page.unwrap_or(DEFAULT_POSTS_PER_PAGE);

    let (posts, num_pages) = Query::find_posts_in_page(conn, page, posts_per_page)
        .await
        .expect("Cannot find posts in page");

    let mut ctx = tera::Context::new();
    ctx.insert("posts", &posts);
    ctx.insert("page", &page);
    ctx.insert("posts_per_page", &posts_per_page);
    ctx.insert("num_pages", &num_pages);

    let body = template
        .render("index.html.tera", &ctx)
        .map_err(|_| error::ErrorInternalServerError("Template error"))?;
    Ok(HttpResponse::Ok().content_type("text/html").body(body))
}

#[get("/new")]
async fn new(data: web::Data<AppState>) -> Result<HttpResponse, Error> {
    let template = &data.templates;
    let ctx = tera::Context::new();
    let body = template
        .render("new.html.tera", &ctx)
        .map_err(|_| error::ErrorInternalServerError("Template error"))?;
    Ok(HttpResponse::Ok().content_type("text/html").body(body))
}

#[post("/")]
async fn create(
    data: web::Data<AppState>,
    post_form: web::Form<post::Model>,
) -> Result<HttpResponse, Error> {
    let conn = &data.conn;

    let form = post_form.into_inner();

    Mutation::create_post(conn, form)
        .await
        .expect("could not insert post");

    Ok(HttpResponse::Found()
        .append_header(("location", "/"))
        .finish())
}

#[get(r#"/{id:\d+}"#)]
async fn edit(data: web::D
```

### Core Architecture Module: `examples/actix_example/api/src/service/mod.rs`
```
mod mutation;
mod query;

pub use mutation::*;
pub use query::*;

```

### Core Architecture Module: `examples/actix_example/api/src/service/mutation.rs`
```
use ::entity::{post, post::Entity as Post};
use sea_orm::*;

pub struct Mutation;

impl Mutation {
    pub async fn create_post(
        db: &DbConn,
        form_data: post::Model,
    ) -> Result<post::ActiveModel, DbErr> {
        post::ActiveModel {
            title: Set(form_data.title.to_owned()),
            text: Set(form_data.text.to_owned()),
            ..Default::default()
        }
        .save(db)
        .await
    }

    pub async fn update_post_by_id(
        db: &DbConn,
        id: i32,
        form_data: post::Model,
    ) -> Result<post::Model, DbErr> {
        let post: post::ActiveModel = Post::find_by_id(id)
            .one(db)
            .await?
            .ok_or(DbErr::Custom("Cannot find post.".to_owned()))
            .map(Into::into)?;

        post::ActiveModel {
            id: post.id,
            title: Set(form_data.title.to_owned()),
            text: Set(form_data.text.to_owned()),
        }
        .update(db)
        .await
    }

    pub async fn delete_post(db: &DbConn, id: i32) -> Result<DeleteResult, DbErr> {
        let post: post::ActiveModel = Post::find_by_id(id)
            .one(db)
            .await?
            .ok_or(DbErr::Custom("Cannot find post.".to_owned()))
            .map(Into::into)?;

        post.delete(db).await
    }

    pub async fn delete_all_posts(db: &DbConn) -> Result<DeleteResult, DbErr> {
        Post::delete_many().exec(db).await
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3212** (2026-09-26): **Update 2.0.4.md**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-09-26T23:28:20.754770Z">2026-09-26T23:28:20.754770Z</relative-time> | `2f1a824` | PR opened |    <details> <summary

- **Issue #3211** (2026-09-25): **Add `select_except` to select all columns except the given ones**
  *Symptoms*: Lands #3123 by @WookiesRpeople2, plus a review fix.  - `Select::select_except(columns)` selects every entity column except the given ones - Clears any prior selection, so it does not compose with `select_only` / `column` - Rows still hydrate into the full `Model`: only `Option<_>` columns can be excluded; a non-nullable column fails with `Missing value for column` - Review fix: build the selection via `into_select_expr`, as `column_list` does since #3194. The original pushed un-aliased casts, so a `select_as` column lost its alias (MySQL / SQLite could not hydrate it) and chaining `select_also
  **Post-Mortem & Fix Analysis**:
  > ### :tada: Released In [2.0.4](https://github.com/SeaQL/sea-orm/releases/tag/2.0.4) :tada:  Huge thanks for the contribution! This feature has now been released, so it's a great time to upgrade. Show some love with a ⭐ on our repo, every star counts!

- **Issue #3210** (2026-09-25): **Split tests/common so each test binary compiles only what it uses**
  *Symptoms*: - Each test declares an inline `mod common { ... }` with only the modules it needs, instead of pulling in all of `tests/common` - Test build on 15 cores: 81s -> 22-31s; an empty test with the old `common` took 5.8s to compile - `TestContext` moved into `setup`; `tests/common/mod.rs` removed - sea-orm-sync regenerated

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

### Incident Patch 1: `48e18090` (2026-09-27)
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

### Incident Patch 2: `d11ef8c3` (2026-09-26)
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

### Incident Patch 3: `5c451004` (2026-09-25)
**Commit Message**: Fix schema sync failing to drop a stale index on MySQL (#3202)

The non-PostgreSQL branch of the unique-index drop built
`Index::drop().name(...)` with no target table. SeaQuery's MySQL builder
always writes the ` ON ` clause, so the statement came out as
`DROP INDEX `ref_no` ON ` and MySQL rejected it with error 1064. SQLite
ignores the table in `DROP INDEX`, so only MySQL was affected, and the
existing regression test for this path is gated on `sqlx-postgres`.

Pass the entity's table through `index_table_ref`, the same helper the
index-creation paths use, so MySQL gets a bare table name and

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
+   
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

---

### Incident Patch 4: `b276dbdd` (2026-09-14)
**Commit Message**: Fix left_join_linked joining multi-hop links onto the wrong alias (#3199)

Since `left_join_linked` can be called several times, table aliases come from
`linked_index`, but each non-first hop still joined onto `r{i-1}`, the alias
from the first linked call. Chaining a multi-hop link after another link
produced a join onto the previous link's tables.

---------

Co-authored-by: Huliiiiii <huliiiiii.nya@gmail.com>

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

### Incident Patch 5: `457067e1` (2026-09-13)
**Commit Message**: Fix bump.sh taplo no-op, and document it in RELEASE.md

`taplo fmt .` from inside examples/ formatted nothing: `.taplo.toml` sets
`include = ["**/*.toml"]`, which taplo anchors at the config's directory, so a
directory argument collects zero files ("total=1 excluded=1"). The bump's sed
collapses the comment alignment on every release, and nothing put it back --
2.0.3 shipped with a red Taplo job as a result.

Run taplo from the repo root over the tracked example manifests instead. Also
add the formatting jobs to RELEASE.md's local validation step, note why the
push-before-publish ordering matt

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
 and publishes it. Confirm the assets appear on the `sea-or
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

#### Recent Merged Pull Requests:
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
