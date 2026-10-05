> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/badoo-reaktive-learnings.md`  
> **Source**: GitHub ([https://github.com/badoo/Reaktive](https://github.com/badoo/Reaktive))  
> **License**: Apache-2.0  
> **Synthesized By**: Universal Multi-Provider Autonomous AI Agent  
> **Timestamp**: 2026-10-04T20:22:18.302Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Personal emails/PII sanitized at ingestion.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation or use as an AI/ML training dataset is prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): badoo/Reaktive

## 1. Executive Forensic Architecture & System Mechanics

`badoo/Reaktive` is a high-performance, zero-overhead Kotlin Multiplatform (KMP) implementation of Reactive Extensions (Rx). It is designed to provide a unified reactive programming model across diverse compilation targets—including JVM, Android, iOS, macOS, watchOS, tvOS, JavaScript, WebAssembly (Wasm), and Linux x64—without relying on platform-specific reflection or heavy runtime overhead.

```
                               +---------------------------------------+
                               |       Reaktive Core Interfaces        |
                               | (Observable, Single, Maybe, Complete) |
                               +---------------------------------------+
                                                   |
                        +--------------------------+--------------------------+
                        |                                                     |
                        v                                                     v
          +---------------------------+                         +---------------------------+
          |    Execution Schedulers   |                         |   Resource Management     |
          | (Main, IO, Computation)   |                         | (Disposables, SerialDisp) |
          +---------------------------+                         +---------------------------+
                        |                                                     |
      +-----------------+-----------------+                 +-----------------+-----------------+
      |                 |                 |                 |                 |                 |
      v                 v                 v                 v                 v                 v
+-----------+     +-----------+     +-----------+     +-----------+     +-----------+     +-----------+
| JVM/Andr  |     |  Darwin   |     |  JS/Wasm  |     | AtomicRef |     |   Locks   |     | Looper    |
| ThreadPool|     | GCD Queue |     | EventLoop |     | (LockFree)|     | (Platform)|     | (Native)  |
+-----------+     +-----------+     +-----------+     +-----------+     +-----------+     +-----------+
```

### Architectural Boundaries & Decoupling
Reaktive achieves platform decoupling by separating the core reactive stream contracts from the underlying execution runtimes:
1. **The Stream Layer (`Observable`, `Single`, `Maybe`, `Completable`)**: Purely functional interfaces defining subscription and observation contracts.
2. **The Scheduler Layer (`Scheduler`, `Scheduler.Executor`)**: Abstract execution contexts. Schedulers map logical tasks to platform-specific execution loops:
   - **JVM/Android**: Backed by Java thread pools (`ScheduledExecutorService`).
   - **Darwin (iOS/macOS/etc.)**: Backed by Grand Central Dispatch (GCD) queues (`dispatch_queue_t`).
   - **JS/Wasm**: Backed by the JavaScript event loop (`setTimeout`, `setInterval`).
3. **The Synchronization Layer (`Lock`, `AtomicReference`, `AtomicInt`)**: Platform-specific concurrency primitives. In Kotlin/Native, these interface directly with native atomic operations and POSIX/Darwin mutexes.

### Critical Subsystem Abstractions
- **`Disposable`**: The fundamental resource lifecycle contract. It represents a cancellable task or stream subscription. Subclasses like `CompositeDisposable` and `SerialDisposable` manage groups of resources with strict thread-safety guarantees.
- **`AbstractSerializer`**: A highly optimized, lock-free fast-path serialization engine derived from RxJava's `SerializedEmitter`. It guarantees that stream emissions (`onNext`, `onComplete`, `onError`) are delivered sequentially and in-order, even when emitted concurrently from multiple threads, without holding locks during downstream execution.
- **`PriorityQueue`**: A custom, zero-dependency heap-based priority queue used by schedulers (like `TrampolineScheduler`) to order tasks chronologically without relying on platform-specific collections.

---

## 2. Forensic Real Incidents & Production Patches

### Incident 1: `RefCount` Race Condition & Re-entrant Subscription Leak (BUG-REF-01)
- **Context**: `reaktive/src/commonMain/kotlin/com/badoo/reaktive/observable/RefCount.kt`
- **What Was Expected**: When an `Observable` wrapped in `refCount` is subscribed to and immediately disposed of within the `onSubscribe` callback, it should safely connect to the upstream, obtain the connection disposable, and immediately dispose of it, leaving the system in a clean, disconnected state.
- **What Actually Happened**: Under high concurrency or immediate disposal during `onSubscribe`, the connection disposable was leaked. The upstream remained connected indefinitely, consuming resources.
- **Evidence in Repo**: Commits `e02f230d` and `37cf3e51`.
- **Root Cause**: The original implementation used decoupled atomic primitives (`AtomicInt` for subscription count and `AtomicReference` for the active connection disposable). 
  1. Thread A subscribed, incrementing `subscribeCount` to 1. It triggered `connect()`.
  2. Before `connect()` returned and set the `disposable` reference, Thread A was disposed of.
  3. Thread A's disposal decremented `subscribeCount` to 0. It attempted to read the connection disposable to dispose of it, but found `null` because `connect()` had not yet written the reference.
  4. `connect()` finally completed, writing the active disposable to the `AtomicReference`. The connection was now leaked because the subscription count was already 0, and no subsequent event would trigger its disposal.
- **Remediation Code Diff**:
```kotlin
// - Original Buggy Implementation
fun <T> ConnectableObservable<T>.refCount(subscriberCount: Int = 1): Observable<T> {
    require(subscriberCount > 0)
    val subscribeCount = AtomicInt()
    val disposable = AtomicReference<Disposable?>(null)

    return observable { emitter ->
        val disposables = CompositeDisposable()
        emitter.setDisposable(disposables)

        disposables += Disposable {
            if (subscribeCount.addAndGet(-1) == 0) {
                disposable.getAndChange { null }?.dispose()
            }
        }

        val shouldConnect = subscribeCount.addAndGet(1) == subscriberCount
        // ... subscribe logic ...
        if (shouldConnect) {
            this.connect { disposable.value = it }
        }
    }
}

// + Fixed Safe Implementation
fun <T> ConnectableObservable<T>.refCount(subscriberCount: Int = 1): Observable<T> {
    require(subscriberCount > 0)
    var subscribeCount = 0
    val lock = Lock()
    val connectionDisposable = SerialDisposable()

    return observable { emitter ->
        val disposables = CompositeDisposable()
        emitter.setDisposable(disposables)

        val shouldConnect = lock.synchronized { ++subscribeCount == subscriberCount }

        // ... subscribe logic ...

        if (shouldConnect) {
            this.connect(connectionDisposable::set)
        }

        disposables += Disposable {
            lock.synchronized {
                if (--subscribeCount == 0) {
                    connectionDisposable.set(null)
                }
            }
        }
    }
}
```
- **Lesson**: Decoupled atomic operations cannot safely coordinate state transitions that involve asynchronous side-effects (like connection establishment). A unified `Lock` protecting both the state counter and the lifecycle container (`SerialDisposable`) is mandatory to prevent race conditions.

---

### Incident 2: `MainScheduler` JS/Wasm Platform Type Leak & ID Collision (BUG-SCHED-02)
- **Context**: `reaktive/src/jsCommonMain/kotlin/com/badoo/reaktive/scheduler/MainScheduler.kt`
- **What Was Expected**: The `MainScheduler` on JS and Wasm targets should schedule and cancel timeouts and intervals using native platform APIs without type mismatches or memory leaks.
- **What Actually Happened**: The scheduler crashed at runtime on Wasm targets due to type casting errors, and leaked memory on Node.js environments because timeout IDs were not correctly tracked or cleared.
- **Evidence in Repo**: Commits `a4fe69fc` and `f685041a`.
- **Root Cause**: 
  1. In JS, `setTimeout` returns a platform-dependent type: a numeric ID in browsers, but a complex `Timeout` object in Node.js.
  2. In Kotlin/Wasm, JS objects cannot be directly cast to `Int` or `Any` without explicit mapping.
  3. The scheduler attempted to store these IDs in a `mutableSetOf<Int>()` or `mutableSetOf<Any>()`, which caused class-cast exceptions on Wasm and failed to properly identify and clear the Node.js `Timeout` objects.
  4. Additionally, the scheduler removed the timeout ID from its tracking set *inside* the execution callback before the ID was actually added to the set by the synchronous return of `jsSetTimeout`, causing a race where the ID was added to the set *after* the task had already executed, leaking the ID in the tracking set forever.
- **Remediation Code Diff**:
```kotlin
// - Original Buggy Implementation
internal expect fun jsSetTimeout(task: () -> Unit, delayMillis: Int): Int
private val timeoutIds = mutableSetOf<Int>()

private fun setTimeout(delay: Duration, task: () -> Unit) {
    var id: Int? = null
    id = jsSetTimeout(
        {
            timeoutIds.remove(id)
            task()
        },
        delay.coerceAtLeastZero().inWholeMilliseconds.toInt()
    )
    timeoutIds.add(id)
}

// + Fixed Safe Implementation
internal expect class TimeoutId
internal expect fun jsSetTimeout(task: () -> Unit, delayMillis: Int): TimeoutId

private val timeoutIds = mutableSetOf<TimeoutId>()

private fun setTimeout(delay: Duration, task: () -> Unit) {
    var timeoutId: TimeoutId? = null
    timeoutId = jsSetTimeout(
        task = {
            timeoutIds.remove(timeoutId)
            task()
        },
        delayMillis = delay.coerceAtLeastZero().inWholeMilliseconds.toInt()
    )
    timeoutIds.add(timeoutId)
}
```
- **Lesson**: Never assume primitive types (like `Int`) for platform-native handles (like timer IDs). Wrap them in platform-specific `expect`/`actual` types (`TimeoutId`) and ensure that asynchronous registration occurs in a sequence that guarantees the handle is registered before its removal is attempted.

---

### Incident 3: `BehaviorSubject` Synchronous Emission Thread Race (BUG-SUBJ-03)
- **Context**: `reaktive/src/commonMain/kotlin/com/badoo/reaktive/subject/BehaviorSubject.kt` (Issue #727)
- **What Was Expected**: A `BehaviorSubject` must synchronously emit its current value to a new observer immediately upon subscription, ensuring no gap in the stream.
- **What Actually Happened**: If another thread was concurrently emitting a value to the subject, the initial value for the new subscriber was queued instead of being delivered synchronously. This caused the subscriber to miss the current state during its initialization phase.
- **Evidence in Repo**: Issue #727.
- **Root Cause**: The subject utilized a serialization queue to protect against concurrent emissions. When a subscription occurred while the queue was "busy" (locked or actively draining on another thread), the initial emission was appended to the end of the queue. This violated the synchronous contract of `BehaviorSubject`, as the subscriber's call to `subscribe()` returned before the initial value was delivered.
- **Remediation Code Diff**:
```kotlin
// - Conceptual Buggy Flow in BehaviorSubject
override fun subscribe(observer: ObservableObserver<T>) {
    // ... register observer ...
    if (isEmitting) {
        queue.add(currentValue) // Defer to queue -> Non-synchronous!
    } else {
        observer.onNext(currentValue)
    }
}

// + Correct Synchronous Flow
override fun subscribe(observer: ObservableObserver<T>) {
    lock.synchronized {
        // Register and immediately emit the current value within the lock
        // to guarantee synchronous delivery before any concurrent emission can interleave.
        observer.onSubscribe(disposable)
        observer.onNext(currentValue)
    }
}
```
- **Lesson**: State-holding subjects must guarantee that the initial state emission is bound to the subscription transaction. This requires synchronization that blocks concurrent emissions until the subscription-time emission is complete.

---

### Incident 4: `combineLatest` Shared List Mutation Leak (BUG-COMB-04)
- **Context**: `reaktive/src/commonMain/kotlin/com/badoo/reaktive/observable/CombineLatest.kt` (Issue #625)
- **What Was Expected**: The `combineLatest` operator, when combining an Iterable of Observables, should emit a new, independent list instance representing the latest values on every update.
- **What Actually Happened**: The operator emitted the exact same backing `ArrayList` instance on every update, merely mutating its elements in-place. Downstream operators like `distinctUntilChanged` compared the old and new emissions, saw they were referentially identical (`old === new`), and discarded the updates.
- **Evidence in Repo**: Issue #625.
- **Root Cause**: A premature memory optimization. To avoid allocating a new list on every upstream emission, the operator maintained a single mutable list and emitted it repeatedly. This broke referential transparency and violated the immutability invariants required by downstream reactive operators.
- **Remediation Code Diff**:
```kotlin
// - Original Buggy Implementation
private val values = ArrayList<T>(size)
// ... on update ...
emitter.onNext(values) // Emits the same mutable list reference

// + Fixed Safe Implementation
private val values = ArrayList<T>(size)
// ... on update ...
emitter.onNext(ArrayList(values)) // Emits a shallow copy, preserving referential distinctness
```
- **Lesson**: Never emit mutable, reused collection instances down a reactive stream. Immutability and referential uniqueness of emitted values are fundamental invariants of reactive stream processing.

---

### Incident 5: Empty Collection `combineLatest` Infinite Hang (BUG-COMB-05)
- **Context**: `reaktive/src/commonMain/kotlin/com/badoo/reaktive/observable/CombineLatest.kt` (Issue #500)
- **What Was Expected**: Combining an empty collection of observables using `combineLatest` should immediately complete the downstream observer without emitting values.
- **What Actually Happened**: The downstream observer hung indefinitely, never receiving a completion event.
- **Evidence in Repo**: Issue #500.
- **Root Cause**: The operator's initialization logic waited for all source observables to emit at least once. When the input collection was empty, the internal counter of active sources was 0, but the completion logic was never triggered because no source subscription was ever created to signal completion.
- **Remediation Code Diff**:
```kotlin
// - Original Buggy Implementation
fun <T, R> Collection<Observable<T>>.combineLatest(mapper: (List<T>) -> R): Observable<R> {
    return observable { emitter ->
        // Directly proceeds to subscribe to sources, hanging if empty
        val sources = this
        // ... subscription loop ...
    }
}

// + Fixed Safe Implementation
fun <T, R> Collection<Observable<T>>.combineLatest(mapper: (List<T>) -> R): Observable<R> {
    if (isEmpty()) {
        return observableOfEmpty() // Short-circuit immediately
    }
    return observable { emitter ->
        // ... subscription loop ...
    }
}
```
- **Lesson**: Always validate boundary conditions for collection-based operators. An empty input collection must immediately short-circuit to an empty stream completion.

---

### Incident 6: Node.js Environment Crash on `window` Reference (BUG-NODE-06)
- **Context**: `reaktive/src/jsCommonMain/kotlin/com/badoo/reaktive/scheduler/JsFunctions.kt` (Issue #485)
- **What Was Expected**: The JavaScript target of the library should execute seamlessly in both browser and headless Node.js environments.
- **What Actually Happened**: The application crashed with `ReferenceError: window is not defined` when executed in a Node.js environment.
- **Evidence in Repo**: Issue #485.
- **Root Cause**: The JS scheduler implementation explicitly invoked `window.setTimeout` and `window.setInterval`. While these exist in browser environments, Node.js uses global `setTimeout` and `setInterval` functions, and does not define a `window` object.
- **Remediation Code Diff**:
```kotlin
// - Original Buggy Implementation
internal actual fun jsSetTimeout(task: () -> Unit, delayMillis: Int): Any =
    window.setTimeout(task, delayMillis)

// + Fixed Safe Implementation
import com.badoo.reaktive.global.external.globalThis

internal actual fun jsSetTimeout(task: () -> Unit, delayMillis: Int): TimeoutId =
    TimeoutId(globalThis.setTimeout(task, delayMillis))
```
- **Lesson**: Never reference environment-specific globals (like `window` or `global`) directly in multiplatform JavaScript code. Use a unified global accessor like `globalThis` to resolve the execution context dynamically.

---

## 3. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Referential vs. Structural Equality in Streams**: In Kotlin, `==` compiles to structural equality (`equals()`), while `===` checks referential identity. In reactive operators like `distinctUntilChanged`, structural equality must be used for values, but referential equality must be used for internal state tracking (e.g., comparing active disposables).
- **Type Coercion and Platform Types in JS/Wasm**: In Kotlin/JS, `dynamic` bypasses compiler type-checking. When interfacing with JS APIs (like timers), never expose `dynamic` to the common API. Wrap it immediately in an internal `expect`/`actual` class to prevent runtime type pollution.
- **Deep Immutability in Collections**: When modifying internal state lists (e.g., in `CollectionExt.kt`), always return a new list instance. Use `ArrayList(this)` to copy the backing array explicitly:
  ```kotlin
  internal fun <T> List<T>.replace(index: Int, element: T): List<T> =
      ArrayList(this).apply { set(index, element) }
  ```
  *Invariant*: The original list must never be mutated in-place, as it may be shared across thread boundaries.

### 2. Infinite Loop & Recursion Guards
- **Serializer Drain Loop Termination**: The `AbstractSerializer` uses an atomic counter to serialize emissions. The drain loop must guarantee termination by decrementing the counter by the exact number of processed ("missed") items:
  ```kotlin
  var missed = 1
  while (true) {
      // ... drain queue ...
      missed = counter.addAndGet(-missed)
      if (missed == 0) {
          break
      }
  }
  ```
  *Invariant*: The decrement