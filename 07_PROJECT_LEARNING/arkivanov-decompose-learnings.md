# Forensic Learning Record (Deep Inspection): arkivanov/Decompose

> **Canonical Artifact**: `07_PROJECT_LEARNING/arkivanov-decompose-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/arkivanov/Decompose](https://github.com/arkivanov/Decompose))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:20:15.965Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `arkivanov/Decompose`
- **Description**: Kotlin Multiplatform lifecycle-aware business logic components (aka BLoCs) with routing (navigation) and pluggable UI (Jetpack Compose, SwiftUI, JS React, etc.)
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2878 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `decompose/src/androidMain/kotlin/com/arkivanov/decompose/DeeplinkUtils.kt`
```
package com.arkivanov.decompose

import android.app.Activity
import android.app.TaskStackBuilder
import android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK
import android.content.Intent.FLAG_ACTIVITY_NEW_TASK
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.StrictMode
import android.os.StrictMode.VmPolicy
import androidx.core.os.bundleOf
import androidx.savedstate.SavedStateRegistryOwner

/**
 * Extracts a deep link URL from this [Activity.intent], calls [block]
 * function with the extracted deep link [Uri] (if any) and returns the result.
 *
 * Also restarts this `Activity` with [FLAG_ACTIVITY_CLEAR_TASK] if there is
 * a deep link and the [Activity.intent] has the [FLAG_ACTIVITY_NEW_TASK] flag set
 * and the [FLAG_ACTIVITY_CLEAR_TASK] flag is not set.
 * Returns `null` if this `Activity` restart has been initiated.
 *
 * This function must be called from [Activity.onCreate] method.
 *
 * It is [strongly recommended](https://developer.android.com/guide/navigation/design/deep-link#handle)
 * to always use the `standard` (default)
 * [launchMode](https://developer.android.com/guide/components/activities/tasks-and-back-stack#TaskLaunchModes)
 * for the [Activity] when handling deep links.
 *
 * Example of creating a root component with deep link support.
 *
 * ```kotlin
 * class MainActivity : AppCompatActivity() {
 *     override fun onCreate(savedInstanceState: Bundle?) {
 *         super.onCreate(savedInstanceState)
 *
 *         val root =
 *             handleDeepLink { uri ->
 *                 val itemId = uri?.extractItemId() // Parse the deep link
 *                 DefaultRootComponent(
 *                     componentContext = defaultComponentContext(discardSavedState = itemId != null),
 *                     itemId = itemId,
 *                 )
 *             } ?: return // Return if the Activity restart has been initiated
 *
 *         // Display the root component as usual
 *     }
 *
 *     private fun Uri.extractItemId(): String? =
 *         TODO("Extract item id from the deep link")
 * }
 * ```
 */
@ExperimentalDecomposeApi
fun <A, T : Any> A.handleDeepLink(
    block: (Uri?) -> T,
): T? where A : Activity, A : SavedStateRegistryOwner =
    handleDeepLink(
        deepLink = intent.data,
        block = block,
    )

/**
 * Calls the provided [block] function with the given [deepLink] if this is the first launch of
 * this [Activity] (e.g. not a configuration change or restoration after process death),
 * and returns the result.
 *
 * Also restarts this `Activity` with [FLAG_ACTIVITY_CLEAR_TASK] if the provided [deepLink]
 * is not `null` and [shouldRestartInNewTask] predicate returned `true`. By default,
 * [shouldRestartInNewTask] returns `true` if the [Activity.intent] has the
 * [FLAG_ACTIVITY_NEW_TASK] flag set and the [FLAG_ACTIVITY_CLEAR_TASK] flag is not set.
 * Returns `null` if this `Activity` restart has been initiated.
 *
 * This function must be called from [Activity.onCreate] method.
 *
 * It is [strongly recommended](https://developer.android.com/guide/navigation/design/deep-link#handle)
 * to always use the `standard` (default)
 * [launchMode](https://developer.android.com/guide/components/activities/tasks-and-back-stack#TaskLaunchModes)
 * for the [Activity] when handling deep links.
 *
 * Example of creating a root component with deep link support.
 *
 * ```kotlin
 * class MainActivity : AppCompatActivity() {
 *     override fun onCreate(savedInstanceState: Bundle?) {
 *         super.onCreate(savedInstanceState)
 *
 *         val root =
 *             handleDeepLink(deepLink = { intent.data?.extractItemId() }) { itemId ->
 *                 DefaultRootComponent(
 *                     componentContext = defaultComponentContext(discardSavedState = itemId != null),
 *                     itemId = itemId,
 *                 )
 *             } ?: return // Return if the Activity restart has been initiated
 *
 *         // Display the root component as usual
 *     }
 *
 *     private fun Uri.extractItemId(): String? =
 *         TODO("Extract item id from the deep link")
 * }
 * ```
 */
@ExperimentalDecomposeApi
fun <A, D : Any, T : Any> A.handleDeepLink(
    deepLink: D?,
    shouldRestartInNewTask: (D) -> Boolean = { HandleDeepLinkDefaults.shouldRestartInNewTask(this) },
    block: (D?) -> T,
): T? where A : Activity, A : SavedStateRegistryOwner {
    if ((deepLink != null) && shouldRestartInNewTask(deepLink)) {
        restart()
        return null
    }

    val savedState: Bundle? = savedStateRegistry.consumeRestoredStateForKey(key = KEY_SAVED_DEEP_LINK_STATE)
    val isDeepLinkHandled = savedState?.getBoolean(KEY_DEEP_LINK_HANDLED) ?: false

    savedStateRegistry.registerSavedStateProvider(key = KEY_SAVED_DEEP_LINK_STATE) {
        bundleOf(KEY_DEEP_LINK_HANDLED to (isDeepLinkHandled || (deepLink != null)))
    }

    return block(deepLink?.takeUnless { isDeepLinkHandled })
}

@ExperimentalDecomposeApi
object HandleDeepLinkDefaults {

    /**
     * Checks if the provided [activity] should be restarted for deep link handling.
     *
     * @return `true` if the [Activity.intent] has the [FLAG_ACTIVITY_NEW_TASK] flag set and
     * the [FLAG_ACTIVITY_CLEAR_TASK] flag is not set, `false` otherwise.
     */
    fun shouldRestartInNewTask(activity: Activity): Boolean =
        (activity.intent.flags and FLAG_ACTIVITY_NEW_TASK != 0) &&
            (activity.intent.flags and FLAG_ACTIVITY_CLEAR_TASK == 0)
}

// Derived from https://cs.android.com/androidx/platform/frameworks/support/+/androidx-main:navigation/navigation-runtime/src/main/java/androidx/navigation/NavController.kt;l=1486;drc=fd7d0dc4a56c2aef65424db7986aa057f9717661
private fun Activity.restart() {
    // Someone called us with NEW_TASK, but we don't know what state our whole
    // task stack is in, so we need to manually restart the whole stack to
    // ensure we're in a predictably good state.

    intent.addFlags(FLAG_ACTIVITY_CLEAR_TASK)

    withPermittedUnsafeIntentLaunch {
        TaskStackBuilder.create(this).addNextIntentWithParentStack(intent).startActivities()
    }

    finish()

    // Disable second animation in case where the Activity is created twice.
    @Suppress("DEPRECATION")
    overridePendingTransition(0, 0)
}

private inline fun withPermittedUnsafeIntentLaunch(block: () -> Unit) {
    val savedVmPolicy = StrictMode.getVmPolicy()
    StrictMode.setVmPolicy(savedVmPolicy.withPermittedUnsafeIntentLaunch())

    try {
        block()
    } finally {
        StrictMode.setVmPolicy(savedVmPolicy)
    }
}

private fun VmPolicy.withPermittedUnsafeIntentLaunch(): VmPolicy =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        VmPolicy.Builder(this).permitUnsafeIntentLaunch().build()
    } else {
        this
    }

private const val KEY_SAVED_DEEP_LINK_STATE = "SAVED_DEEP_LINK_STATE"
private const val KEY_DEEP_LINK_HANDLED = "DEEP_LINK_HANDLED"


```

### Core Architecture Module: `decompose/src/commonMain/kotlin/com/arkivanov/decompose/Utils.kt`
```
package com.arkivanov.decompose

import com.arkivanov.essenty.lifecycle.Lifecycle
import kotlin.reflect.KClass

@InternalDecomposeApi
fun Any.hashString(): String =
    "${this::class.uniqueName ?: this::class.simpleName}_${hashCode().toString(radix = 36)}"

@InternalDecomposeApi
fun Child<*, *>.keyHashString(): String =
    "${configuration::class.uniqueName ?: configuration::class.simpleName}_${key.hashCode().toString(radix = 36)}"

internal expect val KClass<*>.uniqueName: String?

internal val Lifecycle.isDestroyed: Boolean get() = state == Lifecycle.State.DESTROYED

internal fun <T : Any, C : Any> List<T>.keyed(configuration: (T) -> C): Map<ItemKey, T> {
    val indices = HashMap<C, Int>()

    return associateBy { item ->
        val config = configuration(item)
        val index = indices[config]?.plus(1) ?: 0
        indices[config] = index
        ItemKey(config, index)
    }
}

internal data class ItemKey(
    private val value: Any,
    private val index: Int,
)

internal fun <T : Any> Iterable<T>.findFirstDuplicate(set: Set<T>): Pair<Int, T>? {
    val iter1 = iterator()
    val iter2 = set.iterator()
    var index = 0

    while (iter1.hasNext()) {
        val item = iter1.next()
        if (!iter2.hasNext() || (iter2.next() != item)) {
            return index to item
        }
        index++
    }

    return null
}

```

### Core Architecture Module: `decompose/src/commonMain/kotlin/com/arkivanov/decompose/lifecycle/MergedLifecycle.kt`
```
package com.arkivanov.decompose.lifecycle

import com.arkivanov.decompose.InternalDecomposeApi
import com.arkivanov.essenty.lifecycle.Lifecycle
import com.arkivanov.essenty.lifecycle.Lifecycle.State
import com.arkivanov.essenty.lifecycle.LifecycleRegistry
import com.arkivanov.essenty.lifecycle.create
import com.arkivanov.essenty.lifecycle.destroy
import com.arkivanov.essenty.lifecycle.doOnDestroy
import com.arkivanov.essenty.lifecycle.pause
import com.arkivanov.essenty.lifecycle.resume
import com.arkivanov.essenty.lifecycle.start
import com.arkivanov.essenty.lifecycle.stop

@InternalDecomposeApi
class MergedLifecycle private constructor(
    private val registry: LifecycleRegistry,
    lifecycle1: Lifecycle,
    lifecycle2: Lifecycle
) : Lifecycle by registry {

    constructor(lifecycle1: Lifecycle, lifecycle2: Lifecycle) : this(LifecycleRegistry(), lifecycle1, lifecycle2)

    init {
        var state1 = if (lifecycle1.state == State.DESTROYED) State.DESTROYED else State.INITIALIZED
        var state2 = if (lifecycle2.state == State.DESTROYED) State.DESTROYED else State.INITIALIZED

        moveTo(minOf(state1, state2))

        if ((state1 != State.DESTROYED) && (state2 != State.DESTROYED)) {
            val observer1 =
                CallbacksImpl { state ->
                    state1 = state
                    moveTo(minOf(state, state2))
                }

            val observer2 =
                CallbacksImpl { state ->
                    state2 = state
                    moveTo(minOf(state, state1))
                }

            lifecycle1.subscribe(observer1)
            lifecycle2.subscribe(observer2)

            registry.doOnDestroy {
                lifecycle1.unsubscribe(observer1)
                lifecycle2.unsubscribe(observer2)
            }
        }
    }

    private fun moveTo(state: State) {
        when (state) {
            State.DESTROYED -> moveToDestroyed()
            State.INITIALIZED -> Unit
            State.CREATED -> moveToCreated()
            State.STARTED -> moveToStarted()
            State.RESUMED -> moveToResumed()
        }
    }

    private fun moveToDestroyed() {
        when (registry.state) {
            State.DESTROYED -> Unit

            State.INITIALIZED -> {
                registry.create()
                registry.destroy()
            }

            State.CREATED,
            State.STARTED,
            State.RESUMED -> registry.destroy()
        }
    }

    private fun moveToCreated() {
        when (registry.state) {
            State.DESTROYED -> Unit
            State.INITIALIZED -> registry.create()

            State.CREATED -> Unit

            State.STARTED,
            State.RESUMED -> registry.stop()
        }
    }

    private fun moveToStarted() {
        when (registry.state) {
            State.INITIALIZED,
            State.CREATED -> registry.start()

            State.RESUMED -> registry.pause()

            State.DESTROYED,
            State.STARTED -> Unit
        }
    }

    private fun moveToResumed() {
        when (registry.state) {
            State.INITIALIZED,
            State.CREATED,
            State.STARTED -> registry.resume()

            State.RESUMED,
            State.DESTROYED -> Unit
        }
    }

    private class CallbacksImpl(
        private val onStateChanged: (State) -> Unit,
    ) : Lifecycle.Callbacks {
        override fun onCreate() {
            onStateChanged(State.CREATED)
        }

        override fun onStart() {
            onStateChanged(State.STARTED)
        }

        override fun onResume() {
            onStateChanged(State.RESUMED)
        }

        override fun onPause() {
            onStateChanged(State.STARTED)
        }

        override fun onStop() {
            onStateChanged(State.CREATED)
        }

        override fun onDestroy() {
            onStateChanged(State.DESTROYED)
        }
    }
}


```

### Core Architecture Module: `decompose/src/commonMain/kotlin/com/arkivanov/decompose/router/children/ChildNavState.kt`
```
package com.arkivanov.decompose.router.children

/**
 * Represents a child navigation state.
 */
interface ChildNavState<out C : Any> {

    /**
     * A configuration of the child. Must be unique within the [NavState].
     */
    val configuration: C

    /**
     * Required lifecycle status of the child.
     */
    val status: Status

    /**
     * Enumerates all possible child lifecycle statuses.
     */
    enum class Status {
        /**
         * The child component is destroyed but still managed, e.g. it's state may be saved and restored later.
         * The state of the component is saved when it switches from any status to `DESTROYED`.
         */
        DESTROYED,

        /**
         * The child component is instantiated and its maximum lifecycle state is `CREATED`,
         * depending on the parent's lifecycle state. A `CREATED` component cannot handle back button presses.
         */
        CREATED,

        /**
         * The child component is instantiated and its maximum lifecycle state is `STARTED`,
         * depending on the parent's lifecycle state. A `STARTED` component can handle back button presses.
         */
        STARTED,

        /**
         * The child component is instantiated and its maximum lifecycle state is `RESUMED`,
         * depending on the parent's lifecycle state. A `RESUMED` component can handle back button presses.
         */
        RESUMED,
    }
}

```

### Core Architecture Module: `decompose/src/commonMain/kotlin/com/arkivanov/decompose/router/children/NavState.kt`
```
package com.arkivanov.decompose.router.children

/**
 * Represents an entire navigation state.
 */
interface NavState<out C : Any> {

    /**
     * A list of child navigation states. Every [ChildNavState.configuration] must be unique by equality.
     */
    val children: List<ChildNavState<C>>
}

```

### Core Architecture Module: `decompose/src/commonMain/kotlin/com/arkivanov/decompose/router/children/NavStateSaver.kt`
```
package com.arkivanov.decompose.router.children

import com.arkivanov.decompose.ExperimentalDecomposeApi
import com.arkivanov.essenty.statekeeper.SerializableContainer
import kotlinx.serialization.KSerializer


/**
 * A contract for saving and restoring navigation states.
 */
@ExperimentalDecomposeApi
interface NavStateSaver<T> {

    /**
     * Saves the provided navigation state into [SerializableContainer].
     *
     * @param state the navigation state to be saved
     * @return a serializable container that holds the saved state, or `null` if the state should not be saved.
     */
    fun saveState(state: T): SerializableContainer?

    /**
     * Restores the previously saved navigation state from the provided [SerializableContainer].
     *
     * @param container the serializable container holding the previously saved state.
     * @return the restored navigation state, or `null` if the state could not be restored.
     */
    fun restoreState(container: SerializableContainer): T?
}

/**
 * A convenience function for creating an instance of [NavStateSaver][com.arkivanov.decompose.router.children.NavStateSaver]
 * with the provided [save] and [restore] functions.
 */
@ExperimentalDecomposeApi
inline fun <T> NavStateSaver(
    crossinline save: (T) -> SerializableContainer?,
    crossinline restore: (SerializableContainer) -> T?,
): NavStateSaver<T> =
    object : NavStateSaver<T> {
        override fun saveState(state: T): SerializableContainer? = save(state)
        override fun restoreState(container: SerializableContainer): T? = restore(container)
    }

/**
 * A convenience function for creating an instance of [NavStateSaver][com.arkivanov.decompose.router.children.NavStateSaver]
 * that saves and restores the navigation state using the provided [serializer].
 */
@ExperimentalDecomposeApi
fun <T> NavStateSaver(serializer: KSerializer<T & Any>): NavStateSaver<T> =
    NavStateSaver(
        save = {
            SerializableContainer(value = it, strategy = serializer)
        },
        restore = {
            it.consume(strategy = serializer)
        },
    )

```

### Core Architecture Module: `decompose/src/commonMain/kotlin/com/arkivanov/decompose/router/children/SimpleChildNavState.kt`
```
package com.arkivanov.decompose.router.children

/**
 * A simple implementation of the [ChildNavState] interface.
 */
data class SimpleChildNavState<out C : Any>(
    override val configuration: C,
    override val status: ChildNavState.Status,
) : ChildNavState<C>

```

### Core Architecture Module: `decompose/src/commonMain/kotlin/com/arkivanov/decompose/router/children/TransientNavStateSaver.kt`
```
package com.arkivanov.decompose.router.children

import com.arkivanov.decompose.ExperimentalDecomposeApi
import com.arkivanov.essenty.statekeeper.SerializableContainer
import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient

/**
 * Creates an instance of [NavStateSaver] that does not serialize the navigation state.
 * The navigation state is preserved over configuration changes on Android
 * but is lost when the application process is recreated.
 *
 * Can be used for large navigation states like lists to avoid exceeding the Bundle size limit
 * when saving the state.
 */
@ExperimentalDecomposeApi
fun <T : Any> transientNavStateSaver(): NavStateSaver<T> =
    NavStateSaver(
        save = { SerializableContainer(value = TransientSavedState(it), strategy = TransientSavedState.serializer()) },
        restore = {
            @Suppress("UNCHECKED_CAST")
            it.consume(TransientSavedState.serializer())?.value as T?
        },
    )

@Serializable
private class TransientSavedState(
    @Transient val value: Any? = null,
)

```

### Core Architecture Module: `decompose/src/commonMain/kotlin/com/arkivanov/decompose/statekeeper/ChildStateKeeper.kt`
```
package com.arkivanov.decompose.statekeeper

import com.arkivanov.decompose.isDestroyed
import com.arkivanov.essenty.lifecycle.Lifecycle
import com.arkivanov.essenty.lifecycle.doOnDestroy
import com.arkivanov.essenty.statekeeper.SerializableContainer
import com.arkivanov.essenty.statekeeper.StateKeeper
import com.arkivanov.essenty.statekeeper.StateKeeperDispatcher

internal fun StateKeeper.child(key: String, lifecycle: Lifecycle? = null): StateKeeper {
    check(!isRegistered(key = key)) { "The key \"$key\" is already in use." }

    val stateKeeper = StateKeeperDispatcher(consume(key = key, strategy = SerializableContainer.serializer()))

    if (lifecycle == null) {
        register(key = key, strategy = SerializableContainer.serializer(), supplier = stateKeeper::save)
    } else if (!lifecycle.isDestroyed) {
        register(key = key, strategy = SerializableContainer.serializer(), supplier = stateKeeper::save)
        lifecycle.doOnDestroy { unregister(key) }
    }

    return stateKeeper
}

```

### Core Architecture Module: `decompose/src/jsMain/kotlin/com/arkivanov/decompose/Utils.kt`
```
package com.arkivanov.decompose

import kotlin.reflect.KClass

internal actual val KClass<*>.uniqueName: String?
    get() = js.name

```

### Core Architecture Module: `decompose/src/nonWebMain/kotlin/com/arkivanov/decompose/Utils.nonJs.kt`
```
package com.arkivanov.decompose

import kotlin.reflect.KClass

internal actual val KClass<*>.uniqueName: String?
    get() = qualifiedName

```

### Core Architecture Module: `decompose/src/wasmJsMain/kotlin/com/arkivanov/decompose/Utils.kt`
```
package com.arkivanov.decompose

import kotlin.reflect.KClass

internal actual val KClass<*>.uniqueName: String?
    get() = qualifiedName

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1012** (2026-09-26): **Rare crash "Cannot round NaN value" in SeekableTransitionState when predictive back gesture finishes**
  *Symptoms*: We're seeing a rare production crash (4 events / 3 users over ~2 months, so far only Huawei/Honor devices: PTP-N49, PTP-AN00, BRP-NX3) when a predictive back gesture completes on a `ChildStack` using the experimental `stackAnimation` with a custom `PredictiveBackAnimatable`:  ``` java.lang.IllegalArgumentException: Cannot round NaN value.     at kotlin.math.MathKt__MathJVMKt.roundToLong(MathJVM.kt:741)     at androidx.compose.animation.core.SeekableTransitionState.seekToFraction(Transition.kt:733)     at androidx.compose.animation.core.SeekableTransitionState.animateOneFrameLambda$lambda$0(Transition.kt:325)     at androidx.compose.runtime.BroadcastFrameClock$FrameAwaiter.resume(BroadcastFrameClock.kt:56)     at androidx.compose.runtime.BroadcastFrameClock.sendFrame$lambda$0(BroadcastFrameClock.java:71)     at androidx.compose.runtime.AwaiterQueue.flushAndDispatchAwaiters(AwaiterQueue.kt:89)     at androidx.compose.runtime.BroadcastFrameClock.sendFrame(BroadcastFrameClock.java:71)     at androidx.compose.runtime.Recomposer$runRecomposeAndApplyChanges$2$2.invokeSuspend$lambda$2(Recomposer.kt:633)     ... ```  ## Versions  - Decompose: 3.5.0 (`extensions-compose-experimental`) - Compose BOM 2026.06.01 (animation-core 1.11.4) - Setup: `stackAnimation(predictiveBackParams = { PredictiveBackParams(backHandler, onBack, animatable = { materialPredictiveBackAnimatable(it) /* custom fork */ }) })`  ## Analysis  It looks like a Compose bug, I've reported it [here](https://issuetracker.
  **Post-Mortem & Fix Analysis**:
  > Thank you. I will take a look.
  > > Decompose could avoid triggering it  @PhilipDukhov could you please elaborate? How can Decompose help avoid the crash? Can you point to line of code?
  > @arkivanov-bot please investigate this issue, try to reproduce and fix the crash.

- **Issue #986** (2026-03-03): **Crash when calculate keyHashString**
  *Symptoms*: We have a single crash in function Utils. keyHashString() There is stacktrace:  ``` Fatal Exception: java.lang.ArrayIndexOutOfBoundsException length=36; index=16777238  java.lang.Integer.toString (Integer.java:177) com.arkivanov.decompose.UtilsKt.keyHashString (Utils.kt:12) com.arkivanov.decompose.extensions.compose.stack.ChildrenKt.getKeys (Children.kt:57) com.arkivanov.decompose.extensions.compose.stack.ChildrenKt.Children (Children.kt:27) com.arkivanov.decompose.extensions.compose.stack.ChildrenKt.Children$lambda$0 (Children.kt:13) androidx.compose.runtime.RecomposeScopeImpl.compose (RecomposeScopeImpl.kt:201) androidx.compose.runtime.ComposerImpl.recomposeToGroupEnd (ComposerImpl.kt:1690) androidx.compose.runtime.ComposerImpl.skipCurrentGroup (ComposerImpl.kt:2026) androidx.compose.runtime.ComposerImpl.doCompose-aFTiNEg (ComposerImpl.kt:2659) androidx.compose.runtime.ComposerImpl.recompose-aFTiNEg$runtime (ComposerImpl.kt:2583) androidx.compose.runtime.CompositionImpl.recompose (Composition.kt:1080) androidx.compose.runtime.Recomposer.performRecompose (Recomposer.kt:1406) androidx.compose.runtime.Recomposer.access$setWorkContinuation$p (Recomposer.kt:159) androidx.compose.runtime.Recomposer.access$performRecompose (Recomposer.kt:159) androidx.compose.runtime.Recomposer$runRecomposeAndApplyChanges$2.invokeSuspend$lambda$2 (Recomposer.kt:638) androidx.compose.ui.platform.AndroidUiFrameClock$withFrameNanos$2$callback$1.doFrame (AndroidUiFrameClock.android.kt:39) androidx.com
  **Post-Mortem & Fix Analysis**:
  > @maxmaxandr Thanks for the report. What version of Decompose are you using?
  > > [@maxmaxandr](https://github.com/maxmaxandr) Thanks for the report. What version of Decompose are you using?  3.3.0
  > Thank you! This looks like a bug in a certain version of JVM/Android. I think the crash shouldn't be reproducible starting with Decompose version `3.4.0`.

- **Issue #982** (2026-02-01): **webHistory: URL is not updated when Details initialStack contains more than one element**
  *Symptoms*: Hi! I’ve encountered an issue with webHistory when using a Details stack with more than one element in initialStack.  This seems to affect URL synchronization and browser back navigation.  Setup Decompose: 3.4.0 Layout structure: 	•	Main: Apps 	•	Details: ReleaseList, Release  The Details panel is initialized with two elements in the initialStack (ReleaseList, Release). This setup is required for correct gesture navigation in a PWA.  Problem 1: URL is not updated  When navigating directly to Release via a link: 	•	In Dual mode, selecting another item in Main triggers correct internal navigation 	•	However, the browser URL does not change  Problem 2: Browser back navigation does not work as expected  As I understand it, the logic with setOnPopStateListener exists to support browser back navigation. However, in this scenario, pressing the browser back button: 	•	Does not navigate back within the app stack 	•	Instead, navigates back to the previous site  So in this case, browser back navigation does not work as an in-app “pop”, even though the stack contains multiple elements.  Reproduction  Reproduction repository: https://github.com/QuilliuQ/DecomposeReproduce  Problem 1 reproduction steps: 1. Open new tab 2. Open app on certain release. Example "http://localhost:8080/apps/App_0/release/1_Release" 3. Select another app, on main panel.  Result: The navigation state updates correctly, but the URL remains unchanged.  Problem 2 reproduction steps: 1. Open new tab 2. Open app on ce
  **Post-Mortem & Fix Analysis**:
  > Thank you providing a reproducer. The bug (Problem 1) will be fixed in the next release.  As of Problem 2, this works as expected. Modern browsers don't allow changing the browser history immediately after opening a page. E.g. if the user clicks a link on a third-party website and goes to your website, the browser back button should navigate the user back to the previous third-party page.
  > Literaly just came to create a bug report for this, but guess already known issue, is there a way to reliably add to the stack after page navigation (as there sure as hell are annoying websites that stop you from going back with infinite history)        Environment      - Decompose: 3.5.0-beta01     - Platform: Kotlin/WASM (Compose Multiplatform)      Description      When a component is created with a multi-item initialStack (e.g. [ManageMenu, BillingScreen]), withWebHistory stores the entire     stack as a single replaceState entry. This means the browser history has only one entry, so pressing back exits the tab entirely     instead of navigating within the Decompose stack.      By contrast, when the user navigates the same path via in-app clicks, each navigation.push() call correctly triggers a pushState,     creating individual history entries — and back works as expected.      Steps to Reproduce      1. Create a component using childStackWebNavigation with initialStack = { listOf
  > Well I'm not aware of any way of faking the history right after initialization. It just doesn't work, but I think it works after some delay. And I remember this was explicitly documented somewhere. If you know, then please let me know.

- **Issue #929** (2025-09-09): **ChildPages discards any selected index change performed while the composable was not in composition**
  *Symptoms*: This probably happens because `rememberPagerState` restores its previous selected index when it enters the composition again.

- **Issue #913** (2025-08-12): **ChildSlot doesn't preserve the navigation state when there is no active child**
  *Symptoms*: When there is no active child in ChildSlot, the navigation state is not preserved and `initialCongfiguration` function is called again after configuration change.

- **Issue #908** (2025-08-12): **ClassCastException on dismissing Slot on WasmJs**
  *Symptoms*: Admittedly this could be 100% wasm js bug, but Slots throw an ClassEx when dismissing:  ``` val inviteSlot by component.inviteDialogSlot.subscribeAsState()     inviteSlot.child?.let { inviteDialog ->         // Invite user modal         UserInviteModalContent(component = inviteDialog.instance)     } ```  When you dismiss this slot `scope.onMain { inviteDialogNavigation.dismiss() }`  You will get this error (and it breaks the subAsState(), needing to destroy the comp and restart it for it to open again)  ``` haynetApp.uninstantiated.mjs:1548 ClassCastException: Expected null (Nothing?), got an instance of UserInviteDialogConfig ```  Unfortunatly the wasm stack trace is useless so thats as much as I get. 
  **Post-Mortem & Fix Analysis**:
  > Dupe of #879 ?
  > Maybe, but tested 2.2.20 b2 which claims it's fixed. But still seeing the CCE. I left a comment on YT
  > Did you try updating Decompose to [3.4.0-alpha03](https://github.com/arkivanov/Decompose/releases/tag/3.4.0-alpha03)?

- **Issue #907** (2025-09-12): **WebHistory will add multiple entries**
  *Symptoms*: This only happens sometimes, but child we navigation owners will add multiple history targets, once it starts it gets worse over time, once you get back to the bottom of the stack and then re-navigate it will add more next time.  <img width="430" height="532" alt="Image" src="https://github.com/user-attachments/assets/52009cb7-d470-42e8-be86-ab754481e7bf" />  Decompose 3.3.0-alpha03 KT 2.2.10-RC Compose 1.8.2 WasmJs target on Brave (Chrome Engine)  Let me know if there are any logs/outputs i need to enable to give you, can't see anything in the console.  (I'm wondering if it recomposes and reattaches to the web history handler multiple times?)
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting! Would you be able to provide a reproducer code or project?
  > > Thanks for reporting! Would you be able to provide a reproducer code or project?  Unfornuatly not really, I could barely get this wasm target to work lol! If I can hone down the cause I will try and update
  > No problem. I will try to reproduce it on the sample app. Let me know if there are additional details or steps to reproduce.

- **Issue #879** (2025-06-02): **Kotlin/Wasm produce CCE for SlotNavigator.dismiss extension.**
  *Symptoms*: Function `com.arkivanov.decompose.router.slot.dismiss` seems written with an issue:  ```kotlin inline fun SlotNavigator<*>.dismiss(crossinline onComplete: (isSuccess: Boolean) -> Unit = {}) {     navigate(         transformer = { null },         onComplete = { _, oldConfiguration -> onComplete(oldConfiguration != null) },     ) } ```  The `*` generic type resolved to `Nothing?` in the `oldConfiguration` parameter. That means that only `null` can be a value. The `Kotlin/Wasm` compiler is more strict here and have to put check cast, so if any not-null value is present it throws the `CCE`. I suspect that the more correct way to write such code is something like this: ```kotlin inline fun <C : Any> SlotNavigator<C>.dismiss(crossinline onComplete: (isSuccess: Boolean) -> Unit = {}) {     navigate(         transformer = { null },         onComplete = { _, oldConfiguration -> onComplete(oldConfiguration != null) },     ) } ```
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting! The code looks valid and I think it's worth filing an issue on YouTrack. I will do it and provide the link here.
  > I tried to write a test for this, but it passes. Is there anything special I should do?  ```kotlin class FooTest {      @Test     fun testFoo() {         val nav = SlotNavigation<String>()         nav.dismiss()     } } ```  Running this test against `wasmJs` target works just fine.  The following test also passes:  ```kotlin     @Test     fun testFoo() {         val ctx = TestComponentContext()         val nav = SlotNavigation<Int>()          ctx.childSlot(             source = nav,             serializer = null,             initialConfiguration = { 1 },             childFactory = ::Component,         )          nav.dismiss()     } ```
  > ```kotlin enum class Destination {     X }  val nav = SlotNavigation<Destination>() nav.subscribe { e -> e.onComplete(Destination.X, null) } nav.dismiss() ```

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

### Incident Patch 1: `00840bcf` (2026-10-03)
**Commit Message**: Merge pull request #1031 from arkivanov/fix-AndroidPredictiveBackAnimatableV2-rtl

Fix wrong directions in AndroidPredictiveBackAnimatableV2 in RTL layout

**File**: `extensions-compose/src/commonMain/kotlin/com/arkivanov/decompose/extensions/compose/stack/animation/predictiveback/AndroidPredictiveBackAnimatableV2.kt` (modified, +30/-11)
```diff
@@ -1,7 +1,13 @@
 package com.arkivanov.decompose.extensions.compose.stack.animation.predictiveback
 
 import androidx.compose.animation.core.Animatable
-import androidx.compose.runtime.*
+import androidx.compose.runtime.Composable
+import androidx.compose.runtime.derivedStateOf
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableFloatStateOf
+import androidx.compose.runtime.mutableStateOf
+import androidx.compose.runtime.remember
+import androidx.compose.runtime.setValue
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.composed
 import androidx.compose.ui.draw.drawWithContent
@@ -12,17 +18,17 @@ import androidx.compose.ui.graphics.Shape
 import androidx.compose.ui.graphics.graphicsLayer
 import androidx.compose.ui.layout.onPlaced
 import androidx.compose.ui.platform.LocalDensity
+import androidx.compose.ui.platform.LocalLayoutDirection
 import androidx.compose.ui.unit.Density
+import androidx.compose.ui.unit.LayoutDirection
 import androidx.compose.ui.unit.dp
 import androidx.compose.ui.unit.toSize
 import androidx.compose.ui.util.lerp
-import com.arkivanov.decompose.ExperimentalDecomposeApi
 import com.arkivanov.essenty.backhandler.BackEvent
 import kotlinx.coroutines.coroutineScope
 import kotlinx.coroutines.joinAll
 import kotlinx.coroutines.launch
 
-@ExperimentalDecomposeApi
 internal class AndroidPredictiveBackAnimatableV2(
     private val initialEvent: BackEvent,
     private val exitShape: ((progress: Float, edge: BackEvent.SwipeEdge) -> Shape)?,
@@ -71,13 +77,14 @@ internal class AndroidPredictiveBackAnimatableV2(
         var size by remember { mutableStateOf(Size.Zero) }
         val scaleFactor = scaleFactor()
         val density = LocalDensity.current
+        val isLtr = LocalLayoutDirection.current == LayoutDirection.Ltr
 
         return this
             .onPlaced { size = it.size.toSize() }
             .graphicsLayer(
                 scaleX = scaleFactor,
                 scaleY = scaleFactor,
-                translationX = lerp(start = -size.width * 0.2F, stop = 0F, fraction = finishProgress),
+                translationX = lerp(start = (if (isLtr) -size.width else size.width) * 0.2F, stop = 0F, fraction = finishProgress),
                 translationY = density.exitOffsetY(height = size.height),
                 shape = shape,
                 clip = true,
@@ -90,36 +97,48 @@ internal class AndroidPredictiveBackAnimatableV2(
         var size by remember { mutableStateOf(Size.Zero) }
         val scaleFactor = scaleFactor()
         val density = LocalDensity.current
+        val isLtr = LocalLayoutDirection.current == LayoutDirection.Ltr
 
         return this
             .onPlaced { size = it.size.toSize() }
             .graphicsLayer(
                 scaleX = scaleFactor,
                 scaleY = scaleFactor,
                 alpha = 1F - finishProgress,
-                translationX = density.exitOffsetX(width = size.width),
+                translationX = when {
+                    size.width == 0F -> 0F
+                    isLtr -> density.exitOffsetXLtr(width = size.width)
+                    else -> density.exitOffsetXRtl(width = size.width)
+                },
                 translationY = density.exitOffsetY(height = size.height),
                 shape = shape,
                 clip = true,
                 compositingStrategy = CompositingStrategy.Offscreen,
             ) // Not using `graphicsLayer {}` with lambda due to https://github.com/arkivanov/Decompose/issues/877
     }
 
-    private fun Density.exitOffsetX(width: Float): Float {
-        if (width == 0F) {
-            return 0F
-        }
-
+    private fun Density.exitOffsetXLtr(width: Float): Float {
         val initialOffsetX =
             when (edge) {
                 BackEvent.SwipeEdge.LEFT -> (width - width * initialScaleFactor()) / 2F - 8.dp.toPx() * progress
                 BackEvent.SwipeEdge.RIGHT -> 0F
-                BackEvent.SwipeEdge.UNKNOWN -> 0F
+                else -> 0F
             }
 
         return lerp(start = initialOffsetX, stop = width * 0.2F, fraction = finishProgress)
     }
 
+    private fun Density.exitOffsetXRtl(width: Float): Float {
+        val initialOffsetX =
+            when (edge) {
+                BackEvent.SwipeEdge.RIGHT -> 8.dp.toPx() * progress - (width - width * initialScaleFactor()) / 2F
+                BackEvent.SwipeEdge.LEFT -> 0F
+                else -> 0F
+            }
+
+        return lerp(start = initialOffsetX, stop = -width * 0.2F, fraction = finishProgress)
+    }
+
     private fun initialScaleFactor(): Float =
         lerp(start = 1F, stop = 0.9F, fraction = progress)
 
```

---

### Incident Patch 2: `201c49ac` (2026-10-03)
**Commit Message**: Merge pull request #1030 from arkivanov/fix-AndroidPredictiveBackAnimatableV1-rtl

Fix wrong directions in AndroidPredictiveBackAnimatableV1 in RTL layout

**File**: `extensions-compose/src/commonMain/kotlin/com/arkivanov/decompose/extensions/compose/stack/animation/predictiveback/AndroidPredictiveBackAnimatableV1.kt` (modified, +6/-3)
```diff
@@ -13,7 +13,9 @@ import androidx.compose.ui.graphics.CompositingStrategy
 import androidx.compose.ui.graphics.Shape
 import androidx.compose.ui.graphics.graphicsLayer
 import androidx.compose.ui.layout.onPlaced
+import androidx.compose.ui.platform.LocalLayoutDirection
 import androidx.compose.ui.unit.IntSize
+import androidx.compose.ui.unit.LayoutDirection
 import androidx.compose.ui.util.lerp
 import com.arkivanov.decompose.ExperimentalDecomposeApi
 import com.arkivanov.essenty.backhandler.BackEvent
@@ -29,7 +31,6 @@ internal class AndroidPredictiveBackAnimatableV1(
     private val enterShape: ((progress: Float, edge: BackEvent.SwipeEdge) -> Shape)? = null,
 ) : PredictiveBackAnimatable {
 
-
     private val exitProgressAnimatable = Animatable(initialValue = initialEvent.progress.exitProgress())
     private val exitProgress: Float by derivedStateOf { exitProgressAnimatable.value }
     private val enterProgressAnimatable = Animatable(initialValue = initialEvent.progress.enterProgress())
@@ -66,14 +67,15 @@ internal class AndroidPredictiveBackAnimatableV1(
     private fun Modifier.exitModifier(layoutShape: (progress: Float, edge: BackEvent.SwipeEdge) -> Shape): Modifier {
         var size by remember { mutableStateOf(IntSize.Zero) }
         val scaleFactor = 1F - exitProgress * 0.1F
+        val isLtr = LocalLayoutDirection.current == LayoutDirection.Ltr
 
         return this
             .onPlaced { size = it.size }
             .graphicsLayer(
                 scaleX = scaleFactor,
                 scaleY = scaleFactor,
                 alpha = 1F - exitProgress,
-                translationX = size.width * 0.5F * exitProgress,
+                translationX = (if (isLtr) size.width else -size.width) * 0.5F * exitProgress,
                 shape = layoutShape(exitProgress, edge),
                 clip = true,
                 compositingStrategy = CompositingStrategy.Offscreen,
@@ -85,14 +87,15 @@ internal class AndroidPredictiveBackAnimatableV1(
         val totalProgress = lerp(start = enterProgress, stop = 1F, fraction = finishProgress)
         var size by remember { mutableStateOf(IntSize.Zero) }
         val scaleFactor = lerp(start = lerp(start = 0.95F, stop = 0.90F, fraction = enterProgress), stop = 1F, fraction = finishProgress)
+        val isLtr = LocalLayoutDirection.current == LayoutDirection.Ltr
 
         return this
             .onPlaced { size = it.size }
             .graphicsLayer(
                 scaleX = scaleFactor,
                 scaleY = scaleFactor,
                 alpha = totalProgress,
-                translationX = lerp(start = -size.width * 0.15F, stop = 0F, fraction = totalProgress),
+                translationX = lerp(start = (if (isLtr) -size.width else size.width) * 0.15F, stop = 0F, fraction = totalProgress),
                 shape = layoutShape(lerp(start = enterProgress, stop = 0F, fraction = finishProgress), edge),
                 clip = true,
                 compositingStrategy = CompositingStrategy.Offscreen,
```

---

### Incident Patch 3: `8aa7d0d5` (2026-10-03)
**Commit Message**: Fix wrong directions in AndroidPredictiveBackAnimatableV2 in RTL layout

**File**: `extensions-compose/src/commonMain/kotlin/com/arkivanov/decompose/extensions/compose/stack/animation/predictiveback/AndroidPredictiveBackAnimatableV2.kt` (modified, +30/-11)
```diff
@@ -1,7 +1,13 @@
 package com.arkivanov.decompose.extensions.compose.stack.animation.predictiveback
 
 import androidx.compose.animation.core.Animatable
-import androidx.compose.runtime.*
+import androidx.compose.runtime.Composable
+import androidx.compose.runtime.derivedStateOf
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableFloatStateOf
+import androidx.compose.runtime.mutableStateOf
+import androidx.compose.runtime.remember
+import androidx.compose.runtime.setValue
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.composed
 import androidx.compose.ui.draw.drawWithContent
@@ -12,17 +18,17 @@ import androidx.compose.ui.graphics.Shape
 import androidx.compose.ui.graphics.graphicsLayer
 import androidx.compose.ui.layout.onPlaced
 import androidx.compose.ui.platform.LocalDensity
+import androidx.compose.ui.platform.LocalLayoutDirection
 import androidx.compose.ui.unit.Density
+import androidx.compose.ui.unit.LayoutDirection
 import androidx.compose.ui.unit.dp
 import androidx.compose.ui.unit.toSize
 import androidx.compose.ui.util.lerp
-import com.arkivanov.decompose.ExperimentalDecomposeApi
 import com.arkivanov.essenty.backhandler.BackEvent
 import kotlinx.coroutines.coroutineScope
 import kotlinx.coroutines.joinAll
 import kotlinx.coroutines.launch
 
-@ExperimentalDecomposeApi
 internal class AndroidPredictiveBackAnimatableV2(
     private val initialEvent: BackEvent,
     private val exitShape: ((progress: Float, edge: BackEvent.SwipeEdge) -> Shape)?,
@@ -71,13 +77,14 @@ internal class AndroidPredictiveBackAnimatableV2(
         var size by remember { mutableStateOf(Size.Zero) }
         val scaleFactor = scaleFactor()
         val density = LocalDensity.current
+        val isLtr = LocalLayoutDirection.current == LayoutDirection.Ltr
 
         return this
             .onPlaced { size = it.size.toSize() }
             .graphicsLayer(
                 scaleX = scaleFactor,
                 scaleY = scaleFactor,
-                translationX = lerp(start = -size.width * 0.2F, stop = 0F, fraction = finishProgress),
+                translationX = lerp(start = (if (isLtr) -size.width else size.width) * 0.2F, stop = 0F, fraction = finishProgress),
                 translationY = density.exitOffsetY(height = size.height),
                 shape = shape,
                 clip = true,
@@ -90,36 +97,48 @@ internal class AndroidPredictiveBackAnimatableV2(
         var size by remember { mutableStateOf(Size.Zero) }
         val scaleFactor = scaleFactor()
         val density = LocalDensity.current
+        val isLtr = LocalLayoutDirection.current == LayoutDirection.Ltr
 
         return this
             .onPlaced { size = it.size.toSize() }
             .graphicsLayer(
                 scaleX = scaleFactor,
                 scaleY = scaleFactor,
                 alpha = 1F - finishProgress,
-                translationX = density.exitOffsetX(width = size.width),
+                translationX = when {
+                    size.width == 0F -> 0F
+                    isLtr -> density.exitOffsetXLtr(width = size.width)
+                    else -> density.exitOffsetXRtl(width = size.width)
+                },
                 translationY = density.exitOffsetY(height = size.height),
                 shape = shape,
                 clip = true,
                 compositingStrategy = CompositingStrategy.Offscreen,
             ) // Not using `graphicsLayer {}` with lambda due to https://github.com/arkivanov/Decompose/issues/877
     }
 
-    private fun Density.exitOffsetX(width: Float): Float {
-        if (width == 0F) {
-            return 0F
-        }
-
+    private fun Density.exitOffsetXLtr(width: Float): Float {
         val initialOffsetX =
             when (edge) {
                 BackEvent.SwipeEdge.LEFT -> (width - width * initialScaleFactor()) / 2F - 8.dp.toPx() * progress
                 BackEvent.SwipeEdge.RIGHT -> 0F
-                BackEvent.SwipeEdge.UNKNOWN -> 0F
+                else -> 0F
             }
 
         return lerp(start = initialOffsetX, stop = width * 0.2F, fraction = finishProgress)
     }
 
+    private fun Density.exitOffsetXRtl(width: Float): Float {
+        val initialOffsetX =
+            when (edge) {
+                BackEvent.SwipeEdge.RIGHT -> 8.dp.toPx() * progress - (width - width * initialScaleFactor()) / 2F
+                BackEvent.SwipeEdge.LEFT -> 0F
+                else -> 0F
+            }
+
+        return lerp(start = initialOffsetX, stop = -width * 0.2F, fraction = finishProgress)
+    }
+
     private fun initialScaleFactor(): Float =
         lerp(start = 1F, stop = 0.9F, fraction = progress)
 
```

---

### Incident Patch 4: `bc3dcd8a` (2026-10-03)
**Commit Message**: Fix wrong directions in AndroidPredictiveBackAnimatableV1 in RTL layout

**File**: `extensions-compose/src/commonMain/kotlin/com/arkivanov/decompose/extensions/compose/stack/animation/predictiveback/AndroidPredictiveBackAnimatableV1.kt` (modified, +6/-3)
```diff
@@ -13,7 +13,9 @@ import androidx.compose.ui.graphics.CompositingStrategy
 import androidx.compose.ui.graphics.Shape
 import androidx.compose.ui.graphics.graphicsLayer
 import androidx.compose.ui.layout.onPlaced
+import androidx.compose.ui.platform.LocalLayoutDirection
 import androidx.compose.ui.unit.IntSize
+import androidx.compose.ui.unit.LayoutDirection
 import androidx.compose.ui.util.lerp
 import com.arkivanov.decompose.ExperimentalDecomposeApi
 import com.arkivanov.essenty.backhandler.BackEvent
@@ -29,7 +31,6 @@ internal class AndroidPredictiveBackAnimatableV1(
     private val enterShape: ((progress: Float, edge: BackEvent.SwipeEdge) -> Shape)? = null,
 ) : PredictiveBackAnimatable {
 
-
     private val exitProgressAnimatable = Animatable(initialValue = initialEvent.progress.exitProgress())
     private val exitProgress: Float by derivedStateOf { exitProgressAnimatable.value }
     private val enterProgressAnimatable = Animatable(initialValue = initialEvent.progress.enterProgress())
@@ -66,14 +67,15 @@ internal class AndroidPredictiveBackAnimatableV1(
     private fun Modifier.exitModifier(layoutShape: (progress: Float, edge: BackEvent.SwipeEdge) -> Shape): Modifier {
         var size by remember { mutableStateOf(IntSize.Zero) }
         val scaleFactor = 1F - exitProgress * 0.1F
+        val isLtr = LocalLayoutDirection.current == LayoutDirection.Ltr
 
         return this
             .onPlaced { size = it.size }
             .graphicsLayer(
                 scaleX = scaleFactor,
                 scaleY = scaleFactor,
                 alpha = 1F - exitProgress,
-                translationX = size.width * 0.5F * exitProgress,
+                translationX = (if (isLtr) size.width else -size.width) * 0.5F * exitProgress,
                 shape = layoutShape(exitProgress, edge),
                 clip = true,
                 compositingStrategy = CompositingStrategy.Offscreen,
@@ -85,14 +87,15 @@ internal class AndroidPredictiveBackAnimatableV1(
         val totalProgress = lerp(start = enterProgress, stop = 1F, fraction = finishProgress)
         var size by remember { mutableStateOf(IntSize.Zero) }
         val scaleFactor = lerp(start = lerp(start = 0.95F, stop = 0.90F, fraction = enterProgress), stop = 1F, fraction = finishProgress)
+        val isLtr = LocalLayoutDirection.current == LayoutDirection.Ltr
 
         return this
             .onPlaced { size = it.size }
             .graphicsLayer(
                 scaleX = scaleFactor,
                 scaleY = scaleFactor,
                 alpha = totalProgress,
-                translationX = lerp(start = -size.width * 0.15F, stop = 0F, fraction = totalProgress),
+                translationX = lerp(start = (if (isLtr) -size.width else size.width) * 0.15F, stop = 0F, fraction = totalProgress),
                 shape = layoutShape(lerp(start = enterProgress, stop = 0F, fraction = finishProgress), edge),
                 clip = true,
                 compositingStrategy = CompositingStrategy.Offscreen,
```

---

### Incident Patch 5: `53f0d011` (2026-09-28)
**Commit Message**: Add linuxX64 and linuxArm64 targets (#1028)

* Add linuxX64 and linuxArm64 targets

Bump Essenty to 2.7.0-alpha01, enable linuxX64/linuxArm64 in the root
multiplatform defaults (extensions-* keep their own target lists), and
add a shared linux source set with Lock (pthread recursive mutex, derived
from Reaktive), a no-op checkMainThread, and printError.

Closes #1013

Co-authored-by: Arkadii Ivanov <[REDACTED_EMAIL]>

* Update dependencyGuard baselines for Essenty 2.7.0-alpha01

Re-baseline releaseRuntimeClasspath after the Essenty bump so CI
dependencyGuard checks pass.

Co-authored-by: Arkadii Ivanov <[REDACTED_EMAIL]>

* Document linuxX64 and linuxArm64 in supported platforms

List the new Linux targets in the README alongside the other
multiplatform targets (extensions-* still omit Linux).

Co-authored-by: Arkadii Ivanov <[REDACTED_EMAIL]>

* Inline lock/unlock into synchronizedImpl on linux

Per review feedback on #1028: call pthread_mutex_lock/unlock
directly inside the inline synchronizedImpl and drop the
@PublishedApi helpers to keep the public surface smaller.

Co-authored-by: Arkadii Ivanov <[REDACTED_EMAIL]>

---------

Co-authored-by: Arkadii Ivanov <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ Please check the [Installation](https://arkivanov.github.io/Decompose/getting-st
 
 ### Supported platforms
 
-In general, Decompose supports the following targets: `android`, `jvm`, `ios`, `watchos`, `tvos`, `macos`, `wasmJs`, `js`. However, some modules do not support all targets or the support depends on the Decompose version. Please see the installation docs for details.
+In general, Decompose supports the following targets: `android`, `jvm`, `ios`, `watchos`, `tvos`, `macos`, `linuxX64`, `linuxArm64`, `wasmJs`, `js`. However, some modules do not support all targets or the support depends on the Decompose version. Please see the installation docs for details.
 
 ## Overview
 
```

**File**: `build.gradle.kts` (modified, +2/-0)
```diff
@@ -35,6 +35,8 @@ setupDefaults(
         jvm()
         js { browser() }
         wasmJs { browser() }
+        linuxX64()
+        linuxArm64()
         iosCompat()
         watchosCompat()
         tvosCompat()
```

**File**: `decompose/build.gradle.kts` (modified, +3/-0)
```diff
@@ -36,6 +36,7 @@ kotlin {
         val wasmJs by bundle()
         val nonWeb by bundle()
         val web by bundle()
+        val linux by bundle()
 
         (darwin) dependsOn common
         nonWeb dependsOn common
@@ -44,6 +45,8 @@ kotlin {
         (js + wasmJs) dependsOn web
         (iosSet + tvosSet) dependsOn itvos
         (darwinSet - iosSet - tvosSet + itvos) dependsOn darwin
+        linux dependsOn common
+        linuxSet dependsOn linux
 
         all {
             languageSettings {
```

**File**: `decompose/dependencies/releaseRuntimeClasspath.txt` (modified, +10/-10)
```diff
@@ -30,16 +30,16 @@ androidx.startup:startup-runtime:1.1.1
 androidx.tracing:tracing:1.0.0
 androidx.versionedparcelable:versionedparcelable:1.1.1
 androidx.viewpager:viewpager:1.0.0
-com.arkivanov.essenty:back-handler-android:2.6.0
-com.arkivanov.essenty:back-handler:2.6.0
-com.arkivanov.essenty:instance-keeper-android:2.6.0
-com.arkivanov.essenty:instance-keeper:2.6.0
-com.arkivanov.essenty:lifecycle-android:2.6.0
-com.arkivanov.essenty:lifecycle:2.6.0
-com.arkivanov.essenty:state-keeper-android:2.6.0
-com.arkivanov.essenty:state-keeper:2.6.0
-com.arkivanov.essenty:utils-internal-android:2.6.0
-com.arkivanov.essenty:utils-internal:2.6.0
+com.arkivanov.essenty:back-handler-android:2.7.0-alpha01
+com.arkivanov.essenty:back-handler:2.7.0-alpha01
+com.arkivanov.essenty:instance-keeper-android:2.7.0-alpha01
+com.arkivanov.essenty:instance-keeper:2.7.0-alpha01
+com.arkivanov.essenty:lifecycle-android:2.7.0-alpha01
+com.arkivanov.essenty:lifecycle:2.7.0-alpha01
+com.arkivanov.essenty:state-keeper-android:2.7.0-alpha01
+com.arkivanov.essenty:state-keeper:2.7.0-alpha01
+com.arkivanov.essenty:utils-internal-android:2.7.0-alpha01
+com.arkivanov.essenty:utils-internal:2.7.0-alpha01
 com.google.guava:listenablefuture:1.0
 org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.8.0
 org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.8.0
```

**File**: `decompose/src/linuxMain/kotlin/com/arkivanov/decompose/Lock.kt` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+package com.arkivanov.decompose
+
+import kotlinx.cinterop.Arena
+import kotlinx.cinterop.ExperimentalForeignApi
+import kotlinx.cinterop.alloc
+import kotlinx.cinterop.ptr
+import platform.posix.PTHREAD_MUTEX_RECURSIVE
+import platform.posix.pthread_mutex_destroy
+import platform.posix.pthread_mutex_init
+import platform.posix.pthread_mutex_lock
+import platform.posix.pthread_mutex_t
+import platform.posix.pthread_mutex_unlock
+import platform.posix.pthread_mutexattr_destroy
+import platform.posix.pthread_mutexattr_init
+import platform.posix.pthread_mutexattr_settype
+import platform.posix.pthread_mutexattr_t
+import kotlin.experimental.ExperimentalNativeApi
+import kotlin.native.ref.createCleaner
+
+@OptIn(ExperimentalForeignApi::class)
+internal actual class Lock actual constructor() {
+
+    private val arena = Arena()
+    private val attr = arena.alloc<pthread_mutexattr_t>()
+    private val mutex = arena.alloc<pthread_mutex_t>()
+
+    @Suppress("unused") // Must be stored in a property
+    @OptIn(ExperimentalNativeApi::class)
+    private val cleaner = createCleaner(Resources(arena, attr, mutex), Resources::destroy)
+
+    init {
+        pthread_mutexattr_init(attr.ptr)
+        pthread_mutexattr_settype(attr.ptr, PTHREAD_MUTEX_RECURSIVE.toInt())
+        pthread_mutex_init(mutex.ptr, attr.ptr)
+    }
+
+    actual inline fun <T> synchronizedImpl(block: () -> T): T {
+        pthread_mutex_lock(mutex.ptr)
+        try {
+            return block()
+        } finally {
+            pthread_mutex_unlock(mutex.ptr)
+        }
+    }
+
+    private class Resources(
+        private val arena: Arena,
+        private val attr: pthread_mutexattr_t,
+        private val mutex: pthread_mutex_t,
+    ) {
+        fun destroy() {
+            pthread_mutex_destroy(mutex.ptr)
+            pthread_mutexattr_destroy(attr.ptr)
+            arena.clear()
+        }
+    }
+}
```

**File**: `decompose/src/linuxMain/kotlin/com/arkivanov/decompose/errorhandler/PrintError.kt` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+package com.arkivanov.decompose.errorhandler
+
+internal actual fun printError(exception: Exception) {
+    exception.printStackTrace()
+}
```

**File**: `decompose/src/linuxMain/kotlin/com/arkivanov/decompose/mainthread/CheckMainThread.kt` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+package com.arkivanov.decompose.mainthread
+
+internal actual fun checkMainThread() {
+    // No-op
+}
```

**File**: `deps.versions.toml` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 decompose = "3.6.0-beta01"
 kotlin = "2.3.21"
-essenty = "2.6.0"
+essenty = "2.7.0-alpha01"
 reaktive = "2.2.0"
 junit = "4.13.2"
 jetbrainsCompose = "1.9.3"
```

---

### Incident Patch 6: `f7508a25` (2026-07-04)
**Commit Message**: Changed type parameter T in NavStateSaver to nullable (#1009)

<!-- This is an auto-generated comment: release notes by coderabbit.ai -->
## Summary by CodeRabbit

* **New Features**
  * `NavStateSaver` now supports nullable configuration values.
  * Convenience builders were updated to work with both nullable and non-nullable types, while keeping serialization behavior the same.
<!-- end of auto-generated comment: release notes by coderabbit.ai -->

**File**: `decompose/api/decompose.klib.api` (modified, +7/-7)
```diff
@@ -69,11 +69,6 @@ abstract interface <#A: kotlin/Any, #B: kotlin/Any, #C: kotlin/Any> com.arkivano
     abstract fun navigate(kotlin/Function1<com.arkivanov.decompose.router.panels/Panels<#A, #B, #C>, com.arkivanov.decompose.router.panels/Panels<#A, #B, #C>>, kotlin/Function2<com.arkivanov.decompose.router.panels/Panels<#A, #B, #C>, com.arkivanov.decompose.router.panels/Panels<#A, #B, #C>, kotlin/Unit>) // com.arkivanov.decompose.router.panels/PanelsNavigator.navigate|navigate(kotlin.Function1<com.arkivanov.decompose.router.panels.Panels<1:0,1:1,1:2>,com.arkivanov.decompose.router.panels.Panels<1:0,1:1,1:2>>;kotlin.Function2<com.arkivanov.decompose.router.panels.Panels<1:0,1:1,1:2>,com.arkivanov.decompose.router.panels.Panels<1:0,1:1,1:2>,kotlin.Unit>){}[0]
 }
 
-abstract interface <#A: kotlin/Any> com.arkivanov.decompose.router.children/NavStateSaver { // com.arkivanov.decompose.router.children/NavStateSaver|null[0]
-    abstract fun restoreState(com.arkivanov.essenty.statekeeper/SerializableContainer): #A? // com.arkivanov.decompose.router.children/NavStateSaver.restoreState|restoreState(com.arkivanov.essenty.statekeeper.SerializableContainer){}[0]
-    abstract fun saveState(#A): com.arkivanov.essenty.statekeeper/SerializableContainer? // com.arkivanov.decompose.router.children/NavStateSaver.saveState|saveState(1:0){}[0]
-}
-
 abstract interface <#A: kotlin/Any> com.arkivanov.decompose.router.items/ItemsNavigation : com.arkivanov.decompose.router.children/NavigationSource<com.arkivanov.decompose.router.items/ItemsNavigation.Event<#A>>, com.arkivanov.decompose.router.items/ItemsNavigator<#A> { // com.arkivanov.decompose.router.items/ItemsNavigation|null[0]
     final class <#A1: kotlin/Any> Event { // com.arkivanov.decompose.router.items/ItemsNavigation.Event|null[0]
         constructor <init>(kotlin/Function1<com.arkivanov.decompose.router.items/Items<#A1>, com.arkivanov.decompose.router.items/Items<#A1>>, kotlin/Function2<com.arkivanov.decompose.router.items/Items<#A1>, com.arkivanov.decompose.router.items/Items<#A1>, kotlin/Unit> = ...) // com.arkivanov.decompose.router.items/ItemsNavigation.Event.<init>|<init>(kotlin.Function1<com.arkivanov.decompose.router.items.Items<1:0>,com.arkivanov.decompose.router.items.Items<1:0>>;kotlin.Function2<com.arkivanov.decompose.router.items.Items<1:0>,com.arkivanov.decompose.router.items.Items<1:0>,kotlin.Unit>){}[0]
@@ -157,6 +152,11 @@ abstract interface <#A: kotlin/Any> com.arkivanov.decompose.router.webhistory/We
     }
 }
 
+abstract interface <#A: kotlin/Any?> com.arkivanov.decompose.router.children/NavStateSaver { // com.arkivanov.decompose.router.children/NavStateSaver|null[0]
+    abstract fun restoreState(com.arkivanov.essenty.statekeeper/SerializableContainer): #A? // com.arkivanov.decompose.router.children/NavStateSaver.restoreState|restoreState(com.arkivanov.essenty.statekeeper.SerializableContainer){}[0]
+    abstract fun saveState(#A): com.arkivanov.essenty.statekeeper/SerializableContainer? // com.arkivanov.decompose.router.children/NavStateSaver.saveState|saveState(1:0){}[0]
+}
+
 abstract interface <#A: out kotlin/Any> com.arkivanov.decompose.router.children/ChildNavState { // com.arkivanov.decompose.router.children/ChildNavState|null[0]
     abstract val configuration // com.arkivanov.decompose.router.children/ChildNavState.configuration|{}configuration[0]
         abstract fun <get-configuration>(): #A // com.arkivanov.decompose.router.children/ChildNavState.configuration.<get-configuration>|<get-configuration>(){}[0]
@@ -651,13 +651,13 @@ final fun <#A: kotlin/Any> (com.arkivanov.decompose.value/MutableValue<#A>).com.
 final fun <#A: kotlin/Any> (com.arkivanov.decompose.value/MutableValue<#A>).com.arkivanov.decompose.value/updateAndGet(kotlin/Function1<#A, #A>): #A // com.arkivanov.decompose.value/updateAndGet|updateAndGet@com.arkivanov.decompose.value.MutableValue<0:0>(kotlin.Function1<0:0,0:0>){0§<kotlin.Any>}[0]
 final fun <#A: kotlin/Any> (com.arkivanov.decompose.value/Value<#A>).com.arkivanov.decompose.value/getValue(kotlin/Any?, kotlin.reflect/KProperty<*>): #A // com.arkivanov.decompose.value/getValue|getValue@com.arkivanov.decompose.value.Value<0:0>(kotlin.Any?;kotlin.reflect.KProperty<*>){0§<kotlin.Any>}[0]
 final fun <#A: kotlin/Any> (com.arkivanov.decompose.value/Value<#A>).com.arkivanov.decompose.value/subscribe(com.arkivanov.essenty.lifecycle/Lifecycle, com.arkivanov.decompose.value/ObserveLifecycleMode = ..., kotlin/Function1<#A, kotlin/Unit>) // com.arkivanov.decompose.value/subscribe|subscribe@com.arkivanov.decompose.value.Value<0:0>(com.arkivanov.essenty.lifecycle.Lifecycle;com.arkivanov.decompose.value.ObserveLifecycleMode;kotlin.Function1<0:0,kotlin.Unit>){0§<kotlin.Any>}[0]
-final fun <#A: kotlin/Any> com.arkivanov.decompose.router.children/NavStateSaver(kotlinx.serialization/KSerializer<#A>): com.arkivanov.decompose.router.children/NavStateSaver<#A> // com.arkivanov.decompose.router.children/NavStateSaver|NavStateSaver(kotl
```

**File**: `decompose/src/commonMain/kotlin/com/arkivanov/decompose/router/children/NavStateSaver.kt` (modified, +9/-5)
```diff
@@ -9,7 +9,7 @@ import kotlinx.serialization.KSerializer
  * A contract for saving and restoring navigation states.
  */
 @ExperimentalDecomposeApi
-interface NavStateSaver<T : Any> {
+interface NavStateSaver<T> {
 
     /**
      * Saves the provided navigation state into [SerializableContainer].
@@ -33,7 +33,7 @@ interface NavStateSaver<T : Any> {
  * with the provided [save] and [restore] functions.
  */
 @ExperimentalDecomposeApi
-inline fun <T : Any> NavStateSaver(
+inline fun <T> NavStateSaver(
     crossinline save: (T) -> SerializableContainer?,
     crossinline restore: (SerializableContainer) -> T?,
 ): NavStateSaver<T> =
@@ -47,8 +47,12 @@ inline fun <T : Any> NavStateSaver(
  * that saves and restores the navigation state using the provided [serializer].
  */
 @ExperimentalDecomposeApi
-fun <T : Any> NavStateSaver(serializer: KSerializer<T>): NavStateSaver<T> =
+fun <T> NavStateSaver(serializer: KSerializer<T & Any>): NavStateSaver<T> =
     NavStateSaver(
-        save = { SerializableContainer(value = it, strategy = serializer) },
-        restore = { it.consume(strategy = serializer) },
+        save = {
+            SerializableContainer(value = it, strategy = serializer)
+        },
+        restore = {
+            it.consume(strategy = serializer)
+        },
     )
```

---

### Incident Patch 7: `75aff7a4` (2026-07-04)
**Commit Message**: Changed type parameter T in NavStateSaver to nullable

**File**: `decompose/api/decompose.klib.api` (modified, +7/-7)
```diff
@@ -69,11 +69,6 @@ abstract interface <#A: kotlin/Any, #B: kotlin/Any, #C: kotlin/Any> com.arkivano
     abstract fun navigate(kotlin/Function1<com.arkivanov.decompose.router.panels/Panels<#A, #B, #C>, com.arkivanov.decompose.router.panels/Panels<#A, #B, #C>>, kotlin/Function2<com.arkivanov.decompose.router.panels/Panels<#A, #B, #C>, com.arkivanov.decompose.router.panels/Panels<#A, #B, #C>, kotlin/Unit>) // com.arkivanov.decompose.router.panels/PanelsNavigator.navigate|navigate(kotlin.Function1<com.arkivanov.decompose.router.panels.Panels<1:0,1:1,1:2>,com.arkivanov.decompose.router.panels.Panels<1:0,1:1,1:2>>;kotlin.Function2<com.arkivanov.decompose.router.panels.Panels<1:0,1:1,1:2>,com.arkivanov.decompose.router.panels.Panels<1:0,1:1,1:2>,kotlin.Unit>){}[0]
 }
 
-abstract interface <#A: kotlin/Any> com.arkivanov.decompose.router.children/NavStateSaver { // com.arkivanov.decompose.router.children/NavStateSaver|null[0]
-    abstract fun restoreState(com.arkivanov.essenty.statekeeper/SerializableContainer): #A? // com.arkivanov.decompose.router.children/NavStateSaver.restoreState|restoreState(com.arkivanov.essenty.statekeeper.SerializableContainer){}[0]
-    abstract fun saveState(#A): com.arkivanov.essenty.statekeeper/SerializableContainer? // com.arkivanov.decompose.router.children/NavStateSaver.saveState|saveState(1:0){}[0]
-}
-
 abstract interface <#A: kotlin/Any> com.arkivanov.decompose.router.items/ItemsNavigation : com.arkivanov.decompose.router.children/NavigationSource<com.arkivanov.decompose.router.items/ItemsNavigation.Event<#A>>, com.arkivanov.decompose.router.items/ItemsNavigator<#A> { // com.arkivanov.decompose.router.items/ItemsNavigation|null[0]
     final class <#A1: kotlin/Any> Event { // com.arkivanov.decompose.router.items/ItemsNavigation.Event|null[0]
         constructor <init>(kotlin/Function1<com.arkivanov.decompose.router.items/Items<#A1>, com.arkivanov.decompose.router.items/Items<#A1>>, kotlin/Function2<com.arkivanov.decompose.router.items/Items<#A1>, com.arkivanov.decompose.router.items/Items<#A1>, kotlin/Unit> = ...) // com.arkivanov.decompose.router.items/ItemsNavigation.Event.<init>|<init>(kotlin.Function1<com.arkivanov.decompose.router.items.Items<1:0>,com.arkivanov.decompose.router.items.Items<1:0>>;kotlin.Function2<com.arkivanov.decompose.router.items.Items<1:0>,com.arkivanov.decompose.router.items.Items<1:0>,kotlin.Unit>){}[0]
@@ -157,6 +152,11 @@ abstract interface <#A: kotlin/Any> com.arkivanov.decompose.router.webhistory/We
     }
 }
 
+abstract interface <#A: kotlin/Any?> com.arkivanov.decompose.router.children/NavStateSaver { // com.arkivanov.decompose.router.children/NavStateSaver|null[0]
+    abstract fun restoreState(com.arkivanov.essenty.statekeeper/SerializableContainer): #A? // com.arkivanov.decompose.router.children/NavStateSaver.restoreState|restoreState(com.arkivanov.essenty.statekeeper.SerializableContainer){}[0]
+    abstract fun saveState(#A): com.arkivanov.essenty.statekeeper/SerializableContainer? // com.arkivanov.decompose.router.children/NavStateSaver.saveState|saveState(1:0){}[0]
+}
+
 abstract interface <#A: out kotlin/Any> com.arkivanov.decompose.router.children/ChildNavState { // com.arkivanov.decompose.router.children/ChildNavState|null[0]
     abstract val configuration // com.arkivanov.decompose.router.children/ChildNavState.configuration|{}configuration[0]
         abstract fun <get-configuration>(): #A // com.arkivanov.decompose.router.children/ChildNavState.configuration.<get-configuration>|<get-configuration>(){}[0]
@@ -651,13 +651,13 @@ final fun <#A: kotlin/Any> (com.arkivanov.decompose.value/MutableValue<#A>).com.
 final fun <#A: kotlin/Any> (com.arkivanov.decompose.value/MutableValue<#A>).com.arkivanov.decompose.value/updateAndGet(kotlin/Function1<#A, #A>): #A // com.arkivanov.decompose.value/updateAndGet|updateAndGet@com.arkivanov.decompose.value.MutableValue<0:0>(kotlin.Function1<0:0,0:0>){0§<kotlin.Any>}[0]
 final fun <#A: kotlin/Any> (com.arkivanov.decompose.value/Value<#A>).com.arkivanov.decompose.value/getValue(kotlin/Any?, kotlin.reflect/KProperty<*>): #A // com.arkivanov.decompose.value/getValue|getValue@com.arkivanov.decompose.value.Value<0:0>(kotlin.Any?;kotlin.reflect.KProperty<*>){0§<kotlin.Any>}[0]
 final fun <#A: kotlin/Any> (com.arkivanov.decompose.value/Value<#A>).com.arkivanov.decompose.value/subscribe(com.arkivanov.essenty.lifecycle/Lifecycle, com.arkivanov.decompose.value/ObserveLifecycleMode = ..., kotlin/Function1<#A, kotlin/Unit>) // com.arkivanov.decompose.value/subscribe|subscribe@com.arkivanov.decompose.value.Value<0:0>(com.arkivanov.essenty.lifecycle.Lifecycle;com.arkivanov.decompose.value.ObserveLifecycleMode;kotlin.Function1<0:0,kotlin.Unit>){0§<kotlin.Any>}[0]
-final fun <#A: kotlin/Any> com.arkivanov.decompose.router.children/NavStateSaver(kotlinx.serialization/KSerializer<#A>): com.arkivanov.decompose.router.children/NavStateSaver<#A> // com.arkivanov.decompose.router.children/NavStateSaver|NavStateSaver(kotl
```

**File**: `decompose/src/commonMain/kotlin/com/arkivanov/decompose/router/children/NavStateSaver.kt` (modified, +9/-5)
```diff
@@ -9,7 +9,7 @@ import kotlinx.serialization.KSerializer
  * A contract for saving and restoring navigation states.
  */
 @ExperimentalDecomposeApi
-interface NavStateSaver<T : Any> {
+interface NavStateSaver<T> {
 
     /**
      * Saves the provided navigation state into [SerializableContainer].
@@ -33,7 +33,7 @@ interface NavStateSaver<T : Any> {
  * with the provided [save] and [restore] functions.
  */
 @ExperimentalDecomposeApi
-inline fun <T : Any> NavStateSaver(
+inline fun <T> NavStateSaver(
     crossinline save: (T) -> SerializableContainer?,
     crossinline restore: (SerializableContainer) -> T?,
 ): NavStateSaver<T> =
@@ -47,8 +47,12 @@ inline fun <T : Any> NavStateSaver(
  * that saves and restores the navigation state using the provided [serializer].
  */
 @ExperimentalDecomposeApi
-fun <T : Any> NavStateSaver(serializer: KSerializer<T>): NavStateSaver<T> =
+fun <T> NavStateSaver(serializer: KSerializer<T & Any>): NavStateSaver<T> =
     NavStateSaver(
-        save = { SerializableContainer(value = it, strategy = serializer) },
-        restore = { it.consume(strategy = serializer) },
+        save = {
+            SerializableContainer(value = it, strategy = serializer)
+        },
+        restore = {
+            it.consume(strategy = serializer)
+        },
     )
```

---

### Incident Patch 8: `1dd253ed` (2026-07-01)
**Commit Message**: Merge pull request #1001 from arkivanov/fix-predictive-back-cancel-start

Fixed predictive back gesture not working on OnePlus devices

**File**: `extensions-compose-experimental/api/extensions-compose-experimental.klib.api` (modified, +2/-0)
```diff
@@ -61,6 +61,7 @@ final val com.arkivanov.decompose.extensions.compose.experimental.panels/com_ark
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/LocalStackAnimationProvider // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/LocalStackAnimationProvider|{}LocalStackAnimationProvider[0]
     final fun <get-LocalStackAnimationProvider>(): androidx.compose.runtime/ProvidableCompositionLocal<com.arkivanov.decompose.extensions.compose.experimental.stack.animation/StackAnimationProvider> // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/LocalStackAnimationProvider.<get-LocalStackAnimationProvider>|<get-LocalStackAnimationProvider>(){}[0]
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop[0]
+final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Cancelling$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Cancelling$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Cancelling$stableprop[0]
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Finishing$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Finishing$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Finishing$stableprop[0]
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Idle$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Idle$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Idle$stableprop[0]
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Progress$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Progress$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Progress$stableprop[0]
@@ -82,6 +83,7 @@ final fun <#A: kotlin/Any, #B: kotlin/Any> com.arkivanov.decompose.extensions.co
 final fun com.arkivanov.decompose.extensions.compose.experimental.panels/com_arkivanov_decompose_extensions_compose_experimental_panels_ChildPanelsAnimators$stableprop_getter(): kotlin/Int // com.arkivanov.decompose.extensions.compose.experimental.panels/com_arkivanov_decompose_extensions_compose_experimental_panels_ChildPanelsAnimators$stableprop_getter|com_arkivanov_decompose_extensions_compose_experimental_panels_ChildPanelsAnimators$stableprop_getter(){}[0]
 final fun com.arkivanov.decompose.extensions.compose.experimental.panels/com_arkivanov_decompose_extensions_compose_experimental_panels_HorizontalChildPanelsLayout$stableprop_getter(): kotlin/Int // com.arkivanov.decompose.extensions.compose.experimental.panels/com_arkivanov_decompose_extensions_compose_experimental_panels_HorizontalChildPanelsLayout$stableprop_getter|com_arkivanov_decompose_extensions_compose_experimental_panels_HorizontalChildPanelsLayout$stableprop_getter(){}[0]
 final fun com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop_getter(): kotlin/Int // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop_getter|com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop_getter(){}[0]
+final fun com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompos
```

**File**: `extensions-compose-experimental/src/commonMain/kotlin/com/arkivanov/decompose/extensions/compose/experimental/stack/animation/DefaultStackAnimation.kt` (modified, +65/-26)
```diff
@@ -30,8 +30,10 @@ import com.arkivanov.decompose.router.stack.ChildStack
 import com.arkivanov.essenty.backhandler.BackCallback
 import com.arkivanov.essenty.backhandler.BackEvent
 import kotlinx.coroutines.CoroutineScope
+import kotlinx.coroutines.Job
 import kotlinx.coroutines.cancel
 import kotlinx.coroutines.launch
+import kotlinx.coroutines.plus
 
 @ExperimentalDecomposeApi
 internal class DefaultStackAnimation<C : Any, T : Any>(
@@ -207,7 +209,7 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
             remember {
                 PredictiveBackCallback(
                     stack = stack,
-                    scope = scope,
+                    parentScope = scope,
                     predictiveBackParams = predictiveBackParams,
                     setItems = setItems,
                 )
@@ -240,23 +242,31 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
 
     private inner class PredictiveBackCallback(
         private val stack: ChildStack<C, T>,
-        private val scope: CoroutineScope,
+        private val parentScope: CoroutineScope,
         private val predictiveBackParams: PredictiveBackParams,
         private val setItems: (Map<String, AnimationItem<C, T>>) -> Unit,
     ) : BackCallback() {
         private var state: State = State.Idle
 
         override fun onBackStarted(backEvent: BackEvent) {
-            if (state is State.Idle) {
-                state = State.Started(backEvent)
+            val currentState = state
+            if (currentState is State.Idle) {
+                val childScope = parentScope + Job(parentScope.coroutineContext[Job])
+                state = State.Started(backEvent, childScope)
+            } else if (currentState is State.Cancelling) {
+                currentState.scope.cancel()
+                val newScope = parentScope + Job(parentScope.coroutineContext[Job])
+                state = State.Started(currentState.lastBackEvent, newScope)
+                onBackProgressed(currentState.lastBackEvent)
             }
         }
 
         override fun onBackProgressed(backEvent: BackEvent) {
             startIfNeeded()
             val currentState = state as? State.Progress ?: return
+            currentState.backEvent = backEvent
 
-            scope.launch {
+            currentState.scope.launch {
                 currentState.animationHandler.progress(backEvent)
             }
         }
@@ -265,7 +275,7 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
             val currentState = state as? State.Started ?: return
             val backEvent = currentState.initialBackEvent
             val animationHandler = AnimationHandler(animatable = predictiveBackParams.animatable(backEvent))
-            state = State.Progress(animationHandler)
+            state = State.Progress(animationHandler, currentState.initialBackEvent, currentState.scope)
             val exitChild = stack.active
             val enterChild = stack.backStack.last()
 
@@ -290,49 +300,78 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
                 )
             )
 
-            scope.launch {
+            currentState.scope.launch {
                 animationHandler.progress(backEvent)
             }
         }
 
         override fun onBackCancelled() {
-            val currentState = state
-            if (currentState is State.Progress) {
-                state = State.Finishing
+            when (val currentState = state) {
+                is State.Idle -> Unit // no-op
 
-                scope.launch {
-                    currentState.animationHandler.cancel()
+                is State.Started -> {
+                    currentState.scope.cancel()
                     state = State.Idle
-                    setItems(getAnimationItems(newStack = stack))
                 }
-            } else if (currentState !is State.Finishing) {
-                state = State.Idle
+
+                is State.Progress -> {
+                    state = State.Cancelling(currentState.backEvent, currentState.scope)
+
+                    currentState.scope.launch {
+                        currentState.animationHandler.cancel()
+                        state = State.Idle
+                        setItems(getAnimationItems(newStack = stack))
+                        currentState.scope.cancel()
+                    }
+                }
+
+                is State.Finishing -> Unit // no-op
+                is State.Cancelling -> Unit // no-op
             }
         }
 
         override fun onBack() {
-            val currentState = state
-            if (currentState is State.Progress) {
-                state = State.Finishing
+            when (val currentState = state) {
+                is State.Idle -> {
+                    predictiveBackParams.onBack()
+                }
+
+                is State.Started -> {
+                    currentState.scope.cancel()
+                    state = State.Idle
+                    predictiveBackPara
```

**File**: `extensions-compose-experimental/src/jvmTest/kotlin/com/arkivanov/decompose/extensions/compose/experimental/stack/animation/PredictiveBackGestureTest.kt` (modified, +74/-18)
```diff
@@ -502,15 +502,7 @@ class PredictiveBackGestureTest {
             DefaultStackAnimation(
                 predictiveBackAnimatable = {
                     animationCount++
-
-                    TestAnimatable(
-                        initialBackEvent = it,
-                        finish = {
-                            suspendCancellableCoroutine {
-                                // Simulate a long-running animation
-                            }
-                        },
-                    )
+                    TestAnimatable(initialBackEvent = it, finish = suspendForever())
                 },
                 onBack = { stack = stack.dropLast() },
             )
@@ -544,15 +536,7 @@ class PredictiveBackGestureTest {
             DefaultStackAnimation(
                 predictiveBackAnimatable = {
                     animationCount++
-
-                    TestAnimatable(
-                        initialBackEvent = it,
-                        finish = {
-                            suspendCancellableCoroutine {
-                                // Simulate a long-running animation
-                            }
-                        },
-                    )
+                    TestAnimatable(initialBackEvent = it, finish = suspendForever())
                 },
                 onBack = { stack = stack.dropLast() },
             )
@@ -575,6 +559,69 @@ class PredictiveBackGestureTest {
         assertEquals(stack("1", "2"), stack)
     }
 
+    @Test
+    fun GIVEN_gesture_progressed_WHEN_cancelled_and_back_THEN_gesture_finished_and_stack_popped() {
+        var stack by mutableStateOf(stack("1", "2"))
+
+        val animation =
+            DefaultStackAnimation(
+                predictiveBackAnimatable = { TestAnimatable(initialBackEvent = it, cancel = suspendForever()) },
+                onBack = { stack = stack.dropLast() },
+            )
+
+        composeRule.setContent {
+            animation(stack, Modifier) {
+                Text(text = it.configuration)
+            }
+        }
+
+        backDispatcher.startPredictiveBack(BackEvent(progress = 0F))
+        composeRule.waitForIdle()
+        backDispatcher.progressPredictiveBack(BackEvent(progress = 0.5F))
+        composeRule.waitForIdle()
+
+        backDispatcher.cancelPredictiveBack()
+        backDispatcher.back()
+        composeRule.waitForIdle()
+
+        assertEquals(stack("1"), stack)
+        composeRule.onNodeWithText("1").assertExists()
+        composeRule.onNodeWithText("1").assertTestTagToRootDoesNotExist { it.startsWith(TEST_TAG_PREFIX) }
+        composeRule.onNodeWithText("2").assertDoesNotExist()
+    }
+
+    @Test
+    fun GIVEN_gesture_progressed_WHEN_cancelled_and_restarted_and_back_THEN_gesture_finished_and_stack_popped() {
+        var stack by mutableStateOf(stack("1", "2"))
+
+        val animation =
+            DefaultStackAnimation(
+                predictiveBackAnimatable = { TestAnimatable(initialBackEvent = it, cancel = suspendForever()) },
+                onBack = { stack = stack.dropLast() },
+            )
+
+        composeRule.setContent {
+            animation(stack, Modifier) {
+                Text(text = it.configuration)
+            }
+        }
+
+        backDispatcher.startPredictiveBack(BackEvent(progress = 0F))
+        composeRule.waitForIdle()
+        backDispatcher.progressPredictiveBack(BackEvent(progress = 0.5F))
+        composeRule.waitForIdle()
+
+        backDispatcher.cancelPredictiveBack()
+        backDispatcher.startPredictiveBack(BackEvent(progress = 0F))
+        backDispatcher.back()
+        composeRule.waitForIdle()
+
+        assertEquals(stack("1"), stack)
+        composeRule.onNodeWithText("1").assertExists()
+        composeRule.onNodeWithText("1").assertTestTagToRootDoesNotExist { it.startsWith(TEST_TAG_PREFIX) }
+        composeRule.onNodeWithText("2").assertDoesNotExist()
+    }
+
     private fun DefaultStackAnimation(
         predictiveBackAnimatable: (initialBackEvent: BackEvent) -> PredictiveBackAnimatable? = ::TestAnimatable,
         animator: StackAnimator? = null,
@@ -622,6 +669,7 @@ class PredictiveBackGestureTest {
     private class TestAnimatable(
         initialBackEvent: BackEvent,
         private val finish: suspend () -> Unit = {},
+        private val cancel: suspend () -> Unit = {},
     ) : PredictiveBackAnimatable {
         private var progress by mutableStateOf(initialBackEvent.progress)
 
@@ -639,6 +687,14 @@ class PredictiveBackGestureTest {
 
         override suspend fun cancel() {
             progress = 0F
+            cancel.invoke()
         }
     }
 }
+
+private fun suspendForever(): suspend () -> Unit =
+    {
+        suspendCancellableCoroutine {
+            // no-op
+        }
+    }
```

---

### Incident Patch 9: `237dded4` (2026-06-30)
**Commit Message**: Fixed predictive back gesture not working on OnePlus devices

On some OnePlus devices with Android 14 the predictive back gesture is not working if the app depends on a new version of androidx.activity. The root cause is that those Android versions dispatch onBackStarted when the gesture finger is released. The new versions of OnBackPressedDispatcher now use NavigationEventDispatcher and dispatch onBackCancelled when onBackStarted is received while the back gesture is already in progress.

**File**: `extensions-compose-experimental/api/extensions-compose-experimental.klib.api` (modified, +2/-0)
```diff
@@ -61,6 +61,7 @@ final val com.arkivanov.decompose.extensions.compose.experimental.panels/com_ark
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/LocalStackAnimationProvider // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/LocalStackAnimationProvider|{}LocalStackAnimationProvider[0]
     final fun <get-LocalStackAnimationProvider>(): androidx.compose.runtime/ProvidableCompositionLocal<com.arkivanov.decompose.extensions.compose.experimental.stack.animation/StackAnimationProvider> // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/LocalStackAnimationProvider.<get-LocalStackAnimationProvider>|<get-LocalStackAnimationProvider>(){}[0]
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop[0]
+final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Cancelling$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Cancelling$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Cancelling$stableprop[0]
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Finishing$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Finishing$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Finishing$stableprop[0]
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Idle$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Idle$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Idle$stableprop[0]
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Progress$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Progress$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Progress$stableprop[0]
@@ -82,6 +83,7 @@ final fun <#A: kotlin/Any, #B: kotlin/Any> com.arkivanov.decompose.extensions.co
 final fun com.arkivanov.decompose.extensions.compose.experimental.panels/com_arkivanov_decompose_extensions_compose_experimental_panels_ChildPanelsAnimators$stableprop_getter(): kotlin/Int // com.arkivanov.decompose.extensions.compose.experimental.panels/com_arkivanov_decompose_extensions_compose_experimental_panels_ChildPanelsAnimators$stableprop_getter|com_arkivanov_decompose_extensions_compose_experimental_panels_ChildPanelsAnimators$stableprop_getter(){}[0]
 final fun com.arkivanov.decompose.extensions.compose.experimental.panels/com_arkivanov_decompose_extensions_compose_experimental_panels_HorizontalChildPanelsLayout$stableprop_getter(): kotlin/Int // com.arkivanov.decompose.extensions.compose.experimental.panels/com_arkivanov_decompose_extensions_compose_experimental_panels_HorizontalChildPanelsLayout$stableprop_getter|com_arkivanov_decompose_extensions_compose_experimental_panels_HorizontalChildPanelsLayout$stableprop_getter(){}[0]
 final fun com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop_getter(): kotlin/Int // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop_getter|com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop_getter(){}[0]
+final fun com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompos
```

**File**: `extensions-compose-experimental/src/commonMain/kotlin/com/arkivanov/decompose/extensions/compose/experimental/stack/animation/DefaultStackAnimation.kt` (modified, +65/-26)
```diff
@@ -30,8 +30,10 @@ import com.arkivanov.decompose.router.stack.ChildStack
 import com.arkivanov.essenty.backhandler.BackCallback
 import com.arkivanov.essenty.backhandler.BackEvent
 import kotlinx.coroutines.CoroutineScope
+import kotlinx.coroutines.Job
 import kotlinx.coroutines.cancel
 import kotlinx.coroutines.launch
+import kotlinx.coroutines.plus
 
 @ExperimentalDecomposeApi
 internal class DefaultStackAnimation<C : Any, T : Any>(
@@ -207,7 +209,7 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
             remember {
                 PredictiveBackCallback(
                     stack = stack,
-                    scope = scope,
+                    parentScope = scope,
                     predictiveBackParams = predictiveBackParams,
                     setItems = setItems,
                 )
@@ -240,23 +242,31 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
 
     private inner class PredictiveBackCallback(
         private val stack: ChildStack<C, T>,
-        private val scope: CoroutineScope,
+        private val parentScope: CoroutineScope,
         private val predictiveBackParams: PredictiveBackParams,
         private val setItems: (Map<String, AnimationItem<C, T>>) -> Unit,
     ) : BackCallback() {
         private var state: State = State.Idle
 
         override fun onBackStarted(backEvent: BackEvent) {
-            if (state is State.Idle) {
-                state = State.Started(backEvent)
+            val currentState = state
+            if (currentState is State.Idle) {
+                val childScope = parentScope + Job(parentScope.coroutineContext[Job])
+                state = State.Started(backEvent, childScope)
+            } else if (currentState is State.Cancelling) {
+                currentState.scope.cancel()
+                val newScope = parentScope + Job(parentScope.coroutineContext[Job])
+                state = State.Started(currentState.lastBackEvent, newScope)
+                onBackProgressed(currentState.lastBackEvent)
             }
         }
 
         override fun onBackProgressed(backEvent: BackEvent) {
             startIfNeeded()
             val currentState = state as? State.Progress ?: return
+            currentState.backEvent = backEvent
 
-            scope.launch {
+            currentState.scope.launch {
                 currentState.animationHandler.progress(backEvent)
             }
         }
@@ -265,7 +275,7 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
             val currentState = state as? State.Started ?: return
             val backEvent = currentState.initialBackEvent
             val animationHandler = AnimationHandler(animatable = predictiveBackParams.animatable(backEvent))
-            state = State.Progress(animationHandler)
+            state = State.Progress(animationHandler, currentState.initialBackEvent, currentState.scope)
             val exitChild = stack.active
             val enterChild = stack.backStack.last()
 
@@ -290,49 +300,78 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
                 )
             )
 
-            scope.launch {
+            currentState.scope.launch {
                 animationHandler.progress(backEvent)
             }
         }
 
         override fun onBackCancelled() {
-            val currentState = state
-            if (currentState is State.Progress) {
-                state = State.Finishing
+            when (val currentState = state) {
+                is State.Idle -> Unit // no-op
 
-                scope.launch {
-                    currentState.animationHandler.cancel()
+                is State.Started -> {
+                    currentState.scope.cancel()
                     state = State.Idle
-                    setItems(getAnimationItems(newStack = stack))
                 }
-            } else if (currentState !is State.Finishing) {
-                state = State.Idle
+
+                is State.Progress -> {
+                    state = State.Cancelling(currentState.backEvent, currentState.scope)
+
+                    currentState.scope.launch {
+                        currentState.animationHandler.cancel()
+                        state = State.Idle
+                        setItems(getAnimationItems(newStack = stack))
+                        currentState.scope.cancel()
+                    }
+                }
+
+                is State.Finishing -> Unit // no-op
+                is State.Cancelling -> Unit // no-op
             }
         }
 
         override fun onBack() {
-            val currentState = state
-            if (currentState is State.Progress) {
-                state = State.Finishing
+            when (val currentState = state) {
+                is State.Idle -> {
+                    predictiveBackParams.onBack()
+                }
+
+                is State.Started -> {
+                    currentState.scope.cancel()
+                    state = State.Idle
+                    predictiveBackPara
```

**File**: `extensions-compose-experimental/src/jvmTest/kotlin/com/arkivanov/decompose/extensions/compose/experimental/stack/animation/PredictiveBackGestureTest.kt` (modified, +74/-18)
```diff
@@ -502,15 +502,7 @@ class PredictiveBackGestureTest {
             DefaultStackAnimation(
                 predictiveBackAnimatable = {
                     animationCount++
-
-                    TestAnimatable(
-                        initialBackEvent = it,
-                        finish = {
-                            suspendCancellableCoroutine {
-                                // Simulate a long-running animation
-                            }
-                        },
-                    )
+                    TestAnimatable(initialBackEvent = it, finish = suspendForever())
                 },
                 onBack = { stack = stack.dropLast() },
             )
@@ -544,15 +536,7 @@ class PredictiveBackGestureTest {
             DefaultStackAnimation(
                 predictiveBackAnimatable = {
                     animationCount++
-
-                    TestAnimatable(
-                        initialBackEvent = it,
-                        finish = {
-                            suspendCancellableCoroutine {
-                                // Simulate a long-running animation
-                            }
-                        },
-                    )
+                    TestAnimatable(initialBackEvent = it, finish = suspendForever())
                 },
                 onBack = { stack = stack.dropLast() },
             )
@@ -575,6 +559,69 @@ class PredictiveBackGestureTest {
         assertEquals(stack("1", "2"), stack)
     }
 
+    @Test
+    fun GIVEN_gesture_progressed_WHEN_cancelled_and_back_THEN_gesture_finished_and_stack_popped() {
+        var stack by mutableStateOf(stack("1", "2"))
+
+        val animation =
+            DefaultStackAnimation(
+                predictiveBackAnimatable = { TestAnimatable(initialBackEvent = it, cancel = suspendForever()) },
+                onBack = { stack = stack.dropLast() },
+            )
+
+        composeRule.setContent {
+            animation(stack, Modifier) {
+                Text(text = it.configuration)
+            }
+        }
+
+        backDispatcher.startPredictiveBack(BackEvent(progress = 0F))
+        composeRule.waitForIdle()
+        backDispatcher.progressPredictiveBack(BackEvent(progress = 0.5F))
+        composeRule.waitForIdle()
+
+        backDispatcher.cancelPredictiveBack()
+        backDispatcher.back()
+        composeRule.waitForIdle()
+
+        assertEquals(stack("1"), stack)
+        composeRule.onNodeWithText("1").assertExists()
+        composeRule.onNodeWithText("1").assertTestTagToRootDoesNotExist { it.startsWith(TEST_TAG_PREFIX) }
+        composeRule.onNodeWithText("2").assertDoesNotExist()
+    }
+
+    @Test
+    fun GIVEN_gesture_progressed_WHEN_cancelled_and_restarted_and_back_THEN_gesture_finished_and_stack_popped() {
+        var stack by mutableStateOf(stack("1", "2"))
+
+        val animation =
+            DefaultStackAnimation(
+                predictiveBackAnimatable = { TestAnimatable(initialBackEvent = it, cancel = suspendForever()) },
+                onBack = { stack = stack.dropLast() },
+            )
+
+        composeRule.setContent {
+            animation(stack, Modifier) {
+                Text(text = it.configuration)
+            }
+        }
+
+        backDispatcher.startPredictiveBack(BackEvent(progress = 0F))
+        composeRule.waitForIdle()
+        backDispatcher.progressPredictiveBack(BackEvent(progress = 0.5F))
+        composeRule.waitForIdle()
+
+        backDispatcher.cancelPredictiveBack()
+        backDispatcher.startPredictiveBack(BackEvent(progress = 0F))
+        backDispatcher.back()
+        composeRule.waitForIdle()
+
+        assertEquals(stack("1"), stack)
+        composeRule.onNodeWithText("1").assertExists()
+        composeRule.onNodeWithText("1").assertTestTagToRootDoesNotExist { it.startsWith(TEST_TAG_PREFIX) }
+        composeRule.onNodeWithText("2").assertDoesNotExist()
+    }
+
     private fun DefaultStackAnimation(
         predictiveBackAnimatable: (initialBackEvent: BackEvent) -> PredictiveBackAnimatable? = ::TestAnimatable,
         animator: StackAnimator? = null,
@@ -622,6 +669,7 @@ class PredictiveBackGestureTest {
     private class TestAnimatable(
         initialBackEvent: BackEvent,
         private val finish: suspend () -> Unit = {},
+        private val cancel: suspend () -> Unit = {},
     ) : PredictiveBackAnimatable {
         private var progress by mutableStateOf(initialBackEvent.progress)
 
@@ -639,6 +687,14 @@ class PredictiveBackGestureTest {
 
         override suspend fun cancel() {
             progress = 0F
+            cancel.invoke()
         }
     }
 }
+
+private fun suspendForever(): suspend () -> Unit =
+    {
+        suspendCancellableCoroutine {
+            // no-op
+        }
+    }
```

---

### Incident Patch 10: `cfb81e4c` (2026-04-28)
**Commit Message**: Build iOS samples against arm64 on CI

**File**: `.github/workflows/build.yml` (modified, +2/-2)
```diff
@@ -42,6 +42,6 @@ jobs:
         with:
           arguments: build -Dsplit_targets
       - name: Build iOS sample
-        run: xcodebuild -project sample/app-ios/app-ios.xcodeproj -scheme app-ios -sdk iphonesimulator -arch x86_64 build
+        run: xcodebuild -project sample/app-ios/app-ios.xcodeproj -scheme app-ios -sdk iphonesimulator -arch arm64 build
       - name: Build iOS Compose sample
-        run: xcodebuild -project sample/app-ios-compose/app-ios-compose.xcodeproj -scheme app-ios-compose -sdk iphonesimulator -arch x86_64 build
+        run: xcodebuild -project sample/app-ios-compose/app-ios-compose.xcodeproj -scheme app-ios-compose -sdk iphonesimulator -arch arm64 build
```

---

### Incident Patch 11: `e2b57258` (2026-04-24)
**Commit Message**: Merge pull request #988 from arkivanov/fixed-back-gesture-repeat

Fixed the same predictive back gesture animation repeating when quickly started again

**File**: `extensions-compose-experimental/api/extensions-compose-experimental.klib.api` (modified, +8/-0)
```diff
@@ -61,6 +61,10 @@ final val com.arkivanov.decompose.extensions.compose.experimental.panels/com_ark
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/LocalStackAnimationProvider // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/LocalStackAnimationProvider|{}LocalStackAnimationProvider[0]
     final fun <get-LocalStackAnimationProvider>(): androidx.compose.runtime/ProvidableCompositionLocal<com.arkivanov.decompose.extensions.compose.experimental.stack.animation/StackAnimationProvider> // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/LocalStackAnimationProvider.<get-LocalStackAnimationProvider>|<get-LocalStackAnimationProvider>(){}[0]
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop[0]
+final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Finishing$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Finishing$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Finishing$stableprop[0]
+final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Idle$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Idle$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Idle$stableprop[0]
+final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Progress$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Progress$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Progress$stableprop[0]
+final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Started$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Started$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Started$stableprop[0]
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimator$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimator$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimator$stableprop[0]
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_PredictiveBackParams$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_PredictiveBackParams$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_PredictiveBackParams$stableprop[0]
 final val com.arkivanov.decompose.extensions.compose.experimental/com_arkivanov_decompose_extensions_compose_experimental_BroadcastBackHandler$stableprop // com.arkivanov.decompose.extensions.compose.experimental/com_arkivanov_decompose_extensions_compose_experimental_BroadcastBackHandler$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_BroadcastBackHandler$stableprop[0]
@@ -78,6 +82,10 @@ final fun <#A: kotlin/Any, #B: kotlin/Any> com.arkivanov.decompose.extensions.co
 final fun com.arkivanov.decompose.extensions.compose.experimental.panels/com_arkivanov_decompose_extensions_compose_experimental_panels_ChildPanelsAnimators$stableprop_getter(): kotlin/Int // com.arkivanov.decompose
```

**File**: `extensions-compose-experimental/src/commonMain/kotlin/com/arkivanov/decompose/extensions/compose/experimental/stack/animation/DefaultStackAnimation.kt` (modified, +38/-24)
```diff
@@ -53,7 +53,7 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
     ) {
         var currentStack by remember { mutableStateOf(stack) }
         var items by remember { mutableStateOf(getAnimationItems(newStack = currentStack)) }
-        var nextItems: Map<Any, AnimationItem<C, T>>? by remember { mutableStateOf(null) }
+        var nextItems: Map<String, AnimationItem<C, T>>? by remember { mutableStateOf(null) }
         val stackKeys = remember(stack) { stack.items.map { it.key } }
         val currentStackKeys = remember(currentStack) { currentStack.items.map { it.key } }
 
@@ -150,7 +150,7 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
         }
     }
 
-    private fun getAnimationItems(newStack: ChildStack<C, T>, oldStack: ChildStack<C, T>? = null): Map<Any, AnimationItem<C, T>> =
+    private fun getAnimationItems(newStack: ChildStack<C, T>, oldStack: ChildStack<C, T>? = null): Map<String, AnimationItem<C, T>> =
         when {
             (oldStack == null) || (newStack.active.key == oldStack.active.key) ->
                 keyedItemsOf(
@@ -199,7 +199,7 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
     private fun PredictiveBackController(
         stack: ChildStack<C, T>,
         predictiveBackParams: PredictiveBackParams,
-        setItems: (Map<Any, AnimationItem<C, T>>) -> Unit,
+        setItems: (Map<String, AnimationItem<C, T>>) -> Unit,
     ) {
         val scope = rememberCoroutineScope()
 
@@ -242,29 +242,30 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
         private val stack: ChildStack<C, T>,
         private val scope: CoroutineScope,
         private val predictiveBackParams: PredictiveBackParams,
-        private val setItems: (Map<Any, AnimationItem<C, T>>) -> Unit,
+        private val setItems: (Map<String, AnimationItem<C, T>>) -> Unit,
     ) : BackCallback() {
-        private var animationHandler: AnimationHandler? = null
-        private var initialBackEvent: BackEvent? = null
+        private var state: State = State.Idle
 
         override fun onBackStarted(backEvent: BackEvent) {
-            initialBackEvent = backEvent
+            if (state is State.Idle) {
+                state = State.Started(backEvent)
+            }
         }
 
         override fun onBackProgressed(backEvent: BackEvent) {
             startIfNeeded()
+            val currentState = state as? State.Progress ?: return
 
             scope.launch {
-                animationHandler?.progress(backEvent)
+                currentState.animationHandler.progress(backEvent)
             }
         }
 
         private fun startIfNeeded() {
-            val backEvent = initialBackEvent ?: return
-            initialBackEvent = null
-
+            val currentState = state as? State.Started ?: return
+            val backEvent = currentState.initialBackEvent
             val animationHandler = AnimationHandler(animatable = predictiveBackParams.animatable(backEvent))
-            this.animationHandler = animationHandler
+            state = State.Progress(animationHandler)
             val exitChild = stack.active
             val enterChild = stack.backStack.last()
 
@@ -295,32 +296,45 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
         }
 
         override fun onBackCancelled() {
-            initialBackEvent = null
+            val currentState = state
+            if (currentState is State.Progress) {
+                state = State.Finishing
 
-            scope.launch {
-                animationHandler?.also { handler ->
-                    handler.cancel()
-                    animationHandler = null
+                scope.launch {
+                    currentState.animationHandler.cancel()
+                    state = State.Idle
                     setItems(getAnimationItems(newStack = stack))
                 }
+            } else if (currentState !is State.Finishing) {
+                state = State.Idle
             }
         }
 
         override fun onBack() {
-            initialBackEvent = null
+            val currentState = state
+            if (currentState is State.Progress) {
+                state = State.Finishing
 
-            scope.launch {
-                animationHandler?.also { handler ->
-                    handler.finish()
-                    animationHandler = null
+                scope.launch {
+                    currentState.animationHandler.finish()
+                    state = State.Idle
                     setItems(getAnimationItems(newStack = stack.dropLast()))
+                    predictiveBackParams.onBack()
                 }
-
+            } else if (currentState !is State.Finishing) {
+                state = State.Idle
                 predictiveBackParams.onBack()
             }
         }
     }
 
+    private sealed interface State {
+        data object Idle : State
+        data class Started(val initialBackEvent: BackEvent) : State
+        data class Progress(val animation
```

**File**: `extensions-compose-experimental/src/jvmTest/kotlin/com/arkivanov/decompose/extensions/compose/experimental/stack/animation/PredictiveBackGestureTest.kt` (modified, +86/-1)
```diff
@@ -20,6 +20,7 @@ import com.arkivanov.decompose.extensions.compose.stack.animation.predictiveback
 import com.arkivanov.decompose.router.stack.ChildStack
 import com.arkivanov.essenty.backhandler.BackDispatcher
 import com.arkivanov.essenty.backhandler.BackEvent
+import kotlinx.coroutines.suspendCancellableCoroutine
 import org.junit.Rule
 import kotlin.test.Test
 import kotlin.test.assertEquals
@@ -216,7 +217,7 @@ class PredictiveBackGestureTest {
     @Test
     fun GIVEN_gesture_started_WHEN_stack_popped_THEN_gesture_cancelled() {
         var stack by mutableStateOf(stack("1", "2"))
-        val animation = DefaultStackAnimation(animator = fade(), onBack = { stack = stack.dropLast() },)
+        val animation = DefaultStackAnimation(animator = fade(), onBack = { stack = stack.dropLast() })
 
         composeRule.setContent {
             animation(stack, Modifier) {
@@ -492,6 +493,88 @@ class PredictiveBackGestureTest {
         assertEquals(0.7F, values["2"])
     }
 
+    @Test
+    fun GIVEN_gesture_finishing_WHEN_new_gesture_started_THEN_new_animation_not_started() {
+        var stack by mutableStateOf(stack("1", "2"))
+        var animationCount = 0
+
+        val animation =
+            DefaultStackAnimation(
+                predictiveBackAnimatable = {
+                    animationCount++
+
+                    TestAnimatable(
+                        initialBackEvent = it,
+                        finish = {
+                            suspendCancellableCoroutine {
+                                // Simulate a long-running animation
+                            }
+                        },
+                    )
+                },
+                onBack = { stack = stack.dropLast() },
+            )
+
+        composeRule.setContent {
+            animation(stack, Modifier) {
+                Text(text = it.configuration)
+            }
+        }
+
+        backDispatcher.startPredictiveBack(BackEvent(progress = 0F))
+        composeRule.waitForIdle()
+        backDispatcher.progressPredictiveBack(BackEvent(progress = 0.5F))
+        composeRule.waitForIdle()
+        backDispatcher.back()
+        composeRule.waitForIdle()
+        backDispatcher.startPredictiveBack(BackEvent(progress = 0F))
+        composeRule.waitForIdle()
+        backDispatcher.progressPredictiveBack(BackEvent(progress = 0.5F))
+        composeRule.waitForIdle()
+
+        assertEquals(1, animationCount)
+    }
+
+    @Test
+    fun GIVEN_gesture_finishing_WHEN_back_THEN_stack_not_popped() {
+        var stack by mutableStateOf(stack("1", "2"))
+        var animationCount = 0
+
+        val animation =
+            DefaultStackAnimation(
+                predictiveBackAnimatable = {
+                    animationCount++
+
+                    TestAnimatable(
+                        initialBackEvent = it,
+                        finish = {
+                            suspendCancellableCoroutine {
+                                // Simulate a long-running animation
+                            }
+                        },
+                    )
+                },
+                onBack = { stack = stack.dropLast() },
+            )
+
+        composeRule.setContent {
+            animation(stack, Modifier) {
+                Text(text = it.configuration)
+            }
+        }
+
+        backDispatcher.startPredictiveBack(BackEvent(progress = 0F))
+        composeRule.waitForIdle()
+        backDispatcher.progressPredictiveBack(BackEvent(progress = 0.5F))
+        composeRule.waitForIdle()
+        backDispatcher.back()
+        composeRule.waitForIdle()
+        backDispatcher.back()
+        composeRule.waitForIdle()
+
+        assertEquals(stack("1", "2"), stack)
+    }
+
     private fun DefaultStackAnimation(
         predictiveBackAnimatable: (initialBackEvent: BackEvent) -> PredictiveBackAnimatable? = ::TestAnimatable,
         animator: StackAnimator? = null,
@@ -538,6 +621,7 @@ class PredictiveBackGestureTest {
 
     private class TestAnimatable(
         initialBackEvent: BackEvent,
+        private val finish: suspend () -> Unit = {},
     ) : PredictiveBackAnimatable {
         private var progress by mutableStateOf(initialBackEvent.progress)
 
@@ -550,6 +634,7 @@ class PredictiveBackGestureTest {
 
         override suspend fun finish() {
             progress = 1F
+            finish.invoke()
         }
 
         override suspend fun cancel() {
```

---

### Incident Patch 12: `efaa7bbd` (2026-03-18)
**Commit Message**: Fixed the same predictive back gesture animation repeating when quickly started again

If you start a new predictive back gesture before the current gesture is fully finished, the same animation is started again. Instead, it should do nothing and allow the current animation to finish.

**File**: `extensions-compose-experimental/api/extensions-compose-experimental.klib.api` (modified, +8/-0)
```diff
@@ -61,6 +61,10 @@ final val com.arkivanov.decompose.extensions.compose.experimental.panels/com_ark
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/LocalStackAnimationProvider // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/LocalStackAnimationProvider|{}LocalStackAnimationProvider[0]
     final fun <get-LocalStackAnimationProvider>(): androidx.compose.runtime/ProvidableCompositionLocal<com.arkivanov.decompose.extensions.compose.experimental.stack.animation/StackAnimationProvider> // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/LocalStackAnimationProvider.<get-LocalStackAnimationProvider>|<get-LocalStackAnimationProvider>(){}[0]
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop[0]
+final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Finishing$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Finishing$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Finishing$stableprop[0]
+final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Idle$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Idle$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Idle$stableprop[0]
+final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Progress$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Progress$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Progress$stableprop[0]
+final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Started$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Started$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Started$stableprop[0]
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimator$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimator$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimator$stableprop[0]
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_PredictiveBackParams$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_PredictiveBackParams$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_PredictiveBackParams$stableprop[0]
 final val com.arkivanov.decompose.extensions.compose.experimental/com_arkivanov_decompose_extensions_compose_experimental_BroadcastBackHandler$stableprop // com.arkivanov.decompose.extensions.compose.experimental/com_arkivanov_decompose_extensions_compose_experimental_BroadcastBackHandler$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_BroadcastBackHandler$stableprop[0]
@@ -78,6 +82,10 @@ final fun <#A: kotlin/Any, #B: kotlin/Any> com.arkivanov.decompose.extensions.co
 final fun com.arkivanov.decompose.extensions.compose.experimental.panels/com_arkivanov_decompose_extensions_compose_experimental_panels_ChildPanelsAnimators$stableprop_getter(): kotlin/Int // com.arkivanov.decompose
```

**File**: `extensions-compose-experimental/src/commonMain/kotlin/com/arkivanov/decompose/extensions/compose/experimental/stack/animation/DefaultStackAnimation.kt` (modified, +38/-24)
```diff
@@ -53,7 +53,7 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
     ) {
         var currentStack by remember { mutableStateOf(stack) }
         var items by remember { mutableStateOf(getAnimationItems(newStack = currentStack)) }
-        var nextItems: Map<Any, AnimationItem<C, T>>? by remember { mutableStateOf(null) }
+        var nextItems: Map<String, AnimationItem<C, T>>? by remember { mutableStateOf(null) }
         val stackKeys = remember(stack) { stack.items.map { it.key } }
         val currentStackKeys = remember(currentStack) { currentStack.items.map { it.key } }
 
@@ -150,7 +150,7 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
         }
     }
 
-    private fun getAnimationItems(newStack: ChildStack<C, T>, oldStack: ChildStack<C, T>? = null): Map<Any, AnimationItem<C, T>> =
+    private fun getAnimationItems(newStack: ChildStack<C, T>, oldStack: ChildStack<C, T>? = null): Map<String, AnimationItem<C, T>> =
         when {
             (oldStack == null) || (newStack.active.key == oldStack.active.key) ->
                 keyedItemsOf(
@@ -199,7 +199,7 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
     private fun PredictiveBackController(
         stack: ChildStack<C, T>,
         predictiveBackParams: PredictiveBackParams,
-        setItems: (Map<Any, AnimationItem<C, T>>) -> Unit,
+        setItems: (Map<String, AnimationItem<C, T>>) -> Unit,
     ) {
         val scope = rememberCoroutineScope()
 
@@ -242,29 +242,30 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
         private val stack: ChildStack<C, T>,
         private val scope: CoroutineScope,
         private val predictiveBackParams: PredictiveBackParams,
-        private val setItems: (Map<Any, AnimationItem<C, T>>) -> Unit,
+        private val setItems: (Map<String, AnimationItem<C, T>>) -> Unit,
     ) : BackCallback() {
-        private var animationHandler: AnimationHandler? = null
-        private var initialBackEvent: BackEvent? = null
+        private var state: State = State.Idle
 
         override fun onBackStarted(backEvent: BackEvent) {
-            initialBackEvent = backEvent
+            if (state is State.Idle) {
+                state = State.Started(backEvent)
+            }
         }
 
         override fun onBackProgressed(backEvent: BackEvent) {
             startIfNeeded()
+            val currentState = state as? State.Progress ?: return
 
             scope.launch {
-                animationHandler?.progress(backEvent)
+                currentState.animationHandler.progress(backEvent)
             }
         }
 
         private fun startIfNeeded() {
-            val backEvent = initialBackEvent ?: return
-            initialBackEvent = null
-
+            val currentState = state as? State.Started ?: return
+            val backEvent = currentState.initialBackEvent
             val animationHandler = AnimationHandler(animatable = predictiveBackParams.animatable(backEvent))
-            this.animationHandler = animationHandler
+            state = State.Progress(animationHandler)
             val exitChild = stack.active
             val enterChild = stack.backStack.last()
 
@@ -295,32 +296,45 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
         }
 
         override fun onBackCancelled() {
-            initialBackEvent = null
+            val currentState = state
+            if (currentState is State.Progress) {
+                state = State.Finishing
 
-            scope.launch {
-                animationHandler?.also { handler ->
-                    handler.cancel()
-                    animationHandler = null
+                scope.launch {
+                    currentState.animationHandler.cancel()
+                    state = State.Idle
                     setItems(getAnimationItems(newStack = stack))
                 }
+            } else if (currentState !is State.Finishing) {
+                state = State.Idle
             }
         }
 
         override fun onBack() {
-            initialBackEvent = null
+            val currentState = state
+            if (currentState is State.Progress) {
+                state = State.Finishing
 
-            scope.launch {
-                animationHandler?.also { handler ->
-                    handler.finish()
-                    animationHandler = null
+                scope.launch {
+                    currentState.animationHandler.finish()
+                    state = State.Idle
                     setItems(getAnimationItems(newStack = stack.dropLast()))
+                    predictiveBackParams.onBack()
                 }
-
+            } else if (currentState !is State.Finishing) {
+                state = State.Idle
                 predictiveBackParams.onBack()
             }
         }
     }
 
+    private sealed interface State {
+        data object Idle : State
+        data class Started(val initialBackEvent: BackEvent) : State
+        data class Progress(val animation
```

**File**: `extensions-compose-experimental/src/jvmTest/kotlin/com/arkivanov/decompose/extensions/compose/experimental/stack/animation/PredictiveBackGestureTest.kt` (modified, +86/-1)
```diff
@@ -20,6 +20,7 @@ import com.arkivanov.decompose.extensions.compose.stack.animation.predictiveback
 import com.arkivanov.decompose.router.stack.ChildStack
 import com.arkivanov.essenty.backhandler.BackDispatcher
 import com.arkivanov.essenty.backhandler.BackEvent
+import kotlinx.coroutines.suspendCancellableCoroutine
 import org.junit.Rule
 import kotlin.test.Test
 import kotlin.test.assertEquals
@@ -216,7 +217,7 @@ class PredictiveBackGestureTest {
     @Test
     fun GIVEN_gesture_started_WHEN_stack_popped_THEN_gesture_cancelled() {
         var stack by mutableStateOf(stack("1", "2"))
-        val animation = DefaultStackAnimation(animator = fade(), onBack = { stack = stack.dropLast() },)
+        val animation = DefaultStackAnimation(animator = fade(), onBack = { stack = stack.dropLast() })
 
         composeRule.setContent {
             animation(stack, Modifier) {
@@ -492,6 +493,88 @@ class PredictiveBackGestureTest {
         assertEquals(0.7F, values["2"])
     }
 
+    @Test
+    fun GIVEN_gesture_finishing_WHEN_new_gesture_started_THEN_new_animation_not_started() {
+        var stack by mutableStateOf(stack("1", "2"))
+        var animationCount = 0
+
+        val animation =
+            DefaultStackAnimation(
+                predictiveBackAnimatable = {
+                    animationCount++
+
+                    TestAnimatable(
+                        initialBackEvent = it,
+                        finish = {
+                            suspendCancellableCoroutine {
+                                // Simulate a long-running animation
+                            }
+                        },
+                    )
+                },
+                onBack = { stack = stack.dropLast() },
+            )
+
+        composeRule.setContent {
+            animation(stack, Modifier) {
+                Text(text = it.configuration)
+            }
+        }
+
+        backDispatcher.startPredictiveBack(BackEvent(progress = 0F))
+        composeRule.waitForIdle()
+        backDispatcher.progressPredictiveBack(BackEvent(progress = 0.5F))
+        composeRule.waitForIdle()
+        backDispatcher.back()
+        composeRule.waitForIdle()
+        backDispatcher.startPredictiveBack(BackEvent(progress = 0F))
+        composeRule.waitForIdle()
+        backDispatcher.progressPredictiveBack(BackEvent(progress = 0.5F))
+        composeRule.waitForIdle()
+
+        assertEquals(1, animationCount)
+    }
+
+    @Test
+    fun GIVEN_gesture_finishing_WHEN_back_THEN_stack_not_popped() {
+        var stack by mutableStateOf(stack("1", "2"))
+        var animationCount = 0
+
+        val animation =
+            DefaultStackAnimation(
+                predictiveBackAnimatable = {
+                    animationCount++
+
+                    TestAnimatable(
+                        initialBackEvent = it,
+                        finish = {
+                            suspendCancellableCoroutine {
+                                // Simulate a long-running animation
+                            }
+                        },
+                    )
+                },
+                onBack = { stack = stack.dropLast() },
+            )
+
+        composeRule.setContent {
+            animation(stack, Modifier) {
+                Text(text = it.configuration)
+            }
+        }
+
+        backDispatcher.startPredictiveBack(BackEvent(progress = 0F))
+        composeRule.waitForIdle()
+        backDispatcher.progressPredictiveBack(BackEvent(progress = 0.5F))
+        composeRule.waitForIdle()
+        backDispatcher.back()
+        composeRule.waitForIdle()
+        backDispatcher.back()
+        composeRule.waitForIdle()
+
+        assertEquals(stack("1", "2"), stack)
+    }
+
     private fun DefaultStackAnimation(
         predictiveBackAnimatable: (initialBackEvent: BackEvent) -> PredictiveBackAnimatable? = ::TestAnimatable,
         animator: StackAnimator? = null,
@@ -538,6 +621,7 @@ class PredictiveBackGestureTest {
 
     private class TestAnimatable(
         initialBackEvent: BackEvent,
+        private val finish: suspend () -> Unit = {},
     ) : PredictiveBackAnimatable {
         private var progress by mutableStateOf(initialBackEvent.progress)
 
@@ -550,6 +634,7 @@ class PredictiveBackGestureTest {
 
         override suspend fun finish() {
             progress = 1F
+            finish.invoke()
         }
 
         override suspend fun cancel() {
```

---

### Incident Patch 13: `5c4540eb` (2026-04-17)
**Commit Message**: Add KMP - NavBuilder project details to community.md

Added information about KMP - NavBuilder, including its functionality and author.

**File**: `docs/community.md` (modified, +8/-0)
```diff
@@ -1,5 +1,13 @@
 This page contains links to various useful projects related to Decompose and maintained by the community.
 
+### KMP - NavBuilder
+
+A Kotlin Multiplatform annotation processing library that generates type-safe navigation infrastructure at compile time. Built on top of Decompose and KSP, KMP-NavBuilder eliminates navigation boilerplate by generating configs, factories, and composable renderers from simple annotations.
+
+Link: [github.com/neilSayok/kmp-navbuilder](https://github.com/neilSayok/kmp-navbuilder)
+
+Author: [@neilSayok](https://github.com/neilSayok)
+
 ### Decompose-Router
 
 A Compose-multiplatform navigation library that leverage Decompose to create an API inspired by [Conductor](https://github.com/bluelinelabs/Conductor).
```

---

### Incident Patch 14: `1fc0fa12` (2026-03-25)
**Commit Message**: Revert "Added reverseDirection parameter to slide animator"

This reverts commit 7235532a

**File**: `extensions-compose-experimental/src/commonMain/kotlin/com/arkivanov/decompose/extensions/compose/experimental/stack/animation/Slide.kt` (modified, +6/-9)
```diff
@@ -14,31 +14,28 @@ import com.arkivanov.decompose.ExperimentalDecomposeApi
 fun slide(
     animationSpec: FiniteAnimationSpec<Float> = tween(),
     orientation: Orientation = Orientation.Horizontal,
-    reverseDirection: Boolean = false,
 ): StackAnimator =
     stackAnimator(animationSpec = animationSpec) { factor, _ ->
         when (orientation) {
-            Orientation.Horizontal -> Modifier.offsetXFactor(factor = factor, reverseDirection = reverseDirection)
-            Orientation.Vertical -> Modifier.offsetYFactor(factor = factor, reverseDirection = reverseDirection)
+            Orientation.Horizontal -> Modifier.offsetXFactor(factor)
+            Orientation.Vertical -> Modifier.offsetYFactor(factor)
         }
     }
 
-private fun Modifier.offsetXFactor(factor: Float, reverseDirection: Boolean): Modifier =
+private fun Modifier.offsetXFactor(factor: Float): Modifier =
     layout { measurable, constraints ->
         val placeable = measurable.measure(constraints)
 
         layout(placeable.width, placeable.height) {
-            val x = placeable.width.toFloat() * if (reverseDirection) -factor else factor
-            placeable.placeRelative(x = x.toInt(), y = 0)
+            placeable.placeRelative(x = (placeable.width.toFloat() * factor).toInt(), y = 0)
         }
     }
 
-private fun Modifier.offsetYFactor(factor: Float, reverseDirection: Boolean): Modifier =
+private fun Modifier.offsetYFactor(factor: Float): Modifier =
     layout { measurable, constraints ->
         val placeable = measurable.measure(constraints)
 
         layout(placeable.width, placeable.height) {
-            val y = placeable.height.toFloat() * if (reverseDirection) -factor else factor
-            placeable.placeRelative(x = 0, y = y.toInt())
+            placeable.placeRelative(x = 0, y = (placeable.height.toFloat() * factor).toInt())
         }
     }
```

---

### Incident Patch 15: `7e136b22` (2026-03-24)
**Commit Message**: Fixed formatting in Slide

**File**: `extensions-compose-experimental/src/commonMain/kotlin/com/arkivanov/decompose/extensions/compose/experimental/stack/animation/Slide.kt` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ fun slide(
     animationSpec: FiniteAnimationSpec<Float> = tween(),
     orientation: Orientation = Orientation.Horizontal,
     reverseDirection: Boolean = false,
-    ): StackAnimator =
+): StackAnimator =
     stackAnimator(animationSpec = animationSpec) { factor, _ ->
         when (orientation) {
             Orientation.Horizontal -> Modifier.offsetXFactor(factor = factor, reverseDirection = reverseDirection)
```

#### Recent Merged Pull Requests:
- **PR #1034** (2026-10-03): [V4] Update v4 branch (@arkivanov)
- **PR #1031** (2026-10-03): Fix wrong directions in AndroidPredictiveBackAnimatableV2 in RTL layout (@arkivanov)
- **PR #1030** (2026-10-03): Fix wrong directions in AndroidPredictiveBackAnimatableV1 in RTL layout (@arkivanov)
- **PR #1029** (2026-09-28): [V4] Update v4 branch (@arkivanov)
- **PR #1028** (2026-09-28): Add linuxX64 and linuxArm64 targets (@arkivanov-bot)
- **PR #1027** (2026-09-27): [V4] Update v4 branch (@arkivanov)
- **PR #1026** (2026-09-27): Use TestComponentContext instead of DefaultComponentContext in tests (@arkivanov)
- **PR #1025** (2026-09-27): [V4] Update v4 branch (@arkivanov)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
