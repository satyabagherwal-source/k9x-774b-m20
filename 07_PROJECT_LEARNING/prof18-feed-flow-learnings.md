# Forensic Learning Record (Deep Inspection): prof18/feed-flow

> **Canonical Artifact**: `07_PROJECT_LEARNING/prof18-feed-flow-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/prof18/feed-flow](https://github.com/prof18/feed-flow))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:05:23.407Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `prof18/feed-flow`
- **Description**: FeedFlow is a minimalistic RSS Reader available on Android, iOS, macOS, Windows and Linux. Built with Kotlin Multiplatform, Jetpack Compose and SwiftUI.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1248 stars

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

### Core Architecture Module: `androidApp/src/main/kotlin/com/prof18/feedflow/android/util/Localization.kt`
```
package com.prof18.feedflow.android.util

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.ui.text.intl.Locale
import cafe.adriel.lyricist.Lyricist
import com.prof18.feedflow.i18n.FeedFlowStrings
import com.prof18.feedflow.shared.data.SettingsRepository
import com.prof18.feedflow.shared.ui.utils.rememberFeedFlowStrings

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

### Core Architecture Module: `androidApp/src/main/kotlin/com/prof18/feedflow/android/widget/WidgetSettingsState.kt`
```
package com.prof18.feedflow.android.widget

import com.prof18.feedflow.core.model.WidgetFeedLayout
import com.prof18.feedflow.shared.domain.model.SyncPeriod
import com.prof18.feedflow.shared.domain.model.WidgetTextColorMode

data class WidgetSettingsState(
    val syncPeriod: SyncPeriod = SyncPeriod.ONE_HOUR,
    val feedLayout: WidgetFeedLayout = WidgetFeedLayout.LIST,
    val showHeader: Boolean = true,
    val fontScale: Int = 0,
    val backgroundColor: Int? = null,
    val backgroundOpacityPercent: Int = 100,
    val textColorMode: WidgetTextColorMode = WidgetTextColorMode.AUTOMATIC,
    val hideImages: Boolean = false,
)

```

### Core Architecture Module: `core/src/androidMain/kotlin/com/prof18/feedflow/core/utils/SuspensionGuard.kt`
```
package com.prof18.feedflow.core.utils

actual suspend fun <T> withSuspensionGuard(reason: String, block: suspend () -> T): T = block()

```

### Core Architecture Module: `core/src/commonMain/kotlin/com/prof18/feedflow/core/domain/DateFormatter.kt`
```
package com.prof18.feedflow.core.domain

import com.prof18.feedflow.core.model.DateFormat
import com.prof18.feedflow.core.model.TimeFormat

interface DateFormatter {
    fun getDateMillisFromString(dateString: String): Long?
    fun formatDateForFeed(millis: Long, dateFormat: DateFormat, timeFormat: TimeFormat): String
    fun formatDateForLastRefresh(millis: Long): String
    fun currentTimeMillis(): Long
    fun getCurrentDateForExport(): String
}

```

### Core Architecture Module: `core/src/commonMain/kotlin/com/prof18/feedflow/core/domain/FeedSourceLogoRetriever.kt`
```
package com.prof18.feedflow.core.domain

import com.prof18.rssparser.model.RssChannel

interface FeedSourceLogoRetriever {
    suspend fun getFeedSourceLogoUrl(rssChannel: RssChannel): String?
    suspend fun getFeedSourceLogoUrl(websiteLink: String?): String?
}

```

### Core Architecture Module: `core/src/commonMain/kotlin/com/prof18/feedflow/core/domain/HtmlParser.kt`
```
package com.prof18.feedflow.core.domain

interface HtmlParser {
    fun getTextFromHTML(html: String): String?
    fun getFaviconUrl(html: String): String?
    fun getRssUrl(html: String): String?
    fun getCanonicalUrl(html: String): String? = null
    fun parseFeedContent(html: String, baseUrl: String?): ParsedFeedContent
}

data class ParsedFeedContent(
    val text: String?,
    val commentsUrl: String?,
)

```

### Core Architecture Module: `core/src/commonMain/kotlin/com/prof18/feedflow/core/model/AccountConnectionUiState.kt`
```
package com.prof18.feedflow.core.model

sealed class AccountConnectionUiState {
    data object Unlinked : AccountConnectionUiState()
    data class Linked(
        val syncState: AccountSyncUIState,
    ) : AccountConnectionUiState()
    data object Loading : AccountConnectionUiState()
}

```

### Core Architecture Module: `core/src/commonMain/kotlin/com/prof18/feedflow/core/model/AccountSyncUIState.kt`
```
package com.prof18.feedflow.core.model

sealed class AccountSyncUIState {
    data object Loading : AccountSyncUIState()
    data object None : AccountSyncUIState()
    data class Synced(
        val lastDownloadDate: String?,
        val lastUploadDate: String?,
    ) : AccountSyncUIState()
}

```

### Core Architecture Module: `core/src/commonMain/kotlin/com/prof18/feedflow/core/model/ArticleExportFilter.kt`
```
package com.prof18.feedflow.core.model

enum class ArticleExportFilter {
    All,
    Read,
    Unread,
    Bookmarked,
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

- **Issue #657** (2025-08-08): **[Windows, macOS] FreshRSS Server can't be added in Desktop**
  *Symptoms*: Getting `Sorry, something went wrong :(` error when trying to add FreshRSS server on desktop.  - Same server works on fine on iOS and Android (even through WSL in same machine where desktop build doesn't) - Server has .com domain with valid certificates, but DNS points to local `(192...)` address.
  **Post-Mortem & Fix Analysis**:
  > Using gradle run desktopApp works OK, but after building it, it doesn't work.   Also, new build gives address error when builded.  However, can that gradle run desktopApp needs administrator privileges (sqlite) to work have something to do with it?
  > Code shrinking was too aggressive, that’s why was working on the debug mode and not on the builder binary. It will be fixed in the next update!

- **Issue #341** (2025-04-21): **Images are not loaded in reader mode**
  *Symptoms*: Hi, Tried FeedFlow with https://www.hs.fi/rss/tuoreimmat.xml feed and Reader mode enabled.  It doesn't show any image in reader mode, only text displayed  
  **Post-Mortem & Fix Analysis**:
  > Similarly issue for a base64 image at https://www.stimson.org/feed/
  > It should be fixed with #540 and #537
  > Hi, I'm having this issue with FeedFlow for Windows with https://www.statista.com/rss/  Thanks in advance.

- **Issue #312** (2024-10-22): **Link Invalid For Local RSS Feed**
  *Symptoms*: Hello.  Using FeedFlow, I attempted to add an RSS feed which is published on my local network at the URL 'http://192.168.0.123:12345/ludum-dare.rss' while connected to my local network. However, this is not recognized as a valid feed using FeedFlow, showing the error "The link you provided is not a valid RSS feed". Using RSS Parser and a test Android app, I was able to get the RSS channel from this URL without issue (after having to add the android:usesCleartextTraffic attribute, but it seems like FeedFlow already has that added).  I have attached the one of the RSS feeds below, although it happened to all three of my local RSS feeds. Running the RSS feed through W3C's feed validator, it shows having issues with the GUID having an em-dash (removing these didn't seem to fix this) and the feed missing a atom:link element (adding this did not seem to fix this), but this RSS feed parses fine both using RSS Parser and Feeder, so I'm not sure what the problem is.  [ludum-dare.zip](https://github.com/user-attachments/files/17138256/ludum-dare.zip)  It seems like FeedFlow is making a bunch of invalid HTTP requests judging from the log when hosting the file through Python's http.server. I have attached a log from that as well.  [http-server-log.txt](https://github.com/user-attachments/files/17138304/http-server-log.txt)
  **Post-Mortem & Fix Analysis**:
  > Interesting! On paper, it should work with local feeds. I'll try to host your feed and see if I can debug the issue!
  > Alright, I found the issue. When adding the feed, the call to 'sanitizeUrl(feedUrl)' in 'AddFeedViewModel' replaces 'http' with 'https', which isn't valid if the server only supports 'http'. Removing 'sanitizeUrl' allows the feed to be added once the URL is prefixed with 'http' (just '192.168.0.123...' won't work). Since 'http' is always replaced with 'https', there is no way to add the URL currently even if the URL has 'http' at the beginning.
  > ah right! I'll fix it soon then

- **Issue #93** (2023-12-26): **No way to refresh the feed after adding the first RSS feed**
  *Symptoms*: Open the app after clean install, add a new feed. Go back to the home screen. The app correctly shows the count of posts but is empty, and pull to refresh doesn't work. The only way to refresh, seems to close and reopen the app.  ![Screenshot_20231226-152832](https://github.com/prof18/feed-flow/assets/4348197/0738d134-b9b1-40a7-af30-56cf0db7d228) 
  **Post-Mortem & Fix Analysis**:
  > Ups, that was a 🐛   Thanks, for reporting! 🙏 

- **Issue #27** (2024-12-19): **[Timing of feeds is incorrect. How to manage it?**
  *Symptoms*:  [Timing of feeds is incorrect. How to manage it?
  **Post-Mortem & Fix Analysis**:
  > Can you provide an example of that? And maybe the link of the feed? 🙏 
  > The real timing of feed is 6:30 pm of Nepal but in feed it is showing 12:33.(screenshot) . Other is my opml feed  On Wed, 20 Sept 2023, 6:13 pm Marco Gomiero, ***@***.***> wrote:  > Can you provide an example of that? And maybe the link of the feed? 🙏 > > — > Reply to this email directly, view it on GitHub > <https://github.com/prof18/feed-flow/issues/27#issuecomment-1727625332>, > or unsubscribe > <https://github.com/notifications/unsubscribe-auth/AWGG5HWYKHVOXUGE7HXPWHLX3LOPLANCNFSM6AAAAAA46SSVFM> > . > You are receiving this because you authored the thread.Message ID: > ***@***.***> > 
  > Probably the screenshot and the OPML didn't get added in the attachments 😅 Could you share that, please? 🙏 

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

### Incident Patch 1: `e99352b3` (2026-10-01)
**Commit Message**: Fix desktop report issue when mail is unavailable

**File**: `desktopApp/src/jvmMain/kotlin/com/prof18/feedflow/desktop/home/menubar/MenuBar.kt` (modified, +2/-3)
```diff
@@ -9,6 +9,7 @@ import com.prof18.feedflow.core.model.FeedFilter
 import com.prof18.feedflow.core.utils.getDesktopOS
 import com.prof18.feedflow.core.utils.isMacOs
 import com.prof18.feedflow.desktop.di.DI
+import com.prof18.feedflow.desktop.utils.openDesktopMailSafely
 import com.prof18.feedflow.shared.presentation.MenuBarViewModel
 import com.prof18.feedflow.shared.ui.utils.LocalFeedFlowStrings
 import com.prof18.feedflow.shared.utils.UserFeedbackReporter
@@ -39,14 +40,12 @@ fun FrameWindowScope.FeedFlowMenuBar(
     )
     val helpMenuCallbacks = HelpMenuCallbacks(
         onBugReportClick = {
-            val desktop = java.awt.Desktop.getDesktop()
-            val uri = java.net.URI.create(
+            openDesktopMailSafely(
                 userFeedbackReporter.getEmailUrl(
                     subject = emailSubject,
                     content = emailContent,
                 ),
             )
-            desktop.mail(uri)
         },
     )
 
```

**File**: `desktopApp/src/jvmMain/kotlin/com/prof18/feedflow/desktop/settings/AboutPane.kt` (modified, +10/-11)
```diff
@@ -32,6 +32,7 @@ import com.prof18.feedflow.desktop.about.LicensesScreen
 import com.prof18.feedflow.desktop.di.DI
 import com.prof18.feedflow.desktop.utils.disableSentry
 import com.prof18.feedflow.desktop.utils.initSentry
+import com.prof18.feedflow.desktop.utils.openDesktopMailSafely
 import com.prof18.feedflow.desktop.utils.openUriSafely
 import com.prof18.feedflow.shared.ui.about.AboutButtonItem
 import com.prof18.feedflow.shared.ui.about.AboutTextItem
@@ -43,8 +44,6 @@ import com.prof18.feedflow.shared.ui.theme.FeedFlowTheme
 import com.prof18.feedflow.shared.ui.utils.LocalFeedFlowStrings
 import com.prof18.feedflow.shared.utils.UserFeedbackReporter
 import kotlinx.coroutines.launch
-import java.awt.Desktop
-import java.net.URI
 
 @Composable
 internal fun AboutPane(
@@ -97,15 +96,15 @@ internal fun AboutPane(
             SettingItem(
                 title = strings.reportIssueButton,
                 onClick = {
-                    runCatching {
-                        val uri = URI.create(
-                            userFeedbackReporter.getEmailUrl(
-                                subject = strings.issueContentTitle,
-                                content = strings.issueContentTemplate,
-                            ),
-                        )
-                        Desktop.getDesktop().mail(uri)
-                    }.onFailure { showExternalOpenError() }
+                    val opened = openDesktopMailSafely(
+                        userFeedbackReporter.getEmailUrl(
+                            subject = strings.issueContentTitle,
+                            content = strings.issueContentTemplate,
+                        ),
+                    )
+                    if (!opened) {
+                        showExternalOpenError()
+                    }
                 },
             )
 
```

**File**: `desktopApp/src/jvmMain/kotlin/com/prof18/feedflow/desktop/utils/DesktopMailHandler.kt` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+package com.prof18.feedflow.desktop.utils
+
+import java.awt.Desktop
+import java.net.URI
+
+internal fun openDesktopMailSafely(
+    url: String,
+    sendMail: (URI) -> Unit = { uri ->
+        val desktop = Desktop.getDesktop()
+        check(desktop.isSupported(Desktop.Action.MAIL))
+        desktop.mail(uri)
+    },
+    openFallback: () -> Boolean = {
+        openDesktopUriSafely("https://github.com/prof18/feed-flow/issues/new/choose")
+    },
+): Boolean = runCatching { sendMail(URI.create(url)) }
+    .fold(
+        onSuccess = { true },
+        onFailure = { runCatching { openFallback() }.getOrDefault(false) },
+    )
```

**File**: `desktopApp/src/jvmTest/kotlin/com/prof18/feedflow/desktop/utils/DesktopMailHandlerTest.kt` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+package com.prof18.feedflow.desktop.utils
+
+import java.io.IOException
+import java.net.URI
+import kotlin.test.Test
+import kotlin.test.assertFalse
+import kotlin.test.assertTrue
+
+class DesktopMailHandlerTest {
+
+    @Test
+    fun `successful mail send does not use fallback`() {
+        var fallbackCalled = false
+
+        val result = openDesktopMailSafely(
+            url = "mailto:hello@example.com",
+            sendMail = { uri -> assertTrue(uri.scheme == "mailto") },
+            openFallback = {
+                fallbackCalled = true
+                true
+            },
+        )
+
+        assertTrue(result)
+        assertFalse(fallbackCalled)
+    }
+
+    @Test
+    fun `unsupported mail handler uses successful fallback`() {
+        var fallbackCalled = false
+
+        val result = openDesktopMailSafely(
+            url = "mailto:hello@example.com",
+            sendMail = { throw UnsupportedOperationException("Mail is not supported") },
+            openFallback = {
+                fallbackCalled = true
+                true
+            },
+        )
+
+        assertTrue(result)
+        assertTrue(fallbackCalled)
+    }
+
+    @Test
+    fun `io exception uses fallback`() {
+        var fallbackCalled = false
+
+        val result = openDesktopMailSafely(
+            url = "mailto:hello@example.com",
+            sendMail = { throw IOException("Could not open mail client") },
+            openFallback = {
+                fallbackCalled = true
+                true
+            },
+        )
+
+        assertTrue(result)
+        assertTrue(fallbackCalled)
+    }
+
+    @Test
+    fun `returns false when fallback returns false`() {
+        val result = openDesktopMailSafely(
+            url = "mailto:hello@example.com",
+            sendMail = { throw UnsupportedOperationException() },
+            openFallback = { false },
+        )
+
+        assertFalse(result)
+    }
+
+    @Test
+    fun `returns false when fallback throws`() {
+        val result = openDesktopMailSafely(
+            url = "mailto:hello@example.com",
+            sendMail = { throw UnsupportedOperationException() },
+            openFallback = { throw IOException("Could not open fallback") },
+        )
+
+        assertFalse(result)
+    }
+
+    @Test
+    fun `malformed uri uses fallback`() {
+        var sendMailCalled = false
+        var fallbackCalled = false
+
+        val result = openDesktopMailSafely(
+            url = "mailto:hello@example.com?subject=bad%escape",
+            sendMail = { _: URI -> sendMailCalled = true },
+            openFallback = {
+                fallbackCalled = true
+                true
+            },
+        )
+
+        assertTrue(result)
+        assertFalse(sendMailCalled)
+        assertTrue(fallbackCalled)
+    }
+}
```

**File**: `e2e/maestro/maestro-e2e-tests.md` (modified, +1/-0)
```diff
@@ -126,6 +126,7 @@ Run for broader functional coverage. Flow files live in `e2e/maestro/{android,io
 
 These are features intentionally not covered, with the reason recorded so they aren't re-investigated:
 
+- **Desktop report-issue email fallback** — Maestro targets mobile and cannot simulate Java Desktop mail support. `DesktopMailHandlerTest` covers mail-launch and fallback failures; manually check Help and About report actions with and without a configured mail client.
 - **iOS scrolling frame timing and row invalidation** — Maestro checks article/read/bookmark behavior (SM-004) and swipe actions (REG-107), but cannot assert SwiftUI update causes or missed frame deadlines. Validate callback and refresh-action performance changes with a warmed-up SwiftUI Instruments capture on a physical iPad; compare row-update causes and hitch timing using the same theme, read-on-scroll setting, and article journey.
 - **YouTube channel URL discovery** — channel aliases require HTTPS requests to YouTube, and the existing Maestro tooling cannot substitute deterministic channel HTML and RSS responses for that host. Live feeds are excluded from Maestro flows. `YouTubeChannelUrlTest`, `FeedUrlRetrieverTest`, and `FeedSourcesRepositoryYouTubeTest` cover channel variants, canonical-link fallback, failed discovery, and subscription behavior with deterministic fixtures and mocked transports.
 - **RevenueCat support paywall and purchases** — the entry is intentionally hidden when no platform public SDK key is configured, while the hosted paywall requires a current RevenueCat offering plus App Store / Google Play sandbox products and then crosses into store-owned purchase UI. There is no production debug hook for bypassing those external prerequisites; validate the paywall and purchases manually with sandbox accounts on both platforms.
```

---

### Incident Patch 2: `314b03b7` (2026-10-01)
**Commit Message**: Fix Google Drive disconnect when credential provider is unavailable

**File**: `androidApp/build.gradle.kts` (modified, +2/-0)
```diff
@@ -199,6 +199,8 @@ dependencies {
     "googlePlayImplementation"(libs.play.review)
     "googlePlayImplementation"(libs.telemetry.deck)
     "googlePlayImplementation"(libs.google.identity.googleid)
+    "googlePlayImplementation"(libs.androidx.credentials)
+    "googlePlayImplementation"(libs.androidx.credentials.play.services.auth)
     "googlePlayImplementation"(libs.google.play.services.auth)
     "googlePlayImplementation"(libs.kotlinx.coroutines.play.services)
     "googlePlayImplementation"(libs.google.api.client.android)
```

**File**: `androidApp/src/googlePlay/kotlin/com/prof18/feedflow/android/accounts/googledrive/GoogleDriveAuthHelper.kt` (modified, +10/-2)
```diff
@@ -6,12 +6,17 @@ import androidx.activity.result.IntentSenderRequest
 import androidx.activity.result.contract.ActivityResultContracts
 import androidx.credentials.ClearCredentialStateRequest
 import androidx.credentials.CredentialManager
+import androidx.credentials.exceptions.ClearCredentialException
+import co.touchlab.kermit.Logger
 import com.google.android.gms.auth.api.identity.AuthorizationRequest
 import com.google.android.gms.auth.api.identity.Identity
 import com.google.android.gms.common.api.Scope
 
 class GoogleDriveAuthHelper(
     private val activity: ComponentActivity,
+    private val clearCredentialState: suspend () -> Unit = {
+        CredentialManager.create(activity).clearCredentialState(ClearCredentialStateRequest())
+    },
 ) {
     fun createAuthorizationLauncher(
         onSuccess: () -> Unit,
@@ -64,7 +69,10 @@ class GoogleDriveAuthHelper(
     }
 
     suspend fun performUnlink() {
-        val credentialManager = CredentialManager.create(activity)
-        credentialManager.clearCredentialState(ClearCredentialStateRequest())
+        try {
+            clearCredentialState()
+        } catch (e: ClearCredentialException) {
+            Logger.w(e) { "Unable to clear Google Drive credential state; continuing local disconnect" }
+        }
     }
 }
```

**File**: `androidApp/src/testGooglePlay/kotlin/com/prof18/feedflow/android/accounts/googledrive/GoogleDriveAuthHelperTest.kt` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+package com.prof18.feedflow.android.accounts.googledrive
+
+import androidx.activity.ComponentActivity
+import androidx.credentials.exceptions.ClearCredentialProviderConfigurationException
+import androidx.credentials.exceptions.ClearCredentialUnknownException
+import kotlinx.coroutines.CancellationException
+import kotlinx.coroutines.test.runTest
+import org.junit.Assert.assertEquals
+import org.junit.Assert.assertSame
+import org.junit.Test
+import org.junit.runner.RunWith
+import org.robolectric.Robolectric
+import org.robolectric.RobolectricTestRunner
+
+@RunWith(RobolectricTestRunner::class)
+class GoogleDriveAuthHelperTest {
+    @Test
+    fun `disconnect continues when credential provider is unavailable`() = runTest {
+        withActivity { activity ->
+            val helper = GoogleDriveAuthHelper(activity) {
+                throw ClearCredentialProviderConfigurationException("No provider dependencies found")
+            }
+            helper.performUnlink()
+        }
+    }
+
+    @Test
+    fun `disconnect continues when credential cleanup fails`() = runTest {
+        withActivity { activity ->
+            val helper = GoogleDriveAuthHelper(activity) {
+                throw ClearCredentialUnknownException("Provider failed")
+            }
+            helper.performUnlink()
+        }
+    }
+
+    @Test
+    fun `disconnect clears credential state`() = runTest {
+        withActivity { activity ->
+            var clearCount = 0
+            val helper = GoogleDriveAuthHelper(activity) { clearCount++ }
+            helper.performUnlink()
+            assertEquals(1, clearCount)
+        }
+    }
+
+    @Test
+    fun `disconnect preserves cancellation`() = runTest {
+        withActivity { activity ->
+            val cancellation = CancellationException("Cancelled")
+            val helper = GoogleDriveAuthHelper(activity) { throw cancellation }
+            val result = runCatching { helper.performUnlink() }
+            assertSame(cancellation, result.exceptionOrNull())
+        }
+    }
+
+    private suspend fun withActivity(block: suspend (ComponentActivity) -> Unit) {
+        val controller = Robolectric.buildActivity(ComponentActivity::class.java).setup()
+        try {
+            block(controller.get())
+        } finally {
+            controller.pause().stop().destroy()
+        }
+    }
+}
```

**File**: `e2e/maestro/maestro-e2e-tests.md` (modified, +4/-0)
```diff
@@ -28,6 +28,10 @@ maestro --platform ios --device "$SIMULATOR_UDID" test e2e/maestro/ios/smoke/<fl
 
 ## Smoke
 
+Google Drive disconnect with an unavailable credential provider is covered by Android Robolectric tests
+(`GoogleDriveAuthHelperTest`). Maestro cannot deterministically force credential-provider failures
+through the current seed tooling; seeded account state does not control the system credential provider.
+
 Fast confidence subset. Flow files live in `e2e/maestro/{android,ios}/smoke/`.
 
 | ID | Flow | Profile | Coverage |
```

**File**: `gradle/libs.versions.toml` (modified, +3/-0)
```diff
@@ -7,6 +7,7 @@ android-min-sdk = "26"
 android-target-sdk = "36"
 androidx-benchmark = "1.5.0"
 androidx-browser = "1.10.0"
+androidx-credentials = "1.6.0"
 androidx-core-ktx = "1.7.0"
 androidx-profileinstaller = "1.4.1"
 androidx-test-ext-junit = "1.3.0"
@@ -95,6 +96,8 @@ about-libraries-core = { module = "com.mikepenz:aboutlibraries-core", version.re
 android-gradle-plugin = { group = "com.android.tools.build", name = "gradle", version.ref = "android-gradle-plugin" }
 androidx-activity-compose = { module = "androidx.activity:activity-compose", version.ref = "activity-compose" }
 androidx-browser = { module = "androidx.browser:browser", version.ref = "androidx-browser" }
+androidx-credentials = { module = "androidx.credentials:credentials", version.ref = "androidx-credentials" }
+androidx-credentials-play-services-auth = { module = "androidx.credentials:credentials-play-services-auth", version.ref = "androidx-credentials" }
 androidx-lifecycle-process = { group = "androidx.lifecycle", name = "lifecycle-process", version.ref = "lifecycle" }
 androidx-lifecycle-runtime-compose = { module = "androidx.lifecycle:lifecycle-runtime-compose", version.ref = "lifecycle" }
 androidx-lifecycle-viewModel = { module = "androidx.lifecycle:lifecycle-viewmodel", version.ref = "lifecycle" }
```

---

### Incident Patch 3: `cb39d0ee` (2026-09-29)
**Commit Message**: Improve image rendering for reader mode

**File**: `e2e/maestro/maestro-e2e-tests.md` (modified, +1/-1)
```diff
@@ -125,7 +125,7 @@ These are features intentionally not covered, with the reason recorded so they a
 - **iOS scrolling frame timing and row invalidation** — Maestro checks article/read/bookmark behavior (SM-004) and swipe actions (REG-107), but cannot assert SwiftUI update causes or missed frame deadlines. Validate callback and refresh-action performance changes with a warmed-up SwiftUI Instruments capture on a physical iPad; compare row-update causes and hitch timing using the same theme, read-on-scroll setting, and article journey.
 - **YouTube channel URL discovery** — channel aliases require HTTPS requests to YouTube, and the existing Maestro tooling cannot substitute deterministic channel HTML and RSS responses for that host. Live feeds are excluded from Maestro flows. `YouTubeChannelUrlTest`, `FeedUrlRetrieverTest`, and `FeedSourcesRepositoryYouTubeTest` cover channel variants, canonical-link fallback, failed discovery, and subscription behavior with deterministic fixtures and mocked transports.
 - **RevenueCat support paywall and purchases** — the entry is intentionally hidden when no platform public SDK key is configured, while the hosted paywall requires a current RevenueCat offering plus App Store / Google Play sandbox products and then crosses into store-owned purchase UI. There is no production debug hook for bypassing those external prerequisites; validate the paywall and purchases manually with sandbox accounts on both platforms.
-- **Reader hero-image de-duplication inside WebView HTML** — Maestro cannot reliably count or order DOM images inside the reader WebView. `ReaderModeHtmlAndCssTest` covers long summary headings followed by a lead image with deterministic HTML instead.
+- **Reader hero-image de-duplication inside WebView HTML** — Maestro cannot reliably count or order DOM images inside the reader WebView. `ReaderModeHtmlAndCssTest` covers long summary headings followed by a lead image with deterministic HTML instead. `ReaderModeViewModelTest` also verifies that extracted web content does not reinsert inline feed thumbnails (including newsletter mastheads or tracking pixels), while feed-content mode and independent hero metadata retain their images. Newsletter extraction itself is covered by frozen source fixtures in Klead; validate the rendered newsletter in dark and light themes on a device when updating that dependency.
 - **Leading-edge drag to open the drawer (REG-164)** — the outcome depends on the device navigation mode, which a flow cannot set. Under gesture navigation the system back gesture owns that edge and the drag leaves the app; under button navigation it opens the drawer. `systemGestureExclusion` is deliberately not used to claim the edge, since the platform honours only 200dp per side and would leave back working on most of the screen and dead near the bottom. REG-164 starts its drawer-opening swipe within the content instead and asserts only the nav-mode independent behaviour.
 - **Android reader video fullscreen** — the fullscreen button lives inside the cross-origin YouTube player iframe, which needs live YouTube and whose auto-hiding controls Maestro cannot target reliably. `FullscreenVideoChromeClient.kt` hosts the view WebView hands to `onShowCustomView`; it was validated manually on a Pixel (enter, exit via back, exit via the player button).
 - **iOS Share Extension via OS share sheet** — Maestro can reach `shareCell` from Safari, but the synthesized tap dispatches into MobileSafari's WebView instead of the remote-hosted `SharingUIService` popover, so the extension process never starts (Maestro/XCTest limitation on iOS 26).
```

**File**: `shared/src/commonMain/kotlin/com/prof18/feedflow/shared/presentation/ReaderModeViewModel.kt` (modified, +12/-1)
```diff
@@ -195,12 +195,23 @@ class ReaderModeViewModel internal constructor(
         lineHeight = settingsRepository.getReaderModeLineHeight(),
         isBookmarked = urlInfo.isBookmarked,
         commentsUrl = urlInfo.commentsUrl,
-        imageUrl = urlInfo.imageUrl,
+        imageUrl = readerImageUrl(urlInfo, shownContentSource),
         shownContentSource = shownContentSource,
         canToggleContentSource = canToggleContentSource,
         siteName = databaseHelper.getFeedItemUrlInfo(urlInfo.id)?.feedSourceTitle ?: urlInfo.feedSourceTitle,
     )
 
+    private suspend fun readerImageUrl(urlInfo: FeedItemUrlInfo, source: ShownContentSource): String? {
+        val imageUrl = urlInfo.imageUrl ?: return null
+        if (source == ShownContentSource.FEED) return imageUrl
+        val feedContent = databaseHelper.getFeedItemContent(urlInfo.id).orEmpty()
+        // Inline feed images may be mastheads or tracking pixels rejected by extraction.
+        // Let the parsed article own those images instead of adding them back as a hero.
+        return imageUrl.takeUnless {
+            feedContent.contains(imageUrl) || feedContent.contains(imageUrl.replace("&", "&amp;"))
+        }
+    }
+
     fun toggleContentSource() {
         val urlInfo = currentArticleMutableState.value ?: return
         val shownSource = currentShownSource ?: return
```

**File**: `shared/src/commonTest/kotlin/com/prof18/feedflow/shared/presentation/ReaderModeViewModelTest.kt` (modified, +37/-0)
```diff
@@ -514,6 +514,43 @@ class ReaderModeViewModelTest : KoinTestBase() {
         }
     }
 
+    @Test
+    fun `web reader does not reinsert an inline feed thumbnail removed by extraction`() = runTest {
+        val imageUrl = "https://example.com/masthead.png?width=600&format=png"
+        val item = seedItemWithContent(
+            "inline-thumbnail",
+            "https://example.com/article",
+            """<img src="${imageUrl.replace("&", "&amp;")}">$SUBSTANTIAL_CONTENT""",
+        )
+        val urlInfo = item.toUrlInfo(ArticleOpenMode.FULL_ARTICLE).copy(imageUrl = imageUrl)
+
+        viewModel.getReaderModeHtml(urlInfo)
+        advanceUntilIdle()
+
+        val state = assertIs<ReaderModeState.Success>(viewModel.readerModeState.value)
+        assertNull(state.readerModeData.imageUrl)
+        assertEquals("Content", state.readerModeData.content)
+
+        viewModel.toggleContentSource()
+        advanceUntilIdle()
+
+        val feedState = assertIs<ReaderModeState.Success>(viewModel.readerModeState.value)
+        assertEquals(ShownContentSource.FEED, feedState.readerModeData.shownContentSource)
+        assertEquals(imageUrl, feedState.readerModeData.imageUrl)
+    }
+
+    @Test
+    fun `web reader retains independently supplied feed hero metadata`() = runTest {
+        val imageUrl = "https://example.com/hero.jpg"
+        val item = seedItemWithContent("metadata-hero", "https://example.com/article", SUBSTANTIAL_CONTENT)
+
+        viewModel.getReaderModeHtml(item.toUrlInfo(ArticleOpenMode.FULL_ARTICLE).copy(imageUrl = imageUrl))
+        advanceUntilIdle()
+
+        val state = assertIs<ReaderModeState.Success>(viewModel.readerModeState.value)
+        assertEquals(imageUrl, state.readerModeData.imageUrl)
+    }
+
     @Test
     fun `web preference falls back to feed content when parsing fails`() = runTest {
         parserBehavior = ParserBehavior.Error
```

---

### Incident Patch 4: `5a77434e` (2026-09-24)
**Commit Message**: Update dependency androidx.navigation3:navigation3-ui to v1.2.0

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ lyricist = "1.9.0"
 material-window-size = "1.9.0"
 multiplatform-settings = "1.3.0"
 multiplatformMarkdownRendererM3 = "0.45.0"
-nav3 = "1.1.7"
+nav3 = "1.2.0"
 nav3-multiplatform = "1.1.2"
 lifecycle-viewmodel-nav3 = "2.11.0"
 lifecycle-viewmodel-nav3-multiplatform = "2.11.0"
```

---

### Incident Patch 5: `67f3b504` (2026-09-22)
**Commit Message**: Update dependency org.jetbrains.androidx.navigation3:navigation3-ui to v1.1.2

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ material-window-size = "1.9.0"
 multiplatform-settings = "1.3.0"
 multiplatformMarkdownRendererM3 = "0.45.0"
 nav3 = "1.1.7"
-nav3-multiplatform = "1.1.1"
+nav3-multiplatform = "1.1.2"
 lifecycle-viewmodel-nav3 = "2.11.0"
 lifecycle-viewmodel-nav3-multiplatform = "2.11.0"
 org-robolectric = "4.17"
```

---

### Incident Patch 6: `b98d3f81` (2026-09-21)
**Commit Message**: Keep the whole markdown renderer in the desktop ProGuard config

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `desktopApp/compose-desktop.pro` (modified, +4/-1)
```diff
@@ -106,8 +106,11 @@
 
 
 # Compose Markdown
+# Reader mode calls markdownComponents() with most parameters defaulted, so the defaults are
+# loaded from the generated ComposableSingletons lambda classes. Shrinking those away crashes
+# reader mode with NoClassDefFoundError (Sentry JAVA-M2), so keep the whole renderer.
 
--keep class com.mikepenz.markdown.model.** { *; }
+-keep class com.mikepenz.markdown.** { *; }
 
 # Ktor
 
```

---

### Incident Patch 7: `a3fe2dec` (2026-09-21)
**Commit Message**: Update dependency com.google.firebase.crashlytics to v3.0.8

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ compose-webview = "2.0.3"
 colorpicker-compose = "1.3.0"
 coroutines = "1.11.0"
 crashk-ios = "0.10.0"
-crashlytics-plugin = "3.0.7"
+crashlytics-plugin = "3.0.8"
 csv = "1.3"
 detekt = "1.23.8"
 detekt-compose-rules = "0.4.28"
```

---

### Incident Patch 8: `444c739a` (2026-09-21)
**Commit Message**: Update dependency co.touchlab.crashkios:crashlytics to v0.10.0

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ compose-unstyled = "2.9.0"
 compose-webview = "2.0.3"
 colorpicker-compose = "1.3.0"
 coroutines = "1.11.0"
-crashk-ios = "0.9.0"
+crashk-ios = "0.10.0"
 crashlytics-plugin = "3.0.7"
 csv = "1.3"
 detekt = "1.23.8"
```

#### Recent Merged Pull Requests:
- **PR #1503** (2026-10-05): Merge localization into main (@github-actions[bot])
- **PR #1502** (2026-10-04): Use search results for reader article navigation (@prof18)
- **PR #1501** (2026-10-04): Add Force English setting on Android and desktop (@prof18)
- **PR #1500** (2026-10-04): Merge localization into main (@github-actions[bot])
- **PR #1497** (2026-10-02): Merge localization into main (@github-actions[bot])
- **PR #1496** (2026-10-01): Confirm bookmark removal and bulk mark as read (@prof18)
- **PR #1495** (2026-10-04): Remember large-screen sidebar visibility on mobile (@prof18)
- **PR #1493** (2026-10-01): Respect active filters when marking articles above or below as read (@prof18)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
