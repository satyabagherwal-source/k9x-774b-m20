# Forensic Learning Record (Deep Inspection): InsertKoinIO/koin

> **Canonical Artifact**: `07_PROJECT_LEARNING/insertkoinio-koin-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/InsertKoinIO/koin](https://github.com/InsertKoinIO/koin))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:39:37.068Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `InsertKoinIO/koin`
- **Description**: Koin - a pragmatic lightweight dependency injection framework for Kotlin & Kotlin Multiplatform
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 10024 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/androidx-samples/src/main/java/org/koin/sample/sandbox/components/mvvm/SavedStateBundleViewModel.kt`
```
package org.koin.sample.sandbox.components.mvvm

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import org.koin.sample.sandbox.components.main.SimpleService

class SavedStateBundleViewModel(val handle: SavedStateHandle, val service: SimpleService) : ViewModel(){
    var result : String? = null
    init {
        result = handle.get<String>("id")
    }
}
```

### Core Architecture Module: `examples/androidx-samples/src/main/java/org/koin/sample/sandbox/components/mvvm/SavedStateViewModel.kt`
```
package org.koin.sample.sandbox.components.mvvm

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import org.koin.sample.sandbox.components.main.SimpleService
import java.util.*

class SavedStateViewModel(val handle: SavedStateHandle, val id: String, val service: SimpleService) : ViewModel(){
    init {
        val get = handle.get<String>(id)
        println("handle: $get")
        handle[id] = UUID.randomUUID().toString()
    }
}
```

### Core Architecture Module: `examples/androidx-samples/src/main/java/org/koin/sample/sandbox/utils/NavigateExt.kt`
```
package org.koin.sample.sandbox.utils

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Parcelable
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import java.io.Serializable

inline fun <reified T : Activity> Context.navigateTo(isRoot: Boolean = false, extras: Map<String, Any> = emptyMap()) {
    val intent = Intent(this,T::class.java)
    intent.apply {
        applyExtras(extras)
    }
    startActivity(intent)
}

inline fun <reified T : Activity> AppCompatActivity.navigateTo(isRoot: Boolean = false, extras: Map<String, Any> = emptyMap()) {
    val intent = Intent(this,T::class.java)
    intent.apply {
        applyExtras(extras)
    }
    startActivity(intent)
}

fun Intent.applyExtras(extras: Map<String, Any>) {
    extras.keys.forEach { key ->
        val value: Any? = extras[key]
        when (value) {
            is Int -> putExtra(key, value)
            is Long -> putExtra(key, value)
            is String -> putExtra(key, value)
            is Parcelable -> putExtra(key, value)
            is Serializable -> putExtra(key, value)
            else -> error("can't apply extra $key - unknown type")
        }
    }
}

inline fun <reified T : AppCompatActivity> Fragment.navigateTo(isRoot: Boolean = false, extras: Map<String, Any> = emptyMap()) {
    activity?.navigateTo<T>(isRoot, extras) ?: error("parent activity is null")
}

```

### Core Architecture Module: `examples/androidx-samples/src/main/java/org/koin/sample/sandbox/workmanager/SimpleWorker.kt`
```
package org.koin.sample.sandbox.workmanager

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.WorkerParameters

/**
 * @author : Fabio de Matos
 * @since : 16/02/2020
 **/
class SimpleWorker(
    private val simpleWorkerService: SimpleWorkerService,
    appContext: Context,
    private val params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        params
            .inputData
            .getInt(KEY_ANSWER, 0)
            .let {
                simpleWorkerService.addAnswer(it)
            }

        val d = Data.Builder()
            .putString("yes", "no")
            .build()

        return Result.success(d)
    }


    companion object {
        const val answer1st = 42
        const val answer2nd = 43
        const val KEY_ANSWER = "KEY_ANSWER"

        fun createData(answer: Int): Data {
            return Data.Builder()
                .putInt(KEY_ANSWER, answer)
                .build()
        }
    }
}
```

### Core Architecture Module: `examples/androidx-samples/src/main/java/org/koin/sample/sandbox/workmanager/SimpleWorkerService.kt`
```
package org.koin.sample.sandbox.workmanager

import kotlinx.coroutines.channels.Channel

/**
 * @author : Fabio de Matos
 * @since : 16/02/2020
 **/
class SimpleWorkerService {

    private val channel = Channel<Int>(Channel.BUFFERED)

    /**
     * Returns the next answer
     */
    suspend fun popAnswer(): Int {
        return channel.receive()
    }

    suspend fun addAnswer(answer: Int) {
        channel.send(answer)
    }

    fun isEmpty(): Boolean = channel.isEmpty
}
```

### Core Architecture Module: `projects/android/koin-androidx-workmanager/src/main/java/org/koin/androidx/workmanager/dsl/ScopeWorkerOf.kt`
```
/*
 * Copyright 2017-present the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.koin.androidx.workmanager.dsl

import androidx.work.ListenableWorker
import org.koin.core.definition.KoinDefinition
import org.koin.core.module.dsl.DefinitionOptions
import org.koin.core.module.dsl.new
import org.koin.core.module.dsl.onOptions
import org.koin.dsl.ScopeDSL

/**
 * Fragment Constructor DSL
 *
 * @author Arnaud Giuliani
 * @see new
 */
inline fun <reified R : ListenableWorker> ScopeDSL.workerOf(
    crossinline constructor: () -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1> ScopeDSL.workerOf(
    crossinline constructor: (T1) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2> ScopeDSL.workerOf(
    crossinline constructor: (T1, T2) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3> ScopeDSL.workerOf(
    crossinline constructor: (T1, T2, T3) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4> ScopeDSL.workerOf(
    crossinline constructor: (T1, T2, T3, T4) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5> ScopeDSL.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6> ScopeDSL.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7> ScopeDSL.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7, reified T8> ScopeDSL.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7, T8) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7, reified T8, reified T9> ScopeDSL.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7, T8, T9) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7, reified T8, reified T9, reified T10> ScopeDSL.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7, T8, T9, T10) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7, reified T8, reified T9, reified T10, reified T11> ScopeDSL.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7, reified T8, reified T9, reified T10, reified T11, reified T12> ScopeDSL.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7, reified T8, reified T9, reified T10, reified T11, reified T12, reified T13> ScopeDSL.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7, reified T8, reified T9, reified T10, reified T11, reified T12, reified T13, reified T14> ScopeDSL.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7, reified T8, reified T9, reified T10, reified T11, reified T12, reified T13, reified T14, reified T15> ScopeDSL.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7, reified T8, reified T9, reified T10, reified T11, reified T12, reified T13, reified T14, reified T15, reified T16> ScopeDSL.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7, reified T8, reified T9, reified T10, reified T11, reified T12, reified T13, reified T14, reified T15, reified T16, reified T17> ScopeDSL.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7, reified T8, reified T9, reified T10, reified T11, reified T12, reified T13, reified T14, reified T15, reified T16, reified T17, reified T18> ScopeDSL.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7, reified T8, reified T9, reified T10, reified T11, reified T12, reified T13, reified T14, reified T15, reified T16, reified T17, reified T18, reified T19> ScopeDSL.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7, reified T8, reified T9, reified T10, reified T11, reified T12, reified T13, reified T14, reified T15, reified T16, reified T17, reified T18, reified T19, reified T20> ScopeDSL.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7, reified T8, reified T9, reified T10, reified T11, reified T12, reified T13, reified T14, reified T15, reified T16, reified T17, reified T18, reified T19, reified T20, reified T21> ScopeDSL.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T
```

### Core Architecture Module: `projects/android/koin-androidx-workmanager/src/main/java/org/koin/androidx/workmanager/dsl/WorkerOf.kt`
```
/*
 * Copyright 2017-present the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.koin.androidx.workmanager.dsl

import androidx.work.ListenableWorker
import org.koin.core.definition.KoinDefinition
import org.koin.core.module.Module
import org.koin.core.module.dsl.DefinitionOptions
import org.koin.core.module.dsl.new
import org.koin.core.module.dsl.onOptions

/**
 * Fragment Constructor DSL
 *
 * @author Arnaud Giuliani
 * @see new
 */
inline fun <reified R : ListenableWorker> Module.workerOf(
    crossinline constructor: () -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1> Module.workerOf(
    crossinline constructor: (T1) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2> Module.workerOf(
    crossinline constructor: (T1, T2) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3> Module.workerOf(
    crossinline constructor: (T1, T2, T3) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4> Module.workerOf(
    crossinline constructor: (T1, T2, T3, T4) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5> Module.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6> Module.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7> Module.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7, reified T8> Module.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7, T8) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7, reified T8, reified T9> Module.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7, T8, T9) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7, reified T8, reified T9, reified T10> Module.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7, T8, T9, T10) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7, reified T8, reified T9, reified T10, reified T11> Module.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7, reified T8, reified T9, reified T10, reified T11, reified T12> Module.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7, reified T8, reified T9, reified T10, reified T11, reified T12, reified T13> Module.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7, reified T8, reified T9, reified T10, reified T11, reified T12, reified T13, reified T14> Module.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7, reified T8, reified T9, reified T10, reified T11, reified T12, reified T13, reified T14, reified T15> Module.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7, reified T8, reified T9, reified T10, reified T11, reified T12, reified T13, reified T14, reified T15, reified T16> Module.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7, reified T8, reified T9, reified T10, reified T11, reified T12, reified T13, reified T14, reified T15, reified T16, reified T17> Module.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7, reified T8, reified T9, reified T10, reified T11, reified T12, reified T13, reified T14, reified T15, reified T16, reified T17, reified T18> Module.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7, reified T8, reified T9, reified T10, reified T11, reified T12, reified T13, reified T14, reified T15, reified T16, reified T17, reified T18, reified T19> Module.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7, reified T8, reified T9, reified T10, reified T11, reified T12, reified T13, reified T14, reified T15, reified T16, reified T17, reified T18, reified T19, reified T20> Module.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20) -> R,
    noinline options: DefinitionOptions<R>? = null,
): KoinDefinition<*> = worker { new(constructor) }.onOptions(options)

/**
 * @see workerOf
 */
inline fun <reified R : ListenableWorker, reified T1, reified T2, reified T3, reified T4, reified T5, reified T6, reified T7, reified T8, reified T9, reified T10, reified T11, reified T12, reified T13, reified T14, reified T15, reified T16, reified T17, reified T18, reified T19, reified T20, reified T21> Module.workerOf(
    crossinline constructor: (T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13,
```

### Core Architecture Module: `projects/android/koin-androidx-workmanager/src/main/java/org/koin/androidx/workmanager/factory/KoinWorkerFactory.kt`
```
/*
 * Copyright 2017-present the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.koin.androidx.workmanager.factory

import android.content.Context
import androidx.work.ListenableWorker
import androidx.work.WorkerFactory
import androidx.work.WorkerParameters
import org.koin.core.component.KoinComponent
import org.koin.core.component.get
import org.koin.core.parameter.parametersOf
import org.koin.core.qualifier.named

/**
 * Provides an implementation of [WorkerFactory] that ties into Koin DI.
 *
 * @author Fabio de Matos
 * @author Arnaud Giuliani
 * @author Konstantin Mutasov
 **/
class KoinWorkerFactory : WorkerFactory(), KoinComponent {

    override fun createWorker(
        appContext: Context,
        workerClassName: String,
        workerParameters: WorkerParameters,
    ): ListenableWorker? {
        return getKoin().getOrNull(qualifier = named(workerClassName)) { parametersOf(workerParameters) }
    }
}


```

### Core Architecture Module: `projects/android/koin-androidx-workmanager/src/main/java/org/koin/plugin/module/dsl/WorkerDSLExt.kt`
```
package org.koin.plugin.module.dsl

import androidx.work.ListenableWorker
import org.koin.core.definition.KoinDefinition
import org.koin.core.module.KoinDslMarker
import org.koin.core.module.Module
import org.koin.dsl.ScopeDSL

@KoinDslMarker
public fun <T : ListenableWorker> Module.worker(): KoinDefinition<T> { TODO(USE_KOIN_COMPILER_PLUGIN) }

@KoinDslMarker
public fun <T : ListenableWorker> ScopeDSL.worker(): KoinDefinition<T> { TODO(USE_KOIN_COMPILER_PLUGIN) }

```

### Core Architecture Module: `projects/android/koin-androidx-workmanager/src/main/java/org/koin/plugin/module/dsl/WorkerModuleExt.kt`
```
package org.koin.plugin.module.dsl

import androidx.work.ListenableWorker
import org.koin.core.annotation.KoinInternalApi
import org.koin.core.definition.Definition
import org.koin.core.definition.Kind
import org.koin.core.definition.KoinDefinition
import org.koin.core.module.Module
import org.koin.core.qualifier.Qualifier
import org.koin.dsl.ScopeDSL
import kotlin.reflect.KClass


/**
 * Build a worker definition with explicit KClass.
 * Used by the compiler plugin for generated worker definitions.
 *
 * Workers are registered as factories and automatically bound to ListenableWorker.
 */
@OptIn(KoinInternalApi::class)
public fun <T : ListenableWorker> Module.buildWorker(kclass: KClass<T>, qualifier: Qualifier? = null, definition: Definition<T>): KoinDefinition<T> {
    return createDefinition(kclass, definition, qualifier = qualifier, factoryKind = Kind.Factory, module = this).bind(ListenableWorker::class) as KoinDefinition<T>
}

/**
 * Build a worker definition in a scope with explicit KClass.
 * Used by the compiler plugin for generated scope definitions.
 */
@OptIn(KoinInternalApi::class)
public fun <T : ListenableWorker> ScopeDSL.buildWorker(kclass: KClass<T>, qualifier: Qualifier? = null, definition: Definition<T>): KoinDefinition<T> {
    return createDefinition(kclass, definition, qualifier = qualifier, scopeQualifier = scopeQualifier, factoryKind = Kind.Factory, module = module).bind(ListenableWorker::class) as KoinDefinition<T>
}

```

### Core Architecture Module: `projects/core/benchmark/src/commonMain/kotlin/org/koin/benchmark/bind_classes.kt`
```
package org.koin.benchmark

// Parallel class hierarchy dedicated to the bind() registration benchmark.
// Kept separate from Perfs so the baseline benches (perfModule400, retrieveDependency)
// stay free of interface tags and remain comparable to historical bench_results.txt rows.

interface IA
interface IB
interface IC
interface ID

@Suppress("unused")
class BindPerfs {
    class BA1 : IA
    class BB1 : IB
    class BC1 : IC
    class BD1 : ID
    class BA2 : IA
    class BB2 : IB
    class BC2 : IC
    class BD2 : ID
    class BA3 : IA
    class BB3 : IB
    class BC3 : IC
    class BD3 : ID
    class BA4 : IA
    class BB4 : IB
    class BC4 : IC
    class BD4 : ID
    class BA5 : IA
    class BB5 : IB
    class BC5 : IC
    class BD5 : ID
    class BA6 : IA
    class BB6 : IB
    class BC6 : IC
    class BD6 : ID
    class BA7 : IA
    class BB7 : IB
    class BC7 : IC
    class BD7 : ID
    class BA8 : IA
    class BB8 : IB
    class BC8 : IC
    class BD8 : ID
    class BA9 : IA
    class BB9 : IB
    class BC9 : IC
    class BD9 : ID
    class BA10 : IA
    class BB10 : IB
    class BC10 : IC
    class BD10 : ID
    class BA11 : IA
    class BB11 : IB
    class BC11 : IC
    class BD11 : ID
    class BA12 : IA
    class BB12 : IB
    class BC12 : IC
    class BD12 : ID
    class BA13 : IA
    class BB13 : IB
    class BC13 : IC
    class BD13 : ID
    class BA14 : IA
    class BB14 : IB
    class BC14 : IC
    class BD14 : ID
    class BA15 : IA
    class BB15 : IB
    class BC15 : IC
    class BD15 : ID
    class BA16 : IA
    class BB16 : IB
    class BC16 : IC
    class BD16 : ID
    class BA17 : IA
    class BB17 : IB
    class BC17 : IC
    class BD17 : ID
    class BA18 : IA
    class BB18 : IB
    class BC18 : IC
    class BD18 : ID
    class BA19 : IA
    class BB19 : IB
    class BC19 : IC
    class BD19 : ID
    class BA20 : IA
    class BB20 : IB
    class BC20 : IC
    class BD20 : ID
    class BA21 : IA
    class BB21 : IB
    class BC21 : IC
    class BD21 : ID
    class BA22 : IA
    class BB22 : IB
    class BC22 : IC
    class BD22 : ID
    class BA23 : IA
    class BB23 : IB
    class BC23 : IC
    class BD23 : ID
    class BA24 : IA
    class BB24 : IB
    class BC24 : IC
    class BD24 : ID
    class BA25 : IA
    class BB25 : IB
    class BC25 : IC
    class BD25 : ID
    class BA26 : IA
    class BB26 : IB
    class BC26 : IC
    class BD26 : ID
    class BA27 : IA
    class BB27 : IB
    class BC27 : IC
    class BD27 : ID
    class BA28 : IA
    class BB28 : IB
    class BC28 : IC
    class BD28 : ID
    class BA29 : IA
    class BB29 : IB
    class BC29 : IC
    class BD29 : ID
    class BA30 : IA
    class BB30 : IB
    class BC30 : IC
    class BD30 : ID
    class BA31 : IA
    class BB31 : IB
    class BC31 : IC
    class BD31 : ID
    class BA32 : IA
    class BB32 : IB
    class BC32 : IC
    class BD32 : ID
    class BA33 : IA
    class BB33 : IB
    class BC33 : IC
    class BD33 : ID
    class BA34 : IA
    class BB34 : IB
    class BC34 : IC
    class BD34 : ID
    class BA35 : IA
    class BB35 : IB
    class BC35 : IC
    class BD35 : ID
    class BA36 : IA
    class BB36 : IB
    class BC36 : IC
    class BD36 : ID
    class BA37 : IA
    class BB37 : IB
    class BC37 : IC
    class BD37 : ID
    class BA38 : IA
    class BB38 : IB
    class BC38 : IC
    class BD38 : ID
    class BA39 : IA
    class BB39 : IB
    class BC39 : IC
    class BD39 : ID
    class BA40 : IA
    class BB40 : IB
    class BC40 : IC
    class BD40 : ID
    class BA41 : IA
    class BB41 : IB
    class BC41 : IC
    class BD41 : ID
    class BA42 : IA
    class BB42 : IB
    class BC42 : IC
    class BD42 : ID
    class BA43 : IA
    class BB43 : IB
    class BC43 : IC
    class BD43 : ID
    class BA44 : IA
    class BB44 : IB
    class BC44 : IC
    class BD44 : ID
    class BA45 : IA
    class BB45 : IB
    class BC45 : IC
    class BD45 : ID
    class BA46 : IA
    class BB46 : IB
    class BC46 : IC
    class BD46 : ID
    class BA47 : IA
    class BB47 : IB
    class BC47 : IC
    class BD47 : ID
    class BA48 : IA
    class BB48 : IB
    class BC48 : IC
    class BD48 : ID
    class BA49 : IA
    class BB49 : IB
    class BC49 : IC
    class BD49 : ID
    class BA50 : IA
    class BB50 : IB
    class BC50 : IC
    class BD50 : ID
    class BA51 : IA
    class BB51 : IB
    class BC51 : IC
    class BD51 : ID
    class BA52 : IA
    class BB52 : IB
    class BC52 : IC
    class BD52 : ID
    class BA53 : IA
    class BB53 : IB
    class BC53 : IC
    class BD53 : ID
    class BA54 : IA
    class BB54 : IB
    class BC54 : IC
    class BD54 : ID
    class BA55 : IA
    class BB55 : IB
    class BC55 : IC
    class BD55 : ID
    class BA56 : IA
    class BB56 : IB
    class BC56 : IC
    class BD56 : ID
    class BA57 : IA
    class BB57 : IB
    class BC57 : IC
    class BD57 : ID
    class BA58 : IA
    class BB58 : IB
    class BC58 : IC
    class BD58 : ID
    class BA59 : IA
    class BB59 : IB
    class BC59 : IC
    class BD59 : ID
    class BA60 : IA
    class BB60 : IB
    class BC60 : IC
    class BD60 : ID
    class BA61 : IA
    class BB61 : IB
    class BC61 : IC
    class BD61 : ID
    class BA62 : IA
    class BB62 : IB
    class BC62 : IC
    class BD62 : ID
    class BA63 : IA
    class BB63 : IB
    class BC63 : IC
    class BD63 : ID
    class BA64 : IA
    class BB64 : IB
    class BC64 : IC
    class BD64 : ID
    class BA65 : IA
    class BB65 : IB
    class BC65 : IC
    class BD65 : ID
    class BA66 : IA
    class BB66 : IB
    class BC66 : IC
    class BD66 : ID
    class BA67 : IA
    class BB67 : IB
    class BC67 : IC
    class BD67 : ID
    class BA68 : IA
    class BB68 : IB
    class BC68 : IC
    class BD68 : ID
    class BA69 : IA
    class BB69 : IB
    class BC69 : IC
    class BD69 : ID
    class BA70 : IA
    class BB70 : IB
    class BC70 : IC
    class BD70 : ID
    class BA71 : IA
    class BB71 : IB
    class BC71 : IC
    class BD71 : ID
    class BA72 : IA
    class BB72 : IB
    class BC72 : IC
    class BD72 : ID
    class BA73 : IA
    class BB73 : IB
    class BC73 : IC
    class BD73 : ID
    class BA74 : IA
    class BB74 : IB
    class BC74 : IC
    class BD74 : ID
    class BA75 : IA
    class BB75 : IB
    class BC75 : IC
    class BD75 : ID
    class BA76 : IA
    class BB76 : IB
    class BC76 : IC
    class BD76 : ID
    class BA77 : IA
    class BB77 : IB
    class BC77 : IC
    class BD77 : ID
    class BA78 : IA
    class BB78 : IB
    class BC78 : IC
    class BD78 : ID
    class BA79 : IA
    class BB79 : IB
    class BC79 : IC
    class BD79 : ID
    class BA80 : IA
    class BB80 : IB
    class BC80 : IC
    class BD80 : ID
    class BA81 : IA
    class BB81 : IB
    class BC81 : IC
    class BD81 : ID
    class BA82 : IA
    class BB82 : IB
    class BC82 : IC
    class BD82 : ID
    class BA83 : IA
    class BB83 : IB
    class BC83 : IC
    class BD83 : ID
    class BA84 : IA
    class BB84 : IB
    class BC84 : IC
    class BD84 : ID
    class BA85 : IA
    class BB85 : IB
    class BC85 : IC
    class BD85 : ID
    class BA86 : IA
    class BB86 : IB
    class BC86 : IC
    class BD86 : ID
    class BA87 : IA
    class BB87 : IB
    class BC87 : IC
    class BD87 : ID
    class BA88 : IA
    class BB88 : IB
    class BC88 : IC
    class BD88 : ID
    class BA89 : IA
    class BB89 : IB
    class BC89 : IC
    class BD89 : ID
    class BA90 : IA
    class BB90 : IB
    class BC90 : IC
    class BD90 : ID
    class BA91 : IA
    class BB91 : IB
    class BC91 : IC
    class BD91 : ID
    class BA92 : IA
    class BB92 : IB
    class BC92 : IC
    class BD92 : ID
    class BA93 : IA
    class BB93 : IB
    class BC93 : IC
    class BD93 : ID
    class BA94 : IA
    class BB94 : IB
    class BC94 : IC
    class BD94 : ID
    class BA95 : IA
    class BB95 : IB
    class BC95 : IC
    class BD95 : ID
    class BA96 : IA
    class BB96 : IB
    class BC96 : IC
    class BD96 : ID
    class BA97 : IA
    class BB97 : IB
    class BC97 : IC
    class BD97 : ID
    class BA98 : IA
    class BB98 : IB
    class BC98 : IC
    class BD98 : ID
    class BA99 : IA
    class BB99 : IB
    class BC99 : IC
    class BD99 : ID
    class BA100 : IA
    class BB100 : IB
    class BC100 : IC
    class BD100 : ID
}

```

### Core Architecture Module: `projects/core/benchmark/src/commonMain/kotlin/org/koin/benchmark/classes.kt`
```
package org.koin.benchmark

@Suppress("unused")
class Perfs {
    class A1
    class B1(val a: A1)
    class C1(val a: A1, val b: B1)
    class D1(val a: A1, val b: B1, val c: C1)
    class A2
    class B2(val a: A2)
    class C2(val a: A2, val b: B2)
    class D2(val a: A2, val b: B2, val c: C2)
    class A3
    class B3(val a: A3)
    class C3(val a: A3, val b: B3)
    class D3(val a: A3, val b: B3, val c: C3)
    class A4
    class B4(val a: A4)
    class C4(val a: A4, val b: B4)
    class D4(val a: A4, val b: B4, val c: C4)
    class A5
    class B5(val a: A5)
    class C5(val a: A5, val b: B5)
    class D5(val a: A5, val b: B5, val c: C5)
    class A6
    class B6(val a: A6)
    class C6(val a: A6, val b: B6)
    class D6(val a: A6, val b: B6, val c: C6)
    class A7
    class B7(val a: A7)
    class C7(val a: A7, val b: B7)
    class D7(val a: A7, val b: B7, val c: C7)
    class A8
    class B8(val a: A8)
    class C8(val a: A8, val b: B8)
    class D8(val a: A8, val b: B8, val c: C8)
    class A9
    class B9(val a: A9)
    class C9(val a: A9, val b: B9)
    class D9(val a: A9, val b: B9, val c: C9)
    class A10
    class B10(val a: A10)
    class C10(val a: A10, val b: B10)
    class D10(val a: A10, val b: B10, val c: C10)
    class A11
    class B11(val a: A11)
    class C11(val a: A11, val b: B11)
    class D11(val a: A11, val b: B11, val c: C11)
    class A12
    class B12(val a: A12)
    class C12(val a: A12, val b: B12)
    class D12(val a: A12, val b: B12, val c: C12)
    class A13
    class B13(val a: A13)
    class C13(val a: A13, val b: B13)
    class D13(val a: A13, val b: B13, val c: C13)
    class A14
    class B14(val a: A14)
    class C14(val a: A14, val b: B14)
    class D14(val a: A14, val b: B14, val c: C14)
    class A15
    class B15(val a: A15)
    class C15(val a: A15, val b: B15)
    class D15(val a: A15, val b: B15, val c: C15)
    class A16
    class B16(val a: A16)
    class C16(val a: A16, val b: B16)
    class D16(val a: A16, val b: B16, val c: C16)
    class A17
    class B17(val a: A17)
    class C17(val a: A17, val b: B17)
    class D17(val a: A17, val b: B17, val c: C17)
    class A18
    class B18(val a: A18)
    class C18(val a: A18, val b: B18)
    class D18(val a: A18, val b: B18, val c: C18)
    class A19
    class B19(val a: A19)
    class C19(val a: A19, val b: B19)
    class D19(val a: A19, val b: B19, val c: C19)
    class A20
    class B20(val a: A20)
    class C20(val a: A20, val b: B20)
    class D20(val a: A20, val b: B20, val c: C20)
    class A21
    class B21(val a: A21)
    class C21(val a: A21, val b: B21)
    class D21(val a: A21, val b: B21, val c: C21)
    class A22
    class B22(val a: A22)
    class C22(val a: A22, val b: B22)
    class D22(val a: A22, val b: B22, val c: C22)
    class A23
    class B23(val a: A23)
    class C23(val a: A23, val b: B23)
    class D23(val a: A23, val b: B23, val c: C23)
    class A24
    class B24(val a: A24)
    class C24(val a: A24, val b: B24)
    class D24(val a: A24, val b: B24, val c: C24)
    class A25
    class B25(val a: A25)
    class C25(val a: A25, val b: B25)
    class D25(val a: A25, val b: B25, val c: C25)
    class A26
    class B26(val a: A26)
    class C26(val a: A26, val b: B26)
    class D26(val a: A26, val b: B26, val c: C26)
    class A27
    class B27(val a: A27)
    class C27(val a: A27, val b: B27)
    class D27(val a: A27, val b: B27, val c: C27)
    class A28
    class B28(val a: A28)
    class C28(val a: A28, val b: B28)
    class D28(val a: A28, val b: B28, val c: C28)
    class A29
    class B29(val a: A29)
    class C29(val a: A29, val b: B29)
    class D29(val a: A29, val b: B29, val c: C29)
    class A30
    class B30(val a: A30)
    class C30(val a: A30, val b: B30)
    class D30(val a: A30, val b: B30, val c: C30)
    class A31
    class B31(val a: A31)
    class C31(val a: A31, val b: B31)
    class D31(val a: A31, val b: B31, val c: C31)
    class A32
    class B32(val a: A32)
    class C32(val a: A32, val b: B32)
    class D32(val a: A32, val b: B32, val c: C32)
    class A33
    class B33(val a: A33)
    class C33(val a: A33, val b: B33)
    class D33(val a: A33, val b: B33, val c: C33)
    class A34
    class B34(val a: A34)
    class C34(val a: A34, val b: B34)
    class D34(val a: A34, val b: B34, val c: C34)
    class A35
    class B35(val a: A35)
    class C35(val a: A35, val b: B35)
    class D35(val a: A35, val b: B35, val c: C35)
    class A36
    class B36(val a: A36)
    class C36(val a: A36, val b: B36)
    class D36(val a: A36, val b: B36, val c: C36)
    class A37
    class B37(val a: A37)
    class C37(val a: A37, val b: B37)
    class D37(val a: A37, val b: B37, val c: C37)
    class A38
    class B38(val a: A38)
    class C38(val a: A38, val b: B38)
    class D38(val a: A38, val b: B38, val c: C38)
    class A39
    class B39(val a: A39)
    class C39(val a: A39, val b: B39)
    class D39(val a: A39, val b: B39, val c: C39)
    class A40
    class B40(val a: A40)
    class C40(val a: A40, val b: B40)
    class D40(val a: A40, val b: B40, val c: C40)
    class A41
    class B41(val a: A41)
    class C41(val a: A41, val b: B41)
    class D41(val a: A41, val b: B41, val c: C41)
    class A42
    class B42(val a: A42)
    class C42(val a: A42, val b: B42)
    class D42(val a: A42, val b: B42, val c: C42)
    class A43
    class B43(val a: A43)
    class C43(val a: A43, val b: B43)
    class D43(val a: A43, val b: B43, val c: C43)
    class A44
    class B44(val a: A44)
    class C44(val a: A44, val b: B44)
    class D44(val a: A44, val b: B44, val c: C44)
    class A45
    class B45(val a: A45)
    class C45(val a: A45, val b: B45)
    class D45(val a: A45, val b: B45, val c: C45)
    class A46
    class B46(val a: A46)
    class C46(val a: A46, val b: B46)
    class D46(val a: A46, val b: B46, val c: C46)
    class A47
    class B47(val a: A47)
    class C47(val a: A47, val b: B47)
    class D47(val a: A47, val b: B47, val c: C47)
    class A48
    class B48(val a: A48)
    class C48(val a: A48, val b: B48)
    class D48(val a: A48, val b: B48, val c: C48)
    class A49
    class B49(val a: A49)
    class C49(val a: A49, val b: B49)
    class D49(val a: A49, val b: B49, val c: C49)
    class A50
    class B50(val a: A50)
    class C50(val a: A50, val b: B50)
    class D50(val a: A50, val b: B50, val c: C50)
    class A51
    class B51(val a: A51)
    class C51(val a: A51, val b: B51)
    class D51(val a: A51, val b: B51, val c: C51)
    class A52
    class B52(val a: A52)
    class C52(val a: A52, val b: B52)
    class D52(val a: A52, val b: B52, val c: C52)
    class A53
    class B53(val a: A53)
    class C53(val a: A53, val b: B53)
    class D53(val a: A53, val b: B53, val c: C53)
    class A54
    class B54(val a: A54)
    class C54(val a: A54, val b: B54)
    class D54(val a: A54, val b: B54, val c: C54)
    class A55
    class B55(val a: A55)
    class C55(val a: A55, val b: B55)
    class D55(val a: A55, val b: B55, val c: C55)
    class A56
    class B56(val a: A56)
    class C56(val a: A56, val b: B56)
    class D56(val a: A56, val b: B56, val c: C56)
    class A57
    class B57(val a: A57)
    class C57(val a: A57, val b: B57)
    class D57(val a: A57, val b: B57, val c: C57)
    class A58
    class B58(val a: A58)
    class C58(val a: A58, val b: B58)
    class D58(val a: A58, val b: B58, val c: C58)
    class A59
    class B59(val a: A59)
    class C59(val a: A59, val b: B59)
    class D59(val a: A59, val b: B59, val c: C59)
    class A60
    class B60(val a: A60)
    class C60(val a: A60, val b: B60)
    class D60(val a: A60, val b: B60, val c: C60)
    class A61
    class B61(val a: A61)
    class C61(val a: A61, val b: B61)
    class D61(val a: A61, val b: B61, val c: C61)
    class A62
    class B62(val a: A62)
    class C62(val a: A62, val b: B62)
    class D62(val a: A62, val b: B62, val c: C62)
    class A63
    class B63(val a: A63)
    class C63(val a: A63, val b: B63)
    class D63(val a: A63, val b: B63, val c: C63)
    class A64
    class B64(val a: A64)
    class C64(val a: A64, val b: B64)
    class D64(val a: A64, val b: B64, val c: C64)
    class A65
    class B65(val a: A65)
    class C65(val a: A65, val b: B65)
    class D65(val a: A65, val b: B65, val c: C65)
    class A66
    class B66(val a: A66)
    class C66(val a: A66, val b: B66)
    class D66(val a: A66, val b: B66, val c: C66)
    class A67
    class B67(val a: A67)
    class C67(val a: A67, val b: B67)
    class D67(val a: A67, val b: B67, val c: C67)
    class A68
    class B68(val a: A68)
    class C68(val a: A68, val b: B68)
    class D68(val a: A68, val b: B68, val c: C68)
    class A69
    class B69(val a: A69)
    class C69(val a: A69, val b: B69)
    class D69(val a: A69, val b: B69, val c: C69)
    class A70
    class B70(val a: A70)
    class C70(val a: A70, val b: B70)
    class D70(val a: A70, val b: B70, val c: C70)
    class A71
    class B71(val a: A71)
    class C71(val a: A71, val b: B71)
    class D71(val a: A71, val b: B71, val c: C71)
    class A72
    class B72(val a: A72)
    class C72(val a: A72, val b: B72)
    class D72(val a: A72, val b: B72, val c: C72)
    class A73
    class B73(val a: A73)
    class C73(val a: A73, val b: B73)
    class D73(val a: A73, val b: B73, val c: C73)
    class A74
    class B74(val a: A74)
    class C74(val a: A74, val b: B74)
    class D74(val a: A74, val b: B74, val c: C74)
    class A75
    class B75(val a: A75)
    class C75(val a: A75, val b: B75)
    class D75(val a: A75, val b: B75, val c: C75)
    class A76
    class B76(val a: A76)
    class C76(val a: A76, val b: B76)
    class D76(val a: A76, val b: B76, val c: C76)
    class A77
    class B77(val a: A77)
    class C77(val a: A77, val b: B77)
    class D77(val a: A77, val b: B77, val c: C77)
    class A78
    class B78(val a: A78)
    class C78(val a: A78, val b: B78)
    class D78(val a: A78, val b: B78, val c: C78)
    class A79
    class B79(val a: A79)
    
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2466** (2026-09-07): **Setup koin version catalog**
  *Symptoms*: #2252 
  **Post-Mortem & Fix Analysis**:
  > closed in favor of #2465 

- **Issue #2458** (2026-08-20): **Villanueva**
  *Symptoms*: Gollop
  **Post-Mortem & Fix Analysis**:
  > > Gollop  Csrf

- **Issue #2457** (2026-08-20): **Economía**
  *Symptoms*: @##*$$"_' Copilot encountered an error and was unable to review this pull request. You can try again by re-requesting a review.### **je**
  **Post-Mortem & Fix Analysis**:
  > ### B
  > ### H

- **Issue #2456** (2026-09-10): **Koin Compiler 1.1.0 & Coming Koin 4.3**
  *Symptoms*: Hey Koin community,  The new Koin Compiler Plugin 1.1.0 release has landed: https://github.com/InsertKoinIO/koin-compiler-plugin/issues/82 TL;DR: - No more false "missing dependency" errors in multi-module projects - Stay compatible with allWarningsAsErrors - Fixed a file-name-length crashes - Clearer error messages  Also to keep you in touch with incoming new capacity coming in Koin 4.3. - Stabilizing Navigation 3 APIs and patterns - Coroutines integration (resolving async definitions) - Job Scheduler to let you drive more background work directly from Koin  We are always keen to look at new interesting integrations.  Feedback and bug reports always welcome 🙏
  **Post-Mortem & Fix Analysis**:
  > Hi! The roadmap mentions:  > Job Scheduler to let you drive more background work directly from Koin.  This sounds really interesting! Could you share a bit more about it? Is it related to Android's `JobScheduler` API, or is it a completely different concept?
  > JobScheduler should be more agnostic for Koin, but help also fallback in native side like Android. We will share APIs example 👍 

- **Issue #2452** (2026-07-08): **Missing dependency with Multi-Module**
  *Symptoms*: **Describe the bug** When using Koin and Koin Compiler with multi-module architecture, the build fails with the following error:  ```kotlin [Koin][KOIN-D001] Missing dependency: com.kfaraj.samples.koin.multimodule.data.MainRepository   required by: com.kfaraj.samples.koin.multimodule.feature.MainViewModel (parameter 'repository')   in module: MainApplication (startKoin) ```  **To Reproduce** Build the following project:  ```kotlin // app/build.gradle.kts  dependencies {     implementation(project(":feature")) }  // app/src/main/kotlin/MainApplication.kt  @KoinApplication(modules = [AppModule::class]) class MainApplication : Application() {      override fun onCreate() {         super.onCreate()         startKoin<MainApplication>()     }  }  // app/src/main/kotlin/AppModule.kt  @Module(includes = [FeatureModule::class]) @ComponentScan object AppModule  // feature/build.gradle.kts  dependencies {     implementation(project(":data")) }  // feature/src/main/kotlin/MainViewModel.kt  @Factory public class MainViewModel internal constructor(     repository: MainRepository ) {     public val uiState: String = repository.message }  // feature/src/main/kotlin/FeatureModule.kt  @Module(includes = [DataModule::class]) @ComponentScan public object FeatureModule  // data/src/main/kotlin/MainRepository.kt  public interface MainRepository {     public val message: String }  // data/src/main/kotlin/DefaultMainRepository.kt  @Single internal class DefaultMainRepository : MainRepository {     o
  **Post-Mortem & Fix Analysis**:
  > Duplicate of InsertKoinIO/koin-compiler-plugin#51 — same cross-module compileSafety false positive (`KOIN-D001` on a sibling-module provider composed at the aggregator). Tracked there (milestone 1.0.2). The fix degrades the unresolvable-at-compile-time case to a warning + validates the full graph at the `@KoinApplication` entry point.  Thanks for the clean minimal repro — it's referenced in the fix work. Closing here; please follow InsertKoinIO/koin-compiler-plugin#51.

- **Issue #2451** (2026-09-10): **Compiler Plugin breaks if mixing with "normal" DSL**
  *Symptoms*: **Describe the bug** If you use `single<...>()` together with `single<...> { .... }` the compiler plugin falsely states that it is missing definitions.  **To Reproduce** See attached reproduction project. A minimalistic ktor app with just a root endpoint to trigger the behavior.  In short: defining the module like this ```kotlin import org.koin.dsl.module  val testModule = module {     single<MyInterface> { Foo() } // class Foo : MyInterface } .... val foo by inject<MyInterface>() val bar by inject<Bar>() call.respond(foo.foo() + bar.bar()) ``` compiles even though in my opinion it shouldnt. But like this, it says it is missing definitions for **MyInterface** ```kotlin import org.koin.dsl.module import org.koin.plugin.module.dsl.single  val testModule = module {     single<MyInterface> { Foo() }     single<Bar>() } ... val foo by inject<MyInterface>() val bar by inject<Bar>() call.respond(foo.foo() + bar.bar()) ```  **Expected behavior** I should be able to mix both overloads of the `single` function.  **Koin module and version:** Koin 4.2.2, Koin Compiler Plugin 1.0.1, Kotlin 2.3.21  **Snippet or Sample project to help reproduce**  [reproduction.zip](https://github.com/user-attachments/files/29103836/reproduction.zip) 
  **Post-Mortem & Fix Analysis**:
  > I face absolutely the same issue on my side.  1. Mixing single<...>() together with single<...> { .... } is possible and breaks compile time validation. It is quite easy to end up mixing those and end up with no compile time safety. Ideally mixing those two should be impossible. 2. If you need to use [function builders](https://insert-koin.io/docs/reference/koin-core/definitions#function-builders-with-create) the way showcased by the official documentation for the compiler plugin the single/factory usage is based on the old dsl format and thus ends up with non working compile time validation. I could not find a way to use function builders without the old dsl syntax. Here is an example which can be run as unit test  ``` import org.koin.core.context.startKoin import org.koin.core.context.stopKoin import org.koin.dsl.module import org.koin.plugin.module.dsl.create import kotlin.test.Test  class KoinComplierPluginTest {      @Test     fun koinWithBMissingAndUsingFunctionBuildersShouldFail
  > KCP 1.2.1 is getting on that, you can freely mix DSL if needed

- **Issue #2448** (2026-06-12): **Finalize 4.2.2 — version bump + Navigation 3 typed entryProvider docs (#2336)**
  *Symptoms*: Finalizes the 4.2.2 release.  ## Version Bump `koinVersion` `4.2.2-Alpha1` → **`4.2.2`**.  ## #2336 — Navigation 3 typed `entryProvider` (docs) `koinEntryProvider<T>()` is already generic (`(T) -> NavEntry<T>`). The reported mismatch happens when it's called as `koinEntryProvider<Any>()` but `NavDisplay` is typed (e.g. via a typed `SceneStrategy` such as `rememberSupportingPaneSceneStrategy<Route>()`) — the compiler then infers `NavDisplay<Route>` and expects `(Route) -> NavEntry<Route>`. The API didn't need changing; the fix is to **document** passing the route type: ```kotlin val entryProvider = koinEntryProvider<Route>()   // matches NavDisplay<Route> // or: val entryProvider: EntryProvider<Route> = koinEntryProvider() ``` Added a `:::tip` to the Navigation 3 reference page covering the exact error and both forms.  ## Verification - Docs + version only — no code change. `./gradlew apiCheck` passes (no `.api` delta).  Closes #2336.  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #2447** (2026-06-12): **Fix #2386 - withOptions leaves stale index entries on qualifier/secondary change**
  *Symptoms*: ## Problem `withOptions` mutates a `BeanDefinition` in place, then re-indexes from the mutated state — but never removes the entry registered under the **previous** coordinates. So: ```kotlin single<Foo>(named("a")) { Foo() } withOptions { qualifier = named("b") } ``` leaves **both** `Foo:a` (stale) and `Foo:b` in `Module.mappings`, pointing at the same factory — `get<Foo>(named("a"))` still resolves even though the definition's qualifier is now `b`. With `secondaryTypes` it gets worse: secondaries are indexed only under the new qualifier, so `Foo` is reachable via old+new but `Bar` only via new (asymmetry). Fixes #2386.  ## Fix Snapshot the previous `qualifier` + `secondaryTypes` before applying the options; when either changes, drop the stale `mappings` entries (old primary + old secondaries under the old qualifier) before re-indexing with the new coordinates: ```kotlin val previousQualifier = def.qualifier val previousSecondaryTypes = def.secondaryTypes.toList() def.also(options) if (def.qualifier != previousQualifier || def.secondaryTypes != previousSecondaryTypes) {     module.mappings.remove(indexKey(def.primaryType, previousQualifier, def.scopeQualifier))     previousSecondaryTypes.forEach { module.mappings.remove(indexKey(it, previousQualifier, def.scopeQualifier)) }     module.indexPrimaryType(factory)     if (def.secondaryTypes.isNotEmpty()) module.indexSecondaryTypes(factory) } ``` No-op when nothing index-relevant changed.  ## Behavioral note (resolution semantics
  **Post-Mortem & Fix Analysis**:
  > ⚠️ Converting to draft — this fix regresses `koin-android` `DSLExtendedTest.android dsl`.  **Root cause of the regression:** with two same-type definitions — ```kotlin viewModelOf(::MyViewModel)               // (1) indexes MyViewModel:null viewModelOf(::MyViewModel){ named("bis") } // (2) indexes MyViewModel:null at creation (overwrites (1)!), then withOptions moves it to :bis ``` — the `*Of(ctor){options}` builders index under the **null** qualifier first and only change it afterward, so (2) transiently collides with (1) at `MyViewModel:null`. On `main` the leftover stale `:null` entry is what keeps `getOrNull<MyViewModel>()` non-null; removing it (the #2386 fix) exposes that (1) was already clobbered → unqualified resolves to null.  **Implication:** the clean fix for #2386's single-definition cases is correct (verified by `WithOptionsStaleIndexTest`), but a complete fix must also stop `*Of(ctor){options}` from indexing under the pre-options qualifier — i.e. apply options **before** 
  > Closing — #2386 is deferred to **4.3.0** (needs the deeper `*Of`-builder indexing-order fix, not a contained patch change). Investigation, root cause, and the single-definition fix + `WithOptionsStaleIndexTest` are recorded here and on #2386 for whoever picks it up.

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

### Incident Patch 1: `0029f349` (2026-06-12)
**Commit Message**: Merge pull request #2446 from InsertKoinIO/fix/2348-env-properties-cast

Fix #2348 - ignore non-String environment properties (ClassCastException)

**File**: `projects/core/koin-core/src/jvmMain/kotlin/org/koin/core/registry/PropertyRegistryExt.kt` (modified, +11/-4)
```diff
@@ -10,13 +10,20 @@ import java.util.*
 /**
  *Save properties values into PropertyRegister
  */
-@Suppress("UNCHECKED_CAST")
 fun PropertyRegistry.saveProperties(properties: Properties) {
     _koin.logger.debug("load ${properties.size} properties")
 
-    val propertiesMapValues = properties.toMap() as Map<String, String>
-    propertiesMapValues.forEach { (k: String, v: String) ->
-        saveProperty(k, v)
+    // java.util.Properties can legally hold non-String keys/values (e.g. after
+    // System.setProperties(...) with arbitrary objects). The registry is keyed by
+    // String but stores Any values, so keep any String-keyed entry (value as-is)
+    // and only drop non-String keys — instead of hard-casting values to String and
+    // crashing (#2348).
+    properties.forEach { (k, v) ->
+        if (k is String && v != null) {
+            saveProperty(k, v)
+        } else {
+            _koin.logger.debug("ignore property with non-string key '$k'")
+        }
     }
 }
 
```

**File**: `projects/core/koin-core/src/jvmTest/kotlin/org/koin/core/EnvironmentPropertiesTest.kt` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+package org.koin.core
+
+import org.koin.core.annotation.KoinInternalApi
+import org.koin.core.registry.saveProperties
+import org.koin.dsl.koinApplication
+import java.util.Properties
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertSame
+
+/**
+ * Regression test for #2348. java.util.Properties can legally hold non-String keys/values
+ * (e.g. after System.setProperties(...) with arbitrary objects). Koin hard-cast every entry to
+ * String, crashing with ClassCastException on startup. The registry is String-keyed but holds
+ * Any values, so: non-String *keys* are dropped (unaddressable), non-String *values* are kept.
+ */
+@OptIn(KoinInternalApi::class)
+class EnvironmentPropertiesTest {
+
+    @Test
+    fun saveProperties_tolerates_non_string_entries_issue_2348() {
+        val koin = koinApplication { }.koin
+
+        val objectValue = Any()
+        val props = Properties().apply {
+            setProperty("valid.key", "valid.value")
+            // legacy Properties permits arbitrary objects:
+            put("object.value", objectValue) // String key, Any value -> kept (values are Any)
+            put(Any(), Any())                 // non-string key -> dropped
+            put(42, "string.value")           // non-string key -> dropped
+        }
+
+        // must NOT throw ClassCastException
+        koin.propertyRegistry.saveProperties(props)
+
+        // valid string property is saved
+        assertEquals("valid.value", koin.getProperty<String>("valid.key"))
+        // a non-String value under a String key is preserved as-is (registry stores Any)
+        assertSame(objectValue, koin.getProperty<Any>("object.value"))
+    }
+}
```

---

### Incident Patch 2: `26020e8b` (2026-06-12)
**Commit Message**: Fix #2348 - tolerate non-String environment properties (ClassCastException)

PropertyRegistry.saveProperties cast every java.util.Properties entry to
Map<String, String>, so a non-String key or value (legal in Properties, e.g.
after System.setProperties(...) with arbitrary objects) crashed startup with
ClassCastException.

The registry is String-keyed but stores Any values (PropertyRegistry._values is
Map<String, Any>, getProperty uses `as? T`). So the correct fix keeps any
String-keyed entry with its value as-is (Any) and only drops non-String keys
(which can't be addressed as Koin property keys) — rather than forcing values
to String. Removes the unchecked cast.

Regression test (jvmTest): EnvironmentPropertiesTest — Properties with a
non-String key, plus a String key holding an arbitrary object, no longer throws;
the object value is preserved and retrievable, valid string props still load.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `projects/core/koin-core/src/jvmMain/kotlin/org/koin/core/registry/PropertyRegistryExt.kt` (modified, +11/-4)
```diff
@@ -10,13 +10,20 @@ import java.util.*
 /**
  *Save properties values into PropertyRegister
  */
-@Suppress("UNCHECKED_CAST")
 fun PropertyRegistry.saveProperties(properties: Properties) {
     _koin.logger.debug("load ${properties.size} properties")
 
-    val propertiesMapValues = properties.toMap() as Map<String, String>
-    propertiesMapValues.forEach { (k: String, v: String) ->
-        saveProperty(k, v)
+    // java.util.Properties can legally hold non-String keys/values (e.g. after
+    // System.setProperties(...) with arbitrary objects). The registry is keyed by
+    // String but stores Any values, so keep any String-keyed entry (value as-is)
+    // and only drop non-String keys — instead of hard-casting values to String and
+    // crashing (#2348).
+    properties.forEach { (k, v) ->
+        if (k is String && v != null) {
+            saveProperty(k, v)
+        } else {
+            _koin.logger.debug("ignore property with non-string key '$k'")
+        }
     }
 }
 
```

**File**: `projects/core/koin-core/src/jvmTest/kotlin/org/koin/core/EnvironmentPropertiesTest.kt` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+package org.koin.core
+
+import org.koin.core.annotation.KoinInternalApi
+import org.koin.core.registry.saveProperties
+import org.koin.dsl.koinApplication
+import java.util.Properties
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertSame
+
+/**
+ * Regression test for #2348. java.util.Properties can legally hold non-String keys/values
+ * (e.g. after System.setProperties(...) with arbitrary objects). Koin hard-cast every entry to
+ * String, crashing with ClassCastException on startup. The registry is String-keyed but holds
+ * Any values, so: non-String *keys* are dropped (unaddressable), non-String *values* are kept.
+ */
+@OptIn(KoinInternalApi::class)
+class EnvironmentPropertiesTest {
+
+    @Test
+    fun saveProperties_tolerates_non_string_entries_issue_2348() {
+        val koin = koinApplication { }.koin
+
+        val objectValue = Any()
+        val props = Properties().apply {
+            setProperty("valid.key", "valid.value")
+            // legacy Properties permits arbitrary objects:
+            put("object.value", objectValue) // String key, Any value -> kept (values are Any)
+            put(Any(), Any())                 // non-string key -> dropped
+            put(42, "string.value")           // non-string key -> dropped
+        }
+
+        // must NOT throw ClassCastException
+        koin.propertyRegistry.saveProperties(props)
+
+        // valid string property is saved
+        assertEquals("valid.value", koin.getProperty<String>("valid.key"))
+        // a non-String value under a String key is preserved as-is (registry stores Any)
+        assertSame(objectValue, koin.getProperty<Any>("object.value"))
+    }
+}
```

---

### Incident Patch 3: `fff5291f` (2026-06-12)
**Commit Message**: Merge pull request #2432 from lfavreli-betclic/fix/2410-request-scope-atomic-id

Use a monotonic counter for Ktor request scope ids

**File**: `projects/ktor/koin-ktor/src/commonMain/kotlin/org/koin/ktor/plugin/RequestScope.kt` (modified, +12/-3)
```diff
@@ -19,16 +19,25 @@ import io.ktor.server.application.ApplicationCall
 import org.koin.core.Koin
 import org.koin.core.component.KoinScopeComponent
 import org.koin.core.component.createScope
-import org.koin.mp.KoinPlatformTools
-import org.koin.mp.generateId
+import kotlin.concurrent.atomics.AtomicLong
+import kotlin.concurrent.atomics.ExperimentalAtomicApi
+import kotlin.concurrent.atomics.incrementAndFetch
+import kotlin.time.Clock
 
 /**
  * Request Scope Holder
  *
  * @author Arnaud Giuliani
+ * @author Loïc Favreliere
  */
+@OptIn(ExperimentalAtomicApi::class)
 class RequestScope(private val _koin: Koin, call: ApplicationCall) : KoinScopeComponent {
-    private val scopeId = "request_"+KoinPlatformTools.generateId()
+    private val scopeId = "request_" + counter.incrementAndFetch()
     override fun getKoin(): Koin = _koin
     override val scope = createScope(scopeId = scopeId, source = call)
+
+    private companion object {
+        // Monotonic counter seeded with the current time, for process-unique request scope ids
+        private val counter = AtomicLong(Clock.System.now().toEpochMilliseconds())
+    }
 }
\ No newline at end of file
```

**File**: `projects/ktor/koin-ktor/src/jvmTest/kotlin/org/koin/ktor/ext/KoinPluginRunTest.kt` (modified, +28/-1)
```diff
@@ -27,6 +27,10 @@ import io.ktor.server.response.respond
 import io.ktor.server.routing.get
 import io.ktor.server.routing.routing
 import io.ktor.server.testing.testApplication
+import kotlinx.coroutines.Dispatchers
+import kotlinx.coroutines.async
+import kotlinx.coroutines.awaitAll
+import kotlinx.coroutines.coroutineScope
 import kotlinx.coroutines.delay
 import kotlinx.coroutines.runBlocking
 import org.junit.Before
@@ -37,6 +41,7 @@ import org.koin.core.context.stopKoin
 import org.koin.core.logger.Level
 import org.koin.dsl.module
 import org.koin.ktor.plugin.Koin
+import org.koin.ktor.plugin.scope
 import kotlin.test.assertEquals
 import kotlin.test.assertTrue
 
@@ -57,6 +62,25 @@ class KoinPluginRunTest {
         }
     }
 
+    @Test
+    fun `sequential and concurrent requests get unique scope ids`() {
+        testMyApplication { client ->
+            suspend fun scopeId() = client.get("testurl").headers["X-Scope-Id"]
+
+            val sequentialIds = (1..100).map { scopeId() }
+            val concurrentIds = coroutineScope {
+                (1..1_000).map { async(Dispatchers.Default) { scopeId() } }.awaitAll()
+            }
+            val ids = sequentialIds + concurrentIds
+
+            assertEquals(ids.size, ids.toSet().size, "all request scope ids should be unique")
+            assertTrue(
+                ids.all { it?.removePrefix("request_")?.toLongOrNull() != null },
+                "scope ids should be 'request_<number>'",
+            )
+        }
+    }
+
     @Test
     @Ignore("socket exception on GH")
     fun `run outside context`() = runBlocking<Unit> {
@@ -135,7 +159,10 @@ private fun testMyApplicationNoKoin(test: suspend (jsonClient: HttpClient) -> Un
 class KtorMyModule(application: Application) {
     init {
         application.routing {
-            get("testurl") { call.respond(HttpStatusCode.OK, "Test response") }
+            get("testurl") {
+                call.response.headers.append("X-Scope-Id", call.scope.id)
+                call.respond(HttpStatusCode.OK, "Test response")
+            }
         }
     }
 }
\ No newline at end of file
```

---

### Incident Patch 4: `961521c4` (2026-06-12)
**Commit Message**: Merge pull request #2444 from InsertKoinIO/fix/2299-vmscope-link-parent

Fix #2299 - link viewModelScopeFactory scope to its parent scope

**File**: `projects/core/koin-core-viewmodel/src/commonMain/kotlin/org/koin/viewmodel/factory/KoinViewModelFactory.kt` (modified, +6/-0)
```diff
@@ -50,6 +50,12 @@ class KoinViewModelFactory(
         } else {
             val scopeId = getViewModelScopeId(modelClass)
             val vmScope = koin.createScope(scopeId, TypeQualifier(modelClass), null, ViewModelScopeArchetype)
+            // #2299: link the auto-created VM scope to the requesting (parent) scope, so a ViewModel
+            // declared in a custom scope - and its scoped dependencies - resolve. New scopes already
+            // link to root, so only a non-root parent needs an explicit link.
+            if (!scope.isRoot) {
+                vmScope.linkTo(scope)
+            }
             val vm : T = vmScope.getWithParameters(kClass, qualifier, androidParams)
             vm.addCloseable(ViewModelScopeAutoCloseable(scopeId,koin))
             vm
```

**File**: `projects/core/koin-core-viewmodel/src/commonTest/kotlin/org/koin/viewmodel/ViewModelScopeFactoryLinkTest.kt` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+package org.koin.viewmodel
+
+import androidx.lifecycle.ViewModel
+import androidx.lifecycle.ViewModelStore
+import androidx.lifecycle.viewmodel.CreationExtras
+import org.koin.core.annotation.KoinExperimentalAPI
+import org.koin.core.annotation.KoinInternalApi
+import org.koin.core.module.dsl.scopedOf
+import org.koin.core.module.dsl.viewModelOf
+import org.koin.core.qualifier.TypeQualifier
+import org.koin.core.option.viewModelScopeFactory
+import org.koin.dsl.koinApplication
+import org.koin.dsl.module
+import kotlin.test.Test
+import kotlin.test.assertNotNull
+import kotlin.test.assertSame
+
+/**
+ * Regression test for #2299: with viewModelScopeFactory() enabled, a ViewModel declared in a
+ * custom scope must resolve. KoinViewModelFactory creates a fresh vmScope (ViewModelScopeArchetype)
+ * but did not link it to the parent (custom) scope, so the ViewModel — and its scoped deps,
+ * registered under the custom scope qualifier — were unreachable.
+ */
+@OptIn(KoinInternalApi::class, KoinExperimentalAPI::class)
+class ViewModelScopeFactoryLinkTest {
+
+    class Example
+    class ScopedDep
+    class ScopedVM(val dep: ScopedDep) : ViewModel()
+
+    @Test
+    fun viewModelScopeFactory_resolves_viewModel_from_custom_scope_issue_2299() {
+        val koin = koinApplication {
+            options(viewModelScopeFactory())
+            modules(
+                module {
+                    scope<Example> {
+                        scopedOf(::ScopedDep)
+                        viewModelOf(::ScopedVM)
+                    }
+                },
+            )
+        }.koin
+
+        val parentScope = koin.createScope("example-1", TypeQualifier(Example::class), Example())
+
+        val vm = resolveViewModel(
+            ScopedVM::class, ViewModelStore(), null, CreationExtras.Empty, null, parentScope,
+        )
+
+        assertNotNull(vm)
+        // its scoped dependency must come from the parent custom scope
+        assertNotNull(vm.dep)
+        assertSame(parentScope.get<ScopedDep>(), vm.dep)
+    }
+}
```

---

### Incident Patch 5: `524eb258` (2026-06-12)
**Commit Message**: Fix #2299 - link viewModelScopeFactory scope to its parent scope

With viewModelScopeFactory() enabled, KoinViewModelFactory creates a fresh
vmScope (ViewModelScopeArchetype) for the ViewModel but never linked it to the
requesting (parent) scope. A ViewModel declared in a custom scope —
scope<X> { viewModelOf(::VM) } — was therefore unreachable (the definition lives
under the custom scope qualifier), and its scoped dependencies couldn't resolve,
crashing with NoDefinitionFound. Worked with the option off.

Fix: vmScope.linkTo(scope) when the parent isn't root (new scopes already link
to root). The ViewModel and its scoped deps now resolve via the linked parent.

This also matters because the #2417 guidance points users at
viewModelScopeFactory() — the option must work with custom scopes.

Test (commonTest, RED->GREEN on JVM / wasmJs / native): ViewModelScopeFactoryLinkTest.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `projects/core/koin-core-viewmodel/src/commonMain/kotlin/org/koin/viewmodel/factory/KoinViewModelFactory.kt` (modified, +6/-0)
```diff
@@ -50,6 +50,12 @@ class KoinViewModelFactory(
         } else {
             val scopeId = getViewModelScopeId(modelClass)
             val vmScope = koin.createScope(scopeId, TypeQualifier(modelClass), null, ViewModelScopeArchetype)
+            // #2299: link the auto-created VM scope to the requesting (parent) scope, so a ViewModel
+            // declared in a custom scope - and its scoped dependencies - resolve. New scopes already
+            // link to root, so only a non-root parent needs an explicit link.
+            if (!scope.isRoot) {
+                vmScope.linkTo(scope)
+            }
             val vm : T = vmScope.getWithParameters(kClass, qualifier, androidParams)
             vm.addCloseable(ViewModelScopeAutoCloseable(scopeId,koin))
             vm
```

**File**: `projects/core/koin-core-viewmodel/src/commonTest/kotlin/org/koin/viewmodel/ViewModelScopeFactoryLinkTest.kt` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+package org.koin.viewmodel
+
+import androidx.lifecycle.ViewModel
+import androidx.lifecycle.ViewModelStore
+import androidx.lifecycle.viewmodel.CreationExtras
+import org.koin.core.annotation.KoinExperimentalAPI
+import org.koin.core.annotation.KoinInternalApi
+import org.koin.core.module.dsl.scopedOf
+import org.koin.core.module.dsl.viewModelOf
+import org.koin.core.qualifier.TypeQualifier
+import org.koin.core.option.viewModelScopeFactory
+import org.koin.dsl.koinApplication
+import org.koin.dsl.module
+import kotlin.test.Test
+import kotlin.test.assertNotNull
+import kotlin.test.assertSame
+
+/**
+ * Regression test for #2299: with viewModelScopeFactory() enabled, a ViewModel declared in a
+ * custom scope must resolve. KoinViewModelFactory creates a fresh vmScope (ViewModelScopeArchetype)
+ * but did not link it to the parent (custom) scope, so the ViewModel — and its scoped deps,
+ * registered under the custom scope qualifier — were unreachable.
+ */
+@OptIn(KoinInternalApi::class, KoinExperimentalAPI::class)
+class ViewModelScopeFactoryLinkTest {
+
+    class Example
+    class ScopedDep
+    class ScopedVM(val dep: ScopedDep) : ViewModel()
+
+    @Test
+    fun viewModelScopeFactory_resolves_viewModel_from_custom_scope_issue_2299() {
+        val koin = koinApplication {
+            options(viewModelScopeFactory())
+            modules(
+                module {
+                    scope<Example> {
+                        scopedOf(::ScopedDep)
+                        viewModelOf(::ScopedVM)
+                    }
+                },
+            )
+        }.koin
+
+        val parentScope = koin.createScope("example-1", TypeQualifier(Example::class), Example())
+
+        val vm = resolveViewModel(
+            ScopedVM::class, ViewModelStore(), null, CreationExtras.Empty, null, parentScope,
+        )
+
+        assertNotNull(vm)
+        // its scoped dependency must come from the parent custom scope
+        assertNotNull(vm.dep)
+        assertSame(parentScope.get<ScopedDep>(), vm.dep)
+    }
+}
```

---

### Incident Patch 6: `7bb09d36` (2026-06-12)
**Commit Message**: Docs: viewModelScope { } requires viewModelScopeFactory() option (#2417)

Declaring a ViewModel inside viewModelScope { } registers it under the ViewModel
scope archetype, which is only resolvable when the viewModelScopeFactory()
option is enabled — otherwise resolution fails with
"No definition found ... on scope '_root_'". This was undocumented and is the
dead-end #2417 reporters hit after applying the advised viewModelScope { }
workaround.

Add a caution to the canonical ViewModel Scope section (koin-core/viewmodel.md)
with the option, the exact error, and the distinction from the manual
ScopeViewModel pattern; add a short pointer in the Compose ViewModel doc (where
CMP users land).

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `docs/reference/koin-compose/compose-viewmodel.md` (modified, +4/-0)
```diff
@@ -278,6 +278,10 @@ val appModule = module {
 }
 ```
 
+:::caution Requires the `viewModelScopeFactory()` option
+Declaring a ViewModel inside `viewModelScope { }` requires enabling `options(viewModelScopeFactory())` in your Koin configuration — otherwise `koinViewModel()` fails with `No definition found … on scope '['_root_']'`. See [ViewModel Scope](/docs/reference/koin-core/viewmodel#viewmodel-scope) for details.
+:::
+
 ## Quick Reference
 
 | API | Use Case | Package |
```

**File**: `docs/reference/koin-core/viewmodel.md` (modified, +19/-0)
```diff
@@ -146,6 +146,25 @@ val appModule = module {
 Dependencies inside `viewModelScope` are created when the ViewModel is first accessed and destroyed when the ViewModel is cleared.
 :::
 
+:::caution Requires the `viewModelScopeFactory()` option
+Declaring the **ViewModel itself** inside `viewModelScope { }` (so Koin creates its scope automatically) requires enabling the `viewModelScopeFactory()` option in your Koin configuration:
+
+```kotlin
+startKoin {
+    options(viewModelScopeFactory())
+    modules(appModule)
+}
+```
+
+Without it, resolving the ViewModel fails with:
+
+```
+No definition found for type 'MyViewModel' on scope '['_root_']'
+```
+
+because the ViewModel is registered under the ViewModel scope archetype, and that scope is only created when the option is enabled. (This is separate from the manual `ScopeViewModel` pattern, which creates its own scope and does not need the option.)
+:::
+
 ## Injecting ViewModels
 
 ### In Compose (Multiplatform)
```

---

### Incident Patch 7: `931132e7` (2026-06-12)
**Commit Message**: Merge pull request #2442 from InsertKoinIO/fix/2426-tvos-viewmodel-targets

Fix #2426 - add tvOS targets to koin-core-viewmodel

**File**: `projects/core/koin-core-viewmodel/build.gradle.kts` (modified, +3/-0)
```diff
@@ -47,6 +47,9 @@ kotlin {
     iosSimulatorArm64()
     macosX64()
     macosArm64()
+    tvosArm64()
+    tvosSimulatorArm64()
+    tvosX64()
 
     sourceSets {
         commonMain.dependencies {
```

---

### Incident Patch 8: `fa65c44a` (2026-06-11)
**Commit Message**: Merge pull request #2441 from InsertKoinIO/fix/2044-savedstatehandle-errors

Improve SavedStateHandle / ViewModel DX (#2044, #2417) — actionable errors + R8 guide

**File**: `.gitignore` (modified, +3/-0)
```diff
@@ -11,3 +11,6 @@ classes/
 yarn.lock
 .kotlin/
 **/*/.claude/settings.local.json
+
+# Local Claude Code settings (machine-local)
+projects/.claude/settings.local.json
```

**File**: `docs/reference/koin-android/r8-proguard.md` (added, +82/-0)
```diff
@@ -0,0 +1,82 @@
+---
+title: R8 / ProGuard
+---
+
+This page explains how Koin behaves under code shrinking and obfuscation (R8 / ProGuard), what
+Koin keeps for you, and what **you** need to keep in your own app.
+
+## TL;DR
+
+- **Koin's core resolution is R8-safe.** `get<T>()`, `inject<T>()`, and the `*Of` builders
+  (`singleOf`, `factoryOf`, `viewModelOf`, …) resolve dependencies **at compile time** — they use
+  reified types and, on Android/JVM, key the registry by `Class.getName()`. There is **no runtime
+  reflection over your constructors**, so you do **not** need to keep your definitions, ViewModels,
+  or their constructors on Koin's behalf.
+- Koin ships `consumer-rules.pro` in its Android AARs (`koin-android`, `koin-core-viewmodel`,
+  `koin-compose-viewmodel`, `koin-androidx-workmanager`, `koin-androidx-startup`), so the rules
+  below are applied automatically — you usually don't add anything.
+- You still need to keep classes that **something else** loads reflectively (see below).
+
+## What Koin keeps for you (shipped consumer rules)
+
+The AARs silence R8 warnings about Koin internals:
+
+```proguard
+-dontwarn org.koin.**
+```
+
+`koin-androidx-startup` additionally keeps its manifest-referenced initializer. None of these keep
+your application classes — Koin doesn't need them kept.
+
+## What you must keep
+
+These come from the platform/libraries, not from Koin's resolution:
+
+- **Fragments created by `KoinFragmentFactory`** are instantiated by class name. Keep your Fragment
+  subclasses (they're usually kept already via `@Keep`, layout references, or AndroidX rules).
+- **WorkManager `ListenableWorker` subclasses** are kept by `androidx.work`'s own consumer rules.
+- **Saved state for process death.** `SavedStateHandle` is provided by androidx `CreationExtras`,
+  not by Koin. The values you put into it must survive R8 like any other saved state — keep your
+  own `@Parcelize` / `Serializable` state classes:
+
+```proguard
+# Example — keep your own saved-state payloads
+-keep class com.example.** implements android.os.Parcelable { *; }
+```
+
+## ViewModels & SavedStateHandle (#2044)
+
+A common belief is that intermittent `No definition found for SavedStateHandle` crashes are caused
+by R8 stripping Koin's ViewModel reflection. **They are not** — `viewModelOf(::MyViewModel)` is
+compile-time, so a `-keep` on your ViewModel won't change Koin's resolution.
+
+`SavedStateHandle` is only available **while the ViewModel is being created** (it is built from the
+`CreationExtras` passed to the factory). Resolve it **directly in the ViewModel constructor** — do
+not resolve it lazily or after construction:
+
+```kotlin
+// ✅ resolved during creation
+class MyViewModel(val handle: SavedStateHandle) : ViewModel()
+
+// ❌ resolved later — the CreationExtras are gone by then
+class MyViewModel(koin: Koin) : ViewModel() {
+    val handle by lazy { koin.get<SavedStateHandle>() } // fails
+}
+```
+
+If you declare ViewModels inside `viewModelScope { }`, enable the matching option so the scope can
+be created:
+
+```kotlin
+startKoin {
+    options(viewModelScopeFactory())
+    modules(appModule)
+}
+```
+
+## Non-Android targets (JS / WASM / Native)
+
+On Android/JVM Koin keys the registry by `Class.getName()`, which is stable under R8. On
+**Kotlin/JS, WASM, and Native**, Koin uses `qualifiedName` / `simpleName` from Kotlin reflection.
+Aggressive name minification on those targets can affect type identity — prefer **named
+qualifiers** (`named("...")`) over relying on class names when you minify non-Android targets.
```

**File**: `projects/compose/koin-compose-viewmodel/build.gradle.kts` (modified, +1/-0)
```diff
@@ -61,6 +61,7 @@ android {
     compileSdk = androidCompileSDK.toInt()
     defaultConfig {
         minSdk = androidMinSDK.toInt()
+        consumerProguardFiles("consumer-rules.pro")
     }
 }
 
```

**File**: `projects/compose/koin-compose-viewmodel/consumer-rules.pro` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+# Koin Compose ViewModel — consumer R8/ProGuard rules
+# Shipped with the koin-compose-viewmodel AAR. Auto-applied to consumer apps.
+
+# Silence R8 warnings about Koin internals (Kotlin reflection metadata, optional interop).
+-dontwarn org.koin.**
+
+# NOTE: koinViewModel() / koinNavViewModel() resolution is compile-time (reified inline get(),
+# JVM Class.getName() keying) — no runtime reflection over your ViewModel constructors, so you do
+# NOT need to keep your ViewModels on Koin's behalf. SavedStateHandle comes from androidx
+# CreationExtras at creation time, not from Koin reflection.
+# For what you DO need to keep (your saved-state classes for process death), see the
+# R8 / ProGuard guide: https://insert-koin.io/docs/reference/koin-android/r8-proguard
```

**File**: `projects/core/benchmark/bench_results.txt` (modified, +0/-17)
```diff
@@ -1,21 +1,4 @@
 
-# 4.2.0-BETA2 - 2025-12-09
-
-Benchmark                                           Mode  Cnt     Score    Error  Units
-HeavyStartupBenchmark.start_get_lazy_module1        avgt          0,249           ms/op
-HeavyStartupBenchmark.start_get_lazy_module100      avgt          4,248           ms/op
-HeavyStartupBenchmark.start_get_lazy_module1000     avgt         40,000           ms/op
-HeavyStartupBenchmark.start_get_module1             avgt          0,233           ms/op
-HeavyStartupBenchmark.start_get_module100           avgt         24,621           ms/op
-HeavyStartupBenchmark.start_get_module1000          avgt        243,413           ms/op
-JvmBenchmark.retrieveDependency                     avgt        104,304           ns/op
-ScopeBenchmark.activityScope                        avgt    3   528,339 ± 14,215  ns/op
-ScopeBenchmark.activityScope_cascade_root           avgt    3   804,719 ± 22,924  ns/op
-ScopeBenchmark.fragmentScope_cascade_activity_root  avgt    3  1578,267 ± 24,615  ns/op
-ScopeBenchmark.rootScope                            avgt    3   107,065 ±  9,257  ns/op
-StartupBenchmark.startup                            avgt          0,229           ms/op
-StartupBenchmark.startup_lazy                       avgt          0,002           ms/op
-
 # 4.2.0-BETA1 - 2025-12-09
 
 Benchmark                                           Mode  Cnt     Score     Error  Units
```

**File**: `projects/core/koin-core-viewmodel/build.gradle.kts` (modified, +1/-0)
```diff
@@ -69,6 +69,7 @@ android {
     compileSdk = androidCompileSDK.toInt()
     defaultConfig {
         minSdk = androidMinSDK.toInt()
+        consumerProguardFiles("consumer-rules.pro")
     }
     compileOptions {
         sourceCompatibility = JavaVersion.VERSION_1_8
```

**File**: `projects/core/koin-core-viewmodel/consumer-rules.pro` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+# Koin Core ViewModel — consumer R8/ProGuard rules
+# Shipped with the koin-core-viewmodel AAR. Auto-applied to consumer apps.
+
+# Silence R8 warnings about Koin internals (Kotlin reflection metadata, optional interop).
+-dontwarn org.koin.**
+
+# NOTE: Koin's ViewModel resolution (viewModelOf / get<T>()) is resolved at COMPILE TIME
+# (reified inline get(), JVM Class.getName() keying) — it uses no runtime reflection over your
+# ViewModel constructors. You do NOT need to keep your ViewModels on Koin's behalf.
+# SavedStateHandle is supplied by androidx CreationExtras at creation time, not by Koin reflection.
+# For what you DO need to keep (your @Parcelize/Serializable saved-state classes for process death),
+# see the R8 / ProGuard guide: https://insert-koin.io/docs/reference/koin-android/r8-proguard
```

**File**: `projects/core/koin-core-viewmodel/src/commonMain/kotlin/org/koin/viewmodel/factory/AndroidParametersHolder.kt` (modified, +13/-1)
```diff
@@ -37,7 +37,19 @@ class AndroidParametersHolder(
 
     private inline fun <T> createSavedStateHandleOrElse(clazz: KClass<*>, block: () -> T): T {
         return if (clazz == SavedStateHandle::class) {
-            extras.createSavedStateHandle() as T
+            try {
+                extras.createSavedStateHandle() as T
+            } catch (e: IllegalArgumentException) {
+                // androidx throws "CreationExtras must have a value by SAVED_STATE_REGISTRY_OWNER_KEY"
+                // when the ViewModel's CreationExtras has no SavedStateRegistryOwner (#2417). Surface
+                // an actionable Koin message instead of the raw androidx error.
+                throw IllegalStateException(
+                    "Koin could not create a SavedStateHandle: the ViewModel's CreationExtras has no SavedStateRegistryOwner. " +
+                        "Resolve the ViewModel via koinViewModel()/koinNavViewModel() with a proper owner (e.g. a NavBackStackEntry), " +
+                        "and inject SavedStateHandle directly in the ViewModel constructor (not lazily/outside construction).",
+                    e,
+                )
+            }
         } else block()
     }
 }
\ No newline at end of file
```

---

### Incident Patch 9: `f7e2adf2` (2026-06-11)
**Commit Message**: Fix #2426 - add tvOS targets to koin-core-viewmodel

koin-core-viewmodel published no tvOS variants, so @KoinViewModel on a tvOS
KMP target failed: "buildViewModel is not on classpath. Add dependency:
koin-core-viewmodel". koin-core already ships tvOS and the JetBrains
lifecycle-viewmodel dependency supports it.

Add tvosArm64 / tvosSimulatorArm64 / tvosX64 to koin-core-viewmodel. All three
compile.

Note: koin-compose-viewmodel is intentionally NOT changed — it depends on
koin-compose, which uses org.jetbrains.compose.foundation (Compose UI), which
publishes no tvOS variant (Compose UI doesn't target tvOS). That's an upstream
Compose limitation; tvOS apps using @KoinViewModel use koin-core-viewmodel.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `projects/core/koin-core-viewmodel/build.gradle.kts` (modified, +3/-0)
```diff
@@ -47,6 +47,9 @@ kotlin {
     iosSimulatorArm64()
     macosX64()
     macosArm64()
+    tvosArm64()
+    tvosSimulatorArm64()
+    tvosX64()
 
     sourceSets {
         commonMain.dependencies {
```

---

### Incident Patch 10: `1270c9ae` (2026-06-11)
**Commit Message**: Ship R8 consumer rules for viewmodel modules + R8/ProGuard guide

koin-core-viewmodel and koin-compose-viewmodel shipped no consumer R8 rules,
and the R8 guide referenced by the other modules' consumer-rules.pro did not
exist. Both gaps fed the "minification breaks SavedStateHandle" confusion in
#2044.

- Add consumer-rules.pro to both viewmodel AARs (-dontwarn org.koin.**), wired
  via consumerProguardFiles. Verified embedded as proguard.txt in the release
  AARs.
- Add docs/reference/koin-android/r8-proguard.md: documents that Koin's
  resolution (get<T>() / *Of) is compile-time and R8-safe (no ViewModel keep
  rules needed), what users DO keep (Fragments, Workers, their own saved-state
  classes), the SavedStateHandle-in-constructor rule, the viewModelScope { } +
  viewModelScopeFactory() requirement, and the JS/WASM/Native qualifiedName
  caveat.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `docs/reference/koin-android/r8-proguard.md` (added, +82/-0)
```diff
@@ -0,0 +1,82 @@
+---
+title: R8 / ProGuard
+---
+
+This page explains how Koin behaves under code shrinking and obfuscation (R8 / ProGuard), what
+Koin keeps for you, and what **you** need to keep in your own app.
+
+## TL;DR
+
+- **Koin's core resolution is R8-safe.** `get<T>()`, `inject<T>()`, and the `*Of` builders
+  (`singleOf`, `factoryOf`, `viewModelOf`, …) resolve dependencies **at compile time** — they use
+  reified types and, on Android/JVM, key the registry by `Class.getName()`. There is **no runtime
+  reflection over your constructors**, so you do **not** need to keep your definitions, ViewModels,
+  or their constructors on Koin's behalf.
+- Koin ships `consumer-rules.pro` in its Android AARs (`koin-android`, `koin-core-viewmodel`,
+  `koin-compose-viewmodel`, `koin-androidx-workmanager`, `koin-androidx-startup`), so the rules
+  below are applied automatically — you usually don't add anything.
+- You still need to keep classes that **something else** loads reflectively (see below).
+
+## What Koin keeps for you (shipped consumer rules)
+
+The AARs silence R8 warnings about Koin internals:
+
+```proguard
+-dontwarn org.koin.**
+```
+
+`koin-androidx-startup` additionally keeps its manifest-referenced initializer. None of these keep
+your application classes — Koin doesn't need them kept.
+
+## What you must keep
+
+These come from the platform/libraries, not from Koin's resolution:
+
+- **Fragments created by `KoinFragmentFactory`** are instantiated by class name. Keep your Fragment
+  subclasses (they're usually kept already via `@Keep`, layout references, or AndroidX rules).
+- **WorkManager `ListenableWorker` subclasses** are kept by `androidx.work`'s own consumer rules.
+- **Saved state for process death.** `SavedStateHandle` is provided by androidx `CreationExtras`,
+  not by Koin. The values you put into it must survive R8 like any other saved state — keep your
+  own `@Parcelize` / `Serializable` state classes:
+
+```proguard
+# Example — keep your own saved-state payloads
+-keep class com.example.** implements android.os.Parcelable { *; }
+```
+
+## ViewModels & SavedStateHandle (#2044)
+
+A common belief is that intermittent `No definition found for SavedStateHandle` crashes are caused
+by R8 stripping Koin's ViewModel reflection. **They are not** — `viewModelOf(::MyViewModel)` is
+compile-time, so a `-keep` on your ViewModel won't change Koin's resolution.
+
+`SavedStateHandle` is only available **while the ViewModel is being created** (it is built from the
+`CreationExtras` passed to the factory). Resolve it **directly in the ViewModel constructor** — do
+not resolve it lazily or after construction:
+
+```kotlin
+// ✅ resolved during creation
+class MyViewModel(val handle: SavedStateHandle) : ViewModel()
+
+// ❌ resolved later — the CreationExtras are gone by then
+class MyViewModel(koin: Koin) : ViewModel() {
+    val handle by lazy { koin.get<SavedStateHandle>() } // fails
+}
+```
+
+If you declare ViewModels inside `viewModelScope { }`, enable the matching option so the scope can
+be created:
+
+```kotlin
+startKoin {
+    options(viewModelScopeFactory())
+    modules(appModule)
+}
+```
+
+## Non-Android targets (JS / WASM / Native)
+
+On Android/JVM Koin keys the registry by `Class.getName()`, which is stable under R8. On
+**Kotlin/JS, WASM, and Native**, Koin uses `qualifiedName` / `simpleName` from Kotlin reflection.
+Aggressive name minification on those targets can affect type identity — prefer **named
+qualifiers** (`named("...")`) over relying on class names when you minify non-Android targets.
```

**File**: `projects/compose/koin-compose-viewmodel/build.gradle.kts` (modified, +1/-0)
```diff
@@ -61,6 +61,7 @@ android {
     compileSdk = androidCompileSDK.toInt()
     defaultConfig {
         minSdk = androidMinSDK.toInt()
+        consumerProguardFiles("consumer-rules.pro")
     }
 }
 
```

**File**: `projects/compose/koin-compose-viewmodel/consumer-rules.pro` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+# Koin Compose ViewModel — consumer R8/ProGuard rules
+# Shipped with the koin-compose-viewmodel AAR. Auto-applied to consumer apps.
+
+# Silence R8 warnings about Koin internals (Kotlin reflection metadata, optional interop).
+-dontwarn org.koin.**
+
+# NOTE: koinViewModel() / koinNavViewModel() resolution is compile-time (reified inline get(),
+# JVM Class.getName() keying) — no runtime reflection over your ViewModel constructors, so you do
+# NOT need to keep your ViewModels on Koin's behalf. SavedStateHandle comes from androidx
+# CreationExtras at creation time, not from Koin reflection.
+# For what you DO need to keep (your saved-state classes for process death), see the
+# R8 / ProGuard guide: https://insert-koin.io/docs/reference/koin-android/r8-proguard
```

**File**: `projects/core/koin-core-viewmodel/build.gradle.kts` (modified, +1/-0)
```diff
@@ -69,6 +69,7 @@ android {
     compileSdk = androidCompileSDK.toInt()
     defaultConfig {
         minSdk = androidMinSDK.toInt()
+        consumerProguardFiles("consumer-rules.pro")
     }
     compileOptions {
         sourceCompatibility = JavaVersion.VERSION_1_8
```

**File**: `projects/core/koin-core-viewmodel/consumer-rules.pro` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+# Koin Core ViewModel — consumer R8/ProGuard rules
+# Shipped with the koin-core-viewmodel AAR. Auto-applied to consumer apps.
+
+# Silence R8 warnings about Koin internals (Kotlin reflection metadata, optional interop).
+-dontwarn org.koin.**
+
+# NOTE: Koin's ViewModel resolution (viewModelOf / get<T>()) is resolved at COMPILE TIME
+# (reified inline get(), JVM Class.getName() keying) — it uses no runtime reflection over your
+# ViewModel constructors. You do NOT need to keep your ViewModels on Koin's behalf.
+# SavedStateHandle is supplied by androidx CreationExtras at creation time, not by Koin reflection.
+# For what you DO need to keep (your @Parcelize/Serializable saved-state classes for process death),
+# see the R8 / ProGuard guide: https://insert-koin.io/docs/reference/koin-android/r8-proguard
```

---

### Incident Patch 11: `b99c1875` (2026-06-11)
**Commit Message**: Fix #2417 - actionable error when viewModelScope { } lacks viewModelScopeFactory()

A ViewModel declared inside viewModelScope { } is registered under the
ViewModelScopeArchetype and is only resolvable when the viewModelScopeFactory()
option is enabled (the option creates the archetype scope). Without it,
KoinViewModelFactory's default path resolves the VM from the factory's scope
(root) and fails with an opaque "No definition found ... on scope '_root_'" —
the exact dead-end #2417 reporters hit after applying the advised
viewModelScope { } workaround.

The factory now detects this case: when root resolution throws
NoDefinitionFound and the VM is registered under ViewModelScopeArchetype
(instanceRegistry.instances + indexKey), it rethrows an actionable error telling
the user to enable viewModelScopeFactory() (or move the VM out of the scope).
Genuinely-missing ViewModels keep the normal NoDefinitionFound message.

Tests (commonTest, RED->GREEN on JVM / wasmJs / native): ViewModelScopeOptionTest
covers the missing-option error, the with-option success, and the
not-over-firing case.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `projects/core/koin-core-viewmodel/src/commonMain/kotlin/org/koin/viewmodel/factory/KoinViewModelFactory.kt` (modified, +20/-1)
```diff
@@ -19,12 +19,15 @@ import androidx.lifecycle.ViewModel
 import androidx.lifecycle.ViewModelProvider
 import androidx.lifecycle.viewmodel.CreationExtras
 import org.koin.core.annotation.KoinInternalApi
+import org.koin.core.definition.indexKey
+import org.koin.core.error.NoDefinitionFoundException
 import org.koin.core.option.hasViewModelScopeFactory
 import org.koin.core.parameter.ParametersDefinition
 import org.koin.core.qualifier.Qualifier
 import org.koin.core.qualifier.TypeQualifier
 import org.koin.core.scope.Scope
 import org.koin.core.scope.ScopeID
+import org.koin.ext.getFullName
 import org.koin.mp.KoinPlatformTools
 import org.koin.mp.generateId
 import org.koin.viewmodel.scope.ViewModelScopeArchetype
@@ -46,7 +49,23 @@ class KoinViewModelFactory(
         val androidParams = AndroidParametersHolder(params, extras)
         val koin = scope.getKoin()
         return if (!koin.optionRegistry.hasViewModelScopeFactory()){
-            scope.getWithParameters(kClass, qualifier, androidParams)
+            try {
+                scope.getWithParameters(kClass, qualifier, androidParams)
+            } catch (e: NoDefinitionFoundException) {
+                // #2417: the ViewModel may be declared inside viewModelScope { } (registered under
+                // the ViewModel scope archetype), which is only resolvable when the
+                // viewModelScopeFactory() option is enabled. Detect that and guide the user.
+                val isDeclaredInViewModelScope =
+                    koin.instanceRegistry.instances.containsKey(indexKey(kClass, qualifier, ViewModelScopeArchetype))
+                if (isDeclaredInViewModelScope) {
+                    throw IllegalStateException(
+                        "ViewModel '${kClass.getFullName()}' is declared inside viewModelScope { } but the viewModelScopeFactory() option is not enabled. " +
+                            "Enable it in your Koin configuration — options(viewModelScopeFactory()) — or move the ViewModel out of viewModelScope { }.",
+                        e,
+                    )
+                }
+                throw e
+            }
         } else {
             val scopeId = getViewModelScopeId(modelClass)
             val vmScope = koin.createScope(scopeId, TypeQualifier(modelClass), null, ViewModelScopeArchetype)
```

**File**: `projects/core/koin-core-viewmodel/src/commonTest/kotlin/org/koin/viewmodel/ViewModelScopeOptionTest.kt` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+package org.koin.viewmodel
+
+import androidx.lifecycle.ViewModel
+import androidx.lifecycle.ViewModelStore
+import androidx.lifecycle.viewmodel.CreationExtras
+import org.koin.core.annotation.KoinExperimentalAPI
+import org.koin.core.annotation.KoinInternalApi
+import org.koin.core.annotation.KoinViewModelScopeApi
+import org.koin.core.error.NoDefinitionFoundException
+import org.koin.core.module.dsl.viewModel
+import org.koin.core.option.viewModelScopeFactory
+import org.koin.dsl.koinApplication
+import org.koin.dsl.module
+import org.koin.viewmodel.scope.viewModelScope
+import kotlin.test.Test
+import kotlin.test.assertFailsWith
+import kotlin.test.assertNotNull
+import kotlin.test.assertTrue
+
+/**
+ * #2417(b): a ViewModel declared inside viewModelScope { } resolves from _root_ and throws an
+ * opaque NoDefinitionFound when the viewModelScopeFactory() option is not enabled. The option is
+ * required for viewModelScope { } to be resolvable; the error should say so.
+ */
+@OptIn(KoinInternalApi::class, KoinExperimentalAPI::class, KoinViewModelScopeApi::class)
+class ViewModelScopeOptionTest {
+
+    class MyVM : ViewModel()
+    class UnregisteredVM : ViewModel()
+
+    @Test
+    fun viewModelScope_without_factory_option_gives_actionable_error_2417b() {
+        val koin = koinApplication {
+            modules(module { viewModelScope { viewModel { MyVM() } } })
+        }.koin
+
+        val error = assertFailsWith<Throwable> {
+            resolveViewModel(MyVM::class, ViewModelStore(), null, CreationExtras.Empty, null, koin.scopeRegistry.rootScope)
+        }
+        val msg = error.message ?: ""
+        assertTrue(
+            msg.contains("viewModelScopeFactory"),
+            "expected guidance to enable viewModelScopeFactory(), got: $msg",
+        )
+    }
+
+    @Test
+    fun viewModelScope_with_factory_option_resolves() {
+        val koin = koinApplication {
+            options(viewModelScopeFactory())
+            modules(module { viewModelScope { viewModel { MyVM() } } })
+        }.koin
+
+        val vm = resolveViewModel(MyVM::class, ViewModelStore(), null, CreationExtras.Empty, null, koin.scopeRegistry.rootScope)
+        assertNotNull(vm)
+    }
+
+    @Test
+    fun genuinely_missing_viewmodel_keeps_generic_error() {
+        val koin = koinApplication { }.koin
+
+        // UnregisteredVM is not declared anywhere → must stay a plain NoDefinitionFound,
+        // not the viewModelScopeFactory hint (guards against over-firing).
+        val error = assertFailsWith<NoDefinitionFoundException> {
+            resolveViewModel(UnregisteredVM::class, ViewModelStore(), null, CreationExtras.Empty, null, koin.scopeRegistry.rootScope)
+        }
+        assertTrue((error.message ?: "").contains("No definition found"))
+    }
+}
```

---

### Incident Patch 12: `b5ddd530` (2026-06-09)
**Commit Message**: Merge pull request #2438 from InsertKoinIO/fix/2379-root-factory-scoped-dep

Fix #2379 - root factory's scoped deps resolved from _root_ (CoreResolverV2)

**File**: `projects/core/koin-core/src/commonMain/kotlin/org/koin/core/resolution/CoreResolverV2.kt` (modified, +12/-0)
```diff
@@ -21,6 +21,7 @@ import org.koin.core.annotation.KoinInternalApi
 import org.koin.core.error.NoDefinitionFoundException
 import org.koin.core.instance.InstanceFactory
 import org.koin.core.instance.ResolutionContext
+import org.koin.core.instance.SingleInstanceFactory
 import org.koin.core.scope.Scope
 import org.koin.ext.getFullName
 
@@ -86,6 +87,17 @@ class CoreResolverV2(
             // 1. Registry on this linked scope
             val factory = findDefinitionInScope(linkedScope, ctx)
             if (factory != null) {
+                // #2379: a root FACTORY requested from a child scope keeps the ORIGINATING
+                // context, so its transitive (possibly scoped/archetype) dependencies
+                // resolve back in the requesting scope instead of falling through to _root_.
+                // The origin ctx already carries the scope + scopeArchetype and its params
+                // are already stacked on it, so no context switch or re-stacking is needed.
+                // Root SINGLES are excluded: a singleton must resolve its dependencies once,
+                // from root, and must never capture a scope-local instance (guard: #2325).
+                if (linkedScope.isRoot && factory !is SingleInstanceFactory<*>) {
+                    return factory.get(ctx) as T?
+                }
+
                 // we will loose parameters from parent context
                 val newCtx = ctx.newContextForScope(linkedScope)
                 if (linkedScope.scopeArchetype != null && !linkedScope.isRoot) {
```

**File**: `projects/core/koin-core/src/commonTest/kotlin/org/koin/core/ArchetypeDeclareResolveTest.kt` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
+package org.koin.core
+
+import org.koin.Simple
+import org.koin.core.annotation.KoinInternalApi
+import org.koin.core.component.getScopeId
+import org.koin.core.logger.Level
+import org.koin.core.module.KoinDslMarker
+import org.koin.core.module.Module
+import org.koin.core.qualifier.TypeQualifier
+import org.koin.dsl.ScopeDSL
+import org.koin.dsl.koinApplication
+import org.koin.dsl.module
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertNotNull
+
+/**
+ * Regression repro for issue #2379 (archetype-scope variant).
+ *
+ * The plain named-scope case is covered by DeclareInstanceTest. The case still
+ * reported failing in 4.2.0/4.2.1 (dees91) uses an *archetype* scope
+ * (activityRetainedScope): a scoped definition resolved through its archetype,
+ * whose transitive get() for a declared dependency falls through to _root_.
+ */
+class ArchetypeDeclareResolveTest {
+
+    open class Archetype
+    class ArchetypeExt : Archetype()
+
+    @KoinDslMarker
+    fun Module.scopeArchetype(scopeSet: ScopeDSL.() -> Unit) {
+        val qualifier = TypeQualifier(Archetype::class)
+        ScopeDSL(qualifier, this).apply(scopeSet)
+    }
+
+    @OptIn(KoinInternalApi::class)
+    @Test
+    fun archetype_scope_resolves_declared_transitive_dependency_issue_2379() {
+        val scopeModule = module {
+            scopeArchetype {
+                scoped { Simple.ComponentB(get()) }
+            }
+        }
+        val koin = koinApplication {
+            printLogger(Level.DEBUG)
+            modules(scopeModule)
+        }.koin
+
+        val archetypeExt = ArchetypeExt()
+        val scope = koin.createScope<ArchetypeExt>(
+            archetypeExt.getScopeId(), archetypeExt,
+            TypeQualifier(Archetype::class)
+        )
+        scope.declare(Simple.ComponentA())
+
+        // declared dependency must resolve from the scope it was declared in
+        val a = scope.getOrNull<Simple.ComponentA>()
+        assertNotNull(a)
+
+        // scoped ComponentB's transitive get() for ComponentA must resolve in-scope, not _root_
+        val b = scope.get<Simple.ComponentB>()
+        assertEquals(a, b.a)
+    }
+
+    // dees91 minimal shape: a ROOT factory depends on a SCOPED dependency,
+    // resolved transitively from the scope. v2 switches context to root when it
+    // finds the root factory via linked scopes, then can't resolve the scoped dep.
+    class Connector
+    class Interactor(val connector: Connector)
+
+    @OptIn(KoinInternalApi::class)
+    @Test
+    fun root_factory_depending_on_scoped_dep_resolves_in_scope_issue_2379() {
+        val scopeModule = module {
+            scopeArchetype {
+                scoped { Connector() }
+            }
+            factory { Interactor(get()) } // ROOT factory needs the scoped Connector
+        }
+        val koin = koinApplication {
+            printLogger(Level.DEBUG)
+            modules(scopeModule)
+        }.koin
+
+        val archetypeExt = ArchetypeExt()
+        val scope = koin.createScope<ArchetypeExt>(
+            archetypeExt.getScopeId(), archetypeExt,
+            TypeQualifier(Archetype::class)
+        )
+
+        // resolving the root factory FROM the scope must let its scoped dep resolve in-scope
+        val interactor = scope.get<Interactor>()
+        assertNotNull(interactor.connector)
+    }
+}
```

---

### Incident Patch 13: `65745158` (2026-06-09)
**Commit Message**: Fix #2379 - CoreResolverV2 resolved root factory's scoped deps from _root_

A root-level factory requested from a child scope had its body resolved with
the root scope as context (resolveFromLinkedScopes switched context via
newContextForScope when the definition was found in the linked root scope).
Its transitive scoped/archetype dependencies then resolved from _root_ and
failed with NoDefinitionFoundException - e.g. a ViewModel-scope chain
ViewModel -> root factories -> activityRetainedScope-scoped dependency.

Fix: when the definition is found in the root linked scope and is NOT a
single, invoke it with the ORIGINATING context. The origin context already
carries the requesting scope + scopeArchetype (and its params are stacked on
it), so the factory's scoped deps resolve in-scope. Root singles are excluded:
a singleton must resolve its dependencies once, from root, and must never
capture a scope-local instance (regression guard: #2325).

O(1) preserved: one type check, no recursion - V2's single-pass linked-scope
walk is unchanged otherwise.

Regression test (commonTest, RED->GREEN on JVM/wasmJs/native):
ArchetypeDeclareResolveTest.root_factory_depending_on_scoped_dep_*.

Co-Aut

**File**: `projects/core/koin-core/src/commonMain/kotlin/org/koin/core/resolution/CoreResolverV2.kt` (modified, +12/-0)
```diff
@@ -21,6 +21,7 @@ import org.koin.core.annotation.KoinInternalApi
 import org.koin.core.error.NoDefinitionFoundException
 import org.koin.core.instance.InstanceFactory
 import org.koin.core.instance.ResolutionContext
+import org.koin.core.instance.SingleInstanceFactory
 import org.koin.core.scope.Scope
 import org.koin.ext.getFullName
 
@@ -86,6 +87,17 @@ class CoreResolverV2(
             // 1. Registry on this linked scope
             val factory = findDefinitionInScope(linkedScope, ctx)
             if (factory != null) {
+                // #2379: a root FACTORY requested from a child scope keeps the ORIGINATING
+                // context, so its transitive (possibly scoped/archetype) dependencies
+                // resolve back in the requesting scope instead of falling through to _root_.
+                // The origin ctx already carries the scope + scopeArchetype and its params
+                // are already stacked on it, so no context switch or re-stacking is needed.
+                // Root SINGLES are excluded: a singleton must resolve its dependencies once,
+                // from root, and must never capture a scope-local instance (guard: #2325).
+                if (linkedScope.isRoot && factory !is SingleInstanceFactory<*>) {
+                    return factory.get(ctx) as T?
+                }
+
                 // we will loose parameters from parent context
                 val newCtx = ctx.newContextForScope(linkedScope)
                 if (linkedScope.scopeArchetype != null && !linkedScope.isRoot) {
```

**File**: `projects/core/koin-core/src/commonTest/kotlin/org/koin/core/ArchetypeDeclareResolveTest.kt` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
+package org.koin.core
+
+import org.koin.Simple
+import org.koin.core.annotation.KoinInternalApi
+import org.koin.core.component.getScopeId
+import org.koin.core.logger.Level
+import org.koin.core.module.KoinDslMarker
+import org.koin.core.module.Module
+import org.koin.core.qualifier.TypeQualifier
+import org.koin.dsl.ScopeDSL
+import org.koin.dsl.koinApplication
+import org.koin.dsl.module
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertNotNull
+
+/**
+ * Regression repro for issue #2379 (archetype-scope variant).
+ *
+ * The plain named-scope case is covered by DeclareInstanceTest. The case still
+ * reported failing in 4.2.0/4.2.1 (dees91) uses an *archetype* scope
+ * (activityRetainedScope): a scoped definition resolved through its archetype,
+ * whose transitive get() for a declared dependency falls through to _root_.
+ */
+class ArchetypeDeclareResolveTest {
+
+    open class Archetype
+    class ArchetypeExt : Archetype()
+
+    @KoinDslMarker
+    fun Module.scopeArchetype(scopeSet: ScopeDSL.() -> Unit) {
+        val qualifier = TypeQualifier(Archetype::class)
+        ScopeDSL(qualifier, this).apply(scopeSet)
+    }
+
+    @OptIn(KoinInternalApi::class)
+    @Test
+    fun archetype_scope_resolves_declared_transitive_dependency_issue_2379() {
+        val scopeModule = module {
+            scopeArchetype {
+                scoped { Simple.ComponentB(get()) }
+            }
+        }
+        val koin = koinApplication {
+            printLogger(Level.DEBUG)
+            modules(scopeModule)
+        }.koin
+
+        val archetypeExt = ArchetypeExt()
+        val scope = koin.createScope<ArchetypeExt>(
+            archetypeExt.getScopeId(), archetypeExt,
+            TypeQualifier(Archetype::class)
+        )
+        scope.declare(Simple.ComponentA())
+
+        // declared dependency must resolve from the scope it was declared in
+        val a = scope.getOrNull<Simple.ComponentA>()
+        assertNotNull(a)
+
+        // scoped ComponentB's transitive get() for ComponentA must resolve in-scope, not _root_
+        val b = scope.get<Simple.ComponentB>()
+        assertEquals(a, b.a)
+    }
+
+    // dees91 minimal shape: a ROOT factory depends on a SCOPED dependency,
+    // resolved transitively from the scope. v2 switches context to root when it
+    // finds the root factory via linked scopes, then can't resolve the scoped dep.
+    class Connector
+    class Interactor(val connector: Connector)
+
+    @OptIn(KoinInternalApi::class)
+    @Test
+    fun root_factory_depending_on_scoped_dep_resolves_in_scope_issue_2379() {
+        val scopeModule = module {
+            scopeArchetype {
+                scoped { Connector() }
+            }
+            factory { Interactor(get()) } // ROOT factory needs the scoped Connector
+        }
+        val koin = koinApplication {
+            printLogger(Level.DEBUG)
+            modules(scopeModule)
+        }.koin
+
+        val archetypeExt = ArchetypeExt()
+        val scope = koin.createScope<ArchetypeExt>(
+            archetypeExt.getScopeId(), archetypeExt,
+            TypeQualifier(Archetype::class)
+        )
+
+        // resolving the root factory FROM the scope must let its scoped dep resolve in-scope
+        val interactor = scope.get<Interactor>()
+        assertNotNull(interactor.connector)
+    }
+}
```

---

### Incident Patch 14: `91f4aee8` (2026-06-09)
**Commit Message**: Merge pull request #2437 from InsertKoinIO/fix/2370-qualified-param-shadowing

Fix #2370 #2408 - qualified dependency shadowed by parametersOf in CoreResolverV2

**File**: `projects/CLAUDE.md` (modified, +8/-0)
```diff
@@ -24,6 +24,7 @@ Koin is a pragmatic, lightweight dependency injection framework for Kotlin Multi
 ### Key engine areas (`core/koin-core/src/commonMain/kotlin/org/koin/`)
 
 - `core/resolution/` — instance resolution. `CoreResolverV2.kt` is the 4.2+ engine: injected params → stacked params → registry (scope source → linked scopes → archetype)
+  - **Qualified lookups are registry-only.** A `get(named(...))` skips the stacked-parameter path entirely — parameters carry no qualifier (`ParametersHolder` matches by type only), so a stacked param can never satisfy a qualified request. Removing this guard re-opens #2370/#2408 (a `parametersOf` value shadowing a qualified dependency of the same type). Only unqualified resolution reads the param stack — that's the #2387 ViewModel path; don't break it.
 - `core/registry/` — definition & instance registries (indexing by type + qualifier)
 - `core/scope/` — `Scope`, scope archetypes, linked scopes
 - `core/module/` — module DSL (`single`, `factory`, `scoped`, `bind`, `includes`)
@@ -74,6 +75,13 @@ Before opening (or approving) any PR, both guards must pass:
 - **No backtick test names in `commonTest`** — backtick names (`` fun `my test`() ``) break `compileTestKotlinJs`/`compileTestKotlinWasmJs` (invalid JS identifiers). Use snake_case in `commonTest`; backticks are fine in `jvmTest` only.
 - **`runTest {}` in `commonTest` must use block-body syntax** — on wasmJs, expression-body forms (`fun foo() = runTest { }`) fail with return-type mismatch. Use `fun testX() { runTest { ... } }`.
 
+#### Known pre-existing off-JVM failures (not yours — don't chase them)
+
+`allTests` is currently red on two counts unrelated to any recent resolver work (verified by stash-comparison on the `4.2.2` branch, 2026-06-08). If you touch `commonMain` and run `allTests`, expect these and confirm your diff doesn't change them:
+
+- **`createdAtStart` on wasmJs** — `CreateOnStart`, `OverrideAndCreateatStartTest` fail with `AssertionError: Expected value to be true`. Core `single(createdAtStart = true)` eager-init doesn't fire on wasmJs. This is *core*, **not** the compiler-plugin `createdAtStart` drop (#2425/#2415) — same symptom family, different layer.
+- **`DynamicModulesTest` on native** — its backtick names contain `" - "` (e.g. `` `should unload one module definition - factory` ``), crashing the Kotlin/Native test reporter (`ServiceMessagesParser`) and aborting `macosArm64Test`. This is the backtick-name trap above, already shipped. Fix = rename to snake_case.
+
 ## Versioning
 
 - Version is set in `gradle.properties` (`koinVersion`).
```

**File**: `projects/core/koin-core-viewmodel/src/commonTest/kotlin/org/koin/viewmodel/ViewModelQualifiedParamTest.kt` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+package org.koin.viewmodel
+
+import androidx.lifecycle.ViewModel
+import org.koin.core.logger.Level
+import org.koin.core.module.dsl.viewModel
+import org.koin.core.parameter.parametersOf
+import org.koin.core.qualifier.named
+import org.koin.dsl.koinApplication
+import org.koin.dsl.module
+import kotlin.test.Test
+import kotlin.test.assertEquals
+
+/**
+ * Regression test for issue #2370 / #2408 in the ViewModel resolution path.
+ *
+ * A ViewModel that receives a runtime parameter via parametersOf() AND a qualified
+ * collaborator of an overlapping type (String here) must not have the qualified
+ * dependency shadowed by the parameter. Before the qualifier guard in
+ * CoreResolverV2.resolveFromStackedParameters, the qualified `get(named("Config"))`
+ * was satisfied by the stacked "screenId" parameter instead of the registry definition.
+ */
+class ViewModelQualifiedParamTest {
+
+    private val configQualifier = named("Config")
+    private val globalConfig = "CONFIG_STRING"
+
+    private class MyViewModel(val screenId: String, val config: String) : ViewModel()
+
+    private val testModule = module {
+        single(configQualifier) { globalConfig }
+
+        viewModel { (screenId: String) ->
+            MyViewModel(screenId = screenId, config = get(configQualifier))
+        }
+    }
+
+    @Test
+    fun viewModel_qualified_dependency_is_not_shadowed_by_parameter() {
+        val koin = koinApplication {
+            printLogger(Level.DEBUG)
+            modules(testModule)
+        }.koin
+
+        val vm: MyViewModel = koin.get { parametersOf("screenId") }
+
+        // The parameter must reach the ViewModel constructor param
+        assertEquals("screenId", vm.screenId)
+
+        // ...but the qualified dependency must come from the registry, NOT the parameter.
+        // Bug: vm.config == "screenId"
+        assertEquals(globalConfig, vm.config)
+    }
+}
```

**File**: `projects/core/koin-core/src/commonMain/kotlin/org/koin/core/resolution/CoreResolverV2.kt` (modified, +4/-0)
```diff
@@ -131,6 +131,10 @@ class CoreResolverV2(
     }
 
     private inline fun <T> resolveFromStackedParameters(scope: Scope, ctx: ResolutionContext): T? {
+        // A qualified lookup (get(named(...))) is a registry-only question: stacked parameters
+        // carry no qualifier (ParametersHolder matches by type only), so they can never be a
+        // legitimate match and would only shadow the qualified definition (#2370, #2408).
+        if (ctx.qualifier != null) return null
         val stack = scope._parameterStack ?: return null
         val current = stack.get()
         return if (current.isNullOrEmpty()) null
```

**File**: `projects/core/koin-core/src/commonTest/kotlin/org/koin/core/QualifierParameterShadowingTest.kt` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+package org.koin.core
+
+import org.koin.core.logger.Level
+import org.koin.core.parameter.parametersOf
+import org.koin.core.qualifier.named
+import org.koin.dsl.koinApplication
+import org.koin.dsl.module
+import kotlin.test.Test
+import kotlin.test.assertEquals
+
+/**
+ * Regression test for issue #2370 / #2408 / #2393.
+ *
+ * CoreResolverV2 consults the stacked-parameter stack BEFORE the registry, and the
+ * stacked-parameter lookup matches by type only (ignoring the qualifier). As a result a
+ * qualified dependency (`get(named(...))`) of the same type as a value passed via
+ * `parametersOf(...)` is silently shadowed by the parameter.
+ *
+ * Worked in 4.0.0 / 3.5.6, broke in 4.1.1+ (resolver order change).
+ */
+class QualifierParameterShadowingTest {
+
+    private val configQualifier = named("Config")
+    private val activityScope = named("TestScope")
+
+    private val globalConfig = "CONFIG_STRING"
+
+    private class Service(val config: String)
+
+    private data class UseCase(val parameter: String, val service: Service)
+
+    private val testModule = module {
+        single(configQualifier) { globalConfig }
+
+        factory { Service(config = get(configQualifier)) }
+
+        factory { (parameterString: String) ->
+            UseCase(parameter = parameterString, service = get())
+        }
+
+        scope(activityScope) { }
+    }
+
+    @Test
+    fun qualified_string_is_not_shadowed_by_parametersOf_value() {
+        val koin = koinApplication {
+            printLogger(Level.DEBUG)
+            modules(testModule)
+        }.koin
+
+        val scope = koin.createScope("test", activityScope)
+
+        val useCase: UseCase = scope.get { parametersOf("parameterString") }
+
+        // The parameter must reach UseCase.parameter
+        assertEquals("parameterString", useCase.parameter)
+
+        // ...but Service.config must come from the qualified definition, NOT the parameter.
+        // Bug: useCase.service.config == "parameterString"
+        assertEquals(globalConfig, useCase.service.config)
+    }
+}
```

---

### Incident Patch 15: `4fae618a` (2026-06-08)
**Commit Message**: Fix #2370 #2408 - CoreResolverV2 stacked params shadowed qualified deps

A qualified lookup (get(named(...))) could be silently satisfied by a value
passed via parametersOf() of the same type. CoreResolverV2 consults the
stacked-parameter stack before the registry, and the stacked-param lookup
matches by type only (ParametersHolder carries no qualifier), so a qualified
dependency was shadowed by an unqualified parameter of an overlapping type.

Worked in 4.0.0 / 3.5.6, regressed with the resolver order change in 4.1.1+.

Fix: skip the stacked-parameter path when ctx.qualifier != null. A qualified
request is a registry-only question by construction (parameters cannot carry a
qualifier), so this loses no legitimate match. Unqualified resolution -
including the ViewModel param-stacking path from #2387 - is untouched.

Regression tests (commonTest, falsified RED->GREEN on JVM, wasmJs, native):
- QualifierParameterShadowingTest (factory + qualified dep)
- ViewModelQualifiedParamTest (viewModel DSL + param + qualified dep)

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `projects/core/koin-core-viewmodel/src/commonTest/kotlin/org/koin/viewmodel/ViewModelQualifiedParamTest.kt` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+package org.koin.viewmodel
+
+import androidx.lifecycle.ViewModel
+import org.koin.core.logger.Level
+import org.koin.core.module.dsl.viewModel
+import org.koin.core.parameter.parametersOf
+import org.koin.core.qualifier.named
+import org.koin.dsl.koinApplication
+import org.koin.dsl.module
+import kotlin.test.Test
+import kotlin.test.assertEquals
+
+/**
+ * Regression test for issue #2370 / #2408 in the ViewModel resolution path.
+ *
+ * A ViewModel that receives a runtime parameter via parametersOf() AND a qualified
+ * collaborator of an overlapping type (String here) must not have the qualified
+ * dependency shadowed by the parameter. Before the qualifier guard in
+ * CoreResolverV2.resolveFromStackedParameters, the qualified `get(named("Config"))`
+ * was satisfied by the stacked "screenId" parameter instead of the registry definition.
+ */
+class ViewModelQualifiedParamTest {
+
+    private val configQualifier = named("Config")
+    private val globalConfig = "CONFIG_STRING"
+
+    private class MyViewModel(val screenId: String, val config: String) : ViewModel()
+
+    private val testModule = module {
+        single(configQualifier) { globalConfig }
+
+        viewModel { (screenId: String) ->
+            MyViewModel(screenId = screenId, config = get(configQualifier))
+        }
+    }
+
+    @Test
+    fun viewModel_qualified_dependency_is_not_shadowed_by_parameter() {
+        val koin = koinApplication {
+            printLogger(Level.DEBUG)
+            modules(testModule)
+        }.koin
+
+        val vm: MyViewModel = koin.get { parametersOf("screenId") }
+
+        // The parameter must reach the ViewModel constructor param
+        assertEquals("screenId", vm.screenId)
+
+        // ...but the qualified dependency must come from the registry, NOT the parameter.
+        // Bug: vm.config == "screenId"
+        assertEquals(globalConfig, vm.config)
+    }
+}
```

**File**: `projects/core/koin-core/src/commonMain/kotlin/org/koin/core/resolution/CoreResolverV2.kt` (modified, +4/-0)
```diff
@@ -131,6 +131,10 @@ class CoreResolverV2(
     }
 
     private inline fun <T> resolveFromStackedParameters(scope: Scope, ctx: ResolutionContext): T? {
+        // A qualified lookup (get(named(...))) is a registry-only question: stacked parameters
+        // carry no qualifier (ParametersHolder matches by type only), so they can never be a
+        // legitimate match and would only shadow the qualified definition (#2370, #2408).
+        if (ctx.qualifier != null) return null
         val stack = scope._parameterStack ?: return null
         val current = stack.get()
         return if (current.isNullOrEmpty()) null
```

**File**: `projects/core/koin-core/src/commonTest/kotlin/org/koin/core/QualifierParameterShadowingTest.kt` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+package org.koin.core
+
+import org.koin.core.logger.Level
+import org.koin.core.parameter.parametersOf
+import org.koin.core.qualifier.named
+import org.koin.dsl.koinApplication
+import org.koin.dsl.module
+import kotlin.test.Test
+import kotlin.test.assertEquals
+
+/**
+ * Regression test for issue #2370 / #2408 / #2393.
+ *
+ * CoreResolverV2 consults the stacked-parameter stack BEFORE the registry, and the
+ * stacked-parameter lookup matches by type only (ignoring the qualifier). As a result a
+ * qualified dependency (`get(named(...))`) of the same type as a value passed via
+ * `parametersOf(...)` is silently shadowed by the parameter.
+ *
+ * Worked in 4.0.0 / 3.5.6, broke in 4.1.1+ (resolver order change).
+ */
+class QualifierParameterShadowingTest {
+
+    private val configQualifier = named("Config")
+    private val activityScope = named("TestScope")
+
+    private val globalConfig = "CONFIG_STRING"
+
+    private class Service(val config: String)
+
+    private data class UseCase(val parameter: String, val service: Service)
+
+    private val testModule = module {
+        single(configQualifier) { globalConfig }
+
+        factory { Service(config = get(configQualifier)) }
+
+        factory { (parameterString: String) ->
+            UseCase(parameter = parameterString, service = get())
+        }
+
+        scope(activityScope) { }
+    }
+
+    @Test
+    fun qualified_string_is_not_shadowed_by_parametersOf_value() {
+        val koin = koinApplication {
+            printLogger(Level.DEBUG)
+            modules(testModule)
+        }.koin
+
+        val scope = koin.createScope("test", activityScope)
+
+        val useCase: UseCase = scope.get { parametersOf("parameterString") }
+
+        // The parameter must reach UseCase.parameter
+        assertEquals("parameterString", useCase.parameter)
+
+        // ...but Service.config must come from the qualified definition, NOT the parameter.
+        // Bug: useCase.service.config == "parameterString"
+        assertEquals(globalConfig, useCase.service.config)
+    }
+}
```

#### Recent Merged Pull Requests:
- **PR #2466** (closed): Setup koin version catalog (@kibettheophilus)
- **PR #2448** (2026-06-12): Finalize 4.2.2 — version bump + Navigation 3 typed entryProvider docs (#2336) (@arnaudgiuliani)
- **PR #2447** (closed): Fix #2386 - withOptions leaves stale index entries on qualifier/secondary change (@arnaudgiuliani)
- **PR #2446** (2026-06-12): Fix #2348 - ignore non-String environment properties (ClassCastException) (@arnaudgiuliani)
- **PR #2445** (closed): Fix #2410 - non-blocking RequestScope id (cherry-pick of #2432 by @lfavreli-betclic) (@arnaudgiuliani)
- **PR #2444** (2026-06-12): Fix #2299 - link viewModelScopeFactory scope to its parent scope (@arnaudgiuliani)
- **PR #2443** (2026-06-12): Docs: viewModelScope { } requires viewModelScopeFactory() (#2417) (@arnaudgiuliani)
- **PR #2442** (2026-06-12): Fix #2426 - add tvOS targets to koin-core-viewmodel (@arnaudgiuliani)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
