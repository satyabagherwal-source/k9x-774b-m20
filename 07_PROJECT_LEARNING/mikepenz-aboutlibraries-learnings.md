# Forensic Learning Record (Deep Inspection): mikepenz/AboutLibraries

> **Canonical Artifact**: `07_PROJECT_LEARNING/mikepenz-aboutlibraries-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mikepenz/AboutLibraries](https://github.com/mikepenz/AboutLibraries))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:20:57.193Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mikepenz/AboutLibraries`
- **Description**: AboutLibraries automatically collects all dependencies and licenses of any gradle project (Kotlin MultiPlatform), and provides easy to integrate UI components for Android and Compose Multiplatform environments 
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4452 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `DEV/tools/LibsXMLGenerator.py`
```
#!/usr/bin/python
import sys


def main(argv):
    writeFile(argv[0], argv[1])

# not very elegant, but does the job


def writeFile(name, version):
    f = open("library_" + name.lower() + "_strings.xml", 'w')
    f.write("<?xml version=\"1.0\" encoding=\"utf-8\"?>\n")
    f.write("<resources> \n")
    f.write("	<string name=\"define_int_" + name + "\"></string>\n")
    f.write("	<!-- Author section -->\n")
    f.write("	<string name=\"library_" + name + "_author\"></string>\n")
    f.write("	<string name=\"library_" + name + "_authorWebsite\"></string>\n")
    f.write("	<!-- Library section -->\n")
    f.write("	<string name=\"library_" + name + "_libraryName\">" + name + "</string>\n")
    f.write("	<string name=\"library_" + name + "_libraryDescription\"></string>\n")
    f.write("	<string name=\"library_" + name + "_libraryWebsite\"></string>\n")
    f.write("	<string name=\"library_" + name + "_libraryVersion\">" + version + "</string>\n")
    f.write("	<!-- OpenSource section -->\n")
    f.write("	<string name=\"library_" + name + "_isOpenSource\">true</string>\n")
    f.write("	<string name=\"library_" + name + "_repositoryLink\"></string>\n")
    f.write("	<!-- License section -->\n")
    f.write("	<string name=\"library_" + name + "_licenseId\"></string>\n")
    f.write("</resources> \n")
    f.close
    pass


if __name__ == "__main__":
    if len(sys.argv) == 3:
        main(sys.argv[1:])
    else:
        print("too few arguments. Need library name and version")

```

### Core Architecture Module: `sample/web/src/commonMain/resources/load.mjs`
```
import { instantiate } from './markdown.uninstantiated.mjs';

await wasmSetup;

instantiate({ skia: Module['asm'] });

```

### Core Architecture Module: `sample/web/src/commonMain/resources/unsupported_browser.js`
```
const unhandledError = (event, error) => {
    if (error instanceof WebAssembly.CompileError) {
        document.getElementById("warning").style.display = "initial";

        // Hide a Scary Webpack Overlay which is less informative in this case.
        const webpackOverlay = document.getElementById("webpack-dev-server-client-overlay");
        if (webpackOverlay != null) {
            webpackOverlay.style.display = "none";
        }
    }
};

addEventListener("error", (event) => unhandledError(event, event.error));
addEventListener("unhandledrejection", (event) => unhandledError(event, event.reason));

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #648** (2021-05-28): **Trouble since upgrade in a project with product flavors?**
  *Symptoms*: ## About this issue  We've been happily using AboutLibraries 8.5.0 in Monado  https://gitlab.freedesktop.org/monado/monado for some time. I was recently prompted to update to 8.8.6, and despite not seeing anything related in the changelog, I now get an error. I'm blaming product flavors, since that's what I was messing with when I upgraded, and I don't know why else this would start happening. **8.8.5 appears to work fine.**  ``` > Task :src:xrt:targets:openxr_android:prepareLibraryDefinitionsInProcessDebug FAILED Manually requested license: mit Manually requested license: mpl_2_0 All dependencies.size=70 --> Retrieved POM for: com_google_code_findbugs__jsr305 from org.sonatype.oss:oss-parent:7 --> Retrieved POM for: com_google_dagger__hilt_core from org.sonatype.oss:oss-parent:7 Could not get the name for androidx_databinding__viewbinding, Using androidx.databinding:viewbinding --> Had to resolve name from custom mapping for: androidx_savedstate__savedstate as SavedState --> Retrieved POM for: com_google_dagger__hilt_android from org.sonatype.oss:oss-parent:7 --> Retrieved POM for: com_google_dagger__dagger from org.sonatype.oss:oss-parent:7 --> Retrieved POM for: com_google_dagger__dagger_lint_aar from org.sonatype.oss:oss-parent:7  Execution failed for task ':src:xrt:targets:openxr_android:prepareLibraryDefinitionsInProcessDebug'. > Receiver class com.mikepenz.aboutlibraries.plugin.AboutLibrariesProcessor does not define or inherit an implementation of th
  **Post-Mortem & Fix Analysis**:
  > Thank you so much @rpavlik nothing particular to that was changed indeed. We will have to investigate if it may be some issue with stable gradle 7.0.2  https://github.com/mikepenz/AboutLibraries/issues/637#issuecomment-842520907
  > Note that here I am using Gradle 6.8.3 - I haven't dared upgrade to 7 yet.
  > I was using 8.8.6 with Gradle 7+ and it worked fine.

- **Issue #645** (2021-05-28): **Jetpack navigation and XML configuration**
  *Symptoms*: I included your excellent library in my project using Jetpack navigation as described in https://github.com/mikepenz/AboutLibraries#jetpack-navigation which worked nicely. When I want to configure what is shown on the fragment using the XML part of https://github.com/mikepenz/AboutLibraries#about-this-app-ui I cannot change any boolean values. The XML is used in the sample app too and only certain values can be changed there too. For example aboutLibraries_description_showIcon can be set to false but the icon will be shown regardless of this setting. If I understand it correctly, the value is read in LibsFragmentCompat.kt by using extractBooleanBundleOrResource() from ContextExtension.kt but will allow to override null values only. But in LibsBuilder.kt it is initialized with true (and showIcon can't be null anyway) so that will be used not what is specified in the XML. Am I missing something or how can I configure the shown data for the boolean values? Thanks in advance
  **Post-Mortem & Fix Analysis**:
  > @ts65 thank you so much for the report. I'll have a look
  > Thank you so much, it works nicely with the latest version. Would you be willing to expand it to support showLicence in XML/LibsFragmentCompat too?
  > Thank you!

- **Issue #624** (2021-03-05): **Empty license strings since 8.8.1 version**
  *Symptoms*: As of version 8.8.1, libraries downloaded using `Libs(contex).libraries` have empty strings in the `licenseDescription` and `licenseShortDescription` fields.   The only solution is to use version 8.8.0
  **Post-Mortem & Fix Analysis**:
  > @Faierbel the main difference between those 2 versions would be the publishing to maven. Which is interesting.   may you please try if it is related to the plugin or the library code?  (use 8.8.0 in library code but 8.8.1 plugin, and in reverse)  Please clean in-between just to make sure. 
  > Thanks for the quick reply  8.8.0 plugin, 8.8.1 library -> strings aren't empty 8.8.1 plugin, 8.8.0 library -> strings are empty  It looks like the problem is the plugin
  > Found the issue fill release an update as quick as possible

- **Issue #578** (2021-01-07): **Configuring a config folder fails with silent error**
  *Symptoms*: ## About this issue I just tried the config option now but it does not seem to be working. I believe it could either be me doing it wrong or be a slight bug in the collectMappingDetails method in AboutLibrariesProcessor.groovy.  The first instance of customMappingText inside if(configFolder != null) does not start with a def. When I copy this function into our project and run it then it throws an exception. groovy.lang.MissingPropertyException: Could not set unknown property 'customMappingText' for project Adding a def to this seems to work. Can raise a new issue for this?   ## Details - [ ] Used library version - [ ] Used support library version - [ ] Used gradle build tools version - [ ] Used tooling / Android Studio version - [ ] Other used libraries, potential conflicting libraries  ## Checklist  - [ ] Searched for [similar issues](https://github.com/mikepenz/AboutLibraries/issues) - [ ] Checked out the [sample application](https://github.com/mikepenz/AboutLibraries/tree/develop/app) - [ ] Read the [README](https://github.com/mikepenz/AboutLibraries/blob/develop/README.md) - [ ] Checked out the [CHANGELOG](https://github.com/mikepenz/AboutLibraries/releases) - [ ] Read the [MIGRATION GUIDE](https://github.com/mikepenz/AboutLibraries/blob/develop/MIGRATION.md) 

- **Issue #557** (2020-11-09): **ExportLibraries fails using gradle CLI**
  *Symptoms*: ## About this issue  - Briefly describe the issue ExplorLibraries task using gradlew commandLine fails  - How can the issue be reproduced / sample code Create an Android Blank project using Android Studio 4.1 (Java) Modify project build.gradle to include AboutLibraries Gradle Plug-in (classpath / maven url) 8.4.5 Modify app build.gradle to include the plugin and the dependencies;  Add a button to trigger to start the AboutLibraries Activity (as described on component page);  **gradlew output**  ``` $ ./gradlew exportLibrariesDebug  > Task :app:exportLibrariesDebug FAILED All dependencies.size=48 --> Had to resolve name from custom mapping for: androidx_savedstate__savedstate as SavedState   Variant: debug   LIBRARIES:  FAILURE: Build failed with an exception.  * What went wrong: Execution failed for task ':app:exportLibrariesDebug'. > Could not get unknown property 'unknownLicenses' for task ':app:exportLibrariesDebug' of type com.mikepenz.aboutlibraries.plugin.AboutLibrariesExportTask.  * Try: Run with --stacktrace option to get the stack trace. Run with --info or --debug option to get more log output. Run with --scan to get full insights.  * Get more help at https://help.gradle.org  BUILD FAILED in 1s 1 actionable task: 1 executed   ```  **Stack Trace**  ``` * Exception is: org.gradle.api.tasks.TaskExecutionException: Execution failed for task ':app:exportLibrariesDebug'.         at org.gradle.api.internal.tasks.execution.Exe
  **Post-Mortem & Fix Analysis**:
  > @bbourbon thank you for the report, there will be a new release fixing this soon
  > @bbourbon please try v8.5.0
  > Thank you show much Mike. I will test as soon as possible.  Best Regards.

- **Issue #504** (2020-06-10): **FragmentManager / Databinding Issue**
  *Symptoms*: ## About this issue  When adding classpath("com.mikepenz.aboutlibraries.plugin:aboutlibraries-plugin:8.1.6") to my build.gradle (root level) dependencies and applying the plugin in the app level - the application will build just fine but during runtime it does crash with an NullPointerException.   Executing  ./gradlew exportLibraries works fine. I did not try adding the bundled activity.  ``` 2020-06-03 15:14:30.415 1931-1931/com.continental.android.intersectcollisionwarning E/AndroidRuntime:     at androidx.fragment.app.FragmentManagerImpl.addAddedFragments(FragmentManagerImpl.java:2100)         at androidx.fragment.app.FragmentManagerImpl.executeOpsTogether(FragmentManagerImpl.java:1874)         at androidx.fragment.app.FragmentManagerImpl.removeRedundantOperationsAndExecute(FragmentManagerImpl.java:1830)         at androidx.fragment.app.FragmentManagerImpl.execPendingActions(FragmentManagerImpl.java:1727)         at androidx.fragment.app.FragmentManagerImpl.dispatchStateChange(FragmentManagerImpl.java:2663)         at androidx.fragment.app.FragmentManagerImpl.dispatchActivityCreated(FragmentManagerImpl.java:2613)         at androidx.fragment.app.Fragment.performActivityCreated(Fragment.java:2624)         at androidx.fragment.app.FragmentManagerImpl.moveToState(FragmentManagerImpl.java:904)         at androidx.fragment.app.FragmentManagerImpl.moveFragmentToExpectedState(FragmentManagerImpl.java:1238)         at androidx.fragment.app.FragmentManagerImpl.moveT
  **Post-Mortem & Fix Analysis**:
  > @virgil85 could it be that you exceed the multidex limit?   if you do not apply the plugin but only use the dependency will it work?  Do you potentially have different versions of major libs like material components, or similar?
  > @mikepenz since I have `multiDexEnabled = true`  I guess the multidex limit should not affect me.   If I don't apply the plugin but only use the dependency I get the same runtime errors as before.  Yes, I'm using a lot of major libs (material components in version 1.1.0-beta01). Is there an easy way to list them all?
  > ./gradlew app:dependencies gives you all dependencies and their version.   It looks like the plugin is not the cause. And if it is only adding the library that indicates:  - multidex issue - conflict of library versions  :) 

- **Issue #501** (2020-06-07): **Some dependencies not detected**
  *Symptoms*: ## About this issue  UPDATE: see https://github.com/mikepenz/AboutLibraries/issues/501#issuecomment-637460667  Multi-module project layout as follows: ``` :app (Android app module) - dependency1 (library recognized correctly by AboutLibraries) - :lib1 (Android library module) -- dependency2 (library NOT recognized) ```  dependency2 is declared only in some library modules (not in the app module directly) using `implementation` configuration. It is not present in output of `findLibraries` nor `exportLibraries` tasks. AboutLibraries gradle plugin is applied to :app module. No custom configuration. Not sure if all such transitive dependencies are affected but it is true for few randomly chosen.  It worked at most in 8.0.0-a02 because I've reported another issue here with displaying author of one of the libraries which are now missing (https://github.com/mikepenz/AboutLibraries/issues/459). AFAIR since that project layout has not changed, only the dependency versions incl. AboutLibraries, Gradle and AGP.  ## Details - Used library version: 8.1.6, with Gradle plugin - Used gradle build tools version: 6.5-milestone-1 - Used tooling / Android Studio version: 4.1.0-alpha10  ## Checklist  - [x] Searched for [similar issues](https://github.com/mikepenz/AboutLibraries/issues) - [x] Checked out the [sample application](https://github.com/mikepenz/AboutLibraries/tree/develop/app) - [x] Read the [README](https://github.com/mikepenz/AboutLibraries/blob/develop/
  **Post-Mortem & Fix Analysis**:
  > @koral-- I believe that this changed with us stopping to use internal APIs which break with every single change of the android plugin to the proper available APIs from gradle which will stay more stable.   We need to setup a sample and look at it. but I believe I tested it with a newer version in one of the SDKs I help in and it worked also on sub dependencies. so not sure yet what it may be.    something implementation vs api? 
  > OK. I'll try to create a sample which reproduces this issue.  Regarding `implementation` vs `api` as I wrote in 1st post, currently there is an `implementation` and it has not changed. It starts working again if I add the same dependency with `implementation` scope to app module.
  > @mikepenz I was able to reproduce the same issue even without transitive dependency. The reason seems to be different.  Steps to reproduce: * add this dependency to app module in the sample app on current develop: `implementation group: 'com.google.zxing', name: 'core', version: '3.4.0'`  `ZXing Core (3.4.0) -> com_google_zxing__core` is printed to the console when running `findLibraries` task. However, `com_google_zxing__core` is not added to generated XML.

- **Issue #497** (2020-05-25): **UninitializedPropertyAccessException on LibsFragmentCompat**
  *Symptoms*: ## About this issue  - I have this crash from Crashlytics, only on Nexus 5X device. I don't have this physical device to try and reproduce the problem. - I'm not sure how this can be reproduced, i have no logs what user did to come to this state  ## Details - Library version: 8.1.2 - Newest stable: androidx.fragment:fragment-ktx:1.2.4 androidx.core:core-ktx:1.2.0 androidx.appcompat:appcompat:1.1.0 - Gradle 6.4.1 - Android Studio 3.6.3  I'm using gradle plugin to generate library list. Then i start activity like this ```kotlin LibsBuilder()                 .withActivityTitle("External libraries")                 .withAboutIconShown(false)                 .withVersionShown(true)                 .withSortEnabled(true)                 .withLicenseShown(true)                 .start(requireActivity()) ```  On this particular device the stack track is:  ``` Caused by kotlin.UninitializedPropertyAccessException: lateinit property builder has not been initialized        at com.mikepenz.aboutlibraries.LibsFragmentCompat.executeLibTask(LibsFragmentCompat.java:101)        at com.mikepenz.aboutlibraries.LibsFragmentCompat.onViewCreated(LibsFragmentCompat.java:95)        at com.mikepenz.aboutlibraries.ui.LibsSupportFragment.onViewCreated(LibsSupportFragment.java:24)        at androidx.fragment.app.FragmentStateManager.createView(FragmentStateManager.java:332)        at androidx.fragment.app.FragmentManager.moveToState(FragmentManager.java:1187)        at andr
  **Post-Mortem & Fix Analysis**:
  > Hmmm seems it creates the view without the arguments on that phone :O  https://github.com/mikepenz/AboutLibraries/blob/develop/library/src/main/java/com/mikepenz/aboutlibraries/LibsFragmentCompat.kt#L51-L52  and then we don't verify here if the builder got initialized: https://github.com/mikepenz/AboutLibraries/blob/develop/library/src/main/java/com/mikepenz/aboutlibraries/LibsFragmentCompat.kt#L101  We can account for that, but then it still would be empty for that user I suppose
  > Yea, i probably have to get this device just to check what the heck is going on there :)
  > what version of android is it running? perhaps it's somehow related to this?

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

### Incident Patch 1: `668f9b0a` (2026-09-27)
**Commit Message**: Merge pull request #1466 from cketti/log-stacktrace

Log stack trace when loading resource fails

**File**: `aboutlibraries-core/src/androidMain/kotlin/com/mikepenz/aboutlibraries/util/AndroidExtensions.kt` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ fun Libs.Builder.withJson(ctx: Context, rawResId: Int): Libs.Builder {
             "AboutLibraries", """
             Unable to retrieve library information given the `raw` resource identifier. 
             Please make sure either the gradle plugin is properly set up, or the file is manually provided. 
-        """.trimIndent()
+        """.trimIndent(), t
         )
         println("Could not retrieve libraries")
     }
```

---

### Incident Patch 2: `9aaed991` (2026-09-25)
**Commit Message**: Log stack trace when loading resource fails

**File**: `aboutlibraries-core/src/androidMain/kotlin/com/mikepenz/aboutlibraries/util/AndroidExtensions.kt` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ fun Libs.Builder.withJson(ctx: Context, rawResId: Int): Libs.Builder {
             "AboutLibraries", """
             Unable to retrieve library information given the `raw` resource identifier. 
             Please make sure either the gradle plugin is properly set up, or the file is manually provided. 
-        """.trimIndent()
+        """.trimIndent(), t
         )
         println("Could not retrieve libraries")
     }
```

---

### Incident Patch 3: `5f4eebaf` (2026-08-24)
**Commit Message**: fix(deps): update dependency com.squareup.okhttp3:okhttp to v5.5.0

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ itemAnimators = "1.1.0"
 ivy = "2.6.0"
 modelBuilder = "3.9.16"
 materialDrawer = "9.0.2"
-okhttp = "5.4.0"
+okhttp = "5.5.0"
 dejavu = "0.3.1"
 
 [plugins]
```

---

### Incident Patch 4: `c46f2312` (2026-08-21)
**Commit Message**: Merge pull request #1454 from mikepenz/fix/platform-suffix-allowlist

fix(plugin): only merge artifact suffixes that name a Kotlin target

**File**: `plugin-build/plugin/src/main/kotlin/com/mikepenz/aboutlibraries/plugin/util/LibraryUtil.kt` (modified, +24/-1)
```diff
@@ -85,12 +85,35 @@ private fun List<Library>.clusterByArtifactId(): List<List<Library>> {
     val clusters = mutableListOf<Pair<String, MutableList<Library>>>() // root module -> members
     for (library in sortedBy { it.module().length }) {
         val module = library.module()
-        val cluster = clusters.firstOrNull { (root, _) -> module.startsWith("$root-") }
+        val cluster = clusters.firstOrNull { (root, _) -> module.isPlatformArtifactOf(root) }
         if (cluster != null) cluster.second += library else clusters += module to mutableListOf(library)
     }
     return clusters.map { it.second }
 }
 
+/**
+ * Kotlin target names as they appear in a published artifact id, lowercased: the fixed targets, the
+ * Compose/Kotlin publication suffixes, and the native target families (`linuxx64`,
+ * `iossimulatorarm64`, `watchosdevicearm64`, …).
+ */
+private val PLATFORM_SUFFIX = Regex(
+    "jvm[a-z0-9]*|android|js|wasm-?(js|wasi)|desktop|uikit|native|metadata|common|" +
+        "(linux|mingw|macos|ios|watchos|tvos|androidnative)[a-z0-9]*"
+)
+
+/**
+ * Whether this module id looks like a platform artifact of [root] — the root id plus a Kotlin
+ * target suffix (`collection` → `collection-jvm`).
+ *
+ * Matching the suffix against known target names rather than accepting any suffix is what keeps a
+ * sibling module from being swallowed by a shorter one it happens to share a prefix with
+ * (`androidx.core:core` must not absorb `core-ktx`, a `com.foo:android` module must not absorb
+ * `android-core`). An unknown target name degrades to reporting the artifact separately, which is
+ * the same output as before merging — never to a wrong merge.
+ */
+private fun String.isPlatformArtifactOf(root: String): Boolean =
+    startsWith("$root-") && PLATFORM_SUFFIX.matches(substring(root.length + 1))
+
 fun Library.merge(with: Library) {
     val orgLib = this
     with.name?.takeIf { it.isNotBlank() }?.also { orgLib.name = it }
```

**File**: `plugin-build/plugin/src/test/kotlin/com/mikepenz/aboutlibraries/plugin/util/LibraryUtilTest.kt` (modified, +51/-0)
```diff
@@ -160,4 +160,55 @@ class LibraryUtilTest {
 
         assertEquals(libraries.map { it.uniqueId }.toSet(), result.map { it.uniqueId }.toSet())
     }
+
+    @Test
+    fun `native and web platform artifacts are merged too`() {
+        val libraries = listOf(
+            library("androidx.collection:collection", "collection"),
+            library("androidx.collection:collection-iossimulatorarm64", "collection"),
+            library("androidx.collection:collection-linuxx64", "collection"),
+            library("androidx.collection:collection-wasm-js", "collection"),
+            library("androidx.collection:collection-jvmstubs", "collection"),
+            library("androidx.collection:collection-desktop", "collection"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.EXACT)
+
+        assertEquals(listOf("androidx.collection:collection"), result.map { it.uniqueId })
+    }
+
+    /**
+     * A sibling module whose id happens to start with a shorter module's id is not a platform
+     * artifact of it — only a known Kotlin target suffix makes one.
+     */
+    @Test
+    fun `a shorter sibling module does not absorb the ones it prefixes`() {
+        val libraries = listOf(
+            library("com.foo:android", "Foo"),
+            library("com.foo:android-core", "Foo"),
+            library("com.foo:android-core-jvm", "Foo"),
+            library("com.foo:android-extra", "Foo"),
+            library("com.foo:android-extra-jvm", "Foo"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.EXACT)
+
+        assertEquals(
+            setOf("com.foo:android", "com.foo:android-core", "com.foo:android-extra"),
+            result.map { it.uniqueId }.toSet(),
+            "each module keeps its own entry, absorbing only its own platform artifact",
+        )
+    }
+
+    @Test
+    fun `a non-target suffix is not treated as a platform artifact`() {
+        val libraries = listOf(
+            library("androidx.core:core", "Core"),
+            library("androidx.core:core-ktx", "Core"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.EXACT)
+
+        assertEquals(libraries.map { it.uniqueId }.toSet(), result.map { it.uniqueId }.toSet())
+    }
 }
```

---

### Incident Patch 5: `2509d3a1` (2026-08-21)
**Commit Message**: Merge pull request #1453 from mikepenz/fix/link-mode-associated

fix(plugin): `DuplicateMode.LINK` associated itself instead of its siblings

**File**: `plugin-build/plugin/src/main/kotlin/com/mikepenz/aboutlibraries/plugin/util/LibraryUtil.kt` (modified, +2/-1)
```diff
@@ -49,7 +49,8 @@ fun List<Library>.processDuplicates(
                 if (group.size > 1) {
                     val allAssociated = group.map { it.uniqueId }
                     group.forEach {
-                        it.associated = allAssociated.filter { a -> a == it.uniqueId }
+                        // the *other* members of the group — a library is not associated to itself
+                        it.associated = allAssociated.filter { a -> a != it.uniqueId }
                     }
                 }
             }
```

**File**: `plugin-build/plugin/src/test/kotlin/com/mikepenz/aboutlibraries/plugin/util/LibraryUtilTest.kt` (modified, +108/-1)
```diff
@@ -8,7 +8,12 @@ import org.junit.jupiter.api.Test
 
 class LibraryUtilTest {
 
-    private fun library(uniqueId: String, name: String, description: String = "Material You dynamic color") = Library(
+    private fun library(
+        uniqueId: String,
+        name: String,
+        description: String = "Material You dynamic color",
+        licenses: Set<String> = setOf("Apache-2.0"),
+    ) = Library(
         uniqueId = uniqueId,
         artifactVersion = "5.0.0",
         name = name,
@@ -17,6 +22,7 @@ class LibraryUtilTest {
         developers = emptyList(),
         organization = null,
         scm = null,
+        licenses = licenses,
     )
 
     /**
@@ -53,4 +59,105 @@ class LibraryUtilTest {
 
         assertEquals(listOf("androidx.collection:collection"), result.map { it.uniqueId })
     }
+
+    @Test
+    fun `KEEP reports every coordinate untouched`() {
+        val libraries = listOf(
+            library("androidx.collection:collection", "collection"),
+            library("androidx.collection:collection-jvm", "collection"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.KEEP, DuplicateRule.EXACT)
+
+        assertEquals(libraries.map { it.uniqueId }, result.map { it.uniqueId })
+        assertEquals(listOf(null, null), result.map { it.associated })
+    }
+
+    @Test
+    fun `LINK keeps every coordinate and cross-references the others`() {
+        val libraries = listOf(
+            library("androidx.collection:collection", "collection"),
+            library("androidx.collection:collection-jvm", "collection"),
+            library("androidx.collection:collection-js", "collection"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.LINK, DuplicateRule.EXACT)
+
+        assertEquals(libraries.map { it.uniqueId }, result.map { it.uniqueId }, "LINK must not drop anything")
+        // a library is associated to its siblings, never to itself
+        assertEquals(
+            listOf(
+                setOf("androidx.collection:collection-jvm", "androidx.collection:collection-js"),
+                setOf("androidx.collection:collection", "androidx.collection:collection-js"),
+                setOf("androidx.collection:collection", "androidx.collection:collection-jvm"),
+            ),
+            result.map { it.associated?.toSet() },
+        )
+    }
+
+    @Test
+    fun `LINK leaves a library without siblings unassociated`() {
+        val libraries = listOf(
+            library("androidx.collection:collection", "collection"),
+            library("com.google.code.gson:gson", "Gson"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.LINK, DuplicateRule.EXACT)
+
+        assertEquals(listOf(null, null), result.map { it.associated })
+    }
+
+    /** [DuplicateRule.SIMPLE] matches on group + name, so a differing description must not split. */
+    @Test
+    fun `SIMPLE ignores the description EXACT distinguishes on`() {
+        val libraries = listOf(
+            library("androidx.collection:collection", "collection", description = "Standalone efficient collections."),
+            library("androidx.collection:collection-jvm", "collection", description = "Collections, but for the JVM."),
+        )
+
+        assertEquals(
+            listOf("androidx.collection:collection"),
+            libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.SIMPLE).map { it.uniqueId },
+        )
+        assertEquals(
+            libraries.map { it.uniqueId },
+            libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.EXACT).map { it.uniqueId },
+            "differing descriptions are distinct under EXACT",
+        )
+    }
+
+    /** [DuplicateRule.GROUP] matches on group + licenses alone, ignoring name and description. */
+    @Test
+    fun `GROUP matches on licenses regardless of name`() {
+        val libraries = listOf(
+            library("androidx.collection:collection", "collection", desc
```

---

### Incident Patch 6: `06f96cda` (2026-08-21)
**Commit Message**: fix(plugin): only merge suffixes that name a Kotlin target

Clustering by "root id plus any suffix" merged a sibling module into a shorter
one it happened to share a prefix with: `androidx.core:core-ktx` collapsed into
`core`, and a `com.foo:android` module absorbed `android-core` / `android-extra`
whole.

Require the suffix to be a Kotlin target name as published (`jvm`, `android`,
`js`, `wasm-js`, `desktop`, `linuxx64`, `iossimulatorarm64`, …). An unrecognized
target degrades to reporting the artifact separately — the pre-merge output —
never to a wrong merge.

**File**: `plugin-build/plugin/src/main/kotlin/com/mikepenz/aboutlibraries/plugin/util/LibraryUtil.kt` (modified, +24/-1)
```diff
@@ -85,12 +85,35 @@ private fun List<Library>.clusterByArtifactId(): List<List<Library>> {
     val clusters = mutableListOf<Pair<String, MutableList<Library>>>() // root module -> members
     for (library in sortedBy { it.module().length }) {
         val module = library.module()
-        val cluster = clusters.firstOrNull { (root, _) -> module.startsWith("$root-") }
+        val cluster = clusters.firstOrNull { (root, _) -> module.isPlatformArtifactOf(root) }
         if (cluster != null) cluster.second += library else clusters += module to mutableListOf(library)
     }
     return clusters.map { it.second }
 }
 
+/**
+ * Kotlin target names as they appear in a published artifact id, lowercased: the fixed targets, the
+ * Compose/Kotlin publication suffixes, and the native target families (`linuxx64`,
+ * `iossimulatorarm64`, `watchosdevicearm64`, …).
+ */
+private val PLATFORM_SUFFIX = Regex(
+    "jvm[a-z0-9]*|android|js|wasm-?(js|wasi)|desktop|uikit|native|metadata|common|" +
+        "(linux|mingw|macos|ios|watchos|tvos|androidnative)[a-z0-9]*"
+)
+
+/**
+ * Whether this module id looks like a platform artifact of [root] — the root id plus a Kotlin
+ * target suffix (`collection` → `collection-jvm`).
+ *
+ * Matching the suffix against known target names rather than accepting any suffix is what keeps a
+ * sibling module from being swallowed by a shorter one it happens to share a prefix with
+ * (`androidx.core:core` must not absorb `core-ktx`, a `com.foo:android` module must not absorb
+ * `android-core`). An unknown target name degrades to reporting the artifact separately, which is
+ * the same output as before merging — never to a wrong merge.
+ */
+private fun String.isPlatformArtifactOf(root: String): Boolean =
+    startsWith("$root-") && PLATFORM_SUFFIX.matches(substring(root.length + 1))
+
 fun Library.merge(with: Library) {
     val orgLib = this
     with.name?.takeIf { it.isNotBlank() }?.also { orgLib.name = it }
```

**File**: `plugin-build/plugin/src/test/kotlin/com/mikepenz/aboutlibraries/plugin/util/LibraryUtilTest.kt` (modified, +51/-0)
```diff
@@ -160,4 +160,55 @@ class LibraryUtilTest {
 
         assertEquals(libraries.map { it.uniqueId }.toSet(), result.map { it.uniqueId }.toSet())
     }
+
+    @Test
+    fun `native and web platform artifacts are merged too`() {
+        val libraries = listOf(
+            library("androidx.collection:collection", "collection"),
+            library("androidx.collection:collection-iossimulatorarm64", "collection"),
+            library("androidx.collection:collection-linuxx64", "collection"),
+            library("androidx.collection:collection-wasm-js", "collection"),
+            library("androidx.collection:collection-jvmstubs", "collection"),
+            library("androidx.collection:collection-desktop", "collection"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.EXACT)
+
+        assertEquals(listOf("androidx.collection:collection"), result.map { it.uniqueId })
+    }
+
+    /**
+     * A sibling module whose id happens to start with a shorter module's id is not a platform
+     * artifact of it — only a known Kotlin target suffix makes one.
+     */
+    @Test
+    fun `a shorter sibling module does not absorb the ones it prefixes`() {
+        val libraries = listOf(
+            library("com.foo:android", "Foo"),
+            library("com.foo:android-core", "Foo"),
+            library("com.foo:android-core-jvm", "Foo"),
+            library("com.foo:android-extra", "Foo"),
+            library("com.foo:android-extra-jvm", "Foo"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.EXACT)
+
+        assertEquals(
+            setOf("com.foo:android", "com.foo:android-core", "com.foo:android-extra"),
+            result.map { it.uniqueId }.toSet(),
+            "each module keeps its own entry, absorbing only its own platform artifact",
+        )
+    }
+
+    @Test
+    fun `a non-target suffix is not treated as a platform artifact`() {
+        val libraries = listOf(
+            library("androidx.core:core", "Core"),
+            library("androidx.core:core-ktx", "Core"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.EXACT)
+
+        assertEquals(libraries.map { it.uniqueId }.toSet(), result.map { it.uniqueId }.toSet())
+    }
 }
```

---

### Incident Patch 7: `d65ecf0f` (2026-08-21)
**Commit Message**: fix(plugin): `DuplicateMode.LINK` associated itself instead of its siblings

`associated` is documented as "references all associated libraries", but the
filter kept only the entry equal to the library's own `uniqueId` — every linked
library ended up with a single-element list pointing at itself. The field is
serialized into `aboutlibraries.json`, so the wrong value shipped.

Also adds unit coverage for the duplicate handling that had none: `LINK`,
`KEEP`, and the `SIMPLE` / `GROUP` rules.

**File**: `plugin-build/plugin/src/main/kotlin/com/mikepenz/aboutlibraries/plugin/util/LibraryUtil.kt` (modified, +2/-1)
```diff
@@ -49,7 +49,8 @@ fun List<Library>.processDuplicates(
                 if (group.size > 1) {
                     val allAssociated = group.map { it.uniqueId }
                     group.forEach {
-                        it.associated = allAssociated.filter { a -> a == it.uniqueId }
+                        // the *other* members of the group — a library is not associated to itself
+                        it.associated = allAssociated.filter { a -> a != it.uniqueId }
                     }
                 }
             }
```

**File**: `plugin-build/plugin/src/test/kotlin/com/mikepenz/aboutlibraries/plugin/util/LibraryUtilTest.kt` (modified, +108/-1)
```diff
@@ -8,7 +8,12 @@ import org.junit.jupiter.api.Test
 
 class LibraryUtilTest {
 
-    private fun library(uniqueId: String, name: String, description: String = "Material You dynamic color") = Library(
+    private fun library(
+        uniqueId: String,
+        name: String,
+        description: String = "Material You dynamic color",
+        licenses: Set<String> = setOf("Apache-2.0"),
+    ) = Library(
         uniqueId = uniqueId,
         artifactVersion = "5.0.0",
         name = name,
@@ -17,6 +22,7 @@ class LibraryUtilTest {
         developers = emptyList(),
         organization = null,
         scm = null,
+        licenses = licenses,
     )
 
     /**
@@ -53,4 +59,105 @@ class LibraryUtilTest {
 
         assertEquals(listOf("androidx.collection:collection"), result.map { it.uniqueId })
     }
+
+    @Test
+    fun `KEEP reports every coordinate untouched`() {
+        val libraries = listOf(
+            library("androidx.collection:collection", "collection"),
+            library("androidx.collection:collection-jvm", "collection"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.KEEP, DuplicateRule.EXACT)
+
+        assertEquals(libraries.map { it.uniqueId }, result.map { it.uniqueId })
+        assertEquals(listOf(null, null), result.map { it.associated })
+    }
+
+    @Test
+    fun `LINK keeps every coordinate and cross-references the others`() {
+        val libraries = listOf(
+            library("androidx.collection:collection", "collection"),
+            library("androidx.collection:collection-jvm", "collection"),
+            library("androidx.collection:collection-js", "collection"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.LINK, DuplicateRule.EXACT)
+
+        assertEquals(libraries.map { it.uniqueId }, result.map { it.uniqueId }, "LINK must not drop anything")
+        // a library is associated to its siblings, never to itself
+        assertEquals(
+            listOf(
+                setOf("androidx.collection:collection-jvm", "androidx.collection:collection-js"),
+                setOf("androidx.collection:collection", "androidx.collection:collection-js"),
+                setOf("androidx.collection:collection", "androidx.collection:collection-jvm"),
+            ),
+            result.map { it.associated?.toSet() },
+        )
+    }
+
+    @Test
+    fun `LINK leaves a library without siblings unassociated`() {
+        val libraries = listOf(
+            library("androidx.collection:collection", "collection"),
+            library("com.google.code.gson:gson", "Gson"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.LINK, DuplicateRule.EXACT)
+
+        assertEquals(listOf(null, null), result.map { it.associated })
+    }
+
+    /** [DuplicateRule.SIMPLE] matches on group + name, so a differing description must not split. */
+    @Test
+    fun `SIMPLE ignores the description EXACT distinguishes on`() {
+        val libraries = listOf(
+            library("androidx.collection:collection", "collection", description = "Standalone efficient collections."),
+            library("androidx.collection:collection-jvm", "collection", description = "Collections, but for the JVM."),
+        )
+
+        assertEquals(
+            listOf("androidx.collection:collection"),
+            libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.SIMPLE).map { it.uniqueId },
+        )
+        assertEquals(
+            libraries.map { it.uniqueId },
+            libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.EXACT).map { it.uniqueId },
+            "differing descriptions are distinct under EXACT",
+        )
+    }
+
+    /** [DuplicateRule.GROUP] matches on group + licenses alone, ignoring name and description. */
+    @Test
+    fun `GROUP matches on licenses regardless of name`() {
+        val libraries = listOf(
+            library("androidx.collection:collection", "collection", desc
```

---

### Incident Patch 8: `2d736858` (2026-08-21)
**Commit Message**: Merge pull request #1452 from mikepenz/fix/duplicate-merge-sibling-modules

fix(plugin): don't merge sibling modules sharing POM name and description

**File**: `plugin-build/plugin/src/main/kotlin/com/mikepenz/aboutlibraries/plugin/util/LibraryUtil.kt` (modified, +37/-6)
```diff
@@ -10,23 +10,27 @@ fun List<Library>.processDuplicates(
     duplicateMode: DuplicateMode,
     duplicateRule: DuplicateRule,
 ): List<Library> {
-    fun mappedLibs(): Map<String, List<Library>> {
+    fun mappedLibs(): List<List<Library>> {
         return this.groupBy {
             when (duplicateRule) {
                 DuplicateRule.GROUP -> it.groupId + it.licenses.joinToString(",")
                 DuplicateRule.SIMPLE -> it.groupId + it.name
                 DuplicateRule.EXACT -> it.groupId + it.name + it.description?.toMD5()
             }
-        }
+        }.values.flatMap { it.clusterByArtifactId() }
     }
 
     when (duplicateMode) {
         DuplicateMode.MERGE -> {
             val deDuplicatedList = mutableListOf<Library>()
-            mappedLibs().forEach { (_, group) ->
+            mappedLibs().forEach { group ->
                 val kept = if (group.size > 1) {
-                    // on duplicates, assumption is the shorter title is the base dependency
-                    group.minByOrNull { it.name?.length ?: it.description?.length ?: Int.MAX_VALUE } ?: group.first()
+                    // on duplicates, assumption is the shorter title is the base dependency; on a
+                    // tie (a KMP publication names every platform artifact identically) the
+                    // shortest id is the root module the others are platform variants of
+                    group.minWithOrNull(
+                        compareBy({ it.name?.length ?: it.description?.length ?: Int.MAX_VALUE }, { it.uniqueId.length })
+                    ) ?: group.first()
                 } else {
                     group.first()
                 }
@@ -41,7 +45,7 @@ fun List<Library>.processDuplicates(
         }
 
         DuplicateMode.LINK -> {
-            mappedLibs().forEach { (_, group) ->
+            mappedLibs().forEach { group ->
                 if (group.size > 1) {
                     val allAssociated = group.map { it.uniqueId }
                     group.forEach {
@@ -59,6 +63,33 @@ fun List<Library>.processDuplicates(
     }
 }
 
+/**
+ * Splits libraries the [DuplicateRule] considered equal into clusters that really are one library
+ * published under several coordinates: a Kotlin Multiplatform publication such as
+ * `androidx.collection:collection` + `collection-jvm`, where the platform artifact id is the root
+ * id plus a target suffix.
+ *
+ * Sibling modules of one project routinely share the POM `name` and `description` — e.g.
+ * `com.materialkolor:material-kolor` and `com.materialkolor:material-color-utilities`, both named
+ * "MaterialKolor" with the same description. Those are distinct libraries, and merging them
+ * silently dropped one of them.
+ */
+private fun List<Library>.clusterByArtifactId(): List<List<Library>> {
+    if (size < 2) return listOf(this)
+    // `Library.artifactId` is the full `group:artifact:version` — the module name is what a
+    // platform suffix is appended to
+    fun Library.module() = uniqueId.substringAfterLast(':')
+
+    // shortest first, so the root module is the one every platform artifact attaches to
+    val clusters = mutableListOf<Pair<String, MutableList<Library>>>() // root module -> members
+    for (library in sortedBy { it.module().length }) {
+        val module = library.module()
+        val cluster = clusters.firstOrNull { (root, _) -> module.startsWith("$root-") }
+        if (cluster != null) cluster.second += library else clusters += module to mutableListOf(library)
+    }
+    return clusters.map { it.second }
+}
+
 fun Library.merge(with: Library) {
     val orgLib = this
     with.name?.takeIf { it.isNotBlank() }?.also { orgLib.name = it }
```

**File**: `plugin-build/plugin/src/test/kotlin/com/mikepenz/aboutlibraries/plugin/KmpAndroidFunctionalTest.kt` (modified, +3/-2)
```diff
@@ -111,8 +111,9 @@ class KmpAndroidFunctionalTest {
         val content = File(projectDir, "build/generated/aboutLibraries/aboutlibraries.json").readText()
         val gson = extractLibraryEntry(content, "com.google.code.gson:gson")
             ?: error("gson entry not found in output: $content")
-        // resolves through the KMP `available-at` redirect, so it lands under its platform artifact
-        val annotation = extractLibraryEntry(content, "androidx.annotation:annotation-jvm")
+        // resolves through the KMP `available-at` redirect; the redirect shell and the platform
+        // artifact are merged onto the root module they share
+        val annotation = extractLibraryEntry(content, "androidx.annotation:annotation")
             ?: error("androidx.annotation entry not found in output: $content")
 
         // no raw configuration name may leak into the field
```

**File**: `plugin-build/plugin/src/test/kotlin/com/mikepenz/aboutlibraries/plugin/MergePlatformArtifactsFunctionalTest.kt` (modified, +4/-2)
```diff
@@ -97,10 +97,12 @@ class MergePlatformArtifactsFunctionalTest {
             ?: error("expected the declared root coordinate to be reported")
         assertEquals(setOf("js", "jvm"), targetsOf(merged) - "metadata", "Entry: $merged")
 
+        // without merging the platform artifacts are still collapsed by `DuplicateMode.MERGE`, but
+        // only into the root module they are variants of — their own ids are gone either way
         val unmerged = runKmpExport(mergePlatformArtifacts = false)
         assertFalse(
-            unmerged.contains("\"uniqueId\":\"androidx.collection:collection\","),
-            "without merging the survivor is a platform artifact, not the root. Output:\n$unmerged"
+            unmerged.contains("\"uniqueId\":\"androidx.collection:collection-js\","),
+            "platform artifacts must not survive the duplicate merge. Output:\n$unmerged"
         )
     }
 
```

**File**: `plugin-build/plugin/src/test/kotlin/com/mikepenz/aboutlibraries/plugin/util/LibraryUtilTest.kt` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+package com.mikepenz.aboutlibraries.plugin.util
+
+import com.mikepenz.aboutlibraries.plugin.DuplicateMode
+import com.mikepenz.aboutlibraries.plugin.DuplicateRule
+import com.mikepenz.aboutlibraries.plugin.mapping.Library
+import org.junit.jupiter.api.Assertions.assertEquals
+import org.junit.jupiter.api.Test
+
+class LibraryUtilTest {
+
+    private fun library(uniqueId: String, name: String, description: String = "Material You dynamic color") = Library(
+        uniqueId = uniqueId,
+        artifactVersion = "5.0.0",
+        name = name,
+        description = description,
+        website = null,
+        developers = emptyList(),
+        organization = null,
+        scm = null,
+    )
+
+    /**
+     * https://github.com/mikepenz/AboutLibraries/issues/1430 — sibling modules of one project share
+     * the POM `name` and `description`, which made every duplicate rule consider them equal. Only
+     * the platform artifacts of the *same* module may be merged.
+     */
+    @Test
+    fun `sibling modules sharing name and description are not merged`() {
+        val libraries = listOf(
+            library("com.materialkolor:material-kolor", "MaterialKolor"),
+            library("com.materialkolor:material-kolor-jvm", "MaterialKolor"),
+            library("com.materialkolor:material-color-utilities", "MaterialKolor"),
+            library("com.materialkolor:material-color-utilities-jvm", "MaterialKolor"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.EXACT)
+
+        assertEquals(
+            setOf("com.materialkolor:material-kolor", "com.materialkolor:material-color-utilities"),
+            result.map { it.uniqueId }.toSet(),
+        )
+    }
+
+    @Test
+    fun `platform artifacts of the same module are still merged`() {
+        val libraries = listOf(
+            library("androidx.collection:collection-jvm", "collection"),
+            library("androidx.collection:collection", "collection"),
+            library("androidx.collection:collection-js", "collection"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.EXACT)
+
+        assertEquals(listOf("androidx.collection:collection"), result.map { it.uniqueId })
+    }
+}
```

---

### Incident Patch 9: `ec37f40b` (2026-08-21)
**Commit Message**: fix(plugin): don't merge sibling modules sharing POM name and description

`DuplicateMode.MERGE` grouped libraries by `groupId + name + description`,
which collapsed distinct sibling modules of the same project onto a single
entry — one of them silently disappeared from the output.

`com.materialkolor:material-kolor` and `com.materialkolor:material-color-utilities`
both publish `<name>MaterialKolor</name>` with the same description, so only one
of the two was reported (independent of `mergePlatformArtifacts`).

Sub-cluster each duplicate group by module id, so only actual platform variants
of the same module are merged (`collection` + `collection-jvm`), never sibling
modules. The surviving entry now breaks name-length ties on the shortest
uniqueId, making the root module the deterministic survivor of a KMP merge.

Fixes #1430

**File**: `plugin-build/plugin/src/main/kotlin/com/mikepenz/aboutlibraries/plugin/util/LibraryUtil.kt` (modified, +37/-6)
```diff
@@ -10,23 +10,27 @@ fun List<Library>.processDuplicates(
     duplicateMode: DuplicateMode,
     duplicateRule: DuplicateRule,
 ): List<Library> {
-    fun mappedLibs(): Map<String, List<Library>> {
+    fun mappedLibs(): List<List<Library>> {
         return this.groupBy {
             when (duplicateRule) {
                 DuplicateRule.GROUP -> it.groupId + it.licenses.joinToString(",")
                 DuplicateRule.SIMPLE -> it.groupId + it.name
                 DuplicateRule.EXACT -> it.groupId + it.name + it.description?.toMD5()
             }
-        }
+        }.values.flatMap { it.clusterByArtifactId() }
     }
 
     when (duplicateMode) {
         DuplicateMode.MERGE -> {
             val deDuplicatedList = mutableListOf<Library>()
-            mappedLibs().forEach { (_, group) ->
+            mappedLibs().forEach { group ->
                 val kept = if (group.size > 1) {
-                    // on duplicates, assumption is the shorter title is the base dependency
-                    group.minByOrNull { it.name?.length ?: it.description?.length ?: Int.MAX_VALUE } ?: group.first()
+                    // on duplicates, assumption is the shorter title is the base dependency; on a
+                    // tie (a KMP publication names every platform artifact identically) the
+                    // shortest id is the root module the others are platform variants of
+                    group.minWithOrNull(
+                        compareBy({ it.name?.length ?: it.description?.length ?: Int.MAX_VALUE }, { it.uniqueId.length })
+                    ) ?: group.first()
                 } else {
                     group.first()
                 }
@@ -41,7 +45,7 @@ fun List<Library>.processDuplicates(
         }
 
         DuplicateMode.LINK -> {
-            mappedLibs().forEach { (_, group) ->
+            mappedLibs().forEach { group ->
                 if (group.size > 1) {
                     val allAssociated = group.map { it.uniqueId }
                     group.forEach {
@@ -59,6 +63,33 @@ fun List<Library>.processDuplicates(
     }
 }
 
+/**
+ * Splits libraries the [DuplicateRule] considered equal into clusters that really are one library
+ * published under several coordinates: a Kotlin Multiplatform publication such as
+ * `androidx.collection:collection` + `collection-jvm`, where the platform artifact id is the root
+ * id plus a target suffix.
+ *
+ * Sibling modules of one project routinely share the POM `name` and `description` — e.g.
+ * `com.materialkolor:material-kolor` and `com.materialkolor:material-color-utilities`, both named
+ * "MaterialKolor" with the same description. Those are distinct libraries, and merging them
+ * silently dropped one of them.
+ */
+private fun List<Library>.clusterByArtifactId(): List<List<Library>> {
+    if (size < 2) return listOf(this)
+    // `Library.artifactId` is the full `group:artifact:version` — the module name is what a
+    // platform suffix is appended to
+    fun Library.module() = uniqueId.substringAfterLast(':')
+
+    // shortest first, so the root module is the one every platform artifact attaches to
+    val clusters = mutableListOf<Pair<String, MutableList<Library>>>() // root module -> members
+    for (library in sortedBy { it.module().length }) {
+        val module = library.module()
+        val cluster = clusters.firstOrNull { (root, _) -> module.startsWith("$root-") }
+        if (cluster != null) cluster.second += library else clusters += module to mutableListOf(library)
+    }
+    return clusters.map { it.second }
+}
+
 fun Library.merge(with: Library) {
     val orgLib = this
     with.name?.takeIf { it.isNotBlank() }?.also { orgLib.name = it }
```

**File**: `plugin-build/plugin/src/test/kotlin/com/mikepenz/aboutlibraries/plugin/KmpAndroidFunctionalTest.kt` (modified, +3/-2)
```diff
@@ -111,8 +111,9 @@ class KmpAndroidFunctionalTest {
         val content = File(projectDir, "build/generated/aboutLibraries/aboutlibraries.json").readText()
         val gson = extractLibraryEntry(content, "com.google.code.gson:gson")
             ?: error("gson entry not found in output: $content")
-        // resolves through the KMP `available-at` redirect, so it lands under its platform artifact
-        val annotation = extractLibraryEntry(content, "androidx.annotation:annotation-jvm")
+        // resolves through the KMP `available-at` redirect; the redirect shell and the platform
+        // artifact are merged onto the root module they share
+        val annotation = extractLibraryEntry(content, "androidx.annotation:annotation")
             ?: error("androidx.annotation entry not found in output: $content")
 
         // no raw configuration name may leak into the field
```

**File**: `plugin-build/plugin/src/test/kotlin/com/mikepenz/aboutlibraries/plugin/MergePlatformArtifactsFunctionalTest.kt` (modified, +4/-2)
```diff
@@ -97,10 +97,12 @@ class MergePlatformArtifactsFunctionalTest {
             ?: error("expected the declared root coordinate to be reported")
         assertEquals(setOf("js", "jvm"), targetsOf(merged) - "metadata", "Entry: $merged")
 
+        // without merging the platform artifacts are still collapsed by `DuplicateMode.MERGE`, but
+        // only into the root module they are variants of — their own ids are gone either way
         val unmerged = runKmpExport(mergePlatformArtifacts = false)
         assertFalse(
-            unmerged.contains("\"uniqueId\":\"androidx.collection:collection\","),
-            "without merging the survivor is a platform artifact, not the root. Output:\n$unmerged"
+            unmerged.contains("\"uniqueId\":\"androidx.collection:collection-js\","),
+            "platform artifacts must not survive the duplicate merge. Output:\n$unmerged"
         )
     }
 
```

**File**: `plugin-build/plugin/src/test/kotlin/com/mikepenz/aboutlibraries/plugin/util/LibraryUtilTest.kt` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+package com.mikepenz.aboutlibraries.plugin.util
+
+import com.mikepenz.aboutlibraries.plugin.DuplicateMode
+import com.mikepenz.aboutlibraries.plugin.DuplicateRule
+import com.mikepenz.aboutlibraries.plugin.mapping.Library
+import org.junit.jupiter.api.Assertions.assertEquals
+import org.junit.jupiter.api.Test
+
+class LibraryUtilTest {
+
+    private fun library(uniqueId: String, name: String, description: String = "Material You dynamic color") = Library(
+        uniqueId = uniqueId,
+        artifactVersion = "5.0.0",
+        name = name,
+        description = description,
+        website = null,
+        developers = emptyList(),
+        organization = null,
+        scm = null,
+    )
+
+    /**
+     * https://github.com/mikepenz/AboutLibraries/issues/1430 — sibling modules of one project share
+     * the POM `name` and `description`, which made every duplicate rule consider them equal. Only
+     * the platform artifacts of the *same* module may be merged.
+     */
+    @Test
+    fun `sibling modules sharing name and description are not merged`() {
+        val libraries = listOf(
+            library("com.materialkolor:material-kolor", "MaterialKolor"),
+            library("com.materialkolor:material-kolor-jvm", "MaterialKolor"),
+            library("com.materialkolor:material-color-utilities", "MaterialKolor"),
+            library("com.materialkolor:material-color-utilities-jvm", "MaterialKolor"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.EXACT)
+
+        assertEquals(
+            setOf("com.materialkolor:material-kolor", "com.materialkolor:material-color-utilities"),
+            result.map { it.uniqueId }.toSet(),
+        )
+    }
+
+    @Test
+    fun `platform artifacts of the same module are still merged`() {
+        val libraries = listOf(
+            library("androidx.collection:collection-jvm", "collection"),
+            library("androidx.collection:collection", "collection"),
+            library("androidx.collection:collection-js", "collection"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.EXACT)
+
+        assertEquals(listOf("androidx.collection:collection"), result.map { it.uniqueId })
+    }
+}
```

---

### Incident Patch 10: `4f7f4446` (2026-08-17)
**Commit Message**: Merge pull request #1448 from mikepenz/fix/merge-platform-artifacts-native-targets

fix(plugin): keep the KMP root module when `mergePlatformArtifacts` merges

**File**: `plugin-build/plugin/src/main/kotlin/com/mikepenz/aboutlibraries/plugin/AboutLibrariesExtension.kt` (modified, +4/-1)
```diff
@@ -470,7 +470,10 @@ abstract class LibraryConfig @Inject constructor() {
      * such root module (e.g. `androidx.annotation:annotation-jvm` in a graph that never resolves
      * `androidx.annotation:annotation`) is untouched — but once the root module is present, the
      * platform artifact is reported under it even where it was declared directly.
-     * Metadata (name, description, licenses) still comes from the resolved artifact.
+     * Metadata (name, description, licenses) comes from the root module's POM, which a Kotlin
+     * Multiplatform publication fills in identically to its platform artifacts'. It is also the
+     * only POM available for Kotlin/Native targets: a klib platform artifact resolves to no POM
+     * at all, so the root module is what keeps such a dependency (and its `targets`) reported.
      *
      * This is independent of [duplicationMode] / [duplicationRule] and applied before them. Note
      * that the default [DuplicateMode.MERGE] already collapses these artifacts onto *one* entry —
```

**File**: `plugin-build/plugin/src/main/kotlin/com/mikepenz/aboutlibraries/plugin/util/DependencyCollector.kt` (modified, +10/-3)
```diff
@@ -90,15 +90,22 @@ internal class DependencyCollector(
         val id = root.id
         // Non-null when this component is a pure Gradle `available-at` redirect (a KMP root module
         // such as `androidx.collection:collection` pointing at `androidx.collection:collection-jvm`).
-        // With `mergePlatformArtifacts` the shell itself is dropped and its module name is
-        // recorded, so the artifact it points at can be reported under the declared coordinate.
+        // With `mergePlatformArtifacts` its module name is recorded, so the artifact it points at
+        // can be reported under the declared coordinate.
         val redirectTarget = if (mergePlatformArtifacts) root.redirectTargetModule() else null
         var ignoreSuffix: String? = null
         when {
             redirectTarget != null -> {
                 id as ModuleComponentIdentifier
                 redirects["${id.group}:$redirectTarget"] = id.module
-                ignoreSuffix = " merge platform artifact $redirectTarget into ${id.module}"
+                // The shell is kept, not dropped: its coordinate already *is* the declared root id,
+                // so it deduplicates against the platform artifact rather than adding an entry. It
+                // is also the only one that survives for Kotlin/Native targets — a klib platform
+                // artifact (`…-iossimulatorarm64`) cannot be resolved by the attribute-less
+                // detached configuration that fetches POMs, so it yields no metadata and, without
+                // the shell, the dependency (and its `targets`) would vanish entirely.
+                destination += id.toDependencyCoordinates()
+                ignoreSuffix =" merge platform artifact $redirectTarget into ${id.module}"
             }
 
             id is ProjectComponentIdentifier -> {
```

**File**: `plugin-build/plugin/src/test/kotlin/com/mikepenz/aboutlibraries/plugin/MergePlatformArtifactsFunctionalTest.kt` (modified, +31/-4)
```diff
@@ -104,6 +104,30 @@ class MergePlatformArtifactsFunctionalTest {
         )
     }
 
+    /**
+     * A Kotlin/Native platform artifact (`androidx.collection:collection-linuxx64`) is a klib
+     * module: the attribute-less detached configuration that fetches POMs cannot choose between its
+     * variants, so it resolves to no POM and produces no metadata at all. Merging must therefore
+     * keep the `available-at` shell rather than trading it for an artifact that evaporates —
+     * otherwise the dependency loses its native `targets`, and a native-only one disappears.
+     *
+     * `filterVariants` narrows collection to the two target compile classpaths, which is what makes
+     * the loss observable: with every configuration collected the `metadata` one still contributes
+     * the root coordinate directly and masks it.
+     */
+    @Test
+    fun `native targets survive merging even though their platform artifact has no resolvable POM`() {
+        val json = runKmpExport(
+            mergePlatformArtifacts = true,
+            targets = listOf("jvm()", "iosSimulatorArm64()"),
+            collect = """all = true; includeTargets = true; filterVariants.addAll("jvmCompileClasspath", "iosSimulatorArm64CompileKlibraries")""",
+        )
+        val merged = extractEntry(json, "androidx.collection:collection")
+            ?: error("expected the declared root coordinate to be reported. Output:\n$json")
+
+        assertEquals(setOf("iosSimulatorArm64", "jvm"), targetsOf(merged), "Entry: $merged")
+    }
+
     private fun targetsOf(entry: String): Set<String> =
         Regex("\"targets\":\\[(.*?)]").find(entry)?.groupValues?.get(1)
             ?.split(",")?.mapNotNull { it.trim().trim('"').takeIf(String::isNotEmpty) }?.toSet()
@@ -130,7 +154,11 @@ class MergePlatformArtifactsFunctionalTest {
      * to `collection-jvm` on one and `collection-js` on the other. `duplicationMode` is left at its
      * default here — the point is what a normal consumer sees.
      */
-    private fun runKmpExport(mergePlatformArtifacts: Boolean): String {
+    private fun runKmpExport(
+        mergePlatformArtifacts: Boolean,
+        targets: List<String> = listOf("jvm()", "js { nodejs() }"),
+        collect: String = "includeTargets = true",
+    ): String {
         File(projectDir, "settings.gradle.kts").writeText(
             """
             pluginManagement { repositories { gradlePluginPortal(); mavenCentral(); google() } }
@@ -153,16 +181,15 @@ class MergePlatformArtifactsFunctionalTest {
             repositories { mavenCentral(); google() }
 
             extensions.configure<org.jetbrains.kotlin.gradle.dsl.KotlinMultiplatformExtension> {
-                jvm()
-                js { nodejs() }
+                ${targets.joinToString("\n                ")}
                 sourceSets.getByName("commonMain").dependencies {
                     implementation("androidx.collection:collection:1.5.0")
                 }
             }
 
             extensions.configure<com.mikepenz.aboutlibraries.plugin.AboutLibrariesExtension>("aboutLibraries") {
                 offlineMode = true
-                collect { includeTargets = true }
+                collect { $collect }
                 library { mergePlatformArtifacts = $mergePlatformArtifacts }
             }
             """.trimIndent()
```

#### Recent Merged Pull Requests:
- **PR #1466** (2026-09-27): Log stack trace when loading resource fails (@cketti)
- **PR #1465** (2026-09-08): chore(deps): update mike penz internal projects (@renovate-mike[bot])
- **PR #1461** (2026-08-28): dev -> main (@mikepenz)
- **PR #1460** (2026-08-28): chore(deps): update dependencies (Compose 1.12.0) (@mikepenz)
- **PR #1458** (2026-08-24): fix(deps): update dependency com.squareup.okhttp3:okhttp to v5.5.0 (@renovate-mike[bot])
- **PR #1457** (2026-08-23): chore(deps): update github/codeql-action action to v4.37.7 (@renovate-mike[bot])
- **PR #1456** (2026-08-21): dev -> main (@mikepenz)
- **PR #1455** (2026-08-21): refactor(plugin): cluster duplicates by the `available-at` redirect, not the artifact id (@mikepenz)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
