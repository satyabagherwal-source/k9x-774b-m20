# Forensic Learning Record (Deep Inspection): joreilly/Confetti

> **Canonical Artifact**: `07_PROJECT_LEARNING/joreilly-confetti-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/joreilly/Confetti](https://github.com/joreilly/Confetti))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:26:26.077Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `joreilly/Confetti`
- **Description**: KMP/CMP GraphQL based conference project with Jetpack Compose Android, Compose for Wear, and Compose Multiplatform Desktop, Web and iOS clients along with GraphQL backend.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1061 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `androidApp/src/main/java/dev/johnoreilly/confetti/account/WearUiState.kt`
```
package dev.johnoreilly.confetti.account

import com.google.android.horologist.data.apphelper.AppHelperNodeStatus
import com.google.android.horologist.data.apphelper.AppInstallationStatus

data class WearUiState(
    val wearNodes: List<AppHelperNodeStatus> = listOf()
) {
    val showInstallOnWear: Boolean
        get() = wearNodes.find {
            it.appInstallationStatus is AppInstallationStatus.NotInstalled
        } != null
}

```

### Core Architecture Module: `androidApp/src/main/java/dev/johnoreilly/confetti/utils/LocalDateTime.kt`
```
package dev.johnoreilly.confetti.utils

import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.toJavaLocalDate
import kotlinx.datetime.toJavaLocalDateTime
import java.time.format.DateTimeFormatter

/** @see [DateTimeFormatter.format] */
fun DateTimeFormatter.format(date: LocalDate): String =
    format(date.toJavaLocalDate())

/** @see [DateTimeFormatter.format] */
fun DateTimeFormatter.format(date: LocalDateTime): String =
    format(date.toJavaLocalDateTime())

```

### Core Architecture Module: `androidApp/src/main/java/dev/johnoreilly/confetti/utils/PaddingValuesExt.kt`
```
package dev.johnoreilly.confetti.utils

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection

operator fun PaddingValues.plus(that: PaddingValues): PaddingValues = object : PaddingValues {
    override fun calculateBottomPadding(): Dp =
        this@plus.calculateBottomPadding() + that.calculateBottomPadding()

    override fun calculateLeftPadding(layoutDirection: LayoutDirection): Dp =
        this@plus.calculateLeftPadding(layoutDirection) + that.calculateLeftPadding(layoutDirection)

    override fun calculateRightPadding(layoutDirection: LayoutDirection): Dp =
        this@plus.calculateRightPadding(layoutDirection) + that.calculateRightPadding(layoutDirection)

    override fun calculateTopPadding(): Dp =
        this@plus.calculateTopPadding() + that.calculateTopPadding()
}
```

### Core Architecture Module: `androidApp/src/main/java/dev/johnoreilly/confetti/utils/RememberRunnable.kt`
```
package dev.johnoreilly.confetti.utils

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisallowComposableCalls
import androidx.compose.runtime.remember

/**
 * Remember a runnable wrapping the given [calculation]. Recomposition will always return the
 * same runnable.
 */
@Composable
inline fun rememberRunnable(
    crossinline calculation: @DisallowComposableCalls () -> Unit
): () -> Unit = remember { { calculation() } }

/**
 * Remember a runnable wrapping the given [calculation] if [key1] is equal to
 * the previous composition, otherwise produce and remember a new runnable.
 */
@Composable
inline fun rememberRunnable(
    key1: Any? = null,
    crossinline calculation: @DisallowComposableCalls () -> Unit
): () -> Unit = remember(key1) { { calculation() } }

/**
 * Remember a runnable wrapping the given [calculation] if [key1] and [key2] are equal to
 * the previous composition, otherwise produce and remember a new runnable.
 */
@Composable
inline fun rememberRunnable(
    key1: Any? = null,
    key2: Any? = null,
    crossinline calculation: @DisallowComposableCalls () -> Unit
): () -> Unit = remember(key1, key2) { { calculation() } }

/**
 * Remember a runnable wrapping the given [calculation] if [key1], [key2] and [key3] are equal to
 * the previous composition, otherwise produce and remember a new runnable.
 */
@Composable
inline fun rememberRunnable(
    key1: Any? = null,
    key2: Any? = null,
    key3: Any? = null,
    crossinline calculation: @DisallowComposableCalls () -> Unit
): () -> Unit = remember(key1, key2, key3) { { calculation() } }

```

### Core Architecture Module: `backend/service-import/src/jvmMain/kotlin/dev/johnoreilly/confetti/backend/import/utils.kt`
```
@file:OptIn(ExperimentalCoroutinesApi::class)

package dev.johnoreilly.confetti.backend.import

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import net.mbonnin.bare.graphql.toAny
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.coroutines.executeAsync

private val okHttpClient = OkHttpClient.Builder()
    .build()

suspend fun getUrl(url: String): String {
    val request = Request(url.toHttpUrl())

    val response = okHttpClient.newCall(request).executeAsync()

    return response.use {
        check(it.isSuccessful) {
            "Cannot get $url: ${it.body.string()}"
        }

        withContext(Dispatchers.IO) {
            response.body.string()
        }
    }
}

suspend fun getJsonUrl(url: String) = Json.parseToJsonElement(getUrl(url)).toAny()
```

### Core Architecture Module: `common/car/src/main/java/dev/johnoreilly/confetti/car/utils/AutoUtils.kt`
```
@file:Suppress("DEPRECATION")

package dev.johnoreilly.confetti.car.utils

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.drawable.BitmapDrawable
import android.net.Uri
import android.text.Spannable
import android.text.SpannableString
import androidx.car.app.CarContext
import androidx.car.app.CarToast
import androidx.car.app.HostException
import androidx.car.app.model.CarColor
import androidx.car.app.model.ForegroundCarColorSpan
import coil.imageLoader
import coil.request.ImageRequest
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import dev.johnoreilly.confetti.car.R
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.toJavaLocalDateTime
import java.time.format.DateTimeFormatter

const val METERS_TO_KMS = 1000

suspend fun fetchImage(carContext: CarContext, link: String): Bitmap? {
    val coil = carContext.imageLoader

    val request = ImageRequest.Builder(carContext)
        .data(link)
        .fallback(R.drawable.ic_filled_person)
        .allowHardware(false)
        .build()

    val response = coil.execute(request)
    return (response.drawable as? BitmapDrawable)?.bitmap
}

fun colorize(str: String, color: CarColor, index: Int, length: Int): CharSequence {
    return SpannableString(str).apply {
        setSpan(
            ForegroundCarColorSpan.create(color),
            index,
            index + length,
            Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
        )
    }
}

fun formatDateTime(time: LocalDateTime): String {
    return DateTimeFormatter.ofPattern("MMM d, HH:mm").format(time.toJavaLocalDateTime())
}

fun googleSignInClient(context: Context) = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
    .requestIdToken(context.getString(R.string.default_web_client_id))
    .requestEmail()
    .build().let { GoogleSignIn.getClient(context, it) }


fun navigateTo(carContext: CarContext, latitude: Double, longitude: Double) {
    val uri = Uri.parse("geo:0,0?q=$latitude,$longitude")
    val intent = Intent(CarContext.ACTION_NAVIGATE, uri)

    try {
        carContext.startCarApp(intent)
    } catch (e: HostException) {
        CarToast.makeText(
            carContext,
            carContext.getString(R.string.auto_navigate_to_failed),
            CarToast.LENGTH_SHORT
        ).show()
    }
}
```

### Core Architecture Module: `common/car/src/main/java/dev/johnoreilly/confetti/car/utils/DecomposeUtils.kt`
```
package dev.johnoreilly.confetti.car.utils

import androidx.car.app.Screen
import com.arkivanov.decompose.ComponentContext
import com.arkivanov.decompose.DefaultComponentContext
import com.arkivanov.essenty.lifecycle.essentyLifecycle

fun Screen.defaultComponentContext(): ComponentContext =
    DefaultComponentContext(
        lifecycle = essentyLifecycle(),
    )

```

### Core Architecture Module: `compose-desktop/src/jvmMain/kotlin/Utils.kt`
```
import javax.swing.SwingUtilities

internal fun <T> runOnUiThread(block: () -> T): T {
    if (SwingUtilities.isEventDispatchThread()) {
        return block()
    }

    var result: Result<T>? = null

    SwingUtilities.invokeAndWait {
        result = runCatching(block)
    }

    return requireNotNull(result).getOrThrow()
}

```

### Core Architecture Module: `iosApp/iosApp/Utils.swift`
```
import ConfettiKit

func awaitForState<T: AnyObject>(_ state: Value<T>, predicate: (T) -> Bool) async {
    repeat {
        try? await Task.sleep(for: .milliseconds(500))
    } while (!predicate(state.value))
}

func awaitForState<T: AnyObject, R: AnyObject>(_ state: Value<T>, predicate: (T) -> R?) async -> R {
    while true {
        try? await Task.sleep(for: .milliseconds(500))

        if let result = predicate(state.value) {
            return result
        }
    }
}

```

### Core Architecture Module: `shared/src/androidMain/kotlin/dev/johnoreilly/confetti/utils/AndroidDateService.kt`
```
@file:OptIn(ExperimentalTime::class)

package dev.johnoreilly.confetti.utils

import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toKotlinLocalDateTime
import kotlinx.datetime.toLocalDateTime
import java.time.Instant
import kotlin.time.ExperimentalTime
import kotlin.time.toKotlinInstant

class AndroidDateService: DateService {
    override fun now(): LocalDateTime = java.time.LocalDateTime.now().toKotlinLocalDateTime()
}

// TODO these should call a method on DateService
fun LocalDateTime.Companion.nowAtTimeZone(timeZone: TimeZone) =
    Instant.now().toKotlinInstant().toLocalDateTime(timeZone)
```

### Core Architecture Module: `shared/src/androidMain/kotlin/dev/johnoreilly/confetti/utils/ApolloDebugServer.kt`
```
package dev.johnoreilly.confetti.utils

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.debugserver.ApolloDebugServer

actual fun ApolloClient.registerApolloDebugServer(conference: String) {
    if (isInUnitTests) {
        // No-op in unit tests, as it's called multiple times without calling unregister
        return
    }
    ApolloDebugServer.registerApolloClient(this, conference)
}

actual fun ApolloClient.unregisterApolloDebugServer() {
    ApolloDebugServer.unregisterApolloClient(this)
}

```

### Core Architecture Module: `shared/src/androidMain/kotlin/dev/johnoreilly/confetti/utils/Environment.kt`
```
package dev.johnoreilly.confetti.utils

import android.os.Build

val isInUnitTests = Build.DEVICE == "robolectric"

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #203** (2023-01-16): **Crash in wear app when switching conferences**
  *Symptoms*: Getting crash (due to parsing date as shown here) when switching to different conference.....haven't dug any deeper yet.  <img width="601" alt="Screenshot 2023-01-16 at 17 49 20" src="https://user-images.githubusercontent.com/6302/212739637-b96229ed-2f8a-47b8-bd92-4f195defc4e6.png"> 

- **Issue #202** (2023-01-16): **Progress Indicator not showing in Wear OS client**
  *Symptoms*: Not sure if it's perhaps theme related.....haven't had chance yet to dig any deeper.

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

### Incident Patch 1: `050a661f` (2026-09-20)
**Commit Message**: Batch five green dependency updates, revert Gradle to 9.6.1 (#1929)

* Batch mergeable dependency updates

Combines the five green Renovate PRs so they can be verified together
rather than merged one at a time and re-running CI five times:

- Apollo 5.1.0 -> 5.2.0, apollo-cache 1.0.7 -> 1.0.8 (#1928)
- googleid 1.2.0 -> 1.2.1 (#1927)
- wire-gradle-plugin 6.4.7 -> 7.0.3 (#1923)
- compose-ai-tools 1.61.2 -> 1.85.0, plugin + workflow refs (#1910)
- devcontainers/java image 1-21 -> 3-21 (#1924)

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>

* Revert Gradle wrapper to 9.6.1

Rolls back the 9.7.0 (#1854) and 9.7.1 (#1871) wrapper bumps. Both were
properties-only changes, so this is their exact inverse; the checksum is
the official services.gradle.org sha256 for gradle-9.6.1-bin.zip, which
matches the one recorded when 9.6.1 was first introduced in #1716.

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>

* Hold Gradle below 9.7.0 in Renovate

The 9.6.1 revert does not stick on its own: Renovate re-offers 9.7.1 on
its next run, and CI passes on it because the breakage is IDE-side only
(IntelliJ stable cannot sync the project with the KMP plugin enabled).
Cap the wrapper at <9.7.0 so 9

**File**: `.devcontainer/devcontainer.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "Java",
-  "image": "mcr.microsoft.com/devcontainers/java:1-21",
+  "image": "mcr.microsoft.com/devcontainers/java:3-21",
   "features": {
     "ghcr.io/devcontainers/features/java:1": {
       "version": "none",
```

**File**: `.github/workflows/compose-preview-publish.yml` (modified, +2/-2)
```diff
@@ -39,7 +39,7 @@ jobs:
           github-token: ${{ secrets.GITHUB_TOKEN }}
       - id: pr
         run: echo "number=$(cat _compose_preview_handoff/_pr_number)" >> "$GITHUB_OUTPUT"
-      - uses: yschimke/compose-ai-tools/.github/actions/apply@v1.61.2
+      - uses: yschimke/compose-ai-tools/.github/actions/apply@v1.85.0
         with:
           phase: publish
           handoff-dir: _compose_preview_handoff
@@ -64,7 +64,7 @@ jobs:
           github-token: ${{ secrets.GITHUB_TOKEN }}
       - id: pr
         run: echo "number=$(cat _compose_preview_a11y_handoff/_pr_number)" >> "$GITHUB_OUTPUT"
-      - uses: yschimke/compose-ai-tools/.github/actions/apply@v1.61.2
+      - uses: yschimke/compose-ai-tools/.github/actions/apply@v1.85.0
         with:
           phase: publish
           handoff-dir: _compose_preview_a11y_handoff
```

**File**: `.github/workflows/compose-preview.yml` (modified, +4/-4)
```diff
@@ -85,7 +85,7 @@ jobs:
           cache-read-only: ${{ github.event_name == 'pull_request' }}
       - name: Warm Gradle wrapper
         run: ./gradlew help
-      - uses: yschimke/compose-ai-tools/.github/actions/apply@v1.61.2
+      - uses: yschimke/compose-ai-tools/.github/actions/apply@v1.85.0
         with:
           # Pin the render CLI to the applied Gradle plugin version (single
           # source of truth: composeai-preview in gradle/libs.versions.toml)
@@ -131,7 +131,7 @@ jobs:
           cache-read-only: ${{ github.event_name == 'pull_request' }}
       - name: Warm Gradle wrapper
         run: ./gradlew help
-      - uses: yschimke/compose-ai-tools/.github/actions/apply@v1.61.2
+      - uses: yschimke/compose-ai-tools/.github/actions/apply@v1.85.0
         with:
           cli-version: catalog
           catalog-key: composeai-preview
@@ -166,7 +166,7 @@ jobs:
           cache-read-only: true
       - name: Warm Gradle wrapper
         run: ./gradlew help
-      - uses: yschimke/compose-ai-tools/.github/actions/apply@v1.61.2
+      - uses: yschimke/compose-ai-tools/.github/actions/apply@v1.85.0
         with:
           phase: render
           handoff-dir: _compose_preview_handoff
@@ -206,7 +206,7 @@ jobs:
           cache-read-only: true
       - name: Warm Gradle wrapper
         run: ./gradlew help
-      - uses: yschimke/compose-ai-tools/.github/actions/apply@v1.61.2
+      - uses: yschimke/compose-ai-tools/.github/actions/apply@v1.85.0
         with:
           phase: render
           handoff-dir: _compose_preview_a11y_handoff
```

**File**: `.github/workflows/design-artifacts.yml` (modified, +1/-1)
```diff
@@ -83,7 +83,7 @@ jobs:
       # Install the compose-preview CLI, pinned to the applied plugin version
       # (composeai-preview in gradle/libs.versions.toml) so the CLI and plugin
       # stay in lockstep — exactly as compose-preview.yml does for the apply action.
-      - uses: yschimke/compose-ai-tools/.github/actions/install@v1.61.2
+      - uses: yschimke/compose-ai-tools/.github/actions/install@v1.85.0
         with:
           version: catalog
           catalog-key: composeai-preview
```

**File**: `gradle/libs.versions.toml` (modified, +5/-5)
```diff
@@ -13,9 +13,9 @@ agp = "9.1.1"
 activity-compose = "1.13.0"
 androidx-lifecycle = "2.11.0"
 androidx-datastore = "1.2.1"
-apollo = "5.1.0"
+apollo = "5.2.0"
 apollo-adapters = "0.8.0"
-apollo-cache = "1.0.7"
+apollo-cache = "1.0.8"
 compose-bom = "2026.09.00"
 composeLifecyleRuntime="2.11.0"
 compose-multiplatform = "1.12.0"
@@ -24,7 +24,7 @@ credentials = "1.6.0"
 decompose = "3.5.0"
 doistx-normalize = "1.3.3"
 essenty = "2.6.0"
-googleid = "1.2.0"
+googleid = "1.2.1"
 horologist = "0.8.3-alpha"
 io-coil-kt = "2.7.0"
 io-coil3-kt = "3.6.2"
@@ -56,7 +56,7 @@ generativeai = "0.9.0-1.1.0"
 buildkonfig = "0.22.0"
 roborazzi = "1.74.0"
 screenshot = "0.0.1-alpha16"
-composeai-preview = "1.61.2"
+composeai-preview = "1.85.0"
 koogAgents = "1.2.0"
 koogPromptExecutorAll = "1.2.0-beta"
 
@@ -214,7 +214,7 @@ plugin-kotlin-serialization = { module = "org.jetbrains.kotlin:kotlin-serializat
 plugin-kotlin-spring = { module = "org.jetbrains.kotlin:kotlin-allopen", version.ref = "kotlin" }
 plugin-ksp = { module = "com.google.devtools.ksp:symbol-processing-gradle-plugin", version.ref = "ksp" }
 plugin-spring-boot = { module = "org.springframework.boot:spring-boot-gradle-plugin", version.ref = "spring" }
-plugin-wire = { module = "com.squareup.wire:wire-gradle-plugin", version = "6.4.7" }
+plugin-wire = { module = "com.squareup.wire:wire-gradle-plugin", version = "7.0.3" }
 plugin-compose-multiplatform = { module = "org.jetbrains.compose:compose-gradle-plugin", version.ref = "compose-multiplatform" }
 roborazzi-gradle-plugin = { module = "io.github.takahirom.roborazzi:roborazzi-gradle-plugin", version.ref = "roborazzi" }
 scrimage-core = { module = "com.sksamuel.scrimage:scrimage-core", version.ref = "scrimage" }
```

**File**: `gradle/wrapper/gradle-wrapper.properties` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 distributionBase=GRADLE_USER_HOME
 distributionPath=wrapper/dists
-distributionSha256Sum=acd53f1edaf02f1a8ff99879f8a34b302661a057d9b063ae9e35b552f804d20a
-distributionUrl=https\://services.gradle.org/distributions/gradle-9.7.1-bin.zip
+distributionSha256Sum=9c0f7faeeb306cb14e4279a3e084ca6b596894089a0638e68a07c945a32c9e14
+distributionUrl=https\://services.gradle.org/distributions/gradle-9.6.1-bin.zip
 networkTimeout=10000
 validateDistributionUrl=true
 zipStoreBase=GRADLE_USER_HOME
```

**File**: `renovate.json` (modified, +10/-0)
```diff
@@ -52,6 +52,16 @@
       ],
       "enabled": false
     },
+    {
+      "description": "Gradle 9.7.x breaks Gradle sync in the current stable IntelliJ IDEA when the Kotlin Multiplatform plugin is enabled, so 9.7.0/9.7.1 were reverted back to 9.6.1. CI is green on 9.7.1 and gives no signal about this — the breakage is IDE-side only — so without this rule Renovate re-offers the bump and it looks safe to merge. Cap the wrapper below 9.7.0, which still allows 9.6.x patches. Lift once IntelliJ ships KMP sync support for 9.7.x.",
+      "matchManagers": [
+        "gradle-wrapper"
+      ],
+      "matchPackageNames": [
+        "gradle"
+      ],
+      "allowedVersions": "<9.7.0"
+    },
     {
       "description": "KEEP IN SYNC WITH settings.gradle.kts. Renovate parses that file statically and cannot follow the loop that declares the repositories, so it detected none, fell back to Maven Central, and reported all 47 Google-Maven-only dependencies as \"no-result\" — silently freezing androidx out of updates. plugins.gradle.org is here because Renovate skips Maven Central for plugin markers. The apollo-snapshots repo is omitted on purpose: it is filtered to SNAPSHOTs, which Renovate must not offer.",
       "matchManagers": [
```

---

### Incident Patch 2: `3e529026` (2026-09-14)
**Commit Message**: Merge pull request #1917 from joreilly/fix-cors-header-for-cdn-cached-responses

Always send Access-Control-Allow-Origin so CDN-cached responses stay usable

**File**: `backend/service-graphql/src/main/kotlin/dev/johnoreilly/confetti/backend/DefaultApplication.kt` (modified, +35/-0)
```diff
@@ -33,6 +33,9 @@ import org.springframework.context.ApplicationContext
 import org.springframework.context.ApplicationListener
 import org.springframework.context.ConfigurableApplicationContext
 import org.springframework.context.annotation.Bean
+import org.springframework.core.Ordered
+import org.springframework.core.annotation.Order
+import org.springframework.http.HttpHeaders
 import org.springframework.http.MediaType
 import org.springframework.http.client.reactive.JdkClientHttpConnector
 import org.springframework.http.codec.ServerCodecConfigurer
@@ -43,6 +46,8 @@ import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource
 import org.springframework.web.reactive.function.client.WebClient
 import org.springframework.web.reactive.function.server.*
 import org.springframework.web.reactive.result.view.ViewResolver
+import org.springframework.web.server.WebFilter
+import reactor.core.publisher.Mono
 import java.net.http.HttpClient
 import kotlin.jvm.optionals.getOrNull
 
@@ -62,6 +67,36 @@ class DefaultApplication {
         return CorsWebFilter(source)
     }
 
+    /**
+     * Emit Access-Control-Allow-Origin even when the request carries no Origin header.
+     *
+     * Apollo sends persisted queries as GETs, and those responses are `public, max-age=1800`, so
+     * Cloud CDN caches them - under a key of {protocol, host, query string, conference header}
+     * that does NOT include Origin (see backend/terraform/main.tf). [corsWebFilter] follows the
+     * CORS spec and only adds the header when the request has an Origin, which browsers send and
+     * the mobile apps do not. So whichever client warmed a cache entry decided, for the next 30
+     * minutes, whether browsers could read it: an entry warmed by a mobile request had no
+     * Access-Control-Allow-Origin, and every browser served that copy had the response blocked,
+     * silently leaving the web client with no data.
+     *
+     * The policy above is "*" regardless of caller, so emitting it unconditionally makes every
+     * cached copy valid for every client. Only fills in a header [corsWebFilter] did not already
+     * set, so genuine Origin requests keep their spec-compliant handling.
+     */
+    @Bean
+    @Order(Ordered.HIGHEST_PRECEDENCE)
+    fun cacheSafeCorsHeaderFilter(): WebFilter = WebFilter { exchange, chain ->
+        exchange.response.beforeCommit {
+            exchange.response.headers.apply {
+                if (getFirst(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN) == null) {
+                    set(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "*")
+                }
+            }
+            Mono.empty()
+        }
+        chain.filter(exchange)
+    }
+
     @Bean
     fun errorWebExceptionHandler(
         errorAttributes: ErrorAttributes?,
```

---

### Incident Patch 3: `46702334` (2026-09-12)
**Commit Message**: Merge pull request #1916 from joreilly/xcode-skip-gradle-when-ide-builds

Skip the Gradle framework build when the IDE already ran it

**File**: `iosApp/iosApp.xcodeproj/project.pbxproj` (modified, +1/-1)
```diff
@@ -273,7 +273,7 @@
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 			shellPath = /bin/sh;
-			shellScript = "cd \"$SRCROOT/..\"\n./gradlew :shared:embedAndSignAppleFrameworkForXcode\n";
+			shellScript = "if [ \"YES\" = \"$OVERRIDE_KOTLIN_BUILD_IDE_SUPPORTED\" ]; then\n  echo \"Skipping Gradle build task invocation due to OVERRIDE_KOTLIN_BUILD_IDE_SUPPORTED environment variable set to \\\"YES\\\"\"\n  exit 0\nfi\ncd \"$SRCROOT/..\"\n./gradlew :shared:embedAndSignAppleFrameworkForXcode";
 		};
 /* End PBXShellScriptBuildPhase section */
 
```

---

### Incident Patch 4: `e7680fcf` (2026-09-12)
**Commit Message**: Skip the Gradle framework build when the IDE already ran it

The Kotlin IntelliJ/Android Studio plugin sets
OVERRIDE_KOTLIN_BUILD_IDE_SUPPORTED=YES when it drives the build itself,
having already produced the shared framework. Without this guard the run
script phase invokes :shared:embedAndSignAppleFrameworkForXcode a second
time on every IDE-driven build.

This is the script the KMP tooling generates; the phase previously carried
only the cd + gradlew lines.

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01E3Syr6Ss5YAKH69qjbVUe4

**File**: `iosApp/iosApp.xcodeproj/project.pbxproj` (modified, +1/-1)
```diff
@@ -273,7 +273,7 @@
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 			shellPath = /bin/sh;
-			shellScript = "cd \"$SRCROOT/..\"\n./gradlew :shared:embedAndSignAppleFrameworkForXcode\n";
+			shellScript = "if [ \"YES\" = \"$OVERRIDE_KOTLIN_BUILD_IDE_SUPPORTED\" ]; then\n  echo \"Skipping Gradle build task invocation due to OVERRIDE_KOTLIN_BUILD_IDE_SUPPORTED environment variable set to \\\"YES\\\"\"\n  exit 0\nfi\ncd \"$SRCROOT/..\"\n./gradlew :shared:embedAndSignAppleFrameworkForXcode";
 		};
 /* End PBXShellScriptBuildPhase section */
 
```

---

### Incident Patch 5: `8bf79eed` (2026-09-11)
**Commit Message**: Merge pull request #1908 from joreilly/fix-terraform-backend-lb-scheme

Fix Backend Deploy: pin google-beta and set the LB scheme explicitly

**File**: `backend/terraform/main.tf` (modified, +31/-6)
```diff
@@ -3,6 +3,16 @@ terraform {
     bucket = "confetti-tfstate"
     prefix = "terraform/state"
   }
+
+  # Pinned deliberately. With no constraint here and no committed .terraform.lock.hcl, every CI
+  # run downloaded whatever google-beta was newest, so a change to a provider *default* could
+  # (and did) break apply with no commit to this repo - see load_balancing_scheme below.
+  required_providers {
+    google-beta = {
+      source  = "hashicorp/google-beta"
+      version = "~> 8.0"
+    }
+  }
 }
 
 variable "region" {
@@ -105,6 +115,11 @@ resource "google_compute_backend_service" "router" {
   enable_cdn                      = true
   timeout_sec                     = 10
   connection_draining_timeout_sec = 10
+  # Set explicitly: the provider default moved to EXTERNAL_MANAGED, which GCP rejects as an
+  # in-place change ("Cannot change the load balancing scheme until the migration state is
+  # set to TEST_ALL_TRAFFIC"). The forwarding rules further down are EXTERNAL, so the
+  # backend services have to match.
+  load_balancing_scheme           = "EXTERNAL"
 
   custom_request_headers  = ["Host: ${google_compute_global_network_endpoint.router.fqdn}"]
   custom_response_headers = ["X-Cache-Hit: {cdn_cache_status}"]
@@ -131,9 +146,14 @@ resource "google_compute_backend_service" "router" {
 }
 
 resource "google_compute_backend_service" "graphql" {
-  provider   = google-beta
-  name       = "graphql"
-  enable_cdn = true
+  provider              = google-beta
+  name                  = "graphql"
+  enable_cdn            = true
+  # Set explicitly: the provider default moved to EXTERNAL_MANAGED, which GCP rejects as an
+  # in-place change ("Cannot change the load balancing scheme until the migration state is
+  # set to TEST_ALL_TRAFFIC"). The forwarding rules further down are EXTERNAL, so the
+  # backend services have to match.
+  load_balancing_scheme = "EXTERNAL"
 
   custom_response_headers = ["X-Cache-Hit: {cdn_cache_status}"]
 
@@ -160,9 +180,14 @@ resource "google_compute_backend_service" "graphql" {
 }
 
 resource "google_compute_backend_service" "import" {
-  provider   = google-beta
-  name       = "import"
-  enable_cdn = true
+  provider              = google-beta
+  name                  = "import"
+  enable_cdn            = true
+  # Set explicitly: the provider default moved to EXTERNAL_MANAGED, which GCP rejects as an
+  # in-place change ("Cannot change the load balancing scheme until the migration state is
+  # set to TEST_ALL_TRAFFIC"). The forwarding rules further down are EXTERNAL, so the
+  # backend services have to match.
+  load_balancing_scheme = "EXTERNAL"
 
   custom_response_headers = ["X-Cache-Hit: {cdn_cache_status}"]
 
```

---

### Incident Patch 6: `11692d69` (2026-09-11)
**Commit Message**: Fix Backend Deploy: pin google-beta and set the LB scheme explicitly

Backend Deploy has failed on main since 2026-08-31 with no commit causing it:

  Error 400: Invalid value for field 'resource.loadBalancingScheme':
  'EXTERNAL_MANAGED'. Cannot change the load balancing scheme until the
  migration state is set to TEST_ALL_TRAFFIC.

The three google_compute_backend_service resources never set
load_balancing_scheme, and there was no required_providers constraint and no
committed .terraform.lock.hcl - so CI downloaded whatever google-beta was
newest. When the provider's default for that field became EXTERNAL_MANAGED,
the config started planning a change against live infra that is still
EXTERNAL, and GCP rejects it in place.

Set the field explicitly to match the forwarding rules, which already pin
EXTERNAL, and pin the provider so a default cannot move underneath the repo
again.

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01E3Syr6Ss5YAKH69qjbVUe4

**File**: `backend/terraform/main.tf` (modified, +31/-6)
```diff
@@ -3,6 +3,16 @@ terraform {
     bucket = "confetti-tfstate"
     prefix = "terraform/state"
   }
+
+  # Pinned deliberately. With no constraint here and no committed .terraform.lock.hcl, every CI
+  # run downloaded whatever google-beta was newest, so a change to a provider *default* could
+  # (and did) break apply with no commit to this repo - see load_balancing_scheme below.
+  required_providers {
+    google-beta = {
+      source  = "hashicorp/google-beta"
+      version = "~> 8.0"
+    }
+  }
 }
 
 variable "region" {
@@ -105,6 +115,11 @@ resource "google_compute_backend_service" "router" {
   enable_cdn                      = true
   timeout_sec                     = 10
   connection_draining_timeout_sec = 10
+  # Set explicitly: the provider default moved to EXTERNAL_MANAGED, which GCP rejects as an
+  # in-place change ("Cannot change the load balancing scheme until the migration state is
+  # set to TEST_ALL_TRAFFIC"). The forwarding rules further down are EXTERNAL, so the
+  # backend services have to match.
+  load_balancing_scheme           = "EXTERNAL"
 
   custom_request_headers  = ["Host: ${google_compute_global_network_endpoint.router.fqdn}"]
   custom_response_headers = ["X-Cache-Hit: {cdn_cache_status}"]
@@ -131,9 +146,14 @@ resource "google_compute_backend_service" "router" {
 }
 
 resource "google_compute_backend_service" "graphql" {
-  provider   = google-beta
-  name       = "graphql"
-  enable_cdn = true
+  provider              = google-beta
+  name                  = "graphql"
+  enable_cdn            = true
+  # Set explicitly: the provider default moved to EXTERNAL_MANAGED, which GCP rejects as an
+  # in-place change ("Cannot change the load balancing scheme until the migration state is
+  # set to TEST_ALL_TRAFFIC"). The forwarding rules further down are EXTERNAL, so the
+  # backend services have to match.
+  load_balancing_scheme = "EXTERNAL"
 
   custom_response_headers = ["X-Cache-Hit: {cdn_cache_status}"]
 
@@ -160,9 +180,14 @@ resource "google_compute_backend_service" "graphql" {
 }
 
 resource "google_compute_backend_service" "import" {
-  provider   = google-beta
-  name       = "import"
-  enable_cdn = true
+  provider              = google-beta
+  name                  = "import"
+  enable_cdn            = true
+  # Set explicitly: the provider default moved to EXTERNAL_MANAGED, which GCP rejects as an
+  # in-place change ("Cannot change the load balancing scheme until the migration state is
+  # set to TEST_ALL_TRAFFIC"). The forwarding rules further down are EXTERNAL, so the
+  # backend services have to match.
+  load_balancing_scheme = "EXTERNAL"
 
   custom_response_headers = ["X-Cache-Hit: {cdn_cache_status}"]
 
```

---

### Incident Patch 7: `d21add0f` (2026-09-11)
**Commit Message**: Use the resolved simulator for the build step too, not a generic destination

The generic simulator destination builds a universal binary, so Xcode asked
Gradle for x86_64 as well as arm64. This project drops iosX64, so the KMP
framework task rejected it:

  error: Xcode Requested Architecture Not Configured in Gradle

Point build-for-testing at the same concrete simulator the test step uses.
That keeps ARCHS single-arch while still avoiding xcodebuild's flaky
match-by-device-name, which is what this branch set out to fix.

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01E3Syr6Ss5YAKH69qjbVUe4

**File**: `.github/workflows/ios.yml` (modified, +6/-2)
```diff
@@ -121,9 +121,13 @@ jobs:
 
       # Build once for testing (app + test targets) on the simulator, then run the tests
       # without rebuilding. Simulator builds skip code signing / provisioning entirely.
-      # build-for-testing needs no concrete device, so it takes the generic destination.
+      # Both steps target the one resolved simulator. A generic destination
+      # ('generic/platform=iOS Simulator') looks tempting here but builds a universal binary,
+      # asking Gradle for x86_64 as well - and this project drops iosX64, so that fails with
+      # "Xcode Requested Architecture Not Configured in Gradle". A concrete arm64 simulator
+      # keeps ARCHS single-arch.
       - name: Build iOS app for testing
-        run: xcodebuild build-for-testing -project iosApp/iosApp.xcodeproj -configuration Debug -scheme iosApp -sdk iphonesimulator -destination 'generic/platform=iOS Simulator'
+        run: xcodebuild build-for-testing -project iosApp/iosApp.xcodeproj -configuration Debug -scheme iosApp -sdk iphonesimulator -destination "id=${{ steps.simulator.outputs.udid }}"
 
       - name: Run iOS unit tests
         run: xcodebuild test-without-building -project iosApp/iosApp.xcodeproj -configuration Debug -scheme iosApp -sdk iphonesimulator -destination "id=${{ steps.simulator.outputs.udid }}" -test-timeouts-enabled YES
```

---

### Incident Patch 8: `e1356428` (2026-09-11)
**Commit Message**: Merge pull request #1906 from joreilly/fix-desktop-window-size-class

Fix desktop crash on startup from removed Compose LocalWindow

**File**: `shared/src/commonMain/kotlin/dev/johnoreilly/confetti/ui/App.kt` (modified, +4/-4)
```diff
@@ -41,7 +41,6 @@ import androidx.compose.material3.SnackbarHost
 import androidx.compose.material3.SnackbarHostState
 import androidx.compose.material3.Text
 import androidx.compose.material3.windowsizeclass.ExperimentalMaterial3WindowSizeClassApi
-import androidx.compose.material3.windowsizeclass.calculateWindowSizeClass
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.CompositionLocalProvider
 import androidx.compose.runtime.getValue
@@ -85,6 +84,7 @@ import dev.johnoreilly.confetti.ui.settings.SettingsUI
 import dev.johnoreilly.confetti.ui.speakers.SpeakerDetailsUI
 import dev.johnoreilly.confetti.ui.speakers.SpeakersUI
 import dev.johnoreilly.confetti.ui.venue.VenueUI
+import dev.johnoreilly.confetti.utils.currentWindowSizeClass
 import dev.johnoreilly.confetti.utils.isExpanded
 import org.jetbrains.compose.resources.stringResource
 
@@ -106,7 +106,7 @@ fun App(component: DefaultAppComponent) {
 @OptIn(ExperimentalDecomposeApi::class, ExperimentalMaterial3WindowSizeClassApi::class)
 @Composable
 fun ConferenceView(component: ConferenceComponent) {
-    val windowSizeClass = calculateWindowSizeClass()
+    val windowSizeClass = currentWindowSizeClass()
     ConferenceMaterialThemeFromSettings(component.conferenceThemeColor) {
         ChildStack(
             stack = component.stack,
@@ -146,7 +146,7 @@ fun ConferenceView(component: ConferenceComponent) {
                 is ConferenceComponent.Child.Search -> {
                     SearchUI(
                         component = child.component,
-                        windowSizeClass = calculateWindowSizeClass(),
+                        windowSizeClass = currentWindowSizeClass(),
                         onBackClick = component::onBackClicked,
                     )
                 }
@@ -159,7 +159,7 @@ fun ConferenceView(component: ConferenceComponent) {
 @OptIn(ExperimentalMaterial3WindowSizeClassApi::class)
 @Composable
 fun HomeView(component: HomeComponent) {
-    val windowSizeClass = calculateWindowSizeClass()
+    val windowSizeClass = currentWindowSizeClass()
     val shouldShowNavRail = windowSizeClass.isExpanded
     val snackbarHostState = remember { SnackbarHostState() }
     val hazeState = remember { HazeState() }
```

**File**: `shared/src/commonMain/kotlin/dev/johnoreilly/confetti/utils/UIUtils.kt` (modified, +23/-1)
```diff
@@ -1,11 +1,33 @@
 package dev.johnoreilly.confetti.utils
 
+import androidx.compose.material3.windowsizeclass.ExperimentalMaterial3WindowSizeClassApi
 import androidx.compose.material3.windowsizeclass.WindowSizeClass
 import androidx.compose.material3.windowsizeclass.WindowWidthSizeClass
+import androidx.compose.runtime.Composable
+import androidx.compose.ui.platform.LocalDensity
+import androidx.compose.ui.platform.LocalWindowInfo
+import androidx.compose.ui.unit.toSize
 
 val WindowSizeClass.isExpanded: Boolean
     get() = widthSizeClass == WindowWidthSizeClass.Expanded
 
 
 val WindowSizeClass.isCompact: Boolean
-    get() = widthSizeClass == WindowWidthSizeClass.Compact
\ No newline at end of file
+    get() = widthSizeClass == WindowWidthSizeClass.Compact
+
+
+/**
+ * Replacement for material3-window-size-class-multiplatform's own
+ * `calculateWindowSizeClass()`. Its desktop actual reaches for
+ * `androidx.compose.ui.window.LocalWindow`, which Compose Multiplatform 1.12 removed, so calling it
+ * throws NoClassDefFoundError at first composition on desktop. Deriving the size from
+ * LocalWindowInfo instead uses only common Compose UI API, so one implementation serves every
+ * target.
+ */
+@OptIn(ExperimentalMaterial3WindowSizeClassApi::class)
+@Composable
+fun currentWindowSizeClass(): WindowSizeClass =
+    WindowSizeClass.calculateFromSize(
+        size = LocalWindowInfo.current.containerSize.toSize(),
+        density = LocalDensity.current,
+    )
```

---

### Incident Patch 9: `917ff08f` (2026-09-11)
**Commit Message**: Fix desktop crash on startup from removed Compose LocalWindow

The desktop app died at first composition with
NoClassDefFoundError: androidx/compose/ui/window/LocalWindowKt.

material3-window-size-class-multiplatform 0.5.0's desktop actual for
calculateWindowSizeClass() reaches for androidx.compose.ui.window.LocalWindow,
which Compose Multiplatform 1.12 removed - ui-desktop-1.12.0.jar has no such
class. 0.5.0 is that library's latest release, so there is no version to
upgrade to.

Derive the size from LocalWindowInfo + LocalDensity instead and feed the
library's own public WindowSizeClass.calculateFromSize(size, density). That
touches only common Compose UI API, so one implementation covers every target,
and keeping the WindowSizeClass type means the ~10 files that pass it around
are unchanged.

Android and iOS never hit this - their actuals don't use LocalWindow - but they
share App.kt, so both now go through the same path.

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01E3Syr6Ss5YAKH69qjbVUe4

**File**: `shared/src/commonMain/kotlin/dev/johnoreilly/confetti/ui/App.kt` (modified, +4/-4)
```diff
@@ -41,7 +41,6 @@ import androidx.compose.material3.SnackbarHost
 import androidx.compose.material3.SnackbarHostState
 import androidx.compose.material3.Text
 import androidx.compose.material3.windowsizeclass.ExperimentalMaterial3WindowSizeClassApi
-import androidx.compose.material3.windowsizeclass.calculateWindowSizeClass
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.CompositionLocalProvider
 import androidx.compose.runtime.getValue
@@ -85,6 +84,7 @@ import dev.johnoreilly.confetti.ui.settings.SettingsUI
 import dev.johnoreilly.confetti.ui.speakers.SpeakerDetailsUI
 import dev.johnoreilly.confetti.ui.speakers.SpeakersUI
 import dev.johnoreilly.confetti.ui.venue.VenueUI
+import dev.johnoreilly.confetti.utils.currentWindowSizeClass
 import dev.johnoreilly.confetti.utils.isExpanded
 import org.jetbrains.compose.resources.stringResource
 
@@ -106,7 +106,7 @@ fun App(component: DefaultAppComponent) {
 @OptIn(ExperimentalDecomposeApi::class, ExperimentalMaterial3WindowSizeClassApi::class)
 @Composable
 fun ConferenceView(component: ConferenceComponent) {
-    val windowSizeClass = calculateWindowSizeClass()
+    val windowSizeClass = currentWindowSizeClass()
     ConferenceMaterialThemeFromSettings(component.conferenceThemeColor) {
         ChildStack(
             stack = component.stack,
@@ -146,7 +146,7 @@ fun ConferenceView(component: ConferenceComponent) {
                 is ConferenceComponent.Child.Search -> {
                     SearchUI(
                         component = child.component,
-                        windowSizeClass = calculateWindowSizeClass(),
+                        windowSizeClass = currentWindowSizeClass(),
                         onBackClick = component::onBackClicked,
                     )
                 }
@@ -159,7 +159,7 @@ fun ConferenceView(component: ConferenceComponent) {
 @OptIn(ExperimentalMaterial3WindowSizeClassApi::class)
 @Composable
 fun HomeView(component: HomeComponent) {
-    val windowSizeClass = calculateWindowSizeClass()
+    val windowSizeClass = currentWindowSizeClass()
     val shouldShowNavRail = windowSizeClass.isExpanded
     val snackbarHostState = remember { SnackbarHostState() }
     val hazeState = remember { HazeState() }
```

**File**: `shared/src/commonMain/kotlin/dev/johnoreilly/confetti/utils/UIUtils.kt` (modified, +23/-1)
```diff
@@ -1,11 +1,33 @@
 package dev.johnoreilly.confetti.utils
 
+import androidx.compose.material3.windowsizeclass.ExperimentalMaterial3WindowSizeClassApi
 import androidx.compose.material3.windowsizeclass.WindowSizeClass
 import androidx.compose.material3.windowsizeclass.WindowWidthSizeClass
+import androidx.compose.runtime.Composable
+import androidx.compose.ui.platform.LocalDensity
+import androidx.compose.ui.platform.LocalWindowInfo
+import androidx.compose.ui.unit.toSize
 
 val WindowSizeClass.isExpanded: Boolean
     get() = widthSizeClass == WindowWidthSizeClass.Expanded
 
 
 val WindowSizeClass.isCompact: Boolean
-    get() = widthSizeClass == WindowWidthSizeClass.Compact
\ No newline at end of file
+    get() = widthSizeClass == WindowWidthSizeClass.Compact
+
+
+/**
+ * Replacement for material3-window-size-class-multiplatform's own
+ * `calculateWindowSizeClass()`. Its desktop actual reaches for
+ * `androidx.compose.ui.window.LocalWindow`, which Compose Multiplatform 1.12 removed, so calling it
+ * throws NoClassDefFoundError at first composition on desktop. Deriving the size from
+ * LocalWindowInfo instead uses only common Compose UI API, so one implementation serves every
+ * target.
+ */
+@OptIn(ExperimentalMaterial3WindowSizeClassApi::class)
+@Composable
+fun currentWindowSizeClass(): WindowSizeClass =
+    WindowSizeClass.calculateFromSize(
+        size = LocalWindowInfo.current.containerSize.toSize(),
+        density = LocalDensity.current,
+    )
```

---

### Incident Patch 10: `d9d2942f` (2026-09-06)
**Commit Message**: Update dependency com.mikepenz:multiplatform-markdown-renderer-m3 to v0.45.0 (#1893)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `shared/build.gradle.kts` (modified, +1/-1)
```diff
@@ -106,7 +106,7 @@ kotlin {
                 api(libs.compose.window.size)
                 implementation(libs.lifecyle.runtime)
                 implementation(libs.haze)
-                api("com.mikepenz:multiplatform-markdown-renderer-m3:0.44.0")
+                api("com.mikepenz:multiplatform-markdown-renderer-m3:0.45.0")
                 implementation("org.jetbrains.kotlinx:kotlinx-io-core:0.9.1")
 
                 implementation(libs.koog.agents)
```

---

### Incident Patch 11: `38a5098c` (2026-09-01)
**Commit Message**: Add previews for recent mobile UI changes (#1885)

* Add previews for recent mobile UI changes

* fix(previews): provide deterministic speaker images

**File**: `androidApp/src/main/java/dev/johnoreilly/confetti/ui/AndroidScreenPreviews.kt` (modified, +2/-2)
```diff
@@ -39,7 +39,7 @@ import dev.johnoreilly.confetti.ui.speakers.SpeakerDetailsView
 )
 @Composable
 internal fun AndroidSessionDetailPreview() {
-    ConfettiTheme {
+    CatalogTheme {
         SessionDetailViewShared(
             conference = "kotlinconf2023",
             session = sessionDetails,
@@ -70,7 +70,7 @@ internal fun AndroidSessionDetailPreview() {
 )
 @Composable
 internal fun AndroidSpeakerDetailsPreview() {
-    ConfettiTheme {
+    CatalogTheme {
         SpeakerDetailsView(
             conference = "kotlinconf2023",
             speaker = johnOreillySpeaker,
```

**File**: `androidApp/src/main/java/dev/johnoreilly/confetti/ui/ComponentCatalog.kt` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ import dev.johnoreilly.confetti.ui.speakers.SpeakerItemView
 
 /** Confetti's brand theme with dynamic (Material You) theming disabled, so the catalog is deterministic. */
 @Composable
-private fun CatalogTheme(content: @Composable () -> Unit) {
+internal fun CatalogTheme(content: @Composable () -> Unit) {
     ConfettiTheme(disableDynamicTheming = true) {
         // The catalog renders with LocalInspectionMode = true, where Coil never executes a network
         // request — so speaker/venue AsyncImages would sit blank. A preview handler supplies the
```

**File**: `androidApp/src/main/java/dev/johnoreilly/confetti/ui/RecentMobileUiPreviews.kt` (modified, +26/-5)
```diff
@@ -11,6 +11,7 @@ import dev.johnoreilly.confetti.decompose.ConferenceAgentComponent
 import dev.johnoreilly.confetti.decompose.ConferencesComponent
 import dev.johnoreilly.confetti.preview.previewConferenceListState
 import dev.johnoreilly.confetti.ui.account.AccountView
+import dev.johnoreilly.confetti.ui.settings.SettingsPreviewContent
 
 /**
  * Android-discoverable previews for the mobile UI work landed in August 2026. Shared-source
@@ -36,7 +37,7 @@ annotation class RecentMobileScreen
 @RecentMobileScreen
 @Composable
 fun HazeBottomNavigationPreview() {
-    ConfettiTheme(disableDynamicTheming = true) {
+    CatalogTheme {
         HazeBottomBarPreviewContent()
     }
 }
@@ -57,15 +58,15 @@ fun HazeBottomNavigationPreview() {
 )
 @Composable
 fun HazeBottomNavigationDetailPreview() {
-    ConfettiTheme(disableDynamicTheming = true) {
+    CatalogTheme {
         HazeBottomBarContrastPreviewContent()
     }
 }
 
 @RecentMobileScreen
 @Composable
 fun OnboardingHazePreview() {
-    ConfettiTheme(disableDynamicTheming = true) {
+    CatalogTheme {
         OnboardingContent(
             notificationsEnabled = false,
             supportsNotifications = true,
@@ -75,10 +76,30 @@ fun OnboardingHazePreview() {
     }
 }
 
+@RecentMobileScreen
+@Composable
+fun OnboardingSignInStepPreview() {
+    CatalogTheme {
+        OnboardingSignInStep(
+            visible = true,
+            user = null,
+            onSignInClicked = {},
+        )
+    }
+}
+
+@RecentMobileScreen
+@Composable
+fun SettingsScreenPreview() {
+    CatalogTheme {
+        SettingsPreviewContent()
+    }
+}
+
 @RecentMobileScreen
 @Composable
 fun AccountScreenPreview() {
-    ConfettiTheme(disableDynamicTheming = true) {
+    CatalogTheme {
         AccountView(
             state = AccountUiState.Success(
                 conferenceName = "KotlinConf 2026",
@@ -98,7 +119,7 @@ fun AccountScreenPreview() {
 @RecentMobileScreen
 @Composable
 fun AssistantConversationPreview() {
-    ConfettiTheme(disableDynamicTheming = true) {
+    CatalogTheme {
         ConferenceAgentView(
             component = PreviewConferenceAgentComponent(),
             onCloseClick = {},
```

**File**: `shared/src/commonMain/kotlin/dev/johnoreilly/confetti/ui/settings/SettingsUI.kt` (modified, +6/-1)
```diff
@@ -660,6 +660,12 @@ private fun ActionSettingsRow(
 @MobilePreviews
 @Composable
 private fun SettingsScreenPreview() {
+    SettingsPreviewContent()
+}
+
+/** Stable sample state used by platform preview catalogs for the redesigned settings screen. */
+@Composable
+fun SettingsPreviewContent() {
     SettingsUI(
         userEditableSettings = UserEditableSettings(
             darkThemeConfig = DarkThemeConfig.FOLLOW_SYSTEM,
@@ -683,4 +689,3 @@ private fun SettingsScreenPreview() {
     )
 }
 
-
```

---

### Incident Patch 12: `12d82608` (2026-08-31)
**Commit Message**: Update dependency com.google.firebase:firebase-crashlytics-gradle to v3.0.8 (#1869)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -208,7 +208,7 @@ play-services-auth = "com.google.android.gms:play-services-auth:21.6.0"
 plugin-kotlin = { module = "org.jetbrains.kotlin:kotlin-gradle-plugin", version.ref = "kotlin" }
 plugin-android-application = { module = "com.android.tools.build:gradle", version.ref = "agp" }
 plugin-apollo = { module = "com.apollographql.apollo:apollo-gradle-plugin", version.ref = "apollo" }
-plugin-firebase-crashlytics = { module = "com.google.firebase:firebase-crashlytics-gradle", version = "3.0.7" }
+plugin-firebase-crashlytics = { module = "com.google.firebase:firebase-crashlytics-gradle", version = "3.0.8" }
 plugin-google-services = "com.google.gms:google-services:4.5.0"
 plugin-kotlin-serialization = { module = "org.jetbrains.kotlin:kotlin-serialization", version.ref = "kotlin" }
 plugin-kotlin-spring = { module = "org.jetbrains.kotlin:kotlin-allopen", version.ref = "kotlin" }
```

---

### Incident Patch 13: `8e9739c3` (2026-08-22)
**Commit Message**: Merge pull request #1877 from joreilly/schedule-ui-polish

Polish schedule track UI: filter placement, break visibility, session colors

**File**: `shared/src/commonMain/kotlin/dev/johnoreilly/confetti/decompose/SessionsComponent.kt` (modified, +8/-1)
```diff
@@ -17,6 +17,8 @@ import dev.johnoreilly.confetti.auth.User
 import dev.johnoreilly.confetti.fragment.RoomDetails
 import dev.johnoreilly.confetti.fragment.SessionDetails
 import dev.johnoreilly.confetti.fragment.SpeakerDetails
+import dev.johnoreilly.confetti.isBreak
+import dev.johnoreilly.confetti.isService
 import dev.johnoreilly.confetti.utils.DateService
 import kotlinx.coroutines.ExperimentalCoroutinesApi
 import kotlinx.coroutines.Job
@@ -217,7 +219,12 @@ class SessionsSimpleComponent(
             val filteredSessions = if (track != null) {
                 textFilteredSessions.map { outerMap ->
                     outerMap.mapValues { (_, value) ->
-                        value.filter { session -> track in session.tags }
+                        // Breaks/registration/etc. aren't tagged with any track - they're
+                        // schedule-wide, not track-specific - so a track filter shouldn't hide
+                        // them (matches nextappcon.com's own agenda filter behavior).
+                        value.filter { session ->
+                            session.isBreak() || session.isService() || track in session.tags
+                        }
                     }.filterValues { it.isNotEmpty() }
                 }
             } else {
```

**File**: `shared/src/commonMain/kotlin/dev/johnoreilly/confetti/ui/ColorUtils.kt` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+package dev.johnoreilly.confetti.ui
+
+import androidx.compose.ui.graphics.Color
+import dev.johnoreilly.confetti.GetConferenceDataQuery
+import dev.johnoreilly.confetti.fragment.SessionDetails
+
+/** Parses a "0xAARRGGBB" string (as used for [dev.johnoreilly.confetti.GetConferenceDataQuery.Track.color]
+ *  and [dev.johnoreilly.confetti.GetConferenceDataQuery.Config.themeColor]) into a [Color], or null if
+ *  absent/malformed. */
+@OptIn(ExperimentalStdlibApi::class)
+fun String?.toColorOrNull(): Color? {
+    if (this == null) return null
+    return try {
+        Color(hexToLong(HexFormat { number.prefix = "0x" }))
+    } catch (e: Exception) {
+        null
+    }
+}
+
+/**
+ * The color of this session's track, or null if it isn't tagged with any known track. A session
+ * can carry multiple track tags - e.g. "Swift Export: Where We Stand" is tagged both droidCon and
+ * swiftCon since it matters to both audiences, with source data
+ * `["Session", "Introductory and overview", "droidCon", "swiftCon", "swiftCon"]`. Sessionize's
+ * export consistently lists a session's actual/primary track *last* among its tags (matching
+ * nextappcon.com's own agenda, which colors that exact session swiftCon, not droidCon) - so unlike
+ * [TrackFilterRow], which just needs *a* match for filtering and doesn't care which, this takes the
+ * last tag that names a known track rather than the first one in [tracks] (config) order.
+ */
+fun SessionDetails.trackColor(tracks: List<GetConferenceDataQuery.Track>): Color? {
+    val byName = tracks.associateBy { it.name }
+    return tags.lastOrNull { it in byName }?.let { byName.getValue(it) }?.color?.toColorOrNull()
+}
```

**File**: `shared/src/commonMain/kotlin/dev/johnoreilly/confetti/ui/HomeScaffold.kt` (modified, +8/-3)
```diff
@@ -14,6 +14,7 @@ import androidx.compose.material3.Text
 import androidx.compose.material3.TopAppBarDefaults
 import androidx.compose.material3.windowsizeclass.WindowSizeClass
 import androidx.compose.runtime.Composable
+import androidx.compose.runtime.CompositionLocalProvider
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.graphics.Color
 import androidx.compose.ui.input.nestedscroll.nestedScroll
@@ -77,8 +78,12 @@ fun HomeScaffold(
         },
         contentWindowInsets = WindowInsets(0, 0, 0, 0),
     ) { innerPadding ->
-        Box(modifier = Modifier.padding(innerPadding).fillMaxSize(),
-            content = content,
-        )
+        CompositionLocalProvider(
+            LocalTopBarCollapsedFraction provides scrollBehavior.state.collapsedFraction
+        ) {
+            Box(modifier = Modifier.padding(innerPadding).fillMaxSize(),
+                content = content,
+            )
+        }
     }
 }
```

**File**: `shared/src/commonMain/kotlin/dev/johnoreilly/confetti/ui/LocalHazeState.kt` (modified, +8/-0)
```diff
@@ -10,3 +10,11 @@ import androidx.compose.ui.unit.dp
 val LocalHazeState = staticCompositionLocalOf<HazeState?> { null }
 val LocalBottomNavigationPadding = compositionLocalOf<Dp> { 0.dp }
 
+/**
+ * How collapsed [HomeScaffold]'s top app bar currently is, from 0 (fully expanded) to 1 (fully
+ * collapsed) - driven by the same nested-scroll signal the app bar itself hides on. Lets content
+ * below the app bar (e.g. a track filter row) collapse away in sync with it, rather than staying
+ * pinned while the bar above it hides.
+ */
+val LocalTopBarCollapsedFraction = compositionLocalOf { 0f }
+
```

**File**: `shared/src/commonMain/kotlin/dev/johnoreilly/confetti/ui/sessions/SessionItemView.kt` (modified, +17/-1)
```diff
@@ -32,6 +32,9 @@ import androidx.compose.runtime.remember
 import androidx.compose.runtime.setValue
 import androidx.compose.ui.Alignment
 import androidx.compose.ui.Modifier
+import androidx.compose.ui.draw.drawWithContent
+import androidx.compose.ui.geometry.Size
+import androidx.compose.ui.graphics.Color
 import androidx.compose.ui.text.font.FontWeight
 import org.jetbrains.compose.ui.tooling.preview.Preview
 import androidx.compose.ui.unit.dp
@@ -56,6 +59,7 @@ fun SessionItemView(
     removeBookmark: (String) -> Unit,
     onNavigateToSignIn: () -> Unit = {},
     isLoggedIn: Boolean,
+    trackColor: Color? = null,
 ) {
     if (session.isBreak() || session.isService()) {
         BreakSessionItemView(session = session)
@@ -68,6 +72,7 @@ fun SessionItemView(
             removeBookmark = removeBookmark,
             onNavigateToSignIn = onNavigateToSignIn,
             isLoggedIn = isLoggedIn,
+            trackColor = trackColor,
         )
     }
 }
@@ -147,13 +152,24 @@ private fun TalkSessionItemView(
     removeBookmark: (String) -> Unit,
     onNavigateToSignIn: () -> Unit = {},
     isLoggedIn: Boolean,
+    trackColor: Color? = null,
 ) {
     var showDialog by remember { mutableStateOf(false) }
 
     ListItem(
         modifier = Modifier
             .fillMaxWidth()
-            .clickable(onClick = { sessionSelected(session.id) }),
+            .clickable(onClick = { sessionSelected(session.id) })
+            .let { m ->
+                // A left-edge accent in the session's track color, mirroring nextappcon.com's own
+                // agenda - sessions with no matching track keep the plain row look instead of
+                // guessing at a fallback color. drawWithContent (not drawBehind) so the accent
+                // paints on top of ListItem's own background fill instead of underneath it.
+                if (trackColor == null) m else m.drawWithContent {
+                    drawContent()
+                    drawRect(color = trackColor, size = Size(3.dp.toPx(), size.height))
+                }
+            },
         headlineContent = {
             Text(
                 text = session.title,
```

**File**: `shared/src/commonMain/kotlin/dev/johnoreilly/confetti/ui/sessions/SessionListGridView.kt` (modified, +34/-6)
```diff
@@ -1,5 +1,6 @@
 package dev.johnoreilly.confetti.ui.sessions
 
+import androidx.compose.animation.AnimatedVisibility
 import androidx.compose.foundation.BorderStroke
 import androidx.compose.foundation.background
 import androidx.compose.foundation.border
@@ -37,6 +38,8 @@ import androidx.compose.runtime.setValue
 import androidx.compose.ui.Alignment
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.draw.clip
+import androidx.compose.ui.graphics.Color
+import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
 import androidx.compose.ui.layout.ContentScale
 import androidx.compose.ui.platform.LocalDensity
 import androidx.compose.ui.text.TextStyle
@@ -50,7 +53,9 @@ import androidx.compose.ui.unit.Dp
 import androidx.compose.ui.unit.dp
 import androidx.compose.ui.unit.sp
 import dev.johnoreilly.confetti.ui.LocalBottomNavigationPadding
+import dev.johnoreilly.confetti.ui.LocalTopBarCollapsedFraction
 import coil3.compose.AsyncImage
+import dev.johnoreilly.confetti.GetConferenceDataQuery
 import dev.johnoreilly.confetti.decompose.SessionsUiState
 import dev.johnoreilly.confetti.fragment.RoomDetails
 import dev.johnoreilly.confetti.fragment.SessionDetails
@@ -59,6 +64,7 @@ import dev.johnoreilly.confetti.isLightning
 import dev.johnoreilly.confetti.preview.MobilePreviews
 import dev.johnoreilly.confetti.preview.sessionsSuccessState
 import dev.johnoreilly.confetti.ui.SignInDialog
+import dev.johnoreilly.confetti.ui.trackColor
 import dev.johnoreilly.confetti.ui.component.ErrorView
 import dev.johnoreilly.confetti.ui.component.LoadingView
 import dev.johnoreilly.confetti.ui.icons.Bolt
@@ -109,19 +115,26 @@ fun SessionListGridView(
                     uiState.formattedConfDates.size
                 }
 
+                AnimatedVisibility(visible = LocalTopBarCollapsedFraction.current < 0.5f) {
+                    TrackFilterRow(
+                        tracks = uiState.tracks,
+                        selectedTrack = uiState.selectedTrack,
+                        onTrackSelected = onTrackSelected,
+                    )
+                }
                 SessionListTabRow(pagerState, uiState)
-                TrackFilterRow(
-                    tracks = uiState.tracks,
-                    selectedTrack = uiState.selectedTrack,
-                    onTrackSelected = onTrackSelected,
-                )
 
-                HorizontalPager(state = pagerState) { page ->
+                HorizontalPager(
+                    state = pagerState,
+                    // workaround for collapsing toolbar glitching during the nested pager's grid scroll.
+                    pageNestedScrollConnection = remember { object : NestedScrollConnection {} },
+                ) { page ->
                     SessionScheduleGrid(
                         conference = uiState.conference,
                         confDate = uiState.confDates[page],
                         sessionsByStartTime = uiState.sessionsByStartTimeList[page],
                         allRooms = uiState.rooms,
+                        tracks = uiState.tracks,
                         bookmarks = uiState.bookmarks,
                         sessionSelected = sessionSelected,
                         addBookmark = addBookmark,
@@ -147,6 +160,7 @@ private fun SessionScheduleGrid(
     confDate: LocalDate,
     sessionsByStartTime: Map<String, List<SessionDetails>>,
     allRooms: List<RoomDetails>,
+    tracks: List<GetConferenceDataQuery.Track>,
     bookmarks: Set<String>,
     sessionSelected: (id: String) -> Unit,
     addBookmark: (sessionId: String) -> Unit,
@@ -293,6 +307,7 @@ private fun SessionScheduleGrid(
                                 SessionGridCard(
                                     conference = conference,
                                     session = placed.session,
+                                    trackColor = placed.session.trackColor(tracks),
                                     bookmarks = bookmarks,
                                     height = height,
                                     sessionSelected = sessionSelected,
@@ -399,6 +414,7 @@ private fun formatMinuteOfDay(minutes: Int): String {
 private fun SessionGridCard(
     conference: String,
     session: SessionDetails,
+    trackColor: Color?,
     bookmarks: Set<String>,
     height: Dp,
     sessionSelected: (id: String) -> Unit,
@@ -505,6 +521,18 @@ private fun SessionGridCard(
                     Speakers(conference, session, maxVisible = maxSpeakerRows)
                 }
             }
+            // A left-edge accent in the session's track color, mirroring nextappcon.com's own
+            // agenda - sessions with no matching track (or no track data at all) keep the plain
+            // uniform border above instead of guessing at a fallback color.
+            if (trackColor != null) {
+                Box(
+                    Modifier
+                        .align(Alignment.CenterStart)
+                        .width(3.dp)
+ 
```

**File**: `shared/src/commonMain/kotlin/dev/johnoreilly/confetti/ui/sessions/SessionListView.kt` (modified, +11/-5)
```diff
@@ -2,6 +2,7 @@
 
 package dev.johnoreilly.confetti.ui.sessions
 
+import androidx.compose.animation.AnimatedVisibility
 import androidx.compose.foundation.ExperimentalFoundationApi
 import androidx.compose.foundation.layout.Box
 import androidx.compose.foundation.layout.Column
@@ -22,6 +23,7 @@ import org.jetbrains.compose.ui.tooling.preview.Preview
 import dev.johnoreilly.confetti.decompose.SessionsUiState
 import dev.johnoreilly.confetti.preview.MobilePreviews
 import dev.johnoreilly.confetti.preview.sessionsSuccessState
+import dev.johnoreilly.confetti.ui.LocalTopBarCollapsedFraction
 import dev.johnoreilly.confetti.ui.component.ConfettiHeader
 import dev.johnoreilly.confetti.ui.component.ErrorView
 import dev.johnoreilly.confetti.ui.component.LoadingView
@@ -33,6 +35,7 @@ import androidx.compose.foundation.layout.PaddingValues
 import dev.johnoreilly.confetti.isBreak
 import dev.johnoreilly.confetti.isService
 import dev.johnoreilly.confetti.ui.LocalBottomNavigationPadding
+import dev.johnoreilly.confetti.ui.trackColor
 
 @OptIn(ExperimentalFoundationApi::class)
 @Composable
@@ -62,12 +65,14 @@ fun SessionListView(
                     uiState.formattedConfDates.size
                 }
 
+                AnimatedVisibility(visible = LocalTopBarCollapsedFraction.current < 0.5f) {
+                    TrackFilterRow(
+                        tracks = uiState.tracks,
+                        selectedTrack = uiState.selectedTrack,
+                        onTrackSelected = onTrackSelected,
+                    )
+                }
                 SessionListTabRow(pagerState, uiState)
-                TrackFilterRow(
-                    tracks = uiState.tracks,
-                    selectedTrack = uiState.selectedTrack,
-                    onTrackSelected = onTrackSelected,
-                )
 
                 HorizontalPager(
                     state = pagerState,
@@ -141,6 +146,7 @@ fun SessionListView(
                                         removeBookmark = removeBookmark,
                                         onNavigateToSignIn = onNavigateToSignIn,
                                         isLoggedIn = isLoggedIn,
+                                        trackColor = session.trackColor(uiState.tracks),
                                     )
                                     val isCurrentBreak = session.isBreak() || session.isService()
                                     val isNextBreak = index < sessions.lastIndex && (sessions[index + 1].isBreak() || sessions[index + 1].isService())
```

**File**: `shared/src/commonMain/kotlin/dev/johnoreilly/confetti/ui/sessions/TrackFilterRow.kt` (modified, +1/-11)
```diff
@@ -13,9 +13,9 @@ import androidx.compose.material3.Text
 import androidx.compose.runtime.Composable
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.draw.clip
-import androidx.compose.ui.graphics.Color
 import androidx.compose.ui.unit.dp
 import dev.johnoreilly.confetti.GetConferenceDataQuery
+import dev.johnoreilly.confetti.ui.toColorOrNull
 
 @Composable
 fun TrackFilterRow(
@@ -56,13 +56,3 @@ fun TrackFilterRow(
         }
     }
 }
-
-/** Parses a "0xAARRGGBB" string (as used for [dev.johnoreilly.confetti.GetConferenceDataQuery.Config.themeColor]) into a [Color], or null if absent/malformed. */
-@OptIn(ExperimentalStdlibApi::class)
-private fun String.toColorOrNull(): Color? {
-    return try {
-        Color(hexToLong(HexFormat { number.prefix = "0x" }))
-    } catch (e: Exception) {
-        null
-    }
-}
```

---

### Incident Patch 14: `34ff581b` (2026-08-22)
**Commit Message**: Fix track color tie-break: last matching tag, not first-in-config-order

A session cross-tagged with multiple tracks (e.g. "Swift Export: Where
We Stand" is tagged both droidCon and swiftCon, but only runs in a
swiftCon room) was resolving to whichever track happened to come
first in config.tracks - droidCon, since it's first in that list -
regardless of which track the session actually belongs to. That's
wrong 60 of 423 next.app sessions with a resolvable track (~14%),
confirmed by cross-checking every mismatch against the session's
actual room.

Sessionize's export consistently lists a session's real/primary track
last among its tags, so take the last tag that names a known track
instead. Verified against live data: this update makes every one of
those 60 mismatches agree with the session's room - including cases
where the room name doesn't even textually match the track name (e.g.
room "techlead Summit Stage" / track "techlead summit", room "agentic
codeCon Stage 1" / track "agentic codingCon"), which a room-name-prefix
approach would have missed.

Co-Authored-By: Claude Sonnet 5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01KCB1UHcVvfoWWAZQU5yY3C

**File**: `shared/src/commonMain/kotlin/dev/johnoreilly/confetti/ui/ColorUtils.kt` (modified, +10/-4)
```diff
@@ -18,10 +18,16 @@ fun String?.toColorOrNull(): Color? {
 }
 
 /**
- * The color of the first track (in [tracks] order) this session is tagged with, or null if it
- * isn't tagged with any known track. A session can carry multiple track tags (e.g. a cross-listed
- * session) - first match wins, same tie-break [TrackFilterRow] uses for its filter chips.
+ * The color of this session's track, or null if it isn't tagged with any known track. A session
+ * can carry multiple track tags - e.g. "Swift Export: Where We Stand" is tagged both droidCon and
+ * swiftCon since it matters to both audiences, with source data
+ * `["Session", "Introductory and overview", "droidCon", "swiftCon", "swiftCon"]`. Sessionize's
+ * export consistently lists a session's actual/primary track *last* among its tags (matching
+ * nextappcon.com's own agenda, which colors that exact session swiftCon, not droidCon) - so unlike
+ * [TrackFilterRow], which just needs *a* match for filtering and doesn't care which, this takes the
+ * last tag that names a known track rather than the first one in [tracks] (config) order.
  */
 fun SessionDetails.trackColor(tracks: List<GetConferenceDataQuery.Track>): Color? {
-    return tracks.firstOrNull { it.name in tags }?.color?.toColorOrNull()
+    val byName = tracks.associateBy { it.name }
+    return tags.lastOrNull { it in byName }?.let { byName.getValue(it) }?.color?.toColorOrNull()
 }
```

---

### Incident Patch 15: `4ee12dca` (2026-08-22)
**Commit Message**: Polish the schedule track UI: filter placement, break visibility, session colors

Three related nextapp-parity improvements to the schedule screen:

- Move the track filter chips above the date tabs and collapse them
  in sync with the top app bar's existing scroll behavior, instead of
  sitting statically below it.
- Breaks/registration/etc. are schedule-wide, not track-specific, so
  a track filter no longer hides them (they have no track tags, so
  they always failed the old `track in session.tags` check) -
  matches nextappcon.com's own agenda filter.
- Session cards (grid and list) now show a left-edge accent in their
  track's color, mirroring nextappcon.com's own agenda. First-match
  tie-break for sessions tagged with more than one track. Sessions
  with no matching track keep the plain look.

Co-Authored-By: Claude Sonnet 5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01KCB1UHcVvfoWWAZQU5yY3C

**File**: `shared/src/commonMain/kotlin/dev/johnoreilly/confetti/decompose/SessionsComponent.kt` (modified, +8/-1)
```diff
@@ -17,6 +17,8 @@ import dev.johnoreilly.confetti.auth.User
 import dev.johnoreilly.confetti.fragment.RoomDetails
 import dev.johnoreilly.confetti.fragment.SessionDetails
 import dev.johnoreilly.confetti.fragment.SpeakerDetails
+import dev.johnoreilly.confetti.isBreak
+import dev.johnoreilly.confetti.isService
 import dev.johnoreilly.confetti.utils.DateService
 import kotlinx.coroutines.ExperimentalCoroutinesApi
 import kotlinx.coroutines.Job
@@ -217,7 +219,12 @@ class SessionsSimpleComponent(
             val filteredSessions = if (track != null) {
                 textFilteredSessions.map { outerMap ->
                     outerMap.mapValues { (_, value) ->
-                        value.filter { session -> track in session.tags }
+                        // Breaks/registration/etc. aren't tagged with any track - they're
+                        // schedule-wide, not track-specific - so a track filter shouldn't hide
+                        // them (matches nextappcon.com's own agenda filter behavior).
+                        value.filter { session ->
+                            session.isBreak() || session.isService() || track in session.tags
+                        }
                     }.filterValues { it.isNotEmpty() }
                 }
             } else {
```

**File**: `shared/src/commonMain/kotlin/dev/johnoreilly/confetti/ui/ColorUtils.kt` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+package dev.johnoreilly.confetti.ui
+
+import androidx.compose.ui.graphics.Color
+import dev.johnoreilly.confetti.GetConferenceDataQuery
+import dev.johnoreilly.confetti.fragment.SessionDetails
+
+/** Parses a "0xAARRGGBB" string (as used for [dev.johnoreilly.confetti.GetConferenceDataQuery.Track.color]
+ *  and [dev.johnoreilly.confetti.GetConferenceDataQuery.Config.themeColor]) into a [Color], or null if
+ *  absent/malformed. */
+@OptIn(ExperimentalStdlibApi::class)
+fun String?.toColorOrNull(): Color? {
+    if (this == null) return null
+    return try {
+        Color(hexToLong(HexFormat { number.prefix = "0x" }))
+    } catch (e: Exception) {
+        null
+    }
+}
+
+/**
+ * The color of the first track (in [tracks] order) this session is tagged with, or null if it
+ * isn't tagged with any known track. A session can carry multiple track tags (e.g. a cross-listed
+ * session) - first match wins, same tie-break [TrackFilterRow] uses for its filter chips.
+ */
+fun SessionDetails.trackColor(tracks: List<GetConferenceDataQuery.Track>): Color? {
+    return tracks.firstOrNull { it.name in tags }?.color?.toColorOrNull()
+}
```

**File**: `shared/src/commonMain/kotlin/dev/johnoreilly/confetti/ui/HomeScaffold.kt` (modified, +8/-3)
```diff
@@ -14,6 +14,7 @@ import androidx.compose.material3.Text
 import androidx.compose.material3.TopAppBarDefaults
 import androidx.compose.material3.windowsizeclass.WindowSizeClass
 import androidx.compose.runtime.Composable
+import androidx.compose.runtime.CompositionLocalProvider
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.graphics.Color
 import androidx.compose.ui.input.nestedscroll.nestedScroll
@@ -77,8 +78,12 @@ fun HomeScaffold(
         },
         contentWindowInsets = WindowInsets(0, 0, 0, 0),
     ) { innerPadding ->
-        Box(modifier = Modifier.padding(innerPadding).fillMaxSize(),
-            content = content,
-        )
+        CompositionLocalProvider(
+            LocalTopBarCollapsedFraction provides scrollBehavior.state.collapsedFraction
+        ) {
+            Box(modifier = Modifier.padding(innerPadding).fillMaxSize(),
+                content = content,
+            )
+        }
     }
 }
```

**File**: `shared/src/commonMain/kotlin/dev/johnoreilly/confetti/ui/LocalHazeState.kt` (modified, +8/-0)
```diff
@@ -10,3 +10,11 @@ import androidx.compose.ui.unit.dp
 val LocalHazeState = staticCompositionLocalOf<HazeState?> { null }
 val LocalBottomNavigationPadding = compositionLocalOf<Dp> { 0.dp }
 
+/**
+ * How collapsed [HomeScaffold]'s top app bar currently is, from 0 (fully expanded) to 1 (fully
+ * collapsed) - driven by the same nested-scroll signal the app bar itself hides on. Lets content
+ * below the app bar (e.g. a track filter row) collapse away in sync with it, rather than staying
+ * pinned while the bar above it hides.
+ */
+val LocalTopBarCollapsedFraction = compositionLocalOf { 0f }
+
```

**File**: `shared/src/commonMain/kotlin/dev/johnoreilly/confetti/ui/sessions/SessionItemView.kt` (modified, +17/-1)
```diff
@@ -32,6 +32,9 @@ import androidx.compose.runtime.remember
 import androidx.compose.runtime.setValue
 import androidx.compose.ui.Alignment
 import androidx.compose.ui.Modifier
+import androidx.compose.ui.draw.drawWithContent
+import androidx.compose.ui.geometry.Size
+import androidx.compose.ui.graphics.Color
 import androidx.compose.ui.text.font.FontWeight
 import org.jetbrains.compose.ui.tooling.preview.Preview
 import androidx.compose.ui.unit.dp
@@ -56,6 +59,7 @@ fun SessionItemView(
     removeBookmark: (String) -> Unit,
     onNavigateToSignIn: () -> Unit = {},
     isLoggedIn: Boolean,
+    trackColor: Color? = null,
 ) {
     if (session.isBreak() || session.isService()) {
         BreakSessionItemView(session = session)
@@ -68,6 +72,7 @@ fun SessionItemView(
             removeBookmark = removeBookmark,
             onNavigateToSignIn = onNavigateToSignIn,
             isLoggedIn = isLoggedIn,
+            trackColor = trackColor,
         )
     }
 }
@@ -147,13 +152,24 @@ private fun TalkSessionItemView(
     removeBookmark: (String) -> Unit,
     onNavigateToSignIn: () -> Unit = {},
     isLoggedIn: Boolean,
+    trackColor: Color? = null,
 ) {
     var showDialog by remember { mutableStateOf(false) }
 
     ListItem(
         modifier = Modifier
             .fillMaxWidth()
-            .clickable(onClick = { sessionSelected(session.id) }),
+            .clickable(onClick = { sessionSelected(session.id) })
+            .let { m ->
+                // A left-edge accent in the session's track color, mirroring nextappcon.com's own
+                // agenda - sessions with no matching track keep the plain row look instead of
+                // guessing at a fallback color. drawWithContent (not drawBehind) so the accent
+                // paints on top of ListItem's own background fill instead of underneath it.
+                if (trackColor == null) m else m.drawWithContent {
+                    drawContent()
+                    drawRect(color = trackColor, size = Size(3.dp.toPx(), size.height))
+                }
+            },
         headlineContent = {
             Text(
                 text = session.title,
```

**File**: `shared/src/commonMain/kotlin/dev/johnoreilly/confetti/ui/sessions/SessionListGridView.kt` (modified, +34/-6)
```diff
@@ -1,5 +1,6 @@
 package dev.johnoreilly.confetti.ui.sessions
 
+import androidx.compose.animation.AnimatedVisibility
 import androidx.compose.foundation.BorderStroke
 import androidx.compose.foundation.background
 import androidx.compose.foundation.border
@@ -37,6 +38,8 @@ import androidx.compose.runtime.setValue
 import androidx.compose.ui.Alignment
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.draw.clip
+import androidx.compose.ui.graphics.Color
+import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
 import androidx.compose.ui.layout.ContentScale
 import androidx.compose.ui.platform.LocalDensity
 import androidx.compose.ui.text.TextStyle
@@ -50,7 +53,9 @@ import androidx.compose.ui.unit.Dp
 import androidx.compose.ui.unit.dp
 import androidx.compose.ui.unit.sp
 import dev.johnoreilly.confetti.ui.LocalBottomNavigationPadding
+import dev.johnoreilly.confetti.ui.LocalTopBarCollapsedFraction
 import coil3.compose.AsyncImage
+import dev.johnoreilly.confetti.GetConferenceDataQuery
 import dev.johnoreilly.confetti.decompose.SessionsUiState
 import dev.johnoreilly.confetti.fragment.RoomDetails
 import dev.johnoreilly.confetti.fragment.SessionDetails
@@ -59,6 +64,7 @@ import dev.johnoreilly.confetti.isLightning
 import dev.johnoreilly.confetti.preview.MobilePreviews
 import dev.johnoreilly.confetti.preview.sessionsSuccessState
 import dev.johnoreilly.confetti.ui.SignInDialog
+import dev.johnoreilly.confetti.ui.trackColor
 import dev.johnoreilly.confetti.ui.component.ErrorView
 import dev.johnoreilly.confetti.ui.component.LoadingView
 import dev.johnoreilly.confetti.ui.icons.Bolt
@@ -109,19 +115,26 @@ fun SessionListGridView(
                     uiState.formattedConfDates.size
                 }
 
+                AnimatedVisibility(visible = LocalTopBarCollapsedFraction.current < 0.5f) {
+                    TrackFilterRow(
+                        tracks = uiState.tracks,
+                        selectedTrack = uiState.selectedTrack,
+                        onTrackSelected = onTrackSelected,
+                    )
+                }
                 SessionListTabRow(pagerState, uiState)
-                TrackFilterRow(
-                    tracks = uiState.tracks,
-                    selectedTrack = uiState.selectedTrack,
-                    onTrackSelected = onTrackSelected,
-                )
 
-                HorizontalPager(state = pagerState) { page ->
+                HorizontalPager(
+                    state = pagerState,
+                    // workaround for collapsing toolbar glitching during the nested pager's grid scroll.
+                    pageNestedScrollConnection = remember { object : NestedScrollConnection {} },
+                ) { page ->
                     SessionScheduleGrid(
                         conference = uiState.conference,
                         confDate = uiState.confDates[page],
                         sessionsByStartTime = uiState.sessionsByStartTimeList[page],
                         allRooms = uiState.rooms,
+                        tracks = uiState.tracks,
                         bookmarks = uiState.bookmarks,
                         sessionSelected = sessionSelected,
                         addBookmark = addBookmark,
@@ -147,6 +160,7 @@ private fun SessionScheduleGrid(
     confDate: LocalDate,
     sessionsByStartTime: Map<String, List<SessionDetails>>,
     allRooms: List<RoomDetails>,
+    tracks: List<GetConferenceDataQuery.Track>,
     bookmarks: Set<String>,
     sessionSelected: (id: String) -> Unit,
     addBookmark: (sessionId: String) -> Unit,
@@ -293,6 +307,7 @@ private fun SessionScheduleGrid(
                                 SessionGridCard(
                                     conference = conference,
                                     session = placed.session,
+                                    trackColor = placed.session.trackColor(tracks),
                                     bookmarks = bookmarks,
                                     height = height,
                                     sessionSelected = sessionSelected,
@@ -399,6 +414,7 @@ private fun formatMinuteOfDay(minutes: Int): String {
 private fun SessionGridCard(
     conference: String,
     session: SessionDetails,
+    trackColor: Color?,
     bookmarks: Set<String>,
     height: Dp,
     sessionSelected: (id: String) -> Unit,
@@ -505,6 +521,18 @@ private fun SessionGridCard(
                     Speakers(conference, session, maxVisible = maxSpeakerRows)
                 }
             }
+            // A left-edge accent in the session's track color, mirroring nextappcon.com's own
+            // agenda - sessions with no matching track (or no track data at all) keep the plain
+            // uniform border above instead of guessing at a fallback color.
+            if (trackColor != null) {
+                Box(
+                    Modifier
+                        .align(Alignment.CenterStart)
+                        .width(3.dp)
+ 
```

**File**: `shared/src/commonMain/kotlin/dev/johnoreilly/confetti/ui/sessions/SessionListView.kt` (modified, +11/-5)
```diff
@@ -2,6 +2,7 @@
 
 package dev.johnoreilly.confetti.ui.sessions
 
+import androidx.compose.animation.AnimatedVisibility
 import androidx.compose.foundation.ExperimentalFoundationApi
 import androidx.compose.foundation.layout.Box
 import androidx.compose.foundation.layout.Column
@@ -22,6 +23,7 @@ import org.jetbrains.compose.ui.tooling.preview.Preview
 import dev.johnoreilly.confetti.decompose.SessionsUiState
 import dev.johnoreilly.confetti.preview.MobilePreviews
 import dev.johnoreilly.confetti.preview.sessionsSuccessState
+import dev.johnoreilly.confetti.ui.LocalTopBarCollapsedFraction
 import dev.johnoreilly.confetti.ui.component.ConfettiHeader
 import dev.johnoreilly.confetti.ui.component.ErrorView
 import dev.johnoreilly.confetti.ui.component.LoadingView
@@ -33,6 +35,7 @@ import androidx.compose.foundation.layout.PaddingValues
 import dev.johnoreilly.confetti.isBreak
 import dev.johnoreilly.confetti.isService
 import dev.johnoreilly.confetti.ui.LocalBottomNavigationPadding
+import dev.johnoreilly.confetti.ui.trackColor
 
 @OptIn(ExperimentalFoundationApi::class)
 @Composable
@@ -62,12 +65,14 @@ fun SessionListView(
                     uiState.formattedConfDates.size
                 }
 
+                AnimatedVisibility(visible = LocalTopBarCollapsedFraction.current < 0.5f) {
+                    TrackFilterRow(
+                        tracks = uiState.tracks,
+                        selectedTrack = uiState.selectedTrack,
+                        onTrackSelected = onTrackSelected,
+                    )
+                }
                 SessionListTabRow(pagerState, uiState)
-                TrackFilterRow(
-                    tracks = uiState.tracks,
-                    selectedTrack = uiState.selectedTrack,
-                    onTrackSelected = onTrackSelected,
-                )
 
                 HorizontalPager(
                     state = pagerState,
@@ -141,6 +146,7 @@ fun SessionListView(
                                         removeBookmark = removeBookmark,
                                         onNavigateToSignIn = onNavigateToSignIn,
                                         isLoggedIn = isLoggedIn,
+                                        trackColor = session.trackColor(uiState.tracks),
                                     )
                                     val isCurrentBreak = session.isBreak() || session.isService()
                                     val isNextBreak = index < sessions.lastIndex && (sessions[index + 1].isBreak() || sessions[index + 1].isService())
```

**File**: `shared/src/commonMain/kotlin/dev/johnoreilly/confetti/ui/sessions/TrackFilterRow.kt` (modified, +1/-11)
```diff
@@ -13,9 +13,9 @@ import androidx.compose.material3.Text
 import androidx.compose.runtime.Composable
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.draw.clip
-import androidx.compose.ui.graphics.Color
 import androidx.compose.ui.unit.dp
 import dev.johnoreilly.confetti.GetConferenceDataQuery
+import dev.johnoreilly.confetti.ui.toColorOrNull
 
 @Composable
 fun TrackFilterRow(
@@ -56,13 +56,3 @@ fun TrackFilterRow(
         }
     }
 }
-
-/** Parses a "0xAARRGGBB" string (as used for [dev.johnoreilly.confetti.GetConferenceDataQuery.Config.themeColor]) into a [Color], or null if absent/malformed. */
-@OptIn(ExperimentalStdlibApi::class)
-private fun String.toColorOrNull(): Color? {
-    return try {
-        Color(hexToLong(HexFormat { number.prefix = "0x" }))
-    } catch (e: Exception) {
-        null
-    }
-}
```

#### Recent Merged Pull Requests:
- **PR #1940** (2026-10-04): Batch Renovate updates (@joreilly)
- **PR #1939** (2026-10-02): Raise Gradle heap for TestFlight release link (@joreilly)
- **PR #1938** (2026-10-02): Cumulative track filter, remembered per conference (@joreilly)
- **PR #1937** (2026-09-28): Show track tags first in session list rows (@joreilly)
- **PR #1936** (2026-09-26): Session details: icon row for time/room, room opens venue (@joreilly)
- **PR #1935** (2026-09-24): Add droidcon London 2026 (@joreilly)
- **PR #1933** (closed): Update roborazzi to v1.76.0 (@renovate[bot])
- **PR #1932** (closed): Update dependency ubuntu to v26 (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
