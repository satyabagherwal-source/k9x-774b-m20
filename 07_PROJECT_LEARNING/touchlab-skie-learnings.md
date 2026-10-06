# Forensic Learning Record (Deep Inspection): touchlab/SKIE

> **Canonical Artifact**: `07_PROJECT_LEARNING/touchlab-skie-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/touchlab/SKIE](https://github.com/touchlab/SKIE))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:00:59.171Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `touchlab/SKIE`
- **Description**: SKIE - Swift Kotlin Interface Enhancer
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1333 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `SKIE/common/configuration/api/src/main/kotlin/co/touchlab/skie/configuration/util/StringThrowIfNull.kt`
```
package co.touchlab.skie.configuration.util

fun String?.throwIfNull(): String =
    this ?: throw IllegalStateException("Parsing error: value is not expected to be null")

```

### Core Architecture Module: `SKIE/common/util/src/main/kotlin/co/touchlab/skie/util/CollisionFreeIdentifier.kt`
```
package co.touchlab.skie.util

fun String.collisionFreeIdentifier(existingIdentifiers: Collection<String>): String {
    val set = existingIdentifiers.toSet()

    return createCollisionFreeString(this) { it in set }
}

private tailrec fun createCollisionFreeString(baseString: String, collides: (String) -> Boolean): String =
    if (!collides(baseString)) baseString else createCollisionFreeString("${baseString}_", collides)


```

### Core Architecture Module: `SKIE/common/util/src/main/kotlin/co/touchlab/skie/util/Command.kt`
```
package co.touchlab.skie.util
/*
 * Copyright 2010-2017 JetBrains s.r.o.
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

import java.io.File
import java.nio.file.Files

open class Command(initialCommand: List<String>) {

    constructor(tool: String) : this(listOf(tool))
    constructor(vararg command: String) : this(command.toList<String>())

    protected val command = initialCommand.toMutableList()

    val argsWithExecutable: List<String> = command

    val args: List<String>
        get() = command.drop(1)

    var workingDirectory: File? = null

    operator fun String.unaryPlus(): Command {
        command += this
        return this@Command
    }

    operator fun List<String>.unaryPlus(): Command {
        command.addAll(this)
        return this@Command
    }

    operator fun File.unaryPlus(): Command {
        command += absolutePath
        return this@Command
    }

    var logger: ((() -> String) -> Unit)? = null

    fun logWith(newLogger: ((() -> String) -> Unit)): Command {
        logger = newLogger
        return this
    }

    fun execute(
        withErrors: Boolean = true,
        handleError: Boolean = true,
        logFile: File? = null,
    ): Result {
        log()

        // Note: getting process output could be done without redirecting to temporary file,
        // however this would require managing a thread to read `process.inputStream` because
        // it may have limited capacity.
        val tempOutputFile = Files.createTempFile(null, null).toFile().also { it.deleteOnExit() }
        logFile?.apply {
            // FIXME: This doesn't put quotes around arguments with spaces
            appendText(command.joinToString(" ", postfix = "\n\n\n"))
        }

        try {
            val builder = ProcessBuilder(command)
                .directory(workingDirectory)
                .redirectInput(ProcessBuilder.Redirect.INHERIT)
                .redirectError(ProcessBuilder.Redirect.INHERIT)
                .redirectOutput(ProcessBuilder.Redirect.appendTo(tempOutputFile))
                .redirectErrorStream(withErrors)
            val process = builder.start()
            val code = process.waitFor()
            val result = tempOutputFile.readLines()

            if (handleError) {
                handleExitCode(code, result)
            }

            return Result(code, result)
        } finally {
            logFile?.apply { appendText(tempOutputFile.readText()) }
            tempOutputFile.delete()
        }
    }

    class Result(val exitCode: Int, val outputLines: List<String>)

    private fun handleExitCode(code: Int, output: List<String> = emptyList()) {
        if (code != 0) error(
            """
            The ${command[0]} command returned non-zero exit code: $code.
            output:
            """.trimIndent() + "\n${output.joinToString("\n")}"
        )
    }

    private fun log() {
        logger?.let { it { command.joinToString(" ") } }
    }
}

```

### Core Architecture Module: `SKIE/common/util/src/main/kotlin/co/touchlab/skie/util/SystemProperty.kt`
```
package co.touchlab.skie.util

object SystemProperty {

    fun find(name: String): String? =
        System.getProperty(name)

    fun get(name: String): String =
        find(name) ?: error("System property '$name' not found.")

    fun exists(name: String): Boolean =
        find(name) != null

    fun notExists(name: String): Boolean =
        find(name) == null
}

```

### Core Architecture Module: `SKIE/common/util/src/main/kotlin/co/touchlab/skie/util/TargetTriple.kt`
```
package co.touchlab.skie.util

data class TargetTriple(
    val architecture: String,
    val vendor: String,
    val os: String,
    val environment: String?,
) {

    val isMacos: Boolean
        get() = os == "macos"

    override fun toString(): String {
        val envSuffix = environment?.let { "-$environment" } ?: ""

        return "$architecture-$vendor-$os$envSuffix"
    }

    fun withOsVersion(osVersion: String): TargetTriple =
        copy(os = "$os$osVersion")

    companion object {

        operator fun invoke(tripleString: String): TargetTriple {
            val components = tripleString.split('-')

            require(components.size in 3..4) {
                "Invalid target triple: $tripleString, should be <arch>-<vendor>-<os>-<environment?>."
            }

            return TargetTriple(
                architecture = components[0],
                vendor = components[1],
                os = components[2],
                environment = components.getOrNull(3),
            )
        }
    }
}

```

### Core Architecture Module: `SKIE/common/util/src/main/kotlin/co/touchlab/skie/util/cache/DirectorySyncDifferences.kt`
```
package co.touchlab.skie.util.cache

import java.io.File
import java.nio.file.Path
import kotlin.io.path.absolutePathString
import kotlin.io.path.createDirectories
import kotlin.io.path.deleteIfExists
import kotlin.io.path.exists
import kotlin.io.path.isDirectory
import kotlin.io.path.listDirectoryEntries
import kotlin.io.path.name

fun File.syncDirectoryContentIfDifferent(destination: File) {
    toPath().syncDirectoryContentIfDifferent(destination.toPath())
}

fun Path.syncDirectoryContentIfDifferent(destination: Path) {
    if (!destination.exists()) {
        destination.createDirectories()
    }

    require(this.isDirectory()) { "Source ${this.absolutePathString()} must be a directory." }
    require(destination.isDirectory()) { "Destination ${destination.absolutePathString()} must be a directory." }

    deleteRemovedFilesFromMirror(this, destination)
    deleteRemovedDirectoriesFromMirror(this, destination)

    copyChildFilesIfDifferent(this, destination)
    syncChildDirectoriesContentIfDifferent(this, destination)
}

private fun deleteRemovedFilesFromMirror(origin: Path, mirror: Path) {
    val originFiles = origin.listDirectoryEntries().filterNot { it.isDirectory() }.map { it.name }.toSet()
    val mirrorFiles = mirror.listDirectoryEntries().filterNot { it.isDirectory() }.map { it.name }.toSet()

    val removedFiles = mirrorFiles - originFiles

    removedFiles.forEach {
        mirror.resolve(it).deleteIfExists()
    }
}

private fun deleteRemovedDirectoriesFromMirror(origin: Path, mirror: Path) {
    val originDirectories = origin.listDirectoryEntries().filter { it.isDirectory() }.map { it.name }.toSet()
    val mirrorDirectories = mirror.listDirectoryEntries().filter { it.isDirectory() }.map { it.name }.toSet()

    val removedDirectories = mirrorDirectories - originDirectories

    removedDirectories.forEach {
        mirror.resolve(it).deleteRecursivelyIfExists()
    }
}

private fun copyChildFilesIfDifferent(origin: Path, destination: Path) {
    origin.listDirectoryEntries()
        .toList()
        .parallelStream()
        .filter { !it.isDirectory() }
        .forEach { file ->
            file.copyFileToIfDifferent(destination.resolve(file.name))
        }
}

private fun syncChildDirectoriesContentIfDifferent(origin: Path, destination: Path) {
    origin.listDirectoryEntries()
        .toList()
        .parallelStream()
        .filter { it.isDirectory() }
        .forEach { directory ->
            directory.syncDirectoryContentIfDifferent(destination.resolve(directory.name))
        }
}

// There is currently no stable API for this in Kotlin
private fun Path.deleteRecursivelyIfExists() {
    if (isDirectory()) {
        listDirectoryEntries().forEach {
            it.deleteRecursivelyIfExists()
        }
    }

    deleteIfExists()
}

```

### Core Architecture Module: `SKIE/common/util/src/main/kotlin/co/touchlab/skie/util/cache/FileCopyToIfDifferent.kt`
```
package co.touchlab.skie.util.cache

import java.io.File
import java.nio.file.Path
import kotlin.io.path.absolutePathString
import kotlin.io.path.deleteIfExists
import kotlin.io.path.exists
import kotlin.io.path.isRegularFile
import kotlin.io.path.readText
import kotlin.io.path.writeText

fun File.copyFileToIfDifferent(destination: File): Boolean =
    toPath().copyFileToIfDifferent(destination.toPath())

fun Path.copyFileToIfDifferent(destination: Path): Boolean {
    require(isRegularFile() || !exists()) { "Source ${absolutePathString()} must be either a regular file or not exist." }
    require(destination.isRegularFile() || !destination.exists()) { "Destination ${destination.absolutePathString()} must be either a regular file or not exist." }

    val sourceContent = if (exists()) readText() else null
    val destinationContent = if (destination.exists()) destination.readText() else null

    return if (sourceContent != null) {
        if (sourceContent != destinationContent) {
            destination.writeText(sourceContent)

            true
        } else {
            false
        }
    } else {
        if (destinationContent != null) {
            destination.deleteIfExists()

            true
        } else {
            false
        }
    }
}

```

### Core Architecture Module: `SKIE/common/util/src/main/kotlin/co/touchlab/skie/util/cache/FileReadTextOrNull.kt`
```
package co.touchlab.skie.util.cache

import java.io.File

fun File.readTextOrNull(): String? =
    if (isFile) readText() else null

```

### Core Architecture Module: `SKIE/common/util/src/main/kotlin/co/touchlab/skie/util/cache/FileWriteTextIfDifferent.kt`
```
package co.touchlab.skie.util.cache

import java.io.File
import java.nio.file.Path

fun File.writeTextIfDifferent(text: String) {
    require(isFile || !exists()) { "File $absolutePath must be either a regular file or not exist." }

    val existingContent = readTextOrNull()
    if (existingContent != text) {
        writeText(text)
    }
}

fun Path.writeTextIfDifferent(text: String) {
    toFile().writeTextIfDifferent(text)
}

```

### Core Architecture Module: `SKIE/common/util/src/main/kotlin/co/touchlab/skie/util/directory/FrameworkLayout.kt`
```
package co.touchlab.skie.util.directory

import co.touchlab.skie.util.TargetTriple
import java.io.File

class FrameworkLayout(
    val frameworkDirectory: File,
    isMacosFramework: Boolean,
    isSkieCache: Boolean = false,
) {

    constructor(frameworkPath: String, isMacosFramework: Boolean) : this(File(frameworkPath), isMacosFramework)

    val frameworkName: String by lazy { frameworkDirectory.name.removeSuffix(".framework") }

    val parentDir: File by lazy { frameworkDirectory.parentFile }

    val frameworkContentDir = if (isMacosFramework && !isSkieCache) frameworkDirectory.resolve("Versions/A") else frameworkDirectory

    val headersDir: File by lazy { frameworkContentDir.resolve("Headers").also { it.mkdirs() } }
    val kotlinHeader: File by lazy { headersDir.resolve("$frameworkName.h") }
    val apiNotes: File by lazy { headersDir.resolve("$frameworkName.apinotes") }
    val swiftHeader: File by lazy { headersDir.resolve("$frameworkName-Swift.h") }

    val modulesDir: File by lazy { frameworkContentDir.resolve("Modules").also { it.mkdirs() } }
    val swiftModuleParent: File by lazy { modulesDir.resolve("$frameworkName.swiftmodule").also { it.mkdirs() } }
    val modulemapFile: File by lazy { modulesDir.resolve("module.modulemap") }

    fun swiftModule(targetTriple: TargetTriple): File = swiftModuleParent.resolve("$targetTriple.swiftmodule")

    fun swiftInterface(targetTriple: TargetTriple): File = swiftModuleParent.resolve("$targetTriple.swiftinterface")

    fun privateSwiftInterface(targetTriple: TargetTriple): File = swiftModuleParent.resolve("$targetTriple.private.swiftinterface")

    fun swiftDoc(targetTriple: TargetTriple): File = swiftModuleParent.resolve("$targetTriple.swiftdoc")

    fun abiJson(targetTriple: TargetTriple): File = swiftModuleParent.resolve("$targetTriple.abi.json")

    fun swiftSourceInfo(targetTriple: TargetTriple): File = swiftModuleParent.resolve("$targetTriple.swiftsourceinfo")
}

```

### Core Architecture Module: `SKIE/common/util/src/main/kotlin/co/touchlab/skie/util/directory/SkieApplicationSupportDirectory.kt`
```
package co.touchlab.skie.util.directory

import co.touchlab.skie.util.directory.structure.RootDirectory
import java.io.File

class SkieApplicationSupportDirectory(
    rootDirectory: File,
) : RootDirectory(rootDirectory) {

    val analyticsId: File = directory.resolve("analytics-id")
}

```

### Core Architecture Module: `SKIE/common/util/src/main/kotlin/co/touchlab/skie/util/directory/SkieCompilationDirectory.kt`
```
package co.touchlab.skie.util.directory

import co.touchlab.skie.util.directory.structure.Directory
import co.touchlab.skie.util.directory.structure.PermanentDirectory
import co.touchlab.skie.util.directory.structure.RootDirectory
import java.io.File

class SkieCompilationDirectory(
    rootDirectory: File,
) : RootDirectory(rootDirectory) {

    val swift: Swift = Swift(this)

    class Swift(parent: Directory) : PermanentDirectory(parent, "swift") {

        val bundled: Bundled = Bundled(this)

        class Bundled(parent: Directory) : PermanentDirectory(parent, "bundled")
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1** (2023-09-06): **Support @ObjCName Swift Name in Enum**
  *Symptoms*: ### First of all, congrats on make the tool open source :tada:. The Touchlab work for the KMP community is amazing! Great thanks for all the working of all you folks have being doing.  I was doing the first setup of Skie here on multiplatform project, it seems to have compilation issue in the generated Swift Extensions when trying to compile against a `enum value` that is using `@ObjcName(swiftName = "...")`. See the log below.  I also look into the [Known Issues page](https://skie.touchlab.co/KnownIssues) but did not find the comment about this issue, this is why I'm openning.   ``` path/to/the/project/build/skie/releaseFramework/iosX64/swift/generated/com.sample.module.HomeNavigation.OnboardingStep.swift:32:165: error: 'tohome' has been renamed to 'toHome'     case .tohome: return __Skie.class_path_to_file_HomeNavigation_OnboardingStep.tohome as __Skie.class___path_to_file_HomeNavigation_OnboardingStep                                                                                                                                                 ^~~~~~~                                                                                                                                                  toHome KotlinShared.__HomeNavigationOnboardingStep:7:20: note: 'tohome' was obsoleted in Swift 3     open class var tohome: KotlinShared.HomeNavigationOnboardingStep { get } ```  The kotlin code: ```kotlin public sealed interface HomeNavigation {      public enum cla
  **Post-Mortem & Fix Analysis**:
  > Thank you for opening this issue. SKIE is asking Kotlin for names of these classes, so it's interesting to see it's not resolving correctly. We'll definitely be looking into this and get it fixed in SKIE. Thanks!
  > @TadeasKriz I'm looking at the source code  I seem that it could be easily fixed by just switching `getEnumEntrySelector` to `getEnumEntrySwiftName` here: https://github.com/touchlab/SKIE/blob/main/SKIE/compiler/kotlin-plugin/src/kgp_common/kotlin/co/touchlab/skie/api/model/type/ActualKotlinEnumEntrySwiftModel.kt#L15  I tested locally here by publishing to plugin and fix the issue for me.
  > @DevSrSouza & @TadeasKriz  I think we need to have a condition in that line for the cases of when the annotation doesn't exist  ```kotlin // Check first if we have the `@ObjCName` annotation, if yes override val identifier: String = if (namer.getEnumEntrySwiftName(descriptor.original).isNullOrEmpty()) {     namer.getEnumEntrySwiftName(descriptor.original) } else {     namer.getEnumEntrySelector(descriptor.original) } ````  **P.S** I wrote this from mobile after a quick code check, so apologise for not investigating this part further and providing a PR

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

### Incident Patch 1: `74444363` (2026-07-01)
**Commit Message**: Fix configuration cache serialization of the Swift source set

SwiftBundlingConfigurator exposed the bundled Swift sources as a live
DefaultSourceDirectorySet and attached it as a task input. That type is
not supported by Gradle's configuration cache, so once SKIE's Kotlin
source-set container becomes reachable from a stored task graph (for
example a consumer link-task action that captures the KotlinNativeTarget),
storing the entry fails and the cache is discarded.

Expose the Swift sources as a ConfigurableFileCollection of the source
directories (filtered to **/*.swift) instead. It stores resolved paths
rather than the source-set container and its actions, so it is
serializable even when reached from the task graph. Behavior is unchanged.

Add a regression test that recreates the reachability condition and
asserts SKIE contributes no SourceDirectorySet problem to the
configuration cache report.

Co-Authored-By: Claude Opus 4.8 <[REDACTED_EMAIL]>

**File**: `SKIE/skie-gradle/plugin-impl/src/main/kotlin/co/touchlab/skie/plugin/switflink/SwiftBundlingConfigurator.kt` (modified, +13/-14)
```diff
@@ -11,7 +11,7 @@ import co.touchlab.skie.plugin.util.writeToZip
 import co.touchlab.skie.util.cache.syncDirectoryContentIfDifferent
 import co.touchlab.skie.util.file.isKlib
 import org.gradle.api.Project
-import org.gradle.api.file.SourceDirectorySet
+import org.gradle.api.file.FileCollection
 import org.gradle.api.provider.Provider
 import java.io.File
 
@@ -38,12 +38,12 @@ object SwiftBundlingConfigurator {
 
         val baseName = lowerCamelCaseName("processSwiftSources", compilationPrefix, compilation.target.name)
 
-        val swiftSourceSet = createSwiftSourceSet(compilation)
+        val swiftSourceFiles = createSwiftSourceFiles(compilation)
 
         val isSwiftBundlingEnabledProperty = skieExtension.swiftBundling.enabled
 
         return registerSkieTask<ProcessSwiftSourcesTask>(baseName) {
-            inputs.files(swiftSourceSet)
+            inputs.files(swiftSourceFiles)
             output.set(compilation.skieCompilationDirectory.map { it.swift.bundled.directory })
 
             onlyIf {
@@ -52,20 +52,19 @@ object SwiftBundlingConfigurator {
         }
     }
 
-    private fun Project.createSwiftSourceSet(compilation: KotlinNativeCompilationShim): SourceDirectorySet {
-        val swiftSourceSetName = "${compilation.target.name}:${compilation.name} Swift sources"
+    private fun Project.createSwiftSourceFiles(compilation: KotlinNativeCompilationShim): FileCollection {
+        // A ConfigurableFileCollection populated with concrete directories is serializable by the
+        // Gradle configuration cache (it stores resolved paths, not the source set container or its
+        // actions). Using a SourceDirectorySet here instead captures a non-serializable
+        // DefaultSourceDirectorySet into the task graph and discards the configuration cache entry.
+        val swiftSourceFiles = objects.fileCollection()
 
-        val swiftSourceSet = objects.sourceDirectorySet(swiftSourceSetName, swiftSourceSetName).apply {
-            filter.include("**/*.swift")
+        compilation.allKotlinSourceSets.all {
+            swiftSourceFiles.from(layout.projectDirectory.dir(swiftSourceDirectory))
         }
 
-        compilation.allKotlinSourceSets.configureEach {
-            val swiftDirectory = project.layout.projectDirectory.dir(swiftSourceDirectory)
-
-            swiftSourceSet.srcDirs(swiftDirectory)
-        }
-
-        return swiftSourceSet
+        // Preserve the previous filter.include("**/*.swift") behavior for up-to-date checks.
+        return swiftSourceFiles.asFileTree.matching { include("**/*.swift") }
     }
 
     private fun KotlinNativeCompilationShim.configureCompileTask(processSwiftSourcesTaskProvider: Provider<ProcessSwiftSourcesTask>) {
```

**File**: `test-runner/src/test/kotlin/co/touchlab/skie/test/suite/gradle/configurationcache/GradleConfigurationCacheTests.kt` (modified, +89/-0)
```diff
@@ -13,7 +13,9 @@ import co.touchlab.skie.test.util.LinkMode
 import co.touchlab.skie.test.util.StringBuilderScope
 import org.gradle.testkit.runner.BuildResult
 import org.gradle.testkit.runner.TaskOutcome
+import org.gradle.testkit.runner.UnexpectedBuildFailure
 import kotlin.test.assertEquals
+import kotlin.test.assertFalse
 
 @Suppress("ClassName")
 @Smoke
@@ -134,6 +136,93 @@ class GradleConfigurationCacheTests: BaseGradleTests() {
         )
     }
 
+    // Regression test for the DefaultSourceDirectorySet serialization failure SKIE caused on the
+    // link-framework graph: SwiftBundlingConfigurator.createSwiftSourceSet() built a live
+    // SourceDirectorySet and let it reach the configuration cache, which cannot serialize it.
+    //
+    // The failure only surfaces when something puts SKIE's Kotlin-source-set container on a
+    // serialization path. In the wild that is a consumer build action that captures the
+    // KotlinNativeTarget (e.g. a doLast on the link task); a plain SKIE project never does, which is
+    // why the `assemble` cases above — and even an unmodified link build — don't reproduce it. We
+    // recreate that reachability here with a target-capturing doLast, then assert SKIE contributes no
+    // SourceDirectorySet problem of its own. Unrelated KGP problems (its own `actualResources`
+    // SourceDirectorySet and StoredPropertyStorage/ReferenceQueue) are expected to remain — they are
+    // dragged in by the same capture and are not SKIE's to fix — so the assertion keys on SKIE's own
+    // `createSwiftSourceSet` frame rather than the generic problem type.
+    @MatrixTest
+    fun `framework link does not put SKIE swift sources in the configuration cache`(
+        kotlinVersion: KotlinVersion,
+    ) {
+        rootBuildFile(kotlinVersion) {
+            kotlin {
+                targets(KotlinTarget.Native)
+
+                includeCoroutinesDependency()
+
+                registerNativeFrameworks(
+                    kotlinVersion = kotlinVersion,
+                    buildConfiguration = BuildConfiguration.Debug,
+                    linkMode = LinkMode.Dynamic,
+                )
+            }
+
+            // Capture the KotlinNativeTarget in a stored link-task action. This makes
+            // target.binaries -> SKIE's KGP shims -> the swift source set reachable from the
+            // configuration cache, reproducing the consumer condition under which the bug fired.
+            appendLines(
+                """
+                kotlin.targets.withType<org.jetbrains.kotlin.gradle.plugin.mpp.KotlinNativeTarget>().configureEach {
+                    val capturedTarget = this
+                    binaries.withType<org.jetbrains.kotlin.gradle.plugin.mpp.Framework>().configureEach {
+                        linkTaskProvider.get().doLast { println(capturedTarget.binaries.size) }
+                    }
+                }
+                """.trimIndent(),
+            )
+        }
+
+        // Templates.basic ships a bundled Swift source under src/commonMain/swift.
+        copyToCommonMain(Templates.basic)
+
+        // `--dry-run` keeps configuration (and the configuration cache store) but skips the native
+        // link. The build is EXPECTED to fail here regardless of SKIE: the unrelated KGP problem
+        // (ReferenceQueue in StoredPropertyStorage) is a hard serialization error that aborts the
+        // store even under `--configuration-cache-problems=warn`. That failure is orthogonal to the
+        // SKIE bug, so we tolerate it and assert on the configuration cache report, which Gradle
+        // writes either way.
+        val buildFailure = try {
+            runGradle(
+                arguments = arrayOf(
+                    ":linkDebugFrameworkIosArm64",
+                    "--dry-run",
+                    "--configuration-cache-problems=warn",
+                ),
+                assertResult = null,
+            )
+            null
+        } catch (failure: UnexpectedBuildFailure) {
+            failure
+        }
+
+        val report = testProjectDir.walkTopDown()
+            .firstOrNull { it.name == "configuration-cache-report.html" }
+            ?.readText()
+
+        if (report == null) {
+            // No report means no configuration cache problems at all. If the build nonetheless
+            // failed, it failed for some unrelated reason we should surface rather than swallow.
+            buildFailure?.let { throw it }
+            return
+        }
+
+        assertFalse(
+            report.contains("createSwiftSourceSet"),
+            "SKIE put its swift SourceDirectorySet on the configuration cache serialization path " +
+                "(SwiftBundlingConfigurator.createSwiftSourceSet). It must expose the swift sources as a " +
+                "serializable FileCollection instead.",
+        )
+    }
+
     override fun StringBuilderScope.appendAdditionalGradleProperties() {
         +"org.gradle.configuratio
```

---

### Incident Patch 2: `daced5dc` (2026-06-11)
**Commit Message**: Add regression test for external dependency reporting

**File**: `SKIE/acceptance-tests/framework/src/main/kotlin/co/touchlab/skie/acceptancetests/framework/internal/skie/TestSkiePhasesRegistrar.kt` (modified, +3/-0)
```diff
@@ -16,5 +16,8 @@ class TestSkiePhasesRegistrar : SkiePluginRegistrar {
             add(VerifyTestPhasesAreExecutedPhase)
             add(VerifyFrameworkHeaderPhase)
         }
+        initPhaseContext.skiePhaseScheduler.kirPhases.modify {
+            add(VerifyExternalDependenciesAreReportedPhase)
+        }
     }
 }
```

**File**: `SKIE/acceptance-tests/framework/src/main/kotlin/co/touchlab/skie/acceptancetests/framework/internal/skie/VerifyExternalDependenciesAreReportedPhase.kt` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+package co.touchlab.skie.acceptancetests.framework.internal.skie
+
+import co.touchlab.skie.phases.KirPhase
+import co.touchlab.skie.phases.descriptorProvider
+
+/**
+ * Regression guard for the Kotlin 2.4.0 external-dependency reporting fix.
+ *
+ * Kotlin 2.4.0 removed `UserVisibleIrModulesSupport`, and SKIE now reconstructs `descriptorProvider.externalDependencies`
+ * by deserializing the `-Xexternal-dependencies` file the Kotlin Gradle plugin forwards to the native link. None of the
+ * existing test harnesses pass that file, so this behavior was previously untested (the broken `emptySet()` stub passed
+ * the whole suite).
+ *
+ * When a compiled test module contains a class named [MARKER_CLASS_NAME], this phase asserts that the external
+ * dependencies were actually reported (the set is non-empty and contains [EXPECTED_MODULE]). With the broken stub the
+ * set is empty, so the [check] fails and crashes the compilation, turning the regression red. For every other test the
+ * marker class is absent and this phase is a no-op.
+ */
+object VerifyExternalDependenciesAreReportedPhase : KirPhase {
+
+    context(KirPhase.Context)
+    override suspend fun execute() {
+        val hasMarker = descriptorProvider.exposedClasses.any { it.name.asString() == MARKER_CLASS_NAME }
+        if (!hasMarker) {
+            return
+        }
+
+        val reported = descriptorProvider.externalDependencies
+
+        check(reported.isNotEmpty()) {
+            "External dependencies were not reported. `getExternalDependencies` should read the -Xexternal-dependencies " +
+                "file, but `descriptorProvider.externalDependencies` was empty."
+        }
+
+        val reportedNames = reported.flatMap { it.id.uniqueNames }
+        check(EXPECTED_MODULE in reportedNames) {
+            "Expected external dependency '$EXPECTED_MODULE' to be reported, but got: $reportedNames"
+        }
+    }
+
+    const val MARKER_CLASS_NAME: String = "VerifyExternalDependenciesAreReported"
+
+    const val EXPECTED_MODULE: String = "com.example:foo"
+}
```

**File**: `SKIE/acceptance-tests/framework/src/main/kotlin/co/touchlab/skie/acceptancetests/framework/internal/testrunner/phases/kotlin/CompilerArgumentsProvider.kt` (modified, +3/-0)
```diff
@@ -16,6 +16,7 @@ class CompilerArgumentsProvider(
     val buildConfiguration: BuildConfiguration = TestDefaults.buildConfiguration ?: BuildConfiguration.Debug,
     val target: Target = TestDefaults.target ?: Target.current,
     val optIn: List<String> = emptyList(),
+    val externalDependencies: String? = null,
 ) {
 
     fun compile(
@@ -75,6 +76,8 @@ class CompilerArgumentsProvider(
             libraries = dependencies.toTypedArray()
             exportedLibraries = exportedDependencies.toTypedArray()
 
+            externalDependencies = this@CompilerArgumentsProvider.externalDependencies
+
             target = this@CompilerArgumentsProvider.target.kotlinName
 
             overrideKonanProperties = (overrideKonanProperties ?: arrayOf()) + arrayOf(
```

**File**: `SKIE/acceptance-tests/libraries/src/test/kotlin/co/touchlab/skie/plugin/libraries/ExternalDependenciesReportingTest.kt` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+package co.touchlab.skie.plugin.libraries
+
+import co.touchlab.skie.acceptance_tests_framework.BuildConfig
+import co.touchlab.skie.acceptancetests.framework.TempFileSystem
+import co.touchlab.skie.acceptancetests.framework.internal.testrunner.IntermediateResult
+import co.touchlab.skie.acceptancetests.framework.internal.testrunner.TestLogger
+import co.touchlab.skie.acceptancetests.framework.internal.testrunner.phases.kotlin.CompilerArgumentsProvider
+import co.touchlab.skie.acceptancetests.framework.internal.testrunner.phases.kotlin.KotlinTestCompiler
+import co.touchlab.skie.acceptancetests.framework.internal.testrunner.phases.kotlin.KotlinTestLinker
+import co.touchlab.skie.configuration.provider.CompilerSkieConfigurationData
+import io.kotest.assertions.fail
+import io.kotest.core.spec.style.FunSpec
+import java.nio.file.Files
+import kotlin.io.path.absolutePathString
+import kotlin.io.path.writeText
+
+/**
+ * Regression test for external-dependency reporting after the Kotlin 2.4.0 `UserVisibleIrModulesSupport` removal.
+ *
+ * On 2.4.0 SKIE reconstructs `descriptorProvider.externalDependencies` by deserializing the `-Xexternal-dependencies`
+ * file the Kotlin Gradle plugin forwards to the native link. None of the existing harnesses pass that file, so the
+ * broken `getExternalDependencies() = emptySet()` stub silently passed the whole suite. This test supplies a real
+ * `-Xexternal-dependencies` file and relies on [co.touchlab.skie.acceptancetests.framework.internal.skie.VerifyExternalDependenciesAreReportedPhase]
+ * (active only when the compiled module contains the marker class below) to crash the SKIE compilation if the external
+ * dependencies are not reported.
+ *
+ * Pass: the SKIE link succeeds (external dependencies were reported). Fail (with the stub): the link errors.
+ */
+class ExternalDependenciesReportingTest : FunSpec({
+
+    System.setProperty("konan.home", BuildConfig.KONAN_HOME)
+
+    test("SKIE reports external dependencies from the -Xexternal-dependencies file") {
+        val tempFileSystem = TempFileSystem(Files.createTempDirectory("skie-external-dependencies-test"))
+        val testLogger = TestLogger()
+
+        // The marker class activates VerifyExternalDependenciesAreReportedPhase for this compilation only.
+        val sourceFile = tempFileSystem.createFile("VerifyExternalDependenciesAreReported.kt")
+        sourceFile.writeText(
+            """
+            class VerifyExternalDependenciesAreReported {
+                fun marker(): Int = 0
+            }
+            """.trimIndent(),
+        )
+
+        // A real -Xexternal-dependencies file in `ResolvedDependenciesSupport`'s format: one external module
+        // (`com.example:foo:1.2.3`) depending on the source code module (index 0).
+        val externalKlibPath = tempFileSystem.createFile("com.example.foo.klib").absolutePathString()
+        val externalDependenciesFile = tempFileSystem.createFile("external.deps")
+        externalDependenciesFile.writeText(
+            buildString {
+                appendLine("0 co.touchlab.skie:kotlin")
+                appendLine("1 com.example:foo[1.2.3] #0[1.2.3]")
+                appendLine("\t$externalKlibPath")
+            },
+        )
+
+        val compilerArgumentsProvider = CompilerArgumentsProvider(
+            externalDependencies = externalDependenciesFile.absolutePathString(),
+        )
+
+        val klib = when (val compileResult = KotlinTestCompiler(tempFileSystem, testLogger).compile(
+            kotlinFiles = listOf(sourceFile),
+            compilerArgumentsProvider = compilerArgumentsProvider,
+        )) {
+            is IntermediateResult.Value -> compileResult.value
+            is IntermediateResult.Error -> fail("Kotlin compilation failed: ${compileResult.testResult}")
+        }
+
+        val linkResult = KotlinTestLinker(tempFileSystem, testLogger).link(
+            klib = klib,
+            skieConfigurationData = CompilerSkieConfigurationData(
+                groups = listOf(
+                    CompilerSkieConfigurationData.Group(
+                        target = "",
+                        overridesAnnotations = false,
+                        items = mapOf("TestConfigurationKeys.EnableVerifyFrameworkHeaderPhase" to "false"),
+                    ),
+                ),
+            ),
+            compilerArgumentsProvider = compilerArgumentsProvider,
+        )
+
+        when (linkResult) {
+            is IntermediateResult.Value -> Unit
+            is IntermediateResult.Error -> fail(
+                "SKIE link failed — external dependencies were not reported (getExternalDependencies returned empty?). " +
+                    "Result: ${linkResult.testResult}",
+            )
+        }
+    }
+})
```

---

### Incident Patch 3: `f2b3b038` (2026-06-11)
**Commit Message**: Restore external dependency reporting and fix the value-parameter shim

**File**: `SKIE/kotlin-compiler/linker-plugin/src/2.4.0../kotlin/co/touchlab/skie/compat/IrCompat.kt` (modified, +10/-3)
```diff
@@ -19,17 +19,24 @@ internal typealias SkieIrAnnotation = org.jetbrains.kotlin.ir.expressions.IrAnno
  * Kotlin 2.4.0 removed the dedicated value-parameter/receiver/argument accessors from the IR tree in favor of a single
  * positional `parameters`/`arguments` list keyed by [IrParameterKind]. These shims preserve the pre-2.4.0 semantics so
  * the shared `main` source set stays version-agnostic.
+ *
+ * Pre-2.4.0 `IrFunction.valueParameters` returned both [IrParameterKind.Regular] and [IrParameterKind.Context]
+ * parameters (in that positional order, context first), so [isSkieValueParameter] matches that to stay faithful even
+ * for functions that carry context parameters.
  */
+private val IrValueParameter.isSkieValueParameter: Boolean
+    get() = kind == IrParameterKind.Regular || kind == IrParameterKind.Context
+
 internal val IrFunction.skieValueParameters: List<IrValueParameter>
-    get() = parameters.filter { it.kind == IrParameterKind.Regular }
+    get() = parameters.filter { it.isSkieValueParameter }
 
 internal val IrFunction.skieExtensionReceiverParameter: IrValueParameter?
     get() = parameters.firstOrNull { it.kind == IrParameterKind.ExtensionReceiver }
 
 internal fun IrFunctionAccessExpression.skiePutValueArgument(index: Int, valueArgument: IrExpression?) {
-    val regularParameters = symbol.owner.parameters.filter { it.kind == IrParameterKind.Regular }
+    val valueParameters = symbol.owner.parameters.filter { it.isSkieValueParameter }
 
-    arguments[regularParameters[index].indexInParameters] = valueArgument
+    arguments[valueParameters[index].indexInParameters] = valueArgument
 }
 
 internal fun IrFunctionAccessExpression.skiePutTypeArgument(index: Int, type: IrType?) {
```

**File**: `SKIE/kotlin-compiler/linker-plugin/src/2.4.0../kotlin/co/touchlab/skie/kir/descriptor/externalDependencies.kt` (modified, +25/-8)
```diff
@@ -1,16 +1,33 @@
+@file:Suppress("invisible_reference", "invisible_member")
+
 package co.touchlab.skie.kir.descriptor
 
 import co.touchlab.skie.compat.KonanConfig
+import org.jetbrains.kotlin.utils.ResolvedDependenciesSupport
 import org.jetbrains.kotlin.utils.ResolvedDependency
 
 /**
- * Kotlin 2.4.0 removed `UserVisibleIrModulesSupport`, which previously exposed the external (3rd-party) dependency
- * modules together with their coordinates and artifact paths. There is no replacement that maps resolved libraries back
- * to their dependency coordinates, so external dependencies can no longer be reported.
+ * Kotlin 2.4.0 removed `UserVisibleIrModulesSupport` (KT-84684, "[PL] Clean-up: Remove UserVisibleIrModulesSupport
+ * from IR linker"), which previously exposed the external (3rd-party) dependency modules together with their
+ * coordinates and artifact paths.
+ *
+ * The underlying data is still available though: the build system (Kotlin Gradle plugin) still serializes the resolved
+ * dependency graph into the file passed via `-Xexternal-dependencies` (stored on the compiler config as
+ * [KonanConfig.externalDependenciesFile]), and the `ResolvedDependenciesSupport.deserialize` API is still public.
  *
- * As a result, all non-built-in resolved libraries are treated as local modules (see
- * [NativeDescriptorProvider.localLibraries]) and the per-module analytics no longer distinguish external libraries.
+ * The removed `UserVisibleIrModulesSupport.externalDependencyModules` (the only thing SKIE read) was simply
+ * `deserialize(externalDependenciesFile).modules`, so we reproduce that here directly. The Kotlin/Native-specific
+ * enrichment in the removed class (manifest versions, platform-library compression) only affected the linkage-error
+ * display path (`getUserVisibleModules`), which SKIE never used.
  */
-@Suppress("UNUSED_PARAMETER")
-internal fun getExternalDependencies(konanConfig: KonanConfig): Set<ResolvedDependency> =
-    emptySet()
+internal fun getExternalDependencies(konanConfig: KonanConfig): Set<ResolvedDependency> {
+    val externalDependenciesFile = konanConfig.externalDependenciesFile ?: return emptySet()
+    if (!externalDependenciesFile.exists) return emptySet()
+
+    val externalDependenciesText = String(externalDependenciesFile.readBytes())
+
+    return ResolvedDependenciesSupport
+        .deserialize(externalDependenciesText) { _, _ -> }
+        .modules
+        .toSet()
+}
```

---

### Incident Patch 4: `5ecea28e` (2026-05-23)
**Commit Message**: Fix isolated-projects incompatibility from dynamic property lookup

Project.findProperty walks up to the parent project's properties, which
Gradle's Isolated Projects feature forbids. Switch to
providers.gradleProperty for the skie.kgpVersion override so the plugin
works when -Dorg.gradle.unsafe.isolated-projects=true is set.

Fixes #178

Co-Authored-By: Claude Opus 4.7 (1M context) <[REDACTED_EMAIL]>

**File**: `SKIE/skie-gradle/plugin-impl/src/main/kotlin/co/touchlab/skie/plugin/shim/SkieKotlinVariantResolver.kt` (modified, +1/-1)
```diff
@@ -100,7 +100,7 @@ object SkieKotlinVariantResolver {
     }
 
     private fun Project.findKotlinGradlePluginVersionFromOverrideProperty(): String? =
-        (findProperty("skie.kgpVersion") as? String)?.also {
+        providers.gradleProperty("skie.kgpVersion").orNull?.also {
             logger.debug("[SKIE] Found KGP version override: $it in project '${project.path}', skipping resolution.")
         }
 
```

---

### Incident Patch 5: `1a302e35` (2026-03-30)
**Commit Message**: Fix acceptance tests.

**File**: `SKIE/acceptance-tests/functional/src/test/resources/tests/bugs/generic_function_inherited_from_two_interfaces_is_duplicated_by_compiler/can_be_called.swift` (modified, +2/-2)
```diff
@@ -7,7 +7,7 @@ let i2: I2 = a
 var result = b.get(value: 6).int32Value
 result -= a.get(value: 3).int32Value
 
-result -= (i1.get(value: 2) as! KotlinInt).int32Value
-result -= (i2.get(value: 1) as! KotlinInt).int32Value
+result -= (i1.get(value: 2 as KotlinInt) as! KotlinInt).int32Value
+result -= (i2.get(value: 1 as KotlinInt) as! KotlinInt).int32Value
 
 exit(result)
```

**File**: `dev-support/build.gradle.kts` (modified, +2/-1)
```diff
@@ -3,7 +3,8 @@ plugins {
 //     kotlin("multiplatform") version "2.2.0" apply false
 //     kotlin("multiplatform") version "2.2.20" apply false
 //     kotlin("multiplatform") version "2.2.21" apply false
-    kotlin("multiplatform") version "2.3.0-RC" apply false
+//     kotlin("multiplatform") version "2.3.0-RC" apply false
+    kotlin("multiplatform") version "2.3.20" apply false
 }
 
 buildscript {
```

**File**: `dev-support/dev-support-build-setup/build.gradle.kts` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ plugins {
 }
 
 dependencies {
-    val kgpVersion = File("/Users/filip/Documents/work/Touchlab/projects/internal/SKIE/dev-support/build.gradle.kts")
+    val kgpVersion = rootDir.resolve("../build.gradle.kts")
         .readLines()
         .first { it.contains("kotlin(\"multiplatform\") version ") }
         .trim()
```

---

### Incident Patch 6: `c74739be` (2025-12-09)
**Commit Message**: Fix typo in Flows in SwiftUI docs

**File**: `SKIE/skie-gradle/plugin-api/src/main/kotlin/co/touchlab/skie/plugin/configuration/SkieFeatureConfiguration.kt` (modified, +1/-1)
```diff
@@ -158,7 +158,7 @@ abstract class SkieFeatureConfiguration @Inject constructor(objects: ObjectFacto
      *
      *     var body: some View {
      *         Text("Bound counter using Binding: \(boundCounter)")
-     *             .collect(flow: viewModel.counter, into: $counter)
+     *             .collect(flow: viewModel.counter, into: $boundCounter)
      *
      *         Text("Manually updated counter: \(manuallyUpdatedCounter)")
      *             .collect(flow: viewModel.counter) { latestValue in
```

---

### Incident Patch 7: `5aa2f807` (2025-11-19)
**Commit Message**: Fix acceptance tests in Kotlin 2.3.0.

**File**: `SKIE/acceptance-tests` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit ecedfe1ef97eb9dc157cd2093e3dd6b54e033215
+Subproject commit 0fb6e0f933ed087dd00aea8162169a7ab4d7bf7a
```

---

### Incident Patch 8: `8d81d897` (2025-11-13)
**Commit Message**: Fix lockfile for 2.2.20.

**File**: `SKIE/acceptance-tests` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 8a59592bb206bc7ad4981a1cce3f63fabb8317a4
+Subproject commit ecedfe1ef97eb9dc157cd2093e3dd6b54e033215
```

---

### Incident Patch 9: `35260f99` (2025-11-12)
**Commit Message**: Fix that Kotlin stdlib was included in Gradle plugin fat jar.

**File**: `SKIE/skie-gradle/plugin-shim-impl/gradle-plugin-shim-impl.gradle.kts` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@ skiePublishing {
 
 dependencies {
     // All dependencies should be `compileOnly` and instead brought in by `gradle-plugin-impl` to minimize the amount of runtime-loaded artifacts.
+    sharedCompileOnly(kotlin("stdlib"))
     sharedCompileOnly(projects.gradle.gradlePluginShimApi)
     sharedCompileOnly(projects.common.configuration.configurationDeclaration)
     sharedCompileOnly(projects.gradle.gradlePluginUtil)
```

**File**: `SKIE/skie-gradle/plugin/gradle-plugin.gradle.kts` (modified, +0/-2)
```diff
@@ -33,6 +33,4 @@ gradlePlugin {
 dependencies {
     api(projects.gradle.gradlePluginApi)
     implementation(projects.gradle.gradlePluginImpl)
-
-    compileOnly(kotlin("stdlib"))
 }
```

**File**: `build-setup/src/main/kotlin/co/touchlab/skie/buildsetup/gradle/plugins/gradle/GradlePluginPlugin.kt` (modified, +4/-2)
```diff
@@ -59,7 +59,9 @@ abstract class GradlePluginPlugin : Plugin<Project> {
             archiveClassifier.set("")
 
             dependencies {
-                exclude(dependency("org.jetbrains.kotlin:kotlin-stdlib.*"))
+                exclude {
+                    it.moduleGroup == "org.jetbrains.kotlin" && it.moduleName.startsWith("kotlin-stdlib")
+                }
             }
         }
 
@@ -77,7 +79,7 @@ abstract class GradlePluginPlugin : Plugin<Project> {
             val relocationTask = tasks.register<ShadowJar>("relocate-shim-$safeKotlinVersion") {
                 relocate("co.touchlab.skie.plugin.shim.impl", "co.touchlab.skie.plugin.shim.impl_$safeKotlinVersion")
                 configurations.set(listOf(shimConfiguration))
-                archiveClassifier.set(safeKotlinVersion)
+                archiveClassifier.set("shim-impl-$safeKotlinVersion")
             }
 
             tasks.named("compileKotlin").configure {
```

---

### Incident Patch 10: `576b4ebe` (2025-11-12)
**Commit Message**: Fix that smoke test workflow wasn't cancellable.

**File**: `.github/workflows/smoke-tests-2_2_20-github.yml` (modified, +6/-6)
```diff
@@ -8,9 +8,9 @@ on:
       suites:
         type: string
         required: false
-        default: 'acceptance,type-mapping,gradle,lib-0-499,lib-500-999,lib-1000-1499,lib-1500-1999,lib-2000-2499,lib-2500-2999,lib-3000-3499,lib-3500-3999,lib-4000-4499,lib-4500-4999,lib-5000-5499,lib-5500-5999,lib-6000-6499,lib-6500-6735'
+        default: 'acceptance,type-mapping,gradle,lib-0-499,lib-500-999,lib-1000-1499,lib-1500-1999,lib-2000-2499,lib-2500-2999,lib-3000-3499,lib-3500-3999,lib-4000-4499,lib-4500-4999,lib-5000-5499,lib-5500-5999,lib-6000-6499,lib-6500-6734'
         description: |
-          Comma-separated test suites to run. Available: acceptance, type-mapping, gradle, lib-0-499, lib-500-999, lib-1000-1499, lib-1500-1999, lib-2000-2499, lib-2500-2999, lib-3000-3499, lib-3500-3999, lib-4000-4499, lib-4500-4999, lib-5000-5499, lib-5500-5999, lib-6000-6499, lib-6500-6735
+          Comma-separated test suites to run. Available: acceptance, type-mapping, gradle, lib-0-499, lib-500-999, lib-1000-1499, lib-1500-1999, lib-2000-2499, lib-2500-2999, lib-3000-3499, lib-3500-3999, lib-4000-4499, lib-4500-4999, lib-5000-5499, lib-5500-5999, lib-6000-6499, lib-6500-6734
           Leave empty to run all. Use '!' prefix to exclude (e.g., '!lib-0-499').
       compiler_version:
         type: string
@@ -435,10 +435,10 @@ jobs:
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
           onlyIndices: "6000-6499"
   
-  external-libraries-tests-6500-6735:
-    name: External Libraries Tests (2.2.20[${{ inputs.compiler_version || '2.2.20' }}]) 6500-6735
+  external-libraries-tests-6500-6734:
+    name: External Libraries Tests (2.2.20[${{ inputs.compiler_version || '2.2.20' }}]) 6500-6734
     if: |
-      (!inputs.suites || (contains(inputs.suites, 'lib-6500-6735') && !contains(inputs.suites, '!lib-6500-6735')))
+      (!inputs.suites || (contains(inputs.suites, 'lib-6500-6734') && !contains(inputs.suites, '!lib-6500-6734')))
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -456,4 +456,4 @@ jobs:
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
-          onlyIndices: "6500-6735"
+          onlyIndices: "6500-6734"
```

**File**: `.github/workflows/smoke-tests-2_2_20-self-hosted.yml` (modified, +6/-6)
```diff
@@ -11,9 +11,9 @@ on:
       suites:
         type: string
         required: false
-        default: 'acceptance,type-mapping,gradle,lib-0-499,lib-500-999,lib-1000-1499,lib-1500-1999,lib-2000-2499,lib-2500-2999,lib-3000-3499,lib-3500-3999,lib-4000-4499,lib-4500-4999,lib-5000-5499,lib-5500-5999,lib-6000-6499,lib-6500-6735'
+        default: 'acceptance,type-mapping,gradle,lib-0-499,lib-500-999,lib-1000-1499,lib-1500-1999,lib-2000-2499,lib-2500-2999,lib-3000-3499,lib-3500-3999,lib-4000-4499,lib-4500-4999,lib-5000-5499,lib-5500-5999,lib-6000-6499,lib-6500-6734'
         description: |
-          Comma-separated test suites to run. Available: acceptance, type-mapping, gradle, lib-0-499, lib-500-999, lib-1000-1499, lib-1500-1999, lib-2000-2499, lib-2500-2999, lib-3000-3499, lib-3500-3999, lib-4000-4499, lib-4500-4999, lib-5000-5499, lib-5500-5999, lib-6000-6499, lib-6500-6735
+          Comma-separated test suites to run. Available: acceptance, type-mapping, gradle, lib-0-499, lib-500-999, lib-1000-1499, lib-1500-1999, lib-2000-2499, lib-2500-2999, lib-3000-3499, lib-3500-3999, lib-4000-4499, lib-4500-4999, lib-5000-5499, lib-5500-5999, lib-6000-6499, lib-6500-6734
           Leave empty to run all. Use '!' prefix to exclude (e.g., '!lib-0-499').
       compiler_version:
         type: string
@@ -438,10 +438,10 @@ jobs:
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
           onlyIndices: "6000-6499"
   
-  external-libraries-tests-6500-6735:
-    name: External Libraries Tests (2.2.20[${{ inputs.compiler_version || '2.2.20' }}]) 6500-6735
+  external-libraries-tests-6500-6734:
+    name: External Libraries Tests (2.2.20[${{ inputs.compiler_version || '2.2.20' }}]) 6500-6734
     if: |
-      (!inputs.suites || (contains(inputs.suites, 'lib-6500-6735') && !contains(inputs.suites, '!lib-6500-6735')))
+      (!inputs.suites || (contains(inputs.suites, 'lib-6500-6734') && !contains(inputs.suites, '!lib-6500-6734')))
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -459,4 +459,4 @@ jobs:
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
-          onlyIndices: "6500-6735"
+          onlyIndices: "6500-6734"
```

**File**: `.github/workflows/smoke-tests-manual.yml` (modified, +22/-22)
```diff
@@ -8,9 +8,9 @@ on:
       suites:
         type: string
         required: false
-        default: 'acceptance,type-mapping,gradle,lib-0-499,lib-500-999,lib-1000-1499,lib-1500-1999,lib-2000-2499,lib-2500-2999,lib-3000-3499,lib-3500-3999,lib-4000-4499,lib-4500-4999,lib-5000-5499,lib-5500-5999,lib-6000-6499,lib-6500-6735'
+        default: 'acceptance,type-mapping,gradle,lib-0-499,lib-500-999,lib-1000-1499,lib-1500-1999,lib-2000-2499,lib-2500-2999,lib-3000-3499,lib-3500-3999,lib-4000-4499,lib-4500-4999,lib-5000-5499,lib-5500-5999,lib-6000-6499,lib-6500-6734'
         description: |
-          Comma-separated test suites to run. Available: acceptance, type-mapping, gradle, lib-0-499, lib-500-999, lib-1000-1499, lib-1500-1999, lib-2000-2499, lib-2500-2999, lib-3000-3499, lib-3500-3999, lib-4000-4499, lib-4500-4999, lib-5000-5499, lib-5500-5999, lib-6000-6499, lib-6500-6735
+          Comma-separated test suites to run. Available: acceptance, type-mapping, gradle, lib-0-499, lib-500-999, lib-1000-1499, lib-1500-1999, lib-2000-2499, lib-2500-2999, lib-3000-3499, lib-3500-3999, lib-4000-4499, lib-4500-4999, lib-5000-5499, lib-5500-5999, lib-6000-6499, lib-6500-6734
           Leave empty to run all. Use '!' prefix to exclude (e.g., '!lib-0-499').
       kotlin_version_name:
         type: string
@@ -97,7 +97,7 @@ jobs:
     runs-on: self-hosted
     needs: [acceptance-tests]
     if: |
-      always() &&
+      !cancelled() &&
       (!inputs.suites || (contains(inputs.suites, 'gradle') && !contains(inputs.suites, '!gradle')))
     steps:
       - name: Checkout Repo
@@ -135,7 +135,7 @@ jobs:
     runs-on: self-hosted
     needs: [gradle-tests]
     if: |
-      always() &&
+      !cancelled() &&
       (!inputs.suites || (contains(inputs.suites, 'type-mapping') && !contains(inputs.suites, '!type-mapping')))
     steps:
       - name: Checkout Repo
@@ -168,7 +168,7 @@ jobs:
     name: External Libraries Tests (${{ inputs.kotlin_version_name && (inputs.compiler_version && format('{0}[{1}]', inputs.kotlin_version_name, inputs.compiler_version) || inputs.kotlin_version_name) || '2.2.20' }}) 0-499
     needs: [type-mapping-tests]
     if: |
-      always() &&
+      !cancelled() &&
       (!inputs.suites || (contains(inputs.suites, 'lib-0-499') && !contains(inputs.suites, '!lib-0-499')))
     runs-on: self-hosted
     steps:
@@ -201,7 +201,7 @@ jobs:
     name: External Libraries Tests (${{ inputs.kotlin_version_name && (inputs.compiler_version && format('{0}[{1}]', inputs.kotlin_version_name, inputs.compiler_version) || inputs.kotlin_version_name) || '2.2.20' }}) 500-999
     needs: [type-mapping-tests]
     if: |
-      always() &&
+      !cancelled() &&
       (!inputs.suites || (contains(inputs.suites, 'lib-500-999') && !contains(inputs.suites, '!lib-500-999')))
     runs-on: self-hosted
     steps:
@@ -234,7 +234,7 @@ jobs:
     name: External Libraries Tests (${{ inputs.kotlin_version_name && (inputs.compiler_version && format('{0}[{1}]', inputs.kotlin_version_name, inputs.compiler_version) || inputs.kotlin_version_name) || '2.2.20' }}) 1000-1499
     needs: [type-mapping-tests]
     if: |
-      always() &&
+      !cancelled() &&
       (!inputs.suites || (contains(inputs.suites, 'lib-1000-1499') && !contains(inputs.suites, '!lib-1000-1499')))
     runs-on: self-hosted
     steps:
@@ -267,7 +267,7 @@ jobs:
     name: External Libraries Tests (${{ inputs.kotlin_version_name && (inputs.compiler_version && format('{0}[{1}]', inputs.kotlin_version_name, inputs.compiler_version) || inputs.kotlin_version_name) || '2.2.20' }}) 1500-1999
     needs: [type-mapping-tests]
     if: |
-      always() &&
+      !cancelled() &&
       (!inputs.suites || (contains(inputs.suites, 'lib-1500-1999') && !contains(inputs.suites, '!lib-1500-1999')))
     runs-on: self-hosted
     steps:
@@ -300,7 +300,7 @@ jobs:
     name: External Libraries Tests (${{ inputs.kotlin_version_name && (inputs.compiler_version && format('{0}[{1}]', inputs.kotlin_version_name, inputs.compiler_version) || inputs.kotlin_version_name) || '2.2.20' }}) 2000-2499
     needs: [type-mapping-tests]
     if: |
-      always() &&
+      !cancelled() &&
       (!inputs.suites || (contains(inputs.suites, 'lib-2000-2499') && !contains(inputs.suites, '!lib-2000-2499')))
     runs-on: self-hosted
     steps:
@@ -333,7 +333,7 @@ jobs:
     name: External Libraries Tests (${{ inputs.kotlin_version_name && (inputs.compiler_version && format('{0}[{1}]', inputs.kotlin_version_name, inputs.compiler_version) || inputs.kotlin_version_name) || '2.2.20' }}) 2500-2999
     needs: [type-mapping-tests]
     if: |
-      always() &&
+      !cancelled() &&
       (!inputs.suites || (contains(inputs.suites, 'lib-2500-2999') && !contains(inputs.suites, '!lib-2500-2999')))
     runs-on: self-hosted
     steps:
@@ -366,7 +366,7 @@ jobs:
     name: External Libraries Tests (${{ inputs.kotlin_version_name && (inputs.compiler_version && format('{0}[{1}]', inputs.kotlin_version_name, inputs.
```

**File**: `.github/workflows/smoke-tests.yml` (modified, +20/-20)
```diff
@@ -53,7 +53,7 @@ jobs:
     runs-on: self-hosted
     needs: [acceptance-tests]
     if: |
-      always() &&
+      !cancelled() &&
       (!inputs.suites || (contains(inputs.suites, 'gradle') && !contains(inputs.suites, '!gradle')))
     steps:
       - name: Checkout Repo
@@ -91,7 +91,7 @@ jobs:
     runs-on: self-hosted
     needs: [gradle-tests]
     if: |
-      always() &&
+      !cancelled() &&
       (!inputs.suites || (contains(inputs.suites, 'type-mapping') && !contains(inputs.suites, '!type-mapping')))
     steps:
       - name: Checkout Repo
@@ -124,7 +124,7 @@ jobs:
     name: External Libraries Tests (2.2.20) 0-499
     needs: [type-mapping-tests]
     if: |
-      always() &&
+      !cancelled() &&
       (!inputs.suites || (contains(inputs.suites, 'lib-0-499') && !contains(inputs.suites, '!lib-0-499')))
     runs-on: self-hosted
     steps:
@@ -157,7 +157,7 @@ jobs:
     name: External Libraries Tests (2.2.20) 500-999
     needs: [type-mapping-tests]
     if: |
-      always() &&
+      !cancelled() &&
       (!inputs.suites || (contains(inputs.suites, 'lib-500-999') && !contains(inputs.suites, '!lib-500-999')))
     runs-on: self-hosted
     steps:
@@ -190,7 +190,7 @@ jobs:
     name: External Libraries Tests (2.2.20) 1000-1499
     needs: [type-mapping-tests]
     if: |
-      always() &&
+      !cancelled() &&
       (!inputs.suites || (contains(inputs.suites, 'lib-1000-1499') && !contains(inputs.suites, '!lib-1000-1499')))
     runs-on: self-hosted
     steps:
@@ -223,7 +223,7 @@ jobs:
     name: External Libraries Tests (2.2.20) 1500-1999
     needs: [type-mapping-tests]
     if: |
-      always() &&
+      !cancelled() &&
       (!inputs.suites || (contains(inputs.suites, 'lib-1500-1999') && !contains(inputs.suites, '!lib-1500-1999')))
     runs-on: self-hosted
     steps:
@@ -256,7 +256,7 @@ jobs:
     name: External Libraries Tests (2.2.20) 2000-2499
     needs: [type-mapping-tests]
     if: |
-      always() &&
+      !cancelled() &&
       (!inputs.suites || (contains(inputs.suites, 'lib-2000-2499') && !contains(inputs.suites, '!lib-2000-2499')))
     runs-on: self-hosted
     steps:
@@ -289,7 +289,7 @@ jobs:
     name: External Libraries Tests (2.2.20) 2500-2999
     needs: [type-mapping-tests]
     if: |
-      always() &&
+      !cancelled() &&
       (!inputs.suites || (contains(inputs.suites, 'lib-2500-2999') && !contains(inputs.suites, '!lib-2500-2999')))
     runs-on: self-hosted
     steps:
@@ -322,7 +322,7 @@ jobs:
     name: External Libraries Tests (2.2.20) 3000-3499
     needs: [type-mapping-tests]
     if: |
-      always() &&
+      !cancelled() &&
       (!inputs.suites || (contains(inputs.suites, 'lib-3000-3499') && !contains(inputs.suites, '!lib-3000-3499')))
     runs-on: self-hosted
     steps:
@@ -355,7 +355,7 @@ jobs:
     name: External Libraries Tests (2.2.20) 3500-3999
     needs: [type-mapping-tests]
     if: |
-      always() &&
+      !cancelled() &&
       (!inputs.suites || (contains(inputs.suites, 'lib-3500-3999') && !contains(inputs.suites, '!lib-3500-3999')))
     runs-on: self-hosted
     steps:
@@ -388,7 +388,7 @@ jobs:
     name: External Libraries Tests (2.2.20) 4000-4499
     needs: [type-mapping-tests]
     if: |
-      always() &&
+      !cancelled() &&
       (!inputs.suites || (contains(inputs.suites, 'lib-4000-4499') && !contains(inputs.suites, '!lib-4000-4499')))
     runs-on: self-hosted
     steps:
@@ -421,7 +421,7 @@ jobs:
     name: External Libraries Tests (2.2.20) 4500-4999
     needs: [type-mapping-tests]
     if: |
-      always() &&
+      !cancelled() &&
       (!inputs.suites || (contains(inputs.suites, 'lib-4500-4999') && !contains(inputs.suites, '!lib-4500-4999')))
     runs-on: self-hosted
     steps:
@@ -454,7 +454,7 @@ jobs:
     name: External Libraries Tests (2.2.20) 5000-5499
     needs: [type-mapping-tests]
     if: |
-      always() &&
+      !cancelled() &&
       (!inputs.suites || (contains(inputs.suites, 'lib-5000-5499') && !contains(inputs.suites, '!lib-5000-5499')))
     runs-on: self-hosted
     steps:
@@ -487,7 +487,7 @@ jobs:
     name: External Libraries Tests (2.2.20) 5500-5999
     needs: [type-mapping-tests]
     if: |
-      always() &&
+      !cancelled() &&
       (!inputs.suites || (contains(inputs.suites, 'lib-5500-5999') && !contains(inputs.suites, '!lib-5500-5999')))
     runs-on: self-hosted
     steps:
@@ -520,7 +520,7 @@ jobs:
     name: External Libraries Tests (2.2.20) 6000-6499
     needs: [type-mapping-tests]
     if: |
-      always() &&
+      !cancelled() &&
       (!inputs.suites || (contains(inputs.suites, 'lib-6000-6499') && !contains(inputs.suites, '!lib-6000-6499')))
     runs-on: self-hosted
     steps:
@@ -549,12 +549,12 @@ jobs:
       #     report_paths: 'SKIE/acceptance-tests/build/test-results/libraries__*/TEST-*.xml'
       #     require_tests: true
   
-  external-libraries-tests-6500-6735:
-    name: External Libraries Tests (2.2.20) 6500-6735
+  external-libraries-tests-65
```

**File**: `build-setup/src/main/kotlin/co/touchlab/skie/buildsetup/main/tasks/GeneratePrimarySmokeTestsCIActionTask.kt` (modified, +3/-3)
```diff
@@ -192,7 +192,7 @@ abstract class GeneratePrimarySmokeTestsCIActionTask : DefaultTask() {
             runs-on: self-hosted
             needs: [acceptance-tests]
             if: |
-              always() &&
+              !cancelled() &&
               (!inputs.suites || (contains(inputs.suites, 'gradle') && !contains(inputs.suites, '!gradle')))
             steps:
               - name: Checkout Repo
@@ -230,7 +230,7 @@ abstract class GeneratePrimarySmokeTestsCIActionTask : DefaultTask() {
             runs-on: self-hosted
             needs: [gradle-tests]
             if: |
-              always() &&
+              !cancelled() &&
               (!inputs.suites || (contains(inputs.suites, 'type-mapping') && !contains(inputs.suites, '!type-mapping')))
             steps:
               - name: Checkout Repo
@@ -273,7 +273,7 @@ abstract class GeneratePrimarySmokeTestsCIActionTask : DefaultTask() {
             name: External Libraries Tests ($$versionName) $${testBatch.range}
             needs: [type-mapping-tests]
             if: |
-              always() &&
+              !cancelled() &&
               (!inputs.suites || (contains(inputs.suites, 'lib-$${testBatch.range}') && !contains(inputs.suites, '!lib-$${testBatch.range}')))
             runs-on: self-hosted
             steps:
```

---

### Incident Patch 11: `ba363fda` (2025-11-11)
**Commit Message**: Fix that library modules weren't compared in a case insensitive way.

**File**: `SKIE/acceptance-tests` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 9bbe504a8391777c824aea9540aa437361ef615d
+Subproject commit 9e9fab553c69c1da14a9e4a5cd06fa6d3c394306
```

---

### Incident Patch 12: `9e877f27` (2025-11-11)
**Commit Message**: Workaround a 10 input limit of Github CI.

**File**: `.github/workflows/smoke-tests-2_0_0-github.yml` (modified, +15/-53)
```diff
@@ -2,54 +2,16 @@ name: Smoke Tests 2.0.0 [github-hosted]
 
 # Do not edit - generated by `generateCIActions` Gradle task.
 
-on:  
+on:
   workflow_dispatch:
     inputs:
-      invert_selection:
-        type: boolean
-        required: false
-        default: false
-        description: '🔄 INVERT SELECTION: When enabled, UNCHECKED boxes will run and CHECKED boxes will be skipped'
-      run_acceptance_tests:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run Acceptance Tests'
-      run_type_mapping_tests:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run Type Mapping Tests'
-      run_gradle_tests:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run Gradle Tests'
-      run_external_libraries_tests_0_499:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 0-499'
-      run_external_libraries_tests_500_999:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 500-999'
-      run_external_libraries_tests_1000_1499:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 1000-1499'
-      run_external_libraries_tests_1500_1999:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 1500-1999'
-      run_external_libraries_tests_2000_2420:
-        type: boolean
+      suites:
+        type: string
         required: false
-        default: true
-        description: 'Run External Libraries Tests 2000-2420'
+        default: 'acceptance,type-mapping,gradle,lib-0-499,lib-500-999,lib-1000-1499,lib-1500-1999,lib-2000-2420'
+        description: |
+          Comma-separated test suites to run. Available: acceptance, type-mapping, gradle, lib-0-499, lib-500-999, lib-1000-1499, lib-1500-1999, lib-2000-2420
+          Leave empty to run all. Use '!' prefix to exclude (e.g., '!lib-0-499').
       compiler_version:
         type: string
         required: true
@@ -95,7 +57,7 @@ jobs:
   acceptance-tests:
     name: Acceptance Tests 2.0.0[${{ inputs.compiler_version || '2.0.0' }}]
     if: |-
-      ((inputs.invert_selection || false) != (inputs.run_acceptance_tests || true))
+      (!inputs.suites || (contains(inputs.suites, 'acceptance') && !contains(inputs.suites, '!acceptance')))
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -117,7 +79,7 @@ jobs:
   gradle-tests:
     name: Gradle Tests 2.0.0[${{ inputs.compiler_version || '2.0.0' }}]
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_gradle_tests || true))
+      (!inputs.suites || (contains(inputs.suites, 'gradle') && !contains(inputs.suites, '!gradle')))
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -153,7 +115,7 @@ jobs:
   type-mapping-tests:
     name: Type Mapping Tests 2.0.0[${{ inputs.compiler_version || '2.0.0' }}]
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_type_mapping_tests || true))
+      (!inputs.suites || (contains(inputs.suites, 'type-mapping') && !contains(inputs.suites, '!type-mapping')))
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -177,7 +139,7 @@ jobs:
   external-libraries-tests-0-499:
     name: External Libraries Tests (2.0.0[${{ inputs.compiler_version || '2.0.0' }}]) 0-499
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_external_libraries_tests_0_499 || true))
+      (!inputs.suites || (contains(inputs.suites, 'lib-0-499') && !contains(inputs.suites, '!lib-0-499')))
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -200,7 +162,7 @@ jobs:
   external-libraries-tests-500-999:
     name: External Libraries Tests (2.0.0[${{ inputs.compiler_version || '2.0.0' }}]) 500-999
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_external_libraries_tests_500_999 || true))
+      (!inputs.suites || (contains(inputs.suites, 'lib-500-999') && !contains(inputs.suites, '!lib-500-999')))
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -223,7 +185,7 @@ jobs:
   external-libraries-tests-1000-1499:
     name: External Libraries Tests (2.0.0[${{ inputs.compiler_version || '2.0.0' }}]) 1000-1499
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_external_libraries_tests_1000_1499 || true))
+      (!inputs.suites || (contains(inputs.suites, 'lib-1000-1499') && !contains(inputs.suites, '!lib-1000-1499')))
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -246,7 +208,7 @@ jobs:
   external-libraries-tests-1500-1999:
     name: External Libraries Tests (2.0.0[${{ inputs.compiler_version || '2.0.0' }}]) 1500-1999
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_external_libraries_tests_1500_1999 || true))
+      (!inputs
```

**File**: `.github/workflows/smoke-tests-2_0_0-self-hosted.yml` (modified, +15/-53)
```diff
@@ -5,54 +5,16 @@ name: Smoke Tests 2.0.0 [self-hosted]
 on:  
   schedule:
     # Every Saturday at 12am EST
-    - cron: '0 5 * * SAT'  
+    - cron: '0 5 * * SAT'
   workflow_dispatch:
     inputs:
-      invert_selection:
-        type: boolean
-        required: false
-        default: false
-        description: '🔄 INVERT SELECTION: When enabled, UNCHECKED boxes will run and CHECKED boxes will be skipped'
-      run_acceptance_tests:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run Acceptance Tests'
-      run_type_mapping_tests:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run Type Mapping Tests'
-      run_gradle_tests:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run Gradle Tests'
-      run_external_libraries_tests_0_499:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 0-499'
-      run_external_libraries_tests_500_999:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 500-999'
-      run_external_libraries_tests_1000_1499:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 1000-1499'
-      run_external_libraries_tests_1500_1999:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 1500-1999'
-      run_external_libraries_tests_2000_2420:
-        type: boolean
+      suites:
+        type: string
         required: false
-        default: true
-        description: 'Run External Libraries Tests 2000-2420'
+        default: 'acceptance,type-mapping,gradle,lib-0-499,lib-500-999,lib-1000-1499,lib-1500-1999,lib-2000-2420'
+        description: |
+          Comma-separated test suites to run. Available: acceptance, type-mapping, gradle, lib-0-499, lib-500-999, lib-1000-1499, lib-1500-1999, lib-2000-2420
+          Leave empty to run all. Use '!' prefix to exclude (e.g., '!lib-0-499').
       compiler_version:
         type: string
         required: true
@@ -98,7 +60,7 @@ jobs:
   acceptance-tests:
     name: Acceptance Tests 2.0.0[${{ inputs.compiler_version || '2.0.0' }}]
     if: |-
-      ((inputs.invert_selection || false) != (inputs.run_acceptance_tests || true))
+      (!inputs.suites || (contains(inputs.suites, 'acceptance') && !contains(inputs.suites, '!acceptance')))
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -120,7 +82,7 @@ jobs:
   gradle-tests:
     name: Gradle Tests 2.0.0[${{ inputs.compiler_version || '2.0.0' }}]
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_gradle_tests || true))
+      (!inputs.suites || (contains(inputs.suites, 'gradle') && !contains(inputs.suites, '!gradle')))
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -156,7 +118,7 @@ jobs:
   type-mapping-tests:
     name: Type Mapping Tests 2.0.0[${{ inputs.compiler_version || '2.0.0' }}]
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_type_mapping_tests || true))
+      (!inputs.suites || (contains(inputs.suites, 'type-mapping') && !contains(inputs.suites, '!type-mapping')))
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -180,7 +142,7 @@ jobs:
   external-libraries-tests-0-499:
     name: External Libraries Tests (2.0.0[${{ inputs.compiler_version || '2.0.0' }}]) 0-499
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_external_libraries_tests_0_499 || true))
+      (!inputs.suites || (contains(inputs.suites, 'lib-0-499') && !contains(inputs.suites, '!lib-0-499')))
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -203,7 +165,7 @@ jobs:
   external-libraries-tests-500-999:
     name: External Libraries Tests (2.0.0[${{ inputs.compiler_version || '2.0.0' }}]) 500-999
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_external_libraries_tests_500_999 || true))
+      (!inputs.suites || (contains(inputs.suites, 'lib-500-999') && !contains(inputs.suites, '!lib-500-999')))
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -226,7 +188,7 @@ jobs:
   external-libraries-tests-1000-1499:
     name: External Libraries Tests (2.0.0[${{ inputs.compiler_version || '2.0.0' }}]) 1000-1499
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_external_libraries_tests_1000_1499 || true))
+      (!inputs.suites || (contains(inputs.suites, 'lib-1000-1499') && !contains(inputs.suites, '!lib-1000-1499')))
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -249,7 +211,7 @@ jobs:
   external-libraries-tests-1500-1999:
     name: External Libraries Tests (2.0.0[${{ inputs.compiler_version || '2.0.0' }}]) 1500-1999
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_external_libr
```

**File**: `.github/workflows/smoke-tests-2_0_20-github.yml` (modified, +17/-65)
```diff
@@ -2,64 +2,16 @@ name: Smoke Tests 2.0.20 [github-hosted]
 
 # Do not edit - generated by `generateCIActions` Gradle task.
 
-on:  
+on:
   workflow_dispatch:
     inputs:
-      invert_selection:
-        type: boolean
-        required: false
-        default: false
-        description: '🔄 INVERT SELECTION: When enabled, UNCHECKED boxes will run and CHECKED boxes will be skipped'
-      run_acceptance_tests:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run Acceptance Tests'
-      run_type_mapping_tests:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run Type Mapping Tests'
-      run_gradle_tests:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run Gradle Tests'
-      run_external_libraries_tests_0_499:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 0-499'
-      run_external_libraries_tests_500_999:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 500-999'
-      run_external_libraries_tests_1000_1499:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 1000-1499'
-      run_external_libraries_tests_1500_1999:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 1500-1999'
-      run_external_libraries_tests_2000_2499:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 2000-2499'
-      run_external_libraries_tests_2500_2999:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 2500-2999'
-      run_external_libraries_tests_3000_3188:
-        type: boolean
+      suites:
+        type: string
         required: false
-        default: true
-        description: 'Run External Libraries Tests 3000-3188'
+        default: 'acceptance,type-mapping,gradle,lib-0-499,lib-500-999,lib-1000-1499,lib-1500-1999,lib-2000-2499,lib-2500-2999,lib-3000-3188'
+        description: |
+          Comma-separated test suites to run. Available: acceptance, type-mapping, gradle, lib-0-499, lib-500-999, lib-1000-1499, lib-1500-1999, lib-2000-2499, lib-2500-2999, lib-3000-3188
+          Leave empty to run all. Use '!' prefix to exclude (e.g., '!lib-0-499').
       compiler_version:
         type: string
         required: true
@@ -105,7 +57,7 @@ jobs:
   acceptance-tests:
     name: Acceptance Tests 2.0.20[${{ inputs.compiler_version || '2.0.20' }}]
     if: |-
-      ((inputs.invert_selection || false) != (inputs.run_acceptance_tests || true))
+      (!inputs.suites || (contains(inputs.suites, 'acceptance') && !contains(inputs.suites, '!acceptance')))
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -127,7 +79,7 @@ jobs:
   gradle-tests:
     name: Gradle Tests 2.0.20[${{ inputs.compiler_version || '2.0.20' }}]
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_gradle_tests || true))
+      (!inputs.suites || (contains(inputs.suites, 'gradle') && !contains(inputs.suites, '!gradle')))
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -163,7 +115,7 @@ jobs:
   type-mapping-tests:
     name: Type Mapping Tests 2.0.20[${{ inputs.compiler_version || '2.0.20' }}]
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_type_mapping_tests || true))
+      (!inputs.suites || (contains(inputs.suites, 'type-mapping') && !contains(inputs.suites, '!type-mapping')))
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -187,7 +139,7 @@ jobs:
   external-libraries-tests-0-499:
     name: External Libraries Tests (2.0.20[${{ inputs.compiler_version || '2.0.20' }}]) 0-499
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_external_libraries_tests_0_499 || true))
+      (!inputs.suites || (contains(inputs.suites, 'lib-0-499') && !contains(inputs.suites, '!lib-0-499')))
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -210,7 +162,7 @@ jobs:
   external-libraries-tests-500-999:
     name: External Libraries Tests (2.0.20[${{ inputs.compiler_version || '2.0.20' }}]) 500-999
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_external_libraries_tests_500_999 || true))
+      (!inputs.suites || (contains(inputs.suites, 'lib-500-999') && !contains(inputs.suites, '!lib-500-999')))
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -233,7 +185,7 @@ jobs:
   external-libraries-tests-1000-1499:
     name: External Libraries Tests (2.0.20[${{ inputs.compiler_version || '2.0.20' }}]) 1000-1499
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_external_libraries_tests_1000_1499 || true))
+      (!inputs.suites || (contains(i
```

**File**: `.github/workflows/smoke-tests-2_0_20-self-hosted.yml` (modified, +17/-65)
```diff
@@ -5,64 +5,16 @@ name: Smoke Tests 2.0.20 [self-hosted]
 on:  
   schedule:
     # Every Saturday at 12am EST
-    - cron: '0 5 * * SAT'  
+    - cron: '0 5 * * SAT'
   workflow_dispatch:
     inputs:
-      invert_selection:
-        type: boolean
-        required: false
-        default: false
-        description: '🔄 INVERT SELECTION: When enabled, UNCHECKED boxes will run and CHECKED boxes will be skipped'
-      run_acceptance_tests:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run Acceptance Tests'
-      run_type_mapping_tests:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run Type Mapping Tests'
-      run_gradle_tests:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run Gradle Tests'
-      run_external_libraries_tests_0_499:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 0-499'
-      run_external_libraries_tests_500_999:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 500-999'
-      run_external_libraries_tests_1000_1499:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 1000-1499'
-      run_external_libraries_tests_1500_1999:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 1500-1999'
-      run_external_libraries_tests_2000_2499:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 2000-2499'
-      run_external_libraries_tests_2500_2999:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 2500-2999'
-      run_external_libraries_tests_3000_3188:
-        type: boolean
+      suites:
+        type: string
         required: false
-        default: true
-        description: 'Run External Libraries Tests 3000-3188'
+        default: 'acceptance,type-mapping,gradle,lib-0-499,lib-500-999,lib-1000-1499,lib-1500-1999,lib-2000-2499,lib-2500-2999,lib-3000-3188'
+        description: |
+          Comma-separated test suites to run. Available: acceptance, type-mapping, gradle, lib-0-499, lib-500-999, lib-1000-1499, lib-1500-1999, lib-2000-2499, lib-2500-2999, lib-3000-3188
+          Leave empty to run all. Use '!' prefix to exclude (e.g., '!lib-0-499').
       compiler_version:
         type: string
         required: true
@@ -108,7 +60,7 @@ jobs:
   acceptance-tests:
     name: Acceptance Tests 2.0.20[${{ inputs.compiler_version || '2.0.20' }}]
     if: |-
-      ((inputs.invert_selection || false) != (inputs.run_acceptance_tests || true))
+      (!inputs.suites || (contains(inputs.suites, 'acceptance') && !contains(inputs.suites, '!acceptance')))
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -130,7 +82,7 @@ jobs:
   gradle-tests:
     name: Gradle Tests 2.0.20[${{ inputs.compiler_version || '2.0.20' }}]
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_gradle_tests || true))
+      (!inputs.suites || (contains(inputs.suites, 'gradle') && !contains(inputs.suites, '!gradle')))
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -166,7 +118,7 @@ jobs:
   type-mapping-tests:
     name: Type Mapping Tests 2.0.20[${{ inputs.compiler_version || '2.0.20' }}]
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_type_mapping_tests || true))
+      (!inputs.suites || (contains(inputs.suites, 'type-mapping') && !contains(inputs.suites, '!type-mapping')))
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -190,7 +142,7 @@ jobs:
   external-libraries-tests-0-499:
     name: External Libraries Tests (2.0.20[${{ inputs.compiler_version || '2.0.20' }}]) 0-499
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_external_libraries_tests_0_499 || true))
+      (!inputs.suites || (contains(inputs.suites, 'lib-0-499') && !contains(inputs.suites, '!lib-0-499')))
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -213,7 +165,7 @@ jobs:
   external-libraries-tests-500-999:
     name: External Libraries Tests (2.0.20[${{ inputs.compiler_version || '2.0.20' }}]) 500-999
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_external_libraries_tests_500_999 || true))
+      (!inputs.suites || (contains(inputs.suites, 'lib-500-999') && !contains(inputs.suites, '!lib-500-999')))
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -236,7 +188,7 @@ jobs:
   external-libraries-tests-1000-1499:
     name: External Libraries Tests (2.0.20[${{ inputs.compiler_version || '2.0.20' }}]) 1000-1499
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_external_libraries_tests_1000_1499 || 
```

**File**: `.github/workflows/smoke-tests-2_1_0-github.yml` (modified, +18/-71)
```diff
@@ -2,69 +2,16 @@ name: Smoke Tests 2.1.0 [github-hosted]
 
 # Do not edit - generated by `generateCIActions` Gradle task.
 
-on:  
+on:
   workflow_dispatch:
     inputs:
-      invert_selection:
-        type: boolean
-        required: false
-        default: false
-        description: '🔄 INVERT SELECTION: When enabled, UNCHECKED boxes will run and CHECKED boxes will be skipped'
-      run_acceptance_tests:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run Acceptance Tests'
-      run_type_mapping_tests:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run Type Mapping Tests'
-      run_gradle_tests:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run Gradle Tests'
-      run_external_libraries_tests_0_499:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 0-499'
-      run_external_libraries_tests_500_999:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 500-999'
-      run_external_libraries_tests_1000_1499:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 1000-1499'
-      run_external_libraries_tests_1500_1999:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 1500-1999'
-      run_external_libraries_tests_2000_2499:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 2000-2499'
-      run_external_libraries_tests_2500_2999:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 2500-2999'
-      run_external_libraries_tests_3000_3499:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 3000-3499'
-      run_external_libraries_tests_3500_3855:
-        type: boolean
+      suites:
+        type: string
         required: false
-        default: true
-        description: 'Run External Libraries Tests 3500-3855'
+        default: 'acceptance,type-mapping,gradle,lib-0-499,lib-500-999,lib-1000-1499,lib-1500-1999,lib-2000-2499,lib-2500-2999,lib-3000-3499,lib-3500-3855'
+        description: |
+          Comma-separated test suites to run. Available: acceptance, type-mapping, gradle, lib-0-499, lib-500-999, lib-1000-1499, lib-1500-1999, lib-2000-2499, lib-2500-2999, lib-3000-3499, lib-3500-3855
+          Leave empty to run all. Use '!' prefix to exclude (e.g., '!lib-0-499').
       compiler_version:
         type: string
         required: true
@@ -110,7 +57,7 @@ jobs:
   acceptance-tests:
     name: Acceptance Tests 2.1.0[${{ inputs.compiler_version || '2.1.0' }}]
     if: |-
-      ((inputs.invert_selection || false) != (inputs.run_acceptance_tests || true))
+      (!inputs.suites || (contains(inputs.suites, 'acceptance') && !contains(inputs.suites, '!acceptance')))
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -132,7 +79,7 @@ jobs:
   gradle-tests:
     name: Gradle Tests 2.1.0[${{ inputs.compiler_version || '2.1.0' }}]
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_gradle_tests || true))
+      (!inputs.suites || (contains(inputs.suites, 'gradle') && !contains(inputs.suites, '!gradle')))
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -168,7 +115,7 @@ jobs:
   type-mapping-tests:
     name: Type Mapping Tests 2.1.0[${{ inputs.compiler_version || '2.1.0' }}]
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_type_mapping_tests || true))
+      (!inputs.suites || (contains(inputs.suites, 'type-mapping') && !contains(inputs.suites, '!type-mapping')))
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -192,7 +139,7 @@ jobs:
   external-libraries-tests-0-499:
     name: External Libraries Tests (2.1.0[${{ inputs.compiler_version || '2.1.0' }}]) 0-499
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_external_libraries_tests_0_499 || true))
+      (!inputs.suites || (contains(inputs.suites, 'lib-0-499') && !contains(inputs.suites, '!lib-0-499')))
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -215,7 +162,7 @@ jobs:
   external-libraries-tests-500-999:
     name: External Libraries Tests (2.1.0[${{ inputs.compiler_version || '2.1.0' }}]) 500-999
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_external_libraries_tests_500_999 || true))
+      (!inputs.suites || (contains(inputs.suites, 'lib-500-999') && !contains(inputs.suites, '!lib-500-999')))
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -238,7 +185,7 @@ jobs:
   external-libraries-tests-1000-1499:
     name: External Libraries Tests (2.1.0[${{ inpu
```

**File**: `.github/workflows/smoke-tests-2_1_0-self-hosted.yml` (modified, +18/-71)
```diff
@@ -5,69 +5,16 @@ name: Smoke Tests 2.1.0 [self-hosted]
 on:  
   schedule:
     # Every Saturday at 12am EST
-    - cron: '0 5 * * SAT'  
+    - cron: '0 5 * * SAT'
   workflow_dispatch:
     inputs:
-      invert_selection:
-        type: boolean
-        required: false
-        default: false
-        description: '🔄 INVERT SELECTION: When enabled, UNCHECKED boxes will run and CHECKED boxes will be skipped'
-      run_acceptance_tests:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run Acceptance Tests'
-      run_type_mapping_tests:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run Type Mapping Tests'
-      run_gradle_tests:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run Gradle Tests'
-      run_external_libraries_tests_0_499:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 0-499'
-      run_external_libraries_tests_500_999:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 500-999'
-      run_external_libraries_tests_1000_1499:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 1000-1499'
-      run_external_libraries_tests_1500_1999:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 1500-1999'
-      run_external_libraries_tests_2000_2499:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 2000-2499'
-      run_external_libraries_tests_2500_2999:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 2500-2999'
-      run_external_libraries_tests_3000_3499:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 3000-3499'
-      run_external_libraries_tests_3500_3855:
-        type: boolean
+      suites:
+        type: string
         required: false
-        default: true
-        description: 'Run External Libraries Tests 3500-3855'
+        default: 'acceptance,type-mapping,gradle,lib-0-499,lib-500-999,lib-1000-1499,lib-1500-1999,lib-2000-2499,lib-2500-2999,lib-3000-3499,lib-3500-3855'
+        description: |
+          Comma-separated test suites to run. Available: acceptance, type-mapping, gradle, lib-0-499, lib-500-999, lib-1000-1499, lib-1500-1999, lib-2000-2499, lib-2500-2999, lib-3000-3499, lib-3500-3855
+          Leave empty to run all. Use '!' prefix to exclude (e.g., '!lib-0-499').
       compiler_version:
         type: string
         required: true
@@ -113,7 +60,7 @@ jobs:
   acceptance-tests:
     name: Acceptance Tests 2.1.0[${{ inputs.compiler_version || '2.1.0' }}]
     if: |-
-      ((inputs.invert_selection || false) != (inputs.run_acceptance_tests || true))
+      (!inputs.suites || (contains(inputs.suites, 'acceptance') && !contains(inputs.suites, '!acceptance')))
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -135,7 +82,7 @@ jobs:
   gradle-tests:
     name: Gradle Tests 2.1.0[${{ inputs.compiler_version || '2.1.0' }}]
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_gradle_tests || true))
+      (!inputs.suites || (contains(inputs.suites, 'gradle') && !contains(inputs.suites, '!gradle')))
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -171,7 +118,7 @@ jobs:
   type-mapping-tests:
     name: Type Mapping Tests 2.1.0[${{ inputs.compiler_version || '2.1.0' }}]
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_type_mapping_tests || true))
+      (!inputs.suites || (contains(inputs.suites, 'type-mapping') && !contains(inputs.suites, '!type-mapping')))
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -195,7 +142,7 @@ jobs:
   external-libraries-tests-0-499:
     name: External Libraries Tests (2.1.0[${{ inputs.compiler_version || '2.1.0' }}]) 0-499
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_external_libraries_tests_0_499 || true))
+      (!inputs.suites || (contains(inputs.suites, 'lib-0-499') && !contains(inputs.suites, '!lib-0-499')))
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -218,7 +165,7 @@ jobs:
   external-libraries-tests-500-999:
     name: External Libraries Tests (2.1.0[${{ inputs.compiler_version || '2.1.0' }}]) 500-999
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_external_libraries_tests_500_999 || true))
+      (!inputs.suites || (contains(inputs.suites, 'lib-500-999') && !contains(inputs.suites, '!lib-500-999')))
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -241,7 +188,7 @@ jobs:
   external-libraries-tests-1000-1499:
     na
```

**File**: `.github/workflows/smoke-tests-2_1_20-github.yml` (modified, +20/-83)
```diff
@@ -2,79 +2,16 @@ name: Smoke Tests 2.1.20 [github-hosted]
 
 # Do not edit - generated by `generateCIActions` Gradle task.
 
-on:  
+on:
   workflow_dispatch:
     inputs:
-      invert_selection:
-        type: boolean
-        required: false
-        default: false
-        description: '🔄 INVERT SELECTION: When enabled, UNCHECKED boxes will run and CHECKED boxes will be skipped'
-      run_acceptance_tests:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run Acceptance Tests'
-      run_type_mapping_tests:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run Type Mapping Tests'
-      run_gradle_tests:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run Gradle Tests'
-      run_external_libraries_tests_0_499:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 0-499'
-      run_external_libraries_tests_500_999:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 500-999'
-      run_external_libraries_tests_1000_1499:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 1000-1499'
-      run_external_libraries_tests_1500_1999:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 1500-1999'
-      run_external_libraries_tests_2000_2499:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 2000-2499'
-      run_external_libraries_tests_2500_2999:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 2500-2999'
-      run_external_libraries_tests_3000_3499:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 3000-3499'
-      run_external_libraries_tests_3500_3999:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 3500-3999'
-      run_external_libraries_tests_4000_4499:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 4000-4499'
-      run_external_libraries_tests_4500_4841:
-        type: boolean
+      suites:
+        type: string
         required: false
-        default: true
-        description: 'Run External Libraries Tests 4500-4841'
+        default: 'acceptance,type-mapping,gradle,lib-0-499,lib-500-999,lib-1000-1499,lib-1500-1999,lib-2000-2499,lib-2500-2999,lib-3000-3499,lib-3500-3999,lib-4000-4499,lib-4500-4841'
+        description: |
+          Comma-separated test suites to run. Available: acceptance, type-mapping, gradle, lib-0-499, lib-500-999, lib-1000-1499, lib-1500-1999, lib-2000-2499, lib-2500-2999, lib-3000-3499, lib-3500-3999, lib-4000-4499, lib-4500-4841
+          Leave empty to run all. Use '!' prefix to exclude (e.g., '!lib-0-499').
       compiler_version:
         type: string
         required: true
@@ -120,7 +57,7 @@ jobs:
   acceptance-tests:
     name: Acceptance Tests 2.1.20[${{ inputs.compiler_version || '2.1.20' }}]
     if: |-
-      ((inputs.invert_selection || false) != (inputs.run_acceptance_tests || true))
+      (!inputs.suites || (contains(inputs.suites, 'acceptance') && !contains(inputs.suites, '!acceptance')))
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -142,7 +79,7 @@ jobs:
   gradle-tests:
     name: Gradle Tests 2.1.20[${{ inputs.compiler_version || '2.1.20' }}]
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_gradle_tests || true))
+      (!inputs.suites || (contains(inputs.suites, 'gradle') && !contains(inputs.suites, '!gradle')))
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -178,7 +115,7 @@ jobs:
   type-mapping-tests:
     name: Type Mapping Tests 2.1.20[${{ inputs.compiler_version || '2.1.20' }}]
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_type_mapping_tests || true))
+      (!inputs.suites || (contains(inputs.suites, 'type-mapping') && !contains(inputs.suites, '!type-mapping')))
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -202,7 +139,7 @@ jobs:
   external-libraries-tests-0-499:
     name: External Libraries Tests (2.1.20[${{ inputs.compiler_version || '2.1.20' }}]) 0-499
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_external_libraries_tests_0_499 || true))
+      (!inputs.suites || (contains(inputs.suites, 'lib-0-499') && !contains(inputs.suites, '!lib-0-499')))
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -225,7 +162,7 @@ jobs:
   external-libraries-tests-500-999:
     name: External Libraries Tests (2.1.20[${{ inputs.compiler_versio
```

**File**: `.github/workflows/smoke-tests-2_1_20-self-hosted.yml` (modified, +20/-83)
```diff
@@ -5,79 +5,16 @@ name: Smoke Tests 2.1.20 [self-hosted]
 on:  
   schedule:
     # Every Saturday at 12am EST
-    - cron: '0 5 * * SAT'  
+    - cron: '0 5 * * SAT'
   workflow_dispatch:
     inputs:
-      invert_selection:
-        type: boolean
-        required: false
-        default: false
-        description: '🔄 INVERT SELECTION: When enabled, UNCHECKED boxes will run and CHECKED boxes will be skipped'
-      run_acceptance_tests:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run Acceptance Tests'
-      run_type_mapping_tests:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run Type Mapping Tests'
-      run_gradle_tests:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run Gradle Tests'
-      run_external_libraries_tests_0_499:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 0-499'
-      run_external_libraries_tests_500_999:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 500-999'
-      run_external_libraries_tests_1000_1499:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 1000-1499'
-      run_external_libraries_tests_1500_1999:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 1500-1999'
-      run_external_libraries_tests_2000_2499:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 2000-2499'
-      run_external_libraries_tests_2500_2999:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 2500-2999'
-      run_external_libraries_tests_3000_3499:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 3000-3499'
-      run_external_libraries_tests_3500_3999:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 3500-3999'
-      run_external_libraries_tests_4000_4499:
-        type: boolean
-        required: false
-        default: true
-        description: 'Run External Libraries Tests 4000-4499'
-      run_external_libraries_tests_4500_4841:
-        type: boolean
+      suites:
+        type: string
         required: false
-        default: true
-        description: 'Run External Libraries Tests 4500-4841'
+        default: 'acceptance,type-mapping,gradle,lib-0-499,lib-500-999,lib-1000-1499,lib-1500-1999,lib-2000-2499,lib-2500-2999,lib-3000-3499,lib-3500-3999,lib-4000-4499,lib-4500-4841'
+        description: |
+          Comma-separated test suites to run. Available: acceptance, type-mapping, gradle, lib-0-499, lib-500-999, lib-1000-1499, lib-1500-1999, lib-2000-2499, lib-2500-2999, lib-3000-3499, lib-3500-3999, lib-4000-4499, lib-4500-4841
+          Leave empty to run all. Use '!' prefix to exclude (e.g., '!lib-0-499').
       compiler_version:
         type: string
         required: true
@@ -123,7 +60,7 @@ jobs:
   acceptance-tests:
     name: Acceptance Tests 2.1.20[${{ inputs.compiler_version || '2.1.20' }}]
     if: |-
-      ((inputs.invert_selection || false) != (inputs.run_acceptance_tests || true))
+      (!inputs.suites || (contains(inputs.suites, 'acceptance') && !contains(inputs.suites, '!acceptance')))
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -145,7 +82,7 @@ jobs:
   gradle-tests:
     name: Gradle Tests 2.1.20[${{ inputs.compiler_version || '2.1.20' }}]
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_gradle_tests || true))
+      (!inputs.suites || (contains(inputs.suites, 'gradle') && !contains(inputs.suites, '!gradle')))
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -181,7 +118,7 @@ jobs:
   type-mapping-tests:
     name: Type Mapping Tests 2.1.20[${{ inputs.compiler_version || '2.1.20' }}]
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_type_mapping_tests || true))
+      (!inputs.suites || (contains(inputs.suites, 'type-mapping') && !contains(inputs.suites, '!type-mapping')))
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -205,7 +142,7 @@ jobs:
   external-libraries-tests-0-499:
     name: External Libraries Tests (2.1.20[${{ inputs.compiler_version || '2.1.20' }}]) 0-499
     if: |
-      ((inputs.invert_selection || false) != (inputs.run_external_libraries_tests_0_499 || true))
+      (!inputs.suites || (contains(inputs.suites, 'lib-0-499') && !contains(inputs.suites, '!lib-0-499')))
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -228,7 +165,7 @@ jobs:
   external-libraries-tests-500-999:
     name: External Libraries
```

---

### Incident Patch 13: `28c5c4c9` (2025-11-11)
**Commit Message**: Fix versioned smoke tests workflow syntax.

**File**: `.github/workflows/smoke-tests-2_0_0-github.yml` (modified, +7/-7)
```diff
@@ -108,7 +108,7 @@ jobs:
       - name: Run Acceptance Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]'
+          arguments: ":acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -167,7 +167,7 @@ jobs:
         uses: gradle/gradle-build-action@v2.4.2
         id: run-tests
         with:
-          arguments: ':acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]'
+          arguments: ":acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -190,7 +190,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -213,7 +213,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -236,7 +236,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -259,7 +259,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -282,7 +282,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
```

**File**: `.github/workflows/smoke-tests-2_0_0-self-hosted.yml` (modified, +7/-7)
```diff
@@ -111,7 +111,7 @@ jobs:
       - name: Run Acceptance Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]'
+          arguments: ":acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -170,7 +170,7 @@ jobs:
         uses: gradle/gradle-build-action@v2.4.2
         id: run-tests
         with:
-          arguments: ':acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]'
+          arguments: ":acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -193,7 +193,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -216,7 +216,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -239,7 +239,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -262,7 +262,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -285,7 +285,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
```

**File**: `.github/workflows/smoke-tests-2_0_20-github.yml` (modified, +9/-9)
```diff
@@ -118,7 +118,7 @@ jobs:
       - name: Run Acceptance Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]'
+          arguments: ":acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -177,7 +177,7 @@ jobs:
         uses: gradle/gradle-build-action@v2.4.2
         id: run-tests
         with:
-          arguments: ':acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]'
+          arguments: ":acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -200,7 +200,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -223,7 +223,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -246,7 +246,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -269,7 +269,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -292,7 +292,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -315,7 +315,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -338,7 +338,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
```

**File**: `.github/workflows/smoke-tests-2_0_20-self-hosted.yml` (modified, +9/-9)
```diff
@@ -121,7 +121,7 @@ jobs:
       - name: Run Acceptance Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]'
+          arguments: ":acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -180,7 +180,7 @@ jobs:
         uses: gradle/gradle-build-action@v2.4.2
         id: run-tests
         with:
-          arguments: ':acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]'
+          arguments: ":acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -203,7 +203,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -226,7 +226,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -249,7 +249,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -272,7 +272,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -295,7 +295,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -318,7 +318,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -341,7 +341,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
```

**File**: `.github/workflows/smoke-tests-2_1_0-github.yml` (modified, +10/-10)
```diff
@@ -123,7 +123,7 @@ jobs:
       - name: Run Acceptance Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]'
+          arguments: ":acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -182,7 +182,7 @@ jobs:
         uses: gradle/gradle-build-action@v2.4.2
         id: run-tests
         with:
-          arguments: ':acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]'
+          arguments: ":acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -205,7 +205,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -228,7 +228,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -251,7 +251,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -274,7 +274,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -297,7 +297,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -320,7 +320,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -343,7 +343,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -366,7 +366,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_vers
```

**File**: `.github/workflows/smoke-tests-2_1_0-self-hosted.yml` (modified, +10/-10)
```diff
@@ -126,7 +126,7 @@ jobs:
       - name: Run Acceptance Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]'
+          arguments: ":acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -185,7 +185,7 @@ jobs:
         uses: gradle/gradle-build-action@v2.4.2
         id: run-tests
         with:
-          arguments: ':acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]'
+          arguments: ":acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -208,7 +208,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -231,7 +231,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -254,7 +254,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -277,7 +277,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -300,7 +300,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -323,7 +323,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -346,7 +346,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -369,7 +369,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_vers
```

**File**: `.github/workflows/smoke-tests-2_1_20-github.yml` (modified, +12/-12)
```diff
@@ -133,7 +133,7 @@ jobs:
       - name: Run Acceptance Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]'
+          arguments: ":acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -192,7 +192,7 @@ jobs:
         uses: gradle/gradle-build-action@v2.4.2
         id: run-tests
         with:
-          arguments: ':acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]'
+          arguments: ":acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -215,7 +215,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -238,7 +238,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -261,7 +261,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -284,7 +284,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -307,7 +307,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -330,7 +330,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -353,7 +353,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -376,7 +376,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVer
```

**File**: `.github/workflows/smoke-tests-2_1_20-self-hosted.yml` (modified, +12/-12)
```diff
@@ -136,7 +136,7 @@ jobs:
       - name: Run Acceptance Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]'
+          arguments: ":acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -195,7 +195,7 @@ jobs:
         uses: gradle/gradle-build-action@v2.4.2
         id: run-tests
         with:
-          arguments: ':acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]'
+          arguments: ":acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -218,7 +218,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -241,7 +241,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -264,7 +264,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -287,7 +287,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -310,7 +310,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -333,7 +333,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -356,7 +356,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]'
+          arguments: ":acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]"
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
@@ -379,7 +379,7 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVer
```

---

### Incident Patch 14: `16e86a59` (2025-11-11)
**Commit Message**: Fix that cron jobs used invalid Kotlin version.

**File**: `.github/workflows/smoke-tests-2_0_0-github.yml` (modified, +16/-16)
```diff
@@ -48,7 +48,7 @@ permissions:
 
 jobs:
   acceptance-tests:
-    name: Acceptance Tests 2.0.0[${{ inputs.compiler_version }}]
+    name: Acceptance Tests 2.0.0[${{ inputs.compiler_version || '2.0.0' }}]
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -61,14 +61,14 @@ jobs:
       - name: Run Acceptance Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
 
   type-mapping-tests:
-    name: Type Mapping Tests 2.0.0[${{ inputs.compiler_version }}]
+    name: Type Mapping Tests 2.0.0[${{ inputs.compiler_version || '2.0.0' }}]
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -82,15 +82,15 @@ jobs:
         uses: gradle/gradle-build-action@v2.4.2
         id: run-tests
         with:
-          arguments: ':acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_TARGET: ${{ inputs.target }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
 
   gradle-tests:
-    name: Gradle Tests 2.0.0[${{ inputs.compiler_version }}]
+    name: Gradle Tests 2.0.0[${{ inputs.compiler_version || '2.0.0' }}]
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -113,7 +113,7 @@ jobs:
             "-Pmatrix.targets=macosArm64"
             "-Pmatrix.configurations=${{ inputs.configuration || 'debug' }}"
             "-Pmatrix.linkModes=${{ inputs.linkage || 'static' }}"
-            "-PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version }}]"
+            "-PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]"
           build-root-directory: test-runner
       - name: Publish Test Report
         uses: mikepenz/action-junit-report@v4
@@ -124,7 +124,7 @@ jobs:
           require_tests: true
   
   external-libraries-tests-0-499:
-    name: External Libraries Tests (2.0.0[${{ inputs.compiler_version }}]) 0-499
+    name: External Libraries Tests (2.0.0[${{ inputs.compiler_version || '2.0.0' }}]) 0-499
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -137,15 +137,15 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
           onlyIndices: "0-499"
   
   external-libraries-tests-500-999:
-    name: External Libraries Tests (2.0.0[${{ inputs.compiler_version }}]) 500-999
+    name: External Libraries Tests (2.0.0[${{ inputs.compiler_version || '2.0.0' }}]) 500-999
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -158,15 +158,15 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
           onlyIndices: "500-999"
   
   external-libraries-tests-1000-1499:
-    name: External Libraries Tests (2.0.0[${{ inputs.compiler_version }}]) 1000-1499
+    name: External Libraries Tests (2.0.0[${{ inputs.compiler_version || '2.0.0' }}]) 1000-1499
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -179,15 +179,15 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_v
```

**File**: `.github/workflows/smoke-tests-2_0_0-self-hosted.yml` (modified, +16/-16)
```diff
@@ -51,7 +51,7 @@ permissions:
 
 jobs:
   acceptance-tests:
-    name: Acceptance Tests 2.0.0[${{ inputs.compiler_version }}]
+    name: Acceptance Tests 2.0.0[${{ inputs.compiler_version || '2.0.0' }}]
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -64,14 +64,14 @@ jobs:
       - name: Run Acceptance Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
 
   type-mapping-tests:
-    name: Type Mapping Tests 2.0.0[${{ inputs.compiler_version }}]
+    name: Type Mapping Tests 2.0.0[${{ inputs.compiler_version || '2.0.0' }}]
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -85,15 +85,15 @@ jobs:
         uses: gradle/gradle-build-action@v2.4.2
         id: run-tests
         with:
-          arguments: ':acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_TARGET: ${{ inputs.target }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
 
   gradle-tests:
-    name: Gradle Tests 2.0.0[${{ inputs.compiler_version }}]
+    name: Gradle Tests 2.0.0[${{ inputs.compiler_version || '2.0.0' }}]
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -116,7 +116,7 @@ jobs:
             "-Pmatrix.targets=macosArm64"
             "-Pmatrix.configurations=${{ inputs.configuration || 'debug' }}"
             "-Pmatrix.linkModes=${{ inputs.linkage || 'static' }}"
-            "-PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version }}]"
+            "-PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]"
           build-root-directory: test-runner
       - name: Publish Test Report
         uses: mikepenz/action-junit-report@v4
@@ -127,7 +127,7 @@ jobs:
           require_tests: true
   
   external-libraries-tests-0-499:
-    name: External Libraries Tests (2.0.0[${{ inputs.compiler_version }}]) 0-499
+    name: External Libraries Tests (2.0.0[${{ inputs.compiler_version || '2.0.0' }}]) 0-499
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -140,15 +140,15 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
           onlyIndices: "0-499"
   
   external-libraries-tests-500-999:
-    name: External Libraries Tests (2.0.0[${{ inputs.compiler_version }}]) 500-999
+    name: External Libraries Tests (2.0.0[${{ inputs.compiler_version || '2.0.0' }}]) 500-999
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -161,15 +161,15 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version || '2.0.0' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
           onlyIndices: "500-999"
   
   external-libraries-tests-1000-1499:
-    name: External Libraries Tests (2.0.0[${{ inputs.compiler_version }}]) 1000-1499
+    name: External Libraries Tests (2.0.0[${{ inputs.compiler_version || '2.0.0' }}]) 1000-1499
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -182,15 +182,15 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.0[${{
```

**File**: `.github/workflows/smoke-tests-2_0_20-github.yml` (modified, +20/-20)
```diff
@@ -48,7 +48,7 @@ permissions:
 
 jobs:
   acceptance-tests:
-    name: Acceptance Tests 2.0.20[${{ inputs.compiler_version }}]
+    name: Acceptance Tests 2.0.20[${{ inputs.compiler_version || '2.0.20' }}]
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -61,14 +61,14 @@ jobs:
       - name: Run Acceptance Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
 
   type-mapping-tests:
-    name: Type Mapping Tests 2.0.20[${{ inputs.compiler_version }}]
+    name: Type Mapping Tests 2.0.20[${{ inputs.compiler_version || '2.0.20' }}]
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -82,15 +82,15 @@ jobs:
         uses: gradle/gradle-build-action@v2.4.2
         id: run-tests
         with:
-          arguments: ':acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_TARGET: ${{ inputs.target }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
 
   gradle-tests:
-    name: Gradle Tests 2.0.20[${{ inputs.compiler_version }}]
+    name: Gradle Tests 2.0.20[${{ inputs.compiler_version || '2.0.20' }}]
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -113,7 +113,7 @@ jobs:
             "-Pmatrix.targets=macosArm64"
             "-Pmatrix.configurations=${{ inputs.configuration || 'debug' }}"
             "-Pmatrix.linkModes=${{ inputs.linkage || 'static' }}"
-            "-PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version }}]"
+            "-PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]"
           build-root-directory: test-runner
       - name: Publish Test Report
         uses: mikepenz/action-junit-report@v4
@@ -124,7 +124,7 @@ jobs:
           require_tests: true
   
   external-libraries-tests-0-499:
-    name: External Libraries Tests (2.0.20[${{ inputs.compiler_version }}]) 0-499
+    name: External Libraries Tests (2.0.20[${{ inputs.compiler_version || '2.0.20' }}]) 0-499
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -137,15 +137,15 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
           onlyIndices: "0-499"
   
   external-libraries-tests-500-999:
-    name: External Libraries Tests (2.0.20[${{ inputs.compiler_version }}]) 500-999
+    name: External Libraries Tests (2.0.20[${{ inputs.compiler_version || '2.0.20' }}]) 500-999
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -158,15 +158,15 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
           onlyIndices: "500-999"
   
   external-libraries-tests-1000-1499:
-    name: External Libraries Tests (2.0.20[${{ inputs.compiler_version }}]) 1000-1499
+    name: External Libraries Tests (2.0.20[${{ inputs.compiler_version || '2.0.20' }}]) 1000-1499
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -179,15 +179,15 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVe
```

**File**: `.github/workflows/smoke-tests-2_0_20-self-hosted.yml` (modified, +20/-20)
```diff
@@ -51,7 +51,7 @@ permissions:
 
 jobs:
   acceptance-tests:
-    name: Acceptance Tests 2.0.20[${{ inputs.compiler_version }}]
+    name: Acceptance Tests 2.0.20[${{ inputs.compiler_version || '2.0.20' }}]
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -64,14 +64,14 @@ jobs:
       - name: Run Acceptance Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
 
   type-mapping-tests:
-    name: Type Mapping Tests 2.0.20[${{ inputs.compiler_version }}]
+    name: Type Mapping Tests 2.0.20[${{ inputs.compiler_version || '2.0.20' }}]
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -85,15 +85,15 @@ jobs:
         uses: gradle/gradle-build-action@v2.4.2
         id: run-tests
         with:
-          arguments: ':acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_TARGET: ${{ inputs.target }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
 
   gradle-tests:
-    name: Gradle Tests 2.0.20[${{ inputs.compiler_version }}]
+    name: Gradle Tests 2.0.20[${{ inputs.compiler_version || '2.0.20' }}]
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -116,7 +116,7 @@ jobs:
             "-Pmatrix.targets=macosArm64"
             "-Pmatrix.configurations=${{ inputs.configuration || 'debug' }}"
             "-Pmatrix.linkModes=${{ inputs.linkage || 'static' }}"
-            "-PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version }}]"
+            "-PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]"
           build-root-directory: test-runner
       - name: Publish Test Report
         uses: mikepenz/action-junit-report@v4
@@ -127,7 +127,7 @@ jobs:
           require_tests: true
   
   external-libraries-tests-0-499:
-    name: External Libraries Tests (2.0.20[${{ inputs.compiler_version }}]) 0-499
+    name: External Libraries Tests (2.0.20[${{ inputs.compiler_version || '2.0.20' }}]) 0-499
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -140,15 +140,15 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
           onlyIndices: "0-499"
   
   external-libraries-tests-500-999:
-    name: External Libraries Tests (2.0.20[${{ inputs.compiler_version }}]) 500-999
+    name: External Libraries Tests (2.0.20[${{ inputs.compiler_version || '2.0.20' }}]) 500-999
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -161,15 +161,15 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version || '2.0.20' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
           onlyIndices: "500-999"
   
   external-libraries-tests-1000-1499:
-    name: External Libraries Tests (2.0.20[${{ inputs.compiler_version }}]) 1000-1499
+    name: External Libraries Tests (2.0.20[${{ inputs.compiler_version || '2.0.20' }}]) 1000-1499
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -182,15 +182,15 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.0.20[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:libraries:test -PversionSuppor
```

**File**: `.github/workflows/smoke-tests-2_1_0-github.yml` (modified, +22/-22)
```diff
@@ -48,7 +48,7 @@ permissions:
 
 jobs:
   acceptance-tests:
-    name: Acceptance Tests 2.1.0[${{ inputs.compiler_version }}]
+    name: Acceptance Tests 2.1.0[${{ inputs.compiler_version || '2.1.0' }}]
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -61,14 +61,14 @@ jobs:
       - name: Run Acceptance Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
 
   type-mapping-tests:
-    name: Type Mapping Tests 2.1.0[${{ inputs.compiler_version }}]
+    name: Type Mapping Tests 2.1.0[${{ inputs.compiler_version || '2.1.0' }}]
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -82,15 +82,15 @@ jobs:
         uses: gradle/gradle-build-action@v2.4.2
         id: run-tests
         with:
-          arguments: ':acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_TARGET: ${{ inputs.target }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
 
   gradle-tests:
-    name: Gradle Tests 2.1.0[${{ inputs.compiler_version }}]
+    name: Gradle Tests 2.1.0[${{ inputs.compiler_version || '2.1.0' }}]
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -113,7 +113,7 @@ jobs:
             "-Pmatrix.targets=macosArm64"
             "-Pmatrix.configurations=${{ inputs.configuration || 'debug' }}"
             "-Pmatrix.linkModes=${{ inputs.linkage || 'static' }}"
-            "-PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version }}]"
+            "-PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]"
           build-root-directory: test-runner
       - name: Publish Test Report
         uses: mikepenz/action-junit-report@v4
@@ -124,7 +124,7 @@ jobs:
           require_tests: true
   
   external-libraries-tests-0-499:
-    name: External Libraries Tests (2.1.0[${{ inputs.compiler_version }}]) 0-499
+    name: External Libraries Tests (2.1.0[${{ inputs.compiler_version || '2.1.0' }}]) 0-499
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -137,15 +137,15 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
           onlyIndices: "0-499"
   
   external-libraries-tests-500-999:
-    name: External Libraries Tests (2.1.0[${{ inputs.compiler_version }}]) 500-999
+    name: External Libraries Tests (2.1.0[${{ inputs.compiler_version || '2.1.0' }}]) 500-999
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -158,15 +158,15 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
           onlyIndices: "500-999"
   
   external-libraries-tests-1000-1499:
-    name: External Libraries Tests (2.1.0[${{ inputs.compiler_version }}]) 1000-1499
+    name: External Libraries Tests (2.1.0[${{ inputs.compiler_version || '2.1.0' }}]) 1000-1499
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -179,15 +179,15 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_v
```

**File**: `.github/workflows/smoke-tests-2_1_0-self-hosted.yml` (modified, +22/-22)
```diff
@@ -51,7 +51,7 @@ permissions:
 
 jobs:
   acceptance-tests:
-    name: Acceptance Tests 2.1.0[${{ inputs.compiler_version }}]
+    name: Acceptance Tests 2.1.0[${{ inputs.compiler_version || '2.1.0' }}]
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -64,14 +64,14 @@ jobs:
       - name: Run Acceptance Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
 
   type-mapping-tests:
-    name: Type Mapping Tests 2.1.0[${{ inputs.compiler_version }}]
+    name: Type Mapping Tests 2.1.0[${{ inputs.compiler_version || '2.1.0' }}]
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -85,15 +85,15 @@ jobs:
         uses: gradle/gradle-build-action@v2.4.2
         id: run-tests
         with:
-          arguments: ':acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_TARGET: ${{ inputs.target }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
 
   gradle-tests:
-    name: Gradle Tests 2.1.0[${{ inputs.compiler_version }}]
+    name: Gradle Tests 2.1.0[${{ inputs.compiler_version || '2.1.0' }}]
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -116,7 +116,7 @@ jobs:
             "-Pmatrix.targets=macosArm64"
             "-Pmatrix.configurations=${{ inputs.configuration || 'debug' }}"
             "-Pmatrix.linkModes=${{ inputs.linkage || 'static' }}"
-            "-PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version }}]"
+            "-PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]"
           build-root-directory: test-runner
       - name: Publish Test Report
         uses: mikepenz/action-junit-report@v4
@@ -127,7 +127,7 @@ jobs:
           require_tests: true
   
   external-libraries-tests-0-499:
-    name: External Libraries Tests (2.1.0[${{ inputs.compiler_version }}]) 0-499
+    name: External Libraries Tests (2.1.0[${{ inputs.compiler_version || '2.1.0' }}]) 0-499
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -140,15 +140,15 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
           onlyIndices: "0-499"
   
   external-libraries-tests-500-999:
-    name: External Libraries Tests (2.1.0[${{ inputs.compiler_version }}]) 500-999
+    name: External Libraries Tests (2.1.0[${{ inputs.compiler_version || '2.1.0' }}]) 500-999
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -161,15 +161,15 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version || '2.1.0' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
           onlyIndices: "500-999"
   
   external-libraries-tests-1000-1499:
-    name: External Libraries Tests (2.1.0[${{ inputs.compiler_version }}]) 1000-1499
+    name: External Libraries Tests (2.1.0[${{ inputs.compiler_version || '2.1.0' }}]) 1000-1499
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -182,15 +182,15 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.0[${{
```

**File**: `.github/workflows/smoke-tests-2_1_20-github.yml` (modified, +26/-26)
```diff
@@ -48,7 +48,7 @@ permissions:
 
 jobs:
   acceptance-tests:
-    name: Acceptance Tests 2.1.20[${{ inputs.compiler_version }}]
+    name: Acceptance Tests 2.1.20[${{ inputs.compiler_version || '2.1.20' }}]
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -61,14 +61,14 @@ jobs:
       - name: Run Acceptance Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
 
   type-mapping-tests:
-    name: Type Mapping Tests 2.1.20[${{ inputs.compiler_version }}]
+    name: Type Mapping Tests 2.1.20[${{ inputs.compiler_version || '2.1.20' }}]
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -82,15 +82,15 @@ jobs:
         uses: gradle/gradle-build-action@v2.4.2
         id: run-tests
         with:
-          arguments: ':acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_TARGET: ${{ inputs.target }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
 
   gradle-tests:
-    name: Gradle Tests 2.1.20[${{ inputs.compiler_version }}]
+    name: Gradle Tests 2.1.20[${{ inputs.compiler_version || '2.1.20' }}]
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -113,7 +113,7 @@ jobs:
             "-Pmatrix.targets=macosArm64"
             "-Pmatrix.configurations=${{ inputs.configuration || 'debug' }}"
             "-Pmatrix.linkModes=${{ inputs.linkage || 'static' }}"
-            "-PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version }}]"
+            "-PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]"
           build-root-directory: test-runner
       - name: Publish Test Report
         uses: mikepenz/action-junit-report@v4
@@ -124,7 +124,7 @@ jobs:
           require_tests: true
   
   external-libraries-tests-0-499:
-    name: External Libraries Tests (2.1.20[${{ inputs.compiler_version }}]) 0-499
+    name: External Libraries Tests (2.1.20[${{ inputs.compiler_version || '2.1.20' }}]) 0-499
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -137,15 +137,15 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
           onlyIndices: "0-499"
   
   external-libraries-tests-500-999:
-    name: External Libraries Tests (2.1.20[${{ inputs.compiler_version }}]) 500-999
+    name: External Libraries Tests (2.1.20[${{ inputs.compiler_version || '2.1.20' }}]) 500-999
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -158,15 +158,15 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
           onlyIndices: "500-999"
   
   external-libraries-tests-1000-1499:
-    name: External Libraries Tests (2.1.20[${{ inputs.compiler_version }}]) 1000-1499
+    name: External Libraries Tests (2.1.20[${{ inputs.compiler_version || '2.1.20' }}]) 1000-1499
     runs-on: macos-14
     steps:
       - name: Checkout Repo
@@ -179,15 +179,15 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVe
```

**File**: `.github/workflows/smoke-tests-2_1_20-self-hosted.yml` (modified, +26/-26)
```diff
@@ -51,7 +51,7 @@ permissions:
 
 jobs:
   acceptance-tests:
-    name: Acceptance Tests 2.1.20[${{ inputs.compiler_version }}]
+    name: Acceptance Tests 2.1.20[${{ inputs.compiler_version || '2.1.20' }}]
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -64,14 +64,14 @@ jobs:
       - name: Run Acceptance Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:functional:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
 
   type-mapping-tests:
-    name: Type Mapping Tests 2.1.20[${{ inputs.compiler_version }}]
+    name: Type Mapping Tests 2.1.20[${{ inputs.compiler_version || '2.1.20' }}]
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -85,15 +85,15 @@ jobs:
         uses: gradle/gradle-build-action@v2.4.2
         id: run-tests
         with:
-          arguments: ':acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:type-mapping:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_TARGET: ${{ inputs.target }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
 
   gradle-tests:
-    name: Gradle Tests 2.1.20[${{ inputs.compiler_version }}]
+    name: Gradle Tests 2.1.20[${{ inputs.compiler_version || '2.1.20' }}]
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -116,7 +116,7 @@ jobs:
             "-Pmatrix.targets=macosArm64"
             "-Pmatrix.configurations=${{ inputs.configuration || 'debug' }}"
             "-Pmatrix.linkModes=${{ inputs.linkage || 'static' }}"
-            "-PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version }}]"
+            "-PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]"
           build-root-directory: test-runner
       - name: Publish Test Report
         uses: mikepenz/action-junit-report@v4
@@ -127,7 +127,7 @@ jobs:
           require_tests: true
   
   external-libraries-tests-0-499:
-    name: External Libraries Tests (2.1.20[${{ inputs.compiler_version }}]) 0-499
+    name: External Libraries Tests (2.1.20[${{ inputs.compiler_version || '2.1.20' }}]) 0-499
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -140,15 +140,15 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
           onlyIndices: "0-499"
   
   external-libraries-tests-500-999:
-    name: External Libraries Tests (2.1.20[${{ inputs.compiler_version }}]) 500-999
+    name: External Libraries Tests (2.1.20[${{ inputs.compiler_version || '2.1.20' }}]) 500-999
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -161,15 +161,15 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version || '2.1.20' }}]'
           build-root-directory: SKIE
         env:
           KOTLIN_LINK_MODE: ${{ inputs.linkage }}
           KOTLIN_BUILD_CONFIGURATION: ${{ inputs.configuration }}
           onlyIndices: "500-999"
   
   external-libraries-tests-1000-1499:
-    name: External Libraries Tests (2.1.20[${{ inputs.compiler_version }}]) 1000-1499
+    name: External Libraries Tests (2.1.20[${{ inputs.compiler_version || '2.1.20' }}]) 1000-1499
     runs-on: self-hosted
     steps:
       - name: Checkout Repo
@@ -182,15 +182,15 @@ jobs:
       - name: Run External Libraries Tests
         uses: gradle/gradle-build-action@v2.4.2
         with:
-          arguments: ':acceptance-tests:libraries:test -PversionSupport.kotlin.enabledVersions=2.1.20[${{ inputs.compiler_version }}]'
+          arguments: ':acceptance-tests:libraries:test -PversionSuppor
```

---

### Incident Patch 15: `75c3d88f` (2025-11-10)
**Commit Message**: Fix env properties for publishing.

**File**: `.github/workflows/publish-plugin.yaml` (modified, +2/-2)
```diff
@@ -36,7 +36,7 @@ jobs:
           arguments: 'publishToMavenCentral'
           build-root-directory: SKIE
         env:
-          ORG_GRADLE_PROJECT_sonatypeUsername: ${{ secrets.SONATYPE_NEXUS_USERNAME }}
-          ORG_GRADLE_PROJECT_sonatypePassword: ${{ secrets.SONATYPE_NEXUS_PASSWORD }}
+          ORG_GRADLE_PROJECT_mavenCentralUsername: ${{ secrets.SONATYPE_NEXUS_USERNAME }}
+          ORG_GRADLE_PROJECT_mavenCentralPassword: ${{ secrets.SONATYPE_NEXUS_PASSWORD }}
           ORG_GRADLE_PROJECT_signingKey: ${{ secrets.SIGNING_KEY }}
           ORG_GRADLE_PROJECT_signingPassword: ""
```

#### Recent Merged Pull Requests:
- **PR #203** (closed): Propagate Kotlin KDoc to generated Swift declarations (@Sharang-1)
- **PR #202** (2026-09-25): Kotlin 2.4.20 support (@carlonzo)
- **PR #201** (2026-07-21): Allow Skie to run with Kotlin 2.4.10 (@carlonzo)
- **PR #198** (2026-07-13): Fix configuration cache serialization of the Swift source set (@C2H6O)
- **PR #196** (2026-07-13): Improve support for isolated projects (@OndraBasler)
- **PR #194** (2026-06-24): Kotlin 2.4.0 support (@TadeasKriz)
- **PR #193** (closed): Add support for Kotlin 2.4.0 (@DevSrSouza)
- **PR #192** (2026-07-15): Allowing to enable animations within Observing and Collect into (@faogustavo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
