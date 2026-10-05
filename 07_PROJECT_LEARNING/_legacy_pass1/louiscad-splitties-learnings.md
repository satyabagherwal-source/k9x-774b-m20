# Forensic Learning Record (Deep Inspection): LouisCAD/Splitties

> **Canonical Artifact**: `07_PROJECT_LEARNING/louiscad-splitties-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/LouisCAD/Splitties](https://github.com/LouisCAD/Splitties))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:46:18.051Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `LouisCAD/Splitties`
- **Description**: A collection of hand-crafted extensions for your Kotlin projects.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2583 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #256** (2021-07-04): **The new shapeableImageView misses an entry in instantiateMaterialView and fails after R8**
  *Symptoms*: 

- **Issue #198** (2020-09-01): **If performClick is called more than once in a row, awaitOneClick crashes**
  *Symptoms*: Reproducer: ```kotlin val submitBtn = ctx.button {     text = "Submit" } launch {     delay(2500)     repeat(2) {         submitBtn.performClick() // Two clicks with no dispatch in between.     } } @UseExperimental(ExperimentalSplittiesApi::class) submitBtn.awaitOneClick() ```  This affects `awaitOneClick` and `awaitOneLongClick`. That happens because the `finally` block is executed only after `suspendCancellableCoroutine` resumes, which happens after `performClick` as been called a second time.  The fix is pretty easy. Instead of just waiting for the `finally` block to be executed to set the listener to null, it needs to be set to null in `setOnClickListener` lambda too.

- **Issue #191** (2019-05-02): **Handle empty grantResults in Permissions**
  *Symptoms*: [The documentation](https://developer.android.com/reference/android/app/Activity.html#onRequestPermissionsResult(int,%2520java.lang.String%5B%5D,%2520int%5B%5D)) states the following:  > Note: It is possible that the permissions request interaction with the user is interrupted. In this case you will receive empty permissions and results arrays which should be treated as a cancellation.  Currently, if this rare situation happens, an `ArrayOutOfBoundsException` is thrown and crashes the app.  This needs to be handled properly in the Permissions split.

- **Issue #128** (2018-11-02): **verticalChain property instead of horizontalChain**
  *Symptoms*: https://github.com/LouisCAD/Splitties/blob/b2e8f3263e24b744756f96347ef292356a135e8c/viewdsl-constraintlayout/src/main/java/splitties/viewdsl/constraintlayout/Chains.kt#L55

- **Issue #73** (2018-04-11): **TextInputLayout.text setter does not sets text.**
  *Symptoms*: https://github.com/LouisCAD/Splitties/blob/1810e0cb8fd008d5674329a3b335b0927d21da31/views-design/src/main/java/splitties/views/design/TextInputLayout.kt#L24  The setter `value` is not used, and current `text` is used instead. This needs to be fixed ASAP.  The IDE should have reported it, so I created an issue for it: https://youtrack.jetbrains.com/issue/KT-23710

- **Issue #34** (2018-02-28): **[Arch Lifecycle] activityScope extensions on Fragment uses Fragment scope**
  *Symptoms*: This is misleading and should be renamed to `fragmentScope`. `activityScope` can be provided using the host activity `ViewModelProvider` though.

- **Issue #27** (2018-02-27): **First line is not limited to the switch in IconTwoLinesSwitchListItem**
  *Symptoms*: Fixed by using this code: ```kotlin add(firstLine, lParams(height = wrapContent) {     startMargin = dip(72)     topMargin = dip(8)     endMargin = dip(8)     startOfParent()     topOfParent()     endToStart = switch.id }) ```

- **Issue #26** (2018-02-27): **Show toast**
  *Symptoms*: Fixes #25

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

### Incident Patch 1: `89cfcda5` (2023-04-05)
**Commit Message**: Improve API of toPendingXxx and fix binary compatibility

**File**: `modules/intents/src/androidMain/kotlin/splitties/intents/PendingIntents.kt` (modified, +19/-42)
```diff
@@ -9,82 +9,59 @@ import android.app.PendingIntent
 import android.content.Intent
 import android.os.Build.VERSION.SDK_INT
 import android.os.Bundle
-import splitties.bitflags.withFlag
 import splitties.init.appCtx
 
 /**
  * @param reqCode Can be left to default (0) if this [PendingIntent] is unique as defined from
  * [Intent.filterEquals].
  * @param options are ignored below API 16.
  */
-fun Intent.toPendingActivity(
+inline fun Intent.toPendingActivity(
     reqCode: Int = 0,
-    flags: Int = 0,
-    options: Bundle? = null,
-    mutable: Boolean = false
-): PendingIntent {
-    val actualFlags = flags.withMutability(mutable)
-    return if (SDK_INT >= 16) {
-        PendingIntent.getActivity(appCtx, reqCode, this, actualFlags, options)
-    } else PendingIntent.getActivity(appCtx, reqCode, this, actualFlags)
-}
+    flags: Int,
+    options: Bundle? = null
+): PendingIntent = if (SDK_INT >= 16) {
+    PendingIntent.getActivity(appCtx, reqCode, this, flags, options)
+} else PendingIntent.getActivity(appCtx, reqCode, this, flags)
 
 /**
  * @param reqCode Can be left to default (0) if this [PendingIntent] is unique as defined from
  * [Intent.filterEquals].
  * @param options are ignored below API 16.
  */
-fun Array<Intent>.toPendingActivities(
+inline fun Array<Intent>.toPendingActivities(
     reqCode: Int = 0,
-    flags: Int = 0,
-    options: Bundle? = null,
-    mutable: Boolean = false
-): PendingIntent {
-    val actualFlags = flags.withMutability(mutable)
-    return if (SDK_INT >= 16) {
-        PendingIntent.getActivities(appCtx, reqCode, this, actualFlags, options)
-    } else PendingIntent.getActivities(appCtx, reqCode, this, actualFlags)
-}
-
-@PublishedApi
-internal fun Int.withMutability(isMutable: Boolean): Int {
-    @Suppress("InlinedApi")
-    val mutabilityFlag = if (isMutable) PendingIntent.FLAG_MUTABLE else PendingIntent.FLAG_IMMUTABLE
-    return this.withFlag(mutabilityFlag)
-}
+    flags: Int,
+    options: Bundle? = null
+): PendingIntent = if (SDK_INT >= 16) {
+    PendingIntent.getActivities(appCtx, reqCode, this, flags, options)
+} else PendingIntent.getActivities(appCtx, reqCode, this, flags)
 
 /**
  * @param reqCode Can be left to default (0) if this [PendingIntent] is unique as defined from
  * [Intent.filterEquals].
  */
 fun Intent.toPendingForegroundService(
     reqCode: Int = 0,
-    flags: Int = 0,
-    mutable: Boolean = false
+    flags: Int
 ): PendingIntent = if (SDK_INT >= 26) {
-    PendingIntent.getForegroundService(appCtx, reqCode, this, flags.withMutability(mutable))
-} else toPendingService(reqCode, flags, mutable)
+    PendingIntent.getForegroundService(appCtx, reqCode, this, flags)
+} else toPendingService(reqCode, flags)
 
 /**
  * @param reqCode Can be left to default (0) if this [PendingIntent] is unique as defined from
  * [Intent.filterEquals].
  */
 inline fun Intent.toPendingService(
     reqCode: Int = 0,
-    flags: Int = 0,
-    mutable: Boolean = false
-): PendingIntent {
-    return PendingIntent.getService(appCtx, reqCode, this, flags.withMutability(mutable))
-}
+    flags: Int
+): PendingIntent = PendingIntent.getService(appCtx, reqCode, this, flags)
 
 /**
  * @param reqCode Can be left to default (0) if this [PendingIntent] is unique as defined from
  * [Intent.filterEquals].
  */
 inline fun Intent.toPendingBroadcast(
     reqCode: Int = 0,
-    flags: Int = 0,
-    mutable: Boolean = false
-): PendingIntent {
-    return PendingIntent.getBroadcast(appCtx, reqCode, this, flags.withMutability(mutable))
-}
+    flags: Int
+): PendingIntent = PendingIntent.getBroadcast(appCtx, reqCode, this, flags)
```

**File**: `modules/intents/src/androidMain/kotlin/splitties/intents/ToPendingIntent.kt` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+/*
+ * Copyright 2019-2023 Louis Cognault Ayeva Derman. Use of this source code is governed by the Apache 2.0 license.
+ */
+@file:Suppress("nothing_to_inline")
+
+package splitties.intents
+
+import android.app.PendingIntent
+import android.content.Intent
+import android.os.Build.VERSION.SDK_INT
+import android.os.Bundle
+import splitties.bitflags.withFlag
+import splitties.init.appCtx
+
+/**
+ * @param reqCode Can be left to default (0) if this [PendingIntent] is unique as defined from
+ * [Intent.filterEquals].
+ * @param options are ignored below API 16.
+ */
+inline fun Intent.toPendingActivity(
+    reqCode: Int = 0,
+    mutable: Boolean = false,
+    oneShot: Boolean = false,
+    cancelCurrent: Boolean = false,
+    options: Bundle? = null,
+    flags: Int = 0.withKnownFlags(mutable, oneShot, cancelCurrent)
+): PendingIntent = if (SDK_INT >= 16) {
+    PendingIntent.getActivity(appCtx, reqCode, this, flags, options)
+} else PendingIntent.getActivity(appCtx, reqCode, this, flags)
+
+/**
+ * @param reqCode Can be left to default (0) if this [PendingIntent] is unique as defined from
+ * [Intent.filterEquals].
+ * @param options are ignored below API 16.
+ */
+inline fun Array<Intent>.toPendingActivities(
+    reqCode: Int = 0,
+    mutable: Boolean = false,
+    oneShot: Boolean = false,
+    cancelCurrent: Boolean = false,
+    options: Bundle? = null,
+    flags: Int = 0.withKnownFlags(mutable, oneShot, cancelCurrent)
+): PendingIntent = if (SDK_INT >= 16) {
+    PendingIntent.getActivities(appCtx, reqCode, this, flags, options)
+} else PendingIntent.getActivities(appCtx, reqCode, this, flags)
+
+/**
+ * @param reqCode Can be left to default (0) if this [PendingIntent] is unique as defined from
+ * [Intent.filterEquals].
+ */
+fun Intent.toPendingForegroundService(
+    reqCode: Int = 0,
+    mutable: Boolean = false,
+    oneShot: Boolean = false,
+    cancelCurrent: Boolean = false,
+    flags: Int = 0.withKnownFlags(mutable, oneShot, cancelCurrent)
+): PendingIntent = if (SDK_INT >= 26) {
+    PendingIntent.getForegroundService(appCtx, reqCode, this, flags)
+} else PendingIntent.getService(appCtx, reqCode, this, flags)
+
+/**
+ * @param reqCode Can be left to default (0) if this [PendingIntent] is unique as defined from
+ * [Intent.filterEquals].
+ */
+inline fun Intent.toPendingService(
+    reqCode: Int = 0,
+    mutable: Boolean = false,
+    oneShot: Boolean = false,
+    cancelCurrent: Boolean = false,
+    flags: Int = 0.withKnownFlags(mutable, oneShot, cancelCurrent)
+): PendingIntent = PendingIntent.getService(appCtx, reqCode, this, flags)
+
+/**
+ * @param reqCode Can be left to default (0) if this [PendingIntent] is unique as defined from
+ * [Intent.filterEquals].
+ */
+inline fun Intent.toPendingBroadcast(
+    reqCode: Int = 0,
+    mutable: Boolean = false,
+    oneShot: Boolean = false,
+    cancelCurrent: Boolean = false,
+    flags: Int = 0.withKnownFlags(mutable, oneShot, cancelCurrent)
+): PendingIntent = PendingIntent.getBroadcast(appCtx, reqCode, this, flags)
+
+@PublishedApi
+internal fun Int.withKnownFlags(
+    isMutable: Boolean,
+    isOneShot: Boolean,
+    cancelCurrent: Boolean
+): Int {
+    var flags = this
+    @Suppress("InlinedApi")
+    val mutabilityFlag = if (isMutable) PendingIntent.FLAG_MUTABLE else PendingIntent.FLAG_IMMUTABLE
+    flags = flags.withFlag(mutabilityFlag)
+    val newFlag =  when {
+        isOneShot -> PendingIntent.FLAG_ONE_SHOT
+        cancelCurrent -> PendingIntent.FLAG_CANCEL_CURRENT
+        else -> PendingIntent.FLAG_UPDATE_CURRENT
+    }
+    flags = flags.withFlag(newFlag)
+    return flags
+}
```

---

### Incident Patch 2: `18b3b559` (2023-02-28)
**Commit Message**: Add tests for race and raceOf

**File**: `modules/coroutines/build.gradle.kts` (modified, +7/-0)
```diff
@@ -24,6 +24,13 @@ kotlin {
             api(splitties("experimental"))
             api(KotlinX.coroutines.core)
         }
+        commonTest {
+            dependencies {
+                implementation(Kotlin.test)
+                implementation(KotlinX.coroutines.test)
+                implementation(Testing.kotest.assertions.core)
+            }
+        }
         all {
             languageSettings.apply {
                 optIn("splitties.experimental.ExperimentalSplittiesApi")
```

**File**: `modules/coroutines/src/commonTest/kotlin/RacingTest.kt` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+package splitties.coroutines
+
+import io.kotest.matchers.booleans.shouldBeTrue
+import io.kotest.matchers.shouldBe
+import kotlinx.coroutines.*
+import kotlinx.coroutines.test.*
+import kotlin.test.Test
+import kotlin.time.Duration.Companion.milliseconds
+import kotlin.time.Duration.Companion.seconds
+
+/*
+ * Copyright 2023 Louis Cognault Ayeva Derman. Use of this source code is governed by the Apache 2.0 license.
+ */
+
+@OptIn(ExperimentalCoroutinesApi::class)
+class RacingTest {
+
+    @Test
+    fun testRace() = runTest {
+        var ran = false
+        var cancelledLateRacer = false
+        var cancelledSlowBuilder = false
+        val expectedResult = "Yup"
+        race {
+            launchRacer {
+                try {
+                    delay(10.milliseconds)
+                } catch (e: CancellationException) {
+                    cancelledLateRacer = true
+                    throw e
+                }
+                error("Nein")
+            }
+            launchRacer {
+                delay(5.milliseconds)
+                ran = true
+                expectedResult
+            }
+            try {
+                delay(1.seconds)
+            } catch (e: CancellationException) {
+                cancelledSlowBuilder = true
+                throw e
+            }
+            launchRacer {
+                error("Nope")
+            }
+        } shouldBe expectedResult
+        ran.shouldBeTrue()
+        cancelledLateRacer.shouldBeTrue()
+        cancelledSlowBuilder.shouldBeTrue()
+    }
+
+    @Test
+    fun testRaceOf() = runTest {
+        val expectedResult = "Yup"
+        raceOf({ expectedResult }) shouldBe expectedResult
+        raceOf({ expectedResult }, { "Nope" }) shouldBe expectedResult
+        raceOf({ yield(); "Nope" }, { expectedResult }) shouldBe expectedResult
+        var cancelledSlowRacer = false
+        raceOf({
+            try {
+                delay(2.milliseconds)
+            } catch (e: CancellationException) {
+                cancelledSlowRacer = true
+                throw e
+            }
+            "Nope"
+        }, {
+            delay(1.milliseconds)
+            expectedResult
+        }) shouldBe expectedResult
+        cancelledSlowRacer.shouldBeTrue()
+    }
+}
```

---

### Incident Patch 3: `ea3146b1` (2023-02-28)
**Commit Message**: Launch racers immediately (undispatched) in race

**File**: `modules/coroutines/src/commonMain/kotlin/splitties/coroutines/Racing.kt` (modified, +1/-0)
```diff
@@ -100,6 +100,7 @@ suspend fun <T> race(
                 if (raceWon) return // A racer already completed.
                 async(
                     context = builderJob,
+                    start = Undispatched,
                     block = block
                 ).onAwait { resultOfWinner: T ->
                     raceWon = true
```

---

### Incident Patch 4: `9b56df70` (2023-02-28)
**Commit Message**: Protect race from potential rare race condition

This commit simplifies the implementation of race,
all while making it immune to race conditions.

Such a thing could potentially happen if a racer was
launched after one won, on a separate thread,
before the `raceWon` boolean change was visible to that thread.
Consequence would be needlessly delaying the race end after
that last racer, despite the race having already been won.

Extremely unlikely, and probably never happened in the wild,
but now, it's impossible.

**File**: `modules/coroutines/src/commonMain/kotlin/splitties/coroutines/Racing.kt` (modified, +4/-16)
```diff
@@ -87,7 +87,6 @@ suspend fun <T> race(
     @BuilderInference
     builder: suspend RacingScope<T>.() -> Unit
 ): T = coroutineScope {
-    val racersAsyncList = mutableListOf<Deferred<T>>()
     @Suppress("RemoveExplicitTypeArguments")
     select<T> {
         val builderJob = Job(parent = coroutineContext[Job])
@@ -99,27 +98,16 @@ suspend fun <T> race(
             @Suppress("OverridingDeprecatedMember", "OVERRIDE_DEPRECATION")
             override fun launchRacerInternal(block: suspend CoroutineScope.() -> T) {
                 if (raceWon) return // A racer already completed.
-                async(block = block).also { racerAsync ->
-                    racersAsyncList += racerAsync
-                    if (raceWon) { // A racer just completed on another thread, cancel.
-                        racerAsync.cancel()
-                    }
-                }.onAwait { resultOfWinner: T ->
+                async(
+                    context = builderJob,
+                    block = block
+                ).onAwait { resultOfWinner: T ->
                     raceWon = true
                     builderJob.cancel()
-                    var i = 0
-                    // Since launchRacerInternal might be called on multiple threads concurrently,
-                    //  we don't use a forEach loop, but a while loop that is additions tolerant.
-                    while (i <= racersAsyncList.lastIndex) {
-                        val deferred: Deferred<T> = racersAsyncList[i]
-                        deferred.cancel()
-                        i++
-                    }
                     return@onAwait resultOfWinner
                 }
             }
         }
-        @OptIn(ExperimentalCoroutinesApi::class)
         launch(builderJob, start = Undispatched) {
             racingScope.builder()
         }
```

---

### Incident Patch 5: `60de1e41` (2023-02-28)
**Commit Message**: Simplify raceOf implementation

**File**: `modules/coroutines/build.gradle.kts` (modified, +0/-1)
```diff
@@ -22,7 +22,6 @@ kotlin {
     sourceSets {
         commonMain.dependencies {
             api(splitties("experimental"))
-            implementation(splitties("collections"))
             api(KotlinX.coroutines.core)
         }
         all {
```

**File**: `modules/coroutines/src/commonMain/kotlin/splitties/coroutines/Racing.kt` (modified, +9/-15)
```diff
@@ -6,15 +6,8 @@
 
 package splitties.coroutines
 
-import kotlinx.coroutines.CoroutineScope
-import kotlinx.coroutines.Deferred
-import kotlinx.coroutines.ExperimentalCoroutinesApi
-import kotlinx.coroutines.Job
-import kotlinx.coroutines.async
-import kotlinx.coroutines.coroutineScope
-import kotlinx.coroutines.launch
+import kotlinx.coroutines.*
 import kotlinx.coroutines.selects.select
-import splitties.collections.forEachByIndex
 import splitties.experimental.ExperimentalSplittiesApi
 import kotlin.experimental.ExperimentalTypeInference
 import kotlinx.coroutines.CoroutineStart.UNDISPATCHED as Undispatched
@@ -37,15 +30,16 @@ suspend fun <T> raceOf(): T = throw UnsupportedOperationException("A race needs
 suspend fun <T> raceOf(vararg racers: suspend CoroutineScope.() -> T): T {
     require(racers.isNotEmpty()) { "A race needs racers." }
     return coroutineScope {
+        val racersParent = Job(parent = coroutineContext[Job])
         @Suppress("RemoveExplicitTypeArguments")
         select<T> {
-            @OptIn(ExperimentalCoroutinesApi::class)
-            val racersAsyncList = racers.map {
-                async(start = Undispatched, block = it)
-            }
-            racersAsyncList.forEachByIndex { racer: Deferred<T> ->
-                racer.onAwait { resultOfWinner: T ->
-                    racersAsyncList.forEachByIndex { deferred: Deferred<T> -> deferred.cancel() }
+            racers.forEach { racer ->
+                async(
+                    context = racersParent,
+                    start = Undispatched,
+                    block = racer
+                ).onAwait { resultOfWinner: T ->
+                    racersParent.cancel()
                     return@onAwait resultOfWinner
                 }
             }
```

---

### Incident Patch 6: `320d9b7d` (2022-09-21)
**Commit Message**: Remove no longer needed workaround that used old Kotlin backend

**File**: `modules/views-dsl/build.gradle.kts` (modified, +0/-5)
```diff
@@ -34,8 +34,3 @@ kotlin {
         }
     }
 }
-
-tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
-    kotlinOptions.useOldBackend = true //TODO: Remove when https://youtrack.jetbrains.com/issue/KT-44972 is addressed.
-    // See this comment on why it's needed: https://youtrack.jetbrains.com/issue/KT-44972#focus=Comments-27-5014161.0-0
-}
```

#### Recent Merged Pull Requests:
- **PR #294** (2021-08-24): Fix documentation typos (@MrTheGood)
- **PR #292** (2021-08-20): Prepare for release 3.0.0 (@LouisCAD)
- **PR #291** (2021-08-16): Add DataStorePreferences (@LouisCAD)
- **PR #289** (2021-08-08): Use refreshVersions dependency notations and minor doc improvements (@LouisCAD)
- **PR #288** (2021-08-06): Prepare for release 3.0.0-rc03 (@LouisCAD)
- **PR #287** (2021-08-03): Prepare for release 3.0.0-rc02 (@LouisCAD)
- **PR #286** (2021-08-03): Fix inline styled resources (@LouisCAD)
- **PR #284** (2021-08-01): Prepare for release 3.0.0-rc01 (@LouisCAD)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
