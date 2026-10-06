# Forensic Learning Record (Deep Inspection): badoo/Reaktive

> **Canonical Artifact**: `07_PROJECT_LEARNING/badoo-reaktive-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/badoo/Reaktive](https://github.com/badoo/Reaktive))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:05:36.289Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `badoo/Reaktive`
- **Description**: Kotlin multi-platform implementation of Reactive Extensions
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1214 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `reaktive/src/androidMain/kotlin/com/badoo/reaktive/utils/PrintError.kt`
```
@file:JvmName("PrintError")

package com.badoo.reaktive.utils

import android.util.Log

internal actual fun printError(error: Any?) {
    try {
        Log.e("Reaktive", error.toString())
    } catch (ignored: RuntimeException) {
        // Fails in unit tests
    }
}

```

### Core Architecture Module: `reaktive/src/commonMain/kotlin/com/badoo/reaktive/subject/LinkedQueue.kt`
```
package com.badoo.reaktive.subject

import com.badoo.reaktive.utils.atomic.AtomicReference

internal class LinkedQueue<T>(
    private val limit: Int,
) {
    private val _head = AtomicReference<MutableNode<T>?>(null)
    val head: Node<T>? get() = _head.value // Can be read concurrently

    private var tail: MutableNode<T>? = null
    private var size: Int = 0

    fun addLast(value: T) {
        val node = MutableNode(value)

        if (size == 0) {
            _head.value = node
            tail = node
            size++
        } else {
            requireNotNull(tail).next = node
            tail = node

            if (size < limit) {
                size++
            } else {
                _head.value = requireNotNull(_head.value).next
            }
        }
    }

    interface Node<out T> {
        val value: T
        val next: Node<T>?
    }

    private class MutableNode<T>(override val value: T) : Node<T> {
        override var next: MutableNode<T>? = null
    }
}

```

### Core Architecture Module: `reaktive/src/commonMain/kotlin/com/badoo/reaktive/subject/LinkedQueueExt.kt`
```
package com.badoo.reaktive.subject

internal fun <T> LinkedQueue.Node<T>.forEachAndGetLast(block: (T) -> Unit): LinkedQueue.Node<T> {
    var node = this

    while (true) {
        block(node.value)
        node = node.next ?: break
    }

    return node
}

```

### Core Architecture Module: `reaktive/src/commonMain/kotlin/com/badoo/reaktive/utils/CollectionExt.kt`
```
package com.badoo.reaktive.utils

internal fun <T> List<T>.replace(index: Int, element: T): List<T> =
    ArrayList(this)
        .apply { set(index, element) }

internal fun <T> List<T>.insert(index: Int, element: T): List<T> =
    when {
        (index < 0) || (index > size) -> throw IndexOutOfBoundsException("Index: $index, size: $size")
        index == size -> plus(element)

        else ->
            ArrayList<T>(size + 1)
                .also { list ->
                    forEachIndexed { i, item ->
                        if (i == index) {
                            list.add(element)
                        }
                        list.add(item)
                    }
                }
    }

```

### Core Architecture Module: `reaktive/src/commonMain/kotlin/com/badoo/reaktive/utils/HandleSourceError.kt`
```
package com.badoo.reaktive.utils

import com.badoo.reaktive.base.exceptions.CompositeException

fun handleReaktiveError(error: Throwable, onError: ((Throwable) -> Unit)? = null) {
    error.throwIfFatal()

    if (onError == null) {
        handleError(error)
    } else {
        handleError(error, onError)
    }
}

private fun handleError(error: Throwable) {
    try {
        reaktiveUncaughtErrorHandler(error)
    } catch (errorDeliveryException: Throwable) {
        errorDeliveryException.throwIfFatal()
        printErrors("Error delivering uncaught error", error, errorDeliveryException)
    }
}

private fun handleError(error: Throwable, onError: (Throwable) -> Unit) {
    try {
        onError(error)
    } catch (errorHandlerException: Throwable) {
        errorHandlerException.throwIfFatal()
        printErrors("onError callback failed", error, errorHandlerException)

        try {
            reaktiveUncaughtErrorHandler(CompositeException(error, errorHandlerException))
        } catch (errorDeliveryException: Throwable) {
            errorDeliveryException.throwIfFatal()
            printErrors("Error delivering uncaught error", error, errorDeliveryException)
        }
    }
}

private fun printErrors(message: String, outerError: Throwable, innerError: Throwable) {
    printError("$message ($outerError): $innerError")
    outerError.printStackTrace()
    innerError.printStackTrace()
}

fun Throwable.throwIfFatal() {
    if (isFatal()) {
        throw this
    }
}

internal expect fun Throwable.isFatal(): Boolean

```

### Core Architecture Module: `reaktive/src/commonMain/kotlin/com/badoo/reaktive/utils/PrintError.kt`
```
package com.badoo.reaktive.utils

internal expect fun printError(error: Any?)

```

### Core Architecture Module: `reaktive/src/commonMain/kotlin/com/badoo/reaktive/utils/UncaughtErrorHandler.kt`
```
package com.badoo.reaktive.utils

import com.badoo.reaktive.utils.atomic.AtomicReference

@Suppress("ObjectPropertyName")
private val _reaktiveUncaughtErrorHandler: AtomicReference<(Throwable) -> Unit> =
    AtomicReference(createDefaultUncaughtErrorHandler())

var reaktiveUncaughtErrorHandler: (Throwable) -> Unit
    get() = _reaktiveUncaughtErrorHandler.value
    set(value) {
        _reaktiveUncaughtErrorHandler.value = value
    }

fun resetReaktiveUncaughtErrorHandler() {
    reaktiveUncaughtErrorHandler = createDefaultUncaughtErrorHandler()
}

internal expect fun createDefaultUncaughtErrorHandler(): (Throwable) -> Unit

```

### Core Architecture Module: `reaktive/src/commonMain/kotlin/com/badoo/reaktive/utils/Utils.kt`
```
@file:Suppress("MatchingDeclarationName", "Filename")

package com.badoo.reaktive.utils

internal object Uninitialized

```

### Core Architecture Module: `reaktive/src/commonMain/kotlin/com/badoo/reaktive/utils/queue/PriorityQueue.kt`
```
@file:Suppress("ForbiddenComment")

package com.badoo.reaktive.utils.queue

internal class PriorityQueue<T>(
    private val comparator: Comparator<in T>
) : Iterable<T> {

    private var array: Array<T?>? = null
    private var _size: Int = 0
    val isEmpty: Boolean get() = _size == 0

    fun peek(): T? =
        array?.takeUnless { isEmpty }?.get(0)

    fun offer(item: T) {
        var arr: Array<T?>? = array
        if (arr == null) {
            arr = newArray()
        } else if (_size == arr.size) {
            arr = arr.copyOf(_size * 2)
        }
        array = arr

        val lastIndex = _size++
        arr[lastIndex] = item
        @Suppress("UNCHECKED_CAST")
        (arr as Array<T>).heapifyUp(lastIndex, comparator)
    }

    fun poll(): T? {
        val arr = array
        if ((arr == null) || isEmpty) {
            return null
        }

        val lastIndex = --_size
        val item = arr[0]
        arr[0] = arr[lastIndex]
        arr[lastIndex] = null
        @Suppress("UNCHECKED_CAST")
        (arr as Array<T>).heapifyDown(0, _size, comparator)

        return item
    }

    fun clear() {
        array = null
        _size = 0
    }

    /**
     * The doc is derived from Java PriorityQueue.
     *
     * Returns an iterator over the elements in this queue. The
     * iterator does not return the elements in any particular order.
     *
     * @return an iterator over the elements in this queue
     */
    override fun iterator(): Iterator<T> =
        object : Iterator<T> {
            private var index = 0

            override fun hasNext(): Boolean = index < _size

            @Suppress("UNCHECKED_CAST")
            override fun next(): T {
                val arr = array?.takeIf { index < _size } ?: throw NoSuchElementException()

                return arr[index++] as T
            }
        }

    private companion object {
        private const val INITIAL_CAPACITY = 8

        @Suppress("UNCHECKED_CAST")
        private fun <T> newArray(): Array<T?> = arrayOfNulls<Any?>(INITIAL_CAPACITY) as Array<T?>

        private fun <T> Array<T>.heapifyDown(index: Int, actualSize: Int, comparator: Comparator<in T>) {
            val leftChildIndex = index * 2 + 1
            if (leftChildIndex >= actualSize) {
                return
            }

            val rightChildIndex = leftChildIndex + 1

            val childIndex =
                if (rightChildIndex >= actualSize) {
                    leftChildIndex
                } else {
                    val leftChildValue = get(leftChildIndex)
                    val rightChildValue = get(rightChildIndex)
                    if (comparator.compare(leftChildValue, rightChildValue) < 0) leftChildIndex else rightChildIndex
                }

            if (comparator.compare(get(childIndex), get(index)) < 0) {
                swap(index, childIndex)
                heapifyDown(childIndex, actualSize, comparator)
            }
        }

        private fun <T> Array<T>.heapifyUp(index: Int, comparator: Comparator<in T>) {
            val parentIndex = if (index % 2 == 0) index / 2 - 1 else index / 2
            if (parentIndex < 0) {
                return
            }

            if (comparator.compare(get(parentIndex), get(index)) > 0) {
                swap(index, parentIndex)
                heapifyUp(parentIndex, comparator)
            }
        }

        private fun <T> Array<T>.swap(first: Int, second: Int) {
            val temp = get(first)
            set(first, get(second))
            set(second, temp)
        }
    }
}

```

### Core Architecture Module: `reaktive/src/commonMain/kotlin/com/badoo/reaktive/utils/serializer/AbstractSerializer.kt`
```
package com.badoo.reaktive.utils.serializer

import com.badoo.reaktive.utils.atomic.AtomicInt
import com.badoo.reaktive.utils.atomic.changeAndGet
import com.badoo.reaktive.utils.lock.Lock

/*
 * Derived from RxJava SerializedEmitter.
 */
internal abstract class AbstractSerializer<T> : Lock(), Serializer<T> {

    private val counter = AtomicInt()

    protected abstract fun addLast(value: T)

    protected abstract fun clearQueue()

    protected abstract fun isEmpty(): Boolean

    protected abstract fun removeFirst(): T

    protected abstract fun onValue(value: T): Boolean

    override fun accept(value: T) {
        if (counter.compareAndSet(0, 1)) {
            if (!onValue(value)) {
                counter.value = -1
                return
            }

            if (counter.addAndGet(-1) == 0) {
                return
            }
        } else {
            if (counter.value < 0) {
                return
            }

            synchronized {
                addLast(value)
            }

            if (counter.changeAndGet { if (it >= 0) it + 1 else it } != 1) {
                return
            }
        }

        drainLoop()
    }

    override fun clear() {
        synchronized(::clearQueue)
    }

    private fun drainLoop() {
        var missed = 1
        while (true) {
            while (true) {
                var isEmpty = false
                var value: T? = null

                synchronized {
                    isEmpty = isEmpty()
                    if (!isEmpty) {
                        value = removeFirst()
                    }
                }

                if (isEmpty) {
                    break
                }

                @Suppress("UNCHECKED_CAST")
                if (!onValue(value as T)) {
                    counter.value = -1
                    return
                }
            }

            missed = counter.addAndGet(-missed)
            if (missed == 0) {
                break
            }
        }
    }
}

```

### Core Architecture Module: `reaktive/src/commonMain/kotlin/com/badoo/reaktive/utils/serializer/DefaultSerializer.kt`
```
package com.badoo.reaktive.utils.serializer

internal inline fun <T> serializer(
    crossinline onValue: (T) -> Boolean,
): Serializer<T> =
    object : DefaultSerializer<T>() {
        override fun onValue(value: T): Boolean =
            onValue.invoke(value)
    }

internal abstract class DefaultSerializer<T> : AbstractSerializer<T>() {
    private var queue: ArrayDeque<T>? = null

    override fun addLast(value: T) {
        val queue = queue ?: ArrayDeque<T>().also { queue = it }
        queue.add(value)
    }

    override fun clearQueue() {
        queue?.clear()
    }

    override fun isEmpty(): Boolean =
        queue?.isEmpty() ?: true

    override fun removeFirst(): T =
        requireNotNull(queue).removeFirst()
}

```

### Core Architecture Module: `reaktive/src/commonMain/kotlin/com/badoo/reaktive/utils/serializer/PrioritySerializer.kt`
```
package com.badoo.reaktive.utils.serializer

import com.badoo.reaktive.utils.queue.PriorityQueue

internal inline fun <T> serializer(
    comparator: Comparator<in T>,
    crossinline onValue: (T) -> Boolean,
): Serializer<T> =
    object : PrioritySerializer<T>(comparator) {
        override fun onValue(value: T): Boolean =
            onValue.invoke(value)
    }

internal abstract class PrioritySerializer<T>(
    private val comparator: Comparator<in T>,
) : AbstractSerializer<T>() {

    private var queue: PriorityQueue<T>? = null

    override fun addLast(value: T) {
        val queue = queue ?: PriorityQueue(comparator).also { queue = it }
        queue.offer(value)
    }

    override fun clearQueue() {
        queue?.clear()
    }

    override fun isEmpty(): Boolean =
        queue?.isEmpty ?: true

    @Suppress("UNCHECKED_CAST")
    override fun removeFirst(): T =
        requireNotNull(queue).poll() as T
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #789** (2025-06-01): **js/wasm tests fail when Kotlin is updated to 2.1.20**
  *Symptoms*: 1. `wasm` stops compiling: can be fixed by importing `kotlinx-html` 2. `js` starts failing: `MainSchedulerTest` fails on the interval execution test.
  **Post-Mortem & Fix Analysis**:
  > I will take a look.
  > The `MainSchedulerTest` test also [fails](https://github.com/arkivanov/Reaktive/actions/runs/15375465168/job/43259681949) on `master` branch. It's flaky.

- **Issue #783** (2024-08-31): **Migrate to new Sonatype publication scheme**
  *Symptoms*: ```log > Failed to publish publication 'androidDebug' to repository 'sonatype' For more on this, please refer to https://docs.gradle.org/8.6/userguide/command_line_interface.html#sec:command_line_warnings in the Gradle documentation.    > Could not PUT 'https://oss.sonatype.org/service/local/staging/deployByRepositoryId/combadoo-1032/com/badoo/reaktive/reaktive-annotations-android-debug/2.3.0/reaktive-annotations-android-debug-2.3.0.aar'. Received status code 401 from server: Content access is protected by token 581 actionable tasks: 424 executed, 157 from cache ```  https://central.sonatype.org/faq/401-error/#401-content-access-is-protected-by-token https://central.sonatype.org/publish/generate-token/

- **Issue #727** (2023-05-30): **[Bug] BehaviorSubject doesn't synchronously emit the current value on subscription if another value is being emitted on another thread**
  *Symptoms*: `BehaviorSubject` should always emit the current value synchronously on subscription. Currently, if the queue is busy by another task (e.g. emitting from another thread), the initial emission is added to the queue.
  **Post-Mortem & Fix Analysis**:
  > Will be fixed in v2.0.

- **Issue #625** (2021-07-07): **`Iterable<Observable<T>>.combineLatest` always maps the same list instance**
  *Symptoms*: The [`Iterable<Observable<T>>.combineLatest`](https://github.com/badoo/Reaktive/blob/86c6ea6bbbb16fbb0ce7bc48156b57485bc189a4/reaktive/src/commonMain/kotlin/com/badoo/reaktive/observable/CombineLatest.kt#L13) operator always maps the same list instance and causes mutability issues. A downstream operator like `distinctUntilChanged` will discard any subsequent items thinking they haven't changed yet.   I'm working this around by using cloning the combined list using:  ```diff - combineLatest { list -> list } + combineLatest { list -> list.toList() } ```
  **Post-Mortem & Fix Analysis**:
  > This was a memory optimisation, but looks like I overlooked this use case. I will fix.

- **Issue #592** (2021-06-11): **Retry operator, "attempt" argument should start from 1, not from 0**
  *Symptoms*: Maybe it is better to keep as it is now, to not break any client behaviour?
  **Post-Mortem & Fix Analysis**:
  > Will do with the next minor version bump.

- **Issue #570** (2020-12-14): **Observable.buffer differs from RxJava implementation**
  *Symptoms*: Hi, here is my case: i want to filter a sequence of elements. Example code: ```kotlin fun <T> Observable<T>.filterSequence(elements: List<T>): Observable<List<T>> {     return buffer(elements.size, 1).filter { elements == it } } ``` RxJava works correct for me, but reaktive is not.  Here is comparison in work of `buffer` operator: ```kotlin fun main() {     val rxJavaValues = Observable.just(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)         .buffer(3, 4)         .toList()         .blockingGet()      val reaktiveValues = observableOf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)         .buffer(3, 4)         .toList()         .blockingGet()      println("rxJavaValues: $rxJavaValues")     println("reaktiveValues: $reaktiveValues") } ``` **Output 1, gaps**: rxJavaValues: [[1, 2, 3], [5, 6, 7], [9, 10]] reaktiveValues: [[1, 2, 3], [8, 9, 10]]  ```kotlin fun main() {     val rxJavaValues = Observable.just(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)         .buffer(3)         .toList()         .blockingGet()      val reaktiveValues = observableOf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)         .buffer(3)         .toList()         .blockingGet()      println("rxJavaValues: $rxJavaValues")     println("reaktiveValues: $reaktiveValues") } ``` **Output 2, gapless**: rxJavaValues: [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]] reaktiveValues: [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]]  ```kotlin fun main() {     val rxJavaValues = Observable.just(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)         .buffe
  **Post-Mortem & Fix Analysis**:
  > Thanks, I will fix!

- **Issue #500** (2020-07-11): **Collection<Observable<T>>.combineLatest will never complete if collection is empty**
  *Symptoms*: Hi, i faced a problem that `Observable.combineLatest` will not complete if collection of `Observable's` is empty. This simple test case failed: ```kotlin @Test fun completed_when_collection_is_empty() {     val observer = emptyList<Observable<Any>>()         .combineLatest { it }         .test()     observer.assertNoValues()     observer.assertComplete() } ```  Also some of operators such as: `amb`, `merge`, `zip`, `withLatestFrom` also works incorrect. Whereas `concat` operators handle this case, so does [RxJava](https://github.com/ReactiveX/RxJava/blob/d209606e0eaaf87bb5493fd71a8413822f9992f2/src/main/java/io/reactivex/rxjava3/internal/operators/observable/ObservableCombineLatest.java#L70) Furthermore there is different reciever type for collection: [Iterable](https://github.com/badoo/Reaktive/blob/6ae4e8caf147e784f21f16dcc49a6b8fe8ed6d92/reaktive/src/commonMain/kotlin/com/badoo/reaktive/observable/Concat.kt#L8) and [Collection](https://github.com/badoo/Reaktive/blob/6ae4e8caf147e784f21f16dcc49a6b8fe8ed6d92/reaktive/src/commonMain/kotlin/com/badoo/reaktive/observable/CombineLatest.kt#L13)  So i have some questions: - Which type should be receiver: Iterable or Collection? - Should i optimize operators with `size == 1` checks? - Should i make single PR or per stream?  For example, what i want to do: ```kotlin fun <T, R> Collection<Observable<T>>.combineLatest(mapper: (List<T>) -> R): Observable<R> =     when (size) {         0 -> observableOfEmpty() 
  **Post-Mortem & Fix Analysis**:
  > Hey @amihusb, thanks for raising the issue. This is a bug indeed.  Answering your questions:  > Which type should be receiver: Iterable or Collection?  The reason why it's `Collection` is because we need `size`. RxJava copies the content into an array. With Reaktive we can write something like this:  ```kotlin myIterable.toList().combineLatest(...) ```  Let's keep `Collection` type for now.  > Should i optimize operators with size == 1 checks?  No need to optimize currently.  > Should i make single PR or per stream?  I would prefer a single PR.  PS: I'm suggesting to fix this in the following way:  ``` Index: reaktive/src/commonMain/kotlin/com/badoo/reaktive/observable/CombineLatest.kt IDEA additional info: Subsystem: com.intellij.openapi.diff.impl.patch.CharsetEP <+>UTF-8 =================================================================== --- reaktive/src/commonMain/kotlin/com/badoo/reaktive/observable/CombineLatest.kt	(revision db9c26d5258b071d6d76d472c3

- **Issue #485** (2020-06-19): **NodeJs: TypeError: window.setTimeout is not a function**
  *Symptoms*: I recently started supporting Js on a library that uses reaktive and I had to publish it as an npm package and part of this process involved exporting all dependencies including Reaktive. I was able to locally publish everything including Reaktive and initialize my library on a sample nodejs app but I got an error on my sample app:  `ReferenceError: window is not defined`  Because of this line (This is the javascript code that was publish not kotlin) `var element = window.setTimeout(task, delayMillis.toInt());`  Which is actually in this function in `MainScheduler.kt`  ```         override fun submit(delayMillis: Long, task: () -> Unit) {             timeoutIds += window.setTimeout(task, delayMillis.toInt())         } ``` I worked around it by doing this  ``` global.window = {document: {createElementNS: () => {return {}} }}; ```  But I got another error and I got stuck with it ``` TypeError: window.setTimeout is not a function ```  I am not nodejs expert so I wanted to ask, should the implementation work fine and the issue is from my side or the line below should be different in case of nodeJs not browser. Because I am assuming this should work fine on a browser? I would also assume `window.setInterval` should break for me as well.  ``` timeoutIds += window.setTimeout(task, delayMillis.toInt()) ``` 
  **Post-Mortem & Fix Analysis**:
  > @minaEweida Thanks for reporting, this looks like a bug. 
  > @lukaville Would you like to take this?
  > @arkivanov I did a fix that worked for me locally, I can share later today if it's not going to be fixed soon. Will send for review and then cleanup.

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

### Incident Patch 1: `38ac922d` (2025-05-12)
**Commit Message**: New publishing and remove split-build support

**File**: `.github/workflows/build.yml` (modified, +7/-30)
```diff
@@ -14,48 +14,25 @@ jobs:
     runs-on: ${{matrix.os}}
     name: Build on ${{matrix.os}}
     steps:
-      - name: Checkout
-        uses: actions/checkout@v4
-      - name: Install Java
-        uses: actions/setup-java@v4
+      - uses: actions/checkout@v4
+      - uses: actions/setup-java@v4
         with:
           distribution: 'zulu'
           java-version: '21'
       - name: Install dependencies
         if: matrix.os == 'ubuntu-latest'
         run: sudo apt-get update && sudo apt-get install libcurl4-openssl-dev libgtk-3-dev nodejs chromium-browser
-      - name: Select Xcode version
+      - uses: maxim-lobanov/setup-xcode@60606e260d2fc5762a71e64e74b2174e8ea3c8bd
         if: matrix.os == 'macos-latest'
-        uses: maxim-lobanov/setup-xcode@60606e260d2fc5762a71e64e74b2174e8ea3c8bd
         with:
           xcode-version: '16.2'
-      - name: Setup Gradle
-        uses: gradle/actions/setup-gradle@v4
+      - uses: gradle/actions/setup-gradle@v4
         with:
           cache-read-only: ${{ github.ref != 'refs/heads/master' }}
           cache-encryption-key: ${{ secrets.GRADLE_ENCRYPTION_KEY }}
-      - name: Validate Gradle Wrapper
-        uses: gradle/actions/wrapper-validation@v4
-      - name: Build Linux
-        if: matrix.os == 'ubuntu-latest'
-        run: >
-          ./gradlew
-          build
-          publishAllFilteredToMavenLocal
-          -Ptarget=all_linux_hosted
-      - name: Build macOS
-        if: matrix.os == 'macos-latest'
-        run:
-          ./gradlew
-          :reaktive-annotations:build
-          :utils:build
-          :reaktive-testing:build
-          :reaktive:build
-          :coroutines-interop:build
-          :sample-mpp-module:build
-          publishAllFilteredToMavenLocal
-          -Ptarget=all_macos_hosted
-      # Do not invoke from Gradle, it creates circular dependency (Gradle invokes XCode invokes Gradle).
+      - name: Build
+        run: ./gradlew build publishToMavenLocal
+      # Do not invoke from Gradle, it creates a circular dependency (Gradle invokes XCode invokes Gradle).
       - name: Build iOS app
         if: matrix.os == 'macos-latest'
         working-directory: sample-ios-app
```

**File**: `.github/workflows/release.yml` (modified, +12/-85)
```diff
@@ -6,100 +6,27 @@ on:
     types: [ created ]
 
 jobs:
-  create-staging-repository:
-    runs-on: ubuntu-latest
-    name: Create staging repository
-    outputs:
-      repository-id: ${{ steps.create.outputs.repository_id }}
-    steps:
-      - id: create
-        name: Create staging repository
-        uses: nexus-actions/create-nexus-staging-repo@3e5e7209801629febdcf75541a4898710d28df9a
-        with:
-          username: ${{ secrets.SONATYPE_USERNAME }}
-          password: ${{ secrets.SONATYPE_PASSWORD }}
-          staging_profile_id: ${{ secrets.SONATYPE_STAGING_PROFILE_ID }}
-          description: ${{ github.repository }}/${{ github.workflow }}#${{ github.run_number }}
-
   publish:
     name: Publish
     runs-on: macos-latest
-    needs: create-staging-repository
-    env:
-      SIGNING_KEY: ${{ secrets.SIGNING_KEY }}
-    steps:
-      - name: Checkout
-        uses: actions/checkout@v4
-      - name: Install Java
-        uses: actions/setup-java@v4
-        with:
-          distribution: 'zulu'
-          java-version: '21'
-      - name: Select Xcode version
-        uses: maxim-lobanov/setup-xcode@60606e260d2fc5762a71e64e74b2174e8ea3c8bd
-        with:
-          xcode-version: '16.2'
-      - name: Setup Gradle
-        uses: gradle/actions/setup-gradle@v4
-        with:
-          cache-read-only: true
-          cache-encryption-key: ${{ secrets.GRADLE_ENCRYPTION_KEY }}
-      - name: Publish
-        run: >
-          ./gradlew 
-          publishAllFilteredToSonatype
-          -Psigning.password=${{ secrets.SIGNING_PASSWORD }}
-          -Psonatype.username=${{ secrets.SONATYPE_USERNAME }}
-          -Psonatype.password=${{ secrets.SONATYPE_PASSWORD }}
-          -Psonatype.repository=${{ needs.create-staging-repository.outputs.repository-id }}
-
-  check:
-    name: Check publication
-    runs-on: macos-latest
-    needs: [ create-staging-repository, publish ]
     steps:
-      - name: Checkout
-        uses: actions/checkout@v4
-      - name: Install Java
-        uses: actions/setup-java@v4
+      - uses: actions/checkout@v4
+      - uses: actions/setup-java@v4
         with:
           distribution: 'zulu'
           java-version: '21'
-      - name: Select Xcode version
-        uses: maxim-lobanov/setup-xcode@60606e260d2fc5762a71e64e74b2174e8ea3c8bd
+      - uses: maxim-lobanov/setup-xcode@60606e260d2fc5762a71e64e74b2174e8ea3c8bd
         with:
           xcode-version: '16.2'
-      - name: Setup Gradle
-        uses: gradle/actions/setup-gradle@v4
+      - uses: gradle/actions/setup-gradle@v4
         with:
           cache-read-only: true
           cache-encryption-key: ${{ secrets.GRADLE_ENCRYPTION_KEY }}
-      - name: Check publication
-        run: >
-          ./gradlew 
-          :tools:check-publication:build
-          --exclude-task kotlinStoreYarnLock
-          -Pcheck_publication
-          -Psonatype.username=${{ secrets.SONATYPE_USERNAME }}
-          -Psonatype.password=${{ secrets.SONATYPE_PASSWORD }}
-          -Psonatype.repository=${{ needs.create-staging-repository.outputs.repository-id }}
-
-  close-staging-repository:
-    runs-on: ubuntu-latest
-    needs: [ create-staging-repository, check ]
-    if: ${{ always() && needs.create-staging-repository.result == 'success' }}
-    steps:
-      - name: Discard
-        if: ${{ needs.check.result != 'success' }}
-        uses: nexus-actions/drop-nexus-staging-repo@59443053a1b36f5f71ede68776d73294bf4bfb5e
-        with:
-          username: ${{ secrets.SONATYPE_USERNAME }}
-          password: ${{ secrets.SONATYPE_PASSWORD }}
-          staging_repository_id: ${{ needs.create-staging-repository.outputs.repository-id }}
-      - name: Release
-        if: ${{ needs.check.result == 'success' }}
-        uses: nexus-actions/release-nexus-staging-repo@f2b4c7f64ecec2cb0d24349182c1bbeda5c4c056
-        with:
-          username: ${{ secrets.SONATYPE_USERNAME }}
-          password: ${{ secrets.SONATYPE_PASSWORD }}
-          staging_repository_id: ${{ needs.create-staging-repository.outputs.repository-id }}
+      - name: Build & publish
+        env:
+          ORG_GRADLE_PROJECT_mavenCentralUsername: ${{ secrets.SONATYPE_USERNAME }}
+          ORG_GRADLE_PROJECT_mavenCentralPassword: ${{ secrets.SONATYPE_PASSWORD }}
+          ORG_GRADLE_PROJECT_signingInMemoryKey: ${{ secrets.SIGNING_KEY }}
+          ORG_GRADLE_PROJECT_signingInMemoryKeyPassword: ${{ secrets.SIGNING_PASSWORD }}
+        # Plugin requires "--no-configuration-cache" flag
+        run: ./gradlew publishAllPublicationsToMavenCentralRepository --no-configuration-cache
```

**File**: `gradle/libs.versions.toml` (modified, +7/-3)
```diff
@@ -10,21 +10,25 @@ kotlin-stdlib = { module = "org.jetbrains.kotlin:kotlin-stdlib", version.ref = "
 kotlin-test = { module = "org.jetbrains.kotlin:kotlin-test", version.ref = "kotlin" }
 kotlin-test-annotations = { module = "org.jetbrains.kotlin:kotlin-test-annotations", version.ref = "kotlin" }
 
-kotlinx-compatibility = "org.jetbrains.kotlinx:binary-compatibility-validator:0.14.0"
+kotlinx-compatibility = "org.jetbrains.kotlinx:binary-compatibility-validator:0.17.0"
 kotlinx-coroutines-core = { module = "org.jetbrains.kotlinx:kotlinx-coroutines-core", version.ref = "kotlinx-coroutines" }
 kotlinx-coroutines-test = { module = "org.jetbrains.kotlinx:kotlinx-coroutines-test", version.ref = "kotlinx-coroutines" }
 
-android-plugin = "com.android.tools.build:gradle:8.2.0"
+android-plugin = "com.android.tools.build:gradle:8.9.2"
 
 androidx-appcompat = "androidx.appcompat:appcompat:1.4.2"
 androidx-constraintLayout = "androidx.constraintlayout:constraintlayout:1.1.3"
 
 jmh-plugin = "me.champeau.jmh:jmh-gradle-plugin:0.7.0"
 
 rxjava2 = "io.reactivex.rxjava2:rxjava:2.2.21"
-rxjava3 = "io.reactivex.rxjava3:rxjava:3.1.6"
+rxjava3 = "io.reactivex.rxjava3:rxjava:3.1.10"
 
 shadow = "gradle.plugin.com.github.johnrengelman:shadow:7.1.2"
 
 detekt-plugin = { module = "io.gitlab.arturbosch.detekt:detekt-gradle-plugin", version.ref = "detekt" }
 detekt-ktlint = { module = "io.gitlab.arturbosch.detekt:detekt-formatting", version.ref = "detekt" }
+
+publish-plugin = { module = "com.vanniktech.maven.publish:com.vanniktech.maven.publish.gradle.plugin", version = "0.31.0" }
+
+dokka-plugin = { module = "org.jetbrains.dokka:dokka-gradle-plugin", version = "2.0.0" }
```

**File**: `includedBuild/gradleConfiguration/build.gradle.kts` (modified, +2/-0)
```diff
@@ -16,6 +16,8 @@ dependencies {
     implementation(libs.detekt.plugin)
     implementation(libs.shadow)
     implementation(libs.kotlinx.compatibility)
+    implementation(libs.publish.plugin)
+    implementation(libs.dokka.plugin)
 }
 
 gradlePlugin {
```

**File**: `includedBuild/gradleConfiguration/src/main/kotlin/com/badoo/reaktive/compatibility/BinaryCompatibilityConfigurationPlugin.kt` (modified, +15/-18)
```diff
@@ -1,6 +1,5 @@
 package com.badoo.reaktive.compatibility
 
-import com.badoo.reaktive.configuration.Target
 import kotlinx.validation.ApiValidationExtension
 import org.gradle.api.Plugin
 import org.gradle.api.Project
@@ -9,25 +8,23 @@ import org.gradle.kotlin.dsl.configure
 
 class BinaryCompatibilityConfigurationPlugin : Plugin<Project> {
     override fun apply(target: Project) {
-        if (Target.shouldDefineTarget(target, Target.ALL_LINUX_HOSTED)) {
-            target.apply(plugin = "binary-compatibility-validator")
-            target.extensions.configure(ApiValidationExtension::class) {
-                nonPublicMarkers += "com.badoo.reaktive.utils.InternalReaktiveApi"
+        target.apply(plugin = "binary-compatibility-validator")
+        target.extensions.configure(ApiValidationExtension::class) {
+            nonPublicMarkers += "com.badoo.reaktive.utils.InternalReaktiveApi"
 
-                if (target.hasProperty("check_publication")) {
-                    ignoredProjects.add("check-publication")
-                } else {
-                    ignoredProjects.addAll(
-                        listOf(
-                            "benchmarks",
-                            "jmh",
-                            "sample-mpp-module",
-                            "sample-android-app",
-                            "sample-js-browser-app",
-                            "sample-linuxx64-app",
-                        )
+            if (target.hasProperty("check_publication")) {
+                ignoredProjects.add("check-publication")
+            } else {
+                ignoredProjects.addAll(
+                    listOf(
+                        "benchmarks",
+                        "jmh",
+                        "sample-mpp-module",
+                        "sample-android-app",
+                        "sample-js-browser-app",
+                        "sample-linuxx64-app",
                     )
-                }
+                )
             }
         }
     }
```

**File**: `includedBuild/gradleConfiguration/src/main/kotlin/com/badoo/reaktive/configuration/DarwinPlugin.kt` (removed, +0/-30)
```diff
@@ -1,30 +0,0 @@
-package com.badoo.reaktive.configuration
-
-import org.gradle.api.Plugin
-import org.gradle.api.Project
-import org.jetbrains.kotlin.gradle.dsl.KotlinMultiplatformExtension
-
-@Suppress("UnstableApiUsage")
-class DarwinPlugin : Plugin<Project> {
-
-    override fun apply(target: Project) {
-        configureDarwinCompilation(target)
-    }
-
-    private fun configureDarwinCompilation(target: Project) {
-        target.extensions.configure(KotlinMultiplatformExtension::class.java) {
-            iosArm64().disableIfUndefined(Target.IOS)
-            iosX64().disableIfUndefined(Target.IOS)
-            iosSimulatorArm64().disableIfUndefined(Target.IOS)
-            watchosArm32().disableIfUndefined(Target.WATCHOS)
-            watchosArm64().disableIfUndefined(Target.WATCHOS)
-            watchosX64().disableIfUndefined(Target.WATCHOS)
-            watchosSimulatorArm64().disableIfUndefined(Target.WATCHOS)
-            tvosArm64().disableIfUndefined(Target.TVOS)
-            tvosX64().disableIfUndefined(Target.TVOS)
-            tvosSimulatorArm64().disableIfUndefined(Target.TVOS)
-            macosX64().disableIfUndefined(Target.MACOS)
-            macosArm64().disableIfUndefined(Target.MACOS)
-        }
-    }
-}
```

**File**: `includedBuild/gradleConfiguration/src/main/kotlin/com/badoo/reaktive/configuration/JsPlugin.kt` (removed, +0/-34)
```diff
@@ -1,34 +0,0 @@
-package com.badoo.reaktive.configuration
-
-import com.badoo.reaktive.getLibrary
-import org.gradle.api.Plugin
-import org.gradle.api.Project
-import org.jetbrains.kotlin.gradle.dsl.KotlinMultiplatformExtension
-
-class JsPlugin : Plugin<Project> {
-
-    override fun apply(target: Project) {
-        configureJsCompilation(target)
-    }
-
-    private fun configureJsCompilation(target: Project) {
-        target.extensions.configure(KotlinMultiplatformExtension::class.java) {
-            js {
-                browser()
-                nodejs()
-
-                disableIfUndefined(Target.JS)
-            }
-            sourceSets.getByName("jsMain") {
-                dependencies {
-                    implementation(project.getLibrary("kotlin-stdlib"))
-                }
-            }
-            sourceSets.getByName("jsTest") {
-                dependencies {
-                    implementation(project.getLibrary("kotlin-test"))
-                }
-            }
-        }
-    }
-}
```

**File**: `includedBuild/gradleConfiguration/src/main/kotlin/com/badoo/reaktive/configuration/MppConfigurationExtension.kt` (removed, +0/-8)
```diff
@@ -1,8 +0,0 @@
-package com.badoo.reaktive.configuration
-
-import org.gradle.api.Project
-import javax.inject.Inject
-
-open class MppConfigurationExtension @Inject constructor(
-    private val project: Project
-)
```

---

### Incident Patch 2: `dc3e254d` (2025-05-12)
**Commit Message**: Fix LICENSE

**File**: `LICENSE` (modified, +1/-1)
```diff
@@ -186,7 +186,7 @@
       same "printed page" as the copyright notice for easier
       identification within third-party archives.
 
-   Copyright [yyyy] [name of copyright owner]
+   Copyright (c) Bumble, 2019-present. All rights reserved.
 
    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
```

---

### Incident Patch 3: `4db2749b` (2025-01-30)
**Commit Message**: Merge pull request #785 from arkivanov/fix-RefCountThreadingTest

Fixed incorrect condition in RefCountThreadingTest

**File**: `reaktive/src/jvmNativeCommonTest/kotlin/com/badoo/reaktive/observable/RefCountThreadingTest.kt` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ class RefCountThreadingTest {
         doInBackground { observer.dispose() }
 
         lock.synchronized {
-            lock.waitForOrFail { !isSecondTime }
+            lock.waitForOrFail { isSecondTime }
         }
 
         refCount.test()
```

---

### Incident Patch 4: `9a01135f` (2025-01-29)
**Commit Message**: Fixed incorrect condition in RefCountThreadingTest

**File**: `reaktive/src/jvmNativeCommonTest/kotlin/com/badoo/reaktive/observable/RefCountThreadingTest.kt` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ class RefCountThreadingTest {
         doInBackground { observer.dispose() }
 
         lock.synchronized {
-            lock.waitForOrFail { !isSecondTime }
+            lock.waitForOrFail { isSecondTime }
         }
 
         refCount.test()
```

---

### Incident Patch 5: `a35e4d38` (2024-06-02)
**Commit Message**: Export sample iOS framework only for Xcode builds

**File**: `sample-mpp-module/build.gradle` (modified, +11/-11)
```diff
@@ -8,20 +8,20 @@ android {
 }
 
 kotlin {
-    def configureFrameworks = { target ->
-        target.binaries {
-            framework {
-                baseName = "shared"
-                export project(':reaktive')
+    if (System.getenv().keySet().contains("XCODE_VERSION_MAJOR")) {
+        def configureFrameworks = { target ->
+            target.binaries {
+                framework {
+                    baseName = "shared"
+                    export project(':reaktive')
+                }
             }
         }
-    }
 
-    configureFrameworks(iosArm64())
-    configureFrameworks(iosX64())
-    configureFrameworks(iosSimulatorArm64())
-    configureFrameworks(macosX64())
-    configureFrameworks(macosArm64())
+        configureFrameworks(iosArm64())
+        configureFrameworks(iosX64())
+        configureFrameworks(iosSimulatorArm64())
+    }
 
     sourceSets {
         commonMain {
```

---

### Incident Patch 6: `46b558c4` (2024-03-11)
**Commit Message**: Fix build.gradle files

**File**: `benchmarks/jmh/build.gradle` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ dependencies {
 }
 
 kotlin {
-    jvmToolchain(11)
+    jvmToolchain(17)
 }
 
 jmh {
```

**File**: `rxjava2-interop/build.gradle` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ compileKotlin {
 }
 
 compileJava {
-    targetCompatibility(JavaVersion.VERSION_1_8)
+    targetCompatibility = JavaVersion.VERSION_1_8
 }
 
 publishing {
```

**File**: `rxjava3-interop/build.gradle` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ compileKotlin {
 }
 
 compileJava {
-    targetCompatibility(JavaVersion.VERSION_1_8)
+    targetCompatibility = JavaVersion.VERSION_1_8
 }
 
 publishing {
```

---

### Incident Patch 7: `33dc9665` (2024-03-11)
**Commit Message**: Update build.yml

**File**: `.github/workflows/build.yml` (modified, +26/-26)
```diff
@@ -15,9 +15,9 @@ jobs:
     name: Build on ${{matrix.os}}
     steps:
       - name: Checkout
-        uses: actions/checkout@v3
+        uses: actions/checkout@v4
       - name: Install Java
-        uses: actions/setup-java@v3
+        uses: actions/setup-java@v4
         with:
           distribution: 'zulu'
           java-version: '17'
@@ -26,36 +26,36 @@ jobs:
         run: sudo apt-get update && sudo apt-get install libcurl4-openssl-dev libgtk-3-dev nodejs chromium-browser
       - name: Select Xcode version
         if: matrix.os == 'macOS-latest'
-        uses: maxim-lobanov/setup-xcode@9a697e2b393340c3cacd97468baa318e4c883d98
+        uses: maxim-lobanov/setup-xcode@60606e260d2fc5762a71e64e74b2174e8ea3c8bd
         with:
           xcode-version: '14.2.0'
+      - name: Setup Gradle
+        uses: gradle/actions/setup-gradle@v3
+        with:
+          gradle-home-cache-cleanup: true
+          cache-read-only: ${{ github.ref != 'refs/heads/master' }}
+          cache-encryption-key: ${{ secrets.GRADLE_ENCRYPTION_KEY }}
       - name: Validate Gradle Wrapper
-        uses: gradle/wrapper-validation-action@v1
+        uses: gradle/wrapper-validation-action@v2
       - name: Build Linux
         if: matrix.os == 'ubuntu-latest'
-        uses: gradle/gradle-build-action@v2
-        with:
-          gradle-home-cache-cleanup: true
-          cache-read-only: ${{ github.ref != 'refs/heads/master' && github.ref != 'refs/heads/version-2.0' }}
-          arguments: |
-            build
-            publishAllFilteredToMavenLocal
-            -Ptarget=all_linux_hosted
+        run: >
+          ./gradlew
+          build
+          publishAllFilteredToMavenLocal
+          -Ptarget=all_linux_hosted
       - name: Build macOS
         if: matrix.os == 'macOS-latest'
-        uses: gradle/gradle-build-action@v2
-        with:
-          gradle-home-cache-cleanup: true
-          cache-read-only: ${{ github.ref != 'refs/heads/master' && github.ref != 'refs/heads/version-2.0' }}
-          arguments: |
-            :reaktive-annotations:build
-            :utils:build
-            :reaktive-testing:build
-            :reaktive:build
-            :coroutines-interop:build
-            :sample-mpp-module:build
-            publishAllFilteredToMavenLocal
-            -Ptarget=all_macos_hosted
+        run:
+          ./gradlew
+          :reaktive-annotations:build
+          :utils:build
+          :reaktive-testing:build
+          :reaktive:build
+          :coroutines-interop:build
+          :sample-mpp-module:build
+          publishAllFilteredToMavenLocal
+          -Ptarget=all_macos_hosted
       # Do not invoke from Gradle, it creates circular dependency (Gradle invokes XCode invokes Gradle).
       - name: Build iOS app
         if: matrix.os == 'macOS-latest'
@@ -71,7 +71,7 @@ jobs:
         run: find . -type d -name 'reports' | zip -@ -r build-reports.zip
       - name: Upload the build report
         if: failure()
-        uses: actions/upload-artifact@master
+        uses: actions/upload-artifact@v4
         with:
           name: error-report
           path: build-reports.zip
```

---

### Incident Patch 8: `e02f230d` (2024-02-24)
**Commit Message**: Merge pull request #774 from arkivanov/refCount-race-fix

Fixed a race condition in refCount

**File**: `reaktive/src/commonMain/kotlin/com/badoo/reaktive/observable/RefCount.kt` (modified, +16/-18)
```diff
@@ -2,10 +2,9 @@ package com.badoo.reaktive.observable
 
 import com.badoo.reaktive.disposable.CompositeDisposable
 import com.badoo.reaktive.disposable.Disposable
+import com.badoo.reaktive.disposable.SerialDisposable
 import com.badoo.reaktive.disposable.plusAssign
-import com.badoo.reaktive.utils.atomic.AtomicInt
-import com.badoo.reaktive.utils.atomic.AtomicReference
-import com.badoo.reaktive.utils.atomic.getAndChange
+import com.badoo.reaktive.utils.lock.Lock
 
 /**
  * Returns an [Observable] that connects to this [ConnectableObservable] when the number
@@ -16,23 +15,15 @@ import com.badoo.reaktive.utils.atomic.getAndChange
 fun <T> ConnectableObservable<T>.refCount(subscriberCount: Int = 1): Observable<T> {
     require(subscriberCount > 0)
 
-    val subscribeCount = AtomicInt()
-    val disposable = AtomicReference<Disposable?>(null)
+    var subscribeCount = 0
+    val lock = Lock()
+    val connectionDisposable = SerialDisposable()
 
     return observable { emitter ->
         val disposables = CompositeDisposable()
         emitter.setDisposable(disposables)
 
-        disposables +=
-            Disposable {
-                if (subscribeCount.addAndGet(-1) == 0) {
-                    disposable
-                        .getAndChange { null }
-                        ?.dispose()
-                }
-            }
-
-        val shouldConnect = subscribeCount.addAndGet(1) == subscriberCount
+        val shouldConnect = lock.synchronized { ++subscribeCount == subscriberCount }
 
         this@refCount.subscribe(
             object : ObservableObserver<T>, ObservableCallbacks<T> by emitter {
@@ -43,9 +34,16 @@ fun <T> ConnectableObservable<T>.refCount(subscriberCount: Int = 1): Observable<
         )
 
         if (shouldConnect) {
-            this@refCount.connect {
-                disposable.value = it
-            }
+            this@refCount.connect(connectionDisposable::set)
         }
+
+        disposables +=
+            Disposable {
+                lock.synchronized {
+                    if (--subscribeCount == 0) {
+                        connectionDisposable.set(null)
+                    }
+                }
+            }
     }
 }
```

**File**: `reaktive/src/commonTest/kotlin/com/badoo/reaktive/observable/RefCountTest.kt` (modified, +34/-0)
```diff
@@ -82,6 +82,40 @@ class RefCountTest {
         assertTrue(disposable.isDisposed)
     }
 
+    @Test
+    fun connects_to_upstream_WHEN_subscriberCount_is_1_and_subscribed_and_disposed_in_onSubscribe() {
+        var isConnected = false
+        val upstream = testUpstream(connect = { isConnected = true })
+        val refCount = upstream.refCount(subscriberCount = 1)
+
+        refCount.subscribe(
+            object : DefaultObservableObserver<Int?> {
+                override fun onSubscribe(disposable: Disposable) {
+                    disposable.dispose()
+                }
+            }
+        )
+
+        assertTrue(isConnected)
+    }
+
+    @Test
+    fun disconnects_from_upstream_WHEN_subscriberCount_is_1_and_subscribed_and_disposed_in_onSubscribe() {
+        val disposable = Disposable()
+        val upstream = testUpstream(connect = { onConnect -> onConnect?.invoke(disposable) })
+        val refCount = upstream.refCount(subscriberCount = 1)
+
+        refCount.subscribe(
+            object : DefaultObservableObserver<Int?> {
+                override fun onSubscribe(disposable: Disposable) {
+                    disposable.dispose()
+                }
+            }
+        )
+
+        assertTrue(disposable.isDisposed)
+    }
+
     @Test
     fun disconnects_from_upstream_WHEN_subscriberCount_is_2_and_all_subscribers_unsubscribed() {
         val disposable = Disposable()
```

**File**: `reaktive/src/jvmNativeCommonTest/kotlin/com/badoo/reaktive/observable/RefCountThreadingTest.kt` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+package com.badoo.reaktive.observable
+
+import com.badoo.reaktive.disposable.Disposable
+import com.badoo.reaktive.test.doInBackground
+import com.badoo.reaktive.test.observable.test
+import com.badoo.reaktive.utils.lock.ConditionLock
+import com.badoo.reaktive.utils.lock.synchronized
+import com.badoo.reaktive.utils.lock.waitFor
+import com.badoo.reaktive.utils.lock.waitForOrFail
+import kotlin.test.Test
+import kotlin.test.assertFalse
+import kotlin.time.Duration.Companion.seconds
+
+class RefCountThreadingTest {
+
+    @Test
+    fun does_not_connect_second_time_concurrently_while_disconnecting() {
+        val lock = ConditionLock()
+        var isDisconnecting = false
+        var isSecondTime = false
+        var isConnectedSecondTimeConcurrently = false
+
+        val disposable =
+            Disposable {
+                lock.synchronized {
+                    isDisconnecting = true
+                    isSecondTime = true
+                    lock.signal()
+                    lock.waitFor(timeout = 1.seconds) { false }
+                    isDisconnecting = false
+                }
+            }
+
+        val upstream =
+            testUpstream(
+                connect = { onConnect ->
+                    lock.synchronized {
+                        if (!isSecondTime) {
+                            onConnect?.invoke(disposable)
+                        } else {
+                            isConnectedSecondTimeConcurrently = isDisconnecting
+                        }
+                    }
+                }
+            )
+
+        val refCount = upstream.refCount(subscriberCount = 1)
+        val observer = refCount.test()
+        doInBackground { observer.dispose() }
+
+        lock.synchronized {
+            lock.waitForOrFail { !isSecondTime }
+        }
+
+        refCount.test()
+
+        assertFalse(isConnectedSecondTimeConcurrently)
+    }
+
+    private fun testUpstream(
+        connect: (onConnect: ((Disposable) -> Unit)?) -> Unit = {},
+    ): ConnectableObservable<Int?> =
+        object : ConnectableObservable<Int?> {
+            override fun connect(onConnect: ((Disposable) -> Unit)?) {
+                connect.invoke(onConnect)
+            }
+
+            override fun subscribe(observer: ObservableObserver<Int?>) {
+                observer.onSubscribe(Disposable())
+            }
+        }
+}
```

---

### Incident Patch 9: `37cf3e51` (2024-02-24)
**Commit Message**: Fixed race conditions in refCount

**File**: `reaktive/src/commonMain/kotlin/com/badoo/reaktive/observable/RefCount.kt` (modified, +16/-18)
```diff
@@ -2,10 +2,9 @@ package com.badoo.reaktive.observable
 
 import com.badoo.reaktive.disposable.CompositeDisposable
 import com.badoo.reaktive.disposable.Disposable
+import com.badoo.reaktive.disposable.SerialDisposable
 import com.badoo.reaktive.disposable.plusAssign
-import com.badoo.reaktive.utils.atomic.AtomicInt
-import com.badoo.reaktive.utils.atomic.AtomicReference
-import com.badoo.reaktive.utils.atomic.getAndChange
+import com.badoo.reaktive.utils.lock.Lock
 
 /**
  * Returns an [Observable] that connects to this [ConnectableObservable] when the number
@@ -16,23 +15,15 @@ import com.badoo.reaktive.utils.atomic.getAndChange
 fun <T> ConnectableObservable<T>.refCount(subscriberCount: Int = 1): Observable<T> {
     require(subscriberCount > 0)
 
-    val subscribeCount = AtomicInt()
-    val disposable = AtomicReference<Disposable?>(null)
+    var subscribeCount = 0
+    val lock = Lock()
+    val connectionDisposable = SerialDisposable()
 
     return observable { emitter ->
         val disposables = CompositeDisposable()
         emitter.setDisposable(disposables)
 
-        disposables +=
-            Disposable {
-                if (subscribeCount.addAndGet(-1) == 0) {
-                    disposable
-                        .getAndChange { null }
-                        ?.dispose()
-                }
-            }
-
-        val shouldConnect = subscribeCount.addAndGet(1) == subscriberCount
+        val shouldConnect = lock.synchronized { ++subscribeCount == subscriberCount }
 
         this@refCount.subscribe(
             object : ObservableObserver<T>, ObservableCallbacks<T> by emitter {
@@ -43,9 +34,16 @@ fun <T> ConnectableObservable<T>.refCount(subscriberCount: Int = 1): Observable<
         )
 
         if (shouldConnect) {
-            this@refCount.connect {
-                disposable.value = it
-            }
+            this@refCount.connect(connectionDisposable::set)
         }
+
+        disposables +=
+            Disposable {
+                lock.synchronized {
+                    if (--subscribeCount == 0) {
+                        connectionDisposable.set(null)
+                    }
+                }
+            }
     }
 }
```

**File**: `reaktive/src/commonTest/kotlin/com/badoo/reaktive/observable/RefCountTest.kt` (modified, +34/-0)
```diff
@@ -82,6 +82,40 @@ class RefCountTest {
         assertTrue(disposable.isDisposed)
     }
 
+    @Test
+    fun connects_to_upstream_WHEN_subscriberCount_is_1_and_subscribed_and_disposed_in_onSubscribe() {
+        var isConnected = false
+        val upstream = testUpstream(connect = { isConnected = true })
+        val refCount = upstream.refCount(subscriberCount = 1)
+
+        refCount.subscribe(
+            object : DefaultObservableObserver<Int?> {
+                override fun onSubscribe(disposable: Disposable) {
+                    disposable.dispose()
+                }
+            }
+        )
+
+        assertTrue(isConnected)
+    }
+
+    @Test
+    fun disconnects_from_upstream_WHEN_subscriberCount_is_1_and_subscribed_and_disposed_in_onSubscribe() {
+        val disposable = Disposable()
+        val upstream = testUpstream(connect = { onConnect -> onConnect?.invoke(disposable) })
+        val refCount = upstream.refCount(subscriberCount = 1)
+
+        refCount.subscribe(
+            object : DefaultObservableObserver<Int?> {
+                override fun onSubscribe(disposable: Disposable) {
+                    disposable.dispose()
+                }
+            }
+        )
+
+        assertTrue(disposable.isDisposed)
+    }
+
     @Test
     fun disconnects_from_upstream_WHEN_subscriberCount_is_2_and_all_subscribers_unsubscribed() {
         val disposable = Disposable()
```

**File**: `reaktive/src/jvmNativeCommonTest/kotlin/com/badoo/reaktive/observable/RefCountThreadingTest.kt` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+package com.badoo.reaktive.observable
+
+import com.badoo.reaktive.disposable.Disposable
+import com.badoo.reaktive.test.doInBackground
+import com.badoo.reaktive.test.observable.test
+import com.badoo.reaktive.utils.lock.ConditionLock
+import com.badoo.reaktive.utils.lock.synchronized
+import com.badoo.reaktive.utils.lock.waitFor
+import com.badoo.reaktive.utils.lock.waitForOrFail
+import kotlin.test.Test
+import kotlin.test.assertFalse
+import kotlin.time.Duration.Companion.seconds
+
+class RefCountThreadingTest {
+
+    @Test
+    fun does_not_connect_second_time_concurrently_while_disconnecting() {
+        val lock = ConditionLock()
+        var isDisconnecting = false
+        var isSecondTime = false
+        var isConnectedSecondTimeConcurrently = false
+
+        val disposable =
+            Disposable {
+                lock.synchronized {
+                    isDisconnecting = true
+                    isSecondTime = true
+                    lock.signal()
+                    lock.waitFor(timeout = 1.seconds) { false }
+                    isDisconnecting = false
+                }
+            }
+
+        val upstream =
+            testUpstream(
+                connect = { onConnect ->
+                    lock.synchronized {
+                        if (!isSecondTime) {
+                            onConnect?.invoke(disposable)
+                        } else {
+                            isConnectedSecondTimeConcurrently = isDisconnecting
+                        }
+                    }
+                }
+            )
+
+        val refCount = upstream.refCount(subscriberCount = 1)
+        val observer = refCount.test()
+        doInBackground { observer.dispose() }
+
+        lock.synchronized {
+            lock.waitForOrFail { !isSecondTime }
+        }
+
+        refCount.test()
+
+        assertFalse(isConnectedSecondTimeConcurrently)
+    }
+
+    private fun testUpstream(
+        connect: (onConnect: ((Disposable) -> Unit)?) -> Unit = {},
+    ): ConnectableObservable<Int?> =
+        object : ConnectableObservable<Int?> {
+            override fun connect(onConnect: ((Disposable) -> Unit)?) {
+                connect.invoke(onConnect)
+            }
+
+            override fun subscribe(observer: ObservableObserver<Int?>) {
+                observer.onSubscribe(Disposable())
+            }
+        }
+}
```

---

### Incident Patch 10: `a4fe69fc` (2024-01-10)
**Commit Message**: Make TimeoutId platform-specific type

**File**: `reaktive/src/jsCommonMain/kotlin/com/badoo/reaktive/scheduler/JsFunctions.kt` (modified, +4/-4)
```diff
@@ -1,9 +1,9 @@
 package com.badoo.reaktive.scheduler
 
-internal expect fun jsSetTimeout(task: () -> Unit, delayMillis: Int): Any
+internal expect fun jsSetTimeout(task: () -> Unit, delayMillis: Int): TimeoutId
 
-internal expect fun jsSetInterval(task: () -> Unit, delayMillis: Int): Any
+internal expect fun jsSetInterval(task: () -> Unit, delayMillis: Int): TimeoutId
 
-internal expect fun jsClearTimeout(id: Any)
+internal expect fun jsClearTimeout(id: TimeoutId)
 
-internal expect fun jsClearInterval(id: Any)
+internal expect fun jsClearInterval(id: TimeoutId)
```

**File**: `reaktive/src/jsCommonMain/kotlin/com/badoo/reaktive/scheduler/MainScheduler.kt` (modified, +12/-7)
```diff
@@ -20,8 +20,8 @@ internal class MainScheduler : Scheduler {
 
         private var _isDisposed = false
 
-        private val timeoutIds = mutableSetOf<Any>()
-        private val intervalIds = mutableSetOf<Any>()
+        private val timeoutIds = mutableSetOf<TimeoutId>()
+        private val intervalIds = mutableSetOf<TimeoutId>()
 
         init {
             disposables += this
@@ -48,12 +48,17 @@ internal class MainScheduler : Scheduler {
         }
 
         private fun setTimeout(delay: Duration, task: () -> Unit) {
-            timeoutIds.add(
-                jsSetTimeout(
-                    task = task,
-                    delayMillis = delay.coerceAtLeastZero().inWholeMilliseconds.toInt()
-                )
+            var timeoutId: TimeoutId? = null
+
+            timeoutId = jsSetTimeout(
+                task = {
+                    timeoutIds.remove(timeoutId)
+                    task()
+                },
+                delayMillis = delay.coerceAtLeastZero().inWholeMilliseconds.toInt()
             )
+
+            timeoutIds.add(timeoutId)
         }
 
         private fun setInterval(period: Duration, task: () -> Unit) {
```

**File**: `reaktive/src/jsCommonMain/kotlin/com/badoo/reaktive/scheduler/TimeoutId.kt` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+package com.badoo.reaktive.scheduler
+
+internal expect class TimeoutId
```

**File**: `reaktive/src/jsCommonTest/kotlin/com/badoo/reaktive/scheduler/MainSchedulerTest.kt` (modified, +7/-4)
```diff
@@ -3,6 +3,7 @@ package com.badoo.reaktive.scheduler
 import com.badoo.reaktive.observable.flatMapSingle
 import com.badoo.reaktive.observable.observableOf
 import com.badoo.reaktive.observable.toList
+import com.badoo.reaktive.single.doOnBeforeFinally
 import com.badoo.reaktive.single.map
 import com.badoo.reaktive.single.singleTimer
 import com.badoo.reaktive.test.single.AsyncTestResult
@@ -67,11 +68,13 @@ class MainSchedulerTest {
                 listOf(0, 1, 2, 3),
             )
 
-        return checkTicks.toList().testAwait { results ->
-            assertEquals(expectedResults, results)
+        return checkTicks
+            .toList()
             // Required to pass test on NodeJS environment since runtime waits
             // for all tasks to cancel or finish their work.
-            executor.cancel()
-        }
+            .doOnBeforeFinally(executor::cancel)
+            .testAwait { results ->
+                assertEquals(expectedResults, results)
+            }
     }
 }
```

**File**: `reaktive/src/jsMain/kotlin/com/badoo/reaktive/scheduler/JsFunctions.kt` (modified, +8/-8)
```diff
@@ -2,16 +2,16 @@ package com.badoo.reaktive.scheduler
 
 import com.badoo.reaktive.global.external.globalThis
 
-internal actual fun jsSetTimeout(task: () -> Unit, delayMillis: Int): Any =
-    globalThis.setTimeout(task, delayMillis)
+internal actual fun jsSetTimeout(task: () -> Unit, delayMillis: Int): TimeoutId =
+    TimeoutId(globalThis.setTimeout(task, delayMillis))
 
-internal actual fun jsSetInterval(task: () -> Unit, delayMillis: Int): Any =
-    globalThis.setInterval(task, delayMillis)
+internal actual fun jsSetInterval(task: () -> Unit, delayMillis: Int): TimeoutId =
+    TimeoutId(globalThis.setInterval(task, delayMillis))
 
-internal actual fun jsClearTimeout(id: Any) {
-    globalThis.clearTimeout(id)
+internal actual fun jsClearTimeout(id: TimeoutId) {
+    globalThis.clearTimeout(id.id)
 }
 
-internal actual fun jsClearInterval(id: Any) {
-    globalThis.clearInterval(id)
+internal actual fun jsClearInterval(id: TimeoutId) {
+    globalThis.clearInterval(id.id)
 }
```

**File**: `reaktive/src/jsMain/kotlin/com/badoo/reaktive/scheduler/TimeoutId.kt` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+package com.badoo.reaktive.scheduler
+
+internal actual class TimeoutId(val id: dynamic)
```

**File**: `reaktive/src/wasmJsMain/kotlin/com/badoo/reaktive/scheduler/JsFunctions.kt` (modified, +10/-8)
```diff
@@ -1,15 +1,17 @@
 package com.badoo.reaktive.scheduler
 
-internal actual fun jsSetTimeout(task: () -> Unit, delayMillis: Int): Any =
-    js("setTimeout(task, delayMillis)")
+import kotlinx.browser.window
 
-internal actual fun jsSetInterval(task: () -> Unit, delayMillis: Int): Any =
-    js("setInterval(task, delayMillis)")
+internal actual fun jsSetTimeout(task: () -> Unit, delayMillis: Int): TimeoutId =
+    window.setTimeout({ task().toJsReference() }, delayMillis)
 
-internal actual fun jsClearTimeout(id: Any) {
-    js("clearTimeout(id)")
+internal actual fun jsSetInterval(task: () -> Unit, delayMillis: Int): TimeoutId =
+    window.setInterval({ task().toJsReference() }, delayMillis)
+
+internal actual fun jsClearTimeout(id: TimeoutId) {
+    window.clearTimeout(id)
 }
 
-internal actual fun jsClearInterval(id: Any) {
-    js("clearInterval(id)")
+internal actual fun jsClearInterval(id: TimeoutId) {
+    window.clearInterval(id)
 }
```

**File**: `reaktive/src/wasmJsMain/kotlin/com/badoo/reaktive/scheduler/TimeoutId.kt` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+package com.badoo.reaktive.scheduler
+
+// Required until Kotlin 2.0.0 https://youtrack.jetbrains.com/issue/KT-37316
+@Suppress("ACTUAL_WITHOUT_EXPECT")
+internal actual typealias TimeoutId = Int
```

---

### Incident Patch 11: `f685041a` (2024-01-10)
**Commit Message**: Fix MainScheduler timeout and interval types. Fix MainScheduler wrongly removes timeout and interval ids on first task execution.

**File**: `reaktive/src/jsCommonMain/kotlin/com/badoo/reaktive/scheduler/JsFunctions.kt` (modified, +4/-4)
```diff
@@ -1,9 +1,9 @@
 package com.badoo.reaktive.scheduler
 
-internal expect fun jsSetTimeout(task: () -> Unit, delayMillis: Int): Int
+internal expect fun jsSetTimeout(task: () -> Unit, delayMillis: Int): Any
 
-internal expect fun jsSetInterval(task: () -> Unit, delayMillis: Int): Int
+internal expect fun jsSetInterval(task: () -> Unit, delayMillis: Int): Any
 
-internal expect fun jsClearTimeout(id: Int)
+internal expect fun jsClearTimeout(id: Any)
 
-internal expect fun jsClearInterval(id: Int)
+internal expect fun jsClearInterval(id: Any)
```

**File**: `reaktive/src/jsCommonMain/kotlin/com/badoo/reaktive/scheduler/MainScheduler.kt` (modified, +12/-22)
```diff
@@ -20,8 +20,8 @@ internal class MainScheduler : Scheduler {
 
         private var _isDisposed = false
 
-        private val timeoutIds = mutableSetOf<Int>()
-        private val intervalIds = mutableSetOf<Int>()
+        private val timeoutIds = mutableSetOf<Any>()
+        private val intervalIds = mutableSetOf<Any>()
 
         init {
             disposables += this
@@ -48,31 +48,21 @@ internal class MainScheduler : Scheduler {
         }
 
         private fun setTimeout(delay: Duration, task: () -> Unit) {
-            var id: Int? = null
-
-            id = jsSetTimeout(
-                {
-                    timeoutIds.remove(id)
-                    task()
-                },
-                delay.coerceAtLeastZero().inWholeMilliseconds.toInt(),
+            timeoutIds.add(
+                jsSetTimeout(
+                    task = task,
+                    delayMillis = delay.coerceAtLeastZero().inWholeMilliseconds.toInt()
+                )
             )
-
-            timeoutIds.add(id)
         }
 
         private fun setInterval(period: Duration, task: () -> Unit) {
-            var id: Int? = null
-
-            id = jsSetInterval(
-                {
-                    intervalIds.remove(id)
-                    task()
-                },
-                period.coerceAtLeastZero().inWholeMilliseconds.toInt(),
+            intervalIds.add(
+                jsSetInterval(
+                    task = task,
+                    delayMillis = period.coerceAtLeastZero().inWholeMilliseconds.toInt(),
+                )
             )
-
-            intervalIds.add(id)
         }
 
         override fun cancel() {
```

**File**: `reaktive/src/jsMain/kotlin/com/badoo/reaktive/scheduler/JsFunctions.kt` (modified, +4/-4)
```diff
@@ -2,16 +2,16 @@ package com.badoo.reaktive.scheduler
 
 import com.badoo.reaktive.global.external.globalThis
 
-internal actual fun jsSetTimeout(task: () -> Unit, delayMillis: Int): Int =
+internal actual fun jsSetTimeout(task: () -> Unit, delayMillis: Int): Any =
     globalThis.setTimeout(task, delayMillis)
 
-internal actual fun jsSetInterval(task: () -> Unit, delayMillis: Int): Int =
+internal actual fun jsSetInterval(task: () -> Unit, delayMillis: Int): Any =
     globalThis.setInterval(task, delayMillis)
 
-internal actual fun jsClearTimeout(id: Int) {
+internal actual fun jsClearTimeout(id: Any) {
     globalThis.clearTimeout(id)
 }
 
-internal actual fun jsClearInterval(id: Int) {
+internal actual fun jsClearInterval(id: Any) {
     globalThis.clearInterval(id)
 }
```

**File**: `reaktive/src/wasmJsMain/kotlin/com/badoo/reaktive/scheduler/JsFunctions.kt` (modified, +4/-4)
```diff
@@ -1,15 +1,15 @@
 package com.badoo.reaktive.scheduler
 
-internal actual fun jsSetTimeout(task: () -> Unit, delayMillis: Int): Int =
+internal actual fun jsSetTimeout(task: () -> Unit, delayMillis: Int): Any =
     js("setTimeout(task, delayMillis)")
 
-internal actual fun jsSetInterval(task: () -> Unit, delayMillis: Int): Int =
+internal actual fun jsSetInterval(task: () -> Unit, delayMillis: Int): Any =
     js("setInterval(task, delayMillis)")
 
-internal actual fun jsClearTimeout(id: Int) {
+internal actual fun jsClearTimeout(id: Any) {
     js("clearTimeout(id)")
 }
 
-internal actual fun jsClearInterval(id: Int) {
+internal actual fun jsClearInterval(id: Any) {
     js("clearInterval(id)")
 }
```

---

### Incident Patch 12: `7bd804df` (2024-01-04)
**Commit Message**: Fix missing `JsName` import

**File**: `reaktive/src/jsWasmJsCommonMain/kotlin/com/badoo/reaktive/disposable/Various.kt` (modified, +2/-0)
```diff
@@ -1,5 +1,7 @@
 package com.badoo.reaktive.disposable
 
+import kotlin.js.JsName
+
 @JsName("disposableWithCallback")
 @Suppress("FunctionName")
 actual inline fun Disposable(crossinline onDispose: () -> Unit): Disposable =
```

---

### Incident Patch 13: `f6b32e75` (2023-11-04)
**Commit Message**: Update build.gradle

Update version to 2.0.0

**File**: `build.gradle` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 buildscript {
-    ext.reaktive_version = '2.0.0-beta01'
+    ext.reaktive_version = '2.0.0'
     ext.reaktive_group_id = 'com.badoo.reaktive'
 }
 
```

---

### Incident Patch 14: `630aadeb` (2023-11-01)
**Commit Message**: Merge pull request #761 from arkivanov/fix-warnings

Fix warnings

**File**: `coroutines-interop/src/commonMain/kotlin/com/badoo/reaktive/coroutinesinterop/CoroutineContextScheduler.kt` (modified, +3/-2)
```diff
@@ -20,6 +20,7 @@ import kotlinx.coroutines.sync.Mutex
 import kotlinx.coroutines.sync.withLock
 import kotlin.coroutines.CoroutineContext
 import kotlin.time.Duration
+import kotlin.time.TimeSource.Monotonic.ValueTimeMark
 
 internal class CoroutineContextScheduler(
     private val context: CoroutineContext,
@@ -102,7 +103,7 @@ internal class CoroutineContextScheduler(
             }
         }
 
-        private suspend fun delayUntilStart(startTime: Duration) {
+        private suspend fun delayUntilStart(startTime: ValueTimeMark) {
             val uptime = clock.uptime
             if (uptime < startTime) {
                 delay(startTime - uptime)
@@ -123,7 +124,7 @@ internal class CoroutineContextScheduler(
         }
 
         private data class Task(
-            val startTime: Duration,
+            val startTime: ValueTimeMark,
             val period: Duration,
             val task: () -> Unit
         )
```

**File**: `coroutines-interop/src/commonTest/kotlin/com/badoo/reaktive/coroutinesinterop/CoroutineContextSchedulerTest.kt` (modified, +3/-1)
```diff
@@ -13,6 +13,8 @@ import kotlin.test.assertTrue
 import kotlin.time.Duration
 import kotlin.time.Duration.Companion.milliseconds
 import kotlin.time.Duration.Companion.seconds
+import kotlin.time.TimeSource
+import kotlin.time.TimeSource.Monotonic.ValueTimeMark
 
 @OptIn(ExperimentalCoroutinesApi::class) // UnconfinedTestDispatcher is experimental
 class CoroutineContextSchedulerTest {
@@ -291,7 +293,7 @@ class CoroutineContextSchedulerTest {
     }
 
     private class TestClock : Clock {
-        override var uptime: Duration = Duration.ZERO
+        override var uptime: ValueTimeMark = TimeSource.Monotonic.markNow()
 
         fun advanceBy(duration: Duration) {
             uptime += duration
```

**File**: `coroutines-interop/src/commonTest/kotlin/com/badoo/reaktive/coroutinesinterop/SchedulerCoroutineDispatcherTest.kt` (modified, +2/-3)
```diff
@@ -14,7 +14,6 @@ import kotlin.coroutines.EmptyCoroutineContext
 import kotlin.test.Test
 import kotlin.test.assertEquals
 import kotlin.test.assertTrue
-import kotlin.time.Duration
 import kotlin.time.Duration.Companion.milliseconds
 
 class SchedulerCoroutineDispatcherTest {
@@ -44,15 +43,15 @@ class SchedulerCoroutineDispatcherTest {
         val scheduler = TestScheduler(isManualProcessing = false)
         val dispatcher = SchedulerCoroutineDispatcher(scheduler = scheduler)
         val startTime = DefaultClock.uptime
-        val endTime = AtomicReference(Duration.ZERO)
+        val endTime = AtomicReference(startTime)
 
         launch(dispatcher) {
             delay(500.milliseconds)
             endTime.value = DefaultClock.uptime
         }
 
         withContext(Dispatchers.Default) {
-            while (endTime.value == Duration.ZERO) {
+            while (endTime.value == startTime) {
                 yield()
             }
         }
```

**File**: `reaktive/src/commonMain/kotlin/com/badoo/reaktive/completable/BlockingAwait.kt` (modified, +1/-1)
```diff
@@ -13,5 +13,5 @@ import com.badoo.reaktive.maybe.blockingGet
  * Please refer to the corresponding RxJava [document](http://reactivex.io/RxJava/javadoc/io/reactivex/Completable.html#blockingAwait--).
  */
 fun Completable.blockingAwait() {
-    asMaybe().blockingGet()
+    asMaybe().blockingGet<Unit>()
 }
```

**File**: `reaktive/src/commonMain/kotlin/com/badoo/reaktive/scheduler/TrampolineScheduler.kt` (modified, +4/-3)
```diff
@@ -10,6 +10,7 @@ import com.badoo.reaktive.utils.clock.DefaultClock
 import com.badoo.reaktive.utils.coerceAtLeastZero
 import com.badoo.reaktive.utils.serializer.serializer
 import kotlin.time.Duration
+import kotlin.time.TimeSource.Monotonic.ValueTimeMark
 
 internal class TrampolineScheduler(
     private val clock: Clock = DefaultClock,
@@ -79,19 +80,19 @@ internal class TrampolineScheduler(
                 return false
             }
 
-            val nextStart = if (task.period.isInfinite()) Duration.INFINITE else clock.uptime + task.period
+            val nextStart = if (task.period.isInfinite()) null else clock.uptime + task.period
 
             task.task()
 
-            if (!nextStart.isInfinite()) {
+            if (nextStart != null) {
                 submit(task.copy(startTime = nextStart))
             }
 
             return true
         }
 
         private data class Task(
-            val startTime: Duration,
+            val startTime: ValueTimeMark,
             val period: Duration,
             val task: () -> Unit
         ) : Comparable<Task> {
```

**File**: `reaktive/src/darwinCommonMain/kotlin/com/badoo/reaktive/scheduler/MainScheduler.kt` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ import platform.darwin.DISPATCH_TIME_NOW
 import platform.darwin.dispatch_after
 import platform.darwin.dispatch_get_main_queue
 import platform.darwin.dispatch_time
-import kotlin.native.concurrent.AtomicReference
+import kotlin.concurrent.AtomicReference
 import kotlin.time.Duration
 
 internal class MainScheduler : Scheduler {
```

**File**: `reaktive/src/nativeCommonMain/kotlin/com/badoo/reaktive/disposable/Various.kt` (modified, +1/-4)
```diff
@@ -1,11 +1,9 @@
 package com.badoo.reaktive.disposable
 
-import kotlin.native.concurrent.AtomicInt
+import kotlin.concurrent.AtomicInt
 
-@Suppress("FunctionName")
 actual inline fun Disposable(crossinline onDispose: () -> Unit): Disposable =
     object : Disposable {
-        @Suppress("ObjectPropertyName") // Backing property
         private var _isDisposed = AtomicInt(0)
         override val isDisposed: Boolean get() = _isDisposed.value != 0
 
@@ -16,7 +14,6 @@ actual inline fun Disposable(crossinline onDispose: () -> Unit): Disposable =
         }
     }
 
-@Suppress("FunctionName")
 actual fun Disposable(): Disposable = SimpleDisposable()
 
 private class SimpleDisposable : Disposable {
```

**File**: `reaktive/src/nativeCommonMain/kotlin/com/badoo/reaktive/looperthread/FixedLooperThreadStrategy.kt` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 package com.badoo.reaktive.looperthread
 
-import kotlin.native.concurrent.AtomicInt
+import kotlin.concurrent.AtomicInt
 
 internal class FixedLooperThreadStrategy(threadCount: Int) : LooperThreadStrategy {
 
```

---

### Incident Patch 15: `7a7f6d93` (2023-09-09)
**Commit Message**: Add publishAllFilteredToMavenLocal to build CI flow

**File**: `.github/workflows/build.yml` (modified, +2/-0)
```diff
@@ -39,6 +39,7 @@ jobs:
           cache-read-only: ${{ github.ref != 'refs/heads/master' && github.ref != 'refs/heads/version-2.0' }}
           arguments: |
             build
+            publishAllFilteredToMavenLocal
             -Ptarget=all_linux_hosted
       - name: Build macOS
         if: matrix.os == 'macOS-latest'
@@ -53,6 +54,7 @@ jobs:
             :reaktive:build
             :coroutines-interop:build
             :sample-mpp-module:build
+            publishAllFilteredToMavenLocal
             -Ptarget=all_macos_hosted
       # Do not invoke from Gradle, it creates circular dependency (Gradle invokes XCode invokes Gradle).
       - name: Build iOS app
```

#### Recent Merged Pull Requests:
- **PR #799** (closed): [Renovate] Update actions/setup-java action to v6 - autoclosed (@appsec-renovate-bot[bot])
- **PR #798** (closed): [Renovate] Update gradle/actions action to v6 - autoclosed (@appsec-renovate-bot[bot])
- **PR #797** (closed): [Renovate] Update actions/upload-artifact action to v7 - autoclosed (@appsec-renovate-bot[bot])
- **PR #796** (closed): [Renovate] Update actions/setup-java action to v5 - autoclosed (@appsec-renovate-bot[bot])
- **PR #795** (closed): [Renovate] Update actions/checkout action to v7 - autoclosed (@appsec-renovate-bot[bot])
- **PR #792** (closed): [Renovate] Pin dependencies - autoclosed (@appsec-renovate-bot[bot])
- **PR #790** (2025-06-01): Updated Kotlin to 2.1.21 (@arkivanov)
- **PR #788** (2025-05-17): Use new Sonatype and simplify (@CherryPerry)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
