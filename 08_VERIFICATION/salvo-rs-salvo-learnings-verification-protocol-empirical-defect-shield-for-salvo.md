# Verification Protocol: Verification Protocol: Empirical Defect Shield for salvo-rs-salvo-learnings

<!-- PROVENANCE_START
{
  "source_repository": "salvo-rs-salvo-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:44:16.184Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-salvo-rs-salvo-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [salvo-rs-salvo-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:44:16.184Z`  
> **Learning ID**: `LEARN-REEXTRACT-salvo-rs-salvo-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `salvo-rs-salvo-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/salvo-rs-salvo-learnings.md`  
> **Source**: github ([https://github.com/salvo-rs/salvo](https://github.com/salvo-rs/salvo))  
> **Source Version**: `b695140a`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-12T08:31:54.356Z  
> **Learning ID**: `learn-github-salvo-rs-salvo`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): salvo-rs/salvo

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Technical Problem Solved
Salvo (`salvo-rs/salvo`) is an asynchronous, high-throughput Rust web framework engineered to bridge the performance gap between zero-cost async network abstractions (Tokio/Hyper) and developer ergonomics. 

Historically, Rust web frameworks force an architectural trade-off:
1. Pure hyper/tower services require deeply nested generic types (`Service<Request<B>, Response = Response<ResBody>>`), type-erased service layers, or manual pin-projection machinery.
2. Macro-heavy or dynamic frameworks introduce hidden allocations, monomorphization code bloat, inflexible routing boundaries, and rigid middleware pipelines that cannot mutate control flow dynamically without aborting the entire HTTP connection.

Salvo solves this by implementing:
- **Unified Handler-Hoop Paradigm:** Middleware and leaf route handlers share an identical trait interface:
  ```rust
  #[async_trait]
  pub trait Handler: Send + Sync + 'static {
      async fn handle(&self, req: &mut Request, depot: &mut Depot, res: &mut Response, ctrl: &mut FlowCtrl);
  }
  ```
- **Dynamic Tree-Based Routing with Linear Sibling Backtracking:** Match routes across arbitrary prefixes, regex constraints, and wildcards (`assets/{**rest}`) using hierarchical routers with fine-grained parameter backtracking (`PathState`).
- **Asynchronous Transport Coupling & Admission Control:** A transport abstraction (`Coupler`, `Listener`, `Acceptor`, `JoinedListener`) managing multi-protocol multiplexing (HTTP/1.1, HTTP/2 via Hyper, HTTP/3 via Quinn/H3) and defense against resource exhaustion (slowloris, write stalls) via an explicit connection lifecycle state machine (`ConnCtrl`).

```
                    +-------------------------------------------------------------+
                    |                       Transport Layer                       |
                    |  [TcpListener]   [UnixListener]   [Rustls/NativeTls/Openssl] |
                    +------------------------------+------------------------------+
                                                   |
                                            .bind().await
                                                   |
                                                   v
                    +-------------------------------------------------------------+
                    |                 Acceptor & Admission Control                |
                    | - PendingAdmission<T> (holds transport during cancellation) |
                    | - FusePolicy (evaluates fuse timer rules, slowloris guard)   |
                    | - ConnCtrl (state: RUNNING | GRACEFUL_SHUTDOWN | ABORT)     |
                    +------------------------------+------------------------------+
                                                   |
                                             .accept().await
                                                   |
                                                   v
                    +-------------------------------------------------------------+
                    |                     Protocol Coupler                        |
                    | - HyperHandler (Hyper I/O <-> Salvo Service bridge)         |
                    | - UpgradeScope (WebSocket/Tunnel task lifecycle draining)   |
                    +------------------------------+------------------------------+
                                                   |
                                             Dispatch HTTP
                                                   |
                                                   v
+----------------------------------------------------------------------------------------------------+
|                                      Service & Routing Pipeline                                     |
|                                                                                                    |
|   Request URI ---> Router::detect(&mut req, &mut state)                                            |
|                         |                                                                          |
|                         +---> Traverses Route Tree                                                 |
|                         |       |-- Evaluates PathState slice / rollback on match failure           |
|                         |       \-- Captures dynamic parameters into Request::params               |
|                         |                                                                          |
|                         v                                                                          |
|                   Matched Handler Tree                                                             |
|                         |                                                                          |
|                         +---> Flattens Hoops (Root Hoops -> Branch Hoops -> Leaf Hoops)            |
|                         |                                                                          |
|                         v                                                                          |
|                   FlowCtrl Execution Pipeline:                                                     |
|                   [ Hoop 1 ] ---> [ Hoop 2 (Auth) ] ---> [ Goal Handler ]                          |
|                         ^                 |                                                        |
|                         |                 +---> ctrl.skip_rest() (Bypasses Goal)                   |
|                         |                 +---> ctrl.yield_handler() (Re-enters on unwind)         |
|                         |                                                                          |
|                         v                                                                          |
|                   Error Catching / Catcher Goal:                                                   |
|                   If status is 4xx/5xx and body is empty:                                          |
|                   Content-Negotiation (JSON / HTML / XML / Plain) or RFC 9457 ProblemGoal          |
+----------------------------------------------------------------------------------------------------+
```

### Architectural Subsystem Boundaries
1. **`salvo_core::conn`**: Manages low-level socket handles, TLS engines (`rustls`, `native-tls`, `openssl`), Unix domain sockets, and joined listeners. It enforces strict connection lifetime tracking via `ConnCtrl`.
2. **`salvo_core::routing`**: Encapsulates route pattern compilation, path state segmentation, linear backtracking over wide sibling nodes, and path parameter extraction.
3. **`salvo_core::catcher`**: Encapsulates post-routing HTTP failure modes. If an HTTP response has an error status code ($4xx$, $5xx$) and an empty body, it passes through a `Catcher` chain that applies content negotiation (`guess_accept_mime`) or renders RFC 9457 Problem Details.
4. **`salvo_core::fuse`**: Transport-level DOS defense. Intercepts read/write timeouts, tracks connection idleness, and drops dead connections while allowing legitimate long-running protocols (WebSockets/Tunnels) to relax timeouts via `conn_ctrl.relax_timeouts()`.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Invariant Connection Lifetime Separation Under HTTP Multiplexing
**RULE**:
Transport connections multiplexing multiple concurrent HTTP requests MUST NOT bind connection-level termination primitives directly to per-request lifecycles. Handlers MUST use an isolated, connection-level controller (`ConnCtrl`) that propagates state monotonically across states (`RUNNING` $\rightarrow$ `GRACEFUL_SHUTDOWN` $\rightarrow$ `ABORT`) without sharing cancellation permits across disparate physical streams.

**WHY**:
In HTTP/2 and HTTP/3, multiple logical requests share a single physical TCP/QUIC stream. If a request handler terminates the underlying transport prematurely (e.g., calling `abort` on a token shared across threads or recycling an `Arc<Atomic*>` from a pool), all concurrent request streams on that connection are torn down abruptly (`curl: (52) Empty reply from server`). Conversely, when performing protocol upgrades (e.g., HTTP/1.1 to WebSocket), the server must hold the underlying transport open and suspend idle/write-stall fuses (`relax_timeouts()`) while decoupling individual request timeouts.

**WHEN TO APPLY**:
Any async network engine multiplexing protocols (HTTP/2, HTTP/3, gRPC, multiplexed TCP framing) where request scopes are children of a persistent physical transport.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};
use tokio::sync::Notify;

const RUNNING: u8 = 0;
const GRACEFUL_SHUTDOWN: u8 = 1;
const ABORT: u8 = 2;

#[derive(Clone, Debug)]
pub struct ConnCtrl {
    inner: Arc<Inner>,
}

struct Inner {
    state: AtomicU8,
    notify: Notify,
    relax: AtomicBool,
}

impl ConnCtrl {
    #[must_use]
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Inner {
                state: AtomicU8::new(RUNNING),
                notify: Notify::new(),
                relax: AtomicBool::new(false),
            }),
        }
    }

    /// Monotonic state transition: RUNNING -> GRACEFUL_SHUTDOWN
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

    /// Monotonic escalation: ANY -> ABORT
    pub fn abort(&self) {
        if self.inner.state.swap(ABORT, Ordering::AcqRel) != ABORT {
            self.inner.notify.notify_waiters();
        }
    }

    /// Prevents TOCTOU races between state checks and waiter registration
    pub async fn wait_for_state(&self, abort_only: bool) -> u8 {
        loop {
            let notified = self.inner.notify.notified();
            tokio::pin!(notified);
            notified.as_mut().enable(); // Pre-register waiter before reading atomic state

            let state = self.inner.state.load(Ordering::Acquire);
            if state == ABORT || (!abort_only && state == GRACEFUL_SHUTDOWN) {
                return state;
            }
            notified.await;
        }
    }

    #[inline]
    pub fn relax_timeouts(&self) {
        self.inner.relax.store(true, Ordering::Relaxed);
    }

    #[inline]
    pub fn is_relaxed(&self) -> bool {
        self.inner.relax.load(Ordering::Relaxed)
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Direct CancellationToken reuse across multiplexed requests
// or naive boolean flags without atomic subscription synchronization.
pub struct BadTransportState {
    pub is_aborted: bool, // Non-atomic or improperly shared: TOCTOU race condition!
    pub cancel_token: tokio_util::sync::CancellationToken,
}

pub async fn handle_request(state: &BadTransportState) {
    if state.is_aborted { return; }
    // If another request triggers cancel_token on error, ALL requests on this
    // physical socket drop abruptly, breaking HTTP/2 multiplexing guarantees.
    state.cancel_token.cancel(); 
}
```

**VERIFICATION METHOD**:
Run an automated concurrency barrier test simulating concurrent in-flight requests on a single connection. Assert that an abort on Request A broadcasts state to the protocol driver, while Request B's graceful completion does not tear down Request C's WebSocket pipeline:
```rust
#[tokio::test]
async fn test_conn_ctrl_multiplex_isolation() {
    let ctrl = ConnCtrl::new();
    let ctrl_a = ctrl.clone();
    let waiter = tokio::spawn(async move { ctrl_a.wait_for_state(true).await });
    
    // Graceful shutdown must NOT trigger an abort-only waiter
    ctrl.graceful_shutdown();
    tokio::task::yield_now().await;
    assert!(!waiter.is_finished());

    // Abort escalation MUST trigger the abort waiter
    ctrl.abort();
    assert_eq!(waiter.await.unwrap(), ABORT);
}
```

---

### 2. Sibling Route Backtracking via Snapshot Restoration
**RULE**:
Hierarchical route matchers that allow siblings with dynamic variable capture (`{id}`, `{name}`) MUST take a lightweight cursor and parameter-count snapshot prior to descending into a sub-tree. If the sub-tree fails to match completely, the matcher MUST rollback both the unconsumed path slice and any injected request parameters before evaluating the next sibling.

**WHY**:
In tree-based HTTP routing, a router may have siblings like:
- Route 1: `/users/{id}/settings`
- Route 2: `/users/{name}`

When evaluating `/users/alice`:
1. The engine checks Route 1. Segment `/users` matches.
2. Segment `{id}` matches and extracts `id = "alice"`.
3. The next segment requires `/settings`, which fails because the request path ends.
Without snapshot rollback, the state retains `id = "alice"` and the cursor remains advanced. When Route 2 (`/users/{name}`) is evaluated, the parser either fails because the path cursor is at EOF or injects duplicate/corrupted route parameters into `Request::params`.

**WHEN TO APPLY**:
Prefix trees, trie matchers, and recursive descent routers parsing dynamic paths and wildcard segments.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
#[derive(Clone, Debug)]
pub struct PathState {
    pub unconsumed: String,
    pub captured_params: usize,
}

impl PathState {
    #[inline]
    pub fn snapshot(&self) -> (usize, usize) {
        (self.unconsumed.len(), self.captured_params)
    }

    #[inline]
    pub fn rollback(&mut self, snapshot: (usize, usize), raw_path: &str) {
        let (unconsumed_len, captured_params) = snapshot;
        // Restore cursor slice to exact length before branch evaluation
        self.unconsumed = raw_path[raw_path.len() - unconsumed_len..].to_string();
        self.captured_params = captured_params;
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Mutating request parameter collections in-place during 
// descent without recording rollback checkpoints.
fn bad_detect(router: &Router, req: &mut Request) -> bool {
    for child in &router.children {
        if child.matches_and_insert(req) { // Mutates req.params directly
            if bad_detect(child, req) {
                return true;
            }
            // Leak! Previous parameters inserted by child remain in req.params!
        }
    }
    false
}
```

**VERIFICATION METHOD**:
Implement criterion micro-benchmarks and unit tests validating that sibling route backtracking successfully rolls back parameters:
```rust
#[test]
fn test_backtrack_parameter_isolation() {
    let mut state = PathState { unconsumed: "alice".to_string(), captured_params: 0 };
    let snap = state.snapshot();
    
    // Simulate failed branch execution
    state.unconsumed = "".to_string();
    state.captured_params += 1;
    
    // Rollback
    state.rollback(snap, "alice");
    assert_eq!(state.unconsumed, "alice");
    assert_eq!(state.captured_params, 0);
}
```

---

### 3. Contextual Error Sanitization & Strict Content Negotiation
**RULE**:
HTTP Error Handlers (`Catchers`) MUST decouple internal error descriptions from client-visible responses unless explicit, non-default debug environment directives are active (`SALVO_STATUS_ERROR=force_detail`). Dynamic error bodies MUST escape markup when rendered into HTML templates to prevent reflected XSS.

**WHY**:
Unsanitized error outputs inadvertently leak stack traces, database schemas, internal paths, and crypto backend details. Interpolating user-supplied input or raw URI paths into standard HTML error templates allows attackers to execute Cross-Site Scripting (Reflected XSS) attacks via crafted error URLs.

**WHEN TO APPLY**:
Web framework error catchers, RFC 9457 problem detail serializers, and custom status code rendering middleware.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::borrow::Cow;

pub fn html_escape(input: &str) -> String {
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

pub fn render_html_error(status_code: u16, message: &str, footer: Option<&str>) -> String {
    let safe_message = html_escape(message);
    let safe_footer = footer.unwrap_or(r#"<a href="https://salvo.rs">salvo</a>"#);
    format!(
        r#"<!DOCTYPE html>
<html>
<head><title>{}</title></head>
<body>
<h1>Error {}</h1>
<p>{}</p>
<hr/>
<small>{}</small>
</body>
</html>"#,
        status_code, status_code, safe_message, safe_footer
    )
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Direct string formatting of unsanitized status error messages
// into HTML markup.
pub fn bad_render_error(status: u16, user_msg: &str) -> String {
    format!("<div><h1>Error: {}</h1><p>{}</p></div>", status, user_msg) 
    // Vulnerable to Reflected XSS when user_msg contains "<script>alert(1)</script>"
}
```

**VERIFICATION METHOD**:
Execute an automated assert checking for HTML entity replacement against payload inputs:
```rust
#[test]
fn test_html_error_escaping() {
    let payload = "<script>alert('xss')</script>";
    let rendered = render_html_error(500, payload, None);
    assert!(!rendered.contains("<script>"));
    assert!(rendered.contains("&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;"));
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Flawed CI Dependency Installer Invariant (BUG-SALVO-01)
- **Context**: `.github/workflows/security.yml`, `.github/workflows/release.yml`, and `.github/scripts/test_workflow_policy.py`
- **What Was Expected**: Automated dependency updates via Dependabot for `taiki-e/install-action` must explicitly preserve the `tool: cargo-audit` declaration so security audit jobs don't attempt to install default tools or fail in headless environments.
- **What Actually Happened**: When Dependabot updated `taiki-e/install-action` to commit hash `28bfb437c78d9b7ea8650351357e3eb8c0be2672`, the workflow lost explicit specification of which binary to pull, breaking downstream CI policy assertions and pre-release gates.
- **Evidence in Repo**: Commit `8adf9959`, PR #1871.
- **Root Cause**: The custom Python policy verification script (`test_workflow_policy.py`) asserts that every step using `taiki-e/install-action@*` must include a mapping containing `tool: cargo-audit`. When the GitHub Action reference was updated without specifying the inputs, the policy validator aborted the build pipeline.
- **Remediation Code Diff**:
```diff
--- a/.github/workflows/security.yml
+++ b/.github/workflows/security.yml
@@ -39,7 +39,9 @@ jobs:
     steps:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
       - uses: dtolnay/rust-toolchain@b725eda525362e7cf34af9a7243cac1e3f01a7ec # stable
-      - uses: taiki-e/install-action@f84dff0ad3f25ff0e5dc531e626734a4e7d11ac7 # cargo-audit
+      - uses: taiki-e/install-action@28bfb437c78d9b7ea8650351357e3eb8c0be2672 # cargo-audit
+        with:
+          tool: cargo-audit
```
- **Lesson**: Meta-testing CI/CD workflows using an in-repo unit testing harness (`test_workflow_policy.py`) guarantees that dependency updater bots cannot alter workflow invariants, omit mandatory security flags, or introduce duplicate keys.

---

### Incident 2: Router Macro & Lifetime Compilation Breakage in Example Code (BUG-SALVO-02)
- **Context**: `examples/routing.rs` and `salvo_core::routing::Router`
- **What Was Expected**: Route construction using chaining combinators (`.then(|router| ...)`) and procedural macros (`#[fn_handler]`) must compile cleanly with standard Rust compiler editions and allow dynamic configuration toggles (e.g., `debug_mode`, `admin_mode`).
- **What Actually Happened**: Users encountered compile-time failures in `examples/routing.rs` on rustc versions (e.g., 1.51.0). The `.then()` closure consumed `self` by-value while handler signatures expected mutable borrowed responses (`res: &mut Response`) under macro transformations that were not yet unified with the `Handler` trait.
- **Evidence in Repo**: Closed Bug Issue #24 ("master/examples/routing.rs Compilation fails").
- **Root Cause**: Macro attributes originally failed to generate proper async trait implementations for function handlers when mixed with combinators that altered the router ownership graph. The compiler could not infer the lifetime `'static` for closures capturing lexical boolean flags.
- **Remediation Code Diff**:
```diff
--- a/examples/routing.rs
+++ b/examples/routing.rs
@@ -10,7 +10,7 @@ async fn main() {
     let debug_mode = true;
     let admin_mode = true;
     let mut router = Router::new()
         .get(index)
         .push(
             Router::new()
                 .path("users")
@@ -20,11 +20,11 @@ async fn main() {
-        .then(|router| {
+        ;
+    if debug_mode {
+        router = router.push(Router::new().path("debug").get(debug));
+    }
+    if admin_mode {
+        router = router.push(Router::new().path("admin").get(admin));
+    }
```
- **Lesson**: Avoid monad-style chaining closures (`.then(|r| ...)`) in Rust builder APIs when simple conditional ownership reassignment (`if cond { router = router.push(...) }`) eliminates lifetime capture hazards entirely.

---

### Incident 3: YAML Duplicate Key CI Invariant Enforcement (BUG-SALVO-03)
- **Context**: `.github/scripts/test_workflow_policy.py`
- **What Was Expected**: GitHub Action workflow files must strictly prevent duplicate YAML keys (such as `timeout-minutes` or `steps`), which lead to undefined behavior across different YAML parser implementations (some pick the first key, others silently overwrite with the last).
- **What Actually Happened**: Dependabot and manual PR merges risked introducing duplicate configuration keys in workflow files that standard `actions/checkout` and GitHub Actions runners parse leniently, obscuring security configurations or runner timeouts.
- **Evidence in Repo**: Commit `8adf9959` test harness: `test_duplicate_workflow_keys_are_rejected`.
- **Root Cause**: Python's standard `yaml.load` (PyYAML) quietly overwrites duplicate keys when constructing dictionaries, allowing silent shadowing of timeouts or security steps.
- **Remediation Code Diff**:
```diff
--- a/.github/scripts/test_workflow_policy.py
+++ b/.github/scripts/test_workflow_policy.py
@@ -10,6 +10,13 @@
+class UniqueKeyLoader(yaml.SafeLoader):
+    def construct_mapping(self, node, deep=False):
+        mapping = set()
+        for key_node, _ in node.value:
+            key = self.construct_object(key_node, deep=deep)
+            if key in mapping:
+                raise ValueError(f"duplicate YAML key '{key}'")
+            mapping.add(key)
+        return super().construct_mapping(node, deep=deep)
```
- **Lesson**: CI policy test harnesses must implement strict AST/mapping validation on configuration files, failing immediately if keys are shadowed or redefined.

---

### Incident 4: Cancellation Race Condition During Transport Admission (BUG-SALVO-04)
- **Context**: `crates/core/src/conn/admission.rs`
- **What Was Expected**: When `Acceptor::accept` is polled inside a `tokio::select!` block and cancelled before admission finishes, the underlying transport socket and its async admission decision (`policy.decide(&info).await`) must not be dropped prematurely or cause resource leaks.
- **What Actually Happened**: Dropping an incomplete `accept` future caused half-admitted TCP/TLS streams to be lost, leaking capacity permits and leaving socket descriptors hanging until timeout expiry.
- **Evidence in Repo**: `PendingAdmission<T>` struct implementation in `crates/core/src/conn/admission.rs`.
- **Root Cause**: The decision-making future was recreated on every poll iteration of the acceptor loop. If a branch of `tokio::select!` cancelled the future, the in-flight decision was discarded, losing state.
- **Remediation Code Diff**:
```diff
--- a/crates/core/src/conn/admission.rs
+++ b/crates/core/src/conn/admission.rs
@@ -18,6 +18,18 @@ pub(super) struct PendingAdmission<T> {
     pub(super) incoming: T,
     pub(super) info: FuseInfo,
     pub(super) conn_ctrl: ConnCtrl,
+    decision: Option<BoxFuture<'static, Option<Admitted>>>,
 }
 
+impl<T> PendingAdmission<T> {
+    pub(super) fn new(incoming: T, info: FuseInfo, policy: Option<ArcFusePolicy>) -> Self {
+        let conn_ctrl = ConnCtrl::new();
+        let decision = policy.map(|policy| {
+            let info = info.clone();
+            let conn_ctrl = conn_ctrl.clone();
+            async move {
+                // Retains decision logic in a single pinned BoxFuture
+                match policy.decide(&info).await { ... }
+            }.boxed()
+        });
+        Self { incoming, info, conn_ctrl, decision }
+    }
```
- **Lesson**: When performing multi-step asynchronous admission over network streams, retain both the transport handle and its decision future within an explicit `PendingAdmission` state holder to survive future cancellation across loop iterations.

---

### Incident 5: Multiplexed Protocol Upgrade Task Leaks (BUG-SALVO-05)
- **Context**: `crates/core/src/conn/ctrl.rs`
- **What Was Expected**: Upgraded transport protocols (such as WebSockets or raw bidirectional byte streams) must retain the connection capacity permit on the server and must gracefully terminate when the server initiates shutdown.
- **What Actually Happened**: Spawning WebSocket handler tasks via `tokio::spawn` detached them from the `Server` connection accounting. The server would shut down immediately, abruptly severing upgraded tunnels, or conversely, orphaned upgraded tasks would leak system resources indefinitely if the client failed to disconnect.
- **Evidence in Repo**: `ConnCtrl::spawn_upgrade` and `ConnCtrl::upgrade_scope` in `crates/core/src/conn/ctrl.rs`.
- **Root Cause**: Connection controls lacked a communication channel to register upgrade tasks with the parent connection scope.
- **Remediation Code Diff**:
```diff
--- a/crates/core/src/conn/ctrl.rs
+++ b/crates/core/src/conn/ctrl.rs
@@ -21,6 +21,7 @@ struct Inner {
     state: AtomicU8,
     notify: Notify,
     relax: AtomicBool,
+    upgrades: std::sync::OnceLock<tokio::sync::mpsc::UnboundedSender<UpgradeTask>>,
 }
 
+pub fn spawn_upgrade(&self, task: impl Future<Output = ()> + Send + 'static) {
+    if let Some(upgrades) = self.inner.upgrades.get() {
+        let _ = upgrades.send(Box::pin(task));
+    } else {
+        tokio::spawn(task);
+    }
+}
```
- **Lesson**: Never use unbounded `tokio::spawn` for protocol upgrades; track upgraded protocol lifetimes within a connection-owned mpsc channel managed by an explicit `UpgradeScope`.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Atomic State Ordering Pairing**: In `ConnCtrl`, state modification MUST pair `Ordering::AcqRel` on swap/compare-exchange with `Ordering::Acquire` on failure, and load with `Ordering::Acquire`. A `Relaxed` store is ONLY permitted for isolated flags (`relax`) that have no cross-variable memory dependencies.
  ```rust
  // CORRECT: Strict synchronization barrier
  self.inner.state.compare_exchange(
      RUNNING,
      GRACEFUL_SHUTDOWN,
      Ordering::AcqRel,
      Ordering::Acquire,
  )
  ```
- **`Notify::enable()` Waiter Invariant**: When waiting on a `tokio::sync::Notify`, code MUST pin the notification and call `.enable()` prior to checking the state condition to eliminate the TOCTOU check-then-subscribe race window:
  ```rust
  // CORRECT: Pre-registration avoids lost wakeups
  let notified = self.inner.notify.notified();
  tokio::pin!(notified);
  notified.as_mut().enable();
  if self.state() == TargetState { return; }
  notified.await;
  ```
- **String Parsing and Memory Allocation**: In `crates/core/src/catcher.rs`, parsing environment flags uses zero-allocation references where possible, trimming and converting to lowercase before looking up static slices in `HashSet<&'static str>`.

---

### 2. Infinite Loop & Recursion Guards
- **Linear Scan Bounds in Wildcard Matchers**: Dynamic route matching on deep trees (e.g., `detect/deep_tree` criterion scenario) limits recursion to the depth of the registered router segments. Sibling matchers iterate linearly with strict slice bounds:
  ```rust
  // INVARIANT: router.detect terminates because unconsumed path shrinks monotonically
  // or the sibling slice index reaches len().
  for child in &self.children {
      if state.unconsumed.is_empty() && !child.accepts_empty() {
          continue;
      }
      // Linear scan without cyclic references
  }
  ```
- **Flow Control Loop Guard**: In `FlowCtrl::call_next`, middleware index progression is strictly monotonic:
  ```rust
  pub struct FlowCtrl {
      handlers: Vec<Arc<dyn Handler>>,
      cursor: usize,
  }
  // Invariant: cursor increment is strictly bounded by handlers.len()
  ```
  Calling `ctrl.call_next()` increments `cursor`. If a handler attempts to invoke `call_next` multiple times or introduces cycle traps, the cursor check `if self.cursor >= self.handlers.len()` halts progression immediately.

---

### 3. UI & UX Micro-Mechanics
- **Error Template XSS Prevention**: Error pages rendered to clients must escape raw URI fragments, query parameters, and custom error details.
  ```rust
  // INVARIANT: All user/request-supplied strings interpolated into HTML
  // must pass through an escape table transforming &, <, >, ", and '.
  ```
- **Content Negotiation Fallbacks**: When the incoming `Accept` header contains wildcards (`*/*`) or unknown MIME types, `guess_accept_mime` defaults strictly to `text/plain` or `application/json` to avoid rendering HTML with improper MIME sniffing headers (`X-Content-Type-Options: nosniff`).

---

### 4. Backend Concurrency & Memory Safety
- **Dual Acceptor Fair Multiplexing**: In `JoinedAcceptor::accept`, polling two distinct listener sources (`a` and `b`) is handled via `tokio::select!`.
  ```rust
  // Invariant: tokio::select! branches are polled fairly by default,
  // preventing socket starvation when listener A has higher traffic than listener B.
  tokio::select! {
      accepted = self.a.accept(fuse_policy.clone()) => {
          Ok(accepted?.map_into(JoinedCoupler::A, JoinedStream::A))
      }
      accepted = self.b.accept(fuse_policy) => {
          Ok(accepted?.map_into(JoinedCoupler::B, JoinedStream::B))
      }
  }
  ```
- **Lazy Lock Thread-Safe Initialization**: All static sets and formats (e.g., `PARSED_ENV_SETS`, `SUPPORTED_FORMATS`) use `std::sync::LazyLock` guaranteeing lock-free, race-free, once-only initialization on first access without explicit mutex contention.

---

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Status Error Body Double-Render Guard**:
  ```rust
  let status = res.status_code.unwrap_or(StatusCode::NOT_FOUND);
  if (status.is_server_error() || status.is_client_error())
      && (res.body.is_none() || res.body.is_error())
  {
      write_error_default(req, res, self.footer.as_deref());
  }
  ```
  *The Defect Trap:* If an upstream handler set an explicit custom error response body (e.g., a structured JSON validation error map), a naive error catcher might overwrite that body with generic HTML.
  *The Invariant Safeguard:* Salvo explicitly checks `(res.body.is_none() || res.body.is_error())`. A concrete payload (`ResBody::Once` or `ResBody::Stream`) is NEVER overwritten by the default catcher.

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
- **Unified Decoupled Model**: Handlers and Hoops (middleware) share the exact same signature. Middlewares are not wrappers that enclose the rest of the application in nested generic structs (unlike Tower's `Service<Layer>`); instead, they are flattened into a pipeline array executed via `FlowCtrl`.
- **Decoupled Transport**: The `Listener` produces an `Acceptor`, which produces `Accepted` streams, which are consumed by a `Coupler`. This allows seamless joining of heterogeneous transports (`JoinedListener` combining Unix Domain Sockets and TLS over TCP).

### 2. Core Abstractions
- **`Handler`**: The universal computation unit:
  `async fn handle(&self, req: &mut Request, depot: &mut Depot, res: &mut Response, ctrl: &mut FlowCtrl)`
- **`Depot`**: Type-safe per-request storage mechanism enabling disparate middlewares to share state (e.g., extracted claims from JWT auth, rate limit counters) without mutating request headers.
- **`FlowCtrl`**: Dynamic execution control granting handlers the power to short-circuit (`ctrl.skip_rest()`), yield control, or re-enter on unwind.

### 3. Error Handling
- **Non-Swallowing Error Architecture**: Errors placed in `res.body = ResBody::Error(StatusError)` preserve their causal chain.
- **RFC 9457 Compliance**: Native support for problem details via `salvo_core::catcher::ProblemGoal`.
- **Catcher Middleware**: Catchers themselves are structured with hoops (`catcher.hoop(custom_err_handler)`), allowing custom handling per status code or path.

### 4. Testing
- **In-Memory `TestClient`**: Allows full

## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
