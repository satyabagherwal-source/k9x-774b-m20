# Forensic Learning Record (Deep Inspection): tursodatabase/turso

> **Canonical Artifact**: `07_PROJECT_LEARNING/tursodatabase-turso-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tursodatabase/turso](https://github.com/tursodatabase/turso))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:36:41.002Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tursodatabase/turso`
- **Description**: A SQL database in Rust: SQLite-compatible, now also speaking Postgres (experimental). The LLVM of databases.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md
- **Stars / Engagement**: 24628 stars

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

### Core Architecture Module: `cli/read_state_machine.rs`
```
use std::ops::ControlFlow;

use itertools::Itertools;

/// State machine for determining if a SQL statement is complete.
/// Based on SQLite's `sqlite3_complete()` from src/complete.c
///
/// This handles the tricky case of triggers which contain semicolons
/// in their body but should only be considered complete when the
/// `;END;` pattern is seen.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ReadState {
    /// No non-whitespace seen yet (initial state)
    #[default]
    Invalid,
    /// A complete statement was just finished (terminal state)
    Start,
    /// In the middle of an ordinary statement
    Normal,
    /// Saw EXPLAIN at the start, watching for CREATE
    Explain,
    /// Saw CREATE (possibly after EXPLAIN), watching for TRIGGER
    Create,
    /// Inside a trigger definition, need ;END; to escape
    Trigger,
    /// Just saw a semicolon inside a trigger, looking for END
    Semi,
    /// Saw ;END in trigger, one more semicolon completes it
    End,
}

/// Token types recognized by the state machine
#[expect(clippy::enum_variant_names)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Token {
    TkSemi,
    TkWhitespace,
    TkOther,
    TkExplain,
    TkCreate,
    TkTemp,
    TkTrigger,
    TkEnd,
}

struct Tokenizer<'a> {
    chars: std::iter::Peekable<std::str::Chars<'a>>,
}

impl<'a> Tokenizer<'a> {
    fn new(chars: std::iter::Peekable<std::str::Chars<'a>>) -> Self {
        Self { chars }
    }

    /// Read an identifier/keyword and classify it
    fn read_keyword(&mut self, first: char) -> Token {
        let word: String = std::iter::once(first)
            .chain(
                self.chars
                    .peeking_take_while(|c| c.is_ascii_alphanumeric() || *c == '_'),
            )
            .collect();

        match word.to_ascii_uppercase().as_str() {
            "EXPLAIN" => Token::TkExplain,
            "CREATE" => Token::TkCreate,
            "TEMP" | "TEMPORARY" => Token::TkTemp,
            "TRIGGER" => Token::TkTrigger,
            "END" => Token::TkEnd,
            _ => Token::TkOther,
        }
    }
}

impl<'a> Iterator for Tokenizer<'a> {
    type Item = Token;

    fn next(&mut self) -> Option<Token> {
        loop {
            let c = self.chars.next()?;

            let token = match c {
                '\'' | '"' | '`' | '[' => {
                    let end_char = if c == '[' { ']' } else { c };
                    // Consumes all tokens between the delimeters
                    self.chars
                        .by_ref()
                        .take_while_inclusive(|&ch| ch != end_char)
                        .for_each(drop);
                    continue;
                }
                // Handle Comments
                '-' if self.chars.peek() == Some(&'-') => {
                    self.chars.next(); // Consume second `-`
                                       // Consume until you find a new line
                    self.chars.by_ref().find(|&ch| ch == '\n');
                    continue;
                }
                '/' if self.chars.peek() == Some(&'*') => {
                    // Consumes until you find a `*/`
                    let _ = self.chars.by_ref().try_fold(false, |saw_star, c| {
                        if saw_star && c == '/' {
                            ControlFlow::Break(())
                        } else {
                            ControlFlow::Continue(c == '*')
                        }
                    });
                    continue;
                }
                ';' => Token::TkSemi,
                c if c.is_ascii_whitespace() => Token::TkWhitespace,
                c if c.is_ascii_alphabetic() || c == '_' => self.read_keyword(c),
                _ => Token::TkOther,
            };

            break Some(token);
        }
    }
}

impl ReadState {
    /// Returns true if the state machine is in a "complete" state,
    /// meaning the accumulated SQL forms a complete statement.
    pub fn is_complete(&self) -> bool {
        matches!(self, ReadState::Start)
    }

    // Copied form SQLite
    /// Process a single character and return the new state.
    /// This should be called for each character in the input.
    fn transition(&self, token: Token) -> ReadState {
        use ReadState::*;
        use Token::*;

        match (self, token) {
            // State 0: INVALID - nothing meaningful seen yet
            (Invalid, TkSemi) => Start,
            (Invalid, TkWhitespace) => Invalid,
            (Invalid, TkOther) => Normal,
            (Invalid, TkExplain) => Explain,
            (Invalid, TkCreate) => Create,
            (Invalid, TkTemp) => Normal,
            (Invalid, TkTrigger) => Normal,
            (Invalid, TkEnd) => Normal,

            // State 1: START - complete statement, ready for new one
            (Start, TkSemi) => Start,
            (Start, TkWhitespace) => Start,
            (Start, TkOther) => Normal,
            (Start, TkExplain) => Explain,
            (Start, TkCreate) => Create,
            (Start, TkTemp) => Normal,
            (Start, TkTrigger) => Normal,
            (Start, TkEnd) => Normal,

            // State 2: NORMAL - in middle of ordinary statement
            (Normal, TkSemi) => Start,
            (Normal, TkWhitespace) => Normal,
            (Normal, _) => Normal,

            // State 3: EXPLAIN - saw EXPLAIN, watching for CREATE
            (Explain, TkSemi) => Start,
            (Explain, TkWhitespace) => Explain,
            (Explain, TkOther) => Explain,
            (Explain, TkExplain) => Normal,
            (Explain, TkCreate) => Create,
            (Explain, TkTemp) => Normal,
            (Explain, TkTrigger) => Normal,
            (Explain, TkEnd) => Normal,

            // State 4: CREATE - saw CREATE, watching for TRIGGER
            (Create, TkSemi) => Start,
            (Create, TkWhitespace) => Create,
            (Create, TkOther) => Normal,
            (Create, TkExplain) => Normal,
            (Create, TkCreate) => Normal,
            (Create, TkTemp) => Create,     // CREATE TEMP still watching
            (Create, TkTrigger) => Trigger, // Enter trigger mode!
            (Create, TkEnd) => Normal,

            // State 5: TRIGGER - inside trigger body, need ;END; to escape
            (Trigger, TkSemi) => Semi,
            (Trigger, TkWhitespace) => Trigger,
            (Trigger, _) => Trigger,

            // State 6: SEMI - saw ; in trigger, looking for END
            (Semi, TkSemi) => Semi,
            (Semi, TkWhitespace) => Semi,
            (Semi, TkEnd) => End,
            (Semi, _) => Trigger, // false alarm, back to body

            // State 7: END - saw ;END, one more ; completes
            (End, TkSemi) => Start, // ;END; - COMPLETE!
            (End, TkWhitespace) => End,
            (End, _) => Trigger, // false alarm
        }
    }

    /// Process a SQL string and update the state.
    /// Returns the new state after processing all input.
    pub fn process(&mut self, sql: &str) {
        let chars = sql.chars().peekable();

        *self = Tokenizer::new(chars).fold(*self, |state, token| state.transition(token));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn is_complete(sql: &str) -> bool {
        let mut state = ReadState::default();
        state.process(sql);
        state.is_complete()
    }

    #[test]
    fn test_simple_statements() {
        assert!(is_complete("SELECT 1;"));
        assert!(is_complete("SELECT * FROM foo;"));
        assert!(is_complete("INSERT INTO foo VALUES (1, 2, 3);"));
        assert!(!is_complete("SELECT 1"));
        assert!(!is_complete("SELECT * FROM"));
    }

    #[test]
    fn test_multiple_statements() {
        assert!(is_complete("SELECT 1; SELECT 2;"));
        assert!(!is_complete("SELECT 1; SELECT 2"));
    }

    #[test]
    fn test_string_with_semicolon() {
        assert!(!is_complete("SELECT ';'"));
        assert!(is_complete("SELECT ';';"));
        assert!(!is_complete("SELECT 'test;test'"));
        assert!(is_complete("SELECT 'test;test';"));
    }

    #[test]
    fn test_comments() {
        assert!(is_complete("SELECT 1; -- comment"));
        assert!(!is_complete("SELECT 1 -- comment;"));
        assert!(is_complete("SELECT /* ; */ 1;"));
        assert!(!is_complete("SELECT 1 /* ; */"));
    }

    #[test]
    fn test_simple_trigger() {
        let trigger = r#"
            CREATE TRIGGER log_insert AFTER INSERT ON users BEGIN
                INSERT INTO log VALUES('inserted');
            END;
        "#;
        assert!(is_complete(trigger));
    }

    #[test]
    fn test_trigger_incomplete() {
        let trigger = r#"
            CREATE TRIGGER log_insert AFTER INSERT ON users BEGIN
                INSERT INTO log VALUES('inserted');
        "#;
        assert!(!is_complete(trigger));
    }

    #[test]
    fn test_trigger_multiple_statements() {
        let trigger = r#"
            CREATE TRIGGER log_insert AFTER INSERT ON users BEGIN
                INSERT INTO log VALUES('inserted');
                UPDATE stats SET count = count + 1;
            END;
        "#;
        assert!(is_complete(trigger));
    }

    #[test]
    fn test_create_temp_trigger() {
        let trigger = r#"
            CREATE TEMP TRIGGER log_insert AFTER INSERT ON users BEGIN
                INSERT INTO log VALUES('inserted');
            END;
        "#;
        assert!(is_complete(trigger));
    }

    #[test]
    fn test_create_temporary_trigger() {
        let trigger = r#"
            CREATE TEMPORARY TRIGGER log_insert AFTER INSERT ON users BEGIN
                INSERT INTO log VALUES('inserted');
            END;
        "#;
        assert!(is_complete(trigger));
    }

    #[test]
    fn test_explain_create_trigger() {
        let trigger = r#"
            EXPLAIN CREATE TRIGGER log_insert AFTER INSERT ON users BEGIN
                INSERT INTO log VALUES('inserted');
            END;
        "#;
        assert!(is_complete(trigger));
    }


```

### Core Architecture Module: `core/alloc/allocation_site.rs`
```
use std::cell::Cell;

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum AllocationSite {
    BTree(BTreeAllocationSite),
    MvStore(MvStoreAllocationSite),
    MvccCheckpoint(MvccCheckpointAllocationSite),
    Schema(SchemaAllocationSite),
    ValueBlob(ValueBlobAllocationSite),
    Vector(VectorAllocationSite),
    NoFaultInjection,
    Fts(FtsAllocationSite),
}

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum FtsAllocationSite {
    CaptureBuffer,
    AtomicMetadata,
    AssembleBuffer,
    SnapshotMetadata,
    SnapshotTombstone,
}

impl From<FtsAllocationSite> for AllocationSite {
    fn from(site: FtsAllocationSite) -> Self {
        Self::Fts(site)
    }
}

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum BTreeAllocationSite {
    CellPayload,
    OverflowRead,
    Balance,
    BlobRecordHeader,
    IntegrityCheck,
    OverflowCell,
    RecordPayload,
    SavedCursorRecord,
}

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum ValueBlobAllocationSite {
    Concat,
    FromSlice,
    JsonbConstruction,
    JsonbCopy,
    Hash128,
    RecordDecode,
    CloneFrom,
    RecordBuild,
    RecordCopy,
    AggAccumulate,
}

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum MvStoreAllocationSite {
    RootpageMappingInsert,
    TxInsert,
    FinalizedTxStateInsert,
    TableRowsEntry,
    IndexRowsEntry,
    IndexKeyEntry,
    RowVersionReserve,
    RowPayload,
    SchemaRowPayload,
}

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum SchemaAllocationSite {
    MakeMut,
    FlatViewColumns,
}

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum MvccCheckpointAllocationSite {
    CheckpointWriteSet,
    CheckpointIndexWriteSet,
    CheckpointMetadataPayload,
    CheckpointSequenceCompactions,
}

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum VectorAllocationSite {
    Parse,
    Convert,
    Concat,
    Slice,
    Serialize,
    SparseConstruction,
    Float8Construction,
    IndexPayloadCopy,
}

impl From<MvStoreAllocationSite> for AllocationSite {
    fn from(site: MvStoreAllocationSite) -> Self {
        Self::MvStore(site)
    }
}

impl From<BTreeAllocationSite> for AllocationSite {
    fn from(site: BTreeAllocationSite) -> Self {
        Self::BTree(site)
    }
}

impl From<MvccCheckpointAllocationSite> for AllocationSite {
    fn from(site: MvccCheckpointAllocationSite) -> Self {
        Self::MvccCheckpoint(site)
    }
}

impl From<SchemaAllocationSite> for AllocationSite {
    fn from(site: SchemaAllocationSite) -> Self {
        Self::Schema(site)
    }
}

impl From<VectorAllocationSite> for AllocationSite {
    fn from(site: VectorAllocationSite) -> Self {
        Self::Vector(site)
    }
}

impl From<ValueBlobAllocationSite> for AllocationSite {
    fn from(site: ValueBlobAllocationSite) -> Self {
        Self::ValueBlob(site)
    }
}

thread_local! {
    static CURRENT_ALLOCATION_SITE: Cell<Option<AllocationSite>> = const { Cell::new(None) };
}

pub struct AllocationSiteGuard {
    previous: Option<AllocationSite>,
}

impl Drop for AllocationSiteGuard {
    fn drop(&mut self) {
        CURRENT_ALLOCATION_SITE.with(|slot| slot.set(self.previous));
    }
}

pub fn enter_allocation_site(site: impl Into<AllocationSite>) -> AllocationSiteGuard {
    let site = site.into();
    let previous = CURRENT_ALLOCATION_SITE.with(|slot| {
        let previous = slot.get();
        let site = if matches!(previous, Some(AllocationSite::NoFaultInjection)) {
            AllocationSite::NoFaultInjection
        } else {
            site
        };
        slot.set(Some(site));
        previous
    });
    AllocationSiteGuard { previous }
}

pub fn current_allocation_site() -> Option<AllocationSite> {
    CURRENT_ALLOCATION_SITE.with(Cell::get)
}

#[macro_export]
macro_rules! without_allocation_faults {
    ($expr:expr) => {{
        #[cfg(feature = "allocation_metric")]
        let _turso_allocation_site_guard =
            $crate::alloc::enter_allocation_site($crate::alloc::AllocationSite::NoFaultInjection);
        $expr
    }};
}

#[macro_export]
macro_rules! with_mv_store_allocation_site {
    ($site:ident, $expr:expr) => {{
        #[cfg(feature = "allocation_metric")]
        let _turso_allocation_site_guard =
            $crate::alloc::enter_allocation_site($crate::alloc::MvStoreAllocationSite::$site);
        $expr
    }};
}

#[macro_export]
macro_rules! with_btree_allocation_site {
    ($site:ident, $expr:expr) => {{
        #[cfg(feature = "allocation_metric")]
        let _turso_allocation_site_guard =
            $crate::alloc::enter_allocation_site($crate::alloc::BTreeAllocationSite::$site);
        $expr
    }};
}

#[macro_export]
macro_rules! with_value_blob_allocation_site {
    ($site:ident, $expr:expr) => {{
        #[cfg(feature = "allocation_metric")]
        let _turso_allocation_site_guard =
            $crate::alloc::enter_allocation_site($crate::alloc::ValueBlobAllocationSite::$site);
        $expr
    }};
}

#[cfg(test)]
mod tests {
    use super::{
        current_allocation_site, enter_allocation_site, AllocationSite, MvStoreAllocationSite,
    };

    #[test]
    fn allocation_site_guard_restores_previous_site() {
        assert_eq!(current_allocation_site(), None);
        {
            let _outer = enter_allocation_site(MvStoreAllocationSite::RootpageMappingInsert);
            assert_eq!(
                current_allocation_site(),
                Some(AllocationSite::MvStore(
                    MvStoreAllocationSite::RootpageMappingInsert
                ))
            );

            {
                let _inner = enter_allocation_site(AllocationSite::NoFaultInjection);
                assert_eq!(
                    current_allocation_site(),
                    Some(AllocationSite::NoFaultInjection)
                );
            }

            assert_eq!(
                current_allocation_site(),
                Some(AllocationSite::MvStore(
                    MvStoreAllocationSite::RootpageMappingInsert
                ))
            );
        }
        assert_eq!(current_allocation_site(), None);
    }

    #[test]
    fn no_fault_injection_site_dominates_nested_sites() {
        let _outer = enter_allocation_site(AllocationSite::NoFaultInjection);
        assert_eq!(
            current_allocation_site(),
            Some(AllocationSite::NoFaultInjection)
        );
        {
            let _inner = enter_allocation_site(MvStoreAllocationSite::RowVersionReserve);
            assert_eq!(
                current_allocation_site(),
                Some(AllocationSite::NoFaultInjection)
            );
        }
        assert_eq!(
            current_allocation_site(),
            Some(AllocationSite::NoFaultInjection)
        );
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #9514** (2026-10-05): **core: Shrink expression parsing and translation stack usage**
  *Symptoms*: Fixes #9499.  ## Problem  Expression codegen and parsing recurse once per nesting level. Fine in SQLite (~400 B/level), not in turso: `translate_expr()` alone had an 8 KiB frame. ORM-style upsert from the issue (14 columns, 28 ORs in `DO UPDATE ... WHERE`) needed 307 KiB of stack just to prepare. SQLite: 35 KiB.  ## Fix  Same as SQLite (`SQLITE_NOINLINE`): keep functions on the recursive path small, move rare/large paths out of line. No change to recursion structure.  - **`translate_expr()` → dispatcher.** One `#[inline(never)]` fn per expression kind. 8016 B → 224 B. - **Condition path.** `translate_condition_expr()` only does AND/OR/parens; everything else → `translate_leaf_condition_expr()`. 1504 B → 272 B. - **Binary path.** IS TRUE, custom type operators, row-valued comparisons → own fns. Per-level cost of `a + b + ...`: ~8.7 KiB → 672 B. - **`bail_parse_error!` out of line.** Was `format!` inline at 600+ sites, every fallible fn paid for it. Now `format_args!` → one `#[cold]` fn (like `sqlite3ErrorMsg`). E.g. function-call translation 6160 B → 656 B, `expr_vector_size()` 1360 B → 240 B. - **Parser.** Not fine for nested shapes (`NOT NOT ...`, `(((x)))`, `abs(abs(...))`): `parse_expr_inner`/`parse_expr_operand` 1440 B each. Cold error construction for `peek_expect!`, one arm for all plain binary operators, rare operators/operands → own fns. Now 544 B / 624 B. - **`Expr` 240 B → 128 B.** `Exists`/`InSelect`/`Subquery` stored a whole `Select` inline, `FunctionCall` its `OV
  **Post-Mortem & Fix Analysis**:
  > <!-- __CODSPEED_PERFORMANCE_REPORT_COMMENT__ --> ## Merging this PR will **improve performance by 30.61%**  <details> <summary>:warning: <b>1 benchmark measured no execution time</b></summary>  > Nothing ran under measurement, usually because the compiler removed the code under test. This result is not comparable, so it counts as unchanged. > > [Preventing compiler optimizations](https://codspeed.io/docs/troubleshooting?utm_source=github&utm_medium=comment-v2&utm_content=optimized_out_docs#optimized-out-benchmarks)  </details> <details> <summary>:warning: <b>Different runtime environments detected</b></summary>  > Some benchmarks with significant performance changes were compared across different runtime environments, > which may affect the accuracy of the results. > > [Open the report in CodSpeed to investigate](https://app.codspeed.io/tursodatabase/turso/branches/fix-translation-stack-usage?utm_source=github&utm_medium=comment-v2&utm_content=comparison_issues)  </details>  `⚡ 2` impr

- **Issue #9499** (2026-10-05): **core/prepare: translate_expr() uses a shitload of stack compared to sqlite's expression translation functions**
  *Symptoms*: ## Summary  Compiling an expression with, for example, a long `OR` chain recurses once per `OR`, in tursodb and in SQLite alike.  In tursodb each level costs ~4.4 KiB of stack; in SQLite ~0.4 KiB.  A generated 14-column upsert (28 `OR` terms) needs ~118 KiB for this recursion alone in tursodb, so it overflows on threads with small stacks.  SQLite runs the same statement with a 48 KiB stack.  ## Repro  ORMs generate this "upsert only if something changed" pattern: for every column, `typeof(x) IS NOT typeof(excluded.x) OR x IS NOT excluded.x`.  ```sql CREATE TABLE "treasure" (     "map_id" TEXT PRIMARY KEY, "rival_ship_uid" TEXT, "our_ship_uid" TEXT,     "parrot_name" TEXT, "loot" BLOB, "is_plundered" INTEGER, "curse_level" INTEGER,     "shipwreck_code" INTEGER, "stolen_from_map_id" TEXT, "sunk_at" INTEGER,     "buried_at" INTEGER, "found_at" INTEGER, "dig_attempt_id" TEXT, "dig_started_at" INTEGER );  INSERT INTO "treasure" ("map_id", "rival_ship_uid", "our_ship_uid", "parrot_name", "loot",     "is_plundered", "curse_level", "shipwreck_code", "stolen_from_map_id", "sunk_at",     "buried_at", "found_at", "dig_attempt_id", "dig_started_at") VALUES ('map-0001', 'ship-blackbeard', 'ship-pearl', 'Polly', X'DEADBEEF', 0, 3, 42,     NULL, NULL, 1791151580, 1791151600, 'dig-7f3a', 1791151610) ON CONFLICT ("map_id") DO UPDATE SET     "map_id" = excluded."map_id", "rival_ship_uid" = excluded."rival_ship_uid",     "our_ship_uid" = excluded."our_ship_uid", "parrot_name" = excluded."parrot

- **Issue #9496** (2026-10-05): **postgres/sqltest: connect each test to the tursopg server it started**
  *Symptoms*: The pg backend picked a free port, released it, and passed it to the `tursopg` server it spawned. Two tests running at the same time could get the same port. The second server then failed to bind, and its test connected to the first test's server and ran against that test's database and session, without any error.  This change starts `tursopg` on port 0 and reads the port it actually listens on from the line it prints at startup. `tursopg` now prints the bound address instead of the requested one.  Found while adding `SET ROLE` tests: a test that ran on another test's server picked up that test's `SET ROLE` and failed with `permission denied`. With logging added to the runner, eight parallel runs of one test file showed tests connecting to the wrong server in every round of three. After this change, 64 parallel runs had no failures.
  **Post-Mortem & Fix Analysis**:
  > @claude review
  > **Claude finished @penberg's task in 1m 4s** —— [View job](https://github.com/tursodatabase/turso/actions/runs/37306752769)  --- ### Code Review  - [x] Read changed files - [x] Review `postgres/server/lib.rs` changes - [x] Review `testing/sqltest/src/backends/pg.rs` changes - [x] Provide feedback  ---  **Summary**: This PR fixes a TOCTOU (time-of-check time-of-use) race condition in the PostgreSQL sqltest runner. The fix is well-implemented and solves a real parallelism bug.  ### Review  **The Problem (well-explained in the PR description)**:   The old code used `TcpListener::bind("127.0.0.1:0")` to allocate an ephemeral port, then *released* the binding before spawning the server with that port. Two parallel tests could get the same port in the gap between release and spawn.  **The Fix**: 1. Pass `127.0.0.1:0` directly to the server, letting the OS assign the port at bind time 2. Read the actual bound port from the server's stdout message 3. Server now prints `listener.local_addr()` i

- **Issue #9494** (2026-10-05): **bindings/tcl: register the csv module for the upstream csv01 test**
  *Symptoms*: ## Description  `csv01.test` starts with `load_static_extension db csv`, but the TCL binding only handles `randomjson`, so every `CREATE VIRTUAL TABLE ... USING csv` fails and all 467 tests in the file fail.  This adds a `csv` feature to `turso_sqlite3` that links `limbo_csv` in statically (using its existing `static` feature, the same way the CLI does for `limbo_completion`) and registers it on each new connection. `bindings/tcl/Makefile` now builds with that feature. I also added a probe to `bindings/tcl/test_probes.tcl` and updated the README line that said `load_static_extension` does nothing.  With this, 453 of 467 tests in `csv01.test` pass. The 14 that still fail are the `csv_wr`/`testflags` tests and the extension gaps listed in the issue (bare `header`, column names `c1..` vs `c0..`, error message), so `csv01` stays on the known-bad list and this PR only covers part of #9422.  ## Motivation and context  Part of #9422. The issue prefers adding `sqlite3_load_extension` to `bindings/c` and loading `liblimbo_csv` at run time. I tried that first and it aborts with `pointer being freed was not allocated`: loadable extensions install their own mimalloc global allocator and `turso_sqlite3` uses the system one. So I went with the static-link alternative from the issue instead.  Tested with `make -C bindings/tcl build`, `tclsh bindings/tcl/test_probes.tcl` (65 passed; I loaded the `.dylib` since the script looks for `.so`) and `tclsh csv01.test` on macOS. I did not run the `do

- **Issue #9482** (2026-10-04): **core/mvcc: close the internal transaction left open by journal_mode bootstrap**
  *Symptoms*: ## Summary  `PRAGMA journal_mode = mvcc` runs MVCC bootstrap on the live user connection. The `sqlite_sequence` watermark sync opens an internal read transaction (`SELECT name, seq FROM sqlite_sequence`) that bootstrap never closed. The tx stayed `Active` holding `holds_blocking_checkpoint_read`, so `PRAGMA wal_checkpoint(TRUNCATE)` on the same connection returned `database is locked` (`Busy` from `checkpoint_lock.write()` in `CheckpointState::AcquireLock`).  Fix: the watermark sync funnels all exits through a new `SyncAutoincrementState::FinishTx`. If the leftover conn tx has writes (watermark upserts), it commits it via `MvStore::commit_tx` driven non-blockingly from `return_if_io!`; otherwise `clear_internal_main_mvcc_tx` rolls it back. Commit (not rollback) is required — rolling back loses the recovered watermark and `AUTOINCREMENT` reuses ids. `AwaitingGlobalHeader` also clears residual conn tx before bootstrap returns `Done`, and `MvccBootstrapGuard::drop` clears it on the abandoned-bootstrap path.  #### Test plan  - [x] repro: `journal_mode=mvcc` → `wal_checkpoint(TRUNCATE)` returns `busy=0`, log file is 0 bytes - [x] populated `sqlite_sequence`: watermark committed, next AUTOINCREMENT id continues from recovered seq - [x] `cargo test -p turso_core mvcc` 524 pass; `core_tester mvcc::` 48 pass - [x] `cargo check`/`fmt`/`clippy -p turso_core --lib` clean  Fixes #9474  Generated with [Devin](https://devin.ai)

- **Issue #9481** (2026-10-04): **core/vdbe: check argument counts in array scalar functions**
  *Symptoms*: ## Summary  `ScalarFunc::ArrayToString` read `state.registers[*start_reg + 1]` unconditionally — unlike every sibling arm it had no `check_arg_count!` guard. With one argument the register block ends at `start_reg`, so the read ran off the end of the register file and panicked (`index out of bounds`). `StringToArray` and `ArrayLength` had the same missing check, and `array_element`/`array_set_element` indexed `args[N]` unchecked at translate time.  Three layers, matching existing conventions:  - `validate_custom_type_function_call` now validates arity for all gated array functions at bind time, producing `Parse error: wrong number of arguments to function X()` — same pattern as the struct/union checks already there - `check_arg_count!` gained a `(actual, min, max)` range arm backed by a cold `wrong_arg_count_range`; applied to `ArrayLength` (1–2) and `StringToArray`/`ArrayToString` (2–3) - `expect_arguments_exact!` guards `ArrayElement`/`ArraySetElement` before `translate_fixed_insn!` indexes `args`, matching the `UnionValueFunc` precedent  `select array_to_string(a) from foo` now returns a parse error (PostgreSQL also requires the delimiter — there is no default). Valid calls are unchanged.  #### Test plan  - [x] reported repro produces `Parse error` instead of a panic - [x] `array-arity-bugs.sqltest`: 8 new `expect error` cases covering the repro plus sibling arity gaps — 26/26 pass - [x] `array.sqltest` 213/213, `array-edge-cases.sqltest` 211/211, `struct_union.sqltest` 10

- **Issue #9480** (2026-10-04): **core/vdbe: make array text form round-trip through dump and vacuum**
  *Symptoms*: ## Summary  `serialize_array_from_blob` emits the `{...}` text form that `.dump` writes into INSERT literals and that VACUUM's row copy re-parses. The form wasn't self-describing, so the re-parse lost types and data:  - text `'007'`/`'1e3'` written unquoted → re-parsed as `7`/`1000.0` - control chars written as `\uXXXX` the parser didn't understand → literal text `u0001` - blob elements written as quoted `"X'..'"` → re-parsed as TEXT → STRICT `BLOB[]` rejected the row (dump reload dropped rows, `vacuum` aborted with `cannot store TEXT value in BLOB (19)`)  Changes in `core/vdbe/array.rs`:  - blob elements emit unquoted `X'<hex>'` — the same literal `.dump` uses for plain blob columns; unambiguous for the untyped parser - text elements are quoted when they'd parse back as a number or a blob literal - the parser learns the `\uXXXX` escape the writer already emitted, and reads unquoted `X'..'` tokens as `BLOB` via a new `blob_literal` helper  #### Test plan  - [x] `.dump` output `{"007","1e3","a\u0001b"}` / `{X''DEADBEEF''}` reloads to identical values and types - [x] `vacuum` succeeds on a `BLOB[]` table; elements stay `blob` - [x] `array-bugs.sqltest`: 6 new round-trip tests (24/24); `array.sqltest` expectation updated; `tests/integration/custom_types.rs` vacuum + round-trip tests; `vdbe::array` unit tests 27/27  Fixes #9452 Fixes #9451  Generated with [Devin](https://devin.ai)

- **Issue #9479** (2026-10-04): **core/translate: check main schema for dependent views in whole-table DELETE**
  *Symptoms*: ## Summary  - `DELETE FROM t` on a `TEMP` table that shadows `main.t` took the `ClearBtree` fast path because the dependent-view guard only looked in the target table's own schema - Materialized view dependencies are registered in the main schema by bare name (and `op_delete`/`op_insert` consult the main schema at run time), so the fast path left the view stale - The guard now also checks the main schema, so the fast path falls back to the row loop whenever any schema tracks the name  #### Test plan  - [x] `materialized_views.sqltest` — new `matview-delete-all-rows-temp-table-shadow` repro; 112/112 pass on cli and rust backends - [x] `delete.sqltest`, `delete-correlated-subquery`, `temp_tables`, `temp-view`, `temp_trigger`, `temp_tables_mvcc` — all pass - [x] `EXPLAIN DELETE FROM t` now emits the row loop instead of `ClearBtree iDb=1`; view is empty after the delete  Fixes #9456  Generated with [Devin](https://devin.ai)

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

### Incident Patch 1: `856c7949` (2026-10-02)
**Commit Message**: Merge 'core/translate: fix schema-qualified auto_vacuum pragma applying to main' from Sergei Iarymov

Fixes #9440

`PRAGMA aux.auto_vacuum=full` and `PRAGMA temp.auto_vacuum=full` changed
the auto-vacuum mode of the main database and left the named database
untouched, and `PRAGMA aux.auto_vacuum` reported the mode of main. Both
the read and the write path used the main database pager regardless of
which schema the pragma named.

The fix looks up the pager of the named database in both paths.

The tests are Rust integration tests that turn auto-vacuum on through
`DatabaseOpts`, so this PR adds no new experimental flag to the SQL test
runners or the drivers.

Closes #9455

**File**: `core/translate/pragma.rs` (modified, +3/-0)
```diff
@@ -557,6 +557,8 @@ fn update_pragma(
                 ));
             }
 
+            let pager = connection.get_pager_from_database_index(&database_id)?;
+
             // Like SQLite, the auto-vacuum mode is fixed once page 1 exists,
             // so the pragma is silently ignored after that.
             if pager.db_initialized() {
@@ -1475,6 +1477,7 @@ fn query_pragma(
             Ok(TransactionMode::None)
         }
         PragmaName::AutoVacuum => {
+            let pager = connection.get_pager_from_database_index(&database_id)?;
             let auto_vacuum_mode = pager.get_auto_vacuum_mode();
             let auto_vacuum_mode_i64: i64 = match auto_vacuum_mode {
                 AutoVacuumMode::None => 0,
```

**File**: `tests/integration/query_processing/test_vacuum.rs` (modified, +30/-0)
```diff
@@ -430,6 +430,36 @@ fn test_auto_vacuum_pragma_ignored_once_page_one_exists() -> anyhow::Result<()>
     Ok(())
 }
 
+#[test]
+fn test_auto_vacuum_pragma_on_attached_database_leaves_main_unchanged() -> anyhow::Result<()> {
+    let opts = DatabaseOpts::new().with_autovacuum(true).with_attach(true);
+    let tmp_db = TempDatabase::builder().with_opts(opts).build();
+    let conn = tmp_db.connect_limbo();
+
+    conn.execute("ATTACH ':memory:' AS aux")?;
+    conn.execute("PRAGMA aux.auto_vacuum = full")?;
+    conn.execute("CREATE TABLE aux.a(x)")?;
+    conn.execute("CREATE TABLE main.m(x)")?;
+
+    assert_eq!(scalar_i64(&conn, "PRAGMA aux.auto_vacuum"), 1);
+    assert_eq!(scalar_i64(&conn, "PRAGMA main.auto_vacuum"), 0);
+    Ok(())
+}
+
+#[test]
+fn test_auto_vacuum_pragma_on_temp_database_leaves_main_unchanged() -> anyhow::Result<()> {
+    let opts = DatabaseOpts::new().with_autovacuum(true);
+    let tmp_db = TempDatabase::builder().with_opts(opts).build();
+    let conn = tmp_db.connect_limbo();
+
+    conn.execute("PRAGMA temp.auto_vacuum = full")?;
+    conn.execute("CREATE TEMP TABLE t(x)")?;
+
+    assert_eq!(scalar_i64(&conn, "PRAGMA temp.auto_vacuum"), 1);
+    assert_eq!(scalar_i64(&conn, "PRAGMA main.auto_vacuum"), 0);
+    Ok(())
+}
+
 fn assert_plain_vacuum_preserves_autovacuum_mode(
     pragma_value: &str,
     expected_mode: i64,
```

---

### Incident Patch 2: `2bb22837` (2026-10-02)
**Commit Message**: core/translate: fix schema-qualified auto_vacuum pragma applying to main

`PRAGMA aux.auto_vacuum=full` and `PRAGMA temp.auto_vacuum=full` changed
the auto-vacuum mode of the main database and left the named database
untouched, and `PRAGMA aux.auto_vacuum` reported the mode of main. Both
the read and the write path used the main database pager regardless of
which schema the pragma named.

Auto-vacuum changes the page layout of the file, because page 2 becomes
a pointer-map page, so the write changed the storage format of a
database the statement never referred to.

Look up the pager of the named database in both paths, like the other
schema-qualified pragmas do.

Fixes #9440

**File**: `core/translate/pragma.rs` (modified, +3/-0)
```diff
@@ -557,6 +557,8 @@ fn update_pragma(
                 ));
             }
 
+            let pager = connection.get_pager_from_database_index(&database_id)?;
+
             // Like SQLite, the auto-vacuum mode is fixed once page 1 exists,
             // so the pragma is silently ignored after that.
             if pager.db_initialized() {
@@ -1475,6 +1477,7 @@ fn query_pragma(
             Ok(TransactionMode::None)
         }
         PragmaName::AutoVacuum => {
+            let pager = connection.get_pager_from_database_index(&database_id)?;
             let auto_vacuum_mode = pager.get_auto_vacuum_mode();
             let auto_vacuum_mode_i64: i64 = match auto_vacuum_mode {
                 AutoVacuumMode::None => 0,
```

---

### Incident Patch 3: `4f196141` (2026-10-01)
**Commit Message**: Merge 'core/fts: require index queries for match and score, not highlight' from Pedro Muniz

## What changes
`fts_match` and `fts_score` need a query that uses an FTS index. They no
longer search or score plain text without an index. `fts_highlight` uses
its text and query arguments directly, so it also works without an FTS
search or even an index.
An index can cover more columns than a query uses. If a query names only
`body`, an index on `(title, body)` searches `body` for an unqualified
term. A score must use the same columns and search term as the index
query.
## Examples
Start with this table and index:
```sql
CREATE TABLE docs(id INTEGER PRIMARY KEY, title TEXT, body TEXT);
CREATE INDEX docs_fts ON docs USING fts(title, body);
INSERT INTO docs VALUES (1, 'needle', 'haystack'), (2, 'haystack', 'needle');
```
This query searches only `body`. It returns `2`, not the row that
contains `needle` only in `title`:
```sql
SELECT id FROM docs WHERE fts_match(body, 'needle');
-- id: 2
```
This query searches both columns. It returns `1` and `2`:
```sql
SELECT id FROM docs WHERE fts_match(title, body, 'needle') ORDER BY id;
-- id: 1, 2
```
The index also supplies a score for the `body` s

**File**: `core/index_method/fts/mod.rs` (modified, +85/-49)
```diff
@@ -59,7 +59,7 @@ use tantivy::{
     DocAddress, DocSet, Index, IndexReader, IndexSettings, Searcher, SegmentReader,
     TantivyDocument, Term, TERMINATED,
 };
-use turso_parser::ast::{Select, SortOrder};
+use turso_parser::ast::{self, Select, SortOrder};
 use uncased::UncasedStr;
 
 mod directory;
@@ -290,43 +290,6 @@ pub fn fts_highlight(text: &str, query: &str, before_tag: &str, after_tag: &str)
     })
 }
 
-/// Check if text matches a query by testing for any common terms.
-///
-/// Standalone function that can be used without an FTS index.
-/// It tokenizes both the query and text using Tantivy's default tokenizer,
-/// and returns true if any query terms appear in the text.
-pub fn fts_match(text: &str, query: &str) -> bool {
-    if text.is_empty() || query.is_empty() {
-        return false;
-    }
-
-    FTS_TOKENIZER.with(|tokenizer| {
-        let mut tokenizer = tokenizer.borrow_mut();
-
-        // Extract query terms (lowercased)
-        let query_terms: HashSet<String> = {
-            let mut terms = HashSet::default();
-            let mut query_stream = tokenizer.token_stream(query);
-            while let Some(token) = query_stream.next() {
-                terms.insert(token.text.to_string());
-            }
-            terms
-        };
-        if query_terms.is_empty() {
-            return false;
-        }
-
-        // Tokenize the text and check if any query terms appear
-        let mut text_stream = tokenizer.token_stream(text);
-        while let Some(token) = text_stream.next() {
-            if query_terms.contains(&token.text) {
-                return true;
-            }
-        }
-        false
-    })
-}
-
 /// Parse field weights from a string like "body=2.0,title=1.0"
 /// Returns a HashMap mapping column names to tantivy 'boost factors'
 fn parse_field_weights(weights_str: &str, columns: &[IndexColumn]) -> Result<HashMap<String, f32>> {
@@ -836,6 +799,32 @@ impl IndexMethodAttachment for FtsIndexAttachment {
     fn init(&self) -> Result<Box<dyn IndexMethodCursor>> {
         Ok(Box::new(FtsCursor::new(self)))
     }
+
+    fn result_column(
+        &self,
+        pattern: &ast::Expr,
+        parameters: &HashMap<i32, ast::Expr>,
+    ) -> Option<Box<ast::Expr>> {
+        let mut result = crate::util::try_substitute_parameters(pattern, parameters)?;
+        let ast::Expr::FunctionCall { name, args, .. } = result.as_mut() else {
+            return Some(result);
+        };
+        if !name.as_str().eq_ignore_ascii_case("fts_score") {
+            return Some(result);
+        }
+        let ast::Expr::Literal(ast::Literal::String(fields)) =
+            parameters.get(&crate::util::FTS_FIELD_PARAMETER)?
+        else {
+            return None;
+        };
+        let mut selected = Vec::new();
+        for field in fields.trim_matches('\'').split(',') {
+            selected.push(args.get(field.parse::<usize>().ok()?)?.clone());
+        }
+        selected.push(args.last()?.clone());
+        *args = selected;
+        Some(result)
+    }
 }
 
 /// Pattern indices for FTS queries
@@ -844,8 +833,8 @@ const FTS_PATTERN_COMBINED_ORDERED_LIMIT: i64 = 1;
 const FTS_PATTERN_COMBINED_ORDERED: i64 = 2;
 const FTS_PATTERN_COMBINED_LIMIT: i64 = 3;
 const FTS_PATTERN_COMBINED: i64 = 4;
-const FTS_PATTERN_MATCH_LIMIT: i64 = 5;
-const FTS_PATTERN_MATCH: i64 = 6;
+pub(crate) const FTS_PATTERN_MATCH_LIMIT: i64 = 5;
+pub(crate) const FTS_PATTERN_MATCH: i64 = 6;
 
 fn bounded_query_limit(limit: Option<i64>, live_docs: u64) -> usize {
     let live_docs = usize::try_from(live_docs).unwrap_or(usize::MAX);
@@ -3088,10 +3077,43 @@ impl IndexMethodCursor for FtsCursor {
             query => query.to_string(),
         };
 
-        let parser = self
-            .cached_parser
-            .as_deref()
-            .expect("parser built with the searcher");
+        let fields = match values.last().map(Register::get_value) {
+            Some(Value::Text(fields)) => fields.as_str(),
+            _ => {
+                return Err(LimboError::InternalError(
+                    "FTS query_start: missing indexed fields".into(),
+                )
+                .into())
+            }
+        };
+        let selected_fields = fields
+            .split(',')
+            .map(|field| {
+                field
+                    .parse::<usize>()
+                    .ok()
+                    .and_then(|i| self.default_fields.get(i).copied())
+                    .ok_or_else(|| {
+                        LimboError::InternalError("FTS query_start: invalid field".into())
+                    })
+            })
+            .collect::<Result<Vec<_>>>()?;
+        let parser = if selected_fields.len() == self.default_fields.len() {
+            Arc::clone(
+                self.cached_parser
+                    .as_ref()
+                    .expect("parser built with the searcher"),
+            )
+        } else {
+            let mut parser = tantivy::query::QueryParser::f
```

**File**: `core/index_method/fts/tests.rs` (modified, +38/-0)
```diff
@@ -80,6 +80,43 @@ fn test_attachment() -> FtsIndexAttachment {
     .unwrap()
 }
 
+#[test]
+fn score_result_uses_the_fields_selected_by_the_query() {
+    let attachment = test_attachment();
+    let pattern = &attachment.patterns[FTS_PATTERN_COMBINED as usize];
+    let ast::OneSelect::Select { columns, .. } = &pattern.body.select else {
+        panic!("expected a SELECT pattern");
+    };
+    let ast::ResultColumn::Expr(score, _) = &columns[0] else {
+        panic!("expected a score result");
+    };
+    let ast::Expr::FunctionCall { args, .. } = score.as_ref() else {
+        panic!("expected a score function");
+    };
+
+    for (fields, expected_columns) in [("1", &[1][..]), ("0", &[0][..]), ("0,1", &[0, 1][..])] {
+        let parameters = FxHashMap::from_iter([
+            (1, Expr::Literal(Literal::String("'needle'".to_string()))),
+            (
+                crate::util::FTS_FIELD_PARAMETER,
+                Expr::Literal(Literal::String(format!("'{fields}'"))),
+            ),
+        ]);
+        let result = attachment.result_column(score, &parameters).unwrap();
+        let Expr::FunctionCall {
+            args: result_args, ..
+        } = result.as_ref()
+        else {
+            panic!("expected a score function");
+        };
+        assert_eq!(result_args.len(), expected_columns.len() + 1);
+        for (&expected, actual) in expected_columns.iter().zip(result_args) {
+            assert_eq!(actual.as_ref(), args[expected].as_ref());
+        }
+        assert_eq!(result_args.last().unwrap().as_ref(), &parameters[&1]);
+    }
+}
+
 #[test]
 fn indexed_text_is_not_duplicated_in_tantivy_document_store() {
     let attachment = test_attachment();
@@ -737,6 +774,7 @@ fn query_hits(cursor: &mut FtsCursor, pattern: i64, query: &str, limit: i64) ->
         Register::Value(Value::from_i64(pattern)),
         Register::Value(Value::from_text(query.to_owned())),
         Register::Value(Value::from_i64(limit)),
+        Register::Value(Value::from_text("0,1".to_owned())),
     ];
     let mut hits = Vec::new();
     let mut next = cursor.query_start(&values).unwrap();
```

**File**: `core/index_method/mod.rs` (modified, +13/-0)
```diff
@@ -65,6 +65,19 @@ pub struct IndexMethodConfiguration {
 pub trait IndexMethodAttachment: std::fmt::Debug + Send + Sync {
     fn definition<'a>(&'a self) -> IndexMethodDefinition<'a>;
     fn init(&self) -> Result<Box<dyn IndexMethodCursor>>;
+
+    /// Returns the result expression this index provides for the captured query parameters.
+    /// The planner compares it with the requested expression before using an index result
+    /// instead of evaluating the function. Return None if the index cannot provide it.
+    /// By default, this only replaces pattern placeholders; FTS also limits scores to
+    /// the fields selected by the search query.
+    fn result_column(
+        &self,
+        pattern: &ast::Expr,
+        parameters: &HashMap<i32, ast::Expr>,
+    ) -> Option<Box<ast::Expr>> {
+        crate::util::try_substitute_parameters(pattern, parameters)
+    }
 }
 
 #[derive(Debug, Clone, Copy, PartialEq, Eq)]
```

**File**: `core/translate/expr/functions.rs` (modified, +1/-30)
```diff
@@ -57,36 +57,7 @@ pub(super) fn translate_like_base(
         }
         #[cfg(all(feature = "fts", not(target_family = "wasm")))]
         ast::LikeOperator::Match => {
-            // Transform MATCH to fts_match():
-            // - `col MATCH 'query'` -> `fts_match(col, 'query')`
-            // - `(col1, col2) MATCH 'query'` -> `fts_match(col1, col2, 'query')`
-            let columns: Vec<&ast::Expr> = match lhs.as_ref() {
-                ast::Expr::Parenthesized(cols) => cols.iter().map(|c| c.as_ref()).collect(),
-                other => vec![other],
-            };
-            let arg_count = columns.len() + 1; // columns + query
-            let start_reg = program.alloc_registers(arg_count);
-
-            for (i, col) in columns.iter().enumerate() {
-                translate_expr(program, referenced_tables, col, start_reg + i, resolver)?;
-            }
-            translate_expr(
-                program,
-                referenced_tables,
-                rhs,
-                start_reg + columns.len(),
-                resolver,
-            )?;
-
-            program.emit_insn(Insn::Function {
-                constant_mask: 0,
-                start_reg,
-                dest: target_register,
-                func: FuncCtx {
-                    func: Func::Fts(FtsFunc::Match),
-                    arg_count,
-                },
-            });
+            crate::bail_parse_error!("MATCH requires an FTS index query")
         }
         #[cfg(any(not(feature = "fts"), target_family = "wasm"))]
         ast::LikeOperator::Match => {
```

**File**: `core/translate/expr/translator.rs` (modified, +85/-11)
```diff
@@ -2061,17 +2061,25 @@ pub fn translate_expr(
                     }
                 },
                 #[cfg(all(feature = "fts", not(target_family = "wasm")))]
-                Func::Fts(_) => {
-                    // FTS functions are handled via index method pattern matching.
-                    // If we reach here, no index matched, so translate as a regular function call.
-                    translate_function(
-                        program,
-                        args,
-                        referenced_tables,
-                        resolver,
-                        target_register,
-                        func_ctx,
-                    )
+                Func::Fts(FtsFunc::Highlight) => translate_function(
+                    program,
+                    args,
+                    referenced_tables,
+                    resolver,
+                    target_register,
+                    func_ctx,
+                ),
+                #[cfg(all(feature = "fts", not(target_family = "wasm")))]
+                Func::Fts(FtsFunc::Score) => translate_fts_score(
+                    program,
+                    referenced_tables,
+                    args,
+                    target_register,
+                    name.as_str(),
+                ),
+                #[cfg(all(feature = "fts", not(target_family = "wasm")))]
+                Func::Fts(FtsFunc::Match) => {
+                    crate::bail_parse_error!("{} requires an FTS index query", name.as_str())
                 }
                 Func::AlterTable(_) => unreachable!(),
             }
@@ -3151,3 +3159,69 @@ pub fn translate_expr(
 
     Ok(target_register)
 }
+
+#[cfg(all(feature = "fts", not(target_family = "wasm")))]
+fn translate_fts_score(
+    program: &mut ProgramBuilder,
+    referenced_tables: Option<&TableReferences>,
+    args: &[Box<ast::Expr>],
+    target_register: usize,
+    name: &str,
+) -> Result<usize> {
+    let indexed_columns = args.len().checked_sub(1).filter(|&n| n > 0);
+    let selected_index = indexed_columns.and_then(|n| {
+        let ast::Expr::Column { table, .. } = args[0].as_ref() else {
+            return None;
+        };
+        referenced_tables
+            .and_then(|tables| tables.find_joined_table_by_internal_id(*table))
+            .and_then(|table_ref| match &table_ref.op {
+                Operation::IndexMethodQuery(query)
+                    if query.index.index_method.as_ref().is_some_and(|method| {
+                        method.definition().method_name
+                            == crate::index_method::fts::FTS_INDEX_METHOD_NAME
+                    }) && query.arguments.first().is_some_and(|indexed_query| {
+                        exprs_are_equivalent(indexed_query, args.last().unwrap())
+                    }) && {
+                        let fields = query.index.columns.iter().enumerate()
+                            .filter(|(_, indexed)| args[..n].iter().any(|arg| {
+                                matches!(arg.as_ref(), ast::Expr::Column { column, .. }
+                                    if *column == indexed.pos_in_table)
+                            }))
+                            .map(|(i, _)| i.to_string())
+                            .collect::<Vec<_>>()
+                            .join(",");
+                        n == fields.split(',').count()
+                            && query.arguments.last() == Some(&ast::Expr::Literal(
+                                ast::Literal::String(format!("'{fields}'"))
+                            ))
+                    }
+                        && args[..n].iter().all(|arg| {
+                            matches!(arg.as_ref(), ast::Expr::Column { table, column, .. }
+                                if *table == table_ref.internal_id && query.index.columns.iter().any(|indexed| indexed.pos_in_table == *column))
+                    }) =>
+                {
+                    Some((*table, query))
+                }
+                _ => None,
+            })
+    });
+    let Some((table, query)) = selected_index else {
+        crate::bail_parse_error!(
+            "{} requires columns and query from the selected FTS index",
+            name
+        );
+    };
+    let cursor_id = program.resolve_cursor_id(&CursorKey::index(table, query.index.clone()));
+    let score_column = if matches!(
+        query.pattern_idx as i64,
+        crate::index_method::fts::FTS_PATTERN_MATCH_LIMIT
+            | crate::index_method::fts::FTS_PATTERN_MATCH
+    ) {
+        1
+    } else {
+        0
+    };
+    program.emit_column_or_rowid(cursor_id, score_column, target_register);
+    Ok(target_register)
+}
```

**File**: `core/translate/optimizer/mod.rs` (modified, +13/-4)
```diff
@@ -15,7 +15,7 @@ use crate::translate::plan::{BitSet, ColumnMask, MultiIndexBranchAccess};
 use crate::translate::planner::{table_mask_from_expr, TableMask};
 use crate::{
     function::{AggFunc, Deterministic},
-    index_method::{IndexMethodCostContext, IndexMethodCostEstimate},
+    index_method::{IndexMethodAttachment, IndexMethodCostContext, IndexMethodCostEstimate},
     numeric::Numeric,
     schema::{
         BTreeCharacteristics, BTreeTable, ColDef, Column, Index, IndexColumn, Schema, Table, Type,
@@ -45,7 +45,7 @@ use crate::{
     types::SeekOp,
     util::{
         count_fts_column_args, exprs_are_equivalent, simple_bind_expr, try_capture_parameters,
-        try_capture_parameters_column_agnostic, try_substitute_parameters,
+        try_capture_parameters_column_agnostic,
     },
     vdbe::{
         affinity::Affinity,
@@ -442,6 +442,13 @@ fn try_match_index_method_pattern(
             let Some(captured) = captured else {
                 continue;
             };
+            if captured.iter().any(|(key, value)| {
+                parameters
+                    .get(key)
+                    .is_some_and(|previous| !exprs_are_equivalent(previous, value))
+            }) {
+                continue;
+            }
             parameters.extend(captured);
             where_query_covered = Some(i);
             break;
@@ -475,6 +482,7 @@ fn try_match_index_method_pattern(
 /// Build covered columns mapping from pattern columns.
 /// Returns a HashMap mapping synthetic column IDs to pattern column IDs.
 fn build_covered_columns_mapping(
+    module: &dyn IndexMethodAttachment,
     pattern_columns: &[ast::ResultColumn],
     parameters: &HashMap<i32, ast::Expr>,
 ) -> HashMap<usize, usize> {
@@ -484,7 +492,7 @@ fn build_covered_columns_mapping(
         let ast::ResultColumn::Expr(pattern_expr, _) = pattern_column else {
             continue;
         };
-        let Some(_substituted) = try_substitute_parameters(pattern_expr, parameters) else {
+        let Some(_substituted) = module.result_column(pattern_expr, parameters) else {
             continue;
         };
         covered_columns.insert(covered_column_id, pattern_column_id);
@@ -558,6 +566,7 @@ fn collect_index_method_candidates(
 
                 // Build covered columns mapping from pattern match
                 let covered_columns = build_covered_columns_mapping(
+                    module.as_ref(),
                     &pattern_match.pattern_columns,
                     &pattern_match.parameters,
                 );
@@ -1966,7 +1975,7 @@ fn optimize_table_access_with_custom_modules(
                     continue;
                 };
                 let Some(substituted) =
-                    try_substitute_parameters(pattern_expr, &pattern_match.parameters)
+                    module.result_column(pattern_expr, &pattern_match.parameters)
                 else {
                     continue;
                 };
```

**File**: `core/util.rs` (modified, +17/-10)
```diff
@@ -665,6 +665,8 @@ pub fn count_fts_column_args(expr: &Expr) -> usize {
     }
 }
 
+pub const FTS_FIELD_PARAMETER: i32 = i32::MAX;
+
 /// Match FTS function calls where column arguments can appear in any order.
 ///
 /// FTS functions like `fts_match(col1, col2, 'query')` should match
@@ -711,8 +713,9 @@ pub fn try_capture_parameters_column_agnostic(
         return None;
     }
 
-    // Argument counts must match
-    if pattern_args.len() != query_args.len() {
+    let suffix_len = pattern_args.len().checked_sub(num_column_args)?;
+    let query_column_count = query_args.len().checked_sub(suffix_len)?;
+    if query_column_count == 0 || query_column_count > num_column_args {
         return None;
     }
     // Distinctness must match (we don't support it)
@@ -740,12 +743,10 @@ pub fn try_capture_parameters_column_agnostic(
 
     // Split args into column args (reorderable) and remaining args (positional)
     let pattern_col_args = &pattern_args[..num_column_args];
-    let query_col_args = &query_args[..num_column_args];
+    let query_col_args = &query_args[..query_column_count];
     let pattern_rest = &pattern_args[num_column_args..];
-    let query_rest = &query_args[num_column_args..];
+    let query_rest = &query_args[query_column_count..];
 
-    // For column arguments: check that the same set of columns is used (order-independent)
-    // We use a greedy matching approach: for each query column, find a matching pattern column
     let mut matched_pattern_indices = BitSet::default();
 
     for query_col in query_col_args {
@@ -764,16 +765,22 @@ pub fn try_capture_parameters_column_agnostic(
             return None;
         }
     }
-    // All pattern columns must be matched
-    if matched_pattern_indices.count() != pattern_col_args.len() {
-        return None;
-    }
     // Remaining args must match positionally (includes the query string parameter)
     for (pattern_arg, query_arg) in pattern_rest.iter().zip(query_rest.iter()) {
         let result = try_capture_parameters(pattern_arg, query_arg)?;
         captured.extend(result);
     }
 
+    let fields = (0..num_column_args)
+        .filter(|&i| matched_pattern_indices.get(i))
+        .map(|i| i.to_string())
+        .collect::<Vec<_>>()
+        .join(",");
+    captured.insert(
+        FTS_FIELD_PARAMETER,
+        Expr::Literal(Literal::String(format!("'{fields}'"))),
+    );
+
     Some(captured)
 }
 
```

**File**: `core/vdbe/execute.rs` (modified, +5/-43)
```diff
@@ -12177,51 +12177,13 @@ pub fn op_function(
         }
         #[cfg(all(feature = "fts", not(target_family = "wasm")))]
         crate::function::Func::Fts(fts_func) => {
-            // FTS functions are typically handled via index method pattern matching.
-            // If we reach here, just return a fallback since no FTS index matched.
             use crate::function::FtsFunc;
             match fts_func {
-                FtsFunc::Score => {
-                    // Without an FTS index match, return 0.0 as a default score
-                    state.registers[*dest]
-                        .set_float(NonNan::new(0.0).expect("0.0 is a valid NonNan"));
-                }
-                FtsFunc::Match => {
-                    // fts_match(col1, col2, ..., query): returns 1 if any column matches query
-                    // Minimum: fts_match(text, query) = 2 args
-                    if arg_count < 2 {
-                        return Err(LimboError::InvalidArgument(
-                            "fts_match requires at least 2 arguments: text, query".to_string(),
-                        )
-                        .into());
-                    }
-
-                    // Last arg is the query, first N-1 args are text columns
-                    let num_text_cols = arg_count - 1;
-                    let query = state.registers[*start_reg + num_text_cols].get_value();
-
-                    if matches!(query, Value::Null) {
-                        state.registers[*dest].set_int(0);
-                    } else {
-                        let query_str = query.to_string();
-
-                        // Concatenate all text columns with space separator
-                        let est_len = 16;
-                        let mut combined_text = String::with_capacity(num_text_cols * est_len);
-                        for i in 0..num_text_cols {
-                            let text = state.registers[*start_reg + i].get_value();
-                            if !matches!(text, Value::Null) {
-                                if !combined_text.is_empty() {
-                                    combined_text.push(' ');
-                                }
-                                combined_text.push_str(&text.to_string());
-                            }
-                        }
-
-                        let matches =
-                            crate::index_method::fts::fts_match(&combined_text, &query_str);
-                        state.registers[*dest].set_int(matches.into());
-                    }
+                FtsFunc::Score | FtsFunc::Match => {
+                    return Err(LimboError::InternalError(
+                        "unplanned FTS function reached execution".to_string(),
+                    )
+                    .into());
                 }
                 FtsFunc::Highlight => {
                     // fts_highlight(col1, col2, ..., before_tag, after_tag, query)
```

---

### Incident Patch 4: `eccdc83f` (2026-10-01)
**Commit Message**: Merge 'sync: fix table refresh replay for tables with generated columns' from Mikaël Francoeur

There was a bug that could lead to `duplicate column name`. If a local
DB had table `CREATE TABLE t(a, b as (a))`, as soon as the table changed
on the remote (via `ALTER TABLE`), the next pull would pull for example
`CREATE TABLE t(a, b as (a), c)`, check `pragma_table_info` to list its
local columns, see `[a]`, and then try to add `b as (a)` to the
database. This is because `pragma_table_info` skips generated columns.

Another pragma, `pragma_table_xinfo`, does return generated columns, but
it doesn't return the expressions of the columns. The expressions are
necessary, because if a remote changes the expression of a generated
column, the local DB needs to drop the old column and add the new one.

I/Claude also fixed a few case sensitivity issues and added regression
tests for those.

Related problems that this PR does not fix: #9415 and #9270.

Reviewed-by: Nikita Sivukhin (@sivukhin)

Closes #9416

**File**: `sync/engine/src/database_replay_generator.rs` (modified, +128/-37)
```diff
@@ -455,7 +455,7 @@ impl DatabaseReplayGenerator {
         columns: &[bool],
     ) -> Result<ReplayInfo> {
         let (column_names, pk_column_indices, rowid_alias_pk_column_index) =
-            self.table_columns_info(coro, table_name).await?;
+            self.writable_columns(coro, table_name).await?;
         // The CDC record may have fewer columns than the current schema
         // (e.g. records captured before ALTER TABLE ADD COLUMN).
         // Only reference columns present in the record.
@@ -518,7 +518,7 @@ impl DatabaseReplayGenerator {
         columns: usize,
     ) -> Result<ReplayInfo> {
         let (column_names, pk_column_indices, rowid_alias_pk_column_index) =
-            self.table_columns_info(coro, table_name).await?;
+            self.writable_columns(coro, table_name).await?;
         // The CDC record may have fewer columns than the current schema
         // (e.g. records captured before ALTER TABLE ADD COLUMN).
         // Only reference columns present in the record.
@@ -609,7 +609,7 @@ impl DatabaseReplayGenerator {
         use_rowid: bool,
     ) -> Result<ReplayInfo> {
         let (column_names, pk_column_indices, rowid_alias_pk_column_index) =
-            self.table_columns_info(coro, table_name).await?;
+            self.writable_columns(coro, table_name).await?;
         let mut pk_predicates = Vec::with_capacity(1);
         for &idx in &pk_column_indices {
             pk_predicates.push(identity_predicate(&column_names[idx]));
@@ -659,10 +659,11 @@ impl DatabaseReplayGenerator {
         })
     }
 
-    /// Execute a DDL statement idempotently: CREATE TABLE is replayed with
-    /// `IF NOT EXISTS`, named schema objects are skipped when already present,
-    /// and `ALTER TABLE ADD COLUMN` only adds missing columns. Falls back to
-    /// direct execution for other DDL.
+    /// Execute a DDL statement idempotently: CREATE TABLE for an existing table
+    /// drops the generated columns that it removes or changes and adds the
+    /// columns that are missing, named schema objects are skipped when already
+    /// present, and `ALTER TABLE ADD COLUMN` only adds missing columns. Falls
+    /// back to direct execution for other DDL.
     pub async fn execute_ddl_idempotent<Ctx>(&self, coro: &Coro<Ctx>, ddl: &str) -> Result<()> {
         let mut parser = Parser::new(ddl.as_bytes());
         let Some(Ok(turso_parser::ast::Cmd::Stmt(mut stmt))) = parser.next() else {
@@ -678,25 +679,41 @@ impl DatabaseReplayGenerator {
             } => {
                 *if_not_exists = true;
                 let table_name = tbl_name.name.as_str();
-                let (current_columns, _, _) = self.table_columns_info(coro, table_name).await?;
-                if current_columns.is_empty() {
+                let Some(mut local_columns) =
+                    self.local_column_definitions(coro, table_name).await?
+                else {
+                    // the local table didn't exist
                     self.execute_ddl(ddl)?;
                     return Ok(());
-                }
+                };
                 if let turso_parser::ast::CreateTableBody::ColumnsAndConstraints {
-                    columns, ..
+                    columns: remote_columns,
+                    ..
                 } = body
                 {
-                    for column in columns {
-                        let col_name = column.col_name.as_str();
-                        if current_columns.iter().any(|c| c == col_name) {
+                    // drop the generated columns that were changed
+                    for index in (0..local_columns.len()).rev() {
+                        if !generated_column_changed_between_local_and_remote(
+                            &local_columns[index],
+                            remote_columns,
+                        ) {
+                            continue;
+                        }
+                        let dropped = local_columns.remove(index);
+                        let drop_column =
+                            format!("ALTER TABLE {tbl_name} DROP COLUMN {}", dropped.col_name);
+                        self.execute_ddl(&drop_column)?;
+                    }
+                    // add the missing remote columns
+                    for column in remote_columns {
+                        if has_column(&local_columns, column.col_name.as_str()) {
                             continue;
                         }
                         let add_column = format!("ALTER TABLE {tbl_name} ADD COLUMN {column}");
                         self.execute_ddl(&add_column)?;
                     }
                 }
-                return Ok(());
+                Ok(())
             }
             turso_parser::ast::Stmt::CreateIndex { idx_name, .. } => {
                 if self
@@ -706,7 +723,7 @@ impl DatabaseReplayGenerator {
                     return Ok(());
                 }
                 self.execute_ddl(ddl)?;
-                retur
```

**File**: `sync/engine/src/database_tape.rs` (modified, +252/-0)
```diff
@@ -3409,4 +3409,256 @@ mod tests {
             "the swap must keep both rows"
         );
     }
+
+    #[test]
+    pub fn test_schema_refresh_of_table_with_generated_column_adds_missing_column() {
+        let rows = replay_on_table_with_generated_columns(
+            &[
+                "CREATE TABLE core (id STRING PRIMARY KEY, sort TEXT, search TEXT AS (CAST (sort AS TEXT)))",
+                "INSERT INTO core (id, sort) VALUES ('a', 'Hello')",
+            ],
+            vec![table_refresh(
+                "CREATE TABLE core (id STRING PRIMARY KEY, sort TEXT, search TEXT AS (CAST (sort AS TEXT)), note TEXT)",
+            )],
+            "SELECT id, sort, search, note FROM core",
+        )
+        .unwrap();
+        assert_eq!(
+            rows,
+            vec![vec![
+                text("a"),
+                text("Hello"),
+                text("Hello"),
+                turso_core::Value::Null
+            ]]
+        );
+    }
+
+    #[test]
+    pub fn test_schema_refresh_replaces_changed_generated_column() {
+        let setup = &[
+            "CREATE TABLE core (id STRING PRIMARY KEY, sort TEXT, search TEXT AS (CAST (sort AS TEXT)))",
+            "INSERT INTO core (id, sort) VALUES ('a', 'Hello')",
+        ];
+        let insert_row = || {
+            DatabaseTapeOperation::RowChange(DatabaseTapeRowChange {
+                change_id: 0,
+                change_time: 0,
+                change: DatabaseTapeRowChangeType::Insert {
+                    after: crate::alloc::vec![text("b"), text("World")],
+                },
+                table_name: "core".to_string(),
+                id: 2,
+            })
+        };
+        let expected = vec![
+            vec![text("a"), text("Hello"), text("HELLO")],
+            vec![text("b"), text("World"), text("WORLD")],
+        ];
+
+        let drop_then_add = replay_on_table_with_generated_columns(
+            setup,
+            vec![
+                table_refresh("CREATE TABLE core (id STRING PRIMARY KEY, sort TEXT)"),
+                table_refresh(
+                    "CREATE TABLE core (id STRING PRIMARY KEY, sort TEXT, search TEXT AS (UPPER (sort)))",
+                ),
+                insert_row(),
+            ],
+            "SELECT id, sort, search FROM core ORDER BY id",
+        )
+        .unwrap();
+        assert_eq!(drop_then_add, expected);
+
+        let redefine_in_one_refresh = replay_on_table_with_generated_columns(
+            setup,
+            vec![
+                table_refresh(
+                    "CREATE TABLE core (id STRING PRIMARY KEY, sort TEXT, search TEXT AS (UPPER (sort)))",
+                ),
+                insert_row(),
+            ],
+            "SELECT id, sort, search FROM core ORDER BY id",
+        )
+        .unwrap();
+        assert_eq!(redefine_in_one_refresh, expected);
+    }
+
+    #[test]
+    pub fn test_schema_refresh_drops_removed_generated_column() {
+        let rows = replay_on_table_with_generated_columns(
+            &[
+                "CREATE TABLE core (id STRING PRIMARY KEY, sort TEXT, search TEXT AS (CAST (sort AS TEXT)))",
+                "INSERT INTO core (id, sort) VALUES ('a', 'Hello')",
+            ],
+            vec![table_refresh(
+                "CREATE TABLE core (id STRING PRIMARY KEY, sort TEXT)",
+            )],
+            "SELECT * FROM core",
+        )
+        .unwrap();
+        assert_eq!(rows, vec![vec![text("a"), text("Hello")]]);
+    }
+
+    #[test]
+    pub fn test_add_column_replay_skips_existing_generated_column() {
+        let rows = replay_on_table_with_generated_columns(
+            &[
+                "CREATE TABLE core (id STRING PRIMARY KEY, sort TEXT, search TEXT AS (CAST (sort AS TEXT)))",
+                "INSERT INTO core (id, sort) VALUES ('a', 'Hello')",
+            ],
+            vec![DatabaseTapeOperation::SchemaReplay(
+                DatabaseSchemaReplay::Alter {
+                    sql: "ALTER TABLE core ADD COLUMN search TEXT AS (CAST (sort AS TEXT))"
+                        .to_string(),
+                },
+            )],
+            "SELECT id, sort, search FROM core",
+        )
+        .unwrap();
+        assert_eq!(rows, vec![vec![text("a"), text("Hello"), text("Hello")]]);
+    }
+
+    #[test]
+    pub fn test_schema_refresh_matches_column_names_case_insensitively() {
+        let rows = replay_on_table_with_generated_columns(
+            &[
+                "CREATE TABLE core (id STRING PRIMARY KEY, Note TEXT)",
+                "INSERT INTO core (id, Note) VALUES ('a', 'Hello')",
+            ],
+            vec![table_refresh(
+                "CREATE TABLE core (id STRING PRIMARY KEY, note TEXT)",
+            )],
+            "SELECT id, note FROM core",
+        )
+        .unwrap();
+        assert_eq!(rows, vec![vec![text("a"), text("Hello")]]);
+    }
+
+    #[test]
+    pub fn test_add_column_replay_matches_column_names_case_insensitively() {
+        let rows = replay_on
```

---

### Incident Patch 5: `35bfe006` (2026-10-01)
**Commit Message**: Merge 'core/vdbe: return NULL from substr() of a zero-length blob' from saptarshi

- `substr()` of a zero-length blob returned `X''`. SQLite returns NULL,
because `sqlite3_value_blob()` is NULL for an empty blob and
`substrFunc` returns early.
- The blob arm of `exec_substring` now returns NULL for an empty blob
before computing positions. Non-empty blobs and text are unchanged:
`substr(X'00', 2)` is still `X''` and `substr('', 1)` is still `''`.
- Tests: new cases in `test_substring`, plus `substr-empty-
blob.sqltest`, which also covers an expression index on `substr()`. Both
fail without the fix and pass with it.

An expression index on `substr(c, ...)` stored a different key than
SQLite for empty blobs, so sqlite3 reported the database file as
corrupt.

Closes #9283

The fix and regression tests were written with the help of an AI coding
assistant, then reviewed before submitting. The new tests were checked
to fail without the change and pass with it.

Closes #9439

**File**: `core/vdbe/value.rs` (modified, +27/-0)
```diff
@@ -564,6 +564,10 @@ impl Value {
 
         Ok(match (value, start_value) {
             (Value::Blob(b), Value::Numeric(Numeric::Integer(start))) => {
+                // sqlite3_value_blob() is NULL for a zero-length blob, so substrFunc returns NULL
+                if b.is_empty() {
+                    return Ok(Value::Null);
+                }
                 let (start, end) = calculate_postions(start, b.len(), length_value.as_ref());
                 return Value::from_slice(&b[start..end]);
             }
@@ -3230,6 +3234,29 @@ mod tests {
             )),
             expected_val
         );
+
+        let blob_value = Value::Blob(crate::alloc::vec![]);
+        let start_value = Value::from_i64(1);
+        let length_value = Value::from_i64(10);
+        assert_eq!(
+            allocated(Value::exec_substring(
+                &blob_value,
+                &start_value,
+                Some(&length_value),
+            )),
+            Value::Null
+        );
+        assert_eq!(
+            allocated(Value::exec_substring(&blob_value, &start_value, None)),
+            Value::Null
+        );
+
+        let blob_value = Value::Blob(crate::alloc::vec![0]);
+        let start_value = Value::from_i64(2);
+        assert_eq!(
+            allocated(Value::exec_substring(&blob_value, &start_value, None)),
+            Value::Blob(crate::alloc::vec![])
+        );
     }
 
     #[test]
```

**File**: `sqlite/conformance/sqlite-sqltests/substr-empty-blob.sqltest` (added, +97/-0)
```diff
@@ -0,0 +1,97 @@
+@database :memory:
+
+# sqlite3_value_blob() is NULL for a zero-length blob, so substr() returns
+# NULL for it. A non-empty blob still returns X'' when the range is empty, and
+# an empty string still returns ''.
+
+test substr-empty-blob {
+    SELECT quote(substr(X'', 1, 10)), quote(substr(zeroblob(0), 1)), quote(substr(X'', 0, -1));
+}
+expect {
+    NULL|NULL|NULL
+}
+
+test substr-nonempty-blob-empty-range {
+    SELECT quote(substr(X'00', 2)), quote(substr(X'0102', 3, 1));
+}
+expect {
+    X''|X''
+}
+
+test substr-empty-text {
+    SELECT quote(substr('', 1, 10));
+}
+expect {
+    ''
+}
+
+# An expression index on substr() has to store the same key as SQLite.
+test substr-empty-blob-expression-index {
+    CREATE TABLE t(c);
+    CREATE INDEX i ON t(substr(c, 1, 10));
+    INSERT INTO t VALUES (zeroblob(0));
+    SELECT count(*) FROM t INDEXED BY i WHERE substr(c, 1, 10) IS NULL;
+}
+expect {
+    1
+}
+
+# The empty-blob check happens before the start and length arguments are
+# looked at, so their type and sign do not matter.
+test substr-empty-blob-non-integer-start {
+    SELECT quote(substr(X'', 1.5)), quote(substr(X'', '1')), quote(substr(X'', 'abc', 2)), quote(substr(X'', 1.0, 2.0)), quote(substr(X'', X'31'));
+}
+expect {
+    NULL|NULL|NULL|NULL|NULL
+}
+
+test substr-empty-blob-negative-start {
+    SELECT quote(substr(X'', -1)), quote(substr(X'', -1, 5)), quote(substr(X'', -5, -5));
+}
+expect {
+    NULL|NULL|NULL
+}
+
+test substr-empty-blob-null-args {
+    SELECT quote(substr(X'', NULL)), quote(substr(X'', 1, NULL)), quote(substr(X'', NULL, NULL));
+}
+expect {
+    NULL|NULL|NULL
+}
+
+test substr-empty-blob-substring-alias {
+    SELECT quote(substring(X'', 1)), quote(substring(X'', 1, 10));
+}
+expect {
+    NULL|NULL
+}
+
+# A cast changes which branch is taken: an empty string cast to a blob is an
+# empty blob, and an empty blob cast to text is an empty string.
+test substr-empty-blob-cast {
+    SELECT typeof(substr(CAST('' AS BLOB), 1)), typeof(substr(CAST(X'' AS TEXT), 1));
+}
+expect {
+    null|text
+}
+
+# Non-empty blobs still coerce a non-integer start to an integer.
+test substr-nonempty-blob-non-integer-start {
+    SELECT quote(substr(X'0102', 1.5)), quote(substr(X'0102', '2')), quote(substr(X'0102', 'abc', 2)), quote(substr(X'0102', 2.0, 1.0)), quote(substr(X'0102', X'32'));
+}
+expect {
+    X'0102'|X'02'|X'01'|X'02'|X'02'
+}
+
+test substr-empty-blob-from-table {
+    CREATE TABLE t2(id INTEGER PRIMARY KEY, c);
+    INSERT INTO t2 VALUES (1, X''), (2, zeroblob(0)), (3, ''), (4, X'00'), (5, NULL);
+    SELECT id, quote(substr(c, 1, 10)) FROM t2 ORDER BY id;
+}
+expect {
+    1|NULL
+    2|NULL
+    3|''
+    4|X'00'
+    5|NULL
+}
```

---

### Incident Patch 6: `0aa309c1` (2026-10-01)
**Commit Message**: core/vdbe: return NULL from substr() of a zero-length blob

SQLite's substrFunc returns NULL when sqlite3_value_blob() is NULL,
which is the case for a zero-length blob. Turso returned X'' instead,
so an expression index on substr() stored a different key than SQLite
and sqlite3 reported the file as corrupt.

Text is unchanged: substr('', ...) is still ''.

Tests: added unit test cases and substr-empty-blob.sqltest

Fixes #9283

**File**: `core/vdbe/value.rs` (modified, +27/-0)
```diff
@@ -564,6 +564,10 @@ impl Value {
 
         Ok(match (value, start_value) {
             (Value::Blob(b), Value::Numeric(Numeric::Integer(start))) => {
+                // sqlite3_value_blob() is NULL for a zero-length blob, so substrFunc returns NULL
+                if b.is_empty() {
+                    return Ok(Value::Null);
+                }
                 let (start, end) = calculate_postions(start, b.len(), length_value.as_ref());
                 return Value::from_slice(&b[start..end]);
             }
@@ -3230,6 +3234,29 @@ mod tests {
             )),
             expected_val
         );
+
+        let blob_value = Value::Blob(crate::alloc::vec![]);
+        let start_value = Value::from_i64(1);
+        let length_value = Value::from_i64(10);
+        assert_eq!(
+            allocated(Value::exec_substring(
+                &blob_value,
+                &start_value,
+                Some(&length_value),
+            )),
+            Value::Null
+        );
+        assert_eq!(
+            allocated(Value::exec_substring(&blob_value, &start_value, None)),
+            Value::Null
+        );
+
+        let blob_value = Value::Blob(crate::alloc::vec![0]);
+        let start_value = Value::from_i64(2);
+        assert_eq!(
+            allocated(Value::exec_substring(&blob_value, &start_value, None)),
+            Value::Blob(crate::alloc::vec![])
+        );
     }
 
     #[test]
```

**File**: `sqlite/conformance/sqlite-sqltests/substr-empty-blob.sqltest` (added, +97/-0)
```diff
@@ -0,0 +1,97 @@
+@database :memory:
+
+# sqlite3_value_blob() is NULL for a zero-length blob, so substr() returns
+# NULL for it. A non-empty blob still returns X'' when the range is empty, and
+# an empty string still returns ''.
+
+test substr-empty-blob {
+    SELECT quote(substr(X'', 1, 10)), quote(substr(zeroblob(0), 1)), quote(substr(X'', 0, -1));
+}
+expect {
+    NULL|NULL|NULL
+}
+
+test substr-nonempty-blob-empty-range {
+    SELECT quote(substr(X'00', 2)), quote(substr(X'0102', 3, 1));
+}
+expect {
+    X''|X''
+}
+
+test substr-empty-text {
+    SELECT quote(substr('', 1, 10));
+}
+expect {
+    ''
+}
+
+# An expression index on substr() has to store the same key as SQLite.
+test substr-empty-blob-expression-index {
+    CREATE TABLE t(c);
+    CREATE INDEX i ON t(substr(c, 1, 10));
+    INSERT INTO t VALUES (zeroblob(0));
+    SELECT count(*) FROM t INDEXED BY i WHERE substr(c, 1, 10) IS NULL;
+}
+expect {
+    1
+}
+
+# The empty-blob check happens before the start and length arguments are
+# looked at, so their type and sign do not matter.
+test substr-empty-blob-non-integer-start {
+    SELECT quote(substr(X'', 1.5)), quote(substr(X'', '1')), quote(substr(X'', 'abc', 2)), quote(substr(X'', 1.0, 2.0)), quote(substr(X'', X'31'));
+}
+expect {
+    NULL|NULL|NULL|NULL|NULL
+}
+
+test substr-empty-blob-negative-start {
+    SELECT quote(substr(X'', -1)), quote(substr(X'', -1, 5)), quote(substr(X'', -5, -5));
+}
+expect {
+    NULL|NULL|NULL
+}
+
+test substr-empty-blob-null-args {
+    SELECT quote(substr(X'', NULL)), quote(substr(X'', 1, NULL)), quote(substr(X'', NULL, NULL));
+}
+expect {
+    NULL|NULL|NULL
+}
+
+test substr-empty-blob-substring-alias {
+    SELECT quote(substring(X'', 1)), quote(substring(X'', 1, 10));
+}
+expect {
+    NULL|NULL
+}
+
+# A cast changes which branch is taken: an empty string cast to a blob is an
+# empty blob, and an empty blob cast to text is an empty string.
+test substr-empty-blob-cast {
+    SELECT typeof(substr(CAST('' AS BLOB), 1)), typeof(substr(CAST(X'' AS TEXT), 1));
+}
+expect {
+    null|text
+}
+
+# Non-empty blobs still coerce a non-integer start to an integer.
+test substr-nonempty-blob-non-integer-start {
+    SELECT quote(substr(X'0102', 1.5)), quote(substr(X'0102', '2')), quote(substr(X'0102', 'abc', 2)), quote(substr(X'0102', 2.0, 1.0)), quote(substr(X'0102', X'32'));
+}
+expect {
+    X'0102'|X'02'|X'01'|X'02'|X'02'
+}
+
+test substr-empty-blob-from-table {
+    CREATE TABLE t2(id INTEGER PRIMARY KEY, c);
+    INSERT INTO t2 VALUES (1, X''), (2, zeroblob(0)), (3, ''), (4, X'00'), (5, NULL);
+    SELECT id, quote(substr(c, 1, 10)) FROM t2 ORDER BY id;
+}
+expect {
+    1|NULL
+    2|NULL
+    3|''
+    4|X'00'
+    5|NULL
+}
```

---

### Incident Patch 7: `0440b05d` (2026-09-30)
**Commit Message**: sync: fix table refresh replay for tables with generated columns

**File**: `sync/engine/src/database_replay_generator.rs` (modified, +105/-17)
```diff
@@ -455,7 +455,7 @@ impl DatabaseReplayGenerator {
         columns: &[bool],
     ) -> Result<ReplayInfo> {
         let (column_names, pk_column_indices, rowid_alias_pk_column_index) =
-            self.table_columns_info(coro, table_name).await?;
+            self.writable_columns(coro, table_name).await?;
         // The CDC record may have fewer columns than the current schema
         // (e.g. records captured before ALTER TABLE ADD COLUMN).
         // Only reference columns present in the record.
@@ -518,7 +518,7 @@ impl DatabaseReplayGenerator {
         columns: usize,
     ) -> Result<ReplayInfo> {
         let (column_names, pk_column_indices, rowid_alias_pk_column_index) =
-            self.table_columns_info(coro, table_name).await?;
+            self.writable_columns(coro, table_name).await?;
         // The CDC record may have fewer columns than the current schema
         // (e.g. records captured before ALTER TABLE ADD COLUMN).
         // Only reference columns present in the record.
@@ -609,7 +609,7 @@ impl DatabaseReplayGenerator {
         use_rowid: bool,
     ) -> Result<ReplayInfo> {
         let (column_names, pk_column_indices, rowid_alias_pk_column_index) =
-            self.table_columns_info(coro, table_name).await?;
+            self.writable_columns(coro, table_name).await?;
         let mut pk_predicates = Vec::with_capacity(1);
         for &idx in &pk_column_indices {
             pk_predicates.push(identity_predicate(&column_names[idx]));
@@ -659,10 +659,11 @@ impl DatabaseReplayGenerator {
         })
     }
 
-    /// Execute a DDL statement idempotently: CREATE TABLE is replayed with
-    /// `IF NOT EXISTS`, named schema objects are skipped when already present,
-    /// and `ALTER TABLE ADD COLUMN` only adds missing columns. Falls back to
-    /// direct execution for other DDL.
+    /// Execute a DDL statement idempotently: CREATE TABLE for an existing table
+    /// drops the generated columns that it removes or changes and adds the
+    /// columns that are missing, named schema objects are skipped when already
+    /// present, and `ALTER TABLE ADD COLUMN` only adds missing columns. Falls
+    /// back to direct execution for other DDL.
     pub async fn execute_ddl_idempotent<Ctx>(&self, coro: &Coro<Ctx>, ddl: &str) -> Result<()> {
         let mut parser = Parser::new(ddl.as_bytes());
         let Some(Ok(turso_parser::ast::Cmd::Stmt(mut stmt))) = parser.next() else {
@@ -678,18 +679,33 @@ impl DatabaseReplayGenerator {
             } => {
                 *if_not_exists = true;
                 let table_name = tbl_name.name.as_str();
-                let (current_columns, _, _) = self.table_columns_info(coro, table_name).await?;
-                if current_columns.is_empty() {
+                let Some(mut local_columns) =
+                    self.local_column_definitions(coro, table_name).await?
+                else {
                     self.execute_ddl(ddl)?;
                     return Ok(());
-                }
+                };
                 if let turso_parser::ast::CreateTableBody::ColumnsAndConstraints {
-                    columns, ..
+                    columns: remote_columns,
+                    ..
                 } = body
                 {
-                    for column in columns {
-                        let col_name = column.col_name.as_str();
-                        if current_columns.iter().any(|c| c == col_name) {
+                    // drop the generated columns that were changed
+                    for index in (0..local_columns.len()).rev() {
+                        if !generated_column_changed_between_local_and_remote(
+                            &local_columns[index],
+                            remote_columns,
+                        ) {
+                            continue;
+                        }
+                        let dropped = local_columns.remove(index);
+                        let drop_column =
+                            format!("ALTER TABLE {tbl_name} DROP COLUMN {}", dropped.col_name);
+                        self.execute_ddl(&drop_column)?;
+                    }
+                    // add the missing remote columns
+                    for column in remote_columns {
+                        if has_column(&local_columns, column.col_name.as_str()) {
                             continue;
                         }
                         let add_column = format!("ALTER TABLE {tbl_name} ADD COLUMN {column}");
@@ -740,9 +756,12 @@ impl DatabaseReplayGenerator {
             return Ok(());
         };
         let table_name = tbl_name.name.as_str();
-        let (current_columns, _, _) = self.table_columns_info(coro, table_name).await?;
+        let local_columns = self
+            .local_column_definitions(coro, table_name)
+            .await?
+            .unwrap_or_default();
         let col_name = col_def.col_name.as_str();
-        if current_columns.iter().any(|c| c == col_name) {

```

**File**: `sync/engine/src/database_tape.rs` (modified, +229/-0)
```diff
@@ -3409,4 +3409,233 @@ mod tests {
             "the swap must keep both rows"
         );
     }
+
+    #[test]
+    pub fn test_schema_refresh_of_table_with_generated_column_adds_missing_column() {
+        let rows = replay_on_table_with_generated_columns(
+            &[
+                "CREATE TABLE core (id STRING PRIMARY KEY, sort TEXT, search TEXT AS (CAST (sort AS TEXT)))",
+                "INSERT INTO core (id, sort) VALUES ('a', 'Hello')",
+            ],
+            vec![table_refresh(
+                "CREATE TABLE core (id STRING PRIMARY KEY, sort TEXT, search TEXT AS (CAST (sort AS TEXT)), note TEXT)",
+            )],
+            "SELECT id, sort, search, note FROM core",
+        )
+        .unwrap();
+        assert_eq!(
+            rows,
+            vec![vec![
+                text("a"),
+                text("Hello"),
+                text("Hello"),
+                turso_core::Value::Null
+            ]]
+        );
+    }
+
+    #[test]
+    pub fn test_schema_refresh_replaces_changed_generated_column() {
+        let setup = &[
+            "CREATE TABLE core (id STRING PRIMARY KEY, sort TEXT, search TEXT AS (CAST (sort AS TEXT)))",
+            "INSERT INTO core (id, sort) VALUES ('a', 'Hello')",
+        ];
+        let insert_row = || {
+            DatabaseTapeOperation::RowChange(DatabaseTapeRowChange {
+                change_id: 0,
+                change_time: 0,
+                change: DatabaseTapeRowChangeType::Insert {
+                    after: crate::alloc::vec![text("b"), text("World")],
+                },
+                table_name: "core".to_string(),
+                id: 2,
+            })
+        };
+        let expected = vec![
+            vec![text("a"), text("Hello"), text("HELLO")],
+            vec![text("b"), text("World"), text("WORLD")],
+        ];
+
+        let drop_then_add = replay_on_table_with_generated_columns(
+            setup,
+            vec![
+                table_refresh("CREATE TABLE core (id STRING PRIMARY KEY, sort TEXT)"),
+                table_refresh(
+                    "CREATE TABLE core (id STRING PRIMARY KEY, sort TEXT, search TEXT AS (UPPER (sort)))",
+                ),
+                insert_row(),
+            ],
+            "SELECT id, sort, search FROM core ORDER BY id",
+        )
+        .unwrap();
+        assert_eq!(drop_then_add, expected);
+
+        let redefine_in_one_refresh = replay_on_table_with_generated_columns(
+            setup,
+            vec![
+                table_refresh(
+                    "CREATE TABLE core (id STRING PRIMARY KEY, sort TEXT, search TEXT AS (UPPER (sort)))",
+                ),
+                insert_row(),
+            ],
+            "SELECT id, sort, search FROM core ORDER BY id",
+        )
+        .unwrap();
+        assert_eq!(redefine_in_one_refresh, expected);
+    }
+
+    #[test]
+    pub fn test_schema_refresh_drops_removed_generated_column() {
+        let rows = replay_on_table_with_generated_columns(
+            &[
+                "CREATE TABLE core (id STRING PRIMARY KEY, sort TEXT, search TEXT AS (CAST (sort AS TEXT)))",
+                "INSERT INTO core (id, sort) VALUES ('a', 'Hello')",
+            ],
+            vec![table_refresh(
+                "CREATE TABLE core (id STRING PRIMARY KEY, sort TEXT)",
+            )],
+            "SELECT * FROM core",
+        )
+        .unwrap();
+        assert_eq!(rows, vec![vec![text("a"), text("Hello")]]);
+    }
+
+    #[test]
+    pub fn test_add_column_replay_skips_existing_generated_column() {
+        let rows = replay_on_table_with_generated_columns(
+            &[
+                "CREATE TABLE core (id STRING PRIMARY KEY, sort TEXT, search TEXT AS (CAST (sort AS TEXT)))",
+                "INSERT INTO core (id, sort) VALUES ('a', 'Hello')",
+            ],
+            vec![DatabaseTapeOperation::SchemaReplay(
+                DatabaseSchemaReplay::Alter {
+                    sql: "ALTER TABLE core ADD COLUMN search TEXT AS (CAST (sort AS TEXT))"
+                        .to_string(),
+                },
+            )],
+            "SELECT id, sort, search FROM core",
+        )
+        .unwrap();
+        assert_eq!(rows, vec![vec![text("a"), text("Hello"), text("Hello")]]);
+    }
+
+    #[test]
+    pub fn test_schema_refresh_matches_column_names_case_insensitively() {
+        let rows = replay_on_table_with_generated_columns(
+            &[
+                "CREATE TABLE core (id STRING PRIMARY KEY, Note TEXT)",
+                "INSERT INTO core (id, Note) VALUES ('a', 'Hello')",
+            ],
+            vec![table_refresh(
+                "CREATE TABLE core (id STRING PRIMARY KEY, note TEXT)",
+            )],
+            "SELECT id, note FROM core",
+        )
+        .unwrap();
+        assert_eq!(rows, vec![vec![text("a"), text("Hello")]]);
+    }
+
+    #[test]
+    pub fn test_add_column_replay_matches_column_names_case_insensitively() {
+        let rows = replay_on
```

---

### Incident Patch 8: `a3f3748e` (2026-09-30)
**Commit Message**: Merge 'core/pragma: fix synchronous pragma to accept a schema argument' from Sergei Iarymov

Fixes #8193

To be specific, the only part that wasn't fixed before, which is "_The
mode cannot even be read per-schema: SELECT * FROM
pragma_synchronous('aux') → Parse error: Too many arguments for
pragma_synchronous: expected at most 0, got 1._"

Fix is pretty straightforward, just add the "schema required" flag to
the Synchronous pragma, and safely pass to the sql string.

However, there's something I'm not entirely sure about, since I stumbled
upon the "Schema-qualified PRAGMA statements are not supported yet"
comment and the guard code below. I decided to make an exception for
Synchronous but keep the guard for other functions, cause it looks
dangerous to unblock the schema for all of them without a proper
testing, and I believe it goes beyond the scope of this fix and require
a separate issue/issues. But pls let me know if it's not the way we want
to go here.

Reviewed-by: Mikaël Francoeur (@LeMikaelF)

Closes #9411

**File**: `core/pragma.rs` (modified, +14/-6)
```diff
@@ -1,4 +1,5 @@
 use crate::sync::Arc;
+use crate::util::{escape_sql_string_literal, quote_identifier};
 use crate::{Connection, LimboError, Statement, StepResult, Value};
 use bitflags::bitflags;
 use strum::IntoEnumIterator;
@@ -97,7 +98,7 @@ pub fn pragma_for(pragma: &PragmaName) -> Pragma {
             &["schema_version"],
         ),
         Synchronous => Pragma::new(
-            PragmaFlags::NoColumns1 | PragmaFlags::Result0,
+            PragmaFlags::NoColumns1 | PragmaFlags::Result0 | PragmaFlags::SchemaReq,
             &["synchronous"],
         ),
         TempStore => Pragma::new(
@@ -451,16 +452,23 @@ impl PragmaVirtualTableCursor {
         // return the same rowids, as SQLite does.
         self.pos = 0;
 
-        if let Some(schema) = schema {
-            // Schema-qualified PRAGMA statements are not supported yet
+        // TODO: only synchronous supports a schema arg so far. Unblock the
+        // rest one by one, then delete this check.
+        if schema.is_some() && self.pragma_name != "synchronous" {
             return Err(LimboError::ParseError(format!(
-                "Schema argument is not supported yet (got schema: '{schema}')"
+                "Schema argument is not supported yet (got schema: '{}')",
+                schema.unwrap()
             )));
         }
 
-        let mut sql = format!("PRAGMA {}", self.pragma_name);
+        let mut sql = String::from("PRAGMA ");
+        if let Some(schema) = &schema {
+            sql.push_str(&quote_identifier(schema));
+            sql.push('.');
+        }
+        sql.push_str(&self.pragma_name);
         if let Some(arg) = &self.arg {
-            sql.push_str(&format!("=\"{arg}\""));
+            sql.push_str(&format!("='{}'", escape_sql_string_literal(arg)));
         }
 
         // Table-valued pragma helpers execute inside the parent statement's VM step.
```

**File**: `sqlite/conformance/sqlite-sqltests/pragma/synchronous.sqltest` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+@database :memory:
+
+test pragma-synchronous-tvf-schema-qualified {
+    ATTACH ':memory:' AS aux;
+    PRAGMA aux.synchronous=OFF;
+    SELECT * FROM pragma_synchronous('aux');
+    SELECT * FROM pragma_synchronous('main');
+}
+expect {
+    0
+    2
+}
+
+test pragma-synchronous-tvf-schema-hidden-column-reads-back-null {
+    ATTACH ':memory:' AS aux;
+    SELECT schema IS NULL FROM pragma_synchronous('aux');
+}
+expect {
+    1
+}
+
+test pragma-synchronous-tvf-unqualified-defaults-to-main {
+    SELECT * FROM pragma_synchronous;
+}
+expect {
+    2
+}
+
+test pragma-synchronous-tvf-too-many-arguments {
+    SELECT * FROM pragma_synchronous('main', 'extra');
+}
+expect error {
+}
```

---

### Incident Patch 9: `33c1036a` (2026-09-30)
**Commit Message**: Merge 'fix build' from Mikaël Francoeur

Build is broken on main

Reviewed-by: Pedro Muniz (@pedrocarlo)

Closes #9417

**File**: `core/mvcc/database/tests.rs` (modified, +2/-2)
```diff
@@ -22818,7 +22818,7 @@ fn connect_async_yields_instead_of_spinning_on_preparing_commit_dependency() {
     // Park a second ANALYZE inside its commit: its new sqlite_stat1 versions
     // stay in `Preparing` until the statement is stepped again.
     writer.set_yield_injector(Some(FixedYieldInjector::new([
-        CommitYieldPoint::LogicalLogOwned.point(),
+        CommitYieldPoint::LogRecordMarkedWritten.point(),
     ])));
     let mut parked = writer.prepare("ANALYZE t2").unwrap();
     assert!(
@@ -22895,7 +22895,7 @@ fn dropping_connect_async_state_mid_wait_does_not_block() {
     writer.execute("ANALYZE").unwrap();
 
     writer.set_yield_injector(Some(FixedYieldInjector::new([
-        CommitYieldPoint::LogicalLogOwned.point(),
+        CommitYieldPoint::LogRecordMarkedWritten.point(),
     ])));
     let mut parked = writer.prepare("ANALYZE t1").unwrap();
     assert!(matches!(
```

---

### Incident Patch 10: `5be01bb2` (2026-09-29)
**Commit Message**: Merge 'core/pragma: fix freelist_count for temp and attached databases' from Sergei Iarymov

Fixes #9286

For some reason freelist_count had its own way to operate apart from the
the classic opcode + cookie path, which didn't account for the database,
hence numbers were coming from the main db instead of attached/temp db
they had to actually come from. So this fix is just bringing it back to
the family of other pragma functions that read cookies from the header
if the value they need is there. Also tt's mirroring what sqlite does.

Closes #9389

**File**: `core/translate/pragma.rs` (modified, +7/-5)
```diff
@@ -1580,12 +1580,14 @@ fn query_pragma(
         }
         PragmaName::VdbeTrace => Ok(TransactionMode::None),
         PragmaName::FreelistCount => {
-            let value = pager.freepage_list();
-            let register = program.alloc_register();
-            program.emit_int(value as i64, register);
-            program.emit_result_row(register, 1);
+            program.emit_insn(Insn::ReadCookie {
+                db: database_id,
+                dest: register,
+                cookie: Cookie::FreePageCount,
+            });
             program.add_pragma_result_column(pragma.to_string());
-            Ok(TransactionMode::None)
+            program.emit_result_row(register, 1);
+            Ok(TransactionMode::Read)
         }
         PragmaName::EncryptionKey => {
             let msg = {
```

**File**: `core/vdbe/execute.rs` (modified, +2/-0)
```diff
@@ -15804,6 +15804,7 @@ pub fn op_read_cookie(
                 Cookie::SchemaVersion => header.schema_cookie.get().into(),
                 Cookie::LargestRootPageNumber => header.vacuum_mode_largest_root_page.get().into(),
                 Cookie::PageSize => header.page_size.get().into(),
+                Cookie::FreePageCount => header.freelist_pages.get().into(),
                 cookie => todo!("{cookie:?} is not yet implement for ReadCookie"),
             },
         ) {
@@ -15909,6 +15910,7 @@ pub fn op_set_cookie(
             Cookie::PageSize => unreachable!(
                 "page size is not set via SetCookie; changing it is deferred to Connection::reset_page_size"
             ),
+            Cookie::FreePageCount => unreachable!("freelist page count is not set via SetCookie"),
         };
         Ok(())
     })? {
```

**File**: `core/vdbe/insn.rs` (modified, +2/-0)
```diff
@@ -2437,6 +2437,8 @@ impl Insn {
 // TODO: Add remaining cookies.
 #[derive(Description, Debug, Clone, Copy)]
 pub enum Cookie {
+    /// The number of free pages.
+    FreePageCount = 0,
     /// The schema cookie.
     SchemaVersion = 1,
     /// The schema format number. Supported schema formats are 1, 2, 3, and 4.
```

**File**: `sqlite/conformance/sqlite-sqltests/pragma/freelist_count.sqltest` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+@database :memory:
+
+@skip-if mvcc "freelist_count doesn't work under mvcc"
+test pragma-aux-freelist-count-matches-sqlite {
+    ATTACH ':memory:' AS aux;
+    CREATE TABLE aux.t(a);
+    INSERT INTO aux.t SELECT zeroblob(5000) FROM generate_series(1, 10);
+    DELETE FROM aux.t;
+    PRAGMA aux.freelist_count;
+}
+expect {
+    13
+}
```

**File**: `sqlite/conformance/sqlite-sqltests/temp_tables.sqltest` (modified, +10/-0)
```diff
@@ -270,6 +270,16 @@ expect {
     4096
 }
 
+test pragma-temp-freelist-count-matches-sqlite {
+    CREATE TEMP TABLE t(a);
+    INSERT INTO t SELECT zeroblob(5000) FROM generate_series(1, 10);
+    DELETE FROM t;
+    PRAGMA temp.freelist_count;
+}
+expect {
+    13
+}
+
 @cross-check-integrity
 test temp-store-change-outside-transaction-resets-temp-schema {
     CREATE TEMP TABLE reset_me(v INTEGER);
```

---

### Incident Patch 11: `4daaf0da` (2026-09-29)
**Commit Message**: Merge 'core/pragma: Fix page_size pragma to target the correct database' from Sergei Iarymov

Fixes #9287

For the getter, basically reuse what I did for freelist_count
[here](https://github.com/tursodatabase/turso/pull/9389). For the
setter, now take the already resolved database, pass it to the newly
initialized pager instead of previously used default one that was
derived from connection, and apply the new page size to it.

Closes #9404

**File**: `core/connection.rs` (modified, +8/-5)
```diff
@@ -2784,23 +2784,26 @@ impl Connection {
     /// Instead, the new page size is remembered and is used to set the page size when the database
     /// is first created, if it does not already exist when the page_size pragma is issued,
     /// or at the next VACUUM command that is run on the same database connection while not in WAL mode.
-    pub fn reset_page_size(&self, size: u32) -> Result<()> {
-        if self.db.initialized() {
+    pub fn reset_page_size(&self, database_id: usize, size: u32) -> Result<()> {
+        if self.get_source_database(database_id).initialized() {
             return Ok(());
         }
         let Some(size) = PageSize::new(size) else {
             return Ok(());
         };
 
-        self.pager.load().set_initial_page_size(size)?;
-        self.page_size.store(size.get_raw(), Ordering::SeqCst);
+        let pager = self.get_pager_from_database_index(&database_id)?;
+        pager.set_initial_page_size(size)?;
+        if database_id == MAIN_DB_ID {
+            self.page_size.store(size.get_raw(), Ordering::SeqCst);
+        }
         // MvStore caches a copy of the database header in `global_header`, captured from the
         // pager during bootstrap (before any PRAGMA page_size can run). Propagate the new
         // page size so subsequent transactions and any header lookups see the same value the
         // pager will write to disk; otherwise paths like op_open_ephemeral allocate buffers
         // sized to the connection's page_size but compute usable_space from the stale 4 KiB
         // global header, tripping the btree_init_page assertion.
-        if let Some(mv_store) = self.db.get_mv_store().as_ref() {
+        if let Some(mv_store) = self.mv_store_for_db(database_id).as_ref() {
             mv_store.set_global_page_size(size);
         }
         self.bump_prepare_context_generation();
```

**File**: `core/translate/pragma.rs` (modified, +12/-10)
```diff
@@ -520,7 +520,7 @@ fn update_pragma(
                 Value::Numeric(Numeric::Float(size)) => f64::from(size) as i64,
                 _ => bail_parse_error!("Invalid value for page size pragma"),
             };
-            update_page_size(connection, page_size as u32)?;
+            update_page_size(connection, database_id, page_size as u32)?;
             Ok(TransactionMode::None)
         }
         PragmaName::AutoVacuum => {
@@ -1462,13 +1462,11 @@ fn query_pragma(
             Ok(TransactionMode::Read)
         }
         PragmaName::PageSize => {
-            program.emit_int(
-                pager
-                    .io
-                    .block(|| pager.with_header(|header| header.page_size.get()))
-                    .unwrap_or_else(|_| connection.get_page_size().get()) as i64,
-                register,
-            );
+            program.emit_insn(Insn::ReadCookie {
+                db: database_id,
+                dest: register,
+                cookie: Cookie::PageSize,
+            });
             program.emit_result_row(register, 1);
             program.add_pragma_result_column(pragma.to_string());
             Ok(TransactionMode::None)
@@ -1941,7 +1939,11 @@ fn update_cache_size(
     Ok(())
 }
 
-fn update_page_size(connection: Arc<crate::Connection>, page_size: u32) -> crate::Result<()> {
-    connection.reset_page_size(page_size)?;
+fn update_page_size(
+    connection: Arc<crate::Connection>,
+    database_id: usize,
+    page_size: u32,
+) -> crate::Result<()> {
+    connection.reset_page_size(database_id, page_size)?;
     Ok(())
 }
```

**File**: `core/vdbe/execute.rs` (modified, +5/-1)
```diff
@@ -15803,6 +15803,7 @@ pub fn op_read_cookie(
                 Cookie::UserVersion => header.user_version.get().into(),
                 Cookie::SchemaVersion => header.schema_cookie.get().into(),
                 Cookie::LargestRootPageNumber => header.vacuum_mode_largest_root_page.get().into(),
+                Cookie::PageSize => header.page_size.get().into(),
                 cookie => todo!("{cookie:?} is not yet implement for ReadCookie"),
             },
         ) {
@@ -15905,6 +15906,9 @@ pub fn op_set_cookie(
                 })?;
                 header.schema_cookie = (*value as u32).into();
             }
+            Cookie::PageSize => unreachable!(
+                "page size is not set via SetCookie; changing it is deferred to Connection::reset_page_size"
+            ),
         };
         Ok(())
     })? {
@@ -19615,7 +19619,7 @@ fn op_vacuum_into_inner(program: &Program, state: &mut ProgramState, insn: &Insn
                     Some(codec) => output_db.connect_with_page_codec(codec)?,
                     None => output_db.connect()?,
                 };
-                output_conn.reset_page_size(page_size)?;
+                output_conn.reset_page_size(MAIN_DB_ID, page_size)?;
                 // set reserved_space on output to match source
                 // this is important for databases using encryption or checksums
                 // must be set before page 1 is allocated (before any schema operations)
```

**File**: `core/vdbe/insn.rs` (modified, +2/-0)
```diff
@@ -2453,6 +2453,8 @@ pub enum Cookie {
     IncrementalVacuum = 7,
     /// The application ID as set by the application_id pragma.
     ApplicationId = 8,
+    /// The page size, as read by the page_size pragma.
+    PageSize = 9,
 }
 
 #[cfg(test)]
```

**File**: `core/vdbe/vacuum.rs` (modified, +1/-1)
```diff
@@ -317,7 +317,7 @@ pub(crate) fn open_vacuum_temp_db(
         Some(codec) => db.connect_with_page_codec(codec)?,
         None => db.connect_with_encryption(encryption_key)?,
     };
-    conn.reset_page_size(page_size)?;
+    conn.reset_page_size(crate::MAIN_DB_ID, page_size)?;
     conn.set_reserved_bytes(reserved_space)?;
     conn.wal_auto_actions_disable();
 
```

**File**: `sqlite/conformance/sqlite-sqltests/pragma/page_size.sqltest` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+@database :memory:
+
+test pragma-attached-page-size-independent-of-main {
+    ATTACH ':memory:' AS aux;
+    PRAGMA aux.page_size=512;
+    CREATE TABLE aux.t(a);
+    PRAGMA aux.page_size;
+    PRAGMA main.page_size;
+}
+expect {
+    512
+    4096
+}
```

**File**: `sqlite/conformance/sqlite-sqltests/temp_tables.sqltest` (modified, +11/-0)
```diff
@@ -259,6 +259,17 @@ expect {
     0|-1|-1
 }
 
+test pragma-temp-page-size-independent-of-main {
+    PRAGMA temp.page_size=1024;
+    CREATE TEMP TABLE pagesize_temp_t(a);
+    PRAGMA temp.page_size;
+    PRAGMA main.page_size;
+}
+expect {
+    1024
+    4096
+}
+
 @cross-check-integrity
 test temp-store-change-outside-transaction-resets-temp-schema {
     CREATE TEMP TABLE reset_me(v INTEGER);
```

**File**: `tests/integration/query_processing/test_vacuum.rs` (modified, +1/-1)
```diff
@@ -1218,7 +1218,7 @@ fn test_vacuum_into_preserves_page_size(_tmp_db: TempDatabase) -> anyhow::Result
     let source_db = TempDatabase::new_empty();
     let conn = source_db.connect_limbo();
     // Set non-default page_size (must be done before any tables are created)
-    conn.reset_page_size(8192)?;
+    conn.reset_page_size(turso_core::MAIN_DB_ID, 8192)?;
 
     conn.execute("CREATE TABLE t (a INTEGER, b TEXT)")?;
     conn.execute("INSERT INTO t VALUES (1, 'hello'), (2, 'world')")?;
```

---

### Incident Patch 12: `bdfe693e` (2026-09-28)
**Commit Message**: Merge 'bindings/java: reject use of a closed connection or statement instead of using freed memory' from Pekka Enberg

Second half of the Java binding lifecycle fixes. #9399 covers `TursoDB`;
this covers `TursoConnection` and `TursoStatement`.

## Problem

`TursoConnection.close()` and `TursoStatement.close()` freed their
native boxes but kept the stale address in a final pointer field.
`prepare()` on a closed connection, and `step`, `bind*`, `columns`,
`reset`, `changes` and `parameterCount` on a closed statement, all
passed the freed pointer to native code, which dereferenced it. The
`closed` flags were also unsynchronized, so two threads closing at once
could free a box twice.

## Fix

- Zero the pointer on close and remove the separate `closed` flags. A
zero pointer is now the only definition of closed.
- Every native call on the statement goes through a helper that throws
when the statement is closed. `prepare()` checks the connection is open
before calling native code.
- Close and the native entry points are synchronized. The connection
takes its monitor only around the free and the prepare call, never while
holding `transactionLock`, so the lock order stays `transactionLock`

**File**: `bindings/java/rs_src/errors.rs` (modified, +4/-0)
```diff
@@ -12,6 +12,9 @@ pub enum TursoError {
     #[error("Invalid connection pointer")]
     InvalidConnectionPointer,
 
+    #[error("Invalid statement pointer")]
+    InvalidStatementPointer,
+
     #[error("JNI Errors: `{0}`")]
     JNIErrors(Error),
 }
@@ -28,6 +31,7 @@ impl From<TursoError> for JniError {
             TursoError::CustomError(_)
             | TursoError::InvalidDatabasePointer
             | TursoError::InvalidConnectionPointer
+            | TursoError::InvalidStatementPointer
             | TursoError::JNIErrors(_) => {
                 eprintln!("Error occurred: {value:?}");
                 JniError::Other(-1)
```

**File**: `bindings/java/rs_src/turso_connection.rs` (modified, +7/-2)
```diff
@@ -41,10 +41,15 @@ pub fn to_turso_connection(ptr: jlong) -> Result<&'static mut TursoConnection> {
 
 #[no_mangle]
 pub extern "system" fn Java_tech_turso_core_TursoConnection__1close<'local>(
-    _env: JNIEnv<'local>,
-    _obj: JObject<'local>,
+    mut env: JNIEnv<'local>,
+    obj: JObject<'local>,
     connection_ptr: jlong,
 ) {
+    if connection_ptr == 0 {
+        let e = TursoError::InvalidConnectionPointer;
+        set_err_msg_and_throw_exception(&mut env, obj, TURSO_ETC, e.to_string());
+        return;
+    }
     TursoConnection::drop(connection_ptr);
 }
 
```

**File**: `bindings/java/rs_src/turso_statement.rs` (modified, +16/-5)
```diff
@@ -38,7 +38,7 @@ impl TursoStatement {
 
 pub fn to_turso_statement(ptr: jlong) -> Result<&'static mut TursoStatement> {
     if ptr == 0 {
-        Err(TursoError::InvalidConnectionPointer)
+        Err(TursoError::InvalidStatementPointer)
     } else {
         unsafe { Ok(&mut *(ptr as *mut TursoStatement)) }
     }
@@ -88,10 +88,15 @@ pub extern "system" fn Java_tech_turso_core_TursoStatement_step<'local>(
 
 #[no_mangle]
 pub extern "system" fn Java_tech_turso_core_TursoStatement__1close<'local>(
-    _env: JNIEnv<'local>,
-    _obj: JObject<'local>,
+    mut env: JNIEnv<'local>,
+    obj: JObject<'local>,
     stmt_ptr: jlong,
 ) {
+    if stmt_ptr == 0 {
+        let e = TursoError::InvalidStatementPointer;
+        set_err_msg_and_throw_exception(&mut env, obj, TURSO_ETC, e.to_string());
+        return;
+    }
     TursoStatement::drop(stmt_ptr);
 }
 
@@ -124,10 +129,16 @@ fn row_to_obj_array<'local>(
 #[no_mangle]
 pub extern "system" fn Java_tech_turso_core_TursoStatement_columns<'local>(
     mut env: JNIEnv<'local>,
-    _obj: JObject<'local>,
+    obj: JObject<'local>,
     stmt_ptr: jlong,
 ) -> JObject<'local> {
-    let stmt = to_turso_statement(stmt_ptr).unwrap();
+    let stmt = match to_turso_statement(stmt_ptr) {
+        Ok(stmt) => stmt,
+        Err(e) => {
+            set_err_msg_and_throw_exception(&mut env, obj, TURSO_ETC, e.to_string());
+            return JObject::null();
+        }
+    };
     let num_columns = stmt.stmt.num_columns();
     let obj_arr: JObjectArray = env
         .new_object_array(num_columns as i32, "java/lang/String", JObject::null())
```

**File**: `bindings/java/src/main/java/tech/turso/core/TursoConnection.java` (modified, +14/-7)
```diff
@@ -16,9 +16,8 @@ public final class TursoConnection {
   private static final Logger logger = LoggerFactory.getLogger(TursoConnection.class);
 
   private final String url;
-  private final long connectionPtr;
+  private long connectionPtr;
   private final TursoDB database;
-  private boolean closed;
 
   // Transaction state fields
   private boolean autoCommit = true;
@@ -87,16 +86,21 @@ public void close() throws SQLException {
       }
     }
 
-    this._close(this.connectionPtr);
-    this.closed = true;
+    synchronized (this) {
+      if (isClosed()) {
+        return;
+      }
+      _close(connectionPtr);
+      connectionPtr = 0;
+    }
   }
 
   private native void _close(long connectionPtr);
 
   private native boolean _getAutoCommit(long connectionPtr);
 
-  public boolean isClosed() throws SQLException {
-    return closed;
+  public synchronized boolean isClosed() throws SQLException {
+    return connectionPtr == 0;
   }
 
   public TursoDB getDatabase() {
@@ -134,7 +138,10 @@ private TursoStatement prepare(String sql, boolean checkTransaction) throws SQLE
     if (sqlBytes == null) {
       throw new SQLException("Failed to convert " + sql + " into bytes");
     }
-    return new TursoStatement(sql, prepareUtf8(connectionPtr, sqlBytes));
+    synchronized (this) {
+      checkOpen();
+      return new TursoStatement(sql, prepareUtf8(connectionPtr, sqlBytes));
+    }
   }
 
   private native long prepareUtf8(long connectionPtr, byte[] sqlUtf8) throws SQLException;
```

**File**: `bindings/java/src/main/java/tech/turso/core/TursoStatement.java` (modified, +35/-30)
```diff
@@ -19,11 +19,9 @@ public final class TursoStatement implements AutoCloseable {
   private static final Logger log = LoggerFactory.getLogger(TursoStatement.class);
 
   private final String sql;
-  private final long statementPointer;
+  private long statementPointer;
   private TursoResultSet resultSet;
 
-  private boolean closed;
-
   // TODO: what if the statement we ran was DDL, update queries and etc. Should we still create a
   // resultSet?
   public TursoStatement(String sql, long statementPointer) {
@@ -47,8 +45,8 @@ public boolean execute() throws SQLException {
     return resultSet.hasLastStepReturnedRow();
   }
 
-  TursoStepResult step() throws SQLException {
-    final TursoStepResult result = step(this.statementPointer);
+  synchronized TursoStepResult step() throws SQLException {
+    final TursoStepResult result = step(openStatementPointer());
     if (result == null) {
       throw new SQLException("step() returned null, which is only returned when an error occurs");
     }
@@ -79,13 +77,13 @@ private void throwTursoException(int errorCode, byte[] errorMessageBytes) throws
    * Closes the current statement and releases any resources associated with it. This method calls
    * the native `_close` method to perform the actual closing operation.
    */
-  public void close() throws SQLException {
-    if (closed) {
+  public synchronized void close() throws SQLException {
+    if (isClosed()) {
       return;
     }
     this.resultSet.close();
     _close(statementPointer);
-    closed = true;
+    statementPointer = 0;
   }
 
   private native void _close(long statementPointer);
@@ -97,8 +95,8 @@ public void close() throws SQLException {
    *
    * @throws SQLException if a database access error occurs while retrieving column names
    */
-  public void initializeColumnMetadata() throws SQLException {
-    final String[] columnNames = this.columns(statementPointer);
+  public synchronized void initializeColumnMetadata() throws SQLException {
+    final String[] columnNames = this.columns(openStatementPointer());
     if (columnNames != null) {
       this.resultSet.setColumnNames(columnNames);
     }
@@ -114,8 +112,8 @@ public void initializeColumnMetadata() throws SQLException {
    * @return <a href="https://www.sqlite.org/c3ref/c_abort.html">Result Codes</a>
    * @throws SQLException If a database access error occurs.
    */
-  public int bindNull(int position) throws SQLException {
-    final int result = bindNull(statementPointer, position);
+  public synchronized int bindNull(int position) throws SQLException {
+    final int result = bindNull(openStatementPointer(), position);
     if (result != 0) {
       throw new SQLException("Exception while binding NULL value at position " + position);
     }
@@ -148,8 +146,8 @@ public int bindInt(int position, int value) throws SQLException {
    * @return <a href="https://www.sqlite.org/c3ref/c_abort.html">Result Codes</a>
    * @throws SQLException If a database access error occurs.
    */
-  public int bindLong(int position, long value) throws SQLException {
-    final int result = bindLong(statementPointer, position, value);
+  public synchronized int bindLong(int position, long value) throws SQLException {
+    final int result = bindLong(openStatementPointer(), position, value);
     if (result != 0) {
       throw new SQLException("Exception while binding long value at position " + position);
     }
@@ -166,8 +164,8 @@ public int bindLong(int position, long value) throws SQLException {
    * @return <a href="https://www.sqlite.org/c3ref/c_abort.html">Result Codes</a>
    * @throws SQLException If a database access error occurs.
    */
-  public int bindDouble(int position, double value) throws SQLException {
-    final int result = bindDouble(statementPointer, position, value);
+  public synchronized int bindDouble(int position, double value) throws SQLException {
+    final int result = bindDouble(openStatementPointer(), position, value);
     if (result != 0) {
       throw new SQLException("Exception while binding double value at position " + position);
     }
@@ -185,8 +183,8 @@ private native int bindDouble(long statementPointer, int position, double value)
    * @return <a href="https://www.sqlite.org/c3ref/c_abort.html">Result Codes</a>
    * @throws SQLException If a database access error occurs.
    */
-  public int bindText(int position, String value) throws SQLException {
-    final int result = bindText(statementPointer, position, value);
+  public synchronized int bindText(int position, String value) throws SQLException {
+    final int result = bindText(openStatementPointer(), position, value);
     if (result != 0) {
       throw new SQLException("Exception while binding text value at position " + position);
     }
@@ -204,8 +202,8 @@ private native int bindText(long statementPointer, int position, String value)
    * @return <a href="https://www.sqlite.org/c3ref/c_abort.html">Result Codes</a>
    * @throws SQLExcept
```

**File**: `bindings/java/src/test/java/tech/turso/core/TursoConnectionTest.java` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+package tech.turso.core;
+
+import static org.assertj.core.api.Assertions.assertThat;
+import static org.junit.jupiter.api.Assertions.assertThrows;
+import static org.junit.jupiter.api.Assertions.assertTrue;
+
+import java.sql.SQLException;
+import org.junit.jupiter.api.Test;
+import tech.turso.TestUtils;
+
+class TursoConnectionTest {
+
+  @Test
+  void closing_connection_twice_frees_it_only_once() throws Exception {
+    String dbPath = TestUtils.createTempFile();
+    TursoConnection conn = new TursoConnection("jdbc:turso:" + dbPath, dbPath);
+
+    conn.close();
+    conn.close();
+
+    assertTrue(conn.isClosed());
+  }
+
+  @Test
+  void prepare_after_close_throws_instead_of_touching_freed_memory() throws Exception {
+    String dbPath = TestUtils.createTempFile();
+    TursoConnection conn = new TursoConnection("jdbc:turso:" + dbPath, dbPath);
+    conn.close();
+
+    assertThrows(SQLException.class, () -> conn.prepare("SELECT 1"));
+  }
+
+  @Test
+  void statement_keeps_working_after_its_connection_is_closed() throws Exception {
+    String dbPath = TestUtils.createTempFile();
+    TursoConnection conn = new TursoConnection("jdbc:turso:" + dbPath, dbPath);
+    TursoStatement stmt = conn.prepare("SELECT 1");
+    conn.close();
+
+    assertThat(stmt.execute()).isTrue();
+    assertThat(stmt.getResultSet().get(1)).isEqualTo(1L);
+    stmt.close();
+  }
+}
```

**File**: `bindings/java/src/test/java/tech/turso/core/TursoStatementTest.java` (modified, +23/-0)
```diff
@@ -2,6 +2,7 @@
 
 import static org.junit.jupiter.api.Assertions.*;
 
+import java.sql.SQLException;
 import java.util.Properties;
 import org.junit.jupiter.api.BeforeEach;
 import org.junit.jupiter.api.Test;
@@ -29,6 +30,28 @@ void closing_statement_closes_related_resources() throws Exception {
     assertFalse(stmt.getResultSet().isOpen());
   }
 
+  @Test
+  void closing_statement_twice_frees_it_only_once() throws Exception {
+    TursoStatement stmt = connection.prepare("SELECT 1;");
+
+    stmt.close();
+    stmt.close();
+
+    assertTrue(stmt.isClosed());
+  }
+
+  @Test
+  void using_statement_after_close_throws_instead_of_touching_freed_memory() throws Exception {
+    TursoStatement stmt = connection.prepare("SELECT ?;");
+    stmt.close();
+
+    assertThrows(SQLException.class, stmt::step);
+    assertThrows(SQLException.class, () -> stmt.bindLong(1, 1));
+    assertThrows(SQLException.class, stmt::initializeColumnMetadata);
+    assertThrows(SQLException.class, stmt::parameterCount);
+    assertThrows(SQLException.class, stmt::reset);
+  }
+
   @Test
   void test_initializeColumnMetadata() throws Exception {
     runSql("CREATE TABLE users (name TEXT, age INT, country TEXT);");
```

---

### Incident Patch 13: `a7244a67` (2026-09-28)
**Commit Message**: bindings/java: throw on a null statement pointer in columns instead of panicking

columns() was the one native statement function that unwrapped the pointer
check, so a zero pointer would abort the JVM instead of surfacing a Java
exception like every other entry point does.

Add an InvalidStatementPointer error so statement pointer failures no longer
report themselves as connection pointer failures.

**File**: `bindings/java/rs_src/errors.rs` (modified, +4/-0)
```diff
@@ -12,6 +12,9 @@ pub enum TursoError {
     #[error("Invalid connection pointer")]
     InvalidConnectionPointer,
 
+    #[error("Invalid statement pointer")]
+    InvalidStatementPointer,
+
     #[error("JNI Errors: `{0}`")]
     JNIErrors(Error),
 }
@@ -28,6 +31,7 @@ impl From<TursoError> for JniError {
             TursoError::CustomError(_)
             | TursoError::InvalidDatabasePointer
             | TursoError::InvalidConnectionPointer
+            | TursoError::InvalidStatementPointer
             | TursoError::JNIErrors(_) => {
                 eprintln!("Error occurred: {value:?}");
                 JniError::Other(-1)
```

**File**: `bindings/java/rs_src/turso_statement.rs` (modified, +10/-4)
```diff
@@ -38,7 +38,7 @@ impl TursoStatement {
 
 pub fn to_turso_statement(ptr: jlong) -> Result<&'static mut TursoStatement> {
     if ptr == 0 {
-        Err(TursoError::InvalidConnectionPointer)
+        Err(TursoError::InvalidStatementPointer)
     } else {
         unsafe { Ok(&mut *(ptr as *mut TursoStatement)) }
     }
@@ -93,7 +93,7 @@ pub extern "system" fn Java_tech_turso_core_TursoStatement__1close<'local>(
     stmt_ptr: jlong,
 ) {
     if stmt_ptr == 0 {
-        let e = TursoError::InvalidConnectionPointer;
+        let e = TursoError::InvalidStatementPointer;
         set_err_msg_and_throw_exception(&mut env, obj, TURSO_ETC, e.to_string());
         return;
     }
@@ -129,10 +129,16 @@ fn row_to_obj_array<'local>(
 #[no_mangle]
 pub extern "system" fn Java_tech_turso_core_TursoStatement_columns<'local>(
     mut env: JNIEnv<'local>,
-    _obj: JObject<'local>,
+    obj: JObject<'local>,
     stmt_ptr: jlong,
 ) -> JObject<'local> {
-    let stmt = to_turso_statement(stmt_ptr).unwrap();
+    let stmt = match to_turso_statement(stmt_ptr) {
+        Ok(stmt) => stmt,
+        Err(e) => {
+            set_err_msg_and_throw_exception(&mut env, obj, TURSO_ETC, e.to_string());
+            return JObject::null();
+        }
+    };
     let num_columns = stmt.stmt.num_columns();
     let obj_arr: JObjectArray = env
         .new_object_array(num_columns as i32, "java/lang/String", JObject::null())
```

---

### Incident Patch 14: `b2cf7850` (2026-09-28)
**Commit Message**: bindings/java: reject use of a closed connection or statement instead of using freed memory

TursoConnection.close() and TursoStatement.close() freed their native boxes
but kept the stale address in a final pointer field. prepare() on a closed
connection, and step, bind, columns, reset, changes and parameterCount on a
closed statement, all passed the freed pointer to native code, which
dereferenced it.

Zero the pointer on close and treat a zero pointer as the closed state, so
there is one source of truth for whether the native handle exists. Every
native call now checks that first. Close and the native entry points are
synchronized so two threads cannot race a close against a use or free the
box twice. The connection takes its monitor only around the free and the
prepare call, never while holding transactionLock, so the lock order stays
transactionLock then connection for close, commit and rollback.

The native _close functions reject a zero pointer with an exception instead
of passing it to Box::from_raw.

Closing a connection before its statements stays safe because each native
statement holds its own clone of the connection; a test covers that ordering.

Tests: bindings/java Tu

**File**: `bindings/java/rs_src/turso_connection.rs` (modified, +7/-2)
```diff
@@ -41,10 +41,15 @@ pub fn to_turso_connection(ptr: jlong) -> Result<&'static mut TursoConnection> {
 
 #[no_mangle]
 pub extern "system" fn Java_tech_turso_core_TursoConnection__1close<'local>(
-    _env: JNIEnv<'local>,
-    _obj: JObject<'local>,
+    mut env: JNIEnv<'local>,
+    obj: JObject<'local>,
     connection_ptr: jlong,
 ) {
+    if connection_ptr == 0 {
+        let e = TursoError::InvalidConnectionPointer;
+        set_err_msg_and_throw_exception(&mut env, obj, TURSO_ETC, e.to_string());
+        return;
+    }
     TursoConnection::drop(connection_ptr);
 }
 
```

**File**: `bindings/java/rs_src/turso_statement.rs` (modified, +7/-2)
```diff
@@ -88,10 +88,15 @@ pub extern "system" fn Java_tech_turso_core_TursoStatement_step<'local>(
 
 #[no_mangle]
 pub extern "system" fn Java_tech_turso_core_TursoStatement__1close<'local>(
-    _env: JNIEnv<'local>,
-    _obj: JObject<'local>,
+    mut env: JNIEnv<'local>,
+    obj: JObject<'local>,
     stmt_ptr: jlong,
 ) {
+    if stmt_ptr == 0 {
+        let e = TursoError::InvalidConnectionPointer;
+        set_err_msg_and_throw_exception(&mut env, obj, TURSO_ETC, e.to_string());
+        return;
+    }
     TursoStatement::drop(stmt_ptr);
 }
 
```

**File**: `bindings/java/src/main/java/tech/turso/core/TursoConnection.java` (modified, +14/-7)
```diff
@@ -16,9 +16,8 @@ public final class TursoConnection {
   private static final Logger logger = LoggerFactory.getLogger(TursoConnection.class);
 
   private final String url;
-  private final long connectionPtr;
+  private long connectionPtr;
   private final TursoDB database;
-  private boolean closed;
 
   // Transaction state fields
   private boolean autoCommit = true;
@@ -87,16 +86,21 @@ public void close() throws SQLException {
       }
     }
 
-    this._close(this.connectionPtr);
-    this.closed = true;
+    synchronized (this) {
+      if (isClosed()) {
+        return;
+      }
+      _close(connectionPtr);
+      connectionPtr = 0;
+    }
   }
 
   private native void _close(long connectionPtr);
 
   private native boolean _getAutoCommit(long connectionPtr);
 
-  public boolean isClosed() throws SQLException {
-    return closed;
+  public synchronized boolean isClosed() throws SQLException {
+    return connectionPtr == 0;
   }
 
   public TursoDB getDatabase() {
@@ -134,7 +138,10 @@ private TursoStatement prepare(String sql, boolean checkTransaction) throws SQLE
     if (sqlBytes == null) {
       throw new SQLException("Failed to convert " + sql + " into bytes");
     }
-    return new TursoStatement(sql, prepareUtf8(connectionPtr, sqlBytes));
+    synchronized (this) {
+      checkOpen();
+      return new TursoStatement(sql, prepareUtf8(connectionPtr, sqlBytes));
+    }
   }
 
   private native long prepareUtf8(long connectionPtr, byte[] sqlUtf8) throws SQLException;
```

**File**: `bindings/java/src/main/java/tech/turso/core/TursoStatement.java` (modified, +35/-30)
```diff
@@ -19,11 +19,9 @@ public final class TursoStatement implements AutoCloseable {
   private static final Logger log = LoggerFactory.getLogger(TursoStatement.class);
 
   private final String sql;
-  private final long statementPointer;
+  private long statementPointer;
   private TursoResultSet resultSet;
 
-  private boolean closed;
-
   // TODO: what if the statement we ran was DDL, update queries and etc. Should we still create a
   // resultSet?
   public TursoStatement(String sql, long statementPointer) {
@@ -47,8 +45,8 @@ public boolean execute() throws SQLException {
     return resultSet.hasLastStepReturnedRow();
   }
 
-  TursoStepResult step() throws SQLException {
-    final TursoStepResult result = step(this.statementPointer);
+  synchronized TursoStepResult step() throws SQLException {
+    final TursoStepResult result = step(openStatementPointer());
     if (result == null) {
       throw new SQLException("step() returned null, which is only returned when an error occurs");
     }
@@ -79,13 +77,13 @@ private void throwTursoException(int errorCode, byte[] errorMessageBytes) throws
    * Closes the current statement and releases any resources associated with it. This method calls
    * the native `_close` method to perform the actual closing operation.
    */
-  public void close() throws SQLException {
-    if (closed) {
+  public synchronized void close() throws SQLException {
+    if (isClosed()) {
       return;
     }
     this.resultSet.close();
     _close(statementPointer);
-    closed = true;
+    statementPointer = 0;
   }
 
   private native void _close(long statementPointer);
@@ -97,8 +95,8 @@ public void close() throws SQLException {
    *
    * @throws SQLException if a database access error occurs while retrieving column names
    */
-  public void initializeColumnMetadata() throws SQLException {
-    final String[] columnNames = this.columns(statementPointer);
+  public synchronized void initializeColumnMetadata() throws SQLException {
+    final String[] columnNames = this.columns(openStatementPointer());
     if (columnNames != null) {
       this.resultSet.setColumnNames(columnNames);
     }
@@ -114,8 +112,8 @@ public void initializeColumnMetadata() throws SQLException {
    * @return <a href="https://www.sqlite.org/c3ref/c_abort.html">Result Codes</a>
    * @throws SQLException If a database access error occurs.
    */
-  public int bindNull(int position) throws SQLException {
-    final int result = bindNull(statementPointer, position);
+  public synchronized int bindNull(int position) throws SQLException {
+    final int result = bindNull(openStatementPointer(), position);
     if (result != 0) {
       throw new SQLException("Exception while binding NULL value at position " + position);
     }
@@ -148,8 +146,8 @@ public int bindInt(int position, int value) throws SQLException {
    * @return <a href="https://www.sqlite.org/c3ref/c_abort.html">Result Codes</a>
    * @throws SQLException If a database access error occurs.
    */
-  public int bindLong(int position, long value) throws SQLException {
-    final int result = bindLong(statementPointer, position, value);
+  public synchronized int bindLong(int position, long value) throws SQLException {
+    final int result = bindLong(openStatementPointer(), position, value);
     if (result != 0) {
       throw new SQLException("Exception while binding long value at position " + position);
     }
@@ -166,8 +164,8 @@ public int bindLong(int position, long value) throws SQLException {
    * @return <a href="https://www.sqlite.org/c3ref/c_abort.html">Result Codes</a>
    * @throws SQLException If a database access error occurs.
    */
-  public int bindDouble(int position, double value) throws SQLException {
-    final int result = bindDouble(statementPointer, position, value);
+  public synchronized int bindDouble(int position, double value) throws SQLException {
+    final int result = bindDouble(openStatementPointer(), position, value);
     if (result != 0) {
       throw new SQLException("Exception while binding double value at position " + position);
     }
@@ -185,8 +183,8 @@ private native int bindDouble(long statementPointer, int position, double value)
    * @return <a href="https://www.sqlite.org/c3ref/c_abort.html">Result Codes</a>
    * @throws SQLException If a database access error occurs.
    */
-  public int bindText(int position, String value) throws SQLException {
-    final int result = bindText(statementPointer, position, value);
+  public synchronized int bindText(int position, String value) throws SQLException {
+    final int result = bindText(openStatementPointer(), position, value);
     if (result != 0) {
       throw new SQLException("Exception while binding text value at position " + position);
     }
@@ -204,8 +202,8 @@ private native int bindText(long statementPointer, int position, String value)
    * @return <a href="https://www.sqlite.org/c3ref/c_abort.html">Result Codes</a>
    * @throws SQLExcept
```

**File**: `bindings/java/src/test/java/tech/turso/core/TursoConnectionTest.java` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+package tech.turso.core;
+
+import static org.assertj.core.api.Assertions.assertThat;
+import static org.junit.jupiter.api.Assertions.assertThrows;
+import static org.junit.jupiter.api.Assertions.assertTrue;
+
+import java.sql.SQLException;
+import org.junit.jupiter.api.Test;
+import tech.turso.TestUtils;
+
+class TursoConnectionTest {
+
+  @Test
+  void closing_connection_twice_frees_it_only_once() throws Exception {
+    String dbPath = TestUtils.createTempFile();
+    TursoConnection conn = new TursoConnection("jdbc:turso:" + dbPath, dbPath);
+
+    conn.close();
+    conn.close();
+
+    assertTrue(conn.isClosed());
+  }
+
+  @Test
+  void prepare_after_close_throws_instead_of_touching_freed_memory() throws Exception {
+    String dbPath = TestUtils.createTempFile();
+    TursoConnection conn = new TursoConnection("jdbc:turso:" + dbPath, dbPath);
+    conn.close();
+
+    assertThrows(SQLException.class, () -> conn.prepare("SELECT 1"));
+  }
+
+  @Test
+  void statement_keeps_working_after_its_connection_is_closed() throws Exception {
+    String dbPath = TestUtils.createTempFile();
+    TursoConnection conn = new TursoConnection("jdbc:turso:" + dbPath, dbPath);
+    TursoStatement stmt = conn.prepare("SELECT 1");
+    conn.close();
+
+    assertThat(stmt.execute()).isTrue();
+    assertThat(stmt.getResultSet().get(1)).isEqualTo(1L);
+    stmt.close();
+  }
+}
```

**File**: `bindings/java/src/test/java/tech/turso/core/TursoStatementTest.java` (modified, +23/-0)
```diff
@@ -2,6 +2,7 @@
 
 import static org.junit.jupiter.api.Assertions.*;
 
+import java.sql.SQLException;
 import java.util.Properties;
 import org.junit.jupiter.api.BeforeEach;
 import org.junit.jupiter.api.Test;
@@ -29,6 +30,28 @@ void closing_statement_closes_related_resources() throws Exception {
     assertFalse(stmt.getResultSet().isOpen());
   }
 
+  @Test
+  void closing_statement_twice_frees_it_only_once() throws Exception {
+    TursoStatement stmt = connection.prepare("SELECT 1;");
+
+    stmt.close();
+    stmt.close();
+
+    assertTrue(stmt.isClosed());
+  }
+
+  @Test
+  void using_statement_after_close_throws_instead_of_touching_freed_memory() throws Exception {
+    TursoStatement stmt = connection.prepare("SELECT ?;");
+    stmt.close();
+
+    assertThrows(SQLException.class, stmt::step);
+    assertThrows(SQLException.class, () -> stmt.bindLong(1, 1));
+    assertThrows(SQLException.class, stmt::initializeColumnMetadata);
+    assertThrows(SQLException.class, stmt::parameterCount);
+    assertThrows(SQLException.class, stmt::reset);
+  }
+
   @Test
   void test_initializeColumnMetadata() throws Exception {
     runSql("CREATE TABLE users (name TEXT, age INT, country TEXT);");
```

---

### Incident Patch 15: `2ad9bf4f` (2026-09-28)
**Commit Message**: Merge 'github: raise napi build job timeout to 30 minutes' from Pekka Enberg

The \`sync-bindings-aarch64-unknown-linux-gnu\` job in \`napi.yml\` was
cancelled at the 20-minute timeout while still compiling
\`turso_sync_engine\` (e.g. [run 36434964922](https://github.com/tursoda
tabase/turso/actions/runs/36434964922/job/108970382289) on #9398). No
build or test error was involved.

Why it gets close to the limit:
- It runs on \`blacksmith-2vcpu-ubuntu-2404-arm\`. A cold build takes
about 13 minutes, and one with a warm cache about 9.
- The repository's Actions cache usage is about 11.2 GB, above GitHub's
default 10 GB limit. Caches are evicted within a few hours, so PRs often
build from scratch.
- On a slow runner, \`turso_core\` alone took about 5.5 minutes instead
of about 2.5, which pushed the cold build past 20 minutes.

This PR raises the \`build\` job's \`timeout-minutes\` from 20 to 30 so
cold builds on slow runners can finish.

Reviewed-by: Mikaël Francoeur (@LeMikaelF)

Closes #9402

**File**: `.github/workflows/napi.yml` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ concurrency:
 
 jobs:
   build:
-    timeout-minutes: 20
+    timeout-minutes: 30
     strategy:
       fail-fast: false
       matrix:
```

#### Recent Merged Pull Requests:
- **PR #9514** (2026-10-05): core: Shrink expression parsing and translation stack usage (@jussisaurio)
- **PR #9496** (2026-10-05): postgres/sqltest: connect each test to the tursopg server it started (@penberg)
- **PR #9494** (2026-10-05): bindings/tcl: register the csv module for the upstream csv01 test (@puang59)
- **PR #9482** (closed): core/mvcc: close the internal transaction left open by journal_mode bootstrap (@pauliquib)
- **PR #9481** (closed): core/vdbe: check argument counts in array scalar functions (@pauliquib)
- **PR #9480** (closed): core/vdbe: make array text form round-trip through dump and vacuum (@pauliquib)
- **PR #9479** (closed): core/translate: check main schema for dependent views in whole-table DELETE (@pauliquib)
- **PR #9476** (closed): core/translate: keep first duplicate row in ordered compound selects (@pauliquib)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
