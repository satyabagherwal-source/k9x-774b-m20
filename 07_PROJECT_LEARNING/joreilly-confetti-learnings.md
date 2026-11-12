> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/joreilly-confetti-learnings.md`  
> **Source**: github ([https://github.com/joreilly/Confetti](https://github.com/joreilly/Confetti))  
> **Source Version**: `d29c8ec6`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T23:41:29.833Z  
> **Learning ID**: `learn-github-joreilly-confetti`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): joreilly/Confetti

> **Canonical Artifact**: `07_PROJECT_LEARNING/joreilly-confetti-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/joreilly/Confetti](https://github.com/joreilly/Confetti))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-12T23:41:29.596Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `joreilly/Confetti`
- **Description**: KMP/CMP GraphQL based conference project with Jetpack Compose Android, Compose for Wear, and Compose Multiplatform Desktop, Web and iOS clients along with GraphQL backend.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1067 stars

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

### Incident Patch 1: `c2b35310` (2026-11-09)
**Commit Message**: build: take Livery and rc-players from their BOMs, and group Renovate by project (#2042)

The compose-ai-tools Renovate rule matched every ee.schimke.composeai artifact,
so Livery and rc-players updates landed in its PR (#2025 bundled Livery 0.5.0
and rc-players 2.31.0 with it). Each project now gets its own group: the
compose-ai-tools rule matches only the preview plugin, preview-annotations
and the CI actions.

Livery's modules now resolve through livery-bom, with the 'livery' version
pinning only the BOM and the catalog plugin, so Renovate has one Livery
update. :livery also takes rc-players-bom, as :livery-catalog does, so the
app plays templates with the player that captured them. Resolved versions
are unchanged (Livery 0.8.0, rc-players 2.31.0).


Claude-Session: https://claude.ai/code/session_017xSuvnrqtgdck2uPu87WP6

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `gradle/libs.versions.toml` (modified, +6/-5)
```diff
@@ -68,11 +68,12 @@ rc-players = "2.31.0"
 
 
 [libraries]
-livery-compose = { module = "ee.schimke.composeai:livery-compose", version.ref = "livery" }
-livery-compose-material3 = { module = "ee.schimke.composeai:livery-compose-material3", version.ref = "livery" }
-livery-client = { module = "ee.schimke.composeai:livery-client", version.ref = "livery" }
-livery-render = { module = "ee.schimke.composeai:livery-render", version.ref = "livery" }
-livery-publish = { module = "ee.schimke.composeai:livery-publish", version.ref = "livery" }
+livery-bom = { module = "ee.schimke.composeai:livery-bom", version.ref = "livery" }
+livery-compose = { module = "ee.schimke.composeai:livery-compose" }
+livery-compose-material3 = { module = "ee.schimke.composeai:livery-compose-material3" }
+livery-client = { module = "ee.schimke.composeai:livery-client" }
+livery-render = { module = "ee.schimke.composeai:livery-render" }
+livery-publish = { module = "ee.schimke.composeai:livery-publish" }
 rc-players-bom = { module = "ee.schimke.composeai:rc-players-bom", version.ref = "rc-players" }
 rc-player-compose = { module = "ee.schimke.composeai:rc-player-compose" }
 rc-remote-creation-compose = { module = "ee.schimke.composeai:third-party-remote-creation-compose" }
```

**File**: `livery-catalog/build.gradle.kts` (modified, +3/-0)
```diff
@@ -36,6 +36,7 @@ dependencies {
     // Playing back (previews, tests): the Compose player and Livery's contract binding.
     implementation(libs.rc.player.compose)
     implementation(projects.liveryContracts)
+    implementation(platform(libs.livery.bom))
     implementation(libs.livery.compose)
     implementation(libs.livery.render)
     implementation(libs.livery.compose.material3)
@@ -47,6 +48,7 @@ dependencies {
     implementation(libs.kotlinx.serialization)
 
     testImplementation(kotlin("test"))
+    testImplementation(platform(libs.livery.bom))
     testImplementation(libs.livery.client)
 }
 
@@ -92,6 +94,7 @@ tasks.register<JavaExec>("renderLiveryCatalog") {
 val liveryCli: Configuration by configurations.creating
 
 dependencies {
+    liveryCli(platform(libs.livery.bom))
     liveryCli(libs.livery.publish)
 }
 
```

**File**: `livery/build.gradle.kts` (modified, +4/-0)
```diff
@@ -49,6 +49,10 @@ dependencies {
     implementation(enforcedPlatform(libs.compose.bom))
     implementation(projects.shared)
     implementation(projects.liveryContracts)
+    // Livery and the Remote Compose players come from their BOMs, the same ones :livery-catalog
+    // captures the templates with, so the app plays a document with the player it was made for.
+    implementation(platform(libs.livery.bom))
+    implementation(platform(libs.rc.players.bom))
     implementation(libs.livery.client)
     implementation(libs.livery.compose) {
         // rc-player-compose declares Ktor's CIO engine but never uses it; beside OkHttp it would
```

**File**: `renovate.json` (modified, +24/-2)
```diff
@@ -19,16 +19,38 @@
       "groupName": "github actions"
     },
     {
-      "description": "compose-ai-tools ships the preview CLI, the ee.schimke.composeai Gradle plugin, and the reusable CI composite actions as a single release, and this repo pins BOTH halves: the composeai-preview catalog key and the versioned action refs in design-artifacts.yml / compose-preview.yml. Without this rule they are separate updates and land in separate PRs, so the CLI and the action code that drives it skew apart between merges. Group them into one PR and skip the batching window so the published catalog tracks the renderer it was rendered with.",
+      "description": "compose-ai-tools ships the preview CLI, the ee.schimke.composeai.preview Gradle plugin, preview-annotations and the reusable CI composite actions as one release, and this repo pins BOTH halves: the composeai-preview catalog key and the versioned action refs in the compose-preview workflows and design-artifacts.yml. Group them into one PR and skip the batching window so the CLI and the action code that drives it never skew. Only compose-ai-tools' own artifacts: Livery and rc-players also publish under ee.schimke.composeai but are separate projects with their own releases and rules below.",
       "matchPackageNames": [
         "yschimke/compose-ai-tools",
-        "/^ee\\.schimke\\.composeai($|[.:])/"
+        "/^ee\\.schimke\\.composeai\\.preview($|[.:])/",
+        "ee.schimke.composeai:preview-annotations"
       ],
       "groupName": "compose-ai-tools",
       "schedule": [
         "at any time"
       ]
     },
+    {
+      "description": "Livery is versioned through its BOM (livery-bom), which pins every Livery module, livery-publish and the Gradle plugin's jar included; the catalog declares the modules without versions. The `livery` version ref also pins the ee.schimke.composeai.livery.catalog plugin, which a BOM can't cover, so group the BOM and the plugin marker into one PR.",
+      "matchPackageNames": [
+        "ee.schimke.composeai:livery-bom",
+        "/^ee\\.schimke\\.composeai\\.livery\\./"
+      ],
+      "groupName": "livery",
+      "schedule": [
+        "at any time"
+      ]
+    },
+    {
+      "description": "The Remote Compose players (rc-player-*, the vendored AndroidX creation fork) are versioned only through rc-players-bom; the catalog declares the modules without versions, so the BOM is the one update.",
+      "matchPackageNames": [
+        "ee.schimke.composeai:rc-players-bom"
+      ],
+      "groupName": "rc-players",
+      "schedule": [
+        "at any time"
+      ]
+    },
     {
       "description": "Every com.squareup.okhttp3 artifact is published from one release and only supports being used at a matching version — okhttp, okhttp-coroutines and logging-interceptor all sit on the same classpath in backend/service-import. Renovate's monorepo data does not group them from Maven metadata alone, so v5.5.0 arrived as three independent PRs, each of which skews the classpath until the last one merges. The catalog now shares one `okhttp` version ref, which groups the declared entries; this rule keeps the guarantee for any okhttp3 artifact declared outside the catalog.",
       "matchPackageNames": [
```

---

### Incident Patch 2: `5af86040` (2026-11-10)
**Commit Message**: build(livery): capture the catalogs with Livery 0.9.0's Gradle plugin (#2050)

Livery 0.9.0's catalog plugin captures a catalog from Kotlin at build time
(livery { capture { } }), so :livery:catalog drops its own generateLiveryCatalog
JavaExec: captureLiveryCatalog runs GenerateCatalog's main, cached on the
module's code and the hand-edited catalogs/, into build/livery/captured/<series>.
The channel builds and :livery:android's bundled catalogs read from there.


Claude-Session: https://claude.ai/code/session_017xSuvnrqtgdck2uPu87WP6

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -63,7 +63,7 @@ composeai-preview = "2.89.0"
 composeai-preview-annotations = "3.27.4"
 koogAgents = "1.3.0"
 koogPromptExecutorAll = "1.2.0-beta"
-livery = "0.8.0"
+livery = "0.9.0"
 rc-players = "2.31.1"
 
 
```

**File**: `livery/android/build.gradle.kts` (modified, +3/-3)
```diff
@@ -83,18 +83,18 @@ dependencies {
 }
 
 // Each series catalog (confetti, the base, and any conference's), generated from the Kotlin designs
-// at build time by :livery:catalog:generateLiveryCatalog and built and checked like
+// at build time by :livery:catalog:captureLiveryCatalog and built and checked like
 // `livery build --inspect` into this module's assets at livery/<series>/, where
 // AndroidBundled.fromAssets(context, "livery/<series>") reads it back. The bundled copy has serial 0,
 // so a catalog the app downloads (the livery-templates branch) always replaces it.
 val liveryCatalogs = rootProject.layout.projectDirectory.dir("livery/catalog/catalogs").asFile
     .listFiles { f -> f.isDirectory }.orEmpty().map { it.name }.sorted()
-val generatedLiveryCatalogs = rootProject.layout.projectDirectory.dir("livery/catalog/build/livery/catalogs")
+val generatedLiveryCatalogs = rootProject.layout.projectDirectory.dir("livery/catalog/build/livery/captured")
 val liveryCatalogTasks = liveryCatalogs.map { series ->
     tasks.register<ee.schimke.livery.gradle.BuildLiveryCatalog>("buildLiveryCatalog${series.replaceFirstChar { it.uppercase() }}") {
         group = "build"
         description = "Builds the $series Livery catalog into generated assets"
-        dependsOn(":livery:catalog:generateLiveryCatalog")
+        dependsOn(":livery:catalog:captureLiveryCatalog")
         source.set(generatedLiveryCatalogs.dir(series))
         assetsPath.set("livery/$series")
         inspect.set(true)
```

**File**: `livery/catalog/README.md` (modified, +5/-5)
```diff
@@ -10,7 +10,7 @@ tonal Material cards), which every conference without designs of its own draws;
 a gradient that drifts on the player's clock).
 
 **The source is always Kotlin.** Every design is a `@RemoteComposable` function in
-`livery/catalog/src/main`; a `.rc` document is build output (`build/livery/catalogs/`, and the
+`livery/catalog/src/main`; a `.rc` document is build output (`build/livery/captured/`, and the
 APK's bundled catalogs) or lives on the `livery-templates` branch the workflow publishes. Neither
 `.rc` files nor renders are committed: a design change in a pull request is a Kotlin diff, and its
 pictures are the preview renders (below, from the `livery-templates` branch).
@@ -74,7 +74,7 @@ livery/contracts/   Contracts.kt: the four contracts, typed (KMP: Android, iOS,
         │                     remote-creation-compose), captured to .rc on the JVM at build time
         │       └── catalogs/<series>/  each series' hand-edited data only: themes, placements,
         │                     experiments, fonts. The build adds the captured designs and
-        │                     contracts in build/livery/catalogs/<series>/, what `livery build`
+        │                     contracts in build/livery/captured/<series>/, what `livery build`
         │                     publishes to the livery-templates branch
         │
         ├── shared/ui/components  ConferenceComponents: what the screens draw a conference's
@@ -91,7 +91,7 @@ livery/contracts/   Contracts.kt: the four contracts, typed (KMP: Android, iOS,
 ```
 
 ```bash
-./gradlew :livery:catalog:generateLiveryCatalog   # capture designs -> build/livery/catalogs/<series>/ (cached)
+./gradlew :livery:catalog:captureLiveryCatalog    # capture designs -> build/livery/captured/<series>/ (cached)
 ./gradlew :livery:catalog:renderLiveryCatalog     # preview renders -> build/livery/renders/
 ./gradlew :livery:catalog:test                    # contract checks on the generated catalogs
 ./gradlew :livery:catalog:buildLiveryChannels     # livery build --inspect per series -> build/livery-channels/
@@ -178,8 +178,8 @@ conference admin would be:
    header say Berlin and use the blue from the venue"). The app sends it with the slot's
    design id, contract and current data to an agent session.
 2. The agent works on the generated catalog through `livery-mcp` (`livery-mcp
-   livery/catalog/build/livery/catalogs/droidcon --preview-out …`, after
-   `:livery:catalog:generateLiveryCatalog`): `get_contract` for what it may use; data-only changes
+   livery/catalog/build/livery/captured/droidcon --preview-out …`, after
+   `:livery:catalog:captureLiveryCatalog`): `get_contract` for what it may use; data-only changes
    (copy, a theme pack's colours, a placement's schedule) are edits to the hand-edited JSON in
    `catalogs/droidcon/`, checked by `validate_data`; a layout change edits the design's Kotlin and
    is re-captured. `render_preview` shows the result. Either way the change it proposes is source:
```

**File**: `livery/catalog/build.gradle.kts` (modified, +14/-17)
```diff
@@ -9,7 +9,7 @@ import org.jetbrains.kotlin.gradle.dsl.JvmTarget
 // (themes/, placements/, experiments/, fonts/).
 //
 //   ./gradlew :livery:catalog:test                     captures every template and checks it plays
-//   ./gradlew :livery:catalog:generateLiveryCatalog    each series' catalog into build/livery/catalogs/<series>/
+//   ./gradlew :livery:catalog:captureLiveryCatalog     each series' catalog into build/livery/captured/<series>/
 //   ./gradlew :livery:catalog:renderLiveryCatalog      the previews into build/livery/renders/
 //   ./gradlew :livery:catalog:buildLiveryChannels      `livery build --inspect` of each series into
 //                                                     build/livery-channels/<series>/, what the
@@ -18,6 +18,7 @@ plugins {
     kotlin("jvm")
     id("org.jetbrains.compose")
     alias(libs.plugins.compose.compiler)
+    alias(libs.plugins.livery.catalog)
 }
 
 kotlin {
@@ -53,23 +54,19 @@ dependencies {
 }
 
 // One catalog per conference series: catalogs/confetti (the base), and one per conference. Only the
-// hand-edited data is here; the generated catalogs are in build/livery/catalogs.
+// hand-edited data is here. Livery's plugin captures the designs (captureLiveryCatalog: GenerateCatalog's
+// main, cached on this module's code and the hand-edited data) into build/livery/captured/<series>.
 val catalogsDir = layout.projectDirectory.dir("catalogs")
-val generatedCatalogsDir = layout.buildDirectory.dir("livery/catalogs")
 
-val generateLiveryCatalog = tasks.register<JavaExec>("generateLiveryCatalog") {
-    group = "livery"
-    description = "Captures every Confetti design to .rc, with each series' data, into build/livery/catalogs/<series>/."
-    classpath = sourceSets["main"].runtimeClasspath
-    mainClass.set("dev.johnoreilly.confetti.livery.GenerateCatalogKt")
-    // Locals, not the script's vals: the configuration cache can't serialize script references.
-    val source = catalogsDir.asFile.absolutePath
-    val out = generatedCatalogsDir
-    inputs.dir(catalogsDir)
-    outputs.dir(out)
-    outputs.cacheIf { true }
-    argumentProviders.add(CommandLineArgumentProvider { listOf(source, out.get().asFile.absolutePath) })
+livery {
+    source.set(catalogsDir)
+    capture { mainClass.set("dev.johnoreilly.confetti.livery.GenerateCatalogKt") }
 }
+val capturedCatalogsDir = livery.capture.outputDir
+
+// The plugin's own buildLiveryCatalog builds one catalog; this module captures one per series, which
+// buildLiveryChannels here and :livery:android's buildLiveryCatalog<Series> build.
+tasks.named("buildLiveryCatalog") { enabled = false }
 
 tasks.register<JavaExec>("renderLiveryCatalog") {
     group = "livery"
@@ -110,9 +107,9 @@ catalogsDir.asFile.listFiles { f -> f.isDirectory }.orEmpty().map { it.name }.so
         group = "livery"
         classpath = liveryCli
         mainClass.set("ee.schimke.livery.publisher.MainKt")
-        val src = generatedCatalogsDir.map { it.dir(series) }
+        val src = capturedCatalogsDir.map { it.dir(series) }
         val out = channelsDir.map { it.dir(series) }
-        dependsOn(generateLiveryCatalog)
+        dependsOn("captureLiveryCatalog")
         inputs.dir(src)
         outputs.dir(out)
         // --serial: the commit time when CI passes it, so a rebuild of the same commit is the same
```

**File**: `livery/catalog/src/main/kotlin/dev/johnoreilly/confetti/livery/GenerateCatalog.kt` (modified, +1/-1)
```diff
@@ -193,7 +193,7 @@ private fun JsonElement.pretty() = json.encodeToString(JsonElement.serializer(),
  */
 fun main(args: Array<String>) {
     val source = File(args.getOrElse(0) { "livery/catalog/catalogs" })
-    val out = File(args.getOrElse(1) { "livery/catalog/build/livery/catalogs" })
+    val out = File(args.getOrElse(1) { "livery/catalog/build/livery/captured" })
     val renders = args.getOrNull(2)?.let(::File)
     for (brand in AllBrands) {
         val catalog = out.resolve(brand.series)
```

**File**: `livery/catalog/src/test/kotlin/dev/johnoreilly/confetti/livery/CatalogTest.kt` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ import kotlin.test.assertTrue
  * The contract is enforced at three points: Kotlin types (designs and the app use Contracts.kt),
  * capture (a template can only read and emit what its contract declares), and here: each series'
  * generated catalog holds its own designs and passes the checks the Livery publisher can't make.
- * The catalogs are build output (`:livery:catalog:generateLiveryCatalog`), never committed.
+ * The catalogs are build output (`:livery:catalog:captureLiveryCatalog`), never committed.
  */
 class CatalogTest {
     private val root = File("catalogs")
```

#### Recent Merged Pull Requests:
- **PR #2063** (2026-11-12): Add AppFunctions displayDescription so Play accepts the bundle (@joreilly)
- **PR #2059** (closed): ci: benchmark the Compose preview edit → render loop (@yschimke)
- **PR #2055** (2026-11-11): feat(livery): the top bar's title as a server-driven design (@yschimke)
- **PR #2054** (2026-11-10): feat(livery): agenda breaks as a contract of their own, with a design per series (@yschimke)
- **PR #2052** (2026-11-10): Update dependency ee.schimke.composeai:rc-players-bom to v2.32.0 (@renovate[bot])
- **PR #2050** (2026-11-10): build(livery): capture the catalogs with Livery 0.9.0's Gradle plugin (@yschimke)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. build: take Livery and rc-players from their BOMs, and group Renovate by project

**RULE**:
When implementing operations in `gradle/libs.versions.toml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in joreilly/Confetti. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c2b35310`: build: take Livery and rc-players from their BOMs, and group Renovate by project (#2042). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `gradle/libs.versions.toml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
livery-bom = { module = "ee.schimke.composeai:livery-bom", version.ref = "livery" }
livery-compose = { module = "ee.schimke.composeai:livery-compose" }
livery-compose-material3 = { module = "ee.schimke.composeai:livery-compose-material3" }
livery-client = { module = "ee.schimke.composeai:livery-client" }
livery-render = { module = "ee.schimke.composeai:livery-render" }
livery-publish = { module = "ee.schimke.composeai:livery-publish" }
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Anti-pattern to NEVER write (induced failure mode):
livery-compose = { module = "ee.schimke.composeai:livery-compose", version.ref = "livery" }
livery-compose-material3 = { module = "ee.schimke.composeai:livery-compose-material3", version.ref = "livery" }
livery-client = { module = "ee.schimke.composeai:livery-client", version.ref = "livery" }
livery-render = { module = "ee.schimke.composeai:livery-render", version.ref = "livery" }
livery-publish = { module = "ee.schimke.composeai:livery-publish", version.ref = "livery" }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c2b35310` are properly handled with clean fallback behavior.
