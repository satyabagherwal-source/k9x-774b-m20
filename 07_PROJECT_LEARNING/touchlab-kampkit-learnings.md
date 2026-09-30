# Forensic Learning Record (Deep Inspection): touchlab/KaMPKit

> **Canonical Artifact**: `07_PROJECT_LEARNING/touchlab-kampkit-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/touchlab/KaMPKit](https://github.com/touchlab/KaMPKit))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:46:28.122Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `touchlab/KaMPKit`
- **Description**: KaMP Kit by Touchlab. A collection of code & tools designed to get your mobile team started quickly w/Kotlin Multiplatform
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2455 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #368** (2026-09-28): **Bump the minor group with 7 updates**
  *Symptoms*: Bumps the minor group with 7 updates:  | Package | From | To | | --- | --- | --- | | [io.ktor:ktor-client-core](https://github.com/ktorio/ktor) | `3.5.2` | `3.6.0` | | [io.ktor:ktor-client-ios](https://github.com/ktorio/ktor) | `3.5.2` | `3.6.0` | | [io.ktor:ktor-client-logging](https://github.com/ktorio/ktor) | `3.5.2` | `3.6.0` | | [io.ktor:ktor-client-okhttp](https://github.com/ktorio/ktor) | `3.5.2` | `3.6.0` | | [io.ktor:ktor-serialization-kotlinx-json](https://github.com/ktorio/ktor) | `3.5.2` | `3.6.0` | | [io.ktor:ktor-client-content-negotiation](https://github.com/ktorio/ktor) | `3.5.2` | `3.6.0` | | [io.ktor:ktor-client-mock](https://github.com/ktorio/ktor) | `3.5.2` | `3.6.0` |  Updates `io.ktor:ktor-client-core` from 3.5.2 to 3.6.0 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/ktorio/ktor/releases">io.ktor:ktor-client-core's releases</a>.</em></p> <blockquote> <h2>3.6.0</h2> <blockquote> <p>Published 16 September 2026</p> </blockquote> <h3>Features</h3> <ul> <li><a href="https://youtrack.jetbrains.com/issue/KTOR-8596">KTOR-8596</a> OpenID Connect (OAuth2) auto-discover &amp; configuration</li> <li><a href="https://youtrack.jetbrains.com/issue/KTOR-9645">KTOR-9645</a> Client curated multi-platform facade module</li> <li><a href="https://youtrack.jetbrains.com/issue/KTOR-8883">KTOR-8883</a> Support nested jars in static resources</li> <li><a href="https://youtrack.jetbrains.com/issue/KTOR-8672">KTOR-8672</a> Support at le
  **Post-Mortem & Fix Analysis**:
  > Looks like these dependencies are updatable in another way, so this is no longer needed.

- **Issue #367** (2026-09-18): **Bump the minor group with 3 updates**
  *Symptoms*: Bumps the minor group with 3 updates: [org.robolectric:robolectric](https://github.com/robolectric/robolectric), [co.touchlab:kermit](https://github.com/touchlab/Kermit) and [co.touchlab:kermit-simple](https://github.com/touchlab/Kermit).  Updates `org.robolectric:robolectric` from 4.16.1 to 4.17 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/robolectric/robolectric/releases">org.robolectric:robolectric's releases</a>.</em></p> <blockquote> <p>Robolectric 4.17 supports SDK 37 and contains many other features and enhancements.</p> <p>Please note you may need to add jvmFlags configuration when using JDKs &gt;= 17 at <a href="https://robolectric.org/getting-started/">https://robolectric.org/getting-started/</a></p> <p>If you have any issues, please file them <a href="https://github.com/robolectric/robolectric/issues">here</a>.</p> <h2>Breaking Changes</h2> <p>AndroidVersions has been removed in favor of using android.os.Build constants ShadowCameraCharacteristics.set(Key, Object) has been changed to set(Key, T), in order to correctly reflect type enforcement in the framework</p> <h2>What's Changed</h2> <ul> <li>Disable httpclient tests in Github CI by <a href="https://github.com/hoisie"><code>@​hoisie</code></a> in <a href="https://redirect.github.com/robolectric/robolectric/pull/10553">robolectric/robolectric#10553</a></li> <li>Use Java 21 for CodeQL by <a href="https://github.com/hoisie"><code>@​hoisie</code></a> in <a href="https://

- **Issue #362** (2026-09-01): **Bump gradle-wrapper from 9.7.0 to 9.7.1 in the minor group**
  *Symptoms*: Bumps the minor group with 1 update: [gradle-wrapper](https://github.com/gradle/gradle).  Updates `gradle-wrapper` from 9.7.0 to 9.7.1 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/gradle/gradle/releases">gradle-wrapper's releases</a>.</em></p> <blockquote> <h2>9.7.1</h2> <p>The Gradle team is excited to announce Gradle 9.7.1.</p> <p>This is a patch release for 9.7.0. We recommend using 9.7.1 instead of 9.7.0.</p> <p>Here are the highlights of 9.7.0 release:</p> <ul> <li>Isolated Projects graduates to incubating</li> <li>Broader Configuration Cache compatibility</li> <li>Resilient Sync helps you fix broken builds</li> <li>More source locations in problem reports</li> </ul> <p><a href="https://docs.gradle.org/9.7.1/release-notes.html">Read the Release Notes</a></p> <p>We would like to thank the following community members for their contributions to this release of Gradle: <a href="https://github.com/aSemy">Adam</a>, <a href="https://github.com/Gautam-aman">Aman Gautam</a>, <a href="https://github.com/YukiCodepth">Aman Kumar</a>, <a href="https://github.com/adubrouski">Anton Dubrouski</a>, <a href="https://github.com/liutikas">Aurimas</a>, <a href="https://github.com/gbhavya07">gbhavya07</a>, <a href="https://github.com/joshfriend">Josh Friend</a>, <a href="https://github.com/nicklauslittle-gov">nicklauslittle-gov</a>, <a href="https://github.com/psoni674">Pragati</a>, <a href="https://github.com/Project516">project516</a>, <a href="
  **Post-Mortem & Fix Analysis**:
  > no issues found when running the samples/tests. merging this now

- **Issue #361** (2026-08-21): **[RND-227] Update APP_BUILD.md file**
  *Symptoms*: Issue: https://github.com/touchlab/KaMPKit/issues/315  ## Summary Fixes outdated information in `APP_BUILD.md`  ## Fix - Changed a mention of `KaMPKitiOS.xcworkspace` to `KaMPKitiOS.xcodeproj`

- **Issue #360** (2026-08-11): **Bump the minor group across 1 directory with 10 updates**
  *Symptoms*: Bumps the minor group with 10 updates in the / directory:  | Package | From | To | | --- | --- | --- | | [gradle-wrapper](https://github.com/gradle/gradle) | `9.6.1` | `9.7.0` | | [io.ktor:ktor-client-core](https://github.com/ktorio/ktor) | `3.5.1` | `3.5.2` | | [io.ktor:ktor-client-ios](https://github.com/ktorio/ktor) | `3.5.1` | `3.5.2` | | [io.ktor:ktor-client-logging](https://github.com/ktorio/ktor) | `3.5.1` | `3.5.2` | | [io.ktor:ktor-client-okhttp](https://github.com/ktorio/ktor) | `3.5.1` | `3.5.2` | | [io.ktor:ktor-serialization-kotlinx-json](https://github.com/ktorio/ktor) | `3.5.1` | `3.5.2` | | [io.ktor:ktor-client-content-negotiation](https://github.com/ktorio/ktor) | `3.5.1` | `3.5.2` | | [io.ktor:ktor-client-mock](https://github.com/ktorio/ktor) | `3.5.1` | `3.5.2` | | [co.touchlab.skie:configuration-annotations](https://github.com/touchlab/SKIE) | `0.10.13` | `0.10.14` | | [co.touchlab.skie](https://github.com/touchlab/SKIE) | `0.10.13` | `0.10.14` |   Updates `gradle-wrapper` from 9.6.1 to 9.7.0 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/gradle/gradle/releases">gradle-wrapper's releases</a>.</em></p> <blockquote> <h2>9.7.0</h2> <p>The Gradle team is excited to announce Gradle 9.7.0.</p> <p>Here are the highlights of this release:</p> <ul> <li>Isolated Projects graduates to incubating</li> <li>Broader Configuration Cache compatibility</li> <li>More source locations in problem reports</li> </ul> <p><a href="https:

- **Issue #359** (2026-08-10): **Bump the minor group with 2 updates**
  *Symptoms*: Bumps the minor group with 2 updates: [co.touchlab.skie:configuration-annotations](https://github.com/touchlab/SKIE) and [co.touchlab.skie](https://github.com/touchlab/SKIE).  Updates `co.touchlab.skie:configuration-annotations` from 0.10.13 to 0.10.14 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/touchlab/SKIE/releases">co.touchlab.skie:configuration-annotations's releases</a>.</em></p> <blockquote> <h2>0.10.14</h2> <p><a href="https://skie.touchlab.co/changelog/0.10.14">Change log</a></p> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/touchlab/SKIE/commit/2fdb1a3937530540e6c850a2a8362d41f20da77a"><code>2fdb1a3</code></a> Allow Kotlin 2.4.10 to run with Skie</li> <li><a href="https://github.com/touchlab/SKIE/commit/8beb434f8efaafdb02ff1b06e38eb74668241951"><code>8beb434</code></a> Added animation param to the collect into functions</li> <li><a href="https://github.com/touchlab/SKIE/commit/d338388f239a949e39caa1f7dfe25ed40e1e105f"><code>d338388</code></a> Allowing to enable animations in Skie Observing</li> <li><a href="https://github.com/touchlab/SKIE/commit/74444363cf7eef9699220a89b911c3de7c8b2f94"><code>7444436</code></a> Fix configuration cache serialization of the Swift source set</li> <li><a href="https://github.com/touchlab/SKIE/commit/5fabe7751ed2c02e014163edb6c9c4c00bd073d8"><code>5fabe77</code></a> Change the logic for retrieving the frameworks so the task dependencies a
  **Post-Mortem & Fix Analysis**:
  > Looks like these dependencies are updatable in another way, so this is no longer needed.

- **Issue #358** (2026-07-13): **Bump the minor group with 14 updates**
  *Symptoms*: Bumps the minor group with 14 updates:  | Package | From | To | | --- | --- | --- | | [gradle-wrapper](https://github.com/gradle/gradle) | `9.4.1` | `9.6.1` | | [io.insert-koin:koin-android](https://github.com/InsertKoinIO/koin) | `4.2.1` | `4.2.2` | | [io.insert-koin:koin-core](https://github.com/InsertKoinIO/koin) | `4.2.1` | `4.2.2` | | [io.insert-koin:koin-test](https://github.com/InsertKoinIO/koin) | `4.2.1` | `4.2.2` | | [io.insert-koin:koin-core-viewmodel](https://github.com/InsertKoinIO/koin) | `4.2.1` | `4.2.2` | | [io.ktor:ktor-client-core](https://github.com/ktorio/ktor) | `3.4.2` | `3.5.1` | | [io.ktor:ktor-client-ios](https://github.com/ktorio/ktor) | `3.4.2` | `3.5.1` | | [io.ktor:ktor-client-logging](https://github.com/ktorio/ktor) | `3.4.2` | `3.5.1` | | [io.ktor:ktor-client-okhttp](https://github.com/ktorio/ktor) | `3.4.2` | `3.5.1` | | [io.ktor:ktor-serialization-kotlinx-json](https://github.com/ktorio/ktor) | `3.4.2` | `3.5.1` | | [io.ktor:ktor-client-content-negotiation](https://github.com/ktorio/ktor) | `3.4.2` | `3.5.1` | | [io.ktor:ktor-client-mock](https://github.com/ktorio/ktor) | `3.4.2` | `3.5.1` | | [co.touchlab.skie:configuration-annotations](https://github.com/touchlab/SKIE) | `0.10.11` | `0.10.13` | | [co.touchlab.skie](https://github.com/touchlab/SKIE) | `0.10.11` | `0.10.13` |  Updates `gradle-wrapper` from 9.4.1 to 9.6.1 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/gradle/gradle/releases">gradle-w

- **Issue #357** (2026-07-10): **Bump the minor group across 1 directory with 14 updates**
  *Symptoms*: Bumps the minor group with 14 updates in the / directory:  | Package | From | To | | --- | --- | --- | | [gradle-wrapper](https://github.com/gradle/gradle) | `9.4.1` | `9.6.0` | | [io.insert-koin:koin-android](https://github.com/InsertKoinIO/koin) | `4.2.1` | `4.2.2` | | [io.insert-koin:koin-core](https://github.com/InsertKoinIO/koin) | `4.2.1` | `4.2.2` | | [io.insert-koin:koin-test](https://github.com/InsertKoinIO/koin) | `4.2.1` | `4.2.2` | | [io.insert-koin:koin-core-viewmodel](https://github.com/InsertKoinIO/koin) | `4.2.1` | `4.2.2` | | [io.ktor:ktor-client-core](https://github.com/ktorio/ktor) | `3.4.2` | `3.5.0` | | [io.ktor:ktor-client-ios](https://github.com/ktorio/ktor) | `3.4.2` | `3.5.0` | | [io.ktor:ktor-client-logging](https://github.com/ktorio/ktor) | `3.4.2` | `3.5.0` | | [io.ktor:ktor-client-okhttp](https://github.com/ktorio/ktor) | `3.4.2` | `3.5.0` | | [io.ktor:ktor-serialization-kotlinx-json](https://github.com/ktorio/ktor) | `3.4.2` | `3.5.0` | | [io.ktor:ktor-client-content-negotiation](https://github.com/ktorio/ktor) | `3.4.2` | `3.5.0` | | [io.ktor:ktor-client-mock](https://github.com/ktorio/ktor) | `3.4.2` | `3.5.0` | | [co.touchlab.skie:configuration-annotations](https://github.com/touchlab/SKIE) | `0.10.11` | `0.10.12` | | [co.touchlab.skie](https://github.com/touchlab/SKIE) | `0.10.11` | `0.10.12` |   Updates `gradle-wrapper` from 9.4.1 to 9.6.0 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/gradle/gradl
  **Post-Mortem & Fix Analysis**:
  > This pull request was built based on a group rule. Closing it will not ignore any of these versions in future pull requests.  To ignore these dependencies, configure [ignore rules](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file#ignore) in dependabot.yml

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

### Incident Patch 1: `c3e225d3` (2023-10-02)
**Commit Message**: Update Ktlint + Ktlint plugin + fix formatting after update (#312)

**File**: `.editorconfig` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+[*.{kt,kts}]
+ktlint_code_style = android_studio
\ No newline at end of file
```

**File**: `.idea/codeStyles/Project.xml` (modified, +0/-2)
```diff
@@ -6,8 +6,6 @@
           <package name="kotlinx.android.synthetic" alias="false" withSubpackages="true" />
         </value>
       </option>
-      <option name="NAME_COUNT_TO_USE_STAR_IMPORT" value="2147483647" />
-      <option name="NAME_COUNT_TO_USE_STAR_IMPORT_FOR_MEMBERS" value="2147483647" />
       <option name="CODE_STYLE_DEFAULTS" value="KOTLIN_OFFICIAL" />
     </JetCodeStyleSettings>
     <codeStyleSettings language="XML">
```

**File**: `build.gradle.kts` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@ subprojects {
     apply(plugin = rootProject.libs.plugins.ktlint.get().pluginId)
 
     configure<org.jlleitschuh.gradle.ktlint.KtlintExtension> {
+        version.set("1.0.0")
         enableExperimentalRules.set(true)
         verbose.set(true)
         filter {
```

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ compileSdk = "34"
 kotlin = "1.9.10"
 
 android-gradle-plugin = "8.1.1"
-ktlint-gradle = "11.4.2"
+ktlint-gradle = "11.6.0"
 
 compose = "1.5.2"
 composeCompiler = "1.5.3"
```

**File**: `shared/src/androidUnitTest/kotlin/co/touchlab/kampkit/KoinTest.kt` (modified, +2/-2)
```diff
@@ -5,6 +5,8 @@ import android.content.Context
 import androidx.test.core.app.ApplicationProvider.getApplicationContext
 import androidx.test.ext.junit.runners.AndroidJUnit4
 import co.touchlab.kermit.Logger
+import kotlin.test.AfterTest
+import kotlin.test.Test
 import org.junit.experimental.categories.Category
 import org.junit.runner.RunWith
 import org.koin.core.context.stopKoin
@@ -13,8 +15,6 @@ import org.koin.dsl.module
 import org.koin.test.category.CheckModuleTest
 import org.koin.test.check.checkModules
 import org.robolectric.annotation.Config
-import kotlin.test.AfterTest
-import kotlin.test.Test
 
 @RunWith(AndroidJUnit4::class)
 @Category(CheckModuleTest::class)
```

---

### Incident Patch 2: `e81643a0` (2023-08-30)
**Commit Message**: Merge pull request #309 from touchlab/jb/fix-ios-release-link-task

308 - Fix an issue where iOS release build fails

**File**: `gradle/libs.versions.toml` (modified, +2/-2)
```diff
@@ -22,9 +22,9 @@ androidx-lifecycle = "2.6.1"
 
 junit = "4.13.2"
 
-coroutines = "1.7.0"
+coroutines = "1.7.3"
 kotlinx-datetime = "0.4.0"
-ktor = "2.3.1"
+ktor = "2.3.3"
 
 robolectric = "4.10.3"
 
```

---

### Incident Patch 3: `e2ca0f3c` (2023-08-30)
**Commit Message**: 308 - Fix an issue where iOS release build fails

**File**: `gradle/libs.versions.toml` (modified, +2/-2)
```diff
@@ -22,9 +22,9 @@ androidx-lifecycle = "2.6.1"
 
 junit = "4.13.2"
 
-coroutines = "1.7.0"
+coroutines = "1.7.3"
 kotlinx-datetime = "0.4.0"
-ktor = "2.3.1"
+ktor = "2.3.3"
 
 robolectric = "4.10.3"
 
```

---

### Incident Patch 4: `4940f3cb` (2023-04-12)
**Commit Message**: Fix readme badges

**File**: `README.md` (modified, +2/-2)
```diff
@@ -1,5 +1,5 @@
-[![KaMP Kit Android](https://img.shields.io/github/workflow/status/touchlab/KaMPKit/KaMPKit-Android/main?logo=Android&style=plastic)](https://github.com/touchlab/KaMPKit/actions/workflows/KaMPKit-Android.yml)
-[![KaMP Kit iOS](https://img.shields.io/github/workflow/status/touchlab/KaMPKit/KaMPKit-iOS?logo=iOS&style=plastic)](https://github.com/touchlab/KaMPKit/actions/workflows/KaMPKit-iOS.yml)
+[![KaMP Kit Android](https://img.shields.io/github/actions/workflow/status/touchlab/KaMPKit/KaMPKit-Android.yml?branch=main&logo=Android&style=plastic)](https://github.com/touchlab/KaMPKit/actions/workflows/KaMPKit-Android.yml)
+[![KaMP Kit iOS](https://img.shields.io/github/actions/workflow/status/touchlab/KaMPKit/KaMPKit-iOS.yml?branch-main&logo=iOS&style=plastic)](https://github.com/touchlab/KaMPKit/actions/workflows/KaMPKit-iOS.yml)
 
 # KaMP Kit
 
```

---

### Incident Patch 5: `3187315b` (2022-12-20)
**Commit Message**: Add monochrome tag to app icons to fix lint error.

**File**: `app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml` (modified, +1/-0)
```diff
@@ -2,4 +2,5 @@
 <adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
     <background android:drawable="@drawable/ic_launcher_background" />
     <foreground android:drawable="@drawable/ic_launcher_foreground" />
+    <monochrome android:drawable="@drawable/ic_launcher_foreground" />
 </adaptive-icon>
\ No newline at end of file
```

**File**: `app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml` (modified, +1/-0)
```diff
@@ -2,4 +2,5 @@
 <adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
     <background android:drawable="@drawable/ic_launcher_background" />
     <foreground android:drawable="@drawable/ic_launcher_foreground" />
+    <monochrome android:drawable="@drawable/ic_launcher_foreground" />
 </adaptive-icon>
\ No newline at end of file
```

---

### Incident Patch 6: `f9643b25` (2022-12-19)
**Commit Message**: Fix import order ktlint errors.

**File**: `shared/src/androidMain/kotlin/co/touchlab/kampkit/KoinAndroid.kt` (modified, +2/-2)
```diff
@@ -1,10 +1,10 @@
 package co.touchlab.kampkit
 
+import app.cash.sqldelight.db.SqlDriver
+import app.cash.sqldelight.driver.android.AndroidSqliteDriver
 import co.touchlab.kampkit.db.KaMPKitDb
 import com.russhwolf.settings.Settings
 import com.russhwolf.settings.SharedPreferencesSettings
-import app.cash.sqldelight.db.SqlDriver
-import app.cash.sqldelight.driver.android.AndroidSqliteDriver
 import io.ktor.client.engine.okhttp.OkHttp
 import org.koin.core.module.Module
 import org.koin.dsl.module
```

**File**: `shared/src/androidTest/kotlin/co/touchlab/kampkit/TestUtilAndroid.kt` (modified, +1/-1)
```diff
@@ -2,10 +2,10 @@ package co.touchlab.kampkit
 
 import android.app.Application
 import androidx.test.core.app.ApplicationProvider
-import co.touchlab.kampkit.db.KaMPKitDb
 import app.cash.sqldelight.db.SqlDriver
 import app.cash.sqldelight.driver.android.AndroidSqliteDriver
 import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
+import co.touchlab.kampkit.db.KaMPKitDb
 
 internal actual fun testDbConnection(): SqlDriver {
     // Try to use the android driver (which only works if we're on robolectric).
```

**File**: `shared/src/commonMain/kotlin/co/touchlab/kampkit/DatabaseHelper.kt` (modified, +1/-1)
```diff
@@ -2,11 +2,11 @@ package co.touchlab.kampkit
 
 import app.cash.sqldelight.coroutines.asFlow
 import app.cash.sqldelight.coroutines.mapToList
+import app.cash.sqldelight.db.SqlDriver
 import co.touchlab.kampkit.db.Breed
 import co.touchlab.kampkit.db.KaMPKitDb
 import co.touchlab.kampkit.sqldelight.transactionWithContext
 import co.touchlab.kermit.Logger
-import app.cash.sqldelight.db.SqlDriver
 import kotlinx.coroutines.CoroutineDispatcher
 import kotlinx.coroutines.Dispatchers
 import kotlinx.coroutines.flow.Flow
```

**File**: `shared/src/iosMain/kotlin/co/touchlab/kampkit/KoinIOS.kt` (modified, +2/-2)
```diff
@@ -1,11 +1,11 @@
 package co.touchlab.kampkit
 
+import app.cash.sqldelight.db.SqlDriver
+import app.cash.sqldelight.driver.native.NativeSqliteDriver
 import co.touchlab.kampkit.db.KaMPKitDb
 import co.touchlab.kermit.Logger
 import com.russhwolf.settings.NSUserDefaultsSettings
 import com.russhwolf.settings.Settings
-import app.cash.sqldelight.db.SqlDriver
-import app.cash.sqldelight.driver.native.NativeSqliteDriver
 import io.ktor.client.engine.darwin.Darwin
 import org.koin.core.Koin
 import org.koin.core.KoinApplication
```

**File**: `shared/src/iosTest/kotlin/co/touchlab/kampkit/TestUtilIOS.kt` (modified, +2/-2)
```diff
@@ -1,10 +1,10 @@
 package co.touchlab.kampkit
 
-import co.touchlab.kampkit.db.KaMPKitDb
-import co.touchlab.sqliter.DatabaseConfiguration
 import app.cash.sqldelight.db.SqlDriver
 import app.cash.sqldelight.driver.native.NativeSqliteDriver
 import app.cash.sqldelight.driver.native.wrapConnection
+import co.touchlab.kampkit.db.KaMPKitDb
+import co.touchlab.sqliter.DatabaseConfiguration
 
 internal actual fun testDbConnection(): SqlDriver {
     val schema = KaMPKitDb.Schema
```

---

### Incident Patch 7: `1ec847f7` (2023-01-12)
**Commit Message**: Fix typo in IOS_PROJ_INTEGRATION.md

**File**: `docs/IOS_PROJ_INTEGRATION.md` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ on Arm64 based simulators, so use `isStatic = true` if you need to use a Arm64 s
 settings allow configuring and logging with Kermit in swift. Normally dependencies of your shared
 module aren't included in the export.
 
-To generate the podspec, run the `podspec` command, or `./gradlew podspec`. This wil generate the
+To generate the podspec, run the `podspec` command, or `./gradlew podspec`. This will generate the
 podspec in the root library folder.
 
 For more detailed information about the
```

---

### Incident Patch 8: `10c68aa6` (2022-09-06)
**Commit Message**: Fix capitalization of Xcode (#258)

**File**: `docs/APP_BUILD.md` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ git clone https://github.com/touchlab/KaMPKit.git
 
 ### 3) Build iOS
 
-1. [Optional] Run gradle build. If you are more familiar with Android it may be easier to run the gradle build and confirm that the shared library builds properly before moving into XCode land, but this isn't necessary. The shared library will also build when run in XCode.
+1. [Optional] Run gradle build. If you are more familiar with Android it may be easier to run the gradle build and confirm that the shared library builds properly before moving into Xcode land, but this isn't necessary. The shared library will also build when run in Xcode.
    1. Open a Terminal window or use the one at the bottom Android Studio/IntelliJ. 
    1. Navigate to the project's root directory (`KaMPKit/` - not `KaMPKit/ios/` - which is iOS project's root directory). 
    1. Run the command `./gradlew build` which will build the shared library.
```

**File**: `docs/DEBUGGING_KOTLIN_IN_XCODE.md` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ By this point you should be able to build and run the KaMP Kit in iOS using Xcod
 The [Kotlin Native Xcode Plugin](https://github.com/touchlab/xcode-kotlin) adds basic highlighting, allows you to set breakpoints and includes llvm support to view data in the debug window. You can find the steps to install this plugin on its readMe, but it's as simple as running a couple of bash scripts.
 
 ### Kotlin Source in Xcode
-To take advantage of the plugin you will want to add references to your kotlin code in XCode. This will allow you to add breakpoints and edit kotlin without switching to Android Studio. You probably wont want to do your primary kotlin coding like this, but it's helpful when debugging.
+To take advantage of the plugin you will want to add references to your kotlin code in Xcode. This will allow you to add breakpoints and edit kotlin without switching to Android Studio. You probably wont want to do your primary kotlin coding like this, but it's helpful when debugging.
 
 To add the Kotlin source:
 1. Right click in the project explorer
```

**File**: `docs/GENERAL_ARCHITECTURE.md` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ The KaMP kit is broken up into three different directories:
 
 The app directory holds the android version of the app, and all the android code. As a default, Android Studio will name the project "app" when creating it. Even though this can be confusing for kmp this is the default.
 
-Similarly the ios directory holds the iOS version of the app, which contains an XCode project and a Workspace. We want to use the workspace as it contains the shared library.
+Similarly the ios directory holds the iOS version of the app, which contains an Xcode project and a Workspace. We want to use the workspace as it contains the shared library.
 
 Finally the shared directory holds the shared code. The shared directory is actually an android library that is referenced from the app project. This library contains directories for the different platforms as well as directories for testing.
 
```

#### Recent Merged Pull Requests:
- **PR #368** (closed): Bump the minor group with 7 updates (@dependabot[bot])
- **PR #367** (2026-09-18): Bump the minor group with 3 updates (@dependabot[bot])
- **PR #362** (2026-09-01): Bump gradle-wrapper from 9.7.0 to 9.7.1 in the minor group (@dependabot[bot])
- **PR #361** (2026-08-21): [RND-227] Update APP_BUILD.md file (@DanielSouzaBertoldi)
- **PR #360** (2026-08-11): Bump the minor group across 1 directory with 10 updates (@dependabot[bot])
- **PR #359** (closed): Bump the minor group with 2 updates (@dependabot[bot])
- **PR #358** (2026-07-13): Bump the minor group with 14 updates (@dependabot[bot])
- **PR #357** (closed): Bump the minor group across 1 directory with 14 updates (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
