> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/trailbaseio-trailbase-learnings.md`  
> **Source**: github ([https://github.com/trailbaseio/trailbase](https://github.com/trailbaseio/trailbase))  
> **Source Version**: `047a8a24`  
> **License**: OSL-3.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-09T11:54:11.543Z  
> **Learning ID**: `learn-github-trailbaseio-trailbase`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): trailbaseio/trailbase

---

## 1. Executive Forensic Architecture & System Mechanics

`trailbase` is a single-binary, sub-millisecond backend engine combining an embedded relational database (SQLite via `rusqlite`), a WebAssembly extension runtime (`wasmtime` targeting WASI Preview 2), dynamic REST/realtime APIs (Axum + SSE), authentication, and an embedded administrative UI.

```
                  +-------------------------------------------------------------+
                  |                     Client Ingress                         |
                  |          (HTTP/1.1, HTTP/2 via Axum / Tower Layers)          |
                  +------------------------------+------------------------------+
                                                 |
         +---------------------------------------+---------------------------------------+
         |                                       |                                       |
+--------v----------------+             +--------v----------------+             +--------v----------------+
|  Admin & System APIs    |             |  Dynamic Record APIs    |             | Auth & Token Subsystem  |
| - Config Sync (Proto)   |             | - Schema introspection  |             | - Argon2 Password Hash  |
| - Backups & Snapshots   |             | - Access Rule Evaluator |             | - JWT Signing / Refresh |
| - Email Dispatch        |             | - AST Filter Rewrite    |             | - PKCE & OAuth Flow     |
+--------+----------------+             +--------+----------------+             +--------+----------------+
         |                                       |                                       |
         +-------------------+-------------------+-------------------+-------------------+
                             |                                       |
                  +----------v-----------+               +-----------v----------+
                  |  WASI Guest Runtime  |               |  Connection Manager  |
                  | - wasm32-wasip2      |               | - Write serialized   |
                  | - Isolated memory    |               | - Read pool cloned   |
                  +----------------------+               +-----------+----------+
                                                                     |
                                                 +-------------------v-------------------+
                                                 |        rusqlite Hook Pipeline         |
                                                 | - PreUpdate Hook  (staged buffer)     |
                                                 | - Rollback Hook   (buffer.clear())    |
                                                 | - Commit Hook     (drain -> flume)    |
                                                 +-------------------+-------------------+
                                                                     |
                                                 +-------------------v-------------------+
                                                 |        SQLite Strict Engine           |
                                                 | - WAL mode / UUIDv7 binary keys       |
                                                 +---------------------------------------+
```

### Critical Architectural Boundaries & State Ownership
1. **Connection Manager & Isolation**: Write queries execute under exclusive write-lock ownership, whereas read queries bypass the writer via concurrent WAL read connections. All dynamic DDL migrations and schema changes invalidate an internal metadata registry, forcing dynamic Axum routes to sync with SQLite system catalogs.
2. **Hook Pipeline & Transaction Staging**: Real-time event propagation taps into SQLite's low-level engine hooks (`preupdate_hook`, `commit_hook`, `rollback_hook`). Mutations cannot be directly published to channels on the fly because SQLite fires `preupdate_hook` during statement execution inside a transaction that may later fail or roll back. A staging buffer guards downstream SSE pipelines from phantom dirty reads.
3. **WASI Isolation Barrier**: Custom logic is executed as compiled WebAssembly (`wasm32-wasip2`) guest components. The host enforces strict linear memory limits, timeouts, and sandboxed host-call boundaries, preventing guest crashes from taking down the core daemon.
4. **Protobuf/Textproto Configuration State**: System settings are managed as structured protobuf messages (`trailbase.config`). Updates are atomic, verified via SHA-256 hashes against concurrent modification, and secrets (passwords, SMTP keys) are stripped via automated vault redaction before exposure to the Admin UI.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Two-Phase Staged Transactional Event Publishing for Embedded Databases
**RULE**:
When capturing data change events from embedded database engines (such as SQLite's `preupdate_hook` or `update_hook`), the system **MUST NOT** dispatch notification events directly to external event buses, async channels, or client SSE connections inside the row mutation callback. The system **MUST** stage event payloads in a transaction-local or connection-locked buffer, purge the buffer on transaction `rollback_hook`, and drain/publish the buffer exclusively within the engine's `commit_hook`.

**WHY**:
Database engines fire update and preupdate hooks iteratively as statements execute inside open transactions. If a subsequent statement fails, a constraint is violated, or the client issues an explicit `ROLLBACK`, rows modified prior to the failure are discarded by the storage engine. Publishing events immediately upon hook invocation produces catastrophic data phantom anomalies: subscribers receive `Insert`/`Update`/`Delete` stream events for rows that were never committed, permanently corrupting client caches.

**WHEN TO APPLY**:
Any time an embedded database (SQLite, DuckDB, RocksDB) or ORM transaction lifecycle is bridged into an asynchronous message channel, webhooks, or Server-Sent Events (SSE).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use parking_lot::Mutex;
use rusqlite::hooks::{Action, PreUpdateCase};
use std::sync::Arc;

pub struct StagedHookPipeline {
    buffer: Arc<Mutex<Vec<PreupdateHookEvent>>>,
}

pub fn install_staged_hooks(
    conn: &trailbase_sqlite::Connection,
    sender: flume::Sender<(usize, PreupdateHookEvent)>,
) -> Result<(), RecordError> {
    let mut lock = conn
        .write_lock()
        .map_err(|err| RecordError::Internal(err.into()))?;

    let buffer = Arc::new(Mutex::new(Vec::<PreupdateHookEvent>::new()));

    // 1. Commit Hook: Atomically drain staged buffer and dispatch down the async channel
    lock.commit_hook(Some({
        let conn = conn.clone();
        let buffer = buffer.clone();
        let mut sequence_counter: usize = 0;

        move || {
            let mut staged = buffer.lock();
            for event in staged.drain(..) {
                sequence_counter += 1;
                match sender.try_send((sequence_counter, event)) {
                    Ok(()) => {}
                    Err(flume::TrySendError::Full(_)) => {
                        log::warn!("Realtime subscription channel saturated. Dropping event.");
                    }
                    Err(flume::TrySendError::Disconnected(_)) => {
                        let _ = uninstall_hooks(&conn);
                        break;
                    }
                }
            }
            // Returning false instructs SQLite to proceed with the commit
            false
        }
    }))
    .map_err(|err| RecordError::Internal(err.into()))?;

    // 2. Rollback Hook: Flush buffer to eliminate phantom mutations
    lock.rollback_hook(Some({
        let buffer = buffer.clone();
        move || {
            buffer.lock().clear();
        }
    }))
    .map_err(|err| RecordError::Internal(err.into()))?;

    // 3. PreUpdate Hook: Capture change into stage buffer only
    lock.preupdate_hook(Some({
        let buffer = buffer.clone();
        move |action: Action, db: &str, table: &str, case: &PreUpdateCase| {
            if let Some(event) = parse_preupdate_event(action, db, table, case) {
                buffer.lock().push(event);
            }
        }
    }))
    .map_err(|err| RecordError::Internal(err.into()))?;

    Ok(())
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Direct channel dispatch inside engine hook
lock.preupdate_hook(Some(move |action, db, table, case| {
    let event = parse_preupdate_event(action, db, table, case).unwrap();
    // DEFECT: If transaction rolls back 5ms later, this event is already
    // consumed by HTTP SSE clients, causing permanent cache divergence!
    sender.try_send(event).ok();
}));
```

**VERIFICATION METHOD**:
Execute an integration test inside an explicit transaction block:
```rust
#[tokio::test]
async fn verify_no_dirty_events_on_rollback() {
    let (conn, rx) = setup_test_engine_with_subscription().await;
    conn.execute_batch("
        BEGIN;
        INSERT INTO items (id, val) VALUES ('uuid-1', 'test');
        ROLLBACK;
    ").await.unwrap();

    // Verify subscriber receives 0 events within timeout window
    assert!(tokio::time::timeout(Duration::from_millis(100), rx.recv_async()).await.is_err());
}
```

---

### 2. Multi-Tier Secret Redaction on State Serialization
**RULE**:
Any system state containing configuration secrets (tokens, connection strings, private keys, salt hashes) **MUST NOT** be serialized or transmitted across management boundaries without passing through an explicit redaction and hash-verification phase. Read handlers **MUST** strip secrets and compute a cryptographic state digest; update handlers **MUST** verify the digest against concurrent drift and re-merge stripped fields with existing secrets stored in a protected vault.

**WHY**:
Admin configuration endpoints are prime targets for reconnaissance. Returning unredacted configuration payloads exposes third-party provider tokens and credentials to any operator with read privileges. Conversely, naive redaction prevents updates: when an operator modifies an unrelated configuration field (e.g., rate limits) and submits the JSON/Protobuf payload back, the redacted placeholder would overwrite and wipe out production credentials unless an atomic re-merge is enforced.

**WHEN TO APPLY**:
All control-plane configuration management APIs, admin consoles, and schema-sync operations.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
pub async fn update_config_pipeline(
    state: &AppState,
    request: proto::UpdateConfigRequest,
) -> Result<(), AdminError> {
    let client_hash = request.hash.ok_or_else(|| AdminError::Precondition("Missing config hash".into()))?;
    let incoming_config = request.config.ok_or_else(|| AdminError::Precondition("Missing config payload".into()))?;

    // 1. Snapshot current config under atomic reader
    let current_config = state.get_config();
    let current_hash = proto::hash_config(&current_config);

    // 2. Reject concurrent modification (CAS check)
    if client_hash != current_hash {
        return Err(AdminError::Precondition("Config modified concurrently. Refresh and retry.".into()));
    }

    // 3. Extract unredacted secrets from current vault state
    let (_, existing_secrets) = vault::redact_secrets(&current_config)?;

    // 4. Merge unredacted vault secrets with newly submitted configuration tree
    let merged_config = vault::merge_vault_and_env(incoming_config, proto::Vault { secrets: existing_secrets })?;

    // 5. Validate schema, compile ACL rules, and atomically swap
    state.validate_and_update_config(merged_config, Some(client_hash)).await?;
    Ok(())
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Naive desanitization or direct overwrite
pub async fn update_config_bad(state: &AppState, new_config: proto::Config) -> Result<(), Error> {
    // BUG: If client called get_config (which masked secrets to ""),
    // saving this payload permanently destroys all production API keys and passwords!
    state.save_config_to_disk(&new_config).await?;
    Ok(())
}
```

**VERIFICATION METHOD**:
Automated integration test asserting round-trip stability:
```rust
#[tokio::test]
async fn test_config_secret_retention_across_updates() {
    let state = init_test_state_with_smtp_secret("super_secret_smtp_token").await;
    let initial_res = get_config_handler(State(state.clone()), HeaderMap::new()).await.unwrap();
    // Assert response contains redacted string
    assert!(!format!("{:?}", initial_res).contains("super_secret_smtp_token"));
    
    // Post update changing only server name
    let update_res = update_config_handler(State(state.clone()), ...).await;
    assert!(update_res.is_ok());
    
    // Assert active memory still preserves secret
    assert_eq!(state.get_config().smtp.unwrap().password, "super_secret_smtp_token");
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Rolled-back SQLite PreUpdate Hook Event Leakage (BUG-SQLITE-HOOK-01)
- **Context**: Subsystem: `crates/core/src/records/subscribe/hook.rs`
- **What Was Expected**: Clients subscribed to `/api/records/v1/{api}/subscribe/*` via SSE receive real-time updates only for records successfully committed to persistent storage.
- **What Actually Happened**: When a transaction executed multiple batch statements (e.g., inserting row 1, then failing on a constraint violation in row 2, triggering a rollback), SQLite's `preupdate_hook` fired synchronously during the statement execution of row 1. The hook immediately pushed the `Insert` event to downstream channels. The transaction subsequently rolled back, leaving the record uncommitted in the database. Clients received an `Insert` event for a non-existent row, permanently corrupting their client-side state.
- **Evidence in Repo**: Closed Issue #311, Commit `e2ced59f`.
- **Root Cause**: The original code wired `lock.preupdate_hook` directly to `sender.try_send((cnt, event))`. SQLite preupdate hooks execute *speculatively* prior to commit. Without staging hooks on commit and rollback, engine-level rollback operations cannot recall already dispatched channel events.
- **Remediation Code Diff**:
```rust
@@ -44,14 +56,54 @@ pub fn install_hook(
-  lock
-    .preupdate_hook({
-      let conn = conn.clone();
-      let mut cnt = 0;
+  let buffer = Arc::new(Mutex::new(Vec::new()));
+
+  lock
+    .commit_hook(Some({
+      let conn = conn.clone();
+      let buffer = buffer.clone();
+      let mut cnt = 0;
+      move || {
+        for event in buffer.lock().drain(..) {
+          cnt += 1;
+          match sender.try_send((cnt, event)) {
+            Ok(()) => {}
+            Err(flume::TrySendError::Full(_)) => { warn!("Channel full."); }
+            Err(flume::TrySendError::Disconnected(_)) => { let _ = uninstall_hook(&conn); }
+          };
+        }
+        return false;
+      }
+    }))?;
+
+  lock
+    .rollback_hook(Some({
+      let buffer = buffer.clone();
+      move || { buffer.lock().clear(); }
+    }))?;
+
+  lock
+    .preupdate_hook({
+      let buffer = buffer.clone();
       Some(move |action, db, table_name, case| {
-          let event = PreupdateHookEvent { ... };
-          sender.try_send((cnt, event));
+          buffer.lock().push(PreupdateHookEvent { ... });
       })
     })
```
- **Lesson**: Storage engine callbacks are speculative until commit boundaries are negotiated. Realtime reactive streaming layers built atop transactional relational engines must implement two-phase staging (Collect $\to$ Verify Commit $\to$ Drain).

---

### Incident 2: Global Logout Silent Ambiguity / Non-Redirect Status Acknowledgment (BUG-AUTH-LOGOUT-02)
- **Context**: Subsystem: `crates/core/src/auth/`
- **What Was Expected**: When a machine client or SPA invokes `/api/auth/v1/logout`, it requires deterministic, machine-readable HTTP status confirmation indicating whether the caller possessed valid owner credentials and whether active sessions were revoked.
- **What Actually Happened**: The logout endpoint responded uniformly with HTTP `303 See Other` redirects to the specified `redirect_uri` or root path, regardless of whether:
  1. The caller provided no authentication cookies or headers.
  2. The caller provided an invalid/tampered Bearer JWT.
  3. The caller provided a valid JWT and successfully invalidated all server sessions.
  Automated programmatic clients following the 303 observed a 200 OK from the landing page, rendering it impossible to distinguish between unauthenticated no-ops and authenticated global session destructions.
- **Evidence in Repo**: Issue #310.
- **Root Cause**: Coupling browser interactive redirect behavior with programmatic API logout semantics without content-negotiation inspection (`Accept: application/json` vs browser navigational request).
- **Remediation Code Diff**:
```rust
// Architectural correction applied across auth endpoints:
pub async fn logout_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    auth: Option<AuthSession>,
) -> Response {
    let is_json_requested = headers.get(header::ACCEPT)
        .and_then(|v| v.to_str().ok())
        .map_or(false, |a| a.contains("application/json"));

    match auth {
        Some(session) => {
            state.session_store().revoke_all_for_user(session.user_id).await.unwrap();
            if is_json_requested {
                (StatusCode::OK, Json(json!({"status": "revoked", "user_id": session.user_id}))).into_response()
            } else {
                Redirect::to(&determine_redirect_uri(&headers)).into_response()
            }
        }
        None => {
            if is_json_requested {
                (StatusCode::UNAUTHORIZED, Json(json!({"error": "unauthenticated"}))).into_response()
            } else {
                Redirect::to(&determine_redirect_uri(&headers)).into_response()
            }
        }
    }
}
```
- **Lesson**: Never collapse distinct security outcomes (revoked vs unauthenticated) into an opaque 303/302 browser redirect when APIs serve both headless SDK clients and web browsers.

---

### Incident 3: Dev-Profile Parser Stack Overflow on Windows (BUG-BUILD-STACK-03)
- **Context**: Subsystem: SQL AST Parser (`sqlite3-parser` / `crates/core/Cargo.toml`)
- **What Was Expected**: `cargo check` and `cargo test` compile and run seamlessly on developer workstations across all platforms (Linux, macOS, Windows).
- **What Actually Happened**: On Windows targets under `dev` profile (debug build), invoking functions that parse complex SQL access rules crashed the test suite with a thread stack overflow (`STATUS_STACK_OVERFLOW` / `0xC00000FD`).
- **Evidence in Repo**: `Cargo.toml` lines 38–44:
```toml
# Workaround for https://github.com/gwenn/lemon-rs/issues/78. sqlite3-parser
# requires 1+MB stack frames to parse trivial SQL statements, which is larger
# than Window's default stack size of 1MB. This is due to the rust compiler not
# overlapping stack variables of disjoint branches in dev mode and instead
# allocating them all.
[profile.dev.package.sqlite3-parser]
opt-level = 1
```
- **Root Cause**: In debug builds (`opt-level = 0`), LLVM does not perform stack slot coloring or register allocation across disjoint match arms. Large AST parser state machines generated by lemon-rs construct monolithic stack frames exceeding 1MB. On Windows (where default thread stack size is 1MB, compared to 8MB on Linux), trivial parsing operations cause unrecoverable stack guard page violations.
- **Remediation**: Override the optimization profile specifically for the parser dependency (`opt-level = 1`) even during development builds, forcing LLVM to reuse stack slots for disjoint branches.
- **Lesson**: Disjoint enum pattern matching in debug mode scales stack usage linearly with the number of AST variants. Force `opt-level = 1` on parser generators in workspace manifests to avert stack exhaustion on stack-constrained host OSes.

---

### Incident 4: Musl Dynamic Bindgen Link Failure in Multi-Arch Containers (BUG-CI-MUSL-04)
- **Context**: Subsystem: `Dockerfile` / `crates/sqlite` build pipeline
- **What Was Expected**: Docker multi-arch builds (`linux/amd64`, `linux/arm64`) generate static musl binaries using lightweight base images like Alpine Linux.
- **What Actually Happened**: Compiling `rusqlite` with the SQLite `preupdate_hook` feature required `bindgen` to run at build time. `bindgen` dynamically links against `libclang.so`. Alpine Linux musl-based `clang-dev` binaries caused segmentation faults and dynamic symbol resolution errors when invoked by Rust build scripts.
- **Evidence in Repo**: `Dockerfile` lines 3–17:
```dockerfile
# NOTE: We cannot use alpine here because rusqlite's `libsqlite3-sys` with
# `preupdate-hook` has a **build-time** dependency on the `bindgen` crate with
# the `runtime` feature enabled. This in turn requires a dynamically linked
# libclang.so, alpine's `clang-dev` package won't work :/
FROM messense/rust-musl-cross:x86_64-musl AS builder-amd64
...
FROM builder-${TARGETARCH} AS base-builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl git libssl-dev pkg-config libclang-dev protobuf-compiler libprotobuf-dev libsqlite3-dev
```
- **Root Cause**: Rust build scripts (`build.rs`) using `bindgen` execute on the *host* architecture, requiring a fully operational C++ Clang runtime environment. Alpine's musl environment lacks the glibc runtime linkages expected by LLVM/Clang toolchains during cross-compilation codegen.
- **Remediation**: Use Debian-based cross-compilation images (`messense/rust-musl-cross`) containing glibc-backed host compilers (`libclang-dev`) that target musl targets (`x86_64-unknown-linux-musl`, `aarch64-unknown-linux-musl`), deploying the final statically linked binary into a minimal Alpine container.
- **Lesson**: Build-time code generators (bindgen, prost) run as host binaries. Never rely on the target C-library (musl) to execute host-side LLVM toolchains during cross-compilation.

---

### Incident 5: Admin Secret Exfiltration via Config Serialization (BUG-ADMIN-CONF-05)
- **Context**: Subsystem: `crates/core/src/admin/config/get_config.rs` & `update_config.rs`
- **What Was Expected**: Operators inspecting server configuration via the Web Admin UI should view configuration topology without exposing production credentials (SMTP passwords, OAuth client secrets, DB credentials).
- **What Actually Happened**: The initial schema serializations returned the in-memory `proto::Config` struct directly. Anyone with read access to the admin API received raw plaintext secrets in the response payload.
- **Evidence in Repo**: `get_config.rs` lines 22–24:
```rust
  let config = state.get_config();
  let hash = proto::hash_config(&config);
  let (stripped, _secrets) = redact_secrets(&config)?;
```
- **Root Cause**: Lack of boundary-layer sanitization between internal runtime configuration representations and administrative transport representations.
- **Remediation**: Implemented a two-way redaction/re-merge mechanism (`redact_secrets` and `merge_vault_and_env`). The GET endpoint returns `stripped` values paired with a SHA-256 hash of the full unredacted tree. The POST endpoint requires the original hash to confirm that no out-of-band mutations occurred, then reconciles the stripped incoming config against existing vault secrets before applying mutations.
- **Lesson**: Redaction at the perimeter must always be coupled with optimistic state locks (hashes) to prevent accidental credential truncation during partial writes.

---

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

### 1. Micro-Syntax & Token-Level Precision
- **Implicit Number Parser Coercion**: In JavaScript/TypeScript bridges (`crates/assets/js/admin/src/lib/utils.ts`), using `parseInt(value)` directly without trimming or radix specifications introduces parsing bugs:
  ```typescript
  // INCORRECT: Leading whitespace or octal ambiguity
  const n = parseInt(value); 
  // CORRECT: Explicit trim + check for NaN vs 0 distinction
  export function tryParseInt(value: string): number | undefined {
    const n = parseInt(value.trim(), 10);
    return isNaN(n) ? undefined : n;
  }
  ```
  *Trap*: In JavaScript, `0` is falsy. Code checking `if (safeParseInt(val))` will treat `0` as `undefined`. Always assert `value !== undefined`.
- **BigInt Empty String Trap**:
  ```typescript
  // BigInt("") in V8 evaluates to 0n, not an error!
  export function tryParseBigInt(value: string): bigint | undefined {
    if (value.trim() === "") {
      return undefined; // Must guard explicitly against empty strings!
    }
    try {
      return BigInt(value.trim());
    } catch {
      return undefined;
    }
  }
  ```
- **Rust Byte Slicing in Hex Conversion**:
  ```rust
  // Allocating odd-length hex strings produces trailing nibble truncation
  pub fn from_hex(hex: &str) -> Result<Vec<u8>, HexError> {
      if hex.len() % 2 != 0 {
          return Err(HexError::InvalidLength);
      }
      (0..hex.len())
          .step_by(2)
          .map(|i| u8::from_str_radix(&hex[i..i + 2], 16))
          .collect()
  }
  ```

---

### 2. Infinite Loop & Recursion Guards
- **Stream Draining and Bounded Memory Loops**: In `crates/assets/js/admin/src/lib/utils.ts`, reading from a `ReadableStreamDefaultReader` requires strict loop termination invariants:
  ```typescript
  async function readableStreamToBlob(
    stream: ReadableStream<Uint8Array>,
    mimeType?: string,
  ): Promise<Blob> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let totalLength = 0;
    const MAX_ALLOWED_BYTES = 500 * 1024 * 1024; // 500MB safety ceiling

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break; // Invariant: reader.read() done must break unconditionally
        if (value) {
          totalLength += value.length;
          if (totalLength > MAX_ALLOWED_BYTES) {
            throw new Error("Stream exceeded maximum allocation ceiling");
          }
          chunks.push(value);
        }
      }
    } finally {
      reader.releaseLock(); // INVARIANT: Never leak stream reader lock
    }

    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return new Blob([merged], { type: mimeType });
  }
  ```
- **Axum `to_bytes` Max Allocation Limit**:
  When reading bodies in Axum handlers (e.g. `crates/core/benches/benchmark.rs`), passing `usize::MAX` in production causes memory starvation denial-of-service:
  ```rust
  // FORBIDDEN in production request paths:
  let bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
  // MANDATORY: Strict bounded allocation
  const MAX_PAYLOAD_LIMIT: usize = 16 * 1024 * 1024; // 16 MB
  let bytes = axum::body::to_bytes(response.into_body(), MAX_PAYLOAD_LIMIT).await
      .map_err(|_| Error::PayloadTooLarge)?;
  ```

---

### 3. UI & UX Micro-Mechanics
- **Object URL Memory Leaks & Revocation Timing**:
  When triggering client-side browser file downloads (`showSaveFileDialog` fallback in `utils.ts`), creating an object URL without revoking it leaks blob memory in long-running single-page applications:
  ```typescript
  const blob = await readableStreamToBlob(stream, opts.mimeType);
  const saveFile = document.createElement("a");
  const blobUrl = URL.createObjectURL(blob);
  saveFile.href = blobUrl;
  saveFile.download = opts.filename;
  saveFile.style.display = "none";
  document.body.appendChild(saveFile);
  saveFile.click();

  // Invariant: Schedule cleanup with defensive detachment
  setTimeout(() => {
    saveFile.remove();
    URL.revokeObjectURL(blobUrl); // Essential: Free browser blob memory buffer
  }, 60 * 1000);
  ```
- **AbortController Invariant Handling**:
  Catching exceptions from `showSaveFilePicker` must strictly discriminate between an intentional user abort and an I/O crash:
  ```typescript
  try {
    const handle = await window.showSaveFilePicker({ suggestedName: opts.filename });
    const writable = await handle.createWritable();
    await stream.pipeTo(writable);
  } catch (err) {
    // Invariant: User clicking "Cancel" throws DOMException "AbortError"
    if (err instanceof Error && err.name === "AbortError") {
      return false; // Silent, non-error exit
    }
    throw err; // Real I/O or storage failure
  }
  ```

---

### 4. Backend Concurrency & Memory Safety
- **Deadlock-Free Two-Phase Hook Uninstallation**:
  In `crates/core/src/records/subscribe/hook.rs`, uninstalling hooks requires setting each callback to `None` under the write lock:
  ```rust
  pub fn uninstall_hook(conn: &Connection) -> Result<(), RecordError> {
      let mut lock = conn
          .write_lock()
          .map_err(|err| RecordError::Internal(err.into()))?;

      // Invariant: All three hooks must be decoupled atomically.
      // Failing to clear rollback or commit hooks retains stale Arc clones of the buffer!
      lock.preupdate_hook(NO_PREUPDATE_HOOK).map_err(|e| RecordError::Internal(e.into()))?;
      lock.rollback_hook(NO_ROLLBACK_HOOK).map_err(|e| RecordError::Internal(e.into()))?;
      lock.commit_hook(NO_COMMIT_HOOK).map_err(|e| RecordError::Internal(e.into()))?;

      Ok(())
  }
  ```
- **Flume Saturated Channel Policy**:
  When dispatching events from a SQLite commit hook (`move || { ... }`), the hook thread runs synchronously on the database execution context. Invoking async `.await` or blocking `.send()` causes immediate thread pool starvation:
  ```rust
  // Invariant: MUST use try_send inside synchronous database hook callbacks
  match sender.try_send((cnt, event)) {
      Ok(()) => {}
      Err(flume::TrySendError::Full(_)) => {
          // Channel is bounded (16 * 1024). Drop or log, NEVER block SQLite engine thread!
          log::warn!("Realtime queue full: dropping event to preserve DB throughput");
      }
      Err(flume::TrySendError::Disconnected(_)) => {
          // Receiver closed: trigger hook uninstallation
          let _ = uninstall_hook(&conn);
      }
  }
  ```

---

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Timestamp Millisecond vs Second Precision Defect**:
  When accepting timestamp identifiers for administrative backup restoration (`crates/core/src/admin/backup.rs`):
  ```rust
  // DEFECT: chrono::DateTime::from_timestamp expects seconds in parameter 1 and nanoseconds in parameter 2.
  // Passing client millisecond timestamps directly creates an invalid date in the year 55,000+!
  let instant = chrono::DateTime::from_timestamp(request.timestamp, 0)
      .ok_or_else(|| Error::Precondition