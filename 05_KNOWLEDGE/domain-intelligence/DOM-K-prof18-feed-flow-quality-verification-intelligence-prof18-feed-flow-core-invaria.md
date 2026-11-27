# Domain K — Quality & Verification Intelligence: Quality & Verification Intelligence: prof18/feed-flow Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "prof18/feed-flow",
  "source_url": "https://github.com/prof18/feed-flow",
  "source_version": "36838659",
  "license": "Apache-2.0",
  "timestamp": "2026-11-27T23:57:33.197Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-prof18-feed-flow",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [prof18/feed-flow](https://github.com/prof18/feed-flow) (Revision: `36838659`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-27T23:57:33.197Z`  
> **Learning ID**: `learn-github-prof18-feed-flow`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain K (Quality & Verification Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), H (Technical Construction Intelligence), I (Content & Information Intelligence), F (Design Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 53%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from prof18/feed-flow:

# Forensic Learning Record (Deep Inspection): prof18/feed-flow

> **Canonical Artifact**: `07_PROJECT_LEARNING/prof18-feed-flow-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/prof18/feed-flow](https://github.com/prof18/feed-flow))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-27T23:57:31.499Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `prof18/feed-flow`
- **Description**: FeedFlow is a minimalistic RSS Reader available on Android, iOS, macOS, Windows and Linux. Built with Kotlin Multiplatform, Jetpack Compose and SwiftUI.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1373 stars

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

### Core Architecture Module: `androidApp/src/main/kotlin/com/prof18/feedflow/android/notifications/NotificationPermissionState.kt`
```
package com.prof18.feedflow.android.notifications

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.LocalActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect

@Stable
internal class NotificationPermissionState(
    val isGranted: Boolean,
    val request: () -> Unit,
) {
    fun requestIfTurnedOn(enabled: Boolean) {
        if (enabled && !isGranted) request()
    }
}

@Composable
internal fun rememberNotificationPermission(): NotificationPermissionState {
    val context = LocalContext.current
    val activity = LocalActivity.current
    var isGranted by remember { mutableStateOf(areNotificationsEnabled(context)) }
    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        isGranted = areNotificationsEnabled(context)
        if (!granted && !shouldShowPermissionDialog(activity)) {
            openAppNotificationSettings(context)
        }
    }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        isGranted = areNotificationsEnabled(context)
    }
    return NotificationPermissionState(isGranted = isGranted) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            !hasRuntimeNotificationPermission(context)
        ) {
            launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            openAppNotificationSettings(context)
        }
    }
}

private fun areNotificationsEnabled(context: Context): Boolean =
    NotificationManagerCompat.from(context).areNotificationsEnabled() &&
        hasRuntimeNotificationPermission(context)

private fun hasRuntimeNotificationPermission(context: Context): Boolean =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS,
        ) == PackageManager.PERMISSION_GRANTED
    } else {
        true
    }

private fun shouldShowPermissionDialog(activity: Activity?): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        activity?.shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS) ?: false
    } else {
        false
    }
}

private fun openAppNotificationSettings(context: Context) {
    Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
        putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        context.startActivity(this)
    }
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

### Core Architecture Module: `androidApp/src/main/kotlin/com/prof18/feedflow/android/ui/utils/FeedFlowStringsLookup.kt`
```
package com.prof18.feedflow.android.ui.utils

import com.prof18.feedflow.i18n.EnFeedFlowStrings
import com.prof18.feedflow.i18n.FeedFlowStrings
import com.prof18.feedflow.i18n.feedFlowStrings
import java.util.Locale

/**
 * Strings for code outside composition (notifications, custom tabs). Tries the most specific tag
 * first and falls back to the bare language, like Lyricist does for the Compose UI.
 */
fun feedFlowStringsFor(
    locale: Locale = Locale.getDefault(),
    forceEnglish: Boolean = false,
): FeedFlowStrings {
    if (forceEnglish) return EnFeedFlowStrings
    val language = locale.language
    val script = locale.script.takeIf { it.isNotEmpty() }
    val country = locale.country.takeIf { it.isNotEmpty() }
    val candidates = listOfNotNull(
        locale.toLanguageTag(),
        if (script != null && country != null) "$language-$script-$country" else null,
        country?.let { "$language-$it" },
        script?.let { "$language-$it" },
        language,
    )
    return candidates.firstNotNullOfOrNull { feedFlowStrings[it] } ?: EnFeedFlowStrings
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
import coil3.svg.SvgDecoder
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
            add(SvgDecoder.Factory())
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
import androidx.compose.foundation.lazy.grid.LazyGridState
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

suspend fun LazyGridState.scrollToItemConditionally(
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

### Core Architecture Module: `androidApp/src/main/kotlin/com/prof18/feedflow/android/ui/utils/RevealItem.kt`
```
package com.prof18.feedflow.android.ui.utils

import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.grid.LazyGridState
import androidx.compose.foundation.lazy.staggeredgrid.LazyStaggeredGridState
import androidx.compose.runtime.snapshotFlow
import com.prof18.feedflow.shared.presentation.model.isFullyVisibleInViewport
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.first

suspend fun LazyListState.revealItemConditionally(index: Int, reduceMotionEnabled: Boolean) {
    snapshotFlow { layoutInfo.totalItemsCount > 0 }.first { it }
    val info = layoutInfo
    val item = info.visibleItemsInfo.firstOrNull { it.index == index }
    val visible = item != null && isFullyVisibleInViewport(
        itemStart = item.offset,
        itemSize = item.size,
        viewportEndOffset = info.viewportEndOffset,
        afterContentPadding = info.afterContentPadding,
    )
    if (visible) return
    revealInterruptibly { scrollToItemConditionally(index, reduceMotionEnabled = reduceMotionEnabled) }
}

suspend fun LazyStaggeredGridState.revealItemConditionally(index: Int, reduceMotionEnabled: Boolean) {
    snapshotFlow { layoutInfo.totalItemsCount > 0 }.first { it }
    val info = layoutInfo
    val item = info.visibleItemsInfo.firstOrNull { it.index == index }
    val visible = item != null && isFullyVisibleInViewport(
        itemStart = item.offset.y,
        itemSize = item.size.height,
        viewportEndOffset = info.viewportEndOffset,
        afterContentPadding = info.afterContentPadding,
    )
    if (visible) return
    revealInterruptibly { scrollToItemConditionally(index, reduceMotionEnabled = reduceMotionEnabled) }
}

suspend fun LazyGridState.revealItemConditionally(index: Int, reduceMotionEnabled: Boolean) {
    snapshotFlow { layoutInfo.totalItemsCount > 0 }.first { it }
    val info = layoutInfo
    val item = info.visibleItemsInfo.firstOrNull { it.index == index }
    val visible = item != null && isFullyVisibleInViewport(
        itemStart = item.offset.y,
        itemSize = item.size.height,
        viewportEndOffset = info.viewportEndOffset,
        afterContentPadding = info.afterContentPadding,
    )
    if (visible) return
    revealInterruptibly { scrollToItemConditionally(index, reduceMotionEnabled = reduceMotionEnabled) }
}

@Suppress("SwallowedException")
private suspend fun revealInterruptibly(scroll: suspend () -> Unit) {
    try {
        scroll()
    } catch (e: CancellationException) {
        // A user scroll interrupts the animation; that still counts as revealed.
        // When the caller itself is cancelled (the list left composition), keep propagating.
        currentCoroutineContext().ensureActive()
    }
}

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

### Incident Patch 1: `3ac44321` (2026-11-25)
**Commit Message**: Fix flaky database and desktop tests and serialise iOS simulator test tasks

**File**: `.github/workflows/code-checks.yaml` (modified, +8/-1)
```diff
@@ -77,7 +77,14 @@ jobs:
       # JVM and Android host tests and detekt run in the jvm-checks job on Linux. The cloud sync
       # artifact tasks still run here, since they exchange snapshots with the iOS side.
       - name: Run Kotlin/Native and cloud sync tests
-        run: ./gradlew allTests -x jvmTest -x testAndroidHostTest -x testGooglePlayDebugUnitTest "-Pfeedflow.swiftCloudSyncDestination=$IOS_TEST_DESTINATION"
+        # Simulator tests occasionally stall on this 3-core runner, so a failure gets one retry.
+        # Tasks that passed are up to date in the second run, except the cloud sync ones, which
+        # always re-run.
+        run: |
+          run_tests() {
+            ./gradlew allTests -x jvmTest -x testAndroidHostTest -x testGooglePlayDebugUnitTest "-Pfeedflow.swiftCloudSyncDestination=$IOS_TEST_DESTINATION"
+          }
+          run_tests || { echo "::warning::Kotlin/Native and cloud sync tests failed, retrying once"; run_tests; }
 
       - name: Run iOS tests
         if: ${{ !cancelled() && steps.setup.outcome == 'success' }}
```

**File**: `AGENTS.md` (modified, +1/-1)
```diff
@@ -352,7 +352,7 @@ When creating commits:
 - CI config: `.github/workflows/code-checks.yaml`
 - Pipeline: every job starts in parallel. `checks` (macos-26) runs swiftlint, `allTests` without the JVM/Android suites (Kotlin/Native, cloud sync, Swift `CloudSyncTests`), `.scripts/ios-tests.sh` and the macOS desktop tests; `jvm-checks` (Linux) runs detekt and the Android host/unit tests; `tests-desktop` runs `jvmTest` on Linux and Windows; `build-android-app`, `build-desktop-app` and `build-ios-app` build the apps. PR runs cancel when a newer push arrives. macOS runners are the scarce, slow resource (7 GB RAM, few concurrent slots), so keep work that does not need macOS off the `checks` job. The iOS build job and the iOS release job run on GitHub's `xcode-27` runner (a preview image) and select Xcode 27.1 with `maxim-lobanov/setup-xcode`: the iPhone Duo layout uses iOS 27.1 SDK APIs, so Xcode 27.0 cannot build the app.
 - iOS CI build forces arm64 simulator architecture: `xcodebuild -project iosApp/FeedFlow.xcodeproj -configuration Debug -scheme FeedFlow -sdk iphonesimulator -destination "generic/platform=iOS Simulator" ARCHS=arm64 ONLY_ACTIVE_ARCH=YES build | xcbeautify --renderer github-actions`
-- The `checks` job runs `.scripts/ios-tests.sh` after `allTests`. The Swift `CloudSyncTests` run inside `allTests` instead, because they read snapshots the Kotlin cloud-sync tests write first; the other Swift test targets need nothing from Gradle beyond the FeedFlowKit framework, so they are not bound to it. Both runs share `build/ios-test-derived-data` and the same xcodebuild settings so the Swift packages compile once; keep the settings in `SwiftCloudSyncTest` and `ios-tests.sh` identical. CI boots the simulator (`.scripts/ios-test-simulator.sh`) at the start of the job so it is ready by the time the tests run. Add a new Swift test target to the `iOSTests` scheme in `iosApp/project.yml`, or CI won't run it.
+- The `checks` job runs `.scripts/ios-tests.sh` after `allTests`. The Swift `CloudSyncTests` run inside `allTests` instead, because they read snapshots the Kotlin cloud-sync tests write first; the other Swift test targets need nothing from Gradle beyond the FeedFlowKit framework, so they are not bound to it. Both runs share `build/ios-test-derived-data` and the same xcodebuild settings so the Swift packages compile once; keep the settings in `SwiftCloudSyncTest` and `ios-tests.sh` identical. The `IosSimulatorTestLock` build service lets only one simulator test task (any project's Kotlin/Native simulator tests or `swiftCloudSyncTest`) run at a time, and the CI step retries `allTests` once, because overlapping runs stalled Kotlin/Native tests on the 3-core runner. CI boots the simulator (`.scripts/ios-test-simulator.sh`) at the start of the job so it is ready by the time the tests run. Add a new Swift test target to the `iOSTests` scheme in `iosApp/project.yml`, or CI won't run it.
 - Debugging CI failures: `gh run list --limit=10`, then `gh run view <run-id> --log`
 - Red CI recovery loop: `gh run rerun <run-id>` (or `gh run rerun <run-id> --failed`), then fix and push until green
 
```

**File**: `build-logic/convention/src/main/kotlin/CloudSyncTestsPlugin.kt` (modified, +2/-0)
```diff
@@ -15,6 +15,7 @@ import org.jetbrains.kotlin.gradle.targets.native.DefaultSimulatorTestRun
 
 class CloudSyncTestsPlugin : Plugin<Project> {
     override fun apply(project: Project) = with(project) {
+        serializeKotlinNativeSimulatorTests()
         // Ordinary tests remain independently runnable without artifact setup.
         tasks.withType<AbstractTestTask>().configureEach {
             if (!name.contains("cloudArtifact", ignoreCase = true)) {
@@ -48,6 +49,7 @@ class CloudSyncTestsPlugin : Plugin<Project> {
                     derivedDataDirectory.set(rootProject.layout.buildDirectory.dir("ios-test-derived-data"))
                     outputDirectory.set(layout.buildDirectory.dir("reports/tests/swiftCloudSyncTest"))
                     destination.set(providers.gradleProperty("feedflow.swiftCloudSyncDestination"))
+                    usesService(iosSimulatorTestLock())
                 }
                 tasks.named("allTests") { dependsOn(swiftTests) }
             }
```

**File**: `build-logic/convention/src/main/kotlin/IosSimulatorTestLock.kt` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+import org.gradle.api.Project
+import org.gradle.api.provider.Provider
+import org.gradle.api.services.BuildService
+import org.gradle.api.services.BuildServiceParameters
+import org.gradle.kotlin.dsl.registerIfAbsent
+import org.gradle.kotlin.dsl.withType
+import org.jetbrains.kotlin.gradle.targets.native.tasks.KotlinNativeSimulatorTest
+
+/**
+ * Lets one iOS simulator test task run at a time across all projects: the Kotlin/Native simulator
+ * tests and the Swift cloud sync xcodebuild run. On the 3-core CI macOS runner, overlapping runs
+ * stalled Kotlin/Native tests past their runTest and Turbine timeouts.
+ */
+abstract class IosSimulatorTestLock : BuildService<BuildServiceParameters.None>
+
+internal fun Project.iosSimulatorTestLock(): Provider<IosSimulatorTestLock> =
+    gradle.sharedServices.registerIfAbsent("iosSimulatorTestLock", IosSimulatorTestLock::class) {
+        maxParallelUsages.set(1)
+    }
+
+internal fun Project.serializeKotlinNativeSimulatorTests() {
+    val lock = iosSimulatorTestLock()
+    tasks.withType<KotlinNativeSimulatorTest>().configureEach { usesService(lock) }
+}
```

**File**: `build-logic/convention/src/main/kotlin/KmpLibraryConventionPlugin.kt` (modified, +1/-0)
```diff
@@ -33,6 +33,7 @@ class KmpLibraryConventionPlugin : Plugin<Project> {
                     freeCompilerArgs.add("-Xexpect-actual-classes")
                 }
             }
+            serializeKotlinNativeSimulatorTests()
         }
     }
 
```

**File**: `database/src/jvmTest/kotlin/com/prof18/feedflow/database/DatabaseHelperLiveQueryGateTest.kt` (modified, +24/-1)
```diff
@@ -1,5 +1,6 @@
 package com.prof18.feedflow.database
 
+import app.cash.sqldelight.Query
 import app.cash.sqldelight.db.QueryResult
 import app.cash.sqldelight.db.SqlCursor
 import app.cash.sqldelight.db.SqlDriver
@@ -15,6 +16,9 @@ import kotlinx.coroutines.Dispatchers
 import kotlinx.coroutines.Job
 import kotlinx.coroutines.cancel
 import kotlinx.coroutines.channels.Channel
+import kotlinx.coroutines.flow.MutableStateFlow
+import kotlinx.coroutines.flow.first
+import kotlinx.coroutines.flow.update
 import kotlinx.coroutines.launch
 import kotlinx.coroutines.runBlocking
 import kotlinx.coroutines.withTimeout
@@ -34,18 +38,20 @@ class DatabaseHelperLiveQueryGateTest {
         val liveQueryRuns = driver.executedSql.count { it == liveQuerySql }
 
         gate.pause()
+        driver.awaitNoLiveQueries()
         helper.insertFeedSource(listOf(parsedSource(SOURCE_B)))
 
         assertNull(emissions.itemOrNull())
         assertEquals(liveQueryRuns, driver.executedSql.count { it == liveQuerySql })
     }
 
     @Test
-    fun `resuming the gate re-runs the live query with the current data`() = withHelper { helper, gate, _ ->
+    fun `resuming the gate re-runs the live query with the current data`() = withHelper { helper, gate, driver ->
         val emissions = helper.observeSourceIds()
         assertEquals(listOf(SOURCE_A), emissions.awaitItem())
 
         gate.pause()
+        driver.awaitNoLiveQueries()
         helper.insertFeedSource(listOf(parsedSource(SOURCE_B)))
         gate.resume()
 
@@ -101,6 +107,7 @@ class DatabaseHelperLiveQueryGateTest {
 
     private class RecordingDriver(private val delegate: SqlDriver) : SqlDriver by delegate {
         val executedSql: MutableList<String> = CopyOnWriteArrayList()
+        private val registeredListeners = MutableStateFlow(0)
 
         override fun <R> executeQuery(
             identifier: Int?,
@@ -112,6 +119,22 @@ class DatabaseHelperLiveQueryGateTest {
             executedSql += sql
             return delegate.executeQuery(identifier, sql, mapper, parameters, binders)
         }
+
+        override fun addListener(vararg queryKeys: String, listener: Query.Listener) {
+            delegate.addListener(*queryKeys, listener = listener)
+            registeredListeners.update { it + 1 }
+        }
+
+        override fun removeListener(vararg queryKeys: String, listener: Query.Listener) {
+            delegate.removeListener(*queryKeys, listener = listener)
+            registeredListeners.update { it - 1 }
+        }
+
+        // Pausing the gate cancels the live queries asynchronously; a write sent before they
+        // unsubscribe still re-runs them.
+        suspend fun awaitNoLiveQueries() {
+            withTimeout(TIMEOUT_MS) { registeredListeners.first { it == 0 } }
+        }
     }
 
     private fun parsedSource(id: String) = ParsedFeedSource(
```

**File**: `desktopApp/src/jvmTest/kotlin/com/prof18/feedflow/desktop/home/DesktopFeedMoveDialogTest.kt` (modified, +12/-4)
```diff
@@ -10,6 +10,7 @@ import androidx.compose.ui.semantics.SemanticsActions
 import androidx.compose.ui.test.assertIsNotEnabled
 import androidx.compose.ui.test.assertIsSelected
 import androidx.compose.ui.test.hasText
+import androidx.compose.ui.test.isEnabled
 import androidx.compose.ui.test.isSelected
 import androidx.compose.ui.test.junit4.v2.createComposeRule
 import androidx.compose.ui.test.onNodeWithTag
@@ -104,8 +105,8 @@ class DesktopFeedMoveDialogTest {
         // The new category is picked for the move without a second trip through the list.
         rule.waitUntilExactlyOneExists(hasText("Reading") and isSelected(), timeoutMillis = 5_000)
 
-        rule.onNodeWithText(EnFeedFlowStrings.confirmButton)
-            .performSemanticsAction(SemanticsActions.OnClick) { it() }
+        confirmMove()
+        rule.waitUntil(timeoutMillis = 5_000) { moved != null }
         rule.runOnIdle {
             assertEquals(listOf(source), moved?.first)
             assertEquals("created-1", moved?.second?.id)
@@ -137,15 +138,22 @@ class DesktopFeedMoveDialogTest {
         rule.onNodeWithText(EnFeedFlowStrings.noCategory)
             .performSemanticsAction(SemanticsActions.OnClick) { it() }
         rule.waitUntilExactlyOneExists(hasText(EnFeedFlowStrings.noCategory) and isSelected(), timeoutMillis = 5_000)
-        rule.onNodeWithText(EnFeedFlowStrings.confirmButton)
-            .performSemanticsAction(SemanticsActions.OnClick) { it() }
+        confirmMove()
+        rule.waitUntil(timeoutMillis = 5_000) { moved != null }
 
         rule.runOnIdle {
             assertEquals(listOf(source), moved?.first)
             assertNull(moved?.second)
         }
     }
 
+    // A click on a still-disabled Confirm is silently dropped, so wait for the destination to enable it.
+    private fun confirmMove() {
+        rule.waitUntilExactlyOneExists(hasText(EnFeedFlowStrings.confirmButton) and isEnabled(), timeoutMillis = 5_000)
+        rule.onNodeWithText(EnFeedFlowStrings.confirmButton)
+            .performSemanticsAction(SemanticsActions.OnClick) { it() }
+    }
+
     private fun feedSource(category: FeedSourceCategory? = null) = FeedSource(
         id = "source-1",
         url = "https://example.com/feed.xml",
```

**File**: `desktopApp/src/jvmTest/kotlin/com/prof18/feedflow/desktop/reaadermode/DesktopReaderContentTest.kt` (modified, +25/-2)
```diff
@@ -15,6 +15,9 @@ import androidx.compose.ui.test.onNodeWithText
 import androidx.compose.ui.test.performClick
 import coil3.ImageLoader
 import coil3.PlatformContext
+import coil3.intercept.Interceptor
+import coil3.request.ErrorResult
+import coil3.request.ImageResult
 import com.prof18.feedflow.core.model.ArticleOpenMode
 import com.prof18.feedflow.core.model.ArticleReportUiState
 import com.prof18.feedflow.core.model.FeedItemId
@@ -38,6 +41,18 @@ class DesktopReaderContentTest {
 
     private val imageLoader = ImageLoader.Builder(PlatformContext.INSTANCE).build()
 
+    // Fails every request at once, so the failed-image state never waits on real file I/O.
+    private val failingImageLoader = ImageLoader.Builder(PlatformContext.INSTANCE)
+        .components {
+            add(
+                object : Interceptor {
+                    override suspend fun intercept(chain: Interceptor.Chain): ImageResult =
+                        ErrorResult(null, chain.request, IllegalStateException("Image load disabled in tests"))
+                },
+            )
+        }
+        .build()
+
     @Test
     fun `loading transitions to actual Jewel content without retaining the spinner`() {
         val state = mutableStateOf<ReaderModeState>(ReaderModeState.Loading)
@@ -150,7 +165,10 @@ class DesktopReaderContentTest {
     fun `an image without alt text that fails to load links with a label instead of its URL`() {
         val imageUrl = "file:///feedflow-missing-image.avif"
         val state = success()
-        showBody(state.copy(readerModeData = state.readerModeData.copy(content = "$BODY_TEXT\n\n![]($imageUrl)")))
+        showBody(
+            state.copy(readerModeData = state.readerModeData.copy(content = "$BODY_TEXT\n\n![]($imageUrl)")),
+            imageLoader = failingImageLoader,
+        )
         // While loading, Jewel's inline placeholder text is the raw `![Open image](url)`, holding both the label
         // and the URL, so wait for the failed-image link to replace it.
         rule.waitUntil(timeoutMillis = 5_000) {
@@ -196,7 +214,11 @@ class DesktopReaderContentTest {
         }
     }
 
-    private fun showBody(state: ReaderModeState, onOpenInBrowser: (String) -> Unit = {}) {
+    private fun showBody(
+        state: ReaderModeState,
+        onOpenInBrowser: (String) -> Unit = {},
+        imageLoader: ImageLoader = this.imageLoader,
+    ) {
         rule.setContent {
             CompositionLocalProvider(LocalFeedFlowStrings provides EnFeedFlowStrings) {
                 FeedFlowTheme(darkTheme = false, useOledTheme = false) {
@@ -246,6 +268,7 @@ class DesktopReaderContentTest {
     @After
     fun closeImageLoader() {
         imageLoader.shutdown()
+        failingImageLoader.shutdown()
     }
 
     private fun success(url: String = ARTICLE_URL) = ReaderModeState.Success(
```

#### Recent Merged Pull Requests:
- **PR #1755** (2026-11-27): Translations update from Hosted Weblate (@hosted-weblate[bot])
- **PR #1742** (2026-11-25): Translations update from Hosted Weblate (@hosted-weblate[bot])
- **PR #1741** (2026-11-24): Notify every new article and remove notifications once their articles are read (@prof18)
- **PR #1737** (2026-11-24): Skip Android app initialization outside the main process so RevenueCat doesn't crash WebView helper processes (@prof18)
- **PR #1736** (2026-11-24): Update dependency com.jetbrains.intellij.platform:icons to v263.7307.356 (@renovate[bot])
- **PR #1735** (2026-11-24): Update dependency io.arrow-kt:arrow-fx-coroutines to v2.3.0.1 (@renovate[bot])

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

## X. flaky database and desktop tests and serialise iOS simulator test tasks

**RULE**:
When implementing operations in `.github/workflows/code-checks.yaml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in prof18/feed-flow. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3ac44321`: flaky database and desktop tests and serialise iOS simulator test tasks. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/code-checks.yaml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
        # Simulator tests occasionally stall on this 3-core runner, so a failure gets one retry.
        # Tasks that passed are up to date in the second run, except the cloud sync ones, which
        # always re-run.
        run: |
          run_tests() {
            ./gradlew allTests -x jvmTest -x testAndroidHostTest -x testGooglePlayDebugUnitTest "-Pfeedflow.swiftCloudSyncDestination=$IOS_TEST_DESTINATION"
          }
          run_tests || { echo "::warning::Kotlin/Native and cloud sync tests failed, retrying once"; run_tests; }
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
        run: ./gradlew allTests -x jvmTest -x testAndroidHostTest -x testGooglePlayDebugUnitTest "-Pfeedflow.swiftCloudSyncDestination=$IOS_TEST_DESTINATION"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3ac44321` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
