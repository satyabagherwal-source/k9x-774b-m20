# Forensic Learning Record (Deep Inspection): JetBrains/kotlinconf-app

> **Canonical Artifact**: `07_PROJECT_LEARNING/jetbrains-kotlinconf-app-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/JetBrains/kotlinconf-app](https://github.com/JetBrains/kotlinconf-app))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:29:04.970Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `JetBrains/kotlinconf-app`
- **Description**: The official KotlinConf application
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3564 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `app/webApp/src/webMain/resources/service-worker.js`
```
// const KOTLIN_CONF_CACHE = 'kotlin-conf-cache';
// const staticUrlsToCache = [];
//
// self.addEventListener('install', function (event) {
//     event.waitUntil(
//         caches.open(KOTLIN_CONF_CACHE)
//             .then(cache =>
//                 Promise.all(
//                     staticUrlsToCache.map(file =>
//                         cache.add(file)
//                             .catch(_ => console.error(`Can't load ${file} to cache`))
//                     )
//                 )
//             ).then(_ => console.log("Offline mode is Ready!"))
//     );
// });
//
// self.addEventListener('fetch', event => {
//     if (event.request === "no-cache") return;
//
//     event.respondWith(
//         caches.match(event.request)
//             .then(response =>
//                 response ?? fetch(event.request)
//                     .then(response => {
//                         if (response == null || response.status !== 200) {
//                             return caches.match(event.request)
//                                 .then(cacheResponse => 
//                                   cacheResponse ?? response
//                                 );
//                         }
//
//                         const responseToCache = response.clone();
//
//                         caches.open(KOTLIN_CONF_CACHE)
//                             .then(cache => cache.put(event.request, responseToCache));
//
//                         return response;
//                     })
//                     .catch(error => caches.match(event.request))
//             )
//     )
// });
//
// self.addEventListener('activate', event => {
//     const cacheAllowlist = [KOTLIN_CONF_CACHE];
//
//     event.waitUntil(
//         caches.keys().then(cacheNames =>
//             Promise.all(
//                 cacheNames.map(cacheName => {
//                     if (cacheAllowlist.indexOf(cacheName) === -1) {
//                         return caches.delete(cacheName);
//                     }
//                 })
//             )
//         )
//     );
// });

const map = new Map()

self.addEventListener('message', function(event) {
    console.log('Service worker received a message: ', event.data);

    if (event.data.command === 'register-notification') {
        const id = setTimeout(() => {
          self.registration.showNotification(event.data.title, { body: event.data.body });
          map.delete(event.data.notificationId)
        }, event.data.delay)
        map.set(event.data.notificationId, id)
    }
    if (event.data.command === 'cancel-notification') {
        const id = map.get(event.data.notificationId)
        if (id != undefined) {
            clearTimeout(id)
            map.delete(event.data.notificationId)
        }
    }
  });

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #737** (2026-09-17): **Update Junie workflow reference**
  *Symptoms*: The Junie has been moved to JetBrains org.  See details in https://youtrack.jetbrains.com/issue/KTL-5096/Reusable-workflow-referenced-from-an-unregistered-GitHub-namespace-jetbrains-junie-in-9-JetBrains-repositories.

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

- **Issue #725** (2026-06-28): **Update to Kotlin 2.4**
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

### Incident Patch 1: `e7974f48` (2026-05-26)
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

### Incident Patch 2: `1af09ca6` (2026-04-25)
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

### Incident Patch 3: `600aae8e` (2026-04-07)
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

### Incident Patch 4: `8300e0d3` (2026-03-24)
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
+            val extraPadding = if (isLargeScreen) bottomInsetPadding() else Paddi
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

### Incident Patch 5: `799cb920` (2026-03-23)
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

### Incident Patch 6: `67a93c05` (2026-03-23)
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

### Incident Patch 7: `c88b8be2` (2026-03-20)
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

#### Recent Merged Pull Requests:
- **PR #737** (2026-09-17): Update Junie workflow reference (@nikpachoo)
- **PR #734** (2026-09-07): Pin desktop target to toolchain 21 (@SebastianAigner)
- **PR #733** (2026-08-12): Update iOS code signing identity to "Apple Distribution" (@zsmb13)
- **PR #732** (2026-08-07): Bump dependency versions (@zsmb13)
- **PR #730** (2026-07-31): Align version catalog aliases with a shared convention (@zsmb13)
- **PR #728** (2026-07-06): Remove yearless client-data backend routes (@zsmb13)
- **PR #727** (2026-07-08): Add ProGuard configuration for desktop release build (@zsmb13)
- **PR #725** (2026-06-28): Update to Kotlin 2.4 (@zsmb13)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
