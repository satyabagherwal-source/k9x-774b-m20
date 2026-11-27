> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tursodatabase-turso-learnings.md`  
> **Source**: github ([https://github.com/tursodatabase/turso](https://github.com/tursodatabase/turso))  
> **Source Version**: `df7ba30c`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-27T12:21:21.983Z  
> **Learning ID**: `learn-github-tursodatabase-turso`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): tursodatabase/turso

> **Canonical Artifact**: `07_PROJECT_LEARNING/tursodatabase-turso-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tursodatabase/turso](https://github.com/tursodatabase/turso))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-27T12:21:21.977Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tursodatabase/turso`
- **Description**: A SQL database in Rust: SQLite-compatible, now also speaking Postgres (experimental). The LLVM of databases.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md
- **Stars / Engagement**: 25383 stars

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
- **Issue #12597** (2026-11-27): **postgres/conformance: move the fixed boolean tests out of gaps**
  *Symptoms*: PR #12428 made every condition a boolean in tursopg, and removed the gap markers of the tests it fixed. But these tests stayed in the files under `gaps/`, which hold the tests of differences from PostgreSQL.  This moves them to the files of their subject. Each commit moves the tests of one subject. The names, SQL, setups and expected answers do not change.  | Tests | From | To | | --- | --- | --- | | `is-true-is-not-true-on-bool-col`, `in-with-null-three-valued`, `boolean-comparison-output`, `exists-subquery-output` | `gaps/operators-functions.sqltest` | `types/bool.sqltest` | | `like-case-sensitive-literal`, `regex-classes-d-and-escapes`, `similar-to` | `gaps/operators-functions.sqltest` | `pattern-matching.sqltest` (new) | | `eq-any-int-array-literal`, `array-array-literal` | `gaps/operators-functions.sqltest` | `array-operators.sqltest` (new) | | `of-a-json-boolean-is-the-text-true` | `gaps/operators-functions.sqltest` | `jsonb-operators.sqltest` | | `gen-random-uuid-format`, `to-char-null-timestamptz-row` | `gaps/operators-functions.sqltest` | `functions.sqltest` | | `current-user-current-role` | `gaps/operators-functions.sqltest` | `roles/functions.sqltest` | | `omitted-nullable-uuid-column-stays-null` | `gaps/ddl-catalog.sqltest` | `table.sqltest` | | `timestamptz-equality-across-offsets` | `gaps/params-casts.sqltest` | `datetime-input.sqltest` |  These commits were the last eight commits of #12389. #12428 merged the other commits of that PR, so it is closed.  All the c

- **Issue #12593** (2026-11-27): **core: stop PRAGMA auto_vacuum on a new database from breaking checkpoints**
  *Symptoms*: ## Problem  ``` fresh file, experimental autovacuum on  PRAGMA auto_vacuum=FULL          -> header written, dirty pages cleared,                                     then SetCookie marks page 1 dirty again (no transaction) PRAGMA page_count, step one row, drop the statement               -> read rollback panics:                                     "dirty pages should be empty for read txn" PRAGMA wal_checkpoint(TRUNCATE)  -> Busy: "cannot checkpoint while another statement is active" ```  `INCREMENTAL` failed the same way. `NONE` did not.  The auto_vacuum setter in `core/translate/pragma.rs` calls `Pager::persist_auto_vacuum_mode`. That function writes both auto-vacuum header fields of the new database and clears the dirty pages, because no transaction is open. The setter then also emitted `ReadCookie`, `If` and `SetCookie IncrementalVacuum` with `TransactionMode::None`. That `SetCookie` wrote the same value again and marked page 1 dirty, and no transaction committed or rolled back that change.  ## Fix  - Remove the `ReadCookie`/`If`/`Halt`/`SetCookie` block from the auto_vacuum setter. The setter returns early when page 1 exists, so the block only ran on new databases, where `persist_auto_vacuum_mode` has already written the value. - `op_set_cookie` now asserts that the pager holds the WAL write lock when MVCC (multi-version concurrency control) is off. In MVCC mode it already returned an error without a transaction. A program that emits `SetCookie` without a write transactio

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

### Incident Patch 1: `71ae9708` (2026-11-27)
**Commit Message**: Merge 'core/storage: fail WAL recovery on a short read' from Perfloop Agent

Hey folks, a first-time contributor here. Perfloop has found an issue,
but I have looked at it. Since I am not familiar with codebase, I can
largely validate just symptoms; patch itself seems to make sense, but I
defer to your thinking here.

A database whose write-ahead log (WAL) still holds committed
transactions loses them without any error. This gets triggered if a read
of the 32-byte WAL header or a WAL frame returns fewer bytes than
requested while more bytes are available. I was able to reproduce this
locally (also in the patch attached).

Write/prep files with SQLite, through the rusqlite crate, and then open
them with Turso:

  - set a 512-byte page size, switch to WAL mode, and run CREATE TABLE
t(x). SQLite records the new table in the WAL file source.db-wal.
  - run `PRAGMA wal_checkpoint(TRUNCATE)`, which copies every WAL frame
into the main database file `source.db`, then shrinks `source.db-wal` to
0 bytes.
  - `INSERT INTO t VALUES (1)` and `INSERT INTO t VALUES (2)`. db-wal
grows to 1,104 bytes. Rows 1 and 2 now exist only in source.db-wal, and
source.db still holds an empty table.
  - open 

**File**: `core/storage/sqlite3_ondisk.rs` (modified, +41/-12)
```diff
@@ -1624,6 +1624,9 @@ impl BuildSharedWal {
                     self.phase = BuildSharedWalPhase::AwaitHeader(c);
                 }
                 BuildSharedWalPhase::AwaitHeader(c) => {
+                    if let Some(err) = c.get_error() {
+                        return Err(err.into());
+                    }
                     if !c.succeeded() {
                         io_yield_one!(c);
                     }
@@ -1651,6 +1654,9 @@ impl BuildSharedWal {
                     };
                 }
                 BuildSharedWalPhase::AwaitChunk { completion, offset } => {
+                    if let Some(err) = completion.get_error() {
+                        return Err(err.into());
+                    }
                     if !completion.succeeded() {
                         io_yield_one!(completion);
                     }
@@ -1742,8 +1748,7 @@ impl StreamingWalReader {
         let reader = self.clone();
         let completion: Box<ReadComplete> = Box::new(move |res| {
             let _reader = reader.clone();
-            _reader.handle_header_read(res);
-            None
+            _reader.handle_header_read(res)
         });
         let c = Completion::new_read(header_buf, completion);
         self.file.pread(0, c)
@@ -1777,22 +1782,31 @@ impl StreamingWalReader {
         let completion: Box<ReadComplete> = Box::new(move |res| {
             tracing::debug!("WAL chunk read complete");
             let reader = me.clone();
-            reader.handle_chunk_read(res);
-            None
+            reader.handle_chunk_read(offset, res)
         });
         let c = Completion::new_read(buf, completion);
         let guard = self.file.pread(offset, c)?;
         Ok((read_size, guard))
     }
 
-    fn handle_header_read(self: Arc<Self>, res: Result<(Arc<Buffer>, i32), CompletionError>) {
+    fn handle_header_read(
+        self: Arc<Self>,
+        res: Result<(Arc<Buffer>, i32), CompletionError>,
+    ) -> Option<CompletionError> {
         let Ok((buf, bytes_read)) = res else {
             self.finalize_loading();
-            return;
+            return None;
         };
+        // The file is at least as long as the header, so a read that returns
+        // fewer bytes does not mean that the WAL has no header. If recovery
+        // treated it that way, the committed frames would not be visible and
+        // the next write would overwrite them.
         if bytes_read != WAL_HEADER_SIZE as i32 {
-            self.finalize_loading();
-            return;
+            return Some(CompletionError::ShortReadWalFrame {
+                offset: 0,
+                expected: WAL_HEADER_SIZE,
+                actual: bytes_read as usize,
+            });
         }
 
         let (page_sz, c1, c2, use_native, ok) = {
@@ -1836,7 +1850,7 @@ impl StreamingWalReader {
         if PageSize::new(page_sz).is_none() || !ok {
             *self.header.lock() = WalHeader::default();
             self.finalize_loading();
-            return;
+            return None;
         }
         {
             let mut st = self.state.write();
@@ -1849,14 +1863,28 @@ impl StreamingWalReader {
         self.off_atomic
             .store(WAL_HEADER_SIZE as u64, Ordering::Release);
         self.page_atomic.store(page_sz as u64, Ordering::Release);
+        None
     }
 
-    fn handle_chunk_read(self: Arc<Self>, res: Result<(Arc<Buffer>, i32), CompletionError>) {
+    fn handle_chunk_read(
+        self: Arc<Self>,
+        offset: u64,
+        res: Result<(Arc<Buffer>, i32), CompletionError>,
+    ) -> Option<CompletionError> {
         let Ok((buf, bytes_read)) = res else {
             self.finalize_loading();
-            return;
+            return None;
         };
-        let buf_slice = &buf.as_slice()[..bytes_read as usize];
+        // The requested bytes are all inside the file, so a read that returns
+        // fewer bytes does not show where the valid frames end.
+        if bytes_read as usize != buf.len() {
+            return Some(CompletionError::ShortReadWalFrame {
+                offset,
+                expected: buf.len(),
+                actual: bytes_read as usize,
+            });
+        }
+        let buf_slice = buf.as_slice();
         // Snapshot salts/endianness once to avoid per-frame header locks
         let (header_copy, use_native) = {
             let st = self.state.read();
@@ -1870,6 +1898,7 @@ impl StreamingWalReader {
         if consumed < buf_slice.len() || self.off_atomic.load(Ordering::Acquire) >= self.file_size {
             self.finalize_loading();
         }
+        None
     }
 
     // Processes frames from a buffer, returns bytes processed
```

**File**: `tests/integration/queued_io.rs` (modified, +31/-1)
```diff
@@ -87,6 +87,7 @@ struct QueuedIoState {
     owner: Mutex<String>,
     ordinals: Mutex<HashMap<String, u32>>,
     fail_next: Mutex<Option<QueuedIoOpKind>>,
+    wal_read_limit: Mutex<Option<usize>>,
 }
 
 impl QueuedIoState {
@@ -99,6 +100,7 @@ impl QueuedIoState {
             owner: Mutex::new("unowned".to_string()),
             ordinals: Mutex::new(HashMap::new()),
             fail_next: Mutex::new(None),
+            wal_read_limit: Mutex::new(None),
         }
     }
 }
@@ -120,6 +122,12 @@ impl QueuedIo {
         }
     }
 
+    #[cfg(not(feature = "checksum"))]
+    pub(crate) fn limit_wal_reads(&self, bytes: usize) {
+        assert!(bytes > 0);
+        *self.state.wal_read_limit.lock().unwrap() = Some(bytes);
+    }
+
     pub(crate) fn step_one(&self) -> turso_core::Result<Option<QueuedIoEvent>> {
         self.step_at(0, false)
     }
@@ -429,9 +437,31 @@ impl File for QueuedFile {
     fn pread(&self, pos: u64, completion: Completion) -> turso_core::Result<Completion> {
         let inner = self.inner.clone();
         let c = completion.clone();
+        let limit = if self.path.ends_with("-wal") {
+            *self.state.wal_read_limit.lock().unwrap()
+        } else {
+            None
+        };
         let len = completion.as_read().buf().len();
         self.enqueue(QueuedIoOpKind::Pread, pos, len, completion, move || {
-            drop(inner.pread(pos, c)?);
+            if let Some(limit) = limit {
+                let len = c.as_read().buf().len().min(limit);
+                let buf = Arc::new(Buffer::new_temporary(len));
+                let read = Completion::new_read(buf, move |res| {
+                    match res {
+                        Ok((buf, n)) => {
+                            c.as_read().buf().as_mut_slice()[..n as usize]
+                                .copy_from_slice(&buf.as_slice()[..n as usize]);
+                            c.complete(n);
+                        }
+                        Err(err) => c.error(err),
+                    }
+                    None
+                });
+                drop(inner.pread(pos, read)?);
+            } else {
+                drop(inner.pread(pos, c)?);
+            }
             Ok(())
         })
     }
```

**File**: `tests/integration/storage/short_read.rs` (modified, +114/-0)
```diff
@@ -234,3 +234,117 @@ fn test_zeroed_page_returns_corrupt_error() {
             .contains("Invalid page type: 0");
     }
 }
+
+#[test]
+fn test_wal_short_reads_fail_open_without_losing_rows() {
+    use crate::common::ExecRows;
+    use crate::queued_io::QueuedIo;
+    use std::sync::Arc;
+    use turso_core::{
+        Buffer, Completion, CompletionError, Database, IOResult, LimboError, OpenFlags,
+        OpenOptions, WalFileShared, IO,
+    };
+    use turso_sqlite::SqliteDialect;
+
+    let dir = tempfile::tempdir().unwrap();
+    let source_path = dir.path().join("source.db");
+    let source = rusqlite::Connection::open(&source_path).unwrap();
+    source
+        .execute_batch(
+            "PRAGMA page_size=512;
+             PRAGMA journal_mode=WAL;
+             CREATE TABLE t(x);
+             PRAGMA wal_checkpoint(TRUNCATE);
+             INSERT INTO t VALUES (1);
+             INSERT INTO t VALUES (2);
+             INSERT INTO t VALUES (3);
+             INSERT INTO t VALUES (4);",
+        )
+        .unwrap();
+    let db_bytes = std::fs::read(&source_path).unwrap();
+    let wal_bytes = std::fs::read(dir.path().join("source.db-wal")).unwrap();
+
+    for limit in (1..=32).chain([33, 100, 535, 536, 600, 1100, 2143]) {
+        let io = Arc::new(QueuedIo::new());
+        let path = dir.path().join(format!("short-{limit}.db"));
+        let path = path.to_str().unwrap();
+        for (name, bytes) in [
+            (path.to_owned(), &db_bytes),
+            (format!("{path}-wal"), &wal_bytes),
+        ] {
+            let file = io.open_file(&name, OpenFlags::Create, false).unwrap();
+            let c = file
+                .pwrite(
+                    0,
+                    Arc::new(Buffer::new(bytes.clone())),
+                    Completion::new_write(|_| {}),
+                )
+                .unwrap();
+            io.wait_for_completion(c).unwrap();
+        }
+        io.limit_wal_reads(limit);
+        let recovery_io: Arc<dyn IO> = io.clone();
+        let mut recovery = WalFileShared::open_shared_if_exists_begin(
+            &recovery_io,
+            &format!("{path}-wal"),
+            OpenFlags::Create,
+        )
+        .unwrap();
+        let err = 'recovery: {
+            for _ in 0..100 {
+                match recovery.poll() {
+                    Err(err) => break 'recovery err,
+                    Ok(IOResult::Done(_)) => panic!("WAL read limit {limit}: recovery succeeded"),
+                    Ok(IOResult::IO(c)) => {
+                        while !c.finished() {
+                            io.step().unwrap();
+                        }
+                    }
+                }
+            }
+            panic!("WAL read limit {limit}: recovery did not finish");
+        };
+        assert!(
+            matches!(
+                *err,
+                LimboError::CompletionError(CompletionError::ShortReadWalFrame { .. })
+            ),
+            "WAL read limit {limit}: unexpected recovery error {err:?}"
+        );
+        match Database::open(io.clone(), path, OpenOptions::new(Arc::new(SqliteDialect))) {
+            Err(LimboError::CompletionError(CompletionError::ShortReadWalFrame { .. })) => {}
+            Err(err) => panic!("WAL read limit {limit}: unexpected open error {err:?}"),
+            Ok(db) => {
+                io.limit_wal_reads(usize::MAX);
+                let conn = db
+                    .connect(ConnectOpts::new(SessionRole::Superuser))
+                    .unwrap();
+                let rows: Vec<(i64,)> = conn.exec_rows("SELECT x FROM t ORDER BY x");
+                panic!("WAL read limit {limit}: open succeeded with rows {rows:?}");
+            }
+        }
+        io.limit_wal_reads(usize::MAX);
+        let db =
+            Database::open(io.clone(), path, OpenOptions::new(Arc::new(SqliteDialect))).unwrap();
+        let conn = db
+            .connect(ConnectOpts::new(SessionRole::Superuser))
+            .unwrap();
+        let rows: Vec<(i64,)> = conn.exec_rows("SELECT x FROM t ORDER BY x");
+        assert_eq!(rows, vec![(1,), (2,), (3,), (4,)], "WAL read limit {limit}");
+        if limit == 600 {
+            conn.execute("INSERT INTO t VALUES (5)").unwrap();
+            drop(conn);
+            drop(db);
+            let db = Database::open(io, path, OpenOptions::new(Arc::new(SqliteDialect))).unwrap();
+            let conn = db
+                .connect(ConnectOpts::new(SessionRole::Superuser))
+                .unwrap();
+            let rows: Vec<(i64,)> = conn.exec_rows("SELECT x FROM t ORDER BY x");
+            assert_eq!(
+                rows,
+                vec![(1,), (2,), (3,), (4,), (5,)],
+                "rows after writing and reopening"
+            );
+        }
+    }
+}
```

---

### Incident Patch 2: `df7ba30c` (2026-11-27)
**Commit Message**: Merge 'postgres/conformance: move the fixed boolean tests out of gaps' from Pekka Enberg

PR #12428 made every condition a boolean in tursopg, and removed the gap
markers of the tests it fixed. But these tests stayed in the files under
`gaps/`, which hold the tests of differences from PostgreSQL.

This moves them to the files of their subject. Each commit moves the
tests of one subject. The names, SQL, setups and expected answers do not
change.

| Tests | From | To |
| --- | --- | --- |
| `is-true-is-not-true-on-bool-col`, `in-with-null-three-valued`,
`boolean-comparison-output`, `exists-subquery-output` | `gaps/operators-
functions.sqltest` | `types/bool.sqltest` |
| `like-case-sensitive-literal`, `regex-classes-d-and-escapes`,
`similar-to` | `gaps/operators-functions.sqltest` | `pattern-
matching.sqltest` (new) |
| `eq-any-int-array-literal`, `array-array-literal` | `gaps/operators-
functions.sqltest` | `array-operators.sqltest` (new) |
| `of-a-json-boolean-is-the-text-true` | `gaps/operators-
functions.sqltest` | `jsonb-operators.sqltest` |
| `gen-random-uuid-format`, `to-char-null-timestamptz-row` |
`gaps/operators-functions.sqltest` | `functions.sqltest` |
| `current-user-curr

**File**: `postgres/conformance/pg-sqltests/array-operators.sqltest` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+# The array operators = ANY, @>, <@ and &&.
+
+@database :memory:
+
+test eq-any-int-array-literal {
+    SELECT 1 = ANY('{1,2}'::int[]), 3 = ANY('{1,2}'::int[]);
+}
+expect {
+    t|f
+}
+
+test array-array-literal {
+    SELECT ARRAY[1,2] @> ARRAY[1], ARRAY['a'] <@ ARRAY['a','b'], ARRAY[1] && ARRAY[2];
+}
+expect {
+    t|t|f
+}
```

**File**: `postgres/conformance/pg-sqltests/datetime-input.sqltest` (modified, +7/-0)
```diff
@@ -1137,3 +1137,10 @@ test cast-jsonb-to-numbers {
 expect {
     1|1|1.5|1.5
 }
+
+test timestamptz-equality-across-offsets {
+    SELECT '2026-10-08 14:00:00+02'::timestamptz = '2026-10-08 12:00:00Z'::timestamptz;
+}
+expect {
+    t
+}
```

**File**: `postgres/conformance/pg-sqltests/functions.sqltest` (modified, +16/-0)
```diff
@@ -3400,3 +3400,19 @@ expect {
     f|f|f
     t|t
 }
+
+test gen-random-uuid-format {
+    SELECT gen_random_uuid()::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
+}
+expect {
+    t
+}
+
+test to-char-null-timestamptz-row {
+    CREATE TABLE to_char_times (at timestamptz);
+    INSERT INTO to_char_times VALUES (NULL);
+    SELECT to_char(at, 'YYYY') IS NULL FROM to_char_times;
+}
+expect {
+    t
+}
```

**File**: `postgres/conformance/pg-sqltests/gaps/ddl-catalog.sqltest` (modified, +0/-10)
```diff
@@ -830,16 +830,6 @@ expect {
     1
 }
 
-# E-73: omitted nullable uuid column stays NULL
-test omitted-nullable-uuid-column-stays-null {
-    CREATE TABLE t (id int PRIMARY KEY, u uuid);
-    INSERT INTO t (id) VALUES (1);
-    SELECT id, u IS NULL FROM t;
-}
-expect {
-    1|t
-}
-
 # E-74: quoted identifier keeps its case in pg_class
 test quoted-identifier-keeps-its-case-in-pg-class {
     CREATE TABLE "Todos" (id int);
```

**File**: `postgres/conformance/pg-sqltests/gaps/operators-functions.sqltest` (modified, +0/-111)
```diff
@@ -56,18 +56,6 @@ expect {
     2
 }
 
-# B-04: IS TRUE / IS NOT TRUE on bool col
-@setup t_id_s_n_arr_ia_j_ok_with_rows
-test is-true-is-not-true-on-bool-col {
-    SELECT id, ok IS TRUE, ok IS NOT TRUE FROM t ORDER BY id;
-}
-expect {
-    1|t|f
-    2|f|t
-    3|f|t
-    4|f|t
-}
-
 # B-05: IS UNKNOWN
 @setup t_id_s_n_arr_ia_j_ok_with_rows
 test is-unknown {
@@ -87,14 +75,6 @@ expect {
     2
 }
 
-# B-07: LIKE case-sensitive literal
-test like-case-sensitive-literal {
-    SELECT 'ABC' LIKE 'abc', 'abc' LIKE 'a%', 'abc' LIKE 'A%';
-}
-expect {
-    f|t|f
-}
-
 # B-08: LIKE default escape \_
 @setup t_id_s_n_arr_ia_j_ok_with_rows
 test like-default-escape-underscore {
@@ -222,38 +202,6 @@ expect {
     4
 }
 
-# B-21: regex classes \d and escapes
-test regex-classes-d-and-escapes {
-    SELECT 'a1' ~ '^a\d$', 'a.c' ~ '^a\.c$', 'abc' ~ '^a\.c$';
-}
-expect {
-    t|t|f
-}
-
-# B-22: SIMILAR TO
-test similar-to {
-    SELECT 'abc' SIMILAR TO 'a(b|x)c', 'abc' SIMILAR TO 'b';
-}
-expect {
-    t|f
-}
-
-# B-23: IN with NULL (three-valued)
-test in-with-null-three-valued {
-    SELECT 1 IN (1, NULL), 2 IN (1, NULL), 2 NOT IN (1, NULL);
-}
-expect {
-    t||
-}
-
-# B-25: = ANY('{..}'::int[])
-test eq-any-int-array-literal {
-    SELECT 1 = ANY('{1,2}'::int[]), 3 = ANY('{1,2}'::int[]);
-}
-expect {
-    t|f
-}
-
 # B-26: > ALL / < ANY (non-equality)
 @compat-gap "syntax:any-all"
 test all-any-non-equality {
@@ -321,14 +269,6 @@ expect {
     1
 }
 
-# B-35: ARRAY @> ARRAY literal
-test array-array-literal {
-    SELECT ARRAY[1,2] @> ARRAY[1], ARRAY['a'] <@ ARRAY['a','b'], ARRAY[1] && ARRAY[2];
-}
-expect {
-    t|t|f
-}
-
 # B-36: array subscript 1-based + out of range
 @setup t_id_s_n_arr_ia_j_ok_with_rows
 test array-subscript-1-based-out-of-range {
@@ -761,14 +701,6 @@ expect {
     t
 }
 
-# B-78: gen_random_uuid() format
-test gen-random-uuid-format {
-    SELECT gen_random_uuid()::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
-}
-expect {
-    t
-}
-
 # B-79: set_config + current_setting
 test set-config-current-setting {
     SELECT set_config('request.jwt.claims', '{"sub":"u1"}', true);
@@ -970,14 +902,6 @@ expect {
     1|2
 }
 
-# B-97: current_user / current_role
-test current-user-current-role {
-    SELECT current_user = current_role;
-}
-expect {
-    t
-}
-
 # B-98: pg_catalog.-qualified function
 test pg-catalog-qualified-function {
     SELECT pg_catalog.lower('A');
@@ -1062,24 +986,6 @@ expect {
     z|0
 }
 
-# B-106: boolean comparison output
-@setup t_id_s_n_arr_ia_j_ok_with_rows
-test boolean-comparison-output {
-    SELECT id < 2, n IS NULL FROM t WHERE id = 1;
-}
-expect {
-    t|f
-}
-
-# B-107: EXISTS subquery output
-@setup t_id_s_n_arr_ia_j_ok_with_rows
-test exists-subquery-output {
-    SELECT EXISTS (SELECT 1 FROM t WHERE id = 1);
-}
-expect {
-    t
-}
-
 # B-117: VALUES list with column aliases v(x)
 test values-list-with-column-aliases-v-x {
     SELECT x FROM (VALUES (1), (2)) v(x) ORDER BY x;
@@ -1270,15 +1176,6 @@ expect @tursopg raw {
  12
 }
 
-test to-char-null-timestamptz-row {
-    CREATE TABLE to_char_times (at timestamptz);
-    INSERT INTO to_char_times VALUES (NULL);
-    SELECT to_char(at, 'YYYY') IS NULL FROM to_char_times;
-}
-expect {
-    t
-}
-
 # to_timestamp(double precision)
 @compat-gap "function:to_timestamp"
 test to-timestamp-epoch {
@@ -1315,14 +1212,6 @@ expect {
 @sqlstate 42883
 expect @tursopg error {}
 
-# B-127: ->> of a JSON boolean is the text true
-test of-a-json-boolean-is-the-text-true {
-    SELECT '{"a": true}'::jsonb ->> 'a', '{"a": true}'::jsonb ->> 'a' <> 'true';
-}
-expect {
-    true|f
-}
-
 # B-128: jsonb || concatenates two objects
 # B-122 also uses ||. After a fix, the output still differs because of A-45.
 @compat-gap "operator:jsonb || jsonb"
```

**File**: `postgres/conformance/pg-sqltests/gaps/params-casts.sqltest` (modified, +0/-8)
```diff
@@ -185,14 +185,6 @@ test invalid-timestamptz {
 @sqlstate 22007
 expect error {}
 
-# A-36: timestamptz equality across offsets
-test timestamptz-equality-across-offsets {
-    SELECT '2026-10-08 14:00:00+02'::timestamptz = '2026-10-08 12:00:00Z'::timestamptz;
-}
-expect {
-    t
-}
-
 # A-37: timestamp drops offset
 test timestamp-drops-offset {
     SELECT '2026-10-08 14:00:00+02'::timestamp;
```

**File**: `postgres/conformance/pg-sqltests/jsonb-operators.sqltest` (modified, +7/-0)
```diff
@@ -717,6 +717,13 @@ expect @tursopg {
     -1
 }
 
+test of-a-json-boolean-is-the-text-true {
+    SELECT '{"a": true}'::jsonb ->> 'a', '{"a": true}'::jsonb ->> 'a' <> 'true';
+}
+expect {
+    true|f
+}
+
 # Known differences of @> and <@
 
 # tursopg compares a json or text value as jsonb, where PostgreSQL has @> only
```

**File**: `postgres/conformance/pg-sqltests/pattern-matching.sqltest` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+# LIKE, the regular expression operators and SIMILAR TO.
+
+@database :memory:
+
+test like-case-sensitive-literal {
+    SELECT 'ABC' LIKE 'abc', 'abc' LIKE 'a%', 'abc' LIKE 'A%';
+}
+expect {
+    f|t|f
+}
+
+test regex-classes-d-and-escapes {
+    SELECT 'a1' ~ '^a\d$', 'a.c' ~ '^a\.c$', 'abc' ~ '^a\.c$';
+}
+expect {
+    t|t|f
+}
+
+test similar-to {
+    SELECT 'abc' SIMILAR TO 'a(b|x)c', 'abc' SIMILAR TO 'b';
+}
+expect {
+    t|f
+}
```

---

### Incident Patch 3: `6c9e975d` (2026-11-24)
**Commit Message**: postgres/conformance: move the test of an omitted uuid column to table.sqltest

PR #12428 fixed the gap of the test `omitted-nullable-uuid-column-stays-null`: the result is a boolean, and tursopg prints it as t or f now. It is a plain test of a column that an INSERT leaves out now, and the tests of table columns are in `table.sqltest`.

The names, SQL and expected answers do not change.

**File**: `postgres/conformance/pg-sqltests/gaps/ddl-catalog.sqltest` (modified, +0/-10)
```diff
@@ -830,16 +830,6 @@ expect {
     1
 }
 
-# E-73: omitted nullable uuid column stays NULL
-test omitted-nullable-uuid-column-stays-null {
-    CREATE TABLE t (id int PRIMARY KEY, u uuid);
-    INSERT INTO t (id) VALUES (1);
-    SELECT id, u IS NULL FROM t;
-}
-expect {
-    1|t
-}
-
 # E-74: quoted identifier keeps its case in pg_class
 test quoted-identifier-keeps-its-case-in-pg-class {
     CREATE TABLE "Todos" (id int);
```

**File**: `postgres/conformance/pg-sqltests/table.sqltest` (modified, +9/-0)
```diff
@@ -1549,3 +1549,12 @@ test integer-primary-key-refuses-an-upsert-to-null {
 }
 @sqlstate 23502
 expect error {}
+
+test omitted-nullable-uuid-column-stays-null {
+    CREATE TABLE t (id int PRIMARY KEY, u uuid);
+    INSERT INTO t (id) VALUES (1);
+    SELECT id, u IS NULL FROM t;
+}
+expect {
+    1|t
+}
```

#### Recent Merged Pull Requests:
- **PR #12597** (2026-11-27): postgres/conformance: move the fixed boolean tests out of gaps (@penberg)
- **PR #12593** (2026-11-27): core: stop PRAGMA auto_vacuum on a new database from breaking checkpoints (@turso-github-handyman[bot])
- **PR #12591** (closed): core: normalize sqlite nan values and generalize type ordering (@glommer)
- **PR #12580** (2026-11-26): postgres/catalog: describe each catalog with a CatalogTable impl (@pedrocarlo)
- **PR #12573** (2026-11-27): core/mvcc: return busy from a contended explicit checkpoint (@sAchin-680)
- **PR #12569** (2026-11-26): postgres: make pg_type one table of the built-in types (@glommer)

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

## X. Merge 'core/storage: fail WAL recovery on a short read' from Perfloop Agent

**RULE**:
When implementing operations in `core/storage/sqlite3_ondisk.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tursodatabase/turso. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `71ae9708`: Merge 'core/storage: fail WAL recovery on a short read' from Perfloop Agent. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `core/storage/sqlite3_ondisk.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
                    if let Some(err) = c.get_error() {
                        return Err(err.into());
                    }
                    if let Some(err) = completion.get_error() {
                        return Err(err.into());
                    }
            _reader.handle_header_read(res)
            reader.handle_chunk_read(offset, res)
    fn handle_header_read(
        self: Arc<Self>,
        res: Result<(Arc<Buffer>, i32), CompletionError>,
    ) -> Option<CompletionError> {
            return None;
        // The file is at least as long as the header, so a read that returns
        // fewer bytes does not mean that the WAL has no header. If recovery
        // treated it that way, the committed frames would not be visible and
        // the next write would overwrite them.
            return Some(CompletionError::ShortReadWalFrame {
                offset: 0,
                expected: WAL_HEADER_SIZE,
                actual: bytes_read as usize,
            });
            return None;
        None
    fn handle_chunk_read(
        self: Arc<Self>,
        offset: u64,
        res: Result<(Arc<Buffer>, i32), CompletionError>,
    ) -> Option<CompletionError> {
 
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
            _reader.handle_header_read(res);
            None
            reader.handle_chunk_read(res);
            None
    fn handle_header_read(self: Arc<Self>, res: Result<(Arc<Buffer>, i32), CompletionError>) {
            return;
            self.finalize_loading();
            return;
            return;
    fn handle_chunk_read(self: Arc<Self>, res: Result<(Arc<Buffer>, i32), CompletionError>) {
            return;
        let buf_slice = &buf.as_slice()[..bytes_read as usize];
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `71ae9708` are properly handled with clean fallback behavior.
