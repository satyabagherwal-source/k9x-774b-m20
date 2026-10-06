# Forensic Learning Record (Deep Inspection): MemoriLabs/Memori

> **Canonical Artifact**: `07_PROJECT_LEARNING/memorilabs-memori-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MemoriLabs/Memori](https://github.com/MemoriLabs/Memori))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:31:42.452Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MemoriLabs/Memori`
- **Description**: Memori is agent-native memory infrastructure. A LLM-agnostic layer that turns agent execution and conversation into structured, persistent state for production systems. Built for enterprise, Memori works with the data infrastructure you already run, no rip-and-replace, and deploys across managed cloud, single-tenant cloud, VPC, and on-premises.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 17074 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `core/bindings/node/src/bridge.rs`
```
use dashmap::DashMap;
use engine_orchestrator::storage::{
    ConnectionFactory, HostStorageError, SqlBind, StorageConnection,
};
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use std::sync::Arc;
use std::sync::Mutex;
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::Duration;
use tokio::sync::oneshot;
use tokio::time::timeout;

const JS_CALLBACK_TIMEOUT: Duration = Duration::from_secs(30);

pub type PendingStorageMap = Arc<DashMap<u32, oneshot::Sender<serde_json::Value>>>;

/// Shared TSFN state cloned into every [`NodeConnection`] that the factory produces.
struct Inner {
    storage_call_tsfn: Mutex<Option<ThreadsafeFunction<(u32, String)>>>,
    pending: PendingStorageMap,
    next_id: AtomicU32,
}

impl Inner {
    /// Fire-and-forget: sends `close` to TS without waiting for acknowledgement.
    /// Used by [`NodeConnection::close`] since close errors are non-fatal and blocking
    /// a Tokio worker thread for a pool-return operation is unnecessary.
    fn send_close(&self, conn_id: u32) {
        let Ok(payload_str) = serde_json::to_string(&serde_json::json!({
            "op": "close",
            "conn_id": conn_id,
        })) else {
            return;
        };
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        // No pending entry — TS will call resolveStorageCall, which silently discards
        // the result when the id is absent from the map.
        if let Some(tsfn) = self
            .storage_call_tsfn
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .as_ref()
        {
            let _ = tsfn.call(
                Ok((id, payload_str)),
                ThreadsafeFunctionCallMode::NonBlocking,
            );
        }
    }

    fn call(&self, payload: serde_json::Value) -> Result<serde_json::Value, HostStorageError> {
        let payload_str = serde_json::to_string(&payload)
            .map_err(|e| HostStorageError::new("JSON_ERR", e.to_string()))?;
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let (tx, rx) = oneshot::channel();
        self.pending.insert(id, tx);

        let status = {
            if let Some(tsfn) = self
                .storage_call_tsfn
                .lock()
                .unwrap_or_else(|p| p.into_inner())
                .as_ref()
            {
                tsfn.call(
                    Ok((id, payload_str)),
                    ThreadsafeFunctionCallMode::NonBlocking,
                )
            } else {
                napi::Status::Closing
            }
        };

        if status != napi::Status::Ok {
            self.pending.remove(&id);
            return Err(HostStorageError::new(
                "NAPI_ERR",
                "failed to queue JS storage callback",
            ));
        }

        // block_in_place lets Tokio know this thread is about to block, keeping the scheduler
        // correct even if Inner::call is ever reached from a regular async worker thread.
        tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(async {
                match timeout(JS_CALLBACK_TIMEOUT, rx).await {
                    Ok(Ok(value)) => {
                        if let Some(err) = value.get("error") {
                            let code = err["code"].as_str().unwrap_or("ERR").to_string();
                            let msg = err["message"]
                                .as_str()
                                .unwrap_or("unknown error")
                                .to_string();
                            Err(HostStorageError::new(code, msg))
                        } else {
                            Ok(value)
                        }
                    }
                    Ok(Err(_)) => Err(HostStorageError::new("NAPI_ERR", "storage channel dropped")),
                    Err(_) => {
                        self.pending.remove(&id);
                        Err(HostStorageError::new(
                            "TIMEOUT",
                            "storage JS callback did not respond within 30s",
                        ))
                    }
                }
            })
        })
    }
}

/// Implements [`ConnectionFactory`] by delegating to a single TypeScript
/// `storageCall(id, payloadJson)` ThreadsafeFunction.
///
/// Protocol — all payloads/results are JSON strings:
///   acquire  → `{ "op": "acquire" }`                                   → `{ "conn_id": N }`
///   execute  → `{ "op": "execute", "conn_id": N, "sql": "…", "binds": […] }` → `{ "rows": […] }`
///   begin    → `{ "op": "begin",   "conn_id": N }`                     → `{ "ok": true }`
///   commit   → `{ "op": "commit",  "conn_id": N }`                     → `{ "ok": true }`
///   rollback → `{ "op": "rollback","conn_id": N }`                     → `{ "ok": true }`
///   close    → `{ "op": "close",   "conn_id": N }`                     → `{ "ok": true }`
///
///   On any error: `{ "error": { "code": "…", "message": "…" } }`
///
/// TS resolves each call via `engine.resolveStorageCall(id, resultJson)`.
pub struct NodeConnectionFactory {
    inner: Arc<Inner>,
    dialect_str: String,
}

impl NodeConnectionFactory {
    pub fn new(storage_call_tsfn: ThreadsafeFunction<(u32, String)>, dialect_str: String) -> Self {
        Self {
            inner: Arc::new(Inner {
                storage_call_tsfn: Mutex::new(Some(storage_call_tsfn)),
                pending: Arc::new(DashMap::new()),
                next_id: AtomicU32::new(1),
            }),
            dialect_str,
        }
    }

    /// Called by `engine.resolveStorageCall` to unblock the waiting Rust thread.
    pub fn resolve(&self, id: u32, result_json: String) {
        if let Some((_, tx)) = self.inner.pending.remove(&id) {
            let value: serde_json::Value = serde_json::from_str(&result_json).unwrap_or(
                serde_json::json!({ "error": { "code": "JSON_ERR", "message": "invalid JSON from TS" } }),
            );
            let _ = tx.send(value);
        }
    }
}

impl ConnectionFactory for NodeConnectionFactory {
    fn acquire(&self) -> Result<Box<dyn StorageConnection>, HostStorageError> {
        let result = self.inner.call(serde_json::json!({ "op": "acquire" }))?;
        let conn_id = result["conn_id"]
            .as_u64()
            .map(|n| n as u32)
            .ok_or_else(|| HostStorageError::new("NAPI_ERR", "acquire returned no conn_id"))?;
        Ok(Box::new(NodeConnection {
            conn_id,
            inner: self.inner.clone(),
        }))
    }

    fn dialect(&self) -> &str {
        &self.dialect_str
    }

    fn shutdown(&self) {
        // Drop the TSFN first so no new calls can be queued.
        let _ = self
            .inner
            .storage_call_tsfn
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .take();
        // Unblock any Rust threads waiting in block_in_place for a JS callback.
        // Without this they would hang until the 30-second timeout fires per call.
        let keys: Vec<u32> = self.inner.pending.iter().map(|e| *e.key()).collect();
        for key in keys {
            if let Some((_, tx)) = self.inner.pending.remove(&key) {
                let _ = tx.send(serde_json::json!({
                    "error": { "code": "SHUTDOWN", "message": "engine is shutting down" }
                }));
            }
        }
    }
}

/// A single checked-out connection. Calls TS for every SQL operation.
pub struct NodeConnection {
    conn_id: u32,
    inner: Arc<Inner>,
}

impl StorageConnection for NodeConnection {
    fn execute(
        &self,
        sql: &str,
        binds: Vec<SqlBind>,
    ) -> Result<Vec<serde_json::Value>, HostStorageError> {
        let result = self.inner.call(serde_json::json!({
            "op": "execute",
            "conn_id": self.conn_id,
            "sql": sql,
            "binds": binds,
        }))?;
        result["rows"]
            .as_array()
            .cloned()
            .ok_or_else(|| HostStorageError::new("NAPI_ERR", "execute response missing rows array"))
    }

    fn begin(&self) -> Result<(), HostStorageError> {
        self.inner
            .call(serde_json::json!({ "op": "begin", "conn_id": self.conn_id }))?;
        Ok(())
    }

    fn commit(&self) -> Result<(), HostStorageError> {
        self.inner
            .call(serde_json::json!({ "op": "commit", "conn_id": self.conn_id }))?;
        Ok(())
    }

    fn rollback(&self) -> Result<(), HostStorageError> {
        self.inner
            .call(serde_json::json!({ "op": "rollback", "conn_id": self.conn_id }))?;
        Ok(())
    }

    fn close(&self) {
        self.inner.send_close(self.conn_id);
    }
}

```

### Core Architecture Module: `core/bindings/node/src/engine.rs`
```
use crate::bridge::NodeConnectionFactory;
use crate::types::*;
use engine_orchestrator::EngineOrchestrator;
use engine_orchestrator::search::FactId;
use engine_orchestrator::storage::models::RankedFact;
use engine_orchestrator::storage::{Dialect, RustStorageManager, StorageBridge, WriteBatch};
use napi::bindgen_prelude::*;
use napi::threadsafe_function::ThreadsafeFunction;
use napi_derive::napi;
use std::panic::catch_unwind;
use std::sync::Arc;

#[napi]
pub struct MemoriEngine {
    pub(crate) inner: Arc<EngineOrchestrator>,
    pub(crate) factory: Arc<NodeConnectionFactory>,
    pub(crate) storage_manager: Arc<RustStorageManager>,
}

#[napi]
impl MemoriEngine {
    /// `dialect` is the SQL dialect of the user's connection (`"sqlite"`, `"postgresql"`, `"cockroachdb"`, `"mysql"`).
    #[napi(constructor)]
    pub fn new(
        env: Env,
        model_name: Option<String>,
        storage_call_cb: ThreadsafeFunction<(u32, String)>,
        dialect: String,
    ) -> Result<Self> {
        // Unref so the TSFN doesn't keep the Node event loop alive when idle.
        unsafe {
            napi::sys::napi_unref_threadsafe_function(env.raw(), storage_call_cb.raw());
        }

        let dialect_enum = dialect.parse::<Dialect>().map_err(Error::from_reason)?;

        let factory = Arc::new(NodeConnectionFactory::new(storage_call_cb, dialect));
        let storage_manager = Arc::new(RustStorageManager::new(factory.clone(), dialect_enum));

        let inner = EngineOrchestrator::new_with_storage(
            model_name.as_deref(),
            Some(storage_manager.clone()),
        )
        .map_err(|e| Error::from_reason(e.to_string()))?;

        let inner = Arc::new(inner);
        // Weak reference breaks the cycle: EngineOrchestrator → storage_manager → embedder → EngineOrchestrator.
        let embed_handle = Arc::downgrade(&inner);
        storage_manager.set_embedder(Box::new(move |texts: Vec<String>| {
            let Some(engine) = embed_handle.upgrade() else {
                return vec![];
            };
            let (flat, shape) = engine.embed(texts);
            if shape[0] == 0 || shape[1] == 0 {
                return vec![];
            }
            let dim = shape[1];
            flat.chunks(dim).map(|c| c.to_vec()).collect()
        }));

        Ok(Self {
            inner,
            factory,
            storage_manager,
        })
    }

    /// Called by TS to unblock a pending Rust storage call.
    ///
    /// `result_json` is one of:
    ///   `{ "conn_id": N }` (for acquire), `{ "rows": [...] }` (for execute),
    ///   `{ "ok": true }` (for begin/commit/rollback/close),
    ///   or `{ "error": { "code": "...", "message": "..." } }`.
    #[napi]
    pub fn resolve_storage_call(&self, id: u32, result_json: String) {
        self.factory.resolve(id, result_json);
    }

    /// Runs database migrations. Must be called once after construction.
    #[napi]
    pub async fn build(&self) -> Result<()> {
        let storage = self.storage_manager.clone();
        tokio::task::spawn_blocking(move || {
            storage
                .build()
                .map_err(|e| Error::from_reason(e.to_string()))
        })
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?
    }

    /// For immediate writes before the augmentation pipeline completes (e.g. conversation messages).
    #[napi]
    pub async fn write_batch(&self, json: String) -> Result<NapiWriteAck> {
        let storage = self.storage_manager.clone();
        tokio::task::spawn_blocking(move || {
            let batch: WriteBatch = serde_json::from_str(&json)
                .map_err(|e| Error::from_reason(format!("invalid batch JSON: {e}")))?;
            storage
                .write_batch(&batch)
                .map_err(|e| Error::from_reason(e.to_string()))
                .map(|ack| NapiWriteAck {
                    written_ops: ack.written_ops as u32,
                })
        })
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?
    }

    /// Returns conversation messages for the given session ID as a JSON array of
    /// `{ role, content }` objects. Returns `"[]"` when no storage is configured.
    #[napi]
    pub async fn get_conversation_history(&self, session_id: String) -> Result<String> {
        let storage = self.storage_manager.clone();
        tokio::task::spawn_blocking(move || {
            storage
                .get_conversation_history(&session_id)
                .map_err(|e| Error::from_reason(e.to_string()))
                .and_then(|messages| {
                    serde_json::to_string(&messages).map_err(|e| Error::from_reason(e.to_string()))
                })
        })
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?
    }

    #[napi]
    pub async fn embed_texts(&self, texts: Vec<String>) -> Result<Vec<Float32Array>> {
        let inner = self.inner.clone();
        // Run ONNX inference on a blocking thread so the Node event loop stays free.
        let chunks: Vec<Vec<f32>> = tokio::task::spawn_blocking(move || {
            let result = catch_unwind(std::panic::AssertUnwindSafe(|| {
                let (flat, shape) = inner.embed(texts);
                if shape[0] == 0 || shape[1] == 0 {
                    return Ok(vec![]);
                }
                let dim = shape[1];
                Ok::<Vec<Vec<f32>>, Error>(flat.chunks(dim).map(|c| c.to_vec()).collect())
            }));
            match result {
                Ok(Ok(v)) => Ok(v),
                Ok(Err(e)) => Err(e),
                Err(_) => Err(Error::from_reason("Rust panicked during embed_texts!")),
            }
        })
        .await
        .map_err(|e| Error::from_reason(e.to_string()))??;
        Ok(chunks.into_iter().map(Float32Array::new).collect())
    }

    #[napi]
    pub async fn retrieve(&self, request: NapiRetrievalRequest) -> Result<Vec<NapiRecallObject>> {
        let inner = self.inner.clone();
        tokio::task::spawn_blocking(move || {
            let req = serde_json::from_value(serde_json::to_value(&request).unwrap())
                .map_err(|e| Error::from_reason(format!("Invalid retrieval request: {}", e)))?;
            let results: Vec<RankedFact> = inner
                .retrieve(req)
                .map_err(|e| Error::from_reason(e.to_string()))?;
            let napi_results = results
                .into_iter()
                .map(|r| {
                    let id = match r.id {
                        FactId::Int(n) => Either::A(n),
                        FactId::String(s) => Either::B(s),
                    };
                    let summaries = if r.summaries.is_empty() {
                        None
                    } else {
                        Some(
                            r.summaries
                                .into_iter()
                                .map(|s| NapiRecallSummary {
                                    content: s["content"].as_str().unwrap_or("").to_string(),
                                    date_created: s["date_created"]
                                        .as_str()
                                        .unwrap_or("")
                                        .to_string(),
                                    entity_fact_id: fact_id_from_json(&s["entity_fact_id"]),
                                    fact_id: fact_id_from_json(&s["fact_id"]),
                                })
                                .collect(),
                        )
                    };
                    NapiRecallObject {
                        id,
                        content: r.content,
                        rank_score: Some(r.rank_score as f64),
                        similarity: Some(r.similarity as f64),
                        date_created: Some(r.date_created),
                        summaries,
                    }
                })
                .collect();
            Ok(napi_results)
        })
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?
    }

    #[napi]
    pub async fn recall(&self, request: NapiRetrievalRequest) -> Result<String> {
        let inner = self.inner.clone();
        tokio::task::spawn_blocking(move || {
            let req = serde_json::from_value(serde_json::to_value(&request).unwrap())
                .map_err(|e| Error::from_reason(format!("Invalid recall request: {}", e)))?;
            inner
                .recall(req)
                .map_err(|e| Error::from_reason(e.to_string()))
        })
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?
    }

    #[napi]
    pub fn submit_augmentation(&self, input: NapiAugmentationInput) -> Result<String> {
        let result = catch_unwind(std::panic::AssertUnwindSafe(|| {
            let core_input = serde_json::from_value(serde_json::to_value(&input).unwrap())
                .map_err(|e| Error::from_reason(format!("Invalid augmentation input: {}", e)))?;
            let accepted = self
                .inner
                .submit_augmentation(core_input)
                .map_err(|e| Error::from_reason(e.to_string()))?;
            Ok(accepted.job_id.to_string())
        }));

        match result {
            Ok(Ok(id)) => Ok(id),
            Ok(Err(e)) => Err(e),
            Err(_) => Err(Error::from_reason(
                "Rust panicked during augmentation submit!",
            )),
        }
    }

    #[napi]
    pub async fn wait_for_augmentation(&self, timeout_ms: Option<u32>) -> Result<bool> {
        let timeout = timeout_ms.map(|ms| std::time::Duration::from_millis(ms as u64));
        let inner = self.inner.clone();
        tokio::task::spawn_blocking(move || inner.wait_for_augmentation(timeout))
            .await
            .map_err(|e| Error::from_reason(e.to_string()))?
            .map_err(|e| Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn shutdown(&self) {
        self.inner.shutdown();
    }
}

fn fact_id_f
```

### Core Architecture Module: `core/bindings/node/src/lib.rs`
```
#![deny(clippy::all)]

mod bridge;
mod engine;
mod types;

// Re-export NAPI types so they are visible to the compiler and index.d.ts generator
pub use engine::MemoriEngine;
pub use types::*;

```

### Core Architecture Module: `core/bindings/node/src/types.rs`
```
use napi::Either;
use napi::bindgen_prelude::Float32Array;
use napi_derive::napi;
use serde::{Deserialize, Serialize};

#[napi(object)]
#[derive(Serialize, Deserialize)]
pub struct NapiRetrievalRequest {
    pub entity_id: String,
    pub query_text: String,
    pub dense_limit: u32,
    pub limit: u32,
}

#[napi(object)]
pub struct NapiRecallSummary {
    pub content: String,
    pub date_created: String,
    pub entity_fact_id: Option<Either<i64, String>>,
    pub fact_id: Option<Either<i64, String>>,
}

#[napi(object)]
pub struct NapiRecallObject {
    pub id: Either<i64, String>,
    pub content: String,
    pub rank_score: Option<f64>,
    pub similarity: Option<f64>,
    pub date_created: Option<String>,
    pub summaries: Option<Vec<NapiRecallSummary>>,
}

#[napi(object)]
#[derive(Serialize, Deserialize)]
pub struct NapiMessage {
    pub role: String,
    pub content: String,
}

#[napi(object)]
#[derive(Serialize, Deserialize)]
pub struct NapiAugmentationInput {
    pub entity_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub process_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conversation_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conversation_messages: Option<Vec<NapiMessage>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub llm_provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub llm_model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub llm_provider_sdk_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub framework: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub platform_provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub storage_dialect: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub storage_cockroachdb: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sdk_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub use_mock_response: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fact_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
}

#[napi(object)]
pub struct NapiEmbeddingRow {
    pub id: Either<i64, String>,
    pub content_embedding: Float32Array,
}

#[napi(object)]
#[derive(Serialize)]
pub struct NapiCandidateSummaryRow {
    pub content: String,
    pub date_created: String,
}

#[napi(object)]
pub struct NapiCandidateFactRow {
    pub id: Either<i64, String>,
    pub content: String,
    pub date_created: String,
    pub summaries: Option<Vec<NapiCandidateSummaryRow>>,
}

#[napi(object)]
pub struct NapiWriteAck {
    pub written_ops: u32,
}

```

### Core Architecture Module: `core/bindings/python/src/lib.rs`
```
//! PyO3 bindings over [`engine_orchestrator::EngineOrchestrator`].
//!
//! This crate is a thin adapter: it deserialises JSON payloads coming from the
//! Python SDK into engine types, invokes the engine, and serialises the result
//! back out. All business logic lives in the root `engine-orchestrator` crate.

#![forbid(unsafe_code)]

use std::collections::HashMap;
use std::sync::Arc;
use std::sync::Mutex;
use std::sync::mpsc;
use std::time::Duration;

use engine_orchestrator::augmentation::AugmentationInput;
use engine_orchestrator::retrieval::RetrievalRequest;
use engine_orchestrator::search::FactId;
use engine_orchestrator::storage::{
    CandidateFactRow, EmbeddingRow, FetchEmbeddingsRequest, FetchFactsByIdsRequest,
    HostStorageError, StorageBridge, WriteAck, WriteBatch,
};
use engine_orchestrator::{
    EmbeddingEngine as CoreEmbeddingEngine, EngineOrchestrator, OrchestratorError,
};
use pyo3::exceptions::{PyRuntimeError, PyValueError};
use pyo3::prelude::*;
use pyo3::types::PyAny;

struct PythonStorageBridge {
    fetch_embeddings_cb: Py<PyAny>,
    fetch_facts_by_ids_cb: Py<PyAny>,
    write_batch_cb: Py<PyAny>,
}

impl PythonStorageBridge {
    const CALLBACK_TIMEOUT: Duration = Duration::from_secs(30);

    fn call_json_callback(
        callback: &Py<PyAny>,
        payload_json: String,
    ) -> Result<String, HostStorageError> {
        let callback: Py<PyAny> = Python::attach(|py| callback.clone_ref(py));
        let (tx, rx) = mpsc::sync_channel(1);
        std::thread::spawn(move || {
            let result = Python::attach(|py| {
                let value = callback
                    .call1(py, (payload_json,))
                    .map_err(|e| HostStorageError::new("python_callback_failed", e.to_string()))?;
                value
                    .extract::<String>(py)
                    .map_err(|e| HostStorageError::new("python_callback_bad_return", e.to_string()))
            });
            let _ = tx.send(result);
        });
        match rx.recv_timeout(Self::CALLBACK_TIMEOUT) {
            Ok(result) => result,
            Err(mpsc::RecvTimeoutError::Timeout) => Err(HostStorageError::new(
                "python_callback_timeout",
                format!(
                    "callback did not return within {}s",
                    Self::CALLBACK_TIMEOUT.as_secs()
                ),
            )),
            Err(mpsc::RecvTimeoutError::Disconnected) => Err(HostStorageError::new(
                "python_callback_channel_closed",
                "callback channel closed",
            )),
        }
    }
}

impl StorageBridge for PythonStorageBridge {
    fn fetch_embeddings(
        &self,
        entity_id: &str,
        limit: usize,
    ) -> Result<Vec<EmbeddingRow>, HostStorageError> {
        let request = FetchEmbeddingsRequest {
            entity_id: entity_id.to_string(),
            limit,
        };
        let payload = serde_json::to_string(&request)
            .map_err(|e| HostStorageError::new("serialization_error", e.to_string()))?;
        let result = Self::call_json_callback(&self.fetch_embeddings_cb, payload)?;
        serde_json::from_str::<Vec<EmbeddingRow>>(&result)
            .map_err(|e| HostStorageError::new("deserialization_error", e.to_string()))
    }

    fn fetch_facts_by_ids(
        &self,
        ids: &[FactId],
    ) -> Result<Vec<CandidateFactRow>, HostStorageError> {
        let request = FetchFactsByIdsRequest { ids: ids.to_vec() };
        let payload = serde_json::to_string(&request)
            .map_err(|e| HostStorageError::new("serialization_error", e.to_string()))?;
        let result = Self::call_json_callback(&self.fetch_facts_by_ids_cb, payload)?;
        serde_json::from_str::<Vec<CandidateFactRow>>(&result)
            .map_err(|e| HostStorageError::new("deserialization_error", e.to_string()))
    }

    fn write_batch(&self, batch: &WriteBatch) -> Result<WriteAck, HostStorageError> {
        let payload = serde_json::to_string(batch)
            .map_err(|e| HostStorageError::new("serialization_error", e.to_string()))?;
        let result = Self::call_json_callback(&self.write_batch_cb, payload)?;
        serde_json::from_str::<WriteAck>(&result)
            .map_err(|e| HostStorageError::new("deserialization_error", e.to_string()))
    }
}

#[pyclass]
pub struct MemoriEngine {
    inner: EngineOrchestrator,
}

#[pymethods]
impl MemoriEngine {
    #[new]
    #[pyo3(signature = (model_name=None))]
    fn new(model_name: Option<&str>) -> PyResult<Self> {
        let inner = EngineOrchestrator::new(model_name)
            .map_err(|e| PyRuntimeError::new_err(e.to_string()))?;
        Ok(Self { inner })
    }

    fn execute(&self, command: &str) -> PyResult<String> {
        self.inner
            .execute(command)
            .map_err(orchestrator_error_to_py_err)
    }

    fn hello_world(&self) -> String {
        self.inner.hello_world()
    }

    fn core_postprocess_request(&self, payload: &str) -> PyResult<u64> {
        self.inner
            .postprocess_request(payload)
            .map(|accepted| accepted.job_id)
            .map_err(orchestrator_error_to_py_err)
    }

    fn embed_texts(&self, py: Python<'_>, texts: Vec<String>) -> Vec<Vec<f32>> {
        reshape_embedding_result(py.detach(|| self.inner.embed(texts)))
    }
}

#[pyclass]
struct NativeEmbedder {
    inner: CoreEmbeddingEngine,
}

#[pymethods]
impl NativeEmbedder {
    #[new]
    #[pyo3(signature = (model_name=None))]
    fn new(model_name: Option<&str>) -> PyResult<Self> {
        let inner = CoreEmbeddingEngine::new(model_name)
            .map_err(|e| PyRuntimeError::new_err(e.to_string()))?;
        Ok(Self { inner })
    }

    fn embed_texts(&self, py: Python<'_>, texts: Vec<String>) -> Vec<Vec<f32>> {
        reshape_embedding_result(py.detach(|| self.inner.embed(texts)))
    }
}

#[pyclass]
struct EngineHandle {
    orchestrator: EngineOrchestrator,
}

#[pymethods]
impl EngineHandle {
    #[new]
    fn new(
        model_name: Option<String>,
        fetch_embeddings_cb: Py<PyAny>,
        fetch_facts_by_ids_cb: Py<PyAny>,
        write_batch_cb: Py<PyAny>,
    ) -> PyResult<Self> {
        let bridge = PythonStorageBridge {
            fetch_embeddings_cb,
            fetch_facts_by_ids_cb,
            write_batch_cb,
        };
        let orchestrator =
            EngineOrchestrator::new_with_storage(model_name.as_deref(), Some(Arc::new(bridge)))
                .map_err(|e| PyRuntimeError::new_err(e.to_string()))?;
        Ok(Self { orchestrator })
    }

    fn execute(&self, command: &str) -> PyResult<String> {
        self.orchestrator
            .execute(command)
            .map_err(orchestrator_error_to_py_err)
    }

    fn hello_world(&self) -> String {
        self.orchestrator.hello_world()
    }

    fn core_postprocess_request(&self, payload: &str) -> PyResult<u64> {
        self.orchestrator
            .postprocess_request(payload)
            .map(|accepted| accepted.job_id)
            .map_err(orchestrator_error_to_py_err)
    }

    fn embed_texts(&self, py: Python<'_>, texts: Vec<String>) -> Vec<Vec<f32>> {
        reshape_embedding_result(py.detach(|| self.orchestrator.embed(texts)))
    }

    fn retrieve(&self, py: Python<'_>, request_json: &str) -> PyResult<String> {
        let request: RetrievalRequest =
            serde_json::from_str(request_json).map_err(|e| PyValueError::new_err(e.to_string()))?;
        let ranked = py
            .detach(|| self.orchestrator.retrieve(request))
            .map_err(orchestrator_error_to_py_err)?;
        serde_json::to_string(&ranked).map_err(|e| PyRuntimeError::new_err(e.to_string()))
    }

    fn recall(&self, py: Python<'_>, request_json: &str) -> PyResult<String> {
        let request: RetrievalRequest =
            serde_json::from_str(request_json).map_err(|e| PyValueError::new_err(e.to_string()))?;
        py.detach(|| self.orchestrator.recall(request))
            .map_err(orchestrator_error_to_py_err)
    }

    fn submit_augmentation(&self, input_json: &str) -> PyResult<u64> {
        let input: AugmentationInput =
            serde_json::from_str(input_json).map_err(|e| PyValueError::new_err(e.to_string()))?;
        self.orchestrator
            .submit_augmentation(input)
            .map(|accepted| accepted.job_id)
            .map_err(orchestrator_error_to_py_err)
    }

    #[pyo3(signature = (timeout_ms=None))]
    fn wait_for_augmentation(&self, py: Python<'_>, timeout_ms: Option<u64>) -> PyResult<bool> {
        let timeout = timeout_ms.map(Duration::from_millis);
        py.detach(|| self.orchestrator.wait_for_augmentation(timeout))
            .map_err(orchestrator_error_to_py_err)
    }
}

#[pyfunction]
fn execute(command: &str) -> PyResult<String> {
    let orchestrator =
        EngineOrchestrator::new(None).map_err(|e| PyRuntimeError::new_err(e.to_string()))?;
    orchestrator
        .execute(command)
        .map_err(orchestrator_error_to_py_err)
}

#[pyfunction]
fn hello_world() -> PyResult<String> {
    let orchestrator =
        EngineOrchestrator::new(None).map_err(|e| PyRuntimeError::new_err(e.to_string()))?;
    Ok(orchestrator.hello_world())
}

#[pyfunction]
fn core_postprocess_request(payload: &str) -> PyResult<u64> {
    let orchestrator =
        EngineOrchestrator::new(None).map_err(|e| PyRuntimeError::new_err(e.to_string()))?;
    orchestrator
        .postprocess_request(payload)
        .map(|accepted| accepted.job_id)
        .map_err(orchestrator_error_to_py_err)
}

#[pyfunction]
#[pyo3(signature = (texts, model_name=None))]
fn embed_texts(
    py: Python<'_>,
    texts: Vec<String>,
    model_name: Option<&str>,
) -> PyResult<Vec<Vec<f32>>> {
    let model_name = model_name.map(str::to_owned);
    let result: Result<Vec<Vec<f32>>, OrchestratorError> = py.detach(move || {
        let engine = cached_embedding_engine(model_name.as_deref())?;
        Ok(reshape_embedding_result(engine.embed(texts)))
    });
    result.map_err(orche
```

### Core Architecture Module: `core/src/augmentation/mod.rs`
```
pub mod models;
pub mod pipeline;

pub use models::{
    AugmentationAttribution, AugmentationAttributionEntity, AugmentationAttributionProcess,
    AugmentationConversation, AugmentationInput, AugmentationLlm, AugmentationMeta,
    AugmentationPayload, AugmentationSdk, ConversationMessage,
};
pub use pipeline::{
    attach_entity_fact_embeddings, build_payload, build_write_batch_from_response,
    run_advanced_augmentation,
};

```

### Core Architecture Module: `core/src/augmentation/models.rs`
```
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AugmentationInput {
    pub entity_id: String,
    #[serde(default)]
    pub process_id: Option<String>,
    #[serde(default)]
    pub conversation_id: Option<String>,
    #[serde(default)]
    pub conversation_messages: Vec<ConversationMessage>,
    #[serde(default)]
    pub system_prompt: Option<String>,
    #[serde(default)]
    pub llm_provider: Option<String>,
    #[serde(default)]
    pub llm_model: Option<String>,
    #[serde(default)]
    pub llm_provider_sdk_version: Option<String>,
    #[serde(default)]
    pub framework: Option<String>,
    #[serde(default)]
    pub platform_provider: Option<String>,
    #[serde(default)]
    pub storage_dialect: Option<String>,
    #[serde(default)]
    pub storage_cockroachdb: Option<bool>,
    #[serde(default)]
    pub sdk_version: Option<String>,
    #[serde(default)]
    pub use_mock_response: bool,
    #[serde(default)]
    pub mock_response: Option<serde_json::Value>,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub fact_id: Option<String>,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AugmentationPayload {
    pub conversation: AugmentationConversation,
    pub meta: AugmentationMeta,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AugmentationConversation {
    pub messages: Vec<ConversationMessage>,
    pub summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AugmentationMeta {
    pub attribution: AugmentationAttribution,
    pub framework: AugmentationFramework,
    pub llm: AugmentationLlm,
    pub platform: AugmentationPlatform,
    pub sdk: AugmentationSdk,
    pub storage: AugmentationStorage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AugmentationAttribution {
    pub entity: AugmentationAttributionEntity,
    pub process: AugmentationAttributionProcess,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AugmentationAttributionEntity {
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AugmentationAttributionProcess {
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AugmentationLlm {
    pub model: AugmentationLlmModel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AugmentationLlmModel {
    pub provider: Option<String>,
    pub sdk: AugmentationLlmSdk,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AugmentationLlmSdk {
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AugmentationSdk {
    pub lang: String,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AugmentationFramework {
    pub provider: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AugmentationPlatform {
    pub provider: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AugmentationStorage {
    pub cockroachdb: bool,
    pub dialect: Option<String>,
}

```

### Core Architecture Module: `core/src/augmentation/pipeline.rs`
```
use crate::OrchestratorError;
use crate::augmentation::models::{
    AugmentationAttribution, AugmentationAttributionEntity, AugmentationAttributionProcess,
    AugmentationConversation, AugmentationFramework, AugmentationInput, AugmentationLlm,
    AugmentationLlmModel, AugmentationLlmSdk, AugmentationMeta, AugmentationPayload,
    AugmentationPlatform, AugmentationSdk, AugmentationStorage, ConversationMessage,
};
use crate::network::{ApiError, MemoriClient};
use crate::storage::{WriteBatch, WriteOp};
use sha2::{Digest, Sha256};

pub async fn run_advanced_augmentation(
    input: &AugmentationInput,
    client: &MemoriClient,
) -> Result<WriteBatch, OrchestratorError> {
    let payload = build_payload(input);
    if log::log_enabled!(log::Level::Trace) {
        if let Ok(payload_json) = serde_json::to_string(&payload) {
            log::trace!("augmentation request payload: {payload_json}");
        }
    }

    let response = if input.use_mock_response {
        log::debug!("augmentation using mock response");
        input
            .mock_response
            .clone()
            .unwrap_or_else(default_mock_augmentation_response)
    } else {
        log::debug!("augmentation calling Memori API: sdk/augmentation");
        let raw_response = client.augmentation_raw_async(&payload).await?;
        log::trace!("augmentation raw response body: {raw_response}");
        serde_json::from_str::<serde_json::Value>(&raw_response).map_err(|e| {
            OrchestratorError::ApiError(ApiError::Network(format!(
                "failed to parse augmentation response body as JSON: {e}"
            )))
        })?
    };
    Ok(build_write_batch_from_response(input, response))
}

pub fn build_payload(input: &AugmentationInput) -> AugmentationPayload {
    let mut messages = input.conversation_messages.clone();
    if messages.is_empty() {
        if let Some(content) = input.content.clone() {
            messages.push(ConversationMessage {
                role: "assistant".to_string(),
                content,
            });
        }
    }

    AugmentationPayload {
        conversation: AugmentationConversation {
            messages,
            summary: None,
        },
        meta: AugmentationMeta {
            attribution: AugmentationAttribution {
                entity: AugmentationAttributionEntity {
                    id: hash_id(&input.entity_id),
                },
                process: AugmentationAttributionProcess {
                    id: hash_id(input.process_id.as_deref().unwrap_or("")),
                },
            },
            framework: AugmentationFramework {
                provider: input.framework.clone(),
            },
            llm: AugmentationLlm {
                model: AugmentationLlmModel {
                    provider: input.llm_provider.clone(),
                    sdk: AugmentationLlmSdk {
                        version: input.llm_provider_sdk_version.clone(),
                    },
                    version: input.llm_model.clone(),
                },
            },
            platform: AugmentationPlatform {
                provider: input.platform_provider.clone(),
            },
            sdk: AugmentationSdk {
                lang: "python".to_string(),
                version: input.sdk_version.clone(),
            },
            storage: AugmentationStorage {
                cockroachdb: input.storage_cockroachdb.unwrap_or(false),
                dialect: input.storage_dialect.clone(),
            },
        },
    }
}

fn hash_id(value: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(value.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn build_write_batch_from_response(
    input: &AugmentationInput,
    response: serde_json::Value,
) -> WriteBatch {
    let mut ops = Vec::new();

    if let Some(facts) = extract_facts(&response) {
        ops.push(WriteOp {
            op_type: "entity_fact.create".to_string(),
            payload: serde_json::json!({
                "entity_id": input.entity_id,
                "conversation_id": input.conversation_id,
                "facts": facts,
            }),
        });
    }

    if let Some(triples) = response
        .pointer("/entity/semantic_triples")
        .or_else(|| response.pointer("/entity/triples"))
        .cloned()
    {
        ops.push(WriteOp {
            op_type: "knowledge_graph.create".to_string(),
            payload: serde_json::json!({
                "entity_id": input.entity_id,
                "semantic_triples": triples,
            }),
        });
    }

    if let Some(attrs) = response.pointer("/process/attributes").cloned() {
        ops.push(WriteOp {
            op_type: "process_attribute.create".to_string(),
            payload: serde_json::json!({
                "process_id": input.process_id,
                "attributes": attrs,
            }),
        });
    }

    if let Some(summary) = response.pointer("/conversation/summary").cloned() {
        ops.push(WriteOp {
            op_type: "conversation.update".to_string(),
            payload: serde_json::json!({
                "conversation_id": input.conversation_id,
                "summary": summary,
            }),
        });
    }

    if ops.is_empty() {
        if let Some(content) = input.content.clone() {
            ops.push(WriteOp {
                op_type: "upsert_fact".to_string(),
                payload: serde_json::json!({
                    "entity_id": input.entity_id,
                    "fact_id": input.fact_id,
                    "content": content,
                    "metadata": input.metadata,
                }),
            });
        }
    }

    WriteBatch { ops }
}

pub fn attach_entity_fact_embeddings<F>(mut batch: WriteBatch, mut embed: F) -> WriteBatch
where
    F: FnMut(Vec<String>) -> (Vec<f32>, [usize; 2]),
{
    for op in batch.ops.iter_mut() {
        if op.op_type != "entity_fact.create" {
            continue;
        }

        let Some(payload) = op.payload.as_object_mut() else {
            continue;
        };
        if payload.contains_key("fact_embeddings") {
            continue;
        }

        let facts = payload
            .get("facts")
            .and_then(|value| value.as_array())
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.as_str().map(ToString::to_string))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        if facts.is_empty() {
            continue;
        }

        let expected_rows = facts.len();
        let embeddable: Vec<(usize, String)> = facts
            .iter()
            .enumerate()
            .filter(|(_, fact)| is_embeddable_text(fact))
            .map(|(index, fact)| (index, fact.clone()))
            .collect();
        if embeddable.is_empty() {
            continue;
        }

        let embed_inputs: Vec<String> = embeddable.iter().map(|(_, fact)| fact.clone()).collect();
        let (flat, shape) = embed(embed_inputs);
        let embedded = reshape_embeddings(flat, shape);
        if embedded.len() != embeddable.len() {
            log::warn!(
                "Skipping fact_embeddings for entity_fact.create: expected {} embeddable rows, got {}",
                embeddable.len(),
                embedded.len()
            );
            continue;
        }
        if !embedding_rows_have_signal(&embedded) {
            log::warn!(
                "Skipping fact_embeddings for entity_fact.create: embeddings have no semantic signal"
            );
            continue;
        }

        let mut aligned = vec![Vec::new(); expected_rows];
        for ((index, _), vector) in embeddable.into_iter().zip(embedded) {
            aligned[index] = vector;
        }
        payload.insert("fact_embeddings".to_string(), serde_json::json!(aligned));
    }

    batch
}

fn is_embeddable_text(text: &str) -> bool {
    text.chars()
        .any(|c| !c.is_whitespace() && !c.is_control() && c != '\u{200B}')
}

fn embedding_rows_have_signal(embeddings: &[Vec<f32>]) -> bool {
    !embeddings.is_empty()
        && embeddings
            .iter()
            .all(|row| row.iter().any(|value| *value != 0.0))
}

fn reshape_embeddings(flat: Vec<f32>, shape: [usize; 2]) -> Vec<Vec<f32>> {
    let [rows, cols] = shape;
    if rows == 0 || cols == 0 || flat.len() != rows.saturating_mul(cols) {
        return Vec::new();
    }

    flat.chunks_exact(cols)
        .map(|chunk| chunk.to_vec())
        .collect::<Vec<_>>()
}

fn extract_facts(response: &serde_json::Value) -> Option<Vec<String>> {
    if let Some(arr) = response
        .pointer("/entity/facts")
        .and_then(|value| value.as_array())
    {
        let mut facts = Vec::new();
        for item in arr {
            if let Some(text) = item.as_str() {
                facts.push(text.to_string());
                continue;
            }
            if let Some(content) = item.get("content").and_then(|v| v.as_str()) {
                facts.push(content.to_string());
            }
        }
        if !facts.is_empty() {
            return Some(facts);
        }
    }

    let triples = response
        .pointer("/entity/triples")
        .or_else(|| response.pointer("/entity/semantic_triples"))
        .and_then(|value| value.as_array())?;
    let mut facts = Vec::new();
    for triple in triples {
        if let Some(content) = triple.get("content").and_then(|v| v.as_str()) {
            facts.push(content.to_string());
            continue;
        }

        let subject = read_triple_value(triple.get("subject"));
        let predicate = triple.get("predicate").and_then(|v| v.as_str());
        let object = read_triple_value(triple.get("object"));
        if let (Some(s), Some(p), Some(o)) = (subject, predicate, object) {
            facts.push(format!("{s} {p} {o}"));
        }
    }
    if facts.is_empty() { None } else { Some(facts) }
}

```

### Core Architecture Module: `core/src/embeddings/api.rs`
```
//! Embedding pipeline: chunks inputs, runs the model in one batch, pools
//! multi-chunk inputs, and flattens the result for FFI transport.

use crate::embeddings::chunking::chunk_text_by_tokens;
use crate::embeddings::models::SentenceTransformersEmbedder;
use crate::embeddings::utils::{prepare_text_inputs, zero_vectors};

/// Represents an execution plan for a single input text.
enum TextPlan {
    /// Reuses the original owned string. Zero allocations.
    Single(String),
    /// Holds newly allocated sub-chunks because the string exceeded the token window.
    Multi(Vec<String>),
}

/// Maps the logical input document to its physical row locations inside the flattened compute batch.
enum Meta {
    Single { idx: usize },
    Multi { start: usize, len: usize },
}

/// Analyzes text length and determines if it requires chunking.
fn plan_text(text: String, embedder: &SentenceTransformersEmbedder) -> TextPlan {
    match chunk_text_by_tokens(&text, embedder.tokenizer(), embedder.chunk_size()) {
        None => TextPlan::Single(text),
        Some(chunks) => TextPlan::Multi(chunks),
    }
}

/// Averages multiple chunk vectors back into a single representative vector, then L2-normalizes.
fn mean_pool_l2(chunk_embeddings: &[Vec<f32>]) -> Vec<f32> {
    debug_assert!(!chunk_embeddings.is_empty());
    let dim = chunk_embeddings[0].len();
    let mut pooled = vec![0.0; dim];

    for vec in chunk_embeddings {
        for (p, &v) in pooled.iter_mut().zip(vec) {
            *p += v;
        }
    }

    let n = chunk_embeddings.len() as f32;
    for v in pooled.iter_mut() {
        *v /= n;
    }

    let norm: f32 = pooled.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 0.0 {
        for v in pooled.iter_mut() {
            *v /= norm;
        }
    }
    pooled
}

fn build_flat_and_metas(plans: Vec<TextPlan>) -> (Vec<String>, Vec<Meta>) {
    let mut flat = Vec::new();
    let mut metas = Vec::with_capacity(plans.len());
    for plan in plans {
        match plan {
            TextPlan::Single(full) => {
                let idx = flat.len();
                flat.push(full);
                metas.push(Meta::Single { idx });
            }
            TextPlan::Multi(chunks) => {
                let start = flat.len();
                let len = chunks.len();
                flat.extend(chunks);
                metas.push(Meta::Multi { start, len });
            }
        }
    }
    (flat, metas)
}

/// Assembles per-document embeddings from a raw flat-chunk batch result.
///
/// `raw` has one entry per element of `flat` (i.e. one per chunk).
/// Returns one pooled embedding per logical document (one per entry in `metas`).
fn pool_batch_results(raw: Vec<Vec<f32>>, metas: &[Meta]) -> Vec<Vec<f32>> {
    let mut out = Vec::with_capacity(metas.len());
    for meta in metas {
        match meta {
            Meta::Single { idx } => out.push(raw[*idx].clone()),
            Meta::Multi { start, len } => out.push(mean_pool_l2(&raw[*start..*start + *len])),
        }
    }
    out
}

/// Runs the primary fused batch embed and returns one pooled vector per document.
fn run_batch(
    embedder: &SentenceTransformersEmbedder,
    flat: &[String],
    metas: &[Meta],
) -> Result<Vec<Vec<f32>>, String> {
    let raw = embedder
        .embed_batch(flat)
        .map_err(|e| format!("Fused embed failed: {}", e))?;
    Ok(pool_batch_results(raw, metas))
}

/// Sequential fallback: embeds each document's chunks together, then pools Multi docs.
/// Returns one pooled vector per document.
fn fallback_sequential(
    embedder: &SentenceTransformersEmbedder,
    flat: &[String],
    metas: &[Meta],
) -> Result<Vec<Vec<f32>>, String> {
    let mut out = Vec::with_capacity(metas.len());
    for meta in metas {
        match meta {
            Meta::Single { idx } => {
                let emb = embedder
                    .embed_single(&flat[*idx])
                    .map_err(|e| format!("Single embed failed: {}", e))?;
                out.push(emb);
            }
            Meta::Multi { start, len } => {
                let chunk_embeddings = embedder
                    .embed_batch(&flat[*start..*start + *len])
                    .map_err(|e| format!("Chunk batch embed failed: {}", e))?;
                out.push(mean_pool_l2(&chunk_embeddings));
            }
        }
    }
    Ok(out)
}

/// Last-resort fallback: embeds every chunk one at a time, then pools Multi docs.
/// Returns one pooled vector per document.
fn fallback_one_by_one(
    embedder: &SentenceTransformersEmbedder,
    flat: &[String],
    metas: &[Meta],
) -> Result<Vec<Vec<f32>>, String> {
    let raw = embedder
        .embed_one_by_one(flat)
        .map_err(|e| format!("One-by-one embed failed: {}", e))?;

    let mut out = Vec::with_capacity(metas.len());
    for meta in metas {
        match meta {
            Meta::Single { idx } => out.push(raw[*idx].clone()),
            Meta::Multi { start, len } => {
                out.push(mean_pool_l2(&raw[*start..*start + *len]));
            }
        }
    }
    Ok(out)
}

/// Converts `texts` into a flattened embedding buffer `(Vec<f32>, [rows, cols])`.
///
/// On model failure the pipeline degrades through `run_batch` →
/// `fallback_sequential` → `fallback_one_by_one`, and as a last resort
/// returns zero-vectors so callers always receive a well-formed buffer.
pub fn embed_texts(
    embedder: &SentenceTransformersEmbedder,
    texts: Vec<String>,
) -> (Vec<f32>, [usize; 2]) {
    let inputs = prepare_text_inputs(texts);
    let dim = embedder.dim();

    if inputs.is_empty() {
        return (Vec::new(), [0, dim]);
    }

    let num_inputs = inputs.len();
    log::debug!("Generating embeddings for {} text(s)", num_inputs);

    let mut plans = Vec::with_capacity(num_inputs);
    for text in inputs {
        plans.push(plan_text(text, embedder));
    }

    let (flat, metas) = build_flat_and_metas(plans);
    if flat.is_empty() {
        return (Vec::new(), [0, dim]);
    }

    let doc_embs = match run_batch(embedder, &flat, &metas) {
        Ok(e) => e,
        Err(e) => {
            log::warn!("{}, falling back to sequential", e);
            match fallback_sequential(embedder, &flat, &metas) {
                Ok(seq_emb) => seq_emb,
                Err(e2) => {
                    log::warn!("Sequential fallback failed ({}), trying one-by-one", e2);
                    match fallback_one_by_one(embedder, &flat, &metas) {
                        Ok(one_emb) => one_emb,
                        Err(e3) => {
                            log::error!(
                                "All embedding fallbacks failed ({}). Returning zero vectors to maintain pipeline continuity.",
                                e3
                            );
                            zero_vectors(num_inputs, dim)
                        }
                    }
                }
            }
        }
    };

    let mut flat_out = Vec::with_capacity(num_inputs * dim);
    for emb in doc_embs {
        flat_out.extend_from_slice(&emb);
    }

    (flat_out, [num_inputs, dim])
}

```

### Core Architecture Module: `core/src/embeddings/chunking.rs`
```
//! Token-length based text splitting. Ensures large documents don't crash the ONNX session context window.

use tokenizers::Tokenizer;

/// Splits `text` into token windows of at most `chunk_size` tokens.
///
/// Returns `None` if the text fits within a single window — the caller should reuse the original
/// owned string with zero allocations. Returns `Some(chunks)` with at least two entries when the
/// text was split.
pub fn chunk_text_by_tokens(
    text: &str,
    tokenizer: &Tokenizer,
    chunk_size: usize,
) -> Option<Vec<String>> {
    if chunk_size == 0 {
        log::warn!("chunk_size is 0, treating as single chunk");
        return None;
    }

    if text.trim().is_empty() {
        return None;
    }

    let encoding = match tokenizer.encode(text, false) {
        Ok(e) => e,
        Err(e) => {
            log::warn!("Failed to tokenize text: {}, treating as single chunk", e);
            return None;
        }
    };

    let ids = encoding.get_ids();

    if ids.len() <= chunk_size {
        return None;
    }

    let mut chunks = Vec::new();

    for chunk_ids in ids.chunks(chunk_size) {
        match tokenizer.decode(chunk_ids, true) {
            Ok(decoded) => {
                if !decoded.is_empty() {
                    chunks.push(decoded);
                }
            }
            Err(e) => {
                log::warn!("Failed to decode chunk: {}", e);
            }
        }
    }

    if chunks.len() <= 1 {
        log::warn!("Chunking produced <= 1 results, treating as single chunk");
        None
    } else {
        Some(chunks)
    }
}

```

### Core Architecture Module: `core/src/embeddings/mod.rs`
```
//! Text embedding backed by `fastembed`.
mod api;
mod chunking;
mod models;
mod utils;

pub use api::embed_texts;
pub use models::SentenceTransformersEmbedder;
pub use utils::{
    format_embedding_for_db, parse_embedding_batch_from_db, parse_embedding_from_db,
    prepare_text_inputs, zero_vectors,
};

```

### Core Architecture Module: `core/src/embeddings/models.rs`
```
//! ONNX-backed text embedder via `fastembed`.

use anyhow::{Result, anyhow};
use fastembed::{EmbeddingModel, ModelTrait, TextEmbedding, TextInitOptions, get_cache_dir};
use hf_hub::{Cache, api::sync::ApiBuilder, api::sync::ApiRepo};
use parking_lot::Mutex;
use std::path::PathBuf;
use tokenizers::Tokenizer;

/// Sentence-transformers embedder with metadata required by the chunking pipeline.
pub struct SentenceTransformersEmbedder {
    // `TextEmbedding::embed` requires `&mut self` for internal ONNX runtime state.
    // We initialize lazily so engine startup does not require loading ONNX runtime.
    model: Mutex<Option<TextEmbedding>>,
    embedding_model: EmbeddingModel,
    cache_dir: PathBuf,
    tokenizer: Tokenizer,
    dim: usize,
    chunk_size: usize,
}

impl SentenceTransformersEmbedder {
    /// Reads the model's maximum sequence length from HuggingFace config files, if available.
    fn fetch_max_seq_length(repo: &ApiRepo) -> Option<usize> {
        if let Ok(sbert_path) = repo.get("sentence_bert_config.json") {
            let content = std::fs::read_to_string(sbert_path).ok()?;
            let json = serde_json::from_str::<serde_json::Value>(&content).ok()?;
            if let Some(val) = json.get("max_seq_length").and_then(|v| v.as_u64()) {
                return Some(val as usize);
            }
        }

        if let Ok(config_path) = repo.get("config.json") {
            let content = std::fs::read_to_string(config_path).ok()?;
            let json = serde_json::from_str::<serde_json::Value>(&content).ok()?;
            if let Some(val) = json.get("max_position_embeddings").and_then(|v| v.as_u64()) {
                return Some(val as usize);
            }
        }
        None
    }

    /// Initializes the embedder. Downloads weights and configuration to the local OS cache if not present.
    ///
    /// # Errors
    /// Fails if the HuggingFace hub is unreachable or the model architecture is unsupported.
    pub fn new(model_name: Option<&str>) -> Result<Self> {
        let embedding_model: EmbeddingModel = match model_name {
            Some(name) => name.parse().map_err(|e: String| anyhow!("{e}"))?,
            None => EmbeddingModel::AllMiniLML6V2,
        };

        let model_info = EmbeddingModel::get_model_info(&embedding_model)
            .ok_or_else(|| anyhow!("No model info found for {embedding_model}"))?;

        let cache_dir: PathBuf = get_cache_dir().into();
        let dim = model_info.dim;

        let api = ApiBuilder::from_cache(Cache::new(cache_dir.clone()))
            .build()
            .map_err(|e| anyhow!("Failed to initialize HF API: {}", e))?;
        let repo = api.model(model_info.model_code.clone());

        let max_seq_length = Self::fetch_max_seq_length(&repo).unwrap_or(256);
        let chunk_size = std::cmp::max(1, max_seq_length.saturating_sub(2));

        let tokenizer_path = repo.get("tokenizer.json").map_err(|e| {
            anyhow!(
                "Could not find tokenizer.json for {}: {}",
                model_info.model_code,
                e
            )
        })?;
        let tokenizer = Tokenizer::from_file(tokenizer_path)
            .map_err(|e| anyhow!("Failed to load tokenizer file: {}", e))?;

        Ok(Self {
            model: Mutex::new(None),
            embedding_model,
            cache_dir,
            tokenizer,
            dim,
            chunk_size,
        })
    }

    fn with_model<T>(&self, f: impl FnOnce(&mut TextEmbedding) -> Result<T>) -> Result<T> {
        let mut model_guard = self.model.lock();
        if model_guard.is_none() {
            let model = TextEmbedding::try_new(
                TextInitOptions::new(self.embedding_model.clone())
                    .with_show_download_progress(false)
                    .with_cache_dir(self.cache_dir.clone()),
            )?;
            *model_guard = Some(model);
        }

        match model_guard.as_mut() {
            Some(model) => f(model),
            None => Err(anyhow!("Failed to initialize embedding model")),
        }
    }

    pub fn tokenizer(&self) -> &Tokenizer {
        &self.tokenizer
    }

    pub fn dim(&self) -> usize {
        self.dim
    }

    pub fn chunk_size(&self) -> usize {
        self.chunk_size
    }

    pub fn embed_single(&self, text: &str) -> Result<Vec<f32>> {
        self.with_model(|model| {
            let embeddings = model.embed(vec![text], None)?;
            Ok(embeddings[0].clone())
        })
    }

    pub fn embed_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
        self.with_model(|model| model.embed(texts, None))
    }

    pub fn embed_one_by_one(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
        let mut results = Vec::with_capacity(texts.len());
        self.with_model(|model| {
            for text in texts {
                let embeddings = model.embed(vec![text.as_str()], None)?;
                results.push(embeddings[0].clone());
            }
            Ok(())
        })?;

        let dim_set: std::collections::HashSet<usize> = results.iter().map(|v| v.len()).collect();

        if dim_set.len() != 1 {
            return Err(anyhow!("Inconsistent embedding dimensions: {:?}", dim_set));
        }

        Ok(results)
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #573** (2026-05-30): **[Bug]**
  *Symptoms*: ### First Check  - [x] I added a very descriptive title to this issue. - [x] I searched existing issues and documentation.  ### Memori Version  valorant  ### OS / Python Version  valorant  ### LLM Provider  OpenAI  ### LLM Model & Version  05345892946  ### Database  Postgres  ### Description  fsfsdfs fsdfsdfb dx   ### Minimal Reproducible Example  ```python sdfsd hfghfgjgh ```  ### Log Output / Stack Trace  ```shell  ```  ### Participation  - [ ] I am willing to submit a pull request for this issue.
  **Post-Mortem & Fix Analysis**:
  > Not enough information to go off of here. Closing this issue. Please update and reopen if applicable. 

- **Issue #304** (2026-02-23): **[Bug] AttributeError: 'Client' object has no attribute 'generate_content' when using langchain-google-genai**
  *Symptoms*: ### First Check  - [x] I added a very descriptive title to this issue. - [x] I searched existing issues and documentation.  ### Memori Version  3.1.6  ### OS / Python Version  3.11  ### LLM Provider  Gemini  ### LLM Model & Version  gemini-flash-1.5  ### Database  Postgres  ### Description  I attempted to register a ChatGoogleGenerativeAI instance (from langchain-google-genai which uses the new google.genai SDK) with Memori using memori.llm.register(chatgooglegenai=llm). The process failed with AttributeError: 'Client' object has no attribute 'generate_content'.   When i tried to debug i found, this occurs because Memori's internal adapter tries to access client.generate_content directly (expecting the older google.generativeai SDK structure), whereas the new google.genai.Client places generation under the .models namespace (i.e., client.models.generate_content).  ### Minimal Reproducible Example  ```python import sqlite3 from memori import Memori from langchain_google_genai import ChatGoogleGenerativeAI   def get_sqlite_connection():     return sqlite3.connect("memori.db")  client = ChatGoogleGenerativeAI(     model='gemini-1.5-flash',     )  mem = Memori(conn=get_sqlite_connection).llm.register(chatgooglegenai=client) ```  ### Log Output / Stack Trace  ```shell Traceback (most recent call last):   File "demo.py", line 17, in <module>     mem = Memori(conn=get_sqlite_connection).llm.register(chatgooglegenai=client)           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

- **Issue #278** (2026-01-29): **[Bug] Duplicate index definition causes MongoDB migration failure**
  *Symptoms*: ### First Check  - [x] I added a very descriptive title to this issue. - [x] I searched existing issues and documentation.  ### Memori Version  3.1.5  ### OS / Python Version  Ubuntu 22.04/ Python 3.11  ### LLM Provider  OpenAI  ### LLM Model & Version  gpt-5  ### Database  MongoDB  ### Description  When running migrations on MongoDB, the schema defines two indexes with the same key pattern on collection memori_entity_fact, which causes an IndexOptionsConflict / duplicate index error during migration. # Index A {     "collection": "memori_entity_fact",     "method": "create_index",     "args": [[("entity_id", 1), ("_id", 1)]],     "kwargs": {"unique": True}, }  # Index B {     "collection": "memori_entity_fact",     "method": "create_index",     "args": [[("entity_id", 1), ("_id", 1)]],     "kwargs": {"name": "idx_memori_entity_fact_embedding_search"}, }  ### Minimal Reproducible Example  ```python import os, sys config_path = os.path.join(os.path.dirname(__file__), "..", "config") sys.path.append(config_path) from config import config  from openai import OpenAI  from pymongo import MongoClient, ReturnDocument from memori import Memori  openai_api_key = "EMPTY" openai_api_base = "" model_name = ""  openai_client = OpenAI(     api_key=openai_api_key,     base_url=openai_api_base, )  def connectMongo():     conn = MongoClient(     host=config.dbhost,     port=int(config.dbport),     username=config.dbusername,     password=config.dbpassword     )      return conn  db_mongo = co
  **Post-Mortem & Fix Analysis**:
  > PR up to fix the MongoDB migration failure: https://github.com/MemoriLabs/Memori/pull/283  Root cause: migrations attempted to create *two* indexes on `memori_entity_fact` with the same key pattern `(entity_id, _id)` but different options/names → Mongo raises `IndexOptionsConflict`.  This PR removes the redundant second index creation so `config.storage.build()` becomes idempotent.  If anyone is blocked right now, a quick workaround is to drop the conflicting index(es) and rerun build:  ```js use db  db.memori_entity_fact.dropIndex("idx_memori_entity_fact_embedding_search") // If present: db.memori_entity_fact.dropIndex("entity_id_1__id_1") ```  Then rerun: ```python memori.config.storage.build() ``` 

- **Issue #276** (2026-02-24): **[Bug] Pydantic AI support not working as documented**
  *Symptoms*: ### First Check  - [x] I added a very descriptive title to this issue. - [x] I searched existing issues and documentation.  ### Memori Version  3.1.5  ### OS / Python Version  Arch linux / Python 3.13  ### LLM Provider  Other  ### LLM Model & Version  Claude sonnet through LiteLLM (OpenAI Compatible client)  ### Database  SQLite  ### Description  The pydantic integration docs specify that you can pass in the Agent object into llm.register.  However this throws an error since the pydantic provider checks `hasattr(client, 'chat')`  ```python class PydanticAi(BaseClient):     def register(self, client):         if not hasattr(client, "chat"):             raise RuntimeError("client provided was not instantiated using PydanticAi")          if not hasattr(client, "_memori_installed"):             client.chat.completions.actual_chat_completions_create = (                 client.chat.completions.create             )              client.chat.completions.create = (                 InvokeAsyncIterator(                     self.config,                     client.chat.completions.actual_chat_completions_create,                 )                 .set_client(                     PYDANTIC_AI_FRAMEWORK_PROVIDER,                     PYDANTIC_AI_OPENAI_LLM_PROVIDER,                     client._version,                 )                 .invoke             )              client._memori_installed = True          return self ```  line 468 in _clients.py.     Changing the llm.register function call
  **Post-Mortem & Fix Analysis**:
  > I opened a PR to fix this + make the docs example work out of the box: https://github.com/MemoriLabs/Memori/pull/282\n\nSummary:\n- Allows passing PydanticAI wrapper objects (e.g. ) by unwrapping common shapes ( / ) to the underlying OpenAI-compatible client.\n- Improves the error message to be actionable if unwrapping fails.\n- Updates the docs snippet to clarify what Memori registers against and shows both options.\n\nThanks again for the clear repro — it directly informed the patch.
  > I opened a PR to fix this + make the docs example work out of the box: https://github.com/MemoriLabs/Memori/pull/282  Summary: - Allows passing PydanticAI wrapper objects (e.g. `Agent`) by unwrapping common shapes (`.client` / `.model.client`) to the underlying OpenAI-compatible client. - Improves the error message to be actionable if unwrapping fails. - Updates the docs snippet to clarify what Memori registers against and shows both options.  Thanks again for the clear repro — it directly informed the patch. 
  > This was closed in the release of 3.2.0. Thank you for your contribution and bringing it to the attention of the MemoriLabs team!

- **Issue #263** (2026-01-27): **[Bug] Function public.update_short_term_search_vector has a role mutable search_path**
  *Symptoms*: ### First Check  - [x] I added a very descriptive title to this issue. - [x] I searched existing issues and documentation.  ### Memori Version  2.3.3  ### OS / Python Version  macOS  ### LLM Provider  OpenAI  ### LLM Model & Version  gpt-4-0  ### Database  Supabase  ### Description  Supabase show warning: Function public.update_short_term_search_vector has a role mutable search_path   ### Minimal Reproducible Example  ```python  ```  ### Log Output / Stack Trace  ```shell  ```  ### Participation  - [ ] I am willing to submit a pull request for this issue.
  **Post-Mortem & Fix Analysis**:
  > Can I work on this issue?
  > @lexuanquynh Thanks for reporting this issue.  This appears to be from version 2.3.3, we're currently on version 3.1.3. Could you please update your package version and see if this is still necessary? 
  > Yes, it seems that this issue was caused by me, so I would like to close this issue. Thank you for your response. By the way, I would like to share the SQL code that fixes the issue above.  ```sql -- ===================================================== -- Enable RLS on Memori Tables -- These tables are created by the Memori library for AI memory -- =====================================================   -- Enable RLS on Memori tables ALTER TABLE IF EXISTS public.chat_history ENABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS public.short_term_memory ENABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS public.long_term_memory ENABLE ROW LEVEL SECURITY;  -- Create RLS policies for chat_history -- Only allow access from service_role (AI app backend) DROP POLICY IF EXISTS "Service role can manage chat_history" ON public.chat_history; CREATE POLICY "Service role can manage chat_history" ON public.chat_history FOR ALL TO service_role USING (true) WITH CHECK (true);  -- Create RLS policies for sho

- **Issue #246** (2026-01-05): **[Bug] google-genai wrapper fails to detect streaming response**
  *Symptoms*: ### First Check  - [x] I added a very descriptive title to this issue. - [x] I searched existing issues and documentation.  ### Memori Version  3.1.2  ### OS / Python Version  linux/3.13  ### LLM Provider  Gemini  ### LLM Model & Version  gemini-3-flash-preview  ### Database  MongoDB  ### Description  Streaming calls do not work; non-streaming calls do work (the content is intercepted by Memori). This is google-genai 1.56.0,  This may be the problem:  - Google's streaming returns a custom AsyncStream/Stream class -  Memori checks isinstance(response, AsyncIterator) which returns False -  The response falls through to non-streaming handling -  Memories aren't captured properly  Perhaps: ``` # Instead of: if isinstance(raw_response, AsyncIterator):     ...   # Should be: if hasattr(raw_response, '__aiter__') and hasattr(raw_response, '__anext__'):     ... ```  If I get time I'll test a fix and open a PR.  ### Minimal Reproducible Example  ```python  ```  ### Log Output / Stack Trace  ```shell  ```  ### Participation  - [ ] I am willing to submit a pull request for this issue.

- **Issue #238** (2026-03-26): **[Bug] Auto Data Capture**
  *Symptoms*: ### First Check  - [x] I added a very descriptive title to this issue. - [x] I searched existing issues and documentation.  ### Memori Version  3.1.1  ### OS / Python Version  Docker (Ubuntu) / Python 3.11  ### LLM Provider  OpenAI  ### LLM Model & Version  gpt-4.1-mini  ### Database  Postgres  ### Description    [Memori] Registered client has chat: True   [Memori] create method name: invoke   [Memori] create method module: memori.llm._invoke   Attribution set   6 OpenAI API calls made   No errors    But the database is STILL empty.    After hours of debugging, I've confirmed auto-capture is properly configured but simply not writing to the database. This appears to be a bug or compatibility issue with Memori SDK 3.1.1.   ### Minimal Reproducible Example  ```python  ```  ### Log Output / Stack Trace  ```shell [Memori] Registered client has chat: True [Memori] create method name: invoke [Memori] create method module: memori.llm._invoke ```  ### Participation  - [x] I am willing to submit a pull request for this issue.
  **Post-Mortem & Fix Analysis**:
  > @Chukwuebuka-2003   Could you please provide more details related to your implementation?   Details that would be helpful:  1. Have you registered and configured a Memori API Key 2. Is this a terminal application or a web application?  3. Are you using augmentation.wait() 4. Have you set entity_id and/or process_id?  5. Are records being written to the memori_conversation_message or memori_entity_fact tables? 
  > @Chukwuebuka-2003 please confirm that this issue still exists. If not, I will close this issue.   Thanks!
  > Closing for inactivity, please reopen if this issue persists.

- **Issue #237** (2025-12-17): **[Bug] Example in README.md doesn't work**
  *Symptoms*: ### First Check  - [x] I added a very descriptive title to this issue. - [x] I searched existing issues and documentation.  ### Memori Version  3.1.1  ### OS / Python Version  macOS / Python 3.12  ### LLM Provider  OpenAI  ### LLM Model & Version  gpt-4.1-mini  ### Database  SQLite  ### Description  I created a new project and followed the example in the README exactly as written, but the example doesn’t work. The tables were created successfully, but entity_fact and knowledge_graph are empty. However, memori_conversation and memori_conversation_message do contain data.  What should I do  ### Minimal Reproducible Example  ```python import os import sqlite3  from dotenv import load_dotenv from memori import Memori from openai import OpenAI   def get_sqlite_connection():     return sqlite3.connect("memori.db")  load_dotenv()  client = OpenAI()  memori = Memori(conn=get_sqlite_connection).llm.register(client) memori.attribution(entity_id="123456", process_id="test-ai-agent") memori.config.storage.build()  response = client.chat.completions.create(     model="gpt-4.1-mini",     messages=[         {"role": "user", "content": "My favorite color is blue."}     ] ) print(response.choices[0].message.content + "\n")  # Advanced Augmentation runs asynchronously to efficiently # create memories. For this example, a short lived command # line program, we need to wait for it to finish.  memori.augmentation.wait()  # Memori stored that your favorite color is blue in SQLite. # Now reset ever
  **Post-Mortem & Fix Analysis**:
  > Hi   Hi @HyoTaek-Jang  Thank you for flagging this issue.  The Memori Labs team would like to discuss it briefly so we can understand how it happened and confirm the right fix. Would you be open to a quick call? If so, please share your time zone and a few times that work, and we’ll send a calendar invite.  
  > Hi @devwdave   Sure, I'd be happy to join a quick call. I’m based in Korea (UTC+9), and I’m available today until 4:00 PM UTC. If you happen to see this soon, please feel free to send a Google Meet or Zoom invite to hyotaek9812@gmail.com Thank you!  --- If that time doesn’t work for you, please let me know your availability
  > @HyoTaek-Jang A meeting invite has been sent. Thank you again! 

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

### Incident Patch 1: `574b1ea3` (2026-09-18)
**Commit Message**: Fix deprecated asyncio.iscoroutinefunction call (#633)

Fixed type-check/merge-gate CI failure that caused two PR CIs to fail

**File**: `memori/llm/_xai_wrappers.py` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@
                       memorilabs.ai
 """
 
-import asyncio
+import inspect
 import json
 import time
 from collections.abc import Mapping
@@ -123,7 +123,7 @@ def wrap_chat_methods(self, chat_obj, client_version, model=None):
             self.config.llm.version = model
 
         chat_obj._sample = chat_obj.sample
-        is_async = asyncio.iscoroutinefunction(chat_obj._sample)
+        is_async = inspect.iscoroutinefunction(chat_obj._sample)
 
         if is_async:
             chat_obj.sample = self._create_async_sample_wrapper(
```

---

### Incident Patch 2: `538b61f2` (2026-07-28)
**Commit Message**: Fixed those badges on readme (#616)

- Fixed badge row to display horizontally and centered
- Closed all sections by default

**File**: `README.md` (modified, +9/-25)
```diff
@@ -15,23 +15,7 @@
   <a href="https://trendshift.io/repositories/15435" target="_blank"><img src="https://trendshift.io/api/badge/repositories/15435" alt="MemoriLabs%2FMemori | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
 </p>
 
-<p align="center">
-  <a href="https://badge.fury.io/py/memori">
-    <img src="https://badge.fury.io/py/memori.svg" alt="PyPI version">
-  </a>
-  <a href="https://www.npmjs.com/package/@memorilabs/memori">
-    <img src="https://img.shields.io/npm/v/@memorilabs/memori.svg" alt="NPM version">
-  </a>
-  <a href="https://pepy.tech/projects/memori">
-    <img src="https://static.pepy.tech/badge/memori" alt="Downloads">
-  </a>
-  <a href="https://opensource.org/license/apache-2-0">
-    <img src="https://img.shields.io/badge/license-Apache%202.0-blue" alt="License">
-  </a>
-  <a href="https://discord.gg/abD4eGym6v">
-    <img src="https://img.shields.io/discord/1042405378304004156?logo=discord" alt="Discord">
-  </a>
-</p>
+<p align="center"><a href="https://badge.fury.io/py/memori"><img src="https://badge.fury.io/py/memori.svg" alt="PyPI version"></a> <a href="https://www.npmjs.com/package/@memorilabs/memori"><img src="https://img.shields.io/npm/v/@memorilabs/memori.svg" alt="NPM version"></a> <a href="https://pepy.tech/projects/memori"><img src="https://static.pepy.tech/badge/memori" alt="Downloads"></a> <a href="https://opensource.org/license/apache-2-0"><img src="https://img.shields.io/badge/license-Apache%202.0-blue" alt="License"></a> <a href="https://discord.gg/abD4eGym6v"><img src="https://img.shields.io/discord/1042405378304004156?logo=discord" alt="Discord"></a></p>
 
 <p align="center">
   <a href="https://github.com/MemoriLabs/Memori/stargazers">
@@ -53,15 +37,15 @@
 
 ### Installation
 
-<details open>
+<details>
 <summary><b>TypeScript SDK</b></summary>
 
 ```bash
 npm install @memorilabs/memori
 ```
 </details>
 
-<details open>
+<details>
 <summary><b>Python SDK</b></summary>
 
 ```bash
@@ -75,7 +59,7 @@ Sign up at [app.memorilabs.ai](https://app.memorilabs.ai), get a Memori API key,
 
 Set `MEMORI_API_KEY` and your LLM API key (e.g. `OPENAI_API_KEY`), then:
 
-<details open>
+<details>
 <summary><b>TypeScript SDK</b></summary>
 
 ```typescript
@@ -104,7 +88,7 @@ async function main() {
 ```
 </details>
 
-<details open>
+<details>
 <summary><b>Python SDK</b></summary>
 
 ```python
@@ -213,15 +197,15 @@ To get the most out of Memori, you want to attribute your LLM interactions to an
 
 If you do not provide any attribution, Memori cannot make memories for you.
 
-<details open>
+<details>
 <summary><b>TypeScript SDK</b></summary>
 
 ```typescript
 mem.attribution("12345", "my-ai-bot");
 ```
 </details>
 
-<details open>
+<details>
 <summary><b>Python SDK</b></summary>
 
 ```python
@@ -235,7 +219,7 @@ Memori uses sessions to group your LLM interactions together. For example, if yo
 
 By default, Memori handles setting the session for you but you can start a new session or override the session by executing the following:
 
-<details open>
+<details>
 <summary><b>TypeScript SDK</b></summary>
 
 ```typescript
@@ -245,7 +229,7 @@ mem.setSession(sessionId);
 ```
 </details>
 
-<details open>
+<details>
 <summary><b>Python SDK</b></summary>
 
 ```python
```

---

### Incident Patch 3: `56600c52` (2026-06-15)
**Commit Message**: fix: validate recall() query parameter (#588)

recall() validates the `limit` argument but not `query`, so a non-string or
empty/whitespace-only query passes straight through to the database/LLM recall
path. Mirror the existing limit validation (and the attribution() guards):
raise TypeError for a non-string query and ValueError for an empty query.

Adds tests in tests/test_init.py and a CHANGELOG entry.

Co-authored-by: Dave Heritage <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +7/-0)
```diff
@@ -7,6 +7,13 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Added
+
+- Added input validation for the `query` argument of `Memori.recall(...)`: a
+  non-string `query` now raises `TypeError` and an empty or whitespace-only
+  `query` raises `ValueError`, matching the existing `limit` validation and
+  failing fast instead of issuing an empty recall against the database/LLM path.
+
 ## [3.3.6] - 2026-05-27
 
 ### Added
```

**File**: `memori/__init__.py` (modified, +4/-0)
```diff
@@ -229,6 +229,10 @@ def recall(
         self, query: str, limit: int | None = None
     ) -> list[RecallFact] | CloudRecallResponse:
         """Return relevant memories for a query."""
+        if not isinstance(query, str):
+            raise TypeError("query must be a string")
+        if not query.strip():
+            raise ValueError("query cannot be empty")
         if limit is not None:
             if not isinstance(limit, int):
                 raise TypeError("limit must be an integer or None")
```

**File**: `tests/test_init.py` (modified, +31/-0)
```diff
@@ -243,6 +243,37 @@ def test_recall_rejects_zero_or_negative_limit(mocker):
     assert str(e.value) == "limit must be greater than 0"
 
 
+def test_recall_rejects_non_string_query(mocker):
+    mock_conn = mocker.Mock(spec=["cursor", "commit", "rollback"])
+    mock_conn.__module__ = "psycopg"
+    type(mock_conn).__module__ = "psycopg"
+    mock_cursor = mocker.MagicMock()
+    mock_conn.cursor = mocker.MagicMock(return_value=mock_cursor)
+
+    with pytest.raises(TypeError) as e:
+        Memori(conn=lambda: mock_conn).recall(123)
+
+    assert str(e.value) == "query must be a string"
+
+
+def test_recall_rejects_empty_query(mocker):
+    mock_conn = mocker.Mock(spec=["cursor", "commit", "rollback"])
+    mock_conn.__module__ = "psycopg"
+    type(mock_conn).__module__ = "psycopg"
+    mock_cursor = mocker.MagicMock()
+    mock_conn.cursor = mocker.MagicMock(return_value=mock_cursor)
+
+    with pytest.raises(ValueError) as e:
+        Memori(conn=lambda: mock_conn).recall("")
+
+    assert str(e.value) == "query cannot be empty"
+
+    with pytest.raises(ValueError) as e:
+        Memori(conn=lambda: mock_conn).recall("   ")
+
+    assert str(e.value) == "query cannot be empty"
+
+
 def test_embed_texts_uses_config_defaults(mocker):
     mock_conn = mocker.Mock(spec=["cursor", "commit", "rollback"])
     mock_conn.__module__ = "psycopg"
```

---

### Incident Patch 4: `78b5dc78` (2026-06-15)
**Commit Message**: fix: upgrade vite 6→8 and vitest 3→4 to resolve esbuild CVE (#596)

**File**: `memori-ts/README.md` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ Install the Memori SDK and your preferred LLM client using your package manager
 npm install @memorilabs/memori
 ```
 
-_(Memori supports `openai`, `@anthropic-ai/sdk`, and `@google/genai` as peer dependencies. Requires Node.js 20.12.0 or higher.)_
+_(Memori supports `openai`, `@anthropic-ai/sdk`, and `@google/genai` as peer dependencies. Requires Node.js 20.19.0 or higher.)_
 
 ## Quickstart
 
```

**File**: `memori-ts/package.json` (modified, +5/-5)
```diff
@@ -109,8 +109,8 @@
     "@types/better-sqlite3": "*",
     "@types/node": "^20.0.0",
     "@types/pg": "*",
-    "@vitest/coverage-v8": "^3.2.6",
-    "@vitest/ui": "^3.2.6",
+    "@vitest/coverage-v8": "^4.0.0",
+    "@vitest/ui": "^4.0.0",
     "better-sqlite3": "*",
     "dotenv": "^16.4.5",
     "eslint": "^9.0.0",
@@ -123,11 +123,11 @@
     "prettier": "^3.0.0",
     "typescript": "^5.0.0",
     "typescript-eslint": "^8.0.0",
-    "vite": "^6.4.3",
-    "vitest": "^3.2.6"
+    "vite": "^8.0.0",
+    "vitest": "^4.0.0"
   },
   "engines": {
-    "node": ">=20.12.0"
+    "node": ">=20.19.0"
   },
   "dependencies": {
     "@memorilabs/axon": "^0.1.5"
```

**File**: `memori-ts/tests/memori.test.ts` (modified, +9/-7)
```diff
@@ -8,13 +8,15 @@ import { Api } from '../src/core/network.js';
 
 // Mock the storage manager so we don't need real DB adapters in unit tests
 vi.mock('../src/storage/manager.js', () => ({
-  StorageManager: vi.fn().mockImplementation(() => ({
-    getDialect: vi.fn().mockReturnValue('sqlite'),
-    setEngineShutdown: vi.fn(),
-    setEngineBuild: vi.fn(),
-    handleStorageCall: vi.fn(),
-    close: vi.fn(),
-  })),
+  StorageManager: vi.fn().mockImplementation(function () {
+    return {
+      getDialect: vi.fn().mockReturnValue('sqlite'),
+      setEngineShutdown: vi.fn(),
+      setEngineBuild: vi.fn(),
+      handleStorageCall: vi.fn(),
+      close: vi.fn(),
+    };
+  }),
 }));
 
 describe('Memori SDK', () => {
```

**File**: `memori-ts/tests/setup.ts` (modified, +14/-12)
```diff
@@ -7,18 +7,20 @@ import { fileURLToPath } from 'node:url';
 // This gives us a single shared MemoriEngine vi.fn() instance that both the ESM import
 // (test file) and the createRequire path (engine.ts lazy load) refer to.
 const { mockNativeModule } = vi.hoisted(() => {
-  const stub = () => ({
-    build: vi.fn().mockResolvedValue(undefined),
-    writeBatch: vi.fn().mockResolvedValue({ writtenOps: 0 }),
-    getConversationHistory: vi.fn().mockResolvedValue('[]'),
-    retrieve: vi.fn().mockResolvedValue([]),
-    recall: vi.fn().mockResolvedValue(''),
-    embedTexts: vi.fn().mockReturnValue([]),
-    submitAugmentation: vi.fn().mockReturnValue('00000000-0000-0000-0000-000000000000'),
-    waitForAugmentation: vi.fn().mockResolvedValue(true),
-    shutdown: vi.fn(),
-    resolveStorageCall: vi.fn(),
-  });
+  const stub = function () {
+    return {
+      build: vi.fn().mockResolvedValue(undefined),
+      writeBatch: vi.fn().mockResolvedValue({ writtenOps: 0 }),
+      getConversationHistory: vi.fn().mockResolvedValue('[]'),
+      retrieve: vi.fn().mockResolvedValue([]),
+      recall: vi.fn().mockResolvedValue(''),
+      embedTexts: vi.fn().mockReturnValue([]),
+      submitAugmentation: vi.fn().mockReturnValue('00000000-0000-0000-0000-000000000000'),
+      waitForAugmentation: vi.fn().mockResolvedValue(true),
+      shutdown: vi.fn(),
+      resolveStorageCall: vi.fn(),
+    };
+  };
 
   return { mockNativeModule: { MemoriEngine: vi.fn().mockImplementation(stub) } };
 });
```

---

### Incident Patch 5: `bc92e9d2` (2026-06-12)
**Commit Message**: Update docs: roadmap copy, use cases, and enterprise agent trace example (#593)

- Revise roadmap bullet in memori-byodb index to focus on augmentation pipeline improvements
- Tighten python-quickstart intro copy
- Add Enterprise IT Operations incident response use case to both byodb and cloud use-cases pages, demonstrating agent trace memory with tool calls
- Switch all byodb use-case examples from SQLite to CockroachDB
- Fix cloud use-case example: correct model to gpt-4o-mini, remove augmentation.wait()

**File**: `docs/memori-byodb/getting-started/python-quickstart.mdx` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ description: Get started with Memori BYODB in under 3 minutes using SQLite and O
 
 # Python SDK Quickstart
 
-Get started with Memori in under 3 minutes. Since Memori BYODB is open source, you bring your own database — and for this quick start, we will use SQLite so there is nothing extra to install.
+Get started with Memori in minutes. Since Memori BYODB is open source, you bring your own database and for this quick start, we will use SQLite so there is nothing extra to install.
 
 <Note>
   Want a zero-setup option? Try Memori Cloud at
```

**File**: `docs/memori-byodb/getting-started/use-cases.mdx` (modified, +117/-3)
```diff
@@ -30,7 +30,7 @@ from sqlalchemy.orm import sessionmaker
 from memori import Memori
 from openai import OpenAI
 
-engine = create_engine("sqlite:///memori.db")
+engine = create_engine("cockroachdb+psycopg2://user:password@localhost:26257/memori_db")
 SessionLocal = sessionmaker(bind=engine)
 
 client = OpenAI()
@@ -71,7 +71,7 @@ from sqlalchemy.orm import sessionmaker
 from memori import Memori
 from anthropic import Anthropic
 
-engine = create_engine("sqlite:///memori.db")
+engine = create_engine("cockroachdb+psycopg2://user:password@localhost:26257/memori_db")
 SessionLocal = sessionmaker(bind=engine)
 
 client = Anthropic()
@@ -113,7 +113,7 @@ from sqlalchemy.orm import sessionmaker
 from memori import Memori
 from openai import OpenAI
 
-engine = create_engine("sqlite:///memori.db")
+engine = create_engine("cockroachdb+psycopg2://user:password@localhost:26257/memori_db")
 SessionLocal = sessionmaker(bind=engine)
 
 client = OpenAI()
@@ -140,3 +140,117 @@ mem.attribution(
 # Memori shares context across agents
 # for the same entity
 ```
+
+## Enterprise IT Operations — Incident Response
+
+Large enterprises run hundreds of services across complex infrastructure. When incidents strike, response time is critical. Memori captures every tool call, diagnostic decision, and resolution outcome as structured trace memory — so agents accumulate institutional knowledge across incidents and come back faster each time.
+
+**Benefits:**
+
+- Recall past incidents with similar error patterns and known resolutions
+- Build a persistent knowledge base of system behavior across thousands of incidents
+- Reduce mean time to resolution by surfacing what worked before
+- Audit the full decision trail: which tools ran, what they returned, and what action was taken
+- Route incident context across specialized agents — triage, escalation, and remediation
+
+```python
+import os
+from sqlalchemy import create_engine
+from sqlalchemy.orm import sessionmaker
+from memori import Memori
+from openai import OpenAI
+
+engine = create_engine("cockroachdb+psycopg2://user:password@localhost:26257/memori_db")
+SessionLocal = sessionmaker(bind=engine)
+
+client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
+mem = Memori(conn=SessionLocal).llm.register(client)
+
+# Each service gets its own memory space; the agent is the process
+mem.attribution(
+    entity_id="payment-service-prod",
+    process_id="incident_response_agent"
+)
+
+tools = [
+    {
+        "type": "function",
+        "function": {
+            "name": "query_logs",
+            "description": "Query application logs for a time range and filter",
+            "parameters": {
+                "type": "object",
+                "properties": {
+                    "service": {"type": "string"},
+                    "time_range": {"type": "string"},
+                    "filter": {"type": "string"}
+                },
+                "required": ["service", "time_range"]
+            }
+        }
+    },
+    {
+        "type": "function",
+        "function": {
+            "name": "get_metrics",
+            "description": "Retrieve service metrics from the monitoring system",
+            "parameters": {
+                "type": "object",
+                "properties": {
+                    "service": {"type": "string"},
+                    "metric": {"type": "string"}
+                },
+                "required": ["service", "metric"]
+            }
+        }
+    },
+    {
+        "type": "function",
+        "function": {
+            "name": "restart_pod",
+            "description": "Restart a service pod in the specified region",
+            "parameters": {
+                "type": "object",
+                "properties": {
+                    "service": {"type": "string"},
+                    "region": {"type": "string"}
+                },
+                "required": ["service", "region"]
+            }
+        }
+    }
+]
+
+# Memori intercepts this call — tool calls, results, and decisions
+# are captured as trace events and converted into structured memory
+response = client.chat.completions.create(
+    model="gpt-4.1-mini",
+    messages=[
+        {
+            "role": "system",
+            "content": "You are an enterprise IT operations agent. Diagnose and resolve infrastructure incidents."
+        },
+        {
+            "role": "user",
+            "content": (
+                "P1 Alert: payment-service-prod returning 503 errors. "
+                "Error rate 42%, p99 latency 8.2s. Started 14 minutes ago. "
+                "Diagnose and resolve."
+            )
+        }
+    ],
+    tools=tools
+)
+
+# After resolution, Memori has stored:
+# - The alert conditions that triggered the incident
+# - Every tool call made and what it returned
+# - The diagnostic path and decisions taken
+# - The resolution action and outcome
+#
+# Next incident: the agent automatically recalls
+# "Last time payment-service-prod had 503s with elevated
```

**File**: `docs/memori-byodb/index.mdx` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ Get started with a database connection and your favorite LLM:
 - **Semantic recall** — Queries like “what does this user prefer?” pull the right memories automatically.
 - **Dashboard** — Use [app.memorilabs.ai](https://app.memorilabs.ai) for API keys, usage, and (with Memori Cloud) the Graph Explorer and Playground.
 - **Your data, your rules** — Store everything in your DB; compliance, backups, and custom analytics stay under your control.
-- **Roadmap** — Knowledge-graph APIs, configurable decay, and richer dashboarding are on the way.
+- **Roadmap** — Augmentation pipeline improvements for more consistent entity, project, and memory creation. Better visibility into what agents remember.
 
 ```python
 import os
```

**File**: `docs/memori-cloud/getting-started/use-cases.mdx` (modified, +202/-4)
```diff
@@ -200,7 +200,205 @@ mem.attribution('project_alpha', 'analysis_agent');
 
 </CodeGroup>
 
-<Note>
-  For runnable versions of these examples and more, see the [examples
-  folder](https://github.com/MemoriLabs/Memori/tree/main/examples) on GitHub.
-</Note>
+## Enterprise IT Operations — Incident Response
+
+Large enterprises run hundreds of services across complex infrastructure. When incidents strike, response time is critical. Memori captures every tool call, diagnostic decision, and resolution outcome as structured trace memory — so agents accumulate institutional knowledge across incidents and come back faster each time.
+
+**Benefits:**
+
+- Recall past incidents with similar error patterns and known resolutions
+- Build a persistent knowledge base of system behavior across thousands of incidents
+- Reduce mean time to resolution by surfacing what worked before
+- Audit the full decision trail: which tools ran, what they returned, and what action was taken
+- Route incident context across specialized agents — triage, escalation, and remediation
+
+<CodeGroup title="Enterprise IT Operations">
+
+```python {{ title: 'Python' }}
+import os
+from memori import Memori
+from openai import OpenAI
+
+client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
+mem = Memori().llm.register(client)
+
+# Each service gets its own memory space; the agent is the process
+mem.attribution(
+    entity_id="payment-service-prod",
+    process_id="incident_response_agent"
+)
+
+tools = [
+    {
+        "type": "function",
+        "function": {
+            "name": "query_logs",
+            "description": "Query application logs for a time range and filter",
+            "parameters": {
+                "type": "object",
+                "properties": {
+                    "service": {"type": "string"},
+                    "time_range": {"type": "string"},
+                    "filter": {"type": "string"}
+                },
+                "required": ["service", "time_range"]
+            }
+        }
+    },
+    {
+        "type": "function",
+        "function": {
+            "name": "get_metrics",
+            "description": "Retrieve service metrics from the monitoring system",
+            "parameters": {
+                "type": "object",
+                "properties": {
+                    "service": {"type": "string"},
+                    "metric": {"type": "string"}
+                },
+                "required": ["service", "metric"]
+            }
+        }
+    },
+    {
+        "type": "function",
+        "function": {
+            "name": "restart_pod",
+            "description": "Restart a service pod in the specified region",
+            "parameters": {
+                "type": "object",
+                "properties": {
+                    "service": {"type": "string"},
+                    "region": {"type": "string"}
+                },
+                "required": ["service", "region"]
+            }
+        }
+    }
+]
+
+# Memori intercepts this call — tool calls, results, and decisions
+# are captured as trace events and converted into structured memory
+response = client.chat.completions.create(
+    model="gpt-4o-mini",
+    messages=[
+        {
+            "role": "system",
+            "content": "You are an enterprise IT operations agent. Diagnose and resolve infrastructure incidents."
+        },
+        {
+            "role": "user",
+            "content": (
+                "P1 Alert: payment-service-prod returning 503 errors. "
+                "Error rate 42%, p99 latency 8.2s. Started 14 minutes ago. "
+                "Diagnose and resolve."
+            )
+        }
+    ],
+    tools=tools
+)
+
+# After resolution, Memori has stored:
+# - The alert conditions that triggered the incident
+# - Every tool call made and what it returned
+# - The diagnostic path and decisions taken
+# - The resolution action and outcome
+#
+# Next incident: the agent automatically recalls
+# "Last time payment-service-prod had 503s with elevated p99 latency,
+#  logs showed DB connection pool exhaustion — resolved by restarting
+#  the us-east-1 pod. Resolution time: 6 minutes."
+```
+
+```typescript {{ title: 'TypeScript' }}
+import OpenAI from 'openai';
+import { Memori } from '@memorilabs/memori';
+
+const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
+const mem = new Memori().llm.register(client);
+
+// Each service gets its own memory space; the agent is the process
+mem.attribution('payment-service-prod', 'incident_response_agent');
+
+const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
+  {
+    type: 'function',
+    function: {
+      name: 'query_logs',
+      description: 'Query application logs for a time range and filter',
+      parameters: {
+        type: 'object',
+        properties: {
+          service: { type: 'string' },
+          time_range: { type: 'string' },
+          filter: { type: 'string' },
+        },
+        required: ['service',
```

---

### Incident Patch 6: `08d72402` (2026-06-10)
**Commit Message**: Enhance API post method to support custom timeout (#591)

* Enhance API post method to support custom timeout

- Updated the `post` method in the `Api` class to accept an optional `timeout` parameter, defaulting to the configured request timeout if not provided.
- Adjusted the `ClusterManager` to utilize the new timeout feature when finalizing cluster operations.
- Added tests to verify that the configured timeout is used by default and that custom timeouts are correctly applied when specified.

* Update post method in Api class to use optional timeout type

- Modified the `post` method to accept a `timeout` parameter with a type hint of `int | None`, enhancing type safety and clarity in the API.
- This change aligns with recent updates to improve the handling of optional parameters in the codebase.

**File**: `memori/_network.py` (modified, +7/-2)
```diff
@@ -205,13 +205,18 @@ def patch(self, route, json=None):
     async def patch_async(self, route, json=None):
         return await self.__request_async("PATCH", route, json=json)
 
-    def post(self, route, json=None, status_code: bool = False):
+    def post(
+        self, route, json=None, status_code: bool = False, timeout: int | None = None
+    ):
+        if timeout is None:
+            timeout = self.config.request_secs_timeout
+
         logger.debug("POST request to %s", route)
         r = self.__session().post(
             self.url(route),
             headers=self.headers(),
             json=json,
-            timeout=self.config.request_secs_timeout,
+            timeout=timeout,
         )
         logger.debug("POST response - status: %d", r.status_code)
 
```

**File**: `memori/storage/cockroachdb/_cluster_manager.py` (modified, +1/-0)
```diff
@@ -120,6 +120,7 @@ def start(self, cli: Cli):
             finalized = Api(Config()).post(
                 f"cockroachdb/cluster/finalize/{started['cluster']['uuid']}",
                 json={"cluster": {"id": started["cluster"]["id"]}},
+                timeout=60,
             )
             if finalized["status"] == 1:
                 break
```

**File**: `tests/storage/cockroachdb/test_storage_cockroachdb_cluster_manager.py` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+import sys
+from unittest.mock import MagicMock, patch
+
+from memori._config import Config
+from memori.storage.cockroachdb._cluster_manager import ClusterManager
+
+
+def test_start_finalize_post_uses_extended_timeout():
+    config = Config()
+    cli = MagicMock()
+    manager = ClusterManager(config)
+
+    cluster_uuid = "test-cluster-uuid"
+    started = {"cluster": {"uuid": cluster_uuid, "id": 123}}
+    finalized = {
+        "status": 1,
+        "connection": {"string": "postgresql://user:pass@host/db"},
+        "claim": {"url": "https://claim.example.com"},
+    }
+
+    mock_api = MagicMock()
+    mock_api.post.side_effect = [started, finalized]
+    mock_psycopg = MagicMock()
+
+    with (
+        patch.object(manager, "cluster_is_started", return_value=False),
+        patch("builtins.input", return_value="Y"),
+        patch(
+            "memori.storage.cockroachdb._cluster_manager.Api",
+            return_value=mock_api,
+        ),
+        patch("memori.storage.cockroachdb._cluster_manager.time.sleep"),
+        patch("memori.storage.cockroachdb._cluster_manager.Manager") as mock_manager,
+        patch("memori.storage.cockroachdb._cluster_manager.Builder") as mock_builder,
+        patch.dict(sys.modules, {"psycopg": mock_psycopg}),
+        patch.object(manager.files, "write_id"),
+    ):
+        mock_manager.return_value.start.return_value = MagicMock()
+        manager.start(cli)
+
+    assert mock_api.post.call_count == 2
+
+    start_call = mock_api.post.call_args_list[0]
+    assert start_call.args == ("cockroachdb/cluster/start",)
+    assert "timeout" not in start_call.kwargs
+
+    finalize_call = mock_api.post.call_args_list[1]
+    assert finalize_call.args == (f"cockroachdb/cluster/finalize/{cluster_uuid}",)
+    assert finalize_call.kwargs["json"] == {"cluster": {"id": 123}}
+    assert finalize_call.kwargs["timeout"] == 60
+
+    mock_builder.return_value.disable_banner.return_value.execute.assert_called_once()
```

**File**: `tests/test_network.py` (modified, +33/-0)
```diff
@@ -160,6 +160,39 @@ def test_post_raises_http_error(self, api, mocker):
         with pytest.raises(requests.HTTPError):
             api.post("test/endpoint")
 
+    def test_post_uses_configured_timeout_by_default(self, api, mocker):
+        custom_timeout = 42
+        api.config.request_secs_timeout = custom_timeout
+
+        mock_response = MagicMock()
+        mock_response.json.return_value = {"result": "success"}
+        mock_response.raise_for_status = MagicMock()
+
+        mock_session = MagicMock()
+        mock_session.post.return_value = mock_response
+        mocker.patch.object(api, "_Api__session", return_value=mock_session)
+
+        api.post("test/endpoint")
+
+        _, kwargs = mock_session.post.call_args
+        assert kwargs["timeout"] == custom_timeout
+
+    def test_post_uses_custom_timeout_when_provided(self, api, mocker):
+        api.config.request_secs_timeout = 5
+
+        mock_response = MagicMock()
+        mock_response.json.return_value = {"result": "success"}
+        mock_response.raise_for_status = MagicMock()
+
+        mock_session = MagicMock()
+        mock_session.post.return_value = mock_response
+        mocker.patch.object(api, "_Api__session", return_value=mock_session)
+
+        api.post("test/endpoint", timeout=60)
+
+        _, kwargs = mock_session.post.call_args
+        assert kwargs["timeout"] == 60
+
 
 class TestApiPostAsync:
     @pytest.mark.asyncio
```

---

### Incident Patch 7: `59ebff5b` (2026-06-07)
**Commit Message**: fix: add validation for recall() limit parameter (#579)

The recall() method accepted invalid limit values (zero, negative, non-integer)
which could cause errors downstream in the Rust core or database layer.

Where: memori/__init__.py - recall() method
What: Added validation to reject invalid limits with clear error types
How to verify: Run test_recall_rejects_non_integer_limit and test_recall_rejects_zero_or_negative_limit

Path to merge: PR from fix/recall-limit-parameter-validation to main
Blocker: Prevents undefined behavior from invalid recall limits
Expected action: Review and merge to improve input validation robustness

Co-authored-by: Dave Heritage <[REDACTED_EMAIL]>

**File**: `memori/__init__.py` (modified, +6/-0)
```diff
@@ -229,6 +229,12 @@ def recall(
         self, query: str, limit: int | None = None
     ) -> list[RecallFact] | CloudRecallResponse:
         """Return relevant memories for a query."""
+        if limit is not None:
+            if not isinstance(limit, int):
+                raise TypeError("limit must be an integer or None")
+            if limit <= 0:
+                raise ValueError("limit must be greater than 0")
+
         if self.config.cloud is False and self.config.rust_core is not None:
             resolved_limit = self.config.recall_facts_limit if limit is None else limit
             if not self.config.entity_id:
```

**File**: `tests/test_init.py` (modified, +31/-0)
```diff
@@ -212,6 +212,37 @@ def test_set_session_resets_cache(mocker):
     assert mem.config.cache.session_id is None
 
 
+def test_recall_rejects_non_integer_limit(mocker):
+    mock_conn = mocker.Mock(spec=["cursor", "commit", "rollback"])
+    mock_conn.__module__ = "psycopg"
+    type(mock_conn).__module__ = "psycopg"
+    mock_cursor = mocker.MagicMock()
+    mock_conn.cursor = mocker.MagicMock(return_value=mock_cursor)
+
+    with pytest.raises(TypeError) as e:
+        Memori(conn=lambda: mock_conn).recall("test", limit="5")
+
+    assert str(e.value) == "limit must be an integer or None"
+
+
+def test_recall_rejects_zero_or_negative_limit(mocker):
+    mock_conn = mocker.Mock(spec=["cursor", "commit", "rollback"])
+    mock_conn.__module__ = "psycopg"
+    type(mock_conn).__module__ = "psycopg"
+    mock_cursor = mocker.MagicMock()
+    mock_conn.cursor = mocker.MagicMock(return_value=mock_cursor)
+
+    with pytest.raises(ValueError) as e:
+        Memori(conn=lambda: mock_conn).recall("test", limit=0)
+
+    assert str(e.value) == "limit must be greater than 0"
+
+    with pytest.raises(ValueError) as e:
+        Memori(conn=lambda: mock_conn).recall("test", limit=-5)
+
+    assert str(e.value) == "limit must be greater than 0"
+
+
 def test_embed_texts_uses_config_defaults(mocker):
     mock_conn = mocker.Mock(spec=["cursor", "commit", "rollback"])
     mock_conn.__module__ = "psycopg"
```

---

### Incident Patch 8: `0d40a64e` (2026-06-07)
**Commit Message**: fix: reject empty strings in attribution() method (#578)

* fix: reject empty strings in attribution() method

The attribution() method accepted empty entity_id and process_id strings,
which could cause data integrity issues. Empty strings silently bypass
validation and get stored in the database.

Where: memori/__init__.py - attribution() method
What: Added validation to reject empty strings with ValueError
How to verify: Run tests test_attribution_rejects_empty_entity_id and
test_attribution_rejects_empty_process_id

Path to merge: PR from fix/empty-string-validation-attribution to main
Blocker: Prevents silent data corruption from empty attribution identifiers
Expected action: Review and merge to improve data integrity validation

* fix: apply ruff formatting to test_init.py

---------

**File**: `memori/__init__.py` (modified, +6/-0)
```diff
@@ -194,12 +194,18 @@ def attribution(
         if not isinstance(entity_id, str):
             raise TypeError("entity_id must be a string")
 
+        if not entity_id:
+            raise ValueError("entity_id cannot be empty")
+
         if len(entity_id) > 100:
             raise RuntimeError("entity_id cannot be greater than 100 characters")
 
         if process_id is not None and not isinstance(process_id, str):
             raise TypeError("process_id must be a string or None")
 
+        if process_id is not None and not process_id:
+            raise ValueError("process_id cannot be empty")
+
         if process_id is not None and len(process_id) > 100:
             raise RuntimeError("process_id cannot be greater than 100 characters")
 
```

**File**: `tests/test_init.py` (modified, +26/-0)
```diff
@@ -138,6 +138,32 @@ def test_attribution_requires_string_or_none_process_id(mocker):
     assert mem.config.process_id is None
 
 
+def test_attribution_rejects_empty_entity_id(mocker):
+    mock_conn = mocker.Mock(spec=["cursor", "commit", "rollback"])
+    mock_conn.__module__ = "psycopg"
+    type(mock_conn).__module__ = "psycopg"
+    mock_cursor = mocker.MagicMock()
+    mock_conn.cursor = mocker.MagicMock(return_value=mock_cursor)
+
+    with pytest.raises(ValueError) as e:
+        Memori(conn=lambda: mock_conn).attribution(entity_id="")
+
+    assert str(e.value) == "entity_id cannot be empty"
+
+
+def test_attribution_rejects_empty_process_id(mocker):
+    mock_conn = mocker.Mock(spec=["cursor", "commit", "rollback"])
+    mock_conn.__module__ = "psycopg"
+    type(mock_conn).__module__ = "psycopg"
+    mock_cursor = mocker.MagicMock()
+    mock_conn.cursor = mocker.MagicMock(return_value=mock_cursor)
+
+    with pytest.raises(ValueError) as e:
+        Memori(conn=lambda: mock_conn).attribution(entity_id="user-1", process_id="")
+
+    assert str(e.value) == "process_id cannot be empty"
+
+
 def test_new_session(mocker):
     mock_conn = mocker.Mock(spec=["cursor", "commit", "rollback"])
     mock_conn.__module__ = "psycopg"
```

---

### Incident Patch 9: `a08af1ae` (2026-06-01)
**Commit Message**: Fix grammar issues in README.md (#571)

Corrected minor grammatical errors in README.

**File**: `README.md` (modified, +2/-2)
```diff
@@ -302,7 +302,7 @@ Memories are tracked at several different levels:
 
 Memori knows who your user is, what tasks your agent handles and creates unparalleled context between the two. Augmentation occurs in the background incurring no latency.
 
-By default, Memori Advanced Augmentation is available without an account but rate limited. When you need increased limits, [sign up for Memori Advanced Augmentation](https://app.memorilabs.ai/signup) or use the Memori CLI:
+By default, Memori Advanced Augmentation is available without an account but rate-limited. When you need increased limits, [sign up for Memori Advanced Augmentation](https://app.memorilabs.ai/signup) or use the Memori CLI:
 
 ```bash
 # Install the CLI via pip to manage your account
@@ -329,7 +329,7 @@ python -m memori quota
 
 Or by checking your account at [https://app.memorilabs.ai/](https://app.memorilabs.ai/). If you have reached your IP address quota, sign up and get an API key for increased limits.
 
-If your API key exceeds its quota limits we will email you and let you know.
+If your API key exceeds its quota limits, we will email you and let you know.
 
 ## Command Line Interface (CLI)
 
```

---

### Incident Patch 10: `384cb992` (2026-05-29)
**Commit Message**: Claude Code, Hermes, OpenClaw Quickstart: added two points for Memori to be the core memory function (#570)

**File**: `docs/memori-byodb/concepts/advanced-augmentation.mdx` (modified, +2/-2)
```diff
@@ -1,11 +1,11 @@
 ---
 title: Advanced Augmentation
-description: How Memori's Advanced Augmentation engine extracts structured facts, preferences, and knowledge from your AI conversations — all stored in your own database.
+description: How Memori's Advanced Augmentation engine extracts structured facts, preferences, and knowledge from your AI conversations and agent trace — all stored in your own database.
 ---
 
 # Advanced Augmentation
 
-Advanced Augmentation is the AI engine inside Memori that turns raw conversations into structured, searchable memories. It runs asynchronously in the background to minimize impact on your response path. All extracted data is stored directly in your database.
+Advanced Augmentation is the AI engine inside Memori that turns raw conversations and agent trace into structured, searchable memories. It runs asynchronously in the background to minimize impact on your response path. All extracted data is stored directly in your database.
 
 ## What It Does
 
```

**File**: `docs/memori-byodb/concepts/architecture.mdx` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ Memori is a modular memory layer for AI applications. You connect your LLM clien
 
 **Storage System** — Stores all data in your database with no external dependencies. Supports SQLAlchemy `sessionmaker`, DB-API 2.0 connections, Django ORM, and MongoDB. Works with SQLite, PostgreSQL, MySQL, MariaDB, TiDB, Oracle, CockroachDB, and OceanBase, including providers like Neon, Supabase, and AWS RDS/Aurora.
 
-**Advanced Augmentation** — Turns raw conversations into structured memories. Extracts facts, preferences, and skills, generates vector embeddings locally, and builds a knowledge graph. Runs asynchronously with zero latency impact.
+**Advanced Augmentation** — Turns raw conversations and agent trace into structured memories. Extracts facts, preferences, and skills, generates vector embeddings locally, and builds a knowledge graph. Runs asynchronously with zero latency impact.
 
 ## Configuration
 
```

**File**: `docs/memori-byodb/concepts/how-memory-works.mdx` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ When you have a conversation through a Memori-wrapped LLM client, Advanced Augme
 | **Skills**      | Abilities and expertise    | "Experienced with React (5 years)"              |
 | **Rules**       | Constraints and principles | "Follows test-driven development"               |
 | **Events**      | Milestones and occurrences | "Product launched recently"                     |
-| **Agent trace & execution** | Tool calls, decisions, workflow steps, and outcomes | "Used search tool → found result → summarized" |
+| **Agent Trace & Execution** | Tool calls, decisions, workflow steps, and outcomes | "Used search tool → found result → summarized" |
 
 ## How Recall Works
 
```

**File**: `docs/memori-byodb/concepts/knowledge-graph.mdx` (modified, +5/-5)
```diff
@@ -1,16 +1,16 @@
 ---
 title: Knowledge Graph
-description: How Memori automatically builds a knowledge graph from your AI conversations using semantic triples, stored in your own database where you can query it directly.
+description: How Memori automatically builds a knowledge graph from your AI conversations and agent trace using semantic triples, stored in your own database where you can query it directly.
 ---
 
 # Knowledge Graph
 
-Memori automatically builds a knowledge graph from your AI conversations. Every time Advanced Augmentation processes a conversation, it extracts structured relationships — semantic triples — and connects them into a graph. Because you own the database, you can query the knowledge graph directly using SQL.
+Memori automatically builds a knowledge graph from your AI conversations and agent trace. Every time Advanced Augmentation processes a conversation or agent trace, it extracts structured relationships — semantic triples — and connects them into a graph. Because you own the database, you can query the knowledge graph directly using SQL.
 
 ## How It Works
 
-1. **Conversation captured** — Your user talks to your AI through the Memori-wrapped LLM client
-2. **Augmentation processes** — Memori analyzes the conversation in the background
+1. **Conversation and agent trace captured** — Your user talks to your AI through the Memori-wrapped LLM client; tool calls, decisions, and outcomes are captured alongside
+2. **Augmentation processes** — Memori analyzes the conversation and agent trace in the background
 3. **NER extraction** — Named-entity recognition identifies key entities and relationships
 4. **Triple creation** — Relationships are expressed as subject-predicate-object triples
 5. **Graph storage** — Triples are stored and deduplicated in your database
@@ -119,6 +119,6 @@ ORDER BY date_created DESC;
 | -------------- | --------------------------------------------------------------- |
 | **Triples**    | Per entity — shared across all processes                        |
 | **Visibility** | All processes for an entity can see and use the graph           |
-| **Growth**     | Conversations from any process contribute to the entity's graph |
+| **Growth**     | Conversations and agent trace from any process contribute to the entity's graph |
 
 If Alice tells your support bot about PostgreSQL, your code assistant also knows she uses PostgreSQL.
```

**File**: `docs/memori-byodb/getting-started/use-cases.mdx` (modified, +2/-2)
```diff
@@ -5,7 +5,7 @@ description: Common use cases and applications for Memori open source.
 
 # Use Cases
 
-Memori is designed for any application where AI agents need to remember context across conversations. Here are the most common use cases — all running with your own database.
+Memori is designed for any application where AI agents need to remember context across conversations and agent executions. Here are the most common use cases — all running with your own database.
 
 <Note>
   Want a zero-setup option? Try Memori Cloud at
@@ -104,7 +104,7 @@ Coordinate multiple AI agents that share context through Memori. Each agent cont
 
 - Share context between specialized agents
 - Track which agent contributed what information
-- Maintain conversation continuity across handoffs
+- Maintain conversation and execution continuity across handoffs
 - Build collective knowledge graphs
 
 ```python
```

**File**: `docs/memori-byodb/support/faq.mdx` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ Yes, all providers support async mode out of the box. We recommend using your pr
 
 ### How does augmentation work?
 
-It runs in the background after each conversation and extracts facts, preferences, and relationships while minimizing impact on your LLM response path. See [Advanced Augmentation](/docs/memori-byodb/concepts/advanced-augmentation).
+It runs in the background after each conversation or agent trace and extracts facts, preferences, and relationships while minimizing impact on your LLM response path. See [Advanced Augmentation](/docs/memori-byodb/concepts/advanced-augmentation).
 
 ### Can I use multiple LLM providers?
 
```

**File**: `docs/memori-cloud/claude-code/quickstart.mdx` (modified, +4/-1)
```diff
@@ -28,6 +28,9 @@ Copy both `SKILL.md` and `index.ts` from `integrations/claude-code` into your ta
 
 ## 2. Configure
 
+- Implement Memori as your core memory function.
+- Utilize tools across all instances and sub agents.
+
 The recommended setup is `.claude/settings.local.json` — Claude Code injects every entry under `env` into the environment of every Bash subprocess, including this skill, and Claude Code auto-gitignores the file when it creates it.
 
 Paste the following into `.claude/settings.local.json`:
@@ -45,7 +48,7 @@ That's the full required setup. `MEMORI_PROJECT_ID` auto-resolves from the curre
 
 <Properties>
   <Property name="MEMORI_API_KEY" type="string" required>
-    Authenticates to Memori Cloud. Available from [app.memorilabs.ai](https://app.memorilabs.ai).
+    Your Memori API key — acquire with `memori signup`.
   </Property>
   <Property name="MEMORI_ENTITY_ID" type="string" required>
     Stable per-user or per-agent memory namespace. Any string. If missing on first invocation, `SKILL.md` instructs Claude Code to pick a sensible default (slugified `git config user.email`, hostname, or a generated UUID) and persist it to `.claude/settings.local.json`. The agent only asks the user when nothing can be inferred.
```

**File**: `docs/memori-cloud/concepts/advanced-augmentation.mdx` (modified, +2/-2)
```diff
@@ -1,11 +1,11 @@
 ---
 title: Advanced Augmentation
-description: How Memori's Advanced Augmentation engine extracts structured facts, preferences, and knowledge from your AI conversations — all managed in Memori Cloud.
+description: How Memori's Advanced Augmentation engine extracts structured facts, preferences, and knowledge from your AI conversations and agent trace — all managed in Memori Cloud.
 ---
 
 # Advanced Augmentation
 
-Advanced Augmentation is the AI engine inside Memori Cloud that turns raw conversations into structured, searchable memories. It runs asynchronously in the background to minimize impact on your response path.
+Advanced Augmentation is the AI engine inside Memori Cloud that turns raw conversations and agent trace into structured, searchable memories. It runs asynchronously in the background to minimize impact on your response path.
 
 ## What It Does
 
```

---

### Incident Patch 11: `1d765dcc` (2026-05-29)
**Commit Message**: fix: async API methods ignore configured request timeout (#537)

**File**: `memori/_network.py` (modified, +6/-2)
```diff
@@ -96,7 +96,9 @@ async def _read_error_payload(response: aiohttp.ClientResponse):
                     url,
                     headers=headers,
                     json=payload,
-                    timeout=aiohttp.ClientTimeout(total=30),
+                    timeout=aiohttp.ClientTimeout(
+                        total=self.config.request_secs_timeout
+                    ),
                 ) as r:
                     logger.debug("Augmentation response - status: %d", r.status)
 
@@ -250,7 +252,9 @@ async def __request_async(self, method: str, route: str, json=None):
                         url,
                         headers=headers,
                         json=json,
-                        timeout=aiohttp.ClientTimeout(total=30),
+                        timeout=aiohttp.ClientTimeout(
+                            total=self.config.request_secs_timeout
+                        ),
                     ) as r:
                         logger.debug(
                             "Async %s response - status: %d, attempt: %d",
```

**File**: `tests/test_network.py` (modified, +49/-0)
```diff
@@ -427,6 +427,55 @@ async def test_post_async_raises_generic_exception_after_max_retries(self, api):
                     await api.post_async("test/endpoint")
 
 
+class TestApiTimeout:
+    @pytest.mark.asyncio
+    async def test_request_async_uses_configured_timeout(self, api):
+        custom_timeout = 42
+        api.config.request_secs_timeout = custom_timeout
+
+        mock_response = MagicMock()
+        mock_response.raise_for_status = MagicMock()
+        mock_response.json = AsyncMock(return_value={})
+
+        mock_response_ctx = MagicMock()
+        mock_response_ctx.__aenter__.return_value = mock_response
+        mock_response_ctx.__aexit__.return_value = None
+
+        mock_session = MagicMock()
+        mock_session.request.return_value = mock_response_ctx
+        mock_session.__aenter__.return_value = mock_session
+        mock_session.__aexit__.return_value = None
+
+        with patch("aiohttp.ClientSession", return_value=mock_session):
+            with patch("aiohttp.ClientTimeout") as mock_timeout:
+                await api.post_async("test/endpoint")
+                mock_timeout.assert_called_once_with(total=custom_timeout)
+
+    @pytest.mark.asyncio
+    async def test_augmentation_async_uses_configured_timeout(self, api):
+        custom_timeout = 42
+        api.config.request_secs_timeout = custom_timeout
+
+        mock_response = MagicMock()
+        mock_response.status = 200
+        mock_response.json = AsyncMock(return_value={})
+        mock_response.raise_for_status = MagicMock()
+
+        mock_response_ctx = MagicMock()
+        mock_response_ctx.__aenter__.return_value = mock_response
+        mock_response_ctx.__aexit__.return_value = None
+
+        mock_session = MagicMock()
+        mock_session.post.return_value = mock_response_ctx
+        mock_session.__aenter__.return_value = mock_session
+        mock_session.__aexit__.return_value = None
+
+        with patch("aiohttp.ClientSession", return_value=mock_session):
+            with patch("aiohttp.ClientTimeout") as mock_timeout:
+                await api.augmentation_async({"test": "payload"})
+                mock_timeout.assert_called_with(total=custom_timeout)
+
+
 class TestApiSession:
     def test_session_creates_session_with_retry_adapter(self, api):
         """Test that __session creates a properly configured requests Session."""
```

---

### Incident Patch 12: `50dc8213` (2026-05-29)
**Commit Message**: docs: add troubleshooting, windows setup, project structure and quick… (#553)

**File**: `CONTRIBUTING.md` (modified, +222/-16)
```diff
@@ -34,12 +34,26 @@ Install Rust (`rustup`, `cargo`) when you are:
 
 If you are only changing pure Python SDK code (outside Rust/bindings), Rust is not required.
 
+## Quick Start Flow
+
+![Quick Start Flow](images/quickstart.png)
+
 ### Quick Start (Local Development)
 
+**Linux/Mac:**
+
 ```bash
 # Install uv if you haven't already
 curl -LsSf https://astral.sh/uv/install.sh | sh
+```
 
+**Windows (PowerShell):**
+
+```powershell
+powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
+```
+
+```bash
 # Clone the repository
 git clone https://github.com/MemoriLabs/Memori.git
 cd Memori
@@ -86,6 +100,7 @@ make dev-up
 ```
 
 This will:
+
 - Build the Docker container with Python 3.12
 - Install all dependencies with uv
 - Start PostgreSQL, MySQL, and MongoDB for integration tests
@@ -94,6 +109,7 @@ This will:
 ### Development Commands
 
 #### Local Development
+
 ```bash
 # Run unit tests
 uv run pytest
@@ -113,6 +129,7 @@ uv run pip-audit --require-hashes --disable-pip || true
 ```
 
 #### Docker Development
+
 ```bash
 # Enter the development container
 make dev-shell
@@ -185,7 +202,9 @@ Notes:
 We use `pytest` with coverage reporting and `pytest-mock` for mocking.
 
 ### Unit Tests
+
 Unit tests use mocks and run without external dependencies:
+
 ```bash
 # Local
 uv run pytest
@@ -195,7 +214,9 @@ make test
 ```
 
 ### Integration Tests
+
 Integration tests require:
+
 - Database instances (PostgreSQL, MySQL, MongoDB, or SQLite)
 - LLM API keys (OpenAI, Anthropic, Google)
 
@@ -215,35 +236,216 @@ make run-integration FILE=tests/llm/clients/oss/openai/sync.py
 ### Test Coverage
 
 We maintain high test coverage. Coverage reports are generated automatically:
+
 - Terminal output (summary)
 - HTML report in `htmlcov/`
 - XML report in `coverage.xml`
 
 View HTML coverage:
+
 ```bash
 open htmlcov/index.html  # macOS
 xdg-open htmlcov/index.html  # Linux
 ```
 
+## Troubleshooting
+
+### 1. uv Installation Fails
+
+**Linux/Mac:**
+
+```bash
+# If curl command fails, try pip instead
+pip install uv
+
+# Verify installation
+uv --version
+```
+
+**Windows (PowerShell):**
+
+```powershell
+powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
+
+# Verify
+uv --version
+```
+
+### 2. `uv sync` Fails
+
+**Error:** `No solution found`
+
+```bash
+# Clear cache and retry
+uv cache clean
+uv sync
+
+# Check Python version (must be 3.10+)
+python --version
+```
+
+**Error:** `Permission denied`
+
+```bash
+# Fix directory ownership (Linux/Mac)
+sudo chown -R $USER ~/.cache/uv
+sudo chown -R $USER .venv
+
+# OR reinstall uv in user-writable location
+curl -LsSf https://astral.sh/uv/install.sh | sh
+
+# Windows — fix cache permissions
+icacls .venv /grant %USERNAME%:F
+```
+
+### 3. Docker Won't Start
+
+**Error:** `Cannot connect to Docker daemon`
+
+```bash
+# Linux
+sudo systemctl start docker
+
+# Mac/Windows — open Docker Desktop app first
+
+# Verify Docker is running
+docker ps
+```
+
+**Error:** `Port already in use`
+
+```bash
+# Windows
+netstat -ano | findstr :8081
+
+# Linux/Mac
+lsof -i :8081
+
+# Then stop that process or change port in docker-compose.yml
+```
+
+### 4. Pre-commit Hooks Failing
+
+**Error:** `Ruff formatting issues`
+
+```bash
+# Auto-fix formatting
+uv run ruff format .
+
+# Auto-fix linting
+uv run ruff check --fix .
+
+# Retry commit
+git commit -m "your message"
+```
+
+**Error:** `pre-commit command not found`
+
+```bash
+# Reinstall hooks
+uv run pre-commit install
+
+# Run manually
+uv run pre-commit run --all-files
+```
+
+### 5. Rust Build Errors
+
+**Error:** `cargo not found`
+
+```bash
+# Install Rust
+curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
+
+# Reload terminal then verify
+rustc --version
+cargo --version
+```
+
+**Error:** `Rust version too old`
+
+```bash
+# Update Rust
+rustup update stable
+```
+
+### 6. pytest Failures
+
+**Error:** `Module not found`
+
+```bash
+# Reinstall dependencies
+uv sync
+
+# Always run pytest via uv
+uv run pytest
+```
+
+**Error:** `API key missing`
+(integration tests only — not needed for unit tests)
+
+```bash
+# Only needed when running integration tests:
+cp .env.example .env
+
+# Add keys:
+OPENAI_API_KEY=sk-...
+ANTHROPIC_API_KEY=sk-ant-...
+GOOGLE_API_KEY=...
+
+# Then run integration tests:
+make run-integration FILE=tests/llm/clients/oss/openai/sync.py
+```
+
+### 7. TypeScript / npm Errors
+
+**Error:** `npm ci fails`
+
+```bash
+# Check Node version (must be 20+)
+node --version
+
+# Clear cache and retry
+npm cache clean --force
+cd memori-ts && npm ci
+```
+
+**Error:** `Native module not found`
+
+```bash
+# Build Rust bindings first
+cd memori-ts
+npm run sync-native
+```
+
+### Still Stuck?
+
+1. Search [existing issues](https://github.com/MemoriLabs/Memori/issues) for your error
+2. Open a new issue with:
+   - Your OS and Python version (`python --version`)
+   - Full error message
+   - Steps you already tried
+
 ## Project Structure
 
 ```
-memori/              # SDK source code
-  llm/  
```

---

### Incident Patch 13: `606d9638` (2026-05-28)
**Commit Message**: Update version to 0.1.7 and implement trace handling in Memori integr… (#568)

* Update version to 0.1.7 and implement trace handling in Memori integration. Added functions to parse tool arguments and derive traces from Hermes messages, enhancing the memory provider's capabilities. Updated tests to validate trace functionality in client and provider interactions.

* Add functions to handle current turn messages and derive traces from them in Memori integration. Updated tests to reflect changes in trace derivation logic, ensuring only the current turn is processed for improved accuracy.

**File**: `integrations/hermes/plugin.yaml` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 name: memori
-version: 0.1.0
+version: 0.1.7
 description: Structured long-term memory for Hermes Agent using Memori Cloud.
 pip_dependencies:
   - memori
```

**File**: `integrations/hermes/pyproject.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ build-backend = "setuptools.build_meta"
 
 [project]
 name = "hermes-memori"
-version = "0.1.6"
+version = "0.1.7"
 description = "Official Memori Labs provider for Hermes Agent, enabling structured long-term memory from agent trace and execution."
 authors = [{name = "Memori Labs Team", email = "noc@memorilabs.ai"}]
 license = "Apache-2.0"
```

**File**: `integrations/hermes/src/memori_hermes/__init__.py` (modified, +113/-1)
```diff
@@ -89,6 +89,110 @@ def _load_config(hermes_home: str | Path | None = None) -> MemoriConfig | None:
     )
 
 
+def _content_text(value: Any) -> str:
+    if isinstance(value, str):
+        return value
+    if value is None:
+        return ""
+    return str(value)
+
+
+def _parse_tool_args(arguments: Any) -> dict[str, Any]:
+    if isinstance(arguments, dict):
+        return arguments
+    if isinstance(arguments, str):
+        try:
+            parsed = json.loads(arguments)
+        except json.JSONDecodeError:
+            return {"_raw": arguments}
+        if isinstance(parsed, dict):
+            return parsed
+        return {"value": parsed}
+    if arguments is None:
+        return {}
+    return {"value": arguments}
+
+
+def _current_turn_messages(
+    messages: list[dict[str, Any]] | None,
+    *,
+    user_content: str,
+    assistant_content: str,
+) -> list[dict[str, Any]]:
+    """Return only the completed turn from Hermes' full conversation history."""
+    if not messages:
+        return []
+
+    final_idx: int | None = None
+    for idx in range(len(messages) - 1, -1, -1):
+        message = messages[idx]
+        if not isinstance(message, dict) or message.get("role") != "assistant":
+            continue
+        if _content_text(message.get("content")) == _content_text(assistant_content):
+            final_idx = idx
+            break
+    if final_idx is None:
+        final_idx = len(messages)
+
+    start_idx = 0
+    for idx in range(final_idx - 1, -1, -1):
+        message = messages[idx]
+        if not isinstance(message, dict) or message.get("role") != "user":
+            continue
+        start_idx = idx
+        if _content_text(message.get("content")) == _content_text(user_content):
+            break
+
+    return messages[start_idx : final_idx + 1]
+
+
+def _derive_trace_from_messages(
+    messages: list[dict[str, Any]] | None,
+    *,
+    user_content: str,
+    assistant_content: str,
+) -> dict[str, list[dict[str, Any]]] | None:
+    """Build Memori's provider-owned tool trace from the current Hermes turn."""
+    current_turn = _current_turn_messages(
+        messages,
+        user_content=user_content,
+        assistant_content=assistant_content,
+    )
+    if not current_turn:
+        return None
+
+    tools: list[dict[str, Any]] = []
+    tools_by_id: dict[str, dict[str, Any]] = {}
+
+    for message in current_turn:
+        if not isinstance(message, dict):
+            continue
+
+        if message.get("role") == "assistant":
+            for tool_call in message.get("tool_calls") or []:
+                if not isinstance(tool_call, dict):
+                    continue
+                function = tool_call.get("function") or {}
+                if not isinstance(function, dict):
+                    function = {}
+                tool_call_id = str(tool_call.get("id") or "")
+                item = {
+                    "name": str(function.get("name") or ""),
+                    "args": _parse_tool_args(function.get("arguments")),
+                    "result": None,
+                }
+                tools.append(item)
+                if tool_call_id:
+                    tools_by_id[tool_call_id] = item
+
+        elif message.get("role") == "tool":
+            tool_call_id = str(message.get("tool_call_id") or "")
+            if tool_call_id and tool_call_id in tools_by_id:
+                tools_by_id[tool_call_id]["result"] = message.get("content")
+
+    return {"tools": tools} if tools else None
+
+
 class MemoriMemoryProvider(MemoryProvider):
     """Hermes MemoryProvider implementation backed by Memori Cloud."""
 
@@ -176,6 +280,7 @@ def sync_turn(
         assistant_content: str,
         *,
         session_id: str = "",
+        messages: list[dict[str, Any]] | None = None,
     ) -> None:
         if self._client is None:
             return
@@ -184,9 +289,14 @@ def sync_turn(
             self._sync_thread.join(timeout=SYNC_JOIN_TIMEOUT_SECS)
 
         active_session = session_id or self._session_id
+        trace = _derive_trace_from_messages(
+            messages,
+            user_content=user_content,
+            assistant_content=assistant_content,
+        )
         self._sync_thread = threading.Thread(
             target=self._sync_turn_background,
-            args=(user_content, assistant_content, active_session),
+            args=(user_content, assistant_content, active_session, trace),
             daemon=True,
         )
         self._sync_thread.start()
@@ -196,6 +306,7 @@ def _sync_turn_background(
         user_content: str,
         assistant_content: str,
         session_id: str,
+        trace: dict[str, Any] | None = None,
     ) -> None:
         if self._client is None:
             return
@@ -206,6 +317,7 @@ def _sync_turn_background(
                 assistant_content=assistant_content,
                 session_id=session_id,
                 platform=HERMES_PLATFORM,
+                trace=tr
```

**File**: `integrations/hermes/src/memori_hermes/client.py` (modified, +2/-0)
```diff
@@ -53,6 +53,7 @@ def capture_turn(
         assistant_content: str,
         session_id: str,
         platform: str,
+        trace: dict[str, Any] | None = None,
     ) -> None:
         del platform
         try:
@@ -62,6 +63,7 @@ def capture_turn(
                 project_id=self.project_id,
                 session_id=session_id,
                 platform=MEMORI_PLATFORM,
+                trace=trace,
             )
         except Exception as exc:  # noqa: BLE001
             raise MemoriApiError(str(exc)) from exc
```

**File**: `integrations/hermes/src/memori_hermes/plugin.yaml` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 name: memori
-version: 0.1.0
+version: 0.1.7
 description: Structured long-term memory for Hermes Agent using Memori Cloud.
 pip_dependencies:
   - memori
```

**File**: `integrations/hermes/tests/test_client.py` (modified, +22/-0)
```diff
@@ -92,9 +92,31 @@ def fake_capture_agent_turn(**kwargs):
         "project_id": "project",
         "session_id": "session",
         "platform": "hermes",
+        "trace": None,
     }
 
 
+def test_capture_turn_passes_trace(monkeypatch: pytest.MonkeyPatch) -> None:
+    client = make_client()
+    seen = {}
+    trace = {"tools": [{"name": "terminal", "args": {}, "result": "ok"}]}
+
+    def fake_capture_agent_turn(**kwargs):
+        seen.update(kwargs)
+
+    monkeypatch.setattr(client.memori, "capture_agent_turn", fake_capture_agent_turn)
+
+    client.capture_turn(
+        user_content="u",
+        assistant_content="a",
+        session_id="session",
+        platform="cli",
+        trace=trace,
+    )
+
+    assert seen["trace"] == trace
+
+
 def test_summary_rejects_session_without_project() -> None:
     client = make_client()
     client.project_id = ""
```

**File**: `integrations/hermes/tests/test_provider.py` (modified, +69/-2)
```diff
@@ -21,8 +21,11 @@ def capture_turn(
         assistant_content: str,
         session_id: str,
         platform: str,
+        trace=None,
     ) -> None:
-        self.captured.append((user_content, assistant_content, session_id, platform))
+        self.captured.append(
+            (user_content, assistant_content, session_id, platform, trace)
+        )
 
     def agent_recall(self, params):
         self.recall_params = params
@@ -72,7 +75,71 @@ def test_sync_turn_runs_background_capture() -> None:
     provider.sync_turn("hello", "hi")
     provider.shutdown()
 
-    assert client.captured == [("hello", "hi", "session-1", "hermes")]
+    assert client.captured == [("hello", "hi", "session-1", "hermes", None)]
+
+
+def test_sync_turn_derives_trace_from_current_hermes_turn_only() -> None:
+    client = FakeClient()
+    provider = MemoriMemoryProvider(client=client)
+    provider._session_id = "session-1"
+
+    provider.sync_turn(
+        "run tests",
+        "tests passed",
+        messages=[
+            {"role": "user", "content": "old request"},
+            {
+                "role": "assistant",
+                "tool_calls": [
+                    {
+                        "id": "old-call",
+                        "type": "function",
+                        "function": {
+                            "name": "terminal",
+                            "arguments": '{"command": "old"}',
+                        },
+                    }
+                ],
+            },
+            {"role": "tool", "tool_call_id": "old-call", "content": "old result"},
+            {"role": "assistant", "content": "old answer"},
+            {"role": "user", "content": "run tests"},
+            {
+                "role": "assistant",
+                "tool_calls": [
+                    {
+                        "id": "call-1",
+                        "type": "function",
+                        "function": {
+                            "name": "terminal",
+                            "arguments": '{"command": "pytest"}',
+                        },
+                    }
+                ],
+            },
+            {"role": "tool", "tool_call_id": "call-1", "content": "passed"},
+            {"role": "assistant", "content": "tests passed"},
+        ],
+    )
+    provider.shutdown()
+
+    assert client.captured == [
+        (
+            "run tests",
+            "tests passed",
+            "session-1",
+            "hermes",
+            {
+                "tools": [
+                    {
+                        "name": "terminal",
+                        "args": {"command": "pytest"},
+                        "result": "passed",
+                    }
+                ]
+            },
+        )
+    ]
 
 
 def test_handle_recall_adds_project_default() -> None:
```

---

### Incident Patch 14: `f764c10c` (2026-05-28)
**Commit Message**: Release version 3.3.6, updating changelog and project files to reflect the final version. Fixed serialization issue with Rust-backed BYODB recall to prevent datetime type errors in TiDB Zero/MySQL. (#563)

**File**: `CHANGELOG.md` (modified, +6/-12)
```diff
@@ -7,7 +7,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
-## [3.3.6rc2] - 2026-05-27
+## [3.3.6] - 2026-05-27
 
 ### Added
 
@@ -16,15 +16,6 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   `python -m memori provision` CLI command, and the `tidb-zero` optional
   dependency extra.
 
-### Fixed
-
-- Rust-backed BYODB recall now serializes nested recalled summaries before
-  passing rows into the native engine, preventing TiDB Zero/MySQL datetime
-  values from raising `TypeError: Object of type datetime is not JSON
-  serializable`.
-
-## [3.3.6rc1] - 2026-05-27
-
 ### Changed
 
 - Local embeddings now use the native Rust `fastembed` backend exclusively,
@@ -42,6 +33,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   `sentence-transformers` or its transitive dependencies.
 - Rust augmentation now logs when fact embedding attachment is skipped due to a
   row-count mismatch.
+- Rust-backed BYODB recall now serializes nested recalled summaries before
+  passing rows into the native engine, preventing TiDB Zero/MySQL datetime
+  values from raising `TypeError: Object of type datetime is not JSON
+  serializable`.
 
 ## [3.3.2] - 2026-04-28
 
@@ -124,7 +119,6 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   (Fixes #83)
 
 [3.3.0rc1]: https://github.com/MemoriLabs/Memori/releases/tag/v3.3.0rc1
-[3.3.6rc2]: https://github.com/MemoriLabs/Memori/releases/tag/v3.3.6rc2
-[3.3.6rc1]: https://github.com/MemoriLabs/Memori/releases/tag/v3.3.6rc1
+[3.3.6]: https://github.com/MemoriLabs/Memori/releases/tag/v3.3.6
 [3.3.2]: https://github.com/MemoriLabs/Memori/releases/tag/v3.3.2
 [3.0.0]: https://github.com/MemoriLabs/Memori/releases/tag/v3.0.0
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ build-backend = "setuptools.build_meta"
 
 [project]
 name = "memori"
-version = "3.3.6rc2"
+version = "3.3.6"
 description = "Memori Python SDK"
 authors = [{name = "Memori Labs Team", email = "noc@memorilabs.ai"}]
 license = {text = "Apache-2.0"}
```

**File**: `uv.lock` (modified, +1/-1)
```diff
@@ -2251,7 +2251,7 @@ wheels = [
 
 [[package]]
 name = "memori"
-version = "3.3.6rc2"
+version = "3.3.6"
 source = { editable = "." }
 dependencies = [
     { name = "aiohttp" },
```

---

### Incident Patch 15: `4b0d6930` (2026-05-27)
**Commit Message**: fix mysql datetime type (#562)

* fix mysql datetime type

* bump rc2

**File**: `CHANGELOG.md` (modified, +10/-0)
```diff
@@ -7,13 +7,22 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+## [3.3.6rc2] - 2026-05-27
+
 ### Added
 
 - Added MCP client setup guidance for project-scoped attribution using workspace-derived values for `X-Memori-Entity-Id` and `X-Memori-Process-Id` to prevent memory mixing across projects. (Refs #404)
 - Added TiDB Zero BYODB provisioning via `Memori.provision(...)`, the
   `python -m memori provision` CLI command, and the `tidb-zero` optional
   dependency extra.
 
+### Fixed
+
+- Rust-backed BYODB recall now serializes nested recalled summaries before
+  passing rows into the native engine, preventing TiDB Zero/MySQL datetime
+  values from raising `TypeError: Object of type datetime is not JSON
+  serializable`.
+
 ## [3.3.6rc1] - 2026-05-27
 
 ### Changed
@@ -115,6 +124,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   (Fixes #83)
 
 [3.3.0rc1]: https://github.com/MemoriLabs/Memori/releases/tag/v3.3.0rc1
+[3.3.6rc2]: https://github.com/MemoriLabs/Memori/releases/tag/v3.3.6rc2
 [3.3.6rc1]: https://github.com/MemoriLabs/Memori/releases/tag/v3.3.6rc1
 [3.3.2]: https://github.com/MemoriLabs/Memori/releases/tag/v3.3.2
 [3.0.0]: https://github.com/MemoriLabs/Memori/releases/tag/v3.0.0
```

**File**: `memori/_rust_core.py` (modified, +20/-1)
```diff
@@ -776,7 +776,7 @@ def _callback(request_json: str) -> str:
                             "id": _normalize_fact_id(row.get("id")),
                             "content": row.get("content", ""),
                             "date_created": str(row.get("date_created", "")),
-                            "summaries": row.get("summaries", []),
+                            "summaries": _json_safe(row.get("summaries", [])),
                         }
                     )
                 return json.dumps(out)
@@ -847,6 +847,25 @@ def _normalize_fact_id(fact_id: Any) -> int | str:
     return str(fact_id)
 
 
+def _json_safe(value: Any) -> Any:
+    try:
+        json.dumps(value)
+    except TypeError:
+        pass
+    else:
+        return value
+
+    if isinstance(value, dict):
+        return {str(key): _json_safe(item) for key, item in value.items()}
+    if isinstance(value, list):
+        return [_json_safe(item) for item in value]
+    if isinstance(value, tuple):
+        return [_json_safe(item) for item in value]
+    if isinstance(value, set):
+        return [_json_safe(item) for item in value]
+    return str(value)
+
+
 def _normalize_embedding_row(fact_id: Any, embedding: Any) -> dict[str, Any] | None:
     payload: dict[str, Any] = {"id": _normalize_fact_id(fact_id)}
     if embedding is None:
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ build-backend = "setuptools.build_meta"
 
 [project]
 name = "memori"
-version = "3.3.6rc1"
+version = "3.3.6rc2"
 description = "Memori Python SDK"
 authors = [{name = "Memori Labs Team", email = "noc@memorilabs.ai"}]
 license = {text = "Apache-2.0"}
```

**File**: `tests/test_rust_core.py` (modified, +37/-0)
```diff
@@ -4,6 +4,7 @@
 import shutil
 import zipfile
 from contextlib import contextmanager
+from datetime import datetime
 from types import SimpleNamespace
 
 import pytest
@@ -114,6 +115,42 @@ class MongoDriver:
     driver.entity_fact.get_facts_by_ids.assert_called_once_with([fact_id])
 
 
+def test_fetch_facts_by_ids_callback_serializes_datetime_summaries(mocker):
+    config = Config()
+    config.storage = SimpleNamespace(conn_factory=object)
+    date_created = datetime(2026, 5, 20, 14, 30, 12)
+    driver = SimpleNamespace(
+        entity_fact=SimpleNamespace(
+            get_facts_by_ids=mocker.Mock(
+                return_value=[
+                    {
+                        "id": 7,
+                        "content": "The user lives in Paris.",
+                        "date_created": date_created,
+                        "summaries": [
+                            {
+                                "content": "The conversation mentions Paris.",
+                                "date_created": date_created,
+                            }
+                        ],
+                    }
+                ]
+            )
+        )
+    )
+
+    mocker.patch(
+        "memori._rust_core.connection_context",
+        side_effect=lambda conn_factory: _fake_connection_context(conn_factory, driver),
+    )
+
+    callback = _rust_core.RustCoreAdapter._fetch_facts_by_ids_cb(config)
+    output = json.loads(callback(json.dumps({"ids": [7]})))
+
+    assert output[0]["date_created"] == "2026-05-20 14:30:12"
+    assert output[0]["summaries"][0]["date_created"] == "2026-05-20 14:30:12"
+
+
 def test_write_batch_callback_maps_process_attribute_dict(mocker):
     config = Config()
     config.storage = SimpleNamespace(conn_factory=object)
```

**File**: `uv.lock` (modified, +1/-1)
```diff
@@ -2251,7 +2251,7 @@ wheels = [
 
 [[package]]
 name = "memori"
-version = "3.3.6rc1"
+version = "3.3.6rc2"
 source = { editable = "." }
 dependencies = [
     { name = "aiohttp" },
```

#### Recent Merged Pull Requests:
- **PR #634** (closed): Practice GitHub branch workflow Learning branch (@APSINGH-AI)
- **PR #633** (2026-09-18): Fix asyncio.iscoroutinefunction call blocking CI (@jayyao18)
- **PR #629** (2026-09-03): Added customer use case to the readme in Memori repo (@jayyao18)
- **PR #626** (2026-08-21): Added Memori Enterprise preview section to readme (@jayyao18)
- **PR #621** (closed): Remove the old readme that was written for OpenRouter (@jayyao18)
- **PR #616** (2026-07-28): Fixed the badge issue and added new benchmark results to readme (@jayyao18)
- **PR #615** (2026-07-28): New LoCoMo benchmark numbers and plots to latest results (@jayyao18)
- **PR #605** (closed): docs: Add comprehensive architecture overview guide for Memori system (@learner-Piyush)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
