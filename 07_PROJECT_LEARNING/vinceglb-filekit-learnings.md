# Forensic Learning Record (Deep Inspection): vinceglb/FileKit

> **Canonical Artifact**: `07_PROJECT_LEARNING/vinceglb-filekit-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vinceglb/FileKit](https://github.com/vinceglb/FileKit))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:34:14.167Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vinceglb/FileKit`
- **Description**: Pick and save Files, Medias and Folder for Kotlin Multiplatform / KMP and Compose Multiplatform / CMP
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1545 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `filekit-core/src/androidMain/kotlin/io/github/vinceglb/filekit/FileKit.android.kt`
```
package io.github.vinceglb.filekit

import android.annotation.SuppressLint
import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.webkit.MimeTypeMap
import androidx.annotation.IntRange
import androidx.exifinterface.media.ExifInterface
import io.github.vinceglb.filekit.exceptions.FileKitCoreNotInitializedException
import io.github.vinceglb.filekit.exceptions.FileKitException
import io.github.vinceglb.filekit.utils.calculateNewDimensions
import io.github.vinceglb.filekit.utils.runSuspendCatchingFileKit
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File
import java.lang.ref.WeakReference
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid

public actual object FileKit

internal object FileKitCore {
    private var _context: WeakReference<Context?> = WeakReference(null)
    val context: Context
        get() = _context.get()
            ?: throw FileKitCoreNotInitializedException()

    fun init(context: Context) {
        _context = WeakReference(context)
    }
}

/**
 * Returns the Android [Context] used by FileKit.
 *
 * @throws FileKitCoreNotInitializedException if FileKit has not been initialized.
 */
@Suppress("UnusedReceiverParameter")
public val FileKit.context: Context
    get() = FileKitCore.context

/**
 * Manually initializes FileKit with the given [Context].
 *
 * This is usually done automatically by [io.github.vinceglb.filekit.initializer.FileKitInitializer].
 *
 * @param context The Android Context.
 */
@Suppress("UnusedReceiverParameter")
public fun FileKit.manualFileKitCoreInitialization(context: Context) {
    FileKitCore.init(context)
}

public actual val FileKit.filesDir: PlatformFile
    get() = context.filesDir.let(::PlatformFile)

public actual val FileKit.cacheDir: PlatformFile
    get() = context.cacheDir.let(::PlatformFile)

public actual val FileKit.databasesDir: PlatformFile
    get() = context.getDatabasePath("dummy").parentFile.let { directory ->
        PlatformFile(requireNotNull(directory) { "Databases directory is null" })
    }

public actual val FileKit.projectDir: PlatformFile
    get() = PlatformFile(".")

public actual suspend fun FileKit.saveImageToGallery(
    bytes: ByteArray,
    filename: String,
): Result<Unit> = runSuspendCatchingFileKit {
    withContext(Dispatchers.IO) {
        val relativePath = mediaRelativePath()
        val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        } else {
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        }

        val details = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, filename)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath)
            }
        }

        writeMediaToGallery(
            collection = collection,
            details = details,
            mediaLabel = "image",
            filename = filename,
            writer = { destination -> destination write bytes },
        )
    }
}

private suspend fun FileKit.writeMediaToGallery(
    collection: Uri,
    details: ContentValues,
    mediaLabel: String,
    filename: String,
    writer: suspend (PlatformFile) -> Unit,
    onWritten: suspend (Uri) -> Unit = {},
) {
    val resolver = context.contentResolver
    val mediaUri = resolver.insert(collection, details)
        ?: throw FileKitException("Failed to create $mediaLabel entry in MediaStore for filename: $filename")

    try {
        val destination = PlatformFile(mediaUri)
        writer(destination)
        onWritten(mediaUri)
    } catch (error: Exception) {
        resolver.delete(mediaUri, null, null)
        if (error is CancellationException) {
            throw error
        }
        if (error is FileKitException) {
            throw error
        }
        throw FileKitException("Failed to save $mediaLabel to gallery", error)
    }
}

public actual suspend fun FileKit.compressImage(
    bytes: ByteArray,
    imageFormat: ImageFormat,
    @IntRange(from = 0, to = 100) quality: Int,
    maxWidth: Int?,
    maxHeight: Int?,
): ByteArray = withContext(Dispatchers.IO) {
    // Step 1: Decode the ByteArray to Bitmap
    val originalBitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        ?: throw FileKitException("Failed to decode image")

    // Step 2: Correct the orientation using EXIF data
    val correctedBitmap = correctBitmapOrientation(bytes, originalBitmap)

    // Step 3: Calculate the new dimensions while maintaining an aspect ratio
    val (newWidth, newHeight) = calculateNewDimensions(
        correctedBitmap.width,
        correctedBitmap.height,
        maxWidth,
        maxHeight,
    )

    // Step 4: Resize the Bitmap
    @SuppressLint("UseKtx")
    val resizedBitmap = Bitmap.createScaledBitmap(correctedBitmap, newWidth, newHeight, true)

    // Step 5: Create a ByteArrayOutputStream to hold the compressed data
    val outputStream = ByteArrayOutputStream()

    // Step 6: Compress the resized Bitmap
    val format = when (imageFormat) {
        ImageFormat.JPEG -> Bitmap.CompressFormat.JPEG
        ImageFormat.PNG -> Bitmap.CompressFormat.PNG
    }
    resizedBitmap.compress(format, quality, outputStream)

    // Step 7: Convert the compressed data back to ByteArray
    outputStream.toByteArray()
}

// Helper function to correct bitmap orientation
@OptIn(ExperimentalUuidApi::class)
private fun correctBitmapOrientation(imageData: ByteArray, bitmap: Bitmap): Bitmap {
    // Step 1: Write ByteArray to a temporary file
    val tempId = Uuid.random().toString()
    val tempFile = File.createTempFile("image-$tempId", null)
    tempFile.writeBytes(imageData)

    // Step 2: Read EXIF data from the temporary file
    val exif = ExifInterface(tempFile.path)
    val orientation = exif.getAttributeInt(
        ExifInterface.TAG_ORIENTATION,
        ExifInterface.ORIENTATION_NORMAL,
    )

    // Step 3: Apply rotation or flipping based on the orientation
    val matrix = Matrix()
    when (orientation) {
        ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
        ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
        ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
        ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.postScale(-1f, 1f)
        ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.postScale(1f, -1f)
    }

    // Step 4: Return the corrected bitmap
    return Bitmap
        .createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
        .also { tempFile.delete() }
}

public actual suspend fun FileKit.saveVideoToGallery(
    file: PlatformFile,
    filename: String,
): Result<Unit> = runSuspendCatchingFileKit {
    withContext(Dispatchers.IO) {
        val mimeType = resolveVideoMimeType(file = file, filename = filename)
        writeVideoToGallery(file = file, filename = filename, mimeType = mimeType)
    }
}

private suspend fun FileKit.writeVideoToGallery(
    file: PlatformFile,
    filename: String,
    mimeType: String,
) {
    val relativePath = mediaRelativePath()
    val details = ContentValues().apply {
        put(MediaStore.Video.Media.DISPLAY_NAME, filename)
        put(MediaStore.Video.Media.MIME_TYPE, mimeType)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath)
            put(MediaStore.Video.Media.IS_PENDING, 1)
        }
    }
    val videoCollection = when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q -> {
            MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        }

        else -> {
            MediaStore.Video.Media.EXTERNAL_CONTENT_URI
        }
    }
    writeMediaToGallery(
        collection = videoCollection,
        details = details,
        mediaLabel = "video",
        filename = filename,
        writer = { destination -> file.copyTo(destination) },
    ) { videoUri ->
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val completed = ContentValues().apply {
                put(MediaStore.Video.Media.IS_PENDING, 0)
            }
            context.contentResolver.update(videoUri, completed, null, null)
        }
    }
}

private fun resolveVideoMimeType(file: PlatformFile, filename: String): String {
    file
        .mimeType()
        ?.toString()
        ?.normalizeMime()
        ?.takeIf(::isVideoMime)
        ?.let { return it }

    val extension = filename
        .substringAfterLast('.', "")
        .lowercase()
        .takeIf { it.isNotBlank() }
        ?: return "video/mp4"

    return MimeTypeMap
        .getSingleton()
        .getMimeTypeFromExtension(extension)
        ?.normalizeMime()
        ?.takeIf(::isVideoMime)
        ?: "video/mp4"
}

private fun String.normalizeMime() = substringBefore(';').trim().lowercase()

private fun isVideoMime(mime: String) = mime.startsWith("video/")

private fun FileKit.mediaRelativePath(): String {
    val appLabel = context.applicationInfo
        .loadLabel(context.packageManager)
        .toString()
        .takeIf { it.isNotBlank() }
        ?: context.packageName.substringAfterLast('.')

    val folderName = sanitizeDirectorySegment(appLabel)
    return "${Environment.DIRECTORY_DCIM}/$folderName"
}

private fun sanitizeDirectorySegment(value: String): String {
    val invalidChars = setOf('\\', '/', ':', '*', '?', '"', '<', '>', '|')
    val sanitized = value
        .trim()
        .map { char -> if (char in invalidChars) '_' else char }
        .joinToStrin
```

### Core Architecture Module: `filekit-core/src/androidMain/kotlin/io/github/vinceglb/filekit/PlatformFile.android.kt`
```
package io.github.vinceglb.filekit

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.ParcelFileDescriptor
import android.provider.DocumentsContract
import android.provider.MediaStore
import android.provider.OpenableColumns
import android.system.ErrnoException
import android.system.Os
import android.system.OsConstants
import android.webkit.MimeTypeMap
import androidx.documentfile.provider.DocumentFile
import io.github.vinceglb.filekit.exceptions.FileKitException
import io.github.vinceglb.filekit.exceptions.FileKitUriPathNotSupportedException
import io.github.vinceglb.filekit.mimeType.MimeType
import io.github.vinceglb.filekit.utils.div
import io.github.vinceglb.filekit.utils.toKotlinxPath
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.io.IOException
import kotlinx.io.RawSink
import kotlinx.io.RawSource
import kotlinx.io.asSink
import kotlinx.io.asSource
import kotlinx.io.files.Path
import kotlinx.io.files.SystemFileSystem
import kotlinx.serialization.Serializable
import java.io.File
import java.nio.file.Files
import java.nio.file.attribute.BasicFileAttributes
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

/**
 * Represents a file on the Android platform.
 *
 * This class wraps either a [File] (for filesystem paths) or a [Uri] (for content providers).
 *
 * @property androidFile The underlying [AndroidFile] wrapper (File or Uri).
 */
@Serializable(with = PlatformFileSerializer::class)
public actual data class PlatformFile(
    val androidFile: AndroidFile,
) {
    public actual override fun toString(): String = path

    public actual companion object
}

/**
 * Wrapper for Android file representations.
 */
public sealed class AndroidFile {
    /**
     * Wraps a standard Java [File].
     */
    public data class FileWrapper(
        val file: File,
    ) : AndroidFile()

    /**
     * Wraps an Android [Uri].
     */
    public data class UriWrapper(
        val uri: Uri,
    ) : AndroidFile()
}

public actual fun PlatformFile(path: Path): PlatformFile =
    PlatformFile(AndroidFile.FileWrapper(File(path.toString())))

/**
 * Creates a [PlatformFile] from an Android [Uri].
 *
 * @param uri The [Uri] to wrap.
 * @return A [PlatformFile] instance.
 */
public fun PlatformFile(uri: Uri): PlatformFile =
    uri.toFileOrNull()?.let(::PlatformFile)
        ?: PlatformFile(AndroidFile.UriWrapper(uri))

/**
 * Creates a [PlatformFile] from a Java [File].
 *
 * @param file The [File] to wrap.
 * @return A [PlatformFile] instance.
 */
public fun PlatformFile(file: File): PlatformFile =
    PlatformFile(AndroidFile.FileWrapper(file))

public actual fun PlatformFile(path: String): PlatformFile {
    // If the path looks like an Android Uri ("content://" or "file://" scheme),
    // parse it accordingly, otherwise treat it as a regular filesystem path.
    // "file://" values are normalized to FileWrapper by PlatformFile(uri).
    return if (path.startsWith("content://", ignoreCase = true) ||
        path.startsWith("file://", ignoreCase = true)
    ) {
        @SuppressLint("UseKtx")
        PlatformFile(Uri.parse(path))
    } else {
        PlatformFile(AndroidFile.FileWrapper(File(path)))
    }
}

public actual fun PlatformFile(base: PlatformFile, child: String): PlatformFile {
    return when (val baseFile = base.androidFile) {
        is AndroidFile.FileWrapper -> {
            // For file-based paths, use kotlinx.io Path
            PlatformFile(base.toKotlinxIoPath() / child)
        }

        is AndroidFile.UriWrapper -> {
            val childUri = baseFile.uri.buildChildDocumentUri(child)
            childUri.findChildDocumentInfo()?.let { existing ->
                return PlatformFile(existing.uri)
            }

            PlatformFile(childUri)
        }
    }
}

public actual fun PlatformFile.toKotlinxIoPath(): Path = when (androidFile) {
    is AndroidFile.FileWrapper -> androidFile.file.toKotlinxPath()
    is AndroidFile.UriWrapper -> throw FileKitUriPathNotSupportedException()
}

public actual val PlatformFile.name: String
    get() = when (androidFile) {
        is AndroidFile.FileWrapper -> toKotlinxIoPath().name
        is AndroidFile.UriWrapper -> getUriFileName(androidFile.uri)
    }

public actual val PlatformFile.extension: String
    get() = when (androidFile) {
        is AndroidFile.FileWrapper -> androidFile.file.extension

        is AndroidFile.UriWrapper -> when {
            isDirectory() -> ""
            else -> getUriFileName(androidFile.uri).substringAfterLast(".", "")
        }
    }

public actual val PlatformFile.nameWithoutExtension: String
    get() = when (androidFile) {
        is AndroidFile.FileWrapper -> androidFile.file.nameWithoutExtension

        is AndroidFile.UriWrapper -> when {
            isDirectory() -> getUriFileName(androidFile.uri)
            else -> getUriFileName(androidFile.uri).substringBeforeLast(".")
        }
    }

public actual val PlatformFile.path: String
    get() = when (androidFile) {
        is AndroidFile.FileWrapper -> toKotlinxIoPath().toString()
        is AndroidFile.UriWrapper -> androidFile.uri.toString()
    }

public actual fun PlatformFile.isRegularFile(): Boolean = when (androidFile) {
    is AndroidFile.FileWrapper -> {
        SystemFileSystem.metadataOrNull(toKotlinxIoPath())?.isRegularFile
            ?: false
    }

    is AndroidFile.UriWrapper -> {
        androidFile.uri.isRegularDocument()
    }
}

public actual fun PlatformFile.isDirectory(): Boolean = when (androidFile) {
    is AndroidFile.FileWrapper -> SystemFileSystem.metadataOrNull(toKotlinxIoPath())?.isDirectory
        ?: false

    is AndroidFile.UriWrapper -> androidFile.uri.isDirectoryDocument()
}

public actual fun PlatformFile.isAbsolute(): Boolean = when (androidFile) {
    is AndroidFile.FileWrapper -> toKotlinxIoPath().isAbsolute
    is AndroidFile.UriWrapper -> true
}

public actual fun PlatformFile.exists(): Boolean = when (androidFile) {
    is AndroidFile.FileWrapper -> SystemFileSystem.exists(toKotlinxIoPath())
    is AndroidFile.UriWrapper -> androidFile.uri.existsAsDocument()
}

public actual fun PlatformFile.size(): Long = when (androidFile) {
    is AndroidFile.FileWrapper -> SystemFileSystem.metadataOrNull(toKotlinxIoPath())?.size ?: -1
    is AndroidFile.UriWrapper -> getUriFileSize(androidFile.uri) ?: -1
}

public actual fun PlatformFile.parent(): PlatformFile? = when (androidFile) {
    is AndroidFile.FileWrapper -> {
        toKotlinxIoPath().parent?.let(::PlatformFile)
    }

    is AndroidFile.UriWrapper -> {
        androidFile.uri.parentDocumentUriOrNull()?.let(::PlatformFile)
    }
}

public actual fun PlatformFile.absolutePath(): String = when (androidFile) {
    is AndroidFile.FileWrapper -> androidFile.file.absolutePath
    is AndroidFile.UriWrapper -> androidFile.uri.toString()
}

public actual fun PlatformFile.absoluteFile(): PlatformFile = when (androidFile) {
    is AndroidFile.FileWrapper -> PlatformFile(SystemFileSystem.resolve(toKotlinxIoPath()))
    is AndroidFile.UriWrapper -> this
}

@OptIn(ExperimentalTime::class)
public actual fun PlatformFile.createdAt(): Instant? = this.androidFile.let { androidFile ->
    when (androidFile) {
        is AndroidFile.FileWrapper -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val attributes = Files.readAttributes(
                    androidFile.file.toPath(),
                    BasicFileAttributes::class.java,
                )
                val timestamp = attributes.creationTime().toMillis()
                Instant.fromEpochMilliseconds(timestamp)
            } else {
                // Fallback for older Android versions
                null
            }
        }

        is AndroidFile.UriWrapper -> {
            null
        }
    }
}

@OptIn(ExperimentalTime::class)
public actual fun PlatformFile.lastModified(): Instant {
    val timestamp = this.androidFile.let { androidFile ->
        when (androidFile) {
            is AndroidFile.FileWrapper -> {
                androidFile.file.lastModified()
            }

            is AndroidFile.UriWrapper -> {
                DocumentFile
                    .fromSingleUri(FileKit.context, androidFile.uri)
                    ?.lastModified()
                    ?: throw IllegalStateException("Unable to get last modified date for URI")
            }
        }
    }

    return Instant.fromEpochMilliseconds(timestamp)
}

public actual fun PlatformFile.mimeType(): MimeType? {
    if (isDirectory()) {
        return null
    }

    return when (androidFile) {
        is AndroidFile.FileWrapper -> {
            val mimeTypeValue = getMimeTypeValueFromExtension(extension)
            mimeTypeValue?.let(MimeType::parse)
        }

        is AndroidFile.UriWrapper -> {
            val mimeTypeValueFromContentResolver =
                FileKit.context.contentResolver.getType(androidFile.uri)
            val mimeTypeValue =
                mimeTypeValueFromContentResolver ?: getMimeTypeValueFromExtension(extension)
            mimeTypeValue?.let(MimeType::parse)
        }
    }
}

private fun getMimeTypeValueFromExtension(extension: String): String? {
    val safeExtension = extension.trim().lowercase()

    if (safeExtension.isEmpty()) return null

    return MimeTypeMap
        .getSingleton()
        .getMimeTypeFromExtension(safeExtension)
        ?.trim()
        ?.lowercase()
}

private const val DEFAULT_STREAM_MIME_TYPE = "application/octet-stream"

internal actual suspend fun PlatformFile.prepareDestinationForWrite(
    source: PlatformFile,
): PlatformFile = withContext(Dispatchers.IO) {
    if (!isDirectory()) {
        return@withContext this@prepareDestinationForWrite
    }

    when (val target = androidFile) {
        is AndroidFile.FileWrapper -> {
            val path = toKotlinxIoPath() / source.name
            PlatformFile(path)
        }

    
```

### Core Architecture Module: `filekit-core/src/androidMain/kotlin/io/github/vinceglb/filekit/exceptions/FileKitCoreNotInitializedException.kt`
```
package io.github.vinceglb.filekit.exceptions

public class FileKitCoreNotInitializedException :
    FileKitException(
        "FileKit Core not initialized properly. You may have disabled App Startup in your app. Please check the documentation: https://filekit.mintlify.app/core/setup#android-setup",
    )

```

### Core Architecture Module: `filekit-core/src/androidMain/kotlin/io/github/vinceglb/filekit/exceptions/FileKitNotInitializedException.kt`
```
package io.github.vinceglb.filekit.exceptions

public class FileKitNotInitializedException :
    FileKitException("FileKit not initialized on Android. Please call FileKit.init(activity) first.")

```

### Core Architecture Module: `filekit-core/src/androidMain/kotlin/io/github/vinceglb/filekit/exceptions/FileKitUriPathNotSupportedException.kt`
```
package io.github.vinceglb.filekit.exceptions

public class FileKitUriPathNotSupportedException : FileKitException("Uri-based PlatformFile does not have a Path representation")

```

### Core Architecture Module: `filekit-core/src/androidMain/kotlin/io/github/vinceglb/filekit/initializer/FileKitInitializer.kt`
```
package io.github.vinceglb.filekit.initializer

import android.content.Context
import androidx.startup.Initializer
import io.github.vinceglb.filekit.FileKit
import io.github.vinceglb.filekit.FileKitCore

/**
 * Initializes FileKit automatically on Android using AndroidX App Startup.
 */
@Suppress("unused")
public class FileKitInitializer : Initializer<FileKit> {
    override fun create(context: Context): FileKit =
        FileKit.apply { FileKitCore.init(context) }

    override fun dependencies(): List<Class<out Initializer<*>>> =
        emptyList()
}

```

### Core Architecture Module: `filekit-core/src/androidMain/kotlin/io/github/vinceglb/filekit/utils/FileExt.android.kt`
```
package io.github.vinceglb.filekit.utils

import kotlinx.io.files.Path
import java.io.File

/**
 * Converts a [File] to a [Path].
 *
 * @return A [Path] instance representing this file.
 */
public fun File.toKotlinxPath(): Path = Path(this.path)

```

### Core Architecture Module: `filekit-core/src/appleMain/kotlin/io/github/vinceglb/filekit/AppleBookmarkConfiguration.apple.kt`
```
package io.github.vinceglb.filekit

import io.github.vinceglb.filekit.exceptions.BookmarkResolutionFailure
import platform.Foundation.NSError

internal data class AppleBookmarkCreationConfiguration(
    val options: ULong,
    val kind: MacOsBookmarkKind?,
)

internal data class AppleBookmarkPayload(
    val bytes: ByteArray,
    val resolutionOptions: ULong,
    val isLegacy: Boolean,
    val kind: MacOsBookmarkKind? = null,
)

internal expect fun appleBookmarkCreationConfiguration(): AppleBookmarkCreationConfiguration

internal expect fun encodeAppleBookmarkPayload(
    payload: ByteArray,
    configuration: AppleBookmarkCreationConfiguration,
): ByteArray

internal expect fun decodeAppleBookmarkPayload(bytes: ByteArray): AppleBookmarkPayload

internal expect fun classifyAppleBookmarkResolutionError(error: NSError?): BookmarkResolutionFailure

```

### Core Architecture Module: `filekit-core/src/appleMain/kotlin/io/github/vinceglb/filekit/FileKit.apple.kt`
```
@file:Suppress("UnusedReceiverParameter")

package io.github.vinceglb.filekit

import androidx.annotation.IntRange
import io.github.vinceglb.filekit.exceptions.FileKitException
import io.github.vinceglb.filekit.utils.toByteArray
import io.github.vinceglb.filekit.utils.toNSData
import kotlinx.cinterop.UnsafeNumber
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.IO
import kotlinx.coroutines.withContext
import platform.Foundation.NSCachesDirectory
import platform.Foundation.NSData
import platform.Foundation.NSFileManager
import platform.Foundation.NSURL
import platform.Foundation.NSUserDomainMask
import platform.Foundation.temporaryDirectory

public actual object FileKit

@OptIn(UnsafeNumber::class)
public actual val FileKit.cacheDir: PlatformFile
    get() = NSFileManager
        .defaultManager
        .URLsForDirectory(NSCachesDirectory, NSUserDomainMask)
        .firstOrNull()
        ?.let { it as NSURL? }
        ?.let(::PlatformFile)
        ?: throw FileKitException("Could not find cache directory")

/**
 * Returns the temporary directory for the current user.
 */
public val FileKit.tempDir: PlatformFile
    get() = NSFileManager
        .defaultManager
        .temporaryDirectory
        .let(::PlatformFile)

public actual val FileKit.databasesDir: PlatformFile
    get() {
        val dir = FileKit.filesDir / "databases"
        if (!dir.exists()) {
            dir.createDirectories()
        }
        return dir
    }

public actual suspend fun FileKit.compressImage(
    bytes: ByteArray,
    imageFormat: ImageFormat,
    @IntRange(from = 0, to = 100) quality: Int,
    maxWidth: Int?,
    maxHeight: Int?,
): ByteArray = withContext(Dispatchers.IO) {
    // Step 1: Decode the ByteArray to UIImage (iOS) or NSImage (macOS)
    val nsData = bytes.toNSData()

    // Step 2: Compress the UIImage
    val compressedData = compress(nsData, quality, maxWidth, maxHeight, imageFormat)

    // Step 3: Return the compressed image as ByteArray
    val res = compressedData.toByteArray()

    res
}

internal expect fun compress(
    nsData: NSData,
    quality: Int,
    maxWidth: Int?,
    maxHeight: Int?,
    imageFormat: ImageFormat,
): NSData

```

### Core Architecture Module: `filekit-core/src/appleMain/kotlin/io/github/vinceglb/filekit/PlatformFile.apple.kt`
```
package io.github.vinceglb.filekit

import io.github.vinceglb.filekit.exceptions.BookmarkResolutionException
import io.github.vinceglb.filekit.exceptions.FileKitException
import io.github.vinceglb.filekit.mimeType.MimeType
import io.github.vinceglb.filekit.utils.toByteArray
import io.github.vinceglb.filekit.utils.toKotlinxPath
import io.github.vinceglb.filekit.utils.toNSData
import kotlinx.cinterop.BetaInteropApi
import kotlinx.cinterop.BooleanVar
import kotlinx.cinterop.ByteVar
import kotlinx.cinterop.CPointer
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.ObjCObjectVar
import kotlinx.cinterop.UnsafeNumber
import kotlinx.cinterop.alloc
import kotlinx.cinterop.allocArray
import kotlinx.cinterop.convert
import kotlinx.cinterop.memScoped
import kotlinx.cinterop.pointed
import kotlinx.cinterop.ptr
import kotlinx.cinterop.toKString
import kotlinx.cinterop.value
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.IO
import kotlinx.coroutines.withContext
import kotlinx.io.IOException
import kotlinx.io.files.Path
import kotlinx.io.files.SystemFileSystem
import kotlinx.serialization.Serializable
import platform.CoreFoundation.CFRelease
import platform.CoreFoundation.CFStringCreateWithCString
import platform.CoreFoundation.CFStringGetCString
import platform.CoreFoundation.CFStringGetLength
import platform.CoreFoundation.CFStringGetMaximumSizeForEncoding
import platform.CoreFoundation.CFStringRef
import platform.CoreFoundation.kCFAllocatorDefault
import platform.CoreFoundation.kCFStringEncodingUTF8
import platform.CoreServices.UTTypeCopyPreferredTagWithClass
import platform.CoreServices.kUTTagClassMIMEType
import platform.Foundation.NSDate
import platform.Foundation.NSError
import platform.Foundation.NSFileManager
import platform.Foundation.NSFileType
import platform.Foundation.NSFileTypeSymbolicLink
import platform.Foundation.NSLock
import platform.Foundation.NSURL
import platform.Foundation.NSURLContentModificationDateKey
import platform.Foundation.NSURLContentTypeKey
import platform.Foundation.NSURLCreationDateKey
import platform.Foundation.NSURLResourceKey
import platform.Foundation.NSURLTypeIdentifierKey
import platform.Foundation.timeIntervalSince1970
import platform.UniformTypeIdentifiers.UTType
import platform.posix.errno
import platform.posix.free
import platform.posix.realpath
import platform.posix.strerror
import platform.posix.unlink
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

/**
 * Represents a file on the Apple platform (iOS/macOS).
 *
 * @property nsUrl The underlying [NSURL] object.
 */
@Serializable(with = PlatformFileSerializer::class)
public actual class PlatformFile private constructor(
    public val nsUrl: NSURL,
    internal val macOsBookmarkLease: MacOsBookmarkLease?,
) {
    public constructor(nsUrl: NSURL) : this(nsUrl, null)

    public actual override fun toString(): String = path

    public operator fun component1(): NSURL = nsUrl

    public fun copy(nsUrl: NSURL = this.nsUrl): PlatformFile = PlatformFile(
        nsUrl = nsUrl,
        macOsBookmarkLease = macOsBookmarkLease?.takeIf { it.covers(nsUrl) },
    )

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is PlatformFile) return false
        return nsUrl.path == other.nsUrl.path
    }

    override fun hashCode(): Int = nsUrl.path.hashCode()

    public actual companion object {
        internal fun withMacOsBookmarkLease(url: NSURL): PlatformFile =
            PlatformFile(url, MacOsBookmarkLease(url))
    }
}

@OptIn(ExperimentalForeignApi::class)
internal class MacOsBookmarkLease(
    url: NSURL,
) {
    private val lock = NSLock()
    private val rootPath = url.standardizedPath
    private var scopeUrl: NSURL? = url
    private var activeAccesses = 0
    private var released = false

    fun covers(url: NSURL): Boolean = url.standardizedPath.isWithin(rootPath)

    fun start(): Boolean = lock.withLock {
        if (released) {
            throw FileKitException("This security-scoped bookmark has been released")
        }
        val granted = requireNotNull(scopeUrl).startAccessingSecurityScopedResource()
        if (granted) {
            activeAccesses += 1
        }
        return granted
    }

    fun stop(): Unit = lock.withLock {
        if (activeAccesses == 0) return@withLock
        requireNotNull(scopeUrl).stopAccessingSecurityScopedResource()
        activeAccesses -= 1
        releaseNativeUrlIfDrained()
    }

    fun release(): Unit = lock.withLock {
        if (released) return@withLock
        released = true
        releaseNativeUrlIfDrained()
    }

    private fun releaseNativeUrlIfDrained() {
        if (released && activeAccesses == 0) {
            scopeUrl = null
        }
    }
}

private inline fun <T> NSLock.withLock(block: () -> T): T {
    lock()
    return try {
        block()
    } finally {
        unlock()
    }
}

public actual fun PlatformFile(path: Path): PlatformFile =
    if (path.isAbsolute) {
        PlatformFile(NSURL.fileURLWithPath(path = path.toString()))
    } else {
        PlatformFile(NSURL(string = path.toString()))
    }

public actual fun PlatformFile.toKotlinxIoPath(): Path =
    nsUrl.toKotlinxPath()

@PublishedApi
internal actual fun PlatformFile.withPath(path: Path): PlatformFile =
    copy(PlatformFile(path).nsUrl)

private fun String.isWithin(rootPath: String): Boolean {
    val root = rootPath.trimEnd('/')
    return when {
        root.isEmpty() && rootPath.startsWith('/') -> startsWith('/')
        this == root -> true
        root.isNotEmpty() -> startsWith("$root/")
        else -> false
    }
}

@OptIn(ExperimentalForeignApi::class)
private val NSURL.standardizedPath: String
    get() {
        val unresolvedSegments = mutableListOf<String>()
        var candidate = path?.trimEnd('/').orEmpty().ifEmpty { "/" }
        while (true) {
            realpath(candidate, null)?.let { resolved ->
                val canonicalPath = try {
                    resolved.toKString()
                } finally {
                    free(resolved)
                }
                return unresolvedSegments
                    .asReversed()
                    .fold(canonicalPath) { current, segment -> "$current/$segment" }
                    .normalizePosixPath()
            }
            if (candidate == "/") break
            val separator = candidate.lastIndexOf('/')
            unresolvedSegments += candidate.substring(separator + 1)
            candidate = if (separator <= 0) "/" else candidate.substring(0, separator)
        }
        return URLByStandardizingPath?.path.orEmpty()
    }

private fun String.normalizePosixPath(): String {
    val normalizedSegments = mutableListOf<String>()
    for (segment in split('/')) {
        when (segment) {
            "", "." -> Unit
            ".." -> if (normalizedSegments.isNotEmpty()) normalizedSegments.removeAt(normalizedSegments.lastIndex)
            else -> normalizedSegments += segment
        }
    }
    return normalizedSegments.joinToString(separator = "/", prefix = "/")
}

public actual val PlatformFile.extension: String
    get() = nsUrl.pathExtension ?: ""

public actual val PlatformFile.nameWithoutExtension: String
    get() = name.substringBeforeLast(".", name)

public actual fun PlatformFile.absolutePath(): String =
    nsUrl.absoluteString ?: ""

public actual inline fun PlatformFile.list(block: (List<PlatformFile>) -> Unit): Unit =
    withScopedAccess {
        val directoryFiles = SystemFileSystem
            .list(toKotlinxIoPath())
            .map(::withPath)
        block(directoryFiles)
    }

public actual fun PlatformFile.list(): List<PlatformFile> =
    withScopedAccess {
        SystemFileSystem
            .list(toKotlinxIoPath())
            .map(::withPath)
    }

@OptIn(ExperimentalForeignApi::class, ExperimentalTime::class)
public actual fun PlatformFile.createdAt(): Instant? = withScopedAccess {
    val values = nsUrl.resourceValuesForKeys(listOf(NSURLCreationDateKey), null)
    val date = values?.get(NSURLCreationDateKey) as? NSDate
    Instant.fromEpochSeconds(date?.timeIntervalSince1970?.toLong() ?: 0L)
}

@OptIn(ExperimentalForeignApi::class, ExperimentalTime::class)
public actual fun PlatformFile.lastModified(): Instant = withScopedAccess {
    val values = nsUrl.resourceValuesForKeys(listOf(NSURLContentModificationDateKey), null)
    val date = values?.get(NSURLContentModificationDateKey) as? NSDate
    Instant.fromEpochSeconds(date?.timeIntervalSince1970?.toLong() ?: 0L)
}

public actual fun PlatformFile.mimeType(): MimeType? = withScopedAccess { file ->
    file.nsUrl.mimeTypeFromMetadata()
        ?: file.nsUrl.mimeTypeFromExtension()
}?.takeIf { it.isNotBlank() }?.let(MimeType::parse)

private fun NSURL.mimeTypeFromMetadata(): String? {
    val contentType = resourceValue(NSURLContentTypeKey) as? UTType

    val fromContentType = contentType?.preferredMIMEType
    if (!fromContentType.isNullOrBlank()) {
        return fromContentType
    }

    val identifier = contentType?.identifier
        ?: resourceValue(NSURLTypeIdentifierKey) as? String

    return identifier?.let(::mimeTypeFromUti)
}

private fun NSURL.mimeTypeFromExtension(): String? =
    pathExtension
        ?.takeIf { it.isNotBlank() }
        ?.let { ext -> UTType.typeWithFilenameExtension(ext)?.preferredMIMEType }

@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
private fun NSURL.resourceValue(key: NSURLResourceKey): Any? = memScoped {
    val valuePtr = alloc<ObjCObjectVar<Any?>>()
    val success = getResourceValue(value = valuePtr.ptr, forKey = key, error = null)
    if (success) valuePtr.value else null
}

@OptIn(ExperimentalForeignApi::class)
private fun mimeTypeFromUti(uti: String): String? {
    if (uti.isBlank()) {
        return null
    }

    return memScoped {
        val cfUti = CFStringCreateWithCString(
            alloc = kCFAllocatorDefault,
            cStr = uti,
            enco
```

### Core Architecture Module: `filekit-core/src/appleMain/kotlin/io/github/vinceglb/filekit/exceptions/FileKitNSURLNullPathException.kt`
```
package io.github.vinceglb.filekit.exceptions

public class FileKitNSURLNullPathException : FileKitException("The NSURL path is null")

```

### Core Architecture Module: `filekit-core/src/appleMain/kotlin/io/github/vinceglb/filekit/utils/NSDataExt.kt`
```
package io.github.vinceglb.filekit.utils

import kotlinx.cinterop.BetaInteropApi
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.UnsafeNumber
import kotlinx.cinterop.addressOf
import kotlinx.cinterop.convert
import kotlinx.cinterop.refTo
import kotlinx.cinterop.usePinned
import platform.Foundation.NSData
import platform.Foundation.create
import platform.posix.memcpy

@OptIn(ExperimentalForeignApi::class, UnsafeNumber::class)
public fun NSData.toByteArray(): ByteArray = let { nsData ->
    ByteArray(nsData.length.toInt()).apply {
        memcpy(this.refTo(0), nsData.bytes, nsData.length)
    }
}

@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class, UnsafeNumber::class)
public fun ByteArray.toNSData(): NSData = usePinned {
    NSData.create(
        bytes = it.addressOf(0),
        length = this.size.convert(),
    )
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #46** (2024-06-26): **🐛 Fix AwtFileSaver resumed twice**
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

### Incident Patch 1: `ba5bcc69` (2026-09-07)
**Commit Message**: 🔀 Merge pull request #636 from Enaium/feature/linux-native-xdg-portal-picker

✨ Add Kotlin/Native Linux file picker via XDG desktop portal

**File**: `.github/workflows/ci.yml` (modified, +41/-1)
```diff
@@ -10,6 +10,9 @@ concurrency:
   cancel-in-progress: true
 
 jobs:
+  linux-dbus-headers:
+    uses: ./.github/workflows/linux-dbus-headers.yaml
+
   build-modules:
     name: 🔨 Build ${{ matrix.name }}
     strategy:
@@ -33,6 +36,9 @@ jobs:
       - name: 🛎️ Check out repository
         uses: actions/checkout@v7
 
+      - name: 🔧 Install Linux dialog dependencies
+        run: sudo apt-get update && sudo apt-get install -y libdbus-1-dev
+
       - name: 🍉 Configure JDK 21
         uses: actions/setup-java@v6
         with:
@@ -157,6 +163,9 @@ jobs:
       - name: 🛎️ Check out repository
         uses: actions/checkout@v7
 
+      - name: 🔧 Install Linux dialog dependencies
+        run: sudo apt-get update && sudo apt-get install -y libdbus-1-dev dbus
+
       - name: 🍉 Configure JDK 21
         uses: actions/setup-java@v6
         with:
@@ -167,7 +176,38 @@ jobs:
         uses: gradle/actions/setup-gradle@v6
 
       - name: 🧪 Run Linux Native Tests
-        run: ./gradlew linuxX64Test
+        run: dbus-run-session -- ./gradlew linuxX64Test --no-daemon
+
+  test-linux-publications:
+    name: Verify Linux publications on macOS
+    needs: linux-dbus-headers
+    runs-on: macos-26
+    steps:
+      - uses: actions/checkout@v6
+      - uses: actions/setup-java@v5
+        with:
+          distribution: 'temurin'
+          java-version: '21'
+      - uses: gradle/actions/setup-gradle@v6
+      - uses: actions/download-artifact@v4
+        with:
+          name: linux-dbus-headers
+          path: build/dbus-headers
+      - name: Build Linux artifacts and root metadata
+        run: >-
+          ./gradlew -Pfilekit.dbusHeaders=build/dbus-headers -PRELEASE_SIGNING_ENABLED=false
+          :filekit-dialogs:publishLinuxX64PublicationToMavenLocal
+          :filekit-dialogs:publishLinuxArm64PublicationToMavenLocal
+          :filekit-dialogs:generateMetadataFileForKotlinMultiplatformPublication
+      - name: Verify both Linux variants are advertised
+        run: |
+          python3 - <<'PYTHON'
+          import json
+          from pathlib import Path
+          metadata = json.loads(Path("filekit-dialogs/build/publications/kotlinMultiplatform/module.json").read_text())
+          targets = {v["attributes"].get("org.jetbrains.kotlin.native.target") for v in metadata["variants"]}
+          assert {"linux_x64", "linux_arm64"} <= targets, targets
+          PYTHON
 
   lint:
     name: 🚨 Lint
```

**File**: `.github/workflows/linux-dbus-headers.yaml` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+name: Prepare Linux D-Bus headers
+
+on:
+  workflow_call:
+
+jobs:
+  headers:
+    runs-on: ubuntu-latest
+    steps:
+      - name: Install D-Bus development headers
+        run: sudo apt-get update && sudo apt-get install -y libdbus-1-dev
+
+      - name: Stage Linux headers for cross-compilation
+        run: |
+          mkdir -p dbus-headers/dbus
+          cp /usr/include/dbus-1.0/dbus/*.h dbus-headers/dbus/
+          cp "$(pkg-config --variable=libdir dbus-1)/dbus-1.0/include/dbus/dbus-arch-deps.h" dbus-headers/dbus/
+
+      - name: Upload Linux headers
+        uses: actions/upload-artifact@v4
+        with:
+          name: linux-dbus-headers
+          path: dbus-headers/
+          if-no-files-found: error
```

**File**: `.github/workflows/publish-snapshot.yaml` (modified, +11/-2)
```diff
@@ -7,6 +7,9 @@ on:
   workflow_dispatch:
 
 jobs:
+  linux-dbus-headers:
+    uses: ./.github/workflows/linux-dbus-headers.yaml
+
   check-version:
     runs-on: ubuntu-latest
     outputs:
@@ -28,7 +31,7 @@ jobs:
   publish:
     name: Publish to Snapshot
     runs-on: macos-26
-    needs: check-version
+    needs: [check-version, linux-dbus-headers]
     if: ${{ needs.check-version.outputs.is_snapshot == 'true' }}
     steps:
       - name: Checkout
@@ -43,8 +46,14 @@ jobs:
       - name: Setup Gradle
         uses: gradle/actions/setup-gradle@v6
 
+      - name: Download Linux D-Bus headers
+        uses: actions/download-artifact@v4
+        with:
+          name: linux-dbus-headers
+          path: build/dbus-headers
+
       - name: Upload Artifacts
-        run: ./gradlew publishAllPublicationsToMavenCentralRepository
+        run: ./gradlew -Pfilekit.dbusHeaders=build/dbus-headers publishAllPublicationsToMavenCentralRepository
         env:
           ORG_GRADLE_PROJECT_mavenCentralUsername: ${{ secrets.MAVEN_CENTRAL_USERNAME }}
           ORG_GRADLE_PROJECT_mavenCentralPassword: ${{ secrets.MAVEN_CENTRAL_PASSWORD }}
```

**File**: `.github/workflows/publish.yaml` (modified, +11/-1)
```diff
@@ -7,7 +7,11 @@ on:
       - published
 
 jobs:
+  linux-dbus-headers:
+    uses: ./.github/workflows/linux-dbus-headers.yaml
+
   publish:
+    needs: linux-dbus-headers
     name: Publish to Sonatype
     runs-on: macos-26
     steps:
@@ -23,8 +27,14 @@ jobs:
       - name: Setup Gradle
         uses: gradle/actions/setup-gradle@v6
 
+      - name: Download Linux D-Bus headers
+        uses: actions/download-artifact@v4
+        with:
+          name: linux-dbus-headers
+          path: build/dbus-headers
+
       - name: Upload Artifacts
-        run: ./gradlew publishAndReleaseToMavenCentral --no-configuration-cache
+        run: ./gradlew -Pfilekit.dbusHeaders=build/dbus-headers publishAndReleaseToMavenCentral --no-configuration-cache
         env:
           ORG_GRADLE_PROJECT_mavenCentralUsername: ${{ secrets.MAVEN_CENTRAL_USERNAME }}
           ORG_GRADLE_PROJECT_mavenCentralPassword: ${{ secrets.MAVEN_CENTRAL_PASSWORD }}
```

**File**: `build-logic/convention/src/main/kotlin/KotlinMultiplatformLibraryConventionPlugin.kt` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ class KotlinMultiplatformLibraryConventionPlugin : Plugin<Project> {
                     addMacosTargets = true,
                     addWatchosTargets = path == ":filekit-core",
                     addMingwTargets = path == ":filekit-core" || path == ":filekit-dialogs",
-                    addLinuxTargets = path == ":filekit-core",
+                    addLinuxTargets = path == ":filekit-core" || path == ":filekit-dialogs",
                 )
             }
         }
```

**File**: `docs/dialogs/setup.mdx` (modified, +18/-0)
```diff
@@ -57,3 +57,21 @@ compose.desktop {
 ```
 
 This prevents a `NoClassDefFoundError` in some cases. Read more about this issue in the [GitHub issue #107](https://github.com/vinceglb/FileKit/issues/107).
+
+If using the Kotlin/Native Linux target (`linuxX64` or `linuxArm64`), dialogs are provided out of the box through the GNOME XDG Desktop Portal. The portal file chooser is shown on systems running `xdg-desktop-portal` (default on GNOME and other modern desktops); the application binary links against the `libdbus-1` runtime library.
+
+Building an application that consumes FileKit Dialogs requires the target architecture's D-Bus development libraries (`libdbus-1-dev` on Debian/Ubuntu), including the unversioned `libdbus-1.so` linker file. If the library directory is outside Kotlin/Native's linker search paths, configure the corresponding target, for example:
+
+```kotlin
+kotlin {
+    linuxX64 {
+        binaries.all {
+            linkerOpts("-L/usr/lib/x86_64-linux-gnu")
+        }
+    }
+}
+```
+
+Use your target's library directory (reported by `pkg-config --variable=libdir dbus-1` on a native Linux build machine). Cross-compilation requires libraries for the target architecture. Running the finished application requires the runtime library, not the development package.
+
+Building `filekit-dialogs` from source for Linux native targets requires the Linux D-Bus development headers (`libdbus-1-dev` on Debian/Ubuntu). Linux builds discover them through `pkg-config`. For cross-compilation, pass `-Pfilekit.dbusHeaders=/path/to/include`, where `include/dbus/` contains both the public headers and the Linux `dbus-arch-deps.h`. Release and snapshot workflows supply these headers to the macOS build so both Linux artifacts and their multiplatform metadata are published together.
```

**File**: `docs/installation.mdx` (modified, +2/-2)
```diff
@@ -11,10 +11,10 @@ FileKit supports the following targets:
 - Android
 - iOS, macOS
 - JVM (Windows, macOS, Linux)
-- Kotlin/Native Linux (`linuxX64`, `linuxArm64`) in FileKit Core
+- Kotlin/Native Linux (`linuxX64`, `linuxArm64`)
 - JS, WASM
 
-FileKit Dialogs does not yet support Kotlin/Native Linux or Aurora OS. Those integrations are separate from the FileKit Core support described here.
+FileKit Dialogs on Kotlin/Native Linux uses the GNOME XDG Desktop Portal (`xdg-desktop-portal-gnome`) file chooser, which renders the Nautilus-style GNOME file dialog. Aurora OS support remains separate from FileKit Core support described here.
 
 ## FileKit Core
 
```

**File**: `filekit-dialogs/build.gradle.kts` (modified, +65/-0)
```diff
@@ -1,4 +1,6 @@
 import org.gradle.api.tasks.testing.Test
+import org.jetbrains.kotlin.gradle.plugin.mpp.TestExecutable
+import org.jetbrains.kotlin.konan.target.HostManager
 
 plugins {
     alias(libs.plugins.filekit.kotlinMultiplatformLibrary)
@@ -17,6 +19,33 @@ val headlessAwtFilePickerTest = tasks.register<Test>("headlessAwtFilePickerTest"
     systemProperty("java.awt.headless", "true")
 }
 
+// pkg-config resolution for the libdbus cinterop. The dbus-1 development package is required to
+// build the library for Linux native targets, while consumers only need the runtime library.
+fun resolvePkgConfigArgs(argument: String): Array<String> = runCatching {
+    providers
+        .exec {
+            commandLine("pkg-config", argument, "dbus-1")
+            isIgnoreExitValue = true
+        }.standardOutput
+        .asText
+        .get()
+}.getOrDefault("")
+    .trim()
+    .split(Regex("\\s+"))
+    .filter(String::isNotBlank)
+    .toTypedArray()
+
+fun resolvePkgConfigVariable(variable: String): String? = runCatching {
+    providers
+        .exec {
+            commandLine("pkg-config", "--variable=$variable", "dbus-1")
+            isIgnoreExitValue = true
+        }.standardOutput
+        .asText
+        .get()
+        .trim()
+}.getOrNull()?.takeIf { it.isNotEmpty() }
+
 jvmTest.configure {
     dependsOn(headlessAwtFilePickerTest)
 }
@@ -38,6 +67,42 @@ kotlin {
         }
     }
 
+    // Keep targets and cinterops identical on every host so publication metadata includes Linux.
+    // Cross-compilation uses Linux headers staged by CI; native Linux builds use pkg-config.
+    val dbusHeaders = providers.gradleProperty("filekit.dbusHeaders").orNull
+    val dbusCompilerOpts = when {
+        dbusHeaders != null -> arrayOf("-I${rootProject.file(dbusHeaders).absolutePath}")
+        HostManager.hostIsLinux -> resolvePkgConfigArgs("--cflags")
+        else -> emptyArray()
+    }
+    val dbusLibDir = if (HostManager.hostIsLinux) resolvePkgConfigVariable("libdir") else null
+
+    listOf(linuxX64(), linuxArm64()).forEach { target ->
+        // Linux test executables need Linux runtime libraries and cannot run on other hosts.
+        target.binaries.withType<TestExecutable>().configureEach {
+            linkTaskProvider.configure { enabled = HostManager.hostIsLinux }
+        }
+        dbusLibDir?.let { libDir -> target.binaries.configureEach { linkerOpts("-L$libDir") } }
+        // Tests reuse main's bindings; generating either interop twice duplicates native symbols.
+        target.compilations.getByName("main") {
+            cinterops {
+                create("process") {
+                    defFile(project.file("src/linuxMain/cinterop/process.def"))
+                }
+                create("dbus") {
+                    defFile(project.file("src/linuxMain/cinterop/dbus.def"))
+                    compilerOpts(*dbusCompilerOpts)
+                }
+            }
+        }
+    }
+
+    sourceSets {
+        // Shared metadata cannot see target cinterop bindings.
+        getByName("linuxX64Main") { kotlin.srcDir("src/linuxDbusMain/kotlin") }
+        getByName("linuxArm64Main") { kotlin.srcDir("src/linuxDbusMain/kotlin") }
+    }
+
     sourceSets {
         commonMain.dependencies {
             api(projects.filekitCore)
```

---

### Incident Patch 2: `9f34bef9` (2026-09-07)
**Commit Message**: 🔀 Merge pull request #641 from anggrayudi/fix/640-delete-non-empty-folders

✨ Add recursive delete for non-empty directories

**File**: `AGENTS.md` (modified, +7/-3)
```diff
@@ -4,18 +4,22 @@
 FileKit is split across multiplatform modules: `filekit-core` contains platform-agnostic APIs, while dialogs, Compose bindings, and Coil integration live in `filekit-dialogs`, `filekit-dialogs-compose`, and `filekit-coil`. Shared source sets live under `src/*Main`, with platform tests in sibling `src/*Test` directories. Sample apps under `samples/` (`sample-core`, `sample-compose`, `sample-file-explorer`) demonstrate integration patterns; update them alongside library changes when user-facing behaviour shifts. API docs and release notes are tracked in `docs/` and `documentation-v0.8.8.md`.
 
 ## Build, Test, and Development Commands
-Use `./gradlew assemble` to ensure all published artifacts compile before raising a PR. Run `./gradlew :filekit-core:check :filekit-dialogs:check` to execute the multiplatform test matrix for the primary modules. Sample apps can be exercised with `./gradlew :samples:sample-compose:composeApp:run` (desktop) or by opening the Gradle targets in Android Studio for mobile builds. For smoke testing local publishing, run `./gradlew publishToMavenLocal` and consume the artifacts from a sample project.
+Keep local validation scoped to the changed module and one relevant target, with `--max-workers=1`; run checks sequentially. For example, use `./gradlew :filekit-core:jvmTest --tests '*PlatformFileDeletionTest*' --max-workers=1` for a deletion regression.
+
+**Never run repository-wide `./gradlew assemble`, `./gradlew check`, or `./gradlew build` locally**, alone or combined. They overload the maintainer's Mac. Leave broad builds and multiplatform test matrices, including module-level aggregate `check` tasks, to CI; do not use them as a fallback when a targeted check fails. Report the targeted checks run and any validation left to CI.
+
+Exercise sample apps only when needed for the change. For local publishing smoke tests, scope publishing to the required module and platform instead of publishing every artifact.
 
 For Kotlin formatting/linting, run `ktlint '**/*.kt' '**/*.kts' '!**/build/**' -R ktlint-compose-0.4.28-all.jar`. To auto-fix issues, add `--format` to that command.
 
 ## Coding Style & Naming Conventions
 Follow Kotlin official style: four-space indentation, trailing commas where helpful, and `UpperCamelCase` for public APIs. Keep expect/actual implementations mirrored across targets and group platform-specific helpers under the corresponding `src/<platform>Main` directory. Compose functions remain PascalCase and should take a `modifier` parameter when rendering UI. Prefer descriptive file names that match the primary type, and keep shared constants in `commonMain` to minimise duplication.
 
 ## Testing Guidelines
-Add unit tests in the closest `src/<target>Test` directory; default to `commonTest` when behaviour is shared and mirror target-specific coverage otherwise. Test names follow the `Subject_action_expectation` convention (e.g., `FilePicker_openDirectory_returnsFolder`). Run `./gradlew check` locally before every push and ensure new features include regression coverage for at least one non-JVM target. When behaviour depends on native APIs, document manual verification steps in the PR description.
+Add unit tests in the closest `src/<target>Test` directory; default to `commonTest` when behaviour is shared and mirror target-specific coverage otherwise. Test names follow the `Subject_action_expectation` convention (e.g., `FilePicker_openDirectory_returnsFolder`). Before pushing, run the relevant targeted checks under the local validation limits above, and ensure new features include regression coverage for at least one non-JVM target. When behaviour depends on native APIs, document manual verification steps in the PR description.
 
 ## Commit & Pull Request Guidelines
-Commits are short, imperative statements and often begin with an emoji category (e.g., `✨ Add WASM picker`); keep related changes squashed together. Each PR should describe the change, note affected platforms, call out doc updates, and link issues or discussions when relevant. Attach screenshots or screen recordings when UI behaviour changes. Before requesting review, verify CI-critical tasks (`assemble`, `check`), update sample apps if behaviour shifts, and note any follow-up work in the description.
+Commits are short, imperative statements and often begin with an emoji category (e.g., `✨ Add WASM picker`); keep related changes squashed together. Each PR should describe the change, note affected platforms, call out doc updates, and link issues or discussions when relevant. Attach screenshots or screen recordings when UI behaviour changes. Before requesting review, report targeted validation and CI status, update sample apps if behaviour shifts, and note any follow-up work in the description.
 
 ## Agent skills
 
```

**File**: `docs/core/write-file.mdx` (modified, +13/-0)
```diff
@@ -120,6 +120,19 @@ file.delete()
 file.delete(mustExist = false)
 ```
 
+To delete a directory and its contents, opt into recursive deletion:
+
+```kotlin
+val directory = PlatformFile(FileKit.cacheDir, "temporary-downloads")
+directory.delete(recursively = true)
+```
+
+For filesystem paths, `recursively` defaults to `false`, so deleting a non-empty
+directory fails unless you enable it. Symbolic links (including dangling links)
+and Windows directory junctions are removed as links; their targets are left
+untouched. Android document URIs continue to use the document provider's deletion
+behavior.
+
 ## Creating Directories
 
 Before writing to a file, you may need to ensure its parent directory exists:
```

**File**: `filekit-core/src/androidHostTest/kotlin/io/github/vinceglb/filekit/PlatformFileDeletionTest.kt` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+@file:Suppress("ktlint:standard:function-naming", "TestFunctionName")
+
+package io.github.vinceglb.filekit
+
+import android.system.ErrnoException
+import android.system.Os
+import android.system.OsConstants
+import android.system.StructStat
+import kotlinx.coroutines.test.runTest
+import org.junit.runner.RunWith
+import org.robolectric.RobolectricTestRunner
+import org.robolectric.annotation.Config
+import org.robolectric.annotation.Implementation
+import org.robolectric.annotation.Implements
+import java.nio.file.Files
+import java.nio.file.LinkOption.NOFOLLOW_LINKS
+import java.nio.file.NoSuchFileException
+import java.nio.file.Paths
+import java.nio.file.attribute.BasicFileAttributes
+import kotlin.io.path.createDirectory
+import kotlin.io.path.createTempDirectory
+import kotlin.io.path.exists
+import kotlin.io.path.readText
+import kotlin.io.path.writeText
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertFalse
+
+@RunWith(RobolectricTestRunner::class)
+@Config(sdk = [23, 36], shadows = [NoFollowOsShadow::class])
+class PlatformFileDeletionTest {
+    @Test
+    fun PlatformFile_deleteRecursively_links_areUnlinkedWithoutFollowingTargets() = runTest {
+        val root = createTempDirectory("filekit-delete-links")
+        val outside = root.resolve("outside").createDirectory()
+        val treasure = outside.resolve("treasure.txt")
+        treasure.writeText("must survive")
+        val doomed = root.resolve("doomed").createDirectory()
+        val dangling = Files.createSymbolicLink(doomed.resolve("dangling"), doomed.resolve("missing"))
+        val link = Files.createSymbolicLink(doomed.resolve("outside"), outside)
+        try {
+            PlatformFile(doomed.toFile()).delete(recursively = true)
+
+            assertFalse(doomed.exists(NOFOLLOW_LINKS))
+            assertEquals("must survive", treasure.readText())
+        } finally {
+            Files.deleteIfExists(dangling)
+            Files.deleteIfExists(link)
+            root.toFile().deleteRecursively()
+        }
+    }
+}
+
+// Robolectric's default lstat delegates to stat and follows directory links. Supply the native
+// no-follow contract using the host filesystem so this test can catch traversal into a target.
+@Implements(Os::class)
+class NoFollowOsShadow {
+    companion object {
+        @JvmStatic
+        @Implementation
+        fun lstat(path: String): StructStat {
+            val attributes = try {
+                Files.readAttributes(Paths.get(path), BasicFileAttributes::class.java, NOFOLLOW_LINKS)
+            } catch (error: NoSuchFileException) {
+                throw ErrnoException("lstat", OsConstants.ENOENT, error)
+            }
+            val mode = when {
+                attributes.isSymbolicLink -> OsConstants.S_IFLNK
+                attributes.isDirectory -> OsConstants.S_IFDIR
+                else -> OsConstants.S_IFREG
+            }
+            return StructStat(0, 0, mode, 0, 0, 0, 0, attributes.size(), 0, 0, 0, 0, 0)
+        }
+
+        @JvmStatic
+        @Implementation
+        fun remove(path: String) {
+            Files.delete(Paths.get(path))
+        }
+    }
+}
```

**File**: `filekit-core/src/androidHostTest/kotlin/io/github/vinceglb/filekit/PlatformFileTestBase.kt` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+package io.github.vinceglb.filekit
+
+import org.junit.runner.RunWith
+import org.robolectric.RobolectricTestRunner
+import org.robolectric.annotation.Config
+
+@RunWith(RobolectricTestRunner::class)
+@Config(sdk = [36])
+actual abstract class PlatformFileTestBase actual constructor()
```

**File**: `filekit-core/src/androidMain/kotlin/io/github/vinceglb/filekit/PlatformFile.android.kt` (modified, +33/-5)
```diff
@@ -8,6 +8,9 @@ import android.os.ParcelFileDescriptor
 import android.provider.DocumentsContract
 import android.provider.MediaStore
 import android.provider.OpenableColumns
+import android.system.ErrnoException
+import android.system.Os
+import android.system.OsConstants
 import android.webkit.MimeTypeMap
 import androidx.documentfile.provider.DocumentFile
 import io.github.vinceglb.filekit.exceptions.FileKitException
@@ -17,6 +20,7 @@ import io.github.vinceglb.filekit.utils.div
 import io.github.vinceglb.filekit.utils.toKotlinxPath
 import kotlinx.coroutines.Dispatchers
 import kotlinx.coroutines.withContext
+import kotlinx.io.IOException
 import kotlinx.io.RawSink
 import kotlinx.io.RawSource
 import kotlinx.io.asSink
@@ -449,16 +453,21 @@ private fun PlatformFile.resolveAtomicMoveDestination(source: PlatformFile): Pla
     return this
 }
 
-public actual suspend fun PlatformFile.delete(mustExist: Boolean): Unit =
+public actual suspend fun PlatformFile.delete(mustExist: Boolean, recursively: Boolean): Unit =
     withContext(Dispatchers.IO) {
         when (androidFile) {
             is AndroidFile.FileWrapper -> {
-                SystemFileSystem.delete(
-                    path = toKotlinxIoPath(),
-                    mustExist = mustExist,
-                )
+                if (!deleteIfSymbolicLink()) {
+                    if (recursively) deleteChildren()
+                    SystemFileSystem.delete(
+                        path = toKotlinxIoPath(),
+                        mustExist = mustExist,
+                    )
+                }
             }
 
+            // No recursion here: SAF has no empty-directory rule to work around. Removing a
+            // document is the provider's job, and DocumentsContract takes the subtree with it.
             is AndroidFile.UriWrapper -> {
                 val documentFile = DocumentFile.fromSingleUri(FileKit.context, androidFile.uri)
                     ?: throw FileKitException("Could not access Uri as DocumentFile")
@@ -1143,3 +1152,22 @@ private fun Uri.toFileOrNull(): File? {
     val filePath = path ?: return null
     return File(filePath)
 }
+
+// lstat/remove work on API 21 and operate on the link itself, including a dangling link.
+internal actual fun PlatformFile.deleteIfSymbolicLink(): Boolean {
+    val file = (androidFile as? AndroidFile.FileWrapper)?.file ?: return false
+    val metadata = try {
+        Os.lstat(file.absolutePath)
+    } catch (error: ErrnoException) {
+        if (error.errno == OsConstants.ENOENT || error.errno == OsConstants.ENOTDIR) return false
+        throw IOException("Could not inspect ${file.absolutePath}", error)
+    }
+    if (!OsConstants.S_ISLNK(metadata.st_mode)) return false
+
+    try {
+        Os.remove(file.absolutePath)
+    } catch (error: ErrnoException) {
+        throw IOException("Could not unlink ${file.absolutePath}", error)
+    }
+    return true
+}
```

**File**: `filekit-core/src/appleMain/kotlin/io/github/vinceglb/filekit/PlatformFile.apple.kt` (modified, +21/-0)
```diff
@@ -24,6 +24,7 @@ import kotlinx.cinterop.value
 import kotlinx.coroutines.Dispatchers
 import kotlinx.coroutines.IO
 import kotlinx.coroutines.withContext
+import kotlinx.io.IOException
 import kotlinx.io.files.Path
 import kotlinx.io.files.SystemFileSystem
 import kotlinx.serialization.Serializable
@@ -39,6 +40,9 @@ import platform.CoreServices.UTTypeCopyPreferredTagWithClass
 import platform.CoreServices.kUTTagClassMIMEType
 import platform.Foundation.NSDate
 import platform.Foundation.NSError
+import platform.Foundation.NSFileManager
+import platform.Foundation.NSFileType
+import platform.Foundation.NSFileTypeSymbolicLink
 import platform.Foundation.NSLock
 import platform.Foundation.NSURL
 import platform.Foundation.NSURLContentModificationDateKey
@@ -48,8 +52,11 @@ import platform.Foundation.NSURLResourceKey
 import platform.Foundation.NSURLTypeIdentifierKey
 import platform.Foundation.timeIntervalSince1970
 import platform.UniformTypeIdentifiers.UTType
+import platform.posix.errno
 import platform.posix.free
 import platform.posix.realpath
+import platform.posix.strerror
+import platform.posix.unlink
 import kotlin.time.ExperimentalTime
 import kotlin.time.Instant
 
@@ -424,3 +431,17 @@ private fun NSError?.toBookmarkResolutionException(): BookmarkResolutionExceptio
     reason = classifyAppleBookmarkResolutionError(this),
     message = "Failed to resolve bookmark data: $this",
 )
+
+// attributesOfItemAtPath does not resolve the link, so a symlink reports its own type here rather
+// than the type of whatever it points at.
+@OptIn(ExperimentalForeignApi::class)
+internal actual fun PlatformFile.deleteIfSymbolicLink(): Boolean {
+    val path = nsUrl.path ?: return false
+    val attributes = NSFileManager.defaultManager.attributesOfItemAtPath(path, error = null)
+    if (attributes?.get(NSFileType) != NSFileTypeSymbolicLink) return false
+
+    if (unlink(path) != 0) {
+        throw IOException("Could not unlink $path: ${strerror(errno)?.toKString()}")
+    }
+    return true
+}
```

**File**: `filekit-core/src/appleTest/kotlin/io/github/vinceglb/filekit/PlatformFileDeletionTest.kt` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)
+@file:Suppress("ktlint:standard:function-naming", "TestFunctionName")
+
+package io.github.vinceglb.filekit
+
+import kotlinx.coroutines.test.runTest
+import kotlinx.io.files.SystemTemporaryDirectory
+import platform.posix.symlink
+import platform.posix.unlink
+import kotlin.random.Random
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertFalse
+
+class PlatformFileDeletionTest {
+    @Test
+    fun PlatformFile_delete_danglingLink_isUnlinked() = runTest {
+        val root = PlatformFile(SystemTemporaryDirectory) / "filekit-delete-link-${Random.nextInt(0, Int.MAX_VALUE)}"
+        root.createDirectories()
+        val link = root / "link"
+        try {
+            for (recursively in listOf(false, true)) {
+                for (mustExist in listOf(false, true)) {
+                    assertEquals(0, symlink("missing", link.path))
+
+                    link.delete(mustExist, recursively)
+
+                    assertEquals(emptyList(), root.list(), "The dangling link must be unlinked")
+                }
+            }
+        } finally {
+            unlink(link.path)
+            root.delete(mustExist = false)
+        }
+    }
+
+    @Test
+    fun PlatformFile_deleteRecursively_links_areUnlinkedWithoutFollowingTargets() = runTest {
+        val root = PlatformFile(SystemTemporaryDirectory) / "filekit-delete-tree-${Random.nextInt(0, Int.MAX_VALUE)}"
+        val outside = root / "outside"
+        outside.createDirectories()
+        val treasure = outside / "treasure.txt"
+        treasure.writeString("must survive")
+        val doomed = root / "doomed"
+        doomed.createDirectories()
+        val links = listOf(doomed / "dangling", doomed / "cycle", doomed / "outside")
+        try {
+            assertEquals(0, symlink("missing", links[0].path))
+            assertEquals(0, symlink("cycle", links[1].path))
+            assertEquals(0, symlink(outside.path, links[2].path))
+
+            doomed.delete(recursively = true)
+
+            assertFalse(doomed.exists())
+            assertEquals("must survive", treasure.readString())
+        } finally {
+            links.forEach { unlink(it.path) }
+            doomed.delete(mustExist = false)
+            treasure.delete(mustExist = false)
+            outside.delete(mustExist = false)
+            root.delete(mustExist = false)
+        }
+    }
+}
```

**File**: `filekit-core/src/jvmAndNativeMain/kotlin/io/github/vinceglb/filekit/PlatformFile.jvmAndNative.kt` (modified, +5/-2)
```diff
@@ -79,10 +79,13 @@ public actual fun PlatformFile.createDirectories(mustCreate: Boolean): Unit =
         SystemFileSystem.createDirectories(toKotlinxIoPath(), mustCreate)
     }
 
-public actual suspend fun PlatformFile.delete(mustExist: Boolean): Unit =
+public actual suspend fun PlatformFile.delete(mustExist: Boolean, recursively: Boolean): Unit =
     withScopedAccess {
         withContext(Dispatchers.IO) {
-            SystemFileSystem.delete(path = toKotlinxIoPath(), mustExist = mustExist)
+            if (!deleteIfSymbolicLink()) {
+                if (recursively) deleteChildren()
+                SystemFileSystem.delete(path = toKotlinxIoPath(), mustExist = mustExist)
+            }
         }
     }
 
```

---

### Incident Patch 3: `c6e30c7e` (2026-09-07)
**Commit Message**: 🐛 Reuse main D-Bus bindings in Linux tests

**File**: `filekit-dialogs/build.gradle.kts` (modified, +9/-13)
```diff
@@ -83,19 +83,15 @@ kotlin {
             linkTaskProvider.configure { enabled = HostManager.hostIsLinux }
         }
         dbusLibDir?.let { libDir -> target.binaries.configureEach { linkerOpts("-L$libDir") } }
-        listOf("main", "test").forEach { compilationName ->
-            target.compilations.getByName(compilationName) {
-                cinterops {
-                    // Tests call the Kotlin wrapper and must not link a second copy of the C helper.
-                    if (compilationName == "main") {
-                        create("process") {
-                            defFile(project.file("src/linuxMain/cinterop/process.def"))
-                        }
-                    }
-                    create("dbus") {
-                        defFile(project.file("src/linuxMain/cinterop/dbus.def"))
-                        compilerOpts(*dbusCompilerOpts)
-                    }
+        // Tests reuse main's bindings; generating either interop twice duplicates native symbols.
+        target.compilations.getByName("main") {
+            cinterops {
+                create("process") {
+                    defFile(project.file("src/linuxMain/cinterop/process.def"))
+                }
+                create("dbus") {
+                    defFile(project.file("src/linuxMain/cinterop/dbus.def"))
+                    compilerOpts(*dbusCompilerOpts)
                 }
             }
         }
```

---

### Incident Patch 4: `9397af5f` (2026-09-07)
**Commit Message**: 🔀 Merge main into Linux native picker branch

**File**: `.github/workflows/ci.yml` (modified, +55/-27)
```diff
@@ -13,18 +13,34 @@ jobs:
   linux-dbus-headers:
     uses: ./.github/workflows/linux-dbus-headers.yaml
 
-  build:
-    name: 💆‍♀️ Build FileKit
+  build-modules:
+    name: 🔨 Build ${{ matrix.name }}
+    strategy:
+      fail-fast: false
+      matrix:
+        include:
+          - name: Libraries
+            tasks: :filekit-core:assemble :filekit-dialogs:assemble :filekit-dialogs-compose:assemble :filekit-coil:assemble
+          - name: Shared sample
+            tasks: :sample:shared:assemble
+          - name: Web sample
+            tasks: :sample:webApp:assemble
+          - name: Android sample
+            tasks: :sample:androidApp:assemble
+          - name: Desktop samples
+            tasks: :sample:desktopApp:assemble :sample:nucleusApp:assemble
+          - name: Windows native sample
+            tasks: :sample:windowsNativeApp:assemble
     runs-on: ubuntu-latest
     steps:
       - name: 🛎️ Check out repository
-        uses: actions/checkout@v6
+        uses: actions/checkout@v7
 
       - name: 🔧 Install Linux dialog dependencies
         run: sudo apt-get update && sudo apt-get install -y libdbus-1-dev
 
       - name: 🍉 Configure JDK 21
-        uses: actions/setup-java@v5
+        uses: actions/setup-java@v6
         with:
           distribution: 'temurin'
           java-version: '21'
@@ -33,21 +49,25 @@ jobs:
         uses: gradle/actions/setup-gradle@v6
 
       - name: 🔨 Build project
-        run: ./gradlew assemble
+        shell: bash
+        env:
+          BUILD_TASKS: ${{ matrix.tasks }}
+        run: |
+          read -r -a build_tasks <<< "$BUILD_TASKS"
+          ./gradlew "${build_tasks[@]}" --max-workers=2
 
   test-desktop:
     name: 🖥️ Test Desktop
-    needs: build
     strategy:
       matrix:
         os: [ubuntu-latest, windows-latest, macos-26]
     runs-on: ${{ matrix.os }}
     steps:
       - name: 🛎️ Check out repository
-        uses: actions/checkout@v6
+        uses: actions/checkout@v7
 
       - name: 🍉 Configure JDK 21
-        uses: actions/setup-java@v5
+        uses: actions/setup-java@v6
         with:
           distribution: 'temurin'
           java-version: '21'
@@ -60,14 +80,13 @@ jobs:
 
   test-android:
     name: 🤖 Test Android
-    needs: build
     runs-on: ubuntu-latest
     steps:
       - name: 🛎️ Check out repository
-        uses: actions/checkout@v6
+        uses: actions/checkout@v7
 
       - name: 🍉 Configure JDK 21
-        uses: actions/setup-java@v5
+        uses: actions/setup-java@v6
         with:
           distribution: 'temurin'
           java-version: '21'
@@ -80,14 +99,13 @@ jobs:
 
   test-ios:
     name: 🍎 Test iOS
-    needs: build
     runs-on: macos-26
     steps:
       - name: 🛎️ Check out repository
-        uses: actions/checkout@v6
+        uses: actions/checkout@v7
 
       - name: 🍉 Configure JDK 21
-        uses: actions/setup-java@v5
+        uses: actions/setup-java@v6
         with:
           distribution: 'temurin'
           java-version: '21'
@@ -100,14 +118,13 @@ jobs:
 
   test-watchos:
     name: ⌚️ Test watchOS
-    needs: build
     runs-on: macos-26
     steps:
       - name: 🛎️ Check out repository
-        uses: actions/checkout@v6
+        uses: actions/checkout@v7
 
       - name: 🍉 Configure JDK 21
-        uses: actions/setup-java@v5
+        uses: actions/setup-java@v6
         with:
           distribution: 'temurin'
           java-version: '21'
@@ -120,14 +137,13 @@ jobs:
 
   test-macos:
     name: 🍏 Test macOS
-    needs: build
     runs-on: macos-26
     steps:
       - name: 🛎️ Check out repository
-        uses: actions/checkout@v6
+        uses: actions/checkout@v7
 
       - name: 🍉 Configure JDK 21
-        uses: actions/setup-java@v5
+        uses: actions/setup-java@v6
         with:
           distribution: 'temurin'
           java-version: '21'
@@ -142,17 +158,16 @@ jobs:
 
   test-linux:
     name: 🐧 Test Linux
-    needs: build
     runs-on: ubuntu-latest
     steps:
       - name: 🛎️ Check out repository
-        uses: actions/checkout@v6
+        uses: actions/checkout@v7
 
       - name: 🔧 Install Linux dialog dependencies
         run: sudo apt-get update && sudo apt-get install -y libdbus-1-dev dbus
 
       - name: 🍉 Configure JDK 21
-        uses: actions/setup-java@v5
+        uses: actions/setup-java@v6
         with:
           distribution: 'temurin'
           java-version: '21'
@@ -199,10 +214,10 @@ jobs:
     runs-on: ubuntu-latest
     steps:
       - name: 🛎️ Check out repository
-        uses: actions/checkout@v6
+        uses: actions/checkout@v7
 
       - name: 🍉 Configure JDK 21
-        uses: actions/setup-java@v5
+        uses: actions/setup-java@v6
         with:
           distribution: 'temurin'
           java-version: '21'
@@ -214,7 +229,20 @@ jobs:
           sudo mv ktlint /usr/local/bin/
 
       - name: 👮 Download ktlint-compose rules
-        run: curl -sSLO https://github.com/mrmans0n/compose-rules/rel
```

**File**: `.github/workflows/deploy-preview.yaml` (modified, +2/-2)
```diff
@@ -11,10 +11,10 @@ jobs:
     runs-on: ubuntu-latest
     steps:
       - name: Checkout
-        uses: actions/checkout@v6
+        uses: actions/checkout@v7
 
       - name: Configure JDK
-        uses: actions/setup-java@v5
+        uses: actions/setup-java@v6
         with:
           distribution: 'temurin'
           java-version: '17'
```

**File**: `.github/workflows/publish-snapshot.yaml` (modified, +3/-3)
```diff
@@ -16,7 +16,7 @@ jobs:
       is_snapshot: ${{ steps.check_snapshot.outputs.is_snapshot }}
     steps:
       - name: Check out repository
-        uses: actions/checkout@v6
+        uses: actions/checkout@v7
 
       - name: Check for SNAPSHOT suffix
         id: check_snapshot
@@ -35,10 +35,10 @@ jobs:
     if: ${{ needs.check-version.outputs.is_snapshot == 'true' }}
     steps:
       - name: Checkout
-        uses: actions/checkout@v6
+        uses: actions/checkout@v7
 
       - name: Configure JDK
-        uses: actions/setup-java@v5
+        uses: actions/setup-java@v6
         with:
           distribution: 'temurin'
           java-version: '17'
```

**File**: `.github/workflows/publish.yaml` (modified, +2/-2)
```diff
@@ -16,10 +16,10 @@ jobs:
     runs-on: macos-26
     steps:
       - name: Checkout
-        uses: actions/checkout@v6
+        uses: actions/checkout@v7
 
       - name: Configure JDK
-        uses: actions/setup-java@v5
+        uses: actions/setup-java@v6
         with:
           distribution: 'temurin'
           java-version: '17'
```

**File**: `filekit-dialogs/src/iosMain/kotlin/io/github/vinceglb/filekit/dialogs/FileKit.ios.kt` (modified, +64/-37)
```diff
@@ -7,6 +7,7 @@ import io.github.vinceglb.filekit.dialogs.FileKitDialog.documentPickerDelegate
 import io.github.vinceglb.filekit.dialogs.FileKitDialog.phPickerDelegate
 import io.github.vinceglb.filekit.dialogs.FileKitDialog.phPickerDismissDelegate
 import io.github.vinceglb.filekit.dialogs.util.CameraControllerDelegate
+import io.github.vinceglb.filekit.dialogs.util.CameraPresenterWindow
 import io.github.vinceglb.filekit.dialogs.util.DocumentPickerDelegate
 import io.github.vinceglb.filekit.dialogs.util.PhPickerDelegate
 import io.github.vinceglb.filekit.dialogs.util.PhPickerDismissDelegate
@@ -287,37 +288,45 @@ public actual suspend fun FileKit.openCameraPicker(
                 null
             }
         }
-        val presentation = prepareAppleCameraPresentation(
-            sourceAvailable = UIImagePickerController.isSourceTypeAvailable(cameraSource),
-            presenter = openCameraSettings.presenterViewController(),
-            requestedCamera = requestedCamera,
-        )
-
-        suspendCancellableCoroutine<UIImage?> { continuation ->
-            cameraControllerDelegate = CameraControllerDelegate(
-                onImagePicked = { image ->
-                    try {
-                        continuation.resume(
-                            requireAppleCameraImage(image),
-                        )
-                    } catch (failure: FileKitDialogException) {
-                        continuation.resumeWithException(failure)
-                    }
-                },
-                onPickerCancelled = { continuation.resume(null) },
+        val presenterWindow = when (openCameraSettings.presenter) {
+            null -> CameraPresenterWindow()
+            else -> null
+        }
+        try {
+            val presentation = prepareAppleCameraPresentation(
+                sourceAvailable = UIImagePickerController.isSourceTypeAvailable(cameraSource),
+                presenter = openCameraSettings.presenter ?: presenterWindow?.attach(),
+                requestedCamera = requestedCamera,
             )
 
-            val pickerController = UIImagePickerController()
-            pickerController.sourceType = cameraSource
-            pickerController.delegate = cameraControllerDelegate
+            suspendCancellableCoroutine<UIImage?> { continuation ->
+                cameraControllerDelegate = CameraControllerDelegate(
+                    onImagePicked = { image ->
+                        try {
+                            continuation.resume(
+                                requireAppleCameraImage(image),
+                            )
+                        } catch (failure: FileKitDialogException) {
+                            continuation.resumeWithException(failure)
+                        }
+                    },
+                    onPickerCancelled = { continuation.resume(null) },
+                )
+
+                val pickerController = UIImagePickerController()
+                pickerController.sourceType = cameraSource
+                pickerController.delegate = cameraControllerDelegate
 
-            presentation.cameraDevice?.let { pickerController.cameraDevice = it }
+                presentation.cameraDevice?.let { pickerController.cameraDevice = it }
 
-            presentation.presenter.presentViewController(
-                pickerController,
-                animated = true,
-                completion = null,
-            )
+                presentation.presenter.presentViewController(
+                    pickerController,
+                    animated = true,
+                    completion = null,
+                )
+            }
+        } finally {
+            presenterWindow?.detach()
         }
     } ?: return null
 
@@ -525,9 +534,6 @@ private fun FileKitDialogSettings.presenterViewController(
     activeViewController: () -> UIViewController? = ::activeAppleViewController,
 ): UIViewController? = presenter ?: activeViewController()
 
-private fun FileKitOpenCameraSettings.presenterViewController(): UIViewController? =
-    presenter ?: UIApplication.sharedApplication.topMostViewController()
-
 private fun FileKitShareSettings.presenterViewController(): UIViewController? =
     presenter ?: UIApplication.sharedApplication.topMostViewController()
 
@@ -720,7 +726,12 @@ private fun callPhPicker(
                                 else -> {
                                     // Must copy the URL here because it becomes invalid outside the loadFileRepresentationForTypeIdentifier callback scope
                                     runCatching {
-                                        copyToTempFile(fileManager, url, tempRoot.lastPathComponent!!)
+                                        copyToTempFile(
+                                            fileManager = fileManager,
+                                            url = url,
+                                            id = tempRoot.lastPathComponent!!,
+                               
```

**File**: `filekit-dialogs/src/iosMain/kotlin/io/github/vinceglb/filekit/dialogs/FileKitOpenCameraSettings.ios.kt` (modified, +4/-1)
```diff
@@ -5,7 +5,10 @@ import platform.UIKit.UIViewController
 /**
  * iOS implementation of [FileKitOpenCameraSettings].
  *
- * @property presenter The view controller used to present the camera picker.
+ * @property presenter The view controller used to present the camera picker. When null, FileKit
+ * presents the camera from a dedicated window placed above the app's windows, which keeps the
+ * picker compatible with hosts whose dialogs live in their own window, such as Compose
+ * Multiplatform 1.11+.
  */
 public actual class FileKitOpenCameraSettings(
     public val presenter: UIViewController? = null,
```

**File**: `filekit-dialogs/src/iosMain/kotlin/io/github/vinceglb/filekit/dialogs/util/CameraPresenterWindow.kt` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+package io.github.vinceglb.filekit.dialogs.util
+
+import kotlinx.cinterop.ExperimentalForeignApi
+import platform.UIKit.UIApplication
+import platform.UIKit.UIColor
+import platform.UIKit.UISceneActivationStateForegroundActive
+import platform.UIKit.UIViewController
+import platform.UIKit.UIWindow
+import platform.UIKit.UIWindowLevelAlert
+import platform.UIKit.UIWindowScene
+
+/**
+ * Hosts the camera presentation in a dedicated transparent [UIWindow].
+ *
+ * Since Compose Multiplatform 1.11, Compose dialogs and popups live in their own window placed
+ * above modally presented view controllers. Presenting the fullscreen camera from the top-most
+ * view controller of the main window puts it underneath such windows, which corrupts touch
+ * handling app-wide after the dismissal. Presenting from a dedicated key window above alerts
+ * avoids that; the previous key window is restored once the capture flow finishes.
+ */
+internal class CameraPresenterWindow {
+    private val hostViewController = UIViewController()
+    private var window: UIWindow? = null
+    private var previousKeyWindow: UIWindow? = null
+
+    @OptIn(ExperimentalForeignApi::class)
+    fun attach(): UIViewController? {
+        val application = UIApplication.sharedApplication
+        val scene = application.connectedScenes
+            .filterIsInstance<UIWindowScene>()
+            .firstOrNull { it.activationState == UISceneActivationStateForegroundActive }
+            ?: return null
+        previousKeyWindow = scene.keyWindow
+        val newWindow = UIWindow(windowScene = scene)
+        newWindow.rootViewController = hostViewController
+        newWindow.windowLevel = UIWindowLevelAlert + 1.0
+        newWindow.backgroundColor = UIColor.clearColor
+        newWindow.makeKeyAndVisible()
+        window = newWindow
+        return hostViewController
+    }
+
+    fun detach() {
+        window?.setHidden(true)
+        window?.rootViewController = null
+        window = null
+        previousKeyWindow?.makeKeyAndVisible()
+        previousKeyWindow = null
+    }
+}
```

**File**: `filekit-dialogs/src/iosTest/kotlin/io/github/vinceglb/filekit/dialogs/ApplePickerTempFileTest.kt` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+@file:Suppress("ktlint:standard:function-naming", "TestFunctionName")
+
+package io.github.vinceglb.filekit.dialogs
+
+import io.github.vinceglb.filekit.utils.toByteArray
+import io.github.vinceglb.filekit.utils.toNSData
+import kotlinx.cinterop.ExperimentalForeignApi
+import platform.Foundation.NSFileManager
+import platform.Foundation.NSUUID
+import platform.Foundation.temporaryDirectory
+import kotlin.test.Test
+import kotlin.test.assertContentEquals
+import kotlin.test.assertEquals
+import kotlin.test.assertNotEquals
+import kotlin.test.assertNotNull
+import kotlin.test.assertTrue
+
+@OptIn(ExperimentalForeignApi::class)
+class ApplePickerTempFileTest {
+    @Test
+    fun ApplePicker_sameFilename_preservesBothFilesAndContents() {
+        val fileManager = NSFileManager.defaultManager
+        val id = NSUUID().UUIDString
+        val root = assertNotNull(fileManager.temporaryDirectory.URLByAppendingPathComponent(id))
+        val contents = listOf(byteArrayOf(1, 2, 3), byteArrayOf(4, 5, 6))
+
+        try {
+            val sources = contents.mapIndexed { index, bytes ->
+                val directory = assertNotNull(root.URLByAppendingPathComponent("source-$index"))
+                assertTrue(fileManager.createDirectoryAtURL(directory, true, null, null))
+                val source = assertNotNull(directory.URLByAppendingPathComponent("image.jpeg"))
+                assertTrue(fileManager.createFileAtPath(assertNotNull(source.path), bytes.toNSData(), null))
+                source
+            }
+
+            val copies = sources.mapIndexed { index, source ->
+                copyToTempFile(fileManager, source, id, index)
+            }
+
+            assertNotEquals(copies[0].path, copies[1].path)
+            copies.forEachIndexed { index, copy ->
+                assertEquals("image.jpeg", copy.lastPathComponent)
+                val data = assertNotNull(fileManager.contentsAtPath(assertNotNull(copy.path)))
+                assertContentEquals(contents[index], data.toByteArray())
+            }
+        } finally {
+            fileManager.removeItemAtURL(root, null)
+        }
+    }
+}
```

---

### Incident Patch 5: `c19bea00` (2026-09-07)
**Commit Message**: 🔀 Merge pull request #639 from PierreVieira/fix/camera-default-presenter-window

🐛 [iOS] Present the camera from a dedicated window by default

**File**: `filekit-dialogs/src/iosMain/kotlin/io/github/vinceglb/filekit/dialogs/FileKit.ios.kt` (modified, +36/-30)
```diff
@@ -7,6 +7,7 @@ import io.github.vinceglb.filekit.dialogs.FileKitDialog.documentPickerDelegate
 import io.github.vinceglb.filekit.dialogs.FileKitDialog.phPickerDelegate
 import io.github.vinceglb.filekit.dialogs.FileKitDialog.phPickerDismissDelegate
 import io.github.vinceglb.filekit.dialogs.util.CameraControllerDelegate
+import io.github.vinceglb.filekit.dialogs.util.CameraPresenterWindow
 import io.github.vinceglb.filekit.dialogs.util.DocumentPickerDelegate
 import io.github.vinceglb.filekit.dialogs.util.PhPickerDelegate
 import io.github.vinceglb.filekit.dialogs.util.PhPickerDismissDelegate
@@ -287,37 +288,45 @@ public actual suspend fun FileKit.openCameraPicker(
                 null
             }
         }
-        val presentation = prepareAppleCameraPresentation(
-            sourceAvailable = UIImagePickerController.isSourceTypeAvailable(cameraSource),
-            presenter = openCameraSettings.presenterViewController(),
-            requestedCamera = requestedCamera,
-        )
-
-        suspendCancellableCoroutine<UIImage?> { continuation ->
-            cameraControllerDelegate = CameraControllerDelegate(
-                onImagePicked = { image ->
-                    try {
-                        continuation.resume(
-                            requireAppleCameraImage(image),
-                        )
-                    } catch (failure: FileKitDialogException) {
-                        continuation.resumeWithException(failure)
-                    }
-                },
-                onPickerCancelled = { continuation.resume(null) },
+        val presenterWindow = when (openCameraSettings.presenter) {
+            null -> CameraPresenterWindow()
+            else -> null
+        }
+        try {
+            val presentation = prepareAppleCameraPresentation(
+                sourceAvailable = UIImagePickerController.isSourceTypeAvailable(cameraSource),
+                presenter = openCameraSettings.presenter ?: presenterWindow?.attach(),
+                requestedCamera = requestedCamera,
             )
 
-            val pickerController = UIImagePickerController()
-            pickerController.sourceType = cameraSource
-            pickerController.delegate = cameraControllerDelegate
+            suspendCancellableCoroutine<UIImage?> { continuation ->
+                cameraControllerDelegate = CameraControllerDelegate(
+                    onImagePicked = { image ->
+                        try {
+                            continuation.resume(
+                                requireAppleCameraImage(image),
+                            )
+                        } catch (failure: FileKitDialogException) {
+                            continuation.resumeWithException(failure)
+                        }
+                    },
+                    onPickerCancelled = { continuation.resume(null) },
+                )
 
-            presentation.cameraDevice?.let { pickerController.cameraDevice = it }
+                val pickerController = UIImagePickerController()
+                pickerController.sourceType = cameraSource
+                pickerController.delegate = cameraControllerDelegate
 
-            presentation.presenter.presentViewController(
-                pickerController,
-                animated = true,
-                completion = null,
-            )
+                presentation.cameraDevice?.let { pickerController.cameraDevice = it }
+
+                presentation.presenter.presentViewController(
+                    pickerController,
+                    animated = true,
+                    completion = null,
+                )
+            }
+        } finally {
+            presenterWindow?.detach()
         }
     } ?: return null
 
@@ -525,9 +534,6 @@ private fun FileKitDialogSettings.presenterViewController(
     activeViewController: () -> UIViewController? = ::activeAppleViewController,
 ): UIViewController? = presenter ?: activeViewController()
 
-private fun FileKitOpenCameraSettings.presenterViewController(): UIViewController? =
-    presenter ?: UIApplication.sharedApplication.topMostViewController()
-
 private fun FileKitShareSettings.presenterViewController(): UIViewController? =
     presenter ?: UIApplication.sharedApplication.topMostViewController()
 
```

**File**: `filekit-dialogs/src/iosMain/kotlin/io/github/vinceglb/filekit/dialogs/FileKitOpenCameraSettings.ios.kt` (modified, +4/-1)
```diff
@@ -5,7 +5,10 @@ import platform.UIKit.UIViewController
 /**
  * iOS implementation of [FileKitOpenCameraSettings].
  *
- * @property presenter The view controller used to present the camera picker.
+ * @property presenter The view controller used to present the camera picker. When null, FileKit
+ * presents the camera from a dedicated window placed above the app's windows, which keeps the
+ * picker compatible with hosts whose dialogs live in their own window, such as Compose
+ * Multiplatform 1.11+.
  */
 public actual class FileKitOpenCameraSettings(
     public val presenter: UIViewController? = null,
```

**File**: `filekit-dialogs/src/iosMain/kotlin/io/github/vinceglb/filekit/dialogs/util/CameraPresenterWindow.kt` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+package io.github.vinceglb.filekit.dialogs.util
+
+import kotlinx.cinterop.ExperimentalForeignApi
+import platform.UIKit.UIApplication
+import platform.UIKit.UIColor
+import platform.UIKit.UISceneActivationStateForegroundActive
+import platform.UIKit.UIViewController
+import platform.UIKit.UIWindow
+import platform.UIKit.UIWindowLevelAlert
+import platform.UIKit.UIWindowScene
+
+/**
+ * Hosts the camera presentation in a dedicated transparent [UIWindow].
+ *
+ * Since Compose Multiplatform 1.11, Compose dialogs and popups live in their own window placed
+ * above modally presented view controllers. Presenting the fullscreen camera from the top-most
+ * view controller of the main window puts it underneath such windows, which corrupts touch
+ * handling app-wide after the dismissal. Presenting from a dedicated key window above alerts
+ * avoids that; the previous key window is restored once the capture flow finishes.
+ */
+internal class CameraPresenterWindow {
+    private val hostViewController = UIViewController()
+    private var window: UIWindow? = null
+    private var previousKeyWindow: UIWindow? = null
+
+    @OptIn(ExperimentalForeignApi::class)
+    fun attach(): UIViewController? {
+        val application = UIApplication.sharedApplication
+        val scene = application.connectedScenes
+            .filterIsInstance<UIWindowScene>()
+            .firstOrNull { it.activationState == UISceneActivationStateForegroundActive }
+            ?: return null
+        previousKeyWindow = scene.keyWindow
+        val newWindow = UIWindow(windowScene = scene)
+        newWindow.rootViewController = hostViewController
+        newWindow.windowLevel = UIWindowLevelAlert + 1.0
+        newWindow.backgroundColor = UIColor.clearColor
+        newWindow.makeKeyAndVisible()
+        window = newWindow
+        return hostViewController
+    }
+
+    fun detach() {
+        window?.setHidden(true)
+        window?.rootViewController = null
+        window = null
+        previousKeyWindow?.makeKeyAndVisible()
+        previousKeyWindow = null
+    }
+}
```

---

### Incident Patch 6: `7feb0bc0` (2026-09-07)
**Commit Message**: 🩺 Diagnose CI build resource exhaustion

**File**: `.github/workflows/ci.yml` (modified, +18/-1)
```diff
@@ -27,7 +27,24 @@ jobs:
         uses: gradle/actions/setup-gradle@v6
 
       - name: 🔨 Build project
-        run: ./gradlew assemble
+        shell: bash
+        run: |
+          report_resources() {
+            echo "::group::Build resources $(date -u +%FT%TZ)"
+            free -m
+            df -h / "$RUNNER_TEMP"
+            ps -eo pid,ppid,comm,rss --sort=-rss | head -n 16 || true
+            echo "::endgroup::"
+          }
+          (
+            while true; do
+              report_resources
+              sleep 30
+            done
+          ) &
+          monitor_pid=$!
+          trap 'kill "$monitor_pid" 2>/dev/null || true; report_resources' EXIT
+          ./gradlew assemble --max-workers=2
 
   test-desktop:
     name: 🖥️ Test Desktop
```

---

### Incident Patch 7: `940a73e8` (2026-09-07)
**Commit Message**: 🔀 Merge pull request #646 from cgpllx/fix/ios-phpicker-unique-temp-name

Fix iOS PHPicker multi-select copy collisions

**File**: `filekit-dialogs/src/iosMain/kotlin/io/github/vinceglb/filekit/dialogs/FileKit.ios.kt` (modified, +28/-7)
```diff
@@ -720,7 +720,12 @@ private fun callPhPicker(
                                 else -> {
                                     // Must copy the URL here because it becomes invalid outside the loadFileRepresentationForTypeIdentifier callback scope
                                     runCatching {
-                                        copyToTempFile(fileManager, url, tempRoot.lastPathComponent!!)
+                                        copyToTempFile(
+                                            fileManager = fileManager,
+                                            url = url,
+                                            id = tempRoot.lastPathComponent!!,
+                                            index = index,
+                                        )
                                     }.onSuccess(cont::resume)
                                         .onFailure { cont.resumeWithException(it) }
                                 }
@@ -782,22 +787,38 @@ private fun <R> List<R>?.ifNullOrEmpty(block: () -> List<R>): List<R> =
     if (this.isNullOrEmpty()) block() else this
 
 @OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
-private fun copyToTempFile(
+internal fun copyToTempFile(
     fileManager: NSFileManager,
     url: NSURL,
     id: String,
+    index: Int,
 ): NSURL {
-    // Get the temporary directory
-    val fileComponents = fileManager.temporaryDirectory.pathComponents
+    val fileName = url.lastPathComponent ?: "file"
+
+    // Use a per-asset subdirectory so lastPathComponent stays unchanged.
+    val directoryComponents = fileManager.temporaryDirectory.pathComponents
         ?.plus(id)
-        ?.plus(url.lastPathComponent)
+        ?.plus(index.toString())
         ?: throw FileKitPickerException("Failed to resolve the temporary directory for the selected file.")
 
-    // Create a file URL
+    val directoryUrl = NSURL.fileURLWithPathComponents(directoryComponents)
+        ?: throw FileKitPickerException("Failed to create a temporary directory for the selected file.")
+
+    requireApplePickerOperation(
+        message = "Failed to create a temporary directory for the selected file.",
+    ) { error ->
+        fileManager.createDirectoryAtURL(
+            url = directoryUrl,
+            withIntermediateDirectories = true,
+            attributes = null,
+            error = error,
+        )
+    }
+
+    val fileComponents = directoryComponents.plus(fileName)
     val fileUrl = NSURL.fileURLWithPathComponents(fileComponents)
         ?: throw FileKitPickerException("Failed to create a temporary URL for the selected file.")
 
-    // Write the data to the file URL
     requireApplePickerOperation(
         message = "Failed to copy the selected file to a temporary location.",
     ) { error ->
```

**File**: `filekit-dialogs/src/iosTest/kotlin/io/github/vinceglb/filekit/dialogs/ApplePickerTempFileTest.kt` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+@file:Suppress("ktlint:standard:function-naming", "TestFunctionName")
+
+package io.github.vinceglb.filekit.dialogs
+
+import io.github.vinceglb.filekit.utils.toByteArray
+import io.github.vinceglb.filekit.utils.toNSData
+import kotlinx.cinterop.ExperimentalForeignApi
+import platform.Foundation.NSFileManager
+import platform.Foundation.NSUUID
+import platform.Foundation.temporaryDirectory
+import kotlin.test.Test
+import kotlin.test.assertContentEquals
+import kotlin.test.assertEquals
+import kotlin.test.assertNotEquals
+import kotlin.test.assertNotNull
+import kotlin.test.assertTrue
+
+@OptIn(ExperimentalForeignApi::class)
+class ApplePickerTempFileTest {
+    @Test
+    fun ApplePicker_sameFilename_preservesBothFilesAndContents() {
+        val fileManager = NSFileManager.defaultManager
+        val id = NSUUID().UUIDString
+        val root = assertNotNull(fileManager.temporaryDirectory.URLByAppendingPathComponent(id))
+        val contents = listOf(byteArrayOf(1, 2, 3), byteArrayOf(4, 5, 6))
+
+        try {
+            val sources = contents.mapIndexed { index, bytes ->
+                val directory = assertNotNull(root.URLByAppendingPathComponent("source-$index"))
+                assertTrue(fileManager.createDirectoryAtURL(directory, true, null, null))
+                val source = assertNotNull(directory.URLByAppendingPathComponent("image.jpeg"))
+                assertTrue(fileManager.createFileAtPath(assertNotNull(source.path), bytes.toNSData(), null))
+                source
+            }
+
+            val copies = sources.mapIndexed { index, source ->
+                copyToTempFile(fileManager, source, id, index)
+            }
+
+            assertNotEquals(copies[0].path, copies[1].path)
+            copies.forEachIndexed { index, copy ->
+                assertEquals("image.jpeg", copy.lastPathComponent)
+                val data = assertNotNull(fileManager.contentsAtPath(assertNotNull(copy.path)))
+                assertContentEquals(contents[index], data.toByteArray())
+            }
+        } finally {
+            fileManager.removeItemAtURL(root, null)
+        }
+    }
+}
```

---

### Incident Patch 8: `843ee66d` (2026-09-07)
**Commit Message**: 🐛 Avoid duplicate Linux process interop symbols

**File**: `filekit-dialogs/build.gradle.kts` (modified, +5/-2)
```diff
@@ -86,8 +86,11 @@ kotlin {
         listOf("main", "test").forEach { compilationName ->
             target.compilations.getByName(compilationName) {
                 cinterops {
-                    create("process") {
-                        defFile(project.file("src/linuxMain/cinterop/process.def"))
+                    // Tests call the Kotlin wrapper and must not link a second copy of the C helper.
+                    if (compilationName == "main") {
+                        create("process") {
+                            defFile(project.file("src/linuxMain/cinterop/process.def"))
+                        }
                     }
                     create("dbus") {
                         defFile(project.file("src/linuxMain/cinterop/dbus.def"))
```

---

### Incident Patch 9: `fc28380c` (2026-09-07)
**Commit Message**: 🐛 Escape relative Linux opener file arguments

**File**: `filekit-dialogs/src/linuxMain/kotlin/io/github/vinceglb/filekit/dialogs/LinuxFileOpener.kt` (modified, +5/-1)
```diff
@@ -1,8 +1,12 @@
 package io.github.vinceglb.filekit.dialogs
 
 internal fun openWithXdgOpen(path: String) {
-    spawnLinuxProcess("xdg-open", listOf(path))
+    spawnLinuxProcess("xdg-open", listOf(xdgOpenFileArgument(path)))
 }
 
+// xdg-open interprets bare relative paths as options or URI schemes.
+internal fun xdgOpenFileArgument(path: String): String =
+    if (path.startsWith("/")) path else "./$path"
+
 /** Starts a process and arranges to reap it without waiting for it on the calling thread. */
 internal expect fun spawnLinuxProcess(executable: String, arguments: List<String>): Int
```

**File**: `filekit-dialogs/src/linuxTest/kotlin/io/github/vinceglb/filekit/dialogs/LinuxFileOpenerTest.kt` (modified, +8/-0)
```diff
@@ -16,6 +16,14 @@ import kotlin.test.assertEquals
 import kotlin.test.assertFailsWith
 
 class LinuxFileOpenerTest {
+    @Test
+    fun LinuxOpener_relativePaths_areUnambiguousFileArguments() {
+        assertEquals("./-report.pdf", xdgOpenFileArgument("-report.pdf"))
+        assertEquals("./https:report.pdf", xdgOpenFileArgument("https:report.pdf"))
+        assertEquals("./folder/report.pdf", xdgOpenFileArgument("folder/report.pdf"))
+        assertEquals("/tmp/report.pdf", xdgOpenFileArgument("/tmp/report.pdf"))
+    }
+
     @Test
     fun LinuxProcess_childExits_reapsWithoutBlockingCaller() {
         val pid = spawnLinuxProcess("/bin/sleep", listOf("1"))
```

---

### Incident Patch 10: `792e136d` (2026-09-07)
**Commit Message**: 📝 Document Linux consumer linker requirements

**File**: `docs/dialogs/setup.mdx` (modified, +15/-1)
```diff
@@ -58,6 +58,20 @@ compose.desktop {
 
 This prevents a `NoClassDefFoundError` in some cases. Read more about this issue in the [GitHub issue #107](https://github.com/vinceglb/FileKit/issues/107).
 
-If using the Kotlin/Native Linux target (`linuxX64` or `linuxArm64`), dialogs are provided out of the box through the GNOME XDG Desktop Portal. The portal file chooser is shown on systems running `xdg-desktop-portal` (default on GNOME and other modern desktops); the application binary links against `libdbus-1`, which is present on every D-Bus enabled system.
+If using the Kotlin/Native Linux target (`linuxX64` or `linuxArm64`), dialogs are provided out of the box through the GNOME XDG Desktop Portal. The portal file chooser is shown on systems running `xdg-desktop-portal` (default on GNOME and other modern desktops); the application binary links against the `libdbus-1` runtime library.
+
+Building an application that consumes FileKit Dialogs requires the target architecture's D-Bus development libraries (`libdbus-1-dev` on Debian/Ubuntu), including the unversioned `libdbus-1.so` linker file. If the library directory is outside Kotlin/Native's linker search paths, configure the corresponding target, for example:
+
+```kotlin
+kotlin {
+    linuxX64 {
+        binaries.all {
+            linkerOpts("-L/usr/lib/x86_64-linux-gnu")
+        }
+    }
+}
+```
+
+Use your target's library directory (reported by `pkg-config --variable=libdir dbus-1` on a native Linux build machine). Cross-compilation requires libraries for the target architecture. Running the finished application requires the runtime library, not the development package.
 
 Building `filekit-dialogs` from source for Linux native targets requires the Linux D-Bus development headers (`libdbus-1-dev` on Debian/Ubuntu). Linux builds discover them through `pkg-config`. For cross-compilation, pass `-Pfilekit.dbusHeaders=/path/to/include`, where `include/dbus/` contains both the public headers and the Linux `dbus-arch-deps.h`. Release and snapshot workflows supply these headers to the macOS build so both Linux artifacts and their multiplatform metadata are published together.
```

---

### Incident Patch 11: `f1545531` (2026-09-07)
**Commit Message**: 🐛 Fail Linux dialogs when the portal service disappears

**File**: `filekit-dialogs/src/linuxDbusMain/kotlin/io/github/vinceglb/filekit/dialogs/platform/linux/XdgPortalDbusClient.kt` (modified, +35/-4)
```diff
@@ -31,6 +31,7 @@ import dbus.dbus_error_free
 import dbus.dbus_error_init
 import dbus.dbus_error_is_set
 import dbus.dbus_message_get_path
+import dbus.dbus_message_get_sender
 import dbus.dbus_message_is_signal
 import dbus.dbus_message_iter_append_basic
 import dbus.dbus_message_iter_close_container
@@ -70,6 +71,10 @@ private const val PORTAL_REQUEST_INTERFACE = "org.freedesktop.portal.Request"
 private const val PORTAL_RESPONSE_MATCH_RULE =
     "type='signal',interface='org.freedesktop.portal.Request',member='Response'"
 
+private const val PORTAL_OWNER_MATCH_RULE =
+    "type='signal',sender='org.freedesktop.DBus',interface='org.freedesktop.DBus'," +
+        "member='NameOwnerChanged',arg0='org.freedesktop.portal.Desktop'"
+
 private const val NO_TIMEOUT = -1
 private const val READ_WRITE_TIMEOUT_MS = 100
 
@@ -111,9 +116,11 @@ internal actual fun runXdgPortalRequest(
         // A library must report a lost bus to its caller, never terminate the application.
         dbus_connection_set_exit_on_disconnect(connection, 0u)
 
-        dbus_bus_add_match(connection, PORTAL_RESPONSE_MATCH_RULE, error.ptr)
-        if (dbus_error_is_set(error.ptr) != 0u) {
-            throw dbusOperationFailure(error, "Could not subscribe to XDG portal responses")
+        for (rule in listOf(PORTAL_RESPONSE_MATCH_RULE, PORTAL_OWNER_MATCH_RULE)) {
+            dbus_bus_add_match(connection, rule, error.ptr)
+            if (dbus_error_is_set(error.ptr) != 0u) {
+                throw dbusOperationFailure(error, "Could not subscribe to XDG portal events")
+            }
         }
         dbus_connection_flush(connection)
 
@@ -140,7 +147,9 @@ internal actual fun runXdgPortalRequest(
         handlePath = readRequestHandle(reply)
             ?: throw LinuxXdgPortalException("The XDG portal returned an invalid request handle")
 
-        awaitPortalResponse(connection, handlePath, coroutineContext)
+        val portalOwner = dbus_message_get_sender(reply)?.toKString()
+            ?: throw LinuxXdgPortalException("The XDG portal reply had no sender")
+        awaitPortalResponse(connection, handlePath, coroutineContext, portalOwner)
     } catch (cancelled: CancellationException) {
         if (connection != null && handlePath != null) {
             closePortalRequest(connection, handlePath)
@@ -306,6 +315,7 @@ internal fun MemScope.awaitPortalResponse(
     connection: CPointer<DBusConnection>,
     handlePath: String,
     coroutineContext: CoroutineContext = EmptyCoroutineContext,
+    portalOwner: String? = null,
 ): List<String>? {
     while (true) {
         coroutineContext.ensureActive()
@@ -321,6 +331,9 @@ internal fun MemScope.awaitPortalResponse(
             coroutineContext.ensureActive()
             val message = dbus_connection_pop_message(connection) ?: break
             try {
+                if (portalOwner != null && portalOwnerWasLost(message, portalOwner)) {
+                    throw LinuxXdgPortalException("The XDG portal service stopped while waiting for its response")
+                }
                 if (dbus_message_is_signal(message, PORTAL_REQUEST_INTERFACE, "Response") != 0u) {
                     val path = dbus_message_get_path(message)?.toKString()
                     if (path == handlePath) {
@@ -334,6 +347,24 @@ internal fun MemScope.awaitPortalResponse(
     }
 }
 
+internal fun MemScope.portalOwnerWasLost(message: CPointer<DBusMessage>, expectedOwner: String): Boolean {
+    if (dbus_message_is_signal(message, "org.freedesktop.DBus", "NameOwnerChanged") == 0u ||
+        dbus_message_get_sender(message)?.toKString() != "org.freedesktop.DBus"
+    ) {
+        return false
+    }
+    val iter = alloc<DBusMessageIter>()
+    if (dbus_message_iter_init(message, iter.ptr) == 0u) return false
+    if (dbus_message_iter_get_arg_type(iter.ptr) != DBUS_TYPE_STRING) return false
+    if (readString(iter.ptr) != PORTAL_DESTINATION) return false
+    dbus_message_iter_next(iter.ptr)
+    if (dbus_message_iter_get_arg_type(iter.ptr) != DBUS_TYPE_STRING) return false
+    if (readString(iter.ptr) != expectedOwner) return false
+    dbus_message_iter_next(iter.ptr)
+    if (dbus_message_iter_get_arg_type(iter.ptr) != DBUS_TYPE_STRING) return false
+    return readString(iter.ptr) != expectedOwner
+}
+
 internal fun MemScope.parsePortalResponse(
     message: CPointer<DBusMessage>,
 ): List<String>? {
```

**File**: `filekit-dialogs/src/linuxX64Test/kotlin/io/github/vinceglb/filekit/dialogs/platform/linux/PortalResponseParsingTest.kt` (modified, +28/-0)
```diff
@@ -29,10 +29,12 @@ import dbus.dbus_message_iter_init_append
 import dbus.dbus_message_iter_open_container
 import dbus.dbus_message_new
 import dbus.dbus_message_new_method_call
+import dbus.dbus_message_new_signal
 import dbus.dbus_message_set_destination
 import dbus.dbus_message_set_interface
 import dbus.dbus_message_set_member
 import dbus.dbus_message_set_path
+import dbus.dbus_message_set_sender
 import dbus.dbus_message_unref
 import kotlinx.cinterop.ByteVar
 import kotlinx.cinterop.CPointer
@@ -51,6 +53,7 @@ import kotlinx.coroutines.Job
 import kotlin.test.Test
 import kotlin.test.assertEquals
 import kotlin.test.assertFailsWith
+import kotlin.test.assertFalse
 import kotlin.test.assertNotNull
 import kotlin.test.assertNull
 import kotlin.test.assertTrue
@@ -115,6 +118,31 @@ class PortalResponseParsingTest {
         assertEquals(listOf("/tmp/first"), awaitPortalResponse(connection, handle))
     }
 
+    @Test
+    fun PortalOwner_crashOrReplacement_detectsOnlyTheOwnerOfThisRequest() = memScoped {
+        for (replacement in listOf("", ":1.456")) {
+            val message = assertNotNull(
+                dbus_message_new_signal("/org/freedesktop/DBus", "org.freedesktop.DBus", "NameOwnerChanged"),
+            )
+            try {
+                assertTrue(dbus_message_set_sender(message, "org.freedesktop.DBus") != 0u)
+                val body = alloc<DBusMessageIter>()
+                dbus_message_iter_init_append(message, body.ptr)
+                appendString(body.ptr, "org.freedesktop.portal.Desktop")
+                appendString(body.ptr, ":1.123")
+                appendString(body.ptr, replacement)
+
+                assertTrue(portalOwnerWasLost(message, ":1.123"))
+                // An owner change queued before this request was opened must not fail the new request.
+                assertFalse(portalOwnerWasLost(message, ":1.789"))
+                assertTrue(dbus_message_set_sender(message, ":1.999") != 0u)
+                assertFalse(portalOwnerWasLost(message, ":1.123"))
+            } finally {
+                dbus_message_unref(message)
+            }
+        }
+    }
+
     private fun withQueuedResponses(block: MemScope.(CPointer<DBusConnection>, String) -> Unit) = memScoped {
         val error = alloc<DBusError>()
         dbus_error_init(error.ptr)
```

---

### Incident Patch 12: `a0ce76ea` (2026-09-07)
**Commit Message**: 🐛 Handle Linux dialog cancellation and reap opener processes

**File**: `filekit-dialogs/build.gradle.kts` (modified, +8/-0)
```diff
@@ -1,4 +1,5 @@
 import org.gradle.api.tasks.testing.Test
+import org.jetbrains.kotlin.gradle.plugin.mpp.TestExecutable
 import org.jetbrains.kotlin.konan.target.HostManager
 
 plugins {
@@ -77,10 +78,17 @@ kotlin {
     val dbusLibDir = if (HostManager.hostIsLinux) resolvePkgConfigVariable("libdir") else null
 
     listOf(linuxX64(), linuxArm64()).forEach { target ->
+        // Linux test executables need Linux runtime libraries and cannot run on other hosts.
+        target.binaries.withType<TestExecutable>().configureEach {
+            linkTaskProvider.configure { enabled = HostManager.hostIsLinux }
+        }
         dbusLibDir?.let { libDir -> target.binaries.configureEach { linkerOpts("-L$libDir") } }
         listOf("main", "test").forEach { compilationName ->
             target.compilations.getByName(compilationName) {
                 cinterops {
+                    create("process") {
+                        defFile(project.file("src/linuxMain/cinterop/process.def"))
+                    }
                     create("dbus") {
                         defFile(project.file("src/linuxMain/cinterop/dbus.def"))
                         compilerOpts(*dbusCompilerOpts)
```

**File**: `filekit-dialogs/src/linuxDbusMain/kotlin/io/github/vinceglb/filekit/dialogs/LinuxFileOpener.native.kt` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)
+
+package io.github.vinceglb.filekit.dialogs
+
+import filekit.process.filekit_spawn_process
+import io.github.vinceglb.filekit.exceptions.FileKitException
+import kotlinx.cinterop.ByteVar
+import kotlinx.cinterop.CPointerVar
+import kotlinx.cinterop.alloc
+import kotlinx.cinterop.allocArray
+import kotlinx.cinterop.cstr
+import kotlinx.cinterop.memScoped
+import kotlinx.cinterop.ptr
+import kotlinx.cinterop.set
+import kotlinx.cinterop.value
+import platform.posix.pid_tVar
+
+internal actual fun spawnLinuxProcess(executable: String, arguments: List<String>): Int = memScoped {
+    val argv = allocArray<CPointerVar<ByteVar>>(arguments.size + 2)
+    argv[0] = executable.cstr.ptr
+    arguments.forEachIndexed { index, argument -> argv[index + 1] = argument.cstr.ptr }
+    argv[arguments.size + 1] = null
+    val child = alloc<pid_tVar>()
+    val error = filekit_spawn_process(child.ptr, executable, argv)
+    if (error != 0) {
+        throw FileKitException("Could not open the file with the default application (error $error).")
+    }
+    child.value
+}
```

**File**: `filekit-dialogs/src/linuxDbusMain/kotlin/io/github/vinceglb/filekit/dialogs/platform/linux/XdgPortalDbusClient.kt` (modified, +38/-2)
```diff
@@ -23,7 +23,9 @@ import dbus.dbus_connection_flush
 import dbus.dbus_connection_get_is_connected
 import dbus.dbus_connection_pop_message
 import dbus.dbus_connection_read_write
+import dbus.dbus_connection_send
 import dbus.dbus_connection_send_with_reply_and_block
+import dbus.dbus_connection_set_exit_on_disconnect
 import dbus.dbus_connection_unref
 import dbus.dbus_error_free
 import dbus.dbus_error_init
@@ -54,6 +56,10 @@ import kotlinx.cinterop.memScoped
 import kotlinx.cinterop.ptr
 import kotlinx.cinterop.toKString
 import kotlinx.cinterop.value
+import kotlinx.coroutines.CancellationException
+import kotlinx.coroutines.ensureActive
+import kotlin.coroutines.CoroutineContext
+import kotlin.coroutines.EmptyCoroutineContext
 
 // https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.FileChooser.html
 // https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.Request.html
@@ -90,15 +96,20 @@ internal actual fun runXdgPortalRequest(
     parentWindow: String,
     title: String,
     options: Map<String, PortalVariant>,
+    coroutineContext: CoroutineContext,
 ): List<String>? = memScoped {
     val error = alloc<DBusError>()
     dbus_error_init(error.ptr)
     var connection: CPointer<DBusConnection>? = null
     var request: CPointer<DBusMessage>? = null
     var reply: CPointer<DBusMessage>? = null
+    var handlePath: String? = null
     try {
+        coroutineContext.ensureActive()
         connection = dbus_bus_get_private(DBusBusType.DBUS_BUS_SESSION, error.ptr)
             ?: throw dbusOperationFailure(error, "Could not connect to the D-Bus session bus")
+        // A library must report a lost bus to its caller, never terminate the application.
+        dbus_connection_set_exit_on_disconnect(connection, 0u)
 
         dbus_bus_add_match(connection, PORTAL_RESPONSE_MATCH_RULE, error.ptr)
         if (dbus_error_is_set(error.ptr) != 0u) {
@@ -126,10 +137,15 @@ internal actual fun runXdgPortalRequest(
         reply = dbus_connection_send_with_reply_and_block(connection, request, NO_TIMEOUT, error.ptr)
             ?: throw dbusOperationFailure(error, "The XDG portal did not answer the ${method.name} request")
 
-        val handlePath = readRequestHandle(reply)
+        handlePath = readRequestHandle(reply)
             ?: throw LinuxXdgPortalException("The XDG portal returned an invalid request handle")
 
-        awaitPortalResponse(connection, handlePath)
+        awaitPortalResponse(connection, handlePath, coroutineContext)
+    } catch (cancelled: CancellationException) {
+        if (connection != null && handlePath != null) {
+            closePortalRequest(connection, handlePath)
+        }
+        throw cancelled
     } finally {
         reply?.let { dbus_message_unref(it) }
         request?.let { dbus_message_unref(it) }
@@ -141,6 +157,23 @@ internal actual fun runXdgPortalRequest(
     }
 }
 
+private fun closePortalRequest(connection: CPointer<DBusConnection>, handlePath: String) {
+    val close = dbus_message_new_method_call(
+        PORTAL_DESTINATION,
+        handlePath,
+        PORTAL_REQUEST_INTERFACE,
+        "Close",
+    ) ?: return
+    try {
+        dbus_connection_send(connection, close, null)
+        // Best effort, without blocking cancellation on a flush or a method reply.
+        // Closing the private connection below also releases the caller's portal requests.
+        dbus_connection_read_write(connection, 0)
+    } finally {
+        dbus_message_unref(close)
+    }
+}
+
 // region Request construction
 
 private fun MemScope.appendOptions(
@@ -272,8 +305,10 @@ private fun MemScope.readRequestHandle(
 internal fun MemScope.awaitPortalResponse(
     connection: CPointer<DBusConnection>,
     handlePath: String,
+    coroutineContext: CoroutineContext = EmptyCoroutineContext,
 ): List<String>? {
     while (true) {
+        coroutineContext.ensureActive()
         if (dbus_connection_get_is_connected(connection) == 0u) {
             throw LinuxXdgPortalException(
                 "The connection to the D-Bus session bus was lost while waiting for the XDG portal response",
@@ -283,6 +318,7 @@ internal fun MemScope.awaitPortalResponse(
         dbus_connection_read_write(connection, READ_WRITE_TIMEOUT_MS)
 
         while (true) {
+            coroutineContext.ensureActive()
             val message = dbus_connection_pop_message(connection) ?: break
             try {
                 if (dbus_message_is_signal(message, PORTAL_REQUEST_INTERFACE, "Response") != 0u) {
```

**File**: `filekit-dialogs/src/linuxMain/cinterop/process.def` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+headers = spawn.h unistd.h
+headerFilter = spawn.h
+package = filekit.process
+linkerOpts.linux = -lpthread
+
+---
+#include <errno.h>
+#include <pthread.h>
+#include <stdlib.h>
+#include <sys/wait.h>
+
+struct filekit_process_reaper {
+    pthread_mutex_t ready;
+    pid_t pid;
+};
+
+static void *filekit_reap_process(void *argument) {
+    struct filekit_process_reaper *reaper = argument;
+    pthread_mutex_lock(&reaper->ready);
+    pid_t pid = reaper->pid;
+    pthread_mutex_unlock(&reaper->ready);
+    pthread_mutex_destroy(&reaper->ready);
+    free(reaper);
+
+    /* Only collect our own child, preserving the application's SIGCHLD policy. */
+    if (pid > 0) {
+        while (waitpid(pid, NULL, 0) < 0 && errno == EINTR) {}
+    }
+    return NULL;
+}
+
+static inline int filekit_spawn_process(pid_t *pid, const char *executable, char *const argv[]) {
+    extern char **environ;
+    struct filekit_process_reaper *reaper = malloc(sizeof(*reaper));
+    if (reaper == NULL) return ENOMEM;
+    int error = pthread_mutex_init(&reaper->ready, NULL);
+    if (error != 0) {
+        free(reaper);
+        return error;
+    }
+    pthread_attr_t attributes;
+    error = pthread_attr_init(&attributes);
+    if (error != 0) {
+        pthread_mutex_destroy(&reaper->ready);
+        free(reaper);
+        return error;
+    }
+    error = pthread_attr_setdetachstate(&attributes, PTHREAD_CREATE_DETACHED);
+    if (error != 0) {
+        pthread_attr_destroy(&attributes);
+        pthread_mutex_destroy(&reaper->ready);
+        free(reaper);
+        return error;
+    }
+
+    /* Create the reaper before the child, so a thread allocation failure cannot orphan it.
+       The mutex keeps the reaper asleep until spawning completes and its PID is published. */
+    pthread_mutex_lock(&reaper->ready);
+    pthread_t thread;
+    error = pthread_create(&thread, &attributes, filekit_reap_process, reaper);
+    pthread_attr_destroy(&attributes);
+    if (error != 0) {
+        pthread_mutex_unlock(&reaper->ready);
+        pthread_mutex_destroy(&reaper->ready);
+        free(reaper);
+        return error;
+    }
+
+    error = posix_spawnp(pid, executable, NULL, NULL, argv, environ);
+    reaper->pid = error == 0 ? *pid : -1;
+    pthread_mutex_unlock(&reaper->ready);
+    /* The detached reaper now owns the allocation and releases its thread on exit. */
+    return error;
+}
```

**File**: `filekit-dialogs/src/linuxMain/kotlin/io/github/vinceglb/filekit/dialogs/FileKit.linux.kt` (modified, +6/-36)
```diff
@@ -1,5 +1,3 @@
-@file:OptIn(ExperimentalForeignApi::class)
-
 package io.github.vinceglb.filekit.dialogs
 
 import io.github.vinceglb.filekit.FileKit
@@ -9,24 +7,12 @@ import io.github.vinceglb.filekit.dialogs.platform.linux.PortalRequestMethod
 import io.github.vinceglb.filekit.dialogs.platform.linux.PortalVariant
 import io.github.vinceglb.filekit.dialogs.platform.linux.buildPortalFileFilters
 import io.github.vinceglb.filekit.dialogs.platform.linux.runXdgPortalRequest
-import io.github.vinceglb.filekit.exceptions.FileKitException
 import io.github.vinceglb.filekit.path
-import kotlinx.cinterop.ByteVar
-import kotlinx.cinterop.CPointerVar
-import kotlinx.cinterop.ExperimentalForeignApi
-import kotlinx.cinterop.allocArray
-import kotlinx.cinterop.cstr
-import kotlinx.cinterop.memScoped
-import kotlinx.cinterop.ptr
-import kotlinx.cinterop.set
 import kotlinx.coroutines.Dispatchers
 import kotlinx.coroutines.IO
 import kotlinx.coroutines.flow.Flow
 import kotlinx.coroutines.withContext
-import platform.posix.EXIT_FAILURE
-import platform.posix._exit
-import platform.posix.execvp
-import platform.posix.fork
+import kotlin.coroutines.CoroutineContext
 
 internal actual suspend fun FileKit.platformOpenFilePicker(
     type: FileKitType,
@@ -49,6 +35,7 @@ internal actual suspend fun FileKit.platformOpenFilePicker(
                 title = dialogSettings.title,
                 multiple = mode is PickerMode.Multiple,
                 openDirectory = false,
+                coroutineContext = coroutineContext,
             )
         }
     }.toPickerStateFlow()
@@ -72,6 +59,7 @@ public actual suspend fun FileKit.openDirectoryPicker(
             title = dialogSettings.title,
             multiple = false,
             openDirectory = true,
+            coroutineContext = coroutineContext,
         )?.firstOrNull()
     } catch (failure: LinuxXdgPortalException) {
         throw FileKitDialogException(
@@ -102,6 +90,7 @@ internal actual suspend fun FileKit.platformOpenFileSaver(
             parentWindow = "",
             title = dialogSettings.title.orEmpty(),
             options = options,
+            coroutineContext = coroutineContext,
         )?.firstOrNull()
             ?.let { PlatformFile(it) }
     } catch (failure: LinuxXdgPortalException) {
@@ -131,6 +120,7 @@ private fun openPortalDialog(
     title: String?,
     multiple: Boolean,
     openDirectory: Boolean,
+    coroutineContext: CoroutineContext,
 ): List<PlatformFile>? {
     val options = mutableMapOf<String, PortalVariant>(
         "multiple" to PortalVariant.Bool(multiple),
@@ -144,6 +134,7 @@ private fun openPortalDialog(
         parentWindow = "",
         title = title.orEmpty(),
         options = options,
+        coroutineContext = coroutineContext,
     )?.map { path -> PlatformFile(path) }
 }
 
@@ -166,24 +157,3 @@ internal fun <T> runLinuxNativePickerOperation(operation: () -> T): T = try {
         cause = failure,
     )
 }
-
-private fun openWithXdgOpen(path: String) {
-    val spawnResult = memScoped {
-        val executable = "xdg-open".cstr
-        val pathArgument = path.cstr
-        val arguments = allocArray<CPointerVar<ByteVar>>(3)
-        arguments[0] = executable.ptr
-        arguments[1] = pathArgument.ptr
-        arguments[2] = null
-
-        val pid = fork()
-        if (pid == 0) {
-            execvp("xdg-open", arguments)
-            _exit(EXIT_FAILURE)
-        }
-        pid
-    }
-    if (spawnResult < 0) {
-        throw FileKitException("Could not open the file with the default application.")
-    }
-}
```

**File**: `filekit-dialogs/src/linuxMain/kotlin/io/github/vinceglb/filekit/dialogs/LinuxFileOpener.kt` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+package io.github.vinceglb.filekit.dialogs
+
+internal fun openWithXdgOpen(path: String) {
+    spawnLinuxProcess("xdg-open", listOf(path))
+}
+
+/** Starts a process and arranges to reap it without waiting for it on the calling thread. */
+internal expect fun spawnLinuxProcess(executable: String, arguments: List<String>): Int
```

**File**: `filekit-dialogs/src/linuxMain/kotlin/io/github/vinceglb/filekit/dialogs/platform/linux/XdgPortalModel.kt` (modified, +3/-0)
```diff
@@ -1,5 +1,7 @@
 package io.github.vinceglb.filekit.dialogs.platform.linux
 
+import kotlin.coroutines.CoroutineContext
+import kotlin.coroutines.EmptyCoroutineContext
 import kotlin.random.Random
 
 /**
@@ -77,6 +79,7 @@ internal expect fun runXdgPortalRequest(
     parentWindow: String,
     title: String,
     options: Map<String, PortalVariant>,
+    coroutineContext: CoroutineContext = EmptyCoroutineContext,
 ): List<String>?
 
 /**
```

**File**: `filekit-dialogs/src/linuxTest/kotlin/io/github/vinceglb/filekit/dialogs/LinuxFileOpenerTest.kt` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)
+@file:Suppress("ktlint:standard:function-naming")
+
+package io.github.vinceglb.filekit.dialogs
+
+import io.github.vinceglb.filekit.exceptions.FileKitException
+import platform.posix.ECHILD
+import platform.posix.ESRCH
+import platform.posix.WNOHANG
+import platform.posix.errno
+import platform.posix.kill
+import platform.posix.usleep
+import platform.posix.waitpid
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertFailsWith
+
+class LinuxFileOpenerTest {
+    @Test
+    fun LinuxProcess_childExits_reapsWithoutBlockingCaller() {
+        val pid = spawnLinuxProcess("/bin/sleep", listOf("1"))
+        assertEquals(0, kill(pid, 0), "The opener should return while its child is running")
+
+        // kill(pid, 0) still succeeds for a zombie, so this observes reaping without reaping it
+        // ourselves and accidentally hiding a regression in the background reaper.
+        for (attempt in 0 until 500) {
+            if (kill(pid, 0) < 0 && errno == ESRCH) break
+            usleep(10_000u)
+        }
+        assertEquals(-1, kill(pid, 0), "The exited child must not remain as a zombie")
+        assertEquals(ESRCH, errno)
+        assertEquals(-1, waitpid(pid, null, WNOHANG))
+        assertEquals(ECHILD, errno, "The opener must have collected the child's exit status")
+    }
+
+    @Test
+    fun LinuxProcess_missingExecutable_reportsSpawnFailure() {
+        assertFailsWith<FileKitException> {
+            spawnLinuxProcess("/filekit-nonexistent-directory/xdg-open", emptyList())
+        }
+    }
+}
```

---

### Incident Patch 13: `e21e18b2` (2026-09-07)
**Commit Message**: 🐛 Fix Linux picker publishing and portal handling

**File**: `.github/workflows/ci.yml` (modified, +36/-2)
```diff
@@ -10,6 +10,9 @@ concurrency:
   cancel-in-progress: true
 
 jobs:
+  linux-dbus-headers:
+    uses: ./.github/workflows/linux-dbus-headers.yaml
+
   build:
     name: 💆‍♀️ Build FileKit
     runs-on: ubuntu-latest
@@ -146,7 +149,7 @@ jobs:
         uses: actions/checkout@v6
 
       - name: 🔧 Install Linux dialog dependencies
-        run: sudo apt-get update && sudo apt-get install -y libdbus-1-dev
+        run: sudo apt-get update && sudo apt-get install -y libdbus-1-dev dbus
 
       - name: 🍉 Configure JDK 21
         uses: actions/setup-java@v5
@@ -158,7 +161,38 @@ jobs:
         uses: gradle/actions/setup-gradle@v6
 
       - name: 🧪 Run Linux Native Tests
-        run: ./gradlew linuxX64Test
+        run: dbus-run-session -- ./gradlew linuxX64Test --no-daemon
+
+  test-linux-publications:
+    name: Verify Linux publications on macOS
+    needs: linux-dbus-headers
+    runs-on: macos-26
+    steps:
+      - uses: actions/checkout@v6
+      - uses: actions/setup-java@v5
+        with:
+          distribution: 'temurin'
+          java-version: '21'
+      - uses: gradle/actions/setup-gradle@v6
+      - uses: actions/download-artifact@v4
+        with:
+          name: linux-dbus-headers
+          path: build/dbus-headers
+      - name: Build Linux artifacts and root metadata
+        run: >-
+          ./gradlew -Pfilekit.dbusHeaders=build/dbus-headers -PRELEASE_SIGNING_ENABLED=false
+          :filekit-dialogs:publishLinuxX64PublicationToMavenLocal
+          :filekit-dialogs:publishLinuxArm64PublicationToMavenLocal
+          :filekit-dialogs:generateMetadataFileForKotlinMultiplatformPublication
+      - name: Verify both Linux variants are advertised
+        run: |
+          python3 - <<'PYTHON'
+          import json
+          from pathlib import Path
+          metadata = json.loads(Path("filekit-dialogs/build/publications/kotlinMultiplatform/module.json").read_text())
+          targets = {v["attributes"].get("org.jetbrains.kotlin.native.target") for v in metadata["variants"]}
+          assert {"linux_x64", "linux_arm64"} <= targets, targets
+          PYTHON
 
   lint:
     name: 🚨 Lint
```

**File**: `.github/workflows/linux-dbus-headers.yaml` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+name: Prepare Linux D-Bus headers
+
+on:
+  workflow_call:
+
+jobs:
+  headers:
+    runs-on: ubuntu-latest
+    steps:
+      - name: Install D-Bus development headers
+        run: sudo apt-get update && sudo apt-get install -y libdbus-1-dev
+
+      - name: Stage Linux headers for cross-compilation
+        run: |
+          mkdir -p dbus-headers/dbus
+          cp /usr/include/dbus-1.0/dbus/*.h dbus-headers/dbus/
+          cp "$(pkg-config --variable=libdir dbus-1)/dbus-1.0/include/dbus/dbus-arch-deps.h" dbus-headers/dbus/
+
+      - name: Upload Linux headers
+        uses: actions/upload-artifact@v4
+        with:
+          name: linux-dbus-headers
+          path: dbus-headers/
+          if-no-files-found: error
```

**File**: `.github/workflows/publish-snapshot.yaml` (modified, +11/-2)
```diff
@@ -7,6 +7,9 @@ on:
   workflow_dispatch:
 
 jobs:
+  linux-dbus-headers:
+    uses: ./.github/workflows/linux-dbus-headers.yaml
+
   check-version:
     runs-on: ubuntu-latest
     outputs:
@@ -28,7 +31,7 @@ jobs:
   publish:
     name: Publish to Snapshot
     runs-on: macos-26
-    needs: check-version
+    needs: [check-version, linux-dbus-headers]
     if: ${{ needs.check-version.outputs.is_snapshot == 'true' }}
     steps:
       - name: Checkout
@@ -43,8 +46,14 @@ jobs:
       - name: Setup Gradle
         uses: gradle/actions/setup-gradle@v6
 
+      - name: Download Linux D-Bus headers
+        uses: actions/download-artifact@v4
+        with:
+          name: linux-dbus-headers
+          path: build/dbus-headers
+
       - name: Upload Artifacts
-        run: ./gradlew publishAllPublicationsToMavenCentralRepository
+        run: ./gradlew -Pfilekit.dbusHeaders=build/dbus-headers publishAllPublicationsToMavenCentralRepository
         env:
           ORG_GRADLE_PROJECT_mavenCentralUsername: ${{ secrets.MAVEN_CENTRAL_USERNAME }}
           ORG_GRADLE_PROJECT_mavenCentralPassword: ${{ secrets.MAVEN_CENTRAL_PASSWORD }}
```

**File**: `.github/workflows/publish.yaml` (modified, +11/-1)
```diff
@@ -7,7 +7,11 @@ on:
       - published
 
 jobs:
+  linux-dbus-headers:
+    uses: ./.github/workflows/linux-dbus-headers.yaml
+
   publish:
+    needs: linux-dbus-headers
     name: Publish to Sonatype
     runs-on: macos-26
     steps:
@@ -23,8 +27,14 @@ jobs:
       - name: Setup Gradle
         uses: gradle/actions/setup-gradle@v6
 
+      - name: Download Linux D-Bus headers
+        uses: actions/download-artifact@v4
+        with:
+          name: linux-dbus-headers
+          path: build/dbus-headers
+
       - name: Upload Artifacts
-        run: ./gradlew publishAndReleaseToMavenCentral --no-configuration-cache
+        run: ./gradlew -Pfilekit.dbusHeaders=build/dbus-headers publishAndReleaseToMavenCentral --no-configuration-cache
         env:
           ORG_GRADLE_PROJECT_mavenCentralUsername: ${{ secrets.MAVEN_CENTRAL_USERNAME }}
           ORG_GRADLE_PROJECT_mavenCentralPassword: ${{ secrets.MAVEN_CENTRAL_PASSWORD }}
```

**File**: `build-logic/convention/src/main/kotlin/KotlinMultiplatformLibraryConventionPlugin.kt` (modified, +1/-6)
```diff
@@ -6,7 +6,6 @@ import org.gradle.api.Plugin
 import org.gradle.api.Project
 import org.gradle.kotlin.dsl.configure
 import org.jetbrains.kotlin.gradle.dsl.KotlinMultiplatformExtension
-import org.jetbrains.kotlin.konan.target.HostManager
 
 @Suppress("ktlint:standard:chain-method-continuation", "unused")
 class KotlinMultiplatformLibraryConventionPlugin : Plugin<Project> {
@@ -19,10 +18,6 @@ class KotlinMultiplatformLibraryConventionPlugin : Plugin<Project> {
 
             println("Module [$moduleName] - $modulePackage")
 
-            // The libdbus cinterop of `filekit-dialogs` needs the D-Bus development headers from the
-            // host machine, so its Linux targets are only created when building on Linux.
-            val isLinuxHost = HostManager.hostIsLinux
-
             // Kotlin Multiplatform
             extensions.configure<KotlinMultiplatformExtension> {
                 configureKotlinMultiplatform(
@@ -32,7 +27,7 @@ class KotlinMultiplatformLibraryConventionPlugin : Plugin<Project> {
                     addMacosTargets = true,
                     addWatchosTargets = path == ":filekit-core",
                     addMingwTargets = path == ":filekit-core" || path == ":filekit-dialogs",
-                    addLinuxTargets = path == ":filekit-core" || (path == ":filekit-dialogs" && isLinuxHost),
+                    addLinuxTargets = path == ":filekit-core" || path == ":filekit-dialogs",
                 )
             }
         }
```

**File**: `docs/dialogs/setup.mdx` (modified, +1/-1)
```diff
@@ -60,4 +60,4 @@ This prevents a `NoClassDefFoundError` in some cases. Read more about this issue
 
 If using the Kotlin/Native Linux target (`linuxX64` or `linuxArm64`), dialogs are provided out of the box through the GNOME XDG Desktop Portal. The portal file chooser is shown on systems running `xdg-desktop-portal` (default on GNOME and other modern desktops); the application binary links against `libdbus-1`, which is present on every D-Bus enabled system.
 
-Building `filekit-dialogs` for Linux native targets requires the D-Bus development headers (`libdbus-1-dev` on Debian/Ubuntu) on the build machine, which is why the Linux targets are only enabled on Linux hosts.
+Building `filekit-dialogs` from source for Linux native targets requires the Linux D-Bus development headers (`libdbus-1-dev` on Debian/Ubuntu). Linux builds discover them through `pkg-config`. For cross-compilation, pass `-Pfilekit.dbusHeaders=/path/to/include`, where `include/dbus/` contains both the public headers and the Linux `dbus-arch-deps.h`. Release and snapshot workflows supply these headers to the macOS build so both Linux artifacts and their multiplatform metadata are published together.
```

**File**: `filekit-dialogs/build.gradle.kts` (modified, +23/-28)
```diff
@@ -66,39 +66,34 @@ kotlin {
         }
     }
 
-    // The libdbus cinterop requires the D-Bus development headers from the host machine, so the
-    // Linux targets are only created on Linux hosts (see the module convention plugin).
-    val isLinuxHost = HostManager.hostIsLinux
-
-    if (isLinuxHost) {
-        // pkg-config failures are acceptable: when the dbus-1 development package is missing the
-        // D-Bus cinterop simply resolves no flags and the JVM targets remain buildable.
-        val dbusCompilerOpts = resolvePkgConfigArgs("--cflags")
-        val dbusLibDir = resolvePkgConfigVariable("libdir")
-
-        listOf(linuxX64(), linuxArm64()).forEach { target ->
-            // The konan linker does not search the distro's multiarch library dirs, so the host's
-            // libdbus location must be passed explicitly. Native test binaries only link for the
-            // host architecture, so the host libdir is always correct there.
-            dbusLibDir?.let { libDir -> target.binaries.configureEach { linkerOpts("-L$libDir") } }
-            listOf("main", "test").forEach { compilationName ->
-                target.compilations.getByName(compilationName) {
-                    cinterops {
-                        create("dbus") {
-                            defFile(project.file("src/linuxMain/cinterop/dbus.def"))
-                            compilerOpts(*dbusCompilerOpts)
-                        }
+    // Keep targets and cinterops identical on every host so publication metadata includes Linux.
+    // Cross-compilation uses Linux headers staged by CI; native Linux builds use pkg-config.
+    val dbusHeaders = providers.gradleProperty("filekit.dbusHeaders").orNull
+    val dbusCompilerOpts = when {
+        dbusHeaders != null -> arrayOf("-I${rootProject.file(dbusHeaders).absolutePath}")
+        HostManager.hostIsLinux -> resolvePkgConfigArgs("--cflags")
+        else -> emptyArray()
+    }
+    val dbusLibDir = if (HostManager.hostIsLinux) resolvePkgConfigVariable("libdir") else null
+
+    listOf(linuxX64(), linuxArm64()).forEach { target ->
+        dbusLibDir?.let { libDir -> target.binaries.configureEach { linkerOpts("-L$libDir") } }
+        listOf("main", "test").forEach { compilationName ->
+            target.compilations.getByName(compilationName) {
+                cinterops {
+                    create("dbus") {
+                        defFile(project.file("src/linuxMain/cinterop/dbus.def"))
+                        compilerOpts(*dbusCompilerOpts)
                     }
                 }
             }
         }
+    }
 
-        sourceSets {
-            // The libdbus client must not live in `linuxMain`: its metadata compilation cannot see
-            // target cinterop bindings, so the file is compiled into both Linux target compilations.
-            getByName("linuxX64Main") { kotlin.srcDir("src/linuxDbusMain/kotlin") }
-            getByName("linuxArm64Main") { kotlin.srcDir("src/linuxDbusMain/kotlin") }
-        }
+    sourceSets {
+        // Shared metadata cannot see target cinterop bindings.
+        getByName("linuxX64Main") { kotlin.srcDir("src/linuxDbusMain/kotlin") }
+        getByName("linuxArm64Main") { kotlin.srcDir("src/linuxDbusMain/kotlin") }
     }
 
     sourceSets {
```

**File**: `filekit-dialogs/src/linuxDbusMain/kotlin/io/github/vinceglb/filekit/dialogs/platform/linux/XdgPortalDbusClient.kt` (modified, +5/-4)
```diff
@@ -22,7 +22,7 @@ import dbus.dbus_connection_close
 import dbus.dbus_connection_flush
 import dbus.dbus_connection_get_is_connected
 import dbus.dbus_connection_pop_message
-import dbus.dbus_connection_read_write_dispatch
+import dbus.dbus_connection_read_write
 import dbus.dbus_connection_send_with_reply_and_block
 import dbus.dbus_connection_unref
 import dbus.dbus_error_free
@@ -65,7 +65,7 @@ private const val PORTAL_RESPONSE_MATCH_RULE =
     "type='signal',interface='org.freedesktop.portal.Request',member='Response'"
 
 private const val NO_TIMEOUT = -1
-private const val READ_WRITE_DISPATCH_TIMEOUT_MS = 100
+private const val READ_WRITE_TIMEOUT_MS = 100
 
 private fun MemScope.appendVariant(
     iter: CPointer<DBusMessageIter>,
@@ -269,7 +269,7 @@ private fun MemScope.readRequestHandle(
     return readString(iter.ptr)
 }
 
-private fun MemScope.awaitPortalResponse(
+internal fun MemScope.awaitPortalResponse(
     connection: CPointer<DBusConnection>,
     handlePath: String,
 ): List<String>? {
@@ -279,7 +279,8 @@ private fun MemScope.awaitPortalResponse(
                 "The connection to the D-Bus session bus was lost while waiting for the XDG portal response",
             )
         }
-        dbus_connection_read_write_dispatch(connection, READ_WRITE_DISPATCH_TIMEOUT_MS)
+        // Messages are consumed below; dispatching here could discard a queued Response.
+        dbus_connection_read_write(connection, READ_WRITE_TIMEOUT_MS)
 
         while (true) {
             val message = dbus_connection_pop_message(connection) ?: break
```

---

### Incident Patch 14: `d45177e4` (2026-08-10)
**Commit Message**: 🐛 Only resolve dbus pkg-config on Linux hosts

**File**: `filekit-dialogs/build.gradle.kts` (modified, +7/-3)
```diff
@@ -24,6 +24,7 @@ fun resolvePkgConfigArgs(argument: String): Array<String> = runCatching {
     providers
         .exec {
             commandLine("pkg-config", argument, "dbus-1")
+            isIgnoreExitValue = true
         }.standardOutput
         .asText
         .get()
@@ -37,15 +38,13 @@ fun resolvePkgConfigVariable(variable: String): String? = runCatching {
     providers
         .exec {
             commandLine("pkg-config", "--variable=$variable", "dbus-1")
+            isIgnoreExitValue = true
         }.standardOutput
         .asText
         .get()
         .trim()
 }.getOrNull()?.takeIf { it.isNotEmpty() }
 
-val dbusCompilerOpts = resolvePkgConfigArgs("--cflags")
-val dbusLibDir = resolvePkgConfigVariable("libdir")
-
 jvmTest.configure {
     dependsOn(headlessAwtFilePickerTest)
 }
@@ -72,6 +71,11 @@ kotlin {
     val isLinuxHost = HostManager.hostIsLinux
 
     if (isLinuxHost) {
+        // pkg-config failures are acceptable: when the dbus-1 development package is missing the
+        // D-Bus cinterop simply resolves no flags and the JVM targets remain buildable.
+        val dbusCompilerOpts = resolvePkgConfigArgs("--cflags")
+        val dbusLibDir = resolvePkgConfigVariable("libdir")
+
         listOf(linuxX64(), linuxArm64()).forEach { target ->
             // The konan linker does not search the distro's multiarch library dirs, so the host's
             // libdbus location must be passed explicitly. Native test binaries only link for the
```

---

### Incident Patch 15: `12e4aac0` (2026-08-10)
**Commit Message**: 🐛 Fix Linux picker review issues: host-gated targets, raw current_folder, UTF-8 decoding

**File**: `.github/workflows/ci.yml` (modified, +6/-0)
```diff
@@ -17,6 +17,9 @@ jobs:
       - name: 🛎️ Check out repository
         uses: actions/checkout@v6
 
+      - name: 🔧 Install Linux dialog dependencies
+        run: sudo apt-get update && sudo apt-get install -y libdbus-1-dev
+
       - name: 🍉 Configure JDK 21
         uses: actions/setup-java@v5
         with:
@@ -142,6 +145,9 @@ jobs:
       - name: 🛎️ Check out repository
         uses: actions/checkout@v6
 
+      - name: 🔧 Install Linux dialog dependencies
+        run: sudo apt-get update && sudo apt-get install -y libdbus-1-dev
+
       - name: 🍉 Configure JDK 21
         uses: actions/setup-java@v5
         with:
```

**File**: `build-logic/convention/src/main/kotlin/KotlinMultiplatformLibraryConventionPlugin.kt` (modified, +6/-1)
```diff
@@ -6,6 +6,7 @@ import org.gradle.api.Plugin
 import org.gradle.api.Project
 import org.gradle.kotlin.dsl.configure
 import org.jetbrains.kotlin.gradle.dsl.KotlinMultiplatformExtension
+import org.jetbrains.kotlin.konan.target.HostManager
 
 @Suppress("ktlint:standard:chain-method-continuation", "unused")
 class KotlinMultiplatformLibraryConventionPlugin : Plugin<Project> {
@@ -18,6 +19,10 @@ class KotlinMultiplatformLibraryConventionPlugin : Plugin<Project> {
 
             println("Module [$moduleName] - $modulePackage")
 
+            // The libdbus cinterop of `filekit-dialogs` needs the D-Bus development headers from the
+            // host machine, so its Linux targets are only created when building on Linux.
+            val isLinuxHost = HostManager.hostIsLinux
+
             // Kotlin Multiplatform
             extensions.configure<KotlinMultiplatformExtension> {
                 configureKotlinMultiplatform(
@@ -27,7 +32,7 @@ class KotlinMultiplatformLibraryConventionPlugin : Plugin<Project> {
                     addMacosTargets = true,
                     addWatchosTargets = path == ":filekit-core",
                     addMingwTargets = path == ":filekit-core" || path == ":filekit-dialogs",
-                    addLinuxTargets = path == ":filekit-core" || path == ":filekit-dialogs",
+                    addLinuxTargets = path == ":filekit-core" || (path == ":filekit-dialogs" && isLinuxHost),
                 )
             }
         }
```

**File**: `docs/dialogs/setup.mdx` (modified, +2/-0)
```diff
@@ -59,3 +59,5 @@ compose.desktop {
 This prevents a `NoClassDefFoundError` in some cases. Read more about this issue in the [GitHub issue #107](https://github.com/vinceglb/FileKit/issues/107).
 
 If using the Kotlin/Native Linux target (`linuxX64` or `linuxArm64`), dialogs are provided out of the box through the GNOME XDG Desktop Portal. The portal file chooser is shown on systems running `xdg-desktop-portal` (default on GNOME and other modern desktops); the application binary links against `libdbus-1`, which is present on every D-Bus enabled system.
+
+Building `filekit-dialogs` for Linux native targets requires the D-Bus development headers (`libdbus-1-dev` on Debian/Ubuntu) on the build machine, which is why the Linux targets are only enabled on Linux hosts.
```

**File**: `filekit-dialogs/build.gradle.kts` (modified, +24/-17)
```diff
@@ -1,4 +1,5 @@
 import org.gradle.api.tasks.testing.Test
+import org.jetbrains.kotlin.konan.target.HostManager
 
 plugins {
     alias(libs.plugins.filekit.kotlinMultiplatformLibrary)
@@ -66,28 +67,34 @@ kotlin {
         }
     }
 
-    listOf(linuxX64(), linuxArm64()).forEach { target ->
-        // The konan linker does not search the distro's multiarch library dirs, so the host's
-        // libdbus location must be passed explicitly. Native test binaries only link for the
-        // host architecture, so the host libdir is always correct there.
-        dbusLibDir?.let { libDir -> target.binaries.configureEach { linkerOpts("-L$libDir") } }
-        listOf("main", "test").forEach { compilationName ->
-            target.compilations.getByName(compilationName) {
-                cinterops {
-                    create("dbus") {
-                        defFile(project.file("src/linuxMain/cinterop/dbus.def"))
-                        compilerOpts(*dbusCompilerOpts)
+    // The libdbus cinterop requires the D-Bus development headers from the host machine, so the
+    // Linux targets are only created on Linux hosts (see the module convention plugin).
+    val isLinuxHost = HostManager.hostIsLinux
+
+    if (isLinuxHost) {
+        listOf(linuxX64(), linuxArm64()).forEach { target ->
+            // The konan linker does not search the distro's multiarch library dirs, so the host's
+            // libdbus location must be passed explicitly. Native test binaries only link for the
+            // host architecture, so the host libdir is always correct there.
+            dbusLibDir?.let { libDir -> target.binaries.configureEach { linkerOpts("-L$libDir") } }
+            listOf("main", "test").forEach { compilationName ->
+                target.compilations.getByName(compilationName) {
+                    cinterops {
+                        create("dbus") {
+                            defFile(project.file("src/linuxMain/cinterop/dbus.def"))
+                            compilerOpts(*dbusCompilerOpts)
+                        }
                     }
                 }
             }
         }
-    }
 
-    sourceSets {
-        // The libdbus client must not live in `linuxMain`: its metadata compilation cannot see
-        // target cinterop bindings, so the file is compiled into both Linux target compilations.
-        getByName("linuxX64Main") { kotlin.srcDir("src/linuxDbusMain/kotlin") }
-        getByName("linuxArm64Main") { kotlin.srcDir("src/linuxDbusMain/kotlin") }
+        sourceSets {
+            // The libdbus client must not live in `linuxMain`: its metadata compilation cannot see
+            // target cinterop bindings, so the file is compiled into both Linux target compilations.
+            getByName("linuxX64Main") { kotlin.srcDir("src/linuxDbusMain/kotlin") }
+            getByName("linuxArm64Main") { kotlin.srcDir("src/linuxDbusMain/kotlin") }
+        }
     }
 
     sourceSets {
```

**File**: `filekit-dialogs/src/linuxMain/kotlin/io/github/vinceglb/filekit/dialogs/FileKit.linux.kt` (modified, +5/-5)
```diff
@@ -148,13 +148,13 @@ private fun openPortalDialog(
 }
 
 /**
- * Builds the `current_folder` portal option: a null-terminated bytestring holding the `file://` URI
- * of the folder, as expected by the portal FileChooser.
+ * Builds the `current_folder` portal option: a null-terminated bytestring holding the raw
+ * filesystem path of the folder, as expected by the portal FileChooser.
  */
 private fun createCurrentFolderOption(folder: PlatformFile): PortalVariant.Bytes {
-    val uri = "file://${folder.path}"
-    val bytes = ByteArray(uri.length + 1)
-    uri.encodeToByteArray().copyInto(bytes)
+    val path = folder.path
+    val bytes = ByteArray(path.length + 1)
+    path.encodeToByteArray().copyInto(bytes)
     return PortalVariant.Bytes(bytes)
 }
 
```

**File**: `filekit-dialogs/src/linuxMain/kotlin/io/github/vinceglb/filekit/dialogs/platform/linux/XdgPortalModel.kt` (modified, +17/-7)
```diff
@@ -149,21 +149,31 @@ internal fun portalUriToFilePath(uri: String): String? {
     }
 }
 
+/**
+ * Decodes percent-encoded characters in a URI. Encoded bytes are collected together with the UTF-8
+ * bytes of literal characters and decoded as UTF-8, so non-ASCII filenames such as `café.txt`
+ * survive the round trip.
+ */
 internal fun percentDecode(value: String): String {
-    val builder = StringBuilder(value.length)
+    val bytes = mutableListOf<Byte>()
     var index = 0
     while (index < value.length) {
         val char = value[index]
         if (char == '%' && index + 3 <= value.length) {
-            val decoded = value.substring(index + 1, index + 3).toIntOrNull(16)
-            if (decoded != null) {
-                builder.append(decoded.toChar())
+            val hex = value.substring(index + 1, index + 3).toIntOrNull(16)
+            if (hex != null) {
+                bytes += hex.toByte()
                 index += 3
                 continue
             }
         }
-        builder.append(char)
-        index += 1
+        val end = if (char.isHighSurrogate() && index + 1 < value.length && value[index + 1].isLowSurrogate()) {
+            index + 2
+        } else {
+            index + 1
+        }
+        value.substring(index, end).encodeToByteArray().forEach { bytes += it }
+        index = end
     }
-    return builder.toString()
+    return bytes.toByteArray().decodeToString()
 }
```

**File**: `filekit-dialogs/src/linuxTest/kotlin/io/github/vinceglb/filekit/dialogs/platform/linux/XdgPortalModelTest.kt` (modified, +18/-0)
```diff
@@ -95,6 +95,14 @@ class XdgPortalModelTest {
         )
     }
 
+    @Test
+    fun portalUriToFilePath_utf8EncodedPath_returnsDecodedPath() {
+        assertEquals(
+            "/home/user/café.png",
+            portalUriToFilePath("file:///home/user/caf%C3%A9.png"),
+        )
+    }
+
     @Test
     fun portalUriToFilePath_localhostUri_returnsDecodedPath() {
         assertEquals(
@@ -116,6 +124,16 @@ class XdgPortalModelTest {
         )
     }
 
+    @Test
+    fun percentDecode_utf8EncodedCharacters_returnsDecoded() {
+        assertEquals("/home/user/café.png", percentDecode("/home/user/caf%C3%A9.png"))
+    }
+
+    @Test
+    fun percentDecode_literalNonAsciiCharacters_returnsDecoded() {
+        assertEquals("/home/user/café.png", percentDecode("/home/user/café.png"))
+    }
+
     @Test
     fun percentDecode_noEncoding_returnsInput() {
         assertEquals("/plain/path.txt", percentDecode("/plain/path.txt"))
```

#### Recent Merged Pull Requests:
- **PR #664** (2026-09-30): Bump compose-multiplatform from 1.12.0 to 1.12.1 (@dependabot[bot])
- **PR #663** (2026-09-30): Bump gradle-wrapper from 9.7.1 to 9.8.0 (@dependabot[bot])
- **PR #661** (2026-09-30): Bump nucleus from 2.5.15 to 2.5.16 (@dependabot[bot])
- **PR #660** (2026-09-30): Bump io.coil-kt.coil3:coil-compose from 3.6.2 to 3.6.3 (@dependabot[bot])
- **PR #659** (2026-09-30): Bump dbus-java from 5.2.0 to 5.2.1 (@dependabot[bot])
- **PR #658** (2026-09-15): 🐛 Preserve Android document tree parents (@vinceglb)
- **PR #657** (closed): Bump org.robolectric:robolectric from 4.16.1 to 4.17 (@dependabot[bot])
- **PR #656** (closed): Bump org.jetbrains.compose.material3:material3 from 1.12.0-alpha03 to 1.13.0-alpha01 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
