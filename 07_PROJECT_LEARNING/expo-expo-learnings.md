# Forensic Learning Record (Deep Inspection): expo/expo

> **Canonical Artifact**: `07_PROJECT_LEARNING/expo-expo-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/expo/expo](https://github.com/expo/expo))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:20:51.965Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `expo/expo`
- **Description**: An open-source framework for making universal native apps with React. Expo runs on Android, iOS, and the web.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 52575 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/bare-expo/e2e/image-comparison/src/pathUtils.ts`
```
import * as fs from 'fs';
import * as os from 'os';
import path from 'path';

import { RequestBody } from './schema';

const pngSuffix = '.png';

export function transformPaths(e2eDir: string, parsedBody: RequestBody, homeDir?: string) {
  const { baseImage, currentScreenshot, platform, diffOutputPath } = parsedBody;
  const testID = 'testID' in parsedBody ? parsedBody.testID : undefined;
  const mode = 'mode' in parsedBody ? parsedBody.mode : undefined;

  const currentScreenshotPath = path.resolve(e2eDir, currentScreenshot + pngSuffix);

  // Apply platform suffix to base image path if in platformDependent mode with testID
  let baseImageToUse = baseImage;
  const addPlatformSuffixForViewShot = mode === 'keep-originals' && testID;
  if (addPlatformSuffixForViewShot) {
    // Add platform suffix: "example.base" -> "example.base.ios"
    const baseName = path.basename(baseImage, '.base');
    const dirName = path.dirname(baseImage);
    baseImageToUse = path.join(dirName, `${baseName}.base.${platform}`);
  }

  const fileName = path.basename(baseImage, `.base`);

  // Apply platform suffix to view shot path if in platformDependent mode with testID
  const viewShotFileName = addPlatformSuffixForViewShot ? `${fileName}.${platform}` : fileName;

  const viewShotOutputPath = testID
    ? path.join(path.dirname(currentScreenshotPath), viewShotFileName + pngSuffix)
    : undefined;

  const baseImagePath = path.resolve(e2eDir, baseImageToUse + pngSuffix);

  const isScreenShot = mode === undefined && testID === undefined;

  const processedOutputPath = (() => {
    const basePath = (() => {
      if (isScreenShot) {
        return `${diffOutputPath}.diff.${platform}${pngSuffix}`;
      } else {
        // view shot
        if (addPlatformSuffixForViewShot) {
          return `${diffOutputPath}/${testID}.diff.${platform}${pngSuffix}`;
        } else {
          return `${diffOutputPath}/${testID}.diff${pngSuffix}`;
        }
      }
    })();
    return createUniqueFilePath(basePath, homeDir);
  })();

  const currentScreenshotArtifactPath = (() => {
    const basePath = (() => {
      if (isScreenShot) {
        return `${diffOutputPath}.${platform}${pngSuffix}`;
      } else {
        // view shot
        return `${diffOutputPath}/${testID}_full.${platform}${pngSuffix}`;
      }
    })();
    return createUniqueFilePath(basePath, homeDir);
  })();

  return {
    baseImagePath,
    currentScreenshotPath,
    viewShotOutputPath,
    imageForComparisonPath: viewShotOutputPath || currentScreenshotPath,
    diffOutputFilePath: processedOutputPath,
    currentScreenshotArtifactPath,
  };
}

function expandTilde(filePath: string, homeDir?: string): string {
  if (filePath.startsWith('~/')) {
    return path.join(homeDir || os.homedir(), filePath.slice(2));
  }
  return filePath;
}

// e2e tests in CI run in repetition when a run fails, so we need to ensure unique file names
function createUniqueFilePath(outputPath: string, homeDir?: string): string {
  const expandedPath = expandTilde(outputPath, homeDir);
  const dir = path.dirname(expandedPath);
  const ext = path.extname(expandedPath);
  const baseName = path.basename(expandedPath, ext);

  let finalPath: string = expandedPath;
  let counter = 2;
  while (fs.existsSync(finalPath)) {
    finalPath = path.join(dir, `${baseName}_${counter.toString().padStart(2, '0')}${ext}`);
    counter++;
  }

  return path.resolve(finalPath);
}

```

### Core Architecture Module: `apps/bare-expo/e2e/image-comparison/src/pngUtils.ts`
```
import spawnAsync from '@expo/spawn-async';
import fs from 'node:fs/promises';
import { PNG } from 'pngjs';

export async function readPNG(filePath: string): Promise<PNG> {
  const buffer = await fs.readFile(filePath);
  return new Promise((resolve, reject) => {
    const png = new PNG();
    png.parse(buffer, (error, data) => {
      if (error) reject(error);
      else resolve(data);
    });
  });
}

async function compressPNGWithOxipng(filePath: string): Promise<void> {
  if (process.env.CI) {
    return;
  }

  try {
    await spawnAsync('oxipng', ['-o', 'max', '--strip', 'safe', filePath], {
      stdio: 'ignore',
    });
  } catch (error: any) {
    console.error(`oxipng compression failed for ${filePath}:`, error.message);
    console.log('run brew install oxipng to install it');
  }
}

export async function writePNG(png: PNG, filePath: string): Promise<void> {
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    png.pack();
    png.on('data', (chunk: Buffer) => chunks.push(chunk));
    png.on('end', () => resolve(Buffer.concat(chunks)));
    png.on('error', reject);
  });
  await fs.writeFile(filePath, buffer);

  await compressPNGWithOxipng(filePath);
}

```

### Core Architecture Module: `apps/expo-go/android/expoview/src/main/java/host/exp/exponent/exceptions/ExceptionUtils.kt`
```
// Copyright 2015-present 650 Industries. All rights reserved.
package host.exp.exponent.exceptions

import android.content.Context
import android.provider.Settings
import host.exp.exponent.kernel.ExponentErrorMessage
import host.exp.exponent.network.ExponentNetwork
import host.exp.expoview.Exponent
import java.lang.Exception
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

object ExceptionUtils {

  /**
   * Converts an exception into and ExponentErrorMessage, which contains both a user facing
   * error message and a developer facing error message.
   * Example:
   *  ManifestException with
   *    manifestUrl="exp://exp.host/@exponent/pomodoro"
   *    originalException=UnknownHostException
   *
   *    turns into:
   *
   *  ExponentErrorMessage with
   *    userErrorMessage="Could not load exp://exp.host/@exponent/pomodoro. Airplane mode is on."
   *    developerErrorMessage="java.net.UnknownHostException: Unable to resolve host"
   **/
  fun exceptionToErrorMessage(exception: Exception): ExponentErrorMessage {
    val context: Context = Exponent.instance.application
    val defaultResponse = ExponentErrorMessage.developerErrorMessage(exception.toString())

    if (exception is ExponentException) {
      // Grab both the user facing message from ExponentException
      var message = exception.toString()

      // Append general exception error messages if applicable
      if (exception.originalException() != null) {
        val userErrorMessage = getUserErrorMessage(exception.originalException(), context)
        if (userErrorMessage != null) {
          message += " $userErrorMessage"
        }
      }

      return ExponentErrorMessage(message, exception.originalExceptionMessage())
    }

    val userErrorMessage = getUserErrorMessage(exception, context)
    return if (userErrorMessage != null) {
      defaultResponse.addUserErrorMessage(userErrorMessage)
    } else {
      defaultResponse
    }
  }

  fun exceptionToErrorHeader(exception: Exception): String? {
    if (exception is ManifestException) {
      return exception.errorHeader
    }
    return null
  }

  fun exceptionToPlainText(exception: Exception): String {
    if (exception is ManifestException) {
      return """
${exceptionToErrorHeader(exception)}

${replaceHtml(exception.errorMessage)}

How to fix this error:
${replaceHtml(exception.fixInstructions)}
      """.trimIndent()
    }
    return exception.toString()
  }

  fun exceptionToCanRetry(exception: Exception): Boolean {
    if (exception is ManifestException) {
      return exception.canRetry
    }
    return true
  }

  private fun replaceHtml(input: String?): String {
    return input
      ?.replace("<br>", "\n")
      ?.replace("<b>", "")
      ?.replace("</b>", "") ?: ""
  }

  private fun getUserErrorMessage(exception: Exception?, context: Context): String? {
    if (exception is UnknownHostException || exception is ConnectException) {
      if (isAirplaneModeOn(context)) {
        return "Airplane mode is on. Please turn off and try again."
      } else if (!ExponentNetwork.isNetworkAvailable(context)) {
        return "Can't connect to internet. Please try again."
      }
    } else if (exception is SocketTimeoutException) {
      return "Network response timed out."
    }
    return null
  }

  private fun isAirplaneModeOn(context: Context): Boolean {
    return Settings.System.getInt(context.contentResolver, Settings.Global.AIRPLANE_MODE_ON, 0) != 0
  }
}

```

### Core Architecture Module: `apps/expo-go/android/expoview/src/main/java/host/exp/exponent/experience/ErrorQueueAdapter.kt`
```
package host.exp.exponent.experience

import android.content.Context
import host.exp.exponent.kernel.ExponentError
import android.widget.ArrayAdapter
import android.view.ViewGroup
import android.view.LayoutInflater
import android.view.View
import android.widget.TextView
import host.exp.expoview.R
import host.exp.expoview.databinding.ErrorConsoleListItemBinding
import java.text.SimpleDateFormat
import java.util.*

class ErrorQueueAdapter(context: Context, values: List<ExponentError>) : ArrayAdapter<ExponentError>(context, -1, values) {
  override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
    val (convertViewRet, holder) = if (convertView == null) {
      val binding = ErrorConsoleListItemBinding.inflate(LayoutInflater.from(context), parent, false)
      val convertViewLocal = binding.root
      val holderLocal = ViewHolder(binding)
      convertViewLocal.tag = holderLocal
      Pair(convertViewLocal, holderLocal)
    } else {
      Pair(convertView, convertView.tag as ViewHolder)
    }

    val item = getItem(position)
    holder.errorMessageView.text = context.getString(R.string.error_uncaught, item!!.errorMessage.developerErrorMessage())

    if (item.stack.isNotEmpty()) {
      val bundle = item.stack[0]

      val path = bundle.getString("file")
      val fileName = if (path != null && path.isNotEmpty()) {
        val file = path.substring(path.lastIndexOf('/') + 1)
        "@$file"
      } else {
        ""
      }

      val lineNumber = when (val lineNumberObject = bundle["lineNumber"]) {
        is Double -> ":" + lineNumberObject.toInt()
        is Int -> ":" + lineNumberObject.toInt()
        else -> ""
      }

      val stacktracePreview = bundle.getString("methodName") + fileName + lineNumber
      holder.stacktraceView.text = stacktracePreview
    }

    var timestampViewText = SimpleDateFormat("HH:mm:ss", Locale.US).format(item.timestamp)
    if (item.isFatal) {
      timestampViewText += " Fatal Error"
    }
    holder.timestampView.text = timestampViewText

    return convertViewRet
  }

  internal class ViewHolder(binding: ErrorConsoleListItemBinding) {
    var errorMessageView: TextView = binding.errorConsoleItemMessage
    var stacktraceView: TextView = binding.errorConsoleItemStackPreview
    var timestampView: TextView = binding.errorConsoleItemTimestamp
  }
}

```

### Core Architecture Module: `apps/expo-go/android/expoview/src/main/java/host/exp/exponent/experience/splashscreen/legacy/SplashScreenReactActivityLifecycleListener.kt`
```
package host.exp.exponent.experience.splashscreen.legacy

import android.app.Activity
import com.facebook.react.ReactActivity
import com.facebook.react.ReactHost
import com.facebook.react.ReactRootView
import expo.modules.core.interfaces.ReactActivityHandler
import expo.modules.core.interfaces.ReactActivityLifecycleListener
import host.exp.exponent.experience.splashscreen.legacy.singletons.SplashScreen

class SplashScreenReactActivityLifecycleListener : ReactActivityLifecycleListener {
  override fun onContentChanged(activity: Activity) {
    SplashScreen.ensureShown(
      activity,
      ReactRootView::class.java
    )
  }
}

class SplashScreenReactActivityHandler : ReactActivityHandler {
  override fun getDelayLoadAppHandler(
    activity: ReactActivity?,
    reactHost: ReactHost?
  ): ReactActivityHandler.DelayLoadAppHandler? {
    activity?.let {
      SplashScreen.ensureShown(
        it,
        ReactRootView::class.java
      )
    }
    return null
  }
}

```

### Core Architecture Module: `apps/expo-go/android/expoview/src/main/java/host/exp/exponent/home/DateTimeUtils.kt`
```
package host.exp.exponent.home

import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * Parses an ISO 8601 date string and formats it into a human-readable format.
 * Example: "2024-05-15T03:03:00.000Z" -> "May 15 2024, 3:03 AM"
 *
 * @param dateString The ISO 8601 date string from the GraphQL response.
 * @return A formatted, readable date-time string, or the original string if parsing fails.
 */
fun formatIsoDateTime(dateString: String?): String {
  if (dateString == null) {
    return "Unknown date"
  }

  return try {
    val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.ENGLISH)
    inputFormat.timeZone = TimeZone.getTimeZone("UTC")
    val date = inputFormat.parse(dateString) ?: return dateString

    val outputFormat = SimpleDateFormat("MMM d, yyyy, h:mm a", Locale.ENGLISH)
    outputFormat.timeZone = TimeZone.getDefault()
    return outputFormat.format(date)
  } catch (_: Exception) {
    dateString
  }
}

```

### Core Architecture Module: `apps/expo-go/android/expoview/src/main/java/host/exp/exponent/home/UrlUtils.kt`
```
package host.exp.exponent.home

import android.net.Uri
import androidx.core.net.toUri
import host.exp.exponent.generated.ExponentBuildConstants

// Hardcoded Snack runtime URLs – these should ideally be fetched from an npm package, but we'll need to keep them in sync.
private const val EXPO_HOST = "expo.dev"
private const val SNACK_RUNTIME_URL_PROTOCOL = "exp"
private const val SNACK_RUNTIME_URL_ENDPOINT = "u.expo.dev/933fd9c0-1666-11e7-afca-d980795c5824"

fun normalizeSnackUrl(
  fullName: String,
  channelName: String? = null
): String {
  val builder = Uri.Builder()
    .scheme(SNACK_RUNTIME_URL_PROTOCOL)
    .encodedAuthority(SNACK_RUNTIME_URL_ENDPOINT)
    .appendQueryParameter("runtime-version", "exposdk:${ExponentBuildConstants.TEMPORARY_SDK_VERSION}")
    .appendQueryParameter("channel-name", "production")
    .appendQueryParameter("snack", fullName)

  // Add the channel parameter only if it's provided
  channelName?.let {
    builder.appendQueryParameter("snack-channel", it)
  }

  return builder.build().toString()
}

/**
 * Rewrites a raw URL string into a normalized Expo URL (exp://).
 *
 * @param rawUrl The user-provided URL string.
 * @return A normalized URL string, defaulting to the exp:// protocol.
 */
fun normalizeUrl(rawUrl: String): String {
  val trimmedUrl = rawUrl.trim()
  var parsedUri = trimmedUrl.toUri()

  if ((parsedUri.scheme != null && parsedUri.authority == null) || (parsedUri.host == null && parsedUri.scheme == null)) {
    if (trimmedUrl.startsWith("@")) {
      return "exp://$EXPO_HOST/$trimmedUrl"
    } else {
      parsedUri = "exp://$trimmedUrl".toUri()
    }
  }

  if (parsedUri.scheme == null) {
    return "exp://$trimmedUrl"
  }

  return parsedUri.toString()
}

```

### Core Architecture Module: `apps/expo-go/android/expoview/src/main/java/host/exp/exponent/home/qrScanner/DrawingUtils.kt`
```
package host.exp.exponent.home.qrScanner

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke

fun DrawScope.drawRoundedCorner(
  offset: Offset,
  startAngle: Float,
  strokeWidth: Float,
  cornerRadius: Float,
  horizontalLineStart: Offset,
  horizontalLineEnd: Offset,
  verticalLineStart: Offset,
  verticalLineEnd: Offset,
  color: Color = Color.White
) {
  drawArc(
    color = color,
    startAngle = startAngle,
    sweepAngle = 90f,
    useCenter = false,
    topLeft = offset,
    size = Size(cornerRadius * 2, cornerRadius * 2),
    style = Stroke(width = strokeWidth)
  )
  drawLine(
    color = color,
    start = horizontalLineStart,
    end = horizontalLineEnd,
    strokeWidth = strokeWidth
  )
  drawLine(
    color = color,
    start = verticalLineStart,
    end = verticalLineEnd,
    strokeWidth = strokeWidth
  )
}

```

### Core Architecture Module: `apps/expo-go/android/expoview/src/main/java/host/exp/exponent/notifications/ScopedNotificationsUtils.kt`
```
package host.exp.exponent.notifications

import android.content.Context
import expo.modules.notifications.notifications.model.Notification
import expo.modules.notifications.notifications.model.NotificationRequest
import expo.modules.notifications.notifications.model.NotificationResponse
import expo.modules.notifications.service.delegates.ExpoPresentationDelegate
import host.exp.exponent.experience.ExperienceActivity
import host.exp.exponent.kernel.ExperienceKey
import host.exp.exponent.notifications.model.ScopedNotificationRequest

class ScopedNotificationsUtils(context: Context) {
  private val exponentNotificationManager: ExponentNotificationManager = ExponentNotificationManager(context)

  fun shouldHandleNotification(notification: Notification, experienceKey: ExperienceKey): Boolean {
    return shouldHandleNotification(notification.notificationRequest, experienceKey)
  }

  fun shouldHandleNotification(
    notificationRequest: NotificationRequest,
    experienceKey: ExperienceKey
  ): Boolean {
    // expo-notifications notification
    if (notificationRequest is ScopedNotificationRequest) {
      return notificationRequest.checkIfBelongsToExperience(experienceKey)
    }

    // legacy or foreign notification
    val foreignNotification = ExpoPresentationDelegate.parseNotificationIdentifier(notificationRequest.identifier)
    if (foreignNotification != null) {
      val foreignNotificationExperienceScopeKey = foreignNotification.first
      val foreignNotificationExperienceKey = foreignNotificationExperienceScopeKey?.let { ExperienceKey(it) }
      val notificationBelongsToSomeExperience = foreignNotificationExperienceKey != null && exponentNotificationManager.getAllNotificationsIds(foreignNotificationExperienceKey).contains(foreignNotification.second)
      val notificationExperienceIsCurrentExperience = foreignNotificationExperienceKey != null && experienceKey.scopeKey == foreignNotificationExperienceKey.scopeKey
      val notificationIsPersistentExponentNotification = foreignNotificationExperienceScopeKey == null && foreignNotification.second == ExperienceActivity.PERSISTENT_EXPONENT_NOTIFICATION_ID
      // If notification doesn't belong to any experience it's a foreign notification
      // and we want to deliver it to all the experiences. If it does belong to some experience,
      // we want to handle it only if it belongs to "current" experience. If it is the persistent
      // Exponent notification do not pass it to any experience.
      return !notificationIsPersistentExponentNotification && (!notificationBelongsToSomeExperience || notificationExperienceIsCurrentExperience)
    }

    // fallback
    return true
  }

  companion object {
    fun getExperienceScopeKey(notificationResponse: NotificationResponse?): String? {
      if (notificationResponse == null || notificationResponse.notification == null) {
        return null
      }
      val notificationRequest = notificationResponse.notification.notificationRequest
      if (notificationRequest is ScopedNotificationRequest) {
        return notificationRequest.experienceScopeKeyString
      }
      return null
    }
  }
}

```

### Core Architecture Module: `apps/expo-go/android/expoview/src/main/java/host/exp/exponent/utils/AsyncCondition.kt`
```
// Copyright 2015-present 650 Industries. All rights reserved.
package host.exp.exponent.utils

import android.util.Log
import host.exp.exponent.analytics.EXL

object AsyncCondition {
  private val TAG = AsyncCondition::class.java.simpleName

  private val listenerMap = mutableMapOf<String, AsyncConditionListener>()

  @JvmStatic fun wait(key: String, listener: AsyncConditionListener) {
    if (listener.isReady()) {
      listener.execute()
    } else {
      synchronized(listenerMap) {
        if (listenerMap.containsKey(key)) {
          EXL.e(TAG, "Map already contains entry for key $key. Ignoring.")
          return
        }
        listenerMap.put(key, listener)
      }
    }
  }

  @JvmStatic fun notify(key: String) {
    synchronized(listenerMap) {
      if (!listenerMap.containsKey(key)) {
        Log.w(TAG, "Could not find listener for key: $key")
        return
      }
      val listener = listenerMap.remove(key)
      if (listener!!.isReady()) {
        listener.execute()
      }
    }
  }

  @JvmStatic fun remove(key: String) {
    synchronized(listenerMap) { listenerMap.remove(key) }
  }

  interface AsyncConditionListener {
    fun isReady(): Boolean
    fun execute()
  }
}

```

### Core Architecture Module: `apps/expo-go/android/expoview/src/main/java/host/exp/exponent/utils/BundleJSONConverter.kt`
```
/*
 * Copyright (c) 2014-present, Facebook, Inc. All rights reserved.
 *
 * You are hereby granted a non-exclusive, worldwide, royalty-free license to use,
 * copy, modify, and distribute this software in source code or binary form for use
 * in connection with the web services and APIs provided by Facebook.
 *
 * As with any software that integrates with the Facebook platform, your use of
 * this software is subject to the Facebook Developer Principles and Policies
 * [http://developers.facebook.com/policy/]. This copyright notice shall be
 * included in all copies or substantial portions of the software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

package host.exp.exponent.utils

import android.os.Bundle
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

/**
 * Referenced from [com.facebook.internal.BundleJSONConverter]
 * https://github.com/facebook/facebook-android-sdk/blob/main/facebook-core/src/main/java/com/facebook/internal/BundleJSONConverter.kt
 *
 * com.facebook.internal is solely for the use of other packages within the Facebook SDK for
 * Android. Use of any of the classes in this package is unsupported, and they may be modified or
 * removed without warning at any time.
 *
 * A helper class that can round trip between JSON and Bundle objects that contains the types:
 * Boolean, Integer, Long, Double, String If other types are found, an IllegalArgumentException is
 * thrown.
 */

object BundleJSONConverter {
  private val SETTERS: MutableMap<Class<*>, Setter> = HashMap()

  @JvmStatic
  @Throws(JSONException::class)
  fun convertToJSON(bundle: Bundle): JSONObject {
    val json = JSONObject()
    for (key in bundle.keySet()) {
      val value =
        bundle[key] // Null is not supported.
          ?: continue

      // Special case List<String> as getClass would not work, since List is an interface
      if (value is List<*>) {
        val jsonArray = JSONArray()
        val listValue = value as List<String>
        for (stringValue in listValue) {
          jsonArray.put(stringValue)
        }
        json.put(key, jsonArray)
        continue
      }

      // Special case Bundle as it's one way, on the return it will be JSONObject
      if (value is Bundle) {
        json.put(key, convertToJSON(value))
        continue
      }
      val setter =
        SETTERS[value.javaClass]
          ?: throw IllegalArgumentException("Unsupported type: " + value.javaClass)
      setter.setOnJSON(json, key, value)
    }
    return json
  }

  @JvmStatic
  @Throws(JSONException::class)
  fun convertToBundle(jsonObject: JSONObject): Bundle {
    val bundle = Bundle()
    val jsonIterator = jsonObject.keys()
    while (jsonIterator.hasNext()) {
      val key = jsonIterator.next()
      val value = jsonObject[key]
      if (value === JSONObject.NULL) {
        // Null is not supported.
        continue
      }

      // Special case JSONObject as it's one way, on the return it would be Bundle.
      if (value is JSONObject) {
        bundle.putBundle(key, convertToBundle(value))
        continue
      }
      val setter =
        SETTERS[value.javaClass]
          ?: throw IllegalArgumentException("Unsupported type: " + value.javaClass)
      setter.setOnBundle(bundle, key, value)
    }
    return bundle
  }

  interface Setter {
    @Throws(JSONException::class)
    fun setOnBundle(bundle: Bundle, key: String, value: Any)

    @Throws(JSONException::class)
    fun setOnJSON(json: JSONObject, key: String, value: Any)
  }

  init {
    SETTERS[java.lang.Boolean::class.java] =
      object : Setter {
        @Throws(JSONException::class)
        override fun setOnBundle(bundle: Bundle, key: String, value: Any) {
          bundle.putBoolean(key, value as Boolean)
        }

        @Throws(JSONException::class)
        override fun setOnJSON(json: JSONObject, key: String, value: Any) {
          json.put(key, value)
        }
      }
    SETTERS[java.lang.Integer::class.java] =
      object : Setter {
        @Throws(JSONException::class)
        override fun setOnBundle(bundle: Bundle, key: String, value: Any) {
          bundle.putInt(key, value as Int)
        }

        @Throws(JSONException::class)
        override fun setOnJSON(json: JSONObject, key: String, value: Any) {
          json.put(key, value)
        }
      }
    SETTERS[java.lang.Long::class.java] =
      object : Setter {
        @Throws(JSONException::class)
        override fun setOnBundle(bundle: Bundle, key: String, value: Any) {
          bundle.putLong(key, value as Long)
        }

        @Throws(JSONException::class)
        override fun setOnJSON(json: JSONObject, key: String, value: Any) {
          json.put(key, value)
        }
      }
    SETTERS[java.lang.Double::class.java] =
      object : Setter {
        @Throws(JSONException::class)
        override fun setOnBundle(bundle: Bundle, key: String, value: Any) {
          bundle.putDouble(key, value as Double)
        }

        @Throws(JSONException::class)
        override fun setOnJSON(json: JSONObject, key: String, value: Any) {
          json.put(key, value)
        }
      }
    SETTERS[String::class.java] =
      object : Setter {
        @Throws(JSONException::class)
        override fun setOnBundle(bundle: Bundle, key: String, value: Any) {
          bundle.putString(key, value as String)
        }

        @Throws(JSONException::class)
        override fun setOnJSON(json: JSONObject, key: String, value: Any) {
          json.put(key, value)
        }
      }
    SETTERS[Array<String>::class.java] =
      object : Setter {
        @Throws(JSONException::class)
        override fun setOnBundle(bundle: Bundle, key: String, value: Any) {
          throw IllegalArgumentException("Unexpected type from JSON")
        }

        @Throws(JSONException::class)
        override fun setOnJSON(json: JSONObject, key: String, value: Any) {
          val jsonArray = JSONArray()
          for (stringValue in value as Array<String>) {
            jsonArray.put(stringValue)
          }
          json.put(key, jsonArray)
        }
      }
    SETTERS[JSONArray::class.java] =
      object : Setter {
        @Throws(JSONException::class)
        override fun setOnBundle(bundle: Bundle, key: String, value: Any) {
          val jsonArray = value as JSONArray
          val stringArrayList = ArrayList<String>()
          // Empty list, can't even figure out the type, assume an ArrayList<String>
          if (jsonArray.length() == 0) {
            bundle.putStringArrayList(key, stringArrayList)
            return
          }

          // Only strings are supported for now
          for (i in 0 until jsonArray.length()) {
            val current = jsonArray[i]
            if (current is String) {
              stringArrayList.add(current)
            } else {
              throw IllegalArgumentException("Unexpected type in an array: " + current.javaClass)
            }
          }
          bundle.putStringArrayList(key, stringArrayList)
        }

        @Throws(JSONException::class)
        override fun setOnJSON(json: JSONObject, key: String, value: Any) {
          throw IllegalArgumentException("JSONArray's are not supported in bundles.")
        }
      }
  }
}

```

### Core Architecture Module: `apps/expo-go/android/expoview/src/main/java/host/exp/exponent/utils/ColorParser.kt`
```
// Copyright 2015-present 650 Industries. All rights reserved.
package host.exp.exponent.utils

import android.graphics.Color
import java.lang.Exception

object ColorParser {
  @JvmStatic fun isValid(color: String?): Boolean {
    return try {
      Color.parseColor(color)
      true
    } catch (e: Exception) {
      false
    }
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #21568** (2025-05-12): **@expo/vector-icons not showing after adding metro.config.js file in project root folder**
  *Symptoms*: ### Summary  Expo vector icons are not rendering after deployment. As I'm using Expo Router, I'm using metro. I installed `@expo/metro-config` and this is my metro.config.js file:  ``` const { getDefaultConfig } = require("@expo/metro-config");  const defaultConfig = getDefaultConfig(__dirname);  module.exports = {   resolver: {     assetExts: [...defaultConfig.resolver.assetExts, "db"],   }, }; ```  Expected behaviour: ![image](https://user-images.githubusercontent.com/109685663/223214187-611456c2-5775-49e6-ab6f-7114b453c472.png)  What actually happens ![image](https://user-images.githubusercontent.com/109685663/223214030-fd88c8d2-1640-4878-8feb-dfbbc6415bc4.png)   ### What platform(s) does this occur on?  Web  ### SDK Version  48  ### Environment  expo-env-info 1.0.5 environment info:     System:       OS: Linux 5.19 Ubuntu 22.04.1 LTS 22.04.1 LTS (Jammy Jellyfish)       Shell: 5.1.16 - /bin/bash     Binaries:       Node: 16.17.0 - /usr/local/bin/node       npm: 8.15.0 - /usr/local/bin/npm     npmPackages:       expo: ^48.0.4 => 48.0.5        react: 18.2.0 => 18.2.0        react-dom: 18.2.0 => 18.2.0        react-native: 0.71.3 => 0.71.3        react-native-web: ~0.18.7 => 0.18.12      npmGlobalPackages:       expo-cli: 6.3.2     Expo Workflow: managed  ### Minimal reproducible example  https://github.com/francolivelli/expo-error
  **Post-Mortem & Fix Analysis**:
  > If you are experiencing issues with Expo vector icons not rendering after deployment, you may need to add some additional configuration to your project.  Firstly, make sure that you have installed react-native-vector-icons and expo-font packages. You can do this by running the following command in your project directory: `npm install react-native-vector-icons expo-font`  ext, you will need to add the following code to your App.js file to load the icon fonts: ``` import { Ionicons } from '@expo/vector-icons'; import { useFonts } from 'expo-font';  export default function App() {   const [loaded] = useFonts({     Ionicons: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),   });    if (!loaded) {     return null;   }    // Your app code here } ```  Make sure to replace Ionicons with the name of the icon font that you want to load. You can find the names of the available icon fonts in the node_modules/@expo/vector-icons/build/ve
  > Hi! I did everything you said but icons are still not rendering after deployment :(
  > Try clearing the cache of the application by typing ```expo r -c```. It can also be a possibility that your application is not bundled correctly. Also Check that the vector icons are included in the assets of your app.json file. Make sure that the assetBundlePatterns and assetPlugins are correctly set.  

- **Issue #20205** (2023-02-28): **Web platform broken in SDK 46**
  *Symptoms*: ### Summary  Web platform broken in SDK 46  ### Environment  ```   expo-env-info 1.0.5 environment info:     System:       OS: Linux 4.18 AlmaLinux 8.6 (Sky Tiger)       Shell: 4.4.20 - /bin/bash     Binaries:       Node: 16.18.0 - /usr/local/bin/node       Yarn: 1.22.19 - /usr/local/bin/yarn       npm: 8.19.2 - /usr/local/bin/npm     npmPackages:       @expo/webpack-config: ^0.17.0 => 0.17.3        expo: ~46.0.17 => 46.0.17        react: 18.0.0 => 18.0.0        react-dom: 18.0.0 => 18.0.0        react-native: 0.69.6 => 0.69.6        react-native-web: ~0.18.7 => 0.18.10      Expo Workflow: managed  ```  ### Please specify your device/emulator/simulator platform, model and version  web  ### Error output  ``` Starting Metro Bundler Error: Cannot find module '@expo/dev-server/build/webpack/symbolicateMiddleware' Require stack: - /home/bob/NetBeansProjects/webTest/node_modules/@expo/cli/build/src/start/server/webpack/WebpackBundlerDevServer.js - /home/bob/NetBeansProjects/webTest/node_modules/@expo/cli/build/src/start/server/DevServerManager.js - /home/bob/NetBeansProjects/webTest/node_modules/@expo/cli/build/src/start/startAsync.js - /home/bob/NetBeansProjects/webTest/node_modules/@expo/cli/build/src/start/index.js - /home/bob/NetBeansProjects/webTest/node_modules/@expo/cli/build/bin/cli Error: Cannot find module '@expo/dev-server/build/webpack/symbolicateMiddleware' Require stack: - /home/bob/NetBeansProjects/webTest/node_modules/@expo/cli/build/src
  **Post-Mortem & Fix Analysis**:
  > same issue here 
  > Thank you for filing this issue!   This comment acknowledges we believe this may be a bug and there’s enough information to investigate it.   However, we can’t promise any sort of timeline for resolution. We prioritize issues based on severity, breadth of impact, and alignment with our roadmap. If you’d like to help move it more quickly, you can continue to investigate it more deeply and/or you can open a pull request that fixes the cause. 
  > same issue

- **Issue #19860** (2025-09-16): **Running `expo run:android` serves the app on the wrong default url (10.0.2.2)**
  *Symptoms*: ### Summary  When I run `expo run:android`, I expect the app to be served from `10.0.2.2:8081`. However, when I do that, it actually starts on a seemingly random address. For me it's `10.0.0.207:8081` but I have colleagues where it opens on a different address. This causes us not to be able to load the app in development mode since these IP's are not in the cleartext communication whitelist. Adding these IP's to the whitelist might help, but it would be annoying to have to do this for every IP we see.  A temporary workaround for us is running: ``` REACT_NATIVE_PACKAGER_HOSTNAME='10.0.2.2' yarn expo run:android ```  ### Environment  ``` expo-env-info 1.0.5 environment info:     System:       OS: macOS 13.0       Shell: 5.8.1 - /bin/zsh     Binaries:       Node: 16.18.0 - ~/.asdf/installs/nodejs/16.18.0/bin/node       Yarn: 3.2.4 - ~/.asdf/installs/nodejs/16.18.0/.npm/bin/yarn       npm: 8.19.2 - ~/.asdf/installs/nodejs/16.18.0/bin/npm       Watchman: 2022.10.31.00 - /opt/homebrew/bin/watchman     Managers:       CocoaPods: 1.11.3 - /opt/homebrew/bin/pod     SDKs:       iOS SDK:         Platforms: DriverKit 21.4, iOS 16.0, macOS 12.3, tvOS 16.0, watchOS 9.0       Android SDK:         API Levels: 31, 33         Build Tools: 30.0.3, 31.0.0, 33.0.0         System Images: android-32 | Google Play ARM 64 v8a, android-33 | Google APIs ARM 64 v8a     IDEs:       Android Studio: 2021.3 AI-213.7172.25.2113.9014738       Xcode: 14.0.1/14A400 - /usr/bin/xcodebuil
  **Post-Mortem & Fix Analysis**:
  > Does the issue occur when using `npx expo run:android`?
  > @EvanBacon Just tested this. Yes it does. 
  > Thank you for filing this issue!   This comment acknowledges we believe this may be a bug and there’s enough information to investigate it.   However, we can’t promise any sort of timeline for resolution. We prioritize issues based on severity, breadth of impact, and alignment with our roadmap. If you’d like to help move it more quickly, you can continue to investigate it more deeply and/or you can open a pull request that fixes the cause. 

- **Issue #19348** (2023-07-04): **[expo-av] Audio setPositionAsync does not work on iOS with long duration mp3**
  *Symptoms*: ### Summary  When playing a mp3 with a long duration (snack exampleprovided with a one hour online source), calling setPositionAsync returns an error (Error: Seeking interrupted.)  PlaybackStatus never returns the durationMillis and setPositionAsync only works within the playableDurationMillis range, which only refresh when the positionMillis reach its value   Developing a Podcast app, I can't use a seek bar on iOS. Only works with shorter mp3 (like 15 minutes)     ### What platform(s) does this occur on?  iOS  ### Environment    expo-env-info 1.0.5 environment info:     System:       OS: macOS 12.6       Shell: 3.2.57 - /bin/bash     Binaries:       Node: 16.15.1 - /usr/local/bin/node       Yarn: 1.22.19 - ~/.yarn/bin/yarn       npm: 8.11.0 - /usr/local/bin/npm     Managers:       CocoaPods: 1.11.3 - /usr/local/bin/pod     SDKs:       iOS SDK:         Platforms: DriverKit 21.4, iOS 16.0, macOS 12.3, tvOS 16.0, watchOS 9.0     IDEs:       Android Studio: 2021.2 AI-212.5712.43.2112.8815526       Xcode: 14.0.1/14A400 - /usr/bin/xcodebuild     npmPackages:       expo: ~45.0.0 => 45.0.8        react: 17.0.2 => 17.0.2        react-dom: 17.0.2 => 17.0.2        react-native: 0.68.2 => 0.68.2        react-native-web: 0.17.7 => 0.17.7      npmGlobalPackages:       eas-cli: 2.0.0       expo-cli: 6.0.5     Expo Workflow: bare          Using  "expo-av": "~12.0.4",   ### Minimal reproducible example  https://snack.expo.dev/@karl.gochgarian/
  **Post-Mortem & Fix Analysis**:
  > Hi @VahanLab! Thanks for writing in and providing a repro. I slightly edited it just to get some more information from the example: https://snack.expo.dev/@bycedric/expo-issue-19348?platform=ios  To me, a couple of things stand out: - I can repro the issue when pressing play and then pressing "seek middle" - The `downloadAsync` is turned on, so it's downloading the whole thing     - But I can't imagine it's ready to download the whole thing in just under a few seconds.     - After letting it play for 20s, the `seek to middle` actually works  It looks like we either might be triggering the resolve on "loadAsync" too early, or we have a buffering issue IMHO.  Either way, thanks for the report.
  > Hey @byCedric anything new on that one? I experienced a few mp3 of only 5 minutes also affected with this bug. That sounds like a pretty critical bug to me for an audio player library.
  > This issue is stale because it has been open for 60 days with no activity. If there is no activity in the next 7 days, the issue will be closed.

- **Issue #19072** (2022-12-18): **Location altitude not WGS84 on iPhone**
  *Symptoms*: ### Summary  Doc states that altitude is in "meters above the WGS 84 reference ellipsoid"  so Andoid and iPhone should report similar altitudes from the same location, but they report different altitudes, apart roughly by the difference between MSL (mean sea level) and WGS84.  At my location (near Syracuse NY) that difference is about 33 meters.  Perhaps the iPhone implementation is not using [ellipsoidalAltitude](https://developer.apple.com/documentation/corelocation/cllocation/3861801-ellipsoidalaltitude)?  If not, it should.    ### What platform(s) does this occur on?  iOS  ### Environment  ```   expo-env-info 1.0.5 environment info:     System:       OS: Linux 5.15 Ubuntu 22.04.1 LTS 22.04.1 LTS (Jammy Jellyfish)       Shell: 5.1.16 - /bin/bash     Binaries:       Node: 16.16.0 - ~/.nvm/versions/node/v16.16.0/bin/node       Yarn: 3.2.1 - ~/.nvm/versions/node/v16.16.0/bin/yarn       npm: 8.11.0 - ~/.nvm/versions/node/v16.16.0/bin/npm       Watchman: 4.9.0 - /usr/bin/watchman     SDKs:       Android SDK:         API Levels: 29, 30, 31, 32         Build Tools: 28.0.3, 29.0.0, 29.0.2, 30.0.2, 30.0.3, 31.0.0, 32.0.0, 33.0.0         System Images: android-30 | Intel x86 Atom_64, android-30 | Google APIs Intel x86 Atom, android-30 | Google APIs Intel x86 Atom_64, android-30 | Google Play Intel x86 Atom     npmPackages:       expo: ^45.0.6 => 45.0.6        react: 17.0.2 => 17.0.2        react-dom: 17.0.2 => 17.0.2        react-native: 0.68.2 => 0.68.2     
  **Post-Mortem & Fix Analysis**:
  > Thank you for filing this issue!   This comment acknowledges we believe this may be a bug and there’s enough information to investigate it.   However, we can’t promise any sort of timeline for resolution. We prioritize issues based on severity, breadth of impact, and alignment with our roadmap. If you’d like to help move it more quickly, you can continue to investigate it more deeply and/or you can open a pull request that fixes the cause. 
  > Hi @pwellner, thanks for flagging this! It seems that the iOS implementation indeed does not use `ellipsoidalAltitude` ([implementation](https://github.com/expo/expo/blob/main/packages/expo-location/ios/EXLocation/EXLocation.m#L570) vs [Apple docs](https://developer.apple.com/documentation/corelocation/cllocation)).  I've marked this as an accepted issue but have no timeline yet for when this is fixed. If you want to contribute, I'd be happy to review a PR 😄   Thanks!
  > This issue is stale because it has been open for 60 days with no activity. If there is no activity in the next 7 days, the issue will be closed.

- **Issue #20986** (2023-05-06): **expo install rnmapbox/maps#main with npm adds 'undefined' to package.json**
  *Symptoms*: ### Summary  ```sh % expo --version 6.0.5 % expo init --npm   ... % cd my-app-npm % expo install rnmapbox/maps#main ... Installing 1 other package using npm. > npm install ...    % cat package.json | grep rnmapbox    "undefined": "rnmapbox/maps#main" ```  Works fine with `yarn` or installing the same package published from npm:  ``` % expo init --yarn   ... % cd my-app-yarn % expo install rnmapbox/maps#main ... > yarn add rnmapbox/maps#main ...    % cat package.json | grep rnmapbox     "@rnmapbox/maps": "rnmapbox/maps#main",  ```  ### Environment    expo-env-info 1.0.5 environment info:     System:       OS: macOS 12.5.1       Shell: 5.8.1 - /bin/zsh     Binaries:       Node: 18.8.0 - ~/.nvm/versions/node/v18.8.0/bin/node       Yarn: 1.22.18 - /usr/local/bin/yarn       npm: 8.18.0 - ~/.nvm/versions/node/v18.8.0/bin/npm       Watchman: 2022.07.04.00 - /usr/local/bin/watchman     Managers:       CocoaPods: 1.11.2 - /Users/boga/.rbenv/shims/pod     SDKs:       iOS SDK:         Platforms: DriverKit 21.4, iOS 15.5, macOS 12.3, tvOS 15.4, watchOS 8.5       Android SDK:         API Levels: 23, 27, 28, 29, 30, 31         Build Tools: 28.0.3, 29.0.2, 30.0.2, 30.0.3, 31.0.0         System Images: android-25 | Google APIs ARM EABI v7a, android-26 | Google Play Intel x86 Atom, android-30 | Google APIs Intel x86 Atom, android-S | Google Play ARM 64 v8a     IDEs:       Android Studio: 2021.2 AI-212.5712.43.2112.8815526       Xcode: 13.4
  **Post-Mortem & Fix Analysis**:
  > Does this happen with `npx expo install`?
  > @EvanBacon  yes it does:  ```sh  % npm create expo-app                               npx: installed 1 in 1.07s ✔ What is your app named? … my-app ✔ Downloaded and extracted project files. ⠋ Installing JavaScript dependencies with npm. ✔ Installed JavaScript dependencies.  % cd my-app  % npx expo --version 0.4.10  % npx expo install rnmapbox/maps#main › Installing 1 other package using npm > npm install ...  % cat package.json| grep rnmapbox     "undefined": "rnmapbox/maps#main"  ```
  > This issue is stale because it has been open for 60 days with no activity. If there is no activity in the next 7 days, the issue will be closed.

- **Issue #42226** (2026-01-16): **Builds breaking between expo-cli v0.58 and v0.59**
  *Symptoms*: Appologies for using a blank issue. I just wanted to stop bumping in discord. Also hoping this attracts other people with the same issue.  When running a build (local and remote) I get:  > Error: [ios.infoPlist]: withIosInfoPlistBaseMod: ENOENT: no such file or directory, open '/Users/spiderclam/projects/mobile/projectname/GoogleService-Info.plist'    Code: ENOENT  This makes sense, because the file doesn't exist until after eas-build-pre-install (That's where I place the correct GoogleService files based on the profile used).  So, for some reason it's running a config plugin before it should be running a plugin.  I've narrowed it down to somewhere between v0.58 and v0.59, since v0.59 (and later releases, too) is where the issue starts popping up.  **Additional remarks:**  - I've tried removing all plugins from app.json and it's still giving me the same error. - It's looking for the GoogleService file in my project root instead of the build root (which is usually some tmp dir). That's weird, because so far I've noticed eas-build-pre-install is run relative to the build root and _not_ the project root. - I noticed Expo-config was bumped a major version between v0.58 and v0.59. Probably not related but who knows. 
  **Post-Mortem & Fix Analysis**:
  > Can you share a link to the failing build?
  > @dsokal No, because it never gets uploaded. This error shows up locally.   This runs before `eas-build-pre-install`, which itself shouldn't run until the build starts afaik. This error shows up immediately after running build. I'll add the full output below (so you can see the order of things which might be helpful?):  **Preparation:**  ``` $ npm i -g eas-cli@v0.59 // Boring output ```  _Note: Anything above v0.59 (tested up to v1.1.1_ has the exact same behaviour._  **Local:**  ``` $ eas build --profile production --local ★ eas-cli@1.1.1 is now available. To upgrade, run npm install -g eas-cli. Proceeding with outdated version.  ✔ Select platform › iOS ✔ Linked to project @myorg/MyProject     Error: [ios.infoPlist]: withIosInfoPlistBaseMod: ENOENT: no such file or directory, open '/Users/spiderclam/projects/mobile/projectname/GoogleService-Info.plist'     Code: ENOENT ```  **EAS:**  ``` $ eas build --profile production ★ eas-cli@1.1.1 is now available. 
  > When running a non-local build, the `eas-build-pre-install` script is only executed in the cloud. See the docs https://docs.expo.dev/build-reference/ios-builds/#remote-steps  - The problem is, as it seems, that you don't have `GoogleService-Info.plist` locally.  - You most probably have a reference to the file in `app.json`/`app.config.js`.  - When starting a build, EAS CLI tries to read the app configuration (locally).  Probable solution: - Keep `GoogleService-Info.plist` in the project dir locally. - If you don't want to have this file uploaded to EAS Build, add it to .gitignore.

- **Issue #17828** (2022-07-07): **Image picker crashes after picking a gif on iOS**
  *Symptoms*: ### Summary  Pick a gif using the method launchImageLibraryAsync provided by expo-image-picker@13.1.1 It crashes instantly  https://user-images.githubusercontent.com/20151080/173271885-cadaf9c6-e5b4-4e5e-a1e9-90bc6e7ba377.MP4   ### Managed or bare workflow? If you have `ios/` or `android/` directories in your project, the answer is bare!  managed  ### What platform(s) does this occur on?  iOS  ### SDK Version (managed workflow only)  45.0.4  ### Environment    expo-env-info 1.0.3 environment info:     System:       OS: macOS 12.2.1       Shell: 3.3.1 - /usr/local/bin/fish     Binaries:       Node: 12.22.10 - ~/.nvm/versions/node/v12.22.10/bin/node       npm: 6.14.16 - ~/.nvm/versions/node/v12.22.10/bin/npm     Managers:       CocoaPods: 1.11.3 - /usr/local/bin/pod     SDKs:       iOS SDK:         Platforms: DriverKit 21.4, iOS 15.5, macOS 12.3, tvOS 15.4, watchOS 8.5       Android SDK:         API Levels: 30, 32         Build Tools: 29.0.2, 32.0.0, 32.1.0, 33.0.0     IDEs:       Android Studio: 2021.1 AI-211.7628.21.2111.8193401       Xcode: 13.4/13F17a - /usr/bin/xcodebuild     npmPackages:       expo: ^45.0.0 => 45.0.4        react: 17.0.2 => 17.0.2        react-dom: 17.0.2 => 17.0.2        react-native: 0.68.2 => 0.68.2        react-native-web: 0.17.7 => 0.17.7      npmGlobalPackages:       eas-cli: 0.52.0       expo-cli: 5.4.6     Expo Workflow: managed   ### Reproducible demo  https://snack.expo.dev/B_VvQ8X6Y
  **Post-Mortem & Fix Analysis**:
  > Thank you for filing this issue!   This comment acknowledges we believe this may be a bug and there’s enough information to investigate it.   However, we can’t promise any sort of timeline for resolution. We prioritize issues based on severity, breadth of impact, and alignment with our roadmap. If you’d like to help move it more quickly, you can continue to investigate it more deeply and/or you can open a pull request that fixes the cause. 
  > Seems to be very similar to this one: https://github.com/expo/expo/issues/17786
  > The fix will be published with Expo SDK 46 (soon)

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

### Incident Patch 1: `2a3ac5d5` (2026-10-05)
**Commit Message**: fix(cli): Replace `resolve-from` with `@expo/require-utils`' `resolveFrom` in `resolveLocalTemplate.ts` (#51125)

# Why

The `resolve-from` package only goes through Node resolution, which can
act differently in the presence of `package.json:exports` and block the
resolution. Adding this in #50988 fixes this, but we should apply and
backport a secondary fix to also perform file resolution via
`@expo/require-utils`' `resolveFrom` to allow for the file itself to
take precedence.

Side-note: Eventually more package existence checks and resolutions
should move to `@expo/require-utils` but pulling this change ahead now
makes more sense for consistency with the other filed PR.

# How

- Replace `resolve-from` with `@expo/require-utils` for
`resolveLocalTemplate.ts`

NOTE: Only this PR will need to be backported, since the resolution is
then agnostic to the `package.json:exports['./template.tgz']` entry
existing.

# Test Plan

- Existing unit tests cover this change

# Checklist

<!--
Please check the appropriate items below if they apply to your diff.
-->

- [x] I added a changeset and followed [this short
guide](https://github.com/expo/expo/blob/main/CONTRIBUTING.md#-before-submitting)


**File**: `.changeset/slick-games-jump.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@expo/cli': patch
+---
+
+Replace `resolve-from` with `@expo/require-utils` for `expo/template.tgz` resolution to allow for direct file resolution.
```

**File**: `packages/@expo/cli/src/prebuild/resolveLocalTemplate.ts` (modified, +6/-2)
```diff
@@ -1,7 +1,7 @@
 import type { ExpoConfig } from '@expo/config';
+import { resolveFrom } from '@expo/require-utils';
 import fs from 'fs';
 import path from 'path';
-import resolveFrom from 'resolve-from';
 
 import { packNpmTarballAsync, extractLocalNpmTarballAsync } from '../utils/npm';
 import { debugEvent } from './events';
@@ -45,7 +45,11 @@ export async function resolveLocalTemplateAsync({
     }
   } else {
     // The default is to use `expo/template.tgz` which exists in all published versions of it
-    templatePath = resolveFrom(projectRoot, 'expo/template.tgz');
+    const resolvedTemplatePath = resolveFrom(projectRoot, 'expo/template.tgz', { extensions: [] });
+    if (!resolvedTemplatePath) {
+      throw new Error(`Cannot resolve 'expo/template.tgz' from '${projectRoot}'`);
+    }
+    templatePath = resolvedTemplatePath;
     debugEvent('local_template_fallback', { path: debugEvent.path(templatePath) });
   }
 
```

---

### Incident Patch 2: `26da0871` (2026-10-05)
**Commit Message**: [expo] Export `template.tgz` so the local prebuild template resolves (#50988)

# Why

Fixes #50969

In SDK 58 the `expo` package has an `exports` map, and its `./*`
wildcard rewrites `expo/template.tgz` to `./template.tgz.js`, which
doesn't exist. `@expo/cli` finds the local prebuild template with
`resolveFrom(projectRoot, 'expo/template.tgz')`
(`packages/@expo/cli/src/prebuild/resolveLocalTemplate.ts`). That call
now always throws `MODULE_NOT_FOUND`, so prebuild never uses the
template shipped inside `expo`. Instead it falls back to downloading
`expo-template-bare-minimum` from npm, which also fails when you're
offline.

# How

Add an exact `"./template.tgz": "./template.tgz"` entry to
`packages/expo/package.json` `exports`. Node checks exact keys before
patterns, so this entry takes precedence over `./*`. `template.tgz` is
already in `files` and is created by the `prepack` script, so packaging
doesn't change. This follows the same approach as #50965.

# Test Plan

A script creates a throwaway project with `node_modules/expo` and
resolves `expo/template.tgz`, using both Node's `require.resolve` and
`resolve-from@5` (the resolver the CLI uses):

- `packages/expo/package.json` on `m

**File**: `.changeset/expo-template-tgz-export.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'expo': patch
+---
+
+Add `./template.tgz` to the `exports` map so `expo/template.tgz` resolves again. Before, the `./*` wildcard mapped it to the nonexistent `template.tgz.js`, so `expo prebuild` couldn't use the template bundled with `expo` and fell back to downloading one from npm.
```

**File**: `packages/expo/package.json` (modified, +1/-0)
```diff
@@ -178,6 +178,7 @@
     "./dom/entry.js": "./dom/entry.js",
     "./dom/entry": "./dom/entry.js",
     "./AppEntry.js": "./AppEntry.js",
+    "./template.tgz": "./template.tgz",
     "./virtual/*.js": "./virtual/*.js",
     "./virtual/*": "./virtual/*.js",
     "./scripts/*.js": "./scripts/*.js",
```

---

### Incident Patch 3: `e8434edc` (2026-10-05)
**Commit Message**: feat(require-utils): Support TypeScript 7.1 for transpilation and switch `importInterop` mode for TypeScript 7.0 fallback (#51076)

# Why

Related #47627
Resolves #47336
Supersedes #49566
Resolves #49564
Follow-up to #47759

This adds support for TypeScript 7.1's (unstable) transpilation API,
which reestablishes parity with TypeScript 6.x; It also alters the
`importInterop` mode for the `toCommonJS` fallback that's used for the
TypeScript 7.0 fallback, which would otherwise mismatch with TypeScript.

# How

- Add TypeScript transpiler wrapper
- Update codeframe handling
- Update `toCommonJS` to `importInterop: 'babel'` for TS fallback case

# Test Plan

- Unit tests added; manually tested

# Checklist

<!--
Please check the appropriate items below if they apply to your diff.
-->

- [x] I added a changeset and followed [this short
guide](https://github.com/expo/expo/blob/main/CONTRIBUTING.md#-before-submitting)
- [ ] This diff will work correctly for `npx expo prebuild` & EAS Build
(eg: updated a module plugin).
- [ ] Conforms with the [Documentation Writing Style
Guide](https://github.com/expo/expo/blob/main/guides/Expo%20Documentation%20Writing%20Style%20Guide.md)

**File**: `.changeset/icy-bottles-hide.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@expo/require-utils': patch
+---
+
+Support TypeScript 7.1 for transpiling TS modules.
```

**File**: `.changeset/two-cameras-design.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@expo/require-utils': patch
+---
+
+Switch TypeScript 7.0 fallback transpilation (stripTypeScriptTypes) to `importInterop: 'babel'`
```

**File**: `packages/@expo/require-utils/src/__tests__/fixtures/esmodule-plugin.js` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+exports.__esModule = true;
+exports.pluginName = 'test';
+exports.default = function withPlugin(config) {
+  return { ...config, pluginRan: true };
+};
```

**File**: `packages/@expo/require-utils/src/__tests__/load-test.ts` (modified, +48/-0)
```diff
@@ -52,6 +52,54 @@ describe('evalModule', () => {
     });
   });
 
+  it('preserves JavaScript default imports of marked CommonJS exports objects', () => {
+    const mod = evalModule(
+      `
+      import plugin from './esmodule-plugin.js';
+      const helpers = require('./example.js');
+      module.exports = plugin.default({ name: plugin.pluginName, value: helpers.test });
+      `,
+      path.join(basepath, 'eval.js')
+    );
+
+    expect(mod).toEqual({ name: 'test', value: 'test', pluginRan: true });
+  });
+
+  it.each(['available', 'missing', 'without transpilation'])(
+    'supports mixed imports and require when TypeScript is %s',
+    (typescript) => {
+      jest.isolateModules(() => {
+        const actualNodeModule = jest.requireActual('node:module');
+        const stripTypeScriptTypes = jest.fn((code: string) => code.replace(': Config', ''));
+        jest.doMock('node:module', () => ({ ...actualNodeModule, stripTypeScriptTypes }));
+        if (typescript === 'missing') {
+          jest.doMock('typescript', () => {
+            throw Object.assign(new Error("Cannot find module 'typescript'"), {
+              code: 'MODULE_NOT_FOUND',
+            });
+          });
+        } else if (typescript === 'without transpilation') {
+          jest.doMock('typescript', () => ({ version: '7.0.0' }));
+        }
+
+        const { evalModule } = require('../load') as typeof import('../load');
+        const mod = evalModule(
+          `
+          import withPlugin from './esmodule-plugin.js';
+          import plain from './example.js';
+          const { basename } = require('node:path');
+          const config: Config = { name: basename('/test'), value: plain.test };
+          module.exports = withPlugin(config);
+          `,
+          path.join(basepath, 'eval.ts')
+        );
+
+        expect(mod).toEqual({ name: 'test', value: 'test', pluginRan: true });
+        expect(stripTypeScriptTypes).toHaveBeenCalledTimes(typescript === 'available' ? 0 : 1);
+      });
+    }
+  );
+
   it('accepts .ts code and turns it to CommonJS with default imports', () => {
     const mod = evalModule(
       `
```

**File**: `packages/@expo/require-utils/src/__tests__/transform-test.ts` (added, +147/-0)
```diff
@@ -0,0 +1,147 @@
+import path from 'node:path';
+import vm from 'node:vm';
+
+import { toCommonJS } from '../transform';
+
+const filename = path.join(__dirname, 'fixtures', 'transform.js');
+
+function evaluate(
+  code: string,
+  dependencies: Record<string, unknown> = {},
+  importInterop?: 'node' | 'babel'
+) {
+  const mod = { exports: {} as any };
+  const requireDependency = (id: string) => {
+    if (!Object.hasOwn(dependencies, id)) {
+      throw new Error(`Unexpected require: ${id}`);
+    }
+    return dependencies[id];
+  };
+  const compiled = vm.compileFunction(toCommonJS(filename, code, importInterop), [
+    'module',
+    'exports',
+    'require',
+  ]);
+  compiled(mod, mod.exports, requireDependency);
+  return mod.exports;
+}
+
+describe('toCommonJS', () => {
+  it('defaults to importing the whole marked CommonJS exports object', () => {
+    const dependency = { __esModule: true, default: () => 'default', named: 'named' };
+    const result = evaluate('import value from "dep"; module.exports = value;', {
+      dep: dependency,
+    });
+
+    expect(result).toBe(dependency);
+  });
+
+  describe.each(['node', 'babel'] as const)('%s interop', (importInterop) => {
+    it('imports a plain CommonJS function as the default', () => {
+      const dependency = () => 'called';
+      const result = evaluate(
+        'import fn from "dep"; module.exports = fn();',
+        { dep: dependency },
+        importInterop
+      );
+
+      expect(result).toBe('called');
+    });
+
+    it('does not unwrap a default property without an __esModule marker', () => {
+      const dependency = { default: () => 'default', named: 'named' };
+      const result = evaluate(
+        'import value from "dep"; module.exports = value;',
+        { dep: dependency },
+        importInterop
+      );
+
+      expect(result).toBe(dependency);
+    });
+
+    it('selects the default import of a marked CommonJS module', () => {
+      const dependency = { __esModule: true, default: () => 'default', named: 'named' };
+      const result = evaluate(
+        'import value from "dep"; module.exports = value;',
+        { dep: dependency },
+        importInterop
+      );
+
+      expect(result).toBe(importInterop === 'node' ? dependency : dependency.default);
+    });
+
+    it('handles a marked CommonJS module with no default export', () => {
+      const dependency = { __esModule: true, named: 'named' };
+      const result = evaluate(
+        'import value from "dep"; module.exports = value;',
+        { dep: dependency },
+        importInterop
+      );
+
+      expect(result).toBe(importInterop === 'node' ? dependency : undefined);
+    });
+
+    it('preserves named imports from marked CommonJS modules', () => {
+      const result = evaluate(
+        'import { named } from "dep"; module.exports = named;',
+        { dep: { __esModule: true, named: 'named' } },
+        importInterop
+      );
+
+      expect(result).toBe('named');
+    });
+
+    it('selects the default member of a namespace import', () => {
+      const dependency = { __esModule: true, default: () => 'default', named: 'named' };
+      const result = evaluate(
+        'import * as ns from "dep"; module.exports = ns;',
+        { dep: dependency },
+        importInterop
+      );
+
+      expect(result.named).toBe('named');
+      expect(result.default).toBe(importInterop === 'node' ? dependency : dependency.default);
+    });
+
+    it('selects default re-exports while preserving named re-exports', () => {
+      const dependency = { __esModule: true, default: () => 'default', named: 'named' };
+      const result = evaluate(
+        'export { default, named } from "dep";',
+        { dep: dependency },
+        importInterop
+      );
+
+      expect(result.named).toBe('named');
+      expect(result.default).toBe(importInterop === 'node' ? dependency : dependency.default);
+    });
+
+    it('supports imports and require of different dependencies with mixed exports', () => {
+      const plugin = (config: object) => ({ ...config, pluginRan: true });
+      const result = evaluate(
+        `
+        import imported from 'plugin';
+        const helpers = require('helpers');
+        export const name = helpers.name;
+        exports.result = ${importInterop === 'node' ? 'imported.default' : 'imported'}(helpers);
+        `,
+        { plugin: { __esModule: true, default: plugin }, helpers: { name: 'test' } },
+        importInterop
+      );
+
+      expect(result.name).toBe('test');
+      expect(result.result).toEqual({ name: 'test', pluginRan: true });
+    });
+
+    it('handles a transformed dependency that mixes ESM and CommonJS exports', () => {
+      const dependency = evaluate('export const esmValue = 1; exports.cjsValue = 2;');
+      const result = evaluate(
+        'import value from "dep"; module.exports = value;',
+        { dep: dependency },
+        importInterop
+      );
+
+      expect(dependency).toEqual({ _
```

**File**: `packages/@expo/require-utils/src/__tests__/typescript-test.ts` (added, +201/-0)
```diff
@@ -0,0 +1,201 @@
+import { stripVTControlCharacters } from 'node:util';
+import * as ts from 'typescript';
+
+import { formatDiagnostic } from '../codeframe';
+
+describe('transpile', () => {
+  beforeEach(() => {
+    jest.doMock('typescript/unstable/sync', () => ({}), { virtual: true });
+    jest.doMock('typescript/unstable/proto', () => ({}), { virtual: true });
+  });
+
+  afterEach(() => {
+    jest.dontMock('typescript');
+    jest.dontMock('typescript/unstable/sync');
+    jest.dontMock('typescript/unstable/proto');
+  });
+
+  function withTranspiler(run: (transpile: typeof import('../typescript').transpile) => void) {
+    jest.isolateModules(() => {
+      run(require('../typescript').transpile);
+    });
+  }
+
+  it('caches the fallback when TypeScript is missing', () => {
+    const load = jest.fn(() => {
+      throw Object.assign(new Error("Cannot find module 'typescript'"), {
+        code: 'MODULE_NOT_FOUND',
+      });
+    });
+    jest.doMock('typescript', load);
+    withTranspiler((transpile) => {
+      expect(transpile('', 'first.ts', 'typescript')).toBeUndefined();
+      expect(transpile('', 'second.ts', 'typescript')).toBeUndefined();
+      expect(load).toHaveBeenCalledTimes(1);
+    });
+  });
+
+  it('bails out for TypeScript 7.0 without the synchronous API export', () => {
+    jest.doMock('typescript', () => ({ version: '7.0.0' }));
+    jest.doMock('typescript/unstable/sync', () => {
+      throw Object.assign(new Error('Package subpath is not exported'), {
+        code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
+      });
+    });
+    withTranspiler((transpile) => {
+      expect(transpile('const a: number = 1;', 'test.ts', 'typescript')).toBeUndefined();
+    });
+  });
+
+  it.each(['commonjs-typescript', 'module-typescript', 'typescript'] as const)(
+    'transpiles with the legacy API in %s mode',
+    (format) => {
+      withTranspiler((transpile) => {
+        const output = transpile('export const a: number = 1;', 'test.ts', format);
+        expect(output?.outputText).not.toContain(': number');
+        expect(output?.outputText).toContain('sourceMappingURL=data:application/json');
+        if (format === 'commonjs-typescript') {
+          expect(output?.outputText).toContain('exports.a');
+        } else {
+          expect(output?.outputText).toContain('export const a');
+        }
+      });
+    }
+  );
+
+  it('preserves scripts without introducing an export in preserve mode', () => {
+    withTranspiler((transpile) => {
+      const output = transpile('module.exports = 1 as number;', 'test.ts', 'typescript');
+      expect(output?.outputText).toContain('module.exports = 1;');
+      expect(output?.outputText).not.toContain('export {}');
+    });
+  });
+
+  it('normalizes legacy diagnostics for code frames', () => {
+    withTranspiler((transpile) => {
+      const code = 'const value: = 1;';
+      const output = transpile(code, 'test.ts', 'typescript');
+      expect(output?.diagnostic).toEqual({
+        message: 'Type expected.',
+        loc: { line: 1, column: 14 },
+      });
+      const error = formatDiagnostic(code, output?.diagnostic);
+      expect(error).toBeInstanceOf(SyntaxError);
+      expect(stripVTControlCharacters(error?.codeFrame ?? '')).toContain(code);
+    });
+  });
+
+  it('rethrows errors loading an installed compiler', () => {
+    const error = new Error('Broken compiler');
+    jest.doMock('typescript', () => {
+      throw error;
+    });
+    withTranspiler((transpile) => {
+      expect(() => transpile('', 'test.ts', 'typescript')).toThrow(error);
+    });
+  });
+
+  it('bails out if the native export does not expose an API constructor', () => {
+    jest.doMock('typescript', () => ({ version: '7.1.0' }));
+    withTranspiler((transpile) => {
+      expect(transpile('', 'test.ts', 'typescript')).toBeUndefined();
+    });
+  });
+
+  it('bails out for a native API without transpilation before starting a compiler process', () => {
+    const API = jest.fn();
+    jest.doMock('typescript', () => ({ version: '7.0.2' }));
+    jest.doMock('typescript/unstable/sync', () => ({ API }), { virtual: true });
+    withTranspiler((transpile) => {
+      expect(transpile('', 'test.ts', 'typescript')).toBeUndefined();
+      expect(API).not.toHaveBeenCalled();
+    });
+  });
+
+  it('uses the native export and its enums, and reuses the API instance', () => {
+    const transpileModule = jest.fn(() => ({ outputText: 'module.exports = 1;' }));
+    const API = jest.fn(() => ({ transpileModule }));
+    Object.defineProperty(API.prototype, 'transpileModule', {
+      get() {
+        throw new Error('The transpileModule getter must not be invoked on the prototype');
+      },
+    });
+    // Deliberately omit a version: capability detection must depend on exports.
+    jest.doMock('typescript', () => ({}));
+    jest.doMock('typescript/unstable/sync', () => ({ API }), { virtual: true });
+    jest.doMock(
+      'typescript/unstable/proto',
+   
```

**File**: `packages/@expo/require-utils/src/codeframe.ts` (modified, +10/-8)
```diff
@@ -1,5 +1,9 @@
 import url from 'node:url';
-import type { Diagnostic } from 'typescript';
+
+export interface Diagnostic {
+  message: string;
+  loc?: { line: number; column: number };
+}
 
 function errorToLoc(filename: string, error: Error) {
   if (typeof error.name === 'string' && typeof error.stack === 'string') {
@@ -14,17 +18,15 @@ function errorToLoc(filename: string, error: Error) {
   return null;
 }
 
-export function formatDiagnostic(diagnostic: Diagnostic | undefined) {
+export function formatDiagnostic(code: string, diagnostic: Diagnostic | undefined) {
   if (!diagnostic) {
     return null;
   }
-  const { start, file, messageText } = diagnostic;
-  if (file && messageText && start != null) {
+  const { loc, message } = diagnostic;
+  if (loc && message) {
     const { codeFrameColumns }: typeof import('@babel/code-frame') = require('@babel/code-frame');
-    const { line, character } = file.getLineAndCharacterOfPosition(start);
-    const loc = { line: line + 1, column: character + 1 };
-    const codeFrame = codeFrameColumns(file.getText(), { start: loc }, { highlightCode: true });
-    const annotatedError = new SyntaxError(`${messageText}\n${codeFrame}`) as SyntaxError & {
+    const codeFrame = codeFrameColumns(code, { start: loc }, { highlightCode: true });
+    const annotatedError = new SyntaxError(`${message}\n${codeFrame}`) as SyntaxError & {
       codeFrame: string;
     };
     annotatedError.codeFrame = codeFrame;
```

**File**: `packages/@expo/require-utils/src/load.ts` (modified, +10/-60)
```diff
@@ -4,11 +4,11 @@ import os from 'node:os';
 import path from 'node:path';
 import url from 'node:url';
 import vm from 'node:vm';
-import type * as ts from 'typescript';
 
-import { annotateError, formatDiagnostic } from './codeframe';
+import { annotateError, formatDiagnostic, type Diagnostic } from './codeframe';
 import { installSourceMapStackTrace } from './stacktrace';
 import { toCommonJS } from './transform';
+import { transpile } from './typescript';
 
 declare module 'node:module' {
   export function _nodeModulePaths(base: string): readonly string[];
@@ -29,28 +29,6 @@ declare global {
   }
 }
 
-let _ts: typeof import('typescript') | null | undefined;
-function loadTypescript() {
-  if (_ts === undefined) {
-    try {
-      _ts = require('typescript');
-      // NOTE(@kitten): typescript v7 ships without the necessary compiler/public APIs to use it
-      // for transpilation or other purposes
-      if (typeof _ts?.transpileModule !== 'function') {
-        _ts = null;
-        return null;
-      }
-    } catch (error: any) {
-      if (error.code !== 'MODULE_NOT_FOUND') {
-        throw error;
-      } else {
-        _ts = null;
-      }
-    }
-  }
-  return _ts;
-}
-
 const parent = module;
 
 const tsExtensionMapping: Record<string, string | undefined> = {
@@ -303,52 +281,24 @@ function evalModule(
 
   let inputCode = code;
   let inputFilename = filename;
-  let diagnostic: ts.Diagnostic | undefined;
+  let diagnostic: Diagnostic | undefined;
   if (
     format.mode === 'typescript' ||
     format.mode === 'module-typescript' ||
     format.mode === 'commonjs-typescript'
   ) {
-    const ts = loadTypescript();
-
-    if (ts) {
-      let module: ts.ModuleKind;
-      if (format.mode === 'commonjs-typescript') {
-        module = ts.ModuleKind.CommonJS;
-      } else if (format.mode === 'module-typescript') {
-        module = ts.ModuleKind.ESNext;
-      } else {
-        // NOTE(@kitten): We can "preserve" the output, meaning, it can either be ESM or CJS
-        // and stop TypeScript from either transpiling it to CommonJS or adding an `export {}`
-        // if no exports are used. This allows the user to choose if this file is CJS or ESM
-        // (but not to mix both)
-        module = ts.ModuleKind.Preserve;
-      }
-      const output = ts.transpileModule(code, {
-        fileName: filename,
-        reportDiagnostics: true,
-        compilerOptions: {
-          module,
-          moduleResolution: ts.ModuleResolutionKind.Bundler,
-          // `verbatimModuleSyntax` needs to be off, to erase as many imports as possible
-          verbatimModuleSyntax: false,
-          target: ts.ScriptTarget.ESNext,
-          newLine: ts.NewLineKind.LineFeed,
-          inlineSourceMap: true,
-          esModuleInterop: true,
-        },
-      });
-      inputCode = output?.outputText || inputCode;
-      if (output?.diagnostics?.length) {
-        diagnostic = output.diagnostics[0];
-      }
+    const output = transpile(code, filename, format.mode);
+    if (output) {
+      inputCode = output.outputText;
+      diagnostic = output.diagnostic;
     }
 
     if (hasStripTypeScriptTypes && inputCode === code) {
       // This may throw its own error, but this contains a code-frame already
       inputCode = stripTypeScriptTypes(code);
       if (format.mode === 'commonjs-typescript') {
-        inputCode = toCommonJS(filename, inputCode);
+        // NOTE(@kitten): Match TypeScript's CommonJS emit with esModuleInterop enabled.
+        inputCode = toCommonJS(filename, inputCode, 'babel');
       }
     }
 
@@ -384,7 +334,7 @@ function evalModule(
   } catch (error: any) {
     // If we have a diagnostic from TypeScript, we issue its error with a codeframe first,
     // since it's likely more useful than the eval error
-    const diagnosticError = formatDiagnostic(diagnostic);
+    const diagnosticError = formatDiagnostic(code, diagnostic);
     if (diagnosticError) {
       throw diagnosticError;
     }
```

---

### Incident Patch 4: `19ce7f44` (2026-10-05)
**Commit Message**: [android][ui] Apply `containerColor` to `TimePickerDialog` (#51116)

> [!WARNING]
> **Agent-authored and NOT human-reviewed.** An automated `/verify
--fix` run for #51111 wrote this change and checked it in a sandbox; the
reasoning and evidence are in the outcome comment on that issue. Review
it as you would any external contribution.

Requested by @intergalacticspacehighway · [investigation
run](https://github.com/expo/expo/actions/runs/37338096413) · refs
#51111

Fixes #51111

On Android, `TimePickerDialog` ignores `elementColors.containerColor`
(#51111). `ExpoTimePickerDialogContent` in `DatePickerView.kt` puts the
Material3 `TimePicker` in an `AlertDialog`, but does not give the color
to that dialog. `TimePicker` does not paint a container, so the color is
lost.

This change passes `timePickerColors.containerColor` to the
`AlertDialog`. When an app does not set `containerColor`, the color does
not change: in Material3 both the old default
(`AlertDialogDefaults.containerColor`) and the new one
(`TimePickerDefaults.colors().containerColor`) are
`SurfaceContainerHigh`.

On an Android emulator, the patched release build shows the red
container and the unpatched build does not; a ti

**File**: `.changeset/expo-ui-time-picker-dialog-container-color.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@expo/ui': patch
+---
+
+[Android] Fix `TimePickerDialog` ignoring `elementColors.containerColor`.
```

**File**: `packages/expo-ui/android/src/main/java/expo/modules/ui/DatePickerView.kt` (modified, +1/-0)
```diff
@@ -451,6 +451,7 @@ fun ExpoTimePickerDialogContent(props: TimePickerDialogProps, onDateSelected: (D
         Text(props.dismissButtonLabel ?: stringResource(android.R.string.cancel))
       }
     },
+    containerColor = timePickerColors.containerColor,
     text = {
       TimePicker(
         state = state,
```

---

### Incident Patch 5: `52a8b20a` (2026-10-05)
**Commit Message**: [android][camera] Fix barcode scanning stalling on frames without an image (#51050)

# Why

`BarcodeAnalyzer` closed the `ImageProxy` only when `imageProxy.image`
was not null. The analysis use case uses `STRATEGY_KEEP_ONLY_LATEST`, so
CameraX delivers no more frames until the current one is closed. One
frame without an image stopped barcode scanning until the camera was
recreated.

Also, every `createCamera` made a new ML Kit `BarcodeScanner` client,
and nothing closed the old one.

# How

- A frame without an image is now closed immediately.
- `BarcodeAnalyzer` implements `Closeable` and closes its ML Kit client.
- `ExpoCameraView` keeps a reference to the analyzer. It clears and
closes the analyzer before it builds a new one, and in
`cleanupCamera()`. Both run on the main thread, which is also where the
analyzer runs, so `close()` cannot run during `analyze()`.
- The scanner is now a constructor parameter, so the analyzer can be
tested without ML Kit. A secondary constructor keeps the `(formats,
onComplete)` call, so a client creation error is still caught in
`createImageAnalyzer`.

# Test Plan

New `BarcodeAnalyzerTest`:
- a frame without an image is closed
- `close()` closes t

**File**: `.changeset/camera-barcode-analyzer-close.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'expo-camera': patch
+---
+
+[Android] Fixed barcode scanning stopping after the camera delivers a frame without an image. Also fixed a leak of the ML Kit barcode scanner each time the camera is recreated or unmounted.
```

**File**: `packages/expo-camera/android/build.gradle` (modified, +1/-0)
```diff
@@ -52,4 +52,5 @@ dependencies {
 
   testImplementation "org.robolectric:robolectric:4.16"
   testImplementation 'junit:junit:4.13.2'
+  testImplementation 'io.mockk:mockk:1.14.9'
 }
```

**File**: `packages/expo-camera/android/src/main/java/expo/modules/camera/ExpoCameraView.kt` (modified, +14/-6)
```diff
@@ -128,6 +128,7 @@ class ExpoCameraView(
   private var cameraProvider: ProcessCameraProvider? = null
   private var imageCaptureUseCase: ImageCapture? = null
   private var imageAnalysisUseCase: ImageAnalysis? = null
+  private var barcodeAnalyzer: BarcodeAnalyzer? = null
   private var recorder: Recorder? = null
   private var barcodeFormats: List<BarcodeType> = emptyList()
   private var glSurfaceTexture: SurfaceTexture? = null
@@ -529,6 +530,7 @@ class ExpoCameraView(
       .filter(cameraProvider.availableCameraInfos)
       .firstOrNull()
     val videoCapture = createVideoCapture(selectedCameraInfo)
+    releaseBarcodeAnalyzer()
     imageAnalysisUseCase = if (shouldScanBarcodes) {
       createImageAnalyzer()
     } else {
@@ -571,18 +573,23 @@ class ExpoCameraView(
       .also { analyzer ->
         if (shouldScanBarcodes && CameraUtils.isMLKitBarcodeScannerAvailable()) {
           try {
-            analyzer.setAnalyzer(
-              ContextCompat.getMainExecutor(context),
-              BarcodeAnalyzer(barcodeFormats) {
-                onBarcodeScanned(it)
-              }
-            )
+            barcodeAnalyzer = BarcodeAnalyzer(barcodeFormats) {
+              onBarcodeScanned(it)
+            }.also {
+              analyzer.setAnalyzer(ContextCompat.getMainExecutor(context), it)
+            }
           } catch (e: Exception) {
             Log.e(CameraViewModule.TAG, "Failed to initialize BarcodeAnalyzer: ${e.message}")
           }
         }
       }
 
+  private fun releaseBarcodeAnalyzer() {
+    imageAnalysisUseCase?.clearAnalyzer()
+    barcodeAnalyzer?.close()
+    barcodeAnalyzer = null
+  }
+
   private fun buildResolutionSelector(): ResolutionSelector {
     val strategy = if (pictureSize.isNotEmpty()) {
       val size = parseSizeSafely(pictureSize)
@@ -891,6 +898,7 @@ class ExpoCameraView(
     orientationEventListener.disable()
     cancelCoroutineScope()
     cameraProvider?.unbindAll()
+    releaseBarcodeAnalyzer()
     glSurfaceTexture?.release()
   }
 }
```

**File**: `packages/expo-camera/android/src/main/java/expo/modules/camera/analyzers/BarcodeAnalyzer.kt` (modified, +29/-13)
```diff
@@ -5,26 +5,27 @@ import androidx.annotation.OptIn
 import androidx.camera.core.ExperimentalGetImage
 import androidx.camera.core.ImageAnalysis
 import androidx.camera.core.ImageProxy
+import com.google.mlkit.vision.barcode.BarcodeScanner
 import com.google.mlkit.vision.barcode.BarcodeScannerOptions
 import com.google.mlkit.vision.barcode.BarcodeScanning
 import com.google.mlkit.vision.common.InputImage
 import expo.modules.camera.records.BarcodeType
 import expo.modules.camera.utils.BarCodeScannerResult
+import java.io.Closeable
 
 @OptIn(ExperimentalGetImage::class)
-class BarcodeAnalyzer(formats: List<BarcodeType>, val onComplete: (BarCodeScannerResult) -> Unit) : ImageAnalysis.Analyzer {
-  private val barcodeFormats = if (formats.isEmpty()) {
-    0
-  } else {
-    formats.map { it.mapToBarcode() }.reduce { acc, it ->
-      acc or it
-    }
-  }
-  private var barcodeScannerOptions =
-    BarcodeScannerOptions.Builder()
-      .setBarcodeFormats(barcodeFormats)
-      .build()
-  private var barcodeScanner = BarcodeScanning.getClient(barcodeScannerOptions)
+class BarcodeAnalyzer(
+  private val barcodeScanner: BarcodeScanner,
+  val onComplete: (BarCodeScannerResult) -> Unit
+) : ImageAnalysis.Analyzer, Closeable {
+  constructor(formats: List<BarcodeType>, onComplete: (BarCodeScannerResult) -> Unit) : this(
+    BarcodeScanning.getClient(
+      BarcodeScannerOptions.Builder()
+        .setBarcodeFormats(barcodeFormats(formats))
+        .build()
+    ),
+    onComplete
+  )
 
   override fun analyze(imageProxy: ImageProxy) {
     val mediaImage = imageProxy.image
@@ -84,8 +85,14 @@ class BarcodeAnalyzer(formats: List<BarcodeType>, val onComplete: (BarCodeScanne
         .addOnCompleteListener {
           imageProxy.close()
         }
+    } else {
+      imageProxy.close()
     }
   }
+
+  override fun close() {
+    barcodeScanner.close()
+  }
 }
 
 fun Array<ImageProxy.PlaneProxy>.toByteArray(): ByteArray {
@@ -102,3 +109,12 @@ fun Array<ImageProxy.PlaneProxy>.toByteArray(): ByteArray {
 
   return result
 }
+
+private fun barcodeFormats(formats: List<BarcodeType>): Int =
+  if (formats.isEmpty()) {
+    0
+  } else {
+    formats.map { it.mapToBarcode() }.reduce { acc, it ->
+      acc or it
+    }
+  }
```

**File**: `packages/expo-camera/android/src/test/java/expo/modules/camera/analyzers/BarcodeAnalyzerTest.kt` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+package expo.modules.camera.analyzers
+
+import androidx.annotation.OptIn
+import androidx.camera.core.ExperimentalGetImage
+import androidx.camera.core.ImageProxy
+import com.google.mlkit.vision.barcode.BarcodeScanner
+import io.mockk.every
+import io.mockk.mockk
+import io.mockk.verify
+import org.junit.Test
+
+@OptIn(ExperimentalGetImage::class)
+class BarcodeAnalyzerTest {
+  private val scanner = mockk<BarcodeScanner>(relaxed = true)
+  private val analyzer = BarcodeAnalyzer(scanner) {}
+
+  @Test
+  fun closesFrameWithoutImage() {
+    val frame = mockk<ImageProxy>(relaxed = true) {
+      every { image } returns null
+    }
+
+    analyzer.analyze(frame)
+
+    verify(exactly = 1) { frame.close() }
+  }
+
+  @Test
+  fun closingAnalyzerClosesScanner() {
+    analyzer.close()
+
+    verify(exactly = 1) { scanner.close() }
+  }
+}
```

---

### Incident Patch 6: `7c9b0878` (2026-10-05)
**Commit Message**: [require-utils] Fix crash when a stack frame's source map failed to load (#51089)

# Why

On Node before v22.14.0, any `console.log` in an API route kills `expo
start` on the first request:

```
TypeError: The "payload" argument must be of type object. Received null
    at cloneSourceMapV3 (node:internal/source_map/source_map:365:3)
    at new SourceMap (node:internal/source_map/source_map:145:21)
    at Object.findSourceMap (node:internal/source_map/source_map_cache:348:17)
    at wrapCallSite (.../@expo/require-utils/build/stacktrace.js:138:30)
    at Error.prepareStackTrace (.../@expo/require-utils/build/stacktrace.js:103:38)
```

`compileModule` hands the bundle's source map to Node through a
`sourceMappingURL` file. Metro 0.87 emits an index map (`sections`, no
top-level `sources`), which Node can't load from a file, so it caches an
entry with a `null` payload. Before nodejs/node#56299 (v22.14.0,
v23.6.0), `module.findSourceMap` then throws for that module instead of
returning `undefined`.

The `console.log` override in `serverLogLikeMetro` captures a stack, so
`prepareStackTrace` throws from inside the route handler. The error
handler then formats that error's stack, which th

**File**: `.changeset/require-utils-find-source-map-throws.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+'@expo/require-utils': patch
+'@expo/cli': patch
+---
+
+Fix `expo start` exiting on Node before v22.14.0 when an API route calls `console.log`. Stack frames whose source map fails to load are printed without source mapping instead of throwing.
```

**File**: `packages/@expo/require-utils/src/__tests__/stacktrace-test.ts` (modified, +22/-0)
```diff
@@ -433,6 +433,28 @@ describe('source-mapped frames', () => {
 `);
   });
 
+  it('falls back to V8 format when findSourceMap throws', () => {
+    // Node before v22.14.0 throws for a module whose source map failed to load
+    findSourceMap.mockImplementation((file: string) => {
+      if (file === '/bundle.js') {
+        throw new TypeError('The "payload" argument must be of type object. Received null');
+      }
+      return undefined;
+    });
+    const site = mockCallSite({
+      isToplevel: true,
+      fileName: '/bundle.js',
+      scriptNameOrSourceURL: '/bundle.js',
+      lineNumber: 1,
+      columnNumber: 1,
+      functionName: 'render',
+    });
+    expect(prepareStackTrace(new Error('e'), [site])).toMatchInlineSnapshot(`
+"Error: e
+    at render (/bundle.js:1:1)"
+`);
+  });
+
   it('falls back to V8 format when findEntry returns no originalSource', () => {
     findSourceMap.mockReturnValue({ findEntry: () => ({}) } as unknown as ReturnType<
       typeof nodeModule.findSourceMap
```

**File**: `packages/@expo/require-utils/src/stacktrace.ts` (modified, +12/-1)
```diff
@@ -110,7 +110,7 @@ function wrapCallSite(site: NodeJS.CallSite, state: WalkState): string {
     return String(site);
   }
 
-  const sm = nodeModule.findSourceMap(scriptName);
+  const sm = findSourceMap(scriptName);
   if (!sm) {
     state.curPosition = null;
     return String(site);
@@ -154,6 +154,17 @@ function wrapCallSite(site: NodeJS.CallSite, state: WalkState): string {
   return String(wrapped);
 }
 
+function findSourceMap(scriptName: string): nodeModule.SourceMap | undefined {
+  try {
+    return nodeModule.findSourceMap(scriptName);
+  } catch {
+    // Before v22.14.0 and v23.6.0, Node throws here for a module whose source map it failed
+    // to load, such as an index map (with `sections`). Throwing from `prepareStackTrace`
+    // replaces the error being formatted, so fall back to the unmapped frame instead.
+    return undefined;
+  }
+}
+
 function maybeFileURLToPath(maybeFileURL: string): string {
   if (maybeFileURL.startsWith('file://')) {
     let pathname = maybeFileURL.slice('file://'.length);
```

---

### Incident Patch 7: `ca6c3543` (2026-10-05)
**Commit Message**: [packages] Fix missing app.plugin.js export in expo-web-browser and expo-image (#51059)

# Summary

**Context**

`eas build` can fail on SDK 58 apps that use `expo-web-browser` or
`expo-image`, because EAS CLI can't find their config plugins
(`app.plugin.js`). This stack fixes both packages and warns when a
package has the same gap.

Seen in an SDK 58 Preview app:

<img width="1621" height="241" alt="image"
src="https://github.com/user-attachments/assets/7376b979-e885-4502-b585-9c5afc891e4e"
/>

**Cause**

The Turborepo migration (#46801) added `exports` maps to both packages
with only `.` and `./package.json`. Before it, neither package had an
`exports` map, so Node could resolve any subpath. #50965 later restored
`./plugin` but not `./app.plugin.js`.

- This specifically occurred in EAS CLI's iOS entitlements fallback
(`@expo/config-plugins` 55.0.7), present in my fresh SDK 58 project
dependencies, which uses Node resolution.
- In contrast, SDK 58 tooling doesn't notice because
`@expo/require-utils`' `resolveFrom` checks the file on disk before Node
resolution.

**Fix**

Add `./app.plugin.js` to both exports maps.

**No other Expo package is affected.** Of the 46 that ship an
`ap

**File**: `.changeset/app-plugin-subpath-exports.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+'expo-image': patch
+'expo-web-browser': patch
+---
+
+Export `app.plugin.js` from `package.json:exports` so tools that resolve config plugins through Node's package exports, such as the config fallback in EAS CLI, find the config plugin again instead of failing with "Unable to resolve a valid config plugin".
```

**File**: `packages/expo-image/package.json` (modified, +1/-0)
```diff
@@ -25,6 +25,7 @@
       "expo-source": "./src/index.ts",
       "default": "./build/index.js"
     },
+    "./app.plugin.js": "./app.plugin.js",
     "./plugin": "./plugin/build/index.js",
     "./package.json": "./package.json"
   },
```

**File**: `packages/expo-web-browser/package.json` (modified, +1/-0)
```diff
@@ -32,6 +32,7 @@
       "expo-source": "./src/WebBrowser.ts",
       "default": "./build/WebBrowser.js"
     },
+    "./app.plugin.js": "./app.plugin.js",
     "./plugin": "./plugin/build/index.js",
     "./package.json": "./package.json"
   },
```

---

### Incident Patch 8: `1ef42ab2` (2026-10-05)
**Commit Message**: [ui][ios] Add ArrangementView (#50893)

# Why

Add SwiftUI
[`ArrangementView`](https://developer.apple.com/documentation/swiftui/arrangementview)
(iOS 27.1), the layout container Apple recommends for adapting to
[iPhone
Duo](https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo)
poses and the fold.

# How

- Add `ArrangementView` with `ArrangementView.Primary` and
`ArrangementView.Secondary` slots.
- Add `arrangementViewStyle` (`automatic` / `split` / `overlay`, with
`axes`), `splitArrangementLayoutRatio`, `splitArrangementLayoutSize`,
`splitArrangementFixedLayoutSize`, and `overlayArrangementEdge`
modifiers.
- Below iOS 27.1, `ArrangementView` renders its children without a
container, and the modifiers have no effect.
- Gate on `#if canImport(SwiftUICore, _version: 8.0.85)` instead of
`compiler(>=6.4)`. Xcode 27.1 ships the iOS 27.1 SDK (SwiftUICore
8.0.85) together with the tvOS/macOS/visionOS 27.0 SDKs (8.0.84), all on
Swift 6.4.0, so a compiler check would fail to build on those SDKs.
- Add an NCL example.
- Docs in upcoming PR.


# Test Plan

Compile-only build of the `ExpoUI` target in bare-expo with Xcode 27.1.



https://github.com/user-atta

**File**: `.changeset/expo-ui-arrangement-view.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@expo/ui': patch
+---
+
+[iOS] Add `ArrangementView` component and `arrangementViewStyle`, `splitArrangementLayoutRatio`, `splitArrangementLayoutSize`, `splitArrangementFixedLayoutSize`, and `overlayArrangementEdge` modifiers.
```

**File**: `apps/native-component-list/src/screens/UI/ArrangementViewScreen.ios.tsx` (added, +136/-0)
```diff
@@ -0,0 +1,136 @@
+import { ArrangementView, Host, Image, Picker, ScrollView, Text, VStack } from '@expo/ui/swift-ui';
+import {
+  arrangementViewStyle,
+  background,
+  clipShape,
+  disabled,
+  font,
+  foregroundStyle,
+  frame,
+  overlayArrangementEdge,
+  padding,
+  pickerStyle,
+  splitArrangementLayoutRatio,
+  tag,
+  type ArrangementViewStyle,
+} from '@expo/ui/swift-ui/modifiers';
+import * as React from 'react';
+
+type Axes = 'both' | 'horizontal' | 'vertical';
+
+const STYLES: ArrangementViewStyle[] = ['automatic', 'split', 'overlay'];
+const AXES: Axes[] = ['both', 'horizontal', 'vertical'];
+const RATIOS = [0, 0.3, 0.5];
+
+const LYRICS = [
+  'Fold the page and keep the song',
+  'Half for the words, half for the sound',
+  'Open wide, the room grows long',
+  'Close it up, it comes back around',
+  'Tilt it like a book in hand',
+  'The lines move over, make some space',
+  'Nothing lost along the bend',
+  'Every verse still in its place',
+];
+
+export default function ArrangementViewScreen() {
+  const [style, setStyle] = React.useState<ArrangementViewStyle>('automatic');
+  const [axes, setAxes] = React.useState<Axes>('both');
+  const [ratio, setRatio] = React.useState(0);
+
+  const styleModifier =
+    style === 'automatic'
+      ? arrangementViewStyle('automatic')
+      : arrangementViewStyle(style, { axes });
+
+  // In overlay style the primary is drawn on top of the secondary, so keep it a small card
+  // instead of a full-bleed pane.
+  const primaryModifiers =
+    style === 'overlay'
+      ? [
+          overlayArrangementEdge('trailing'),
+          padding({ all: 16 }),
+          background('#5B4BDB'),
+          clipShape('roundedRectangle', 16),
+          padding({ all: 16 }),
+        ]
+      : [
+          ...(ratio > 0 ? [splitArrangementLayoutRatio(ratio)] : []),
+          frame({ maxWidth: Infinity, maxHeight: Infinity }),
+          background('#5B4BDB'),
+        ];
+
+  return (
+    <Host style={{ flex: 1 }}>
+      <VStack spacing={8}>
+        <VStack spacing={8} modifiers={[padding({ horizontal: 16, top: 8 })]}>
+          <Picker
+            modifiers={[pickerStyle('segmented')]}
+            selection={style}
+            onSelectionChange={setStyle}>
+            {STYLES.map((value) => (
+              <Text key={value} modifiers={[tag(value)]}>
+                {value}
+              </Text>
+            ))}
+          </Picker>
+          <Picker
+            modifiers={[pickerStyle('segmented'), disabled(style === 'automatic')]}
+            selection={axes}
+            onSelectionChange={setAxes}>
+            {AXES.map((value) => (
+              <Text key={value} modifiers={[tag(value)]}>
+                {`axes: ${value}`}
+              </Text>
+            ))}
+          </Picker>
+          <Picker
+            modifiers={[pickerStyle('segmented'), disabled(style === 'overlay')]}
+            selection={ratio}
+            onSelectionChange={setRatio}>
+            {RATIOS.map((value) => (
+              <Text key={value} modifiers={[tag(value)]}>
+                {value === 0 ? 'ratio: default' : `ratio: ${value}`}
+              </Text>
+            ))}
+          </Picker>
+        </VStack>
+
+        <ArrangementView
+          modifiers={[styleModifier, frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
+          <ArrangementView.Primary>
+            <VStack spacing={12} modifiers={primaryModifiers}>
+              <Image systemName="music.note" size={64} color="white" />
+              <Text modifiers={[font({ size: 22, weight: 'bold' }), foregroundStyle('white')]}>
+                Primary: Now Playing
+              </Text>
+              <Text modifiers={[foregroundStyle('white')]}>The Fold - Two Displays</Text>
+            </VStack>
+          </ArrangementView.Primary>
+          <ArrangementView.Secondary>
+            <ScrollView
+              modifiers={[
+                frame({ maxWidth: Infinity, maxHeight: Infinity }),
+                background('#1F8A70'),
+              ]}>
+              <VStack alignment="leading" spacing={12} modifiers={[padding({ all: 20 })]}>
+                <Text modifiers={[font({ size: 22, weight: 'bold' }), foregroundStyle('white')]}>
+                  Secondary: Lyrics
+                </Text>
+                {LYRICS.map((line) => (
+                  <Text key={line} modifiers={[font({ size: 18 }), foregroundStyle('white')]}>
+                    {line}
+                  </Text>
+                ))}
+              </VStack>
+            </ScrollView>
+          </ArrangementView.Secondary>
+        </ArrangementView>
+      </VStack>
+    </Host>
+  );
+}
+
+ArrangementViewScreen.navigationOptions = {
+  title: 'ArrangementView',
+};
```

**File**: `apps/native-component-list/src/screens/UI/UIScreen.ios.tsx` (modified, +8/-0)
```diff
@@ -178,6 +178,14 @@ export const UIScreens = [
       return optionalRequire(() => require('./NavigationSplitViewScreen'));
     },
   },
+  {
+    name: 'ArrangementView component',
+    route: 'ui/arrangementview',
+    options: {},
+    getComponent() {
+      return optionalRequire(() => require('./ArrangementViewScreen'));
+    },
+  },
   {
     name: 'Menu component',
     route: 'ui/menu',
```

**File**: `packages/expo-ui/ios/ArrangementViewView.swift` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+// Copyright 2025-present 650 Industries. All rights reserved.
+
+import ExpoModulesCore
+import SwiftUI
+
+internal final class ArrangementViewProps: UIBaseViewProps {}
+
+internal struct ArrangementViewView: ExpoSwiftUI.View {
+  @ObservedObject var props: ArrangementViewProps
+
+  init(props: ArrangementViewProps) {
+    self.props = props
+  }
+
+  var body: some View {
+// `ArrangementView` ships in the iOS 27.1 SDK (SwiftUICore 8.0.85). `compiler(>=6.4)` is not enough:
+// Xcode 27.1 also ships the tvOS and macOS 27.0 SDKs (SwiftUICore 8.0.84) on the same Swift version.
+#if canImport(SwiftUICore, _version: 8.0.85)
+    if #available(iOS 27.1, macOS 27.1, tvOS 27.1, visionOS 27.1, *) {
+      ArrangementView {
+        primary
+      } secondary: {
+        secondary
+      }
+    } else {
+      Children()
+    }
+#else
+    Children()
+#endif
+  }
+
+  private var primary: SlotView? {
+    props.children?.slot("primary")
+  }
+
+  private var secondary: SlotView? {
+    props.children?.slot("secondary")
+  }
+}
```

**File**: `packages/expo-ui/ios/ExpoUIModule.swift` (modified, +1/-0)
```diff
@@ -159,6 +159,7 @@ public final class ExpoUIModule: Module {
     ExpoUIView(NavigationStackView.self)
     ExpoUIView(NavigationLinkView.self)
     ExpoUIView(NavigationSplitViewView.self)
+    ExpoUIView(ArrangementViewView.self)
     ExpoUIView(ToolbarView.self)
 
     ExpoUIView(FormView.self)
```

**File**: `packages/expo-ui/ios/Modifiers/ArrangementModifiers.swift` (added, +157/-0)
```diff
@@ -0,0 +1,157 @@
+// Copyright 2025-present 650 Industries. All rights reserved.
+
+import ExpoModulesCore
+import SwiftUI
+
+internal enum ArrangementViewStyleOptions: String, Enumerable {
+  case automatic
+  case split
+  case overlay
+}
+
+internal struct ArrangementViewStyleModifier: ViewModifier, Record {
+  @Field var style: ArrangementViewStyleOptions = .automatic
+  @Field var axes: AxisOptions?
+
+  @ViewBuilder
+  func body(content: Content) -> some View {
+#if canImport(SwiftUICore, _version: 8.0.85)
+    if #available(iOS 27.1, macOS 27.1, tvOS 27.1, visionOS 27.1, *) {
+      switch style {
+      case .automatic:
+        content.arrangementViewStyle(.automatic)
+      case .split:
+        if let axes {
+          content.arrangementViewStyle(.split.axes(axes.toAxis()))
+        } else {
+          content.arrangementViewStyle(.split)
+        }
+      case .overlay:
+        if let axes {
+          content.arrangementViewStyle(.overlay.axes(axes.toAxis()))
+        } else {
+          content.arrangementViewStyle(.overlay)
+        }
+      }
+    } else {
+      content
+    }
+#else
+    content
+#endif
+  }
+}
+
+internal struct SplitArrangementLayoutRatioModifier: ViewModifier, Record {
+  @Field var ratio: CGFloat?
+  @Field var minHorizontal: CGFloat?
+  @Field var idealHorizontal: CGFloat?
+  @Field var maxHorizontal: CGFloat?
+  @Field var minVertical: CGFloat?
+  @Field var idealVertical: CGFloat?
+  @Field var maxVertical: CGFloat?
+
+  @ViewBuilder
+  func body(content: Content) -> some View {
+#if canImport(SwiftUICore, _version: 8.0.85)
+    if #available(iOS 27.1, macOS 27.1, tvOS 27.1, visionOS 27.1, *) {
+      if let ratio {
+        content.splitArrangementLayoutRatio(ratio)
+      } else {
+        content.splitArrangementLayoutRatio(
+          minHorizontal: minHorizontal,
+          idealHorizontal: idealHorizontal,
+          maxHorizontal: maxHorizontal,
+          minVertical: minVertical,
+          idealVertical: idealVertical,
+          maxVertical: maxVertical
+        )
+      }
+    } else {
+      content
+    }
+#else
+    content
+#endif
+  }
+}
+
+internal struct SplitArrangementLayoutSizeModifier: ViewModifier, Record {
+  @Field var minWidth: CGFloat?
+  @Field var idealWidth: CGFloat?
+  @Field var maxWidth: CGFloat?
+  @Field var minHeight: CGFloat?
+  @Field var idealHeight: CGFloat?
+  @Field var maxHeight: CGFloat?
+
+  @ViewBuilder
+  func body(content: Content) -> some View {
+#if canImport(SwiftUICore, _version: 8.0.85)
+    if #available(iOS 27.1, macOS 27.1, tvOS 27.1, visionOS 27.1, *) {
+      content.splitArrangementLayoutSize(
+        minWidth: minWidth,
+        idealWidth: idealWidth,
+        maxWidth: maxWidth,
+        minHeight: minHeight,
+        idealHeight: idealHeight,
+        maxHeight: maxHeight
+      )
+    } else {
+      content
+    }
+#else
+    content
+#endif
+  }
+}
+
+internal struct SplitArrangementFixedLayoutSizeModifier: ViewModifier, Record {
+  @Field var horizontal: Bool = true
+  @Field var vertical: Bool = true
+
+  @ViewBuilder
+  func body(content: Content) -> some View {
+#if canImport(SwiftUICore, _version: 8.0.85)
+    if #available(iOS 27.1, macOS 27.1, tvOS 27.1, visionOS 27.1, *) {
+      content.splitArrangementFixedLayoutSize(horizontal: horizontal, vertical: vertical)
+    } else {
+      content
+    }
+#else
+    content
+#endif
+  }
+}
+
+internal enum OverlayArrangementEdgeOptions: String, Enumerable {
+  case top
+  case bottom
+  case leading
+  case trailing
+}
+
+internal struct OverlayArrangementEdgeModifier: ViewModifier, Record {
+  @Field var edge: OverlayArrangementEdgeOptions = .trailing
+
+  @ViewBuilder
+  func body(content: Content) -> some View {
+#if canImport(SwiftUICore, _version: 8.0.85)
+    if #available(iOS 27.1, macOS 27.1, tvOS 27.1, visionOS 27.1, *) {
+      switch edge {
+      case .top:
+        content.overlayArrangementEdge(VerticalEdge.top)
+      case .bottom:
+        content.overlayArrangementEdge(VerticalEdge.bottom)
+      case .leading:
+        content.overlayArrangementEdge(HorizontalEdge.leading)
+      case .trailing:
+        content.overlayArrangementEdge(HorizontalEdge.trailing)
+      }
+    } else {
+      content
+    }
+#else
+    content
+#endif
+  }
+}
```

**File**: `packages/expo-ui/ios/Modifiers/ViewModifierRegistry.swift` (modified, +20/-0)
```diff
@@ -2088,6 +2088,26 @@ extension ViewModifierRegistry {
       return try NavigationSplitViewColumnWidthModifier(from: params, appContext: appContext)
     }
 
+    register("arrangementViewStyle") { params, appContext, _ in
+      return try ArrangementViewStyleModifier(from: params, appContext: appContext)
+    }
+
+    register("splitArrangementLayoutRatio") { params, appContext, _ in
+      return try SplitArrangementLayoutRatioModifier(from: params, appContext: appContext)
+    }
+
+    register("splitArrangementLayoutSize") { params, appContext, _ in
+      return try SplitArrangementLayoutSizeModifier(from: params, appContext: appContext)
+    }
+
+    register("splitArrangementFixedLayoutSize") { params, appContext, _ in
+      return try SplitArrangementFixedLayoutSizeModifier(from: params, appContext: appContext)
+    }
+
+    register("overlayArrangementEdge") { params, appContext, _ in
+      return try OverlayArrangementEdgeModifier(from: params, appContext: appContext)
+    }
+
     register("accessibilityLabel") { params, appContext, _ in
       return try AccessibilityLabelModifier(from: params, appContext: appContext)
     }
```

**File**: `packages/expo-ui/src/swift-ui/ArrangementView/index.tsx` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+import { requireNativeView } from 'expo';
+
+import { Slot } from '../SlotView';
+import { createViewModifierEventListener } from '../modifiers/utils';
+import { type CommonViewModifierProps } from '../types';
+
+export interface ArrangementViewProps extends CommonViewModifierProps {
+  /**
+   * The views to arrange. Provide `ArrangementView.Primary` and `ArrangementView.Secondary`.
+   */
+  children: React.ReactNode;
+}
+
+const ArrangementViewNativeView: React.ComponentType<ArrangementViewProps> = requireNativeView(
+  'ExpoUI',
+  'ArrangementViewView'
+);
+
+/**
+ * The primary view of the arrangement.
+ */
+function ArrangementViewPrimary(props: { children: React.ReactNode }) {
+  return <Slot name="primary">{props.children}</Slot>;
+}
+
+/**
+ * The secondary view of the arrangement.
+ */
+function ArrangementViewSecondary(props: { children: React.ReactNode }) {
+  return <Slot name="secondary">{props.children}</Slot>;
+}
+
+ArrangementView.Primary = ArrangementViewPrimary;
+ArrangementView.Secondary = ArrangementViewSecondary;
+
+/**
+ * ArrangementView uses the native [ArrangementView](https://developer.apple.com/documentation/swiftui/arrangementview) view.
+ *
+ * A view that arranges primary and secondary content using an adaptive layout that responds to
+ * the environment.
+ *
+ * > **Note:** Below iOS 27.1, the children render without a container.
+ * @example
+ * ```tsx
+ * <Host style={{ flex: 1 }}>
+ *   <ArrangementView modifiers={[arrangementViewStyle('split')]}>
+ *     <ArrangementView.Primary>
+ *       <NowPlaying />
+ *     </ArrangementView.Primary>
+ *     <ArrangementView.Secondary>
+ *       <Lyrics />
+ *     </ArrangementView.Secondary>
+ *   </ArrangementView>
+ * </Host>
+ * ```
+ * @platform ios 27.1+
+ * @platform tvos 27.1+
+ */
+export function ArrangementView(props: ArrangementViewProps) {
+  const { modifiers, children, ...restProps } = props;
+
+  return (
+    <ArrangementViewNativeView
+      modifiers={modifiers}
+      {...(modifiers ? createViewModifierEventListener(modifiers) : undefined)}
+      {...restProps}>
+      {children}
+    </ArrangementViewNativeView>
+  );
+}
```

---

### Incident Patch 9: `4c999f68` (2026-10-05)
**Commit Message**: fix(cli): Prevent prototype pollution in `set()` object util (#51066)

Fixes DVT-163, ENG-26641

`set()` in `@expo/cli/src/utils/obj.ts` used `branch in current` to
reuse existing branches. Because `in` also checks the prototype chain,
paths like `__proto__.x` or `constructor.prototype.x` walked into
`Object.prototype` and wrote to it. This adds a guard that stops the
walk on `__proto__`, `constructor`, and `prototype` segments. Using
`Object.prototype.hasOwnProperty` instead of `in` is not enough:
`current['__proto__'] = {}` then calls the `__proto__` setter and
replaces the prototype of the target object.

## Changes

- Return early in `set()` when a path segment is `__proto__`,
`constructor`, or `prototype`.
- Add a test that runs `set()` with `__proto__.polluted` and
`constructor.prototype.polluted` and checks that `Object.prototype`
stays unchanged.

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.changeset/cli-obj-set-prototype-pollution.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@expo/cli': patch
+---
+
+Prevent the internal `set()` object utility from writing to `Object.prototype` when a path contains `__proto__`, `constructor`, or `prototype`.
```

**File**: `packages/@expo/cli/src/utils/__tests__/obj-test.ts` (modified, +5/-0)
```diff
@@ -10,6 +10,11 @@ describe(set, () => {
   it(`shallow writes`, () => {
     expect(set({}, 'a', 'd')).toEqual({ a: 'd' });
   });
+  it(`does not pollute the object prototype`, () => {
+    set({}, '__proto__.polluted', 'yes');
+    set({}, 'constructor.prototype.polluted', 'yes');
+    expect(({} as any).polluted).toBeUndefined();
+  });
 });
 describe(get, () => {
   it(`gets deeply`, () => {
```

**File**: `packages/@expo/cli/src/utils/obj.ts` (modified, +4/-0)
```diff
@@ -18,6 +18,10 @@ export function set(obj: any, key: string, value: any): any | null {
   let current: any = obj;
   let branch: string | undefined;
   while ((branch = branches.shift())) {
+    if (branch === '__proto__' || branch === 'constructor' || branch === 'prototype') {
+      return obj;
+    }
+
     if (branches.length === 0) {
       current[branch] = value;
       return obj;
```

---

### Incident Patch 10: `2a7a7270` (2026-10-05)
**Commit Message**: [router][docs] Export RouterBrowserHistoryAction to fix dead API reference anchor (#51053)

# Why

<!--
Please describe the motivation for this PR, and link to relevant GitHub
issues, forums posts, or feature requests.
-->

Fix https://github.com/expo/expo/issues/51045

# How

<!--
How did you build this feature or fix this bug and why?
-->

Export `RouterBrowserHistoryAction` to fix dead API reference anchor

# Test Plan

<!--
Please describe how you tested this change and how a reviewer could
reproduce your test, especially if this PR does not include automated
tests! If possible, please also provide terminal output and/or
screenshots demonstrating your test/reproduction.
-->

Proofread.

# Checklist

<!--
Please check the appropriate items below if they apply to your diff.
-->

- [ ] I added a changeset and followed [this short
guide](https://github.com/expo/expo/blob/main/CONTRIBUTING.md#-before-submitting)
- [ ] This diff will work correctly for `npx expo prebuild` & EAS Build
(eg: updated a module plugin).
- [ ] Conforms with the [Documentation Writing Style
Guide](https://github.com/expo/expo/blob/main/guides/Expo%20Documentation%20Writing%20Style%20Guide.md)

**File**: `.changeset/router-export-browser-history-action.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'expo-router': patch
+---
+
+Export the `RouterBrowserHistoryAction` type. The public `Router` and `RouterActionResult` types reference it, so custom routers can now type the browser history instruction they return.
```

**File**: `packages/expo-router/src/exports.ts` (modified, +1/-0)
```diff
@@ -118,6 +118,7 @@ export type {
   RouterActionContext,
   RouterActionReducer,
   RouterActionResult,
+  RouterBrowserHistoryAction,
   RouterConfigOptions,
   RouterExtension,
   RouterExtensionContext,
```

---

### Incident Patch 11: `d49fde61` (2026-10-05)
**Commit Message**: [go][Android] Fix skia integration (#51039)

**File**: `apps/expo-go/android/expoview/src/main/java/versioned/host/exp/exponent/ExponentPackage.kt` (modified, +2/-2)
```diff
@@ -19,7 +19,7 @@ import com.reactnativekeyboardcontroller.KeyboardControllerPackage
 import com.reactnativepagerview.PagerViewPackage
 import com.reactnativestripesdk.StripeSdkPackage
 import com.rnmaps.maps.MapsPackage
-import com.shopify.reactnative.skia.RNSkiaPackage
+import com.reactnative.skia.RNSkiaPackage
 import com.swmansion.gesturehandler.RNGestureHandlerPackage
 import com.swmansion.gesturehandler.react.RNGestureHandlerModule
 import com.swmansion.rnscreens.RNScreensPackage
@@ -135,7 +135,7 @@ class ExponentPackage : ReactPackage {
         nativeModules.addAll(mapsPackage.getReactModuleInfoProvider().getReactModuleInfos().values.mapNotNull { mapsPackage.getModule(it.name, reactContext) })
         nativeModules.addAll(dateTimePackage.getReactModuleInfoProvider().getReactModuleInfos().values.mapNotNull { dateTimePackage.getModule(it.name, reactContext) })
         nativeModules.addAll(stripePackage.getReactModuleInfoProvider().getReactModuleInfos().values.mapNotNull { stripePackage.getModule(it.name, reactContext) })
-        nativeModules.addAll(skiaPackage.createNativeModules(reactContext))
+        nativeModules.addAll(skiaPackage.getReactModuleInfoProvider().getReactModuleInfos().values.mapNotNull { skiaPackage.getModule(it.name, reactContext) })
 
         // Call to create native modules has to be at the bottom --
         // -- ExpoModuleRegistryAdapter uses the list of native modules
```

---

### Incident Patch 12: `d50bac42` (2026-10-05)
**Commit Message**: [ios][jsi] Fix the xcframework build with Xcode 26 (Swift 6.2) (#51040)

**File**: `.changeset/jsi-fix-xcode-26-build.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'expo-modules-jsi': patch
+---
+
+[iOS] Fix the xcframework failing to build with Xcode 26 (Swift 6.2): `RuntimeScheduler` constructors annotated with `SWIFT_RETURNS_RETAINED` were rejected, and host function and host object getter callbacks failed with `sending '...' risks causing data races`.
```

**File**: `packages/expo-modules-jsi/apple/Sources/ExpoModulesJSI-Cxx/include/RuntimeScheduler.h` (modified, +18/-5)
```diff
@@ -44,21 +44,34 @@ class RuntimeScheduler {
 
   std::atomic<int> refCount{1};
 
+  RuntimeScheduler(void *scheduler, ScheduleFn fn) noexcept
+      : nativeScheduler(scheduler), scheduleFn(fn) {}
+
+  RuntimeScheduler() noexcept {}
+
 public:
+  // Swift creates instances through the static `create` functions rather than the constructors.
+  // Annotating the constructors with `SWIFT_RETURNS_RETAINED` silences the Swift 6.4 "cannot infer
+  // ownership" warning, but Swift 6.2 rejects that annotation on a constructor as an error. Static
+  // functions returning a shared reference accept the annotation on every Swift version.
+
   /**
-   Constructs a scheduler bound to a host-provided native RuntimeScheduler.
+   Creates a scheduler bound to a host-provided native RuntimeScheduler.
    `scheduleTask` dispatches through `fn`, which the host implements against
    the real react::RuntimeScheduler.
    */
-  SWIFT_RETURNS_RETAINED RuntimeScheduler(void *scheduler, ScheduleFn fn) noexcept
-      : nativeScheduler(scheduler), scheduleFn(fn) {}
+  static RuntimeScheduler *create(void *scheduler, ScheduleFn fn) noexcept SWIFT_RETURNS_RETAINED {
+    return new RuntimeScheduler(scheduler, fn);
+  }
 
   /**
-   Constructs a no-op scheduler. Scheduled tasks run synchronously on the
+   Creates a no-op scheduler. Scheduled tasks run synchronously on the
    caller's thread — intended for standalone runtimes (e.g. tests) that have
    no React scheduler.
    */
-  SWIFT_RETURNS_RETAINED RuntimeScheduler() {}
+  static RuntimeScheduler *create() noexcept SWIFT_RETURNS_RETAINED {
+    return new RuntimeScheduler();
+  }
 
   RuntimeScheduler(const RuntimeScheduler &) = delete;
 
```

**File**: `packages/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Runtime/JavaScriptRuntime.swift` (modified, +19/-19)
```diff
@@ -67,7 +67,7 @@ open class JavaScriptRuntime: Equatable, Identifiable, @unchecked Sendable {
     self.runtimePointee = runtime
     self.pointee = expo.iruntime(runtime)
     self.handle = JavaScriptRuntimeHandle(self.pointee)
-    self.scheduler = expo.RuntimeScheduler()
+    self.scheduler = expo.RuntimeScheduler.create()
     self.ownsRuntime = false
     handle.attach(self)
     installLongLivedObjectsTeardown()
@@ -80,7 +80,7 @@ open class JavaScriptRuntime: Equatable, Identifiable, @unchecked Sendable {
     self.runtimePointee = runtime
     self.pointee = expo.iruntime(runtime)
     self.handle = JavaScriptRuntimeHandle(self.pointee)
-    self.scheduler = expo.RuntimeScheduler()
+    self.scheduler = expo.RuntimeScheduler.create()
     self.ownsRuntime = true
     handle.attach(self)
     installLongLivedObjectsTeardown()
@@ -94,7 +94,7 @@ open class JavaScriptRuntime: Equatable, Identifiable, @unchecked Sendable {
     self.runtimePointee = runtime
     self.pointee = expo.iruntime(runtime)
     self.handle = JavaScriptRuntimeHandle(self.pointee)
-    self.scheduler = expo.RuntimeScheduler()
+    self.scheduler = expo.RuntimeScheduler.create()
     self.ownsRuntime = false
     handle.attach(self)
     installLongLivedObjectsTeardown()
@@ -123,7 +123,7 @@ open class JavaScriptRuntime: Equatable, Identifiable, @unchecked Sendable {
     self.runtimePointee = runtime
     self.pointee = expo.iruntime(runtime)
     self.handle = JavaScriptRuntimeHandle(self.pointee)
-    self.scheduler = expo.RuntimeScheduler(scheduler, fn)
+    self.scheduler = expo.RuntimeScheduler.create(scheduler, fn)
     self.ownsRuntime = false
     handle.attach(self)
     installLongLivedObjectsTeardown()
@@ -197,14 +197,14 @@ open class JavaScriptRuntime: Equatable, Identifiable, @unchecked Sendable {
       propertyName: UnsafePointer<facebook.jsi.PropNameID>,
       resultPtr: UnsafeMutablePointer<facebook.jsi.Value>
     ) -> Bool {
-      nonisolated(unsafe) let resultPtr = resultPtr
+      let resultPtr = UncheckedSendable(resultPtr)
 
       return withGuaranteedContext(context) { (context: HostObjectContext, runtime) in
         let propertyName = String(jsiPropNameID: propertyName.pointee, in: runtime.pointee)
         return JavaScriptActor.assumeIsolated {
           return forwardingSwiftErrorsToJS(runtime: runtime) {
             var result = try context.get(propertyName)
-            JavaScriptValue.write(&result, to: resultPtr)
+            JavaScriptValue.write(&result, to: resultPtr.value)
           }
         }
       }
@@ -871,23 +871,23 @@ private func createFunctionClosure(
     // heap-allocated `JavaScriptRef` (Swift 6.2 rejects capturing/consuming a `~Copyable` value in the
     // escaping closure that `withoutActuallyEscaping` synthesizes), the closure constructs the buffer
     // locally from the raw pointer + count. Those are read-only call-scoped inputs that never outlive the
-    // synchronous call, so the `nonisolated(unsafe)` capture is sound. This removes a per-call class
+    // synchronous call, so capturing them through `UncheckedSendable` is sound. This removes a per-call class
     // allocation + retain/release + dealloc that profiling showed dominating the no-op `@JS` host-call
     // floor.
-    nonisolated(unsafe) let thisPtr = thisPtr
-    nonisolated(unsafe) let argumentsPtr = argumentsPtr
-    nonisolated(unsafe) let resultPtr = resultPtr
+    let thisPtr = UncheckedSendable(thisPtr)
+    let argumentsPtr = UncheckedSendable(argumentsPtr)
+    let resultPtr = UncheckedSendable(resultPtr)
 
     // See `withGuaranteedContext` for why neither the context nor the runtime is retained here, and
     // why the result is written to the caller's slot instead of being returned.
     return withGuaranteedContext(context) { (context: HostFunctionContext, runtime) in
       return JavaScriptActor.assumeIsolated {
         return forwardingSwiftErrorsToJS(runtime: runtime) {
-          let this = UnsafeMutablePointer(mutating: thisPtr).move()
-          let arguments = JavaScriptValuesBuffer(runtime, start: argumentsPtr, count: argumentsCount)
+          let this = UnsafeMutablePointer(mutating: thisPtr.value).move()
+          let arguments = JavaScriptValuesBuffer(runtime, start: argumentsPtr.value, count: argumentsCount)
           let thisValue = JavaScriptValue(runtime, this)
           var result = try context.call(thisValue, consume arguments)
-          JavaScriptValue.write(&result, to: resultPtr)
+          JavaScriptValue.write(&result, to: resultPtr.value)
         }
       }
     }
@@ -919,19 +919,19 @@ private func createFunctionClosure(
     // handed in as a borrowed `JavaScriptUnownedValue` pointing straight at the C++-owned `this` slot:
     // it is not moved out and no owning `JavaScriptValue` is allocated, so the closure avoids the
     // per-call `weak`-runtime form/destroy and heap object that the owning `this` pays.
-    nonisolated(unsafe) let thisPtr = thisPtr
```

**File**: `packages/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Utilities/UncheckedSendable.swift` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+/// Immutable wrapper that makes a non-Sendable value capturable by a `@Sendable` closure without compiler enforcement.
+/// Unlike `NonisolatedUnsafeVar`, it is a struct, so wrapping a value doesn't allocate.
+///
+/// Use it instead of a `nonisolated(unsafe) let` local captured by such a closure: Swift 6.2 still reports
+/// "sending '...' risks causing data races" for those, while a capture of a `Sendable` value passes on every version.
+/// The caller is responsible for making sure the value is never accessed concurrently.
+internal struct UncheckedSendable<Value>: @unchecked Sendable {
+  let value: Value
+
+  init(_ value: Value) {
+    self.value = value
+  }
+}
```

**File**: `packages/expo-modules-jsi/apple/Tests/JavaScriptRuntimeTests.swift` (modified, +10/-3)
```diff
@@ -170,11 +170,11 @@ struct JavaScriptRuntimeTests {
     }
 
     await scheduler.run {
-      nonisolated(unsafe) var didRunInline = false
+      let didRunInline = InlineRunFlag()
       runtime.runOrSchedule {
-        didRunInline = true
+        didRunInline.value = true
       }
-      #expect(didRunInline)
+      #expect(didRunInline.value)
     }
 
     await withCheckedContinuation { continuation in
@@ -1148,6 +1148,13 @@ struct JavaScriptRuntimeTests {
   }
 }
 
+/// Records whether a `runOrSchedule` block ran. A class instead of a `nonisolated(unsafe) var` captured
+/// by the block, which Swift 6.2 rejects as a data race. Safe without synchronization: the test only
+/// reads it after the block ran inline on the same thread.
+private final class InlineRunFlag: @unchecked Sendable {
+  var value = false
+}
+
 /// Tasks captured by `holdSchedulerTask` instead of being executed, emulating a React
 /// `RuntimeScheduler` that is torn down with work still queued (the #47716 reload scenario).
 /// Safe without synchronization: the dispatch always runs synchronously on the test's thread.
```

---

### Incident Patch 13: `36e169fd` (2026-10-04)
**Commit Message**: [expo-ui][tvOS] Fix TV compile failing on unavailable `ToolbarTitleDisplayMode.inlineLarge` (#51007)

# Why

The TV compile CI job is failing on `main` with a hard Swift error, so
every PR branched off or rebased on `main` is red:

```
❌ packages/expo-ui/ios/Modifiers/ViewModifierRegistry.swift:1868:17
  1867 |       if #available(iOS 18.0, tvOS 18.0, macOS 15.0, *) {
> 1868 |         return .inlineLarge
       |                 ^ 'inlineLarge' is unavailable in tvOS
** BUILD FAILED **  (exit code 65)
```

`SwiftUI.ToolbarTitleDisplayMode.inlineLarge` is marked
`@available(tvOS, unavailable)`, but the `inlineLarge` case of
`ToolbarTitleDisplayModeType.value` was only gated behind an
`#available` *version* check that listed `tvOS 18.0`. A version check
does not exclude a platform where the symbol does not exist at all, so
the case was compiled into the tvOS slice and failed to build.

Introduced in #50687.

Example failing run:
https://expo.dev/accounts/expo-ci/projects/expo-workflow-testing/workflows/01a0fe3c-4aca-7f8f-958b-95d2d4225ede

# How

Guard the case by platform with `#if os(tvOS)`, matching how the
neighbouring `.large` case already handles being unavailable off iOS.

The

**File**: `.changeset/expo-ui-toolbar-title-inline-large-tvos.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@expo/ui': patch
+---
+
+[iOS][tvOS] Fix the tvOS build failing to compile with `'inlineLarge' is unavailable in tvOS` when `@expo/ui` is linked. `ToolbarTitleDisplayMode.inlineLarge` is unavailable on tvOS, but the `inlineLarge` case of the `toolbarTitleDisplayMode` modifier was only gated behind an OS version check that listed `tvOS 18.0`, so it was compiled into the tvOS slice. It is now guarded by platform and returns `nil` on tvOS. The same check also required iOS 18.0 / macOS 15.0, so `inlineLarge` silently fell back to `automatic` on iOS 17 and macOS 14 even though it is available there; it now applies on those versions.
```

**File**: `packages/expo-ui/ios/Modifiers/ViewModifierRegistry.swift` (modified, +4/-3)
```diff
@@ -1864,10 +1864,11 @@ internal enum ToolbarTitleDisplayModeType: String, Enumerable {
     case .inline:
       return .inline
     case .inlineLarge:
-      if #available(iOS 18.0, tvOS 18.0, macOS 15.0, *) {
-        return .inlineLarge
-      }
+#if os(tvOS)
       return nil
+#else
+      return .inlineLarge
+#endif
     case .large:
 #if os(iOS)
       return .large
```

---

### Incident Patch 14: `d5583f15` (2026-10-04)
**Commit Message**: [test][ios] Build ExpoFont from source in the minimal-swiftpm tester (#51033)

# Why

The committed Xcode project of the `apps/minimal-swiftpm` tester links a
precompiled ExpoFont framework. On a fresh checkout, nobody has
precompiled expo-font, so the build fails at the link step:

```
clang: error: no such file or directory: '.../ios/build/xcframeworks/debug/plugins/expo-font.xcframework/ios-arm64_x86_64-simulator/ExpoFont.framework/ExpoFont'
```

The project was generated on a machine that had expo-font precompiled,
and that state was committed. expo-font is pure Swift, so the Expo
SwiftPM plugin can build it from source. Tracked in ENG-26916 ("row 2").

# How

Remove every ExpoFont slot from `project.pbxproj` (embed phase, build
settings, search path, linker flag, Debug and Release) and from the
React Native marker `.spm-injected.json`. The removals are exactly the
ExpoFont hunks that React Native's `setup-apple-spm.js update` produces
for this precompiled set. The other changes `update` makes are not
taken: machine-specific pnpm paths for `REACT_NATIVE_PATH`, `/bin/bash`
shell paths, and the removal of the JSI macOS/tvOS slices.

The tester now needs these modules precompiled:

**File**: `apps/minimal-swiftpm/ios/minimalswiftpm.xcodeproj/.spm-injected.json` (modified, +0/-14)
```diff
@@ -49,7 +49,6 @@
           "\"$(RN_SPM_REACT_NATIVE_DEPENDENCIES_BINARY)\"",
           "\"$(RN_SPM_HERMES_BINARY)\"",
           "\"$(RN_SPM_EXPO_FILE_SYSTEM_BINARY)\"",
-          "\"$(RN_SPM_EXPO_FONT_BINARY)\"",
           "\"$(RN_SPM_EXPO_MODULES_CORE_BINARY)\"",
           "\"$(RN_SPM_EXPO_MODULES_JSI_BINARY)\"",
           "\"$(RN_SPM_EXPO_MODULES_WORKLETS_BINARY)\""
@@ -116,12 +115,6 @@
         "\"RN_SPM_EXPO_FILE_SYSTEM_FRAMEWORK[sdk=iphonesimulator*]\"",
         "\"RN_SPM_EXPO_FILE_SYSTEM_BINARY[sdk=iphonesimulator*]\"",
         "\"RN_SPM_EXPO_FILE_SYSTEM_SEARCH_PATH[sdk=iphonesimulator*]\"",
-        "\"RN_SPM_EXPO_FONT_FRAMEWORK[sdk=iphoneos*]\"",
-        "\"RN_SPM_EXPO_FONT_BINARY[sdk=iphoneos*]\"",
-        "\"RN_SPM_EXPO_FONT_SEARCH_PATH[sdk=iphoneos*]\"",
-        "\"RN_SPM_EXPO_FONT_FRAMEWORK[sdk=iphonesimulator*]\"",
-        "\"RN_SPM_EXPO_FONT_BINARY[sdk=iphonesimulator*]\"",
-        "\"RN_SPM_EXPO_FONT_SEARCH_PATH[sdk=iphonesimulator*]\"",
         "\"RN_SPM_EXPO_MODULES_CORE_FRAMEWORK[sdk=iphoneos*]\"",
         "\"RN_SPM_EXPO_MODULES_CORE_BINARY[sdk=iphoneos*]\"",
         "\"RN_SPM_EXPO_MODULES_CORE_SEARCH_PATH[sdk=iphoneos*]\"",
@@ -164,7 +157,6 @@
           "\"$(RN_SPM_REACT_NATIVE_DEPENDENCIES_BINARY)\"",
           "\"$(RN_SPM_HERMES_BINARY)\"",
           "\"$(RN_SPM_EXPO_FILE_SYSTEM_BINARY)\"",
-          "\"$(RN_SPM_EXPO_FONT_BINARY)\"",
           "\"$(RN_SPM_EXPO_MODULES_CORE_BINARY)\"",
           "\"$(RN_SPM_EXPO_MODULES_JSI_BINARY)\"",
           "\"$(RN_SPM_EXPO_MODULES_WORKLETS_BINARY)\""
@@ -231,12 +223,6 @@
         "\"RN_SPM_EXPO_FILE_SYSTEM_FRAMEWORK[sdk=iphonesimulator*]\"",
         "\"RN_SPM_EXPO_FILE_SYSTEM_BINARY[sdk=iphonesimulator*]\"",
         "\"RN_SPM_EXPO_FILE_SYSTEM_SEARCH_PATH[sdk=iphonesimulator*]\"",
-        "\"RN_SPM_EXPO_FONT_FRAMEWORK[sdk=iphoneos*]\"",
-        "\"RN_SPM_EXPO_FONT_BINARY[sdk=iphoneos*]\"",
-        "\"RN_SPM_EXPO_FONT_SEARCH_PATH[sdk=iphoneos*]\"",
-        "\"RN_SPM_EXPO_FONT_FRAMEWORK[sdk=iphonesimulator*]\"",
-        "\"RN_SPM_EXPO_FONT_BINARY[sdk=iphonesimulator*]\"",
-        "\"RN_SPM_EXPO_FONT_SEARCH_PATH[sdk=iphonesimulator*]\"",
         "\"RN_SPM_EXPO_MODULES_CORE_FRAMEWORK[sdk=iphoneos*]\"",
         "\"RN_SPM_EXPO_MODULES_CORE_BINARY[sdk=iphoneos*]\"",
         "\"RN_SPM_EXPO_MODULES_CORE_SEARCH_PATH[sdk=iphoneos*]\"",
```

**File**: `apps/minimal-swiftpm/ios/minimalswiftpm.xcodeproj/project.pbxproj` (modified, +1/-19)
```diff
@@ -245,7 +245,6 @@
 				"$(RN_SPM_REACT_NATIVE_DEPENDENCIES_FRAMEWORK)",
 				"$(RN_SPM_HERMES_FRAMEWORK)",
 				"$(RN_SPM_EXPO_FILE_SYSTEM_FRAMEWORK)",
-				"$(RN_SPM_EXPO_FONT_FRAMEWORK)",
 				"$(RN_SPM_EXPO_MODULES_CORE_FRAMEWORK)",
 				"$(RN_SPM_EXPO_MODULES_JSI_FRAMEWORK)",
 				"$(RN_SPM_EXPO_MODULES_WORKLETS_FRAMEWORK)",
@@ -258,14 +257,13 @@
 				"$(TARGET_BUILD_DIR)/$(FRAMEWORKS_FOLDER_PATH)/ReactNativeDependencies.framework",
 				"$(TARGET_BUILD_DIR)/$(FRAMEWORKS_FOLDER_PATH)/hermesvm.framework",
 				"$(TARGET_BUILD_DIR)/$(FRAMEWORKS_FOLDER_PATH)/ExpoFileSystem.framework",
-				"$(TARGET_BUILD_DIR)/$(FRAMEWORKS_FOLDER_PATH)/ExpoFont.framework",
 				"$(TARGET_BUILD_DIR)/$(FRAMEWORKS_FOLDER_PATH)/ExpoModulesCore.framework",
 				"$(TARGET_BUILD_DIR)/$(FRAMEWORKS_FOLDER_PATH)/ExpoModulesJSI.framework",
 				"$(TARGET_BUILD_DIR)/$(FRAMEWORKS_FOLDER_PATH)/ExpoModulesWorklets.framework",
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 			shellPath = /bin/sh;
-			shellScript = "set -euo pipefail\n\ndestination=\"$TARGET_BUILD_DIR/$FRAMEWORKS_FOLDER_PATH\"\nmkdir -p \"$destination\"\n\nvalidate_framework() {\n  source=\"$1\"\n  name=\"$2\"\n  if [ -z \"$source\" ] || [ ! -d \"$source\" ]; then\n    echo \"error: React Native SwiftPM framework '$name' is unavailable for configuration '$CONFIGURATION' and SDK '$SDK_NAME': $source\"\n    exit 1\n  fi\n  binary=\"${name%.framework}\"\n  if [ ! -e \"$source/$binary\" ] && [ ! -e \"$source/Versions/Current/$binary\" ]; then\n    echo \"error: React Native SwiftPM framework '$name' is invalid for configuration '$CONFIGURATION': expected $source/$binary or $source/Versions/Current/$binary\"\n    exit 1\n  fi\n}\n\ncopy_and_sign() {\n  source=\"$1\"\n  name=\"$2\"\n  /usr/bin/rsync -a --delete \"$source/\" \"$destination/$name/\"\n  if [ \"${CODE_SIGNING_ALLOWED:-YES}\" != \"NO\" ]; then\n    identity=\"${EXPANDED_CODE_SIGN_IDENTITY:--}\"\n    if [ \"$identity\" = \"-\" ]; then\n      /usr/bin/codesign --force --sign - --timestamp=none --preserve-metadata=identifier,entitlements,flags \"$destination/$name\"\n    else\n      /usr/bin/codesign --force --sign \"$identity\" --preserve-metadata=identifier,entitlements,flags \"$destination/$name\"\n    fi\n  fi\n}\n\nvalidate_framework \"${RN_SPM_REACT_FRAMEWORK:-}\" \"React.framework\"\nvalidate_framework \"${RN_SPM_REACT_NATIVE_DEPENDENCIES_FRAMEWORK:-}\" \"ReactNativeDependencies.framework\"\nvalidate_framework \"${RN_SPM_HERMES_FRAMEWORK:-}\" \"hermesvm.framework\"\nvalidate_framework \"${RN_SPM_EXPO_FILE_SYSTEM_FRAMEWORK:-}\" \"ExpoFileSystem.framework\"\nvalidate_framework \"${RN_SPM_EXPO_FONT_FRAMEWORK:-}\" \"ExpoFont.framework\"\nvalidate_framework \"${RN_SPM_EXPO_MODULES_CORE_FRAMEWORK:-}\" \"ExpoModulesCore.framework\"\nvalidate_framework \"${RN_SPM_EXPO_MODULES_JSI_FRAMEWORK:-}\" \"ExpoModulesJSI.framework\"\nvalidate_framework \"${RN_SPM_EXPO_MODULES_WORKLETS_FRAMEWORK:-}\" \"ExpoModulesWorklets.framework\"\ncopy_and_sign \"${RN_SPM_REACT_FRAMEWORK:-}\" \"React.framework\"\ncopy_and_sign \"${RN_SPM_REACT_NATIVE_DEPENDENCIES_FRAMEWORK:-}\" \"ReactNativeDependencies.framework\"\ncopy_and_sign \"${RN_SPM_HERMES_FRAMEWORK:-}\" \"hermesvm.framework\"\ncopy_and_sign \"${RN_SPM_EXPO_FILE_SYSTEM_FRAMEWORK:-}\" \"ExpoFileSystem.framework\"\ncopy_and_sign \"${RN_SPM_EXPO_FONT_FRAMEWORK:-}\" \"ExpoFont.framework\"\ncopy_and_sign \"${RN_SPM_EXPO_MODULES_CORE_FRAMEWORK:-}\" \"ExpoModulesCore.framework\"\ncopy_and_sign \"${RN_SPM_EXPO_MODULES_JSI_FRAMEWORK:-}\" \"ExpoModulesJSI.framework\"\ncopy_and_sign \"${RN_SPM_EXPO_MODULES_WORKLETS_FRAMEWORK:-}\" \"ExpoModulesWorklets.framework\"\n";
+			shellScript = "set -euo pipefail\n\ndestination=\"$TARGET_BUILD_DIR/$FRAMEWORKS_FOLDER_PATH\"\nmkdir -p \"$destination\"\n\nvalidate_framework() {\n  source=\"$1\"\n  name=\"$2\"\n  if [ -z \"$source\" ] || [ ! -d \"$source\" ]; then\n    echo \"error: React Native SwiftPM framework '$name' is unavailable for configuration '$CONFIGURATION' and SDK '$SDK_NAME': $source\"\n    exit 1\n  fi\n  binary=\"${name%.framework}\"\n  if [ ! -e \"$source/$binary\" ] && [ ! -e \"$source/Versions/Current/$binary\" ]; then\n    echo \"error: React Native SwiftPM framework '$name' is invalid for configuration '$CONFIGURATION': expected $source/$binary or $source/Versions/Current/$binary\"\n    exit 1\n  fi\n}\n\ncopy_and_sign() {\n  source=\"$1\"\n  name=\"$2\"\n  /usr/bin/rsync -a --delete \"$source/\" \"$destination/$name/\"\n  if [ \"${CODE_SIGNING_ALLOWED:-YES}\" != \"NO\" ]; then\n    identity=\"${EXPANDED_CODE_SIGN_IDENTITY:--}\"\n    if [ \"$identity\" = \"-\" ]; then\n      /usr/bin/codesign --force --sign - --timestamp=none --preserve-metadata=identifier,entitlements,flags \"$destination/$name\"\n    else\n      /usr/bin/codesign --force --sign \"$identity\" --preserve-metadata=identifier,entitlements,flags \"$destination/$name\"\n    fi\n  fi\n}\n\nvalidate_framework \"${RN_SPM_REACT_FRAMEWORK:-}\" \"React.framework\"\nvalidate_f
```

---

### Incident Patch 15: `bb8114e3` (2026-10-04)
**Commit Message**: [build-properties][Android] Share ccache for the app PCH between checkouts (#51011)

**File**: `apps/bare-expo/android/app/src/main/jni/CMakeLists.txt` (modified, +8/-2)
```diff
@@ -4,7 +4,7 @@ project(appmodules)
 
 include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)
 
-set(PCH_HEADER "${CMAKE_CURRENT_SOURCE_DIR}/pch.h")
+include("${CMAKE_CURRENT_SOURCE_DIR}/pch-ccache.cmake")
 
 add_library(appmodules_pch STATIC EXCLUDE_FROM_ALL "${CMAKE_CURRENT_SOURCE_DIR}/appmodules_pch_owner.cpp")
 
@@ -21,10 +21,14 @@ target_compile_options(appmodules_pch PRIVATE
   "$<$<COMPILE_LANGUAGE:CXX>:-Xclang;-fno-pch-timestamp>"
 )
 
+set(PCH_INCLUDE_OPTION "$<$<COMPILE_LANGUAGE:CXX>:-idirafter${CMAKE_CURRENT_SOURCE_DIR}>")
+target_compile_options(appmodules_pch PRIVATE ${PCH_INCLUDE_OPTION})
 target_precompile_headers(appmodules_pch PRIVATE
-  "$<$<COMPILE_LANGUAGE:CXX>:${PCH_HEADER}>"
+  "$<$<COMPILE_LANGUAGE:CXX>:<pch.h>>"
 )
 
+pch_ccache_owner(appmodules_pch)
+
 function(add_pch_if_eligible target)
   if (NOT TARGET ${target})
     return()
@@ -43,6 +47,7 @@ function(add_pch_if_eligible target)
   # Keep the flag consistent with the PCH owner - see the note above.
   target_compile_options(${target} PRIVATE
     "$<$<COMPILE_LANGUAGE:CXX>:-Xclang;-fno-pch-timestamp>"
+    ${PCH_INCLUDE_OPTION}
   )
 
   # clang rejects a PCH built with a different C++ dialect, so pin consumers
@@ -51,6 +56,7 @@ function(add_pch_if_eligible target)
   set_target_properties(${target} PROPERTIES CXX_STANDARD 20 CXX_EXTENSIONS OFF)
 
   target_precompile_headers(${target} REUSE_FROM appmodules_pch)
+  pch_ccache_consumer(${target} appmodules_pch)
 endfunction()
 
 if (DEFINED AUTOLINKED_LIBRARIES)
```

**File**: `apps/bare-expo/android/app/src/main/jni/pch-ccache.cmake` (added, +139/-0)
```diff
@@ -0,0 +1,139 @@
+# Run as custom command
+if(CMAKE_SCRIPT_MODE_FILE)
+  set(target_option)
+  if(COMPILER_TARGET)
+    set(target_option "--target=${COMPILER_TARGET}")
+  endif()
+
+  execute_process(
+    COMMAND "${COMPILER}" ${target_option} -module-file-info "${PCH}"
+    OUTPUT_VARIABLE info
+    RESULT_VARIABLE result
+  )
+
+  if(NOT result EQUAL 0)
+    # Hash the .pch itself, which is what ccache does without a .sum. The build stays correct, but
+    # checkouts at different paths don't share the results of the users of this PCH.
+    message(WARNING "`${COMPILER} -module-file-info ${PCH}` failed, so ccache can't share the results "
+      "of the users of this PCH between checkouts at different paths.")
+    file(SHA256 "${PCH}" digest)
+    file(WRITE "${PCH}.sum" "${digest}\n")
+    return()
+  endif()
+
+  # Remove `ShowColors` and `PCH_CCACHE_BUILD_DIR` 
+  string(REGEX REPLACE "PCH_CCACHE_BUILD_DIR=[^\n]*|ShowColors: [^\n]*" "" info "${info}")
+
+  # Get all input files
+  string(REGEX MATCHALL "Input file: [^\n]*" input_files "${info}")
+  foreach(input_file IN LISTS input_files)
+    string(REGEX REPLACE "^Input file: | \\[[A-Za-z, ]+\\]$" "" path "${input_file}")
+    if(EXISTS "${path}")
+      file(SHA256 "${path}" digest)
+      string(APPEND info "${digest}\n")
+    endif()
+  endforeach()
+
+  # Remove base dir
+  if(BASE_DIR)
+    string(REGEX REPLACE "(.)/+$" "\\1" base_dir "${BASE_DIR}")
+    string(REGEX REPLACE "([][+.*()^$?|\\\\])" "\\\\\\1" base_dir_regex "${base_dir}")
+    # The directory itself or a path in it, followed by a space, a quote or a line break. A directory whose
+    # name only starts with the same text doesn't match.
+    string(REGEX MATCHALL "${base_dir_regex}(/[^ '\n]*)?[ '\n]" paths "${info}")
+    list(REMOVE_DUPLICATES paths)
+    foreach(path IN LISTS paths)
+      string(REGEX REPLACE "[ '\n]$" "" path "${path}")
+      file(RELATIVE_PATH relative_path "${BUILD_DIR}" "${path}")
+      string(REGEX REPLACE "([][+.*()^$?|\\\\])" "\\\\\\1" path_regex "${path}")
+      string(REGEX REPLACE "${path_regex}([ '\n])" "${relative_path}\\1" info "${info}")
+    endforeach()
+  endif()
+
+  string(SHA256 digest "${info}")
+  file(WRITE "${PCH}.sum" "${digest}\n")
+  return()
+endif()
+
+set(PCH_CCACHE_FILE "${CMAKE_CURRENT_LIST_FILE}")
+
+# Find ccache program if it's used by the target
+function(_pch_ccache_program target out_var)
+  get_target_property(launcher ${target} CXX_COMPILER_LAUNCHER)
+  get_property(global_rule GLOBAL PROPERTY RULE_LAUNCH_COMPILE)
+  get_property(directory_rule DIRECTORY PROPERTY RULE_LAUNCH_COMPILE)
+  separate_arguments(rules UNIX_COMMAND "${global_rule} ${directory_rule}")
+  get_filename_component(compiler "${CMAKE_CXX_COMPILER}" REALPATH)
+  foreach(program IN LISTS launcher rules compiler)
+    get_filename_component(name "${program}" NAME_WE)
+    if(name STREQUAL "ccache")
+      find_program(PCH_CCACHE_PROGRAM NAMES "${program}")
+      set(${out_var} "${PCH_CCACHE_PROGRAM}" PARENT_SCOPE)
+      return()
+    endif()
+  endforeach()
+  set(${out_var} "" PARENT_SCOPE)
+endfunction()
+
+function(pch_ccache_owner owner)
+  # CMake's location of the PCH for the Ninja and Makefile generators.
+  set(pch_dir "${CMAKE_CURRENT_BINARY_DIR}/CMakeFiles/${owner}.dir")
+  set(pch "${pch_dir}/cmake_pch.hxx.pch")
+
+  # Used by the custom command
+  set_property(SOURCE "${pch_dir}/cmake_pch.hxx.cxx" APPEND PROPERTY
+    COMPILE_DEFINITIONS "PCH_CCACHE_BUILD_DIR=${CMAKE_CURRENT_BINARY_DIR}"
+  )
+
+  set(pch_external_checksum "")
+  set(base_dir "")
+  _pch_ccache_program(${owner} ccache)
+  if(NOT ccache AND "$ENV{EXPO_FORCE_PCH_CCACHE_SUM}")
+    # ccache runs through a wrapper, so take its configuration from the ccache on PATH
+    find_program(PCH_CCACHE_PATH_PROGRAM ccache)
+    set(ccache "${PCH_CCACHE_PATH_PROGRAM}")
+  endif()
+  if(ccache)
+    foreach(option IN ITEMS pch_external_checksum base_dir)
+      execute_process(
+        COMMAND "${ccache}" --get-config ${option}
+        OUTPUT_VARIABLE ${option}
+        OUTPUT_STRIP_TRAILING_WHITESPACE
+        ERROR_QUIET
+      )
+    endforeach()
+  endif()
+
+  if("$ENV{EXPO_FORCE_PCH_CCACHE_SUM}")
+    set(pch_external_checksum "true")
+  endif()
+
+  if(NOT pch_external_checksum STREQUAL "true")
+    # Remove the .sum of an earlier configuration: it can belong to an older PCH, and ccache would hash it
+    # if `pch_external_checksum` is enabled later.
+    file(REMOVE "${pch}.sum")
+    return()
+  endif()
+
+  add_custom_command(
+    OUTPUT "${pch}.sum"
+    COMMAND "${CMAKE_COMMAND}"
+      "-DCOMPILER=${CMAKE_CXX_COMPILER}"
+      "-DCOMPILER_TARGET=${CMAKE_CXX_COMPILER_TARGET}"
+      "-DPCH=${pch}"
+      "-DBASE_DIR=${base_dir}"
+      "-DBUILD_DIR=${CMAKE_BINARY_DIR}"
+      -P "${PCH_CCACHE_FILE}"
+    DEPENDS "${pch}" "${PCH_CCACHE_FILE}"
+    COMMENT "Writing the ccache checksum of the ${owner} PCH"
+    VERBATIM
+  )
+  add_custom_target(${owner}-pch-ccache-sum DEPE
```

**File**: `packages/expo-build-properties/src/__tests__/android-pch-test.ts` (modified, +79/-0)
```diff
@@ -1,4 +1,9 @@
+import fs from 'fs';
+import os from 'os';
+import path from 'path';
+
 import { updateBuildGradleForPCH, withAndroidPrecompiledHeaders } from '../android';
+import { PCH_CCACHE_CMAKE_CONTENTS, PCH_CMAKE_CONTENTS } from '../androidPCHTemplates';
 
 jest.mock('expo/config-plugins', () => {
   return {
@@ -19,6 +24,8 @@ jest.mock('expo/config-plugins', () => {
 
 const getMockWithAppBuildGradle = () =>
   jest.requireMock('expo/config-plugins').withAppBuildGradle as jest.Mock;
+const getMockWithDangerousMod = () =>
+  jest.requireMock('expo/config-plugins').withDangerousMod as jest.Mock;
 
 const TEMPLATE_BUILD_GRADLE = `\
 apply plugin: "com.android.application"
@@ -91,6 +98,78 @@ describe(withAndroidPrecompiledHeaders, () => {
   });
 });
 
+describe('PCH_CMAKE_CONTENTS', () => {
+  it('includes the PCH header without its absolute path', () => {
+    // CMake writes the header path into the cmake_pch.hxx that ccache hashes for every user of the PCH.
+    expect(PCH_CMAKE_CONTENTS).toContain('<pch.h>');
+    expect(PCH_CMAKE_CONTENTS).not.toContain('${CMAKE_CURRENT_SOURCE_DIR}/pch.h');
+  });
+
+  it('lets the consumers of the PCH find the header', () => {
+    // When ccache runs the preprocessor for a consumer, the preprocessor reads cmake_pch.hxx and must find <pch.h>.
+    const consumerFunction = PCH_CMAKE_CONTENTS.slice(
+      PCH_CMAKE_CONTENTS.indexOf('function(add_pch_if_eligible')
+    );
+    expect(consumerFunction).toContain('${PCH_INCLUDE_OPTION}');
+    expect(PCH_CMAKE_CONTENTS).toContain('-idirafter${CMAKE_CURRENT_SOURCE_DIR}');
+  });
+
+  it('writes the ccache checksum of the PCH before its consumers are compiled', () => {
+    expect(PCH_CMAKE_CONTENTS).toContain('include("${CMAKE_CURRENT_SOURCE_DIR}/pch-ccache.cmake")');
+    expect(PCH_CMAKE_CONTENTS).not.toContain('OPTIONAL');
+    expect(PCH_CMAKE_CONTENTS).toContain('pch_ccache_owner(appmodules_pch)');
+    expect(PCH_CMAKE_CONTENTS).toContain('pch_ccache_consumer(${target} appmodules_pch)');
+  });
+});
+
+describe('PCH_CCACHE_CMAKE_CONTENTS', () => {
+  it('defines the functions that CMakeLists.txt calls', () => {
+    expect(PCH_CCACHE_CMAKE_CONTENTS).toContain('function(pch_ccache_owner owner)');
+    expect(PCH_CCACHE_CMAKE_CONTENTS).toContain('function(pch_ccache_consumer consumer owner)');
+  });
+
+  it('writes the .sum without the ccache checks when EXPO_FORCE_PCH_CCACHE_SUM is set', () => {
+    expect(PCH_CCACHE_CMAKE_CONTENTS).toContain('$ENV{EXPO_FORCE_PCH_CCACHE_SUM}');
+  });
+
+  it('writes the .sum when CMake runs it as a script', () => {
+    expect(PCH_CCACHE_CMAKE_CONTENTS).toContain('if(CMAKE_SCRIPT_MODE_FILE)');
+    expect(PCH_CCACHE_CMAKE_CONTENTS).toContain('-module-file-info');
+  });
+});
+
+describe('withAndroidPrecompiledHeaders native files', () => {
+  let platformProjectRoot: string;
+
+  beforeEach(async () => {
+    platformProjectRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'expo-pch-test-'));
+  });
+
+  afterEach(async () => {
+    await fs.promises.rm(platformProjectRoot, { recursive: true, force: true });
+    getMockWithDangerousMod().mockClear();
+  });
+
+  it('writes its own pch-ccache.cmake next to CMakeLists.txt', async () => {
+    withAndroidPrecompiledHeaders({ name: 'test', slug: 'test' } as any, {
+      android: { usePrecompiledHeaders: true },
+    });
+    const [, [, writeNativeFiles]] = getMockWithDangerousMod().mock.calls[0];
+    // A project root in which no package is resolvable.
+    const projectRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'expo-pch-project-'));
+    try {
+      await writeNativeFiles({ modRequest: { platformProjectRoot, projectRoot } });
+    } finally {
+      await fs.promises.rm(projectRoot, { recursive: true, force: true });
+    }
+
+    const jniDir = path.join(platformProjectRoot, 'app', 'src', 'main', 'jni');
+    expect(await fs.promises.readFile(path.join(jniDir, 'pch-ccache.cmake'), 'utf8')).toBe(
+      PCH_CCACHE_CMAKE_CONTENTS
+    );
+  });
+});
+
 describe(updateBuildGradleForPCH, () => {
   it('should add externalNativeBuild block inside android section', () => {
     const result = updateBuildGradleForPCH(TEMPLATE_BUILD_GRADLE);
```

**File**: `packages/expo-build-properties/src/android.ts` (modified, +2/-0)
```diff
@@ -12,6 +12,7 @@ import fs from 'fs';
 import path from 'path';
 
 import {
+  PCH_CCACHE_CMAKE_CONTENTS,
   PCH_CMAKE_CONTENTS,
   PCH_HEADER_CONTENTS,
   PCH_ONLOAD_CONTENTS,
@@ -412,6 +413,7 @@ export const withAndroidPrecompiledHeaders: ConfigPlugin<PluginConfigType> = (co
           path.join(jniDir, 'appmodules_pch_owner.cpp'),
           PCH_OWNER_SOURCE_CONTENTS
         ),
+        fs.promises.writeFile(path.join(jniDir, 'pch-ccache.cmake'), PCH_CCACHE_CMAKE_CONTENTS),
       ]);
       return config;
     },
```

**File**: `packages/expo-build-properties/src/androidPCHTemplates.ts` (modified, +150/-2)
```diff
@@ -5,7 +5,7 @@ project(appmodules)
 
 include(\${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)
 
-set(PCH_HEADER "\${CMAKE_CURRENT_SOURCE_DIR}/pch.h")
+include("\${CMAKE_CURRENT_SOURCE_DIR}/pch-ccache.cmake")
 
 add_library(appmodules_pch STATIC EXCLUDE_FROM_ALL "\${CMAKE_CURRENT_SOURCE_DIR}/appmodules_pch_owner.cpp")
 
@@ -22,10 +22,14 @@ target_compile_options(appmodules_pch PRIVATE
   "$<$<COMPILE_LANGUAGE:CXX>:-Xclang;-fno-pch-timestamp>"
 )
 
+set(PCH_INCLUDE_OPTION "$<$<COMPILE_LANGUAGE:CXX>:-idirafter\${CMAKE_CURRENT_SOURCE_DIR}>")
+target_compile_options(appmodules_pch PRIVATE \${PCH_INCLUDE_OPTION})
 target_precompile_headers(appmodules_pch PRIVATE
-  "$<$<COMPILE_LANGUAGE:CXX>:\${PCH_HEADER}>"
+  "$<$<COMPILE_LANGUAGE:CXX>:<pch.h>>"
 )
 
+pch_ccache_owner(appmodules_pch)
+
 function(add_pch_if_eligible target)
   if (NOT TARGET \${target})
     return()
@@ -44,6 +48,7 @@ function(add_pch_if_eligible target)
   # Keep the flag consistent with the PCH owner - see the note above.
   target_compile_options(\${target} PRIVATE
     "$<$<COMPILE_LANGUAGE:CXX>:-Xclang;-fno-pch-timestamp>"
+    \${PCH_INCLUDE_OPTION}
   )
 
   # clang rejects a PCH built with a different C++ dialect, so pin consumers
@@ -52,6 +57,7 @@ function(add_pch_if_eligible target)
   set_target_properties(\${target} PROPERTIES CXX_STANDARD 20 CXX_EXTENSIONS OFF)
 
   target_precompile_headers(\${target} REUSE_FROM appmodules_pch)
+  pch_ccache_consumer(\${target} appmodules_pch)
 endfunction()
 
 if (DEFINED AUTOLINKED_LIBRARIES)
@@ -61,6 +67,148 @@ if (DEFINED AUTOLINKED_LIBRARIES)
 endif ()
 `;
 
+export const PCH_CCACHE_CMAKE_CONTENTS = `\
+# Run as custom command
+if(CMAKE_SCRIPT_MODE_FILE)
+  set(target_option)
+  if(COMPILER_TARGET)
+    set(target_option "--target=\${COMPILER_TARGET}")
+  endif()
+
+  execute_process(
+    COMMAND "\${COMPILER}" \${target_option} -module-file-info "\${PCH}"
+    OUTPUT_VARIABLE info
+    RESULT_VARIABLE result
+  )
+
+  if(NOT result EQUAL 0)
+    # Hash the .pch itself, which is what ccache does without a .sum. The build stays correct, but
+    # checkouts at different paths don't share the results of the users of this PCH.
+    message(WARNING "\`\${COMPILER} -module-file-info \${PCH}\` failed, so ccache can't share the results "
+      "of the users of this PCH between checkouts at different paths.")
+    file(SHA256 "\${PCH}" digest)
+    file(WRITE "\${PCH}.sum" "\${digest}\\n")
+    return()
+  endif()
+
+  # Remove \`ShowColors\` and \`PCH_CCACHE_BUILD_DIR\` 
+  string(REGEX REPLACE "PCH_CCACHE_BUILD_DIR=[^\\n]*|ShowColors: [^\\n]*" "" info "\${info}")
+
+  # Get all input files
+  string(REGEX MATCHALL "Input file: [^\\n]*" input_files "\${info}")
+  foreach(input_file IN LISTS input_files)
+    string(REGEX REPLACE "^Input file: | \\\\[[A-Za-z, ]+\\\\]$" "" path "\${input_file}")
+    if(EXISTS "\${path}")
+      file(SHA256 "\${path}" digest)
+      string(APPEND info "\${digest}\\n")
+    endif()
+  endforeach()
+
+  # Remove base dir
+  if(BASE_DIR)
+    string(REGEX REPLACE "(.)/+$" "\\\\1" base_dir "\${BASE_DIR}")
+    string(REGEX REPLACE "([][+.*()^$?|\\\\\\\\])" "\\\\\\\\\\\\1" base_dir_regex "\${base_dir}")
+    # The directory itself or a path in it, followed by a space, a quote or a line break. A directory whose
+    # name only starts with the same text doesn't match.
+    string(REGEX MATCHALL "\${base_dir_regex}(/[^ '\\n]*)?[ '\\n]" paths "\${info}")
+    list(REMOVE_DUPLICATES paths)
+    foreach(path IN LISTS paths)
+      string(REGEX REPLACE "[ '\\n]$" "" path "\${path}")
+      file(RELATIVE_PATH relative_path "\${BUILD_DIR}" "\${path}")
+      string(REGEX REPLACE "([][+.*()^$?|\\\\\\\\])" "\\\\\\\\\\\\1" path_regex "\${path}")
+      string(REGEX REPLACE "\${path_regex}([ '\\n])" "\${relative_path}\\\\1" info "\${info}")
+    endforeach()
+  endif()
+
+  string(SHA256 digest "\${info}")
+  file(WRITE "\${PCH}.sum" "\${digest}\\n")
+  return()
+endif()
+
+set(PCH_CCACHE_FILE "\${CMAKE_CURRENT_LIST_FILE}")
+
+# Find ccache program if it's used by the target
+function(_pch_ccache_program target out_var)
+  get_target_property(launcher \${target} CXX_COMPILER_LAUNCHER)
+  get_property(global_rule GLOBAL PROPERTY RULE_LAUNCH_COMPILE)
+  get_property(directory_rule DIRECTORY PROPERTY RULE_LAUNCH_COMPILE)
+  separate_arguments(rules UNIX_COMMAND "\${global_rule} \${directory_rule}")
+  get_filename_component(compiler "\${CMAKE_CXX_COMPILER}" REALPATH)
+  foreach(program IN LISTS launcher rules compiler)
+    get_filename_component(name "\${program}" NAME_WE)
+    if(name STREQUAL "ccache")
+      find_program(PCH_CCACHE_PROGRAM NAMES "\${program}")
+      set(\${out_var} "\${PCH_CCACHE_PROGRAM}" PARENT_SCOPE)
+      return()
+    endif()
+  endforeach()
+  set(\${out_var} "" PARENT_SCOPE)
+endfunction()
+
+function(pch_ccache_owner owner)
+  # CMake's location of the PCH for the Ninja and Makefile generators.
+  set(pch_dir "\${CMAKE_CURRENT_BINARY_DIR}
```

#### Recent Merged Pull Requests:
- **PR #51125** (2026-10-05): fix(cli): Replace `resolve-from` with `@expo/require-utils`' `resolveFrom` in `resolveLocalTemplate.ts` (@kitten)
- **PR #51116** (2026-10-05): [android][ui] Apply `containerColor` to `TimePickerDialog` (@expo-bot)
- **PR #51107** (2026-10-05): [ci][sdk-56] Fingerprint SDK-branch PRs against their base branch (#51105) (@robhogan)
- **PR #51106** (2026-10-05): [ci][sdk-57] Fingerprint SDK-branch PRs against their base branch (#51105) (@robhogan)
- **PR #51105** (2026-10-05): [ci] Fingerprint SDK-branch PRs against their base branch (@robhogan)
- **PR #51104** (2026-10-05): [ci][sdk-58] Fingerprint SDK-branch PRs against their base branch (#51105) (@robhogan)
- **PR #51103** (2026-10-05): [cli][sdk-58] Link expo-linking in test fixture (fix CI) (#50763) (@robhogan)
- **PR #51099** (closed): [cli] run:* never opens the app at a busy port it does not serve (@vonovak)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
