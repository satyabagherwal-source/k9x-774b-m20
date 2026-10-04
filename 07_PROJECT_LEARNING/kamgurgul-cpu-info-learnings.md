# Forensic Learning Record (Deep Inspection): kamgurgul/cpu-info

> **Canonical Artifact**: `07_PROJECT_LEARNING/kamgurgul-cpu-info-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kamgurgul/cpu-info](https://github.com/kamgurgul/cpu-info))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:26:20.208Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kamgurgul/cpu-info`
- **Description**: CPU Info is a multiplatform application which provides information about device hardware and software
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1079 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `androidApp/baselineprofile/src/main/java/com/kgurgul/cpuinfo/baselineprofile/BenchmarkUtils.kt`
```
/*
 * Copyright KG Soft
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.kgurgul.cpuinfo.baselineprofile

import androidx.benchmark.macro.MacrobenchmarkScope
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiScrollable
import androidx.test.uiautomator.UiSelector
import androidx.test.uiautomator.Until

fun MacrobenchmarkScope.waitForAsyncContent() {
    device.wait(Until.hasObject(By.res("cpu_info_lazy_column")), 5_000)
    val element = UiScrollable(UiSelector().scrollable(true))
    element.scrollToEnd(3)
}

```

### Core Architecture Module: `androidApp/src/main/kotlin/com/kgurgul/cpuinfo/features/cputile/CpuTileService.kt`
```
/*
 * Copyright KG Soft
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.kgurgul.cpuinfo.features.cputile

import android.graphics.drawable.Icon
import android.os.Build
import android.service.quicksettings.TileService
import androidx.annotation.RequiresApi
import com.kgurgul.cpuinfo.R
import com.kgurgul.cpuinfo.data.provider.CpuDataProvider
import com.kgurgul.cpuinfo.utils.IDispatchersProvider
import com.kgurgul.cpuinfo.utils.formatHz
import kotlin.coroutines.CoroutineContext
import kotlin.time.Duration.Companion.milliseconds
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.koin.core.component.KoinComponent
import org.koin.core.component.inject

@RequiresApi(api = Build.VERSION_CODES.N)
class CpuTileService : TileService(), CoroutineScope, KoinComponent {

    private val cpuDataProvider: CpuDataProvider by inject()
    private val dispatchersProvider: IDispatchersProvider by inject()

    override val coroutineContext: CoroutineContext
        get() = SupervisorJob() + dispatchersProvider.main

    private var refreshingJob: Job? = null

    private val minMaxAvg: Pair<Long, Long> by lazy {
        val cpuCount = cpuDataProvider.getNumberOfLogicalCores()
        val minFreq = mutableListOf<Long>()
        val maxFreq = mutableListOf<Long>()
        for (i in 0 until cpuCount) {
            val minMax = cpuDataProvider.getMinMaxFreq(i)
            minFreq.add(minMax.first)
            maxFreq.add(minMax.second)
        }
        Pair(minFreq.sum() / cpuCount, maxFreq.sum() / cpuCount)
    }

    private val icons by lazy {
        mapOf(
            CPULoad.Low to Icon.createWithResource(this, R.drawable.ic_cpu_low),
            CPULoad.Medium to Icon.createWithResource(this, R.drawable.ic_cpu_med),
            CPULoad.High to Icon.createWithResource(this, R.drawable.ic_cpu_high),
        )
    }
    private val defaultIcon by lazy { Icon.createWithResource(this, R.drawable.ic_cpu_high) }

    override fun onStartListening() {
        super.onStartListening()
        refreshingJob?.cancel()
        refreshingJob = launch {
            while (true) {
                val load = getAverageCPUFreq()
                qsTile?.run {
                    label = "Avg ${formatHz(load)}"
                    icon = getLoadIcon(load)
                    updateTile()
                }
                delay(REFRESHING_DELAY.milliseconds)
            }
        }
    }

    override fun onStopListening() {
        refreshingJob?.cancel()
        super.onStopListening()
    }

    override fun onDestroy() {
        coroutineContext.cancel()
        super.onDestroy()
    }

    private fun getLoadIcon(avgLoad: Long): Icon {
        val freqDiff = minMaxAvg.second - minMaxAvg.first
        val freqThirds = freqDiff / 3
        val loadEnum =
            when {
                avgLoad >= minMaxAvg.second - freqThirds -> CPULoad.High
                minMaxAvg.second - freqThirds > avgLoad &&
                    avgLoad >= minMaxAvg.first + freqThirds -> CPULoad.Medium

                else -> CPULoad.Low
            }
        return icons.getOrDefault(loadEnum, defaultIcon)
    }

    private suspend fun getAverageCPUFreq(): Long {
        return withContext(dispatchersProvider.io) {
            val cpuCount = cpuDataProvider.getNumberOfLogicalCores()
            var sumFreq = 0L
            for (i in 0 until cpuCount) {
                sumFreq += cpuDataProvider.getCurrentFreq(i)
            }
            sumFreq / cpuCount
        }
    }

    enum class CPULoad {
        Low,
        Medium,
        High,
    }

    companion object {
        private const val REFRESHING_DELAY = 1000L
    }
}

```

### Core Architecture Module: `shared/src/androidMain/kotlin/com/kgurgul/cpuinfo/utils/AndroidShortcutManager.kt`
```
/*
 * Copyright KG Soft
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.kgurgul.cpuinfo.utils

import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat
import androidx.core.net.toUri
import com.kgurgul.cpuinfo.data.provider.IPackageNameProvider
import com.kgurgul.cpuinfo.shared.R
import com.kgurgul.cpuinfo.shared.Res
import com.kgurgul.cpuinfo.shared.applications
import com.kgurgul.cpuinfo.shared.temperature
import com.kgurgul.cpuinfo.utils.navigation.NavigationConst
import org.jetbrains.compose.resources.getString

class AndroidShortcutManager(
    private val context: Context,
    private val packageNameProvider: IPackageNameProvider,
    private val packageManager: PackageManager,
) {

    suspend fun createShortcuts(withApplications: Boolean) {
        try {
            val shortcuts = buildList {
                if (withApplications) {
                    add(
                        ShortcutInfoCompat.Builder(context, NavigationConst.APPLICATIONS)
                            .setShortLabel(getString(Res.string.applications))
                            .setIcon(
                                IconCompat.createWithResource(context, R.drawable.ic_apps_shortcut)
                            )
                            .setIntent(
                                packageManager
                                    .getLaunchIntentForPackage(
                                        packageNameProvider.getPackageName()
                                    )!!
                                    .setData(
                                        (NavigationConst.BASE_URL + NavigationConst.APPLICATIONS)
                                            .toUri()
                                    )
                            )
                            .build()
                    )
                }
                add(
                    ShortcutInfoCompat.Builder(context, NavigationConst.TEMPERATURES)
                        .setShortLabel(getString(Res.string.temperature))
                        .setIcon(
                            IconCompat.createWithResource(context, R.drawable.ic_temp_shortcut)
                        )
                        .setIntent(
                            packageManager
                                .getLaunchIntentForPackage(packageNameProvider.getPackageName())!!
                                .setData(
                                    (NavigationConst.BASE_URL + NavigationConst.TEMPERATURES)
                                        .toUri()
                                )
                        )
                        .build()
                )
            }
            ShortcutManagerCompat.addDynamicShortcuts(context, shortcuts)
        } catch (e: Exception) {
            CpuLogger.e { "Error during creating shortcuts: $e" }
        }
    }
}

```

### Core Architecture Module: `shared/src/androidMain/kotlin/com/kgurgul/cpuinfo/utils/PlatformExtensions.android.kt`
```
/*
 * Copyright KG Soft
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.kgurgul.cpuinfo.utils

import java.text.Collator
import java.text.Normalizer

actual fun smartCompare(a: String, b: String): Int {
    val collator = Collator.getInstance().apply { strength = Collator.SECONDARY }
    return collator.compare(a.lowercase(), b.lowercase())
}

actual fun String.normalize(): String {
    return Normalizer.normalize(this, Normalizer.Form.NFD)
}

```

### Core Architecture Module: `shared/src/commonMain/kotlin/com/kgurgul/cpuinfo/utils/ComposeExtensions.kt`
```
/*
 * Copyright KG Soft
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.kgurgul.cpuinfo.utils

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext

@Composable
fun <T> ObserveAsEvents(
    flow: Flow<T>,
    key1: Any? = null,
    key2: Any? = null,
    state: Lifecycle.State = Lifecycle.State.STARTED,
    onEvent: suspend (T) -> Unit,
) {
    val lifecycleOwner = LocalLifecycleOwner.current
    LaunchedEffect(lifecycleOwner.lifecycle, key1, key2) {
        lifecycleOwner.repeatOnLifecycle(state) {
            withContext(Dispatchers.Main.immediate) { flow.collect(onEvent) }
        }
    }
}

```

### Core Architecture Module: `shared/src/commonMain/kotlin/com/kgurgul/cpuinfo/utils/CoroutinesExtensions.kt`
```
/*
 * Copyright KG Soft
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
@file:JvmName("CoroutinesExtensions")

package com.kgurgul.cpuinfo.utils

import com.kgurgul.cpuinfo.utils.wrappers.Result
import kotlin.jvm.JvmName
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

/**
 * Wrap passed [block] with [Result]. Flow will always start with [Result.Loading] and finish with
 * [Result.Success] in case of success otherwise it will emit [Result.Error].
 */
fun <T> wrapToResultFlow(block: suspend () -> T): Flow<Result<T>> = flow {
    emit(Result.Loading)
    try {
        val result = block()
        emit(Result.Success(result))
    } catch (ce: CancellationException) {
        throw ce
    } catch (throwable: Throwable) {
        CpuLogger.e(throwable) { "Error during wrapping to Result" }
        emit(Result.Error(throwable))
    }
}

/**
 * Create flow from suspended function wrapped with [Result]. Flow will always start with
 * [Result.Loading] and finish with [Result.Success] in case of success otherwise it will emit
 * [Result.Error].
 */
fun <T> (suspend () -> T).asResultFlow(): Flow<Result<T>> = flow {
    emit(Result.Loading)
    try {
        val result = invoke()
        emit(Result.Success(result))
    } catch (ce: CancellationException) {
        throw ce
    } catch (throwable: Throwable) {
        CpuLogger.e(throwable) { "Error during wrapping to Result" }
        emit(Result.Error(throwable))
    }
}

expect val ioDispatcher: CoroutineDispatcher

```

### Core Architecture Module: `shared/src/commonMain/kotlin/com/kgurgul/cpuinfo/utils/CpuLogger.kt`
```
/*
 * Copyright KG Soft
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.kgurgul.cpuinfo.utils

import co.touchlab.kermit.Logger
import co.touchlab.kermit.NoTagFormatter
import co.touchlab.kermit.Severity
import co.touchlab.kermit.loggerConfigInit
import co.touchlab.kermit.platformLogWriter

object CpuLogger :
    Logger(
        config = loggerConfigInit(platformLogWriter(NoTagFormatter), minSeverity = Severity.Info),
        tag = "CpuInfo",
    )

```

### Core Architecture Module: `shared/src/commonMain/kotlin/com/kgurgul/cpuinfo/utils/DefaultDispatchersProvider.kt`
```
/*
 * Copyright KG Soft
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.kgurgul.cpuinfo.utils

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers

class DefaultDispatchersProvider : IDispatchersProvider {
    override val main: CoroutineDispatcher
        get() = Dispatchers.Main

    override val io: CoroutineDispatcher
        get() = ioDispatcher

    override val default: CoroutineDispatcher
        get() = Dispatchers.Default

    override val unconfined: CoroutineDispatcher
        get() = Dispatchers.Unconfined
}

```

### Core Architecture Module: `shared/src/commonMain/kotlin/com/kgurgul/cpuinfo/utils/Extensions.kt`
```
/*
 * Copyright KG Soft
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.kgurgul.cpuinfo.utils

import androidx.compose.ui.platform.UriHandler
import kotlin.math.round
import kotlin.math.roundToLong

fun Float.round1(): Float =
    try {
        (this * 10.0).roundToLong() / 10.0f
    } catch (e: Exception) {
        0.0f
    }

fun Double.round1(): Double =
    try {
        (this * 10.0).roundToLong() / 10.0
    } catch (e: Exception) {
        0.0
    }

fun Float.round2(): Float =
    try {
        (this * 100.0).roundToLong() / 100.0f
    } catch (e: Exception) {
        0.0f
    }

fun Double.round2(): Double =
    try {
        (this * 100.0).roundToLong() / 100.0
    } catch (e: Exception) {
        0.0
    }

fun Float.round4(): Float =
    try {
        round(this * 10000) / 10000
    } catch (e: Exception) {
        0.0f
    }

fun Double.round4(): Double =
    try {
        round(this * 10000) / 10000
    } catch (e: Exception) {
        0.0
    }

expect fun smartCompare(a: String, b: String): Int

expect fun String.normalize(): String

fun String.removeNonSpacingMarks() = normalize().replace("\\p{Mn}+".toRegex(), "")

fun UriHandler.safeOpenUri(uri: String): Result<Unit> {
    return runCatching { openUri(uri) }
}

fun formatHz(valueHz: Long): String {
    if (valueHz < 0) return "-"
    val v = valueHz.toDouble()
    return when {
        v >= 1_000_000_000 -> "${(v / 1_000_000_000).round2()} GHz"
        v >= 1_000_000 -> "${(v / 1_000_000).round2()} MHz"
        v >= 1_000 -> "${(v / 1_000).round2()} kHz"
        else -> "$valueHz Hz"
    }
}

```

### Core Architecture Module: `shared/src/commonMain/kotlin/com/kgurgul/cpuinfo/utils/IDispatchersProvider.kt`
```
/*
 * Copyright KG Soft
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.kgurgul.cpuinfo.utils

import kotlinx.coroutines.CoroutineDispatcher

interface IDispatchersProvider {
    val main: CoroutineDispatcher
    val io: CoroutineDispatcher
    val default: CoroutineDispatcher
    val unconfined: CoroutineDispatcher
}

```

### Core Architecture Module: `shared/src/commonMain/kotlin/com/kgurgul/cpuinfo/utils/KoinExtensions.kt`
```
/*
 * Copyright KG Soft
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.kgurgul.cpuinfo.utils

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.lifecycle.ViewModel
import androidx.navigation.NavBackStackEntry
import androidx.navigation.NavController
import org.koin.compose.viewmodel.koinViewModel

@Composable
inline fun <reified T : ViewModel> NavBackStackEntry.sharedViewModel(
    navController: NavController
): T {
    val navGraphRoute = destination.parent?.route ?: return koinViewModel()
    val parentEntry = remember(this) { navController.getBackStackEntry(navGraphRoute) }
    return koinViewModel(viewModelStoreOwner = parentEntry)
}

```

### Core Architecture Module: `shared/src/commonMain/kotlin/com/kgurgul/cpuinfo/utils/ResourceUtils.kt`
```
/*
 * Copyright KG Soft
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.kgurgul.cpuinfo.utils

import com.kgurgul.cpuinfo.shared.Res
import com.kgurgul.cpuinfo.shared.no
import com.kgurgul.cpuinfo.shared.yes

object ResourceUtils {

    fun getYesNoStringResource(yesValue: Boolean) =
        if (yesValue) {
            Res.string.yes
        } else {
            Res.string.no
        }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #111** (2024-02-05): **Cannot Scroll on Fire TV **
  *Symptoms*: Thanks for the wonderful app! It has been very useful on a lot of my devices.  With the latest release it now does not scroll with stock remote or air remote. Any possibility this issue will be fixed?  F-droid CPU Info 5.2.0 Fire OS 7.6.6.4 Model AFTDCT31   
  **Post-Mortem & Fix Analysis**:
  > Probably it is caused by Compose migration :( Is there any available emulator of this this tv? 
  > Fire App Builder  https://developer.amazon.com/docs/fire-app-builder/use-an-android-tv-emulator.html  Fire OS 7.6.6.4 (PS7664/3772) Android 9 Pie API level 28 1920 x 1080 Java 2.1.0 Kernal 4.9.118++ OpenGL 3.2 Board m7632 
  > Fixed in 5.3.0

- **Issue #110** (2024-01-30): **Shorten navigation bar names**
  *Symptoms*: At least on my phone—a Samsung Galaxy A34 5G—the bottom bar configuration gets pretty jumbled up. I reckon simply by shortening to something like "Apps" and "Temp" things would get tidier down there.  ![IMG-20240129-WA0000.jpg](https://github.com/kamgurgul/cpu-info/assets/114566667/b94c5d79-9bf5-4daf-807c-893f063ebccd)        

- **Issue #103** (2023-12-14): **java.lang.IllegalArgumentException: Key "TCS3400 RGB_CT" was already used.**
  *Symptoms*: [crash-com-kgurgul-cpuinfo-14_12-00-23-32_441.zip](https://github.com/kamgurgul/cpu-info/files/13666673/crash-com-kgurgul-cpuinfo-14_12-00-23-32_441.zip)  ``` FATAL EXCEPTION: main Process: com.kgurgul.cpuinfo, PID: 4549 java.lang.IllegalArgumentException: Key "TCS3400 RGB_CT" was already used. If you are using LazyColumn/Row please make sure you provide a unique key for each item. at l1.a0.A(SourceFile:177) at l1.a0$c.l0(SourceFile:8) at u.x.Y0(SourceFile:36) at t.v.b(SourceFile:17) at t.s.e(SourceFile:18) at t.q$c.a(SourceFile:443) at t.q$c.d0(SourceFile:9) at u.v$a$a.a(SourceFile:19) at u.v$a$a.d0(SourceFile:9) at l1.a0$d.a(SourceFile:140) at n1.w.g(SourceFile:56) at o.b$b.a(SourceFile:11) at o.b$b.a0(SourceFile:11) at l1.z.d(SourceFile:17) at n1.e0.g(SourceFile:12) at o.b$a.a(SourceFile:11) at o.b$a.a0(SourceFile:11) at l1.z.d(SourceFile:17) at n1.e0.g(SourceFile:12) at androidx.compose.ui.graphics.f.d(SourceFile:11) at n1.e0.g(SourceFile:12) at androidx.compose.foundation.layout.f.d(SourceFile:111) at n1.e0.g(SourceFile:12) at n1.n0$d.a(SourceFile:9) at n1.n0$d.B(SourceFile:1) at r0.h$a.d(SourceFile:70) at r0.w$a.g(SourceFile:61) at r0.w.n(SourceFile:35) at n1.j1.h(SourceFile:18) at n1.j1.f(SourceFile:27) at n1.n0.Q(SourceFile:31) at n1.n0.h(SourceFile:1) at n1.n0$b.s1(SourceFile:129) at n1.i0.X0(SourceFile:20) at n1.s0.g(SourceFile:4) at n1.s0.p(SourceFile:63) at androidx.compose.ui.platform.AndroidComposeView.f(SourceFile:13) 
  **Post-Mortem & Fix Analysis**:
  > Is fixed in 5.0.0
  > Very good, tested and no more crash. Thank you @kamgurgul 

- **Issue #102** (2023-12-15): **camera number count wrong at v4.7**
  *Symptoms*: version: 4.7  device:  [Xiaomi 6](https://www.mi.com/mi6)   os: [lineageos20 android 13](https://wiki.lineageos.org/devices/sagit/)  the real number of camera could be found at official site and the os web, is 3.  app Hardware -Camera. Amount 4.  ![19860_1698238125_hd](https://github.com/kamgurgul/cpu-info/assets/59185302/ca441942-a222-4dbd-b8c1-192511da0913)  ![19861_1698238222_hd](https://github.com/kamgurgul/cpu-info/assets/59185302/d0675a86-0de2-4e43-828b-6af3465e2ae5)  
  **Post-Mortem & Fix Analysis**:
  > Version 5.0.0 is based on Camera2 and will additionally display number of lenses 
  > so it is not a bug, right? I check release and no v5.0.0.
  > Not a bug, amount of cameras doesn't match amount of lens - in version 5.0.0 lens number is also included 

- **Issue #79** (2023-04-04): **Crashes on Android 13**
  *Symptoms*: After updated to 4.6.0, the app crashes whenever I tap `HARDWARE` or `SENSORS`.
  **Post-Mortem & Fix Analysis**:
  > Can you provide more details? What is your phone? Could you provide stacktrace? 
  > Ok I found an issue - will be fixed in 4.7.0 which is currently in review 

- **Issue #53** (2024-10-28): **Android S CPU not getting temperature**
  *Symptoms*: Android S CPU not getting temperature
  **Post-Mortem & Fix Analysis**:
  > For now I don't have solid solution for temp retrieval 

- **Issue #52** (2021-07-19): **crash on android below 5**
  *Symptoms*: Hi Tnx for this great app :) I have tested your app on lenovo A3300HV (stock android 4.4.2) it works fine in this tabs : CPU - GPU - RAM - STORAGE - SCREEN and this tabs are faulty : ANDROID - HARDWARE - SENSORS  ------------------  After opening each faulty tab, it shows exactly same error : ![error](https://user-images.githubusercontent.com/16348405/120940725-eab63000-c733-11eb-8d2f-ab2e187a486a.jpg)  ----------------  To reproduce this: run it on this android version if you have any device or just make an emulator with this version of android (api level 16 to 20) it must appear!  -------------  So i checked output of logcat for ANDROID, HARDWARE and SENSORS tabs and saw something meaningful which were same (don't hestitate about that pid thing {6032}, thats a random number as process identifier for the OS and will be changed on every run):  ```  W  [ 6032] dalvikvm threadid=1: calling UncaughtExceptionHandler  E  [ 6032] AndroidRuntime FATAL EXCEPTION: main  E  [ 6032] AndroidRuntime Process: com.kgurgul.cpuinfo, PID: 6032  E  [ 6032] AndroidRuntime java.lang.NoSuchMethodError: android.net.wifi.WifiManager.is5GHzBandSupported  E  [ 6032] AndroidRuntime 	at com.kgurgul.cpuinfo.features.information.hardware.HardwareInfoViewModel.o(SourceFile:24)  E  [ 6032] AndroidRuntime 	at com.kgurgul.cpuinfo.features.information.hardware.HardwareInfoViewModel.r(SourceFile:10)  E  [ 6032] AndroidRuntime 	at com.kgurgul.cpuinfo.features.information.hardware.Hardwa
  **Post-Mortem & Fix Analysis**:
  > Fixed in `4.5.0`

- **Issue #30** (2025-02-10): **Wrong temperature data**
  *Symptoms*: shows temperature 10º C. higher than other apps, like https://f-droid.org/es/packages/com.gmail.jiwopene.temperature/  Your app always shows to me 50-60º C   in Qualcomm sensors pm*_tz. This is quite alarming and wrong. Please fix this!   

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

### Incident Patch 1: `ca1b8891` (2026-09-22)
**Commit Message**: [ANDROID] Update cpuinfo lib



---

### Incident Patch 2: `82831d4d` (2026-08-08)
**Commit Message**: [SHARED] Update libs and fix config

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ kotlinxSerialization = "1.11.0"
 kover = "0.9.9"
 ktfmt = "0.64"
 licenses = "3.1.4"
-oshi = "7.4.3"
+oshi = "7.4.4"
 profileinstaller = "1.4.1"
 relinker = "1.4.5"
 spotless = "8.9.0"
```

**File**: `settings.gradle.kts` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ dependencyResolutionManagement {
 }
 
 plugins {
-    id("io.github.ben-manes.versions.settings") version "0.59.0"
+    id("io.github.ben-manes.versions.settings") version "0.60.0"
 }
 
 include(":androidApp")
```

**File**: `shared/build.gradle.kts` (modified, +1/-1)
```diff
@@ -154,7 +154,7 @@ kotlin {
             }
         }
 
-        androidInstrumentedTest {
+        getByName("androidHostTest") {
             dependencies {
                 implementation(kotlin("test"))
                 implementation(kotlin("test-junit"))
```

---

### Incident Patch 3: `f4350777` (2026-08-07)
**Commit Message**: [SHARED] Fix settings config

**File**: `settings.gradle.kts` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ pluginManagement {
 }
 
 dependencyResolutionManagement {
-    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
+    // repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
     repositories {
         google()
         mavenCentral()
```

---

### Incident Patch 4: `3665c73e` (2026-04-22)
**Commit Message**: Update Apple-Actions/upload-testflight-build action to v5 (#526)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `.github/workflows/ios_release.yml` (modified, +1/-1)
```diff
@@ -120,7 +120,7 @@ jobs:
             PRODUCT_BUNDLE_IDENTIFIER="${{ secrets.IOS_BUNDLE_ID }}"
 
           echo "ipa_path=${RUNNER_TEMP}/Build/Archives/cpuinfo.xcarchive/CPU Info.ipa" >> $GITHUB_ENV
-      - uses: Apple-Actions/upload-testflight-build@v4
+      - uses: Apple-Actions/upload-testflight-build@v5
         with:
           app-path: ${{ env.ipa_path }}
           issuer-id: ${{ secrets.IOS_APPSTORE_ISSUER_ID }}
```

**File**: `.github/workflows/mac_release.yml` (modified, +1/-1)
```diff
@@ -76,7 +76,7 @@ jobs:
       - name: Create PKG
         run: ./gradlew packageReleasePkg -PmacOsAppStoreRelease=true
 
-      - uses: Apple-Actions/upload-testflight-build@v4
+      - uses: Apple-Actions/upload-testflight-build@v5
         with:
           app-type: 'osx'
           app-path: desktopApp/build/compose/binaries/main-release/pkg/CPU-Info-${{ github.event.inputs.version }}.pkg
```

#### Recent Merged Pull Requests:
- **PR #621** (closed): Update dependency com.github.oshi:oshi-core to v7.7.0 - autoclosed (@renovate[bot])
- **PR #620** (closed): Update dependency org.jetbrains.kotlinx.kover to v0.9.11 - autoclosed (@renovate[bot])
- **PR #619** (closed): Update dependency com.diffplug.spotless to v8.10.3 - autoclosed (@renovate[bot])
- **PR #618** (closed): Update Gradle to v9.8.0 - autoclosed (@renovate[bot])
- **PR #617** (closed): Update androidxWear to v1.7.0 - autoclosed (@renovate[bot])
- **PR #616** (closed): Update dependency androidx.core:core-ktx to v1.19.1 - autoclosed (@renovate[bot])
- **PR #615** (closed): Update composeMultiplatform to v1.12.1 - autoclosed (@renovate[bot])
- **PR #614** (closed): Update dependency io.coil-kt.coil3:coil-compose to v3.6.3 - autoclosed (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
