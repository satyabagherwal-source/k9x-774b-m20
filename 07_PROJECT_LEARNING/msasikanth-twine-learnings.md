# Forensic Learning Record (Deep Inspection): msasikanth/twine

> **Canonical Artifact**: `07_PROJECT_LEARNING/msasikanth-twine-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/msasikanth/twine](https://github.com/msasikanth/twine))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:57:33.239Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `msasikanth/twine`
- **Description**: Twine: A multiplatform RSS reader built using Kotlin and Compose
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2420 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `androidApp/src/main/kotlin/dev/sasikanth/rss/reader/CloudSyncWorker.kt`
```
/*
 * Copyright 2026 Sasikanth Miriyampalli
 *
 * Licensed under the GPL, Version 3.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.gnu.org/licenses/gpl-3.0.en.html
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
package dev.sasikanth.rss.reader

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequest
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkerParameters
import dev.sasikanth.rss.reader.data.sync.SyncCoordinator
import dev.sasikanth.rss.reader.logging.CrashReporter
import java.time.Duration
import kotlinx.coroutines.CancellationException

class CloudSyncWorker(
  context: Context,
  workerParameters: WorkerParameters,
  private val syncCoordinator: SyncCoordinator,
) : CoroutineWorker(context, workerParameters) {

  companion object Companion {

    const val TAG = "CLOUD_SYNC_WORKER"

    fun periodicRequest(): PeriodicWorkRequest {
      val constraints =
        Constraints.Builder()
          .setRequiredNetworkType(NetworkType.CONNECTED)
          .setRequiresBatteryNotLow(true)
          .build()

      return PeriodicWorkRequestBuilder<CloudSyncWorker>(repeatInterval = Duration.ofMinutes(15))
        .setConstraints(constraints)
        .build()
    }
  }

  override suspend fun doWork(): Result {
    return try {
      syncCoordinator.push()
      Result.success()
    } catch (e: CancellationException) {
      Result.failure()
    } catch (e: Exception) {
      CrashReporter.leaveBreadcrumb("Background Worker")
      CrashReporter.log(e)
      Result.failure()
    }
  }
}

```

### Core Architecture Module: `androidApp/src/main/kotlin/dev/sasikanth/rss/reader/FeedsRefreshWorker.kt`
```
/*
 * Copyright 2026 Sasikanth Miriyampalli
 *
 * Licensed under the GPL, Version 3.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.gnu.org/licenses/gpl-3.0.en.html
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
package dev.sasikanth.rss.reader

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequest
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkerParameters
import dev.sasikanth.rss.reader.data.refreshpolicy.RefreshPolicy
import dev.sasikanth.rss.reader.data.repository.SettingsRepository
import dev.sasikanth.rss.reader.data.sync.SyncCoordinator
import dev.sasikanth.rss.reader.data.sync.utils.NewArticleNotifier
import dev.sasikanth.rss.reader.logging.CrashReporter
import dev.sasikanth.rss.reader.widget.GlanceWidgetUpdater
import java.time.Duration
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.first

class FeedsRefreshWorker(
  context: Context,
  workerParameters: WorkerParameters,
  private val refreshPolicy: RefreshPolicy,
  private val settingsRepository: SettingsRepository,
  private val syncCoordinator: SyncCoordinator,
  private val newArticleNotifier: NewArticleNotifier,
) : CoroutineWorker(context, workerParameters) {

  companion object {

    const val TAG = "REFRESH_FEEDS"

    fun periodicRequest(): PeriodicWorkRequest {
      val constraints =
        Constraints.Builder()
          .setRequiredNetworkType(NetworkType.CONNECTED)
          .setRequiresBatteryNotLow(true)
          .build()

      return PeriodicWorkRequestBuilder<FeedsRefreshWorker>(repeatInterval = Duration.ofHours(1))
        .setConstraints(constraints)
        .build()
    }
  }

  override suspend fun doWork(): Result {
    if (settingsRepository.enableAutoSync.first().not()) return Result.failure()

    return if (refreshPolicy.hasExpired()) {
      try {
        val lastRefreshedAt = refreshPolicy.fetchLastRefreshedAt()
        syncCoordinator.pull()

        newArticleNotifier.notifyIfNewArticles(
          lastRefreshedAt = lastRefreshedAt,
          title = { count ->
            applicationContext.resources.getQuantityString(
              R.plurals.notification_new_articles_title,
              count,
              count,
            )
          },
          content = { applicationContext.getString(R.string.notification_new_articles_content) },
          perFeedTitle = { feedName, count ->
            applicationContext.resources.getQuantityString(
              R.plurals.notification_new_articles_per_feed_title,
              count,
              feedName,
              count,
            )
          },
        )

        GlanceWidgetUpdater.update(applicationContext)

        Result.success()
      } catch (e: CancellationException) {
        Result.failure()
      } catch (e: Exception) {
        CrashReporter.leaveBreadcrumb("Background Worker")
        CrashReporter.log(e)
        Result.failure()
      }
    } else {
      Result.failure()
    }
  }
}

```

### Core Architecture Module: `androidApp/src/main/kotlin/dev/sasikanth/rss/reader/PostsCleanUpWorker.kt`
```
/*
 * Copyright 2026 Sasikanth Miriyampalli
 *
 * Licensed under the GPL, Version 3.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.gnu.org/licenses/gpl-3.0.en.html
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

package dev.sasikanth.rss.reader

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequest
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkerParameters
import dev.sasikanth.rss.reader.data.repository.RssRepository
import dev.sasikanth.rss.reader.data.repository.SettingsRepository
import dev.sasikanth.rss.reader.logging.CrashReporter
import dev.sasikanth.rss.reader.utils.calculateInstantBeforePeriod
import java.time.Duration
import kotlin.coroutines.cancellation.CancellationException

class PostsCleanUpWorker(
  context: Context,
  workerParameters: WorkerParameters,
  private val rssRepository: RssRepository,
  private val settingsRepository: SettingsRepository,
) : CoroutineWorker(context, workerParameters) {

  companion object {

    const val TAG = "POSTS_CLEAN_UP"

    fun periodicRequest(): PeriodicWorkRequest {
      val constraints =
        Constraints.Builder()
          .setRequiredNetworkType(NetworkType.CONNECTED)
          .setRequiresBatteryNotLow(true)
          .build()

      return PeriodicWorkRequestBuilder<PostsCleanUpWorker>(repeatInterval = Duration.ofDays(1))
        .setConstraints(constraints)
        .build()
    }
  }

  override suspend fun doWork(): Result {
    try {
      val postsDeletionPeriod = settingsRepository.postsDeletionPeriodImmediate()
      val feedsDeletedFrom =
        rssRepository.deleteReadPosts(before = postsDeletionPeriod.calculateInstantBeforePeriod())

      if (feedsDeletedFrom.isNotEmpty()) {
        rssRepository.updateFeedsLastCleanUpAt(feedsDeletedFrom)
      }
      return Result.success()
    } catch (e: CancellationException) {
      // no-op
    } catch (e: Exception) {
      CrashReporter.leaveBreadcrumb("Background Worker")
      CrashReporter.log(e)
    }

    return Result.failure()
  }
}

```

### Core Architecture Module: `core/base/src/androidFoss/kotlin/dev/sasikanth/rss/reader/logging/CrashReporter.android.kt`
```
/*
 * Copyright 2026 Sasikanth Miriyampalli
 *
 * Licensed under the GPL, Version 3.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.gnu.org/licenses/gpl-3.0.en.html
 *
 */

package dev.sasikanth.rss.reader.logging

actual object CrashReporter {
  actual fun log(exception: Throwable) {
    // no-op
  }

  actual fun setCustomValue(section: String, key: String, value: String?) {
    // no-op
  }

  actual fun leaveBreadcrumb(message: String) {
    // no-op
  }
}

```

### Core Architecture Module: `core/base/src/androidFull/kotlin/dev/sasikanth/rss/reader/logging/CrashReporter.android.kt`
```
/*
 * Copyright 2026 Sasikanth Miriyampalli
 *
 * Licensed under the GPL, Version 3.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.gnu.org/licenses/gpl-3.0.en.html
 *
 */

package dev.sasikanth.rss.reader.logging

import co.touchlab.crashkios.bugsnag.BugsnagKotlin
import com.bugsnag.android.Bugsnag

actual object CrashReporter {
  actual fun log(exception: Throwable) {
    BugsnagKotlin.sendHandledException(exception)
  }

  actual fun setCustomValue(section: String, key: String, value: String?) {
    if (value != null) {
      BugsnagKotlin.setCustomValue(section, key, value)
    }
  }

  actual fun leaveBreadcrumb(message: String) {
    Bugsnag.leaveBreadcrumb(message)
  }
}

```

### Core Architecture Module: `core/base/src/androidMain/kotlin/dev/sasikanth/rss/reader/core/base/widget/AndroidWidgetUpdateBridge.kt`
```
/*
 * Copyright 2026 Sasikanth Miriyampalli
 *
 * Licensed under the GPL, Version 3.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.gnu.org/licenses/gpl-3.0.en.html
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

package dev.sasikanth.rss.reader.core.base.widget

import android.content.Context

object AndroidWidgetUpdateBridge {
  private var updateAction: ((Context) -> Unit)? = null

  fun register(action: (Context) -> Unit) {
    updateAction = action
  }

  fun unregister() {
    updateAction = null
  }

  fun update(context: Context) {
    updateAction?.invoke(context)
  }
}

```

### Core Architecture Module: `core/base/src/androidMain/kotlin/dev/sasikanth/rss/reader/core/base/widget/AndroidWidgetUpdater.kt`
```
/*
 * Copyright 2026 Sasikanth Miriyampalli
 *
 * Licensed under the GPL, Version 3.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.gnu.org/licenses/gpl-3.0.en.html
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

package dev.sasikanth.rss.reader.core.base.widget

import android.content.Context
import me.tatarka.inject.annotations.Inject

@Inject
class AndroidWidgetUpdater(private val context: Context) : WidgetUpdater {
  override fun updateUnreadWidget() {
    AndroidWidgetUpdateBridge.update(context)
  }
}

```

### Core Architecture Module: `core/base/src/androidMain/kotlin/dev/sasikanth/rss/reader/core/base/widget/di/WidgetPlatformComponent.kt`
```
/*
 * Copyright 2026 Sasikanth Miriyampalli
 *
 * Licensed under the GPL, Version 3.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.gnu.org/licenses/gpl-3.0.en.html
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

package dev.sasikanth.rss.reader.core.base.widget.di

import dev.sasikanth.rss.reader.core.base.widget.AndroidWidgetUpdater
import dev.sasikanth.rss.reader.core.base.widget.WidgetUpdater
import dev.sasikanth.rss.reader.di.scopes.AppScope
import me.tatarka.inject.annotations.Provides

interface WidgetPlatformComponent {

  @Provides @AppScope fun AndroidWidgetUpdater.bind(): WidgetUpdater = this
}

```

### Core Architecture Module: `core/base/src/androidMain/kotlin/dev/sasikanth/rss/reader/notifications/AndroidNotifier.kt`
```
/*
 * Copyright 2026 Sasikanth Miriyampalli
 *
 * Licensed under the GPL, Version 3.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.gnu.org/licenses/gpl-3.0.en.html
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

package dev.sasikanth.rss.reader.notifications

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.content.PermissionChecker
import dev.sasikanth.rss.reader.core.base.R
import dev.sasikanth.rss.reader.di.scopes.AppScope
import me.tatarka.inject.annotations.Inject

@Inject
@AppScope
class AndroidNotifier(private val context: Context) : Notifier {

  private val notificationManager =
    context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  companion object {
    private const val CHANNEL_ID = "twine_notifications"
    private const val CHANNEL_NAME = "Twine Notifications"
  }

  init {
    val channel = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH)
    notificationManager.createNotificationChannel(channel)
  }

  override suspend fun show(
    title: String,
    content: String,
    notificationId: Int,
    groupId: String?,
    isSummary: Boolean,
  ) {
    val intent =
      context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
      }

    val pendingIntent =
      PendingIntent.getActivity(
        context,
        0,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

    val notificationBuilder =
      NotificationCompat.Builder(context, CHANNEL_ID)
        .setContentTitle(title)
        .setContentText(content)
        .setSmallIcon(R.drawable.rss_feed)
        .setContentIntent(pendingIntent)
        .setAutoCancel(true)

    if (groupId != null) {
      notificationBuilder.setGroup(groupId)
      notificationBuilder.setGroupSummary(isSummary)
    }

    notificationManager.notify(notificationId, notificationBuilder.build())
  }

  override suspend fun requestPermission(): Boolean {
    if (Build.VERSION.SDK_INT >= 33) {
      val status =
        PermissionChecker.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)

      if (status != PermissionChecker.PERMISSION_GRANTED) {
        val result = PermissionRequestBridge.requestPermission()?.await()
        if (result == PermissionRequestBridge.PermissionResult.PermanentlyDenied) {
          openSettings()
        }
        return result == PermissionRequestBridge.PermissionResult.Granted
      }
    }
    return true
  }

  override fun openSettings() {
    val intent =
      Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
        data = Uri.fromParts("package", context.packageName, null)
        flags = Intent.FLAG_ACTIVITY_NEW_TASK
      }
    context.startActivity(intent)
  }
}

```

### Core Architecture Module: `core/base/src/androidMain/kotlin/dev/sasikanth/rss/reader/notifications/PermissionRequestBridge.kt`
```
/*
 * Copyright 2026 Sasikanth Miriyampalli
 *
 * Licensed under the GPL, Version 3.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.gnu.org/licenses/gpl-3.0.en.html
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

package dev.sasikanth.rss.reader.notifications

import kotlinx.coroutines.CompletableDeferred

object PermissionRequestBridge {
  private var requestAction: ((CompletableDeferred<PermissionResult>) -> Unit)? = null

  fun register(action: (CompletableDeferred<PermissionResult>) -> Unit) {
    requestAction = action
  }

  fun unregister() {
    requestAction = null
  }

  fun requestPermission(): CompletableDeferred<PermissionResult>? {
    val deferred = CompletableDeferred<PermissionResult>()
    val action = requestAction
    return if (action != null) {
      action(deferred)
      deferred
    } else {
      null
    }
  }

  sealed interface PermissionResult {
    data object Granted : PermissionResult

    data object Denied : PermissionResult

    data object PermanentlyDenied : PermissionResult
  }
}

```

### Core Architecture Module: `core/base/src/androidMain/kotlin/dev/sasikanth/rss/reader/notifications/di/NotificationsPlatformComponent.kt`
```
/*
 * Copyright 2026 Sasikanth Miriyampalli
 *
 * Licensed under the GPL, Version 3.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.gnu.org/licenses/gpl-3.0.en.html
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

package dev.sasikanth.rss.reader.notifications.di

import dev.sasikanth.rss.reader.di.scopes.AppScope
import dev.sasikanth.rss.reader.notifications.AndroidNotifier
import dev.sasikanth.rss.reader.notifications.Notifier
import me.tatarka.inject.annotations.Provides

actual interface NotificationsPlatformComponent {

  @Provides @AppScope fun AndroidNotifier.bind(): Notifier = this
}

```

### Core Architecture Module: `core/base/src/androidMain/kotlin/dev/sasikanth/rss/reader/util/DateExt.android.kt`
```
/*
 * Copyright 2026 Sasikanth Miriyampalli
 *
 * Licensed under the GPL, Version 3.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.gnu.org/licenses/gpl-3.0.en.html
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

package dev.sasikanth.rss.reader.util

import java.time.LocalDateTime as JavaLocalDateTime
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale
import java.util.TimeZone
import kotlin.time.Instant
import kotlin.time.toJavaInstant
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.toJavaLocalDateTime

actual fun Instant.readerDateTimestamp(): String {
  val dateTime = JavaLocalDateTime.ofInstant(toJavaInstant(), TimeZone.getDefault().toZoneId())
  val dateFormatter = DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)
  val timeFormatter = DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT)

  val formattedDate = dateFormatter.format(dateTime)
  val formattedTime = timeFormatter.format(dateTime)

  return "$formattedDate • $formattedTime"
}

actual fun LocalDateTime.homeAppBarTimestamp(): String {
  val locale = Locale.getDefault()
  val pattern =
    when (locale.language) {
      "de" -> "EEE, d. MMM"
      "fr" -> "EEE d MMM"
      else -> "EEE, MMM d"
    }

  val formatter = DateTimeFormatter.ofPattern(pattern, locale)
  return formatter.format(toJavaLocalDateTime())
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1915** (2026-08-24): **Fetch full article in reader view fails for Engadget**
  *Symptoms*: **Describe the bug** For the Engadget feed, the button to fetch full article in reader view doesn't produce any result. It works in other RSS apps like Feeder though.  **To Reproduce** Steps to reproduce the behavior: 1. Add Engadget feed in Twine (https://www.engadget.com/rss.xml) 2. Open an article of Engadget. 3. Click the button to fetch full article in reader view. 4. Nothing happens.  **Screen Capture** https://github.com/user-attachments/assets/883190ff-b0e8-41f5-afd6-ce6a3471e706   **Feed Information** https://www.engadget.com/rss.xml  **Device Information**  - Device: Samsung Galaxy S25 Plus  - OS: Android 16  - App Version: 3.7.0-FOSS  **Stacktrace** N/A 

- **Issue #1913** (2026-08-23): **Getting 403 when adding a certain feed**
  *Symptoms*: **Describe the bug** When trying to add Firstpost's feed, app throws 403. This feed opens fine in the browser and other RSS apps like Feeder.  **To Reproduce** Steps to reproduce the behavior: 1. Open Twine. 2. Add a new feed: https://www.firstpost.com/commonfeeds/v1/mfp/rss/india.xml 3. Hit "Add Feed" button. 4. App throws 403. 5. Open the feed directly in a browser, it'll open without issues.  **Screenshots** ![Screenshot_20260822_180400_Twine.jpg](https://github.com/user-attachments/assets/796f70c0-4b76-4719-948a-52264c6c5153)   **Feed Information** https://www.firstpost.com/commonfeeds/v1/mfp/rss/india.xml  **Device Information**  - Device: Galaxy S25 Plus  - OS: Android 16  - App Version: 3.7.0-FOSS  **Stacktrace** N/A 

- **Issue #1909** (2026-08-21): **For some feeds, only a single item is rendered**
  *Symptoms*: **Describe the bug** For some feeds like Ars Technica and The Guardian, for some reason, only a single item is rendered by Twine even though the feed has many items.  **To Reproduce** Steps to reproduce the behavior: 1. Go to https://arstechnica.com/feed/ 2. You'll notice that there are many items in the feed. 3. Now import this in Twine. 4. Only a single item is rendered.  This happens for the Guardian as well: https://www.theguardian.com/world/rss  **Screenshots** This is how it looks in Twine: ![Screenshot_20260821_194010_Twine.jpg](https://github.com/user-attachments/assets/edacd5c7-95af-46cc-980a-62fe3bdc1df3)  This is how it's rendered in other apps like Feeder: ![Screenshot_20260821_194015_Feeder.jpg](https://github.com/user-attachments/assets/ff391537-8238-42af-b4c0-a34d4b1ab8ff)  **Feed Information** Ars: https://arstechnica.com/feed/  The Guardian: https://www.theguardian.com/world/rss  **Device Information**  - Device: Samsung Galaxy S25 Plus  - OS: Android 16  - App Version: 3.7.0-FOSS  
  **Post-Mortem & Fix Analysis**:
  > Tom's Hardware has a lot of items as well but not sure why only 2 are shown in the app.  https://www.tomshardware.com/feeds.xml

- **Issue #1908** (2026-08-21): **Images not being rendered for MAL feed**
  *Symptoms*: **Describe the bug** MyAnimeList is a popular anime info and news website that has an official RSS feed. For each item in the feed, image is present under <media:thumbnail> tag which is not parsed by Twine.  **To Reproduce** Steps to reproduce the behavior: 1. Import feed in Twine: https://myanimelist.net/rss/news.xml 2. Open the feed. 3. Images won't be present, only text for each item. 4. If you open the feed link in the browser, you'll notice that image is present in every item.  **Feed Information** https://myanimelist.net/rss/news.xml  **Device Information**  - Device: Samsung Galaxy S25 Plus  - OS: Android 16  - App Version: 3.7.0-FOSS  **Other** Other apps like Feeder are able to render images for this feed. 

- **Issue #1904** (2026-08-18): **Opml import button does nothing**
  *Symptoms*: **Describe the bug** Hitting the "import" button for opml does nothing. It doesn't even open a file select option.  **To Reproduce** Steps to reproduce the behavior: 1. Go to Settings. 2. Click on Services&Sync. 3. Tap on "import" next to opml. 4. See error.  **Device Information**  - Device: ZenFone 9  - OS: Android 14  - App Version 3.6.0
  **Post-Mortem & Fix Analysis**:
  > Oui, the same for me
  > This also happens with the export button
  > Sorry about that, it's been resolved (https://github.com/msasikanth/twine/commit/5410ecc546bcbc77d17ee32e69bc9132cd500ff2) and should be available in v3.7.0

- **Issue #1899** (2026-08-15): **App crashes when exporting to OPML**
  *Symptoms*: **Describe the bug** When exporting to OPML the app crashes. Also the import button doesn't do anything when pressed.  **To Reproduce** Steps to reproduce the behavior: 1. Open settings 2. Go to 'Services & sync' 3. Scroll down to 'OPML' 4. Click 'Export' 5. Exporting starts and then the app crashes 4. Click 'Import' 5. Nothing happens  **Device Information**  - Device: Samsung Galaxy A55  - OS: OneUI 8.5/Android 16  - App Version: 3.6.0 (1775)

- **Issue #1898** (2026-08-15): **Swiping from the left should open menu drawer**
  *Symptoms*: **Describe the bug** Currently, swiping from the left on the feed screen (not specific post) triggers the back gesture behavior instead of opening the menu drawer.  **To Reproduce** Steps to reproduce the behavior: 1. Go to any feed page, main feed or category 2. Swipe from the left of the screen 3. Android pops up back gesture icon 4. App closes  **Device Information**  - Device: Pixel 9a  - OS: Android 17  - App Version: 3.5.0
  **Post-Mortem & Fix Analysis**:
  > That is Android system gesture can't change that. You can swipe left on the post list itself, navigation drawer comes up.
  > I don't know why I didn't try that but this app felt different than every other one for some reason, so I made a bug ticket.  Thanks for the answer!

- **Issue #1883** (2026-07-26): **Making the app independent of Google servers**
  *Symptoms*: This is far the best looking feed reader app I've found out there and would be easily my favorite, however there is this little issue preventing it to be my everyday news reading app. I've noticed it connects to Google servers to fetch favicons and thumbnails, though in the Privacy Policy it's stated otherwise. My firewall shows regular connections to t0.gstatic.com, t1.gstatic.com, etc., which is not a privacy friendly approach. Blocking these connections makes thumbnails and favicons no longer shown. Would be great to make the app completely independent from any aggressive data collecting company. 
  **Post-Mortem & Fix Analysis**:
  > Unfortunately no, app tries to resolve fav icons from the website HTML, if that falls I fallback to Google.
  > > Unfortunately no, app tries to resolve fav icons from the website HTML, if that falls I fallback to Google.  Looks like it fails to resolve them from the original website all the time. Other feed reader apps I've tried didn't have this problem. It's really a pity, because Twine is awesome otherwise.
  > One more note:  Since there are Google requests for each of my feed, then I assume one of the following might be behind it:  - the HTML parser is failing - the resolver has a bug - the fallback is triggered far too aggressively - the Google lookup is the default path despite it's stated otherwise  Maybe it'd worth checking.  IMHO the idea that Google is somehow necessary here is not the luckiest. Browsers, RSS readers and self-hosted services have been discovering favicons for decades without asking Google first 🙂

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

### Incident Patch 1: `59f80f60` (2026-08-30)
**Commit Message**: Bundle SQLite native libraries for macOS App Store builds

**File**: `core/data/src/jvmMain/kotlin/dev/sasikanth/rss/reader/data/database/DriverFactory.jvm.kt` (modified, +19/-0)
```diff
@@ -25,6 +25,8 @@ import me.tatarka.inject.annotations.Inject
 actual class DriverFactory(private val codeMigrations: Array<AfterVersion>) {
 
   actual fun createDriver(): SqlDriver {
+    useBundledSqliteNativeLibrary()
+
     val databasePath = File(System.getProperty("user.home"), ".twine/${DB_NAME}")
     databasePath.parentFile.mkdirs()
 
@@ -47,6 +49,23 @@ actual class DriverFactory(private val codeMigrations: Array<AfterVersion>) {
     return driver
   }
 
+  // Without this sqlite-jdbc unpacks its native library into a temp directory and loads it
+  // from there, which macOS refuses for a sandboxed App Store build. The packaged app ships a
+  // signed copy in its resources; outside a package the property is absent and the default
+  // extraction path is used.
+  private fun useBundledSqliteNativeLibrary() {
+    val resourcesDir = System.getProperty("compose.application.resources.dir") ?: return
+    val library = File(resourcesDir, SQLITE_LIBRARY_NAME)
+    if (!library.exists()) return
+
+    System.setProperty("org.sqlite.lib.path", resourcesDir)
+    System.setProperty("org.sqlite.lib.name", SQLITE_LIBRARY_NAME)
+  }
+
+  private companion object {
+    const val SQLITE_LIBRARY_NAME = "libsqlitejdbc.dylib"
+  }
+
   private fun readUserVersion(databasePath: File): Long {
     val driver = JdbcSqliteDriver(url = "jdbc:sqlite:${databasePath.absolutePath}")
     driver.use { driver ->
```

**File**: `desktopApp/build.gradle.kts` (modified, +30/-0)
```diff
@@ -9,6 +9,7 @@
  *
  */
 
+import org.gradle.api.artifacts.component.ModuleComponentIdentifier
 import org.jetbrains.compose.desktop.application.dsl.TargetFormat
 
 plugins {
@@ -34,6 +35,33 @@ kotlin {
   }
 }
 
+// sqlite-jdbc extracts its bundled native library to a temp directory on first use, and an
+// App Store build may only load code that is signed inside its own bundle. Unpacking it here
+// puts it in app resources, where Compose signs it along with the other native libraries.
+val sqliteJdbcNatives: Provider<List<FileTree>> =
+  configurations.named("jvmRuntimeClasspath").map { configuration ->
+    configuration.incoming
+      .artifactView {
+        componentFilter { id -> id is ModuleComponentIdentifier && id.module == "sqlite-jdbc" }
+      }
+      .files
+      .map { zipTree(it) }
+  }
+
+val unpackSqliteNatives by
+  tasks.registering(Sync::class) {
+    from(sqliteJdbcNatives) {
+      include("org/sqlite/native/Mac/aarch64/**")
+      eachFile { relativePath = RelativePath(true, "macos-arm64", name) }
+    }
+    from(sqliteJdbcNatives) {
+      include("org/sqlite/native/Mac/x86_64/**")
+      eachFile { relativePath = RelativePath(true, "macos-x64", name) }
+    }
+    includeEmptyDirs = false
+    into(layout.buildDirectory.dir("appResources"))
+  }
+
 compose.desktop {
   application {
     mainClass = "dev.sasikanth.rss.reader.MainKt"
@@ -51,6 +79,8 @@ compose.desktop {
 
       buildTypes.release.proguard { configurationFiles.from(project.file("proguard-rules.pro")) }
 
+      appResourcesRootDir.fileProvider(unpackSqliteNatives.map { it.destinationDir })
+
       macOS {
         bundleID = "dev.sasikanth.rss.reader"
         iconFile.set(project.file("icon.icns"))
```

---

### Incident Patch 2: `24b1ea76` (2026-08-30)
**Commit Message**: Fix desktop version resolution on push and parallelise macOS trigger

- Skip the Tramline step unless an input is present. The action calls `json.loads` on the raw input with no guard, so it threw a `JSONDecodeError` on every push to main where no Tramline input exists; a skipped step yields empty outputs and falls through to the release tag or nearest git tag as intended.
- Move the macOS App Store dispatch out of the iOS build job into its own job. It only needs `tramline-input`, which is available immediately, so both platforms now build in parallel instead of macOS waiting on the iOS archive and TestFlight upload.
- Scope `actions: write` to the dispatch job rather than the whole workflow.

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `.github/workflows/desktop_distributables.yml` (modified, +1/-0)
```diff
@@ -48,6 +48,7 @@ jobs:
           fetch-depth: 0
       - name: Configure Tramline
         id: tramline
+        if: ${{ github.event.inputs.tramline-input != '' }}
         uses: tramlinehq/deploy-action@v0.1.7
         with:
           input: ${{ github.event.inputs.tramline-input }}
```

**File**: `.github/workflows/ios_prod_release.yml` (modified, +19/-15)
```diff
@@ -7,10 +7,26 @@ on:
         description: "Tramline input"
         required: false
 
-permissions:
-  actions: write
-
 jobs:
+  trigger-macos:
+    name: Trigger macOS App Store build
+    runs-on: ubuntu-latest
+    if: ${{ github.event.inputs.tramline-input != '' }}
+    permissions:
+      actions: write
+    steps:
+      - name: Build and upload macOS to TestFlight
+        env:
+          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+          GH_REPO: ${{ github.repository }}
+          TRAMLINE_INPUT: ${{ github.event.inputs.tramline-input }}
+        run: |
+          gh workflow run desktop_distributables.yml \
+            --ref "$GITHUB_REF_NAME" \
+            -f tramline-input="$TRAMLINE_INPUT" \
+            -f app_store_only=true \
+            -f upload_to_app_store=true
+
   build:
     runs-on: macos-26
     env:
@@ -111,15 +127,3 @@ jobs:
         with:
           name: app
           path: ${{ runner.temp }}/build/twine.ipa
-
-      - name: Build and upload macOS to TestFlight
-        if: ${{ github.event.inputs.tramline-input != '' }}
-        env:
-          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
-          TRAMLINE_INPUT: ${{ github.event.inputs.tramline-input }}
-        run: |
-          gh workflow run desktop_distributables.yml \
-            --ref "$GITHUB_REF_NAME" \
-            -f tramline-input="$TRAMLINE_INPUT" \
-            -f app_store_only=true \
-            -f upload_to_app_store=true
```

---

### Incident Patch 3: `8863ff75` (2026-08-30)
**Commit Message**: Trigger macOS App Store build from iOS Tramline releases

- Accept `tramline-input` in the desktop workflow and resolve the version from Tramline before falling back to the release tag or nearest git tag.
- Dispatch the desktop workflow at the end of `ios_prod_release.yml` so the Mac App Store build decodes the same input and lands on identical version numbers; Tramline has no macOS train to target it directly.
- Add `app_store_only` so a nightly builds only the App Store package, skipping the DMG, MSI and DEB bundlers.

**File**: `.github/workflows/desktop_distributables.yml` (modified, +25/-5)
```diff
@@ -13,6 +13,13 @@ on:
       - '.github/workflows/desktop_distributables.yml'
   workflow_dispatch:
     inputs:
+      tramline-input:
+        description: "Tramline input"
+        required: false
+      app_store_only:
+        description: "Build only the Mac App Store package, skipping DMG/MSI/DEB"
+        type: boolean
+        default: false
       upload_to_app_store:
         description: "Upload the Mac App Store package to App Store Connect"
         type: boolean
@@ -39,21 +46,32 @@ jobs:
       - uses: actions/checkout@v6
         with:
           fetch-depth: 0
+      - name: Configure Tramline
+        id: tramline
+        uses: tramlinehq/deploy-action@v0.1.7
+        with:
+          input: ${{ github.event.inputs.tramline-input }}
       - id: resolve
         env:
+          TRAMLINE_VERSION_NAME: ${{ steps.tramline.outputs.version_name }}
+          TRAMLINE_VERSION_CODE: ${{ steps.tramline.outputs.version_code }}
           RELEASE_TAG: ${{ github.event.release.tag_name }}
         run: |
-          TAG="$RELEASE_TAG"
-          if [ -z "$TAG" ]; then
-            TAG="$(git describe --tags --abbrev=0 2>/dev/null || echo 1.0.0)"
+          NAME="$TRAMLINE_VERSION_NAME"
+          if [ -z "$NAME" ]; then
+            NAME="$RELEASE_TAG"
+          fi
+          if [ -z "$NAME" ]; then
+            NAME="$(git describe --tags --abbrev=0 2>/dev/null || echo 1.0.0)"
           fi
-          echo "name=${TAG#v}" >> "$GITHUB_OUTPUT"
-          echo "code=${{ github.run_number }}" >> "$GITHUB_OUTPUT"
+          echo "name=${NAME#v}" >> "$GITHUB_OUTPUT"
+          echo "code=${TRAMLINE_VERSION_CODE:-${{ github.run_number }}}" >> "$GITHUB_OUTPUT"
 
   build-macos:
     name: Build macOS DMG
     runs-on: macos-latest
     needs: version
+    if: ${{ github.event_name != 'workflow_dispatch' || !inputs.app_store_only }}
     timeout-minutes: 30
     env:
       ORG_GRADLE_PROJECT_VERSION_NAME: ${{ needs.version.outputs.name }}
@@ -229,6 +247,7 @@ jobs:
     name: Build Windows MSI
     runs-on: windows-latest
     needs: version
+    if: ${{ github.event_name != 'workflow_dispatch' || !inputs.app_store_only }}
     env:
       ORG_GRADLE_PROJECT_VERSION_NAME: ${{ needs.version.outputs.name }}
       ORG_GRADLE_PROJECT_VERSION_CODE: ${{ needs.version.outputs.code }}
@@ -257,6 +276,7 @@ jobs:
     name: Build Linux DEB
     runs-on: ubuntu-latest
     needs: version
+    if: ${{ github.event_name != 'workflow_dispatch' || !inputs.app_store_only }}
     env:
       ORG_GRADLE_PROJECT_VERSION_NAME: ${{ needs.version.outputs.name }}
       ORG_GRADLE_PROJECT_VERSION_CODE: ${{ needs.version.outputs.code }}
```

**File**: `.github/workflows/ios_prod_release.yml` (modified, +15/-0)
```diff
@@ -7,6 +7,9 @@ on:
         description: "Tramline input"
         required: false
 
+permissions:
+  actions: write
+
 jobs:
   build:
     runs-on: macos-26
@@ -108,3 +111,15 @@ jobs:
         with:
           name: app
           path: ${{ runner.temp }}/build/twine.ipa
+
+      - name: Build and upload macOS to TestFlight
+        if: ${{ github.event.inputs.tramline-input != '' }}
+        env:
+          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+          TRAMLINE_INPUT: ${{ github.event.inputs.tramline-input }}
+        run: |
+          gh workflow run desktop_distributables.yml \
+            --ref "$GITHUB_REF_NAME" \
+            -f tramline-input="$TRAMLINE_INPUT" \
+            -f app_store_only=true \
+            -f upload_to_app_store=true
```

---

### Incident Patch 4: `8554cff9` (2026-08-30)
**Commit Message**: Configure Windows installer shortcuts and upgrade UUID

- Enable Start Menu shortcut under Twine menu group.
- Pin upgrade UUID so subsequent installations upgrade in place instead of creating duplicate entries.

**File**: `desktopApp/build.gradle.kts` (modified, +8/-1)
```diff
@@ -76,7 +76,14 @@ compose.desktop {
         }
       }
 
-      windows { iconFile.set(project.file("icon.ico")) }
+      windows {
+        iconFile.set(project.file("icon.ico"))
+        menu = true
+        menuGroup = "Twine"
+        // Keeps repeat installs upgrading in place instead of stacking up as separate
+        // entries; jpackage has no stable default, so it has to be pinned here.
+        upgradeUuid = "d4e54722-7924-4736-9d37-fb158d0f8f52"
+      }
 
       linux {
         debMaintainer = "contact@sasikanth.dev"
```

---

### Incident Patch 5: `9f371043` (2026-08-29)
**Commit Message**: Use squircle shapes for App Icon selection

- Add `androidx.graphics:graphics-shapes` dependency.
- Introduce a `squircleShape` helper function to replace standard Material Design rounded shapes in `AppIconButton` and `AppIconPreview`.
- Update the icon clipping and selection border to use the new squircle geometry with specific corner fractions and smoothing.

**File**: `gradle/libs.versions.toml` (modified, +2/-0)
```diff
@@ -26,6 +26,7 @@ androidx_work = "2.11.2"
 androidx_datastore = "1.2.1"
 androidx_browser = "1.10.0"
 androidx_annotation = "1.10.0"
+androidx_graphics_shapes = "1.1.0"
 coil = "3.5.0"
 spotless = "8.10.0"
 ktfmt = "0.61"
@@ -103,6 +104,7 @@ sqldelight_extensions_coroutines = { module = "app.cash.sqldelight:coroutines-ex
 sqldelight_extensions_paging = { module = "app.cash.sqldelight:androidx-paging3-extensions", version.ref = "sqldelight" }
 sqldelight_sqlite_dialect = { module = "app.cash.sqldelight:sqlite-3-35-dialect", version.ref = "sqldelight" }
 androidx_activity_compose = { module = "androidx.activity:activity-compose", version.ref = "androidx_activity" }
+androidx_graphics_shapes = { module = "androidx.graphics:graphics-shapes", version.ref = "androidx_graphics_shapes" }
 androidx_appcompat = { module = "androidx.appcompat:appcompat", version.ref = "androidx_appcompat" }
 androidx_core = { module = "androidx.core:core-ktx", version.ref = "androidx_core" }
 androidx_collection = { module = "androidx.collection:collection", version.ref = "androidx_collection" }
```

**File**: `shared/build.gradle.kts` (modified, +1/-0)
```diff
@@ -110,6 +110,7 @@ kotlin {
       implementation(libs.ktor.client.logging)
       implementation(libs.kotlininject.runtime)
       implementation(libs.androidx.collection)
+      implementation(libs.androidx.graphics.shapes)
       implementation(libs.ksoup)
       implementation(libs.ksoup.kotlinx.io)
       api(libs.androidx.datastore.okio)
```

**File**: `shared/src/commonMain/kotlin/dev/sasikanth/rss/reader/components/AppIconButton.kt` (modified, +30/-10)
```diff
@@ -39,8 +39,10 @@ import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
 import androidx.compose.material3.Icon
 import androidx.compose.material3.MaterialTheme
 import androidx.compose.material3.Text
+import androidx.compose.material3.toShape
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.getValue
+import androidx.compose.runtime.remember
 import androidx.compose.ui.Alignment
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.draw.clip
@@ -52,6 +54,9 @@ import androidx.compose.ui.graphics.Shape
 import androidx.compose.ui.graphics.compositeOver
 import androidx.compose.ui.text.style.TextAlign
 import androidx.compose.ui.unit.dp
+import androidx.graphics.shapes.CornerRounding
+import androidx.graphics.shapes.RoundedPolygon
+import androidx.graphics.shapes.rectangle
 import dev.sasikanth.rss.reader.app.AppIcon
 import dev.sasikanth.rss.reader.resources.icons.StarShine
 import dev.sasikanth.rss.reader.resources.icons.TwineIcons
@@ -81,6 +86,7 @@ fun AppIconButton(
   modifier: Modifier = Modifier,
   showLabel: Boolean = false,
 ) {
+  val iconShape = squircleShape(IconCornerFraction)
   val borderWidth by animateDpAsState(if (selected) 2.dp else 1.dp)
   val borderColor by
     animateColorAsState(
@@ -95,7 +101,7 @@ fun AppIconButton(
       modifier =
         Modifier.then(
           if (selected) {
-            Modifier.border(borderWidth, borderColor, MaterialTheme.shapes.largeIncreased)
+            Modifier.border(borderWidth, borderColor, squircleShape(RingCornerFraction))
           } else {
             Modifier
           }
@@ -104,16 +110,10 @@ fun AppIconButton(
     ) {
       Box(
         modifier =
-          modifier.requiredSize(72.dp).padding(4.dp).clip(MaterialTheme.shapes.large).clickable {
-            onClick()
-          },
+          modifier.requiredSize(72.dp).padding(4.dp).clip(iconShape).clickable { onClick() },
         contentAlignment = Alignment.Center,
       ) {
-        AppIconPreview(
-          appIcon = appIcon,
-          shape = MaterialTheme.shapes.large,
-          modifier = Modifier.matchParentSize(),
-        )
+        AppIconPreview(appIcon = appIcon, shape = iconShape, modifier = Modifier.matchParentSize())
 
         if (appIcon.isPremium && !isSubscribed) {
           PremiumBadge()
@@ -160,7 +160,7 @@ private fun BoxScope.PremiumBadge() {
 internal fun AppIconPreview(
   appIcon: AppIcon,
   modifier: Modifier = Modifier,
-  shape: Shape = MaterialTheme.shapes.large,
+  shape: Shape = squircleShape(IconCornerFraction),
 ) {
   val backgroundColor =
     when (appIcon) {
@@ -209,3 +209,23 @@ private fun AppIcon.displayName(): String =
     AppIcon.Slate -> stringResource(Res.string.themeVariantSlate)
     AppIcon.Sepia -> stringResource(Res.string.themeVariantSepia)
   }
+
+@OptIn(ExperimentalMaterial3ExpressiveApi::class)
+@Composable
+private fun squircleShape(cornerFraction: Float): Shape {
+  val polygon =
+    remember(cornerFraction) {
+      RoundedPolygon.rectangle(
+        width = 1f,
+        height = 1f,
+        rounding = CornerRounding(radius = cornerFraction, smoothing = SquircleSmoothing),
+        centerX = 0.5f,
+        centerY = 0.5f,
+      )
+    }
+  return polygon.toShape()
+}
+
+private const val SquircleSmoothing = 0.6f
+private const val IconCornerFraction = 0.25f
+private const val RingCornerFraction = 0.28f
```

---

### Incident Patch 6: `8c760206` (2026-08-29)
**Commit Message**: Remove Material 2 remnants and unused UI constants

- Remove `ExperimentalMaterialApi` opt-ins from the shared module and home components.
- Replace Material 2 `Text` with Material 3 `Text` in `PinnedSourcesBottomBar`.
- Remove the unused `SYSTEM_SCRIM` constant from `AppTheme`.

**File**: `shared/build.gradle.kts` (modified, +0/-1)
```diff
@@ -90,7 +90,6 @@ kotlin {
 
   sourceSets {
     all {
-      languageSettings.optIn("androidx.compose.material.ExperimentalMaterialApi")
       languageSettings.optIn("androidx.compose.material3.ExperimentalMaterial3Api")
       languageSettings.optIn("kotlinx.coroutines.ExperimentalCoroutinesApi")
       languageSettings.optIn("org.jetbrains.compose.resources.ExperimentalResourceApi")
```

**File**: `shared/src/commonMain/kotlin/dev/sasikanth/rss/reader/feeds/ui/pinned/PinnedSourcesBottomBar.kt` (modified, +1/-1)
```diff
@@ -33,8 +33,8 @@ import androidx.compose.foundation.layout.widthIn
 import androidx.compose.foundation.lazy.LazyRow
 import androidx.compose.foundation.lazy.rememberLazyListState
 import androidx.compose.foundation.shape.CircleShape
-import androidx.compose.material.Text
 import androidx.compose.material3.MaterialTheme
+import androidx.compose.material3.Text
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.getValue
 import androidx.compose.ui.Alignment
```

**File**: `shared/src/commonMain/kotlin/dev/sasikanth/rss/reader/home/HomeEvent.kt` (modified, +0/-3)
```diff
@@ -14,11 +14,8 @@
  * limitations under the License.
  *
  */
-@file:OptIn(ExperimentalMaterialApi::class)
-
 package dev.sasikanth.rss.reader.home
 
-import androidx.compose.material.ExperimentalMaterialApi
 import androidx.compose.material3.SheetValue
 import dev.sasikanth.rss.reader.core.model.local.PostsSortOrder
 import dev.sasikanth.rss.reader.core.model.local.PostsType
```

**File**: `shared/src/commonMain/kotlin/dev/sasikanth/rss/reader/home/HomeState.kt` (modified, +0/-3)
```diff
@@ -14,11 +14,8 @@
  * limitations under the License.
  *
  */
-@file:OptIn(ExperimentalMaterialApi::class)
-
 package dev.sasikanth.rss.reader.home
 
-import androidx.compose.material.ExperimentalMaterialApi
 import androidx.compose.material3.SheetValue
 import androidx.compose.runtime.Immutable
 import androidx.paging.PagingData
```

**File**: `shared/src/commonMain/kotlin/dev/sasikanth/rss/reader/ui/AppTheme.kt` (modified, +0/-3)
```diff
@@ -29,7 +29,6 @@ import androidx.compose.runtime.ReadOnlyComposable
 import androidx.compose.runtime.SideEffect
 import androidx.compose.runtime.remember
 import androidx.compose.runtime.staticCompositionLocalOf
-import androidx.compose.ui.graphics.Color
 import dev.sasikanth.rss.reader.utils.LocalAmoledSetting
 
 @Composable
@@ -119,6 +118,4 @@ internal val DefaultRippleAlpha =
     hoveredAlpha = 0.08f,
   )
 
-internal val SYSTEM_SCRIM = Color.Black.copy(alpha = 0.8f)
-
 internal val LocalIsDarkTheme = staticCompositionLocalOf { false }
```

---

### Incident Patch 7: `c28912c7` (2026-08-29)
**Commit Message**: Prefer local feed icons during FreshRSS and Miniflux synchronization

Update the sync logic for FreshRSS and Miniflux to prioritize locally resolved icons (such as YouTube channel avatars) over server-side favicons. Remote icons are now only used as a fallback if the local icon is blank or missing, preventing higher-quality local icons from being overwritten during sync.

**File**: `core/data/src/commonMain/kotlin/dev/sasikanth/rss/reader/data/sync/freshrss/FreshRSSSyncCoordinator.kt` (modified, +6/-1)
```diff
@@ -352,10 +352,14 @@ class FreshRSSSyncCoordinator(
 
       val feedId =
         if (localFeed != null) {
+          // Locally resolved icons (YouTube channel avatars, etc.) are better than the server's
+          // favicon lookup, so only fall back to the remote icon when we don't have one.
+          val resolvedIcon = localFeed.icon.ifBlank { subscription.iconUrl }
           if (
             localFeed.remoteId != subscription.id ||
               localFeed.name != subscription.title ||
-              localFeed.homepageLink != subscription.htmlUrl
+              localFeed.homepageLink != subscription.htmlUrl ||
+              localFeed.icon != resolvedIcon
           ) {
             rssRepository.upsertFeeds(
               listOf(
@@ -365,6 +369,7 @@ class FreshRSSSyncCoordinator(
                   remoteId = subscription.id,
                   lastUpdatedAt = syncStartTime,
                   isDeleted = false,
+                  icon = resolvedIcon,
                 )
               )
             )
```

**File**: `core/data/src/commonMain/kotlin/dev/sasikanth/rss/reader/data/sync/miniflux/MinifluxSyncCoordinator.kt` (modified, +9/-6)
```diff
@@ -376,8 +376,13 @@ class MinifluxSyncCoordinator(
     val localGroupsByName = localGroups.associateBy { it.name }
 
     remoteFeeds.forEach { remoteFeed ->
+      val localFeed =
+        localFeedsByRemoteId[remoteFeed.id.toString()] ?: localFeedsByLink[remoteFeed.feedUrl]
+
+      // Locally resolved icons (YouTube channel avatars, etc.) are better than the server's
+      // favicon lookup, so only fall back to the remote icon when we don't have one.
       val iconDataUri =
-        if (remoteFeed.icon.externalIconId.isNotBlank()) {
+        if (localFeed?.icon.isNullOrBlank() && remoteFeed.icon.externalIconId.isNotBlank()) {
           val iconResponse = minifluxSource.feedIcon(remoteFeed.id)
           if (iconResponse != null) {
             "data:${iconResponse.data}"
@@ -388,16 +393,14 @@ class MinifluxSyncCoordinator(
           null
         }
 
-      val localFeed =
-        localFeedsByRemoteId[remoteFeed.id.toString()] ?: localFeedsByLink[remoteFeed.feedUrl]
-
       val feedId =
         if (localFeed != null) {
+          val resolvedIcon = iconDataUri ?: localFeed.icon
           if (
             localFeed.remoteId != remoteFeed.id.toString() ||
               localFeed.name != remoteFeed.title ||
               localFeed.homepageLink != remoteFeed.siteUrl ||
-              localFeed.icon != (iconDataUri ?: localFeed.icon)
+              localFeed.icon != resolvedIcon
           ) {
             rssRepository.upsertFeeds(
               listOf(
@@ -407,7 +410,7 @@ class MinifluxSyncCoordinator(
                   remoteId = remoteFeed.id.toString(),
                   lastUpdatedAt = syncStartTime,
                   isDeleted = false,
-                  icon = iconDataUri ?: localFeed.icon,
+                  icon = resolvedIcon,
                 )
               )
             )
```

---

### Incident Patch 8: `e22655ac` (2026-08-25)
**Commit Message**: Fix in-app review prompt eligibility checks

Avoid preparing the review flow when the user is ineligible, use Instant.DISTANT_PAST as fallback for unprompted users, and update the last review prompt date on iOS.

**File**: `shared/src/androidFull/kotlin/dev/sasikanth/rss/reader/utils/AndroidInAppRating.kt` (modified, +17/-13)
```diff
@@ -23,6 +23,7 @@ import dev.sasikanth.rss.reader.data.repository.SettingsRepository
 import dev.sasikanth.rss.reader.di.scopes.ActivityScope
 import kotlin.coroutines.resume
 import kotlin.time.Clock
+import kotlin.time.Instant
 import kotlinx.coroutines.flow.first
 import kotlinx.coroutines.flow.firstOrNull
 import kotlinx.coroutines.suspendCancellableCoroutine
@@ -36,6 +37,21 @@ class AndroidInAppRating(
 ) : InAppRating {
 
   override suspend fun request() {
+    val now = Clock.System.now()
+    val installDate = settingsRepository.installDate.firstOrNull() ?: now
+    val lastPromptDate =
+      settingsRepository.lastReviewPromptDate.firstOrNull() ?: Instant.DISTANT_PAST
+    val sessionCount = settingsRepository.userSessionCount.first()
+    val canShowReviewPrompt =
+      canShowReviewPrompt(
+        currentTime = now,
+        installDate = installDate,
+        lastPromptDate = lastPromptDate,
+        sessionCount = sessionCount,
+      )
+
+    if (!canShowReviewPrompt) return
+
     val manager = ReviewManagerFactory.create(activity)
     val request = suspendCancellableCoroutine { continuation ->
       manager.requestReviewFlow().addOnCompleteListener { task ->
@@ -47,19 +63,7 @@ class AndroidInAppRating(
       }
     }
 
-    val now = Clock.System.now()
-    val installDate = settingsRepository.installDate.firstOrNull() ?: now
-    val lastPromptDate = settingsRepository.lastReviewPromptDate.firstOrNull() ?: now
-    val sessionCount = settingsRepository.userSessionCount.first()
-    val canShowReviewPrompt =
-      canShowReviewPrompt(
-        currentTime = Clock.System.now(),
-        installDate = installDate,
-        lastPromptDate = lastPromptDate,
-        sessionCount = sessionCount,
-      )
-
-    if (request != null && canShowReviewPrompt) {
+    if (request != null) {
       manager.launchReviewFlow(activity, request)
       settingsRepository.updateLastReviewPromptDate(now)
     }
```

**File**: `shared/src/iosMain/kotlin/dev/sasikanth/rss/reader/utils/IosInAppRating.kt` (modified, +13/-8)
```diff
@@ -20,6 +20,7 @@ package dev.sasikanth.rss.reader.utils
 import dev.sasikanth.rss.reader.data.repository.SettingsRepository
 import dev.sasikanth.rss.reader.di.scopes.AppScope
 import kotlin.time.Clock
+import kotlin.time.Instant
 import kotlinx.coroutines.flow.first
 import kotlinx.coroutines.flow.firstOrNull
 import me.tatarka.inject.annotations.Inject
@@ -32,25 +33,29 @@ import platform.UIKit.UIWindowScene
 class IosInAppRating(private val settingsRepository: SettingsRepository) : InAppRating {
 
   override suspend fun request() {
-    val scene =
-      UIApplication.sharedApplication.connectedScenes
-        .mapNotNull { it as? UIWindowScene }
-        .firstOrNull { it.activationState == platform.UIKit.UISceneActivationStateForegroundActive }
-
     val now = Clock.System.now()
     val installDate = settingsRepository.installDate.firstOrNull() ?: now
-    val lastPromptDate = settingsRepository.lastReviewPromptDate.firstOrNull() ?: now
+    val lastPromptDate =
+      settingsRepository.lastReviewPromptDate.firstOrNull() ?: Instant.DISTANT_PAST
     val sessionCount = settingsRepository.userSessionCount.first()
     val canShowReviewPrompt =
       canShowReviewPrompt(
-        currentTime = Clock.System.now(),
+        currentTime = now,
         installDate = installDate,
         lastPromptDate = lastPromptDate,
         sessionCount = sessionCount,
       )
 
-    if (scene != null && canShowReviewPrompt) {
+    if (!canShowReviewPrompt) return
+
+    val scene =
+      UIApplication.sharedApplication.connectedScenes
+        .mapNotNull { it as? UIWindowScene }
+        .firstOrNull { it.activationState == platform.UIKit.UISceneActivationStateForegroundActive }
+
+    if (scene != null) {
       SKStoreReviewController.requestReviewInScene(scene)
+      settingsRepository.updateLastReviewPromptDate(now)
     }
   }
 }
```

---

### Incident Patch 9: `c29d746a` (2026-08-22)
**Commit Message**: Optimize feed parser performance and memory usage (#1912)

* Optimize date time parsing across platforms

Reuse DateTimeFormatter and NSDateFormatter instances to avoid allocating formatters per date parsing call. Use parseUnresolved check on Android and JVM to prevent costly exception throwing on pattern mismatch.

* Support HTML entity resolution and optimize host extraction in XML feed parsers

Resolve named HTML entities in XML feed titles and descriptions using Ksoup Entities instead of dropping them. Extract post host link once per feed during XML parsing rather than for every item.

* Stream posts in JSON feed parser and skip animated GIFs for hero image

Convert JSON feed parser item mapping to flow to stream post payloads lazily. Update ArticleHtmlParser to prefer static images over animated GIFs for hero image selection and lower maximum HTML content size limit.

* Add fallback image and preview extraction for oversized post HTML

Increase ArticleHtmlParser MAX_CONTENT_SIZE to 5MB and extract hero image and bounded text preview from unparsed or oversized post content in XmlContentParser.

**File**: `core/base/src/androidMain/kotlin/dev/sasikanth/rss/reader/util/DateTimeFormatters.android.kt` (modified, +15/-2)
```diff
@@ -17,6 +17,7 @@
 
 package dev.sasikanth.rss.reader.util
 
+import java.text.ParsePosition
 import java.time.Instant
 import java.time.LocalDateTime
 import java.time.ZoneId
@@ -30,15 +31,18 @@ import kotlinx.datetime.toJavaLocalDateTime
 import kotlinx.datetime.toJavaZoneId
 import kotlinx.datetime.toLocalDateTime
 
+private val dateTimeFormatters =
+  dateFormatterPatterns.map { DateTimeFormatter.ofPattern(it, Locale.US) }
+
 @Throws(DateTimeFormatException::class)
 actual fun String?.dateStringToEpochMillis(clock: Clock): Long? {
   if (this.isNullOrBlank()) return null
 
   val currentDate =
     clock.now().toLocalDateTime(TimeZone.currentSystemDefault()).toJavaLocalDateTime()
 
-  for (pattern in dateFormatterPatterns) {
-    val dateTimeFormatter = DateTimeFormatter.ofPattern(pattern, Locale.US)
+  for (dateTimeFormatter in dateTimeFormatters) {
+    if (!dateTimeFormatter.canParse(this)) continue
 
     try {
       val parsedValue = parseToInstant(dateTimeFormatter, this)
@@ -56,6 +60,15 @@ actual fun String?.dateStringToEpochMillis(clock: Clock): Long? {
   return null
 }
 
+private fun DateTimeFormatter.canParse(text: String): Boolean {
+  val position = ParsePosition(0)
+  return try {
+    parseUnresolved(text, position) != null && position.index == text.length
+  } catch (e: Exception) {
+    false
+  }
+}
+
 private fun parseToInstant(dateTimeFormatter: DateTimeFormatter, text: String): Instant {
   return dateTimeFormatter.parse(text, Instant::from)
 }
```

**File**: `core/base/src/iosMain/kotlin/dev/sasikanth/rss/reader/util/DateTimeFormatters.ios.kt` (modified, +11/-12)
```diff
@@ -34,23 +34,22 @@ import platform.Foundation.NSDateFormatter
 import platform.Foundation.NSLocale
 import platform.Foundation.timeIntervalSince1970
 
+private val dateFormatters by lazy {
+  dateFormatterPatterns.map { pattern ->
+    createDateFormatter(
+      pattern = pattern,
+      timeZone = if (hasTimeZonePattern(pattern)) null else TimeZone.UTC,
+    )
+  }
+}
+
 @Throws(DateTimeFormatException::class)
 actual fun String?.dateStringToEpochMillis(clock: Clock): Long? {
   if (this.isNullOrBlank()) return null
 
   try {
-    val date =
-      dateFormatterPatterns.firstNotNullOfOrNull { pattern ->
-        val timeZone =
-          if (hasTimeZonePattern(pattern)) {
-            null
-          } else {
-            TimeZone.UTC
-          }
-        val dateTimeFormatter = createDateFormatter(pattern = pattern, timeZone = timeZone)
-
-        dateTimeFormatter.dateFromString(this.trim())
-      }
+    val dateString = this.trim()
+    val date = dateFormatters.firstNotNullOfOrNull { it.dateFromString(dateString) }
 
     if (date != null) {
       val currentDate = clock.now().toNSDate()
```

**File**: `core/base/src/jvmMain/kotlin/dev/sasikanth/rss/reader/util/DateTimeFormatters.jvm.kt` (modified, +15/-2)
```diff
@@ -11,6 +11,7 @@
 
 package dev.sasikanth.rss.reader.util
 
+import java.text.ParsePosition
 import java.time.Instant
 import java.time.LocalDateTime
 import java.time.ZoneId
@@ -24,15 +25,18 @@ import kotlinx.datetime.toJavaLocalDateTime
 import kotlinx.datetime.toJavaZoneId
 import kotlinx.datetime.toLocalDateTime
 
+private val dateTimeFormatters =
+  dateFormatterPatterns.map { DateTimeFormatter.ofPattern(it, Locale.US) }
+
 @Throws(DateTimeFormatException::class)
 actual fun String?.dateStringToEpochMillis(clock: Clock): Long? {
   if (this.isNullOrBlank()) return null
 
   val currentDate =
     clock.now().toLocalDateTime(TimeZone.currentSystemDefault()).toJavaLocalDateTime()
 
-  for (pattern in dateFormatterPatterns) {
-    val dateTimeFormatter = DateTimeFormatter.ofPattern(pattern, Locale.US)
+  for (dateTimeFormatter in dateTimeFormatters) {
+    if (!dateTimeFormatter.canParse(this)) continue
 
     try {
       val parsedValue = parseToInstant(dateTimeFormatter, this)
@@ -50,6 +54,15 @@ actual fun String?.dateStringToEpochMillis(clock: Clock): Long? {
   return null
 }
 
+private fun DateTimeFormatter.canParse(text: String): Boolean {
+  val position = ParsePosition(0)
+  return try {
+    parseUnresolved(text, position) != null && position.index == text.length
+  } catch (e: Exception) {
+    false
+  }
+}
+
 private fun parseToInstant(dateTimeFormatter: DateTimeFormatter, text: String): Instant {
   return dateTimeFormatter.parse(text, Instant::from)
 }
```

**File**: `core/network/src/commonMain/kotlin/dev/sasikanth/rss/reader/core/network/parser/common/ArticleHtmlParser.kt` (modified, +14/-8)
```diff
@@ -35,9 +35,9 @@ class ArticleHtmlParser {
     private const val TAG_SOURCE = "source"
     private const val ATTR_TYPE = "type"
 
-    private const val MAX_CONTENT_SIZE = 10 * 1024 * 1024 // 10MB
+    private const val MAX_CONTENT_SIZE = 5 * 1024 * 1024 // 5MB
 
-    private val gifRegex = Regex("/\\.gif(\\?.*)?\\$/i")
+    private val gifRegex = Regex("\\.gif(\\?.*)?$", RegexOption.IGNORE_CASE)
   }
 
   private val allowedContentTags by lazy {
@@ -59,15 +59,21 @@ class ArticleHtmlParser {
         }
       val cleanedHtmlDocument = Cleaner(allowedContentTags).clean(originalHtmlDocument)
       val body = cleanedHtmlDocument.body().first()
+      var firstGifImage: String? = null
       val heroImage =
-        body.firstNotNullOfOrNull {
-          val imageUrl = it.attr(ATTR_SRC)
-          if (it.tagName() == TAG_IMG && !gifRegex.containsMatchIn(imageUrl)) {
-            imageUrl.removeSurrounding("\"")
-          } else {
+        body.firstNotNullOfOrNull { element ->
+          if (element.tagName() != TAG_IMG) return@firstNotNullOfOrNull null
+
+          val imageUrl = element.attr(ATTR_SRC)
+          if (gifRegex.containsMatchIn(imageUrl)) {
+            if (firstGifImage == null) {
+              firstGifImage = imageUrl.removeSurrounding("\"")
+            }
             null
+          } else {
+            imageUrl.removeSurrounding("\"")
           }
-        }
+        } ?: firstGifImage
 
       val audioUrl =
         body.select(TAG_AUDIO).firstOrNull()?.let { audio ->
```

**File**: `core/network/src/commonMain/kotlin/dev/sasikanth/rss/reader/core/network/parser/json/JsonFeedParser.kt` (modified, +18/-15)
```diff
@@ -25,7 +25,7 @@ import dev.sasikanth.rss.reader.core.network.utils.UrlUtils
 import dev.sasikanth.rss.reader.util.DispatchersProvider
 import dev.sasikanth.rss.reader.util.dateStringToEpochMillis
 import kotlin.time.Clock
-import kotlinx.coroutines.flow.asFlow
+import kotlinx.coroutines.flow.flow
 import kotlinx.coroutines.withContext
 import kotlinx.io.Source
 import kotlinx.serialization.ExperimentalSerializationApi
@@ -54,8 +54,8 @@ class JsonFeedParser(
             urlString = jsonFeedPayload.homePageUrl ?: jsonFeedPayload.url ?: feedUrl
           )
 
-        val posts =
-          jsonFeedPayload.items.map { jsonFeedPost ->
+        val posts = flow {
+          jsonFeedPayload.items.forEach { jsonFeedPost ->
             val postPublishedAt = jsonFeedPost.publishedAt?.dateStringToEpochMillis()
 
             val htmlContent = articleHtmlParser.parse(jsonFeedPost.contentHtml.orEmpty())
@@ -77,19 +77,22 @@ class JsonFeedParser(
               jsonFeedPost.attachments.firstOrNull { it.mimeType.startsWith("audio/") }?.url
                 ?: htmlContent?.audioUrl
 
-            PostPayload(
-              title = jsonFeedPost.title.orEmpty(),
-              link = jsonFeedPost.url.orEmpty(),
-              description = description,
-              rawContent = rawContent,
-              fullContent = null,
-              imageUrl = jsonFeedPost.imageUrl ?: image,
-              audioUrl = audioUrl,
-              date = postPublishedAt ?: Clock.System.now().toEpochMilliseconds(),
-              commentsLink = null,
-              isDateParsedCorrectly = postPublishedAt != null,
+            emit(
+              PostPayload(
+                title = jsonFeedPost.title.orEmpty(),
+                link = jsonFeedPost.url.orEmpty(),
+                description = description,
+                rawContent = rawContent,
+                fullContent = null,
+                imageUrl = jsonFeedPost.imageUrl ?: image,
+                audioUrl = audioUrl,
+                date = postPublishedAt ?: Clock.System.now().toEpochMilliseconds(),
+                commentsLink = null,
+                isDateParsedCorrectly = postPublishedAt != null,
+              )
             )
           }
+        }
 
         val feedPayload =
           FeedPayload(
@@ -99,7 +102,7 @@ class JsonFeedParser(
             description = jsonFeedPayload.description.orEmpty(),
             homepageLink = jsonFeedPayload.homePageUrl ?: feedUrl,
             link = jsonFeedPayload.url ?: feedUrl,
-            posts = posts.asFlow(),
+            posts = posts,
           )
 
         return@withContext feedPayload
```

**File**: `core/network/src/commonMain/kotlin/dev/sasikanth/rss/reader/core/network/parser/xml/AtomFeedParser.kt` (modified, +3/-1)
```diff
@@ -107,6 +107,8 @@ class AtomContentParser(httpClient: HttpClient, override val articleHtmlParser:
         iconUrl
       }
 
+    val postHostLink = UrlUtils.extractHost(link ?: feedUrl)
+
     return createFeedPayload(
       name = title,
       description = description,
@@ -119,7 +121,7 @@ class AtomContentParser(httpClient: HttpClient, override val articleHtmlParser:
           firstPost = firstPost,
           containerTag = TAG_ATOM_FEED,
           itemTag = TAG_ATOM_ENTRY,
-          readItem = { readAtomEntry(it, UrlUtils.extractHost(link ?: feedUrl)) },
+          readItem = { readAtomEntry(it, postHostLink) },
         ),
     )
   }
```

**File**: `core/network/src/commonMain/kotlin/dev/sasikanth/rss/reader/core/network/parser/xml/RDFFeedParser.kt` (modified, +3/-1)
```diff
@@ -72,6 +72,8 @@ class RDFContentParser(override val articleHtmlParser: ArticleHtmlParser) : XmlC
       }
     }
 
+    val postHostLink = UrlUtils.extractHost(link ?: feedUrl)
+
     return createFeedPayload(
       name = title,
       description = description,
@@ -83,7 +85,7 @@ class RDFContentParser(override val articleHtmlParser: ArticleHtmlParser) : XmlC
           parser = parser,
           containerTag = XmlFeedParser.RDF_TAG,
           itemTag = TAG_RSS_ITEM,
-          readItem = { readRssItem(it, UrlUtils.extractHost(link ?: feedUrl)) },
+          readItem = { readRssItem(it, postHostLink) },
         ),
     )
   }
```

**File**: `core/network/src/commonMain/kotlin/dev/sasikanth/rss/reader/core/network/parser/xml/RssFeedParser.kt` (modified, +3/-1)
```diff
@@ -87,6 +87,8 @@ class RSSContentParser(override val articleHtmlParser: ArticleHtmlParser) : XmlC
       }
     }
 
+    val postHostLink = UrlUtils.extractHost(link ?: feedUrl)
+
     return createFeedPayload(
       name = title,
       description = description,
@@ -99,7 +101,7 @@ class RSSContentParser(override val articleHtmlParser: ArticleHtmlParser) : XmlC
           firstPost = firstPost,
           containerTag = TAG_RSS_CHANNEL,
           itemTag = TAG_RSS_ITEM,
-          readItem = { readRssItem(it, UrlUtils.extractHost(link ?: feedUrl)) },
+          readItem = { readRssItem(it, postHostLink) },
         ),
     )
   }
```

---

### Incident Patch 10: `95c37cde` (2026-08-21)
**Commit Message**: Fix media element parsing truncating feeds and dropping images (#1910)

Media elements were read by pulling the `url` attribute and then calling
`parser.nextTag()`, which assumes the element is empty. Feeds that nest
children inside `media:content` (The Guardian, Ars Technica) left the
parser a level deep, and since both the item loop and `postsFlow` bailed
on any END_TAG, the next nested end tag terminated the item and then the
whole post flow, yielding a single post per feed.

Separately, the image tag guard required a non-blank `url` attribute, so
feeds that put the URL in the element's text (MyAnimeList) fell through
to `skipSubTree()` and never produced an image.

Read the image URL from either the attribute or the text content, and
consume the whole element in both cases. Replace the END_TAG-terminated
loops with `forEachChildTag`, which stops only at its container's end
tag, so a misaligned child degrades one item instead of truncating the
rest of the feed. Atom entries now also read bare `media:content` and
`media:thumbnail`, which they previously ignored outside `media:group`.

Fixes #1908
Fixes #1909

**File**: `core/network/src/commonMain/kotlin/dev/sasikanth/rss/reader/core/network/parser/xml/AtomFeedParser.kt` (modified, +16/-8)
```diff
@@ -87,7 +87,7 @@ class AtomContentParser(httpClient: HttpClient, override val articleHtmlParser:
         }
         TAG_ITUNES_IMAGE -> {
           iconUrl = parser.getAttributeValue(parser.namespace, ATTR_HREF)
-          parser.nextTag()
+          parser.skipSubTree()
         }
         TAG_ATOM_ENTRY -> {
           val host = UrlUtils.extractHost(link ?: feedUrl)
@@ -117,6 +117,7 @@ class AtomContentParser(httpClient: HttpClient, override val articleHtmlParser:
         postsFlow(
           parser = parser,
           firstPost = firstPost,
+          containerTag = TAG_ATOM_FEED,
           itemTag = TAG_ATOM_ENTRY,
           readItem = { readAtomEntry(it, UrlUtils.extractHost(link ?: feedUrl)) },
         ),
@@ -140,10 +141,8 @@ class AtomContentParser(httpClient: HttpClient, override val articleHtmlParser:
     var image: String? = null
     var audioUrl: String? = null
 
-    while (parser.next() != EventType.END_TAG) {
-      if (parser.eventType != EventType.START_TAG) continue
-
-      when (val tagName = parser.name) {
+    forEachChildTag(parser, TAG_ATOM_ENTRY) { tagName ->
+      when (tagName) {
         TAG_TITLE -> {
           title = parser.nextText()
         }
@@ -159,7 +158,7 @@ class AtomContentParser(httpClient: HttpClient, override val articleHtmlParser:
           if (link.isNullOrBlank() && (rel == ATTR_VALUE_ALTERNATE || rel.isNullOrBlank())) {
             link = href
           }
-          parser.nextTag()
+          parser.skipSubTree()
         }
         TAG_CONTENT,
         TAG_SUMMARY -> {
@@ -179,8 +178,17 @@ class AtomContentParser(httpClient: HttpClient, override val articleHtmlParser:
           }
         }
         TAG_ITUNES_IMAGE -> {
-          image = parser.getAttributeValue(parser.namespace, ATTR_HREF)
-          parser.nextTag()
+          val itunesImage = parser.getAttributeValue(parser.namespace, ATTR_HREF)
+          parser.skipSubTree()
+          if (image.isNullOrBlank()) {
+            image = itunesImage
+          }
+        }
+        in XmlFeedParser.imageTags -> {
+          val mediaImage = readMediaImageUrl(parser)
+          if (image.isNullOrBlank()) {
+            image = mediaImage
+          }
         }
         TAG_MEDIA_GROUP -> {
           val mediaGroupResult = readMediaGroup(parser)
```

**File**: `core/network/src/commonMain/kotlin/dev/sasikanth/rss/reader/core/network/parser/xml/RDFFeedParser.kt` (modified, +2/-4)
```diff
@@ -81,6 +81,7 @@ class RDFContentParser(override val articleHtmlParser: ArticleHtmlParser) : XmlC
       posts =
         postsFlow(
           parser = parser,
+          containerTag = XmlFeedParser.RDF_TAG,
           itemTag = TAG_RSS_ITEM,
           readItem = { readRssItem(it, UrlUtils.extractHost(link ?: feedUrl)) },
         ),
@@ -105,10 +106,7 @@ class RDFContentParser(override val articleHtmlParser: ArticleHtmlParser) : XmlC
     var date: String? = null
     var image: String? = null
 
-    while (parser.next() != EventType.END_TAG) {
-      if (parser.eventType != EventType.START_TAG) continue
-      val name = parser.name
-
+    forEachChildTag(parser, TAG_RSS_ITEM) { name ->
       when {
         name == TAG_TITLE -> {
           title = parser.nextText()
```

**File**: `core/network/src/commonMain/kotlin/dev/sasikanth/rss/reader/core/network/parser/xml/RssFeedParser.kt` (modified, +14/-17)
```diff
@@ -97,6 +97,7 @@ class RSSContentParser(override val articleHtmlParser: ArticleHtmlParser) : XmlC
         postsFlow(
           parser = parser,
           firstPost = firstPost,
+          containerTag = TAG_RSS_CHANNEL,
           itemTag = TAG_RSS_ITEM,
           readItem = { readRssItem(it, UrlUtils.extractHost(link ?: feedUrl)) },
         ),
@@ -137,10 +138,7 @@ class RSSContentParser(override val articleHtmlParser: ArticleHtmlParser) : XmlC
     var audioUrl: String? = null
     var commentsLink: String? = null
 
-    while (parser.next() != EventType.END_TAG) {
-      if (parser.eventType != EventType.START_TAG) continue
-      val name = parser.name
-
+    forEachChildTag(parser, TAG_RSS_ITEM) { name ->
       when {
         name == TAG_TITLE -> {
           title = parser.nextText()
@@ -164,7 +162,7 @@ class RSSContentParser(override val articleHtmlParser: ArticleHtmlParser) : XmlC
             image = enclosureUrl
           }
 
-          parser.nextTag()
+          parser.skipSubTree()
         }
         name == TAG_DESCRIPTION || name == TAG_CONTENT_ENCODED -> {
           val postContent = parsePostContent(parser)
@@ -177,13 +175,18 @@ class RSSContentParser(override val articleHtmlParser: ArticleHtmlParser) : XmlC
         name == TAG_PUB_DATE -> {
           date = parser.nextText()
         }
-        image.isNullOrBlank() && name == TAG_ITUNES_IMAGE -> {
-          image = parser.getAttributeValue(parser.namespace, XmlFeedParser.ATTR_HREF)
-          parser.nextTag()
+        name == TAG_ITUNES_IMAGE -> {
+          val itunesImage = parser.getAttributeValue(parser.namespace, XmlFeedParser.ATTR_HREF)
+          parser.skipSubTree()
+          if (image.isNullOrBlank()) {
+            image = itunesImage
+          }
         }
-        image.isNullOrBlank() && hasRssImageUrl(name, parser) -> {
-          image = parser.getAttributeValue(parser.namespace, ATTR_URL)
-          parser.nextTag()
+        name in XmlFeedParser.imageTags -> {
+          val mediaImage = readMediaImageUrl(parser)
+          if (image.isNullOrBlank()) {
+            image = mediaImage
+          }
         }
         image.isNullOrBlank() && name == TAG_FEATURED_IMAGE -> {
           image = parser.nextText()
@@ -212,10 +215,4 @@ class RSSContentParser(override val articleHtmlParser: ArticleHtmlParser) : XmlC
       hostLink = hostLink,
     )
   }
-
-  private fun hasRssImageUrl(name: String, parser: XmlPullParser) =
-    (XmlFeedParser.imageTags.contains(name) ||
-      (name == TAG_ENCLOSURE &&
-        parser.getAttributeValue(parser.namespace, ATTR_TYPE) == ATTR_VALUE_IMAGE)) &&
-      !parser.getAttributeValue(parser.namespace, ATTR_URL).isNullOrBlank()
 }
```

**File**: `core/network/src/commonMain/kotlin/dev/sasikanth/rss/reader/core/network/parser/xml/XmlContentParser.kt` (modified, +63/-11)
```diff
@@ -20,9 +20,10 @@ package dev.sasikanth.rss.reader.core.network.parser.xml
 import dev.sasikanth.rss.reader.core.model.remote.FeedPayload
 import dev.sasikanth.rss.reader.core.model.remote.PostPayload
 import dev.sasikanth.rss.reader.core.network.parser.common.ArticleHtmlParser
+import dev.sasikanth.rss.reader.core.network.parser.xml.XmlFeedParser.Companion.ATTR_URL
 import dev.sasikanth.rss.reader.core.network.parser.xml.XmlFeedParser.Companion.TAG_MEDIA_CONTENT
+import dev.sasikanth.rss.reader.core.network.parser.xml.XmlFeedParser.Companion.TAG_MEDIA_GROUP
 import dev.sasikanth.rss.reader.core.network.parser.xml.XmlFeedParser.Companion.TAG_MEDIA_THUMBNAIL
-import dev.sasikanth.rss.reader.core.network.parser.xml.XmlFeedParser.Companion.TAG_URL
 import dev.sasikanth.rss.reader.core.network.utils.UrlUtils
 import dev.sasikanth.rss.reader.util.dateStringToEpochMillis
 import dev.sasikanth.rss.reader.util.decodeHTMLString
@@ -41,17 +42,16 @@ abstract class XmlContentParser {
   protected fun postsFlow(
     parser: XmlPullParser,
     firstPost: PostPayload? = null,
+    containerTag: String,
     itemTag: String,
     readItem: (XmlPullParser) -> PostPayload?,
   ): Flow<PostPayload> = flow {
     if (firstPost != null) {
       emit(firstPost)
     }
 
-    while (parser.next() != EventType.END_TAG) {
-      if (parser.eventType != EventType.START_TAG) continue
-
-      if (parser.name == itemTag) {
+    forEachChildTag(parser, containerTag) { name ->
+      if (name == itemTag) {
         val post = readItem(parser)
         if (post != null) {
           emit(post)
@@ -62,6 +62,58 @@ abstract class XmlContentParser {
     }
   }
 
+  /**
+   * Loops over the direct children of the tag the parser is currently inside, stopping only at
+   * [containerTag]'s end tag. Bailing on any end tag would truncate the rest of the container when
+   * a single child leaves the parser misaligned.
+   */
+  protected inline fun forEachChildTag(
+    parser: XmlPullParser,
+    containerTag: String,
+    block: (String) -> Unit,
+  ) {
+    while (true) {
+      val eventType = parser.next()
+      if (eventType == EventType.END_DOCUMENT) return
+      if (eventType == EventType.END_TAG && parser.name == containerTag) return
+      if (eventType != EventType.START_TAG) continue
+
+      block(parser.name)
+    }
+  }
+
+  /**
+   * Reads a media image URL from either the `url` attribute or the element's text content, and
+   * consumes the whole element. Feeds like MyAnimeList put the URL in the text, and feeds like The
+   * Guardian nest `media:credit` inside `media:content`.
+   */
+  protected fun readMediaImageUrl(parser: XmlPullParser): String? {
+    val urlFromAttribute = parser.getAttributeValue(parser.namespace, ATTR_URL)
+    if (!urlFromAttribute.isNullOrBlank()) {
+      parser.skipSubTree()
+      return urlFromAttribute
+    }
+
+    return readTextContentAndSkipSubTree(parser)
+  }
+
+  protected fun readTextContentAndSkipSubTree(parser: XmlPullParser): String? {
+    var text: String? = null
+    var depth = 1
+
+    while (depth > 0) {
+      when (parser.next()) {
+        EventType.START_TAG -> depth++
+        EventType.END_TAG -> depth--
+        EventType.TEXT -> if (depth == 1 && text.isNullOrBlank()) text = parser.text
+        EventType.END_DOCUMENT -> break
+        else -> {}
+      }
+    }
+
+    return text?.trim()?.ifBlank { null }
+  }
+
   protected fun createFeedPayload(
     name: String?,
     description: String?,
@@ -104,13 +156,13 @@ abstract class XmlContentParser {
     var image: String? = null
     var description: String? = null
 
-    while (parser.next() != EventType.END_TAG) {
-      if (parser.eventType != EventType.START_TAG) continue
-
-      when (parser.name) {
+    forEachChildTag(parser, TAG_MEDIA_GROUP) { name ->
+      when (name) {
         TAG_MEDIA_THUMBNAIL -> {
-          image = parser.getAttributeValue(parser.namespace, TAG_URL)
-          parser.nextTag()
+          val imageUrl = readMediaImageUrl(parser)
+          if (image.isNullOrBlank()) {
+            image = imageUrl
+          }
         }
         TAG_MEDIA_CONTENT -> {
           description = parser.nextText()
```

**File**: `core/network/src/commonTest/kotlin/dev/sasikanth/rss/reader/core/network/parser/XmlFeedParserTest.kt` (modified, +67/-0)
```diff
@@ -33,6 +33,7 @@ import dev.sasikanth.rss.reader.core.network.utils.podcastRssFeedUrl
 import dev.sasikanth.rss.reader.core.network.utils.podcastRssXmlContent
 import dev.sasikanth.rss.reader.core.network.utils.rdfXmlContent
 import dev.sasikanth.rss.reader.core.network.utils.rssXmlContent
+import dev.sasikanth.rss.reader.core.network.utils.rssXmlContentWithNestedMediaInFirstItem
 import dev.sasikanth.rss.reader.core.network.utils.youtubeAtomFeed
 import dev.sasikanth.rss.reader.core.network.utils.youtubeChannelHtml
 import dev.sasikanth.rss.reader.core.network.utils.youtubeFeedUrl
@@ -279,6 +280,60 @@ class XmlFeedParserTest {
                 isDateParsedCorrectly = true,
                 audioUrl = null,
               ),
+              PostPayload(
+                title = "Post with nested media content",
+                link = "https://example.com/post-with-nested-media-content",
+                description = "Nested media content description.",
+                rawContent =
+                  """
+                  <html>
+                   <body>Nested media content description.</body>
+                  </html>
+                  """
+                    .trimIndent(),
+                fullContent = null,
+                imageUrl = "https://example.com/media/nested-media-content",
+                date = 1685005200000,
+                commentsLink = null,
+                isDateParsedCorrectly = true,
+                audioUrl = null,
+              ),
+              PostPayload(
+                title = "Post with media thumbnail as text",
+                link = "https://example.com/post-with-media-thumbnail-text",
+                description = "Media thumbnail text description.",
+                rawContent =
+                  """
+                  <html>
+                   <body>Media thumbnail text description.</body>
+                  </html>
+                  """
+                    .trimIndent(),
+                fullContent = null,
+                imageUrl = "https://example.com/media/thumbnail-as-text",
+                date = 1685005200000,
+                commentsLink = null,
+                isDateParsedCorrectly = true,
+                audioUrl = null,
+              ),
+              PostPayload(
+                title = "Post after nested media content",
+                link = "https://example.com/post-after-nested-media-content",
+                description = "Post after nested media content description.",
+                rawContent =
+                  """
+                  <html>
+                   <body>Post after nested media content description.</body>
+                  </html>
+                  """
+                    .trimIndent(),
+                fullContent = null,
+                imageUrl = null,
+                date = 1685005200000,
+                commentsLink = null,
+                isDateParsedCorrectly = true,
+                audioUrl = null,
+              ),
             )
             .asFlow(),
       )
@@ -291,6 +346,18 @@ class XmlFeedParserTest {
     assertFeedPayloadEquals(expectedFeedPayload, payload)
   }
 
+  @Test
+  fun parsingRssFeedWithNestedMediaContentShouldNotTruncateItems() = runTest {
+    // when
+    val content = ByteReadChannel(rssXmlContentWithNestedMediaInFirstItem.toByteArray())
+    val payload = xmlFeedParser.parse(content, feedUrl, Charsets.UTF8)
+    val posts = payload.posts.toList()
+
+    // then
+    assertEquals(listOf("First post", "Second post", "Third post"), posts.map { it.title })
+    assertEquals("https://example.com/media/first-post-140", posts.first().imageUrl)
+  }
+
   @Test
   fun parsingRDFFeedShouldWorkCorrectly() = runTest {
     // given
```

**File**: `core/network/src/commonTest/kotlin/dev/sasikanth/rss/reader/core/network/utils/TestData.kt` (modified, +60/-0)
```diff
@@ -92,6 +92,66 @@ const val rssXmlContent =
         <media:thumbnail url="https://example.com/media/maxresdefault.jpg" />
     </media:group>
     </item>
+    <item>
+      <title>Post with nested media content</title>
+      <link>https://example.com/post-with-nested-media-content</link>
+      <description>Nested media content description.</description>
+      <pubDate>Thu, 25 May 2023 09:00:00 +0000</pubDate>
+      <media:content url="https://example.com/media/nested-media-content" type="image/jpeg" medium="image">
+        <media:thumbnail url="https://example.com/media/nested-media-thumbnail" />
+        <media:credit scheme="urn:ebu">Example Credit</media:credit>
+      </media:content>
+    </item>
+    <item>
+      <title>Post with media thumbnail as text</title>
+      <link>https://example.com/post-with-media-thumbnail-text</link>
+      <description>Media thumbnail text description.</description>
+      <media:thumbnail>https://example.com/media/thumbnail-as-text</media:thumbnail>
+      <pubDate>Thu, 25 May 2023 09:00:00 +0000</pubDate>
+    </item>
+    <item>
+      <title>Post after nested media content</title>
+      <link>https://example.com/post-after-nested-media-content</link>
+      <description>Post after nested media content description.</description>
+      <pubDate>Thu, 25 May 2023 09:00:00 +0000</pubDate>
+    </item>
+  </channel>
+  </rss>
+  """
+
+// Shape used by The Guardian and Ars Technica: the very first item carries a `media:content`
+// element with nested children.
+const val rssXmlContentWithNestedMediaInFirstItem =
+  """<?xml version="1.0" encoding="UTF-8"?>
+  <rss version="2.0">
+  <channel>
+    <title>Feed title</title>
+    <link>https://example.com</link>
+    <description>Feed description</description>
+    <item>
+      <title>First post</title>
+      <link>https://example.com/first-post</link>
+      <description>First post description.</description>
+      <pubDate>Thu, 25 May 2023 09:00:00 +0000</pubDate>
+      <media:content width="140" url="https://example.com/media/first-post-140">
+        <media:credit scheme="urn:ebu">Photograph: Example</media:credit>
+      </media:content>
+      <media:content width="460" url="https://example.com/media/first-post-460">
+        <media:credit scheme="urn:ebu">Photograph: Example</media:credit>
+      </media:content>
+    </item>
+    <item>
+      <title>Second post</title>
+      <link>https://example.com/second-post</link>
+      <description>Second post description.</description>
+      <pubDate>Thu, 25 May 2023 09:00:00 +0000</pubDate>
+    </item>
+    <item>
+      <title>Third post</title>
+      <link>https://example.com/third-post</link>
+      <description>Third post description.</description>
+      <pubDate>Thu, 25 May 2023 09:00:00 +0000</pubDate>
+    </item>
   </channel>
   </rss>
   """
```

---

### Incident Patch 11: `11923bdb` (2026-08-20)
**Commit Message**: Improve UI gradients and scrims with smoother transitions

- Introduce `smoothVerticalFade` utility using a smootherstep curve for more natural transparency transitions.
- Update `HomeTopAppBar` to use smooth fades, increase fade height, and allow full opacity.
- Refactor `ReaderPage` to include scroll-aware top and bottom scrims using the new fade utility.
- Remove static scrim overlays from `ReaderScreen` in favor of the per-page implementation in `ReaderPage`.

**File**: `shared/src/commonMain/kotlin/dev/sasikanth/rss/reader/home/ui/HomeTopAppBar.kt` (modified, +7/-8)
```diff
@@ -48,7 +48,6 @@ import androidx.compose.runtime.remember
 import androidx.compose.runtime.setValue
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.draw.drawBehind
-import androidx.compose.ui.graphics.Brush
 import androidx.compose.ui.graphics.Color
 import androidx.compose.ui.platform.LocalDensity
 import androidx.compose.ui.unit.dp
@@ -63,6 +62,7 @@ import dev.sasikanth.rss.reader.resources.icons.MarkAllAsRead
 import dev.sasikanth.rss.reader.resources.icons.Menu
 import dev.sasikanth.rss.reader.resources.icons.TwineIcons
 import dev.sasikanth.rss.reader.ui.AppTheme
+import dev.sasikanth.rss.reader.utils.smoothVerticalFade
 import org.jetbrains.compose.resources.stringResource
 import twine.shared.generated.resources.Res
 import twine.shared.generated.resources.appBarAllFeeds
@@ -96,17 +96,17 @@ internal fun HomeTopAppBar(
     remember(listState) {
       {
         if (listState.firstVisibleItemIndex == 0) {
-          (listState.firstVisibleItemScrollOffset / APP_BAR_OPAQUE_THRESHOLD).coerceIn(0f, 0.9f)
+          (listState.firstVisibleItemScrollOffset / APP_BAR_OPAQUE_THRESHOLD).coerceIn(0f, 1f)
         } else {
-          0.9f
+          1f
         }
       }
     }
   var hasUnreadPosts by remember(hasUnreadPosts) { mutableStateOf(hasUnreadPosts) }
   var showConfirmDialog by remember { mutableStateOf(false) }
 
   val backgroundColor = AppTheme.colorScheme.backdrop
-  val gradientFadeHeight = with(LocalDensity.current) { 40.dp.toPx() }
+  val gradientFadeHeight = with(LocalDensity.current) { 72.dp.toPx() }
   TopAppBar(
     modifier =
       modifier.drawBehind {
@@ -115,11 +115,10 @@ internal fun HomeTopAppBar(
         val gradientHeight = size.height + gradientFadeHeight
         drawRect(
           brush =
-            Brush.verticalGradient(
-              0f to backgroundColor,
-              size.height / gradientHeight to backgroundColor,
-              1f to Color.Transparent,
+            smoothVerticalFade(
+              color = backgroundColor,
               endY = gradientHeight,
+              solidFraction = size.height / gradientHeight,
             ),
           size = size.copy(height = gradientHeight),
           alpha = backgroundAlphaProvider(),
```

**File**: `shared/src/commonMain/kotlin/dev/sasikanth/rss/reader/reader/page/ui/ReaderPage.kt` (modified, +53/-1)
```diff
@@ -24,6 +24,7 @@ import androidx.compose.foundation.layout.fillMaxWidth
 import androidx.compose.foundation.layout.padding
 import androidx.compose.foundation.lazy.LazyColumn
 import androidx.compose.foundation.lazy.items
+import androidx.compose.foundation.lazy.rememberLazyListState
 import androidx.compose.foundation.pager.PagerState
 import androidx.compose.foundation.pager.rememberPagerState
 import androidx.compose.foundation.text.selection.DisableSelection
@@ -35,9 +36,13 @@ import androidx.compose.material3.MaterialTheme
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.CompositionLocalProvider
 import androidx.compose.runtime.getValue
+import androidx.compose.runtime.remember
 import androidx.compose.runtime.rememberCoroutineScope
 import androidx.compose.ui.Alignment
 import androidx.compose.ui.Modifier
+import androidx.compose.ui.draw.drawWithContent
+import androidx.compose.ui.geometry.Offset
+import androidx.compose.ui.platform.LocalDensity
 import androidx.compose.ui.text.TextLinkStyles
 import androidx.compose.ui.text.font.FontWeight
 import androidx.compose.ui.text.style.TextDecoration
@@ -75,11 +80,14 @@ import dev.sasikanth.rss.reader.reader.ui.LocalOnImageClick
 import dev.sasikanth.rss.reader.share.LocalShareHandler
 import dev.sasikanth.rss.reader.ui.AppTheme
 import dev.sasikanth.rss.reader.utils.LocalBlockImage
+import dev.sasikanth.rss.reader.utils.smoothVerticalFade
 import kotlin.time.Instant
 import kotlinx.coroutines.launch
 import org.intellij.markdown.MarkdownElementTypes
 import org.intellij.markdown.ast.ASTNode
 
+private const val TOP_SCRIM_OPAQUE_THRESHOLD = 200f
+
 @Composable
 internal fun ReaderPage(
   pageViewModel: ReaderPageViewModel,
@@ -150,6 +158,23 @@ private fun ReaderPageContent(
 
   val coroutineScope = rememberCoroutineScope()
 
+  val listState = rememberLazyListState()
+  val backdropColor = AppTheme.colorScheme.backdrop
+  val density = LocalDensity.current
+  val topScrimSolidPx = with(density) { contentPaddingValues.calculateTopPadding().toPx() }
+  val topScrimFadePx = with(density) { 72.dp.toPx() }
+  val bottomScrimHeightPx = with(density) { 96.dp.toPx() }
+  val topScrimAlphaProvider =
+    remember(listState) {
+      {
+        if (listState.firstVisibleItemIndex == 0) {
+          (listState.firstVisibleItemScrollOffset / TOP_SCRIM_OPAQUE_THRESHOLD).coerceIn(0f, 1f)
+        } else {
+          1f
+        }
+      }
+    }
+
   val textSelectionColors =
     TextSelectionColors(
       handleColor = AppTheme.colorScheme.primary,
@@ -202,7 +227,34 @@ private fun ReaderPageContent(
             ),
         ) {
           LazyColumn(
-            modifier = Modifier.fillMaxSize(),
+            modifier =
+              Modifier.fillMaxSize().drawWithContent {
+                drawContent()
+
+                val topScrimHeight = topScrimSolidPx + topScrimFadePx
+                drawRect(
+                  brush =
+                    smoothVerticalFade(
+                      color = backdropColor,
+                      endY = topScrimHeight,
+                      solidFraction = topScrimSolidPx / topScrimHeight,
+                    ),
+                  size = size.copy(height = topScrimHeight),
+                  alpha = topScrimAlphaProvider(),
+                )
+                drawRect(
+                  brush =
+                    smoothVerticalFade(
+                      color = backdropColor,
+                      startY = size.height - bottomScrimHeightPx,
+                      endY = size.height,
+                      reversed = true,
+                    ),
+                  topLeft = Offset(0f, size.height - bottomScrimHeightPx),
+                  size = size.copy(height = bottomScrimHeightPx),
+                )
+              },
+            state = listState,
             overscrollEffect = null,
             contentPadding =
               PaddingValues(
```

**File**: `shared/src/commonMain/kotlin/dev/sasikanth/rss/reader/reader/ui/ReaderScreen.kt` (modified, +1/-23)
```diff
@@ -76,7 +76,6 @@ import androidx.compose.ui.draw.dropShadow
 import androidx.compose.ui.focus.FocusRequester
 import androidx.compose.ui.focus.focusRequester
 import androidx.compose.ui.geometry.Offset
-import androidx.compose.ui.graphics.Brush
 import androidx.compose.ui.graphics.Color
 import androidx.compose.ui.graphics.drawOutline
 import androidx.compose.ui.graphics.drawscope.Stroke
@@ -512,33 +511,12 @@ internal fun ReaderScreen(
               bottom = readerActionsPanelBottomInset() + READER_ACTIONS_PANEL_COLLAPSED_HEIGHT,
             )
 
-          val backdropColor = AppTheme.colorScheme.backdrop
-          val scrimHeightPx = with(LocalDensity.current) { 96.dp.toPx() }
           HorizontalPager(
             modifier =
               Modifier.widthIn(max = readerContentMaxWidth)
                 .fillMaxSize()
                 .align(Alignment.Center)
-                .iosBottomSafeAreaPadding()
-                .drawWithContent {
-                  drawContent()
-                  drawRect(
-                    brush =
-                      Brush.verticalGradient(
-                        colors = listOf(backdropColor, Color.Transparent),
-                        startY = 0f,
-                        endY = scrimHeightPx,
-                      )
-                  )
-                  drawRect(
-                    brush =
-                      Brush.verticalGradient(
-                        colors = listOf(Color.Transparent, backdropColor),
-                        startY = size.height - scrimHeightPx,
-                        endY = size.height,
-                      )
-                  )
-                },
+                .iosBottomSafeAreaPadding(),
             state = pagerState,
             overscrollEffect = null,
             beyondViewportPageCount = 1,
```

**File**: `shared/src/commonMain/kotlin/dev/sasikanth/rss/reader/utils/GradientExt.kt` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+/*
+ * Copyright 2026 Sasikanth Miriyampalli
+ *
+ * Licensed under the GPL, Version 3.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     https://www.gnu.org/licenses/gpl-3.0.en.html
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ *
+ */
+
+package dev.sasikanth.rss.reader.utils
+
+import androidx.compose.ui.graphics.Brush
+import androidx.compose.ui.graphics.Color
+
+private const val FADE_STOPS = 12
+
+/**
+ * Vertical fade from [color] to transparent whose alpha follows a smootherstep curve instead of a
+ * straight line. The curve is flat at both ends, so neither the opaque edge nor the transparent
+ * edge shows the crease a linear ramp leaves behind.
+ *
+ * [solidFraction] keeps the first portion of the gradient fully opaque before the fade starts.
+ */
+fun smoothVerticalFade(
+  color: Color,
+  startY: Float = 0f,
+  endY: Float,
+  solidFraction: Float = 0f,
+  reversed: Boolean = false,
+): Brush {
+  val clampedSolid = solidFraction.coerceIn(0f, 1f)
+  val fadeSpan = 1f - clampedSolid
+  val stops = ArrayList<Pair<Float, Color>>(FADE_STOPS + 1)
+
+  if (clampedSolid > 0f) {
+    stops.add(0f to color)
+  }
+
+  for (step in 0..FADE_STOPS) {
+    val t = step / FADE_STOPS.toFloat()
+    stops.add((clampedSolid + (t * fadeSpan)) to color.copy(alpha = 1f - smootherStep(t)))
+  }
+
+  val orderedStops =
+    if (reversed) {
+      stops.map { (position, stopColor) -> (1f - position) to stopColor }.asReversed()
+    } else {
+      stops
+    }
+
+  return Brush.verticalGradient(
+    colorStops = orderedStops.toTypedArray(),
+    startY = startY,
+    endY = endY,
+  )
+}
+
+private fun smootherStep(t: Float): Float = t * t * t * (t * (t * 6f - 15f) + 10f)
```

---

### Incident Patch 12: `ab98a80e` (2026-07-21)
**Commit Message**: Add BazQux to integrations list on landing page

**File**: `index.html` (modified, +1/-0)
```diff
@@ -349,6 +349,7 @@ <h3>Bring your own sync</h3>
             <circle cx="12" cy="12" r="2.1" fill="#3465A4"/>
           </svg>FreshRSS</span>
           <span class="pill"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="5" fill="currentColor"/><path d="M5.5 17.5V7.5l3 4.5h1l3-4.5v10" fill="none" stroke="var(--bg)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 -0.5)"/></svg>Miniflux</span>
+          <span class="pill"><svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M5.25 0L18.75 0C21.65 0 24 2.35 24 5.25L24 18.75C24 21.65 21.65 24 18.75 24L5.25 24C2.35 24 0 21.65 0 18.75L0 5.25C0 2.35 2.35 0 5.25 0ZM19.175 18.25L14.383 18.25Q13.141 16.347 12.317 15.22Q11.493 14.092 10.269 12.612L9.785 12.612L9.785 16.409Q9.785 16.726 9.903 16.946Q10.022 17.166 10.357 17.316Q10.524 17.387 10.881 17.462Q11.238 17.536 11.493 17.563L11.493 18.25L4.825 18.25L4.825 17.563Q5.081 17.536 5.499 17.488Q5.917 17.44 6.094 17.369Q6.428 17.228 6.543 17.012Q6.657 16.797 6.657 16.462L6.657 7.644Q6.657 7.327 6.56 7.115Q6.464 6.904 6.094 6.745Q5.812 6.631 5.428 6.552Q5.045 6.472 4.825 6.437L4.825 5.75L11.837 5.75Q14.189 5.75 15.409 6.486Q16.629 7.221 16.629 8.71Q16.629 10.022 15.876 10.82Q15.123 11.617 13.581 12.066Q14.18 12.841 14.977 13.863Q15.775 14.885 16.638 15.951Q16.911 16.294 17.382 16.792Q17.854 17.29 18.215 17.404Q18.417 17.466 18.73 17.51Q19.043 17.554 19.175 17.563ZM13.176 8.956Q13.176 7.706 12.476 7.129Q11.775 6.552 10.48 6.552L9.785 6.552L9.785 11.784L10.454 11.784Q11.749 11.784 12.462 11.106Q13.176 10.428 13.176 8.956Z"/></svg>BazQux</span>
           <span class="pill"><svg viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg"><path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066DA"/><path d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="#00AC47"/><path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75L86.1 57.5c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z" fill="#EA4335"/><path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" fill="#00832D"/><path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684FC"/><path d="M73.4 26.5l-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#FFBA00"/></svg>Google Drive</span>
           <span class="pill"><svg viewBox="0 0 24 24" fill="#0061FF" xmlns="http://www.w3.org/2000/svg"><path d="M6 2l6 3.75L6 9.5 0 5.75 6 2zm12 0l6 3.75-6 3.75-6-3.75L18 2zM0 13.25L6 9.5l6 3.75L6 17l-6-3.75zM18 9.5l6 3.75L18 17l-6-3.75 6-3.75zM6 18.25l6-3.75 6 3.75L12 22l-6-3.75z"/></svg>Dropbox</span>
         </div>
```

---

### Incident Patch 13: `ca4d0559` (2026-07-21)
**Commit Message**: Refactor add feed screen layout and group selection UI

Replaces LazyVerticalGrid with LazyColumn, uses SettingItem for feed options, and updates group selection to handle a single group layout.

**File**: `shared/src/commonMain/kotlin/dev/sasikanth/rss/reader/addfeed/ui/AddFeedScreen.kt` (modified, +50/-58)
```diff
@@ -24,7 +24,6 @@ import androidx.compose.foundation.layout.Arrangement
 import androidx.compose.foundation.layout.Box
 import androidx.compose.foundation.layout.Column
 import androidx.compose.foundation.layout.PaddingValues
-import androidx.compose.foundation.layout.Row
 import androidx.compose.foundation.layout.Spacer
 import androidx.compose.foundation.layout.WindowInsets
 import androidx.compose.foundation.layout.fillMaxSize
@@ -36,10 +35,7 @@ import androidx.compose.foundation.layout.requiredHeight
 import androidx.compose.foundation.layout.requiredSize
 import androidx.compose.foundation.layout.systemBars
 import androidx.compose.foundation.layout.widthIn
-import androidx.compose.foundation.lazy.grid.GridCells
-import androidx.compose.foundation.lazy.grid.GridItemSpan
-import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
-import androidx.compose.foundation.lazy.grid.items
+import androidx.compose.foundation.lazy.LazyColumn
 import androidx.compose.foundation.shape.CircleShape
 import androidx.compose.foundation.text.KeyboardOptions
 import androidx.compose.material3.ButtonDefaults
@@ -96,6 +92,7 @@ import dev.sasikanth.rss.reader.resources.icons.Close
 import dev.sasikanth.rss.reader.resources.icons.NewGroup
 import dev.sasikanth.rss.reader.resources.icons.Newsstand
 import dev.sasikanth.rss.reader.resources.icons.TwineIcons
+import dev.sasikanth.rss.reader.settings.ui.items.SettingItem
 import dev.sasikanth.rss.reader.ui.AppTheme
 import dev.sasikanth.rss.reader.utils.Constants
 import dev.sasikanth.rss.reader.utils.LocalInAppRating
@@ -272,17 +269,15 @@ private fun AddFeedContent(
     },
     content = { paddingValues ->
       Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
-        LazyVerticalGrid(
+        LazyColumn(
           modifier =
             Modifier.widthIn(max = maxContentWidth).fillMaxSize().padding(horizontal = 24.dp),
-          columns = GridCells.Adaptive(minSize = 64.dp),
           contentPadding = paddingValues,
-          horizontalArrangement = Arrangement.spacedBy(8.dp),
           verticalArrangement = Arrangement.spacedBy(16.dp),
         ) {
-          item(span = { GridItemSpan(maxLineSpan) }) { Spacer(Modifier.requiredHeight(16.dp)) }
+          item { Spacer(Modifier.requiredHeight(16.dp)) }
 
-          item(span = { GridItemSpan(maxLineSpan) }) {
+          item {
             TextField(
               modifier =
                 Modifier.fillMaxWidth().focusRequester(feedLinkFocus).focusProperties {
@@ -300,7 +295,7 @@ private fun AddFeedContent(
             )
           }
 
-          item(span = { GridItemSpan(maxLineSpan) }) {
+          item {
             TextField(
               modifier =
                 Modifier.fillMaxWidth().focusRequester(feedTitleFocus).focusProperties {
@@ -318,30 +313,44 @@ private fun AddFeedContent(
             )
           }
 
-          item(span = { GridItemSpan(maxLineSpan) }) {
+          item {
             Column {
               HorizontalDivider(
                 modifier = Modifier.padding(vertical = 12.dp).ignoreHorizontalParentPadding(24.dp),
                 color = AppTheme.colorScheme.outlineVariant,
               )
 
-              FeedOptionSwitch(
+              SettingItem(
                 modifier = Modifier.ignoreHorizontalParentPadding(24.dp),
                 title = stringResource(Res.string.alwaysFetchSourceArticle),
-                checked = state.alwaysFetchSourceArticle,
-                onValueChanged = { newValue ->
-                  dispatch(AddFeedEvent.OnAlwaysFetchSourceArticleChanged(newValue))
+                action = {
+                  Switch(
+                    checked = state.alwaysFetchSourceArticle,
+                    onCheckedChange = {
+                      dispatch(AddFeedEvent.OnAlwaysFetchSourceArticleChanged(it))
+                    },
+                  )
+                },
+                onClick = {
+                  dispatch(
+                    AddFeedEvent.OnAlwaysFetchSourceArticleChanged(!state.alwaysFetchSourceArticle)
+                  )
                 },
               )
 
               HorizontalDivider(color = AppTheme.colorScheme.outlineVariant)
 
-              FeedOptionSwitch(
+              SettingItem(
                 modifier = Modifier.ignoreHorizontalParentPadding(24.dp),
                 title = stringResource(Res.string.showFeedFavIconTitle),
-                checked = state.showFeedFavIcon,
-                onValueChanged = { newValue ->
-                  dispatch(AddFeedEvent.OnShowFeedFavIconChanged(newValue))
+                action = {
+                  Switch(
+                    checked = state.showFeedFavIcon,
+                    onCheckedChange = { dispatch(AddFeedEvent.OnShowFeedFavIconChanged(it)) },
+                  )
+                },
+                onClick = {
+                  dispatch(AddFeedEvent.OnShowFeedFavIconChanged(!state.showFeedFavIcon))
                 },
```

---

### Incident Patch 14: `ebcb129a` (2026-07-21)
**Commit Message**: Fix JVM readability parser crash on pages with iframe tags

Neutralize iframe tags before parsing to prevent HtmlUnit from throwing NPE on windowless documents, and fall back to raw content if parsing fails.

**File**: `shared/src/commonMain/composeResources/files/reader/main.es5.js` (modified, +40/-19)
```diff
@@ -19,19 +19,46 @@ var JUNK_SELECTORS = [
 ].join(",");
 
 
-function processIFrames(doc) {
-  var iframes = doc.querySelectorAll("iframe");
+// HtmlUnit's DOMParser builds a windowless document (enclosing window is
+// explicitly null), but it still tries to construct a live FrameWindow the
+// moment it parses a real <iframe>/<frame> tag, which NPEs on the null
+// parent window - and the same crash happens later if a real iframe tag is
+// created any other way (e.g. Readability's own iframe handling), since the
+// window stays null for the document's whole lifetime. Renaming the tag
+// before parsing keeps HtmlUnit from ever recognizing it as a frame element.
+var IFRAME_TAG = "twine-iframe";
+
+function neutralizeIframeTags(html) {
+  return html.replace(/<(\/?)i?frame\b/gi, "<$1" + IFRAME_TAG);
+}
+
+/**
+ * Renamed iframe tags are opaque to Readability's own iframe handling (which
+ * expects real "iframe" elements), so swap each one for a plain link before
+ * Readability runs. This also means the result survives Readability's content
+ * scoring like any other link, instead of relying on iframe-specific rules.
+ */
+function replaceIframesWithLinks(doc) {
+  var iframes = doc.querySelectorAll(IFRAME_TAG);
   for (var i = 0; i < iframes.length; i++) {
     var iframe = iframes[i];
-    var src = iframe.getAttribute("src");
-    var lazySrc =
+    var src =
+      iframe.getAttribute("src") ||
       iframe.getAttribute("data-src") ||
       iframe.getAttribute("data-runner-src") ||
       iframe.getAttribute("data-lazy-src");
 
-    if (!src && lazySrc) {
-      iframe.src = lazySrc;
+    if (!src) {
+      iframe.remove();
+      continue;
     }
+
+    var label = src.includes("youtube.com") ? "YouTube Video" : "Video";
+    var link = doc.createElement("a");
+    link.setAttribute("href", src);
+    link.textContent = label;
+
+    iframe.parentNode.replaceChild(link, iframe);
   }
 }
 
@@ -431,26 +458,17 @@ function getImageCaption(markdown) {
 function parseReaderContent(link, bannerImage, html) {
   return new Promise(function(resolve, reject) {
       try {
+        var safeHtml = neutralizeIframeTags(html);
         var parser = new DOMParser();
         var doc = parser.parseFromString(
-          "<html><head><base href=\"" + link + "\"></head><body>" + html + "</body></html>",
+          "<html><head><base href=\"" + link + "\"></head><body>" + safeHtml + "</body></html>",
           "text/html"
         );
         var turndownService = new TurndownService({
             headingStyle: 'atx',
             codeBlockStyle: 'fenced'
         });
 
-        turndownService.addRule("iframe", {
-          filter: "iframe",
-          replacement: function(content, node) {
-            var src = node.getAttribute("src") || node.getAttribute("data-src");
-            if (!src) return "";
-            var label = src.includes("youtube.com") ? "YouTube Video" : "Video";
-            return "\n\n[" + label + "](" + src + ")\n\n";
-          }
-        });
-
         turndownService.addRule("image", {
           filter: "img",
           replacement: function(content, node) {
@@ -499,7 +517,7 @@ function parseReaderContent(link, bannerImage, html) {
 
         removeFirstH1(doc);
         stripAriaHidden(doc);
-        processIFrames(doc);
+        replaceIframesWithLinks(doc);
         processNoScriptImages(doc);
         transformShredditElements(doc);
         removeFirstImageTagByUrl(doc, bannerImage);
@@ -537,8 +555,11 @@ function parseReaderContent(link, bannerImage, html) {
         console.error("Reader Error:", error);
         // Never surface error text as article content; fall back to a plain
         // conversion of the original HTML, or nothing if even that fails.
+        // Turndown parses string input through the same DOMParser, so this
+        // must use the iframe-neutralized HTML too, or it can hit the exact
+        // crash it's trying to recover from.
         try {
-          resolve({ content: turndownService.turndown(html), excerpt: null });
+          resolve({ content: turndownService.turndown(safeHtml || neutralizeIframeTags(html)), excerpt: null });
         } catch (fallbackError) {
           resolve({ content: null, excerpt: null });
         }
```

**File**: `shared/src/jvmMain/kotlin/dev/sasikanth/rss/reader/reader/readability/ReadabilityRunner.kt` (modified, +62/-41)
```diff
@@ -17,6 +17,7 @@
 
 package dev.sasikanth.rss.reader.reader.readability
 
+import co.touchlab.kermit.Logger
 import dev.sasikanth.rss.reader.core.model.local.ReadabilityResult
 import dev.sasikanth.rss.reader.di.scopes.AppScope
 import dev.sasikanth.rss.reader.reader.redability.ReadabilityRunner
@@ -48,30 +49,50 @@ class HtmlReadabilityRunner(private val dispatchersProvider: DispatchersProvider
     image: String?,
   ): ReadabilityResult =
     withContext(dispatchersProvider.io) {
-      // Use CHROME as it is generally the most compatible, but Rhino is the engine.
-      WebClient(BrowserVersion.CHROME).use { webClient ->
-        webClient.options.isCssEnabled = false
-        webClient.options.isDownloadImages = false
-        webClient.options.isGeolocationEnabled = false
-        // We want to catch errors to know if our ES5 transpilation failed
-        webClient.options.isThrowExceptionOnScriptError = true
-        webClient.options.isThrowExceptionOnFailingStatusCode = false
-
-        val htmlShell = ReaderHTML.createOrGet()
-        val page: HtmlPage = webClient.loadHtmlCodeIntoCurrentWindow(htmlShell)
-
-        val script =
-          """
+      try {
+        parseHtmlOrThrow(link, content, image)
+      } catch (e: Exception) {
+        // HtmlUnit is a best-effort HTML engine, not a real browser: it can throw on
+        // content it can't model correctly (e.g. it NPEs building a live frame window
+        // for <iframe> tags parsed into a windowless document). Never let a parsing
+        // quirk take down the reader — show the original content instead.
+        Logger.e(e) { "Failed to run readability pipeline, falling back to raw content" }
+        ReadabilityResult(content = content)
+      }
+    }
+
+  private suspend fun parseHtmlOrThrow(
+    link: String?,
+    content: String,
+    image: String?,
+  ): ReadabilityResult {
+    // Fetch the shell HTML before opening the WebClient so no suspension point
+    // (and potential dispatcher thread hop) happens while the client/page is live.
+    val htmlShell = ReaderHTML.createOrGet()
+
+    // Use CHROME as it is generally the most compatible, but Rhino is the engine.
+    WebClient(BrowserVersion.CHROME).use { webClient ->
+      webClient.options.isCssEnabled = false
+      webClient.options.isDownloadImages = false
+      webClient.options.isGeolocationEnabled = false
+      // We want to catch errors to know if our ES5 transpilation failed
+      webClient.options.isThrowExceptionOnScriptError = true
+      webClient.options.isThrowExceptionOnFailingStatusCode = false
+
+      val page: HtmlPage = webClient.loadHtmlCodeIntoCurrentWindow(htmlShell)
+
+      val script =
+        """
         var parsingResult = null;
         var parsingError = null;
-        
+
         if (typeof parseReaderContent === 'undefined') {
           parsingError = "parseReaderContent is undefined. Scripts not loaded?";
         } else {
           try {
             parseReaderContent(
-              ${link.asJSString}, 
-              ${image.asJSString}, 
+              ${link.asJSString},
+              ${image.asJSString},
               ${content.asJSString}
             ).then(function(res) {
               parsingResult = JSON.stringify(res);
@@ -83,38 +104,38 @@ class HtmlReadabilityRunner(private val dispatchersProvider: DispatchersProvider
           }
         }
       """
-            .trimIndent()
-
-        try {
-          page.executeJavaScript(script)
-        } catch (e: Exception) {
-          throw RuntimeException("Failed to execute initial script: ${e.message}", e)
-        }
+          .trimIndent()
 
-        // Wait for result
-        val maxRetries = 100 // 10 seconds
-        var result: String? = null
+      try {
+        page.executeJavaScript(script)
+      } catch (e: Exception) {
+        throw RuntimeException("Failed to execute initial script: ${e.message}", e)
+      }
 
-        for (i in 0 until maxRetries) {
-          webClient.waitForBackgroundJavaScript(100)
+      // Wait for result
+      val maxRetries = 100 // 10 seconds
+      var result: String? = null
 
-          val errorObj = page.executeJavaScript("parsingError").javaScriptResult
-          if (errorObj != null && errorObj != Undefined.instance) {
-            throw RuntimeException("JS parsing failed: ${errorObj}")
-          }
+      for (i in 0 until maxRetries) {
+        webClient.waitForBackgroundJavaScript(100)
 
-          val resultObj = page.executeJavaScript("parsingResult").javaScriptResult
-          if (resultObj != null && resultObj != Undefined.instance) {
-            result = resultObj.toString()
-            break
-          }
+        val errorObj = page.executeJavaScript("parsingError").javaScriptResult
+        if (errorObj != null && errorObj != Undefined.instance) {
+          throw RuntimeException("JS parsing failed: ${errorObj}")
         }
 
-        if (result == null) {
-          throw RuntimeException("Timeout
```

---

### Incident Patch 15: `c28d793c` (2026-07-20)
**Commit Message**: Add BazQux cloud sync integration

Introduces BazQux sync provider using the Google Reader API endpoints (reusing FreshRSS coordinator logic). Adds login screen, view models, resources, settings screen items, and navigation rules.

**File**: `core/data/src/commonMain/kotlin/dev/sasikanth/rss/reader/data/di/DataComponent.kt` (modified, +3/-0)
```diff
@@ -39,6 +39,7 @@ import dev.sasikanth.rss.reader.data.sync.auth.OAuthManager
 import dev.sasikanth.rss.reader.data.sync.auth.OAuthTokenProvider
 import dev.sasikanth.rss.reader.data.sync.auth.RealOAuthManager
 import dev.sasikanth.rss.reader.data.sync.auth.RealOAuthTokenProvider
+import dev.sasikanth.rss.reader.data.sync.bazqux.BazQuxSyncProvider
 import dev.sasikanth.rss.reader.data.sync.dropbox.DropboxCloudServiceProvider
 import dev.sasikanth.rss.reader.data.sync.freshrss.FreshRssSyncProvider
 import dev.sasikanth.rss.reader.data.sync.google.GoogleDriveCloudServiceProvider
@@ -176,11 +177,13 @@ interface DataComponent :
     googleDriveSyncProvider: GoogleDriveCloudServiceProvider,
     freshRssSyncProvider: FreshRssSyncProvider,
     minifluxSyncProvider: MinifluxSyncProvider,
+    bazQuxSyncProvider: BazQuxSyncProvider,
     appInfo: AppInfo,
   ): Set<CloudServiceProvider> {
     return buildSet {
       add(minifluxSyncProvider)
       add(freshRssSyncProvider)
+      add(bazQuxSyncProvider)
       if (appInfo.isGoogleDriveSupported) {
         add(googleDriveSyncProvider)
       }
```

**File**: `core/data/src/commonMain/kotlin/dev/sasikanth/rss/reader/data/sync/DefaultSyncCoordinator.kt` (modified, +15/-6)
```diff
@@ -16,6 +16,7 @@
  */
 package dev.sasikanth.rss.reader.data.sync
 
+import dev.sasikanth.rss.reader.data.sync.bazqux.BazQuxSyncProvider
 import dev.sasikanth.rss.reader.data.sync.dropbox.DropboxCloudServiceProvider
 import dev.sasikanth.rss.reader.data.sync.dropbox.DropboxSyncCoordinator
 import dev.sasikanth.rss.reader.data.sync.freshrss.FreshRSSSyncCoordinator
@@ -50,6 +51,7 @@ class DefaultSyncCoordinator(
   private val freshRssSyncProvider: FreshRssSyncProvider,
   private val minifluxSyncCoordinator: MinifluxSyncCoordinator,
   private val minifluxSyncProvider: MinifluxSyncProvider,
+  private val bazQuxSyncProvider: BazQuxSyncProvider,
   dispatchersProvider: DispatchersProvider,
 ) : SyncCoordinator {
 
@@ -62,9 +64,12 @@ class DefaultSyncCoordinator(
         googleDriveSyncProvider.isSignedIn(),
         freshRssSyncProvider.isSignedIn(),
         minifluxSyncProvider.isSignedIn(),
-      ) { dropboxSignedIn, googleDriveSignedIn, freshRssSignedIn, minifluxSignedIn ->
+        bazQuxSyncProvider.isSignedIn(),
+      ) { dropboxSignedIn, googleDriveSignedIn, freshRssSignedIn, minifluxSignedIn, bazQuxSignedIn
+        ->
         when {
-          freshRssSignedIn -> freshRSSSyncCoordinator
+          // BazQux speaks the GReader protocol, so it shares the FreshRSS coordinator
+          freshRssSignedIn || bazQuxSignedIn -> freshRSSSyncCoordinator
           minifluxSignedIn -> minifluxSyncCoordinator
           dropboxSignedIn -> dropboxSyncCoordinator
           googleDriveSignedIn -> googleDriveSyncCoordinator
@@ -76,7 +81,8 @@ class DefaultSyncCoordinator(
 
   override suspend fun pull(): Boolean {
     return when {
-      freshRssSyncProvider.isSignedInImmediate() -> freshRSSSyncCoordinator.pull()
+      freshRssSyncProvider.isSignedInImmediate() || bazQuxSyncProvider.isSignedInImmediate() ->
+        freshRSSSyncCoordinator.pull()
       minifluxSyncProvider.isSignedInImmediate() -> minifluxSyncCoordinator.pull()
       dropboxSyncProvider.isSignedInImmediate() -> dropboxSyncCoordinator.pull()
       googleDriveSyncProvider.isSignedInImmediate() -> googleDriveSyncCoordinator.pull()
@@ -90,7 +96,8 @@ class DefaultSyncCoordinator(
 
   override suspend fun pull(feedIds: List<String>): Boolean {
     return when {
-      freshRssSyncProvider.isSignedInImmediate() -> freshRSSSyncCoordinator.pull(feedIds)
+      freshRssSyncProvider.isSignedInImmediate() || bazQuxSyncProvider.isSignedInImmediate() ->
+        freshRSSSyncCoordinator.pull(feedIds)
       minifluxSyncProvider.isSignedInImmediate() -> minifluxSyncCoordinator.pull(feedIds)
       dropboxSyncProvider.isSignedInImmediate() -> dropboxSyncCoordinator.pull(feedIds)
       googleDriveSyncProvider.isSignedInImmediate() -> googleDriveSyncCoordinator.pull(feedIds)
@@ -104,7 +111,8 @@ class DefaultSyncCoordinator(
 
   override suspend fun pull(feedId: String): Boolean {
     return when {
-      freshRssSyncProvider.isSignedInImmediate() -> freshRSSSyncCoordinator.pull(feedId)
+      freshRssSyncProvider.isSignedInImmediate() || bazQuxSyncProvider.isSignedInImmediate() ->
+        freshRSSSyncCoordinator.pull(feedId)
       minifluxSyncProvider.isSignedInImmediate() -> minifluxSyncCoordinator.pull(feedId)
       dropboxSyncProvider.isSignedInImmediate() -> dropboxSyncCoordinator.pull(feedId)
       googleDriveSyncProvider.isSignedInImmediate() -> googleDriveSyncCoordinator.pull(feedId)
@@ -118,7 +126,8 @@ class DefaultSyncCoordinator(
 
   override suspend fun push(): Boolean {
     return when {
-      freshRssSyncProvider.isSignedInImmediate() -> freshRSSSyncCoordinator.push()
+      freshRssSyncProvider.isSignedInImmediate() || bazQuxSyncProvider.isSignedInImmediate() ->
+        freshRSSSyncCoordinator.push()
       minifluxSyncProvider.isSignedInImmediate() -> minifluxSyncCoordinator.push()
       dropboxSyncProvider.isSignedInImmediate() -> dropboxSyncCoordinator.push()
       googleDriveSyncProvider.isSignedInImmediate() -> googleDriveSyncCoordinator.push()
```

**File**: `core/data/src/commonMain/kotlin/dev/sasikanth/rss/reader/data/sync/bazqux/BazQuxSyncProvider.kt` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+/*
+ * Copyright 2026 Sasikanth Miriyampalli
+ *
+ * Licensed under the GPL, Version 3.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     https://www.gnu.org/licenses/gpl-3.0.en.html
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ *
+ */
+
+package dev.sasikanth.rss.reader.data.sync.bazqux
+
+import dev.sasikanth.rss.reader.core.model.local.ServiceType
+import dev.sasikanth.rss.reader.data.repository.RssRepository
+import dev.sasikanth.rss.reader.data.repository.UserRepository
+import dev.sasikanth.rss.reader.data.sync.APIServiceProvider
+import dev.sasikanth.rss.reader.di.scopes.AppScope
+import kotlinx.coroutines.flow.Flow
+import kotlinx.coroutines.flow.map
+import me.tatarka.inject.annotations.Inject
+
+@Inject
+@AppScope
+class BazQuxSyncProvider(
+  private val userRepository: UserRepository,
+  private val rssRepository: RssRepository,
+) : APIServiceProvider {
+
+  override val cloudService: ServiceType = ServiceType.BAZQUX
+
+  override val isPremium: Boolean = true
+
+  override fun isSignedIn(): Flow<Boolean> {
+    return userRepository.user().map {
+      it != null && it.serverUrl != null && it.serviceType == ServiceType.BAZQUX
+    }
+  }
+
+  override suspend fun isSignedInImmediate(): Boolean {
+    val user = userRepository.currentUser()
+    return user != null && user.serverUrl != null && user.serviceType == ServiceType.BAZQUX
+  }
+
+  override suspend fun signOut() {
+    userRepository.deleteUser()
+    rssRepository.deleteAllLocalData()
+  }
+}
```

**File**: `core/model/src/commonMain/kotlin/dev/sasikanth/rss/reader/core/model/local/ServiceType.kt` (modified, +1/-0)
```diff
@@ -22,4 +22,5 @@ enum class ServiceType {
   FRESH_RSS,
   MINIFLUX,
   GOOGLE_DRIVE,
+  BAZQUX,
 }
```

**File**: `core/model/src/commonMain/kotlin/dev/sasikanth/rss/reader/core/model/remote/freshrss/AddFeedResponsePayload.kt` (modified, +4/-4)
```diff
@@ -21,8 +21,8 @@ import kotlinx.serialization.Serializable
 
 @Serializable
 data class AddFeedResponsePayload(
-  val numResults: Int,
-  val query: String,
-  val streamId: String,
-  val streamName: String,
+  val numResults: Int = 0,
+  val query: String = "",
+  val streamId: String = "",
+  val streamName: String = "",
 )
```

**File**: `core/network/src/commonMain/kotlin/dev/sasikanth/rss/reader/core/network/freshrss/FreshRssResources.kt` (modified, +2/-1)
```diff
@@ -41,7 +41,7 @@ class Reader {
     @SerialName("xt") val excludeState: String? = null,
     @SerialName("n") val limit: Int = 1000,
     @SerialName("ot") val newerThan: Long? = null,
-    @SerialName("c") val continuation: String = "",
+    @SerialName("c") val continuation: String? = null,
     val output: String = "json",
   )
 
@@ -63,5 +63,6 @@ class Reader {
     @SerialName("s") val state: String,
     @SerialName("xt") val excludeState: String? = null,
     @SerialName("n") val limit: Int = 50000,
+    val output: String = "json",
   )
 }
```

**File**: `core/network/src/commonMain/kotlin/dev/sasikanth/rss/reader/core/network/freshrss/FreshRssSource.kt` (modified, +5/-2)
```diff
@@ -149,7 +149,7 @@ class FreshRssSource(
             streamId = streamId,
             limit = limit,
             newerThan = newerThan,
-            continuation = continuation ?: "",
+            continuation = continuation?.takeIf { it.isNotBlank() },
             excludeState = excludeState,
           )
         )
@@ -191,7 +191,10 @@ class FreshRssSource(
 
   suspend fun addFeed(url: String): AddFeedResponsePayload? {
     return withContext(dispatchersProvider.io) {
-      authenticatedHttpClient().post(Reader.AddFeed(quickadd = url)).body()
+      authenticatedHttpClient()
+        .post(Reader.AddFeed(quickadd = url))
+        .body<AddFeedResponsePayload>()
+        .takeIf { it.streamId.isNotBlank() }
     }
   }
 
```

**File**: `resources/icons/src/commonMain/kotlin/dev/sasikanth/rss/reader/resources/icons/Bazqux.kt` (added, +113/-0)
```diff
@@ -0,0 +1,113 @@
+/*
+ * Copyright 2026 Sasikanth Miriyampalli
+ *
+ * Licensed under the GPL, Version 3.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     https://www.gnu.org/licenses/gpl-3.0.en.html
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ *
+ */
+
+package dev.sasikanth.rss.reader.resources.icons
+
+import androidx.compose.ui.graphics.Color
+import androidx.compose.ui.graphics.PathFillType.Companion.EvenOdd
+import androidx.compose.ui.graphics.SolidColor
+import androidx.compose.ui.graphics.StrokeCap.Companion.Butt
+import androidx.compose.ui.graphics.StrokeJoin.Companion.Miter
+import androidx.compose.ui.graphics.vector.ImageVector
+import androidx.compose.ui.graphics.vector.ImageVector.Builder
+import androidx.compose.ui.graphics.vector.path
+import androidx.compose.ui.unit.dp
+
+public val TwineIcons.Bazqux: ImageVector
+  get() {
+    if (_bazqux != null) {
+      return _bazqux!!
+    }
+    _bazqux =
+      Builder(
+          name = "Bazqux",
+          defaultWidth = 24.0.dp,
+          defaultHeight = 24.0.dp,
+          viewportWidth = 24.0f,
+          viewportHeight = 24.0f,
+        )
+        .apply {
+          path(
+            fill = SolidColor(Color(0xFF000000)),
+            stroke = null,
+            strokeLineWidth = 0.0f,
+            strokeLineCap = Butt,
+            strokeLineJoin = Miter,
+            strokeLineMiter = 4.0f,
+            pathFillType = EvenOdd,
+          ) {
+            moveTo(5.25f, 0.0f)
+            lineTo(18.75f, 0.0f)
+            curveTo(21.65f, 0.0f, 24.0f, 2.35f, 24.0f, 5.25f)
+            lineTo(24.0f, 18.75f)
+            curveTo(24.0f, 21.65f, 21.65f, 24.0f, 18.75f, 24.0f)
+            lineTo(5.25f, 24.0f)
+            curveTo(2.35f, 24.0f, 0.0f, 21.65f, 0.0f, 18.75f)
+            lineTo(0.0f, 5.25f)
+            curveTo(0.0f, 2.35f, 2.35f, 0.0f, 5.25f, 0.0f)
+            close()
+            moveTo(19.175f, 18.25f)
+            lineTo(14.383f, 18.25f)
+            quadTo(13.141f, 16.347f, 12.317f, 15.22f)
+            quadTo(11.493f, 14.092f, 10.269f, 12.612f)
+            lineTo(9.785f, 12.612f)
+            lineTo(9.785f, 16.409f)
+            quadTo(9.785f, 16.726f, 9.903f, 16.946f)
+            quadTo(10.022f, 17.166f, 10.357f, 17.316f)
+            quadTo(10.524f, 17.387f, 10.881f, 17.462f)
+            quadTo(11.238f, 17.536f, 11.493f, 17.563f)
+            lineTo(11.493f, 18.25f)
+            lineTo(4.825f, 18.25f)
+            lineTo(4.825f, 17.563f)
+            quadTo(5.081f, 17.536f, 5.499f, 17.488f)
+            quadTo(5.917f, 17.44f, 6.094f, 17.369f)
+            quadTo(6.428f, 17.228f, 6.543f, 17.012f)
+            quadTo(6.657f, 16.797f, 6.657f, 16.462f)
+            lineTo(6.657f, 7.644f)
+            quadTo(6.657f, 7.327f, 6.56f, 7.115f)
+            quadTo(6.464f, 6.904f, 6.094f, 6.745f)
+            quadTo(5.812f, 6.631f, 5.428f, 6.552f)
+            quadTo(5.045f, 6.472f, 4.825f, 6.437f)
+            lineTo(4.825f, 5.75f)
+            lineTo(11.837f, 5.75f)
+            quadTo(14.189f, 5.75f, 15.409f, 6.486f)
+            quadTo(16.629f, 7.221f, 16.629f, 8.71f)
+            quadTo(16.629f, 10.022f, 15.876f, 10.82f)
+            quadTo(15.123f, 11.617f, 13.581f, 12.066f)
+            quadTo(14.18f, 12.841f, 14.977f, 13.863f)
+            quadTo(15.775f, 14.885f, 16.638f, 15.951f)
+            quadTo(16.911f, 16.294f, 17.382f, 16.792f)
+            quadTo(17.854f, 17.29f, 18.215f, 17.404f)
+            quadTo(18.417f, 17.466f, 18.73f, 17.51f)
+            quadTo(19.043f, 17.554f, 19.175f, 17.563f)
+            close()
+            moveTo(13.176f, 8.956f)
+            quadTo(13.176f, 7.706f, 12.476f, 7.129f)
+            quadTo(11.775f, 6.552f, 10.48f, 6.552f)
+            lineTo(9.785f, 6.552f)
+            lineTo(9.785f, 11.784f)
+            lineTo(10.454f, 11.784f)
+            quadTo(11.749f, 11.784f, 12.462f, 11.106f)
+            quadTo(13.176f, 10.428f, 13.176f, 8.956f)
+            close()
+          }
+        }
+        .build()
+    return _bazqux!!
+  }
+
+private var _bazqux: ImageVector? = null
```

#### Recent Merged Pull Requests:
- **PR #1948** (closed): Show full featured images without crop or empty space (@camilopaezz)
- **PR #1945** (2026-09-09): [300.106.*] Pre-release merge (@tramline-github[bot])
- **PR #1943** (closed): New Crowdin updates (@msasikanth)
- **PR #1942** (2026-08-31): [300.105.*] Pre-release merge (@tramline-github[bot])
- **PR #1941** (2026-08-30): [300.104.*] Pre-release merge (@tramline-github[bot])
- **PR #1940** (2026-08-30): [300.103.*] Pre-release merge (@tramline-github[bot])
- **PR #1939** (2026-08-30): [300.102.*] Pre-release merge (@tramline-github[bot])
- **PR #1938** (2026-08-30): [300.101.*] Pre-release merge (@tramline-github[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
