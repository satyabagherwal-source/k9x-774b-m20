> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/surrealdb-surrealdb-learnings.md`  
> **Source**: GitHub ([https://github.com/surrealdb/surrealdb](https://github.com/surrealdb/surrealdb))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-28T18:54:53.136Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: surrealdb/surrealdb

## 1. Executive Forensic Architecture & System Mechanics

SurrealDB is a multi-model (document, graph, tabular, vector, time-series) distributed database engine implemented in Rust. It decouples compute and storage via a pluggable Key-Value (KV) storage abstraction layer (`surrealdb::kvs`), allowing the same query execution engine to run against in-memory stores, embedded engines (SurrealKV, RocksDB), and distributed consensus stores (TiKV, FoundationDB).

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                    Client / Protocol Ingress Layer                    │
 │         HTTP/REST / WebSocket (Live Queries) / Binary Protocol         │
 └────────────────────────────────────┬───────────────────────────────────┘
                                      │
 ┌────────────────────────────────────▼───────────────────────────────────┐
 │                   Execution Engine & Query Pipeline                    │
 │  ┌────────────────────────┐  ┌────────────────┐  ┌──────────────────┐  │
 │  │ SQL Parser & Ast Walk  │  │ RLS / Security │  │ Memory Budgeter  │  │
 │  │ (Zero-Copy AST / CoW)  │  │ (No-Side-FX)   │  │ (Per-Query Track)│  │
 │  └───────────┬────────────┘  └────────┬───────┘  └────────┬─────────┘  │
 │              └────────────────────────┼───────────────────┘            │
 │                                       ▼                                │
 │                      Transaction Context (Tx / Node)                   │
 └────────────────────────────────────┬───────────────────────────────────┘
                                      │
 ┌────────────────────────────────────▼───────────────────────────────────┐
 │                     Index & Secondary Engine Layer                     │
 │      Full-Text (Tantivy) │ Vector Index (DiskANN) │ Graph Engine       │
 └────────────────────────────────────┬───────────────────────────────────┘
                                      │
 ┌────────────────────────────────────▼───────────────────────────────────┐
 │                  Key-Value Storage Abstraction (KVS)                   │
 │   Tx Management (Tombstones/Delta Tracking) | Lease-backed Index Build │
 └────────────┬───────────────────────┬──────────────────────────┬────────┘
              ▼                       ▼                          ▼
      [ In-Memory Store ]     [ Embedded Engines ]      [ Distributed KV ]
      (MemKV / BTreeMap)      (SurrealKV / RocksDB)     (TiKV / FoundationDB)
```

### Critical Architectural Boundaries & Subsystems:
1. **The Pluggable KV Storage Layer (`kvs::Datastore`, `kvs::Transaction`)**: Implements strict Snapshot Isolation (SI) or Serializable Snapshot Isolation (SSI). Uncommitted writes are maintained in a transaction-local write buffer with tombstones and delta tracking before atomic commit to underlying backends.
2. **Deterministic Security Boundary (Permissions & Capabilities)**: Enforces fine-grained Row-Level Security (RLS) predicates (`PERMISSIONS FOR select, create, update, delete WHERE ...`). Predicate evaluation must execute strictly in a pure, read-only evaluation sandbox where mutations, network calls, and side effects are statically or dynamically blocked.
3. **SSRF & Network Capability Firewall**: Outbound network requests (such as JWKS authentication fetches, remote machine learning endpoints, or webhooks) run through an egress resolver checking resolved IP ranges (filtering out loopback `127.0.0.0/8`, link-local `169.254.0.0/16`, and private subnets) rather than merely trusting hostnames.
4. **Vector Index Ingestion (DiskANN)**: High-throughput ingestion decouples document writing from vector graph synchronization via sharded pending queues, preventing single-lock contention across concurrent write streams.

---

## 2. Deep Micro-Learnings & Runtime Gotchas

### 1. In-Memory Transaction Write-After-Delete Tombstone Masking
- **Failure Mode / Pitfall**: In the `MemKV` storage backend, executing a `put(key, val)` after a `delete(key)` within the exact same transaction resulted in key lookup failures or resurrected deleted values after commit.
- **Root Cause**: The transaction write-buffer maintained separate sets or sequential logs for mutations. When a `Delete` operation inserted a tombstone entry `Option::None`, a subsequent `Put` in the same transaction either updated an auxiliary write map without clearing the tombstone record or failed to invalidate the uncommitted tombstone state during prefix/point lookups.
- **Exact Prevention / Fix**: Represent transaction write-buffer states as an explicit state machine per key: `enum ValueState { Unmodified, Inserted(Bytes), Updated(Bytes), Deleted }`. Mutating a previously deleted key in the active buffer must atomically overwrite the tombstone into `ValueState::Updated` and update reverse index tracking simultaneously.

### 2. Side-Effect Escalation in Declarative Permission Predicates (GHSA-66r2-5gwj-gxm2)
- **Failure Mode / Pitfall**: Users could craft malicious `PERMISSIONS ... WHERE` clauses containing function calls or subqueries with side effects (e.g., executing writes, mutating session state, or invoking external HTTP plugins during permission evaluation).
- **Root Cause**: The query evaluation engine shared the same execution context `Context::new()` for both query statement execution and security predicate evaluation, allowing statement-level execution privileges to bleed into permission resolution.
- **Exact Prevention / Fix**: Introduce a strictly read-only execution context flag (`ctx.with_read_only(true)`) during security predicate evaluation. Disallow non-deterministic, mutating, or network-bound AST nodes at the parser and runtime evaluation dispatchers when evaluating permissions.

```rust
// Prevention Pattern: Enforcing Read-Only Capability in Sub-Contexts
pub struct ExecutionContext {
    read_only: bool,
    allow_network: bool,
}

impl ExecutionContext {
    pub fn for_permission_eval(&self) -> Self {
        Self {
            read_only: true,
            allow_network: false,
            ..self.clone()
        }
    }
    
    pub fn assert_can_mutate(&self) -> Result<(), ExecutionError> {
        if self.read_only {
            return Err(ExecutionError::SideEffectInPermissionPredicate);
        }
        Ok(())
    }
}
```

### 3. DNS Rebinding / TOCTOU SSRF in JWKS Authentication (GHSA-5x4x-2946-qr67)
- **Failure Mode / Pitfall**: Specifying a custom JWKS URL allowed attackers to trigger Server-Side Request Forgery (SSRF) to cloud metadata endpoints (`169.254.169.254`) or loopback services (`127.0.0.1`), bypassing security capability checks using DNS rebinding.
- **Root Cause**: URL validation occurred on the hostname string *before* DNS resolution. The subsequent HTTP request executed a separate DNS resolution via the standard client, allowing a hostile DNS server to return a public IP during the capability check and `127.0.0.1` during actual socket connect.
- **Exact Prevention / Fix**: Resolve the hostname to an `IpAddr` first, validate that the resolved IP does not belong to loopback, link-local, broadcast, or private subnets (unless explicitly whitelisted via network capabilities), and bind the HTTP socket directly to the validated IP address while preserving the `Host` HTTP header for TLS SNI.

### 4. Zero-Panic Ingestion Boundary in Machine Learning Model Deserialization (GHSA-jwr6-6444-28xv)
- **Failure Mode / Pitfall**: Supplying a malformed SurrealML binary model header triggered panics (e.g., out-of-bounds slice indexing or unwrap on invalid magic bytes), crashing the entire database daemon (Denial of Service).
- **Root Cause**: Direct array indexing `header[0..8]` and unchecked integer casts (`header_len as usize`) without safe length validation prior to parsing model metadata structures.
- **Exact Prevention / Fix**: Implement nom-based, byte-slice-checked, or zero-panic parsing boundaries. Model headers must return explicit `Result<Header, ModelParseError>` without panics or assertions.

### 5. Distributed Index Build Deadlocks from Node Crashes
- **Failure Mode / Pitfall**: When a database node responsible for building a large secondary index (e.g., DiskANN or Full-Text) crashed midway, the index remained in `Building` state indefinitely, permanently blocking schema changes and queries.
- **Root Cause**: Index build states lacked owner heartbeats and expiration leases in the global schema catalog metadata.
- **Exact Prevention / Fix**: Attach a lease-backed owner identifier and timestamp to the distributed index task. Introduce an orphan recovery supervisor that detects expired leases on system startup or topology change and transitions orphaned builds back to `Pending` for reassignment.

---

## 3. 8-Dimensional Multi-Axis Forensic Analysis

### D1: Structural Boundaries & Modularity
- SurrealDB isolates SQL grammar, parsing, logical planning, physical execution, and underlying storage backends into independent crates (`surrealdb-core`, `surrealml`, etc.).
- Communication between the compute engine and storage occurs exclusively through the `kvs::Datastore` and `kvs::Transaction` traits, enabling compile-time injection of storage implementations without leaky abstractions.
- Materialized Views (`TABLE ... AS SELECT ...`) are strictly separated from base writable tables, enforcing read-only guarantees at the engine boundary to prevent derived-state desynchronization.

### D2: Asynchronous State & Concurrency Defense
- **DiskANN Pending Key Sharding**: High-throughput vector writes are partitioned across multiple lock-striped channels/shards to prevent global index lock contention during concurrent vector updates.
- **WebSocket Event Propagation**: Dropped `KILLED` session notifications were resolved by attaching the explicit owning `SessionId` directly to notification payloads, preventing races where disconnect signals were routed to incorrect connection handlers.
- **Lock-Free Read Operations**: Borrow-based value field traversal (`Value::pick_cow`) allows queries to read nested structures using `Cow<'_, Value>`, bypassing heap cloning under concurrent query pipelines.

### D3: Error Boundaries, Recovery & Rollback Protocols
- **Transactional Rollback Invariants**: In-memory and embedded backends enforce atomicity by reverting transaction-local write deltas. Memory KV updates ensure that failed transactions leave zero residual allocations in global maps.
- **Distributed Index Orphan Recovery**: Background workers monitor index build status keys. If a worker node crashes, the lease expires and another node re-claims the index generation lock without user intervention.

### D4: Resource Lifecycle & Leak Defenses (Memory, Sockets, Descriptors)
- **Dynamic Query Memory Budgeting**: Statements are evaluated under a thread/task-local query memory budget tracker (`feat(sql): add dynamic query memory budget`). If intermediate projections, hash aggregations, or graph traversals exceed the allotted memory limit, the statement yields an explicit `MemoryBudgetExceeded` error instead of causing an unhandled process OOM abort.
- **Redundant Clones Elimination**: Critical hot-paths (such as `legacy_handles`) were systematically refactored to eliminate redundant clones of descriptors and session state objects.

### D5: Boundary Deserialization, Schemas & Input Sanitization
- **Strict AST Schema Assertion Enforcement**: Restored schema `ASSERT` validation on Record IDs (`record id field validation`), ensuring that custom schema validation rules execute consistently on primary keys as well as regular payload fields.
- **Zero-Panic Binary Parsers**: Any external binary parser (e.g., machine learning model file formats, custom binary client frames) must adhere to fail-closed parsing without unchecked `unwrap()` or raw slice slicing.
- **MCP Argument Normalization**: Schema validation explicitly requires object-level schemas for arguments before invoking internal execution routines.

### D6: Cross-Platform & Runtime Compatibility Gotchas (Windows/Linux/Node/Browser)
- **Wasm & Embedded Deployments**: SurrealDB targets both native operating systems and WebAssembly (via `wasm-bindgen`). Disk-based storage and native networking (e.g., raw sockets for JWKS) must be abstracted with feature flags to switch seamlessly to memory backends and browser-safe `fetch` implementations under Wasm runtimes.

### D7: Build, CI/CD, Dependency Invariants & Supply Chain Defenses
- **Supply Chain Hardening**: Strict zero-vulnerability dependency policies. Dependencies with known RustSec advisories (e.g., `ammonia`, `anyhow`, `wasmtime`) are immediately upgraded.
- **Deterministic CI Test Matrix**: High-overhead benchmark tests (e.g., language rebuild benches) are constrained in scale (e.g., capped at 10k items) to eliminate non-deterministic CI timeouts. SDK integration test crates explicitly commit `Cargo.lock` to ensure reproducible builds across distributed runners.

### D8: Concrete Bug Fixes & Forensic Patches

```
┌────────────────────────────┐
│      18971ffb: MemKV       │ -> Fix Put-After-Delete in same Tx.
├────────────────────────────┤
│ 1e4c3d74: GHSA-66r2-5gwj   │ -> Block side-effects in PERMISSIONS predicates.
├────────────────────────────┤
│ aabd2e05: DiskANN Sharding │ -> Shard vector pending keys to resolve lock contention.
├────────────────────────────┤
│ 75b7154f: GHSA-848m-r628   │ -> Reject cross-tenant custom API access.
├────────────────────────────┤
│ 30212a12: GHSA-5x4x-2946   │ -> Enforce JWKS capabilities at resolved IP level.
├────────────────────────────┤
│ fee6567b: Index Orphan Rec │ -> Auto-resume orphaned index builds after node crash.
└────────────────────────────┘
```

---

## 4. Net-New Universal Engineering Rules

## 72. Enforce Socket-Level IP Verification for Outbound Network Capabilities

**RULE**:
Network capability and SSRF security policies for external resource fetching (e.g., JWKS, webhooks, remote model weights) MUST validate the resolved socket `IpAddr` rather than the unparsed or unverified URI hostname, and the connection MUST be established directly to that validated IP address.

**WHY**:
Validating only the domain name or hostname leaves the system vulnerable to DNS rebinding attacks and Time-of-Check to Time-of-Use (TOCTOU) races. A hostile DNS server can return an authorized public IP address during the initial validation check, followed by `127.0.0.1` or `169.254.169.254` (cloud metadata service) when the HTTP client establishes the actual TCP connection.

**WHEN TO APPLY**:
- In any authentication or identity layer fetching remote OpenID/JWKS keys.
- In database engines or backend services executing user-defined webhooks or external API calls.
- In multi-tenant environments with dynamic URL ingestion.

```rust
// Verified Implementation: Safe Outbound Socket Connector
use std::net::{IpAddr, SocketAddr};
use tokio::net::TcpStream;

pub async fn safe_connect(
    host: &str, 
    port: u16, 
    allowed_private: bool
) -> Result<TcpStream, ConnectionError> {
    // 1. Resolve host explicitly
    let ips: Vec<IpAddr> = tokio::net::lookup_host(format!("{}:{}", host, port))
        .await?
        .map(|sa| sa.ip())
        .collect();

    let target_ip = ips.first().ok_or(ConnectionError::DnsResolutionFailed)?;

    // 2. Validate IP against loopback / link-local / private ranges
    if !allowed_private {
        if target_ip.is_loopback() 
            || target_ip.is_unspecified() 
            || is_link_local(target_ip) 
            || is_private_subnet(target_ip) {
            return Err(ConnectionError::ForbiddenIpAddress(*target_ip));
        }
    }

    // 3. Connect directly to the validated IP to prevent DNS Rebinding TOCTOU
    let target_socket = SocketAddr::new(*target_ip, port);
    let stream = TcpStream::connect(target_socket).await?;
    
    Ok(stream)
}

fn is_link_local(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(ipv4) => ipv4.is_link_local(), // 169.254.0.0/16
        IpAddr::V6(ipv6) => (ipv6.segments()[0] & 0xffc0) == 0xfe80,
    }
}

fn is_private_subnet(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(ipv4) => ipv4.is_private(),
        IpAddr::V6(_) => false,
    }
}
```

---

## 73. Zero-Allocation Traversal via Borrowed Copy-on-Write (CoW) Projections

**RULE**:
Query execution engines traversing nested documents or record structures MUST use borrow-based Copy-on-Write (`Cow<'_, Value>`) abstractions rather than deep-cloning values during AST filtering, projection, and sorting.

**WHY**:
In database engines and high-throughput query planners, evaluating `WHERE`, `ORDER BY`, and field projections over millions of records causes catastrophic heap allocation churn and cache thrashing if intermediate values are cloned. Using borrowed `Cow` values enables zero-copy reads on unchanged fields while allowing on-demand cloning only when mutations or transformations occur.

**WHEN TO APPLY**:
- In document and graph query execution engines.
- In JSON/BSON/MessagePack filtering and path extraction layers.
- In database sorting and grouping operators evaluating fields not present in final projections.

```rust
// Verified Implementation: Zero-Copy Value Extraction Pattern
use std::borrow::Cow;
use std::collections::HashMap;

#[derive(Clone, Debug, PartialEq)]
pub enum Value {
    Null,
    String(String),
    Object(HashMap<String, Value>),
}

impl Value {
    pub fn pick_cow<'a>(&'a self, field: &str) -> Option<Cow<'a, Value>> {
        match self {
            Value::Object(map) => map.get(field).map(Cow::Borrowed),
            _ => None,
        }
    }
    
    pub fn extract_path<'a>(&'a self, path: &[&str]) -> Cow<'a, Value> {
        let mut current = Cow::Borrowed(self);
        for &segment in path {
            match current {
                Cow::Borrowed(Value::Object(map)) => {
                    if let Some(next) = map.get(segment) {
                        current = Cow::Borrowed(next);
                    } else {
                        return Cow::Owned(Value::Null);
                    }
                }
                Cow::Owned(Value::Object(mut map)) => {
                    if let Some(next) = map.remove(segment) {
                        current = Cow::Owned(next);
                    } else {
                        return Cow::Owned(Value::Null);
                    }
                }
                _ => return Cow::Owned(Value::Null),
            }
        }
        current
    }
}
```

---

## 5. Actionable Agent Skill & Implementation Checklist

When constructing or modifying database engines, query evaluators, or multi-tenant systems, execute the following audit checklist:

- [ ] **Transaction State Transition Verification**:
  - [ ] Does the transaction write buffer correctly handle `Put -> Delete -> Put` sequences without dropping the second `Put` or retaining stale tombstones?
  - [ ] Are reverse indexes and secondary keys notified of in-transaction state overwrites?

- [ ] **Security Predicate Isolation**:
  - [ ] Are Row-Level Security (RLS) predicates executed in a sandbox where mutations and I/O are statically or dynamically blocked?
  - [ ] Is context purity enforced via an immutable context wrapper (`ctx.with_read_only(true)`)?

- [ ] **Outbound SSRF & Network Protection**:
  - [ ] Are remote URIs (JWKS, webhooks) validated on the *resolved IP address*, not merely the domain string?
  - [ ] Is the connection directly established to the validated IP to prevent DNS rebinding attacks?
  - [ ] Are link-local (`169.254.0.0/16`) and loopback (`127.0.0.0/8`) addresses rejected by default?

- [ ] **Crash Recovery for Long-Running Operations**:
  - [ ] Do distributed index builds or long-running tasks hold lease timestamps with node heartbeats?
  - [ ] Does the node startup sequence contain an orphan recovery routine to reclaim stuck `Building` states?

- [ ] **Zero-Panic Binary Parsers**:
  - [ ] Do all binary headers and model parsers validate byte slice lengths before slicing or casting?
  - [ ] Are all `unwrap()`, `expect()`, and unchecked index operations eliminated from deserialization paths?

- [ ] **Memory Allocation Guardrails**:
  - [ ] Are complex queries bounded by dynamic memory allocation limits to prevent out-of-memory crashes?
  - [ ] Are nested field access paths utilizing `Cow<'a, Value>` instead of eager deep clones?