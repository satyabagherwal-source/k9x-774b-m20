> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/prof18-feed-flow-learnings.md`  
> **Source**: github ([https://github.com/prof18/feed-flow](https://github.com/prof18/feed-flow))  
> **Source Version**: `c2f17694`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-02T15:22:24.884Z  
> **Learning ID**: `learn-github-prof18-feed-flow`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): prof18/feed-flow

> **Canonical Artifact**: `07_PROJECT_LEARNING/prof18-feed-flow-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/prof18/feed-flow](https://github.com/prof18/feed-flow))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-02T15:22:24.610Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `prof18/feed-flow`
- **Description**: FeedFlow is a minimalistic RSS Reader available on Android, iOS, macOS, Windows and Linux. Built with Kotlin Multiplatform, Jetpack Compose and SwiftUI.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1306 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `androidApp/src/main/kotlin/com/prof18/feedflow/android/editfeed/EditFeedNavUtils.kt`
```
package com.prof18.feedflow.android.editfeed

import com.prof18.feedflow.android.EditFeed
import com.prof18.feedflow.core.model.ArticleOpenMode
import com.prof18.feedflow.core.model.FeedSource
import com.prof18.feedflow.core.model.FeedSourceCategory

internal fun EditFeed.toFeedSource(): FeedSource {
    return FeedSource(
        id = id,
        url = url,
        title = title,
        category = if (categoryId != null && categoryTitle != null) {
            FeedSourceCategory(
                id = categoryId,
                title = categoryTitle,
            )
        } else {
            null
        },
        lastSyncTimestamp = lastSyncTimestamp,
        logoUrl = logoUrl,
        websiteUrl = websiteUrl,
        articleOpenMode = ArticleOpenMode.valueOf(articleOpenMode),
        isHiddenFromTimeline = isHidden,
        isPinned = isPinned,
        isNotificationEnabled = isNotificationEnabled,
        isHideImagesEnabled = isHideImagesEnabled,
        fetchFailed = fetchFailed,
    )
}

internal fun FeedSource.toEditFeed(): EditFeed {
    return EditFeed(
        id = id,
        url = url,
        title = title,
        categoryId = category?.id,
        categoryTitle = category?.title,
        lastSyncTimestamp = lastSyncTimestamp,
        logoUrl = logoUrl,
        websiteUrl = websiteUrl,
        articleOpenMode = articleOpenMode.name,
        isHidden = isHiddenFromTimeline,
        isPinned = isPinned,
        isNotificationEnabled = isNotificationEnabled,
        isHideImagesEnabled = isHideImagesEnabled,
        fetchFailed = fetchFailed,
    )
}

```

### Core Architecture Module: `androidApp/src/main/kotlin/com/prof18/feedflow/android/ui/readermode/ReaderModeEmptyState.kt`
```
package com.prof18.feedflow.android.ui.readermode

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Article
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prof18.feedflow.android.ui.style.Spacing
import com.prof18.feedflow.android.ui.utils.LocalFeedFlowStrings

@Composable
fun ReaderModeEmptyState(
    modifier: Modifier = Modifier,
) {
    val strings = LocalFeedFlowStrings.current
    Column(
        modifier = modifier.fillMaxSize(),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(
            imageVector = Icons.Default.Article,
            contentDescription = null,
            modifier = Modifier
                .size(56.dp)
                .padding(bottom = Spacing.regular),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Text(
            text = strings.selectArticleToRead,
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

```

### Core Architecture Module: `androidApp/src/main/kotlin/com/prof18/feedflow/android/ui/utils/E2eSemantics.kt`
```
package com.prof18.feedflow.android.ui.utils

import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId

@OptIn(ExperimentalComposeUiApi::class)
fun Modifier.exposeTestTagsAsResourceIds(): Modifier = semantics {
    testTagsAsResourceId = true
}

```

### Core Architecture Module: `androidApp/src/main/kotlin/com/prof18/feedflow/android/ui/utils/ImageLoader.kt`
```
package com.prof18.feedflow.android.ui.utils

import coil3.ImageLoader
import coil3.PlatformContext
import coil3.disk.DiskCache
import coil3.intercept.Interceptor
import coil3.memory.MemoryCache
import coil3.network.httpHeaders
import coil3.request.crossfade
import coil3.util.DebugLogger
import okio.Path.Companion.toPath

private val imageAcceptHeaderInterceptor = Interceptor { chain ->
    val request = chain.request
    if (request.httpHeaders["Accept"] != null) {
        chain.proceed()
    } else {
        val headers = request.httpHeaders.newBuilder()
            .apply { this["Accept"] = "image/*" }
            .build()
        chain.withRequest(
            request.newBuilder()
                .httpHeaders(headers)
                .build(),
        ).proceed()
    }
}

fun coilImageLoader(
    context: PlatformContext,
    debug: Boolean,
): ImageLoader {
    return ImageLoader.Builder(context)
        .components {
            add(imageAcceptHeaderInterceptor)
        }
        .memoryCache {
            MemoryCache.Builder()
                // Set the max size to 25% of the app's available memory.
                .maxSizePercent(context, percent = 0.25)
                .build()
        }
        .diskCache {
            newDiskCache(context)
        }
        .crossfade(true)
        .apply {
            if (debug) {
                logger(DebugLogger())
            }
        }
        .build()
}

internal fun newDiskCache(context: PlatformContext): DiskCache {
    return DiskCache.Builder()
        .directory(context.cacheDir.absolutePath.toPath().resolve("images_cache"))
        .build()
}

```

### Core Architecture Module: `androidApp/src/main/kotlin/com/prof18/feedflow/android/ui/utils/Localization.kt`
```
package com.prof18.feedflow.android.ui.utils

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ProvidableCompositionLocal
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.text.intl.Locale
import cafe.adriel.lyricist.LanguageTag
import cafe.adriel.lyricist.Lyricist
import cafe.adriel.lyricist.ProvideStrings
import cafe.adriel.lyricist.rememberStrings
import com.prof18.feedflow.i18n.EnFeedFlowStrings
import com.prof18.feedflow.i18n.FeedFlowStrings
import com.prof18.feedflow.i18n.feedFlowStrings

public val LocalFeedFlowStrings: ProvidableCompositionLocal<FeedFlowStrings> =
    staticCompositionLocalOf { EnFeedFlowStrings }

@Composable
public fun rememberFeedFlowStrings(
    defaultLanguageTag: LanguageTag = "en",
    currentLanguageTag: LanguageTag = Locale.current.toLanguageTag(),
): Lyricist<FeedFlowStrings> =
    rememberStrings(feedFlowStrings, defaultLanguageTag, currentLanguageTag)

@Composable
public fun ProvideFeedFlowStrings(
    lyricist: Lyricist<FeedFlowStrings>,
    content: @Composable () -> Unit,
) {
    ProvideStrings(lyricist, LocalFeedFlowStrings, content)
}

```

### Core Architecture Module: `androidApp/src/main/kotlin/com/prof18/feedflow/android/ui/utils/PreviewUtils.kt`
```
package com.prof18.feedflow.android.ui.utils

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prof18.feedflow.android.ui.style.DarkColorScheme
import com.prof18.feedflow.android.ui.style.FeedFlowShapes
import com.prof18.feedflow.android.ui.style.LightColorScheme
import com.prof18.feedflow.android.ui.style.Spacing

@Composable
fun PreviewHelper(
    modifier: Modifier = Modifier,
    paddingEnabled: Boolean = true,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(modifier = modifier) {
        PreviewTheme(darkTheme = false) {
            PreviewColumn(paddingEnabled = paddingEnabled, content = content)
        }
        PreviewTheme(darkTheme = true) {
            PreviewColumn(paddingEnabled = paddingEnabled, content = content)
        }
    }
}

@Composable
fun PreviewColumn(
    modifier: Modifier = Modifier,
    paddingEnabled: Boolean = true,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier = modifier
            .background(MaterialTheme.colorScheme.background)
            .padding(
                if (paddingEnabled) Spacing.small else 0.dp,
            ),
        verticalArrangement = Arrangement.spacedBy(Spacing.small),
    ) {
        content()
    }
}

@Composable
fun PreviewTheme(
    darkTheme: Boolean = false,
    content: @Composable () -> Unit,
) {
    val colorScheme = when {
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        shapes = FeedFlowShapes,
        content = content,
    )
}

```

### Core Architecture Module: `androidApp/src/main/kotlin/com/prof18/feedflow/android/ui/utils/ReduceMotion.kt`
```
package com.prof18.feedflow.android.ui.utils

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.AnimatedVisibilityScope
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.AnimationSpec
import androidx.compose.animation.core.FiniteAnimationSpec
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.spring
import androidx.compose.animation.expandIn
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkOut
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.staggeredgrid.LazyStaggeredGridState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.Modifier

val LocalReduceMotion = compositionLocalOf { false }

@Composable
fun ConditionalAnimatedVisibility(
    visible: Boolean,
    modifier: Modifier = Modifier,
    enter: EnterTransition = fadeIn() + expandIn(),
    exit: ExitTransition = shrinkOut() + fadeOut(),
    label: String = "AnimatedVisibility",
    content: @Composable AnimatedVisibilityScope.() -> Unit,
) {
    val reduceMotionEnabled = LocalReduceMotion.current
    AnimatedVisibility(
        visible = visible,
        modifier = modifier,
        enter = if (reduceMotionEnabled) EnterTransition.None else enter,
        exit = if (reduceMotionEnabled) ExitTransition.None else exit,
        label = label,
        content = content,
    )
}

@Composable
fun <T> conditionalAnimateAsState(
    targetValue: T,
    animationSpec: AnimationSpec<T>,
    label: String = "",
    finishedListener: ((T) -> Unit)? = null,
    animateFunction: @Composable (
        targetValue: T,
        animationSpec: AnimationSpec<T>,
        label: String,
        finishedListener: ((T) -> Unit)?,
    ) -> State<T>,
): State<T> {
    val reduceMotionEnabled = LocalReduceMotion.current
    val actualAnimationSpec = if (reduceMotionEnabled) {
        snap()
    } else {
        animationSpec
    }
    return animateFunction(targetValue, actualAnimationSpec, label, finishedListener)
}

@Composable
fun conditionalAnimateFloatAsState(
    targetValue: Float,
    animationSpec: FiniteAnimationSpec<Float> = spring(),
    label: String = "",
    finishedListener: ((Float) -> Unit)? = null,
): State<Float> {
    val reduceMotionEnabled = LocalReduceMotion.current
    val actualAnimationSpec = if (reduceMotionEnabled) {
        snap()
    } else {
        animationSpec
    }
    return animateFloatAsState(
        targetValue = targetValue,
        animationSpec = actualAnimationSpec,
        label = label,
        finishedListener = finishedListener,
    )
}

suspend fun LazyListState.scrollToItemConditionally(
    index: Int,
    scrollOffset: Int = 0,
    reduceMotionEnabled: Boolean,
) {
    if (reduceMotionEnabled) {
        scrollToItem(index, scrollOffset)
    } else {
        animateScrollToItem(index, scrollOffset)
    }
}

@OptIn(ExperimentalFoundationApi::class)
suspend fun LazyStaggeredGridState.scrollToItemConditionally(
    index: Int,
    scrollOffset: Int = 0,
    reduceMotionEnabled: Boolean,
) {
    if (reduceMotionEnabled) {
        scrollToItem(index, scrollOffset)
    } else {
        animateScrollToItem(index, scrollOffset)
    }
}

```

### Core Architecture Module: `androidApp/src/main/kotlin/com/prof18/feedflow/android/util/Localization.kt`
```
package com.prof18.feedflow.android.util

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.ui.text.intl.Locale
import cafe.adriel.lyricist.Lyricist
import com.prof18.feedflow.android.ui.utils.rememberFeedFlowStrings
import com.prof18.feedflow.i18n.FeedFlowStrings
import com.prof18.feedflow.shared.data.SettingsRepository

@Composable
internal fun rememberAndroidFeedFlowStrings(settingsRepository: SettingsRepository): Lyricist<FeedFlowStrings> {
    val forceEnglishEnabled by settingsRepository.forceEnglishEnabledFlow.collectAsState()
    val languageTag = if (forceEnglishEnabled) "en" else Locale.current.toLanguageTag()
    return key(languageTag) {
        rememberFeedFlowStrings(currentLanguageTag = languageTag)
    }
}

```

### Core Architecture Module: `androidApp/src/main/kotlin/com/prof18/feedflow/android/util/ReduceMotion.kt`
```
package com.prof18.feedflow.android.util

import android.animation.ValueAnimator
import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext

@Composable
fun rememberSystemReducedMotionEnabled(): Boolean {
    val context = LocalContext.current
    var isReducedMotionEnabled by remember {
        mutableStateOf(!ValueAnimator.areAnimatorsEnabled())
    }

    DisposableEffect(context) {
        val resolver = context.contentResolver
        val observer = object : ContentObserver(Handler(Looper.getMainLooper())) {
            override fun onChange(selfChange: Boolean) {
                isReducedMotionEnabled = !ValueAnimator.areAnimatorsEnabled()
            }
        }

        resolver.registerContentObserver(
            Settings.Global.getUriFor(Settings.Global.ANIMATOR_DURATION_SCALE),
            false,
            observer,
        )

        onDispose {
            resolver.unregisterContentObserver(observer)
        }
    }

    return isReducedMotionEnabled
}

```

### Core Architecture Module: `androidApp/src/main/kotlin/com/prof18/feedflow/android/util/UiExtensions.kt`
```
package com.prof18.feedflow.android.util

import android.content.res.Configuration
import androidx.activity.ComponentActivity
import androidx.core.util.Consumer
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.conflate
import kotlinx.coroutines.flow.distinctUntilChanged

// From https://github.com/android/nowinandroid/blob/main/app/src/main/kotlin/com/google/samples/apps/nowinandroid/util/UiExtensions.kt
/**
 * Convenience wrapper for dark mode checking
 */
val Configuration.isSystemInDarkTheme
    get() = (uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

/**
 * Registers listener for configuration changes to retrieve whether system is in dark theme or not.
 * Immediately upon subscribing, it sends the current value and then registers listener for changes.
 */
fun ComponentActivity.isSystemInDarkTheme() = callbackFlow {
    channel.trySend(resources.configuration.isSystemInDarkTheme)

    val listener = Consumer<Configuration> {
        channel.trySend(it.isSystemInDarkTheme)
    }

    addOnConfigurationChangedListener(listener)

    awaitClose { removeOnConfigurationChangedListener(listener) }
}
    .distinctUntilChanged()
    .conflate()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #682** (2025-08-30): **feat: Disable embedded images for a feed**
  *Symptoms*: # Issue Image of some articles with emojis shows first emoji used in forum. This happens to me with both the Arch forums and the FreeBSD forums  ![Image](https://github.com/user-attachments/assets/bdae8832-0965-4d9b-89dd-428d5803b161)  # Expected Behaviour never show an article image as an emoji  # Possible Fix Implement a feature to disable image embedding on a per-feed base.  # Environment: Android 15 feed-flow version: 1.4.0

- **Issue #662** (2025-08-30): **[Android] Downloading wrong link**
  *Symptoms*: When retrieving articles from some WordPress sites, the reader downloads the article feed (https://skribeworks.com/ottie-pancakes-cursed-location/feed/atom/), in the alternate href, instead of the article (https://skribeworks.com/ottie-pancakes-cursed-location).  Android 15 Feedflow 1.3.0

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

### Incident Patch 1: `fe494bb6` (2026-11-01)
**Commit Message**: Generate the desktop licenses JSON at build time instead of committing it

Every desktop build rewrote the committed aboutlibraries.json from the
resolved dependencies, so it showed up modified after each dependency
update. Export it to build/generated and add that folder to the jvmMain
resources, and drop the release workflow steps that passed an export
path the plugin no longer reads.

**File**: `.github/workflows/linux-release.yml` (modified, +0/-3)
```diff
@@ -50,9 +50,6 @@ jobs:
           echo "version=$VERSION" >> $GITHUB_OUTPUT
           echo "VERSION=$VERSION" >> $GITHUB_ENV
 
-      - name: Update Licenses file
-        run: ./gradlew :desktopApp:exportLibraryDefinitions -PaboutLibraries.exportPath=src/main/resources/
-
       - name: Create path variables
         id: path_variables
         run: |
```

**File**: `.github/workflows/macos-release.yml` (modified, +0/-3)
```diff
@@ -63,9 +63,6 @@ jobs:
           echo "version=$VERSION" >> $GITHUB_OUTPUT
           echo "VERSION=$VERSION" >> $GITHUB_ENV
 
-      - name: Update Licenses file
-        run: ./gradlew :desktopApp:exportLibraryDefinitions -PaboutLibraries.exportPath=src/main/resources/
-
       - name: Create path variables
         id: path_variables
         run: |
```

**File**: `.github/workflows/macos-testflight-release.yml` (modified, +0/-3)
```diff
@@ -80,9 +80,6 @@ jobs:
         env:
           RUNTIME_PROVISION: ${{ secrets.RUNTIME_PROVISION }}
 
-      - name: Update Licenses file
-        run: ./gradlew :desktopApp:exportLibraryDefinitions -PaboutLibraries.exportPath=src/main/resources/
-
       - name: Read version from properties
         id: version
         run: |
```

**File**: `.github/workflows/windows-release.yml` (modified, +0/-3)
```diff
@@ -60,9 +60,6 @@ jobs:
           "version=$VERSION" >> $env:GITHUB_OUTPUT
           "VERSION=$VERSION" >> $env:GITHUB_ENV
 
-      - name: Update Licenses file
-        run: ./gradlew :desktopApp:exportLibraryDefinitions "-PaboutLibraries.exportPath=src/main/resources/"
-
       - name: Create path variables
         id: path_variables
         shell: pwsh
```

**File**: `desktopApp/build.gradle.kts` (modified, +5/-1)
```diff
@@ -48,12 +48,15 @@ val isMacOS = System.getProperty("os.name").lowercase().contains("mac")
 val isLinux = System.getProperty("os.name").lowercase().contains("linux")
 val isWindows = System.getProperty("os.name").startsWith("Windows", ignoreCase = true)
 
+// Generated on every build from the resolved dependencies, so it stays out of the source tree.
+val generatedLicensesDir = layout.buildDirectory.dir("generated/aboutlibraries")
+
 aboutLibraries {
     collect {
         configPath.set(file("config/aboutlibraries"))
     }
     export {
-        outputFile.set(file("src/jvmMain/resources/aboutlibraries.json"))
+        outputFile.set(generatedLicensesDir.map { it.file("aboutlibraries.json") })
     }
 }
 
@@ -93,6 +96,7 @@ kotlin {
     sourceSets {
         jvmMain {
             kotlin.srcDir(generateDesktopBuildInfo)
+            resources.srcDir(tasks.named("exportLibraryDefinitions").map { generatedLicensesDir.get() })
             dependencies {
                 implementation(libs.jewel.int.ui.standalone)
                 implementation(libs.jewel.platform.icons)
```

---

### Incident Patch 2: `12b3e69c` (2026-11-01)
**Commit Message**: Weekly agent-instructions audit: drop sharedUI paths, single desktop Settings window, Flathub manifest location, gplay in translation audit

**File**: `.ai/skills/translation-release-audit/SKILL.md` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@ Optional live-store checks:
    - Store listing screenshot images changed: store screenshots may need upload.
    - Website screenshot assets changed: website screenshot gallery/hero may need deploy.
 6. If live store checking is requested or this is the weekly automation, compare against current store state when credentials are available.
-   - Google Play: read live state with `.scripts/pull-google-play-listing.py` (see Live Store Checks), never with Gradle Play Publisher bootstrap. If the script's config is unavailable, report the live check as unavailable and continue with checked-in listing output/source-copy checks.
+   - Google Play: read live state with `gplay metadata pull` (see Live Store Checks), never with Gradle Play Publisher bootstrap. If gplay is not installed or not logged in, report the live check as unavailable and continue with checked-in listing output/source-copy checks.
    - App Store: pull metadata/screenshots into a temp directory and compare against FeedFlow's source store/screenshot copy where mapping is clear.
    - Microsoft Store: read the live listing with `pcenter listing show` and compare against `assets/storecopy/<locale>/`.
 7. Add follow-up TODOs to the FeedFlow native Obsidian Base when the audit finds actionable store release work.
```

**File**: `AGENTS.md` (modified, +8/-7)
```diff
@@ -209,9 +209,9 @@ Generic patterns (Screen/ScreenContent split, ViewModel shape, events, SwiftUI f
 
 - **ViewModel:** `shared/src/commonMain/kotlin/com/prof18/feedflow/shared/presentation/`. Register it with `viewModel { }` in `shared/src/commonMain/.../shared/di/Koin.kt` (iOS-only ViewModels go in `shared/src/iosMain/.../shared/di/KoinIOS.kt`).
 - **iOS access:** add `fun getXxxViewModel()` to `object Deps` in `shared/src/iosMain/.../shared/di/KoinIOS.kt`.
-- **Shared Compose UI:** `XxxScreenContent` goes in `sharedUI/src/commonMain/kotlin/com/prof18/feedflow/shared/ui/<feature>/` when Android and Desktop both use it. Reuse preview data from `sharedUI/.../ui/preview/PreviewItems.kt` and the `@PreviewPhone`/`@PreviewFoldable`/`@PreviewTablet` annotations (`sharedUI/src/androidMain/.../ui/preview/FeedFlowPreview.kt`).
+- **Compose UI:** there is no shared UI module; Android and Desktop each own their UI. Android `XxxScreenContent` goes in the feature package under `androidApp/src/main/kotlin/com/prof18/feedflow/android/<feature>/`; Desktop Jewel UI goes under `desktopApp/.../desktop/<feature>/` (see `docs/DESKTOP_UI.md`). Android previews reuse `androidApp/.../android/ui/preview/PreviewItems.kt` and the `@PreviewPhone`/`@PreviewFoldable`/`@PreviewTablet` annotations in `androidApp/.../android/ui/preview/FeedFlowPreview.kt`.
 - **Android:** wrapper `androidApp/.../android/<feature>/XxxScreen.android.kt`, route (`@Serializable ... : NavKey`) in `androidApp/.../android/Screen.kt`, `entry<Route>` in `MainActivity.FeedFlowNavigation()`. Go back with `popBackStackOrFinish(backStack)` (the `navigateBack` lambda).
-- **Desktop:** wrapper `desktopApp/.../desktop/<feature>/XxxScreen.desktop.kt`. In-window pages get a `NavKey` in `desktopApp/.../desktop/Screen.kt` and an `entry<Route>` in `screens()` in `desktop/main/MainWindow.kt`. Settings/detail pages are dialog windows instead (see "Desktop screens/windows").
+- **Desktop:** wrapper `desktopApp/.../desktop/<feature>/XxxScreen.desktop.kt`. In-window pages get a `NavKey` in `desktopApp/.../desktop/Screen.kt` and an `entry<Route>` in `screens()` in `desktop/main/MainWindow.kt`. Preferences go in the Settings window and other detail pages are dialog windows instead (see "Desktop screens/windows").
 - **ViewModel scope:** no Navigation 3 ViewModel entry decorator is installed, so `koinViewModel()` inside an entry is scoped to the Activity/window. The ViewModel outlives the screen and is reused next time; reset per-screen state explicitly (as `SearchScreen` does with `resetSearch()`).
 - **iOS:** `iosApp/Source/<Feature>/XxxScreen.swift` + `XxxScreenContent.swift`. Add a case to `CommonViewRoute` (`iosApp/Source/App/Model/CommonViewRoute.swift`) and handle it in the `.navigationDestination(for: CommonViewRoute.self)` of **both** `RegularView.swift` and `CompactView.swift`. Navigate with `appState.navigate(route:)`. Surface errors via `appState.snackbarQueue` + `.snackbar(messageQueue:)`.
 - **Strings:** `LocalFeedFlowStrings.current` in Compose, `feedFlowStrings` in Swift.
@@ -246,13 +246,14 @@ For Miniflux/GReader sync failures, compare FeedFlow's exact requests and header
 - Prefer keeping data classes and other simple model types at the bottom of a file, or in a dedicated model file when they are shared by multiple classes.
 - Android app modules use AGP 9's built-in Kotlin support; do not re-add `org.jetbrains.kotlin.android`. Android and Desktop app version values come from the `com.feedflow.versioning` convention plugin, not `versioning.gradle.kts`.
 - Detekt is on Detekt 2 (`dev.detekt`, ktlint via `detekt-rules-ktlint-wrapper`). Bump `io.nlopez.compose.rules:detekt` only to a release whose dependency matrix matches the repo's Detekt and Kotlin versions. `config/detekt/detekt.yml` holds only overrides on top of the defaults (`buildUponDefaultConfig`); add a rule there only to change it.
-- `detekt` also runs the type-resolved tasks (`detektMainJvm` in KMP modules, `detektGooglePlayDebug`/`detektFdroidDebug` in `androidApp`), which compile the code first; rules such as compose-rules' `UnnecessaryLaunchedEffect` and `MissingReadOnlyComposable` only run there. For a quick source-only pass use a light task like `:sharedUI:detektCommonMainSourceSet`. Generated sources under `build/` are excluded. "Compiler errors found during analysis" on KMP modules comes from Detekt flattening expect/actual into one module; `-Pfeedflow.detektDebug=true` prints them.
+- `detekt` also runs the type-resolved tasks (`detektMainJvm` in KMP modules, `detektGooglePlayDebug`/`detektFdroidDebug` in `androidApp`), which compile the code first; rules such as compose-rules' `UnnecessaryLaunchedEffect` and `MissingReadOnlyComposable` only run there. For a quick source-only pass use a light task like `:shared:detektCommonMainSourceSet`. Generated sources under `build/` are excluded. "Compiler errors found during analysis" on KMP modules comes from Detekt flattening expect/actual into one module
```

---

### Incident Patch 3: `3bf4fa7d` (2026-11-01)
**Commit Message**: Fix compiler and Gradle deprecation warnings

**File**: `androidApp/build.gradle.kts` (modified, +4/-2)
```diff
@@ -14,8 +14,10 @@ plugins {
     alias(libs.plugins.kotlin.serialization)
 }
 
-val appVersionCode: () -> Int by extra
-val appVersionName: () -> String by extra
+@Suppress("UNCHECKED_CAST")
+val appVersionCode = extra["appVersionCode"] as () -> Int
+@Suppress("UNCHECKED_CAST")
+val appVersionName = extra["appVersionName"] as () -> String
 
 val local = Properties()
 val localProperties: File = rootProject.file("keystore.properties")
```

**File**: `androidApp/src/test/kotlin/com/prof18/feedflow/android/audio/AndroidSpeechAudioGeneratorTest.kt` (modified, +2/-0)
```diff
@@ -9,6 +9,7 @@ import kotlinx.coroutines.CompletableDeferred
 import kotlinx.coroutines.CoroutineDispatcher
 import kotlinx.coroutines.CoroutineStart
 import kotlinx.coroutines.Dispatchers
+import kotlinx.coroutines.ExperimentalCoroutinesApi
 import kotlinx.coroutines.Job
 import kotlinx.coroutines.async
 import kotlinx.coroutines.cancelAndJoin
@@ -32,6 +33,7 @@ import org.robolectric.shadows.ShadowTextToSpeech
 import java.io.File
 import java.io.RandomAccessFile
 
+@OptIn(ExperimentalCoroutinesApi::class)
 @RunWith(RobolectricTestRunner::class)
 @Config(manifest = Config.NONE, application = Application::class, sdk = [Build.VERSION_CODES.O])
 class AndroidSpeechAudioGeneratorTest {
```

**File**: `core/build.gradle.kts` (modified, +2/-1)
```diff
@@ -3,8 +3,9 @@ plugins {
 }
 
 kotlin {
-    androidLibrary {
+    android {
         namespace = "com.prof18.feedflow.core"
+        withHostTest {}
     }
 
     compilerOptions {
```

**File**: `core/src/commonMain/kotlin/com/prof18/feedflow/core/model/SuggestedFeedCategory.kt` (modified, +6/-0)
```diff
@@ -1,15 +1,21 @@
 package com.prof18.feedflow.core.model
 
+import kotlin.experimental.ExperimentalObjCName
+import kotlin.native.ObjCName
+
 data class SuggestedFeedCategory(
     val id: String,
     val name: String,
     val icon: String,
     val feeds: List<SuggestedFeed>,
 )
 
+@OptIn(ExperimentalObjCName::class)
 data class SuggestedFeed(
     val name: String,
     val url: String,
+    // `description` collides with NSObject.description in Swift.
+    @ObjCName("feedDescription")
     val description: String,
     val logoUrl: String? = null,
 )
```

**File**: `database/build.gradle.kts` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ plugins {
 }
 
 kotlin {
-    androidLibrary {
+    android {
         namespace = "com.prof18.feedflow.database"
     }
 
```

**File**: `desktopApp/build.gradle.kts` (modified, +10/-1)
```diff
@@ -20,7 +20,7 @@ val appVersionName = extra["appVersionName"] as () -> String
 @Suppress("UNCHECKED_CAST")
 val appVersionCode = extra["appVersionCode"] as () -> Int
 
-val generateDesktopBuildInfo by tasks.registering {
+val generateDesktopBuildInfo = tasks.register("generateDesktopBuildInfo") {
     val versionName = appVersionName()
     inputs.property("versionName", versionName)
     val outputDirectory = layout.buildDirectory.dir("generated/desktop-build-info/kotlin")
@@ -159,6 +159,15 @@ kotlin {
     }
 }
 
+dependencies {
+    constraints {
+        // Jewel markdown images pins older Coil JVM artifacts, which drag in an incompatible Skiko.
+        val coilVersion = libs.versions.io.coil.get()
+        add("jvmMainImplementation", "io.coil-kt.coil3:coil-svg-jvm:$coilVersion")
+        add("jvmMainImplementation", "io.coil-kt.coil3:coil-network-ktor3-jvm:$coilVersion")
+    }
+}
+
 tasks.withType<Test>().configureEach {
     javaLauncher.set(javaToolchains.launcherFor {
         languageVersion = JavaLanguageVersion.of(25)
```

**File**: `desktopApp/src/jvmMain/kotlin/com/prof18/feedflow/desktop/about/LicensesScreen.desktop.kt` (modified, +5/-4)
```diff
@@ -28,7 +28,6 @@ import androidx.compose.ui.focus.FocusRequester
 import androidx.compose.ui.focus.focusRequester
 import androidx.compose.ui.platform.LocalDensity
 import androidx.compose.ui.platform.testTag
-import androidx.compose.ui.res.useResource
 import androidx.compose.ui.semantics.contentDescription
 import androidx.compose.ui.semantics.selected
 import androidx.compose.ui.semantics.semantics
@@ -46,7 +45,6 @@ import kotlinx.coroutines.withContext
 import org.jetbrains.jewel.foundation.theme.JewelTheme
 import org.jetbrains.jewel.ui.component.CircularProgressIndicator
 import org.jetbrains.jewel.ui.component.DefaultButton
-import org.jetbrains.jewel.ui.component.ListItemState
 import org.jetbrains.jewel.ui.component.SimpleListItem
 import org.jetbrains.jewel.ui.component.Text
 import org.jetbrains.jewel.ui.component.Tooltip
@@ -57,7 +55,9 @@ fun LicensesScreen(onBackClick: () -> Unit, modifier: Modifier = Modifier) {
     val report by produceState<Result<Libs>?>(initialValue = null) {
         value = withContext(dispatchers.default) {
             runCatching {
-                val json = useResource("aboutlibraries.json") { it.bufferedReader().readText() }
+                val json = requireNotNull(DI::class.java.classLoader?.getResourceAsStream("aboutlibraries.json"))
+                    .bufferedReader()
+                    .use { it.readText() }
                 Libs.Builder().withJson(json).build()
             }
         }
@@ -121,7 +121,8 @@ internal fun LicensesContent(
                             Tooltip(tooltip = { Text(accessibleLabel) }) {
                                 SimpleListItem(
                                     text = label,
-                                    state = ListItemState(isSelected = selectedId == library.uniqueId, isActive = true),
+                                    selected = selectedId == library.uniqueId,
+                                    active = true,
                                     modifier = Modifier
                                         .fillMaxWidth()
                                         .focusRequester(focus)
```

**File**: `desktopApp/src/jvmMain/kotlin/com/prof18/feedflow/desktop/accounts/CredentialsForm.kt` (modified, +2/-0)
```diff
@@ -38,6 +38,7 @@ import com.prof18.feedflow.desktop.testing.AccountE2eIds
 import com.prof18.feedflow.desktop.ui.LocalFeedFlowStrings
 import com.prof18.feedflow.desktop.ui.components.ConfirmationDialog
 import com.prof18.feedflow.desktop.ui.components.ProgressButtonLabel
+import org.jetbrains.jewel.foundation.ExperimentalJewelApi
 import org.jetbrains.jewel.ui.Outline
 import org.jetbrains.jewel.ui.component.DefaultButton
 import org.jetbrains.jewel.ui.component.Icon
@@ -192,6 +193,7 @@ private fun CredentialFields(
 }
 
 @Composable
+@OptIn(ExperimentalJewelApi::class)
 private fun CredentialField(
     label: String,
     value: TextFieldValue,
```

#### Recent Merged Pull Requests:
- **PR #1610** (2026-11-01): Remove the iOS widget refresh button (@prof18)
- **PR #1609** (2026-11-01): Fix compiler and Gradle deprecation warnings (@prof18)
- **PR #1608** (2026-11-01): Wait for X11 window bounds to settle in the desktop window size test (@prof18)
- **PR #1607** (2026-11-01): Merge localization into main (@github-actions[bot])
- **PR #1606** (2026-10-31): Split collapsed desktop sidebar sections across preference keys to stay under the value size limit (@prof18)
- **PR #1605** (2026-10-31): Re-inject the audio playback controller at the iOS split view and navigation boundaries (@prof18)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
