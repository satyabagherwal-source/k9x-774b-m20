# Forensic Learning Record (Deep Inspection): LouisCAD/Splitties

> **Canonical Artifact**: `07_PROJECT_LEARNING/louiscad-splitties-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/LouisCAD/Splitties](https://github.com/LouisCAD/Splitties))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:53:02.739Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `LouisCAD/Splitties`
- **Description**: A collection of hand-crafted extensions for your Kotlin projects.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2582 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `modules/arch-lifecycle/src/androidMain/kotlin/splitties/arch/lifecycle/LifecycleObserver.kt`
```
/*
 * Copyright 2019 Louis Cognault Ayeva Derman. Use of this source code is governed by the Apache 2.0 license.
 */

package splitties.arch.lifecycle

import androidx.lifecycle.Lifecycle
import androidx.lifecycle.Lifecycle.Event.*
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.LifecycleOwner
import splitties.experimental.ExperimentalSplittiesApi

/**
 * A LifecycleObserver interface for Kotlin where you can implement only what you need.
 * Make sure you import the right one when implementing it.
 */
//TODO: Move the artifact so it depends only on lifecycle-common.
@ExperimentalSplittiesApi
interface LifecycleObserver : LifecycleEventObserver {

    fun onCreate(owner: LifecycleOwner) = Unit
    fun onStart(owner: LifecycleOwner) = Unit
    fun onResume(owner: LifecycleOwner) = Unit
    fun onPause(owner: LifecycleOwner) = Unit
    fun onStop(owner: LifecycleOwner) = Unit
    fun onDestroy(owner: LifecycleOwner) = Unit

    override fun onStateChanged(source: LifecycleOwner, event: Lifecycle.Event) {
        when (event) {
            ON_CREATE -> onCreate(source)
            ON_START -> onStart(source)
            ON_RESUME -> onResume(source)
            ON_PAUSE -> onPause(source)
            ON_STOP -> onStop(source)
            ON_DESTROY -> onDestroy(source)
            ON_ANY -> error("ON_ANY must not be sent by anybody")
        }
    }
}

```

### Core Architecture Module: `modules/arch-lifecycle/src/androidMain/kotlin/splitties/arch/lifecycle/LiveData.kt`
```
/*
 * Copyright 2019 Louis Cognault Ayeva Derman. Use of this source code is governed by the Apache 2.0 license.
 */

package splitties.arch.lifecycle

import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LiveData
import androidx.lifecycle.MediatorLiveData
import androidx.lifecycle.Observer
import androidx.lifecycle.map
import androidx.lifecycle.switchMap

@ObsoleteSplittiesLifecycleApi
inline fun <T> LifecycleOwner.observe(
    liveData: LiveData<T>,
    crossinline observer: (t: T?) -> Unit
): Observer<T> = Observer<T> {
    observer(it)
}.also { liveData.observe(this, it) }

@ObsoleteSplittiesLifecycleApi
inline fun <T : Any> LifecycleOwner.observeNotNull(
    liveData: LiveData<T>,
    crossinline observer: (t: T) -> Unit
): Observer<T> = Observer<T> {
    if (it != null) observer(it)
}.also { liveData.observe(this, it) }

@ObsoleteSplittiesLifecycleApi
@JvmName("observeWithLiveDataOfNullable")
inline fun <T : Any> LifecycleOwner.observeNotNull(
    liveData: LiveData<T?>,
    crossinline observer: (t: T) -> Unit
): Observer<T?> = Observer<T?> {
    if (it != null) observer(it)
}.also { liveData.observe(this, it) }

/**
 * Applies the given function on the main thread to each value emitted by source
 * LiveData and returns LiveData, which emits resulting values.
 *
 * The given function [transform] will be **executed on the main thread**.
 *
 * @param transform   a function to apply
 * @param X           a type of source LiveData
 * @param Y           a type of resulting LiveData.
 * @return            a LiveData which emits resulting values
 */
@Deprecated(
    message = "Use the one from androidx now.",
    ReplaceWith("map(transform)", "androidx.lifecycle.map")
)
inline fun <X, Y> LiveData<X>.map(
    crossinline transform: (X?) -> Y
): LiveData<Y> = map { input -> transform(input) }

@Deprecated(
    "Bad semantics. Doesn't follow the conventional behavior of mapNotNull from Kotlin."
)
inline fun <X, Y> LiveData<X>.mapNotNull(
    crossinline transform: (X) -> Y
): LiveData<Y> {
    val result = MediatorLiveData<Y>()
    result.addSource(this) { x ->
        if (x != null) result.value = transform(x)
    }
    return result
}

@Deprecated(
    message = "Use the one from androidx now.",
    ReplaceWith("switchMap(transform)", "androidx.lifecycle.switchMap")
)
inline fun <X, Y> LiveData<X>.switchMap(
    crossinline transform: (X?) -> LiveData<Y>?
): LiveData<Y> = switchMap { input -> transform(input) }

@Deprecated(
    "Bad semantics. Doesn't follow the conventional behavior of mapNotNull from Kotlin."
)
@ObsoleteSplittiesLifecycleApi
inline fun <X, Y> LiveData<X>.switchMapNotNull(
    crossinline transform: (X) -> LiveData<Y>?
): LiveData<Y> = switchMap { input: X? ->
    input?.let { transform(it) }
}

```

### Core Architecture Module: `modules/arch-lifecycle/src/androidMain/kotlin/splitties/arch/lifecycle/ObsoleteSplittiesLifecycleApi.kt`
```
/*
 * Copyright 2019 Louis Cognault Ayeva Derman. Use of this source code is governed by the Apache 2.0 license.
 */

package splitties.arch.lifecycle

/**
 * A similar API is being added in AndroidX KTX artifacts (in alpha as of 2018-12-17).
 * Symbols that have this annotation will eventually be deprecated, then removed, unless
 * they satisfy a use case worth keeping, that AndroidX doesn't.
 */
@MustBeDocumented
@Retention(value = AnnotationRetention.BINARY)
@RequiresOptIn(level = RequiresOptIn.Level.WARNING)
annotation class ObsoleteSplittiesLifecycleApi

```

### Core Architecture Module: `modules/arch-lifecycle/src/androidMain/kotlin/splitties/arch/lifecycle/ViewModel.kt`
```
/*
 * Copyright 2019-2021 Louis Cognault Ayeva Derman. Use of this source code is governed by the Apache 2.0 license.
 */

package splitties.arch.lifecycle

import androidx.activity.viewModels
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import androidx.fragment.app.activityViewModels
import androidx.fragment.app.viewModels
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider

inline fun <reified VM : ViewModel> FragmentActivity.viewModels(
    noinline factory: () -> VM
): Lazy<VM> = viewModels { TypeSafeViewModelFactory(factory) }

inline fun <reified VM : ViewModel> Fragment.activityViewModels(
    noinline factory: () -> VM
): Lazy<VM> = activityViewModels { TypeSafeViewModelFactory(factory) }

inline fun <reified VM : ViewModel> Fragment.viewModels(
    noinline factory: () -> VM
): Lazy<VM> = viewModels { TypeSafeViewModelFactory(factory) }

@PublishedApi
internal class TypeSafeViewModelFactory<VM : ViewModel>(
    private val factory: () -> VM
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>) = factory() as T
}

```

### Core Architecture Module: `modules/compose/callable-state/src/androidMain/kotlin/CallableState.kt`
```
@file:Suppress("nothing_to_inline")

package splitties.androidx.compose

import androidx.compose.runtime.*
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.runtime.snapshots.SnapshotStateList
import kotlinx.coroutines.*
import splitties.collections.forEachByIndex
import kotlin.coroutines.Continuation
import kotlin.coroutines.resume

@Composable
inline fun <T> rememberCallableState(): CallableState<T> {
    return remember { CallableState() }
}

@Stable //TODO: Report Compose compiler crash when this is made an inline value class.
class CallableState<T> private constructor(
    @PublishedApi
    internal val awaiters: SnapshotStateList<Continuation<T>>
) {

    constructor() : this(mutableStateListOf())

    suspend fun awaitOneCall(): T = suspendCancellableCoroutine { c ->
        awaiters.add(c)
        c.invokeOnCancellation { awaiters.remove(c) }
    }

    operator fun invoke(newValue: T): Boolean {
        val list = Snapshot.withMutableSnapshot {
            val result = awaiters.toList()
            awaiters.clear()
            result
        }
        list.forEachByIndex { it.resume(newValue) }
        return list.isNotEmpty()
    }

    inline val awaitersCount: Int get() = awaiters.size
    inline val awaitsCall: Boolean get() = awaiters.isNotEmpty()
}

@Suppress("nothing_to_inline")
inline operator fun CallableState<Unit>.invoke(): Boolean = invoke(Unit)

@Suppress("nothing_to_inline")
inline fun CallableState<Unit>.asCallable(): () -> Unit = { invoke() }

```

### Core Architecture Module: `modules/coroutines/src/commonMain/kotlin/splitties/coroutines/ScopeLoops.kt`
```
/*
 * Copyright 2019 Louis Cognault Ayeva Derman. Use of this source code is governed by the Apache 2.0 license.
 */

package splitties.coroutines

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.ensureActive
import splitties.experimental.ExperimentalSplittiesApi
import kotlin.coroutines.coroutineContext

/**
 * As of Kotlin 1.3, `while (true)` evaluates to [Unit] instead of [Nothing] in lambdas, and using
 * `coroutineContext.ensureActive()` would add another line of boilerplate, so this inline extension
 * function can be handy. The fact that is is inline allows you to do a non local return just like
 * you would from a while loop.
 */
@ExperimentalSplittiesApi
suspend inline fun repeatWhileActive(block: () -> Unit): Nothing {
    while (true) {
        coroutineContext.ensureActive()
        block()
    }
}

/**
 * As of Kotlin 1.3, `while (true)` evaluates to [Unit] instead of [Nothing] in lambdas, and using
 * `coroutineContext.ensureActive()` would add another line of boilerplate, so this inline extension
 * function can be handy. The fact that is is inline allows you to do a non local return just like
 * you would from a while loop.
 *
 * If [ignoreInnerCancellations] is `true`, [CancellationException]s thrown from the [block] will be
 * caught and ignored. Next iteration will still check for cancellation, so it will exit safely by
 * throwing it if the entire scope is cancelled. This gives a chance to recover from local
 * cancellations in an iteration.
 */
@ExperimentalSplittiesApi
suspend inline fun repeatWhileActive(
    ignoreInnerCancellations: Boolean,
    block: () -> Unit
): Nothing {
    if (ignoreInnerCancellations) while (true) {
        coroutineContext.ensureActive() // Outer cancellations are caught here
        try {
            block()
        } catch (ignored: CancellationException) {
        }
    } else repeatWhileActive(block)
}

```

### Core Architecture Module: `modules/lifecycle-coroutines/src/androidMain/kotlin/splitties/lifecycle/coroutines/Lifecycle.kt`
```
/*
 * Copyright 2019 Louis Cognault Ayeva Derman. Use of this source code is governed by the Apache 2.0 license.
 */
package splitties.lifecycle.coroutines

import androidx.lifecycle.Lifecycle
import androidx.lifecycle.Lifecycle.State.INITIALIZED
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.LifecycleOwner
import kotlinx.coroutines.*
import splitties.experimental.ExperimentalSplittiesApi

/**
 * Returns a [CoroutineScope] that uses [Dispatchers.MainAndroid] by default, and that will be cancelled as
 * soon as this [Lifecycle] [currentState][Lifecycle.getCurrentState] is no longer
 * [at least][Lifecycle.State.isAtLeast] the passed [activeWhile] state.
 *
 * **Beware**: if the current state is lower than the passed [activeWhile] state, you'll get an
 * already cancelled scope.
 */
@ExperimentalSplittiesApi
fun Lifecycle.createScope(activeWhile: Lifecycle.State): CoroutineScope {
    return CoroutineScope(createJob(activeWhile) + Dispatchers.Main.immediate)
}

/**
 * Creates a [SupervisorJob] that will be cancelled as soon as this [Lifecycle]
 * [currentState][Lifecycle.getCurrentState] is no longer [at least][Lifecycle.State.isAtLeast] the
 * passed [activeWhile] state.
 *
 * **Beware**: if the current state is lower than the passed [activeWhile] state, you'll get an
 * already cancelled job.
 */
@ExperimentalSplittiesApi
fun Lifecycle.createJob(activeWhile: Lifecycle.State = INITIALIZED): Job {
    require(activeWhile != Lifecycle.State.DESTROYED) {
        "DESTROYED is a terminal state that is forbidden for createJob(…), to avoid leaks."
    }
    return SupervisorJob().also { job ->
        when (currentState) {
            Lifecycle.State.DESTROYED -> job.cancel()
            else -> @OptIn(DelicateCoroutinesApi::class) GlobalScope.launch(Dispatchers.Main) {
                // Ensures state is in sync.
                addObserver(object : LifecycleEventObserver {
                    override fun onStateChanged(source: LifecycleOwner, event: Lifecycle.Event) {
                        if (currentState < activeWhile) {
                            removeObserver(this)
                            job.cancel()
                        }
                    }
                })
            }
        }
    }
}

```

### Core Architecture Module: `modules/lifecycle-coroutines/src/androidMain/kotlin/splitties/lifecycle/coroutines/LifecycleAwaitState.kt`
```
/*
 * Copyright 2019 Louis Cognault Ayeva Derman. Use of this source code is governed by the Apache 2.0 license.
 */
package splitties.lifecycle.coroutines

import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.LifecycleOwner
import kotlinx.coroutines.*
import splitties.experimental.ExperimentalSplittiesApi
import kotlin.coroutines.resume

/** Returns as soon as this [Lifecycle] is in the resumed state. */
@ExperimentalSplittiesApi
suspend inline fun Lifecycle.awaitResumed() = awaitState(Lifecycle.State.RESUMED)

/** Returns as soon as this [Lifecycle] is at least in the started state. */
@ExperimentalSplittiesApi
suspend inline fun Lifecycle.awaitStarted() = awaitState(Lifecycle.State.STARTED)

/**
 * Returns as soon as this [Lifecycle] is at least in the created state.
 *
 * Can be useful for use in the init blocks or constructors of a [LifecycleOwner].
 */
@ExperimentalSplittiesApi
suspend inline fun Lifecycle.awaitCreated() = awaitState(Lifecycle.State.CREATED)

/**
 * This function returns/resumes as soon as the state of this [Lifecycle] is at least the
 * passed [state].
 *
 * [Lifecycle.State.DESTROYED] is forbidden, to avoid leaks.
 *
 * See also [awaitResumed], [awaitStarted] and [awaitCreated].
 */
@ExperimentalSplittiesApi
suspend fun Lifecycle.awaitState(state: Lifecycle.State) {
    require(state != Lifecycle.State.DESTROYED) {
        "DESTROYED is a terminal state that is forbidden for awaitState(…), to avoid leaks."
    }
    if (currentState >= state) return // Fast path
    withContext(Dispatchers.Main.immediate) {
        if (currentState == Lifecycle.State.DESTROYED) { // Fast path to cancellation
            cancel()
        } else suspendCancellableCoroutine<Unit> { c ->
            val observer = object : LifecycleEventObserver {
                override fun onStateChanged(source: LifecycleOwner, event: Lifecycle.Event) {
                    if (currentState >= state) {
                        removeObserver(this)
                        c.resume(Unit)
                    } else if (currentState == Lifecycle.State.DESTROYED) {
                        c.cancel()
                    }
                }
            }
            addObserver(observer)
            c.invokeOnCancellation { removeObserver(observer) }
        }
    }
}

```

### Core Architecture Module: `modules/lifecycle-coroutines/src/androidMain/kotlin/splitties/lifecycle/coroutines/LifecycleFlow.kt`
```
/*
 * Copyright 2020 Louis Cognault Ayeva Derman. Use of this source code is governed by the Apache 2.0 license.
 */

package splitties.lifecycle.coroutines

import androidx.lifecycle.Lifecycle
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import splitties.experimental.ExperimentalSplittiesApi
import kotlin.time.Duration
import kotlin.time.ExperimentalTime

@ExperimentalSplittiesApi
@OptIn(ExperimentalCoroutinesApi::class)
fun <T> Flow<T>.whileStarted(lifecycle: Lifecycle): Flow<T> {
    return lifecycle.isStartedFlow().flatMapLatest { isStarted ->
        if (isStarted) this else emptyFlow()
    }
}

@ExperimentalTime
@ExperimentalSplittiesApi
@OptIn(ExperimentalCoroutinesApi::class)
fun <T> Flow<T>.whileStarted(lifecycle: Lifecycle, timeout: Duration): Flow<T> {
    return lifecycle.isStartedFlow(timeout = timeout).flatMapLatest { isStarted ->
        if (isStarted) this else emptyFlow()
    }
}

```

### Core Architecture Module: `modules/lifecycle-coroutines/src/androidMain/kotlin/splitties/lifecycle/coroutines/LifecycleState.kt`
```
/*
 * Copyright 2020 Louis Cognault Ayeva Derman. Use of this source code is governed by the Apache 2.0 license.
 */

package splitties.lifecycle.coroutines

import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import splitties.experimental.ExperimentalSplittiesApi
import kotlin.time.*

@ExperimentalTime
@ExperimentalSplittiesApi
actual fun Lifecycle.isResumedFlow(timeout: Duration): Flow<Boolean> = flow {
    isResumedFlow().collectIndexed { index, isResumed ->
        if (isResumed.not() && index != 0) delay(timeout)
        emit(isResumed)
    }
}.distinctUntilChanged()

@ExperimentalTime
@ExperimentalSplittiesApi
actual fun Lifecycle.isStartedFlow(timeout: Duration): Flow<Boolean> = flow {
    isStartedFlow().collectIndexed { index, isStarted ->
        if (isStarted.not() && index != 0) delay(timeout)
        emit(isStarted)
    }
}.distinctUntilChanged()

@ExperimentalSplittiesApi
actual fun Lifecycle.isResumedFlow(): Flow<Boolean> {
    return isStateAtLeastFlow(minimalState = Lifecycle.State.RESUMED)
}

@ExperimentalSplittiesApi
actual fun Lifecycle.isStartedFlow(): Flow<Boolean> {
    return isStateAtLeastFlow(minimalState = Lifecycle.State.STARTED)
}

@ExperimentalSplittiesApi
actual fun Lifecycle.isStateAtLeastFlow(minimalState: Lifecycle.State): Flow<Boolean> = stateFlow().map {
    it.isAtLeast(minimalState)
}.distinctUntilChanged()

@ExperimentalSplittiesApi
@OptIn(ExperimentalCoroutinesApi::class)
@Suppress("RemoveExplicitTypeArguments") // Remove when new inference is successfully enabled.
actual fun Lifecycle.stateFlow(): Flow<Lifecycle.State> = callbackFlow<Lifecycle.State> {
    val observer = LifecycleEventObserver { _, _ ->
        trySend(currentState)
        if (currentState == Lifecycle.State.DESTROYED) close()
    }
    addObserver(observer)
    try {
        awaitCancellation()
    } finally {
        removeObserver(observer)
    }
}.flowOn(Dispatchers.Main.immediate)

```

### Core Architecture Module: `modules/lifecycle-coroutines/src/androidMain/kotlin/splitties/lifecycle/coroutines/LifecycleStateH.kt`
```
/*
 * Copyright 2020 Louis Cognault Ayeva Derman. Use of this source code is governed by the Apache 2.0 license.
 */

package splitties.lifecycle.coroutines

import androidx.lifecycle.Lifecycle
import kotlinx.coroutines.flow.*
import kotlin.time.*

@ExperimentalTime
expect fun Lifecycle.isStartedFlow(timeout: Duration): Flow<Boolean>
expect fun Lifecycle.isStartedFlow(): Flow<Boolean>
expect fun Lifecycle.isStateAtLeastFlow(minimalState: Lifecycle.State): Flow<Boolean>

@ExperimentalTime
expect fun Lifecycle.isResumedFlow(timeout: Duration): Flow<Boolean>
expect fun Lifecycle.isResumedFlow(): Flow<Boolean>

expect fun Lifecycle.stateFlow(): Flow<Lifecycle.State>

```

### Core Architecture Module: `modules/permissions/compose/src/androidMain/kotlin/PermissionRequestState.kt`
```
package splitties.permissions.compose

import androidx.activity.ComponentActivity
import androidx.activity.compose.LocalActivityResultRegistryOwner
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.remember
import kotlinx.coroutines.sync.*
import splitties.androidx.compose.CallableState
import splitties.permissions.ensureAllPermissions

@Composable
fun rememberPermissionRequestState(
    permission: String?,
    showRationaleBeforeFirstAsk: Boolean
): PermissionRequestState {
    val activity = LocalActivityResultRegistryOwner.current as ComponentActivity
    return remember(permission, activity) {
        PermissionRequestStateImpl(
            activity = activity,
            permissions = when (permission) {
                null -> emptyList()
                else -> listOf(permission)
            },
            showRationaleBeforeFirstAsk = showRationaleBeforeFirstAsk
        )
    }
}

@Composable
fun rememberPermissionsRequestState(
    permissions: List<String>,
    showRationaleBeforeFirstAsk: Boolean
): PermissionRequestState {
    val activity = LocalActivityResultRegistryOwner.current as ComponentActivity
    return remember(permissions, activity) {
        PermissionRequestStateImpl(
            activity = activity,
            permissions = permissions,
            showRationaleBeforeFirstAsk = showRationaleBeforeFirstAsk
        )
    }
}

@Stable
sealed interface PermissionRequestState {
    suspend fun attemptGetting(): Boolean
    val showRationaleAndContinueOrReturn: CallableState<Boolean>
    val askOpenSettingsOrReturn: CallableState<Boolean>
}

@Stable
private class PermissionRequestStateImpl(
    private val activity: ComponentActivity,
    private val permissions: List<String>,
    private val showRationaleBeforeFirstAsk: Boolean,
) : PermissionRequestState {

    override val showRationaleAndContinueOrReturn = CallableState<Boolean>()
    override val askOpenSettingsOrReturn = CallableState<Boolean>()
    private val mutex = Mutex()

    override suspend fun attemptGetting(): Boolean = mutex.withLock {
        if (permissions.isEmpty()) return true
        activity.ensureAllPermissions(
            permissions = permissions,
            showRationaleBeforeFirstAsk = showRationaleBeforeFirstAsk,
            showRationaleAndContinueOrReturn = {
                showRationaleAndContinueOrReturn.awaitOneCall()
            },
            askOpenSettingsOrReturn = {
                askOpenSettingsOrReturn.awaitOneCall()
            }
        ) {
            return false
        }
        return true
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #256** (2021-07-04): **The new shapeableImageView misses an entry in instantiateMaterialView and fails after R8**
  *Symptoms*: 

- **Issue #198** (2020-09-01): **If performClick is called more than once in a row, awaitOneClick crashes**
  *Symptoms*: Reproducer: ```kotlin val submitBtn = ctx.button {     text = "Submit" } launch {     delay(2500)     repeat(2) {         submitBtn.performClick() // Two clicks with no dispatch in between.     } } @UseExperimental(ExperimentalSplittiesApi::class) submitBtn.awaitOneClick() ```  This affects `awaitOneClick` and `awaitOneLongClick`. That happens because the `finally` block is executed only after `suspendCancellableCoroutine` resumes, which happens after `performClick` as been called a second time.  The fix is pretty easy. Instead of just waiting for the `finally` block to be executed to set the listener to null, it needs to be set to null in `setOnClickListener` lambda too.

- **Issue #191** (2019-05-02): **Handle empty grantResults in Permissions**
  *Symptoms*: [The documentation](https://developer.android.com/reference/android/app/Activity.html#onRequestPermissionsResult(int,%2520java.lang.String%5B%5D,%2520int%5B%5D)) states the following:  > Note: It is possible that the permissions request interaction with the user is interrupted. In this case you will receive empty permissions and results arrays which should be treated as a cancellation.  Currently, if this rare situation happens, an `ArrayOutOfBoundsException` is thrown and crashes the app.  This needs to be handled properly in the Permissions split.

- **Issue #128** (2018-11-02): **verticalChain property instead of horizontalChain**
  *Symptoms*: https://github.com/LouisCAD/Splitties/blob/b2e8f3263e24b744756f96347ef292356a135e8c/viewdsl-constraintlayout/src/main/java/splitties/viewdsl/constraintlayout/Chains.kt#L55

- **Issue #73** (2018-04-11): **TextInputLayout.text setter does not sets text.**
  *Symptoms*: https://github.com/LouisCAD/Splitties/blob/1810e0cb8fd008d5674329a3b335b0927d21da31/views-design/src/main/java/splitties/views/design/TextInputLayout.kt#L24  The setter `value` is not used, and current `text` is used instead. This needs to be fixed ASAP.  The IDE should have reported it, so I created an issue for it: https://youtrack.jetbrains.com/issue/KT-23710

- **Issue #34** (2018-02-28): **[Arch Lifecycle] activityScope extensions on Fragment uses Fragment scope**
  *Symptoms*: This is misleading and should be renamed to `fragmentScope`. `activityScope` can be provided using the host activity `ViewModelProvider` though.

- **Issue #27** (2018-02-27): **First line is not limited to the switch in IconTwoLinesSwitchListItem**
  *Symptoms*: Fixed by using this code: ```kotlin add(firstLine, lParams(height = wrapContent) {     startMargin = dip(72)     topMargin = dip(8)     endMargin = dip(8)     startOfParent()     topOfParent()     endToStart = switch.id }) ```

- **Issue #26** (2018-02-27): **Show toast**
  *Symptoms*: Fixes #25

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

### Incident Patch 1: `89cfcda5` (2023-04-05)
**Commit Message**: Improve API of toPendingXxx and fix binary compatibility

**File**: `modules/intents/src/androidMain/kotlin/splitties/intents/PendingIntents.kt` (modified, +19/-42)
```diff
@@ -9,82 +9,59 @@ import android.app.PendingIntent
 import android.content.Intent
 import android.os.Build.VERSION.SDK_INT
 import android.os.Bundle
-import splitties.bitflags.withFlag
 import splitties.init.appCtx
 
 /**
  * @param reqCode Can be left to default (0) if this [PendingIntent] is unique as defined from
  * [Intent.filterEquals].
  * @param options are ignored below API 16.
  */
-fun Intent.toPendingActivity(
+inline fun Intent.toPendingActivity(
     reqCode: Int = 0,
-    flags: Int = 0,
-    options: Bundle? = null,
-    mutable: Boolean = false
-): PendingIntent {
-    val actualFlags = flags.withMutability(mutable)
-    return if (SDK_INT >= 16) {
-        PendingIntent.getActivity(appCtx, reqCode, this, actualFlags, options)
-    } else PendingIntent.getActivity(appCtx, reqCode, this, actualFlags)
-}
+    flags: Int,
+    options: Bundle? = null
+): PendingIntent = if (SDK_INT >= 16) {
+    PendingIntent.getActivity(appCtx, reqCode, this, flags, options)
+} else PendingIntent.getActivity(appCtx, reqCode, this, flags)
 
 /**
  * @param reqCode Can be left to default (0) if this [PendingIntent] is unique as defined from
  * [Intent.filterEquals].
  * @param options are ignored below API 16.
  */
-fun Array<Intent>.toPendingActivities(
+inline fun Array<Intent>.toPendingActivities(
     reqCode: Int = 0,
-    flags: Int = 0,
-    options: Bundle? = null,
-    mutable: Boolean = false
-): PendingIntent {
-    val actualFlags = flags.withMutability(mutable)
-    return if (SDK_INT >= 16) {
-        PendingIntent.getActivities(appCtx, reqCode, this, actualFlags, options)
-    } else PendingIntent.getActivities(appCtx, reqCode, this, actualFlags)
-}
-
-@PublishedApi
-internal fun Int.withMutability(isMutable: Boolean): Int {
-    @Suppress("InlinedApi")
-    val mutabilityFlag = if (isMutable) PendingIntent.FLAG_MUTABLE else PendingIntent.FLAG_IMMUTABLE
-    return this.withFlag(mutabilityFlag)
-}
+    flags: Int,
+    options: Bundle? = null
+): PendingIntent = if (SDK_INT >= 16) {
+    PendingIntent.getActivities(appCtx, reqCode, this, flags, options)
+} else PendingIntent.getActivities(appCtx, reqCode, this, flags)
 
 /**
  * @param reqCode Can be left to default (0) if this [PendingIntent] is unique as defined from
  * [Intent.filterEquals].
  */
 fun Intent.toPendingForegroundService(
     reqCode: Int = 0,
-    flags: Int = 0,
-    mutable: Boolean = false
+    flags: Int
 ): PendingIntent = if (SDK_INT >= 26) {
-    PendingIntent.getForegroundService(appCtx, reqCode, this, flags.withMutability(mutable))
-} else toPendingService(reqCode, flags, mutable)
+    PendingIntent.getForegroundService(appCtx, reqCode, this, flags)
+} else toPendingService(reqCode, flags)
 
 /**
  * @param reqCode Can be left to default (0) if this [PendingIntent] is unique as defined from
  * [Intent.filterEquals].
  */
 inline fun Intent.toPendingService(
     reqCode: Int = 0,
-    flags: Int = 0,
-    mutable: Boolean = false
-): PendingIntent {
-    return PendingIntent.getService(appCtx, reqCode, this, flags.withMutability(mutable))
-}
+    flags: Int
+): PendingIntent = PendingIntent.getService(appCtx, reqCode, this, flags)
 
 /**
  * @param reqCode Can be left to default (0) if this [PendingIntent] is unique as defined from
  * [Intent.filterEquals].
  */
 inline fun Intent.toPendingBroadcast(
     reqCode: Int = 0,
-    flags: Int = 0,
-    mutable: Boolean = false
-): PendingIntent {
-    return PendingIntent.getBroadcast(appCtx, reqCode, this, flags.withMutability(mutable))
-}
+    flags: Int
+): PendingIntent = PendingIntent.getBroadcast(appCtx, reqCode, this, flags)
```

**File**: `modules/intents/src/androidMain/kotlin/splitties/intents/ToPendingIntent.kt` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+/*
+ * Copyright 2019-2023 Louis Cognault Ayeva Derman. Use of this source code is governed by the Apache 2.0 license.
+ */
+@file:Suppress("nothing_to_inline")
+
+package splitties.intents
+
+import android.app.PendingIntent
+import android.content.Intent
+import android.os.Build.VERSION.SDK_INT
+import android.os.Bundle
+import splitties.bitflags.withFlag
+import splitties.init.appCtx
+
+/**
+ * @param reqCode Can be left to default (0) if this [PendingIntent] is unique as defined from
+ * [Intent.filterEquals].
+ * @param options are ignored below API 16.
+ */
+inline fun Intent.toPendingActivity(
+    reqCode: Int = 0,
+    mutable: Boolean = false,
+    oneShot: Boolean = false,
+    cancelCurrent: Boolean = false,
+    options: Bundle? = null,
+    flags: Int = 0.withKnownFlags(mutable, oneShot, cancelCurrent)
+): PendingIntent = if (SDK_INT >= 16) {
+    PendingIntent.getActivity(appCtx, reqCode, this, flags, options)
+} else PendingIntent.getActivity(appCtx, reqCode, this, flags)
+
+/**
+ * @param reqCode Can be left to default (0) if this [PendingIntent] is unique as defined from
+ * [Intent.filterEquals].
+ * @param options are ignored below API 16.
+ */
+inline fun Array<Intent>.toPendingActivities(
+    reqCode: Int = 0,
+    mutable: Boolean = false,
+    oneShot: Boolean = false,
+    cancelCurrent: Boolean = false,
+    options: Bundle? = null,
+    flags: Int = 0.withKnownFlags(mutable, oneShot, cancelCurrent)
+): PendingIntent = if (SDK_INT >= 16) {
+    PendingIntent.getActivities(appCtx, reqCode, this, flags, options)
+} else PendingIntent.getActivities(appCtx, reqCode, this, flags)
+
+/**
+ * @param reqCode Can be left to default (0) if this [PendingIntent] is unique as defined from
+ * [Intent.filterEquals].
+ */
+fun Intent.toPendingForegroundService(
+    reqCode: Int = 0,
+    mutable: Boolean = false,
+    oneShot: Boolean = false,
+    cancelCurrent: Boolean = false,
+    flags: Int = 0.withKnownFlags(mutable, oneShot, cancelCurrent)
+): PendingIntent = if (SDK_INT >= 26) {
+    PendingIntent.getForegroundService(appCtx, reqCode, this, flags)
+} else PendingIntent.getService(appCtx, reqCode, this, flags)
+
+/**
+ * @param reqCode Can be left to default (0) if this [PendingIntent] is unique as defined from
+ * [Intent.filterEquals].
+ */
+inline fun Intent.toPendingService(
+    reqCode: Int = 0,
+    mutable: Boolean = false,
+    oneShot: Boolean = false,
+    cancelCurrent: Boolean = false,
+    flags: Int = 0.withKnownFlags(mutable, oneShot, cancelCurrent)
+): PendingIntent = PendingIntent.getService(appCtx, reqCode, this, flags)
+
+/**
+ * @param reqCode Can be left to default (0) if this [PendingIntent] is unique as defined from
+ * [Intent.filterEquals].
+ */
+inline fun Intent.toPendingBroadcast(
+    reqCode: Int = 0,
+    mutable: Boolean = false,
+    oneShot: Boolean = false,
+    cancelCurrent: Boolean = false,
+    flags: Int = 0.withKnownFlags(mutable, oneShot, cancelCurrent)
+): PendingIntent = PendingIntent.getBroadcast(appCtx, reqCode, this, flags)
+
+@PublishedApi
+internal fun Int.withKnownFlags(
+    isMutable: Boolean,
+    isOneShot: Boolean,
+    cancelCurrent: Boolean
+): Int {
+    var flags = this
+    @Suppress("InlinedApi")
+    val mutabilityFlag = if (isMutable) PendingIntent.FLAG_MUTABLE else PendingIntent.FLAG_IMMUTABLE
+    flags = flags.withFlag(mutabilityFlag)
+    val newFlag =  when {
+        isOneShot -> PendingIntent.FLAG_ONE_SHOT
+        cancelCurrent -> PendingIntent.FLAG_CANCEL_CURRENT
+        else -> PendingIntent.FLAG_UPDATE_CURRENT
+    }
+    flags = flags.withFlag(newFlag)
+    return flags
+}
```

---

### Incident Patch 2: `4dfb999f` (2023-03-03)
**Commit Message**: Handle permissions requiring a higher targetSdk

We crash the app with a proper error message to help the developer fix the problem.

**File**: `modules/permissions/core/src/androidMain/kotlin/splitties/permissions/EnsurePermissions.kt` (modified, +56/-14)
```diff
@@ -6,6 +6,7 @@
 
 package splitties.permissions
 
+import android.Manifest
 import android.app.Activity
 import android.content.Context
 import android.content.Intent
@@ -268,21 +269,25 @@ private suspend fun ComponentActivity.requestPermissionsNow(
     var requestsCount = 0
     repeatWhileActive {
         val requestTime = SystemClock.elapsedRealtimeNanos()
-        val grantResults = activityResultRegistry.awaitResult(
+        val (recognizedPermissions, grantResults) = activityResultRegistry.awaitResult(
             key = generateVolatileKey(permissions),
             contract = ReliablePermissionRequestContract()
         ) {
             it.launch(permissions)
             requestsCount++
         }
+        checkAllPermissionsWereRecognized(
+            requestedPermissions = permissions,
+            recognizedPermissions = recognizedPermissions
+        )
         if (grantResults.isEmpty()) return@run null // Go to fallback.
         val elapsedNanos = SystemClock.elapsedRealtimeNanos() - requestTime
         val result = grantResultsToPermissionRequestResult(
             askCount = askCount,
             requestsCount = requestsCount,
             timeSinceRequest = elapsedNanos.nanoseconds,
             permissions = permissions,
-            nonEmptyGrantResults = grantResults
+            grantResults = grantResults
         )
         if (result != null) return@run result
     }
@@ -307,7 +312,7 @@ private suspend fun ComponentActivity.requestPermissionsNow(
             requestsCount = requestsCount,
             timeSinceRequest = timeToResultNanos.nanoseconds,
             permissions = permissions,
-            nonEmptyGrantResults = grantResults
+            grantResults = grantResults
         )
         if (result != null) return@run result
     }
@@ -333,18 +338,22 @@ private suspend inline fun <I, O> ActivityResultRegistry.awaitResult(
 }
 
 private class ReliablePermissionRequestContract :
-    ActivityResultContract<Array<String>, IntArray>() {
+    ActivityResultContract<Array<String>, Pair<Array<String>, IntArray>>() {
 
     override fun createIntent(context: Context, input: Array<String>): Intent {
         return RequestMultiplePermissions().createIntent(context, input)
     }
 
-    override fun parseResult(resultCode: Int, intent: Intent?): IntArray {
-        checkNotNull(intent) // Always provided. See ComponentActivity.onRequestPermissionsResult(…)
-        val grantResults =
-            intent.getIntArrayExtra(RequestMultiplePermissions.EXTRA_PERMISSION_GRANT_RESULTS)
-        checkNotNull(grantResults) // Always provided. See ComponentActivity.onRequestPermissionsResult(…)
-        return grantResults
+    override fun parseResult(resultCode: Int, intent: Intent?): Pair<Array<String>, IntArray> {
+        val recognizedPermissions: Array<String>
+        val grantResults: IntArray
+        with(RequestMultiplePermissions) {
+            // Values below always provided. See ComponentActivity.onRequestPermissionsResult(…)
+            val extras = intent!!.extras!!
+            recognizedPermissions = extras.getStringArray(EXTRA_PERMISSIONS)!!
+            grantResults = extras.getIntArray(EXTRA_PERMISSION_GRANT_RESULTS)!!
+        }
+        return recognizedPermissions to grantResults
     }
 }
 
@@ -354,11 +363,11 @@ private fun Activity.grantResultsToPermissionRequestResult(
     requestsCount: Int,
     timeSinceRequest: Duration,
     permissions: Array<String>,
-    nonEmptyGrantResults: IntArray
+    grantResults: IntArray
 ): PermissionRequestResult? {
     require(askCount >= 1)
-    check(nonEmptyGrantResults.isNotEmpty())
-    val indexOfFirstNotGranted = nonEmptyGrantResults.indexOfFirst {
+    if (grantResults.isEmpty()) return null
+    val indexOfFirstNotGranted = grantResults.indexOfFirst {
         it != PackageManager.PERMISSION_GRANTED
     }
     return if (indexOfFirstNotGranted == -1) {
@@ -376,7 +385,7 @@ private fun Activity.grantResultsToPermissionRequestResult(
 //        }
 //        toast(debugText)
         if (shouldShowRationale) {
-            //TODO: Store it somewhere, so we can know
+            //TODO: Store it somewhere, if we can find a good use for it.
             PermissionRequestResult.Denied.MayAskAgain(firstDeniedPermission)
         } else if (SDK_INT < Build.VERSION_CODES.R) {
             // Before Android 11, we can rely on the value of shouldShowRequestPermissionRationale.
@@ -411,3 +420,36 @@ private fun Activity.grantResultsToPermissionRequestResult(
         }
     }
 }
+
+private fun checkAllPermissionsWereRecognized(
+    requestedPermissions: Array<String>,
+    recognizedPermissions: Array<String>
+) {
+    if (recognizedPermissions contentEquals requestedPermissions) return
+    val hiddenPermissions = requestedPermissions.asList() - recognizedPermissions.toSet()
+    val errorMessage: String = buildString {
+        val unrecognized = hiddenPermissions.size
+        val requested = requestedPermissions.siz
```

**File**: `samples/android-app/src/main/AndroidManifest.xml` (modified, +1/-0)
```diff
@@ -7,6 +7,7 @@
 
     <uses-permission android:name="android.permission.VIBRATE" />
     <uses-permission android:name="android.permission.WRITE_CALENDAR" />
+    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
 
     <application
         android:name="com.example.splitties.DemoApp"
```

**File**: `samples/android-app/src/main/kotlin/com/example/splitties/extensions/permissions/SampleEnsurePermission.kt` (modified, +33/-32)
```diff
@@ -13,45 +13,14 @@ import androidx.fragment.app.FragmentActivity
 import androidx.fragment.app.FragmentManager
 import androidx.lifecycle.Lifecycle
 import com.example.splitties.R
-import kotlinx.coroutines.suspendCancellableCoroutine
 import splitties.alertdialog.appcompat.alertDialog
 import splitties.alertdialog.appcompat.coroutines.DialogButton
 import splitties.alertdialog.appcompat.coroutines.showAndAwait
 import splitties.experimental.ExperimentalSplittiesApi
+import splitties.permissions.ensureAllPermissions
 import splitties.permissions.ensurePermission
 import splitties.resources.txt
 
-suspend fun FragmentActivity.ensurePermissionOrFinishAndCancel(
-    permission: String,
-    askDialogTitle: CharSequence,
-    askDialogMessage: CharSequence,
-    showRationaleBeforeFirstAsk: Boolean = true,
-    returnButtonText: CharSequence = txt(R.string.quit)
-): Unit = ensurePermission(
-    activity = this,
-    fragmentManager = supportFragmentManager,
-    lifecycle = lifecycle,
-    permission = permission,
-    askDialogTitle = askDialogTitle,
-    askDialogMessage = askDialogMessage,
-    showRationaleBeforeFirstAsk = showRationaleBeforeFirstAsk,
-    returnButtonText = returnButtonText
-) { finish(); suspendCancellableCoroutine<Nothing> { c -> c.cancel() } }
-
-suspend fun ComponentActivity.ensurePermissionOrFinishAndCancel(
-    permission: String,
-    askDialogTitle: CharSequence,
-    askDialogMessage: CharSequence,
-    showRationaleBeforeFirstAsk: Boolean = true,
-    returnButtonText: CharSequence = txt(R.string.quit)
-): Unit = ensurePermission(
-    permission = permission,
-    askDialogTitle = askDialogTitle,
-    askDialogMessage = askDialogMessage,
-    showRationaleBeforeFirstAsk = showRationaleBeforeFirstAsk,
-    returnButtonText = returnButtonText
-) { finish(); suspendCancellableCoroutine<Nothing> { c -> c.cancel() } }
-
 suspend inline fun FragmentActivity.ensurePermission(
     permission: String,
     askDialogTitle: CharSequence,
@@ -122,6 +91,38 @@ suspend inline fun ComponentActivity.ensurePermission(
     returnOrThrowBlock = returnOrThrowBlock
 )
 
+suspend inline fun ComponentActivity.ensureAllPermissions(
+    vararg permissions: String,
+    askDialogTitle: CharSequence,
+    askDialogMessage: CharSequence,
+    showRationaleBeforeFirstAsk: Boolean = true,
+    returnButtonText: CharSequence = txt(R.string.quit),
+    returnOrThrowBlock: () -> Nothing
+): Unit = ensureAllPermissions(
+    *permissions,
+    showRationaleAndContinueOrReturn = {
+        alertDialog(
+            title = askDialogTitle,
+            message = askDialogMessage
+        ).showAndAwait(
+            okValue = true,
+            negativeButton = DialogButton(returnButtonText, false),
+            dismissValue = true
+        )
+    },
+    showRationaleBeforeFirstAsk = showRationaleBeforeFirstAsk,
+    askOpenSettingsOrReturn = {
+        alertDialog(
+            message = txt(R.string.permission_denied_permanently_go_to_settings)
+        ).showAndAwait(
+            okValue = true,
+            negativeButton = DialogButton(returnButtonText, false),
+            dismissValue = true
+        )
+    },
+    returnOrThrowBlock = returnOrThrowBlock
+)
+
 suspend inline fun ensurePermission(
     activity: Activity,
     fragmentManager: FragmentManager,
```

**File**: `samples/android-app/src/main/kotlin/com/example/splitties/permissions/PermissionsExampleActivity.kt` (modified, +10/-7)
```diff
@@ -1,15 +1,14 @@
 /*
- * Copyright 2019 Louis Cognault Ayeva Derman. Use of this source code is governed by the Apache 2.0 license.
+ * Copyright 2019-2023 Louis Cognault Ayeva Derman. Use of this source code is governed by the Apache 2.0 license.
  */
 package com.example.splitties.permissions
 
 import android.Manifest
 import android.os.Build.VERSION.SDK_INT
 import android.os.Bundle
-import androidx.activity.ComponentActivity
 import androidx.appcompat.app.AppCompatActivity
 import androidx.lifecycle.coroutineScope
-import com.example.splitties.extensions.permissions.ensurePermissionOrFinishAndCancel
+import com.example.splitties.extensions.permissions.ensureAllPermissions
 import kotlinx.coroutines.*
 import splitties.dimensions.dip
 import splitties.snackbar.longSnack
@@ -32,12 +31,16 @@ class PermissionsExampleActivity : AppCompatActivity() {
     override fun onCreate(savedInstanceState: Bundle?) {
         super.onCreate(savedInstanceState)
         lifecycle.coroutineScope.launch {
-            (this@PermissionsExampleActivity as ComponentActivity).ensurePermissionOrFinishAndCancel(
-                permission = Manifest.permission.WRITE_CALENDAR,
+            ensureAllPermissions(
+                Manifest.permission.POST_NOTIFICATIONS,
+                Manifest.permission.WRITE_CALENDAR,
                 askDialogTitle = "Calendar permission required",
                 askDialogMessage = "We will ask for calendar permission.\n" +
                     "Don't grant it too soon if you want to test all cases from this sample!"
-            )
+            ) {
+                finish()
+                awaitCancellation()
+            }
             contentView = verticalLayout {
                 gravity = gravityCenter
                 add(textView {
@@ -47,7 +50,7 @@ class PermissionsExampleActivity : AppCompatActivity() {
                     centerText()
                 }, lParams { margin = dip(16) })
                 if (SDK_INT >= 33) add(button {
-                    text = "Revoke permission on next kill"
+                    text = "Revoke write calendar permission on next kill"
                     onClick {
                         revokeSelfPermissionOnKill(Manifest.permission.WRITE_CALENDAR)
                         longSnack("Permission will be revoked on next kill")
```

---

### Incident Patch 3: `18b3b559` (2023-02-28)
**Commit Message**: Add tests for race and raceOf

**File**: `modules/coroutines/build.gradle.kts` (modified, +7/-0)
```diff
@@ -24,6 +24,13 @@ kotlin {
             api(splitties("experimental"))
             api(KotlinX.coroutines.core)
         }
+        commonTest {
+            dependencies {
+                implementation(Kotlin.test)
+                implementation(KotlinX.coroutines.test)
+                implementation(Testing.kotest.assertions.core)
+            }
+        }
         all {
             languageSettings.apply {
                 optIn("splitties.experimental.ExperimentalSplittiesApi")
```

**File**: `modules/coroutines/src/commonTest/kotlin/RacingTest.kt` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+package splitties.coroutines
+
+import io.kotest.matchers.booleans.shouldBeTrue
+import io.kotest.matchers.shouldBe
+import kotlinx.coroutines.*
+import kotlinx.coroutines.test.*
+import kotlin.test.Test
+import kotlin.time.Duration.Companion.milliseconds
+import kotlin.time.Duration.Companion.seconds
+
+/*
+ * Copyright 2023 Louis Cognault Ayeva Derman. Use of this source code is governed by the Apache 2.0 license.
+ */
+
+@OptIn(ExperimentalCoroutinesApi::class)
+class RacingTest {
+
+    @Test
+    fun testRace() = runTest {
+        var ran = false
+        var cancelledLateRacer = false
+        var cancelledSlowBuilder = false
+        val expectedResult = "Yup"
+        race {
+            launchRacer {
+                try {
+                    delay(10.milliseconds)
+                } catch (e: CancellationException) {
+                    cancelledLateRacer = true
+                    throw e
+                }
+                error("Nein")
+            }
+            launchRacer {
+                delay(5.milliseconds)
+                ran = true
+                expectedResult
+            }
+            try {
+                delay(1.seconds)
+            } catch (e: CancellationException) {
+                cancelledSlowBuilder = true
+                throw e
+            }
+            launchRacer {
+                error("Nope")
+            }
+        } shouldBe expectedResult
+        ran.shouldBeTrue()
+        cancelledLateRacer.shouldBeTrue()
+        cancelledSlowBuilder.shouldBeTrue()
+    }
+
+    @Test
+    fun testRaceOf() = runTest {
+        val expectedResult = "Yup"
+        raceOf({ expectedResult }) shouldBe expectedResult
+        raceOf({ expectedResult }, { "Nope" }) shouldBe expectedResult
+        raceOf({ yield(); "Nope" }, { expectedResult }) shouldBe expectedResult
+        var cancelledSlowRacer = false
+        raceOf({
+            try {
+                delay(2.milliseconds)
+            } catch (e: CancellationException) {
+                cancelledSlowRacer = true
+                throw e
+            }
+            "Nope"
+        }, {
+            delay(1.milliseconds)
+            expectedResult
+        }) shouldBe expectedResult
+        cancelledSlowRacer.shouldBeTrue()
+    }
+}
```

---

### Incident Patch 4: `ea3146b1` (2023-02-28)
**Commit Message**: Launch racers immediately (undispatched) in race

**File**: `modules/coroutines/src/commonMain/kotlin/splitties/coroutines/Racing.kt` (modified, +1/-0)
```diff
@@ -100,6 +100,7 @@ suspend fun <T> race(
                 if (raceWon) return // A racer already completed.
                 async(
                     context = builderJob,
+                    start = Undispatched,
                     block = block
                 ).onAwait { resultOfWinner: T ->
                     raceWon = true
```

---

### Incident Patch 5: `9b56df70` (2023-02-28)
**Commit Message**: Protect race from potential rare race condition

This commit simplifies the implementation of race,
all while making it immune to race conditions.

Such a thing could potentially happen if a racer was
launched after one won, on a separate thread,
before the `raceWon` boolean change was visible to that thread.
Consequence would be needlessly delaying the race end after
that last racer, despite the race having already been won.

Extremely unlikely, and probably never happened in the wild,
but now, it's impossible.

**File**: `modules/coroutines/src/commonMain/kotlin/splitties/coroutines/Racing.kt` (modified, +4/-16)
```diff
@@ -87,7 +87,6 @@ suspend fun <T> race(
     @BuilderInference
     builder: suspend RacingScope<T>.() -> Unit
 ): T = coroutineScope {
-    val racersAsyncList = mutableListOf<Deferred<T>>()
     @Suppress("RemoveExplicitTypeArguments")
     select<T> {
         val builderJob = Job(parent = coroutineContext[Job])
@@ -99,27 +98,16 @@ suspend fun <T> race(
             @Suppress("OverridingDeprecatedMember", "OVERRIDE_DEPRECATION")
             override fun launchRacerInternal(block: suspend CoroutineScope.() -> T) {
                 if (raceWon) return // A racer already completed.
-                async(block = block).also { racerAsync ->
-                    racersAsyncList += racerAsync
-                    if (raceWon) { // A racer just completed on another thread, cancel.
-                        racerAsync.cancel()
-                    }
-                }.onAwait { resultOfWinner: T ->
+                async(
+                    context = builderJob,
+                    block = block
+                ).onAwait { resultOfWinner: T ->
                     raceWon = true
                     builderJob.cancel()
-                    var i = 0
-                    // Since launchRacerInternal might be called on multiple threads concurrently,
-                    //  we don't use a forEach loop, but a while loop that is additions tolerant.
-                    while (i <= racersAsyncList.lastIndex) {
-                        val deferred: Deferred<T> = racersAsyncList[i]
-                        deferred.cancel()
-                        i++
-                    }
                     return@onAwait resultOfWinner
                 }
             }
         }
-        @OptIn(ExperimentalCoroutinesApi::class)
         launch(builderJob, start = Undispatched) {
             racingScope.builder()
         }
```

---

### Incident Patch 6: `60de1e41` (2023-02-28)
**Commit Message**: Simplify raceOf implementation

**File**: `modules/coroutines/build.gradle.kts` (modified, +0/-1)
```diff
@@ -22,7 +22,6 @@ kotlin {
     sourceSets {
         commonMain.dependencies {
             api(splitties("experimental"))
-            implementation(splitties("collections"))
             api(KotlinX.coroutines.core)
         }
         all {
```

**File**: `modules/coroutines/src/commonMain/kotlin/splitties/coroutines/Racing.kt` (modified, +9/-15)
```diff
@@ -6,15 +6,8 @@
 
 package splitties.coroutines
 
-import kotlinx.coroutines.CoroutineScope
-import kotlinx.coroutines.Deferred
-import kotlinx.coroutines.ExperimentalCoroutinesApi
-import kotlinx.coroutines.Job
-import kotlinx.coroutines.async
-import kotlinx.coroutines.coroutineScope
-import kotlinx.coroutines.launch
+import kotlinx.coroutines.*
 import kotlinx.coroutines.selects.select
-import splitties.collections.forEachByIndex
 import splitties.experimental.ExperimentalSplittiesApi
 import kotlin.experimental.ExperimentalTypeInference
 import kotlinx.coroutines.CoroutineStart.UNDISPATCHED as Undispatched
@@ -37,15 +30,16 @@ suspend fun <T> raceOf(): T = throw UnsupportedOperationException("A race needs
 suspend fun <T> raceOf(vararg racers: suspend CoroutineScope.() -> T): T {
     require(racers.isNotEmpty()) { "A race needs racers." }
     return coroutineScope {
+        val racersParent = Job(parent = coroutineContext[Job])
         @Suppress("RemoveExplicitTypeArguments")
         select<T> {
-            @OptIn(ExperimentalCoroutinesApi::class)
-            val racersAsyncList = racers.map {
-                async(start = Undispatched, block = it)
-            }
-            racersAsyncList.forEachByIndex { racer: Deferred<T> ->
-                racer.onAwait { resultOfWinner: T ->
-                    racersAsyncList.forEachByIndex { deferred: Deferred<T> -> deferred.cancel() }
+            racers.forEach { racer ->
+                async(
+                    context = racersParent,
+                    start = Undispatched,
+                    block = racer
+                ).onAwait { resultOfWinner: T ->
+                    racersParent.cancel()
                     return@onAwait resultOfWinner
                 }
             }
```

---

### Incident Patch 7: `a480d0e7` (2022-09-21)
**Commit Message**: Use refreshVersions built-in dependency notation for AGP

**File**: `build.gradle.kts` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ buildscript {
     repositories { setupForProject() }
     dependencies {
         classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:_")
-        classpath("com.android.tools.build:gradle:_")
+        classpath(Android.tools.build.gradlePlugin)
     }
 }
 
```

---

### Incident Patch 8: `320d9b7d` (2022-09-21)
**Commit Message**: Remove no longer needed workaround that used old Kotlin backend

**File**: `modules/views-dsl/build.gradle.kts` (modified, +0/-5)
```diff
@@ -34,8 +34,3 @@ kotlin {
         }
     }
 }
-
-tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
-    kotlinOptions.useOldBackend = true //TODO: Remove when https://youtrack.jetbrains.com/issue/KT-44972 is addressed.
-    // See this comment on why it's needed: https://youtrack.jetbrains.com/issue/KT-44972#focus=Comments-27-5014161.0-0
-}
```

---

### Incident Patch 9: `7c1a5054` (2022-09-21)
**Commit Message**: Remove no longer needed opt-in to use `@RequiresOptIn`

**File**: `build.gradle.kts` (modified, +0/-1)
```diff
@@ -50,7 +50,6 @@ allprojects {
         }
     }
     tasks.withType<KotlinJvmCompile>().configureEach {
-        kotlinOptions.freeCompilerArgs += "-Xopt-in=kotlin.RequiresOptIn"
         kotlinOptions.jvmTarget = "1.8"
     }
 
```

**File**: `modules/arch-lifecycle/build.gradle.kts` (modified, +0/-5)
```diff
@@ -29,10 +29,5 @@ kotlin {
             api(AndroidX.lifecycle.viewModelKtx)
             api(AndroidX.lifecycle.liveDataKtx)
         }
-        all {
-            languageSettings.apply {
-                optIn("kotlin.RequiresOptIn")
-            }
-        }
     }
 }
```

**File**: `modules/coroutines/build.gradle.kts` (modified, +0/-1)
```diff
@@ -27,7 +27,6 @@ kotlin {
         }
         all {
             languageSettings.apply {
-                optIn("kotlin.RequiresOptIn")
                 optIn("splitties.experimental.ExperimentalSplittiesApi")
             }
         }
```

**File**: `modules/experimental/build.gradle.kts` (modified, +0/-7)
```diff
@@ -19,11 +19,4 @@ kotlin {
     linux(x64 = true)
 
     configure(targets) { configureMavenPublication() }
-    sourceSets {
-        all {
-            languageSettings.apply {
-                optIn("kotlin.RequiresOptIn")
-            }
-        }
-    }
 }
```

**File**: `modules/fragments/build.gradle.kts` (modified, +0/-5)
```diff
@@ -25,10 +25,5 @@ kotlin {
             api(AndroidX.fragment.ktx)
             api(splitties("lifecycle-coroutines"))
         }
-        all {
-            languageSettings.apply {
-                optIn("kotlin.RequiresOptIn")
-            }
-        }
     }
 }
```

**File**: `modules/lifecycle-coroutines/build.gradle.kts` (modified, +0/-5)
```diff
@@ -33,10 +33,5 @@ kotlin {
             implementation(KotlinX.coroutines.test)
             implementation(Kotlin.test.junit)
         }
-        all {
-            languageSettings.apply {
-                optIn("kotlin.RequiresOptIn")
-            }
-        }
     }
 }
```

**File**: `modules/permissions/build.gradle.kts` (modified, +0/-5)
```diff
@@ -25,10 +25,5 @@ kotlin {
             implementation(splitties("intents"))
             implementation(AndroidX.core.ktx)
         }
-        all {
-            languageSettings.apply {
-                optIn("kotlin.RequiresOptIn")
-            }
-        }
     }
 }
```

**File**: `modules/preferences/build.gradle.kts` (modified, +0/-3)
```diff
@@ -47,9 +47,6 @@ kotlin {
             }
         }
     }
-    sourceSets {
-        all { languageSettings.apply { optIn("kotlin.RequiresOptIn") } }
-    }
 }
 
 dependencies {
```

#### Recent Merged Pull Requests:
- **PR #294** (2021-08-24): Fix documentation typos (@MrTheGood)
- **PR #292** (2021-08-20): Prepare for release 3.0.0 (@LouisCAD)
- **PR #291** (2021-08-16): Add DataStorePreferences (@LouisCAD)
- **PR #289** (2021-08-08): Use refreshVersions dependency notations and minor doc improvements (@LouisCAD)
- **PR #288** (2021-08-06): Prepare for release 3.0.0-rc03 (@LouisCAD)
- **PR #287** (2021-08-03): Prepare for release 3.0.0-rc02 (@LouisCAD)
- **PR #286** (2021-08-03): Fix inline styled resources (@LouisCAD)
- **PR #284** (2021-08-01): Prepare for release 3.0.0-rc01 (@LouisCAD)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
