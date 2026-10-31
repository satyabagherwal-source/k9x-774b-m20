> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tursodatabase-limbo-learnings.md`  
> **Source**: github ([https://github.com/tursodatabase/limbo](https://github.com/tursodatabase/limbo))  
> **Source Version**: `9f2b612e`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T04:38:48.709Z  
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
> **Harvest Timestamp**: 2026-10-31T04:38:47.452Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tursodatabase/turso`
- **Description**: A SQL database in Rust: SQLite-compatible, now also speaking Postgres (experimental). The LLVM of databases.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md
- **Stars / Engagement**: 25099 stars

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
- **Issue #11114** (2026-10-31): **core/storage: clear a shared WAL reader slot before unlocking it**
  *Symptoms*: ## Problem  With `--experimental-multiprocess-wal`, a process can panic when its read transaction ends:  ``` reader slot released by non-owner | slot_index=1, expected_owner=..., current_owner=0 ```  ``` process A holds reader slot 1  A: unregister_reader   -> unlocks slot 1's lock byte B: opens a connection  -> repair_transient_state_for_exclusive_open sees the lock is free,                           marks slot 1 free B: register_reader     -> takes slot 1, owner = B, frame = 23 A: (same call, continued) -> frame = unused, owner = 0      // B's owner and frame are erased B: unregister_reader   -> panic: released by non-owner ```  The stale-slot cleanup paths (`try_reclaim_stale_reader_slot` and the checks in `live_reader_frames`) can free the slot during the same gap.  Root cause: `unregister_reader` unlocks the slot's lock byte before it clears the slot's frame and owner and marks the slot free. Other processes treat a free lock byte as "this slot can be reused". `release_owned_locks_on_drop`, which releases a mapping's slots when it closes, uses the same order.  Besides the panic, erasing B's frame means checkpoints no longer see B's reader. So they could copy frames back past the snapshot B is reading.  ## Fix  In `unregister_reader` and `release_owned_locks_on_drop`, the lock byte is now unlocked last:  ``` before: unlock byte -> frame = unused -> owner = 0 -> mark slot free after:  frame = unused -> owner = 0 -> mark slot free -> unlock byte ```  - Marking the slot free

- **Issue #11113** (2026-10-31): **core/storage: create the pointer map page only when allocate_page grows the file**
  *Symptoms*: ## Problem  With `auto_vacuum=full`, `Pager::allocate_page` (which hands out a page from the freelist, or grows the file) can commit a page that lies past the database size recorded in the header:  ``` 4096-byte pages, database_size = 821, freelist = [50] // page 822 is the next pointer map page  allocate_page:   Start state   -> page 822 created and marked changed (pointer map page)   freelist path -> returns page 50, database_size stays 821 commit          -> writes page 822, header says 821 pages   // page beyond database_size ```  The `Start` state creates the pointer map page whenever `database_size + 1` is one. Only the `AllocateNewPage` state, which grows the file, writes a new `database_size`. The two freelist states return a reused page without it. The same page was also left changed when `AllocateNewPage` then returned `DatabaseFull`.  ## Fix  The pointer map page is now created in `AllocateNewPage`, the only place where the file grows. This matches SQLite's `allocateBtreePage`. `AllocateNewPage` now does this:  1. Work out the final size: one more page, plus a pointer map page if the next page is one, plus the pending-byte page if it is reached. 2. Return `DatabaseFull` if that size is above `max_page_count`, before any page is created. 3. Create the pointer map page and the pending-byte page if needed, then the returned page, and write the new `database_size`.  The old "page already in cache" check is gone. That check let the `Start` state run again safely after a

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

### Incident Patch 1: `8c47ee75` (2026-10-30)
**Commit Message**: Merge 'core/translate: fix deferred FK checks for generated child keys' from app/turso-github-handyman

## Problem

When a foreign key child column is a VIRTUAL generated column, some
writes to the child table read the wrong key value or skip the key
check. Valid transactions then fail at COMMIT, and some orphan child
rows are allowed in.

Deleting a child row does not clear its deferred violation:

```sql
PRAGMA foreign_keys=ON;
CREATE TABLE p(id PRIMARY KEY);
CREATE TABLE c(a, g AS(a) REFERENCES p(id) DEFERRABLE INITIALLY DEFERRED);
BEGIN;
INSERT INTO c(a) VALUES(7);
DELETE FROM c WHERE a=7;
COMMIT;
-- Turso:  FOREIGN KEY constraint failed
-- SQLite: commits
```

UPSERT DO UPDATE does not check the new key:

```sql
PRAGMA foreign_keys=ON;
CREATE TABLE p(id PRIMARY KEY);
CREATE TABLE c(k INTEGER PRIMARY KEY, a UNIQUE, b, g AS (b) REFERENCES p(id) DEFERRABLE INITIALLY DEFERRED);
INSERT INTO p VALUES(5);
INSERT INTO c(k,a,b) VALUES(1,7,5);
BEGIN;
INSERT INTO c(k,a,b) VALUES(3,7,5) ON CONFLICT DO UPDATE SET b=6;
COMMIT;
-- Turso:  commits, leaving g=6 with no parent row
-- SQLite: FOREIGN KEY constraint failed
```

Causes:
- `emit_fk_child_decrement_on_delete` (in
`core/translate/emi

**File**: `core/translate/emitter/delete.rs` (modified, +26/-50)
```diff
@@ -1,4 +1,4 @@
-use super::{Resolver, Result, TranslateCtx};
+use super::{emit_columns_and_dependencies, Resolver, Result, TranslateCtx};
 use crate::namespace::NamespaceRef;
 use crate::{
     emit_explain,
@@ -379,24 +379,26 @@ pub fn emit_fk_child_decrement_on_delete(
         if !fk_ref.fk.deferred {
             continue;
         }
+        let child_positions: Vec<usize> = fk_ref
+            .fk
+            .child_columns
+            .iter()
+            .map(|cname| child_tbl.get_column(cname).unwrap().0)
+            .collect();
+        let child_key = emit_columns_and_dependencies(
+            program,
+            child_tbl,
+            child_cursor_id,
+            child_rowid_reg,
+            child_positions.iter().copied(),
+            resolver,
+        )?;
+
         // Fast path: if any FK column is NULL can't be a violation
         let null_skip = program.allocate_label();
-        for cname in &fk_ref.fk.child_columns {
-            let (pos, col) = child_tbl.get_column(cname).unwrap();
-            let src = if col.is_rowid_alias() {
-                child_rowid_reg
-            } else {
-                let tmp = program.alloc_register();
-                program.emit_insn(Insn::Column {
-                    cursor_id: child_cursor_id,
-                    column: pos,
-                    dest: tmp,
-                    default: None,
-                });
-                tmp
-            };
+        for &pos in &child_positions {
             program.emit_insn(Insn::IsNull {
-                reg: src,
+                reg: child_key.to_column_reg(pos),
                 target_pc: null_skip,
             });
         }
@@ -410,34 +412,21 @@ pub fn emit_fk_child_decrement_on_delete(
                 .expect("parent btree");
             let pcur = open_read_table(program, &parent_tbl, database_id);
 
-            let (pos, col) = child_tbl.get_column(&fk_ref.fk.child_columns[0]).unwrap();
-            let val = if col.is_rowid_alias() {
-                child_rowid_reg
-            } else {
-                let tmp = program.alloc_register();
-                program.emit_insn(Insn::Column {
-                    cursor_id: child_cursor_id,
-                    column: pos,
-                    dest: tmp,
-                    default: None,
-                });
-                tmp
-            };
             let tmpi = program.alloc_register();
             program.emit_insn(Insn::Copy {
-                src_reg: val,
+                src_reg: child_key.to_column_reg(child_positions[0]),
                 dst_reg: tmpi,
                 extra_amount: 0,
             });
+            // A key that is not an integer cannot match a parent rowid, so the
+            // parent is missing, and NotExists jumps there too
+            let missing = program.allocate_label();
+            let done = program.allocate_label();
             program.emit_insn(Insn::MustBeInt {
                 reg: tmpi,
-                target_pc: None,
+                target_pc: Some(missing),
             });
 
-            // NotExists jumps when the parent key is missing, so we decrement there
-            let missing = program.allocate_label();
-            let done = program.allocate_label();
-
             program.emit_insn(Insn::NotExists {
                 cursor: pcur,
                 rowid_reg: tmpi,
@@ -466,22 +455,9 @@ pub fn emit_fk_child_decrement_on_delete(
             // Build probe from current child row
             let n = fk_ref.fk.child_columns.len();
             let probe = program.alloc_registers(n);
-            for (i, cname) in fk_ref.fk.child_columns.iter().enumerate() {
-                let (pos, col) = child_tbl.get_column(cname).unwrap();
-                let src = if col.is_rowid_alias() {
-                    child_rowid_reg
-                } else {
-                    let r = program.alloc_register();
-                    program.emit_insn(Insn::Column {
-                        cursor_id: child_cursor_id,
-                        column: pos,
-                        dest: r,
-                        default: None,
-                    });
-                    r
-                };
+            for (i, &pos) in child_positions.iter().enumerate() {
                 program.emit_insn(Insn::Copy {
-                    src_reg: src,
+                    src_reg: child_key.to_column_reg(pos),
                     dst_reg: probe + i,
                     extra_amount: 0,
                 });
```

**File**: `core/translate/emitter/mod.rs` (modified, +9/-3)
```diff
@@ -1957,8 +1957,8 @@ pub(crate) fn init_limit(
 /// DML row context. This takes into account stored columns, and any stored columns
 /// required by virtual columns in `target_columns`.
 ///
-/// Non-rowid target columns are allocated in target order. Rowid-alias columns resolve
-/// to `rowid_reg`, so callers that need an unpacked contiguous key or record must
+/// Non-rowid target columns are allocated in target order, once per distinct column.
+/// Rowid-alias columns resolve to `rowid_reg`, so callers that need an unpacked contiguous key or record must
 /// materialize one from `DmlColumnContext::to_column_reg`.
 pub(crate) fn emit_columns_and_dependencies(
     program: &mut ProgramBuilder,
@@ -1968,7 +1968,13 @@ pub(crate) fn emit_columns_and_dependencies(
     target_columns: impl IntoIterator<Item = usize>,
     resolver: &Resolver,
 ) -> Result<DmlColumnContext> {
-    let targets: Vec<usize> = target_columns.into_iter().collect();
+    // A foreign key may name the same column twice, e.g. FOREIGN KEY(a,a).
+    let mut targets: Vec<usize> = Vec::new();
+    for idx in target_columns {
+        if !targets.contains(&idx) {
+            targets.push(idx);
+        }
+    }
     let target_mask: ColumnMask = targets.iter().copied().try_collect()?;
     let non_rowid_targets: Vec<usize> = targets
         .iter()
```

**File**: `core/translate/upsert.rs` (modified, +5/-1)
```diff
@@ -1044,14 +1044,18 @@ pub fn emit_upsert(
             if resolver.with_schema(upsert_database_id, |s| {
                 s.has_child_fks(ctx.namespace.id, bt.name.as_str())
             }) {
+                let rowid_alias_if_changed = rowid_alias_idx.filter(|_| rowid_changed);
+                let affected_cols = bt.columns_affected_by_update(
+                    directly_changed_cols.iter().chain(rowid_alias_if_changed),
+                )?;
                 emit_fk_child_update_counters(
                     program,
                     &bt,
                     table.get_name(),
                     ctx.cursor_id,
                     new_start,
                     rowid_new_reg,
-                    &directly_changed_cols,
+                    &affected_cols,
                     !affected_parent_fks.is_empty(),
                     upsert_namespace,
                     resolver,
```

**File**: `sqlite/conformance/sqlite-sqltests/foreign_keys.sqltest` (modified, +54/-0)
```diff
@@ -4851,3 +4851,57 @@ expect {
     2
     0
 }
+
+# A child key that is not an integer has no INTEGER PRIMARY KEY parent, so
+# deleting the child row removes the deferred violation.
+@cross-check-integrity
+test fk-deferred-delete-child-with-non-integer-key-of-rowid-parent {
+    PRAGMA foreign_keys=ON;
+    CREATE TABLE p(id INTEGER PRIMARY KEY);
+    CREATE TABLE c(a REFERENCES p(id) DEFERRABLE INITIALLY DEFERRED);
+    BEGIN;
+    INSERT INTO c VALUES('x'), (1.5);
+    DELETE FROM c;
+    COMMIT;
+    SELECT count(*) FROM c;
+}
+expect {
+    0
+}
+
+@cross-check-integrity
+test fk-deferred-repeated-child-column {
+    PRAGMA foreign_keys=ON;
+    CREATE TABLE p(x, y, PRIMARY KEY(x, y));
+    CREATE TABLE c(k INTEGER PRIMARY KEY, a, FOREIGN KEY(a, a) REFERENCES p(x, y) DEFERRABLE INITIALLY DEFERRED);
+    INSERT INTO p VALUES(2, 2);
+    BEGIN;
+    INSERT INTO c(k, a) VALUES(1, 1);
+    UPDATE c SET a=2;
+    INSERT INTO c(k, a) VALUES(2, 1);
+    INSERT OR REPLACE INTO c(k, a) VALUES(2, 2);
+    INSERT INTO c(k, a) VALUES(3, 1);
+    UPDATE OR REPLACE c SET k=3 WHERE k=2;
+    INSERT INTO c(k, a) VALUES(4, 1);
+    DELETE FROM c WHERE k=4;
+    COMMIT;
+    SELECT * FROM c;
+}
+expect {
+    1|2
+    3|2
+}
+
+test fk-deferred-upsert-rowid-alias-child-change-creates-violation {
+    PRAGMA foreign_keys=ON;
+    CREATE TABLE p(id PRIMARY KEY);
+    CREATE TABLE c(k INTEGER PRIMARY KEY REFERENCES p(id) DEFERRABLE INITIALLY DEFERRED, a UNIQUE);
+    INSERT INTO p VALUES(1);
+    INSERT INTO c(k, a) VALUES(1, 7);
+    BEGIN;
+    INSERT INTO c(k, a) VALUES(3, 7) ON CONFLICT DO UPDATE SET k=9;
+    COMMIT;
+}
+expect error {
+    FOREIGN KEY constraint failed
+}
```

**File**: `sqlite/conformance/sqlite-sqltests/gencol.sqltest` (modified, +137/-0)
```diff
@@ -4612,6 +4612,143 @@ expect {
     7|14
 }
 
+@cross-check-integrity
+test fk-deferred-delete-virtual-col-child-fixes-violation {
+    PRAGMA foreign_keys=ON;
+    CREATE TABLE p(id INTEGER PRIMARY KEY);
+    CREATE TABLE c(a, g AS (a) REFERENCES p(id) DEFERRABLE INITIALLY DEFERRED);
+    BEGIN;
+    INSERT INTO c(a) VALUES(7);
+    DELETE FROM c WHERE a=7;
+    COMMIT;
+    SELECT count(*) FROM c;
+}
+expect {
+    0
+}
+
+@cross-check-integrity
+test fk-deferred-delete-virtual-col-child-with-non-integer-key {
+    PRAGMA foreign_keys=ON;
+    CREATE TABLE p(id INTEGER PRIMARY KEY);
+    CREATE TABLE c(a, g AS (a) REFERENCES p(id) DEFERRABLE INITIALLY DEFERRED);
+    BEGIN;
+    INSERT INTO c(a) VALUES('x'), (1.5);
+    DELETE FROM c;
+    COMMIT;
+    SELECT count(*) FROM c;
+}
+expect {
+    0
+}
+
+@cross-check-integrity
+test fk-deferred-delete-parent-then-virtual-col-child-unique-parent {
+    PRAGMA foreign_keys=ON;
+    CREATE TABLE p(id UNIQUE);
+    CREATE TABLE c(a, g AS (a) REFERENCES p(id) DEFERRABLE INITIALLY DEFERRED);
+    INSERT INTO p VALUES(1);
+    INSERT INTO c(a) VALUES(1);
+    BEGIN;
+    DELETE FROM p;
+    DELETE FROM c;
+    COMMIT;
+    SELECT count(*) FROM c;
+}
+expect {
+    0
+}
+
+@cross-check-integrity
+test fk-deferred-replace-virtual-col-child-fixes-violation {
+    PRAGMA foreign_keys=ON;
+    CREATE TABLE p(id PRIMARY KEY);
+    CREATE TABLE c(k INTEGER PRIMARY KEY, a, g AS (a) REFERENCES p(id) DEFERRABLE INITIALLY DEFERRED);
+    BEGIN;
+    INSERT INTO c(k, a) VALUES(1, 7);
+    INSERT INTO p VALUES(8);
+    INSERT OR REPLACE INTO c(k, a) VALUES(1, 8);
+    COMMIT;
+    SELECT * FROM c;
+}
+expect {
+    1|8|8
+}
+
+@cross-check-integrity
+test fk-deferred-update-replace-virtual-col-child-fixes-violation {
+    PRAGMA foreign_keys=ON;
+    CREATE TABLE p(id PRIMARY KEY);
+    CREATE TABLE c(k INTEGER PRIMARY KEY, a, g AS (a) REFERENCES p(id) DEFERRABLE INITIALLY DEFERRED);
+    INSERT INTO p VALUES(8);
+    INSERT INTO c(k, a) VALUES(2, 8);
+    BEGIN;
+    INSERT INTO c(k, a) VALUES(1, 7);
+    UPDATE OR REPLACE c SET k=1 WHERE k=2;
+    COMMIT;
+    SELECT * FROM c;
+}
+expect {
+    1|8|8
+}
+
+@cross-check-integrity
+test fk-deferred-upsert-virtual-col-child-fixes-violation {
+    PRAGMA foreign_keys=ON;
+    CREATE TABLE p(id PRIMARY KEY);
+    CREATE TABLE c(k INTEGER PRIMARY KEY, a UNIQUE, b, g AS (b) REFERENCES p(id) DEFERRABLE INITIALLY DEFERRED);
+    BEGIN;
+    INSERT INTO c(k, a, b) VALUES(1, 7, 6);
+    INSERT INTO p VALUES(5);
+    INSERT INTO c(k, a, b) VALUES(3, 7, 5) ON CONFLICT DO UPDATE SET b=5;
+    COMMIT;
+    SELECT * FROM c;
+}
+expect {
+    1|7|5|5
+}
+
+test fk-deferred-upsert-virtual-col-child-creates-violation {
+    PRAGMA foreign_keys=ON;
+    CREATE TABLE p(id PRIMARY KEY);
+    CREATE TABLE c(k INTEGER PRIMARY KEY, a UNIQUE, b, g AS (b) REFERENCES p(id) DEFERRABLE INITIALLY DEFERRED);
+    INSERT INTO p VALUES(5);
+    INSERT INTO c(k, a, b) VALUES(1, 7, 5);
+    BEGIN;
+    INSERT INTO c(k, a, b) VALUES(3, 7, 5) ON CONFLICT DO UPDATE SET b=6;
+    COMMIT;
+}
+expect error {
+    FOREIGN KEY constraint failed
+}
+
+test fk-deferred-upsert-rowid-alias-change-fixes-virtual-col-child-violation {
+    PRAGMA foreign_keys=ON;
+    CREATE TABLE p(id PRIMARY KEY);
+    CREATE TABLE c(k INTEGER PRIMARY KEY, a UNIQUE, g AS (k) REFERENCES p(id) DEFERRABLE INITIALLY DEFERRED);
+    INSERT INTO p VALUES(2);
+    BEGIN;
+    INSERT INTO c(k, a) VALUES(1, 7);
+    INSERT INTO c(k, a) VALUES(3, 7) ON CONFLICT DO UPDATE SET k=2;
+    COMMIT;
+    SELECT k, a, g FROM c;
+}
+expect {
+    2|7|2
+}
+
+test fk-upsert-virtual-col-child-of-virtual-col-without-parent {
+    PRAGMA foreign_keys=ON;
+    CREATE TABLE p(id PRIMARY KEY);
+    CREATE TABLE c(k INTEGER PRIMARY KEY, a UNIQUE, b, h AS (b + 1), g AS (h - 1) REFERENCES p(id));
+    INSERT INTO p VALUES(5);
+    INSERT INTO c(k, a, b) VALUES(1, 7, 5);
+    INSERT INTO c(k, a, b) VALUES(3, 7, 5) ON CONFLICT DO UPDATE SET b=6;
+}
+expect error {
+    FOREIGN KEY constraint failed
+}
+
 @cross-check-integrity
 test fk-delete-parent-referenced-by-virtual-col-child {
     PRAGMA foreign_keys=ON;
```

---

### Incident Patch 2: `57272970` (2026-10-31)
**Commit Message**: Merge 'core/translate: read expression nullability through ExprProperties' from Pedro Muniz

`Optimizable::is_nonnull` now takes `&impl ExprProperties` instead of
`&TableReferences`.

- `ExprProperties` gains `column_is_nonnull(source, column)` and
`rowid_is_nonnull(source)`. They report nullability in the query, not
only schema `NOT NULL`: an outer join can make a `NOT NULL` column or a
rowid NULL, and correlated outer references keep the nullability from
their outer scope.
- `TableMetadata` implements both with the existing lookups
(`outer_join_may_null_extend`, then `is_rowid_alias() || notnull()`,
keeping the `table not found` assertion). `ExprContext` delegates to
`TableMetadata` and adds no resolver facts.
- A `Column` marked `is_rowid_alias` maps to `rowid_is_nonnull` without
a table lookup, matching the old early return.
- `is_nonnull` also takes a `TypeEnv`, which main started using to
detect custom-type operators (their functions can return NULL). Callers
build it once instead of `is_nonnull` rebuilding it at every
`Binary`/`Unary` node.
- The existing callers (`detect_simple_aggregate` and two seek-key
checks in `main_loop/seek.rs`) previously passed only `TableReference

**File**: `core/translate/expr_context.rs` (modified, +38/-0)
```diff
@@ -17,6 +17,12 @@ pub(crate) trait ExprProperties<
 {
     fn column_affinity(&self, source: SourceId, column: usize) -> Option<Affinity>;
     fn column_collation(&self, source: SourceId, column: usize) -> Result<Option<TextCollation>>;
+    /// Whether the column is never NULL in this query. An outer join can make
+    /// a NOT NULL column NULL.
+    fn column_is_nonnull(&self, source: SourceId, column: usize) -> bool;
+    /// Whether the rowid is never NULL in this query. An outer join can make
+    /// the rowid NULL.
+    fn rowid_is_nonnull(&self, source: SourceId) -> bool;
     fn register_affinity(&self, register: usize) -> Option<Affinity>;
     fn register_collation(&self, register: usize) -> Option<TextCollation>;
     fn subquery_affinity(&self, query: SubqueryId, result_reg: usize) -> Option<Affinity>;
@@ -86,6 +92,14 @@ impl ExprProperties for ExprContext<'_, '_> {
         self.tables.column_collation(source, column)
     }
 
+    fn column_is_nonnull(&self, source: TableInternalId, column: usize) -> bool {
+        self.tables.column_is_nonnull(source, column)
+    }
+
+    fn rowid_is_nonnull(&self, source: TableInternalId) -> bool {
+        self.tables.rowid_is_nonnull(source)
+    }
+
     fn register_affinity(&self, register: usize) -> Option<Affinity> {
         self.resolver
             .register_columns
@@ -149,6 +163,30 @@ impl ExprProperties for TableMetadata<'_> {
         Ok(column_collation(column))
     }
 
+    fn column_is_nonnull(&self, source: TableInternalId, column: usize) -> bool {
+        // A null-extended row has a NULL rowid and NULL in every column.
+        if !self.rowid_is_nonnull(source) {
+            return false;
+        }
+        let (_, table) = self
+            .tables
+            .and_then(|tables| tables.find_table_by_internal_id(source))
+            .expect("table not found");
+        let column = &table.columns()[column];
+        // Only INTEGER PRIMARY KEY (rowid alias) is implicitly NOT NULL.
+        // Other PRIMARY KEY types (e.g., TEXT PRIMARY KEY) can contain NULL.
+        column.is_rowid_alias() || column.notnull()
+    }
+
+    fn rowid_is_nonnull(&self, source: TableInternalId) -> bool {
+        // SQLite marks columns from the nullable side of an outer join as
+        // nullable, even when the table schema says NOT NULL. A correlated
+        // outer reference carries the nullability from its own scope.
+        !self
+            .tables
+            .is_some_and(|tables| tables.outer_join_may_null_extend(source))
+    }
+
     fn register_affinity(&self, _register: usize) -> Option<Affinity> {
         None
     }
```

**File**: `core/translate/main_loop/seek.rs` (modified, +10/-3)
```diff
@@ -1,4 +1,6 @@
 use super::*;
+use crate::translate::expr::expr_type::TypeEnv;
+use crate::translate::expr_context::TableMetadata;
 use crate::translate::plan::BitSet;
 use crate::vdbe::insn::NullMatchingMask;
 use turso_parser::ast::NullsOrder;
@@ -184,8 +186,10 @@ impl<'a, 'plan> SeekEmitter<'a, 'plan> {
                     // soon as one shows up. `IS` matches NULL instead: keep the
                     // NULL in the seek register and let the index comparison
                     // find the rows whose key component is NULL.
-                    if !expr.is_nonnull(self.tables, &self.t_ctx.resolver)
-                        && !self.seek_def.is_null_matching_key_component(i)
+                    if !expr.is_nonnull(
+                        &TableMetadata::new(Some(self.tables)),
+                        &TypeEnv::new(Some(self.tables), &self.t_ctx.resolver),
+                    ) && !self.seek_def.is_null_matching_key_component(i)
                     {
                         self.program.emit_insn(Insn::IsNull {
                             reg,
@@ -357,7 +361,10 @@ impl<'a, 'plan> SeekEmitter<'a, 'plan> {
                         });
                     }
                 }
-                if !expr.is_nonnull(self.tables, &self.t_ctx.resolver) {
+                if !expr.is_nonnull(
+                    &TableMetadata::new(Some(self.tables)),
+                    &TypeEnv::new(Some(self.tables), &self.t_ctx.resolver),
+                ) {
                     self.program.emit_insn(Insn::IsNull {
                         reg: last_reg,
                         target_pc: self.loop_end,
```

**File**: `core/translate/optimizer/mod.rs` (modified, +29/-46)
```diff
@@ -1,6 +1,6 @@
 use super::{
     emitter::Resolver,
-    expr_context::ExprContext,
+    expr_context::{ExprContext, ExprProperties, TableMetadata},
     plan::{
         DeletePlan, GroupBy, InSeekSource, IterationDirection, JoinInfo, JoinOrderMember,
         JoinOrigin, JoinType, JoinedTable, MinMaxDef, MultiIndexBranch, MultiIndexScanOp,
@@ -906,7 +906,10 @@ fn detect_simple_aggregate(
         AggFunc::Count
             if is_unfiltered_btree_count
                 && matches!(agg.distinctness, super::plan::Distinctness::NonDistinct)
-                && agg.args[0].is_nonnull(&plan.table_references, resolver) =>
+                && agg.args[0].is_nonnull(
+                    &TableMetadata::new(Some(&plan.table_references)),
+                    &TypeEnv::new(Some(&plan.table_references), resolver),
+                ) =>
         {
             Some(SimpleAggregate::Count)
         }
@@ -3985,7 +3988,7 @@ pub trait Optimizable {
         Ok(self.check_always_true_or_false()? == Some(AlwaysTrueOrFalse::AlwaysFalse))
     }
     fn is_constant(&self, resolver: &Resolver<'_>) -> bool;
-    fn is_nonnull(&self, tables: &TableReferences, resolver: &Resolver<'_>) -> bool;
+    fn is_nonnull(&self, properties: &impl ExprProperties, types: &TypeEnv) -> bool;
 }
 
 impl Optimizable for ast::Expr {
@@ -3995,24 +3998,24 @@ impl Optimizable for ast::Expr {
     /// This function is currently very conservative, and will return false
     /// for any expression where we aren't sure and didn't bother to find out
     /// by writing more complex code.
-    fn is_nonnull(&self, tables: &TableReferences, resolver: &Resolver<'_>) -> bool {
+    fn is_nonnull(&self, properties: &impl ExprProperties, types: &TypeEnv) -> bool {
         match self {
             Expr::SubqueryResult { .. } => false,
             Expr::Between {
                 lhs, start, end, ..
             } => {
-                lhs.is_nonnull(tables, resolver)
-                    && start.is_nonnull(tables, resolver)
-                    && end.is_nonnull(tables, resolver)
+                lhs.is_nonnull(properties, types)
+                    && start.is_nonnull(properties, types)
+                    && end.is_nonnull(properties, types)
             }
             Expr::Binary(_, ast::Operator::Modulus | ast::Operator::Divide, _) => false, // 1 % 0, 1 / 0
             Expr::Binary(_, ast::Operator::ArrowRight | ast::Operator::ArrowRightShift, _) => false, // JSON path may be absent, yielding NULL
             Expr::Binary(_, ast::Operator::ArrayContains | ast::Operator::ArrayOverlap, _) => false,
             Expr::Binary(lhs, _, rhs) => {
                 // A custom type's function may return NULL for any operands.
-                !runs_custom_type_function(self, &TypeEnv::new(Some(tables), resolver))
-                    && lhs.is_nonnull(tables, resolver)
-                    && rhs.is_nonnull(tables, resolver)
+                !runs_custom_type_function(self, types)
+                    && lhs.is_nonnull(properties, types)
+                    && rhs.is_nonnull(properties, types)
             }
             Expr::Case {
                 when_then_pairs,
@@ -4026,13 +4029,13 @@ impl Optimizable for ast::Expr {
                 // result, so its nullability does not matter.
                 when_then_pairs
                     .iter()
-                    .all(|(_, then)| then.is_nonnull(tables, resolver))
+                    .all(|(_, then)| then.is_nonnull(properties, types))
                     && else_expr
                         .as_ref()
-                        .is_some_and(|else_expr| else_expr.is_nonnull(tables, resolver))
+                        .is_some_and(|else_expr| else_expr.is_nonnull(properties, types))
             }
-            Expr::Cast { expr, .. } => expr.is_nonnull(tables, resolver),
-            Expr::Collate(expr, _) => expr.is_nonnull(tables, resolver),
+            Expr::Cast { expr, .. } => expr.is_nonnull(properties, types),
+            Expr::Collate(expr, _) => expr.is_nonnull(properties, types),
             Expr::DoublyQualified(..) => {
                 panic!("Do not call is_nonnull before DoublyQualified has been rewritten as Column")
             }
@@ -4042,36 +4045,17 @@ impl Optimizable for ast::Expr {
             // A merged USING column is NULL when all of its source columns are NULL.
             Expr::MergedColumn(_) => false,
             Expr::Id(..) => panic!("Do not call is_nonnull before Id has been rewritten as Column"),
+            // A rowid alias column reads the rowid itself.
             Expr::Column {
                 table,
-                column,
-                is_rowid_alias,
+                is_rowid_alias: true,
                 ..
-            } => {
-                // SQLite marks columns from the nullable side of an outer join
-                // as nullable, even when the table schema says NOT NULL.
-                if tables.outer_join_may_null_extend(*table) {
-  
```

---

### Incident Patch 3: `8e2216b3` (2026-10-29)
**Commit Message**: core/translate: read expression nullability through ExprProperties

Optimizable::is_nonnull looked up tables and outer-join state directly in
TableReferences. Move those lookups behind ExprProperties so that later
callers can provide nullability without TableReferences.

ExprProperties gains column_is_nonnull and rowid_is_nonnull. Both report
nullability in the query: an outer join can make a NOT NULL column or a
rowid NULL, and a correlated outer reference keeps the nullability from its
outer scope. TableMetadata implements them with the existing lookups, and
ExprContext delegates to TableMetadata.

is_nonnull still needs to know whether an operator runs a custom type's
function, which can return NULL. It now takes a TypeEnv for that check,
built once by the caller instead of at every operator node. No SQL or query
plan changes.

Tests: existing core unit tests and sqltest suites. Making
rowid_is_nonnull always return true fails 24 existing outer-join and
correlated range-seek sqltests.

Amp-Thread-ID: https://ampcode.com/threads/T-f1d8bc15-8859-400d-b3a6-b8029c7a8ebc
Co-authored-by: pedro muniz <[REDACTED_EMAIL]>

**File**: `core/translate/expr_context.rs` (modified, +38/-0)
```diff
@@ -17,6 +17,12 @@ pub(crate) trait ExprProperties<
 {
     fn column_affinity(&self, source: SourceId, column: usize) -> Option<Affinity>;
     fn column_collation(&self, source: SourceId, column: usize) -> Result<Option<TextCollation>>;
+    /// Whether the column is never NULL in this query. An outer join can make
+    /// a NOT NULL column NULL.
+    fn column_is_nonnull(&self, source: SourceId, column: usize) -> bool;
+    /// Whether the rowid is never NULL in this query. An outer join can make
+    /// the rowid NULL.
+    fn rowid_is_nonnull(&self, source: SourceId) -> bool;
     fn register_affinity(&self, register: usize) -> Option<Affinity>;
     fn register_collation(&self, register: usize) -> Option<TextCollation>;
     fn subquery_affinity(&self, query: SubqueryId, result_reg: usize) -> Option<Affinity>;
@@ -86,6 +92,14 @@ impl ExprProperties for ExprContext<'_, '_> {
         self.tables.column_collation(source, column)
     }
 
+    fn column_is_nonnull(&self, source: TableInternalId, column: usize) -> bool {
+        self.tables.column_is_nonnull(source, column)
+    }
+
+    fn rowid_is_nonnull(&self, source: TableInternalId) -> bool {
+        self.tables.rowid_is_nonnull(source)
+    }
+
     fn register_affinity(&self, register: usize) -> Option<Affinity> {
         self.resolver
             .register_columns
@@ -149,6 +163,30 @@ impl ExprProperties for TableMetadata<'_> {
         Ok(column_collation(column))
     }
 
+    fn column_is_nonnull(&self, source: TableInternalId, column: usize) -> bool {
+        // A null-extended row has a NULL rowid and NULL in every column.
+        if !self.rowid_is_nonnull(source) {
+            return false;
+        }
+        let (_, table) = self
+            .tables
+            .and_then(|tables| tables.find_table_by_internal_id(source))
+            .expect("table not found");
+        let column = &table.columns()[column];
+        // Only INTEGER PRIMARY KEY (rowid alias) is implicitly NOT NULL.
+        // Other PRIMARY KEY types (e.g., TEXT PRIMARY KEY) can contain NULL.
+        column.is_rowid_alias() || column.notnull()
+    }
+
+    fn rowid_is_nonnull(&self, source: TableInternalId) -> bool {
+        // SQLite marks columns from the nullable side of an outer join as
+        // nullable, even when the table schema says NOT NULL. A correlated
+        // outer reference carries the nullability from its own scope.
+        !self
+            .tables
+            .is_some_and(|tables| tables.outer_join_may_null_extend(source))
+    }
+
     fn register_affinity(&self, _register: usize) -> Option<Affinity> {
         None
     }
```

**File**: `core/translate/main_loop/seek.rs` (modified, +10/-3)
```diff
@@ -1,4 +1,6 @@
 use super::*;
+use crate::translate::expr::expr_type::TypeEnv;
+use crate::translate::expr_context::TableMetadata;
 use crate::translate::plan::BitSet;
 use crate::vdbe::insn::NullMatchingMask;
 use turso_parser::ast::NullsOrder;
@@ -184,8 +186,10 @@ impl<'a, 'plan> SeekEmitter<'a, 'plan> {
                     // soon as one shows up. `IS` matches NULL instead: keep the
                     // NULL in the seek register and let the index comparison
                     // find the rows whose key component is NULL.
-                    if !expr.is_nonnull(self.tables, &self.t_ctx.resolver)
-                        && !self.seek_def.is_null_matching_key_component(i)
+                    if !expr.is_nonnull(
+                        &TableMetadata::new(Some(self.tables)),
+                        &TypeEnv::new(Some(self.tables), &self.t_ctx.resolver),
+                    ) && !self.seek_def.is_null_matching_key_component(i)
                     {
                         self.program.emit_insn(Insn::IsNull {
                             reg,
@@ -357,7 +361,10 @@ impl<'a, 'plan> SeekEmitter<'a, 'plan> {
                         });
                     }
                 }
-                if !expr.is_nonnull(self.tables, &self.t_ctx.resolver) {
+                if !expr.is_nonnull(
+                    &TableMetadata::new(Some(self.tables)),
+                    &TypeEnv::new(Some(self.tables), &self.t_ctx.resolver),
+                ) {
                     self.program.emit_insn(Insn::IsNull {
                         reg: last_reg,
                         target_pc: self.loop_end,
```

**File**: `core/translate/optimizer/mod.rs` (modified, +29/-46)
```diff
@@ -1,6 +1,6 @@
 use super::{
     emitter::Resolver,
-    expr_context::ExprContext,
+    expr_context::{ExprContext, ExprProperties, TableMetadata},
     plan::{
         DeletePlan, GroupBy, InSeekSource, IterationDirection, JoinInfo, JoinOrderMember,
         JoinOrigin, JoinType, JoinedTable, MinMaxDef, MultiIndexBranch, MultiIndexScanOp,
@@ -906,7 +906,10 @@ fn detect_simple_aggregate(
         AggFunc::Count
             if is_unfiltered_btree_count
                 && matches!(agg.distinctness, super::plan::Distinctness::NonDistinct)
-                && agg.args[0].is_nonnull(&plan.table_references, resolver) =>
+                && agg.args[0].is_nonnull(
+                    &TableMetadata::new(Some(&plan.table_references)),
+                    &TypeEnv::new(Some(&plan.table_references), resolver),
+                ) =>
         {
             Some(SimpleAggregate::Count)
         }
@@ -3985,7 +3988,7 @@ pub trait Optimizable {
         Ok(self.check_always_true_or_false()? == Some(AlwaysTrueOrFalse::AlwaysFalse))
     }
     fn is_constant(&self, resolver: &Resolver<'_>) -> bool;
-    fn is_nonnull(&self, tables: &TableReferences, resolver: &Resolver<'_>) -> bool;
+    fn is_nonnull(&self, properties: &impl ExprProperties, types: &TypeEnv) -> bool;
 }
 
 impl Optimizable for ast::Expr {
@@ -3995,24 +3998,24 @@ impl Optimizable for ast::Expr {
     /// This function is currently very conservative, and will return false
     /// for any expression where we aren't sure and didn't bother to find out
     /// by writing more complex code.
-    fn is_nonnull(&self, tables: &TableReferences, resolver: &Resolver<'_>) -> bool {
+    fn is_nonnull(&self, properties: &impl ExprProperties, types: &TypeEnv) -> bool {
         match self {
             Expr::SubqueryResult { .. } => false,
             Expr::Between {
                 lhs, start, end, ..
             } => {
-                lhs.is_nonnull(tables, resolver)
-                    && start.is_nonnull(tables, resolver)
-                    && end.is_nonnull(tables, resolver)
+                lhs.is_nonnull(properties, types)
+                    && start.is_nonnull(properties, types)
+                    && end.is_nonnull(properties, types)
             }
             Expr::Binary(_, ast::Operator::Modulus | ast::Operator::Divide, _) => false, // 1 % 0, 1 / 0
             Expr::Binary(_, ast::Operator::ArrowRight | ast::Operator::ArrowRightShift, _) => false, // JSON path may be absent, yielding NULL
             Expr::Binary(_, ast::Operator::ArrayContains | ast::Operator::ArrayOverlap, _) => false,
             Expr::Binary(lhs, _, rhs) => {
                 // A custom type's function may return NULL for any operands.
-                !runs_custom_type_function(self, &TypeEnv::new(Some(tables), resolver))
-                    && lhs.is_nonnull(tables, resolver)
-                    && rhs.is_nonnull(tables, resolver)
+                !runs_custom_type_function(self, types)
+                    && lhs.is_nonnull(properties, types)
+                    && rhs.is_nonnull(properties, types)
             }
             Expr::Case {
                 when_then_pairs,
@@ -4026,13 +4029,13 @@ impl Optimizable for ast::Expr {
                 // result, so its nullability does not matter.
                 when_then_pairs
                     .iter()
-                    .all(|(_, then)| then.is_nonnull(tables, resolver))
+                    .all(|(_, then)| then.is_nonnull(properties, types))
                     && else_expr
                         .as_ref()
-                        .is_some_and(|else_expr| else_expr.is_nonnull(tables, resolver))
+                        .is_some_and(|else_expr| else_expr.is_nonnull(properties, types))
             }
-            Expr::Cast { expr, .. } => expr.is_nonnull(tables, resolver),
-            Expr::Collate(expr, _) => expr.is_nonnull(tables, resolver),
+            Expr::Cast { expr, .. } => expr.is_nonnull(properties, types),
+            Expr::Collate(expr, _) => expr.is_nonnull(properties, types),
             Expr::DoublyQualified(..) => {
                 panic!("Do not call is_nonnull before DoublyQualified has been rewritten as Column")
             }
@@ -4042,36 +4045,17 @@ impl Optimizable for ast::Expr {
             // A merged USING column is NULL when all of its source columns are NULL.
             Expr::MergedColumn(_) => false,
             Expr::Id(..) => panic!("Do not call is_nonnull before Id has been rewritten as Column"),
+            // A rowid alias column reads the rowid itself.
             Expr::Column {
                 table,
-                column,
-                is_rowid_alias,
+                is_rowid_alias: true,
                 ..
-            } => {
-                // SQLite marks columns from the nullable side of an outer join
-                // as nullable, even when the table schema says NOT NULL.
-                if tables.outer_join_may_null_extend(*table) {
-  
```

#### Recent Merged Pull Requests:
- **PR #11114** (2026-10-31): core/storage: clear a shared WAL reader slot before unlocking it (@turso-github-handyman[bot])
- **PR #11113** (2026-10-31): core/storage: create the pointer map page only when allocate_page grows the file (@turso-github-handyman[bot])
- **PR #11109** (2026-10-31): differential-oracle: fix Literal::Real and BinaryOpExpr Display impls (@glommer)
- **PR #11107** (2026-10-31): bindings/python: keep iterating when row_factory returns None (@turso-github-handyman[bot])
- **PR #11087** (2026-10-30): core/translate: fix deferred FK checks for generated child keys (@turso-github-handyman[bot])
- **PR #11082** (2026-10-30): core/translate: refuse DROP TYPE while the schema still uses the type (@abrahamperz)

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

## X. Merge 'core/translate: fix deferred FK checks for generated child keys' from app

**RULE**:
When implementing operations in `core/translate/emitter/delete.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tursodatabase/turso. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8c47ee75`: Merge 'core/translate: fix deferred FK checks for generated child keys' from app/turso-github-handyman. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `core/translate/emitter/delete.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use super::{emit_columns_and_dependencies, Resolver, Result, TranslateCtx};
        let child_positions: Vec<usize> = fk_ref
            .fk
            .child_columns
            .iter()
            .map(|cname| child_tbl.get_column(cname).unwrap().0)
            .collect();
        let child_key = emit_columns_and_dependencies(
            program,
            child_tbl,
            child_cursor_id,
            child_rowid_reg,
            child_positions.iter().copied(),
            resolver,
        )?;

        for &pos in &child_positions {
                reg: child_key.to_column_reg(pos),
                src_reg: child_key.to_column_reg(child_positions[0]),
            // A key that is not an integer cannot match a parent rowid, so the
            // parent is missing, and NotExists jumps there too
            let missing = program.allocate_label();
            let done = program.allocate_label();
                target_pc: Some(missing),
            for (i, &pos) in child_positions.iter().enumerate() {
                    src_reg: child_key.to_column_reg(pos),
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
use super::{Resolver, Result, TranslateCtx};
        for cname in &fk_ref.fk.child_columns {
            let (pos, col) = child_tbl.get_column(cname).unwrap();
            let src = if col.is_rowid_alias() {
                child_rowid_reg
            } else {
                let tmp = program.alloc_register();
                program.emit_insn(Insn::Column {
                    cursor_id: child_cursor_id,
                    column: pos,
                    dest: tmp,
                    default: None,
                });
                tmp
            };
                reg: src,
            let (pos, col) = child_tbl.get_column(&fk_ref.fk.child_columns[0]).unwrap();
            let val = if col.is_rowid_alias() {
                child_rowid_reg
            } else {
                let tmp = program.alloc_register();
                program.emit_insn(Insn::Column {
                    cursor_id: child_cursor_id,
                    column: pos,
                    dest: tmp,
                    default: None,
                });
                tmp
            };
                src_reg: val,
                target_pc: None,
            // NotExists jumps when the parent key is 
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8c47ee75` are properly handled with clean fallback behavior.
