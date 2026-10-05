# Forensic Learning Record (Deep Inspection): yshrsmz/BuildKonfig

> **Canonical Artifact**: `07_PROJECT_LEARNING/yshrsmz-buildkonfig-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/yshrsmz/BuildKonfig](https://github.com/yshrsmz/BuildKonfig))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:20:57.710Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `yshrsmz/BuildKonfig`
- **Description**: BuildConfig for Kotlin Multiplatform Project
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1217 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #320** (2026-05-20): **generateBuildKonfig is failling**
  *Symptoms*: **Describe the bug** After upgrade to latest 0.21.1 version I am getting this error: ``` FAILURE: Build failed with an exception.  * What went wrong: A problem was found with the configuration of task ':configuration:prepareAndroidMainArtProfile' (type 'ProcessLibraryArtProfileTask').   - Gradle detected a problem with the following location: '......../build/generated/source/buildkonfig/baselineProfiles/baseline-prof.txt'.          Reason: Task ':configuration:prepareAndroidMainArtProfile' uses this output of task ':configuration:generateBuildKonfig' without declaring an explicit or implicit dependency. This can lead to incorrect results being produced, depending on what order the tasks are executed.          Possible solutions:       1. Declare task ':configuration:generateBuildKonfig' as an input of ':configuration:prepareAndroidMainArtProfile'.       2. Declare an explicit dependency on ':configuration:generateBuildKonfig' from ':configuration:prepareAndroidMainArtProfile' using Task#dependsOn.       3. Declare an explicit dependency on ':configuration:generateBuildKonfig' from ':configuration:prepareAndroidMainArtProfile' using Task#mustRunAfter.          For more information, please refer to https://docs.gradle.org/9.5.1/userguide/validation_problems.html#implicit_dependency in the Gradle documentation. ```  **To Reproduce** Upgrade to 0.21.1 run `assembleAndroidMain`  **Expected behavior** Finish successfully  **Screenshots**   **Desktop (please complete the following i
  **Post-Mortem & Fix Analysis**:
  > @Link184 v0.21.2 is out with the fix for this issue. Check it out and let me know if you find any issues. https://github.com/yshrsmz/BuildKonfig/releases/tag/v0.21.2
  > @yshrsmz thank you for your quick fix. Everything works like a charm now :)

- **Issue #317** (2026-05-19): **[Bug] Implicit dependency error with AGP 9.0 on prepareAndroidMainArtProfile task**
  *Symptoms*: **Describe the bug** When building a Kotlin Multiplatform project using Android Gradle Plugin (AGP) 9.0, Gradle throws an implicit dependency error and aborts the build. The issue occurs because the new AGP 9 task :shared:prepareAndroidMainArtProfile (ProcessLibraryArtProfileTask) attempts to read the output directory of the :shared:generateBuildKonfig task without an explicit task dependency declared. Due to Gradle 8.x strict validation rules, this race condition causes a build failure.  **To Reproduce** Having a KMP project with AGP 9.0+ applied. Snippet of build.gradle.kts in the shared module:  ``` plugins {     kotlin("multiplatform")     id("com.android.library")     id("com.codingfeline.buildkonfig") }  buildkonfig {     packageName = "com.kippapp.shared"     defaultConfigs {         buildConfigField("STRING", "BASE_URL", "\"https://api.example.com\"")     } } ```  Run the build command: ./gradlew assemble or try to build the project via Fastlane.  **Expected behavior** The build should complete successfully. BuildKonfig should properly register its task outputs with the new AGP 9.0 tasks to avoid implicit dependency conflicts.  **Screenshots** ``` A problem was found with the configuration of task ':shared:prepareAndroidMainArtProfile' (type 'ProcessLibraryArtProfileTask').   - Gradle detected a problem with the following location: '/.../KippApp/shared/build/buildkonfig/baselineProfiles'.   Reason: Task ':shared:prepareAndroidMainArtProfile' uses this output of task '
  **Post-Mortem & Fix Analysis**:
  > @gitdaniellopes v0.21.1 is out with the fix for this issue. Check it out and let me know if you find any issues. https://github.com/yshrsmz/BuildKonfig/releases/tag/v0.21.1
  >   Hi! I updated to v0.21.1 but the issue is still happening on release builds (assembleRelease). It seems the fix changed the   output directory but didn't fully resolve the implicit dependency.      Error:   Task ':shared:prepareAndroidMainArtProfile' uses this output of task ':shared:generateBuildKonfig' without declaring an   explicit or implicit dependency.      Location: '.../shared/build/generated/source/buildkonfig/baselineProfiles'    Notes:       - assembleDebug passes without issues   - assembleRelease fails consistently without the workaround   - The path changed from build/buildkonfig/baselineProfiles (v0.21.0) to build/generated/source/buildkonfig/baselineProfiles   (v0.21.1), but the implicit dependency error persists   - Still need the dependsOn workaround to get release builds working  I checked PR #318 — the fix moves the output to build/generated/source/buildkonfig/, which is exactly what v0.21.1 ships.   However, in our project the error now points to the new path:  
  > @gitdaniellopes hi, can you try v0.21.2?

- **Issue #78** (2023-08-21): **Plugin generates invalid class so build fails**
  *Symptoms*: Hi. During first build, plugin generates expect object BuildKonfig (commonMain) and actual object BuildKonfig (androidMain+jvmMain) and everything works fine. But during second build (without any changes) it regenerates expect object in commonMain to actual object so build fails due to missing expect object and redeclaration of actual objects. Below is part of my build.gradle file.  ``` apply plugin: 'org.jetbrains.kotlin.multiplatform' apply plugin: 'com.android.library' apply plugin: 'com.codingfeline.buildkonfig'  kotlin {         android {             compilations.all {                 kotlinOptions.jvmTarget = rootProject.ext.javaVersion             }         }         jvm()          sourceSets {             all {                 languageSettings {                     optIn("kotlinx.coroutines.ExperimentalCoroutinesApi")                     optIn("kotlin.RequiresOptIn")                 }             }              commonMain {}             jvmMain {}             androidMain {}             androidRc {}             androidRelease {}         } }  buildkonfig {         packageName = project.PACKAGE          defaultConfigs {               buildConfigField "BOOLEAN", "ABC", "true", const: true         }          targetConfigs {             android {                 buildConfigField "BOOLEAN", "ABC", "true", const: true             }              jvm {                 buildConfigField "BOOLEAN", "ABC", "false", const: true          
  **Post-Mortem & Fix Analysis**:
  > @MichalKlusak Which Kotlin version are you using? Also, simple repro is greatly appreciated
  > I have the similar problem. When I compile the first time my project the class is generated with internal object InjectedConfig which is fine (InjectedConfig is the name i have configured for the object)  ![image](https://github.com/yshrsmz/BuildKonfig/assets/32062450/eb7fb949-9523-4f22-b0af-a01c9b09daba)   I'm using kotlin 1.7.22, jdk 11, gradle 7.5.1 (I have enable the configuration-cache feature) And when I'm running incremental builds, (sometimes) it re-generates the class with the 'actual' keyword. ("internal actual object InjectedConfig") If I'm running my build with gradlew build --no-configuration-cache, it seems to regenerates the class properly.  Hope it will help you with the investigation for the potential bug fix. 
  > I've managed to fix this by removing `org.gradle.unsafe.configuration-cache=true` from the `gradle.properties`

- **Issue #60** (2021-10-18): **Java version compatibility **
  *Symptoms*: It'd seem that since `0.10.1` the java compatibility has been broken.   ``` Kotlin: 1.5.30 Gradle: 7.2 BuildKonfig: since 0.10.1 Gradle JVM : 1.8 ```
  **Post-Mortem & Fix Analysis**:
  > It's most likely because I upgraded my local/CI JDK to 11 to use Android Gradle Plugin v7.  I wonder if setting `sourceCompatibility` and `targetCompatibility` to `1.8` work. I'll do that in the next release.  Or would you like to send a PR? Then I can cut a patch release with that.
  > hi v0.11.0 is out with the above modifications. Please let me know if we need further action. Thanks!

- **Issue #56** (2021-10-01): **BuildKonfig `0.9.0` -> `0.10.0` breaks Gradle Sync**
  *Symptoms*: Thanks for **BuildKonfig**, it continues to be an essential tool for KMP App Development! ❤️  I was happy to see continued maintenance with a `0.10.0` release:  Unfortunately, this new version has a bug for my project. Gradle Sync fails with the error: ``` Duplicate content roots detected: Path [/Users/me/project/client/build/buildkonfig/commonMain] of module  [project.client.commonMain] was removed from modules [project.client.materialComposeMain] ``` _(I've redacted my actual username and project name but the pattern is preserved)_ This prevents working with the project.  If I change only the **BuildKonfig** dependency back to `0.9.0`, everything works as expected.  My project has quite a nested module structure; perhaps you've changed some code related to adding source-set paths to modules that has caused it to add to multiple source-sets unnecessarily?
  **Post-Mortem & Fix Analysis**:
  > Hi,  Indeed I changed the source-sets registration logic in 0.10.0.  [`v0.9.0...v0.10.1`#diff-dd276d30d4](https://github.com/yshrsmz/BuildKonfig/compare/v0.9.0...v0.10.1#diff-dd276d30d4f21d6e0aefb7855c6711d86a1f4a29eb2f0a7ad80e7798ea07e2f6)  Previously the plugin explicitly obtained `commonMain` source-sets and registered common buildkonfig source-set, but now it adds the dependency when the target is `KotlinMetadataTarget` which is common code target.  I thought there's only one `KotlinMetadataTarget` in a single KMP module, but looks like it was wrong.  It seems like `materialComposeMain` is also a `KotlinMetadataTarget`, so we should also check target's name.  Can you provide your targets & sourceSets configuration in `client` module's `build.gradle`? I'd like to see how each source-sets are depending to each other.  (Thanks for sponsoring me btw! It means a lot to me.)
  > Hi, thanks for your reply; my source sets dependencies (this is within a **single module**) look like this:  <img src="https://user-images.githubusercontent.com/895683/135465765-0a1aa2ea-97ec-49e8-ac6e-c85a638976f4.png" width=400 />  So far in KMP it has probably been less common to have these intermediary source-sets (here being `materialComposeMain`); but it will certainly become more common in the near future, as [Compose/Multiplatform](https://github.com/jetbrains/compose-jb) gains more use (this is what I am using now).  Also, JetBrains do show some examples of setting up source-sets like this in their KMP introductory material; just to show off the possibilities.  [See the source-set configurations discussed here](https://kotlinlang.org/docs/mpp-share-on-platforms.html).
  > I had a look at the relevant code change that you linked to; and see that your intent was to remove reliance on the exact name `commonMain`, which is of course a good idea 👍   Yes, now we see that `commonMain` isn't the only `KotlinMetadataTarget`.  Probably an effective strategy would be to further filter the list of `KotlinMetadataTarget`s to find the one which has **no parent** i.e. is the **root** (I'm not sure how easily that's modeled to filter on; but I think it should be trivial enough).  By the way, you might consider using a `single` operator in Kotlin to ensure we have one root.  Pseudo-code like `singleOrNull { it.hasNoParent() } ?: throw Exception("This source-set configuration is not supported yet.")`

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

### Incident Patch 1: `2ca4927c` (2026-09-19)
**Commit Message**: fix: suppress compiler warnings in generated code (#366)

**File**: `buildkonfig-compiler/src/main/kotlin/com/codingfeline/buildkonfig/compiler/generator/BuildKonfigGenerator.kt` (modified, +29/-3)
```diff
@@ -16,10 +16,12 @@ abstract class BuildKonfigGenerator(
     val objectAnnotations: List<AnnotationSpec>,
     val objectModifiers: List<KModifier>,
     val propertyModifiers: List<KModifier>,
-    val logger: BuildKonfigLogger
+    val logger: BuildKonfigLogger,
+    val fileSuppressions: List<String> = listOf(REDUNDANT_VISIBILITY_MODIFIER)
 ) {
     fun generateFile(packageName: String, objectName: String): FileSpec {
         val builder = FileSpec.builder(packageName, objectName)
+        builder.addAnnotation(suppressAnnotation(fileSuppressions))
         builder.addType(generateType(objectName))
         return builder.build()
     }
@@ -40,6 +42,18 @@ abstract class BuildKonfigGenerator(
     abstract fun generateProp(fieldSpec: FieldSpec): PropertySpec
 
     companion object {
+        /**
+         * KotlinPoet always emits an explicit `public` modifier, which the Kotlin compiler reports
+         * as a warning once `extraWarnings` is enabled.
+         */
+        private const val REDUNDANT_VISIBILITY_MODIFIER = "REDUNDANT_VISIBILITY_MODIFIER"
+
+        /**
+         * `expect`/`actual` objects are still in Beta and warned about on every use.
+         */
+        private const val EXPECT_ACTUAL_CLASSIFIERS_ARE_IN_BETA =
+            "EXPECT_ACTUAL_CLASSIFIERS_ARE_IN_BETA_WARNING"
+
         /**
          * Generate common object
          */
@@ -85,7 +99,8 @@ abstract class BuildKonfigGenerator(
                 objectAnnotations = emptyList(),
                 objectModifiers = objectModifiers,
                 propertyModifiers = emptyList(),
-                logger = logger
+                logger = logger,
+                fileSuppressions = listOf(REDUNDANT_VISIBILITY_MODIFIER, EXPECT_ACTUAL_CLASSIFIERS_ARE_IN_BETA)
             ) {
                 override fun generateProp(fieldSpec: FieldSpec): PropertySpec {
                     return PropertySpec.builder(fieldSpec.name, fieldSpec.typeName)
@@ -110,7 +125,8 @@ abstract class BuildKonfigGenerator(
                 objectAnnotations = annotations,
                 objectModifiers = objectModifiers,
                 propertyModifiers = listOf(KModifier.ACTUAL),
-                logger = logger
+                logger = logger,
+                fileSuppressions = listOf(REDUNDANT_VISIBILITY_MODIFIER, EXPECT_ACTUAL_CLASSIFIERS_ARE_IN_BETA)
             ) {
                 override fun generateProp(fieldSpec: FieldSpec): PropertySpec {
                     val spec = PropertySpec.builder(fieldSpec.name, fieldSpec.typeName)
@@ -134,6 +150,16 @@ abstract class BuildKonfigGenerator(
 private fun getVisibilityModifier(exposeObject: Boolean): KModifier =
     if (exposeObject) KModifier.PUBLIC else KModifier.INTERNAL
 
+/**
+ * Generated code is not meant to be hand-edited, so warnings it inevitably triggers are suppressed
+ * at the file level. Without this, projects using `allWarningsAsErrors` fail to compile.
+ */
+private fun suppressAnnotation(names: List<String>): AnnotationSpec =
+    AnnotationSpec.builder(ClassName("kotlin", "Suppress"))
+        .useSiteTarget(AnnotationSpec.UseSiteTarget.FILE)
+        .apply { names.forEach { addMember("%S", it) } }
+        .build()
+
 private fun getJsObjectAnnotations(): List<AnnotationSpec> {
     return listOf(
         AnnotationSpec.builder(ClassName("kotlin.js", "JsExport")).build(),
```

**File**: `buildkonfig-gradle-plugin/src/test/kotlin/com/codingfeline/buildkonfig/gradle/BuildKonfigPluginExtraWarningsTest.kt` (added, +101/-0)
```diff
@@ -0,0 +1,101 @@
+package com.codingfeline.buildkonfig.gradle
+
+import com.google.common.truth.Truth.assertThat
+import org.junit.Test
+
+/**
+ * Regression tests for https://github.com/yshrsmz/BuildKonfig/issues/365 — generated code must not
+ * emit Kotlin `extraWarnings` diagnostics, which break builds using `allWarningsAsErrors`.
+ */
+class BuildKonfigPluginExtraWarningsTest : BaseGradlePluginTest() {
+
+    override val buildFileName: String = "build.gradle.kts"
+
+    private val buildFileHeader = buildFileHeaderKts("kotlin-multiplatform")
+
+    private val strictCompilerOptions = """
+        |  compilerOptions {
+        |    extraWarnings.set(true)
+        |    allWarningsAsErrors.set(true)
+        |  }
+    """.trimMargin()
+
+    @Test
+    fun `common object compiles with extraWarnings and allWarningsAsErrors`() {
+        buildFile.writeText(
+            """
+            |import com.codingfeline.buildkonfig.compiler.FieldSpec.Type
+            |$buildFileHeader
+            |
+            |buildkonfig {
+            |   packageName = "com.example"
+            |
+            |   defaultConfigs {
+            |       buildConfigField(Type.STRING, "VERSION_NAME", "1.0.0", const = true)
+            |       buildConfigField(Type.INT, "VERSION_CODE", "42")
+            |       buildConfigField(Type.STRING, "OPTIONAL", null, nullable = true)
+            |   }
+            |}
+            |
+            |kotlin {
+            |  jvm()
+            |$strictCompilerOptions
+            |}
+            """.trimMargin()
+        )
+
+        val buildDir = projectDir.buildKonfigDir()
+
+        gradleRunner(projectDir)
+            .withArguments("compileKotlinJvm", "--stacktrace")
+            .build()
+            .assertBuildSuccessful()
+
+        val content = buildKonfigFile(buildDir, "commonMain", "com.example").readText()
+        assertThat(content).contains("REDUNDANT_VISIBILITY_MODIFIER")
+    }
+
+    @Test
+    fun `expect and actual objects compile with extraWarnings and allWarningsAsErrors`() {
+        buildFile.writeText(
+            """
+            |import com.codingfeline.buildkonfig.compiler.FieldSpec.Type
+            |$buildFileHeader
+            |
+            |buildkonfig {
+            |   packageName = "com.example"
+            |   exposeObjectWithName = "ExposedBuildKonfig"
+            |
+            |   defaultConfigs {
+            |       buildConfigField(Type.STRING, "name", "defaultValue")
+            |   }
+            |   targetConfigs {
+            |       create("jvm") {
+            |           buildConfigField(Type.STRING, "name", "jvmValue")
+            |       }
+            |   }
+            |}
+            |
+            |kotlin {
+            |  jvm()
+            |$strictCompilerOptions
+            |}
+            """.trimMargin()
+        )
+
+        val buildDir = projectDir.buildKonfigDir()
+
+        gradleRunner(projectDir)
+            .withArguments("compileKotlinJvm", "--stacktrace")
+            .build()
+            .assertBuildSuccessful()
+
+        listOf("commonMain", "jvmMain").forEach { sourceSet ->
+            val content = buildKonfigFile(buildDir, sourceSet, "com.example", "ExposedBuildKonfig").readText()
+            assertThat(content).apply {
+                contains("REDUNDANT_VISIBILITY_MODIFIER")
+                contains("EXPECT_ACTUAL_CLASSIFIERS_ARE_IN_BETA_WARNING")
+            }
+        }
+    }
+}
```

**File**: `buildkonfig-gradle-plugin/src/test/kotlin/com/codingfeline/buildkonfig/gradle/BuildKonfigPluginFlavorTest.kt` (modified, +3/-0)
```diff
@@ -74,9 +74,12 @@ class BuildKonfigPluginFlavorTest : BaseGradlePluginTest() {
         assertThat(commonResult.readText())
             .isEqualTo(
                 """
+                |@file:Suppress("REDUNDANT_VISIBILITY_MODIFIER")
+                |
                 |package com.example
                 |
                 |import kotlin.String
+                |import kotlin.Suppress
                 |
                 |internal object BuildKonfig {
                 |  public val stringValue: String = "defaultValue"
```

---

### Incident Patch 2: `b167e341` (2026-09-19)
**Commit Message**: fix(deps): update dependency com.android.tools.build:gradle to v9.4.1 (#364)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 [versions]
 kotlin = "2.4.20"
 dokka = "2.2.0"
-android = "9.4.0"
+android = "9.4.1"
 ksp = "2.3.12"
 
 [libraries]
```

---

### Incident Patch 3: `0cc85642` (2026-09-10)
**Commit Message**: fix(deps): update kotlin monorepo to v2.4.20 (#356)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 [versions]
-kotlin = "2.4.10"
+kotlin = "2.4.20"
 dokka = "2.2.0"
 android = "9.4.0"
 ksp = "2.3.12"
```

---

### Incident Patch 4: `beeccb6f` (2026-09-10)
**Commit Message**: fix(deps): update dependency com.google.devtools.ksp:symbol-processing-gradle-plugin to v2.3.12 (#359)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 kotlin = "2.4.10"
 dokka = "2.2.0"
 android = "9.4.0"
-ksp = "2.3.11"
+ksp = "2.3.12"
 
 [libraries]
 kotlinpoet = { module = "com.squareup:kotlinpoet", version = "2.4.0" }
```

---

### Incident Patch 5: `3f1b2bf7` (2026-09-10)
**Commit Message**: fix(deps): update dependency com.squareup:kotlinpoet to v2.4.0 (#357)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ android = "9.4.0"
 ksp = "2.3.11"
 
 [libraries]
-kotlinpoet = { module = "com.squareup:kotlinpoet", version = "2.3.0" }
+kotlinpoet = { module = "com.squareup:kotlinpoet", version = "2.4.0" }
 junit = { module = "junit:junit", version = "4.13.2" }
 truth = { module = "com.google.truth:truth", version = "1.4.5" }
 
```

---

### Incident Patch 6: `a45fbe21` (2026-09-03)
**Commit Message**: fix(deps): update dependency com.android.tools.build:gradle to v9.4.0 (#355)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>
Co-authored-by: Yasuhiro SHIMIZU <[REDACTED_EMAIL]>

**File**: `buildkonfig-gradle-plugin/src/test/kotlin/com/codingfeline/buildkonfig/gradle/BuildKonfigPluginAgpBaselineProfileTest.kt` (modified, +3/-3)
```diff
@@ -75,10 +75,10 @@ class BuildKonfigPluginAgpBaselineProfileTest : BaseGradlePluginTest() {
         val result = gradleRunner(projectDir)
             // Pin to a Gradle 9.x release so the strict input/output overlap validation
             // (the rule whose absence this test is guarding against) is always exercised
-            // regardless of the runtime Gradle TestKit happens to default to. AGP 9.3.x
+            // regardless of the runtime Gradle TestKit happens to default to. AGP 9.4.x
             // — the version used by this fixture's `com.android.kotlin.multiplatform.library`
-            // plugin — requires Gradle 9.5.0 or newer, so we pin to 9.5.0.
-            .withGradleVersion("9.5.0")
+            // plugin — requires Gradle 9.6.0 or newer, so we pin to 9.6.0.
+            .withGradleVersion("9.6.0")
             .withArguments("assembleAndroidMain", "--stacktrace")
             .build()
             .assertBuildSuccessful()
```

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 [versions]
 kotlin = "2.4.10"
 dokka = "2.2.0"
-android = "9.3.2"
+android = "9.4.0"
 ksp = "2.3.11"
 
 [libraries]
```

---

### Incident Patch 7: `9722fea3` (2026-08-24)
**Commit Message**: fix(deps): update dependency com.android.tools.build:gradle to v9.3.2 (#353)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 [versions]
 kotlin = "2.4.10"
 dokka = "2.2.0"
-android = "9.3.1"
+android = "9.3.2"
 ksp = "2.3.11"
 
 [libraries]
```

---

### Incident Patch 8: `2e64b71a` (2026-08-07)
**Commit Message**: fix(deps): update dependency com.google.devtools.ksp:symbol-processing-gradle-plugin to v2.3.11 (#350)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 kotlin = "2.4.10"
 dokka = "2.2.0"
 android = "9.3.1"
-ksp = "2.3.10"
+ksp = "2.3.11"
 
 [libraries]
 kotlinpoet = { module = "com.squareup:kotlinpoet", version = "2.3.0" }
```

---

### Incident Patch 9: `a1ddd295` (2026-07-24)
**Commit Message**: fix(deps): update dependency com.android.tools.build:gradle to v9.3.1 (#346)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 [versions]
 kotlin = "2.4.10"
 dokka = "2.2.0"
-android = "9.3.0"
+android = "9.3.1"
 ksp = "2.3.10"
 
 [libraries]
```

---

### Incident Patch 10: `d1804079` (2026-07-17)
**Commit Message**: fix(deps): update dependency com.android.tools.build:gradle to v9.3.0 (#343)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>
Co-authored-by: Yasuhiro SHIMIZU <[REDACTED_EMAIL]>

**File**: `buildkonfig-gradle-plugin/src/test/kotlin/com/codingfeline/buildkonfig/gradle/BuildKonfigPluginAgpBaselineProfileTest.kt` (modified, +3/-3)
```diff
@@ -75,10 +75,10 @@ class BuildKonfigPluginAgpBaselineProfileTest : BaseGradlePluginTest() {
         val result = gradleRunner(projectDir)
             // Pin to a Gradle 9.x release so the strict input/output overlap validation
             // (the rule whose absence this test is guarding against) is always exercised
-            // regardless of the runtime Gradle TestKit happens to default to. AGP 9.2.x
+            // regardless of the runtime Gradle TestKit happens to default to. AGP 9.3.x
             // — the version used by this fixture's `com.android.kotlin.multiplatform.library`
-            // plugin — requires Gradle 9.4.1 or newer, so we pin to 9.4.1.
-            .withGradleVersion("9.4.1")
+            // plugin — requires Gradle 9.5.0 or newer, so we pin to 9.5.0.
+            .withGradleVersion("9.5.0")
             .withArguments("assembleAndroidMain", "--stacktrace")
             .build()
             .assertBuildSuccessful()
```

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 [versions]
 kotlin = "2.4.10"
 dokka = "2.2.0"
-android = "9.2.1"
+android = "9.3.0"
 ksp = "2.3.10"
 
 [libraries]
```

---

### Incident Patch 11: `6c1ff7b7` (2026-07-17)
**Commit Message**: fix(deps): update kotlin monorepo to v2.4.10 (#342)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 [versions]
-kotlin = "2.4.0"
+kotlin = "2.4.10"
 dokka = "2.2.0"
 android = "9.2.1"
 ksp = "2.3.10"
```

---

### Incident Patch 12: `d3f11f38` (2026-07-10)
**Commit Message**: fix(deps): update dependency com.google.devtools.ksp:symbol-processing-gradle-plugin to v2.3.10 (#340)

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 kotlin = "2.4.0"
 dokka = "2.2.0"
 android = "9.2.1"
-ksp = "2.3.9"
+ksp = "2.3.10"
 
 [libraries]
 kotlinpoet = { module = "com.squareup:kotlinpoet", version = "2.3.0" }
```

---

### Incident Patch 13: `b5064523` (2026-05-27)
**Commit Message**: fix(deps): update dependency com.google.devtools.ksp:symbol-processing-gradle-plugin to v2.3.9 (#324)

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ gradle = "9.4.1"
 kotlin = "2.3.21"
 dokka = "2.2.0"
 android = "9.2.1"
-ksp = "2.3.8"
+ksp = "2.3.9"
 
 [libraries]
 kotlinpoet = { module = "com.squareup:kotlinpoet", version = "2.3.0" }
```

---

### Incident Patch 14: `ab5652bf` (2026-05-20)
**Commit Message**: fix(plugin): scope BuildKonfigTask outputs to per-source-set leaves (#321)

Co-authored-by: Claude Opus 4.7 (1M context) <[REDACTED_EMAIL]>

**File**: `buildkonfig-gradle-plugin/src/main/kotlin/com/codingfeline/buildkonfig/gradle/BuildKonfigPlugin.kt` (modified, +12/-2)
```diff
@@ -121,10 +121,19 @@ abstract class BuildKonfigPlugin : Plugin<Project> {
             t.hasJsTarget.set(hasJsTarget)
             t.commonSourceSetName.set(COMMON_SOURCESET_NAME)
             t.targetConfigFiles.set(targetConfigSources.mapValues { (_, value) -> value.configFile })
+            // Populate per-source-set `@OutputDirectories` so each leaf — not the shared
+            // root — participates in cache-key snapshotting and task dependency inference.
+            targetConfigSources.keys.forEach { key ->
+                t.outputDirectories.put(key, t.outputDirectory.dir(key))
+            }
         }
 
         targetConfigSources.forEach { (key, configSource) ->
-            configSource.registerSourceDir(task.flatMap { it.outputDirectory.dir(key) })
+            // Route srcDir registration through `outputDirectories` (the tracked
+            // `@OutputDirectories` map) — not the `@Internal` root — so the Provider
+            // chain into the Kotlin source set carries the implicit task dependency
+            // that Gradle 9.x's strict validation requires.
+            configSource.registerSourceDir(task.flatMap { it.outputDirectories.getting(key) })
         }
     }
 
@@ -175,10 +184,11 @@ abstract class BuildKonfigPlugin : Plugin<Project> {
             t.hasJsTarget.set(platformType == KotlinPlatformType.js)
             t.commonSourceSetName.set(MAIN_SOURCESET_NAME)
             t.targetConfigFiles.set(mapOf(MAIN_SOURCESET_NAME to targetConfigFile))
+            t.outputDirectories.put(MAIN_SOURCESET_NAME, t.outputDirectory.dir(MAIN_SOURCESET_NAME))
         }
 
         val mainSourceSet = kotlinExtension.sourceSets.getByName(MAIN_SOURCESET_NAME)
-        mainSourceSet.kotlin.srcDir(task.flatMap { it.outputDirectory.dir(MAIN_SOURCESET_NAME) })
+        mainSourceSet.kotlin.srcDir(task.flatMap { it.outputDirectories.getting(MAIN_SOURCESET_NAME) })
     }
 }
 
```

**File**: `buildkonfig-gradle-plugin/src/main/kotlin/com/codingfeline/buildkonfig/gradle/BuildKonfigTask.kt` (modified, +33/-12)
```diff
@@ -7,13 +7,15 @@ import com.codingfeline.buildkonfig.compiler.TargetConfig
 import com.codingfeline.buildkonfig.compiler.TargetConfigFile
 import com.codingfeline.buildkonfig.compiler.TargetName
 import org.gradle.api.DefaultTask
+import org.gradle.api.file.Directory
 import org.gradle.api.file.DirectoryProperty
 import org.gradle.api.provider.MapProperty
 import org.gradle.api.provider.Property
 import org.gradle.api.tasks.CacheableTask
 import org.gradle.api.tasks.Input
+import org.gradle.api.tasks.Internal
 import org.gradle.api.tasks.Nested
-import org.gradle.api.tasks.OutputDirectory
+import org.gradle.api.tasks.OutputDirectories
 import org.gradle.api.tasks.TaskAction
 import java.io.File
 
@@ -55,30 +57,49 @@ abstract class BuildKonfigTask : DefaultTask() {
     abstract val targetConfigFiles: MapProperty<String, TargetConfigInput>
 
     /**
-     * Root directory containing all generated BuildKonfig sources, with one subdirectory
-     * per source set (e.g. `build/generated/source/buildkonfig/commonMain`,
-     * `build/generated/source/buildkonfig/jvmMain`).
-     * Declared as a single `@OutputDirectory` so the entire subtree participates in the
-     * cache key / restore cycle, and stale subdirectories from removed source sets
-     * cannot leak through.
+     * Root directory beneath which per-source-set outputs live. Declared `@Internal`
+     * (not an output) because AGP 9+ `prepareAndroidMainArtProfile`
+     * (`ProcessLibraryArtProfileTask`) probes `<root>/baselineProfiles/baseline-prof.txt`
+     * for each generated source root it inherits from the Kotlin source set. If the
+     * root itself were an `@OutputDirectory`, Gradle's strict input/output overlap
+     * validation would reject the build with an "implicit dependency" error from
+     * `prepareAndroidMainArtProfile` to this task. The actual outputs are tracked via
+     * [outputDirectories], which list only the per-source-set leaves.
      */
-    @get:OutputDirectory
+    @get:Internal
     abstract val outputDirectory: DirectoryProperty
 
+    /**
+     * Per-source-set output directories — one entry per source set the merged config
+     * resolves to (e.g. `build/generated/source/buildkonfig/commonMain`,
+     * `.../jvmMain`). Each leaf matches the Kotlin source set's registered `srcDir`,
+     * and is the cache-key + task-dependency surface for downstream consumers
+     * (KSP, baseline profiles, ...).
+     */
+    @get:OutputDirectories
+    abstract val outputDirectories: MapProperty<String, Directory>
+
     @Suppress("unused")
     @TaskAction
     fun generateBuildKonfigFiles() {
-        // Gradle does not auto-clean `@OutputDirectory` content for ad-hoc tasks, so we
-        // wipe the root explicitly. On cache hits the action does not run and Gradle
-        // performs the cleanup + restore itself.
+        // Wipe the entire root so subdirectories from source sets that no longer appear in
+        // [outputDirectories] (e.g. a target the user just removed) don't linger. The root
+        // itself is `@Internal` — only the per-source-set leaves below participate in
+        // Gradle's cache key / restore cycle — so this cleanup must happen explicitly here.
+        //
+        // Limitation: on a build-cache hit this action does not run; Gradle restores only
+        // the declared per-leaf `@OutputDirectories`. Orphan subdirectories left over from
+        // a previous non-cached run for a since-removed source set will persist on disk in
+        // that case. `./gradlew clean` clears them.
         val outputRoot = outputDirectory.get().asFile
         outputRoot.deleteRecursively()
 
+        val outputs = outputDirectories.get()
         val commonName = commonSourceSetName.get()
         val resolvedConfigs = targetConfigFiles.get().mapValues { (name, input) ->
             ResolvedTargetConfigFile(
                 targetName = input.targetName,
-                outputDirectory = outputRoot.resolve(name),
+                outputDirectory = outputs.getValue(name).asFile,
                 config = input.config,
             )
         }
```

**File**: `buildkonfig-gradle-plugin/src/test/kotlin/com/codingfeline/buildkonfig/gradle/BuildKonfigPluginAgpBaselineProfileTest.kt` (added, +98/-0)
```diff
@@ -0,0 +1,98 @@
+package com.codingfeline.buildkonfig.gradle
+
+import com.google.common.truth.Truth.assertThat
+import org.gradle.testkit.runner.TaskOutcome
+import org.junit.Test
+
+/**
+ * Regression test for issue #320: AGP 9.0+ `prepareAndroidMainArtProfile`
+ * (`ProcessLibraryArtProfileTask`) probes `<generatedSourceRoot>/baselineProfiles/baseline-prof.txt`
+ * for every generated source directory it inherits from the Kotlin source set.
+ *
+ * The task's `@OutputDirectory` must therefore be scoped tightly enough that
+ * `<root>/baselineProfiles/...` is not considered an output of `generateBuildKonfig`,
+ * otherwise Gradle 9.x rejects the build with:
+ *
+ *     Task ':...:prepareAndroidMainArtProfile' uses this output of task
+ *     ':...:generateBuildKonfig' without declaring an explicit or implicit dependency.
+ */
+class BuildKonfigPluginAgpBaselineProfileTest : BaseGradlePluginTest() {
+
+    private val androidBuildFileHeader =
+        buildFileHeader("kotlin-multiplatform", "com.android.kotlin.multiplatform.library")
+
+    @Test
+    fun `prepareAndroidMainArtProfile does not fail with implicit dependency error`() {
+        buildFile.writeText(
+            """
+            |$androidBuildFileHeader
+            |
+            |buildkonfig {
+            |    packageName = "com.sample"
+            |
+            |    defaultConfigs {
+            |        buildConfigField 'STRING', 'test', 'hoge'
+            |    }
+            |}
+            |
+            |kotlin {
+            |   android {
+            |       compileSdk = 28
+            |       minSdk = 21
+            |       namespace = "com.sample"
+            |   }
+            |   jvm()
+            |   iosX64()
+            |
+            |   sourceSets {
+            |     commonMain {
+            |       dependencies {}
+            |     }
+            |     androidMain {
+            |       dependencies {}
+            |     }
+            |   }
+            |}
+            """.trimMargin()
+        )
+
+        createAndroidManifest(projectDir)
+
+        // Force `compileAndroidMain` to have something to compile, exercising the
+        // generateBuildKonfig → compileAndroidMain dependency edge through the
+        // androidMain Kotlin source set's srcDirs.
+        projectDir.newFolder("src", "androidMain", "kotlin")
+        projectDir.newFile("src/androidMain/kotlin/Sample.kt").writeText(
+            """
+            |package com.sample
+            |
+            |object Sample
+            """.trimMargin()
+        )
+
+        projectDir.buildKonfigDir()
+
+        val result = gradleRunner(projectDir)
+            // Pin to a Gradle 9.x release so the strict input/output overlap validation
+            // (the rule whose absence this test is guarding against) is always exercised
+            // regardless of the runtime Gradle TestKit happens to default to. AGP 9.2.x
+            // — the version used by this fixture's `com.android.kotlin.multiplatform.library`
+            // plugin — requires Gradle 9.4.1 or newer, so we pin to 9.4.1.
+            .withGradleVersion("9.4.1")
+            .withArguments("assembleAndroidMain", "--stacktrace")
+            .build()
+            .assertBuildSuccessful()
+
+        // The exact validation error message from Gradle 9.x must not surface.
+        assertThat(result.output)
+            .doesNotContain("without declaring an explicit or implicit dependency")
+        // generateBuildKonfig must have actually been included in the task graph
+        // (i.e. its srcDir is correctly wired into the androidMain Kotlin source set).
+        val outcome = result.task(":generateBuildKonfig")?.outcome
+        assertThat(outcome).isAnyOf(
+            TaskOutcome.SUCCESS,
+            TaskOutcome.FROM_CACHE,
+            TaskOutcome.UP_TO_DATE,
+        )
+    }
+}
```

**File**: `buildkonfig-gradle-plugin/src/test/kotlin/com/codingfeline/buildkonfig/gradle/BuildKonfigPluginConfigurationCacheTest.kt` (modified, +73/-0)
```diff
@@ -1,6 +1,7 @@
 package com.codingfeline.buildkonfig.gradle
 
 import com.google.common.truth.Truth.assertThat
+import org.gradle.testkit.runner.TaskOutcome
 import org.junit.Test
 
 class BuildKonfigPluginConfigurationCacheTest : BaseGradlePluginTest() {
@@ -74,4 +75,76 @@ class BuildKonfigPluginConfigurationCacheTest : BaseGradlePluginTest() {
 
         assertThat(secondRun.output).contains("Configuration cache entry reused")
     }
+
+    /**
+     * The task dependency edge from a downstream Kotlin compile task back to
+     * `generateBuildKonfig` flows through the `MapProperty.getting(key)` Provider chain
+     * registered on the Kotlin source set. This test exercises that chain end-to-end
+     * under `--configuration-cache` to catch any regression in CC serialization of
+     * `@OutputDirectories MapProperty<String, Directory>`.
+     */
+    @Test
+    fun `compileKotlinJvm exercises the source set Provider chain under Configuration Cache`() {
+        buildFile.writeText(
+            """
+            |$buildFileHeader
+            |
+            |buildkonfig {
+            |   packageName = "com.sample"
+            |
+            |   defaultConfigs {
+            |       buildConfigField 'STRING', 'test', 'hoge'
+            |   }
+            |}
+            |
+            |$buildFileKMPConfig
+            """.trimMargin()
+        )
+
+        // A dummy source so that compileKotlinJvm has something to compile, forcing the
+        // Provider chain from jvmMain.kotlin.srcDirs through to generateBuildKonfig to
+        // be walked when Gradle builds the task graph.
+        projectDir.newFolder("src", "jvmMain", "kotlin")
+        projectDir.newFile("src/jvmMain/kotlin/Sample.kt").writeText(
+            """
+            |package com.sample
+            |
+            |object Sample
+            """.trimMargin()
+        )
+
+        val runner = gradleRunner(projectDir)
+            .withGradleVersion("9.3.1")
+
+        val firstRun = runner
+            .withArguments(
+                "compileKotlinJvm",
+                "--configuration-cache",
+                "--configuration-cache-problems=fail",
+                "--stacktrace",
+            )
+            .build()
+            .assertBuildSuccessful()
+
+        assertThat(firstRun.output).contains("Configuration cache entry stored")
+        // generateBuildKonfig must be picked up as a transitive dependency of compileKotlinJvm.
+        assertThat(firstRun.task(":generateBuildKonfig")?.outcome).isEqualTo(TaskOutcome.SUCCESS)
+
+        val secondRun = runner
+            .withArguments(
+                "compileKotlinJvm",
+                "--configuration-cache",
+                "--configuration-cache-problems=fail",
+                "--stacktrace",
+            )
+            .build()
+            .assertBuildSuccessful()
+
+        assertThat(secondRun.output).contains("Configuration cache entry reused")
+        // On the second run the inputs are unchanged, so the task should be up-to-date.
+        assertThat(secondRun.task(":generateBuildKonfig")?.outcome).isAnyOf(
+            TaskOutcome.UP_TO_DATE,
+            TaskOutcome.FROM_CACHE,
+        )
+    }
 }
```

---

### Incident Patch 15: `0804a76e` (2026-05-19)
**Commit Message**: fix: move generated sources to build/generated/source/buildkonfig (#318)

**File**: `.claude/rules/testing.md` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ Do **not** import `com.google.common.truth.Truth` and call `Truth.assertThat(...
 
 ### Common scaffolding
 
-For Gradle TestKit-driven tests, extend `BaseGradlePluginTest` and rely on the helpers in `TestUtils.kt` (`gradleRunner()`, `TemporaryFolder.buildKonfigDir()`, `BuildResult.assertBuildSuccessful()`, `buildKonfigFile()`) instead of repeating the inlined `GradleRunner.create().withProjectDir(...).withPluginClasspath()` chain or `File(projectDir.root, "build/buildkonfig").also { it.deleteRecursively() }` pattern.
+For Gradle TestKit-driven tests, extend `BaseGradlePluginTest` and rely on the helpers in `TestUtils.kt` (`gradleRunner()`, `TemporaryFolder.buildKonfigDir()`, `BuildResult.assertBuildSuccessful()`, `buildKonfigFile()`) instead of repeating the inlined `GradleRunner.create().withProjectDir(...).withPluginClasspath()` chain or `File(projectDir.root, "build/generated/source/buildkonfig").also { it.deleteRecursively() }` pattern.
 
 ### Build script header
 
```

**File**: `buildkonfig-gradle-plugin/src/main/kotlin/com/codingfeline/buildkonfig/gradle/BuildKonfigPlugin.kt` (modified, +6/-1)
```diff
@@ -23,7 +23,12 @@ const val DEFAULT_FLAVOR: Flavor = ""
 const val COMMON_SOURCESET_NAME = "commonMain"
 const val MAIN_SOURCESET_NAME = "main"
 
-private const val OUTPUT_DIR_NAME = "buildkonfig"
+// Generated sources live under `build/generated/source/buildkonfig`, following the
+// convention shared by KSP, SQLDelight, and Apollo. The previous `build/buildkonfig`
+// location overlapped with paths AGP 9.0+ scans for baseline-profile inputs
+// (`prepareAndroidMainArtProfile`), causing Gradle's strict input/output overlap
+// validation to fail with an implicit-dependency error.
+private const val OUTPUT_DIR_NAME = "generated/source/buildkonfig"
 
 @Suppress("unused")
 abstract class BuildKonfigPlugin : Plugin<Project> {
```

**File**: `buildkonfig-gradle-plugin/src/main/kotlin/com/codingfeline/buildkonfig/gradle/BuildKonfigTask.kt` (modified, +2/-1)
```diff
@@ -56,7 +56,8 @@ abstract class BuildKonfigTask : DefaultTask() {
 
     /**
      * Root directory containing all generated BuildKonfig sources, with one subdirectory
-     * per source set (e.g. `build/buildkonfig/commonMain`, `build/buildkonfig/jvmMain`).
+     * per source set (e.g. `build/generated/source/buildkonfig/commonMain`,
+     * `build/generated/source/buildkonfig/jvmMain`).
      * Declared as a single `@OutputDirectory` so the entire subtree participates in the
      * cache key / restore cycle, and stale subdirectories from removed source sets
      * cannot leak through.
```

**File**: `buildkonfig-gradle-plugin/src/test/kotlin/com/codingfeline/buildkonfig/gradle/TestUtils.kt` (modified, +4/-3)
```diff
@@ -6,11 +6,12 @@ import org.gradle.testkit.runner.GradleRunner
 import org.junit.rules.TemporaryFolder
 import java.io.File
 
-const val BUILDKONFIG_BUILD_DIR = "build/buildkonfig"
+const val BUILDKONFIG_BUILD_DIR = "build/generated/source/buildkonfig"
 
 /**
- * Returns the (freshly cleaned) `build/buildkonfig` directory under [TemporaryFolder.getRoot].
- * Tests assert on files inside this directory, so they need a clean slate per run.
+ * Returns the (freshly cleaned) `build/generated/source/buildkonfig` directory under
+ * [TemporaryFolder.getRoot]. Tests assert on files inside this directory, so they need
+ * a clean slate per run.
  */
 fun TemporaryFolder.buildKonfigDir(): File =
     File(root, BUILDKONFIG_BUILD_DIR).also { it.deleteRecursively() }
```

#### Recent Merged Pull Requests:
- **PR #369** (2026-09-28): chore(deps): update gradle to v9.8.0 (@renovate[bot])
- **PR #368** (2026-09-19): docs: rewrite the release process for release-please (@yshrsmz)
- **PR #367** (2026-09-19): feat: fail fast on unsupported Gradle versions (@yshrsmz)
- **PR #366** (2026-09-19): fix: suppress compiler warnings in generated code (@yshrsmz)
- **PR #364** (2026-09-19): fix(deps): update dependency com.android.tools.build:gradle to v9.4.1 (@renovate[bot])
- **PR #363** (2026-09-17): chore(ci): drop version number from JDK setup step name (@yshrsmz)
- **PR #362** (2026-09-17): chore(deps): update dependency java-jdk to v25 (@renovate[bot])
- **PR #361** (2026-09-16): chore(deps): update dependency java-jdk to v17.0.20+101 (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
