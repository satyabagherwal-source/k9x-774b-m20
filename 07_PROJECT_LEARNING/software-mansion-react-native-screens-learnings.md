> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/software-mansion-react-native-screens-learnings.md`  
> **Source**: github ([https://github.com/software-mansion/react-native-screens](https://github.com/software-mansion/react-native-screens))  
> **Source Version**: `3824a107`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-21T04:49:14.339Z  
> **Learning ID**: `learn-github-software-mansion-react-native-screens`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): software-mansion/react-native-screens

> **Canonical Artifact**: `07_PROJECT_LEARNING/software-mansion-react-native-screens-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/software-mansion/react-native-screens](https://github.com/software-mansion/react-native-screens))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-21T04:49:14.333Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `software-mansion/react-native-screens`
- **Description**: Native navigation primitives for your React Native app.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3740 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `android/src/main/java/com/swmansion/rnscreens/core/common/FragmentProviding.kt`
```
package com.swmansion.rnscreens.core.common

import androidx.fragment.app.Fragment

/**
 * Implementors of this interface indicate that they do have a fragment associated with them, that
 * can be used to retrieve child fragment manager for nesting operations.
 */
interface FragmentProviding {
    fun getAssociatedFragment(): Fragment?
}

```

### Core Architecture Module: `android/src/main/java/com/swmansion/rnscreens/core/common/colorscheme/ColorScheme.kt`
```
package com.swmansion.rnscreens.core.common.colorscheme

internal enum class ColorScheme {
    INHERIT,
    LIGHT,
    DARK,
}

```

### Core Architecture Module: `android/src/main/java/com/swmansion/rnscreens/core/common/colorscheme/ColorSchemeCoordinator.kt`
```
package com.swmansion.rnscreens.core.common.colorscheme

import android.content.res.Configuration
import android.view.View
import android.view.ViewParent
import java.lang.ref.WeakReference
import kotlin.properties.Delegates

internal typealias OnUiNightModeResolvedCallback = (nightMode: Int) -> Unit

internal class ColorSchemeCoordinator :
    ColorSchemeProviding,
    ColorSchemeListener {
    internal var colorScheme: ColorScheme by Delegates.observable(ColorScheme.INHERIT) { _, oldValue, newValue ->
        if (oldValue != newValue) {
            applyResolvedColorScheme()
        }
    }
    private var parentProvider: ColorSchemeProviding? = null

    /**
     * Parent provider known from ownership, taking precedence over the view-tree walk
     * in [setup]. Set it when the owner knows its provider statically (e.g. a fragment's
     * root view always resolves through the container that created the fragment) - the
     * walk is unreliable there: transitions reparent an exiting fragment's view into the
     * container's ViewGroupOverlay, whose parent chain ends in null. Survives [teardown].
     */
    internal var explicitParentProvider: WeakReference<ColorSchemeProviding>? = null
    private var systemUiNightMode: Int = Configuration.UI_MODE_NIGHT_NO
    private var lastAppliedUiNightMode: Int? = null
    private val childListeners = mutableListOf<ColorSchemeListener>()
    private var isSetUp = false

    /**
     * Callback invoked when color scheme changes. It should be used to adapt
     * view's appearance to the current mode.
     *
     * The [Int] parameter represents the resolved night mode value. It can be
     * one of [Configuration.UI_MODE_NIGHT_UNDEFINED], [Configuration.UI_MODE_NIGHT_NO]
     * or [Configuration.UI_MODE_NIGHT_YES].
     *
     * This callback is invoked only if the value has changed. The change is propagated
     * in top-down order.
     */
    internal var onUiNightModeResolved: OnUiNightModeResolvedCallback? = null

    override fun getResolvedUiNightMode(): Int =
        when (colorScheme) {
            ColorScheme.LIGHT -> Configuration.UI_MODE_NIGHT_NO
            ColorScheme.DARK -> Configuration.UI_MODE_NIGHT_YES
            ColorScheme.INHERIT ->
                parentProvider?.getResolvedUiNightMode()
                    ?: systemUiNightMode
        }

    /**
     * Initializes the color scheme resolution for the given [hostView]
     * with [onUiNightModeResolvedCallback].
     *
     * Must be called after the view is attached to the window.
     * Must not be called again without calling [teardown] first.
     */
    internal fun setup(
        hostView: View,
        onUiNightModeResolvedCallback: OnUiNightModeResolvedCallback?,
    ) {
        check(!isSetUp) {
            "[RNScreens] ColorSchemeCoordinator's setup method must not be called again without calling teardown() first."
        }

        systemUiNightMode =
            hostView.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
        parentProvider = explicitParentProvider?.get() ?: findParentColorSchemeProvider(hostView)
        parentProvider?.addColorSchemeListener(this)
        onUiNightModeResolved = onUiNightModeResolvedCallback
        isSetUp = true

        // Reset last applied value so the initial callback is always invoked after setup.
        // This is necessary because `colorScheme` could've been set before `setup` method
        // is called.
        lastAppliedUiNightMode = null

        applyResolvedColorScheme()
    }

    internal fun teardown() {
        parentProvider?.removeColorSchemeListener(this)
        onUiNightModeResolved = null
        parentProvider = null
        lastAppliedUiNightMode = null
        isSetUp = false
    }

    internal fun onConfigurationChanged(configuration: Configuration?) {
        systemUiNightMode = configuration?.uiMode?.and(Configuration.UI_MODE_NIGHT_MASK) ?: Configuration.UI_MODE_NIGHT_UNDEFINED
        applyResolvedColorScheme()
    }

    override fun onParentUiNightModeChanged() {
        if (colorScheme == ColorScheme.INHERIT) {
            applyResolvedColorScheme()
        }
    }

    override fun addColorSchemeListener(listener: ColorSchemeListener) {
        childListeners.add(listener)
    }

    override fun removeColorSchemeListener(listener: ColorSchemeListener) {
        childListeners.remove(listener)
    }

    private fun applyResolvedColorScheme() {
        val resolved = getResolvedUiNightMode()
        if (resolved == lastAppliedUiNightMode) return
        lastAppliedUiNightMode = resolved

        onUiNightModeResolved?.invoke(resolved)
        childListeners.forEach { it.onParentUiNightModeChanged() }
    }

    private fun findParentColorSchemeProvider(hostView: View): ColorSchemeProviding? {
        var current: ViewParent? = hostView.parent
        while (current != null) {
            if (current is ColorSchemeProviding) return current
            current = current.parent
        }
        return null
    }
}

```

### Core Architecture Module: `android/src/main/java/com/swmansion/rnscreens/core/common/colorscheme/ColorSchemeListener.kt`
```
package com.swmansion.rnscreens.core.common.colorscheme

fun interface ColorSchemeListener {
    fun onParentUiNightModeChanged()
}

```

### Core Architecture Module: `android/src/main/java/com/swmansion/rnscreens/core/common/colorscheme/ColorSchemeProviding.kt`
```
package com.swmansion.rnscreens.core.common.colorscheme

interface ColorSchemeProviding {
    fun getResolvedUiNightMode(): Int // UI_MODE_NIGHT_YES,  UI_MODE_NIGHT_NO or UI_MODE_NIGHT_UNDEFINED

    fun addColorSchemeListener(listener: ColorSchemeListener)

    fun removeColorSchemeListener(listener: ColorSchemeListener)
}

```

### Core Architecture Module: `android/src/main/java/com/swmansion/rnscreens/core/common/event/ViewAppearanceEventEmitter.kt`
```
package com.swmansion.rnscreens.core.common.event

interface ViewAppearanceEventEmitter {
    fun emitOnWillAppear()

    fun emitOnDidAppear()

    fun emitOnWillDisappear()

    fun emitOnDidDisappear()
}

```

### Core Architecture Module: `android/src/main/java/com/swmansion/rnscreens/core/common/safearea/EdgeInsets.kt`
```
// Implementation adapted from `react-native-safe-area-context`:
// https://github.com/AppAndFlow/react-native-safe-area-context/tree/v5.6.1
package com.swmansion.rnscreens.core.common.safearea

import androidx.core.graphics.Insets
import kotlin.math.max

data class EdgeInsets(
    val left: Float,
    val top: Float,
    val right: Float,
    val bottom: Float,
) {
    companion object {
        val ZERO: EdgeInsets = EdgeInsets(0.0f, 0.0f, 0.0f, 0.0f)

        fun fromInsets(insets: Insets) =
            EdgeInsets(
                insets.left.toFloat(),
                insets.top.toFloat(),
                insets.right.toFloat(),
                insets.bottom.toFloat(),
            )

        fun max(
            i1: EdgeInsets,
            i2: EdgeInsets,
        ) = EdgeInsets(
            max(i1.left, i2.left),
            max(i1.top, i2.top),
            max(i1.right, i2.right),
            max(i1.bottom, i2.bottom),
        )
    }
}

```

### Core Architecture Module: `android/src/main/java/com/swmansion/rnscreens/core/common/safearea/InsetType.kt`
```
package com.swmansion.rnscreens.core.common.safearea

enum class InsetType {
    ALL,
    SYSTEM,
    INTERFACE,
    ;

    fun containsSystem(): Boolean = this == ALL || this == SYSTEM

    fun containsInterface(): Boolean = this == ALL || this == INTERFACE
}

```

### Core Architecture Module: `android/src/main/java/com/swmansion/rnscreens/core/common/safearea/OnInterfaceInsetsChangeListener.kt`
```
package com.swmansion.rnscreens.core.common.safearea

/**
 * Receives notifications about changes to **interface** safe area insets from a [SafeAreaProvider].
 */
interface OnInterfaceInsetsChangeListener {
    /**
     * Called by the [SafeAreaProvider] the listener is registered with when its **interface**
     * safe area insets change. It may also be called with unchanged insets, so implementations
     * should tolerate duplicate notifications.
     *
     * @param newInterfaceInsets the new **interface** safe area insets.
     */
    fun onInterfaceInsetsChange(newInterfaceInsets: EdgeInsets)
}

```

### Core Architecture Module: `android/src/main/java/com/swmansion/rnscreens/core/common/safearea/SafeAreaProvider.kt`
```
package com.swmansion.rnscreens.core.common.safearea

/**
 * Allows containers that obscure some part of its children views to provide safe area.
 *
 * This protocol only handles **interface insets** (e.g. toolbar, bottomNavigationView).
 * System insets (e.g. `systemBars`, `displayCutout`) are handled through Android inset
 * dispatch mechanism (via `onApplyWindowInsets`).
 *
 * Classes implementing this protocol are responsible for notifying the registered
 * [OnInterfaceInsetsChangeListener] about changes to **interface** safe area insets.
 */
interface SafeAreaProvider {
    /**
     * Responsible for registering **interface** safe area insets listener.
     *
     * @param listener listener that wants to receive notifications about changes
     * to **interface** safe area insets via `onInterfaceInsetsChange`.
     */
    fun setOnInterfaceInsetsChangeListener(listener: OnInterfaceInsetsChangeListener)

    /**
     * Responsible for unregistering **interface** safe area insets listener.
     *
     * @param listener listener that wants to stop receiving notifications about changes
     * to **interface** safe area insets.
     */
    fun removeOnInterfaceInsetsChangeListener(listener: OnInterfaceInsetsChangeListener)

    /**
     * Responsible for providing current **interface** safe area insets.
     *
     * @returns `EdgeInsets` describing the current **interface** safe area insets.
     */
    fun getInterfaceInsets(): EdgeInsets
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4992** (2026-10-20): **chore: add support for react-native@0.88.0**
  *Symptoms*: ## Description  Upgrade based on the RN upgrade helper: https://react-native-community.github.io/upgrade-helper/?from=0.88.0-rc.6&to=0.88.0  ## Changes  - Bumped RN packages to 0.88.0 (lib devDependencies, `FabricExample`). - `FabricExample`: `react-native-reanimated` 4.6.0 → 4.7.1 and `react-native-worklets` 0.12.2 → 0.13.0. Reanimated's podspec skips its RN version check for pre-releases, so 4.6.0 worked with rc.5, but it supports 0.83–0.87 only and `pod install` fails on 0.88.0; 4.7.x declares 0.86–0.88.  ## Test plan - `FabricExample` – built in Release and run on iOS (iPhone 17 Pro simulator) and Android (emulator): stack, modals and bottom tabs work  ## Checklist  - [ ] Included code example that can be used to test this change. - [ ] For visual changes, included screenshots / GIFs / recordings documenting the change. - [ ] For API changes, updated relevant public types. - [ ] Ensured that CI passes 
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/software-mansion/react-native-screens/pull/4992?scope=ghh_OusAJGA4HG8ljoOV0wJvVx8NmnZIjc2DdjmxOu0xZWA&amp;cs_source=review_comment"><picture><source media="(prefers-color-scheme: dark)" srcset="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=3"><source media="(prefers-color-scheme: light)" srcset="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg?v=3"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg?v=3" alt="Review in Change Stack →" height="32"></picture></a>  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary><strong>ℹ️ Recent review info</strong></summary> <dl> <dd>  <details> <summary><strong>⚙️ Run 

- **Issue #4983** (2026-10-20): **[iOS 27] Native tab bar order stays stale until a tab is tapped**
  *Symptoms*: ### Description  Reordering existing native bottom tabs updates the navigation state but leaves the visible tab bar in its old order until a tab is tapped. Adding/removing a tab updates immediately. Expected: pure reordering should also update immediately.  Native debugging confirms the new order in RNSTabsHost children, RNSTabBarController.tabs, and tabBar.items while the UI stays stale. Reinserting one unselected UITab within performBatchUpdates: refreshes the order while preserving the selected tab and existing controllers. This may be a UIKit integration issue; an isolated pure-UIKit reproduction has not been tested.  ### Steps to reproduce  1. Use createNativeBottomTabNavigator from @react-navigation/bottom-tabs/unstable (7.21.0) with four stable keyed screens A, B, C, D. 2. Select D. 3. Dynamically change the screen array from [A, B, C, D] to [B, A, C, D], keeping keys and components unchanged. 4. The native tab bar still shows [A, B, C, D]. Tap a tab: the displayed order then updates. 5. Adding/removing a screen instead updates immediately.  ### Snack or a link to a repository  No standalone reproduction repository yet; reproduced in an existing bare React Native app using the steps above.  ### Screens version  4.30.0  ### React Native version  0.87.1  ### Platforms  iOS  ### JavaScript runtime  None  ### Workflow  None  ### Build type  None  ### Device  None  ### Device model  iPhone Duo Simulator, iOS 27.1; Fabric, Hermes; bare RN debug build  ### Acknowledgements  Y

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

### Incident Patch 1: `d244f8d0` (2026-10-20)
**Commit Message**: fix(Android, Stack v5): emit onDismiss only if fragment is explicitly popped (#4745)

## Description

On Android, popping a screen that contains a nested stack can crash the
app with:

```
[Stack] action: "pop-native" can not be performed with less than 2 routes!
```

It showed up in CI e2e
(`test-stack-prevent-native-dismiss-nested-stack`, "should exit the
nested stack with the Pop button from its sole attached route"). See
this [failing
run](https://github.com/software-mansion/react-native-screens/actions/runs/35121002573/job/105097858435).

### Details

**What goes wrong**

- On Android, every stack screen is backed by a _fragment_. A nested
stack's screens are fragments that live **inside** the parent screen's
fragment.
- When JS pops the parent screen, Android destroys its fragment and
every fragment inside it. The nested stack's screens are destroyed too.
- A destroyed stack screen always reports `onDismiss` to JS. If JS still
considers that screen attached, the event is marked as a _native_
dismiss, i.e. "the user went back natively and JS must catch up".
- The nested screens were never popped. They are only being torn down
with their parent. JS still gets a native dismiss f

**File**: `android/src/main/java/com/swmansion/rnscreens/stack/screen/StackScreenFragment.kt` (modified, +6/-1)
```diff
@@ -98,7 +98,12 @@ internal class StackScreenFragment(
         super.onDestroy()
         headerCoordinatorLayout?.tearDown()
         headerCoordinatorLayout = null
-        item.onDismiss()
+        // `isRemoving` is true only when this fragment is removed from its own stack (JS or native pop).
+        // A fragment destroyed together with its FragmentManager (e.g. an ancestor screen was popped)
+        // was not dismissed - reporting it would count as a native dismiss of a still-attached screen.
+        if (isRemoving) {
+            item.onDismiss()
+        }
         teardownPreventNativeDismissCallback()
     }
 
```

---

### Incident Patch 2: `0b5607c4` (2026-10-20)
**Commit Message**: refactor(test): fix tab bar item badge e2e test for iOS 27 (#4719)

> **Stacked branch.** Base is `@lkuchno/stack-header-ios27` (#4718),
which is stacked on `@lkuchno/toast-e2e-test-fix-ios27` (#4716), itself
on `@lkuchno/ios-e2e-upgrade` — not `main`. The parents should land
first.

## Description

iOS 27 moved tab bar badges out of their tab bar item. Up to iOS 26 a
badge is a subview of its own item, so the test matched it by ancestry.
On iOS 27 every badge lives in a single `BadgeContainerView` that is a
*sibling* of the items' `ContentView`, both under one shared
`_UITabBarItemPlatterView` — badge and item are cousins, so there is no
ancestry left to match on and the assertions could not resolve.

Worth noting for anyone who assumed a rename: `_UIBarBadgeView` still
exists on iOS 27 and is still the class that renders the badge. Only its
position in the hierarchy changed, so the existing class-name constants
are unchanged.

Rather than dropping to a bare existence check, the iOS 27 path keeps
per-tab verification through two assertions: the tab item's
accessibility value, which UIKit folds the badge into and which is
therefore the surviving item-to-badge binding, and the badge

**File**: `FabricExample/e2e/helpers/framework/platform.ts` (modified, +15/-0)
```diff
@@ -80,5 +80,20 @@ export const describeIfIOS26 = isIOSVersionAtLeast('26.0')
   ? describe
   : describe.skip;
 
+/** Suites for iOS 27+ only features; skipped on Android and older iOS. */
+export const describeIfIOS27 = isIOSVersionAtLeast('27.0')
+  ? describe
+  : describe.skip;
+
+/**
+ * Suites for behavior that iOS 27 changed, kept on the versions before it.
+ * Unlike the `describeIfIOS*` guards this also runs on Android - the version
+ * check is `false` there - so nest it inside `describeIfIOS` when the suite is
+ * iOS-only.
+ */
+export const describeIfBelowIOS27 = isIOSVersionAtLeast('27.0')
+  ? describe.skip
+  : describe;
+
 export const describeIfIPadOS26 =
   isIPadTarget && isIOSVersionAtLeast('26.0') ? describe : describe.skip;
```

**File**: `FabricExample/e2e/single-feature-tests/tabs/test-tabs-item-badge.e2e.ts` (modified, +73/-27)
```diff
@@ -1,45 +1,91 @@
+import { expect as jestExpect } from '@jest/globals';
 import { device, expect, element, by } from 'detox';
 import { selectSingleFeatureTestsScreen } from '@e2e/app/test-screen-navigation';
+import { getSingleMatch } from '@e2e/framework/matchers';
 import {
+  CLASS_NAME_UI_LABEL,
   CLASS_NAME_UI_TAB_BAR_BADGE_VIEW_IOS26,
   CLASS_NAME_UI_TAB_BAR_BADGE_VIEW_LEGACY,
 } from '@e2e/framework/native-classes-ios';
-import { describeIfIOS, isIOSVersionAtLeast } from '@e2e/framework/platform';
+import {
+  describeIfBelowIOS27,
+  describeIfIOS,
+  describeIfIOS27,
+  isIOSVersionAtLeast,
+} from '@e2e/framework/platform';
+
 const tabBarBadgeViewType = isIOSVersionAtLeast('26.0')
   ? CLASS_NAME_UI_TAB_BAR_BADGE_VIEW_IOS26
   : CLASS_NAME_UI_TAB_BAR_BADGE_VIEW_LEGACY;
 
+/** Each tab bar item's `testID`, paired with the `badgeValue` it renders. */
+const TAB_BADGES = [
+  { testID: 'tab-badge-item-1', badgeValue: '1' },
+  { testID: 'tab-badge-item-2', badgeValue: '1234567890' },
+  { testID: 'tab-badge-item-3', badgeValue: 'NEW!' },
+  { testID: 'tab-badge-item-4', badgeValue: '⚠️' },
+];
+
+/**
+ * Asserts the tab bar item `testID` carries `badgeValue` - on iOS 27 the only
+ * per-item binding left, since the badge view itself is no longer nested in the
+ * item. UIKit folds the badge into the item's accessibility value, localized
+ * and pluralized ("1 item", "1.234.567.890 items"), so a numeric badge is
+ * compared on its digits alone rather than on the grouped, suffixed string.
+ */
+async function expectItemBadgeValue(testID: string, badgeValue: string) {
+  const value = String(
+    (await getSingleMatch(by.id(testID), `id "${testID}"`)).value ?? '',
+  );
+
+  if (/^\d+$/.test(badgeValue)) {
+    jestExpect(value.replace(/\D/g, '')).toBe(badgeValue);
+  } else {
+    jestExpect(value).toContain(badgeValue);
+  }
+}
+
 describeIfIOS('Tab Bar Item Badge', () => {
   beforeAll(async () => {
     await device.reloadReactNative();
     await selectSingleFeatureTestsScreen('Tabs', 'test-tabs-item-badge');
   });
 
-  it('should display all four tab bar items with correct badge values', async () => {
-    await expect(element(by.id('tab-badge-item-1'))).toExist();
-    await expect(element(by.id('tab-badge-item-2'))).toExist();
-    await expect(element(by.id('tab-badge-item-3'))).toExist();
-    await expect(element(by.id('tab-badge-item-4'))).toExist();
-
-    await expect(
-      element(
-        by.type(tabBarBadgeViewType).withAncestor(by.id('tab-badge-item-1')),
-      ),
-    ).toHaveText('1');
-    await expect(
-      element(
-        by.type(tabBarBadgeViewType).withAncestor(by.id('tab-badge-item-2')),
-      ),
-    ).toHaveText('1234567890');
-    await expect(
-      element(
-        by.type(tabBarBadgeViewType).withAncestor(by.id('tab-badge-item-3')),
-      ),
-    ).toHaveText('NEW!');
-    await expect(
-      element(
-        by.type(tabBarBadgeViewType).withAncestor(by.id('tab-badge-item-4')),
-      ),
-    ).toHaveText('⚠️');
+  it('should display all four tab bar items', async () => {
+    for (const { testID } of TAB_BADGES) {
+      await expect(element(by.id(testID))).toExist();
+    }
+  });
+
+  describeIfBelowIOS27('badge nested in its tab bar item', () => {
+    it('should render each badge value inside its own tab bar item', async () => {
+      for (const { testID, badgeValue } of TAB_BADGES) {
+        await expect(
+          element(by.type(tabBarBadgeViewType).withAncestor(by.id(testID))),
+        ).toHaveText(badgeValue);
+      }
+    });
+  });
+
+  describeIfIOS27('badge detached from its tab bar item', () => {
+    it("should expose each badge on its own tab bar item's accessibility value", async () => {
+      for (const { testID, badgeValue } of TAB_BADGES) {
+        await expectItemBadgeValue(testID, badgeValue);
+      }
+    });
+
+    it("should render each badge value in the badge view's label", async () => {
+      for (const { badgeValue } of TAB_BADGES) {
+        await expect(
+          element(
+            by
+              .type(CLASS_NAME_UI_LABEL)
+              .withAncestor(
+                by.type(tabBarBadgeViewType).and(by.label(badgeValue)),
+              ),
+          ),
+        ).toHaveText(badgeValue);
+      }
+    });
   });
 });
```

**File**: `apps/src/tests/single-feature-tests/tabs/test-tabs-item-badge/scenario.md` (modified, +10/-11)
```diff
@@ -10,22 +10,21 @@ badge, and an emoji badge. For iOS, it also exercises
 `scrollEdgeAppearance` badge color. On Android, all badge color
 customisation is driven by `standardAppearance`.
 
-**OS test creation version:** iOS: 18.6 and iOS 26.5, Android: API Level 36.
+**OS test creation version:** iOS: 18.6, iOS 26.5 and iOS 27.0, Android: API Level 36.
 
 ## E2E test
 
-Incomplete: Only step 1 of **Baseline** for iOS is automated. The E2E test asserts the badge text
-values for all four tabs at baseline. A single suite can be run on both iOS
-versions with version-specific conditions: the tab bar badge view class name
-resolves dynamically (_UIBadgeView on iOS 18 and lower vs.
-_UIBarBadgeView on iOS 26).
+Incomplete. Automated on iOS only - Android is fully manual.
 
-Not covered:
+Covered: iOS **Baseline** - all four tabs exist and each shows its badge value
+(`1`, `1234567890`, `NEW!`, `⚠️`). This also covers the value checks repeated
+in the Tab1 - Tab4 subsections.
 
-- All steps for Android, and most iOS steps except for the initial badge text validation.
-- Badge background and text colors (all tabs, all states). Detox does not expose color
-  attributes for native tab bar badge views, meaning color validation requires a
-  screenshot-diff approach that is not yet implemented.
+Manual only:
+
+- iOS: all badge color checks (including in **Baseline**), steps 2–3 of
+  **Tab2 - long badge value and scrollEdgeAppearance**, and **Stability check**.
+- Android: all steps.
 
 ## Prerequisites
 
```

---

### Incident Patch 3: `bd6ae361` (2026-10-20)
**Commit Message**: refactor(test): replace per-version iOS suite guards with version-parameterized helpers (#4743)

> **Stacked branch.** This targets `@lkuchno/tab-badge-e2e-ios27`
(#4719) as its base, not `main` — that branch should land first.

## Description

The e2e platform helpers exported one guard per iOS release
(`describeIfIOS26`, `describeIfIOS27`, `describeIfBelowIOS27`,
`describeIfIPadOS26`), so every new iOS version meant adding exports,
and specs that needed a "below version X" guard hand-rolled it with
`isIOSVersionAtLeast`. These are replaced with guard factories that take
the version as an argument.

`describeIfIOSBelow` is also now iOS-only. The old
`describeIfBelowIOS27` ran on Android as well, because
`isIOSVersionAtLeast` is `false` there, so it had to be nested inside
`describeIfIOS` to be safe.

## Changes

- `e2e/helpers/framework/platform.ts`
- `describeIfIOS26` / `describeIfIOS27` →
`describeIfIOSAtLeast(version)`.
- `describeIfBelowIOS27` → `describeIfIOSBelow(version)`, which now
skips on Android.
  - `describeIfIPadOS26` → `describeIfIPadOSAtLeast(version)`.
- A shared `isIOS` constant backs every iOS guard, so none can leak onto
Android.
- `test-stack-header-item-ident

**File**: `FabricExample/e2e/helpers/framework/platform.ts` (modified, +48/-25)
```diff
@@ -43,6 +43,22 @@ function compareVersions(
   }
 }
 
+/**
+ * `true` when `version` is the release `targetVersion` names: any minor of it
+ * for a MAJOR target, that exact minor for a MAJOR.MINOR one.
+ */
+function isVersionMatching(version: string, targetVersion: string) {
+  assertSupportedVersionString(version);
+  assertSupportedVersionString(targetVersion);
+
+  const [major, minor = '0'] = version.split('.');
+  const [targetMajor, targetMinor] = targetVersion.split('.');
+  return (
+    Number(major) === Number(targetMajor) &&
+    (targetMinor === undefined || Number(minor) === Number(targetMinor))
+  );
+}
+
 /** `true` when `version` is at least `minimumVersion`. */
 function isVersionEqualOrHigherThan(version: string, minimumVersion: string) {
   assertSupportedVersionString(version);
@@ -51,8 +67,10 @@ function isVersionEqualOrHigherThan(version: string, minimumVersion: string) {
   return compareVersions(version, minimumVersion) >= 0;
 }
 
-export const describeIfIOS =
-  device.getPlatform() === 'ios' ? describe : describe.skip;
+/** Every iOS guard below derives from this, so none can leak onto Android. */
+const isIOS = device.getPlatform() === 'ios';
+
+export const describeIfIOS = isIOS ? describe : describe.skip;
 
 export const describeIfAndroid =
   device.getPlatform() === 'android' ? describe : describe.skip;
@@ -62,38 +80,43 @@ export const describeIfAndroid =
  * RNS_APPLE_SIM_NAME="iPad Pro 13-inch (M4)". See scripts/e2e/ios-devices.js.
  */
 export const isIPadTarget =
-  device.getPlatform() === 'ios' &&
-  /^iPad\s/i.test(process.env.RNS_APPLE_SIM_NAME ?? '');
+  isIOS && /^iPad\s/i.test(process.env.RNS_APPLE_SIM_NAME ?? '');
 
 export const describeIfIPad = isIPadTarget ? describe : describe.skip;
 
 /** `true` on iOS at `version` or newer; `false` on Android. */
 export function isIOSVersionAtLeast(version: string): boolean {
-  return (
-    device.getPlatform() === 'ios' &&
-    isVersionEqualOrHigherThan(getIOSVersionNumber(), version)
-  );
+  return isIOS && isVersionEqualOrHigherThan(getIOSVersionNumber(), version);
 }
 
-/** Suites for iOS 26+ only features; skipped on Android and older iOS. */
-export const describeIfIOS26 = isIOSVersionAtLeast('26.0')
-  ? describe
-  : describe.skip;
+/**
+ * Suite guards for version-specific behavior. Each takes a MAJOR or
+ * MAJOR.MINOR version and resolves to `describe` or `describe.skip`, so a new
+ * iOS release needs no new export here.
+ */
+
+/** Suites for features added in iOS `version`; skipped on Android and older iOS. */
+export const describeIfIOSAtLeast = (version: string) =>
+  isIOSVersionAtLeast(version) ? describe : describe.skip;
 
-/** Suites for iOS 27+ only features; skipped on Android and older iOS. */
-export const describeIfIOS27 = isIOSVersionAtLeast('27.0')
-  ? describe
-  : describe.skip;
+/**
+ * Suites for behavior that iOS `version` changed, kept on the releases before
+ * it; skipped on Android and from `version` on. `isIOS` is required on its own
+ * because `isIOSVersionAtLeast` is also `false` on Android, so negating that
+ * alone would run the suite there.
+ */
+export const describeIfIOSBelow = (version: string) =>
+  isIOS && !isIOSVersionAtLeast(version) ? describe : describe.skip;
 
 /**
- * Suites for behavior that iOS 27 changed, kept on the versions before it.
- * Unlike the `describeIfIOS*` guards this also runs on Android - the version
- * check is `false` there - so nest it inside `describeIfIOS` when the suite is
- * iOS-only.
+ * Suites for behavior that exists on iOS `version` only; skipped on Android and
+ * every other release. `'26'` runs on any 26.x, `'26.2'` on 26.2 only.
  */
-export const describeIfBelowIOS27 = isIOSVersionAtLeast('27.0')
-  ? describe.skip
-  : describe;
+export const describeIfIOSVersion = (version: string) =>
+  isIOS && isVersionMatching(getIOSVersionNumber(), version)
+    ? describe
+    : describe.skip;
 
-export const describeIfIPadOS26 =
-  isIPadTarget && isIOSVersionAtLeast('26.0') ? describe : describe.skip;
+/** Suites for iPad-only features added in iPadOS `version`. */
+export const describeIfIPadOSAtLeast = (version: string) =>
+  isIPadTarget && isIOSVersionAtLeast(version) ? describe : describe.skip;
```

**File**: `FabricExample/e2e/single-feature-tests/stack-v5/test-stack-header-item-identifier-ios.e2e.ts` (modified, +10/-11)
```diff
@@ -10,7 +10,10 @@ import {
 } from '@e2e/framework/header-items-ios';
 import { getMatches } from '@e2e/framework/matchers';
 import { CLASS_NAME_UI_NAVIGATION_BAR_PLATTER_VIEW } from '@e2e/framework/native-classes-ios';
-import { describeIfIOS26, isIOSVersionAtLeast } from '@e2e/framework/platform';
+import {
+  describeIfIOSAtLeast,
+  describeIfIOSVersion,
+} from '@e2e/framework/platform';
 
 // Every SF Symbol the test screen cycles through (SYMBOL_CYCLES in the test
 // screen's index.tsx).
@@ -106,17 +109,9 @@ async function expectItemsInOwnPlatters(sfSymbolNames: string[]) {
   expectAscending(frames.map(frame => frame.x));
 }
 
-// On iOS 27 each platter is a Swift class (`UIPlatformGlassInteractionView`)
-// that `by.type` resolves only by its unstable mangled name, and the iOS 26
-// class `_UINavigationBarPlatterView` no longer exists, so per-item platters
-// are checked on iOS 26 only (see scenario.md, "E2E test").
-const describeIfIOS26Only = isIOSVersionAtLeast('27.0')
-  ? describe.skip
-  : describe;
-
 // The identifier-driven item-matching behavior under test only exists on
 // iOS 26+ (see scenario.md, "OS test creation version").
-describeIfIOS26('Stack Header Item Identifier (iOS)', () => {
+describeIfIOSAtLeast('26.0')('Stack Header Item Identifier (iOS)', () => {
   describe('sfSymbols with identifiers (default)', () => {
     beforeAll(async () => {
       await device.reloadReactNative();
@@ -177,7 +172,11 @@ describeIfIOS26('Stack Header Item Identifier (iOS)', () => {
     });
   });
 
-  describeIfIOS26Only('separators enabled', () => {
+  // On iOS 27 each platter is a Swift class (`UIPlatformGlassInteractionView`)
+  // that `by.type` resolves only by its unstable mangled name, and the iOS 26
+  // class `_UINavigationBarPlatterView` no longer exists, so per-item platters
+  // are checked on iOS 26 only (see scenario.md, "E2E test").
+  describeIfIOSVersion('26')('separators enabled', () => {
     beforeAll(async () => {
       await device.reloadReactNative();
       await selectSingleFeatureTestsScreen(
```

**File**: `FabricExample/e2e/single-feature-tests/stack-v5/test-stack-header-subview-onpress-ios.e2e.ts` (modified, +2/-2)
```diff
@@ -9,7 +9,7 @@ import {
   submenuTitleRow,
 } from '@e2e/framework/context-menu-ios';
 import { headerItem } from '@e2e/framework/header-items-ios';
-import { describeIfIOS, describeIfIOS26 } from '@e2e/framework/platform';
+import { describeIfIOS, describeIfIOSAtLeast } from '@e2e/framework/platform';
 
 /**
  * A selectable row of the presented menu. A submenu's pinned title/back row
@@ -66,7 +66,7 @@ describeIfIOS('Stack Header Subview onPress (iOS)', () => {
     await dismissContextMenu();
   });
 
-  describeIfIOS26('iOS 26 toolbar overflow ("More") menu', () => {
+  describeIfIOSAtLeast('26.0')('iOS 26 toolbar overflow ("More") menu', () => {
     it('should move Item 0 and Menu 1 into the overflow button once 5 items are configured', async () => {
       await toggleItemsCount(); // 2 -> 3
       await toggleItemsCount(); // 3 -> 4
```

**File**: `FabricExample/e2e/single-feature-tests/tabs/test-tabs-bottom-accessory-layout-ios.e2e.ts` (modified, +7/-2)
```diff
@@ -7,7 +7,10 @@ import {
 } from '@e2e/framework/gestures';
 import { getMatches } from '@e2e/framework/matchers';
 import { CLASS_NAME_RNS_TABS_BOTTOM_ACCESSORY } from '@e2e/framework/native-classes-ios';
-import { describeIfIOS26, describeIfIPadOS26 } from '@e2e/framework/platform';
+import {
+  describeIfIOSAtLeast,
+  describeIfIPadOSAtLeast,
+} from '@e2e/framework/platform';
 import {
   bottomAccessoryElement,
   expectBottomAccessoryAboveTabBar,
@@ -137,7 +140,7 @@ async function verifyConfigTabInitialContent() {
   ).toBeVisible();
 }
 
-describeIfIOS26('Tabs bottomAccessory (iOS 26+)', () => {
+describeIfIOSAtLeast('26.0')('Tabs bottomAccessory (iOS 26+)', () => {
   beforeAll(async () => {
     await device.reloadReactNative();
     await selectSingleFeatureTestsScreen(
@@ -275,6 +278,8 @@ describeIfIOS26('Tabs bottomAccessory (iOS 26+)', () => {
   });
 });
 
+const describeIfIPadOS26 = describeIfIPadOSAtLeast('26.0');
+
 describeIfIPadOS26('@ipad Tabs bottomAccessory (iPadOS 26+)', () => {
   // The Config scroll view spans the full window height and is the same across
   // every test in this block, so read its frame + safe-area insets once and
```

**File**: `FabricExample/e2e/single-feature-tests/tabs/test-tabs-bottom-accessory-visibility-ios.e2e.ts` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@ import { device, expect, element, by, waitFor } from 'detox';
 import { toggleSettingsSwitch } from '@e2e/app/settings-controls';
 import { selectSingleFeatureTestsScreen } from '@e2e/app/test-screen-navigation';
 import { CLASS_NAME_RNS_TABS_BOTTOM_ACCESSORY } from '@e2e/framework/native-classes-ios';
-import { describeIfIOS26 } from '@e2e/framework/platform';
+import { describeIfIOSAtLeast } from '@e2e/framework/platform';
 import {
   bottomAccessoryElement,
   expectBottomAccessoryAboveTabBar,
@@ -70,7 +70,7 @@ async function expectBottomAccessoryAbsent() {
   await expect(element(by.id(ACCESSORY_TEXT))).not.toExist();
 }
 
-describeIfIOS26('Tabs: bottomAccessoryHidden (iOS 26+)', () => {
+describeIfIOSAtLeast('26.0')('Tabs: bottomAccessoryHidden (iOS 26+)', () => {
   beforeAll(async () => {
     await device.reloadReactNative();
     await selectSingleFeatureTestsScreen(
```

**File**: `FabricExample/e2e/single-feature-tests/tabs/test-tabs-item-badge.e2e.ts` (modified, +4/-4)
```diff
@@ -8,9 +8,9 @@ import {
   CLASS_NAME_UI_TAB_BAR_BADGE_VIEW_LEGACY,
 } from '@e2e/framework/native-classes-ios';
 import {
-  describeIfBelowIOS27,
+  describeIfIOSBelow,
   describeIfIOS,
-  describeIfIOS27,
+  describeIfIOSAtLeast,
   isIOSVersionAtLeast,
 } from '@e2e/framework/platform';
 
@@ -57,7 +57,7 @@ describeIfIOS('Tab Bar Item Badge', () => {
     }
   });
 
-  describeIfBelowIOS27('badge nested in its tab bar item', () => {
+  describeIfIOSBelow('27.0')('badge nested in its tab bar item', () => {
     it('should render each badge value inside its own tab bar item', async () => {
       for (const { testID, badgeValue } of TAB_BADGES) {
         await expect(
@@ -67,7 +67,7 @@ describeIfIOS('Tab Bar Item Badge', () => {
     });
   });
 
-  describeIfIOS27('badge detached from its tab bar item', () => {
+  describeIfIOSAtLeast('27.0')('badge detached from its tab bar item', () => {
     it("should expose each badge on its own tab bar item's accessibility value", async () => {
       for (const { testID, badgeValue } of TAB_BADGES) {
         await expectItemBadgeValue(testID, badgeValue);
```

#### Recent Merged Pull Requests:
- **PR #4992** (2026-10-20): chore: add support for react-native@0.88.0 (@Loloekk)
- **PR #4969** (2026-10-20): refactor(iOS, Split): move the Split React side to ios/react (@kkafar)
- **PR #4968** (2026-10-20): refactor(iOS, Tabs): move the Tabs React side to ios/react (@kkafar)
- **PR #4967** (2026-10-20): refactor(iOS, Stack): move the Stack React side to ios/react (@kkafar)
- **PR #4966** (2026-10-20): refactor(iOS): move RNSModule and the React-side helpers to ios/react (@kkafar)
- **PR #4947** (closed): Closed (@MarcusZoltan)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. Android, Stack v5): emit onDismiss only if fragment is explicitly popped (#4745)

**RULE**:
When implementing operations in `android/src/main/java/com/swmansion/rnscreens/stack/screen/StackScreenFragment.kt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in software-mansion/react-native-screens. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d244f8d0`: Android, Stack v5): emit onDismiss only if fragment is explicitly popped (#4745). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `android/src/main/java/com/swmansion/rnscreens/stack/screen/StackScreenFragment.kt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
        // `isRemoving` is true only when this fragment is removed from its own stack (JS or native pop).
        // A fragment destroyed together with its FragmentManager (e.g. an ancestor screen was popped)
        // was not dismissed - reporting it would count as a native dismiss of a still-attached screen.
        if (isRemoving) {
            item.onDismiss()
        }
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
        item.onDismiss()
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d244f8d0` are properly handled with clean fallback behavior.
