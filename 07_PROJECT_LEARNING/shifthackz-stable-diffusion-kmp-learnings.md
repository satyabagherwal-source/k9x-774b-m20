# Forensic Learning Record (Deep Inspection): ShiftHackZ/Stable-Diffusion-KMP

> **Canonical Artifact**: `07_PROJECT_LEARNING/shifthackz-stable-diffusion-kmp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ShiftHackZ/Stable-Diffusion-KMP](https://github.com/ShiftHackZ/Stable-Diffusion-KMP))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:05:14.946Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ShiftHackZ/Stable-Diffusion-KMP`
- **Description**: Stable Diffusion AI client app for Android and iOS
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1275 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `core/common/src/androidMain/kotlin/com/shifthackz/aisdv1/core/common/extensions/AppExtensions.kt`
```
package com.shifthackz.aisdv1.core.common.extensions

import android.app.ActivityManager
import android.app.ActivityManager.RunningAppProcessInfo
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.widget.Toast
import androidx.annotation.StringRes

/**
 * Executes the `isAppInForeground` step in the SDAI core common layer.
 *
 * @return Result produced by `isAppInForeground`.
 * @author Dmitriy Moroz
 */
fun Context.isAppInForeground(): Boolean {
    val activityManager = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    val processes = activityManager.runningAppProcesses ?: return false

    return processes.any { process ->
        process.uid == applicationInfo.uid && process.importance == RunningAppProcessInfo.IMPORTANCE_FOREGROUND
    }
}

/**
 * Executes the `showToast` step in the SDAI core common layer.
 *
 * @param resId res id value consumed by the API.
 * @author Dmitriy Moroz
 */
fun Context.showToast(@StringRes resId: Int) {
    resources.getString(resId).let(::showToast)
}

/**
 * Executes the `showToast` step in the SDAI core common layer.
 *
 * @param text text value consumed by the API.
 * @author Dmitriy Moroz
 */
fun Context.showToast(text: String) {
    Toast.makeText(this, text, Toast.LENGTH_LONG).show()
}

/**
 * Executes the `openAppSettings` step in the SDAI core common layer.
 *
 * @author Dmitriy Moroz
 */
fun Context.openAppSettings() {
    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
    val uri = Uri.fromParts("package", packageName, null)
    intent.setData(uri)
    startActivity(intent)
}

```

### Core Architecture Module: `core/common/src/androidMain/kotlin/com/shifthackz/aisdv1/core/common/extensions/ClipboardExtensions.kt`
```
package com.shifthackz.aisdv1.core.common.extensions

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context

/**
 * Executes the `copyToClipboard` step in the SDAI core common layer.
 *
 * @param text text value consumed by the API.
 * @author Dmitriy Moroz
 */
fun Context.copyToClipboard(text: CharSequence) {
    val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val clip = ClipData.newPlainText("label", text)
    clipboard.setPrimaryClip(clip)
}

```

### Core Architecture Module: `core/common/src/androidMain/kotlin/com/shifthackz/aisdv1/core/common/extensions/DateExtensions.kt`
```
package com.shifthackz.aisdv1.core.common.extensions

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Loads SDAI data through `getRawDay`.
 *
 * @author Dmitriy Moroz
 */
fun Date.getRawDay(): Int = SimpleDateFormat("dd", Locale.ROOT).format(this).toInt()

/**
 * Loads SDAI data through `getRawMonth`.
 *
 * @author Dmitriy Moroz
 */
fun Date.getRawMonth(): Int = SimpleDateFormat("MM", Locale.ROOT).format(this).toInt()

/**
 * Loads SDAI data through `getRawYear`.
 *
 * @author Dmitriy Moroz
 */
fun Date.getRawYear(): Int = SimpleDateFormat("yyyy", Locale.ROOT).format(this).toInt()

/**
 * Loads SDAI data through `getDayRange`.
 *
 * @return Result produced by `getDayRange`.
 * @author Dmitriy Moroz
 */
fun Date.getDayRange(): Pair<Date, Date> {
    val formatter = SimpleDateFormat("dd.MM.yyyy'T'HH:mm:ss.SSS", Locale.ROOT)
    val prefix = "${getRawDay()}.${getRawMonth()}.${getRawYear()}"
    val start = formatter.parse("${prefix}T00:00:00.000") ?: this
    val end = formatter.parse("${prefix}T23:59:59.999") ?: this
    return start to end
}

/**
 * Executes the `format` step in the SDAI core common layer.
 *
 * @param format format value consumed by the API.
 * @param locale locale value consumed by the API.
 * @return Result produced by `format`.
 * @author Dmitriy Moroz
 */
fun Date.format(
    format: String = "yyyy-MM-dd",
    locale: Locale = Locale.ROOT,
): String = runCatching {
    val df = SimpleDateFormat(format, locale)
    df.format(this)
}.getOrDefault("")

/**
 * Converts SDAI data with `toDate`.
 *
 * @param format format value consumed by the API.
 * @param locale locale value consumed by the API.
 * @return Result produced by `toDate`.
 * @author Dmitriy Moroz
 */
fun String.toDate(
    format: String = "yyyy-MM-dd",
    locale: Locale = Locale.ROOT,
): Date = runCatching {
    val df = SimpleDateFormat(format, locale)
    df.parse(this)
}.getOrDefault(Date())

```

### Core Architecture Module: `core/common/src/androidMain/kotlin/com/shifthackz/aisdv1/core/common/extensions/UriExtensions.kt`
```
package com.shifthackz.aisdv1.core.common.extensions

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.annotation.ChecksSdkIntAtLeast
import androidx.core.content.FileProvider
import java.io.File

/**
 * Executes the `shouldUseNewMediaStore` step in the SDAI core common layer.
 *
 * @return Result produced by `shouldUseNewMediaStore`.
 * @author Dmitriy Moroz
 */
@ChecksSdkIntAtLeast(api = Build.VERSION_CODES.S_V2)
fun shouldUseNewMediaStore(): Boolean {
    return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S_V2
}

/**
 * Executes the `uriFromFile` step in the SDAI core common layer.
 *
 * @param file file used by the operation.
 * @param fileProviderPath file provider path value consumed by the API.
 * @return Result produced by `uriFromFile`.
 * @author Dmitriy Moroz
 */
fun Context.uriFromFile(file: File, fileProviderPath: String): Uri {
    return FileProvider.getUriForFile(this, fileProviderPath, file)
}

/**
 * Executes the `openUri` step in the SDAI core common layer.
 *
 * @param uri uri value consumed by the API.
 * @author Dmitriy Moroz
 */
fun Context.openUri(uri: Uri) {
    val uriIntent = Intent(Intent.ACTION_VIEW, uri)
    startActivity(uriIntent)
}

/**
 * Executes the `openUrl` step in the SDAI core common layer.
 *
 * @param url remote URL used by the operation.
 * @author Dmitriy Moroz
 */
fun Context.openUrl(url: String) {
    val uri = Uri.parse(url)
    openUri(uri)
}

```

### Core Architecture Module: `core/common/src/androidMain/kotlin/com/shifthackz/aisdv1/core/common/file/FileExtensions.kt`
```
package com.shifthackz.aisdv1.core.common.file

import android.graphics.Bitmap
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipFile
import java.util.zip.ZipOutputStream

/**
 * Converts SDAI data with `writeBitmap`.
 *
 * @param bitmap bitmap image processed by the operation.
 * @param format format value consumed by the API.
 * @param quality quality value consumed by the API.
 * @author Dmitriy Moroz
 */
fun File.writeBitmap(
    bitmap: Bitmap,
    format: Bitmap.CompressFormat = Bitmap.CompressFormat.JPEG,
    quality: Int = 100,
) {
    outputStream().use { out ->
        bitmap.compress(format, quality, out)
        out.flush()
    }
}

/**
 * Executes the `writeFilesToZip` step in the SDAI core common layer.
 *
 * @param files files used by the operation.
 * @param bufferSize buffer size value consumed by the API.
 * @author Dmitriy Moroz
 */
fun File.writeFilesToZip(
    files: List<File>,
    bufferSize: Int = 1024,
) {
    outputStream().use { out ->
        ZipOutputStream(out).use { zipOut ->
            val buffer = ByteArray(bufferSize)
            files.forEach { file ->
                val zipEntry = ZipEntry(
                    file.path.substring(file.path.lastIndexOf("/") + 1)
                )
                zipOut.putNextEntry(zipEntry)
                BufferedInputStream(file.inputStream(), bufferSize).use { fileInput ->
                    var count: Int
                    while (fileInput.read(buffer, 0, bufferSize).also { count = it } != -1) {
                        zipOut.write(buffer, 0, count)
                    }
                    fileInput.close()
                }
            }
            zipOut.close()
        }
    }
}

/**
 * Executes the `unzip` step in the SDAI core common layer.
 *
 * @author Dmitriy Moroz
 */
fun File.unzip() {
    if (!path.endsWith(".zip")) return
    val destinationDir = parentFile ?: return

    fun extractFile(inputStream: InputStream, destFilePath: String) {
        val bos = BufferedOutputStream(FileOutputStream(destFilePath))
        val bytesIn = ByteArray(DEFAULT_BUFFER_SIZE)
        var read: Int
        while (inputStream.read(bytesIn).also { read = it } != -1) {
            bos.write(bytesIn, 0, read)
        }
        bos.close()
    }

    ZipFile(this).use { zip ->
        zip.entries().asSequence().forEach { entry ->
            zip.getInputStream(entry).use { inputStream ->
                val filePath = destinationDir.path + File.separator + entry.name
                if (!entry.isDirectory) {
                    extractFile(inputStream, filePath)
                } else {
                    val dir = File(filePath)
                    dir.mkdir()
                }
            }
        }
    }
}

```

### Core Architecture Module: `core/common/src/androidMain/kotlin/com/shifthackz/aisdv1/core/common/log/FileLoggingTree.kt`
```
package com.shifthackz.aisdv1.core.common.log

import android.util.Log
import com.shifthackz.aisdv1.core.common.appbuild.BuildInfoProvider
import com.shifthackz.aisdv1.core.common.file.FileProviderDescriptor
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.koin.core.component.KoinComponent
import org.koin.core.component.inject
import timber.log.Timber
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Coordinates `FileLoggingTree` behavior in the SDAI core common layer.
 *
 * @author Dmitriy Moroz
 */
class FileLoggingTree : Timber.Tree(), KoinComponent {

    /**
     * Exposes the `fileProviderDescriptor` value used by the SDAI core common layer.
     *
     * @author Dmitriy Moroz
     */
    private val fileProviderDescriptor: FileProviderDescriptor by inject()
    /**
     * Exposes the `buildInfoProvider` value used by the SDAI core common layer.
     *
     * @author Dmitriy Moroz
     */
    private val buildInfoProvider: BuildInfoProvider by inject()
    /**
     * Exposes the `writeMutex` value used by the SDAI core common layer.
     *
     * @author Dmitriy Moroz
     */
    private val writeMutex = Mutex()
    /**
     * Exposes the `logScope` value used by the SDAI core common layer.
     *
     * @author Dmitriy Moroz
     */
    private val logScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /**
     * Exposes the `formatDate` value used by the SDAI core common layer.
     *
     * @author Dmitriy Moroz
     */
    private val formatDate: String
        get() = "[${SimpleDateFormat(LOGGER_TIMESTAMP_FORMAT, Locale.ROOT).format(Date())}]"

    /**
     * Exposes the `formatPriority` value used by the SDAI core common layer.
     *
     * @author Dmitriy Moroz
     */
    private val formatPriority: (Int) -> String = {
        when (it) {
            Log.ASSERT -> "[A]"
            Log.DEBUG -> "[D]"
            Log.ERROR -> "[E]"
            Log.INFO -> "[I]"
            Log.VERBOSE -> "[V]"
            Log.WARN -> "[W]"
            else -> "[U]"
        }
    }

    /**
     * Exposes the `formatTag` value used by the SDAI core common layer.
     *
     * @author Dmitriy Moroz
     */
    private val formatTag: (String?) -> String = { tag ->
        tag?.let { "[$it]" } ?: LOGGER_DEFAULT_TAG
    }

    init {
        writeLine(buildString {
            appendLine("=== APP SESSION STARTED ===")
            appendLine()
            appendLine("Version : $buildInfoProvider")
            appendLine()
        })
    }

    /**
     * Executes the `log` step in the SDAI core common layer.
     *
     * @param priority priority value consumed by the API.
     * @param tag tag value consumed by the API.
     * @param message message value consumed by the API.
     * @param t t value consumed by the API.
     * @author Dmitriy Moroz
     */
    override fun log(priority: Int, tag: String?, message: String, t: Throwable?) {
        val log = buildString {
            append(formatDate)
            append(formatPriority(priority))
            append(" ")
            append(formatTag(tag))
            append(" : ")
            append(message)
            t?.stackTraceToString()?.let { stacktrace ->
                appendLine()
                append(stacktrace)
            }
            appendLine()
        }
        writeLine(log)
    }

    /**
     * Executes the `writeLine` step in the SDAI core common layer.
     *
     * @param message message value consumed by the API.
     * @author Dmitriy Moroz
     */
    private fun writeLine(message: String) {
        logScope.launch {
            writeMutex.withLock {
                runCatching {
                    val cacheDirectory = File(fileProviderDescriptor.logsCacheDirPath)
                    if (!cacheDirectory.exists()) cacheDirectory.mkdirs()
                    val outFile = File(cacheDirectory, LOGGER_FILENAME)
                    if (!outFile.exists()) outFile.createNewFile()
                    FileOutputStream(outFile, true).use { fos ->
                        val payload = message.toByteArray()
                        fos.write(payload)
                        fos.close()
                    }
                }
            }
        }
    }

    /**
     * Provides the `companion object` singleton used by the SDAI core common layer.
     *
     * @author Dmitriy Moroz
     */
    companion object {
        /**
         * Exposes the `LOGGER_TIMESTAMP_FORMAT` value used by the SDAI core common layer.
         *
         * @author Dmitriy Moroz
         */
        private const val LOGGER_TIMESTAMP_FORMAT = "dd.MM.yyyy HH:mm:SS"
        /**
         * Exposes the `LOGGER_DEFAULT_TAG` value used by the SDAI core common layer.
         *
         * @author Dmitriy Moroz
         */
        private const val LOGGER_DEFAULT_TAG = "[SDAI]"

        /**
         * Exposes the `LOGGER_FILENAME` value used by the SDAI core common layer.
         *
         * @author Dmitriy Moroz
         */
        const val LOGGER_FILENAME = "sdaiv1.log"

        /**
         * Performs the SDAI side effect handled by `clearLog`.
         *
         * @param fileProviderDescriptor file provider descriptor value consumed by the API.
         * @author Dmitriy Moroz
         */
        fun clearLog(fileProviderDescriptor: FileProviderDescriptor) {
            val cacheDirectory = File(fileProviderDescriptor.logsCacheDirPath)
            cacheDirectory.deleteRecursively()
        }
    }
}

```

### Core Architecture Module: `core/common/src/androidMain/kotlin/com/shifthackz/aisdv1/core/common/log/TimberLogging.kt`
```
@file:Suppress("NOTHING_TO_INLINE")

package com.shifthackz.aisdv1.core.common.log

import timber.log.Timber

/**
 * Executes the `debugLog` step in the SDAI core common layer.
 *
 * @param tag tag value consumed by the API.
 * @param message message value consumed by the API.
 * @author Dmitriy Moroz
 */
inline fun debugLog(tag: String, message: String) {
    Timber.tag(tag).d(message)
}

/**
 * Executes the `debugLog` step in the SDAI core common layer.
 *
 * @param tag tag value consumed by the API.
 * @param message message value consumed by the API.
 * @author Dmitriy Moroz
 */
inline fun debugLog(tag: String, message: Any?) {
    Timber.tag(tag).d(message.toString())
}

/**
 * Executes the `infoLog` step in the SDAI core common layer.
 *
 * @param tag tag value consumed by the API.
 * @param message message value consumed by the API.
 * @param error error value consumed by the API.
 * @author Dmitriy Moroz
 */
inline fun infoLog(tag: String, message: String? = null, error: Throwable? = null) {
    Timber.tag(tag).i(error, message)
}

/**
 * Executes the `errorLog` step in the SDAI core common layer.
 *
 * @param tag tag value consumed by the API.
 * @param error error value consumed by the API.
 * @param message message value consumed by the API.
 * @author Dmitriy Moroz
 */
inline fun errorLog(tag: String, error: Throwable? = null, message: String? = null) {
    Timber.tag(tag).e(error, message)
}

// region generic extensions
/**
 * Executes the `debugLog` step in the SDAI core common layer.
 *
 * @param message message value consumed by the API.
 * @author Dmitriy Moroz
 */
inline fun <reified T : Any> T.debugLog(message: String) {
    debugLog(loggingTag, message)
}

/**
 * Executes the `debugLog` step in the SDAI core common layer.
 *
 * @param message message value consumed by the API.
 * @author Dmitriy Moroz
 */
inline fun <reified T : Any> T.debugLog(message: Any) {
    debugLog(loggingTag, message.toString())
}

/**
 * Executes the `infoLog` step in the SDAI core common layer.
 *
 * @param message message value consumed by the API.
 * @param error error value consumed by the API.
 * @author Dmitriy Moroz
 */
inline fun <reified T : Any> T.infoLog(message: String? = null, error: Throwable? = null) {
    infoLog(loggingTag, message, error)
}

/**
 * Executes the `errorLog` step in the SDAI core common layer.
 *
 * @param error error value consumed by the API.
 * @param message message value consumed by the API.
 * @author Dmitriy Moroz
 */
inline fun <reified T : Any> T.errorLog(error: Throwable? = null, message: String? = null) {
    errorLog(loggingTag, error, message)
}
// endregion

/**
 * Exposes the `property` value used by the SDAI core common layer.
 *
 * @author Dmitriy Moroz
 */
@PublishedApi
internal inline val <T : Any> T.loggingTag: String
    get() {
        val tag = this::class.java.name.substringAfterLast(".")
        if (tag.contains("$")) {
            return tag.substringBefore("$")
        }
        return tag
    }

```

### Core Architecture Module: `core/common/src/androidMain/kotlin/com/shifthackz/aisdv1/core/common/model/Hexagonal.kt`
```
package com.shifthackz.aisdv1.core.common.model

import java.io.Serializable

/**
 * Carries `Hexagonal` data through the SDAI core common layer.
 *
 * @author Dmitriy Moroz
 */
data class Hexagonal<out A, out B, out C, out D, out E, out F>(
    /**
     * Exposes the `first` value used by the SDAI core common layer.
     *
     * @author Dmitriy Moroz
     */
    val first: A,
    /**
     * Exposes the `second` value used by the SDAI core common layer.
     *
     * @author Dmitriy Moroz
     */
    val second: B,
    /**
     * Exposes the `third` value used by the SDAI core common layer.
     *
     * @author Dmitriy Moroz
     */
    val third: C,
    /**
     * Exposes the `fourth` value used by the SDAI core common layer.
     *
     * @author Dmitriy Moroz
     */
    val fourth: D,
    /**
     * Exposes the `fifth` value used by the SDAI core common layer.
     *
     * @author Dmitriy Moroz
     */
    val fifth: E,
    /**
     * Exposes the `sixth` value used by the SDAI core common layer.
     *
     * @author Dmitriy Moroz
     */
    val sixth: F,
) : Serializable {

    /**
     * Converts SDAI data with `toString`.
     *
     * @return Result produced by `toString`.
     * @author Dmitriy Moroz
     */
    override fun toString(): String = "($first, $second, $third, $fourth, $fifth, $sixth)"
}

```

### Core Architecture Module: `core/common/src/androidMain/kotlin/com/shifthackz/aisdv1/core/common/model/Quintuple.kt`
```
package com.shifthackz.aisdv1.core.common.model

import java.io.Serializable

/**
 * Carries `Quintuple` data through the SDAI core common layer.
 *
 * @author Dmitriy Moroz
 */
data class Quintuple<out A, out B, out C, out D, out E>(
    /**
     * Exposes the `first` value used by the SDAI core common layer.
     *
     * @author Dmitriy Moroz
     */
    val first: A,
    /**
     * Exposes the `second` value used by the SDAI core common layer.
     *
     * @author Dmitriy Moroz
     */
    val second: B,
    /**
     * Exposes the `third` value used by the SDAI core common layer.
     *
     * @author Dmitriy Moroz
     */
    val third: C,
    /**
     * Exposes the `fourth` value used by the SDAI core common layer.
     *
     * @author Dmitriy Moroz
     */
    val fourth: D,
    /**
     * Exposes the `fifth` value used by the SDAI core common layer.
     *
     * @author Dmitriy Moroz
     */
    val fifth: E,
) : Serializable {

    /**
     * Converts SDAI data with `toString`.
     *
     * @return Result produced by `toString`.
     * @author Dmitriy Moroz
     */
    override fun toString(): String = "($first, $second, $third, $fourth, $fifth)"
}

```

### Core Architecture Module: `core/common/src/androidMain/kotlin/com/shifthackz/aisdv1/core/common/time/PlatformTime.android.kt`
```
package com.shifthackz.aisdv1.core.common.time

/**
 * Executes the `platformNanoTime` step in the SDAI core common layer.
 *
 * @author Dmitriy Moroz
 */
internal actual fun platformNanoTime(): Long = System.nanoTime()

/**
 * Executes the `platformCurrentTimeMillis` step in the SDAI core common layer.
 *
 * @author Dmitriy Moroz
 */
internal actual fun platformCurrentTimeMillis(): Long = System.currentTimeMillis()

```

### Core Architecture Module: `core/common/src/commonMain/kotlin/com/shifthackz/aisdv1/core/common/extensions/KotlinExtensions.kt`
```
package com.shifthackz.aisdv1.core.common.extensions

/**
 * Executes the `applyIf` step in the SDAI core common layer.
 *
 * @param predicate predicate value consumed by the API.
 * @param block block value consumed by the API.
 * @return Result produced by `applyIf`.
 * @author Dmitriy Moroz
 */
inline fun <T> T.applyIf(predicate: Boolean, block: T.() -> Unit): T {
    if (!predicate) return this
    return apply(block)
}

```

### Core Architecture Module: `core/common/src/commonMain/kotlin/com/shifthackz/aisdv1/core/common/extensions/StringExtensions.kt`
```
package com.shifthackz.aisdv1.core.common.extensions

/**
 * Exposes the `PROTOCOL_DELIMITER` value used by the SDAI core common layer.
 *
 * @author Dmitriy Moroz
 */
private const val PROTOCOL_DELIMITER = "://"
/**
 * Exposes the `PROTOCOL_HOLDER` value used by the SDAI core common layer.
 *
 * @author Dmitriy Moroz
 */
private const val PROTOCOL_HOLDER = "[[_PROTOCOL_]]"

/**
 * Executes the `fixUrlSlashes` step in the SDAI core common layer.
 *
 * @return Result produced by `fixUrlSlashes`.
 * @author Dmitriy Moroz
 */
fun String.fixUrlSlashes(): String = this
    .replace(PROTOCOL_DELIMITER, PROTOCOL_HOLDER)
    .replace(Regex("/{2,}"), "/")
    .let { str ->
        when {
            str.isEmpty() -> ""
            str.last() == '/' -> str.substring(0, str.lastIndex)
            else -> str
        }
    }
    .replace(PROTOCOL_HOLDER, PROTOCOL_DELIMITER)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #230** (2024-08-09): **Local diffusion downloads**
  *Symptoms*: When I try to download 2 models at same time after taping the second model the first one stops downloading and after the second one finished the 1st one won't continue. 

- **Issue #48** (2023-07-20): **Gallery not always visible**
  *Symptoms*: Thanks for the great work. I hope in the future the API will support more features. I can successfully generate images, but even with "always save images" activated, they are only visible in the app gallery and I have to manually save them in the phone gallery. Is it possible to automatically save them there? My problem is, that after a while, the app gallery is not visible anymore and then I have no access to the generated images at all. Screenshot of the app gallery showing the problem ![Screenshot_2023-05-28-16-11-14-441_com.shifthackz.aisdv1.app.jpg](https://github.com/ShiftHackZ/Stable-Diffusion-Android/assets/15450754/79cc212a-90b9-4b60-bab9-766364e87eea)   
  **Post-Mortem & Fix Analysis**:
  > Hi @lead0r, thanks for telling about the issue.  The images are stored in local SQL-based DB as base64 string (not as actual file), so it is likely that some base64 reached the max limit, and there is an exception occurring while gallery loading and trying to convert that broken base64 to bitmap.  I think it can be fixed in converter not to process bad base64.  By the way, do you remember what image sizes you had in your gallery? Are there any images that are significantly large (like 2048x2048) ? 
  > I don't remember, but that is very much likely, yes 
  > Sorry to reply on this issue, but is there a way to export the SQL database? There are some images I've generated but can't view in the gallery as it only lets me scroll back around 20 images before it just stops. On version 0.5.2 (165)

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

### Incident Patch 1: `60ff1c39` (2026-07-19)
**Commit Message**: Merge release 1.1.2 fixes back into develop

**File**: `CITATION.cff` (modified, +2/-2)
```diff
@@ -2,8 +2,8 @@ cff-version: 1.2.0
 message: "If you use this software, please cite it using the metadata below."
 title: "SDAI"
 type: software
-version: "1.1.1"
-date-released: "2026-07-16"
+version: "1.1.2"
+date-released: "2026-07-19"
 abstract: >-
   SDAI is an open-source, cross-platform AI image generation client for
   Android and iOS. It provides a unified mobile workflow for self-hosted
```

**File**: `README.md` (modified, +2/-2)
```diff
@@ -225,7 +225,7 @@ Machine-readable citation metadata is available in [`CITATION.cff`](CITATION.cff
 
 If you mention SDAI in research, articles, benchmarks, tutorials, app collections, or public project documentation, please cite it as:
 
-> SDAI, version 1.1.1, an open-source cross-platform AI image generation client by Dmytro Moroz (Moroz Inc.). https://github.com/ShiftHackZ/Stable-Diffusion-KMP
+> SDAI, version 1.1.2, an open-source cross-platform AI image generation client by Dmytro Moroz (Moroz Inc.). https://github.com/ShiftHackZ/Stable-Diffusion-KMP
 
 BibTeX:
 
@@ -235,6 +235,6 @@ BibTeX:
   author = {Moroz, Dmytro},
   year = {2026},
   howpublished = {GitHub repository: https://github.com/ShiftHackZ/Stable-Diffusion-KMP},
-  note = {Version 1.1.1; open-source cross-platform AI image generation client}
+  note = {Version 1.1.2; open-source cross-platform AI image generation client}
 }
 ```
```

**File**: `feature/benchmark/src/androidMain/cpp/CMakeLists.txt` (modified, +5/-0)
```diff
@@ -6,6 +6,11 @@ set(CMAKE_CXX_STANDARD 17)
 set(CMAKE_CXX_STANDARD_REQUIRED ON)
 set(CMAKE_POSITION_INDEPENDENT_CODE ON)
 
+add_compile_options(
+    "-ffile-prefix-map=${CMAKE_SOURCE_DIR}=."
+    "-ffile-prefix-map=${CMAKE_BINARY_DIR}=."
+)
+
 add_library(
     sdai_benchmark
     SHARED
```

**File**: `feature/bonsai/src/androidMain/cpp/CMakeLists.txt` (modified, +5/-0)
```diff
@@ -6,6 +6,11 @@ set(CMAKE_CXX_STANDARD 17)
 set(CMAKE_CXX_STANDARD_REQUIRED ON)
 set(CMAKE_POSITION_INDEPENDENT_CODE ON)
 
+add_compile_options(
+    "-ffile-prefix-map=${CMAKE_SOURCE_DIR}=."
+    "-ffile-prefix-map=${CMAKE_BINARY_DIR}=."
+)
+
 add_library(
     sdai_bonsai
     SHARED
```

**File**: `gradle/libs.versions.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [versions]
-versionName = "1.1.1"
-versionCode = "208"
+versionName = "1.1.2"
+versionCode = "209"
 targetSdk = "36"
 compileSdk = "36"
 minSdk = "24"
```

---

### Incident Patch 2: `db8910d7` (2026-07-19)
**Commit Message**: fix: Normalize Bonsai native build paths

**File**: `feature/benchmark/src/androidMain/cpp/CMakeLists.txt` (modified, +5/-0)
```diff
@@ -6,6 +6,11 @@ set(CMAKE_CXX_STANDARD 17)
 set(CMAKE_CXX_STANDARD_REQUIRED ON)
 set(CMAKE_POSITION_INDEPENDENT_CODE ON)
 
+add_compile_options(
+    "-ffile-prefix-map=${CMAKE_SOURCE_DIR}=."
+    "-ffile-prefix-map=${CMAKE_BINARY_DIR}=."
+)
+
 add_library(
     sdai_benchmark
     SHARED
```

**File**: `feature/bonsai/src/androidMain/cpp/CMakeLists.txt` (modified, +5/-0)
```diff
@@ -6,6 +6,11 @@ set(CMAKE_CXX_STANDARD 17)
 set(CMAKE_CXX_STANDARD_REQUIRED ON)
 set(CMAKE_POSITION_INDEPENDENT_CODE ON)
 
+add_compile_options(
+    "-ffile-prefix-map=${CMAKE_SOURCE_DIR}=."
+    "-ffile-prefix-map=${CMAKE_BINARY_DIR}=."
+)
+
 add_library(
     sdai_bonsai
     SHARED
```

---

### Incident Patch 3: `21861852` (2026-07-14)
**Commit Message**: fix: F-Droid build reproducibility, SDCPP source dir prefixes, non arm64-v8a binaries from FOSS build

**File**: `app/android/build.gradle.kts` (modified, +9/-0)
```diff
@@ -49,6 +49,15 @@ android {
         manifestPlaceholders["excludePermissions"] = "true"
     }
 
+    productFlavors {
+        getByName("foss") {
+            ndk {
+                //noinspection ChromeOsAbiSupport
+                abiFilters += "arm64-v8a"
+            }
+        }
+    }
+
     val signingPropertiesFile = rootProject.file("app/keystore/signing.properties")
     if (signingPropertiesFile.exists()) {
         val props = Properties()
```

**File**: `feature/sdxl/src/androidMain/cpp/CMakeLists.txt` (modified, +5/-0)
```diff
@@ -64,6 +64,11 @@ set(CMAKE_CXX_STANDARD 17)
 set(CMAKE_CXX_STANDARD_REQUIRED ON)
 set(CMAKE_POSITION_INDEPENDENT_CODE ON)
 
+add_compile_options(
+    "-ffile-prefix-map=${CMAKE_SOURCE_DIR}=."
+    "-ffile-prefix-map=${CMAKE_BINARY_DIR}=."
+)
+
 set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
 set(SD_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
 set(SD_BUILD_TESTS OFF CACHE BOOL "" FORCE)
```

---

### Incident Patch 4: `71f8610c` (2026-06-14)
**Commit Message**: Merge nightly build workflow into develop

# Conflicts:
#	README.md

**File**: `.github/workflows/nightly_android.yml` (added, +253/-0)
```diff
@@ -0,0 +1,253 @@
+name: Android Full Nightly
+
+on:
+  workflow_dispatch:
+    inputs:
+      target_ref:
+        description: Branch, tag, or SHA to build.
+        required: true
+        default: develop
+      force:
+        description: Build even when no functional files changed since the previous nightly.
+        required: true
+        type: boolean
+        default: false
+      publish:
+        description: Publish or update the public nightly GitHub prerelease.
+        required: true
+        type: boolean
+        default: true
+  schedule:
+    - cron: "37 2 * * *"
+
+permissions:
+  contents: write
+
+concurrency:
+  group: android-full-nightly
+  cancel-in-progress: false
+
+env:
+  APK_NAME: sdai-full-nightly.apk
+  NIGHTLY_TAG: nightly
+  NIGHTLY_RELEASE_NAME: Android Full Nightly
+
+jobs:
+  nightly:
+    name: Build Android full nightly
+    runs-on: ubuntu-24.04
+    timeout-minutes: 90
+    env:
+      TARGET_REF: ${{ github.event_name == 'workflow_dispatch' && inputs.target_ref || 'develop' }}
+      FORCE_NIGHTLY: ${{ github.event_name == 'workflow_dispatch' && inputs.force || false }}
+      PUBLISH_NIGHTLY: ${{ github.event_name != 'workflow_dispatch' || inputs.publish }}
+
+    steps:
+      - name: Checkout target ref
+        uses: actions/checkout@v4
+        with:
+          ref: ${{ github.event_name == 'workflow_dispatch' && inputs.target_ref || 'develop' }}
+          fetch-depth: 0
+          submodules: recursive
+
+      - name: Check whether a nightly is needed
+        id: plan
+        shell: bash
+        run: |
+          set -euo pipefail
+
+          git fetch --force origin "refs/tags/${NIGHTLY_TAG}:refs/tags/${NIGHTLY_TAG}" || true
+
+          target_sha="$(git rev-parse HEAD)"
+          echo "target_sha=${target_sha}" >> "${GITHUB_OUTPUT}"
+
+          if ! git rev-parse --verify "${NIGHTLY_TAG}^{commit}" >/dev/null 2>&1; then
+            echo "should_build=true" >> "${GITHUB_OUTPUT}"
+            echo "reason=No previous nightly tag exists." >> "${GITHUB_OUTPUT}"
+            {
+              echo "### Android full nightly"
+              echo
+              echo "No previous nightly tag exists. Building ${target_sha}."
+            } >> "${GITHUB_STEP_SUMMARY}"
+            exit 0
+          fi
+
+          if [[ "${FORCE_NIGHTLY}" == "true" ]]; then
+            echo "should_build=true" >> "${GITHUB_OUTPUT}"
+            echo "reason=Manual force build was requested." >> "${GITHUB_OUTPUT}"
+            {
+              echo "### Android full nightly"
+              echo
+              echo "Manual force build requested for ${target_sha}."
+            } >> "${GITHUB_STEP_SUMMARY}"
+            exit 0
+          fi
+
+          git diff --name-only "${NIGHTLY_TAG}..HEAD" > "${RUNNER_TEMP}/nightly-changed-files.txt"
+
+          functional_pattern='^(app/|core/|data/|demo/|domain/|feature/|network/|presentation/|storage/|build-logic/|gradle/|build\.gradle\.kts$|settings\.gradle\.kts$|gradle\.properties$|gradlew$|gradlew\.bat$)'
+          if grep -Eq "${functional_pattern}" "${RUNNER_TEMP}/nightly-changed-files.txt"; then
+            echo "should_build=true" >> "${GITHUB_OUTPUT}"
+            echo "reason=Functional files changed since the previous nightly." >> "${GITHUB_OUTPUT}"
+          else
+            echo "should_build=false" >> "${GITHUB_OUTPUT}"
+            echo "reason=Only documentation, website, or repository metadata changed since the previous nightly." >> "${GITHUB_OUTPUT}"
+          fi
+
+          {
+            echo "### Android full nightly"
+            echo
+            echo "Target ref: \`${TARGET_REF}\`"
+            echo "Target commit: \`${target_sha}\`"
+            echo "Decision: \`$(grep '^should_build=' "${GITHUB_OUTPUT}" | tail -n 1 | cut -d= -f2)\`"
+            echo
+            echo "Changed files since \`${NIGHTLY_TAG}\`:"
+            echo
+            sed 's/^/- `/' "${RUNNER_TEMP}/nightly-changed-files.txt" | sed 's/$/`/' || true
+          } >> "${GITHUB_STEP_SUMMARY}"
+
+      - name: Set up JDK 17
+        if: steps.plan.outputs.should_build == 'true'
+        uses: actions/setup-java@v4
+        with:
+          distribution: temurin
+          java-version: "17"
+
+      - name: Set up Gradle
+        if: steps.plan.outputs.should_build == 'true'
+        uses: gradle/actions/setup-gradle@v4
+
+      - name: Build unsigned full release APK
+        if: steps.plan.outputs.should_build == 'true'
+        shell: bash
+        run: |
+          set -euo pipefail
+
+          ./gradlew :app:assembleFullRelease \
+            --no-daemon \
+            -Dkotlin.native.ignoreDisabledTargets=true \
+            -Pkotlin.native.ignoreDisabledTargets=true
+
+      - name: Sign APK with apksigner key and certificate
+        if: steps.plan.outputs.should_build == 'true'
+        id: sign
+        shell: bash
+        env:
+          ANDROID_NIGHTLY_CERT_PEM_BASE64: ${{ secrets.ANDROID_NIGHTLY_CERT_PEM_BASE64 }}
+     
```

**File**: `NIGHTLY_BUILDS.md` (added, +84/-0)
```diff
@@ -0,0 +1,84 @@
+# Nightly Android Builds
+
+SDAI publishes an Android `full` flavor nightly APK from `develop` through GitHub Actions.
+
+The public APK URL is stable:
+
+```text
+https://github.com/ShiftHackZ/Stable-Diffusion-Android/releases/download/nightly/sdai-full-nightly.apk
+```
+
+The release page is:
+
+```text
+https://github.com/ShiftHackZ/Stable-Diffusion-Android/releases/tag/nightly
+```
+
+## What Gets Built
+
+- Android only.
+- `full` flavor only.
+- Gradle produces an unsigned release APK; CI signs that APK with Android SDK `apksigner`.
+- The scheduled workflow runs daily and skips the build when only docs, website files, or repository metadata changed since the previous nightly.
+- Manual `force` builds can publish a new artifact even when the functional-file check would skip.
+
+The workflow does not commit generated files or changing build metadata back to the repository.
+
+## Publication Model
+
+Nightlies are published to one GitHub prerelease named `Android Full Nightly`, backed by the moving tag `nightly`.
+
+The workflow force-moves the `nightly` tag to the built commit, removes obsolete uploaded assets from the nightly release, and uploads the current assets with fixed filenames using overwrite mode. The Releases page should therefore show one nightly release, and that release should contain only the latest APK and checksum assets.
+
+The workflow does not upload separate GitHub Actions artifacts, so APK downloads are kept in the single current nightly release.
+
+## Signing Model
+
+Nightly signing does not use JKS or Gradle `signing.properties`.
+
+The workflow signs the unsigned APK with Android SDK `apksigner` using:
+
+- `ANDROID_NIGHTLY_KEY_PK8_BASE64`: Base64-encoded plain PKCS#8 private key file.
+- `ANDROID_NIGHTLY_CERT_PEM_BASE64`: Base64-encoded X.509 certificate file.
+
+These values should be stored as repository or environment secrets. Do not commit them to the repository.
+
+If the nightly key is different from the normal `full` release signing certificate, Android will not install a nightly APK as an update over an existing `com.shifthackz.aisdv1.app.full` build. Testers must uninstall the old build first, or the nightly signing certificate must match the installed build.
+
+## Manual Run
+
+GitHub only exposes `workflow_dispatch` for workflow files that exist on the repository default branch. Keep `.github/workflows/nightly_android.yml` on `master`; the workflow still builds `develop` through the `target_ref` input.
+
+Run from the GitHub UI:
+
+1. Open `Actions`.
+2. Select `Android Full Nightly`.
+3. Click `Run workflow`.
+4. Keep `target_ref` as `develop`.
+5. Set `force` to `true` when you want a build even if no functional files changed.
+6. Keep `publish` as `true` to overwrite the public nightly prerelease assets.
+
+Run from GitHub CLI:
+
+```bash
+gh workflow run nightly_android.yml --ref master -f target_ref=develop -f force=true -f publish=true
+```
+
+After the job finishes, send the stable APK URL above to testers.
+
+## Daily Cron
+
+The workflow runs once per day:
+
+```yaml
+schedule:
+  - cron: "37 2 * * *"
+```
+
+Scheduled workflows run from the default branch, while the checkout step uses `develop` as the default build target.
+
+## F-Droid Safety
+
+Nightlies use the non-version, moving `nightly` tag and the GitHub release is marked as a prerelease. It is not a stable release tag, and scheduled builds point the moving tag at the selected build target, normally `develop`.
+
+F-Droid release automation should continue to use its normal versioned tags from `master`; do not configure F-Droid metadata to match the `nightly` tag.
```

**File**: `README.md` (modified, +2/-1)
```diff
@@ -3,7 +3,7 @@
 ![Google Play](https://img.shields.io/endpoint?color=blue&logo=google-play&logoColor=white&url=https%3A%2F%2Fplay.cuzi.workers.dev%2Fplay%3Fi%3Dcom.shifthackz.aisdv1.app%26l%3DGoogle%2520Play%26m%3D%24version)
 ![F-Droid](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Ff-droid.org%2Fapi%2Fv1%2Fpackages%2Fcom.shifthackz.aisdv1.app.foss&query=%24.packages%5B0%5D.versionName&label=F-Droid&link=https%3A%2F%2Ff-droid.org%2Fpackages%2Fcom.shifthackz.aisdv1.app.foss%2F)
 
-[Website](https://sdai.moroz.cc) | [Telegram](https://t.me/sdai_app) | [Discord](https://discord.gg/jzdR9m8Ves)
+[Website](https://sdai.moroz.cc) | [Nightly Android Full](https://github.com/ShiftHackZ/Stable-Diffusion-Android/releases/download/nightly/sdai-full-nightly.apk) | [Telegram](https://t.me/sdai_app) | [Discord](https://discord.gg/jzdR9m8Ves)
 
 <p>
   <a href="https://play.google.com/store/apps/details?id=com.shifthackz.aisdv1.app"><img src="docs/assets/badge-google-play.svg" alt="Get it on Google Play" height="54"></a>
@@ -22,6 +22,7 @@ Root-level Markdown documents:
 
 - [Documentation](DOCUMENTATION.md)
 - [Screenshot generation](SCREENSHOT_GENERATION.md)
+- [Nightly Android builds](NIGHTLY_BUILDS.md)
 - [Git workflow](GIT_WORKFLOW.md)
 - [Code of conduct](CODE_OF_CONDUCT.md)
 
```

**File**: `docs/css/site.css` (modified, +74/-1)
```diff
@@ -676,6 +676,76 @@ a:hover {
   gap: 24px;
 }
 
+.nightly-grid {
+  display: grid;
+  grid-template-columns: minmax(0, 1fr) minmax(260px, 0.42fr);
+  gap: 24px;
+  align-items: start;
+}
+
+.nightly-panel,
+.nightly-facts {
+  padding: 34px;
+  border: 1px solid var(--line);
+  border-radius: 8px;
+  background: var(--surface);
+  box-shadow: var(--shadow);
+}
+
+.nightly-panel h2 {
+  max-width: 720px;
+  margin: 0;
+}
+
+.nightly-panel p {
+  max-width: 720px;
+  margin: 18px 0 0;
+  color: var(--muted);
+}
+
+.nightly-actions {
+  display: flex;
+  flex-wrap: wrap;
+  gap: 16px;
+  align-items: center;
+  margin-top: 26px;
+}
+
+.nightly-secondary-link {
+  font-weight: 800;
+}
+
+.nightly-facts dl {
+  display: grid;
+  gap: 14px;
+  margin: 0;
+}
+
+.nightly-facts div {
+  display: grid;
+  gap: 2px;
+  padding-bottom: 14px;
+  border-bottom: 1px solid var(--line);
+}
+
+.nightly-facts div:last-child {
+  padding-bottom: 0;
+  border-bottom: 0;
+}
+
+.nightly-facts dt {
+  color: var(--muted);
+  font-size: 0.78rem;
+  font-weight: 800;
+  text-transform: uppercase;
+}
+
+.nightly-facts dd {
+  margin: 0;
+  color: var(--ink);
+  font-weight: 800;
+}
+
 .supporters-heading {
   display: grid;
   grid-template-columns: minmax(0, 1fr) auto;
@@ -900,7 +970,8 @@ a:hover {
 
   .split,
   .community-grid,
-  .cta-grid {
+  .cta-grid,
+  .nightly-grid {
     grid-template-columns: 1fr;
   }
 
@@ -988,6 +1059,8 @@ a:hover {
 
   .donate-status-card,
   .donate-info-card,
+  .nightly-panel,
+  .nightly-facts,
   .supporters-panel {
     padding: 24px;
   }
```

**File**: `docs/js/site.js` (modified, +2/-0)
```diff
@@ -13,6 +13,7 @@
       company: "https://moroz.cc",
       telegram: "https://t.me/sdai_app",
       discord: "https://discord.gg/jzdR9m8Ves",
+      nightly: "nightly.html",
       googlePlay: "https://play.google.com/store/apps/details?id=com.shifthackz.aisdv1.app",
       fdroid: "https://f-droid.org/packages/com.shifthackz.aisdv1.app.foss",
       appStore: ""
@@ -119,6 +120,7 @@
             <a href="${site.links.googlePlay}" ${external}>Google Play</a>
             <a href="${site.links.fdroid}" ${external}>F-Droid</a>
             ${footerAppStoreLink()}
+            <a href="${site.links.nightly}">Nightly Build</a>
           </nav>
           <div class="footer-brand">
             <a class="footer-brand-row" href="${site.links.home}" aria-label="${site.name} home">
```

**File**: `docs/nightly.html` (added, +106/-0)
```diff
@@ -0,0 +1,106 @@
+<!doctype html>
+<html lang="en">
+<head>
+  <meta charset="utf-8">
+  <meta name="viewport" content="width=device-width, initial-scale=1">
+  <title>Nightly Build - SDAI</title>
+  <meta name="description" content="Try the latest SDAI Android nightly build, an early testing APK for following development before the next stable release.">
+  <meta name="robots" content="index,follow">
+  <meta name="theme-color" content="#514a91">
+  <link rel="canonical" href="https://sdai.moroz.cc/nightly.html">
+  <link rel="apple-touch-icon" href="https://sdai.moroz.cc/assets/sdai.png">
+  <link rel="manifest" href="site.webmanifest">
+  <meta property="og:title" content="Nightly Build - SDAI">
+  <meta property="og:description" content="Try the newest SDAI Android changes early and help test them before a stable release.">
+  <meta property="og:url" content="https://sdai.moroz.cc/nightly.html">
+  <meta property="og:site_name" content="SDAI">
+  <meta property="og:type" content="website">
+  <meta property="og:image" content="https://sdai.moroz.cc/assets/sdai.png">
+  <meta name="twitter:card" content="summary">
+  <meta name="twitter:title" content="Nightly Build - SDAI">
+  <meta name="twitter:description" content="Try the newest SDAI Android changes early and help test them before a stable release.">
+  <meta name="twitter:image" content="https://sdai.moroz.cc/assets/sdai.png">
+  <link rel="icon" href="assets/sdai.png">
+  <link rel="stylesheet" href="css/site.css">
+  <script src="js/site.js" defer></script>
+</head>
+<body data-page="nightly">
+  <div id="site-header"></div>
+
+  <main>
+    <section class="page-hero">
+      <div class="shell">
+        <p class="eyebrow">Early testing build</p>
+        <h1>Nightly Build</h1>
+        <p>
+          Nightly is a preview version for people who want to follow the development of SDAI, try new Android changes early, and help spot issues before the next regular release.
+        </p>
+      </div>
+    </section>
+
+    <section class="section">
+      <div class="shell nightly-grid">
+        <article class="nightly-panel">
+          <p class="section-label">Latest Android APK</p>
+          <h2>Try the newest work-in-progress build.</h2>
+          <p>
+            This download points to the latest published nightly APK. It can include fixes, UI updates, and new features before they reach Google Play or F-Droid, but it may also contain unfinished changes or fresh bugs.
+          </p>
+          <p>
+            Use the stable store releases for everyday use. Use the nightly build when you are curious about what is coming next or want to help test it early.
+          </p>
+          <div class="nightly-actions">
+            <a class="community-button github-button" href="https://github.com/ShiftHackZ/Stable-Diffusion-Android/releases/download/nightly/sdai-full-nightly.apk" target="_blank" rel="noopener noreferrer">
+              <svg viewBox="0 0 24 24" aria-hidden="true">
+                <path fill="currentColor" d="M12 3a1 1 0 0 1 1 1v8.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.42l2.3 2.3V4a1 1 0 0 1 1-1Zm-7 13a1 1 0 0 1 1 1v2h12v-2a1 1 0 1 1 2 0v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z"/>
+              </svg>
+              <span>Download APK</span>
+            </a>
+            <a class="nightly-secondary-link" href="https://github.com/ShiftHackZ/Stable-Diffusion-Android/releases/tag/nightly" target="_blank" rel="noopener noreferrer">Release details</a>
+          </div>
+        </article>
+
+        <aside class="nightly-facts" aria-label="Nightly build facts">
+          <dl>
+            <div>
+              <dt>Platform</dt>
+              <dd>Android</dd>
+            </div>
+            <div>
+              <dt>Flavor</dt>
+              <dd>Full</dd>
+            </div>
+            <div>
+              <dt>Source</dt>
+              <dd>Latest development work</dd>
+            </div>
+            <div>
+              <dt>Best for</dt>
+              <dd>Early testing</dd>
+            </div>
+          </dl>
+        </aside>
+      </div>
+    </section>
+
+    <section class="section surface-section">
+      <div class="shell cards-grid">
+        <article class="info-card">
+          <h3>Follow the development</h3>
+          <p>Install a nightly when you want to see the newest SDAI changes before they become a regular release.</p>
+        </article>
+        <article class="info-card">
+          <h3>Help with early testing</h3>
+          <p>Nightlies are useful for checking whether new fixes and features work well on real devices.</p>
+        </article>
+        <article class="info-card">
+          <h3>Different from stable</h3>
+          <p>Stable releases are the safer choice. Nightly builds move faster and can occasionally break or behave differently.</p>
+        </article>
+      </div>
+    </section>
+  </main>
+
+  <div id="site-footer"></div>
+</body>
+</html>
```

**File**: `docs/sitemap.xml` (modified, +6/-0)
```diff
@@ -12,6 +12,12 @@
     <changefreq>weekly</changefreq>
     <priority>0.7</priority>
   </url>
+  <url>
+    <loc>https://sdai.moroz.cc/nightly.html</loc>
+    <lastmod>2026-06-14</lastmod>
+    <changefreq>weekly</changefreq>
+    <priority>0.7</priority>
+  </url>
   <url>
     <loc>https://sdai.moroz.cc/privacy.html</loc>
     <lastmod>2026-06-09</lastmod>
```

---

### Incident Patch 5: `f783cf23` (2026-06-14)
**Commit Message**: Fix nightly APK signing key format (#654)

**File**: `.github/workflows/nightly_android.yml` (modified, +1/-6)
```diff
@@ -134,7 +134,6 @@ jobs:
         shell: bash
         env:
           ANDROID_NIGHTLY_CERT_PEM_BASE64: ${{ secrets.ANDROID_NIGHTLY_CERT_PEM_BASE64 }}
-          ANDROID_NIGHTLY_KEY_PASSWORD: ${{ secrets.ANDROID_NIGHTLY_KEY_PASSWORD }}
           ANDROID_NIGHTLY_KEY_PK8_BASE64: ${{ secrets.ANDROID_NIGHTLY_KEY_PK8_BASE64 }}
         run: |
           set -euo pipefail
@@ -168,11 +167,7 @@ jobs:
 
           "${zipalign}" -p -f 4 "${unsigned_apk}" "${aligned_apk}"
 
-          sign_args=(sign --key "${key_file}" --cert "${cert_file}" --out "${signed_apk}")
-          if [[ -n "${ANDROID_NIGHTLY_KEY_PASSWORD:-}" ]]; then
-            sign_args+=(--key-pass "pass:${ANDROID_NIGHTLY_KEY_PASSWORD}")
-          fi
-          "${apksigner}" "${sign_args[@]}" "${aligned_apk}"
+          "${apksigner}" sign --key "${key_file}" --cert "${cert_file}" --out "${signed_apk}" "${aligned_apk}"
           "${apksigner}" verify --print-certs "${signed_apk}" > "${output_dir}/apksigner.txt"
 
           sha256sum "${signed_apk}" > "${output_dir}/${APK_NAME}.sha256"
```

**File**: `NIGHTLY_BUILDS.md` (modified, +1/-2)
```diff
@@ -38,9 +38,8 @@ Nightly signing does not use JKS or Gradle `signing.properties`.
 
 The workflow signs the unsigned APK with Android SDK `apksigner` using:
 
-- `ANDROID_NIGHTLY_KEY_PK8_BASE64`: Base64-encoded PKCS#8 private key file.
+- `ANDROID_NIGHTLY_KEY_PK8_BASE64`: Base64-encoded plain PKCS#8 private key file.
 - `ANDROID_NIGHTLY_CERT_PEM_BASE64`: Base64-encoded X.509 certificate file.
-- `ANDROID_NIGHTLY_KEY_PASSWORD`: optional password for an encrypted private key.
 
 These values should be stored as repository or environment secrets. Do not commit them to the repository.
 
```

---

### Incident Patch 6: `336c0299` (2026-06-14)
**Commit Message**: Fix nightly checkout submodules (#653)

**File**: `.github/workflows/nightly_android.yml` (modified, +1/-0)
```diff
@@ -48,6 +48,7 @@ jobs:
         with:
           ref: ${{ github.event_name == 'workflow_dispatch' && inputs.target_ref || 'develop' }}
           fetch-depth: 0
+          submodules: recursive
 
       - name: Check whether a nightly is needed
         id: plan
```

---

### Incident Patch 7: `bce48b95` (2026-06-14)
**Commit Message**: Add Android nightly build workflow (#652)

**File**: `.github/workflows/nightly_android.yml` (added, +257/-0)
```diff
@@ -0,0 +1,257 @@
+name: Android Full Nightly
+
+on:
+  workflow_dispatch:
+    inputs:
+      target_ref:
+        description: Branch, tag, or SHA to build.
+        required: true
+        default: develop
+      force:
+        description: Build even when no functional files changed since the previous nightly.
+        required: true
+        type: boolean
+        default: false
+      publish:
+        description: Publish or update the public nightly GitHub prerelease.
+        required: true
+        type: boolean
+        default: true
+  schedule:
+    - cron: "37 2 * * *"
+
+permissions:
+  contents: write
+
+concurrency:
+  group: android-full-nightly
+  cancel-in-progress: false
+
+env:
+  APK_NAME: sdai-full-nightly.apk
+  NIGHTLY_TAG: nightly
+  NIGHTLY_RELEASE_NAME: Android Full Nightly
+
+jobs:
+  nightly:
+    name: Build Android full nightly
+    runs-on: ubuntu-24.04
+    timeout-minutes: 90
+    env:
+      TARGET_REF: ${{ github.event_name == 'workflow_dispatch' && inputs.target_ref || 'develop' }}
+      FORCE_NIGHTLY: ${{ github.event_name == 'workflow_dispatch' && inputs.force || false }}
+      PUBLISH_NIGHTLY: ${{ github.event_name != 'workflow_dispatch' || inputs.publish }}
+
+    steps:
+      - name: Checkout target ref
+        uses: actions/checkout@v4
+        with:
+          ref: ${{ github.event_name == 'workflow_dispatch' && inputs.target_ref || 'develop' }}
+          fetch-depth: 0
+
+      - name: Check whether a nightly is needed
+        id: plan
+        shell: bash
+        run: |
+          set -euo pipefail
+
+          git fetch --force origin "refs/tags/${NIGHTLY_TAG}:refs/tags/${NIGHTLY_TAG}" || true
+
+          target_sha="$(git rev-parse HEAD)"
+          echo "target_sha=${target_sha}" >> "${GITHUB_OUTPUT}"
+
+          if ! git rev-parse --verify "${NIGHTLY_TAG}^{commit}" >/dev/null 2>&1; then
+            echo "should_build=true" >> "${GITHUB_OUTPUT}"
+            echo "reason=No previous nightly tag exists." >> "${GITHUB_OUTPUT}"
+            {
+              echo "### Android full nightly"
+              echo
+              echo "No previous nightly tag exists. Building ${target_sha}."
+            } >> "${GITHUB_STEP_SUMMARY}"
+            exit 0
+          fi
+
+          if [[ "${FORCE_NIGHTLY}" == "true" ]]; then
+            echo "should_build=true" >> "${GITHUB_OUTPUT}"
+            echo "reason=Manual force build was requested." >> "${GITHUB_OUTPUT}"
+            {
+              echo "### Android full nightly"
+              echo
+              echo "Manual force build requested for ${target_sha}."
+            } >> "${GITHUB_STEP_SUMMARY}"
+            exit 0
+          fi
+
+          git diff --name-only "${NIGHTLY_TAG}..HEAD" > "${RUNNER_TEMP}/nightly-changed-files.txt"
+
+          functional_pattern='^(app/|core/|data/|demo/|domain/|feature/|network/|presentation/|storage/|build-logic/|gradle/|build\.gradle\.kts$|settings\.gradle\.kts$|gradle\.properties$|gradlew$|gradlew\.bat$)'
+          if grep -Eq "${functional_pattern}" "${RUNNER_TEMP}/nightly-changed-files.txt"; then
+            echo "should_build=true" >> "${GITHUB_OUTPUT}"
+            echo "reason=Functional files changed since the previous nightly." >> "${GITHUB_OUTPUT}"
+          else
+            echo "should_build=false" >> "${GITHUB_OUTPUT}"
+            echo "reason=Only documentation, website, or repository metadata changed since the previous nightly." >> "${GITHUB_OUTPUT}"
+          fi
+
+          {
+            echo "### Android full nightly"
+            echo
+            echo "Target ref: \`${TARGET_REF}\`"
+            echo "Target commit: \`${target_sha}\`"
+            echo "Decision: \`$(grep '^should_build=' "${GITHUB_OUTPUT}" | tail -n 1 | cut -d= -f2)\`"
+            echo
+            echo "Changed files since \`${NIGHTLY_TAG}\`:"
+            echo
+            sed 's/^/- `/' "${RUNNER_TEMP}/nightly-changed-files.txt" | sed 's/$/`/' || true
+          } >> "${GITHUB_STEP_SUMMARY}"
+
+      - name: Set up JDK 17
+        if: steps.plan.outputs.should_build == 'true'
+        uses: actions/setup-java@v4
+        with:
+          distribution: temurin
+          java-version: "17"
+
+      - name: Set up Gradle
+        if: steps.plan.outputs.should_build == 'true'
+        uses: gradle/actions/setup-gradle@v4
+
+      - name: Build unsigned full release APK
+        if: steps.plan.outputs.should_build == 'true'
+        shell: bash
+        run: |
+          set -euo pipefail
+
+          ./gradlew :app:assembleFullRelease \
+            --no-daemon \
+            -Dkotlin.native.ignoreDisabledTargets=true \
+            -Pkotlin.native.ignoreDisabledTargets=true
+
+      - name: Sign APK with apksigner key and certificate
+        if: steps.plan.outputs.should_build == 'true'
+        id: sign
+        shell: bash
+        env:
+          ANDROID_NIGHTLY_CERT_PEM_BASE64: ${{ secrets.ANDROID_NIGHTLY_CERT_PEM_BASE64 }}
+          ANDROID_NIGHTLY_KEY_PASSWORD
```

**File**: `NIGHTLY_BUILDS.md` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+# Nightly Android Builds
+
+SDAI publishes an Android `full` flavor nightly APK from `develop` through GitHub Actions.
+
+The public APK URL is stable:
+
+```text
+https://github.com/ShiftHackZ/Stable-Diffusion-Android/releases/download/nightly/sdai-full-nightly.apk
+```
+
+The release page is:
+
+```text
+https://github.com/ShiftHackZ/Stable-Diffusion-Android/releases/tag/nightly
+```
+
+## What Gets Built
+
+- Android only.
+- `full` flavor only.
+- Gradle produces an unsigned release APK; CI signs that APK with Android SDK `apksigner`.
+- The scheduled workflow runs daily and skips the build when only docs, website files, or repository metadata changed since the previous nightly.
+- Manual `force` builds can publish a new artifact even when the functional-file check would skip.
+
+The workflow does not commit generated files or changing build metadata back to the repository.
+
+## Publication Model
+
+Nightlies are published to one GitHub prerelease named `Android Full Nightly`, backed by the moving tag `nightly`.
+
+The workflow force-moves the `nightly` tag to the built commit, removes obsolete uploaded assets from the nightly release, and uploads the current assets with fixed filenames using overwrite mode. The Releases page should therefore show one nightly release, and that release should contain only the latest APK and checksum assets.
+
+The workflow does not upload separate GitHub Actions artifacts, so APK downloads are kept in the single current nightly release.
+
+## Signing Model
+
+Nightly signing does not use JKS or Gradle `signing.properties`.
+
+The workflow signs the unsigned APK with Android SDK `apksigner` using:
+
+- `ANDROID_NIGHTLY_KEY_PK8_BASE64`: Base64-encoded PKCS#8 private key file.
+- `ANDROID_NIGHTLY_CERT_PEM_BASE64`: Base64-encoded X.509 certificate file.
+- `ANDROID_NIGHTLY_KEY_PASSWORD`: optional password for an encrypted private key.
+
+These values should be stored as repository or environment secrets. Do not commit them to the repository.
+
+If the nightly key is different from the normal `full` release signing certificate, Android will not install a nightly APK as an update over an existing `com.shifthackz.aisdv1.app.full` build. Testers must uninstall the old build first, or the nightly signing certificate must match the installed build.
+
+## Manual Run
+
+GitHub only exposes `workflow_dispatch` for workflow files that exist on the repository default branch. Keep `.github/workflows/nightly_android.yml` on `master`; the workflow still builds `develop` through the `target_ref` input.
+
+Run from the GitHub UI:
+
+1. Open `Actions`.
+2. Select `Android Full Nightly`.
+3. Click `Run workflow`.
+4. Keep `target_ref` as `develop`.
+5. Set `force` to `true` when you want a build even if no functional files changed.
+6. Keep `publish` as `true` to overwrite the public nightly prerelease assets.
+
+Run from GitHub CLI:
+
+```bash
+gh workflow run nightly_android.yml --ref master -f target_ref=develop -f force=true -f publish=true
+```
+
+After the job finishes, send the stable APK URL above to testers.
+
+## Daily Cron
+
+The workflow runs once per day:
+
+```yaml
+schedule:
+  - cron: "37 2 * * *"
+```
+
+Scheduled workflows run from the default branch, while the checkout step uses `develop` as the default build target.
+
+## F-Droid Safety
+
+Nightlies use the non-version, moving `nightly` tag and the GitHub release is marked as a prerelease. It is not a stable release tag, and scheduled builds point the moving tag at the selected build target, normally `develop`.
+
+F-Droid release automation should continue to use its normal versioned tags from `master`; do not configure F-Droid metadata to match the `nightly` tag.
```

**File**: `README.md` (modified, +11/-1)
```diff
@@ -3,7 +3,7 @@
 ![Google Play](https://img.shields.io/endpoint?color=blue&logo=google-play&logoColor=white&url=https%3A%2F%2Fplay.cuzi.workers.dev%2Fplay%3Fi%3Dcom.shifthackz.aisdv1.app%26l%3DGoogle%2520Play%26m%3D%24version)
 ![F-Droid](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Ff-droid.org%2Fapi%2Fv1%2Fpackages%2Fcom.shifthackz.aisdv1.app.foss&query=%24.packages%5B0%5D.versionName&label=F-Droid&link=https%3A%2F%2Ff-droid.org%2Fpackages%2Fcom.shifthackz.aisdv1.app.foss%2F)
 
-[Website](https://sdai.moroz.cc) | [Telegram](https://t.me/sdai_app) | [Discord](https://discord.gg/jzdR9m8Ves)
+[Website](https://sdai.moroz.cc) | [Nightly Android Full](https://github.com/ShiftHackZ/Stable-Diffusion-Android/releases/download/nightly/sdai-full-nightly.apk) | [Telegram](https://t.me/sdai_app) | [Discord](https://discord.gg/jzdR9m8Ves)
 
 <p>
   <a href="https://play.google.com/store/apps/details?id=com.shifthackz.aisdv1.app"><img src="docs/assets/badge-google-play.svg" alt="Get it on Google Play" height="54"></a>
@@ -16,6 +16,16 @@ SDAI is an open-source, cross-platform AI image generation client for Android an
 
 No ads. No telemetry. No lock-in to a single provider.
 
+## Project Documentation
+
+Root-level Markdown documents:
+
+- [Documentation](DOCUMENTATION.md)
+- [Screenshot generation](SCREENSHOT_GENERATION.md)
+- [Nightly Android builds](NIGHTLY_BUILDS.md)
+- [Git workflow](GIT_WORKFLOW.md)
+- [Code of conduct](CODE_OF_CONDUCT.md)
+
 ## Why SDAI
 
 - Choose the backend that fits the moment: your own AUTOMATIC1111 or SwarmUI server, AI Horde, Hugging Face, OpenAI, Stability AI, or local diffusion where the platform supports it.
```

**File**: `docs/css/site.css` (modified, +74/-1)
```diff
@@ -676,6 +676,76 @@ a:hover {
   gap: 24px;
 }
 
+.nightly-grid {
+  display: grid;
+  grid-template-columns: minmax(0, 1fr) minmax(260px, 0.42fr);
+  gap: 24px;
+  align-items: start;
+}
+
+.nightly-panel,
+.nightly-facts {
+  padding: 34px;
+  border: 1px solid var(--line);
+  border-radius: 8px;
+  background: var(--surface);
+  box-shadow: var(--shadow);
+}
+
+.nightly-panel h2 {
+  max-width: 720px;
+  margin: 0;
+}
+
+.nightly-panel p {
+  max-width: 720px;
+  margin: 18px 0 0;
+  color: var(--muted);
+}
+
+.nightly-actions {
+  display: flex;
+  flex-wrap: wrap;
+  gap: 16px;
+  align-items: center;
+  margin-top: 26px;
+}
+
+.nightly-secondary-link {
+  font-weight: 800;
+}
+
+.nightly-facts dl {
+  display: grid;
+  gap: 14px;
+  margin: 0;
+}
+
+.nightly-facts div {
+  display: grid;
+  gap: 2px;
+  padding-bottom: 14px;
+  border-bottom: 1px solid var(--line);
+}
+
+.nightly-facts div:last-child {
+  padding-bottom: 0;
+  border-bottom: 0;
+}
+
+.nightly-facts dt {
+  color: var(--muted);
+  font-size: 0.78rem;
+  font-weight: 800;
+  text-transform: uppercase;
+}
+
+.nightly-facts dd {
+  margin: 0;
+  color: var(--ink);
+  font-weight: 800;
+}
+
 .supporters-heading {
   display: grid;
   grid-template-columns: minmax(0, 1fr) auto;
@@ -900,7 +970,8 @@ a:hover {
 
   .split,
   .community-grid,
-  .cta-grid {
+  .cta-grid,
+  .nightly-grid {
     grid-template-columns: 1fr;
   }
 
@@ -988,6 +1059,8 @@ a:hover {
 
   .donate-status-card,
   .donate-info-card,
+  .nightly-panel,
+  .nightly-facts,
   .supporters-panel {
     padding: 24px;
   }
```

**File**: `docs/js/site.js` (modified, +2/-0)
```diff
@@ -13,6 +13,7 @@
       company: "https://moroz.cc",
       telegram: "https://t.me/sdai_app",
       discord: "https://discord.gg/jzdR9m8Ves",
+      nightly: "nightly.html",
       googlePlay: "https://play.google.com/store/apps/details?id=com.shifthackz.aisdv1.app",
       fdroid: "https://f-droid.org/packages/com.shifthackz.aisdv1.app.foss",
       appStore: ""
@@ -119,6 +120,7 @@
             <a href="${site.links.googlePlay}" ${external}>Google Play</a>
             <a href="${site.links.fdroid}" ${external}>F-Droid</a>
             ${footerAppStoreLink()}
+            <a href="${site.links.nightly}">Nightly Build</a>
           </nav>
           <div class="footer-brand">
             <a class="footer-brand-row" href="${site.links.home}" aria-label="${site.name} home">
```

**File**: `docs/nightly.html` (added, +106/-0)
```diff
@@ -0,0 +1,106 @@
+<!doctype html>
+<html lang="en">
+<head>
+  <meta charset="utf-8">
+  <meta name="viewport" content="width=device-width, initial-scale=1">
+  <title>Nightly Build - SDAI</title>
+  <meta name="description" content="Try the latest SDAI Android nightly build, an early testing APK for following development before the next stable release.">
+  <meta name="robots" content="index,follow">
+  <meta name="theme-color" content="#514a91">
+  <link rel="canonical" href="https://sdai.moroz.cc/nightly.html">
+  <link rel="apple-touch-icon" href="https://sdai.moroz.cc/assets/sdai.png">
+  <link rel="manifest" href="site.webmanifest">
+  <meta property="og:title" content="Nightly Build - SDAI">
+  <meta property="og:description" content="Try the newest SDAI Android changes early and help test them before a stable release.">
+  <meta property="og:url" content="https://sdai.moroz.cc/nightly.html">
+  <meta property="og:site_name" content="SDAI">
+  <meta property="og:type" content="website">
+  <meta property="og:image" content="https://sdai.moroz.cc/assets/sdai.png">
+  <meta name="twitter:card" content="summary">
+  <meta name="twitter:title" content="Nightly Build - SDAI">
+  <meta name="twitter:description" content="Try the newest SDAI Android changes early and help test them before a stable release.">
+  <meta name="twitter:image" content="https://sdai.moroz.cc/assets/sdai.png">
+  <link rel="icon" href="assets/sdai.png">
+  <link rel="stylesheet" href="css/site.css">
+  <script src="js/site.js" defer></script>
+</head>
+<body data-page="nightly">
+  <div id="site-header"></div>
+
+  <main>
+    <section class="page-hero">
+      <div class="shell">
+        <p class="eyebrow">Early testing build</p>
+        <h1>Nightly Build</h1>
+        <p>
+          Nightly is a preview version for people who want to follow the development of SDAI, try new Android changes early, and help spot issues before the next regular release.
+        </p>
+      </div>
+    </section>
+
+    <section class="section">
+      <div class="shell nightly-grid">
+        <article class="nightly-panel">
+          <p class="section-label">Latest Android APK</p>
+          <h2>Try the newest work-in-progress build.</h2>
+          <p>
+            This download points to the latest published nightly APK. It can include fixes, UI updates, and new features before they reach Google Play or F-Droid, but it may also contain unfinished changes or fresh bugs.
+          </p>
+          <p>
+            Use the stable store releases for everyday use. Use the nightly build when you are curious about what is coming next or want to help test it early.
+          </p>
+          <div class="nightly-actions">
+            <a class="community-button github-button" href="https://github.com/ShiftHackZ/Stable-Diffusion-Android/releases/download/nightly/sdai-full-nightly.apk" target="_blank" rel="noopener noreferrer">
+              <svg viewBox="0 0 24 24" aria-hidden="true">
+                <path fill="currentColor" d="M12 3a1 1 0 0 1 1 1v8.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.42l2.3 2.3V4a1 1 0 0 1 1-1Zm-7 13a1 1 0 0 1 1 1v2h12v-2a1 1 0 1 1 2 0v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z"/>
+              </svg>
+              <span>Download APK</span>
+            </a>
+            <a class="nightly-secondary-link" href="https://github.com/ShiftHackZ/Stable-Diffusion-Android/releases/tag/nightly" target="_blank" rel="noopener noreferrer">Release details</a>
+          </div>
+        </article>
+
+        <aside class="nightly-facts" aria-label="Nightly build facts">
+          <dl>
+            <div>
+              <dt>Platform</dt>
+              <dd>Android</dd>
+            </div>
+            <div>
+              <dt>Flavor</dt>
+              <dd>Full</dd>
+            </div>
+            <div>
+              <dt>Source</dt>
+              <dd>Latest development work</dd>
+            </div>
+            <div>
+              <dt>Best for</dt>
+              <dd>Early testing</dd>
+            </div>
+          </dl>
+        </aside>
+      </div>
+    </section>
+
+    <section class="section surface-section">
+      <div class="shell cards-grid">
+        <article class="info-card">
+          <h3>Follow the development</h3>
+          <p>Install a nightly when you want to see the newest SDAI changes before they become a regular release.</p>
+        </article>
+        <article class="info-card">
+          <h3>Help with early testing</h3>
+          <p>Nightlies are useful for checking whether new fixes and features work well on real devices.</p>
+        </article>
+        <article class="info-card">
+          <h3>Different from stable</h3>
+          <p>Stable releases are the safer choice. Nightly builds move faster and can occasionally break or behave differently.</p>
+        </article>
+      </div>
+    </section>
+  </main>
+
+  <div id="site-footer"></div>
+</body>
+</html>
```

**File**: `docs/sitemap.xml` (modified, +6/-0)
```diff
@@ -12,6 +12,12 @@
     <changefreq>weekly</changefreq>
     <priority>0.7</priority>
   </url>
+  <url>
+    <loc>https://sdai.moroz.cc/nightly.html</loc>
+    <lastmod>2026-06-14</lastmod>
+    <changefreq>weekly</changefreq>
+    <priority>0.7</priority>
+  </url>
   <url>
     <loc>https://sdai.moroz.cc/privacy.html</loc>
     <lastmod>2026-06-09</lastmod>
```

---

### Incident Patch 8: `9f6fccc5` (2026-06-13)
**Commit Message**: Improve provider selection UX (#651)

**File**: `core/localization/src/androidMain/res/values-ru/strings.xml` (modified, +29/-0)
```diff
@@ -112,6 +112,35 @@
     <string name="hint_multiple_models">Поддержка моделей</string>
     <string name="hint_offline_generation">Генерация без интернета</string>
     <string name="hint_own_server">Собственный сервер</string>
+    <string name="provider_search_hint">Поиск провайдеров</string>
+    <string name="provider_filter_type_all">Все</string>
+    <string name="provider_filter_type_self_hosted">Self-hosted</string>
+    <string name="provider_filter_type_cloud">Облако</string>
+    <string name="provider_filter_type_local">Локальные</string>
+    <string name="provider_filter_readiness">Готовность</string>
+    <string name="provider_filter_tags">Теги</string>
+    <string name="provider_no_results">Нет провайдеров под эти фильтры.</string>
+    <string name="provider_options_title">Параметры провайдеров</string>
+    <string name="provider_action_filters">Фильтры</string>
+    <string name="provider_action_sort">Сортировка</string>
+    <string name="provider_sort_title">Сортировка</string>
+    <string name="provider_sort_default">По умолчанию</string>
+    <string name="provider_sort_recent">Недавно обновленные</string>
+    <string name="provider_sort_oldest">Давно обновленные</string>
+    <string name="provider_readiness_experimental">Эксперимент</string>
+    <string name="provider_readiness_alpha">Альфа</string>
+    <string name="provider_readiness_beta">Бета</string>
+    <string name="provider_readiness_stable">Стабильно</string>
+    <string name="provider_version">%1$s</string>
+    <string name="provider_tag_text_to_image">Текст в изображение</string>
+    <string name="provider_tag_image_to_image">Изображение в изображение</string>
+    <string name="provider_tag_own_server">Свой сервер</string>
+    <string name="provider_tag_lora">LoRA</string>
+    <string name="provider_tag_textual_inversion">Инверсия текста</string>
+    <string name="provider_tag_hypernetworks">Hypernetworks</string>
+    <string name="provider_tag_batch">Пакетная генерация</string>
+    <string name="provider_tag_multiple_models">Несколько моделей</string>
+    <string name="provider_tag_offline">Оффлайн</string>
     <string name="hint_cfg_scale">CFG Шкала: %1$s</string>
     <string name="hint_sampler">Метод выборки</string>
     <string name="hint_scheduler">Планировщик</string>
```

**File**: `core/localization/src/androidMain/res/values-tr/strings.xml` (modified, +29/-0)
```diff
@@ -112,6 +112,35 @@
     <string name="hint_multiple_models">Çoklu Modeller</string>
     <string name="hint_offline_generation">Çevrimdışı nesil</string>
     <string name="hint_own_server">Kendi Sunucumuz</string>
+    <string name="provider_search_hint">Sağlayıcı ara</string>
+    <string name="provider_filter_type_all">Tümü</string>
+    <string name="provider_filter_type_self_hosted">Kendi barındırdığınız</string>
+    <string name="provider_filter_type_cloud">Bulut</string>
+    <string name="provider_filter_type_local">Yerel</string>
+    <string name="provider_filter_readiness">Hazır olma durumu</string>
+    <string name="provider_filter_tags">Etiketler</string>
+    <string name="provider_no_results">Bu filtrelerle eşleşen sağlayıcı yok.</string>
+    <string name="provider_options_title">Sağlayıcı seçenekleri</string>
+    <string name="provider_action_filters">Filtreler</string>
+    <string name="provider_action_sort">Sırala</string>
+    <string name="provider_sort_title">Sıralama</string>
+    <string name="provider_sort_default">Varsayılan</string>
+    <string name="provider_sort_recent">Son güncellenenler</string>
+    <string name="provider_sort_oldest">En eski güncellenenler</string>
+    <string name="provider_readiness_experimental">Deneysel</string>
+    <string name="provider_readiness_alpha">Alfa</string>
+    <string name="provider_readiness_beta">Beta</string>
+    <string name="provider_readiness_stable">Kararlı</string>
+    <string name="provider_version">%1$s</string>
+    <string name="provider_tag_text_to_image">Metinden görüntü</string>
+    <string name="provider_tag_image_to_image">Görüntüden görüntü</string>
+    <string name="provider_tag_own_server">Kendi sunucunuz</string>
+    <string name="provider_tag_lora">LoRA</string>
+    <string name="provider_tag_textual_inversion">Metinsel ters çevirme</string>
+    <string name="provider_tag_hypernetworks">Hypernetworks</string>
+    <string name="provider_tag_batch">Toplu üretim</string>
+    <string name="provider_tag_multiple_models">Birden fazla model</string>
+    <string name="provider_tag_offline">Çevrimdışı</string>
     <string name="hint_cfg_scale">CFG Scale: %1$s</string>
     <string name="hint_sampler">Örneklerme Yöntemi</string>
     <string name="hint_scheduler">Zamanlayıcı</string>
```

**File**: `core/localization/src/androidMain/res/values-uk/strings.xml` (modified, +29/-0)
```diff
@@ -112,6 +112,35 @@
     <string name="hint_multiple_models">Підтримка моделей</string>
     <string name="hint_offline_generation">Генерація без інтернету</string>
     <string name="hint_own_server">Власний сервер</string>
+    <string name="provider_search_hint">Пошук провайдерів</string>
+    <string name="provider_filter_type_all">Усі</string>
+    <string name="provider_filter_type_self_hosted">Self-hosted</string>
+    <string name="provider_filter_type_cloud">Хмара</string>
+    <string name="provider_filter_type_local">Локальні</string>
+    <string name="provider_filter_readiness">Готовність</string>
+    <string name="provider_filter_tags">Теги</string>
+    <string name="provider_no_results">Немає провайдерів для цих фільтрів.</string>
+    <string name="provider_options_title">Параметри провайдерів</string>
+    <string name="provider_action_filters">Фільтри</string>
+    <string name="provider_action_sort">Сортування</string>
+    <string name="provider_sort_title">Сортування</string>
+    <string name="provider_sort_default">За замовчуванням</string>
+    <string name="provider_sort_recent">Нещодавно оновлені</string>
+    <string name="provider_sort_oldest">Давно оновлені</string>
+    <string name="provider_readiness_experimental">Експеримент</string>
+    <string name="provider_readiness_alpha">Альфа</string>
+    <string name="provider_readiness_beta">Бета</string>
+    <string name="provider_readiness_stable">Стабільно</string>
+    <string name="provider_version">%1$s</string>
+    <string name="provider_tag_text_to_image">Текст у зображення</string>
+    <string name="provider_tag_image_to_image">Зображення у зображення</string>
+    <string name="provider_tag_own_server">Свій сервер</string>
+    <string name="provider_tag_lora">LoRA</string>
+    <string name="provider_tag_textual_inversion">Інверсія тексту</string>
+    <string name="provider_tag_hypernetworks">Hypernetworks</string>
+    <string name="provider_tag_batch">Пакетна генерація</string>
+    <string name="provider_tag_multiple_models">Кілька моделей</string>
+    <string name="provider_tag_offline">Офлайн</string>
     <string name="hint_cfg_scale">CFG Шкала: %1$s</string>
     <string name="hint_sampler">Метод вибірки</string>
     <string name="hint_scheduler">Планувальник</string>
```

**File**: `core/localization/src/androidMain/res/values-zh/strings.xml` (modified, +29/-0)
```diff
@@ -128,6 +128,35 @@
     <string name="hint_multiple_models">多个模型</string>
     <string name="hint_offline_generation">离线生成</string>
     <string name="hint_own_server">个人服务器</string>
+    <string name="provider_search_hint">搜索提供商</string>
+    <string name="provider_filter_type_all">全部</string>
+    <string name="provider_filter_type_self_hosted">自托管</string>
+    <string name="provider_filter_type_cloud">云端</string>
+    <string name="provider_filter_type_local">本地</string>
+    <string name="provider_filter_readiness">就绪状态</string>
+    <string name="provider_filter_tags">标签</string>
+    <string name="provider_no_results">没有符合这些筛选条件的提供商。</string>
+    <string name="provider_options_title">提供商选项</string>
+    <string name="provider_action_filters">筛选</string>
+    <string name="provider_action_sort">排序</string>
+    <string name="provider_sort_title">排序</string>
+    <string name="provider_sort_default">默认</string>
+    <string name="provider_sort_recent">最近更新</string>
+    <string name="provider_sort_oldest">最久未更新</string>
+    <string name="provider_readiness_experimental">实验性</string>
+    <string name="provider_readiness_alpha">Alpha</string>
+    <string name="provider_readiness_beta">Beta</string>
+    <string name="provider_readiness_stable">稳定</string>
+    <string name="provider_version">%1$s</string>
+    <string name="provider_tag_text_to_image">文本转图像</string>
+    <string name="provider_tag_image_to_image">图像转图像</string>
+    <string name="provider_tag_own_server">自托管服务器</string>
+    <string name="provider_tag_lora">LoRA</string>
+    <string name="provider_tag_textual_inversion">文本反转</string>
+    <string name="provider_tag_hypernetworks">Hypernetworks</string>
+    <string name="provider_tag_batch">批量生成</string>
+    <string name="provider_tag_multiple_models">多个模型</string>
+    <string name="provider_tag_offline">离线</string>
     <string name="hint_cfg_scale">CFG 缩放: %1$s</string>
     <string name="hint_sampler">采样方法</string>
     <string name="hint_scheduler">调度器</string>
```

**File**: `core/localization/src/androidMain/res/values/strings.xml` (modified, +29/-0)
```diff
@@ -133,6 +133,35 @@
     <string name="hint_multiple_models">Multiple Models</string>
     <string name="hint_offline_generation">Offline generation</string>
     <string name="hint_own_server">Own Server</string>
+    <string name="provider_search_hint">Search providers</string>
+    <string name="provider_filter_type_all">All</string>
+    <string name="provider_filter_type_self_hosted">Self-hosted</string>
+    <string name="provider_filter_type_cloud">Cloud</string>
+    <string name="provider_filter_type_local">Local</string>
+    <string name="provider_filter_readiness">Readiness</string>
+    <string name="provider_filter_tags">Tags</string>
+    <string name="provider_no_results">No providers match these filters.</string>
+    <string name="provider_options_title">Provider options</string>
+    <string name="provider_action_filters">Filters</string>
+    <string name="provider_action_sort">Sort</string>
+    <string name="provider_sort_title">Sort</string>
+    <string name="provider_sort_default">Default</string>
+    <string name="provider_sort_recent">Recently updated</string>
+    <string name="provider_sort_oldest">Least recently updated</string>
+    <string name="provider_readiness_experimental">Experimental</string>
+    <string name="provider_readiness_alpha">Alpha</string>
+    <string name="provider_readiness_beta">Beta</string>
+    <string name="provider_readiness_stable">Stable</string>
+    <string name="provider_version">%1$s</string>
+    <string name="provider_tag_text_to_image">Text to image</string>
+    <string name="provider_tag_image_to_image">Image to image</string>
+    <string name="provider_tag_own_server">Own server</string>
+    <string name="provider_tag_lora">LoRA</string>
+    <string name="provider_tag_textual_inversion">Textual inversion</string>
+    <string name="provider_tag_hypernetworks">Hypernetworks</string>
+    <string name="provider_tag_batch">Batch</string>
+    <string name="provider_tag_multiple_models">Multiple models</string>
+    <string name="provider_tag_offline">Offline</string>
     <string name="hint_cfg_scale">CFG Scale: %1$s</string>
     <string name="hint_sampler">Sampling method</string>
     <string name="hint_scheduler">Scheduler</string>
```

**File**: `domain/src/commonMain/kotlin/com/shifthackz/aisdv1/domain/entity/ServerSource.kt` (modified, +64/-17)
```diff
@@ -3,32 +3,28 @@ package com.shifthackz.aisdv1.domain.entity
 import com.shifthackz.aisdv1.core.common.appbuild.BuildType
 
 /**
- * Coordinates `ServerSource` behavior in the SDAI domain layer.
+ * Provider catalog entry used by setup, onboarding, and settings screens.
  *
- * @author Dmitriy Moroz
+ * @property key persisted configuration id; changing it migrates user-selected provider values.
+ * @property type broad hosting model used by provider filters.
+ * @property readiness user-facing stability marker for the integration.
+ * @property version last meaningful implementation update in `yyyy.M.d` format, optionally suffixed with a tag.
+ * @property featureTags searchable capability labels shown in provider selection UI.
+ * @property allowedInBuilds app flavors where the provider can be selected.
  */
 enum class ServerSource(
-    /**
-     * Exposes the `key` value used by the SDAI domain layer.
-     *
-     * @author Dmitriy Moroz
-     */
     val key: String,
-    /**
-     * Exposes the `featureTags` value used by the SDAI domain layer.
-     *
-     * @author Dmitriy Moroz
-     */
+    val type: ServerSourceType,
+    val readiness: ServerSourceReadiness,
+    val version: String,
     val featureTags: Set<FeatureTag>,
-    /**
-     * Exposes the `allowedInBuilds` value used by the SDAI domain layer.
-     *
-     * @author Dmitriy Moroz
-     */
     val allowedInBuilds: Set<BuildType> = setOf(BuildType.FOSS, BuildType.PLAY, BuildType.FULL),
 ) {
     AUTOMATIC1111(
         key = "custom",
+        type = ServerSourceType.SELF_HOSTED,
+        readiness = ServerSourceReadiness.STABLE,
+        version = "2026.6.10",
         featureTags = setOf(
             FeatureTag.Txt2Img,
             FeatureTag.Img2Img,
@@ -42,6 +38,9 @@ enum class ServerSource(
     ),
     SWARM_UI(
         key = "swarm_ui",
+        type = ServerSourceType.SELF_HOSTED,
+        readiness = ServerSourceReadiness.STABLE,
+        version = "2026.6.10",
         featureTags = setOf(
             FeatureTag.Txt2Img,
             FeatureTag.OwnServer,
@@ -54,6 +53,9 @@ enum class ServerSource(
     ),
     LOCAL_MICROSOFT_ONNX(
         key = "local",
+        type = ServerSourceType.LOCAL,
+        readiness = ServerSourceReadiness.BETA,
+        version = "2024.9.23",
         featureTags = setOf(
             FeatureTag.Offline,
             FeatureTag.Txt2Img,
@@ -62,6 +64,9 @@ enum class ServerSource(
     ),
     LOCAL_GOOGLE_MEDIA_PIPE(
         key = "local_google_media_pipe",
+        type = ServerSourceType.LOCAL,
+        readiness = ServerSourceReadiness.BETA,
+        version = "2026.6.10",
         featureTags = setOf(
             FeatureTag.Offline,
             FeatureTag.Txt2Img,
@@ -71,6 +76,9 @@ enum class ServerSource(
     ),
     LOCAL_STABLE_DIFFUSION_CPP(
         key = "local_stable_diffusion_cpp",
+        type = ServerSourceType.LOCAL,
+        readiness = ServerSourceReadiness.ALPHA,
+        version = "2026.6.13",
         featureTags = setOf(
             FeatureTag.Offline,
             FeatureTag.Txt2Img,
@@ -79,6 +87,9 @@ enum class ServerSource(
     ),
     LOCAL_APPLE_CORE_ML(
         key = "local_apple_core_ml",
+        type = ServerSourceType.LOCAL,
+        readiness = ServerSourceReadiness.ALPHA,
+        version = "2026.6.12",
         featureTags = setOf(
             FeatureTag.Offline,
             FeatureTag.Txt2Img,
@@ -89,6 +100,9 @@ enum class ServerSource(
     ),
     HORDE(
         key = "horde",
+        type = ServerSourceType.CLOUD,
+        readiness = ServerSourceReadiness.STABLE,
+        version = "2026.6.10",
         featureTags = setOf(
             FeatureTag.Txt2Img,
             FeatureTag.Img2Img,
@@ -97,6 +111,9 @@ enum class ServerSource(
     ),
     HUGGING_FACE(
         key = "hugging_face",
+        type = ServerSourceType.CLOUD,
+        readiness = ServerSourceReadiness.STABLE,
+        version = "2026.6.10",
         featureTags = setOf(
             FeatureTag.Txt2Img,
             FeatureTag.Img2Img,
@@ -106,6 +123,9 @@ enum class ServerSource(
     ),
     OPEN_AI(
         key = "open_ai",
+        type = ServerSourceType.CLOUD,
+        readiness = ServerSourceReadiness.STABLE,
+        version = "2026.6.10",
         featureTags = setOf(
             FeatureTag.Txt2Img,
             FeatureTag.MultipleModels,
@@ -114,17 +134,25 @@ enum class ServerSource(
     ),
     STABILITY_AI(
         key = "stability_ai",
+        type = ServerSourceType.CLOUD,
+        readiness = ServerSourceReadiness.STABLE,
+        version = "2026.6.10",
         featureTags = setOf(
             FeatureTag.Txt2Img,
             FeatureTag.Img2Img,
+            FeatureTag.MultipleModels,
             FeatureTag.Batch,
         ),
     ),
     FAL_AI(
         key = "fal_ai",
+        type = ServerSourceType.CLOUD,
+        readiness = ServerSourceReadiness.ALPHA,
+        version = "2026.6.11",
         featureTags = setOf(
             FeatureTag.Txt
```

**File**: `presentation/src/androidMain/kotlin/com/shifthackz/aisdv1/presentation/di/UiUtilsModule.kt` (modified, +2/-7)
```diff
@@ -16,8 +16,8 @@ import com.shifthackz.aisdv1.presentation.screen.logger.AndroidLogReader
 import com.shifthackz.aisdv1.presentation.screen.logger.AndroidLoggerPlatformActions
 import com.shifthackz.aisdv1.presentation.screen.logger.LogReader
 import com.shifthackz.aisdv1.presentation.screen.logger.LoggerPlatformActions
-import com.shifthackz.aisdv1.presentation.screen.setup.AndroidServerSetupDownloadGuard
-import com.shifthackz.aisdv1.presentation.screen.setup.ServerSetupDownloadGuard
+import com.shifthackz.aisdv1.presentation.screen.setup.platform.AndroidServerSetupDownloadGuard
+import com.shifthackz.aisdv1.presentation.screen.setup.platform.ServerSetupDownloadGuard
 import com.shifthackz.aisdv1.presentation.screen.txt2img.AndroidImageSaver
 import com.shifthackz.aisdv1.presentation.screen.txt2img.AndroidImageSharer
 import com.shifthackz.aisdv1.presentation.screen.txt2img.ImageSaver
@@ -30,11 +30,6 @@ import org.koin.core.module.dsl.singleOf
 import org.koin.dsl.bind
 import org.koin.dsl.module
 
-/**
- * Exposes the `uiUtilsModule` value used by the SDAI presentation layer.
- *
- * @author Dmitriy Moroz
- */
 internal val uiUtilsModule = module {
     factoryOf(::GalleryExporter) bind GalleryExportService::class
     factory { AndroidGalleryPlatformActions(androidContext(), get()) } bind GalleryPlatformActions::class
```

**File**: `presentation/src/androidMain/kotlin/com/shifthackz/aisdv1/presentation/preview/PresentationScreenPreviews.android.kt` (modified, +4/-51)
```diff
@@ -21,21 +21,16 @@ import com.shifthackz.aisdv1.presentation.screen.gallery.detail.GalleryDetailSta
 import com.shifthackz.aisdv1.presentation.screen.gallery.detail.GalleryDetailTab
 import com.shifthackz.aisdv1.presentation.screen.img2img.ImageToImageContent
 import com.shifthackz.aisdv1.presentation.screen.img2img.ImageToImageState
-import com.shifthackz.aisdv1.presentation.screen.settings.ContentSettingsState
-import com.shifthackz.aisdv1.presentation.screen.settings.SettingsState
-import com.shifthackz.aisdv1.presentation.screen.setup.ServerSetupContent
-import com.shifthackz.aisdv1.presentation.screen.setup.ServerSetupState
+import com.shifthackz.aisdv1.presentation.screen.settings.content.ContentSettingsState
+import com.shifthackz.aisdv1.presentation.screen.settings.model.SettingsState
+import com.shifthackz.aisdv1.presentation.screen.setup.content.ServerSetupContent
+import com.shifthackz.aisdv1.presentation.screen.setup.model.ServerSetupState
 import com.shifthackz.aisdv1.presentation.screen.txt2img.TextToImageContent
 import com.shifthackz.aisdv1.presentation.screen.txt2img.TextToImageState
 import com.shifthackz.aisdv1.presentation.theme.global.AiSdAppTheme
 import com.shifthackz.aisdv1.presentation.theme.global.AiSdAppThemeState
 import com.shifthackz.aisdv1.presentation.widget.input.GenerationInputForm
 
-/**
- * Renders the `TextToImageContentPreview` UI for the SDAI presentation layer.
- *
- * @author Dmitriy Moroz
- */
 @Preview(name = "Txt2Img screen", widthDp = 360, heightDp = 740, showBackground = true)
 @Composable
 private fun TextToImageContentPreview() {
@@ -48,11 +43,6 @@ private fun TextToImageContentPreview() {
     }
 }
 
-/**
- * Renders the `ImageToImageUnsupportedPreview` UI for the SDAI presentation layer.
- *
- * @author Dmitriy Moroz
- */
 @Preview(name = "Img2Img unsupported", widthDp = 360, heightDp = 740, showBackground = true)
 @Composable
 private fun ImageToImageUnsupportedPreview() {
@@ -65,11 +55,6 @@ private fun ImageToImageUnsupportedPreview() {
     }
 }
 
-/**
- * Renders the `GenerationInputFormPreview` UI for the SDAI presentation layer.
- *
- * @author Dmitriy Moroz
- */
 @Preview(name = "Generation form", widthDp = 360, heightDp = 560, showBackground = true)
 @Composable
 private fun GenerationInputFormPreview() {
@@ -83,11 +68,6 @@ private fun GenerationInputFormPreview() {
     }
 }
 
-/**
- * Renders the `ServerSetupContentPreview` UI for the SDAI presentation layer.
- *
- * @author Dmitriy Moroz
- */
 @Preview(name = "Configuration", widthDp = 360, heightDp = 740, showBackground = true)
 @Composable
 private fun ServerSetupContentPreview() {
@@ -105,11 +85,6 @@ private fun ServerSetupContentPreview() {
     }
 }
 
-/**
- * Renders the `SettingsContentPreview` UI for the SDAI presentation layer.
- *
- * @author Dmitriy Moroz
- */
 @Preview(name = "Settings content", widthDp = 360, heightDp = 740, showBackground = true)
 @Composable
 private fun SettingsContentPreview() {
@@ -131,11 +106,6 @@ private fun SettingsContentPreview() {
     }
 }
 
-/**
- * Renders the `GalleryDetailInfoPreview` UI for the SDAI presentation layer.
- *
- * @author Dmitriy Moroz
- */
 @Preview(name = "Gallery details info", widthDp = 360, heightDp = 740, showBackground = true)
 @Composable
 private fun GalleryDetailInfoPreview() {
@@ -173,13 +143,6 @@ private fun GalleryDetailInfoPreview() {
     }
 }
 
-/**
- * Renders the `PreviewTheme` UI for the SDAI presentation layer.
- *
- * @param darkTheme dark theme value consumed by the API.
- * @param content content value consumed by the API.
- * @author Dmitriy Moroz
- */
 @Composable
 private fun PreviewTheme(
     darkTheme: Boolean = false,
@@ -200,11 +163,6 @@ private fun PreviewTheme(
     }
 }
 
-/**
- * Executes the `previewTextToImageState` step in the SDAI presentation layer.
- *
- * @author Dmitriy Moroz
- */
 private fun previewTextToImageState() = TextToImageState(
     loadingConfiguration = false,
     onBoardingDemo = true,
@@ -216,11 +174,6 @@ private fun previewTextToImageState() = TextToImageState(
     batchCount = 2,
 )
 
-/**
- * Executes the `previewImageToImageState` step in the SDAI presentation layer.
- *
- * @author Dmitriy Moroz
- */
 private fun previewImageToImageState() = ImageToImageState(
     loadingConfiguration = false,
     onBoardingDemo = true,
```

---

### Incident Patch 9: `539e9929` (2026-06-11)
**Commit Message**: Hotfix onboarding/gallery UI

**File**: `GIT_WORKFLOW.md` (modified, +64/-22)
```diff
@@ -58,6 +58,20 @@ git push --force-with-lease origin feature/my-feature
 
 ## Release Flow: develop to master
 
+Before moving `develop` to `master`, regenerate Dokka in a separate docs-only PR that targets `develop`.
+
+Expected release preparation:
+
+1. Merge the planned feature PRs into `develop`.
+2. Create a docs-only branch from `develop`.
+3. Regenerate Dokka.
+4. Open and merge a docs-only PR back into `develop`.
+5. Run release validation from `develop`.
+6. Fast-forward `master` from `develop`.
+7. Tag the release from `master`.
+
+This keeps feature PR diffs reviewable and moves generated documentation conflicts into one predictable release step.
+
 The release merge from `develop` to `master` must preserve commit object IDs. Do not use GitHub's PR merge buttons for `develop -> master`.
 
 GitHub's merge UI can create new server-side commits or rewrite commits depending on the selected merge strategy:
@@ -149,61 +163,89 @@ If manual deployment is added, the job must still guard against `develop`:
 if: github.ref == 'refs/heads/master'
 ```
 
-It is fine to regenerate `docs/docs` on feature branches and `develop`; publishing is restricted to `master`.
+It is fine to run Dokka generation locally or in CI on feature branches and `develop`; committed generated output is reserved for release docs PRs, and publishing is restricted to `master`.
 
 ## Generated Dokka Documentation
 
 Generated Dokka output lives under `docs/docs`.
 
-Feature branches may include a final docs-only commit when useful, but generated docs are expected to conflict when two feature branches both change public APIs.
+Feature branches must not include generated Dokka output. Do not commit `docs/docs` changes from feature work.
 
 Preferred feature shape:
 
 1. Implementation commits.
-2. One final Dokka commit:
+2. Manual docs or README updates when they are part of the feature.
+3. No generated Dokka commit.
+
+Feature PR CI may run Dokka as a validation step, but the generated output should stay as a CI artifact or temporary local output, not as committed source.
+
+Preferred release documentation shape:
+
+1. Create a release docs branch from updated `develop`:
+
+```bash
+git fetch origin
+git switch develop
+git pull --ff-only origin develop
+git switch -c docs/release-dokka
+```
+
+2. Regenerate and commit Dokka:
 
 ```bash
 ./gradlew dokkaGeneratePublicationHtml --no-daemon
 git add docs/docs
-git commit -m "Regenerate Dokka for <feature>"
+git commit -m "Regenerate Dokka for release"
 ```
 
-When two feature PRs both regenerate Dokka, merge one PR first. Then refresh the remaining PR:
+3. Open the docs-only PR against `develop`.
+
+When two feature PRs both change public APIs, merge them without Dokka. After both are in `develop`, the single release Dokka PR regenerates the final API documentation once.
+
+If an old feature branch already contains a generated Dokka commit, drop or skip that commit while rebasing onto `develop`:
 
 ```bash
 git fetch origin
-git switch feature/remaining-feature
+git switch feature/old-feature
 git rebase origin/develop
 ```
 
-If the rebase conflicts only in the docs-only Dokka commit, skip that docs commit and regenerate Dokka after the rebase:
+If the rebase conflicts only in the stale Dokka commit:
 
 ```bash
 git rebase --skip
-./gradlew dokkaGeneratePublicationHtml --no-daemon
-git add docs/docs
-git commit -m "Regenerate Dokka for <feature>"
-git push --force-with-lease origin feature/remaining-feature
+git push --force-with-lease origin feature/old-feature
 ```
 
-If the rebase has source conflicts, resolve source code first, then regenerate Dokka from the final source tree. Do not hand-edit generated Dokka HTML to resolve semantic API conflicts.
+If the rebase has source conflicts, resolve source code first. Do not hand-edit generated Dokka HTML to resolve semantic API conflicts.
+
+## Root Markdown Documents
+
+Root-level Markdown files are part of the public project documentation surface.
+
+`README.md` must link to every other root-level `.md` document so users and contributors can discover repository policies and manuals from one place.
+
+When adding, removing, or renaming a root-level `.md` file:
+
+1. Update the root documentation section in `README.md`.
+2. Keep the link text human-readable.
+3. Do not include generated documentation output in this rule; it applies only to root-level Markdown files committed by maintainers.
 
 ## Current Migration Note
 
 At the time this workflow was introduced, two feature branches were already based on `master`:
 
-- `feature/backport-614-patch1`
-- `feature/ios-coreml-local-provider`
+- `feature/new-functionality-A`
+- `feature/new-functionality-B`
 
-Both contain generated Dokka updates under `docs/docs`, so their PRs are expected to conflict if both are opened against `develop`.
+Both were created before the release-only Dokka rule. If either branch contains generated Dokka updates under `docs/docs`, drop or replace those generated
```

**File**: `README.md` (modified, +9/-0)
```diff
@@ -16,6 +16,15 @@ SDAI is an open-source, cross-platform AI image generation client for Android an
 
 No ads. No telemetry. No lock-in to a single provider.
 
+## Project Documentation
+
+Root-level Markdown documents:
+
+- [Documentation](DOCUMENTATION.md)
+- [Screenshot generation](SCREENSHOT_GENERATION.md)
+- [Git workflow](GIT_WORKFLOW.md)
+- [Code of conduct](CODE_OF_CONDUCT.md)
+
 ## Why SDAI
 
 - Choose the backend that fits the moment: your own AUTOMATIC1111 or SwarmUI server, AI Horde, Hugging Face, OpenAI, Stability AI, Fal.ai, or local diffusion where the platform supports it.
```

**File**: `docs/app-store-core-ml-compliance.md` (removed, +0/-100)
```diff
@@ -1,100 +0,0 @@
-# App Store Core ML Compliance Research
-
-Date: 2026-06-11
-
-## Scope
-
-This note evaluates whether SDAI can add an iOS-only local image generation provider built on Core ML, with downloadable or imported Stable Diffusion model assets.
-
-Working feature name: `Silicon Diffusion Core ML`.
-
-It is a product/engineering compliance review, not legal advice.
-
-## Result
-
-No App Store compliance blocker was found for an iOS Core ML local provider, if the implementation stays within Apple's public APIs and treats models as user-visible data assets, not executable code.
-
-The recommended direction is to proceed with an iOS-first local provider. The safest first implementation is a free, explicit, opt-in "Local Core ML" provider that:
-
-- uses Core ML / Swift / Kotlin Multiplatform integration through public APIs only;
-- runs prompts, source images, and generated images on device by default;
-- downloads only model data/resources into the app container after an explicit user action;
-- clearly shows model source, license, file size, device requirements, and delete/offline status;
-- avoids external paid unlocking for models or features unless routed through Apple's in-app purchase rules;
-- includes App Review notes explaining the local generation flow and how reviewers can exercise it.
-
-For framework references, prefer Apple's official spelling `Core ML`. For the app provider branding, use `Silicon Diffusion Core ML`.
-
-## Evidence
-
-Apple Review Guideline 2.5.1 requires public APIs and current OS support. Core ML is an Apple public ML framework, and Apple documents Core ML model packages as an intended way to integrate ML models into Xcode projects.
-
-Apple Review Guideline 2.5.2 is the main boundary: the app must not download, install, or execute code that changes app functionality. Downloaded Core ML model files should therefore be handled strictly as data/resources. The implementation must not download dynamic frameworks, native binaries, Python code, custom kernels, JIT code, scripts, or plugin code.
-
-Apple Review Guideline 4.2.3 explicitly allows apps that need additional resources on first launch, as long as the app discloses the download size and prompts the user. Apple also recommends this pattern in the `apple/ml-stable-diffusion` FAQ for large Core ML model files: prompt the user to download model assets on first launch and disclose the size because of data/storage impact.
-
-Apple's `apple/ml-stable-diffusion` project is MIT-licensed and provides a Swift `StableDiffusion` package for apps, backed by Core ML model files generated from PyTorch/diffusers. Its README lists iOS/iPadOS runtime support and device benchmarks, including Stable Diffusion 2.1 at 512x512 and SDXL iOS at 768x768.
-
-Apple App Privacy guidance says data processed only on device and not sent to a server is not "collected" for App Store privacy answers. That is favorable for a genuinely offline Core ML provider. If any model downloads, telemetry, crash analytics, remote provider calls, or cloud moderation are added, those data flows still need to be reflected in privacy labels and the privacy policy.
-
-Apple Review Guideline 5.1.2 requires clear disclosure and explicit permission before personal data is shared with third-party AI. Local Core ML generation avoids this for prompt/source-image inference, but the app must keep cloud providers clearly separated from the local provider.
-
-## Compliance Requirements
-
-Use only public Apple APIs. Core ML, Swift, Foundation, UIKit/SwiftUI, and normal file APIs are acceptable. Do not use private ANE APIs, private compiler/runtime entry points, downloaded dynamic libraries, or JIT/executable payloads.
-
-Keep downloaded models as data. Store model packages in the app container, validate them before use, and load them through Core ML-supported model loading paths. Treat model catalogs as metadata, not as code/config that silently unlocks unrelated app features.
-
-Make downloads explicit. Before downloading a model, show at least source, license, approximate size, required iOS/device class, and storage impact. Provide cancel/retry/delete, and make failure states clean.
-
-Keep privacy labels accurate. Pure local inference should not add prompt/image collection by itself, but model download requests, analytics, crash reporting, remote providers, or generated-image reporting can still collect data and must be disclosed.
-
-Separate local and cloud flows in the UI. The local provider should say that generation runs on device. Remote providers should continue to disclose their network/API-key behavior.
-
-Handle content risk. Image generation can produce objectionable or age-sensitive outputs depending on model and prompt. Metadata, age rating, safety copy, and sharing/reporting surfaces should be reviewed before release. If the app ever hosts or shares generated content between users, apply App Review user-generated-content controls.
-
-Respect model licenses. 
```

**File**: `docs/pr-614-backport.md` (removed, +0/-180)
```diff
@@ -1,180 +0,0 @@
-# PR 614 Backport Audit
-
-Source: https://github.com/ShiftHackZ/Stable-Diffusion-Android/pull/614
-
-This document tracks useful changes from PR #614 that are worth preserving in the current KMP master. The PR was created against an older Android-only master and later mixed product work with PDAI rebranding, website edits, release automation, dependency churn, and marketing/site tracking. Those categories are intentionally excluded from the backport.
-
-## Useful Improvements
-
-| Area | PR commits | What to preserve | Backport status |
-| --- | --- | --- | --- |
-| A1111 and Forge generation controls | `1696cacf`, `89cf7cb9` | Hires.Fix, ADetailer, Forge module lookup, scheduler/model metadata, and request mapping for A1111-compatible backends. | Backported. Domain configs, A1111 request mapping, KMP txt2img/img2img UI controls for Hires.Fix/ADetailer/Scheduler, Forge module discovery, txt2img Forge module selection/override settings, ADetailer availability checks, and Hires OOM error copy are ported. |
-| Inpaint UX | `9ebbe972`, `e43b4642` | Better mask drawing ergonomics, pan/zoom handling, and visible mask overlay on the source image. | Backported in KMP form. The standalone inpaint screen now has draw mode, gesture zoom when draw is off, zoom reset, and a synchronized zoom slider; the img2img preview keeps an opaque mask overlay. |
-| Gallery UX | `9ebbe972`, `96289bd6`, `3cca660e`, `9a7c3468`, `55826b37`, `27cd2b43`, `e43b4642`, `91a62d29` | Selection mode, batch like/hide/unlike/unhide, detail navigation improvements, thumbnail/blurhash placeholders, and save selected images. | Mostly backported. Batch hide/unhide, batch like/unlike, single-image like toggle, liked badges, full-width report action, and swipe navigation in gallery detail are ported. Save-selected export already existed in current master. Thumbnails/blurhash were reviewed and deferred because they require a KMP storage/cache migration. |
-| Media storage performance | `30dd4d3e`, `96289bd6`, `9a7c3468`, `55826b37` | Move generated image payloads out of Room rows where feasible, add thumbnails/cache metadata, and keep migration compatibility. | Deferred. High-risk because current master is KMP Room with Android/iOS targets and the PR implementation was Android/file-store oriented. |
-| Fal.AI backend | `509fae69`, `2c358643`, later Fal.AI fixes | Fal.AI source, endpoint catalog parsing, FLUX request/response mapping, dynamic generation form, and tests. | Backported in KMP architecture for compatible FLUX txt2img/img2img endpoints. Current master now has setup/API-key validation, endpoint selection in the universal generation form, predefined Fal image sizes, acceleration/sync/safety options, native `num_images` batch handling, queue polling, txt2img/img2img repository routes, and tests. Dynamic platform endpoint discovery, redux/variation endpoints, Flux 2 endpoints with divergent schemas, and Fal inpainting remain deferred. |
-| Inactive-source network guard | `c027b8f7` | Avoid fetching remote model lists/engine lists for providers that are not the active generation source. | Backported. |
-| Gallery model name | `127580e5` | Persist and display the model/engine name used for a generation result. | Backported. |
-| Local Qualcomm QNN and MNN | `373edf15`, `1f3dc388`, `5dc3f84f` | QNN/MNN local backend ideas, model scanning, runtime selection, progress reporting, and square-resolution Hires.Fix presets. | Deferred. QNN is Android-only and expects proprietary native artifacts; MNN in this PR only adds model configuration JSON without integrating a runtime in current master. |
-| Progress notifications | `1f3dc388` | Low-importance progress notification channel to avoid disruptive heads-up alerts. | Backported. |
-| Logger export | `9ebbe972` | Export/copy log file from Logger screen. | Backported. |
-
-## Excluded From Backport
-
-- SDAI to PDAI package/name/path/log rebranding and icon/logo replacements.
-- Website redesign, CNAME changes, Telegram QR/download page changes, Yandex.Metrika, policy/index updates, and docs site marketing changes.
-- Release notes for PDAI versions and GitHub release workflow changes.
-- Broad dependency updates and version-management plugins from the fork.
-- Donate-button removal and unrelated product policy changes.
-- Any generated documentation or large site artifact churn.
-
-## Current Master Notes
-
-- Current `master` is newer than the PR branch and has already moved to KMP/iOS-ready source sets.
-- Room schemas are under `storage/src/commonMain` with Android and iOS platform builders.
-- Gallery already has paging/export and a `hidden` field, so gallery changes must be ported as focused deltas rather than wholesale copies.
-- The PR branch contains mass package moves after the PDAI rebrand; use pre-rebrand commits as references where possible.
-
-## Backport Log
-
-### 2026-06-11
-
-- Created branch `codex/backport-pr-614-improvements` from current `master`.
-- Added this aud
```

**File**: `presentation/src/androidUnitTest/kotlin/com/shifthackz/aisdv1/presentation/screen/gallery/detail/GalleryDetailViewModelTest.kt` (modified, +24/-0)
```diff
@@ -164,6 +164,27 @@ class GalleryDetailViewModelTest {
             Assert.assertEquals(GalleryDetailDialog.None, viewModel.state.value.dialog)
         }
 
+    @Test
+    fun `given delete confirmed with neighbour item, expected neighbour opened`() =
+        runTest(testDispatcher) {
+            val items = (1L..3L).map { id ->
+                mockAiGenerationResult.copy(id = id)
+            }
+            coEvery { getAllGalleryUseCase() } returns items
+            coEvery { deleteGalleryItemUseCase(2L) } returns Unit
+            val viewModel = createViewModel(itemId = 2L)
+            advanceUntilIdle()
+
+            viewModel.processIntent(GalleryDetailIntent.Delete.Confirm)
+
+            Assert.assertEquals(3L, viewModel.state.value.content?.id)
+            Assert.assertEquals(listOf(1L, 3L), viewModel.state.value.galleryItemIds)
+            verify(exactly = 0) { router.navigateBack() }
+
+            advanceUntilIdle()
+            coVerify { deleteGalleryItemUseCase(2L) }
+        }
+
     @Test
     fun `given image export on original tab, expected original image saved`() =
         runTest(testDispatcher) {
@@ -256,6 +277,9 @@ class GalleryDetailViewModelTest {
             advanceUntilIdle()
 
             viewModel.processIntent(GalleryDetailIntent.ToggleLike)
+
+            Assert.assertEquals(true, viewModel.state.value.content?.liked)
+
             advanceUntilIdle()
 
             Assert.assertEquals(true, viewModel.state.value.content?.liked)
```

**File**: `presentation/src/commonMain/kotlin/com/shifthackz/aisdv1/presentation/screen/gallery/detail/GalleryDetailContent.kt` (modified, +3/-4)
```diff
@@ -423,15 +423,14 @@ private fun SwipeableGalleryImage(
     )
     val currentImageScale = remember(content.id, selectedTab) { mutableFloatStateOf(1f) }
 
-    LaunchedEffect(content.id, selectedTab, currentPage, pagerContentStartIndex, pagerContents) {
+    LaunchedEffect(selectedTab, currentPage) {
         currentImageScale.floatValue = 1f
-        val pageContent = pagerContents.getOrNull(pagerState.currentPage - pagerContentStartIndex)
-        if (pagerState.currentPage != currentPage || pageContent?.id != content.id) {
+        if (pagerState.currentPage != currentPage) {
             pagerState.scrollToPage(currentPage)
         }
     }
 
-    LaunchedEffect(pagerState.settledPage, content.id, pagerContentStartIndex, pagerContents) {
+    LaunchedEffect(pagerState.settledPage, currentPage, pagerContentStartIndex, pagerContents) {
         val pageContent = pagerContents.getOrNull(pagerState.settledPage - pagerContentStartIndex)
         if (pagerState.settledPage != currentPage && pageContent != null) {
             onPageSelected(pagerState.settledPage)
```

**File**: `presentation/src/commonMain/kotlin/com/shifthackz/aisdv1/presentation/screen/gallery/detail/GalleryDetailViewModel.kt` (modified, +232/-65)
```diff
@@ -119,6 +119,10 @@ class GalleryDetailViewModel(
 
     private var currentItemId: Long = itemId
     private val safePagerBuffer = pagerBuffer.coerceAtLeast(0)
+    private var galleryItems: List<AiGenerationResult> = emptyList()
+    private val contentCache = mutableMapOf<Long, GalleryDetailContent>()
+    private val showReportButton: Boolean
+        get() = buildInfoProvider.type != BuildType.FOSS
 
     override fun processIntent(intent: GalleryDetailIntent) {
         when (intent) {
@@ -150,38 +154,21 @@ class GalleryDetailViewModel(
     private fun load() {
         launch(dispatchersProvider.io) {
             runCatching {
-                val galleryItems = getGalleryItems()
-                val result = galleryItems.firstOrNull { it.id == currentItemId }
+                val items = getGalleryItems()
+                val result = items.firstOrNull { it.id == currentItemId }
                     ?: getGenerationResult(currentItemId)
-                Triple(result, galleryItems, galleryItems.map(AiGenerationResult::id))
+                val itemIndex = items.indexOfFirst { it.id == result.id }
+                galleryItems = items
+                result.cachedContent() to itemIndex
             }
                 .onFailure(::handleFailure)
-                .onSuccess { (result, galleryItems, galleryItemIds) ->
-                    val tabs = GalleryDetailTab.consume(result.type)
-                    val selectedTab = currentState.selectedTab.takeIf(tabs::contains) ?: tabs.first()
-                    val itemIndex = galleryItems.indexOfFirst { it.id == result.id }
-                    val content = result.toGalleryDetailContent(
-                        showReportButton = buildInfoProvider.type != BuildType.FOSS,
-                    )
-                    val pagerWindow = createPagerWindow(
-                        galleryItems = galleryItems,
-                        itemIndex = itemIndex,
-                        content = content,
-                        showReportButton = buildInfoProvider.type != BuildType.FOSS,
-                    )
+                .onSuccess { (content, itemIndex) ->
                     withContext(dispatchersProvider.immediate) {
-                        updateState {
-                            it.copy(
-                                loading = false,
-                                tabs = tabs,
-                                selectedTab = selectedTab,
-                                galleryItemIds = galleryItemIds,
-                                content = content,
-                                pagerContents = pagerWindow.contents,
-                                pagerContentStartIndex = pagerWindow.startIndex,
-                                pagerCurrentIndex = pagerWindow.currentIndex,
-                            )
-                        }
+                        setCurrentContent(
+                            content = content,
+                            itemIndex = itemIndex,
+                            decodeMissing = true,
+                        )
                     }
                 }
         }
@@ -219,14 +206,58 @@ class GalleryDetailViewModel(
     private fun delete() {
         setActiveDialog(GalleryDetailDialog.None)
         val id = currentState.content?.id ?: return
+        val itemIndex = galleryItems.indexOfFirst { it.id == id }
+        if (itemIndex == -1) {
+            launch(dispatchersProvider.io) {
+                runCatching { deleteGalleryItemUseCase(id) }
+                    .onFailure(::handleFailure)
+                    .onSuccess {
+                        withContext(dispatchersProvider.immediate) {
+                            router.navigateBack()
+                        }
+                    }
+            }
+            return
+        }
+
+        val updatedItems = galleryItems.toMutableList().apply { removeAt(itemIndex) }
+        contentCache.remove(id)
+        galleryItems = updatedItems
+
+        if (updatedItems.isEmpty()) {
+            launch(dispatchersProvider.io) {
+                runCatching { deleteGalleryItemUseCase(id) }
+                    .onFailure(::handleFailure)
+                    .onSuccess {
+                        withContext(dispatchersProvider.immediate) {
+                            updateState {
+                                it.copy(
+                                    content = null,
+                                    pagerContents = emptyList(),
+                                    galleryItemIds = emptyList(),
+                                    tabs = emptyList(),
+                                )
+                            }
+                            router.navigateBack()
+                        }
+                    }
+            }
+            return
+        }
+
+        val nextItemIndex = itemIndex.coerceAtMost(updatedItems.lastIndex)
+        val nextItem = updatedItems[nextItemIndex]
+        currentItemId = nextItem.id
+       
```

**File**: `presentation/src/commonMain/kotlin/com/shifthackz/aisdv1/presentation/screen/gallery/list/GalleryScreenContent.kt` (modified, +1/-4)
```diff
@@ -233,10 +233,7 @@ fun GalleryScreenContent(
                 else -> LazyVerticalGrid(
                     modifier = Modifier
                         .fillMaxSize()
-                        .padding(
-                            top = paddingValues.calculateTopPadding(),
-                            bottom = paddingValues.calculateBottomPadding(),
-                        )
+                        .padding(top = paddingValues.calculateTopPadding())
                         .verticalScrollbar(listState),
                     columns = GridCells.Fixed(state.grid.size),
                     contentPadding = PaddingValues(16.dp),
```

---

### Incident Patch 10: `ed6113fb` (2025-02-12)
**Commit Message**: Remove image reporting from FOSS build (#415)

**File**: `.idea/inspectionProfiles/Project_Default.xml` (modified, +5/-0)
```diff
@@ -3,15 +3,19 @@
     <option name="myName" value="Project Default" />
     <inspection_tool class="ComposePreviewDimensionRespectsLimit" enabled="true" level="WARNING" enabled_by_default="true">
       <option name="composableFile" value="true" />
+      <option name="previewFile" value="true" />
     </inspection_tool>
     <inspection_tool class="ComposePreviewMustBeTopLevelFunction" enabled="true" level="ERROR" enabled_by_default="true">
       <option name="composableFile" value="true" />
+      <option name="previewFile" value="true" />
     </inspection_tool>
     <inspection_tool class="ComposePreviewNeedsComposableAnnotation" enabled="true" level="ERROR" enabled_by_default="true">
       <option name="composableFile" value="true" />
+      <option name="previewFile" value="true" />
     </inspection_tool>
     <inspection_tool class="ComposePreviewNotSupportedInUnitTestFiles" enabled="true" level="ERROR" enabled_by_default="true">
       <option name="composableFile" value="true" />
+      <option name="previewFile" value="true" />
     </inspection_tool>
     <inspection_tool class="GlancePreviewDimensionRespectsLimit" enabled="true" level="WARNING" enabled_by_default="true">
       <option name="composableFile" value="true" />
@@ -35,6 +39,7 @@
     </inspection_tool>
     <inspection_tool class="PreviewDeviceShouldUseNewSpec" enabled="true" level="WEAK WARNING" enabled_by_default="true">
       <option name="composableFile" value="true" />
+      <option name="previewFile" value="true" />
     </inspection_tool>
     <inspection_tool class="PreviewDimensionRespectsLimit" enabled="true" level="WARNING" enabled_by_default="true">
       <option name="composableFile" value="true" />
```

**File**: `data/src/test/java/com/shifthackz/aisdv1/data/mocks/SupporterMocks.kt` (modified, +2/-0)
```diff
@@ -1,3 +1,5 @@
+@file:Suppress("DEPRECATION")
+
 package com.shifthackz.aisdv1.data.mocks
 
 import com.shifthackz.aisdv1.domain.entity.Supporter
```

**File**: `feature/work/src/main/java/com/shifthackz/aisdv1/work/BackgroundWorkObserverImpl.kt` (modified, +2/-2)
```diff
@@ -22,8 +22,8 @@ internal class BackgroundWorkObserverImpl : BackgroundWorkObserver {
         return Flowable.combineLatest(
             stateSubject.toFlowable(BackpressureStrategy.LATEST),
             messageSubject.toFlowable(BackpressureStrategy.LATEST),
-        ) { running, statusMessage ->
-            BackgroundWorkStatus(running, statusMessage.first, statusMessage.second)
+        ) { running, (title, subTitle) ->
+            BackgroundWorkStatus(running, title, subTitle)
         }
     }
 
```

**File**: `gradle/libs.versions.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [versions]
-versionName = "0.6.6"
-versionCode = "186"
+versionName = "0.6.7"
+versionCode = "187"
 targetSdk = "34"
 compileSdk = "35"
 minSdk = "24"
```

**File**: `presentation/src/main/java/com/shifthackz/aisdv1/presentation/core/GenerationMviViewModel.kt` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@
 
 package com.shifthackz.aisdv1.presentation.core
 
+import com.shifthackz.aisdv1.core.common.appbuild.BuildInfoProvider
 import com.shifthackz.aisdv1.core.common.extensions.EmptyLambda
 import com.shifthackz.aisdv1.core.common.log.errorLog
 import com.shifthackz.aisdv1.core.common.schedulers.SchedulersProvider
```

**File**: `presentation/src/main/java/com/shifthackz/aisdv1/presentation/di/ViewModelModule.kt` (modified, +29/-1)
```diff
@@ -38,7 +38,6 @@ val viewModelModule = module {
     viewModelOf(::DrawerViewModel)
     viewModelOf(::HomeNavigationViewModel)
     viewModelOf(::ConfigurationLoaderViewModel)
-    viewModelOf(::ImageToImageViewModel)
     viewModelOf(::TextToImageViewModel)
     viewModelOf(::SettingsViewModel)
     viewModelOf(::GalleryViewModel)
@@ -94,6 +93,7 @@ val viewModelModule = module {
         GalleryDetailViewModel(
             itemId = parameters.get(),
             dispatchersProvider = get(),
+            buildInfoProvider = get(),
             getGenerationResultUseCase = get(),
             getLastResultFromCacheUseCase = get(),
             deleteGalleryItemUseCase = get(),
@@ -118,4 +118,32 @@ val viewModelModule = module {
             buildInfoProvider = get(),
         )
     }
+
+    viewModel {
+        ImageToImageViewModel(
+            dispatchersProvider = get(),
+            generationFormUpdateEvent = get(),
+            getStableDiffusionSamplersUseCase = get(),
+            observeHordeProcessStatusUseCase = get(),
+            observeLocalDiffusionProcessStatusUseCase = get(),
+            saveLastResultToCacheUseCase = get(),
+            saveGenerationResultUseCase = get(),
+            interruptGenerationUseCase = get(),
+            drawerRouter = get(),
+            dimensionValidator = get(),
+            imageToImageUseCase = get(),
+            getRandomImageUseCase = get(),
+            bitmapToBase64Converter = get(),
+            base64ToBitmapConverter = get(),
+            preferenceManager = get(),
+            schedulersProvider = get(),
+            notificationManager = get(),
+            wakeLockInterActor = get(),
+            inPaintStateProducer = get(),
+            mainRouter = get(),
+            backgroundTaskManager = get(),
+            backgroundWorkObserver = get(),
+            buildInfoProvider = get(),
+        )
+    }
 }
```

**File**: `presentation/src/main/java/com/shifthackz/aisdv1/presentation/modal/ModalRenderer.kt` (modified, +1/-0)
```diff
@@ -111,6 +111,7 @@ fun ModalRenderer(
         is Modal.Image.Single -> GenerationImageResultDialog(
             imageBase64 = screenModal.result.image,
             showSaveButton = !screenModal.autoSaveEnabled,
+            showReportButton = screenModal.reportEnabled,
             onDismissRequest = dismiss,
             onSaveRequest = {
                 processIntent(GenerationMviIntent.Result.Save(listOf(screenModal.result)))
```

**File**: `presentation/src/main/java/com/shifthackz/aisdv1/presentation/model/Modal.kt` (modified, +17/-6)
```diff
@@ -81,18 +81,29 @@ sealed interface Modal {
     sealed interface Image : Modal {
 
         @Immutable
-        data class Single(val result: AiGenerationResult, val autoSaveEnabled: Boolean) : Image
+        data class Single(
+            val result: AiGenerationResult,
+            val autoSaveEnabled: Boolean,
+            val reportEnabled: Boolean,
+        ) : Image
 
         @Immutable
-        data class Batch(val results: List<AiGenerationResult>, val autoSaveEnabled: Boolean) : Image
+        data class Batch(val results: List<AiGenerationResult>, val autoSaveEnabled: Boolean) :
+            Image
 
         @Immutable
         data class Crop(val bitmap: Bitmap) : Image
 
         companion object {
-            fun create(list: List<AiGenerationResult>, autoSaveEnabled: Boolean): Image =
-                if (list.size > 1) Batch(list, autoSaveEnabled)
-                else Single(list.first(), autoSaveEnabled)
+            fun create(
+                list: List<AiGenerationResult>,
+                autoSaveEnabled: Boolean,
+                reportEnabled: Boolean = false,
+            ): Image = if (list.size > 1) {
+                Batch(list, autoSaveEnabled)
+            } else {
+                Single(list.first(), autoSaveEnabled, reportEnabled)
+            }
         }
     }
 
@@ -103,7 +114,7 @@ sealed interface Modal {
     data class Error(val error: UiText) : Modal
 
     @Immutable
-    data class ManualPermission(val permission: UiText): Modal
+    data class ManualPermission(val permission: UiText) : Modal
 
     data object ClearInPaintConfirm : Modal
 
```

#### Recent Merged Pull Requests:
- **PR #708** (closed): Bump androidx.navigation:navigation-compose from 2.9.8 to 2.10.1 (@dependabot[bot])
- **PR #702** (closed): Bump com.google.protobuf:protobuf-java from 4.26.1 to 4.36.1 (@dependabot[bot])
- **PR #701** (closed): Bump agp from 8.13.2 to 9.4.0 (@dependabot[bot])
- **PR #700** (closed): Bump androidx.navigation:navigation-compose from 2.9.8 to 2.10.0 (@dependabot[bot])
- **PR #699** (closed): Bump org.jetbrains.compose from 1.11.1 to 1.12.0 (@dependabot[bot])
- **PR #698** (closed): Bump com.google.protobuf:protobuf-java from 4.26.1 to 4.36.0 (@dependabot[bot])
- **PR #697** (closed): Bump gradle-wrapper from 8.13 to 9.7.1 (@dependabot[bot])
- **PR #696** (closed): Bump agp from 8.13.2 to 9.3.2 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
