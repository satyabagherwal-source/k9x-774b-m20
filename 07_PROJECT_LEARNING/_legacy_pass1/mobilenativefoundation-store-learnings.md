# Forensic Learning Record (Deep Inspection): MobileNativeFoundation/Store

> **Canonical Artifact**: `07_PROJECT_LEARNING/mobilenativefoundation-store-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MobileNativeFoundation/Store](https://github.com/MobileNativeFoundation/Store))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:34:36.226Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MobileNativeFoundation/Store`
- **Description**: A library for reading and writing data that lives in network, disk, and memory.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3422 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #761** (2026-09-08): **[BUG] MutableStore can discard pending writes or acknowledge unsynchronized changes**
  *Symptoms*: Overlapping operations for the same key in one `MutableStore` instance can leave a local write unsynchronized and remove the state needed to retry it.  **Queue replacement can discard a newer write**  Cleanup builds a replacement queue under the per-key mutex, then releases that mutex before installing the replacement. A newer write can enter the existing queue between those steps. See [queue cleanup](https://github.com/MobileNativeFoundation/Store/blob/fde07551688ae7f1e22a8da77f6cbcde1454f384/store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/impl/RealMutableStore.kt#L169-L212).  Possible sequence:  1. Write A reaches the server successfully. 2. A’s cleanup computes an empty replacement queue and releases the per-key mutex. 3. Write B enters the existing queue and persists locally. 4. A installs its replacement queue, discarding B. 5. B’s synchronization attempt fails with `No writes found for key=…`.  B receives an error, but this path bypasses failed-sync bookkeeping. The server can hold A while local storage holds B, with no pending queue entry or failure marker for B.  B may still exist locally. The failure is that Store has lost the state needed to synchronize it through eager recovery.  **An older retry can acknowledge a newer failed write**  An eager retry triggered by a read captures a local value before posting it. When the request succeeds, cleanup uses the completion time as its cutoff. See [eager conflict resolution](https://github.com/MobileNati

- **Issue #732** (2026-04-15): **[BUG] not compiling on iOS in a KMP project.**
  *Symptoms*: Getting the following error when building my code for iOS  Compilation failed: No container found for type parameter 'Key' of 'CLASS IR_EXTERNAL_DECLARATION_STUB INTERFACE name:MutableStore modality:ABSTRACT visibility:public superTypes:[org.mobilenativefoundation.store.store5.Read.StreamWithConflictResolution<Key of org.mobilenativefoundation.store.store5.MutableStore, Output of org.mobilenativefoundation.store.store5.MutableStore>; org.mobilenativefoundation.store.store5.Write<Key of org.mobilenativefoundation.store.store5.MutableStore, Output of org.mobilenativefoundation.store.store5.MutableStore>; org.mobilenativefoundation.store.store5.Write.Stream<Key of org.mobilenativefoundation.store.store5.MutableStore, Output of org.mobilenativefoundation.store.store5.MutableStore>; org.mobilenativefoundation.store.store5.Clear.Key<Key of org.mobilenativefoundation.store.store5.MutableStore>; org.mobilenativefoundation.store.store5.Clear]'  It builds without errors for Android. I currently just have a single MutableStoreBuilder in my project, since I'm testing out this library.
  **Post-Mortem & Fix Analysis**:
  > This turned out to be a bug using koin. Where generic types won't work for DI. single<MutableStore<String, DeviceIconModel>> { create(::deviceIconStore) }

- **Issue #730** (2026-01-24): **[BUG]**
  *Symptoms*: > c4cb296af1300e0373eb483bb59d53bc41fb1dc2    _Originally posted by @mohmed1503-stack in [c4cb296](https://github.com/MobileNativeFoundation/Store/commit/c4cb296af1300e0373eb483bb59d53bc41fb1dc2#commitcomment-174378417)_
  **Post-Mortem & Fix Analysis**:
  > @mohmed1503-stack Hey, can you clarify what you're looking for?

- **Issue #726** (2026-01-04): **[BUG]**
  *Symptoms*: **Describe the bug** A clear and concise description of what the bug is.  **To Reproduce** Steps to reproduce the behavior: 1. Go to '...' 2. Click on '....' 3. Scroll down to '....' 4. See error  **Expected behavior** A clear and concise description of what you expected to happen.  **Screenshots** If applicable, add screenshots to help explain your problem.  **Smartphone (please complete the following information):**  - Device: [e.g. Pixel 3]  - OS: [e.g. Android 10]  - Store Version [e.g. 4.0.0]  **Additional context** Add any other context about the problem here. 

- **Issue #724** (2026-01-04): **[BUG]**
  *Symptoms*: **Describe the bug** A clear and concise description of what the bug is.  **To Reproduce** Steps to reproduce the behavior: 1. Go to '...' 2. Click on '....' 3. Scroll down to '....' 4. See error  **Expected behavior** A clear and concise description of what you expected to happen.  **Screenshots** If applicable, add screenshots to help explain your problem.  **Smartphone (please complete the following information):**  - Device: [e.g. Pixel 3]  - OS: [e.g. Android 10]  - Store Version [e.g. 4.0.0]  **Additional context** Add any other context about the problem here. 

- **Issue #722** (2026-01-11): **[BUG] MutableStore.write reports success when SourceOfTruth writer throws**
  *Symptoms*: Thanks for the awesome library, but I just ran into something odd while poking at mutable writes.  **Describe the bug**  When the SourceOfTruth writer throws, `MutableStore.write()` still returns `StoreWriteResponse.Success`, so callers get an explicit success even though nothing was persisted.  Maybe it's intentional to swallow Exceptions -?- , but I think that I shouldn't receive an excplicit success when my data was not written to store. , Also I've spent hours trying to catch this IllegalStateException thrown error but I couldn't  **To Reproduce**  Steps to see it fail:  1. Check out the current `main` of Store5. 2. Add this regression to `store/src/commonTest/kotlin/org/mobilenativefoundation/store/store5/mutablestore/RealMutableStoreTest.kt` (around lines 301‑325):  ```kotlin @Test fun write_givenSourceOfTruthFailure_whenCalled_thenSurfacesWriteError() = runTest {     val failingKey = "sotFailKey"     testSourceOfTruth.throwOnWrite(failingKey) {         IllegalStateException("Catch me if you can")     }     val request = StoreWriteRequest.of<String, Note, Unit>(         key = failingKey,         value = Note("idFail", "contentFail"),         created = 3333L,         onCompletions = null,     )      val response = mutableStore.write(request)      val errorResponse = assertIs<StoreWriteResponse.Error.Exception>(response)     val writeException = assertIs<SourceOfTruth.WriteException>(errorResponse.error)     val cause = assertIs<IllegalStateException>(writeException.cause
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting, @ahmounir. #727 will be included in the next release

- **Issue #708** (2025-08-16): **[BUG]**
  *Symptoms*: **Describe the bug** A clear and concise description of what the bug is.  **To Reproduce** Steps to reproduce the behavior: 1. Go to '...' 2. Click on '....' 3. Scroll down to '....' 4. See error  **Expected behavior** A clear and concise description of what you expected to happen.  **Screenshots** If applicable, add screenshots to help explain your problem.  **Smartphone (please complete the following information):**  - Device: [e.g. Pixel 3]  - OS: [e.g. Android 10]  - Store Version [e.g. 4.0.0]  **Additional context** Add any other context about the problem here. 

- **Issue #707** (2025-08-16): **Shoofly**
  *Symptoms*: Mobile app to show and buy more type of woods and products by direct order or order something to provide The order sent by message in what's app to number+249994743707

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

### Incident Patch 1: `e169107e` (2026-08-29)
**Commit Message**: fix: derive a tagged logger instead of reconfiguring Kermit's global logger (#750)

`DefaultLogger` and `RealStore`'s companion both ran
`Logger.apply { setLogWriters(listOf(CommonWriter())); setTag("Store") }`
on `co.touchlab.kermit.Logger`, which is Kermit's process-global logger
singleton — not a Store-scoped instance. Constructing a Store therefore
reconfigured logging for the entire host application:

- `setLogWriters` replaces the global writer list, dropping any writer the
  host installed via `addLogWriter` (crash-reporter breadcrumbs, file writers).
- `setTag("Store")` overwrites the global default tag, so unrelated host logs
  start appearing under the "Store" tag.
- Because `withTag` shares the same `MutableLoggerConfig`, loggers the host
  derived earlier are affected too.

The usual ordering makes this the common case: hosts configure logging at
startup and build Stores later, so the Store construction silently wipes the
host's logging setup with no error.

Replace both sites with `Logger.withTag("Store")`, which derives a tagged
logger sharing the host's config and mutates no global state. Store's logs now
flow to whatever writers/severity the host configured; on an u

**File**: `store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/impl/DefaultLogger.kt` (modified, +4/-6)
```diff
@@ -1,17 +1,15 @@
 package org.mobilenativefoundation.store.store5.impl
 
-import co.touchlab.kermit.CommonWriter
 import org.mobilenativefoundation.store.store5.Logger
 
 /**
  * Default implementation of [Logger] using the Kermit logging library.
+ *
+ * Derives a tagged logger from Kermit's global instance rather than reconfiguring it, so the host
+ * application's log writers and default tag are left untouched.
  */
 internal class DefaultLogger : Logger {
-    private val delegate =
-        co.touchlab.kermit.Logger.apply {
-            setLogWriters(listOf(CommonWriter()))
-            setTag("Store")
-        }
+    private val delegate = co.touchlab.kermit.Logger.withTag("Store")
 
     override fun debug(message: String) {
         delegate.d(message)
```

**File**: `store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/impl/RealStore.kt` (modified, +3/-6)
```diff
@@ -15,7 +15,6 @@
  */
 package org.mobilenativefoundation.store.store5.impl
 
-import co.touchlab.kermit.CommonWriter
 import co.touchlab.kermit.Logger
 import kotlinx.coroutines.CompletableDeferred
 import kotlinx.coroutines.CoroutineScope
@@ -367,10 +366,8 @@ internal class RealStore<Key : Any, Network : Any, Output : Any, Local : Any>(
     private fun fromMemCache(key: Key) = memCache?.getIfPresent(key)
 
     companion object {
-        private val logger =
-            Logger.apply {
-                setLogWriters(listOf(CommonWriter()))
-                setTag("Store")
-            }
+        // Derives a tagged logger instead of reconfiguring Kermit's global one, which would drop
+        // whatever log writers the host application installed.
+        private val logger = Logger.withTag("Store")
     }
 }
```

---

### Incident Patch 2: `8bfb9d67` (2026-07-12)
**Commit Message**: Fix multicaster race that leaves a new downstream without a producer (#740)

When the last downstream is removed, StoreChannelManager cancels the
producer but keeps the stale reference until the producer's async
UpstreamFinished message is processed. An AddChannel message that
arrives in between sees producer != null and does not restart the
upstream. If nothing was dispatched and piggybackingDownstream is
enabled, doHandleUpstreamClose then parks that downstream as
piggybacked without reactivation, so it never receives a value.

Store hits this via FetcherController (piggybackingDownstream = true):
cancelling a collector of store.stream() and immediately resubscribing
to the same key can hang the new collector forever until an unrelated
subscriber on the same key restarts the fetcher.

Clear the producer reference in doRemove right after cancelAndJoin so
a subsequent AddChannel starts a fresh producer. The stale
UpstreamFinished of the cancelled producer is already ignored by the
identity check in doHandleUpstreamClose.

Signed-off-by: Martin.Strambach <martin.strambach@gmail.com>

**File**: `multicast/src/commonMain/kotlin/org/mobilenativefoundation/store/multicast5/ChannelManager.kt` (modified, +6/-0)
```diff
@@ -321,6 +321,12 @@ internal class StoreChannelManager<T>(
                 channels.removeAt(index)
                 if (!keepUpstreamAlive && channels.isEmpty()) {
                     producer?.cancelAndJoin()
+                    // Clear the dead producer reference right away instead of waiting for its
+                    // UpstreamFinished message. Otherwise a downstream added before that message
+                    // arrives would not restart the upstream and would never receive a value.
+                    // The stale UpstreamFinished is ignored by the identity check in
+                    // doHandleUpstreamClose.
+                    producer = null
                 }
             }
         }
```

**File**: `multicast/src/commonTest/kotlin/org/mobilenativefoundation/store/multicast5/StoreChannelManagerTests.kt` (modified, +46/-0)
```diff
@@ -3,6 +3,8 @@ package org.mobilenativefoundation.store.multicast5
 import app.cash.turbine.test
 import kotlinx.coroutines.CoroutineScope
 import kotlinx.coroutines.Dispatchers
+import kotlinx.coroutines.ExperimentalCoroutinesApi
+import kotlinx.coroutines.awaitCancellation
 import kotlinx.coroutines.channels.Channel
 import kotlinx.coroutines.flow.consumeAsFlow
 import kotlinx.coroutines.flow.filterIsInstance
@@ -11,10 +13,12 @@ import kotlinx.coroutines.flow.onEach
 import kotlinx.coroutines.launch
 import kotlinx.coroutines.sync.Mutex
 import kotlinx.coroutines.sync.withLock
+import kotlinx.coroutines.test.advanceUntilIdle
 import kotlinx.coroutines.test.runTest
 import kotlin.test.Test
 import kotlin.test.assertEquals
 
+@OptIn(ExperimentalCoroutinesApi::class)
 class StoreChannelManagerTests {
     @Test
     fun cancelledDownstreamChannelShouldNotCancelOtherChannels() =
@@ -72,6 +76,48 @@ class StoreChannelManagerTests {
             }
         }
 
+    @Test
+    fun downstreamAddedWhileUpstreamCancellationIsInFlightShouldRestartUpstream() =
+        runTest {
+            var upstreamCollectionCount = 0
+            val upstreamFlow =
+                flow {
+                    upstreamCollectionCount++
+                    if (upstreamCollectionCount == 1) {
+                        awaitCancellation()
+                    } else {
+                        emit(1)
+                    }
+                }
+            val channelManager =
+                StoreChannelManager(
+                    scope = this,
+                    bufferSize = 0,
+                    upstream = upstreamFlow,
+                    piggybackingDownstream = true,
+                    keepUpstreamAlive = false,
+                    onEach = { },
+                )
+            val firstChannel = Channel<ChannelManager.Message.Dispatch.Value<Int>>(Channel.UNLIMITED)
+            val secondChannel = Channel<ChannelManager.Message.Dispatch.Value<Int>>(Channel.UNLIMITED)
+
+            channelManager.addDownstream(firstChannel)
+            advanceUntilIdle()
+
+            // Removing the last downstream makes the actor suspend in doRemove on
+            // producer.cancelAndJoin(). Adding the next downstream right away enqueues its
+            // AddChannel message ahead of the producer's UpstreamFinished message, so the add is
+            // processed while the dead producer reference is still set.
+            channelManager.removeDownstream(firstChannel)
+            channelManager.addDownstream(secondChannel)
+            advanceUntilIdle()
+
+            val dispatchedValue = secondChannel.tryReceive().getOrNull()
+            assertEquals(1, dispatchedValue?.value)
+
+            channelManager.close()
+        }
+
     private fun createChannels(count: Int): List<Channel<ChannelManager.Message.Dispatch<Int>>> {
         return (1..count).map { Channel(Channel.UNLIMITED) }
     }
```

---

### Incident Patch 3: `0225d8fe` (2026-06-10)
**Commit Message**: Fix RealMutableStore write-queue data race (inverted lock polarity) (#735)

* Fix RealMutableStore write-queue data race (inverted lock polarity)

The per-key write-request queue is a non-thread-safe ArrayDeque, but
withWriteRequestQueueLock guarded it with a Lightswitch — a shared/reader
lock that lets multiple holders run concurrently. So addWriteRequestToQueue
(add) and updateWriteRequestQueue (iterate + rebuild) could run on the same
deque at once. A structural add during iteration corrupts the backing array:
ConcurrentModificationException on the JVM, EXC_BAD_ACCESS on Kotlin/Native.
The only exclusive (mutex) holder was a pure read (getLatestWriteRequest) —
the polarity was inverted.

Guard all write-queue access with the per-key exclusive mutex instead, so
add/iterate/rebuild mutually exclude each other and getLatestWriteRequest.

Adds MutableStoreConcurrencyTest reproducing the race (red pre-fix on both
JVM and native, green after). Lightswitch is now unused in RealMutableStore;
left in place to keep the diff focused (can be removed as a follow-up).

Signed-off-by: Martin Strambach <martin.strambach@gmail.com>

* Remove now-dead Lightswitch

After the previous commit nothin

**File**: `store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/impl/RealMutableStore.kt` (modified, +7/-6)
```diff
@@ -222,13 +222,14 @@ internal class RealMutableStore<Key : Any, Network : Any, Output : Any, Local :
         // Acquire the ThreadSafety object for this key without holding storeLock.
         val threadSafety = getThreadSafety(key)
 
-        // Now safely lock the queue's own mutex.
-        threadSafety.writeRequests.lightswitch.lock(threadSafety.writeRequests.mutex)
-        return try {
-            val queue = getQueue((key))
+        // Exclusively lock the queue's own mutex. The block both reads and structurally mutates the
+        // per-key ArrayDeque (add / iterate-and-rebuild), so callers must mutually exclude each other.
+        // A shared/reader lock here would allow a concurrent add() during iteration, corrupting the
+        // deque's backing array — a ConcurrentModificationException on the JVM and an EXC_BAD_ACCESS
+        // on Kotlin/Native.
+        return threadSafety.writeRequests.mutex.withLock {
+            val queue = getQueue(key)
             queue.block()
-        } finally {
-            threadSafety.writeRequests.lightswitch.unlock(threadSafety.writeRequests.mutex)
         }
     }
 
```

**File**: `store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/internal/concurrent/Lightswitch.kt` (removed, +0/-33)
```diff
@@ -1,33 +0,0 @@
-package org.mobilenativefoundation.store.store5.internal.concurrent
-
-import kotlinx.coroutines.sync.Mutex
-import kotlinx.coroutines.sync.withLock
-
-/**
- * Locks when first reader starts and unlocks when last reader finishes.
- * Lightswitch analogy: First one into a room turns on the light (locks the mutex), and the last one out turns off the light (unlocks the mutex).
- * @property counter Number of readers
- */
-internal class Lightswitch {
-    private var counter = 0
-    private val mutex = Mutex()
-
-    suspend fun lock(room: Mutex) {
-        mutex.withLock {
-            counter += 1
-            if (counter == 1) {
-                room.lock()
-            }
-        }
-    }
-
-    suspend fun unlock(room: Mutex) {
-        mutex.withLock {
-            counter -= 1
-            check(counter >= 0)
-            if (counter == 0) {
-                room.unlock()
-            }
-        }
-    }
-}
```

**File**: `store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/internal/concurrent/ThreadSafety.kt` (modified, +0/-1)
```diff
@@ -9,5 +9,4 @@ internal data class ThreadSafety(
 
 internal data class StoreThreadSafety(
     val mutex: Mutex = Mutex(),
-    val lightswitch: Lightswitch = Lightswitch(),
 )
```

**File**: `store/src/commonTest/kotlin/org/mobilenativefoundation/store/store5/mutablestore/MutableStoreConcurrencyTest.kt` (added, +126/-0)
```diff
@@ -0,0 +1,126 @@
+@file:OptIn(ExperimentalCoroutinesApi::class, ExperimentalStoreApi::class)
+
+package org.mobilenativefoundation.store.store5.mutablestore
+
+import kotlinx.coroutines.Dispatchers
+import kotlinx.coroutines.ExperimentalCoroutinesApi
+import kotlinx.coroutines.async
+import kotlinx.coroutines.awaitAll
+import kotlinx.coroutines.coroutineScope
+import kotlinx.coroutines.test.runTest
+import org.mobilenativefoundation.store.cache5.CacheBuilder
+import org.mobilenativefoundation.store.core5.ExperimentalStoreApi
+import org.mobilenativefoundation.store.store5.StoreWriteRequest
+import org.mobilenativefoundation.store.store5.StoreWriteResponse
+import org.mobilenativefoundation.store.store5.Updater
+import org.mobilenativefoundation.store.store5.UpdaterResult
+import org.mobilenativefoundation.store.store5.impl.RealMutableStore
+import org.mobilenativefoundation.store.store5.impl.RealStore
+import org.mobilenativefoundation.store.store5.mutablestore.util.TestConverter
+import org.mobilenativefoundation.store.store5.mutablestore.util.TestFetcher
+import org.mobilenativefoundation.store.store5.mutablestore.util.TestLogger
+import org.mobilenativefoundation.store.store5.mutablestore.util.TestValidator
+import org.mobilenativefoundation.store.store5.mutablestore.util.testStore
+import kotlin.test.Test
+import kotlin.test.assertTrue
+
+/**
+ * Regression test for a data race in [RealMutableStore]'s per-key write-request queue.
+ *
+ * The queue is a non-thread-safe `ArrayDeque`. Mutating access goes through
+ * `withWriteRequestQueueLock`, which historically guarded it with a shared/reader lock that lets
+ * multiple holders run concurrently. As a result two operations on the same key could run at once:
+ * `addWriteRequestToQueue` doing `add(...)` while `updateWriteRequestQueue` iterates the same deque
+ * (`for (writeRequest in this)`). A structural `add` during iteration corrupts the backing array.
+ *
+ * On Kotlin/Native this surfaces as `EXC_BAD_ACCESS` (a hard process crash). On the JVM the deque's
+ * fail-fast iterator throws `ConcurrentModificationException`, which `RealMutableStore` catches and
+ * converts into a [StoreWriteResponse.Error.Exception]. Either way, with correct mutual exclusion
+ * every write should succeed.
+ *
+ * The delegate is backed by a real thread-safe cache (cache5) with no source of truth, so the only
+ * unsynchronized shared mutable state exercised here is the write-request queue itself.
+ */
+@OptIn(ExperimentalCoroutinesApi::class, ExperimentalStoreApi::class)
+class MutableStoreConcurrencyTest {
+    private fun newMutableStore(): RealMutableStore<String, Int, Int, Int> {
+        val delegate: RealStore<String, Int, Int, Int> =
+            testStore(
+                fetcher = TestFetcher(),
+                sourceOfTruth = null,
+                converter = TestConverter(),
+                validator = TestValidator(),
+                memoryCache = CacheBuilder<String, Int>().build(),
+            )
+        return RealMutableStore(
+            delegate = delegate,
+            updater = Updater.by<String, Int, Int>({ _, value -> UpdaterResult.Success.Typed(value) }),
+            bookkeeper = null,
+            logger = TestLogger(),
+        )
+    }
+
+    @Test
+    fun sequentialWritesToSameKey_allSucceed() =
+        runTest {
+            val mutableStore = newMutableStore()
+            val key = "key"
+            val responses = (1..500).map { i -> mutableStore.write<Int>(StoreWriteRequest.of(key = key, value = i)) }
+            val failures = responses.filterIsInstance<StoreWriteResponse.Error.Exception>()
+            assertTrue(
+                failures.isEmpty(),
+                "Baseline sequential writes should all succeed, but ${failures.size} failed" +
+                    (failures.firstOrNull()?.let { ", first error = ${it.error}" } ?: ""),
+            )
+        }
+
+    @Test
+    fun concurrentWritesToSameKey_doNotCorruptWriteQueue() =
+        r
```

---

### Incident Patch 4: `80db9675` (2026-06-07)
**Commit Message**: Fix CI checkout and coverage upload for fork PRs (#737)

**File**: `.github/workflows/ci.yml` (modified, +13/-1)
```diff
@@ -18,7 +18,15 @@ jobs:
       - name: Checkout
         uses: actions/checkout@v4
         with:
-          ref: ${{ github.head_ref || github.ref }}
+          # PR builds (including forks) check out the PR head from its source repo;
+          # push builds fall back to the pushed ref on this repo. Without the
+          # repository override, fork-PR checkouts look for the head branch in the
+          # base repo and fail with "a branch or tag ... could not be found".
+          # Use the branch name (not the head SHA) so HEAD stays attached to a
+          # branch — the KMMBridge plugin runs `git pull --tags`, which fails on a
+          # detached HEAD with "you are not currently on a branch".
+          repository: ${{ github.event.pull_request.head.repo.full_name || github.repository }}
+          ref: ${{ github.event.pull_request.head.ref || github.ref }}
           fetch-depth: 0
           persist-credentials: false
 
@@ -38,6 +46,10 @@ jobs:
         run: ./gradlew clean build koverXmlReport --stacktrace
 
       - name: Upload Coverage to Codecov
+        # Secrets (including CODECOV_TOKEN) are not exposed to fork PRs, so the
+        # upload would fail under fail_ci_if_error. Skip it for forks; coverage is
+        # still uploaded and enforced for same-repo PRs and pushes to main.
+        if: ${{ github.event.pull_request.head.repo.full_name == github.repository || github.event_name != 'pull_request' }}
         uses: codecov/codecov-action@v4
         with:
           token: ${{ secrets.CODECOV_TOKEN }}
```

---

### Incident Patch 5: `cfb4ae05` (2026-01-11)
**Commit Message**: Fix MutableStore.write() ignoring SourceOfTruth write failures (#727)

Signed-off-by: Matt Ramotar <matt.ramotar@uber.com>

**File**: `store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/impl/RealMutableStore.kt` (modified, +23/-17)
```diff
@@ -24,6 +24,7 @@ import org.mobilenativefoundation.store.store5.impl.extensions.now
 import org.mobilenativefoundation.store.store5.internal.concurrent.ThreadSafety
 import org.mobilenativefoundation.store.store5.internal.definition.WriteRequestQueue
 import org.mobilenativefoundation.store.store5.internal.result.EagerConflictResolutionResult
+import org.mobilenativefoundation.store.store5.internal.result.StoreDelegateWriteResult
 
 @OptIn(ExperimentalStoreApi::class)
 internal class RealMutableStore<Key : Any, Network : Any, Output : Any, Local : Any>(
@@ -85,25 +86,30 @@ internal class RealMutableStore<Key : Any, Network : Any, Output : Any, Local :
                     val storeWriteResponse =
                         try {
                             // Always write to local first.
-                            delegate.write(writeRequest.key, writeRequest.value)
-
-                            // Try to sync to network.
-                            val updaterResult = tryUpdateServer(writeRequest)
-
-                            // Convert UpdaterResult -> StoreWriteResponse.
-                            when (updaterResult) {
-                                is UpdaterResult.Error.Exception -> StoreWriteResponse.Error.Exception(updaterResult.error)
-                                is UpdaterResult.Error.Message -> StoreWriteResponse.Error.Message(updaterResult.message)
-                                is UpdaterResult.Success.Typed<*> -> {
-                                    val typedValue = updaterResult.value as? Response
-                                    if (typedValue == null) {
-                                        StoreWriteResponse.Success.Untyped(updaterResult.value)
-                                    } else {
-                                        StoreWriteResponse.Success.Typed(updaterResult.value)
+                            // Only proceed to network if local write succeeded.
+                            when (val delegateWriteResult = delegate.write(writeRequest.key, writeRequest.value)) {
+                                is StoreDelegateWriteResult.Error.Exception -> {
+                                    StoreWriteResponse.Error.Exception(delegateWriteResult.error)
+                                }
+                                is StoreDelegateWriteResult.Error.Message -> {
+                                    StoreWriteResponse.Error.Message(delegateWriteResult.error)
+                                }
+                                is StoreDelegateWriteResult.Success -> {
+                                    // Try to sync to network.
+                                    when (val updaterResult = tryUpdateServer(writeRequest)) {
+                                        is UpdaterResult.Error.Exception -> StoreWriteResponse.Error.Exception(updaterResult.error)
+                                        is UpdaterResult.Error.Message -> StoreWriteResponse.Error.Message(updaterResult.message)
+                                        is UpdaterResult.Success.Typed<*> -> {
+                                            val typedValue = updaterResult.value as? Response
+                                            if (typedValue == null) {
+                                                StoreWriteResponse.Success.Untyped(updaterResult.value)
+                                            } else {
+                                                StoreWriteResponse.Success.Typed(updaterResult.value)
+                                            }
+                                        }
+                                        is UpdaterResult.Success.Untyped -> StoreWriteResponse.Success.Untyped(updaterResult.value)
                                     }
                                 }
-
-                                is UpdaterResult.Success.Untyped -> StoreWriteResponse.Success.Untyped(updaterResult.value)
                             }
                         } catch (throwable: Throwable)
```

**File**: `store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/impl/RealStore.kt` (modified, +7/-3)
```diff
@@ -332,9 +332,13 @@ internal class RealStore<Key : Any, Network : Any, Output : Any, Local : Any>(
         value: Output,
     ): StoreDelegateWriteResult =
         try {
-            memCache?.put(key, value)
-            sourceOfTruth?.write(key, converter.fromOutputToLocal(value))
-            StoreDelegateWriteResult.Success
+            val writeException = sourceOfTruth?.write(key, converter.fromOutputToLocal(value))
+            if (writeException != null) {
+                StoreDelegateWriteResult.Error.Exception(writeException)
+            } else {
+                memCache?.put(key, value)
+                StoreDelegateWriteResult.Success
+            }
         } catch (error: Throwable) {
             StoreDelegateWriteResult.Error.Exception(error)
         }
```

**File**: `store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/impl/SourceOfTruthWithBarrier.kt` (modified, +24/-14)
```diff
@@ -144,11 +144,18 @@ internal class SourceOfTruthWithBarrier<Key : Any, Network : Any, Output : Any,
         }
     }
 
+    /**
+     * Writes a value to the underlying [SourceOfTruth] and returns any error that occurred.
+     *
+     * @return The [SourceOfTruth.WriteException] if the write failed, or null if successful.
+     *         Callers like [RealStore.write] can check this to determine if the write succeeded.
+     *         The barrier mechanism also notifies readers of the error via [BarrierMsg.Open.writeError].
+     */
     @Suppress("UNCHECKED_CAST")
     suspend fun write(
         key: Key,
         value: Local,
-    ) {
+    ): SourceOfTruth.WriteException? {
         val barrier = barriers.acquire(key)
         try {
             barrier.emit(BarrierMsg.Blocked(versionCounter.incrementAndGet()))
@@ -164,24 +171,27 @@ internal class SourceOfTruthWithBarrier<Key : Any, Network : Any, Output : Any,
                     }
                 }
 
+            // Avoid double-wrapping if the error is already a WriteException.
+            val writeException =
+                writeError?.let {
+                    writeError as? SourceOfTruth.WriteException
+                        ?: SourceOfTruth.WriteException(
+                            key = key,
+                            value = value,
+                            cause = writeError,
+                        )
+                }
+
             barrier.emit(
                 BarrierMsg.Open(
                     version = versionCounter.incrementAndGet(),
-                    writeError =
-                        writeError?.let {
-                            SourceOfTruth.WriteException(
-                                key = key,
-                                value = value,
-                                cause = writeError,
-                            )
-                        },
+                    writeError = writeException,
                 ),
             )
-            if (writeError is CancellationException) {
-                // only throw if it failed because of cancelation.
-                // otherwise, we take care of letting downstream know that there was a write error
-                throw writeError
-            }
+
+            // Return the error so callers know the operation failed.
+            // The barrier message above notifies readers of the error.
+            return writeException
         } finally {
             barriers.release(key, barrier)
         }
```

**File**: `store/src/commonTest/kotlin/org/mobilenativefoundation/store/store5/mutablestore/RealMutableStoreTest.kt` (modified, +110/-0)
```diff
@@ -11,6 +11,7 @@ import kotlinx.coroutines.flow.toList
 import kotlinx.coroutines.test.runTest
 import org.mobilenativefoundation.store.core5.ExperimentalStoreApi
 import org.mobilenativefoundation.store.store5.FetcherResult
+import org.mobilenativefoundation.store.store5.SourceOfTruth
 import org.mobilenativefoundation.store.store5.StoreReadRequest
 import org.mobilenativefoundation.store.store5.StoreReadResponse
 import org.mobilenativefoundation.store.store5.StoreWriteRequest
@@ -297,6 +298,115 @@ class RealMutableStoreTest {
             assertNotNull(testBookkeeper.getLastFailedSync("exceptionKey"))
         }
 
+    @Test
+    fun write_givenSourceOfTruthFailure_whenCalled_thenSurfacesWriteError() =
+        runTest {
+            // Given
+            val key = "key"
+            val errorMessage = "write error"
+            testSourceOfTruth.throwOnWrite(key) {
+                IllegalStateException(errorMessage)
+            }
+            val request =
+                StoreWriteRequest.of<String, Note, Unit>(
+                    key = key,
+                    value = Note(key, "content"),
+                    created = 3333L,
+                    onCompletions = null,
+                )
+
+            // When
+            val response = mutableStore.write(request)
+
+            // Then
+            val errorResponse = assertIs<StoreWriteResponse.Error.Exception>(response)
+            val writeException = assertIs<SourceOfTruth.WriteException>(errorResponse.error)
+            val cause = assertIs<IllegalStateException>(writeException.cause)
+            assertEquals(errorMessage, cause.message)
+        }
+
+    @Test
+    fun write_givenSourceOfTruthFailure_whenCalled_thenNetworkSyncNotAttempted() =
+        runTest {
+            // Given
+            val key = "key"
+            testUpdater.postCallCount = 0
+            testSourceOfTruth.throwOnWrite(key) { IllegalStateException("SOT failure") }
+
+            val request =
+                StoreWriteRequest.of<String, Note, Unit>(
+                    key = key,
+                    value = Note(key, "content"),
+                    created = 4444L,
+                    onCompletions = null,
+                )
+
+            // When
+            val response = mutableStore.write(request)
+
+            // Then
+            assertIs<StoreWriteResponse.Error.Exception>(response)
+            assertEquals(0, testUpdater.postCallCount, "Network updater should not be called when SOT write fails")
+        }
+
+    @Test
+    fun write_givenSourceOfTruthFailure_whenCalled_thenMemCacheNotUpdated() =
+        runTest {
+            // Given
+            val key = "key"
+            testSourceOfTruth.throwOnWrite(key) { IllegalStateException("SOT failure") }
+
+            val request =
+                StoreWriteRequest.of<String, Note, Unit>(
+                    key = key,
+                    value = Note(key, "content"),
+                    created = 6666L,
+                    onCompletions = null,
+                )
+
+            // When
+            val response = mutableStore.write(request)
+
+            // Then
+            assertIs<StoreWriteResponse.Error.Exception>(response)
+            assertNull(delegateStore.latestOrNull(key), "Value should not be in cache after SOT write failure")
+        }
+
+    @Test
+    fun write_givenNoSourceOfTruth_whenCalled_thenSucceeds() =
+        runTest {
+            // Given
+            val storeWithoutSot =
+                testStore(
+                    fetcher = testFetcher,
+                    sourceOfTruth = null,
+                    converter = testConverter,
+                    validator = testValidator,
+                    memoryCache = testCache,
+                )
+            val mutableStoreWithoutSot =
+                RealMutableStore(
+                    delegate = storeWithoutSot,
+                    updater = testUpdater,
+                    bookkeeper = testBookkeeper,
+               
```

**File**: `store/src/commonTest/kotlin/org/mobilenativefoundation/store/store5/mutablestore/util/TestStore.kt` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ internal fun <Key : Any, Network : Any, Output : Any, Local : Any> testStore(
     dispatcher: CoroutineDispatcher = Dispatchers.Default,
     scope: CoroutineScope = CoroutineScope(dispatcher),
     fetcher: Fetcher<Key, Network> = TestFetcher(),
-    sourceOfTruth: SourceOfTruth<Key, Local, Output> = TestSourceOfTruth(),
+    sourceOfTruth: SourceOfTruth<Key, Local, Output>? = TestSourceOfTruth(),
     converter: Converter<Network, Local, Output> = TestConverter(),
     validator: Validator<Output> = TestValidator(),
     memoryCache: Cache<Key, Output> = TestCache(),
```

---

### Incident Patch 6: `68013443` (2025-02-25)
**Commit Message**: Fix Eager Conflict Resolution Deadlock and Improve Mutable Store Code Quality (#679)

* Fix and Cover Eager Conflict Resolution Deadlock

Signed-off-by: Matt Ramotar <matt.ramotar@uber.com>

* Cover RealMutableStore

Signed-off-by: Matt Ramotar <matt.ramotar@uber.com>

---------

Signed-off-by: Matt Ramotar <matt.ramotar@uber.com>

**File**: `store/api/android/store.api` (modified, +9/-3)
```diff
@@ -123,6 +123,15 @@ public final class org/mobilenativefoundation/store/store5/FetcherResult$Error$M
 	public fun toString ()Ljava/lang/String;
 }
 
+public abstract interface class org/mobilenativefoundation/store/store5/Logger {
+	public abstract fun debug (Ljava/lang/String;)V
+	public abstract fun error (Ljava/lang/String;Ljava/lang/Throwable;)V
+}
+
+public final class org/mobilenativefoundation/store/store5/Logger$DefaultImpls {
+	public static synthetic fun error$default (Lorg/mobilenativefoundation/store/store5/Logger;Ljava/lang/String;Ljava/lang/Throwable;ILjava/lang/Object;)V
+}
+
 public final class org/mobilenativefoundation/store/store5/MemoryPolicy {
 	public static final field Companion Lorg/mobilenativefoundation/store/store5/MemoryPolicy$Companion;
 	public static final field DEFAULT_SIZE_POLICY J
@@ -612,9 +621,6 @@ public final class org/mobilenativefoundation/store/store5/impl/extensions/Store
 	public static final fun get (Lorg/mobilenativefoundation/store/store5/Store;Ljava/lang/Object;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;
 }
 
-public abstract interface annotation class org/mobilenativefoundation/store/store5/internal/concurrent/AnyThread : java/lang/annotation/Annotation {
-}
-
 public abstract class org/mobilenativefoundation/store/store5/internal/result/EagerConflictResolutionResult {
 }
 
```

**File**: `store/api/jvm/store.api` (modified, +9/-3)
```diff
@@ -116,6 +116,15 @@ public final class org/mobilenativefoundation/store/store5/FetcherResult$Error$M
 	public fun toString ()Ljava/lang/String;
 }
 
+public abstract interface class org/mobilenativefoundation/store/store5/Logger {
+	public abstract fun debug (Ljava/lang/String;)V
+	public abstract fun error (Ljava/lang/String;Ljava/lang/Throwable;)V
+}
+
+public final class org/mobilenativefoundation/store/store5/Logger$DefaultImpls {
+	public static synthetic fun error$default (Lorg/mobilenativefoundation/store/store5/Logger;Ljava/lang/String;Ljava/lang/Throwable;ILjava/lang/Object;)V
+}
+
 public final class org/mobilenativefoundation/store/store5/MemoryPolicy {
 	public static final field Companion Lorg/mobilenativefoundation/store/store5/MemoryPolicy$Companion;
 	public static final field DEFAULT_SIZE_POLICY J
@@ -605,9 +614,6 @@ public final class org/mobilenativefoundation/store/store5/impl/extensions/Store
 	public static final fun get (Lorg/mobilenativefoundation/store/store5/Store;Ljava/lang/Object;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;
 }
 
-public abstract interface annotation class org/mobilenativefoundation/store/store5/internal/concurrent/AnyThread : java/lang/annotation/Annotation {
-}
-
 public abstract class org/mobilenativefoundation/store/store5/internal/result/EagerConflictResolutionResult {
 }
 
```

**File**: `store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/Logger.kt` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+package org.mobilenativefoundation.store.store5
+
+/**
+ * A simple logging interface for logging error and debug messages.
+ */
+interface Logger {
+    /**
+     * Logs an error message, optionally with a throwable.
+     *
+     * @param message The error message to log.
+     * @param throwable An optional [Throwable] associated with the error.
+     */
+    fun error(
+        message: String,
+        throwable: Throwable? = null,
+    )
+
+    /**
+     * Logs a debug message.
+     *
+     * @param message The debug message to log.
+     */
+    fun debug(message: String)
+}
```

**File**: `store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/impl/DefaultLogger.kt` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+package org.mobilenativefoundation.store.store5.impl
+
+import co.touchlab.kermit.CommonWriter
+import org.mobilenativefoundation.store.store5.Logger
+
+/**
+ * Default implementation of [Logger] using the Kermit logging library.
+ */
+internal class DefaultLogger : Logger {
+    private val delegate =
+        co.touchlab.kermit.Logger.apply {
+            setLogWriters(listOf(CommonWriter()))
+            setTag("Store")
+        }
+
+    override fun debug(message: String) {
+        delegate.d(message)
+    }
+
+    override fun error(
+        message: String,
+        throwable: Throwable?,
+    ) {
+        delegate.e(message, throwable)
+    }
+}
```

**File**: `store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/impl/RealMutableStore.kt` (modified, +140/-76)
```diff
@@ -2,8 +2,6 @@
 
 package org.mobilenativefoundation.store.store5.impl
 
-import co.touchlab.kermit.CommonWriter
-import co.touchlab.kermit.Logger
 import kotlinx.coroutines.flow.Flow
 import kotlinx.coroutines.flow.first
 import kotlinx.coroutines.flow.flow
@@ -14,6 +12,7 @@ import kotlinx.coroutines.sync.withLock
 import org.mobilenativefoundation.store.core5.ExperimentalStoreApi
 import org.mobilenativefoundation.store.store5.Bookkeeper
 import org.mobilenativefoundation.store.store5.Clear
+import org.mobilenativefoundation.store.store5.Logger
 import org.mobilenativefoundation.store.store5.MutableStore
 import org.mobilenativefoundation.store.store5.StoreReadRequest
 import org.mobilenativefoundation.store.store5.StoreReadResponse
@@ -22,59 +21,77 @@ import org.mobilenativefoundation.store.store5.StoreWriteResponse
 import org.mobilenativefoundation.store.store5.Updater
 import org.mobilenativefoundation.store.store5.UpdaterResult
 import org.mobilenativefoundation.store.store5.impl.extensions.now
-import org.mobilenativefoundation.store.store5.internal.concurrent.AnyThread
 import org.mobilenativefoundation.store.store5.internal.concurrent.ThreadSafety
 import org.mobilenativefoundation.store.store5.internal.definition.WriteRequestQueue
 import org.mobilenativefoundation.store.store5.internal.result.EagerConflictResolutionResult
 
-@ExperimentalStoreApi
+@OptIn(ExperimentalStoreApi::class)
 internal class RealMutableStore<Key : Any, Network : Any, Output : Any, Local : Any>(
     private val delegate: RealStore<Key, Network, Output, Local>,
     private val updater: Updater<Key, Output, *>,
     private val bookkeeper: Bookkeeper<Key>?,
+    private val logger: Logger = DefaultLogger(),
 ) : MutableStore<Key, Output>, Clear.Key<Key> by delegate, Clear.All by delegate {
     private val storeLock = Mutex()
     private val keyToWriteRequestQueue = mutableMapOf<Key, WriteRequestQueue<Key, Output, *>>()
     private val keyToThreadSafety = mutableMapOf<Key, ThreadSafety>()
 
     override fun <Response : Any> stream(request: StoreReadRequest<Key>): Flow<StoreReadResponse<Output>> =
         flow {
+            // Ensure we are ready for this key.
             safeInitStore(request.key)
 
+            // Try to eagerly resolve conflicts before pulling from network.
             when (val eagerConflictResolutionResult = tryEagerlyResolveConflicts<Response>(request.key)) {
+                // TODO(#678): Many use cases will not want to pull immediately after failing to push local changes.
+                // We should enable configuration of conflict resolution strategies, such as logging, retrying, canceling.
+
                 is EagerConflictResolutionResult.Error.Exception -> {
-                    logger.e(eagerConflictResolutionResult.error.toString())
+                    logger.error(eagerConflictResolutionResult.error.toString())
                 }
 
                 is EagerConflictResolutionResult.Error.Message -> {
-                    logger.e(eagerConflictResolutionResult.message)
+                    logger.error(eagerConflictResolutionResult.message)
                 }
 
                 is EagerConflictResolutionResult.Success.ConflictsResolved -> {
-                    logger.d(eagerConflictResolutionResult.value.toString())
+                    logger.debug(eagerConflictResolutionResult.value.toString())
                 }
 
                 EagerConflictResolutionResult.Success.NoConflicts -> {
-                    logger.d(eagerConflictResolutionResult.toString())
+                    logger.debug("No conflicts.")
                 }
             }
 
+            // Now, we can just delegate to the underlying stream.
             delegate.stream(request).collect { storeReadResponse -> emit(storeReadResponse) }
         }
 
     @ExperimentalStoreApi
     override fun <Response : Any> stream(requestStream: Flow<StoreWriteRequest<Key, Output, Response>>): Flow<StoreWriteResponse> =
         flow {
+          
```

---

### Incident Patch 7: `2aa32134` (2025-02-23)
**Commit Message**: fix(deps): update dependency org.jetbrains.kotlinx:kotlinx-datetime to v0.6.2 (#688)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ kotlinx-serialization-json = { group = "org.jetbrains.kotlinx", name = "kotlinx-
 kotlinx-coroutines-android = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-android", version.ref = "kotlinxCoroutines" }
 kotlinx-coroutines-core = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-core", version.ref = "kotlinxCoroutines" }
 kotlinx-coroutines-rx2 = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-rx2", version.ref = "kotlinxCoroutines" }
-kotlinx-datetime = { group = "org.jetbrains.kotlinx", name = "kotlinx-datetime", version = "0.6.1" }
+kotlinx-datetime = { group = "org.jetbrains.kotlinx", name = "kotlinx-datetime", version = "0.6.2" }
 molecule-gradle-plugin = { module = "app.cash.molecule:molecule-gradle-plugin", version.ref = "moleculeGradlePlugin" }
 molecule-runtime = { module = "app.cash.molecule:molecule-runtime", version.ref = "moleculeGradlePlugin" }
 rxjava = { group = "io.reactivex.rxjava2", name = "rxjava", version = "2.2.21" }
```

---

### Incident Patch 8: `0dff4e23` (2025-02-23)
**Commit Message**: fix(deps): update dependency org.jetbrains.dokka:dokka-gradle-plugin to v1.9.20 (#687)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ androidGradlePlugin = "7.4.2"
 androidTargetSdk = "33"
 atomicFu = "0.24.0"
 baseKotlin = "2.0.20"
-dokkaGradlePlugin = "1.9.10"
+dokkaGradlePlugin = "1.9.20"
 ktlintGradle = "12.1.0"
 jacocoGradlePlugin = "0.8.12"
 mavenPublishPlugin = "0.22.0"
```

---

### Incident Patch 9: `ffc1c367` (2025-02-23)
**Commit Message**: fix(deps): update dependency org.jacoco:org.jacoco.core to v0.8.12 (#686)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ atomicFu = "0.24.0"
 baseKotlin = "2.0.20"
 dokkaGradlePlugin = "1.9.10"
 ktlintGradle = "12.1.0"
-jacocoGradlePlugin = "0.8.7"
+jacocoGradlePlugin = "0.8.12"
 mavenPublishPlugin = "0.22.0"
 moleculeGradlePlugin = "1.2.1"
 pagingCompose = "3.3.0-alpha02"
```

---

### Incident Patch 10: `ed7c31b7` (2025-02-22)
**Commit Message**: fix(deps): update dependency jacoco to v0.8.12 (#684)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/jacoco.gradle` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
 apply plugin: "jacoco"
 
 jacoco {
-    toolVersion = "0.8.7"
+    toolVersion = "0.8.12"
 }
 // Android Gradle Plugin out of the box supports only code coverage for instrumentation tests.
 // Creates a task that will merge coverage for all projects
```

#### Recent Merged Pull Requests:
- **PR #764** (2026-09-13): First alpha of Store 6 (@matt-ramotar)
- **PR #763** (2026-09-08): Release 5.1.0-beta01 (@matt-ramotar)
- **PR #762** (2026-09-08): fix(store): synchronize mutable writes by admitted batch (@matt-ramotar)
- **PR #759** (2026-08-29): Release 5.1.0-alpha11 (@matt-ramotar)
- **PR #758** (closed): chore(layout): drop store6- prefix from modules (@matt-ramotar)
- **PR #757** (closed): Adopt Agent Plugins v1 package layout (@matt-ramotar)
- **PR #756** (closed): Update baseKotlin to v2.4.10 - autoclosed (@renovate[bot])
- **PR #755** (closed): docs: alpha01 source documentation cleanup (@matt-ramotar)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
