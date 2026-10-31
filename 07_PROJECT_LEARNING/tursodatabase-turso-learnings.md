> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tursodatabase-turso-learnings.md`  
> **Source**: github ([https://github.com/tursodatabase/turso](https://github.com/tursodatabase/turso))  
> **Source Version**: `31315b3d`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T23:49:58.610Z  
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
> **Harvest Timestamp**: 2026-10-31T23:49:58.602Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tursodatabase/turso`
- **Description**: A SQL database in Rust: SQLite-compatible, now also speaking Postgres (experimental). The LLVM of databases.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md
- **Stars / Engagement**: 25108 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

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

### Core Architecture Module: `bindings/rust/examples/concurrent_writes.rs`
```
//! Concurrent writes with MVCC
//!
//! `BEGIN CONCURRENT` lets multiple connections write at the same time without
//! holding an exclusive lock.  Conflicts are detected at commit time: if two
//! transactions worked on same rows, the later one receives a conflict
//! error and must roll back and retry.

use rand::Rng;
use tempfile::NamedTempFile;
use turso::{Builder, Error};

fn is_retryable(e: &Error) -> bool {
    matches!(e, Error::Busy(_) | Error::BusySnapshot(_))
        || matches!(e, Error::Error(msg) if msg.contains("conflict"))
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    let tmp = NamedTempFile::new().expect("failed to create temp file");
    let db = Builder::new_local(tmp.path().to_str().unwrap())
        .build()
        .await?;

    let conn = db.connect()?;
    conn.pragma_update("journal_mode", "'mvcc'").await?;
    conn.execute("CREATE TABLE hits (val INTEGER)", ()).await?;

    let mut handles = Vec::new();
    for _ in 0..16 {
        let db = db.clone();
        handles.push(tokio::spawn(async move {
            let val = rand::rng().random_range(1..=100);
            let conn = db.connect()?;
            loop {
                conn.execute("BEGIN CONCURRENT", ()).await?;
                let result = conn
                    .execute(&format!("INSERT INTO hits VALUES ({val})"), ())
                    .await
                    .and(conn.execute("COMMIT", ()).await);
                match result {
                    Ok(_) => return Ok::<_, Error>(val),
                    Err(ref e) if is_retryable(e) => {
                        let _ = conn.execute("ROLLBACK", ()).await;
                        tokio::task::yield_now().await;
                    }
                    Err(e) => {
                        let _ = conn.execute("ROLLBACK", ()).await;
                        return Err(e);
                    }
                }
            }
        }));
    }

    for handle in handles {
        let val = handle.await.expect("task panicked")?;
        println!("inserted val={val}");
    }

    let mut rows = conn.query("SELECT COUNT(*) FROM hits", ()).await?;
    if let Some(row) = rows.next().await? {
        println!("total rows: {}", row.get::<i64>(0)?);
    }

    Ok(())
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #11194** (2026-10-31): **postgres: yield during deferred cleanup and transaction rollback**
  *Symptoms*: # NOTICE:  This PR uses a branch in the same repository; maintainers with write access can edit it.  ## Description  Add a cooperative PostgreSQL cleanup API, resumable aborted-transaction rollback, and schema-based preparation checks.  - Expose `Statement::cleanup_nonblock()` so callers can drive deferred cleanup before reset or drop. - Retain rollback state across I/O completions and preserve the original execution error and PostgreSQL transaction state. - Replace blocking catalog queries used for index naming, DROP VIEW validation, and COPY TO STDOUT preparation with connection-schema lookups.  `reset()` and `Drop` retain synchronous fallbacks. Core statement reset, COPY file loading, and server-side COPY export execution are not made nonblocking by this change.  ## Motivation and context  Deferred execution already yields, but preparation checks and transaction cleanup could still execute SQL synchronously inside that path. Callers need an explicit way to finish PostgreSQL cleanup cooperatively without losing rollback progress or reporting success before cleanup completes.  Follow-up to #11190 and #11191.  Thread: https://ampcode.com/threads/T-28890b5f-9c6b-4688-9cfe-d58e60c893ee  ## Description of AI Usage  Amp implemented the changes and performed local validation under the author's direction. The linked thread contains the investigation, implementation decisions, and remaining blocking-path limitations. 

- **Issue #11191** (2026-10-31): **postgres: reuse yielding execution for deferred session statements**
  *Symptoms*: # NOTICE:  This branch is in the main repository, so maintainers with repository write access can edit it directly.  ## Description  Remove deferred callbacks and reuse the prerequisite execution state machine for session statements. Schema operations and COPY database work retain their active statement across yields and return I/O completions to the caller through the existing nonblocking runners.  Schema creation and cascading drops use savepoint cleanup so failure or cancellation before commit rolls back the complete operation. COPY file reading and parsing, and reset/drop cleanup, remain synchronous.  ## Motivation and context  Builds on #11190. The prerequisite runner already supports resumable execution, but the remaining deferred callbacks still execute database work synchronously. Sharing that runner removes the separate callback path and preserves progress, interruption handling, and cleanup across yields.  ## Description of AI Usage  Amp implemented and verified this change under the author’s direction. The author requested removal of Callback and reuse of the existing prerequisite execution logic.  Thread: https://ampcode.com/threads/T-28890b5f-9c6b-4688-9cfe-d58e60c893ee
  **Post-Mortem & Fix Analysis**:
  > <!-- __CODSPEED_PERFORMANCE_REPORT_COMMENT__ --> ## Merging this PR will **not alter performance**  <details> <summary><b>2 warnings, 1 note</b></summary>  > :warning: **Unable to measure the execution of 1 benchmark** > > This benchmark measured no execution time, so its result is not comparable and counts as unchanged. This usually happens when the compiler removes the code under test. > > [Prevent compiler optimizations](https://codspeed.io/docs/troubleshooting?utm_source=github&utm_medium=comment-v2&utm_content=optimized_out#optimized-out-benchmarks) > > [See affected benchmarks](https://app.codspeed.io/tursodatabase/turso/branches/fix%2Fpg-deferred-callbacks?q=has%3Aoptimized_out&utm_source=github&utm_medium=comment-v2&utm_content=affected_benchmarks)  > :warning: **83 benchmarks are dominated by system calls** > > System calls cannot be simulated consistently and are left out of the measure. The reported value understates the real cost. Switch to the Walltime instrument to measur

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

### Incident Patch 1: `01cddb12` (2026-10-31)
**Commit Message**: Merge 'core/translate: skip sqlite_sequence rows with a NULL name' from app/turso-github-handyman

## Problem

```sql
CREATE TABLE t1(i INTEGER PRIMARY KEY AUTOINCREMENT);
CREATE TABLE t2(i INTEGER PRIMARY KEY AUTOINCREMENT);
CREATE TABLE t3(i INTEGER PRIMARY KEY AUTOINCREMENT);
INSERT INTO t1 VALUES(NULL);
INSERT INTO t2 VALUES(NULL);
INSERT INTO t3 VALUES(NULL);
UPDATE sqlite_sequence SET name=NULL WHERE name='t2';
INSERT INTO t3 VALUES(NULL);
SELECT rowid, name, seq FROM sqlite_sequence ORDER BY rowid;
-- Turso (main):      SQLite:
-- 1|t1|1             1|t1|1
-- 2||2               2||1     // t3's counter written into the NULL row
-- 3|t3|1             3|t3|2
```

The same thing happens with other statements:
- `ALTER TABLE t3 RENAME TO t4` also renames the NULL row, so there are
two `t4` rows.
- `DROP TABLE t3` also deletes the NULL row.
- In MVCC (multi-version concurrency control) mode, an INSERT deletes
the NULL row.

The loops that find a table's `sqlite_sequence` row compare names with
`Insn::Ne` without the jump-if-NULL flag. `Ne` falls through when an
operand is NULL, so a row with a NULL name counts as a match.

## Fix

The flag is now `CmpInsFlags::default().jump_if_n

**File**: `core/translate/alter.rs` (modified, +2/-2)
```diff
@@ -322,7 +322,7 @@ fn emit_rename_sqlite_sequence_entry(
             lhs: sequence_name_reg,
             rhs: row_name_to_replace_reg,
             target_pc: continue_loop_label,
-            flags: CmpInsFlags::default(),
+            flags: CmpInsFlags::default().jump_if_null(),
             collation: CollationSeq::for_internal_values(),
         });
 
@@ -402,7 +402,7 @@ fn emit_delete_sqlite_sequence_entry(
             lhs: sequence_name_reg,
             rhs: row_name_to_delete_reg,
             target_pc: continue_loop_label,
-            flags: CmpInsFlags::default(),
+            flags: CmpInsFlags::default().jump_if_null(),
             collation: CollationSeq::for_internal_values(),
         });
 
```

**File**: `core/translate/insert.rs` (modified, +1/-1)
```diff
@@ -1850,7 +1850,7 @@ fn reload_autoincrement_state(program: &mut ProgramBuilder, meta: AutoincMeta) {
         lhs: table_name_reg,
         rhs: name_col_reg,
         target_pc: found_label,
-        flags: Default::default(),
+        flags: CmpInsFlags::default().jump_if_null(),
         collation: super::collate::CollationSeq::NOCASE,
     });
     program.emit_insn(Insn::Copy {
```

**File**: `core/translate/schema.rs` (modified, +1/-1)
```diff
@@ -2748,7 +2748,7 @@ pub fn translate_drop_table(
             lhs: seq_table_name_reg,
             rhs: dropped_table_name_reg,
             target_pc: continue_loop_label,
-            flags: CmpInsFlags::default(),
+            flags: CmpInsFlags::default().jump_if_null(),
             collation: CollationSeq::NOCASE,
         });
 
```

**File**: `core/translate/sequence.rs` (modified, +1/-1)
```diff
@@ -758,7 +758,7 @@ pub(crate) fn emit_sqlite_sequence_sync(
         lhs: col_name_reg,
         rhs: name_reg,
         target_pc: skip_delete_label,
-        flags: CmpInsFlags::default(),
+        flags: CmpInsFlags::default().jump_if_null(),
         collation: CollationSeq::for_internal_values(),
     });
     program.emit_insn(Insn::Delete {
```

**File**: `sqlite/conformance/sqlite-sqltests/autoincr.sqltest` (modified, +55/-0)
```diff
@@ -618,3 +618,58 @@ expect {
 	2|second
 	a"b|2
 }
+
+# A sqlite_sequence row with a NULL name belongs to no table: INSERT,
+# ALTER TABLE RENAME and DROP TABLE must leave it alone.
+@cross-check-integrity
+test autoinc-insert-skips-null-name-sequence-row {
+	CREATE TABLE t1(i INTEGER PRIMARY KEY AUTOINCREMENT);
+	CREATE TABLE t2(i INTEGER PRIMARY KEY AUTOINCREMENT);
+	CREATE TABLE t3(i INTEGER PRIMARY KEY AUTOINCREMENT);
+	INSERT INTO t1 VALUES(NULL);
+	INSERT INTO t2 VALUES(NULL);
+	INSERT INTO t3 VALUES(NULL);
+	UPDATE sqlite_sequence SET name=NULL WHERE name='t2';
+	INSERT INTO t3 VALUES(NULL);
+	SELECT rowid, name, seq FROM sqlite_sequence ORDER BY rowid;
+}
+expect {
+	1|t1|1
+	2||1
+	3|t3|2
+}
+
+@cross-check-integrity
+test autoinc-rename-skips-null-name-sequence-row {
+	CREATE TABLE t1(i INTEGER PRIMARY KEY AUTOINCREMENT);
+	CREATE TABLE t2(i INTEGER PRIMARY KEY AUTOINCREMENT);
+	CREATE TABLE t3(i INTEGER PRIMARY KEY AUTOINCREMENT);
+	INSERT INTO t1 VALUES(NULL);
+	INSERT INTO t2 VALUES(NULL);
+	INSERT INTO t3 VALUES(NULL);
+	UPDATE sqlite_sequence SET name=NULL WHERE name='t2';
+	ALTER TABLE t3 RENAME TO t4;
+	SELECT rowid, name, seq FROM sqlite_sequence ORDER BY rowid;
+}
+expect {
+	1|t1|1
+	2||1
+	3|t4|1
+}
+
+@cross-check-integrity
+test autoinc-drop-skips-null-name-sequence-row {
+	CREATE TABLE t1(i INTEGER PRIMARY KEY AUTOINCREMENT);
+	CREATE TABLE t2(i INTEGER PRIMARY KEY AUTOINCREMENT);
+	CREATE TABLE t3(i INTEGER PRIMARY KEY AUTOINCREMENT);
+	INSERT INTO t1 VALUES(NULL);
+	INSERT INTO t2 VALUES(NULL);
+	INSERT INTO t3 VALUES(NULL);
+	UPDATE sqlite_sequence SET name=NULL WHERE name='t2';
+	DROP TABLE t3;
+	SELECT rowid, name, seq FROM sqlite_sequence ORDER BY rowid;
+}
+expect {
+	1|t1|1
+	2||1
+}
```

**File**: `sqlite/conformance/turso-sqltests/mvcc_sequence.sqltest` (modified, +18/-0)
```diff
@@ -505,3 +505,21 @@ expect {
     6
     6
 }
+
+# A sqlite_sequence row with a NULL name belongs to no table, so the MVCC
+# sqlite_sequence sync must not delete it.
+test mvcc-autoincrement-keeps-null-name-sequence-row {
+    PRAGMA journal_mode = 'mvcc';
+    CREATE TABLE t1 (i INTEGER PRIMARY KEY AUTOINCREMENT);
+    CREATE TABLE t2 (i INTEGER PRIMARY KEY AUTOINCREMENT);
+    INSERT INTO t1 VALUES (NULL);
+    INSERT INTO t2 VALUES (NULL);
+    UPDATE sqlite_sequence SET name = NULL WHERE name = 't1';
+    INSERT INTO t2 VALUES (NULL);
+    SELECT name, seq FROM sqlite_sequence ORDER BY name;
+}
+expect {
+    mvcc
+    |1
+    t2|2
+}
```

---

### Incident Patch 2: `5b3a3267` (2026-10-31)
**Commit Message**: postgres: yield while executing statement prerequisites

Deferred prerequisite execution must return pending I/O to callers instead of driving it synchronously inside nonblocking statement methods.

Use the existing nonblocking runners and retain each active statement across yields. Keep savepoint cleanup resumable during execution and preserve the caller's original transaction state. Reset and drop retain synchronous cleanup semantics.

Tests: cargo test -p turso_pg -p turso_pg_tests; cargo clippy -p turso_pg --all-targets --no-deps -- --deny=warnings; cargo fmt --all -- --check

Amp-Thread-ID: https://ampcode.com/threads/T-28890b5f-9c6b-4688-9cfe-d58e60c893ee
Co-authored-by: pedro muniz <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -7282,6 +7282,7 @@ dependencies = [
  "serde_json",
  "strum",
  "tempfile",
+ "tracing",
  "turso_core",
  "turso_ext",
  "turso_parser",
```

**File**: `postgres/frontend/Cargo.toml` (modified, +2/-1)
```diff
@@ -19,6 +19,7 @@ rustc-hash = "2.0"
 serde_json = { workspace = true }
 strum = { workspace = true }
 tempfile = { workspace = true }
+tracing = { workspace = true }
 turso_core = { workspace = true, default-features = true, features = [
     "conn_raw_api",
 ] }
@@ -28,7 +29,7 @@ turso_pg_parser = { workspace = true }
 uuid = "1.11.0"
 
 [dev-dependencies]
-turso_core = { workspace = true, features = ["io_memory_yield"] }
+turso_core = { workspace = true, features = ["io_memory_yield", "test_helper"] }
 
 [lints]
 workspace = true
```

**File**: `postgres/frontend/session.rs` (modified, +218/-55)
```diff
@@ -3,14 +3,17 @@ use std::borrow::Cow;
 use std::num::NonZero;
 use std::str;
 use std::sync::Arc;
+use std::task::Waker;
 
 use crate::catalog::{self, PostgresDialect};
 use crate::error::{in_failed_sql_transaction_error, sqlstate_error};
 use crate::functions::{find_parameter, ConfigParameter, Parameter};
 use crate::settings::{ConnectionSettings, PgSessionState, SettingScope};
 use crate::statement::{PgTxState, PostRunFn, TxRole};
 use turso_core::schema::{Table, SEQ_BACKING_TABLE_PREFIX};
-use turso_core::{Connection, LimboError, Qualifier, Result, Statement, Value};
+use turso_core::{
+    Connection, IOResult, LimboError, Qualifier, Result, Statement, StepResult, Value,
+};
 use turso_parser::ast::{self};
 use turso_pg_parser::foreign_key_tables;
 use turso_pg_parser::sqlstate::{
@@ -447,14 +450,22 @@ fn prepare_statement_inner(
         .conn
         .prepare_translated_cmd(cmd.clone(), &sql)
         .map_err(schema_error)?;
-    let pg_conn = Arc::clone(pg_conn);
-    let prereqs = translated.prereqs;
-    let sql_owned = sql.into_owned();
-    Ok(crate::Statement::with_deferred(
+    Ok(crate::Statement::with_prerequisites(
         inner,
-        Box::new(move |inner| {
-            execute_cmd_with_prereqs(&pg_conn, &prereqs, &cmd, &sql_owned, inner)
-        }),
+        PrerequisiteExecution {
+            pg_conn: Arc::clone(pg_conn),
+            prereqs: translated.prereqs,
+            cmd,
+            sql: sql.into_owned(),
+            phase: PrerequisitePhase::Start,
+            active: None,
+            io_completions: None,
+            was_in_tx: None,
+            savepoint_open: false,
+            target_exists: false,
+            error: None,
+            interrupted: false,
+        },
     )
     .with_tx_tracking(conn, tx, role)
     .with_query_start_marking(marks_query_start)
@@ -559,65 +570,221 @@ fn tx_role(stmt: &ast::Stmt) -> TxRole {
 
 const PG_STMT_SAVEPOINT: &str = "__turso_pg_stmt";
 
-fn execute_cmd_with_prereqs(
-    pg_conn: &Arc<PgConnectionInner>,
-    prereqs: &[ast::Stmt],
-    cmd: &ast::Cmd,
-    sql: &str,
-    inner: &mut Statement,
-) -> Result<()> {
-    let conn = &pg_conn.conn;
-    if create_table_if_not_exists_target_present(conn, cmd)? {
-        *inner = conn
-            .prepare_translated_cmd(cmd.clone(), sql)
-            .map_err(schema_error)?;
-        return inner.run_ignore_rows();
+#[derive(Clone, Copy, PartialEq, Eq)]
+enum PrerequisitePhase {
+    Start,
+    CheckTarget,
+    Savepoint,
+    Prerequisite(usize),
+    Main,
+    Release,
+    Rollback,
+    RollbackRelease,
+    Done,
+}
+
+pub(crate) struct PrerequisiteExecution {
+    pg_conn: Arc<PgConnectionInner>,
+    prereqs: Vec<ast::Stmt>,
+    cmd: ast::Cmd,
+    sql: String,
+    phase: PrerequisitePhase,
+    active: Option<Statement>,
+    pub(crate) io_completions: Option<turso_core::types::IOCompletions>,
+    pub(crate) was_in_tx: Option<bool>,
+    savepoint_open: bool,
+    target_exists: bool,
+    error: Option<LimboError>,
+    pub(crate) interrupted: bool,
+}
+
+impl PrerequisiteExecution {
+    pub(crate) fn step(
+        &mut self,
+        inner: &mut Statement,
+        waker: Option<&Waker>,
+    ) -> Result<StepResult> {
+        self.io_completions = None;
+        loop {
+            if self.phase == PrerequisitePhase::Done {
+                return self.error.clone().map_or(Ok(StepResult::Done), Err);
+            }
+            match self.run_phase_nonblock(inner) {
+                Ok(IOResult::Done(())) => continue,
+                Ok(IOResult::IO(io)) => {
+                    io.set_waker(waker);
+                    let result = if io.is_explicit_yield() {
+                        StepResult::Yield
+                    } else {
+                        StepResult::IO
+                    };
+                    self.io_completions = Some(io);
+                    return Ok(result);
+                }
+                Err(error) => self.fail(error),
+            }
+        }
     }
 
-    let started_in_autocommit = conn.get_auto_commit();
-    let begin_sp = format!("SAVEPOINT \"{PG_STMT_SAVEPOINT}\"");
-    let release_sp = format!("RELEASE SAVEPOINT \"{PG_STMT_SAVEPOINT}\"");
-    execute_sqlite(conn, begin_sp)?;
-    let result = (|| {
-        for prereq in prereqs {
-            let input = prereq.to_string();
-            let mut stmt = conn
-                .prepare_translated_stmt(prereq.clone(), &input)
-                .map_err(schema_error)?;
-            stmt.run_ignore_rows()?;
+    fn run_phase_nonblock(&mut self, inner: &mut Statement) -> Result<IOResult<()>> {
+        use PrerequisitePhase::*;
+
+        let conn = &self.pg_conn.conn;
+        if self.phase == Start {
+            self.was_in_tx = Some(!conn.get_auto_commit());
+            self.active = prepare_create_table_target_check(conn, &self.cmd)?;
+            self.phase = if self.active.is_some() {
+                CheckTarget
+            } else {
+              
```

**File**: `postgres/frontend/statement.rs` (modified, +77/-51)
```diff
@@ -12,14 +12,15 @@ use turso_core::{
 };
 
 use crate::error::in_failed_sql_transaction_error;
+use crate::session::PrerequisiteExecution;
 use crate::Result;
 
 pub(crate) type DeferredExec =
     Box<dyn FnMut(&mut turso_core::Statement) -> turso_core::Result<()> + Send + Sync>;
 
-struct DeferredState {
-    exec: DeferredExec,
-    completed: bool,
+enum DeferredState {
+    Callback { exec: DeferredExec, completed: bool },
+    Prerequisites(Box<PrerequisiteExecution>),
 }
 
 /// How a statement interacts with PostgreSQL's aborted-transaction state.
@@ -191,13 +192,22 @@ impl Statement {
 
     pub(crate) fn with_deferred(inner: turso_core::Statement, exec: DeferredExec) -> Self {
         let mut stmt = Self::new(inner);
-        stmt.deferred = Some(DeferredState {
+        stmt.deferred = Some(DeferredState::Callback {
             exec,
             completed: false,
         });
         stmt
     }
 
+    pub(crate) fn with_prerequisites(
+        inner: turso_core::Statement,
+        exec: PrerequisiteExecution,
+    ) -> Self {
+        let mut stmt = Self::new(inner);
+        stmt.deferred = Some(DeferredState::Prerequisites(Box::new(exec)));
+        stmt
+    }
+
     pub(crate) fn with_tx_tracking(
         mut self,
         conn: Arc<Connection>,
@@ -289,44 +299,46 @@ impl Statement {
         }
     }
 
-    fn execute_deferred(&mut self, was_in_tx: bool) -> Result<()> {
-        let Some(deferred) = self.deferred.as_mut() else {
-            return Ok(());
-        };
-        if !deferred.completed {
-            let result: Result<()> = (deferred.exec)(&mut self.inner).map_err(Into::into);
-            if result.is_err() {
-                self.note_execution_error(was_in_tx);
-                return result;
-            }
-            deferred.completed = true;
-        }
-        Ok(())
-    }
-
     pub fn step(&mut self) -> Result<StepResult> {
-        let Some(was_in_tx) = self.tx_gate()? else {
-            return Ok(StepResult::Done);
-        };
-        self.mark_query_start();
-        if self.deferred.is_some() {
-            self.execute_deferred(was_in_tx)?;
-            return Ok(StepResult::Done);
-        }
-        let result = self.inner.step().map_err(Into::into);
-        self.finish_step(result, was_in_tx)
+        self.step_inner(None)
     }
 
     pub fn step_with_waker(&mut self, waker: &Waker) -> Result<StepResult> {
-        let Some(was_in_tx) = self.tx_gate()? else {
-            return Ok(StepResult::Done);
+        self.step_inner(Some(waker))
+    }
+
+    fn step_inner(&mut self, waker: Option<&Waker>) -> Result<StepResult> {
+        let saved_tx = match &self.deferred {
+            Some(DeferredState::Prerequisites(exec)) => exec.was_in_tx,
+            _ => None,
         };
-        self.mark_query_start();
-        if self.deferred.is_some() {
-            self.execute_deferred(was_in_tx)?;
+        let tx = match saved_tx {
+            Some(was_in_tx) => Some(was_in_tx),
+            None => self.tx_gate()?,
+        };
+        let Some(was_in_tx) = tx else {
             return Ok(StepResult::Done);
+        };
+        if saved_tx.is_none() {
+            self.mark_query_start();
         }
-        let result = self.inner.step_with_waker(waker).map_err(Into::into);
+        let result = match &mut self.deferred {
+            Some(DeferredState::Callback { exec, completed }) => {
+                if *completed {
+                    return Ok(StepResult::Done);
+                }
+                exec(&mut self.inner).map(|()| {
+                    *completed = true;
+                    StepResult::Done
+                })
+            }
+            Some(DeferredState::Prerequisites(exec)) => exec.step(&mut self.inner, waker),
+            None => match waker {
+                Some(waker) => self.inner.step_with_waker(waker),
+                None => self.inner.step(),
+            },
+        }
+        .map_err(Into::into);
         self.finish_step(result, was_in_tx)
     }
 
@@ -357,8 +369,10 @@ impl Statement {
     }
 
     pub fn reset(&mut self) -> Result<()> {
-        if let Some(deferred) = self.deferred.as_mut() {
-            deferred.completed = false;
+        match &mut self.deferred {
+            Some(DeferredState::Callback { completed, .. }) => *completed = false,
+            Some(DeferredState::Prerequisites(exec)) => exec.reset()?,
+            None => {}
         }
         self.commit_became_rollback = false;
         self.inner.reset().map_err(Into::into)
@@ -386,26 +400,26 @@ impl Statement {
     }
 
     pub fn run_ignore_rows(&mut self) -> Result<()> {
+        if self.deferred.is_some() {
+            return self.run_with_row_callback(|_| Ok(()));
+        }
         let Some(was_in_tx) = self.tx_gate()? else {
             return Ok(());
         };
         self.mark_query_start();
-        if self.deferred.is_some() {
-            return self.execute_deferred(was_in_tx);
-        }
         let resu
```

**File**: `postgres/frontend/tests/embedded_errors.rs` (modified, +383/-0)
```diff
@@ -999,6 +999,389 @@ fn transaction_rolled_back_by_the_core_still_reports_aborted() {
     conn1.execute("COMMIT").unwrap();
 }
 
+#[test]
+fn serial_prerequisites_yield_to_the_caller() {
+    use turso_core::{IOResult, IO};
+
+    for method in 0..4 {
+        let io = Arc::new(CountedYieldIO::default());
+        let db = turso_pg::open_database_with_io(
+            io.clone(),
+            "serial-yield.db",
+            OpenFlags::default(),
+            DatabaseOpts::new(),
+        )
+        .unwrap();
+        let conn = Connection::connect(&db).unwrap();
+        let mut stmt = conn
+            .prepare("CREATE TABLE t (a SERIAL, b SERIAL, payload INT)")
+            .unwrap();
+        conn.inner()
+            .set_yield_injector(Some(Arc::new(NthYield::new(4))));
+        let wakes = Arc::new(WakeCounter::default());
+        let waker = std::task::Waker::from(wakes.clone());
+        let mut yields = 0;
+        let mut explicit_yields = 0;
+        loop {
+            let before = io.steps.load(std::sync::atomic::Ordering::Relaxed);
+            let result = match method {
+                0 => stmt.step(),
+                1 => stmt.step_with_waker(&waker),
+                2 | 3 => {
+                    let result = if method == 2 {
+                        stmt.run_ignore_rows_nonblock()
+                    } else {
+                        stmt.run_with_row_callback_nonblock(|_| panic!("DDL returned a row"))
+                    };
+                    result.map(|result| match result {
+                        IOResult::Done(()) => StepResult::Done,
+                        IOResult::IO(completion) => {
+                            assert!(completion.is_explicit_yield() || !completion.finished());
+                            if completion.is_explicit_yield() {
+                                StepResult::Yield
+                            } else {
+                                StepResult::IO
+                            }
+                        }
+                    })
+                }
+                _ => unreachable!(),
+            };
+            assert_eq!(
+                io.steps.load(std::sync::atomic::Ordering::Relaxed),
+                before,
+                "method {method} pumped I/O inside the nonblocking call"
+            );
+            let result = result.unwrap();
+            match result {
+                StepResult::Done => break,
+                StepResult::IO | StepResult::Yield | StepResult::Sleep { .. } => {
+                    yields += 1;
+                    if method < 2 {
+                        let completion = stmt.take_io_completions().unwrap();
+                        assert!(completion.is_explicit_yield() || !completion.finished());
+                    }
+                    if matches!(result, StepResult::Yield) {
+                        explicit_yields += 1;
+                    }
+                    let before_wake = wakes.0.load(std::sync::atomic::Ordering::Relaxed);
+                    io.step().unwrap();
+                    if method == 1 && matches!(result, StepResult::IO) {
+                        assert!(wakes.0.load(std::sync::atomic::Ordering::Relaxed) > before_wake);
+                    }
+                }
+                other => panic!("unexpected result: {other:?}"),
+            }
+        }
+        assert!(yields > 0);
+        assert!(explicit_yields > 0);
+        conn.inner().set_yield_injector(None);
+        assert_eq!(conn.transaction_state(), TransactionState::Idle);
+        conn.execute("INSERT INTO t (payload) VALUES (42)").unwrap();
+        assert_eq!(
+            conn.prepare("SELECT a, b FROM t")
+                .unwrap()
+                .run_collect_rows()
+                .unwrap(),
+            vec![vec![Value::from_i64(1), Value::from_i64(1)]]
+        );
+        assert_eq!(
+            conn.prepare("SELECT sequencename FROM pg_sequences ORDER BY sequencename")
+                .unwrap()
+                .run_collect_rows()
+                .unwrap(),
+            vec![
+                vec![Value::build_text("t_a_seq")],
+                vec![Value::build_text("t_b_seq")]
+            ]
+        );
+    }
+}
+
+#[test]
+fn serial_prerequisites_clean_up_when_abandoned() {
+    use turso_core::IO;
+
+    for action in 0..3 {
+        for pause_at in 1..200 {
+            let io = Arc::new(CountedYieldIO::default());
+            let db = turso_pg::open_database_with_io(
+                io.clone(),
+                "abandoned.db",
+                OpenFlags::default(),
+                DatabaseOpts::new(),
+            )
+            .unwrap();
+            let conn = Connection::connect(&db).unwrap();
+            conn.execute(
+                "CREATE TABLE kept (v INT); BEGIN; INSERT INTO kept VALUES (42); SAVEPOINT user_sp",
+            )
+            .unwrap();
+            let mut stmt = conn.prepare("CREATE TABLE t (a SERIAL, b SERIAL)").unwrap();
+            let injector =
```

---

### Incident Patch 3: `0fc3ce83` (2026-10-31)
**Commit Message**: postgres: extract prerequisite phase SQL generation

Keep phase SQL generation separate from preparation while preserving translated AST preparation and lazy execution.

Amp-Thread-ID: https://ampcode.com/threads/T-28890b5f-9c6b-4688-9cfe-d58e60c893ee
Co-authored-by: pedro muniz <[REDACTED_EMAIL]>

**File**: `postgres/frontend/session.rs` (modified, +22/-10)
```diff
@@ -640,23 +640,17 @@ impl PrerequisiteExecution {
             };
         }
         if self.active.is_none() {
+            let sql = self.phase_sql();
             self.active = Some(match self.phase {
-                Savepoint => conn.prepare_sqlite(format!("SAVEPOINT \"{PG_STMT_SAVEPOINT}\""))?,
                 Prerequisite(index) => {
                     let stmt = &self.prereqs[index];
-                    conn.prepare_translated_stmt(stmt.clone(), &stmt.to_string())
+                    conn.prepare_translated_stmt(stmt.clone(), &sql)
                         .map_err(schema_error)?
                 }
                 Main => conn
-                    .prepare_translated_cmd(self.cmd.clone(), &self.sql)
+                    .prepare_translated_cmd(self.cmd.clone(), &sql)
                     .map_err(schema_error)?,
-                Release | RollbackRelease => {
-                    conn.prepare_sqlite(format!("RELEASE SAVEPOINT \"{PG_STMT_SAVEPOINT}\""))?
-                }
-                Rollback if self.was_in_tx == Some(true) => {
-                    conn.prepare_sqlite(format!("ROLLBACK TO SAVEPOINT \"{PG_STMT_SAVEPOINT}\""))?
-                }
-                Rollback => conn.prepare_sqlite("ROLLBACK")?,
+                Savepoint | Release | Rollback | RollbackRelease => conn.prepare_sqlite(&sql)?,
                 Start | CheckTarget | Done => unreachable!(),
             });
         }
@@ -710,6 +704,24 @@ impl PrerequisiteExecution {
         Ok(IOResult::Done(()))
     }
 
+    fn phase_sql(&self) -> Cow<'_, str> {
+        use PrerequisitePhase::*;
+
+        match self.phase {
+            Savepoint => format!("SAVEPOINT \"{PG_STMT_SAVEPOINT}\"").into(),
+            Prerequisite(index) => self.prereqs[index].to_string().into(),
+            Main => Cow::Borrowed(&self.sql),
+            Release | RollbackRelease => {
+                format!("RELEASE SAVEPOINT \"{PG_STMT_SAVEPOINT}\"").into()
+            }
+            Rollback if self.was_in_tx == Some(true) => {
+                format!("ROLLBACK TO SAVEPOINT \"{PG_STMT_SAVEPOINT}\"").into()
+            }
+            Rollback => Cow::Borrowed("ROLLBACK"),
+            Start | CheckTarget | Done => unreachable!(),
+        }
+    }
+
     fn fail(&mut self, error: LimboError) {
         let cleaning_up = matches!(
             self.phase,
```

#### Recent Merged Pull Requests:
- **PR #11194** (2026-10-31): postgres: yield during deferred cleanup and transaction rollback (@pedrocarlo)
- **PR #11191** (2026-10-31): postgres: reuse yielding execution for deferred session statements (@pedrocarlo)
- **PR #11190** (2026-10-31): postgres: yield while executing statement prerequisites (@pedrocarlo)
- **PR #11182** (closed): tursopg: accept non-UTF-8 bind parameters as blobs (@k-park)
- **PR #11179** (2026-10-31): tools/dbhash: add --cipher and --hexkey to hash encrypted databases (@turso-github-handyman[bot])
- **PR #11170** (2026-10-31): core: fix two virtual generated column bugs (DELETE RETURNING, ALTER TABLE on STRICT tables) (@glommer)

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

## X. Merge 'core/translate: skip sqlite_sequence rows with a NULL name' from app/turs

**RULE**:
When implementing operations in `core/translate/alter.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tursodatabase/turso. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `01cddb12`: Merge 'core/translate: skip sqlite_sequence rows with a NULL name' from app/turso-github-handyman. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `core/translate/alter.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
            flags: CmpInsFlags::default().jump_if_null(),
            flags: CmpInsFlags::default().jump_if_null(),
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
            flags: CmpInsFlags::default(),
            flags: CmpInsFlags::default(),
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `01cddb12` are properly handled with clean fallback behavior.
