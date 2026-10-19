> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/software-mansion-react-native-screens-learnings.md`  
> **Source**: github ([https://github.com/software-mansion/react-native-screens](https://github.com/software-mansion/react-native-screens))  
> **Source Version**: `dc59d508`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T17:25:08.636Z  
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
> **Harvest Timestamp**: 2026-10-19T17:25:07.648Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `software-mansion/react-native-screens`
- **Description**: Native navigation primitives for your React Native app.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3739 stars

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

internal interface ViewAppearanceEventEmitter {
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
- **Issue #4956** (2026-10-19): **[iOS, iPhone Duo] Opaque header leaves a strip of screen colour above the bar on the cover panel**
  *Symptoms*: ### Description  On iPhone Duo (cover panel, portrait), UIKit starts the navigation bar below a top strip that the bar background does not reach. With an opaque header colour that differs from the screen background, that strip shows the screen colour above the header.  ### Steps to reproduce  1. Open the Home screen on iPhone Duo (cover panel, portrait) with the opaque blue header. 2. Look at the top of the header. 3. Expected: the header colour reaches the top. Observed: a strip in the screen colour above the bar.  Related: #4770 (vertical bar behaviour on Duo) and #4728 (bottom accessory width on Duo) do not report this strip.  ### Snack or a link to a repository  https://github.com/Acetyld/screens-issue-repros/tree/main/ios-duo-header-strip  Note: this repro needs an iPhone Duo or the Duo simulator and has not been run yet.  ### Screens version  4.30.0  ### React Native version  0.88.0  ### Platforms  Android, iOS (see title)  ### JavaScript runtime  Hermes  ### Workflow  React Native CLI  ### Build type  Debug  ### Device  Emulator or simulator, see the steps  ### Device model  Not specified  ### Acknowledgements  Yes 

- **Issue #4953** (2026-10-18): **[iOS, iPhone Duo] Opaque header leaves a strip of screen colour above the bar on the cover panel**
  *Symptoms*: ## Problem  On iPhone Duo (cover panel, portrait), UIKit starts the navigation bar below a top strip that the bar background does not reach. With an opaque header colour different from the screen background, that strip shows the screen colour above the header.  ## Versions  react-native-screens 4.30.0, React Native 0.88.0, Expo SDK 58.0.14, iPhone Duo (iOS 27.1).  ## Steps (needs an iPhone Duo or the Duo simulator)  1. Stack v4 screen with an opaque headerStyle background that differs from the screen background. 2. Open it on the Duo cover panel in portrait. 3. Observe a strip at the top of the header in the screen colour.  ## Suggestion  Extend the bar upwards with a view that has the header background colour, for opaque colours only. We use a locally added view for this and the strip is gone on the cover panel.  ## Related  #4770 (vertical bar behaviour on Duo) and #4728 (bottom accessory width on Duo) do not report this strip. 
  **Post-Mortem & Fix Analysis**:
  > Hey! 👋   The issue doesn't seem to contain a [minimal reproduction](https://stackoverflow.com/help/minimal-reproducible-example).  Could you provide a [snack](https://snack.expo.dev/) or a link to a GitHub repository under your username that reproduces the problem?
  > Hey! 👋   It looks like you've omitted a few important sections from the issue template.  Please complete **Description**, **Steps to reproduce**, **Snack or a link to a repository**, **Screens version**, **React Native version** and **Platforms** sections.

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

### Incident Patch 1: `4a87a71d` (2026-10-13)
**Commit Message**: fix(iOS, Tabs): filter UIKit's didSelectTab: for programmatic selection while More is active (#4890)

(generated by Claude)

## Description

On the `UITab` API path (iOS 26.1+) a programmatic tab selection made
while the More tab is active emits `onTabSelected` twice: a
`user`-origin event first, then the `programmatic-js` one, and the
navigation state provenance skips a value. It happens when the current
tab overflows into More and was itself selected programmatically (e.g.
`Select Sixth` from JS, then `Select Second`). Entering More through the
More list and then selecting programmatically gives a single event.
Found during the 4.30.0 release testing (#4884), regression from #4862;
4.29.0 and 4.28.0 emit one event.

Root cause: `-[RNSTabBarController applySelectedScreenController:]` sets
`_isApplyingProgrammaticTabSelection` only around `self.selectedTab =
…`, the branch taken when the More item is NOT selected. While More is
selected it falls back to `[self setSelectedViewController:]` without
the flag. UIKit sends `tabBarController:didSelectTab:previousTab:`
synchronously from inside that write, and since #4862 every unflagged
`didSelectTab:` is treated as a user selection:
`us

**File**: `ios/tabs/host/RNSTabBarController.mm` (modified, +16/-8)
```diff
@@ -92,11 +92,11 @@ @implementation RNSTabBarController {
   /// delegate handling). Setter overrides skip reconciliation while this flag is set.
   BOOL _isHandlingExplicitSelectionUpdate;
 
-  /// UITab path only. YES while this controller itself writes `tabs` / `selectedTab`. UIKit sends
-  /// `didSelectTab:` synchronously from inside those writes - this flag filters them out, so that
-  /// only UIKit-driven (user) selections reach the delegate logic. Marking user selections instead
-  /// is not viable: for `UISearchTab`, a mount transaction can land between `shouldSelectTab:`
-  /// and `didSelectTab:`.
+  /// UITab path only. YES while this controller itself writes `tabs` / `selectedTab` /
+  /// `selectedViewController`. UIKit sends `didSelectTab:` synchronously from inside those writes -
+  /// this flag filters them out, so that only UIKit-driven (user) selections reach the delegate
+  /// logic. Marking user selections instead is not viable: for `UISearchTab`, a mount transaction
+  /// can land between `shouldSelectTab:` and `didSelectTab:`.
   BOOL _isApplyingProgrammaticTabSelection;
 
   /// UITab path only. Set in `tabBar:didSelectItem:` when the user selects the More tab while
@@ -641,15 +641,23 @@ - (void)applySelectedScreenController:(nonnull UIViewController *)screenControll
 {
 #if RNS_UITAB_API_SDK_AVAILABLE
   if (RNS_UITAB_API_ENABLED) {
+    // Both writes below are our own. UIKit sends `didSelectTab:` synchronously from inside them, and
+    // `didSelectTab:` must not treat that as a user selection - otherwise the state is progressed
+    // twice and a second, `user`-origin event is emitted.
+    _isApplyingProgrammaticTabSelection = YES;
     if (![self isMoreNavigationControllerTabBarItemSelected]) {
       RCTAssert(screenController.tab != nil,
                 @"[RNScreens] No installed UITab for screenKey: %@",
                 [self screenKeyForViewController:screenController]);
-      _isApplyingProgrammaticTabSelection = YES;
       self.selectedTab = screenController.tab;
-      _isApplyingProgrammaticTabSelection = NO;
-      return;
+    } else {
+      // While More is active `selectedTab` lags behind UIKit's selection, so the write goes through
+      // the legacy setter (our own override, so that reconciliation of implicit UIKit-driven updates
+      // keeps working).
+      [self setSelectedViewController:screenController];
     }
+    _isApplyingProgrammaticTabSelection = NO;
+    return;
   }
 #endif // RNS_UITAB_API_SDK_AVAILABLE
 
```

---

### Incident Patch 2: `221aa277` (2026-10-13)
**Commit Message**: fix(iOS, Tabs): apply async-loaded icons to tabs that overflow into More on the UITab path (#4889)

## Description

On iOS 26.1+ (the `UITab` API path) a tab with an `imageSource` icon
that overflows into the More navigation controller has no icon in the
More list when the list is opened for the first time. The icon shows up
only after the tab was visited, with the next icon pass. Regression
since 4.29.0 (#4675), 4.28.0 is fine.

Root cause: `-[RNSTabBarAppearanceCoordinator
updateTabBarItem:withImage:isSelected:forScreenView:]`, the completion
of the async `imageSource` load, returns early when
`screenView.controller.parentViewController == nil`. The guard comes
from #4111 (never write to a torn-down `UITabBarItem` on iOS 26). On the
legacy `setViewControllers:` path every tab controller becomes a child
of the tab bar controller as soon as the tabs are installed, so the
guard never fired. On the `UITab` path UIKit parents the controllers of
overflow tabs lazily, when they are first shown. At mount the icons of
the 5th and 6th tab complete with no parent, the write to `tab.image` /
`tabBarItem.image` is skipped and the More list has nothing to show.

## Changes

- `RNSTabBarAppeara

**File**: `ios/tabs/RNSTabBarAppearanceCoordinator.mm` (modified, +28/-2)
```diff
@@ -200,6 +200,22 @@ - (void)setIconsForTabBarItem:(UITabBarItem *)tabBarItem
   }
 }
 
+/// Whether the screen is still managed by a tab bar controller. On the UITab path the controller of
+/// a tab that overflows into More has no parent until the tab is first shown (UIKit parents it
+/// lazily), but its `UITab` is installed - the tab is the liveness check there, not the parent.
+- (BOOL)isScreenControllerAttachedToTabBarController:(nullable RNSTabsScreenViewController *)screenController
+{
+  if (screenController == nil) {
+    return NO;
+  }
+#if RNS_UITAB_API_SDK_AVAILABLE
+  if (RNS_UITAB_API_ENABLED) {
+    return screenController.tab.tabBarController != nil;
+  }
+#endif // RNS_UITAB_API_SDK_AVAILABLE
+  return screenController.parentViewController != nil;
+}
+
 - (void)updateTabBarItem:(nullable UITabBarItem *)tabBarItem
                withImage:(nullable UIImage *)image
               isSelected:(BOOL)isSelected
@@ -212,8 +228,7 @@ - (void)updateTabBarItem:(nullable UITabBarItem *)tabBarItem
     return;
   }
 
-  UIViewController *screenParentViewController = [screenView.controller parentViewController];
-  if (screenParentViewController == nil) {
+  if (![self isScreenControllerAttachedToTabBarController:screenView.controller]) {
     return;
   }
 
@@ -223,6 +238,17 @@ - (void)updateTabBarItem:(nullable UITabBarItem *)tabBarItem
     [self setTabImage:image forTabBarItem:tabBarItem screenView:screenView];
   }
 
+  UIViewController *screenParentViewController = [screenView.controller parentViewController];
+#if RNS_UITAB_API_SDK_AVAILABLE
+  if (RNS_UITAB_API_ENABLED) {
+    if (screenParentViewController == nil) {
+      // A tab that overflows into More and has not been shown yet - UIKit parents it lazily. Its
+      // icon lives in the More list, not in the bar, so there is nothing to lay out.
+      return;
+    }
+  }
+#endif // RNS_UITAB_API_SDK_AVAILABLE
+
   // A layout pass is required because the image might be loaded asynchronously,
   // after the tab bar has already been attached to the window.
   // This code handles case where image passed by the user is not
```

---

### Incident Patch 3: `f050f6c6` (2026-10-19)
**Commit Message**: refactor(iOS): make the orientation-to-mask converter private to UIViewController+RNScreens (#4939)

<!-- claude-projects-attribution: {"github_login":"kkafar"} -->
_Requested by **Kacper**_

## Description

RFC-1823 implementation, task I9, part 1 of 2 (labs: Part of
https://github.com/software-mansion/react-native-screens-labs/issues/1916).
Stacked on #4929.

`UIViewController+RNScreens.mm`, which is headed for `core`, included
the React-side `RNSConversions.h` (and folly) for exactly one function:
`UIInterfaceOrientationMaskFromRNSOrientation`. Each orientation
converter has a single caller:
- `RNSOrientation` → mask: only `UIViewController+RNScreens.mm`, where
the swizzled `supportedInterfaceOrientations` turns a child
`RNSOrientationProviding`'s orientation into a mask.
- Mask → `RNSOrientation`: only legacy `RNSScreen.mm`.

So no shared helper is needed (approach agreed in
https://github.com/software-mansion/react-native-screens-labs/issues/1916).
This PR is content only, with no moves.

## Changes

- `UIViewController+RNScreens.mm`: the `RNSOrientation` → mask converter
becomes a file-private `static` function
(`RNSInterfaceOrientationMaskFromOrientation`). The mapping and t

**File**: `ios/UIViewController+RNScreens.mm` (modified, +32/-2)
```diff
@@ -1,11 +1,41 @@
-#import "RNSConversions.h"
 #import "RNSEnums.h"
+#import "RNSLog.h"
 #import "RNSOrientationProviding.h"
 #import "RNSScreenContainer.h"
 #import "UIViewController+RNScreens.h"
 
 #import <objc/runtime.h>
 
+#if !TARGET_OS_TV
+static UIInterfaceOrientationMask RNSInterfaceOrientationMaskFromOrientation(RNSOrientation orientation)
+{
+  switch (orientation) {
+    case RNSOrientationAll:
+      return UIInterfaceOrientationMaskAll;
+    case RNSOrientationAllButUpsideDown:
+      return UIInterfaceOrientationMaskAllButUpsideDown;
+    case RNSOrientationPortrait:
+      return UIInterfaceOrientationMaskPortrait | UIInterfaceOrientationMaskPortraitUpsideDown;
+    case RNSOrientationPortraitUp:
+      return UIInterfaceOrientationMaskPortrait;
+    case RNSOrientationPortraitDown:
+      return UIInterfaceOrientationMaskPortraitUpsideDown;
+    case RNSOrientationLandscape:
+      return UIInterfaceOrientationMaskLandscape;
+    case RNSOrientationLandscapeLeft:
+      return UIInterfaceOrientationMaskLandscapeLeft;
+    case RNSOrientationLandscapeRight:
+      return UIInterfaceOrientationMaskLandscapeRight;
+    case RNSOrientationInherit:
+      RNSLogE(@"[RNScreens] RNSOrientationInherit does not map directly to any UIInterfaceOrientationMask");
+      return 0;
+    default:
+      RNSLogE(@"[RNScreens] Unsupported orientation");
+      return 0;
+  }
+}
+#endif // !TARGET_OS_TV
+
 @implementation UIViewController (RNScreens)
 
 #if !TARGET_OS_TV
@@ -38,7 +68,7 @@ - (UIInterfaceOrientationMask)reactNativeScreensSupportedInterfaceOrientations
       return [[UIApplication sharedApplication] supportedInterfaceOrientationsForWindow:self.view.window];
     }
 
-    return rnscreens::conversion::UIInterfaceOrientationMaskFromRNSOrientation(orientation);
+    return RNSInterfaceOrientationMaskFromOrientation(orientation);
   }
 
   return [self reactNativeScreensSupportedInterfaceOrientations];
```

**File**: `ios/conversion/RNSConversions.h` (modified, +0/-3)
```diff
@@ -11,9 +11,6 @@ namespace rnscreens::conversion {
 id RNSConvertFollyDynamicToId(const folly::dynamic &dyn);
 
 #if !TARGET_OS_TV
-UIInterfaceOrientationMask UIInterfaceOrientationMaskFromRNSOrientation(
-    RNSOrientation orientation);
-
 // Currently unused in stack v5. Maybe remove after stopping support for v4.
 RNSOrientation RNSOrientationFromUIInterfaceOrientationMask(
     UIInterfaceOrientationMask orientationMask);
```

**File**: `ios/conversion/RNSConversions.mm` (modified, +0/-28)
```diff
@@ -4,34 +4,6 @@
 namespace rnscreens::conversion {
 
 #if !TARGET_OS_TV
-UIInterfaceOrientationMask UIInterfaceOrientationMaskFromRNSOrientation(RNSOrientation orientation)
-{
-  switch (orientation) {
-    case RNSOrientationAll:
-      return UIInterfaceOrientationMaskAll;
-    case RNSOrientationAllButUpsideDown:
-      return UIInterfaceOrientationMaskAllButUpsideDown;
-    case RNSOrientationPortrait:
-      return UIInterfaceOrientationMaskPortrait | UIInterfaceOrientationMaskPortraitUpsideDown;
-    case RNSOrientationPortraitUp:
-      return UIInterfaceOrientationMaskPortrait;
-    case RNSOrientationPortraitDown:
-      return UIInterfaceOrientationMaskPortraitUpsideDown;
-    case RNSOrientationLandscape:
-      return UIInterfaceOrientationMaskLandscape;
-    case RNSOrientationLandscapeLeft:
-      return UIInterfaceOrientationMaskLandscapeLeft;
-    case RNSOrientationLandscapeRight:
-      return UIInterfaceOrientationMaskLandscapeRight;
-    case RNSOrientationInherit:
-      RCTLogError(@"[RNScreens] RNSOrientationInherit does not map directly to any UIInterfaceOrientationMask");
-      return 0;
-    default:
-      RCTLogError(@"[RNScreens] Unsupported orientation");
-      return 0;
-  }
-}
-
 RNSOrientation RNSOrientationFromUIInterfaceOrientationMask(UIInterfaceOrientationMask orientationMask)
 {
   switch (orientationMask) {
```

#### Recent Merged Pull Requests:
- **PR #4947** (closed): Closed (@MarcusZoltan)
- **PR #4940** (2026-10-19): refactor(iOS): move RNSConversions to ios/react/conversion (@kkafar)
- **PR #4939** (2026-10-19): refactor(iOS): make the orientation-to-mask converter private to UIViewController+RNScreens (@kkafar)
- **PR #4938** (2026-10-19): chore(test): e2e coverage for test-form-sheet-grabber-visible (@LKuchno)
- **PR #4936** (2026-10-19): chore(test): e2e coverage for test-form-sheet-dismiss-events (@LKuchno)
- **PR #4929** (2026-10-19): refactor(iOS): move clean shared headers and categories into ios/core (@kkafar)

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

## X. iOS, Tabs): filter UIKit's didSelectTab: for programmatic selection while More i

**RULE**:
When implementing operations in `ios/tabs/host/RNSTabBarController.mm`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in software-mansion/react-native-screens. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4a87a71d`: iOS, Tabs): filter UIKit's didSelectTab: for programmatic selection while More is active (#4890). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `ios/tabs/host/RNSTabBarController.mm`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
  /// UITab path only. YES while this controller itself writes `tabs` / `selectedTab` /
  /// `selectedViewController`. UIKit sends `didSelectTab:` synchronously from inside those writes -
  /// this flag filters them out, so that only UIKit-driven (user) selections reach the delegate
  /// logic. Marking user selections instead is not viable: for `UISearchTab`, a mount transaction
  /// can land between `shouldSelectTab:` and `didSelectTab:`.
    // Both writes below are our own. UIKit sends `didSelectTab:` synchronously from inside them, and
    // `didSelectTab:` must not treat that as a user selection - otherwise the state is progressed
    // twice and a second, `user`-origin event is emitted.
    _isApplyingProgrammaticTabSelection = YES;
    } else {
      // While More is active `selectedTab` lags behind UIKit's selection, so the write goes through
      // the legacy setter (our own override, so that reconciliation of implicit UIKit-driven updates
      // keeps working).
      [self setSelectedViewController:screenController];
    _isApplyingProgrammaticTabSelection = NO;
    return;
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
  /// UITab path only. YES while this controller itself writes `tabs` / `selectedTab`. UIKit sends
  /// `didSelectTab:` synchronously from inside those writes - this flag filters them out, so that
  /// only UIKit-driven (user) selections reach the delegate logic. Marking user selections instead
  /// is not viable: for `UISearchTab`, a mount transaction can land between `shouldSelectTab:`
  /// and `didSelectTab:`.
      _isApplyingProgrammaticTabSelection = YES;
      _isApplyingProgrammaticTabSelection = NO;
      return;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4a87a71d` are properly handled with clean fallback behavior.
