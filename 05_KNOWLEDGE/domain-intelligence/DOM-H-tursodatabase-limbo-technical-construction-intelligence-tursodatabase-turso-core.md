# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: tursodatabase/turso Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "tursodatabase/turso",
  "source_url": "https://github.com/tursodatabase/limbo",
  "source_version": "0dcd4f40",
  "license": "MIT",
  "timestamp": "2026-11-28T03:35:35.906Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tursodatabase-turso",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tursodatabase/turso](https://github.com/tursodatabase/limbo) (Revision: `0dcd4f40`).  
> **License**: MIT | **Timestamp**: `2026-11-28T03:35:35.906Z`  
> **Learning ID**: `learn-github-tursodatabase-turso`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: K (Quality & Verification Intelligence), G (Architecture Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), M (Feedback & Evolution Intelligence), B (Product Intelligence), J (Search & Distribution Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 76%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from tursodatabase/turso:

# Forensic Learning Record (Deep Inspection): tursodatabase/turso

> **Canonical Artifact**: `07_PROJECT_LEARNING/tursodatabase-limbo-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tursodatabase/limbo](https://github.com/tursodatabase/limbo))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-28T03:35:34.885Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tursodatabase/turso`
- **Description**: A SQL database in Rust: SQLite-compatible, now also speaking Postgres (experimental). The LLVM of databases.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md
- **Stars / Engagement**: 25387 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benches/scan_loop_benchmark.rs`
```
//! Scan-loop microbenchmark over a 100k-row table.
//!
//! `SELECT 1 FROM t` is the scan analogue of the existing `SELECT 1`
//! benchmark: the loop body is just ResultRow + Next, so it isolates
//! per-instruction dispatch and cursor-advance overhead with no decode
//! work. `SELECT * FROM t` adds column decoding on top.
//!
//! Run:  cargo bench -p turso_core --bench scan_loop_benchmark

#[cfg(feature = "codspeed")]
use codspeed_criterion_compat::{black_box, criterion_group, criterion_main, Criterion};
#[cfg(not(feature = "codspeed"))]
use criterion::{black_box, criterion_group, criterion_main, Criterion};

use std::sync::Arc;
use std::time::Duration;
use tempfile::TempDir;
use turso_core::{
    ConnectOpts, Connection, Database, PlatformIO, SessionRole, Statement, StepResult, Value,
};
use turso_sqlite::SqliteDialect;

#[cfg(not(target_family = "wasm"))]
#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

const NROWS: usize = 100_000;

struct Fixture {
    _dir: TempDir,
    db: Arc<Database>,
    conn: Arc<Connection>,
}

fn seed_db() -> Fixture {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("scan.db");
    #[allow(clippy::arc_with_non_send_sync)]
    let io = Arc::new(PlatformIO::new().unwrap());
    let db = Database::open_file(io, path.to_str().unwrap(), Arc::new(SqliteDialect)).unwrap();
    let conn = db
        .connect(ConnectOpts::new(SessionRole::Superuser))
        .unwrap();

    conn.execute("PRAGMA cache_size=-65536").unwrap(); //negative means kibibytes (https://sqlite.org/pragma.html#pragma_cache_size)
    conn.execute(
        "CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT NOT NULL, value INTEGER NOT NULL)",
    )
    .unwrap();

    conn.execute("BEGIN").unwrap();
    let mut insert = conn.prepare("INSERT INTO t VALUES (?1, ?2, ?3)").unwrap();
    for i in 0..NROWS as i64 {
        insert
            .bind_at(1usize.try_into().unwrap(), Value::from_i64(i))
            .unwrap();
        insert
            .bind_at(
                2usize.try_into().unwrap(),
                Value::build_text(format!("name_{i}")),
            )
            .unwrap();
        insert
            .bind_at(3usize.try_into().unwrap(), Value::from_i64(i))
            .unwrap();
        drive_stmt_to_completion(&db, &mut insert);
    }
    conn.execute("COMMIT").unwrap();

    Fixture {
        _dir: dir,
        db,
        conn,
    }
}

fn drive_stmt_to_completion(db: &Database, stmt: &mut Statement) -> usize {
    let mut rows = 0;
    loop {
        match stmt.step().unwrap() {
            StepResult::Row => {
                black_box(stmt.row());
                rows += 1;
            }
            StepResult::IO | StepResult::Yield | StepResult::Sleep { .. } => {
                db.io.step().unwrap();
            }
            StepResult::Done => break,
            StepResult::Interrupt | StepResult::Busy => unreachable!(),
        }
    }
    stmt.reset().unwrap();
    rows
}

#[turso_macros::codspeed_criterion_benchmark]
fn bench_scan_loop(criterion: &mut Criterion) {
    let mut group = criterion.benchmark_group("scan_loop");
    group.sample_size(30);
    group.measurement_time(Duration::from_secs(5));
    group.warm_up_time(Duration::from_secs(3));

    let fixture = seed_db();
    for (label, sql) in [
        ("select_one_100k", "SELECT 1 FROM t"),
        ("select_star_100k", "SELECT * FROM t"),
    ] {
        group.bench_function(label, |b| {
            let mut stmt = fixture.conn.prepare(sql).unwrap();
            assert_eq!(
                drive_stmt_to_completion(&fixture.db, &mut stmt),
                NROWS,
                "t should have been seeded with {NROWS} rows"
            );
            b.iter(|| drive_stmt_to_completion(&fixture.db, &mut stmt));
        });
    }
    group.finish();
}

criterion_group!(benches, bench_scan_loop);
criterion_main!(benches);

```

### Core Architecture Module: `bindings/java/rs_src/turso_statement.rs`
```
use crate::errors::{Result, SQLITE_ERROR, SQLITE_OK};
use crate::errors::{TursoError, TURSO_ETC};
use crate::turso_connection::TursoConnection;
use crate::utils::set_err_msg_and_throw_exception;
use jni::objects::{JByteArray, JObject, JObjectArray, JString, JValue};
use jni::sys::{jdouble, jint, jlong};
use jni::JNIEnv;
use std::num::NonZero;
use turso_core::{LimboError, Statement, Value};

pub const STEP_RESULT_ID_ROW: i32 = 10;
#[allow(dead_code)]
pub const STEP_RESULT_ID_IO: i32 = 20;
pub const STEP_RESULT_ID_DONE: i32 = 30;
pub const STEP_RESULT_ID_INTERRUPT: i32 = 40;
pub const STEP_RESULT_ID_BUSY: i32 = 50;
pub const STEP_RESULT_ID_ERROR: i32 = 60;

pub struct TursoStatement {
    pub(crate) stmt: Statement,
    pub(crate) connection: TursoConnection,
}

impl TursoStatement {
    pub fn new(stmt: Statement, connection: TursoConnection) -> Self {
        TursoStatement { stmt, connection }
    }

    #[allow(clippy::wrong_self_convention)]
    pub fn to_ptr(self) -> jlong {
        Box::into_raw(Box::new(self)) as jlong
    }

    pub fn drop(ptr: jlong) {
        let _boxed = unsafe { Box::from_raw(ptr as *mut TursoStatement) };
    }
}

pub fn to_turso_statement(ptr: jlong) -> Result<&'static mut TursoStatement> {
    if ptr == 0 {
        Err(TursoError::InvalidStatementPointer)
    } else {
        unsafe { Ok(&mut *(ptr as *mut TursoStatement)) }
    }
}

#[no_mangle]
pub extern "system" fn Java_tech_turso_core_TursoStatement_step<'local>(
    mut env: JNIEnv<'local>,
    obj: JObject<'local>,
    stmt_ptr: jlong,
) -> JObject<'local> {
    let stmt = match to_turso_statement(stmt_ptr) {
        Ok(stmt) => stmt,
        Err(e) => {
            let err_msg = e.to_string();
            set_err_msg_and_throw_exception(&mut env, obj, TURSO_ETC, err_msg.clone());
            return to_turso_step_result_error(&mut env, &err_msg);
        }
    };

    let result = stmt.stmt.run_one_step_blocking(|| Ok(()), || Ok(()));

    match result {
        Ok(Some(row)) => match row_to_obj_array(&mut env, row) {
            Ok(row) => to_turso_step_result(&mut env, STEP_RESULT_ID_ROW, Some(row)),
            Err(e) => {
                let err_msg = e.to_string();
                set_err_msg_and_throw_exception(&mut env, obj, TURSO_ETC, err_msg.clone());
                to_turso_step_result_error(&mut env, &err_msg)
            }
        },
        Ok(None) => {
            // Done
            to_turso_step_result(&mut env, STEP_RESULT_ID_DONE, None)
        }
        Err(LimboError::Interrupt) => {
            to_turso_step_result(&mut env, STEP_RESULT_ID_INTERRUPT, None)
        }
        Err(LimboError::Busy) => to_turso_step_result(&mut env, STEP_RESULT_ID_BUSY, None),
        Err(err) => {
            let err_msg = err.to_string();
            set_err_msg_and_throw_exception(&mut env, obj, TURSO_ETC, err_msg.clone());
            to_turso_step_result_error(&mut env, &err_msg)
        }
    }
}

#[no_mangle]
pub extern "system" fn Java_tech_turso_core_TursoStatement__1close<'local>(
    mut env: JNIEnv<'local>,
    obj: JObject<'local>,
    stmt_ptr: jlong,
) {
    if stmt_ptr == 0 {
        let e = TursoError::InvalidStatementPointer;
        set_err_msg_and_throw_exception(&mut env, obj, TURSO_ETC, e.to_string());
        return;
    }
    TursoStatement::drop(stmt_ptr);
}

fn row_to_obj_array<'local>(
    env: &mut JNIEnv<'local>,
    row: &turso_core::Row,
) -> Result<JObject<'local>> {
    let obj_array = env.new_object_array(row.len() as i32, "java/lang/Object", JObject::null())?;

    for (i, value) in row.get_values().enumerate() {
        let obj = match value {
            turso_core::Value::Null => JObject::null(),
            turso_core::Value::Numeric(turso_core::Numeric::Integer(i)) => {
                env.new_object("java/lang/Long", "(J)V", &[JValue::Long(*i)])?
            }
            turso_core::Value::Numeric(turso_core::Numeric::Float(f)) => {
                env.new_object("java/lang/Double", "(D)V", &[JValue::Double(f64::from(*f))])?
            }
            turso_core::Value::Text(s) => env.new_string(s.as_str())?.into(),
            turso_core::Value::Blob(b) => env.byte_array_from_slice(b.as_slice())?.into(),
        };
        if let Err(e) = env.set_object_array_element(&obj_array, i as i32, obj) {
            eprintln!("Error on parsing row: {e:?}");
        }
    }

    Ok(obj_array.into())
}

#[no_mangle]
pub extern "system" fn Java_tech_turso_core_TursoStatement_columns<'local>(
    mut env: JNIEnv<'local>,
    obj: JObject<'local>,
    stmt_ptr: jlong,
) -> JObject<'local> {
    let stmt = match to_turso_statement(stmt_ptr) {
        Ok(stmt) => stmt,
        Err(e) => {
            set_err_msg_and_throw_exception(&mut env, obj, TURSO_ETC, e.to_string());
            return JObject::null();
        }
    };
    let num_columns = stmt.stmt.num_columns();
    let obj_arr: JObjectArray = env
        .new_object_array(num_columns as i32, "java/lang/String", JObject::null())
        .unwrap();

    for i in 0..num_columns {
        let column_name = stmt.stmt.get_column_name(i);
        let str = env.new_string(column_name.into_owned()).unwrap();
        env.set_object_array_element(&obj_arr, i as i32, str)
            .unwrap();
    }

    obj_arr.into()
}

#[no_mangle]
pub extern "system" fn Java_tech_turso_core_TursoStatement_bindNull<'local>(
    mut env: JNIEnv<'local>,
    obj: JObject<'local>,
    stmt_ptr: jlong,
    position: jint,
) -> jint {
    let stmt = match to_turso_statement(stmt_ptr) {
        Ok(stmt) => stmt,
        Err(e) => {
            set_err_msg_and_throw_exception(&mut env, obj, SQLITE_ERROR, e.to_string());
            return SQLITE_ERROR;
        }
    };

    match stmt
        .stmt
        .bind_at(NonZero::new(position as usize).unwrap(), Value::Null)
    {
        Ok(()) => SQLITE_OK,
        Err(e) => {
            set_err_msg_and_throw_exception(&mut env, obj, SQLITE_ERROR, e.to_string());
            SQLITE_ERROR
        }
    }
}

#[no_mangle]
pub extern "system" fn Java_tech_turso_core_TursoStatement_bindLong<'local>(
    mut env: JNIEnv<'local>,
    obj: JObject<'local>,
    stmt_ptr: jlong,
    position: jint,
    value: jlong,
) -> jint {
    let stmt = match to_turso_statement(stmt_ptr) {
        Ok(stmt) => stmt,
        Err(e) => {
            set_err_msg_and_throw_exception(&mut env, obj, SQLITE_ERROR, e.to_string());
            return SQLITE_ERROR;
        }
    };

    match stmt.stmt.bind_at(
        NonZero::new(position as usize).unwrap(),
        Value::from_i64(value),
    ) {
        Ok(()) => SQLITE_OK,
        Err(e) => {
            set_err_msg_and_throw_exception(&mut env, obj, SQLITE_ERROR, e.to_string());
            SQLITE_ERROR
        }
    }
}

#[no_mangle]
pub extern "system" fn Java_tech_turso_core_TursoStatement_bindDouble<'local>(
    mut env: JNIEnv<'local>,
    obj: JObject<'local>,
    stmt_ptr: jlong,
    position: jint,
    value: jdouble,
) -> jint {
    let stmt = match to_turso_statement(stmt_ptr) {
        Ok(stmt) => stmt,
        Err(e) => {
            set_err_msg_and_throw_exception(&mut env, obj, SQLITE_ERROR, e.to_string());
            return SQLITE_ERROR;
        }
    };

    match stmt.stmt.bind_at(
        NonZero::new(position as usize).unwrap(),
        Value::from_f64(value),
    ) {
        Ok(()) => SQLITE_OK,
        Err(e) => {
            set_err_msg_and_throw_exception(&mut env, obj, SQLITE_ERROR, e.to_string());
            SQLITE_ERROR
        }
    }
}

#[no_mangle]
pub extern "system" fn Java_tech_turso_core_TursoStatement_bindText<'local>(
    mut env: JNIEnv<'local>,
    obj: JObject<'local>,
    stmt_ptr: jlong,
    position: jint,
    value: JString<'local>,
) -> jint {
    let stmt = match to_turso_statement(stmt_ptr) {
        Ok(stmt) => stmt,
        Err(e) => {
            set_err_msg_and_throw_exception(&mut env, obj, SQLITE_ERROR, e.to_string());
            return SQLITE_ERROR;
        }
    };

    let text: String = match env.get_string(&value) {
        Ok(s) => s.into(),
        Err(_) => return SQLITE_ERROR,
    };

    match stmt.stmt.bind_at(
        NonZero::new(position as usize).unwrap(),
        Value::build_text(text),
    ) {
        Ok(()) => SQLITE_OK,
        Err(e) => {
            set_err_msg_and_throw_exception(&mut env, obj, SQLITE_ERROR, e.to_string());
            SQLITE_ERROR
        }
    }
}

#[no_mangle]
pub extern "system" fn Java_tech_turso_core_TursoStatement_bindBlob<'local>(
    mut env: JNIEnv<'local>,
    obj: JObject<'local>,
    stmt_ptr: jlong,
    position: jint,
    value: JByteArray<'local>,
) -> jint {
    let stmt = match to_turso_statement(stmt_ptr) {
        Ok(stmt) => stmt,
        Err(e) => {
            set_err_msg_and_throw_exception(&mut env, obj, SQLITE_ERROR, e.to_string());
            return SQLITE_ERROR;
        }
    };

    let blob: Vec<u8> = match env.convert_byte_array(value) {
        Ok(b) => b,
        Err(_) => return SQLITE_ERROR,
    };

    match stmt
        .stmt
        .bind_at(NonZero::new(position as usize).unwrap(), Value::Blob(blob))
    {
        Ok(()) => SQLITE_OK,
        Err(e) => {
            set_err_msg_and_throw_exception(&mut env, obj, SQLITE_ERROR, e.to_string());
            SQLITE_ERROR
        }
    }
}

#[no_mangle]
pub extern "system" fn Java_tech_turso_core_TursoStatement_totalChanges<'local>(
    mut env: JNIEnv<'local>,
    obj: JObject<'local>,
    stmt_ptr: jlong,
) -> jlong {
    let stmt = match to_turso_statement(stmt_ptr) {
        Ok(stmt) => stmt,
        Err(e) => {
            set_err_msg_and_throw_exception(&mut env, obj, SQLITE_ERROR, e.to_string());
            return -1;
        }
    };

    stmt.connection.conn.total_changes()
}

#[no_mangle]
pub extern "system" fn Java_tech_turso_core_TursoStatement_changes<'local>(
    mut env: JNIEnv<'local>,
    obj: JObject<'local>,
    stmt_ptr: jlong,
) -> jlong {
    let stmt = match to_turso_statement(stmt_ptr) {
     
```

### Core Architecture Module: `bindings/java/rs_src/utils.rs`
```
use crate::errors::TursoError;
use jni::objects::{JByteArray, JObject};
use jni::JNIEnv;

pub(crate) fn utf8_byte_arr_to_str(
    env: &JNIEnv,
    bytes: JByteArray,
) -> crate::errors::Result<String> {
    let bytes = env
        .convert_byte_array(bytes)
        .map_err(|_| TursoError::CustomError("Failed to retrieve bytes".to_string()))?;
    let str = String::from_utf8(bytes).map_err(|_| {
        TursoError::CustomError("Failed to convert utf8 byte array into string".to_string())
    })?;
    Ok(str)
}

/// Sets the error message and throws a Java exception.
///
/// This function converts the provided error message to a byte array and calls the
/// `throwTursoException` method on the provided Java object to throw an exception.
///
/// # Parameters
/// - `env`: The JNI environment.
/// - `obj`: The Java object on which the exception will be thrown.
/// - `err_code`: The error code corresponding to the exception. Refer to `tech.turso.core.Codes` for the list of error codes.
/// - `err_msg`: The error message to be included in the exception.
///
/// # Example
/// ```rust
/// set_err_msg_and_throw_exception(env, obj, Codes::SQLITE_ERROR, "An error occurred".to_string());
/// ```
pub fn set_err_msg_and_throw_exception<'local>(
    env: &mut JNIEnv<'local>,
    obj: JObject<'local>,
    err_code: i32,
    err_msg: String,
) {
    let error_message_bytes = env
        .byte_array_from_slice(err_msg.as_bytes())
        .expect("Failed to convert to byte array");
    match env.call_method(
        obj,
        "throwTursoException",
        "(I[B)V",
        &[err_code.into(), (&error_message_bytes).into()],
    ) {
        Ok(_) => {
            // do nothing because above method will always return Err
        }
        Err(_e) => {
            // do nothing because our java app will handle Err
        }
    }
}

```

### Core Architecture Module: `bindings/javascript/packages/wasm/worker.ts`
```
import { setupWebWorker } from "@tursodatabase/database-wasm-common";
setupWebWorker();

```

### Core Architecture Module: `bindings/javascript/sync/packages/common/remote-write-statement.ts`
```
import { RemoteWriter } from "./remote-writer.js";

/**
 * Wraps a local Statement and routes execution to remote when appropriate.
 * - If remoteWriter.isInTransaction → all go remote
 * - If !stmt.readonly → remote + pull after execution
 * - Otherwise → local Statement
 */
export class RemoteWriteStatement {
    private localStmt: any;
    private sql: string;
    private isStmtReadonly: boolean;
    private remoteWriter: RemoteWriter;
    private pullFn: () => Promise<boolean>;
    private _boundArgs: any[] = [];

    constructor(
        localStmt: any,
        sql: string,
        isStmtReadonly: boolean,
        remoteWriter: RemoteWriter,
        pullFn: () => Promise<boolean>,
    ) {
        this.localStmt = localStmt;
        this.sql = sql;
        this.isStmtReadonly = isStmtReadonly;
        this.remoteWriter = remoteWriter;
        this.pullFn = pullFn;
    }

    private shouldGoRemote(): boolean {
        return this.remoteWriter.isInTransaction || !this.isStmtReadonly;
    }

    private shouldPullAfter(): boolean {
        // Pull after standalone writes (not in transaction)
        return !this.isStmtReadonly && !this.remoteWriter.isInTransaction;
    }

    raw(toggle?: boolean) {
        this.localStmt.raw(toggle);
        return this;
    }

    pluck(toggle?: boolean) {
        this.localStmt.pluck(toggle);
        return this;
    }

    safeIntegers(toggle?: boolean) {
        this.localStmt.safeIntegers(toggle);
        return this;
    }

    columns() {
        return this.localStmt.columns();
    }

    get reader(): boolean {
        return this.localStmt.reader;
    }

    bind(...bindParameters: any[]) {
        this._boundArgs = flattenArgs(bindParameters);
        this.localStmt.bind(...bindParameters);
        return this;
    }

    async run(...bindParameters: any[]) {
        if (!this.shouldGoRemote()) {
            return await this.localStmt.run(...bindParameters);
        }
        const args = bindParameters.length > 0 ? flattenArgs(bindParameters) : this._boundArgs;
        const result = await this.remoteWriter.execute(this.sql, args);
        if (this.shouldPullAfter()) {
            await this.pullFn();
        }
        return {
            changes: result.rowsAffected,
            lastInsertRowid: result.lastInsertRowid,
        };
    }

    async get(...bindParameters: any[]) {
        if (!this.shouldGoRemote()) {
            return await this.localStmt.get(...bindParameters);
        }
        const args = bindParameters.length > 0 ? flattenArgs(bindParameters) : this._boundArgs;
        const result = await this.remoteWriter.execute(this.sql, args);
        if (this.shouldPullAfter()) {
            await this.pullFn();
        }
        return result.rows.length > 0 ? result.rows[0] : undefined;
    }

    async all(...bindParameters: any[]) {
        if (!this.shouldGoRemote()) {
            return await this.localStmt.all(...bindParameters);
        }
        const args = bindParameters.length > 0 ? flattenArgs(bindParameters) : this._boundArgs;
        const result = await this.remoteWriter.execute(this.sql, args);
        if (this.shouldPullAfter()) {
            await this.pullFn();
        }
        return result.rows;
    }

    async *iterate(...bindParameters: any[]) {
        if (!this.shouldGoRemote()) {
            yield* this.localStmt.iterate(...bindParameters);
            return;
        }
        const args = bindParameters.length > 0 ? flattenArgs(bindParameters) : this._boundArgs;
        const result = await this.remoteWriter.execute(this.sql, args);
        if (this.shouldPullAfter()) {
            await this.pullFn();
        }
        for (const row of result.rows) {
            yield row;
        }
    }

    close() {
        this.localStmt.close();
    }
}

function flattenArgs(bindParameters: any[]): any[] {
    if (bindParameters.length === 1 && Array.isArray(bindParameters[0])) {
        return bindParameters[0];
    }
    return bindParameters;
}

```

### Core Architecture Module: `bindings/javascript/sync/packages/wasm/worker.ts`
```
import { setupWebWorker } from "@tursodatabase/database-wasm-common";
setupWebWorker();

```

### Core Architecture Module: `bindings/python/turso/worker.py`
```
import asyncio
from queue import SimpleQueue
from threading import Thread
from typing import Any, Callable

STOP_RUNNING_SENTINEL = object()


class Worker(Thread):
    """
    Dedicated worker thread executing database operations sequentially.

    The worker consumes (future, callable) items from the unbounded SimpleQueue.
    It executes the callable, then sets result or mapped exception on the future
    using loop.call_soon_threadsafe to synchronize with the event loop thread.

    If work item return STOP_RUNNING_SENTINEL value - it stops the execution
    (e.g. this can be used to stop worker when connection is about to close)
    """

    def __init__(
        self,
        queue: SimpleQueue[tuple[asyncio.Future, Callable[[], Any]] | None],
        loop: asyncio.AbstractEventLoop,
    ) -> None:
        super().__init__(name="turso-async-worker", daemon=True)
        self._queue = queue
        self._loop = loop

    def run(self) -> None:
        while True:
            item = self._queue.get()
            fut, func = item
            if fut.cancelled():
                # Still consume but skip execution if already cancelled
                continue
            try:
                result = func()
                if result is STOP_RUNNING_SENTINEL:
                    break
            except Exception as e:
                self._loop.call_soon_threadsafe(fut.set_exception, e)
            else:
                self._loop.call_soon_threadsafe(fut.set_result, result)

```

### Core Architecture Module: `bindings/react-native/cpp/TursoStatementHostObject.cpp`
```
#include "TursoStatementHostObject.h"
#include "TursoArrayBuffer.h"

extern "C" {
#include <turso.h>
}

namespace turso {

TursoStatementHostObject::~TursoStatementHostObject() {
    if (stmt_) {
        turso_statement_deinit(stmt_);
        stmt_ = nullptr;
    }
}

void TursoStatementHostObject::throwError(jsi::Runtime &rt, const char *error) {
    throw jsi::JSError(rt, error ? error : "Unknown error");
}

jsi::Value TursoStatementHostObject::get(jsi::Runtime &rt, const jsi::PropNameID &name) {
    auto propName = name.utf8(rt);
    auto self = shared_from_this();

    if (propName == "bindPositionalNull") {
        return jsi::Function::createFromHostFunction(rt, name, 1,
            [self](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args, size_t count) -> jsi::Value {
                return self->bindPositionalNull(rt, args, count);
            });
    }
    if (propName == "bindPositionalInt") {
        return jsi::Function::createFromHostFunction(rt, name, 2,
            [self](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args, size_t count) -> jsi::Value {
                return self->bindPositionalInt(rt, args, count);
            });
    }
    if (propName == "bindPositionalDouble") {
        return jsi::Function::createFromHostFunction(rt, name, 2,
            [self](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args, size_t count) -> jsi::Value {
                return self->bindPositionalDouble(rt, args, count);
            });
    }
    if (propName == "bindPositionalBlob") {
        return jsi::Function::createFromHostFunction(rt, name, 2,
            [self](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args, size_t count) -> jsi::Value {
                return self->bindPositionalBlob(rt, args, count);
            });
    }
    if (propName == "bindPositionalText") {
        return jsi::Function::createFromHostFunction(rt, name, 2,
            [self](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args, size_t count) -> jsi::Value {
                return self->bindPositionalText(rt, args, count);
            });
    }
    if (propName == "execute") {
        return jsi::Function::createFromHostFunction(rt, name, 0,
            [self](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *, size_t) -> jsi::Value {
                return self->execute(rt);
            });
    }
    if (propName == "step") {
        return jsi::Function::createFromHostFunction(rt, name, 0,
            [self](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *, size_t) -> jsi::Value {
                return self->step(rt);
            });
    }
    if (propName == "runIo") {
        return jsi::Function::createFromHostFunction(rt, name, 0,
            [self](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *, size_t) -> jsi::Value {
                return self->runIo(rt);
            });
    }
    if (propName == "reset") {
        return jsi::Function::createFromHostFunction(rt, name, 0,
            [self](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *, size_t) -> jsi::Value {
                return self->reset(rt);
            });
    }
    if (propName == "finalize") {
        return jsi::Function::createFromHostFunction(rt, name, 0,
            [self](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *, size_t) -> jsi::Value {
                return self->finalize(rt);
            });
    }
    if (propName == "nChange") {
        return jsi::Function::createFromHostFunction(rt, name, 0,
            [self](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *, size_t) -> jsi::Value {
                return self->nChange(rt);
            });
    }
    if (propName == "columnCount") {
        return jsi::Function::createFromHostFunction(rt, name, 0,
            [self](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *, size_t) -> jsi::Value {
                return self->columnCount(rt);
            });
    }
    if (propName == "columnName") {
        return jsi::Function::createFromHostFunction(rt, name, 1,
            [self](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args, size_t count) -> jsi::Value {
                return self->columnName(rt, args, count);
            });
    }
    if (propName == "rowValueKind") {
        return jsi::Function::createFromHostFunction(rt, name, 1,
            [self](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args, size_t count) -> jsi::Value {
                return self->rowValueKind(rt, args, count);
            });
    }
    if (propName == "rowValueBytesCount") {
        return jsi::Function::createFromHostFunction(rt, name, 1,
            [self](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args, size_t count) -> jsi::Value {
                return self->rowValueBytesCount(rt, args, count);
            });
    }
    if (propName == "rowValueBytesPtr") {
        return jsi::Function::createFromHostFunction(rt, name, 1,
            [self](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args, size_t count) -> jsi::Value {
                return self->rowValueBytesPtr(rt, args, count);
            });
    }
    if (propName == "rowValueText") {
        return jsi::Function::createFromHostFunction(rt, name, 1,
            [self](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args, size_t count) -> jsi::Value {
                return self->rowValueText(rt, args, count);
            });
    }
    if (propName == "rowValueInt") {
        return jsi::Function::createFromHostFunction(rt, name, 1,
            [self](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args, size_t count) -> jsi::Value {
                return self->rowValueInt(rt, args, count);
            });
    }
    if (propName == "rowValueDouble") {
        return jsi::Function::createFromHostFunction(rt, name, 1,
            [self](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args, size_t count) -> jsi::Value {
                return self->rowValueDouble(rt, args, count);
            });
    }
    if (propName == "namedPosition") {
        return jsi::Function::createFromHostFunction(rt, name, 1,
            [self](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args, size_t count) -> jsi::Value {
                return self->namedPosition(rt, args, count);
            });
    }
    if (propName == "parametersCount") {
        return jsi::Function::createFromHostFunction(rt, name, 0,
            [self](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *, size_t) -> jsi::Value {
                return self->parametersCount(rt);
            });
    }
    if (propName == "getAllRows") {
        return jsi::Function::createFromHostFunction(rt, name, 0,
            [self](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *, size_t) -> jsi::Value {
                return self->getAllRows(rt);
            });
    }

    return jsi::Value::undefined();
}

void TursoStatementHostObject::set(jsi::Runtime &rt, const jsi::PropNameID &name, const jsi::Value &value) {
    // Read-only object
}

std::vector<jsi::PropNameID> TursoStatementHostObject::getPropertyNames(jsi::Runtime &rt) {
    std::vector<jsi::PropNameID> props;
    props.emplace_back(jsi::PropNameID::forAscii(rt, "bindPositionalNull"));
    props.emplace_back(jsi::PropNameID::forAscii(rt, "bindPositionalInt"));
    props.emplace_back(jsi::PropNameID::forAscii(rt, "bindPositionalDouble"));
    props.emplace_back(jsi::PropNameID::forAscii(rt, "bindPositionalBlob"));
    props.emplace_back(jsi::PropNameID::forAscii(rt, "bindPositionalText"));
    props.emplace_back(jsi::PropNameID::forAscii(rt, "execute"));
    props.emplace_back(jsi::PropNameID::forAscii(rt, "step"));
    props.emplace_back(jsi::PropNameID::forAscii(rt, "runIo"));
    props.emplace_back(jsi::PropNameID::forAscii(rt, "reset"));
    props.emplace_back(jsi::PropNameID::forAscii(rt, "finalize"));
    props.emplace_back(jsi::PropNameID::forAscii(rt, "nChange"));
    props.emplace_back(jsi::PropNameID::forAscii(rt, "columnCount"));
    props.emplace_back(jsi::PropNameID::forAscii(rt, "columnName"));
    props.emplace_back(jsi::PropNameID::forAscii(rt, "rowValueKind"));
    props.emplace_back(jsi::PropNameID::forAscii(rt, "rowValueBytesCount"));
    props.emplace_back(jsi::PropNameID::forAscii(rt, "rowValueBytesPtr"));
    props.emplace_back(jsi::PropNameID::forAscii(rt, "rowValueText"));
    props.emplace_back(jsi::PropNameID::forAscii(rt, "rowValueInt"));
    props.emplace_back(jsi::PropNameID::forAscii(rt, "rowValueDouble"));
    props.emplace_back(jsi::PropNameID::forAscii(rt, "namedPosition"));
    props.emplace_back(jsi::PropNameID::forAscii(rt, "parametersCount"));
    props.emplace_back(jsi::PropNameID::forAscii(rt, "getAllRows"));
    return props;
}

// 1:1 C API mapping - NO logic, just calls through to C API

jsi::Value TursoStatementHostObject::bindPositionalNull(jsi::Runtime &rt, const jsi::Value *args, size_t count) {
    if (count < 1 || !args[0].isNumber()) {
        throw jsi::JSError(rt, "bindPositionalNull: expected number argument (position)");
    }
    size_t position = static_cast<size_t>(args[0].asNumber());
    turso_status_code_t status = turso_statement_bind_positional_null(stmt_, position);
    return jsi::Value(static_cast<int>(status));
}

jsi::Value TursoStatementHostObject::bindPositionalInt(jsi::Runtime &rt, const jsi::Value *args, size_t count) {
    if (count < 2 || !args[0].isNumber() || !args[1].isNumber()) {
        throw jsi::JSError(rt, "bindPositionalInt: expected two number arguments (position, value)");
    }
    size_t position = static_cast<size_t>(args[0].asNumber());
    int64_t value = static_cast<int64_t>(args[1].asNumber());
    turso_status_code_t status = turso_statement_bind_positional_int(stmt_, position, value);
    return jsi::Value(static_cast<int>(status));
}

jsi::Value TursoStatementHostObject::bindPositionalDouble(jsi::Runtime &rt, const jsi::Value *args, size_t count
```

### Core Architecture Module: `bindings/react-native/cpp/TursoStatementHostObject.h`
```
#pragma once

#include <jsi/jsi.h>
#include <memory>
#include <string>

// Forward declarations for Turso C API types
extern "C" {
    struct turso_statement;
    typedef struct turso_statement turso_statement_t;
}

namespace turso {

using namespace facebook;

/**
 * TursoStatementHostObject wraps turso_statement_t* (core SDK-KIT type for prepared statement).
 * This is a THIN wrapper - 1:1 mapping of SDK-KIT C API with NO logic.
 * All logic belongs in TypeScript or Rust, not here.
 */
class TursoStatementHostObject : public jsi::HostObject,
                                 public std::enable_shared_from_this<TursoStatementHostObject> {
public:
    TursoStatementHostObject(turso_statement_t* stmt) : stmt_(stmt) {}
    ~TursoStatementHostObject();

    // JSI HostObject interface
    jsi::Value get(jsi::Runtime &rt, const jsi::PropNameID &name) override;
    void set(jsi::Runtime &rt, const jsi::PropNameID &name, const jsi::Value &value) override;
    std::vector<jsi::PropNameID> getPropertyNames(jsi::Runtime &rt) override;

    // Direct access to wrapped pointer (for internal use)
    turso_statement_t* getStatement() const { return stmt_; }

private:
    turso_statement_t* stmt_ = nullptr;

    // Helper to throw JS errors
    void throwError(jsi::Runtime &rt, const char *error);

    // 1:1 C API mapping methods (NO logic - just calls through to C API)
    jsi::Value bindPositionalNull(jsi::Runtime &rt, const jsi::Value *args, size_t count);
    jsi::Value bindPositionalInt(jsi::Runtime &rt, const jsi::Value *args, size_t count);
    jsi::Value bindPositionalDouble(jsi::Runtime &rt, const jsi::Value *args, size_t count);
    jsi::Value bindPositionalBlob(jsi::Runtime &rt, const jsi::Value *args, size_t count);
    jsi::Value bindPositionalText(jsi::Runtime &rt, const jsi::Value *args, size_t count);
    jsi::Value execute(jsi::Runtime &rt);
    jsi::Value step(jsi::Runtime &rt);
    jsi::Value runIo(jsi::Runtime &rt);
    jsi::Value reset(jsi::Runtime &rt);
    jsi::Value finalize(jsi::Runtime &rt);
    jsi::Value nChange(jsi::Runtime &rt);
    jsi::Value columnCount(jsi::Runtime &rt);
    jsi::Value columnName(jsi::Runtime &rt, const jsi::Value *args, size_t count);
    jsi::Value rowValueKind(jsi::Runtime &rt, const jsi::Value *args, size_t count);
    jsi::Value rowValueBytesCount(jsi::Runtime &rt, const jsi::Value *args, size_t count);
    jsi::Value rowValueBytesPtr(jsi::Runtime &rt, const jsi::Value *args, size_t count);
    jsi::Value rowValueText(jsi::Runtime &rt, const jsi::Value *args, size_t count);
    jsi::Value rowValueInt(jsi::Runtime &rt, const jsi::Value *args, size_t count);
    jsi::Value rowValueDouble(jsi::Runtime &rt, const jsi::Value *args, size_t count);
    jsi::Value namedPosition(jsi::Runtime &rt, const jsi::Value *args, size_t count);
    jsi::Value parametersCount(jsi::Runtime &rt);
    jsi::Value getAllRows(jsi::Runtime &rt);
};

} // namespace turso

```

### Core Architecture Module: `bindings/react-native/src/Statement.ts`
```
/**
 * Statement
 *
 * High-level wrapper around NativeStatement providing a clean API.
 * Handles parameter binding, row conversion, and result collection.
 */

import type { AsyncLock } from './AsyncLock';
import type {
  NativeConnection,
  NativeStatement,
  SQLiteValue,
  BindParams,
  Row,
  RunResult,
} from './types';
import { TursoStatus, TursoType } from './types';

/**
 * Prepared SQL statement
 */
export class Statement {
  private _statement: NativeStatement;
  private _connection: NativeConnection;
  private _execLock: AsyncLock | null;
  private _finalized = false;
  private _extraIo?: () => Promise<void>;

  constructor(statement: NativeStatement, connection: NativeConnection, execLock: AsyncLock | null, extraIo?: () => Promise<void>) {
    this._statement = statement;
    this._connection = connection;
    this._execLock = execLock;
    this._extraIo = extraIo;
  }

  /**
   * Bind parameters to the statement
   *
   * @param params - Parameters to bind (array, object, or single value)
   * @returns this for chaining
   */
  bind(...params: BindParams[]): this {
    if (this._finalized) {
      throw new Error('Statement has been finalized');
    }

    // Flatten parameters if single array passed
    let flatParams: SQLiteValue[];
    if (params.length === 1 && Array.isArray(params[0])) {
      flatParams = params[0];
    } else if (params.length === 1 && typeof params[0] === 'object' && params[0] !== null) {
      // Named parameters
      const namedParams = params[0] as Record<string, SQLiteValue>;
      this.bindNamed(namedParams);
      return this;
    } else {
      flatParams = params as SQLiteValue[];
    }

    // Bind positional parameters
    this.bindPositional(flatParams);
    return this;
  }

  /**
   * Bind positional parameters (1-indexed)
   *
   * @param params - Array of values to bind
   */
  private bindPositional(params: SQLiteValue[]): void {
    for (let i = 0; i < params.length; i++) {
      const position = i + 1; // 1-indexed
      const value = params[i]!;

      this.bindValue(position, value);
    }
  }

  /**
   * Bind named parameters
   *
   * @param params - Object with named parameters
   */
  private bindNamed(params: Record<string, SQLiteValue>): void {
    for (const [name, value] of Object.entries(params)) {
      // Get position for named parameter
      const position = this._statement.namedPosition(name);
      if (position < 0) {
        throw new Error(`Unknown parameter name: ${name}`);
      }

      this.bindValue(position, value);
    }
  }

  /**
   * Bind a single value at a position
   *
   * @param position - 1-indexed position
   * @param value - Value to bind
   */
  private bindValue(position: number, value: SQLiteValue): void {
    if (value === null || value === undefined) {
      this._statement.bindPositionalNull(position);
    } else if (typeof value === 'number') {
      // Check if integer or float
      if (Number.isInteger(value)) {
        this._statement.bindPositionalInt(position, value);
      } else {
        this._statement.bindPositionalDouble(position, value);
      }
    } else if (typeof value === 'string') {
      this._statement.bindPositionalText(position, value);
    } else if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
      const buffer = value as unknown as ArrayBuffer;
      this._statement.bindPositionalBlob(position, buffer);
    } else {
      throw new Error(`Unsupported parameter type: ${typeof value}`);
    }
  }

  /**
   * Execute statement without returning rows (for INSERT, UPDATE, DELETE)
   *
   * @param params - Optional parameters to bind
   * @returns Result with changes and lastInsertRowid
   */
  async run(...params: BindParams[]): Promise<RunResult> {
    if (this._finalized) {
      throw new Error('Statement has been finalized');
    }

    if (this._execLock) {
      await this._execLock.acquire();
    }
    try {
      // Bind parameters inside the lock to prevent concurrent bind/execute races
      if (params.length > 0) {
        this.bind(...params);
      }
      return await this._runInner();
    } finally {
      this._statement.reset();
      if (this._execLock) {
        this._execLock.release();
      }
    }
  }

  /**
   * Execute without acquiring the lock (caller already holds it).
   * Used by Database.exec() and Transaction which acquire the lock once.
   */
  async rawRun(): Promise<RunResult> {
    if (this._finalized) {
      throw new Error('Statement has been finalized');
    }

    try {
      return await this._runInner();
    } finally {
      this._statement.reset();
    }
  }

  private async _runInner(): Promise<RunResult> {
    // Execute statement with IO handling
    const result = await this.executeWithIo();

    return {
      changes: result.rowsChanged,
      lastInsertRowid: this._connection ? this._connection.lastInsertRowid() : 0,
    };
  }

  /**
   * Execute statement handling potential IO (for partial sync)
   * Matches Python's _run_execute_with_io pattern
   *
   * @returns Execution result
   */
  private async executeWithIo(): Promise<{ status: number; rowsChanged: number }> {
    while (true) {
      const result = this._statement.execute();

      if (result.status === TursoStatus.IO) {
        // Statement needs IO (e.g., loading missing pages with partial sync)
        this._statement.runIo();

        // Drain sync engine IO queue
        if (this._extraIo) {
          await this._extraIo();
        }

        continue;
      }

      if (result.status !== TursoStatus.DONE) {
        throw new Error(`Statement execution failed with status: ${result.status}`);
      }

      return result;
    }
  }

  /**
   * Step statement once handling potential IO (for partial sync)
   * Matches Python's _step_once_with_io pattern
   *
   * @returns Status code
   */
  private async stepWithIo(): Promise<number> {
    while (true) {
      const status = this._statement.step();

      if (status === TursoStatus.IO) {
        // Statement needs IO (e.g., loading missing pages with partial sync)
        this._statement.runIo();

        // Drain sync engine IO queue
        if (this._extraIo) {
          await this._extraIo();
        }

        continue;
      }

      return status;
    }
  }

  /**
   * Execute statement and return first row
   *
   * @param params - Optional parameters to bind
   * @returns First row or undefined
   */
  async get(...params: BindParams[]): Promise<Row | undefined> {
    if (this._finalized) {
      throw new Error('Statement has been finalized');
    }

    if (this._execLock) {
      await this._execLock.acquire();
    }
    try {
      // Bind parameters inside the lock to prevent concurrent bind/execute races
      if (params.length > 0) {
        this.bind(...params);
      }

      // Step once with async IO handling
      const status = await this.stepWithIo();

      if (status === TursoStatus.ROW) {
        const row = this.readRow();
        return row;
      }

      if (status === TursoStatus.DONE) {
        return undefined;
      }

      throw new Error(`Statement step failed with status: ${status}`);
    } finally {
      this._statement.reset();
      if (this._execLock) {
        this._execLock.release();
      }
    }
  }

  /**
   * Execute statement and return all rows
   *
   * @param params - Optional parameters to bind
   * @returns Array of rows
   */
  async all(...params: BindParams[]): Promise<Row[]> {
    if (this._finalized) {
      throw new Error('Statement has been finalized');
    }

    if (this._execLock) {
      await this._execLock.acquire();
    }
    try {
      // Bind parameters inside the lock to prevent concurrent bind/execute races
      if (params.length > 0) {
        this.bind(...params);
      }

      // Fast path: native bulk read (handles step+read loop in C++)
      // Re-enters native after each IO resolution to stay on the fast path
      let rows: Row[] = [];
      const MAX_IO_RETRIES = 1000000;

      for (let ioRetries = 0; ioRetries < MAX_IO_RETRIES; ioRetries++) {
        const bulk = this._statement.getAllRows();
        if (bulk.rows && bulk.rows.length > 0) {
          rows = rows.concat(bulk.rows);
        }

        if (bulk.status === TursoStatus.DONE) {
          return rows;
        }

        if (bulk.status === TursoStatus.IO) {
          this._statement.runIo();
          if (this._extraIo) {
            await this._extraIo();
          }
          continue;
        }

        throw new Error(`getAllRows failed with status: ${bulk.status}`);
      }

      throw new Error(`getAllRows: exceeded ${MAX_IO_RETRIES} IO retries`);
    } finally {
      this._statement.reset();
      if (this._execLock) {
        this._execLock.release();
      }
    }
  }

  /**
   * Read current row into an object
   *
   * @returns Row object with column name keys
   */
  private readRow(): Row {
    const row: Row = {};
    const columnCount = this._statement.columnCount();

    for (let i = 0; i < columnCount; i++) {
      const name = this._statement.columnName(i);
      if (!name) {
        throw new Error(`Failed to get column name at index ${i}`);
      }

      const value = this.readColumnValue(i);
      row[name] = value;
    }

    return row;
  }

  /**
   * Read value at column index
   *
   * @param index - Column index
   * @returns Column value
   */
  private readColumnValue(index: number): SQLiteValue {
    const kind = this._statement.rowValueKind(index);

    switch (kind) {
      case TursoType.NULL:
        return null;

      case TursoType.INTEGER:
        return this._statement.rowValueInt(index);

      case TursoType.REAL:
        return this._statement.rowValueDouble(index);

      case TursoType.TEXT:
        // Use rowValueText which directly returns a string from C++ (avoids encoding issues)
        return this._statement.rowValueText(index);

      case TursoType.BLOB:
        return this._statement.rowValueBytesPtr(inde
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #12640** (2026-11-28): **dialect-definitions: move the SQLite dialect to a crate that both frontends use**
  *Symptoms*: The PostgreSQL frontend depended on `turso_sqlite`. It used `SqliteDialect` to parse the statements that core and the frontend run for themselves, and to parse the generated catalog tables. Thus each PostgreSQL binary linked the crate of the SQLite frontend.  This PR adds the crate `turso_dialect_definitions`, which holds `SqliteDialect`.  - `turso_sqlite` exports `SqliteDialect` again, so the crates that use it do not change. - `turso_pg` depends on `turso_dialect_definitions` and no longer on `turso_sqlite`. - `scripts/publish-crates.sh` publishes the new crate before `turso_sqlite`.  No behavior changes.  The purpose is the NaN work of #12592. With this split, `turso_sqlite` is in each SQLite binary and in no PostgreSQL binary, and `turso_pg` is the opposite. Each of the two crates can then give core its own functions to read and write a REAL in a record, and the linker selects the correct pair for each binary.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 

- **Issue #12639** (2026-11-28): **postgres: open only PostgreSQL databases in the frontend tests**
  *Symptoms*: Three tests in `turso_pg` opened a database with the SQLite dialect. Thus a PostgreSQL test binary held databases of two dialects. This PR removes that, so that a binary opens databases of one dialect only. A rule that depends on the dialect, such as the NaN rule of #12592, can then be one value for the whole process.  - `test_postgres_tables_hidden_in_sqlite_mode` is removed. It tested that the SQLite dialect has no `pg_class` and no `pg_namespace`, which is a property of the SQLite frontend. - `reset_reports_frontend_errors` is removed. It used a deferred foreign key to make `reset` fail. The PostgreSQL frontend rejects `DEFERRABLE` with 0A000, so a PostgreSQL database cannot reach that state. - The foreign key test in `embedded_errors` compared the rows and the transaction state with a SQLite database. It now states the expected rows and the transaction state directly. The values are the same as before.  `turso_pg` still depends on `turso_sqlite`: the frontend uses the SQLite dialect as the parser for internal SQL. It no longer opens a SQLite database.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 
  **Post-Mortem & Fix Analysis**:
  > ### Autofixer review <sub>🔄 Autofixer updates this comment while the review runs.</sub>  A maintainer asked Autofixer to review this pull request. The review of `4c34ca5eb65b` is [here](https://github.com/tursodatabase/turso/pull/12639#pullrequestreview-6095242095).  ✅ **Verdict: looks good to merge.**  <sub>Automated review by Autofixer; maintainers decide what to merge. Autofixer reviews every new commit pushed to this pull request, up to 3 reviews each time the `autofixer: review-requested` label is added. It then removes the label; adding the label again asks for more.</sub>  <!-- autofixer:ratings:eyJ2ZXJzaW9uIjoxLCJoZWFkU2hhIjoiNGMzNGNhNWViNjViZGQwZDU2MGJlZDAwMTA2NWIyMWExMDk1ODNiYSIsImltcGFjdCI6eyJjYXRlZ29yeSI6Ik9wZXJhdGlvbnMgYW5kIHRvb2xpbmciLCJyZWFjaCI6ImVkZ2UtY2FzZSJ9LCJyaXNrIjp7ImxldmVsIjoibG93IiwiYXJlYXMiOlt7ImFyZWEiOiJQb3N0Z3JlU1FMIGNvbXBhdGliaWxpdHkiLCJkb25lIjoxLCJvcGVuIjowfSx7ImFyZWEiOiJTUUxpdGUgb3IgUG9zdGdyZVNRTCBjb21wYXRpYmlsaXR5IiwiZG9uZSI6Miwib3BlbiI6MH0seyJhcmVhIjoid

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

### Incident Patch 1: `f1658dc4` (2026-11-28)
**Commit Message**: Merge 'postgres: register the uuid type' from Glauber Costa

tursopg did not have a uuid type of its own. It used the uuid type of
core, which has no INPUT and reads text with the Rust `uuid` crate. That
crate accepts `urn:uuid:` and refuses some forms that PostgreSQL reads.
The frontend also had two hand-written checks, and `auth.uid()` had its
own parser. Each of them read uuid text a little differently. A cast
between uuid and a type with no cast in PostgreSQL, such as `5::uuid`,
gave 22P02 or stored a wrong value, where PostgreSQL gives 42846.

This PR registers a uuid type in the frontend. It follows oid, the
integer types and boolean, and it is part of the work that registers the
types of `pg_type` explicitly. The INPUT is a line-by-line port of
`string_to_uuid` from PostgreSQL 18, and DECODE is a port of `uuid_out`.
So tursopg reads the same text as PostgreSQL does: braces, no hyphens, a
hyphen after every four digits, upper case, and no surrounding space.
The stored bytes sort as `uuid_cmp` orders the values, so the type needs
no comparator.

## Commits, in order

1. `postgres: register a uuid type with its own INPUT`. The type, with
the ports and unit tests.
2. `postgres: 

**File**: `Cargo.lock` (modified, +0/-1)
```diff
@@ -7370,7 +7370,6 @@ dependencies = [
  "turso_pg_catalog",
  "turso_pg_parser",
  "turso_sqlite",
- "uuid",
 ]
 
 [[package]]
```

**File**: `postgres/COMPAT.md` (modified, +2/-2)
```diff
@@ -78,7 +78,7 @@ Basics not enumerated by the official feature matrix.
 | TRUNCATE | 🟡 Partial | Lowered to DELETE of one table; several tables, CASCADE and RESTART IDENTITY rejected |
 | BEGIN / COMMIT / ROLLBACK | ✅ Supported | Every transaction is snapshot isolation, i.e. REPEATABLE READ; `ISOLATION LEVEL REPEATABLE READ` is accepted, every other level, DEFERRABLE and AND CHAIN are rejected. READ ONLY and READ WRITE are enforced, on BEGIN and on SET TRANSACTION; switching a READ ONLY transaction to READ WRITE after its first query is rejected with SQLSTATE 25001 like PostgreSQL. A statement error aborts the transaction but keeps its savepoints, so ROLLBACK TO recovers it; a failed COMMIT rolls the transaction back and returns the connection to idle |
 | LOCK TABLE | 🟡 Partial | ACCESS SHARE without NOWAIT is accepted as a no-op inside a transaction for pg_dump compatibility; table names are not checked, no locks are acquired, and no read snapshot is started; other modes are rejected |
-| Casts (`expr::type`, CAST) | 🟡 Partial | Also `int4(x)`-style cast functions. Casts to and from int2, int4, int8, float4, float8, bool and text follow `pg_cast`, which lists them: a pair PostgreSQL has no cast for fails with 42846. A cast to uuid gives a value of the uuid type, and fails with 22P02 when the text is not a UUID. A value written to a column by INSERT, UPDATE, ON CONFLICT DO UPDATE, a default or a stored generated column is converted to the column type as an assignment cast, and fails with 42804 when PostgreSQL has no assignment cast. CREATE TABLE and ALTER TABLE ADD COLUMN refuse a column default with no assignment cast to the column type, with 42804 and PostgreSQL's message, which names a real or numeric column as double precision. ADD COLUMN writes a default of another type, converted, into the rows that exist. A value is converted before NOT NULL is checked. Floats round to an integer half to even. A numeric literal and a numeric with a type modifier round half away from zero, as in PostgreSQL. A numeric column without a type modifier and numeric arithmetic are REAL, so they round half to even: 4.5 in a `numeric` column cast or written to an integer is 4, where PostgreSQL gives 5. The range of the target is checked. A float8 cast or written to text is in PostgreSQL's form, such as `3` and `1e+20`. regclass casts from text by looking the name up as PostgreSQL does (schema, search path, quoting, digits as an oid) and to text by printing the name, with `42P01` for a relation that does not exist. It finds the relations that `pg_class` lists (tables, views, sequences and indexes under the name `pg_class` gives them, and the catalogs) and the other PostgreSQL catalog tables by their PostgreSQL oid. A catalog view that `pg_class` does not list does not exist here, so its name fails with `42P01`. A regclass column prints the name in a result and in COPY, as PostgreSQL does, and the binary format sends the oid; a binary regclass parameter is refused with 0A000. `regclass[]` and a column of another reg type are still integers, and so is a regclass that goes through an expression such as `min`, `max`, `CASE`, `||`, `concat`, `format` or an array constructor: the engine, not PostgreSQL's rules, gives the expression its type, so it can print the number where PostgreSQL prints the name (`||`, `concat`, `format`, arrays) or the name where PostgreSQL prints the oid (`min`, `max`). A regclass constant that a view, a default, a check, an index, a policy or a materialized view stores is read as the oid of its relation when the statement runs, as in PostgreSQL, so renaming the relation does not break it and a name with no relation fails the statement with `42P01`. This covers a string constant cast to regclass and a string default of a regclass column, and not a name that reaches regclass another way, such as the argument of `nextval`. A constant that names the table the same statement creates keeps its name, because the table has no oid yet. The object keeps no dependency on the relation, so `DROP TABLE` of that relation is not refused, and the oid then prints as a number. For the same reason pg_dump does not order a table before the table that its default names, so such a dump may not restore. A domain over regclass does not read or print relation names yet: a string default or a text value of the domain fails, and its values print as numbers. A quoted schema name in a regclass matches without regard to case. The casts of date, json, jsonb, uuid, bytea, inet, cidr, macaddr, the reg types other than regclass, arrays, enums and domains are not in `pg_cast` yet: the engine decides them by its own rules, which accept some casts PostgreSQL refuses (`types/cast-matrix.sqltest` has a gap test for each). A cast of another built-in type, such as point or xid, fails with 0A000. Not covered: bytea, which is not a registered type yet, so its casts are not in `pg_cast` and a text literal is not read as bytea input; casts to numeri
```

**File**: `postgres/conformance/pg-sqltests/auth.sqltest` (modified, +0/-15)
```diff
@@ -153,7 +153,6 @@ expect {
 }
 
 @setup auth_functions
-@compat-gap "type:uuid"
 test auth-uid-of-a-uuid-with-a-hyphen-after-every-four-digits {
     SELECT set_config('request.jwt.claim.sub', 'a0ee-bc99-9c0b-4ef8-bb6d-6bb9-bd38-0a11', false);
     SELECT auth.uid();
@@ -162,13 +161,8 @@ expect {
     a0ee-bc99-9c0b-4ef8-bb6d-6bb9-bd38-0a11
     a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
 }
-@sqlstate 22P02
-expect @tursopg error {
-    invalid input syntax for type uuid: "a0ee-bc99-9c0b-4ef8-bb6d-6bb9-bd38-0a11"
-}
 
 @setup auth_functions
-@compat-gap "type:uuid"
 test auth-uid-of-32-digits-in-braces {
     SELECT set_config('request.jwt.claim.sub', '{a0eebc999c0b4ef8bb6d6bb9bd380a11}', false);
     SELECT auth.uid();
@@ -177,13 +171,8 @@ expect {
     {a0eebc999c0b4ef8bb6d6bb9bd380a11}
     a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
 }
-@sqlstate 22P02
-expect @tursopg error {
-    invalid input syntax for type uuid: ".a0eebc999c0b4ef8bb6d6bb9bd380a11."
-}
 
 @setup auth_functions
-@compat-gap "type:uuid"
 test auth-uid-of-a-urn {
     SELECT set_config('request.jwt.claim.sub', 'urn:uuid:a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', false);
     SELECT auth.uid();
@@ -192,10 +181,6 @@ test auth-uid-of-a-urn {
 expect error {
     invalid input syntax for type uuid: "urn:uuid:a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
 }
-expect @tursopg {
-    urn:uuid:a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
-    a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
-}
 
 @setup auth_functions
 test auth-uid-of-text-that-is-not-a-uuid-errors {
```

**File**: `postgres/conformance/pg-sqltests/types/cast-matrix.sqltest` (modified, +0/-15)
```diff
@@ -831,32 +831,23 @@ expect {
     a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
 }
 
-@compat-gap "cast:uuid -> int4"
 test cast-uuid-to-int4 {
     SELECT 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid::int4;
 }
 @sqlstate 42846
 expect error {}
-@sqlstate 22P02
-expect @tursopg error {}
 
-@compat-gap "cast:int4 -> uuid"
 test cast-int4-to-uuid {
     SELECT 5::uuid;
 }
 @sqlstate 42846
 expect error {}
-@sqlstate 22P02
-expect @tursopg error {}
 
-@compat-gap "cast:bool -> uuid"
 test cast-bool-to-uuid {
     SELECT true::uuid;
 }
 @sqlstate 42846
 expect error {}
-@sqlstate 22P02
-expect @tursopg error {}
 
 @compat-gap "type:bytea"
 test cast-text-literal-to-bytea {
@@ -2358,27 +2349,21 @@ expect {
     a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
 }
 
-@compat-gap "cast:int4 -> uuid"
 test assign-int4-to-uuid-column {
     CREATE TABLE t (c uuid);
     INSERT INTO t VALUES (5);
     SELECT c FROM t;
 }
 @sqlstate 42804
 expect error {}
-@sqlstate 22P02
-expect @tursopg error {}
 
-@compat-gap "cast:uuid -> int4"
 test assign-uuid-to-int4-column {
     CREATE TABLE t (c int);
     INSERT INTO t VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid);
     SELECT c FROM t;
 }
 @sqlstate 42804
 expect error {}
-@sqlstate 23000
-expect @tursopg error {}
 
 test assign-uuid-to-text-column {
     CREATE TABLE t (c text);
```

**File**: `postgres/conformance/pg-sqltests/types/uuid.sqltest` (added, +356/-0)
```diff
@@ -0,0 +1,356 @@
+# The uuid type is 16 bytes. It reads text as PostgreSQL does, writes it in the
+# canonical form, and sorts by its bytes.
+
+@database :memory:
+
+test uuid-reads-the-forms-that-postgres-reads {
+    SELECT
+        'A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11'::uuid,
+        '{a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11}'::uuid,
+        'a0eebc999c0b4ef8bb6d6bb9bd380a11'::uuid,
+        '{a0eebc999c0b4ef8bb6d6bb9bd380a11}'::uuid,
+        'a0ee-bc99-9c0b-4ef8-bb6d-6bb9-bd38-0a11'::uuid,
+        'a0eebc99-9c0b4ef8-bb6d6bb9-bd380a11'::uuid;
+}
+expect {
+    a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11|a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11|a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11|a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11|a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11|a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
+}
+
+test uuid-names-the-text-it-refuses {
+    SELECT 'nope'::uuid;
+}
+@sqlstate 22P02
+expect error {
+    invalid input syntax for type uuid: "nope"
+}
+
+test uuid-refuses-text-with-a-space-around-it {
+    SELECT ' a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid;
+}
+@sqlstate 22P02
+expect error {
+    invalid input syntax for type uuid: " a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
+}
+
+test uuid-refuses-a-urn {
+    SELECT 'urn:uuid:a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid;
+}
+@sqlstate 22P02
+expect error {}
+
+test uuid-refuses-a-hyphen-after-the-last-group {
+    SELECT 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11-'::uuid;
+}
+@sqlstate 22P02
+expect error {}
+
+test uuid-refuses-a-hyphen-inside-a-group {
+    SELECT 'a0eebc9-99c0b-4ef8-bb6d-6bb9bd380a11'::uuid;
+}
+@sqlstate 22P02
+expect error {}
+
+test uuid-refuses-unbalanced-braces {
+    SELECT (chr(123) || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')::uuid;
+}
+@sqlstate 22P02
+expect error {}
+
+test uuid-refuses-too-few-digits {
+    SELECT 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a1'::uuid;
+}
+@sqlstate 22P02
+expect error {}
+
+test uuid-refuses-empty-text {
+    SELECT ''::uuid;
+}
+@sqlstate 22P02
+expect error {
+    invalid input syntax for type uuid: ""
+}
+
+test uuid-column-keeps-the-canonical-form {
+    CREATE TABLE t (u uuid);
+    INSERT INTO t VALUES ('{A0EEBC999C0B4EF8BB6D6BB9BD380A11}');
+    SELECT u, u::text FROM t;
+}
+expect {
+    a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11|a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
+}
+
+test uuid-column-refuses-text-that-is-not-a-uuid {
+    CREATE TABLE t (u uuid);
+    INSERT INTO t VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a1');
+}
+@sqlstate 22P02
+expect error {
+    invalid input syntax for type uuid: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a1"
+}
+
+test uuid-column-takes-null {
+    CREATE TABLE t (u uuid);
+    INSERT INTO t VALUES (NULL);
+    SELECT u IS NULL FROM t;
+}
+expect {
+    t
+}
+
+test uuid-compares-equal-across-spellings {
+    SELECT
+        'A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11'::uuid = 'a0eebc999c0b4ef8bb6d6bb9bd380a11'::uuid,
+        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid <> 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid;
+}
+expect {
+    t|t
+}
+
+test uuid-sorts-by-its-bytes {
+    CREATE TABLE t (u uuid);
+    INSERT INTO t VALUES
+        ('ffffffff-ffff-ffff-ffff-ffffffffffff'),
+        ('00000000-0000-0000-0000-0000000000ff'),
+        ('80000000-0000-0000-0000-000000000000'),
+        ('00000000-0000-0000-0000-000000000001'),
+        ('7fffffff-ffff-ffff-ffff-ffffffffffff');
+    SELECT u FROM t ORDER BY u;
+}
+expect {
+    00000000-0000-0000-0000-000000000001
+    00000000-0000-0000-0000-0000000000ff
+    7fffffff-ffff-ffff-ffff-ffffffffffff
+    80000000-0000-0000-0000-000000000000
+    ffffffff-ffff-ffff-ffff-ffffffffffff
+}
+
+test uuid-sorts-in-descending-order {
+    CREATE TABLE t (u uuid);
+    INSERT INTO t VALUES
+        ('80000000-0000-0000-0000-000000000000'),
+        ('7fffffff-ffff-ffff-ffff-ffffffffffff'),
+        ('00000000-0000-0000-0000-000000000001');
+    SELECT u FROM t ORDER BY u DESC;
+}
+expect {
+    80000000-0000-0000-0000-000000000000
+    7fffffff-ffff-ffff-ffff-ffffffffffff
+    00000000-0000-0000-0000-000000000001
+}
+
+test uuid-comparison-operators-follow-the-bytes {
+    SELECT
+        '80000000-0000-0000-0000-000000000000'::uuid > '7fffffff-ffff-ffff-ffff-ffffffffffff'::uuid,
+        '00000000-0000-0000-0000-000000000001'::uuid < '00000000-0000-0000-0000-0000000000ff'::uuid,
+        '00000000-0000-0000-0000-000000000001'::uuid <= '00000000-0000-0000-0000-000000000001'::uuid,
+        '00000000-0000-0000-0000-000000000001'::uuid >= '00000000-0000-0000-0000-000000000002'::uuid;
+}
+expect {
+    t|t|t|f
+}
+
+test uuid-between-follows-the-bytes {
+    CREATE TABLE t (u uuid);
+    INSERT INTO t VALUES
+        ('00000000-0000-0000-0000-000000000001'),
+        ('7fffffff-ffff-ffff-ffff-ffffffffffff'),
+        ('80000000-0000-0000-0000-000000000000'),
+        ('ffffffff-ffff-ffff-ffff-ffffffffffff');
+    SELECT u FROM t
+    WHERE u BETWEEN '7fffffff-ffff-ffff-ffff-ffffffffffff' AND '80000000-0000-0000-0000-000000000000'
+    ORDER BY u;
+}
+expect {
+    7f
```

**File**: `postgres/frontend/Cargo.toml` (modified, +0/-1)
```diff
@@ -30,7 +30,6 @@ turso_ext = { workspace = true, features = ["core_only"] }
 turso_pg_catalog = { workspace = true }
 turso_pg_parser = { workspace = true }
 turso_sqlite = { workspace = true }
-uuid = "1.11.0"
 
 [dev-dependencies]
 turso_core = { workspace = true, features = ["io_memory_yield", "test_helper"] }
```

**File**: `postgres/frontend/auth_functions.rs` (modified, +1/-14)
```diff
@@ -1,8 +1,7 @@
-use crate::error::sqlstate_error;
 use crate::functions::{invalid_json, pg_scalar_function, unsupported_unicode_escape, Uuid};
+use crate::pg_type::canonical_uuid;
 use turso_core::native_ext::FunctionArity;
 use turso_core::{Connection, OpenOptions, Result};
-use turso_pg_parser::sqlstate::SQLSTATE_INVALID_TEXT_REPRESENTATION;
 
 pub(crate) fn register_functions(options: OpenOptions) -> OpenOptions {
     options
@@ -44,18 +43,6 @@ fn claim(conn: &Connection, setting_name: &str, claim_name: &str) -> Result<Opti
     })
 }
 
-fn canonical_uuid(text: &str) -> Result<String> {
-    uuid::Uuid::parse_str(text)
-        .map(|uuid| uuid.hyphenated().to_string())
-        .map_err(|_| {
-            sqlstate_error(
-                SQLSTATE_INVALID_TEXT_REPRESENTATION,
-                format!("invalid input syntax for type uuid: \"{text}\""),
-                None,
-            )
-        })
-}
-
 fn jwt(conn: &Connection) -> Result<Option<String>> {
     let Some(claims) =
         setting(conn, "request.jwt.claim").or_else(|| setting(conn, "request.jwt.claims"))
```

**File**: `postgres/frontend/cast_planning.rs` (modified, +1/-1)
```diff
@@ -205,6 +205,7 @@ fn registered_cast_type(name: &str) -> Option<CastType> {
         "boolean" => Bool,
         "oid" => Oid,
         "regclass" => RegClass,
+        "uuid" => Uuid,
         "timestamp" => Timestamp,
         "timestamptz" => TimestampTz,
         // FIXME(pg-catalog): numeric is registered only with a type modifier. Without one it is REAL, which `is_lowered_type_name` leaves to the engine. A numeric type that needs no modifier lets every numeric go through CASTS.
@@ -255,7 +256,6 @@ const ENGINE_RULE_TYPES: &[&str] = &[
     "time",
     "json",
     "jsonb",
-    "uuid",
     "bytea",
     "inet",
     "cidr",
```

---

### Incident Patch 2: `72d81ab5` (2026-11-28)
**Commit Message**: postgres: put the casts of uuid under the cast table

A cast from or to uuid was decided by the rules of the engine. So
5::uuid, true::uuid and uuid::int4 gave 22P02 or stored the wrong
thing, and INSERT of an integer into a uuid column gave 22P02 where
PostgreSQL gives 42804.

uuid is now a type of the cast table. PostgreSQL has no row of pg_cast
for uuid, because its casts go through text: text to uuid is an
explicit cast that reads the text with the INPUT, and uuid to text is
an assignment cast. Any other pair fails with 42846 in a CAST and 42804
when a value is written to a column. Because uuid has no row, pg_cast
does not change.

The five gap tests for these casts now pass, and their tags and the
tursopg-only expectations are removed.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

**File**: `postgres/conformance/pg-sqltests/types/cast-matrix.sqltest` (modified, +0/-15)
```diff
@@ -831,32 +831,23 @@ expect {
     a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
 }
 
-@compat-gap "cast:uuid -> int4"
 test cast-uuid-to-int4 {
     SELECT 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid::int4;
 }
 @sqlstate 42846
 expect error {}
-@sqlstate 22P02
-expect @tursopg error {}
 
-@compat-gap "cast:int4 -> uuid"
 test cast-int4-to-uuid {
     SELECT 5::uuid;
 }
 @sqlstate 42846
 expect error {}
-@sqlstate 22P02
-expect @tursopg error {}
 
-@compat-gap "cast:bool -> uuid"
 test cast-bool-to-uuid {
     SELECT true::uuid;
 }
 @sqlstate 42846
 expect error {}
-@sqlstate 22P02
-expect @tursopg error {}
 
 @compat-gap "type:bytea"
 test cast-text-literal-to-bytea {
@@ -2358,27 +2349,21 @@ expect {
     a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
 }
 
-@compat-gap "cast:int4 -> uuid"
 test assign-int4-to-uuid-column {
     CREATE TABLE t (c uuid);
     INSERT INTO t VALUES (5);
     SELECT c FROM t;
 }
 @sqlstate 42804
 expect error {}
-@sqlstate 22P02
-expect @tursopg error {}
 
-@compat-gap "cast:uuid -> int4"
 test assign-uuid-to-int4-column {
     CREATE TABLE t (c int);
     INSERT INTO t VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid);
     SELECT c FROM t;
 }
 @sqlstate 42804
 expect error {}
-@sqlstate 23000
-expect @tursopg error {}
 
 test assign-uuid-to-text-column {
     CREATE TABLE t (c text);
```

**File**: `postgres/frontend/cast_planning.rs` (modified, +1/-1)
```diff
@@ -205,6 +205,7 @@ fn registered_cast_type(name: &str) -> Option<CastType> {
         "boolean" => Bool,
         "oid" => Oid,
         "regclass" => RegClass,
+        "uuid" => Uuid,
         "timestamp" => Timestamp,
         "timestamptz" => TimestampTz,
         // FIXME(pg-catalog): numeric is registered only with a type modifier. Without one it is REAL, which `is_lowered_type_name` leaves to the engine. A numeric type that needs no modifier lets every numeric go through CASTS.
@@ -255,7 +256,6 @@ const ENGINE_RULE_TYPES: &[&str] = &[
     "time",
     "json",
     "jsonb",
-    "uuid",
     "bytea",
     "inet",
     "cidr",
```

**File**: `postgres/frontend/casts.rs` (modified, +3/-0)
```diff
@@ -33,6 +33,7 @@ pub(crate) enum CastType {
     Bool,
     Oid,
     RegClass,
+    Uuid,
     // FIXME(pg-catalog): bytea is not a registered type yet, so the engine casts it as before. It is listed here and in CASTS once bytea has a pg_type row.
     Timestamp,
     TimestampTz,
@@ -51,6 +52,7 @@ impl CastType {
             Self::Bool => "bool",
             Self::Oid => "oid",
             Self::RegClass => "regclass",
+            Self::Uuid => "uuid",
             Self::Timestamp => "timestamp",
             Self::TimestampTz => "timestamptz",
         }
@@ -73,6 +75,7 @@ impl CastType {
             "bool" => Self::Bool,
             "oid" => Self::Oid,
             "regclass" => Self::RegClass,
+            "uuid" => Self::Uuid,
             "timestamp" => Self::Timestamp,
             "timestamptz" => Self::TimestampTz,
             _ => return None,
```

---

### Incident Patch 3: `e868ecfc` (2026-11-28)
**Commit Message**: postgres: document the uuid type

COMPAT.md now says that uuid is a registered type and which text it
reads. The cast row describes the casts of uuid: they follow pg_cast,
so a cast from or to a type other than text fails with 42846. uuid
leaves the list of casts that the engine decides.

The row for the uuid data type names the gaps that the conformance
tests record: LIKE, max and a comparison with jsonb. It also keeps the
existing limit that a uuid returned by a cast or a function is typed
text, so a comparison with a text column is not refused.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

**File**: `postgres/COMPAT.md` (modified, +2/-2)
```diff
@@ -73,7 +73,7 @@ Basics not enumerated by the official feature matrix.
 | TRUNCATE | 🟡 Partial | Lowered to DELETE of one table; several tables, CASCADE and RESTART IDENTITY rejected |
 | BEGIN / COMMIT / ROLLBACK | ✅ Supported | Every transaction is snapshot isolation, i.e. REPEATABLE READ; `ISOLATION LEVEL REPEATABLE READ` is accepted, every other level, DEFERRABLE and AND CHAIN are rejected. READ ONLY and READ WRITE are enforced, on BEGIN and on SET TRANSACTION; switching a READ ONLY transaction to READ WRITE after its first query is rejected with SQLSTATE 25001 like PostgreSQL. A statement error aborts the transaction but keeps its savepoints, so ROLLBACK TO recovers it; a failed COMMIT rolls the transaction back and returns the connection to idle |
 | LOCK TABLE | 🟡 Partial | ACCESS SHARE without NOWAIT is accepted as a no-op inside a transaction for pg_dump compatibility; table names are not checked, no locks are acquired, and no read snapshot is started; other modes are rejected |
-| Casts (`expr::type`, CAST) | 🟡 Partial | Also `int4(x)`-style cast functions. Casts to and from int2, int4, int8, float4, float8, bool and text follow `pg_cast`, which lists them: a pair PostgreSQL has no cast for fails with 42846. A cast to uuid gives a value of the uuid type, and fails with 22P02 when the text is not a UUID. A value written to a column by INSERT, UPDATE, ON CONFLICT DO UPDATE, a default or a stored generated column is converted to the column type as an assignment cast, and fails with 42804 when PostgreSQL has no assignment cast. CREATE TABLE and ALTER TABLE ADD COLUMN refuse a column default with no assignment cast to the column type, with 42804 and PostgreSQL's message, which names a real or numeric column as double precision. ADD COLUMN writes a default of another type, converted, into the rows that exist. A value is converted before NOT NULL is checked. Floats round to an integer half to even. A numeric literal and a numeric with a type modifier round half away from zero, as in PostgreSQL. A numeric column without a type modifier and numeric arithmetic are REAL, so they round half to even: 4.5 in a `numeric` column cast or written to an integer is 4, where PostgreSQL gives 5. The range of the target is checked. A float8 cast or written to text is in PostgreSQL's form, such as `3` and `1e+20`. regclass casts from text by looking the name up as PostgreSQL does (schema, search path, quoting, digits as an oid) and to text by printing the name, with `42P01` for a relation that does not exist. It finds the relations that `pg_class` lists (tables, views, sequences and indexes under the name `pg_class` gives them, and the catalogs) and the other PostgreSQL catalog tables by their PostgreSQL oid. A catalog view that `pg_class` does not list does not exist here, so its name fails with `42P01`. A regclass column prints the name in a result and in COPY, as PostgreSQL does, and the binary format sends the oid; a binary regclass parameter is refused with 0A000. `regclass[]` and a column of another reg type are still integers, and so is a regclass that goes through an expression such as `min`, `max`, `CASE`, `||`, `concat`, `format` or an array constructor: the engine, not PostgreSQL's rules, gives the expression its type, so it can print the number where PostgreSQL prints the name (`||`, `concat`, `format`, arrays) or the name where PostgreSQL prints the oid (`min`, `max`). A regclass constant that a view, a default, a check, an index, a policy or a materialized view stores is read as the oid of its relation when the statement runs, as in PostgreSQL, so renaming the relation does not break it and a name with no relation fails the statement with `42P01`. This covers a string constant cast to regclass and a string default of a regclass column, and not a name that reaches regclass another way, such as the argument of `nextval`. A constant that names the table the same statement creates keeps its name, because the table has no oid yet. The object keeps no dependency on the relation, so `DROP TABLE` of that relation is not refused, and the oid then prints as a number. For the same reason pg_dump does not order a table before the table that its default names, so such a dump may not restore. A domain over regclass does not read or print relation names yet: a string default or a text value of the domain fails, and its values print as numbers. A quoted schema name in a regclass matches without regard to case. The casts of date, json, jsonb, uuid, bytea, inet, cidr, macaddr, the reg types other than regclass, arrays, enums and domains are not in `pg_cast` yet: the engine decides them by its own rules, which accept some casts PostgreSQL refuses (`types/cast-matrix.sqltest` has a gap test for each). A cast of another built-in type, such as point or xid, fails with 0A000. Not covered: bytea, which is not a registered type yet, so its casts are not in `pg_cast` and a text literal is not read as bytea input; casts to numeri
```

#### Recent Merged Pull Requests:
- **PR #12640** (closed): dialect-definitions: move the SQLite dialect to a crate that both frontends use (@glommer)
- **PR #12639** (2026-11-28): postgres: open only PostgreSQL databases in the frontend tests (@glommer)
- **PR #12634** (2026-11-28): postgres: add regtype, and give regclass and regtype an INPUT (@glommer)
- **PR #12633** (2026-11-28): postgres: register the uuid type (@glommer)
- **PR #12632** (2026-11-28): testing/sqltest: split the runner into one binary per dialect (@glommer)
- **PR #12630** (2026-11-28): postgres: reject database attachment (@glommer)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
