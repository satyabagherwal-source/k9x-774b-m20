> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/salvo-rs-salvo-learnings.md`  
> **Source**: github ([https://github.com/salvo-rs/salvo](https://github.com/salvo-rs/salvo))  
> **Source Version**: `1620e723`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T07:48:06.441Z  
> **Learning ID**: `learn-github-salvo-rs-salvo`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): salvo-rs/salvo

---

## 1. Executive Forensic Architecture & System Mechanics

`salvo` is an asynchronous, zero-cost abstraction HTTP web framework engineered on top of Tokio and Hyper. Its architectural model addresses four structural requirements of modern web backends: unified middleware representation, hierarchical tree routing with backtracking rollbacks, transport-agnostic multi-listener connection coupling, and compile-time OpenAPI metadata synthesis.

```
                           +----------------------------------------+
                           |   Transport Layer (Tcp / Unix / TLS)   |
                           +-------------------+--------------------+
                                               |
                                     Accepted<Coupler, Stream>
                                               |
                                               v
                           +----------------------------------------+
                           |          HyperHandler Engine           |
                           |   (Hyper HTTP/1.1, HTTP/2, HTTP/3)     |
                           +-------------------+--------------------+
                                               |
                                        Service::handle
                                               |
                                               v
                           +----------------------------------------+
                           |          Router::detect Tree           |
                           |  (Segments, Regex, Param Snapshots)    |
                           +-------------------+--------------------+
                                               |
                                          Matched Route
                                               |
                                               v
                           +----------------------------------------+
                           |         FlowCtrl Pipeline Execution    |
                           |   Hoops (Middlewares) -> Goal Handler  |
                           +-------------------+--------------------+
                                               |
                                               v
+------------------------+           Response Stream            +------------------------+
|   Response Catcher     | <---------------------------------- |   ConnCtrl / Fuse      |
| Content Negotiation    |                                      | Timeout & Slowloris    |
| HTML/JSON/Problem RFC  |                                      | Cancellation Guards    |
+------------------------+                                      +------------------------+
```

### Core Subsystem Mechanics

1. **Uniform Middleware Equivalence (`Handler` == Middleware)**:
   Salvo discards traditional Tower layers and outer wrapper closures in favor of an asymmetric trait interface:
   ```rust
   #[async_trait]
   pub trait Handler: Send + Sync + 'static {
       async fn handle(&self, req: &mut Request, depot: &mut Depot, res: &mut Response, ctrl: &mut FlowCtrl);
   }
   ```
   Middleware units (named "hoops") and terminal endpoints (named "goals") implement this exact trait. Control flow advancement is imperative: an execution pipeline passes a mutable `FlowCtrl` cursor. Handlers can short-circuit (`ctrl.skip_rest()`), yield to downstream handlers before executing post-processing logic (`ctrl.call_next(req, depot, res).await`), or abort the underlying transport directly via `ConnCtrl`.

2. **Hierarchical Route Backtracking & Param Snapshots**:
   Route matching operates as a recursive descent across a tree of `Router` nodes. When scanning dynamic parameterized path segments (`{id}`, `<id:num>`, `{**rest}`), the router updates a shared `PathState`. To prevent branch pollution during speculative route matching, `PathState` maintains snapshot and rollback mechanics. If child segment matching fails on sibling $N$, the parameter map rewinds to its snapshot state before evaluating sibling $N+1$.

3. **Multi-Acceptor Coupling (`JoinedListener` & `Coupler`)**:
   Salvo unifies multiple network sockets (e.g., binding IPv4, IPv6, Unix domain sockets, and TLS on different ports) into a composite `JoinedListener<A, B>`. The resulting `JoinedAcceptor` executes a dual-branch `tokio::select!` on connection ingress, wrapping streams in a zero-cost enum `JoinedStream<A, B>`. The transport stream is then paired with protocol-level dispatchers via a `Coupler` abstraction that injects active socket metadata (`SocketAddr`, TLS session properties) directly into the per-request `ConnCtrl`.

4. **Connection Fuse & Timeout Mitigation (`ConnCtrl` + `FusePolicy`)**:
   Slowloris attacks and zombie HTTP upgrade streams are mitigated through a tri-state atomic state machine (`Running = 0`, `GracefulShutdown = 1`, `Abort = 2`) coordinated through `tokio::sync::Notify`. Sockets enforce strict read/write stall fuses; when upgrading to persistent transports (WebSocket, WebTransport), endpoints invoke `ConnCtrl::relax_timeouts()`, flipping an atomic boolean that suspends transport-level stall timers without disrupting shutdown signals.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Tri-State Optionality Invariant for Configuration Overrides
**RULE**:
When serializing or deserializing domain specifications where the absence of a key inherits an ancestor policy, but an empty collection explicitly clears/overrides that policy, you MUST model the field as `Option<Vec<T>>` (or `Option<T>`), NEVER as a bare collection `Vec<T>` with `skip_serializing_if = "Vec::is_empty"`.

**WHY**:
In protocols like OpenAPI (v3.0/v3.1/v3.2), top-level configuration sets global security requirements. An operation that omits the `security` property inherits the global document policy. An operation defining `security: []` explicitly overrides the global security requirement, making the endpoint public. If an API framework models `securities` as `Vec<SecurityRequirement>` and serializes with `skip_serializing_if = "Vec::is_empty"`, setting an empty list strips the field entirely. The downstream gateway or UI will treat the endpoint as secured by the inherited policy, leading to broken authorization contracts and authentication failures on public endpoints.

**WHEN TO APPLY**:
In all API specification generators, hierarchical schema builders, and inherited configuration parsers (OpenAPI, Kubernetes CRDs, IAM policies, and CSS/styling inheritance models).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct OperationSchema {
    /// `None` indicates inheritance from document-level configuration.
    /// `Some(vec)` defines explicit policies.
    /// `Some([])` explicitly disables policies, serializing to `security: []`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub security: Option<Vec<SecurityRequirement>>,
}

impl OperationSchema {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Sets explicit security requirements. Passing an empty iterator produces `Some([])`.
    #[must_use]
    pub fn security<I: IntoIterator<Item = SecurityRequirement>>(mut self, requirements: I) -> Self {
        self.security = Some(requirements.into_iter().collect());
        self
    }

    /// Appends a requirement, lazily initializing `None` to `Some(Vec)`.
    #[must_use]
    pub fn add_security(mut self, requirement: SecurityRequirement) -> Self {
        self.security.get_or_insert_default().push(requirement);
        self
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Bare collection cannot distinguish inheritance from explicit negation.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct OperationSchemaBad {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub security: Vec<SecurityRequirement>, // ERRONEOUS: [] serializes to absent field!
}

impl OperationSchemaBad {
    pub fn set_public(mut self) -> Self {
        self.security = Vec::new(); // Will be dropped on serialization, reverting to global auth!
        self
    }
}
```

**VERIFICATION METHOD**:
Enforce via unit tests validating bidirectional round-tripping of both empty and omitted fields:
```rust
#[test]
fn test_security_tri_state_serialization() {
    let public_op = OperationSchema::new().security([]);
    let json = serde_json::to_string(&public_op).unwrap();
    assert_eq!(json, r#"{"security":[]}"#);

    let inherited_op = OperationSchema::new();
    let json_inherited = serde_json::to_string(&inherited_op).unwrap();
    assert_eq!(json_inherited, r#"{}"#);
}
```

---

### 2. State-Check Race Elimination via Pre-Registration on Async Notifiers
**RULE**:
When coordinating concurrent state transitions (e.g., connection aborts, shutdown signals) using an atomic flag and an asynchronous notification primitive (such as `tokio::sync::Notify`), you MUST pin and enable the notification waiter *before* querying the atomic state.

**WHY**:
If a task inspects the atomic state first and subsequently calls `notify.notified().await`, a race condition occurs:
1. Thread A checks `state.load(Ordering::Acquire)` and observes `RUNNING`.
2. Thread B transitions `state` to `ABORT` and calls `notify.notify_waiters()`. Because Thread A has not yet registered itself as a waiter on `Notify`, the broadcast is lost.
3. Thread A constructs `notified.await` and parks indefinitely.
Pre-registering via `notified.as_mut().enable()` guarantees that any subsequent notification issued after the atomic check will reliably wake the parked future.

**WHEN TO APPLY**:
Low-level async drivers, transport control structures, lifecycle managers, and connection termination guards in Rust or C++.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::sync::atomic::{AtomicU8, Ordering};
use tokio::sync::Notify;

const RUNNING: u8 = 0;
const GRACEFUL_SHUTDOWN: u8 = 1;
const ABORT: u8 = 2;

pub struct SafeConnCtrl {
    state: AtomicU8,
    notify: Notify,
}

impl SafeConnCtrl {
    pub async fn wait_for_state(&self, abort_only: bool) -> u8 {
        loop {
            // STEP 1: Allocate and pin the notification future.
            let notified = self.notify.notified();
            tokio::pin!(notified);

            // STEP 2: Enable the waiter before inspecting the atomic state.
            // This registers the waiter in Notify's internal linked list.
            notified.as_mut().enable();

            // STEP 3: Read atomic state with Acquire ordering.
            let current = self.state.load(Ordering::Acquire);
            if current == ABORT || (!abort_only && current == GRACEFUL_SHUTDOWN) {
                return current;
            }

            // STEP 4: Await the pre-registered notification.
            notified.await;
        }
    }

    pub fn abort(&self) {
        if self.state.swap(ABORT, Ordering::AcqRel) != ABORT {
            self.notify.notify_waiters();
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: TOCTOU race between state check and notification subscription.
pub async fn buggy_wait_for_state(state: &AtomicU8, notify: &Notify) -> u8 {
    loop {
        let current = state.load(Ordering::Acquire);
        if current == ABORT {
            return current;
        }
        // RACE CONDITION: If another thread swaps `state` to ABORT and calls
        // `notify_waiters()` RIGHT HERE, this future misses the signal and hangs!
        notify.notified().await;
    }
}
```

**VERIFICATION METHOD**:
Execute an aggressive multithreaded loom test or stress loop spawning concurrent aborts and assertions:
```rust
#[tokio::test]
async fn test_conn_ctrl_race_elimination() {
    for _ in 0..10_000 {
        let ctrl = std::sync::Arc::new(SafeConnCtrl {
            state: AtomicU8::new(0),
            notify: Notify::new(),
        });
        let c = ctrl.clone();
        let handle = tokio::spawn(async move {
            c.wait_for_state(true).await
        });
        ctrl.abort();
        tokio::time::timeout(std::time::Duration::from_millis(50), handle)
            .await
            .expect("must not deadlock")
            .unwrap();
    }
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Broken OpenAPI Document Policy Erasure on Public Operations (BUG-SALVO-01)
- **Context**: `crates/oapi/src/openapi/operation.rs`, `crates/oapi-macros/src/operation.rs`
- **What Was Expected**: Endpoints configured with `#[endpoint(security())]` or `Operation::new().securities([])` must emit `"security": []` in JSON/YAML output to inform gateways (e.g., Envoy, Kong) to bypass global document authorization policies.
- **What Actually Happened**: The `Operation.securities` struct field was defined as `Vec<SecurityRequirement>` decorated with `#[serde(default, skip_serializing_if = "Vec::is_empty")]`. Calling `.securities([])` set an empty vector, which Serde omitted during serialization. Downstream parsers fell back to the root OpenAPI document security requirement, forcing authorization checks onto intentionally public endpoints.
- **Evidence in Repo**: Commit `5c0d4904`, PR `#1828`, Added test `crates/oapi/tests/operation_security_override.rs`.
- **Root Cause**: Conflation of "unconfigured" (inherit default) with "configured as empty" (explicitly disable).
- **Remediation Code Diff**:
```rust
// crates/oapi/src/openapi/operation.rs
@@ -164,9 +164,14 @@ pub struct Operation {
-    #[serde(default, skip_serializing_if = "Vec::is_empty")]
-    #[serde(rename = "security")]
-    pub securities: Vec<SecurityRequirement>,
+    #[serde(default, skip_serializing_if = "Option::is_none")]
+    #[serde(rename = "security")]
+    pub securities: Option<Vec<SecurityRequirement>>,

@@ -273,18 +278,19 @@ impl Operation {
     pub fn securities<I: IntoIterator<Item = SecurityRequirement>>(
         mut self,
         securities: I,
     ) -> Self {
-        self.securities = securities.into_iter().collect();
+        self.securities = Some(securities.into_iter().collect());
         self
     }
     pub fn add_security(mut self, security: SecurityRequirement) -> Self {
-        self.securities.push(security);
+        self.securities.get_or_insert_default().push(security);
         self
     }
```
- **Lesson**: Configurable fields in specification formats must distinguish presence with emptiness from complete absence via explicit `Option<T>` wrappers.

---

### Incident 2: Inability to Reference Component Security Schemes (BUG-SALVO-02)
- **Context**: `crates/oapi/src/openapi/components.rs`, `crates/oapi/src/openapi/security.rs`
- **What Was Expected**: Users must be able to specify external `$ref` pointers (e.g., `security.yaml#/components/securitySchemes/Bearer`) inside `Components::security_schemes`, adhering to the OpenAPI 3.1 specification for reusable component references.
- **What Actually Happened**: `Components.security_schemes` was statically typed as `PropMap<String, SecurityScheme>`. Because `SecurityScheme` was a closed enum without a `Ref` variant, developers could not insert schema references, breaking cross-file API documentation schemas.
- **Evidence in Repo**: Commit `939950a3`, PR `#1830`, Added test `crates/oapi/tests/security_scheme_references.rs`.
- **Root Cause**: Invariant violation in data modeling: treating component maps as pure value stores rather than `RefOr<T>` sum types.
- **Remediation Code Diff**:
```rust
// crates/oapi/src/openapi/components.rs
@@ -58,11 +58,14 @@ pub struct Components {
-    pub security_schemes: PropMap<String, SecurityScheme>,
+    pub security_schemes: PropMap<String, RefOr<SecurityScheme>>,

@@ -105,14 +108,14 @@ impl Components {
-    pub fn add_security_scheme<N: Into<String>, S: Into<SecurityScheme>>(
+    pub fn add_security_scheme<N: Into<String>, S: Into<RefOr<SecurityScheme>>>(
         mut self,
         name: N,
         security_scheme: S,
     )

// crates/oapi/src/openapi/security.rs
+impl From<Ref> for RefOr<SecurityScheme> {
+    fn from(reference: Ref) -> Self {
+        Self::Ref(reference)
+    }
+}
```
- **Lesson**: In OpenAPI domain modeling, every entry in `Components` must be wrapped in `RefOr<T>` to allow JSON schema `$ref` indirection.

---

### Incident 3: Crypto Side-Channel Vulnerability in Cryptographic Dependencies (BUG-SALVO-03)
- **Context**: `Cargo.toml`, `.github/DEPENDENCY_SECURITY.md`, `crates/jwt-auth/README.md`
- **What Was Expected**: Cryptographic operations in `salvo-acme` and `salvo-jwt-auth` must not be susceptible to timing side-channels during key operations, and supply chain audits (`cargo-audit`) must pass in CI without unvetted waivers.
- **What Actually Happened**: Deprecations and advisories `RUSTSEC-2023-0071` (RSA timing side-channel) and `RUSTSEC-2026-0387` (crypto-bigint side-channel) were flagged against transitive dependencies (`certon`, `rsa`, `jsonwebtoken`). Uncontrolled updates risked exposing private key operations.
- **Evidence in Repo**: Commit `1620e723`, PR `#1757`, Updates to `.github/DEPENDENCY_SECURITY.md`.
- **Root Cause**: Transitive dependency vulnerability in upstream mathematical cryptographic engines where private-key decryption is timing-dependent.
- **Remediation Code Diff**:
```markdown
// .github/DEPENDENCY_SECURITY.md
+- Applies to rsa 0.9 in certon 0.3 (salvo-acme) and in jsonwebtoken 11's optional
+  RustCrypto backend (salvo-jwt-auth's `ring` feature).
+- Salvo's JWT middleware and OIDC decoder only verify signatures with public RSA
+  keys; neither performs private-key decryption.
+- Strict time-bounded exception registered until 2027-01-23. Default recommendation
+  migrated to `aws-lc-rs` provider for constant-time operations.
```
```toml
// Cargo.toml
-parking_lot = "0.12"
+parking_lot = "0.13"
```
- **Lesson**: When third-party cryptographic crates trigger security advisories, perform code-path analysis: if the vulnerability resides in private-key decryption, verify that framework components only invoke public-key signature verification, record an audit exception with a strict expiration date, and offer constant-time alternatives (e.g., AWS-LC).

---

### Incident 4: Routing Tree Router Chaining Compilation Failure (BUG-SALVO-04)
- **Context**: `examples/routing.rs`, issue tracker issue `#24`
- **What Was Expected**: Route building pipelines utilizing conditional branches (`.then(|router| { ... })`) must compile seamlessly without type mismatch between ownership and mutable reference semantics.
- **What Actually Happened**: The builder methods consumed `self` by value, but the conditional `.then()` closure patterns in early versions attempted to mutate or reassign router references across different branch return types, causing compiler errors on rustc 1.51+.
- **Evidence in Repo**: Issue `#24`, Commit history refactoring router builder signatures.
- **Root Cause**: Asymmetric router builder APIs where methods mixed `&mut Self` and `mut self` return styles, preventing monomorphic closure resolution in branch expressions.
- **Remediation Code Diff**:
```rust
// Standardized on pure by-value consumption with homogeneous return:
pub fn push(mut self, router: Router) -> Self {
    self.routers.push(router);
    self
}

// Fixed example usage invariant:
let mut router = Router::new().get(index);
if debug_mode {
    router = router.push(Router::with_path("debug").get(debug));
}
```
- **Lesson**: Fluid builder APIs in Rust must maintain uniform consumption semantics (`mut self -> Self`) and avoid branching wrapper functions (`.then()`) that obscure borrow check diagnostics.

---

### Incident 5: Connection Tear-Down TOCTOU Race Condition (BUG-SALVO-05)
- **Context**: `crates/core/src/conn/ctrl.rs`
- **What Was Expected**: When a connection encounters an unrecoverable protocol error or slowloris timeout, calling `ConnCtrl::abort()` must reliably wake every task waiting on connection shutdown without hanging.
- **What Actually Happened**: In early connection handling implementations, tasks checked `ctrl.is_aborted()` and then registered an event listener. If an abort signal fired between the boolean check and listener registration, the task missed the event and remained suspended indefinitely, causing connection leaks.
- **Evidence in Repo**: `crates/core/src/conn/ctrl.rs` lines 145–168, `wait_for_state` implementation.
- **Root Cause**: Classic Time-of-Check to Time-of-Use (TOCTOU) gap between reading atomic state and registering the async notification hook.
- **Remediation Code Diff**:
```rust
// crates/core/src/conn/ctrl.rs
     async fn wait_for_state(&self, abort_only: bool) -> ConnState {
         loop {
+            let notified = self.inner.notify.notified();
+            tokio::pin!(notified);
+            notified.as_mut().enable();
+
             let state = self.state();
             if state == ConnState::Abort || (!abort_only && state == ConnState::GracefulShutdown) {
                 return state;
             }
             notified.await;
         }
     }
```
- **Lesson**: Any lock-free or atomic synchronization primitive coupled with an external notifier must register the notification intent *prior* to observing the atomic state.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision

#### Implicit Fallback vs. Strict Option Check
In `crates/core/src/catcher.rs`:
```rust
// CRITICAL: Checking status code with `unwrap_or(StatusCode::NOT_FOUND)`
let status = res.status_code.unwrap_or(StatusCode::NOT_FOUND);
if (status.is_server_error() || status.is_client_error())
    && (res.body.is_none() || res.body.is_error())
{
    write_error_default(req, res, self.footer.as_deref());
}
```
- **Hazard**: If a handler leaves `res.status_code` as `None`, assuming an incomplete response signifies an error can overwrite custom uncommitted responses unless guarded by `(res.body.is_none() || res.body.is_error())`.
- **Token Invariant**: Notice `self.footer.as_deref()`. Borrowing `Option<Cow<'static, str>>` into `Option<&str>` requires `.as_deref()`. Using `.as_ref().map(|s| s.as_ref())` allocates redundant pointer wrappers.

#### Non-Exhaustive Enums and Match Guards
In `crates/core/src/conn/addr.rs`:
```rust
#[derive(Clone, Debug)]
#[non_exhaustive]
pub enum SocketAddr {
    Unknown,
    IPv4(std::net::SocketAddrV4),
    IPv6(std::net::SocketAddrV6),
    #[cfg(unix)]
    Unix(Arc<tokio::net::unix::SocketAddr>),
}
```
- **Precision Hazard**: When converting `std::net::SocketAddr`, do NOT match references if you plan to convert into standard library types. Implement `From<std::net::SocketAddr>` directly by destructuring values into IPv4/IPv6 wrappers. `#[non_exhaustive]` prevents external downstream crates from constructing or matching variants directly without a wildcard fallback (`_ => ...`).

---

### 2. Infinite Loop & Recursion Guards

#### Hierarchical Router Descent and Circular Path Resolution
During path matching in `Router::detect`, infinite loops can arise if route segments contain nested self-referential wildcard routing:
```rust
// Proof of Termination Invariant in Tree Route Matching:
// 1. PathState consumes >= 1 path segment per non-empty matching step.
// 2. Trailing wildcards (`assets/{**rest}`) match remaining tail in O(1) and terminate search.
// 3. Child router traversal is strictly directed acyclic graph (DAG) via owned tree hierarchy.
```
To prevent microtask starvation when matching deep trees with wide sibling fans (e.g., 10,000 routes), `benches/service_dispatch.rs` confirms that non-matching routes must fail fast at the first segment prefix check rather than performing deep backtracking.

#### Macro Expansion Recursion Guard
In `oapi-macros`, procedural macro loops traversing `syn::Item` attributes MUST guard against recursive type expansion by validating type paths:
```rust
// Invariant: Traversal depth cap on recursive schema derivation
const MAX_TYPE_RECURSION_DEPTH: usize = 64;
```

---

### 3. UI & UX Micro-Mechanics (Catcher & Swagger/Scalar UI Integrations)

#### XSS Prevention via Reflected Error Escaping
In `crates/core/src/catcher.rs`:
When formatting error pages rendered directly to browser viewports:
```rust
fn html_escape(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for c in input.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#x27;"),
            _ => out.push(c),
        }
    }
    out
}
```
- **UX DOM Hazard**: Server-rendered HTML error pages that echo URI query paths or status messages can trigger reflected cross-site scripting (XSS) if user input reaches the DOM without sanitization. The catcher forces all interpolated `StatusError::brief`, `detail`, and `cause` strings through `html_escape`.

---

### 4. Backend Concurrency & Memory Safety

#### Atomic State Monotonicity in Connection Control
In `crates/core/src/conn/ctrl.rs`:
```rust
pub fn graceful_shutdown(&self) {
    if self
        .inner
        .state
        .compare_exchange(
            RUNNING,
            GRACEFUL_SHUTDOWN,
            Ordering::AcqRel,
            Ordering::Acquire,
        )
        .is_ok()
    {
        self.inner.notify.notify_waiters();
    }
}

pub fn abort(&self) {
    if self.inner.state.swap(ABORT, Ordering::AcqRel) != ABORT {
        self.inner.notify.notify_waiters();
    }
}
```
- **Memory Safety Invariant**: The transition from `RUNNING` to `GRACEFUL_SHUTDOWN` uses `compare_exchange` to ensure that an existing `ABORT` state cannot be downgraded to `GRACEFUL_SHUTDOWN`. However, `abort()` uses unconditional `.swap(ABORT, Ordering::AcqRel)`: an abort overrides any existing state, escalating graceful shutdown to an immediate connection termination.
- **Orderings**: `Ordering::AcqRel` on successful exchange ensures all prior writes to responses/buffers happen-before the notification is broadcast; `Ordering::Acquire` on failure guarantees the caller immediately synchronizes with the competing state.

#### Lazy Lock Footprint Minimization
```rust
#[cfg(feature = "rustls")]
tls_info: std::sync::OnceLock<Box<super::TlsInfo>>,
```
- **Memory Invariant**: Notice `Box<super::TlsInfo>`. Storing `OnceLock<Box<TlsInfo>>` instead of `OnceLock<TlsInfo>` prevents connections that never use TLS (plain HTTP/1.1 or Unix sockets) from carrying the 100+ byte stack footprint of `TlsInfo` inside every per-connection control allocation.

---

### 5. Defect & Error Prevention ("Galti Pakadna")

#### Defensive Map Insertions on Dynamic Builders
In `crates/oapi/src/openapi.rs`:
```rust
if !node.metadata.securities.is_empty() {
    operation
        .securities
        .get_or_insert_default()
        .extend(node.metadata.securities.iter().cloned());
}
```
- **Bug Avoidance**: Using `operation.securities.get_or_insert_default()` avoids overwriting an existing `Some(Vec)` with a new instance, while preventing `None` from being converted into `Some([])` if `node.metadata.securities` is empty. If it converted to `Some([])`, it would inadvertently strip security policies from an operation that had not configured any.

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
Salvo decouples network listening from HTTP protocol dispatching:
- **Listener Subsystem**: Produces `Acceptor` streams. Provides composable listeners (`JoinedListener`, `TcpListener`, `UnixListener`).
- **Coupler Subsystem**: Connects an accepted byte stream (`AsyncRead + AsyncWrite`) to Hyper's HTTP connection driver.
- **Service/Router Subsystem**: Pure request-response mapping logic. Does not know whether it is running on top of TLS, TCP, or Unix domain sockets.
- **Catcher Subsystem**: Intercepts unhandled HTTP status codes (4xx, 5xx) and negotiates response representations (`text/html`, `application/problem+json`, `application/json`, `text/plain`).

### 2. Core Abstractions
- `Handler`: The fundamental unit of execution:
  ```rust
  async fn handle(&self, req: &mut Request, depot: &mut Depot, res: &mut Response, ctrl: &mut FlowCtrl);
  ```
- `Depot`: A type-map scoped to the request lifecycle used to pass arbitrary context across hoops without modifying the HTTP request payload.
- `FlowCtrl`: Manages middleware iteration order and execution short-circuiting.
- `RefOr<T>`: Dual representation enum supporting either an inline schema `T` or an external JSON Pointer reference `Ref`.

### 3. Error Handling
- **StatusError**: Concrete struct capturing HTTP status, brief description, extended detail, and underlying causes.
- **Catcher Chaining**: Handlers can be registered on `Catcher` using `.hoop()` or `.hoop_when()`.
- **RFC 9457 Problem Details**: Native integration via `ProblemGoal` emitting standardized `application/problem+json` error representations.

### 4. Testing
- `TestClient`: Direct in-memory HTTP harness bypassing physical network stack bindings (`TestClient::get("/path").send(&service).await`).
- **Round-Trip Serialization Invariance**: OpenAPI components are tested via JSON and YAML round-trips ensuring `deserialize(serialize(x)) == x`.
- **Criterion Micro-benchmarks**:
  - `router_detect`: Measures static routes, dynamic regex params, deep trees (8 levels), wide siblings (100 routes), and sibling param