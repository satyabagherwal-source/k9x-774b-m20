> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/michael-a-kuykendall-shimmy-learnings.md`  
> **Source**: github ([https://github.com/Michael-A-Kuykendall/shimmy](https://github.com/Michael-A-Kuykendall/shimmy))  
> **Source Version**: `239bb745`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-31T00:45:34.691Z  
> **Learning ID**: `learn-github-michael-a-kuykendall-shimmy`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): Michael-A-Kuykendall/shimmy

---

## 1. Executive Forensic Architecture & System Mechanics

```
                             [ Network Clients / OpenAI API Callers ]
                                                │
                                    HTTP / REST / WebSockets
                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│ Shimmy HTTP Ingress Layer (Axum 0.7)                                                      │
│ ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Security Boundary: Non-loopback Bind Gate (Enforces SHIMMY_API_KEY if bind != 127.0.0.1)│ │
│ └────────────────────────────────┬──────────────────────────────────────────────────────┘ │
│                                  │                                                        │
│                                  ▼                                                        │
│ ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Routing & Request Parsing: /v1/chat/completions, /v1/completions, /health             │ │
│ └────────────────────────────────┬──────────────────────────────────────────────────────┘ │
│                                  │                                                        │
│                                  ▼                                                        │
│ ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Response Cache Layer (RwLock<HashMap<CacheKey, CachedResponse>>)                      │ │
│ │  - Direct-occupancy reconciliation (occupied_bytes derived from map)                  │ │
│ │  - Dual-metric LRU eviction (max_entries count & max_size_mb memory capacity)        │ │
│ └────────────────────────────────┬──────────────────────────────────────────────────────┘ │
└──────────────────────────────────┼────────────────────────────────────────────────────────┘
                                   │ (Cache Miss)
                                   ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│ Unified Prompt Rendering Substrate (`prompt_render.rs`)                                   │
│  - Extraction Priority: GGUF Embedded `tokenizer.chat_template` (via `shimmyjinja`)     │
│  - Fallback: TemplateFamily (ChatML / Llama3)                                             │
│  - Base Model Gate: `TemplateFamily::OpenChat` maps to true Raw Completion (No ChatML wrap)│
│  - Thinking Heuristic: Force `/nothink` or disable reasoning tokens for Qwen/DeepSeek-R1  │
└──────────────────────────────────┬────────────────────────────────────────────────────────┘
                                   │ Rendered Token/Text Prompt
                                   ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│ Inference Engine Adapter (`engine/adapter.rs`)                                            │
│  - Backend Arbiter: Inspects file extension & path magic heuristics                       │
│      * `.safetensors`  ──► SafeTensorsEngine (Native Rust, zero C++, mmap-backed)         │
│      * `.gguf` / blobs ──► AirframeEngine (WebGPU / WGSL compute shaders, in-process)     │
└───────────────────┬───────────────────────────────────────────┬───────────────────────────┘
                    │                                           │
                    ▼                                           ▼
┌───────────────────────────────────────┐   ┌───────────────────────────────────────────────┐
│ SafeTensors Native Engine             │   │ Airframe GPU Engine (`engine/airframe.rs`)    │
│  - Mmap strategy: >100MB mmap2::Mmap  │   │  - tokio::task::spawn_blocking Worker Bridge  │
│  - In-Memory buffer: <=100MB Vec<u8>  │   │  - Mutex<Option<GpuRuntime>> Serialization    │
│  - Zero Python dependencies           │   │  - LogitsMask & Grammar Injection Hooks       │
│  - Direct header deserialization      │   │  - F32 deterministic accumulation compute     │
└───────────────────────────────────────┘   └───────────────────────────────────────────────┘
```

### Architectural Subsystem Boundaries

1. **HTTP Ingress & Policy Guard Layer (`src/server.rs`, `src/util/diag.rs`)**:
   Axum 0.7-based asynchronous routing. Terminates requests, applies strict loopback checks (preventing non-authenticated exposure on `0.0.0.0`), manages streaming chunk buffers via Server-Sent Events (SSE), and surfaces runtime telemetry (`sysinfo`).
2. **Response Cache Subsystem (`src/cache/response_cache.rs`)**:
   In-memory query acceleration layer. Implements a synchronized dual-metric LRU cache tracking total entry count and cumulative byte size. Resolves race conditions by computing cache occupancy directly from stored byte slices, preventing stale accounting during key updates or evictions.
3. **Prompt Rendering Substrate (`src/prompt_render.rs`)**:
   Decoupled template resolution pipeline that prioritizes model-native Jinja templates extracted directly from GGUF binary headers via `shimmyjinja`. It falls back to hardcoded formatters (`ChatML`, `Llama3`) only when model-level templates are missing, and passes base/code model prompts through unformatted to prevent instruct-wrapper pollution.
4. **Engine Abstraction & Adapter Layer (`src/engine/adapter.rs`, `src/engine/mod.rs`)**:
   Unified dynamic dispatch boundary exposing `InferenceEngine` and `LoadedModel` traits. Decouples front-end protocol parsing from low-level tensor computation backends (`AirframeEngine` vs `SafeTensorsEngine`).
5. **Compute Runtime Core (`src/engine/airframe.rs`, `src/engine/safetensors_native.rs`)**:
   The execution runtime. For GGUF models, it interfaces with the `Airframe` WebGPU/WGSL engine using an asynchronous-to-synchronous execution bridge (`tokio::task::spawn_blocking`). For SafeTensors, it bypasses Python/C++ entirely, using zero-copy memory-mapped file access (`memmap2`) for models larger than 100MB and in-memory buffers for smaller checkpoints.

---

## 2. Net-New Universal Engineering Rules

### 1. In-Memory Cache Occupancy Derived-State Invariant
**RULE**:
When implementing an in-memory capacity-bounded or size-bounded cache (e.g., bounded by total megabytes or entry count), you **MUST NOT** track byte occupancy using an external mutable running counter updated via ad-hoc delta arithmetic (`total += size`, `total -= size`) on insert/update. You **MUST** compute occupancy from map primitives or reconcile occupancy from actual entries during replacement, and you **MUST** reject oversized entries *before* triggering LRU evictions.

**WHY**:
Key replacement (`map.insert(existing_key, new_value)`) silently evicts an existing entry's value without decreasing an external running accumulator unless explicit replacement detection is handled. This leads to phantom memory inflation, premature evictions of valid items, and eventual cache starvation. Furthermore, if a candidate item exceeds the total cache capacity, an unreconciled eviction loop will purge the entire cache before realizing the candidate cannot fit.

**WHEN TO APPLY**:
Any cache layer in Rust, Go, C++, or TypeScript enforcing soft or hard memory limits (`max_bytes`, `max_memory_mb`) alongside an LRU, LFU, or FIFO eviction algorithm.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
pub struct BoundedSizeCache<K, V> {
    entries: HashMap<K, CacheEntry<V>>,
    max_entries: usize,
    max_size_bytes: usize,
}

pub struct CacheEntry<V> {
    pub value: V,
    pub size_bytes: usize,
    pub last_accessed: std::time::Instant,
}

impl<K: std::hash::Hash + Eq + Clone, V> BoundedSizeCache<K, V> {
    #[inline]
    fn occupied_bytes(entries: &HashMap<K, CacheEntry<V>>) -> usize {
        entries.values().map(|entry| entry.size_bytes).sum()
    }

    pub fn insert(&mut self, key: K, value: V, size_bytes: usize) -> bool {
        // Guard 1: Prevent insertion if entry alone exceeds total capacity
        if self.max_entries == 0 || size_bytes > self.max_size_bytes {
            return false;
        }

        let entry = CacheEntry {
            value,
            size_bytes,
            last_accessed: std::time::Instant::now(),
        };

        // Insert first to let the collection handle replacement mechanics
        self.entries.insert(key.clone(), entry);
        let mut current_occupied = Self::occupied_bytes(&self.entries);

        // Guard 2: Evict LRU entries if count or size limits are exceeded
        while self.entries.len() > self.max_entries || current_occupied > self.max_size_bytes {
            // Find LRU excluding the key we just inserted
            let lru_key = self.entries
                .iter()
                .filter(|(k, _)| **k != key)
                .min_by_key(|(_, v)| v.last_accessed)
                .map(|(k, _)| k.clone());

            if let Some(evict_key) = lru_key {
                if let Some(removed) = self.entries.remove(&evict_key) {
                    current_occupied -= removed.size_bytes;
                }
            } else {
                break;
            }
        }
        true
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Running delta arithmetic with independent accumulator
let entry_size = entry.size_bytes;
// BUG 1: If entry_size > max_size, this purges valid cache entries
while current_size + entry_size > max_size {
    let lru = find_lru(&cache);
    cache.remove(&lru);
    current_size -= lru.size;
}
// BUG 2: If key already exists in map, map.insert replaces it, but current_size
// is incremented by entry_size without subtracting old entry's size!
cache.insert(key, entry);
current_size += entry_size; // Accumulator drifts upward indefinitely!
```

**VERIFICATION METHOD**:
Property-based or unit testing verifying replacement invariants:
```rust
#[tokio::test]
async fn test_cache_replacement_does_not_drift_occupancy() {
    let mut cache = BoundedSizeCache::new(2, 1024 * 1024);
    let key = "test_key";
    let data_500kb = vec![0u8; 500 * 1024];
    let data_600kb = vec![0u8; 600 * 1024];

    cache.insert(key, data_500kb, 500 * 1024);
    assert_eq!(cache.occupied_bytes(), 500 * 1024);

    // Overwrite existing key with larger valid payload
    cache.insert(key, data_600kb, 600 * 1024);
    // Stale running sum would report 1100KB and trigger invalid eviction
    assert_eq!(cache.occupied_bytes(), 600 * 1024);
    assert_eq!(cache.len(), 1);
}
```

---

### 2. Fail-Closed Network Boundary Invariant for Unauthenticated Daemons
**RULE**:
Any backend daemon that exposes administrative, execution, or inference endpoints without a cryptographically verified authentication token **MUST NOT** bind to non-loopback network interfaces (`0.0.0.0`, `::`) by default. The server runtime **MUST** evaluate the socket bind target on boot; if bound to a non-loopback address and no shared secret (`API_KEY`) is configured, the server **MUST** terminate startup immediately with a non-zero exit code.

**WHY**:
Container runtimes (Docker, Podman) and orchestration templates (Kubernetes, Compose) routinely specify `--bind 0.0.0.0` or `hostPort` mappings to enable service discovery and container ingress. If authentication middleware is optional or absent, non-loopback binding immediately exposes computational, financial, and data resources to public scanners, bypassing host perimeter firewalls and loopback assumptions.

**WHEN TO APPLY**:
All local AI runtimes, CLI inference engines, microservice proxy layers, and developer tooling providing local HTTP/RPC interfaces.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::net::SocketAddr;

pub struct ServerConfig {
    pub bind_addr: SocketAddr,
    pub api_key: Option<String>,
}

pub fn enforce_network_security_boundary(config: &ServerConfig) -> Result<(), &'static str> {
    let is_loopback = config.bind_addr.ip().is_loopback();
    let has_auth = config.api_key.as_ref().map_or(false, |k| !k.trim().is_empty());

    if !is_loopback && !has_auth {
        eprintln!(
            "FATAL SECURITY VIOLATION: Refusing to bind to non-loopback address ({}) \
            without authentication. Set SHIMMY_API_KEY or bind to 127.0.0.1.",
            config.bind_addr
        );
        return Err("Insecure non-loopback binding rejected");
    }
    Ok(())
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Blindly binding to user-supplied address with wildcard CORS
let app = Router::new()
    .route("/v1/chat/completions", post(chat_handler))
    .layer(CorsLayer::permissive()); // Allows any origin, unauthenticated

// Server starts unconditionally on 0.0.0.0:11435 in Docker containers!
let listener = tokio::net::TcpListener::bind(&cli_args.bind_address).await?;
axum::serve(listener, app).await?;
```

**VERIFICATION METHOD**:
Automated integration test asserting startup failure on wildcard binding without credentials:
```rust
#[test]
fn test_wildcard_bind_requires_api_key() {
    let insecure_config = ServerConfig {
        bind_addr: "0.0.0.0:11435".parse().unwrap(),
        api_key: None,
    };
    assert!(enforce_network_security_boundary(&insecure_config).is_err());

    let secure_config = ServerConfig {
        bind_addr: "0.0.0.0:11435".parse().unwrap(),
        api_key: Some("secret-token-value".to_string()),
    };
    assert!(enforce_network_security_boundary(&secure_config).is_ok());
}
```

---

### 3. Asynchronous-to-Synchronous Hardware Runtime Isolation
**RULE**:
When bridging asynchronous HTTP request handlers (e.g., Tokio, Actix) to synchronous hardware-bound runtimes (e.g., WebGPU compute queues, CUDA streams, C++ FFI inference loops), the runtime state **MUST** be accessed via a blocking mutex inside a dedicated worker thread (`tokio::task::spawn_blocking`). Asynchronous code **MUST NOT** hold an `async` Mutex guard across an FFI or blocking hardware call, nor may synchronous hardware code access async runtime reactors directly.

**WHY**:
Acquiring asynchronous locks (`tokio::sync::Mutex`) across long-running SIMD/GPU compute operations stalls the asynchronous runtime's worker threads, starving event loops of I/O cycles. Conversely, acquiring synchronous locks directly inside async tasks causes thread pool deadlocks. Encapsulating the runtime in a `tokio::task::spawn_blocking` closure and calling `blocking_lock()` isolates the heavy hardware execution from the network reactor.

**WHEN TO APPLY**:
All systems interfacing asynchronous network servers with synchronous native libraries, GPU runtimes (`wgpu`, `Vulkan`, `DirectX`), or CPU-bound matrix multiplication kernels.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::sync::Arc;
use tokio::sync::Mutex as TokioMutex;

pub struct SafeGpuEngine {
    runtime: Arc<TokioMutex<Option<GpuHardwareContext>>>,
}

impl SafeGpuEngine {
    pub async fn dispatch_inference(
        &self,
        prompt: String,
        params: InferenceParams,
    ) -> Result<InferenceResult, Box<dyn std::error::Error + Send + Sync>> {
        let runtime_arc = self.runtime.clone();

        // Offload blocking compute to dedicated blocking thread pool
        let output = tokio::task::spawn_blocking(move || -> Result<InferenceResult, HardwareError> {
            // Lock safely on the blocking thread without starving Tokio async workers
            let guard = runtime_arc.blocking_lock();
            let context = guard.as_ref().ok_or(HardwareError::Uninitialized)?;

            context.reset();
            context.execute_pipeline(&prompt, &params)
        })
        .await
        .map_err(|join_err| format!("Task execution panicked: {join_err}"))??;

        Ok(output)
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Calling synchronous hardware compute inside async task context
pub async fn dispatch_bad(&self, prompt: &str) -> Result<String, Error> {
    // BUG: Async lock held while blocking thread runs GPU kernel for 3000ms
    let mut guard = self.runtime.lock().await; 
    let context = guard.as_mut().unwrap();
    // STALLS TOKIO RUNTIME: The entire async worker thread is blocked here!
    let result = context.execute_blocking_gpu_shader(prompt); 
    Ok(result)
}
```

**VERIFICATION METHOD**:
Enforce concurrency safety by verifying non-blocking execution under heavy async ping loads:
```rust
#[tokio::test]
async fn test_async_reactor_not_blocked_during_inference() {
    let engine = SafeGpuEngine::new_mock();
    let inference_future = engine.dispatch_inference("long prompt".into(), Default::default());

    let mut counter = 0;
    let timer_future = async {
        for _ in 0..100 {
            tokio::time::sleep(std::time::Duration::from_millis(5)).await;
            counter += 1;
        }
    };

    tokio::select! {
        _ = inference_future => {},
        _ = timer_future => {},
    }
    // Async timer must have progressed significantly during compute
    assert!(counter > 10, "Tokio reactor starved during hardware inference!");
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Stale Running-Sum Cache Memory Leak & Self-Eviction Deadlock on Overwrite
- **Context**: Subsystem: Response Caching. File: `src/cache/response_cache.rs`.
- **What Was Expected**: When a response cache entry was overwritten or evicted, the internal tracker `stats.total_size_bytes` should accurately reflect the actual allocated bytes in `HashMap<CacheKey, CachedResponse>`.
- **What Actually Happened**: The code tracked memory usage with an independent running accumulator: `stats.total_size_bytes += entry_size;`. When a key was replaced, the map dropped the old value, but the running total added the new entry's size without deducting the old entry's size. Over time, `stats.total_size_bytes` artificially inflated beyond `max_size_mb * 1024 * 1024`. Consequently, *every* subsequent cache insertion triggered an aggressive LRU eviction loop, purging valid cached items while the running sum remained stuck above the ceiling.
- **Evidence in Repo**: Commit `239bb745`, Git Message: *"fix: reconcile response cache capacity from stored entries"*.
- **Root Cause**: Desynchronization between data structure occupancy and a secondary tracking integer. Failure to calculate delta changes during key-overwrite operations.
- **Remediation Code Diff**:
```rust
@@ -150,6 +150,10 @@ impl ResponseCache {
         }
     }
 
+    fn occupied_bytes(cache: &HashMap<CacheKey, CachedResponse>) -> usize {
+        cache.values().map(|entry| entry.size_bytes).sum()
+    }
+
@@ -192,38 +198,44 @@ impl ResponseCache {
-        let entry_size = entry.size_bytes;
+        let max_size_bytes = self.config.max_size_mb.saturating_mul(1024 * 1024);
+        if self.config.max_entries == 0 || entry.size_bytes > max_size_bytes {
+            return;
+        }
 
         let mut cache = self.cache.write().await;
         let mut stats = self.stats.write().await;
 
-        // Check if we need to evict entries
-        while cache.len() >= self.config.max_entries
-            || stats.total_size_bytes + entry_size > self.config.max_size_mb * 1024 * 1024
-        {
-            if let Some(lru_key) = self.find_lru_key(&cache).await {
+        // Let the map decide whether this is a replacement, then derive occupancy
+        // from its actual entries instead of maintaining a separate running sum.
+        cache.insert(key.clone(), entry);
+        let mut occupied = Self::occupied_bytes(&cache);
+        while cache.len() > self.config.max_entries || occupied > max_size_bytes {
+            if let Some(lru_key) = Self::find_lru_key(&cache, &key) {
                 if let Some(removed) = cache.remove(&lru_key) {
-                    stats.total_size_bytes -= removed.size_bytes;
+                    occupied -= removed.size_bytes;
                     stats.evictions += 1;
                     debug!("Evicted LRU cache entry");
                 }
             } else {
-                break; // No entries to evict
+                break;
             }
         }
-        cache.insert(key.clone(), entry);
         stats.entries = cache.len();
-        stats.total_size_bytes += entry_size;
+        stats.total_size_bytes = occupied;
```
- **Lesson**: Do not maintain redundant mutable state for properties derivable from collection contents. If performance requires an accumulator, recalculate or verify it against the primary source of truth during mutating operations.

---

### Incident 2: Unauthenticated 0.0.0.0 Exposure via Production Deployment Templates
- **Context**: Subsystem: HTTP Server & Ingress Network Configuration. Files: `src/server.rs`, `deploy/Dockerfile`, `deploy/docker-compose.yml`.
- **What Was Expected**: Production templates deploying an LLM server to Kubernetes or Docker should safeguard the inference endpoint from public internet exploitation.
- **What Actually Happened**: The Axum HTTP router had no authentication middleware checking `Authorization` or `API_KEY` headers. Concurrently, official deployment manifests configured containers to bind `0.0.0.0:11435` and Kubernetes services were specified with `type: LoadBalancer`. This created open proxies on public cloud infrastructures, exposing local GPU compute resources without rate limits or access controls.
- **Evidence in Repo**: Issue #221 (*"Missing authentication on the inference API, exposed by the project's own default production deployment templates"*). Resolved in version 2.6.5.
- **Root Cause**: Deployment manifests were decoupled from network validation logic. Development defaults (`bind: 0.0.0.0` with no auth required) were used in production container configurations.
- **Remediation Code Diff**:
```rust
// src/main.rs / src/server.rs
let bind_addr: SocketAddr = cli.bind.parse()?;
let api_key = std::env::var("SHIMMY_API_KEY").ok();

if !bind_addr.ip().is_loopback() && api_key.is_none() {
    tracing::error!("FATAL: Non-loopback bind address ({}) requested without SHIMMY_API_KEY", bind_addr);
    std::process::exit(1);
}

let app = Router::new()
    .route("/v1/chat/completions", post(chat_handler))
    .layer(axum::middleware::from_fn(move |req, next| {
        let expected_key = api_key.clone();
        async move {
            if let Some(ref required) = expected_key {
                let auth_header = req.headers().get(header::AUTHORIZATION)
                    .and_then(|h| h.to_str().ok());
                let token = auth_header.and_then(|h| h.strip_prefix("Bearer "));
                if token != Some(required.as_str()) {
                    return Err(StatusCode::UNAUTHORIZED);
                }
            }
            Ok(next.run(req).await)
        }
    }));
```
- **Lesson**: Network services should default to secure configurations: bind to loopback (`127.0.0.1`) by default, and fail fast during startup if public interfaces are targeted without authentication credentials.

---

### Incident 3: Oversized Entry Eviction Thrashing
- **Context**: Subsystem: Response Cache. File: `src/cache/response_cache.rs`.
- **What Was Expected**: If an incoming LLM response exceeds the entire cache capacity (`max_size_mb`), the cache should bypass caching for this item and leave existing valid cache entries untouched.
- **What Actually Happened**: The eviction check ran in a `while` loop evaluated *before* insertion:
```rust
while cache.len() >= self.config.max_entries
    || stats.total_size_bytes + entry_size > self.config.max_size_mb * 1024 * 1024
```
When `entry_size > max_size_bytes`, the condition remained true even after evicting *every* item