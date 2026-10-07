# Forensic Learning Record (Deep Inspection): tursodatabase/turso

> **Canonical Artifact**: `07_PROJECT_LEARNING/tursodatabase-limbo-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tursodatabase/limbo](https://github.com/tursodatabase/limbo))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-07T21:23:11.207Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tursodatabase/turso`
- **Description**: A SQL database in Rust: SQLite-compatible, now also speaking Postgres (experimental). The LLVM of databases.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md
- **Stars / Engagement**: 24674 stars

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
- **Issue #9623** (2026-10-07): **A LATERAL subquery cannot see a CTE when a FROM item to its left has the same name**
  *Symptoms*: ## Description  A LATERAL subquery must find a CTE by its name. If a FROM item to the left of the LATERAL subquery has the same name (for example, the alias of a table), Turso does not find the CTE. Then Turso reads the schema table with that name, or it gives "no such table".  This bug exists only with [tursodatabase/turso#9468](https://github.com/tursodatabase/turso/pull/9468), because `main` has no LATERAL.  ## Reproducer  ```sql CREATE TABLE t1(a INT); CREATE TABLE t2(b INT, c TEXT); INSERT INTO t1 VALUES (1), (2), (3); INSERT INTO t2 VALUES (1, 'x'), (2, 'y'), (2, 'z'), (3, 'w');  WITH t2 AS (SELECT 100 AS b, 'cte' AS c) SELECT t2.a, s.c FROM t1 AS t2, LATERAL (SELECT c FROM t2) s ORDER BY 1, 2; -- PostgreSQL 16: 1|cte, 2|cte, 3|cte -- Turso:         12 rows from the table t2: 1|w, 1|x, 1|y, 1|z, 2|w, ..., 3|z  WITH c AS (SELECT 42 AS z) SELECT c.a, s.z FROM t1 AS c, LATERAL (SELECT z FROM c) s; -- PostgreSQL 16: 1|42, 2|42, 3|42 -- Turso:         Parse error: no such table: c ```  The same names work in other forms:  ```sql WITH c AS (SELECT 42 AS z) SELECT c.a, (SELECT z FROM c) FROM t1 AS c; -- Turso: 1|42, 2|42, 3|42 (correct)  WITH c AS (SELECT 42 AS z) SELECT c.a, s.z FROM t1 AS c, (SELECT z FROM c) s; -- Turso: 1|42, 2|42, 3|42 (correct) ```  Turso debug build of the PR branch `claude/kind-brahmagupta-iddyg0` at `815de676c`.  ## Suspected cause  In `core/translate/planner.rs` (lines 1613-1633 on the branch), a LATERAL subquery gets the FROM items to its left as ou

- **Issue #9569** (2026-10-07): **core/mvcc: keep the index map of a rolled-back CREATE INDEX alive for open cursors**
  *Symptoms*: Rolling back a transaction that created an index freed the index's row map while cursors could still point into it:      BEGIN;     CREATE INDEX i ON t(b);     -- step once and keep the statement open:     SELECT b FROM t INDEXED BY i WHERE b > 0;     ROLLBACK;     -- step the SELECT again: reads freed memory  ASan reports a heap-use-after-free in RefRange::next (from op_next). Resetting a held `INSERT OR ROLLBACK` into a table created in the same transaction hits the same freed map in RefRange::drop_impl (from ProgramState::reset).  ## Cause  MVCC cursors iterate one index's map, which is a value inside `MvStore.index_rows`. They make the iterator `'static` with `static_iterator_hack!`, whose safety argument is that the map lives as long as the store:      // cursor.rs     let index_rows = db.index_rows.get(&table_id);    // guard dropped right after     let iter = index_rows.value().range(..);           // borrows the inner map     static_iterator_hack!(iter, ..)                     // now 'static  9bb9a9e52a made rollback remove that inner map:      fn drop_created_btree(&self, table_id: MVTableId) {         if let Some(index) = self.index_rows.get(&table_id) {             self.bump_index_rows_epoch();             index.remove();          // inner map is freed once the node is reclaimed         }         ...     }  No other code removes an inner map, so this was the only break of that rule. Removing slots from `rows` in the same function is fine: cursors iterate `rows` its

- **Issue #9566** (2026-10-07): **core/json: propagate errors from json_remove, json_insert and json_replace**
  *Symptoms*: ## Description  `json_remove`, `json_insert`, `json_replace` and their `jsonb_` variants caught every error and returned NULL. The six arms in `op_function` now return the error, the same way `json_set` and `json_patch` already do.  One existing test changed. `jsonb-oversized-child-remove` runs `json_remove` on a malformed JSONB blob and expected NULL. It now expects `malformed JSON`, which is what `json_set` already returns for the same blob. The test is still there to make sure that blob does not crash the engine.  New cases are in `json-mutators-propagate-errors.sqltest`: bad path and malformed JSON for all six functions, the UPDATE data-loss case, and valid-path calls that must keep working. 13 of the 16 fail without the change; the other 3 check that valid calls still work.  ## Motivation and context  Fixes #9502.  A bad path (`json_remove('{"a":1}', 'a')`) or malformed JSON (`json_insert('not json', '$.x', 1)`) gave NULL where SQLite raises an error. In an UPDATE this meant `UPDATE docs SET body = json_remove(body, 'tmp')` set the column to NULL and lost the original data.  ## Description of AI Usage  This PR was written with Claude Code (Claude Sonnet 5.5), working from the issue at the direction of the PR author. Claude found the six arms in `op_function`, wrote the fix and the new tests, updated the existing test, and ran the sqltest corpora and the JSON integration tests locally. The new tests were confirmed to fail without the change and pass with i
  **Post-Mortem & Fix Analysis**:
  > @claude review
  > **Claude finished @penberg's task in 6m 4s** —— [View job](https://github.com/tursodatabase/turso/actions/runs/37605938806)  --- ### Code Review: PR #9566  **Summary:** This is a clean, well-structured fix. Approved.  ---  #### Changes Reviewed  **`core/vdbe/execute.rs`** (+18/-36)  The fix replaces error-swallowing patterns in 6 JSON function arms: ```rust // Before: errors silently become NULL if let Ok(json) = json_remove(...) {     state.registers[*dest].set_value(json); } else {     state.registers[*dest].set_null();  // data loss on UPDATE }  // After: errors propagate correctly let json = json_remove(...)?; state.registers[*dest].set_value(json); ```  This is consistent with how `json_patch` (line 9965) already handles errors. The code is more concise and idiomatic.  **`json/default.sqltest`** (+2/-1)  Updated `jsonb-oversized-child-remove` to expect `malformed JSON` error instead of empty result. This matches the fix behavior and is consistent with what `json_set` returns for t

- **Issue #9565** (2026-10-07): **ci: run core and integration tests with AddressSanitizer**
  *Symptoms*: ## Description  Adds an `AddressSanitizer` workflow. It builds the `turso_core` and `core_tester` tests with `-Zsanitizer=address` on the pinned nightly toolchain (`nightly-2025-12-17`, the same as the other nightly jobs). nextest runs each test in its own process, so one error does not hide the others.  - `--target x86_64-unknown-linux-gnu` keeps `RUSTFLAGS` away from build scripts and proc macros. - `detect_leaks=0`: this job looks for memory errors, not leaks. Some tests leak small allocations at exit. - `allocator_may_return_null=1`: some tests request an impossible allocation size to test the out-of-memory path. Without this option, AddressSanitizer stops the process instead of returning null. - The job installs the `llvm` package to get `llvm-symbolizer`. Without it, the reports show addresses instead of function names. - The test filter is the same as in the main test job. The fuzz test binaries run in their own workflow.  `core_tester` now depends on `turso` without default features and keeps `fts`. The default `mimalloc` feature made mimalloc the global allocator of the integration test binary. AddressSanitizer replaces only the system allocator, so it could not see the heap memory of the integration tests. The workspace test job does not change: with `--workspace --all-features`, Cargo still enables mimalloc for `turso`.  ## Tests  Eleven tests come with the job, because the job finds a memory error only in code that a test reaches.  Two MVCC unit tests keep a state
  **Post-Mortem & Fix Analysis**:
  > <!-- __CODSPEED_PERFORMANCE_REPORT_COMMENT__ --> ## Merging this PR will **degrade performance by 21.58%**  <details> <summary>:warning: <b>1 benchmark measured no execution time</b></summary>  > Nothing ran under measurement, usually because the compiler removed the code under test. This result is not comparable, so it counts as unchanged. > > [Preventing compiler optimizations](https://codspeed.io/docs/troubleshooting?utm_source=github&utm_medium=comment-v2&utm_content=optimized_out_docs#optimized-out-benchmarks)  </details> <details> <summary>:warning: <b>Different runtime environments detected</b></summary>  > Some benchmarks with significant performance changes were compared across different runtime environments, > which may affect the accuracy of the results. > > [Open the report in CodSpeed to investigate](https://app.codspeed.io/tursodatabase/turso/branches/claude%2Fgifted-bardeen-k5mbae?utm_source=github&utm_medium=comment-v2&utm_content=comparison_issues)  </details>  `❌ 1` r
  > Ideally, we would run the simulator, whopper, all fuzzers, and every test suite with ASan, but I don't want to pollute CI.

- **Issue #9561** (2026-10-06): **docs: make test evidence mandatory for every change**
  *Symptoms*: # NOTICE: <!-- In order to streamline the contribution process, please check the "allow edits from maintainers" checkbox on your PR. If needed, this allows us to push tweaks to your PR and avoid a potentially lengthy back-and-forth. Your original commits will stay on the branch, and you will keep authorship of those commits. -->  The maintainer-edit checkbox does not apply to this same-repository feature branch. GitHub only supports that option for fork-based pull requests.  ## Description  Make the testing rule in `AGENTS.md` explicitly mandatory, with no exceptions. Require a test that fails without the change and passes with it, execution in both cases, and evidence of both results before declaring completion. If testing is blocked, require reporting the blocker and leaving the change incomplete.  Validation: `git diff --check` passed. No runtime tests were run because this change only updates agent instructions.  ## Motivation and context  The existing rule states that every change needs a test but does not explicitly prohibit skipping it. The requested wording makes the requirement mandatory and defines the evidence needed for completion.  ## Description of AI Usage  Amp drafted the stronger instruction at the user’s request, checked the diff, and prepared this commit and pull request. This documentation change was mainly produced by AI.  Amp thread: https://ampcode.com/threads/T-01a112a0-588d-73b9-94c0-0b53781f4cbf 

- **Issue #9558** (2026-10-06): **core: register dialect native extensions at open**
  *Symptoms*: # NOTICE: <!-- In order to streamline the contribution process, please check the "allow edits from maintainers" checkbox on your PR. If needed, this allows us to push tweaks to your PR and avoid a potentially lengthy back-and-forth. Your original commits will stay on the branch, and you will keep authorship of those commits. -->  ## Description  A SQL dialect defines the rules for SQL. `OpenOptions::new` now asks the dialect to add its native extensions. The default method returns the configuration unchanged.  `ATTACH`, `TEMP`, and `VACUUM` use the source database's dialect when they construct `OpenOptions`. These paths receive the dialect's native modules before database initialization and stored view parsing. The PostgreSQL implementation remains in #9545.  The following block is pseudocode, not exact Rust.  ```text OpenOptions.new(dialect):     options = default_open_options(dialect)     return dialect.register_native_extensions(options)  Dialect.register_native_extensions(options):     return options  open_secondary_database(source_database):     options = OpenOptions.new(source_database.dialect)     return Database.open(..., options) ```  The existing core dialect tests now use a native catalog fixture instead of an internal virtual table. No new test is needed.  With that native fixture, the existing TEMP test fails with `no such table: temp.test_catalog` when the registration call is disabled. It passes with the call. This test covers both MEMORY and FILE TEMP storage.

- **Issue #9557** (2026-10-07): **core/vdbe: roll back TEMP pager savepoints under MVCC**
  *Symptoms*: ## Problem statement  With `PRAGMA journal_mode = 'mvcc'`, a failed statement inside an explicit transaction left rows it had already written to TEMP tables. SQLite undoes the whole statement. TEMP has no MvStore. The engine opened a pager savepoint for TEMP, then `end_statement` only closed MvStore savepoints.  ## Changes  `end_statement` now releases and rolls back those TEMP pager savepoints when the main database uses MVCC. Tests cover a UNIQUE abort on TEMP, a TEMP trigger that writes main, and a successful TEMP write that must survive a later statement abort.  Fixes: https://github.com/tursodatabase/turso/issues/9540

- **Issue #9556** (2026-10-06): **core: preserve table functions before parsing stored views**
  *Symptoms*: # NOTICE: <!-- In order to streamline the contribution process, please check the "allow edits from maintainers" checkbox on your PR. If needed, this allows us to push tweaks to your PR and avoid a potentially lengthy back-and-forth. Your original commits will stay on the branch, and you will keep authorship of those commits. -->  ## Description  A schema stores definitions of tables and views. A table-valued function returns rows like a table. These functions are registered in code, so reading `sqlite_schema` does not restore them.  Database open adds these function definitions to the initial schema. The engine also creates fresh schemas later, for example after another connection changes tables or views. Recovery and checkpoint reconstruction also create fresh schemas.  These rebuilds read stored tables and views from `sqlite_schema`. The registered modules remain available, but their function definitions are not stored in that table. Copying the definitions into a fresh schema does not load or register the extensions again.  Schema rebuilds now copy the function definitions before they parse stored views. This applies to WAL refresh, MVCC recovery, and checkpoint snapshots. Empty TEMP schemas also copy the registered functions before lookup and after rollback.  The copy keeps an existing entry when its name already exists. A checkpoint still loads stored tables and views from its selected snapshot rows. It does not copy current stored objects into an older snapshot.  The fo

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

### Incident Patch 1: `295bcc51` (2026-10-07)
**Commit Message**: core: give repeated subquery column names a :N suffix

SQLite names the output columns of a FROM-clause subquery or CTE so that each
name is unique: `SELECT a, a` has the columns `a` and `a:1`. Turso kept both
as `a`, so `q."a:1"` did not resolve, and USING or NATURAL treated every copy
as the join column. With a RIGHT or FULL JOIN this changed results:

  -- t(a, b, c) holds the row (1, NULL, 'x')
  SELECT * FROM (SELECT a, a FROM t WHERE 0) AS q RIGHT JOIN t AS z USING (a);
  -- SQLite: 1|NULL|NULL|x, because q's second column a:1 is NULL
  -- Turso:  1|1|NULL|x, because it filled q's second a with z.a too

Subquery and CTE columns now get the same suffixes. A parenthesized join
keeps its raw names, because it marks repeated join columns itself.

**File**: `core/translate/plan.rs` (modified, +39/-35)
```diff
@@ -3088,6 +3088,40 @@ pub(super) fn query_output_columns(
     Ok(columns)
 }
 
+fn subquery_output_columns(
+    plan: &Plan,
+    explicit_columns: Option<&[String]>,
+) -> Result<alloc::Vec<Column>> {
+    let mut columns = query_output_columns(plan, explicit_columns)?;
+    make_column_names_unique(&mut columns);
+    Ok(columns)
+}
+
+fn make_column_names_unique(columns: &mut [Column]) {
+    let mut used_names: rustc_hash::FxHashSet<String> = rustc_hash::FxHashSet::default();
+    for column in columns {
+        let Some(name) = column.name.clone() else {
+            continue;
+        };
+        let base_name = strip_numbered_suffix(&name);
+        let mut candidate = name.clone();
+        let mut count = 0;
+        while !used_names.insert(candidate.to_lowercase()) {
+            count += 1;
+            candidate = format!("{base_name}:{count}");
+        }
+        column.name = Some(candidate);
+    }
+}
+
+fn strip_numbered_suffix(name: &str) -> &str {
+    let without_digits = name.trim_end_matches(|c: char| c.is_ascii_digit());
+    match without_digits.strip_suffix(':') {
+        Some(base_name) if !base_name.is_empty() => base_name,
+        _ => name,
+    }
+}
+
 impl JoinedTable {
     /// Returns the btree table for this table reference, if it is a BTreeTable.
     pub fn btree(&self) -> Option<Arc<BTreeTable>> {
@@ -3116,42 +3150,12 @@ impl JoinedTable {
         join_info: Option<JoinInfo>,
         internal_id: TableInternalId,
     ) -> Result<Self> {
-        let mut columns = plan
-            .result_columns
-            .iter()
-            .map(|rc| {
-                let affinity = infer_type_from_expr(&rc.expr, Some(&plan.table_references));
-                let col_type = affinity.to_type();
-                let mut column = Column::new(
-                    rc.name(&plan.table_references).map(String::from),
-                    col_type.to_string(),
-                    None,
-                    None,
-                    col_type,
-                    None,
-                    ColDef::default(),
-                );
-                column.override_affinity(affinity);
-                column
-            })
-            .try_collect::<alloc::Vec<_>>()?;
-
-        for (i, column) in columns.iter_mut().enumerate() {
-            if super::expr::expr_is_array(
-                &plan.result_columns[i].expr,
-                Some(&plan.table_references),
-            ) {
-                column.set_array_dimensions(1);
-            }
-            column.set_collation(get_collseq_from_expr(
-                &plan.result_columns[i].expr,
-                &plan.table_references,
-            )?);
-        }
+        let plan = Plan::Select(Box::new(plan));
+        let columns = subquery_output_columns(&plan, None)?;
 
         let table = Table::FromClauseSubquery(Arc::new(FromClauseSubquery {
             name: identifier.clone(),
-            plan: Box::new(Plan::Select(Box::new(plan))),
+            plan: Box::new(plan),
             columns,
             parenthesized_join_columns: None,
             result_columns_start_reg: None,
@@ -3188,7 +3192,7 @@ impl JoinedTable {
         cte_id: Option<usize>,
         materialize_hint: bool,
     ) -> Result<Self> {
-        let columns = query_output_columns(&plan, explicit_columns)?;
+        let columns = subquery_output_columns(&plan, explicit_columns)?;
         // Get result columns and table references from the plan
         // materialize_hint is set true for explicit WITH ... AS MATERIALIZED hint.
         // Multi-reference CTEs are also detected at emission time via reference counting,
@@ -3229,7 +3233,7 @@ impl JoinedTable {
         internal_id: TableInternalId,
         explicit_columns: Option<&[String]>,
     ) -> Result<Self> {
-        let mut columns = query_output_columns(query, explicit_columns)?;
+        let mut columns = subquery_output_columns(query, explicit_columns)?;
         // The recursive self-reference reads SQLite's queue table, whose
         // columns have no declared type: comparisons in the recursive term
         // see the stored value without the anchor query's affinity. Only the
```

**File**: `sqlite/conformance/sqlite-sqltests/right-full-join-sqlite.sqltest` (modified, +29/-0)
```diff
@@ -2641,3 +2641,32 @@ matrix right-and-full-join-key-affinity-and-collation {
     SELECT l.rowid, r.rowid FROM $l AS l $j $r AS r ON l.k = r.k $c
      ORDER BY l.rowid NULLS FIRST, r.rowid NULLS FIRST;
 }
+
+@cross-check-integrity
+test using-joins-only-the-first-of-two-subquery-columns-with-the-same-name {
+    CREATE TABLE t(a INTEGER PRIMARY KEY, b REAL, c);
+    INSERT INTO t VALUES (1, NULL, 'x');
+
+    SELECT q."a:1" FROM (SELECT a, a FROM t) AS q;
+    SELECT * FROM (SELECT a, a FROM t WHERE 0) AS q FULL JOIN t AS z USING (a);
+    SELECT * FROM (SELECT a, a FROM t WHERE 0) AS q RIGHT JOIN t AS z USING (a);
+    SELECT q.* FROM (SELECT a, a FROM t WHERE 0) AS q FULL JOIN t AS z USING (a);
+    WITH q AS (SELECT * FROM t JOIN t AS w ON 1)
+    SELECT * FROM q NATURAL FULL JOIN t AS z ORDER BY 4;
+    CREATE TABLE n1(c0 INT);
+    CREATE TABLE n2(c0 BLOB);
+    CREATE TABLE n3(c0 BLOB);
+    CREATE TABLE n4(c4 BLOB);
+    INSERT INTO n1 VALUES (0);
+    INSERT INTO n3 VALUES ('0');
+    SELECT * FROM (n1 NATURAL LEFT JOIN n2 NATURAL JOIN n3) AS g FULL JOIN n4 ON true;
+}
+expect {
+    1
+    1|||x
+    1|||x
+    1|
+    1||x|||
+    1||x|1||x
+    0|
+}
```

**File**: `sqlite/conformance/upstream/all.test` (modified, +1/-1)
```diff
@@ -214,7 +214,7 @@ set test_files {
   e_reindex            fail
   e_resolve            fail
   e_select             fail
-  e_select2            fail
+  e_select2            pass
   e_totalchanges       fail
   e_update             fail
   e_uri                fail
```

---

### Incident Patch 2: `c843a84e` (2026-10-07)
**Commit Message**: core: rebuild an IN list that reads an earlier table for each row

An IN search fills an ephemeral index with the list values once per
statement. When a value reads an earlier table in the join, as in

  SELECT b.id, c.id FROM t AS b JOIN t AS c WHERE c.id IN (b.id)

every later row of b reused the list built for the first row and found the
wrong rows of c. The unmatched-row pass of a FULL JOIN hit the same problem:
it reused the list built when b was the NULL row.

As in SQLite's sqlite3CodeRhsOfIN, the list is built once only when every
value is constant. Otherwise it is rebuilt each time the loop reaches it;
opening the ephemeral cursor again clears the previous values.

**File**: `core/translate/main_loop/in_seek.rs` (modified, +12/-5)
```diff
@@ -94,10 +94,15 @@ pub(super) fn open_in_seek_source_cursor(
 ) -> Result<CursorID> {
     match source {
         InSeekSource::LiteralList { values, affinity } => {
-            let label_once_end = program.allocate_label();
-            program.emit_insn(Insn::Once {
-                target_pc_when_reentered: label_once_end,
-            });
+            let label_once_end = if values.iter().all(|value| value.is_constant(resolver)) {
+                let label_once_end = program.allocate_label();
+                program.emit_insn(Insn::Once {
+                    target_pc_when_reentered: label_once_end,
+                });
+                Some(label_once_end)
+            } else {
+                None
+            };
             let collation = index
                 .as_ref()
                 .and_then(|idx| idx.columns.first())
@@ -154,7 +159,9 @@ pub(super) fn open_in_seek_source_cursor(
                     flags: IdxInsertFlags::new().no_op_duplicate(),
                 });
             }
-            program.preassign_label_to_next_insn(label_once_end);
+            if let Some(label_once_end) = label_once_end {
+                program.preassign_label_to_next_insn(label_once_end);
+            }
             Ok(eph_cursor)
         }
         InSeekSource::Subquery { cursor_id } => Ok(*cursor_id),
```

**File**: `sqlite/conformance/sqlite-sqltests/in-index-seek.sqltest` (modified, +28/-0)
```diff
@@ -992,3 +992,31 @@ test in-cross-table-column-ref {
 expect {
     1
 }
+
+test in-list-of-an-earlier-table-column-is-rebuilt-for-each-row {
+    CREATE TABLE tr(id INTEGER PRIMARY KEY, v INT);
+    CREATE INDEX tr_v ON tr(v);
+    INSERT INTO tr VALUES (5, 50), (6, 60), (7, 70);
+
+    SELECT b.id, c.id FROM tr AS b JOIN tr AS c WHERE c.id IN (b.id) ORDER BY 1, 2;
+    SELECT b.id, c.id FROM tr AS b JOIN tr AS c WHERE c.v IN (b.v, 70) ORDER BY 1, 2;
+    SELECT a.id, b.id, c.id
+      FROM tr AS a
+      FULL JOIN tr AS b ON 0
+      JOIN tr AS c
+     WHERE c.id IN (b.id) AND a.id IS NULL
+     ORDER BY 2;
+}
+expect {
+    5|5
+    6|6
+    7|7
+    5|5
+    5|7
+    6|6
+    6|7
+    7|7
+    |5|5
+    |6|6
+    |7|7
+}
```

---

### Incident Patch 3: `5ec19912` (2026-10-06)
**Commit Message**: core: skip the automatic-index build for an empty table

When Rewind found no rows, the automatic-index build loop jumped to its own
first instruction instead of past the loop. It then read NULL columns and a
NULL rowid from the empty table and inserted that record. A seek on a NULL
key, such as the one from `k.w IS NULL`, found the record and joined a row
from the empty table:

  SELECT 'row' FROM p JOIN k ON p.id IS NOT k.t WHERE k.w IS NULL;
  -- k is empty; SQLite returns no rows, Turso returned one

Jump to the end of the build when the table is empty.

Tests: join-empty-table-ungrouped-aggregate.sqltest (fails without the fix)

**File**: `core/translate/main_loop/close.rs` (modified, +1/-1)
```diff
@@ -505,7 +505,7 @@ pub(super) fn emit_autoindex(
     let label_ephemeral_build_loop_start = program.allocate_label();
     program.emit_insn(Insn::Rewind {
         cursor_id: table_cursor_id,
-        pc_if_empty: label_ephemeral_build_loop_start,
+        pc_if_empty: label_ephemeral_build_end,
     });
     program.preassign_label_to_next_insn(label_ephemeral_build_loop_start);
     let label_ephemeral_build_loop_next = program.allocate_label();
```

**File**: `sqlite/conformance/sqlite-sqltests/join-empty-table-ungrouped-aggregate.sqltest` (modified, +25/-0)
```diff
@@ -75,3 +75,28 @@ test inner-join-populated-ungrouped-aggregate {
 expect {
     1|2
 }
+
+# An automatic index built over an empty table must stay empty. The build loop
+# used to jump into its own body when Rewind found no rows, so it inserted one
+# record of NULL columns. A seek on the NULL key from `k.w IS NULL` then found
+# that record and produced a row from the empty table.
+setup empty-autoindex-source {
+    CREATE TABLE p(id INT);
+    CREATE TABLE k(w, t);
+    INSERT INTO p VALUES (1);
+}
+
+@setup empty-autoindex-source
+test autoindex-over-empty-table-adds-no-rows {
+    SELECT 'row' FROM p JOIN k ON p.id IS NOT k.t WHERE k.w IS NULL;
+}
+expect {
+}
+
+@setup empty-autoindex-source
+test autoindex-over-empty-table-null-key-seek {
+    SELECT count(*) FROM p JOIN k ON p.id != k.t WHERE k.w IS NULL;
+}
+expect {
+    0
+}
```

**File**: `sqlite/conformance/sqlite-sqltests/snapshot_tests/analyze/snapshots/analyze__join-aggregate-after-analyze.snap` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ addr  opcode                    p1  p2  p3  p4            p5  comment
    7          Rewind             0  39   0                 0  Rewind table customers
    8            Once            17   0   0                 0  goto 17
    9            OpenAutoindex    2   0   0                 0  cursor=2
-  10            Rewind           1  11   0                 0  Rewind table purchases
+  10            Rewind           1  17   0                 0  Rewind table purchases
   11              ColumnRange    1   1  17  2              0  r[17..18]=purchases.customer_id..amount
   12              RowId          1  19   0                 0  r[19]=purchases.rowid
   13              MakeRecord    17   3  20                 0  r[20]=mkrec(r[17..19]); for ephemeral_purchases_t2
```

**File**: `sqlite/conformance/sqlite-sqltests/snapshot_tests/indexes/snapshots/indexes__unordered-correlated-max-materialized-cte-bytecode.snap` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ addr  opcode               p1  p2  p3  p4           p5  comment
   20      IfNot            14  42   0                0  if !r[14] goto 42
   21      Once             29   0   0                0  goto 29
   22      OpenAutoindex     3   0   0                0  cursor=3
-  23      Rewind            2  24   0                0  Rewind  ephemeral()
+  23      Rewind            2  29   0                0  Rewind  ephemeral()
   24        Column          2   0  15                0  r[15]=ephemeral().price
   25        RowId           2  16   0                0  r[16]=ephemeral().rowid
   26        MakeRecord     15   2  17                0  r[17]=mkrec(r[15..16]); for ephemeral_subquery_t7
```

**File**: `sqlite/conformance/sqlite-sqltests/snapshot_tests/joins/snapshots/joins__correlated-parenthesized-join-keeps-result-expressions.snap` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ addr  opcode                p1  p2  p3  p4        p5  comment
    8      Rewind             3  32   0             0  Rewind table nested_prune_right
    9        Once            18   0   0             0  goto 18
   10        OpenAutoindex    2   0   0             0  cursor=2
-  11        Rewind           1  12   0             0  Rewind table nested_prune_left
+  11        Rewind           1  18   0             0  Rewind table nested_prune_left
   12          ColumnRange    1   0  11  2          0  r[11..12]=nested_prune_left.id..value
   13          RowId          1  13   0             0  r[13]=nested_prune_left.rowid
   14          MakeRecord    11   3  14             0  r[14]=mkrec(r[11..13]); for ephemeral_nested_prune_left_t4
```

**File**: `sqlite/conformance/sqlite-sqltests/snapshot_tests/joins/snapshots/joins__cross-join-with-filter.snap` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ addr  opcode            p1  p2  p3  p4              p5  comment
    5    Ne               5   6  28  Binary           0  if r[5]!=r[6] goto 28
    6    Once            19   0   0                   0  goto 19
    7    OpenAutoindex    2   0   0                   0  cursor=2
-   8    Rewind           1   9   0                   0  Rewind table products
+   8    Rewind           1  19   0                   0  Rewind table products
    9      Column         1   2   8                   0  r[8]=products.category
   10      Ne             8   9  18  Binary           0  if r[8]!=r[9] goto 18
   11      Column         1   2  10                   0  r[10]=products.category
```

**File**: `sqlite/conformance/sqlite-sqltests/snapshot_tests/joins/snapshots/joins__hash-join-three-table.snap` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ addr  opcode              p1  p2  p3  p4
   19    HashProbe          1   7   1  r[12]=42 payload=r[8]..r[9]                0
   20    Once              29   0   0                                             0  goto 29
   21    OpenAutoindex      3   0   0                                             0  cursor=3
-  22    Rewind             2  23   0                                             0  Rewind table h_returns
+  22    Rewind             2  29   0                                             0  Rewind table h_returns
   23      ColumnRange      2   1  13  2                                          0  r[13..14]=h_returns.order_name..reason
   24      RowId            2  15   0                                             0  r[15]=h_returns.rowid
   25      MakeRecord      13   3  16                                             0  r[16]=mkrec(r[13..15]); for ephemeral_h_returns_t3
```

**File**: `sqlite/conformance/sqlite-sqltests/snapshot_tests/joins/snapshots/joins__parenthesized-join-keeps-used-rowid.snap` (modified, +2/-2)
```diff
@@ -28,7 +28,7 @@ addr  opcode            p1  p2  p3  p4        p5  comment
    4  Rewind             0  31   0             0  Rewind table nested_prune_left
    5    Once            14   0   0             0  goto 14
    6    OpenAutoindex    2   0   0             0  cursor=2
-   7    Rewind           1   8   0             0  Rewind table nested_prune_right
+   7    Rewind           1  14   0             0  Rewind table nested_prune_right
    8      ColumnRange    1   0   9  2          0  r[9..10]=nested_prune_right.id..value
    9      RowId          1  11   0             0  r[11]=nested_prune_right.rowid
   10      MakeRecord     9   3  12             0  r[12]=mkrec(r[9..11]); for ephemeral_nested_prune_right_t3
@@ -58,7 +58,7 @@ addr  opcode            p1  p2  p3  p4        p5  comment
   34    Yield            1  55   0             0
   35    Once            44   0   0             0  goto 44
   36    OpenAutoindex    4   0   0             0  cursor=4
-  37    Rewind           3  38   0             0  Rewind table nested_prune_outer
+  37    Rewind           3  44   0             0  Rewind table nested_prune_outer
   38      Column         3   0  15             0  r[15]=nested_prune_outer.id
   39      RowId          3  16   0             0  r[16]=nested_prune_outer.rowid
   40      MakeRecord    15   2  17             0  r[17]=mkrec(r[15..16]); for ephemeral_nested_prune_outer_t1
```

---

### Incident Patch 4: `ef92cb2f` (2026-10-06)
**Commit Message**: core: include SQL schema regressions and the restored flag comment

Keep the schema review changes in their parent PR without rewriting published commits.

Amp-Thread-ID: https://ampcode.com/threads/T-01a10d81-8a8e-720c-bd49-09b1f4871e6b

**File**: `core/vdbe/native_extension_tests.rs` (modified, +20/-37)
```diff
@@ -731,7 +731,7 @@ fn native_table_functions_survive_mvcc_schema_refresh_and_other_connection_ddl()
 }
 
 #[test]
-fn native_table_function_view_columns_survive_refresh_reopen_and_checkpoint() {
+fn native_table_function_views_survive_checkpoint_and_reopen() {
     for mvcc in [false, true] {
         let io = Arc::new(MemoryIO::new());
         let path = format!("native-view-{mvcc}.db");
@@ -774,34 +774,25 @@ fn native_table_function_view_columns_survive_refresh_reopen_and_checkpoint() {
             }
             conn.execute("CREATE VIEW native_view AS SELECT * FROM native_rows(8)")
                 .unwrap();
-            conn.execute(
-                "CREATE VIEW native_join AS WITH existing AS (SELECT value FROM native_view WHERE value > 10) SELECT existing.value FROM existing JOIN native_rows USING(value)",
-            )
-            .unwrap();
             assert_eq!(columns(&conn), expected_columns);
-            conn.force_reparse_schema_without_publish().unwrap();
+            conn.execute("PRAGMA wal_checkpoint(TRUNCATE)").unwrap();
             assert_eq!(columns(&conn), expected_columns);
-            let mut stmt = conn
-                .prepare("SELECT value FROM native_view ORDER BY value")
-                .unwrap();
-            assert_eq!(
-                collect(&mut stmt, &queue),
-                vec![vec![Value::from_i64(9)], vec![Value::from_i64(17)]]
-            );
         }
         let db = open();
         let conn = db.connect().unwrap();
         assert_eq!(columns(&conn), expected_columns);
-        conn.execute("PRAGMA wal_checkpoint(TRUNCATE)").unwrap();
-        conn.force_reparse_schema_without_publish().unwrap();
-        assert_eq!(columns(&conn), expected_columns);
-        let mut stmt = conn.prepare("SELECT value FROM native_join").unwrap();
-        assert_eq!(collect(&mut stmt, &queue), vec![vec![Value::from_i64(17)]]);
+        let mut stmt = conn
+            .prepare("SELECT value FROM native_view ORDER BY value")
+            .unwrap();
+        assert_eq!(
+            collect(&mut stmt, &queue),
+            vec![vec![Value::from_i64(9)], vec![Value::from_i64(17)]]
+        );
     }
 }
 
 #[test]
-fn native_table_functions_remain_in_empty_temp_schema_after_rollback() {
+fn native_table_functions_survive_temp_table_rollback() {
     let queue = Arc::new(Mutex::new(Vec::new()));
     let conn = connection(OpenOptions::new(Arc::new(SqliteDialect)).native_module(
         "native_rows",
@@ -813,24 +804,16 @@ fn native_table_functions_remain_in_empty_temp_schema_after_rollback() {
             writable: false,
         },
     ));
-    for (sql, expected) in [
-        (
-            "SELECT value FROM temp.native_rows(8)",
-            vec![vec![Value::from_i64(9)], vec![Value::from_i64(17)]],
-        ),
-        (
-            "SELECT value FROM temp.native_rows(16)",
-            vec![vec![Value::from_i64(17)]],
-        ),
-    ] {
-        let mut stmt = conn.prepare(sql).unwrap();
-        assert_eq!(collect(&mut stmt, &queue), expected);
-        conn.execute("BEGIN").unwrap();
-        conn.execute("CREATE TEMP TABLE temp_values(value)")
-            .unwrap();
-        conn.execute("ROLLBACK").unwrap();
-        assert!(conn.empty_temp_schema().get_table("native_rows").is_some());
-    }
+    let sql = "SELECT value FROM temp.native_rows(8)";
+    let expected = vec![vec![Value::from_i64(9)], vec![Value::from_i64(17)]];
+    let mut stmt = conn.prepare(sql).unwrap();
+    assert_eq!(collect(&mut stmt, &queue), expected);
+    conn.execute("BEGIN").unwrap();
+    conn.execute("CREATE TEMP TABLE temp_values(value)")
+        .unwrap();
+    conn.execute("ROLLBACK").unwrap();
+    let mut stmt = conn.prepare(sql).unwrap();
+    assert_eq!(collect(&mut stmt, &queue), expected);
 }
 
 #[test]
```

**File**: `core/vtab.rs` (modified, +2/-2)
```diff
@@ -27,8 +27,8 @@ pub struct VirtualTable {
     pub(crate) vtab_id: u64,
     /// Whether `DROP TABLE` may remove this table from its schema.
     pub(crate) is_droppable: bool,
-    /// Whether triggers can read this virtual table.
-    /// This permission does not allow writes from triggers.
+    // Whether this virtual table is safe to use from within triggers and views.
+    // Corresponds to SQLite's SQLITE_VTAB_INNOCUOUS flag.
     pub(crate) innocuous: bool,
 }
 
```

---

### Incident Patch 5: `74a45b13` (2026-10-06)
**Commit Message**: core: test native schema rebuilds through SQL

Use checkpoint and reopen to exercise view reconstruction. Query the TEMP table function again after rolling back TEMP DDL instead of calling internal schema helpers.

Tests: 28 native extension tests passed

Amp-Thread-ID: https://ampcode.com/threads/T-01a10d81-8a8e-720c-bd49-09b1f4871e6b
Co-authored-by: pedro muniz <[REDACTED_EMAIL]>

**File**: `core/vdbe/native_extension_tests.rs` (modified, +20/-37)
```diff
@@ -731,7 +731,7 @@ fn native_table_functions_survive_mvcc_schema_refresh_and_other_connection_ddl()
 }
 
 #[test]
-fn native_table_function_view_columns_survive_refresh_reopen_and_checkpoint() {
+fn native_table_function_views_survive_checkpoint_and_reopen() {
     for mvcc in [false, true] {
         let io = Arc::new(MemoryIO::new());
         let path = format!("native-view-{mvcc}.db");
@@ -774,34 +774,25 @@ fn native_table_function_view_columns_survive_refresh_reopen_and_checkpoint() {
             }
             conn.execute("CREATE VIEW native_view AS SELECT * FROM native_rows(8)")
                 .unwrap();
-            conn.execute(
-                "CREATE VIEW native_join AS WITH existing AS (SELECT value FROM native_view WHERE value > 10) SELECT existing.value FROM existing JOIN native_rows USING(value)",
-            )
-            .unwrap();
             assert_eq!(columns(&conn), expected_columns);
-            conn.force_reparse_schema_without_publish().unwrap();
+            conn.execute("PRAGMA wal_checkpoint(TRUNCATE)").unwrap();
             assert_eq!(columns(&conn), expected_columns);
-            let mut stmt = conn
-                .prepare("SELECT value FROM native_view ORDER BY value")
-                .unwrap();
-            assert_eq!(
-                collect(&mut stmt, &queue),
-                vec![vec![Value::from_i64(9)], vec![Value::from_i64(17)]]
-            );
         }
         let db = open();
         let conn = db.connect().unwrap();
         assert_eq!(columns(&conn), expected_columns);
-        conn.execute("PRAGMA wal_checkpoint(TRUNCATE)").unwrap();
-        conn.force_reparse_schema_without_publish().unwrap();
-        assert_eq!(columns(&conn), expected_columns);
-        let mut stmt = conn.prepare("SELECT value FROM native_join").unwrap();
-        assert_eq!(collect(&mut stmt, &queue), vec![vec![Value::from_i64(17)]]);
+        let mut stmt = conn
+            .prepare("SELECT value FROM native_view ORDER BY value")
+            .unwrap();
+        assert_eq!(
+            collect(&mut stmt, &queue),
+            vec![vec![Value::from_i64(9)], vec![Value::from_i64(17)]]
+        );
     }
 }
 
 #[test]
-fn native_table_functions_remain_in_empty_temp_schema_after_rollback() {
+fn native_table_functions_survive_temp_table_rollback() {
     let queue = Arc::new(Mutex::new(Vec::new()));
     let conn = connection(OpenOptions::new(Arc::new(SqliteDialect)).native_module(
         "native_rows",
@@ -813,24 +804,16 @@ fn native_table_functions_remain_in_empty_temp_schema_after_rollback() {
             writable: false,
         },
     ));
-    for (sql, expected) in [
-        (
-            "SELECT value FROM temp.native_rows(8)",
-            vec![vec![Value::from_i64(9)], vec![Value::from_i64(17)]],
-        ),
-        (
-            "SELECT value FROM temp.native_rows(16)",
-            vec![vec![Value::from_i64(17)]],
-        ),
-    ] {
-        let mut stmt = conn.prepare(sql).unwrap();
-        assert_eq!(collect(&mut stmt, &queue), expected);
-        conn.execute("BEGIN").unwrap();
-        conn.execute("CREATE TEMP TABLE temp_values(value)")
-            .unwrap();
-        conn.execute("ROLLBACK").unwrap();
-        assert!(conn.empty_temp_schema().get_table("native_rows").is_some());
-    }
+    let sql = "SELECT value FROM temp.native_rows(8)";
+    let expected = vec![vec![Value::from_i64(9)], vec![Value::from_i64(17)]];
+    let mut stmt = conn.prepare(sql).unwrap();
+    assert_eq!(collect(&mut stmt, &queue), expected);
+    conn.execute("BEGIN").unwrap();
+    conn.execute("CREATE TEMP TABLE temp_values(value)")
+        .unwrap();
+    conn.execute("ROLLBACK").unwrap();
+    let mut stmt = conn.prepare(sql).unwrap();
+    assert_eq!(collect(&mut stmt, &queue), expected);
 }
 
 #[test]
```

---

### Incident Patch 6: `01687638` (2026-10-06)
**Commit Message**: Merge 'serverless/js: fix query failure on column names that are array properties' from Pekka Enberg

A query fails in `@tursodatabase/serverless` when a result column has
the name of a property the row object already has:

```
TypeError: Cannot redefine property: length                        (number mode)
TypeError: Conversion from 'BigInt' to 'number' is not allowed     (safeIntegers(), Bun)
```

Rows from the cursor endpoint are built as arrays with one extra
property per column name, so the compat `ResultSet.rows` can be read by
index and by name. Defining a column-name property the array already
owns throws.

The fix: never overwrite a property the row already has. This is the
same rule `@libsql/hrana-client` and `libsql-client` use for their rows
(`!Object.hasOwn(row, colName)`). As a side effect, compat rows with
duplicate column names now keep the first value by name instead of the
last, which also matches libsql-client.

`bindings/javascript` is not affected: its expanded rows are plain
objects and its raw rows are arrays with only indices.

Tests: new `Statement.all() [column names that are JavaScript object
properties]` conformance test in `testing/conformance/javascrip

**File**: `serverless/javascript/src/session.ts` (modified, +1/-1)
```diff
@@ -450,7 +450,7 @@ export class Session {
     // Add column name properties to the array as non-enumerable
     // Only add valid identifier names to avoid conflicts
     columns.forEach((column, index) => {
-      if (column && isValidIdentifier(column)) {
+      if (column && isValidIdentifier(column) && !Object.prototype.hasOwnProperty.call(row, column)) {
         Object.defineProperty(row, column, {
           value: values[index],
           enumerable: false,
```

**File**: `testing/conformance/javascript/__test__/async.test.js` (modified, +19/-0)
```diff
@@ -1009,6 +1009,25 @@ test.serial("Statement.all() [statement safe integers]", async (t) => {
   t.deepEqual(await stmt.raw().all(), expected);
 });
 
+test.serial("Statement.all() [column names that are JavaScript object properties]", async (t) => {
+  const db = t.context.db;
+  await db.exec("DROP TABLE IF EXISTS t");
+  await db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, length INTEGER, map INTEGER, toString INTEGER, hasOwnProperty INTEGER)");
+  await db.exec("INSERT INTO t VALUES (1, 42, 43, 44, 45)");
+
+  const stmt = await db.prepare("SELECT * FROM t");
+  const expected = { id: 1, length: 42, map: 43, toString: 44, hasOwnProperty: 45 };
+  t.deepEqual(await stmt.all(), [expected]);
+  t.deepEqual(await stmt.get(), expected);
+  t.deepEqual(await stmt.raw().all(), [[1, 42, 43, 44, 45]]);
+
+  stmt.raw(false).safeIntegers();
+  const expectedBigInt = { id: 1n, length: 42n, map: 43n, toString: 44n, hasOwnProperty: 45n };
+  t.deepEqual(await stmt.all(), [expectedBigInt]);
+  t.deepEqual(await stmt.get(), expectedBigInt);
+  t.deepEqual(await stmt.raw().all(), [[1n, 42n, 43n, 44n, 45n]]);
+});
+
 // ==========================================================================
 // Big integers
 //
```

---

### Incident Patch 7: `6fd4e37e` (2026-10-06)
**Commit Message**: Merge 'docs: fix 'cargo doc' warnings' from Raminder Singh

This PR fixes many warnings when build docs with the `cargo doc
--workspace --no-deps` command.

I was building the docs to understand the codebase better but found many
warnings. The major types of warnings fixed were the following:

* `this URL is not a hyperlink`: this was due to missing < and > around
a hyperlink in docs.
* `redundant explicit link target`: this was because explicit target in
( and ) was not needed. E.g. in
`[`Error::BatchStatementFailed`](crate::Error::BatchStatementFailed)`.
* `unresolved link to `turso::params`: these kinds of warnings were due
to links not resolving to actual code elements. There were many reasons
for this e.g. the code element's path was incorrect or it ware renamed
etc.
* `unclosed HTML tag`: this was due to < and > character used in docs
for purposes other than an html tag.

Many of the low hanging fruit like html tags warnings were fixed by
hand. AI was used to find correct references to the right code element.
E.g. to figure out that `[`get_timestamp`]` was actually at
`[`LogicalClock::get_timestamp`]` or to fix a couple of broken code
examples in docs.

Closes #9458

**File**: `bindings/javascript/src/lib.rs` (modified, +1/-1)
```diff
@@ -168,7 +168,7 @@ pub struct EncryptionOpts {
 }
 
 /// Most of the options are aligned with better-sqlite API
-/// (see https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md#new-databasepath-options)
+/// (see <https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md#new-databasepath-options>)
 #[napi(object)]
 #[derive(Clone)]
 pub struct DatabaseOpts {
```

**File**: `bindings/rust/src/connection.rs` (modified, +3/-3)
```diff
@@ -155,7 +155,7 @@ impl Connection {
     ///
     /// The statements execute in order. Execution stops at the first
     /// statement that fails: the remaining statements are skipped and the
-    /// returned [`Error::BatchStatementFailed`](crate::Error::BatchStatementFailed)
+    /// returned [`Error::BatchStatementFailed`]
     /// carries the zero-based index of the failing statement together with
     /// the underlying error.
     ///
@@ -208,7 +208,7 @@ impl Connection {
     /// Like [`batch`](Connection::batch), but the statements are wrapped in
     /// `BEGIN <behavior>` / `COMMIT`, with a `ROLLBACK` on failure: either
     /// every statement commits or none does. On failure the returned
-    /// [`Error::BatchStatementFailed`](crate::Error::BatchStatementFailed)
+    /// [`Error::BatchStatementFailed`]
     /// carries the zero-based index of the failing statement.
     ///
     /// This method owns the surrounding transaction, so the statements must
@@ -486,7 +486,7 @@ impl Connection {
 
     /// Sets maximum total accumuated timeout. If the duration is None or Zero, we unset the busy handler for this Connection
     ///
-    /// This api defers slighty from: https://www.sqlite.org/c3ref/busy_timeout.html
+    /// This api defers slighty from: <https://www.sqlite.org/c3ref/busy_timeout.html>
     ///
     /// Instead of sleeping for linear amount of time specified by the user,
     /// we will sleep in phases, until the the total amount of time is reached.
```

**File**: `bindings/rust/src/params.rs` (modified, +2/-2)
```diff
@@ -29,7 +29,7 @@ use sealed::Sealed;
 ///
 /// - For heterogeneous parameter lists of 16 or less items a tuple syntax is supported
 ///   by doing `(1, "foo")`.
-/// - For hetergeneous parameter lists of 16 or greater, the [`turso::params!`] is supported
+/// - For hetergeneous parameter lists of 16 or greater, the [`turso::params!`][crate::params!] is supported
 ///   by doing `turso::params![1, "foo"]`.
 /// - For homogeneous parameter types (where they are all the same type), const arrays are
 ///   supported by doing `[1, 2, 3]`.
@@ -67,7 +67,7 @@ use sealed::Sealed;
 ///
 /// - For heterogeneous parameter lists of 16 or less items a tuple syntax is supported
 ///   by doing `((":key1", 1), (":key2", "foo"))`.
-/// - For heterogeneous parameter lists of 16 or greater, the [`turso::params!`] is supported
+/// - For heterogeneous parameter lists of 16 or greater, the [`turso::params!`][crate::params!] is supported
 ///   by doing `turso::named_params![":key1": 1, ":key2": "foo"]`.
 /// - For homogeneous parameter types (where they are all the same type), const arrays are
 ///   supported by doing `[(":key1", 1), (":key2", 2), (":key3", 3)]`.
```

**File**: `core/dialect/sqlite.rs` (modified, +1/-1)
```diff
@@ -138,7 +138,7 @@ pub fn table_sql_for_replay(sql: &str) -> crate::Result<String> {
 
 /// Insert the standard SQLite-style catalog tables into `schema`.
 ///
-/// `pragma_*` virtual tables use the dedicated [`VirtualTableType::Pragma`]
+/// `pragma_*` virtual tables use the dedicated `VirtualTableType::Pragma`
 /// variant (they aren't `InternalVirtualTable`), so they are inserted
 /// directly. The rest go through [`Schema::register_internal_vtab`] — the
 /// same path external callers use via [`crate::Database::register_internal_vtab`].
```

**File**: `core/io/memory_yield.rs` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ use tracing::debug;
 /// *every* `pread` / `pwrite` / `pwritev` / `sync` / `truncate`.
 ///
 /// This backend performs the identical byte-level data movement as
-/// `MemoryIO` (it shares [`MemStore`]) but enqueues the completion instead of
+/// `MemoryIO` (it shares `MemStore`) but enqueues the completion instead of
 /// signalling it. The completion only becomes `finished()` when `step()` runs,
 /// so the engine must return `StepResult::IO`, yield, and re-enter — exercising
 /// the resume path behind each yield point.
```

**File**: `core/io/mod.rs` (modified, +2/-2)
```diff
@@ -939,7 +939,7 @@ const BUILTIN_VFS_NAMES: &[&str] = &["memory", "syscall", "io_uring", "experimen
 
 /// Register a named Rust IO backend.
 ///
-/// Once registered, it can be used via [`Database::io_for_vfs`] or through
+/// Once registered, it can be used via [`crate::Database::io_for_vfs`] or through
 /// any language binding's `vfs=` parameter (Go DSN, Python kwarg, etc.).
 ///
 /// Re-registering the same name replaces the previous backend. Registered
@@ -949,7 +949,7 @@ const BUILTIN_VFS_NAMES: &[&str] = &["memory", "syscall", "io_uring", "experimen
 ///
 /// # Errors
 ///
-/// Returns [`LimboError::InvalidArgument`] if `name` is empty.
+/// Returns [`crate::LimboError::InvalidArgument`] if `name` is empty.
 pub fn register_io(name: &str, io: Arc<dyn IO>) -> crate::Result<()> {
     if name.is_empty() {
         return Err(crate::LimboError::InvalidArgument(
```

**File**: `core/json/mod.rs` (modified, +3/-3)
```diff
@@ -486,7 +486,7 @@ where
 }
 
 /// Implements the -> operator. Always returns a proper JSON value.
-/// https://sqlite.org/json1.html#the_and_operators
+/// <https://sqlite.org/json1.html#the_and_operators>
 pub fn json_arrow_extract(
     value: impl AsValueRef,
     path: impl AsValueRef,
@@ -514,7 +514,7 @@ pub fn json_arrow_extract(
 }
 
 /// Implements the ->> operator. Always returns a SQL representation of the JSON subcomponent.
-/// https://sqlite.org/json1.html#the_and_operators
+/// <https://sqlite.org/json1.html#the_and_operators>
 pub fn json_arrow_shift_extract(
     value: impl AsValueRef,
     path: impl AsValueRef,
@@ -551,7 +551,7 @@ pub fn json_arrow_shift_extract(
 
 /// Extracts a JSON value from a JSON object or array.
 /// If there's only a single path, the return value might be either a TEXT or a database type.
-/// https://sqlite.org/json1.html#the_json_extract_function
+/// <https://sqlite.org/json1.html#the_json_extract_function>
 pub fn json_extract<I, E, V>(
     value: impl AsValueRef,
     paths: I,
```

**File**: `core/mvcc/clock.rs` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ pub trait LogicalClock: Send + Sync {
 
 /// A mutex-guarded clock for concurrent MVCC use.
 ///
-/// The lock is held across the `f` callback in [`get_timestamp`], ensuring
+/// The lock is held across the `f` callback in [`LogicalClock::get_timestamp`], ensuring
 /// that a commit timestamp is published (e.g. stored as `Preparing(ts)`)
 /// before any other transaction can generate a higher timestamp. This closes
 /// the TOCTOU window between timestamp generation and `Preparing` state
```

---

### Incident Patch 8: `8dd0caac` (2026-10-06)
**Commit Message**: docs: fix 'cargo doc' warnings

`cargo doc --workspace --no-deps` reported many rustdoc warnings. Fix
them without changing what any comment says:

- Wrap bare URLs in `<` and `>` so rustdoc renders them as links.
- Drop explicit link targets that only repeat the link text.
- Point intra-doc links at the item's real path, or write names that
  rustdoc cannot resolve as plain code text.
- Escape `<` and `>` that are not HTML tags.
- Add the braces rustdoc needs to parse the example code blocks.

Tests: cargo doc --workspace --no-deps reports no rustdoc warnings

Co-authored-by: Pekka Enberg <[REDACTED_EMAIL]>

**File**: `bindings/javascript/src/lib.rs` (modified, +1/-1)
```diff
@@ -168,7 +168,7 @@ pub struct EncryptionOpts {
 }
 
 /// Most of the options are aligned with better-sqlite API
-/// (see https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md#new-databasepath-options)
+/// (see <https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md#new-databasepath-options>)
 #[napi(object)]
 #[derive(Clone)]
 pub struct DatabaseOpts {
```

**File**: `bindings/rust/src/connection.rs` (modified, +3/-3)
```diff
@@ -155,7 +155,7 @@ impl Connection {
     ///
     /// The statements execute in order. Execution stops at the first
     /// statement that fails: the remaining statements are skipped and the
-    /// returned [`Error::BatchStatementFailed`](crate::Error::BatchStatementFailed)
+    /// returned [`Error::BatchStatementFailed`]
     /// carries the zero-based index of the failing statement together with
     /// the underlying error.
     ///
@@ -208,7 +208,7 @@ impl Connection {
     /// Like [`batch`](Connection::batch), but the statements are wrapped in
     /// `BEGIN <behavior>` / `COMMIT`, with a `ROLLBACK` on failure: either
     /// every statement commits or none does. On failure the returned
-    /// [`Error::BatchStatementFailed`](crate::Error::BatchStatementFailed)
+    /// [`Error::BatchStatementFailed`]
     /// carries the zero-based index of the failing statement.
     ///
     /// This method owns the surrounding transaction, so the statements must
@@ -486,7 +486,7 @@ impl Connection {
 
     /// Sets maximum total accumuated timeout. If the duration is None or Zero, we unset the busy handler for this Connection
     ///
-    /// This api defers slighty from: https://www.sqlite.org/c3ref/busy_timeout.html
+    /// This api defers slighty from: <https://www.sqlite.org/c3ref/busy_timeout.html>
     ///
     /// Instead of sleeping for linear amount of time specified by the user,
     /// we will sleep in phases, until the the total amount of time is reached.
```

**File**: `bindings/rust/src/params.rs` (modified, +2/-2)
```diff
@@ -29,7 +29,7 @@ use sealed::Sealed;
 ///
 /// - For heterogeneous parameter lists of 16 or less items a tuple syntax is supported
 ///   by doing `(1, "foo")`.
-/// - For hetergeneous parameter lists of 16 or greater, the [`turso::params!`] is supported
+/// - For hetergeneous parameter lists of 16 or greater, the [`turso::params!`][crate::params!] is supported
 ///   by doing `turso::params![1, "foo"]`.
 /// - For homogeneous parameter types (where they are all the same type), const arrays are
 ///   supported by doing `[1, 2, 3]`.
@@ -67,7 +67,7 @@ use sealed::Sealed;
 ///
 /// - For heterogeneous parameter lists of 16 or less items a tuple syntax is supported
 ///   by doing `((":key1", 1), (":key2", "foo"))`.
-/// - For heterogeneous parameter lists of 16 or greater, the [`turso::params!`] is supported
+/// - For heterogeneous parameter lists of 16 or greater, the [`turso::params!`][crate::params!] is supported
 ///   by doing `turso::named_params![":key1": 1, ":key2": "foo"]`.
 /// - For homogeneous parameter types (where they are all the same type), const arrays are
 ///   supported by doing `[(":key1", 1), (":key2", 2), (":key3", 3)]`.
```

**File**: `core/dialect/sqlite.rs` (modified, +1/-1)
```diff
@@ -138,7 +138,7 @@ pub fn table_sql_for_replay(sql: &str) -> crate::Result<String> {
 
 /// Insert the standard SQLite-style catalog tables into `schema`.
 ///
-/// `pragma_*` virtual tables use the dedicated [`VirtualTableType::Pragma`]
+/// `pragma_*` virtual tables use the dedicated `VirtualTableType::Pragma`
 /// variant (they aren't `InternalVirtualTable`), so they are inserted
 /// directly. The rest go through [`Schema::register_internal_vtab`] — the
 /// same path external callers use via [`crate::Database::register_internal_vtab`].
```

**File**: `core/io/memory_yield.rs` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ use tracing::debug;
 /// *every* `pread` / `pwrite` / `pwritev` / `sync` / `truncate`.
 ///
 /// This backend performs the identical byte-level data movement as
-/// `MemoryIO` (it shares [`MemStore`]) but enqueues the completion instead of
+/// `MemoryIO` (it shares `MemStore`) but enqueues the completion instead of
 /// signalling it. The completion only becomes `finished()` when `step()` runs,
 /// so the engine must return `StepResult::IO`, yield, and re-enter — exercising
 /// the resume path behind each yield point.
```

**File**: `core/io/mod.rs` (modified, +2/-2)
```diff
@@ -939,7 +939,7 @@ const BUILTIN_VFS_NAMES: &[&str] = &["memory", "syscall", "io_uring", "experimen
 
 /// Register a named Rust IO backend.
 ///
-/// Once registered, it can be used via [`Database::io_for_vfs`] or through
+/// Once registered, it can be used via [`crate::Database::io_for_vfs`] or through
 /// any language binding's `vfs=` parameter (Go DSN, Python kwarg, etc.).
 ///
 /// Re-registering the same name replaces the previous backend. Registered
@@ -949,7 +949,7 @@ const BUILTIN_VFS_NAMES: &[&str] = &["memory", "syscall", "io_uring", "experimen
 ///
 /// # Errors
 ///
-/// Returns [`LimboError::InvalidArgument`] if `name` is empty.
+/// Returns [`crate::LimboError::InvalidArgument`] if `name` is empty.
 pub fn register_io(name: &str, io: Arc<dyn IO>) -> crate::Result<()> {
     if name.is_empty() {
         return Err(crate::LimboError::InvalidArgument(
```

**File**: `core/json/mod.rs` (modified, +3/-3)
```diff
@@ -486,7 +486,7 @@ where
 }
 
 /// Implements the -> operator. Always returns a proper JSON value.
-/// https://sqlite.org/json1.html#the_and_operators
+/// <https://sqlite.org/json1.html#the_and_operators>
 pub fn json_arrow_extract(
     value: impl AsValueRef,
     path: impl AsValueRef,
@@ -514,7 +514,7 @@ pub fn json_arrow_extract(
 }
 
 /// Implements the ->> operator. Always returns a SQL representation of the JSON subcomponent.
-/// https://sqlite.org/json1.html#the_and_operators
+/// <https://sqlite.org/json1.html#the_and_operators>
 pub fn json_arrow_shift_extract(
     value: impl AsValueRef,
     path: impl AsValueRef,
@@ -551,7 +551,7 @@ pub fn json_arrow_shift_extract(
 
 /// Extracts a JSON value from a JSON object or array.
 /// If there's only a single path, the return value might be either a TEXT or a database type.
-/// https://sqlite.org/json1.html#the_json_extract_function
+/// <https://sqlite.org/json1.html#the_json_extract_function>
 pub fn json_extract<I, E, V>(
     value: impl AsValueRef,
     paths: I,
```

**File**: `core/mvcc/clock.rs` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ pub trait LogicalClock: Send + Sync {
 
 /// A mutex-guarded clock for concurrent MVCC use.
 ///
-/// The lock is held across the `f` callback in [`get_timestamp`], ensuring
+/// The lock is held across the `f` callback in [`LogicalClock::get_timestamp`], ensuring
 /// that a commit timestamp is published (e.g. stored as `Preparing(ts)`)
 /// before any other transaction can generate a higher timestamp. This closes
 /// the TOCTOU window between timestamp generation and `Preparing` state
```

---

### Incident Patch 9: `e124f65f` (2026-10-06)
**Commit Message**: Merge 'core: fix outer-join range seeks and hash-join unmatched-row filters' from Jussi Saurio

## Problem 1: range seek on a null-extended key

An outer join can make a NOT NULL column, a rowid alias, or an implicit
rowid NULL. The range planner trusted the schema, so it started an index
range at that NULL key, which sorts before every value:

```sql
CREATE TABLE l(seed INT);
CREATE TABLE m(k INT NOT NULL);
CREATE TABLE r(value INT);
CREATE INDEX r_value ON r(value);
INSERT INTO l VALUES (1);
INSERT INTO r VALUES (1);

SELECT l.seed, m.k, r.value
  FROM l LEFT JOIN m ON true
  LEFT JOIN r INDEXED BY r_value ON m.k <= r.value;
-- SQLite:                1|NULL|NULL
-- Turso without the fix: 1|NULL|1
```

### Fix

Columns and rowids of a table that an outer join can null-extend are no
longer treated as NOT NULL, so the seek gets SQLite's `IsNull` guard:

```
Column  m.k -> r[7]
IsNull  r[7] -> skip     ; NULL key: no match, no seek
SeekGE  r_value, r[7]
```

Correlated subqueries carry this through outer references, so a seek
inside the subquery is guarded too:

```sql
SELECT l.seed, (SELECT count(*) FROM r WHERE r.value >= m.k)
  FROM l LEFT JOIN m ON m.seed = l.seed;
```

## Proble

**File**: `core/translate/alter.rs` (modified, +1/-0)
```diff
@@ -998,6 +998,7 @@ pub fn translate_alter_table(
                             cte_id: None,
                             cte_definition_only: false,
                             rowid_referenced: false,
+                            outer_join_may_null_extend: false,
                             scope_depth: 0,
                         }],
                     );
```

**File**: `core/translate/emitter/update.rs` (modified, +1/-0)
```diff
@@ -194,6 +194,7 @@ pub fn emit_program_for_update(
             cte_id: None,
             cte_definition_only: false,
             rowid_referenced: false,
+            outer_join_may_null_extend: false,
             scope_depth: 0,
         });
         // CTEs are also visible during the write phase, so add them here.
```

**File**: `core/translate/main_loop/body.rs` (modified, +21/-5)
```diff
@@ -491,15 +491,30 @@ fn offset_continue_label(t_ctx: &TranslateCtx<'_>, plan: &SelectPlan) -> Option<
 /// by anything else are stale here: nothing refills them once the probe loop has
 /// exited. Skipping a condition whose columns are all readable silently drops it
 /// from the null-extended rows, letting through rows the query filtered out.
+///
+/// A correlated subquery result is readable only if every table the subquery
+/// reads is one of `allowed`. Otherwise the subquery runs inside the inner
+/// loop, and its result register still holds the value from an earlier row.
 fn condition_operands_are_available(
     expr: &Expr,
     table_references: &TableReferences,
+    subqueries: &[NonFromClauseSubquery],
     allowed: &TableMask,
     resolver: &Resolver,
     payload_regs: Range<usize>,
-) -> bool {
+) -> Result<bool> {
     let mut ok = true;
-    let _ = walk_expr(expr, &mut |e: &Expr| -> Result<WalkControl> {
+    walk_expr(expr, &mut |e: &Expr| -> Result<WalkControl> {
+        if let Expr::SubqueryResult { .. } = e {
+            if !allowed.contains_all_set_bits_of(&table_mask_from_expr(
+                e,
+                table_references,
+                subqueries,
+            )?) {
+                ok = false;
+            }
+            return Ok(WalkControl::SkipChildren);
+        }
         let (Expr::Column { table, .. } | Expr::RowId { table, .. }) = e else {
             return Ok(WalkControl::Continue);
         };
@@ -521,8 +536,8 @@ fn condition_operands_are_available(
         }
         // Outer query references are already in scope — allow them.
         Ok(WalkControl::Continue)
-    });
-    ok
+    })?;
+    Ok(ok)
 }
 
 /// Emit WHERE conditions and inner-loop entry for an unmatched hash build row.
@@ -606,10 +621,11 @@ pub(super) fn emit_unmatched_row_conditions_and_loop<'a>(
             && !condition_operands_are_available(
                 &condition.expr,
                 &plan.table_references,
+                &plan.non_from_clause_subqueries,
                 &allowed_tables,
                 &t_ctx.resolver,
                 payload_regs.clone(),
-            )
+            )?
         {
             continue;
         }
```

**File**: `core/translate/optimizer/mod.rs` (modified, +8/-1)
```diff
@@ -3566,6 +3566,11 @@ impl Optimizable for ast::Expr {
                 is_rowid_alias,
                 ..
             } => {
+                // SQLite marks columns from the nullable side of an outer join
+                // as nullable, even when the table schema says NOT NULL.
+                if tables.outer_join_may_null_extend(*table) {
+                    return false;
+                }
                 if *is_rowid_alias {
                     return true;
                 }
@@ -3579,7 +3584,9 @@ impl Optimizable for ast::Expr {
                 // Other PRIMARY KEY types (e.g., TEXT PRIMARY KEY) can contain NULL.
                 column.is_rowid_alias() || column.notnull()
             }
-            Expr::RowId { .. } => true,
+            // A rowid is not NULL for a real table row. An outer join can
+            // replace that row with a synthetic row whose rowid is NULL.
+            Expr::RowId { table, .. } => !tables.outer_join_may_null_extend(*table),
             Expr::InList { lhs, rhs, .. } => {
                 lhs.is_nonnull(tables)
                     && (rhs.is_empty() || rhs.iter().all(|v| v.is_nonnull(tables)))
```

**File**: `core/translate/plan.rs` (modified, +8/-1)
```diff
@@ -1504,6 +1504,9 @@ pub struct OuterQueryReference {
     /// col_used_mask because rowid is not a real column and setting a fake
     /// column index in col_used_mask could mislead covering index decisions.
     pub rowid_referenced: bool,
+    /// Whether an outer join in an outer scope can replace this table's values
+    /// with NULL. The local FROM list does not contain that outer join.
+    pub outer_join_may_null_extend: bool,
     /// Scope depth for this outer reference. 0 = immediate outer scope,
     /// 1 = grandparent scope, etc. Used to avoid false "ambiguous column"
     /// errors when the same column name exists at different nesting depths.
@@ -1639,7 +1642,11 @@ impl TableReferences {
             .iter()
             .position(|t| t.internal_id == table)
         else {
-            return false;
+            // A correlated subquery does not have the outer FROM list. Its
+            // table reference carries the nullability from that outer scope.
+            return self
+                .find_outer_query_ref_by_internal_id(table)
+                .is_some_and(|outer_ref| outer_ref.outer_join_may_null_extend);
         };
         if self.joined_tables[pos]
             .join_info
```

**File**: `core/translate/planner.rs` (modified, +5/-0)
```diff
@@ -1238,6 +1238,7 @@ fn plan_cte(
                 // actually adds the table.
                 cte_definition_only: true,
                 rowid_referenced: false,
+                outer_join_may_null_extend: false,
                 scope_depth: 0,
             });
         }
@@ -1436,6 +1437,7 @@ fn prepare_recursive_cte_plan(
         cte_id: None,
         cte_definition_only: false,
         rowid_referenced: false,
+        outer_join_may_null_extend: false,
         scope_depth: 0,
     });
 
@@ -1569,6 +1571,7 @@ pub fn plan_ctes_as_outer_refs(
             cte_id: Some(cte_definition.cte_id),
             cte_definition_only: true,
             rowid_referenced: false,
+            outer_join_may_null_extend: false,
             scope_depth: 0,
         });
     }
@@ -1635,6 +1638,7 @@ fn parse_from_clause_table(
                     cte_id: Some(cte_definition.cte_id),
                     cte_definition_only: false,
                     rowid_referenced: false,
+                    outer_join_may_null_extend: false,
                     scope_depth: 0,
                 });
             }
@@ -2456,6 +2460,7 @@ pub fn parse_from(
                     // This entry only lets a nested FROM clause find the CTE name.
                     cte_definition_only: true,
                     rowid_referenced: false,
+                    outer_join_may_null_extend: false,
                     scope_depth: 0,
                 });
             }
```

**File**: `core/translate/subquery.rs` (modified, +3/-0)
```diff
@@ -615,6 +615,8 @@ fn plan_subqueries_with_outer_query_access<'a>(
                     cte_id,
                     cte_definition_only: false,
                     rowid_referenced: false,
+                    outer_join_may_null_extend: referenced_tables
+                        .outer_join_may_null_extend(t.internal_id),
                     scope_depth: 0,
                 };
                 Ok::<_, crate::LimboError>(outer_ref)
@@ -631,6 +633,7 @@ fn plan_subqueries_with_outer_query_access<'a>(
                     cte_id: t.cte_id, // Preserve CTE ID from outer query refs
                     cte_definition_only: t.cte_definition_only,
                     rowid_referenced: false,
+                    outer_join_may_null_extend: t.outer_join_may_null_extend,
                     scope_depth: t.scope_depth + 1,
                 })
             }))
```

**File**: `sqlite/conformance/sqlite-sqltests/hash-join-unmatched-row-filters.sqltest` (modified, +24/-0)
```diff
@@ -85,3 +85,27 @@ expect {
     1||2|3
     2|10|3|2
 }
+
+# The unmatched scan must not test a WHERE term whose correlated subquery reads
+# a later table. That subquery runs inside the later table's loop, so at the
+# unmatched scan its result register still holds the previous row's value.
+# Here l=3 has no m match (hash join) and no p match, so p.w is NULL and the
+# subquery finds no row. The stale result from l=2 found one.
+test hash-join-unmatched-row-defers-subquery-over-later-table {
+    CREATE TABLE l(seed INT);
+    CREATE TABLE m(seed INT);
+    CREATE TABLE p(seed INT, w INT);
+    CREATE TABLE r(value INTEGER);
+    CREATE INDEX r_value ON r(value);
+    INSERT INTO l VALUES (1), (2), (3);
+    INSERT INTO m VALUES (1), (2);
+    INSERT INTO p VALUES (1, 5), (2, 7);
+    INSERT INTO r VALUES (NULL), (0), (2);
+    SELECT l.seed FROM l
+    LEFT JOIN m ON m.seed = l.seed
+    LEFT JOIN p ON p.seed = l.seed
+    WHERE NOT EXISTS (SELECT 1 FROM r WHERE r.value <= p.w);
+}
+expect {
+    3
+}
```

---

### Incident Patch 10: `910cab52` (2026-10-06)
**Commit Message**: serverless/js: fix query failure on column names that are array properties

Rows from the cursor endpoint are built as arrays with one extra
property per column name, so the compat ResultSet rows can be read by
index and by name. Defining a column-name property that the array
already owns throws, so a query returning such a column fails outright
("Cannot redefine property", or "Cannot convert a BigInt value to a
number" with safeIntegers()).

Never overwrite a property the row already has. This is the rule
@libsql/hrana-client and libsql-client use for their rows. As a side
effect, compat rows with duplicate column names now keep the first value
by name instead of the last, matching libsql-client.

Tests: new "Statement.all() [column names that are JavaScript object
properties]" conformance test in testing/conformance/javascript covering
length, map, toString and hasOwnProperty. Run with PROVIDER=serverless
against a local `turso dev` server it fails on the unfixed driver and
passes with the fix.

**File**: `serverless/javascript/src/session.ts` (modified, +1/-1)
```diff
@@ -450,7 +450,7 @@ export class Session {
     // Add column name properties to the array as non-enumerable
     // Only add valid identifier names to avoid conflicts
     columns.forEach((column, index) => {
-      if (column && isValidIdentifier(column)) {
+      if (column && isValidIdentifier(column) && !Object.prototype.hasOwnProperty.call(row, column)) {
         Object.defineProperty(row, column, {
           value: values[index],
           enumerable: false,
```

**File**: `testing/conformance/javascript/__test__/async.test.js` (modified, +19/-0)
```diff
@@ -1009,6 +1009,25 @@ test.serial("Statement.all() [statement safe integers]", async (t) => {
   t.deepEqual(await stmt.raw().all(), expected);
 });
 
+test.serial("Statement.all() [column names that are JavaScript object properties]", async (t) => {
+  const db = t.context.db;
+  await db.exec("DROP TABLE IF EXISTS t");
+  await db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, length INTEGER, map INTEGER, toString INTEGER, hasOwnProperty INTEGER)");
+  await db.exec("INSERT INTO t VALUES (1, 42, 43, 44, 45)");
+
+  const stmt = await db.prepare("SELECT * FROM t");
+  const expected = { id: 1, length: 42, map: 43, toString: 44, hasOwnProperty: 45 };
+  t.deepEqual(await stmt.all(), [expected]);
+  t.deepEqual(await stmt.get(), expected);
+  t.deepEqual(await stmt.raw().all(), [[1, 42, 43, 44, 45]]);
+
+  stmt.raw(false).safeIntegers();
+  const expectedBigInt = { id: 1n, length: 42n, map: 43n, toString: 44n, hasOwnProperty: 45n };
+  t.deepEqual(await stmt.all(), [expectedBigInt]);
+  t.deepEqual(await stmt.get(), expectedBigInt);
+  t.deepEqual(await stmt.raw().all(), [[1n, 42n, 43n, 44n, 45n]]);
+});
+
 // ==========================================================================
 // Big integers
 //
```

---

### Incident Patch 11: `3307a882` (2026-10-06)
**Commit Message**: test: cover range seeks on null-extended keys

The focused tests cover one join shape each. These matrices cross the keys
an outer join can make NULL (NOT NULL columns, rowid aliases, implicit
rowids, UNIQUE NOT NULL columns) with range operators, compound ranges,
index and rowid seeks, later inner or outer joins, correlated subqueries in
the result and in WHERE, and each way the key table can get its NULL row
(LEFT JOIN, RIGHT JOIN, a parenthesized group, a never-true ON). Each
expansion is compared against the bundled SQLite.

Tests: left_join_null_index_bug.sqltest (197 matrix cases)

**File**: `sqlite/conformance/sqlite-sqltests/joins/left_join_null_index_bug.sqltest` (modified, +105/-0)
```diff
@@ -71,3 +71,108 @@ expect {
 1|1|
 2||
 }
+
+# The matrices below compare against SQLite. Row seed=3 has no match in m or p,
+# so every key from m or p is NULL for it, even when the column is NOT NULL,
+# a rowid alias, or an implicit rowid.
+setup null_extended_range_keys {
+    CREATE TABLE l(seed INT);
+    CREATE TABLE m(id INTEGER PRIMARY KEY, k INTEGER NOT NULL, u INTEGER NOT NULL UNIQUE, seed INT);
+    CREATE TABLE p(seed INT, w INT);
+    CREATE TABLE r(value INTEGER, tag TEXT);
+    CREATE INDEX r_value ON r(value);
+    CREATE TABLE rk(id INTEGER PRIMARY KEY, tag TEXT);
+    INSERT INTO l VALUES (1), (2), (3);
+    INSERT INTO m VALUES (1, 2, 20, 1), (2, 4, 40, 2);
+    INSERT INTO p VALUES (1, 5), (2, 7);
+    INSERT INTO r VALUES (NULL, 'n'), (0, 'a'), (2, 'b'), (4, 'c'), (6, 'd'), (40, 'e');
+    INSERT INTO rk VALUES (1, 'a'), (2, 'b'), (4, 'c'), (20, 'd'), (40, 'e');
+}
+
+@setup null_extended_range_keys
+@var key { m.k | m.id | m.rowid | m.u | p.rowid | p.w }
+@var op { < | <= | > | >= | = | IS }
+@var join { LEFT JOIN | JOIN }
+matrix index-range-seek-on-null-extended-key {
+    SELECT l.seed, quote(m.k), quote(p.w), r.tag
+      FROM l LEFT JOIN m ON m.seed = l.seed LEFT JOIN p ON p.seed = l.seed
+      $join r INDEXED BY r_value ON $key $op r.value
+     ORDER BY 1, 2, 3, 4;
+}
+
+@setup null_extended_range_keys
+@var key { m.k | m.id | m.rowid | m.u | p.rowid | p.w }
+@var op { < | <= | > | >= | = | IS }
+@var join { LEFT JOIN | JOIN }
+matrix rowid-range-seek-on-null-extended-key {
+    SELECT l.seed, quote(m.k), quote(p.w), rk.tag
+      FROM l LEFT JOIN m ON m.seed = l.seed LEFT JOIN p ON p.seed = l.seed
+      $join rk ON $key $op rk.id
+     ORDER BY 1, 2, 3, 4;
+}
+
+@setup null_extended_range_keys
+@var cond {
+    r.value BETWEEN m.k AND m.k + 10 | r.value BETWEEN 0 AND m.k |
+    r.value IN (m.k, m.u) | r.value > m.k AND r.value < m.u |
+    r.value >= coalesce(m.k, 0) | r.value <= m.id + 1 |
+    r.value > p.rowid AND r.value <= p.w | r.value >= m.k OR r.value IS NULL
+}
+@var join { LEFT JOIN | JOIN }
+matrix compound-range-on-null-extended-key {
+    SELECT l.seed, quote(m.k), r.tag
+      FROM l LEFT JOIN m ON m.seed = l.seed LEFT JOIN p ON p.seed = l.seed
+      $join r INDEXED BY r_value ON $cond
+     ORDER BY 1, 2, 3;
+}
+
+@setup null_extended_range_keys
+@var sub {
+    SELECT count(*) FROM r INDEXED BY r_value WHERE r.value >= m.k |
+    SELECT count(*) FROM r INDEXED BY r_value WHERE r.value <= m.id |
+    SELECT count(*) FROM r INDEXED BY r_value WHERE r.value > m.rowid |
+    SELECT count(*) FROM r INDEXED BY r_value WHERE r.value < p.rowid |
+    SELECT min(r.tag) FROM r INDEXED BY r_value WHERE r.value BETWEEN m.k AND m.u |
+    SELECT count(*) FROM r INDEXED BY r_value WHERE r.value = m.k |
+    SELECT count(*) FROM rk WHERE rk.id >= m.k |
+    SELECT max(rk.tag) FROM rk WHERE rk.id < p.rowid |
+    SELECT (SELECT count(*) FROM r INDEXED BY r_value WHERE r.value > m.k)
+}
+matrix correlated-range-seek-on-null-extended-outer-key {
+    SELECT l.seed, ($sub)
+      FROM l LEFT JOIN m ON m.seed = l.seed LEFT JOIN p ON p.seed = l.seed
+     ORDER BY 1;
+}
+
+@setup null_extended_range_keys
+@var pred {
+    EXISTS (SELECT 1 FROM r INDEXED BY r_value WHERE r.value >= m.k) |
+    NOT EXISTS (SELECT 1 FROM r INDEXED BY r_value WHERE r.value >= m.k) |
+    EXISTS (SELECT 1 FROM rk WHERE rk.id > m.id) |
+    NOT EXISTS (SELECT 1 FROM rk WHERE rk.id <= p.rowid) |
+    l.seed IN (SELECT r.value FROM r INDEXED BY r_value WHERE r.value < m.u)
+}
+matrix correlated-range-seek-in-where {
+    SELECT l.seed
+      FROM l LEFT JOIN m ON m.seed = l.seed LEFT JOIN p ON p.seed = l.seed
+     WHERE $pred
+     ORDER BY 1;
+}
+
+@setup null_extended_range_keys
+@var from {
+    l LEFT JOIN m ON m.seed = l.seed |
+    m RIGHT JOIN l ON m.seed = l.seed |
+    l LEFT JOIN (m JOIN p USING(seed)) ON m.seed = l.seed |
+    l LEFT JOIN m ON m.seed = l.seed AND m.k > 3 |
+    l LEFT JOIN m ON 0
+}
+@var seek {
+    LEFT JOIN r INDEXED BY r_value ON m.k <= r.value |
+    LEFT JOIN r INDEXED BY r_value ON r.value BETWEEN m.id AND m.u |
+    LEFT JOIN rk ON rk.id > m.rowid |
+    JOIN r INDEXED BY r_value ON m.u >= r.value
+}
+matrix range-seek-after-each-null-extension {
+    SELECT l.seed, quote(m.k), quote(r.tag) FROM $from $seek ORDER BY 1, 2, 3;
+}
```

---

### Incident Patch 12: `c6de95c2` (2026-09-04)
**Commit Message**: core: guard outer-join range seeks against null keys

An earlier outer join can replace a NOT NULL column, a rowid alias, or an implicit rowid with NULL. Preserve that fact in correlated outer references so range planning emits SQLite's IsNull guard.

Tests: left_join_null_index_bug.sqltest and the focused LEFT JOIN bytecode snapshot

**File**: `core/translate/alter.rs` (modified, +1/-0)
```diff
@@ -998,6 +998,7 @@ pub fn translate_alter_table(
                             cte_id: None,
                             cte_definition_only: false,
                             rowid_referenced: false,
+                            outer_join_may_null_extend: false,
                             scope_depth: 0,
                         }],
                     );
```

**File**: `core/translate/emitter/update.rs` (modified, +1/-0)
```diff
@@ -194,6 +194,7 @@ pub fn emit_program_for_update(
             cte_id: None,
             cte_definition_only: false,
             rowid_referenced: false,
+            outer_join_may_null_extend: false,
             scope_depth: 0,
         });
         // CTEs are also visible during the write phase, so add them here.
```

**File**: `core/translate/optimizer/mod.rs` (modified, +8/-1)
```diff
@@ -3566,6 +3566,11 @@ impl Optimizable for ast::Expr {
                 is_rowid_alias,
                 ..
             } => {
+                // SQLite marks columns from the nullable side of an outer join
+                // as nullable, even when the table schema says NOT NULL.
+                if tables.outer_join_may_null_extend(*table) {
+                    return false;
+                }
                 if *is_rowid_alias {
                     return true;
                 }
@@ -3579,7 +3584,9 @@ impl Optimizable for ast::Expr {
                 // Other PRIMARY KEY types (e.g., TEXT PRIMARY KEY) can contain NULL.
                 column.is_rowid_alias() || column.notnull()
             }
-            Expr::RowId { .. } => true,
+            // A rowid is not NULL for a real table row. An outer join can
+            // replace that row with a synthetic row whose rowid is NULL.
+            Expr::RowId { table, .. } => !tables.outer_join_may_null_extend(*table),
             Expr::InList { lhs, rhs, .. } => {
                 lhs.is_nonnull(tables)
                     && (rhs.is_empty() || rhs.iter().all(|v| v.is_nonnull(tables)))
```

**File**: `core/translate/plan.rs` (modified, +8/-1)
```diff
@@ -1504,6 +1504,9 @@ pub struct OuterQueryReference {
     /// col_used_mask because rowid is not a real column and setting a fake
     /// column index in col_used_mask could mislead covering index decisions.
     pub rowid_referenced: bool,
+    /// Whether an outer join in an outer scope can replace this table's values
+    /// with NULL. The local FROM list does not contain that outer join.
+    pub outer_join_may_null_extend: bool,
     /// Scope depth for this outer reference. 0 = immediate outer scope,
     /// 1 = grandparent scope, etc. Used to avoid false "ambiguous column"
     /// errors when the same column name exists at different nesting depths.
@@ -1639,7 +1642,11 @@ impl TableReferences {
             .iter()
             .position(|t| t.internal_id == table)
         else {
-            return false;
+            // A correlated subquery does not have the outer FROM list. Its
+            // table reference carries the nullability from that outer scope.
+            return self
+                .find_outer_query_ref_by_internal_id(table)
+                .is_some_and(|outer_ref| outer_ref.outer_join_may_null_extend);
         };
         if self.joined_tables[pos]
             .join_info
```

**File**: `core/translate/planner.rs` (modified, +5/-0)
```diff
@@ -1238,6 +1238,7 @@ fn plan_cte(
                 // actually adds the table.
                 cte_definition_only: true,
                 rowid_referenced: false,
+                outer_join_may_null_extend: false,
                 scope_depth: 0,
             });
         }
@@ -1436,6 +1437,7 @@ fn prepare_recursive_cte_plan(
         cte_id: None,
         cte_definition_only: false,
         rowid_referenced: false,
+        outer_join_may_null_extend: false,
         scope_depth: 0,
     });
 
@@ -1569,6 +1571,7 @@ pub fn plan_ctes_as_outer_refs(
             cte_id: Some(cte_definition.cte_id),
             cte_definition_only: true,
             rowid_referenced: false,
+            outer_join_may_null_extend: false,
             scope_depth: 0,
         });
     }
@@ -1635,6 +1638,7 @@ fn parse_from_clause_table(
                     cte_id: Some(cte_definition.cte_id),
                     cte_definition_only: false,
                     rowid_referenced: false,
+                    outer_join_may_null_extend: false,
                     scope_depth: 0,
                 });
             }
@@ -2456,6 +2460,7 @@ pub fn parse_from(
                     // This entry only lets a nested FROM clause find the CTE name.
                     cte_definition_only: true,
                     rowid_referenced: false,
+                    outer_join_may_null_extend: false,
                     scope_depth: 0,
                 });
             }
```

**File**: `core/translate/subquery.rs` (modified, +3/-0)
```diff
@@ -615,6 +615,8 @@ fn plan_subqueries_with_outer_query_access<'a>(
                     cte_id,
                     cte_definition_only: false,
                     rowid_referenced: false,
+                    outer_join_may_null_extend: referenced_tables
+                        .outer_join_may_null_extend(t.internal_id),
                     scope_depth: 0,
                 };
                 Ok::<_, crate::LimboError>(outer_ref)
@@ -631,6 +633,7 @@ fn plan_subqueries_with_outer_query_access<'a>(
                     cte_id: t.cte_id, // Preserve CTE ID from outer query refs
                     cte_definition_only: t.cte_definition_only,
                     rowid_referenced: false,
+                    outer_join_may_null_extend: t.outer_join_may_null_extend,
                     scope_depth: t.scope_depth + 1,
                 })
             }))
```

**File**: `sqlite/conformance/sqlite-sqltests/joins/left_join_null_index_bug.sqltest` (modified, +22/-0)
```diff
@@ -25,6 +25,28 @@ expect {
 2||
 }
 
+# The first LEFT JOIN can replace a declared NOT NULL value with NULL. The
+# second join must not start an index range with that synthetic NULL value.
+@cross-check-integrity
+test left-join-range-seek-stops-on-null-extended-key {
+    CREATE TABLE range_left(seed INTEGER);
+    INSERT INTO range_left VALUES(1);
+    CREATE TABLE range_middle(key INTEGER NOT NULL);
+    CREATE TABLE range_right(value INTEGER);
+    CREATE INDEX range_right_value ON range_right(value);
+    INSERT INTO range_right VALUES(1);
+
+    SELECT quote(range_left.seed), quote(range_middle.key),
+           quote(range_right.value)
+      FROM range_left
+      LEFT JOIN range_middle ON true
+      LEFT JOIN range_right INDEXED BY range_right_value
+        ON range_middle.key<=range_right.value;
+}
+expect {
+    1|NULL|NULL
+}
+
 setup left-join-null-index-bug-composite-index-schema {
     CREATE TABLE a(id INTEGER PRIMARY KEY);
     CREATE TABLE b(id INTEGER PRIMARY KEY, a_id INTEGER);
```

**File**: `sqlite/conformance/sqlite-sqltests/snapshot_tests/joins/joins.sqltest` (modified, +19/-0)
```diff
@@ -896,6 +896,25 @@ snapshot left-join-expression-index-does-not-cover-null-row-columns {
         ON grouped_expr_right.a=grouped_expr_left.x;
 }
 
+setup left_join_null_range_schema {
+    CREATE TABLE null_range_left(seed INTEGER);
+    CREATE TABLE null_range_middle(key INTEGER NOT NULL);
+    CREATE TABLE null_range_right(value INTEGER);
+    CREATE INDEX null_range_right_value ON null_range_right(value);
+}
+
+# The first LEFT JOIN can make the declared NOT NULL key NULL. IsNull must stop
+# the later range seek before SeekGE reads that key.
+@setup left_join_null_range_schema
+snapshot left-join-range-seek-checks-null-extended-key {
+    SELECT null_range_left.seed, null_range_middle.key,
+           null_range_right.value
+      FROM null_range_left
+      LEFT JOIN null_range_middle ON true
+      LEFT JOIN null_range_right INDEXED BY null_range_right_value
+        ON null_range_middle.key<=null_range_right.value;
+}
+
 # =============================================================================
 # Hash Join Snapshot Tests
 # =============================================================================
```

---

### Incident Patch 13: `852e22cf` (2026-10-06)
**Commit Message**: Merge 'core: recompute expression-index values for outer null rows' from Jussi Saurio

## Problem

An expression index stores the expression's value for each real row.
When an outer join gives the indexed table a NULL row, Turso still read
the stored value, which is NULL. But the expression evaluated over NULL
columns is not always NULL:

```sql
CREATE TABLE l(x INT);
CREATE TABLE r(a INT, b INT);
CREATE INDEX r_idx ON r(a, coalesce(b, 7));
INSERT INTO l VALUES (1), (2);
INSERT INTO r VALUES (1, 10);

SELECT l.x, coalesce(r.b, 7) FROM l LEFT JOIN r INDEXED BY r_idx ON r.a = l.x;
-- SQLite: 1|10, 2|7
-- Turso before this PR: 1|10, 2|NULL
```

The same applies to `b IS NULL`, `CASE WHEN b IS NULL ...`,
`ifnull(...)`, and to these expressions in WHERE, ORDER BY, GROUP BY,
and aggregate arguments.

## Fix

Use SQLite's `IfNullRow` instruction: read the index value for a real
row, otherwise compute the expression from the table columns.

```
IfNullRow  idx  -> compute     ; null row?
Column     idx.coalesce(b,7)   ; no: read the stored value
Goto       done
compute:
Column     r.b                 ; yes: compute coalesce(b, 7)
NotNull / Integer 7
done:
```

Turso now emits the same opcod

**File**: `core/translate/emitter/mod.rs` (modified, +1/-0)
```diff
@@ -1074,6 +1074,7 @@ pub struct TranslateCtx<'a> {
     /// Only populated when GROUP BY uses a sorter, enabling deferred expression
     /// evaluation: the sorter stores raw columns instead of pre-computed expressions,
     /// and full expressions are re-evaluated from the pseudo cursor during aggregation.
+    /// An expression that the selected index stores is kept whole.
     pub agg_leaf_columns: Vec<Expr>,
     /// Cursor id for cdc table (if capture_data_changes PRAGMA is set and query can modify the data)
     pub cdc_cursor_id: Option<usize>,
```

**File**: `core/translate/expr/metadata.rs` (modified, +45/-15)
```diff
@@ -1,4 +1,5 @@
 use super::*;
+use crate::translate::expression_index::normalize_expr_for_index_matching;
 
 #[derive(Debug, Clone, Copy)]
 pub struct ConditionMetadata {
@@ -258,43 +259,72 @@ macro_rules! translate_fixed_insn {
 /// - SELECT a/b FROM t with INDEX ON t(a/b) (avoid computing a/b for every row)
 /// - ORDER BY a+b when the index already stores a+b (preserves ordering)
 ///
+/// If an outer join can set the index cursor to a null row, the original
+/// expression is computed for that row instead, as in SQLite: an expression
+/// over NULL inputs does not always produce NULL.
+///
 /// We mut do this check early in translate_expr so downstream translation does
 /// not build redundant bytecode.
 pub(super) fn try_emit_expression_index_value(
     program: &mut ProgramBuilder,
     referenced_tables: Option<&TableReferences>,
     expr: &ast::Expr,
     target_register: usize,
+    resolver: &Resolver,
 ) -> Result<bool> {
     let Some(referenced_tables) = referenced_tables else {
         return Ok(false);
     };
-    let Some((table_id, _)) = single_table_column_usage(expr) else {
-        return Ok(false);
-    };
-    let Some(table_reference) = referenced_tables.find_joined_table_by_internal_id(table_id) else {
-        return Ok(false);
-    };
-    let Some(index) = table_reference.op.index() else {
+    let Some((table, index, expression_position)) =
+        selected_expression_index(expr, referenced_tables)
+    else {
         return Ok(false);
     };
-    let normalized = normalize_expr_for_index_matching(expr, table_reference, referenced_tables);
-    if !table_reference
+    let normalized = normalize_expr_for_index_matching(expr, table, referenced_tables);
+    if !table
         .expression_index_usages
         .iter()
         .any(|usage| exprs_are_equivalent(&usage.normalized_expr, &normalized))
     {
         return Ok(false);
     }
-    let Some(expr_pos) = index.expression_to_index_pos(&normalized) else {
-        return Ok(false);
-    };
-    let Some(cursor_id) =
-        program.resolve_cursor_id_safe(&CursorKey::index(table_id, index.clone()))
+    let Some(index_cursor) =
+        program.resolve_cursor_id_safe(&CursorKey::index(table.internal_id, index.clone()))
     else {
         return Ok(false);
     };
-    program.emit_column_or_rowid(cursor_id, expr_pos, target_register);
+    if !referenced_tables.outer_join_may_null_extend(table.internal_id) {
+        program.emit_column_or_rowid(index_cursor, expression_position, target_register);
+        return Ok(true);
+    }
+
+    let compute_expression = program.allocate_label();
+    let expression_done = program.allocate_label();
+    program.emit_insn(Insn::IfNullRow {
+        cursor_id: index_cursor,
+        target_pc: compute_expression,
+        dest: target_register,
+    });
+    program.emit_column_or_rowid(index_cursor, expression_position, target_register);
+    program.emit_insn(Insn::Goto {
+        target_pc: expression_done,
+    });
+
+    program.preassign_label_to_next_insn(compute_expression);
+    let skipped_index_values = program.flags.skip_expression_index_values();
+    program.flags.set_skip_expression_index_values(true);
+    let result = translate_expr(
+        program,
+        Some(referenced_tables),
+        expr,
+        target_register,
+        resolver,
+    );
+    program
+        .flags
+        .set_skip_expression_index_values(skipped_index_values);
+    result?;
+    program.preassign_label_to_next_insn(expression_done);
     Ok(true)
 }
 
```

**File**: `core/translate/expr/mod.rs` (modified, +1/-3)
```diff
@@ -19,9 +19,7 @@ use crate::schema::{
     ParenthesizedJoinColumnVisibility, Table, Type, TypeDef,
 };
 use crate::sync::Arc;
-use crate::translate::expression_index::{
-    normalize_expr_for_index_matching, single_table_column_usage,
-};
+use crate::translate::expression_index::selected_expression_index;
 use crate::translate::plan::{ColumnMask, Operation, ResultSetColumn, Search};
 use crate::translate::planner::parse_row_id;
 use crate::util::{exprs_are_equivalent, normalize_ident, parse_numeric_literal};
```

**File**: `core/translate/expr/translator.rs` (modified, +16/-7)
```diff
@@ -123,6 +123,7 @@ pub fn translate_expr(
         referenced_tables,
         expr,
         target_register,
+        resolver,
     )? {
         translate_expr_by_kind(program, referenced_tables, expr, target_register, resolver)?;
     }
@@ -319,17 +320,19 @@ fn try_emit_expression_index_value_if_any(
     referenced_tables: Option<&TableReferences>,
     expr: &ast::Expr,
     target_register: usize,
+    resolver: &Resolver,
 ) -> Result<bool> {
-    let has_expression_indexes = referenced_tables.is_some_and(|tables| {
-        tables
-            .joined_tables()
-            .iter()
-            .any(|t| !t.expression_index_usages.is_empty())
-    });
+    let has_expression_indexes = !program.flags.skip_expression_index_values()
+        && referenced_tables.is_some_and(|tables| {
+            tables
+                .joined_tables()
+                .iter()
+                .any(|t| !t.expression_index_usages.is_empty())
+        });
     if !has_expression_indexes {
         return Ok(false);
     }
-    try_emit_expression_index_value(program, referenced_tables, expr, target_register)
+    try_emit_expression_index_value(program, referenced_tables, expr, target_register, resolver)
 }
 
 #[inline(never)]
@@ -2556,6 +2559,12 @@ fn translate_column_expr(
                     _ => {
                         let read_cursor = if read_from_index {
                             index_cursor_id.expect("index cursor should be opened")
+                        } else if is_btree_index {
+                            table_cursor_id.unwrap_or_else(|| {
+                                panic!(
+                                    "column {column} of table {table_ref_id} is not stored in the index and the table cursor is not open"
+                                )
+                            })
                         } else {
                             table_cursor_id
                                 .or(index_cursor_id)
```

**File**: `core/translate/expression_index.rs` (modified, +16/-1)
```diff
@@ -4,10 +4,25 @@ use crate::translate::expr::{
 };
 use crate::translate::plan::{ColumnUsedMask, JoinedTable, TableReferences};
 use crate::translate::planner::ROWID_STRS;
-use crate::Result;
+use crate::{schema::Index, sync::Arc, Result};
 use turso_parser::ast;
 use turso_parser::ast::TableInternalId;
 
+/// Find the selected index key that stores this complete expression.
+///
+/// GROUP BY and expression translation must use the same match rules.
+pub fn selected_expression_index<'a>(
+    expr: &ast::Expr,
+    table_references: &'a TableReferences,
+) -> Option<(&'a JoinedTable, &'a Arc<Index>, usize)> {
+    let (table_id, _) = single_table_column_usage(expr)?;
+    let table = table_references.find_joined_table_by_internal_id(table_id)?;
+    let index = table.op.index()?;
+    let normalized = normalize_expr_for_index_matching(expr, table, table_references);
+    let expression_position = index.expression_to_index_pos(&normalized)?;
+    Some((table, index, expression_position))
+}
+
 /// Normalize a query expression so it can be compared with an
 /// expression stored on an index definition.
 ///
```

**File**: `core/translate/group_by.rs` (modified, +10/-0)
```diff
@@ -10,6 +10,7 @@ use super::{
 use crate::function::AccumulatorFunc;
 use crate::translate::{
     aggregation::{translate_aggregation_step, AggArgumentSource},
+    expression_index::selected_expression_index,
     order_by::{custom_type_comparator, EmitOrderBy},
     plan::{Aggregate, NonFromClauseSubquery},
     subquery::emit_non_from_clause_subqueries_for_phase,
@@ -357,9 +358,18 @@ pub fn compute_group_by_sort_order(
 /// scan loop, stored in the sorter, and read back during the sorter loop so that
 /// each sorted row sees the correct subquery result instead of a stale register
 /// value left over from the last scanned row.
+///
+/// An expression that the selected index stores is saved whole, as in SQLite,
+/// so the sorter row keeps the index value instead of recomputing it.
 fn collect_agg_leaf_columns(aggregates: &[Aggregate], plan: &SelectPlan) -> Result<Vec<ast::Expr>> {
     let mut leaf_columns: Vec<ast::Expr> = Vec::new();
     let mut collect = |expr: &ast::Expr| -> Result<WalkControl> {
+        if selected_expression_index(expr, &plan.table_references).is_some() {
+            if !leaf_columns.iter().any(|e| exprs_are_equivalent(e, expr)) {
+                leaf_columns.push(expr.clone());
+            }
+            return Ok(WalkControl::SkipChildren);
+        }
         match expr {
             ast::Expr::Column { table, .. } | ast::Expr::RowId { table, .. } => {
                 if plan
```

**File**: `core/translate/optimizer/mod.rs` (modified, +65/-53)
```diff
@@ -23,7 +23,8 @@ use crate::{
     },
     translate::{
         expr::{
-            expr_references_any_subquery, expr_references_outer_query, expression_can_fail_on_input,
+            expr_references_any_subquery, expr_references_outer_query,
+            expression_can_fail_on_input, walk_expr, WalkControl,
         },
         insert::ROWID_COLUMN,
         optimizer::{
@@ -2029,7 +2030,8 @@ fn optimize_table_access_with_custom_modules(
 }
 
 /// We do a single pass over projected, grouping, filtering, and ordering expressions to
-/// capture every expression that could be served directly from an expression index.
+/// capture every expression that could be served directly from an expression index,
+/// including parts of larger expressions such as `lower(a)` inside an aggregate argument.
 /// Example:
 ///   CREATE INDEX idx ON t(lower(a));
 ///   SELECT lower(a) FROM t WHERE lower(a) ORDER BY lower(a);
@@ -2046,29 +2048,37 @@ fn register_index_expression_usages_for_plan(
     )],
     group_by: Option<&GroupBy>,
     where_clause: &mut [WhereTerm],
-) {
+) -> Result<()> {
     table_references.reset_expression_index_usages();
 
+    let mut register = |expr: &ast::Expr| {
+        walk_expr(expr, &mut |part| {
+            table_references.register_expression_index_usage(part);
+            Ok(WalkControl::Continue)
+        })
+    };
+
     for rc in result_columns {
-        table_references.register_expression_index_usage(&rc.expr);
+        register(&rc.expr)?;
     }
     for (expr, _, _) in order_by {
-        table_references.register_expression_index_usage(expr);
+        register(expr)?;
     }
     for where_term in where_clause {
-        table_references.register_expression_index_usage(&where_term.expr);
+        register(&where_term.expr)?;
     }
 
     if let Some(group_by) = group_by {
         for expr in &group_by.exprs {
-            table_references.register_expression_index_usage(expr);
+            register(expr)?;
         }
         if let Some(having) = &group_by.having {
             for expr in having {
-                table_references.register_expression_index_usage(expr);
+                register(expr)?;
             }
         }
     }
+    Ok(())
 }
 
 /// Derive a base row-count estimate for a table, preferring ANALYZE stats.
@@ -2473,6 +2483,52 @@ fn find_table_access_plan(
         );
     }
 
+    // Currently the expressions we evaluate as constraints are binary comparisons that (except for IS/IS NOT)
+    // will never be true for a NULL operand.
+    // If there are any constraints on the right hand side table of an outer join that are not part of the outer join condition,
+    // the outer join can be converted into an inner join.
+    // for example:
+    // - SELECT * FROM t1 LEFT JOIN t2 ON false WHERE t2.id = 5
+    // there can never be a situation where null columns are emitted for t2 because t2.id = 5 will never be true in that case.
+    // hence: we can convert the outer join into an inner join.
+    //
+    // Converting a LEFT JOIN into an INNER JOIN can enable join reordering.
+    // Expression index usages below depend on which tables can still be null-extended.
+    loop {
+        let mut outer_join_rewritten = false;
+        for t in table_references.joined_tables_mut().iter_mut().filter(|t| {
+            t.join_info
+                .as_ref()
+                // Skip FULL OUTER JOIN tables: removing `outer` would suppress
+                // unmatched-probe-row emission and prevent LeftJoinMetadata
+                // allocation needed by the hash join.
+                .is_some_and(|join_info| join_info.is_outer() && !join_info.is_full_outer())
+        }) {
+            // Check if a WHERE term filters out the join's null-extended rows,
+            // allowing us to convert the LEFT JOIN into an INNER JOIN for join
+            // reordering purposes. This looks at the raw WHERE terms, not the
+            // extracted constraints, so terms that never become constraints
+            // (like `t.v = 5 OR t.w = 7`) also count.
+            if where_clause.iter().any(|term| {
+                term.from_outer_join.is_none()
+                    && where_term_is_null_rejecting_for_table(&term.expr, t.internal_id)
+            }) {
+                t.join_info.as_mut().unwrap().join_type = JoinType::Inner;
+                for term in where_clause.iter_mut() {
+                    if let Some(from_outer_join) = term.from_outer_join {
+                        if from_outer_join == t.internal_id {
+                            term.from_outer_join = None;
+                        }
+                    }
+                }
+                outer_join_rewritten = true;
+            }
+        }
+        if !outer_join_rewritten {
+            break;
+        }
+    }
+
     let has_expression_idx_or_partial_idx = table_references.joined_tables().iter().any(|t| {
         matches!(&t.table, Table::BTree(_) if available_indexes
             .inde
```

**File**: `core/translate/plan.rs` (modified, +16/-6)
```diff
@@ -1696,12 +1696,17 @@ impl TableReferences {
             return;
         };
         let normalized = normalize_expr_for_index_matching(expr, table_ref, self);
+        let may_be_null_row = self.outer_join_may_null_extend(table_id);
         if let Some(table_ref_mut) = self
             .joined_tables_mut()
             .iter_mut()
             .find(|t| t.internal_id == table_id)
         {
-            table_ref_mut.register_expression_index_usage(normalized, columns_mask);
+            table_ref_mut.register_expression_index_usage(
+                normalized,
+                columns_mask,
+                may_be_null_row,
+            );
         }
     }
 
@@ -2419,6 +2424,9 @@ pub struct ExpressionIndexUsage {
     /// Columns required to compute the expression. Helps decide whether using
     /// the expression value from the index fully covers those column reads.
     pub columns_mask: ColumnUsedMask,
+    /// An outer join can set this table to a null row. That row computes the
+    /// expression from the table columns, so the index key does not cover them.
+    pub may_be_null_row: bool,
 }
 
 /// Represents one key pair in a hash join equality condition.
@@ -2956,6 +2964,7 @@ impl JoinedTable {
         &mut self,
         normalized_expr: ast::Expr,
         columns_mask: ColumnUsedMask,
+        may_be_null_row: bool,
     ) {
         if columns_mask.is_empty() {
             return;
@@ -2970,6 +2979,7 @@ impl JoinedTable {
         self.expression_index_usages.push(ExpressionIndexUsage {
             normalized_expr: Box::new(normalized_expr),
             columns_mask,
+            may_be_null_row,
         });
     }
 
@@ -2996,11 +3006,11 @@ impl JoinedTable {
                 false
             };
 
-            if index
-                .expression_to_index_pos(&usage.normalized_expr)
-                .is_some()
-                || matches_where_clause
-            {
+            let index_key_covers_columns = !usage.may_be_null_row
+                && index
+                    .expression_to_index_pos(&usage.normalized_expr)
+                    .is_some();
+            if index_key_covers_columns || matches_where_clause {
                 any_covered = true;
                 for col_idx in usage.columns_mask.iter() {
                     if col_idx >= coverage_counts.len() {
```

---

### Incident Patch 14: `99ed7356` (2026-10-06)
**Commit Message**: test: cover expression-index values on outer-join null rows

The focused tests cover one query shape each. These matrices cross the ways a
table can get a NULL row (LEFT JOIN with a forced, forbidden, or chosen index,
RIGHT JOIN, a LEFT JOIN chain, an index with the expression as its leading
key, and a parenthesized join group) with expressions that are not NULL for
NULL inputs (coalesce, IS NULL, CASE, ifnull) and with the places that read
them: result columns, WHERE, ORDER BY, GROUP BY keys, aggregate arguments
with FILTER and HAVING, DISTINCT, windows, subqueries, CTEs, and compound
selects. Each expansion is compared against the bundled SQLite.

Tests: expression-index-outer-join.sqltest (318 cases)

**File**: `sqlite/conformance/sqlite-sqltests/expression-index-outer-join.sqltest` (added, +158/-0)
```diff
@@ -0,0 +1,158 @@
+@database :memory:
+
+# An expression index stores the value for a real row. When an outer join gives
+# the indexed table a NULL row, the expression is computed from NULL columns
+# instead, and some expressions (coalesce, IS NULL, CASE) are not NULL there.
+# Every matrix case is compared against SQLite.
+
+setup ei {
+    CREATE TABLE l(x INT, k INT);
+    CREATE TABLE r(a INT, b INT, c TEXT);
+    CREATE TABLE s(a INT, d INT);
+    CREATE INDEX r_all ON r(a, coalesce(b,7), b IS NULL, ifnull(c,'none'),
+        CASE WHEN b IS NULL THEN 'nb' ELSE 'b' END, b + 1, length(c));
+    CREATE INDEX r_expr_first ON r(coalesce(b,7), a);
+    CREATE INDEX s_expr ON s(a, coalesce(d,-1));
+    INSERT INTO l VALUES (1, 1), (2, 1), (3, 2), (4, 2), (NULL, 3);
+    INSERT INTO r VALUES (1, 10, 'x'), (1, NULL, NULL), (2, NULL, 'yy'), (5, 50, 'z'), (NULL, 7, 'n');
+    INSERT INTO s VALUES (1, NULL), (2, 20), (4, NULL);
+}
+
+@setup ei
+@var from {
+    l LEFT JOIN r INDEXED BY r_all ON r.a = l.x |
+    l LEFT JOIN r NOT INDEXED ON r.a = l.x |
+    l LEFT JOIN r ON r.a = l.x |
+    l LEFT JOIN r INDEXED BY r_all ON r.a = l.x AND r.b > 5 |
+    l LEFT JOIN r INDEXED BY r_all ON r.a = l.k |
+    r INDEXED BY r_all RIGHT JOIN l ON r.a = l.x |
+    l LEFT JOIN r INDEXED BY r_expr_first ON coalesce(r.b,7) = l.x + 6 |
+    l LEFT JOIN (r JOIN s USING(a)) ON r.a = l.x |
+    l LEFT JOIN r INDEXED BY r_all ON r.a = l.x LEFT JOIN s ON s.a = l.k
+}
+@var e { coalesce(r.b,7) | r.b IS NULL | ifnull(r.c,'none') | CASE WHEN r.b IS NULL THEN 'nb' ELSE 'b' END | r.b + 1 | length(r.c) }
+matrix null-row-expression-in-result {
+    SELECT l.rowid, r.rowid, $e FROM $from ORDER BY 1, 2, 3;
+}
+
+@setup ei
+@var from {
+    l LEFT JOIN r INDEXED BY r_all ON r.a = l.x |
+    l LEFT JOIN r ON r.a = l.x |
+    l LEFT JOIN r INDEXED BY r_all ON r.a = l.k |
+    r INDEXED BY r_all RIGHT JOIN l ON r.a = l.x |
+    l LEFT JOIN (r JOIN s USING(a)) ON r.a = l.x
+}
+@var pred {
+    coalesce(r.b,7) = 7 | coalesce(r.b,7) > 7 | r.b IS NULL | NOT (r.b IS NULL) |
+    ifnull(r.c,'none') = 'none' | CASE WHEN r.b IS NULL THEN 'nb' ELSE 'b' END = 'nb' |
+    r.b + 1 IS NULL | length(r.c) IS NULL | coalesce(r.b,7) IN (7, 11) |
+    coalesce(r.b,7) = 7 OR l.x = 4
+}
+matrix null-row-expression-in-where {
+    SELECT l.rowid, r.rowid FROM $from WHERE $pred ORDER BY 1, 2;
+}
+
+@setup ei
+@var from {
+    l LEFT JOIN r INDEXED BY r_all ON r.a = l.x |
+    l LEFT JOIN r ON r.a = l.x |
+    l LEFT JOIN r INDEXED BY r_all ON r.a = l.k |
+    r INDEXED BY r_all RIGHT JOIN l ON r.a = l.x |
+    l LEFT JOIN (r JOIN s USING(a)) ON r.a = l.x
+}
+@var e { coalesce(r.b,7) | r.b IS NULL | ifnull(r.c,'none') | CASE WHEN r.b IS NULL THEN 'nb' ELSE 'b' END | r.b + 1 | length(r.c) }
+matrix null-row-expression-as-group-key {
+    SELECT $e, count(*), sum(l.x) FROM $from GROUP BY $e ORDER BY 1;
+}
+
+@setup ei
+@var from {
+    l LEFT JOIN r INDEXED BY r_all ON r.a = l.x |
+    l LEFT JOIN r NOT INDEXED ON r.a = l.x |
+    l LEFT JOIN r ON r.a = l.x |
+    l LEFT JOIN r INDEXED BY r_all ON r.a = l.k |
+    r INDEXED BY r_all RIGHT JOIN l ON r.a = l.x |
+    l LEFT JOIN r INDEXED BY r_expr_first ON coalesce(r.b,7) = l.x + 6 |
+    l LEFT JOIN (r JOIN s USING(a)) ON r.a = l.x |
+    l LEFT JOIN r INDEXED BY r_all ON r.a = l.x LEFT JOIN s ON s.a = l.k
+}
+@var agg {
+    sum(coalesce(r.b,7)) | count(CASE WHEN r.b IS NULL THEN 'nb' ELSE 'b' END) |
+    max(ifnull(r.c,'none')) | total(r.b + 1) | sum(r.b IS NULL) |
+    sum(CASE WHEN coalesce(r.b,7) = 7 THEN 1 END) |
+    min(coalesce(r.b,7)) FILTER (WHERE r.b IS NULL) |
+    count(DISTINCT coalesce(r.b,7)) | avg(length(r.c)) |
+    sum(coalesce(r.b,7)) + max(r.b IS NULL)
+}
+matrix null-row-expression-in-grouped-aggregate {
+    SELECT l.k, $agg FROM $from GROUP BY l.k ORDER BY 1;
+}
+
+@setup ei
+@var from {
+    l LEFT JOIN r INDEXED BY r_all ON r.a = l.x |
+    l LEFT JOIN r ON r.a = l.x |
+    r INDEXED BY r_all RIGHT JOIN l ON r.a = l.x |
+    l LEFT JOIN (r JOIN s USING(a)) ON r.a = l.x
+}
+@var agg {
+    sum(coalesce(r.b,7)) | sum(r.b IS NULL) | max(ifnull(r.c,'none')) |
+    count(DISTINCT CASE WHEN r.b IS NULL THEN 'nb' ELSE 'b' END) |
+    total(r.b + 1) FILTER (WHERE coalesce(r.b,7) = 7)
+}
+@var having { 1 | sum(coalesce(r.b,7)) > 7 | max(r.b IS NULL) = 1 }
+matrix null-row-expression-in-aggregate-with-having {
+    SELECT $agg FROM $from HAVING $having;
+}
+
+@setup ei
+@var from {
+    l LEFT JOIN r INDEXED BY r_all ON r.a = l.x |
+    l LEFT JOIN r ON r.a = l.x |
+    r INDEXED BY r_all RIGHT JOIN l ON r.a = l.x |
+    l LEFT JOIN (r JOIN s USING(a)) ON r.a = l.x
+}
+@var shape {
+    SELECT DISTINCT coalesce(r.b,7) FROM |
+    SELECT DISTINCT r.b IS NULL, ifnull(r.c,'none') FROM |
+    SELECT l.rowid, r.rowid, sum(coalesce(r.b,7)) OVER (ORDER BY l.rowid, r.rowid) FROM |
+    SELECT l.rowid, r.rowid, count(*) OVER (PARTITION BY r.b IS NULL ORDER BY l.rowid, r.rowid) FROM |
+    SELECT l.rowid, r.rowi
```

---

### Incident Patch 15: `78361bbb` (2026-09-04)
**Commit Message**: core: recompute expression-index values for outer null rows

An expression index stores the value for a real table row. An outer join can replace that row with NULL, and the original expression can produce a non-NULL result for NULL inputs.

Match SQLite's IfNullRow sequence. Save complete indexed expressions in GROUP BY sorter rows because the source cursors are not valid when the sorter reads them.

The IfNullRow branch computes the expression from the table columns, so an expression index no longer counts as covering those columns when an outer join can null-extend the table. LEFT JOINs that a WHERE term turns into inner joins are rewritten before this check, so they keep the covering plan.

Tests: cargo test -p turso_core if_null_row; group-by-expression-index.sqltest; left-join-group-by-keeps-expression-index-value and left-join-expression-index-does-not-cover-null-row-columns snapshots

**File**: `core/translate/emitter/mod.rs` (modified, +1/-0)
```diff
@@ -1074,6 +1074,7 @@ pub struct TranslateCtx<'a> {
     /// Only populated when GROUP BY uses a sorter, enabling deferred expression
     /// evaluation: the sorter stores raw columns instead of pre-computed expressions,
     /// and full expressions are re-evaluated from the pseudo cursor during aggregation.
+    /// An expression that the selected index stores is kept whole.
     pub agg_leaf_columns: Vec<Expr>,
     /// Cursor id for cdc table (if capture_data_changes PRAGMA is set and query can modify the data)
     pub cdc_cursor_id: Option<usize>,
```

**File**: `core/translate/expr/metadata.rs` (modified, +45/-15)
```diff
@@ -1,4 +1,5 @@
 use super::*;
+use crate::translate::expression_index::normalize_expr_for_index_matching;
 
 #[derive(Debug, Clone, Copy)]
 pub struct ConditionMetadata {
@@ -258,43 +259,72 @@ macro_rules! translate_fixed_insn {
 /// - SELECT a/b FROM t with INDEX ON t(a/b) (avoid computing a/b for every row)
 /// - ORDER BY a+b when the index already stores a+b (preserves ordering)
 ///
+/// If an outer join can set the index cursor to a null row, the original
+/// expression is computed for that row instead, as in SQLite: an expression
+/// over NULL inputs does not always produce NULL.
+///
 /// We mut do this check early in translate_expr so downstream translation does
 /// not build redundant bytecode.
 pub(super) fn try_emit_expression_index_value(
     program: &mut ProgramBuilder,
     referenced_tables: Option<&TableReferences>,
     expr: &ast::Expr,
     target_register: usize,
+    resolver: &Resolver,
 ) -> Result<bool> {
     let Some(referenced_tables) = referenced_tables else {
         return Ok(false);
     };
-    let Some((table_id, _)) = single_table_column_usage(expr) else {
-        return Ok(false);
-    };
-    let Some(table_reference) = referenced_tables.find_joined_table_by_internal_id(table_id) else {
-        return Ok(false);
-    };
-    let Some(index) = table_reference.op.index() else {
+    let Some((table, index, expression_position)) =
+        selected_expression_index(expr, referenced_tables)
+    else {
         return Ok(false);
     };
-    let normalized = normalize_expr_for_index_matching(expr, table_reference, referenced_tables);
-    if !table_reference
+    let normalized = normalize_expr_for_index_matching(expr, table, referenced_tables);
+    if !table
         .expression_index_usages
         .iter()
         .any(|usage| exprs_are_equivalent(&usage.normalized_expr, &normalized))
     {
         return Ok(false);
     }
-    let Some(expr_pos) = index.expression_to_index_pos(&normalized) else {
-        return Ok(false);
-    };
-    let Some(cursor_id) =
-        program.resolve_cursor_id_safe(&CursorKey::index(table_id, index.clone()))
+    let Some(index_cursor) =
+        program.resolve_cursor_id_safe(&CursorKey::index(table.internal_id, index.clone()))
     else {
         return Ok(false);
     };
-    program.emit_column_or_rowid(cursor_id, expr_pos, target_register);
+    if !referenced_tables.outer_join_may_null_extend(table.internal_id) {
+        program.emit_column_or_rowid(index_cursor, expression_position, target_register);
+        return Ok(true);
+    }
+
+    let compute_expression = program.allocate_label();
+    let expression_done = program.allocate_label();
+    program.emit_insn(Insn::IfNullRow {
+        cursor_id: index_cursor,
+        target_pc: compute_expression,
+        dest: target_register,
+    });
+    program.emit_column_or_rowid(index_cursor, expression_position, target_register);
+    program.emit_insn(Insn::Goto {
+        target_pc: expression_done,
+    });
+
+    program.preassign_label_to_next_insn(compute_expression);
+    let skipped_index_values = program.flags.skip_expression_index_values();
+    program.flags.set_skip_expression_index_values(true);
+    let result = translate_expr(
+        program,
+        Some(referenced_tables),
+        expr,
+        target_register,
+        resolver,
+    );
+    program
+        .flags
+        .set_skip_expression_index_values(skipped_index_values);
+    result?;
+    program.preassign_label_to_next_insn(expression_done);
     Ok(true)
 }
 
```

**File**: `core/translate/expr/mod.rs` (modified, +1/-3)
```diff
@@ -19,9 +19,7 @@ use crate::schema::{
     ParenthesizedJoinColumnVisibility, Table, Type, TypeDef,
 };
 use crate::sync::Arc;
-use crate::translate::expression_index::{
-    normalize_expr_for_index_matching, single_table_column_usage,
-};
+use crate::translate::expression_index::selected_expression_index;
 use crate::translate::plan::{ColumnMask, Operation, ResultSetColumn, Search};
 use crate::translate::planner::parse_row_id;
 use crate::util::{exprs_are_equivalent, normalize_ident, parse_numeric_literal};
```

**File**: `core/translate/expr/translator.rs` (modified, +10/-7)
```diff
@@ -123,6 +123,7 @@ pub fn translate_expr(
         referenced_tables,
         expr,
         target_register,
+        resolver,
     )? {
         translate_expr_by_kind(program, referenced_tables, expr, target_register, resolver)?;
     }
@@ -319,17 +320,19 @@ fn try_emit_expression_index_value_if_any(
     referenced_tables: Option<&TableReferences>,
     expr: &ast::Expr,
     target_register: usize,
+    resolver: &Resolver,
 ) -> Result<bool> {
-    let has_expression_indexes = referenced_tables.is_some_and(|tables| {
-        tables
-            .joined_tables()
-            .iter()
-            .any(|t| !t.expression_index_usages.is_empty())
-    });
+    let has_expression_indexes = !program.flags.skip_expression_index_values()
+        && referenced_tables.is_some_and(|tables| {
+            tables
+                .joined_tables()
+                .iter()
+                .any(|t| !t.expression_index_usages.is_empty())
+        });
     if !has_expression_indexes {
         return Ok(false);
     }
-    try_emit_expression_index_value(program, referenced_tables, expr, target_register)
+    try_emit_expression_index_value(program, referenced_tables, expr, target_register, resolver)
 }
 
 #[inline(never)]
```

**File**: `core/translate/expression_index.rs` (modified, +16/-1)
```diff
@@ -4,10 +4,25 @@ use crate::translate::expr::{
 };
 use crate::translate::plan::{ColumnUsedMask, JoinedTable, TableReferences};
 use crate::translate::planner::ROWID_STRS;
-use crate::Result;
+use crate::{schema::Index, sync::Arc, Result};
 use turso_parser::ast;
 use turso_parser::ast::TableInternalId;
 
+/// Find the selected index key that stores this complete expression.
+///
+/// GROUP BY and expression translation must use the same match rules.
+pub fn selected_expression_index<'a>(
+    expr: &ast::Expr,
+    table_references: &'a TableReferences,
+) -> Option<(&'a JoinedTable, &'a Arc<Index>, usize)> {
+    let (table_id, _) = single_table_column_usage(expr)?;
+    let table = table_references.find_joined_table_by_internal_id(table_id)?;
+    let index = table.op.index()?;
+    let normalized = normalize_expr_for_index_matching(expr, table, table_references);
+    let expression_position = index.expression_to_index_pos(&normalized)?;
+    Some((table, index, expression_position))
+}
+
 /// Normalize a query expression so it can be compared with an
 /// expression stored on an index definition.
 ///
```

**File**: `core/translate/group_by.rs` (modified, +10/-0)
```diff
@@ -10,6 +10,7 @@ use super::{
 use crate::function::AccumulatorFunc;
 use crate::translate::{
     aggregation::{translate_aggregation_step, AggArgumentSource},
+    expression_index::selected_expression_index,
     order_by::{custom_type_comparator, EmitOrderBy},
     plan::{Aggregate, NonFromClauseSubquery},
     subquery::emit_non_from_clause_subqueries_for_phase,
@@ -357,9 +358,18 @@ pub fn compute_group_by_sort_order(
 /// scan loop, stored in the sorter, and read back during the sorter loop so that
 /// each sorted row sees the correct subquery result instead of a stale register
 /// value left over from the last scanned row.
+///
+/// An expression that the selected index stores is saved whole, as in SQLite,
+/// so the sorter row keeps the index value instead of recomputing it.
 fn collect_agg_leaf_columns(aggregates: &[Aggregate], plan: &SelectPlan) -> Result<Vec<ast::Expr>> {
     let mut leaf_columns: Vec<ast::Expr> = Vec::new();
     let mut collect = |expr: &ast::Expr| -> Result<WalkControl> {
+        if selected_expression_index(expr, &plan.table_references).is_some() {
+            if !leaf_columns.iter().any(|e| exprs_are_equivalent(e, expr)) {
+                leaf_columns.push(expr.clone());
+            }
+            return Ok(WalkControl::SkipChildren);
+        }
         match expr {
             ast::Expr::Column { table, .. } | ast::Expr::RowId { table, .. } => {
                 if plan
```

**File**: `core/translate/optimizer/mod.rs` (modified, +46/-44)
```diff
@@ -2473,6 +2473,52 @@ fn find_table_access_plan(
         );
     }
 
+    // Currently the expressions we evaluate as constraints are binary comparisons that (except for IS/IS NOT)
+    // will never be true for a NULL operand.
+    // If there are any constraints on the right hand side table of an outer join that are not part of the outer join condition,
+    // the outer join can be converted into an inner join.
+    // for example:
+    // - SELECT * FROM t1 LEFT JOIN t2 ON false WHERE t2.id = 5
+    // there can never be a situation where null columns are emitted for t2 because t2.id = 5 will never be true in that case.
+    // hence: we can convert the outer join into an inner join.
+    //
+    // Converting a LEFT JOIN into an INNER JOIN can enable join reordering.
+    // Expression index usages below depend on which tables can still be null-extended.
+    loop {
+        let mut outer_join_rewritten = false;
+        for t in table_references.joined_tables_mut().iter_mut().filter(|t| {
+            t.join_info
+                .as_ref()
+                // Skip FULL OUTER JOIN tables: removing `outer` would suppress
+                // unmatched-probe-row emission and prevent LeftJoinMetadata
+                // allocation needed by the hash join.
+                .is_some_and(|join_info| join_info.is_outer() && !join_info.is_full_outer())
+        }) {
+            // Check if a WHERE term filters out the join's null-extended rows,
+            // allowing us to convert the LEFT JOIN into an INNER JOIN for join
+            // reordering purposes. This looks at the raw WHERE terms, not the
+            // extracted constraints, so terms that never become constraints
+            // (like `t.v = 5 OR t.w = 7`) also count.
+            if where_clause.iter().any(|term| {
+                term.from_outer_join.is_none()
+                    && where_term_is_null_rejecting_for_table(&term.expr, t.internal_id)
+            }) {
+                t.join_info.as_mut().unwrap().join_type = JoinType::Inner;
+                for term in where_clause.iter_mut() {
+                    if let Some(from_outer_join) = term.from_outer_join {
+                        if from_outer_join == t.internal_id {
+                            term.from_outer_join = None;
+                        }
+                    }
+                }
+                outer_join_rewritten = true;
+            }
+        }
+        if !outer_join_rewritten {
+            break;
+        }
+    }
+
     let has_expression_idx_or_partial_idx = table_references.joined_tables().iter().any(|t| {
         matches!(&t.table, Table::BTree(_) if available_indexes
             .indexes_for_table(t.internal_id)
@@ -2542,50 +2588,6 @@ fn find_table_access_plan(
     let maybe_order_target = simple_aggregate
         .and_then(|sa| simple_aggregate_order_target(sa, table_references))
         .or_else(|| compute_order_target(order_by, group_by.as_mut(), table_references));
-    // Currently the expressions we evaluate as constraints are binary comparisons that (except for IS/IS NOT)
-    // will never be true for a NULL operand.
-    // If there are any constraints on the right hand side table of an outer join that are not part of the outer join condition,
-    // the outer join can be converted into an inner join.
-    // for example:
-    // - SELECT * FROM t1 LEFT JOIN t2 ON false WHERE t2.id = 5
-    // there can never be a situation where null columns are emitted for t2 because t2.id = 5 will never be true in that case.
-    // hence: we can convert the outer join into an inner join.
-    //
-    // Converting a LEFT JOIN into an INNER JOIN can enable join reordering.
-    loop {
-        let mut outer_join_rewritten = false;
-        for t in table_references.joined_tables_mut().iter_mut().filter(|t| {
-            t.join_info
-                .as_ref()
-                // Skip FULL OUTER JOIN tables: removing `outer` would suppress
-                // unmatched-probe-row emission and prevent LeftJoinMetadata
-                // allocation needed by the hash join.
-                .is_some_and(|join_info| join_info.is_outer() && !join_info.is_full_outer())
-        }) {
-            // Check if a WHERE term filters out the join's null-extended rows,
-            // allowing us to convert the LEFT JOIN into an INNER JOIN for join
-            // reordering purposes. This looks at the raw WHERE terms, not the
-            // extracted constraints, so terms that never become constraints
-            // (like `t.v = 5 OR t.w = 7`) also count.
-            if where_clause.iter().any(|term| {
-                term.from_outer_join.is_none()
-                    && where_term_is_null_rejecting_for_table(&term.expr, t.internal_id)
-            }) {
-                t.join_info.as_mut().unwrap().join_type = JoinType::Inner;
-                for term in where_clause.iter_mut() {
-                    if let Some(from_outer_join) = term.from_outer_join {
- 
```

**File**: `core/translate/plan.rs` (modified, +16/-6)
```diff
@@ -1696,12 +1696,17 @@ impl TableReferences {
             return;
         };
         let normalized = normalize_expr_for_index_matching(expr, table_ref, self);
+        let may_be_null_row = self.outer_join_may_null_extend(table_id);
         if let Some(table_ref_mut) = self
             .joined_tables_mut()
             .iter_mut()
             .find(|t| t.internal_id == table_id)
         {
-            table_ref_mut.register_expression_index_usage(normalized, columns_mask);
+            table_ref_mut.register_expression_index_usage(
+                normalized,
+                columns_mask,
+                may_be_null_row,
+            );
         }
     }
 
@@ -2419,6 +2424,9 @@ pub struct ExpressionIndexUsage {
     /// Columns required to compute the expression. Helps decide whether using
     /// the expression value from the index fully covers those column reads.
     pub columns_mask: ColumnUsedMask,
+    /// An outer join can set this table to a null row. That row computes the
+    /// expression from the table columns, so the index key does not cover them.
+    pub may_be_null_row: bool,
 }
 
 /// Represents one key pair in a hash join equality condition.
@@ -2956,6 +2964,7 @@ impl JoinedTable {
         &mut self,
         normalized_expr: ast::Expr,
         columns_mask: ColumnUsedMask,
+        may_be_null_row: bool,
     ) {
         if columns_mask.is_empty() {
             return;
@@ -2970,6 +2979,7 @@ impl JoinedTable {
         self.expression_index_usages.push(ExpressionIndexUsage {
             normalized_expr: Box::new(normalized_expr),
             columns_mask,
+            may_be_null_row,
         });
     }
 
@@ -2996,11 +3006,11 @@ impl JoinedTable {
                 false
             };
 
-            if index
-                .expression_to_index_pos(&usage.normalized_expr)
-                .is_some()
-                || matches_where_clause
-            {
+            let index_key_covers_columns = !usage.may_be_null_row
+                && index
+                    .expression_to_index_pos(&usage.normalized_expr)
+                    .is_some();
+            if index_key_covers_columns || matches_where_clause {
                 any_covered = true;
                 for col_idx in usage.columns_mask.iter() {
                     if col_idx >= coverage_counts.len() {
```

#### Recent Merged Pull Requests:
- **PR #9569** (2026-10-07): core/mvcc: keep the index map of a rolled-back CREATE INDEX alive for open cursors (@jussisaurio)
- **PR #9566** (2026-10-07): core/json: propagate errors from json_remove, json_insert and json_replace (@suhasaitham22)
- **PR #9565** (closed): ci: run core and integration tests with AddressSanitizer (@LeMikaelF)
- **PR #9561** (2026-10-06): docs: make test evidence mandatory for every change (@pedrocarlo)
- **PR #9558** (2026-10-06): core: register dialect native extensions at open (@pedrocarlo)
- **PR #9557** (2026-10-07): core/vdbe: roll back TEMP pager savepoints under MVCC (@pereman2)
- **PR #9556** (2026-10-06): core: preserve table functions before parsing stored views (@pedrocarlo)
- **PR #9555** (closed): core: limit internal helper nesting to each operation (@pedrocarlo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
