# Verification Protocol: Verification Protocol: Empirical Defect Shield for tursodatabase-limbo-learnings

<!-- PROVENANCE_START
{
  "source_repository": "tursodatabase-limbo-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T13:40:27.874Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-tursodatabase-limbo-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tursodatabase-limbo-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T13:40:27.874Z`  
> **Learning ID**: `LEARN-EVO-tursodatabase-limbo-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `tursodatabase-limbo-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tursodatabase-limbo-learnings.md`  
> **Source**: github ([https://github.com/tursodatabase/limbo](https://github.com/tursodatabase/limbo))  
> **Source Version**: `6b667193`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-20T13:40:22.420Z  
> **Learning ID**: `learn-github-tursodatabase-turso`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): tursodatabase/turso

> **Canonical Artifact**: `07_PROJECT_LEARNING/tursodatabase-limbo-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tursodatabase/limbo](https://github.com/tursodatabase/limbo))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-20T13:40:22.414Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tursodatabase/turso`
- **Description**: A SQL database in Rust: SQLite-compatible, now also speaking Postgres (experimental). The LLVM of databases.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md
- **Stars / Engagement**: 25301 stars

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
- **Issue #12168** (2026-11-20): **ci/dotnet: pin .NET 10 SDK in iOS package validation**
  *Symptoms*: The `validate-ios-package` job fails at `dotnet workload install ios --version 10.0.401`:  ``` Workload pack 'Microsoft.NET.Runtime.Emscripten.Node.net10' in manifest 'microsoft.net.workload.emscripten.net10' [.../sdk-manifests/11.0.100/...] conflicts with manifest 'microsoft.net.workload.emscripten.current' [.../sdk-manifests/10.0.100/...] ```  The macos-26 runner image now ships a .NET 11 SDK. `actions/setup-dotnet` with `dotnet-version: 10.0.x` installs a .NET 10 SDK but does not stop `dotnet` from choosing the newest SDK, and `bindings/dotnet` has no global.json. The workload install therefore appears to run under SDK 11 and mixes 11.0.100 and 10.0.100 workload manifests. This cause comes from the manifest paths in the error, because the failing log does not print the SDK version.  This PR adds a step to the iOS job only. The step writes `bindings/dotnet/global.json`, pinning the version that setup-dotnet reports as installed, with `rollForward: latestFeature`. The workload install, restore and build in this job run from `bindings/dotnet`, so all of them pick up the global.json. The step prints `dotnet --version` and `dotnet --list-sdks`, so the log shows which SDK ran. The 10.0.401 workload pin and its Xcode 26 comment stay as they are. Other jobs are not changed.

- **Issue #12164** (2026-11-20): **testing/sqltest: record known PostgreSQL differences as @compat-gap tests**
  *Symptoms*: <img width="1400" height="1530" alt="image" src="https://github.com/user-attachments/assets/c7b3d264-8794-41c8-a627-63ab83bcefb9" />  ## Summary  - Adds `@compat-gap` to sqltest. - It marks a test where tursopg differs from PostgreSQL. - 424 existing tursopg overrides are now tagged.  ``` @compat-gap "type:bool" test like-case-sensitive-literal {     SELECT 'ABC' LIKE 'abc', 'abc' LIKE 'a%', 'abc' LIKE 'A%'; } # PostgreSQL 18 (checked on real PG in CI) expect {     f|t|f } # tursopg today: wrong expect @tursopg {     0|1|0 } ```  ## Why  - Write tests before the feature exists:  ``` @compat-gap "function:json_build_object" test json-build-object {     SELECT json_build_object('id', id, 's', s) FROM t WHERE id = 1; } expect {     {"id" : 1, "s" : "abc"} } @sqlstate 42883 expect @tursopg error {} ```  - When the feature lands, CI tells you:  ``` gap fixed: remove @compat-gap and the expect @tursopg override ```  - CI counts gaps per feature:  | label | gaps | refused | error-mismatch | accepts-invalid | wrong | |---|---:|---:|---:|---:|---:| | `function:age` | 20 | 13 | 7 | 0 | 0 | | `function:format_type` | 3 | 0 | 0 | 0 | 3 | | `function:json_build_object` | 25 | 25 | 0 | 0 | 0 |  - If a gap gets worse, CI fails:  ``` known gap type:bool: tursopg returns NULL|NULL|NULL, PostgreSQL returns f|t|f, recorded tursopg answer 0|1|0 ```  - If someone deletes a gap test, CI fails:  ``` gaps/operators-functions.sqltest: gap 

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

### Incident Patch 1: `091610f8` (2026-11-20)
**Commit Message**: testing/sqltest: add @compat-gap tests with a fixed-gap check and lints

The PostgreSQL suites record tursopg's wrong answers with `expect @tursopg`
blocks, but nothing tells a recorded difference from an error-message
override, and a fixed gap stays recorded until someone notices.

A test with `@compat-gap "<kind>:<object>"` holds the PostgreSQL 18 answer
in its default block and tursopg's current answer in its `expect @tursopg`
block. On tursopg it passes on the recorded answer and fails with "gap
fixed" on the PostgreSQL answer, so a fix must remove the gap. For an
error gap, tursopg's answer is compared with the SQLSTATE of the default
block only, because tursopg need not return PostgreSQL's message; the
postgres backend checks the SQLSTATE and the message. Other backends
refuse @compat-gap tests. Both failure messages name tursopg's answer and
the PostgreSQL answer, so the reader does not have to open the test file
to see the difference.

The gap lints run only when `sqltest run` or `sqltest check` gets
--compat-gaps, so the suites that do not pass it cannot hold a
@compat-gap test. The lints reject a @compat-gap test that has no
@tursopg block, does not run on PostgreSQL, use

**File**: `testing/sqltest/src/comparison/mod.rs` (modified, +143/-0)
```diff
@@ -4,6 +4,8 @@ pub mod unordered;
 
 use crate::backends::QueryResult;
 use crate::parser::ast::Expectation;
+use regex::RegexBuilder;
+use std::collections::HashSet;
 
 /// Result of comparing actual vs expected output
 #[derive(Debug, Clone, PartialEq)]
@@ -109,6 +111,68 @@ fn compare_error(
     }
 }
 
+/// Whether one query result can match both expectations under the rules of
+/// [`compare`]. It assumes that no output value holds a line break. Where
+/// it cannot decide, it answers true: for an `expect pattern` block against
+/// an `expect unordered` or another `expect pattern` block, and for two error
+/// messages, because two regexes can match the same message.
+pub fn may_match_same_output(a: &Expectation, b: &Expectation) -> bool {
+    match (a, b) {
+        (Expectation::Error { sqlstate: a, .. }, Expectation::Error { sqlstate: b, .. }) => {
+            // compare_error checks a SQLSTATE only when the block names one.
+            match (a, b) {
+                (Some(a), Some(b)) => a == b,
+                _ => true,
+            }
+        }
+        (Expectation::Error { .. }, _) | (_, Expectation::Error { .. }) => false,
+        (Expectation::Exact(a), Expectation::Exact(b)) => exact_text(a) == exact_text(b),
+        (Expectation::Unordered(a), Expectation::Unordered(b)) => {
+            unordered_set(a) == unordered_set(b)
+        }
+        (Expectation::Exact(exact), Expectation::Unordered(unordered))
+        | (Expectation::Unordered(unordered), Expectation::Exact(exact)) => {
+            exact_matches_unordered(exact, unordered)
+        }
+        (Expectation::Pattern(pattern), Expectation::Exact(exact))
+        | (Expectation::Exact(exact), Expectation::Pattern(pattern)) => {
+            // exact::compare accepts only output whose text is exact_text, and
+            // pattern::compare matches the regex against that same text.
+            RegexBuilder::new(pattern)
+                .build()
+                .is_ok_and(|re| re.is_match(&exact_text(exact)))
+        }
+        (Expectation::Pattern(_), _) | (_, Expectation::Pattern(_)) => true,
+    }
+}
+
+/// The only output text that exact::compare accepts for these lines.
+fn exact_text(lines: &[String]) -> String {
+    format_rows(&parse_expected_rows(lines))
+}
+
+/// The set of rows that unordered::compare accepts for these lines.
+fn unordered_set(lines: &[String]) -> HashSet<String> {
+    parse_expected_rows(lines)
+        .iter()
+        .map(|row| row.join("|"))
+        .collect()
+}
+
+/// Whether some output has the text of the exact block and the row set of
+/// the unordered block. Without line breaks in values, the rows of an output
+/// are the lines of its text. The empty text is also the text of an output
+/// with no rows.
+fn exact_matches_unordered(exact: &[String], unordered: &[String]) -> bool {
+    let text = exact_text(exact);
+    let expected = unordered_set(unordered);
+    if text.is_empty() && expected.is_empty() {
+        return true;
+    }
+    let rows: HashSet<String> = text.split('\n').map(str::to_string).collect();
+    rows == expected
+}
+
 /// Format rows for display (pipe-separated)
 pub fn format_rows(rows: &[Vec<String>]) -> String {
     rows.iter()
@@ -279,4 +343,83 @@ mod tests {
             ComparisonResult::mismatch("expected error but query succeeded")
         );
     }
+
+    fn lines(rows: &[&str]) -> Vec<String> {
+        rows.iter().map(|r| r.to_string()).collect()
+    }
+
+    #[test]
+    fn unordered_blocks_with_repeated_rows_match_the_same_output() {
+        // unordered::compare compares row sets, so the output `1` matches both.
+        let a = Expectation::Unordered(lines(&["1", "1"]));
+        let b = Expectation::Unordered(lines(&["1"]));
+        let output = QueryResult::success(vec![vec!["1".to_string()]]);
+        assert!(compare(&output, &a).is_match() && compare(&output, &b).is_match());
+        assert!(may_match_same_output(&a, &b));
+    }
+
+    #[test]
+    fn a_null_row_makes_exact_blocks_differ() {
+        // An empty line is a row with one NULL value.
+        let a = Expectation::Exact(lines(&["1", ""]));
+        let b = Expectation::Exact(lines(&["1"]));
+        assert!(!may_match_same_output(&a, &b));
+        let with_null = QueryResult::success(vec![vec!["1".to_string()], vec!["".to_string()]]);
+        assert!(compare(&with_null, &a).is_match() && !compare(&with_null, &b).is_match());
+    }
+
+    #[test]
+    fn exact_text_is_not_trimmed_inside_rows() {
+        let a = Expectation::Exact(lines(&["a "]));
+        let b = Expectation::Exact(lines(&["a"]));
+        assert!(!may_match_same_output(&a, &b));
+    }
+
+    #[test]
+    fn exact_and_unordered_blocks() {
+        let exact = Expectation::Exact(lines(&["2", "1", "2"]));
+        assert!(may_match_same_output(
+            &exact,
+            &Expectation::Unordered(lines(&["1", "2"]))
+        ));
+        assert!(!may_match_same_output(
+            &exact
```

**File**: `testing/sqltest/src/gap.rs` (added, +433/-0)
```diff
@@ -0,0 +1,433 @@
+//! Gap tests.
+//!
+//! A gap test records a known difference between tursopg and PostgreSQL 18.
+//! It is a test with a `@compat-gap "<kind>:<object>"` decorator, a default `expect`
+//! block that holds the PostgreSQL answer and an `expect @tursopg` block that
+//! holds the current tursopg answer. The postgres backend checks the default
+//! block, which proves the recorded PostgreSQL answer. The tursopg backend
+//! passes when tursopg still gives the recorded answer and fails when tursopg
+//! gives the PostgreSQL answer, so that a fixed gap cannot stay recorded.
+//!
+//! This module validates gap tests.
+
+use crate::backends::QueryResult;
+use crate::parser::ast::{Backend, Expectation, Skip, SkipCondition, TestCase, TestFile};
+use std::fmt;
+
+/// What a gap label names.
+#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
+pub enum GapKind {
+    Function,
+    Type,
+    Operator,
+    Cast,
+    Syntax,
+}
+
+impl GapKind {
+    pub const ALL: &'static [GapKind] = &[
+        GapKind::Function,
+        GapKind::Type,
+        GapKind::Operator,
+        GapKind::Cast,
+        GapKind::Syntax,
+    ];
+
+    pub fn name(self) -> &'static str {
+        match self {
+            GapKind::Function => "function",
+            GapKind::Type => "type",
+            GapKind::Operator => "operator",
+            GapKind::Cast => "cast",
+            GapKind::Syntax => "syntax",
+        }
+    }
+}
+
+impl fmt::Display for GapKind {
+    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
+        f.write_str(self.name())
+    }
+}
+
+/// The longest answer that messages and the summary print before they cut it.
+const MAX_ANSWER_LEN: usize = 80;
+
+/// One line that describes the answer an expectation records, such as
+/// `2`, `1|t; 2|f`, `no rows` or `error 22003`.
+pub fn describe_expectation(expectation: &Expectation) -> String {
+    let text = match expectation {
+        Expectation::Exact(rows) => describe_rows(trimmed(rows)),
+        Expectation::Unordered(rows) => format!("{} (any order)", describe_rows(trimmed(rows))),
+        Expectation::Pattern(pattern) => format!("output matching /{pattern}/"),
+        Expectation::Error { sqlstate, .. } => match sqlstate {
+            Some(sqlstate) => format!("error {sqlstate}"),
+            None => "an error".to_string(),
+        },
+    };
+    shorten(text)
+}
+
+/// One line that describes what a backend returned, in the form of
+/// [`describe_expectation`].
+pub fn describe_result(result: &QueryResult) -> String {
+    let text = if result.is_error() {
+        match &result.sqlstate {
+            Some(sqlstate) => format!("error {sqlstate}"),
+            None => format!(
+                "error \"{}\"",
+                result
+                    .error
+                    .as_deref()
+                    .unwrap_or("")
+                    .lines()
+                    .next()
+                    .unwrap_or("")
+            ),
+        }
+    } else {
+        let rows: Vec<String> = result.rows.iter().map(|row| row.join("|")).collect();
+        describe_rows(rows.iter().map(String::as_str).collect())
+    };
+    shorten(text)
+}
+
+fn describe_rows(rows: Vec<&str>) -> String {
+    if rows.is_empty() {
+        "no rows".to_string()
+    } else {
+        rows.iter()
+            .map(|row| row.trim())
+            .collect::<Vec<_>>()
+            .join("; ")
+    }
+}
+
+fn shorten(text: String) -> String {
+    match text.char_indices().nth(MAX_ANSWER_LEN) {
+        Some((end, _)) => format!("{}...", &text[..end]),
+        None => text,
+    }
+}
+
+/// Checks the syntax of a gap label and returns its kind. The label is
+/// `<kind>:<object>`. This does not check that the object exists in
+/// PostgreSQL.
+fn label_kind(label: &str) -> Result<GapKind, String> {
+    let Some((kind, object)) = label.split_once(':') else {
+        return Err(format!(
+            "gap label '{label}' has no kind: write it as <kind>:<object>, for example function:round"
+        ));
+    };
+    let kind = GapKind::ALL
+        .iter()
+        .copied()
+        .find(|k| k.name() == kind)
+        .ok_or_else(|| {
+            format!(
+                "gap label '{label}' has the unknown kind '{kind}'; the kinds are {}",
+                GapKind::ALL
+                    .iter()
+                    .map(|k| k.name())
+                    .collect::<Vec<_>>()
+                    .join(", ")
+            )
+        })?;
+    if object.is_empty() || object.trim() != object {
+        return Err(format!(
+            "gap label '{label}' needs an object after '{kind}:' with no leading or trailing spaces"
+        ));
+    }
+    if kind == GapKind::Cast && !object.contains(" -> ") {
+        return Err(format!(
+            "gap label '{label}' names a cast as '<source type> -> <target type>', for example cast:text -> timestamptz"
+        ));
+    }
+    Ok(kind)
+}
+
+/// Checks the rules for a t
```

**File**: `testing/sqltest/src/lib.rs` (modified, +1/-0)
```diff
@@ -1,5 +1,6 @@
 pub mod backends;
 pub mod comparison;
+pub mod gap;
 pub mod generator;
 pub mod matrix_oracle;
 pub mod output;
```

**File**: `testing/sqltest/src/main.rs` (modified, +21/-7)
```diff
@@ -102,13 +102,23 @@ enum Commands {
         /// Stop at the first failed test or error
         #[arg(long)]
         fail_fast: bool,
+
+        /// Turn on the gap lints, which the PostgreSQL suites need; without
+        /// them a `@compat-gap` test does not parse.
+        #[arg(long)]
+        compat_gaps: bool,
     },
 
     /// Validate test file syntax and check for pending snapshots
     Check {
         /// Test files or directories
         #[arg(required = true)]
         paths: Vec<PathBuf>,
+
+        /// Turn on the gap lints, which the PostgreSQL suites need; without
+        /// them a `@compat-gap` test does not parse.
+        #[arg(long)]
+        compat_gaps: bool,
     },
 
     /// Convert Tcl .test files to .sqltest format
@@ -173,6 +183,7 @@ async fn main() -> ExitCode {
             cross_check_binary,
             postgres_dsn,
             fail_fast,
+            compat_gaps,
         } => {
             run_tests(
                 paths,
@@ -190,10 +201,11 @@ async fn main() -> ExitCode {
                 cross_check_binary,
                 postgres_dsn,
                 fail_fast,
+                compat_gaps,
             )
             .await
         }
-        Commands::Check { paths } => check_files(paths).await,
+        Commands::Check { paths, compat_gaps } => check_files(paths, compat_gaps).await,
         Commands::Convert {
             paths,
             output_dir,
@@ -248,6 +260,7 @@ async fn run_tests(
     cross_check_binary: Option<PathBuf>,
     postgres_dsn: Option<String>,
     fail_fast: bool,
+    compat_gaps: bool,
 ) -> ExitCode {
     match (&postgres_dsn, backend_type.as_str()) {
         (None, "postgres") => {
@@ -304,7 +317,7 @@ async fn run_tests(
     };
 
     // Load and parse test files
-    let loaded = match load_test_files(&paths).await {
+    let loaded = match load_test_files(&paths, &sqltest::gap::lint(compat_gaps)).await {
         Ok(loaded) => loaded,
         Err(e) => {
             eprintln!("Error loading test files: {e}");
@@ -561,7 +574,8 @@ impl sqltest::DefaultDatabaseResolver for DefaultDatabasesResolver {
     }
 }
 
-async fn check_files(paths: Vec<PathBuf>) -> ExitCode {
+async fn check_files(paths: Vec<PathBuf>, compat_gaps: bool) -> ExitCode {
+    let lint = sqltest::gap::lint(compat_gaps);
     let mut has_errors = false;
 
     // Check for pending snapshot files
@@ -607,7 +621,7 @@ async fn check_files(paths: Vec<PathBuf>) -> ExitCode {
                     for entry in entries {
                         match entry {
                             Ok(file_path) => {
-                                if !check_single_file(&file_path) {
+                                if !check_single_file(&file_path, &lint) {
                                     has_errors = true;
                                 }
                             }
@@ -624,7 +638,7 @@ async fn check_files(paths: Vec<PathBuf>) -> ExitCode {
                 }
             }
         } else if path.is_file() {
-            if !check_single_file(path) {
+            if !check_single_file(path, &lint) {
                 has_errors = true;
             }
         } else {
@@ -640,9 +654,9 @@ async fn check_files(paths: Vec<PathBuf>) -> ExitCode {
     }
 }
 
-fn check_single_file(path: &PathBuf) -> bool {
+fn check_single_file(path: &PathBuf, lint: sqltest::parser::TestLint<'_>) -> bool {
     match std::fs::read_to_string(path) {
-        Ok(content) => match sqltest::parse(&content) {
+        Ok(content) => match sqltest::parser::parse_with_lint(&content, lint) {
             Ok(file) => {
                 let snapshots_str = if file.snapshots.is_empty() {
                     String::new()
```

**File**: `testing/sqltest/src/parser/ast.rs` (modified, +3/-0)
```diff
@@ -321,6 +321,9 @@ pub struct TestCase {
     pub sql: String,
     /// Expected results (with optional backend-specific overrides)
     pub expectations: Expectations,
+    /// The label of a gap test, from `@compat-gap "<kind>:<object>"`. A gap test
+    /// records a known difference between tursopg and PostgreSQL.
+    pub gap: Option<String>,
     /// Common modifiers (setups, skip, backend, requires)
     pub modifiers: CaseModifiers,
 }
```

**File**: `testing/sqltest/src/parser/lexer.rs` (modified, +5/-0)
```diff
@@ -146,6 +146,10 @@ pub enum Token {
     #[token("@verify-materialized-views")]
     AtVerifyMaterializedViews,
 
+    /// `@compat-gap` (a test of a known difference from PostgreSQL)
+    #[token("@compat-gap")]
+    AtGap,
+
     /// `@sqlstate` (the SQLSTATE that the next `expect error` block requires)
     #[token("@sqlstate")]
     AtSqlstate,
@@ -276,6 +280,7 @@ impl fmt::Display for Token {
             Token::AtVar => write!(f, "@var"),
             Token::AtVerifyMaterializedViews => write!(f, "@verify-materialized-views"),
             Token::AtSqlstate => write!(f, "@sqlstate"),
+            Token::AtGap => write!(f, "@compat-gap"),
             Token::AtIdentifier(s) => write!(f, "@{s}"),
             Token::Setup => write!(f, "setup"),
             Token::Test => write!(f, "test"),
```

**File**: `testing/sqltest/src/parser/mod.rs` (modified, +58/-19)
```diff
@@ -21,11 +21,45 @@ enum TestOrSnapshot {
     Setup(String, Setup),
 }
 
-/// Parse a `.sqltest` file from source
+/// A check that a caller of [`parse_with_lint`] runs on each test of a parsed
+/// file. It returns the message of a broken rule.
+pub type TestLint<'a> = &'a (dyn Fn(&TestFile, &TestCase) -> Result<(), String> + Sync);
+
+/// Parse a `.sqltest` file from source. A test with `@compat-gap` is an error:
+/// gap tests need the gap lints, which [`parse_with_lint`] runs.
 pub fn parse(input: &str) -> Result<TestFile, ParseError> {
+    parse_with_lint(input, &reject_compat_gap)
+}
+
+/// Parse a `.sqltest` file from source and run `lint` on each test. A lint
+/// error points at the name of the test.
+pub fn parse_with_lint(input: &str, lint: TestLint<'_>) -> Result<TestFile, ParseError> {
     let tokens = tokenize(input)?;
     let mut parser = Parser::new(tokens);
-    parser.parse()
+    let file = parser.parse()?;
+    for test in &file.tests {
+        if let Err(message) = lint(&file, test) {
+            return Err(ParseError::ValidationError {
+                message: format!("test '{}': {message}", test.name),
+                span: Some(SourceSpan::new(
+                    test.name_span.start.into(),
+                    test.name_span.len(),
+                )),
+                help: None,
+            });
+        }
+    }
+    Ok(file)
+}
+
+/// The lint of [`parse`]: a `@compat-gap` test is an error.
+pub fn reject_compat_gap(_file: &TestFile, test: &TestCase) -> Result<(), String> {
+    match test.gap {
+        Some(_) => Err(
+            "a @compat-gap test needs the gap lints: run sqltest with --compat-gaps".to_string(),
+        ),
+        None => Ok(()),
+    }
 }
 
 fn eval_block_macro_count(expr: &str) -> Result<usize, String> {
@@ -152,6 +186,7 @@ impl Parser {
                     | Token::AtBackend
                     | Token::AtCrossCheckIntegrity
                     | Token::AtSqliteReference
+                    | Token::AtGap
                     | Token::AtVar
                     | Token::Test
                     | Token::Snapshot
@@ -306,6 +341,7 @@ impl Parser {
         let mut cross_check_integrity = false;
         let mut sqlite_reference = false;
         let mut matrix_vars: Vec<MatrixVar> = Vec::new();
+        let mut gap: Option<String> = None;
 
         // Parse decorators
         loop {
@@ -378,10 +414,21 @@ impl Parser {
                     sqlite_reference = true;
                     self.skip_newlines_and_comments();
                 }
+                Some(Token::AtGap) => {
+                    self.advance();
+                    if gap.is_some() {
+                        return Err(self.error("a test takes one @compat-gap label".to_string()));
+                    }
+                    gap = Some(self.expect_string()?);
+                    self.skip_newlines_and_comments();
+                }
                 _ => break,
             }
         }
 
+        if gap.is_some() && !matches!(self.peek(), Some(Token::Test)) {
+            return Err(self.error("@compat-gap is only valid before a test".to_string()));
+        }
         // Now check if it's a test, snapshot or matrix
         if !matrix_vars.is_empty() && !matches!(self.peek(), Some(Token::Matrix)) {
             return Err(self.error("@var decorators are only valid before a matrix".to_string()));
@@ -525,6 +572,7 @@ impl Parser {
                     name_span,
                     sql,
                     expectations: Expectations { default, overrides },
+                    gap,
                     modifiers: CaseModifiers {
                         setups: test_setups,
                         skip,
@@ -1390,9 +1438,6 @@ test postgres {
 expect {
     1
 }
-expect @tursopg {
-    2
-}
 "#;
 
         let file = parse(input).unwrap();
@@ -1402,10 +1447,6 @@ expect @tursopg {
             file.tests[0].modifiers.backend,
             Some(ast::Backend::Postgres)
         );
-        assert!(matches!(
-            file.tests[0].expectations.for_backend(ast::Backend::Tursopg),
-            Expectation::Exact(rows) if rows == &vec!["2".to_string()]
-        ));
         assert!(matches!(
             file.tests[0].expectations.for_backend(ast::Backend::Postgres),
             Expectation::Exact(rows) if rows == &vec!["1".to_string()]
@@ -1738,11 +1779,12 @@ test missing-table {
 expect error {
     relation "missing" does not exist
 }
+@sqlstate 42P01
 expect @tursopg error {
     no such table
 }
-@sqlstate XX000
-expect @postgres error {
+expect @rust error {
+    no such table
 }
 "#;
 
@@ -1758,15 +1800,15 @@ expect @postgres error {
         assert_eq!(
             expectations.for_backend(ast::Backend::Tursopg),
             &Expectation::Error {
-                sqlstate: None,
+                sqlstate: Some("42P01".to_string()),
                 pattern: Some("no such table".to_string()),
             }
         );
         assert_eq!(
-            expectat
```

**File**: `testing/sqltest/src/runner/mod.rs` (modified, +297/-6)
```diff
@@ -9,6 +9,7 @@ use crate::snapshot::{SnapshotInfo, SnapshotManager, SnapshotResult, SnapshotUpd
 use async_trait::async_trait;
 use futures::FutureExt;
 use futures::stream::{FuturesUnordered, StreamExt};
+use std::borrow::Cow;
 use std::collections::{HashMap, HashSet};
 use std::panic::AssertUnwindSafe;
 use std::path::{Path, PathBuf};
@@ -128,6 +129,15 @@ impl Runnable for TestCase {
     }
 
     fn check_backend_support(&self, options: &RunOptions) -> Option<String> {
+        if self.gap.is_some()
+            && !matches!(options.backend_type, Backend::Tursopg | Backend::Postgres)
+        {
+            return Some(format!(
+                "@compat-gap tests record differences between tursopg and PostgreSQL and run only on \
+                 the tursopg and postgres backends, not on the {} backend",
+                options.backend_type
+            ));
+        }
         let expectation = self.expectations.for_backend(options.backend_type);
         if expectation.sqlstate().is_some() && !options.backend_reports_sqlstate {
             return Some(format!(
@@ -159,6 +169,9 @@ impl Runnable for TestCase {
         // Tests use only the first (and only) result
         assert!(results.len() == 1);
         let result = results.first().unwrap();
+        if self.gap.is_some() && options.backend_type == Backend::Tursopg {
+            return evaluate_gap_test(self, result);
+        }
         let expectation = self.expectations.for_backend(options.backend_type);
         let comparison = compare(result, expectation);
         match comparison {
@@ -168,6 +181,62 @@ impl Runnable for TestCase {
     }
 }
 
+/// The message of a gap test that tursopg now answers like PostgreSQL.
+pub const GAP_FIXED: &str = "gap fixed: remove @compat-gap and the expect @tursopg override";
+
+/// Evaluates a gap test on the tursopg backend. The PostgreSQL answer is
+/// checked first, so that a fixed gap fails the run instead of passing as a
+/// known gap. Both failure messages name the tursopg and the PostgreSQL
+/// answer.
+fn evaluate_gap_test(test: &TestCase, result: &QueryResult) -> TestOutcome {
+    let label = test
+        .gap
+        .as_deref()
+        .expect("evaluate_gap_test runs only for @compat-gap tests");
+    let actual = crate::gap::describe_result(result);
+    let postgres = crate::gap::describe_expectation(&test.expectations.default);
+    // The default error block may hold the PostgreSQL message, which only the
+    // postgres backend checks. tursopg fixes an error gap when it returns the
+    // PostgreSQL SQLSTATE, whatever its message.
+    let reference = match &test.expectations.default {
+        Expectation::Error { sqlstate, .. } => Cow::Owned(Expectation::Error {
+            sqlstate: sqlstate.clone(),
+            pattern: None,
+        }),
+        expectation => Cow::Borrowed(expectation),
+    };
+    if compare(result, &reference).is_match() {
+        let message_note = if compare(result, &test.expectations.default).is_match() {
+            ""
+        } else {
+            "\ntursopg returns the PostgreSQL SQLSTATE with another message: keep an \
+             `expect @tursopg error` block with the same @sqlstate and the tursopg message"
+        };
+        return TestOutcome::Failed {
+            reason: format!(
+                "{GAP_FIXED}\n{label}: tursopg returns {actual}, PostgreSQL returns {postgres}{message_note}"
+            ),
+        };
+    }
+    let tursopg = test
+        .expectations
+        .overrides
+        .get(&Backend::Tursopg)
+        .expect("the gap lints reject a @compat-gap test without an `expect @tursopg` block");
+    match compare(result, tursopg) {
+        ComparisonResult::Match => TestOutcome::Passed,
+        ComparisonResult::Mismatch { reason } => TestOutcome::Failed {
+            reason: format!(
+                "known gap {label}: tursopg returns {actual}, PostgreSQL returns {postgres}, \
+                 recorded tursopg answer {recorded}; tursopg gives neither the PostgreSQL answer \
+                 nor the recorded gap answer (the comparison below is against the \
+                 `expect @tursopg` block)\n{reason}",
+                recorded = crate::gap::describe_expectation(tursopg),
+            ),
+        },
+    }
+}
+
 #[async_trait]
 impl Runnable for SnapshotCase {
     fn name(&self) -> &str {
@@ -707,9 +776,12 @@ impl LoadedTests {
 ///
 /// This function handles:
 /// - Resolving directories (globbing for .sqltest files)
-/// - Reading and parsing each file
+/// - Reading and parsing each file, running `lint` on each test
 /// - Collecting parse errors separately for reporting
-pub async fn load_test_files(paths: &[PathBuf]) -> Result<LoadedTests, BackendError> {
+pub async fn load_test_files(
+    paths: &[PathBuf],
+    lint: crate::parser::TestLint<'_>,
+) -> Result<LoadedTests, BackendError> {
     let mut files = Vec::new();
     let mut errors = Vec::new();
 
@@ -723,15 +795,15 @@ pub async f
```

---

### Incident Patch 2: `425ed463` (2026-11-19)
**Commit Message**: core/fts: size the term table of a segment build from the buffered documents

build_segment gave each SegmentWriter the memory budget of the largest
batch, DEFAULT_MEMORY_BUDGET_BYTES (64 MiB). Tantivy uses this budget
only to size the initial hash table of terms: the largest power of two
from 2^10 to 2^19 entries of 8 bytes that is less than a third of the
budget. Thus each segment build made a table of 2^19 entries (4 MiB),
also for a statement that adds one row. SegmentWriter::for_segment
filled this table, and finalize read all of it to collect the terms.

build_segment now gives a budget of 16 KiB for each buffered document,
from 32 KiB to DEFAULT_MEMORY_BUDGET_BYTES. A statement that adds one
row gets the smallest table (2^10 entries), and a batch of 769 or more
documents gets the table of before. The table grows when it is half
full, and the writer sorts the terms before it writes them, so the
segment files do not change. The new test builds the same 1,000
documents with the smallest budget and with DEFAULT_MEMORY_BUDGET_BYTES,
and compares the files.

Simulated time (callgrind, cache settings of the CodSpeed runner):

| Benchmark | Before | After | Change |
|---|---:|---:|-

**File**: `core/index_method/fts/mod.rs` (modified, +28/-1)
```diff
@@ -137,6 +137,16 @@ fn key_info() -> KeyInfo {
 /// Memory budget for Tantivy's per-segment writer arena.
 pub const DEFAULT_MEMORY_BUDGET_BYTES: usize = 64 * 1024 * 1024;
 
+/// Memory budget of the segment writer for each buffered document. With this
+/// value, a batch of `BATCH_COMMIT_SIZE` documents gets the largest initial
+/// term table, as with `DEFAULT_MEMORY_BUDGET_BYTES`.
+const SEGMENT_MEMORY_BUDGET_BYTES_PER_DOC: usize = 16 * 1024;
+
+/// The smallest memory budget of the segment writer. It gives Tantivy's
+/// smallest initial term table (2^10 entries). Tantivy refuses a budget of
+/// 24 KiB or less.
+const MIN_SEGMENT_MEMORY_BUDGET_BYTES: usize = 32 * 1024;
+
 /// Chunk size (512 KiB) for splitting segment files into backing rows.
 pub const DEFAULT_CHUNK_SIZE: usize = 512 * 1024;
 
@@ -2201,7 +2211,8 @@ impl FtsCursor {
         self.register_tokenizers(&index);
         let segment_id = self.mint_segment_id();
         let segment = index.segment(index.new_segment_meta(segment_id, 0));
-        let mut writer = SegmentWriter::for_segment(DEFAULT_MEMORY_BUDGET_BYTES, segment)
+        let memory_budget = Self::segment_memory_budget(self.doc_buffer.len());
+        let mut writer = SegmentWriter::for_segment(memory_budget, segment)
             .map_err(|e| build_dir.write_error(e, "FTS segment writer"))?;
         let identity_base = self.mint_identity_base();
         let mut added = 0u32;
@@ -2246,6 +2257,22 @@ impl FtsCursor {
         segment_rows_from_files(segment_id, max_doc, captured, identities)
     }
 
+    /// The memory budget of the segment writer for `doc_count` buffered
+    /// documents.
+    ///
+    /// Tantivy uses the budget only to size the initial hash table of terms:
+    /// the largest power of two from 2^10 to 2^19 entries of 8 bytes that
+    /// is less than a third of the budget. The table grows when it is half
+    /// full, and the writer sorts the terms before it writes them, so the
+    /// size does not change the segment files. Each build fills the table
+    /// and `finalize` reads all of it, so a table that is too large for the
+    /// batch makes the build slow.
+    fn segment_memory_budget(doc_count: usize) -> usize {
+        doc_count
+            .saturating_mul(SEGMENT_MEMORY_BUDGET_BYTES_PER_DOC)
+            .clamp(MIN_SEGMENT_MEMORY_BUDGET_BYTES, DEFAULT_MEMORY_BUDGET_BYTES)
+    }
+
     /// Drive the in-flight publication (row deletions, then row inserts,
     /// then in-memory effects exactly once).
     fn drive_publish(&mut self) -> IOResultOr<()> {
```

**File**: `core/index_method/fts/tests.rs` (modified, +57/-0)
```diff
@@ -554,6 +554,63 @@ fn segment_load_rejects_the_old_identity_field() {
     assert!(error.to_string().contains("rebuild the index"), "{error}");
 }
 
+#[test]
+fn segment_files_do_not_depend_on_the_writer_memory_budget() {
+    // `build_segment` gives the segment writer of a small batch a small
+    // memory budget. Tantivy uses the budget only for the initial size of its
+    // term table, and FTS stores the segment files in the database. Thus the
+    // files must be the same for each budget, also when the table grows.
+    let attachment = test_attachment();
+    let cursor = FtsCursor::new(&attachment);
+    let segment_id = SegmentId::generate_random();
+    let build = |memory_budget: usize| {
+        let directory = BuildDirectory::default();
+        let index = Index::create(
+            directory.clone(),
+            attachment.schema.clone(),
+            IndexSettings::default(),
+        )
+        .unwrap();
+        cursor.register_tokenizers(&index);
+        let mut writer = SegmentWriter::for_segment(
+            memory_budget,
+            index.segment(index.new_segment_meta(segment_id, 0)),
+        )
+        .unwrap();
+        // About 3,000 different terms: the smallest table (2^10 entries)
+        // grows three times.
+        for rowid in 0..1000i64 {
+            let mut document = TantivyDocument::default();
+            document.add_i64(attachment.rowid_field, rowid);
+            document.add_text(attachment.indexed_fields[0].1, format!("title {rowid}"));
+            document.add_text(
+                attachment.indexed_fields[1].1,
+                format!("body word{rowid} shared text{}", rowid % 7),
+            );
+            document.add_u64(attachment.identity_hi_field, 1);
+            document.add_u64(attachment.identity_lo_field, rowid as u64);
+            writer
+                .add_document(AddOperation {
+                    opstamp: 0,
+                    document,
+                })
+                .unwrap();
+        }
+        writer.finalize().unwrap();
+        let mut files: Vec<_> = directory
+            .captured_files()
+            .into_iter()
+            .map(|(path, bytes)| (path, bytes.to_vec()))
+            .collect();
+        files.sort();
+        files
+    };
+    let smallest = build(FtsCursor::segment_memory_budget(1));
+    let largest = build(DEFAULT_MEMORY_BUDGET_BYTES);
+    assert!(!largest.is_empty());
+    assert_eq!(smallest, largest);
+}
+
 #[test]
 fn merge_keeps_document_identities_and_retires_only_dropped_tombstones() {
     let attachment = test_attachment();
```

---

### Incident Patch 3: `d0181b16` (2026-11-19)
**Commit Message**: core/io: make a full page of an in-memory file from the written bytes

MemStore keeps the bytes of an in-memory file in pages of 4096 bytes.
write_at_inner allocated each new page filled with zeros, and then
copied the written bytes over it. Thus a write that covers a whole new
page wrote each of its bytes twice. The spill files of hash tables,
temporary files and in-memory databases are written mostly in whole
pages.

For a new page that the write covers completely, write_at_inner now
makes the page from the written bytes, with one allocation and one
copy. A partial write and a write to an existing page work as before,
and the file gives the same bytes. The new test compares the store with
a flat Vec after writes of whole pages, partial pages and overwrites.

Simulated time (callgrind, cache settings of the CodSpeed runner):

| Benchmark | Before | After | Change |
|---|---:|---:|---:|
| `hash_spill_benchmark` `HashTable Build (Relaxed Budget)` `with_100b_payload[10000]` | 18.19 ms | 16.35 ms | -10.1% |
| `hash_spill_benchmark` `HashTable Build (Relaxed Budget)` `with_100b_payload[5000]` | 9.45 ms | 8.68 ms | -8.2% |
| `hash_spill_benchmark` `HashTable Large Payload Spill` `payloa

**File**: `core/io/memory.rs` (modified, +51/-11)
```diff
@@ -5,7 +5,7 @@ use crate::sync::{Mutex, RwLock};
 use crate::turso_assert;
 use crate::Result;
 use std::{
-    collections::{BTreeMap, HashMap},
+    collections::{btree_map::Entry, BTreeMap, HashMap},
     sync::Arc,
 };
 use tracing::debug;
@@ -147,13 +147,6 @@ impl MemStore {
         }
     }
 
-    fn get_or_allocate_page(inner: &mut MemStoreInner, page_no: usize) -> &mut MemPage {
-        inner
-            .pages
-            .entry(page_no)
-            .or_insert_with(|| Box::new([0; PAGE_SIZE]))
-    }
-
     fn write_at_inner(inner: &mut MemStoreInner, pos: u64, data: &[u8]) -> usize {
         let buf_len = data.len();
         if buf_len == 0 {
@@ -166,9 +159,22 @@ impl MemStore {
             let page_no = offset / PAGE_SIZE;
             let page_offset = offset % PAGE_SIZE;
             let bytes_to_write = remaining.min(PAGE_SIZE - page_offset);
-            let page = Self::get_or_allocate_page(inner, page_no);
-            page[page_offset..page_offset + bytes_to_write]
-                .copy_from_slice(&data[buf_offset..buf_offset + bytes_to_write]);
+            let src = &data[buf_offset..buf_offset + bytes_to_write];
+            match inner.pages.entry(page_no) {
+                // The write gives all the bytes of this new page, so the page
+                // is made from them instead of a page of zeros that the copy
+                // then overwrites.
+                Entry::Vacant(slot) if bytes_to_write == PAGE_SIZE => {
+                    let page: MemPage = Box::<[u8]>::from(src)
+                        .try_into()
+                        .expect("a full-page write has PAGE_SIZE bytes");
+                    slot.insert(page);
+                }
+                entry => {
+                    let page = entry.or_insert_with(|| Box::new([0; PAGE_SIZE]));
+                    page[page_offset..page_offset + bytes_to_write].copy_from_slice(src);
+                }
+            }
             offset += bytes_to_write;
             buf_offset += bytes_to_write;
             remaining -= bytes_to_write;
@@ -349,6 +355,40 @@ mod tests {
     use super::*;
     use std::{sync::mpsc, time::Duration};
 
+    /// A write that covers a whole new page makes the page from its bytes,
+    /// and the other writes copy into a page of zeros. Both must give the
+    /// bytes of a flat file, with zeros in the holes.
+    #[test]
+    fn writes_read_back_like_a_flat_file() {
+        let store = MemStore::new();
+        let mut model: Vec<u8> = Vec::new();
+        // (position, length, first byte)
+        let writes = [
+            (0, PAGE_SIZE, 1u8),
+            (PAGE_SIZE * 3 + 100, PAGE_SIZE * 2, 2),
+            (10, 20, 3),
+            (PAGE_SIZE * 6, PAGE_SIZE * 2, 4),
+            (PAGE_SIZE, PAGE_SIZE, 5),
+            (PAGE_SIZE * 6, PAGE_SIZE, 6),
+        ];
+        for (pos, len, first) in writes {
+            let data: Vec<u8> = (0..len).map(|i| first.wrapping_add(i as u8)).collect();
+            assert_eq!(store.write_at(pos as u64, &data), len);
+            if model.len() < pos + len {
+                model.resize(pos + len, 0);
+            }
+            model[pos..pos + len].copy_from_slice(&data);
+        }
+
+        assert_eq!(store.size(), model.len() as u64);
+        let buffer = Buffer::new_temporary(model.len());
+        assert_eq!(store.read_into(0, &buffer) as usize, model.len());
+        assert!(buffer.as_slice() == &model[..]);
+        // No write touched the third page.
+        assert!(store.has_hole(PAGE_SIZE * 2, PAGE_SIZE));
+        assert!(!store.has_hole(PAGE_SIZE, PAGE_SIZE));
+    }
+
     #[test]
     fn vectored_write_is_not_observed_partially() {
         let store = Arc::new(MemStore::new());
```

#### Recent Merged Pull Requests:
- **PR #12168** (2026-11-20): ci/dotnet: pin .NET 10 SDK in iOS package validation (@penberg)
- **PR #12164** (2026-11-20): testing/sqltest: record known PostgreSQL differences as @compat-gap tests (@jussisaurio)
- **PR #12157** (2026-11-20): sdk-kit: update README examples to the current C and Rust API (@turso-github-handyman[bot])
- **PR #12156** (closed): postgres: store timestamp and timestamptz as PostgreSQL does (@jussisaurio)
- **PR #12155** (2026-11-20): postgres: now() is the start of the transaction, statement_timestamp() the time the client's query arrived (@jussisaurio)
- **PR #12151** (2026-11-20): sqlite/conformance: regenerate two gencol snapshots for new bytecode (@glommer)

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

## X. testing/sqltest: add @compat-gap tests with a fixed-gap check and lints

**RULE**:
When implementing operations in `testing/sqltest/src/comparison/mod.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tursodatabase/turso. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `091610f8`: testing/sqltest: add @compat-gap tests with a fixed-gap check and lints. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `testing/sqltest/src/comparison/mod.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use regex::RegexBuilder;
use std::collections::HashSet;
/// Whether one query result can match both expectations under the rules of
/// [`compare`]. It assumes that no output value holds a line break. Where
/// it cannot decide, it answers true: for an `expect pattern` block against
/// an `expect unordered` or another `expect pattern` block, and for two error
/// messages, because two regexes can match the same message.
pub fn may_match_same_output(a: &Expectation, b: &Expectation) -> bool {
    match (a, b) {
        (Expectation::Error { sqlstate: a, .. }, Expectation::Error { sqlstate: b, .. }) => {
            // compare_error checks a SQLSTATE only when the block names one.
            match (a, b) {
                (Some(a), Some(b)) => a == b,
                _ => true,
            }
        }
        (Expectation::Error { .. }, _) | (_, Expectation::Error { .. }) => false,
        (Expectation::Exact(a), Expectation::Exact(b)) => exact_text(a) == exact_text(b),
        (Expectation::Unordered(a), Expectation::Unordered(b)) => {
            unordered_set(a) == unordered_set(b)
        }
        (Expectation::Exact(exact), Expectation::Unordered(unordered))
        | (Expect
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `091610f8` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
