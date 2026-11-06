> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/expo-expo-learnings.md`  
> **Source**: github ([https://github.com/expo/expo](https://github.com/expo/expo))  
> **Source Version**: `e81a7d08`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-06T13:34:50.004Z  
> **Learning ID**: `learn-github-expo-expo`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): expo/expo

> **Canonical Artifact**: `07_PROJECT_LEARNING/expo-expo-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/expo/expo](https://github.com/expo/expo))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-06T13:34:48.941Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `expo/expo`
- **Description**: An open-source framework for making universal native apps with React. Expo runs on Android, iOS, and the web.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 53371 stars

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

  fun exceptionToCanRetry(exception: Exception): Boolean {
    if (exception is ManifestException) {
      return exception.canRetry
    }
    return true
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #21568** (2025-05-12): **@expo/vector-icons not showing after adding metro.config.js file in project root folder**
  *Symptoms*: ### Summary  Expo vector icons are not rendering after deployment. As I'm using Expo Router, I'm using metro. I installed `@expo/metro-config` and this is my metro.config.js file:  ``` const { getDefaultConfig } = require("@expo/metro-config");  const defaultConfig = getDefaultConfig(__dirname);  module.exports = {   resolver: {     assetExts: [...defaultConfig.resolver.assetExts, "db"],   }, }; ```  Expected behaviour: ![image](https://user-images.githubusercontent.com/109685663/223214187-611456c2-5775-49e6-ab6f-7114b453c472.png)  What actually happens ![image](https://user-images.githubusercontent.com/109685663/223214030-fd88c8d2-1640-4878-8feb-dfbbc6415bc4.png)   ### What platform(s) does this occur on?  Web  ### SDK Version  48  ### Environment  expo-env-info 1.0.5 environment info:     System:       OS: Linux 5.19 Ubuntu 22.04.1 LTS 22.04.1 LTS (Jammy Jellyfish)       Shell: 5.1.16 - /bin/bash     Binaries:       Node: 16.17.0 - /usr/local/bin/node       npm: 8.15.0 - /usr/local/bin/npm     npmPackages:       expo: ^48.0.4 => 48.0.5        react: 18.2.0 => 18.2.0        react-dom: 18.2.0 => 18.2.0        react-native: 0.71.3 => 0.71.3        react-native-web: ~0.18.7 => 0.18.12      npmGlobalPackages:       expo-cli: 6.3.2     Expo Workflow: managed  ### Minimal reproducible example  https://github.com/francolivelli/expo-error
  **Post-Mortem & Fix Analysis**:
  > If you are experiencing issues with Expo vector icons not rendering after deployment, you may need to add some additional configuration to your project.  Firstly, make sure that you have installed react-native-vector-icons and expo-font packages. You can do this by running the following command in your project directory: `npm install react-native-vector-icons expo-font`  ext, you will need to add the following code to your App.js file to load the icon fonts: ``` import { Ionicons } from '@expo/vector-icons'; import { useFonts } from 'expo-font';  export default function App() {   const [loaded] = useFonts({     Ionicons: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),   });    if (!loaded) {     return null;   }    // Your app code here } ```  Make sure to replace Ionicons with the name of the icon font that you want to load. You can find the names of the available icon fonts in the node_modules/@expo/vector-icons/build/ve
  > Hi! I did everything you said but icons are still not rendering after deployment :(

- **Issue #20205** (2023-02-28): **Web platform broken in SDK 46**
  *Symptoms*: ### Summary  Web platform broken in SDK 46  ### Environment  ```   expo-env-info 1.0.5 environment info:     System:       OS: Linux 4.18 AlmaLinux 8.6 (Sky Tiger)       Shell: 4.4.20 - /bin/bash     Binaries:       Node: 16.18.0 - /usr/local/bin/node       Yarn: 1.22.19 - /usr/local/bin/yarn       npm: 8.19.2 - /usr/local/bin/npm     npmPackages:       @expo/webpack-config: ^0.17.0 => 0.17.3        expo: ~46.0.17 => 46.0.17        react: 18.0.0 => 18.0.0        react-dom: 18.0.0 => 18.0.0        react-native: 0.69.6 => 0.69.6        react-native-web: ~0.18.7 => 0.18.10      Expo Workflow: managed  ```  ### Please specify your device/emulator/simulator platform, model and version  web  ### Error output  ``` Starting Metro Bundler Error: Cannot find module '@expo/dev-server/build/webpack/symbolicateMiddleware' Require stack: - /home/bob/NetBeansProjects/webTest/node_modules/@expo/cli/build/src/start/server/webpack/WebpackBundlerDevServer.js - /home/bob/NetBeansProjects/webTest/node_modules/@expo/cli/build/src/start/server/DevServerManager.js - /home/bob/NetBeansProjects/webTest/node_modules/@expo/cli/build/src/start/startAsync.js - /home/bob/NetBeansProjects/webTest/node_modules/@expo/cli/build/src/start/index.js - /home/bob/NetBeansProjects/webTest/node_modules/@expo/cli/build/bin/cli Error: Cannot find module '@expo/dev-server/build/webpack/symbolicateMiddleware' Require stack: - /home/bob/NetBeansProjects/webTest/node_modules/@expo/cli/build/src

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

### Incident Patch 1: `46e555c4` (2026-11-06)
**Commit Message**: fix(cli): Stop OSC 7501 program status from failing commands when it throws (#53057)

# Why

As a precautionary measure I want to add a guard around the program
status write method so that the status is never the cause of a failure.

# How

I wrapped the write in a try/catch block so that we now just skip the
status report when it throws.

# Test Plan

All tests pass.

**File**: `.changeset/cli-osc-7501-status-guard.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@expo/cli': patch
+---
+
+Stop OSC 7501 program status from failing a command when reporting it throws.
```

**File**: `packages/@expo/cli/src/utils/__tests__/programStatus-test.ts` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+import { isInteractive } from '../interactive';
+import { withProgramStatus } from '../programStatus';
+
+jest.mock('../interactive', () => ({
+  isInteractive: jest.fn(),
+}));
+
+describe(withProgramStatus, () => {
+  it('still runs the action when reporting the status throws', async () => {
+    jest.mocked(isInteractive).mockImplementation(() => {
+      throw new Error('Invalid value');
+    });
+
+    await expect(
+      withProgramStatus({ state: 'blocked', kind: 'auth' }, async () => 'result')
+    ).resolves.toBe('result');
+  });
+});
```

**File**: `packages/@expo/cli/src/utils/programStatus.ts` (modified, +9/-6)
```diff
@@ -7,10 +7,13 @@ export type ProgramStatus = {
   msg?: string;
 };
 
-function writeProgramStatus(body: string) {
-  if (isInteractive()) {
-    process.stdout.write(`\x1b]7501;${body}\x1b\\`);
-  }
+function writeProgramStatus(status: ProgramStatus | 'clear') {
+  try {
+    if (isInteractive()) {
+      const body = status === 'clear' ? 'state=clear' : formatProgramStatus(status);
+      process.stdout.write(`\x1b]7501;${body}\x1b\\`);
+    }
+  } catch {}
 }
 
 function formatProgramStatus({ state, kind, msg }: ProgramStatus): string {
@@ -26,8 +29,8 @@ export async function withProgramStatus<T>(
   status: ProgramStatus,
   action: () => Promise<T>
 ): Promise<T> {
-  const clear = () => writeProgramStatus('state=clear');
-  writeProgramStatus(formatProgramStatus(status));
+  const clear = () => writeProgramStatus('clear');
+  writeProgramStatus(status);
   process.on('exit', clear);
   try {
     return await action();
```

---

### Incident Patch 2: `999a6442` (2026-11-05)
**Commit Message**: [docs] Document idle timeouts for Simulator web preview sessions (#52662)

# Why

Eight Simulators pages say that `web-preview-only` sessions have no idle
timeout and that browser activity never resets the timer. Since [eas-cli
#4731](https://github.com/expo/eas-cli/pull/4731) reached the workers,
iOS `web-preview-only` sessions enforce the idle timeout, and EAS
rejects it for Android `web-preview-only` sessions. #52157 updates the
session lifetime page to the same rules.

# How

Update the idle timer note on these pages: CLI and REST API references,
session types, limitations, usage and billing, Appium, hand off a
session, drive the device, and troubleshooting. All pages now say that
on iOS, browser input resets the timer, and that watching the preview
and Android browser input do not. Also state the idle timeout limit as
"at most the maximum duration" in the REST API reference and on the
session lifetime page.

# Test Plan

Claude Code ran these on 2026-10-30:

- Docs checks with Node 24.22.1: oxfmt, Vale, lint, production lint,
worker tests, and unit tests (740 passed). After the review fixes in
`f059316`, oxfmt, Vale, and lint ran again and passed.
- Hosted sessions with eas-cl

**File**: `docs/pages/preview/simulators/how-it-works/session-lifetime.mdx` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ Pass `--max-idle-time-minutes` to stop the session after that many minutes witho
 | Activity that resets the timer         | Controller activity from agent-device, Argent, or Appium. On iOS, browser input and some `simulator:control` actions, such as app launches and screenshots, also reset the timer. |
 | Activity that does not reset the timer | Watching the preview, or browser input on Android                                                                                                                                 |
 | `web-preview-only` sessions            | Supported on iOS. On Android, Expo Simulators rejects an idle timeout and does not create the session.                                                                            |
-| Allowed values                         | A positive number smaller than the session's maximum duration: the value of `--max-duration-minutes`, or the plan limit when you do not set one.                                  |
+| Allowed values                         | A positive number up to the session's maximum duration: the value of `--max-duration-minutes`, or the plan limit when you do not set one.                                         |
 
 For a session that a person uses in the browser preview, limit the session with the maximum duration. The idle timeout can stop the session while the person only watches it, or while they use it on Android.
 
```

**File**: `docs/pages/preview/simulators/how-to/drive-the-device.mdx` (modified, +1/-1)
```diff
@@ -130,7 +130,7 @@ Every session type includes a live browser preview. Open the browser preview URL
 
 The session page on expo.dev shows an **Open preview** button that opens the browser preview in a new tab.
 
-Browser preview activity does not reset the idle timer. See [How long an Expo Simulators session runs](/preview/simulators/how-it-works/session-lifetime/).
+On iOS, browser input in the preview resets the idle timer. Watching the preview does not reset it. Browser input on Android does not reset it. See [How long an Expo Simulators session runs](/preview/simulators/how-it-works/session-lifetime/).
 
 ## Common questions
 
```

**File**: `docs/pages/preview/simulators/how-to/hand-off-a-session.mdx` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ If you plan to share a session, set a maximum duration when you start it, so tha
 
 Add `--public-link` to this command when the person does not have access to the project.
 
-To share a session that is already running, share the browser preview URL or session page URL that it already has. The session page URL always requires an Expo login with access to the project. The browser preview URL also requires one, unless the session started with `--public-link`. Tell the person when the session stops. Activity in the browser preview does not reset the idle timer, so use `--max-duration-minutes`, not `--max-idle-time-minutes`, to limit a session that a person controls. See [How long an Expo Simulators session runs](/preview/simulators/how-it-works/session-lifetime/).
+To share a session that is already running, share the browser preview URL or session page URL that it already has. The session page URL always requires an Expo login with access to the project. The browser preview URL also requires one, unless the session started with `--public-link`. Tell the person when the session stops. On iOS, browser input in the preview resets the idle timer. Watching the preview, or browser input on Android, does not reset it. To limit a session that a person uses, prefer `--max-duration-minutes` over `--max-idle-time-minutes`. See [How long an Expo Simulators session runs](/preview/simulators/how-it-works/session-lifetime/).
 
 To show a running session on a web page that you own, instead of sharing a link, see [Show an Expo Simulators session on your own web page](/preview/simulators/how-to/embed-a-session/).
 
```

**File**: `docs/pages/preview/simulators/limitations.mdx` (modified, +6/-6)
```diff
@@ -26,12 +26,12 @@ Expo Simulators is an experimental preview. Its commands, flags, and behavior ca
 
 ## Session lifetime
 
-| Limit                                                                                 | Alternative                                                                                   |
-| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
-| A session runs for at most 40 minutes on the Free plan and 115 minutes on paid plans. | Start a new session when the old one stops.                                                   |
-| A session started with `--non-interactive` does not stop when the command returns.    | Run `eas simulator:stop`, and set `--max-duration-minutes`.                                   |
-| Browser preview activity does not reset the idle timer.                               | Use `--max-duration-minutes` to limit sessions that a person controls in the browser preview. |
-| `web-preview-only` sessions do not support an idle timeout.                           | Use `--max-duration-minutes`.                                                                 |
+| Limit                                                                                 | Alternative                                                                                                               |
+| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
+| A session runs for at most 40 minutes on the Free plan and 115 minutes on paid plans. | Start a new session when the old one stops.                                                                               |
+| A session started with `--non-interactive` does not stop when the command returns.    | Run `eas simulator:stop`, and set `--max-duration-minutes`.                                                               |
+| Watching the preview, or browser input on Android, does not reset the idle timer.     | Use `--max-duration-minutes` to limit a session that a person only watches, or an Android session that a person controls. |
+| Android `web-preview-only` sessions do not support an idle timeout.                   | Use `--max-duration-minutes`.                                                                                             |
 
 See [How long an Expo Simulators session runs](/preview/simulators/how-it-works/session-lifetime/).
 
```

**File**: `docs/pages/preview/simulators/reference/cli.mdx` (modified, +1/-1)
```diff
@@ -123,7 +123,7 @@ Important flags:
 | `--egress-allow`            | Exact `host:port` on this machine or its network that the simulator can reach through local egress, such as `localhost:3000`. Repeat for multiple destinations. Requires `--egress local`                                                                                                                                                                     |
 | `--network-capture`         | Record HTTP(S) traffic from apps on an iOS device as an HTTP Archive (HAR). iOS only. Not compatible with `--egress local`. See [Record network traffic](/preview/simulators/how-it-works/network-inspection/#record-network-traffic)                                                                                                                         |
 | `--network-capture-field`   | What a recording also keeps: `header`, `query`, `request-body`, or `response-body`. Repeat the flag or pass a comma-separated list. Requires `--network-capture`                                                                                                                                                                                              |
-| `--max-idle-time-minutes`   | Stop after this many minutes without session activity. When omitted, the session has no idle timeout and runs until its maximum duration. Not supported for `web-preview-only`                                                                                                                                                                                |
+| `--max-idle-time-minutes`   | Stop after this many minutes without session activity. When omitted, the session has no idle timeout and runs until its maximum duration. Not supported for Android `web-preview-only`                                                                                                                                                                        |
 | `--out-config-type`         | `dotenv` (default) to write **.env.eas-simulator**, or `env` to print shell exports                                                                                                                                                                                                                                                                           |
 | `--[no-]force`              | Whether to create a new session when a session ID already exists in the environment. Defaults to `true`                                                                                                                                                                                                                                                       |
 | `--non-interactive`         | Return after the session is ready instead of staying attached                                                                                                                                                                                                                                                                                                 |
```

**File**: `docs/pages/preview/simulators/reference/rest-api.mdx` (modified, +2/-2)
```diff
@@ -54,7 +54,7 @@ UUID means universally unique identifier.
 | `packageVersion`        | string        | No       | Version of the package for the selected session type. Omit to use the service default.                                                                                                                                                                                                                                                                       |
 | `deviceIdentifier`      | string        | No       | Android virtual device hardware profile, or iOS Simulator name or unique device identifier (UDID). The runner chooses a device when omitted.                                                                                                                                                                                                                 |
 | `maxDurationMinutes`    | integer       | No       | Automatic session stop time in minutes. Must be between 0 and 115 inclusive, and within the account's duration limit. The job that runs the session has a hard limit of this value plus five minutes. Omit to use the account maximum.                                                                                                                       |
-| `maxIdleTimeMinutes`    | integer       | No       | Stop after this many minutes without session activity. Must be positive and less than 115. It must be smaller than `maxDurationMinutes` when both are set. Omit to disable the idle timeout. Not supported for `web-preview-only`.                                                                                                                           |
+| `maxIdleTimeMinutes`    | integer       | No       | Stop after this many minutes without session activity. Must be positive and at most `maxDurationMinutes`, or the account maximum if that field is not set. Omit to disable the idle timeout. Not supported for Android `web-preview-only`.                                                                                                                   |
 | `buildId`               | string (UUID) | No       | An Expo Build to download, install, and launch. Use an Android **.apk** or an iOS Simulator build.                                                                                                                                                                                                                                                           |
 | `applicationArchiveUrl` | string        | No       | An HTTP or HTTPS URL for an installable application archive, up to 2,048 characters. On iOS, use a **.tar.gz** or **.tgz** file that contains the **.app**. On Android, use an **.apk**.                                                                                                                                                                     |
 | `expoGo`                | boolean       | No       | Set to `true` to install and launch Expo Go.                                                                                                                                                                                                                                                                                                                 |
@@ -69,7 +69,7 @@ The application source options install and launch the app for every session type
 
 The REST API ignores fields that it does not list here. Build fingerprint matching, local egress, and network capture are available only through EAS CLI: `--build-fingerprint`, `--egress local`, and `--network-capture`.
 
-A `web-preview-only` session provides the browser preview without a controller. It does not support an idle timeout. Other session types provide a controller and include a browser preview. Sessions created before Expo Simulators removed `serve-sim` still return `"type": "serve-sim"`.
+A `web-preview-only` session provides the browser preview without a controller. On Android, it does not support an idle timeout. Other session types provide a controller and include a browser preview. Sessions created before Expo Simulators removed `serve-sim` still return `"type": "serve-sim"`.
 
 ### Example
 
```

**File**: `docs/pages/preview/simulators/reference/session-types.mdx` (modified, +3/-3)
```diff
@@ -45,14 +45,14 @@ The tokens in these values give access to the remote device. Keep them secret. S
 | ------------------------------------------ | -------------- | -------- | -------- | ------------------ |
 | Start flags install and launch the app     | Yes            | Yes      | Yes      | Yes                |
 | Controller activity resets the idle timer  | Yes            | Yes      | Yes      | No                 |
-| Supports `--max-idle-time-minutes`         | Yes            | Yes      | Yes      | No                 |
+| Supports `--max-idle-time-minutes`         | Yes            | Yes      | Yes      | iOS only           |
 | Activity appears in `eas simulator:events` | Yes            | Yes      | Yes      | No                 |
 
 Notes:
 
 - The start flags are `--build-id`, `--build-fingerprint`, `--application-archive-url`, `--expo-go`, `--launch-arg`, and `--open-url`. To connect an Appium client, see [Run Appium tests on a remote Android Emulator or iOS Simulator](/preview/simulators/works-with/appium/).
-- Controller activity from agent-device, Argent, or Appium resets the idle timer. Browser preview activity does not. For sessions that a person controls in the browser preview, use `--max-duration-minutes` to limit the session. See [How long an Expo Simulators session runs](/preview/simulators/how-it-works/session-lifetime/).
-- A `web-preview-only` session does not report activity, so it does not support an idle timeout.
+- Controller activity from agent-device, Argent, or Appium resets the idle timer. On iOS, browser input in the preview also resets it. Watching the preview does not reset it. For a session that a person only watches, or an Android session that a person controls, use `--max-duration-minutes` to limit the session. See [How long an Expo Simulators session runs](/preview/simulators/how-it-works/session-lifetime/).
+- An Android `web-preview-only` session does not report activity, so it does not support an idle timeout.
 
 ## Choose a session type
 
```

**File**: `docs/pages/preview/simulators/reference/usage-and-billing.mdx` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ Use these methods to keep usage low:
 | Stop idle sessions                | `--max-idle-time-minutes`, or `maxIdleTimeMinutes`                                       |
 | Find sessions that still run      | `eas simulator:list --status new --status queued --status starting --status in-progress` |
 
-Controller activity from agent-device, Argent, or Appium resets the idle timer. Browser preview activity does not. See [How long an Expo Simulators session runs](/preview/simulators/how-it-works/session-lifetime/).
+Controller activity from agent-device, Argent, or Appium resets the idle timer. On iOS, browser input and some `simulator:control` actions, such as app launches and screenshots, also reset it. Watching the preview does not reset it. See [How long an Expo Simulators session runs](/preview/simulators/how-it-works/session-lifetime/).
 
 > **warning** `--non-interactive` does not stop the session when the command returns, and a CI job that ends does not stop the session. A session that you do not stop runs until its maximum duration, or until its idle limit if you set one.
 
```

---

### Incident Patch 3: `755f7253` (2026-11-05)
**Commit Message**: fix(cli): Return null from get() when a section on the path is not an object (#52975)

# Why

`get()` in `@expo/cli/src/utils/obj.ts` uses the `in` operator on every
step of the path, and `in` throws a `TypeError` when the value is
`null`, `undefined` or a primitive. A path whose parent is missing is
handled (`get({}, 'android.package')` returns `null`), but a parent that
exists and is empty is not:

get({ splash: null }, 'splash.image') // TypeError: Cannot use 'in'
operator to search for 'image' in null
get({ splash: undefined }, 'splash.image') // same, for undefined
get({ ios: 'oops' }, 'ios.bundleIdentifier') // same, for a string

`get()` is used with config paths in two places: `AppIdResolver`
(`android.package`, `ios.bundleIdentifier`) and
`getAssetFieldPathsForManifestAsync` in `resolveAssets.ts`, which calls
it for every asset field (`splash.image`, `notification.icon`,
`android.adaptiveIcon.foregroundImage`, ...) inside a single `try`. From
reading the code, one `null` or `undefined` section (for example from an
`app.config.js` that sets `splash: someCondition ? {...} : undefined`)
makes that call throw, and `resolveManifestAssets` then logs "Unable to
resolve manifest a

**File**: `.changeset/cli-get-null-config-sections.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@expo/cli': patch
+---
+
+Fix `expo start` skipping all manifest assets (icons, splash images) when a config section on an asset path, such as `splash`, is `null` or `undefined`.
```

**File**: `packages/@expo/cli/src/utils/__tests__/obj-test.ts` (modified, +16/-0)
```diff
@@ -23,6 +23,22 @@ describe(get, () => {
   it(`returns null`, () => {
     expect(get({ a: { b: { c: 'd' } } }, 'a.b.d')).toEqual(null);
   });
+  it(`returns null when a section on the path is null or undefined`, () => {
+    expect(get({ splash: null }, 'splash.image')).toEqual(null);
+    expect(get({ splash: undefined }, 'splash.image')).toEqual(null);
+    expect(
+      get({ android: { adaptiveIcon: null } }, 'android.adaptiveIcon.foregroundImage')
+    ).toEqual(null);
+  });
+  it(`returns null when a section on the path is a primitive`, () => {
+    expect(get({ ios: 'oops' }, 'ios.bundleIdentifier')).toEqual(null);
+    expect(get({ a: 1 }, 'a.b')).toEqual(null);
+  });
+  it(`still returns a falsy value that is set`, () => {
+    expect(get({ a: { b: 0 } }, 'a.b')).toEqual(0);
+    expect(get({ a: { b: '' } }, 'a.b')).toEqual('');
+    expect(get({ a: { b: null } }, 'a.b')).toEqual(null);
+  });
 });
 
 describe(pickBy, () => {
```

**File**: `packages/@expo/cli/src/utils/obj.ts` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ export function get(obj: any, key: string): any | null {
   let current: any = obj;
   let branch: string | undefined;
   while ((branch = branches.shift())) {
-    if (!(branch in current)) {
+    if (current == null || typeof current !== 'object' || !(branch in current)) {
       return null;
     }
     current = current[branch];
```

#### Recent Merged Pull Requests:
- **PR #53091** (2026-11-06): chore(fingerprint): Drop `glob` and add `minimatch@^10` usage note (@kitten)
- **PR #53080** (2026-11-06): [docs] Sync upstream reference content (EAS CLI reference, other) (@expo-bot)
- **PR #53063** (2026-11-06): [ios][android][updates] Fix the log test race and clear every log entry (@douglowder)
- **PR #53057** (2026-11-06): fix(cli): Stop OSC 7501 program status from failing commands when it throws (@ramonclaudio)
- **PR #53051** (2026-11-06): [ci] Skip unrelated workflows for native test-only changes (@tsapeta)
- **PR #53050** (2026-11-05): [jsi] Make JSI function, BigInt, symbol and buffer types conform to `JavaScriptCodable` (@tsapeta)

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

## X. cli): Stop OSC 7501 program status from failing commands when it throws (#53057)

**RULE**:
When implementing operations in `.changeset/cli-osc-7501-status-guard.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in expo/expo. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `46e555c4`: cli): Stop OSC 7501 program status from failing commands when it throws (#53057). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.changeset/cli-osc-7501-status-guard.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
---
'@expo/cli': patch
---

Stop OSC 7501 program status from failing a command when reporting it throws.
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `46e555c4` are properly handled with clean fallback behavior.
