# Forensic Learning Record (Deep Inspection): russhwolf/multiplatform-settings

> **Canonical Artifact**: `07_PROJECT_LEARNING/russhwolf-multiplatform-settings-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/russhwolf/multiplatform-settings](https://github.com/russhwolf/multiplatform-settings))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:01:53.117Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `russhwolf/multiplatform-settings`
- **Description**: A Kotlin Multiplatform library for saving simple key-value data
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2254 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `multiplatform-settings-coroutines/src/commonMain/kotlin/com/russhwolf/settings/coroutines/StateFlowExtensions.kt`
```
/*
 * Copyright 2019 Russell Wolf
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.russhwolf.settings.coroutines

import com.russhwolf.settings.ExperimentalSettingsApi
import com.russhwolf.settings.ObservableSettings
import com.russhwolf.settings.Settings
import com.russhwolf.settings.SettingsListener
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.stateIn

@ExperimentalSettingsApi
private inline fun <T> ObservableSettings.createStateFlow(
    coroutineScope: CoroutineScope,
    key: String,
    defaultValue: T,
    sharingStarted: SharingStarted,
    crossinline getter: Settings.(String, T) -> T,
    crossinline addListener: ObservableSettings.(String, T, (T) -> Unit) -> SettingsListener
): StateFlow<T> = callbackFlow {
    val listener = addListener(key, defaultValue) {
        trySend(it)
    }
    awaitClose {
        listener.deactivate()
    }
}.stateIn(coroutineScope, sharingStarted, getter(key, defaultValue))

@ExperimentalSettingsApi
private inline fun <T> ObservableSettings.createNullableStateFlow(
    coroutineScope: CoroutineScope,
    key: String,
    sharingStarted: SharingStarted,
    crossinline getter: Settings.(String) -> T?,
    crossinline addListener: ObservableSettings.(String, (T?) -> Unit) -> SettingsListener
): StateFlow<T?> =
    createStateFlow<T?>(
        coroutineScope,
        key,
        null,
        sharingStarted,
        { it, _ -> getter(it) },
        { it, _, callback -> addListener(it, callback) })

/**
 * Create a new `StateFlow`, based on observing the given [key] as an `Int`. This flow will emit when the underlying `Settings` changes. When no value is present, [defaultValue] will be emitted instead.
 */
@ExperimentalSettingsApi
public fun ObservableSettings.getIntStateFlow(
    coroutineScope: CoroutineScope,
    key: String,
    defaultValue: Int,
    sharingStarted: SharingStarted = SharingStarted.Eagerly
): StateFlow<Int> =
    createStateFlow(
        coroutineScope,
        key,
        defaultValue,
        sharingStarted,
        Settings::getInt,
        ObservableSettings::addIntListener
    )

/**
 * Create a new `StateFlow`, based on observing the given [key] as a `Long`. This flow will emit when the underlying `Settings` changes. When no value is present, [defaultValue] will be emitted instead.
 */
@ExperimentalSettingsApi
public fun ObservableSettings.getLongStateFlow(
    coroutineScope: CoroutineScope,
    key: String,
    defaultValue: Long,
    sharingStarted: SharingStarted = SharingStarted.Eagerly
): StateFlow<Long> =
    createStateFlow(
        coroutineScope,
        key,
        defaultValue,
        sharingStarted,
        Settings::getLong,
        ObservableSettings::addLongListener
    )

/**
 * Create a new `StateFlow`, based on observing the given [key] as a `String`. This flow will emit when the underlying `Settings` changes. When no value is present, [defaultValue] will be emitted instead.
 */
@ExperimentalSettingsApi
public fun ObservableSettings.getStringStateFlow(
    coroutineScope: CoroutineScope,
    key: String,
    defaultValue: String,
    sharingStarted: SharingStarted = SharingStarted.Eagerly
): StateFlow<String> =
    createStateFlow(
        coroutineScope,
        key,
        defaultValue,
        sharingStarted,
        Settings::getString,
        ObservableSettings::addStringListener
    )

/**
 * Create a new `StateFlow`, based on observing the given [key] as a `Float`. This flow will emit when the underlying `Settings` changes. When no value is present, [defaultValue] will be emitted instead.
 */
@ExperimentalSettingsApi
public fun ObservableSettings.getFloatStateFlow(
    coroutineScope: CoroutineScope,
    key: String,
    defaultValue: Float,
    sharingStarted: SharingStarted = SharingStarted.Eagerly
): StateFlow<Float> =
    createStateFlow(
        coroutineScope,
        key,
        defaultValue,
        sharingStarted,
        Settings::getFloat,
        ObservableSettings::addFloatListener
    )

/**
 * Create a new `StateFlow`, based on observing the given [key] as a `Double`. This flow will emit when the underlying `Settings` changes. When no value is present, [defaultValue] will be emitted instead.
 */
@ExperimentalSettingsApi
public fun ObservableSettings.getDoubleStateFlow(
    coroutineScope: CoroutineScope,
    key: String,
    defaultValue: Double,
    sharingStarted: SharingStarted = SharingStarted.Eagerly
): StateFlow<Double> =
    createStateFlow(
        coroutineScope,
        key,
        defaultValue,
        sharingStarted,
        Settings::getDouble,
        ObservableSettings::addDoubleListener
    )

/**
 * Create a new `StateFlow`, based on observing the given [key] as a `Boolean`. This flow will emit when the underlying `Settings` changes. When no value is present, [defaultValue] will be emitted instead.
 */
@ExperimentalSettingsApi
public fun ObservableSettings.getBooleanStateFlow(
    coroutineScope: CoroutineScope,
    key: String,
    defaultValue: Boolean,
    sharingStarted: SharingStarted = SharingStarted.Eagerly
): StateFlow<Boolean> =
    createStateFlow(
        coroutineScope,
        key,
        defaultValue,
        sharingStarted,
        Settings::getBoolean,
        ObservableSettings::addBooleanListener
    )

/**
 * Create a new `StateFlow`, based on observing the given [key] as an `Int`. This flow will emit when the underlying `Settings` changes. When no value is present, `null` will be emitted instead.
 */
@ExperimentalSettingsApi
public fun ObservableSettings.getIntOrNullStateFlow(
    coroutineScope: CoroutineScope,
    key: String,
    sharingStarted: SharingStarted = SharingStarted.Eagerly
): StateFlow<Int?> =
    createNullableStateFlow(
        coroutineScope,
        key,
        sharingStarted,
        Settings::getIntOrNull,
        ObservableSettings::addIntOrNullListener
    )

/**
 * Create a new `StateFlow`, based on observing the given [key] as a nullable `Long`. This flow will emit when the underlying `Settings` changes. When no value is present, `null` will be emitted instead.
 */
@ExperimentalSettingsApi
public fun ObservableSettings.getLongOrNullStateFlow(
    coroutineScope: CoroutineScope,
    key: String,
    sharingStarted: SharingStarted = SharingStarted.Eagerly
): StateFlow<Long?> =
    createNullableStateFlow(
        coroutineScope,
        key,
        sharingStarted,
        Settings::getLongOrNull,
        ObservableSettings::addLongOrNullListener
    )

/**
 * Create a new `StateFlow`, based on observing the given [key] as a nullable `String`. This flow will emit when the underlying `Settings` changes. When no value is present, `null` will be emitted instead.
 */
@ExperimentalSettingsApi
public fun ObservableSettings.getStringOrNullStateFlow(
    coroutineScope: CoroutineScope,
    key: String,
    sharingStarted: SharingStarted = SharingStarted.Eagerly
): StateFlow<String?> =
    createNullableStateFlow(
        coroutineScope,
        key,
        sharingStarted,
        Settings::getStringOrNull,
        ObservableSettings::addStringOrNullListener
    )

/**
 * Create a new `StateFlow`, based on observing the given [key] as a nullable `Float`. This flow will emit when the underlying `Settings` changes. When no value is present, `null` will be emitted instead.
 */
@ExperimentalSettingsApi
public fun ObservableSettings.getFloatOrNullStateFlow(
    coroutineScope: CoroutineScope,
    key: String,
    sharingStarted: SharingStarted = SharingStarted.Eagerly
): StateFlow<Float?> =
    createNullableStateFlow(
        coroutineScope,
        key,
        sharingStarted,
        Settings::getFloatOrNull,
        ObservableSettings::addFloatOrNullListener
    )

/**
 * Create a new `StateFlow`, based on observing the given [key] as a nullable `Double`. This flow will emit when the underlying `Settings` changes. When no value is present, `null` will be emitted instead.
 */
@ExperimentalSettingsApi
public fun ObservableSettings.getDoubleOrNullStateFlow(
    coroutineScope: CoroutineScope,
    key: String,
    sharingStarted: SharingStarted = SharingStarted.Eagerly
): StateFlow<Double?> =
    createNullableStateFlow(
        coroutineScope,
        key,
        sharingStarted,
        Settings::getDoubleOrNull,
        ObservableSettings::addDoubleOrNullListener
    )

/**
 * Create a new `StateFlow`, based on observing the given [key] as a nullable `Boolean`. This flow will emit when the underlying `Settings` changes. When no value is present, `null` will be emitted instead.
 */
@ExperimentalSettingsApi
public fun ObservableSettings.getBooleanOrNullStateFlow(
    coroutineScope: CoroutineScope,
    key: String,
    sharingStarted: SharingStarted = SharingStarted.Eagerly
): StateFlow<Boolean?> =
    createNullableStateFlow(
        coroutineScope,
        key,
        sharingStarted,
        Settings::getBooleanOrNull,
        ObservableSettings::addBooleanOrNullListener
    )


```

### Core Architecture Module: `convention-plugins/src/main/kotlin/StandardConfigExtension.kt`
```
import org.gradle.api.Project
import org.gradle.kotlin.dsl.getByType
import org.jetbrains.kotlin.gradle.ExperimentalWasmDsl
import org.jetbrains.kotlin.gradle.dsl.KotlinMultiplatformExtension

// TODO are there better ways to inject this function into build scripts?
open class StandardConfigExtension {
    private val Project.kotlin get() = extensions.getByType<KotlinMultiplatformExtension>()
    private fun Project.kotlin(block: KotlinMultiplatformExtension.() -> Unit) = kotlin.block()

    fun Project.defaultTargets() {
        kotlin {
            androidTarget {
                publishAllLibraryVariants()
            }

            androidNativeX64()
            androidNativeX86()
            androidNativeArm32()
            androidNativeArm64()

            iosArm64()
            iosSimulatorArm64()
            iosX64()

            js {
                browser()
            }

            jvm()

            linuxArm64()
            linuxX64()

            macosArm64()
            macosX64()

            mingwX64()

            tvosArm64()
            tvosSimulatorArm64()
            tvosX64()

            @OptIn(ExperimentalWasmDsl::class)
            wasmJs {
                browser()
            }

            @OptIn(ExperimentalWasmDsl::class)
            wasmWasi {
                nodejs()
            }

            watchosArm32()
            watchosArm64()
            watchosDeviceArm64()
            watchosSimulatorArm64()
            watchosX64()
        }
    }
}

```

### Core Architecture Module: `multiplatform-settings-coroutines/src/commonMain/kotlin/com/russhwolf/settings/coroutines/ConverterDefaultDispatcher.kt`
```
/*
 * Copyright 2023 Russell Wolf
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.russhwolf.settings.coroutines

import kotlinx.coroutines.CoroutineDispatcher

internal expect val converterDefaultDispatcher: CoroutineDispatcher

```

### Core Architecture Module: `multiplatform-settings-coroutines/src/commonMain/kotlin/com/russhwolf/settings/coroutines/Converters.kt`
```
/*
 * Copyright 2020 Russell Wolf
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.russhwolf.settings.coroutines

import com.russhwolf.settings.ExperimentalSettingsApi
import com.russhwolf.settings.ObservableSettings
import com.russhwolf.settings.Settings
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.withContext

/**
 * Wraps this [Settings] in the [SuspendSettings] interface.
 */
@ExperimentalSettingsApi
public fun Settings.toSuspendSettings(
    dispatcher: CoroutineDispatcher = converterDefaultDispatcher
): SuspendSettings =
    SuspendSettingsWrapper(this, dispatcher)

/**
 * Wraps this [ObservableSettings] in the [FlowSettings] interface.
 */
@ExperimentalSettingsApi
public fun ObservableSettings.toFlowSettings(
    dispatcher: CoroutineDispatcher = converterDefaultDispatcher
): FlowSettings =
    FlowSettingsWrapper(this, dispatcher)

@ExperimentalSettingsApi
private open class SuspendSettingsWrapper(
    private val delegate: Settings,
    private val dispatcher: CoroutineDispatcher
) : SuspendSettings {
    public override suspend fun keys(): Set<String> = withContext(dispatcher) { delegate.keys }
    public override suspend fun size(): Int = withContext(dispatcher) { delegate.size }
    public override suspend fun clear() = withContext(dispatcher) { delegate.clear() }
    public override suspend fun remove(key: String) = withContext(dispatcher) { delegate.remove(key) }
    public override suspend fun hasKey(key: String): Boolean = withContext(dispatcher) { delegate.hasKey(key) }

    public override suspend fun putInt(key: String, value: Int) = withContext(dispatcher) {
        delegate.putInt(key, value)
    }

    public override suspend fun getInt(key: String, defaultValue: Int): Int = withContext(dispatcher) {
        delegate.getInt(key, defaultValue)
    }

    public override suspend fun getIntOrNull(key: String): Int? = withContext(dispatcher) {
        delegate.getIntOrNull(key)
    }

    public override suspend fun putLong(key: String, value: Long) = withContext(dispatcher) {
        delegate.putLong(key, value)
    }

    public override suspend fun getLong(key: String, defaultValue: Long): Long = withContext(dispatcher) {
        delegate.getLong(key, defaultValue)
    }

    public override suspend fun getLongOrNull(key: String): Long? = withContext(dispatcher) {
        delegate.getLongOrNull(key)
    }

    public override suspend fun putString(key: String, value: String) = withContext(dispatcher) {
        delegate.putString(key, value)
    }

    public override suspend fun getString(key: String, defaultValue: String): String = withContext(dispatcher) {
        delegate.getString(key, defaultValue)
    }

    public override suspend fun getStringOrNull(key: String): String? = withContext(dispatcher) {
        delegate.getStringOrNull(key)
    }

    public override suspend fun putFloat(key: String, value: Float) = withContext(dispatcher) {
        delegate.putFloat(key, value)
    }

    public override suspend fun getFloat(key: String, defaultValue: Float): Float = withContext(dispatcher) {
        delegate.getFloat(key, defaultValue)
    }

    public override suspend fun getFloatOrNull(key: String): Float? = withContext(dispatcher) {
        delegate.getFloatOrNull(key)
    }

    public override suspend fun putDouble(key: String, value: Double) = withContext(dispatcher) {
        delegate.putDouble(key, value)
    }

    public override suspend fun getDouble(key: String, defaultValue: Double): Double = withContext(dispatcher) {
        delegate.getDouble(key, defaultValue)
    }

    public override suspend fun getDoubleOrNull(key: String): Double? = withContext(dispatcher) {
        delegate.getDoubleOrNull(key)
    }

    public override suspend fun putBoolean(key: String, value: Boolean) = withContext(dispatcher) {
        delegate.putBoolean(key, value)
    }

    public override suspend fun getBoolean(key: String, defaultValue: Boolean): Boolean = withContext(dispatcher) {
        delegate.getBoolean(key, defaultValue)
    }

    public override suspend fun getBooleanOrNull(key: String): Boolean? = withContext(dispatcher) {
        delegate.getBooleanOrNull(key)
    }
}

@ExperimentalSettingsApi
private class FlowSettingsWrapper(
    private val delegate: ObservableSettings,
    private val dispatcher: CoroutineDispatcher
) : SuspendSettingsWrapper(delegate, dispatcher), FlowSettings {

    public override fun getIntFlow(key: String, defaultValue: Int): Flow<Int> =
        delegate.getIntFlow(key, defaultValue).flowOn(dispatcher)

    public override fun getIntOrNullFlow(key: String): Flow<Int?> =
        delegate.getIntOrNullFlow(key).flowOn(dispatcher)

    public override fun getLongFlow(key: String, defaultValue: Long): Flow<Long> =
        delegate.getLongFlow(key, defaultValue).flowOn(dispatcher)

    public override fun getLongOrNullFlow(key: String): Flow<Long?> =
        delegate.getLongOrNullFlow(key).flowOn(dispatcher)

    public override fun getStringFlow(key: String, defaultValue: String): Flow<String> =
        delegate.getStringFlow(key, defaultValue).flowOn(dispatcher)

    public override fun getStringOrNullFlow(key: String): Flow<String?> =
        delegate.getStringOrNullFlow(key).flowOn(dispatcher)

    public override fun getFloatFlow(key: String, defaultValue: Float): Flow<Float> =
        delegate.getFloatFlow(key, defaultValue).flowOn(dispatcher)

    public override fun getFloatOrNullFlow(key: String): Flow<Float?> =
        delegate.getFloatOrNullFlow(key).flowOn(dispatcher)

    public override fun getDoubleFlow(key: String, defaultValue: Double): Flow<Double> =
        delegate.getDoubleFlow(key, defaultValue).flowOn(dispatcher)

    public override fun getDoubleOrNullFlow(key: String): Flow<Double?> =
        delegate.getDoubleOrNullFlow(key).flowOn(dispatcher)

    public override fun getBooleanFlow(key: String, defaultValue: Boolean): Flow<Boolean> =
        delegate.getBooleanFlow(key, defaultValue).flowOn(dispatcher)

    public override fun getBooleanOrNullFlow(key: String): Flow<Boolean?> =
        delegate.getBooleanOrNullFlow(key).flowOn(dispatcher)

    // Prefer the SuspendSettingsWrapper implementation to the FlowSettings one which calls getXXXFlow().first()

    public override suspend fun getInt(key: String, defaultValue: Int): Int =
        super<SuspendSettingsWrapper>.getInt(key, defaultValue)

    public override suspend fun getIntOrNull(key: String): Int? =
        super<SuspendSettingsWrapper>.getIntOrNull(key)

    public override suspend fun getLong(key: String, defaultValue: Long): Long =
        super<SuspendSettingsWrapper>.getLong(key, defaultValue)

    public override suspend fun getLongOrNull(key: String): Long? =
        super<SuspendSettingsWrapper>.getLongOrNull(key)

    public override suspend fun getString(key: String, defaultValue: String): String =
        super<SuspendSettingsWrapper>.getString(key, defaultValue)

    public override suspend fun getStringOrNull(key: String): String? =
        super<SuspendSettingsWrapper>.getStringOrNull(key)

    public override suspend fun getFloat(key: String, defaultValue: Float): Float =
        super<SuspendSettingsWrapper>.getFloat(key, defaultValue)

    public override suspend fun getFloatOrNull(key: String): Float? =
        super<SuspendSettingsWrapper>.getFloatOrNull(key)

    public override suspend fun getDouble(key: String, defaultValue: Double): Double =
        super<SuspendSettingsWrapper>.getDouble(key, defaultValue)

    public override suspend fun getDoubleOrNull(key: String): Double? =
        super<SuspendSettingsWrapper>.getDoubleOrNull(key)

    public override suspend fun getBoolean(key: String, defaultValue: Boolean): Boolean =
        super<SuspendSettingsWrapper>.getBoolean(key, defaultValue)

    public override suspend fun getBooleanOrNull(key: String): Boolean? =
        super<SuspendSettingsWrapper>.getBooleanOrNull(key)
}

```

### Core Architecture Module: `multiplatform-settings-coroutines/src/commonMain/kotlin/com/russhwolf/settings/coroutines/FlowExtensions.kt`
```
/*
 * Copyright 2019 Russell Wolf
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.russhwolf.settings.coroutines

import com.russhwolf.settings.ExperimentalSettingsApi
import com.russhwolf.settings.ObservableSettings
import com.russhwolf.settings.Settings
import com.russhwolf.settings.SettingsListener
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.distinctUntilChanged

@ExperimentalSettingsApi
private inline fun <T> ObservableSettings.createFlow(
    key: String,
    defaultValue: T,
    crossinline getter: Settings.(String, T) -> T,
    crossinline addListener: ObservableSettings.(String, T, (T) -> Unit) -> SettingsListener
): Flow<T> = callbackFlow {
    send(getter(key, defaultValue))
    val listener = addListener(key, defaultValue) {
        trySend(it)
    }
    awaitClose {
        listener.deactivate()
    }
}.distinctUntilChanged()

@ExperimentalSettingsApi
private inline fun <T> ObservableSettings.createNullableFlow(
    key: String,
    crossinline getter: Settings.(String) -> T?,
    crossinline addListener: ObservableSettings.(String, (T?) -> Unit) -> SettingsListener
): Flow<T?> =
    createFlow<T?>(key, null, { it, _ -> getter(it) }, { it, _, callback -> addListener(it, callback) })

/**
 * Create a new flow, based on observing the given [key] as an `Int`. This flow will immediately emit the current
 * value and then emit any subsequent values when the underlying `Settings` changes. When no value is present,
 * [defaultValue] will be emitted instead.
 */
@ExperimentalSettingsApi
public fun ObservableSettings.getIntFlow(key: String, defaultValue: Int): Flow<Int> =
    createFlow(key, defaultValue, Settings::getInt, ObservableSettings::addIntListener)

/**
 * Create a new flow, based on observing the given [key] as a `Long`. This flow will immediately emit the current
 * value and then emit any subsequent values when the underlying `Settings` changes. When no value is present,
 * [defaultValue] will be emitted instead.
 */
@ExperimentalSettingsApi
public fun ObservableSettings.getLongFlow(key: String, defaultValue: Long): Flow<Long> =
    createFlow(key, defaultValue, Settings::getLong, ObservableSettings::addLongListener)

/**
 * Create a new flow, based on observing the given [key] as a `String`. This flow will immediately emit the current
 * value and then emit any subsequent values when the underlying `Settings` changes. When no value is present,
 * [defaultValue] will be emitted instead.
 */
@ExperimentalSettingsApi
public fun ObservableSettings.getStringFlow(key: String, defaultValue: String): Flow<String> =
    createFlow(key, defaultValue, Settings::getString, ObservableSettings::addStringListener)

/**
 * Create a new flow, based on observing the given [key] as a `Float`. This flow will immediately emit the current
 * value and then emit any subsequent values when the underlying `Settings` changes. When no value is present,
 * [defaultValue] will be emitted instead.
 */
@ExperimentalSettingsApi
public fun ObservableSettings.getFloatFlow(key: String, defaultValue: Float): Flow<Float> =
    createFlow(key, defaultValue, Settings::getFloat, ObservableSettings::addFloatListener)

/**
 * Create a new flow, based on observing the given [key] as a `Double`. This flow will immediately emit the current
 * value and then emit any subsequent values when the underlying `Settings` changes. When no value is present,
 * [defaultValue] will be emitted instead.
 */
@ExperimentalSettingsApi
public fun ObservableSettings.getDoubleFlow(key: String, defaultValue: Double): Flow<Double> =
    createFlow(key, defaultValue, Settings::getDouble, ObservableSettings::addDoubleListener)

/**
 * Create a new flow, based on observing the given [key] as a `Boolean`. This flow will immediately emit the current
 * value and then emit any subsequent values when the underlying `Settings` changes. When no value is present,
 * [defaultValue] will be emitted instead.
 */
@ExperimentalSettingsApi
public fun ObservableSettings.getBooleanFlow(key: String, defaultValue: Boolean): Flow<Boolean> =
    createFlow(key, defaultValue, Settings::getBoolean, ObservableSettings::addBooleanListener)

/**
 * Create a new flow, based on observing the given [key] as a nullable `Int`. This flow will immediately emit the
 * current value and then emit any subsequent values when the underlying `Settings` changes. When no value is present,
 * `null` will be emitted instead.
 */
@ExperimentalSettingsApi
public fun ObservableSettings.getIntOrNullFlow(key: String): Flow<Int?> =
    createNullableFlow(key, Settings::getIntOrNull, ObservableSettings::addIntOrNullListener)

/**
 * Create a new flow, based on observing the given [key] as a nullable `Long`. This flow will immediately emit the
 * current value and then emit any subsequent values when the underlying `Settings` changes. When no value is present,
 * `null` will be emitted instead.
 */
@ExperimentalSettingsApi
public fun ObservableSettings.getLongOrNullFlow(key: String): Flow<Long?> =
    createNullableFlow(key, Settings::getLongOrNull, ObservableSettings::addLongOrNullListener)

/**
 * Create a new flow, based on observing the given [key] as a nullable `String`. This flow will immediately emit the
 * current value and then emit any subsequent values when the underlying `Settings` changes. When no value is present,
 * `null` will be emitted instead.
 */
@ExperimentalSettingsApi
public fun ObservableSettings.getStringOrNullFlow(key: String): Flow<String?> =
    createNullableFlow(key, Settings::getStringOrNull, ObservableSettings::addStringOrNullListener)

/**
 * Create a new flow, based on observing the given [key] as a nullable `Float`. This flow will immediately emit the
 * current value and then emit any subsequent values when the underlying `Settings` changes. When no value is present,
 * `null` will be emitted instead.
 */
@ExperimentalSettingsApi
public fun ObservableSettings.getFloatOrNullFlow(key: String): Flow<Float?> =
    createNullableFlow(key, Settings::getFloatOrNull, ObservableSettings::addFloatOrNullListener)

/**
 * Create a new flow, based on observing the given [key] as a nullable `Double`. This flow will immediately emit the
 * current value and then emit any subsequent values when the underlying `Settings` changes. When no value is present,
 * `null` will be emitted instead.
 */
@ExperimentalSettingsApi
public fun ObservableSettings.getDoubleOrNullFlow(key: String): Flow<Double?> =
    createNullableFlow(key, Settings::getDoubleOrNull, ObservableSettings::addDoubleOrNullListener)

/**
 * Create a new flow, based on observing the given [key] as a nullable `Boolean`. This flow will immediately emit the
 * current value and then emit any subsequent values when the underlying `Settings` changes. When no value is present,
 * `null` will be emitted instead.
 */
@ExperimentalSettingsApi
public fun ObservableSettings.getBooleanOrNullFlow(key: String): Flow<Boolean?> =
    createNullableFlow(key, Settings::getBooleanOrNull, ObservableSettings::addBooleanOrNullListener)


```

### Core Architecture Module: `multiplatform-settings-coroutines/src/commonMain/kotlin/com/russhwolf/settings/coroutines/FlowSettings.kt`
```
/*
 * Copyright 2020 Russell Wolf
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.russhwolf.settings.coroutines

import com.russhwolf.settings.ExperimentalSettingsApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first

/**
 * `FlowSettings` augments [SuspendSettings] with [Flow]-based APIs.
 */
@ExperimentalSettingsApi
public interface FlowSettings : SuspendSettings {
    // There's a bunch of explicit overrides in here that look unnecessary but they make the default method order
    //  more consistent between SuspendSettings and FlowSettings when creating a new implementation

    public companion object;

    public override suspend fun keys(): Set<String>
    public override suspend fun size(): Int
    public override suspend fun clear()
    public override suspend fun remove(key: String)
    public override suspend fun hasKey(key: String): Boolean

    public override suspend fun putInt(key: String, value: Int)

    /**
     * Returns a [Flow] containing the `Int` value stored at [key], or [defaultValue] if no value was stored. If a value
     * of a different type is stored at `key`, the behavior is not defined.
     */
    public fun getIntFlow(key: String, defaultValue: Int): Flow<Int>
    public override suspend fun getInt(key: String, defaultValue: Int): Int = getIntFlow(key, defaultValue).first()

    /**
     * Returns a [Flow] containing the `Int` value stored at [key], or `null` if no value was stored. If a value of a
     * different type was stored at `key`, the behavior is not defined.
     */
    public fun getIntOrNullFlow(key: String): Flow<Int?>
    public override suspend fun getIntOrNull(key: String): Int? = getIntOrNullFlow(key).first()

    public override suspend fun putLong(key: String, value: Long)

    /**
     * Returns a [Flow] containing the `Long` value stored at [key], or [defaultValue] if no value was stored. If a
     * value of a different type is stored at `key`, the behavior is not defined.
     */
    public fun getLongFlow(key: String, defaultValue: Long): Flow<Long>
    public override suspend fun getLong(key: String, defaultValue: Long): Long = getLongFlow(key, defaultValue).first()

    /**
     * Returns a [Flow] containing the `Long` value stored at [key], or `null` if no value was stored. If a value of a
     * different type was stored at `key`, the behavior is not defined.
     */
    public fun getLongOrNullFlow(key: String): Flow<Long?>
    public override suspend fun getLongOrNull(key: String): Long? = getLongOrNullFlow(key).first()

    public override suspend fun putString(key: String, value: String)

    /**
     * Returns a [Flow] containing the `String` value stored at [key], or [defaultValue] if no value was stored. If a
     * value of a different type is stored at `key`, the behavior is not defined.
     */
    public fun getStringFlow(key: String, defaultValue: String): Flow<String>
    public override suspend fun getString(key: String, defaultValue: String): String =
        getStringFlow(key, defaultValue).first()

    /**
     * Returns a [Flow] containing the `String` value stored at [key], or `null` if no value was stored. If a value of a
     * different type was stored at `key`, the behavior is not defined.
     */
    public fun getStringOrNullFlow(key: String): Flow<String?>
    public override suspend fun getStringOrNull(key: String): String? = getStringOrNullFlow(key).first()

    public override suspend fun putFloat(key: String, value: Float)

    /**
     * Returns a [Flow] containing the `Float` value stored at [key], or [defaultValue] if no value was stored. If a
     * value of a different type is stored at `key`, the behavior is not defined.
     */
    public fun getFloatFlow(key: String, defaultValue: Float): Flow<Float>
    public override suspend fun getFloat(key: String, defaultValue: Float): Float =
        getFloatFlow(key, defaultValue).first()

    /**
     * Returns a [Flow] containing the `Float` value stored at [key], or `null` if no value was stored. If a value of a
     * different type was stored at `key`, the behavior is not defined.
     */
    public fun getFloatOrNullFlow(key: String): Flow<Float?>
    public override suspend fun getFloatOrNull(key: String): Float? = getFloatOrNullFlow(key).first()

    public override suspend fun putDouble(key: String, value: Double)

    /**
     * Returns a [Flow] containing the `Double` value stored at [key], or [defaultValue] if no value was stored. If a
     * value of a different type is stored at `key`, the behavior is not defined.
     */
    public fun getDoubleFlow(key: String, defaultValue: Double): Flow<Double>
    public override suspend fun getDouble(key: String, defaultValue: Double): Double =
        getDoubleFlow(key, defaultValue).first()

    /**
     * Returns a [Flow] containing the `Double` value stored at [key], or `null` if no value was stored. If a value of a
     * different type was stored at `key`, the behavior is not defined.
     */
    public fun getDoubleOrNullFlow(key: String): Flow<Double?>
    public override suspend fun getDoubleOrNull(key: String): Double? = getDoubleOrNullFlow(key).first()

    public override suspend fun putBoolean(key: String, value: Boolean)

    /**
     * Returns a [Flow] containing the `Boolean` value stored at [key], or [defaultValue] if no value was stored. If a
     * value of a different type is stored at `key`, the behavior is not defined.
     */
    public fun getBooleanFlow(key: String, defaultValue: Boolean): Flow<Boolean>
    public override suspend fun getBoolean(key: String, defaultValue: Boolean): Boolean =
        getBooleanFlow(key, defaultValue).first()

    /**
     * Returns a [Flow] containing the `Boolean` value stored at [key], or `null` if no value was stored. If a value of
     * a different type was stored at `key`, the behavior is not defined.
     */
    public fun getBooleanOrNullFlow(key: String): Flow<Boolean?>
    public override suspend fun getBooleanOrNull(key: String): Boolean? = getBooleanOrNullFlow(key).first()
}

```

### Core Architecture Module: `multiplatform-settings-coroutines/src/commonMain/kotlin/com/russhwolf/settings/coroutines/SuspendSettings.kt`
```
/*
 * Copyright 2020 Russell Wolf
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.russhwolf.settings.coroutines

import com.russhwolf.settings.ExperimentalSettingsApi
import com.russhwolf.settings.Settings

/**
 * A collection of storage-backed key-value data. It differs from [Settings] in that all functions use a suspending API.
 *
 * This interface allows storage of values with the [Int], [Long], [String], [Float], [Double], or [Boolean] types,
 * using a [String] reference as a key. Values will be persisted across app launches.
 */
// TODO strictly speaking this interface doesn't NEED to live in a module that pulls in the kotlinx dependency...
@ExperimentalSettingsApi
public interface SuspendSettings {

    public companion object;

    /**
     * Returns a `Set` containing all the keys present in this [SuspendSettings].
     */
    public suspend fun keys(): Set<String>

    /**
     * Returns the number of key-value pairs present in this [SuspendSettings].
     */
    public suspend fun size(): Int

    /**
     * Clears all values stored in this [SuspendSettings] instance.
     */
    public suspend fun clear()

    /**
     * Removes the value stored at [key].
     */
    public suspend fun remove(key: String)

    /**
     * Returns `true` if there is a value stored at [key], or `false` otherwise.
     */
    public suspend fun hasKey(key: String): Boolean

    /**
     * Stores the `Int` [value] at [key].
     */
    public suspend fun putInt(key: String, value: Int)

    /**
     * Returns the `Int` value stored at [key], or [defaultValue] if no value was stored. If a value of a different
     * type was stored at `key`, the behavior is not defined.
     */
    public suspend fun getInt(key: String, defaultValue: Int): Int

    /**
     * Returns the `Int` value stored at [key], or `null` if no value was stored. If a value of a different type was
     * stored at `key`, the behavior is not defined.
     */
    public suspend fun getIntOrNull(key: String): Int?

    /**
     * Stores the `Long` [value] at [key].
     */
    public suspend fun putLong(key: String, value: Long)

    /**
     * Returns the `Long` value stored at [key], or [defaultValue] if no value was stored. If a value of a different
     * type was stored at `key`, the behavior is not defined.
     */
    public suspend fun getLong(key: String, defaultValue: Long): Long

    /**
     * Returns the `Long` value stored at [key], or `null` if no value was stored. If a value of a different type was
     * stored at `key`, the behavior is not defined.
     */
    public suspend fun getLongOrNull(key: String): Long?

    /**
     * Stores the `String` [value] at [key].
     */
    public suspend fun putString(key: String, value: String)

    /**
     * Returns the `String` value stored at [key], or [defaultValue] if no value was stored. If a value of a different
     * type was stored at `key`, the behavior is not defined.
     */
    public suspend fun getString(key: String, defaultValue: String): String

    /**
     * Returns the `String` value stored at [key], or `null` if no value was stored. If a value of a different type was
     * stored at `key`, the behavior is not defined.
     */
    public suspend fun getStringOrNull(key: String): String?

    /**
     * Stores the `Float` [value] at [key].
     */
    public suspend fun putFloat(key: String, value: Float)

    /**
     * Returns the `Float` value stored at [key], or [defaultValue] if no value was stored. If a value of a different
     * type was stored at `key`, the behavior is not defined.
     */
    public suspend fun getFloat(key: String, defaultValue: Float): Float

    /**
     * Returns the `Float` value stored at [key], or `null` if no value was stored. If a value of a different type was
     * stored at `key`, the behavior is not defined.
     */
    public suspend fun getFloatOrNull(key: String): Float?

    /**
     * Stores the `Double` [value] at [key].
     */
    public suspend fun putDouble(key: String, value: Double)

    /**
     * Returns the `Double` value stored at [key], or [defaultValue] if no value was stored. If a value of a different
     * type was stored at `key`, the behavior is not defined.
     */
    public suspend fun getDouble(key: String, defaultValue: Double): Double

    /**
     * Returns the `Double` value stored at [key], or `null` if no value was stored. If a value of a different type was
     * stored at `key`, the behavior is not defined.
     */
    public suspend fun getDoubleOrNull(key: String): Double?

    /**
     * Stores the `Boolean` [value] at [key].
     */
    public suspend fun putBoolean(key: String, value: Boolean)

    /**
     * Returns the `Boolean` value stored at [key], or [defaultValue] if no value was stored. If a value of a different
     * type was stored at `key`, the behavior is not defined.
     */
    public suspend fun getBoolean(key: String, defaultValue: Boolean): Boolean

    /**
     * Returns the `Boolean` value stored at [key], or `null` if no value was stored. If a value of a different type was
     * stored at `key`, the behavior is not defined.
     */
    public suspend fun getBooleanOrNull(key: String): Boolean?
}


```

### Core Architecture Module: `multiplatform-settings-coroutines/src/jsWasmCommonMain/kotlin/com/russhwolf/settings/coroutines/ConverterDefaultDispatcher.kt`
```
/*
 * Copyright 2023 Russell Wolf
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.russhwolf.settings.coroutines

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers

internal actual val converterDefaultDispatcher: CoroutineDispatcher = Dispatchers.Default

```

### Core Architecture Module: `multiplatform-settings-coroutines/src/multithreadedMain/kotlin/com/russhwolf/settings/coroutines/BlockingConverters.kt`
```
/*
 * Copyright 2020 Russell Wolf
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.russhwolf.settings.coroutines

import com.russhwolf.settings.ExperimentalSettingsApi
import com.russhwolf.settings.ObservableSettings
import com.russhwolf.settings.Settings
import com.russhwolf.settings.SettingsListener
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.DelicateCoroutinesApi
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.runBlocking

/**
 * Wraps this [SuspendSettings] in the [Settings] interface.
 *
 * Note that this occurs via use of [runBlocking]. Make sure this is what you want! You should only interact with the
 * instance returned by this function from a thread that can be blocked without impacting the rest of your application.
 */
@ExperimentalSettingsApi
public fun SuspendSettings.toBlockingSettings(): Settings = BlockingSuspendSettings(this)

@ExperimentalSettingsApi
private open class BlockingSuspendSettings(private val delegate: SuspendSettings) : Settings {

    public final override val keys: Set<String> get() = runBlocking { delegate.keys() }
    public final override val size: Int get() = runBlocking { delegate.size() }
    public final override fun clear() = runBlocking { delegate.clear() }
    public final override fun remove(key: String) = runBlocking { delegate.remove(key) }
    public final override fun hasKey(key: String): Boolean = runBlocking { delegate.hasKey(key) }

    public final override fun putInt(key: String, value: Int) = runBlocking { delegate.putInt(key, value) }
    public final override fun getInt(key: String, defaultValue: Int): Int =
        runBlocking { delegate.getInt(key, defaultValue) }

    public final override fun getIntOrNull(key: String): Int? = runBlocking { delegate.getIntOrNull(key) }

    public final override fun putLong(key: String, value: Long) = runBlocking { delegate.putLong(key, value) }
    public final override fun getLong(key: String, defaultValue: Long): Long =
        runBlocking { delegate.getLong(key, defaultValue) }

    public final override fun getLongOrNull(key: String): Long? = runBlocking { delegate.getLongOrNull(key) }

    public final override fun putString(key: String, value: String) = runBlocking { delegate.putString(key, value) }
    public final override fun getString(key: String, defaultValue: String): String =
        runBlocking { delegate.getString(key, defaultValue) }

    public final override fun getStringOrNull(key: String): String? = runBlocking { delegate.getStringOrNull(key) }

    public final override fun putFloat(key: String, value: Float) = runBlocking { delegate.putFloat(key, value) }
    public final override fun getFloat(key: String, defaultValue: Float): Float =
        runBlocking { delegate.getFloat(key, defaultValue) }

    public final override fun getFloatOrNull(key: String): Float? = runBlocking { delegate.getFloatOrNull(key) }

    public final override fun putDouble(key: String, value: Double) = runBlocking { delegate.putDouble(key, value) }
    public final override fun getDouble(key: String, defaultValue: Double): Double =
        runBlocking { delegate.getDouble(key, defaultValue) }

    public final override fun getDoubleOrNull(key: String): Double? = runBlocking { delegate.getDoubleOrNull(key) }

    public final override fun putBoolean(key: String, value: Boolean) = runBlocking { delegate.putBoolean(key, value) }
    public final override fun getBoolean(key: String, defaultValue: Boolean): Boolean =
        runBlocking { delegate.getBoolean(key, defaultValue) }

    public final override fun getBooleanOrNull(key: String): Boolean? = runBlocking { delegate.getBooleanOrNull(key) }
}

/**
 * Wraps this [FlowSettings] in the [ObservableSettings] interface.
 *
 * Note that listeners are created by launching `Flow`s in [GlobalScope] by default, but you may also supply your own
 * scope which will be used instead.
 */
@ExperimentalSettingsApi
@OptIn(DelicateCoroutinesApi::class)
public fun FlowSettings.toBlockingObservableSettings(scope: CoroutineScope = GlobalScope): ObservableSettings =
    BlockingObservableSettings(this, scope)

@ExperimentalSettingsApi
private class BlockingObservableSettings(
    private val delegate: FlowSettings,
    private val scope: CoroutineScope,
) : BlockingSuspendSettings(delegate), ObservableSettings {

    private class Listener<T>(flow: Flow<T>, scope: CoroutineScope, callback: (T) -> Unit) : SettingsListener {
        // Drop 1, because `FlowSettings` emits the current value immediately, but `ObservableSettings` waits for a new
        // value before the listener is called.
        private val job = flow.drop(1).onEach { callback(it) }.launchIn(scope)

        override fun deactivate() {
            job.cancel()
        }
    }

    override fun addIntListener(key: String, defaultValue: Int, callback: (Int) -> Unit): SettingsListener =
        Listener(delegate.getIntFlow(key, defaultValue), scope, callback)

    override fun addLongListener(key: String, defaultValue: Long, callback: (Long) -> Unit): SettingsListener =
        Listener(delegate.getLongFlow(key, defaultValue), scope, callback)

    override fun addStringListener(key: String, defaultValue: String, callback: (String) -> Unit): SettingsListener =
        Listener(delegate.getStringFlow(key, defaultValue), scope, callback)

    override fun addFloatListener(key: String, defaultValue: Float, callback: (Float) -> Unit): SettingsListener =
        Listener(delegate.getFloatFlow(key, defaultValue), scope, callback)

    override fun addDoubleListener(key: String, defaultValue: Double, callback: (Double) -> Unit): SettingsListener =
        Listener(delegate.getDoubleFlow(key, defaultValue), scope, callback)

    override fun addBooleanListener(key: String, defaultValue: Boolean, callback: (Boolean) -> Unit): SettingsListener =
        Listener(delegate.getBooleanFlow(key, defaultValue), scope, callback)

    override fun addIntOrNullListener(key: String, callback: (Int?) -> Unit): SettingsListener =
        Listener(delegate.getIntOrNullFlow(key), scope, callback)

    override fun addLongOrNullListener(key: String, callback: (Long?) -> Unit): SettingsListener =
        Listener(delegate.getLongOrNullFlow(key), scope, callback)

    override fun addStringOrNullListener(key: String, callback: (String?) -> Unit): SettingsListener =
        Listener(delegate.getStringOrNullFlow(key), scope, callback)

    override fun addFloatOrNullListener(key: String, callback: (Float?) -> Unit): SettingsListener =
        Listener(delegate.getFloatOrNullFlow(key), scope, callback)

    override fun addDoubleOrNullListener(key: String, callback: (Double?) -> Unit): SettingsListener =
        Listener(delegate.getDoubleOrNullFlow(key), scope, callback)

    override fun addBooleanOrNullListener(key: String, callback: (Boolean?) -> Unit): SettingsListener =
        Listener(delegate.getBooleanOrNullFlow(key), scope, callback)

}

```

### Core Architecture Module: `multiplatform-settings-coroutines/src/multithreadedMain/kotlin/com/russhwolf/settings/coroutines/ConverterDefaultDispatcher.kt`
```
/*
 * Copyright 2023 Russell Wolf
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.russhwolf.settings.coroutines

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.IO

internal actual val converterDefaultDispatcher = Dispatchers.IO

```

### Core Architecture Module: `multiplatform-settings-datastore/src/commonMain/kotlin/com/russhwolf/settings/datastore/DataStoreSettings.kt`
```
/*
 * Copyright 2020 Russell Wolf
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.russhwolf.settings.datastore

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.doublePreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import com.russhwolf.settings.ExperimentalSettingsApi
import com.russhwolf.settings.ExperimentalSettingsImplementation
import com.russhwolf.settings.coroutines.FlowSettings
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

/**
 * `DataStoreSettings` implements [FlowSettings] using the [DataStore] API.
 */
@ExperimentalSettingsImplementation
@ExperimentalSettingsApi
public class DataStoreSettings(private val datastore: DataStore<Preferences>) : FlowSettings {
    public override suspend fun keys(): Set<String> = datastore.data.first().asMap().keys.map { it.name }.toSet()
    public override suspend fun size(): Int = datastore.data.first().asMap().size
    public override suspend fun clear(): Unit = keys().forEach { remove(it) }

    public override suspend fun remove(key: String) {
        datastore.edit { it.remove(stringSetPreferencesKey(key)) }
    }

    public override suspend fun hasKey(key: String): Boolean =
        datastore.data.first().contains(stringSetPreferencesKey(key))

    public override suspend fun putInt(key: String, value: Int) {
        datastore.edit { it[intPreferencesKey(key)] = value }
    }

    public override fun getIntFlow(key: String, defaultValue: Int): Flow<Int> =
        getValue { it[intPreferencesKey(key)] ?: defaultValue }

    public override fun getIntOrNullFlow(key: String): Flow<Int?> =
        getValue { it[intPreferencesKey(key)] }

    public override suspend fun putLong(key: String, value: Long) {
        datastore.edit { it[longPreferencesKey(key)] = value }
    }

    public override fun getLongFlow(key: String, defaultValue: Long): Flow<Long> =
        getValue { it[longPreferencesKey(key)] ?: defaultValue }

    public override fun getLongOrNullFlow(key: String): Flow<Long?> =
        getValue { it[longPreferencesKey(key)] }

    public override suspend fun putString(key: String, value: String) {
        datastore.edit { it[stringPreferencesKey(key)] = value }
    }

    public override fun getStringFlow(key: String, defaultValue: String): Flow<String> =
        getValue { it[stringPreferencesKey(key)] ?: defaultValue }

    public override fun getStringOrNullFlow(key: String): Flow<String?> =
        getValue { it[stringPreferencesKey(key)] }

    public override suspend fun putFloat(key: String, value: Float) {
        datastore.edit { it[floatPreferencesKey(key)] = value }
    }

    public override fun getFloatFlow(key: String, defaultValue: Float): Flow<Float> =
        getValue { it[floatPreferencesKey(key)] ?: defaultValue }

    public override fun getFloatOrNullFlow(key: String): Flow<Float?> =
        getValue { it[floatPreferencesKey(key)] }

    public override suspend fun putDouble(key: String, value: Double) {
        datastore.edit { it[doublePreferencesKey(key)] = value }
    }

    public override fun getDoubleFlow(key: String, defaultValue: Double): Flow<Double> =
        getValue { it[doublePreferencesKey(key)] ?: defaultValue }

    public override fun getDoubleOrNullFlow(key: String): Flow<Double?> =
        getValue { it[doublePreferencesKey(key)] }

    public override suspend fun putBoolean(key: String, value: Boolean) {
        datastore.edit { it[booleanPreferencesKey(key)] = value }
    }

    public override fun getBooleanFlow(key: String, defaultValue: Boolean): Flow<Boolean> =
        getValue { it[booleanPreferencesKey(key)] ?: defaultValue }

    public override fun getBooleanOrNullFlow(key: String): Flow<Boolean?> =
        getValue { it[booleanPreferencesKey(key)] }

    private inline fun <T> getValue(crossinline getValue: (Preferences) -> T): Flow<T> =
        datastore.data.map { getValue(it) }.distinctUntilChanged()
}

```

### Core Architecture Module: `multiplatform-settings-make-observable/src/commonMain/kotlin/MakeObservableSettings.kt`
```
/*
 * Copyright 2024 Russell Wolf
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.russhwolf.settings.observable

import com.russhwolf.settings.ExperimentalSettingsApi
import com.russhwolf.settings.ObservableSettings
import com.russhwolf.settings.Settings
import com.russhwolf.settings.SettingsListener
import com.russhwolf.settings.get
import kotlin.jvm.JvmInline

/**
 * Returns an [ObservableSettings] instance based on this [Settings].
 *
 * WARNING: When this function is used, changes to the underlying storage will not trigger callbacks unless they are
 * made through the same `ObservableSettings` instance being observed.
 */
@ExperimentalSettingsApi
public fun Settings.makeObservable(): ObservableSettings = MakeObservableSettings(this)

/**
 * A wrapper around provided [Settings] instance. It only ensures the callback if the
 * settings are modified through the member functions of [MakeObservableSettings].
 */
private class MakeObservableSettings(
    private val delegate: Settings,
) : Settings by delegate, ObservableSettings {

    private val listenerMap = mutableMapOf<String, MutableSet<() -> Unit>>()

    override fun remove(key: String) {
        delegate.remove(key)
        invokeListeners(key)
    }

    override fun clear() {
        delegate.clear()
        invokeAllListeners()
    }

    override fun putInt(key: String, value: Int) {
        delegate.putInt(key, value)
        invokeListeners(key)
    }

    override fun putLong(key: String, value: Long) {
        delegate.putLong(key, value)
        invokeListeners(key)
    }

    override fun putString(key: String, value: String) {
        delegate.putString(key, value)
        invokeListeners(key)
    }

    override fun putFloat(key: String, value: Float) {
        delegate.putFloat(key, value)
        invokeListeners(key)
    }

    override fun putDouble(key: String, value: Double) {
        delegate.putDouble(key, value)
        invokeListeners(key)
    }

    override fun putBoolean(key: String, value: Boolean) {
        delegate.putBoolean(key, value)
        invokeListeners(key)
    }

    override fun addIntListener(
        key: String,
        defaultValue: Int,
        callback: (Int) -> Unit
    ): SettingsListener = addListener<Int>(key) {
        callback(getInt(key, defaultValue))
    }


    override fun addLongListener(
        key: String,
        defaultValue: Long,
        callback: (Long) -> Unit
    ): SettingsListener = addListener<Long>(key) {
        callback(getLong(key, defaultValue))
    }

    override fun addStringListener(
        key: String,
        defaultValue: String,
        callback: (String) -> Unit
    ): SettingsListener = addListener<String>(key) {
        callback(getString(key, defaultValue))
    }

    override fun addFloatListener(
        key: String,
        defaultValue: Float,
        callback: (Float) -> Unit
    ): SettingsListener = addListener<Float>(key) {
        callback(getFloat(key, defaultValue))
    }

    override fun addDoubleListener(
        key: String,
        defaultValue: Double,
        callback: (Double) -> Unit
    ): SettingsListener = addListener<Double>(key) {
        callback(getDouble(key, defaultValue))
    }

    override fun addBooleanListener(
        key: String,
        defaultValue: Boolean,
        callback: (Boolean) -> Unit
    ): SettingsListener = addListener<Boolean>(key) {
        callback(getBoolean(key, defaultValue))
    }

    override fun addIntOrNullListener(
        key: String, callback: (Int?) -> Unit
    ): SettingsListener = addListener<Int>(key) {
        callback(getIntOrNull(key))
    }

    override fun addLongOrNullListener(
        key: String,
        callback: (Long?) -> Unit
    ): SettingsListener = addListener<Long>(key) {
        callback(getLongOrNull(key))
    }

    override fun addStringOrNullListener(
        key: String,
        callback: (String?) -> Unit
    ): SettingsListener = addListener<String>(key) {
        callback(getStringOrNull(key))
    }

    override fun addFloatOrNullListener(
        key: String,
        callback: (Float?) -> Unit
    ): SettingsListener = addListener<Float>(key) {
        callback(getFloatOrNull(key))
    }

    override fun addDoubleOrNullListener(
        key: String,
        callback: (Double?) -> Unit
    ): SettingsListener = addListener<Double>(key) {
        callback(getDoubleOrNull(key))
    }

    override fun addBooleanOrNullListener(
        key: String,
        callback: (Boolean?) -> Unit
    ): SettingsListener = addListener<Boolean>(key) {
        callback(getBooleanOrNull(key))
    }

    private inline fun <reified T> addListener(
        key: String,
        noinline callback: () -> Unit
    ): SettingsListener {
        var prev: T? = delegate[key]

        val listener = {
            val current: T? = delegate[key]
            if (prev != current) {
                callback()
                prev = current
            }
        }

        val listeners = listenerMap.getOrPut(key) { mutableSetOf() }
        listeners += listener

        return Listener {
            removeListener(key, listener)
        }
    }

    private fun removeListener(key: String, listener: () -> Unit) {
        listenerMap[key]?.also {
            it -= listener
        }
    }

    private fun invokeListeners(key: String) {
        listenerMap[key]?.forEach { callback ->
            callback()
        }
    }

    private fun invokeAllListeners() {
        listenerMap.forEach { entry ->
            entry.value.forEach { callback ->
                callback()
            }
        }
    }

}


/**
 *  A handle to a listener instance returned by one of the addListener methods of [MakeObservableSettings], so it can be
 *  deactivated as needed.
 */
@JvmInline
private value class Listener(
    private val removeListener: () -> Unit
) : SettingsListener {

    override fun deactivate(): Unit = removeListener()
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #244** (2026-04-08): **`TypeCastException` calling `KeychainSettings.keys` (or any method that uses it, such as `size`)**
  *Symptoms*: My code calls `keys` on `KeychainSettings`. I get this error (note here the call was indirect via the `size` method, but same issue happens when calling `keys` directly):  ``` Uncaught Kotlin exception: kotlin.TypeCastException: class __NSCFData cannot be cast to class platform.Foundation.NSString     at 0   MyApp.debug.dylib                0x10c09501b        kfun:kotlin.Throwable#<init>(kotlin.String?){} + 99      at 1   MyApp.debug.dylib                0x10c08eccf        kfun:kotlin.Exception#<init>(kotlin.String?){} + 95      at 2   MyApp.debug.dylib                0x10c08ee9f        kfun:kotlin.RuntimeException#<init>(kotlin.String?){} + 95      at 3   MyApp.debug.dylib                0x10c08f73f        kfun:kotlin.ClassCastException#<init>(kotlin.String?){} + 95      at 4   MyApp.debug.dylib                0x10c08f7b3        kfun:kotlin.TypeCastException#<init>(kotlin.String?){} + 95      at 5   MyApp.debug.dylib                0x10c0c67e7        ThrowTypeCastException + 539      at 6   MyApp.debug.dylib                0x10c659b0b        kfun:com.russhwolf.settings.KeychainSettings#<get-keys>(){}kotlin.collections.Set<kotlin.String> + 2723      at 7   MyApp.debug.dylib                0x10c65a123        kfun:com.russhwolf.settings.KeychainSettings#<get-size>(){}kotlin.Int + 115      at 8   MyApp.debug.dylib                0x10c664123        kfun:com.russhwolf.settings.Settings#<get-size>(){}kotlin.Int-trampoline + 91      at 9   MyApp.debug.dylib                0x10c06414
  **Post-Mortem & Fix Analysis**:
  > Seems like this is the same or similar issue as https://github.com/russhwolf/multiplatform-settings/issues/243.
  > Closing as duplicate

- **Issue #242** (2026-02-27): **Add some special handling, such as proxy**
  *Symptoms*: import com.russhwolf.settings.Settings import com.russhwolf.settings.minusAssign import kotlin.reflect.KClass import kotlin.reflect.KProperty  /** Equivalent to [Settings.getString] */ inline operator fun <reified T: Enum<T>> Settings.get(key: String, defaultValue: T): T = runCatching { enumValueOf<T>(getString(key, defaultValue.name)) }.getOrDefault(defaultValue)  /** Equivalent to [Settings.putString] */ inline operator fun <T: Enum<T>> Settings.set(key: String, value: T): Unit = putString(key, value.name)  open class SettingsBindingNullable<T: Any>(val returnType: KClass<T>,val settings: Settings,val defaultValue: T?) {     @Suppress("UNCHECKED_CAST")     open operator fun getValue(thisObj: Any?, property: KProperty<*>): T? = when (returnType) {         Int::class -> settings.getIntOrNull(property.name) as T?         Long::class -> settings.getLongOrNull(property.name) as T?         String::class -> settings.getStringOrNull(property.name) as T?         Float::class -> settings.getFloatOrNull(property.name) as T?         Double::class -> settings.getDoubleOrNull(property.name) as T?         Boolean::class -> settings.getBooleanOrNull(property.name) as T?         else -> throw IllegalArgumentException("Invalid type!")     } ?: defaultValue      operator fun setValue(thisObj: Any?, property: KProperty<*>, value: T?): Unit = if (value == null) {         settings -= property.name     } else when (returnType) {         Int::class -> settings.putInt(property.name, value as Int)  
  **Post-Mortem & Fix Analysis**:
  > Similar to settings.type(), but it automatically matches the type, and the key can also be customized

- **Issue #241** (2025-11-27): **iOS crash: MakeObservableSettings.invokeListeners#internal**
  *Symptoms*: Hi, we are experiencing a very rare crash on iOS when using [Store5](https://github.com/MobileNativeFoundation/Store) (KMP) with `ObservableSettings` as the [SourceOfTruth](https://store.mobilenativefoundation.org/docs/concepts/store5/source-of-truth). The crash occurs only on iOS, never on Android, and happens in a coroutine.  Stack trace: ``` Crashed: com.apple.root.default-qos EXC_BAD_ACCESS KERN_INVALID_ADDRESS 0x0000000000000000 0  kotlinBridge                   0x588308 kfun:com.russhwolf.settings.observable.MakeObservableSettings.invokeListeners#internal + 972 1  kotlinBridge                   0x72cc88 kfun:com.due.verification.data.VerificationRepositoryImpl.VerificationRepositoryImpl$3.invoke#internal + 492 2  kotlinBridge                   0x36b8d0 kfun:org.mobilenativefoundation.store.store5.impl.PersistentSourceOfTruth#write#suspend + 196 3  kotlinBridge                   0x3755a4 kfun:org.mobilenativefoundation.store.store5.impl.SourceOfTruthWithBarrier.$writeCOROUTINE$1.invokeSuspend#internal + 1348 4  kotlinBridge                   0x375f00 kfun:org.mobilenativefoundation.store.store5.impl.SourceOfTruthWithBarrier#write#suspend + 252 5  kotlinBridge                   0x35eeac kfun:org.mobilenativefoundation.store.store5.impl.FetcherController.FetcherController$2$invoke$4.$invokeCOROUTINE$0.invokeSuspend#internal + 592 ```  The crash appears to originate from `MakeObservableSettings.invokeListeners`, which is called when the `SourceOfTruth.writer` updates the st
  **Post-Mortem & Fix Analysis**:
  > I tested different implementation thoroughly and can see that the crash may happen only if using `KeychainSettings` with `makeObservable()` extension which is not thread safe.  `NSUserDefaultsSettings` should work fine as it uses `NSNotificationCenter` observer for updates.  I believe wrapping it with `toFlowSettings` and providing some `newSingleThreadContext` should fix the issue.   
  > Stumbled on the same issue myself. Passing a `newSingleThreadContext` dispatcher to `toFlowSettings` seems to fix the issue but I wonder if `MakeObservableSettings` should be made thread safe, have an alternative `makeObservableThreadSafe()` or at least update the docs mentioning `MakeObservableSettings` is not thread safe. @russhwolf ?

- **Issue #240** (2025-11-07): **Nested List Deserialization Issue**
  *Symptoms*: `settings.encodeValue(         StoredCurrentOrder::class.serializer(),         CURRENT_ORDER,         StoredCurrentOrder(             menuId,             order         )     )      val storedOrder: StoredCurrentOrder? =         settings.decodeValueOrNull(             StoredCurrentOrder::class.serializer(),             CURRENT_ORDER         )      platformLog(storedOrder.toString())`  I'm storing some data classes, one of which contains a list. I see that it's stored properly in my prefs file, but when I decodeValueOrNull, the list is empty .. any ideas?
  **Post-Mortem & Fix Analysis**:
  > Oh, it overwrites with property defaults .. so my workaround is not to set defaults, and that works.

- **Issue #239** (2025-09-18): **[WasmJS] getStringOrNullFlow emits the key?!**
  *Symptoms*: On WasmJs (couldn't reproduce on Android):  ```       settings.getStringOrNullFlow("blah")         .collect {            println("blah = $it")         } ```  This prints   ``` blah = null blah = blah ```  meaning, it emits the setting key, as its value. WTF?

- **Issue #238** (2026-03-04): **[JS, WasmJS] no ObservableSettings/FlowSettings?**
  *Symptoms*: I'm confused... It seems that on the JS, WasmJS platform there is no way to create ObservableSettings/FlowSettings since StorageSettings implements only the basic Settings interface? 
  **Post-Mortem & Fix Analysis**:
  > This is because there is no native observability in JS that delivers updates within the same window/process. You can use the `make-observable` module to call `storageSettings.makeObservable()` instead. See [here](https://github.com/russhwolf/multiplatform-settings?tab=readme-ov-file#make-observable-module)

- **Issue #231** (2025-06-07): **`serializedValue` can't store some data was tagged with @Polymorphic**
  *Symptoms*: I used a class with:  ```kotlin @Serializable @Polymorphic sealed interface BypassSetting {     @Serializable     @SerialName("none")     data object None : BypassSetting      @Serializable     @SerialName("sni-replace")     data class SNIReplace(         val url: String = "https://1.0.0.1/dns-query",         val fallback: Map<String, List<String>> = mapOf(             "app-api.pixiv.net" to listOf("210.140.139.155"),             "oauth.secure.pixiv.net" to listOf("210.140.139.155"),             "i.pximg.net" to listOf("210.140.139.133"),             "s.pximg.net" to listOf("210.140.139.133"),         ),         val nonStrictSSL: Boolean = true,         val dohTimeout: Int = 5,     ) : BypassSetting      @Serializable     @SerialName("proxy")     data class Proxy(         val host: String = "localhost",         val port: Int = 7890,         val type: ProxyType = ProxyType.HTTP,     ) : BypassSetting {          enum class ProxyType {             HTTP,             SOCKS,         }     } } ```  usage code is this:  ```kotlin @OptIn(ExperimentalSerializationApi::class, ExperimentalSettingsApi::class) var bypassSettings: BypassSetting by serializedValue(     key = "bypass_settings",     defaultValue = BypassSetting.None, ) ```  but when i want to modify the `bypassSettings` to a new value:  ```kotlin bypassSettings = BypassSetting.SNIReplace(     fallback = mapOf(         "baidu.com" to listOf("1.1.1.1"),     ),     url = "https://dns.alidns.com/dns-query", ) ```  the `url` can be
  **Post-Mortem & Fix Analysis**:
  > I can't fully run your test because I don't know what `SystemConfig.getConfig("app_clone")` returns, but I think I can see the issue. As far as I can tell, it has nothing to do with polymorphic, but rather is a problem with nonnull default values when deserializing. Here's a more minimal test case:  ```kotlin @Test fun issue_231() {     @Serializable     data class TestClass(         val data: Map<String, String> = emptyMap()     )      val settings = MapSettings()     val testClass = TestClass(mapOf("foo" to "bar"))      settings.encodeValue("testClass", testClass)      val deserialized = settings.decodeValueOrNull<TestClass>("testClass")     assertTrue { deserialized?.data?.get("foo") == "bar" } } ```
  > > I can't fully run your test because I don't know what `SystemConfig.getConfig("app_clone")` returns, but I think I can see the issue. As far as I can tell, it has nothing to do with polymorphic, but rather is a problem with nonnull default values when deserializing. Here's a more minimal test case: >  > ```kotlin > @Test > fun issue_231() { >     @Serializable >     data class TestClass( >         val data: Map<String, String> = emptyMap() >     ) >  >     val settings = MapSettings() >     val testClass = TestClass(mapOf("foo" to "bar")) >  >     settings.encodeValue("testClass", testClass) >  >     val deserialized = settings.decodeValueOrNull<TestClass>("testClass") >     assertTrue { deserialized?.data?.get("foo") == "bar" } > } > ```  hum.... replace the `SystemConfig.getConfig("app_clone")` to the `MapSettings()` can get the same results.
  > The first assertion fails due to a library bug which I'll fix in the next release.   The second assertion fails because the reified type is getting inferred as `BypassSetting.Null` rather than `BypassSetting`. You can correct this by changing `bypassSettings1` from a `val` to a `var`, or by specifying the type argument as`config1.serializedValue<BypassSetting>(...)` 

- **Issue #229** (2026-03-04): **Support for storing Set of strings**
  *Symptoms*: function for storing Set<String> is missing. Please add if possible, thank you!  
  **Post-Mortem & Fix Analysis**:
  > You can use `multiplatform-settings-serialization` for this.  ```kotlin  settings.encodeValue(SetSerializer(Int.serializer()), "key", setOf(1, 2, 3)) ```
  > Also a duplicate of #67 

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

### Incident Patch 1: `c60dcc20` (2025-06-05)
**Commit Message**: Extract shared base class for SettingsDecoder and SettingsRemover, and add test case for not removing extra nullability marker keys

**File**: `multiplatform-settings-serialization/src/commonMain/kotlin/SerializationInternals.kt` (modified, +32/-85)
```diff
@@ -90,16 +90,16 @@ internal class SettingsEncoder(
 }
 
 @ExperimentalSerializationApi
-internal class SettingsDecoder(
-    private val settings: Settings,
+internal abstract class AbstractSettingsDecoder(
+    protected val settings: Settings,
     private val key: String,
     public override val serializersModule: SerializersModule
 ) : AbstractDecoder() {
 
     // Stacks of keys and indices so we can track index at arbitrary levels to know what we're decoding next
     private val keyStack = ArrayDeque<String>().apply { add(key) }
     private val indexStack = ArrayDeque<Int>().apply { add(0) }
-    private fun getKey(): String = keyStack.joinToString(".")
+    protected fun getKey(): String = keyStack.joinToString(".")
 
     // Depth increases with beginStructure() and decreases with endStructure(). Subtly different from stack sizes.
     // This is important so we can tell whether the last items on the stack refer to the current parent or a sibling.
@@ -161,6 +161,27 @@ internal class SettingsDecoder(
         }
     }
 
+    // Hook to reset state after we throw during deserializationError()
+    internal fun reset() {
+        keyStack.clear()
+        indexStack.clear()
+        depth = 0
+        keyStack.add(key)
+        indexStack.add(0)
+    }
+}
+
+@ExperimentalSerializationApi
+internal class SettingsDecoder(
+    settings: Settings,
+    key: String,
+    serializersModule: SerializersModule
+) : AbstractSettingsDecoder(
+    settings,
+    key,
+    serializersModule
+) {
+
     public override fun decodeCollectionSize(descriptor: SerialDescriptor): Int =
         settings.getIntOrNull("${getKey()}.size") ?: deserializationError()
 
@@ -183,100 +204,26 @@ internal class SettingsDecoder(
     public override fun decodeLong(): Long = settings.getLongOrNull(getKey()) ?: deserializationError()
     public override fun decodeShort(): Short = settings.getIntOrNull(getKey())?.toShort() ?: deserializationError()
     public override fun decodeString(): String = settings.getStringOrNull(getKey()) ?: deserializationError()
-
-    // Hook to reset state after we throw during deserializationError()
-    internal fun reset() {
-        keyStack.clear()
-        indexStack.clear()
-        depth = 0
-        keyStack.add(key)
-        indexStack.add(0)
-    }
 }
 
 // (Ab)uses Decoder machinery to enumerate all keys related to a serialized value, so they can be removed
 @ExperimentalSerializationApi
 internal class SettingsRemover(
-    private val settings: Settings,
-    private val key: String,
-    public override val serializersModule: SerializersModule
-) : AbstractDecoder() {
-
+    settings: Settings,
+    key: String,
+    serializersModule: SerializersModule
+) : AbstractSettingsDecoder(
+    settings,
+    key,
+    serializersModule
+) {
     private val keys = mutableListOf<String>()
     fun removeKeys() {
         for (key in keys) {
             settings.remove(key)
         }
     }
 
-    // Stacks of keys and indices so we can track index at arbitrary levels to know what we're decoding next
-    private val keyStack = ArrayDeque<String>().apply { add(key) }
-    private val indexStack = ArrayDeque<Int>().apply { add(0) }
-    private fun getKey(): String = keyStack.joinToString(".")
-
-    // Depth increases with beginStructure() and decreases with endStructure(). Subtly different from stack sizes.
-    // This is important so we can tell whether the last items on the stack refer to the current parent or a sibling.
-    private var depth = 0
-
-
-    public override fun decodeElementIndex(descriptor: SerialDescriptor): Int {
-        if (keyStack.size > depth) {
-            keyStack.removeLast()
-            indexStack.removeLast()
-        }
-
-        // Can usually ask descriptor for a size, except for collections
-        val size = when (descriptor.kind) {
-            StructureKind.LIST -> decodeCollectionSize(descriptor)
-            StructureKind.MAP -> 2 * decodeCollectionSize(descriptor) // Maps look like lists [k1, v1, k2, v2, ...]
-            else -> descriptor.elementsCount
-        }
-
-        return getNextIndex(descriptor, size)
-    }
-
-    private tailrec fun getNextIndex(descriptor: SerialDescriptor, size: Int): Int {
-        val index = indexStack.removeLast()
-        indexStack.addLast(index + 1)
-
-        return when {
-            index >= size -> CompositeDecoder.DECODE_DONE
-            isMissingAndOptional(descriptor, index) -> getNextIndex(descriptor, size)
-            else -> {
-                keyStack.add(descriptor.getElementName(index))
-                indexStack.add(0)
-                index
-            }
-        }
-    }
-
-    private fun isMissingAndOptional(descriptor: SerialDescriptor, index: Int): Boolean {
-        val key = "${getKey()}.${descriptor.getElementName(index)}"
-        // Descriptor shows key is optional, key is not present, and nullability doesn't indicate key should be present
-        val output = descriptor.isEle
```

**File**: `multiplatform-settings-serialization/src/commonTest/kotlin/SettingsSerializationTest.kt` (modified, +20/-0)
```diff
@@ -312,6 +312,26 @@ class SettingsSerializationTest {
         assertEquals(0, settings.size)
     }
 
+    @Test
+    fun removeValue_extra() {
+        val delegate = mutableMapOf<String, Any>(
+            "foo.a" to "hello",
+            "foo.a?" to 0, // Should not be removed
+        )
+        val settings = MapSettings(delegate)
+
+        @Serializable
+        data class Foo(
+            val a: String,
+        )
+
+        val foo = settings.decodeValueOrNull<Foo>("foo")
+        assertEquals("hello", foo?.a)
+
+        settings.removeValue<Foo>("foo")
+        assertEquals(mapOf<String, Any>("foo.a?" to 0), delegate)
+    }
+
     @Test
     fun containsValue() {
         val settings: Settings = MapSettings(
```

---

### Incident Patch 2: `b8154487` (2025-05-18)
**Commit Message**: Fix #231 by checking if descriptor is nullable in addition to optional

**File**: `multiplatform-settings-serialization/src/commonMain/kotlin/SerializationInternals.kt` (modified, +4/-3)
```diff
@@ -140,7 +140,8 @@ internal class SettingsDecoder(
     private fun isMissingAndOptional(descriptor: SerialDescriptor, index: Int): Boolean {
         val key = "${getKey()}.${descriptor.getElementName(index)}"
         // Descriptor shows key is optional, key is not present, and nullability doesn't indicate key should be present
-        return descriptor.isElementOptional(index) && key !in settings && settings.getBooleanOrNull("$key?") != true
+        return descriptor.isElementOptional(index) && descriptor.isNullable &&
+                key !in settings && settings.getBooleanOrNull("$key?") != true
     }
 
 
@@ -252,8 +253,8 @@ internal class SettingsRemover(
     private fun isMissingAndOptional(descriptor: SerialDescriptor, index: Int): Boolean {
         val key = "${getKey()}.${descriptor.getElementName(index)}"
         // Descriptor shows key is optional, key is not present, and nullability doesn't indicate key should be present
-        val output =
-            descriptor.isElementOptional(index) && key !in settings && settings.getBooleanOrNull("$key?") != true
+        val output = descriptor.isElementOptional(index) && descriptor.isNullable &&
+                key !in settings && settings.getBooleanOrNull("$key?") != true
         keys.add(key)
         keys.add("$key?")
         return output
```

**File**: `multiplatform-settings-serialization/src/commonTest/kotlin/SettingsSerializationTest.kt` (modified, +21/-2)
```diff
@@ -801,9 +801,9 @@ class SettingsSerializationTest {
             settings.decodeValue(TestClassNullable.serializer().nullable, "testClass", TestClassNullable())
         )
 
-        assertTrue(settings.containsValue(TestClass.serializer().nullable, "testClass"))
+        assertTrue(settings.containsValue(TestClassNullable.serializer().nullable, "testClass"))
 
-        settings.removeValue(TestClass.serializer().nullable, "testClass")
+        settings.removeValue(TestClassNullable.serializer().nullable, "testClass")
         assertEquals(0, settings.size)
 
     }
@@ -1064,6 +1064,25 @@ class SettingsSerializationTest {
         myItems = emptyList()
         myItems = emptyList()
     }
+
+    @Test
+    fun issue_231() {
+        @Serializable
+        data class Container(
+            val data: Map<String, String> = emptyMap()
+        )
+
+        val settings = MapSettings()
+        val container = Container(mapOf("foo" to "bar"))
+
+        settings.encodeValue("container", container)
+
+        val deserialized = settings.decodeValueOrNull<Container>("container")
+        assertEquals("bar", deserialized?.data?.get("foo"))
+
+        settings.removeValue<Container>("container")
+        assertEquals(0, settings.size)
+    }
 }
 
 @Serializable
```

---

### Incident Patch 3: `d656c583` (2024-11-26)
**Commit Message**: Ensure that SettingsEncoder is correctly reset to initial state after finishing an encoding, in case of reuse such as with delegates. Fixes #217

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -4,6 +4,7 @@
 
 - Update to Kotlin 2.0.21, Gradle 8.10, and Android Gradle Plugin 8.5.2
 - Add `wasmWasi` support to `multiplatform-settings-coroutines` and `multiplatform-settings-serialization`.
+- Fix an issue in `multiplatform-settings-serialization` where delegates might return wrong values or crash (#217).
 
 ## v1.2.0 *(2024-09-01)* ##
 
```

**File**: `multiplatform-settings-serialization/src/commonMain/kotlin/SerializationInternals.kt` (modified, +5/-1)
```diff
@@ -31,7 +31,7 @@ import kotlinx.serialization.modules.SerializersModule
 @ExperimentalSerializationApi
 internal class SettingsEncoder(
     private val settings: Settings,
-    key: String,
+    private val key: String,
     public override val serializersModule: SerializersModule
 ) : AbstractEncoder() {
 
@@ -60,6 +60,10 @@ internal class SettingsEncoder(
     public override fun endStructure(descriptor: SerialDescriptor) {
         depth--
         keyStack.removeLast()
+        if (keyStack.isEmpty()) {
+            // We've reached the end of everything, so reset for potential encoder reuse
+            keyStack.add(key)
+        }
     }
 
     public override fun beginCollection(descriptor: SerialDescriptor, collectionSize: Int): CompositeEncoder {
```

**File**: `multiplatform-settings-serialization/src/commonTest/kotlin/SettingsSerializationTest.kt` (modified, +41/-0)
```diff
@@ -21,6 +21,7 @@ import com.russhwolf.settings.MapSettings
 import com.russhwolf.settings.Settings
 import com.russhwolf.settings.contains
 import kotlinx.serialization.ExperimentalSerializationApi
+import kotlinx.serialization.SerialName
 import kotlinx.serialization.Serializable
 import kotlinx.serialization.SerializationException
 import kotlinx.serialization.builtins.ListSerializer
@@ -1023,6 +1024,46 @@ class SettingsSerializationTest {
         preferences.list = list
         assertEquals(expected = list, actual = preferences.list)
     }
+
+    @Test
+    fun issue_217() {
+        val settings = MapSettings()
+
+        @Serializable
+        data class MyItemDto(
+            @SerialName("name")
+            val name: String,
+            @SerialName("id")
+            val id: String,
+        )
+
+        var myItems: List<MyItemDto> by settings.serializedValue(
+            ListSerializer(MyItemDto.serializer()),
+            "MY_ITEMS",
+            emptyList(),
+        )
+
+        myItems = emptyList()
+        assertEquals(emptyList(), myItems)
+        myItems = listOf(
+            MyItemDto(
+                name = "Name",
+                id = "Id",
+            )
+        )
+        assertEquals(
+            listOf(
+                MyItemDto(
+                    name = "Name",
+                    id = "Id",
+                )
+            ), myItems
+        )
+
+        // Should not crash
+        myItems = emptyList()
+        myItems = emptyList()
+    }
 }
 
 @Serializable
```

---

### Incident Patch 4: `5aa0f107` (2024-09-28)
**Commit Message**: Update android sample versions to fix duplicate class issues

**File**: `sample/app-android/build.gradle.kts` (modified, +3/-3)
```diff
@@ -55,14 +55,14 @@ android {
 dependencies {
     implementation(project(":shared"))
     implementation(fileTree("include" to listOf("*.jar"), "dir" to "libs"))
-    implementation(platform("androidx.compose:compose-bom:2023.09.02"))
+    implementation(platform("androidx.compose:compose-bom:2024.09.02"))
     implementation("androidx.compose.material3:material3")
     implementation("androidx.compose.foundation:foundation")
     implementation("androidx.compose.ui:ui")
     implementation("androidx.compose.ui:ui-tooling-preview")
     debugImplementation("androidx.compose.ui:ui-tooling")
-    implementation("androidx.activity:activity-compose:1.7.2")
+    implementation("androidx.activity:activity-compose:1.9.2")
     implementation("androidx.compose.material:material-icons-core")
-    implementation("androidx.preference:preference-ktx:1.2.0")
+    implementation("androidx.preference:preference-ktx:1.2.1")
     implementation("com.russhwolf:multiplatform-settings:${rootProject.ext["library_version"]}")
 }
```

**File**: `sample/app-android/src/main/java/com/russhwolf/settings/example/android/MainActivity.kt` (modified, +0/-5)
```diff
@@ -19,7 +19,6 @@ package com.russhwolf.settings.example.android
 import android.os.Bundle
 import androidx.activity.ComponentActivity
 import androidx.activity.compose.setContent
-import androidx.compose.foundation.interaction.MutableInteractionSource
 import androidx.compose.foundation.isSystemInDarkTheme
 import androidx.compose.foundation.layout.Arrangement
 import androidx.compose.foundation.layout.Box
@@ -32,15 +31,13 @@ import androidx.compose.foundation.shape.CircleShape
 import androidx.compose.foundation.text.KeyboardOptions
 import androidx.compose.material.icons.Icons
 import androidx.compose.material.icons.rounded.ArrowDropDown
-import androidx.compose.material.ripple.rememberRipple
 import androidx.compose.material3.Button
 import androidx.compose.material3.Checkbox
 import androidx.compose.material3.DropdownMenu
 import androidx.compose.material3.DropdownMenuItem
 import androidx.compose.material3.ExperimentalMaterial3Api
 import androidx.compose.material3.Icon
 import androidx.compose.material3.MaterialTheme
-import androidx.compose.material3.MaterialTheme.colorScheme
 import androidx.compose.material3.Surface
 import androidx.compose.material3.Text
 import androidx.compose.material3.TextButton
@@ -201,8 +198,6 @@ private fun LabeledCheckbox(
             .clip(CircleShape)
             .toggleable(
                 value = checked,
-                indication = rememberRipple(color = colorScheme.primary),
-                interactionSource = remember { MutableInteractionSource() },
                 role = Role.Checkbox,
                 onValueChange = onClick,
             )
```

---

### Incident Patch 5: `0f1f9ca2` (2024-09-02)
**Commit Message**: Move group declaration to top-level build file

**File**: `build.gradle.kts` (modified, +4/-0)
```diff
@@ -21,6 +21,10 @@ plugins {
     alias(libs.plugins.kotlin.binaryCompatibilityValidator)
 }
 
+allprojects {
+    group = "com.russhwolf"
+}
+
 nexusPublishing {
     repositories {
         sonatype()
```

**File**: `convention-plugins/src/main/kotlin/module-publication.gradle.kts` (modified, +0/-1)
```diff
@@ -25,7 +25,6 @@ plugins {
 // https://github.com/gradle/gradle/issues/15383#issuecomment-779893192
 val libs = the<LibrariesForLibs>()
 
-group = "com.russhwolf"
 version = libs.versions.multiplatformSettings.get()
 
 publishing {
```

---

### Incident Patch 6: `25cccd7a` (2024-06-27)
**Commit Message**: Update to Kotlin 2.0.0 and fix some minor breakages

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -11,3 +11,4 @@ keys.properties
 !.idea/copyright
 !.idea/inspectionProfiles
 !.idea/runConfigurations
+.kotlin
```

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 [versions]
 multiplatformSettings = "1.2.0"
 
-kotlin = "1.9.24"
+kotlin = "2.0.0"
 
 android-gradle = "8.2.2"
 android-minSdk = "15"
```

**File**: `kotlin-js-store/yarn.lock` (modified, +244/-211)
```diff
@@ -44,18 +44,26 @@
   resolved "https://registry.yarnpkg.com/@jridgewell/sourcemap-codec/-/sourcemap-codec-1.4.15.tgz#d7c6e6755c78567a951e04ab52ef0fd26de59f32"
   integrity sha512-eF2rxCRulEKXHTRiDrDy6erMYWqNw4LPdQ8UQA4huuxaQsVeRPFl2oM8oDGxMFhJUWZf9McpLtJasDDZb/Bpeg==
 
-"@jridgewell/trace-mapping@^0.3.17", "@jridgewell/trace-mapping@^0.3.9":
+"@jridgewell/trace-mapping@^0.3.20":
+  version "0.3.25"
+  resolved "https://registry.yarnpkg.com/@jridgewell/trace-mapping/-/trace-mapping-0.3.25.tgz#15f190e98895f3fc23276ee14bc76b675c2e50f0"
+  integrity sha512-vNk6aEwybGtawWmy/PzwnGDOjCkLWSD2wqvjGGAgOAwCGWySYXfYoxt00IJkTF+8Lb57DwOb3Aa0o9CApepiYQ==
+  dependencies:
+    "@jridgewell/resolve-uri" "^3.1.0"
+    "@jridgewell/sourcemap-codec" "^1.4.14"
+
+"@jridgewell/trace-mapping@^0.3.9":
   version "0.3.19"
   resolved "https://registry.yarnpkg.com/@jridgewell/trace-mapping/-/trace-mapping-0.3.19.tgz#f8a3249862f91be48d3127c3cfe992f79b4b8811"
   integrity sha512-kf37QtfW+Hwx/buWGMPcR60iF9ziHa6r/CZJIHbmcm4+0qrXiVdxegAH0F6yddEVQ7zdkjcGCgCzUu+BcbhQxw==
   dependencies:
     "@jridgewell/resolve-uri" "^3.1.0"
     "@jridgewell/sourcemap-codec" "^1.4.14"
 
-"@types/component-emitter@^1.2.10":
-  version "1.2.11"
-  resolved "https://registry.yarnpkg.com/@types/component-emitter/-/component-emitter-1.2.11.tgz#50d47d42b347253817a39709fef03ce66a108506"
-  integrity sha512-SRXjM+tfsSlA9VuG8hGO2nft2p8zjXCK1VcC6N4NXbBbYbSia9kzCChYQajIjzIqOOOuh5Ock6MmV2oux4jDZQ==
+"@socket.io/component-emitter@~3.1.0":
+  version "3.1.2"
+  resolved "https://registry.yarnpkg.com/@socket.io/component-emitter/-/component-emitter-3.1.2.tgz#821f8442f4175d8f0467b9daf26e3a18e2d02af2"
+  integrity sha512-9BCxFwvbGg/RsZK9tjXd8s4UcwR0MWeFQ1XEKIQVVvAGJyINdrqKMcTRyLoK8Rse1GjzLV9cwjWV1olXRWEXVA==
 
 "@types/cookie@^0.4.1":
   version "0.4.1"
@@ -88,10 +96,10 @@
   resolved "https://registry.yarnpkg.com/@types/estree/-/estree-0.0.50.tgz#1e0caa9364d3fccd2931c3ed96fdbeaa5d4cca83"
   integrity sha512-C6N5s2ZFtuZRj54k2/zyRhNDjJwwcViAM3Nbm8zjBpbqAdZ00mr0CFxvSKeO8Y/e03WVFLpQMdHYVfUd6SB+Hw==
 
-"@types/estree@^1.0.0":
-  version "1.0.1"
-  resolved "https://registry.yarnpkg.com/@types/estree/-/estree-1.0.1.tgz#aa22750962f3bf0e79d753d3cc067f010c95f194"
-  integrity sha512-LG4opVs2ANWZ1TJoKc937iMmNstM/d0ae1vNbnBvBhqCSezgVUOzcLCqbI5elV8Vy6WKwKjaqR+zO9VKirBBCA==
+"@types/estree@^1.0.5":
+  version "1.0.5"
+  resolved "https://registry.yarnpkg.com/@types/estree/-/estree-1.0.5.tgz#a6ce3e556e00fd9895dd872dd172ad0d4bd687f4"
+  integrity sha512-/kYRxGDLWzHOB7q+wtSUQlFrtcdUccpfy+X+9iMBpHK8QLLhx2wIPYuS5DYtR9Wa/YlZAbIovy7qVdB1Aq6Lyw==
 
 "@types/json-schema@*", "@types/json-schema@^7.0.8":
   version "7.0.9"
@@ -103,10 +111,10 @@
   resolved "https://registry.yarnpkg.com/@types/node/-/node-16.11.1.tgz#2e50a649a50fc403433a14f829eface1a3443e97"
   integrity sha512-PYGcJHL9mwl1Ek3PLiYgyEKtwTMmkMw4vbiyz/ps3pfdRYLVv+SN7qHVAImrjdAXxgluDEw6Ph4lyv+m9UpRmA==
 
-"@webassemblyjs/ast@1.11.6", "@webassemblyjs/ast@^1.11.5":
-  version "1.11.6"
-  resolved "https://registry.yarnpkg.com/@webassemblyjs/ast/-/ast-1.11.6.tgz#db046555d3c413f8966ca50a95176a0e2c642e24"
-  integrity sha512-IN1xI7PwOvLPgjcf180gC1bqn3q/QaOCwYUahIOhbYUu8KA/3tw2RT/T0Gidi1l7Hhj5D/INhJxiICObqpMu4Q==
+"@webassemblyjs/ast@1.12.1", "@webassemblyjs/ast@^1.12.1":
+  version "1.12.1"
+  resolved "https://registry.yarnpkg.com/@webassemblyjs/ast/-/ast-1.12.1.tgz#bb16a0e8b1914f979f45864c23819cc3e3f0d4bb"
+  integrity sha512-EKfMUOPRRUTy5UII4qJDGPpqfwjOmZ5jeGFwid9mnoqIFK+e0vqoi1qH56JpmZSzEL53jKnNzScdmftJyG5xWg==
   dependencies:
     "@webassemblyjs/helper-numbers" "1.11.6"
     "@webassemblyjs/helper-wasm-bytecode" "1.11.6"
@@ -121,10 +129,10 @@
   resolved "https://registry.yarnpkg.com/@webassemblyjs/helper-api-error/-/helper-api-error-1.11.6.tgz#6132f68c4acd59dcd141c44b18cbebbd9f2fa768"
   integrity sha512-o0YkoP4pVu4rN8aTJgAyj9hC2Sv5UlkzCHhxqWj8butaLvnpdc2jOwh4ewE6CX0txSfLn/UYaV/pheS2Txg//Q==
 
-"@webassemblyjs/helper-buffer@1.11.6":
-  version "1.11.6"
-  resolved "https://registry.yarnpkg.com/@webassemblyjs/helper-buffer/-/helper-buffer-1.11.6.tgz#b66d73c43e296fd5e88006f18524feb0f2c7c093"
-  integrity sha512-z3nFzdcp1mb8nEOFFk8DrYLpHvhKC3grJD2ardfKOzmbmJvEf/tPIqCY+sNcwZIY8ZD7IkB2l7/pqhUhqm7hLA==
+"@webassemblyjs/helper-buffer@1.12.1":
+  version "1.12.1"
+  resolved "https://registry.yarnpkg.com/@webassemblyjs/helper-buffer/-/helper-buffer-1.12.1.tgz#6df20d272ea5439bf20ab3492b7fb70e9bfcb3f6"
+  integrity sha512-nzJwQw99DNDKr9BVCOZcLuJJUlqkJh+kVzVl6Fmq/tI5ZtEyWT1KZMyOXltXLZJmDtvLCDgwsyrkohEtopTXCw==
 
 "@webassemblyjs/helper-numbers@1.11.6":
   version "1.11.6"
@@ -140,15 +148,15 @@
   resolved "https://registry.yarnpkg.com/@webassemblyjs/helper-wasm-bytecode/-/helper-wasm-bytecode-1.11.6.tgz#bb2ebdb3b83aa26d9baad4c46d4315283acd51e9"
   integrity sha512-sFFHKwcmBprO9e7Icf0+gddyWYDViL8bpPjJJl0WHxCdETktXdmtWLGVzoHbqUcY4Be1LkNfwTmXOJUFZYSJdA==
 
-"@webassemblyjs/helper-wasm-section@1.11.6":
-  version "1.11.6"
-  resolved "https
```

**File**: `multiplatform-settings-coroutines/api/multiplatform-settings-coroutines.klib.api` (modified, +3/-3)
```diff
@@ -95,9 +95,9 @@ final fun (com.russhwolf.settings/ObservableSettings).com.russhwolf.settings.cor
 final fun (com.russhwolf.settings/ObservableSettings).com.russhwolf.settings.coroutines/getStringOrNullFlow(kotlin/String): kotlinx.coroutines.flow/Flow<kotlin/String?> // com.russhwolf.settings.coroutines/getStringOrNullFlow|getStringOrNullFlow@com.russhwolf.settings.ObservableSettings(kotlin.String){}[0]
 final fun (com.russhwolf.settings/ObservableSettings).com.russhwolf.settings.coroutines/getStringOrNullStateFlow(kotlinx.coroutines/CoroutineScope, kotlin/String): kotlinx.coroutines.flow/StateFlow<kotlin/String?> // com.russhwolf.settings.coroutines/getStringOrNullStateFlow|getStringOrNullStateFlow@com.russhwolf.settings.ObservableSettings(kotlinx.coroutines.CoroutineScope;kotlin.String){}[0]
 final fun (com.russhwolf.settings/ObservableSettings).com.russhwolf.settings.coroutines/getStringStateFlow(kotlinx.coroutines/CoroutineScope, kotlin/String, kotlin/String): kotlinx.coroutines.flow/StateFlow<kotlin/String> // com.russhwolf.settings.coroutines/getStringStateFlow|getStringStateFlow@com.russhwolf.settings.ObservableSettings(kotlinx.coroutines.CoroutineScope;kotlin.String;kotlin.String){}[0]
-final fun (com.russhwolf.settings/ObservableSettings).com.russhwolf.settings.coroutines/toFlowSettings(kotlinx.coroutines/CoroutineDispatcher =...): com.russhwolf.settings.coroutines/FlowSettings // com.russhwolf.settings.coroutines/toFlowSettings|toFlowSettings@com.russhwolf.settings.ObservableSettings(kotlinx.coroutines.CoroutineDispatcher){}[0]
-final fun (com.russhwolf.settings/Settings).com.russhwolf.settings.coroutines/toSuspendSettings(kotlinx.coroutines/CoroutineDispatcher =...): com.russhwolf.settings.coroutines/SuspendSettings // com.russhwolf.settings.coroutines/toSuspendSettings|toSuspendSettings@com.russhwolf.settings.Settings(kotlinx.coroutines.CoroutineDispatcher){}[0]
+final fun (com.russhwolf.settings/ObservableSettings).com.russhwolf.settings.coroutines/toFlowSettings(kotlinx.coroutines/CoroutineDispatcher = ...): com.russhwolf.settings.coroutines/FlowSettings // com.russhwolf.settings.coroutines/toFlowSettings|toFlowSettings@com.russhwolf.settings.ObservableSettings(kotlinx.coroutines.CoroutineDispatcher){}[0]
+final fun (com.russhwolf.settings/Settings).com.russhwolf.settings.coroutines/toSuspendSettings(kotlinx.coroutines/CoroutineDispatcher = ...): com.russhwolf.settings.coroutines/SuspendSettings // com.russhwolf.settings.coroutines/toSuspendSettings|toSuspendSettings@com.russhwolf.settings.Settings(kotlinx.coroutines.CoroutineDispatcher){}[0]
 // Targets: [native]
-final fun (com.russhwolf.settings.coroutines/FlowSettings).com.russhwolf.settings.coroutines/toBlockingObservableSettings(kotlinx.coroutines/CoroutineScope =...): com.russhwolf.settings/ObservableSettings // com.russhwolf.settings.coroutines/toBlockingObservableSettings|toBlockingObservableSettings@com.russhwolf.settings.coroutines.FlowSettings(kotlinx.coroutines.CoroutineScope){}[0]
+final fun (com.russhwolf.settings.coroutines/FlowSettings).com.russhwolf.settings.coroutines/toBlockingObservableSettings(kotlinx.coroutines/CoroutineScope = ...): com.russhwolf.settings/ObservableSettings // com.russhwolf.settings.coroutines/toBlockingObservableSettings|toBlockingObservableSettings@com.russhwolf.settings.coroutines.FlowSettings(kotlinx.coroutines.CoroutineScope){}[0]
 // Targets: [native]
 final fun (com.russhwolf.settings.coroutines/SuspendSettings).com.russhwolf.settings.coroutines/toBlockingSettings(): com.russhwolf.settings/Settings // com.russhwolf.settings.coroutines/toBlockingSettings|toBlockingSettings@com.russhwolf.settings.coroutines.SuspendSettings(){}[0]
```

**File**: `multiplatform-settings-serialization/api/multiplatform-settings-serialization.klib.api` (modified, +14/-14)
```diff
@@ -6,17 +6,17 @@
 // - Show declarations: true
 
 // Library unique name: <com.russhwolf:multiplatform-settings-serialization>
-final fun <#A: kotlin/Any> (com.russhwolf.settings/Settings).com.russhwolf.settings.serialization/nullableSerializedValue(kotlinx.serialization/KSerializer<#A>, kotlin/String? =..., kotlinx.serialization.modules/SerializersModule =...): kotlin.properties/ReadWriteProperty<kotlin/Any?, #A?> // com.russhwolf.settings.serialization/nullableSerializedValue|nullableSerializedValue@com.russhwolf.settings.Settings(kotlinx.serialization.KSerializer<0:0>;kotlin.String?;kotlinx.serialization.modules.SerializersModule){0§<kotlin.Any>}[0]
-final fun <#A: kotlin/Any?> (com.russhwolf.settings/Settings).com.russhwolf.settings.serialization/containsValue(kotlinx.serialization/KSerializer<#A>, kotlin/String, kotlinx.serialization.modules/SerializersModule =...): kotlin/Boolean // com.russhwolf.settings.serialization/containsValue|containsValue@com.russhwolf.settings.Settings(kotlinx.serialization.KSerializer<0:0>;kotlin.String;kotlinx.serialization.modules.SerializersModule){0§<kotlin.Any?>}[0]
-final fun <#A: kotlin/Any?> (com.russhwolf.settings/Settings).com.russhwolf.settings.serialization/decodeValue(kotlinx.serialization/KSerializer<#A>, kotlin/String, #A, kotlinx.serialization.modules/SerializersModule =...): #A // com.russhwolf.settings.serialization/decodeValue|decodeValue@com.russhwolf.settings.Settings(kotlinx.serialization.KSerializer<0:0>;kotlin.String;0:0;kotlinx.serialization.modules.SerializersModule){0§<kotlin.Any?>}[0]
-final fun <#A: kotlin/Any?> (com.russhwolf.settings/Settings).com.russhwolf.settings.serialization/decodeValueOrNull(kotlinx.serialization/KSerializer<#A>, kotlin/String, kotlinx.serialization.modules/SerializersModule =...): #A? // com.russhwolf.settings.serialization/decodeValueOrNull|decodeValueOrNull@com.russhwolf.settings.Settings(kotlinx.serialization.KSerializer<0:0>;kotlin.String;kotlinx.serialization.modules.SerializersModule){0§<kotlin.Any?>}[0]
-final fun <#A: kotlin/Any?> (com.russhwolf.settings/Settings).com.russhwolf.settings.serialization/encodeValue(kotlinx.serialization/KSerializer<#A>, kotlin/String, #A, kotlinx.serialization.modules/SerializersModule =...) // com.russhwolf.settings.serialization/encodeValue|encodeValue@com.russhwolf.settings.Settings(kotlinx.serialization.KSerializer<0:0>;kotlin.String;0:0;kotlinx.serialization.modules.SerializersModule){0§<kotlin.Any?>}[0]
-final fun <#A: kotlin/Any?> (com.russhwolf.settings/Settings).com.russhwolf.settings.serialization/removeValue(kotlinx.serialization/KSerializer<#A>, kotlin/String, kotlin/Boolean =..., kotlinx.serialization.modules/SerializersModule =...) // com.russhwolf.settings.serialization/removeValue|removeValue@com.russhwolf.settings.Settings(kotlinx.serialization.KSerializer<0:0>;kotlin.String;kotlin.Boolean;kotlinx.serialization.modules.SerializersModule){0§<kotlin.Any?>}[0]
-final fun <#A: kotlin/Any?> (com.russhwolf.settings/Settings).com.russhwolf.settings.serialization/serializedValue(kotlinx.serialization/KSerializer<#A>, kotlin/String? =..., #A, kotlinx.serialization.modules/SerializersModule =...): kotlin.properties/ReadWriteProperty<kotlin/Any?, #A> // com.russhwolf.settings.serialization/serializedValue|serializedValue@com.russhwolf.settings.Settings(kotlinx.serialization.KSerializer<0:0>;kotlin.String?;0:0;kotlinx.serialization.modules.SerializersModule){0§<kotlin.Any?>}[0]
-final inline fun <#A: reified kotlin/Any> (com.russhwolf.settings/Settings).com.russhwolf.settings.serialization/nullableSerializedValue(kotlin/String? =..., kotlinx.serialization.modules/SerializersModule =...): kotlin.properties/ReadWriteProperty<kotlin/Any?, #A?> // com.russhwolf.settings.serialization/nullableSerializedValue|nullableSerializedValue@com.russhwolf.settings.Settings(kotlin.String?;kotlinx.serialization.modules.SerializersModule){0§<kotlin.Any>}[0]
-final inline fun <#A: reified kotlin/Any?> (com.russhwolf.settings/Settings).com.russhwolf.settings.serialization/containsValue(kotlin/String, kotlinx.serialization.modules/SerializersModule =...): kotlin/Boolean // com.russhwolf.settings.serialization/containsValue|containsValue@com.russhwolf.settings.Settings(kotlin.String;kotlinx.serialization.modules.SerializersModule){0§<kotlin.Any?>}[0]
-final inline fun <#A: reified kotlin/Any?> (com.russhwolf.settings/Settings).com.russhwolf.settings.serialization/decodeValue(kotlin/String, #A, kotlinx.serialization.modules/SerializersModule =...): #A // com.russhwolf.settings.serialization/decodeValue|decodeValue@com.russhwolf.settings.Settings(kotlin.String;0:0;kotlinx.serialization.modules.SerializersModule){0§<kotlin.Any?>}[0]
-final inline fun <#A: reified kotlin/Any?> (com.russhwolf.settings/Settings).com.russhwolf.settings.serialization/decodeValueOrNull(kotlin/String, kotlinx.serialization.modules/SerializersModule =...): #A? // com.russhwolf.settings.serialization/decodeValueOrNull|decodeVa
```

**File**: `multiplatform-settings-test/api/multiplatform-settings-test.klib.api` (modified, +2/-2)
```diff
@@ -7,10 +7,10 @@
 
 // Library unique name: <com.russhwolf:multiplatform-settings-test>
 final class com.russhwolf.settings/MapSettings : com.russhwolf.settings/ObservableSettings { // com.russhwolf.settings/MapSettings|null[0]
-    constructor <init>(kotlin.collections/MutableMap<kotlin/String, kotlin/Any> =...) // com.russhwolf.settings/MapSettings.<init>|<init>(kotlin.collections.MutableMap<kotlin.String,kotlin.Any>){}[0]
+    constructor <init>(kotlin.collections/MutableMap<kotlin/String, kotlin/Any> = ...) // com.russhwolf.settings/MapSettings.<init>|<init>(kotlin.collections.MutableMap<kotlin.String,kotlin.Any>){}[0]
     constructor <init>(kotlin/Array<out kotlin/Pair<kotlin/String, kotlin/Any>>...) // com.russhwolf.settings/MapSettings.<init>|<init>(kotlin.Array<out|kotlin.Pair<kotlin.String,kotlin.Any>>...){}[0]
     final class Factory : com.russhwolf.settings/Settings.Factory { // com.russhwolf.settings/MapSettings.Factory|null[0]
-        constructor <init>(kotlin/Function0<kotlin.collections/MutableMap<kotlin/String, kotlin/Any>> =..., kotlin.collections/MutableMap<kotlin/String?, kotlin.collections/MutableMap<kotlin/String, kotlin/Any>> =...) // com.russhwolf.settings/MapSettings.Factory.<init>|<init>(kotlin.Function0<kotlin.collections.MutableMap<kotlin.String,kotlin.Any>>;kotlin.collections.MutableMap<kotlin.String?,kotlin.collections.MutableMap<kotlin.String,kotlin.Any>>){}[0]
+        constructor <init>(kotlin/Function0<kotlin.collections/MutableMap<kotlin/String, kotlin/Any>> = ..., kotlin.collections/MutableMap<kotlin/String?, kotlin.collections/MutableMap<kotlin/String, kotlin/Any>> = ...) // com.russhwolf.settings/MapSettings.Factory.<init>|<init>(kotlin.Function0<kotlin.collections.MutableMap<kotlin.String,kotlin.Any>>;kotlin.collections.MutableMap<kotlin.String?,kotlin.collections.MutableMap<kotlin.String,kotlin.Any>>){}[0]
         final fun create(kotlin/String?): com.russhwolf.settings/MapSettings // com.russhwolf.settings/MapSettings.Factory.create|create(kotlin.String?){}[0]
         final fun setCacheValues(kotlin/String?, kotlin.collections/Map<kotlin/String, kotlin/Any>) // com.russhwolf.settings/MapSettings.Factory.setCacheValues|setCacheValues(kotlin.String?;kotlin.collections.Map<kotlin.String,kotlin.Any>){}[0]
         final fun setCacheValues(kotlin/String?, kotlin/Array<out kotlin/Pair<kotlin/String, kotlin/Any>>...) // com.russhwolf.settings/MapSettings.Factory.setCacheValues|setCacheValues(kotlin.String?;kotlin.Array<out|kotlin.Pair<kotlin.String,kotlin.Any>>...){}[0]
```

**File**: `multiplatform-settings/api/multiplatform-settings.klib.api` (modified, +15/-15)
```diff
@@ -44,7 +44,7 @@ abstract interface com.russhwolf.settings/Settings { // com.russhwolf.settings/S
     abstract fun putString(kotlin/String, kotlin/String) // com.russhwolf.settings/Settings.putString|putString(kotlin.String;kotlin.String){}[0]
     abstract fun remove(kotlin/String) // com.russhwolf.settings/Settings.remove|remove(kotlin.String){}[0]
     abstract interface Factory { // com.russhwolf.settings/Settings.Factory|null[0]
-        abstract fun create(kotlin/String? =...): com.russhwolf.settings/Settings // com.russhwolf.settings/Settings.Factory.create|create(kotlin.String?){}[0]
+        abstract fun create(kotlin/String? = ...): com.russhwolf.settings/Settings // com.russhwolf.settings/Settings.Factory.create|create(kotlin.String?){}[0]
     }
     abstract val keys // com.russhwolf.settings/Settings.keys|{}keys[0]
         abstract fun <get-keys>(): kotlin.collections/Set<kotlin/String> // com.russhwolf.settings/Settings.keys.<get-keys>|<get-keys>(){}[0]
@@ -55,18 +55,18 @@ abstract interface com.russhwolf.settings/Settings { // com.russhwolf.settings/S
 abstract interface com.russhwolf.settings/SettingsListener { // com.russhwolf.settings/SettingsListener|null[0]
     abstract fun deactivate() // com.russhwolf.settings/SettingsListener.deactivate|deactivate(){}[0]
 }
-final fun (com.russhwolf.settings/Settings).com.russhwolf.settings/boolean(kotlin/String? =..., kotlin/Boolean): kotlin.properties/ReadWriteProperty<kotlin/Any?, kotlin/Boolean> // com.russhwolf.settings/boolean|boolean@com.russhwolf.settings.Settings(kotlin.String?;kotlin.Boolean){}[0]
-final fun (com.russhwolf.settings/Settings).com.russhwolf.settings/double(kotlin/String? =..., kotlin/Double): kotlin.properties/ReadWriteProperty<kotlin/Any?, kotlin/Double> // com.russhwolf.settings/double|double@com.russhwolf.settings.Settings(kotlin.String?;kotlin.Double){}[0]
-final fun (com.russhwolf.settings/Settings).com.russhwolf.settings/float(kotlin/String? =..., kotlin/Float): kotlin.properties/ReadWriteProperty<kotlin/Any?, kotlin/Float> // com.russhwolf.settings/float|float@com.russhwolf.settings.Settings(kotlin.String?;kotlin.Float){}[0]
-final fun (com.russhwolf.settings/Settings).com.russhwolf.settings/int(kotlin/String? =..., kotlin/Int): kotlin.properties/ReadWriteProperty<kotlin/Any?, kotlin/Int> // com.russhwolf.settings/int|int@com.russhwolf.settings.Settings(kotlin.String?;kotlin.Int){}[0]
-final fun (com.russhwolf.settings/Settings).com.russhwolf.settings/long(kotlin/String? =..., kotlin/Long): kotlin.properties/ReadWriteProperty<kotlin/Any?, kotlin/Long> // com.russhwolf.settings/long|long@com.russhwolf.settings.Settings(kotlin.String?;kotlin.Long){}[0]
-final fun (com.russhwolf.settings/Settings).com.russhwolf.settings/nullableBoolean(kotlin/String? =...): kotlin.properties/ReadWriteProperty<kotlin/Any?, kotlin/Boolean?> // com.russhwolf.settings/nullableBoolean|nullableBoolean@com.russhwolf.settings.Settings(kotlin.String?){}[0]
-final fun (com.russhwolf.settings/Settings).com.russhwolf.settings/nullableDouble(kotlin/String? =...): kotlin.properties/ReadWriteProperty<kotlin/Any?, kotlin/Double?> // com.russhwolf.settings/nullableDouble|nullableDouble@com.russhwolf.settings.Settings(kotlin.String?){}[0]
-final fun (com.russhwolf.settings/Settings).com.russhwolf.settings/nullableFloat(kotlin/String? =...): kotlin.properties/ReadWriteProperty<kotlin/Any?, kotlin/Float?> // com.russhwolf.settings/nullableFloat|nullableFloat@com.russhwolf.settings.Settings(kotlin.String?){}[0]
-final fun (com.russhwolf.settings/Settings).com.russhwolf.settings/nullableInt(kotlin/String? =...): kotlin.properties/ReadWriteProperty<kotlin/Any?, kotlin/Int?> // com.russhwolf.settings/nullableInt|nullableInt@com.russhwolf.settings.Settings(kotlin.String?){}[0]
-final fun (com.russhwolf.settings/Settings).com.russhwolf.settings/nullableLong(kotlin/String? =...): kotlin.properties/ReadWriteProperty<kotlin/Any?, kotlin/Long?> // com.russhwolf.settings/nullableLong|nullableLong@com.russhwolf.settings.Settings(kotlin.String?){}[0]
-final fun (com.russhwolf.settings/Settings).com.russhwolf.settings/nullableString(kotlin/String? =...): kotlin.properties/ReadWriteProperty<kotlin/Any?, kotlin/String?> // com.russhwolf.settings/nullableString|nullableString@com.russhwolf.settings.Settings(kotlin.String?){}[0]
-final fun (com.russhwolf.settings/Settings).com.russhwolf.settings/string(kotlin/String? =..., kotlin/String): kotlin.properties/ReadWriteProperty<kotlin/Any?, kotlin/String> // com.russhwolf.settings/string|string@com.russhwolf.settings.Settings(kotlin.String?;kotlin.String){}[0]
+final fun (com.russhwolf.settings/Settings).com.russhwolf.settings/boolean(kotlin/String? = ..., kotlin/Boolean): kotlin.properties/ReadWriteProperty<kotlin/Any?, kotlin/Boolean> // com.russhwolf.settings/boolean|boolean@com.russhwolf.settings.Settings(kotlin.String?;kotlin.Boolean){}[0]
+final fun (com.russhwolf.settings/Settings).com.russhwolf.settings/double(kotlin/
```

**File**: `multiplatform-settings/src/apple32Main/kotlin/com/russhwolf/settings/KeychainSettings.kt` (removed, +0/-21)
```diff
@@ -1,21 +0,0 @@
-/*
- * Copyright 2019 Russell Wolf
- *
- * Licensed under the Apache License, Version 2.0 (the "License");
- * you may not use this file except in compliance with the License.
- * You may obtain a copy of the License at
- *
- *    http://www.apache.org/licenses/LICENSE-2.0
- *
- * Unless required by applicable law or agreed to in writing, software
- * distributed under the License is distributed on an "AS IS" BASIS,
- * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
- * See the License for the specific language governing permissions and
- * limitations under the License.
- */
-
-package com.russhwolf.settings
-
-import platform.CoreFoundation.CFIndex
-
-internal actual fun Number.toCFIndex(): CFIndex = toInt()
```

---

### Incident Patch 7: `86bbf289` (2024-06-27)
**Commit Message**: Only generate BuildConfig for modules that were stable at 1.0

Otherwise, we don't care about this breaking change, and don't want to be blindly adding it for new modules in the future

**File**: `convention-plugins/src/main/kotlin/standard-configuration.gradle.kts` (modified, +0/-5)
```diff
@@ -105,9 +105,4 @@ tasks.withType<KotlinCompile> {
     kotlinOptions.jvmTarget = "1.8"
 }
 
-
-android {
-    // Oops, this was on in 1.0, so now it's technically a breaking change to turn it off
-    buildFeatures.buildConfig = true
-}
 //endregion
```

**File**: `multiplatform-settings-coroutines/api/android/multiplatform-settings-coroutines.api` (modified, +0/-7)
```diff
@@ -4,13 +4,6 @@ public final class com/russhwolf/settings/coroutines/BlockingConvertersKt {
 	public static final fun toBlockingSettings (Lcom/russhwolf/settings/coroutines/SuspendSettings;)Lcom/russhwolf/settings/Settings;
 }
 
-public final class com/russhwolf/settings/coroutines/BuildConfig {
-	public static final field BUILD_TYPE Ljava/lang/String;
-	public static final field DEBUG Z
-	public static final field LIBRARY_PACKAGE_NAME Ljava/lang/String;
-	public fun <init> ()V
-}
-
 public final class com/russhwolf/settings/coroutines/ConvertersKt {
 	public static final fun toFlowSettings (Lcom/russhwolf/settings/ObservableSettings;Lkotlinx/coroutines/CoroutineDispatcher;)Lcom/russhwolf/settings/coroutines/FlowSettings;
 	public static synthetic fun toFlowSettings$default (Lcom/russhwolf/settings/ObservableSettings;Lkotlinx/coroutines/CoroutineDispatcher;ILjava/lang/Object;)Lcom/russhwolf/settings/coroutines/FlowSettings;
```

**File**: `multiplatform-settings-datastore/api/android/multiplatform-settings-datastore.api` (modified, +0/-7)
```diff
@@ -1,10 +1,3 @@
-public final class com/russhwolf/settings/datastore/BuildConfig {
-	public static final field BUILD_TYPE Ljava/lang/String;
-	public static final field DEBUG Z
-	public static final field LIBRARY_PACKAGE_NAME Ljava/lang/String;
-	public fun <init> ()V
-}
-
 public final class com/russhwolf/settings/datastore/DataStoreSettings : com/russhwolf/settings/coroutines/FlowSettings {
 	public fun <init> (Landroidx/datastore/core/DataStore;)V
 	public fun clear (Lkotlin/coroutines/Continuation;)Ljava/lang/Object;
```

**File**: `multiplatform-settings-make-observable/api/android/multiplatform-settings-make-observable.api` (modified, +0/-7)
```diff
@@ -2,10 +2,3 @@ public final class com/russhwolf/settings/observable/MakeObservableSettingsKt {
 	public static final fun makeObservable (Lcom/russhwolf/settings/Settings;)Lcom/russhwolf/settings/ObservableSettings;
 }
 
-public final class com/russhwolf/settings/runtime_observable/BuildConfig {
-	public static final field BUILD_TYPE Ljava/lang/String;
-	public static final field DEBUG Z
-	public static final field LIBRARY_PACKAGE_NAME Ljava/lang/String;
-	public fun <init> ()V
-}
-
```

**File**: `multiplatform-settings-no-arg/build.gradle.kts` (modified, +3/-0)
```diff
@@ -90,4 +90,7 @@ kotlin {
 android {
     namespace = "com.russhwolf.settings.no_arg"
     testOptions.unitTests.isIncludeAndroidResources = true
+
+    // Oops, this was on in 1.0, so now it's technically a breaking change to turn it off
+    buildFeatures.buildConfig = true
 }
```

**File**: `multiplatform-settings-serialization/api/android/multiplatform-settings-serialization.api` (modified, +0/-7)
```diff
@@ -1,10 +1,3 @@
-public final class com/russhwolf/settings/serialization/BuildConfig {
-	public static final field BUILD_TYPE Ljava/lang/String;
-	public static final field DEBUG Z
-	public static final field LIBRARY_PACKAGE_NAME Ljava/lang/String;
-	public fun <init> ()V
-}
-
 public final class com/russhwolf/settings/serialization/SettingsSerializationKt {
 	public static final fun containsValue (Lcom/russhwolf/settings/Settings;Lkotlinx/serialization/KSerializer;Ljava/lang/String;Lkotlinx/serialization/modules/SerializersModule;)Z
 	public static synthetic fun containsValue$default (Lcom/russhwolf/settings/Settings;Lkotlinx/serialization/KSerializer;Ljava/lang/String;Lkotlinx/serialization/modules/SerializersModule;ILjava/lang/Object;)Z
```

**File**: `multiplatform-settings-test/build.gradle.kts` (modified, +3/-0)
```diff
@@ -42,4 +42,7 @@ kotlin {
 
 android {
     namespace = "com.russhwolf.settings.test"
+
+    // Oops, this was on in 1.0, so now it's technically a breaking change to turn it off
+    buildFeatures.buildConfig = true
 }
```

**File**: `multiplatform-settings/build.gradle.kts` (modified, +3/-0)
```diff
@@ -50,4 +50,7 @@ kotlin {
 android {
     namespace = "com.russhwolf.settings"
     testOptions.unitTests.isIncludeAndroidResources = true
+
+    // Oops, this was on in 1.0, so now it's technically a breaking change to turn it off
+    buildFeatures.buildConfig = true
 }
```

---

### Incident Patch 8: `ea3b96d3` (2024-01-09)
**Commit Message**: Add top-level build-all workflow

**File**: `.github/workflows/build-all.yml` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+name: Build All
+
+on:
+  push:
+    branches:
+      - main
+    paths-ignore:
+      - "**/*.md"
+  pull_request:
+    paths-ignore:
+      - "**/*.md"
+
+  workflow_dispatch:
+
+jobs:
+  build-linux:
+    name: Build Linux
+    uses: ./.github/workflows/build-linux.yml
+
+  build-macos:
+    name: Build macOS
+    uses: ./.github/workflows/build-macos.yml
+
+  build-windows:
+    name: Build Windows
+    uses: ./.github/workflows/build-windows.yml
```

**File**: `.github/workflows/build-linux.yml` (modified, +1/-8)
```diff
@@ -1,14 +1,7 @@
 name: Build Linux
 
 on:
-  push:
-    branches:
-      - main
-    paths-ignore:
-      - "**/*.md"
-  pull_request:
-    paths-ignore:
-      - "**/*.md"
+  workflow_call:
   workflow_dispatch:
 
 jobs:
```

**File**: `.github/workflows/build-macos.yml` (modified, +1/-8)
```diff
@@ -1,14 +1,7 @@
 name: Build macOS
 
 on:
-  push:
-    branches:
-      - main
-    paths-ignore:
-      - "**/*.md"
-  pull_request:
-    paths-ignore:
-      - "**/*.md"
+  workflow_call:
   workflow_dispatch:
 
 jobs:
```

**File**: `.github/workflows/build-windows.yml` (modified, +1/-8)
```diff
@@ -1,14 +1,7 @@
 name: Build Windows
 
 on:
-  push:
-    branches:
-      - main
-    paths-ignore:
-      - "**/*.md"
-  pull_request:
-    paths-ignore:
-      - "**/*.md"
+  workflow_call:
   workflow_dispatch:
 
 jobs:
```

---

### Incident Patch 9: `7d3a450c` (2023-11-21)
**Commit Message**: Cache konan folder in CI builds

**File**: `.github/workflows/build-linux.yml` (modified, +8/-0)
```diff
@@ -24,6 +24,14 @@ jobs:
           java-version: 17
           distribution: corretto
 
+      - name: Cache konan directory
+        uses: actions/cache@v3
+        with:
+          path: ~/.konan
+          key: ${{ runner.os }}-konan-${{ hashFiles('*.gradle.kts', 'buildSrc/*') }}
+          restore-keys: |
+            ${{ runner.os }}-konan-
+
       - name: Linux build
         run: |
           ./gradlew build publishToMavenLocal --no-daemon --stacktrace
```

**File**: `.github/workflows/build-macos.yml` (modified, +8/-0)
```diff
@@ -24,6 +24,14 @@ jobs:
           java-version: 17
           distribution: corretto
 
+      - name: Cache konan directory
+        uses: actions/cache@v3
+        with:
+          path: ~/.konan
+          key: ${{ runner.os }}-konan-${{ hashFiles('*.gradle.kts', 'buildSrc/*') }}
+          restore-keys: |
+            ${{ runner.os }}-konan-
+
       - name: Mac build
         run: |
           ./gradlew macosX64Test iosX64Test watchosX64Test tvosX64Test \
```

**File**: `.github/workflows/build-windows.yml` (modified, +8/-0)
```diff
@@ -24,6 +24,14 @@ jobs:
           java-version: 17
           distribution: corretto
 
+      - name: Cache konan directory
+        uses: actions/cache@v3
+        with:
+          path: ~/.konan
+          key: ${{ runner.os }}-konan-${{ hashFiles('*.gradle.kts', 'buildSrc/*') }}
+          restore-keys: |
+            ${{ runner.os }}-konan-
+
       - name: Windows build
         run: |
           ./gradlew mingwX64Test publishKotlinMultiplatformPublicationToMavenLocal publishMingwX64PublicationToMavenLocal --no-daemon --stacktrace
```

---

### Incident Patch 10: `1891ed81` (2023-11-21)
**Commit Message**: Merge pull request #175 from MJegorovas/fix_no_service_name

Fix crash when creating 'KeychainSettings' without name on mac.

**File**: `multiplatform-settings/src/appleMain/kotlin/com/russhwolf/settings/KeychainSettings.kt` (modified, +9/-7)
```diff
@@ -130,14 +130,16 @@ public class KeychainSettings @ExperimentalSettingsApi constructor(vararg defaul
                 return emptySet()
             }
 
-            @Suppress("RemoveRedundantCallsOfConversionMethods") // IDE thinks CFIndex == Int but might be Long
-            val list = List(CFArrayGetCount(attributes.value).toInt()) { i ->
-                val item: CFDictionaryRef? = CFArrayGetValueAtIndex(attributes.value, i.toCFIndex())?.reinterpret()
-                val cfKey: CFStringRef? = CFDictionaryGetValue(item, kSecAttrAccount)?.reinterpret()
-                val nsKey = CFBridgingRelease(cfKey) as NSString
-                nsKey.toKString()
+            return buildSet {
+                for (i in 0..<CFArrayGetCount(attributes.value)) {
+                    val item: CFDictionaryRef? = CFArrayGetValueAtIndex(attributes.value, i.toCFIndex())?.reinterpret()
+                    val cfKey: CFStringRef? = CFDictionaryGetValue(item, kSecAttrAccount)?.reinterpret()
+                    if (cfKey != null) {
+                        val nsKey = CFBridgingRelease(cfKey) as NSString
+                        add(nsKey.toKString())
+                    }
+                }
             }
-            return list.toSet()
         }
 
     public override val size: Int get() = keys.size
```

**File**: `multiplatform-settings/src/macosX64Test/kotlin/com/russhwolf/settings/KeychainSettingsTest.kt` (modified, +8/-0)
```diff
@@ -73,4 +73,12 @@ class KeychainSettingsTest : BaseSettingsTest(
         }
         assertEquals("value", value)
     }
+
+    @Test
+    fun keys_no_name() {
+        val settings = KeychainSettings()
+
+        // Ensure this doesn't throw
+        settings.keys
+    }
 }
```

---

### Incident Patch 11: `909c4990` (2023-11-21)
**Commit Message**: Use `buildSet` to avoid extra allocations and null-checking

**File**: `multiplatform-settings/src/appleMain/kotlin/com/russhwolf/settings/KeychainSettings.kt` (modified, +9/-9)
```diff
@@ -130,15 +130,15 @@ public class KeychainSettings @ExperimentalSettingsApi constructor(vararg defaul
                 return emptySet()
             }
 
-            @Suppress("RemoveRedundantCallsOfConversionMethods") // IDE thinks CFIndex == Int but might be Long
-            val size = CFArrayGetCount(attributes.value).toInt()
-            return (0 until size).mapNotNullTo(mutableSetOf()) { i ->
-                val item: CFDictionaryRef? = CFArrayGetValueAtIndex(attributes.value, i.toCFIndex())?.reinterpret()
-                val cfKey: CFStringRef? = CFDictionaryGetValue(item, kSecAttrAccount)?.reinterpret()
-                if (cfKey != null) {
-                    val nsKey = CFBridgingRelease(cfKey) as NSString
-                    nsKey.toKString()
-                } else null
+            return buildSet {
+                for (i in 0..<CFArrayGetCount(attributes.value)) {
+                    val item: CFDictionaryRef? = CFArrayGetValueAtIndex(attributes.value, i.toCFIndex())?.reinterpret()
+                    val cfKey: CFStringRef? = CFDictionaryGetValue(item, kSecAttrAccount)?.reinterpret()
+                    if (cfKey != null) {
+                        val nsKey = CFBridgingRelease(cfKey) as NSString
+                        add(nsKey.toKString())
+                    }
+                }
             }
         }
 
```

**File**: `multiplatform-settings/src/macosX64Test/kotlin/com/russhwolf/settings/KeychainSettingsTest.kt` (modified, +3/-2)
```diff
@@ -37,7 +37,6 @@ import platform.Security.kSecMatchLimitOne
 import platform.Security.kSecReturnData
 import kotlin.test.Test
 import kotlin.test.assertEquals
-import kotlin.test.assertTrue
 
 // TODO figure out how to get this running on ios, watchos, and tvos simulators
 @ExperimentalSettingsImplementation
@@ -78,6 +77,8 @@ class KeychainSettingsTest : BaseSettingsTest(
     @Test
     fun keys_no_name() {
         val settings = KeychainSettings()
-        assertTrue(settings.keys.isNotEmpty())
+
+        // Ensure this doesn't throw
+        settings.keys
     }
 }
```

---

### Incident Patch 12: `3c820c10` (2023-11-15)
**Commit Message**: Fix crash when creating 'KeychainSettings' without name on mac.

**File**: `multiplatform-settings/src/appleMain/kotlin/com/russhwolf/settings/KeychainSettings.kt` (modified, +6/-4)
```diff
@@ -131,13 +131,15 @@ public class KeychainSettings @ExperimentalSettingsApi constructor(vararg defaul
             }
 
             @Suppress("RemoveRedundantCallsOfConversionMethods") // IDE thinks CFIndex == Int but might be Long
-            val list = List(CFArrayGetCount(attributes.value).toInt()) { i ->
+            val size = CFArrayGetCount(attributes.value).toInt()
+            return (0 until size).mapNotNullTo(mutableSetOf()) { i ->
                 val item: CFDictionaryRef? = CFArrayGetValueAtIndex(attributes.value, i.toCFIndex())?.reinterpret()
                 val cfKey: CFStringRef? = CFDictionaryGetValue(item, kSecAttrAccount)?.reinterpret()
-                val nsKey = CFBridgingRelease(cfKey) as NSString
-                nsKey.toKString()
+                if (cfKey != null) {
+                    val nsKey = CFBridgingRelease(cfKey) as NSString
+                    nsKey.toKString()
+                } else null
             }
-            return list.toSet()
         }
 
     public override val size: Int get() = keys.size
```

**File**: `multiplatform-settings/src/macosX64Test/kotlin/com/russhwolf/settings/KeychainSettingsTest.kt` (modified, +7/-0)
```diff
@@ -37,6 +37,7 @@ import platform.Security.kSecMatchLimitOne
 import platform.Security.kSecReturnData
 import kotlin.test.Test
 import kotlin.test.assertEquals
+import kotlin.test.assertTrue
 
 // TODO figure out how to get this running on ios, watchos, and tvos simulators
 @ExperimentalSettingsImplementation
@@ -73,4 +74,10 @@ class KeychainSettingsTest : BaseSettingsTest(
         }
         assertEquals("value", value)
     }
+
+    @Test
+    fun keys_no_name() {
+        val settings = KeychainSettings()
+        assertTrue(settings.keys.isNotEmpty())
+    }
 }
```

---

### Incident Patch 13: `11e544b7` (2023-10-09)
**Commit Message**: Actual publishing fix

(famous last words)

**File**: `build.gradle.kts` (modified, +6/-1)
```diff
@@ -50,7 +50,12 @@ allprojects {
             }
 
             publications.withType<MavenPublication>().configureEach {
-                artifact(emptyJavadocJar.get())
+                val publication = this
+                val javadocJar = tasks.register("${publication.name}JavadocJar", Jar::class) {
+                    archiveClassifier.set("javadoc")
+                    archiveBaseName.set("${archiveBaseName.get()}-${publication.name}")
+                }
+                artifact(javadocJar)
 
                 pom {
                     name.set("Multiplatform Settings")
```

---

### Incident Patch 14: `1be7a6ef` (2023-10-09)
**Commit Message**: Revert "Adjust publishing config to use dokka javadoc task so jar task doesn't break signing task dependencies"

This reverts commit a41236dc1f99cd2a40f60ed385a43dbd313a4d6a.

**File**: `build.gradle.kts` (modified, +46/-54)
```diff
@@ -1,5 +1,3 @@
-import org.jetbrains.dokka.gradle.DokkaTask
-
 /*
  * Copyright 2020 Russell Wolf
  *
@@ -29,73 +27,67 @@ allprojects {
         mavenCentral()
     }
 
-    if (plugins.hasPlugin("maven-publish")) {
-        val dokkaJavadoc by tasks.withType<DokkaTask>()
-
-        val javadocJar: TaskProvider<Jar> by tasks.registering(Jar::class) {
-            archiveClassifier.set("javadoc")
-            dependsOn(dokkaJavadoc)
-            from(dokkaJavadoc.outputDirectory)
-        }
+    val emptyJavadocJar by tasks.registering(Jar::class) {
+        archiveClassifier.set("javadoc")
+    }
 
-        afterEvaluate {
-            extensions.findByType<PublishingExtension>()?.apply {
-                repositories {
-                    maven {
-                        url = uri(
-                            if (isReleaseBuild) {
-                                "https://oss.sonatype.org/service/local/staging/deploy/maven2"
-                            } else {
-                                "https://oss.sonatype.org/content/repositories/snapshots"
-                            }
-                        )
-                        credentials {
-                            username = properties["sonatypeUsername"].toString()
-                            password = properties["sonatypePassword"].toString()
+    afterEvaluate {
+        extensions.findByType<PublishingExtension>()?.apply {
+            repositories {
+                maven {
+                    url = uri(
+                        if (isReleaseBuild) {
+                            "https://oss.sonatype.org/service/local/staging/deploy/maven2"
+                        } else {
+                            "https://oss.sonatype.org/content/repositories/snapshots"
                         }
+                    )
+                    credentials {
+                        username = properties["sonatypeUsername"].toString()
+                        password = properties["sonatypePassword"].toString()
                     }
                 }
+            }
 
-                publications.withType<MavenPublication>().configureEach {
-                    artifact(javadocJar.get())
+            publications.withType<MavenPublication>().configureEach {
+                artifact(emptyJavadocJar.get())
 
-                    pom {
-                        name.set("Multiplatform Settings")
-                        description.set("A Kotlin Multiplatform library for saving simple key-value data")
-                        url.set("https://github.com/russhwolf/multiplatform-settings")
+                pom {
+                    name.set("Multiplatform Settings")
+                    description.set("A Kotlin Multiplatform library for saving simple key-value data")
+                    url.set("https://github.com/russhwolf/multiplatform-settings")
 
-                        licenses {
-                            license {
-                                name.set("The Apache Software License, Version 2.0")
-                                url.set("http://www.apache.org/licenses/LICENSE-2.0.txt")
-                                distribution.set("repo")
-                            }
-                        }
-                        developers {
-                            developer {
-                                id.set("russhwolf")
-                                name.set("Russell Wolf")
-                            }
+                    licenses {
+                        license {
+                            name.set("The Apache Software License, Version 2.0")
+                            url.set("http://www.apache.org/licenses/LICENSE-2.0.txt")
+                            distribution.set("repo")
                         }
-                        scm {
-                            url.set("https://github.com/russhwolf/multiplatform-settings")
+                    }
+                    developers {
+                        developer {
+                            id.set("russhwolf")
+                            name.set("Russell Wolf")
                         }
                     }
+                    scm {
+                        url.set("https://github.com/russhwolf/multiplatform-settings")
+                    }
                 }
             }
+        }
 
-            extensions.findByType<SigningExtension>()?.apply {
-                val publishing = extensions.findByType<PublishingExtension>() ?: return@apply
-                val key = properties["signingKey"]?.toString()?.replace("\\n", "\n")
-                val password = properties["signingPassword"]?.toString()
+        extensions.findByType<SigningExtension>()?.apply {
+            val publishing = extensions.findByType<PublishingExtension>() ?: return@apply
+            val key = properties["signingKey"]?.toString()?.replace("\\n", "\n")
+            val password = properties["signingPassword"]?.toString()
 
-                useInMemoryPgpKeys(key, password)
-    
```

---

### Incident Patch 15: `2bcc395b` (2023-10-09)
**Commit Message**: Fix gradle wrapper validation action branch

**File**: `.github/workflows/validate-gradle-wrapper.yml` (modified, +2/-2)
```diff
@@ -2,9 +2,9 @@ name: Gradle Wrapper Validation
 
 on:
   push:
-    branches: [ master ]
+    branches: [ main ]
   pull_request:
-    branches: [ master ]
+    branches: [ main ]
 
 jobs:
   build:
```

#### Recent Merged Pull Requests:
- **PR #223** (2024-12-04): README improvements (@skaldebane)
- **PR #193** (2024-05-21): Update addKeychainItem(...) to improve compatibility with FaceID (@crysxd)
- **PR #192** (closed): Add a Korean version of the README file (@wooram-yang)
- **PR #187** (closed): [CHORE] Update kotlin 1.9.22 &  Gradle 8.6 (@ahna92)
- **PR #184** (2024-03-25): Runtime Observable Settings (@psuzn)
- **PR #181** (2024-01-20): Get keychain tests running on iOS (@russhwolf)
- **PR #180** (2024-01-09): Add top-level build-all workflow (@russhwolf)
- **PR #179** (2023-11-21): Cache konan folder in CI builds (@russhwolf)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
