# Forensic Learning Record (Deep Inspection): vlcn-io/cr-sqlite

> **Canonical Artifact**: `07_PROJECT_LEARNING/vlcn-io-cr-sqlite-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vlcn-io/cr-sqlite](https://github.com/vlcn-io/cr-sqlite))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:19:37.229Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vlcn-io/cr-sqlite`
- **Description**: Convergent, Replicated SQLite. Multi-writer and CRDT support for SQLite
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3807 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `core/nodejs-helper.d.ts`
```
export declare const extensionPath: string;

```

### Core Architecture Module: `core/nodejs-helper.js`
```
// Exports the path to the extension for those using
// crsqlite in a Node.js environment.
import * as url from "url";
import { join } from "path";
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

export const extensionPath = join(__dirname, "dist", "crsqlite");

```

### Core Architecture Module: `core/nodejs-install-helper.js`
```
/**
 * 1. Checks the current OS and CPU architecture
 * 2. Copies pre-built binaries from the `binaries` directory to the `dist` directory if one exists
 * 3. Otherwise, lets the standard install process via `make` take over
 */
import { join } from "path";
import fs from "fs";
import https from "https";
import pkg from "./package.json" with { type: "json" };
import { exec } from "child_process";
let { version } = pkg;

let arch = process.arch;
let os = process.platform;
let ext = "unknown";
version = "v" + version;

if (process.env.CRSQLITE_NOPREBUILD) {
  console.log("CRSQLITE_NOPREBUILD env variable is set. Building from source.");
  buildFromSource();
} else {
  // todo: check msys?
  if (["win32", "cygwin"].includes(process.platform)) {
    os = "win";
  }

  // manual ovverides for testing
  // arch = "x86_64";
  // os = "linux";
  // version = "prebuild-test.11";

  switch (os) {
    case "darwin":
      ext = "dylib";
      break;
    case "linux":
      ext = "so";
      break;
    case "win":
      ext = "dll";
      break;
  }

  switch (arch) {
    case "x64":
      arch = "x86_64";
      break;
    case "arm64":
      arch = "aarch64";
      break;
  }

  const binaryUrl = `https://github.com/vlcn-io/cr-sqlite/releases/download/${version}/crsqlite-${os}-${arch}.zip`;
  console.log(`Look for prebuilt binary from ${binaryUrl}`);
  const distPath = join("dist", `crsqlite.${ext}`);

  if (!fs.existsSync(join(".", "dist"))) {
    fs.mkdirSync(join(".", "dist"));
  }

  if (fs.existsSync(distPath)) {
    console.log("Binary already present and installed.");
    process.exit(0);
  }

  // download the file at the url, if it exists
  let redirectCount = 0;
  function get(url, cb) {
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        ++redirectCount;
        if (redirectCount > 5) {
          throw new Error("Too many redirects");
        }
        get(res.headers.location, cb);
      } else if (res.statusCode === 200) {
        cb(res);
      } else {
        cb(null);
      }
    });
  }

  get(binaryUrl, (res) => {
    if (res == null) {
      console.log("No prebuilt binary available. Building from source.");
      buildFromSource();
      return;
    }

    const file = fs.createWriteStream(join("dist", "crsqlite.zip"));
    res.pipe(file);
    file.on("finish", () => {
      file.close();
      console.log("Prebuilt binary downloaded");
      process.chdir(join(".", "dist"));
      exec("unzip crsqlite.zip", (err, stdout, stderr) => {
        if (err) {
          console.log("Error extracting");
          console.log(err.message);
          process.exit(1);
        }
        if (stderr) {
          console.log(stderr);
        }
        console.log("Prebuilt binary extracted");
        process.exit(0);
      });
    });
    // unzipper incorrectly unzips the file -- it becomes unloadable by sqlite.
    // res.pipe(unzipper.Extract({ path: join(".", "dist") })).on("close", () => {
    //   console.log("Prebuilt binary downloaded");
    //   process.exit(0);
    // });
  });
}

function buildFromSource() {
  console.log("Building from source");
  exec("make loadable", (err, stdout, stderr) => {
    if (err) {
      console.log("Error building from source");
      console.log(err.message);
      process.exit(1);
    }
    if (stderr) {
      console.log(stderr);
    }
    console.log("Built from source");
    console.log(stdout);
    process.exit(0);
  });
}

```

### Core Architecture Module: `core/rs/bundle/src/lib.rs`
```
#![no_std]
#![feature(core_intrinsics)]
#![feature(lang_items)]

extern crate alloc;

use core::alloc::GlobalAlloc;
use core::ffi::c_char;
use core::panic::PanicInfo;
use crsql_core;
use crsql_core::sqlite3_crsqlcore_init;
#[cfg(feature = "test")]
pub use crsql_core::test_exports;
use crsql_fractindex_core::sqlite3_crsqlfractionalindex_init;
use sqlite_nostd as sqlite;
use sqlite_nostd::SQLite3Allocator;

// This must be our allocator so we can transfer ownership of memory to SQLite and have SQLite free that memory for us.
// This drastically reduces copies when passing strings and blobs back and forth between Rust and C.
#[global_allocator]
static ALLOCATOR: SQLite3Allocator = SQLite3Allocator {};

// This must be our panic handler for WASM builds. For simplicity, we make it our panic handler for
// all builds. Abort is also more portable than unwind, enabling us to go to more embedded use cases.
#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    core::intrinsics::abort()
}

#[cfg(not(target_family = "wasm"))]
#[lang = "eh_personality"]
extern "C" fn eh_personality() {}

#[cfg(target_family = "wasm")]
#[no_mangle]
pub fn __rust_alloc_error_handler(_: Layout) -> ! {
    core::intrinsics::abort()
}

#[no_mangle]
pub extern "C" fn sqlite3_crsqlrustbundle_init(
    db: *mut sqlite::sqlite3,
    err_msg: *mut *mut c_char,
    api: *mut sqlite::api_routines,
) -> *mut ::core::ffi::c_void {
    sqlite::EXTENSION_INIT2(api);

    let rc = sqlite3_crsqlfractionalindex_init(db, err_msg, api);
    if rc != 0 {
        return core::ptr::null_mut();
    }

    sqlite3_crsqlcore_init(db, err_msg, api)
}

```

### Core Architecture Module: `core/rs/bundle_static/src/lib.rs`
```
#![no_std]

pub use crsql_bundle;

```

### Core Architecture Module: `core/rs/core/src/alter.rs`
```
// Not yet fully migrated from `crsqlite.c`

use alloc::boxed::Box;
use alloc::format;
use alloc::string::String;
use alloc::vec::Vec;
use core::ffi::{c_char, c_int, CStr};
use core::mem;
#[cfg(not(feature = "std"))]
use num_traits::FromPrimitive;
use sqlite_nostd::{sqlite3, Connection, ResultCode, StrRef};

use crate::c::crsql_ExtData;
use crate::db_version::fill_db_version_if_needed;
use crate::tableinfo::{crsql_ensure_table_infos_are_up_to_date, TableInfo};

#[no_mangle]
pub unsafe extern "C" fn crsql_compact_post_alter(
    db: *mut sqlite3,
    tbl_name: *const c_char,
    ext_data: *mut crsql_ExtData,
    errmsg: *mut *mut c_char,
) -> c_int {
    match compact_post_alter(db, tbl_name, ext_data, errmsg) {
        Ok(rc) | Err(rc) => rc as c_int,
    }
}

unsafe fn compact_post_alter(
    db: *mut sqlite3,
    tbl_name: *const c_char,
    ext_data: *mut crsql_ExtData,
    errmsg: *mut *mut c_char,
) -> Result<ResultCode, ResultCode> {
    let tbl_name_str = CStr::from_ptr(tbl_name).to_str()?;
    fill_db_version_if_needed(db, ext_data).or_else(|msg| {
        errmsg.set(&msg);
        Err(ResultCode::ERROR)
    })?;
    let current_db_version = (*ext_data).dbVersion;

    // If primary key columns change (in the schema)
    // We need to drop, re-create and backfill
    // the clock table.
    // A change in pk columns means a change in all identities
    // of all rows.
    // We can determine this by comparing unique index on lookaside table vs
    // pks on source table
    let stmt = db.prepare_v2(&format!(
        "SELECT count(name) FROM (
        SELECT name FROM pragma_table_info('{table_name}')
          WHERE pk > 0 AND name NOT IN
            (SELECT name FROM pragma_index_info('{table_name}__crsql_pks_pks'))
          UNION SELECT name FROM pragma_index_info('{table_name}__crsql_pks_pks') WHERE name NOT IN 
            (SELECT name FROM pragma_table_info('{table_name}') WHERE pk > 0) AND name != 'col_name'
        );",
        table_name = crate::util::escape_ident_as_value(tbl_name_str),
    ))?;
    stmt.step()?;

    let pk_diff = stmt.column_int(0);
    // immediately drop stmt, otherwise clock table is considered locked.
    drop(stmt);

    if pk_diff > 0 {
        // drop the clock table so we can re-create it
        db.exec_safe(&format!(
            "DROP TABLE \"{table_name}__crsql_clock\";
             DROP TABLE \"{table_name}__crsql_pks\";",
            table_name = crate::util::escape_ident(tbl_name_str),
        ))?;
    } else {
        // clock table is still relevant but needs compacting
        // in case columns were removed during the migration

        // First delete entries that no longer have a column
        let sql = format!(
            "DELETE FROM \"{tbl_name_ident}__crsql_clock\" WHERE \"col_name\" NOT IN (
              SELECT name FROM pragma_table_info('{tbl_name_val}') UNION SELECT '{cl_sentinel}'
            )",
            tbl_name_ident = crate::util::escape_ident(tbl_name_str),
            tbl_name_val = crate::util::escape_ident_as_value(tbl_name_str),
            cl_sentinel = crate::c::DELETE_SENTINEL,
        );
        db.exec_safe(&sql)?;

        // Next delete entries that no longer have a row but keeping tombstones
        // TODO: if we move the sentinel metadata to the lookaside this becomes much simpler
        let mut sql = String::from(
            format!(
              "DELETE FROM \"{tbl_name}__crsql_clock\" WHERE (col_name != '-1' OR (col_name = '-1' AND col_version % 2 != 0))
              AND NOT EXISTS (SELECT 1 FROM \"{tbl_name}\" JOIN \"{tbl_name}__crsql_pks\" ON ",
              tbl_name = crate::util::escape_ident(tbl_name_str),
            ),
        );
        let c_rc = crsql_ensure_table_infos_are_up_to_date(db, ext_data, errmsg);
        if c_rc != ResultCode::OK as c_int {
            if let Some(rc) = ResultCode::from_i32(c_rc) {
                return Err(rc);
            }
            return Err(ResultCode::ERROR);
        }
        let table_infos =
            mem::ManuallyDrop::new(Box::from_raw((*ext_data).tableInfos as *mut Vec<TableInfo>));
        let table_info = table_infos.iter().find(|x| x.tbl_name == tbl_name_str);
        if table_info.is_none() {
            return Err(ResultCode::ERROR);
        }
        // TODO: safe since we checked above but make more idiomatic
        let table_info = table_info.unwrap();

        // for each pk col, append \"%w\".\"%w\" = \"%w__crsql_pks\".\"%w\"
        // to the where clause then close the statement.
        for (i, col) in table_info.pks.iter().enumerate() {
            if i > 0 {
                sql.push_str(" AND ");
            }

            sql.push_str(&format!(
                "\"{tbl_name}\".\"{col_name}\" = \"{tbl_name}__crsql_pks\".\"{col_name}\"",
                tbl_name = crate::util::escape_ident(tbl_name_str),
                col_name = &col.name,
            ));
        }
        sql.push_str(
          &format!(
            " WHERE \"{tbl_name}__crsql_clock\".key = \"{tbl_name}__crsql_pks\".__crsql_key LIMIT 1)",
            tbl_name = crate::util::escape_ident(tbl_name_str)
          )
        );
        db.exec_safe(&sql)?;

        // now delete pk lookasides that no longer map to anything in the clock tables
        let sql = format!(
            "DELETE FROM \"{tbl_name}__crsql_pks\" WHERE __crsql_key NOT IN (
        SELECT key FROM \"{tbl_name}__crsql_clock\"
      )",
            tbl_name = crate::util::escape_ident(tbl_name_str),
        );
        db.exec_safe(&sql)?;
    }

    let stmt = db.prepare_v2(
        "INSERT OR REPLACE INTO crsql_master (key, value) VALUES ('pre_compact_dbversion', ?)",
    )?;
    stmt.bind_int64(1, current_db_version)?;
    stmt.step()?;
    Ok(ResultCode::OK)
}

```

### Core Architecture Module: `core/rs/core/src/automigrate.rs`
```
extern crate alloc;

// nit: use vecs rather than btreesets. Likely never enough elements
// for a btreeset to perform better.
use alloc::collections::BTreeSet;
use alloc::format;
use alloc::string::String;
use alloc::string::ToString;
use alloc::vec;
use alloc::vec::Vec;
use core::ffi::{c_char, c_int};
use sqlite::ColumnType;
use sqlite_nostd as sqlite;

use sqlite::{args, sqlite3, ManagedConnection, Value};
use sqlite::{strlit, Context};
use sqlite::{Connection, ResultCode};

static IS_UNIQUE_IDX_SQL: &str = "SELECT \"unique\" FROM pragma_index_list(?) WHERE name = ?";
static IDX_COLS_SQL: &str = "SELECT name FROM pragma_index_info(?) ORDER BY seqno ASC";

/**
* Automigrate args:
* 1 - the schema content
* Users are responsible for tracking schema version and applying the migration or not.
*
* We may want to move automigrate to its own crate.
* It is rather limited in completeness and may only be
* useful to myself.
*/
pub extern "C" fn crsql_automigrate(
    ctx: *mut sqlite::context,
    argc: c_int,
    argv: *mut *mut sqlite::value,
) {
    if argc < 1 {
        ctx.result_error("Had no args. Expected a schema to migrate to");
        return;
    }

    let args = args!(argc, argv);
    if let Err(code) = automigrate_impl(ctx, args) {
        // We're using `Err(OK)` to signify that error message and code were already set.
        if code != ResultCode::OK {
            ctx.result_error(&format!("failed to apply the updated schema {:?}", code));
            ctx.result_error_code(code);
        }

        return;
    }

    ctx.result_text_transient("migration complete");
}

fn automigrate_impl(
    ctx: *mut sqlite::context,
    args: &[*mut sqlite::value],
) -> Result<ResultCode, ResultCode> {
    let cleanup = |mem_db: ManagedConnection| {
        if args.len() == 2 {
            let cleanup_stmt = args[1].text();
            mem_db.exec_safe(cleanup_stmt)
        } else {
            Ok(ResultCode::OK)
        }
    };
    let local_db = ctx.db_handle();
    let desired_schema = args[0].text();
    let stripped_schema = strip_crr_statements(desired_schema);

    let result = sqlite::open(strlit!(":memory:"));
    if let Ok(mem_db) = result {
        if let Err(_) = mem_db.exec_safe(&stripped_schema) {
            let mem_db_err_msg = mem_db.errmsg()?;
            ctx.result_error(&mem_db_err_msg);
            ctx.result_error_code(mem_db.errcode());
            cleanup(mem_db)?;
            return Err(ResultCode::OK);
        }
        local_db.exec_safe("SAVEPOINT automigrate_tables;")?;

        let migrate_result = migrate_to(local_db, &mem_db);

        if let Err(_) = migrate_result {
            local_db.exec_safe("ROLLBACK")?;
            let mem_db_err_msg = mem_db.errmsg()?;
            ctx.result_error(&mem_db_err_msg);
            ctx.result_error_code(mem_db.errcode());
            cleanup(mem_db)?;
            return Err(ResultCode::OK);
        } else {
            cleanup(mem_db)?;
        }

        if !desired_schema.is_empty() {
            local_db.exec_safe(desired_schema)?;
        }
        local_db.exec_safe("RELEASE automigrate_tables")
    } else {
        ctx.result_error("could not open the temporary migration db");
        ctx.result_error_code(ResultCode::CANTOPEN);
        return Err(ResultCode::OK);
    }
}

fn migrate_to(
    local_db: *mut sqlite3,
    mem_db: &ManagedConnection,
) -> Result<ResultCode, ResultCode> {
    // TODO: why not HashSet?
    let mut mem_tables: BTreeSet<String> = BTreeSet::new();

    let sql = "SELECT name FROM sqlite_master WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
        AND name NOT LIKE 'crsql_%'
        AND name NOT LIKE '__crsql_%'
        AND name NOT LIKE '%__crsql_%'";
    let fetch_mem_tables = mem_db.prepare_v2(sql)?;
    let fetch_local_tables = local_db.prepare_v2(sql)?;

    while fetch_mem_tables.step()? == ResultCode::ROW {
        mem_tables.insert(fetch_mem_tables.column_text(0)?.to_string());
    }

    let mut removed_tables: Vec<String> = vec![];
    let mut maybe_modified_tables: Vec<String> = vec![];

    while fetch_local_tables.step()? == ResultCode::ROW {
        let table_name = fetch_local_tables.column_text(0)?;
        if mem_tables.contains(table_name) {
            maybe_modified_tables.push(table_name.to_string());
        } else {
            removed_tables.push(table_name.to_string());
        }
    }

    drop_tables(local_db, removed_tables)?;
    for table in maybe_modified_tables {
        maybe_modify_table(local_db, &table, &mem_db)?;
    }
    // no add tables. Schema file application will add tables.
    Ok(ResultCode::OK)
}

/**
* stripts `select crsql_as_crr` statements
* from the provided schema.
* returns which tables were crrs so we can re-apply the statements
* once migrations are complete.
*
* We have to strip the statements given we can't load an extension into an extension
* in all environment.
*
* E.g., if cr-sqlite is running as a runtime loadable ext
* then it cannot open an in-memory db within itself that loads this same
* extension.
*/
fn strip_crr_statements(schema: &str) -> String {
    schema
        .split("\n")
        .filter(|line| {
            !line.to_lowercase().contains("crsql_as_crr")
                && !line.to_lowercase().contains("crsql_fract_as_ordered")
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn drop_tables(local_db: *mut sqlite3, tables: Vec<String>) -> Result<ResultCode, ResultCode> {
    for table in tables {
        local_db.exec_safe(&format!(
            "DROP TABLE \"{table}\"",
            table = crate::util::escape_ident(&table)
        ))?;
    }

    Ok(ResultCode::OK)
}

// TODO: we could potentially track renames...
fn maybe_modify_table(
    local_db: *mut sqlite3,
    table: &str,
    mem_db: &ManagedConnection,
) -> Result<ResultCode, ResultCode> {
    let mut local_columns = BTreeSet::new();
    let mut mem_columns = BTreeSet::new();

    let sql = "SELECT name FROM pragma_table_info(?)";
    let local_stmt = local_db.prepare_v2(sql)?;
    let mem_stmt = mem_db.prepare_v2(sql)?;
    local_stmt.bind_text(1, table, sqlite::Destructor::STATIC)?;
    mem_stmt.bind_text(1, table, sqlite::Destructor::STATIC)?;

    while mem_stmt.step()? == ResultCode::ROW {
        mem_columns.insert(mem_stmt.column_text(0)?.to_string());
    }

    let mut removed_columns: Vec<String> = vec![];
    let mut added_columns: Vec<String> = vec![];

    while local_stmt.step()? == ResultCode::ROW {
        let col_name = local_stmt.column_text(0)?;
        local_columns.insert(col_name.to_string());
        if !mem_columns.contains(col_name) {
            removed_columns.push(col_name.to_string());
        }
    }

    for mem_col in mem_columns {
        if !local_columns.contains(&mem_col) {
            added_columns.push(mem_col);
        }
    }

    let is_a_crr = crate::is_crr(local_db, table)?;
    if is_a_crr {
        let stmt = local_db.prepare_v2("SELECT crsql_begin_alter(?)")?;
        stmt.bind_text(1, table, sqlite::Destructor::STATIC)?;
        stmt.step()?;
    }

    drop_columns(local_db, table, removed_columns)?;
    add_columns(local_db, table, added_columns, mem_db)?;
    maybe_update_indices(local_db, table, mem_db)?;

    if is_a_crr {
        let stmt = local_db.prepare_v2("SELECT crsql_commit_alter(?)")?;
        stmt.bind_text(1, table, sqlite::Destructor::STATIC)?;
        stmt.step()?;
    }

    Ok(ResultCode::OK)
}

fn drop_columns(
    local_db: *mut sqlite3,
    table: &str,
    columns: Vec<String>,
) -> Result<ResultCode, ResultCode> {
    local_db.exec_safe(&format!(
        "DROP VIEW IF EXISTS \"{table}_fractindex\"",
        table = crate::util::escape_ident(table)
    ))?;
    for col in columns {
        local_db.exec_safe(&format!(
            "ALTER TABLE \"{table}\" DROP \"{column}\"",
            table = crate::util::escape_ident(table),
            column = crate::util::escape_ident(&col)
        ))?;
    }

    Ok(ResultCode::OK)
}

fn add_columns(
    local_db: *mut sqlite3,
    table: &str,
    columns: Vec<String>,
    mem_db: &ManagedConnection,
) -> Result<ResultCode, ResultCode> {
    if columns.is_empty() {
        return Ok(ResultCode::OK);
    }
    let sql = format!(
        "SELECT name, type, \"notnull\", dflt_value, pk FROM pragma_table_info(?) WHERE name IN ({qs})",
        qs = columns.iter().map(|_| "?").collect::<Vec<_>>().join(", "),
    );
    let stmt = mem_db.prepare_v2(&sql)?;
    stmt.bind_text(1, table, sqlite::Destructor::STATIC)?;
    let mut b = 2;
    for col in &columns {
        stmt.bind_text(b, &col, sqlite::Destructor::STATIC)?;
        b += 1;
    }

    let mut processed_cols = 0;
    while stmt.step()? == ResultCode::ROW {
        let is_pk = stmt.column_int(4) == 1;

        if is_pk {
            // We do not support adding PK columns to existing tables in auto-migration
            return Err(ResultCode::MISUSE);
        }

        let name = stmt.column_text(0)?;
        let col_type = stmt.column_text(1)?;
        let notnull = stmt.column_int(2) == 1;
        let dflt_val = stmt.column_value(3)?;

        add_column(local_db, table, name, col_type, notnull, dflt_val)?;
        processed_cols += 1;
    }
    if processed_cols != columns.len() {
        return Err(ResultCode::ERROR_MISSING_COLLSEQ);
    }

    Ok(ResultCode::OK)
}

fn add_column(
    local_db: *mut sqlite3,
    table: &str,
    name: &str,
    col_type: &str,
    notnull: bool,
    dflt_val: *mut sqlite::value,
) -> Result<ResultCode, ResultCode> {
    // ideally we'd extract out the SQL for the specific column
    // so we can get all constraints
    // as it is now, we don't support many things in auto-migration
    let dflt_val_str = if dflt_val.value_type() == ColumnType::Null {
        String::from("")
    } else {
        format!("DEFAULT {}", dflt_val.text())
    };

    local_db.exec_safe(&format!(
        "ALTER TABLE \"{table}\" ADD COLUMN \"{name}\" {col_type} {notnull} {dflt
```

### Core Architecture Module: `core/rs/core/src/backfill.rs`
```
use sqlite_nostd::{sqlite3, Connection, Destructor, ManagedStmt, ResultCode};
extern crate alloc;
use crate::tableinfo::ColumnInfo;
use crate::util::get_dflt_value;
use alloc::format;
use alloc::string::String;
use alloc::{vec, vec::Vec};
use sqlite_nostd as sqlite;

/**
 * Backfills rows in a table with clock values.
 */
pub fn backfill_table(
    db: *mut sqlite3,
    table: &str,
    pk_cols: &Vec<ColumnInfo>,
    non_pk_cols: &Vec<ColumnInfo>,
    is_commit_alter: bool,
    no_tx: bool,
) -> Result<ResultCode, ResultCode> {
    if !no_tx {
        db.exec_safe("SAVEPOINT backfill")?;
    }

    let sql = format!(
        "SELECT {pk_cols} FROM \"{table}\" AS t1
        EXCEPT SELECT {pk_cols} FROM \"{table}__crsql_pks\" AS t2",
        table = crate::util::escape_ident(table),
        pk_cols = pk_cols
            .iter()
            .map(|f| format!("\"{}\"", crate::util::escape_ident(&f.name)))
            .collect::<Vec<_>>()
            .join(", "),
    );
    let stmt = db.prepare_v2(&sql);

    let non_pk_cols_refs = non_pk_cols.iter().collect::<Vec<_>>();
    let result = match stmt {
        Ok(stmt) => create_clock_rows_from_stmt(
            stmt,
            db,
            table,
            pk_cols,
            &non_pk_cols_refs,
            is_commit_alter,
        ),
        Err(e) => Err(e),
    };

    if let Err(e) = result {
        if !no_tx {
            db.exec_safe("ROLLBACK")?;
        }

        return Err(e);
    }

    if let Err(e) = backfill_missing_columns(db, table, pk_cols, non_pk_cols, is_commit_alter) {
        if !no_tx {
            db.exec_safe("ROLLBACK")?;
        }

        return Err(e);
    }

    if !no_tx {
        db.exec_safe("RELEASE backfill")
    } else {
        Ok(ResultCode::OK)
    }
}

/**
* Given a statement that returns rows in the source table not present
* in the clock table, create those rows in the clock table.
*/
fn create_clock_rows_from_stmt(
    read_stmt: ManagedStmt,
    db: *mut sqlite3,
    table: &str,
    pk_cols: &Vec<ColumnInfo>,
    non_pk_cols: &Vec<&ColumnInfo>,
    is_commit_alter: bool,
) -> Result<ResultCode, ResultCode> {
    let select_key = db.prepare_v2(&format!(
        "SELECT __crsql_key FROM \"{table}__crsql_pks\" WHERE {pk_where_conditions}",
        table = crate::util::escape_ident(table),
        pk_where_conditions = crate::util::where_list(pk_cols, None)?
    ))?;
    let create_key = db.prepare_v2(&format!(
        "INSERT INTO \"{table}__crsql_pks\" ({pk_cols}) VALUES ({pk_values}) RETURNING __crsql_key",
        table = crate::util::escape_ident(table),
        pk_cols = pk_cols
            .iter()
            .map(|f| format!("\"{}\"", crate::util::escape_ident(&f.name)))
            .collect::<Vec<_>>()
            .join(", "),
        pk_values = pk_cols.iter().map(|_| "?").collect::<Vec<_>>().join(", "),
    ))?;
    // We do not grab nextdbversion on migration.
    // The idea is that other nodes will apply the same migration
    // in the future so if they have already seen this node up
    // to the current db version then the migration will place them into the correct
    // state. No need to re-sync post migration.
    // or-ignore since we do not drop sentinel values during compaction as they act as our metadata
    // to determine if rows should resurrect on a future insertion event provided by a peer.
    let sql = format!(
        "INSERT OR IGNORE INTO \"{table}__crsql_clock\"
          (key, col_name, col_version, db_version, seq) VALUES
          (?, ?, 1, {dbversion_getter}, crsql_increment_and_get_seq())",
        table = crate::util::escape_ident(table),
        dbversion_getter = if is_commit_alter {
            "crsql_db_version()"
        } else {
            "crsql_next_db_version()"
        }
    );
    let write_stmt = db.prepare_v2(&sql)?;

    while read_stmt.step()? == ResultCode::ROW {
        let key = get_or_create_key(&select_key, &create_key, pk_cols, &read_stmt)?;
        write_stmt.bind_int64(1, key)?;

        for col in non_pk_cols.iter() {
            // We even backfill default values since we can't differentiate between an explicit
            // reset to a default vs an implicit set to default on create. Do we? I don't think we do set defaults.
            write_stmt.bind_text(2, &col.name, Destructor::STATIC)?;
            write_stmt.step()?;
            write_stmt.reset()?;
        }
        if non_pk_cols.len() == 0 {
            write_stmt.bind_text(2, crate::c::INSERT_SENTINEL, Destructor::STATIC)?;
            write_stmt.step()?;
            write_stmt.reset()?;
        }
    }

    Ok(ResultCode::OK)
}

fn get_or_create_key(
    select_stmt: &ManagedStmt,
    create_stmt: &ManagedStmt,
    pk_cols: &Vec<ColumnInfo>,
    read_stmt: &ManagedStmt,
) -> Result<sqlite::int64, ResultCode> {
    for (i, _name) in pk_cols.iter().enumerate() {
        let value = read_stmt.column_value(i as i32)?;
        // TODO: ok to bind into to places at once?
        select_stmt.bind_value(i as i32 + 1, value)?;
        create_stmt.bind_value(i as i32 + 1, value)?;
    }

    if let Ok(ResultCode::ROW) = select_stmt.step() {
        let key = select_stmt.column_int64(0);
        create_stmt.clear_bindings()?;
        select_stmt.reset()?;
        return Ok(key);
    }
    select_stmt.reset()?;

    if let Ok(ResultCode::ROW) = create_stmt.step() {
        let key = create_stmt.column_int64(0);
        create_stmt.reset()?;
        return Ok(key);
    }
    create_stmt.reset()?;

    return Err(ResultCode::ERROR);
}

/**
* For each column, make sure there was a clock table entry.
* If not, fill the data in for it for each row.
*
* Can we optimize and skip cases where it is equivalent to the default value?
* E.g., adding a new column set to default values should not require a backfill...
*/
fn backfill_missing_columns(
    db: *mut sqlite3,
    table: &str,
    pk_cols: &Vec<ColumnInfo>,
    non_pk_cols: &Vec<ColumnInfo>,
    is_commit_alter: bool,
) -> Result<ResultCode, ResultCode> {
    for non_pk_col in non_pk_cols {
        fill_column(db, table, pk_cols, &non_pk_col, is_commit_alter)?;
    }

    Ok(ResultCode::OK)
}

// This doesn't fill compeltely new columns...
// Wel... does it not? The on condition x left join should do it.
fn fill_column(
    db: *mut sqlite3,
    table: &str,
    pk_cols: &Vec<ColumnInfo>,
    non_pk_col: &ColumnInfo,
    is_commit_alter: bool,
) -> Result<ResultCode, ResultCode> {
    // Only fill rows for which
    // - a row does not exist for that pk combo _and_ the cid in the clock table.
    // - the value is not the default value for that column.
    let dflt_value = get_dflt_value(db, table, &non_pk_col.name)?;
    let sql = format!(
        "SELECT {pk_cols} FROM {table} as t1
          JOIN \"{table}__crsql_pks\" as t2 ON {pk_on_conditions}
          LEFT JOIN \"{table}__crsql_clock\" as t3 ON t3.key = t2.__crsql_key AND t3.col_name = ?
          WHERE t3.key IS NULL {dflt_value_condition}",
        table = crate::util::escape_ident(table),
        pk_cols = pk_cols
            .iter()
            .map(|f| format!("t1.\"{}\"", crate::util::escape_ident(&f.name)))
            .collect::<Vec<_>>()
            .join(", "),
        pk_on_conditions = pk_cols
            .iter()
            .map(|f| format!(
                "t1.\"{}\" = t2.\"{}\"",
                crate::util::escape_ident(&f.name),
                crate::util::escape_ident(&f.name)
            ))
            .collect::<Vec<_>>()
            .join(" AND "),
        dflt_value_condition = if let Some(dflt) = dflt_value {
            format!("AND t1.\"{}\" IS NOT {}", &non_pk_col.name, dflt)
        } else {
            String::from("")
        },
    );
    let read_stmt = db.prepare_v2(&sql)?;
    read_stmt.bind_text(1, &non_pk_col.name, Destructor::STATIC)?;

    // TODO: rm clone?
    let non_pk_cols = vec![non_pk_col];
    create_clock_rows_from_stmt(read_stmt, db, table, pk_cols, &non_pk_cols, is_commit_alter)
}

```

### Core Architecture Module: `core/rs/core/src/bootstrap.rs`
```
use core::ffi::{c_char, c_int};

use crate::{consts, tableinfo::TableInfo};
use alloc::{ffi::CString, format};
use core::slice;
use sqlite::{sqlite3, Connection, Destructor, ResultCode};
use sqlite_nostd as sqlite;

fn uuid() -> [u8; 16] {
    let mut blob: [u8; 16] = [0; 16];
    sqlite::randomness(&mut blob);
    blob[6] = (blob[6] & 0x0f) + 0x40;
    blob[8] = (blob[8] & 0x3f) + 0x80;
    blob
}

#[no_mangle]
pub extern "C" fn crsql_init_site_id(db: *mut sqlite3, ret: *mut u8) -> c_int {
    let buffer: &mut [u8] = unsafe { slice::from_raw_parts_mut(ret, 16) };
    if let Ok(site_id) = init_site_id(db) {
        buffer.copy_from_slice(&site_id);
        ResultCode::OK as c_int
    } else {
        ResultCode::ERROR as c_int
    }
}

fn insert_site_id(db: *mut sqlite3) -> Result<[u8; 16], ResultCode> {
    let stmt = db.prepare_v2(&format!(
        "INSERT INTO \"{tbl}\" (site_id, ordinal) VALUES (?, 0)",
        tbl = consts::TBL_SITE_ID
    ))?;

    let site_id = uuid();
    stmt.bind_blob(1, &site_id, Destructor::STATIC)?;
    stmt.step()?;

    Ok(site_id)
}

fn create_site_id_and_site_id_table(db: *mut sqlite3) -> Result<[u8; 16], ResultCode> {
    db.exec_safe(&format!(
        "CREATE TABLE \"{tbl}\" (site_id BLOB NOT NULL, ordinal INTEGER PRIMARY KEY);
        CREATE UNIQUE INDEX {tbl}_site_id ON \"{tbl}\" (site_id);",
        tbl = consts::TBL_SITE_ID
    ))?;

    insert_site_id(db)
}

#[no_mangle]
pub extern "C" fn crsql_init_peer_tracking_table(db: *mut sqlite3) -> c_int {
    match db.exec_safe("CREATE TABLE IF NOT EXISTS crsql_tracked_peers (\"site_id\" BLOB NOT NULL, \"version\" INTEGER NOT NULL, \"seq\" INTEGER DEFAULT 0, \"tag\" INTEGER, \"event\" INTEGER, PRIMARY KEY (\"site_id\", \"tag\", \"event\")) STRICT;") {
      Ok(_) => ResultCode::OK as c_int,
      Err(code) => code as c_int
    }
}

fn has_table(db: *mut sqlite3, table_name: &str) -> Result<bool, ResultCode> {
    let stmt =
        db.prepare_v2("SELECT 1 FROM sqlite_master WHERE type = 'table' AND tbl_name = ?")?;
    stmt.bind_text(1, table_name, Destructor::STATIC)?;
    let tbl_exists_result = stmt.step()?;
    Ok(tbl_exists_result == ResultCode::ROW)
}

/**
 * Loads the siteId into memory. If a site id
 * cannot be found for the given database one is created
 * and saved to the site id table.
 */
fn init_site_id(db: *mut sqlite3) -> Result<[u8; 16], ResultCode> {
    if !has_table(db, consts::TBL_SITE_ID)? {
        return create_site_id_and_site_id_table(db);
    }

    let stmt = db.prepare_v2(&format!(
        "SELECT site_id FROM \"{}\" WHERE ordinal = 0",
        consts::TBL_SITE_ID
    ))?;
    let result_code = stmt.step()?;

    let ret = if result_code == ResultCode::DONE {
        insert_site_id(db)?
    } else {
        let site_id_from_table = stmt.column_blob(0)?;
        site_id_from_table.try_into()?
    };

    Ok(ret)
}

fn crsql_create_schema_table_if_not_exists(db: *mut sqlite3) -> Result<ResultCode, ResultCode> {
    db.exec_safe("SAVEPOINT crsql_create_schema_table;")?;

    if let Ok(_) = db.exec_safe(&format!(
        "CREATE TABLE IF NOT EXISTS \"{}\" (\"key\" TEXT PRIMARY KEY, \"value\" ANY);",
        consts::TBL_SCHEMA
    )) {
        db.exec_safe("RELEASE crsql_create_schema_table;")
    } else {
        let _ = db.exec_safe("ROLLBACK");
        Err(ResultCode::ERROR)
    }
}

#[no_mangle]
pub extern "C" fn crsql_maybe_update_db(db: *mut sqlite3, err_msg: *mut *mut c_char) -> c_int {
    // No schema table? First time this DB has been opened with this extension.
    if let Ok(has_schema_table) = has_table(db, consts::TBL_SCHEMA) {
        if let Err(code) = crsql_create_schema_table_if_not_exists(db) {
            return code as c_int;
        }
        let r = db.exec_safe("SAVEPOINT crsql_maybe_update_db;");
        if let Err(code) = r {
            return code as c_int;
        }
        if let Ok(_) = maybe_update_db_inner(db, has_schema_table == false, err_msg) {
            let _ = db.exec_safe("RELEASE crsql_maybe_update_db;");
            return ResultCode::OK as c_int;
        } else {
            let _ = db.exec_safe("ROLLBACK;");
            return ResultCode::ERROR as c_int;
        }
    } else {
        return ResultCode::ERROR as c_int;
    }
}

fn maybe_update_db_inner(
    db: *mut sqlite3,
    is_blank_slate: bool,
    err_msg: *mut *mut c_char,
) -> Result<ResultCode, ResultCode> {
    let mut recorded_version: i32 = 0;

    // Completely new DBs need no migrations.
    // We can set them to the current version.
    if is_blank_slate {
        recorded_version = consts::CRSQLITE_VERSION;
    } else {
        let stmt =
            db.prepare_v2("SELECT value FROM crsql_master WHERE key = 'crsqlite_version'")?;
        let step_result = stmt.step()?;
        if step_result == ResultCode::ROW {
            recorded_version = stmt.column_int(0);
        }
    }

    if recorded_version < consts::CRSQLITE_VERSION_0_15_0 && !is_blank_slate {
        // todo: return an error message to the user that their version is
        // not supported
        let cstring = CString::new(format!("Opening a db created with cr-sqlite version {} is not supported. Upcoming release 0.15.0 is a breaking change.", recorded_version))?;
        unsafe {
            (*err_msg) = cstring.into_raw();
            return Err(ResultCode::ERROR);
        }
    }

    // if recorded_version < consts::CRSQLITE_VERSION_0_13_0 {
    //     update_to_0_13_0(db)?;
    // }

    // if recorded_version < consts::CRSQLITE_VERSION_0_15_0 {
    //     update_to_0_15_0(db)?;
    // }

    // write the db version if we migrated to a new one or we are a blank slate db
    if recorded_version < consts::CRSQLITE_VERSION || is_blank_slate {
        let stmt =
            db.prepare_v2("INSERT OR REPLACE INTO crsql_master VALUES ('crsqlite_version', ?)")?;
        stmt.bind_int(1, consts::CRSQLITE_VERSION)?;
        stmt.step()?;
    }

    Ok(ResultCode::OK)
}

/**
 * The clock table holds the versions for each column of a given row.
 *
 * These version are set to the dbversion at the time of the write to the
 * column.
 *
 * The dbversion is updated on transaction commit.
 * This allows us to find all columns written in the same transaction
 * albeit with caveats.
 *
 * The caveats being that two partiall overlapping transactions will
 * clobber the full transaction picture given we only keep latest
 * state and not a full causal history.
 *
 * @param tableInfo
 */
pub fn create_clock_table(
    db: *mut sqlite3,
    table_info: &TableInfo,
    _err: *mut *mut c_char,
) -> Result<ResultCode, ResultCode> {
    let pk_list = crate::util::as_identifier_list(&table_info.pks, None)?;
    let table_name = &table_info.tbl_name;

    db.exec_safe(&format!(
        "CREATE TABLE IF NOT EXISTS \"{table_name}__crsql_clock\" (
      key INTEGER NOT NULL,
      col_name TEXT NOT NULL,
      col_version INTEGER NOT NULL,
      db_version INTEGER NOT NULL,
      site_id INTEGER NOT NULL DEFAULT 0,
      seq INTEGER NOT NULL,
      PRIMARY KEY (key, col_name)
    ) WITHOUT ROWID, STRICT",
        table_name = crate::util::escape_ident(table_name),
    ))?;

    db.exec_safe(
      &format!(
        "CREATE INDEX IF NOT EXISTS \"{table_name}__crsql_clock_dbv_idx\" ON \"{table_name}__crsql_clock\" (\"db_version\")",
        table_name = crate::util::escape_ident(table_name),
      ))?;
    db.exec_safe(
      &format!(
        "CREATE TABLE IF NOT EXISTS \"{table_name}__crsql_pks\" (__crsql_key INTEGER PRIMARY KEY, {pk_list})",
        table_name = table_name,
        pk_list = pk_list,
      )
    )?;
    db.exec_safe(
      &format!(
        "CREATE UNIQUE INDEX IF NOT EXISTS \"{table_name}__crsql_pks_pks\" ON \"{table_name}__crsql_pks\" ({pk_list})",
        table_name = table_name,
        pk_list = pk_list
      )
    )
}

```

### Core Architecture Module: `core/rs/core/src/c.rs`
```
extern crate alloc;
use core::ffi::{c_char, c_int};
#[cfg(not(feature = "std"))]
use num_derive::FromPrimitive;

// Structs that still exist in C but will eventually be moved to Rust
// As well as functions re-defined in Rust but not yet deleted from C
use sqlite_nostd as sqlite;

pub static INSERT_SENTINEL: &str = "-1";
pub static DELETE_SENTINEL: &str = "-1";
pub static DB_VERSION_SCHEMA_VERSION: c_int = 0;
pub static TABLE_INFO_SCHEMA_VERSION: c_int = 1;

#[derive(FromPrimitive, PartialEq, Debug)]
pub enum CrsqlChangesColumn {
    Tbl = 0,
    Pk = 1,
    Cid = 2,
    Cval = 3,
    ColVrsn = 4,
    DbVrsn = 5,
    SiteId = 6,
    Cl = 7,
    Seq = 8,
}

#[derive(FromPrimitive, PartialEq, Debug)]
pub enum ClockUnionColumn {
    Tbl = 0,
    Pks = 1,
    Cid = 2,
    ColVrsn = 3,
    DbVrsn = 4,
    SiteId = 5,
    RowId = 6,
    Seq = 7,
    Cl = 8,
}

#[derive(FromPrimitive, PartialEq, Debug)]
pub enum ChangeRowType {
    Update = 0,
    Delete = 1,
    PkOnly = 2,
}

#[repr(C)]
#[allow(non_snake_case, non_camel_case_types)]
#[derive(Debug, Copy, Clone)]
pub struct crsql_ExtData {
    pub pPragmaSchemaVersionStmt: *mut sqlite::stmt,
    pub pPragmaDataVersionStmt: *mut sqlite::stmt,
    pub pragmaDataVersion: ::core::ffi::c_int,
    pub dbVersion: sqlite::int64,
    pub pendingDbVersion: sqlite::int64,
    pub pragmaSchemaVersion: ::core::ffi::c_int,
    pub updatedTableInfosThisTx: ::core::ffi::c_int,
    pub pragmaSchemaVersionForTableInfos: ::core::ffi::c_int,
    pub siteId: *mut ::core::ffi::c_uchar,
    pub pDbVersionStmt: *mut sqlite::stmt,
    pub tableInfos: *mut ::core::ffi::c_void,
    pub rowsImpacted: ::core::ffi::c_int,
    pub seq: ::core::ffi::c_int,
    pub pSetSyncBitStmt: *mut sqlite::stmt,
    pub pClearSyncBitStmt: *mut sqlite::stmt,
    pub pSetSiteIdOrdinalStmt: *mut sqlite::stmt,
    pub pSelectSiteIdOrdinalStmt: *mut sqlite::stmt,
    pub pSelectClockTablesStmt: *mut sqlite::stmt,
    pub mergeEqualValues: ::core::ffi::c_int,
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
#[allow(non_snake_case, non_camel_case_types)]
pub struct crsql_Changes_vtab {
    pub base: sqlite::vtab,
    pub db: *mut sqlite::sqlite3,
    pub pExtData: *mut crsql_ExtData,
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
#[allow(non_snake_case, non_camel_case_types)]
pub struct crsql_Changes_cursor {
    pub base: sqlite::vtab_cursor,
    pub pTab: *mut crsql_Changes_vtab,
    pub pChangesStmt: *mut sqlite::stmt,
    pub pRowStmt: *mut sqlite::stmt,
    pub dbVersion: sqlite::int64,
    pub rowType: ::core::ffi::c_int,
    pub changesRowid: sqlite::int64,
    pub tblInfoIdx: ::core::ffi::c_int,
}

extern "C" {
    pub fn crsql_fetchPragmaSchemaVersion(
        db: *mut sqlite::sqlite3,
        pExtData: *mut crsql_ExtData,
        which: c_int,
    ) -> c_int;
    pub fn crsql_fetchPragmaDataVersion(
        db: *mut sqlite::sqlite3,
        pExtData: *mut crsql_ExtData,
    ) -> c_int;
    pub fn crsql_newExtData(
        db: *mut sqlite::sqlite3,
        siteIdBuffer: *mut c_char,
    ) -> *mut crsql_ExtData;
    pub fn crsql_freeExtData(pExtData: *mut crsql_ExtData);
    pub fn crsql_finalize(pExtData: *mut crsql_ExtData);
}

#[test]
#[allow(non_snake_case, non_camel_case_types)]
fn bindgen_test_layout_crsql_Changes_vtab() {
    const UNINIT: ::core::mem::MaybeUninit<crsql_Changes_vtab> = ::core::mem::MaybeUninit::uninit();
    let ptr = UNINIT.as_ptr();
    assert_eq!(
        ::core::mem::size_of::<crsql_Changes_vtab>(),
        40usize,
        concat!("Size of: ", stringify!(crsql_Changes_vtab))
    );
    assert_eq!(
        ::core::mem::align_of::<crsql_Changes_vtab>(),
        8usize,
        concat!("Alignment of ", stringify!(crsql_Changes_vtab))
    );
    assert_eq!(
        unsafe { ::core::ptr::addr_of!((*ptr).base) as usize - ptr as usize },
        0usize,
        concat!(
            "Offset of field: ",
            stringify!(crsql_Changes_vtab),
            "::",
            stringify!(base)
        )
    );
    assert_eq!(
        unsafe { ::core::ptr::addr_of!((*ptr).db) as usize - ptr as usize },
        24usize,
        concat!(
            "Offset of field: ",
            stringify!(crsql_Changes_vtab),
            "::",
            stringify!(db)
        )
    );
    assert_eq!(
        unsafe { ::core::ptr::addr_of!((*ptr).pExtData) as usize - ptr as usize },
        32usize,
        concat!(
            "Offset of field: ",
            stringify!(crsql_Changes_vtab),
            "::",
            stringify!(pExtData)
        )
    );
}

#[test]
#[allow(non_snake_case)]
fn bindgen_test_layout_crsql_Changes_cursor() {
    const UNINIT: ::core::mem::MaybeUninit<crsql_Changes_cursor> =
        ::core::mem::MaybeUninit::uninit();
    let ptr = UNINIT.as_ptr();
    assert_eq!(
        ::core::mem::size_of::<crsql_Changes_cursor>(),
        64usize,
        concat!("Size of: ", stringify!(crsql_Changes_cursor))
    );
    assert_eq!(
        ::core::mem::align_of::<crsql_Changes_cursor>(),
        8usize,
        concat!("Alignment of ", stringify!(crsql_Changes_cursor))
    );
    assert_eq!(
        unsafe { ::core::ptr::addr_of!((*ptr).base) as usize - ptr as usize },
        0usize,
        concat!(
            "Offset of field: ",
            stringify!(crsql_Changes_cursor),
            "::",
            stringify!(base)
        )
    );
    assert_eq!(
        unsafe { ::core::ptr::addr_of!((*ptr).pTab) as usize - ptr as usize },
        8usize,
        concat!(
            "Offset of field: ",
            stringify!(crsql_Changes_cursor),
            "::",
            stringify!(pTab)
        )
    );
    assert_eq!(
        unsafe { ::core::ptr::addr_of!((*ptr).pChangesStmt) as usize - ptr as usize },
        16usize,
        concat!(
            "Offset of field: ",
            stringify!(crsql_Changes_cursor),
            "::",
            stringify!(pChangesStmt)
        )
    );
    assert_eq!(
        unsafe { ::core::ptr::addr_of!((*ptr).pRowStmt) as usize - ptr as usize },
        24usize,
        concat!(
            "Offset of field: ",
            stringify!(crsql_Changes_cursor),
            "::",
            stringify!(pRowStmt)
        )
    );
    assert_eq!(
        unsafe { ::core::ptr::addr_of!((*ptr).dbVersion) as usize - ptr as usize },
        32usize,
        concat!(
            "Offset of field: ",
            stringify!(crsql_Changes_cursor),
            "::",
            stringify!(dbVersion)
        )
    );
    assert_eq!(
        unsafe { ::core::ptr::addr_of!((*ptr).rowType) as usize - ptr as usize },
        40usize,
        concat!(
            "Offset of field: ",
            stringify!(crsql_Changes_cursor),
            "::",
            stringify!(rowType)
        )
    );
    assert_eq!(
        unsafe { ::core::ptr::addr_of!((*ptr).changesRowid) as usize - ptr as usize },
        48usize,
        concat!(
            "Offset of field: ",
            stringify!(crsql_Changes_cursor),
            "::",
            stringify!(changesRowid)
        )
    );
    assert_eq!(
        unsafe { ::core::ptr::addr_of!((*ptr).tblInfoIdx) as usize - ptr as usize },
        56usize,
        concat!(
            "Offset of field: ",
            stringify!(crsql_Changes_cursor),
            "::",
            stringify!(tblInfoIdx)
        )
    );
}

#[test]
#[allow(non_snake_case)]
fn bindgen_test_layout_crsql_ExtData() {
    const UNINIT: ::core::mem::MaybeUninit<crsql_ExtData> = ::core::mem::MaybeUninit::uninit();
    let ptr = UNINIT.as_ptr();
    assert_eq!(
        ::core::mem::size_of::<crsql_ExtData>(),
        136usize,
        concat!("Size of: ", stringify!(crsql_ExtData))
    );
    assert_eq!(
        ::core::mem::align_of::<crsql_ExtData>(),
        8usize,
        concat!("Alignment of ", stringify!(crsql_ExtData))
    );
    assert_eq!(
        unsafe { ::core::ptr::addr_of!((*ptr).pPragmaSchemaVersionStmt) as usize - ptr as usize },
        0usize,
        concat!(
            "Offset of field: ",
            stringify!(crsql_ExtData),
            "::",
            stringify!(pPragmaSchemaVersionStmt)
        )
    );
    assert_eq!(
        unsafe { ::core::ptr::addr_of!((*ptr).pPragmaDataVersionStmt) as usize - ptr as usize },
        8usize,
        concat!(
            "Offset of field: ",
            stringify!(crsql_ExtData),
            "::",
            stringify!(pPragmaDataVersionStmt)
        )
    );
    assert_eq!(
        unsafe { ::core::ptr::addr_of!((*ptr).pragmaDataVersion) as usize - ptr as usize },
        16usize,
        concat!(
            "Offset of field: ",
            stringify!(crsql_ExtData),
            "::",
            stringify!(pragmaDataVersion)
        )
    );
    assert_eq!(
        unsafe { ::core::ptr::addr_of!((*ptr).dbVersion) as usize - ptr as usize },
        24usize,
        concat!(
            "Offset of field: ",
            stringify!(crsql_ExtData),
            "::",
            stringify!(dbVersion)
        )
    );
    assert_eq!(
        unsafe { ::core::ptr::addr_of!((*ptr).pendingDbVersion) as usize - ptr as usize },
        32usize,
        concat!(
            "Offset of field: ",
            stringify!(crsql_ExtData),
            "::",
            stringify!(pendingDbVersion)
        )
    );
    assert_eq!(
        unsafe { ::core::ptr::addr_of!((*ptr).pragmaSchemaVersion) as usize - ptr as usize },
        40usize,
        concat!(
            "Offset of field: ",
            stringify!(crsql_ExtData),
            "::",
            stringify!(pragmaSchemaVersion)
        )
    );
    assert_eq!(
        unsafe { ::core::ptr::addr_of!((*ptr).updatedTableInfosThisTx) as usize - ptr as usize },
        44usize,
        concat!(
            "Offset of field: ",
            stringify!(crsql_ExtData),
            "::",
            stringify!(updatedTableInfosThisTx)
        )
    );
    assert_eq!(
        unsafe {
            ::core::ptr::addr_of!((*ptr).pragmaSchemaVersionForTableInfos) as us
```

### Core Architecture Module: `core/rs/core/src/changes_vtab.rs`
```
extern crate alloc;
use crate::alloc::string::ToString;
use crate::changes_vtab_write::crsql_merge_insert;
use crate::stmt_cache::reset_cached_stmt;
use crate::tableinfo::{crsql_ensure_table_infos_are_up_to_date, TableInfo};
use alloc::boxed::Box;
use alloc::format;
use alloc::string::String;
use alloc::vec::Vec;
use core::ffi::{c_char, c_int, CStr};
use core::mem::{self, forget};
use core::ptr::null_mut;

use alloc::ffi::CString;
#[cfg(not(feature = "std"))]
use num_traits::FromPrimitive;
use sqlite::{ColumnType, Connection, Context, Stmt, Value};
use sqlite_nostd as sqlite;
use sqlite_nostd::ResultCode;

use crate::c::{
    crsql_Changes_cursor, crsql_Changes_vtab, ChangeRowType, ClockUnionColumn, CrsqlChangesColumn,
};
use crate::changes_vtab_read::changes_union_query;
use crate::pack_columns::bind_package_to_stmt;
use crate::pack_columns::unpack_columns;

fn changes_crsr_finalize(crsr: *mut crsql_Changes_cursor) -> c_int {
    // Assign pointers to null after freeing
    // since we can get into this twice for the same cursor object.
    unsafe {
        let mut rc = 0;
        rc += match (*crsr).pChangesStmt.finalize() {
            Ok(rc) => rc as c_int,
            Err(rc) => rc as c_int,
        };
        (*crsr).pChangesStmt = null_mut();
        let reset_rc = reset_cached_stmt((*crsr).pRowStmt);
        match reset_rc {
            Ok(r) | Err(r) => rc += r as c_int,
        }
        (*crsr).pRowStmt = null_mut();
        (*crsr).dbVersion = crate::consts::MIN_POSSIBLE_DB_VERSION;

        return rc;
    }
}

// A very c-style port. We can get more idiomatic once we finish the rust port and have test and perf parity
#[no_mangle]
pub unsafe extern "C" fn crsql_changes_best_index(
    vtab: *mut sqlite::vtab,
    index_info: *mut sqlite::index_info,
) -> c_int {
    match changes_best_index(vtab, index_info) {
        Ok(rc) => rc as c_int,
        Err(rc) => rc as c_int,
    }
}

fn changes_best_index(
    _vtab: *mut sqlite::vtab,
    index_info: *mut sqlite::index_info,
) -> Result<ResultCode, ResultCode> {
    let mut idx_num: i32 = 0;

    let mut first_constraint = true;
    let mut str = String::new();
    let constraints = sqlite::args!((*index_info).nConstraint, (*index_info).aConstraint);
    let constraint_usage =
        sqlite::args_mut!((*index_info).nConstraint, (*index_info).aConstraintUsage);
    let mut arg_v_index = 1;
    for (i, constraint) in constraints.iter().enumerate() {
        if !constraint_is_usable(constraint) {
            continue;
        }
        let col = CrsqlChangesColumn::from_i32(constraint.iColumn);
        if let Some(col_name) = get_clock_table_col_name(&col) {
            if let Some(op_string) = get_operator_string(constraint.op) {
                if first_constraint {
                    str.push_str("WHERE ");
                    first_constraint = false
                } else {
                    str.push_str(" AND ");
                }

                if constraint.op == sqlite::INDEX_CONSTRAINT_ISNOTNULL as u8
                    || constraint.op == sqlite::INDEX_CONSTRAINT_ISNULL as u8
                {
                    str.push_str(&format!("{} {}", col_name, op_string));
                    constraint_usage[i].argvIndex = 0;
                    constraint_usage[i].omit = 1;
                } else {
                    str.push_str(&format!("{} {} ?", col_name, op_string));
                    constraint_usage[i].argvIndex = arg_v_index;
                    constraint_usage[i].omit = 1;
                    arg_v_index += 1;
                }
            }
        }

        // idx bit mask
        match col {
            Some(CrsqlChangesColumn::DbVrsn) => idx_num |= 2,
            Some(CrsqlChangesColumn::SiteId) => idx_num |= 4,
            _ => {}
        }
    }

    let mut desc = 0;
    let order_bys = sqlite::args!((*index_info).nOrderBy, (*index_info).aOrderBy);
    let mut order_by_consumed = true;
    if order_bys.len() > 0 {
        str.push_str(" ORDER BY ");
    } else {
        // The user didn't provide an ordering? Tack on a default one that will
        // retrieve changes in-order
        str.push_str(" ORDER BY db_vrsn, seq ASC");
    }
    first_constraint = true;
    for order_by in order_bys {
        desc = order_by.desc;
        let col = CrsqlChangesColumn::from_i32(order_by.iColumn);
        if let Some(col_name) = get_clock_table_col_name(&col) {
            if first_constraint {
                first_constraint = false;
            } else {
                str.push_str(", ");
            }
            str.push_str(&col_name);
        } else {
            // TODO: test we're consuming
            order_by_consumed = false;
        }
    }

    if order_bys.len() > 0 {
        if desc != 0 {
            str.push_str(" DESC");
        } else {
            str.push_str(" ASC");
        }
    }

    // manual null-term since we'll pass to C
    str.push('\0');

    // TODO: update your order by py test to explain query plans to ensure correct indices are selected
    // both constraints are present. Also to check that order by is consumed.
    if idx_num & 6 == 6 {
        unsafe {
            (*index_info).estimatedCost = 1.0;
            (*index_info).estimatedRows = 1;
        }
    }
    // only the version constraint is present
    else if idx_num & 2 == 2 {
        unsafe {
            (*index_info).estimatedCost = 10.0;
            (*index_info).estimatedRows = 10;
        }
    }
    // only the requestor constraint is present
    else if idx_num & 4 == 4 {
        unsafe {
            (*index_info).estimatedCost = 2147483647.0;
            (*index_info).estimatedRows = 2147483647;
        }
    }
    // no constraints are present
    else {
        unsafe {
            (*index_info).estimatedCost = 2147483647.0;
            (*index_info).estimatedRows = 2147483647;
        }
    }

    unsafe {
        (*index_info).idxNum = idx_num;
        (*index_info).orderByConsumed = if order_by_consumed { 1 } else { 0 };
        // forget str
        let (ptr, _, _) = str.into_raw_parts();
        // pass to c. We've manually null terminated the string.
        // sqlite will free it for us.
        (*index_info).idxStr = ptr as *mut c_char;
        (*index_info).needToFreeIdxStr = 1;
    }

    Ok(ResultCode::OK)
}

fn constraint_is_usable(constraint: &sqlite::index_constraint) -> bool {
    if constraint.usable == 0 {
        return false;
    }
    if let Some(col) = CrsqlChangesColumn::from_i32(constraint.iColumn) {
        match col {
            CrsqlChangesColumn::Tbl | CrsqlChangesColumn::Pk | CrsqlChangesColumn::Cval => false,
            _ => true,
        }
    } else {
        false
    }
}

// Note: this is really the col name post-select from the clock table.
fn get_clock_table_col_name(col: &Option<CrsqlChangesColumn>) -> Option<String> {
    match col {
        Some(CrsqlChangesColumn::Tbl) => Some("tbl".to_string()),
        Some(CrsqlChangesColumn::Pk) => Some("pks".to_string()),
        Some(CrsqlChangesColumn::Cid) => Some("cid".to_string()),
        Some(CrsqlChangesColumn::Cval) => None,
        Some(CrsqlChangesColumn::ColVrsn) => Some("col_vrsn".to_string()),
        Some(CrsqlChangesColumn::DbVrsn) => Some("db_vrsn".to_string()),
        Some(CrsqlChangesColumn::SiteId) => Some("site_id".to_string()),
        Some(CrsqlChangesColumn::Seq) => Some("seq".to_string()),
        Some(CrsqlChangesColumn::Cl) => Some("cl".to_string()),
        None => None,
    }
}

fn get_operator_string(op: u8) -> Option<String> {
    // TODO: convert to proper enum
    match op as u32 {
        sqlite::INDEX_CONSTRAINT_EQ => Some("=".to_string()),
        sqlite::INDEX_CONSTRAINT_GT => Some(">".to_string()),
        sqlite::INDEX_CONSTRAINT_LE => Some("<=".to_string()),
        sqlite::INDEX_CONSTRAINT_LT => Some("<".to_string()),
        sqlite::INDEX_CONSTRAINT_GE => Some(">=".to_string()),
        sqlite::INDEX_CONSTRAINT_MATCH => Some("MATCH".to_string()),
        sqlite::INDEX_CONSTRAINT_LIKE => Some("LIKE".to_string()),
        sqlite::INDEX_CONSTRAINT_GLOB => Some("GLOB".to_string()),
        sqlite::INDEX_CONSTRAINT_REGEXP => Some("REGEXP".to_string()),
        sqlite::INDEX_CONSTRAINT_NE => Some("!=".to_string()),
        sqlite::INDEX_CONSTRAINT_ISNOT => Some("IS NOT".to_string()),
        sqlite::INDEX_CONSTRAINT_ISNOTNULL => Some("IS NOT NULL".to_string()),
        sqlite::INDEX_CONSTRAINT_ISNULL => Some("IS NULL".to_string()),
        sqlite::INDEX_CONSTRAINT_IS => Some("IS".to_string()),
        _ => None,
    }
}

// This'll become safe once more code is moved over to Rust
#[no_mangle]
pub unsafe extern "C" fn crsql_changes_filter(
    cursor: *mut sqlite::vtab_cursor,
    _idx_num: c_int,
    idx_str: *const c_char,
    argc: c_int,
    argv: *mut *mut sqlite::value,
) -> c_int {
    let args = sqlite::args!(argc, argv);
    let cursor = cursor.cast::<crsql_Changes_cursor>();
    let idx_str = unsafe { CStr::from_ptr(idx_str).to_str() };
    match idx_str {
        Ok(idx_str) => match changes_filter(cursor, idx_str, args) {
            Err(rc) | Ok(rc) => rc as c_int,
        },
        Err(_) => ResultCode::FORMAT as c_int,
    }
}

unsafe fn changes_filter(
    cursor: *mut crsql_Changes_cursor,
    idx_str: &str,
    args: &[*mut sqlite::value],
) -> Result<ResultCode, ResultCode> {
    let tab = (*cursor).pTab;
    let db = (*tab).db;
    // This should never happen. pChangesStmt should be finalized
    // before filter is ever invoked.
    if !(*cursor).pChangesStmt.is_null() {
        (*cursor).pChangesStmt.finalize()?;
        (*cursor).pChangesStmt = null_mut();
    }

    let c_rc = crsql_ensure_table_infos_are_up_to_date(
        db,
        (*tab).pExtData,
        &mut (*tab).base.zErrMsg as *mut _,
    );
    if c_rc != 0 {
        if let Some(rc) = ResultCode::from_i32(c_rc) {
            return Err(rc);
        } else {
            return Err(ResultCode::ERROR);
        }
    }

    
```

### Core Architecture Module: `core/rs/core/src/changes_vtab_read.rs`
```
extern crate alloc;
use crate::tableinfo::TableInfo;
use alloc::format;
use alloc::string::String;
use alloc::vec;
use alloc::vec::Vec;
use sqlite::ResultCode;

use sqlite_nostd as sqlite;

fn crsql_changes_query_for_table(table_info: &TableInfo) -> Result<String, ResultCode> {
    if table_info.pks.len() == 0 {
        // no primary keys? We can't get changes for a table w/o primary keys...
        // this should be an impossible case.
        return Err(ResultCode::ABORT);
    }

    let pk_list = crate::util::as_identifier_list(&table_info.pks, Some("pk_tbl."))?;
    // TODO: we can remove the self join if we put causal length in the primary key table

    // We LEFT JOIN and COALESCE the causal length
    // since we incorporated an optimization to not store causal length records
    // until they're required. I.e., do not store them until a delete
    // is actually issued. This cuts data weight quite a bit for
    // rows that never get removed.
    Ok(format!(
        "SELECT
          '{table_name_val}' as tbl,
          crsql_pack_columns({pk_list}) as pks,
          t1.col_name as cid,
          t1.col_version as col_vrsn,
          t1.db_version as db_vrsn,
          site_tbl.site_id as site_id,
          t1.key,
          t1.seq as seq,
          COALESCE(t2.col_version, 1) as cl
      FROM \"{table_name_ident}__crsql_clock\" AS t1
      JOIN \"{table_name_ident}__crsql_pks\" AS pk_tbl ON t1.key = pk_tbl.__crsql_key
      LEFT JOIN crsql_site_id AS site_tbl ON t1.site_id = site_tbl.ordinal
      LEFT JOIN \"{table_name_ident}__crsql_clock\" AS t2 ON
      t1.key = t2.key AND t2.col_name = '{sentinel}'",
        table_name_val = crate::util::escape_ident_as_value(&table_info.tbl_name),
        pk_list = pk_list,
        table_name_ident = crate::util::escape_ident(&table_info.tbl_name),
        sentinel = crate::c::INSERT_SENTINEL
    ))
}

pub fn changes_union_query(
    table_infos: &Vec<TableInfo>,
    idx_str: &str,
) -> Result<String, ResultCode> {
    let mut sub_queries = vec![];

    for table_info in table_infos {
        let query_part = crsql_changes_query_for_table(&table_info)?;
        sub_queries.push(query_part);
    }

    // Manually null-terminate the string so we don't have to copy it to create a CString.
    // We can just extract the raw bytes of the Rust string.
    return Ok(format!(
      "SELECT tbl, pks, cid, col_vrsn, db_vrsn, site_id, key, seq, cl FROM ({unions}) {idx_str}\0",
      unions = sub_queries.join(" UNION ALL "),
      idx_str = idx_str,
    ));
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #354** (2023-09-20): **bug report | null primary keys fail to sync**
  *Symptoms*: example of the error: https://discord.com/channels/989870439897653248/1022913265946349690/1152224235461287977  reported by @jmatsushita
  **Post-Mortem & Fix Analysis**:
  > Null primary keys violate unique constraints --   ![image](https://github.com/vlcn-io/cr-sqlite/assets/1009003/4f787493-906d-4851-abd2-cd7112511ad9)  We can't support a null primary key and no DB actually does besides SQLite. To add validation on crr creation to deny making crrs that have null primary keys.
  > So, `crsqlite` now has to require `NOT NULL` on primary key definition, right? What about tables with multiple primary keys? Is it ok if only one of pk columns is nullable? 
  > Oh. The original report was because of the composite keys... All the pk columns should be `NOT NULL` then.

- **Issue #98** (2022-12-08): **client-server sync -- incorrectly bumps versions on unchanged columns**
  *Symptoms*: `crsql_didCidWin` looks at the `site_id` of the local database when updating clock values.  In a client-server model (or model where peers proxy other peers) this is incorrect behaviors.  `crsql_didCidWin` needs to look at the `site_id` of the row.  Better still -- we should break ties on values and ignore site_id entirely.
  **Post-Mortem & Fix Analysis**:
  > This wasn't uncovered before since the original model was P2P where each peer connected to every other peer.  Allowing peers to proxy changes for one another (required for client-server sync) broke some of our assumptions. This is easily fixed by breaking ties through values rather than site ids -- or using the site_id of the row (in cases where the update to the row was proxied from another db) to break the tie.

- **Issue #71** (2023-08-03): **fixup delete tracking to allow re-insertion of the deleted item**
  *Symptoms*: See discussion in #59 
  **Post-Mortem & Fix Analysis**:
  > You can work around this in user space by keeping an "is_deleted" column and toggling that rather than actually deleting the row
  > We can also fix this by adding create records and recording the version at create time.
  > The diagram of an implementation we've discussed on Discord: ![image](https://user-images.githubusercontent.com/43073346/213863893-8eb8ca61-12e3-4f73-979d-06ac748bae03.png) 

- **Issue #68** (2022-11-24): **Switch to col name from cid**
  *Symptoms*: https://sqlite.org/forum/forumpost/6e1ae330068d8e45  Col name, if we check existence before changeset pull and before changeset apply, also solves our schema alteration problems so long as one rule is observed: columns don't trade names
  **Post-Mortem & Fix Analysis**:
  > the issue here is that we store and merge based on column id. Turns out column id is not stable in SQLite and only column names are :(  
  > related to #16 as it changes the rules on schema modification.
  > working here: 2dd530c8b2d950699b169e0764cd26d12e96b893, 7822c30bb7a67ac1b8f9d20960155e1aef2dc060

- **Issue #67** (2023-02-10): **react integration - `useSyncExternalStore`**
  *Symptoms*: We get some tearing artifacts due to `useEffect` being used in `liveQueries`  We need to swap out to `useSyncExternalStore`
  **Post-Mortem & Fix Analysis**:
  > ah, we've finished all this!  https://github.com/vlcn-io/cr-sqlite/pull/143

- **Issue #58** (2022-11-26): **Dig into official SQLite WASM file locking problems**
  *Symptoms*: see the videos in https://github.com/vlcn-io/cr-sqlite/pull/56 and this sqlite forum post https://sqlite.org/forum/forumpost/e7047fac48
  **Post-Mortem & Fix Analysis**:
  > We're dropping the official build and sticking with wa-sqlite for the time being. We can revisit the official build in a few months.

- **Issue #50** (2023-07-25): **modifying a primary key should record a delete as well as a create**
  *Symptoms*: If site A changes the primary key of a row it should record the row with the old primary key as being deleted.  Otherwise a site B that receives changes from A will retain both rows -- the row with the old PK and the row with the new PK.  Worse yet, however, the new row received by B will not have any modification events and will thus be an empty row, sans the PK.
  **Post-Mortem & Fix Analysis**:
  > This'll be resolved by PR https://github.com/vlcn-io/cr-sqlite/pull/292
  > Closing since this is fixed in the PR which will be merged shortly.

- **Issue #46** (2022-11-18): **SQLite: `SELECT quote(column_name)` returns different results on linux and mac**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > OSX build is returning strings, Linux is returning ints.  Ints are the proper return type in this case  https://github.com/vlcn-io/cr-sqlite/actions/runs/3493336634/jobs/5848060834
  > actually `string` is correct given we expect these values to be string encoded for inclusion in future sql statements after which they'll be brought back to the correct type.  https://www.sqlite.org/lang_corefunc.html#quote
  > Ubuntu: ``` >>> c.execute("SELECT quote(a) FROM foo").fetchall() [(1,)] ```  OSX: ``` >>> c.execute("SELECT quote(a) FROM foo").fetchall() [('1',)] ```

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

### Incident Patch 1: `43ab94ca` (2026-08-10)
**Commit Message**: Fix macos headerpad (#464)

* align android loadable to 16 kb page size

* build windows arm64 loadable

* build all android abis

* fix ios simulator build

* pad macho headers so install names can be rewritten

---------

Co-authored-by: CaptainDario M5 <[REDACTED_EMAIL]>
Co-authored-by: Matt Wonlaw <[REDACTED_EMAIL]>

**File**: `core/Makefile` (modified, +6/-1)
```diff
@@ -6,7 +6,7 @@ endif
 
 # SHARED_CFLAGS=-DLIBSQL=1
 PIC_CFLAG=-fPIC
-LOADABLE_CFLAGS=-std=c99 $(PIC_CFLAG) -shared -Wall $(SHARED_CFLAGS)
+LOADABLE_CFLAGS=-std=c99 $(PIC_CFLAG) $(APPLE_LDFLAGS) -shared -Wall $(SHARED_CFLAGS)
 STATIC_CFLAGS=-std=c99 $(PIC_CFLAG) -c -Wall $(SHARED_CFLAGS)
 # libsql_feature=,libsql
 
@@ -20,6 +20,9 @@ endif
 
 ifdef CONFIG_DARWIN
 LOADABLE_EXTENSION=dylib
+# Consumers that relocate the dylib rewrite its install name, which needs spare
+# room in the header. install_name_tool fails on long paths without this.
+APPLE_LDFLAGS=-headerpad_max_install_names
 # apparently `darwin-x86_64` also works on arm macs and is the proper host arch for ndk builds.
 NDK_HOSTARCH=darwin-x86_64
 endif
@@ -66,6 +69,8 @@ endif
 ifdef ANDROID_TARGET
 CI_MAYBE_TARGET=$(ANDROID_TARGET)
 NDK=$(ANDROID_NDK_HOME)
+# Building for android from a mac host, the linker is the NDK's, not Apple's.
+APPLE_LDFLAGS=
 LOADABLE_EXTENSION=so
 CC=$(NDK)/toolchains/llvm/prebuilt/$(NDK_HOSTARCH)/bin/clang
 rs_ndk=ndk -t $(ANDROID_TARGET)
```

---

### Incident Patch 2: `ed99ee5e` (2026-08-02)
**Commit Message**: fix ios simulator build

**File**: `core/all-ios-loadable.sh` (modified, +6/-0)
```diff
@@ -3,6 +3,12 @@
 # a hacky script to make all the various ios targets.
 # once we have something consistently working we'll streamline all of this.
 
+set -euo pipefail
+
+# bindgen hands the rust triple to clang, which rejects `sim` as a version.
+# clang spells the same target `arm64-apple-ios-simulator`.
+export BINDGEN_EXTRA_CLANG_ARGS_aarch64_apple_ios_sim="--target=arm64-apple-ios-simulator"
+
 BUILD_DIR=./build
 DIST_PACKAGE_DIR=./dist
 
```

---

### Incident Patch 3: `229f18fe` (2026-08-02)
**Commit Message**: build windows arm64 loadable

**File**: `.github/workflows/publish.yaml` (modified, +33/-0)
```diff
@@ -176,6 +176,39 @@ jobs:
           asset_name: ${{ matrix.asset_name }}
           tag: ${{ github.ref }}
 
+  prebuild-windows-arm64:
+    name: Prebuild for Windows arm64
+    runs-on: windows-latest
+
+    steps:
+      - uses: actions/checkout@v3
+        with:
+          submodules: true
+
+      - name: Rust Nightly
+        run: |
+          rustup toolchain install nightly-2023-10-05
+          rustup target add aarch64-pc-windows-msvc --toolchain nightly-2023-10-05
+
+      - uses: ilammy/msvc-dev-cmd@v1
+        with:
+          arch: amd64_arm64
+
+      - name: Build
+        shell: bash
+        run: |
+          cd core
+          export CI_MAYBE_TARGET="aarch64-pc-windows-msvc" && export CI_GCC="clang" && make loadable
+          cd dist && 7z a crsqlite.zip crsqlite.dll
+
+      - name: Upload binaries to release
+        uses: svenstaro/upload-release-action@v2
+        with:
+          repo_token: ${{ secrets.GITHUB_TOKEN }}
+          file: core/dist/crsqlite.zip
+          asset_name: crsqlite-win-aarch64.zip
+          tag: ${{ github.ref }}
+
   prebuild-windows-i686:
     name: Prebuild for Windows i686
     runs-on: ${{ matrix.os }}
```

**File**: `core/Makefile` (modified, +17/-2)
```diff
@@ -5,8 +5,9 @@ CC:=$(CI_GCC)
 endif
 
 # SHARED_CFLAGS=-DLIBSQL=1
-LOADABLE_CFLAGS=-std=c99 -fPIC -shared -Wall $(SHARED_CFLAGS)
-STATIC_CFLAGS=-std=c99 -fPIC -c -Wall $(SHARED_CFLAGS)
+PIC_CFLAG=-fPIC
+LOADABLE_CFLAGS=-std=c99 $(PIC_CFLAG) -shared -Wall $(SHARED_CFLAGS)
+STATIC_CFLAGS=-std=c99 $(PIC_CFLAG) -c -Wall $(SHARED_CFLAGS)
 # libsql_feature=,libsql
 
 ifeq ($(shell uname -s),Darwin)
@@ -42,6 +43,12 @@ C_TARGET=
 LOADABLE_EXTENSION=dll
 rs_build_flags = -Zbuild-std
 endif
+ifeq ($(CI_MAYBE_TARGET),aarch64-pc-windows-msvc)
+C_TARGET=--target=aarch64-pc-windows-msvc
+LOADABLE_EXTENSION=dll
+# Windows code is always position independent, clang rejects -fPIC there.
+PIC_CFLAG=
+endif
 
 ifdef IOS_TARGET
 CI_MAYBE_TARGET=$(IOS_TARGET)
@@ -163,6 +170,14 @@ ifdef CI_MAYBE_TARGET
 	endif
 endif
 
+# MSVC targets emit crsql_<bundle>.lib rather than libcrsql_<bundle>.a
+ifeq ($(findstring windows-msvc,$(CI_MAYBE_TARGET)),windows-msvc)
+	rs_lib_static = ./rs/$(bundle)/target/$(CI_MAYBE_TARGET)/release/crsql_$(bundle).lib
+	rs_lib_static_cpy = ./dist/crsql_$(bundle)-static.lib
+	rs_lib_loadable = ./rs/$(bundle)/target/$(CI_MAYBE_TARGET)/release/crsql_$(bundle).lib
+	rs_lib_loadable_cpy = ./dist/crsql_$(bundle)-loadable.lib
+endif
+
 $(shell.c):
 	cd $(sqlite_src) && make shell.c
 
```

---

### Incident Patch 4: `0294f23c` (2026-08-02)
**Commit Message**: build all android abis

**File**: `.github/workflows/publish.yaml` (modified, +15/-3)
```diff
@@ -217,15 +217,27 @@ jobs:
           tag: ${{ github.ref }}
 
   prebuild-android:
-    name: Prebuild for android
+    name: Prebuild for android ${{ matrix.rust_target }}
     runs-on: ${{ matrix.os }}
     strategy:
+      fail-fast: false
       matrix:
         include:
           - os: ubuntu-latest
+            rust_target: aarch64-linux-android
             library_name: crsqlite.so
             artifact_name: crsqlite.zip
             asset_name: crsqlite-aarch64-linux-android.zip
+          - os: ubuntu-latest
+            rust_target: armv7-linux-androideabi
+            library_name: crsqlite.so
+            artifact_name: crsqlite.zip
+            asset_name: crsqlite-armv7-linux-androideabi.zip
+          - os: ubuntu-latest
+            rust_target: x86_64-linux-android
+            library_name: crsqlite.so
+            artifact_name: crsqlite.zip
+            asset_name: crsqlite-x86_64-linux-android.zip
 
     steps:
       - uses: actions/checkout@v3
@@ -235,7 +247,7 @@ jobs:
       - name: Rust Nightly
         run: |
           rustup toolchain install nightly-2023-10-05
-          rustup target add aarch64-linux-android --toolchain nightly-2023-10-05
+          rustup target add ${{ matrix.rust_target }} --toolchain nightly-2023-10-05
           rustup component add rust-src --toolchain nightly-2023-10-05-x86_64-unknown-linux-gnu
 
       - uses: nttld/setup-ndk@v1
@@ -253,7 +265,7 @@ jobs:
           ANDROID_NDK_HOME: ${{ steps.setup-ndk.outputs.ndk-path }}
         run: |
           cd core
-          export ANDROID_TARGET=aarch64-linux-android; make loadable
+          export ANDROID_TARGET=${{ matrix.rust_target }}; make loadable
           cd dist; zip crsqlite.zip ${{ matrix.library_name }}
 
       - name: Upload binaries to release
```

---

### Incident Patch 5: `891fe9e0` (2024-06-28)
**Commit Message**: fix plist

**File**: `core/all-ios-loadable.sh` (modified, +6/-0)
```diff
@@ -24,6 +24,12 @@ function createXcframework() {
   <string>FMWK</string>
   <key>CFBundleSignature</key>
   <string>????</string>
+  <key>CFBundleVersion</key>
+  <string>1.0.0</string>
+  <key>CFBundleShortVersionString</key>
+  <string>1.0.0</string>
+	<key>MinimumOSVersion</key>
+  <string>8.0</string>
 </dict>
 </plist>
 EOF
```

---

### Incident Patch 6: `87e9151a` (2024-06-29)
**Commit Message**: fix deprecated import assertion

**File**: `core/nodejs-install-helper.js` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
 import { join } from "path";
 import fs from "fs";
 import https from "https";
-import pkg from "./package.json" assert { type: "json" };
+import pkg from "./package.json" with { type: "json" };
 import { exec } from "child_process";
 let { version } = pkg;
 
```

---

### Incident Patch 7: `01aad51d` (2024-05-26)
**Commit Message**: Fix dead link

**File**: `README.md` (modified, +1/-1)
```diff
@@ -238,7 +238,7 @@ You'll need to install Rust.
 
 - Installing Rust: https://www.rust-lang.org/tools/install
 
-## [Run Time Loadable Extension](https://www.sqlite.org/loadext.htmla)
+## [Run Time Loadable Extension](https://www.sqlite.org/loadext.html)
 
 Instructions on building a native library that can be loaded into SQLite in non-wasm environments.
 
```

---

### Incident Patch 8: `cd5c8716` (2024-05-26)
**Commit Message**: Fix typo

**File**: `README.md` (modified, +1/-1)
```diff
@@ -232,7 +232,7 @@ This is much more akin to git and event sourcing but with the drawback being tha
 
 # Building
 
-For a table version, build against a [release tag](https://github.com/vlcn-io/cr-sqlite/releases) as main may not be 100% stable.
+For a stable version, build against a [release tag](https://github.com/vlcn-io/cr-sqlite/releases) as main may not be 100% stable.
 
 You'll need to install Rust.
 
```

---

### Incident Patch 9: `db12d4ef` (2024-05-26)
**Commit Message**: Fix dead link

**File**: `README.md` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ Example applications using cr-sqlite to sync state.
 - Vite starter - [Example](https://vite-starter2.fly.dev/) | [Repository](https://github.com/vlcn-io/vite-starter)
 - TodoMVC - [Example](https://vlcn-live-examples.fly.dev/) | [Repository](https://github.com/vlcn-io/live-examples)
 - [Svelte Store](https://github.com/Azarattum/CRStore)
-- [Tutorials](https://vlcn.io/docs/networking/whole-crr-sync)
+- [Tutorials](https://vlcn.io/docs/cr-sqlite/networking/whole-crr-sync)
 - [WIP Local-First Presentation Editor](https://github.com/tantaman/strut)
 - Basic setup & sync via an [Observable Notebook](https://observablehq.com/@tantaman/cr-sqlite-basic-setup)
 
```

---

### Incident Patch 10: `010883be` (2024-04-26)
**Commit Message**: Fix missing null terminator in schema name

**File**: `core/rs/core/src/lib.rs` (modified, +1/-1)
```diff
@@ -557,7 +557,7 @@ unsafe extern "C" fn x_crsql_as_crr(
     let (schema_name, table_name) = if argc == 2 {
         (args[0].text(), args[1].text())
     } else {
-        ("main", args[0].text())
+        ("main\0", args[0].text())
     };
 
     let db = ctx.db_handle();
```

---

### Incident Patch 11: `0d62b52b` (2024-01-17)
**Commit Message**: 0.16.3 release -- fix wasm oom, fix potentially missing functions

fix #423

**File**: `core/CHANGELOG.md` (modified, +6/-0)
```diff
@@ -1,5 +1,11 @@
 # @vlcn.io/crsqlite
 
+## 0.16.3
+
+### Patch Changes
+
+- fix windows breakage, fix wasm oom
+
 ## 0.16.1
 
 ### Patch Changes
```

**File**: `core/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@vlcn.io/crsqlite",
-  "version": "0.16.2",
+  "version": "0.16.3",
   "description": "CR-SQLite loadable extension",
   "homepage": "https://vlcn.io",
   "repository": {
```

**File**: `core/rs/core/src/consts.rs` (modified, +2/-2)
```diff
@@ -11,8 +11,8 @@ pub const TBL_SCHEMA: &'static str = "crsql_master";
 // 00_05_01_00
 // and, if we ever need it, we can track individual builds of a patch release
 // 00_05_01_01
-pub const CRSQLITE_VERSION: i32 = 16_01_00;
-pub const CRSQLITE_VERSION_STR: &'static str = "0.16.1";
+pub const CRSQLITE_VERSION: i32 = 16_03_00;
+pub const CRSQLITE_VERSION_STR: &'static str = "0.16.3";
 pub const CRSQLITE_VERSION_0_15_0: i32 = 15_00_00;
 
 pub const SITE_ID_LEN: i32 = 16;
```

---

### Incident Patch 12: `a8163d24` (2024-01-17)
**Commit Message**: remove `crsql_version` for now -- it is causing issues in the wasm build for unknown reasons

**File**: `core/rs/core/src/lib.rs` (modified, +16/-16)
```diff
@@ -286,22 +286,22 @@ pub extern "C" fn sqlite3_crsqlcore_init(
         return null_mut();
     }
 
-    let rc = db
-        .create_function_v2(
-            "crsql_version",
-            0,
-            sqlite::UTF8 | sqlite::INNOCUOUS | sqlite::DETERMINISTIC,
-            None,
-            Some(x_crsql_version),
-            None,
-            None,
-            None,
-        )
-        .unwrap_or(ResultCode::ERROR);
-    if rc != ResultCode::OK {
-        unsafe { crsql_freeExtData(ext_data) };
-        return null_mut();
-    }
+    // let rc = db
+    //     .create_function_v2(
+    //         "crsql_version",
+    //         0,
+    //         sqlite::UTF8 | sqlite::INNOCUOUS | sqlite::DETERMINISTIC,
+    //         None,
+    //         Some(x_crsql_version),
+    //         None,
+    //         None,
+    //         None,
+    //     )
+    //     .unwrap_or(ResultCode::ERROR);
+    // if rc != ResultCode::OK {
+    //     unsafe { crsql_freeExtData(ext_data) };
+    //     return null_mut();
+    // }
 
     let rc = db
         .create_function_v2(
```

---

### Incident Patch 13: `3c8711ff` (2024-01-08)
**Commit Message**: fix a mistake where we were only using the current DB's site_id instead of the current site_id value in the clock table for comparison

**File**: `core/rs/core/src/changes_vtab_write.rs` (modified, +39/-4)
```diff
@@ -95,10 +95,45 @@ fn did_cid_win(
             reset_cached_stmt(col_val_stmt.stmt)?;
             if ret == 0 && unsafe { (*ext_data).mergeEqualValues == 1 } {
                 // values are the same (ret == 0) and the option to tie break on site_id is true
-                ret = unsafe {
-                    let my_site_id = core::slice::from_raw_parts((*ext_data).siteId, 16);
-                    insert_site_id.cmp(my_site_id) as c_int
-                };
+                let col_site_id_stmt_ref = tbl_info.get_col_site_id_stmt(db)?;
+                let col_site_id_stmt = col_site_id_stmt_ref.as_ref().ok_or(ResultCode::ERROR)?;
+
+                let bind_result = col_site_id_stmt.bind_int64(1, key);
+                if let Err(rc) = bind_result {
+                    reset_cached_stmt(col_site_id_stmt.stmt)?;
+                    return Err(rc);
+                }
+                if let Err(rc) = col_site_id_stmt.bind_text(2, col_name, sqlite::Destructor::STATIC)
+                {
+                    reset_cached_stmt(col_site_id_stmt.stmt)?;
+                    return Err(rc);
+                }
+
+                match col_site_id_stmt.step() {
+                    Ok(ResultCode::ROW) => {
+                        let local_site_id = col_site_id_stmt.column_blob(0)?;
+                        ret = insert_site_id.cmp(local_site_id) as c_int;
+
+                        // reset the stmt after, we're accessing a slice in-memory
+                        reset_cached_stmt(col_site_id_stmt.stmt)?;
+                    }
+                    Ok(ResultCode::DONE) => {
+                        reset_cached_stmt(col_site_id_stmt.stmt)?;
+                        let err = CString::new(format!(
+                            "could not find site_id for previous change, cr-sqlite clock table might be corrupt for tbl {}",
+                            insert_tbl
+                        ))?;
+                        unsafe { *errmsg = err.into_raw() };
+                        return Err(ResultCode::ERROR);
+                    }
+                    Ok(rc) | Err(rc) => {
+                        reset_cached_stmt(col_site_id_stmt.stmt)?;
+                        let err =
+                            CString::new("Bad return code when selecting local column site_id")?;
+                        unsafe { *errmsg = err.into_raw() };
+                        return Err(rc);
+                    }
+                }
             }
             return Ok(ret > 0);
         }
```

**File**: `core/rs/core/src/tableinfo.rs` (modified, +17/-0)
```diff
@@ -45,6 +45,7 @@ pub struct TableInfo {
     set_winner_clock_stmt: RefCell<Option<ManagedStmt>>,
     local_cl_stmt: RefCell<Option<ManagedStmt>>,
     col_version_stmt: RefCell<Option<ManagedStmt>>,
+    col_site_id_stmt: RefCell<Option<ManagedStmt>>,
     merge_pk_only_insert_stmt: RefCell<Option<ManagedStmt>>,
     merge_delete_stmt: RefCell<Option<ManagedStmt>>,
     merge_delete_drop_clocks_stmt: RefCell<Option<ManagedStmt>>,
@@ -337,6 +338,21 @@ impl TableInfo {
         Ok(self.col_version_stmt.try_borrow()?)
     }
 
+    pub fn get_col_site_id_stmt(
+        &self,
+        db: *mut sqlite3,
+    ) -> Result<Ref<Option<ManagedStmt>>, ResultCode> {
+        if self.col_site_id_stmt.try_borrow()?.is_none() {
+            let sql = format!(
+              "SELECT site_id FROM crsql_site_id WHERE ordinal = (SELECT site_id FROM \"{table_name}__crsql_clock\" WHERE key = ? AND col_name = ?)",
+              table_name = crate::util::escape_ident(&self.tbl_name),
+            );
+            let ret = db.prepare_v3(&sql, sqlite::PREPARE_PERSISTENT)?;
+            *self.col_site_id_stmt.try_borrow_mut()? = Some(ret);
+        }
+        Ok(self.col_site_id_stmt.try_borrow()?)
+    }
+
     pub fn get_merge_pk_only_insert_stmt(
         &self,
         db: *mut sqlite3,
@@ -871,6 +887,7 @@ pub fn pull_table_info(
         set_winner_clock_stmt: RefCell::new(None),
         local_cl_stmt: RefCell::new(None),
         col_version_stmt: RefCell::new(None),
+        col_site_id_stmt: RefCell::new(None),
 
         select_key_stmt: RefCell::new(None),
         insert_key_stmt: RefCell::new(None),
```

**File**: `py/correctness/tests/test_sync.py` (modified, +38/-3)
```diff
@@ -383,6 +383,7 @@ def make_dbs():
 def test_merge_same_w_tie_breaker():
     db1 = create_basic_db()
     db2 = create_basic_db()
+    db3 = create_basic_db()
 
     db1.execute("INSERT INTO foo (a,b) VALUES (1,2);")
     db1.execute("SELECT crsql_config_set('merge-equal-values', 1);")
@@ -392,13 +393,47 @@ def test_merge_same_w_tie_breaker():
     db2.execute("SELECT crsql_config_set('merge-equal-values', 1);")
     db2.commit()
 
+    db3.execute("INSERT INTO foo (a,b) VALUES (1,2);")
+    db3.execute("SELECT crsql_config_set('merge-equal-values', 1);")
+    db3.commit()
+
     sync_left_to_right(db1, db2, 0)
-    changes12 = db2.execute("SELECT \"table\", pk, cid, val, col_version, site_id FROM crsql_changes").fetchall()
+    changes2 = db2.execute("SELECT \"table\", pk, cid, val, col_version, site_id, db_version FROM crsql_changes").fetchall()
     
     sync_left_to_right(db2, db1, 0)
-    changes21 = db1.execute("SELECT \"table\", pk, cid, val, col_version, site_id FROM crsql_changes").fetchall()
+    changes1 = db1.execute("SELECT \"table\", pk, cid, val, col_version, site_id, db_version FROM crsql_changes").fetchall()
+
+    sync_left_to_right(db2, db3, 0)
+    changes3 = db3.execute("SELECT \"table\", pk, cid, val, col_version, site_id, db_version FROM crsql_changes").fetchall()
+
+    # check that everything by db_version is the same
+    assert (changes2[:-6] == changes1[:-6] == changes3[:-6])
 
-    assert (changes12 == changes21)
+    # Test that we're stable / do not loop when we tie break equal values
+
+    sync_left_to_right(db2, db1, 0)
+    changes1_2 = db1.execute("SELECT \"table\", pk, cid, val, col_version, site_id, db_version FROM crsql_changes").fetchall()
+    sync_left_to_right(db3, db2, 0)
+    changes2_2 = db2.execute("SELECT \"table\", pk, cid, val, col_version, site_id, db_version FROM crsql_changes").fetchall()
+    sync_left_to_right(db1, db3, 0)
+    changes3_2 = db3.execute("SELECT \"table\", pk, cid, val, col_version, site_id, db_version FROM crsql_changes").fetchall()
+
+    # everything should stay the same, including db_version
+    assert (changes1 == changes1_2)
+    assert (changes2 == changes2_2)
+    assert (changes3 == changes3_2)
+
+    sync_left_to_right(db3, db1, 0)
+    changes1_2 = db1.execute("SELECT \"table\", pk, cid, val, col_version, site_id, db_version FROM crsql_changes").fetchall()
+    sync_left_to_right(db1, db2, 0)
+    changes2_2 = db2.execute("SELECT \"table\", pk, cid, val, col_version, site_id, db_version FROM crsql_changes").fetchall()
+    sync_left_to_right(db2, db3, 0)
+    changes3_2 = db3.execute("SELECT \"table\", pk, cid, val, col_version, site_id, db_version FROM crsql_changes").fetchall()
+
+    # everything should stay the same, including db_version
+    assert (changes1 == changes1_2)
+    assert (changes2 == changes2_2)
+    assert (changes3 == changes3_2)
 
 
 def test_merge_matching_clocks_lesser_value():
```

---

### Incident Patch 14: `359e52e4` (2023-12-26)
**Commit Message**: fix config not being loaded properly on init

**File**: `core/rs/bundle/Cargo.lock` (modified, +2/-2)
```diff
@@ -121,9 +121,9 @@ checksum = "830d08ce1d1d941e6b30645f1a0eb5643013d835ce3779a5fc208261dbe10f55"
 
 [[package]]
 name = "libc"
-version = "0.2.139"
+version = "0.2.151"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "201de327520df007757c1f0adce6e827fe8562fbc28bfd9c15571c66ca1f5f79"
+checksum = "302d7ab3130588088d277783b1e2d2e10c9e9e4a16dd9050e6ec93fb3e7048f4"
 
 [[package]]
 name = "libloading"
```

**File**: `core/rs/core/Cargo.lock` (modified, +2/-2)
```diff
@@ -105,9 +105,9 @@ checksum = "830d08ce1d1d941e6b30645f1a0eb5643013d835ce3779a5fc208261dbe10f55"
 
 [[package]]
 name = "libc"
-version = "0.2.140"
+version = "0.2.151"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "99227334921fae1a979cf0bfdfcc6b3e5ce376ef57e16fb6fb3ea2ed6095f80c"
+checksum = "302d7ab3130588088d277783b1e2d2e10c9e9e4a16dd9050e6ec93fb3e7048f4"
 
 [[package]]
 name = "libloading"
```

**File**: `core/rs/core/src/c.rs` (modified, +3/-3)
```diff
@@ -67,7 +67,7 @@ pub struct crsql_ExtData {
     pub pSetSiteIdOrdinalStmt: *mut sqlite::stmt,
     pub pSelectSiteIdOrdinalStmt: *mut sqlite::stmt,
     pub pSelectClockTablesStmt: *mut sqlite::stmt,
-    pub tieBreakSameColValue: ::core::ffi::c_int,
+    pub mergeEqualValues: ::core::ffi::c_int,
 }
 
 #[repr(C)]
@@ -454,13 +454,13 @@ fn bindgen_test_layout_crsql_ExtData() {
         )
     );
     assert_eq!(
-        unsafe { ::std::ptr::addr_of!((*ptr).tieBreakSameColValue) as usize - ptr as usize },
+        unsafe { ::std::ptr::addr_of!((*ptr).mergeEqualValues) as usize - ptr as usize },
         128usize,
         concat!(
             "Offset of field: ",
             stringify!(crsql_ExtData),
             "::",
-            stringify!(tieBreakSameColValue)
+            stringify!(mergeEqualValues)
         )
     );
 }
```

**File**: `core/rs/core/src/changes_vtab_write.rs` (modified, +1/-1)
```diff
@@ -93,7 +93,7 @@ fn did_cid_win(
             let local_value = col_val_stmt.column_value(0)?;
             let mut ret = crsql_compare_sqlite_values(insert_val, local_value);
             reset_cached_stmt(col_val_stmt.stmt)?;
-            if ret == 0 && unsafe { (*ext_data).tieBreakSameColValue == 1 } {
+            if ret == 0 && unsafe { (*ext_data).mergeEqualValues == 1 } {
                 // values are the same (ret == 0) and the option to tie break on site_id is true
                 ret = unsafe {
                     let my_site_id = core::slice::from_raw_parts((*ext_data).siteId, 16);
```

**File**: `core/rs/core/src/config.rs` (modified, +2/-2)
```diff
@@ -21,7 +21,7 @@ pub extern "C" fn crsql_config_set(
         MERGE_EQUAL_VALUES => {
             let value = args[1];
             let ext_data = ctx.user_data() as *mut crsql_ExtData;
-            unsafe { (*ext_data).tieBreakSameColValue = value.int() };
+            unsafe { (*ext_data).mergeEqualValues = value.int() };
             value
         }
         _ => {
@@ -74,7 +74,7 @@ pub extern "C" fn crsql_config_get(
     match name {
         MERGE_EQUAL_VALUES => {
             let ext_data = ctx.user_data() as *mut crsql_ExtData;
-            ctx.result_int(unsafe { (*ext_data).tieBreakSameColValue });
+            ctx.result_int(unsafe { (*ext_data).mergeEqualValues });
         }
         _ => {
             ctx.result_error("Unknown setting name");
```

**File**: `core/rs/core/src/lib.rs` (modified, +3/-1)
```diff
@@ -214,7 +214,7 @@ pub extern "C" fn sqlite3_crsqlcore_init(
 
     let ext_data = unsafe { crsql_newExtData(db, site_id_buffer as *mut c_char) };
     if ext_data.is_null() {
-        sqlite::free(site_id_buffer as *mut c_void);
+        // no need to free the site id buffer here, this is cleaned up already.
         return null_mut();
     }
 
@@ -486,6 +486,7 @@ pub extern "C" fn sqlite3_crsqlcore_init(
         )
         .unwrap_or(sqlite::ResultCode::ERROR);
     if rc != ResultCode::OK {
+        unsafe { crsql_freeExtData(ext_data) };
         return null_mut();
     }
 
@@ -502,6 +503,7 @@ pub extern "C" fn sqlite3_crsqlcore_init(
         )
         .unwrap_or(sqlite::ResultCode::ERROR);
     if rc != ResultCode::OK {
+        unsafe { crsql_freeExtData(ext_data) };
         return null_mut();
     }
 
```

**File**: `core/rs/core/src/sha.rs` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
 // The sha of the commit that this version of crsqlite was built from.
-pub const SHA: &'static str = "";
+pub const SHA: &'static str = "3a01980562615001d765eec61e3ed58147a93f93";
```

**File**: `core/src/ext-data.c` (modified, +11/-7)
```diff
@@ -1,6 +1,7 @@
 #include "ext-data.h"
 
 #include <stdio.h>
+#include <string.h>
 
 #include "consts.h"
 
@@ -11,6 +12,8 @@ void crsql_drop_table_info_vec(crsql_ExtData *pExtData);
 crsql_ExtData *crsql_newExtData(sqlite3 *db, unsigned char *siteIdBuffer) {
   crsql_ExtData *pExtData = sqlite3_malloc(sizeof *pExtData);
 
+  pExtData->siteId = siteIdBuffer;
+
   pExtData->pPragmaSchemaVersionStmt = 0;
   int rc = sqlite3_prepare_v3(db, "PRAGMA schema_version", -1,
                               SQLITE_PREPARE_PERSISTENT,
@@ -47,7 +50,6 @@ crsql_ExtData *crsql_newExtData(sqlite3 *db, unsigned char *siteIdBuffer) {
   pExtData->pragmaSchemaVersion = -1;
   pExtData->pragmaDataVersion = -1;
   pExtData->pragmaSchemaVersionForTableInfos = -1;
-  pExtData->siteId = siteIdBuffer;
   pExtData->pDbVersionStmt = 0;
   pExtData->tableInfos = 0;
   pExtData->rowsImpacted = 0;
@@ -67,14 +69,16 @@ crsql_ExtData *crsql_newExtData(sqlite3 *db, unsigned char *siteIdBuffer) {
   }
 
   // set defaults!
-  pExtData->tieBreakSameColValue = 0;
+  pExtData->mergeEqualValues = 0;
 
   while (sqlite3_step(pStmt) == SQLITE_ROW) {
-    const unsigned char *name = sqlite3_column_text(pStmt, 1);
-    if (sqlite3_stricmp(name, "merge-equal-values")) {
-      if (sqlite3_column_type(pStmt, 2) == SQLITE_INTEGER) {
-        const int value = sqlite3_column_int(pStmt, 2);
-        pExtData->tieBreakSameColValue = value;
+    const unsigned char *name = sqlite3_column_text(pStmt, 0);
+    int colType = sqlite3_column_type(pStmt, 1);
+
+    if (strcmp("merge-equal-values", (char *)name) == 0) {
+      if (colType == SQLITE_INTEGER) {
+        const int value = sqlite3_column_int(pStmt, 1);
+        pExtData->mergeEqualValues = value;
       } else {
         // broken setting...
         crsql_freeExtData(pExtData);
```

---

### Incident Patch 15: `62298443` (2023-12-21)
**Commit Message**: fix test_merge_same_w_tie_breaker

**File**: `py/correctness/tests/test_sync.py` (modified, +11/-33)
```diff
@@ -381,46 +381,24 @@ def make_dbs():
     assert (changes == [('foo', b'\x01\t\x01', 'b', 2, 1, 1, site_id, 1, 0)])
 
 def test_merge_same_w_tie_breaker():
-    def make_dbs():
-        db1 = create_basic_db()
-        db2 = create_basic_db()
+    db1 = create_basic_db()
+    db2 = create_basic_db()
 
-        db1.execute("INSERT INTO foo (a,b) VALUES (1,2);")
-        db1.execute("SELECT crsql_config_set('merge-equal-values', 1);")
-        db1.commit()
+    db1.execute("INSERT INTO foo (a,b) VALUES (1,2);")
+    db1.execute("SELECT crsql_config_set('merge-equal-values', 1);")
+    db1.commit()
 
-        db2.execute("INSERT INTO foo (a,b) VALUES (1,2);")
-        db2.execute("SELECT crsql_config_set('merge-equal-values', 1);")
-        db2.commit()
-        return (db1, db2)
+    db2.execute("INSERT INTO foo (a,b) VALUES (1,2);")
+    db2.execute("SELECT crsql_config_set('merge-equal-values', 1);")
+    db2.commit()
 
-    (db1, db2) = make_dbs()
     sync_left_to_right(db1, db2, 0)
-    changes = db2.execute("SELECT * FROM crsql_changes").fetchall()
+    changes12 = db2.execute("SELECT \"table\", pk, cid, val, col_version, site_id FROM crsql_changes").fetchall()
     
-    site_id1 = get_site_id(db1)
-    site_id2 = get_site_id(db2)
-
-    max_site_id = max(site_id1, site_id2)
-    version = 1;
-    if max_site_id != site_id1:
-        version = 2
-
-    assert (changes == [('foo', b'\x01\t\x01', 'b', 2, 1, version, max_site_id, 1, 0)])
-
-    (db1, db2) = make_dbs()
     sync_left_to_right(db2, db1, 0)
-    changes = db2.execute("SELECT * FROM crsql_changes").fetchall()
-    
-    site_id1 = get_site_id(db1)
-    site_id2 = get_site_id(db2)
-
-    max_site_id = max(site_id1, site_id2)
-    version = 1;
-    if max_site_id != site_id2:
-        version = 2
+    changes21 = db1.execute("SELECT \"table\", pk, cid, val, col_version, site_id FROM crsql_changes").fetchall()
 
-    assert (changes == [('foo', b'\x01\t\x01', 'b', 2, 1, version, max_site_id, 1, 0)])
+    assert (changes12 == changes21)
 
 
 def test_merge_matching_clocks_lesser_value():
```

#### Recent Merged Pull Requests:
- **PR #464** (2026-08-10): Fix macos headerpad (@dariyooo)
- **PR #463** (2026-08-04): fix: ios simulator build (@dariyooo)
- **PR #462** (2026-08-04): Feat: build for all android ABIs (@dariyooo)
- **PR #461** (2026-08-04): Feat: windows arm64 (@dariyooo)
- **PR #460** (2026-08-10): Align Android loadable to 16 KB page size (@dariyooo)
- **PR #459** (closed): Fix/380 duplicate seq (@callum-gander)
- **PR #458** (closed): fix: DROP TABLE on CRR leaving orphaned internal tables (@callum-gander)
- **PR #457** (closed): chore: add examples to README.md (@nickrobinson)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
