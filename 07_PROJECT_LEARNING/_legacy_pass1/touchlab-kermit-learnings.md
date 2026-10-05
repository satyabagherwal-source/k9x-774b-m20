# Forensic Learning Record (Deep Inspection): touchlab/Kermit

> **Canonical Artifact**: `07_PROJECT_LEARNING/touchlab-kermit-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/touchlab/Kermit](https://github.com/touchlab/Kermit))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:28:20.289Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `touchlab/Kermit`
- **Description**: Kermit by Touchlab is a Kotlin Multiplatform centralized logging utility. 
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1039 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `kermit-core/src/androidMain/kotlin/co/touchlab/kermit/LogcatWriter.kt`
```
/*
 * Copyright (c) 2021 Touchlab
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing permissions and limitations under
 * the License.
 */

package co.touchlab.kermit

import android.util.Log

class LogcatWriter(private val messageStringFormatter: MessageStringFormatter = DefaultFormatter) : LogWriter() {
    // When running unit tests, Log calls will fail. Back up to a common writer
    private val testWriter: CommonWriter = CommonWriter(messageStringFormatter)

    override fun log(severity: Severity, message: String, tag: String, throwable: Throwable?) {
        val formattedMessage = messageStringFormatter.formatMessage(null, null, Message(message))
        try {
            if (throwable == null) {
                when (severity) {
                    Severity.Verbose -> Log.v(tag, formattedMessage)
                    Severity.Debug -> Log.d(tag, formattedMessage)
                    Severity.Info -> Log.i(tag, formattedMessage)
                    Severity.Warn -> Log.w(tag, formattedMessage)
                    Severity.Error -> Log.e(tag, formattedMessage)
                    Severity.Assert -> Log.println(Log.ASSERT, tag, formattedMessage)
                }
            } else {
                when (severity) {
                    Severity.Verbose -> Log.v(tag, formattedMessage, throwable)
                    Severity.Debug -> Log.d(tag, formattedMessage, throwable)
                    Severity.Info -> Log.i(tag, formattedMessage, throwable)
                    Severity.Warn -> Log.w(tag, formattedMessage, throwable)
                    Severity.Error -> Log.e(tag, formattedMessage, throwable)
                    Severity.Assert -> Log.println(
                        Log.ASSERT,
                        tag,
                        "${formattedMessage}\n${Log.getStackTraceString(throwable)}",
                    )
                }
            }
        } catch (_: RuntimeException) {
            testWriter.log(severity, message, tag, throwable)
        } catch (_: UnsatisfiedLinkError) {
            testWriter.log(severity, message, tag, throwable)
        }
    }
}

```

### Core Architecture Module: `kermit-core/src/androidMain/kotlin/co/touchlab/kermit/PlatformLogWriter.kt`
```
/*
 * Copyright (c) 2021 Touchlab
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

package co.touchlab.kermit

actual fun platformLogWriter(messageStringFormatter: MessageStringFormatter): LogWriter = LogcatWriter(messageStringFormatter)

```

### Core Architecture Module: `kermit-core/src/androidNativeMain/kotlin/co/touchlab/kermit/AndroidNativeLogWriter.kt`
```
/*
 * Copyright (c) 2022 Touchlab
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

package co.touchlab.kermit

import platform.android.ANDROID_LOG_DEBUG
import platform.android.ANDROID_LOG_ERROR
import platform.android.ANDROID_LOG_FATAL
import platform.android.ANDROID_LOG_INFO
import platform.android.ANDROID_LOG_VERBOSE
import platform.android.ANDROID_LOG_WARN
import platform.android.__android_log_print

class AndroidNativeLogWriter : LogWriter() {

    private fun getSeverity(severity: Severity) = when (severity) {
        Severity.Verbose -> ANDROID_LOG_VERBOSE
        Severity.Debug -> ANDROID_LOG_DEBUG
        Severity.Info -> ANDROID_LOG_INFO
        Severity.Warn -> ANDROID_LOG_WARN
        Severity.Error -> ANDROID_LOG_ERROR
        Severity.Assert -> ANDROID_LOG_FATAL
    }

    override fun log(severity: Severity, message: String, tag: String, throwable: Throwable?) {
        __android_log_print(getSeverity(severity).toInt(), tag, message)
        throwable?.let {
            __android_log_print(getSeverity(severity).toInt(), tag, it.stackTraceToString())
        }
    }
}

```

### Core Architecture Module: `kermit-core/src/androidNativeMain/kotlin/co/touchlab/kermit/PlatformLogWriter.kt`
```
/*
 * Copyright (c) 2022 Touchlab
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

package co.touchlab.kermit

actual fun platformLogWriter(messageStringFormatter: MessageStringFormatter): LogWriter = AndroidNativeLogWriter()

```

### Core Architecture Module: `kermit-core/src/appleMain/kotlin/co/touchlab/kermit/NSLogWriter.kt`
```
/*
 * Copyright (c) 2021 Touchlab
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing permissions and limitations under
 * the License.
 */

package co.touchlab.kermit

import platform.Foundation.NSLog
import platform.Foundation.NSString

/**
 * Legacy logger, using NSLog
 */
@Suppress("CAST_NEVER_SUCCEEDS")
class NSLogWriter(private val messageStringFormatter: MessageStringFormatter = DefaultFormatter) : LogWriter() {
    override fun log(severity: Severity, message: String, tag: String, throwable: Throwable?) {
        NSLog("%s", messageStringFormatter.formatMessage(severity, Tag(tag), Message(message)))
        throwable?.let {
            val string = it.stackTraceToString()
            NSLog("%@", string as NSString)
        }
    }
}

```

### Core Architecture Module: `kermit-core/src/appleMain/kotlin/co/touchlab/kermit/OSLogWriter.kt`
```
/*
 * Copyright (c) 2022 Touchlab
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

package co.touchlab.kermit

import co.touchlab.kermit.darwin.kermit_darwin_log_create
import co.touchlab.kermit.darwin.kermit_darwin_log_public_with_type
import co.touchlab.kermit.darwin.kermit_darwin_log_with_type
import kotlinx.cinterop.ExperimentalForeignApi
import platform.darwin.OS_LOG_TYPE_DEBUG
import platform.darwin.OS_LOG_TYPE_DEFAULT
import platform.darwin.OS_LOG_TYPE_ERROR
import platform.darwin.OS_LOG_TYPE_FAULT
import platform.darwin.OS_LOG_TYPE_INFO
import platform.darwin.os_log_type_t

/**
 * Write log statements to darwin OSLog.
 *
 * Takes in three optional parameters specific to OSLog calls:
 *   subsystem - An identifier string that's passed directly into the OSLog constructor. (See documentation https://developer.apple.com/documentation/os/oslog/2320726-init)
 *   category - A category within the subsystem that's passed directly into the OSLog constructor. (See documentation https://developer.apple.com/documentation/os/oslog/2320726-init)
 *   publicLogging - When true OSLog enforces logs to be public (See documentation https://developer.apple.com/documentation/os/logging/generating_log_messages_from_your_code#3665948)
 */
open class OSLogWriter internal constructor(
    private val messageStringFormatter: MessageStringFormatter,
    private val darwinLogger: DarwinLogger,
) : LogWriter() {

    constructor(
        messageStringFormatter: MessageStringFormatter = DefaultFormatter,
        subsystem: String = "",
        category: String = "",
        publicLogging: Boolean = false,
    ) : this(
        messageStringFormatter,
        DarwinLoggerActual(subsystem, category, publicLogging),
    )

    override fun log(severity: Severity, message: String, tag: String, throwable: Throwable?) {
        callLog(
            severity,
            formatMessage(
                severity = severity,
                message = Message(message),
                tag = Tag(tag),
            ),
            throwable,
        )
    }

    // Added to do some testing on log format. https://github.com/touchlab/Kermit/issues/243
    open fun callLog(severity: Severity, message: String, throwable: Throwable?) {
        val osLogSeverity = kermitSeverityToOsLogType(severity)
        darwinLogger.log(osLogSeverity, message)
        if (throwable != null) {
            logThrowable(osLogSeverity, throwable)
        }
    }

    open fun logThrowable(osLogSeverity: os_log_type_t, throwable: Throwable) {
        darwinLogger.log(osLogSeverity, throwable.stackTraceToString())
    }

    private fun kermitSeverityToOsLogType(severity: Severity): os_log_type_t = when (severity) {
        Severity.Verbose, Severity.Debug -> OS_LOG_TYPE_DEBUG
        Severity.Info -> OS_LOG_TYPE_INFO
        Severity.Warn -> OS_LOG_TYPE_DEFAULT
        Severity.Error -> OS_LOG_TYPE_ERROR
        Severity.Assert -> OS_LOG_TYPE_FAULT
    }

    open fun formatMessage(severity: Severity, tag: Tag, message: Message): String =
        messageStringFormatter.formatMessage(null, tag, message)
}

internal interface DarwinLogger {
    fun log(osLogSeverity: os_log_type_t, message: String)
}

@OptIn(ExperimentalForeignApi::class)
private class DarwinLoggerActual(subsystem: String, category: String, publicLogging: Boolean) : DarwinLogger {
    private val logger = kermit_darwin_log_create(subsystem, category)!!

    // see https://developer.apple.com/documentation/os/logging/generating_log_messages_from_your_code?language=objc
    // iOS considers everything coming from Kermit as a dynamic string, so without publicLogging=true, all logs are
    // private
    private val darwinLogFn: (osLogSeverity: os_log_type_t, message: String) -> Unit = if (publicLogging) {
        { osLogSeverity, message -> kermit_darwin_log_public_with_type(logger, osLogSeverity, message) }
    } else {
        { osLogSeverity, message -> kermit_darwin_log_with_type(logger, osLogSeverity, message) }
    }

    override fun log(osLogSeverity: os_log_type_t, message: String) {
        darwinLogFn(osLogSeverity, message)
    }
}

```

### Core Architecture Module: `kermit-core/src/appleMain/kotlin/co/touchlab/kermit/PlatformLogWriter.kt`
```
/*
 * Copyright (c) 2021 Touchlab
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

package co.touchlab.kermit

actual fun platformLogWriter(messageStringFormatter: MessageStringFormatter): LogWriter = XcodeSeverityWriter(messageStringFormatter)

```

### Core Architecture Module: `kermit-core/src/appleMain/kotlin/co/touchlab/kermit/XcodeSeverityWriter.kt`
```
/*
 * Copyright (c) 2021 Touchlab
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

package co.touchlab.kermit

import platform.darwin.os_log_type_t

/**
 * Development-focused LogWriter. Will write a colored emoji according to Severity, and write the Throwable stack trace
 * to println rather than oslog, as oslog will cut off long strings.
 */
open class XcodeSeverityWriter(private val messageStringFormatter: MessageStringFormatter = DefaultFormatter) :
    OSLogWriter(messageStringFormatter) {
    override fun formatMessage(severity: Severity, tag: Tag, message: Message): String =
        "${emojiPrefix(severity)} ${messageStringFormatter.formatMessage(null, tag, message)}"

    override fun logThrowable(osLogSeverity: os_log_type_t, throwable: Throwable) {
        // oslog cuts off longer strings, so for local development, println is more useful
        println(throwable.stackTraceToString())
    }

    // If this looks familiar, yes, it came directly from Napier :) https://github.com/AAkira/Napier#darwinios-macos-watchos-tvosintelapple-silicon
    open fun emojiPrefix(severity: Severity): String = when (severity) {
        Severity.Verbose -> "⚪️"
        Severity.Debug -> "🔵"
        Severity.Info -> "🟢"
        Severity.Warn -> "🟡"
        Severity.Error -> "🔴"
        Severity.Assert -> "🟤️"
    }
}

```

### Core Architecture Module: `kermit-core/src/commonJvmMain/kotlin/co/touchlab/kermit/JvmMutableLoggerConfig.kt`
```
/*
 * Copyright (c) 2021 Touchlab
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

package co.touchlab.kermit

internal class JvmMutableLoggerConfig(logWriters: List<LogWriter>) : MutableLoggerConfig {
    @Volatile
    @Suppress("ktlint:standard:backing-property-naming")
    private var _minSeverity: Severity = DEFAULT_MIN_SEVERITY

    @Volatile
    @Suppress("ktlint:standard:backing-property-naming")
    private var _loggerList: List<LogWriter> = logWriters

    override var minSeverity: Severity
        get() = _minSeverity
        set(value) {
            synchronized(this) {
                _minSeverity = value
            }
        }

    override var logWriterList: List<LogWriter>
        get() = _loggerList
        set(value) {
            synchronized(this) {
                _loggerList = value
            }
        }
}

```

### Core Architecture Module: `kermit-core/src/commonJvmMain/kotlin/co/touchlab/kermit/KermitConfig.kt`
```
/*
 * Copyright (c) 2021 Touchlab
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing permissions and limitations under
 * the License.
 */

package co.touchlab.kermit

actual fun mutableLoggerConfigInit(logWriters: List<LogWriter>): MutableLoggerConfig = JvmMutableLoggerConfig(logWriters)

```

### Core Architecture Module: `kermit-core/src/commonMain/kotlin/co/touchlab/kermit/AtomicMutableLoggerConfig.kt`
```
/*
 * Copyright (c) 2026 Touchlab
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

package co.touchlab.kermit

import kotlin.concurrent.atomics.AtomicReference
import kotlin.concurrent.atomics.ExperimentalAtomicApi

@OptIn(ExperimentalAtomicApi::class)
internal class AtomicMutableLoggerConfig(logWriters: List<LogWriter>) : MutableLoggerConfig {
    @Suppress("ktlint:standard:backing-property-naming")
    private val _minSeverity = AtomicReference(DEFAULT_MIN_SEVERITY)

    @Suppress("ktlint:standard:backing-property-naming")
    private val _loggerList = AtomicReference(logWriters)

    override var minSeverity: Severity
        get() = _minSeverity.load()
        set(value) {
            _minSeverity.store(value)
        }
    override var logWriterList: List<LogWriter>
        get() = _loggerList.load()
        set(value) {
            _loggerList.store(value)
        }
}

```

### Core Architecture Module: `kermit-core/src/commonMain/kotlin/co/touchlab/kermit/BaseLogger.kt`
```
/*
 * Copyright (c) 2021 Touchlab
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing permissions and limitations under
 * the License.
 */
package co.touchlab.kermit

typealias MessageBlock = () -> String

/**
 * Base class for public Logger API. Extend to implement your own logger API.
 */
@Suppress("unused")
open class BaseLogger(open val config: LoggerConfig) {
    val mutableConfig: MutableLoggerConfig
        get() = config.let {
            if (it !is MutableLoggerConfig) {
                throw IllegalStateException("Logger config is not mutable")
            }
            it
        }

    inline fun logBlock(severity: Severity, tag: String, throwable: Throwable?, message: MessageBlock) {
        if (config.minSeverity <= severity) {
            processLog(
                severity,
                tag,
                throwable,
                message(),
            )
        }
    }

    inline fun log(severity: Severity, tag: String, throwable: Throwable?, message: String) {
        if (config.minSeverity <= severity) {
            processLog(
                severity,
                tag,
                throwable,
                message,
            )
        }
    }

    fun processLog(severity: Severity, tag: String, throwable: Throwable?, message: String) {
        config.logWriterList.forEach {
            if (it.isLoggable(tag, severity)) {
                it.log(severity, message, tag, throwable)
            }
        }
    }
}

internal val DEFAULT_MIN_SEVERITY = Severity.Verbose

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #376** (2025-01-28): **`sample-production` test is causing Bugsnag link issue**
  *Symptoms*: Temporarily [removed](https://github.com/touchlab/Kermit/pull/372/commits/8db5cb2e09af34c67e118eb41c341373aebfe050) the test from `sample-production` to avoid PR failures 

- **Issue #105** (2022-09-09): **bugsnag not writing dual crash report**
  *Symptoms*: Similar issue to Crashlytics. We should get a handled and an unhandled report for each uncaught kotlin crash, but not seeing them. Likely a config issue of some type in the sample app.

- **Issue #104** (2021-08-02): **Crashlytics not writing dual crash report**
  *Symptoms*: Probably something with the config. Crashlytics doesn't get the handled kotlin crash on hard crashes

- **Issue #84** (2021-06-22): **Figure out and fix iOS sample build issue**
  *Symptoms*: The ios Sample doesnt currently build for some reason. Fix that 

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

### Incident Patch 1: `d15aabde` (2026-09-15)
**Commit Message**: Improving Karma config to avoid timeout errors on KotlinJS tests (#488)

* importing karma config with same configs from KJWT to attempt to avoid timeout errors on KotlinJS tests

* manually pointing to karma config

**File**: `convention-plugins/src/main/kotlin/kermit.multiplatform-library.gradle.kts` (modified, +3/-0)
```diff
@@ -1,3 +1,4 @@
+import kermit.configureTests
 import org.gradle.kotlin.dsl.withType
 import org.jetbrains.kotlin.gradle.dsl.JvmTarget
 import org.jetbrains.kotlin.gradle.tasks.KotlinCompile
@@ -49,6 +50,8 @@ kotlin {
             }
         }
     }
+
+    configureTests()
 }
 
 project.afterEvaluate {
```

**File**: `convention-plugins/src/main/kotlin/kermit/tests.kt` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+/*
+ * Copyright (c) 2026 Touchlab
+ * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
+ */
+
+package kermit
+
+import org.gradle.kotlin.dsl.withType
+import org.jetbrains.kotlin.gradle.dsl.KotlinMultiplatformExtension
+import org.jetbrains.kotlin.gradle.targets.js.ir.KotlinJsIrTarget
+
+fun KotlinMultiplatformExtension.configureTests() {
+    configureJSTests()
+}
+
+private fun KotlinMultiplatformExtension.configureJSTests() {
+    targets.withType<KotlinJsIrTarget>().configureEach {
+        whenBrowserConfigured {
+            testTask {
+                useKarma {
+                    useConfigDirectory(project.rootProject.rootDir.resolve("karma.config.d"))
+                    useChromeHeadless()
+                }
+            }
+        }
+    }
+}
```

**File**: `karma.config.d/config.js` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+// Taken from https://github.com/touchlab/kjwt/blob/main/karma.config.d/config.js
+
+config.client = config.client || {}
+config.client.mocha = config.client.mocha || {}
+config.client.mocha.timeout = '6000s'
+config.browserNoActivityTimeout = 6000000
+config.browserDisconnectTimeout = 6000000
```

---

### Incident Patch 2: `a745cc37` (2026-08-14)
**Commit Message**: fixed issues with rolling file and thread interruption (#483)

**File**: `kermit-io/src/commonJvmMain/kotlin/co/touchlab/kermit/io/ChannelSend.kt` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+/*
+ * Copyright (c) 2026 Touchlab
+ * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
+ */
+
+package co.touchlab.kermit.io
+
+import kotlinx.coroutines.channels.SendChannel
+import kotlinx.coroutines.channels.trySendBlocking
+
+internal actual fun <E> SendChannel<E>.sendBlockingUnlessInterrupted(element: E) {
+    // A thread with its interrupt flag set has been asked to stop (Android sync adapters, ExecutorService.shutdownNow(), ...). Blocking it
+    // on log file I/O is exactly what the interrupt asked us not to do, and trySendBlocking would throw InterruptedException at it, so
+    // deliver the message only if that can be done without blocking.
+    if (Thread.currentThread().isInterrupted) {
+        trySend(element)
+        return
+    }
+
+    try {
+        trySendBlocking(element)
+    } catch (_: InterruptedException) {
+        // Interrupted between the check above and the send. runBlocking consumed the interrupt flag on its way out, so restore it: the
+        // caller still needs to see that it was interrupted.
+        Thread.currentThread().interrupt()
+    }
+}
```

**File**: `kermit-io/src/commonJvmTest/kotlin/co/touchlab/kermit/io/RollingFileLogWriterInterruptTest.kt` (added, +112/-0)
```diff
@@ -0,0 +1,112 @@
+/*
+ * Copyright (c) 2026 Touchlab
+ * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
+ */
+
+package co.touchlab.kermit.io
+
+import co.touchlab.kermit.Severity
+import java.util.concurrent.atomic.AtomicBoolean
+import java.util.concurrent.atomic.AtomicReference
+import kotlin.test.Test
+import kotlin.test.assertTrue
+import kotlin.test.fail
+import kotlinx.io.files.Path
+import kotlinx.io.files.SystemFileSystem
+
+/**
+ * Reproduces https://github.com/touchlab/Kermit/issues/480
+ *
+ * `RollingFileLogWriter.bufferLog` used to use [kotlinx.coroutines.channels.trySendBlocking] directly. That only avoids blocking while the
+ * channel has room; otherwise it falls back to `runBlocking { send(...) }`, and `runBlocking` throws [InterruptedException] immediately if
+ * the calling thread's interrupt flag is set.
+ *
+ * So logging from a thread that the platform has interrupted (Android sync adapters, `ExecutorService.shutdownNow()`, ...) crashed the
+ * caller. The reported stack trace was:
+ * ```
+ * java.lang.InterruptedException
+ *     kotlinx.coroutines.BlockingCoroutine.joinBlocking
+ *     kotlinx.coroutines.BuildersKt__BuildersKt.runBlocking
+ *     kotlinx.coroutines.channels.ChannelsKt__ChannelsKt.trySendBlocking
+ *     co.touchlab.kermit.io.RollingFileLogWriter.bufferLog
+ *     co.touchlab.kermit.io.RollingFileLogWriter.log
+ * ```
+ */
+class RollingFileLogWriterInterruptTest {
+
+    @Test
+    fun logFromInterruptedThreadDoesNotThrow() {
+        val dir = createTempDir()
+        try {
+            // rollOnSize = 0 plus a large maxLogFiles makes rollLogs() walk thousands of paths for every single message, so the writer
+            // coroutine drains the channel far slower than this thread can fill it. That keeps the channel buffer full, which is what
+            // deterministically forces the send onto its blocking path instead of relying on a race.
+            val writer = createWriter(dir, rollOnSize = 0, maxLogFiles = 20_000)
+
+            val thrown = AtomicReference<Throwable?>(null)
+            val interruptFlagSurvived = AtomicBoolean(false)
+            val logger = Thread {
+                repeat(LOGGING_CHANNEL_CAPACITY + 1) { writer.log(Severity.Info, "fill the channel buffer $it", "Tag", null) }
+
+                // Simulates the platform interrupting the logging thread (e.g. AbstractThreadedSyncAdapter cancelling a sync).
+                Thread.currentThread().interrupt()
+                try {
+                    // An attempt can still find a free slot if the writer just drained one, so keep logging until the buffer is full again.
+                    repeat(8) { writer.log(Severity.Info, "logged from an interrupted thread $it", "Tag", null) }
+                } catch (t: Throwable) {
+                    thrown.set(t)
+                } finally {
+                    // The logger must not swallow the caller's cancellation signal. Read the flag before clearing it for the test runner.
+                    interruptFlagSurvived.set(Thread.interrupted())
+                }
+            }
+
+            logger.start()
+            logger.join(30_000)
+            assertTrue(!logger.isAlive, "Logging thread did not finish")
+
+            val error = thrown.get()
+            if (error != null) {
+                fail("Logging from an interrupted thread threw '${error.message}'", error)
+            }
+            assertTrue(interruptFlagSurvived.get(), "Logging cleared the thread's interrupt flag")
+        } finally {
+            deleteRecursively(dir)
+        }
+    }
+
+    private fun createTempDir(): Path {
+        val base = Path(SystemFileSystem.resolve(Path(".")), "build", "tmp", "test-logs-interrupt-${randomSuffix()}")
+        SystemFileSystem.createDirectories(base)
+        return base
+    }
+
+    private fun randomSuffix(): String = (0..7).map { ('a'..'z').random() }.joinToString("")
+
+    private fun createWriter(dir: Path, rollOnSize: Long, maxLogFiles: Int): RollingFileLogWriter = RollingFileLogWriter(
+        config = RollingFileLogWriterConfig(
+            logFileName = "test",
+            logFilePath = dir,
+            rollOnSize = rollOnSize,
+            maxLogFiles = maxLogFiles,
+            prependTimestamp = false,
+            logTag = false,
+        ),
+    )
+
+    private fun deleteRecursively(dir: Path) {
+        try {
+            SystemFileSystem.list(dir).forEach { path ->
+                SystemFileSystem.delete(path)
+ 
```

**File**: `kermit-io/src/commonMain/kotlin/co/touchlab/kermit/io/ChannelSend.kt` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+/*
+ * Copyright (c) 2026 Touchlab
+ * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
+ */
+
+package co.touchlab.kermit.io
+
+import kotlinx.coroutines.channels.SendChannel
+
+/**
+ * Sends [element] to the channel, blocking the calling thread if the channel is full.
+ *
+ * This is [kotlinx.coroutines.channels.trySendBlocking] with one exception: a thread that has already been interrupted is never blocked.
+ * `trySendBlocking` falls back to `runBlocking` when the channel has no room, and `runBlocking` throws `InterruptedException` as soon as it
+ * sees the calling thread's interrupt flag, which crashes the caller instead of logging a message. An interrupted thread is being torn down
+ * anyway, so we drop the message rather than crash it or hold it up on file I/O.
+ *
+ * The element is silently discarded if it cannot be delivered without blocking such a thread, or if the channel is closed.
+ *
+ * See [issue #480](https://github.com/touchlab/Kermit/issues/480).
+ */
+internal expect fun <E> SendChannel<E>.sendBlockingUnlessInterrupted(element: E)
```

**File**: `kermit-io/src/commonMain/kotlin/co/touchlab/kermit/io/RollingFileLogWriter.kt` (modified, +11/-6)
```diff
@@ -28,7 +28,6 @@ import kotlinx.coroutines.DelicateCoroutinesApi
 import kotlinx.coroutines.ExperimentalCoroutinesApi
 import kotlinx.coroutines.SupervisorJob
 import kotlinx.coroutines.channels.Channel
-import kotlinx.coroutines.channels.trySendBlocking
 import kotlinx.coroutines.currentCoroutineContext
 import kotlinx.coroutines.isActive
 import kotlinx.coroutines.launch
@@ -55,9 +54,10 @@ import kotlinx.io.writeString
  * [RollingFileLogWriterConfig.prependTimestamp]
  *
  * Writes to the file are done by a different coroutine. The main reason for this is to make writes to the log file sink thread-safe, and
- * so that file rolling can be performed without additional synchronization or locking. The channel that buffers log messages is currently
- * unbuffered, so logging threads will block until the I/O is complete. However, buffering could easily be introduced to potentially
- * increase logging throughput. The envisioned usage scenarios for this class probably do not warrant this.
+ * so that file rolling can be performed without additional synchronization or locking. Log messages reach that coroutine through a channel
+ * that buffers up to [LOGGING_CHANNEL_CAPACITY] of them, so logging threads normally hand a message off and return without waiting for the
+ * I/O. Once that buffer is full, logging threads block until the writer catches up, which keeps memory bounded and limits how many messages
+ * can be lost if the process dies. Threads that have already been interrupted are never blocked -- see [sendBlockingUnlessInterrupted].
  *
  * The recommended way to obtain the logPath on Android is:
  * ```kotlin
@@ -113,7 +113,7 @@ open class RollingFileLogWriter(
             },
     )
 
-    private val loggingChannel: Channel<Buffer> = Channel()
+    private val loggingChannel: Channel<Buffer> = Channel(capacity = LOGGING_CHANNEL_CAPACITY)
 
     init {
         coroutineScope.launch {
@@ -143,7 +143,7 @@ open class RollingFileLogWriter(
                 appendLine(throwable.stackTraceToString())
             }
         }
-        loggingChannel.trySendBlocking(Buffer().apply { writeString(log) })
+        loggingChannel.sendBlockingUnlessInterrupted(Buffer().apply { writeString(log) })
     }
 
     private fun formatMessage(severity: Severity, tag: Tag?, message: Message): String =
@@ -249,3 +249,8 @@ open class RollingFileLogWriter(
 
     private fun fileSizeOrZero(path: Path) = fileSystem.metadataOrNull(path)?.size ?: 0
 }
+
+/**
+ * How many log messages [RollingFileLogWriter] buffers before logging threads have to wait for the writer coroutine to catch up.
+ */
+internal const val LOGGING_CHANNEL_CAPACITY = 64
```

**File**: `kermit-io/src/nativeMain/kotlin/co/touchlab/kermit/io/ChannelSend.kt` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+/*
+ * Copyright (c) 2026 Touchlab
+ * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
+ */
+
+package co.touchlab.kermit.io
+
+import kotlinx.coroutines.channels.SendChannel
+import kotlinx.coroutines.channels.trySendBlocking
+
+internal actual fun <E> SendChannel<E>.sendBlockingUnlessInterrupted(element: E) {
+    // Kotlin/Native has no thread interruption, so the runBlocking inside trySendBlocking cannot throw InterruptedException here.
+    trySendBlocking(element)
+}
```

---

### Incident Patch 3: `f644468a` (2026-02-12)
**Commit Message**: Fix `Logger.a` for Android target (#465)

**File**: `.github/workflows/build_mac.yml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ on:
 
 jobs:
   build:
-    runs-on: macos-13
+    runs-on: macos-latest
     steps:
       - name: Checkout the repo
         uses: actions/checkout@v2
```

**File**: `kermit-core/src/androidMain/kotlin/co/touchlab/kermit/LogcatWriter.kt` (modified, +7/-3)
```diff
@@ -29,7 +29,7 @@ class LogcatWriter(private val messageStringFormatter: MessageStringFormatter =
                     Severity.Info -> Log.i(tag, formattedMessage)
                     Severity.Warn -> Log.w(tag, formattedMessage)
                     Severity.Error -> Log.e(tag, formattedMessage)
-                    Severity.Assert -> Log.wtf(tag, formattedMessage)
+                    Severity.Assert -> Log.println(Log.ASSERT, tag, formattedMessage)
                 }
             } else {
                 when (severity) {
@@ -38,10 +38,14 @@ class LogcatWriter(private val messageStringFormatter: MessageStringFormatter =
                     Severity.Info -> Log.i(tag, formattedMessage, throwable)
                     Severity.Warn -> Log.w(tag, formattedMessage, throwable)
                     Severity.Error -> Log.e(tag, formattedMessage, throwable)
-                    Severity.Assert -> Log.wtf(tag, formattedMessage, throwable)
+                    Severity.Assert -> Log.println(
+                        Log.ASSERT,
+                        tag,
+                        "${formattedMessage}\n${Log.getStackTraceString(throwable)}",
+                    )
                 }
             }
-        } catch (e: Exception) {
+        } catch (_: Exception) {
             testWriter.log(severity, message, tag, throwable)
         }
     }
```

---

### Incident Patch 4: `d30c9f22` (2025-11-05)
**Commit Message**: Global logger overload resolution ambiguity (#459)

* Update Logger.kt

* Updating kermit API

**File**: `kermit/api/android/kermit.api` (modified, +0/-12)
```diff
@@ -55,23 +55,11 @@ public class co/touchlab/kermit/Logger : co/touchlab/kermit/BaseLogger {
 }
 
 public final class co/touchlab/kermit/Logger$Companion : co/touchlab/kermit/Logger {
-	public final fun a (Ljava/lang/String;Ljava/lang/Throwable;Lkotlin/jvm/functions/Function0;)V
-	public static synthetic fun a$default (Lco/touchlab/kermit/Logger$Companion;Ljava/lang/String;Ljava/lang/Throwable;Lkotlin/jvm/functions/Function0;ILjava/lang/Object;)V
 	public final fun addLogWriter ([Lco/touchlab/kermit/LogWriter;)V
-	public final fun d (Ljava/lang/String;Ljava/lang/Throwable;Lkotlin/jvm/functions/Function0;)V
-	public static synthetic fun d$default (Lco/touchlab/kermit/Logger$Companion;Ljava/lang/String;Ljava/lang/Throwable;Lkotlin/jvm/functions/Function0;ILjava/lang/Object;)V
-	public final fun e (Ljava/lang/String;Ljava/lang/Throwable;Lkotlin/jvm/functions/Function0;)V
-	public static synthetic fun e$default (Lco/touchlab/kermit/Logger$Companion;Ljava/lang/String;Ljava/lang/Throwable;Lkotlin/jvm/functions/Function0;ILjava/lang/Object;)V
 	public fun getTag ()Ljava/lang/String;
-	public final fun i (Ljava/lang/String;Ljava/lang/Throwable;Lkotlin/jvm/functions/Function0;)V
-	public static synthetic fun i$default (Lco/touchlab/kermit/Logger$Companion;Ljava/lang/String;Ljava/lang/Throwable;Lkotlin/jvm/functions/Function0;ILjava/lang/Object;)V
 	public final fun setLogWriters (Ljava/util/List;)V
 	public final fun setLogWriters ([Lco/touchlab/kermit/LogWriter;)V
 	public final fun setMinSeverity (Lco/touchlab/kermit/Severity;)V
 	public final fun setTag (Ljava/lang/String;)V
-	public final fun v (Ljava/lang/String;Ljava/lang/Throwable;Lkotlin/jvm/functions/Function0;)V
-	public static synthetic fun v$default (Lco/touchlab/kermit/Logger$Companion;Ljava/lang/String;Ljava/lang/Throwable;Lkotlin/jvm/functions/Function0;ILjava/lang/Object;)V
-	public final fun w (Ljava/lang/String;Ljava/lang/Throwable;Lkotlin/jvm/functions/Function0;)V
-	public static synthetic fun w$default (Lco/touchlab/kermit/Logger$Companion;Ljava/lang/String;Ljava/lang/Throwable;Lkotlin/jvm/functions/Function0;ILjava/lang/Object;)V
 }
 
```

**File**: `kermit/api/jvm/kermit.api` (modified, +0/-12)
```diff
@@ -55,23 +55,11 @@ public class co/touchlab/kermit/Logger : co/touchlab/kermit/BaseLogger {
 }
 
 public final class co/touchlab/kermit/Logger$Companion : co/touchlab/kermit/Logger {
-	public final fun a (Ljava/lang/String;Ljava/lang/Throwable;Lkotlin/jvm/functions/Function0;)V
-	public static synthetic fun a$default (Lco/touchlab/kermit/Logger$Companion;Ljava/lang/String;Ljava/lang/Throwable;Lkotlin/jvm/functions/Function0;ILjava/lang/Object;)V
 	public final fun addLogWriter ([Lco/touchlab/kermit/LogWriter;)V
-	public final fun d (Ljava/lang/String;Ljava/lang/Throwable;Lkotlin/jvm/functions/Function0;)V
-	public static synthetic fun d$default (Lco/touchlab/kermit/Logger$Companion;Ljava/lang/String;Ljava/lang/Throwable;Lkotlin/jvm/functions/Function0;ILjava/lang/Object;)V
-	public final fun e (Ljava/lang/String;Ljava/lang/Throwable;Lkotlin/jvm/functions/Function0;)V
-	public static synthetic fun e$default (Lco/touchlab/kermit/Logger$Companion;Ljava/lang/String;Ljava/lang/Throwable;Lkotlin/jvm/functions/Function0;ILjava/lang/Object;)V
 	public fun getTag ()Ljava/lang/String;
-	public final fun i (Ljava/lang/String;Ljava/lang/Throwable;Lkotlin/jvm/functions/Function0;)V
-	public static synthetic fun i$default (Lco/touchlab/kermit/Logger$Companion;Ljava/lang/String;Ljava/lang/Throwable;Lkotlin/jvm/functions/Function0;ILjava/lang/Object;)V
 	public final fun setLogWriters (Ljava/util/List;)V
 	public final fun setLogWriters ([Lco/touchlab/kermit/LogWriter;)V
 	public final fun setMinSeverity (Lco/touchlab/kermit/Severity;)V
 	public final fun setTag (Ljava/lang/String;)V
-	public final fun v (Ljava/lang/String;Ljava/lang/Throwable;Lkotlin/jvm/functions/Function0;)V
-	public static synthetic fun v$default (Lco/touchlab/kermit/Logger$Companion;Ljava/lang/String;Ljava/lang/Throwable;Lkotlin/jvm/functions/Function0;ILjava/lang/Object;)V
-	public final fun w (Ljava/lang/String;Ljava/lang/Throwable;Lkotlin/jvm/functions/Function0;)V
-	public static synthetic fun w$default (Lco/touchlab/kermit/Logger$Companion;Ljava/lang/String;Ljava/lang/Throwable;Lkotlin/jvm/functions/Function0;ILjava/lang/Object;)V
 }
 
```

**File**: `kermit/src/commonMain/kotlin/co/touchlab/kermit/Logger.kt` (modified, +0/-78)
```diff
@@ -225,84 +225,6 @@ open class Logger(config: LoggerConfig, open val tag: String = "") : BaseLogger(
         fun setTag(tag: String) {
             defaultTag = tag
         }
-
-        /**
-         * Log a message with [Severity.Verbose] using the global logger.
-         *
-         * @param tag Tag to associate with the log message.
-         * @param throwable Optional throwable to log.
-         * @param message Lambda returning the message to log.
-         */
-        fun v(tag: String, throwable: Throwable? = null, message: () -> String) {
-            if (config.minSeverity <= Severity.Verbose) {
-                log(Severity.Verbose, tag, throwable, message())
-            }
-        }
-
-        /**
-         * Log a message with [Severity.Debug] using the global logger.
-         *
-         * @param tag Tag to associate with the log message.
-         * @param throwable Optional throwable to log.
-         * @param message Lambda returning the message to log.
-         */
-        fun d(tag: String, throwable: Throwable? = null, message: () -> String) {
-            if (config.minSeverity <= Severity.Debug) {
-                log(Severity.Debug, tag, throwable, message())
-            }
-        }
-
-        /**
-         * Log a message with [Severity.Info] using the global logger.
-         *
-         * @param tag Tag to associate with the log message.
-         * @param throwable Optional throwable to log.
-         * @param message Lambda returning the message to log.
-         */
-        fun i(tag: String, throwable: Throwable? = null, message: () -> String) {
-            if (config.minSeverity <= Severity.Info) {
-                log(Severity.Info, tag, throwable, message())
-            }
-        }
-
-        /**
-         * Log a message with [Severity.Warn] using the global logger.
-         *
-         * @param tag Tag to associate with the log message.
-         * @param throwable Optional throwable to log.
-         * @param message Lambda returning the message to log.
-         */
-        fun w(tag: String, throwable: Throwable? = null, message: () -> String) {
-            if (config.minSeverity <= Severity.Warn) {
-                log(Severity.Warn, tag, throwable, message())
-            }
-        }
-
-        /**
-         * Log a message with [Severity.Error] using the global logger.
-         *
-         * @param tag Tag to associate with the log message.
-         * @param throwable Optional throwable to log.
-         * @param message Lambda returning the message to log.
-         */
-        fun e(tag: String, throwable: Throwable? = null, message: () -> String) {
-            if (config.minSeverity <= Severity.Error) {
-                log(Severity.Error, tag, throwable, message())
-            }
-        }
-
-        /**
-         * Log a message with [Severity.Assert] using the global logger.
-         *
-         * @param tag Tag to associate with the log message.
-         * @param throwable Optional throwable to log.
-         * @param message Lambda returning the message to log.
-         */
-        fun a(tag: String, throwable: Throwable? = null, message: () -> String) {
-            if (config.minSeverity <= Severity.Assert) {
-                log(Severity.Assert, tag, throwable, message())
-            }
-        }
     }
 }
 
```

---

### Incident Patch 5: `5bb62125` (2024-12-16)
**Commit Message**: Fix androidMain and jsAndWasmJsMain platformLogWriter implementation (#430)

* add messageStringFormatter in platformLogWriter androidMain implementation for LogcatWriter

* add messageStringFormatter in platformLogWriter jsAndWasmJsMain implementation for ConsoleWriter

**File**: `kermit-core/src/androidMain/kotlin/co/touchlab/kermit/platformLogWriter.kt` (modified, +1/-1)
```diff
@@ -10,4 +10,4 @@
 
 package co.touchlab.kermit
 
-actual fun platformLogWriter(messageStringFormatter: MessageStringFormatter): LogWriter = LogcatWriter()
+actual fun platformLogWriter(messageStringFormatter: MessageStringFormatter): LogWriter = LogcatWriter(messageStringFormatter)
```

**File**: `kermit-core/src/jsAndWasmJsMain/kotlin/co/touchlab/kermit/platformLogWriter.kt` (modified, +1/-1)
```diff
@@ -10,4 +10,4 @@
 
 package co.touchlab.kermit
 
-actual fun platformLogWriter(messageStringFormatter: MessageStringFormatter): LogWriter = ConsoleWriter()
\ No newline at end of file
+actual fun platformLogWriter(messageStringFormatter: MessageStringFormatter): LogWriter = ConsoleWriter(messageStringFormatter)
\ No newline at end of file
```

---

### Incident Patch 6: `1650e695` (2024-11-07)
**Commit Message**: Revert "Enable KLib ABI validation (#402)" (#411)

This reverts commit 4a0ea162771cbb0f9e0ae770db3cb9a71758dce9.

**File**: `build.gradle.kts` (modified, +0/-5)
```diff
@@ -26,11 +26,6 @@ plugins {
 
 }
 apiValidation {
-    @OptIn(kotlinx.validation.ExperimentalBCVApi::class)
-    klib {
-        enabled = true
-    }
-
     nonPublicMarkers.add("co.touchlab.kermit.ExperimentalKermitApi")
 //    ignoredProjects.addAll(listOf("kermit-gradle-plugin", "kermit-ir-plugin", "kermit-ir-plugin-native"))
 }
```

**File**: `extensions/kermit-bugsnag/api/kermit-bugsnag.klib.api` (removed, +0/-8)
```diff
@@ -1,8 +0,0 @@
-// Klib ABI Dump
-// Targets: [iosArm64, iosSimulatorArm64, iosX64, macosArm64, macosX64, tvosArm64, tvosSimulatorArm64, tvosX64, watchosArm32, watchosArm64, watchosDeviceArm64, watchosSimulatorArm64, watchosX64]
-// Rendering settings:
-// - Signature version: 2
-// - Show manifest properties: true
-// - Show declarations: true
-
-// Library unique name: <co.touchlab:kermit-bugsnag>
```

**File**: `extensions/kermit-crashlytics/api/kermit-crashlytics.klib.api` (removed, +0/-8)
```diff
@@ -1,8 +0,0 @@
-// Klib ABI Dump
-// Targets: [iosArm64, iosSimulatorArm64, iosX64, macosArm64, macosX64, tvosArm64, tvosSimulatorArm64, tvosX64, watchosArm32, watchosArm64, watchosDeviceArm64, watchosSimulatorArm64, watchosX64]
-// Rendering settings:
-// - Signature version: 2
-// - Show manifest properties: true
-// - Show declarations: true
-
-// Library unique name: <co.touchlab:kermit-crashlytics>
```

**File**: `extensions/kermit-koin/api/kermit-koin.klib.api` (removed, +0/-16)
```diff
@@ -1,16 +0,0 @@
-// Klib ABI Dump
-// Targets: [iosArm64, iosSimulatorArm64, iosX64, js, linuxX64, macosArm64, macosX64, mingwX64, tvosArm64, tvosSimulatorArm64, tvosX64, watchosArm64, watchosSimulatorArm64, watchosX64]
-// Rendering settings:
-// - Signature version: 2
-// - Show manifest properties: true
-// - Show declarations: true
-
-// Library unique name: <co.touchlab:kermit-koin>
-final class co.touchlab.kermit.koin/KermitKoinLogger : org.koin.core.logger/Logger { // co.touchlab.kermit.koin/KermitKoinLogger|null[0]
-    constructor <init>(co.touchlab.kermit/Logger) // co.touchlab.kermit.koin/KermitKoinLogger.<init>|<init>(co.touchlab.kermit.Logger){}[0]
-
-    final fun display(org.koin.core.logger/Level, kotlin/String) // co.touchlab.kermit.koin/KermitKoinLogger.display|display(org.koin.core.logger.Level;kotlin.String){}[0]
-}
-
-final fun co.touchlab.kermit.koin/kermitLoggerModule(co.touchlab.kermit/Logger): org.koin.core.module/Module // co.touchlab.kermit.koin/kermitLoggerModule|kermitLoggerModule(co.touchlab.kermit.Logger){}[0]
-final inline fun <#A: reified co.touchlab.kermit/Logger> (org.koin.core.scope/Scope).co.touchlab.kermit.koin/getLoggerWithTag(kotlin/String): #A // co.touchlab.kermit.koin/getLoggerWithTag|getLoggerWithTag@org.koin.core.scope.Scope(kotlin.String){0§<co.touchlab.kermit.Logger>}[0]
```

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ compileSdk = "34"
 
 # Dependencies
 kotlin = "1.9.22"
-binaryCompatability = "0.16.3"
+binaryCompatability = "0.13.2"
 
 androidx-core = "1.12.0"
 androidx-appcompat = "1.6.1"
```

**File**: `kermit-core/api/kermit-core.klib.api` (removed, +0/-190)
```diff
@@ -1,190 +0,0 @@
-// Klib ABI Dump
-// Targets: [androidNativeArm32, androidNativeArm64, androidNativeX64, androidNativeX86, iosArm64, iosSimulatorArm64, iosX64, js, linuxArm64, linuxX64, macosArm64, macosX64, mingwX64, tvosArm64, tvosSimulatorArm64, tvosX64, wasmJs, watchosArm32, watchosArm64, watchosDeviceArm64, watchosSimulatorArm64, watchosX64]
-// Alias: androidNative => [androidNativeArm32, androidNativeArm64, androidNativeX64, androidNativeX86]
-// Alias: apple => [iosArm64, iosSimulatorArm64, iosX64, macosArm64, macosX64, tvosArm64, tvosSimulatorArm64, tvosX64, watchosArm32, watchosArm64, watchosDeviceArm64, watchosSimulatorArm64, watchosX64]
-// Rendering settings:
-// - Signature version: 2
-// - Show manifest properties: true
-// - Show declarations: true
-
-// Library unique name: <co.touchlab:kermit-core>
-open annotation class co.touchlab.kermit/ExperimentalKermitApi : kotlin/Annotation { // co.touchlab.kermit/ExperimentalKermitApi|null[0]
-    constructor <init>() // co.touchlab.kermit/ExperimentalKermitApi.<init>|<init>(){}[0]
-}
-
-final enum class co.touchlab.kermit/Severity : kotlin/Enum<co.touchlab.kermit/Severity> { // co.touchlab.kermit/Severity|null[0]
-    enum entry Assert // co.touchlab.kermit/Severity.Assert|null[0]
-    enum entry Debug // co.touchlab.kermit/Severity.Debug|null[0]
-    enum entry Error // co.touchlab.kermit/Severity.Error|null[0]
-    enum entry Info // co.touchlab.kermit/Severity.Info|null[0]
-    enum entry Verbose // co.touchlab.kermit/Severity.Verbose|null[0]
-    enum entry Warn // co.touchlab.kermit/Severity.Warn|null[0]
-
-    final val entries // co.touchlab.kermit/Severity.entries|#static{}entries[0]
-        final fun <get-entries>(): kotlin.enums/EnumEntries<co.touchlab.kermit/Severity> // co.touchlab.kermit/Severity.entries.<get-entries>|<get-entries>#static(){}[0]
-
-    final fun valueOf(kotlin/String): co.touchlab.kermit/Severity // co.touchlab.kermit/Severity.valueOf|valueOf#static(kotlin.String){}[0]
-    final fun values(): kotlin/Array<co.touchlab.kermit/Severity> // co.touchlab.kermit/Severity.values|values#static(){}[0]
-}
-
-abstract interface co.touchlab.kermit/LoggerConfig { // co.touchlab.kermit/LoggerConfig|null[0]
-    abstract val logWriterList // co.touchlab.kermit/LoggerConfig.logWriterList|{}logWriterList[0]
-        abstract fun <get-logWriterList>(): kotlin.collections/List<co.touchlab.kermit/LogWriter> // co.touchlab.kermit/LoggerConfig.logWriterList.<get-logWriterList>|<get-logWriterList>(){}[0]
-    abstract val minSeverity // co.touchlab.kermit/LoggerConfig.minSeverity|{}minSeverity[0]
-        abstract fun <get-minSeverity>(): co.touchlab.kermit/Severity // co.touchlab.kermit/LoggerConfig.minSeverity.<get-minSeverity>|<get-minSeverity>(){}[0]
-}
-
-abstract interface co.touchlab.kermit/MessageStringFormatter { // co.touchlab.kermit/MessageStringFormatter|null[0]
-    open fun formatMessage(co.touchlab.kermit/Severity?, co.touchlab.kermit/Tag?, co.touchlab.kermit/Message): kotlin/String // co.touchlab.kermit/MessageStringFormatter.formatMessage|formatMessage(co.touchlab.kermit.Severity?;co.touchlab.kermit.Tag?;co.touchlab.kermit.Message){}[0]
-    open fun formatSeverity(co.touchlab.kermit/Severity): kotlin/String // co.touchlab.kermit/MessageStringFormatter.formatSeverity|formatSeverity(co.touchlab.kermit.Severity){}[0]
-    open fun formatTag(co.touchlab.kermit/Tag): kotlin/String // co.touchlab.kermit/MessageStringFormatter.formatTag|formatTag(co.touchlab.kermit.Tag){}[0]
-}
-
-abstract interface co.touchlab.kermit/MutableLoggerConfig : co.touchlab.kermit/LoggerConfig { // co.touchlab.kermit/MutableLoggerConfig|null[0]
-    abstract var logWriterList // co.touchlab.kermit/MutableLoggerConfig.logWriterList|{}logWriterList[0]
-        abstract fun <get-logWriterList>(): kotlin.collections/List<co.touchlab.kermit/LogWriter> // co.touchlab.kermit/MutableLoggerConfig.logWriterList.<get-logWriterList>|<get-logWriterList>(){}[0]
-        abstract fun <set-logWriterList>(kotlin.collections/List<co.touchlab.kermit/LogWriter>) // co.touchlab.kermit/MutableLoggerConfig.logWriterList.<set-logWriterList>|<set-logWriterList>(kotlin.collections.List<co.touchlab.kermit.LogWriter>){}[0]
-    abstract var minSeverity // co.touchlab.kermit/MutableLoggerConfig.minSeverity|{}minSeverity[0]
-        abstract fun <get-minSeverity>(): co.touchlab.kermit/Severity // co.touchlab.kermit/MutableLoggerConfig.minSeverity.<get-minSeverity>|<get-minSeverity>(){}[0]
-        abstract fun <set-minSeverity>(co.touchlab.kermit/Severity) // co.touchlab.kermit/MutableLoggerConfig.minSeverity.<set-minSeverity>|<set-minSeverity>(co.touchlab.kermit.Severity){}[0]
-}
-
-abstract class co.touchlab.kermit/LogWriter { // co.touchlab.kermit/LogWriter|null[0]
-    constructor <init>() // co.touchlab.kermit/LogWriter.<init>|<init>(){}[0]
-
-    abstract fun log(co.touchlab.kermit/Severity, kotlin/String, kotlin/String, kotlin/Throwable? =...) // co.touchlab.kermit/LogWr
```

**File**: `kermit-simple/api/kermit-simple.klib.api` (removed, +0/-57)
```diff
@@ -1,57 +0,0 @@
-// Klib ABI Dump
-// Targets: [androidNativeArm32, androidNativeArm64, androidNativeX64, androidNativeX86, iosArm64, iosSimulatorArm64, iosX64, js, linuxArm64, linuxX64, macosArm64, macosX64, mingwX64, tvosArm64, tvosSimulatorArm64, tvosX64, wasmJs, watchosArm32, watchosArm64, watchosDeviceArm64, watchosSimulatorArm64, watchosX64]
-// Rendering settings:
-// - Signature version: 2
-// - Show manifest properties: true
-// - Show declarations: true
-
-// Library unique name: <co.touchlab:kermit-simple>
-final fun (co.touchlab.kermit/Logger).co.touchlab.kermit/a(kotlin/Function0<kotlin/String>) // co.touchlab.kermit/a|a@co.touchlab.kermit.Logger(kotlin.Function0<kotlin.String>){}[0]
-final fun (co.touchlab.kermit/Logger).co.touchlab.kermit/a(kotlin/String) // co.touchlab.kermit/a|a@co.touchlab.kermit.Logger(kotlin.String){}[0]
-final fun (co.touchlab.kermit/Logger).co.touchlab.kermit/a(kotlin/String, kotlin/Throwable) // co.touchlab.kermit/a|a@co.touchlab.kermit.Logger(kotlin.String;kotlin.Throwable){}[0]
-final fun (co.touchlab.kermit/Logger).co.touchlab.kermit/a(kotlin/Throwable, kotlin/Function0<kotlin/String>) // co.touchlab.kermit/a|a@co.touchlab.kermit.Logger(kotlin.Throwable;kotlin.Function0<kotlin.String>){}[0]
-final fun (co.touchlab.kermit/Logger).co.touchlab.kermit/d(kotlin/Function0<kotlin/String>) // co.touchlab.kermit/d|d@co.touchlab.kermit.Logger(kotlin.Function0<kotlin.String>){}[0]
-final fun (co.touchlab.kermit/Logger).co.touchlab.kermit/d(kotlin/String) // co.touchlab.kermit/d|d@co.touchlab.kermit.Logger(kotlin.String){}[0]
-final fun (co.touchlab.kermit/Logger).co.touchlab.kermit/d(kotlin/String, kotlin/Throwable) // co.touchlab.kermit/d|d@co.touchlab.kermit.Logger(kotlin.String;kotlin.Throwable){}[0]
-final fun (co.touchlab.kermit/Logger).co.touchlab.kermit/d(kotlin/Throwable, kotlin/Function0<kotlin/String>) // co.touchlab.kermit/d|d@co.touchlab.kermit.Logger(kotlin.Throwable;kotlin.Function0<kotlin.String>){}[0]
-final fun (co.touchlab.kermit/Logger).co.touchlab.kermit/e(kotlin/Function0<kotlin/String>) // co.touchlab.kermit/e|e@co.touchlab.kermit.Logger(kotlin.Function0<kotlin.String>){}[0]
-final fun (co.touchlab.kermit/Logger).co.touchlab.kermit/e(kotlin/String) // co.touchlab.kermit/e|e@co.touchlab.kermit.Logger(kotlin.String){}[0]
-final fun (co.touchlab.kermit/Logger).co.touchlab.kermit/e(kotlin/String, kotlin/Throwable) // co.touchlab.kermit/e|e@co.touchlab.kermit.Logger(kotlin.String;kotlin.Throwable){}[0]
-final fun (co.touchlab.kermit/Logger).co.touchlab.kermit/e(kotlin/Throwable, kotlin/Function0<kotlin/String>) // co.touchlab.kermit/e|e@co.touchlab.kermit.Logger(kotlin.Throwable;kotlin.Function0<kotlin.String>){}[0]
-final fun (co.touchlab.kermit/Logger).co.touchlab.kermit/i(kotlin/Function0<kotlin/String>) // co.touchlab.kermit/i|i@co.touchlab.kermit.Logger(kotlin.Function0<kotlin.String>){}[0]
-final fun (co.touchlab.kermit/Logger).co.touchlab.kermit/i(kotlin/String) // co.touchlab.kermit/i|i@co.touchlab.kermit.Logger(kotlin.String){}[0]
-final fun (co.touchlab.kermit/Logger).co.touchlab.kermit/i(kotlin/String, kotlin/Throwable) // co.touchlab.kermit/i|i@co.touchlab.kermit.Logger(kotlin.String;kotlin.Throwable){}[0]
-final fun (co.touchlab.kermit/Logger).co.touchlab.kermit/i(kotlin/Throwable, kotlin/Function0<kotlin/String>) // co.touchlab.kermit/i|i@co.touchlab.kermit.Logger(kotlin.Throwable;kotlin.Function0<kotlin.String>){}[0]
-final fun (co.touchlab.kermit/Logger).co.touchlab.kermit/v(kotlin/Function0<kotlin/String>) // co.touchlab.kermit/v|v@co.touchlab.kermit.Logger(kotlin.Function0<kotlin.String>){}[0]
-final fun (co.touchlab.kermit/Logger).co.touchlab.kermit/v(kotlin/String) // co.touchlab.kermit/v|v@co.touchlab.kermit.Logger(kotlin.String){}[0]
-final fun (co.touchlab.kermit/Logger).co.touchlab.kermit/v(kotlin/String, kotlin/Throwable) // co.touchlab.kermit/v|v@co.touchlab.kermit.Logger(kotlin.String;kotlin.Throwable){}[0]
-final fun (co.touchlab.kermit/Logger).co.touchlab.kermit/v(kotlin/Throwable, kotlin/Function0<kotlin/String>) // co.touchlab.kermit/v|v@co.touchlab.kermit.Logger(kotlin.Throwable;kotlin.Function0<kotlin.String>){}[0]
-final fun (co.touchlab.kermit/Logger).co.touchlab.kermit/w(kotlin/Function0<kotlin/String>) // co.touchlab.kermit/w|w@co.touchlab.kermit.Logger(kotlin.Function0<kotlin.String>){}[0]
-final fun (co.touchlab.kermit/Logger).co.touchlab.kermit/w(kotlin/String) // co.touchlab.kermit/w|w@co.touchlab.kermit.Logger(kotlin.String){}[0]
-final fun (co.touchlab.kermit/Logger).co.touchlab.kermit/w(kotlin/String, kotlin/Throwable) // co.touchlab.kermit/w|w@co.touchlab.kermit.Logger(kotlin.String;kotlin.Throwable){}[0]
-final fun (co.touchlab.kermit/Logger).co.touchlab.kermit/w(kotlin/Throwable, kotlin/Function0<kotlin/String>) // co.touchlab.kermit/w|w@co.touchlab.kermit.Logger(kotlin.Throwable;kotlin.Function0<kotlin.String>){}[0]
-final fun co.touchlab.kermit/a(kotlin/Function0<kotlin/String>) // co.touchlab.kermit/a|a(kotli
```

**File**: `kermit-test/api/kermit-test.klib.api` (removed, +0/-8)
```diff
@@ -1,8 +0,0 @@
-// Klib ABI Dump
-// Targets: [androidNativeArm32, androidNativeArm64, androidNativeX64, androidNativeX86, iosArm64, iosSimulatorArm64, iosX64, js, linuxArm64, linuxX64, macosArm64, macosX64, mingwX64, tvosArm64, tvosSimulatorArm64, tvosX64, wasmJs, watchosArm32, watchosArm64, watchosDeviceArm64, watchosSimulatorArm64, watchosX64]
-// Rendering settings:
-// - Signature version: 2
-// - Show manifest properties: true
-// - Show declarations: true
-
-// Library unique name: <co.touchlab:kermit-test>
```

---

### Incident Patch 7: `f124f6f9` (2024-06-07)
**Commit Message**: Dont sign test builds (#398)

* Don't sign the local publish in tests

* Update workflow

**File**: `.github/workflows/build.yml` (modified, +1/-3)
```diff
@@ -62,10 +62,8 @@ jobs:
           CI: "true"
       - name: Local Publish For Samples
         if: matrix.os == 'macOS-latest'
-        run: ./gradlew publishToMavenLocal --no-daemon --stacktrace --build-cache
+        run: ./gradlew publishToMavenLocal --no-daemon --stacktrace --build-cache -PRELEASE_SIGNING_ENABLED=false
         env:
-          ORG_GRADLE_PROJECT_SIGNING_KEY: ${{ secrets.SIGNING_KEY }}
-          ORG_GRADLE_PROJECT_signingInMemoryKey: ${{ secrets.SIGNING_KEY }}
           S3_BUILD_CACHE_AWS_REGION: ${{ secrets.S3_BUILD_CACHE_AWS_REGION }}
           S3_BUILD_CACHE_BUCKET_NAME: ${{ secrets.S3_BUILD_CACHE_BUCKET_NAME }}
           S3_BUILD_CACHE_ACCESS_KEY_ID: ${{ secrets.S3_BUILD_CACHE_ACCESS_KEY_ID }}
```

**File**: `gradle/gradle-mvn-mpp-push.gradle` (modified, +7/-1)
```diff
@@ -19,10 +19,16 @@ def getAwsSecretKey() {
   return hasProperty('AWS_SECRET_KEY') ? AWS_SECRET_KEY :
           ""
 }
+
 def isReleaseBuild() {
   return VERSION_NAME.contains("SNAPSHOT") == false
 }
 
+def releaseSigningRequired() {
+  def enabled = hasProperty('RELEASE_SIGNING_ENABLED') ? RELEASE_SIGNING_ENABLED : false
+  return isReleaseBuild() && gradle.taskGraph.hasTask("uploadArchives") && enabled
+}
+
 def getReleaseRepositoryUrl() {
   return hasProperty('RELEASE_REPOSITORY_URL') ? RELEASE_REPOSITORY_URL :
           "https://oss.sonatype.org/service/local/staging/deploy/maven2/"
@@ -53,7 +59,7 @@ def getGpgKey() {
 }
 
 signing {
-  required { isReleaseBuild() && gradle.taskGraph.hasTask("uploadArchives") }
+  required { releaseSigningRequired() }
   def gpgKey = getGpgKey()
   if(gpgKey != "") {
     useInMemoryPgpKeys(getGpgKey(), "")
```

---

### Incident Patch 8: `175edb8b` (2023-09-20)
**Commit Message**: Fix website deployment (#368)

**File**: `.github/workflows/websitedeploy.yml` (modified, +2/-2)
```diff
@@ -11,7 +11,7 @@ jobs:
       - uses: actions/setup-java@v2
         with:
           distribution: "adopt"
-          java-version: "11"
+          java-version: "17"
 
       - name: Validate Gradle Wrapper
         uses: gradle/wrapper-validation-action@v1
@@ -31,7 +31,7 @@ jobs:
       - name: Build Dokka
         run: ./gradlew dokkaHtmlMultiModule --no-daemon --stacktrace
         env:
-          GRADLE_OPTS: -Dkotlin.incremental=false -Dorg.gradle.jvmargs="-Xmx3g -XX:MaxPermSize=2048m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8 -XX:MaxMetaspaceSize=512m"
+          GRADLE_OPTS: -Dkotlin.incremental=false -Dorg.gradle.jvmargs="-Xmx3g -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8 -XX:MaxMetaspaceSize=512m"
 
       - name: Copy Dokka
         run: |
```

---

### Incident Patch 9: `ae2b4e88` (2023-09-20)
**Commit Message**: Formatting fixes (#367)

**File**: `gradle/libs.versions.toml` (modified, +2/-2)
```diff
@@ -15,7 +15,7 @@ androidx-navigationUI = "2.7.2"
 androidx-coordinatorLayout = "1.2.0"
 
 android-gradle-plugin = "8.1.1"
-android-test-runner="1.5.2"
+android-test-runner = "1.5.2"
 
 google-services = "4.3.15"
 
@@ -55,7 +55,7 @@ google-services = { module = "com.google.gms:google-services", version.ref = "go
 crashkios-crashlytics = { module = "co.touchlab.crashkios:crashlytics", version.ref = "crashkios" }
 crashkios-bugsnag = { module = "co.touchlab.crashkios:bugsnag", version.ref = "crashkios" }
 bugsnag-android = { module = "com.bugsnag:bugsnag-android", version.ref = "bugsnag" }
-stately-collections = { module = "co.touchlab:stately-collections", version.ref = "stately"}
+stately-collections = { module = "co.touchlab:stately-collections", version.ref = "stately" }
 testhelp = { module = "co.touchlab:testhelp", version.ref = "testhelp" }
 
 koin = { module = "io.insert-koin:koin-core", version.ref = "koin-core" }
```

**File**: `kermit-core/build.gradle.kts` (modified, +4/-1)
```diff
@@ -50,7 +50,7 @@ kotlin {
     androidNativeArm64()
     androidNativeX86()
     androidNativeX64()
-    
+
     sourceSets {
         val commonMain by getting
         val commonTest by getting {
@@ -115,14 +115,17 @@ kotlin {
                         val linuxMain by getting
                         linuxMain
                     }
+
                     konanTarget.family == org.jetbrains.kotlin.konan.target.Family.MINGW -> {
                         val mingwMain by getting
                         mingwMain
                     }
+
                     konanTarget.family == org.jetbrains.kotlin.konan.target.Family.ANDROID -> {
                         val androidNativeMain by getting
                         androidNativeMain
                     }
+
                     else -> nativeMain
                 }
             )
```

**File**: `kermit-core/src/androidMain/kotlin/co/touchlab/kermit/LogcatWriter.kt` (modified, +4/-4)
```diff
@@ -22,17 +22,17 @@ class LogcatWriter(private val messageStringFormatter: MessageStringFormatter =
     override fun log(severity: Severity, message: String, tag: String, throwable: Throwable?) {
         val formattedMessage = messageStringFormatter.formatMessage(null, null, Message(message))
         try {
-            if(throwable == null){
-                when(severity){
+            if (throwable == null) {
+                when (severity) {
                     Severity.Verbose -> Log.v(tag, formattedMessage)
                     Severity.Debug -> Log.d(tag, formattedMessage)
                     Severity.Info -> Log.i(tag, formattedMessage)
                     Severity.Warn -> Log.w(tag, formattedMessage)
                     Severity.Error -> Log.e(tag, formattedMessage)
                     Severity.Assert -> Log.wtf(tag, formattedMessage)
                 }
-            }else{
-                when(severity){
+            } else {
+                when (severity) {
                     Severity.Verbose -> Log.v(tag, formattedMessage, throwable)
                     Severity.Debug -> Log.d(tag, formattedMessage, throwable)
                     Severity.Info -> Log.i(tag, formattedMessage, throwable)
```

**File**: `kermit-core/src/androidUnitTest/kotlin/co/touchlab/kermit/LogcatLoggerTest.kt` (modified, +2/-2)
```diff
@@ -84,8 +84,8 @@ class LogcatLoggerTest {
 
         ShadowLog.getLogs().apply {
             assert(size > 0)
-            assertNotNull(find { it?.throwable?.message?.contains("Root Exception Message")?:false })
-            assertNotNull(find { it?.throwable?.cause?.message?.contains("Cause Exception Message")?:false })
+            assertNotNull(find { it?.throwable?.message?.contains("Root Exception Message") ?: false })
+            assertNotNull(find { it?.throwable?.cause?.message?.contains("Cause Exception Message") ?: false })
         }
     }
 }
```

**File**: `kermit-core/src/commonJvmMain/kotlin/co/touchlab/kermit/KermitConfig.kt` (modified, +2/-1)
```diff
@@ -13,4 +13,5 @@
 
 package co.touchlab.kermit
 
-actual fun mutableLoggerConfigInit(logWriters: List<LogWriter>): MutableLoggerConfig = JvmMutableLoggerConfig(logWriters)
\ No newline at end of file
+actual fun mutableLoggerConfigInit(logWriters: List<LogWriter>): MutableLoggerConfig =
+    JvmMutableLoggerConfig(logWriters)
\ No newline at end of file
```

**File**: `kermit-core/src/commonJvmTest/kotlin/co/touchlab/kermit/LoggerFunctionsTest.kt` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ class LoggerFunctionsTest {
 
     @Test
     @Ignore
-    fun tagsWork(){
+    fun tagsWork() {
         TODO()
         /*val testLogWriter = getTestLogWriter()
         Logger.apply {
```

**File**: `kermit-core/src/commonMain/kotlin/co/touchlab/kermit/BaseLogger.kt` (modified, +1/-3)
```diff
@@ -10,11 +10,9 @@
  * or implied. See the License for the specific language governing permissions and limitations under
  * the License.
  */
-@file:Suppress("NOTHING_TO_INLINE")
-
 package co.touchlab.kermit
 
-typealias MessageBlock = ()->String
+typealias MessageBlock = () -> String
 
 /**
  * Base class for public Logger API. Extend to implement your own logger API.
```

**File**: `kermit-core/src/commonMain/kotlin/co/touchlab/kermit/ExperimentalKermitApi.kt` (modified, +1/-1)
```diff
@@ -11,4 +11,4 @@
 package co.touchlab.kermit
 
 @RequiresOptIn(level = RequiresOptIn.Level.WARNING)
-annotation class ExperimentalKermitApi()
+annotation class ExperimentalKermitApi
```

---

### Incident Patch 10: `d536d6f7` (2023-09-20)
**Commit Message**: Add linuxArm64 (#366)

**File**: `gradle/libs.versions.toml` (modified, +1/-3)
```diff
@@ -87,6 +87,4 @@ android = [
     "androidx-navigationFragment",
     "androidx-navigationUI",
     "androidx-coordinatorLayout",
-]
-
-
+]
\ No newline at end of file
```

**File**: `kermit-core/build.gradle.kts` (modified, +1/-0)
```diff
@@ -44,6 +44,7 @@ kotlin {
 
     mingwX64()
     linuxX64()
+    linuxArm64()
 
     androidNativeArm32()
     androidNativeArm64()
```

**File**: `kermit-simple/build.gradle.kts` (modified, +1/-0)
```diff
@@ -39,6 +39,7 @@ kotlin {
 
     mingwX64()
     linuxX64()
+    linuxArm64()
 
     androidNativeArm32()
     androidNativeArm64()
```

**File**: `kermit-test/build.gradle.kts` (modified, +1/-0)
```diff
@@ -44,6 +44,7 @@ kotlin {
 
     mingwX64()
     linuxX64()
+    linuxArm64()
 
     androidNativeArm32()
     androidNativeArm64()
```

**File**: `kermit/build.gradle.kts` (modified, +1/-0)
```diff
@@ -44,6 +44,7 @@ kotlin {
 
     mingwX64()
     linuxX64()
+    linuxArm64()
 
     androidNativeArm32()
     androidNativeArm64()
```

---

### Incident Patch 11: `b9b79b0a` (2023-06-24)
**Commit Message**: fix: enable mingwx64 target since is available also in koin (#345)

**File**: `extensions/kermit-koin/build.gradle.kts` (modified, +2/-0)
```diff
@@ -44,6 +44,8 @@ kotlin {
 
     mingwX64()
 
+    mingwX64()
+
     // TODO: These targets aren't supported by Koin yet:
     // mingwX86()
     // androidNativeArm32()
```

---

### Incident Patch 12: `b6145083` (2023-06-24)
**Commit Message**: Fix typo (#356)

**File**: `website/docs/index.md` (modified, +1/-1)
```diff
@@ -88,7 +88,7 @@ To log from non-Kotlin clients, that don't support calling Kotlin's default para
 
 :::
 
-For each severity, there are two methods. One takes a `String` log message directly, the other takes a function parameter that returns a string. The function is only evaluated if the log will be written. Which you use is personal preference. They both will log to the same places, but the function paramter version may avoid unecessary `String` creation and evaluation.
+For each severity, there are two methods. One takes a `String` log message directly, the other takes a function parameter that returns a string. The function is only evaluated if the log will be written. Which you use is personal preference. They both will log to the same places, but the function parameter version may avoid unecessary `String` creation and evaluation.
 
 Here are what the `w` method definitions look like:
 
```

---

### Incident Patch 13: `7f30c1f3` (2023-06-24)
**Commit Message**: Clarified where the setCrashlyticsUnhandledExceptionHook() method codes from in the docs, and fixed the code sample. (#355)

**File**: `extensions/kermit-crashlytics/README.md` (modified, +4/-3)
```diff
@@ -38,8 +38,9 @@ a gap where some other failure may happen but logging is not capturing info.
 
 ### iOS
 
-For iOS, besides regular logging, you will also want to configure Kotlin's uncaught exception handling. `kermit-crashlytics` 
-provides the `setCrashlyticsUnhandledExceptionHook` helper function to handle this for you.
+For iOS, besides regular logging, you will also want to configure Kotlin's uncaught exception handling.  This is
+done via the underlying [CrashKiOS](https://github.com/touchlab/CrashKiOS) library which provides the 
+`setCrashlyticsUnhandledExceptionHook` helper function to handle this for you.
 
 If you don't need to make kermit logging calls from Swift/Objective C code, we recommend not exporting Kermit in the 
 framework exposed to your iOS app. To setup Kermit configuration you can make a top level helper method in
@@ -51,7 +52,7 @@ almost always the best option. Here is a basic example.
 // in Kermit/AppInit.kt
 fun setupKermit() {
     Logger.addLogWriter(CrashlyticsLogWriter())
-    setCrashlyticsUnhandledExceptionHook(Logger)
+    setCrashlyticsUnhandledExceptionHook()
 }
 ```
 
```

---

### Incident Patch 14: `8d5c8795` (2023-04-04)
**Commit Message**: Fix api dump (#343)

* Fix api dump

* Disable sample script for now

**File**: `.github/workflows/build.yml` (modified, +10/-10)
```diff
@@ -66,16 +66,16 @@ jobs:
           S3_BUILD_CACHE_ACCESS_KEY_ID: ${{ secrets.S3_BUILD_CACHE_ACCESS_KEY_ID }}
           S3_BUILD_CACHE_SECRET_KEY: ${{ secrets.S3_BUILD_CACHE_SECRET_KEY }}
           CI: "true"
-      - name: script
-        if: matrix.os == 'macOS-latest'
-        env:
-          S3_BUILD_CACHE_AWS_REGION: ${{ secrets.S3_BUILD_CACHE_AWS_REGION }}
-          S3_BUILD_CACHE_BUCKET_NAME: ${{ secrets.S3_BUILD_CACHE_BUCKET_NAME }}
-          S3_BUILD_CACHE_ACCESS_KEY_ID: ${{ secrets.S3_BUILD_CACHE_ACCESS_KEY_ID }}
-          S3_BUILD_CACHE_SECRET_KEY: ${{ secrets.S3_BUILD_CACHE_SECRET_KEY }}
-          CI: "true"
-        run: ./ci-test-samples.sh
-        shell: bash
+#      - name: script
+#        if: matrix.os == 'macOS-latest'
+#        env:
+#          S3_BUILD_CACHE_AWS_REGION: ${{ secrets.S3_BUILD_CACHE_AWS_REGION }}
+#          S3_BUILD_CACHE_BUCKET_NAME: ${{ secrets.S3_BUILD_CACHE_BUCKET_NAME }}
+#          S3_BUILD_CACHE_ACCESS_KEY_ID: ${{ secrets.S3_BUILD_CACHE_ACCESS_KEY_ID }}
+#          S3_BUILD_CACHE_SECRET_KEY: ${{ secrets.S3_BUILD_CACHE_SECRET_KEY }}
+#          CI: "true"
+#        run: ./ci-test-samples.sh
+#        shell: bash
 
 env:
   GRADLE_OPTS: -Dkotlin.incremental=false -Dorg.gradle.jvmargs="-Xmx3g -XX:MaxPermSize=2048m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8 -XX:MaxMetaspaceSize=512m"
```

**File**: `kermit-core/api/android/kermit-core.api` (modified, +0/-1)
```diff
@@ -39,7 +39,6 @@ public final class co/touchlab/kermit/LogcatWriter : co/touchlab/kermit/LogWrite
 	public fun <init> ()V
 	public fun <init> (Lco/touchlab/kermit/MessageStringFormatter;)V
 	public synthetic fun <init> (Lco/touchlab/kermit/MessageStringFormatter;ILkotlin/jvm/internal/DefaultConstructorMarker;)V
-	public fun isLoggable (Ljava/lang/String;Lco/touchlab/kermit/Severity;)Z
 	public fun log (Lco/touchlab/kermit/Severity;Ljava/lang/String;Ljava/lang/String;Ljava/lang/Throwable;)V
 }
 
```

---

### Incident Patch 15: `b1058de2` (2023-03-31)
**Commit Message**: Fix logcat debug and verbose (#342)

**File**: `gradle.properties` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ org.gradle.jvmargs=-Xmx2g
 SONATYPE_HOST=DEFAULT
 RELEASE_SIGNING_ENABLED=true
 GROUP=co.touchlab
-VERSION_NAME=2.0.0-RC3
+VERSION_NAME=2.0.0-RC4
 KOTLIN_VERSION=1.8.10
 
 POM_NAME=Kermit
```

**File**: `kermit-core/src/androidMain/kotlin/co/touchlab/kermit/LogcatWriter.kt` (modified, +0/-13)
```diff
@@ -19,19 +19,6 @@ class LogcatWriter(private val messageStringFormatter: MessageStringFormatter =
     // When running unit tests, Log calls will fail. Back up to a common writer
     private val testWriter: CommonWriter = CommonWriter(messageStringFormatter)
 
-    private fun getSeverity(severity: Severity) = when (severity) {
-        Severity.Verbose -> Log.VERBOSE
-        Severity.Debug -> Log.DEBUG
-        Severity.Info -> Log.INFO
-        Severity.Warn -> Log.WARN
-        Severity.Error -> Log.ERROR
-        Severity.Assert -> Log.ASSERT
-    }
-
-    override fun isLoggable(tag: String, severity: Severity): Boolean {
-        return Log.isLoggable(tag, getSeverity(severity))
-    }
-
     override fun log(severity: Severity, message: String, tag: String, throwable: Throwable?) {
         val formattedMessage = messageStringFormatter.formatMessage(null, null, Message(message))
         try {
```

#### Recent Merged Pull Requests:
- **PR #489** (2026-09-16): Adding coil to sample (@KevinSchildhorn)
- **PR #488** (2026-09-15): Improving Karma config to avoid timeout errors on KotlinJS tests (@faogustavo)
- **PR #487** (2026-09-29): Add Kotlin 2.0+ support for Gradle and IR compiler plugin (#435) (@kareemessam09)
- **PR #486** (2026-09-08): Release 2.2.0 (@KevinSchildhorn)
- **PR #485** (2026-08-24): Manually wiring Android API dump (@faogustavo)
- **PR #484** (2026-08-14): WasmWasi Support (@faogustavo)
- **PR #483** (2026-08-14): Fixed issues with rolling file and thread interruption (@faogustavo)
- **PR #482** (closed): Version 2.1.1 (@KevinSchildhorn)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
