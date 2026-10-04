# Forensic Learning Record (Deep Inspection): icerockdev/moko-mvvm

> **Canonical Artifact**: `07_PROJECT_LEARNING/icerockdev-moko-mvvm-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/icerockdev/moko-mvvm](https://github.com/icerockdev/moko-mvvm))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:24:27.597Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `icerockdev/moko-mvvm`
- **Description**: Model-View-ViewModel architecture components for mobile (android & ios) Kotlin Multiplatform development
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1096 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `mvvm-core/src/androidMain/kotlin/dev/icerock/moko/mvvm/ViewModelFactory.kt`
```
/*
 * Copyright 2019 IceRock MAG Inc. Use of this source code is governed by the Apache 2.0 license.
 */

package dev.icerock.moko.mvvm

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.viewmodel.CreationExtras
import kotlin.reflect.KClass

class ViewModelFactory(
    private val viewModelBlock: () -> ViewModel
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>, extras: CreationExtras): T {
        @Suppress("UNCHECKED_CAST")
        return viewModelBlock() as T
    }
}

fun <T : ViewModel> ViewModelStoreOwner.getViewModel(
    klass: KClass<T>,
    viewModelBlock: () -> T
): T = ViewModelProvider(
    owner = this,
    factory = ViewModelFactory(viewModelBlock)
)[klass.java]

fun <T : ViewModel> ViewModelStoreOwner.getViewModel(
    key: String,
    klass: KClass<T>,
    viewModelBlock: () -> T
): T = ViewModelProvider(
    owner = this,
    factory = ViewModelFactory(viewModelBlock)
).get(key = key, klass.java)

inline fun <reified T : ViewModel> ViewModelStoreOwner.getViewModel(
    key: String,
    noinline viewModelBlock: () -> T
): T = getViewModel(key, T::class, viewModelBlock)

inline fun <reified T : ViewModel> ViewModelStoreOwner.getViewModel(
    noinline viewModelBlock: () -> T
): T = getViewModel(T::class, viewModelBlock)

inline fun <reified T : ViewModel> createViewModelFactory(
    noinline viewModelBlock: () -> T
): ViewModelFactory = ViewModelFactory(viewModelBlock)

```

### Core Architecture Module: `mvvm-core/src/androidMain/kotlin/dev/icerock/moko/mvvm/dispatcher/EventsDispatcher.kt`
```
/*
 * Copyright 2019 IceRock MAG Inc. Use of this source code is governed by the Apache 2.0 license.
 */

package dev.icerock.moko.mvvm.dispatcher

import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.OnLifecycleEvent
import java.util.concurrent.Executor

actual class EventsDispatcher<ListenerType : Any> {
    private var eventsListener: ListenerType? = null
    private val blocks = mutableListOf<ListenerType.() -> Unit>()
    private val executor: Executor

    actual constructor() {
        this.executor = createExecutorOnMainLooper()
    }

    constructor(executor: Executor) {
        this.executor = executor
    }

    /**
     * Constructor without lifecycle connection. Used for tests
     */
    constructor(executor: Executor, listener: ListenerType) {
        this.executor = executor
        this.eventsListener = listener
    }

    fun bind(lifecycleOwner: LifecycleOwner, listener: ListenerType) {
        val observer = object : LifecycleObserver {

            @OnLifecycleEvent(Lifecycle.Event.ON_RESUME)
            fun connectListener() {
                eventsListener = listener
                executor.execute {
                    blocks.forEach { it(listener) }
                    blocks.clear()
                }
            }

            @OnLifecycleEvent(Lifecycle.Event.ON_PAUSE)
            fun disconnectListener() {
                eventsListener = null
            }

            @OnLifecycleEvent(Lifecycle.Event.ON_DESTROY)
            fun onDestroyed(source: LifecycleOwner) {
                source.lifecycle.removeObserver(this)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
    }

    actual fun dispatchEvent(block: ListenerType.() -> Unit) {
        val eListener = eventsListener
        if (eListener != null) {
            executor.execute { block(eListener) }
        } else {
            executor.execute { blocks.add(block) }
        }
    }
}

```

### Core Architecture Module: `mvvm-core/src/androidMain/kotlin/dev/icerock/moko/mvvm/dispatcher/EventsDispatcherExt.kt`
```
/*
 * Copyright 2019 IceRock MAG Inc. Use of this source code is governed by the Apache 2.0 license.
 */

package dev.icerock.moko.mvvm.dispatcher

import android.os.Handler
import android.os.Looper
import java.util.concurrent.Executor

fun createExecutorOnMainLooper(): Executor {
    val mainLooper = Looper.getMainLooper()
    val mainHandler = Handler(mainLooper)
    return Executor { mainHandler.post(it) }
}

inline fun <reified T : Any> eventsDispatcherOnMain(): EventsDispatcher<T> {
    return EventsDispatcher(createExecutorOnMainLooper())
}

```

### Core Architecture Module: `mvvm-core/src/androidMain/kotlin/dev/icerock/moko/mvvm/viewmodel/ViewModel.kt`
```
/*
 * Copyright 2019 IceRock MAG Inc. Use of this source code is governed by the Apache 2.0 license.
 */

package dev.icerock.moko.mvvm.viewmodel

import androidx.lifecycle.ViewModel
import dev.icerock.moko.mvvm.internal.createViewModelScope
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.cancel

@Suppress("EmptyDefaultConstructor")
actual open class ViewModel actual constructor() : ViewModel() {
    actual val viewModelScope: CoroutineScope = createViewModelScope()

    public actual override fun onCleared() {
        super.onCleared()

        viewModelScope.cancel()
    }
}

```

### Core Architecture Module: `mvvm-core/src/commonMain/kotlin/dev/icerock/moko/mvvm/dispatcher/EventsDispatcher.kt`
```
/*
 * Copyright 2019 IceRock MAG Inc. Use of this source code is governed by the Apache 2.0 license.
 */

package dev.icerock.moko.mvvm.dispatcher

@Suppress("EmptyDefaultConstructor")
expect class EventsDispatcher<ListenerType : Any>() {
    fun dispatchEvent(block: ListenerType.() -> Unit)
}

```

### Core Architecture Module: `mvvm-core/src/commonMain/kotlin/dev/icerock/moko/mvvm/dispatcher/EventsDispatcherOwner.kt`
```
/*
 * Copyright 2019 IceRock MAG Inc. Use of this source code is governed by the Apache 2.0 license.
 */

package dev.icerock.moko.mvvm.dispatcher

interface EventsDispatcherOwner<T : Any> {
    val eventsDispatcher: EventsDispatcher<T>
}

```

### Core Architecture Module: `mvvm-core/src/commonMain/kotlin/dev/icerock/moko/mvvm/viewmodel/ViewModel.kt`
```
/*
 * Copyright 2019 IceRock MAG Inc. Use of this source code is governed by the Apache 2.0 license.
 */

package dev.icerock.moko.mvvm.viewmodel

import kotlinx.coroutines.CoroutineScope

@Suppress("EmptyDefaultConstructor")
expect open class ViewModel() {
    val viewModelScope: CoroutineScope

    open fun onCleared()
}

```

### Core Architecture Module: `mvvm-core/src/nonAndroidMain/kotlin/dev/icerock/moko/mvvm/dispatcher/EventsDispatcher.kt`
```
/*
 * Copyright 2019 IceRock MAG Inc. Use of this source code is governed by the Apache 2.0 license.
 */

package dev.icerock.moko.mvvm.dispatcher

import dev.icerock.moko.mvvm.internal.WeakReference
import dev.icerock.moko.mvvm.internal.runOnMainThread

actual class EventsDispatcher<ListenerType : Any> actual constructor() {
    private var weakListener: WeakReference<ListenerType>? = null
    private val blocks = mutableListOf<ListenerType.() -> Unit>()

    var listener: ListenerType?
        get() = weakListener?.get()
        set(value) {
            weakListener = value?.let { WeakReference(it) }
            if (value != null) {
                blocks.forEach { it.invoke(value) }
                blocks.clear()
            }
        }

    constructor(listener: ListenerType) : this() {
        this.listener = listener
    }

    actual fun dispatchEvent(block: ListenerType.() -> Unit) {
        val listener = weakListener?.get()

        if (listener == null) {
            blocks.add(block)
            return
        }

        runOnMainThread { block(listener) }
    }
}

```

### Core Architecture Module: `mvvm-core/src/nonAndroidMain/kotlin/dev/icerock/moko/mvvm/viewmodel/ViewModel.kt`
```
/*
 * Copyright 2019 IceRock MAG Inc. Use of this source code is governed by the Apache 2.0 license.
 */

package dev.icerock.moko.mvvm.viewmodel

import dev.icerock.moko.mvvm.internal.createViewModelScope
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.cancel

@Suppress("EmptyDefaultConstructor")
actual open class ViewModel actual constructor() {
    actual val viewModelScope: CoroutineScope = createViewModelScope()

    actual open fun onCleared() {
        viewModelScope.cancel()
    }
}

```

### Core Architecture Module: `mvvm-flow-compose/src/commonMain/kotlin/dev/icerock/moko/mvvm/flow/compose/MutableStateAdapter.kt`
```
/*
 * Copyright 2022 IceRock MAG Inc. Use of this source code is governed by the Apache 2.0 license.
 */

package dev.icerock.moko.mvvm.flow.compose

import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.State
import androidx.compose.runtime.collectAsState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlin.coroutines.CoroutineContext
import kotlin.coroutines.EmptyCoroutineContext

class MutableStateAdapter<T>(
    private val state: State<T>,
    private val mutate: (T) -> Unit
) : MutableState<T> {

    override var value: T
        get() = state.value
        set(value) {
            mutate(value)
        }

    override fun component1(): T = value
    override fun component2(): (T) -> Unit = { value = it }
}

@Composable
fun <T> MutableStateFlow<T>.collectAsMutableState(
    context: CoroutineContext = EmptyCoroutineContext
): MutableState<T> = MutableStateAdapter(
    state = collectAsState(context),
    mutate = { value = it }
)

```

### Core Architecture Module: `mvvm-flow/apple/xcode/mokoMvvmFlowSwiftUI/ViewModelState.swift`
```
//
//  CFlowExt.swift
//  mokoMvvmFlowSwiftUI (iOS)
//
//  Created by Aleksey Mikhailov on 29.04.2022.
//

import MultiPlatformLibrary
import SwiftUI
import Combine

public extension ObservableObject where Self: ViewModel {

    func state<T, R>(
        _ flowKey: KeyPath<Self, CStateFlow<T>>,
        equals: @escaping (T?, T?) -> Bool,
        mapper: @escaping (T) -> R
    ) -> R {
        let stateFlow: CStateFlow<T> = self[keyPath: flowKey]
        var lastValue: T? = stateFlow.value
        
        var disposable: DisposableHandle? = nil
        
        disposable = stateFlow.subscribe(onCollect: { [weak self] value in
            if !equals(lastValue, value) {
                lastValue = value
                self?.objectWillChange.send()
                disposable?.dispose()
            }
        })
        
        return mapper(stateFlow.value!)
    }
    
    func state(_ flowKey: KeyPath<Self, CStateFlow<KotlinBoolean>>) -> Bool {
        return state(
            flowKey,
            equals: { $0?.boolValue == $1?.boolValue },
            mapper: { $0.boolValue }
        )
    }
    
    func state(_ flowKey: KeyPath<Self, CStateFlow<KotlinDouble>>) -> Double {
        return state(
            flowKey,
            equals: { $0?.doubleValue == $1?.doubleValue },
            mapper: { $0.doubleValue }
        )
    }
    
    func state(_ flowKey: KeyPath<Self, CStateFlow<KotlinFloat>>) -> Float {
        return state(
            flowKey,
            equals: { $0?.floatValue == $1?.floatValue },
            mapper: { $0.floatValue }
        )
    }
    
    func state(_ flowKey: KeyPath<Self, CStateFlow<KotlinInt>>) -> Int {
        return state(
            flowKey,
            equals: { $0?.intValue == $1?.intValue },
            mapper: { $0.intValue }
        )
    }
    
    func state(_ flowKey: KeyPath<Self, CStateFlow<KotlinLong>>) -> Int64 {
        return state(
            flowKey,
            equals: { $0?.int64Value == $1?.int64Value },
            mapper: { $0.int64Value }
        )
    }
    
    func state(_ flowKey: KeyPath<Self, CStateFlow<NSString>>) -> String {
        return state(
            flowKey,
            equals: { $0 == $1 },
            mapper: { $0 as String }
        )
    }
    
    func state<T>(_ flowKey: KeyPath<Self, CStateFlow<NSArray>>) -> Array<T> {
        return state(
            flowKey,
            equals: { oldValue, newValue in
                if let oldValue = oldValue {
                    guard let newValue = newValue as? Array<T> else {
                        return false
                    }
                    return oldValue.isEqual(to: newValue)
                } else {
                    return newValue == nil
                }
            },
            mapper: { $0 as! Array<T> }
        )
    }
}

```

### Core Architecture Module: `mvvm-flow/apple/xcode/mokoMvvmFlowSwiftUI/ViewModelStateNullable.swift`
```
//
//  ViewModelStateNullable.swift
//  mokoMvvmFlow
//
//  Created by mdubkov on 25.09.2022.
//

import MultiPlatformLibrary
import SwiftUI

extension ObservableObject where Self: ViewModel {
    func stateNullable<T, R>(
        _ flowKey: KeyPath<Self, CStateFlow<T>>,
        equals: @escaping (T?, T?) -> Bool,
        mapper: @escaping (T?) -> R?
    ) -> R? {
        let stateFlow: CStateFlow<T> = self[keyPath: flowKey]
        var lastValue: T? = stateFlow.value
        
        var disposable: DisposableHandle? = nil
        
        disposable = stateFlow.subscribe(onCollect: { [weak self] value in
            if !equals(lastValue, value) {
                lastValue = value
                self?.objectWillChange.send()
                disposable?.dispose()
            }
        })
        
        return mapper(stateFlow.value)
    }
    
    func stateNullable(_ flowKey: KeyPath<Self, CStateFlow<KotlinBoolean>>) -> Bool? {
        return stateNullable(
            flowKey,
            equals: { $0?.boolValue == $1?.boolValue },
            mapper: { $0?.boolValue }
        )
    }
    
    func stateNullable(_ flowKey: KeyPath<Self, CStateFlow<KotlinDouble>>) -> Double? {
        return stateNullable(
            flowKey,
            equals: { $0?.doubleValue == $1?.doubleValue },
            mapper: { $0?.doubleValue }
        )
    }
    
    func stateNullable(_ flowKey: KeyPath<Self, CStateFlow<KotlinFloat>>) -> Float? {
        return stateNullable(
            flowKey,
            equals: { $0?.floatValue == $1?.floatValue },
            mapper: { $0?.floatValue }
        )
    }
    
    func stateNullable(_ flowKey: KeyPath<Self, CStateFlow<KotlinInt>>) -> Int? {
        return stateNullable(
            flowKey,
            equals: { $0?.intValue == $1?.intValue },
            mapper: { $0?.intValue }
        )
    }
    
    func stateNullable(_ flowKey: KeyPath<Self, CStateFlow<KotlinLong>>) -> Int64? {
        return stateNullable(
            flowKey,
            equals: { $0?.int64Value == $1?.int64Value },
            mapper: { $0?.int64Value }
        )
    }
    
    func stateNullable(_ flowKey: KeyPath<Self, CStateFlow<NSString>>) -> String? {
        return stateNullable(
            flowKey,
            equals: { $0 == $1 },
            mapper: { $0 as? String }
        )
    }
    
    func stateNullable<T>(_ flowKey: KeyPath<Self, CStateFlow<NSArray>>) -> Array<T>? {
        return state(
            flowKey,
            equals: { $0 === $1 },
            mapper: { $0 as? Array<T> }
        )
    }
    
    func stateNullable(_ flowKey: KeyPath<Self, CStateFlow<StringDesc>>) -> String? {
        return stateNullable(
            flowKey,
            equals: { $0 === $1 },
            mapper: { $0?.localized() }
        )
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #238** (2023-04-21): **Xcode 14.3 / Swift 5.8 compiler crash in CFlowExt.swift**
  *Symptoms*: I'm unable to upgrade a KMM project to Xcode 14.3 / Swift 5.8 using MOKO-MVVM's [CFlowExt SwiftUI helper](https://github.com/icerockdev/moko-mvvm/blob/master/mvvm-flow/apple/xcode/mokoMvvmFlowSwiftUI/CFlowExt.swift).  This is likely a Swift compiler bug. Xcode 14.2 / Swift 5.7 works just fine, but the Swift 5.8 compiler throws the following stack trace:  ``` 1.	Apple Swift version 5.8 (swiftlang-5.8.0.124.2 clang-1403.0.22.11.100) 2.	Compiling with the current language version 3.	While evaluating request IRGenRequest(IR Generation for file "/Users/darron/Development/example-kmm/iosApp/iosApp/mokoMvvmFlowSwiftUI/CFlowExt.swift") 4.	While emitting IR SIL function "@$sxSgIegg_AAIeyBy_RlzC5InputQy_Rsz7Combine10SubscriberR_s5NeverO7FailureRt_r0_lTR".  for <<debugloc at "<compiler-generated>":0:0>>Stack dump without symbol names (ensure you have llvm-symbolizer in your PATH or set the environment var `LLVM_SYMBOLIZER_PATH` to point to it): 0  swift-frontend           0x0000000109ef3300 llvm::sys::PrintStackTrace(llvm::raw_ostream&, int) + 56 1  swift-frontend           0x0000000109ef22e4 llvm::sys::RunSignalHandlers() + 112 2  swift-frontend           0x0000000109ef3910 SignalHandler(int) + 344 3  libsystem_platform.dylib 0x00000001815e82a4 _sigtramp + 56 4  libsystem_pthread.dylib  0x00000001815b9cec pthread_kill + 288 5  libsystem_c.dylib        0x00000001814f22c8 abort + 180 6  swift-frontend           0x000000010651f24c swift::GenericSignatureImpl::getDependentU
  **Post-Mortem & Fix Analysis**:
  > I was able to workaround the Swift 5.8 compiler crash by making both `CFlowPublisher` and `CFlowSubscription` no longer generic and instead pinning `Output` to `AnyObject`. This requires casting the `cFlow` from `createPublisher` via `cFlow as! CFlow<AnyObject>` since we lose the generic `T`, but that's OK and should always succeed because `T` has to be constrained to `AnyObject` anyway.  I'll submit a PR for further discussion.
  > FYI, I logged the Swift 5.8 compiler crash against the Swift project at https://github.com/apple/swift/issues/65331

- **Issue #230** (2023-04-03): **Update moko-resources dependency without cinterop-pluralizedString**
  *Symptoms*: In `moko-resources` 0.21.0 release cinterop was removed as unused. But Kotlin/Native have own list of dependencies inside klib. All libraries, that depends on moko-resources, have inside own `manifest` file in `klib` dependency to `dev.icerock.moko:resources-cinterop-pluralizedString`. So gradle download new version of moko-resources (0.21.0) and try to compile project, but Kotlin/Native see own dependencies list and see that `moko-mvvm` depends on `dev.icerock.moko:resources-cinterop-pluralizedString` but that library not exist anymore and gradle not download it. As result we see: ``` error: could not find "dev.icerock.moko:resources-cinterop-pluralizedString" in [/Users/amikhailov/.konan/kotlin-native-prebuilt-macos-aarch64-1.8.10/bin, /Users/amikhailov/.konan/klib, /Users/amikhailov/.konan/kotlin-native-prebuilt-macos-aarch64-1.8.10/klib/common, /Users/amikhailov/.konan/kotlin-native-prebuilt-macos-aarch64-1.8.10/klib/platform/ios_arm64] ```  need to publish new version with updated moko resources
  **Post-Mortem & Fix Analysis**:
  > will be released in 0.16.0

- **Issue #208** (2022-12-19): **Memory churn when collecting `CStateFlow` of `List` due to `===` test.**
  *Symptoms*: I have a viewModel that exposes a `CStateFlow` of `List` that I'm using in SwiftUI. It looks like this:  ```kotlin private val _items = MutableStateFlow<List<Item>>(listOf()).cMutableStateFlow() var items: CStateFlow<List<Item>> = _items.cStateFlow() ```  In my SwiftUI view, I use the `state` helper to subscribe to the stateFlow:  ```swift struct ExampleView: View {   @ObservableObject viewModel = ExampleViewModel()    var body: some View {     List(viewModel.state(\.items)) { (item: Item) in       Text("Item: \(item.id)")     }   } } ```  This setup is enough to trigger memory churn. Even though `items` never changes in the viewModel in this example, there's extremely high CPU usage and memory allocations for what should be an idle view.  I did some digging and have a general idea of the root cause. From what I can tell, asking for `stateFlow.value` inside the [`state` method](https://github.com/icerockdev/moko-mvvm/blob/develop/mvvm-flow/apple/xcode/mokoMvvmFlowSwiftUI/ViewModelState.swift#L20) allocates a new array, every time. I don't know why this happens, perhaps it has something to do with the Kotlin/Swift(ObjC) bridge. You can see this for yourself by adding some simple logging inside of the method:  ```swift var value1 = stateFlow.value var value2 = stateFlow.value var value3 = stateFlow.value              print("value1 = \(value1)") print("value2 = \(value2)") print("value3 = \(value3)") print("stateFlow.value = \(stateFlow.value)")

- **Issue #188** (2022-08-08): **MvvmEventsFragment crash**
  *Symptoms*: ``` Can't access the Fragment View's LifecycleOwner when getView() is null i.e., before onCreateView() or after onDestroyView() ``` invalid changes was here - https://github.com/icerockdev/moko-mvvm/commit/9f90ff30f4a0a32960b62a0b0070c20fde1f5eb9  databinding should bind to `viewLifecycleOwner`. but `EventsDispatcher` should bind to `lifecycleOwner`

- **Issue #186** (2022-12-19): **Error building mokoMvvmFlowSwiftUI on newest xcode**
  *Symptoms*: Failed to build module 'mokoMvvmFlowSwiftUI'; this SDK is not supported by the compiler (the SDK is built with 'Apple Swift version 5.6 (swiftlang-5.6.0.323.62 clang-1316.0.20.8)', while this compiler is 'Apple Swift version 5.6.1 (swiftlang-5.6.0.323.66 clang-1316.0.20.12)'). Please select a toolchain which matches the SDK.
  **Post-Mortem & Fix Analysis**:
  > fixed by downgrading gradle and kotlin version
  > Hello. Any update on this issue? I have the same problem :( 
  > while we not fix support of swift sdk in any future swift versions - you can just copy this swift files https://github.com/icerockdev/moko-mvvm/tree/master/mvvm-flow/apple/xcode/mokoMvvmFlowSwiftUI inside your project. and remove mokoMvvmFlowSwiftUI cocoapod

- **Issue #159** (2022-02-25): **iOS Livedata wrong observers call order **
  *Symptoms*: code sample ``` val test = MutableLiveData("")      fun bind1() {         test.addObserver {             println("first $it")              if (it == "A") {                 test.value = "B"             }         }     }      fun bind2() {         test.addObserver {             println("second $it")         }     }      fun start() {         bind1()         bind2()         test.value = "A"     } ``` After we call start function on iOS, in console we will see that observers calls in wrong order: ``` first A first B second B second A ``` It happened because if we change value inside observer,  `changeValue` function called recursively.  For workaround we can call observers with `storedValue`, as below ```     protected fun changeValue(value: T) {         storedValue = value          observers.forEach { it(storedValue) }     } ```
  **Post-Mortem & Fix Analysis**:
  > will be available in 0.12.0

- **Issue #155** (2022-02-25): **WARN: Setting the fragment as the LifecycleOwner might cause memory leaks because views lives shorter than the Fragment. Consider using Fragment's view lifecycle**
  *Symptoms*: https://github.com/icerockdev/moko-mvvm/blob/b6f2630df03bbd405e5659d85ea7df03f38e5dc7/mvvm-databinding/src/main/kotlin/dev/icerock/moko/mvvm/MvvmFragment.kt#L46  Maybe, will be better:  `binding.lifecycleOwner = viewLifecycleOwner`
  **Post-Mortem & Fix Analysis**:
  > yes, make sense
  > yeah..that works fine.
  > will be available in 0.12.0

- **Issue #149** (2022-02-11): **Have to update mokoResources version for binary compatibility**
  *Symptoms*: 

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

### Incident Patch 1: `90cda4b6` (2023-11-03)
**Commit Message**: Fixed spelling mistakes

**File**: `README.md` (modified, +3/-3)
```diff
@@ -58,9 +58,9 @@ dependencies {
     commonMainApi("dev.icerock.moko:mvvm-flow-resources:0.16.1") // api mvvm-core, moko-resources, extensions for Flow with moko-resources
     
     // compose multiplatform
-    commonMainApi("dev.icerock.moko:mvvm-compose:0.16.1") // api mvvm-core, getViewModel for Compose Multiplatfrom
-    commonMainApi("dev.icerock.moko:mvvm-flow-compose:0.16.1") // api mvvm-flow, binding extensions for Compose Multiplatfrom
-    commonMainApi("dev.icerock.moko:mvvm-livedata-compose:0.16.1") // api mvvm-livedata, binding extensions for Compose Multiplatfrom
+    commonMainApi("dev.icerock.moko:mvvm-compose:0.16.1") // api mvvm-core, getViewModel for Compose Multiplatform
+    commonMainApi("dev.icerock.moko:mvvm-flow-compose:0.16.1") // api mvvm-flow, binding extensions for Compose Multiplatform
+    commonMainApi("dev.icerock.moko:mvvm-livedata-compose:0.16.1") // api mvvm-livedata, binding extensions for Compose Multiplatform
 
     androidMainApi("dev.icerock.moko:mvvm-livedata-material:0.16.1") // api mvvm-livedata, Material library android extensions
     androidMainApi("dev.icerock.moko:mvvm-livedata-glide:0.16.1") // api mvvm-livedata, Glide library android extensions
```

---

### Incident Patch 2: `80b6e45d` (2023-06-25)
**Commit Message**: fix deploy of pages

**File**: `.github/workflows/dokka.yml` (modified, +3/-0)
```diff
@@ -30,6 +30,9 @@ jobs:
       url: ${{ steps.deployment.outputs.page_url }}
     runs-on: ubuntu-latest
     needs: build
+    permissions:
+      pages: write
+      id-token: write
     steps:
       - name: Deploy to GitHub Pages
         id: deployment
```

---

### Incident Patch 3: `6ae80f60` (2023-04-21)
**Commit Message**: Merge pull request #239 from darronschall/workaround-swift-5.8-compiler-issue

Use explicit casts to workaround Swift 5.8 compiler issue.

**File**: `mvvm-flow/apple/xcode/mokoMvvmFlowSwiftUI/CFlowExt.swift` (modified, +4/-2)
```diff
@@ -31,8 +31,10 @@ private class CFlowSubscription<Output: AnyObject, S: Subscriber>: Subscription
     
     init(flow: CFlow<Output>, subscriber: S) {
         self.subscriber = subscriber
-        self.disposable = flow.subscribe { value in
-            let _ = subscriber.receive(value!)
+        // TRICKY: `as! CFlow<AnyObject>` cast here, and `as! Output` cast below, combine
+        // to work around https://github.com/apple/swift/issues/65331
+        self.disposable = (flow as! CFlow<AnyObject>).subscribe { value in
+            let _ = subscriber.receive(value as! Output)
         }
     }
     
```

---

### Incident Patch 4: `2efc9fde` (2023-04-21)
**Commit Message**: Use explicit casts to workaround https://github.com/apple/swift/issues/65331

**File**: `mvvm-flow/apple/xcode/mokoMvvmFlowSwiftUI/CFlowExt.swift` (modified, +4/-2)
```diff
@@ -31,8 +31,10 @@ private class CFlowSubscription<Output: AnyObject, S: Subscriber>: Subscription
     
     init(flow: CFlow<Output>, subscriber: S) {
         self.subscriber = subscriber
-        self.disposable = flow.subscribe { value in
-            let _ = subscriber.receive(value!)
+        // TRICKY: `as! CFlow<AnyObject>` cast here, and `as! Output` cast below, combine
+        // to work around https://github.com/apple/swift/issues/65331
+        self.disposable = (flow as! CFlow<AnyObject>).subscribe { value in
+            let _ = subscriber.receive(value as! Output)
         }
     }
     
```

---

### Incident Patch 5: `6e620d19` (2023-04-08)
**Commit Message**: #232 fix detekt

**File**: `mvvm-compose/build.gradle.kts` (modified, +3/-0)
```diff
@@ -12,6 +12,9 @@ plugins {
 
 android {
     namespace = "dev.icerock.moko.mvvm.compose"
+    defaultConfig {
+        minSdk = 21
+    }
 }
 
 java {
```

**File**: `mvvm-compose/src/androidMain/kotlin/dev/icerock/moko/mvvm/compose/getViewModel.android.kt` (modified, +2/-2)
```diff
@@ -27,7 +27,7 @@ actual fun <T : ViewModel> getViewModel(
     val context: Context = LocalContext.current
     val storeHolder: ViewModelStoreHolder = remember(context, key) {
         val viewModelStore: ViewModelStoreOwner = context as? ViewModelStoreOwner
-            ?: throw IllegalStateException("context not implement ViewModelStoreOwner")
+            ?: error("context not implement ViewModelStoreOwner")
 
         val storeViewModel: StoreViewModel = viewModelStore.getViewModel { StoreViewModel() }
         storeViewModel.get(key)
@@ -42,7 +42,7 @@ actual fun <T : ViewModel> getViewModel(
     DisposableEffect(context, storeHolder) {
         onDispose {
             val componentActivity: ComponentActivity = context as? ComponentActivity
-                ?: throw IllegalStateException("context should be ComponentActivity")
+                ?: error("context should be ComponentActivity")
 
             if (!componentActivity.isChangingConfigurations) {
                 storeHolder.viewModelStore.clear()
```

**File**: `mvvm-flow-compose/build.gradle.kts` (modified, +3/-0)
```diff
@@ -12,6 +12,9 @@ plugins {
 
 android {
     namespace = "dev.icerock.moko.mvvm.flow.compose"
+    defaultConfig {
+        minSdk = 21
+    }
 }
 
 java {
```

**File**: `mvvm-livedata-compose/build.gradle.kts` (modified, +3/-0)
```diff
@@ -12,6 +12,9 @@ plugins {
 
 android {
     namespace = "dev.icerock.moko.mvvm.livedata.compose"
+    defaultConfig {
+        minSdk = 21
+    }
 }
 
 java {
```

**File**: `mvvm-livedata-compose/src/androidMain/AndroidManifest.xml` (removed, +0/-2)
```diff
@@ -1,2 +0,0 @@
-<?xml version="1.0" encoding="utf-8"?>
-<manifest package="dev.icerock.moko.mvvm.livedata.compose" />
\ No newline at end of file
```

---

### Incident Patch 6: `53b708ee` (2023-04-03)
**Commit Message**: #230 fix detekt, android lint and remove deprecated

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ material = { module = "com.google.android.material:material", version = "1.8.0"
 lifecycleKtx = { module = "androidx.lifecycle:lifecycle-runtime-ktx", version.ref = "androidLifecycleVersion" }
 androidViewModel = { module = "androidx.lifecycle:lifecycle-viewmodel-ktx", version.ref = "androidLifecycleVersion" }
 androidLiveData = { module = "androidx.lifecycle:lifecycle-livedata-ktx", version.ref = "androidLifecycleVersion" }
-glide = { module = "com.github.bumptech.glide:glide", version = "4.11.0" }
+glide = { module = "com.github.bumptech.glide:glide", version = "4.15.1" }
 swipeRefresh = { module = "androidx.swiperefreshlayout:swiperefreshlayout", version = "1.1.0" }
 
 # compose
```

**File**: `mvvm-flow/apple/src/commonMain/kotlin/Greeting.kt` (modified, +0/-2)
```diff
@@ -2,7 +2,5 @@
  * Copyright 2022 IceRock MAG Inc. Use of this source code is governed by the Apache 2.0 license.
  */
 
-package dev.icerock.moko.mvvm.flow.apple
-
 // just for compile this module
 fun helloWorld() = println("hello world")
```

**File**: `mvvm-internal/src/nonAndroidMain/kotlin/dev/icerock/moko/mvvm/internal/WeakReference.kt` (modified, +2/-2)
```diff
@@ -4,6 +4,6 @@
 
 package dev.icerock.moko.mvvm.internal
 
-expect class WeakReference<T: Any>(referred: T) {
+expect class WeakReference<T : Any>(referred: T) {
     fun get(): T?
-}
\ No newline at end of file
+}
```

**File**: `mvvm-livedata-resources/src/iosMain/kotlin/dev/icerock/moko/mvvm/livedata/resources/deprecated/UIButtonBindings.kt` (removed, +0/-19)
```diff
@@ -1,19 +0,0 @@
-/*
- * Copyright 2021 IceRock MAG Inc. Use of this source code is governed by the Apache 2.0 license.
- */
-
-@file:Suppress("PackageDirectoryMismatch")
-
-package dev.icerock.moko.mvvm.livedata
-
-import dev.icerock.moko.mvvm.livedata.resources.bindTitle
-import dev.icerock.moko.resources.desc.StringDesc
-import platform.UIKit.UIButton
-
-@Deprecated(
-    "Use UIButton.bindTitle",
-    replaceWith = ReplaceWith("UIButton.bindTitle")
-)
-fun <T : StringDesc?> LiveData<T>.bindStringDescToButtonTitle(button: UIButton): Closeable {
-    return button.bindTitle(this)
-}
```

**File**: `mvvm-livedata-resources/src/iosMain/kotlin/dev/icerock/moko/mvvm/livedata/resources/deprecated/UILabelBindings.kt` (removed, +0/-21)
```diff
@@ -1,21 +0,0 @@
-/*
- * Copyright 2021 IceRock MAG Inc. Use of this source code is governed by the Apache 2.0 license.
- */
-
-@file:Suppress("PackageDirectoryMismatch")
-
-package dev.icerock.moko.mvvm.livedata
-
-import dev.icerock.moko.mvvm.livedata.resources.bindText
-import dev.icerock.moko.resources.desc.StringDesc
-import platform.UIKit.UILabel
-
-@Deprecated(
-    "Use UILabel.bindText",
-    replaceWith = ReplaceWith("UILabel.bindText")
-)
-fun <T : StringDesc?> LiveData<T>.bindStringDescToLabelText(
-    label: UILabel
-): Closeable {
-    return label.bindText(this)
-}
```

**File**: `mvvm-livedata-resources/src/iosMain/kotlin/dev/icerock/moko/mvvm/livedata/resources/deprecated/UITextFieldBindings.kt` (removed, +0/-21)
```diff
@@ -1,21 +0,0 @@
-/*
- * Copyright 2021 IceRock MAG Inc. Use of this source code is governed by the Apache 2.0 license.
- */
-
-@file:Suppress("PackageDirectoryMismatch")
-
-package dev.icerock.moko.mvvm.livedata
-
-import dev.icerock.moko.mvvm.livedata.resources.bindText
-import dev.icerock.moko.resources.desc.StringDesc
-import platform.UIKit.UITextField
-
-@Deprecated(
-    "Use UITextField.bindText",
-    replaceWith = ReplaceWith("UITextField.bindText")
-)
-fun <T : StringDesc?> LiveData<T>.bindStringDescToTextFieldText(
-    textField: UITextField
-): Closeable {
-    return textField.bindText(this)
-}
```

**File**: `mvvm-livedata-resources/src/iosMain/kotlin/dev/icerock/moko/mvvm/livedata/resources/deprecated/UITextViewBindings.kt` (removed, +0/-21)
```diff
@@ -1,21 +0,0 @@
-/*
- * Copyright 2021 IceRock MAG Inc. Use of this source code is governed by the Apache 2.0 license.
- */
-
-@file:Suppress("PackageDirectoryMismatch")
-
-package dev.icerock.moko.mvvm.livedata
-
-import dev.icerock.moko.mvvm.livedata.resources.bindText
-import dev.icerock.moko.resources.desc.StringDesc
-import platform.UIKit.UITextView
-
-@Deprecated(
-    "Use UITextView.bindText",
-    replaceWith = ReplaceWith("UITextView.bindText")
-)
-fun <T : StringDesc?> LiveData<T>.bindStringDescToTextViewText(
-    textView: UITextView
-): Closeable {
-    return textView.bindText(this)
-}
```

**File**: `mvvm-livedata/src/iosMain/kotlin/dev/icerock/moko/mvvm/livedata/deprecated/UIButtonBindings.kt` (removed, +0/-30)
```diff
@@ -1,30 +0,0 @@
-/*
- * Copyright 2021 IceRock MAG Inc. Use of this source code is governed by the Apache 2.0 license.
- */
-
-@file:Suppress("PackageDirectoryMismatch")
-
-package dev.icerock.moko.mvvm.livedata
-
-import platform.UIKit.UIButton
-import platform.UIKit.UIImage
-
-@Deprecated(
-    "Use UIButton.bindTitle",
-    replaceWith = ReplaceWith("UIButton.bindTitle")
-)
-fun <T : String?> LiveData<T>.bindStringToButtonTitle(button: UIButton): Closeable {
-    return button.bindTitle(this)
-}
-
-@Deprecated(
-    "Use UIButton.bindImage",
-    replaceWith = ReplaceWith("UIButton.bindImage")
-)
-fun LiveData<Boolean>.bindBoolToButtonImage(
-    button: UIButton,
-    trueImage: UIImage,
-    falseImage: UIImage
-): Closeable {
-    return button.bindImage(this, trueImage, falseImage)
-}
```

---

### Incident Patch 7: `a812ea23` (2023-04-03)
**Commit Message**: #232 link to youtrack with ios bug

**File**: `mvvm-compose/src/commonMain/kotlin/dev/icerock/moko/mvvm/compose/getViewModel.kt` (modified, +1/-6)
```diff
@@ -15,12 +15,7 @@ expect fun <T : ViewModel> getViewModel(
     viewModelBlock: () -> T
 ): T
 
-// with this inline function we got error
-// Module "dev.icerock.moko:mvvm-compose (dev.icerock.moko:mvvm-compose-iossimulatorarm64)" has a
-// reference to symbol [ dev.icerock.moko.mvvm.compose/getViewModel|-1374970681312300217[0]
-// <- local Local[<TP>,0 | TYPE_PARAMETER name:T index:0 variance:
-// superTypes:[dev.icerock.moko.mvvm.viewmodel.ViewModel] reified:true] ].
-// Neither the module itself nor its dependencies contain such declaration.
+// at now function can't be used on iOS because of https://youtrack.jetbrains.com/issue/KT-57727
 @Composable
 inline fun <reified T : ViewModel> getViewModel(
     key: Any,
```

---

### Incident Patch 8: `1ad2b3df` (2023-04-03)
**Commit Message**: #232 mark bug inline fun

**File**: `mvvm-compose/src/commonMain/kotlin/dev/icerock/moko/mvvm/compose/getViewModel.kt` (modified, +6/-0)
```diff
@@ -15,6 +15,12 @@ expect fun <T : ViewModel> getViewModel(
     viewModelBlock: () -> T
 ): T
 
+// with this inline function we got error
+// Module "dev.icerock.moko:mvvm-compose (dev.icerock.moko:mvvm-compose-iossimulatorarm64)" has a
+// reference to symbol [ dev.icerock.moko.mvvm.compose/getViewModel|-1374970681312300217[0]
+// <- local Local[<TP>,0 | TYPE_PARAMETER name:T index:0 variance:
+// superTypes:[dev.icerock.moko.mvvm.viewmodel.ViewModel] reified:true] ].
+// Neither the module itself nor its dependencies contain such declaration.
 @Composable
 inline fun <reified T : ViewModel> getViewModel(
     key: Any,
```

---

### Incident Patch 9: `a286ef66` (2023-03-01)
**Commit Message**: Update ViewModelStateNullable.swift

Using weak self into stateFlow subscribe for correct clearing memory

**File**: `mvvm-flow/apple/xcode/mokoMvvmFlowSwiftUI/ViewModelStateNullable.swift` (modified, +2/-2)
```diff
@@ -19,10 +19,10 @@ extension ObservableObject where Self: ViewModel {
         
         var disposable: DisposableHandle? = nil
         
-        disposable = stateFlow.subscribe(onCollect: { value in
+        disposable = stateFlow.subscribe(onCollect: { [weak self] value in
             if !equals(lastValue, value) {
                 lastValue = value
-                self.objectWillChange.send()
+                self?.objectWillChange.send()
                 disposable?.dispose()
             }
         })
```

---

### Incident Patch 10: `2208a368` (2022-12-19)
**Commit Message**: #186 try to fix newest xcode support

**File**: `mvvm-flow/apple/xcode/mokoMvvmFlow.xcodeproj/project.pbxproj` (modified, +6/-0)
```diff
@@ -496,6 +496,7 @@
 					"@loader_path/Frameworks",
 				);
 				MARKETING_VERSION = 1.0;
+				OTHER_SWIFT_FLAGS = "-verify-emitted-module-interface";
 				PRODUCT_BUNDLE_IDENTIFIER = dev.icerock.moko.mokoMvvmFlowSwiftUI;
 				PRODUCT_NAME = mokoMvvmFlowSwiftUI;
 				SDKROOT = iphoneos;
@@ -530,6 +531,7 @@
 					"@loader_path/Frameworks",
 				);
 				MARKETING_VERSION = 1.0;
+				OTHER_SWIFT_FLAGS = "-verify-emitted-module-interface";
 				PRODUCT_BUNDLE_IDENTIFIER = dev.icerock.moko.mokoMvvmFlowSwiftUI;
 				PRODUCT_NAME = mokoMvvmFlowSwiftUI;
 				SDKROOT = iphoneos;
@@ -564,6 +566,7 @@
 				);
 				MACOSX_DEPLOYMENT_TARGET = 12.1;
 				MARKETING_VERSION = 1.0;
+				OTHER_SWIFT_FLAGS = "-verify-emitted-module-interface";
 				PRODUCT_BUNDLE_IDENTIFIER = dev.icerock.moko.mokoMvvmFlowSwiftUI;
 				PRODUCT_NAME = mokoMvvmFlowSwiftUI;
 				SDKROOT = macosx;
@@ -596,6 +599,7 @@
 				);
 				MACOSX_DEPLOYMENT_TARGET = 12.1;
 				MARKETING_VERSION = 1.0;
+				OTHER_SWIFT_FLAGS = "-verify-emitted-module-interface";
 				PRODUCT_BUNDLE_IDENTIFIER = dev.icerock.moko.mokoMvvmFlowSwiftUI;
 				PRODUCT_NAME = mokoMvvmFlowSwiftUI;
 				SDKROOT = macosx;
@@ -678,6 +682,7 @@
 				MTL_FAST_MATH = YES;
 				ONLY_ACTIVE_ARCH = YES;
 				SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;
+				SWIFT_INSTALL_OBJC_HEADER = NO;
 				SWIFT_OPTIMIZATION_LEVEL = "-Onone";
 			};
 			name = Debug;
@@ -730,6 +735,7 @@
 				MTL_ENABLE_DEBUG_INFO = NO;
 				MTL_FAST_MATH = YES;
 				SWIFT_COMPILATION_MODE = wholemodule;
+				SWIFT_INSTALL_OBJC_HEADER = NO;
 				SWIFT_OPTIMIZATION_LEVEL = "-O";
 			};
 			name = Release;
```

**File**: `mvvm-flow/apple/xcode/mokoMvvmFlow.xcodeproj/xcshareddata/xcschemes/mokoMvvmFlowSwiftUI-iOS.xcscheme` (modified, +2/-2)
```diff
@@ -15,7 +15,7 @@
             <BuildableReference
                BuildableIdentifier = "primary"
                BlueprintIdentifier = "22BDE6FF281BD34C00259368"
-               BuildableName = "mokoMvvmFlowSwiftUI__iOS_.framework"
+               BuildableName = "mokoMvvmFlowSwiftUI.framework"
                BlueprintName = "mokoMvvmFlowSwiftUI (iOS)"
                ReferencedContainer = "container:mokoMvvmFlow.xcodeproj">
             </BuildableReference>
@@ -51,7 +51,7 @@
          <BuildableReference
             BuildableIdentifier = "primary"
             BlueprintIdentifier = "22BDE6FF281BD34C00259368"
-            BuildableName = "mokoMvvmFlowSwiftUI__iOS_.framework"
+            BuildableName = "mokoMvvmFlowSwiftUI.framework"
             BlueprintName = "mokoMvvmFlowSwiftUI (iOS)"
             ReferencedContainer = "container:mokoMvvmFlow.xcodeproj">
          </BuildableReference>
```

**File**: `mvvm-flow/apple/xcode/mokoMvvmFlow.xcodeproj/xcshareddata/xcschemes/mokoMvvmFlowSwiftUI-macOS.xcscheme` (modified, +2/-2)
```diff
@@ -15,7 +15,7 @@
             <BuildableReference
                BuildableIdentifier = "primary"
                BlueprintIdentifier = "22BDE720281BD37100259368"
-               BuildableName = "mokoMvvmFlowSwiftUI__macOS_.framework"
+               BuildableName = "mokoMvvmFlowSwiftUI.framework"
                BlueprintName = "mokoMvvmFlowSwiftUI (macOS)"
                ReferencedContainer = "container:mokoMvvmFlow.xcodeproj">
             </BuildableReference>
@@ -51,7 +51,7 @@
          <BuildableReference
             BuildableIdentifier = "primary"
             BlueprintIdentifier = "22BDE720281BD37100259368"
-            BuildableName = "mokoMvvmFlowSwiftUI__macOS_.framework"
+            BuildableName = "mokoMvvmFlowSwiftUI.framework"
             BlueprintName = "mokoMvvmFlowSwiftUI (macOS)"
             ReferencedContainer = "container:mokoMvvmFlow.xcodeproj">
          </BuildableReference>
```

---

### Incident Patch 11: `566106e6` (2022-12-18)
**Commit Message**: #207 fix sdk api error

**File**: `mvvm-livedata-compose/build.gradle.kts` (modified, +6/-0)
```diff
@@ -19,6 +19,12 @@ java {
     }
 }
 
+android {
+    defaultConfig {
+        minSdk = 21
+    }
+}
+
 kotlin {
     android()
     jvm()
```

---

### Incident Patch 12: `efc155cf` (2022-10-28)
**Commit Message**: code style fix

**File**: `mvvm-livedata-material/src/main/kotlin/dev/icerock/moko/mvvm/livedata/material/TextInputLayoutBindings.kt` (modified, +1/-1)
```diff
@@ -52,4 +52,4 @@ fun TextInputLayout.bindError(
     return liveData.bindNotNull(lifecycleOwner) {
         error = it.toString(context)
     }
-}
\ No newline at end of file
+}
```

---

### Incident Patch 13: `f4a8857e` (2022-10-28)
**Commit Message**: increase lib version, fix compatibility for llivedata

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ androidLifecycleVersion = "2.2.0"
 coroutinesVersion = "1.6.0-native-mt"
 mokoResourcesVersion = "0.18.0"
 mokoTestVersion = "0.6.1"
-mokoMvvmVersion = "0.14.1"
+mokoMvvmVersion = "0.15.0"
 mokoKSwiftVersion = "0.4.0"
 composeVersion = "1.1.1"
 composeJetBrainsVersion = "1.1.1"
```

**File**: `mvvm-livedata-material/src/main/kotlin/dev/icerock/moko/mvvm/livedata/material/TextInputLayoutBindings.kt` (modified, +23/-2)
```diff
@@ -9,9 +9,10 @@ import com.google.android.material.textfield.TextInputLayout
 import dev.icerock.moko.mvvm.livedata.Closeable
 import dev.icerock.moko.mvvm.livedata.LiveData
 import dev.icerock.moko.mvvm.utils.bind
+import dev.icerock.moko.mvvm.utils.bindNotNull
 import dev.icerock.moko.resources.desc.StringDesc
 
-@JvmName("bindErrorString")
+@JvmName("bindErrorStringWithState")
 fun TextInputLayout.bindError(
     lifecycleOwner: LifecycleOwner,
     liveData: LiveData<String?>
@@ -22,7 +23,7 @@ fun TextInputLayout.bindError(
     }
 }
 
-@JvmName("bindErrorStringDesc")
+@JvmName("bindErrorStringDescWithState")
 fun TextInputLayout.bindError(
     lifecycleOwner: LifecycleOwner,
     liveData: LiveData<StringDesc?>
@@ -32,3 +33,23 @@ fun TextInputLayout.bindError(
         isErrorEnabled = it != null
     }
 }
+
+@JvmName("bindErrorString")
+fun TextInputLayout.bindError(
+    lifecycleOwner: LifecycleOwner,
+    liveData: LiveData<String>
+): Closeable {
+    return liveData.bindNotNull(lifecycleOwner) {
+        error = it
+    }
+}
+
+@JvmName("bindErrorStringDesc")
+fun TextInputLayout.bindError(
+    lifecycleOwner: LifecycleOwner,
+    liveData: LiveData<StringDesc>
+): Closeable {
+    return liveData.bindNotNull(lifecycleOwner) {
+        error = it.toString(context)
+    }
+}
\ No newline at end of file
```

---

### Incident Patch 14: `da14b6e0` (2022-10-28)
**Commit Message**: add textinputlayout error binding for flow, fix for livedata

**File**: `gradle/libs.versions.toml` (modified, +2/-2)
```diff
@@ -4,7 +4,7 @@ androidLifecycleVersion = "2.2.0"
 coroutinesVersion = "1.6.0-native-mt"
 mokoResourcesVersion = "0.18.0"
 mokoTestVersion = "0.6.1"
-mokoMvvmVersion = "0.14.0"
+mokoMvvmVersion = "0.14.1"
 mokoKSwiftVersion = "0.4.0"
 composeVersion = "1.1.1"
 composeJetBrainsVersion = "1.1.1"
@@ -41,7 +41,7 @@ androidCoreTesting = { module = "androidx.arch.core:core-testing", version = "2.
 dokkaGradlePlugin = { module = "org.jetbrains.dokka:dokka-gradle-plugin", version.ref = "kotlinVersion" }
 kotlinGradlePlugin = { module = "org.jetbrains.kotlin:kotlin-gradle-plugin", version.ref = "kotlinVersion" }
 mobileMultiplatformGradlePlugin = { module = "dev.icerock:mobile-multiplatform", version = "0.13.0" }
-androidGradlePlugin = { module = "com.android.tools.build:gradle", version = "7.0.4" }
+androidGradlePlugin = { module = "com.android.tools.build:gradle", version = "7.2.2" }
 detektGradlePlugin = { module = "io.gitlab.arturbosch.detekt:detekt-gradle-plugin", version = "1.19.0" }
 kswiftGradlePlugin = { module = "dev.icerock.moko:kswift-gradle-plugin", version.ref = "mokoKSwiftVersion" }
 composeJetBrainsGradlePlugin = { module = "org.jetbrains.compose:compose-gradle-plugin", version.ref = "composeJetBrainsVersion" }
```

**File**: `gradle/wrapper/gradle-wrapper.properties` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 distributionBase=GRADLE_USER_HOME
 distributionPath=wrapper/dists
-distributionUrl=https\://services.gradle.org/distributions/gradle-7.4-bin.zip
+distributionUrl=https\://services.gradle.org/distributions/gradle-7.4.1-bin.zip
 zipStoreBase=GRADLE_USER_HOME
 zipStorePath=wrapper/dists
```

**File**: `mvvm-build-logic/src/main/kotlin/android-base-convention.gradle.kts` (modified, +3/-3)
```diff
@@ -5,10 +5,10 @@
 import com.android.build.gradle.BaseExtension
 
 configure<BaseExtension> {
-    compileSdkVersion(30)
+    compileSdkVersion(33)
 
     defaultConfig {
-        minSdkVersion(16)
-        targetSdkVersion(30)
+        minSdk = 16
+        targetSdk = 33
     }
 }
```

**File**: `mvvm-flow-material/build.gradle.kts` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+/*
+ * Copyright 2019 IceRock MAG Inc. Use of this source code is governed by the Apache 2.0 license.
+ */
+
+plugins {
+    id("android-library-convention")
+    id("detekt-convention")
+    id("android-publication-convention")
+}
+
+dependencies {
+    api(projects.mvvmFlowResources)
+
+    api(libs.material)
+}
```

**File**: `mvvm-flow-material/src/main/AndroidManifest.xml` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+<?xml version="1.0" encoding="utf-8"?>
+<manifest package="dev.icerock.moko.mvvm.flow.material" />
\ No newline at end of file
```

**File**: `mvvm-flow-material/src/main/kotlin/dev/icerock/moko/mvvm/flow/material/TextInputLayoutBindings.kt` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+/*
+ * Copyright 2021 IceRock MAG Inc. Use of this source code is governed by the Apache 2.0 license.
+ */
+
+package dev.icerock.moko.mvvm.flow.material
+
+import androidx.lifecycle.LifecycleOwner
+import com.google.android.material.textfield.TextInputLayout
+import dev.icerock.moko.mvvm.flow.CStateFlow
+import dev.icerock.moko.mvvm.flow.binding.bind
+import dev.icerock.moko.resources.desc.StringDesc
+import kotlinx.coroutines.DisposableHandle
+
+@JvmName("bindErrorString")
+fun <T : String?> TextInputLayout.bindError(
+    lifecycleOwner: LifecycleOwner,
+    flow: CStateFlow<T?>
+): DisposableHandle {
+    return flow.bind(lifecycleOwner) {
+        error = it
+        isErrorEnabled = it != null
+    }
+}
+
+@JvmName("bindErrorStringDesc")
+fun <T : StringDesc?> TextInputLayout.bindError(
+    lifecycleOwner: LifecycleOwner,
+    flow: CStateFlow<T?>
+): DisposableHandle {
+    return flow.bind(lifecycleOwner) {
+        error = it?.toString(context)
+        isErrorEnabled = it != null
+    }
+}
```

**File**: `mvvm-livedata-material/src/main/kotlin/dev/icerock/moko/mvvm/livedata/material/TextInputLayoutBindings.kt` (modified, +11/-5)
```diff
@@ -8,21 +8,27 @@ import androidx.lifecycle.LifecycleOwner
 import com.google.android.material.textfield.TextInputLayout
 import dev.icerock.moko.mvvm.livedata.Closeable
 import dev.icerock.moko.mvvm.livedata.LiveData
-import dev.icerock.moko.mvvm.utils.bindNotNull
+import dev.icerock.moko.mvvm.utils.bind
 import dev.icerock.moko.resources.desc.StringDesc
 
 @JvmName("bindErrorString")
 fun TextInputLayout.bindError(
     lifecycleOwner: LifecycleOwner,
-    liveData: LiveData<String>
+    liveData: LiveData<String?>
 ): Closeable {
-    return liveData.bindNotNull(lifecycleOwner) { this.error = it }
+    return liveData.bind(lifecycleOwner) {
+        error = it
+        isErrorEnabled = it != null
+    }
 }
 
 @JvmName("bindErrorStringDesc")
 fun TextInputLayout.bindError(
     lifecycleOwner: LifecycleOwner,
-    liveData: LiveData<StringDesc>
+    liveData: LiveData<StringDesc?>
 ): Closeable {
-    return liveData.bindNotNull(lifecycleOwner) { this.error = it.toString(this.context) }
+    return liveData.bind(lifecycleOwner) {
+        error = it?.toString(context)
+        isErrorEnabled = it != null
+    }
 }
```

**File**: `sample/android-app/src/main/AndroidManifest.xml` (modified, +2/-1)
```diff
@@ -10,7 +10,8 @@
         android:theme="@style/Theme.AppCompat.DayNight"
         tools:ignore="GoogleAppIndexingWarning">
 
-        <activity android:name=".MainActivity">
+        <activity android:name=".MainActivity"
+            android:exported="true">
             <intent-filter>
                 <action android:name="android.intent.action.MAIN" />
                 <category android:name="android.intent.category.LAUNCHER" />
```

---

### Incident Patch 15: `31efbacc` (2022-10-28)
**Commit Message**: Merge pull request #210 from leisuresuit/master

Removed unnecessary dependency on appcompat library

**File**: `mvvm-core/build.gradle.kts` (modified, +1/-1)
```diff
@@ -13,6 +13,6 @@ dependencies {
 
     commonMainApi(libs.coroutines)
 
-    androidMainApi(libs.appCompat)
+    androidMainApi(libs.lifecycleKtx)
     androidMainApi(libs.androidViewModel)
 }
```

#### Recent Merged Pull Requests:
- **PR #276** (closed): Replaced a deprecated usage of the `launchWhenStarted` property (@kenkoro)
- **PR #268** (2024-03-24): Clarify SwiftUI ViewModel state null semantics (@darronschall)
- **PR #256** (2023-11-10): Fixed spelling mistakes (@mubashirpa)
- **PR #247** (2023-06-25): Dokka (@Alex009)
- **PR #240** (2023-04-21): Release 0.16.1 (@Alex009)
- **PR #239** (2023-04-21): Use explicit casts to workaround Swift 5.8 compiler issue. (@darronschall)
- **PR #235** (2023-04-08): Release 0.16.0 (@Alex009)
- **PR #233** (2023-04-08): #232 compose multiplatform (@Alex009)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
