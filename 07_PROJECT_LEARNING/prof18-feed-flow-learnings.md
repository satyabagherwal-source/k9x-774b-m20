> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/prof18-feed-flow-learnings.md`  
> **Source**: github ([https://github.com/prof18/feed-flow](https://github.com/prof18/feed-flow))  
> **Source Version**: `27e55ef0`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-21T15:22:37.198Z  
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
> **Harvest Timestamp**: 2026-10-21T15:22:37.195Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `prof18/feed-flow`
- **Description**: FeedFlow is a minimalistic RSS Reader available on Android, iOS, macOS, Windows and Linux. Built with Kotlin Multiplatform, Jetpack Compose and SwiftUI.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1273 stars

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

### Incident Patch 1: `11ddbed9` (2026-10-20)
**Commit Message**: Replace Compose Unstyled scrollbars with Jewel scrollbars, Fixes JAVA-J6

**File**: `desktopApp/build.gradle.kts` (modified, +0/-1)
```diff
@@ -130,7 +130,6 @@ kotlin {
                 implementation(libs.kotlinx.serialization.json)
                 implementation(libs.kotlinx.date.time)
                 implementation(libs.flatlaf)
-                implementation(libs.compose.unstyled.scrollbars)
             }
         }
 
```

**File**: `desktopApp/src/jvmMain/kotlin/com/prof18/feedflow/desktop/about/LicensesScreen.desktop.kt` (modified, +2/-3)
```diff
@@ -35,7 +35,6 @@ import androidx.compose.ui.semantics.semantics
 import androidx.compose.ui.text.font.FontWeight
 import androidx.compose.ui.unit.dp
 import androidx.compose.ui.unit.sp
-import com.composeunstyled.rememberScrollbarState
 import com.mikepenz.aboutlibraries.Libs
 import com.mikepenz.aboutlibraries.entity.Library
 import com.prof18.feedflow.core.utils.DispatcherProvider
@@ -142,7 +141,7 @@ internal fun LicensesContent(
                         }
                     }
                     if (listState.canScrollForward || listState.canScrollBackward) {
-                        FeedFlowVerticalScrollbar(rememberScrollbarState(listState))
+                        FeedFlowVerticalScrollbar(listState)
                     }
                 }
             }
@@ -197,7 +196,7 @@ internal fun LicenseDetails(library: Library, onClose: () -> Unit, modifier: Mod
                     }
                 }
             }
-            FeedFlowVerticalScrollbar(rememberScrollbarState(scrollState))
+            FeedFlowVerticalScrollbar(scrollState)
         }
         Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
             DefaultButton(
```

**File**: `desktopApp/src/jvmMain/kotlin/com/prof18/feedflow/desktop/feedsuggestions/FeedSuggestionsContent.kt` (modified, +1/-2)
```diff
@@ -56,7 +56,6 @@ import androidx.compose.ui.unit.sp
 import coil3.compose.AsyncImage
 import coil3.compose.LocalPlatformContext
 import coil3.request.ImageRequest
-import com.composeunstyled.rememberScrollbarState
 import com.prof18.feedflow.core.model.FeedAddState
 import com.prof18.feedflow.core.model.SuggestedFeed
 import com.prof18.feedflow.core.model.SuggestedFeedCategory
@@ -225,7 +224,7 @@ private fun SuggestionFeedArea(
                 }
             }
             if (feedState.canScrollForward || feedState.canScrollBackward) {
-                FeedFlowVerticalScrollbar(rememberScrollbarState(feedState))
+                FeedFlowVerticalScrollbar(feedState)
             }
         }
     }
```

**File**: `desktopApp/src/jvmMain/kotlin/com/prof18/feedflow/desktop/home/DesktopHomeScreenContent.kt` (modified, +1/-2)
```diff
@@ -34,7 +34,6 @@ import androidx.compose.ui.semantics.heading
 import androidx.compose.ui.semantics.progressBarRangeInfo
 import androidx.compose.ui.semantics.semantics
 import androidx.compose.ui.unit.dp
-import com.composeunstyled.rememberScrollbarState
 import com.prof18.feedflow.core.model.FeedFilter
 import com.prof18.feedflow.core.model.FeedItemId
 import com.prof18.feedflow.core.model.FeedItemUrlInfo
@@ -330,7 +329,7 @@ private fun HomeArticleList(
             )
         }
         if (!isGrid) {
-            FeedFlowVerticalScrollbar(rememberScrollbarState(listState))
+            FeedFlowVerticalScrollbar(listState)
         }
     }
 }
```

**File**: `desktopApp/src/jvmMain/kotlin/com/prof18/feedflow/desktop/home/NoFeedsDialog.kt` (modified, +1/-3)
```diff
@@ -18,7 +18,6 @@ import androidx.compose.ui.focus.focusRequester
 import androidx.compose.ui.platform.LocalDensity
 import androidx.compose.ui.unit.DpSize
 import androidx.compose.ui.unit.dp
-import com.composeunstyled.rememberScrollbarState
 import com.prof18.feedflow.desktop.ui.LocalFeedFlowStrings
 import com.prof18.feedflow.desktop.ui.components.DesktopDesignTokens
 import com.prof18.feedflow.desktop.ui.components.DesktopDialogWindow
@@ -69,7 +68,6 @@ internal fun NoFeedsContent(
     val addFocus = remember { FocusRequester() }
     LaunchedEffect(Unit) { addFocus.requestFocus() }
     val scrollState = rememberScrollState()
-    val scrollbarState = rememberScrollbarState(scrollState)
     val actionHeight = with(LocalDensity.current) { JewelTheme.defaultTextStyle.lineHeight.toDp() } + 16.dp
     Box(modifier.fillMaxSize()) {
         Column(
@@ -106,6 +104,6 @@ internal fun NoFeedsContent(
                 },
             ) { Text(strings.feedSuggestionsTitle) }
         }
-        FeedFlowVerticalScrollbar(scrollbarState)
+        FeedFlowVerticalScrollbar(scrollState)
     }
 }
```

**File**: `desktopApp/src/jvmMain/kotlin/com/prof18/feedflow/desktop/importexport/ImportExportContent.kt` (modified, +4/-5)
```diff
@@ -38,7 +38,6 @@ import androidx.compose.ui.unit.Dp
 import androidx.compose.ui.unit.DpSize
 import androidx.compose.ui.unit.dp
 import androidx.compose.ui.unit.sp
-import com.composeunstyled.rememberScrollbarState
 import com.prof18.feedflow.core.model.ArticleExportFilter
 import com.prof18.feedflow.core.model.FeedImportExportState
 import com.prof18.feedflow.core.model.ImportExportContentType
@@ -303,7 +302,7 @@ private fun ImportExportIdleContent(
             }
         }
         if (listState.canScrollForward || listState.canScrollBackward) {
-            FeedFlowVerticalScrollbar(rememberScrollbarState(listState))
+            FeedFlowVerticalScrollbar(listState)
         }
     }
 }
@@ -426,7 +425,7 @@ internal fun ArticleExportFilterContent(
                 }
             }
         }
-        FeedFlowVerticalScrollbar(rememberScrollbarState(scrollState))
+        FeedFlowVerticalScrollbar(scrollState)
     }
 }
 
@@ -484,7 +483,7 @@ private fun ImportReport(
                 }
             }
         }
-        FeedFlowVerticalScrollbar(rememberScrollbarState(listState))
+        FeedFlowVerticalScrollbar(listState)
     }
 }
 
@@ -543,7 +542,7 @@ private fun ResultView(
                 textAlign = TextAlign.Center,
             )
         }
-        FeedFlowVerticalScrollbar(rememberScrollbarState(scrollState))
+        FeedFlowVerticalScrollbar(scrollState)
     }
 }
 
```

**File**: `desktopApp/src/jvmMain/kotlin/com/prof18/feedflow/desktop/main/MainWindow.kt` (modified, +0/-4)
```diff
@@ -6,7 +6,6 @@ import androidx.compose.animation.core.tween
 import androidx.compose.animation.fadeIn
 import androidx.compose.animation.fadeOut
 import androidx.compose.animation.togetherWith
-import androidx.compose.foundation.LocalScrollbarStyle
 import androidx.compose.foundation.background
 import androidx.compose.foundation.layout.Arrangement
 import androidx.compose.foundation.layout.Box
@@ -74,7 +73,6 @@ import com.prof18.feedflow.desktop.ui.components.ConfirmationDialog
 import com.prof18.feedflow.desktop.ui.components.DesktopDesignTokens
 import com.prof18.feedflow.desktop.ui.components.FeedFlowTheme
 import com.prof18.feedflow.desktop.ui.components.SnackbarHost
-import com.prof18.feedflow.desktop.ui.components.scrollbarStyle
 import com.prof18.feedflow.shared.data.DesktopWindowSettingsRepository
 import com.prof18.feedflow.shared.domain.feedsync.FeedSyncRepository
 import com.prof18.feedflow.shared.presentation.HomeViewModel
@@ -261,7 +259,6 @@ private fun FrameWindowScope.MainWindowContent(
 
     val menuCommands = remember { DesktopMenuCommands() }
     CompositionLocalProvider(
-        LocalScrollbarStyle provides scrollbarStyle(),
         LocalDesktopMenuCommands provides menuCommands,
     ) {
         val reduceMotionEnabled = LocalReduceMotion.current
@@ -336,7 +333,6 @@ private fun FrameWindowScope.MainWindowContent(
 
         CompositionLocalProvider(
             LocalDesktopDialogWindowNavigator provides dialogWindowNavigator,
-            LocalScrollbarStyle provides scrollbarStyle(),
         ) {
             val onSearch: (() -> Unit)? = if (backStack.lastOrNull() == Home) {
                 { backStack.add(Search) }
```

**File**: `desktopApp/src/jvmMain/kotlin/com/prof18/feedflow/desktop/reaadermode/DesktopReaderContent.kt` (modified, +1/-2)
```diff
@@ -33,7 +33,6 @@ import androidx.compose.ui.unit.sp
 import coil3.ImageLoader
 import coil3.compose.LocalPlatformContext
 import coil3.request.ImageRequest
-import com.composeunstyled.rememberScrollbarState
 import com.prof18.feedflow.core.model.AudioEnclosure
 import com.prof18.feedflow.core.model.FeedItemUrlInfo
 import com.prof18.feedflow.core.model.ReaderModeData
@@ -163,7 +162,7 @@ private fun ReaderArticle(
                 if (body != null) body() else DelayedReaderSpinner(articleKey)
             }
         }
-        FeedFlowVerticalScrollbar(rememberScrollbarState(scrollState))
+        FeedFlowVerticalScrollbar(scrollState)
     }
 }
 
```

---

### Incident Patch 2: `15394de6` (2026-10-19)
**Commit Message**: Fix Detekt 2 findings in the Jewel desktop code after rebase

**File**: `androidApp/src/main/kotlin/com/prof18/feedflow/android/ui/theme/Theme.kt` (modified, +2/-0)
```diff
@@ -6,6 +6,7 @@ import androidx.compose.material3.MaterialExpressiveTheme
 import androidx.compose.material3.dynamicDarkColorScheme
 import androidx.compose.material3.dynamicLightColorScheme
 import androidx.compose.runtime.Composable
+import androidx.compose.runtime.NonRestartableComposable
 import androidx.compose.ui.platform.LocalContext
 import com.prof18.feedflow.android.ui.style.DarkColorScheme
 import com.prof18.feedflow.android.ui.style.FeedFlowShapes
@@ -36,6 +37,7 @@ fun FeedFlowTheme(
     )
 }
 
+@NonRestartableComposable
 @Composable
 fun FeedFlowThemePreview(
     content: @Composable () -> Unit,
```

**File**: `config/detekt/detekt.yml` (modified, +1/-0)
```diff
@@ -106,6 +106,7 @@ Compose:
     # Focus must be requested after the node is attached, which a frame-deferred LaunchedEffect guarantees.
     allowedCallNames:
       - androidx.compose.ui.focus.FocusRequester.requestFocus
+      - androidx.compose.ui.focus.FocusRequester.restoreFocusedChild
   # Renaming ~130 past-tense event lambdas (onXxxChanged -> onXxxChange) is pure churn for now.
   ParameterNaming:
     active: false
```

**File**: `desktopApp/build.gradle.kts` (modified, +0/-5)
```diff
@@ -170,11 +170,6 @@ tasks.withType<Test>().configureEach {
     }
 }
 
-// Detekt 1.23's compiler cannot accept Java 25 as its analysis target.
-tasks.withType<io.gitlab.arturbosch.detekt.Detekt>().configureEach {
-    jvmTarget = "21"
-}
-
 val isAppStoreRelease = project.property("macOsAppStoreRelease").toString().toBoolean()
 val macSigningIdentity = "Marco Gomiero"
 // Full identity name for codesign. Compose's MacSigner derives this same form
```

**File**: `desktopApp/src/jvmMain/kotlin/com/prof18/feedflow/desktop/AppContent.kt` (modified, +3/-3)
```diff
@@ -2,7 +2,7 @@ package com.prof18.feedflow.desktop
 
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.CompositionLocalProvider
-import androidx.compose.runtime.LaunchedEffect
+import androidx.compose.runtime.SideEffect
 import androidx.compose.runtime.collectAsState
 import androidx.compose.runtime.getValue
 import androidx.compose.runtime.remember
@@ -41,7 +41,7 @@ internal fun FrameWindowScope.AppContent(
     val koin = DI.koin
     setSingletonImageLoaderFactory { koin.get<ImageLoader>() }
 
-    LaunchedEffect(Unit) {
+    SideEffect(Unit) {
         val contentPrefetchRepository: ContentPrefetchRepository = koin.get()
         contentPrefetchRepository.startBackgroundFetching()
     }
@@ -63,7 +63,7 @@ internal fun FrameWindowScope.AppContent(
     }
 
     if (getDesktopOS().isNotMacOs()) {
-        LaunchedEffect(isDarkTheme, useOledTheme) {
+        SideEffect(isDarkTheme, useOledTheme) {
             SwingUtilities.invokeLater {
                 setupLookAndFeel(isDarkTheme, useOledTheme)
             }
```

**File**: `desktopApp/src/jvmMain/kotlin/com/prof18/feedflow/desktop/Main.kt` (modified, +2/-1)
```diff
@@ -4,6 +4,7 @@ import androidx.compose.runtime.Composable
 import androidx.compose.runtime.LaunchedEffect
 import androidx.compose.runtime.collectAsState
 import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableFloatStateOf
 import androidx.compose.runtime.mutableStateOf
 import androidx.compose.runtime.remember
 import androidx.compose.runtime.rememberCoroutineScope
@@ -65,7 +66,7 @@ fun main() {
 
         var isInitialized by remember { mutableStateOf(false) }
         var showMainWindow by remember { mutableStateOf(false) }
-        var initProgress by remember { mutableStateOf(value = 0.1f) }
+        var initProgress by remember { mutableFloatStateOf(0.1f) }
         var startupThemeMode by remember { mutableStateOf<ThemeMode?>(null) }
 
         @Suppress("MagicNumber")
```

**File**: `desktopApp/src/jvmMain/kotlin/com/prof18/feedflow/desktop/accounts/AccountComponents.kt` (modified, +3/-4)
```diff
@@ -12,7 +12,7 @@ import androidx.compose.foundation.verticalScroll
 import androidx.compose.material.icons.Icons
 import androidx.compose.material.icons.filled.CheckCircle
 import androidx.compose.runtime.Composable
-import androidx.compose.runtime.LaunchedEffect
+import androidx.compose.runtime.SideEffect
 import androidx.compose.runtime.getValue
 import androidx.compose.runtime.mutableStateOf
 import androidx.compose.runtime.remember
@@ -71,13 +71,12 @@ internal fun CloudAccountContent(
     val latestUiState by rememberUpdatedState(uiState)
     val latestOnDisconnectClick by rememberUpdatedState(onDisconnectClick)
     val latestOnBackupClick by rememberUpdatedState(onBackupClick)
-    val strings = LocalFeedFlowStrings.current
 
-    LaunchedEffect(uiState is AccountConnectionUiState.Linked, credentialsState) {
+    SideEffect(uiState is AccountConnectionUiState.Linked, credentialsState) {
         if (uiState is AccountConnectionUiState.Linked) credentialsState?.clear()
     }
 
-    LaunchedEffect(uiState) {
+    SideEffect(uiState) {
         if (!uiState.canDisconnect()) {
             isDisconnectConfirmationVisible = false
         }
```

**File**: `desktopApp/src/jvmMain/kotlin/com/prof18/feedflow/desktop/accounts/AccountConnectButton.kt` (modified, +4/-3)
```diff
@@ -3,8 +3,9 @@ package com.prof18.feedflow.desktop.accounts
 import androidx.compose.foundation.layout.Arrangement
 import androidx.compose.foundation.layout.Column
 import androidx.compose.runtime.Composable
-import androidx.compose.runtime.LaunchedEffect
+import androidx.compose.runtime.SideEffect
 import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableIntStateOf
 import androidx.compose.runtime.mutableStateOf
 import androidx.compose.runtime.remember
 import androidx.compose.runtime.rememberUpdatedState
@@ -34,13 +35,13 @@ internal fun AccountConnectButton(
 ) {
     var localSubmissionPending by remember { mutableStateOf(false) }
     val previousLoading = remember { mutableStateOf(isLoading) }
-    val previousErrorRevision = remember { mutableStateOf(errorRevision) }
+    val previousErrorRevision = remember { mutableIntStateOf(errorRevision) }
     val latestIsLoading by rememberUpdatedState(isLoading)
     val latestOnConnect by rememberUpdatedState(onConnect)
     val latestState by rememberUpdatedState(state)
     val strings = LocalFeedFlowStrings.current
 
-    LaunchedEffect(isLoading, errorRevision, state) {
+    SideEffect(isLoading, errorRevision, state) {
         val loadingCompleted = previousLoading.value && !isLoading
         val receivedNewError = previousErrorRevision.value != errorRevision
         if (loadingCompleted || receivedNewError) {
```

**File**: `desktopApp/src/jvmMain/kotlin/com/prof18/feedflow/desktop/accounts/AccountConnectionObserver.kt` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 package com.prof18.feedflow.desktop.accounts
 
 import androidx.compose.runtime.Composable
-import androidx.compose.runtime.LaunchedEffect
+import androidx.compose.runtime.SideEffect
 import androidx.compose.runtime.rememberCoroutineScope
 import androidx.compose.runtime.rememberUpdatedState
 import com.prof18.feedflow.core.model.AccountConnectionUiState
@@ -21,7 +21,7 @@ internal fun <T> ObserveAccountConnection(
     val detailScope = rememberCoroutineScope()
     val ownerScope = draft.ownerScope ?: detailScope
     val latestOnMessage = rememberUpdatedState(onMessage)
-    LaunchedEffect(draft, ownerScope, uiState, messages, loginLoading) {
+    SideEffect(draft, ownerScope, uiState, messages, loginLoading) {
         draft.connectionObservationJob?.cancel()
         // Provider/page navigation removes the detail; requests remain owned by the Settings session.
         draft.connectionObservationJob = ownerScope.launch(start = CoroutineStart.UNDISPATCHED) {
```

#### Recent Merged Pull Requests:
- **PR #1552** (2026-10-20): Replace Compose Unstyled scrollbars with Jewel scrollbars (@prof18)
- **PR #1550** (2026-10-20): Merge localization into main (@github-actions[bot])
- **PR #1547** (2026-10-20): Update dependency com.google.firebase:firebase-bom to v35 (@renovate[bot])
- **PR #1546** (2026-10-20): Update apple-actions/download-provisioning-profiles action to v7 (@renovate[bot])
- **PR #1545** (2026-10-20): Update dependency RevenueCat to v5.96.0 (@renovate[bot])
- **PR #1542** (2026-10-20): Update dependency GoogleAPIClientForREST to v5.5.0 (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
