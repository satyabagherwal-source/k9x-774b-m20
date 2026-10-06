# Forensic Learning Record (Deep Inspection): JetBrains/kotlinconf-app

> **Canonical Artifact**: `07_PROJECT_LEARNING/jetbrains-kotlinconf-app-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/JetBrains/kotlinconf-app](https://github.com/JetBrains/kotlinconf-app))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:09:18.727Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `JetBrains/kotlinconf-app`
- **Description**: The official KotlinConf application
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3565 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `app/shared/src/androidMain/kotlin/org/jetbrains/kotlinconf/utils/AndroidLogger.kt`
```
package org.jetbrains.kotlinconf.utils

import android.util.Log

class AndroidLogger : Logger {
    override fun log(tag: String, lazyMessage: () -> String) {
        Log.w(tag, lazyMessage())
    }
}

```

### Core Architecture Module: `app/shared/src/androidMain/kotlin/org/jetbrains/kotlinconf/utils/StoreUrl.android.kt`
```
package org.jetbrains.kotlinconf.utils

import org.jetbrains.kotlinconf.URLs

actual fun getStoreUrl(): String? = URLs.PLAY_STORE

```

### Core Architecture Module: `app/shared/src/commonMain/kotlin/org/jetbrains/kotlinconf/SessionState.kt`
```
package org.jetbrains.kotlinconf

import kotlinx.datetime.LocalDateTime

enum class SessionState {
    Live,
    Past,
    Upcoming,
    ;

    companion object {
        fun from(startsAt: LocalDateTime, endsAt: LocalDateTime, now: LocalDateTime): SessionState = when {
            startsAt <= now && now < endsAt -> Live
            endsAt <= now -> Past
            else -> Upcoming
        }
    }
}

```

### Core Architecture Module: `app/shared/src/commonMain/kotlin/org/jetbrains/kotlinconf/navigation/NavState.kt`
```
package org.jetbrains.kotlinconf.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSerializable
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.runtime.toMutableStateList
import androidx.lifecycle.viewmodel.navigation3.rememberViewModelStoreNavEntryDecorator
import androidx.navigation3.runtime.NavEntry
import androidx.navigation3.runtime.rememberDecoratedNavEntries
import androidx.navigation3.runtime.rememberSaveableStateHolderNavEntryDecorator
import androidx.savedstate.compose.serialization.serializers.SnapshotStateListSerializer

@Composable
fun rememberNavState(
    startRoute: AppRoute,
    primaryTopLevelRoute: TopLevelRoute,
    topLevelRoutes: Set<TopLevelRoute>,
): NavState {

    val topLevelBackstacks: Map<TopLevelRoute, SnapshotStateList<AppRoute>> = buildMap {
        topLevelRoutes.forEach { route ->
            put(route, rememberSerializable(serializer = SnapshotStateListSerializer()) {
                mutableStateListOf(route)
            })
        }
    }

    val defaultBackstack = rememberSerializable(serializer = SnapshotStateListSerializer()) {
        if (startRoute !is TopLevelRoute) {
            mutableStateListOf(startRoute)
        } else {
            mutableStateListOf()
        }
    }

    val currentBackstack = rememberSerializable(serializer = SnapshotStateListSerializer()) {
        val restoredBackstack = if (startRoute is TopLevelRoute) {
            topLevelBackstacks[startRoute]!!
        } else {
            defaultBackstack
        }
        restoredBackstack.toMutableStateList()
    }

    return remember(startRoute, topLevelRoutes) {
        NavState(
            primaryTopLevelRoute = primaryTopLevelRoute,
            topLevelBackStacks = topLevelBackstacks,
            defaultBackstack = defaultBackstack,
            currentBackstack = currentBackstack,
        )
    }
}

class NavState(
    val topLevelBackStacks: Map<TopLevelRoute, SnapshotStateList<AppRoute>>,
    val defaultBackstack: SnapshotStateList<AppRoute>,
    val primaryTopLevelRoute: TopLevelRoute,
    val currentBackstack: SnapshotStateList<AppRoute>,
) {

    var topLevelRoute: TopLevelRoute?
        get() = currentBackstack.firstOrNull() as? TopLevelRoute
        set(value) {
            val oldRoute = topLevelRoute

            // Save current backstack to the old route's storage
            val oldStorage = if (oldRoute != null) topLevelBackStacks[oldRoute]!! else defaultBackstack
            oldStorage.clear()
            oldStorage.addAll(currentBackstack)

            // Load new route's backstack into currentBackstack
            val newStorage = if (value != null) topLevelBackStacks[value]!! else defaultBackstack
            currentBackstack.clear()
            currentBackstack.addAll(newStorage)
        }

    @Composable
    fun toDecoratedEntries(
        entryProvider: (AppRoute) -> NavEntry<AppRoute>
    ): SnapshotStateList<NavEntry<AppRoute>> {
        val decorators = listOf(
            rememberSaveableStateHolderNavEntryDecorator<AppRoute>(),
            rememberViewModelStoreNavEntryDecorator(),
        )

        val topLevelEntries = topLevelBackStacks
            .mapValues { (route, stack) ->
                rememberDecoratedNavEntries(
                    backStack = if (route == topLevelRoute) currentBackstack else stack,
                    entryDecorators = decorators,
                    entryProvider = entryProvider
                )
            }
            .withDefault { emptyList() }

        val defaultEntries = rememberDecoratedNavEntries(
            backStack = if (topLevelRoute == null) currentBackstack else defaultBackstack,
            entryDecorators = decorators,
            entryProvider = entryProvider,
        )

        return when (val topRoute = topLevelRoute) {
            null -> defaultEntries
            primaryTopLevelRoute -> topLevelEntries.getValue(primaryTopLevelRoute)
            else -> topLevelEntries.getValue(primaryTopLevelRoute) + topLevelEntries.getValue(topRoute)
        }.toMutableStateList()
    }
}

```

### Core Architecture Module: `app/shared/src/commonMain/kotlin/org/jetbrains/kotlinconf/utils/BufferedDelegatingLogger.kt`
```
package org.jetbrains.kotlinconf.utils

import dev.zacsweers.metro.AppScope
import dev.zacsweers.metro.ContributesBinding
import dev.zacsweers.metro.Inject
import dev.zacsweers.metro.SingleIn
import dev.zacsweers.metro.binding
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * A logger that's constructed during startup and later attached to a real logger.
 * Until attached, it buffers log entries in memory. When [attach] is called,
 * it forwards the buffered entries to the attached logger in order, and from
 * that point on it delegates all calls directly.
 */
@SingleIn(AppScope::class)
@ContributesBinding(AppScope::class, binding<Logger>())
class BufferedDelegatingLogger(
    private val scope: CoroutineScope,
) : Logger, LogExporter {
    private var delegate: Logger? = null

    private data class Entry(val tag: String, val lazyMessage: () -> String)

    private val mutex = Mutex()

    private val buffer = mutableListOf<Entry>()

    override fun log(tag: String, lazyMessage: () -> String) {
        val current = delegate
        if (current != null) {
            current.log(tag, lazyMessage)
            return
        }

        scope.launch {
            mutex.withLock {
                buffer += Entry(tag, lazyMessage)
                while (buffer.size > MAX_LOG_MESSAGES_IN_MEMORY) {
                    buffer.removeAt(0)
                }
            }
        }
    }

    override fun getAllLogs(): String? = (delegate as? LogExporter)?.getAllLogs()

    fun attach(realLogger: Logger) {
        require(delegate == null) { "Logger delegate was already set, this should only happen once" }

        delegate = realLogger

        scope.launch {
            mutex.withLock {
                buffer.forEach { entry ->
                    realLogger.log(entry.tag, entry.lazyMessage)
                }
                buffer.clear()
            }
        }
    }
}

```

### Core Architecture Module: `app/shared/src/commonMain/kotlin/org/jetbrains/kotlinconf/utils/DateTimeFormatting.kt`
```
package org.jetbrains.kotlinconf.utils

import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.format
import kotlinx.datetime.format.MonthNames
import kotlinx.datetime.format.Padding
import kotlinx.datetime.format.char

object DateTimeFormatting {
    private val timeFormat = LocalDateTime.Format {
        hour(padding = Padding.ZERO)
        char(':')
        minute(padding = Padding.ZERO)
    }

    private val dateFormat = LocalDate.Format {
        monthName(MonthNames.ENGLISH_FULL)
        char(' ')
        day(padding = Padding.ZERO)
    }

    private val monthFormat = LocalDate.Format {
        monthName(MonthNames.ENGLISH_FULL)
    }

    private val dateWithYearFormat = LocalDateTime.Format {
        monthName(MonthNames.ENGLISH_FULL)
        char(' ')
        day(padding = Padding.ZERO)
        chars(", ")
        year()
    }

    internal fun time(dateTime: LocalDateTime): String = dateTime.format(timeFormat)

    internal fun date(dateTime: LocalDateTime): String = date(dateTime.date)

    internal fun date(date: LocalDate): String = date.format(dateFormat)

    internal fun month(date: LocalDate): String = date.format(monthFormat)

    internal fun dateWithYear(dateTime: LocalDateTime): String = dateTime.format(dateWithYearFormat)

    internal fun timeToTime(start: LocalDateTime, end: LocalDateTime): String = "${time(start)} – ${time(end)}"

    internal fun dateAndTime(dateTime: LocalDateTime): String = "${date(dateTime)}, ${time(dateTime)}"

    internal fun dateAndTime(start: LocalDateTime, end: LocalDateTime): String = "${date(start)}, ${time(start)} – ${time(end)}"

}

```

### Core Architecture Module: `app/shared/src/commonMain/kotlin/org/jetbrains/kotlinconf/utils/DebugLogger.kt`
```
package org.jetbrains.kotlinconf.utils

import kotlin.time.Clock

class DebugLogger(private val platformLogger: Logger) : Logger, LogExporter {
    private val logs = mutableListOf<String>()

    override fun log(tag: String, lazyMessage: () -> String) {
        logs += "${Clock.System.now()} [${tag}] ${lazyMessage()}"
        while (logs.size > MAX_LOG_MESSAGES_IN_MEMORY) {
            logs.removeAt(0)
        }
        platformLogger.log(tag, lazyMessage)
    }

    override fun getAllLogs(): String = logs.joinToString("\n")
}

```

### Core Architecture Module: `app/shared/src/commonMain/kotlin/org/jetbrains/kotlinconf/utils/EmotionMapping.kt`
```
package org.jetbrains.kotlinconf.utils

import org.jetbrains.kotlinconf.Score
import org.jetbrains.kotlinconf.ui.components.Emotion

fun Emotion.toScore(): Score = when (this) {
    Emotion.Positive -> Score.GOOD
    Emotion.Neutral -> Score.OK
    Emotion.Negative -> Score.BAD
}

```

### Core Architecture Module: `app/shared/src/commonMain/kotlin/org/jetbrains/kotlinconf/utils/ErrorLoadingContent.kt`
```
package org.jetbrains.kotlinconf.utils

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import kotlinx.coroutines.delay
import org.jetbrains.kotlinconf.ui.components.NormalErrorWithLoading
import kotlin.time.Duration.Companion.milliseconds

sealed class ErrorLoadingState<out T : Any> {
    data object Loading : ErrorLoadingState<Nothing>()
    data object Error : ErrorLoadingState<Nothing>()
    data class Content<T : Any>(val data: T) : ErrorLoadingState<T>()
}

@Composable
fun <T : Any> ErrorLoadingContent(
    state: ErrorLoadingState<T>,
    errorMessage: String,
    onRetry: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
    content: @Composable (T) -> Unit,
) {
    var delayedState by remember { mutableStateOf<ErrorLoadingState<T>?>(null)  }
    LaunchedEffect(state) {
        if (state is ErrorLoadingState.Loading || state is ErrorLoadingState.Error) {
            delay(100.milliseconds)
            delayedState = state
        } else {
            delayedState = state
        }
    }

    AnimatedContent(
        delayedState ?: return,
        modifier = modifier.clipToBounds(),
        contentKey = {
            when (it) {
                is ErrorLoadingState.Content -> 1
                ErrorLoadingState.Error, ErrorLoadingState.Loading -> 2
            }
        },
        transitionSpec = { FadingAnimationSpec }
    ) { targetState ->
        when (targetState) {
            is ErrorLoadingState.Content -> content(targetState.data)
            ErrorLoadingState.Loading, ErrorLoadingState.Error -> {
                NormalErrorWithLoading(
                    message = errorMessage,
                    isLoading = targetState is ErrorLoadingState.Loading,
                    modifier = Modifier.fillMaxSize(),
                    onRetry = onRetry,
                )
            }
        }
    }
}

```

### Core Architecture Module: `app/shared/src/commonMain/kotlin/org/jetbrains/kotlinconf/utils/Logger.kt`
```
package org.jetbrains.kotlinconf.utils

interface Logger {
    fun log(tag: String, lazyMessage: () -> String)
}

fun Logger.tagged(tag: String) = TaggedLogger(tag, this)

class TaggedLogger(
    private val tag: String,
    private val delegate: Logger,
) {
    fun log(lazyMessage: () -> String) {
        delegate.log(tag, lazyMessage)
    }
}

class NoopProdLogger : Logger {
    override fun log(tag: String, lazyMessage: () -> String) {
        // No logging in prod
    }
}

interface LogExporter {
    fun getAllLogs(): String?
}

internal const val MAX_LOG_MESSAGES_IN_MEMORY = 200

```

### Core Architecture Module: `app/shared/src/commonMain/kotlin/org/jetbrains/kotlinconf/utils/NotificationBar.kt`
```
package org.jetbrains.kotlinconf.utils

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.time.Duration.Companion.seconds

@Stable
class NotificationBarState(private val scope: CoroutineScope) {
    var message: String? by mutableStateOf(null)
        private set

    private var dismissJob: Job? = null

    fun show(message: String) {
        dismissJob?.cancel()
        this.message = message
        dismissJob = scope.launch {
            delay(5.seconds)
            this@NotificationBarState.message = null
        }
    }
}

val LocalNotificationBar = compositionLocalOf<NotificationBarState> {
    error("LocalNotificationBar not set")
}

@Composable
fun rememberNotificationBarState(): NotificationBarState {
    val scope = rememberCoroutineScope()
    return remember { NotificationBarState(scope) }
}

```

### Core Architecture Module: `app/shared/src/commonMain/kotlin/org/jetbrains/kotlinconf/utils/PaddingValues.kt`
```
package org.jetbrains.kotlinconf.utils

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.calculateEndPadding
import androidx.compose.foundation.layout.calculateStartPadding
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalLayoutDirection

@Composable
fun bottomInsetPadding() = WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom).asPaddingValues()

@Composable
fun topInsetPadding() = WindowInsets.safeDrawing.only(WindowInsetsSides.Top).asPaddingValues()

@Composable
operator fun PaddingValues.plus(other: PaddingValues): PaddingValues {
    val layoutDir = LocalLayoutDirection.current
    return PaddingValues(
        start = calculateStartPadding(layoutDir) + other.calculateStartPadding(layoutDir),
        top = calculateTopPadding() + other.calculateTopPadding(),
        end = calculateEndPadding(layoutDir) + other.calculateEndPadding(layoutDir),
        bottom = calculateBottomPadding() + other.calculateBottomPadding()
    )
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #737** (2026-09-17): **Update Junie workflow reference**
  *Symptoms*: The Junie has been moved to JetBrains org.  See details in https://youtrack.jetbrains.com/issue/KTL-5096/Reusable-workflow-referenced-from-an-unregistered-GitHub-namespace-jetbrains-junie-in-9-JetBrains-repositories.

- **Issue #736** (2026-10-05): **Bump Compose Multiplatform to 1.12.0 and its aligned libraries**
  *Symptoms*: 

- **Issue #734** (2026-09-07): **Pin desktop target to toolchain 21**
  *Symptoms*: Add jvmToolchain(21), since otherwise on my machine, I get this wonderful error message:  ``` Error: LinkageError occurred while loading main class org.jetbrains.kotlinconf.MainKt     java.lang.UnsupportedClassVersionError: org/jetbrains/kotlinconf/MainKt has been compiled by a more recent version of the Java Runtime (class file version 69.0), this version of the Java Runtime only recognizes class file versions up to 65.0 ```

- **Issue #733** (2026-08-12): **Update iOS code signing identity to "Apple Distribution"**
  *Symptoms*: 

- **Issue #732** (2026-08-07): **Bump dependency versions**
  *Symptoms*: Bumps the shared dependency versions across the sample.  Only versions the sample already declares are touched. The Gradle wrapper was regenerated with the `wrapper` task, so the jar and scripts move with it, and `distributionSha256Sum` is pinned. 

- **Issue #730** (2026-07-31): **Align version catalog aliases with a shared convention**
  *Symptoms*: Renames the version catalog aliases so that each dependency has one canonical name shared across the Kotlin Multiplatform samples, and sorts the `[versions]` block alphabetically. `androidx-*` covers `androidx.*` together with its `org.jetbrains.androidx.*` multiplatform ports, which share one alias per library, while `compose-*` is Compose Multiplatform itself; separate release trains stay separate, so `androidx-navigation` (2.x) and `androidx-navigation3` (1.x) are distinct aliases. No resolved dependency version changes: every rename keeps its value, and any aliases merged together already held identical versions. Navigation 3 becomes `androidx-navigation3`, deliberately separate from `androidx-navigation`: it is its own `1.x` release line, not a newer Navigation 2.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 

- **Issue #728** (2026-07-06): **Remove yearless client-data backend routes**
  *Symptoms*: ## Summary  Removes the backwards-compatible prefix-less (no-year) backend routes for client data. All client-data routes now live **only** under the `/{year}` prefix.  ## Changes  - **`RoutesModule.kt`**: Dropped the prefix-less `yearBasedRoutes()` registration. `userRoutes`, `scheduleRoutes`, `votingRoutes`, `imageProxyRoutes`, `conferenceInfoRoutes`, `goldenKodeeRoutes`, and `documentsRoutes` are now served exclusively under `/{year}`. - **`routes/utils.kt`**: Removed the now-dead `DEFAULT_YEAR = 2025` fallback in `getYearFromPath`. A missing/invalid year now returns 404. Doc comments updated accordingly. - **Tests**: Updated `ApiTest`, `YearBasedApiTest`, and `DocumentsApiTest` to use year-prefixed URLs; removed the tests that specifically asserted the removed prefix-less behavior; fixed `MapsApiTest` to fetch relative map-SVG paths under the `/{year}` prefix. - **Docs**: Removed mentions of the year-less backwards-compatible routes in `CLAUDE.md` and `docs/ARCHIVE.md`.  ## Verification  - `./gradlew :backend:test` passes (49 tests). - Clients are unaffected: `YearlyApi` and `AdminApi` already build year-prefixed URLs, and relative map-SVG paths are prepended with the year by `YearlyApi`.

- **Issue #727** (2026-07-08): **Add ProGuard configuration for desktop release build**
  *Symptoms*: Fixes #724
  **Post-Mortem & Fix Analysis**:
  > I got `io.ktor.client.HttpClientEngineContainer: Provider io.ktor.client.engine.okhttp.OkHttpEngineContainer not found` after launching an app produced by `app:desktopApp:createReleaseDistributable` task.
  > @kropp Added _even more rules_, now we should be good to go
  > Thanks, seems to work now! It fails due to unrelated issue though, filed #729 

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

### Incident Patch 1: `b6fd16be` (2026-06-18)
**Commit Message**: Add workflow to build JVM desktop release

**File**: `.github/workflows/build-all.yml` (modified, +14/-0)
```diff
@@ -26,6 +26,20 @@ jobs:
       - name: Run JVM tests
         run: ./gradlew jvmTest
 
+  build-jvm-release:
+    name: Build desktop release
+    runs-on: ubuntu-latest
+    steps:
+      - name: Check out code
+        uses: actions/checkout@v4
+      - name: Set up JDK 21
+        uses: actions/setup-java@v4
+        with:
+          distribution: 'zulu'
+          java-version: 21
+      - name: Build desktop release distributable
+        run: ./gradlew :app:desktopApp:createReleaseDistributable --stacktrace
+
   build-android:
     name: Build Android
     runs-on: ubuntu-latest
```

---

### Incident Patch 2: `55a3e53e` (2026-06-18)
**Commit Message**: Add ProGuard configuration for desktop release build

**File**: `app/desktopApp/build.gradle.kts` (modified, +4/-0)
```diff
@@ -17,6 +17,10 @@ kotlin {
 compose.desktop {
     application {
         mainClass = "org.jetbrains.kotlinconf.MainKt"
+
+        buildTypes.release.proguard {
+            configurationFiles.from(project.file("compose-desktop.pro"))
+        }
     }
 }
 
```

**File**: `app/desktopApp/compose-desktop.pro` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+# ProGuard rules for the desktop release build (:app:desktopApp:runRelease).
+#
+# OkHttp (pulled in transitively via ktor-client-okhttp) references several
+# optional dependencies that are not on the classpath: GraalVM native-image,
+# Conscrypt, BouncyCastle and OpenJSSE. These references are only used when the
+# corresponding providers are present at runtime, so they are safe to ignore.
+-dontwarn org.graalvm.nativeimage.hosted.**
+-dontwarn com.oracle.svm.core.annotate.**
+-dontwarn org.conscrypt.**
+-dontwarn org.bouncycastle.**
+-dontwarn org.openjsse.**
+-dontwarn okhttp3.internal.platform.**
+
+# The Metro dependency graph factory generates a synthetic `create$default`
+# helper for the default `platformFlags` parameter. ProGuard reports it as an
+# inconsistent program class member; suppressing the warning is safe because the
+# generated graph is kept and used as the application entry point.
+-dontwarn org.jetbrains.kotlinconf.di.JvmAppGraph$Companion
```

---

### Incident Patch 3: `6a333b28` (2026-06-05)
**Commit Message**: Remove experimental annotation for Uuid

**File**: `app/shared/src/commonMain/kotlin/org/jetbrains/kotlinconf/storage/ApplicationStorageImpl.kt` (modified, +0/-2)
```diff
@@ -23,7 +23,6 @@ import org.jetbrains.kotlinconf.Theme
 import org.jetbrains.kotlinconf.getPlatformId
 import org.jetbrains.kotlinconf.utils.Logger
 import org.jetbrains.kotlinconf.utils.tagged
-import kotlin.uuid.ExperimentalUuidApi
 import kotlin.uuid.Uuid
 
 @SingleIn(AppScope::class)
@@ -119,7 +118,6 @@ class ApplicationStorageImpl(
     private fun ensureUserId() {
         val existingUserId = settings.getString(Keys.USER_ID, "")
         if (existingUserId.isBlank()) {
-            @OptIn(ExperimentalUuidApi::class)
             val generatedUserId = "${getPlatformId()}-${Uuid.random()}"
             settings.set(Keys.USER_ID, generatedUserId)
         }
```

---

### Incident Patch 4: `e7974f48` (2026-05-26)
**Commit Message**: Fix web build

**File**: `app/ui-components/src/jsMain/kotlin/org/jetbrains/kotlinconf/ui/PlatformContext.js.kt` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+package org.jetbrains.kotlinconf.ui
+
+import coil3.PlatformContext
+
+internal actual val platformContext: PlatformContext = PlatformContext.INSTANCE
```

**File**: `app/ui-components/src/wasmJsMain/kotlin/org/jetbrains/kotlinconf/ui/PlatformContext.wasmJs.kt` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+package org.jetbrains.kotlinconf.ui
+
+import coil3.PlatformContext
+
+internal actual val platformContext: PlatformContext = PlatformContext.INSTANCE
```

**File**: `app/ui-components/src/webMain/kotlin/org/jetbrains/kotlinconf/ui/InitCoil.kt` (modified, +3/-1)
```diff
@@ -7,9 +7,11 @@ import coil3.intercept.Interceptor
 import coil3.request.ImageResult
 import coil3.util.DebugLogger
 
+internal expect val platformContext: PlatformContext
+
 fun initCoil() {
     SingletonImageLoader.setSafe {
-        ImageLoader.Builder(PlatformContext.INSTANCE)
+        ImageLoader.Builder(platformContext)
             .components {
                 add(SessionizeImageInterceptor())
             }
```

---

### Incident Patch 5: `8c5eb869` (2026-05-20)
**Commit Message**: Add CLAUDE.md project guide

Co-Authored-By: Claude Opus 4.7 (1M context) <[REDACTED_EMAIL]>

**File**: `CLAUDE.md` (added, +119/-0)
```diff
@@ -0,0 +1,119 @@
+# CLAUDE.md
+
+This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
+
+## What This Is
+
+The official KotlinConf app — a Kotlin Multiplatform project serving Android, iOS, JVM desktop, and WebAssembly clients, backed by a Ktor server. All client UI is shared via Compose Multiplatform.
+
+## Build & Run Commands
+
+```bash
+# Run desktop app (hot reload enabled)
+./gradlew :app:desktopApp:hotRun -DmainClass=org.jetbrains.kotlinconf.MainKt
+
+# Run web app (wasmJs target, development mode)
+./gradlew :app:webApp:wasmJsBrowserDevelopmentRun
+
+# Run backend server
+./gradlew :backend:run
+
+# Run backend tests
+./gradlew :backend:test
+
+# Run shared module tests (JVM target)
+./gradlew :app:shared:jvmTest
+
+# Run core module tests
+./gradlew :core:jvmTest
+
+# Bump version across all platforms + generate library definitions
+./gradlew prepareRelease
+```
+
+Android uses the `app.androidApp` run configuration in IDE; iOS uses `KotlinConfAppScheme`.
+
+## Module Structure
+
+```
+:core                 — Shared data models (Conference, Session, Speaker, VoteInfo, Score, AppConfig, etc.)
+                        Used by both client and backend. No UI, no platform code.
+
+:app:ui-components    — Reusable Compose UI components (KotlinConfTheme, typography, colors, buttons, cards, etc.)
+                        Has its own resource class (UiRes) separate from the main app.
+
+:app:shared           — Main KMP client: all screens, ViewModels, navigation, ConferenceService, DI graph.
+                        Targets: android, jvm, iosArm64, iosSimulatorArm64, wasmJs, js.
+
+:app:androidApp       — Android entry point only. Wires up AndroidAppGraph.
+:app:desktopApp       — JVM desktop entry point. Uses Compose Desktop.
+:app:webApp           — Wasm+JS entry points. Targets wasmJs and js, both browser.
+
+:backend              — Ktor/Netty server. Fetches data from Sessionize, stores votes/users in DB.
+```
+
+## Client Architecture
+
+**Dependency Injection — Metro**
+
+The app uses [Metro](https://github.com/ZacSweers/metro) (not Koin) for DI on the client. Key interfaces:
+
+- `AppGraph` — top-level DI graph (`AppScope`), one per app process. Holds `ConferenceService`, `FlagsManager`, `TimeProvider`, etc.
+- `YearGraph` — a *scoped sub-graph* (`YearScope`) created per active conference year. Holds `YearlyApi` and `YearlyStorage`. Created by `YearGraph.Factory` inside `ConferenceService`.
+- Platform-specific graph (e.g. `AndroidAppGraph`) — annotated `@DependencyGraph(AppScope::class)`, created at app startup, implements `AppGraph`.
+
+ViewModels are registered into Metro's map multibinding:
+```kotlin
+@ContributesIntoMap(AppScope::class)
+@ViewModelKey
+class ScheduleViewModel(...) : ViewModel()
+```
+
+**ConferenceService**
+
+`ConferenceService` is the central app singleton. It:
+- Fetches `AppConfig` (current year) from the backend on startup and stores it locally.
+- Creates a `YearGraph` for the active year, giving access to that year's `YearlyApi` and `YearlyStorage`.
+- Exposes `StateFlow`s: `agenda`, `speakers`, `conferenceInfo`, `goldenKodeeData`, `votes`, `currentYear`.
+- Handles favorites, voting, policy acceptance, notification scheduling, and asset caching.
+
+**Navigation**
+
+Uses `androidx.navigation3`. Routes are `@Serializable sealed interface AppRoute` types defined in `Routes.kt`. `TopLevelRoute` marks bottom-nav destinations. `NavHost.kt` maps routes to screen composables.
+
+**Screens / ViewModels pattern**
+
+Each screen has a corresponding `*ViewModel` that takes `ConferenceService` as a dependency, maps service `StateFlow`s into `uiState: StateFlow<ErrorLoadingState<...>>`, and exposes user-action functions. The screen Composable receives the ViewModel via Metro's ViewModel factory.
+
+**Flags**
+
+`Flags` is a `@Serializable data class` stored via `FlagsManager`. Compose screens access it via `LocalFlags`. Includes developer-mode options like `useFakeTime`, `debugLogging`, and `useFakeGoldenKodeeData`.
+
+**Source Set Hierarchy**
+
+The `app:shared` module defines custom intermediate source sets beyond the default hierarchy:
+- `nonAndroidMain` — shared by `iosMain`, `jvmMain`, and `webMain` (excludes Android)
+- `nonWebMain` — shared by `androidMain`, `iosMain`, and `jvmMain` (has `okio` dependency; web can't use it)
+- `webMain` — shared by `wasmJsMain` and `jsMain` (JS-specific timezone shim, browser APIs)
+
+## Backend Architecture
+
+- **Framework**: Ktor with Netty engine
+- **DI**: Koin (`diModule()` in `DiModule.kt`)
+- **Database**: Exposed ORM + HikariCP. PostgreSQL in production; H2 file-based fallback when no `database.host` is configured (used for local dev and tests).
+- **Migrations**: `MigrationRunner` applies SQL migrations in order.
+
+**Route structure** (`RoutesModule.kt`):
+- Year-agnostic: `/healthz`, `/time`, `/admin/*`, `/config`
+- Year-prefixed: `/{year}/conference`, `/{year}/conference-info`
```

---

### Incident Patch 6: `57fa674f` (2026-04-29)
**Commit Message**: Use built-in @PreviewLightDark annotation

**File**: `app/ui-components/src/commonMain/kotlin/org/jetbrains/kotlinconf/ui/components/Action.kt` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ import org.jetbrains.kotlinconf.ui.generated.resources.UiRes
 import org.jetbrains.kotlinconf.ui.generated.resources.arrow_right_24
 import org.jetbrains.kotlinconf.ui.theme.KotlinConfTheme
 import org.jetbrains.kotlinconf.ui.theme.PreviewHelper
-import org.jetbrains.kotlinconf.ui.utils.PreviewLightDark
+import androidx.compose.ui.tooling.preview.PreviewLightDark
 
 enum class ActionSize {
     Medium, Large,
```

**File**: `app/ui-components/src/commonMain/kotlin/org/jetbrains/kotlinconf/ui/components/Button.kt` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ import androidx.compose.ui.semantics.Role
 import androidx.compose.ui.unit.dp
 import org.jetbrains.kotlinconf.ui.theme.KotlinConfTheme
 import org.jetbrains.kotlinconf.ui.theme.PreviewHelper
-import org.jetbrains.kotlinconf.ui.utils.PreviewLightDark
+import androidx.compose.ui.tooling.preview.PreviewLightDark
 
 private val ButtonShape = RoundedCornerShape(percent = 100)
 
```

**File**: `app/ui-components/src/commonMain/kotlin/org/jetbrains/kotlinconf/ui/components/CardTag.kt` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ import androidx.compose.ui.tooling.preview.PreviewParameterProvider
 import androidx.compose.ui.unit.dp
 import org.jetbrains.kotlinconf.ui.theme.KotlinConfTheme
 import org.jetbrains.kotlinconf.ui.theme.PreviewHelper
-import org.jetbrains.kotlinconf.ui.utils.PreviewLightDark
+import androidx.compose.ui.tooling.preview.PreviewLightDark
 
 private val CardTagShape = RoundedCornerShape(size = 4.dp)
 
```

**File**: `app/ui-components/src/commonMain/kotlin/org/jetbrains/kotlinconf/ui/components/DayHeader.kt` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ import org.jetbrains.kotlinconf.ui.theme.JetBrainsSans
 import org.jetbrains.kotlinconf.ui.theme.KotlinConfTheme
 import org.jetbrains.kotlinconf.ui.theme.PreviewHelper
 import org.jetbrains.kotlinconf.ui.theme.UI.white60
-import org.jetbrains.kotlinconf.ui.utils.PreviewLightDark
+import androidx.compose.ui.tooling.preview.PreviewLightDark
 
 private val DayDateStyle
     @Composable
```

**File**: `app/ui-components/src/commonMain/kotlin/org/jetbrains/kotlinconf/ui/components/Divider.kt` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ import androidx.compose.ui.unit.Dp
 import androidx.compose.ui.unit.dp
 import org.jetbrains.kotlinconf.ui.theme.KotlinConfTheme
 import org.jetbrains.kotlinconf.ui.theme.PreviewHelper
-import org.jetbrains.kotlinconf.ui.utils.PreviewLightDark
+import androidx.compose.ui.tooling.preview.PreviewLightDark
 
 @Composable
 fun HorizontalDivider(
```

**File**: `app/ui-components/src/commonMain/kotlin/org/jetbrains/kotlinconf/ui/components/ErrorLoading.kt` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ import org.jetbrains.kotlinconf.ui.generated.resources.loading
 import org.jetbrains.kotlinconf.ui.theme.KotlinConfTheme
 import org.jetbrains.kotlinconf.ui.theme.PreviewHelper
 import org.jetbrains.kotlinconf.ui.theme.UI
-import org.jetbrains.kotlinconf.ui.utils.PreviewLightDark
+import androidx.compose.ui.tooling.preview.PreviewLightDark
 import kotlin.math.PI
 import kotlin.math.cos
 import kotlin.math.sin
```

**File**: `app/ui-components/src/commonMain/kotlin/org/jetbrains/kotlinconf/ui/components/FeedbackForm.kt` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ import org.jetbrains.kotlinconf.ui.generated.resources.feedback_form_type_someth
 import org.jetbrains.kotlinconf.ui.theme.Brand
 import org.jetbrains.kotlinconf.ui.theme.KotlinConfTheme
 import org.jetbrains.kotlinconf.ui.theme.PreviewHelper
-import org.jetbrains.kotlinconf.ui.utils.PreviewLightDark
+import androidx.compose.ui.tooling.preview.PreviewLightDark
 
 @Composable
 fun FeedbackForm(
```

**File**: `app/ui-components/src/commonMain/kotlin/org/jetbrains/kotlinconf/ui/components/Filters.kt` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@ import org.jetbrains.kotlinconf.ui.generated.resources.filter_label_session_form
 import org.jetbrains.kotlinconf.ui.generated.resources.up_24
 import org.jetbrains.kotlinconf.ui.theme.KotlinConfTheme
 import org.jetbrains.kotlinconf.ui.theme.PreviewHelper
-import org.jetbrains.kotlinconf.ui.utils.PreviewLightDark
+import androidx.compose.ui.tooling.preview.PreviewLightDark
 
 enum class FilterItemType {
     Category, Level, Format,
```

---

### Incident Patch 7: `1af09ca6` (2026-04-25)
**Commit Message**: Fix VMFactory bindings

**File**: `app/shared/build.gradle.kts` (modified, +3/-3)
```diff
@@ -9,11 +9,11 @@ import org.jetbrains.kotlin.gradle.dsl.JvmTarget
 plugins {
     alias(libs.plugins.aboutLibraries)
     alias(libs.plugins.androidMultiplatformLibrary)
-    alias(libs.plugins.composeMultiplatform)
-    alias(libs.plugins.composeCompiler)
+    alias(libs.plugins.kotlinSerialization)
     alias(libs.plugins.kotlinMultiplatform)
     alias(libs.plugins.kotlinPowerAssert)
-    alias(libs.plugins.kotlinSerialization)
+    alias(libs.plugins.composeMultiplatform)
+    alias(libs.plugins.composeCompiler)
     alias(libs.plugins.metro)
 }
 
```

**File**: `app/shared/src/commonMain/kotlin/org/jetbrains/kotlinconf/di/AppBindings.kt` (modified, +2/-4)
```diff
@@ -5,7 +5,6 @@ import dev.zacsweers.metro.AppScope
 import dev.zacsweers.metro.BindingContainer
 import dev.zacsweers.metro.Binds
 import dev.zacsweers.metro.ContributesTo
-import dev.zacsweers.metro.Provider
 import dev.zacsweers.metro.Provides
 import dev.zacsweers.metro.SingleIn
 import dev.zacsweers.metrox.viewmodel.ManualViewModelAssistedFactory
@@ -29,7 +28,6 @@ import org.jetbrains.kotlinconf.URLs
 import org.jetbrains.kotlinconf.flags.Flags
 import org.jetbrains.kotlinconf.network.ApplicationApi
 import org.jetbrains.kotlinconf.storage.ApplicationStorage
-import org.jetbrains.kotlinconf.utils.BufferedDelegatingLogger
 import org.jetbrains.kotlinconf.utils.Logger
 import kotlin.reflect.KClass
 import io.ktor.client.plugins.logging.Logger as KtorLogger
@@ -41,8 +39,8 @@ object AppBindings {
     @Provides
     @SingleIn(AppScope::class)
     fun provideMetroViewModelFactory(
-        viewModelProviders: Map<KClass<out ViewModel>, Provider<ViewModel>>,
-        manualAssistedFactoryProviders: Map<KClass<out ManualViewModelAssistedFactory>, Provider<ManualViewModelAssistedFactory>>,
+        viewModelProviders: Map<KClass<out ViewModel>, () -> ViewModel>,
+        manualAssistedFactoryProviders: Map<KClass<out ManualViewModelAssistedFactory>, () -> ManualViewModelAssistedFactory>,
     ): MetroViewModelFactory = object : MetroViewModelFactory() {
         override val viewModelProviders get() = viewModelProviders
         override val manualAssistedFactoryProviders get() = manualAssistedFactoryProviders
```

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ kotlinxSerializationCore = "1.10.0"
 ktor = "3.4.1"
 logbackClassic = "1.5.24"
 markdown = "0.39.2"
-metro = "1.0.0-RC3"
+metro = "1.0.0-RC4"
 multiplatform-settings = "1.3.0"
 okio = "3.16.4"
 postgresql = "42.7.8"
```

---

### Incident Patch 8: `51ba884f` (2026-04-20)
**Commit Message**: Add build guard for Xcode project

**File**: `app/iosApp/KotlinConf.xcodeproj/project.pbxproj` (modified, +1/-1)
```diff
@@ -196,7 +196,7 @@
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 			shellPath = /bin/sh;
-			shellScript = "cd \"$SRCROOT/../..\"\n./gradlew :app:shared:embedAndSignAppleFrameworkForXcode\n";
+			shellScript = "if [ \"YES\" = \"$OVERRIDE_KOTLIN_BUILD_IDE_SUPPORTED\" ]; then\n  echo \"Skipping Gradle build task invocation due to OVERRIDE_KOTLIN_BUILD_IDE_SUPPORTED environment variable set to \\\"YES\\\"\"\n  exit 0\nfi\ncd \"$SRCROOT/../..\"\n./gradlew :app:shared:embedAndSignAppleFrameworkForXcode";
 		};
 /* End PBXShellScriptBuildPhase section */
 
```

---

### Incident Patch 9: `600aae8e` (2026-04-07)
**Commit Message**: Fix IDs in Golden Kodee 2026 data

**File**: `backend/src/main/resources/years/2026/golden-kodee.json` (modified, +2/-2)
```diff
@@ -13,7 +13,7 @@
           "winner": false
         },
         {
-          "id": "james-cullimore",
+          "id": "james-cullimore-1",
           "name": "James Cullimore",
           "photoUrl": "https://kotlinconf.com/static/7999f0a733d395a5e45c3e140b96f334/4b99c/james-cullimore.jpg",
           "bio": "Software and mobile developer (Java, Kotlin, Android, Fullstack). Open source creator (StreamingYorkie, WiFiWizard, DontGoToBed). Built apps like hansgrohe home and lexoffice. Freelancer, Android instructor, writer, MMA practitioner.",
@@ -133,7 +133,7 @@
           "winner": false
         },
         {
-          "id": "james-cullimore",
+          "id": "james-cullimore-2",
           "name": "James Cullimore",
           "photoUrl": "https://kotlinconf.com/static/7999f0a733d395a5e45c3e140b96f334/4b99c/james-cullimore.jpg",
           "bio": "Software and mobile developer (Java, Kotlin, Android, Fullstack). Open source creator (StreamingYorkie, WiFiWizard, DontGoToBed). Built apps like hansgrohe home and lexoffice. Freelancer, Android instructor, writer, MMA practitioner.",
```

---

### Incident Patch 10: `bd186f8e` (2026-03-25)
**Commit Message**: Add Noto Color Emoji font for the web app to render emojis

**File**: `app/webApp/build.gradle.kts` (modified, +5/-0)
```diff
@@ -30,6 +30,11 @@ kotlin {
     sourceSets {
         commonMain.dependencies {
             implementation(projects.app.shared)
+            implementation(libs.compose.components.resources)
         }
     }
 }
+
+compose.resources {
+    packageOfResClass = "org.jetbrains.kotlinconf.web.generated.resources"
+}
```

**File**: `app/webApp/src/webMain/kotlin/org/jetbrains/kotlinconf/main.kt` (modified, +18/-1)
```diff
@@ -2,13 +2,20 @@
 
 package org.jetbrains.kotlinconf
 
+import androidx.compose.runtime.LaunchedEffect
 import androidx.compose.ui.ExperimentalComposeUiApi
+import androidx.compose.ui.platform.LocalFontFamilyResolver
+import androidx.compose.ui.text.font.FontFamily
 import androidx.compose.ui.window.ComposeViewport
 import dev.zacsweers.metro.createGraphFactory
+import org.jetbrains.compose.resources.ExperimentalResourceApi
+import org.jetbrains.compose.resources.preloadFont
 import org.jetbrains.kotlinconf.di.WebAppGraph
 import org.jetbrains.kotlinconf.flags.Flags
 import org.jetbrains.kotlinconf.ui.initCoil
 import org.jetbrains.kotlinconf.utils.Logger
+import org.jetbrains.kotlinconf.web.generated.resources.NotoColorEmoji
+import org.jetbrains.kotlinconf.web.generated.resources.Res
 import kotlin.js.ExperimentalWasmJsInterop
 
 external object Window {
@@ -17,7 +24,6 @@ external object Window {
 
 external val window: Window
 
-@OptIn(ExperimentalComposeUiApi::class)
 fun main() {
     initCoil()
 
@@ -35,7 +41,18 @@ fun main() {
             }
         },
     )
+
+    @OptIn(ExperimentalComposeUiApi::class)
     ComposeViewport {
+        @OptIn(ExperimentalResourceApi::class)
+        val emojiFont = preloadFont(Res.font.NotoColorEmoji).value
+        val fontFamilyResolver = LocalFontFamilyResolver.current
+        LaunchedEffect(fontFamilyResolver, emojiFont) {
+            if (emojiFont != null) {
+                fontFamilyResolver.preload(FontFamily(listOf(emojiFont)))
+            }
+        }
+
         App(appGraph)
     }
 }
\ No newline at end of file
```

---

### Incident Patch 11: `8300e0d3` (2026-03-24)
**Commit Message**: Fix inset padding (horizontal, top of session screen, and map button)

**File**: `app/shared/src/commonMain/kotlin/org/jetbrains/kotlinconf/navigation/NavHost.kt` (modified, +8/-1)
```diff
@@ -8,9 +8,14 @@ import androidx.compose.foundation.clickable
 import androidx.compose.foundation.layout.Arrangement
 import androidx.compose.foundation.layout.Box
 import androidx.compose.foundation.layout.Row
+import androidx.compose.foundation.layout.WindowInsets
+import androidx.compose.foundation.layout.WindowInsetsSides
 import androidx.compose.foundation.layout.fillMaxSize
+import androidx.compose.foundation.layout.only
 import androidx.compose.foundation.layout.padding
+import androidx.compose.foundation.layout.safeDrawing
 import androidx.compose.foundation.layout.size
+import androidx.compose.foundation.layout.windowInsetsPadding
 import androidx.compose.foundation.shape.CircleShape
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.LaunchedEffect
@@ -26,7 +31,6 @@ import androidx.navigation3.runtime.EntryProviderScope
 import androidx.navigation3.runtime.entryProvider
 import androidx.navigation3.ui.NavDisplay
 import kotlinx.coroutines.channels.Channel
-import kotlinx.coroutines.flow.filter
 import kotlinx.coroutines.flow.map
 import org.jetbrains.kotlinconf.ConferenceService
 import org.jetbrains.kotlinconf.LocalAppGraph
@@ -163,6 +167,9 @@ internal fun NavHost(
                 Modifier
                     .fillMaxSize()
                     .background(KotlinConfTheme.colors.mainBackground)
+                    .windowInsetsPadding(
+                        WindowInsets.safeDrawing.only(WindowInsetsSides.Horizontal)
+                    )
             ) {
                 NavScaffold(
                     navState = navState,
```

**File**: `app/shared/src/commonMain/kotlin/org/jetbrains/kotlinconf/screens/MapScreen.kt` (modified, +17/-5)
```diff
@@ -13,8 +13,13 @@ import androidx.compose.foundation.layout.Box
 import androidx.compose.foundation.layout.BoxWithConstraints
 import androidx.compose.foundation.layout.Column
 import androidx.compose.foundation.layout.PaddingValues
+import androidx.compose.foundation.layout.WindowInsets
+import androidx.compose.foundation.layout.WindowInsetsSides
+import androidx.compose.foundation.layout.asPaddingValues
 import androidx.compose.foundation.layout.fillMaxSize
+import androidx.compose.foundation.layout.only
 import androidx.compose.foundation.layout.padding
+import androidx.compose.foundation.layout.safeDrawing
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.getValue
 import androidx.compose.runtime.mutableStateOf
@@ -23,7 +28,6 @@ import androidx.compose.runtime.rememberCoroutineScope
 import androidx.compose.runtime.saveable.Saver
 import androidx.compose.runtime.saveable.rememberSaveable
 import androidx.compose.runtime.setValue
-import dev.zacsweers.metrox.viewmodel.metroViewModel
 import androidx.compose.ui.Alignment
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.draw.clipToBounds
@@ -35,6 +39,7 @@ import androidx.compose.ui.input.pointer.pointerInput
 import androidx.compose.ui.platform.LocalWindowInfo
 import androidx.compose.ui.unit.dp
 import androidx.lifecycle.compose.collectAsStateWithLifecycle
+import dev.zacsweers.metrox.viewmodel.metroViewModel
 import kotlinx.coroutines.launch
 import org.jetbrains.compose.resources.stringResource
 import org.jetbrains.kotlinconf.MapData
@@ -49,7 +54,6 @@ import org.jetbrains.kotlinconf.generated.resources.map_zoom_out
 import org.jetbrains.kotlinconf.generated.resources.minus_24
 import org.jetbrains.kotlinconf.generated.resources.navigate_back
 import org.jetbrains.kotlinconf.generated.resources.plus_24
-import org.jetbrains.kotlinconf.utils.ErrorLoadingContent
 import org.jetbrains.kotlinconf.ui.components.HorizontalDivider
 import org.jetbrains.kotlinconf.ui.components.MainHeaderTitleBar
 import org.jetbrains.kotlinconf.ui.components.OverlayIconButton
@@ -59,6 +63,9 @@ import org.jetbrains.kotlinconf.ui.components.TopMenuButton
 import org.jetbrains.kotlinconf.ui.generated.resources.UiRes
 import org.jetbrains.kotlinconf.ui.generated.resources.arrow_up_right_24
 import org.jetbrains.kotlinconf.ui.theme.KotlinConfTheme
+import org.jetbrains.kotlinconf.utils.ErrorLoadingContent
+import org.jetbrains.kotlinconf.utils.LocalWindowSize
+import org.jetbrains.kotlinconf.utils.WindowSize
 import org.jetbrains.kotlinconf.utils.bottomInsetPadding
 import org.jetbrains.kotlinconf.utils.plus
 import org.jetbrains.kotlinconf.utils.topInsetPadding
@@ -144,7 +151,8 @@ private fun MapScreenImpl(
             var floorIndex by rememberSaveable { mutableStateOf(initialFloorIndex) }
             val floor = mapData.floors.getOrNull(floorIndex) ?: return@ErrorLoadingContent
 
-            val svgPath = if (KotlinConfTheme.colors.isDark) floor.svgPathDark else floor.svgPathLight
+            val svgPath =
+                if (KotlinConfTheme.colors.isDark) floor.svgPathDark else floor.svgPathLight
             val svgData = content.svgsByPath[svgPath] ?: return@ErrorLoadingContent
 
             Column(Modifier.fillMaxSize()) {
@@ -189,7 +197,9 @@ fun StaticMap(
     val offset = Offset(room.offsetX, room.offsetY)
 
     val floor = mapData.floors[floorIndex]
-    val svgData = svgsByPath[if (KotlinConfTheme.colors.isDark) floor.svgPathDark else floor.svgPathLight] ?: return
+    val svgData =
+        svgsByPath[if (KotlinConfTheme.colors.isDark) floor.svgPathDark else floor.svgPathLight]
+            ?: return
     val svg = remember(svgData) { Svg(svgData) }
 
     BoxWithConstraints {
@@ -287,13 +297,15 @@ private fun MapWithControls(
         }
 
         if (onHowToFindVenue != null) {
+            val isLargeScreen = LocalWindowSize.current != WindowSize.Compact
+            val extraPadding = if (isLargeScreen) bottomInsetPadding() else PaddingValues(0.dp)
             OverlayTextButton(
                 label = stringResource(Res.string.map_how_to_find_venue),
                 icon = UiRes.drawable.arrow_up_right_24,
                 onClick = onHowToFindVenue,
                 modifier = Modifier
                     .align(Alignment.BottomCenter)
-                    .padding(PaddingValues(bottom = buttonEdgePadding) + bottomInsetPadding())
+                    .padding(PaddingValues(bottom = buttonEdgePadding) + extraPadding)
             )
         }
     }
```

**File**: `app/shared/src/commonMain/kotlin/org/jetbrains/kotlinconf/screens/SessionScreen.kt` (modified, +5/-1)
```diff
@@ -6,6 +6,7 @@ import androidx.compose.animation.expandVertically
 import androidx.compose.animation.fadeIn
 import androidx.compose.animation.fadeOut
 import androidx.compose.animation.shrinkVertically
+import androidx.compose.foundation.background
 import androidx.compose.foundation.clickable
 import androidx.compose.foundation.layout.Column
 import androidx.compose.foundation.layout.ExperimentalLayoutApi
@@ -59,6 +60,7 @@ import org.jetbrains.kotlinconf.utils.ErrorLoadingContent
 import org.jetbrains.kotlinconf.utils.ErrorLoadingState
 import org.jetbrains.kotlinconf.utils.LocalWindowSize
 import org.jetbrains.kotlinconf.utils.WindowSize
+import org.jetbrains.kotlinconf.utils.topInsetPadding
 
 @OptIn(ExperimentalLayoutApi::class)
 @Composable
@@ -78,7 +80,9 @@ fun SessionScreen(
     ErrorLoadingContent(
         state = sessionState,
         errorMessage = stringResource(Res.string.session_screen_error),
-        modifier = Modifier.fillMaxSize(),
+        modifier = Modifier.fillMaxSize()
+            .background(color = KotlinConfTheme.colors.mainBackground)
+            .padding(topInsetPadding()),
     ) { session ->
 
         AdaptiveDetailLayout(
```

---

### Incident Patch 12: `799cb920` (2026-03-23)
**Commit Message**: Fix getAsset calls erroring if no year graph is set yet

**File**: `app/shared/src/commonMain/kotlin/org/jetbrains/kotlinconf/ConferenceService.kt` (modified, +1/-1)
```diff
@@ -503,7 +503,7 @@ class ConferenceService(
     suspend fun getAsset(path: String): String? {
         taggedLogger.log { "Reading asset: $path" }
 
-        val storage = currentYearGraph.value?.storage ?: return null
+        val storage = currentYearGraph.filterNotNull().first().storage
         val cached = storage.getAsset(path)
 
         if (cached != null) {
```

---

### Incident Patch 13: `67a93c05` (2026-03-23)
**Commit Message**: Fix ordering in About conf blocks

**File**: `backend/src/main/resources/years/2026/conference-info.json` (modified, +8/-8)
```diff
@@ -159,14 +159,6 @@
       "title2": "keynote",
       "description": null
     },
-    {
-      "sessionId": "1095750",
-      "month": "MAY",
-      "day": "22",
-      "title1": "Second day",
-      "title2": "keynote",
-      "description": null
-    },
     {
       "sessionId": "8316c80e-daeb-494a-8197-9443b84af81c",
       "month": "MAY",
@@ -175,6 +167,14 @@
       "title2": "Party",
       "description": "Have fun and mingle with the community at the biggest Kotlin party of the year!"
     },
+    {
+      "sessionId": "1095750",
+      "month": "MAY",
+      "day": "22",
+      "title1": "Second day",
+      "title2": "keynote",
+      "description": null
+    },
     {
       "sessionId": "1166456",
       "month": "MAY",
```

---

### Incident Patch 14: `c88b8be2` (2026-03-20)
**Commit Message**: Fix links and minor formatting in App Privacy Notice and App Terms

**File**: `backend/src/main/resources/years/2026/documents/app-privacy-notice.md` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ To respect your privacy, before using your Personal Data we will inform you abou
 
 Collected Personal Data are shared based on this Privacy Notice. Additionally, we share collected Personal Data within the JetBrains group of companies described above, which act as joint data controllers and process Personal Data for the purposes described above.
 
-We may share your Personal Data with [Google Cloud Platform which third party hosts and helps us provide you with this App.](https://cloud.google.com/terms/cloud-privacy-notice) 
+We may share your Personal Data with [Google Cloud](https://cloud.google.com/terms/cloud-privacy-notice) Platform which third party hosts and helps us provide you with this App. 
 
 We may also share your Personal Data with certain third parties if we are obliged to do so under applicable legislation (especially with tax authorities or with other government bodies exercising their statutory powers) or if such sharing is necessary to achieve the purposes defined above (especially with government bodies or with parties harmed as a result of violations of applicable laws).  
 To adhere to the requirements of the California Consumer Privacy Act (CCPA), we hereby notify you that JetBrains will not a) retain, use, sell, or otherwise disclose any Personal Data for any purpose other than to provide the App; or b) retain, use, sell, or disclose such Personal Data outside of the direct relationship between you and JetBrains; or c) use Personal Data other than as described within this Privacy Notice.
```

**File**: `backend/src/main/resources/years/2026/documents/app-terms.md` (modified, +2/-2)
```diff
@@ -76,7 +76,7 @@ JetBrains reserves the right to suspend Your access to KotlinConf App if Your us
 
 #### **10\. GENERAL**
 
-10.1. **Entire Agreement**. This Agreement constitutes together with the Code of Conduct available at [https://kotlinconf.com/code-of-conduct](https://kotlinconf.com/code-of-conduct) the entire agreement between You and JetBrains with respect to Your use of KotlinConf App**.**
+10.1. **Entire Agreement**. This Agreement constitutes together with the Code of Conduct available at [https://kotlinconf.com/code-of-conduct](https://kotlinconf.com/code-of-conduct) the entire agreement between You and JetBrains with respect to Your use of KotlinConf App.
 
 10.2. **Reservation of Rights**. JetBrains reserves the right at any time to alter features, functions, terms of use, JetBrains Content or other characteristics of KotlinConf App. Nothing in this Agreement limits any rights a consumer may have under applicable consumer protection laws.
 
@@ -96,7 +96,7 @@ JetBrains reserves the right to suspend Your access to KotlinConf App if Your us
 
 13.13. **Force Majeure**. Neither Party shall be in breach of this Agreement, or otherwise liable to the other, by reason of any delay in performance, or non-performance of any of its obligations under this Agreement (except payment obligations), arising directly from an act of God, fire, flood, natural disaster, act of terrorism, strike, lock-out, labour dispute, public health emergency, civil commotion, riot, or act of war.
 
-13.14. **Children and minors**. If You are under 18 years old, then by entering into this Agreement You explicitly stipulate, that (i) You have legal capacity to conclude this Agreement or that You have valid consent from a parent or legal guardian to do so and (ii) You understand the KotlinConf App Privacy Notice. You may not enter into this Agreement if You are under 16 years old. If You do not understand this section, do not understand the KotlinConf App Privacy Notice or do not know whether You have the legal capacity to accept these terms, please ask Your parent or legal guardian for help.
+13.14. **Children and minors**. If You are under 18 years old, then by entering into this Agreement You explicitly stipulate, that (i) You have legal capacity to conclude this Agreement or that You have valid consent from a parent or legal guardian to do so and (ii) You understand the [KotlinConf App Privacy Notice](app-privacy-notice.md). You may not enter into this Agreement if You are under 16 years old. If You do not understand this section, do not understand the [KotlinConf App Privacy Notice](app-privacy-notice.md) or do not know whether You have the legal capacity to accept these terms, please ask Your parent or legal guardian for help.
 
 For further information, please contact us at [info@kotlinconf.com](mailto:info@kotlinconf.com).
 
```

---

### Incident Patch 15: `a2c405ad` (2026-03-19)
**Commit Message**: Extract common Feedback UI and ViewModel

**File**: `app/shared/src/commonMain/composeResources/values-de/strings.xml` (modified, +4/-1)
```diff
@@ -124,11 +124,14 @@ Bitte versuchen Sie es erneut.
     <string name="session_title">Sitzung</string>
     <string name="session_screen_error">Die Details dieser Sitzung sind derzeit nicht verfügbar.</string>
     <string name="session_feedback_sent">Ihr Kommentar wurde gesendet.</string>
-    <string name="session_thanks_for_rating">Danke für Ihre Bewertung!</string>
     <string name="session_watch_video">Aufzeichnung ansehen</string>
     <string name="session_room_state_description_expanded">Erweitert</string>
     <string name="session_room_state_description_collapsed">Eingeklappt</string>
 
+    <string name="feedback_thanks_for_rating">Danke für Ihre Bewertung!</string>
+    <string name="feedback_how_was_the_talk">Wie war der Vortrag?</string>
+    <string name="feedback_how_was_the_workshop">Wie war der Workshop?</string>
+
     <string name="map_title">Karte</string>
     <string name="map_ground_floor">Erdgeschoss</string>
     <string name="map_first_floor">Erster Stock</string>
```

**File**: `app/shared/src/commonMain/composeResources/values/strings.xml` (modified, +4/-1)
```diff
@@ -124,11 +124,14 @@ Please try again.
     <string name="session_title">Session</string>
     <string name="session_screen_error">The details of this session are not available at the moment.</string>
     <string name="session_feedback_sent">Your comment has been sent.</string>
-    <string name="session_thanks_for_rating">Thanks for your rating!</string>
     <string name="session_watch_video">Watch the recording</string>
     <string name="session_room_state_description_expanded">Expanded</string>
     <string name="session_room_state_description_collapsed">Collapsed</string>
 
+    <string name="feedback_thanks_for_rating">Thanks for your rating!</string>
+    <string name="feedback_how_was_the_talk">How was the talk?</string>
+    <string name="feedback_how_was_the_workshop">How was the workshop?</string>
+
     <string name="map_title">Map</string>
     <string name="map_ground_floor">Ground floor</string>
     <string name="map_first_floor">First floor</string>
```

**File**: `app/shared/src/commonMain/kotlin/org/jetbrains/kotlinconf/screens/Feedback.kt` (added, +286/-0)
```diff
@@ -0,0 +1,286 @@
+package org.jetbrains.kotlinconf.screens
+
+import androidx.compose.animation.AnimatedContent
+import androidx.compose.animation.AnimatedVisibility
+import androidx.compose.animation.expandVertically
+import androidx.compose.animation.fadeIn
+import androidx.compose.animation.fadeOut
+import androidx.compose.animation.shrinkVertically
+import androidx.compose.foundation.background
+import androidx.compose.foundation.border
+import androidx.compose.foundation.layout.Arrangement
+import androidx.compose.foundation.layout.Column
+import androidx.compose.foundation.layout.Row
+import androidx.compose.foundation.layout.Spacer
+import androidx.compose.foundation.layout.fillMaxWidth
+import androidx.compose.foundation.layout.height
+import androidx.compose.foundation.layout.padding
+import androidx.compose.foundation.selection.selectable
+import androidx.compose.foundation.selection.selectableGroup
+import androidx.compose.runtime.Composable
+import androidx.compose.runtime.LaunchedEffect
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
+import androidx.compose.runtime.remember
+import androidx.compose.runtime.saveable.rememberSaveable
+import androidx.compose.runtime.setValue
+import androidx.compose.ui.Alignment
+import androidx.compose.ui.Modifier
+import androidx.compose.ui.draw.clip
+import androidx.compose.ui.focus.FocusRequester
+import androidx.compose.ui.focus.focusRequester
+import androidx.compose.ui.hapticfeedback.HapticFeedbackType
+import androidx.compose.ui.platform.LocalHapticFeedback
+import androidx.compose.ui.unit.dp
+import androidx.lifecycle.compose.collectAsStateWithLifecycle
+import dev.zacsweers.metrox.viewmodel.assistedMetroViewModel
+import org.jetbrains.compose.resources.stringResource
+import org.jetbrains.kotlinconf.SessionId
+import org.jetbrains.kotlinconf.generated.resources.Res
+import org.jetbrains.kotlinconf.generated.resources.session_feedback_sent
+import org.jetbrains.kotlinconf.generated.resources.feedback_how_was_the_talk
+import org.jetbrains.kotlinconf.generated.resources.feedback_how_was_the_workshop
+import org.jetbrains.kotlinconf.generated.resources.feedback_thanks_for_rating
+import org.jetbrains.kotlinconf.ui.components.Emotion
+import org.jetbrains.kotlinconf.ui.components.FeedbackForm
+import org.jetbrains.kotlinconf.ui.components.KodeeIconLarge
+import org.jetbrains.kotlinconf.ui.components.KodeeIconSmall
+import org.jetbrains.kotlinconf.ui.components.TalkStatus
+import org.jetbrains.kotlinconf.ui.components.Text
+import org.jetbrains.kotlinconf.ui.theme.KotlinConfTheme
+import org.jetbrains.kotlinconf.utils.LocalNotificationBar
+
+@Composable
+fun FeedbackBlock(
+    sessionId: SessionId,
+    initialEmotion: Emotion?,
+    tags: Set<String>,
+    status: TalkStatus,
+    onPrivacyNoticeNeeded: () -> Unit,
+) {
+    val viewModel = rememberFeedbackViewModel(sessionId, initialEmotion, onPrivacyNoticeNeeded)
+    val selectedEmotion by viewModel.selectedEmotion.collectAsStateWithLifecycle()
+
+    Column {
+        Row(
+            verticalAlignment = Alignment.CenterVertically,
+            horizontalArrangement = Arrangement.spacedBy(8.dp),
+            modifier = Modifier.padding(start = 16.dp),
+        ) {
+            FeedbackQuestion(
+                emotionSelected = selectedEmotion != null,
+                tags = tags,
+                modifier = Modifier.weight(1f),
+            )
+            FeedbackEmotionSelector(viewModel) { emotion, selected, modifier ->
+                KodeeIconSmall(
+                    emotion = emotion,
+                    selected = selected,
+                    modifier = modifier.padding(12.dp),
+                )
+            }
+        }
+        FeedbackFormSection(
+            viewModel = viewModel,
+            past = status == TalkStatus.Past,
+        )
+    }
+}
+
+@Composable
+fun FeedbackPanel(
+    sessionId: SessionId,
+    initialEmotion: Emotion?,
+    tags: Set<String>,
+    onPrivacyNoticeNeeded: () -> Unit,
+    modifier: Modifier = Modifier,
+) {
+    val viewModel = rememberFeedbackViewModel(sessionId, initialEmotion, onPrivacyNoticeNeeded)
+    val selectedEmotion by viewModel.selectedEmotion.collectAsStateWithLifecycle()
+
+    Column(
+        modifier = modifier
+            .fillMaxWidth()
+            .padding(vertical = 8.dp)
+            .border(
+                width = 1.dp,
+                color = KotlinConfTheme.colors.strokePale,
+                shape = KotlinConfTheme.shapes.roundedCornerMd,
+            )
+            .clip(KotlinConfTheme.shapes.roundedCornerMd)
+            .background(KotlinConfTheme.colors.cardBackgroundPast),
+        horizontalAlignment = Alignment.CenterHorizontally,
+    ) {
+        Column(
+            modifier = Modifier.padding(horizontal = 24.dp, vertical = 16.dp),
+            horizontalAlignment = Alignment.CenterHorizontally,
+        ) {
+            FeedbackQuestion(
+                emoti
```

**File**: `app/shared/src/commonMain/kotlin/org/jetbrains/kotlinconf/screens/FeedbackViewModel.kt` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+package org.jetbrains.kotlinconf.screens
+
+import androidx.lifecycle.ViewModel
+import androidx.lifecycle.viewModelScope
+import dev.zacsweers.metro.AppScope
+import dev.zacsweers.metro.Assisted
+import dev.zacsweers.metro.AssistedFactory
+import dev.zacsweers.metro.AssistedInject
+import dev.zacsweers.metro.ContributesIntoMap
+import dev.zacsweers.metrox.viewmodel.ManualViewModelAssistedFactory
+import dev.zacsweers.metrox.viewmodel.ManualViewModelAssistedFactoryKey
+import kotlinx.coroutines.flow.MutableStateFlow
+import kotlinx.coroutines.flow.StateFlow
+import kotlinx.coroutines.flow.asStateFlow
+import kotlinx.coroutines.launch
+import org.jetbrains.kotlinconf.ConferenceService
+import org.jetbrains.kotlinconf.SessionId
+import org.jetbrains.kotlinconf.ui.components.Emotion
+import org.jetbrains.kotlinconf.utils.toScore
+
+@AssistedInject
+class FeedbackViewModel(
+    private val service: ConferenceService,
+    @Assisted private val sessionId: SessionId,
+    @Assisted initialEmotion: Emotion?,
+) : ViewModel() {
+
+    private val _selectedEmotion = MutableStateFlow(initialEmotion)
+    val selectedEmotion: StateFlow<Emotion?> = _selectedEmotion.asStateFlow()
+
+    private val _feedbackExpanded = MutableStateFlow(false)
+    val feedbackExpanded: StateFlow<Boolean> = _feedbackExpanded.asStateFlow()
+
+    private val _navigateToPrivacyNotice = MutableStateFlow(false)
+    val navigateToPrivacyNotice: StateFlow<Boolean> = _navigateToPrivacyNotice.asStateFlow()
+
+    private val _feedbackSent = MutableStateFlow(false)
+    val feedbackSent: StateFlow<Boolean> = _feedbackSent.asStateFlow()
+
+    fun selectEmotion(emotion: Emotion) {
+        val newEmotion = if (emotion == _selectedEmotion.value) null else emotion
+        _selectedEmotion.value = newEmotion
+        _feedbackExpanded.value = newEmotion != null
+        submitVote(newEmotion)
+    }
+
+    fun submitFeedbackWithComment(comment: String) {
+        val emotion = _selectedEmotion.value ?: return
+        viewModelScope.launch {
+            if (service.isPolicySigned()) {
+                service.vote(sessionId, emotion.toScore())
+                service.sendFeedback(sessionId, comment)
+                _feedbackExpanded.value = false
+                _feedbackSent.value = true
+            } else {
+                _navigateToPrivacyNotice.value = true
+            }
+        }
+    }
+
+    fun skipComment() {
+        _feedbackExpanded.value = false
+    }
+
+    fun onNavigatedToPrivacyNotice() {
+        _navigateToPrivacyNotice.value = false
+    }
+
+    fun onFeedbackSentHandled() {
+        _feedbackSent.value = false
+    }
+
+    private fun submitVote(emotion: Emotion?) {
+        viewModelScope.launch {
+            if (service.isPolicySigned()) {
+                service.vote(sessionId, emotion?.toScore())
+            } else {
+                _navigateToPrivacyNotice.value = true
+            }
+        }
+    }
+
+    @AssistedFactory
+    @ManualViewModelAssistedFactoryKey(Factory::class)
+    @ContributesIntoMap(AppScope::class)
+    fun interface Factory : ManualViewModelAssistedFactory {
+        fun create(sessionId: SessionId, initialEmotion: Emotion?): FeedbackViewModel
+    }
+}
```

**File**: `app/shared/src/commonMain/kotlin/org/jetbrains/kotlinconf/screens/ScheduleScreen.kt` (modified, +21/-39)
```diff
@@ -53,11 +53,9 @@ import org.jetbrains.kotlinconf.generated.resources.schedule_error_no_data
 import org.jetbrains.kotlinconf.generated.resources.schedule_in_x_minutes
 import org.jetbrains.kotlinconf.generated.resources.schedule_label_no_bookmarks
 import org.jetbrains.kotlinconf.generated.resources.schedule_number_of_results
-import org.jetbrains.kotlinconf.generated.resources.session_feedback_sent
 import org.jetbrains.kotlinconf.isLive
 import org.jetbrains.kotlinconf.toEmotion
 import org.jetbrains.kotlinconf.ui.components.DayHeader
-import org.jetbrains.kotlinconf.ui.components.Emotion
 import org.jetbrains.kotlinconf.ui.components.FilterItem
 import org.jetbrains.kotlinconf.ui.components.Filters
 import org.jetbrains.kotlinconf.ui.components.HorizontalDivider
@@ -82,7 +80,6 @@ import org.jetbrains.kotlinconf.ui.theme.KotlinConfTheme
 import org.jetbrains.kotlinconf.utils.DateTimeFormatting
 import org.jetbrains.kotlinconf.utils.ErrorLoadingContent
 import org.jetbrains.kotlinconf.utils.ErrorLoadingState
-import org.jetbrains.kotlinconf.utils.LocalNotificationBar
 import org.jetbrains.kotlinconf.utils.bottomInsetPadding
 import org.jetbrains.kotlinconf.utils.topInsetPadding
 
@@ -98,14 +95,6 @@ fun ScheduleScreen(
     val listState = rememberLazyListState()
 
     val state = viewModel.uiState.collectAsStateWithLifecycle().value
-    val shouldNavigateToPrivacyNotice by viewModel.navigateToPrivacyNotice.collectAsStateWithLifecycle()
-
-    LaunchedEffect(shouldNavigateToPrivacyNotice) {
-        if (shouldNavigateToPrivacyNotice) {
-            onPrivacyNoticeNeeded()
-            viewModel.onNavigatedToPrivacyNotice()
-        }
-    }
 
     var headerState by rememberSaveable { mutableStateOf(MainHeaderContainerState.Title) }
     val isSearch = rememberSaveable(headerState) { headerState == MainHeaderContainerState.Search }
@@ -225,15 +214,10 @@ fun ScheduleScreen(
                     listState = listState,
                     isSearch = isSearch,
                     dayInfoMap = dayInfoMap,
-                    onSubmitFeedback = { sessionId, emotion ->
-                        viewModel.onSubmitFeedback(sessionId, emotion)
-                    },
-                    onSubmitFeedbackWithComment = { sessionId, emotion, comment ->
-                        viewModel.onSubmitFeedbackWithComment(sessionId, emotion, comment)
-                    },
                     onBookmark = { sessionId, isBookmarked ->
                         viewModel.onBookmark(sessionId, isBookmarked)
                     },
+                    onPrivacyNoticeNeeded = onPrivacyNoticeNeeded,
                     filterItems = tags,
                     onToggleFilter = { item, selected -> viewModel.toggleFilter(item, selected) },
                     modifier = Modifier.fillMaxSize()
@@ -369,9 +353,8 @@ private fun ScheduleList(
     listState: LazyListState,
     isSearch: Boolean,
     dayInfoMap: Map<LocalDate, DayInfo>,
-    onSubmitFeedback: (SessionId, Emotion?) -> Unit,
-    onSubmitFeedbackWithComment: (SessionId, Emotion, String) -> Unit,
     onBookmark: (SessionId, Boolean) -> Unit,
+    onPrivacyNoticeNeeded: () -> Unit,
     filterItems: List<FilterItem> = emptyList(),
     onToggleFilter: (FilterItem, Boolean) -> Unit = { _, _ -> },
     modifier: Modifier = Modifier,
@@ -465,9 +448,8 @@ private fun ScheduleList(
                             tagHighlights = item.tagMatches,
                             speakerHighlights = item.speakerHighlights,
                             onBookmark = onBookmark,
-                            onSubmitFeedback = onSubmitFeedback,
-                            onSubmitFeedbackWithComment = onSubmitFeedbackWithComment,
                             onSession = onSession,
+                            onPrivacyNoticeNeeded = onPrivacyNoticeNeeded,
                             modifier = Modifier
                                 .fillMaxWidth()
                                 .padding(horizontal = 12.dp, vertical = 8.dp)
@@ -522,17 +504,19 @@ private fun ScheduleList(
 private fun SessionCard(
     session: SessionCardView,
     onBookmark: (SessionId, Boolean) -> Unit,
-    onSubmitFeedback: (SessionId, Emotion?) -> Unit,
-    onSubmitFeedbackWithComment: (SessionId, Emotion, String) -> Unit,
     onSession: (SessionId) -> Unit,
+    onPrivacyNoticeNeeded: () -> Unit,
     isSearch: Boolean,
     modifier: Modifier = Modifier,
     titleHighlights: List<IntRange> = emptyList(),
     tagHighlights: List<String> = emptyList(),
     speakerHighlights: List<IntRange> = emptyList(),
 ) {
-    val notificationBar = LocalNotificationBar.current
-    val feedbackSentMessage = stringResource(Res.string.session_feedback_sent)
+    val status = when (session.state) {
+        SessionState.Live -> TalkStatus.Live
+        SessionState.Past -> TalkStatus.Past
+        SessionState.Upcoming -> TalkStatus.Upcoming
+    }
     TalkCard(
         title = session.title,
         titleHighlight
```

**File**: `app/shared/src/commonMain/kotlin/org/jetbrains/kotlinconf/screens/ScheduleViewModel.kt` (modified, +0/-33)
```diff
@@ -23,20 +23,17 @@ import kotlinx.datetime.LocalDateTime
 import org.jetbrains.kotlinconf.ConferenceService
 import org.jetbrains.kotlinconf.Day
 import org.jetbrains.kotlinconf.DayInfo
-import org.jetbrains.kotlinconf.Score
 import org.jetbrains.kotlinconf.SessionCardView
 import org.jetbrains.kotlinconf.SessionId
 import org.jetbrains.kotlinconf.SessionState
 import org.jetbrains.kotlinconf.TimeProvider
 import org.jetbrains.kotlinconf.TimeSlot
 import org.jetbrains.kotlinconf.isServiceEvent
-import org.jetbrains.kotlinconf.ui.components.Emotion
 import org.jetbrains.kotlinconf.ui.components.FilterItem
 import org.jetbrains.kotlinconf.ui.components.FilterItemType
 import org.jetbrains.kotlinconf.utils.ErrorLoadingState
 import org.jetbrains.kotlinconf.utils.containsDiacritics
 import org.jetbrains.kotlinconf.utils.removeDiacritics
-import org.jetbrains.kotlinconf.utils.toScore
 
 sealed interface ScheduleListItem
 
@@ -82,9 +79,6 @@ class ScheduleViewModel(
     private val service: ConferenceService,
     private val timeProvider: TimeProvider,
 ) : ViewModel() {
-    private val _navigateToPrivacyNotice = MutableStateFlow(false)
-    val navigateToPrivacyNotice: StateFlow<Boolean> = _navigateToPrivacyNotice.asStateFlow()
-
     private val searchParams = MutableStateFlow(ScheduleSearchParams())
 
     private fun List<String>.toFilterItems(type: FilterItemType): List<FilterItem> {
@@ -329,33 +323,6 @@ class ScheduleViewModel(
         )
     }
 
-    fun onSubmitFeedback(sessionId: SessionId, emotion: Emotion?) {
-        val score = emotion?.toScore()
-        viewModelScope.launch {
-            if (service.isPolicySigned()) {
-                service.vote(sessionId, score)
-            } else {
-                _navigateToPrivacyNotice.value = true
-            }
-        }
-    }
-
-    fun onSubmitFeedbackWithComment(sessionId: SessionId, emotion: Emotion, comment: String) {
-        val score = emotion.toScore()
-        viewModelScope.launch {
-            if (service.isPolicySigned()) {
-                service.vote(sessionId, score)
-                service.sendFeedback(sessionId, comment)
-            } else {
-                _navigateToPrivacyNotice.value = true
-            }
-        }
-    }
-
-    fun onNavigatedToPrivacyNotice() {
-        _navigateToPrivacyNotice.value = false
-    }
-
     fun onBookmark(sessionId: SessionId, bookmarked: Boolean) {
         viewModelScope.launch {
             service.setFavorite(sessionId, bookmarked)
```

**File**: `app/shared/src/commonMain/kotlin/org/jetbrains/kotlinconf/screens/SessionScreen.kt` (modified, +3/-159)
```diff
@@ -1,21 +1,15 @@
 package org.jetbrains.kotlinconf.screens
 
-import androidx.compose.animation.AnimatedContent
 import androidx.compose.animation.AnimatedVisibility
 import androidx.compose.animation.core.animateFloatAsState
-import androidx.compose.animation.core.tween
 import androidx.compose.animation.expandVertically
 import androidx.compose.animation.fadeIn
 import androidx.compose.animation.fadeOut
 import androidx.compose.animation.shrinkVertically
-import androidx.compose.animation.togetherWith
 import androidx.compose.foundation.background
-import androidx.compose.foundation.border
 import androidx.compose.foundation.clickable
-import androidx.compose.foundation.layout.Arrangement
 import androidx.compose.foundation.layout.Column
 import androidx.compose.foundation.layout.ExperimentalLayoutApi
-import androidx.compose.foundation.layout.Row
 import androidx.compose.foundation.layout.Spacer
 import androidx.compose.foundation.layout.fillMaxSize
 import androidx.compose.foundation.layout.fillMaxWidth
@@ -24,23 +18,14 @@ import androidx.compose.foundation.layout.heightIn
 import androidx.compose.foundation.layout.padding
 import androidx.compose.foundation.rememberScrollState
 import androidx.compose.foundation.verticalScroll
-import androidx.compose.foundation.selection.selectable
-import androidx.compose.foundation.selection.selectableGroup
 import androidx.compose.runtime.Composable
-import androidx.compose.runtime.LaunchedEffect
 import org.jetbrains.kotlinconf.utils.ErrorLoadingState
 import androidx.compose.runtime.getValue
 import androidx.compose.runtime.mutableStateOf
-import androidx.compose.runtime.remember
 import androidx.compose.runtime.saveable.rememberSaveable
 import androidx.compose.runtime.setValue
-import androidx.compose.ui.Alignment
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.draw.clip
-import androidx.compose.ui.focus.FocusRequester
-import androidx.compose.ui.focus.focusRequester
-import androidx.compose.ui.hapticfeedback.HapticFeedbackType
-import androidx.compose.ui.platform.LocalHapticFeedback
 import androidx.compose.ui.semantics.semantics
 import androidx.compose.ui.semantics.stateDescription
 import androidx.compose.ui.unit.dp
@@ -65,27 +50,18 @@ import org.jetbrains.kotlinconf.generated.resources.session_room_state_descripti
 import org.jetbrains.kotlinconf.generated.resources.session_screen_error
 import org.jetbrains.kotlinconf.generated.resources.session_title
 import org.jetbrains.kotlinconf.generated.resources.session_watch_video
-import org.jetbrains.kotlinconf.generated.resources.session_feedback_sent
-import org.jetbrains.kotlinconf.generated.resources.session_thanks_for_rating
 import org.jetbrains.kotlinconf.toEmotion
 import org.jetbrains.kotlinconf.ui.components.Action
 import org.jetbrains.kotlinconf.ui.components.ActionSize
-import org.jetbrains.kotlinconf.ui.components.Emotion
-import org.jetbrains.kotlinconf.ui.components.FeedbackForm
 import org.jetbrains.kotlinconf.ui.components.HorizontalDivider
-import org.jetbrains.kotlinconf.ui.components.KodeeIconLarge
 import org.jetbrains.kotlinconf.ui.components.MainHeaderTitleBar
 import org.jetbrains.kotlinconf.ui.components.PageMenuItem
 import org.jetbrains.kotlinconf.ui.components.PageTitle
 import org.jetbrains.kotlinconf.ui.components.SpeakerCard
 import org.jetbrains.kotlinconf.ui.components.Text
 import org.jetbrains.kotlinconf.ui.components.TopMenuButton
-import org.jetbrains.kotlinconf.ui.generated.resources.UiRes
-import org.jetbrains.kotlinconf.ui.generated.resources.talk_card_how_was_the_talk
-import org.jetbrains.kotlinconf.ui.generated.resources.talk_card_how_was_the_workshop
 import org.jetbrains.kotlinconf.ui.theme.KotlinConfTheme
 import org.jetbrains.kotlinconf.utils.ErrorLoadingContent
-import org.jetbrains.kotlinconf.utils.LocalNotificationBar
 import org.jetbrains.kotlinconf.utils.bottomInsetPadding
 import org.jetbrains.kotlinconf.utils.topInsetPadding
 
@@ -103,14 +79,6 @@ fun SessionScreen(
 ) {
     val sessionState = viewModel.session.collectAsStateWithLifecycle().value
     val speakers = viewModel.speakers.collectAsStateWithLifecycle().value
-    val shouldNavigateToPrivacyNotice by viewModel.navigateToPrivacyNotice.collectAsStateWithLifecycle()
-
-    LaunchedEffect(shouldNavigateToPrivacyNotice) {
-        if (shouldNavigateToPrivacyNotice) {
-            onPrivacyNoticeNeeded()
-            viewModel.onNavigatedToPrivacyNotice()
-        }
-    }
 
     Column(
         modifier = Modifier
@@ -175,17 +143,10 @@ fun SessionScreen(
 
                 if (session.state != SessionState.Upcoming) {
                     FeedbackPanel(
-                        onFeedback = { emotion ->
-                            viewModel.submitFeedback(emotion)
-                        },
-                        onFeedbackWithComment = { emotion, comment ->
-                            viewModel.submitFeedbackWithComment(emotion, comment)
-                        },
+          
```

**File**: `app/shared/src/commonMain/kotlin/org/jetbrains/kotlinconf/screens/SessionViewModel.kt` (modified, +0/-33)
```diff
@@ -9,20 +9,15 @@ import dev.zacsweers.metro.AssistedInject
 import dev.zacsweers.metro.ContributesIntoMap
 import dev.zacsweers.metrox.viewmodel.ManualViewModelAssistedFactory
 import dev.zacsweers.metrox.viewmodel.ManualViewModelAssistedFactoryKey
-import kotlinx.coroutines.flow.MutableStateFlow
 import kotlinx.coroutines.flow.SharingStarted
 import kotlinx.coroutines.flow.StateFlow
-import kotlinx.coroutines.flow.asStateFlow
 import kotlinx.coroutines.flow.map
 import kotlinx.coroutines.flow.stateIn
 import kotlinx.coroutines.launch
 import org.jetbrains.kotlinconf.ConferenceService
-import org.jetbrains.kotlinconf.Score
-import org.jetbrains.kotlinconf.utils.toScore
 import org.jetbrains.kotlinconf.SessionCardView
 import org.jetbrains.kotlinconf.SessionId
 import org.jetbrains.kotlinconf.Speaker
-import org.jetbrains.kotlinconf.ui.components.Emotion
 import org.jetbrains.kotlinconf.utils.ErrorLoadingState
 
 @AssistedInject
@@ -31,9 +26,6 @@ class SessionViewModel(
     @Assisted private val sessionId: SessionId,
 ) : ViewModel() {
 
-    private val _navigateToPrivacyNotice = MutableStateFlow(false)
-    val navigateToPrivacyNotice: StateFlow<Boolean> = _navigateToPrivacyNotice.asStateFlow()
-
     val session: StateFlow<ErrorLoadingState<SessionCardView>> = service.sessionByIdFlow(sessionId)
         .map { session ->
             if (session != null) ErrorLoadingState.Content(session)
@@ -50,31 +42,6 @@ class SessionViewModel(
         }
     }
 
-    fun submitFeedback(emotion: Emotion?) {
-        viewModelScope.launch {
-            if (service.isPolicySigned()) {
-                service.vote(sessionId, emotion?.toScore())
-            } else {
-                _navigateToPrivacyNotice.value = true
-            }
-        }
-    }
-
-    fun submitFeedbackWithComment(emotion: Emotion, comment: String) {
-        viewModelScope.launch {
-            if (service.isPolicySigned()) {
-                service.vote(sessionId, emotion.toScore())
-                service.sendFeedback(sessionId, comment)
-            } else {
-                _navigateToPrivacyNotice.value = true
-            }
-        }
-    }
-
-    fun onNavigatedToPrivacyNotice() {
-        _navigateToPrivacyNotice.value = false
-    }
-
     @AssistedFactory
     @ManualViewModelAssistedFactoryKey(Factory::class)
     @ContributesIntoMap(AppScope::class)
```

#### Recent Merged Pull Requests:
- **PR #737** (2026-09-17): Update Junie workflow reference (@nikpachoo)
- **PR #736** (2026-10-05): Bump Compose Multiplatform to 1.12.0 and its aligned libraries (@zsmb13)
- **PR #734** (2026-09-07): Pin desktop target to toolchain 21 (@SebastianAigner)
- **PR #733** (2026-08-12): Update iOS code signing identity to "Apple Distribution" (@zsmb13)
- **PR #732** (2026-08-07): Bump dependency versions (@zsmb13)
- **PR #730** (2026-07-31): Align version catalog aliases with a shared convention (@zsmb13)
- **PR #728** (2026-07-06): Remove yearless client-data backend routes (@zsmb13)
- **PR #727** (2026-07-08): Add ProGuard configuration for desktop release build (@zsmb13)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
