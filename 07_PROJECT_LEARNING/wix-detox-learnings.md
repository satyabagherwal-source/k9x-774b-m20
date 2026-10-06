# Forensic Learning Record (Deep Inspection): wix/Detox

> **Canonical Artifact**: `07_PROJECT_LEARNING/wix-detox-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/wix/Detox](https://github.com/wix/Detox))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:35:23.066Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wix/Detox`
- **Description**: Gray box end-to-end testing and automation framework for mobile apps
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 12033 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `detox/android/detox/src/coreNative/java/com/wix/detox/actions/DetoxViewActions.kt`
```
package com.wix.detox.actions

import androidx.test.espresso.ViewAction
import androidx.test.espresso.action.GeneralClickAction
import androidx.test.espresso.action.GeneralLocation
import androidx.test.espresso.action.Press
import androidx.test.espresso.action.ViewActions.actionWithAssertions
import com.wix.detox.action.common.MOTION_DIR_DOWN
import com.wix.detox.action.common.MOTION_DIR_LEFT
import com.wix.detox.action.common.MOTION_DIR_RIGHT
import com.wix.detox.action.common.MOTION_DIR_UP
import com.wix.detox.espresso.action.DetoxCustomTapper
import com.wix.detox.espresso.scroll.DetoxScrollAction

public object DetoxViewActions {
    public fun tap() = multiTap(1)
    public fun doubleTap() = multiTap(2)
    public fun multiTap(times: Int): ViewAction =
        actionWithAssertions(GeneralClickAction(DetoxCustomTapper(times), GeneralLocation.CENTER, Press.FINGER, 0, 0))

    public fun scrollUpBy(amountInDp: Double, startOffsetPercentX: Float? = null, startOffsetPercentY: Float? = null): ViewAction =
        actionWithAssertions(DetoxScrollAction(MOTION_DIR_UP, amountInDp, startOffsetPercentX, startOffsetPercentY))

    public fun scrollDownBy(amountInDp: Double, startOffsetPercentX: Float? = null, startOffsetPercentY: Float? = null): ViewAction =
        actionWithAssertions(DetoxScrollAction(MOTION_DIR_DOWN, amountInDp, startOffsetPercentX, startOffsetPercentY))

    public fun scrollLeftBy(amountInDp: Double, startOffsetPercentX: Float? = null, startOffsetPercentY: Float? = null): ViewAction =
        actionWithAssertions(DetoxScrollAction(MOTION_DIR_LEFT, amountInDp, startOffsetPercentX, startOffsetPercentY))

    public fun scrollRightBy(amountInDp: Double, startOffsetPercentX: Float? = null, startOffsetPercentY: Float? = null): ViewAction =
        actionWithAssertions(DetoxScrollAction(MOTION_DIR_RIGHT, amountInDp, startOffsetPercentX, startOffsetPercentY))
}

```

### Core Architecture Module: `detox/android/detox/src/full/java/com/wix/detox/common/KotlinReflectUtils.kt`
```
@file:Suppress("UNCHECKED_CAST")

package com.wix.detox.common

import kotlin.reflect.full.memberFunctions
import kotlin.reflect.full.memberProperties
import kotlin.reflect.jvm.isAccessible

object KotlinReflectUtils {


    /**
     * This function should be used only on kotlin properties that have custom getters.
     * In Release builds, such properties are compiled away into getter methods.
     * In Debug builds, such properties exist as fields.
     */
    fun <T> getPropertyValueWithCustomGetter(instance: Any, propertyName: String): T? {
        // In Release builds, properties are compiled away into getter methods.
        val method = instance::class.memberFunctions.find { it.name == propertyName }
        if (method != null) {
            method.isAccessible = true
            return method.call(instance) as T?
        }

        // In debug builds, properties exist as fields.
        val property = instance::class.memberProperties.first { it.name == propertyName }
        property.isAccessible = true
        return (property as? kotlin.reflect.KProperty1<Any, *>)?.get(instance) as T?
    }

}

```

### Core Architecture Module: `detox/android/detox/src/full/java/com/wix/detox/espresso/errors/DetoxExceptionUtils.kt`
```
package com.wix.detox.espresso.errors

/**
 * Utility class for cleaning and processing Espresso exception messages.
 */
object DetoxExceptionUtils {
    fun cleanEspressoMessage(originalMessage: String?): String {
        val message = originalMessage ?: ""
        // Remove everything after "View Hierarchy:\n" (including it)
        return message.substringBefore("View Hierarchy:\n").trim()
    }
}

```

### Core Architecture Module: `detox/android/detox/src/full/java/com/wix/detox/reactnative/idlingresources/factory/LooperName.kt`
```
package com.wix.detox.reactnative.idlingresources.factory

enum class LooperName {
    JS,
    NativeModules
}

```

### Core Architecture Module: `detox/android/detox/src/full/java/com/wix/detox/reactnative/idlingresources/looper/MQThreadsReflector.kt`
```
package com.wix.detox.reactnative.idlingresources.looper

import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.ReactContext
import org.joor.Reflect
import org.joor.ReflectException


private const val LOG_TAG = "DetoxRNIdleRes"
private const val METHOD_GET_LOOPER = "getLooper"
private const val FIELD_NATIVE_MODULES_MSG_QUEUE = "mNativeModulesMessageQueueThread"
private const val FIELD_JS_MSG_QUEUE = "mJSMessageQueueThread"

internal class MQThreadsReflector(private val reactContext: ReactContext) {

    fun getJSMQueue(): MQThreadReflected? {
        return getQueue(FIELD_JS_MSG_QUEUE)
    }

    fun getNativeModulesQueue(): MQThreadReflected? {
        return getQueue(FIELD_NATIVE_MODULES_MSG_QUEUE)
    }

    private fun getQueue(queueName: String): MQThreadReflected? {
        try {
            val queue = Reflect.on(reactContext).field(queueName).get() as Any?
            return MQThreadReflected(queue, queueName)
        } catch (e: ReflectException) {
            Log.e(LOG_TAG, "Could not find queue: $queueName", e)
        }
        return null
    }
}

internal class MQThreadReflected(private val queue: Any?, private val queueName: String) {
    fun getLooper(): Looper? {
        try {
            if (queue != null) {
                return Reflect.on(queue).call(METHOD_GET_LOOPER).get()
            }
        } catch (e: ReflectException) {
            Log.e(LOG_TAG, "Could not find looper for queue: $queueName", e)
        }
        return null
    }
}

```

### Core Architecture Module: `detox/android/detox/src/full/java/com/wix/detox/reactnative/idlingresources/uimodule/paper/ViewCommandOpsQueueReflected.kt`
```
package com.wix.detox.reactnative.idlingresources.uimodule.paper

import android.util.Log
import com.facebook.react.uimanager.UIViewOperationQueue
import com.wix.detox.common.DetoxLog
import org.joor.Reflect
import org.joor.ReflectException

private const val FIELD_VIEW_COMMAND_OPERATIONS = "mViewCommandOperations"

class ViewCommandOpsQueueReflected(uiViewOperationQueueInstance: UIViewOperationQueue) {
    private val instance = Reflect.on(uiViewOperationQueueInstance)

    val size: Int?
        get() = viewCommandOperations()?.size

    fun firstCommandReflected() = DispatchCommandOperationReflected(firstCommand())

    private fun firstCommand() = viewCommandOperations()?.elementAt(0)
    private fun viewCommandOperations(): Collection<Any>? =
        try {
            instance.field(FIELD_VIEW_COMMAND_OPERATIONS).get<Collection<Any>>()
        } catch(e: ReflectException) {
            Log.e(DetoxLog.LOG_TAG, "could not get reflected field mViewCommandOperations ", e)
            null
        }
}

```

### Core Architecture Module: `detox/android/detox/src/full/java/com/wix/detox/reactnative/utils/RNUtils.kt`
```
package com.wix.detox.reactnative.utils

private const val REACT_NATIVE_PACKAGE = "com.facebook.react"

fun isReactNativeObject(obj: Any): Boolean =
    obj.javaClass.canonicalName?.startsWith(REACT_NATIVE_PACKAGE) == true

```

### Core Architecture Module: `detox/android/detox/src/main/java/com/wix/detox/common/ErrorUtils.kt`
```
package com.wix.detox.common

fun extractRootCause(t: Throwable): Throwable {
    var ex: Throwable = t
    while (ex.cause != null) {
        ex = ex.cause!!
    }
    return ex
}

```

### Core Architecture Module: `detox/android/detox/src/main/java/com/wix/detox/espresso/action/common/ReflectUtils.kt`
```
package com.wix.detox.espresso.action.common

object ReflectUtils {
    fun isAssignableFrom(source: Any, className: String) =
        try {
            Class.forName(className).isAssignableFrom(source.javaClass)
        } catch (ex: ClassNotFoundException) {
            false
        }
}

```

### Core Architecture Module: `detox/android/detox/src/main/java/com/wix/detox/espresso/action/common/utils/UiControllerUtils.kt`
```
@file:JvmName("UiControllerUtils")

package com.wix.detox.espresso.action.common.utils

import androidx.test.espresso.Espresso
import androidx.test.espresso.UiController
import org.hamcrest.core.IsAnything
import org.joor.Reflect

fun getUiController(): UiController? {
    val interaction = Espresso.onView(IsAnything())
    return Reflect.on(interaction).get<UiController>("uiController")
}

```

### Core Architecture Module: `detox/android/detox/src/main/java/com/wix/detox/espresso/action/common/utils/ViewInteractionExt.kt`
```
@file:JvmName("ViewInteractionExt")
package com.wix.detox.espresso.action.common.utils

import android.view.View
import androidx.test.espresso.ViewAction
import androidx.test.espresso.ViewInteraction
import org.hamcrest.Matcher
import org.hamcrest.Matchers


fun ViewInteraction.getView(): View  {
    var result: View? = null

    val viewAction = object : ViewAction {
        override fun getDescription(): String {
            return "Get View"
        }

        override fun getConstraints(): Matcher<View> {
            return Matchers.any(View::class.java)
        }

        override fun perform(uiController: androidx.test.espresso.UiController, view: View) {
            result = view
        }
    }

    perform(viewAction)

    return result ?: throw IllegalStateException("Failed to get view")
}


```

### Core Architecture Module: `detox/android/detox/src/main/java/com/wix/detox/espresso/utils/Vector2D.kt`
```
package com.wix.detox.espresso.utils

import com.wix.detox.common.DetoxErrors
import com.wix.detox.action.common.MOTION_DIR_DOWN
import com.wix.detox.action.common.MOTION_DIR_LEFT
import com.wix.detox.action.common.MOTION_DIR_RIGHT
import com.wix.detox.action.common.MOTION_DIR_UP
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

private fun frac(value: Double): Double =
    if (value < 0) -frac(-value) else (value - floor(value))

private fun normalize(value: Double): Double
    = if (value < 0) (1 + frac(value)) else frac(value)

private fun clockwise90DegRotationsToDown(direction: Int) = when (direction) {
    MOTION_DIR_LEFT -> 3
    MOTION_DIR_UP -> 2
    MOTION_DIR_RIGHT -> 1
    MOTION_DIR_DOWN -> 0
    else -> throw DetoxErrors.DetoxIllegalArgumentException("Unsupported swipe direction: $direction")
}

private fun angleBetween(fromDirection: Int, toDirection: Int): Int =
    90 * ((4 + clockwise90DegRotationsToDown(fromDirection) - clockwise90DegRotationsToDown(toDirection)) % 4)

data class Vector2D(val x: Double, val y: Double) {
    fun add(other: Vector2D) = Vector2D(x + other.x, y + other.y)

    fun normalize() = Vector2D(normalize(x), normalize(y))

    fun rotate(fromDirection: Int, toDirection: Int) =
            when (angleBetween(fromDirection, toDirection)) {
                90 -> Vector2D(y, -x)
                180 -> Vector2D(-x, -y)
                270 -> Vector2D(-y, x)
                else -> Vector2D(x, y)
            }

    fun scale(amountX: Double, amountY: Double = amountX) = Vector2D(x * amountX, y * amountY)

    fun scale(vector: Vector2D) = scale(vector.x, vector.y)

    fun trimMax(xMax: Double, yMax: Double = xMax) = Vector2D(max(x, xMax), max(y, yMax))

    fun trimMin(xMin: Double, yMin: Double = xMin) = Vector2D(min(x, xMin), min(y, yMin))

    fun withX(value: Double) = Vector2D(value, y)

    fun withY(value: Double) = Vector2D(x, value)

    companion object {
        fun from(arr: FloatArray) = Vector2D(arr[0].toDouble(), arr[1].toDouble())
        fun from(x: Int, y: Int) = Vector2D(x.toDouble(), y.toDouble())
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4960** (2026-06-16): **Update package.json version to 20.51.4**
  *Symptoms*: Automated version bump to 20.51.4 from CI release.

- **Issue #4959** (2026-06-16): **feat: accept RegExp and arrays for URL blacklist (setURLBlacklist / detoxURLBlacklistRegex)**
  *Symptoms*: ## Summary  - `device.setURLBlacklist()` and the `detoxURLBlacklistRegex` launch arg now accept `RegExp` objects and mixed arrays of `string | RegExp`, in addition to plain string arrays. - `RegExp` values are converted to portable inline-flag syntax (e.g. `(?i:pattern)`) so they work identically on both iOS and Android. Flags `g`, `y`, `d`, `u`, and `v` are rejected with a clear error since they have no cross-platform equivalent. - TypeScript types updated: `setURLBlacklist(urls: Array<string | RegExp>)`.  ## Test plan  - [x] Unit tests added for the new `urlBlacklist.js` utility (flag stripping, error cases, serialization for iOS/Android). - [x] Unit tests added for `instrumentationArgs.js` (Android) and `AppleSimUtils.js` (iOS) serialization paths. - [x] Manually verify `setURLBlacklist([/.*my\.api\.*/i])` suppresses synchronization on a matching URL on both platforms.  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #4957** (2026-05-30): **Update package.json version to 20.51.3**
  *Symptoms*: Automated version bump to 20.51.3 from CI release.

- **Issue #4956** (2026-10-04): **build(cli): replace execa with native spawn in AppStartCommand**
  *Symptoms*: Closes #4930. Inspired by @stianjensen's original PR — tinyexec was the first choice but caused Windows CI failures due to `windowsHide`, PATH augmentation, and `path.normalize()` behaviors that execa never had. Production code now uses Node's built-in `child_process.spawn()` instead; tinyexec is kept for the integration test runner.  ## Changes  **`AppStartCommand.js`** - Replaces `execa.command(cmd, {shell:true})` with `spawn(cmd, [], {shell:true})` — equivalent behavior, zero new production dependencies. - `stop()` now sends SIGTERM then escalates to SIGKILL after 5 seconds if the process hasn't exited (restores original behavior that was lost in earlier drafts).  **Integration tests** (`detox/test/integration/`) - Replaces synchronous `execa.commandSync()` with async `tinyexec.x()` in `bail-test.test.js` and `initialization-test.test.js`.  **Package changes** - `execa` removed from production `dependencies`. - `tinyexec` added to `devDependencies` (only used in integration tests).  **New `AppStartCommand.test.js`** - Unit tests for the SIGKILL escalation path using `jest.useFakeTimers()`, covering lines that were missing from the coverage threshold.  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #4955** (2026-05-30): **feat(ios): add regex support for toHaveText**
  *Symptoms*: ## Summary  - Builds on #4951 (cherry-picked @omribz156's type declaration commit) - Wires up the existing `matchesJSRegex` utility (already used by `ValuePredicate` for `by.text`/`by.id`/`by.label`) to the `ValueExpectation` path so `toHaveText(/regex/)` works on iOS, matching Android behaviour - JS side: `toHaveText` now serialises a `RegExp` as `text.toString()` + a boolean `isRegex` flag in params — same convention as `by.*` matchers - Swift side: `ValueExpectation` gains an `isRegex` field; `evaluate` branches to `matchesJSRegex` when set; factory reads the flag from `params[1]` - Docs updated: regex example, link to supported flags, and a note that the regex must match the **entire** element text on both platforms (no partial matching)  ## Test plan  - [x] `yarn jest src/ios/expectTwo.test.js` — unit test for invocation serialisation - [x] New e2e tests in `04.assertions.test.js`: `toHaveText(/regex/)` (positive) and `not.toHaveText(/regex/)` (negative) against a real element  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #4954** (2026-05-30): **Update package.json version to 20.51.3-smoke.0**
  *Symptoms*: Automated version bump to 20.51.3-smoke.0 from CI release.

- **Issue #4953** (2026-05-29): **Update package.json version to 20.51.2**
  *Symptoms*: Automated version bump to 20.51.2 from CI release.

- **Issue #4952** (2026-05-30): **chore: bump DetoxSync to latest commit**
  *Symptoms*: Bump the DetoxSync submodule from 3660cfa to c89e418 (DetoxSync origin/master).\n\nThis updates wix/Detox to the latest upstream DetoxSync commit currently available.

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

### Incident Patch 1: `d80a5740` (2026-06-16)
**Commit Message**: Update package.json version to 20.51.4 [buildkite skip]

**File**: `detox-cli/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "detox-cli",
-  "version": "20.51.3",
+  "version": "20.51.4",
   "description": "Optional wrapper for Detox CLI, meant to be installed globally",
   "main": "cli.js",
   "scripts": {
```

**File**: `detox/package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "detox",
   "description": "E2E tests and automation for mobile",
-  "version": "20.51.3",
+  "version": "20.51.4",
   "bin": "local-cli/cli.js",
   "files": [
     "android",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -67,5 +67,5 @@
     "unified": "^10.1.0",
     "zx": "^8.0.0"
   },
-  "version": "20.51.3"
+  "version": "20.51.4"
 }
```

---

### Incident Patch 2: `4b84d9c0` (2026-05-20)
**Commit Message**: fix(types): allow regex in toHaveText

**File**: `detox/detox.d.ts` (modified, +3/-2)
```diff
@@ -1516,9 +1516,10 @@ declare global {
             /**
              * In React Native apps, expect UI component of type <Text> to have text.
              * In native iOS apps, expect UI elements of type UIButton, UILabel, UITextField or UITextViewIn to have inputText with text.
-             * @example await expect(element(by.id('mainTitle'))).toHaveText('Welcome back!);
+             * @example await expect(element(by.id('mainTitle'))).toHaveText('Welcome back!');
+             * @example await expect(element(by.id('dynamicTitle'))).toHaveText(/^Welcome back/);
              */
-            toHaveText(text: string): R;
+            toHaveText(text: string | RegExp): R;
 
             /**
              * Expects a specific accessibilityLabel, as specified via the `accessibilityLabel` prop in React Native.
```

**File**: `detox/test/types/detox-global-tests.ts` (modified, +2/-0)
```diff
@@ -80,9 +80,11 @@ describe("Test", () => {
         await expectElement.toBeFocused();
         await expectElement.not.toBeFocused();
         await expectElement.toBeNotFocused();
+        await expectElement.toHaveText(/dynamic text/);
 
         const waitForElement = waitFor(element(by.id("element")));
         await waitForElement.toBeVisible().withTimeout(2000);
+        await waitForElement.toHaveText(/dynamic text/).withTimeout(2000);
 
         await device.pressBack();
         await device.reverseTcpPort(32167);
```

**File**: `detox/test/types/detox-module-tests.ts` (modified, +4/-0)
```diff
@@ -60,6 +60,7 @@ describe('Test', () => {
     await element(by.id('element')).scroll(50, 'down', 0.5, 0.5);
     await element(by.id('scrollView')).scrollTo('bottom');
     await expect(element(by.id('element')).atIndex(0)).toNotExist();
+    await expect(element(by.id('element'))).toHaveText(/dynamic text/);
     await element(by.id('scrollView')).swipe('down', 'fast', 0.2, 0.5, 0.5);
     await element(by.type('UIPickerView')).setColumnToValue(1, '6');
 
@@ -69,6 +70,9 @@ describe('Test', () => {
     await waitFor(element(by.id('element')))
       .toBeVisible()
       .withTimeout(2000);
+    await waitFor(element(by.id('element')))
+      .toHaveText(/dynamic text/)
+      .withTimeout(2000);
     await device.pressBack();
     await waitFor(element(by.text('Text5')))
       .toBeVisible()
```

---

### Incident Patch 3: `57a6efdc` (2026-05-30)
**Commit Message**: Update package.json version to 20.51.3 [buildkite skip]

**File**: `detox-cli/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "detox-cli",
-  "version": "20.51.3-smoke.0",
+  "version": "20.51.3",
   "description": "Optional wrapper for Detox CLI, meant to be installed globally",
   "main": "cli.js",
   "scripts": {
```

**File**: `detox/package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "detox",
   "description": "E2E tests and automation for mobile",
-  "version": "20.51.3-smoke.0",
+  "version": "20.51.3",
   "bin": "local-cli/cli.js",
   "files": [
     "android",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -67,5 +67,5 @@
     "unified": "^10.1.0",
     "zx": "^8.0.0"
   },
-  "version": "20.51.3-smoke.0"
+  "version": "20.51.3"
 }
```

---

### Incident Patch 4: `68402287` (2026-05-30)
**Commit Message**: chore: bump DetoxSync to 90f9935 (fixes verbose sync logging deadlock on serial queue)

Co-Authored-By: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `detox/ios/DetoxSync` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 763e8c0282187d5fdf146f623fcda777a3728ffd
+Subproject commit 90f993520d8076ba42c089527d236f8cd86b123b
```

---

### Incident Patch 5: `4d5b324f` (2026-05-29)
**Commit Message**: Update package.json version to 20.51.3-smoke.0 [buildkite skip]

**File**: `detox-cli/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "detox-cli",
-  "version": "20.51.2",
+  "version": "20.51.3-smoke.0",
   "description": "Optional wrapper for Detox CLI, meant to be installed globally",
   "main": "cli.js",
   "scripts": {
```

**File**: `detox/package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "detox",
   "description": "E2E tests and automation for mobile",
-  "version": "20.51.2",
+  "version": "20.51.3-smoke.0",
   "bin": "local-cli/cli.js",
   "files": [
     "android",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -67,5 +67,5 @@
     "unified": "^10.1.0",
     "zx": "^8.0.0"
   },
-  "version": "20.51.2"
+  "version": "20.51.3-smoke.0"
 }
```

---

### Incident Patch 6: `d5269179` (2026-05-29)
**Commit Message**: Update package.json version to 20.51.2 [buildkite skip]

**File**: `detox-cli/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "detox-cli",
-  "version": "20.51.1",
+  "version": "20.51.2",
   "description": "Optional wrapper for Detox CLI, meant to be installed globally",
   "main": "cli.js",
   "scripts": {
```

**File**: `detox/package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "detox",
   "description": "E2E tests and automation for mobile",
-  "version": "20.51.1",
+  "version": "20.51.2",
   "bin": "local-cli/cli.js",
   "files": [
     "android",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -67,5 +67,5 @@
     "unified": "^10.1.0",
     "zx": "^8.0.0"
   },
-  "version": "20.51.1"
+  "version": "20.51.2"
 }
```

---

### Incident Patch 7: `5a46f173` (2026-05-29)
**Commit Message**: chore: bump DetoxSync to 763e8c0 (PR#100: thread-safe URLSession untrack, fixes Signal 11)

**File**: `detox/ios/DetoxSync` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit c89e418f6e720a2aeeca54d078fb9ce48697836f
+Subproject commit 763e8c0282187d5fdf146f623fcda777a3728ffd
```

---

### Incident Patch 8: `4cdea564` (2026-05-30)
**Commit Message**: fix(android): quote adb device serials (#4950)

**File**: `detox/src/devices/common/drivers/android/exec/ADB.js` (modified, +1/-1)
```diff
@@ -388,7 +388,7 @@ class ADB {
   }
 
   async adbCmd(deviceId, params, options = {}) {
-    const serial = `${deviceId ? `-s ${deviceId}` : ''}`;
+    const serial = `${deviceId ? `-s "${escape.inQuotedString(deviceId)}"` : ''}`;
     const cmd = `"${this.adbBin}" ${serial} ${params}`;
     const _options = {
       ...this.defaultExecOptions,
```

**File**: `detox/src/devices/common/drivers/android/exec/ADB.test.js` (modified, +22/-12)
```diff
@@ -108,7 +108,17 @@ describe('ADB', () => {
     await adb.waitForDevice(deviceId);
 
     expect(execWithRetriesAndLogs).toHaveBeenCalledWith(
-      expect.stringContaining(`"${adbBinPath}" -s ${deviceId} wait-for-device`),
+      expect.stringContaining(`"${adbBinPath}" -s "${deviceId}" wait-for-device`),
+      expect.any(Object));
+  });
+
+  it('should quote device serials used in shell commands', async () => {
+    const mdnsDeviceId = 'adb-5721009297-Rq3U4s (2)._adb-tls-connect._tcp';
+
+    await adb.waitForDevice(mdnsDeviceId);
+
+    expect(execWithRetriesAndLogs).toHaveBeenCalledWith(
+      expect.stringContaining(`"${adbBinPath}" -s "${mdnsDeviceId}" wait-for-device`),
       expect.any(Object));
   });
 
@@ -196,11 +206,11 @@ describe('ADB', () => {
     await adb.setLocation(deviceId, lat, lon);
 
     expect(execWithRetriesAndLogs).toHaveBeenCalledWith(
-      expect.stringContaining(`-s mockEmulator emu "geo fix -70.5 30.5"`),
+      expect.stringContaining(`-s "mockEmulator" emu "geo fix -70.5 30.5"`),
       expect.anything());
 
     expect(execWithRetriesAndLogs).toHaveBeenCalledWith(
-      expect.stringContaining(`-s mockEmulator emu "geo fix -70,5 30,5"`),
+      expect.stringContaining(`-s "mockEmulator" emu "geo fix -70,5 30,5"`),
       expect.anything());
   });
 
@@ -222,7 +232,7 @@ describe('ADB', () => {
     await adb.push(deviceId, sourceFile, destFile);
 
     expect(execWithRetriesAndLogs).toHaveBeenCalledWith(
-      expect.stringContaining(`-s mockEmulator push "${sourceFile}" "${destFile}"`),
+      expect.stringContaining(`-s "mockEmulator" push "${sourceFile}" "${destFile}"`),
       expect.anything());
   });
 
@@ -266,7 +276,7 @@ describe('ADB', () => {
     const expectedText = 'some-text-with%sspaces';
     await adb.typeText(deviceId, text);
     expect(execWithRetriesAndLogs).toHaveBeenCalledWith(
-      expect.stringContaining(`-s mockEmulator shell "input text ${expectedText}"`),
+      expect.stringContaining(`-s "mockEmulator" shell "input text ${expectedText}"`),
       expect.anything());
   });
 
@@ -393,37 +403,37 @@ describe('ADB', () => {
   describe('animation disabling', () => {
     it('should disable animator (e.g. ObjectAnimator) animations', async () => {
       await adb.disableAndroidAnimations(deviceId);
-      expect(execWithRetriesAndLogs).toHaveBeenCalledWith(`"${adbBinPath}" -s ${deviceId} shell "settings put global animator_duration_scale 0"`, { retries: 1 });
+      expect(execWithRetriesAndLogs).toHaveBeenCalledWith(`"${adbBinPath}" -s "${deviceId}" shell "settings put global animator_duration_scale 0"`, { retries: 1 });
     });
 
     it('should disable window animations', async () => {
       await adb.disableAndroidAnimations(deviceId);
-      expect(execWithRetriesAndLogs).toHaveBeenCalledWith(`"${adbBinPath}" -s ${deviceId} shell "settings put global window_animation_scale 0"`, { retries: 1 });
+      expect(execWithRetriesAndLogs).toHaveBeenCalledWith(`"${adbBinPath}" -s "${deviceId}" shell "settings put global window_animation_scale 0"`, { retries: 1 });
     });
 
     it('should disable transition (e.g. activity launch) animations', async () => {
       await adb.disableAndroidAnimations(deviceId);
-      expect(execWithRetriesAndLogs).toHaveBeenCalledWith(`"${adbBinPath}" -s ${deviceId} shell "settings put global transition_animation_scale 0"`, { retries: 1 });
+      expect(execWithRetriesAndLogs).toHaveBeenCalledWith(`"${adbBinPath}" -s "${deviceId}" shell "settings put global transition_animation_scale 0"`, { retries: 1 });
     });
   });
 
   describe('WiFi toggle', () => {
     it('should enable wifi', async () => {
       await adb.setWiFiToggle(deviceId, true);
-      expect(execWithRetriesAndLogs).toHaveBeenCalledWith(`"${adbBinPath}" -s ${deviceId} shell "svc wifi enable"`, { retries: 1 });
+      expect(execWithRetriesAndLogs).toHaveBeenCalledWith(`"${adbBinPath}" -s "${deviceId}" shell "svc wifi enable"`, { retries: 1 });
     });
 
     it('should disable wifi', async () => {
       await adb.setWiFiToggle(deviceId, false);
-      expect(execWithRetriesAndLogs).toHaveBeenCalledWith(`"${adbBinPath}" -s ${deviceId} shell "svc wifi disable"`, { retries: 1 });
+      expect(execWithRetriesAndLogs).toHaveBeenCalledWith(`"${adbBinPath}" -s "${deviceId}" shell "svc wifi disable"`, { retries: 1 });
     });
   });
 
   describe('clearAppData', () => {
     it('should invoke pm clear for given package', async () => {
       await adb.clearAppData(deviceId, 'com.example.app');
       expect(execWithRetriesAndLogs).toHaveBeenCalledWith(
-        expect.stringContaining(`"${adbBinPath}" -s ${deviceId} shell "pm clear com.example.app"`),
+        expect.stringContaining(`"${adbBinPath}" -s "${deviceId}" shell "pm clear com.example.app"`),
         expect.any(Object)
       );
     });
@@ -438,7 +448,7 @@ describe('ADB', () => {
     it('should invoke pm grant --all-permissions for given package', async () => {
       await 
```

---

### Incident Patch 9: `cf6402c5` (2026-05-30)
**Commit Message**: fix(sync): accept null one-time event objects (#4949)

**File**: `detox/src/client/actions/SyncStatusSchema.json` (modified, +4/-1)
```diff
@@ -114,7 +114,10 @@
                         "type":"string"
                       },
                       "object":{
-                        "type":"string"
+                        "type":[
+                          "string",
+                          "null"
+                        ]
                       }
                     },
                     "required":[
```

**File**: `detox/src/client/actions/formatters/SyncStatusFormatter.test.js` (modified, +17/-0)
```diff
@@ -150,6 +150,23 @@ describe('Sync Status Formatter', () => {
       await expect(format(busyStatus)).toMatchSnapshot();
     });
 
+    it('should format "one_time_events" correctly when object is null', async () => {
+      let busyStatus = {
+        app_status: 'busy',
+        busy_resources: [
+          {
+            name: 'one_time_events',
+            description: {
+              event: 'foo',
+              object: null
+            }
+          }
+        ]
+      };
+
+      await expect(format(busyStatus)).toMatchSnapshot();
+    });
+
     it('should format "one_time_events" correctly', async () => {
       let busyStatus = {
         app_status: 'busy',
```

**File**: `detox/src/client/actions/formatters/__snapshots__/SyncStatusFormatter.test.js.snap` (modified, +5/-0)
```diff
@@ -176,6 +176,11 @@ exports[`Sync Status Formatter busy status should format "one_time_events" corre
 • The event "foo" is taking place with object: "bar"."
 `;
 
+exports[`Sync Status Formatter busy status should format "one_time_events" correctly when object is null 1`] = `
+"The app is busy with the following tasks:
+• The event "foo" is taking place."
+`;
+
 exports[`Sync Status Formatter busy status should format "one_time_events" correctly when there is no object 1`] = `
 "The app is busy with the following tasks:
 • The event "foo" is taking place."
```

**File**: `detox/src/client/actions/formatters/sync-resources/OneTimeEventsFormatter.js` (modified, +1/-1)
```diff
@@ -3,6 +3,6 @@ const { makeResourceTitle } = require('./utils');
 module.exports = function(properties) {
   const objectName = properties.object;
   return makeResourceTitle(
-    `The event "${properties.event}" is taking place${(objectName === undefined) ? `.` : ` with object: "${objectName}".`}`
+    `The event "${properties.event}" is taking place${(objectName == null) ? `.` : ` with object: "${objectName}".`}`
   );
 };
```

---

### Incident Patch 10: `27ddf83c` (2026-05-12)
**Commit Message**: fix(android): Catch errors in WebView injection (#4943)

Co-authored-by: mark.dev <[REDACTED_EMAIL]>

**File**: `detox/android/detox/src/full/java/com/wix/detox/espresso/hierarchy/ViewHierarchyGenerator.kt` (modified, +5/-1)
```diff
@@ -19,6 +19,7 @@ import kotlin.coroutines.resume
 
 private const val GET_HTML_SCRIPT = """
 (function() {
+  try {
     const blacklistedTags = ['script', 'style', 'head', 'meta'];
     const blackListedTagsSelector = blacklistedTags.join(',');
 
@@ -38,7 +39,10 @@ private const val GET_HTML_SCRIPT = """
     var serializedHtml = serializer.serializeToString(clonedDoc);
 
     // Return the serialized HTML as a string
-    return serializedHtml;
+    return serializedHtml;       
+  } catch {
+    return '<html xmlns="http://www.w3.org/1999/xhtml"><body></body></html>';    
+  }
 })();
 """
 
```

---

### Incident Patch 11: `650e4c5e` (2026-05-12)
**Commit Message**: fix(ios): use --booted flag for biometric commands on iOS 26+ (#4932)

Co-authored-by: jon-albert_landg <[REDACTED_EMAIL]>
Co-authored-by: mark.dev <[REDACTED_EMAIL]>

**File**: `detox/src/devices/common/drivers/ios/tools/AppleSimUtils.js` (modified, +40/-18)
```diff
@@ -311,14 +311,24 @@ class AppleSimUtils {
       return;
     }
 
-    const options = {
-      args: `--byId ${udid} --match${matchType}`,
-      retries: 1,
-      statusLogs: {
-        trying: `Trying to match ${matchType}...`,
-        successful: `Matched ${matchType}!`
-      },
-    };
+    const isIOS26Plus = (await this._getMajorIOSVersion(udid)) >= 26;
+    const options = isIOS26Plus
+      ? {
+          args: `--booted --biometricMatch`,
+          retries: 1,
+          statusLogs: {
+            trying: `Trying to match ${matchType}...`,
+            successful: `Matched ${matchType}!`
+          }
+        }
+      : {
+          args: `--byId ${udid} --match${matchType}`,
+          retries: 1,
+          statusLogs: {
+            trying: `Trying to match ${matchType}...`,
+            successful: `Matched ${matchType}!`
+          }
+        };
     await this._execAppleSimUtils(options);
   }
 
@@ -327,14 +337,24 @@ class AppleSimUtils {
       return;
     }
 
-    const options = {
-      args: `--byId ${udid} --unmatch${matchType}`,
-      retries: 1,
-      statusLogs: {
-        trying: `Trying to unmatch ${matchType}...`,
-        successful: `Unmatched ${matchType}!`
-      },
-    };
+    const isIOS26Plus = (await this._getMajorIOSVersion(udid)) >= 26;
+    const options = isIOS26Plus
+      ? {
+          args: `--booted --biometricNonmatch`,
+          retries: 1,
+          statusLogs: {
+            trying: `Trying to unmatch ${matchType}...`,
+            successful: `Unmatched ${matchType}!`
+          }
+        }
+      : {
+          args: `--byId ${udid} --unmatch${matchType}`,
+          retries: 1,
+          statusLogs: {
+            trying: `Trying to unmatch ${matchType}...`,
+            successful: `Unmatched ${matchType}!`
+          }
+        };
     await this._execAppleSimUtils(options);
   }
 
@@ -344,13 +364,15 @@ class AppleSimUtils {
     }
 
     const toggle = yesOrNo === 'YES';
+    const isIOS26Plus = (await this._getMajorIOSVersion(udid)) >= 26;
+    const byIdOrBooted = isIOS26Plus ? `--booted` : `--byId ${udid}`;
     const options = {
-      args: `--byId ${udid} --biometricEnrollment ${yesOrNo}`,
+      args: `${byIdOrBooted} --biometricEnrollment ${yesOrNo}`,
       retries: 1,
       statusLogs: {
         trying: `Turning ${toggle ? 'on' : 'off'} biometric enrollment...`,
         successful: toggle ? 'Activated!' : 'Deactivated!'
-      },
+      }
     };
     await this._execAppleSimUtils(options);
   }
```

---

### Incident Patch 12: `acc545fe` (2026-05-12)
**Commit Message**: Bugfix/ascii swift fix (#4948)

* fix for ascii

* test update

* test removal

**File**: `detox/test/e2e/33.attributes.test.js` (modified, +0/-10)
```diff
@@ -230,16 +230,6 @@ describe('Attributes', () => {
         visible: true,
       });
     });
-
-    it(':ios: @new-arch should return attributes of a single element when using atIndex', async () => {
-      const result = await element(by.type('RCTViewComponentView')).atIndex(0).getAttributes();
-
-      expect(result).not.toHaveProperty('elements');
-      expect(result).toMatchObject({
-        enabled: true,
-        visible: true,
-      });
-    });
   });
 
   describe('of multiple views', () => {
```

---

### Incident Patch 13: `2852c0ba` (2026-05-11)
**Commit Message**: fix for ascii (#4947)

**File**: `detox/ios/Detox/Invocation/Element.swift` (modified, +1/-1)
```diff
@@ -316,7 +316,7 @@ class Element : NSObject {
 
 		if let index = index {
 			guard index < views.count else {
-				dtx_fatalError("Index \(index) beyond bounds \(views.count > 0 ? "[0 .. \(views.count - 1)] " : " ")for "\(self.description)"", viewDescription: failDebugAttributes)
+				dtx_fatalError("Index \(index) beyond bounds \(views.count > 0 ? "[0 .. \(views.count - 1)] " : " ")for “\(self.description)”", viewDescription: failDebugAttributes)
 			}
 			return views[index].dtx_attributes
 		} else if views.count == 1 {
```

---

### Incident Patch 14: `f831cd20` (2026-05-11)
**Commit Message**: fix(ios): respect atIndex in getAttributes (#4912)

The `attributes` property on `Element` was ignoring `self.index`,
causing `element(...).atIndex(N).getAttributes()` to return all
matching elements instead of the one at the specified index.

This aligns the `attributes` property with the existing `view` property,
which already correctly handles `self.index`.

Fixes #4633

Co-authored-by: mark.dev <[REDACTED_EMAIL]>

**File**: `detox/ios/Detox/Invocation/Element.swift` (modified, +8/-3)
```diff
@@ -313,14 +313,19 @@ class Element : NSObject {
 	@objc
 	var attributes: [String : Any] {
 		let views = self.views
-		
-		if views.count == 1 {
+
+		if let index = index {
+			guard index < views.count else {
+				dtx_fatalError("Index \(index) beyond bounds \(views.count > 0 ? "[0 .. \(views.count - 1)] " : " ")for "\(self.description)"", viewDescription: failDebugAttributes)
+			}
+			return views[index].dtx_attributes
+		} else if views.count == 1 {
 			return views.first!.dtx_attributes
 		} else {
 			let elements = views.map {
 				return $0.dtx_attributes
 			}
-			
+
 			return ["elements": elements]
 		}
 	}
```

**File**: `detox/test/e2e/33.attributes.test.js` (modified, +22/-0)
```diff
@@ -220,6 +220,28 @@ describe('Attributes', () => {
     });
   });
 
+  describe('of multiple views with atIndex', () => {
+    it(':ios: @legacy should return attributes of a single element when using atIndex', async () => {
+      const result = await element(by.type('RCTView').withAncestor(by.id('attrScrollView'))).atIndex(0).getAttributes();
+
+      expect(result).not.toHaveProperty('elements');
+      expect(result).toMatchObject({
+        enabled: true,
+        visible: true,
+      });
+    });
+
+    it(':ios: @new-arch should return attributes of a single element when using atIndex', async () => {
+      const result = await element(by.type('RCTViewComponentView')).atIndex(0).getAttributes();
+
+      expect(result).not.toHaveProperty('elements');
+      expect(result).toMatchObject({
+        enabled: true,
+        visible: true,
+      });
+    });
+  });
+
   describe('of multiple views', () => {
     it(':ios: @legacy should return an object with .elements array', async () => {
       await useMatcher(by.type('RCTView').withAncestor(by.id('attrScrollView')));
```

---

### Incident Patch 15: `1bd08d45` (2026-05-11)
**Commit Message**: Update package.json version to 20.51.1 [buildkite skip] (#4941)

Co-authored-by: mark.dev <[REDACTED_EMAIL]>

**File**: `detox-cli/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "detox-cli",
-  "version": "20.50.3",
+  "version": "20.51.1",
   "description": "Optional wrapper for Detox CLI, meant to be installed globally",
   "main": "cli.js",
   "scripts": {
```

**File**: `detox/package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "detox",
   "description": "E2E tests and automation for mobile",
-  "version": "20.50.3",
+  "version": "20.51.1",
   "bin": "local-cli/cli.js",
   "files": [
     "android",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -67,5 +67,5 @@
     "unified": "^10.1.0",
     "zx": "^8.0.0"
   },
-  "version": "20.50.3"
+  "version": "20.51.1"
 }
```

#### Recent Merged Pull Requests:
- **PR #4960** (2026-06-16): Update package.json version to 20.51.4 (@mobileoss)
- **PR #4959** (2026-06-16): feat: accept RegExp and arrays for URL blacklist (setURLBlacklist / detoxURLBlacklistRegex) (@noomorph)
- **PR #4957** (2026-05-30): Update package.json version to 20.51.3 (@mobileoss)
- **PR #4956** (closed): build(cli): replace execa with native spawn in AppStartCommand (@noomorph)
- **PR #4955** (2026-05-30): feat(ios): add regex support for toHaveText (@noomorph)
- **PR #4954** (closed): Update package.json version to 20.51.3-smoke.0 (@mobileoss)
- **PR #4953** (closed): Update package.json version to 20.51.2 (@mobileoss)
- **PR #4952** (2026-05-30): chore: bump DetoxSync to latest commit (@noomorph)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
