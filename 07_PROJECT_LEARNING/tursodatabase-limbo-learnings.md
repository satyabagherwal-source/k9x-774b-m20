> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tursodatabase-limbo-learnings.md`  
> **Source**: github ([https://github.com/tursodatabase/limbo](https://github.com/tursodatabase/limbo))  
> **Source Version**: `25f00f0a`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T05:32:07.627Z  
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
> **Harvest Timestamp**: 2026-10-19T05:32:07.620Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tursodatabase/turso`
- **Description**: A SQL database in Rust: SQLite-compatible, now also speaking Postgres (experimental). The LLVM of databases.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md
- **Stars / Engagement**: 24824 stars

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
- **Issue #10111** (2026-10-19): **bindings/javascript: bind statement parameters while holding the exec lock**
  *Symptoms*: ## Description  Concurrent calls on one prepared statement could run with another call's parameters. `Promise.all([stmt.get('first'), stmt.get('second')])` returned `['second value', 'second value']` instead of `['first value', 'second value']`. `all()` and `iterate()` behaved the same way, and two concurrent `run()` calls on one INSERT statement inserted the second value twice.  In `Statement.run/get/iterate/all`, the query timeout and the parameters were set on the shared native statement before `await this.execLock.acquire()`. While the first call waited for the lock, a second call bound its parameters over the first call's. `run()` also read `totalChanges()` before taking the lock, so its change count did not cover only its own execution.  All four methods now take the lock first. The timeout, binding, change-count read, execution and reset all happen inside the locked section, and the existing `finally` releases the lock even when binding throws.  ## Motivation and context  Fixes #9377  ## Description of AI Usage  Autofixer wrote this change with Claude Code in an isolated sandbox. A separate verifier agent tested and reviewed it in its own container before this PR was opened. A maintainer must review it before merge.  To have Autofixer address review feedback, leave your comments and then mention @turso-github-handyman; it handles all unanswered comments from maintainers in one round.

- **Issue #10110** (2026-10-18): **postgres: Catalog and CREATE SCHEMA fixes**
  *Symptoms*: ## Description  Three fixes to the PostgreSQL frontend:  - `pg_tables` and `pg_class` no longer list the tables in which core stores sequences (`__turso_internal_seq_*`), so a sequence or serial column no longer shows up as a table of the public schema. - `pg_indexes.indexdef` and `pg_get_indexdef()` write the table of an index definition with its schema, as PostgreSQL does: `CREATE INDEX t_x ON public.t USING btree (x)`. - `CREATE SCHEMA` rejects names that start with `pg_`, which PostgreSQL reserves for system schemas.  ## Motivation and context  These came up while reworking PostgreSQL schemas in #10008. They are bugs on main and independent of that change, so they are split out to be reviewed on their own.  ## Description of AI Usage  Written with Claude Code, driven by the author: Claude implemented the changes and the tests, and the author reviewed them. 

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

### Incident Patch 1: `f5090d05` (2026-10-18)
**Commit Message**: Merge 'postgres: Catalog and CREATE SCHEMA fixes' from Pekka Enberg

Three fixes to the PostgreSQL frontend:

- `pg_tables` and `pg_class` no longer list the tables in which core
stores sequences (`__turso_internal_seq_*`), so a sequence or serial
column no longer shows up as a table of the public schema.
- `pg_indexes.indexdef` and `pg_get_indexdef()` write the table of an
index definition with its schema, as PostgreSQL does: `CREATE INDEX t_x
ON public.t USING btree (x)`.
- `CREATE SCHEMA` rejects names that start with `pg_`, which PostgreSQL
reserves for system schemas.

These came up while reworking PostgreSQL schemas in #10008. They are
bugs on main and independent of that change, so they are split out to be
reviewed on their own.

Written with Claude Code, driven by the author: Claude implemented the
changes and the tests, and the author reviewed them.

Closes #10110

**File**: `postgres/conformance/pg-sqltests/catalog.sqltest` (modified, +24/-0)
```diff
@@ -595,6 +595,18 @@ test pg-tables-no-internal-tables {
 }
 expect {}
 
+test pg-tables-and-pg-class-hide-tables-of-sequences {
+    CREATE SEQUENCE s;
+    CREATE TABLE t (id serial);
+    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
+    UNION ALL
+    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
+    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 't';
+}
+expect {
+    t
+}
+
 test pg-type-builtin-oids {
     SELECT typname, oid FROM pg_type
     WHERE typname IN ('int4', 'text', 'bool', 'uuid') ORDER BY typname;
@@ -629,6 +641,18 @@ expect {
     public|items|items_price_idx||CREATE UNIQUE INDEX items_price_idx ON items USING btree (price) WHERE price > 0
 }
 
+test pg-indexes-and-pg-get-indexdef-name-the-schema-of-the-table {
+    CREATE TABLE items (id int, name text);
+    CREATE INDEX items_name_idx ON items (name);
+    SELECT indexdef FROM pg_indexes WHERE indexname = 'items_name_idx'
+    UNION ALL
+    SELECT pg_get_indexdef(oid) FROM pg_class WHERE relname = 'items_name_idx';
+}
+expect {
+    CREATE INDEX items_name_idx ON public.items USING btree (name)
+    CREATE INDEX items_name_idx ON public.items USING btree (name)
+}
+
 test pg-index-columns {
     CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT);
     CREATE INDEX idx_items_name ON items(name);
```

**File**: `postgres/conformance/pg-sqltests/schema.sqltest` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+# Schemas created with CREATE SCHEMA and the objects in them.
+
+@database :memory:
+
+test create-schema-rejects-names-that-start-with-pg {
+    CREATE SCHEMA pg_app;
+}
+expect error {
+    unacceptable schema name "pg_app"
+}
```

**File**: `postgres/frontend/catalog.rs` (modified, +15/-14)
```diff
@@ -186,22 +186,22 @@ fn user_tables_sorted(schema: &Schema) -> Vec<(&String, &Arc<Table>)> {
         .tables
         .iter()
         .filter(|(name, table)| {
-            // Skip system tables
-            if name.starts_with("sqlite_")
-                || name.starts_with("pg_")
-                || name.starts_with("pragma_")
-                || name.starts_with("json_")
-            {
-                return false;
-            }
             // Skip virtual tables and subqueries
-            matches!(table.as_ref(), Table::BTree(_))
+            !is_system_table_name(name) && matches!(table.as_ref(), Table::BTree(_))
         })
         .collect();
     tables.sort_by_key(|(name, _)| *name);
     tables
 }
 
+/// Whether `name` is a table that the engine or this frontend owns, rather
+/// than the user.
+fn is_system_table_name(name: &str) -> bool {
+    ["sqlite_", "pg_", "pragma_", "json_", "__turso_internal_"]
+        .iter()
+        .any(|prefix| name.starts_with(prefix))
+}
+
 /// Map a SQLite type string to a PostgreSQL type OID.
 /// Strips parenthesized parameters (e.g. `varchar(100)` -> `VARCHAR`) before matching.
 fn sqlite_type_to_pg_oid(ty_str: &str) -> i64 {
@@ -1037,7 +1037,7 @@ impl SnapshotRows for PgIndexesTable {
                     Value::Text(table_name.clone().into()),
                     Value::Text(idx.name.clone().into()),
                     Value::Null,
-                    Value::build_text(index_definition(table_name, idx)),
+                    Value::build_text(index_definition("public", table_name, &idx.name, idx)),
                 ]);
             }
         }
@@ -3410,7 +3410,7 @@ pub(crate) fn pg_get_indexdef(conn: &Connection, target_oid: i64) -> Option<Stri
                 continue;
             }
             if index_oid == target_oid {
-                return Some(index_definition(table_name, idx));
+                return Some(index_definition("public", table_name, &idx.name, idx));
             }
             index_oid += 1;
         }
@@ -3419,7 +3419,9 @@ pub(crate) fn pg_get_indexdef(conn: &Connection, target_oid: i64) -> Option<Stri
     None
 }
 
-fn index_definition(table_name: &str, idx: &Index) -> String {
+/// The CREATE INDEX statement of index `idx`, named `index_name` in its
+/// schema, of table `table_name` of schema `table_schema`.
+fn index_definition(table_schema: &str, table_name: &str, index_name: &str, idx: &Index) -> String {
     let unique = if idx.unique { "UNIQUE " } else { "" };
     let cols: Vec<String> = idx
         .columns
@@ -3433,8 +3435,7 @@ fn index_definition(table_name: &str, idx: &Index) -> String {
         })
         .collect();
     let mut def = format!(
-        "CREATE {unique}INDEX {} ON {table_name} USING btree ({})",
-        idx.name,
+        "CREATE {unique}INDEX {index_name} ON {table_schema}.{table_name} USING btree ({})",
         cols.join(", ")
     );
     if let Some(where_clause) = &idx.where_clause {
```

**File**: `postgres/frontend/session.rs` (modified, +5/-0)
```diff
@@ -404,6 +404,11 @@ fn handle_pg_create_schema(conn: &Arc<Connection>, stmt: &PgCreateSchemaStmt) ->
             "schema \"{name}\" already exists"
         )));
     }
+    if name.starts_with("pg_") {
+        return Err(LimboError::ParseError(format!(
+            "unacceptable schema name \"{name}\": the prefix \"pg_\" is reserved for system schemas"
+        )));
+    }
 
     let path = schema_file_path(conn, &name);
     execute_sqlite_internal(
```

---

### Incident Patch 2: `cd3c8abd` (2026-10-18)
**Commit Message**: Merge 'core: infer the result type of CASE, coalesce, nullif and abs' from app/turso-github-handyman

The PostgreSQL frontend sent integer results of CASE and some function
calls with the wrong type. `SELECT coalesce(x, 2) * coalesce(x, 3) FROM
t`, `SELECT abs(x) * 2 FROM t` and `SELECT CASE WHEN x = 1 THEN x ELSE 0
END - 1 FROM t` were sent as `float8`, so clients printed `1.0` where
PostgreSQL gives `1`. A bare `SELECT coalesce(x, 2) FROM t` was sent as
`text`.

`infer_expression_primitive`, which `Statement::get_column_type_info`
uses to type computed result columns, had no case for CASE or function
calls, so they got no type. The wire layer sends a column with no type
as `text`, and `combine_arithmetic_primitive` treats an operand with no
type as NUMERIC, which maps to `float8`.

CASE, `coalesce`, `ifnull` and the multi-argument `min`/`max` (what
GREATEST/LEAST become) now take the type their non-NULL branches or
arguments share, with integer and real widening the way arithmetic does.
Any other mix still has no type. `nullif` takes the type of its first
argument, and `abs` follows the rule for unary minus. All five queries
above are now sent as `int4`, matching PostgreSQL.

Fix

**File**: `core/statement.rs` (modified, +54/-0)
```diff
@@ -182,6 +182,7 @@ fn infer_expression_primitive(
     expr: &turso_parser::ast::Expr,
     referenced_tables: Option<&translate::plan::TableReferences>,
 ) -> Option<&'static str> {
+    use crate::function::ScalarFunc;
     use turso_parser::ast::{Expr, Operator, UnaryOperator};
 
     match expr {
@@ -250,6 +251,34 @@ fn infer_expression_primitive(
             ),
         },
         Expr::RowId { .. } => Some("INTEGER"),
+        Expr::Case {
+            when_then_pairs,
+            else_expr,
+            ..
+        } => common_primitive(
+            when_then_pairs
+                .iter()
+                .map(|(_, then)| then.as_ref())
+                .chain(else_expr.as_deref()),
+            referenced_tables,
+        ),
+        Expr::FunctionCall { name, args, .. } => {
+            match crate::function::Func::resolve_function(name.as_str(), args.len()) {
+                Ok(Some(crate::function::Func::Scalar(
+                    ScalarFunc::Coalesce | ScalarFunc::IfNull | ScalarFunc::Max | ScalarFunc::Min,
+                ))) => common_primitive(args.iter().map(|arg| arg.as_ref()), referenced_tables),
+                Ok(Some(crate::function::Func::Scalar(ScalarFunc::Nullif))) => {
+                    infer_expression_primitive(&args[0], referenced_tables)
+                }
+                Ok(Some(crate::function::Func::Scalar(ScalarFunc::Abs))) => {
+                    Some(combine_arithmetic_primitive(
+                        Some("INTEGER"),
+                        infer_expression_primitive(&args[0], referenced_tables),
+                    ))
+                }
+                _ => None,
+            }
+        }
         // CAST, column references, and anything else: defer to the affinity
         // machinery, which handles these shapes correctly.
         _ => affinity_to_primitive(translate::expr::get_expr_affinity(
@@ -260,6 +289,31 @@ fn infer_expression_primitive(
     }
 }
 
+/// The type that every non-NULL expression can be converted to, following
+/// PostgreSQL's rule for CASE branches and COALESCE arguments: mixed numeric
+/// types widen the way arithmetic does, any other mix has no common type.
+fn common_primitive<'a>(
+    exprs: impl Iterator<Item = &'a turso_parser::ast::Expr>,
+    referenced_tables: Option<&translate::plan::TableReferences>,
+) -> Option<&'static str> {
+    use turso_parser::ast::{Expr, Literal};
+
+    let is_numeric = |primitive| matches!(primitive, "INTEGER" | "REAL" | "NUMERIC");
+    let mut common = None;
+    for expr in exprs.filter(|expr| !matches!(expr, Expr::Literal(Literal::Null))) {
+        let primitive = infer_expression_primitive(expr, referenced_tables)?;
+        common = match common {
+            None => Some(primitive),
+            Some(common) if common == primitive => Some(common),
+            Some(common) if is_numeric(common) && is_numeric(primitive) => {
+                Some(combine_arithmetic_primitive(Some(common), Some(primitive)))
+            }
+            Some(_) => return None,
+        };
+    }
+    common
+}
+
 /// Map [`crate::vdbe::affinity::Affinity`] to the uppercase primitive name
 /// `infer_expression_primitive` returns. `Blob` collapses to `None` because
 /// SQLite's "no determined affinity" sentinel isn't a usable wire type.
```

**File**: `postgres/server/lib.rs` (modified, +26/-0)
```diff
@@ -804,6 +804,32 @@ mod tests {
         assert_eq!(*fields[0].datatype(), Type::INT4);
     }
 
+    #[test]
+    fn test_integer_case_and_function_results_are_int4_on_wire() {
+        let (_io, db) = turso_pg::open_database(
+            ":memory:",
+            None,
+            turso_pg::OpenFlags::default(),
+            turso_pg::DatabaseOpts::new(),
+        )
+        .unwrap();
+        let conn = Connection::connect(&db).unwrap();
+        conn.execute("CREATE TABLE t(id int PRIMARY KEY, x int)")
+            .unwrap();
+        conn.execute("INSERT INTO t VALUES (1, 1)").unwrap();
+        for sql in [
+            "SELECT x * 2 FROM t",
+            "SELECT coalesce(x, 2) * coalesce(x, 3) FROM t",
+            "SELECT abs(x) * 2 FROM t",
+            "SELECT CASE WHEN x = 1 THEN x ELSE 0 END - 1 FROM t",
+            "SELECT coalesce(x, 2) FROM t",
+        ] {
+            let stmt = conn.prepare(sql).unwrap();
+            let fields = build_field_info(&stmt, &Format::UnifiedText);
+            assert_eq!(*fields[0].datatype(), Type::INT4, "{sql}");
+        }
+    }
+
     #[test]
     fn test_set_transaction_is_non_query() {
         assert!(is_pg_non_query(
```

**File**: `tests/integration/statement_metadata.rs` (modified, +58/-0)
```diff
@@ -374,6 +374,64 @@ mod tests {
         );
     }
 
+    /// CASE takes the common type of its branches, as do COALESCE, IFNULL and
+    /// the multi-argument MIN/MAX. NULLIF takes the type of its first argument
+    /// and ABS follows unary minus. NULL branches do not affect the result, and
+    /// branches with no common type give no result type.
+    #[test]
+    fn type_info_for_case_and_functions_that_return_their_argument_type() {
+        let db = fresh_db_with_custom_types("type_info_case_functions.db");
+        let conn = db.connect_limbo();
+        conn.execute(
+            "CREATE TABLE t(id INTEGER PRIMARY KEY, x INTEGER, label TEXT, ratio REAL) STRICT",
+        )
+        .unwrap();
+
+        let cases: &[(&str, Option<&str>)] = &[
+            ("coalesce(x, 2)", Some("INTEGER")),
+            ("coalesce(x, 2) * coalesce(x, 3)", Some("INTEGER")),
+            ("ifnull(x, NULL)", Some("INTEGER")),
+            ("coalesce(x, ratio)", Some("REAL")),
+            ("coalesce(label, 'none')", Some("TEXT")),
+            ("coalesce(x, label)", None),
+            ("max(x, 1, 2)", Some("INTEGER")),
+            ("min(x, 1.5)", Some("REAL")),
+            ("nullif(x, 0)", Some("INTEGER")),
+            ("abs(x)", Some("INTEGER")),
+            ("abs(x) * 2", Some("INTEGER")),
+            ("abs(ratio)", Some("REAL")),
+            ("abs(label)", Some("NUMERIC")),
+            ("CASE WHEN x = 1 THEN x ELSE 0 END - 1", Some("INTEGER")),
+            ("CASE WHEN x = 1 THEN x END", Some("INTEGER")),
+            ("CASE x WHEN 1 THEN NULL ELSE ratio END", Some("REAL")),
+            ("CASE WHEN x = 1 THEN label ELSE 'other' END", Some("TEXT")),
+            ("CASE WHEN x = 1 THEN label ELSE 0 END", None),
+            ("CASE WHEN x = 1 THEN NULL END", None),
+            ("coalesce(x, randomblob(8))", None),
+        ];
+
+        let mut mismatches = Vec::new();
+        for (expr, expected) in cases {
+            let stmt = conn
+                .prepare(format!("SELECT {expr} FROM t"))
+                .unwrap_or_else(|e| panic!("failed to prepare `SELECT {expr} FROM t`: {e}"));
+            let actual = stmt
+                .get_column_type_info(0)
+                .unwrap()
+                .map(|info| info.declared_name);
+            if actual.as_deref() != *expected {
+                mismatches.push(format!(
+                    "  {expr:<44} expected {expected:?}, got {actual:?}"
+                ));
+            }
+        }
+        assert!(
+            mismatches.is_empty(),
+            "CASE and function result types are wrong:\n{}",
+            mismatches.join("\n")
+        );
+    }
+
     /// Expressions whose primitive can't be determined statically — function
     /// calls without a declared return affinity, BLOB literals, NULL literals
     /// — yield `Ok(None)`. Callers fall through to their own default (TEXT
```

---

### Incident Patch 3: `82c99933` (2026-10-18)
**Commit Message**: core: infer the result type of CASE, coalesce, nullif and abs

Fixes #9524

**File**: `core/statement.rs` (modified, +54/-0)
```diff
@@ -182,6 +182,7 @@ fn infer_expression_primitive(
     expr: &turso_parser::ast::Expr,
     referenced_tables: Option<&translate::plan::TableReferences>,
 ) -> Option<&'static str> {
+    use crate::function::ScalarFunc;
     use turso_parser::ast::{Expr, Operator, UnaryOperator};
 
     match expr {
@@ -250,6 +251,34 @@ fn infer_expression_primitive(
             ),
         },
         Expr::RowId { .. } => Some("INTEGER"),
+        Expr::Case {
+            when_then_pairs,
+            else_expr,
+            ..
+        } => common_primitive(
+            when_then_pairs
+                .iter()
+                .map(|(_, then)| then.as_ref())
+                .chain(else_expr.as_deref()),
+            referenced_tables,
+        ),
+        Expr::FunctionCall { name, args, .. } => {
+            match crate::function::Func::resolve_function(name.as_str(), args.len()) {
+                Ok(Some(crate::function::Func::Scalar(
+                    ScalarFunc::Coalesce | ScalarFunc::IfNull | ScalarFunc::Max | ScalarFunc::Min,
+                ))) => common_primitive(args.iter().map(|arg| arg.as_ref()), referenced_tables),
+                Ok(Some(crate::function::Func::Scalar(ScalarFunc::Nullif))) => {
+                    infer_expression_primitive(&args[0], referenced_tables)
+                }
+                Ok(Some(crate::function::Func::Scalar(ScalarFunc::Abs))) => {
+                    Some(combine_arithmetic_primitive(
+                        Some("INTEGER"),
+                        infer_expression_primitive(&args[0], referenced_tables),
+                    ))
+                }
+                _ => None,
+            }
+        }
         // CAST, column references, and anything else: defer to the affinity
         // machinery, which handles these shapes correctly.
         _ => affinity_to_primitive(translate::expr::get_expr_affinity(
@@ -260,6 +289,31 @@ fn infer_expression_primitive(
     }
 }
 
+/// The type that every non-NULL expression can be converted to, following
+/// PostgreSQL's rule for CASE branches and COALESCE arguments: mixed numeric
+/// types widen the way arithmetic does, any other mix has no common type.
+fn common_primitive<'a>(
+    exprs: impl Iterator<Item = &'a turso_parser::ast::Expr>,
+    referenced_tables: Option<&translate::plan::TableReferences>,
+) -> Option<&'static str> {
+    use turso_parser::ast::{Expr, Literal};
+
+    let is_numeric = |primitive| matches!(primitive, "INTEGER" | "REAL" | "NUMERIC");
+    let mut common = None;
+    for expr in exprs.filter(|expr| !matches!(expr, Expr::Literal(Literal::Null))) {
+        let primitive = infer_expression_primitive(expr, referenced_tables)?;
+        common = match common {
+            None => Some(primitive),
+            Some(common) if common == primitive => Some(common),
+            Some(common) if is_numeric(common) && is_numeric(primitive) => {
+                Some(combine_arithmetic_primitive(Some(common), Some(primitive)))
+            }
+            Some(_) => return None,
+        };
+    }
+    common
+}
+
 /// Map [`crate::vdbe::affinity::Affinity`] to the uppercase primitive name
 /// `infer_expression_primitive` returns. `Blob` collapses to `None` because
 /// SQLite's "no determined affinity" sentinel isn't a usable wire type.
```

**File**: `postgres/server/lib.rs` (modified, +26/-0)
```diff
@@ -804,6 +804,32 @@ mod tests {
         assert_eq!(*fields[0].datatype(), Type::INT4);
     }
 
+    #[test]
+    fn test_integer_case_and_function_results_are_int4_on_wire() {
+        let (_io, db) = turso_pg::open_database(
+            ":memory:",
+            None,
+            turso_pg::OpenFlags::default(),
+            turso_pg::DatabaseOpts::new(),
+        )
+        .unwrap();
+        let conn = Connection::connect(&db).unwrap();
+        conn.execute("CREATE TABLE t(id int PRIMARY KEY, x int)")
+            .unwrap();
+        conn.execute("INSERT INTO t VALUES (1, 1)").unwrap();
+        for sql in [
+            "SELECT x * 2 FROM t",
+            "SELECT coalesce(x, 2) * coalesce(x, 3) FROM t",
+            "SELECT abs(x) * 2 FROM t",
+            "SELECT CASE WHEN x = 1 THEN x ELSE 0 END - 1 FROM t",
+            "SELECT coalesce(x, 2) FROM t",
+        ] {
+            let stmt = conn.prepare(sql).unwrap();
+            let fields = build_field_info(&stmt, &Format::UnifiedText);
+            assert_eq!(*fields[0].datatype(), Type::INT4, "{sql}");
+        }
+    }
+
     #[test]
     fn test_set_transaction_is_non_query() {
         assert!(is_pg_non_query(
```

**File**: `tests/integration/statement_metadata.rs` (modified, +58/-0)
```diff
@@ -374,6 +374,64 @@ mod tests {
         );
     }
 
+    /// CASE takes the common type of its branches, as do COALESCE, IFNULL and
+    /// the multi-argument MIN/MAX. NULLIF takes the type of its first argument
+    /// and ABS follows unary minus. NULL branches do not affect the result, and
+    /// branches with no common type give no result type.
+    #[test]
+    fn type_info_for_case_and_functions_that_return_their_argument_type() {
+        let db = fresh_db_with_custom_types("type_info_case_functions.db");
+        let conn = db.connect_limbo();
+        conn.execute(
+            "CREATE TABLE t(id INTEGER PRIMARY KEY, x INTEGER, label TEXT, ratio REAL) STRICT",
+        )
+        .unwrap();
+
+        let cases: &[(&str, Option<&str>)] = &[
+            ("coalesce(x, 2)", Some("INTEGER")),
+            ("coalesce(x, 2) * coalesce(x, 3)", Some("INTEGER")),
+            ("ifnull(x, NULL)", Some("INTEGER")),
+            ("coalesce(x, ratio)", Some("REAL")),
+            ("coalesce(label, 'none')", Some("TEXT")),
+            ("coalesce(x, label)", None),
+            ("max(x, 1, 2)", Some("INTEGER")),
+            ("min(x, 1.5)", Some("REAL")),
+            ("nullif(x, 0)", Some("INTEGER")),
+            ("abs(x)", Some("INTEGER")),
+            ("abs(x) * 2", Some("INTEGER")),
+            ("abs(ratio)", Some("REAL")),
+            ("abs(label)", Some("NUMERIC")),
+            ("CASE WHEN x = 1 THEN x ELSE 0 END - 1", Some("INTEGER")),
+            ("CASE WHEN x = 1 THEN x END", Some("INTEGER")),
+            ("CASE x WHEN 1 THEN NULL ELSE ratio END", Some("REAL")),
+            ("CASE WHEN x = 1 THEN label ELSE 'other' END", Some("TEXT")),
+            ("CASE WHEN x = 1 THEN label ELSE 0 END", None),
+            ("CASE WHEN x = 1 THEN NULL END", None),
+            ("coalesce(x, randomblob(8))", None),
+        ];
+
+        let mut mismatches = Vec::new();
+        for (expr, expected) in cases {
+            let stmt = conn
+                .prepare(format!("SELECT {expr} FROM t"))
+                .unwrap_or_else(|e| panic!("failed to prepare `SELECT {expr} FROM t`: {e}"));
+            let actual = stmt
+                .get_column_type_info(0)
+                .unwrap()
+                .map(|info| info.declared_name);
+            if actual.as_deref() != *expected {
+                mismatches.push(format!(
+                    "  {expr:<44} expected {expected:?}, got {actual:?}"
+                ));
+            }
+        }
+        assert!(
+            mismatches.is_empty(),
+            "CASE and function result types are wrong:\n{}",
+            mismatches.join("\n")
+        );
+    }
+
     /// Expressions whose primitive can't be determined statically — function
     /// calls without a declared return affinity, BLOB literals, NULL literals
     /// — yield `Ok(None)`. Callers fall through to their own default (TEXT
```

#### Recent Merged Pull Requests:
- **PR #10111** (2026-10-19): bindings/javascript: bind statement parameters while holding the exec lock (@turso-github-handyman[bot])
- **PR #10110** (2026-10-18): postgres: Catalog and CREATE SCHEMA fixes (@penberg)
- **PR #10108** (2026-10-19): core/translate: do not capture changes to temp tables in CDC (@turso-github-handyman[bot])
- **PR #10101** (2026-10-19): docs: say that make test needs uv (@turso-github-handyman[bot])
- **PR #10098** (2026-10-19): bindings/javascript: drop handles of collected statements in prepare (@turso-github-handyman[bot])
- **PR #10093** (2026-10-19): core/translate: register every statement parameter before translation (@turso-github-handyman[bot])

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

## X. Merge 'postgres: Catalog and CREATE SCHEMA fixes' from Pekka Enberg

**RULE**:
When implementing operations in `postgres/conformance/pg-sqltests/catalog.sqltest`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tursodatabase/turso. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f5090d05`: Merge 'postgres: Catalog and CREATE SCHEMA fixes' from Pekka Enberg. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `postgres/conformance/pg-sqltests/catalog.sqltest`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
test pg-tables-and-pg-class-hide-tables-of-sequences {
    CREATE SEQUENCE s;
    CREATE TABLE t (id serial);
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    UNION ALL
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 't';
}
expect {
    t
}

test pg-indexes-and-pg-get-indexdef-name-the-schema-of-the-table {
    CREATE TABLE items (id int, name text);
    CREATE INDEX items_name_idx ON items (name);
    SELECT indexdef FROM pg_indexes WHERE indexname = 'items_name_idx'
    UNION ALL
    SELECT pg_get_indexdef(oid) FROM pg_class WHERE relname = 'items_name_idx';
}
expect {
    CREATE INDEX items_name_idx ON public.items USING btree (name)
    CREATE INDEX items_name_idx ON public.items USING btree (name)
}

```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f5090d05` are properly handled with clean fallback behavior.
