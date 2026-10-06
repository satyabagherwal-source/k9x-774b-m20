# Forensic Learning Record (Deep Inspection): lysine-dev/okio

> **Canonical Artifact**: `07_PROJECT_LEARNING/lysine-dev-okio-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lysine-dev/okio](https://github.com/lysine-dev/okio))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:41:35.026Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lysine-dev/okio`
- **Description**: A modern I/O library for Android, Java, and Kotlin Multiplatform.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 9048 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `okio/jvm/jmh/src/jmh/java/com/squareup/okio/benchmarks/BenchmarkUtils.kt`
```
/*
 * Copyright (C) 2018 Square, Inc. and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
@file:Suppress(
  "CANNOT_OVERRIDE_INVISIBLE_MEMBER",
  "INVISIBLE_MEMBER",
  "INVISIBLE_REFERENCE",
)

package com.squareup.okio.benchmarks

import okio.internal.commonAsUtf8ToByteArray
import okio.internal.commonToUtf8String

// Necessary to make an invisible functions visible to Java.
object BenchmarkUtils {
  @JvmStatic
  fun ByteArray.decodeUtf8(): String {
    return commonToUtf8String()
  }

  @JvmStatic
  fun String.encodeUtf8(): ByteArray {
    return commonAsUtf8ToByteArray()
  }
}

```

### Core Architecture Module: `okio/src/commonMain/kotlin/okio/Util.kt`
```
/*
 * Copyright (C) 2018 Square, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
@file:JvmName("-SegmentedByteString") // A leading '-' hides this class from Java.

package okio

import kotlin.jvm.JvmName
import okio.internal.HEX_DIGIT_CHARS

internal fun checkOffsetAndCount(size: Long, offset: Long, byteCount: Long) {
  if (offset or byteCount < 0 || offset > size || size - offset < byteCount) {
    throw ArrayIndexOutOfBoundsException("size=$size offset=$offset byteCount=$byteCount")
  }
}

/* ktlint-disable no-multi-spaces indent */

internal fun Short.reverseBytes(): Short {
  val i = toInt() and 0xffff
  val reversed = (i and 0xff00 ushr 8) or
    (i and 0x00ff  shl 8)
  return reversed.toShort()
}

internal fun Int.reverseBytes(): Int {
  return (this and -0x1000000 ushr 24) or
    (this and 0x00ff0000 ushr  8) or
    (this and 0x0000ff00  shl  8) or
    (this and 0x000000ff  shl 24)
}

internal fun Long.reverseBytes(): Long {
  return (this and -0x100000000000000L ushr 56) or
    (this and 0x00ff000000000000L ushr 40) or
    (this and 0x0000ff0000000000L ushr 24) or
    (this and 0x000000ff00000000L ushr  8) or
    (this and 0x00000000ff000000L  shl  8) or
    (this and 0x0000000000ff0000L  shl 24) or
    (this and 0x000000000000ff00L  shl 40) or
    (this and 0x00000000000000ffL  shl 56)
}

/* ktlint-enable no-multi-spaces indent */

@Suppress("NOTHING_TO_INLINE") // Syntactic sugar.
internal inline infix fun Int.leftRotate(bitCount: Int): Int {
  return (this shl bitCount) or (this ushr (32 - bitCount))
}

@Suppress("NOTHING_TO_INLINE") // Syntactic sugar.
internal inline infix fun Long.rightRotate(bitCount: Int): Long {
  return (this ushr bitCount) or (this shl (64 - bitCount))
}

@Suppress("NOTHING_TO_INLINE") // Syntactic sugar.
internal inline infix fun Byte.shr(other: Int): Int = toInt() shr other

@Suppress("NOTHING_TO_INLINE") // Syntactic sugar.
internal inline infix fun Byte.shl(other: Int): Int = toInt() shl other

@Suppress("NOTHING_TO_INLINE") // Syntactic sugar.
internal inline infix fun Byte.and(other: Int): Int = toInt() and other

@Suppress("NOTHING_TO_INLINE") // Syntactic sugar.
internal inline infix fun Byte.and(other: Long): Long = toLong() and other

@Suppress("NOTHING_TO_INLINE") // Pending `kotlin.experimental.xor` becoming stable
internal inline infix fun Byte.xor(other: Byte): Byte = (toInt() xor other.toInt()).toByte()

@Suppress("NOTHING_TO_INLINE") // Syntactic sugar.
internal inline infix fun Int.and(other: Long): Long = toLong() and other

@Suppress("NOTHING_TO_INLINE") // Syntactic sugar.
internal inline fun minOf(a: Long, b: Int): Long = minOf(a, b.toLong())

@Suppress("NOTHING_TO_INLINE") // Syntactic sugar.
internal inline fun minOf(a: Int, b: Long): Long = minOf(a.toLong(), b)

internal fun arrayRangeEquals(
  a: ByteArray,
  aOffset: Int,
  b: ByteArray,
  bOffset: Int,
  byteCount: Int,
): Boolean {
  for (i in 0 until byteCount) {
    if (a[i + aOffset] != b[i + bOffset]) return false
  }
  return true
}

internal fun Byte.toHexString(): String {
  val result = CharArray(2)
  result[0] = HEX_DIGIT_CHARS[this shr 4 and 0xf]
  result[1] = HEX_DIGIT_CHARS[this       and 0xf] // ktlint-disable no-multi-spaces
  return result.concatToString()
}

internal fun Int.toHexString(): String {
  if (this == 0) return "0" // Required as code below does not handle 0

  val result = CharArray(8)
  result[0] = HEX_DIGIT_CHARS[this shr 28 and 0xf]
  result[1] = HEX_DIGIT_CHARS[this shr 24 and 0xf]
  result[2] = HEX_DIGIT_CHARS[this shr 20 and 0xf]
  result[3] = HEX_DIGIT_CHARS[this shr 16 and 0xf]
  result[4] = HEX_DIGIT_CHARS[this shr 12 and 0xf]
  result[5] = HEX_DIGIT_CHARS[this shr 8  and 0xf] // ktlint-disable no-multi-spaces
  result[6] = HEX_DIGIT_CHARS[this shr 4  and 0xf] // ktlint-disable no-multi-spaces
  result[7] = HEX_DIGIT_CHARS[this        and 0xf] // ktlint-disable no-multi-spaces

  // Find the first non-zero index
  var i = 0
  while (i < result.size) {
    if (result[i] != '0') break
    i++
  }

  return result.concatToString(i, result.size)
}

internal fun Long.toHexString(): String {
  if (this == 0L) return "0" // Required as code below does not handle 0

  val result = CharArray(16)
  result[ 0] = HEX_DIGIT_CHARS[(this shr 60 and 0xf).toInt()] // ktlint-disable no-multi-spaces
  result[ 1] = HEX_DIGIT_CHARS[(this shr 56 and 0xf).toInt()] // ktlint-disable no-multi-spaces
  result[ 2] = HEX_DIGIT_CHARS[(this shr 52 and 0xf).toInt()] // ktlint-disable no-multi-spaces
  result[ 3] = HEX_DIGIT_CHARS[(this shr 48 and 0xf).toInt()] // ktlint-disable no-multi-spaces
  result[ 4] = HEX_DIGIT_CHARS[(this shr 44 and 0xf).toInt()] // ktlint-disable no-multi-spaces
  result[ 5] = HEX_DIGIT_CHARS[(this shr 40 and 0xf).toInt()] // ktlint-disable no-multi-spaces
  result[ 6] = HEX_DIGIT_CHARS[(this shr 36 and 0xf).toInt()] // ktlint-disable no-multi-spaces
  result[ 7] = HEX_DIGIT_CHARS[(this shr 32 and 0xf).toInt()] // ktlint-disable no-multi-spaces
  result[ 8] = HEX_DIGIT_CHARS[(this shr 28 and 0xf).toInt()] // ktlint-disable no-multi-spaces
  result[ 9] = HEX_DIGIT_CHARS[(this shr 24 and 0xf).toInt()] // ktlint-disable no-multi-spaces
  result[10] = HEX_DIGIT_CHARS[(this shr 20 and 0xf).toInt()]
  result[11] = HEX_DIGIT_CHARS[(this shr 16 and 0xf).toInt()]
  result[12] = HEX_DIGIT_CHARS[(this shr 12 and 0xf).toInt()]
  result[13] = HEX_DIGIT_CHARS[(this shr 8  and 0xf).toInt()] // ktlint-disable no-multi-spaces
  result[14] = HEX_DIGIT_CHARS[(this shr 4  and 0xf).toInt()] // ktlint-disable no-multi-spaces
  result[15] = HEX_DIGIT_CHARS[(this        and 0xf).toInt()] // ktlint-disable no-multi-spaces

  // Find the first non-zero index
  var i = 0
  while (i < result.size) {
    if (result[i] != '0') break
    i++
  }

  return result.concatToString(i, result.size)
}

```

### Core Architecture Module: `okio-assetfilesystem/src/main/kotlin/okio/assetfilesystem/AssetFileSystem.kt`
```
/*
 * Copyright (C) 2023 Square, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package okio.assetfilesystem

import android.content.res.AssetManager
import java.io.FileNotFoundException
import java.io.IOException
import java.io.InputStream
import okio.FileHandle
import okio.FileMetadata
import okio.FileSystem
import okio.Path
import okio.Path.Companion.toPath
import okio.Sink
import okio.Source
import okio.source

/**
 * Expose this [AssetManager] as an Okio [FileSystem].
 *
 * Note: Assets are a read-only view on a file system and so any attempt to mutate
 * will throw an [IOException].
 */
fun AssetManager.asFileSystem(): FileSystem = AssetFileSystem(this)

private class AssetFileSystem(
  private val assets: AssetManager,
) : FileSystem() {
  override fun canonicalize(path: Path): Path {
    val canonical = canonicalizeInternal(path)
    if (canonical.existsInternal()) {
      return canonical
    }
    throw FileNotFoundException("$path")
  }

  private fun canonicalizeInternal(path: Path) = ROOT.resolve(path, normalize = true)

  private fun Path.toAssetRelativePathString(): String {
    return toString().removePrefix("/")
  }

  /**
   * Determine if [this] is a valid path to a file or directory.
   *
   * If this function returns true, a call to [AssetManager.open] will either return successfully
   * or throw [FileNotFoundException] based on whether [this] is a file or directory, respectively.
   */
  private fun Path.existsInternal(): Boolean {
    if (this == ROOT) {
      return true
    }

    // Both non-existent paths and paths to existing files return an empty array when listing.
    // Determine if a path exists by checking if its name is present in the parent's list.
    val parent = checkNotNull(parent) { "Path has no parent. Did you canonicalize? $this" }

    val children = try {
      assets.list(parent.toAssetRelativePathString()).orEmpty()
    } catch (_: FileNotFoundException) {
      emptyArray()
    }

    return name in children
  }

  override fun metadataOrNull(path: Path): FileMetadata? {
    val canonical = canonicalizeInternal(path)
    if (canonical.existsInternal()) {
      val pathString = canonical.toAssetRelativePathString()
      return try {
        assets.open(pathString).close()
        FileMetadata(
          isRegularFile = true,
          isDirectory = false,
        )
      } catch (_: FileNotFoundException) {
        FileMetadata(
          isRegularFile = false,
          isDirectory = true,
        )
      }
    }
    return null
  }

  override fun list(dir: Path): List<Path> {
    val canonical = canonicalizeInternal(dir)
    if (canonical.existsInternal()) {
      val pathString = canonical.toAssetRelativePathString()
      try {
        // This will throw if the path points to a file.
        assets.open(pathString).close()
      } catch (_: FileNotFoundException) {
        return assets.list(pathString)
          ?.map { it.toPath() }
          .orEmpty()
      }
    }
    throw FileNotFoundException("$dir")
  }

  override fun listOrNull(dir: Path): List<Path>? {
    return try {
      list(dir)
    } catch (_: IOException) {
      null
    }
  }

  override fun openReadOnly(file: Path): FileHandle {
    val pathString = canonicalizeInternal(file).toAssetRelativePathString()
    val inputStream = assets.open(pathString)
    return AssetFileHandle(assets, pathString, inputStream)
  }

  override fun openReadWrite(file: Path, mustCreate: Boolean, mustExist: Boolean): FileHandle {
    throw IOException("asset file systems are read-only")
  }

  override fun source(file: Path): Source {
    return assets.open(canonicalizeInternal(file).toAssetRelativePathString()).source()
  }

  override fun sink(file: Path, mustCreate: Boolean): Sink {
    throw IOException("asset file systems are read-only")
  }

  override fun appendingSink(file: Path, mustExist: Boolean): Sink {
    throw IOException("asset file systems are read-only")
  }

  override fun createDirectory(dir: Path, mustCreate: Boolean) {
    throw IOException("asset file systems are read-only")
  }

  override fun atomicMove(source: Path, target: Path) {
    throw IOException("asset file systems are read-only")
  }

  override fun delete(path: Path, mustExist: Boolean) {
    throw IOException("asset file systems are read-only")
  }

  override fun createSymlink(source: Path, target: Path) {
    throw IOException("asset file systems are read-only")
  }

  private companion object {
    val ROOT = "/".toPath()
  }
}

private class AssetFileHandle(
  private val assets: AssetManager,
  private val pathString: String,
  private var inputStream: InputStream,
) : FileHandle(false) {
  private var currentOffset = 0
  private var size = -1

  override fun protectedRead(
    fileOffset: Long,
    array: ByteArray,
    arrayOffset: Int,
    byteCount: Int,
  ): Int {
    // If we need to jump backwards or have reached the end of the file,
    // close the existing stream and open a new one.
    if (currentOffset > fileOffset || currentOffset == size) {
      inputStream.close()
      inputStream = assets.open(pathString)
      currentOffset = 0
    }

    while (true) {
      val skip = fileOffset - currentOffset
      if (skip == 0L) break
      val skipped = inputStream.skip(skip).toInt()
      if (skipped == 0) {
        // Since we know skip is never negative, a skip of 0 means EOF.
        // Record this as the file size to trigger stream recreation.
        size = currentOffset
        throw IllegalArgumentException("fileOffset $fileOffset > size $size")
      }
      currentOffset += skipped
    }

    val read = inputStream.read(array, arrayOffset, byteCount)
    if (read == -1) {
      // A read of -1 means EOF. Record this as the file size to trigger stream recreation.
      size = currentOffset
    } else {
      currentOffset += read
    }
    return read
  }

  override fun protectedSize(): Long {
    if (size == -1) {
      while (true) {
        val skipped = inputStream.skip(1024 * 1024).toInt()
        if (skipped == 0) {
          size = currentOffset
          break
        }
        currentOffset += skipped
      }
    }
    return size.toLong()
  }

  override fun protectedClose() {
    inputStream.close()
  }

  override fun protectedWrite(
    fileOffset: Long,
    array: ByteArray,
    arrayOffset: Int,
    byteCount: Int,
  ) {
    throw AssertionError()
  }

  override fun protectedFlush() {
    throw AssertionError()
  }

  override fun protectedResize(size: Long) {
    throw AssertionError()
  }
}

```

### Core Architecture Module: `okio-fakefilesystem/src/commonMain/kotlin/okio/fakefilesystem/FakeFileSystem.kt`
```
/*
 * Copyright (C) 2020 Square, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package okio.fakefilesystem

import kotlin.jvm.JvmName
import kotlin.reflect.KClass
import kotlin.time.Instant
import kotlinx.datetime.Clock
import okio.ArrayIndexOutOfBoundsException
import okio.Buffer
import okio.ByteString
import okio.FileHandle
import okio.FileMetadata
import okio.FileNotFoundException
import okio.FileSystem
import okio.IOException
import okio.Path
import okio.Path.Companion.toPath
import okio.Sink
import okio.Source
import okio.fakefilesystem.FakeFileSystem.Element.Directory
import okio.fakefilesystem.FakeFileSystem.Element.File
import okio.fakefilesystem.FakeFileSystem.Element.Symlink
import okio.fakefilesystem.FakeFileSystem.Operation.READ
import okio.fakefilesystem.FakeFileSystem.Operation.WRITE

/**
 * A fully in-memory file system useful for testing. It includes features to support writing
 * better tests.
 *
 * Use [openPaths] to see which paths have been opened for read or write, but not yet closed. Tests
 * should call [checkNoOpenFiles] in `tearDown()` to confirm that no file streams were leaked.
 *
 * Strict By Default
 * -----------------
 *
 * These actions are not allowed and throw an [IOException] if attempted:
 *
 *  * Moving a file that is currently open for reading or writing.
 *  * Deleting a file that is currently open for reading or writing.
 *  * Moving a file to a path that currently resolves to an empty directory.
 *  * Reading and writing the same file at the same time.
 *  * Opening a file for writing that is already open for writing.
 *
 * Programs that do not attempt any of the above operations should work fine on both UNIX and
 * Windows systems. Relax these constraints individually or call [emulateWindows] or [emulateUnix];
 * to apply the constraints of a particular operating system.
 *
 * Closeable
 * ---------
 *
 * This file system cannot be used after it is closed. Closing it does not close any of its open
 * streams; those must be closed directly.
 */
class FakeFileSystem private constructor(
  private val clockNowMillis: () -> Long,
) : FileSystem() {

  constructor() : this(clockNowMillis = defaultClockNowMillis)

  constructor(clock: kotlin.time.Clock = kotlin.time.Clock.System) : this(
    clockNowMillis = { clock.now().toEpochMilliseconds() },
  )

  // Avoid calling kotlinx.datetime.Clock.System.now() because it crashes at runtime if the Kotlin
  // stdlib isn't 2.1.20+. (That'll be the case when running in Gradle 8.x.)
  @Deprecated(
    "Use the constructor that accepts a kotlin.time.Clock, or the no-args constructor",
    level = DeprecationLevel.HIDDEN,
  )
  constructor(clock: Clock = Clock.System) : this(
    when {
      clock === Clock.System -> defaultClockNowMillis
      else -> {
        { clock.now().toEpochMilliseconds() }
      }
    },
  )

  /** Returns the clock used to timestamp files. */
  // We construct this on-demand to avoid a NoClassDefFoundError if there's no kotlin.time.Clock.
  val clock: kotlin.time.Clock
    get() = object : kotlin.time.Clock {
      override fun now() = Instant.fromEpochMilliseconds(clockNowMillis())
    }

  /** File system roots. Each element is a Directory and is created on-demand. */
  private val roots = mutableMapOf<Path, Directory>()

  /** Files that are currently open and need to be closed to avoid resource leaks. */
  private val openFiles = mutableListOf<OpenFile>()

  /** Forbid all access after [close]. */
  private var closed = false

  /**
   * An absolute path with this file system's current working directory. Relative paths will be
   * resolved against this directory when they are used.
   */
  var workingDirectory: Path = "/".toPath()
    set(value) {
      require(value.isAbsolute) {
        "expected an absolute path but was $value"
      }
      field = value
    }

  /**
   * True to allow files to be moved even if they're currently open for read or write. UNIX file
   * systems typically allow open files to be moved; Windows file systems do not.
   */
  var allowMovingOpenFiles = false

  /**
   * True to allow files to be deleted even if they're currently open for read or write. UNIX file
   * systems typically allow open files to be deleted; Windows file systems do not.
   */
  var allowDeletingOpenFiles = false

  /**
   * True to allow the target of an [atomicMove] operation to be an empty directory. Windows file
   * systems typically allow files to replace empty directories; UNIX file systems do not.
   */
  var allowClobberingEmptyDirectories = false

  /**
   * True to permit a file to have multiple [sinks][sink] open at the same time. Both Windows and
   * UNIX file systems permit this but the result may be undefined.
   */
  var allowWritesWhileWriting = false

  /**
   * True to permit a file to have a [source] and [sink] open at the same time. Both Windows and
   * UNIX file systems permit this but the result may be undefined.
   */
  var allowReadsWhileWriting = false

  /**
   * True to allow symlinks to be created. UNIX file systems typically allow symlinks; Windows file
   * systems do not. Setting this to false after creating a symlink does not prevent that symlink
   * from being returned or used.
   */
  var allowSymlinks = false

  /**
   * Canonical paths for every file and directory in this file system. This omits file system roots
   * like `C:\` and `/`.
   */
  @get:JvmName("allPaths")
  val allPaths: Set<Path>
    get() {
      val result = mutableListOf<Path>()
      for (path in roots.keys) {
        result += listRecursively(path)
      }
      result.sort()
      return result.toSet()
    }

  /**
   * Canonical paths currently opened for reading or writing in the order they were opened. This may
   * contain duplicates if a single path is open by multiple readers.
   *
   * Note that this may contain paths not present in [allPaths]. This occurs if a file is deleted
   * while it is still open.
   *
   * The returned list is ordered by the order that the paths were opened.
   */
  @get:JvmName("openPaths")
  val openPaths: List<Path>
    get() = openFiles.map { it.canonicalPath }

  /**
   * Confirm that all files that have been opened on this file system (with [source], [sink], and
   * [appendingSink]) have since been closed. Call this in your test's `tearDown()` function to
   * confirm that your program hasn't leaked any open files.
   *
   * Forgetting to close a file on a real file system is a severe error that may lead to a program
   * crash. The operating system enforces a limit on how many files may be open simultaneously. On
   * Linux this is [getrlimit] and is commonly adjusted with the `ulimit` command.
   *
   * [getrlimit]: https://man7.org/linux/man-pages/man2/getrlimit.2.html
   *
   * @throws IllegalStateException if any files are open when this function is called.
   */
  fun checkNoOpenFiles() {
    val firstOpenFile = openFiles.firstOrNull() ?: return
    throw IllegalStateException(
      """
      |expected 0 open files, but found:
      |    ${openFiles.joinToString(separator = "\n    ") { it.canonicalPath.toString() }}
      """.trimMargin(),
      firstOpenFile.backtrace,
    )
  }

  /**
   * Configure this file system to use a Windows-like working directory (`F:\`, unless the working
   * directory is already Windows-like) and to follow a Windows-like policy on what operations
   * are permitted.
   */
  fun emulateWindows() {
    if ("\\" !in workingDirectory.toString()) {
      workingDirectory = "F:\\".toPath()
    }
    allowMovingOpenFiles = false
    allowDeletingOpenFiles = false
    allowClobberingEmptyDirectories = true
    allowWritesWhileWriting = true
    allowReadsWhileWriting = true
  }

  /**
   * Configure this file system to use a UNIX-like working directory (`/`, unless the working
   * directory is already UNIX-like) and to follow a UNIX-like policy on what operations are
   * permitted.
   */
  fun emulateUnix() {
    if ("/" !in workingDirectory.toString()) {
      workingDirectory = "/".toPath()
    }
    allowMovingOpenFiles = true
    allowDeletingOpenFiles = true
    allowClobberingEmptyDirectories = false
    allowWritesWhileWriting = true
    allowReadsWhileWriting = true
    allowSymlinks = true
  }

  override fun canonicalize(path: Path): Path {
    val canonicalPath = canonicalizeInternal(path)

    val lookupResult = lookupPath(canonicalPath)
    if (lookupResult?.element == null) {
      throw FileNotFoundException("no such file: $path")
    }

    return lookupResult.path
  }

  /** Don't throw [FileNotFoundException] if the path doesn't identify a file. */
  private fun canonicalizeInternal(path: Path): Path {
    check(!closed) { "closed" }
    return workingDirectory.resolve(path, normalize = true)
  }

  /**
   * Sets the metadata of type [type] on [path] to [value]. If [value] is null this clears that
   * metadata.
   *
   * Extras are not copied by [copy] but they are moved with [atomicMove].
   *
   * @throws IOException if [path] does not exist.
   */
  @Throws(IOException::class)
  fun <T : Any> setExtra(path: Path, type: KClass<out T>, value: T?) {
    val canonicalPath = canonicalizeInternal(path)
    val lookupResult = lookupPath(
      canonicalPath = canonicalPath,
      createRootOnDemand = canonicalPath.isRoot,
      resolveLastSymlink = false,
    )
    val element = lookupResult?.element ?: throw FileNotFoundException("no such file: $path")
    if (value == null) {
      element
```

### Core Architecture Module: `okio-fakefilesystem/src/commonMain/kotlin/okio/fakefilesystem/FileMetadataCommon.kt`
```
/*
 * Copyright (C) 2020 Square, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
@file:JvmMultifileClass
@file:JvmName("-Time")

package okio.fakefilesystem

import kotlin.jvm.JvmMultifileClass
import kotlin.jvm.JvmName
import kotlin.reflect.KClass
import kotlinx.datetime.Instant
import okio.FileMetadata
import okio.Path

@JvmName("newFileMetadata")
internal fun FileMetadata(
  isRegularFile: Boolean = false,
  isDirectory: Boolean = false,
  symlinkTarget: Path? = null,
  size: Long? = null,
  createdAt: Instant? = null,
  lastModifiedAt: Instant? = null,
  lastAccessedAt: Instant? = null,
  extras: Map<KClass<*>, Any> = mapOf(),
): FileMetadata {
  return FileMetadata(
    isRegularFile = isRegularFile,
    isDirectory = isDirectory,
    symlinkTarget = symlinkTarget,
    size = size,
    createdAtMillis = createdAt?.toEpochMilliseconds(),
    lastModifiedAtMillis = lastModifiedAt?.toEpochMilliseconds(),
    lastAccessedAtMillis = lastAccessedAt?.toEpochMilliseconds(),
    extras = extras,
  )
}

/**
 * Get the time from the best available clock.
 *
 * We'd prefer `kotlin.time.Clock` but it requires Kotlin 2.1.20+ and that isn't available to
 * Gradle plugins (at least for Gradle 8.x).
 */
internal expect val defaultClockNowMillis: () -> Long

```

### Core Architecture Module: `okio-fakefilesystem/src/jvmMain/kotlin/okio/fakefilesystem/FileMetadataJvm.kt`
```
/*
 * Copyright (C) 2025 Square, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
@file:JvmMultifileClass
@file:JvmName("-Time")

package okio.fakefilesystem

internal actual val defaultClockNowMillis: () -> Long = { System.currentTimeMillis() }

```

### Core Architecture Module: `okio-fakefilesystem/src/nonJvmMain/kotlin/okio/fakefilesystem/FileMetadataNonJvm.kt`
```
/*
 * Copyright (C) 2025 Square, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package okio.fakefilesystem

import kotlin.time.Clock

internal actual val defaultClockNowMillis: () -> Long = { Clock.System.now().toEpochMilliseconds() }

```

### Core Architecture Module: `okio-nodefilesystem/src/commonMain/kotlin/okio/FileSink.kt`
```
/*
 * Copyright (C) 2020 Square, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package okio

internal class FileSink(
  private val fd: Number,
) : Sink {
  private var closed = false

  override fun write(source: Buffer, byteCount: Long) {
    require(byteCount >= 0L) { "byteCount < 0: $byteCount" }
    require(source.size >= byteCount) { "source.size=${source.size} < byteCount=$byteCount" }
    check(!closed) { "closed" }

    val data = source.readByteArray(byteCount)
    val writtenByteCount = writeSync(fd, data)
    if (writtenByteCount.toLong() != byteCount) {
      throw IOException("expected $byteCount but was $writtenByteCount")
    }
  }

  override fun flush() {
  }

  override fun timeout(): Timeout {
    return Timeout.NONE
  }

  override fun close() {
    if (closed) return
    closed = true
    closeSync(fd)
  }
}

```

### Core Architecture Module: `okio-nodefilesystem/src/commonMain/kotlin/okio/FileSource.kt`
```
/*
 * Copyright (C) 2020 Square, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package okio

internal class FileSource(
  private val fd: Number,
) : Source {
  private var position_ = 0L
  private var closed = false

  override fun read(sink: Buffer, byteCount: Long): Long {
    require(byteCount >= 0L) { "byteCount < 0: $byteCount" }
    check(!closed) { "closed" }

    val data = ByteArray(byteCount.toInt())
    val readByteCount = readSync(
      fd = fd,
      buffer = data,
      length = byteCount.toDouble(),
      offset = 0.0,
      position = position_.toDouble(),
    ).toInt()

    if (readByteCount == 0) return -1L

    position_ += readByteCount

    sink.write(data, offset = 0, byteCount = readByteCount)

    return readByteCount.toLong()
  }

  override fun timeout(): Timeout = Timeout.NONE

  override fun close() {
    if (closed) return
    closed = true
    closeSync(fd)
  }
}

```

### Core Architecture Module: `okio-nodefilesystem/src/commonMain/kotlin/okio/FsJs.kt`
```
/*
 * Copyright (C) 2020 Square, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * This class declares the subset of Node.js file system APIs that we need in Okio.
 *
 *
 * Why not Dukat?
 * --------------
 *
 * This file does manually what ideally [Dukat] would do automatically.
 *
 * Dukat's generated stubs need awkward call sites to disambiguate overloads. For example, to call
 * `mkdirSync()` we must specify an options parameter even though we just want the default:
 *
 *   mkdirSync(dir.toString(), options = undefined as MakeDirectoryOptions?)
 *
 * By defining our own externals, we can omit the unwanted optional parameter from the declaration.
 * This leads to nicer calling code!
 *
 *   mkdirSync(dir.toString())
 *
 * Dukat also gets the nullability wrong for `Dirent.readSync()`.
 *
 *
 * Why not Kotlinx-nodejs?
 * -----------------------
 *
 * Even better than using Dukat directly would be to use the [official artifact][kotlinx_nodejs],
 * itself generated with Dukat. We also don't use the official Node.js artifact for the reasons
 * above, and also because it has an unstable API.
 *
 *
 * Updating this file
 * ------------------
 *
 * To declare new external APIs, run Dukat to generate a full set of Node stubs. The easiest way to
 * do this is to add an NPM dependency on `@types/node` in `jsMain`, like this:
 *
 * ```kotlin
 * jsMain {
 *   ...
 *   dependencies {
 *     implementation(npm("@types/node", "14.14.16", true))
 *     ...
 *   }
 * }
 * ```
 *
 * This will create a file with a full set of APIs to copy-paste from.
 *
 * ```
 * okio/build/externals/okio-parent-okio/src/fs.fs.module_node.kt
 * ```
 *
 * [Dukat]: https://github.com/kotlin/dukat
 * [kotlinx_nodejs]: https://github.com/Kotlin/kotlinx-nodejs
 */
@file:JsModule("fs")
@file:JsNonModule

package okio

import kotlin.js.Date

internal external fun closeSync(fd: Number)

internal external fun mkdirSync(path: String): String?

internal external fun openSync(path: String, flags: String): Double

internal external fun opendirSync(path: String): Dir

internal external fun readlinkSync(path: String): String

internal external fun readSync(fd: Number, buffer: ByteArray, offset: Double, length: Double, position: Double?): Double

internal external fun realpathSync(path: String): String

internal external fun renameSync(oldPath: String, newPath: String)

internal external fun rmdirSync(path: String)

internal external fun lstatSync(path: String): Stats

internal external fun fstatSync(fd: Number): Stats

internal external fun unlinkSync(path: String)

internal external fun writeSync(fd: Number, buffer: ByteArray): Double

internal external fun writeSync(fd: Number, buffer: ByteArray, offset: Double, length: Double, position: Double): Double

internal external fun ftruncateSync(fd: Number, len: Double)

internal external fun symlinkSync(target: String, path: String)

internal open external class Dir {
  open var path: String
  open fun closeSync()

  // Note that dukat's signature of readSync() returns a non-nullable Dirent; that's incorrect.
  open fun readSync(): Dirent?
}

internal open external class Dirent {
  open fun isFile(): Boolean
  open fun isDirectory(): Boolean
  open fun isBlockDevice(): Boolean
  open fun isCharacterDevice(): Boolean
  open fun isSymbolicLink(): Boolean
  open fun isFIFO(): Boolean
  open fun isSocket(): Boolean
  open var name: String
}

internal external interface StatsBase<T> {
  fun isFile(): Boolean
  fun isDirectory(): Boolean
  fun isBlockDevice(): Boolean
  fun isCharacterDevice(): Boolean
  fun isSymbolicLink(): Boolean
  fun isFIFO(): Boolean
  fun isSocket(): Boolean
  var dev: T
  var ino: T
  var mode: T
  var nlink: T
  var uid: T
  var gid: T
  var rdev: T
  var size: T
  var blksize: T
  var blocks: T
  var atimeMs: T
  var mtimeMs: T
  var ctimeMs: T
  var birthtimeMs: T
  var atime: Date
  var mtime: Date
  var ctime: Date
  var birthtime: Date
}

internal open external class Stats : StatsBase<Number> {
  override fun isFile(): Boolean
  override fun isDirectory(): Boolean
  override fun isBlockDevice(): Boolean
  override fun isCharacterDevice(): Boolean
  override fun isSymbolicLink(): Boolean
  override fun isFIFO(): Boolean
  override fun isSocket(): Boolean
  override var dev: Number
  override var ino: Number
  override var mode: Number
  override var nlink: Number
  override var uid: Number
  override var gid: Number
  override var rdev: Number
  override var size: Number
  override var blksize: Number
  override var blocks: Number
  override var atimeMs: Number
  override var mtimeMs: Number
  override var ctimeMs: Number
  override var birthtimeMs: Number
  override var atime: Date
  override var mtime: Date
  override var ctime: Date
  override var birthtime: Date
}

```

### Core Architecture Module: `okio-nodefilesystem/src/commonMain/kotlin/okio/NodeJsFileHandle.kt`
```
/*
 * Copyright (C) 2021 Square, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package okio

internal class NodeJsFileHandle(
  private val fd: Number,
  readWrite: Boolean,
) : FileHandle(readWrite) {
  override fun protectedSize(): Long {
    val stats = fstatSync(fd)
    return stats.size.toLong()
  }

  override fun protectedRead(
    fileOffset: Long,
    array: ByteArray,
    arrayOffset: Int,
    byteCount: Int,
  ): Int {
    val readByteCount = readSync(
      fd = fd,
      buffer = array,
      length = byteCount.toDouble(),
      offset = arrayOffset.toDouble(),
      position = fileOffset.toDouble(),
    ).toInt()

    if (readByteCount == 0) return -1

    return readByteCount
  }

  override fun protectedWrite(
    fileOffset: Long,
    array: ByteArray,
    arrayOffset: Int,
    byteCount: Int,
  ) {
    val writtenByteCount = writeSync(
      fd = fd,
      buffer = array,
      offset = arrayOffset.toDouble(),
      length = byteCount.toDouble(),
      position = fileOffset.toDouble(),
    )

    if (writtenByteCount.toInt() != byteCount) {
      throw IOException("expected $byteCount but was $writtenByteCount")
    }
  }

  override fun protectedFlush() {
  }

  override fun protectedResize(size: Long) {
    ftruncateSync(fd, size.toDouble())
  }

  override fun protectedClose() {
    closeSync(fd)
  }
}

```

### Core Architecture Module: `okio-nodefilesystem/src/commonMain/kotlin/okio/NodeJsFileSystem.kt`
```
/*
 * Copyright (C) 2020 Square, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package okio

import okio.Path.Companion.toPath

/**
 * Use [Node.js APIs][node_fs] to implement the Okio file system interface.
 *
 * This class needs to make calls to some fs APIs that have multiple competing overloads. To
 * unambiguously select an overload this passes `undefined` as the target type to some functions.
 *
 * [node_fs]: https://nodejs.org/dist/latest-v14.x/docs/api/fs.html
 */
object NodeJsFileSystem : FileSystem() {
  private var S_IFMT = 0xf000 // fs.constants.S_IFMT
  private var S_IFREG = 0x8000 // fs.constants.S_IFREG
  private var S_IFDIR = 0x4000 // fs.constants.S_IFDIR
  private var S_IFLNK = 0xa000 // fs.constants.S_IFLNK

  override fun canonicalize(path: Path): Path {
    try {
      val canonicalPath = realpathSync(path.toString())
      return canonicalPath.toPath()
    } catch (e: Throwable) {
      throw e.toIOException()
    }
  }

  override fun metadataOrNull(path: Path): FileMetadata? {
    val pathString = path.toString()
    val stat = try {
      lstatSync(pathString)
    } catch (e: Throwable) {
      if (e.errorCode == "ENOENT") return null // "No such file or directory".
      throw IOException(e.message)
    }

    var symlinkTarget: Path? = null
    if ((stat.mode.toInt() and S_IFMT) == S_IFLNK) {
      try {
        symlinkTarget = readlinkSync(pathString).toPath()
      } catch (e: Throwable) {
        throw e.toIOException()
      }
    }

    return FileMetadata(
      isRegularFile = (stat.mode.toInt() and S_IFMT) == S_IFREG,
      isDirectory = (stat.mode.toInt() and S_IFMT) == S_IFDIR,
      symlinkTarget = symlinkTarget,
      size = stat.size.toLong(),
      createdAtMillis = stat.birthtimeMs.toLong(),
      lastModifiedAtMillis = stat.mtimeMs.toLong(),
      lastAccessedAtMillis = stat.atimeMs.toLong(),
    )
  }

  /**
   * Returns the error code on this `SystemError`. This uses `asDynamic()` because our JS bindings
   * don't (yet) include the `SystemError` type.
   *
   * https://nodejs.org/dist/latest-v14.x/docs/api/errors.html#errors_class_systemerror
   * https://nodejs.org/dist/latest-v14.x/docs/api/errors.html#errors_common_system_errors
   */
  private val Throwable.errorCode
    get() = asDynamic().code

  override fun list(dir: Path): List<Path> = list(dir, throwOnFailure = true)!!

  override fun listOrNull(dir: Path): List<Path>? = list(dir, throwOnFailure = false)

  private fun list(dir: Path, throwOnFailure: Boolean): List<Path>? {
    try {
      val opendir = opendirSync(dir.toString())
      try {
        val result = mutableListOf<Path>()
        while (true) {
          val dirent = opendir.readSync() ?: break
          result += dir / dirent.name
        }
        result.sort()
        return result
      } finally {
        opendir.closeSync()
      }
    } catch (e: Throwable) {
      if (throwOnFailure) {
        throw e.toIOException()
      } else {
        return null
      }
    }
  }

  override fun openReadOnly(file: Path): FileHandle {
    val fd = openFd(file, flags = "r")
    return NodeJsFileHandle(fd, readWrite = false)
  }

  override fun openReadWrite(file: Path, mustCreate: Boolean, mustExist: Boolean): FileHandle {
    require(!mustCreate || !mustExist) {
      "Cannot require mustCreate and mustExist at the same time."
    }
    val fd = if (Path.DIRECTORY_SEPARATOR == "\\") {
      // On NodeJS on Windows there's no file system flag that does all of the following:
      //  - open a file for reading, writing, seeking, and resizing
      //  - create it doesn't exist
      //  - do not truncate it if it does exist
      // Work around this by attempting to open a file that does exist (r+), falling back to
      // creating a file that does not exist (wx+) if that throws. This is not atomic.
      // https://nodejs.org/api/fs.html#fs_file_system_flags
      try {
        if (mustCreate && exists(file)) throw IOException("$file already exists.")
        openFd(file, "r+")
      } catch (e: FileNotFoundException) {
        if (mustExist) throw IOException("$file doesn't exist.")
        openFd(file, "wx+")
      }
    } else {
      // Note that on Linux, positional writes don't work when the file is opened in append mode, so
      // we don't want to use the `a` flag,
      val flags = when {
        mustCreate -> "wx+"
        mustExist || exists(file) -> "r+"
        else -> "w+"
      }
      openFd(file, flags)
    }
    return NodeJsFileHandle(fd, readWrite = true)
  }

  override fun source(file: Path): Source {
    val fd = openFd(file, flags = "r")
    return FileSource(fd)
  }

  override fun sink(file: Path, mustCreate: Boolean): Sink {
    val fd = openFd(file, flags = if (mustCreate) "wx" else "w")
    return FileSink(fd)
  }

  override fun appendingSink(file: Path, mustExist: Boolean): Sink {
    // There is a `r+` flag which we could have used to force existence of [file] but this flag
    // doesn't allow opening for appending, and we don't currently have a way to move the cursor to
    // the end of the file. We are then forcing existence non-atomically.
    if (mustExist && !exists(file)) throw IOException("$file doesn't exist.")
    val fd = openFd(file, flags = "a")
    return FileSink(fd)
  }

  private fun openFd(file: Path, flags: String): Double {
    try {
      return openSync(file.toString(), flags = flags)
    } catch (e: Throwable) {
      throw e.toIOException()
    }
  }

  override fun createDirectory(dir: Path, mustCreate: Boolean) {
    try {
      mkdirSync(dir.toString())
    } catch (e: Throwable) {
      val alreadyExist = metadataOrNull(dir)?.isDirectory == true
      if (alreadyExist) {
        if (mustCreate) {
          throw IOException("$dir already exist.")
        } else {
          return
        }
      }

      throw e.toIOException()
    }
  }

  override fun atomicMove(source: Path, target: Path) {
    try {
      renameSync(source.toString(), target.toString())
    } catch (e: Throwable) {
      throw e.toIOException()
    }
  }

  /**
   * We don't know if [path] is a file or a directory, but we don't (yet) have an API to delete
   * either type. Just try each in sequence.
   *
   * TODO(jwilson): switch to fs.rmSync() when our minimum requirements are Node 14.14.0.
   */
  override fun delete(path: Path, mustExist: Boolean) {
    try {
      unlinkSync(path.toString())
      return
    } catch (e: Throwable) {
    }
    try {
      rmdirSync(path.toString())
    } catch (e: Throwable) {
      if (e.errorCode == "ENOENT") {
        if (mustExist) {
          throw FileNotFoundException("no such file: $path")
        } else {
          return
        }
      }
      throw e.toIOException()
    }
  }

  override fun createSymlink(source: Path, target: Path) {
    if (source.parent == null || !exists(source.parent!!)) {
      throw IOException("parent directory does not exist: ${source.parent}")
    }

    if (exists(source)) {
      throw IOException("already exists: $source")
    }

    symlinkSync(target.toString(), source.toString())
  }

  private fun Throwable.toIOException(): IOException {
    return when (errorCode) {
      "ENOENT" -> FileNotFoundException(message)
      else -> IOException(message)
    }
  }

  override fun toString() = "NodeJsSystemFileSystem"
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1879** (2026-10-05): **Update gradle/actions action to v6.4.0**
  *Symptoms*: This PR contains the following updates:  | Package | Type | Update | Change | |---|---|---|---| | [gradle/actions](https://redirect.github.com/gradle/actions) | action | minor | `v6.3.0` → `v6.4.0` |  ---  ### Release Notes  <details> <summary>gradle/actions (gradle/actions)</summary>  ### [`v6.4.0`](https://redirect.github.com/gradle/actions/releases/tag/v6.4.0)  [Compare Source](https://redirect.github.com/gradle/actions/compare/v6.3.0...v6.4.0)  #### Highlights  ##### Gradle version support status in the Job Summary  The actions now report the support status of every Gradle version used in a workflow, as job annotations and in the Job Summary ([#&#8203;1057](https://redirect.github.com/gradle/actions/issues/1057)). Thanks to [@&#8203;ov7a](https://redirect.github.com/ov7a) for the contribution.  | version kind                                                                            | job annotation | version table        | below the table                                                                                                                                 | | --------------------------------------------------------------------------------------- | -------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | | **End-of-life** — two or more major versions behind the latest release                  | warning        | :warning:            | ex

- **Issue #1877** (2026-10-02): **Update Gradle to v9.8.0**
  *Symptoms*: This PR contains the following updates:  | Package | Update | Change | |---|---|---| | [gradle](https://gradle.org) ([source](https://redirect.github.com/gradle/gradle)) | minor | `9.7.1` → `9.8.0` |  ---  ### Release Notes  <details> <summary>gradle/gradle (gradle)</summary>  ### [`v9.8.0`](https://redirect.github.com/gradle/gradle/releases/tag/v9.8.0): 9.8.0  [Compare Source](https://redirect.github.com/gradle/gradle/compare/v9.7.1...v9.8.0)  The Gradle team is excited to announce Gradle 9.8.0.  Here are the highlights of this release:  - Java 27 support - Maven mirror settings reuse - Linked problem locations in build output  [Read the Release Notes](https://docs.gradle.org/9.8.0/release-notes.html)  We would like to thank the following community members for their contributions to this release of Gradle: [Aman Gautam](https://redirect.github.com/Gautam-aman), [Björn Kautler](https://redirect.github.com/Vampire), [Eng Zer Jun](https://redirect.github.com/Juneezee), [Hashim Khan](https://redirect.github.com/Hashim1999164), [Julian Krannich](https://redirect.github.com/jkrannich), [KBS](https://redirect.github.com/youdie006), [Labh R Jethe](https://redirect.github.com/itsCodeTide), [Mark Dodgson](https://redirect.github.com/doddi), [Maxim](https://redirect.github.com/kroune), [monkey](https://redirect.github.com/Develop-KIM), [nataphon-ktsystems](https://redirect.github.com/nataphon-ktsystems), [Paul King](https://redirect.github.com/paulk-asert), [Qiu Tian](https://redirect.

- **Issue #1875** (2026-09-25): **Update dependency com.android.tools.build:gradle to v9.4.1**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [com.android.tools.build:gradle](http://tools.android.com/) ([source](https://android.googlesource.com/platform/tools/base)) | `9.4.0` → `9.4.1` | ![age](https://developer.mend.io/api/mc/badges/age/maven/com.android.tools.build:gradle/9.4.1?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/com.android.tools.build:gradle/9.4.0/9.4.1?slim=true) |  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - At any time (no schedule defined) - Automerge   - At any time (no schedule defined)  🚦 **Automerge**: Disabled by config. Please merge this manually once you are satisfied.  ♻ **Rebasing**: Whenever PR becomes conflicted, or you tick the rebase/retry checkbox.  🔕 **Ignore**: Close this PR and you won't be reminded about this update again.  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  This PR was generated by [Mend Renovate](https://mend.io/renovate/). View the [repository job log](https://developer.mend.io/github/lysine-dev/okio). <!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0NC4xMTIuMCIsInVwZGF0ZWRJblZlciI6IjQ0LjExMi4wIiwidGFyZ2V0QnJhbmNoIjoibWFpbiIsImxhYmVscyI6W119--> 

- **Issue #1873** (2026-09-17): **Update actions/setup-java action to v6.0.1**
  *Symptoms*: This PR contains the following updates:  | Package | Type | Update | Change | |---|---|---|---| | [actions/setup-java](https://redirect.github.com/actions/setup-java) | action | patch | `v6.0.0` → `v6.0.1` |  ---  ### Release Notes  <details> <summary>actions/setup-java (actions/setup-java)</summary>  ### [`v6.0.1`](https://redirect.github.com/actions/setup-java/compare/v6.0.0...v6.0.1)  [Compare Source](https://redirect.github.com/actions/setup-java/compare/v6.0.0...v6.0.1)  </details>  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - At any time (no schedule defined) - Automerge   - At any time (no schedule defined)  🚦 **Automerge**: Disabled by config. Please merge this manually once you are satisfied.  ♻ **Rebasing**: Whenever PR becomes conflicted, or you tick the rebase/retry checkbox.  🔕 **Ignore**: Close this PR and you won't be reminded about this update again.  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  This PR was generated by [Mend Renovate](https://mend.io/renovate/). View the [repository job log](https://developer.mend.io/github/lysine-dev/okio). <!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0NC45NC4wIiwidXBkYXRlZEluVmVyIjoiNDQuOTQuMCIsInRhcmdldEJyYW5jaCI6Im1haW4iLCJsYWJlbHMiOltdfQ==--> 

- **Issue #1872** (2026-09-11): **Update BUG-BOUNTY.md**
  *Symptoms*: Removes BUG-BOUNTY.md. The current guidance points to Block's bug bounty program and should be removed from this fork.
  **Post-Mortem & Fix Analysis**:
  > Hey @JakeWharton would you be able to approve once it's ready?

- **Issue #1871** (2026-09-09): **Update dependency org.jetbrains.kotlinx.binary-compatibility-validator:org.jetbrains.kotlinx.binary-compatibility-validator.gradle.plugin to v0.18.2**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [org.jetbrains.kotlinx.binary-compatibility-validator:org.jetbrains.kotlinx.binary-compatibility-validator.gradle.plugin](https://redirect.github.com/Kotlin/binary-compatibility-validator) | `0.18.1` → `0.18.2` | ![age](https://developer.mend.io/api/mc/badges/age/maven/org.jetbrains.kotlinx.binary-compatibility-validator:org.jetbrains.kotlinx.binary-compatibility-validator.gradle.plugin/0.18.2?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/org.jetbrains.kotlinx.binary-compatibility-validator:org.jetbrains.kotlinx.binary-compatibility-validator.gradle.plugin/0.18.1/0.18.2?slim=true) |  ---  ### Release Notes  <details> <summary>Kotlin/binary-compatibility-validator (org.jetbrains.kotlinx.binary-compatibility-validator:org.jetbrains.kotlinx.binary-compatibility-validator.gradle.plugin)</summary>  ### [`v0.18.2`](https://redirect.github.com/Kotlin/binary-compatibility-validator/releases/tag/0.18.2)  [Compare Source](https://redirect.github.com/Kotlin/binary-compatibility-validator/compare/0.18.1...0.18.2)  - Prevent configuration crash on hosts unrecognized by Kotlin/Native  </details>  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - At any time (no schedule defined) - Automerge   - At any time (no schedule defined)  🚦 **A

- **Issue #1870** (2026-09-08): **Update dependency com.android.tools.build:gradle to v9.4.0**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [com.android.tools.build:gradle](http://tools.android.com/) ([source](https://android.googlesource.com/platform/tools/base)) | `9.3.2` → `9.4.0` | ![age](https://developer.mend.io/api/mc/badges/age/maven/com.android.tools.build:gradle/9.4.0?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/com.android.tools.build:gradle/9.3.2/9.4.0?slim=true) |  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - At any time (no schedule defined) - Automerge   - At any time (no schedule defined)  🚦 **Automerge**: Disabled by config. Please merge this manually once you are satisfied.  ♻ **Rebasing**: Whenever PR becomes conflicted, or you tick the rebase/retry checkbox.  🔕 **Ignore**: Close this PR and you won't be reminded about this update again.  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  This PR was generated by [Mend Renovate](https://mend.io/renovate/). View the [repository job log](https://developer.mend.io/github/lysine-dev/okio). <!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0NC42OS4xIiwidXBkYXRlZEluVmVyIjoiNDQuNjkuMSIsInRhcmdldEJyYW5jaCI6Im1haW4iLCJsYWJlbHMiOltdfQ==--> 

- **Issue #1869** (2026-09-04): **Fix an unintended behavior change with base64 padding**
  *Symptoms*: I inadvertently changed behavior in 3.18.1.  Closes: https://github.com/lysine-dev/okio/issues/1868

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

### Incident Patch 1: `fb4817a3` (2026-09-25)
**Commit Message**: Update dependency com.android.tools.build:gradle to v9.4.1 (#1875)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ ktlint = "0.48.2"
 
 [libraries]
 android-desugar-jdk-libs = { module = "com.android.tools:desugar_jdk_libs", version = "2.1.5" }
-android-gradle-plugin = { module = "com.android.tools.build:gradle", version = "9.4.0" }
+android-gradle-plugin = { module = "com.android.tools.build:gradle", version = "9.4.1" }
 androidx-test-ext-junit = { module = "androidx.test.ext:junit", version = "1.3.0" }
 androidx-test-runner = { module = "androidx.test:runner", version = "1.7.0" }
 binary-compatibility-validator-gradle-plugin = { module = "org.jetbrains.kotlinx.binary-compatibility-validator:org.jetbrains.kotlinx.binary-compatibility-validator.gradle.plugin", version = "0.18.2" }
```

---

### Incident Patch 2: `e8dad1a9` (2026-09-11)
**Commit Message**: Update BUG-BOUNTY.md (#1872)

Removes BUG-BOUNTY.md. The current guidance points to Block's bug bounty program and should be removed from this fork.

**File**: `BUG-BOUNTY.md` (modified, +0/-9)
```diff
@@ -1,10 +1 @@
-Serious about security
-======================
-
-Square recognizes the important contributions the security research community
-can make. We therefore encourage reporting security issues with the code
-contained in this repository.
-
-If you believe you have discovered a security vulnerability, please follow the
-guidelines at https://bugcrowd.com/engagements/blockopensource.
 
```

---

### Incident Patch 3: `2d80eb41` (2026-09-08)
**Commit Message**: Update dependency com.android.tools.build:gradle to v9.4.0 (#1870)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ ktlint = "0.48.2"
 
 [libraries]
 android-desugar-jdk-libs = { module = "com.android.tools:desugar_jdk_libs", version = "2.1.5" }
-android-gradle-plugin = { module = "com.android.tools.build:gradle", version = "9.3.2" }
+android-gradle-plugin = { module = "com.android.tools.build:gradle", version = "9.4.0" }
 androidx-test-ext-junit = { module = "androidx.test.ext:junit", version = "1.3.0" }
 androidx-test-runner = { module = "androidx.test:runner", version = "1.7.0" }
 binary-compatibility-validator-gradle-plugin = { module = "org.jetbrains.kotlinx.binary-compatibility-validator:org.jetbrains.kotlinx.binary-compatibility-validator.gradle.plugin", version = "0.18.1" }
```

---

### Incident Patch 4: `ebedbaea` (2026-09-04)
**Commit Message**: Fix an unintended behavior change with base64 padding (#1869)

I inadvertently changed behavior in 3.18.1.

Closes: https://github.com/lysine-dev/okio/issues/1868

**File**: `okio/src/appleMain/kotlin/okio/ByteString.kt` (modified, +2/-2)
```diff
@@ -79,12 +79,12 @@ internal actual constructor(
   actual open fun base64(includePadding: Boolean): String = commonBase64(includePadding = includePadding)
 
   @Deprecated(message = "for binary compatibility", level = DeprecationLevel.HIDDEN)
-  fun base64(): String = commonBase64(includePadding = false)
+  fun base64(): String = commonBase64(includePadding = true)
 
   actual open fun base64Url(includePadding: Boolean): String = commonBase64Url(includePadding = includePadding)
 
   @Deprecated(message = "for binary compatibility", level = DeprecationLevel.HIDDEN)
-  fun base64Url(): String = commonBase64(includePadding = false)
+  fun base64Url(): String = commonBase64(includePadding = true)
 
   actual open fun hex(): String = commonHex()
 
```

**File**: `okio/src/nonAppleMain/kotlin/okio/ByteString.kt` (modified, +2/-2)
```diff
@@ -73,12 +73,12 @@ internal actual constructor(
   actual open fun base64(includePadding: Boolean): String = commonBase64(includePadding = includePadding)
 
   @Deprecated(message = "for binary compatibility", level = DeprecationLevel.HIDDEN)
-  fun base64(): String = commonBase64(includePadding = false)
+  fun base64(): String = commonBase64(includePadding = true)
 
   actual open fun base64Url(includePadding: Boolean): String = commonBase64Url(includePadding = includePadding)
 
   @Deprecated(message = "for binary compatibility", level = DeprecationLevel.HIDDEN)
-  fun base64Url(): String = commonBase64(includePadding = false)
+  fun base64Url(): String = commonBase64(includePadding = true)
 
   actual open fun hex(): String = commonHex()
 
```

---

### Incident Patch 5: `9d5ccfe0` (2026-08-31)
**Commit Message**: Update dependency com.android.tools.build:gradle to v9.3.2 (#1866)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ ktlint = "0.48.2"
 
 [libraries]
 android-desugar-jdk-libs = { module = "com.android.tools:desugar_jdk_libs", version = "2.1.5" }
-android-gradle-plugin = { module = "com.android.tools.build:gradle", version = "9.3.1" }
+android-gradle-plugin = { module = "com.android.tools.build:gradle", version = "9.3.2" }
 androidx-test-ext-junit = { module = "androidx.test.ext:junit", version = "1.3.0" }
 androidx-test-runner = { module = "androidx.test:runner", version = "1.7.0" }
 binary-compatibility-validator-gradle-plugin = { module = "org.jetbrains.kotlinx.binary-compatibility-validator:org.jetbrains.kotlinx.binary-compatibility-validator.gradle.plugin", version = "0.18.1" }
```

---

### Incident Patch 6: `e75a7e9e` (2026-07-23)
**Commit Message**: Update dependency com.android.tools.build:gradle to v9.3.1 (#1836)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ ktlint = "0.48.2"
 
 [libraries]
 android-desugar-jdk-libs = { module = "com.android.tools:desugar_jdk_libs", version = "2.1.5" }
-android-gradle-plugin = { module = "com.android.tools.build:gradle", version = "9.3.0" }
+android-gradle-plugin = { module = "com.android.tools.build:gradle", version = "9.3.1" }
 androidx-test-ext-junit = { module = "androidx.test.ext:junit", version = "1.3.0" }
 androidx-test-runner = { module = "androidx.test:runner", version = "1.7.0" }
 binaryCompatibilityValidator = { module = "org.jetbrains.kotlinx.binary-compatibility-validator:org.jetbrains.kotlinx.binary-compatibility-validator.gradle.plugin", version = "0.18.1" }
```

---

### Incident Patch 7: `9d21d5cb` (2026-07-23)
**Commit Message**: Fix interchanged docs links for 1.x and 2.x API (#1835)

**File**: `mkdocs.yml` (modified, +2/-2)
```diff
@@ -74,8 +74,8 @@ nav:
     - 'fakefilesystem': 3.x/okio-fakefilesystem/okio.fakefilesystem/
     - 'nodefilesystem': 3.x/okio-nodefilesystem/okio/
     - 'wasifilesystem': 3.x/okio-wasifilesystem/okio/-wasi-file-system/
-  - '1.x API ⏏': https://lysine.dev/okio/2.x/okio/okio/
-  - '2.x API ⏏': https://lysine.dev/okio/1.x/okio/
+  - '2.x API ⏏': https://lysine.dev/okio/2.x/okio/okio/
+  - '1.x API ⏏': https://lysine.dev/okio/1.x/okio/
   - 'Change Log': changelog.md
   - 'File System': file_system.md
   - 'Multiplatform': multiplatform.md
```

---

### Incident Patch 8: `0ed6b03a` (2026-07-22)
**Commit Message**: Fix dokka build (#1831)

* Fix dokka build

This is breaking website publishing.

* Fix the default to be no dokka

**File**: `.buildscript/prepare_mkdocs.sh` (modified, +2/-1)
```diff
@@ -9,7 +9,8 @@
 set -ex
 
 # Generate the API docs
-./gradlew dokkaHtml
+./gradlew dokkaGeneratePublicationHtml -Dkjs=true -Dkwasm=true -Dokio.build.dokka=true
+mv build/dokka/html docs/3.x
 
 # Copy in special files that GitHub wants in the project root.
 cp CHANGELOG.md docs/changelog.md
```

**File**: `build-support/build.gradle.kts` (modified, +1/-0)
```diff
@@ -22,6 +22,7 @@ gradlePlugin {
 }
 
 dependencies {
+  implementation(libs.dokka)
   implementation(libs.kotlin.gradle.plugin)
   implementation(libs.tapmoc.gradle.plugin)
 }
```

**File**: `build-support/src/main/kotlin/BuildSupport.kt` (modified, +2/-0)
```diff
@@ -44,6 +44,8 @@ class BuildSupport : Plugin<Project> {
       sourceCompatibility = JavaVersion.VERSION_1_8.toString()
       targetCompatibility = JavaVersion.VERSION_1_8.toString()
     }
+
+    project.configureDokka()
   }
 }
 
```

**File**: `build-support/src/main/kotlin/dokka.kt` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+/*
+ * Copyright (c) 2026 Okio Authors
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *      http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+import org.gradle.api.Project
+import org.gradle.kotlin.dsl.apply
+import org.gradle.kotlin.dsl.configure
+import org.gradle.kotlin.dsl.dependencies
+import org.gradle.kotlin.dsl.withType
+import org.jetbrains.dokka.gradle.DokkaExtension
+import org.jetbrains.dokka.gradle.DokkaPlugin
+
+val dokkaEnabled = System.getProperty("okio.build.dokka", "false").toBoolean()
+
+fun Project.configureRootDokka() {
+  if (!dokkaEnabled) return
+
+  apply(plugin = "org.jetbrains.dokka")
+
+  dependencies {
+    add("dokka", project(":okio"))
+    add("dokka", project(":okio-assetfilesystem"))
+    add("dokka", project(":okio-fakefilesystem"))
+    add("dokka", project(":okio-nodefilesystem"))
+    add("dokka", project(":okio-wasifilesystem"))
+  }
+}
+
+fun Project.configureDokka() {
+  if (!dokkaEnabled) return
+
+  plugins.withType<DokkaPlugin> {
+    extensions.configure<DokkaExtension> {
+      dokkaPublications.all {
+        dokkaSourceSets.configureEach {
+          reportUndocumented.set(false)
+          skipDeprecated.set(true)
+          perPackageOption {
+            matchingRegex.set("""com[.]squareup[.]okio.*""")
+            suppress.set(true)
+          }
+          perPackageOption {
+            matchingRegex.set(""".*[.]internal([.].*)?""")
+            suppress.set(true)
+          }
+        }
+      }
+    }
+  }
+}
```

**File**: `build.gradle.kts` (modified, +2/-35)
```diff
@@ -8,7 +8,6 @@ import org.gradle.api.tasks.testing.logging.TestLogEvent.FAILED
 import org.gradle.api.tasks.testing.logging.TestLogEvent.PASSED
 import org.gradle.api.tasks.testing.logging.TestLogEvent.SKIPPED
 import org.gradle.api.tasks.testing.logging.TestLogEvent.STARTED
-import org.jetbrains.dokka.gradle.DokkaTask
 import org.jetbrains.kotlin.gradle.targets.js.testing.KotlinJsTest
 import org.jetbrains.kotlin.gradle.targets.jvm.tasks.KotlinJvmTest
 import org.jetbrains.kotlin.gradle.targets.native.tasks.KotlinNativeTest
@@ -53,40 +52,6 @@ allprojects {
     google()
   }
 
-  tasks.withType<DokkaTask>().configureEach {
-    dokkaSourceSets.configureEach {
-      reportUndocumented.set(false)
-      skipDeprecated.set(true)
-      jdkVersion.set(8)
-      perPackageOption {
-        matchingRegex.set("com\\.squareup.okio.*")
-        suppress.set(true)
-      }
-      perPackageOption {
-        matchingRegex.set("okio\\.internal.*")
-        suppress.set(true)
-      }
-    }
-
-    if (name == "dokkaHtml") {
-      outputDirectory.set(file("${rootDir}/docs/3.x/${project.name}"))
-      pluginsMapConfiguration.set(
-        mapOf(
-          "org.jetbrains.dokka.base.DokkaBase" to """
-          {
-            "customStyleSheets": [
-              "${rootDir.toString().replace('\\', '/')}/docs/css/dokka-logo.css"
-            ],
-            "customAssets" : [
-              "${rootDir.toString().replace('\\', '/')}/docs/images/icon-square.png"
-            ]
-          }
-          """.trimIndent()
-        )
-      )
-    }
-  }
-
   plugins.withId("com.vanniktech.maven.publish.base") {
     configure<PublishingExtension> {
       repositories {
@@ -235,3 +200,5 @@ allprojects {
     environment("OKIO_ROOT", rootDir.toString())
   }
 }
+
+configureRootDokka()
```

**File**: `okio-wasifilesystem/build.gradle.kts` (modified, +1/-3)
```diff
@@ -4,9 +4,7 @@ import com.vanniktech.maven.publish.MavenPublishBaseExtension
 
 plugins {
   kotlin("multiplatform")
-  // TODO: Restore Dokka once this issue is resolved.
-  //     https://github.com/Kotlin/dokka/issues/3038
-  // id("org.jetbrains.dokka")
+  id("org.jetbrains.dokka")
   id("app.cash.burst")
   id("com.vanniktech.maven.publish.base")
   id("build-support")
```

---

### Incident Patch 9: `752d92e8` (2026-07-22)
**Commit Message**: Update build for new home (#1828)

**File**: `.github/workflows/build.yml` (modified, +3/-4)
```diff
@@ -125,7 +125,7 @@ jobs:
 
   publish:
     runs-on: macos-26
-    if: github.repository == 'square/okio' && github.ref == 'refs/heads/master'
+    if: github.repository == 'lysine-dev/okio' && github.ref == 'refs/heads/master'
     needs: [jvm, all-platforms, emulator]
 
     steps:
@@ -144,11 +144,10 @@ jobs:
           ORG_GRADLE_PROJECT_mavenCentralUsername: ${{ secrets.SONATYPE_CENTRAL_USERNAME }}
           ORG_GRADLE_PROJECT_mavenCentralPassword: ${{ secrets.SONATYPE_CENTRAL_PASSWORD }}
           ORG_GRADLE_PROJECT_signingInMemoryKey: ${{ secrets.GPG_SECRET_KEY }}
-          ORG_GRADLE_PROJECT_signingInMemoryKeyPassword: ${{ secrets.GPG_SECRET_PASSPHRASE }}
 
   publish-website:
     runs-on: ubuntu-latest
-    if: github.repository == 'square/okio' && github.ref == 'refs/heads/master'
+    if: github.repository == 'lysine-dev/okio' && github.ref == 'refs/heads/master'
     needs: [jvm, all-platforms, emulator]
 
     steps:
@@ -182,7 +181,7 @@ jobs:
         if: success()
         uses: JamesIves/github-pages-deploy-action@releases/v3
         with:
-          GITHUB_TOKEN: ${{ secrets.GH_CLIPPY_TOKEN }}
+          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
           BRANCH: gh-pages
           FOLDER: site
           SINGLE_COMMIT: true
```

**File**: `.github/workflows/release.yaml` (modified, +0/-1)
```diff
@@ -24,4 +24,3 @@ jobs:
           ORG_GRADLE_PROJECT_mavenCentralUsername: ${{ secrets.SONATYPE_CENTRAL_USERNAME }}
           ORG_GRADLE_PROJECT_mavenCentralPassword: ${{ secrets.SONATYPE_CENTRAL_PASSWORD }}
           ORG_GRADLE_PROJECT_signingInMemoryKey: ${{ secrets.GPG_SECRET_KEY }}
-          ORG_GRADLE_PROJECT_signingInMemoryKeyPassword: ${{ secrets.GPG_SECRET_PASSPHRASE }}
```

---

### Incident Patch 10: `5ba79f9b` (2026-07-22)
**Commit Message**: Update dependency com.android.tools.build:gradle to v9.3.0 (#1829)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ ktlint = "0.48.2"
 
 [libraries]
 android-desugar-jdk-libs = { module = "com.android.tools:desugar_jdk_libs", version = "2.1.5" }
-android-gradle-plugin = { module = "com.android.tools.build:gradle", version = "9.2.1" }
+android-gradle-plugin = { module = "com.android.tools.build:gradle", version = "9.3.0" }
 androidx-test-ext-junit = { module = "androidx.test.ext:junit", version = "1.3.0" }
 androidx-test-runner = { module = "androidx.test:runner", version = "1.7.0" }
 binaryCompatibilityValidator = { module = "org.jetbrains.kotlinx.binary-compatibility-validator:org.jetbrains.kotlinx.binary-compatibility-validator.gradle.plugin", version = "0.18.1" }
```

---

### Incident Patch 11: `90ae6712` (2026-07-21)
**Commit Message**: Fix broken/outdated links (#1827)

Additionally changes links from `http://` to `https://`

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -1080,4 +1080,4 @@ _2014-04-08_
 [maven_provided]: https://maven.apache.org/guides/introduction/introduction-to-dependency-mechanism.html
 [preview1]: https://github.com/WebAssembly/WASI/blob/main/legacy/preview1/docs.md
 [watchosX86]: https://blog.jetbrains.com/kotlin/2023/02/update-regarding-kotlin-native-targets/
-[xor_utf8]: https://github.com/square/okio/blob/bbb29c459e5ccf0f286e0b17ccdcacd7ac4bc2a9/okio/src/main/kotlin/okio/Utf8.kt#L302
+[xor_utf8]: https://github.com/lysine-dev/okio/blob/bbb29c459e5ccf0f286e0b17ccdcacd7ac4bc2a9/okio/src/main/kotlin/okio/Utf8.kt#L302
```

**File**: `CONTRIBUTING.md` (modified, +2/-2)
```diff
@@ -34,5 +34,5 @@ Committer's Guides
  * [Releasing][releasing]
 
  [cla]: https://spreadsheets.google.com/spreadsheet/viewform?formkey=dDViT2xzUHAwRkI3X3k5Z0lQM091OGc6MQ&ndplr=1
- [releasing]: http://square.github.io/okio/releasing/
- [security]: http://square.github.io/okio/security/
+ [releasing]: https://lysine.dev/okio/releasing/
+ [security]: https://lysine.dev/okio/security/
```

**File**: `README.md` (modified, +2/-2)
```diff
@@ -25,5 +25,5 @@ License
     See the License for the specific language governing permissions and
     limitations under the License.
     
- [1]: https://github.com/square/okhttp
- [okio]: https://square.github.io/okio/
+ [1]: https://github.com/lysine-dev/okhttp
+ [okio]: https://lysine.dev/okio/
```

**File**: `android-test/README.md` (modified, +1/-1)
```diff
@@ -47,4 +47,4 @@ if a `run finished` line is printed in the logcat logs:
 ```
 
 
-[okhttp_android_test]: https://github.com/square/okhttp/tree/master/android-test
+[okhttp_android_test]: https://github.com/lysine-dev/okhttp/tree/master/android-test
```

**File**: `build.gradle.kts` (modified, +4/-4)
```diff
@@ -115,7 +115,7 @@ allprojects {
       pom {
         description.set("A modern I/O library for Android, Java, and Kotlin Multiplatform.")
         name.set(project.name)
-        url.set("https://github.com/square/okio/")
+        url.set("https://github.com/lysine-dev/okio/")
         licenses {
           license {
             name.set("The Apache Software License, Version 2.0")
@@ -124,9 +124,9 @@ allprojects {
           }
         }
         scm {
-          url.set("https://github.com/square/okio/")
-          connection.set("scm:git:git://github.com/square/okio.git")
-          developerConnection.set("scm:git:ssh://git@github.com/square/okio.git")
+          url.set("https://github.com/lysine-dev/okio/")
+          connection.set("scm:git:git://github.com/lysine-dev/okio.git")
+          developerConnection.set("scm:git:ssh://git@github.com/lysine-dev/okio.git")
         }
         developers {
           developer {
```

**File**: `docs/file_system.md` (modified, +1/-1)
```diff
@@ -122,4 +122,4 @@ overview of these limitations.
    a valid path and a rejection of an invalid path.)
 
 
-[fake_fs_concurrency]: https://github.com/square/okio/issues/950
+[fake_fs_concurrency]: https://github.com/lysine-dev/okio/issues/950
```

**File**: `docs/index.md` (modified, +9/-9)
```diff
@@ -134,15 +134,15 @@ License
     See the License for the specific language governing permissions and
     limitations under the License.
 
- [1]: https://github.com/square/okhttp
- [3]: https://square.github.io/okio/3.x/okio/okio/okio/-byte-string/index.html
- [4]: https://square.github.io/okio/3.x/okio/okio/okio/-buffer/index.html
- [5]: https://square.github.io/okio/3.x/okio/okio/okio/-source/index.html
- [6]: https://square.github.io/okio/3.x/okio/okio/okio/-sink/index.html
- [7]: https://square.github.io/okio/3.x/okio/okio/okio/-buffered-source/index.html
- [8]: https://square.github.io/okio/3.x/okio/okio/okio/-buffered-sink/index.html
- [changelog]: http://square.github.io/okio/changelog/
- [javadoc]: https://square.github.io/okio/2.x/okio/okio/index.html
+ [1]: https://github.com/lysine-dev/okhttp
+ [3]: https://lysine.dev/okio/3.x/okio/okio/okio/-byte-string/index.html
+ [4]: https://lysine.dev/okio/3.x/okio/okio/okio/-buffer/index.html
+ [5]: https://lysine.dev/okio/3.x/okio/okio/okio/-source/index.html
+ [6]: https://lysine.dev/okio/3.x/okio/okio/okio/-sink/index.html
+ [7]: https://lysine.dev/okio/3.x/okio/okio/okio/-buffered-source/index.html
+ [8]: https://lysine.dev/okio/3.x/okio/okio/okio/-buffered-sink/index.html
+ [changelog]: https://lysine.dev/okio/changelog/
+ [javadoc]: https://lysine.dev/okio/2.x/okio/okio/index.html
  [kotlin]: https://kotlinlang.org/
  [ok_libraries_talk]: https://www.youtube.com/watch?v=WvyScM_S88c
  [ok_libraries_slides]: https://speakerdeck.com/jakewharton/a-few-ok-libraries-droidcon-mtl-2015
```

**File**: `docs/java_io_recipes.md` (modified, +4/-4)
```diff
@@ -92,7 +92,7 @@ This is similar to the other [write example](recipes.md#write-a-text-file-javako
     ```
 
 
-[ReadJavaIoFileLineByLineKt]: https://github.com/square/okio/blob/master/samples/src/jvmMain/kotlin/okio/samples/ReadJavaIoFileLineByLine.kt
-[ReadJavaIoFileLineByLine]: https://github.com/square/okio/blob/master/samples/src/jvmMain/java/okio/samples/ReadJavaIoFileLineByLine.java
-[WriteJavaIoFileKt]: https://github.com/square/okio/blob/master/samples/src/jvmMain/kotlin/okio/samples/WriteJavaIoFile.kt
-[WriteJavaIoFile]: https://github.com/square/okio/blob/master/samples/src/jvmMain/java/okio/samples/WriteJavaIoFile.java
+[ReadJavaIoFileLineByLineKt]: https://github.com/lysine-dev/okio/blob/master/samples/src/jvmMain/kotlin/okio/samples/ReadJavaIoFileLineByLine.kt
+[ReadJavaIoFileLineByLine]: https://github.com/lysine-dev/okio/blob/master/samples/src/jvmMain/java/okio/samples/ReadJavaIoFileLineByLine.java
+[WriteJavaIoFileKt]: https://github.com/lysine-dev/okio/blob/master/samples/src/jvmMain/kotlin/okio/samples/WriteJavaIoFile.kt
+[WriteJavaIoFile]: https://github.com/lysine-dev/okio/blob/master/samples/src/jvmMain/java/okio/samples/WriteJavaIoFile.java
```

---

### Incident Patch 12: `304f508e` (2026-07-20)
**Commit Message**: Make FixedLengthSource public API (#1823)

* Make FixedLengthSource public API

Closes: https://github.com/lysine-dev/okio/issues/1208

* apiDump

**File**: `okio/api/okio.api` (modified, +3/-0)
```diff
@@ -673,6 +673,9 @@ public final class okio/Okio {
 	public static final fun hashingSource (Lokio/Source;Ljava/security/MessageDigest;)Lokio/HashingSource;
 	public static final fun hashingSource (Lokio/Source;Ljavax/crypto/Mac;)Lokio/HashingSource;
 	public static final fun inMemorySocketPair (J)[Lokio/Socket;
+	public static final fun limit (Lokio/Source;J)Lokio/Source;
+	public static final fun limit (Lokio/Source;JZ)Lokio/Source;
+	public static synthetic fun limit$default (Lokio/Source;JZILjava/lang/Object;)Lokio/Source;
 	public static final fun openZip (Lokio/FileSystem;Lokio/Path;)Lokio/FileSystem;
 	public static final fun sink (Ljava/io/File;)Lokio/Sink;
 	public static final fun sink (Ljava/io/File;Z)Lokio/Sink;
```

**File**: `okio/src/commonMain/kotlin/okio/Okio.kt` (modified, +76/-2)
```diff
@@ -24,16 +24,17 @@ import kotlin.contracts.InvocationKind
 import kotlin.contracts.contract
 import kotlin.jvm.JvmMultifileClass
 import kotlin.jvm.JvmName
+import kotlin.jvm.JvmOverloads
 
 /**
- * Returns a new source that buffers reads from `source`. The returned source will perform bulk
+ * Returns a new source that buffers reads from this. The returned source will perform bulk
  * reads into its in-memory buffer. Use this wherever you read a source to get an ergonomic and
  * efficient access to data.
  */
 fun Source.buffer(): BufferedSource = RealBufferedSource(this)
 
 /**
- * Returns a new sink that buffers writes to `sink`. The returned sink will batch writes to `sink`.
+ * Returns a new sink that buffers writes to this. The returned sink will batch writes to this.
  * Use this wherever you write to a sink to get an ergonomic and efficient access to data.
  */
 fun Sink.buffer(): BufferedSink = RealBufferedSink(this)
@@ -78,3 +79,76 @@ inline fun <T : Closeable?, R> T.use(block: (T) -> R): R {
   @Suppress("UNCHECKED_CAST")
   return result as R
 }
+
+/**
+ * Returns a new source that returns exactly [byteCount] bytes from this.
+ *
+ * Closing the returned source closes this.
+ *
+ * @param throwIfSourceIsLonger true to also throw if this has more than [byteCount] bytes.
+ *   This works by attempting to read more than [byteCount] bytes.
+ *
+ * @throws [EOFException] if this returns fewer than [byteCount] bytes.
+ */
+@JvmOverloads
+fun Source.limit(
+  byteCount: Long,
+  throwIfSourceIsLonger: Boolean = false,
+): Source = LimitSource(this, byteCount, throwIfSourceIsLonger)
+
+private class LimitSource(
+  delegate: Source,
+  private val byteCount: Long,
+  private val throwIfSourceIsLonger: Boolean,
+) : ForwardingSource(delegate) {
+  private var bytesReceived = 0L
+
+  init {
+    require(byteCount >= 0L) { "byteCount < 0: $byteCount" }
+  }
+
+  override fun read(sink: Buffer, byteCount: Long): Long {
+    val remainingByteCount = this.byteCount - bytesReceived
+    val toRead = when {
+      remainingByteCount < 0 -> {
+        throw IOException("expected ${this.byteCount} bytes but got $bytesReceived")
+      }
+
+      throwIfSourceIsLonger -> {
+        // Attempt to read an extra byte, so we can detect if too many bytes are returned.
+        byteCount.coerceAtMost(remainingByteCount + 1)
+      }
+
+      remainingByteCount == 0L -> {
+        return -1L // Already read exactly the promised size.
+      }
+
+      else -> byteCount.coerceAtMost(remainingByteCount)
+    }
+
+    val result = super.read(sink, toRead)
+
+    if (result == -1L) {
+      if (remainingByteCount == 0L) return -1L
+      throw EOFException("expected ${this.byteCount} bytes but got $bytesReceived")
+    }
+
+    bytesReceived += result
+
+    val beyondLimitByteCount = bytesReceived - this.byteCount
+    if (beyondLimitByteCount > 0) {
+      // If we received bytes beyond the limit, don't return them to the caller.
+      sink.truncateToSize(sink.size - beyondLimitByteCount)
+      throw IOException("expected ${this.byteCount} bytes but got $bytesReceived")
+    }
+
+    return result
+  }
+
+  private fun Buffer.truncateToSize(newByteCount: Long) {
+    val scratch = Buffer()
+    scratch.writeAll(this)
+    write(scratch, newByteCount)
+    scratch.clear()
+  }
+}
```

**File**: `okio/src/commonTest/kotlin/okio/LimitSourceTest.kt` (added, +166/-0)
```diff
@@ -0,0 +1,166 @@
+/*
+ * Copyright (C) 2021 Square, Inc.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *      http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+package okio
+
+import app.cash.burst.Burst
+import assertk.assertThat
+import assertk.assertions.hasMessage
+import assertk.assertions.isEmpty
+import assertk.assertions.isEqualTo
+import kotlin.test.Test
+import kotlin.test.assertFailsWith
+
+@Burst
+internal class LimitSourceTest {
+  @Test
+  fun happyPath(throwIfSourceIsLonger: Boolean) {
+    val delegate = Buffer().writeUtf8("abcdefghijklmnop")
+    val limitSource = delegate.limit(16L, throwIfSourceIsLonger = throwIfSourceIsLonger)
+    val buffer = Buffer()
+    assertThat(limitSource.read(buffer, 10L)).isEqualTo(10L)
+    assertThat(buffer.readUtf8()).isEqualTo("abcdefghij")
+    assertThat(limitSource.read(buffer, 10L)).isEqualTo(6L)
+    assertThat(buffer.readUtf8()).isEqualTo("klmnop")
+    assertThat(limitSource.read(buffer, 10L)).isEqualTo(-1L)
+    assertThat(buffer.readUtf8()).isEqualTo("")
+  }
+
+  @Test
+  fun delegateTooLong() {
+    val delegate = Buffer().writeUtf8("abcdefghijklmnopqr")
+    val limitSource = delegate.limit(16L)
+    val buffer = Buffer()
+    assertThat(limitSource.read(buffer, 10L)).isEqualTo(10L)
+    assertThat(buffer.readUtf8()).isEqualTo("abcdefghij")
+    assertThat(limitSource.read(buffer, 10L)).isEqualTo(6L)
+    assertThat(buffer.readUtf8()).isEqualTo("klmnop")
+    assertThat(limitSource.read(buffer, 10L)).isEqualTo(-1L)
+    assertThat(buffer.readUtf8()).isEqualTo("")
+  }
+
+  @Test
+  fun delegateTooLongFencepost() {
+    val delegate = Buffer().writeUtf8("abcdefghijklmnop")
+    val limitSource = delegate.limit(10L)
+    val buffer = Buffer()
+    assertThat(limitSource.read(buffer, 10L)).isEqualTo(10L)
+    assertThat(buffer.readUtf8()).isEqualTo("abcdefghij")
+    assertThat(limitSource.read(buffer, 10L)).isEqualTo(-1L)
+    assertThat(buffer.readUtf8()).isEmpty()
+  }
+
+  @Test
+  fun delegateTooLongThrowIfSourceIsLonger() {
+    val delegate = Buffer().writeUtf8("abcdefghijklmnopqr")
+    val limitSource = delegate.limit(16L, throwIfSourceIsLonger = true)
+    val buffer = Buffer()
+    assertThat(limitSource.read(buffer, 10L)).isEqualTo(10L)
+    assertThat(buffer.readUtf8()).isEqualTo("abcdefghij")
+
+    val e1 = assertFailsWith<IOException> {
+      limitSource.read(buffer, 10L)
+    }
+    assertThat(e1).hasMessage("expected 16 bytes but got 17")
+    assertThat(buffer.readUtf8()).isEqualTo("klmnop") // Doesn't produce too many bytes!
+
+    val e2 = assertFailsWith<IOException> {
+      limitSource.read(buffer, 10L)
+    }
+    assertThat(e2).hasMessage("expected 16 bytes but got 17")
+    assertThat(buffer.readUtf8()).isEmpty() // Doesn't produce any bytes!
+  }
+
+  @Test
+  fun delegateTooLongThrowIfSourceIsLongerFencepost() {
+    val delegate = Buffer().writeUtf8("abcdefghijklmnop")
+    val limitSource = delegate.limit(10L, throwIfSourceIsLonger = true)
+    val buffer = Buffer()
+    assertThat(limitSource.read(buffer, 10L)).isEqualTo(10L)
+    assertThat(buffer.readUtf8()).isEqualTo("abcdefghij")
+
+    val e1 = assertFailsWith<IOException> {
+      limitSource.read(buffer, 10L)
+    }
+    assertThat(e1).hasMessage("expected 10 bytes but got 11")
+    assertThat(buffer.readUtf8()).isEmpty() // Doesn't produce too many bytes!
+
+    val e2 = assertFailsWith<IOException> {
+      limitSource.read(buffer, 10L)
+    }
+    assertThat(e2).hasMessage("expected 10 bytes but got 11")
+    assertThat(buffer.readUtf8()).isEmpty() // Doesn't produce any bytes!
+  }
+
+  @Test
+  fun delegateTooShort(throwIfSourceIsLonger: Boolean) {
+    val delegate = Buffer().writeUtf8("abcdefghijklmn")
+    val limitSource = delegate.limit(16L, throwIfSourceIsLonger = throwIfSourceIsLonger)
+    val buffer = Buffer()
+    assertThat(limitSource.read(buffer, 10L)).isEqualTo(10L)
+    assertThat(buffer.readUtf8()).isEqualTo("abcdefghij")
+    assertThat(limitSource.read(buffer, 10L)).isEqualTo(4L)
+    assertThat(buffer.readUtf8()).isEqualTo("klmn")
+
+    val e1 = assertFailsWith<EOFException> {
+      limitSource.read(buffer, 10L)
+    }
+    assertThat(e1).hasMessage("expected 16 bytes but got 14")
+
+    val e2 = assertFailsWith<EOFException> {
+      limitSource.read(buffer, 10L)
+    }
+    assertThat(e2).hasMessage("expected 16 bytes but got 14")
+  }
+
+  @Test
+  fun byteCountNotNegative(throwIfSourceIsLonger: Boolean) {
+    val source = Buffer()
+    val e = assertFailsWith<Il
```

**File**: `okio/src/jvmTest/kotlin/okio/FixedLengthSourceTest.kt` (removed, +0/-168)
```diff
@@ -1,168 +0,0 @@
-/*
- * Copyright (C) 2021 Square, Inc.
- *
- * Licensed under the Apache License, Version 2.0 (the "License");
- * you may not use this file except in compliance with the License.
- * You may obtain a copy of the License at
- *
- *      http://www.apache.org/licenses/LICENSE-2.0
- *
- * Unless required by applicable law or agreed to in writing, software
- * distributed under the License is distributed on an "AS IS" BASIS,
- * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
- * See the License for the specific language governing permissions and
- * limitations under the License.
- */
-package okio
-
-import assertk.assertThat
-import assertk.assertions.hasMessage
-import assertk.assertions.isEmpty
-import assertk.assertions.isEqualTo
-import kotlin.test.fail
-import okio.internal.FixedLengthSource
-import org.junit.Test
-
-internal class FixedLengthSourceTest {
-  @Test
-  fun happyPathWithTruncate() {
-    val delegate = Buffer().writeUtf8("abcdefghijklmnop")
-    val fixedLengthSource = FixedLengthSource(delegate, 16, truncate = true)
-    val buffer = Buffer()
-    assertThat(fixedLengthSource.read(buffer, 10L)).isEqualTo(10L)
-    assertThat(buffer.readUtf8()).isEqualTo("abcdefghij")
-    assertThat(fixedLengthSource.read(buffer, 10L)).isEqualTo(6L)
-    assertThat(buffer.readUtf8()).isEqualTo("klmnop")
-    assertThat(fixedLengthSource.read(buffer, 10L)).isEqualTo(-1L)
-    assertThat(buffer.readUtf8()).isEqualTo("")
-  }
-
-  @Test
-  fun happyPathNoTruncate() {
-    val delegate = Buffer().writeUtf8("abcdefghijklmnop")
-    val fixedLengthSource = FixedLengthSource(delegate, 16, truncate = false)
-    val buffer = Buffer()
-    assertThat(fixedLengthSource.read(buffer, 10L)).isEqualTo(10L)
-    assertThat(buffer.readUtf8()).isEqualTo("abcdefghij")
-    assertThat(fixedLengthSource.read(buffer, 10L)).isEqualTo(6L)
-    assertThat(buffer.readUtf8()).isEqualTo("klmnop")
-    assertThat(fixedLengthSource.read(buffer, 10L)).isEqualTo(-1L)
-    assertThat(buffer.readUtf8()).isEqualTo("")
-  }
-
-  @Test
-  fun delegateTooLongWithTruncate() {
-    val delegate = Buffer().writeUtf8("abcdefghijklmnopqr")
-    val fixedLengthSource = FixedLengthSource(delegate, 16, truncate = true)
-    val buffer = Buffer()
-    assertThat(fixedLengthSource.read(buffer, 10L)).isEqualTo(10L)
-    assertThat(buffer.readUtf8()).isEqualTo("abcdefghij")
-    assertThat(fixedLengthSource.read(buffer, 10L)).isEqualTo(6L)
-    assertThat(buffer.readUtf8()).isEqualTo("klmnop")
-    assertThat(fixedLengthSource.read(buffer, 10L)).isEqualTo(-1L)
-    assertThat(buffer.readUtf8()).isEqualTo("")
-  }
-
-  @Test
-  fun delegateTooLongWithTruncateFencepost() {
-    val delegate = Buffer().writeUtf8("abcdefghijklmnop")
-    val fixedLengthSource = FixedLengthSource(delegate, 10, truncate = true)
-    val buffer = Buffer()
-    assertThat(fixedLengthSource.read(buffer, 10L)).isEqualTo(10L)
-    assertThat(buffer.readUtf8()).isEqualTo("abcdefghij")
-    assertThat(fixedLengthSource.read(buffer, 10L)).isEqualTo(-1L)
-    assertThat(buffer.readUtf8()).isEmpty()
-  }
-
-  @Test
-  fun delegateTooLongNoTruncate() {
-    val delegate = Buffer().writeUtf8("abcdefghijklmnopqr")
-    val fixedLengthSource = FixedLengthSource(delegate, 16, truncate = false)
-    val buffer = Buffer()
-    assertThat(fixedLengthSource.read(buffer, 10L)).isEqualTo(10L)
-    assertThat(buffer.readUtf8()).isEqualTo("abcdefghij")
-    try {
-      fixedLengthSource.read(buffer, 10L)
-      fail()
-    } catch (e: IOException) {
-      assertThat(e).hasMessage("expected 16 bytes but got 18")
-      assertThat(buffer.readUtf8()).isEqualTo("klmnop") // Doesn't produce too many bytes!
-    }
-    try {
-      fixedLengthSource.read(buffer, 10L)
-      fail()
-    } catch (e: IOException) {
-      assertThat(e).hasMessage("expected 16 bytes but got 18")
-      assertThat(buffer.readUtf8()).isEmpty() // Doesn't produce any bytes!
-    }
-  }
-
-  @Test
-  fun delegateTooLongNoTruncateFencepost() {
-    val delegate = Buffer().writeUtf8("abcdefghijklmnop")
-    val fixedLengthSource = FixedLengthSource(delegate, 10, truncate = false)
-    val buffer = Buffer()
-    assertThat(fixedLengthSource.read(buffer, 10L)).isEqualTo(10L)
-    assertThat(buffer.readUtf8()).isEqualTo("abcdefghij")
-    try {
-      fixedLengthSource.read(buffer, 10L)
-      fail()
-    } catch (e: IOException) {
-      assertThat(e).hasMessage("expected 10 bytes but got 16")
-      assertThat(buffer.readUtf8()).isEmpty() // Doesn't produce too many bytes!
-    }
-    try {
-      fixedLengthSource.read(buffer, 10L)
-      fail()
-    } catch (e: IOException) {
-      assertThat(e).hasMessage("expected 10 bytes but got 16")
-      assertThat(buffer.readUtf8()).isEmpty() // Doesn't produce any bytes!
-    }
-  }
-
-  @Test
-  fun delegateTooShortWithTruncate() {
-    val delegate = Buffer().writeUtf8("abcdefghijklmn")
-    val fixedLengthSource = FixedLengthSource(deleg
```

**File**: `okio/src/zlibMain/kotlin/okio/ZipFileSystem.kt` (modified, +3/-4)
```diff
@@ -18,7 +18,6 @@ package okio
 
 import okio.Path.Companion.toPath
 import okio.internal.COMPRESSION_METHOD_STORED
-import okio.internal.FixedLengthSource
 import okio.internal.ZipEntry
 import okio.internal.readLocalHeader
 import okio.internal.skipLocalHeader
@@ -103,14 +102,14 @@ internal class ZipFileSystem internal constructor(
 
     return when (entry.compressionMethod) {
       COMPRESSION_METHOD_STORED -> {
-        FixedLengthSource(source, entry.size, truncate = true)
+        source.limit(entry.size)
       }
       else -> {
         val inflaterSource = InflaterSource(
-          FixedLengthSource(source, entry.compressedSize, truncate = true),
+          source.limit(entry.compressedSize),
           Inflater(true),
         )
-        FixedLengthSource(inflaterSource, entry.size, truncate = false)
+        inflaterSource.limit(entry.size, throwIfSourceIsLonger = true)
       }
     }
   }
```

**File**: `okio/src/zlibMain/kotlin/okio/internal/FixedLengthSource.kt` (removed, +0/-77)
```diff
@@ -1,77 +0,0 @@
-/*
- * Copyright (C) 2021 Square, Inc.
- *
- * Licensed under the Apache License, Version 2.0 (the "License");
- * you may not use this file except in compliance with the License.
- * You may obtain a copy of the License at
- *
- *      http://www.apache.org/licenses/LICENSE-2.0
- *
- * Unless required by applicable law or agreed to in writing, software
- * distributed under the License is distributed on an "AS IS" BASIS,
- * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
- * See the License for the specific language governing permissions and
- * limitations under the License.
- */
-package okio.internal
-
-import okio.Buffer
-import okio.ForwardingSource
-import okio.IOException
-import okio.Source
-
-/**
- * A source that returns [size] bytes of [delegate].
- *
- * This throws an [IOException] if the delegate returns fewer than [size] bytes.
- *
- * If [truncate] is true, this truncates to [size] bytes. Otherwise this requires that [delegate]
- * will return exactly [size] bytes, and will throw an [IOException] if it doesn't.
- */
-internal class FixedLengthSource(
-  delegate: Source,
-  private val size: Long,
-  private val truncate: Boolean,
-) : ForwardingSource(delegate) {
-  private var bytesReceived = 0L
-
-  override fun read(sink: Buffer, byteCount: Long): Long {
-    // Figure out how many bytes to attempt to read.
-    //
-    // If we're truncating, we never attempt to read more than what's remaining.
-    //
-    // Otherwise we expect the underlying source to be exactly the promised size. Read as much as
-    // possible and throw an exception if too many bytes are returned.
-    val toRead = when {
-      bytesReceived > size -> 0L // Already read more than the promised size.
-      truncate -> {
-        val remaining = size - bytesReceived
-        if (remaining == 0L) return -1L // Already read exactly the promised size.
-        minOf(byteCount, remaining)
-      }
-      else -> byteCount
-    }
-
-    val result = super.read(sink, toRead)
-
-    if (result != -1L) bytesReceived += result
-
-    // Throw an exception if we received too few bytes or too many.
-    if ((bytesReceived < size && result == -1L) || bytesReceived > size) {
-      if (result > 0L && bytesReceived > size) {
-        // If we received bytes beyond the limit, don't return them to the caller.
-        sink.truncateToSize(sink.size - (bytesReceived - size))
-      }
-      throw IOException("expected $size bytes but got $bytesReceived")
-    }
-
-    return result
-  }
-
-  private fun Buffer.truncateToSize(newSize: Long) {
-    val scratch = Buffer()
-    scratch.writeAll(this)
-    write(scratch, newSize)
-    scratch.clear()
-  }
-}
```

---

### Incident Patch 13: `44d7bc31` (2026-05-06)
**Commit Message**: Update dependency com.android.tools.build:gradle to v9.2.1 (#1805)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ ktlint = "0.48.2"
 
 [libraries]
 android-desugar-jdk-libs = { module = "com.android.tools:desugar_jdk_libs", version = "2.1.5" }
-android-gradle-plugin = { module = "com.android.tools.build:gradle", version = "9.2.0" }
+android-gradle-plugin = { module = "com.android.tools.build:gradle", version = "9.2.1" }
 androidx-test-ext-junit = { module = "androidx.test.ext:junit", version = "1.3.0" }
 androidx-test-runner = { module = "androidx.test:runner", version = "1.7.0" }
 binaryCompatibilityValidator = { module = "org.jetbrains.kotlinx.binary-compatibility-validator:org.jetbrains.kotlinx.binary-compatibility-validator.gradle.plugin", version = "0.18.1" }
```

---

### Incident Patch 14: `f31af672` (2026-04-21)
**Commit Message**: Update dependency com.android.tools.build:gradle to v9.2.0 (#1801)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ ktlint = "0.48.2"
 
 [libraries]
 android-desugar-jdk-libs = { module = "com.android.tools:desugar_jdk_libs", version = "2.1.5" }
-android-gradle-plugin = { module = "com.android.tools.build:gradle", version = "9.1.0" }
+android-gradle-plugin = { module = "com.android.tools.build:gradle", version = "9.2.0" }
 androidx-test-ext-junit = { module = "androidx.test.ext:junit", version = "1.3.0" }
 androidx-test-runner = { module = "androidx.test:runner", version = "1.7.0" }
 binaryCompatibilityValidator = { module = "org.jetbrains.kotlinx.binary-compatibility-validator:org.jetbrains.kotlinx.binary-compatibility-validator.gradle.plugin", version = "0.18.1" }
```

---

### Incident Patch 15: `b98c0255` (2026-04-10)
**Commit Message**: Update dependency com.android.tools.build:gradle to v9.1.0 (#1784)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ ktlint = "0.48.2"
 
 [libraries]
 android-desugar-jdk-libs = { module = "com.android.tools:desugar_jdk_libs", version = "2.1.5" }
-android-gradle-plugin = { module = "com.android.tools.build:gradle", version = "9.0.1" }
+android-gradle-plugin = { module = "com.android.tools.build:gradle", version = "9.1.0" }
 androidx-test-ext-junit = { module = "androidx.test.ext:junit", version = "1.3.0" }
 androidx-test-runner = { module = "androidx.test:runner", version = "1.7.0" }
 binaryCompatibilityValidator = { module = "org.jetbrains.kotlinx.binary-compatibility-validator:org.jetbrains.kotlinx.binary-compatibility-validator.gradle.plugin", version = "0.18.1" }
```

#### Recent Merged Pull Requests:
- **PR #1879** (2026-10-05): Update gradle/actions action to v6.4.0 (@renovate[bot])
- **PR #1877** (2026-10-02): Update Gradle to v9.8.0 (@renovate[bot])
- **PR #1875** (2026-09-25): Update dependency com.android.tools.build:gradle to v9.4.1 (@renovate[bot])
- **PR #1873** (2026-09-17): Update actions/setup-java action to v6.0.1 (@renovate[bot])
- **PR #1872** (2026-09-11): Update BUG-BOUNTY.md (@npflores)
- **PR #1871** (2026-09-09): Update dependency org.jetbrains.kotlinx.binary-compatibility-validator:org.jetbrains.kotlinx.binary-compatibility-validator.gradle.plugin to v0.18.2 (@renovate[bot])
- **PR #1870** (2026-09-08): Update dependency com.android.tools.build:gradle to v9.4.0 (@renovate[bot])
- **PR #1869** (2026-09-04): Fix an unintended behavior change with base64 padding (@swankjesse)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
