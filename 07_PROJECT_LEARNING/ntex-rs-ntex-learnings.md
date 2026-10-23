> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/ntex-rs-ntex-learnings.md`  
> **Source**: github ([https://github.com/ntex-rs/ntex](https://github.com/ntex-rs/ntex))  
> **Source Version**: `eb2524d0`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-23T11:45:08.047Z  
> **Learning ID**: `learn-github-ntex-rs-ntex`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): ntex-rs/ntex

---

## 1. Executive Forensic Architecture & System Mechanics

`ntex` is a high-performance, composable, single-threaded/thread-per-core asynchronous networking framework engineered in Rust. Unlike multi-threaded work-stealing runtimes (e.g., standard Tokio multi-threaded scheduler) that incur cache invalidation, synchronization locks, and cross-thread work-stealing latency, `ntex` adopts a strict **thread-per-core** architecture paired with zero-allocation composable pipeline layers (`ntex-service`), asynchronous zero-copy buffer slicing (`ntex-bytes`), an extensible filter/codec pipeline (`ntex-io`), and a cooperative, latency-bounded single-threaded runtime (`ntex-rt`).

```
+----------------------------------------------------------------------------------------------------+
|                                             ntex-rt                                                |
|  +--------------------+   +------------------------------------+   +----------------------------+  |
|  |    LocalQueue      |   |  RemoteQueue (Cross-thread tasks)  |   |    Cooperative Scheduler   |  |
|  | (Thread-local FIFO)|   |   MPSC Atomic Admission Barrier    |   | Max Self-Wakes & Histograms|  |
|  +---------+----------+   +-----------------+------------------+   +--------------+-------------+  |
+------------|--------------------------------|-------------------------------------|----------------+
             |                                |                                     |
+------------v--------------------------------v-------------------------------------v----------------+
|                                           ntex-service                                             |
|  +----------------------------------------------------------------------------------------------+  |
|  | Pipeline / PipelineState: Shared Readiness Gate (`WaitersRef`, `ReadyScope`, Generation ID) |  |
|  | State Isolation: Ctx<'a, Svc, St> -> State Unpacking & State Re-binding                      |  |
|  | Gate Ownership: Single Active Checker vs In-Call Bypass Paths vs Re-entrant Wake Yielding   |  |
|  +----------------------------------------------+-----------------------------------------------+  |
+-------------------------------------------------|--------------------------------------------------+
                                                  |
+-------------------------------------------------v--------------------------------------------------+
|                                             ntex-io                                                |
|  +-------------------+   +--------------------+   +--------------------+   +--------------------+  |
|  |    Filter Stack   |-->|   IoState Flags    |-->| Page-Adaptive Buf  |-->|  Waiters Registry  |  |
|  | (TLS / Framing)   |   | (Bitfield Machine) |   | (Grow/Shrink Batch)|   |  (Tag-based Wakes) |  |
|  +-------------------+   +--------------------+   +--------------------+   +--------------------+  |
+----------------------------------------------------------------------------------------------------+
```

### Architectural Subsystem Boundaries & Decoupling

1. **`ntex-service` (Readiness Gate & Composable Pipeline Subsystem)**:
   - Services implement `Service<St, Req>` with three primitive phases: `bind(&self, ctx)`, `ready(&self, ctx) -> Result<(), Self::Error>`, and `call(&self, req, ctx) -> Result<Self::Res, Self::Error>`.
   - The execution is governed by `Pipeline<Svc, St>` and `PipelineState<St, ...>`. A critical architectural boundary is the **Readiness Gate**: readiness is not polled per request uniformly; instead, a shared pipeline gate (`WaitersRef`) designates one waiter to drive the readiness of the underlying service while other callers park their wakers in a slab.
   - Decoupled from execution state via `RequestState` and `map_state`, allowing stateless, pooled, or per-request contexts to traverse the same physical service instance without re-instantiation.

2. **`ntex-rt` (Low-Latency Thread-Pinned Scheduler)**:
   - Built around `RunnableQueue` with cache-line-isolated boundaries (`#[repr(align(128))] struct CacheLine`).
   - Distinguishes thread-local tasks (`LocalQueue`) from foreign-thread tasks (`RemoteQueue`). Cross-thread task admission is strictly gated by an atomic reservation counter with bitflag encoding (`admission: AtomicUsize`, top bit `CLOSED = 1 << (usize::BITS - 1)`).
   - Enforces execution fairness via self-wake limiting: tasks that repeatedly wake themselves within a poll turn are tracked using bitfields (`stats.self_wakes()`, `MAX_SELF_WAKES`) and forced to yield after an exhaustion ceiling to prevent driver event loop starvation.

3. **`ntex-io` (Layered State-Machine I/O Engine)**:
   - Manages asynchronous raw byte streaming through a layered `Filter` architecture (e.g., `Base`, `SslFilter`, `HttpFilter`).
   - Encapsulates socket state inside `IoState`, a single heap-allocated block coordinating driver read/write tasks, application-level dispatchers, and timeout handlers via non-locking `Cell` flags and tag-indexed waiter slots.
   - Employs dynamic page-adaptive buffer allocation (`track_read`) where read buffer sizes step up on large incoming bursts and step down only after consecutive under-utilized batches (`RD_SHRINK_BATCHES`), drastically minimizing syscall overhead and heap reallocation.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. In-Call Readiness Gate Bypass Invariant
**RULE**:
When an asynchronous system couples request processing with a shared single-owner readiness gate (where only one caller is permitted to drive state-readiness checks while others queue), any nested or internal readiness checks triggered from within the execution of an active service call (`call(...)`) MUST bypass the gate owner and execute immediately if the gate is occupied, registering their suspended wakers in a distinct auxiliary wait-table. Systems MUST NOT block an active call on the gate owner when the gate owner may be waiting for resources allocated or held by that call.

**WHY**:
If Service `A` starts executing `call()` and internally delegates to Service `B`'s pipeline check while holding an exclusive system resource (e.g., a buffer slot, connection handle, or lock), and Service `B`'s readiness gate is currently locked by a separate caller `C` that is waiting for that exact resource held by `A`, a circular wait dependency occurs. The gate owner cannot finish until the resource is freed, and the call holding the resource cannot proceed because it is waiting for the gate owner. This produces an unrecoverable async deadlock without any thread-level lock contention.

**WHEN TO APPLY**:
In any actor, pipeline, or RPC framework (Rust, Go, C++, Zig) implementing backpressure readiness (e.g., Tower/Actix/Ntex-style `poll_ready`/`ready`) where calls can pipeline nested service invocations and readiness check authorization is serialized behind a single executor/token.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::cell::{Cell, UnsafeCell};
use std::task::{Context, Poll, Waker};
use slab::Slab;

pub struct WaitersRef {
    cur: Cell<u32>, // u32::MAX = Gate is Free
    indexes: UnsafeCell<Slab<Option<Waker>>>, // Gate waiters
    calls: UnsafeCell<Slab<Option<Waker>>>,   // In-call bypass waiters
    scratch: std::cell::RefCell<Vec<Waker>>,
}

impl WaitersRef {
    /// Executes a readiness check initiated from within an active service call.
    pub fn run_call<F, R>(&self, idx: u32, key: &mut Option<u32>, cx: &mut Context<'_>, f: F) -> Poll<R>
    where
        F: FnOnce(&mut Context<'_>) -> Poll<R>,
    {
        let cur = self.cur.get();
        // 1. If gate is unowned (u32::MAX) or current caller already owns it, run normally
        if cur == u32::MAX || cur == idx {
            self.remove_call(key);
            return self.run(idx, cx, f);
        }

        // 2. Gate is locked by another waiter. Bypass the gate owner to break circular wait:
        let result = f(cx);
        if result.is_pending() {
            let calls = unsafe { &mut *self.calls.get() };
            if let Some(slot) = key.and_then(|k| calls.get_mut(k as usize)) {
                if !slot.as_ref().is_some_and(|w| w.will_wake(cx.waker())) {
                    *slot = Some(cx.waker().clone());
                }
            } else {
                *key = Some(calls.insert(Some(cx.waker().clone())) as u32);
            }
        } else {
            // Completed without waiting on the gate owner. Remove waker and wake pending checks!
            self.remove_call(key);
            self.wake_checks();
        }
        result
    }

    fn wake_checks(&self) {
        let cur = self.cur.get();
        if cur == u32::MAX {
            return;
        }
        let mut wakers = self.scratch.borrow_mut();
        wakers.clear();

        // Collect the gate owner
        let indexes = unsafe { &mut *self.indexes.get() };
        if let Some(Some(waker)) = indexes.get(cur as usize) {
            wakers.push(waker.clone());
        }
        // Collect call bypass wakers
        let calls = unsafe { &mut *self.calls.get() };
        if !calls.is_empty() {
            wakers.extend(calls.iter_mut().filter_map(|(_, w)| w.take()));
        }

        for waker in wakers.drain(..) {
            waker.wake();
        }
    }

    fn remove_call(&self, key: &mut Option<u32>) {
        if let Some(k) = key.take() {
            let calls = unsafe { &mut *self.calls.get() };
            if calls.contains(k as usize) {
                calls.remove(k as usize);
            }
        }
    }

    pub fn run<F, R>(&self, idx: u32, cx: &mut Context<'_>, f: F) -> Poll<R>
    where
        F: FnOnce(&mut Context<'_>) -> Poll<R>,
    {
        self.cur.set(idx);
        let res = f(cx);
        if res.is_ready() {
            self.cur.set(u32::MAX);
        }
        res
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// CRITICAL BUG: Forcing an in-call readiness check to queue behind the pipeline gate owner
pub fn run_call_buggy<F, R>(&self, idx: u32, cx: &mut Context<'_>, f: F) -> Poll<R>
where
    F: FnOnce(&mut Context<'_>) -> Poll<R>,
{
    // ANTI-PATTERN: If another task owns the gate (`self.cur != u32::MAX`), queuing
    // this call behind that gate causes a DEADLOCK if the owner is waiting for a
    // channel, buffer, or lock held by the outer call!
    if self.cur.get() != u32::MAX && self.cur.get() != idx {
        self.queue_waiter(idx, cx.waker());
        return Poll::Pending;
    }
    self.run(idx, cx, f)
}
```

**VERIFICATION METHOD**:
Verify using a cyclic dependency integration harness: Spawn Task 1 which executes `call()` on Service A, grabbing a scarce resource (a 1-capacity channel). Inside `call()`, Task 1 invokes `pipeline.ready()`. Concurrently, spawn Task 2 which enters `pipeline.ready()`, acquires the gate lock, but inside its readiness predicate awaits the 1-capacity channel held by Task 1. Assert that Task 1 detects `in_call: true`, bypasses the gate lock, completes readiness, yields the channel, and both tasks resolve in < 100ms without stalling.

---

### 2. Guarded RAII Unwind State Reset for Synchronous & Asynchronous Lock Claims
**RULE**:
Whenever an execution thread or task takes exclusive ownership of a shared state machine flag or lock-free serialization gate (`running.set(true)`), it MUST immediately instantiate a zero-cost RAII Drop Guard. If the user-supplied closure, poll, or future panics/unwinds, the Drop Guard MUST reset the ownership flag and broadcast a notification to all queued waiters. On standard non-panicking execution paths, the guard MUST be explicitly deactivated via `std::mem::forget(guard)`.

**WHY**:
If arbitrary user code executed within an exclusive gate triggers a panic (or unwinds due to an assertion failure or custom panic payload), and the ownership flag was set directly in the struct, execution leaves the flag permanently set (`running == true`). All other pipeline bindings, connections, or concurrent actors parked waiting for the gate will wait forever. This turns an isolated task panic into a permanent silent starvation failure of the entire worker thread.

**WHEN TO APPLY**:
Applies to any low-level runtime, event dispatcher, stateful service boundary, or custom synchronization primitive where non-atomic or atomic lock states guard user callbacks and unwinding across stack frames is permitted.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::cell::Cell;
use std::mem;

pub struct GateController {
    running: Cell<bool>,
}

impl GateController {
    pub fn execute_with_gate<F, R>(&self, f: F) -> R
    where
        F: FnOnce() -> R,
    {
        let is_initial = !self.running.get();
        let guard = is_initial.then(|| {
            self.running.set(true);
            GateUnwindGuard(self)
        });

        // Arbitrary user code that might panic
        let result = f();

        if let Some(guard) = guard {
            // Success path: dismiss the guard so Drop does not double-fire
            mem::forget(guard);
            // Normal post-execution gate teardown
            self.running.set(false);
            self.notify_waiters();
        }

        result
    }

    fn notify_waiters(&self) {
        // Broadcast wake to queued tasks
    }
}

/// Zero-sized wrapper holding reference to controller
struct GateUnwindGuard<'a>(&'a GateController);

impl<'a> Drop for GateUnwindGuard<'a> {
    fn drop(&mut self) {
        // This ONLY runs if stack unwinds (panic) past `f()` before `mem::forget`
        self.0.running.set(false);
        self.0.notify_waiters();
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// CRITICAL DEFECT: Manual flag toggling vulnerable to panic poisoning
pub fn execute_leaky<F, R>(&self, f: F) -> R
where
    F: FnOnce() -> R,
{
    self.running.set(true);
    let result = f(); // <-- IF THIS PANICS: self.running stays true FOREVER.
    self.running.set(false);
    self.notify_waiters();
    result
}
```

**VERIFICATION METHOD**:
Write an automated unit test utilizing `std::panic::catch_unwind(AssertUnwindSafe(...))`. Drive a service whose `ready()` or `call()` implementation panics on the first invocation. Assert that `catch_unwind` catches the panic, and subsequently assert that a second independent pipeline binding calling the same service does NOT hang or return `Poll::Pending`, but successfully acquires the gate and runs to completion.

---

### 3. Cooperative Self-Invalidation Spin Ceiling in Event-Loop Poll Cycles
**RULE**:
In event-driven future polling loops where driving a child future may trigger a side-effect that immediately invalidates the parent's cached state (e.g., waking a sibling that changes a generation counter), the loop MUST NOT spin synchronously more than once per poll turn. If the check is invalidated after being re-polled, the loop MUST invoke `cx.waker().wake_by_ref()`, exit the loop, and return `Poll::Pending` to yield execution back to the runtime reactor.

**WHY**:
Without an explicit yield counter (`restarted = true`), a tight `loop { ... }` in a `Future::poll` implementation will continuously execute if a waker callback modifies the generation counter on every pass. This causes a 100% CPU lockup on the worker thread, starving OS socket reads/writes, timer deadlines, and all other cooperative tasks on the same thread-per-core event loop.

**WHEN TO APPLY**:
Applies to all async poll loops checking dependency generation stamps, reactive pipelines, cache-validation wrappers, and software transactional memory loops inside Rust futures.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::pin::Pin;
use std::task::{Context, Poll};

pub struct GenerationCheckFuture<C> {
    check: C,
    active: bool,
}

pub trait CheckScope {
    fn is_current(&self, gen: usize) -> bool;
    fn generation(&self) -> usize;
}

pub trait CheckFuture: Future<Output = Result<usize, ()>> {
    fn scope(&self) -> &dyn CheckScope;
}

impl<C: CheckFuture + Unpin> Future for GenerationCheckFuture<C> {
    type Output = Result<(), ()>;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        let this = self.get_mut();
        let mut restarted = false;

        loop {
            this.active = true;
            let check = Pin::new(&mut this.check);

            match check.poll(cx) {
                Poll::Pending => return Poll::Pending,
                Poll::Ready(Ok(generation)) if !this.check.scope().is_current(generation) => {
                    // Stale generation detected: state was invalidated during poll.
                    // If we already looped once in this exact poll pass, WE MUST YIELD.
                    if restarted {
                        cx.waker().wake_by_ref();
                        return Poll::Pending;
                    }
                    restarted = true;
                    // Loop again once to consume the immediate update
                }
                Poll::Ready(res) => return Poll::Ready(res.map(|_| ())),
            }
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// CRITICAL BUG: Unbounded spin on invalidation
loop {
    match Pin::new(&mut this.check).poll(cx) {
        Poll::Pending => return Poll::Pending,
        Poll::Ready(Ok(gen)) if !scope.is_current(gen) => {
            // ANTI-PATTERN: Loops indefinitely if waking the owner invalidates the check!
            // Consumes 100% CPU, hangs runtime thread.
            continue; 
        }
        Poll::Ready(res) => return Poll::Ready(res),
    }
}
```

**VERIFICATION METHOD**:
Implement a mock `Wake` type (`NotifyingWaker`) that increments an `AtomicUsize` counter and invokes a cache-invalidating notifier every time `wake_by_ref()` is called. Assert that when the future is polled against this mock, the execution yields with `Poll::Pending` and the iteration counter never exceeds a safety threshold (< 10 cycles), preventing worker freeze.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Deadlock when readiness check inside a service call waited for pipeline gate (BUG-NTEX-01)
- **Context**: `ntex-service/src/ctx.rs`, `ntex-service/src/pl_inner.rs`.
- **What Was Expected**: When a service's `call()` method makes an inner readiness check on another service or pipeline binding, the check must proceed or yield without deadlocking the entire pipeline.
- **What Actually Happened**: A complete thread deadlock occurred. The pipeline readiness check inside `call()` waited for another binding's pipeline readiness check (the gate owner). However, that gate owner was itself suspended, waiting for resources (such as channel capacity or buffers) held by the outer `call()`.
- **Evidence in Repo**: Commit `f89d86c2`, additions: 329, deletions: 4. Release note: *"Fix deadlock when a readiness check inside a service call waited for another binding's pipeline readiness check that was itself waiting for resources held by the call."*
- **Root Cause**: The readiness gate (`WaitersRef`) serialized all readiness checks across all pipeline bindings through `self.cur: Cell<u32>`. When a binding acquired `self.cur`, it became the exclusive gate owner. When an active call on another binding was initiated, the context did not track whether execution was occurring in a call context (`in_call: false`). When the call invoked `ready()`, it queued its waker into `indexes` and returned `Poll::Pending`, waiting for `self.cur` to be freed. Because the gate owner was awaiting a resource only the active call could release, neither could ever make progress.
- **Remediation Code Diff**:
```rust
// ntex-service/src/ctx.rs
@@ -22,6 +22,8 @@ pub struct Ctx<'a, Svc: ?Sized, St = ()> {
     waiters: &'a WaitersRef,
     scope: &'a ReadyScope,
     call_nowait: bool,
+    // Readiness checks made while handling a call don't wait for the pipeline gate.
+    in_call: bool,
     _t: marker::PhantomData<Rc<Svc>>,
 }

@@ -35,6 +37,8 @@ pub(crate) struct WaitersRef {
     scratch: cell::RefCell<Vec<Waker>>,
     indexes: cell::UnsafeCell<slab::Slab<Option<Waker>>>,
+    /// Wakers of pending call-time checks that bypass the gate owner.
+    calls: cell::UnsafeCell<slab::Slab<Option<Waker>>>,
 }

+// In run_call:
+    fn run_call<F, R>(&self, idx: u32, key: &mut Option<u32>, cx: &mut Context<'_>, f: F) -> Poll<R>
+    where
+        F: FnOnce(&mut Context<'_>) -> Poll<R>,
+    {
+        let cur = self.cur.get();
+        if cur == u32::MAX || cur == idx {
+            self.remove_call(key);
+            return self.run(idx, cx, f);
+        }
+
+        let result = f(cx);
+        if result.is_pending() {
+            let calls = self.get_calls();
+            if let Some(slot) = key.and_then(|key| calls.get_mut(key as usize)) {
+                if !slot.as_ref().is_some_and(|w| w.will_wake(cx.waker())) {
+                    *slot = Some(cx.waker().clone());
+                }
+            } else {
+                *key = Some(calls.insert(Some(cx.waker().clone())) as u32);
+            }
+        } else {
+            self.remove_call(key);
+            self.wake_checks();
+        }
+        result
+    }
```
- **Lesson**: Gate mechanisms in async request lifecycles must be context-aware. An in-flight request already holds concurrency credits; subjecting it to the same admission gate as new incoming requests creates classic priority-inversion and circular wait deadlocks.

---

### Incident 2: Panic in Readiness Check Permanently Stalls All Concurrent Pipeline Bindings (BUG-NTEX-02)
- **Context**: `ntex-service/src/ctx.rs`, `WaitersRef::run`.
- **What Was Expected**: If an implementation of `Service::ready()` panics during its execution, the error should unwind that specific task, but other independent bindings sharing the same pipeline must be woken and permitted to acquire the gate.
- **What Actually Happened**: When a service readiness check panicked, `self.running.set(true)` remained permanently set. Consequently, subsequent polls by other bindings found the gate locked forever, freezing all traffic on that pipeline.
- **Evidence in Repo**: Commit `dc8dc2c9`, additions: 60, deletions: 5. CHANGELOG entry: *"Release readiness-check ownership when a service readiness check panics, so other bindings do not wait forever."*
- **Root Cause**: In `WaitersRef::run`, `self.running.set(true)` was set before invoking `f(cx)`. The code relied on normal execution flow reaching `if initial_run { self.running.set(false); }` after `f(cx)`. When `f(cx)` unwound the stack due to a panic, `self.running` was never cleared, and `self.notify()` was never called to drain queued wakers.
- **Remediation Code Diff**:
```rust
// ntex-service/src/ctx.rs
@@ -121,14 +122,15 @@ impl WaitersRef {
         if can_check {
             // only one readiness check can manage waiters
-            let initial_run = !self.running.get();
-            if initial_run {
-                self.running.set(true);
-            }
+            let guard = (!self.running.get()).then(|| {
+                self.running.set(true);
+                RunGuard(self)
+            });

             let result = f(cx);

-            if initial_run {
+            if let Some(guard) = guard {
+                mem::forget(guard);
                 if result.is_pending() {
                     self.queue_wake(idx);
                 } else {

+// Added RAII Guard:
+struct RunGuard<'a>(&'a WaitersRef);
+
+impl Drop for RunGuard<'_> {
+    fn drop(&mut self) {
+        self.0.running.set(false);
+        self.0.notify();
+    }
+}
```
- **Lesson**: Never manage state-machine lock flags via raw imperative statements across user closures. Always bind lock ownership to an RAII guard dropped on unwind with `mem::forget` on the success branch.

---

### Incident 3: Unbounded Spins in Readiness Check Due to Self-Invalidating Wakers (BUG-NTEX-03)
- **Context**: `ntex-service/src/ctx.rs`, `ReadyGenerationCheck::poll`.
- **What Was Expected**: When polling a shared service readiness check, if the generation scope indicates that the readiness state was invalidated, the poll function should re-poll until fresh or pending, without starving the runtime.
- **What Actually Happened**: If waking another check invalidated the current check on every single pass (e.g., in reciprocal notifications), the `loop { ... }` inside `poll()` spun indefinitely, taking 100% CPU and blocking the single-threaded event loop from processing I/O events.
- **Evidence in Repo**: Commit `dbfc78da`, additions: 90, deletions: 1. Changes in `ctx.rs` and added test `call_check_yields_when_waking_owner_invalidates_it`.
- **Root Cause**: The polling loop continuously matched `Ok(generation) if !this.check.scope().is_current(generation) => {}` and repeated the loop without yielding to the scheduler.
- **Remediation Code Diff**:
```rust
// ntex-service/src/ctx.rs
@@ -598,6 +598,7 @@ where
     fn poll(self: pin::Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
         // SAFETY: `check` is pinned in place.
         let this = unsafe { self.get_unchecked_mut() };
+        let mut restarted = false;
         loop {
             this.active = true;
             let mut check = unsafe { pin::Pin::new_unchecked(&mut this.check) };
@@ -616,13 +617,20 @@ where
                 Ok(generation) if !this.check.scope().is_current(generation) => {}
                 result => return Poll::Ready(result.map(O::from)),
             }
+            // Waking other checks can invalidate this one on every pass, see `RunCheck`.
+            if restarted {
+                cx.waker().wake_by_ref();
+                return Poll::Pending;
+            }
+            restarted = true;
         }
     }
```
- **Lesson**: Any `loop` inside a `Future::poll` that retries upon cache or generation invalidation must have an iteration budget (typically 1 retry). If the budget is exhausted, it must call `cx.waker().wake_by_ref()` and return `Poll::Pending`.

---

### Incident 4: WebSocket Pong Encoded as Transported Binary Message (BUG-NTEX-04)
- **Context**: `ntex/src/ws/` / WebSocket filter frame encoder.
- **What Was Expected**: An automated Pong response generated by the WebSocket filter in response to a Ping frame must be framed with the WebSocket control opcode `0xA` (Pong) and unmasked according to RFC 6455 server framing rules.
- **What Actually Happened**: The Pong frame was piped through the generic transport encoding layer without preserving the control frame opcode, resulting in it being framed as a binary payload frame (`0x2`) and transmitted to the peer. This caused protocol errors and connection termination by strict RFC 6455 clients.
- **Evidence in Repo**: Issue #130 ("Fix transported protocol error on ping request"), Commit `2091e0f` (PR #130 merged into master).
- **Root Cause**: The WebSocket filter framing logic merged control response synthesis into the application data pipeline. During message translation, the message classifier defaulted untagged buffers to binary payloads rather than maintaining an explicit discriminant for control protocol frames.
- **Remediation Code Diff**:
```rust
// - Frame::Binary(pong_bytes)
// + Frame::Pong(pong_bytes)
// Ensuring codec maps Pong to OpCode::Pong (0xA) directly into output buffer
// without passing through user message serialization filters.
```
- **Lesson**: Protocol control frames (Ping, Pong, Close) must have a dedicated high-priority path through codec pipelines, completely isolated from user-space data-payload serialization.

---

### Incident 5: Reentrant TLS State Mutation Aliasing on Connection Shutdown (BUG-NTEX-05)
- **Context**: `ntex-tls/src/utils.rs`, `testing::peer_close`.
- **What Was Expected**: During peer close and TLS connection teardown, flushing close notify alerts and dropping TLS buffers must not wake the read/write tasks while TLS references are borrowed.
- **What Actually Happened**: A peer shutdown triggered a waker notification inline while the TLS filter still held a borrow over the cryptographic state context. The awakened task immediately re-polled the TLS stream, causing a runtime panic (`BorrowMutError`) or aliased mutable reference violation under unsafe pointers.
- **Evidence in Repo**: `ntex-tls/src/utils.rs` test harness: `TLS_BORROWS`, `TlsBorrow`, `InlineWake`, and `peer_close` validation assertions ensuring `TLS_BORROWS.get() == 0` when wakers fire.
- **Root Cause**: The waker was triggered synchronously from within the TLS filter's internal buffer mutation scope before the borrow scope had concluded.
- **Remediation Code Diff**:
```rust
// In ntex-tls testing & utils:
// Decoupling waker notifications from the active borrow scope of the TLS filter.
// Wakers are staged into an external scratch vector / thread-local queue,
// the TLS state borrow is dropped, and THEN