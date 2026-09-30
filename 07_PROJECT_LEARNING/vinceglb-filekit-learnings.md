# Forensic Learning Record (Deep Inspection): vinceglb/FileKit

> **Canonical Artifact**: `07_PROJECT_LEARNING/vinceglb-filekit-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vinceglb/FileKit](https://github.com/vinceglb/FileKit))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T23:39:53.903Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vinceglb/FileKit`
- **Description**: Pick and save Files, Medias and Folder for Kotlin Multiplatform / KMP and Compose Multiplatform / CMP
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1542 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


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

### Incident Patch 1: `9f34bef9` (2026-09-07)
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
-Commits are short, imperative statements and often begin with an emoji category (e.g., `✨ Add WASM picker`); keep related changes squashed together. Each PR should describe the change, note affected platfo
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

---

### Incident Patch 2: `c19bea00` (2026-09-07)
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
 
-private fun FileK
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

### Incident Patch 3: `940a73e8` (2026-09-07)
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

### Incident Patch 4: `e21e18b2` (2026-09-07)
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

---

### Incident Patch 5: `12e4aac0` (2026-08-10)
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

---

### Incident Patch 6: `39431d0b` (2026-08-08)
**Commit Message**: 📝 Fix camera FileProvider Compose example

**File**: `docs/dialogs/camera-picker.mdx` (modified, +12/-7)
```diff
@@ -173,13 +173,18 @@ val file = FileKit.openCameraPicker(
 
 ```kotlin filekit-dialogs-compose
 val customFile = FileKit.filesDir / "my_photo.jpg"
-Button(onClick = { 
-    launcher.launch(
-        destinationFile = customFile,
-        openCameraSettings = FileKitOpenCameraSettings(
-            authority = "${context.packageName}.fileprovider"
-        )
-    )
+val launcher = rememberCameraPickerLauncher(
+    openCameraSettings = FileKitOpenCameraSettings(
+        authority = "${context.packageName}.fileprovider",
+    ),
+    onError = { failure -> showError(failure.message) },
+    onResult = { file ->
+        // Handle the captured photo, or null when dismissed or camera permission is denied
+    },
+)
+
+Button(onClick = {
+    launcher.launch(destinationFile = customFile)
 }) {
     Text("Take a photo to custom location")
 }
```

---

### Incident Patch 7: `f9500dab` (2026-08-08)
**Commit Message**: 🐛 Normalize Android sharing security failures

**File**: `filekit-dialogs/src/androidHostTest/kotlin/io/github/vinceglb/filekit/dialogs/AndroidSharingFailureTest.kt` (modified, +14/-0)
```diff
@@ -23,6 +23,20 @@ class AndroidSharingFailureTest {
         assertSame(platformFailure, failure.cause)
     }
 
+    @Test
+    fun AndroidSharing_securityRejection_throwsDialogOperationalFailureWithCause() {
+        val platformFailure = SecurityException("Sharing launch rejected")
+
+        val failure = assertFailsWith<FileKitDialogException> {
+            launchAndroidShareIntent {
+                throw platformFailure
+            }
+        }
+
+        assertEquals("Android rejected the sharing launch.", failure.message)
+        assertSame(platformFailure, failure.cause)
+    }
+
     @Test
     fun AndroidSharing_unexpectedFailure_propagates() {
         val platformFailure = IllegalStateException("Unexpected sharing defect")
```

**File**: `filekit-dialogs/src/androidMain/kotlin/io/github/vinceglb/filekit/dialogs/FileKit.android.kt` (modified, +5/-0)
```diff
@@ -383,6 +383,11 @@ internal fun launchAndroidShareIntent(launch: () -> Unit) {
             message = "No Android activity is available to share the selected files.",
             cause = failure,
         )
+    } catch (failure: SecurityException) {
+        throw FileKitDialogException(
+            message = "Android rejected the sharing launch.",
+            cause = failure,
+        )
     }
 }
 
```

---

### Incident Patch 8: `c54ae48b` (2026-08-08)
**Commit Message**: 🐛 Normalize Android security launch failures

**File**: `filekit-dialogs-compose/src/androidHostTest/kotlin/io/github/vinceglb/filekit/dialogs/compose/AndroidComposePickerReliabilityTest.kt` (modified, +79/-3)
```diff
@@ -265,6 +265,19 @@ class AndroidComposePickerReliabilityTest {
         assertSame(launchFailure, failure.cause)
     }
 
+    @Test
+    fun PickerLaunchSafely_whenSecurityException_returnsOperationalFailureWithCause() {
+        val launchFailure = SecurityException("Picker launch rejected")
+
+        val result = launchFilePickerSafely {
+            throw launchFailure
+        }
+
+        val failure = assertIs<PickerLaunchResult.Failed>(result).failure
+        assertIs<FileKitPickerException>(failure)
+        assertSame(launchFailure, failure.cause)
+    }
+
     @Test
     fun PickerLaunchSafely_whenNoError_returnsLaunched() {
         var launched = false
@@ -290,6 +303,19 @@ class AndroidComposePickerReliabilityTest {
         assertSame(launchFailure, failure.cause)
     }
 
+    @Test
+    fun DirectoryLaunchSafely_whenSecurityException_returnsOperationalFailureWithCause() {
+        val launchFailure = SecurityException("Directory picker launch rejected")
+
+        val result = launchDirectoryPickerSafely {
+            throw launchFailure
+        }
+
+        val failure = assertIs<DirectoryLaunchResult.Failed>(result).failure
+        assertIs<FileKitDialogException>(failure)
+        assertSame(launchFailure, failure.cause)
+    }
+
     @Test
     fun DirectoryLaunchSafely_whenUnexpectedFailure_propagates() {
         val failure = IllegalStateException("Unexpected launcher defect")
@@ -326,6 +352,19 @@ class AndroidComposePickerReliabilityTest {
         assertSame(launchFailure, failure.cause)
     }
 
+    @Test
+    fun FileSaverLaunchSafely_whenSecurityException_returnsOperationalFailureWithCause() {
+        val launchFailure = SecurityException("File saver launch rejected")
+
+        val result = launchFileSaverSafely {
+            throw launchFailure
+        }
+
+        val failure = assertIs<SaverLaunchResult.Failed>(result).failure
+        assertIs<FileKitDialogException>(failure)
+        assertSame(launchFailure, failure.cause)
+    }
+
     @Test
     fun FileSaverLaunchSafely_whenUnexpectedFailure_propagates() {
         val failure = IllegalStateException("Unexpected saver defect")
@@ -354,7 +393,12 @@ class AndroidComposePickerReliabilityTest {
         var fallbackCalls = 0
 
         val outcome = resolvePickerLaunchOutcome(
-            launchPrimary = { PickerLaunchResult.Failed(FileKitPickerException("Primary failed")) },
+            launchPrimary = {
+                PickerLaunchResult.Failed(
+                    failure = FileKitPickerException("Primary failed"),
+                    isFallbackEligible = true,
+                )
+            },
             launchFallback = {
                 fallbackCalls++
                 PickerLaunchResult.Launched
@@ -365,13 +409,45 @@ class AndroidComposePickerReliabilityTest {
         assertEquals(1, fallbackCalls)
     }
 
+    @Test
+    fun PickerLaunchOutcome_primarySecurityFailure_doesNotLaunchFallback() {
+        val launchFailure = SecurityException("Visual picker launch rejected")
+        var fallbackCalls = 0
+
+        val outcome = resolvePickerLaunchOutcome(
+            launchPrimary = {
+                launchFilePickerSafely {
+                    throw launchFailure
+                }
+            },
+            launchFallback = {
+                fallbackCalls++
+                PickerLaunchResult.Launched
+            },
+        )
+
+        val failure = assertIs<PickerLaunchOutcome.Failed>(outcome).failure
+        assertSame(launchFailure, failure.cause)
+        assertEquals(0, fallbackCalls)
+    }
+
     @Test
     fun PickerLaunchOutcome_primaryAndFallbackFail_returnsFallbackOperationalFailure() {
         val fallbackFailure = FileKitPickerException("Fallback failed")
 
         val outcome = resolvePickerLaunchOutcome(
-            launchPrimary = { PickerLaunchResult.Failed(FileKitPickerException("Primary failed")) },
-            launchFallback = { PickerLaunchResult.Failed(fallbackFailure) },
+     
```

**File**: `filekit-dialogs-compose/src/androidMain/kotlin/io/github/vinceglb/filekit/dialogs/compose/FileKitCompose.android.kt` (modified, +32/-4)
```diff
@@ -622,6 +622,15 @@ internal fun launchFilePickerSafely(
             message = "No Android activity is available to open the file picker.",
             cause = failure,
         ),
+        isFallbackEligible = true,
+    )
+} catch (failure: SecurityException) {
+    PickerLaunchResult.Failed(
+        FileKitPickerException(
+            message = "Android rejected the file picker launch.",
+            cause = failure,
+        ),
+        isFallbackEligible = false,
     )
 }
 
@@ -646,6 +655,13 @@ internal fun launchDirectoryPickerSafely(
             cause = failure,
         ),
     )
+} catch (failure: SecurityException) {
+    DirectoryLaunchResult.Failed(
+        FileKitDialogException(
+            message = "Android rejected the directory picker launch.",
+            cause = failure,
+        ),
+    )
 }
 
 internal sealed interface DirectoryLaunchResult {
@@ -668,6 +684,13 @@ internal fun launchFileSaverSafely(
             cause = failure,
         ),
     )
+} catch (failure: SecurityException) {
+    SaverLaunchResult.Failed(
+        FileKitDialogException(
+            message = "Android rejected the file saver launch.",
+            cause = failure,
+        ),
+    )
 }
 
 internal sealed interface SaverLaunchResult {
@@ -683,6 +706,7 @@ internal sealed interface PickerLaunchResult {
 
     data class Failed(
         val failure: FileKitPickerException,
+        val isFallbackEligible: Boolean,
     ) : PickerLaunchResult
 }
 
@@ -699,15 +723,19 @@ internal sealed interface PickerLaunchOutcome {
 internal fun resolvePickerLaunchOutcome(
     launchPrimary: () -> PickerLaunchResult,
     launchFallback: () -> PickerLaunchResult,
-): PickerLaunchOutcome = when (launchPrimary()) {
+): PickerLaunchOutcome = when (val primaryResult = launchPrimary()) {
     PickerLaunchResult.Launched -> {
         PickerLaunchOutcome.PrimaryLaunched
     }
 
     is PickerLaunchResult.Failed -> {
-        when (val fallbackResult = launchFallback()) {
-            PickerLaunchResult.Launched -> PickerLaunchOutcome.FallbackLaunched
-            is PickerLaunchResult.Failed -> PickerLaunchOutcome.Failed(fallbackResult.failure)
+        if (!primaryResult.isFallbackEligible) {
+            PickerLaunchOutcome.Failed(primaryResult.failure)
+        } else {
+            when (val fallbackResult = launchFallback()) {
+                PickerLaunchResult.Launched -> PickerLaunchOutcome.FallbackLaunched
+                is PickerLaunchResult.Failed -> PickerLaunchOutcome.Failed(fallbackResult.failure)
+            }
         }
     }
 }
```

**File**: `filekit-dialogs/src/androidHostTest/kotlin/io/github/vinceglb/filekit/dialogs/AndroidDirectoryPickerFailureTest.kt` (modified, +14/-0)
```diff
@@ -15,6 +15,7 @@ import org.robolectric.RobolectricTestRunner
 import kotlin.test.Test
 import kotlin.test.assertEquals
 import kotlin.test.assertFailsWith
+import kotlin.test.assertIs
 import kotlin.test.assertSame
 
 @RunWith(RobolectricTestRunner::class)
@@ -31,6 +32,19 @@ class AndroidDirectoryPickerFailureTest {
         assertSame(platformFailure, failure.cause)
     }
 
+    @Test
+    fun AndroidDirectoryPicker_securityRejection_throwsDialogOperationalFailureWithCause() {
+        val platformFailure = SecurityException("Directory picker launch rejected")
+        FileKit.init(throwingActivityResultRegistry(platformFailure))
+
+        val failure = assertFailsWith<FileKitDialogException> {
+            runBlocking { FileKit.openDirectoryPicker() }
+        }
+
+        val cause = assertIs<SecurityException>(failure.cause)
+        assertEquals(platformFailure.message, cause.message)
+    }
+
     @Test
     fun AndroidDirectoryPicker_cancellation_propagatesUnchanged() {
         val cancellation = CancellationException("Directory picker cancelled")
```

**File**: `filekit-dialogs/src/androidHostTest/kotlin/io/github/vinceglb/filekit/dialogs/AndroidFileSaverFailureTest.kt` (modified, +14/-0)
```diff
@@ -14,6 +14,7 @@ import org.robolectric.RobolectricTestRunner
 import kotlin.test.Test
 import kotlin.test.assertEquals
 import kotlin.test.assertFailsWith
+import kotlin.test.assertIs
 import kotlin.test.assertSame
 
 @RunWith(RobolectricTestRunner::class)
@@ -30,6 +31,19 @@ class AndroidFileSaverFailureTest {
         assertSame(platformFailure, failure.cause)
     }
 
+    @Test
+    fun AndroidFileSaver_securityRejection_throwsDialogOperationalFailureWithCause() {
+        val platformFailure = SecurityException("File saver launch rejected")
+        FileKit.init(throwingActivityResultRegistry(platformFailure))
+
+        val failure = assertFailsWith<FileKitDialogException> {
+            runBlocking { openFileSaver() }
+        }
+
+        val cause = assertIs<SecurityException>(failure.cause)
+        assertEquals(platformFailure.message, cause.message)
+    }
+
     @Test
     fun AndroidFileSaver_cancellation_propagatesUnchanged() {
         val cancellation = CancellationException("Saver cancelled")
```

**File**: `filekit-dialogs/src/androidHostTest/kotlin/io/github/vinceglb/filekit/dialogs/AndroidPickerLaunchFallbackTest.kt` (modified, +43/-0)
```diff
@@ -70,6 +70,49 @@ class AndroidPickerLaunchFallbackTest {
         assertSame(launchFailure, failure.cause)
     }
 
+    @Test
+    fun PickerLaunch_primaryThrowsSecurityException_doesNotInvokeFallbackAndThrowsPickerFailureWithCause() {
+        val launchFailure = SecurityException("Visual picker launch rejected")
+        var fallbackCalls = 0
+
+        val failure = assertFailsWith<FileKitPickerException> {
+            runBlocking {
+                runPickerLaunchWithActivityNotFoundFallback(
+                    primary = {
+                        throw launchFailure
+                    },
+                    fallback = {
+                        fallbackCalls++
+                        "fallback-result"
+                    },
+                )
+            }
+        }
+
+        assertSame(launchFailure, failure.cause)
+        assertEquals(0, fallbackCalls)
+    }
+
+    @Test
+    fun PickerLaunch_fallbackThrowsSecurityException_throwsPickerFailureWithCause() {
+        val launchFailure = SecurityException("Document picker launch rejected")
+
+        val failure = assertFailsWith<FileKitPickerException> {
+            runBlocking {
+                runPickerLaunchWithActivityNotFoundFallback(
+                    primary = {
+                        throw ActivityNotFoundException("No activity for visual picker")
+                    },
+                    fallback = {
+                        throw launchFailure
+                    },
+                )
+            }
+        }
+
+        assertSame(launchFailure, failure.cause)
+    }
+
     @Test
     fun PickerLaunch_primaryReturnsNull_doesNotInvokeFallback() = runBlocking {
         var fallbackCalls = 0
```

---

### Incident Patch 9: `29d0b55e` (2026-08-05)
**Commit Message**: 🐛 Fix Compose dialog parent forwarding

**File**: `filekit-dialogs-compose/src/jvmMain/kotlin/io/github/vinceglb/filekit/dialogs/compose/FileKitCompose.jvm.kt` (modified, +2/-2)
```diff
@@ -38,7 +38,7 @@ public fun <PickerResult, ConsumedResult> WindowScope.rememberFilePickerLauncher
     type = type,
     mode = mode,
     directory = directory,
-    dialogSettings = injectDialogSettings(dialogSettings, this.window),
+    dialogSettings = injectDialogSettings(dialogSettings, FileKitDialogParent.awt(this.window)),
     onError = onError,
     onResult = onResult,
 )
@@ -66,7 +66,7 @@ public fun WindowScope.rememberFilePickerLauncher(
 ): PickerResultLauncher = io.github.vinceglb.filekit.dialogs.compose.rememberFilePickerLauncher(
     type = type,
     directory = directory,
-    dialogSettings = injectDialogSettings(dialogSettings, this.window),
+    dialogSettings = injectDialogSettings(dialogSettings, FileKitDialogParent.awt(this.window)),
     onError = onError,
     onResult = onResult,
 )
```

---

### Incident Patch 10: `3380b8c8` (2026-07-31)
**Commit Message**: Merge pull request #631 from vinceglb/vinceglb/fix-compose-picker-failure-crash

🐛 Handle Compose picker failures without crashing

**File**: `filekit-dialogs-compose/src/androidMain/kotlin/io/github/vinceglb/filekit/dialogs/compose/FileKitCompose.android.kt` (modified, +3/-0)
```diff
@@ -34,6 +34,7 @@ import io.github.vinceglb.filekit.dialogs.FileKitCameraFacing
 import io.github.vinceglb.filekit.dialogs.FileKitDialogSettings
 import io.github.vinceglb.filekit.dialogs.FileKitMode
 import io.github.vinceglb.filekit.dialogs.FileKitOpenCameraSettings
+import io.github.vinceglb.filekit.dialogs.FileKitPickerException
 import io.github.vinceglb.filekit.dialogs.FileKitPickerState
 import io.github.vinceglb.filekit.dialogs.FileKitType
 import io.github.vinceglb.filekit.dialogs.TakePictureWithCameraFacing
@@ -68,11 +69,13 @@ private fun InitializeAndroidFileKit() {
 }
 
 @Composable
+@Suppress("UNUSED_PARAMETER")
 internal actual fun <PickerResult, ConsumedResult> rememberPlatformFilePickerLauncher(
     type: FileKitType,
     mode: FileKitMode<PickerResult, ConsumedResult>,
     directory: PlatformFile?,
     dialogSettings: FileKitDialogSettings,
+    onError: (FileKitPickerException) -> Unit,
     onResult: (ConsumedResult) -> Unit,
 ): PickerResultLauncher {
     InitializeAndroidFileKit()
```

**File**: `filekit-dialogs-compose/src/commonMain/kotlin/io/github/vinceglb/filekit/dialogs/compose/FileKitCompose.kt` (modified, +76/-0)
```diff
@@ -6,6 +6,7 @@ import androidx.compose.runtime.Composable
 import io.github.vinceglb.filekit.PlatformFile
 import io.github.vinceglb.filekit.dialogs.FileKitDialogSettings
 import io.github.vinceglb.filekit.dialogs.FileKitMode
+import io.github.vinceglb.filekit.dialogs.FileKitPickerException
 import io.github.vinceglb.filekit.dialogs.FileKitType
 
 /**
@@ -17,13 +18,43 @@ import io.github.vinceglb.filekit.dialogs.FileKitType
  * @param dialogSettings Platform-specific settings for the dialog.
  * @param onResult Callback invoked with the result.
  * @return A [PickerResultLauncher] that can be used to launch the picker.
+ *
+ * Picker failures are ignored by this overload. Use the overload with `onError` to handle them.
+ */
+@Composable
+public fun <PickerResult, ConsumedResult> rememberFilePickerLauncher(
+    type: FileKitType = FileKitType.File(),
+    mode: FileKitMode<PickerResult, ConsumedResult>,
+    directory: PlatformFile? = null,
+    dialogSettings: FileKitDialogSettings = FileKitDialogSettings.createDefault(),
+    onResult: (ConsumedResult) -> Unit,
+): PickerResultLauncher = rememberFilePickerLauncher(
+    type = type,
+    mode = mode,
+    directory = directory,
+    dialogSettings = dialogSettings,
+    onError = {},
+    onResult = onResult,
+)
+
+/**
+ * Creates and remembers a [PickerResultLauncher] for picking files.
+ *
+ * @param type The type of files to pick. Defaults to [FileKitType.File].
+ * @param mode The picking mode (e.g. Single, Multiple).
+ * @param directory The initial directory. Supported on desktop platforms.
+ * @param dialogSettings Platform-specific settings for the dialog.
+ * @param onError Callback invoked when FileKit cannot resolve the selected files.
+ * @param onResult Callback invoked with the result.
+ * @return A [PickerResultLauncher] that can be used to launch the picker.
  */
 @Composable
 public fun <PickerResult, ConsumedResult> rememberFilePickerLauncher(
     type: FileKitType = FileKitType.File(),
     mode: FileKitMode<PickerResult, ConsumedResult>,
     directory: PlatformFile? = null,
     dialogSettings: FileKitDialogSettings = FileKitDialogSettings.createDefault(),
+    onError: (FileKitPickerException) -> Unit,
     onResult: (ConsumedResult) -> Unit,
 ): PickerResultLauncher {
     val stableDialogSettings = rememberStableDialogSettings(dialogSettings)
@@ -32,6 +63,7 @@ public fun <PickerResult, ConsumedResult> rememberFilePickerLauncher(
         mode = mode,
         directory = directory,
         dialogSettings = stableDialogSettings,
+        onError = onError,
         onResult = onResult,
     )
 }
@@ -44,18 +76,46 @@ public fun <PickerResult, ConsumedResult> rememberFilePickerLauncher(
  * @param dialogSettings Platform-specific settings for the dialog.
  * @param onResult Callback invoked with the picked file, or null if cancelled.
  * @return A [PickerResultLauncher] that can be used to launch the picker.
+ *
+ * Picker failures are ignored by this overload. Use the overload with `onError` to handle them.
+ */
+@Composable
+public fun rememberFilePickerLauncher(
+    type: FileKitType = FileKitType.File(),
+    directory: PlatformFile? = null,
+    dialogSettings: FileKitDialogSettings = FileKitDialogSettings.createDefault(),
+    onResult: (PlatformFile?) -> Unit,
+): PickerResultLauncher = rememberFilePickerLauncher(
+    type = type,
+    directory = directory,
+    dialogSettings = dialogSettings,
+    onError = {},
+    onResult = onResult,
+)
+
+/**
+ * Creates and remembers a [PickerResultLauncher] for picking a single file.
+ *
+ * @param type The type of files to pick. Defaults to [FileKitType.File].
+ * @param directory The initial directory. Supported on desktop platforms.
+ * @param dialogSettings Platform-specific settings for the dialog.
+ * @param onError Callback invoked when FileKit cannot resolve the selected file.
+ * @param onResult Callback invoked with the picked file, or null if cancelled.
+ * @return A [PickerResultLauncher] 
```

**File**: `filekit-dialogs-compose/src/commonTest/kotlin/io/github/vinceglb/filekit/dialogs/compose/FileKitComposeFailureTest.kt` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+@file:Suppress("ktlint:standard:function-naming", "TestFunctionName")
+
+package io.github.vinceglb.filekit.dialogs.compose
+
+import io.github.vinceglb.filekit.dialogs.FileKitMode
+import io.github.vinceglb.filekit.dialogs.FileKitPickerException
+import kotlinx.coroutines.test.runTest
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertFalse
+import kotlin.test.assertTrue
+
+class FileKitComposeFailureTest {
+    @Test
+    fun runFilePickerLauncher_reportsPickerException_withoutInvokingResult() = runTest {
+        val failure = FileKitPickerException("Failed to load the selected file.")
+        var reportedFailure: FileKitPickerException? = null
+        var resultInvoked = false
+
+        runFilePickerLauncher(
+            mode = FileKitMode.Single,
+            openPicker = { throw failure },
+            onError = { reportedFailure = it },
+            onResult = { resultInvoked = true },
+        )
+
+        assertEquals(expected = failure, actual = reportedFailure)
+        assertFalse(resultInvoked)
+    }
+
+    @Test
+    fun runFilePickerLauncher_invokesResult_withoutInvokingError() = runTest {
+        var errorInvoked = false
+        var resultInvoked = false
+
+        runFilePickerLauncher(
+            mode = FileKitMode.Single,
+            openPicker = { null },
+            onError = { errorInvoked = true },
+            onResult = { resultInvoked = true },
+        )
+
+        assertFalse(errorInvoked)
+        assertTrue(resultInvoked)
+    }
+}
```

**File**: `filekit-dialogs-compose/src/jvmMain/kotlin/io/github/vinceglb/filekit/dialogs/compose/FileKitCompose.jvm.kt` (modified, +33/-0)
```diff
@@ -7,6 +7,7 @@ import androidx.compose.ui.window.WindowScope
 import io.github.vinceglb.filekit.PlatformFile
 import io.github.vinceglb.filekit.dialogs.FileKitDialogSettings
 import io.github.vinceglb.filekit.dialogs.FileKitMode
+import io.github.vinceglb.filekit.dialogs.FileKitPickerException
 import io.github.vinceglb.filekit.dialogs.FileKitType
 import java.awt.Window
 
@@ -25,16 +26,48 @@ public fun <PickerResult, ConsumedResult> WindowScope.rememberFilePickerLauncher
     onResult = onResult,
 )
 
+@Composable
+public fun <PickerResult, ConsumedResult> WindowScope.rememberFilePickerLauncher(
+    type: FileKitType = FileKitType.File(),
+    mode: FileKitMode<PickerResult, ConsumedResult>,
+    directory: PlatformFile? = null,
+    dialogSettings: FileKitDialogSettings? = null,
+    onError: (FileKitPickerException) -> Unit,
+    onResult: (ConsumedResult?) -> Unit,
+): PickerResultLauncher = io.github.vinceglb.filekit.dialogs.compose.rememberFilePickerLauncher(
+    type = type,
+    mode = mode,
+    directory = directory,
+    dialogSettings = injectDialogSettings(dialogSettings, this.window),
+    onError = onError,
+    onResult = onResult,
+)
+
+@Composable
+public fun WindowScope.rememberFilePickerLauncher(
+    type: FileKitType = FileKitType.File(),
+    directory: PlatformFile? = null,
+    dialogSettings: FileKitDialogSettings? = null,
+    onResult: (PlatformFile?) -> Unit,
+): PickerResultLauncher = io.github.vinceglb.filekit.dialogs.compose.rememberFilePickerLauncher(
+    type = type,
+    directory = directory,
+    dialogSettings = injectDialogSettings(dialogSettings, this.window),
+    onResult = onResult,
+)
+
 @Composable
 public fun WindowScope.rememberFilePickerLauncher(
     type: FileKitType = FileKitType.File(),
     directory: PlatformFile? = null,
     dialogSettings: FileKitDialogSettings? = null,
+    onError: (FileKitPickerException) -> Unit,
     onResult: (PlatformFile?) -> Unit,
 ): PickerResultLauncher = io.github.vinceglb.filekit.dialogs.compose.rememberFilePickerLauncher(
     type = type,
     directory = directory,
     dialogSettings = injectDialogSettings(dialogSettings, this.window),
+    onError = onError,
     onResult = onResult,
 )
 
```

**File**: `filekit-dialogs-compose/src/nonAndroidMain/kotlin/io/github/vinceglb/filekit/dialogs/compose/FileKitCompose.nonAndroid.kt` (modified, +14/-5)
```diff
@@ -9,6 +9,7 @@ import io.github.vinceglb.filekit.FileKit
 import io.github.vinceglb.filekit.PlatformFile
 import io.github.vinceglb.filekit.dialogs.FileKitDialogSettings
 import io.github.vinceglb.filekit.dialogs.FileKitMode
+import io.github.vinceglb.filekit.dialogs.FileKitPickerException
 import io.github.vinceglb.filekit.dialogs.FileKitType
 import io.github.vinceglb.filekit.dialogs.openDirectoryPicker
 import io.github.vinceglb.filekit.dialogs.openFilePicker
@@ -54,6 +55,7 @@ internal actual fun <PickerResult, ConsumedResult> rememberPlatformFilePickerLau
     mode: FileKitMode<PickerResult, ConsumedResult>,
     directory: PlatformFile?,
     dialogSettings: FileKitDialogSettings,
+    onError: (FileKitPickerException) -> Unit,
     onResult: (ConsumedResult) -> Unit,
 ): PickerResultLauncher {
     val coroutineScope = rememberCoroutineScope()
@@ -63,18 +65,25 @@ internal actual fun <PickerResult, ConsumedResult> rememberPlatformFilePickerLau
     val currentMode by rememberUpdatedState(mode)
     val currentDirectory by rememberUpdatedState(directory)
     val currentDialogSettings by rememberUpdatedState(stableDialogSettings)
+    val currentOnError by rememberUpdatedState(onError)
     val currentOnConsumed by rememberUpdatedState(onResult)
 
     return remember {
         PickerResultLauncher {
             coroutineScope.launch {
-                val result = FileKit.openFilePicker(
-                    type = currentType,
+                runFilePickerLauncher(
                     mode = currentMode,
-                    directory = currentDirectory,
-                    dialogSettings = currentDialogSettings,
+                    openPicker = {
+                        FileKit.openFilePicker(
+                            type = currentType,
+                            mode = currentMode,
+                            directory = currentDirectory,
+                            dialogSettings = currentDialogSettings,
+                        )
+                    },
+                    onError = currentOnError,
+                    onResult = currentOnConsumed,
                 )
-                currentMode.consumeResult(result, currentOnConsumed)
             }
         }
     }
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
